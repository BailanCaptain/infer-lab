"""Parse Python text only: never import or execute the inspected project."""
import ast
import json
import re
import sys


ROOT_CONFIG = "AscendConfig"


def scan(files):
    trees = {path: ast.parse(text, filename=path) for path, text in files.items()}
    classes = {}
    for path, tree in trees.items():
        for cls in ast.walk(tree):
            if isinstance(cls, ast.ClassDef) and (
                cls.name.endswith("Config") or any("config" in ast.unparse(d).lower() for d in cls.decorator_list)
            ):
                classes[(path, cls.name)] = cls
    # Which config classes are really user-facing: when the scanned set contains the root config
    # class, only trust classes defined in the root's file or named by it. Internal dataclasses
    # that merely end in "Config" (WeightSwitchConfig, a TypedDict in xlite, ...) do not hang under
    # additional_config; they stay "suspect" so a human looks before a page is published.
    # Without a root class in scope (single files, other repos) nothing changes.
    root_files = {
        path
        for path, tree in trees.items()
        for node in ast.walk(tree)
        if isinstance(node, ast.ClassDef) and node.name == ROOT_CONFIG
    }
    root_text = "\n".join(files[path] for path in root_files)

    def reachable(path, name):
        if not root_files or path in root_files:
            return True
        return re.search(r"\b" + re.escape(name) + r"\b", root_text) is not None

    parents = {}
    names = {name for _, name in classes}
    for (path, name), cls in classes.items():
        for field in cls.body:
            if isinstance(field, ast.AnnAssign) and isinstance(field.target, ast.Name):
                for target in names:
                    if re.search(r"\b" + re.escape(target) + r"\b", ast.unparse(field.annotation)):
                        candidates = [(p, n) for p, n in classes if n == target]
                        if (path, target) in classes:
                            candidates = [(path, target)]
                        if len(candidates) == 1:
                            parents.setdefault(candidates[0], []).append(((path, name), field.target.id))

    # Old constructors pass an explicitly selected user dictionary to a child config.
    for (path, name), cls in classes.items():
        if name != ROOT_CONFIG:
            continue
        for method in cls.body:
            if not isinstance(method, ast.FunctionDef) or method.name != "__init__":
                continue
            selected = {}
            for node in method.body:
                if not isinstance(node, ast.Assign) or len(node.targets) != 1:
                    continue
                target, value = node.targets[0], node.value
                def extract_additional_key(expr):
                    if (
                        isinstance(expr, ast.Call)
                        and isinstance(expr.func, ast.Attribute)
                        and isinstance(expr.func.value, ast.Name)
                        and expr.func.value.id == "additional_config"
                        and expr.func.attr == "get"
                        and expr.args
                        and isinstance(expr.args[0], ast.Constant)
                        and isinstance(expr.args[0].value, str)
                    ):
                        return expr.args[0].value
                    return None

                if isinstance(target, ast.Name):
                    selected.pop(target.id, None)
                    extracted = extract_additional_key(value)
                    if extracted:
                        selected[target.id] = extracted
                if not (
                    isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name) and target.value.id == "self"
                    and isinstance(value, ast.Call) and isinstance(value.func, ast.Name)
                ):
                    continue
                arg_id = (
                    value.args[0].id
                    if value.args and isinstance(value.args[0], ast.Name)
                    else next(
                        (kw.value.id for kw in value.keywords if kw.arg is None and isinstance(kw.value, ast.Name)),
                        None,
                    )
                )
                inline_key = (
                    extract_additional_key(value.args[0])
                    if value.args
                    else None
                ) or next(
                    (extract_additional_key(kw.value) for kw in value.keywords if kw.arg is None),
                    None,
                )
                key = (selected.get(arg_id) if arg_id else None) or inline_key
                candidates = [(p, n) for p, n in classes if n == value.func.id]
                if (path, value.func.id) in classes:
                    candidates = [(path, value.func.id)]
                if key and len(candidates) == 1:
                    link = ((path, name), key)
                    if link not in parents.get(candidates[0], []):
                        parents.setdefault(candidates[0], []).append(link)

    # A sub-config can also be attached without its class appearing in the annotation: the field is
    # typed `Any` (forward reference) and the factory builds it and passes it by keyword, e.g.
    #   sparse_kv = SparseKVOffloadConfig.from_additional_config(...)
    #   AscendConfig(sparse_kv_offload_config=sparse_kv, ...)
    # Follow that inside the root file so the fields land under the right key, not at top level.
    for path in root_files:
        built = {}
        for node in ast.walk(trees[path]):
            if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
                call = node.value
                if isinstance(call, ast.Call):
                    func = call.func.value if isinstance(call.func, ast.Attribute) else call.func
                    # a classmethod of the root itself returns a plain value, not a sub-config
                    if isinstance(func, ast.Name) and func.id in names and func.id != ROOT_CONFIG:
                        built[node.targets[0].id] = func.id
        for node in ast.walk(trees[path]):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == ROOT_CONFIG:
                for kw in node.keywords:
                    target = built.get(kw.value.id) if kw.arg and isinstance(kw.value, ast.Name) else None
                    candidates = [(p, n) for p, n in classes if n == target]
                    if (path, target) in classes:
                        candidates = [(path, target)]
                    link = ((path, ROOT_CONFIG), kw.arg)
                    if len(candidates) == 1 and link not in parents.get(candidates[0], []):
                        parents.setdefault(candidates[0], []).append(link)

    # Keys the factory strips from user input before validation (`_NON_USER_INPUT_KEYS`). Some of
    # them are still user keys — the factory reads them itself (`additional_config.get("x")`) and
    # passes the result explicitly. The rest are factory-injected or purely derived: a user who
    # writes them gets them silently dropped, so they must not be published as parameters.
    stripped = set()
    for path in root_files:
        for node in ast.walk(trees[path]):
            if (
                isinstance(node, ast.Assign)
                and any(isinstance(t, ast.Name) and t.id == "_NON_USER_INPUT_KEYS" for t in node.targets)
                and isinstance(node.value, (ast.Set, ast.List, ast.Tuple))
            ):
                stripped |= {e.value for e in node.value.elts if isinstance(e, ast.Constant) and isinstance(e.value, str)}

    def user_reads(key):
        quoted = re.escape(json.dumps(key))
        return re.search(r"(?:\.get\(\s*|\[\s*)" + quoted, root_text) is not None or re.search(quoted + r"\s+in\s+", root_text) is not None

    non_user = {key for key in stripped if not user_reads(key)}

    def class_paths(name, visited=()):
        if name in visited:
            return ["additional_config"]
        ps = parents.get(name, [])
        if not ps:
            # A class the root config cannot reach does not live under additional_config (it may be
            # a connector's extra config, a JSON file's schema, or plain internal state). Do not
            # claim it does: start its path with the class name instead.
            return ["additional_config"] if reachable(*name) else [name[1]]
        return sorted(set(base + "[" + json.dumps(field) + "]" for parent, field in ps for base in class_paths(parent, visited + (name,))))

    container_args = {"config", "user_config", "vllm_config", "additional_config"}

    def collect_ifs(node, ancestor_ifs=frozenset()):
        found = []
        if isinstance(node, ast.If):
            if any(isinstance(n, (ast.Raise, ast.Assign, ast.AugAssign)) for n in ast.walk(node)):
                statement = ast.unparse(node)
                found.append(
                    (
                        node,
                        statement,
                        set(re.findall(r"\b[A-Za-z_][A-Za-z0-9_]*\b", statement)),
                        ancestor_ifs,
                    )
                )
            next_ancestors = ancestor_ifs | {node}
        else:
            next_ancestors = ancestor_ifs
        for child in ast.iter_child_nodes(node):
            found.extend(collect_ifs(child, next_ancestors))
        return found

    rows = []
    for (path, name), cls in classes.items():
        lines = files[path].splitlines()
        ann_fields = [
            f
            for f in cls.body
            if isinstance(f, ast.AnnAssign) and isinstance(f.target, ast.Name) and not f.target.id.startswith("_")
        ]
        ann_names = {f.target.id for f in ann_fields}
        field_specs = []
        for field in ann_fields:
            annotation = ast.unparse(field.annotation)
            # Class constants are excluded from dataclass/config constructor fields.
            if re.match(r"(?:typing\.)?ClassVar(?:\[|$)", annotation):
                continue
            field_specs.append(
                (field.target.id, annotation, ast.unparse(field.value) if field.value else "<required>", field.lineno)
            )
        if name != ROOT_CONFIG:
            for method in cls.body:
                if not isinstance(method, ast.FunctionDef) or method.name != "__init__":
                    continue
                self_attrs = {
                    t.attr
                    for node in ast.walk(method)
                    if isinstance(node, ast.Assign)
                    for t in node.targets
                    if isinstance(t, ast.Attribute) and isinstance(t.value, ast.Name) and t.value.id == "self"
                } | {
                    node.target.attr
                    for node in ast.walk(method)
                    if isinstance(node, ast.AnnAssign)
                    and isinstance(node.target, ast.Attribute)
                    and isinstance(node.target.value, ast.Name)
                    and node.target.value.id == "self"
                }
                all_pos_args = method.args.posonlyargs + method.args.args
                all_pos_defaults = [None] * (len(all_pos_args) - len(method.args.defaults)) + list(method.args.defaults)
                pairs = list(zip(all_pos_args[1:], all_pos_defaults[1:])) + list(
                    zip(method.args.kwonlyargs, method.args.kw_defaults)
                )
                for arg_node, default_node in pairs:
                    label = arg_node.arg
                    if (
                        label.startswith("_")
                        or label in ann_names
                        or label in container_args
                        or default_node is None
                        or label not in self_attrs
                    ):
                        continue
                    field_specs.append(
                        (
                            label,
                            ast.unparse(arg_node.annotation) if arg_node.annotation else "unknown",
                            ast.unparse(default_node),
                            arg_node.lineno,
                        )
                    )
        conditions = []
        for method in cls.body:
            if not isinstance(method, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            conditions.extend(collect_ifs(method))
        certain = reachable(path, name) and (
            name.endswith("Config") or any("config" in ast.unparse(d).lower() for d in cls.decorator_list)
        )
        for label, annotation, value, lineno in field_specs:
            comments = []
            i = lineno - 2
            while i >= 0 and lines[i].lstrip().startswith("#"):
                comments.insert(0, lines[i].lstrip()[1:].strip())
                i -= 1
            matched_ifs = {if_node for if_node, _, identifiers, _ in conditions if label in identifiers}
            constraints = [
                statement
                for _, statement, identifiers, ancestor_ifs in conditions
                if label in identifiers and not (ancestor_ifs & matched_ifs)
            ]
            for base in class_paths((path, name)):
                json_path = base + "[" + json.dumps(label) + "]"
                top_key = re.match(r'additional_config\["([^"]+)"\]', json_path)
                user_facing = certain and not (top_key and top_key.group(1) in non_user)
                row = dict(name=label, type=annotation, default=value, **{"class": name}, json_path=json_path, file=path, line=lineno, comment="\n".join(comments), constraints=list(dict.fromkeys(constraints)), confidence="certain" if user_facing else "suspect", form="field")
                rows.append(row)
                if re.search(r"\b(?:dict|Dict)\b", annotation):
                    for key in sorted(set(re.findall(r"\b[a-z][a-z0-9]*_[a-z0-9_]+\b", row["comment"])) - {label}):
                        rows.append(dict(row, name=key, type="unknown", default="<unknown>", json_path=row["json_path"] + "[" + json.dumps(key) + "]", confidence="suspect", form="dict-key", constraints=[]))
    known = {r["name"] for r in rows}
    # `**kwargs` is plain argument forwarding almost everywhere: `kwargs["vllm_config"]` alone appeared
    # 2396 times on main and a third of every baseline was such rows. Inside a config class it does
    # carry user keys (v0.23 / v0.26 AscendCompilationConfig.__init__ reads kwargs.get("fuse_muls_add")),
    # so a kwargs lookup only counts there.
    in_config = {path: set() for path in trees}
    for (path, _), cls in classes.items():
        in_config[path].update(id(n) for n in ast.walk(cls))
    for path, tree in trees.items():
        for node in ast.walk(tree):
            key, owner, fallback = None, None, "<unknown>"
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr in ("get", "pop", "setdefault") and node.args:
                key, owner = node.args[0], node.func.value
                fallback = ast.unparse(node.args[1]) if len(node.args) > 1 else "None"
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "_get_config_value" and len(node.args) >= 4:
                key, owner = node.args[1], node.args[0]
                fallback = ast.unparse(node.args[3])
            elif isinstance(node, ast.Subscript):
                key, owner = node.slice, node.value
            if not isinstance(key, ast.Constant) or not isinstance(key.value, str) or not re.fullmatch(r"[a-z][a-z0-9_]*", key.value):
                continue
            base = ast.unparse(owner)
            if key.value in known:
                continue
            if not re.search(r"config|params", base, re.I) and not (
                re.search(r"kwargs", base, re.I) and id(node) in in_config[path]
            ):
                continue
            rows.append(dict(name=key.value, type="unknown", default=fallback, **{"class": ""}, json_path=base + "[" + json.dumps(key.value) + "]", file=path, line=node.lineno, comment="", constraints=[], confidence="suspect", form="string-lookup"))
    # One row per identity (file, class, json_path) — the same key the nightly diff joins on. The same
    # lookup written on several lines used to yield several rows sharing one identity; the diff kept
    # whichever came last, so a line shift flipped defaults back and forth as fake "changes". Keep the
    # first line; the other places are already in the name's occurrences.
    unique = {}
    for r in sorted(rows, key=lambda r: (r["file"], r["line"], r["json_path"])):
        unique.setdefault((r["file"], r["class"], r["json_path"]), r)
    return sorted(unique.values(), key=lambda r: (r["file"], r["line"], r["json_path"]))


if __name__ == "__main__":
    try:
        print(json.dumps(scan(json.load(sys.stdin)), ensure_ascii=True))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
