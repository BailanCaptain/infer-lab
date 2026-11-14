---
id: data-parallel
title: Data parallel：请求怎样分进两组，空闲的组为什么陪跑
type: feature
summary: >-
  DP 把请求分给不同执行组，各组独立排队调度。稠密模型通常每组持有一份权重；本页固定 vLLM 的 MoE
  路由专家跨组切分，因此一个请求虽然归属一组，专家计算仍需其他组参加，空闲组也要陪跑；这由 MoE 触发，与是否开 EP 无关。最后落到 GLM
  双机的 DP2。
aliases:
  - Data Parallel
  - 数据并行
  - DP
  - DP rank
  - data_parallel_size
  - dp_size
  - DPEngineCoreProc
  - DPCoordinator
  - DP coordinator
  - data-parallel-size
  - data_parallel_size_local
  - data-parallel-size-local
  - 前端负载均衡
  - dummy run
  - dummy batch
  - execute_dummy_batch
  - 陪跑
  - DP 执行组
  - DP 通信组
  - request wave
  - START_DP_WAVE
chapters:
  - '13'
order: 30
sources:
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L1398-L1426'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1945'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1833-L1875'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1118-L1200'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L652-L740'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1453-L1508'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1152-L1162'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1788-L1855'
  - 'vllm@0fc695fc:vllm/v1/engine/coordinator.py#L23-L58'
  - 'vllm@0fc695fc:vllm/v1/engine/coordinator.py#L145-L160'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L331-L332'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L972-L973'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L652-L656'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3408-L3652'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3642-L3652'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L683-L707'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1257-L1303'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L315-L318'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5383-L5389'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L398-L411'
  - 'vllm@0fc695fc:vllm/v1/engine/input_processor.py#L258-L268'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L1079-L1086'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/worker.py#L1205-L1208'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L709-L760'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L796-L850'
  - 'vllm@0fc695fc:vllm/v1/engine/utils.py#L1090-L1096'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L985-L987'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L673-L721'
  - >-
    raw:sha256-6301828dd37d1286329eea1c26e42e604f1d126e743d346e00820b0fdb7dc175.md#L1-L1142
  - 'vllm@0fc695fc:vllm/v1/pool/late_interaction.py#L15-L36'
  - 'vllm@0fc695fc:vllm/v1/engine/coordinator.py#L254-L278'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L118-L129'
  - 'vllm@568afb3a:vllm/config/parallel.py#L127-L138'
  - 'vllm@84030bbe:vllm/config/parallel.py#L129-L140'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L471-L474'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L999-L1022'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1817-L1928'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L1964-L2077'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L2145-L2290'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L441-L450'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L801-L835'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/model_runner_v1.py#L825-L885'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L1268-L1271'
  - 'vllm@ced6857a:vllm/config/parallel.py#L145-L145'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L2016-L2016'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L2263-L2271'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2898-L3012'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3332-L3363'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1707-L1758'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L804-L818'
  - 'vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L139-L148'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L94-L123'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L652-L682'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1542-L1549'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1962-L1970'
  - 'vllm@0fc695fc:vllm/envs.py#L1297-L1309'
verified: []
evidence: C
relations:
  - to: concurrent-requests
    kind: builds-on
    note: 两组对齐、图尺寸补齐和空闲组陪跑的整批算例都在那一页，本页只讲机制
  - to: expert-parallel
    kind: builds-on
    note: EP16 横跨两个 DP 组；专家怎样分卡、token 怎样派出去再收回来
  - to: engine-processes
    kind: builds-on
    note: 每组一个 EngineCore，DP coordinator 按核心功能角色计入 20 的示意账，实际 OS 总进程数另计
  - to: collective-communication
    kind: builds-on
    note: 每步对齐宽度和每 32 步的全局检查用的都是 All-Reduce
  - to: tensor-parallel
    kind: builds-on
    note: 一个 DP 组内部的 8 张卡用 TP 合作算同一批请求
contradicts: []
updated: 2026-11-10T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-6301828dd37d1286329eea1c26e42e604f1d126e743d346e00820b0fdb7dc175.md
  - >-
    raw/sha256-9766ffa0dff16ec93855d88a4128e0016c8db8916074129633b4953322437448.md
---

## DP 是什么？

**Data parallel（DP，数据并行）把不同请求分给不同执行组，各组各自排队、各自调度。稠密模型通常每组放一份相同权重；同一请求归属一个组，组内还可用其他并行方式合作计算。MoE 模型的专家计算可以跨组，后面单独解释。**

先看最简单的情形（示意）：一个模型本来放在一组卡上，现在把它原样复制一份，放到另一组卡上，得到组 0 和组 1。来了 4 条请求 A、B、C、D，A、C 派给组 0，B、D 派给组 1。之后组 0 每一步只算 A、C，组 1 只算 B、D：两组手里的权重一模一样，算的是不同的请求。这里采用普通的**稠密模型**：前馈部分没有按 token 选择专家的路由，两组的模型前向各算各的，无需跨 DP 组通信。这不表示词嵌入每次都会读取全部词表。混合专家（MoE）模型的路由专家在本页固定实现中跨组分放，后面单独一节讲。

这里的**执行组**是一组卡，加上一个管这组卡的引擎进程 **EngineCore**；引擎里的 **scheduler**（调度器）决定每一步算哪些请求。请求先到**前端**：vLLM 里接收用户请求的 API server 进程，它不跑模型，只负责接 HTTP 请求、把文本分词，再挑一组、把请求送进那组的 EngineCore。每组有自己的等待队列、运行中的批次和请求状态，也有自己的缓存池。[KV cache](kv-cache.md) 保存继续计算所需的历史结果；普通 attention 保存 K/V，GLM 的 MLA 保存压缩历史，KDA 另有卷积与递推状态，不能统一当作“每层每位置一对 K/V”。这些缓存与状态按请求归属管理：请求派到哪一组，就使用哪一组的池子。

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

**跟着一个 token 走一遍（示意）。** 设一层有 8 个路由专家 e0–e7，组 0 的卡持有 e0–e3，组 1 的卡持有 e4–e7，每个 token 选 2 个专家。组 0 的一个 token 被 router 选中 e1 和 e6：e1 就在本组的卡上，本地算；e6 在组 1 的卡上，这个 token 的向量要发过去，组 1 的卡算完再送回组 0，和 e1 的结果按权重相加。去和回各是一次[集合通信](collective-communication.md)（一组卡按约定一起交换数据）：去的一次叫 **dispatch**（派发，把 token 的向量发到持有所选专家的卡），回的一次叫 **combine**（收回，把专家算出的结果送回 token 所在的卡）。每一次，两组的卡都要按兼容的次序参加；用到通信结果的计算须等相关结果就绪，不要求所有卡在同一时刻进入或返回。

无论哪种分法，任何一组算 MoE 层，都要别的组参加同一轮通信。所以 MoE 模型在 DP>1 时，空闲组要陪跑：某一组暂时没有请求，也得用一份假输入陪另一组走完同一步前向，这叫 **dummy run**（源码里叫 dummy batch）。触发陪跑的是 MoE，不是 EP。

在本页固定的上游控制流快照中，负责推进引擎执行循环的 EngineCore 进程也区分这两类模型：启用 DP 的 MoE 模型使用带 DP 协调职责的进程类型；非 MoE 模型则把每个执行组内部的 DP 大小和本地 DP 大小都设为 1，另用索引保留原始组编号。因此，前端把请求分给多个组，与各组内部是否需要走 MoE 的 DP 协调路径，是两个不同的问题。

```wiki-diagram
file: data-parallel
```

图按开了 EP 的情形画，GLM 双机就是这样，专家编号沿用上面的示意。新请求只派进组 0。组 1 的等待队列和运行队列都空着，本来可以歇着；但组 0 的 token 在 MoE 层会选中组 1 卡上的专家，这次通信需要两组都参与。组 1 于是跑一步只为陪跑的前向：假输入自己的输出直接丢掉，它替组 0 算的专家结果照常送回组 0。每组内部还可以用 TP 把一个矩阵分给几张卡合作，图里没有画。

在 MoE 模型上，DP 的代价集中在「两组必须一起走」这件事上，每一步有两个等待点，每 32 步再多一个：

1. **前向之前对齐一次。** 两组先做一次 [All-Reduce](collective-communication.md#all-reduce)（各卡按位置相加，每卡都拿到结果），交换本组这一步有多少 token、能不能用预先录好的计算图。在这里讨论的普通同步路径中，允许为 DP 补齐输入位置，或正在执行草拟模型时，两组才统一采用较大的 token 数；草拟模型先猜出候选 token，再交给主模型验证。不满足这两个条件时，各组保留自己的 token 数。补齐的位置不等于请求新增的真实输入位置。计算图模式也需要协调：只要任意一组选择不使用计算图，两组最终都不使用计算图。因此，不能仅凭某一组自身的输入判断它最终采用的执行宽度和计算图模式。
2. **每个 MoE 层的专家通信。** 两组的卡一起派发 token、一起收回结果；任何一张卡慢了，依赖它的另一组也要等。
3. **每 32 步查一次全局。** 两组交换「还有没有没做完的请求」及暂停共识状态。没有新请求、也没有尚待达成的暂停共识时，最后一条请求结束以后最多还会空跑 31 步。

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
- **DP coordinator（整个部署一个）。** 它做两件事：一是收集每组等待队列和运行队列的长度，推给前端供选组用；最小统计更新间隔默认是 100 ms，实际推送还受统计是否变化等条件影响，并非固定每 100 ms 一次。二是记住各组现在是一起在跑还是一起停着，某一组收到新请求时，向其他组广播一条唤醒消息。它不转发请求，也不参加每一步的对齐。
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

这里及下文的打分例子、本地等待计数补偿，都限于普通负载选择分支。选组有先后顺序：请求已指定 DP rank（执行组编号）时，使用指定组；未指定时，尝试 late-interaction 专用选择。这里的 late-interaction 请求用于缓存查询向量或给文档评分；同一查询标识的这些请求需要到同一引擎，才能使用保存在该进程中的查询向量。只有这两个分支都没有给出结果，才按上述分数选组并更新本地等待计数。

源码没有写明为什么是 4 倍，可以这样理解：等待中的请求还没开始 prefill（处理提示词），接下来要先占一大段 token 预算，所以一条等待的请求按 4 条运行中的请求来算。

上面对 prefill 开销的解释是帮助理解权重的推测，材料没有证明它就是系数 4 的设计原因。这个分数只按等待和运行的请求条数计算，没有直接比较请求长度或剩余计算量；分数较低表示按这条规则优先被选中，不表示剩余工作一定更少，也不表示新请求一定更快完成。

用两组 DP0、DP1 看一个例子（数字是示意）：某一刻 DP0 有 1 条在等、24 条在跑，DP1 有 4 条在等、14 条在跑。DP0 得 1 × 4 + 24 = 28 分，DP1 得 4 × 4 + 14 = 30 分。只数条数，DP1 一共 18 条，比 DP0 的 25 条少；但 DP1 那 4 条还没做 prefill，接下来几步要先吃掉这组每步 token 预算里的一大块，所以新请求派给分数更低的 DP0。反过来，如果两组都没有等待的请求，分数就只是运行的条数，4 倍不起作用；主线的场景 M 就是这样，见[多条请求的第 1 站](concurrent-requests.md#第-1-站-入口新请求先挑一个-dp-组)。

前端手里的计数来自 DP coordinator 的定期推送，两次推送之间可能已经过时；所以前端每派出一条请求，就先在本地给那组的等待计数加上一笔（以 GLM 双机为例，只起一个 API server，这一笔就是 1），免得一串请求在两次推送之间全落到同一组。接着上面的例子：派出这条以后，前端本地把 DP0 记成 2 条在等，分数变成 2 × 4 + 24 = 32；下一次推送到来之前再来一条，32 比 30 大，这条就派给 DP1。主线的示例请求 R1（提示词只有 4 个 token 的单条请求）怎样落到 DP0，见[一条请求的第 1 站](one-request.md#第-1-站-入口从-http-到-node0-的引擎)。

派定的同时，前端记下这条请求归哪一组，中途取消时按这份记录去找。之后分数怎么变，已派出的请求都不会自动迁移：它的 KV cache 在那组的池子里，每一步都由那组的 scheduler 安排，搬到另一组需要额外的机制，这里没有。

打分只是默认路径。上游路由可以通过请求头直接指定组号，前端就不再打分；外部负载均衡等其他部署方式，也可以在入口之前就把请求分好。所以这个公式是 vLLM 默认前端的选择规则，不是 DP 的定义。

一次选组的完整步骤、计数怎样过时、挑偏的代价和各版本打分的差异，见 [DP 请求路由](dp-request-routing.md)。

## 两组每一步怎样对齐宽度？

**在本页固定 MoE 部署的普通同步路径中，每一步前向之前，同一 DP 通信组交换 token 数和图模式。交换后各组都知道最大 token 数，是否把本组补到这个数仍有条件；图模式取各组里最保守的那个。**

参加同一次集合通信的卡，必须按相同的次序、用对得上的形状进来。两组的 scheduler 各排各的，这一步的 token 数几乎总是不同，所以前向之前要先对一次口径。交换的内容是一个两行的小整数表，每组占一列：

- **第一行是 token 数。** 每组只在自己那一列填数，别的列留 0。All-Reduce 按位置相加以后，每张卡都拿到各组的数，再在本地取最大值。比如两组本地是 3 和 1：一组填 [3,0]，另一组填 [0,1]，相加得 [3,1]，两边各自取最大值 3。这里的「组」按 DP 编号排列，和全局的卡号分开计。
- **第二行是图模式。** **graph mode**（图模式）是把启动时录好的一串算子整段回放，省掉逐个下发的开销；**eager mode** 是逐个下发算子。两边相加后本地取最小值：只要有一组这一步用不了图（比如混进了 prefill），两组都退回 eager。

两组填进去的 token 数，已经经过本组的图尺寸选择。固定调用点在本地初选为图模式，或启用序列并行、细粒度输出投影 TP、细粒度词嵌入 TP 时，允许把本组宽度补到全组最大值；否则保留本组的宽度。因此，eager 不等于一定不补齐。先允许补齐的组，即使最终因对面不能用图而退到 eager，也仍采用补齐宽度。**MTP**（multi-token prediction：每步先用一个小的草拟模型多猜几个 token，再交给主模型一起验证）的草拟路径另以草拟标志保留最大宽度；是否录图和回放还要看草拟实现，不能由 DP 同步推出它永不进图。专家通信的路径选择使用最大宽度：**MC2** 是昇腾把专家计算和通信合在一起做的一种实现，按每个 token 选中的专家逐个发送；**AllGather** 路径先收集各组输入，每张卡再只算自己持有的专家。以 GLM 双机为例，两组里最宽的一组过 128 行时会换成 AllGather；各路径是否另行补齐通信缓冲，要与模型输入宽度分开，见[一条请求的 MoE 通信](one-request.md#moe-通信走-mc2-还是-allgather)。

这次交换默认走 CPU 上的 gloo 通道。是否跳过这次同步，还要先检查分层通信是否启用。分层通信把数据交换分成多个层级组织，这里的实现需要各组采用相同的 token 宽度，因此启用时不跳过这次同步；未启用时才进入非 MoE 等后续判断；MoE 模型只有在 PD 分离（prefill 和 decode 分给不同实例来跑）里接收 KV 的那一端、并且满足特定的 MC2 条件时才跳过。GLM 双机是 MoE，也没有配 KV 传输，所以每一步都做，前向走 eager 时也不省。整批补齐怎样一格一格算出来，见[多条请求：再补到两组的最大值](concurrent-requests.md#再补到两组的最大值)。

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

这 4 个 token 只是本地起点。假输入经过上一节相同的图选择和 DP 补齐逻辑：本页正常启用图的 decode 陪跑起点允许补齐，因此对面为纯 decode 时可补到相同图尺寸，对面混进 prefill 时可保留补齐宽度再退到 eager。若强制 eager 且没有其他补齐选项，就不能套用这个结果。

随后模型逐层执行，保留必要的 TP 和专家通信，草拟模型也按自己的 dummy 路径陪跑。**逐层调用不等于每层执行完整的真实请求计算。** 这条 dummy 入口默认不强制建立 attention 元数据，只有选为 FULL 图等相应条件时才建立；在无 attention 元数据的 eager 路径中，GLM 的 KDA 做完输入投影后就返回，跳过后续状态计算。因此不能把陪跑耗时算成“另一条同宽真实请求”的固定成本。假输入自己的输出不交给请求；替对面算的专家贡献仍照常送回。

### 什么时候停，怎样再叫醒

两组每 32 圈做一次 All-Reduce，交换两个数：本地还有没有没做完的请求，本地是否收到了暂停请求（运维主动让引擎暂停时用）。只要有一组还有活，或只有部分组提出暂停、共识尚未达成，全局运行标志就保持亮起。两组都没活且不存在未完成的暂停共识时，才结束这一波，request wave 编号加 1，DP0 的 EngineCore 向 DP coordinator 报告。检查只在第 32、64、96……圈做；无新请求、无待达成暂停共识时，最后一条请求结束后最多再空跑 31 步。

自然空闲时，新请求到来后，前端把它送进选中的那一组，并通知 DP coordinator 广播唤醒消息，让其他组也开始陪跑。收到属于已结束波次的请求时，引擎也会在未被运维暂停的条件下通知协调器。**运维暂停另有恢复步骤：** 达成暂停共识后，引擎会忽略普通的 wave 唤醒消息；需要显式恢复调度，清除暂停状态并完成全组协调，不能仅靠新请求唤醒。

## 放到 GLM 双机：每台机器一个 DP 组

**官方双机是 DP2：node0、node1 各是一个 DP 执行组，组内 8 张卡用 TP8 合作；EP16 横跨两组，node1 的 8 张卡持有编号 E144–E287 的这一半路由专家（每个 MoE 层 288 个路由专家，编号 E0–E287）。** 部署参数见[部署前提](glm-5-3-flash-two-node.md#部署前提)，每卡持有哪些专家见 [EP 的连续编号表](expert-parallel.md#放到-glm-双机一个-token-走过一层-moe)。

下图先看两台机器各放了什么，再看两条请求怎样按分数整条进入不同的组、各自算完并把回复送回各自的用户；MoE 层两组之间的专家协作按下文和 EP 页执行。

```wiki-scene
parallel-mechanism:6
```

按「一步」从头走一遍：

1. **进程。** node0 上有 API server、DP coordinator 和 DP0 的 EngineCore；node1 用 headless 模式启动，不建前端，只有 DP1 的 EngineCore。每个 EngineCore 各管本机 8 个 worker。进程清单见[双机部署里一共有哪些进程](engine-processes.md#双机部署里一共有哪些进程)，启动先后见[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)。
2. **派组。** 请求先到 node0 的 API server，由它按上面的分数挑 DP0 或 DP1，再直接送进那组的 EngineCore。每组的 scheduler 每一步最多排 32 条请求、8192 个 token（取值见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)），两组各有一份这样的上限；打分例子里说的「每步 token 预算」在本部署就是这 8192。

   此处沿用[请求怎样派进某一组](#请求怎样派进某一组)的普通负载选择分支；指定组号或专用选择已经给出结果时，不走这个打分步骤。
3. **对齐。** 16 张卡按跨机同号配成 8 个 DP 通信组，{0,8}、{1,9} 一直到 {7,15}，每组两张卡；每一步前向之前，8 组各做一次对齐，拿到同一个宽度。分组表见 [16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)。
4. **前向。** 两组按对齐后的宽度跑 45 层主干。每个 MoE 层，两组的 token 在 16 张卡之间派发和收回；两组里最宽的一组过了 128 行，两台机器一起换成 AllGather。
5. **全局检查。** 每 32 步，两个 EngineCore 交换一次「还有没有活」。

陪跑发生在本组没执行请求、其他组仍在运行的时段。主线的 R1 在 DP0 上算的时候，node1 一条请求都没有，每一步都在跑 dummy batch，见[一条请求的第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)。到了 decode 步，DP0 是 1 条请求、4 个 token，DP1 的假输入也是 4 个 token，两边对齐后各自回放 4 个 token 的图；实际陪跑占比取决于负载。

负载一不均，忙的那组就决定两组的宽度。用主线的**场景 M** 看：DP0 有 12 条 decode 请求，又新来一条 6000 token 的请求；DP1 有 7 条 decode 请求（设定见[示例场景 M 与变体 M′](concurrent-requests.md#示例场景-m-与变体-m)）。纯 decode 那一步，两组都按 64 宽回放图；DP0 混进 6000 token 的 prefill 那一步，两组都按 6048 宽走 eager，DP1 真正有用的只有 28 行。变体 **M′** 里 DP1 一条请求都没有，它的 dummy batch 从本地 4 个 token 出发，同样被拉到 64 或 6048。这些宽度一格一格怎么来，见[空闲的 DP 组为什么还要陪跑](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)和 [EP 页的陪跑小节](expert-parallel.md#两个-dp-组为什么要陪跑)。

显存也不能按 DP 数乘除。attention、稠密层和共享专家每台机器各有一份，288 个路由专家 16 张卡合起来只有一份，所以每台机器既不是一份完整模型，也不是半份；要分别看权重、KV cache、请求状态和运行时缓冲各放在哪。逐项账见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。

## 常见误解

- **「每个 DP 组都是一份完整的模型副本。」** 稠密模型是这样；MoE 模型不是。在 GLM 双机里，路由专家分在两组的 16 张卡上，两组合起来才是一份完整模型。任何一组算 MoE 层都离不开另一组，这正是要陪跑的原因。
- **「DP 把一个请求拆成几份并行算。」** DP 分的是请求归属与调度。GLM 请求仍归原执行组，attention 等计算由组内 TP8 合作，路由专家计算则可经 EP16 跨到另一组。
- **「空闲组每一步都固定跑一个假 token。」** 只有本地这一步没执行任何请求、而全局还在运行时才跑；假输入本地是一条 decode 请求的形状（本部署 4 个 token），对齐后宽度跟着对面走，可能是 64，也可能是 6048。
- **「陪跑的组什么都没干，算的全是废的。」** 假输入自己的输出被丢掉，但它替忙的那组算的专家结果是真的，要送回去用。补齐的行和空批次也不会多出任何用户请求。
- **「空闲组不花钱。」** 它的开销受另一组的宽度和本组执行分支影响；满足补齐条件时，长 prefill 可把假输入拉到几千行。但这些卡仍为对面的真实 token 计算专家，不能说这一半算力全无产出；浪费主要来自假输入相关的额外计算和等待，具体比例需测量。
- **「分数变了，请求会挪到更闲的组。」** 派定以后不迁移；它的 KV cache 和调度都在原来那组。
- **「加一组，吞吐就翻倍。」** 吞吐还受输入输出长度、并发、批次效率和两组共用的通信影响；MoE 下两组每步还要对齐和互相等待。
- **「设了 DP，专家就按 EP 分卡了。」** 专家整份分卡要另外打开 EP；不开 EP 时，上游 FusedMoE 把每个专家切成片摊到全部卡上。

## 对照源码

### 怎么开

双机两端各自的完整启动参数见[双机部署的「怎么开」](glm-5-3-flash-two-node.md#怎么开)。和本页直接相关的是：

| 参数 | CLI / Python 入口 | 输入缺省与范围 | 本部署 |
|---|---|---|---|
| data_parallel_size | --data-parallel-size / -dp；EngineArgs、LLM 同名 | int，默认 1，ParallelConfig 要求 ≥1 | 两端都给 2，表示全局两个执行组 |
| data_parallel_size_local | --data-parallel-size-local / -dpl；EngineArgs、LLM 同名 | EngineArgs 输入默认 None，按启动模式派生；直接建 ParallelConfig 的字段默认 1，要求 ≥0 且不超过全局数 | 两端都给 1，每台一个 EngineCore |

定义、入口与派生分别见来源 32–41。本地数的 None 不是固定等于 1：普通 mp、没有其他 rank/节点推断条件时，它取全局 DP 数。只把全局数设成 2 却不填本地数，会尝试在这台启动两个组，而不会自动找到另一台机器。Ray 的 span 放置策略另有缺省本地 1 的分支；显式多节点配置也先按节点拓扑推断。本站显式给 2/1，避免依赖这些自动分支。

**组数要与编号和设备一起配。** 每个本地组连续占一个全局 DP 编号；本站 node0 从 0 开始、本地 1，node1 从 1 开始、本地 1，覆盖全局 [0,2)。本地 Worker 数还乘上每组 TP/PP/PCP 规模；本站每组 TP8，故每台须有八张可用设备。编号、主地址、headless 和两端组合统一见[双机启动参数](engine-processes.md#怎么开)，不要把每组八张卡误填成八个 DP 组。

local=0 是低层“本进程没有本地引擎”的特殊值，不是关闭整个 DP 的开关；headless 启动要求本地数大于 0。显式 data_parallel_rank 会进入外部负载均衡配置，该分支本地数只能是 1 或 None，并最终取 1；与本站 headless 加 start_rank 的内部派组方式分开。

**DP 输入默认 1，还要看环境回退。** 在默认环境下，省略全局 DP 或设为 1，最终仍为 1。固定 0fc695fc 的 ParallelConfig 在传入 DP=1、local 不为 0 时会读取 VLLM_DP_* 环境项，普通单 API 在线入口也会到达这个分支；离线 SPMD（外部进程已各自启动）只是其使用场景之一。上表的部署取值对应本站显式配置的双机服务；使用环境回退时，还须核对启动拓扑、rank 和负载均衡的配套配置，不能只凭该分支推断在线多组服务已能运行。

`--enable-expert-parallel` 的默认、关闭与模型限制见 [EP 参数参考](expert-parallel.md#怎么开)。专家整份分卡和按矩阵分片的机制继续沿用前文。

- 陪跑没有单独的开关：MoE 模型在 DP 大于 1 时自动用 `DPEngineCoreProc`，DP coordinator 也只对 MoE 模型打开 wave 协调。非 MoE 模型的各组按 DP=1 运行。
- 指定一条请求去哪一组：请求头 `X-data-parallel-rank: 0` 或 `1`，前端就不再打分；没有指定组号时，先尝试 late-interaction 专用的引擎选择分支，只有该分支也没有给出选择结果时，才按等待请求数乘以 4、再加运行请求数的分数选组。
- v0.23 的 `additional_config` 里有 `dp_allreduce_on_npu`，默认关；打开后每步对齐从 CPU 的 gloo 通道改走 NPU 通道。

### 会报什么错

- 全局 DP 为 0/负数，或 local 为负数：字段下界校验拒绝；local 大于全局数时报告 must be <= data_parallel_size。headless 配 local=0 则报告 data_parallel_size_local must be > 0 in headless mode。
- 显式 data_parallel_rank 又给 local>1，或要求 hybrid 却没有本地数：在 EngineArgs 的组合检查失败。两端起始编号也要与全局组数配套，最终 rank 必须落在 [0, DP)；重号和漏号不能靠某一端字段校验自动补齐。
- 请求头给的组号越界时，入口报 `ValueError`，信息是 `data_parallel_rank 2 is out of range [0, 2).`。请求头的值不是整数时不报错，按没指定处理。
- 暂停还没在各组之间达成一致就调用恢复，报 `RuntimeError: resume_scheduler called while pause is still in flight. Wait for the pause future to resolve before resuming.`。
- 认站用的 debug 日志：两组一起停下时 DP0 打印 `Wave %d finished, pausing engine loop.`；被唤醒的组打印 `EngineCore starting idle loop for wave %d.`。
- 一组的 EngineCore 或 worker 没有进入对齐 All-Reduce 或专家通信时，另一组会停在那次通信上；具体报出什么超时信息，见页末待核。

### 开销和什么时候别开

- **每步一次对齐 All-Reduce。** 张量只有 2 × DP 个 int32，但每步都做，前向走 eager 时也不能省；源码注释把这一点记为待改的性能问题。
- **空闲组陪跑。** 补齐和图选择条件决定它是否采用忙组宽度；本页场景 M′ 的长 prefill 会把假输入补到几千行。模型和草拟路径仍执行必要通信，但 attention 等分支可能简化，不能按同宽真实请求等量估时。
- **每 32 步一次全局检查。** 用一次求和的 All-Reduce 同时判断「谁还有活」和「是否都同意暂停」；无新请求、无待达成暂停共识时，最后一条请求结束后最多再空跑 31 步。
- **负载不均。** 请求派定不迁移。前端使用协调器推送的负载计数，统计可能落后于刚刚作出的派发决定；普通负载评分分支选组后会递增本地等待计数，以改善两次统计更新之间的分配。协调器的最小统计更新间隔默认是 100 ms，这不保证前端每隔 100 ms 就收到新计数。
- **什么时候别开：** 请求量长期只够喂一组时，多开的组大部分时间在陪跑。对 GLM 双机来说 DP2 是部署定下来的：一台机器装不下全部专家，两台合起来才够，理由见[为什么是两台机器，不是一台](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)。

### 版本差异

本文旧 GLM 图里的 32 圈检查间隔、每卡 4 个 dummy token 保留原部署范围。配套 vLLM 0.30 的 dp_sync_interval 默认是 16，实际 dummy 宽度随投机配置推导，不能把图中 32/4 当作 rc2 默认。

**v0.30.0rc2 的 MRV1 扩大了 DP 输入补齐条件。** 普通同步仍把 token 数与图模式装进 CPU int32 tensor，通过 DP cpu_group 做 all_reduce；DP=1 或满足跳过谓词时先返回。同步后除了图模式和 draft，ALLGATHER/MC2、CANN MegaMoE 的 FUSED_MC2、任一细粒度 TP 组大小>1 也要求补齐到全 DP 最大宽度；其他分支保留各组真实宽度向量。Worker 的 dummy batch 仍使用统一 decode query 长度并跳过 GDN 状态更新。这里对照 MRV1 执行侧，不能把旧补齐表当成 rc2 所有 runner 的统一规则。

下表的组数与派生按固定 vLLM 0fc695fc / 568afb3a / 84030bbe 对照；后面的调度循环与选组算法各按其标明的源码版本解释。

| 参数与派生 | v0.23 | v0.26 rc | 固定 main |
|---|---|---|---|
| DP 总数 / 本地数 | 总数默认 1、≥1；local 输入 None、配置字段默认 1、≥0 且 ≤总数 | 相同 | 相同 |
| 普通 mp 的 local 缺省 | 没有其他推断条件时取全局 DP；本站显式给 1 | 相同 | 相同 |
| start_rank 对 local 分支的影响 | 非零 start_rank 且非 headless 才推断 hybrid；local=1 时再切外部模式 | 相同 | 显式 0 也触发；改为 is not None，回填 rank 时也保留显式 0 |
| 多节点推断与错误形式 | 节点规模推断使用 DP×PP×TP；部分非法组合用 assert 拒绝 | 相同 | 推断还计入 PCP；多项 assert 改成 ValueError |

本地数相同并不能保证负载均衡模式相同。尤其从本站旧版升级 main 时，应重新核对前端派生和 headless；对应启动入口说明见[进程页版本差异](engine-processes.md#版本差异)。执行侧差异见下表。

上游控制流（EngineCore 主循环、DP coordinator、选组打分）按 `vllm@0fc695fc` 读。执行侧按知识库固定快照核对：v0.23 列是 vllm-ascend 维护分支 2c59ff10，v0.26 列是 2ed6cbba，main 列是 baa023ad。**本页 GLM 算例读的是本部署专用镜像 db701c1f，它是另一个 orphan commit，不算进 v0.23 列：该镜像包含 GLM 的 MoE 模型代码，2c59ff10 上没有。**下表 v0.23 列按 2c59ff10 写；对齐规则、通道开关、dummy batch 的 token 数在镜像上内容逐字相同，只是行号整体偏移（每步对齐那个方法在 2c59ff10 是第 673–721 行，镜像是第 692–740 行），唯一的实质差别是镜像的 dummy batch 不先记显存统计。

| 项目 | v0.23 | v0.26[C22][C24] | main[C23][C25] |
|---|---|---|---|
| dummy batch 本地的 token 数 | `decode_token_per_req` = 1 + 草拟 token 数 | `uniform_decode_query_len`；它继承自上游，`vllm@0fc695fc` 里同样是 1 + 草拟 token 数 | 同 v0.26 |
| dummy batch 的额外动作 | 先记一次显存统计；不传 GDN 状态开关（镜像 db701c1f 连显存统计也没有） | 先记一次显存统计；传 `skip_gdn_state_update=True`，假输入不更新 GDN 类线性注意力的递推状态 | 同 v0.26 |
| 每步对齐走哪条通道 | 默认 CPU gloo，`dp_allreduce_on_npu` 可改走 NPU | 固定 CPU gloo，没有这个选项 | 同 v0.26 |
| 同步方法内的规则 | 两行求和后取最大 / 最小；允许补齐或草拟时生成统一宽度向量，否则保留各组宽度；跳过与补齐条件还要核调用者 | 同一规则 | 同一规则 |

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

- dummy 的 attention 元数据、KDA 提前返回已按下面来源确认；其他后端在各图模式中的完整算子开销仍需运行证据。
- 一组没有进入通信时另一组报出的具体超时信息：缺实机日志。
- 陪跑一步的真实耗时（45 层加 16 卡专家通信的固定开销）：缺实测。
- v0.26 与 main 的配套提交为 568afb3a、84030bbe；这两个提交的全部 EngineCore 循环与选组行为仍缺完整调用链核验，参数派生的比较范围见上表。

固定 0fc695fc 的请求选组先看显式组号，再尝试专用选择，最后进入普通评分及本地等待计数补偿；计数增量是 API server 数量，单前端示例为 1（来源 1）。late-interaction 查询标识有效时，相同标识映射到同一引擎以复用查询向量（来源 30）。系数 4 的动机仍是解释性推测；评分不承诺完成时间，也不适用于外部负载均衡。

MoE 的 DP 进程类型、非 MoE 的内部 DP 大小重设，以及分支前保留原始组索引，见固定 core.py（来源 7）；DP coordinator 的构造是另一处逻辑（来源 26）。dummy batch 的实际设备开销仍缺测量。

固定 db701c1f 的普通同步路径中，条件补齐和各组 token 向量见来源 5，图模式取最小值及 NONE 传播见来源 19；分层通信会先阻止跳过同步，判断位于 utils.py（来源 17）。补齐位置不是新增的真实请求位置，其他执行路径须按自己的版本条件核对。

100 ms 是构造参数给出的最小统计更新间隔（来源 10）；发布循环还检查统计是否变化并等待轮询返回（来源 31），因此不是前端固定接收周期，实际时延需测量。

补齐开关的实际调用点、同步后重新选图见来源 47。dummy 的默认参数和 attention 元数据条件见来源 48，来源 14 继续显示元数据构建、无效 slot 标记及模型/草拟调用。来源 49 中 KDA 在输入投影后检查 attention 元数据，为空即返回，支撑本页对陪跑计算量的限定。继承的统一 decode 宽度定义见来源 50。每 32 步最多空跑 31 步的推导还要求来源 16 中不存在未完成的暂停共识；rc2 的来源 46 另在第 1 步也检查，不能把旧版检查时刻套过去。

固定 0fc695fc 的普通单 API 在线调用链为 serve → run_server/run_server_worker → build_async_engine_client → AsyncEngineArgs.from_cli_args → create_engine_config → ParallelConfig（来源 51–55，local 派生见来源 37）。来源 41 的环境回退条件没有按在线/离线区分：传入总数大于 1 或 local=0 时走显式配置分支，否则读取 VLLM_DP_*；来源 56 给出实际环境读取器，其中 VLLM_DP_SIZE 的缺省为 1。这里确认配置能走到回退分支，未做仅靠环境启动在线多组服务的设备验收。
