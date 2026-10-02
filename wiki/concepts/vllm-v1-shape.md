---
id: vllm-v1-shape
title: "vLLM V1 的形状：请求、调度计划和执行结果怎样在组件之间循环"
type: concept
summary: vLLM V1 把推理服务拆成前端、EngineCore、Worker 三类角色：前端管文字，EngineCore 每一步排一份调度计划、拿回结果更新进度，Executor 把计划交给每张卡上的 Worker 执行。本页讲这个循环里各组件的分工、两道边界上交接什么，以及 R1 在双机部署上绕一圈的样子。
aliases: [vLLM 的形状, vLLM V1 架构, vLLM 进程结构, AsyncLLM, Executor, 执行器, SchedulerOutput, 架构总览, ModelRunnerOutput, EngineCoreRequest, EngineCoreOutputs]
chapters: ["10"]
order: 10
sources:
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L280-L415
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L637-L695
  - vllm@0fc695fc:vllm/v1/engine/__init__.py#L83-L239
  - vllm@0fc695fc:vllm/v1/engine/core.py#L95-L222
  - vllm@0fc695fc:vllm/v1/engine/core.py#L236-L317
  - vllm@0fc695fc:vllm/v1/engine/core.py#L443-L473
  - vllm@0fc695fc:vllm/v1/engine/core.py#L484-L598
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1223-L1275
  - vllm@0fc695fc:vllm/config/vllm.py#L495-L506
  - vllm@0fc695fc:vllm/v1/executor/abstract.py#L37-L130
  - vllm@0fc695fc:vllm/config/parallel.py#L845-L890
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L307-L400
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L495-L510
  - vllm@0fc695fc:vllm/v1/executor/uniproc_executor.py#L45-L96
  - vllm@0fc695fc:vllm/v1/worker/worker_base.py#L39-L159
  - vllm@0fc695fc:vllm/v1/core/sched/output.py#L31-L241
  - vllm@0fc695fc:vllm/v1/outputs.py#L231-L267
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1125-L1236
  - vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L70-L81
  - vllm@0fc695fc:vllm/v1/engine/exceptions.py#L9-L13
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L662
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L505-L525
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L599-L667
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L748-L763
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2345-L2371
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L20
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2043-L2051
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L67-L134
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L611-L679
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L653-L721
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L746-L816
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1238-L1246
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L839-L841
  - vllm@568afb3a:vllm/v1/engine/core.py#L576-L606
  - vllm@98dff2a8:vllm/v1/engine/core.py#L597-L627
  - https://docs.vllm.ai/en/v0.23.0/design/arch_overview/
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1945
relations:
  - {to: one-request, kind: builds-on, note: 主线七站的形状、字节和块数都在那一页；本页讲七站背后是哪几个组件在循环}
  - {to: concurrent-requests, kind: builds-on, note: 多条请求时同一个循环怎样装下一整批、结果怎样按请求拆回}
  - {to: request-call-chain, kind: builds-on, note: 每个组件落在哪个进程、从哪个函数进、走哪条通道}
  - {to: npu-worker-lifecycle, kind: builds-on, note: 循环开始之前，Worker 怎样起设备、装权重、建缓存池}
  - {to: vllm-kv-block-allocation, kind: builds-on, note: 计划里的块号从哪个池子借、请求结束时怎样还}
verified: []
evidence: C
contradicts: []
updated: "2026-09-28"
origin: seed
---

## vLLM 怎样把一条请求变成一步一步的计算？

vLLM V1 把推理服务拆成三类角色，绕成一个循环：**前端**把文字变成 token 编号、再把新 token 变回文字；**EngineCore**（引擎核心）记着每条请求算到了哪里，每一步排出一份**调度计划**；**Worker**（每张卡一个的执行者）按计划在卡上做前向和采样，把**执行结果**交回 EngineCore 更新进度，EngineCore 接着排下一步。这个循环每转一圈叫**一步**（step）：排一次计划，每张卡做一次模型前向；处在生成阶段的请求，每一步至少拿到一个新 token。

```wiki-diagram
file: vllm-v1-shape
```

图里的方框各管一件事：

- **前端**：接 HTTP 请求，套聊天模板，用分词器把文字切成 token 编号，包成一条请求消息交给 EngineCore；结果回来时做反分词，按流式格式一段段吐回客户端。前端里负责这件事的对象叫 AsyncLLM（异步引擎接口：一边收新请求，一边在后台收结果）。进门这几步各做什么、在哪里拒绝请求，见[API server 入口](api-server-entry.md)。
- **Scheduler**（调度器）：在 EngineCore 里，每一步决定「这一步算哪些请求、每条算几个 token、新借哪些 KV cache 块」。KV cache 是每层为已经算过的位置留下的历史，下一步的注意力要读它；它在卡上按块存放，Scheduler 手里只记块的编号。
- **Executor**（执行器）：也在 EngineCore 里，只负责传话：把同一份计划发给它管的每个 Worker，再把结果收回来。它不排调度。
- **Worker**：每张卡一个。收到计划后，里面的 NPUModelRunner（昇腾版的 model runner，负责把计划翻成张量、组织前向和采样）准备好这一步的输入，跑模型前向，采样出新 token。权重和 KV cache 的张量都在卡上，只有 Worker 碰得到。
- **按结果更新进度**：还是 Scheduler，把新 token 追加到各条请求上，判断谁该停下，然后开始排下一步。

图里只画了一个 Worker；其余 Worker 收到的是同一份计划，Worker 的个数由并行配置决定。

所以同一条请求在三类角色手里是三种东西：**前端只认文字，EngineCore 只认整数，Worker 才认张量。** 在 EngineCore 里，一条请求是一份记录：已算到第几个位置、这一步要算几个、手里有哪些块号；在 Worker 里，它变成张量里的几行。读源码时最容易迷路的就是这一点：在 EngineCore 的代码里找不到任何张量，在 Worker 的代码里找不到请求的文字，两边都对。

## 为什么拆成三种角色？代价在哪？

三件事卡在不同的地方，塞在一起会互相拖住：

- **前端**要同时挂着很多网络连接，时间主要花在等收发上；
- **EngineCore** 要尽快把下一步排出来，最怕被别的事卡住；
- **Worker** 大部分时间在等卡算完。

分开以后，前端收新请求的时候，EngineCore 可以在排下一步，Worker 可以在算这一步。更重要的是，重的东西不用动：在[官方双机部署](glm-5-3-flash-two-node.md#部署前提)上，每张卡守着 20.58 GiB 的权重（见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)），而 EngineCore 交给 Worker 的第一步计划，主要内容只是「R1 算 4 个 token」和新借的一小串块号，全是整数。计划很轻，权重和 KV cache 一直留在卡上。

代价有三笔：

1. **跨边界的东西都要打包。** 前端和 EngineCore 之间走进程间消息，EngineCore 和 Worker 之间走共享内存里的广播队列，通道细节见[进程之间的四条通道](request-call-chain.md#进程之间的四条通道)。能放进消息的只有编号、整数和参数，不能是「那条请求对象本身」。执行结果要打包送回调度所在的进程，所以源码刻意用列表而不是张量来装新 token。
2. **同一份请求资料存两处。** 一条请求第一次被调度时，计划里带上它的全部资料：提示词的 token 编号、采样参数、块号；Worker 把这些缓存在自己的进程里，之后每一步只发变化的部分：新借的块号、已算到哪里。两边必须始终对得上：请求结束时，EngineCore 把它的编号放进下一份计划的「结束名单」，Worker 看到后才删掉自己那份缓存。
3. **每一步都要跨两次边界。** 计划往下走一次，结果往上走一次。异步调度打开时，相邻两步会叠在一起，把这段等待藏到前向后面，见[异步调度](async-scheduling.md)。

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
2. **两次调用。** Executor 先让每个 Worker 做 ③ 准备输入和 ④ 逐层前向，再让它们做 ⑤ 采样；结果只由 0 号 Worker 交回。
3. **⑥ 按结果更新。** Scheduler 把新 token 追加到各条请求上，判断停止条件；结束的请求把块号还回池子，编号记进结束名单。
4. **⑦ 送回前端。** 新 token 编号经 EngineCore 进程里的后台线程发回前端。

为什么拆成两次调用、两次之间 EngineCore 顺手做什么、回话为什么只读一份，见[一步之内：EngineCore 给 worker 发两次调用](request-call-chain.md#一步之内enginecore-给-worker-发两次调用)。本部署按自动判定打开了异步调度：EngineCore 不等这一步的结果就先排下一步，相邻两圈叠在一起；循环走哪条分支见同一节，占位怎样记账见[异步调度](async-scheduling.md)。这个循环本身怎样迭代，见 [EngineCore](vllm-engine-core.md)。

## 两道边界上，每一圈交接什么？

**第一道：前端和 EngineCore 之间。**

- 往下是一条**请求消息**：请求编号、提示词的 token 编号、采样参数（温度、最多生成几个 token 等），以及指定的 DP 组（多数时候不指定，由前端按负载挑，见 [Data parallel](data-parallel.md)）。
- 往上是每条请求这一步的**新 token 编号**，结束时再带上结束原因。
- 两边都不传文字。把文字切成编号、把编号拼回文字只在前端做；停止字符串（stop string）可能横跨好几个 token，也在前端的增量反分词器里匹配。EngineCore 进程里也会加载一份分词器，但只拿来编译结构化输出的语法表，不处理请求的正文。

**第二道：EngineCore 和 Worker 之间。**

- 往下是**调度计划**（SchedulerOutput）。里面有：第一次被调度的请求的完整资料；已在跑的请求只有变化量（新借的块号、已算到哪里）；每条请求这一步算几个 token 和总数；上一步草拟的候选 token；上一步以来结束的请求编号。
- 往上是**执行结果**（ModelRunnerOutput）：这一步有哪些请求、每条请求在批里排第几行、每条请求新得到的 token 编号。开了投机解码时，一条请求一步可能拿到好几个 token。

这道边界同时是**责任边界**：计划一过线，「这一步算哪些 token、写进哪些块」就定了；Worker 那边只管「在卡上怎么算」：张量怎么摆、用哪个注意力后端、卡之间怎么通信。vllm-ascend 主要就接在这条线的下方，见[两边各管什么](vllm-ascend-overview.md#两边各管什么五个扩展点)。

**夹在中间的 Executor 只传话。** 它按方法名让每个 Worker 执行 Worker 上的某个方法，并不限于一张固定清单。常用的有：起设备、加载模型、报告缓存规格、查剩余显存、按配置建缓存、预热、执行前向、采样、取回草稿 token；DP 部署里，本组这一步没有请求、另一组还在跑时，改发「跑空批次」（dummy batch），让本组的卡陪着进 MoE 层的通信，见 [Data parallel](data-parallel.md)。有请求的一步只用执行前向和采样两种。用哪种 Executor 由配置决定：

- 多卡时默认用**多进程执行器**：每张卡起一个 Worker 进程，一次调用只写进广播队列一次，所有 Worker 读到同一条消息；
- 只有一张卡时默认用**单进程执行器**：Worker 直接住在 EngineCore 进程里，边界还在，只是交接变成了进程内的函数调用；
- 也可以选 Ray 来管 Worker。

各种部署下一共有几个进程、Worker 是不是独立进程，见[executor 决定 Worker 是不是独立进程](engine-processes.md#executor-决定-worker-是不是独立进程)。

## 哪些东西启动时建好，哪些每一圈都在变？

每一步只需要往下传几项整数，是因为重的东西在请求到来之前就建好了。启动顺序是：

1. EngineCore 先建 Executor；Executor 拉起 Worker，每个 Worker 起设备、建自己的 NPUModelRunner、把本卡那一份权重装上卡。
2. EngineCore 问每个 Worker 两件事：模型每一层要在 KV cache 里存什么（**缓存规格**），以及装完权重、用假数据试跑一遍前向以后还剩多少显存。
3. EngineCore 按规格和剩余显存算出能切多少块、怎样分组，再让 Worker 按这个配置在卡上建好 KV cache 张量，然后预热，把几种固定批量的前向录成图。
4. 最后才建 Scheduler；它手里的块池，就是上一步切出来的那些块号。

Worker 在这几步里各做什么、哪一步失败会怎样，见 [NPUWorker 启动](npu-worker-lifecycle.md)；双机上具体切出多少块，见[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)。

缓存规格由模型的每一层自己报。以 GLM 的稀疏 MLA 层为例，实际推理走的是昇腾包里的注意力实现：这一层自己持有本层的 KV cache 张量，并向引擎报出「一个块装多少个位置、每个位置存多宽的向量」。引擎把所有层的规格收齐，才知道一个块号要占多少显存。

服务就绪以后，每一圈改的只有三样：请求的进度、这一步的批次输入、注意力要读写的历史状态。权重一直复用；一条请求结束，只是把它的块号还回池子，别的请求照常跑；新请求到来只改变下一份计划，不需要重新加载模型。

这也说明 KV cache 的管理为什么横跨两边：EngineCore 决定哪些块号分给哪条请求，它手里只有整数；Worker 手里才有块号背后的张量，它按 [block table](block-table.md) 把「第几个位置」换算成「写进哪一块的哪一格」。只看一边，说不清一个位置怎样找到自己的历史。

## vllm-ascend 接在这个形状的哪几处？

循环的形状是上游 vLLM 的，vllm-ascend 没有另造一套，而是换掉 Worker 一侧的实现，再在少数地方改写引擎侧的函数：

- 启动时，昇腾的平台对象把 Worker 类定成 NPUWorker；
- NPUWorker 起设备时建 NPUModelRunner。它继承上游的 GPU 版 model runner，只改需要不同的部分，比如更新缓存的请求资料时，先处理昇腾自己的特例，再调上游那一份；
- GLM 的模型代码在昇腾包里，注意力、MoE 这些层的实现也在那里。

因此**进程边界不等于两个仓库的分界**：EngineCore 进程里也跑着昇腾的代码（全局 patch 换掉的调度相关函数、决定块怎么切的函数），Worker 里也大量复用上游的代码。五个扩展点各管什么，见 [vllm-ascend 如何接入 vLLM](vllm-ascend-overview.md)；补丁为什么要在每个进程各打一遍，见[补丁和配置为什么要每个进程各做一遍](engine-processes.md#补丁和配置为什么要每个进程各做一遍)。

## 放到 GLM 双机：R1 的一个 token 绕一圈

部署沿用[部署前提](glm-5-3-flash-two-node.md#部署前提)：两台机器各 8 张卡，每台机器是一个 DP 组，组内 8 张卡做 TP8，16 张卡一起做 EP16。落到本页的角色上：node0 有 1 个前端（API server）；每台机器各有 1 个 EngineCore，它的 Executor 管本机 8 个 Worker；16 张卡各有 1 个 Worker。再加上 node0 的 1 个 DP 协调器，一共 20 个进程，账见[双机部署里一共有哪些进程](engine-processes.md#双机部署里一共有哪些进程)。

R1 是主线的示例请求，提示词送进引擎时是 4 个 token。这是为演示取的设定，真实请求套上聊天模板要长得多，见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)。沿着循环走一圈：

1. **前端。** node0 的 API server 把 R1 变成 4 个 token 编号，连同采样参数包成一条请求消息。R1 到来时两组都空，打分都是 0，R1 进了 DP0，也就是 node0 的 EngineCore，见[第 1 站](one-request.md#第-1-站-入口从-http-到-node0-的引擎)。
2. **排计划。** DP0 的 Scheduler 给出第一步计划：R1 算 4 个 token，新借一小串块号，没有候选 token。R1 是第一次被调度，计划里带着它的完整资料。块号按缓存组借，KDA 的递推状态和注意力历史借法不同；借几块、怎么算，见 [R1 从借块到还块](vllm-kv-block-allocation.md#放到-glm-双机r1-从借块到还块)。
3. **发给 8 个 Worker。** DP0 的 Executor 把这份计划写进广播队列一次，node0 的 8 个 Worker 读到同样的内容，各自造出同样形状的输入：4 个 token 编号、位置 0 到 3，进模型后是 4 行、每行 4096 维的隐藏表示。8 张卡的差别只在各自持有的那份权重：每卡 8 个 KDA 头、8 个 MLA 头、18 个路由专家，见[第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)。
4. **node1 陪着跑。** DP1 此刻一条请求都没有，但 MoE 层的专家分在 16 张卡上，node0 的 token 要发到 node1 的卡上去算，所以 DP1 的 8 个 Worker 每一步都跑一个空批次，一起进出通信，见 [Data parallel](data-parallel.md)。
5. **前向和采样。** 第一次调用做完前向；第二次调用采样出 y₀，草稿层再猜 3 个候选。异步调度下，候选留在 Worker 里供下一步用，只有 node0 的 0 号 Worker 把「R1 得到 y₀」交回 EngineCore，见[第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)。
6. **更新进度。** DP0 的 Scheduler 把 y₀ 追加到 R1 上。R1 没结束，下一步计划就是 R1 算 1 + 3 = 4 个 token：y₀ 和 3 个候选一起验证。
7. **回到前端。** y₀ 的编号回到 API server，增量反分词，经流式响应推给客户端。一个 decode 步最多交回 4 个 token（1 个确定的，加最多 3 个被接受的候选），所以一个流式片段可能一次带出 1 到 4 个 token。

R1 结束时，它手里的块号一次还回 DP0 的池子，还多少块见 [R1 从借块到还块](vllm-kv-block-allocation.md#放到-glm-双机r1-从借块到还块)。R1 的编号进结束名单，随 DP0 的下一份计划通知 node0 的 8 个 Worker 删掉缓存；DP0 的运行请求数减 1，会影响下一条请求被派到哪一组。

绕完这一圈，R1 在三类角色手里的样子：

| 在哪 | R1 是什么 |
|---|---|
| 前端（node0 的 API server） | 一段文字，变成 4 个 token 编号；外加一个等结果的输出队列和一个增量反分词器 |
| EngineCore（DP0） | 一条请求记录：已算 0 个位置、这一步算 4 个、手里一串块号，从等待队列进入运行队列 |
| node0 的 8 个 Worker | 各自缓存一份 R1 的资料；这一步的输入是 4 个 token 编号、位置 0 到 3，以及每个位置写进缓存哪一格 |

多条请求时循环不变，只是一份计划里有多条请求，执行结果再按请求拆回去。13 条请求拼成一步的例子见[多条请求](concurrent-requests.md#示例场景-m-与变体-m)；两条请求怎样拼成一个输入，小例子见 [A/C 第三轮如何拼接](prepare-inputs-flow.md#ac-第三轮如何拼接)。

## 常见误解

- **「EngineCore 里能看到模型。」** 看不到。模型、权重和 KV cache 的张量只在 Worker 手里；EngineCore 里做调度的部分只有配置、计数和块号。
- **「Executor 在做调度。」** 不做。调度在 Scheduler 里，在 Executor 被叫到之前就做完了；Executor 只把计划发出去、把结果收回来。
- **「这几个进程靠多线程一起跑。」** 不是。前端靠一个能同时挂着很多网络连接的事件循环（asyncio），跨进程靠发消息；EngineCore 的主线程是一圈一圈转的普通循环，旁边两个后台线程只管收发消息。同名的「异步调度」是第三件事：循环照样一圈圈转，只是不等上一步的结果就排下一步，本部署按自动判定打开。
- **「Worker 一定是单独的进程。」** 不一定。只有一张卡时默认用单进程执行器，Worker 就住在 EngineCore 进程里。
- **「8 个 Worker 各算一部分 token。」** 不是。同一个 DP 组的 8 个 Worker 拿到同一份计划、摊出同样的输入；真正分开干活是在每一层里面：[TP](tensor-parallel.md) 把注意力的头和矩阵切给 8 张卡，[EP](expert-parallel.md) 把专家分到 16 张卡。
- **「每一步都把请求的全部历史重发给 Worker。」** 不会。完整资料只在第一次调度时发一次，之后只发变化量；历史的 KV cache 一直留在卡上。
- **「一个 Worker 对应一台服务器，一台机器就是一份完整模型。」** 都不对。一个 Worker 对应一张卡；一台机器是一个 DP 组，288 个路由专家分在两台机器的 16 张卡上，两台合起来才是完整的模型。

## 对照源码

### 怎么开

这个形状本身不是开关：vLLM 0.23.0 只有 V1 引擎。影响它长什么样的是下面几项，官方双机命令见部署页的[怎么开](glm-5-3-flash-two-node.md#怎么开)：

- **用哪种 Executor**：`--distributed-executor-backend`。不指定时，`world_size_across_dp > 1` 默认 `mp`（本部署 16 > 1），只在 DP 后端选了 Ray、或 Ray 已初始化且处在 placement group 里时改用 `ray`；`world_size == 1` 默认 `uni`。
- **每台机器起几个 EngineCore**：由 DP 参数决定；node1 用 `--headless` 只起引擎、不起前端，见[引擎进程](engine-processes.md)。
- **批次队列**：`max_concurrent_batches` 在异步调度打开且 PP=1 时是 2，否则等于 PP 段数；大于 1 时 EngineCore 用 `step_with_batch_queue`，否则用 `step`。
- **Worker 与 Runner**：`worker_cls` 为 `auto` 时，平台选 `vllm_ascend.worker.worker.NPUWorker`；`VLLM_USE_V2_MODEL_RUNNER` 不设时用 v1 的 `NPUModelRunner`。
- **怎样确认**：EngineCore 启动时打印一行 `Initializing a V1 LLM engine (v…) with config: …`，版本号和完整配置都在里面。

### 会报什么错

| 报错 | 在哪一侧 | 说明什么 |
|---|---|---|
| `EngineCore encountered an issue. See stack trace (above) for the root cause.` | 前端（`EngineDeadError`） | EngineCore 已经退出，前端无法恢复；真正的原因在上方 EngineCore 或 Worker 的 traceback 里 |
| `RPC call to execute_model timed out.` | EngineCore 的 Executor | Worker 在 `VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS`（默认 300 秒）内没有回话；`sample_tokens` 用同一个超时 |
| `Worker failed with error '…', please check the stack trace above for the root cause` | EngineCore 的 Executor | 回话的那个 Worker 执行时抛了异常，引号里是它的错误信息 |
| `Worker proc … died unexpectedly, shutting down executor.`，随后 `Executor failed.` | EngineCore 的 Executor | 某个 Worker 进程直接退出，Executor 标记失败，之后的调用全部拒绝 |

先按[出问题时判断它停在哪一站](request-call-chain.md#出问题时判断它停在哪一站)定位到进程，再看那个进程的 traceback。

### 开销和什么时候别开

这个形状关不掉，能选的是 Executor 和异步调度：

- **跨边界的固定开销**：每一步两次广播、一次回话；前端和 EngineCore 之间的消息用 msgpack 打包。Worker 缓存请求资料、计划只发变化量，就是为了压小这笔开销。
- **单卡**：默认就是单进程执行器，没有单独的 Worker 进程和广播队列，不需要改。
- **Ray**：只在已经用 Ray 管理机器时才选；官方双机部署是每台机器各起引擎、各用多进程执行器。
- **异步调度**：把等待藏到前向后面，代价是计划要先用占位数记账；什么时候该关，见[异步调度](async-scheduling.md)。

### 版本差异

上游控制流（EngineCore 主循环、调度计划与执行结果的结构、Executor）按 `vllm@0fc695fc`（v0.23.0）读。执行侧按知识库固定快照核对：v0.23 列是 vllm-ascend 维护分支 2c59ff10，v0.26 列是 2ed6cbba，main 列是 baa023ad。**本页 GLM 部分读的是本部署专用镜像 db701c1f，它是另一个 orphan commit，不算进 v0.23 列：GLM-5.3-Flash 的模型代码只在镜像里，2c59ff10 上没有。**镜像和 2c59ff10 在本页涉及的 Worker 选择、两次调用、Runner 选择上内容一致，只是行号偏移（`NPUWorker.execute_model` 在 2c59ff10 从第 611 行起，镜像从第 599 行起）。

| 项目 | v0.23 | v0.26 | main |
|---|---|---|---|
| 配套上游 vLLM 的一步 | vLLM 0.23.0：排计划 → execute_model → sample_tokens → 按结果更新 | vLLM 0.26.0 顺序相同；排计划多一个「这一步是否暂缓新 prefill」的参数，只有 DP 引擎会用 | 分支按 vLLM 0.29.0 判版本；0.29.0 的一步与 0.26.0 相同 |
| 平台选的 Worker 类 | `NPUWorker`（开 Xlite 图时 `XliteWorker`，310P 另有一类） | 同 v0.23 | 改由硬件档案给默认值，标准档案仍是 `NPUWorker`；Xlite 分支保留 |
| Worker 一步两次调用 | `execute_model` + `sample_tokens` | 一致 | 一致 |
| Runner | 默认 v1 `NPUModelRunner`（继承上游 GPU 版）；V2 只在设了环境变量时用 | 一致 | 默认值一致；另外改写了 V1 / V2 各自不支持特性的校验 |
| GLM-5.3-Flash 模型代码 | 无（镜像 db701c1f 在 `models/glm5_next.py`） | 无 | `models/glm5next/` 目录，类名 `Glm5NextForCausalLM` |

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
| 上游 0.26.0 / 0.29.0 的一步 | `vllm@568afb3a:vllm/v1/engine/core.py#L576-L606`；`vllm@98dff2a8:vllm/v1/engine/core.py#L597-L627` |

**证据索引。** 三类角色的划分、EngineCore 先建 Executor 再建缓存和 Scheduler、忙循环与一步的顺序见 [C4][C6][C8][S36]；批次队列与异步调度下的回环见 [C7]；两道边界上的消息、完整资料只发一次、结束名单、执行结果用列表以便序列化见 [C3][C16][C17][C18]；前端登记输出队列、EngineCore 为结构化输出加载分词器见 [C1][C19]；Executor 的种类、默认选择、按方法名广播、只收一份回话、DP 组空闲时改跑空批次、超时和失败报错见 [C10][C12][C37]；启动时查询缓存规格、稀疏 MLA 的实际执行路径见 [C5][C27][C28]；昇腾选 Worker、建 Runner、两次调用见 [C21][C22][C23]；三版差异见 [C30][C31][C34][C35]。

以下几条由源码和主线底稿推出，或属于本页的理解：R1 第一步计划的主要内容是 4 个 token 和新借的块号，取自底稿 01 的 A2 [D]；8 张卡的输入相同、只差权重分片，取自 A3 [D]；一个流式片段带出 1 到 4 个 token、结束名单随下一份计划通知 Worker，取自 A7 [D]；20 个进程的账取自 A0.1 [D]；R1 的 4 个 token 是教学设定 [A]；「三件事卡在不同的地方」是本页对拆分动机的归纳，源码里没有这句话 [A]。

**待核：**

- 跨边界的固定开销（两次广播、msgpack 打包、只收一份回话）在一步里占多少时间：缺实测。
- v0.26、main 配套的上游 vLLM 按分支里的版本判断取 0.26.0 与 0.29.0 标签核对，不是知识库钉住的 commit；镜像里实际安装的上游版本也待核，见[部署前提](glm-5-3-flash-two-node.md#部署前提)。
