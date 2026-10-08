---
id: vllm-ascend-repo-map
title: 源码目录地图：把文件放回推理架构
type: concept
summary: 用启动、调度、执行、模型、状态与通信职责定位目录，沿 GLM 的执行路径选择阅读入口，区分上游框架和 Ascend 适配。
aliases: [目录结构, 代码结构, 仓库结构, repo map, vllm_ascend 目录]
chapters: ["20"]
order: 10
sources:
  - vllm-ascend@db701c1f:vllm_ascend/__init__.py#L38-L77
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L475
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L599-L666
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2287-L2427
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2235
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L975-L988
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L735-L820
  - vllm@0fc695fc:vllm/v1/engine/core.py#L443-L482
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2075-L2105
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L78-L84
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L521-L545
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2585-L2607
  - vllm-ascend@db701c1f:vllm_ascend/spec_decode/draft_proposer.py#L1-L16
verified: []
evidence: "C"
relations:
  - {to: vllm-ascend-overview, kind: builds-on, note: 先认识上游框架和设备适配的协作}
  - {to: request-call-chain, kind: builds-on, note: 用实际数据交接定位源文件}
contradicts: []
updated: "2026-10-02"
origin: direct
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
| \_310p/、device/、device_allocator/ | 设备专用实现与资源分配 | 硬件条件和分配器选择 |
| 根目录 csrc/ | 自定义设备扩展如何构建与计算 | torch.ops 等扩展调用 |

同一目录可包含互斥的实现，需沿当前配置实际选择的分支继续读。

## 沿 GLM 执行路径读一组文件

先从 worker/worker.py 的执行入口看 Worker 接收什么，再进入 worker/model_runner_v1.py 的输入准备、模型前向和采样交接。对照[准备输入页](prepare-inputs-flow.md)，记录 token（文本切成的小片段）的输入行、位置与块表（历史缓存所在块的编号表）如何对应。

模型前向进入已注册的 GLM 类；models/glm5_next.py 负责选择混合层，并连接 mHC、注意力与前馈计算。mHC 管理并混合多路残差，也就是跨层保留的向量；注意力从历史中取信息，前馈再变换当前向量，结构见[模型总览](glm-5-3-flash.md)。进入具体层后再追 attention/ 或 ops/。

例如 GLM 的稀疏注意力沿用 **DSA**（DeepSeek Sparse Attention）：用 **lightning indexer** 这个轻量打分网络先挑出要读取的历史，再做注意力计算；GLM 对候选历史的组织方式见[稀疏注意力](sparse-attention.md#候选位置从哪里来)。它在 ops/ 中包装注意力层并绑定后端，后端类则定义在 attention/ 中；阅读时沿对象的构造和调用继续追踪。

如果张量在设备间分片，接着读并行层与 distributed/；Worker 初始化为这些计算建立通信组。若要解释某个算子为何走 Ascend 实现，回查 utils.py 的 CustomOp 登记和相应启用条件；CustomOp 是允许插件登记并替换计算实现的扩展点。

启动时的插件与平台准备则沿 \_\_init\_\_.py → platform.py 另行展开。

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

本页按[GLM 固定来源基线](../sources/glm-5-3-flash-baseline.md)定位 Ascend 专用代码，通用上游作为明确标记的参考。部署使用的已安装代码、源码工作树和某个社区发布分支不自动等价。

先确认正在读哪份代码，再用目录地图找文件：

| Ascend 代码快照 | 本页 GLM 模型入口在哪里 | 阅读时怎样处理 |
|---|---|---|
| v0.23 维护分支，2c59ff10 | 无 GLM 模型实现 | 保留职责划分，但不能在这里找专用 GLM 文件 |
| v0.26，2ed6cbba | 无 GLM 模型实现 | 同上，不能把版本号接近当成文件相同 |
| main，baa023ad | models/glm5next/，按模型、注意力等拆分 | 按类与调用关系重新定位 |
| GLM 专用提交，db701c1f | models/glm5_next.py | 本页图和文件入口采用这一份 |

表中是逐提交的目录差异；目录导航没有运行开关或默认值。插件注册和执行行为的版本对照见[Ascend 总览](vllm-ascend-overview.md#版本差异)，不以 main 的文件布局推断固定部署的行为。

版本变化可能迁移文件或改变同名函数。稳定的阅读线索是职责、符号、输入输出与调用关系；行号用于定位某份固定快照。下一页给出[问题驱动的阅读方法](reading-vllm-ascend.md)，包括配置追踪、异常边界和版本对照。

### 源码位置

除上游条目外，下列位置均属 GLM 专用提交 db701c1f，对应页末 sources：

| 本页结论 | 文件与定位 |
|---|---|
| 插件登记、权重加载器登记与平台配置 | \_\_init\_\_.py 第 38–77 行；platform.py 第 450–475 行 [C1][C2] |
| Worker 接收执行任务，Runner 做前向并交接采样 | worker/worker.py 第 599–666 行；worker/model_runner_v1.py 第 2287–2427 行 [C3][C4] |
| 混合层选择，以及 mHC、注意力和前馈的连接 | models/glm5_next.py 第 2075–2105、2212–2235 行 [C9][C5] |
| Worker 初始化通信组；按条件登记 CustomOp | worker/worker.py 第 975–988 行；utils.py 第 735–820 行，包含登记表、310P 与版本条件，以及最终注册调用 [C6][C7] |
| 上游组织调度、提交执行与更新结果 | vllm@0fc695fc 的 vllm/v1/engine/core.py 第 443–482 行 [C8] |
| ops 层绑定 attention 后端 | ops/indexer_kpool_mla.py 第 78–84 行；attention/indexer_kpool_mla_v1.py 第 521–545 行 [C10][C11] |
| 草稿候选生成与采样、验证的分工 | spec_decode/draft_proposer.py 第 1–16 行；worker/model_runner_v1.py 第 2585–2607 行按是否有草稿元数据选择 sampler 或 rejection_sampler [C13][C12] |

待核：实际部署环境中安装包是否与这些 Git 快照一致，仍需镜像内的提交和文件证据；本页只核对源码快照，不提供硬件运行结果。
