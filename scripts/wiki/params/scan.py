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

    rows = []
    for (path, name), cls in classes.items():
        lines = files[path].splitlines()
        fields = [f for f in cls.body if isinstance(f, ast.AnnAssign) and isinstance(f.target, ast.Name) and not f.target.id.startswith("_")]
        conditions = []
        for method in cls.body:
            if not isinstance(method, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for node in ast.walk(method):
                if isinstance(node, ast.If) and any(isinstance(n, (ast.Raise, ast.Assign, ast.AugAssign)) for n in ast.walk(node)):
                    statement = ast.unparse(node)
                    conditions.append((statement, set(re.findall(r"\b[A-Za-z_][A-Za-z0-9_]*\b", statement))))
        certain = reachable(path, name) and (
            name.endswith("Config") or any("config" in ast.unparse(d).lower() for d in cls.decorator_list)
        )
        for field in fields:
            label = field.target.id
            comments = []
            i = field.lineno - 2
            while i >= 0 and lines[i].lstrip().startswith("#"):
                comments.insert(0, lines[i].lstrip()[1:].strip())
                i -= 1
            constraints = [statement for statement, identifiers in conditions if label in identifiers]
            annotation = ast.unparse(field.annotation)
            value = ast.unparse(field.value) if field.value else "<required>"
            for base in class_paths((path, name)):
                json_path = base + "[" + json.dumps(label) + "]"
                top_key = re.match(r'additional_config\["([^"]+)"\]', json_path)
                user_facing = certain and not (top_key and top_key.group(1) in non_user)
                row = dict(name=label, type=annotation, default=value, **{"class": name}, json_path=json_path, file=path, line=field.lineno, comment="\n".join(comments), constraints=list(dict.fromkeys(constraints)), confidence="certain" if user_facing else "suspect", form="field")
                rows.append(row)
                if re.search(r"\b(?:dict|Dict)\b", annotation):
                    for key in sorted(set(re.findall(r"\b[a-z][a-z0-9]*_[a-z0-9_]+\b", row["comment"])) - {label}):
                        rows.append(dict(row, name=key, type="unknown", default="<unknown>", json_path=row["json_path"] + "[" + json.dumps(key) + "]", confidence="suspect", form="dict-key", constraints=[]))
    known = {r["name"] for r in rows}
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
            if key.value in known or not re.search(r"config|params|kwargs", base, re.I):
                continue
            rows.append(dict(name=key.value, type="unknown", default=fallback, **{"class": ""}, json_path=base + "[" + json.dumps(key.value) + "]", file=path, line=node.lineno, comment="", constraints=[], confidence="suspect", form="string-lookup"))
    unique = {(r["file"], r["class"], r["json_path"], r["line"]): r for r in rows}
    return sorted(unique.values(), key=lambda r: (r["file"], r["line"], r["json_path"]))


if __name__ == "__main__":
    try:
        print(json.dumps(scan(json.load(sys.stdin)), ensure_ascii=True))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
