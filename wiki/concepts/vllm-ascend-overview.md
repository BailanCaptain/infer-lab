---
id: vllm-ascend-overview
title: "vllm-ascend 如何接入 vLLM"
type: concept
summary: 从平台注册、配置处理、Worker、模型注册和执行后端理解 Ascend 的接入位置；沿 GLM 主线区分启动时的实现选择与每轮模型执行。
aliases: [vLLM-Ascend, 昇腾适配层, NPU 插件, Ascend 接入,
  职责与状态归属, 分工, 边界, vLLM 与 vllm-ascend, 状态归属, 关键代码在哪, 归属边界]
chapters: ["10"]
order: 20
sources:
  - vllm-ascend@db701c1f:setup.py#L543-L550
  - vllm-ascend@db701c1f:vllm_ascend/__init__.py#L38-L75
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L203
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L662
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L832
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L869-L871
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L505-L520
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L599-L677
  - vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L1-L25
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L563-L567
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L287-L310
  - vllm@0fc695fc:vllm/v1/executor/abstract.py#L37-L92
  - vllm@0fc695fc:vllm/v1/engine/core.py#L236-L290
  - vllm@0fc695fc:vllm/v1/engine/core.py#L443-L472
  - vllm@0fc695fc:vllm/v1/core/sched/output.py#L181-L241
  - vllm@0fc695fc:vllm/v1/outputs.py#L234-L267
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L850-L870
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1262-L1278
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L894-L907
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1705-L1878
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1138-L1232
relations:
  - to: vllm-v1-shape
    kind: builds-on
    note: 先认识引擎、执行器、Worker 与 Runner，再定位 Ascend 的接入位置
verified: []
evidence: C
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 插件让框架选择 Ascend 的实现

vLLM 提供请求接入、引擎循环、执行器和模型执行所需的公共接口。vllm-ascend 作为单独的软件包，通过这些接口接入 NPU 的运行环境，同时提供模型适配、算子、通信实现和必要补丁。

例如，上一页中的 Executor 需要创建一个 Worker。平台配置可以让这个位置使用 `NPUWorker`；Worker 再创建 `NPUModelRunner`，负责准备 NPU 执行所需的张量和元数据。[C4][C7] 服务仍沿原有的请求与结果接口运行，而具体执行路径已经包含 Ascend 实现。

本页核对的是 GLM [来源基线](../sources/glm-5-3-flash-baseline.md)中的 Ascend 固定快照。它包含 GLM 专用模型注册，不能将这些实现无条件推广到所有社区版本。

## 接入点分布在启动与执行的多个位置

下图表示实现选择和调用关系，虚线表示配置或注册提供实现，实线表示运行中的调用。各列是模块职责范围；实际进程安排见[框架总览](vllm-v1-shape.md)。

```wiki-diagram
file: ascend-vs-upstream
```

**平台注册使 NPU 平台可被发现。** 包的入口声明包含 `vllm.platform_plugins` 和 `vllm.general_plugins`。平台注册函数返回 `NPUPlatform` 的类路径；其他入口用于连接器、模型加载器、模型等注册。[C1][C2]

**平台处理影响执行配置。** `NPUPlatform` 参与初始化和配置更新，在适用路径下选择 Ascend Worker，并调整后端相关配置。平台还提供注意力后端选择和设备通信类入口，因此其作用贯穿执行环境建立与计算实现选择。[C3][C4][C5][C6]

**Worker 与 Runner 执行每轮计划。** `NPUWorker` 提供设备初始化、模型加载、执行与采样方法，并把相应操作交给 Runner。所引快照的 `NPUModelRunner` 继承上游 Runner，因此执行侧同时包含复用逻辑与 Ascend 实现。[C7][C8][C11]

**模型注册可以接入专用模型代码。** 此快照将 GLM 的文本、多模态和 MTP 架构名称注册到 Ascend 包中的实现。因此“模型代码全部来自上游”不适用于本页的 GLM 基线。模型实际使用的层结构仍由模型配置和对应实现共同决定。[C9]

## 补丁也是实际接入方式的一部分

除正式扩展接口外，Ascend 实现还通过补丁调整部分行为。所引平台初始化调用全局补丁适配；补丁入口区分平台侧与 Worker 侧模块。[C3][C10]

“独立安装的插件包”描述代码的交付方式，具体行为仍需结合注册、继承、配置处理和补丁一起查看。分析某项功能时，要查明所用版本加载了什么实现，以及哪些补丁会改变其行为。不同版本的支持范围另见对应专题，不能从一个包名推断全部功能相同。

## 从 GLM 的执行路径选择源码入口

| 要解释的问题 | 阅读位置 | 需要连接的上下文 |
|---|---|---|
| 为什么创建的是 NPU Worker | 平台配置的 Worker 选择 [C4] | 并行配置与执行器 |
| 模型为什么进入 Ascend 包 | 模型注册表 [C9] | 模型架构名称、文本/多模态入口 |
| 调度结果怎样成为 NPU 输入 | Worker 与 Runner [C7][C8][C11] | 请求映射、位置、注意力元数据 |
| 为什么使用某个注意力后端或通信类 | 平台对应入口 [C5][C6] | 模型类型、硬件条件和配置 |
| 公共行为是否受到适配修改 | 平台初始化及补丁入口 [C3][C10] | 具体导入路径与固定版本 |

由这些入口继续下钻时，保留“输入是什么、结果交给谁、状态在哪里”的问题。这样读取函数和目录时，能够将实现放回完整的推理过程。跨组件的资源与状态分工见下一节。

## 职责与状态归属（原 who-owns-what 页）

以下事实由原 `who-owns-what` 页并入，2026-09-27 只作搬运，未重写文风。

处理请求 A 时，引擎要维护生成进度和资源占用，执行侧要准备张量、保存注意力历史，并把本轮输出关联回 A。先区分这些状态，才知道一个行为该从哪里追查：请求本轮没被调度，从请求队列、预算和资源分配查起；请求已进入执行却访问了错误历史，则追查批次映射、位置、块表或状态索引。

资源管理侧决定哪些块或状态存储可供请求使用；执行侧根据请求映射组织模型输入，并生成计算所需的存储索引。缓存张量由执行侧建立，模型通过这些索引访问其内容。[C13][C15][C17][C18][C19]

| 对象 | 主要维护位置 | 生命周期与用途 |
|---|---|---|
| 请求 ID、输入/输出序列、停止条件及进度 | 引擎请求与调度侧 | 从请求进入到结束，支持调度和独立输出 |
| 存储分配与引用记录 | 缓存管理侧 | 决定请求可使用哪些状态存储，结束或抢占时按策略更新 |
| 执行侧请求映射、输入缓冲与注意力元数据 | Runner | 随本轮请求加入、退出和 token 数变化更新 |
| 模型权重 | 执行侧模型 | 加载后供多轮执行及多个请求复用 |
| KDA 递推/卷积状态、稀疏注意力历史 | 执行侧缓存张量 | 模型计算时读写，按请求状态索引或位置映射访问 |

GLM 的 KDA 路径读取执行元数据中的状态索引，据此取用和更新递推、卷积状态；稀疏索引路径则接收序列长度、块表和槽位映射。[C20][C21] 所以「缓存管理」既包含存储的分配与回收，也包含张量布局、元数据构造和实际读写，实现分布在多个组件。

执行计划下发以后，结果仍要返回引擎：Scheduler 产生 `SchedulerOutput`，Executor 把操作交给 Worker/Runner，执行侧完成计算和采样后以 `ModelRunnerOutput` 返回请求与结果映射，引擎据此推进请求，形成下一轮调度依赖的新状态。[C14][C15][C16] 同一批次完成计算后，各请求可以有不同的生命周期变化，具体数组和轮次见[并发请求](concurrent-requests.md)。

最后，**仓库**说明实现代码来自哪里，**组件**说明一组对象或接口承担什么职责，**进程**说明这些对象运行在哪个独立执行环境里——这是三个不同的划分。多进程执行器会把 Worker 放入独立进程，其他执行方式可以有不同安排。Ascend 的配置处理会影响 Worker 选择，补丁入口也可能调整平台侧或 Worker 侧行为。[C4][C10] 因此定位源码时，先找到维护该状态的组件，再检查当前配置选中的实现、注册和补丁；不能仅凭「调度属于上游」「执行属于 Ascend」这类概括断定实际路径。
