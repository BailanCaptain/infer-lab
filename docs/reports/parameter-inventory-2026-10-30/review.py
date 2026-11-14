"""Resolve the fixed inventory's scope and reference-documentation coverage.

This is a report builder, not a semantic completeness detector. Explicit review
decisions override lexical evidence; lexical evidence never grants a pass.
Only files in this report directory are written. Upstream code is never imported.
"""
import ast
import collections
import functools
import hashlib
import json
import re
import subprocess
from pathlib import Path

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
DATA = json.loads((OUT / 'inventory.json').read_text(encoding='utf-8'))

def dump(name, value):
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

@functools.lru_cache(None)
def source(repo, commit, file):
    return subprocess.check_output(['git', '-C', str(ROOT / 'tools/repos' / repo), 'show', f'{commit}:{file}']).decode('utf-8')

def body_lines(text):
    lines = text.splitlines()
    start = next((i + 1 for i, l in enumerate(lines[1:], 1) if l.strip() == '---'), 0) if lines and lines[0] == '---' else 0
    for i in range(start, len(lines)):
        if lines[i].startswith('## 已废弃的说法'):
            break
        line = re.sub(r'https?://\S+|(?:vllm(?:-ascend)?@[\w]+:)[^\s`]+', '', lines[i])
        # Source locator tables establish provenance, not parameter explanations.
        if '#L' in line or re.search(r'\.(?:py|md)(?::\d+|`?\s*\|)', line):
            continue
        yield i + 1, line

PAGES = {}
for p in DATA['pages']:
    raw = (ROOT / p['file']).read_bytes()
    PAGES[p['id']] = {**p, 'sha256': hashlib.sha256(raw).hexdigest(), 'lines': list(body_lines(raw.decode('utf-8')))}
    PAGES[p['id']]['search'] = '\n'.join(l for _,l in PAGES[p['id']]['lines'])
    PAGES[p['id']]['searchLower'] = PAGES[p['id']]['search'].lower()

def normalized(name):
    return name.lstrip('-').replace('-', '_')

@functools.lru_cache(None)
def find(name, env=False):
    pattern = re.compile(r'(?<![A-Za-z0-9_])' + re.escape(normalized(name)).replace('_', r'[_ -]') + r'(?![A-Za-z0-9_])', 0 if env else re.I)
    needles = [(normalized(name) if env else normalized(name).lower()).replace('_', sep) for sep in ('_', '-', ' ')]
    return [{'page': p['id'], 'file': p['file'], 'line': n, 'text': l}
            for p in PAGES.values() if not p['id'].startswith('rfork')
            and any(x in p['search' if env else 'searchLower'] for x in needles)
            for n, l in p['lines'] if any(x in (l if env else l.lower()) for x in needles) and pattern.search(l)]

# These classes were inspected for their role, not classified by their suffix.
PUBLIC_OTHER = set('MooncakeECConfig MooncakeStoreConfig TensorizerConfig ObjStoreConfig AnthropicOutputConfig ChatTemplateConfig ChatParams TokenizeParams'.split())
OUTPUT_CLASSES = set('AnthropicContextManagement AnthropicStreamEvent CohereLogprobItem ExtractedToolCallInformation FunctionCall ToolCall ChatMessage PerRequestMetrics PerRequestTimingMetrics SpeculativeDecodingMetrics ModelCard ModelList ModelPermission InputTokensDetails ClassificationData CohereApiVersion CohereBilledUnits CohereEmbedByTypeEmbeddings CohereMeta RerankResult DerenderStreamState SessionCreated TranscriptionDone TranscriptionDiarizedSegment TranscriptionSegment TranscriptionWord TranslationSegment TranslationWord'.split())
ASCEND_PATH = {
    'AscendConfig': 'additional_config', 'AscendCompilationConfig': 'additional_config.ascend_compilation_config',
    'AscendFusionConfig': 'additional_config.ascend_fusion_config', 'EplbConfig': 'additional_config.eplb_config',
    'FinegrainedTPConfig': 'additional_config.finegrained_tp_config', 'RejectionSamplerConfig': 'additional_config.rejection_sampler_config',
    'RlConfig': 'additional_config.rl_config', 'SchedulerConfig': 'additional_config.scheduler_config',
    'ProfilingChunkConfig': 'additional_config.scheduler_config.profiling_chunk_config',
    'BatchJobSchedConfig': 'additional_config.scheduler_config.batch_job_sched_config',
    'DyntraLBConfig': 'additional_config.scheduler_config.dyntra_lb_config',
    'ShortRequestFirstConfig': 'additional_config.scheduler_config.short_request_first_config',
    'SparseKVOffloadConfig': 'additional_config.sparse_kv_offload_config',
    'WeightPrefetchConfig': 'additional_config.weight_prefetch_config', 'XliteGraphConfig': 'additional_config.xlite_graph_config',
    'DynamicSpecConfig': 'additional_config.dynamic_spec_config', 'KVPPConfig': 'additional_config.kvpp_config',
}

@functools.lru_cache(None)
def source_classes(repo, commit, file):
    tree = ast.parse(source(repo, commit, file))
    return [n for n in ast.walk(tree) if isinstance(n, ast.ClassDef)]

def enclosing(repo, commit, file, line):
    classes = [n for n in source_classes(repo, commit, file) if n.lineno <= line <= n.end_lineno]
    return min(classes, key=lambda n: n.end_lineno - n.lineno).name if classes else ''

def scope(e):
    k, f, o, n = e['kind'], e['file'], e['owner'], e['name']
    defs = e['definitions']
    if n.startswith('_'):
        return '内部派生', '私有实现标记，不能作为普通调参入口。'
    if defs and all(re.search(r'init\s*=\s*False', d['default']) for d in defs):
        return '内部派生', '定义显式 init=False，构造输入不接受此字段。'
    if k == '接口嵌套结构候选' and (o in OUTPUT_CLASSES or o.endswith('Event')):
        return '输出协议', '这是响应、流事件或内部中间结果结构，不是调用者的请求参数。'
    if k == '其他配置结构候选':
        if o == 'MoRIIOConfig':
            if n in {'tp_rank','dp_rank','tp_size','dp_size','local_kv_port','local_ping_port'}:
                return '内部派生', 'MoRIIO 工厂从并行组或 get_open_port 派生此成员，不是独立 extra_config 输入。'
            return '连接器配置', '连接器配置聚合；含从并行配置、环境和 extra_config 推导的成员，补写须按来源说明。'
        if o in PUBLIC_OTHER:
            return '扩展配置', '独立加载器、连接器或渲染 API 的配置；不等同普通服务启动开关。'
        if '/models/' in f or '/transformers_utils/' in f or '/quantization/' in f:
            return '模型或量化描述', '模型结构、权重量化元信息或模型处理器参数，不属于本轮服务/请求参数参考范围。'
        return '内部派生', '内核形状、调度/缓存布局或实现间传递的配置结构；没有据此建立新的用户调参入口。'
    if o == 'ModelArchitectureConfig':
        return '模型或量化描述', '由模型配置抽取的架构信息，不是独立启动选项。'
    if o == 'SamplingParams' and n in {'skip_clone', 'output_text_buffer_length'}:
        return '内部派生', 'SamplingParams 源码明确标为 internal / 非输入、由初始化生成。'
    if o == 'PoolingParams' and n in {'task', 'requires_token_ids', 'skip_reading_prefix_cache', 'late_interaction_params', 'extra_kwargs', 'output_kind'}:
        return '内部派生', 'PoolingParams 将这组标为 Internal use only；保留追踪，但不作为普通池化调参漏项。'
    if o == 'LateInteractionParams':
        return '内部派生', '由池化/评分入口构造的内部晚交互信息；不能直接套用启动参数的 mode。'
    if e['repo'] == 'vllm-ascend' and k in {'Ascend 配置', 'Ascend 配置候选', '开放字典键候选'}:
        if n in {'kvpp_config', 'size'} and ('kvpp_config' in o or n == 'kvpp_config'):
            return '内部派生', 'KVPP 工厂按 TP/PCP 构建；知识页也明确不可直接配置。'
        if n in {'pd_tp_ratio','pd_head_ratio','num_head_replica','enable_sp_by_pass'} and f.endswith('ascend_config.py'):
            return '内部派生', '由并行度/图模式推导的成员；main 工厂显式剔除相应输入键。'
        if o in {'ModuleWeightPrefetchConfig','WeightSwitchConfig','WeightGetterConfig','SituActivationConfig','MLAConfig','RecomputeSchedulerConfig','FlashLBConfig'}:
            return '内部派生', '执行层/权重切换/缓存形状的内部状态，不是 additional_config 的用户字段。'
        if o == 'scheduler_config' and f.endswith('/recompute_scheduler.py'):
            return '内部派生', '读取上游已有 SchedulerConfig 的字段；不是 Ascend 新增输入键。'
        if 'quant_description' in o or '_quant_comm_config' in o:
            return '模型或量化描述', '量化权重描述/内部通信函数，不是可传入服务配置的新增键。'
        if o == 'KVCompConfig':
            return '模型附加配置', 'KVComp 模型侧配置聚合，与 additional_config.hamming_sparse 开关分开记录。'
        if 'kv_transfer_params' in o or (o == 'params' and '/kv_transfer/' in f):
            return '传输协议', 'PD 代理与连接器交换的请求传输元数据；单列接口说明，不能算服务调参开关。'
        if any(x in f for x in ('/quantization/', '/models/', '/transformers_utils/')) and 'additional_config' not in o:
            return '模型或量化描述', '模型/权重描述或量化张量读取；不是服务配置键。'
        if any(x in o for x in ('__annotations__','__dataclass_fields__','_CONFIG_REGISTRY','MODEL_ARCH_CONFIG_CONVERTORS')):
            return '内部派生', '类型注册或补丁元信息读取，静态扫描误当配置键。'
        if any(x in o for x in ('rope_parameters','rope_params','scaling_config','linear_attn_config','draft_config','dflash_config','eagle_config','pre_trained_config','config_dict','hf_config','model_configs','attention_other_setting')) or o in {'kda_config','moe_quant_params','hccl_config','param_config','params'}:
            return '内部派生', '模型/算子/解析器内部字典，不是新的服务配置入口。'
        return 'Ascend 用户配置', 'Ascend 额外配置、工厂控制输入或连接器扩展键；具体路径以逐版本源位置为准。'
    if '环境变量' in k:
        return ('环境变量' if n.startswith(('VLLM_', 'VLLM')) or k == '环境变量注册' else '外部环境依赖'), '注册或读取的环境入口；系统、构建、CUDA/ROCm 与 Ascend 适用范围分别列示。'
    if k == '工具命令行':
        return '工具参数', '基准测试/绘图/调试工具入口，不并入线上推理开关统计。'
    return '用户参数', '按定义所属 API/配置层核对；同名请求值与引擎默认值不自动等同。'

# Manual semantic mappings: Chinese mechanisms and short-name disambiguation.
TOPICS = {
    'SamplingParams': ['sampling','streaming-output','request-teardown','token','prefix-caching','prefill','vllm-ascend-for-rl','structured-output'],
    'StructuredOutputsParams': ['structured-output'], 'BeamSearchParams': [],
    'PoolingParams': [], 'RepetitionDetectionParams': ['request-teardown'],
    'PassConfig': ['sequence-parallel','graph-mode-layer'],
    'DynamicShapesConfig': ['graph-mode-layer'],
    'MoRIIOConfig': [], 'TensorizerConfig': [], 'ObjStoreConfig': [],
    'WatermarkConfig': [], 'EngramConfig': [], 'KVCompConfig': [],
}
CHINESE = {
    'allowed_token_ids': ('sampling', '允许', '已讲允许编号清单；缺精确键名、类型、空列表/非法编号行为和请求示例。'),
    'bad_words': ('sampling', '词串', '已讲屏蔽词串；缺键名、分词规则、多 token 匹配及请求示例。'),
    'skip_reading_prefix_cache': ('prefix-caching', '跳过', '已讲跳过缓存读取；缺请求字段入口、默认推导及与 prompt_logprobs 的版本对照。'),
}
SAMPLING_GAPS = {
    'presence_penalty': '缺默认 0、范围 [-2,2]、负值含义及可复制的请求示例；现有 1.5 是算例。',
    'frequency_penalty': '缺默认 0、范围 [-2,2]、负值含义及请求示例。',
    'repetition_penalty': '缺中性值 1、合法正数范围、小于 1 的行为及请求覆盖示例。',
    'temperature': '已有计算、范围及报错；版本表明确尚未单独核对 main 上游温度限制。',
    'top_p': '已有截断演算；缺 SamplingParams 缺省值与模型 generation_config / 请求覆盖后的完整逐版对照。',
    'top_k': '已有截断、关闭值及并列规则；缺 SamplingParams 默认值、greedy 归一化与三版参数表。',
    'min_p': '已有机制、范围；缺默认值与实际请求入口例子。',
    'seed': '已有每请求生成器和全局 seed；缺请求 None 与引擎 seed=0 的完整入口/逐版对照。',
    'logprobs': '已有所选 token 的概率和输出处理；缺数量/特殊值、返回结构、各接口类型和完整请求/响应例。',
    'prompt_logprobs': '已有 prefill/缓存相互作用；缺数量特殊值、返回结构、接口限制和完整请求/响应例。',
    'logit_bias': '已有加分机制；缺 token ID 映射、数值范围/截断处理和请求写法。',
    'max_tokens': '已有停止预算和 API 缺省推导；缺 SamplingParams 默认 16 与各接口 None 的统一分层表。',
    'min_tokens': '已有最短输出与 EOS/停止编号屏蔽；缺默认值、校验边界及请求示例。',
    'n': '已有 ParentRequest 拆分多个输出；缺请求数量默认值、整数下界及与 greedy/流式输出的限制。',
    'stop': '已有字符串判停；缺 str/list/null 入口、空串校验及各接口差异。',
    'stop_token_ids': '已有编号判停；缺默认值、编号列表校验及完整请求示例。',
    'ignore_eos': '已有忽略 EOS 机制；缺默认值以及与手动 stop_token_ids 和输出上限的联合例子。',
    'detokenize': '已有编号还原文字；缺参数默认值、关闭后的返回形态与接口约束。',
    'include_stop_str_in_output': '已有默认 False 与停止串保留行为；缺可复制的请求/响应对照例及各接口入口。',
    'skip_special_tokens': '已有默认 True 与跳过特殊 token；缺关闭后的输出例子和各接口支持边界。',
    'repetition_detection': '已有重复检测判停；缺 min_pattern_size/max_pattern_size/min_count 的结构、阈值及例子。',
    'structured_outputs': '已有约束种类和写法；缺完整嵌套字段表及逐字段默认/互斥校验。',
    'stream_interval': '已有 main 请求级覆盖与服务级最小值；缺请求级非法值校验和实际请求/响应分块例子。',
}

def evidence(e):
    n, o, f = normalized(e['name']), e['owner'], e['file']
    hits = find(n, '环境变量' in e['kind'])
    if e['kind'] == '工具命令行' or '/benchmarks/' in f:
        hits = [h for h in hits if 'inference-performance' in h['page'] and ('bench ' in h['text'] or e['name'].startswith('--') and e['name'] in h['text'])]
    elif o in TOPICS:
        hits = [h for h in hits if h['page'] in TOPICS[o]]
    elif e['kind'] in {'接口请求','接口嵌套结构候选'} or o in {'AnthropicOutputConfig','ChatParams','TokenizeParams','ChatTemplateConfig'}:
        if any(x in f for x in ('/cohere/','/anthropic/','/speech_to_text/','/pooling/','/responses/','/token_in_token_out/','/disagg/')):
            hits = [h for h in hits if o in h['text'] or any(x in h['text'].lower() for x in ('cohere','anthropic','pooling','responses api','token_in_token_out'))]
        else:
            hits = [h for h in hits if h['page'] in {'api-server-entry','token','sampling','streaming-output','request-teardown','structured-output','prefix-caching','vllm-ascend-for-rl'}]
    if n in {'fuse_allreduce_rms','fuse_norm_quant'} and o == 'PassConfig':
        hits = [h for h in hits if 'pass_config' in h['text'] or 'PassConfig' in h['text']]
    if n == 'use_layerwise':
        if 'sfa_pd_rd2h' in f:
            hits = [h for h in hits if 'rd2h' in h['text'].lower()]
        elif e['repo'] == 'vllm':
            hits = [h for h in hits if 'lmcache' in h['text'].lower()]
    # Very common words need a parameter token, not prose or math/code-fence labels.
    if '_' not in n and len(n) < 10:
        pat = re.compile(r'(?:`(?:--)?' + re.escape(n).replace('_','[_-]') + r'`|["\']' + re.escape(n) + r'["\']\s*:|\b' + re.escape(o) + r'\b)', re.I)
        hits = [h for h in hits if pat.search(h['text'])]
    if o == 'SamplingParams' and n in CHINESE:
        page, word, _ = CHINESE[n]
        hits += [{'page':page,'file':PAGES[page]['file'],'line':i,'text':l} for i,l in PAGES[page]['lines'] if word in l]
    if o == 'SamplingParams' and n == 'n':
        page='request-teardown'
        hits += [{'page':page,'file':PAGES[page]['file'],'line':i,'text':l} for i,l in PAGES[page]['lines'] if '几个回答' in l]
    if o in {'ChatCompletionRequest','CompletionRequest','BatchChatCompletionRequest','SamplingParams'}:
        anchors = {'n':('streaming-output','n 大于'), 'stream':('streaming-output','stream: true'),
                   'model':('api-server-entry','请求里的 model'), 'messages':('api-server-entry','对话'),
                   'output_kind':('streaming-output','按「增量」')}
        if n in anchors:
            page,word=anchors[n]
            hits += [{'page':page,'file':PAGES[page]['file'],'line':i,'text':l} for i,l in PAGES[page]['lines'] if word in l]
    return hits

def path_for(e):
    o = e['owner']
    if e['repo'] == 'vllm-ascend' and e['file'].endswith('/ascend_config.py'):
        d=e['definitions'][-1]
        cls=enclosing(e['repo'],d['commit'],e['file'],d['line'])
        if o in {'config','user_config','kwargs','self.config','weight_prefetch_config','finegrained_tp_config','xlite_graph_config'}:
            o=ASCEND_PATH.get(cls, o)
        if e['name']=='prefetch_ratio':o='additional_config.weight_prefetch_config'
    return o + '.' + e['name']

EXCLUDED = {'内部派生','输出协议','模型或量化描述'}

def build():
    overrides=json.loads((OUT/'review-decisions.json').read_text(encoding='utf-8'))
    rows=[]
    seen={}
    for idx,e in enumerate(DATA['entries'],1):
        ident=f'P{idx:04}'
        domain,scope_reason=scope(e)
        hits=evidence(e) if domain not in EXCLUDED else []
        n=normalized(e['name'])
        row={k:e[k] for k in ('repo','kind','file','owner','name')}
        row.update(id=ident,path=path_for(e),domain=domain,scopeReason=scope_reason,definitions=e['definitions'],evidence=hits)
        key='|'.join((e['repo'],e['file'],e['owner'],e['name']))
        decision=overrides.get(key,overrides.get(e['repo']+'|'+e['owner']+'|'+n,overrides.get(e['repo']+'|*|'+n)))
        if domain in EXCLUDED:
            status,reason='不计用户参数缺口',scope_reason
        elif decision:
            status,reason=decision['status'],decision['reason']
            for page in decision.get('pages',[]):
                if not any(h['page']==page for h in hits):
                    matches=[(i,l) for i,l in PAGES[page]['lines'] if n in l or ('默认' in l and len(l)>15)]
                    if matches:
                        i,l=matches[0];hits.append({'page':page,'file':PAGES[page]['file'],'line':i,'text':l})
        elif not hits:
            status='未收录参数说明'
            reason='未找到属于此入口/含义的参数说明；名称变体、正文与源码身份对照后，不把别处同名词当作收录。'
        else:
            status='没讲全'
            if e['owner']=='SamplingParams':
                reason=SAMPLING_GAPS.get(n,CHINESE.get(n,('','','缺该请求字段的默认、约束和逐版入口说明。'))[2])
            elif e['kind'] in {'环境变量注册','环境变量读取'}:
                reason='已有名称或用途；缺此环境入口的完整取值/未设置行为、读取时机及固定版本对照。'
            elif e['kind'] in {'接口请求','接口嵌套结构候选'}:
                reason=f'已有相关说明；未形成 {e["owner"]} 此字段的类型/默认、校验、请求例子和版本对照；不能沿用同名 SamplingParams/其他 API 的默认值。'
            elif e['repo']=='vllm-ascend':
                reason='已有机制或配置示例；缺该路径在 GLM/v0.23/v0.26rc/固定 main 的默认/校验/适用条件对照，配置系统页亦明确 main 子配置未逐项核。'
            else:
                reason=f'已有用途/配置片段；缺 {e["owner"]} 这一入口的完整默认推导、允许值/约束和逐版参考；不能用部署示例值代替默认值。'
        row.update(status=status,reason=reason,decisionBasis=(
            '源码角色排除' if domain in EXCLUDED else '显式内容核读' if decision or e['owner']=='SamplingParams' and hits
            else '未定位到同身份说明' if not hits else '按完整参数参考标准保守判定'))
        # Only proven duplicate evidence is merged: same source locations or env name.
        if '环境变量' in e['kind']:
            duplicate_key=(e['repo'],'env',e['name'])
        else:
            duplicate_key=(e['repo'],e['file'],e['name'],tuple(sorted((d['commit'],d['line']) for d in e['definitions'])))
        if duplicate_key in seen:
            row['duplicateOf']=seen[duplicate_key]
        else:seen[duplicate_key]=ident
        rows.append(row)
    assert len(rows)==len(DATA['entries'])==4640
    assert len({r['id'] for r in rows})==4640
    assert all(r['reason'] and r['status'] for r in rows)
    # Exact spelling is essential for MAX_JOBS versus scheduler max_jobs.
    assert not any('MAX_JOBS' not in h['text'] for h in find('MAX_JOBS',True))
    assert next(r for r in rows if r['owner']=='SamplingParams' and r['name']=='presence_penalty')['status']=='没讲全'
    assert next(r for r in rows if r['owner']=='SamplingParams' and r['name']=='skip_clone')['domain']=='内部派生'
    assert next(r for r in rows if r['owner']=='PassConfig' and r['name']=='fuse_allreduce_rms')['status']=='未收录参数说明'
    dump('review-ledger.json',{'snapshots':DATA['snapshots'],'pages':[{k:p[k] for k in ('id','file','sha256')} for p in PAGES.values()],'entries':rows})
    for status,filename in [('未收录参数说明','review-missing.md'),('没讲全','review-incomplete.md'),('参考要素基本齐备','review-covered.md'),('不计用户参数缺口','review-excluded.md')]:
        subset=[r for r in rows if r['status']==status and not r.get('duplicateOf')]
        lines=[f'# {status}', '', '固定快照范围内逐定义入口审查。身份数不等于不同参数数；同名不同 API 保留，已证明同源重复见 review-ledger.json。缺口表示知识库参数参考缺口，不代表功能不存在。', '', '| ID | 项目 / 范围 | 定义身份 | 存在版本 | 判定依据 / 缺什么 | 已有正文 | 定义证据 |','|---|---|---|---|---|---|---|']
        def esc(x):return str(x).replace('|','\\|').replace('\n',' ').replace('\r',' ')
        for r in subset:
            d=r['definitions'][-1]
            url=f'https://github.com/vllm-project/{r["repo"]}/blob/{d["commit"]}/{r["file"]}#L{d["line"]}'
            ev=[]
            for h in r['evidence']:
                if not any(h['page'] in x for x in ev):ev.append(f'[{h["page"]}:{h["line"]}](../../../{h["file"]}#L{h["line"]})')
                if len(ev)==3:break
            cells=[r['id'],r['repo']+' / '+r['domain'],'`'+r['path']+'`',', '.join(dict.fromkeys(d['version'] for d in r['definitions'])),r['reason'],'; '.join(ev) or '无同义参数正文 / 排除项',f'[{r["file"]}:{d["line"]}]({url})']
            lines.append('| '+' | '.join(esc(c) for c in cells)+' |')
        (OUT/filename).write_text('\n'.join(lines)+'\n',encoding='utf-8')
    summary=collections.Counter(r['status'] if not r.get('duplicateOf') else '同源重复' for r in rows)
    dump('review-counts.json',{'counts':summary,'byDomain':{domain:dict(collections.Counter(r['status'] for r in rows if r['domain']==domain and not r.get('duplicateOf'))) for domain in sorted({r['domain'] for r in rows})}})
    dynamic=[]
    for i,d in enumerate(DATA['dynamicCli'],1):
        expr=d['expression']
        if 'super().add_argument' in expr:
            status,reason='不计新增参数','解析器转发包装：登记 deprecated 并转给 argparse；参数来自调用处。'
        elif '*extra_flags' in expr:
            status,reason='对应已盘点字段','get_kwargs(cls) 获取 Frontend 字段，以 key 下划线转连字符生成长选项；额外短标记是别名。'
        elif "'model_tag'" in expr:
            status,reason='没讲全','模型位置参数；已有模型启动示例，缺与 config/model 选项优先级的专门说明。'
        else:
            assert "'EXPERIMENT_DIR'" in expr
            status,reason='未收录工具说明','基准结果绘图工具的输入目录位置参数，与推理请求参数分开。'
        dynamic.append({**d,'id':f'D{i:02}','status':status,'reason':reason})
    dump('review-dynamic-cli.json',dynamic)
    lines=['# 动态命令行线索逐条结论','','| ID | 版本 | 定义 | 结论 | 理由 |','|---|---|---|---|---|']
    for d in dynamic:
        commit=next(s['commit'] for s in DATA['snapshots'] if s['repo']==d['repo'] and s['version']==d['version'])
        url=f'https://github.com/vllm-project/{d["repo"]}/blob/{commit}/{d["file"]}#L{d["line"]}'
        lines.append(f'| {d["id"]} | {d["version"]} | [{d["file"]}:{d["line"]}]({url}) | {d["status"]} | {d["reason"]} |')
    (OUT/'review-dynamic-cli.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    assert len(dynamic)==18
    print(json.dumps(summary,ensure_ascii=False))

if __name__=='__main__':build()
