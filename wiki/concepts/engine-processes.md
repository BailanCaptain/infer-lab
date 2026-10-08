---
id: engine-processes
title: 引擎有哪几个进程：API server、EngineCore 与 Worker
type: concept
summary: vLLM 把推理服务拆成三类进程——API server 收发请求、EngineCore 每步调度、Worker 每卡一个执行模型，彼此只发消息，请求状态、补丁和 Ascend 配置缓存各归各的进程；GLM 双机按角色计 20 个进程，executor（执行器）决定 Worker 是否独立成进程。
aliases: [EngineCore, Main 进程, Worker 进程, 进程边界, V1 引擎进程, 引擎的三类角色, patch 注入点, uni 执行器, 多进程执行器, API server 进程, 前端进程, 进程账, 20 个进程, DP 协调器, headless, 进程与执行器, 进程与执行器：前端、EngineCore 和 Worker 如何协作, 引擎有哪几个进程]
chapters: ["10"]
order: 80
sources:
  - https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L138-L148
  - vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L173-L253
  - vllm@0fc695fc:vllm/v1/engine/utils.py#L1084-L1100
  - vllm@0fc695fc:vllm/v1/engine/utils.py#L121-L170
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L70-L131
  - vllm@0fc695fc:vllm/v1/engine/core.py#L100-L109
  - vllm@0fc695fc:vllm/v1/engine/core.py#L860-L965
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1118-L1137
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L132-L192
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L495-L509
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L686-L696
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L997-L1031
  - vllm@0fc695fc:vllm/v1/executor/uniproc_executor.py#L45-L63
  - vllm@0fc695fc:vllm/config/parallel.py#L776-L780
  - vllm@0fc695fc:vllm/config/parallel.py#L845-L890
  - vllm@0fc695fc:vllm/config/parallel.py#L501-L504
  - vllm@0fc695fc:vllm/utils/system_utils.py#L126-L198
  - vllm@0fc695fc:vllm/envs.py#L892-L894
  - vllm@0fc695fc:vllm/plugins/__init__.py#L69-L80
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2578-L2598
  - vllm@0fc695fc:vllm/v1/worker/worker_base.py#L238-L247
  - vllm@0fc695fc:vllm/v1/core/sched/output.py#L181-L212
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1125-L1168
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L340-L412
  - vllm@0fc695fc:vllm/config/scheduler.py#L168-L188
  - vllm@0fc695fc:vllm/v1/engine/coordinator.py#L80-L157
  - vllm-ascend@db701c1f:vllm_ascend/__init__.py#L18-L69
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L184-L188
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L450-L475
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L89-L120
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L563-L567
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L866-L925
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L47-L50
  - vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L57-L66
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_multiproc_executor.py#L161-L200
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L661-L718
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L530-L544
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L748-L763
  - vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/patch.md#L1-L40
  - vllm-ascend@db701c1f:vllm_ascend/eplb/core/eplb_worker.py#L403-L410
  - vllm-ascend@2ed6cbba:vllm_ascend/__init__.py#L18-L69
  - vllm-ascend@baa023ad:vllm_ascend/__init__.py#L52-L103
  - vllm@568afb3a:vllm/config/parallel.py#L883-L928
  - vllm@0fc695fc:vllm/v1/engine/llm_engine.py#L140-L176
  - vllm@0fc695fc:vllm/config/vllm.py#L561-L580
  - vllm@0fc695fc:vllm/v1/executor/abstract.py#L48-L82
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L108-L130
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L127-L149
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L661-L745
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 20 个进程是那套双机部署启动时拉起来的；启动的先后七步和 16 卡分组在那一页
  - to: ascend-patch-system
    kind: builds-on
    note: 本页只讲补丁归哪个进程、从哪个入口进；补丁怎样替换名字、有哪几类，在那一页
  - to: platform-plugin-registration
    kind: builds-on
    note: 三类进程都会加载通用插件；插件怎样被发现、平台怎样被选中，在那一页
  - to: vllm-engine-core
    kind: builds-on
    note: EngineCore 进程里的忙循环一步做哪些事，在那一页展开
  - to: vllm-v1-shape
    kind: builds-on
    note: 组件分工与进程布局是两个视角：那一页按组件讲，本页按进程讲
  - to: eplb
    kind: builds-on
    note: 动态 EPLB 会让每个 Worker 再带两个子进程，这正是需要改 Worker 启动方式的原因；EPLB 本身在那一页
  - to: one-request
    kind: builds-on
    note: 本页用示例请求 R1 说明清单只发差量；R1 每一站的数字和块号怎么来，在那一页
contradicts: []
updated: "2026-09-28"
origin: direct
---

## 一个推理服务为什么是好几个进程

**vLLM 把一个推理服务拆成三类进程：API server 接住用户请求、把文字切成 token，最后把结果还给用户；EngineCore 每一步决定这一步算哪些请求；Worker 每张卡一个，守着那张卡执行模型。三类进程互不共享内存，只靠发消息交接。**

**进程**是操作系统里一份独立运行的程序，有自己的一块内存：一个进程里的变量、对象、被替换过的函数，另一个进程都看不到。两个进程要交换数据，只能经过某种通道，比如网络消息，或者一块专门划出来、几个进程都能读写的共享内存。

```wiki-diagram
file: engine-processes
```

用户的 HTTP 请求从 API server 进来，结果也从它回去。图里的箭头是一组卡每一步都在走的几路消息：

- **请求消息，每条请求发一次。** API server 把文字切成 token id，连同采样参数打包，发给 EngineCore。这条请求之后每一步怎么算，都不再由 API server 决定。
- **清单，每一步发一次。** EngineCore 里有两个部件经手这份清单。scheduler（调度器）定下这一步算哪些请求、各算几个 token、这些 token 的 K、V 写进 [KV cache](kv-cache.md) 的哪些块（KV cache 按固定大小的块分配，每块有一个块号）。executor（执行器）是 EngineCore 里专管和 Worker 打交道的对象：把清单交给所有 Worker，再收回结果，[后文](#executor-决定-worker-是不是独立进程)单独讲它。每个 Worker 收到的是同一份清单，各算自己那张卡上的一份。「清单」是本页的叫法，在 vLLM 里它叫 SchedulerOutput；严格说，executor 每一步要对 Worker 发两次调用，一次算到词表分数，一次采样出新 token，见[一步之内](request-call-chain.md#一步之内enginecore-给-worker-发两次调用)。
- **本步结果，通常只由一个 Worker 回传。** 同一组卡最后得到的新 token 相同，所以在没配 KV connector、也没开 PP 的部署里，executor 只读本组 TP 编号为 0 的那个 Worker 的回信（TP 即[张量并行](tensor-parallel.md)，一组卡合算同一份模型，每层各算一部分；node1 那组的 0 号就是全局 8 号），不收 N 份。有两种例外：配了 KV connector（在实例之间搬 KV cache 的组件，比如 [PD 分离](pd-disaggregation.md)要用它）时，每个 Worker 都回传，由 executor 汇总；开了 [PP](pipeline-parallel.md)（流水线并行）时，回传的是最后一段流水线里 TP 编号为 0 的 Worker。这条回程走哪条通道，见[进程之间的四条通道](request-call-chain.md#进程之间的四条通道)。
- **新 token，每一步发一次。** EngineCore 记完账，把新 token 发回 API server，由它还原成文字，一段一段推给用户。
- **卡间通信（虚线）。** Worker 在计算中途互相交换张量，比如把各卡的部分结果加起来，见[集合通信](collective-communication.md)。这条路只连着 Worker，不经过 EngineCore。

图上没画的还有几路，都出在开了[数据并行](data-parallel.md)的部署里（DP：把卡分成几组，每组叫一个 DP 组，各自接一部分请求、各自调度）。这时在线服务通常还多一个 DP coordinator（DP 协调器）进程，和 API server、各 EngineCore 互发消息，汇总各组忙闲。模型又是 MoE 时（GLM 就是），几个 DP 组还得步调一致：coordinator 通知各组一起开工；两个 EngineCore 之间每 32 步对一次「还有没有请求」，两边都没有了才一起停下；不同 DP 组的 Worker 每一步开算前也要对齐一次这一步算多宽。coordinator 为什么单独占一个进程，见[下文](#双机部署里一共有哪些进程)；这些消息各走哪条通道，见[进程之间的四条通道](request-call-chain.md#进程之间的四条通道)。

左下角是另一种摆法：**整个服务只用一张卡时，Worker 不另起进程**，而是 EngineCore 进程里的一个对象，清单直接用函数调用递过去，内容和多卡时一样。所以「Worker」首先是一个角色，它是不是独立的进程，由 [executor 的种类](#executor-决定-worker-是不是独立进程)决定。

## 拆成几个进程，换来什么、付出什么

拆开换来两样东西。第一，**CPU 上的杂活不挡住调度。** 接 HTTP 连接、套聊天模板、分词、反分词都是 CPU 上的 Python 工作，放在 API server 进程里做，EngineCore 的循环就只管调度和下发。EngineCore 进程里还另开了两个线程专门收发消息，让消息的打包、拆包和模型计算同时进行，见[进程之间的四条通道](request-call-chain.md#进程之间的四条通道)。第二，**每张卡一个进程，一个进程就是通信域里的一个成员。** 通信域是一起做集合通信（几张卡同时交换、合并张量）的一组成员，比如同一组 TP 的 8 个 Worker；域里的成员编号叫 rank；每个 Worker 只绑定一张卡，本卡的权重和 KV cache 都在它自己的内存里，多个 Worker 同时计算、互相交换张量。

代价有三样。

**交接必须打包成消息。** 跨进程递不了对象，只能把内容编码后发过去，所以清单里几乎全是整数，而且只发差量。一条请求第一次被调度时，整份 prompt 随清单发给 Worker，Worker 把这条请求的资料缓存在自己的进程里；之后每一步只发新增的部分：这一步算几个 token、新分到哪些块号、上一步猜出的候选 token。拿示例请求 R1（prompt 为 4 个 token 的那条请求，见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)）来说，第一步正是它第一次被调度，所以清单里带着它的 4 个 prompt token id 和采样参数，外加「R1 算 4 个 token」和新分到的 15 个块号；块数怎么来的见[第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)。从第二步起，清单里只剩这一步算几个 token（带 3 个候选时是 4 个）、有没有新分到的块号，以及上一步猜出的候选 token，见[第二圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)。

**同一条请求的状态分几处存。** EngineCore 记着账本，Worker 存着资料的缓存，API server 存着输出队列。请求结束时，EngineCore 要在下一份清单里带上结束名单，Worker 才删掉自己那份缓存。

**补丁和配置要一个进程一个进程地到位。** Ascend 把上游函数换成自己的版本，只换掉当前进程里的名字；Ascend 的配置对象也是每个进程各存一份。详见[补丁一节](#补丁和配置为什么要每个进程各做一遍)。

读这一页要分清四个词：

| 词 | 指什么 | 官方双机部署里有多少 |
|---|---|---|
| 角色 | 做什么事：收发请求、调度、执行模型 | 3 类 |
| 进程 | 操作系统里一份独立的程序，内存各归各 | 按角色计 20 个 |
| rank | 通信域里的成员编号，一个 Worker 一个 | 16 个 |
| 节点 | 一台机器 | 2 台 |

## 双机部署里一共有哪些进程

**按角色计，官方双机部署跑起来是 20 个进程：node0 上 11 个，node1 上 9 个；占卡的只有 16 个 Worker。** 部署参数见[部署前提](glm-5-3-flash-two-node.md#部署前提)，这些进程按什么先后被拉起来见[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)。

| 机器 | 进程 | 个数 | 做什么 | 进程名 |
|---|---|---|---|---|
| node0 | API server | 1 | 启动时选定硬件平台，拉起 DP coordinator 和本机的 EngineCore；之后接 HTTP、套模板、分词、反分词，决定请求发给哪个 DP 组 | 就是执行 vllm serve 的那个进程 |
| node0 | DP coordinator | 1 | 汇总两个 DP 组各有多少请求；协调两组一起开工、一起停下 | VLLM::DPCoordinator |
| node0 | EngineCore（DP 组 0） | 1 | 调度 DP 组 0 的请求，管这一组的块号 | VLLM::EngineCore_DP0 |
| node0 | Worker（卡 0–7） | 8 | 各守一张卡，执行模型 | VLLM::Worker_DP0_TP0_EP0 等 |
| node1 | EngineCore（DP 组 1） | 1 | 调度 DP 组 1 的请求，管这一组的块号 | VLLM::EngineCore_DP1 |
| node1 | Worker（卡 8–15） | 8 | 各守一张卡，执行模型 | VLLM::Worker_DP1_TP0_EP8 等 |

表里的名字是进程在系统进程列表里显示的标题，装了 setproctitle 这个 Python 包时才会改成这样。API server 不改标题，列表里看到的就是那行启动命令。

**为什么 node1 上没有 API server 和 DP coordinator。** node1 用 headless 模式启动：不建 HTTP 前端，不建 coordinator，只起本机那一组的 EngineCore，再向 node0 的握手端口报到。所有用户请求都从 node0 的 API server 进来，由它按两组的忙闲挑一组发过去；挑法见[数据并行](data-parallel.md)。

**DP coordinator 为什么单独占一个进程。** 它不经手请求本身，只做两件事：每隔一小段时间汇总两组的等待数和运行数，推给 API server 做负载均衡；GLM 是 [MoE](moe.md) 模型，两组的 Worker 在 MoE 层要一起交换 token，所以一组有活时另一组也得陪着跑，coordinator 负责通知两组「开工」和「可以停了」。

**为什么每个 EngineCore 带 8 个 Worker。** 一个 EngineCore 管一个 DP 组，一组内是 [TP8](tensor-parallel.md)，所以一组 8 张卡、8 个 Worker；每个 Worker 在全局的编号是「DP 组号 × 8 + 本机卡号」，node1 的第 0 张卡就是全局第 8 号。16 张卡怎样分成 TP 组和 EP 组，见[16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)。

**「20 个」有它的统计口径。** 主线底稿的进程账按角色计：API server、DP coordinator、EngineCore、Worker 各算一个，node0 的 API server 就是执行 vllm serve 的那个进程。这样数出来的数，和在系统进程列表里数出来的总数不是一回事：

- **node1 的启动进程不在账内。** 在 node1 上执行 vllm serve 的那个进程，拉起 EngineCore 之后并不退出，而是留下来监视引擎进程是否还活着。node0 上的启动进程就是 API server，已经算了一次；node1 上的这一个不承担任何角色，所以没记。按进程列表数，node1 上 vLLM 自己的进程是 10 个，两台合计 21 个。
- **辅助进程不在账内。** Python 标准库、编译工具等按需另起的辅助进程，个数随环境变化，不计。
- **特性另起的进程不在账内。** 例如打开动态 EPLB 后，每个 Worker 还要再起两个子进程，见[后文](#进程怎么摆直接决定要打哪些补丁)。

所以在进程列表里数到比 20 多，并不说明部署出了问题。要判断缺没缺，按角色对：1 个 API server、1 个 DP coordinator、2 个 EngineCore、16 个 Worker。

## 每个进程里存着什么

**一条请求的状态分存在三类进程里，各存各的一份，每份都跨步留着，直到请求结束。** 一条请求怎样依次穿过这些进程、每一站进哪个函数，见[七站分在三种进程里](request-call-chain.md#七站分在三种进程里)；进程之间的消息各走哪条通道，见[进程之间的四条通道](request-call-chain.md#进程之间的四条通道)。这里只看每个进程里留下了什么。

| 进程 | 跨步一直留着的 | 每一步新产生、用完就丢的 |
|---|---|---|
| API server | 分词器；每条请求的反分词进度和输出队列 | 刚到的请求；这一步要推给用户的那段文字 |
| EngineCore | 等待队列与运行队列；每条请求算到了哪、占了哪些块号 | 这一步的清单；对本步结果的处理 |
| Worker | 本卡的权重分片和 KV cache；每条请求的资料缓存和持久批次 | 本步的输入张量、注意力元数据、中间激活和输出 |

**API server 不是把请求交出去就没事了。** 请求交给 EngineCore 之前，API server 先在自己进程里登记这条请求：给它建一个反分词器和一个输出队列。此后每一步的新 token 都回到这里，反分词成文字再推给用户。请求结束前，这份登记一直在。为什么要先登记再发出，见[API server 入口的第 ⑤ 到 ⑦ 步](api-server-entry.md#怎么做包成引擎请求先登记回程再发出⑤-到-⑦)。

**EngineCore 存的是账本，不是数据。** scheduler 里的请求记录从进来到结束一直在，模型每走一步，它就被调度一次；它占了 KV cache 的哪几个块，也记在这里。块里真正的 K、V 数值不在 EngineCore，而在各张卡的显存里，归各个 Worker。

**Worker 也记着每条请求。** 因为清单只发差量，Worker 必须自己记住每条请求的 token、已经算到的位置和块表，下一步才能接着拼出输入。这份资料缓存加上一个跨步复用的「持久批次」，就是 Worker 里除权重和 KV cache 之外，跨步留下来的东西。真正每一步用完就丢的，是按这些资料现拼出来的输入张量和中间激活。

## executor 决定 Worker 是不是独立进程

**executor（执行器）是 EngineCore 进程里负责「把清单交给 Worker、收回结果」的对象，它的种类决定了 Worker 落在哪里。** 不手动指定时，vLLM 按下面的规则挑：

- **整个服务只有 1 张卡：单进程 executor（uni）。** Worker 就在 EngineCore 进程里当场创建，由它初始化设备、加载模型。清单用函数调用递过去，不跨进程。
- **多于 1 张卡：多进程 executor（mp）。** 按本机的卡数，每张卡起一个 Worker 子进程，再建一条共享内存广播队列：每一步清单写进去一次，各 Worker 各读一次。
- **在 Ray 里运行：Ray executor。** 已处在 Ray 的资源组里，或者指定用 Ray 做 DP 后端时，默认改用 Ray。Ray 是一个分布式计算框架。
- **手动指定了 executor：** 按指定的来，上面几条都不适用。

这里的「整个服务的卡数」要把所有 DP 组算在一起，不是一个 EngineCore 管几张卡。所以 DP2 × TP1 这种每组只有一张卡的部署，也还是给每个 EngineCore 起一个 Worker 子进程；只有整个服务就一张卡，才会用单进程 executor。

官方双机部署落在第二条：

```calc
title: 双机部署为什么每个 EngineCore 起 8 个 Worker 进程
一组内的卡数 = PP 1 × TP 8 × PCP 1 = 8
整个服务的卡数 = 8 × DP 2 = 16
> 16 大于 1，又没有手动指定 executor，所以用多进程 executor；本机 8 张卡，起 8 个 Worker 进程
```

PP 是流水线并行，PCP 是 prefill 阶段的上下文并行，这套部署都没开，取 1。

反过来，进程最少的几种情形是：

- **单卡 vllm serve：2 个进程。** API server 一个；EngineCore 一个，Worker 住在它里面。
- **离线调用：可以只有 1 个进程。** 用 vLLM 的离线接口在脚本里直接生成时，EngineCore 默认也放在单独的进程里；关掉 V1 多进程这个环境变量开关后，EngineCore 就直接在调用者的进程里运行，单卡时全部只剩 1 个进程。API server 用的异步引擎不支持这种关法，一定是独立的 EngineCore 进程。

## 补丁和配置为什么要每个进程各做一遍

**Ascend 的补丁，就是在某个 Python 进程里把上游的某个名字改指向昇腾的实现；Ascend 的配置缓存，是某个 Python 进程里的一个模块变量。两样东西都只属于做了这件事的那个进程。**

vllm-ascend 不改 vLLM 的源码，而是在程序运行起来以后，把上游某些函数、类换成自己的版本，这叫 **patch**（补丁）。「换」改的是当前进程里这个名字指向谁，其他进程里的同一个名字不受影响。替换怎样生效、有哪几类，见 [Patch 机制](ascend-patch-system.md)。

Ascend 的配置也一样。vllm-ascend 把自己的一组开关（从启动参数的附加配置里读出来）整理成一个配置对象，缓存在模块级的变量里，之后各处代码都来这里取。这个缓存同样是进程里的一个变量：API server 在建总配置时建一份，每个 Worker 在初始化时按传进来的总配置再建一份。某个进程里改了它，别的进程看不到；某个进程里没建就去取，会直接报错。

**子进程出生时带不带父进程的东西，取决于启动方法。** vLLM 起 EngineCore 和 Worker 用的是同一套启动方法，由环境变量 VLLM_WORKER_MULTIPROC_METHOD 决定，默认 fork：

- **fork**：子进程是父进程内存的一份拷贝。出生那一刻，父进程里已经换好的名字、已经建好的配置对象都原样带过去；出生以后两边各改各的，互不影响。
- **spawn**：子进程从一个全新的 Python 解释器开始，模块重新导入，父进程里换过的名字一个都不在。已经在当前进程里初始化过 CUDA、运行在 Ray 里、开了 NUMA 绑定等情况下，vLLM 会强制改用 spawn；用户也可以用这个环境变量直接指定。

官方 GLM 教程没有设置这个环境变量，按默认走 fork，主线底稿记的也是 fork。

**所以 vllm-ascend 在每类进程里都留了一个入口，不管用哪种启动方法，每个进程最后都打齐了补丁：**

| 进程 | 在哪一刻打 | 打什么 |
|---|---|---|
| API server（node1 上是启动进程） | 解析命令行参数时：先加载通用插件，再调用平台准备钩子 | 全局补丁 |
| EngineCore | 初始化时，vLLM 在这个进程里再加载一次通用插件 | 全局补丁，本进程已经打过就跳过 |
| Worker | 昇腾 Worker 的构造函数一开始 | Worker 补丁；随后登记昇腾算子、建本进程的 Ascend 配置 |

中间那一行最不直观。vllm-ascend 注册了四个通用插件入口，其中三个的第一件事都是「确认本进程已经打过全局补丁」，没打过就打，打过就跳过；「打过没有」的标记本身也是进程里的一个变量。它的代码注释写明了理由：vLLM 会在 EngineCore 子进程里加载通用插件，而测试框架在主进程里打补丁的那些钩子不会在那个进程里运行，所以影响 scheduler 和引擎代码的全局补丁必须借这些入口再打一次。用 fork 时，这一步什么都不用做，补丁和标记在出生时已经带过来；用 spawn 时，EngineCore 里的补丁只能靠这一步打上。

**EngineCore 里被换掉的，是调度相关的代码。** 全局补丁里均衡调度的那个补丁同时换掉了两样东西：把上游 scheduler 类换成 BalanceScheduler，把 EngineCore 进程的入口函数换成昇腾的版本；入口函数只在打开均衡调度时才走昇腾的循环，否则转回上游原版。官方 GLM 部署没有打开均衡调度，见 [Balance Scheduling](balance-scheduling.md)。最后实例化哪个 scheduler 类，还取决于异步调度开没开，见[异步调度](async-scheduling.md)。所以「EngineCore 里跑的全是上游原样的代码」这个说法不成立。

**Worker 补丁跟着 Worker 走，不挑进程。** 整个服务只有一张卡时，Worker 在 EngineCore 进程里被创建，Worker 补丁也就打在 EngineCore 进程里；多卡时每个 Worker 进程各打一遍，官方双机部署一共打 16 遍。

```wiki-diagram
file: engine-processes-startup
```

图从上往下看：启动进程先打全局补丁、建 Ascend 配置；拉起 EngineCore 时按启动方法分两路，汇合到 EngineCore 自己的入口再确认一遍；然后按卡数分两路，两路都会走到 Worker 的构造函数，在那里打 Worker 补丁、建本进程的配置。由此得出排查的原则：**补丁或配置「没生效」，要到出问题的那个进程里去查，看 API server 的状态说明不了 Worker。**

## 进程怎么摆，直接决定要打哪些补丁

进程模型不只是背景知识，它直接决定昇腾要改哪里。一个具体的例子是动态 EPLB。[EPLB](eplb.md) 按各个专家的实际负载重新摆放专家；打开动态模式后，每个 Worker 都要在自己的进程里再起两个子进程：一个保管共享字典的管理进程，一个计算新摆法的进程。

问题出在上游起 Worker 的方式。上游把 Worker 设成 daemon 进程（父进程退出时会被自动结束的一种子进程），而 Python 不允许 daemon 进程再创建子进程。所以 vllm-ascend 有一个补丁，换掉多进程 executor 里起 Worker 的那段代码，把 daemon 改成否。

这个补丁有两个特点，都由进程模型决定：

- **它归在全局补丁里，不归在 Worker 补丁里。** 起 Worker 的代码在 EngineCore 进程里运行，而且在任何 Worker 出生之前就要跑；等 Worker 补丁生效时，Worker 早已按上游方式起好了。官方的补丁设计文档也是按「这段代码在哪个进程里运行」来决定补丁放进哪个目录的。
- **它由环境变量打开，不由配置打开。** 全局补丁在解析参数时就导入，比 Ascend 配置被读出来还早，所以只能看环境变量：设了 DYNAMIC_EPLB 或 EXPERT_MAP_RECORD 才导入。只在配置里打开动态 EPLB、不设环境变量，配置检查会直接报错。

官方 GLM 双机部署没有打开 EPLB，Worker 仍按上游方式起，也没有这些额外的进程。

## 排查时先认是哪个进程

看到一条报错，先判断它出在哪个进程，能省掉大半查找范围：

- **参数检查阶段报错**（比如某种并行组合不合法）：出在 API server 或 node1 的启动进程，看昇腾平台的那组检查，见 [NPU 平台](npu-platform.md)。
- **调用栈里有 scheduler、KV 块管理、清单的构造**：出在 EngineCore 进程。这部分主体是上游代码，昇腾只通过全局补丁插手。
- **调用栈里有模型前向、注意力、昇腾算子**：出在 Worker。多卡时是某个 Worker 进程，单卡时在 EngineCore 进程里；这部分大多是昇腾自己的代码。

日志前缀和进程名告诉你代码**在哪里执行**；出错那一帧的文件路径告诉你代码**是谁写的**。「日志来自 Worker」和「代码属于 vllm-ascend」是两件事，两样都要记下。再加上进程号、全局 rank、卡号和 executor 种类，才能把 API server、EngineCore、Worker 三处的日志对上。按日志前缀认出请求停在哪一站，见[出问题时判断它停在哪一站](request-call-chain.md#出问题时判断它停在哪一站)；具体的报错字符串见下半「会报什么错」。

## 常见误解

- **「补丁在 API server 里打一次，就全局生效了」**：用 fork 时，只有子进程出生那一刻已经打好的补丁会被带过去；用 spawn 时什么都不带。子进程出生以后，父进程再改什么都传不过去。vllm-ascend 正因为这样才在每类进程里各留一个入口。
- **「Worker 一定是单独的进程」**：整个服务只有一张卡、又没有手动指定 executor 时，它是 EngineCore 进程里的一个对象。
- **「一个 EngineCore 只管一张卡，就会用单进程 executor」**：看的是整个服务的卡数，DP2 × TP1 仍然每组起一个 Worker 进程。
- **「进程列表里数出来不是 20 个，部署就错了」**：20 是按角色计的；node1 的启动进程、各种辅助进程和特性另起的进程都不在账内。
- **「API server 把请求交出去就没它的事了」**：每一步的新 token 都回到它这里反分词、推给用户，请求结束前它一直登记着这条请求。
- **「Worker 每一步收到的都是完整的请求，算完就全丢」**：只有第一次调度发整份，之后只发差量；Worker 自己缓存着每条请求的资料，直到清单里的结束名单通知它删除。
- **「EngineCore 里跑的全是上游代码」**：调度的主体是上游的，但 scheduler 类和 EngineCore 进程的入口函数都被全局补丁换过，见上文。
- **「这几个进程是昇腾引入的」**：这是 vLLM 自己的进程模型，昇腾只是必须适配它；除了 EPLB 这类特性，vllm-ascend 不另起进程。

## 对照源码

### 怎么开

**executor** 由 `--distributed-executor-backend`（配置项 `distributed_executor_backend`）指定，取值 `mp`、`uni`、`ray`、`external_launcher`，或一个自定义 executor 类的路径。不指定时：

- `world_size = pipeline_parallel_size × tensor_parallel_size × prefill_context_parallel_size`；`world_size_across_dp = world_size × data_parallel_size`。
- `world_size_across_dp > 1` 时默认 `mp`；`data_parallel_backend == "ray"`，或装了 Ray 且已处在 placement group 里时改为 `ray`；TPU 开 SPMD 时为 `uni`；CUDA 上本机卡数少于 `world_size` 时直接报错。最后，若仍未指定且 `world_size == 1`，定为 `uni` [C16]。
- `UniProcExecutor._init_executor()` 在当前进程里 `WorkerWrapperBase(rpc_rank=0)` → `init_worker` → `init_device`，随后加载模型 [C14]。`MultiprocExecutor._init_executor()` 建 `rpc_broadcast_mq`，再按 `local_rank in range(local_world_size)` 逐个 `WorkerProc.make_worker_process(..., input_shm_handle=scheduler_output_handle)` [C10]；上游子进程是 `daemon=True`，名字 `VllmWorker-{rank}`。
- 官方双机：TP8、DP2，`world_size = 8`、`world_size_across_dp = 16`，未指定 executor，所以两台都用 `mp` [D]。

**启动方法**由 `VLLM_WORKER_MULTIPROC_METHOD` 决定，默认 `fork` [C19]。`get_mp_context()` 先调 `_maybe_force_spawn()`：环境变量已是 `spawn`、在 Ray actor 里、命令行带 `--numa-bind`、CUDA 或 XPU 已初始化、运行在 WSL，都会改用 `spawn` 并打一条警告 [C18]。官方 GLM 教程的两台启动命令都没有设置它 [S1]。

**两台机器各起什么**：

- node0 `--api-server-count 1`：`ServeSubcommand.cmd` 直接在本进程里 `uvloop.run(run_server(args))`，注释写的是 "Single API server (this process)" [C2]。`run_server` 经 `launch_core_engines` 建 `CoreEngineProcManager`，后者用 `context.Process(target=EngineCoreProc.run_engine_core, name="EngineCore_DP{i}")` 拉起引擎进程。
- node1 `--headless`：`run_headless` 建 `CoreEngineProcManager` 拉起本机引擎后，在本进程里 `monitor_engine_liveness()`，直到关停 [C3]。这就是不在进程账里的那个启动进程。
- DP coordinator：`needs_dp_coordinator and not offline_mode and dp_rank == 0` 时才建，MoE 模型打开 wave coordination [C4]；`needs_dp_coordinator` 在 DP > 1 时为真，只有非 MoE 模型又用外部负载均衡（`data_parallel_external_lb`）时例外，见 `vllm/config/vllm.py:561-580`。coordinator 是 `context.Process(target=DPCoordinatorProc.run_coordinator)`，进程标题 `DPCoordinator`。

**API server 与 EngineCore 之间的客户端**：`EngineCoreClient.make_client` 不支持「asyncio 但不开多进程」，所以 `AsyncLLM` 一定用独立的 EngineCore 进程；DP > 1 且用内部负载均衡时是 `DPLBAsyncMPClient`。离线 `LLMEngine` 由 `VLLM_ENABLE_V1_MULTIPROCESSING` 决定，关掉时用 `InprocClient`，EngineCore 在调用者进程里。`AsyncLLM.add_request` 先在本进程 `output_processor.add_request(...)` 登记，再 `engine_core.add_request_async(request)` 发往另一个进程，源码注释分别写着 "(this process)" 与 "(separate process)"。

**三条补丁入口**：

| 进程 | 入口 |
|---|---|
| API server / 启动进程 | `AsyncEngineArgs.add_cli_args` 先 `load_general_plugins()`，再 `current_platform.pre_register_and_update(parser)`；昇腾的 `NPUPlatform.pre_register_and_update` 里 `adapt_patch(is_global_patch=True)` |
| EngineCore | `EngineCore.__init__` 开头 `load_general_plugins()`，注释 "plugins need to be loaded at the engine/scheduler level too"；`register_connector` / `register_model_loader` / `register_service_profiling` 第一行 `_ensure_global_patch()`，`register_model` 不调 [C28] |
| Worker | `WorkerWrapperBase.init_worker` 里 `load_general_plugins()`；`NPUWorker.__init__` 开头 `adapt_patch()`，随后 `register_ascend_customop(vllm_config)`、`init_ascend_config(vllm_config)` [C31] |

- `adapt_patch` 只做一件事：`import vllm_ascend.patch.platform`（全局）或 `import vllm_ascend.patch.worker`（Worker）。同一个解释器里模块只执行一次，所以 fork 出来的子进程再导入是空操作，spawn 出来的新解释器导入时才真正执行替换 [D]。
- `load_general_plugins()` 用进程内的 `plugins_loaded` 去重，docstring 提醒插件会在不同进程里被加载多次；`_GLOBAL_PATCH_APPLIED` 同理。`_ensure_global_patch()` 的 docstring 写明了 EngineCore 这条路的理由：vLLM 在 engine-core 子进程里加载 general plugin，E2E 测试的 conftest hook 在那里不跑。
- 官方补丁设计文档把 `patch/platform` 定为「vLLM 主进程」的补丁，`patch/worker` 定为「Worker 进程」的补丁，写补丁的第二步就是「决定该打在哪个进程」[C40]。

**Ascend 配置缓存**：模块变量 `_ASCEND_CONFIG`；`init_ascend_config` 在 `NPUPlatform.check_and_update_config` 里调用（由 `VllmConfig.__post_init__` 触发，发生在建总配置的进程里），也在 `NPUWorker.__init__` 里调用；同一个 `vllm_config` 对象、没有 `refresh` 时复用缓存 [C33]。

**EngineCore 里换掉的调度代码**：`patch/platform/__init__.py` 无条件导入 `patch_balance_schedule` [C34]；它在模块末尾 `EngineCoreProc.run_engine_core = run_engine_core`、`vllm.v1.core.sched.scheduler.Scheduler = BalanceScheduler`，新入口在 `_balance_scheduling_enabled` 为假时调回原版 [C37]。`get_scheduler_cls` 在调用时刻才 `from vllm.v1.core.sched.scheduler import Scheduler`，未开异步调度时拿到的是替换后的类；开了异步调度返回 `AsyncScheduler`。

**EPLB 的 Worker 启动补丁**：`patch_multiproc_executor` 只在 `DYNAMIC_EPLB` 为 `true`/`1` 或 `EXPERT_MAP_RECORD` 为 `true` 时导入；`AscendWorkerProc.make_worker_process` 用 `daemon=False`；补丁清单写明原因是 EPLB 要再起进程，而 `daemon=True` 不允许。动态 EPLB 时，`NPUModelRunner.__init__` 里先 `Manager()`，再 `EplbProcess._launch_process()`。

### 会报什么错

按栈里的名字认进程 [A]：

- 参数校验阶段（`NPUPlatform` 的 `_validate_*` 系列，并行组合不合法等）：API server，或 node1 的启动进程。
- 栈里有 `Scheduler`、`BalanceScheduler`、`AsyncScheduler`、`KVCacheManager`，或正在构造 `SchedulerOutput`：EngineCore 进程，昇腾只经全局补丁介入。
- 栈里有 `NPUWorker`、`NPUModelRunner`、attention 后端、`torch_npu` 调用：Worker；多卡时是 Worker 子进程，`uni` 时在 EngineCore 进程里。

与进程归属直接相关的几条：

- `Ascend config is not initialized. Please call init_ascend_config first.`：在一个还没建 Ascend 配置缓存的进程里取配置。
- `The environment variable DYNAMIC_EPLB or EXPERT_MAP_RECORD of the EPLB must be set to true.`：配置里开了动态 EPLB，却没设环境变量，Worker 启动补丁没有导入。
- ``We must use the `spawn` multiprocessing start method. Overriding VLLM_WORKER_MULTIPROC_METHOD to 'spawn'.``：这是警告，不是错误，说明本次子进程改用 spawn 启动，补丁要靠各进程自己的入口打上。
- Worker 进程抛异常、意外退出、RPC 超时的报错字符串，见[请求代码路径页的「会报什么错」](request-call-chain.md#会报什么错)。

### 开销和什么时候别开

- spawn 起的子进程要从头导入 vLLM、vllm-ascend 和 torch_npu，启动比 fork 慢；fork 快，但要求父进程在 fork 之前没有初始化设备运行时，vLLM 检测到 CUDA 已初始化就改用 spawn，正是为此[D]。没有这类原因时，不必把启动方法改成 spawn。
- 单进程 executor 省掉 Worker 进程和共享内存队列，但只适用于整个服务一张卡；多卡部署没法靠换成 `uni` 来简化调试 [D]。
- 动态 EPLB 让每个 Worker 多两个子进程，Worker 也改成非 daemon。Python 在父进程退出时会直接结束 daemon 子进程，对非 daemon 子进程则是等它退出，所以关服务更依赖 executor 自己的关闭流程 [D]。官方 GLM 双机没有开 [S1]。

### 版本差异

按知识库固定快照核对：v0.23 列是 vllm-ascend 维护分支 2c59ff10，v0.26rc 列是 2ed6cbba，main 列是 baa023ad。**本页正文读的是本部署专用镜像 db701c1f，它是另一个 orphan commit，不算进 v0.23 列：GLM 的模型代码与配置 patch 只在镜像里，2c59ff10 上只有两个 GLM 工具调用 patch。**下表 v0.23 列的行号读自 2c59ff10；镜像上除 scheduler 类替换在 `:718` 外，其余行号与 2c59ff10 相同。

| 项 | v0.23 | v0.26rc | main |
|---|---|---|---|
| `_ensure_global_patch` 定义 / 三个调用点 | `__init__.py:21` / `:45`、`:55`、`:65` | 同左 | `:55` / `:79`、`:89`、`:99` |
| 平台入口 `adapt_patch(is_global_patch=True)` | `platform.py:188` | `platform.py:187` | `platform.py:304` |
| 平台里的 `init_ascend_config` | `platform.py:475` | `platform.py:431` | `platform.py:492` |
| Worker 入口 `adapt_patch()` / `init_ascend_config` | `worker/worker.py:110` / `:120` | `:119` / `:129` | `:138` / `:148` |
| EPLB 启动补丁的导入条件 | `patch/platform/__init__.py:47-48` | `:45-46`，条件相同 | `:39-40`，条件相同 |
| scheduler 类替换 | `patch_balance_schedule.py:745`，写法 `vllm.v1.core.sched.scheduler.Scheduler = BalanceScheduler` | `:936`，写法改为 `_sched_mod.Scheduler = BalanceScheduler`，效果相同 | `:911`，同 v0.26rc |

三条入口的结构在三个版本里一致，变的只是行号；`daemon=False` 三个版本都在 `patch_multiproc_executor.py:199`。

上游 vLLM：v0.23.0（`0fc695fc`）与 v0.26.0（`568afb3a`）的 executor 默认规则同构，v0.26 在 `parallel.py:883-928` [C44]；启动方法默认仍是 `fork`；`EngineCore.__init__` 仍加载通用插件；单 API server 仍在启动进程里运行，headless 仍留启动进程监视引擎；没配 KV connector、PP 为 1 时，executor 仍只读 TP 0 号 Worker 的结果；Worker 进程标题的拼法相同。vllm-ascend main 配套的上游 vLLM 没有检出，main 侧的 executor 默认值和启动方法按 v0.23 配套上游的结论写，所以 `verified` 只列两个发布分支。

### 源码位置

- 两台机器各起什么：`vllm/entrypoints/cli/serve.py:138-148`（单 API server 就是本进程）、`:173-253`（headless）；`vllm/v1/engine/utils.py:121-170`（`CoreEngineProcManager`）、`:1084-1100`（是否建 DP coordinator）；`vllm/v1/engine/coordinator.py:80-157`。
- 进程标题：EngineCore 在 `vllm/v1/engine/core.py:1118-1137`，Worker 在 `vllm/v1/executor/multiproc_executor.py:997-1031`（依次拼上 `_DP`、`_PP`、`_PCP`、`_TP`、`_DCP`、`_EP`），标题前缀 `VLLM` 与 `setproctitle` 的使用在 `vllm/utils/system_utils.py:184-198`。
- EngineCore 的收发线程：`vllm/v1/engine/core.py:860-965`，注释说明开线程是为了让序列化和前向计算重叠；API server 与 EngineCore 之间的通道细节见[请求代码路径页](request-call-chain.md#进程之间的四条通道)。
- executor：默认值 `vllm/config/parallel.py:776-780`、`:845-890`；`vllm/v1/executor/uniproc_executor.py:45-63`；`vllm/v1/executor/multiproc_executor.py:132-192`（广播队列与起 Worker）、`:495-509`（只读 TP 0 号的结果；PP > 1 时是最后一段 PP 的 TP 0 号）、`:361-365`（配了 KV connector 时不再只读一个，所有 Worker 回传后汇总）、`:686-696`（`daemon=True`）。
- 清单只发差量：`vllm/v1/core/sched/output.py:181-212`，注释写明请求资料缓存在每个 Worker 进程里、之后只发差量，结束名单用来通知 Worker 释放缓存 [C23]。Worker 侧的 `_update_states` 在 `vllm/v1/worker/gpu_model_runner.py:1125-1168`；昇腾版 `vllm_ascend/worker/model_runner_v1.py:748-763` 在异步调度下先做一次回退检查，再交给上游。
- 补丁入口：`vllm_ascend/__init__.py:18-69`、`vllm_ascend/platform.py:184-188`、`vllm_ascend/worker/worker.py:89-120`、`vllm_ascend/utils.py:563-567`；上游侧 `vllm/engine/arg_utils.py:2578-2598`、`vllm/v1/engine/core.py:100-109`、`vllm/v1/worker/worker_base.py:238-247`、`vllm/plugins/__init__.py:69-80`。
- 配置缓存：`vllm_ascend/ascend_config.py:866-925`、`vllm_ascend/platform.py:450-475`。
- scheduler 与引擎入口被换：`vllm_ascend/patch/platform/__init__.py:50`、`patch_balance_schedule.py:661-718`；`vllm/config/scheduler.py:168-188`。
- EPLB：`vllm_ascend/patch/platform/__init__.py:47-48`、`patch/__init__.py:57-66`、`patch/platform/patch_multiproc_executor.py:161-200`、`worker/model_runner_v1.py:530-544`、`eplb/core/eplb_worker.py:403-410`。
- 官方补丁设计文档：`docs/source/developer_guide/Design_Documents/patch.md`。
- 进程账与启动步骤的数字取自主线底稿 01 §A0 第 1–4 步与 §A0.1，请求入口取自 §A1 [A]。

待核：

1. 官方镜像的环境里是否另设了 `VLLM_WORKER_MULTIPROC_METHOD`。教程命令没有设，镜像环境没有查。
2. 本部署在进程列表里实际还有哪些辅助进程、各几个，缺实机的进程列表。
3. spawn 启动时，EngineCore 进程里的 Ascend 配置缓存由哪一步建立；fork 时它继承自父进程。
4. vllm-ascend main 配套的上游 vLLM 没有检出，main 侧 executor 默认值与启动方法未核。
