"""Reproducible, read-only source inventory. Never import inspected upstream code."""
import ast
import collections
import hashlib
import io
import json
import re
import subprocess
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
PINS = {'vllm': {'v0.23': '0fc695fc', 'v0.26': '568afb3a', 'main': '84030bbe'},
        'vllm-ascend': {'GLM': 'db701c1f', 'v0.23': '2c59ff10', 'v0.26rc': '2ed6cbba', 'main': 'baa023ad'}}

def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(ROOT / 'tools/repos' / repo), *args])

def fields(cls):
    for i, n in enumerate(cls.body):
        if isinstance(n, ast.AnnAssign) and isinstance(n.target, ast.Name):
            name = n.target.id
            if name.startswith('_') or 'ClassVar' in ast.unparse(n.annotation):
                continue
            doc = ''
            if i + 1 < len(cls.body):
                nxt = cls.body[i + 1]
                if isinstance(nxt, ast.Expr) and isinstance(nxt.value, ast.Constant) and isinstance(nxt.value.value, str):
                    doc = nxt.value.value
            yield n, name, ast.unparse(n.value) if n.value else '<required>', doc

def extract(files, ascend_scan=None):
    rows, dynamic = [], []
    def add(kind, file, owner, name, node, default='', doc='', confidence='definition'):
        rows.append(dict(kind=kind, file=file, owner=owner, name=name, line=node.lineno,
                         default=default, doc=doc, confidence=confidence))
    trees = {p: ast.parse(s, filename=p) for p, s in files.items()}
    for file, tree in trees.items():
        for cls in [x for x in ast.walk(tree) if isinstance(x, ast.ClassDef)]:
            kind = None
            if file in ('vllm/sampling_params.py', 'vllm/pooling_params.py') and cls.name.endswith('Params'):
                kind = '采样与池化'
            elif file.startswith('vllm/config/') and cls.name.endswith('Config'):
                kind = '引擎配置'
            elif file == 'vllm/engine/arg_utils.py' and cls.name.endswith('Args'):
                kind = '引擎启动字段'
            elif '/entrypoints/' in file and cls.name.endswith('Args'):
                kind = '服务启动字段'
            elif '/entrypoints/' in file and cls.name.endswith('Request'):
                kind = '接口请求'
            elif '/entrypoints/' in file and file.endswith('protocol.py') and not re.search('Response|Output|LogProb|Usage|Error|Delta|Choice', cls.name):
                kind = '接口嵌套结构候选'
            elif file.startswith('vllm/') and cls.name.endswith(('Config', 'Params')):
                kind = '其他配置结构候选'
            if kind:
                for n, name, default, doc in fields(cls):
                    add(kind, file, cls.name, name, n, default, doc,
                        'candidate' if kind.endswith('候选') else 'definition')
            if file == 'vllm/entrypoints/llm.py' and cls.name == 'LLM':
                for method in cls.body:
                    if isinstance(method, ast.FunctionDef) and method.name == '__init__':
                        args=method.args
                        pos=args.posonlyargs+args.args
                        defaults=[None]*(len(pos)-len(args.defaults))+args.defaults
                        for arg,default in list(zip(pos,defaults))+list(zip(args.kwonlyargs,args.kw_defaults)):
                            if arg.arg!='self':
                                add('离线 LLM 构造参数',file,'LLM.__init__',arg.arg,arg,
                                    ast.unparse(default) if default else '<required>')
        for node in ast.walk(tree):
            if isinstance(node, (ast.Assign, ast.AnnAssign)):
                val = node.value
                targets = node.targets if isinstance(node, ast.Assign) else [node.target]
                if isinstance(val, ast.Dict) and any(isinstance(t, ast.Name) and t.id in ('env_variables', 'environment_variables') for t in targets):
                    for k, v in zip(val.keys, val.values):
                        if isinstance(k, ast.Constant) and isinstance(k.value, str):
                            add('环境变量注册', file, 'env', k.value, k, ast.unparse(v))
            if not isinstance(node, ast.Call):
                continue
            fn = ast.unparse(node.func)
            if fn.endswith('.add_argument'):
                flags = [a.value for a in node.args if isinstance(a, ast.Constant) and isinstance(a.value, str) and a.value.startswith('--')]
                if flags:
                    default = next((ast.unparse(k.value) for k in node.keywords if k.arg == 'default'), '<argparse/inherited>')
                    kind = '工具命令行' if any(s in file for s in ('benchmark', '/bench', '/tools/')) else '命令行选项'
                    for flag in flags:
                        add(kind, file, 'cli', flag, node, default)
                elif node.args:
                    dynamic.append(dict(file=file, line=node.lineno, expression=ast.unparse(node)[:500]))
            if fn in ('os.getenv', 'os.environ.get', 'os.environ.pop', 'environ.get', 'getenv') and node.args:
                key = node.args[0]
                if isinstance(key, ast.Constant) and isinstance(key.value, str):
                    add('环境变量读取', file, 'env', key.value, node, ast.unparse(node.args[1]) if len(node.args)>1 else 'None')
            if fn.endswith('.get') and node.args and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
                owner = ast.unparse(node.func.value)
                if re.search('extra_config|additional_config|engine_load_config', owner):
                    add('开放字典键候选', file, owner, node.args[0].value, node,
                        ast.unparse(node.args[1]) if len(node.args)>1 else 'None', confidence='candidate')
        for node in ast.walk(tree):
            if isinstance(node, ast.Subscript) and ast.unparse(node.value) in ('os.environ', 'environ') and isinstance(node.ctx, ast.Load):
                if isinstance(node.slice, ast.Constant) and isinstance(node.slice.value, str):
                    add('环境变量读取', file, 'env', node.slice.value, node, '<required>')
    if ascend_scan:
        for r in ascend_scan(files):
            rows.append(dict(kind='Ascend 配置' if r['confidence']=='certain' else 'Ascend 配置候选',
                file=r['file'], owner=r['json_path'].rsplit('[',1)[0], name=r['name'], line=r['line'],
                default=r['default'], doc=r['comment'], confidence=r['confidence'], type=r['type'],
                constraints=r['constraints']))
    return rows, dynamic

def pattern(name):
    parts = re.split('[_ -]+', name.lstrip('-'))
    return re.compile(r'(?<![A-Za-z0-9_])' + r'[_ -]+'.join(map(re.escape, parts)) + r'(?![A-Za-z0-9_])', re.I)

def run():
    # Reuse the project's Ascend dictionary/class scanner, without changing its production scope.
    ns = {'__name__': 'inventory_reuse'}
    exec((ROOT/'scripts/wiki/params/scan.py').read_text(encoding='utf-8'), ns)
    pages = []
    registry = json.loads((ROOT/'src/content/wiki/registry.json').read_text(encoding='utf-8'))
    for p in registry['pages']:
        if p['type'] not in ('param','concept','feature'):
            continue
        path = ROOT/'wiki'/p['file'] if not p['file'].startswith('wiki/') else ROOT/p['file']
        txt = path.read_text(encoding='utf-8')
        parts = txt.split('---',2)
        body = parts[2] if len(parts)==3 else txt
        start = txt.find(body)
        start_line = txt[:start].count('\n')+1
        lines = [(i+start_line, re.sub(r'https?://\S+|vllm(?:-ascend)?@[a-f0-9]+:[^\s`|]+|raw:sha256[^\s`|]+', '', s)) for i,s in enumerate(body.splitlines())]
        pages.append((p, path.relative_to(ROOT).as_posix(), lines, hashlib.sha256(txt.encode()).hexdigest()))
    allrows, snapshots, dynamic = [], [], []
    for repo, versions in PINS.items():
        prefix = 'vllm_ascend' if repo=='vllm-ascend' else 'vllm'
        for version, pin in versions.items():
            commit=git(repo,'rev-parse',pin).decode().strip()
            archive=git(repo,'archive',commit,prefix)
            with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
                files={m.name:tar.extractfile(m).read().decode('utf-8') for m in tar.getmembers() if m.isfile() and m.name.endswith('.py')}
            rows, dyn=extract(files, ns['scan'] if repo=='vllm-ascend' else None)
            snapshots.append(dict(repo=repo,version=version,commit=commit,pythonFiles=len(files),definitions=len(rows)))
            for r in rows:
                r.update(repo=repo,version=version,commit=commit)
                allrows.append(r)
            dynamic.extend(dict(repo=repo,version=version,**d) for d in dyn)
            print(repo,version,len(files),len(rows),flush=True)
    grouped={}
    for r in allrows:
        # Same spelling in different request schemas/config paths remains separate.
        key=(r['repo'],r['kind'],r['file'],r['owner'],r['name'])
        grouped.setdefault(key,[]).append(r)
    normalized_pages={p['id']:re.sub(r'[_ -]+','_', '\n'.join(s for _,s in lines)).lower() for p,path,lines,sha in pages}
    cache={}
    result=[]
    for key,defs in sorted(grouped.items()):
        name=key[-1]
        if name not in cache:
            pat=pattern(name)
            hits=[]
            for p,path,lines,sha in pages:
                if re.sub(r'[_ -]+','_',name.lstrip('-')).lower() not in normalized_pages[p['id']]:
                    continue
                found=[(ln,s) for ln,s in lines if pat.search(s)]
                if found:
                    hits.append(dict(page=p['id'],file=path,line=found[0][0],excerpt=found[0][1][:650],count=len(found),type=p['type']))
            cache[name]=hits
        hits=cache[name]
        short=len(name.lstrip('-'))<=4
        state='同名含义待核' if short else ('未检出名称' if not hits else '已有提及待核完整性')
        direct=[p for p,path,lines,sha in pages if p['type']=='param' and (p['title']==name or name in p.get('aliases',[]))]
        if direct:
            state='已有专页待核完整性'
        result.append(dict(repo=key[0],kind=key[1],file=key[2],owner=key[3],name=name,status=state,
                           definitions=defs,hits=hits,dedicatedPages=[p['id'] for p in direct]))
    payload=dict(snapshots=snapshots,pages=[dict(id=p['id'],file=path,sha256=sha) for p,path,lines,sha in pages],
                 entries=result,dynamicCli=dynamic)
    (OUT/'inventory.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    counts=collections.Counter(r['status'] for r in result)
    print(json.dumps(dict(total=len(result),statuses=counts,dynamicCli=len(dynamic)),ensure_ascii=False))
    for status,filename in [('未检出名称','unmentioned.md'),('已有提及待核完整性','mentioned.md'),('已有专页待核完整性','dedicated.md'),('同名含义待核','ambiguous.md')]:
        lines=[f'# {status}', '', '自动对账结果；判定口径和限制见 README.md。同名不同配置路径分开计数，候选字段不能计为已确认公共参数。', '', '| 仓库 / 类别 | 参数与所属结构 | 存在的固定快照 | 源码 | 知识页线索 |','|---|---|---|---|---|']
        for e in result:
            if e['status']!=status: continue
            d=e['definitions'][0]
            url=f"https://github.com/vllm-project/{e['repo']}/blob/{d['commit']}/{e['file']}#L{d['line']}"
            links='；'.join(f"[{h['page']}]({('../../../'+h['file'])})（{h['line']}行）" for h in e['hits'][:3]) or '—'
            versions=', '.join(dict.fromkeys(d['version'] for d in e['definitions']))
            owner=e['owner'].replace('|','\\|')
            lines.append(f"| {e['repo']} / {e['kind']} | `{e['name']}` · `{owner}` | {versions} | [定义]({url}) | {links} |")
        (OUT/filename).write_text('\n'.join(lines)+'\n',encoding='utf-8')
    assert all(e['definitions'] for e in result)
    assert sum(counts.values())==len(result)
    for version in PINS['vllm']:
        assert any(e['name']=='presence_penalty' and e['owner']=='SamplingParams' and any(d['version']==version for d in e['definitions']) for e in result)
    assert len(snapshots)==7

if __name__=='__main__':
    # Small parser checks: private/ClassVar exclusion, flags, environment reads and name boundaries.
    rows,_=extract({'vllm/sampling_params.py':'class SamplingParams:\n x: int = 1\n _hidden: int = 2\n const: ClassVar[int] = 3\n',
                    'vllm/test.py':'p.add_argument("--foo", default=2)\nx=os.getenv("FOO", "1")\n'})
    assert {r['name'] for r in rows}=={'x','--foo','FOO'}
    assert pattern('presence_penalty').search('presence penalty')
    assert not pattern('top_p').search('stop_processing')
    run()
