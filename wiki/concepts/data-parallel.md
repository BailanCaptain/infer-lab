---
id: data-parallel
title: "Data parallel：请求怎样分进两组，空闲的组为什么陪跑"
type: feature
summary: DP 把整份模型复制几份、每份一组卡，请求分给各组各自排队调度，同一个请求的前向不拆开，为的是同时服务更多请求。MoE 模型里专家只放一份、摊在所有组的卡上，MoE 层横跨各组，所以空闲组也要用假输入陪跑同一步；这由 MoE 触发，与是否开 EP 无关。最后落到 GLM 双机的 DP2。
aliases: [Data Parallel, 数据并行, DP, DP rank, data_parallel_size, dp_size, DPEngineCoreProc, DPCoordinator, DP coordinator, DPLBAsyncMPClient, data-parallel-size, 前端负载均衡, dummy run, dummy batch, execute_dummy_batch, 陪跑, DP 执行组, DP 通信组, request wave, START_DP_WAVE]
chapters: ["13"]
order: 30
sources:
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L1398-L1426
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1945
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L1833-L1875
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1118-L1200
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L652-L740
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1453-L1508
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1152-L1162
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1788-L1855
  - vllm@0fc695fc:vllm/v1/engine/coordinator.py#L23-L58
  - vllm@0fc695fc:vllm/v1/engine/coordinator.py#L145-L160
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L331-L332
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L972-L973
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L652-L656
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3408-L3652
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3642-L3652
  - vllm@0fc695fc:vllm/config/parallel.py#L683-L707
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L1257-L1303
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L315-L318
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5383-L5389
  - vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L398-L411
  - vllm@0fc695fc:vllm/v1/engine/input_processor.py#L258-L268
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L1079-L1086
  - vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1205-L1208
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L709-L760
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L796-L850
  - vllm@0fc695fc:vllm/v1/engine/utils.py#L1090-L1096
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L985-L987
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L673-L721
verified: []
evidence: "C"
relations:
  - {to: concurrent-requests, kind: builds-on, note: 两组对齐、图尺寸补齐和空闲组陪跑的整批算例都在那一页，本页只讲机制}
  - {to: expert-parallel, kind: builds-on, note: EP16 横跨两个 DP 组；专家怎样分卡、token 怎样派出去再收回来}
  - {to: engine-processes, kind: builds-on, note: 每组一个 EngineCore，DP coordinator 是单独的进程，按角色计入 20 个进程}
  - {to: collective-communication, kind: builds-on, note: 每步对齐宽度和每 32 步的全局检查用的都是 All-Reduce}
  - {to: tensor-parallel, kind: builds-on, note: 一个 DP 组内部的 8 张卡用 TP 合作算同一批请求}
contradicts: []
updated: "2026-09-29"
origin: seed
---

## DP 是什么？

**Data parallel（DP，数据并行）把整份模型复制成几份，每份放在一组卡上；请求分给这几组，每组各自排队、各自调度。同一个请求始终只在一组里算，它的前向不会被拆成几份。**

先看最简单的情形（示意）：一个模型本来放在一组卡上，现在把它原样复制一份，放到另一组卡上，得到组 0 和组 1。来了 4 条请求 A、B、C、D，A、C 派给组 0，B、D 派给组 1。之后组 0 每一步只算 A、C，组 1 只算 B、D：两组手里的权重一模一样，算的是不同的请求。在普通的**稠密模型**（每个 token 都要过每一层全部参数的模型）里，两组从头到尾互不通信，各算各的。混合专家（MoE）模型的专家部分并不跟着整份复制，后面单独一节讲。

这里的**执行组**是一组卡，加上一个管这组卡的引擎进程 **EngineCore**；引擎里的 **scheduler**（调度器）决定每一步算哪些请求。请求先到**前端**：vLLM 里接收用户请求的 API server 进程，它不跑模型，只负责接 HTTP 请求、把文本分词，再挑一组、把请求送进那组的 EngineCore。每组有自己的等待队列、运行中的批次和请求状态，也有自己的 KV cache 池。[KV cache](kv-cache.md) 是一块显存，存着每个请求已经处理过的位置在每一层算出的 k、v；生成下一个 token 时直接读它，不必把旧位置重算一遍。它属于具体的请求：请求派到哪一组，它的 KV cache 就存在哪一组的池子里。

和 [tensor parallel（TP，张量并行）](tensor-parallel.md)对照着看：TP 把**同一个请求**的一次矩阵乘切给几张卡合算，为的是装得下、算得快；DP 不切请求，而是把**不同的请求**分给不同的组。两者可以叠加：每组内部再用 TP 把一个矩阵分给几张卡合作。

## 为什么需要 DP，代价在哪？

**一组卡同时能服务的请求有上限。多复制一组，就多一条互不干扰的调度线、多一个 KV cache 池，同时在算的请求数大约跟着组数涨；单条请求并不会因此变快。**

上限来自两处：scheduler 每一步排进批次的请求条数和 token 总数都有上限；KV cache 池的空间也有限，每条在跑的请求都要占一块，池子满了，新请求只能排队等。分成两组以后，两个 scheduler 各排各的，每一步各有一份这样的上限；请求到了哪一组，就在哪一组排队、占哪一组的 KV cache。

用示意数算一遍。设一组每一步最多排 4 条请求；有 8 条请求，都已处理完提示词，正处在每步生成 1 个 token 的阶段（示意，先不管处理提示词那一步）：

- **不开 DP。** 本步算 A–D 这 4 条，E–H 这 4 条排队；这一步一共产出 4 个 token。
- **DP2。** 两组各排 4 条：组 0 算 A、C、E、G，组 1 算 B、D、F、H，没有请求在等；两组同时各走一步，一共产出 4 + 4 = 8 个 token。
- **单条请求。** 每条仍是每步 1 个 token，它自己的前向一步也没有变快；变的是同时在算的条数，以及新请求要排多久的队。

```wiki-diagram
file: data-parallel-basics
```

**代价首先是卡和显存。** 在稠密模型里，每组都要放一整份权重：示意一份权重 10 GB，DP2 就要两组卡、共 2 × 10 = 20 GB 放权重，换来同时服务的请求数翻一倍左右。

**其次，加一组也不保证吞吐（单位时间一共产出多少 token）按组数翻倍。** 选组改变的是请求在哪里排队，不会让单次前向变快；吞吐还受输入输出长度、并发数、批次效率（每一步的批次凑得满不满）和两组共用的通信影响。请求少到一组就排得下时，第二组没活可干；排队可能因此变短，两组之间的同步（下一节的混合专家模型才需要）也可能拉长某一步。另外，请求派进某一组以后不再迁移，两组的负载可以长期不均。

## MoE 模型里，两组为什么不能各跑各的？

**MoE 模型开了 DP 以后，attention 和稠密层仍是每组一份、各算各的请求；专家却只放一份，摊在所有组的卡上（常见做法是开 EP：attention 用 DP、专家用 EP）。于是任何一组算 MoE 层，都要别的组同时到场；某组暂时没有请求，也得用一份假输入陪另一组走一步。**

先补两个前置概念。[MoE](moe.md)（mixture of experts，混合专家）把一层里的前馈网络换成许多个并排的小前馈网络，每个叫一个 **expert**（专家）；**router**（打分器）给每个 token 在各个专家上打分，每个 token 只交给分数最高的几个专家去算，再把它们的结果按权重加起来。可供 router 挑选的这一整套专家叫**路由专家**。[expert parallel（EP，专家并行）](expert-parallel.md)把路由专家以整个专家为单位分到不同的卡上：token 选中哪个专家，就把它的向量发到持有那个专家的卡上去算，算完再送回来。

**为什么专家不跟着每组复制一份。** 路由专家数量多，占了 MoE 模型参数的大头。示意：一个 MoE 模型权重 100 GB，其中路由专家 90 GB，attention、稠密层等其余部分 10 GB（和上一节那个稠密模型一样大）。两组各放一整份，要 2 × 100 = 200 GB；其余部分每组一份、路由专家全部卡合起来只放一份，就是 2 × 10 + 90 = 110 GB。开了 EP 时，路由专家以整个专家为单位分放在各组的卡上；不开 EP 时，每个专家被切成片，摊到全部卡上（见[只设 DP、不开 EP 时](#在-vllm-里一个-dp-组由什么组成)）。两种分法都只有一份专家，这几组因此并不各自完整：MoE 层横跨所有组的卡。

**跟着一个 token 走一遍（示意）。** 设一层有 8 个路由专家 e0–e7，组 0 的卡持有 e0–e3，组 1 的卡持有 e4–e7，每个 token 选 2 个专家。组 0 的一个 token 被 router 选中 e1 和 e6：e1 就在本组的卡上，本地算；e6 在组 1 的卡上，这个 token 的向量要发过去，组 1 的卡算完再送回组 0，和 e1 的结果按权重相加。去和回各是一次[集合通信](collective-communication.md)（一组卡按约定一起交换数据）：去的一次叫 **dispatch**（派发，把 token 的向量发到持有所选专家的卡），回的一次叫 **combine**（收回，把专家算出的结果送回 token 所在的卡）。每一次，两组的卡都必须同时进入、同时离开。

无论哪种分法，任何一组算 MoE 层，都要别的组同时参加这层的通信。所以 MoE 模型在 DP>1 时，空闲组要陪跑：某一组暂时没有请求，也得用一份假输入陪另一组走完同一步前向，这叫 **dummy run**（源码里叫 dummy batch）。触发陪跑的是 MoE，不是 EP。

```wiki-diagram
file: data-parallel
```

图按开了 EP 的情形画，GLM 双机就是这样，专家编号沿用上面的示意。新请求只派进组 0。组 1 的等待队列和运行队列都空着，本来可以歇着；但组 0 的 token 在 MoE 层会选中组 1 卡上的专家，这次通信要两组的卡一起进、一起出。组 1 于是跑一步只为陪跑的前向：假输入自己的输出直接丢掉，它替组 0 算的专家结果照常送回组 0。每组内部还可以用 TP 把一个矩阵分给几张卡合作，图里没有画。

在 MoE 模型上，DP 的代价集中在「两组必须一起走」这件事上，每一步有两个等待点，每 32 步再多一个：

1. **前向之前对齐一次。** 两组先做一次 [All-Reduce](collective-communication.md#all-reduce)（各卡按位置相加，每卡都拿到结果），交换本组这一步有多少 token、能不能用预先录好的计算图，再按两组里更宽的那组一起跑。忙的那组决定两组的宽度。
2. **每个 MoE 层的专家通信。** 两组的卡一起派发 token、一起收回结果；任何一张卡慢了，依赖它的另一组也要等。
3. **每 32 步查一次全局。** 两组交换一次「还有没有没做完的请求」，都说没有才一起停。所以最后一条请求结束以后，两组最多还会一起空跑 31 步。

上一节说过，请求派定以后不迁移，两组的负载可以长期不均；在 MoE 模型上这更费：空闲组的开销不看它自己有多少活，只看另一组有多忙。

几种并行放在一起对照。它们分的东西不同，所以能叠加：MoE 模型里常见的组合是每组内部用 TP，attention 按 DP 分组，专家按 EP 摊到全部卡上。

| 并行方式 | 首先分的是什么 | 主要代价 |
|---|---|---|
| TP | 层内的矩阵 | 每层合并部分结果的通信 |
| PP（pipeline parallel，流水线并行） | 模型的层 | 阶段交接和等待（气泡） |
| DP | 请求 | 负载不均；MoE 下每步对齐、空闲组陪跑 |
| EP | 路由专家 | 派发和收回的通信、各卡工作量不均 |

## 在 vLLM 里，一个 DP 组由什么组成？

**每个 DP 组有自己的 EngineCore 进程，里面有自己的 scheduler 和 KV cache 池；组外还有前端和一个 DP coordinator 进程：前端给请求选组，DP coordinator 汇总各组负载，并协调各组一起开工、一起停下。**

- **EngineCore（每组一个）。** 它每一步调度一次，再驱动本组每张卡上的 worker（每卡一个执行模型的进程）跑前向。MoE 模型在 DP 大于 1 时，EngineCore 用的是一个专门的子类，多出上文的陪跑逻辑。非 MoE 模型的各组互不依赖，vLLM 直接把每组当成 DP=1 运行，既不每步对齐，也不陪跑。
- **前端（API server 进程）。** 第一节说过，它接收 HTTP 请求、把文本分词，按下一节的分数给请求选组，再直接送进那组的 EngineCore；每条请求派到了哪一组，也记在它这里。它不跑模型。
- **DP coordinator（整个部署一个）。** 它做两件事：一是收集每组等待队列和运行队列的长度，至少隔 100 ms 推给前端一次，供选组用；二是记住各组现在是一起在跑还是一起停着，某一组收到新请求时，向其他组广播一条唤醒消息。它不转发请求，也不参加每一步的对齐。
- **request wave。** 各组在「一起运行」和「一起暂停」两种状态之间切换；每从运行切到暂停一次，一个编号加 1，这个编号叫 request wave。调试日志里看到的 wave 就是它。

两台机器上一共有哪些进程、DP coordinator 按什么口径计入「20 个进程」，见[双机部署里一共有哪些进程](engine-processes.md#双机部署里一共有哪些进程)。

源码里「DP 组」还有第二层意思，读日志和源码时要分开：

- **DP 执行组**：上面说的调度单位，有几个 DP 就有几组。
- **DP 通信组**：各执行组里 TP 位置相同的卡配成一组，每步的对齐就在这种组里做。每个执行组有几张卡，就有几个这样的通信组；每个通信组的卡数等于 DP 数。

开了 EP 的 MoE 模型，EP 组把所有执行组的全部卡都包进来：EP 卡数 = DP 数 × 每组 TP 卡数（上下文并行不开时；上下文并行是把一条长请求的不同位置分给几张卡去算）。所以 EP 和 DP 不是二选一：attention 和稠密层按 DP 执行组各算各的请求，专家按 EP 组摊在全部卡上，也就是前面说的「attention 用 DP、专家用 EP」。

```wiki-diagram
file: dp-ep-groups
```

图里横着的每个框是一个 DP 执行组，也是一个 TP 组；rank 是卡在通信组里的编号。rank 0 和 rank 2 在各自组里的位置相同，配成 DP 通信组 {0,2}；rank 1 和 rank 3 配成 {1,3}。四张卡合起来是一个 EP 组，每张卡持有四分之一的路由专家，两个执行组的 token 都往这四张卡上派。图是缩小的逻辑示意，不是官方双机规模，四张卡也不是各存一份完整模型。

GLM 的 MoE 层按 EP 组里的编号和大小，算出本卡持有哪一段连续的专家。专家怎样分卡、token 怎样派发和收回，属于 [EP](expert-parallel.md) 的内容；请求归属和 attention 的状态始终按 DP 执行组追踪。

只设 DP、不开 EP 时，专家不会整份分到各卡。上游 FusedMoE（vLLM 里实现 MoE 层的通用模块）的并行配置这时把 MoE 层按 TP 的方式切到全部 DP × TP 张卡上：每个专家的矩阵都被切成这么多片，每张卡各拿一片。所以 MoE 层照样横跨各组，各组照样要一起走；变的只是分法，从「整个专家分给不同的卡」变成「每个专家切成片」。反过来，只看到 DP 这个设置，推不出专家已经按 EP 分卡。

## 请求怎样派进某一组？

**默认由前端给每组打一个分：等待队列的条数 × 4 + 运行队列的条数，挑分数最小的那组。请求一旦派定，就一直留在那组。**

源码没有写明为什么是 4 倍，可以这样理解：等待中的请求还没开始 prefill（处理提示词），接下来要先占一大段 token 预算，所以一条等待的请求按 4 条运行中的请求来算。

用两组 DP0、DP1 看一个例子（数字是示意）：某一刻 DP0 有 1 条在等、24 条在跑，DP1 有 4 条在等、14 条在跑。DP0 得 1 × 4 + 24 = 28 分，DP1 得 4 × 4 + 14 = 30 分。只数条数，DP1 一共 18 条，比 DP0 的 25 条少；但 DP1 那 4 条还没做 prefill，接下来几步要先吃掉这组每步 token 预算里的一大块，所以新请求派给分数更低的 DP0。反过来，如果两组都没有等待的请求，分数就只是运行的条数，4 倍不起作用；主线的场景 M 就是这样，见[多条请求的第 1 站](concurrent-requests.md#第-1-站-入口新请求先挑一个-dp-组)。

前端手里的计数来自 DP coordinator 的定期推送，两次推送之间可能已经过时；所以前端每派出一条请求，就先在本地给那组的等待计数加上一笔（以 GLM 双机为例，只起一个 API server，这一笔就是 1），免得一串请求在两次推送之间全落到同一组。接着上面的例子：派出这条以后，前端本地把 DP0 记成 2 条在等，分数变成 2 × 4 + 24 = 32；下一次推送到来之前再来一条，32 比 30 大，这条就派给 DP1。主线的示例请求 R1（提示词只有 4 个 token 的单条请求）怎样落到 DP0，见[一条请求的第 1 站](one-request.md#第-1-站-入口从-http-到-node0-的引擎)。

派定的同时，前端记下这条请求归哪一组，中途取消时按这份记录去找。之后分数怎么变，已派出的请求都不会自动迁移：它的 KV cache 在那组的池子里，每一步都由那组的 scheduler 安排，搬到另一组需要额外的机制，这里没有。

打分只是默认路径。上游路由可以通过请求头直接指定组号，前端就不再打分；外部负载均衡等其他部署方式，也可以在入口之前就把请求分好。所以这个公式是 vLLM 默认前端的选择规则，不是 DP 的定义。

## 两组每一步怎样对齐宽度？

**每一步前向之前，每张卡和另一组里 TP 位置相同的那张卡做一次 All-Reduce，交换这一步的 token 数和图模式；token 数取两组的最大值，图模式取两组里最保守的那个。**

参加同一次集合通信的卡，必须按相同的次序、用对得上的形状进来。两组的 scheduler 各排各的，这一步的 token 数几乎总是不同，所以前向之前要先对一次口径。交换的内容是一个两行的小整数表，每组占一列：

- **第一行是 token 数。** 每组只在自己那一列填数，别的列留 0。All-Reduce 按位置相加以后，每张卡都拿到各组的数，再在本地取最大值。比如两组本地是 3 和 1：一组填 [3,0]，另一组填 [0,1]，相加得 [3,1]，两边各自取最大值 3。这里的「组」按 DP 编号排列，和全局的卡号分开计。
- **第二行是图模式。** **graph mode**（图模式）是把启动时录好的一串算子整段回放，省掉逐个下发的开销；**eager mode** 是逐个下发算子。两边相加后本地取最小值：只要有一组这一步用不了图（比如混进了 prefill），两组都退回 eager。

两组填进去的 token 数，已经先按本组能用的图尺寸往上补过一次。拿到最大值以后，本组这一步能用图时（或者开了序列并行等几个选项时），就把自己的宽度换成两组的最大值，多出来的行是填充；本组这一步本来就是 eager 时，保留自己的真实宽度。**MTP**（multi-token prediction：每步先用一个小的草拟模型多猜几个 token，再交给主模型一起验证）的草拟模型不进图，但一律按两组的最大值跑。MoE 层的通信规模也按这个最大值定。专家通信有两种做法：**MC2** 是昇腾把专家计算和通信合在一起做的一种实现，按每个 token 选中的专家逐个发送；**AllGather** 路径先把两组的输入都收齐，每张卡再只算自己持有的专家。以 GLM 双机为例，两组里最宽的那组一过 128 行，两台机器就一起从 MC2 换成 AllGather，判断方法见[一条请求的 MoE 通信](one-request.md#moe-通信走-mc2-还是-allgather)。

这次交换默认走 CPU 上的 gloo 通道。非 MoE 模型直接跳过它；MoE 模型只有在 PD 分离（prefill 和 decode 分给不同实例来跑）里接收 KV 的那一端、并且满足特定的 MC2 条件时才跳过。GLM 双机是 MoE，也没有配 KV 传输，所以每一步都做，前向走 eager 时也不省。整批补齐怎样一格一格算出来，见[多条请求：再补到两组的最大值](concurrent-requests.md#再补到两组的最大值)。

## 空闲的组由谁叫起来陪跑，陪跑时算什么？

**没有请求的那组由它自己的 EngineCore 决定陪跑：只要全局还有请求没做完，它每一步都让本组每张卡用一条 decode 请求（已经处理完提示词、每步往后生成的请求）大小的假输入跑一次前向，再按对面的宽度对齐。** 这一节讲机制，陪跑在真实场景下被拉到多宽，算例统一放在[多条请求：空闲的 DP 组为什么还要陪跑](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)。

### 为什么非跑不可

集合通信要求组里每个成员都到场。上一节的对齐 All-Reduce 每一步都要两组各出一张卡；每个 MoE 层的专家通信，要两组的卡一起派发、一起收回。空闲组如果停下，忙的那组就会卡在这两个地方一直等它。

它到场也不只是凑数。开了 EP 时，空闲组的卡上有另一部分专家，忙的那组的 token 选中这些专家时，就是空闲组的卡在算；不开 EP 时，空闲组的卡上是每个专家的一部分切片，对面的 token 不论选中哪个专家，都有一部分在这里算。陪跑一步里，**假输入自己的输出被丢掉，替对面算的专家结果照常送回去**。

### 谁来决定跑

不是忙的那组来叫，也不是 DP coordinator 每一步下令，而是空闲组自己的 EngineCore 主循环。每转一圈，它先处理输入队列，再尝试调度并执行一步；如果这一步本地一条请求都没执行，就看两件事：本地还有没有没做完的请求，**全局运行标志**（每个 EngineCore 记着的一个开关：各组此刻是否还在一起运行）是不是还亮着。两个都否，就空转，不进前向；只要有一个是，就跑一次 dummy batch。

```wiki-diagram
file: data-parallel-loop
```

全局运行标志在三种时候变化：本组有了新请求、正常执行起来以后亮起；收到 DP coordinator 广播的唤醒消息时亮起；每 32 圈做一次全局检查，两组都说没活了才熄灭。所以陪跑不是「每组每步固定加一个假 token」：本地有请求可算的那一步，就正常算请求，不跑假输入；本地没东西、全局也停了的时候，也不跑。

### 陪跑时算什么

EngineCore 通过 executor（管本组所有 worker 的对象）让本组每个 worker 各跑一次 dummy run。每张卡造的假输入是**一条 decode 请求走一步的形状**：token 数 = 1 + 草拟模型每步猜的 token 数，标成整齐的 decode 批次。这是一步整齐 decode 能有的最小形状；GLM 开了 MTP、每步草拟 3 个，所以是 4 个 token。

这 4 个 token 只是本地起点。假输入和真请求一样，要经过上一节的对齐：对面这一步是能用图的纯 decode，它就补到同样的图尺寸，一起回放；对面混进了 prefill，它就被拉到对面的宽度，一起走 eager。然后它跑满整个网络，MTP 的草拟模型也按对齐后的宽度陪跑一次。其中的集合通信（机内 TP 的归约、跨机的专家派发和收回）照常和别的卡交换数据，其余计算只在本卡上走一遍。算完的结果不交给任何请求，直接丢掉；替对面算的专家贡献已经在 MoE 层送回去了。

### 什么时候停，怎样再叫醒

两组每 32 圈做一次 All-Reduce，交换两个数：本地还有没有没做完的请求，本地是否收到了暂停请求（运维主动让引擎暂停时用，各组都同意才真停）。两边相加，只要有一组还有活，就继续转；两组都没活，全局运行标志才熄灭，两组一起停下，request wave 编号加 1，DP0 的 EngineCore 把「这一波结束」报给 DP coordinator。检查只在第 32、64、96……圈做，所以最后一条请求结束后，两组最多还会一起空跑 31 步。

新请求到来时，前端把它送进选中的那一组，那组有了本地请求，下一圈就正常执行，全局运行标志也随之亮起；如果各组正停着，前端同时通知 DP coordinator，由它向其他组广播唤醒消息，让它们也亮起标志、开始陪跑。某组收到一条属于已结束那一波的请求时，也会自己开工并通知 DP coordinator 去叫醒其他组。

## 放到 GLM 双机：每台机器一个 DP 组

**官方双机是 DP2：node0、node1 各是一个 DP 执行组，组内 8 张卡用 TP8 合作；EP16 横跨两组，node1 的 8 张卡持有编号 E144–E287 的这一半路由专家（每个 MoE 层 288 个路由专家，编号 E0–E287）。** 部署参数见[部署前提](glm-5-3-flash-two-node.md#部署前提)，每卡持有哪些专家见 [EP 的连续编号表](expert-parallel.md#放到-glm-双机一个-token-走过一层-moe)。

按「一步」从头走一遍：

1. **进程。** node0 上有 API server、DP coordinator 和 DP0 的 EngineCore；node1 用 headless 模式启动，不建前端，只有 DP1 的 EngineCore。每个 EngineCore 各管本机 8 个 worker。进程清单见[双机部署里一共有哪些进程](engine-processes.md#双机部署里一共有哪些进程)，启动先后见[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)。
2. **派组。** 请求先到 node0 的 API server，由它按上面的分数挑 DP0 或 DP1，再直接送进那组的 EngineCore。每组的 scheduler 每一步最多排 32 条请求、8192 个 token（取值见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)），两组各有一份这样的上限；打分例子里说的「每步 token 预算」在本部署就是这 8192。
3. **对齐。** 16 张卡按跨机同号配成 8 个 DP 通信组，{0,8}、{1,9} 一直到 {7,15}，每组两张卡；每一步前向之前，8 组各做一次对齐，拿到同一个宽度。分组表见 [16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)。
4. **前向。** 两组按对齐后的宽度跑 45 层主干。每个 MoE 层，两组的 token 在 16 张卡之间派发和收回；两组里最宽的一组过了 128 行，两台机器一起换成 AllGather。
5. **全局检查。** 每 32 步，两个 EngineCore 交换一次「还有没有活」。

这套部署里，陪跑几乎一直在发生。主线的 R1 在 DP0 上算的时候，node1 一条请求都没有，每一步都在跑 dummy batch，见[一条请求的第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)。到了 decode 步，DP0 是 1 条请求、4 个 token，DP1 的假输入也是 4 个 token，两边对齐后一起回放 4 个 token 的图。

负载一不均，忙的那组就决定两组的宽度。用主线的**场景 M** 看：DP0 有 12 条 decode 请求，又新来一条 6000 token 的请求；DP1 有 7 条 decode 请求（设定见[示例场景 M 与变体 M′](concurrent-requests.md#示例场景-m-与变体-m)）。纯 decode 那一步，两组都按 64 宽回放图；DP0 混进 6000 token 的 prefill 那一步，两组都按 6048 宽走 eager，DP1 真正有用的只有 28 行。变体 **M′** 里 DP1 一条请求都没有，它的 dummy batch 从本地 4 个 token 出发，同样被拉到 64 或 6048。这些宽度一格一格怎么来，见[空闲的 DP 组为什么还要陪跑](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)和 [EP 页的陪跑小节](expert-parallel.md#两个-dp-组为什么要陪跑)。

显存也不能按 DP 数乘除。attention、稠密层和共享专家每台机器各有一份，288 个路由专家 16 张卡合起来只有一份，所以每台机器既不是一份完整模型，也不是半份；要分别看权重、KV cache、请求状态和运行时缓冲各放在哪。逐项账见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。

## 常见误解

- **「每个 DP 组都是一份完整的模型副本。」** 稠密模型是这样；MoE 模型不是。在 GLM 双机里，路由专家分在两组的 16 张卡上，两组合起来才是一份完整模型。任何一组算 MoE 层都离不开另一组，这正是要陪跑的原因。
- **「DP 把一个请求拆成几份并行算。」** DP 分的是请求。一个请求从头到尾只在一组里，它的前向在这组内部由 TP 分给 8 张卡。
- **「空闲组每一步都固定跑一个假 token。」** 只有本地这一步没执行任何请求、而全局还在运行时才跑；假输入本地是一条 decode 请求的形状（本部署 4 个 token），对齐后宽度跟着对面走，可能是 64，也可能是 6048。
- **「陪跑的组什么都没干，算的全是废的。」** 假输入自己的输出被丢掉，但它替忙的那组算的专家结果是真的，要送回去用。补齐的行和空批次也不会多出任何用户请求。
- **「空闲组不花钱。」** 它的开销由另一组有多忙决定。对面混进长 prefill 时，它也按几千行的宽度走完整个网络；请求量长期只够喂一组时，另一组的卡一直在陪跑，这一半算力没有产出。
- **「分数变了，请求会挪到更闲的组。」** 派定以后不迁移；它的 KV cache 和调度都在原来那组。
- **「加一组，吞吐就翻倍。」** 吞吐还受输入输出长度、并发、批次效率和两组共用的通信影响；MoE 下两组每步还要对齐和互相等待。
- **「设了 DP，专家就按 EP 分卡了。」** 专家整份分卡要另外打开 EP；不开 EP 时，上游 FusedMoE 把每个专家切成片摊到全部卡上。

## 对照源码

### 怎么开

双机两端各自的完整启动参数见[双机部署的「怎么开」](glm-5-3-flash-two-node.md#怎么开)。和本页直接相关的是：

- `--data-parallel-size 2`：一共几个 DP 执行组；`--data-parallel-size-local 1`：本机起几个，所以每台机器一个 EngineCore。
- `--enable-expert-parallel`：专家整份分到 EP 组的各张卡上；不开时，上游 FusedMoE 把 MoE 层按 TP 方式切到全部 DP × TP 张卡上。
- 陪跑没有单独的开关：MoE 模型在 DP 大于 1 时自动用 `DPEngineCoreProc`，DP coordinator 也只对 MoE 模型打开 wave 协调。非 MoE 模型的各组按 DP=1 运行。
- 指定一条请求去哪一组：请求头 `X-data-parallel-rank: 0` 或 `1`，前端就不再打分；不带时按 `waiting * 4 + running` 选组。
- v0.23 的 `additional_config` 里有 `dp_allreduce_on_npu`，默认关；打开后每步对齐从 CPU 的 gloo 通道改走 NPU 通道。

### 会报什么错

- 请求头给的组号越界时，入口报 `ValueError`，信息是 `data_parallel_rank 2 is out of range [0, 2).`。请求头的值不是整数时不报错，按没指定处理。
- 暂停还没在各组之间达成一致就调用恢复，报 `RuntimeError: resume_scheduler called while pause is still in flight. Wait for the pause future to resolve before resuming.`。
- 认站用的 debug 日志：两组一起停下时 DP0 打印 `Wave %d finished, pausing engine loop.`；被唤醒的组打印 `EngineCore starting idle loop for wave %d.`。
- 一组的 EngineCore 或 worker 没有进入对齐 All-Reduce 或专家通信时，另一组会停在那次通信上；具体报出什么超时信息，见页末待核。

### 开销和什么时候别开

- **每步一次对齐 All-Reduce。** 张量只有 2 × DP 个 int32，但每步都做，前向走 eager 时也不能省；源码注释把这一点记为待改的性能问题。
- **空闲组陪跑。** 陪跑一步的宽度和图模式都跟着忙的那组走；本部署下混进长 prefill 的那一步，空闲组要按几千行走完整个网络，草拟模型也陪跑。
- **每 32 步一次全局检查。** 用一次求和的 All-Reduce 同时判断「谁还有活」和「是否都同意暂停」；换来的是最后一条请求结束后最多 31 步的空跑。
- **负载不均。** 请求派定不迁移，打分依赖至少 100 ms 刷新一次的计数。
- **什么时候别开：** 请求量长期只够喂一组时，多开的组大部分时间在陪跑。对 GLM 双机来说 DP2 是部署定下来的：一台机器装不下全部专家，两台合起来才够，理由见[为什么是两台机器，不是一台](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)。

### 版本差异

上游控制流（EngineCore 主循环、DP coordinator、选组打分）按 `vllm@0fc695fc` 读。执行侧按知识库固定快照核对：v0.23 列是 vllm-ascend 维护分支 2c59ff10，v0.26 列是 2ed6cbba，main 列是 baa023ad。**本页 GLM 算例读的是本部署专用镜像 db701c1f，它是另一个 orphan commit，不算进 v0.23 列：GLM 的 MoE 模型代码只在镜像里，2c59ff10 上没有。**下表 v0.23 列按 2c59ff10 写；对齐规则、通道开关、dummy batch 的 token 数在镜像上内容逐字相同，只是行号整体偏移（每步对齐那个方法在 2c59ff10 是第 673–721 行，镜像是第 692–740 行），唯一的实质差别是镜像的 dummy batch 不先记显存统计。

| 项目 | v0.23 | v0.26[C22][C24] | main[C23][C25] |
|---|---|---|---|
| dummy batch 本地的 token 数 | `decode_token_per_req` = 1 + 草拟 token 数 | `uniform_decode_query_len`；它继承自上游，`vllm@0fc695fc` 里同样是 1 + 草拟 token 数 | 同 v0.26 |
| dummy batch 的额外动作 | 先记一次显存统计；不传 GDN 状态开关（镜像 db701c1f 连显存统计也没有） | 先记一次显存统计；传 `skip_gdn_state_update=True`，假输入不更新 GDN 类线性注意力的递推状态 | 同 v0.26 |
| 每步对齐走哪条通道 | 默认 CPU gloo，`dp_allreduce_on_npu` 可改走 NPU | 固定 CPU gloo，没有这个选项 | 同 v0.26 |
| 对齐规则 | 两行求和后本地取最大 / 最小；本组能用图时补到最大值；草拟一律取最大；非 MoE 跳过 | 一致 | 一致 |

### 源码位置

| 要核对什么 | 固定源码位置 |
|---|---|
| 选组打分、记录请求归属 | `vllm@0fc695fc:vllm/v1/engine/core_client.py#L1398-L1426` |
| 请求头取组号、组号越界检查 | `vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L398-L411`；`vllm@0fc695fc:vllm/v1/engine/input_processor.py#L258-L268` |
| 只有 MoE 模型用 `DPEngineCoreProc`、开 wave 协调 | `vllm@0fc695fc:vllm/v1/engine/core.py#L1152-L1162`；`vllm@0fc695fc:vllm/v1/engine/utils.py#L1090-L1096` |
| 主循环：何时跑 dummy batch、每 32 步的全局检查 | `vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1945`；`vllm@0fc695fc:vllm/config/parallel.py#L683-L707` |
| 收到请求开工、处理 `START_DP_WAVE`、恢复时的报错 | `vllm@0fc695fc:vllm/v1/engine/core.py#L1788-L1855` |
| DP coordinator 的职责、计数推送间隔 | `vllm@0fc695fc:vllm/v1/engine/coordinator.py#L23-L58`；`vllm@0fc695fc:vllm/v1/engine/coordinator.py#L145-L160` |
| dummy batch 的下发链 | `vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L331-L332` → `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L972-L973` → `vllm_ascend/worker/model_runner_v1.py#L652-L656` |
| `_dummy_run` 经过对齐、草拟模型陪跑 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3408-L3452`；`#L3642-L3652` |
| 每步对齐、图模式取最小、通道开关、跳过条件 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L692-L740`；`#L5383-L5389`；`vllm_ascend/ascend_config.py#L315-L318`；`vllm_ascend/utils.py#L1257-L1303` |
| DP 通信组与 EP 组怎样建、EP 横跨 DP × TP | `vllm@0fc695fc:vllm/distributed/parallel_state.py#L1833-L1875`；`vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1118-L1200` |
| GLM MoE 层按 EP 编号算本卡专家范围 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1453-L1508` |
| v0.23 列的 dummy batch 与每步对齐 | `vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L985-L987`；`vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L673-L721` |

**证据索引。** 分组、EngineCore 与 DP coordinator 的构成见 [C7][C9][C26]；打分、请求头与越界、不迁移、约 100 ms 的计数刷新见 [C1][C20][C21]；每步对齐的两行表、取最大 / 最小、补齐与跳过条件、通道开关见 [C5][C19][C17][C18]；陪跑的判断、32 步检查与停下见 [C2][C16]；唤醒与恢复时的报错见 [C8]；假输入的形状（1 + 草拟 token 数）见 [C5]，下发链见 [C12]；假输入经过对齐、草拟模型陪跑见 [C14]；DP 通信组、EP 组与不开 EP 时的切法见 [C3][C4]；GLM 专家范围见 [C6]。

以下几条是由上述源码推出或本页的理解：DP 通信组有几组、每组几张卡，由通信组的建法推出 [D]；本部署每一步都做对齐，由跳过条件加上本部署是 MoE、未配 KV 传输推出 [D]；最后一条请求结束后最多空跑 31 步，由每 32 步检查一次推出 [D]；空闲组替对面算的专家结果要送回、它的开销由对面的宽度决定，由对齐规则和 EP 的派发、收回推出 [D]；每台机器既不是完整模型也不是半份、显存不能按 DP 数乘除，由权重在 16 张卡上的放法推出 [D]；等待数按 4 倍计的原因源码没有写，正文的说法是本页的理解 [I]；场景 M、M′ 与 R1 的宽度取自主线底稿 01 §B1、03 §B4，推导在 concurrent-requests 与 one-request [D]。

**待核：**

- `_dummy_run` 内部是否有某些层走了简化路径：`model_runner_v1.py#L3470-L3600` 尚未逐行读。
- 一组没有进入通信时另一组报出的具体超时信息：缺实机日志。
- 陪跑一步的真实耗时（45 层加 16 卡专家通信的固定开销）：缺实测。
- v0.26、main 配套的上游 vLLM 版本里，EngineCore 主循环和选组打分是否与 `vllm@0fc695fc` 一致：缺配套 commit 的钉点。
