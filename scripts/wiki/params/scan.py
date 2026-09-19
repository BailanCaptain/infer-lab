"""Parse Python text only: never import or execute the inspected project."""
import ast
import json
import re
import sys


def scan(files):
    trees = {path: ast.parse(text, filename=path) for path, text in files.items()}
    classes = {}
    for path, tree in trees.items():
        for cls in ast.walk(tree):
            if isinstance(cls, ast.ClassDef) and (
                cls.name.endswith("Config") or any("config" in ast.unparse(d).lower() for d in cls.decorator_list)
            ):
                classes[(path, cls.name)] = cls
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

    def class_paths(name, visited=()):
        if name in visited:
            return ["additional_config"]
        ps = parents.get(name, [])
        if not ps:
            return ["additional_config"]
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
        certain = name.endswith("Config") or any("config" in ast.unparse(d).lower() for d in cls.decorator_list)
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
                row = dict(name=label, type=annotation, default=value, **{"class": name}, json_path=base + "[" + json.dumps(label) + "]", file=path, line=field.lineno, comment="\n".join(comments), constraints=list(dict.fromkeys(constraints)), confidence="certain" if certain else "suspect", form="field")
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
