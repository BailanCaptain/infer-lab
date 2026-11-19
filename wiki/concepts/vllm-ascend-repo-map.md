---
id: vllm-ascend-repo-map
title: 源码目录地图：把文件放回推理架构
type: concept
summary: 用启动、调度、执行、模型、状态与通信职责定位目录，沿 GLM 的执行路径选择阅读入口，区分上游框架和 Ascend 适配。
aliases:
  - 目录结构
  - 代码结构
  - 仓库结构
  - repo map
  - vllm_ascend 目录
chapters:
  - '20'
order: 10
sources:
  - 'vllm-ascend@db701c1f:vllm_ascend/__init__.py#L38-L77'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L475'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L599-L666'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2287-L2427'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2235'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L975-L988'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L735-L820'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L443-L482'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2075-L2105'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L78-L84'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L521-L545'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2585-L2607'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/draft_proposer.py#L1-L16'
  - >-
    raw:sha256-10dbcc4643349133e9f0120ad2262ba67af079e40d1a3f711e124b76e0a52434.md#L1-L579
  - 'vllm@0fc695fc:vllm/v1/outputs.py#L298-L307'
  - >-
    raw:sha256-c4d240be638906b9d141ca9d17810839ab8ea41079c8e044744bded5188845ab.md#L1-L592
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/engine/core.py#L450-L463
  - 'vllm-ascend@7d825229:vllm_ascend/models/__init__.py#L78-L88'
  - >-
    vllm-ascend@7d825229:vllm_ascend/quantization/methods/w8a8/w8a8_dynamic.py#L94-L134
  - >-
    vllm-ascend@7d825229:vllm_ascend/ops/fused_moe/router/grouped_topk_router.py#L80-L128
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L37-L83'
  - >-
    vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L42
  - 'vllm-ascend@c09d3e20:vllm_ascend/ec_manager/score_ec_manager.py#L1-L40'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L250-L382'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L1-L40'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/__init__.py#L70-L100'
  - 'vllm-ascend@8d6180e2:vllm_ascend/observability/runtime_guard/__init__.py#L1-L16'
  - 'vllm-ascend@8d6180e2:vllm_ascend/mrv2_utils.py#L29-L89'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L144-L165'
  - 'vllm-ascend@8d6180e2:vllm_ascend/core/kv_cache_config_builder.py#L1-L40'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: vllm-ascend-overview
    kind: builds-on
    note: 先认识上游框架和设备适配的协作
  - to: request-call-chain
    kind: builds-on
    note: 用实际数据交接定位源文件
  - to: ascend-patch-system
    kind: builds-on
    note: >-
      目录地图将 patch/ 定位为适配已加载行为或登记表的目录，并以平台与 Worker
      导入路径作为阅读入口；补丁机制页解释这两条入口如何在运行时完成替换。
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-10dbcc4643349133e9f0120ad2262ba67af079e40d1a3f711e124b76e0a52434.md
  - >-
    raw/sha256-5ace96083c87b9f40f2b3889e57d367dada6771eaf2fa6ce0f34adf72aeaeb77.md
---

## 想找一段推理逻辑，先打开哪个目录？

源码目录地图把启动、调度、模型计算、状态管理和通信这些职责对应到文件。例如，要查「调度决定怎样变成模型输入」，先打开 worker 目录里的 Runner，而不是从最大的模型文件开始读。

图中的 **EngineCore** 组织每步调度与结果更新，**Executor** 把执行任务交给各卡的 **Worker**；Worker 管理设备，其内部的 **Runner** 准备输入并驱动模型。模型再调用后端与算子，也就是特定硬件上的计算实现。

```wiki-diagram
file: vllm-ascend-repo-map
```

图中的运行时主线连接 EngineCore、Worker/Runner、模型和算子。启动配置与注册为它们提供实现选择；通信和图执行参与具体路径，不是每次请求额外依次经过的固定站点。

## 为什么需要这张地图，阅读的代价在哪？

同一个推理问题往往跨越多个目录。沿用开篇的例子：要查调度结果如何变成输入，先在 worker/ 找 Runner 的输入准备，再沿它接收的数据回查上游调度；若直接从 models/ 开始读，看到的是输入已经备好后的计算，仍需返回去找准备过程。按职责选入口，能先把问题缩小到负责这次交接的文件。

代价是要继续跨文件、跨仓库核对构造和调用关系；找到目录只是确定起点。查清完整先后顺序时，沿[请求调用链「七站逐站」](request-call-chain.md#七站逐站从哪个函数进往下调谁)继续走，本图是它的全线源码附录；职责概览见[框架总览](vllm-v1-shape.md)。

## 上游保留哪些职责

vLLM 的 v1/engine 组织引擎迭代，v1/core 中有调度与缓存管理，v1/executor 封装执行方式。一次迭代由 EngineCore 调度、提交执行并更新结果。这些共同框架与 Ascend 插件协作；找完整调用链时需要同时打开两个仓库。

沿普通 step 阅读时，要区分提交与取得结果：调度器生成本轮计划，EngineCore 非阻塞提交执行，再取得语法掩码，随后等待执行结果。非阻塞的是提交调用，不代表后续取结果也无需等待。


Ascend 的 core/ 提供部分调度或资源机制适配，不能因名称相同就把它当成整个 EngineCore，也不能断言它完全没有运行时推理逻辑。阅读时以实际类、派生关系和调用点确定职责。

## Ascend 目录与学习问题

以下路径相对固定专用代码中的 vllm_ascend/；仓库根的 csrc/ 另行标出。

| 路径 | 主要阅读问题 | 从哪里接入 |
|---|---|---|
| \_\_init\_\_.py、platform.py、ascend_config.py | 实现怎样注册，配置怎样检查和解析 | 插件发现与启动配置 |
| worker/ | 设备如何初始化，调度结果怎样变成输入张量 | NPUWorker、NPUModelRunner |
| models/、transformers_utils/ | 特定模型的结构与配置类型如何表达 | GLM 架构登记及 glm5_next.py |
| attention/、ops/ | 各层怎样解释状态并执行设备计算 | 层的后端绑定、算子分派或直接调用 |
| distributed/ | 参与者编号（rank）与通信组怎样组织，数据怎样传递 | Worker 通信初始化、并行层与连接器 |
| compilation/、xlite/ | 如何进行图变换与执行结构复用 | 配置选择、Runner 与图包装 |
| patch/ | 哪些已加载的行为或登记表被适配 | 平台与 Worker 导入路径 |
| model_loader/、quantization/ | 前者选择权重加载方式；后者解释量化权重的精度与布局 | 实际加载器与量化实现 |
| spec_decode/、sample/ | 前者生成供后续验证的草稿候选；后者实现采样与候选验证 | 对应生成模式的执行路径 |
| kv_offload/、simple_kv_offload/ | 状态在设备内外怎样搬运 | 所选卸载与缓存机制 |
| \_310p/、device/、device_allocator/ | 设备专用实现、硬件能力档案（`hardware_profile.py`）与资源分配 | 硬件条件、能力门控与分配器选择 |
| ec_manager/、observability/（`v0.30.0` 起） | 编码器缓存管理（`score_ec_manager.py`）与指标/运行时守护（`main` 扩出 `runtime_guard/` 与 `ms_metrics/`） | 多模态 EC 与运行期观测钩子 |
| 根目录 csrc/ | 自定义设备扩展如何构建与计算（`main` 移除旧 `sparse_attention_score/` / `msa_index_score/` 并新增 `engram_hixl/`） | `torch.ops` 等扩展调用 |

同一目录可包含互斥的实现，需沿当前配置实际选择的分支继续读；在 `main` 分支中，`worker/model_runner_v1.py` 已物理删除并由 `mrv2_utils.py` 全面收敛至 `worker/v2/model_runner.py`，详见[版本差异](#版本差异)。

## 沿 GLM 执行路径读一组文件

先从 worker/worker.py 的执行入口看 Worker 接收什么，再进入 worker/model_runner_v1.py 的输入准备、模型前向和采样交接。对照[准备输入页](prepare-inputs-flow.md)，记录 token（文本切成的小片段）的输入行、位置与块表（历史缓存所在块的编号表）如何对应。

阅读执行入口时，要分清 Runner 交给 Worker 的结果和 Worker 交回引擎的结果。模型执行输出、异步输出或空值可以直接交回；异步输出还需等待结果就绪后再取得实际输出。Runner 也可以交出供后续模型层继续计算的中间张量：在流水并行中，模型被分成前后几段，由不同 Worker 接力；由内部执行器负责接力、且当前不是最后一段时，Worker 将这些张量发给下一段，随后按缓存传输信息返回空值或结果对象。它不会把这份中间张量直接当成最终 token 交回引擎。

如果执行返回空值，普通 step 才另外调用 sample_tokens，从模型计算结果中选出输出 token；是否进入这个采样入口取决于执行返回值。


模型前向进入已注册的 GLM 类；models/glm5_next.py 负责选择混合层，并连接 mHC、注意力与前馈计算。mHC 管理并混合多路残差，也就是跨层保留的向量；注意力从历史中取信息，前馈再变换当前向量，结构见[模型总览](glm-5-3-flash.md)。进入具体层后再追 attention/ 或 ops/。

例如 GLM 的稀疏注意力沿用 **DSA**（DeepSeek Sparse Attention）：用 **lightning indexer** 这个轻量打分网络先挑出要读取的历史，再做注意力计算；GLM 对候选历史的组织方式见[稀疏注意力](sparse-attention.md#候选位置从哪里来)。它在 ops/ 中包装注意力层并绑定后端，后端类则定义在 attention/ 中；阅读时沿对象的构造和调用继续追踪。

如果张量在设备间分片，接着读并行层与 distributed/；Worker 初始化为这些计算建立通信组。若要解释某个算子为何走 Ascend 实现，回查 utils.py 的 CustomOp 登记和相应启用条件；CustomOp 是允许插件登记并替换计算实现的扩展点。

启动时的插件与平台准备则沿 \_\_init\_\_.py → platform.py 另行展开。

读到平台配置更新时，还要检查继续执行的条件：已有设备配置且其设备类型不匹配，或模型配置缺失时，Ascend 的配置更新函数会提前返回。因此，找到平台入口之后，应沿条件分支确认当前配置是否会进入后续更新；这不是整个启动流程必然终止的判断。

## 常见误解

- **目录越大、文件越长就越重要？** 组件在请求路径中的职责取决于它接收什么、改变什么、把结果交给谁；目录大小和文件行数不能判断重要程度。
- **目录表列出了整个仓库？** 这是按职责选出的阅读入口；具体路径涉及表外目录时，仍要沿调用继续追踪，某段功能也可以跨多个目录。
- **目录名就是完整调用链？** 目录给出代码位置，实际先后由对象构造和调用关系决定；同名的 core 在上游与 Ascend 中也有不同职责。
- **注册是每轮模型计算的一站？** 插件与平台的注册在启动准备阶段完成，运行时使用选好的实现；应分开追踪这两条路径。

## 对照源码

### 怎么开

先在[请求调用链](request-call-chain.md#七站逐站从哪个函数进往下调谁)确定站点，再按上表打开对应文件；目录地图本身无需运行开关。

### 会报什么错

找不到文件或同名类时，先按下面的版本表核对提交。实际推理异常则用[日志与 traceback 定位](request-call-chain.md#出问题时判断它停在哪一站)，沿最内层调用找原始报错。

### 开销和什么时候别开

阅读地图不改变推理开销。需要分析时延或显存时，应进入该站的机制页和实际执行路径，目录大小不能代替性能证据。

### 版本差异

按知识库四版本正式钉点核对 `vllm_ascend/` 顶层目录与 `csrc/` 结构：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）。**本页 GLM-5.3-Flash 绑定算例读的是专用镜像 `db701c1f`（单文件 `models/glm5_next.py`），与社区四版目录化演进分别核对**，完整钉点见 [GLM 固定来源基线](../sources/glm-5-3-flash-baseline.md)。

| 目录与演进维度 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
| --- | --- | --- | --- | --- |
| 顶层目录概览 | 36 项：含 `_310p/`、`device/`、`kv_offload/`、`simple_kv_offload/`、`flash_common3_context.py` | 36 项：新增 `transformers_utils/`，删 `flash_common3_context.py` | 36 项：**新增 `ec_manager/`、`observability/`、`weight_switch/`、`config_utils.py`**；移出 `kv_offload/`、`simple_kv_offload/`、`memcache_comm_fence.py` | 39 项：**新增 `observability/runtime_guard/`（及 `ms_metrics/`、`runtime_config/`）、`mrv2_utils.py`、`hisparse/`、`kv_trace/`、`shared_engram*.py`** |
| `worker/` 与 Model Runner | `worker/model_runner_v1.py`（MRV1） | 同 `v0.23.0` | **新增 `worker/v2/`**（与 `model_runner_v1.py` 并存，未设 `VLLM_USE_V2_MODEL_RUNNER` 默认走 MRV1） | **物理删除 `worker/model_runner_v1.py`**，由 `mrv2_utils.py` 全面收敛至 `worker/v2/model_runner.py` |
| `device/`、`ec_manager/` 与 `core/` | `device/device_op.py`；无 `ec_manager/`；`core/` 含 `scheduler_dynamic_batch.py` / `scheduler_profiling_chunk.py` | `core/` 删 `scheduler_dynamic_batch.py`，增 `batch_job_aware_scheduler.py` / `short_request_first_scheduler.py` | `device/hardware_profile.py` 硬件能力档案；`ec_manager/score_ec_manager.py`；`core/` 含 `dyntra_lb_scheduler.py` 与 `scheduler_profiling_chunk.py` | `core/` **删除 `scheduler_profiling_chunk.py` 与 `profiling_chunk_predictor.py`**，新增 `kv_cache_config_builder.py`、`kv_cache_dtype_handlers.py` |
| `models/`、`quantization/` 与 `ops/` | 维护分支无 GLM（镜像 `db701c1f` 为 `models/glm5_next.py`）；W8A8 在 `quantization/methods/w8a8_dynamic.py` | 无 GLM（有 Kimi K3） | 目录化拆出 `models/glm5next/`、`quantization/methods/w8a8/`、`ops/fused_moe/router/` | 延续目录化拆分与 `models/glm5next/`、`quantization/methods/w8a8/` 结构 |
| 根目录 `csrc/` 扩展 | 含 `batch_matmul_transpose/`、`moe/`、`attention/` 等 | 删 `batch_matmul_transpose/`，增 `attention/sparse_attention_score/` CPP | 含 `attention/sparse_attention_score/` 与 `attention/msa_index_score/` CPP | **删除 `csrc/attention/sparse_attention_score/` 与 `msa_index_score/` 等 score CPP 目录**，新增 `csrc/engram_hixl/` |

表中对比的是逐提交源码树变化；目录导航本身没有运行开关或默认值。读代码时先确认所读快照，再按职责、符号与调用关系定位；插件注册和执行行为的版本对照见 [Ascend 总览](vllm-ascend-overview.md#版本差异)，下一页给出 [问题驱动的阅读方法](reading-vllm-ascend.md)。

### 源码位置

除上游条目外，下列位置均属 GLM 专用提交 db701c1f，对应页末 sources。固定源码证据按职责分三组：启动配置与资源接入（来源 1、2、6、7）[C1]；执行调度与采样交接（来源 3、4、8、12、13）[C8]；模型层与注意力后端（来源 5、9、10、11）[C9]。下表保留每项结论的来源编号和精确位置。

正文按职责选择阅读入口的建议，是把来源 8 的调度提交、来源 3 的 Worker 接收与委派、来源 4 的 Runner 前向、来源 5 的模型层计算放在一起比较后，组织出的阅读顺序 [I]。它用于缩小查找范围；具体执行仍沿当前配置的构造、调用和分支逐步核对，不把这张目录地图当作一次现场请求的调用记录。

| 本页结论 | 文件与定位 |
|---|---|
| 插件登记、权重加载器登记与平台配置 | \_\_init\_\_.py 第 38–77 行；platform.py 第 450–475 行（来源 1、2） |
| Worker 接收执行任务，Runner 做前向并交接采样 | worker/worker.py 第 599–666 行；worker/model_runner_v1.py 第 2287–2427 行（来源 3、4） |
| 混合层选择，以及 mHC、注意力和前馈的连接 | models/glm5_next.py 第 2075–2105、2212–2235 行（来源 9、5） |
| Worker 初始化通信组；按条件登记 CustomOp | worker/worker.py 第 975–988 行；utils.py 第 735–820 行，包含登记表、310P 与版本条件，以及最终注册调用（来源 6、7） |
| 上游组织调度、提交执行与更新结果 | vllm@0fc695fc 的 vllm/v1/engine/core.py 第 443–482 行（来源 8） |
| ops 层绑定 attention 后端 | ops/indexer_kpool_mla.py 第 78–84 行；attention/indexer_kpool_mla_v1.py 第 521–545 行（来源 10、11） |
| 草稿候选生成与采样、验证的分工 | spec_decode/draft_proposer.py 第 1–16 行；worker/model_runner_v1.py 第 2585–2607 行按是否有草稿元数据选择 sampler 或 rejection_sampler（来源 13、12） |

待核：实际部署环境中安装包是否与这些 Git 快照一致，仍需镜像内的提交和文件证据；本页只核对源码快照，不提供硬件运行结果 [!]。

固定 GLM Worker 会直接返回普通输出、异步输出或 None（见来源 3、15）；中间张量则要求不是 external_launcher 且不是最后一个 PP rank，再发给下一段。没有连接器输出时返回 None；连接器的两种完成集合均空时返回共享空输出，否则复制空输出并携带连接器信息。异步输出的 get_output 会等待就绪且只能调用一次，不能把“拿到异步对象”当成“设备已完成”。

固定 GLM 的平台配置更新遇到已指定其他设备，或尚无 model_config 时会提前返回（见来源 2）。阅读该函数时，应先判断是否经过这两道条件，不能把函数里所有改写都当作每次启动必然发生。

- 来源 17：vllm@0fc695fc，vllm/v1/engine/core.py，L450–L463。
- `v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）新增目录与文件锚点见文首 `sources` 末尾 8 条（`ec_manager/score_ec_manager.py`、`device/hardware_profile.py`、`worker/v2/model_runner.py`、`models/__init__.py`、`observability/runtime_guard/__init__.py`、`mrv2_utils.py`、`core/kv_cache_config_builder.py`）。
