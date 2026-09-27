---
id: vllm-v1-shape
title: "vLLM 与 Ascend 架构：组件、进程和数据如何协作"
type: concept
summary: 从 GLM 单请求与并发批次出发，说明 API、EngineCore、Scheduler、Executor、NPUWorker 和 NPUModelRunner 的输入输出、状态与进程关系。
aliases: [vLLM 的形状, vLLM V1 架构, vLLM 进程结构, AsyncLLM, Executor, 执行器, SchedulerOutput, 架构总览]
chapters: ["10"]
order: 10
sources:
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L339-L415
  - vllm@0fc695fc:vllm/v1/engine/core.py#L95-L160
  - vllm@0fc695fc:vllm/v1/engine/core.py#L236-L290
  - vllm@0fc695fc:vllm/v1/engine/core.py#L443-L472
  - vllm@0fc695fc:vllm/v1/executor/abstract.py#L47-L92
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L307-L386
  - vllm@0fc695fc:vllm/v1/core/sched/output.py#L181-L241
  - vllm@0fc695fc:vllm/v1/outputs.py#L234-L267
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L505-L520
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L599-L677
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2284-L2431
  - vllm@0fc695fc:vllm/v1/engine/output_processor.py#L612-L690
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L662
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2323
  - https://docs.vllm.ai/en/v0.23.0/design/arch_overview/
relations:
  - to: concurrent-requests
    kind: builds-on
    note: 将请求进入、批次变化和独立输出对应到实际框架组件
verified: []
evidence: C
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 模型计算为什么需要这些组件

[模型介绍](glm-5-3-flash.md)说明了输入张量如何经过 GLM 主干，产生用于预测下一个 token 的隐藏表示。[单请求](one-request.md)和[并发请求](concurrent-requests.md)进一步展示了每轮输入、历史状态与输出的变化。框架负责把这些变化组织成持续运行的服务：接收请求、维护进度、分配资源、调用模型并交付结果。

以并发示例的第 3 轮为例，A 需要处理 1 个 decode 输入，C 需要处理 3 个 prefill 输入。模型计算需要的是这 4 个位置组成的张量和各自的状态；服务还需要知道 A、C 的请求 ID、输出目标、停止条件，以及下一轮谁继续执行。不同组件围绕这些数据承担不同职责。

本页采用 vLLM v0.23.0 的通用引擎接口与 GLM 专用 Ascend 源码快照，分别说明控制流程和 NPU 执行实现。专用镜像内最终安装的上游版本仍待核实，这两个源码快照不构成已验证的部署组合；完整记录见[来源基线](../sources/glm-5-3-flash-baseline.md)。

## 组件职责与进程关系

在线服务的前端处理协议与输出，引擎核心管理执行进度，Worker 负责设备上的执行环境。下图采用多进程执行器的示意部署，只展开一个 Worker；同一执行组中的其他 rank 具有对应的执行角色。rank 是分布式执行中的参与者编号，实际进程数量由并行配置与执行器决定。[C5][C6][S15]

```wiki-diagram
file: vllm-v1-shape
```

**API 与 AsyncLLM。** API 层接收聊天消息、处理模板和生成设置；`AsyncLLM` 提供异步引擎接口，将准备好的请求交给核心，并维护输出收集与处理。生成结果按请求关联回调用方；前端也会处理 token 编号和采样参数。[C1][C12]

**EngineCore、Scheduler 与缓存管理。** `EngineCore` 组织引擎循环，调用 `Scheduler` 生成本轮计划，再把执行结果交回调度器更新。Scheduler 保持等待/运行请求、已计算位置和资源占用；缓存管理器负责状态存储的分配与引用管理。它们通常是同一个引擎核心进程内协作的对象。[C2][C4]

**Executor。** 执行器把引擎操作送到相应 Worker，并收集结果。引擎通过统一接口使用它；单进程、多进程、Ray 等执行方式由配置选择。Executor 是组件角色，在图示多进程方式中，其管理对象属于核心侧，Worker 运行在被管理的进程里。[C5][C6]

**NPUWorker 与 NPUModelRunner。** Worker 管理本 rank 的设备环境，创建 Runner，并提供模型加载、执行和采样入口。Runner 保持执行侧的请求映射和输入缓冲，将调度结果转成 token、位置、注意力元数据等模型输入，然后组织前向、词表输出与采样。[C9][C10][C11]

**模型及设备状态。** 模型定义嵌入、层内运算和层间连接，注意力实现读取和更新历史。GLM 的 KDA 与稀疏注意力使用不同状态，具体结构见模型页；模型权重与注意力状态在执行侧按相应布局保存。引擎维护的资源记录与设备上的状态张量通过块表、状态索引等映射对应起来。[C3][C11][C14]

## 一轮执行通过两个接口完成交接

调度侧交出的 `SchedulerOutput` 是执行计划。它包含新进入及已有请求的信息、每个请求本轮安排的 token 数，以及状态资源更新所需的信息。Runner 可以结合已有执行侧状态准备本轮输入，因而持续生成时不必把所有历史都重新当作模型输入。[C7]

执行侧返回的 `ModelRunnerOutput` 带有请求 ID、请求到批内位置的映射、采样 token 等信息。Scheduler 据此更新对应请求，输出处理器再把生成结果交回服务调用方。[C8][C12]

| 第 3 轮的数据 | 谁准备或维护 | 谁消费 | 在 A/C 示例中的作用 |
|---|---|---|---|
| 本轮计划：A 处理 1 个、C 处理 3 个位置 | Scheduler | Executor、Worker、Runner | 确定批次计算范围 |
| 输入 `[A.y₁, C.p₀, C.p₁, C.p₂]` 与位置 `[5, 0, 1, 2]` | Runner | GLM 模型与注意力实现 | 提供实际前向输入 |
| 请求片段边界与状态索引 | Runner 按本轮请求映射准备 | 注意力实现 | 将每个输入对应到 A 或 C 的历史 |
| 输出请求映射和 `[A.y₂, C.y₀]` | 执行侧 | Scheduler、输出处理器 | A 达到停止条件，C 继续执行 |

表中数组沿用并发页的教学设定，并不是实测 trace。[A] 源码中的 EngineCore 普通执行路径可以概括为：调度 → 提交执行 → 必要时调用采样入口 → 根据结果更新请求。异步调度、流水线并行与投机解码会增加重叠或额外状态，本页先说明这些组件共同依赖的交接关系。[C4]

## 启动时建立资源，每轮执行时复用资源

Worker 在设备初始化时创建 Runner，加载模型权重。引擎随后向执行侧查询模型所需的缓存规格与可用内存，形成缓存配置，再要求执行侧建立缓存并预热。这个阶段同时需要模型需求、设备容量和引擎分配规则。[C3][C9][C10]

服务就绪后，一轮模型执行主要更新请求进度、批次输入和注意力状态。权重继续被后续请求复用；某个请求结束时释放其资源引用，其他请求可以继续运行。新增请求改变调度和输入集合，通常不需要重新加载整个模型。

这也解释了缓存管理为什么同时涉及引擎与执行侧：引擎需要决定哪些存储可分配给请求，执行侧需要把对应张量以算子能够访问的形式建立起来。只看其中一侧，都无法说明一个输入位置怎样找到自己的历史状态。

## Ascend 接入贯穿初始化与执行

vllm-ascend 通过平台注册、配置处理、Worker 选择、模型实现、后端和补丁等入口参与执行。在所引快照中，平台配置会选择 Ascend Worker；该 Worker 创建 NPU Runner，GLM 专用实现也位于 Ascend 包内。[C9][C13][C14]

因此，图中的进程边界不能直接当成两个仓库的分界。核心侧的配置和缓存建立会使用平台提供的信息，Worker 内也会复用上游接口与公共功能。接入机制见 [vllm-ascend 的接入位置](vllm-ascend-overview.md)，跨组件状态分工见 [vllm-ascend 的接入位置](vllm-ascend-overview.md)的「职责与状态归属」一节。

## 从一个执行组扩展到官方双机实例

本页展开的是一个引擎与其执行侧的关系。官方 GLM 示例的 DP、TP、EP 配置及设备拓扑集中在[双机来源基线](../sources/glm-5-3-flash-baseline.md)。分析完整部署时，需要把引擎、副本、rank 和机器分别映射：请求可以分配给不同执行副本，一个模型前向也可能需要同组多个 rank 协作。

双机中的组构造与具体跨机通信仍需继续核对相应实现。本页图中的一个 Worker 是角色展开，不对应一台服务器，也不表示官方双机只使用一个设备。

## 对照源码

| 阅读目的 | 固定位置 |
|---|---|
| 请求怎样进入异步引擎接口 | `async_llm.py` 339–415 行 [C1] |
| 核心如何创建执行器、缓存和调度器 | `core.py` 95–160、236–290 行 [C2][C3] |
| 一轮调度、执行、采样与结果更新 | `core.py` 443–472 行 [C4] |
| 执行器的选择与多进程调用 | `abstract.py` 47–92、`multiproc_executor.py` 307–386 行 [C5][C6] |
| 两侧交接的数据结构 | `sched/output.py` 181–241、`outputs.py` 234–267 行 [C7][C8] |
| NPU Worker、Runner 与模型执行 | `worker.py` 505–520、599–677 行；`model_runner_v1.py` 2284–2431 行 [C9][C10][C11] |

这些引用用于静态分析，没有设备运行或性能测量结果。各深入专题可能仍引用其他社区维护快照，阅读时以各页声明的版本为准。
