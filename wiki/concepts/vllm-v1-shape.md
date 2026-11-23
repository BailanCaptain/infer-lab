---
id: vllm-v1-shape
title: vLLM V1 的形状：请求、调度计划和执行结果怎样在组件之间循环
type: concept
summary: >-
  vLLM V1 把推理服务拆成前端、EngineCore、Worker 三类角色：前端管文字与分词，EngineCore 每步排定调度计划并更新进度，Executor
  驱动各卡 Worker 执行前向与采样。本页先走通标准 Qwen3-8B 的三角色主循环，再对照历史 GLM 双机 20 进程跨机协同。
aliases:
  - vLLM 的形状
  - vLLM V1 架构
  - vLLM 进程结构
  - AsyncLLM
  - Executor
  - 执行器
  - SchedulerOutput
  - 架构总览
  - ModelRunnerOutput
  - EngineCoreRequest
  - EngineCoreOutputs
chapters:
  - '10'
order: 10
sources:
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L280-L415'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L637-L695'
  - 'vllm@0fc695fc:vllm/v1/engine/__init__.py#L83-L239'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L95-L222'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L236-L317'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L443-L473'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L484-L598'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1223-L1275'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L495-L506'
  - 'vllm@0fc695fc:vllm/v1/executor/abstract.py#L37-L130'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L845-L890'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L307-L400'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L495-L510'
  - 'vllm@0fc695fc:vllm/v1/executor/uniproc_executor.py#L45-L96'
  - 'vllm@0fc695fc:vllm/v1/worker/worker_base.py#L39-L159'
  - 'vllm@0fc695fc:vllm/v1/core/sched/output.py#L31-L241'
  - 'vllm@0fc695fc:vllm/v1/outputs.py#L231-L267'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1125-L1236'
  - 'vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L70-L81'
  - 'vllm@0fc695fc:vllm/v1/engine/exceptions.py#L9-L13'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L662'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L505-L525'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L599-L667'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L748-L763'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2345-L2371'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L20
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2043-L2051'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L67-L134'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L611-L679'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L653-L721'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L746-L816'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1238-L1246'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L839-L841'
  - 'vllm@568afb3a:vllm/v1/engine/core.py#L576-L606'
  - 'vllm@98dff2a8:vllm/v1/engine/core.py#L597-L627'
  - 'https://docs.vllm.ai/en/v0.23.0/design/arch_overview/'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1945'
  - >-
    raw:sha256-ab2bbd77ec992e0d762bbf590be554959f66a50bb412382e5dc353b4c83f4ab2.md#L1-L2283
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/worker/worker.py#L784-L800
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L589-L628'
  - >-
    vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L42
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1354-L1362'
  - 'vllm-ascend@7d825229:vllm_ascend/device/hardware_profile.py#L283-L343'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L491-L509'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L757-L835'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/model.py#L839-L853'
  - 'vllm@84030bbe:vllm/v1/engine/core.py#L589-L628'
  - 'vllm-ascend@baa023ad:vllm_ascend/device/hardware_profile.py#L255-L315'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L26-L51'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L483-L501'
  - 'vllm@ba15685a:vllm/v1/engine/core.py#L709-L753'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1365-L1375'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L42'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L498-L520'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L774-L820'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1570-L1580'
  - 'vllm-ascend@8d6180e2:vllm_ascend/mrv2_utils.py#L29-L65'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L589-L618'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L894-L935'
relations:
  - to: one-request
    kind: builds-on
    note: 主线七站的形状、字节和块数都在那一页；本页讲七站背后是哪几个组件在循环
  - to: concurrent-requests
    kind: builds-on
    note: 多条请求时同一个循环怎样装下一整批、结果怎样按请求拆回
  - to: request-call-chain
    kind: builds-on
    note: 每个组件落在哪个进程、从哪个函数进、走哪条通道
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 循环开始之前，Worker 怎样起设备、装权重、建缓存池
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 计划里的块号从哪个池子借、请求结束时怎样还
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-65fbc007fb1114267e26e4c02bbadeb4e41c414f8ae919ab8f18a6ca052b4e13.md
  - >-
    raw/sha256-ab2bbd77ec992e0d762bbf590be554959f66a50bb412382e5dc353b4c83f4ab2.md
---

## vLLM 怎样把一条请求变成一步一步的计算？

vLLM V1 把推理服务拆成三类角色，绕成一个循环：**前端**把文字变成 token 编号、再把新 token 变回文字；**EngineCore**（引擎核心）记着每条请求算到了哪里，每一步排出一份**调度计划**；**Worker**（每张卡一个的执行者）按计划在卡上做前向和采样，把**执行结果**交回 EngineCore 更新进度，EngineCore 接着排下一步。这个循环每转一圈叫**一步**（step）：排一次计划，再执行计划中的计算。处在生成阶段的请求，被排上且正常完成采样时会得到新 token；等待、被抢占或被取消的请求不保证这一圈有输出。

这样分工，前端收请求、引擎排计划与设备计算可以交叠。代价是分到不同进程后，要把交接内容编码成消息、经过队列传递，并在各处保存和更新同一请求的相关状态；不是把函数拆开就没有成本。哪些角色实际另起进程，见[引擎进程](engine-processes.md)。

先用一张等距立体拆解图建立三类角色的空间分工：左侧 API Server 管文本与分词，中央 EngineCore 维护调度队列，右侧 NPU Worker 就地操作常驻 HBM 的权重与 KV cache，三者之间只过轻消息管道：

```wiki-diagram
file: vllm-v1-plate-cutaway
```

图中三个角色各管一件事：

- **前端**：接 HTTP 请求，套聊天模板，用分词器把文字切成 token 编号，包成一条请求消息交给 EngineCore；结果回来时做反分词，按流式格式一段段吐回客户端。前端里负责这件事的对象叫 AsyncLLM（异步引擎接口：一边收新请求，一边在后台收结果）。进门这几步各做什么、在哪里拒绝请求，见[API server 入口](api-server-entry.md)。
- **Scheduler**（调度器）：在 EngineCore 里，每一步决定「这一步算哪些请求、每条算几个 token、新借哪些 KV cache 块」。KV cache 是每层为已经算过的位置留下的历史，下一步的注意力要读它；它在卡上按块存放，Scheduler 手里只记块的编号。
- **Executor**（执行器）：也在 EngineCore 里，只负责传话：把同一份计划发给它管的每个 Worker，再把结果收回来。它不排调度。
- **Worker**：每张卡一个。收到计划后，里面的 NPUModelRunner（昇腾版的 model runner，负责把计划翻成张量、组织前向和采样）准备好这一步的输入，跑模型前向，采样出新 token。权重和 KV cache 的张量都在卡上，只有 Worker 碰得到。
- **按结果更新进度**：还是 Scheduler，把新 token 追加到各条请求上，判断谁该停下，然后开始排下一步。

图里右侧只画出了一张卡上的 Worker 剖面；多卡部署时，其余 Worker 收到的是同一份调度计划，Worker 的个数由并行配置决定。

不要把「V1 引擎」和「V1 Model Runner」混为一谈，二者属于两个正交层次：V1 引擎规定请求如何经由前端、EngineCore 与 Worker 循环推进；Model Runner 则是 Worker 内部准备输入张量、驱动前向与组织输出的具体实现。在 `v0.30.0` 主基线中，默认仍运行第一代 `NPUModelRunner`（MRV1），显式设置 `VLLM_USE_V2_MODEL_RUNNER` 才会切换到第二代（MRV2），并发批次配置也会据此区分；到了 `main` 分支，MRV1 已退役并全量切换至 `worker/v2/`（MRV2），但外层的 V1 引擎循环本身保持不变。因此，单凭「V1 引擎」这个名字无法断定执行侧跑的是哪一代 Runner，必须结合版本与执行侧开关核对。

由此可见，同一条请求在三类角色手里的形态各有侧重：**前端处理文本与流式收发，EngineCore 维护调度账本，Worker 专管卡上张量计算。** 本页纯文本例子中，EngineCore 主要记录 token 编号、已算位置数和块号，Worker 再把计划展开为张量行；但这一分工不意味着跨边界消息只能传整数——请求同样可以携带预计算的嵌入向量或多模态特征资料，返回消息也能携带池化张量。阅读源码时，最可靠的判据是看这段代码在「安排请求进度」还是在「执行模型计算」。

## 为什么拆成三种角色？代价在哪？

三件事卡在不同的地方，塞在一起会互相拖住：

- **前端**要同时挂着很多网络连接，时间主要花在等收发上；
- **EngineCore** 要尽快把下一步排出来，最怕被别的事卡住；
- **Worker** 大部分时间在等卡算完。

分开以后，前端收新请求的同时，EngineCore 可以排下一步，Worker 可以算这一步。更重要的是，**重张量留在卡上不动，跨边界只传轻账本**：以 `v0.30.0` 标准主基线下的 **Qwen3-8B**（BF16 权重约 `15.2 GiB`）为例，单卡 `TP=1` 启动后权重与 KV 池常驻 NPU HBM，EngineCore 交给 Worker 的每步调度计划只包含请求 ID、token 编号、采样参数、本步 token 计数与新借块号，消息体积微乎其微。

代价有三笔：

1. **跨边界的东西都要打包。** 前端与 EngineCore 之间走进程间 ZMQ 消息，EngineCore 与多卡 Worker 之间走共享内存广播队列（通道细节见[进程之间的四条通道](request-call-chain.md#进程之间的四条通道)）。消息按约定组织字段，不共享对方进程内的请求对象；纯文本路径主要传编号、计数与参数，嵌入输入或池化输出路径则另计张量消息开销。
2. **同一份请求资料存两处，后续只发差量。** 请求首次被调度时，计划携带全部资料（提示词 token 编号、采样参数、初始块号），Worker 缓存在本地持久批次里；之后每步只发变化量（新借块号与已算进度）。请求结束时，EngineCore 把编号放进下一份计划的 `finished_req_ids`，Worker 据此清理本地缓存。
   - **边界提醒**：`CachedRequestData.new_token_ids` 仅在流水线并行（PP）下传递新增 token 编号，非 PP 场景下为空，还原当轮完整输入须把差量计划与 Worker 本地缓存合起来看。
3. **每一步都要跨两次边界。** 计划往下走一次，结果往上走一次。开启异步调度后，相邻两步重叠执行，把跨边界等待藏到前向后面（见[异步调度](async-scheduling.md)）。

本页只讲组件分工和这个循环。相邻的几个问题各有专页：

| 想弄清的问题 | 去哪一页 |
|---|---|
| 这些角色各在哪个进程、双机上一共有几个进程 | [引擎进程](engine-processes.md) |
| 每一站从哪个函数进、走哪条通道、报错时停在哪 | [请求调用链](request-call-chain.md) |
| 哪些部件换成了昇腾的实现、从哪几处接进来 | [vllm-ascend 如何接入 vLLM](vllm-ascend-overview.md) |
| 循环开始前，Worker 怎样起设备、装权重、建缓存池 | [NPUWorker 启动](npu-worker-lifecycle.md) |

计划里的块号从哪个池子借、什么时候还，见 [KV 块分配](vllm-kv-block-allocation.md)。

## EngineCore 的循环每转一圈做什么？

直觉图里那条「下一步」的虚线，在源码里是 EngineCore 进程主线程上一个不停转的循环（**忙循环**，busy loop）：没有请求要算时停在输入队列上等；有，就跑一步。站在组件分工的角度，一步只有下面几个动作，圈里的数字是[一条请求](one-request.md)的主线七站：

```wiki-diagram
file: vllm-v1-shape-loop
```

①⑦ 在前端进程，②⑥ 在 EngineCore 进程，③④⑤ 在每个 Worker 进程。

1. **② 排计划。** Scheduler 排出这一步的调度计划，怎样排见 [Scheduler](vllm-scheduler.md)。
2. **两次调用。** Executor 先让每个 Worker 做 ③ 准备输入和 ④ 逐层前向，再让它们做 ⑤ 采样；本部署正常生成一步的结果只由 0 号 Worker 交回；PP 或 KV connector 等配置的回传规则见[引擎进程](engine-processes.md)。
3. **⑥ 按结果更新。** Scheduler 把新 token 追加到各条请求上，判断停止条件；结束的请求把块号还回池子，编号记进结束名单。
4. **⑦ 送回前端。** 新 token 编号经 EngineCore 进程里的后台线程发回前端。

为什么拆成两次调用、两次之间 EngineCore 顺手做什么、回话为什么只读一份，见[一步之内：EngineCore 给 worker 发两次调用](request-call-chain.md#一步之内enginecore-给-worker-发两次调用)。本部署按自动判定打开了异步调度：EngineCore 不等这一步的结果就先排下一步，相邻两圈叠在一起；循环走哪条分支见同一节，占位怎样记账见[异步调度](async-scheduling.md)。这个循环本身怎样迭代，见 [EngineCore](vllm-engine-core.md)。

## 两道边界上，每一圈交接什么？

把三类角色的跨线载荷与三种执行拓扑并排对照，整个 V1 架构就是「重权重与 KV 张量留卡不动，轻账本与差量编号跨线流转」：

```wiki-diagram
file: vllm-v1-shape-fig-separation
```

| 边界与方向 | 消息类型 | 携带载荷（纯文本主干） | 关键边界规则 |
|---|---|---|---|
| **边界 1 下行**（前端 → EngineCore） | `EngineCoreRequest` | 请求 ID、提示词 token 编号、采样参数、可选指定 DP 组 | 多数不指定 DP 组，由前端按负载打分选组（见 [Data parallel](data-parallel.md)）；**两边都不传文字** |
| **边界 1 上行**（EngineCore → 前端） | `EngineCoreOutputs` | 每条请求本步的新 token 编号，结束时附结束原因 | 分词、增量反分词与跨 token 停止串匹配只在前端做；EngineCore 另载分词器仅用于编译结构化输出语法表 |
| **边界 2 下行**（EngineCore → Worker） | `SchedulerOutput` | **首步 `scheduled_new_reqs`**：完整资料；**续步 `scheduled_cached_reqs`**：仅发新借块号与已算进度；**收尾 `finished_req_ids`**：待删编号；另含本步 token 计数与 **`scheduled_spec_decode_tokens`**（同步投机传上步取回的草稿 token 编号，异步调度可传占位、实际候选留在 Worker） | 此线同时是**责任边界**——过线后只定「算哪些 token、写哪些块」，卡上排布与通信归 Worker（`vllm-ascend` 主要接在线下，见[五个扩展点](vllm-ascend-overview.md#两边各管什么五个扩展点)） |
| **边界 2 上行**（Worker → EngineCore） | `ModelRunnerOutput` | 本步请求列表、批次行映射、每条请求新采样出的 token 编号 | 投机解码下每条请求单步可交回多个 token；常规单组仅由 TP0（output rank）交回 |

**夹在中间的 Executor 只传话，不排调度。** 它按方法名驱动 Worker 执行起设备、加载模型、报规格、查显存、建缓存、预热、前向、采样与取回草稿 token 等调用。正常生成一步主要调用前向与采样（同步投机另增取回草稿，空步与池化走各自返回分支）。普通 Ascend 配置下默认三选一（完整规则见[executor 决定 Worker 是不是独立进程](engine-processes.md#executor-决定-worker-是不是独立进程)）：

- **单卡 `TP=1`**：默认单进程 `UniprocExecutor`，Worker 住在 EngineCore 进程内，边界变为进程内函数调用；
- **多卡**：默认多进程 `MultiprocExecutor`，每卡一进程，计划写进共享内存广播队列 1 次供全体同读；
- **Ray 集群**：也可由 Ray 托管 Worker。在 DP+MoE 部署里，若本组本步无请求而他组在跑，Executor 改发 `dummy_batch` 让本组陪着进出 MoE 通信（见 [Data parallel](data-parallel.md)）。

## 哪些东西启动时建好，哪些每一圈都在变？

纯文本每步之所以只传轻账本，是因为重资源在接请求前已全部就位。启动按四步收敛：先建 Executor 拉起 Worker 装本卡权重 → 收集每层缓存规格与试跑后剩余显存 → 按全局最小块数一次切出 KV 张量池并预热录图 → 最后才建 Scheduler 接管块号池（逐站细节见 [NPUWorker 启动](npu-worker-lifecycle.md)，双机切块数见[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)）。

缓存规格由每一层模型自己上报。以 GLM 稀疏 MLA 为例，昇腾注意力层自己持有本层 KV 张量，并向引擎报出块长与每位置向量宽度，引擎收齐后算出单块字节数。服务就绪后，每圈只改请求进度、批次输入与历史状态；权重常驻复用，请求结束只归还块号，新请求无需重装模型。因此 KV cache 天然横跨两边——EngineCore 管整数块号，Worker 靠 [block table](block-table.md) 把位置换算为卡上槽位。

## vllm-ascend 接在这个形状的哪几处？

vllm-ascend 沿用上游循环，通过替换 Worker 一侧实现并局部改写引擎侧函数接入：平台对象将 Worker 定为 `NPUWorker`；`NPUWorker` 创建继承自上游的 `NPUModelRunner`（只覆写昇腾特例，其余转调上游）；GLM 模型与注意力/MoE 层则完整落在昇腾包内。**进程边界不等于两仓分界**：EngineCore 里也跑着昇腾全局 patch 改过的调度与块分组函数，Worker 里也大量复用上游逻辑（见 [vllm-ascend 如何接入 vLLM](vllm-ascend-overview.md) 与[逐进程打补丁](engine-processes.md#补丁和配置为什么要每个进程各做一遍)）。

## 标准主干走读：Qwen3-8B 的三角色极简主循环

在 `v0.30.0` 主基线下，单卡（`TP=1`）或机内多卡（`TP=2/4`）部署 **Qwen3-8B** 时，V1 循环最干净：

- **角色与进程形态**：单卡 `TP=1` 默认用 `UniprocExecutor`（API Server + 内置 Worker 的 EngineCore，共 2 进程）；多卡 `TP=N` 切 `MultiprocExecutor`（1 前端 + 1 EngineCore + $N$ 独立 Worker），**无 DP 协调器，也无跨 DP 空批次陪跑**。
- **一步闭环**：API Server 分词入队后，Scheduler 从单一 `128-tok` `BlockPool` 借块排步。Executor 顺次下发 `execute_model`（全 36 层 GQA 共用 1 份 `AscendMetadata`）与 `sample_tokens`（每条 1 个 `next_token_id`，无 MTP 草拟），仅 `output_rank` 回传结果。Scheduler 更新进度与判停，API Server 流式推给客户端；空闲时 EngineCore 直接阻塞等新消息。

扩大到跨机 DP + EP 的 MoE 旗舰部署后，才叠出多 EngineCore、DP 协调器、空批次陪跑与 MTP 验证——下面用历史 GLM 双机 20 进程全案对照。

## 放到 GLM 双机：R1 的一个 token 绕一圈

从这里转入例外 B 历史绑定算例（[部署前提](glm-5-3-flash-two-node.md#部署前提)）：两台机器各 8 卡，每台是一个 DP 组（组内 TP8、跨机 EP16）；所列主要语言权重每卡约 `20.58 GiB` 常驻 HBM（视觉塔、MTP 旋转矩阵与量化辅助张量另计，见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)）。全集群共 **20 个角色进程**（node0：1 API server + 1 DP 协调器 + 1 EngineCore + 8 Worker；node1：1 EngineCore + 8 Worker，完整清单见[20 个进程账](engine-processes.md#双机部署里一共有哪些进程)）。

示例请求 R1 取教学设定的 4 个提示词 token（真实请求套模板更长，见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)），沿主循环绕一圈的七步如下：

| 步序与角色 | R1 在本步的流转动作 | 延伸出处 |
|---|---|---|
| **1. 前端**（node0 API server） | 切出 4 个 token 编号并打包采样参数；两组皆空、打分均为 0，R1 落入 DP0 | [第 1 站](one-request.md#第-1-站-入口从-http-到-node0-的引擎) |
| **2. 排计划**（DP0 Scheduler） | 首次调度带完整资料：算 4 个 token、按 5 缓存组新借块号、无候选 token | [R1 借还块](vllm-kv-block-allocation.md#放到-glm-双机r1-从借块到还块) |
| **3. 广播 8 卡**（DP0 Executor） | 计划写共享内存 1 次，node0 8 个 Worker 同读并拼出 `4 × 4096` 隐藏输入；各卡差别在权重分片（每卡 8 KDA 头、8 MLA 头、18 路由专家） | [第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker) |
| **4. node1 陪跑**（DP1 8 卡） | DP1 零请求，但 288 专家分在 16 卡，DP1 每步跑 `dummy_batch` 一起进出 EP 通信 | [Data parallel](data-parallel.md) |
| **5. 前向与采样**（Worker） | 第 1 次调用前向，第 2 次采样出 `y₀` 并由 MTP 猜 3 个候选（异步下候选留 Worker）；仅 node0 的 0 号 Worker 交回 `y₀` | [第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个) |
| **6. 更新进度**（DP0 Scheduler） | 追加 `y₀`；未结束则下一步排 `1 + 3 = 4` 个 token 一起验证 | [一条请求](one-request.md) |
| **7. 回到前端**（node0 API server） | 增量反分词并流式推送；单 decode 步最多交回 4 token（1 确定 + 最多 3 接受），前端跟不上时会合并多步故片段无 4 token 上限 | [流式合并](streaming-output.md#前端跟不上时几步的文字并成一段) |

R1 结束时，手里块号一次还回 DP0 块池（见 [R1 借还块](vllm-kv-block-allocation.md#放到-glm-双机r1-从借块到还块)），编号进 `finished_req_ids` 随下份计划通知 node0 8 卡删缓存；DP0 运行请求数减 1 并影响下条请求选组。

绕完这一圈，R1 在三类角色手里的样子：

| 在哪 | R1 是什么 |
|---|---|
| 前端（node0 的 API server） | 一段文字，变成 4 个 token 编号；外加一个等结果的输出队列和一个增量反分词器 |
| EngineCore（DP0） | 一条请求记录：已算 0 个位置、这一步算 4 个、手里一串块号，从等待队列进入运行队列 |
| node0 的 8 个 Worker | 各自缓存一份 R1 的资料；这一步的输入是 4 个 token 编号、位置 0 到 3，以及每个位置写进缓存哪一格 |

多条请求时循环不变，只是一份计划里有多条请求，执行结果再按请求拆回去。13 条请求拼成一步的例子见[多条请求](concurrent-requests.md#示例场景-m-与变体-m)；两条请求怎样拼成一个输入，小例子见 [A/C 第三轮如何拼接](prepare-inputs-flow.md#ac-第三轮如何拼接)。

## 常见误解

- **「调度器直接操作模型张量。」** 不会。模型、权重和 KV cache 的张量由 Worker 管理；调度器主要管理配置、请求计数和块号。单进程执行器会把 Worker 放在 EngineCore 同一进程里，但不改变这项职责分工。
- **「Executor 在做调度。」** 不做。调度在 Scheduler 里，在 Executor 被叫到之前就做完了；Executor 只把计划发出去、把结果收回来。
- **「这几个进程靠多线程一起跑。」** 不是。前端靠一个能同时挂着很多网络连接的事件循环（asyncio），跨进程靠发消息；EngineCore 的主线程是一圈一圈转的普通循环，旁边两个后台线程只管收发消息。同名的「异步调度」是第三件事：循环照样一圈圈转，只是不等上一步的结果就排下一步，本部署按自动判定打开。
- **「Worker 一定是单独的进程。」** 不一定。只有一张卡时默认用单进程执行器，Worker 就住在 EngineCore 进程里。
- **「8 个 Worker 各算一部分 token。」** 不是。同一个 DP 组的 8 个 Worker 拿到同一份计划、摊出同样的输入；真正分开干活是在每一层里面：[TP](tensor-parallel.md) 把注意力的头和矩阵切给 8 张卡，[EP](expert-parallel.md) 把专家分到 16 张卡。
- **「每一步都把请求的全部历史重发给 Worker。」** 不会。本页普通文本请求的完整资料在第一次调度时发送，之后只发变化量；流式追加输入等路径需另看更新规则。历史的 KV cache 一直留在卡上。

- **「一个 Worker 对应一台服务器，一台机器就是一份完整模型。」** 都不对。一个 Worker 对应一张卡；一台机器是一个 DP 组，288 个路由专家分在两台机器的 16 张卡上，两台合起来才是完整的模型。

## 对照源码

### 怎么开

这个形状本身不是开关：vLLM 0.23.0 只有 V1 引擎。影响它长什么样的是下面几项，官方双机命令见部署页的[怎么开](glm-5-3-flash-two-node.md#怎么开)：

- **用哪种 Executor**：`--distributed-executor-backend`。本部署 `world_size_across_dp=16`，未指定时选 `mp`；完整默认规则还包括 Ray placement group、TPU SPMD 和 CUDA 多节点等条件，统一见[引擎进程的执行器规则](engine-processes.md#怎么开)。
- **每台机器起几个 EngineCore**：由 DP 参数决定；node1 用 `--headless` 只起引擎、不起前端，见[引擎进程](engine-processes.md)。
- **批次队列**：本部署使用 V1 runner、PP=1 且启用异步调度，`max_concurrent_batches=2`。V2 runner 配合异步调度时则是 PP+1；完整公式见 [EngineCore](vllm-engine-core.md#怎么开)。大于 1 时用 `step_with_batch_queue`，否则用 `step`。
- **Worker 与 Runner**：`worker_cls` 为 `auto` 时，平台选 `vllm_ascend.worker.worker.NPUWorker`；`VLLM_USE_V2_MODEL_RUNNER` 不设时用 v1 的 `NPUModelRunner`。

- **怎样确认**：EngineCore 启动时打印一行 `Initializing a V1 LLM engine (v…) with config: …`，版本号和完整配置都在里面。

### 会报什么错

| 报错 | 在哪一侧 | 说明什么 |
|---|---|---|
| `EngineCore encountered an issue. See stack trace (above) for the root cause.` | 前端（`EngineDeadError`） | EngineCore 已经退出，前端无法恢复；真正的原因在上方 EngineCore 或 Worker 的 traceback 里 |
| `RPC call to execute_model timed out.` | EngineCore 的 Executor | Worker 在执行等待预算内没有回话；本 GLM 配方为 3000 秒，`sample_tokens` 使用同一配置但单独计时；上游默认与 Ascend 改写见[超时参考](request-call-chain.md#怎么开) |
| `Worker failed with error '…', please check the stack trace above for the root cause` | EngineCore 的 Executor | 回话的那个 Worker 执行时抛了异常，引号里是它的错误信息 |
| `Worker proc … died unexpectedly, shutting down executor.`，随后 `Executor failed.` | EngineCore 的 Executor | 某个 Worker 进程直接退出，Executor 标记失败，之后的调用全部拒绝 |

先按[出问题时判断它停在哪一站](request-call-chain.md#出问题时判断它停在哪一站)定位到进程，再看那个进程的 traceback。

### 开销和什么时候别开

这个形状关不掉，能选的是 Executor 和异步调度：

- **跨边界的开销**：本部署正常生成一步会广播前向与采样两次调用，指定 Worker 分别响应每次调用；前向返回空值也有响应，最终 token 结果只收一份。同步投机路径还可能增加取回草稿的调用。前端和 EngineCore 之间的消息用 msgpack 打包。Worker 缓存请求资料、计划只发变化量，就是为了压小这笔开销。

- **单卡**：默认就是单进程执行器，没有单独的 Worker 进程和广播队列，不需要改。
- **Ray**：只在已经用 Ray 管理机器时才选；官方双机部署是每台机器各起引擎、各用多进程执行器。
- **异步调度**：把等待藏到前向后面，代价是计划要先用占位数记账；什么时候该关，见[异步调度](async-scheduling.md)。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`，GLM 专用镜像 `db701c1f` 同属此分支期并含 `models/glm5_next.py`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）。**`v0.30.0` 与 `main` 的 Model Runner V2 仍运行在 V1 引擎循环之内**：EngineCore 依然承担调度、执行、采样与更新，区别在于 `v0.30.0` 默认走 MRV1（显式设置 `VLLM_USE_V2_MODEL_RUNNER` 切 MRV2），而 **`main` 已移除 `model_runner_v1.py`，全量切换至 `worker/v2/`（MRV2）**。

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| 上游普通文本 `step` 循环 | 排计划 → `execute_model` → 无直接结果时 `sample_tokens` → 处理取消 → 更新 | 顺序相同；排计划新增 prefill 节流参数，供 DP 引擎使用 | 保留同一循环顺序（`core.py#L589-L628`） | 保留同一循环顺序；抽离 `_wait_for_output` 并挂载权重版本 `_attach_weight_version`（`core.py#L709-L753`） |
| 平台选定的 Worker 类 | `NPUWorker`（开 Xlite 图时 `XliteWorker`，310P 另选） | 同 `v0.23.0` | 由 `HardwareProfile.default_worker_cls` 给出（`platform.py#L1365-L1375`）：标准 A2/A3/A5 为 `NPUWorker`，310P 另选；Xlite 须档案支持 | 延续 `HardwareProfile.default_worker_cls` 与 Xlite 判定（`platform.py#L1570-L1580`） |
| Worker 的前向与采样入口 | `execute_model` + `sample_tokens`（`worker.py#L611-L679`，镜像 `db701c1f` 从 L599 起） | 一致（`worker.py#L653-L721`） | 一致（`worker.py#L774-L820`）；返回区分 pooling、PP 与 KV connector | 一致（`worker.py#L894-L935`）；非末尾 PP 节点统一走 V2 返回分支 |
| Model Runner 选择 | 环境变量未设时默认 MRV1 `NPUModelRunner`；显式设置时切 MRV2 | 一致 | `patch_use_v2_model_runner.py#L18-L42` 未设仍默认 `False`（MRV1）；`init_device` 按开关构造 MRV1 或 MRV2（`worker.py#L498-L520`） | **已移除 MRV1**；`mrv2_utils.py#L29-L65` 固定返回 `True`（显式 `VLLM_USE_V2_MODEL_RUNNER=0` 报错），`init_device` 直建 `worker/v2/model_runner.py`（纯多模态编码器走 `MMEncoderModelRunner`，`worker.py#L589-L618`） |
| GLM-5.3-Flash 模型代码 | 维护分支无（专用镜像 `db701c1f` 在 `models/glm5_next.py`） | 无 | `models/glm5next/` 目录，文本类 `Glm5NextForCausalLM` | 延续 `models/glm5next/` 与 `Glm5NextForCausalLM` |

`v0.30.0` 中非末尾 PP 成员发送中间张量后仍按 Model Runner 版本分流（V2 直接返回空值，V1 继续处理需要上报的 KV connector 结果）；`main` 退役 MRV1 后全量归入 V2 路径。

prefill 节流并非只挡住新请求：满足混合批次等条件时，已经在运行的 prefill chunk 也会暂缓。完整条件与代价见[调度器](vllm-scheduler.md)，不能仅从 step 的一个布尔入参推导“每隔固定步数才允许新 prefill”。


### 源码位置

| 要核对什么 | 固定源码位置 |
|---|---|
| 前端收请求、登记输出队列、交给 EngineCore | `vllm@0fc695fc:vllm/v1/engine/async_llm.py#L280-L415` |
| 前端在后台收结果、交给输出处理器 | `vllm@0fc695fc:vllm/v1/engine/async_llm.py#L637-L695` |
| 第一道边界的两种消息 | `vllm@0fc695fc:vllm/v1/engine/__init__.py#L83-L239` |
| EngineCore 先建 Executor、再建缓存、最后建 Scheduler；批次队列 | `vllm@0fc695fc:vllm/v1/engine/core.py#L95-L222`；`#L236-L317` |
| 一步：`step` 与 `step_with_batch_queue`；队列长度 | `vllm@0fc695fc:vllm/v1/engine/core.py#L443-L473`；`#L484-L598`；`vllm/config/vllm.py#L495-L506` |
| 忙循环：等输入、跑一步、放结果 | `vllm@0fc695fc:vllm/v1/engine/core.py#L1223-L1275` |
| Executor 的种类与默认选择；建缓存后接着预热 | `vllm@0fc695fc:vllm/v1/executor/abstract.py#L37-L130`；`vllm/config/parallel.py#L845-L890` |
| 多进程 Executor：广播、只收一份回话、超时与失败 | `vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L307-L400`；`#L495-L510` |
| 单进程 Executor 直接持有 Worker | `vllm@0fc695fc:vllm/v1/executor/uniproc_executor.py#L45-L96` |
| Worker 接口里的常用调用 | `vllm@0fc695fc:vllm/v1/worker/worker_base.py#L39-L159` |
| Executor 发给 Worker 的其他调用：跑空批次、取回草稿 token | `vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L331-L337` |
| DP 组本步没执行、全局仍在运行时改跑空批次 | `vllm@0fc695fc:vllm/v1/engine/core.py#L1886-L1898`（`DPEngineCoreProc.run_busy_loop`，整段 `#L1869-L1945`） |
| 第二道边界的两种消息 | `vllm@0fc695fc:vllm/v1/core/sched/output.py#L31-L241`；`vllm/v1/outputs.py#L231-L267` |
| Worker 缓存请求资料、按结束名单删除 | `vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1125-L1236`；`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L748-L763` |
| EngineCore 为结构化输出加载分词器 | `vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L70-L81` |
| 前端的 EngineCore 失效报错 | `vllm@0fc695fc:vllm/v1/engine/exceptions.py#L9-L13` |
| 平台选 Worker、Worker 建 Runner、两次调用、前向后 logits 暂存 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L662`；`vllm_ascend/worker/worker.py#L505-L525`、`#L599-L667`；`vllm_ascend/worker/model_runner_v1.py#L2345-L2371` |
| v1 / V2 Runner 的选择 | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L20` |
| GLM 稀疏 MLA 的实际执行路径与缓存规格 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2043-L2051` → `vllm_ascend/ops/indexer_kpool_mla.py#L67-L134` |
| 三版 Worker 的两次调用 | `vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L611-L679`；`vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L653-L721`；`vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L746-L816` |
| main 的 Worker 选择与 GLM 模型类 | `vllm-ascend@baa023ad:vllm_ascend/platform.py#L1238-L1246`；`vllm_ascend/models/glm5next/model.py#L839-L841` |
| 上游 v0.26 与历史 v0.29 的一步 | `vllm@568afb3a:vllm/v1/engine/core.py#L576-L606`；`vllm@98dff2a8:vllm/v1/engine/core.py#L597-L627`；当前 `v0.30.0` / `main` 对照见追加来源 |

**证据索引。** 三类角色的划分、EngineCore 先建 Executor 再建缓存和 Scheduler、忙循环与一步的顺序见 [C4][C6][C8][S36]；批次队列与异步调度下的回环见 [C7]；两道边界上的消息、完整资料只发一次、结束名单、执行结果用列表以便序列化见 [C3][C16][C17][C18]；前端登记输出队列、EngineCore 为结构化输出加载分词器见 [C1][C19]；Executor 的种类、默认选择、按方法名广播、只收一份回话、DP 组空闲时改跑空批次、超时和失败报错见 [C10][C12][C37]；启动时查询缓存规格、稀疏 MLA 的实际执行路径见 [C5][C27][C28]；昇腾选 Worker、建 Runner 共同对应来源 21、22 [C22]，两次调用见 [C23]；三版差异见 [C30][C31][C34][C35]。

当前四版补证：40、47 是 `v0.30.0` / `main`（及历史候选快照）的完整 step 收尾；41、49 是两版 Runner 开关与限制；42–44、48、50 是硬件档案、Worker 选择和 Runner 构造；45 与既有 32 对照两次调用和 PP 返回分支；46 与既有 33 对照 GLM 文本模型类。相同类名只支持对应职责与命名结论，不代表完整实现相同。

以下几条由源码和主线底稿推出，或属于本页的理解：R1 第一步计划的主要内容是 4 个 token 和新借的块号，取自底稿 01 的 A2 [D]；8 张卡的输入相同、只差权重分片，取自 A3 [D]；一个 decode 步交回 1 到 4 个 token、结束名单随下一份计划通知 Worker，取自 A7 [D]，片段合并的原始证据与说明统一见流式输出页；20 个进程的账取自 A0.1 [D]；R1 的 4 个 token 是教学设定 [A]；「三件事卡在不同的地方」是本页对拆分动机的归纳，源码里没有这句话 [A]。

**实测边界：**

- 跨边界的开销（各次调用的广播与响应、msgpack 打包，最终 token 结果只收一份）在一步里占多少时间：缺实测。
- 上表已按明确的上游与 Ascend 固定提交核对；镜像里实际安装哪一对仍需运行环境记录，不能从代码的版本判断字符串推出，见[部署前提](glm-5-3-flash-two-node.md#部署前提)。

**引擎与 Runner 的边界。** V1 引擎不等于 V1 Model Runner：并发批次配置按 use_v2_model_runner 区分，Ascend Worker 再按这个值构造相应 Runner。固定 GLM 补丁在环境值未设置时返回 False，不能由引擎名称或其他模型教程推定本部署启用了 V2 Runner。选择与构造分别见来源 9、22、26。

Worker 保存跨步请求状态，调度消息更新这些状态后才准备模型输入。固定上游 CachedRequestData.new_token_ids 只用于 PP，不使用 PP 时为空；因此不能只凭这一字段还原全部输入。这是来源 16、18 所列控制流快照的接口条件，不代表所有版本字段都相同。

- 来源 39：vllm-ascend@baa023ad，vllm_ascend/worker/worker.py，L784–L800。
