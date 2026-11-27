---
id: npu-worker-lifecycle
title: NPUWorker 启动：一张卡按什么顺序准备好接请求
type: feature
legacyAnchors:
  ①-构造函数-__init__进程内打补丁注算子与卡型门禁: 拆解 v0.30.0 冷启动六步、权重分形转换与 7 类预热
  ②-init_device逻辑卡号偏移建组前快照与-npumodelrunner: 拆解 v0.30.0 冷启动六步、权重分形转换与 7 类预热
  ③-load_model分片读盘nd--nz-分形后处理与读取量算账: ③ 权重分形后处理与读取量算账
  ④-determine_available_memory-与-enginecore-全局最小块对齐: 拆解 v0.30.0 冷启动六步、权重分形转换与 7 类预热
  ⑤-initialize_from_config一次切出物理缓存池清零元数据置池外: 拆解 v0.30.0 冷启动六步、权重分形转换与 7 类预热
  ⑥-compile_or_warm_up_model7-类预热机制与-aclgraph-录图收尾: ⑥ 7 类预热机制与 ACLGraph 录图收尾
  硬件变体与跨架构边界npuworker310-与双机全案对照: 冷启动步骤在不同硬件与混合状态模型中怎样变化
origin: gap
summary: >-
  每张可见 NPU 对应一个 NPUWorker（310P 为 NPUWorker310）。冷启动按严格依赖依次完成打补丁与算子注册、绑卡拍快照与建
  HCCL 通信组、解析架构并加载分形权重、试跑量测 KV 预算、按 EngineCore 全局最小块数建缓存池，最后跑完 7 类预热机制并捕获
  ACLGraph 图池。
aliases:
  - NPUWorker
  - WorkerBase
  - Worker 生命周期
  - worker 启动
  - 启动时序
  - Worker 启动顺序
  - init_device
  - load_model
  - initialize_from_config
  - compile_or_warm_up_model
  - 六步启动
  - load_format
  - load-format
  - '--load-format'
  - 权重加载格式
  - safetensors_load_strategy
  - '--safetensors-load-strategy'
  - trust_remote_code
  - '--trust-remote-code'
  - 模型解析
  - hf_overrides
  - model_impl
  - tokenizer_revision
  - code_revision
chapters:
  - '05'
order: 110
sources:
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L123-L200'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L391-L521'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L567-L665'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L854-L992'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L1185-L1229'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L1283-L1305'
  - 'vllm-ascend@c09d3e20:vllm_ascend/_310p/worker_310p.py#L34-L208'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L4372-L4565'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L6607-L6622'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_executor/warmup/kernel_warmup.py#L1-L53'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_executor/warmup/early_kernel_warmup.py#L1-L139'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_executor/warmup/nz_warmup.py#L1-L83'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L263-L273'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L565-L657'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L369-L434'
  - 'vllm@ced6857a:vllm/v1/executor/multiproc_executor.py#L662-L686'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L254-L384'
  - 'vllm@ced6857a:vllm/v1/executor/abstract.py#L120-L135'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_utils.py#L2722-L2774'
  - 'vllm@ced6857a:vllm/v1/worker/gpu_model_runner.py#L5410-L5422'
  - 'vllm@ced6857a:vllm/v1/worker/gpu_model_runner.py#L6925-L6935'
  - 'vllm@ced6857a:vllm/config/load.py#L26-L96'
  - 'vllm@ced6857a:vllm/config/model.py#L142-L368'
  - 'vllm@ced6857a:vllm/config/model.py#L553-L641'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/__init__.py#L33-L66'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/default_loader.py#L110-L230'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/weight_utils.py#L866-L1000'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/utils.py#L146-L164'
  - 'vllm@ced6857a:vllm/transformers_utils/config.py#L757-L886'
  - 'vllm@ced6857a:vllm/model_executor/models/registry.py#L1217-L1423'
  - 'vllm@ced6857a:vllm/tokenizers/registry.py#L203-L321'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/Qwen3-Dense.md#L230-L355'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/Qwen3-30B-A3B.md#L235-L285'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/configuration/additional_config.md#L40-L112'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/sleep_mode.md#L1-L36'
  - 'vllm@ced6857a:docs/configuration/model_resolution.md#L1-L23'
  - 'vllm@ced6857a:docs/design/huggingface_integration.md#L1-L31'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L90-L920'
  - 'vllm-ascend@2c59ff10:vllm_ascend/patch/worker/patch_weight_utils.py#L36-L74'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L99-L1015'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/model_executor/warmup/kernel_warmup.py#L36-L49'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L145-L1300'
  - 'vllm-ascend@8d6180e2:vllm_ascend/model_executor/warmup/kernel_warmup.py#L184-L236'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L156-L162'
  - 'vllm@ba15685a:vllm/model_executor/model_loader/__init__.py#L33-L66'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_process_weights_after_loading.py#L18-L64
  - >-
    raw:sha256-2591dc384678a937fe68a029644482014f40962be3f0c3e3f16bc30685fc3704.md#L1-L1135
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L705-L873
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L1452-L1462
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L322-L353'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: hardware-devices
    kind: builds-on
    note: 先明确物理板卡、A3 双裸片与软件可见 NPU 的对应关系，才能看懂单卡 Worker 绑卡与 SoC 校验
  - to: cann-hccl
    kind: builds-on
    note: 第②步建立 TP/PP/DP/EP 通信域依赖 HCCL 与底层 CANN 运行时
  - to: engine-processes
    kind: builds-on
    note: Worker 是否作为独立子进程派生、每个 EngineCore 管几个 Worker，由执行器决定
  - to: platform-plugin-registration
    kind: builds-on
    note: Worker 子进程初始化先加载通用插件注册模型与加载器，再进入设备准备
  - to: npu-platform
    kind: builds-on
    note: NPUPlatform 按硬件画像选出 NPUWorker 或 NPUWorker310 并提前就地改写块长与图配置
  - to: ascend-patch-system
    kind: builds-on
    note: 第①步构造函数在当前进程内打 worker 层补丁，生效范围受进程边界约束
  - to: ascend-config-system
    kind: builds-on
    note: 第①步在 Worker 进程内独立初始化 AscendConfig 缓存，后续加载与预热直接消费它
  - to: vllm-platform-interface
    kind: builds-on
    note: 上游执行器通过平台契约查询 worker_cls，才定位到昇腾侧的 NPUWorker 或 NPUWorker310
  - to: kv-cache-spec
    kind: builds-on
    note: 第④步上报状态规格、第⑤步分配物理缓存张量时，每层每页的字节与形状由规格决定
contradicts: []
updated: '2026-11-23'
rawSources:
  - >-
    raw/sha256-2591dc384678a937fe68a029644482014f40962be3f0c3e3f16bc30685fc3704.md
  - >-
    raw/sha256-ce73fe4f9a70a8b33634bccdddc0b84b99c25b5c54958d90f8c18d317dea45da.md
  - >-
    raw/sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md
---

配好容器并敲下 `vllm serve`（详见[容器镜像、核心环境变量与 vllm serve](ascend-env-and-serve.md)）后，平台类 [NPUPlatform](npu-platform.md) 会为每张软件可见的昇腾 NPU 指定专属执行角色 **`NPUWorker`**（`Atlas 300I DUO / 200I Pro` 切换为子类 `NPUWorker310`）。在终端刷出 `Application startup complete.` 正式接纳请求之前，每张卡上的 Worker 都必须按严格顺序走完冷启动六步。本文以 `vLLM Ascend v0.30.0`（配套上游 `vLLM v0.30.0`）及标准标尺 `Qwen3-8B`、`Qwen3-30B-A3B` 为主线，拆清这条单向依赖链、模型与权重加载后处理以及全部 7 类预热机制。

## 一张卡上的 Worker，启动时按什么顺序做准备？

先把贯穿冷启动的四个基础角色说清楚：

- **KV cache**：保存请求历史键值状态以免逐词重算的显存空间（见 [KV cache](kv-cache.md)）。
- **通信组**：约定哪几张卡通过昇腾集合通信库 **HCCL** 协同收发张量（见[通信基础](collective-communication.md)与 [CANN 与 HCCL](cann-hccl.md)）。
- **录图（ACL Graph）**：把单步前向的设备算子序列预先捕获下来，运行期按固定档位直接回放，省去逐算子下发开销（见[图执行](graph-mode-layer.md)与 [ACL Graph](acl-graph.md)）。
- **EngineCore**：负责统一调度请求、裁定并管理 KV 块编号的引擎核心进程。

每张 NPU 上的 `NPUWorker` 都沿着同一条六步流水线就位：先换补丁注算子、选卡拍快照并建通信组、装入本卡权重并做分形转换，再试跑量出可用 KV 预算。等 `EngineCore` 收齐各卡数字、统一块数并发回配置后，每张卡再一次切出物理缓存池，最后完成算子预热与 decode 图捕获：

```wiki-diagram
file: worker-lifecycle
```

图上半由多进程执行器的 `WorkerProc` 本地顺次驱动 ①–③，下半由 `EngineCore` 跨卡广播驱动 ④–⑥，底部单列 310P 硬件变体的五处定制。冷启动期间，所有卡在两道跨卡栅栏处必须步调一致（试跑与录图内部的集合通信同样需要同组成员配合）：

- **栅栏 1（第②步 HCCL 通信组握手）**：HCCL 通信域必须等组内全部成员到齐才能建组。只要有一张卡挂死或慢起，同组其余卡就会停在这一步等待。
- **栅栏 2（第④步与第⑤步之间 `EngineCore` 汇总对齐）**：单个 Worker 只回报本卡还能分出多少字节给 KV cache。`EngineCore` 收齐全部上报值后，在自动推算 `max_model_len` 与单条容量校验阶段先为永久空块留出 1 块余量，但物理 KV 配置仍按整份预算切出并取全局最小 `min(num_blocks)`、通知富余卡收缩规格；各卡在第⑤步切好池子、建出 `BlockPool` 后，再从空闲队列弹出永久 `null_block` #0。同一 **tensor parallel（TP，多卡切分同一层矩阵协同计算）** 组内布局一致；在 **pipeline parallel（PP，按层段纵切模型分阶段接力）** 下，不同阶段层数或结构不同时，各卡收到的缓存配置允许不同。

Worker 本身是一个逻辑执行角色，它是否独占一个操作系统进程由执行器决定；多进程执行器（`mp`）下每个 Worker 对应一个独立子进程（见 [executor 决定 Worker 是不是独立进程](engine-processes.md#executor-决定-worker-是不是独立进程)）。六步全部走完后，线上每一步调度指令如何从 `EngineCore` 广播到各个 Worker 再转交 [ModelRunner](npu-model-runner.md)，详见[请求调用链](request-call-chain.md)。

## 为什么顺序一步都不能换？冷启动耗时花在哪？

vLLM V1 的物理 KV 缓存池容量在启动期一次定死，运行期不会动态扩容。必须先装好驻留权重、跑完最大批试跑扣清峰值，才能切准池子，最后再用预算外余量录图。下图左侧列出每步交付给下一步的刚性产物，右侧用比例甘特时间轴对照默认串行、开启加载期早预热重叠与 `RFork` 热启动三套路径的墙钟压缩：

```wiki-diagram
file: worker-life-fig-dependency-chain
```

把顺序任意对调都会立刻撞上缺失前置产物的硬障碍：

| 假设对调的顺序 | 为什么在代码里走不通 |
| --- | --- |
| **先建 `ModelRunner`，再选卡（`init_device`）** | `NPUModelRunner` 初始化时就要绑定具体 `self.device` 并查询设备能力，选卡之前设备句柄根本不存在 |
| **先装权重，再执行 `__init__` 换补丁注算子** | 模型构造依赖已注册的昇腾自定义算子与 `AscendConfig`；历史版本中自定义注意力后处理入口也由 worker 补丁注入（详见[进程与补丁](engine-processes.md#补丁和配置为什么要每个进程各做一遍)） |
| **先建物理缓存池，再跑 `determine_available_memory`** | 缓存池切多少块，直接取决于第③步权重实测占用与第④步 `profile_run()` 峰值扣减后的剩余字节数 |
| **先调 `capture_model` 录图，再装权重或建缓存池** | 录图必须真实跑通 decode 前向——没权重无法计算，没物理缓存池无处读写 KV；且图池显存落在第④步预算之外，只能等第⑤步切完 KV 块再录 |

冷启动之所以要等几十秒到数分钟，是因为它把运行期原本会拖慢首字或首步的重活全部前置了。第③步既要读盘加载 `safetensors` 权重，又要在需要时把矩阵重排成昇腾矩阵核偏好的分块存储布局 **`FRACTAL_NZ`**（源码注释提及单进程首次触发 `npu_format_cast` 约有 15～19 秒惰性初始化，`Ascend 910B3` 微基准实测首次转换 `7.1618 s`、二次仅 `0.0007 s`）；随后第④步要用假数据真跑一次最大批前向兼做首次编译，第⑥步还要跑完预热并按分桶逐档捕获执行图。

只要单步批量上限、图模式、并行切分或量化方案改动了任意一项，这套预算和执行图就必须重新走一遍。本页聚焦这条先后链本身：第④步逐项扣减公式见 [KV cache 显存预算](kv-cache-memory-profiling.md)，运行期从池中借块还块见 [KV 块分配](vllm-kv-block-allocation.md)，插件整体分层见 [vllm-ascend 如何接入 vLLM](vllm-ascend-overview.md)。

## 装权重之前，怎样知道要构造哪一种模型？

模型目录里同时躺着结构说明（`config.json`）、数值权重（`*.safetensors`）和分词规则（`tokenizer.json` 等），三者各司其职且必须严丝合缝。解析配置可能发生在创建 Worker 之前；而 Worker 在第③步构造本卡网络层并灌入权重时，依赖前序已经敲定的配置类与模型执行类（分词器则留在文本入口进程把字符串切成整数编号，并非每张 NPU 各自加载一份）：

```wiki-diagram
file: model-resolution-flow
```

对照上图，「把模型跑起来」背后其实是四个彼此独立的选择，不能看到“找到配置文件”就以为后三项已经就绪：

| 选择维度 | 判定依据与配置入口 | 选定这一项后仍需满足什么条件 |
| --- | --- | --- |
| **1. 配置类** | 依据 `config.json` 中的 `model_type` 查登记类或 Hugging Face `AutoConfig`（本地目录直读；仓库 ID 按 `revision` 先查缓存再访 Hub） | 仅拿到层数、隐藏维与头数等结构描述，尚未实例化网络层或读取权重 |
| **2. 执行实现类** | 依据 `architectures` 查运行时 `ModelRegistry`（受 `--model-impl` 的 `auto` / `vllm` / `transformers` 与昇腾插件注册表共同决定） | 目标类能成功导入，且算子与特性支持当前昇腾卡型与并行配置 |
| **3. 权重读取路径** | 默认加载器按模型来源、`revision` 与 `--load-format` 筛选权重分片文件，再按 `--safetensors-load-strategy` 决定读盘策略 | 文件内张量名称、形状、量化精度与执行类的参数加载器一一匹配，随后完成布局后处理 |
| **4. 分词器（tokenizer）** | 独立的 `--tokenizer`、`--tokenizer-revision` 与 `--tokenizer-mode`（未显式指定时默认跟随模型来源与 `revision`） | 切出的 token 整数编号、特殊符号与聊天模板必须同训练词向量表的行号约定完全一致 |

实际排查模型解析问题时，要守住三条硬边界：

- **覆盖架构声明不会自动转换权重形状**：当非官方仓库缺少 `architectures` 字段且按 `model_type` 也补全不出类名，或存在架构名歧义时，可通过 `--hf-overrides` 显式指定等价实现（如官方示例对 GPT-2 同构的 `Cerebras-GPT` 传入 `{"architectures": ["GPT2LMHeadModel"]}`）。但该覆盖只告诉框架“实例化哪份代码”，绝不会把不兼容的权重张量重排成另一套网络结构；而覆盖 `model_type` 更会直接改变第一步读取配置时选用的配置类。
- **单独更换 tokenizer 不会重排词向量表**：用示意数字看，若模型训练时把“猫”放在编号 `7`（对应词向量矩阵第 `7` 行），而你换用另一个把“猫”编成 `12` 的分词器，即使词表总行数相同，模型查到的也是第 `12` 行错位向量（查表机制见 [token 与词向量](token.md)）。
- **`auto` 后端回退有严格门槛**：`--model-impl auto` 优先命中已登记的原生模型类（含 `vllm-ascend` 注册的昇腾专属实现）；仅当原架构名未登记且通过后端兼容检查（`is_backend_compatible` 等）时，才会尝试回退到由 vLLM 统一调度的 `Transformers` 后端实现。若已选中的原生实现因张量名失配或设备算子缺失报错，`auto` 不会自动换后端兜底修复。

## 拆解 v0.30.0 冷启动六步、权重分形转换与 7 类预热

在 `v0.30.0` 多进程执行器（`mp`）调用链中，①–③ 由 `WorkerProc` 在子进程拉起时顺次执行，④–⑥ 由 `EngineCore._initialize_kv_caches` 跨进程广播驱动（单卡 `uni` 执行器则在 `EngineCore` 同进程内按同一六步先后直接调用）。先用一张启动日志里程碑表对准六个阶段，再展开第③步权重分形与第⑥步 7 类预热：

| 冷启动阶段 | 驱动方与核心方法 | 核心动作与硬门禁 | 关键启动日志（排查定位） |
| --- | --- | --- | --- |
| **① 构造与补丁** | `WorkerProc` → `__init__` | 在 `super().__init__()` 前完成 `adapt_patch()`、`register_dummy_fusion_op()`、A2/A3 专属 `ATB_EXTENSIONS`（**ATB** 即 Ascend Transformer Boost，昇腾大模型算子加速库）、`register_ascend_customop` 与 `init_ascend_config`；`check_ascend_device_type()` 核对编译目标与 `get_soc_version()`（**SoC** 芯片型号代号），错包当场抛 `RuntimeError` | `COMPILE_CUSTOM_KERNELS` 为假时打编译告警 |
| **② 绑卡与建组** | `WorkerProc` → `init_device` | 按本机 DP 序号偏移 `local_rank` 并执行 `torch.npu.set_device(device)`，随后先执行 `gc.collect()` 与 `torch.npu.empty_cache()` 清空缓存，再在**建组前**拍 `MemorySnapshot` 校验空闲显存 $\ge M_{\text{total}} \times u$（`v0.30.0` 默认 $u=0.92$）；用 `"hccl"` 建 TP/PP/DP/EP/MC2 通信域后注 `register_ascend_fla_customop()`、建工作区并按 `use_v2_model_runner` 创建 `NPUModelRunner` / `V2` | 空闲不足直接抛 `ValueError` |
| **③ 读盘与分形** | `WorkerProc` → `load_model` | 主模型与可选草稿全程包在 `DeviceMemoryProfiler` 内：开空参 → 扫 `safetensors` 截本卡切片 → `process_weights_after_loading` 做 `ND→NZ`（从常规多维布局转为贴合矩阵核块读写的 `FRACTAL_NZ` 分形布局）与延迟注意力初始化 → 记 `model_memory_usage`；开睡眠模式时包进 `CaMemAllocator(tag="weights")`（支持睡眠挂起/释放的显存分配器，单进程限单实例）；配 RL 在线更新时另建 `WeightTransferEngine` | `Checkpoint size:`；**MRV1**（第一代模型执行器 `Model Runner V1`）打 `Loading model weights took ... GB` + `Model runner load_model total time: ... seconds`（**MRV2** 第二代执行器打 `... GiB memory and ... seconds`） |
| **④ 试跑与对齐** | `EngineCore` → `determine_available_memory` | 广播 `get_kv_cache_spec` 后执行最大批 `profile_run()`，在**图捕获前**截 Torch 峰值（手传 `--kv-cache-memory` 仍照跑以完成首次图外编译）；`EngineCore` 校验单条 `max_model_len` 时留出 1 块空块余量（改写则广播 `update_max_model_len`），物理配置仍按整预算取 `min(num_blocks)` 并收缩富余卡（建 `BlockPool` 后再弹出 `null_block` #0） | `Available KV cache memory: ... GiB` |
| **⑤ 切物理池** | `EngineCore` → `initialize_from_config` | 仅当本进程存在草稿投机实例（`self.speculator is not None`）、`speculative.method == "dspark"` 且搭配相应 **SFA DSpark**（稀疏注意力搭配多词投机草稿）KV 传输（`uses_sfa_dspark_kv_transfer`）或逐层复用（`get_layerwise_reuse_config`）时，才在 `ensure_kv_transfer_initialized` 初始化连接器之前登记 `dspark_draft_layer_names`；随后初始化 KV 连接器并一次切出物理 KV 张量池；睡眠池 `tag="kv_cache"` 仅包缓存本体，块回收清零元数据 `_init_kv_zero_meta`（MRV2 或 `MRV1+Mamba+Eagle3` 多步草稿启用）专门留池外防唤醒丢失 | 块池尚未绑定请求，运行期按需借还 |
| **⑥ 预热与录图** | `EngineCore` → `compile_or_warm_up_model` | 跑完 7 类预热与分桶 `capture_model()`（吃 $1-u$ 预算外余量），打印 `Actual usage:` 四项账单与扣 `150 MiB` 裕度的 `--kv-cache-memory` 建议值，最后执行 ATB 预热、`bind_cpus` 绑核与重置随机种子 | `Graph capturing finished`、`Actual usage:`、`init engine ... took` |

> **边界与例外（建组前快照与 CPU 控制组）**：第②步把快照拍在建组之前，HCCL 通信域预留缓冲才会如实计入第④步「非 Torch 增量」；`EngineCore` 之间同步剩余请求状态的 CPU 控制组由引擎侧单建，不在这一步创建（见 [Data Parallel](data-parallel.md)）。第④步跨卡对齐遵循全局最小公式，富余卡按 $N_{\text{blocks}} \times B_{\text{page}}$ 同步收缩：
>
> $$N_{\text{blocks}} = \min_{r}\,\bigl\lfloor M_{\text{KV}}^{(r)} / B_{\text{page}} \bigr\rfloor$$

### ③ 权重分形后处理与读取量算账

后处理核心是通过 `maybe_trans_nz`（底层调 `torch_npu.npu_format_cast(..., ACL_FORMAT_FRACTAL_NZ)`）把多维 `ND` 权重转为贴合矩阵核块访存的 **`FRACTAL_NZ`** 布局（见[张量存储布局](tensor-layout.md)）。`v0.30.0` 通过 `--additional-config` 的 `weight_nz_mode` 控制范围：默认 `1` 仅转 `INT8` 等量化权重；设 `0` 关闭（配 `rl_config` 时强制置 `0`）；设 `2` 连 `BF16/FP16` 浮点权重一并转 `NZ`（如 `Qwen3-30B-A3B` 食谱显式传 `{"weight_nz_mode": 2}`）。

默认关闭专家文件过滤（`enable_ep_weight_filter=False`）时，每张卡都会顺序遍历分片文件并丢弃非本卡专家；挂载草稿模型（`drafter`）时会把关联权重再遍历一遍。设主模型整包文件量为 $S_{\text{ckpt}}$、遍历遍数 $k \in \{1, 2\}$，单 Worker 前台逻辑遍历的文件字节量为：

$$V_{\text{scan}} = k \times S_{\text{ckpt}}$$

注意要区分**逻辑文件遍历量、操作系统页缓存命中与底层物理磁盘读量**：同机多卡加载同一份 `safetensors` 或开启 `prefetch` 预读时，首个读过的块留在宿主机页缓存（Page Cache）中，后续遍历直接从主机内存命中，不必对存储介质发起等倍数的物理 I/O（宿主机页缓存、大页与内存水位关系见[宿主机内存底座与静态大页](host-memory-and-hugepages.md)）。

以单卡 `Atlas A2/A3` 的 **`Qwen3-8B`（`BF16`）** 与四卡 **`Qwen3-30B-A3B`（`TP4 + EP`、`ModelSlim W8A8`）** 作 `v0.30.0` 标准标尺（静态估算示意，真机以 `Loading model weights took` 日志为准；改用热启动 [RFork](rfork.md) / [RFork 启动](rfork-startup.md) 可借用驻留显存跳过常规整包权重读盘，但 processed 布局模型如 W8A8 在请求租约前仍需在本地对空参数完成 `NZ` 等布局后处理）：

| 标准标尺部署 | 模型参数与切分方式 | 整包文件量 $S_{\text{ckpt}}$（示意） | 单卡驻留 $M_{\text{weights}}$（示意） | 读盘与后处理关键特征 |
| --- | --- | --- | --- | --- |
| **`Qwen3-8B` 单卡（`BF16`）** | `8.2B` 总参，`TP1` 整份驻留 | 约 `15.3 GiB` | 约 `15.3 GiB` | 默认 `weight_nz_mode=1` 下 `BF16` 保持 `ND`；显式设 `2` 才触发 `FRACTAL_NZ` 重排峰值 |
| **`Qwen3-30B-A3B` 四卡（`W8A8`）** | `30.5B` 总参（`128` 路由专家），`TP4 + EP4`（每卡 `32` 专家） | 约 `30.0 GiB` | 约 `7.8 GiB` / 卡 | 每卡仅留约 `1/4` 分片，默认各扫整包（叠 EAGLE3 草稿另读草稿包）；`W8A8` 默认转 `NZ` 且缩放系数存 `FP32` |

### ⑥ 7 类预热机制与 `ACLGraph` 录图收尾

物理 KV 池在设备显存分配完成后，引擎进入最后的预热与图捕获阶段（底层算子异步下发队列与 NPU 分配器设置见[昇腾算子下发流水与运行时调优](ascend-runtime-and-tuning.md)）。算上第③步加载期可选开启的后台重叠线程，`v0.30.0` 在冷启动链路上共部署了 **7 类预热机制**，专门消灭首次算子编译、格式转换惰性初始化与首请求指令毛刺：

| 预热类别 | 触发位置与控制开关 | 预热内容与硬件门禁 |
| --- | --- | --- |
| **1. 早期 NZ 分形转换预热** | 第③步 `load_model` 开头；`enable_early_nz_warmup`（默认 `False`） | 后台线程对 `256×256` `int8` 临时张量调一次 `maybe_trans_nz`，让首次 `npu_format_cast` 约 15～19 秒惰性初始化与读盘重叠，加载返回前 `join` |
| **2. 编译区间尺寸假前向** | 第⑥步开头；读取 `compile_sizes` 与 `compile_ranges` | 非 `enforce_eager` 下剔除 `cudagraph_capture_sizes` 已覆盖尺寸、补齐编译区间右端点，从大到小执行 `_dummy_run(size)`；`enforce_eager` 下仅跑显式 `compile_sizes`（空则跳过） |
| **3. Triton 拒绝采样预热** | 第⑥步 `kernel_warmup`（开 `enable_early_kernel_warmup` 时提前至第③步后台线程） | `HAS_TRITON` 为真时预编译 `rejection_sampler_triton_warmup`（`310P` 无 Triton 直接跳过整组 4 项） |
| **4. Triton 采样惩罚项预热** | 第⑥步 `kernel_warmup`（支持第③步早期线程重叠） | `HAS_TRITON` 为真时预编译 `penalties_triton_warmup`，避免带词频惩罚的首条请求卡顿 |
| **5. Triton RMSNorm 预热** | 第⑥步 `kernel_warmup`（支持第③步早期线程重叠） | `HAS_TRITON` 为真时预编译 `triton_rms_warmup` 归一化算子 |
| **6. Triton Indexer 预热** | 第⑥步 `kernel_warmup`（紧接前 3 项之后） | `HAS_TRITON` 为真时预编译稀疏注意力索引器 `indexer_triton_warmup` |
| **7. ATB 矩阵乘收尾预热** | 第⑥步录图之后；硬件具备 `ATB_WARMUP` 能力时自动执行 | 跑一次极小尺寸 `torch_npu._npu_matmul_add_fp32`，防止首条真实请求写缓存（`ReshapeAndCache`）出现时延退化；`950 (A5)` 与 `NPUWorker310` 跳过 |

跑完前 6 类预热且未设 `enforce_eager` 时，Worker 调用 `model_runner.capture_model()` 逐档捕获执行图。录图显存全部来自 $1 - u$ 预算外余量；完成后按序做完实测账单与 `150 MiB` 建议值打印、第 7 类 `_warm_up_atb()`、CPU 亲和绑核（`enable_cpu_binding` 默认 `True`，开启 `engram_config.cpu_offload` 时关闭跨 NUMA 页迁移，见 [CPU 绑核](cpu-binding.md)）及重置随机种子，引擎随即就绪。

### Ascend 910B3 冷启动微基准与阶段耗时底盘

在单卡与八卡 `Ascend 910B3`（`v0.30.0`，完整环境见 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)）上，冷启动各子环节的微基准与完整服务日志把耗时账单拆解到了秒级：

| 测量项（`Ascend 910B3` · `v0.30.0`） | 实测耗时 | 物理机制与调优边界 |
| --- | ---: | --- |
| **8 进程并发 Python 栈导入（无 `.pyc` → 预编译 `.pyc`）** | `24.311 s` → **`12.598 s`** | 预先执行字节码编译省去 **`11.713 s`** 多进程并发源码解析开销 |
| **`torch.npu.set_device` + 首次 vs 二次 `npu_format_cast(NZ)`** | `1.9103 s` + **`7.1618 s`** vs **`0.0007 s`** | 首次 `FRACTAL_NZ` 格式转换承担一次性算子惰性初始化，后续调用仅 `0.7 ms` |
| **第④步 `Memory profiling`（`Qwen3-8B` `TP=4`）** | 约 **`56 s`**（`55.59 ~ 56.60 s`） | `TP=1..8` 跨度 `49.13 ~ 61.60 s`，含最大批假输入前向与首次图外准备 |
| **编译阶段 `torch.compile`（`Qwen3-8B` `TP=4`）** | 约 **`43 s`**（`42.48 ~ 43.13 s`） | `DEBUG` 与 `INFO` 虽共用缓存根目录但生成不同 AOT key，两轮均未跳过约 `43 s` 编译 |
| **第⑥步 `ACLGraph` 捕获（`Qwen3-8B` `TP=4`）** | **`35 ~ 40 s`**（`INFO` `35 s` / `DEBUG` `40 s`） | `TP=1..8` `INFO` 跨度 `22 ~ 36 s`；`EngineCore` 汇总 `init engine` 耗时 `102.43 ~ 115.24 s` |

阅读这份账单时还要避开一个预热开关误区。先看预热本身做什么：`enable_early_nz_warmup`（默认 `False`）会在后台守护线程里构造一块 `256 × 256` 的 **`int8`** 临时张量，调用 `maybe_trans_nz` 并同步（`torch.npu.synchronize()`），用来提前完成首次 `npu_format_cast` 的惰性初始化。再对照 `BF16` 模型的默认布局条件：普通 `BF16` 模型（如 `Qwen3-8B`）在默认 `weight_nz_mode = 1` 下权重保持 `ND`、根本不转 `NZ`；此时打开 `enable_early_nz_warmup` 只会让后台线程白跑一次无后续收益的 `int8` 初始化（虽与读盘重叠，关键路径仍可能承担未重叠尾部及资源争用），它只适合 W8A8 量化或显式设 `weight_nz_mode = 2` 等真正触发 `NZ` 重排的场景。从代码接入代际看，`v0.30.0` 将该线程挂在 **V1 runner**（`model_runner_v1.py` 启动与返回前 `join`），而 `main` 将其迁入 **V2 runner**（`worker/v2/model_runner.py` 并在 `finally` 中兜底 `join`）。

## 冷启动步骤在不同硬件与混合状态模型中怎样变化

不同硬件族与跨机混合状态模型不改变六步依赖链，只在特定阶段替换内部行为。先看 `Atlas 300I DUO / 200I Pro` 对应的子类 **`NPUWorker310`** 五处硬件定制：

| 受影响步骤 | `NPUWorker310` 专属定制 | 对使用者的直接约束 |
| --- | --- | --- |
| **② 选卡与 Runner** | Root Complex（RC）共享内存模式改用 `psutil.virtual_memory().available` 测可用内存；设 `jit_compile=False` 并创建 `NPUModelRunner310` / `V2` | 与 A2/A3 的纯设备内存查询路径不同 |
| **③ 权重与精度** | 硬件档案设为 `FORCE_NZ`，强制将二维及以上支持矩阵转 `FRACTAL_NZ` | 不支持 `BF16`，浮点须显式传 `--dtype float16` |
| **④ 显存折半** | 扣减后的可用 KV 显存直接整除 `2`（`// 2`），打印 `(halved for workspace)`；可复用同构 Mamba 槽位免除额外缩放 | 给运行期算子工作区留出一半余量，可用块数减半 |
| **⑥ 预热与图限制** | 无 Triton 且不支持 `npugraph_ex`；`kernel_warmup` 直接返回 | 须关闭 `enable_npugraph_ex` |
| **⑥ ATB 预热** | `_warm_up_atb` 覆写为空操作并打跳过提示 | 跳过收尾矩阵乘预热 |

再看跨两台机器、同时包含混合注意力与 MTP 草稿头的专家并行模型。以历史双机全案（例外 B，[GLM-5.3-Flash 双机部署](glm-5-3-flash-two-node.md)，`2×A2×8`、`TP8/DP2/EP16`、`W8A8`、共 `20` 核心角色进程与 `16` 个 Worker，完整启动命令与时序见[双机部署怎么开](glm-5-3-flash-two-node.md#怎么开)与[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)）对照，六步出现四处异构变化：

| 冷启动步骤 | 混合状态与跨机专家并行特征（例外 B 绑定算例） | 与标准 `v0.30.0` 同构路径对照 |
| --- | --- | --- |
| **①③ 补丁与后处理** | 构造期由 worker 补丁将自定义稀疏 [MLA](mla.md) 类加入后处理名单（另见[稀疏注意力](sparse-attention.md)、[线性注意力](linear-attention.md)） | `v0.30.0` 已改为上游通用遍历子模块 |
| **③ 主草两遍逻辑遍历** | 启用后台预读时，主模型与 MTP 草稿层各遍历一遍文件；按语言子账 `20.58 GiB`/卡重建整份约 `304.8 GiB`，两次逻辑遍历约 `609.6 GiB`（不等于物理磁盘读量，口径见 [TP 页](tensor-parallel.md#先区分哪些权重归-tp哪些已经由-ep-分走)与[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)） | 标尺表 $V_{\text{scan}} = k \times S_{\text{ckpt}}$ 的双遍实例 |
| **④ 双档试跑** | 先跑 `128` token 覆盖 MoE 的 MC2 融合通信（见 [MoE 通信选路](one-request.md#moe-通信走-mc2-还是-allgather)），再跑 `8192` 单步上限；预算算例切出 `3,855` 块、每块 `7.969 MiB`（唯一推导见[剩下的显存变成多少 KV cache](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)） | 常规稠密模型只跑一次单步上限试跑 |
| **⑥ 主草分治录图** | 草稿子配置的 eager 开关仅约束草稿层；主模型仍按 `FULL_DECODE_ONLY` 录制 `4/8/16/32/64/96/128` 七档（MTP 每请求一步验证 `4` token，对应 `1～32` 并发；块借还见 [R1 借还块](vllm-kv-block-allocation.md#放到-glm-双机r1-从借块到还块)） | 不可把草稿侧 `enforce_eager` 误当主模型关闭录图 |

## 常见误解

排查冷启动报错、显存溢出或加载慢时，最常踩中的五组误判汇总在下图中：

```wiki-diagram
file: worker-life-fig-myths
```

除图中五条核心对照外，再补齐四条高频实战易混点：

- **「手传 `--kv-cache-memory` 就能跳过第④步试跑节省启动时间」**：错。显式字节预算只跳过剩余显存扣减公式，`profile_run()` 照跑不误，因为它同时承担首次图外算子编译；且填得比物理空闲还大只会在第⑤步分配张量时直接爆显存。
- **「录好了图，线上每一步都会走图回放，或者命令里写了 `enforce_eager` 主模型就不录图」**：两半都错。`FULL_DECODE_ONLY` 只回放纯 decode 步，混入 prefill 或 DP 组内任一副本无法用图时整步退回逐算子执行（见 [ACL Graph](acl-graph.md)）；而写在 `--speculative-config` 内部的 `"enforce_eager": true` 只管草稿模型，不影响主模型捕获 decode 图。
- **「`sleep_mode` 只在运行期休眠时才起作用，或者 `worker.py` 里方法的书写顺序就是执行顺序」**：两半都错。开启 `enable_sleep_mode` 在第③步和第⑤步就会把权重和缓存本体分流进 `CaMemAllocator` 专用池；而 `worker.py` 中 `determine_available_memory` 写在 `load_model` 前面、`compile_or_warm_up_model` 写在 `initialize_from_config` 前面，真实先后完全由调用方 `WorkerProc` 与 `EngineCore` 决定。

## 对照源码

### 怎么开

冷启动六步没有总开关，每次起服务都会完整走完；上线验证或调优加载与预热耗时时，可对照以下 `v0.30.0` 命令模板与启动日志取证指令：

```bash
# 1. Atlas A2/A3 四卡拉起 Qwen3-30B-A3B：开启浮点/量化全转 NZ 与加载期重叠预热
export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3
vllm serve /path/to/Qwen3-30B-A3B-W8A8 \
    --served-model-name qwen3 \
    --tensor-parallel-size 4 \
    --enable-expert-parallel \
    --quantization ascend \
    --load-format auto \
    --safetensors-load-strategy prefetch \
    --gpu-memory-utilization 0.90 \
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \
    --additional-config '{"weight_nz_mode":2,"ascend_warmup_config":{"enable_early_nz_warmup":true,"enable_early_kernel_warmup":true}}'

# 2. 按冷启动顺序从日志核对权重加载、KV 预算、预热与图捕获四道里程碑
grep -E "Checkpoint size:|Loading model weights took|Model loading took|Available KV cache memory:|Triton kernel warmup|Graph capturing finished|Actual usage:|init engine" serve.log
```

- **调用方与六步编排**：`NPUWorker` 继承 `WorkerBase`（`310P` 子类为 `NPUWorker310`[C7]），由平台类通过 `worker_cls` 返回。多进程执行器 `WorkerProc` 派生子进程时依次调 `init_device()` 与 `load_model()`[C16]；`EngineCore._initialize_kv_caches` 先汇总 `get_kv_cache_spec` 与 `determine_available_memory`，经 `get_kv_cache_configs` 取全组 `min_num_blocks` 并在 `max_model_len` 变化时广播 `update_max_model_len`[C17][C19]，最后由执行器抽象层顺次广播 `initialize_from_config` 与 `compile_or_warm_up_model`[C18]。
- **模型、配置与分词器的 CLI/Python 入口**：CLI 连字符参数与离线 `LLM` 同名下划线字段一一对应（对外模型别名另见 [API 入口](api-server-entry.md#怎么开)，量化精度入口见[量化页](quantization.md#怎么开)）：

| CLI 参数 / Python 字段 | 定义默认与实际作用 |
| --- | --- |
| `--hf-config-path` / `hf_config_path` | 默认 `None`（使用 `model` 的配置）；显式指定只改配置来源，默认加载器的主权重仍取自 `model` |
| `--config-format` / `config_format` | 默认 `auto`，按文件探测 Mistral 或 HF 配置格式，与选权重读取器的 `load_format` 相互独立 |
| `--hf-overrides` / `hf_overrides` | 默认空字典（Python 另支持回调）；覆盖 `architectures` 改变模型类选择（如官方 `Cerebras-GPT` 传 `GPT2LMHeadModel`[S36]），覆盖 `model_type` 会改变配置类，但均不会重排权重 |
| `--model-impl` / `model_impl` | 默认 `auto`；`vllm` 强制原生实现，`transformers` 选用兼容的 Transformers 后端[C23][C30] |
| `--tokenizer` / `--tokenizer-mode` | `tokenizer` 默认跟随 `model`（不改主权重来源）；`tokenizer_mode` 默认 `auto`，编号约定须与词向量表一致 |
| `--revision` / `--tokenizer-revision` / `--code-revision` | 默认均为 `None`；`tokenizer_revision` 缺省继承 `revision`（换分词器仓库时不会自动猜新修订），`code_revision` 专供配置与自定义代码读取，不可替代 `--trust-remote-code` |

- **`--load-format` 与读取器注册表**：默认 `auto` 先检查 `consolidated*.safetensors`（命中选 Mistral 布局），否则按 `*.safetensors`、`*.bin` 次序选首个有文件的模式；在 `v0.30.0` 中仅当未显式指定 `safetensors` 且模型允许 `fall_back_to_pt` 时才追加 `*.pt` 候选，远端 `safetensors` 索引仅在存在多个权重文件时下载[C26][S37]。`v0.30.0` 上游注册表分类如下（自定义格式如 [RFork](rfork-startup.md) 通过 `register_model_loader` 插件扩展，非上游内置枚举）：

| 加载器类别 | `v0.30.0` 已注册取值 | 适用边界与注意事项 |
| --- | --- | --- |
| 常规读盘 | `auto`、`hf`、`safetensors`、`pt`、`mistral` | 文件后缀仅决定读取方式，不代表量化精度 |
| 读盘变体 | `npcache`、`fastsafetensors`、`instanttensor` | `npcache` 为 `*.bin` 建 NumPy 缓存；`instanttensor` 属 CUDA 专用路径，不可当 NPU 加速开关 |
| 专用与缓存加载 | `tensorizer`、`sharded_state`、`runai_streamer`、`runai_streamer_sharded`、`modelexpress`、`ipc_cache` | 需配套预分片文件、流式依赖或本地守护进程；不可直接套在普通权重包上[C25] |
| 压测占位 | `dummy` | `DummyModelLoader` 生成随机权重供显存/吞吐分析，严禁用于精度或模型包验收 |

- **读盘策略、代码信任与昇腾扩展项**：`--safetensors-load-strategy` 默认 `None`（检测到 NFS/NFS4/Lustre 且整包 `<=` 可用主机内存 `90%` 时自动预读，否则内存映射）；显式 `lazy` 始终跳过自动预读；`eager` 整文件读入主机内存；`prefetch` 起后台线程预读进操作系统页缓存（超过 `90%` RAM 仅告警不中止）；`torchao` 面向 `torchao >= 0.14.0` 权重[C22][C27]。注意开启多线程加载 `enable_multithread_load` 时只允许省略策略或 `lazy`，搭配 `eager`/`prefetch`/`torchao` 会直接报错[C26]。`--trust-remote-code` 默认 `false`，仅对已审计并固定 commit 的仓库开启（请求级聊天模板信任另见 [API 入口](api-server-entry.md#怎么开)）。昇腾侧 `--additional-config` 提供 `weight_nz_mode`（默认 `1`，`Qwen3-30B-A3B` 食谱配 `2`[S33]）与 `ascend_warmup_config`（`enable_early_kernel_warmup` / `enable_early_nz_warmup` 默认均为 `False`[C13][S34]）。

### 会报什么错与开销取舍

冷启动挂起或报错时，先定位停在第几步即可缩半排查面：

| 挂在阶段 | 首查方向 | 典型报错或告警原文 |
| --- | --- | --- |
| **① 构造函数** | 安装包与硬件卡型匹配、自定义算子编译 | `check_ascend_device_type()` 不匹配抛 `RuntimeError`；`COMPILE_CUSTOM_KERNELS` 为假打告警[C1] |
| **② 选卡建组** | `ASCEND_RT_VISIBLE_DEVICES`、同卡杂进程占用、HCCL 连通 | `Free memory on device (x/y GiB) on startup is less than desired GPU memory utilization (...)`（启用 MRV2 另打开发期提示告警） |
| **③ 模型解析与读盘** | `revision`、架构注册、`load_format`、单进程睡眠限制 | 缺架构名报 `No model architectures are specified`；未注册格式报 `Load format ... is not supported`；缺文件报 `Cannot find any model weights with ...`；多实例开睡眠模式报 `Sleep mode can only be used for one instance per process.`[S35] |
| **④ 预算量测** | 同卡或宿主机其他进程在试跑期间释放了显存 | `Error in memory profiling. Initial free memory ... current free memory ...`（要求试跑后空闲严格小于启动快照，相等或变多均触发断言[C3]，对照见[显存量测页](kv-cache-memory-profiling.md#空闲显存变多为什么量测反而失败)） |
| **⑤ 建缓存池** | 剩余块数是否够装单条 `max_model_len` 序列 | `EngineCore` 容量校验报错，详见 [KV cache 显存预算](kv-cache-memory-profiling.md#会报什么错) |
| **⑥ 预热与录图** | 最后一个成功的捕获尺寸、预算外余量 $1 - u$ 是否见底 | 临时传 `--enforce-eager` 跳过 `capture_model()` 与区间补端点，快速区分图捕获故障与算子本身故障 |

开销取舍上：`eager` 读盘增加单文件主机内存峰值，`prefetch` 提前吃页缓存与存储带宽（容器环境须同步核对 [cgroup 内存账](device-memory.md#怎么开)）；两者只缩短冷启动读盘等待，不改变运行期每步生成吞吐。`--enforce-eager` 适合排障隔离，但会让线上每步退回逐算子下发；`--kv-cache-memory` 适合同环境反复重启锁定块数，但省不掉 `profile_run()` 的首次编译耗时[D]。此外上游 `enable_ep_weight_filter` 默认关闭（昇腾在开启 EPLB 时还会将其替换为空函数），未实测验证前不盲目开启[I]。

### 版本差异

以下四版本核验矩阵分别对齐昇腾插件（`v0.23.0: 2c59ff10` / `v0.26.0rc: 2ed6cbba` / `v0.30.0: c09d3e20` / `main: 8d6180e2`）与配套上游 `vLLM`（`0fc695fc` / `568afb3a` / `ced6857a` / `ba15685a`）：

| 核验维度 | `v0.23.0 (2c59ff10 / 0fc695fc)` | `v0.26.0rc (2ed6cbba / 568afb3a)` | `v0.30.0 (c09d3e20 / ced6857a)` | `main (8d6180e2 / ba15685a)` |
| --- | --- | --- | --- | --- |
| **冷启动六步骨架与后处理** | 六步顺序确立；含 `patch_process_weights_after_loading`（认 `DSAAttention`，GLM 镜像 `db701c1f` 另认专属 MLA 类）及 `patch_weight_utils` | 删 `patch_weight_utils`；保留 `DSAAttention` 后处理补丁 | 删旧后处理补丁，统一走上游 `is_deferred_attention_layer` 遍历子模块；`init_device` 增 `register_ascend_fla_customop` | 延续六步依赖链与上游子模块遍历后处理 |
| **预热体系演进（7 类 vs 注册表）** | 无 `kernel_warmup` 入口，仅有尺寸 `_dummy_run` 与 `_warm_up_atb` | 新增 `kernel_warmup`（`HAS_TRITON` 下预热拒绝采样、惩罚项、RMS 三项） | 扩充至 **7 类预热**：`kernel_warmup` 增 `indexer` 达四项[C10]，并在 V1 runner `model_runner_v1.py#L4385-L4560` 新增可选重叠线程 `nz_warmup` 与 `early_kernel_warmup` | **重构为声明式 `JitWarmupRegistry`**（`AscendTritonJitKernel` + `dcp`/`dspark` 注册，`enable_jit_warmup` 默认 `True`），移除 `early_kernel_warmup.py`，保留 `nz_warmup.py` 并迁至 V2 runner `worker/v2/model_runner.py#L330-L353`（`finally` 中 `join`）[C44][C51] |
| **睡眠池边界与预算修正** | `tag="kv_cache"` 包住整个 `initialize_kv_cache` | 同 `v0.23.0`；预算修正见显存量测页 | `tag="kv_cache"` 仅包缓存本体，DSpark 归属与清零元数据留池外；支持 `startup_plan`、稀疏卸载与 KVPP 预算约束 | 延续池外持久元数据、分组缩放与可选特性预算修正 |
| **上游模型解析与加载器注册** | 缺 `architectures` 按 `model_type` 补全（四版均保留）；策略字段为自由 `str`；显式 `safetensors` 仍可能追加 `pt`；注册表已含 `modelexpress`，并含 `gguf`、`bitsandbytes` | 保留 `model_type` 补全与 `modelexpress`、`bitsandbytes`，移除 `gguf`；策略限定枚举且新增 `enable_multithread_load` 仅允许 `None`/`lazy` 限制；显式 `safetensors` 禁追加 `pt` | 延续 `model_type` 补全与多线程策略限制；新增初始化 Hub `revision` 预解析、配置读取 `with_retry`（`max_retries=2`，即最多 2 次尝试 / 隔 2s 重试 1 次）；移除 `bitsandbytes`，新增 `ipc_cache`（保留 `modelexpress`） | 延续 `model_type` 补全、相同的加载器注册集合（含 `ipc_cache`、`modelexpress`）、多线程策略限制与配置最多 2 次尝试（1 次重试）机制 |

### 源码位置

六个核心方法均位于 `vllm_ascend/worker/worker.py`（注意文件内 `determine_available_memory` 排在 `load_model` 前、`compile_or_warm_up_model` 排在 `initialize_from_config` 前，阅读时以调用方顺序为准；历史 GLM 专用镜像 `db701c1f` 属于独立提交[S38]，一并列于首列供跨章对照）：

| 冷启动步骤 | 方法名 | GLM 历史镜像 (`db701c1f`) | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
| --- | --- | --- | --- | --- | --- | --- |
| ① 换补丁注算子 | `__init__` | `L90` | `L90` | `L99` | `L124` | `L146` |
| ② 选卡建通信组 | `init_device`（`_init_device`） | `L505`（`L395`） | `L505`（`L395`） | `L489`（`L385`） | `L498`（`L391`） | `L589`（`L482`） |
| ③ 装权重后处理 | `load_model` | `L668` | `L681` | `L723` | `L854` | `L969` |
| ④ 试跑量预算 | `determine_available_memory` | `L527` | `L527` | `L511` | `L567` | `L664` |
| ⑤ 建物理缓存池 | `initialize_from_config` | `L894` | `L907` | `L1001` | `L1185` | `L1284` |
| ⑥ 预热与录图 | `compile_or_warm_up_model` | `L693` | `L706` | `L748` | `L879` | `L1006` |

页首 `sources` 列表第 1–51 项对应关系与核验边界如下：

- **来源 1–15（`v0.30.0` 插件源码）**：`worker.py` 六步主体与 HCCL 建组（来源 1–6）、`NPUWorker310` 子类定制（来源 7）、`model_runner_v1.py` 权重加载计量、V1 早期预热挂载（`L4385/L4559`）与图捕获委托（来源 8–9）、`kernel_warmup.py` / `early_kernel_warmup.py` / `nz_warmup.py` 预热实现（来源 10–12）、`AscendConfig` 预热与 `weight_nz_mode` 定义（来源 13–14）及 `utils.py` 中 `maybe_trans_nz` 分形转换（来源 15）。
- **来源 16–31（`v0.30.0` 配套上游 `vllm@ced6857a`）**：`WorkerProc`、`EngineCore._initialize_kv_caches`、`Executor` 调用顺序与 `min_num_blocks` 同步收缩（来源 16–19）、加载与录图标准日志（来源 20–21）、`LoadConfig` / `ModelConfig` / 加载器注册表 / `safetensors` 预读与 `process_weights_after_loading`（来源 22–28）以及配置、模型、分词器解析注册表（来源 29–31）。
- **来源 32–38（官方文档与食谱）**：`Qwen3-Dense`[S32] 与 `Qwen3-30B-A3B` 启动指南、`additional_config.md`、`sleep_mode.md`、上游模型解析与 HF 集成文档，以及「09 旗舰异构模型全案」GLM 双机历史食谱（来源 38）。
- **来源 39–51（跨版本、历史快照与 `910B3` 真机微基准）**：`v0.23.0`（来源 39–40，上游 `enable_ep_weight_filter` 见来源 45）、`v0.26.0rc`（来源 41–42）、社区 `main` `JitWarmupRegistry` 重构、V2 `nz_warmup` 接入与上游加载器（来源 43–44、46、51）、GLM 历史镜像后处理补丁（来源 47）、存档原文快照（来源 48）以及 `Ascend 910B3` 八卡冷启动阶段日志与 `.pyc` / `npu_format_cast(NZ)` 微基准（来源 49–50）[M49][M50]。
- **实测与未核边界说明**：`Ascend 910B3` 已实测 `Qwen3-8B`（`15.29 GiB` 权重、`TP=4` `Memory profiling` 约 `56 s`、`torch.compile` 约 `43 s`、`ACLGraph` `35 ~ 40 s`）、8 进程 `.pyc` 并发导入（`24.311 → 12.598 s`）与 `set_device`（`1.9103 s`）+ 首次/二次 `npu_format_cast(NZ)`（`7.1618 s` / `0.0007 s`）；标尺表中的 `30.0 GiB`（`W8A8` 静态估算）与源码注释中的 `15～19 秒` 仍保留原说明口径，而 `Compile and warming up model for size` 的具体触发档位及开启 `enable_ep_weight_filter` 在非 EPLB 场景下的可用性，仍需按目标部署实跑日志核实。
