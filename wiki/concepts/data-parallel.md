---
id: data-parallel
title: Data parallel：请求怎样分进两组，空闲的组为什么陪跑
type: feature
legacyAnchors:
  为什么非跑不可: 空闲的组由谁叫起来陪跑，陪跑时算什么？
  谁来决定跑: 1. 谁来决定跑，怎样构造假输入
  陪跑时算什么: 1. 谁来决定跑，怎样构造假输入
  异构旗舰与三维算例对照glm-双机-dp2-对齐与陪跑: 双机-16-卡混合部署dp2-宽度对齐与空闲陪跑
  放到-glm-双机每台机器一个-dp-组: 每台机器一个-dp-组与一步五站推进
summary: >-
  DP 把请求分给不同执行组独立排队调度。标准稠密模型（如 Qwen3-8B DP=2）各组自持完整权重、零跨组通信且无需陪跑；MoE 模型（如
  Qwen3-30B-A3B 多组扩展与 GLM 双机）的路由专家跨全部组只放一份，才触发宽度对齐与空闲组 dummy batch 陪跑。
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
  - use_batched_dp_moe
  - reconfigure_for_independent_dp_rank
  - dp_sync_interval
  - ignore_start_dp_wave
  - 波次同步
chapters:
  - '04'
order: 30
sources:
  - 'vllm@ced6857a:vllm/config/parallel.py#L128-L165'
  - 'vllm@ced6857a:vllm/config/parallel.py#L740-L805'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L43-L43'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2215-L2310'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2919-L2942'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L1318-L1329'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L1996-L2281'
  - 'vllm@ced6857a:vllm/v1/engine/coordinator.py#L23-L55'
  - 'vllm@ced6857a:vllm/v1/engine/core_client.py#L1546-L1597'
  - 'vllm@ced6857a:vllm/model_executor/layers/fused_moe/config.py#L1212-L1250'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/pipeline_parallel.md#L438-L440'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L73-L75'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1266-L1289'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1378-L1435'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L1278-L1282'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L823-L884'
  - 'vllm@ba15685a:vllm/config/parallel.py#L888-L928'
  - 'vllm@ba15685a:vllm/engine/arg_utils.py#L2470-L2565'
  - 'vllm@ba15685a:vllm/engine/arg_utils.py#L3197-L3220'
  - 'vllm@ba15685a:vllm/v1/engine/core.py#L2524-L2818'
  - 'vllm@ba15685a:vllm/v1/engine/core_client.py#L1811-L1871'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/pipeline_parallel.md#L430-L432'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L1277-L1300'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L1397-L1405'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L720-L756'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L1293-L1340'
  - 'vllm@568afb3a:vllm/config/parallel.py#L127-L138'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L1964-L2077'
  - 'vllm@568afb3a:vllm/v1/engine/core_client.py#L1413-L1442'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L1079-L1086'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L709-L760'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L1057-L1080'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L985-L987'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L673-L721'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1114-L1137'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L1398-L1426'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1152-L1162'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1788-L1945'
  - 'vllm@0fc695fc:vllm/v1/engine/coordinator.py#L23-L278'
  - 'vllm@0fc695fc:vllm/distributed/parallel_state.py#L1833-L1875'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1118-L1200'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L118-L129'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L441-L450'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L683-L707'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L801-L835'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L398-L411'
  - 'vllm@0fc695fc:vllm/v1/engine/input_processor.py#L258-L268'
  - 'vllm@0fc695fc:vllm/v1/pool/late_interaction.py#L15-L36'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L331-L332'
  - 'vllm@0fc695fc:vllm/v1/engine/utils.py#L1090-L1096'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L471-L474'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L999-L1022'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1542-L1970'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L804-L818'
  - 'vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L139-L148'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L94-L123'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L652-L682'
  - 'vllm@0fc695fc:vllm/envs.py#L1297-L1309'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L972-L973'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L652-L740'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2898-L3012'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3332-L3652'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5383-L5389'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1453-L1508'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1707-L1758'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L315-L318'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1257-L1303'
  - 'raw:sha256-6301828dd37d1286329eea1c26e42e604f1d126e743d346e00820b0fdb7dc175.md#L1-L1142'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L281-L292'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_forward_context.py#L297-L315'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/prepare_finalize.py#L452-L464'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/prepare_finalize.py#L552-L569'
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L952-L1077
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: continuous-batching
    kind: builds-on
    note: 每个 DP 执行组内部独立运行连续批处理调度器与各自的等待、运行队列
  - to: collective-communication
    kind: builds-on
    note: 每步对齐宽度、周期停机检查与跨组专家通信都建立在 All-Reduce 等原语之上
  - to: tensor-parallel
    kind: builds-on
    note: 单个 DP 执行组内部的多张卡用 TP 切分线性层矩阵合作算同一批请求
  - to: pipeline-parallel
    kind: builds-on
    note: 层间分段与请求分组可正交对比，但跨机 RoCE 下 MoE 模型严禁同时启用 PP>1 与 DP>1
  - to: moe
    kind: builds-on
    note: 路由专家跨全部 DP 组只放一份，正是 MoE 让各组无法独立运行并触发空闲陪跑的根源
contradicts: []
updated: '2026-11-23'
origin: gap
rawSources:
  - >-
    raw/sha256-6301828dd37d1286329eea1c26e42e604f1d126e743d346e00820b0fdb7dc175.md
  - >-
    raw/sha256-9766ffa0dff16ec93855d88a4128e0016c8db8916074129633b4953322437448.md
---

**Data parallel（DP，数据并行）把整条请求分给不同的执行组，每组各自排队、各自按[连续批处理](continuous-batching.md)调度并维护独立的缓存池；请求一旦派定就全程留在同一组内，组内多卡仍可叠加 TP 合作计算。** 标准稠密模型的各组互不通信；而在混合专家（MoE）模型里，路由专家跨全部组只放一份，暂时没有请求的组也必须**陪跑**——即**空闲 DP 组提交占位输入以共同完成专家集合通信**。

## DP 是什么？

先看最简单的情形（示意）：一个普通**稠密模型**（前馈层没有按 token 选择专家的路由，这不表示词嵌入每次读取整张词表）本来放在一组卡上，现在原样复制一份放到另一组卡上，得到组 0 和组 1。来了 4 条请求 A、B、C、D，前端把 A、C 派给组 0，B、D 派给组 1。之后组 0 每一步只算 A、C，组 1 只算 B、D：两组手里的权重一模一样，前向各算各的请求，无需跨 DP 组通信。到了混合专家（[MoE](moe.md)）模型，vLLM 把路由专家跨所有组分放，两组不能再各跑各的，下一节单独展开。

这里的**执行组**是一组卡加上管这组卡的引擎进程 `EngineCore`，进程里的 scheduler（调度器）决定每一步算哪些请求。请求先到**前端**（vLLM 接收 HTTP 请求、做分词的 API server 进程；它不跑模型，只负责挑一组并把请求送进那组的 `EngineCore`）。每组有独立的等待队列、运行批次、请求状态和 [KV cache](kv-cache.md) 缓存池；请求派到哪一组，就占用哪一组的池子。

和 [tensor parallel（TP，张量并行）](tensor-parallel.md)对照：TP 把**同一个请求**的一次矩阵乘切给几张卡合算，为的是装得下、算得快；DP 不切单条请求，而是把**不同的请求**分给不同的组，每组内部仍可用 TP 把矩阵分给多卡合作。

## 落到标准部署：Qwen3-8B 稠密 DP=2（零同步、零陪跑）

先看最干净的生产标准路径：两张卡运行 **`Qwen3-8B`**（稠密 GQA，`36` 层，`BF16` 静态权重 `~15.26 GiB`）并设置 **`DP=2`（`TP=1`）**。因为稠密模型没有跨组共享的路由专家，vLLM 在启动期会通过 `reconfigure_for_independent_dp_rank()` 将两个执行组内部都配置成独立副本：

```wiki-diagram
file: data-parallel-loop-qwen3
```

- **双副本完全隔离**：副本 0 与副本 1 各自常驻一整份 `Qwen3-8B` 权重，各自拥有独立的 `EngineCoreProc`、输入队列、调度器和 `18 MiB/块` 物理 KV 池，互不共享块表与显存。
- **零跨 DP 通信，零 dummy batch 陪跑**：当副本 0 正在跑请求而副本 1 队列为空时，副本 1 直接阻塞在输入队列上等待新请求——**`0` 次跨 DP `All-Reduce`、`0` 次波次同步、`0` 次 `execute_dummy_batch` 陪跑**。
- **前端只管分流**：API Server 按负载把新请求塞进较闲的副本队列，新 token 算完直接回传前端；请求一旦派定，全程留在原副本内完成，不再跨副本迁移。

## 为什么需要 DP，代价在哪？

**一组卡同时能服务的请求有上限。多复制一组，就多一条互不干扰的调度线、多一个 KV cache 池，同时在算的请求数大约跟着组数涨；单条请求并不会因此变快。**

上限来自两处：scheduler 每一步排进批次的请求条数和 token 总数都有上限；KV cache 池的空间也有限，池子满了新请求只能排队等。分成两组以后，两个 scheduler 各排各的，每一步各有一份这样的上限；请求到了哪一组，就在哪一组排队、占哪一组的 KV cache。

用示意数算一遍。设一组每一步最多排 `4` 条请求；有 `8` 条请求 A–H 都已处理完提示词，正处在每步生成 `1` 个 token 的阶段（示意，先不管处理提示词那一步）：

- **不开 DP。** 本步算 A–D 这 `4` 条，E–H 这 `4` 条排队；这一步一共产出 `4` 个 token。
- **DP2。** 两组各排 `4` 条：组 0 算 A、C、E、G，组 1 算 B、D、F、H，没有请求排队；两组同时各走一步，一共产出 $4 + 4 = 8$ 个 token。
- **单条请求。** 每条仍是每步 `1` 个 token，单次前向一步并没有变快；变的是同时在算的条数，以及新请求要排多久的队。

```wiki-diagram
file: data-parallel-basics
```

**代价首先是卡和显存。** 在稠密模型里，每组都要放一整份权重：示意一份权重 `10 GB`，DP2 就要两组卡、共 $2 \times 10 = 20\text{ GB}$ 放权重，换来同时服务的请求数翻一倍左右。

**其次，加一组也不保证吞吐（单位时间一共产出多少 token）按组数翻倍。** 选组改变的是请求在哪里排队，不会让单次前向变快；吞吐还受输入输出长度、并发数、批次效率（每一步批次凑得满不满）和两组共用的通信影响。请求少到一组就排得下时，第二组没活可干；两组之间的同步（下一节的混合专家模型才需要）也可能拉长某一步。此外，请求派进某一组以后不再迁移，两组的负载可以长期不均。

## MoE 模型里，两组为什么不能各跑各的？

**一旦换成 MoE 模型（如 `Qwen3-30B-A3B` 按 `DP × TP` 扩展并开启 EP，或后文 GLM 双机），attention 和门控仍是每组一份、各算各的请求；路由专家却只放一份，摊在所有组的卡上。** 于是任何一组算 MoE 层，都要别的组同时到场参加跨组 MoE 集合通信（按硬件策略、是否带 LoRA 与 EP 规模在 `ALLGATHER / Reduce-Scatter`、`MC2` 或 `All-to-All` 间选路；例如 Atlas A2 无 LoRA 且 `EP < 16` 时走 `ALLGATHER`，由 `dp_size > 1` 触发跨 DP 收集与归约）；某组暂时没有请求，也得用一份假输入陪另一组走一步。

先补两个前置概念。[MoE](moe.md)（mixture of experts，混合专家）把一层里的前馈网络换成许多个并排的小前馈网络，每个叫一个 expert（专家）；router（打分器）给每个 token 在各个专家上打分，每个 token 只交给分数最高的几个专家去算，再把结果按权重加起来。可供 router 挑选的这一整套专家集合叫**路由专家**（routed experts，不是某个 token 本次选中的子集）。[expert parallel（EP，专家并行）](expert-parallel.md)把路由专家以整个专家为单位分到不同的卡上：token 选中哪个专家，就把它的向量发到持有那个专家的卡上去算，算完再送回来。

**为什么专家不跟着每组复制一份。** 路由专家数量多，占了 MoE 模型参数的大头。示意：一个 MoE 模型权重 `100 GB`，其中路由专家 `90 GB`，attention、稠密层等其余部分 `10 GB`（和上一节那个稠密模型一样大）。两组各放一整份要 $2 \times 100 = 200\text{ GB}$；其余部分每组一份、路由专家全部卡合起来只放一份，只要 $2 \times 10 + 90 = 110\text{ GB}$。开了 EP 时，路由专家以整个专家为单位分放在各组的卡上；不开 EP 时，每个专家被切成片摊到全部卡上（见下节[只设 DP、不开 EP 时](#在-vllm-里一个-dp-组由什么组成)）。两种分法都只有一份专家，各 DP 组因此并不各自完整：MoE 层横跨所有组的卡。

**跟着一个 token 走一遍（示意）。** 设一层有 `8` 个路由专家 `e0–e7`，组 0 的卡持有 `e0–e3`，组 1 的卡持有 `e4–e7`，每个 token 选 `2` 个专家。组 0 的一个 token 被 router 选中 `e1` 和 `e6`：`e1` 在本组卡上本地算；`e6` 在组 1 的卡上，这个 token 的向量要发过去，组 1 算完再送回组 0 与 `e1` 的结果按权重相加。去和回各是一次[集合通信](collective-communication.md)：去的一次叫 **dispatch**（派发，把 token 向量发到持有所选专家的卡），回的一次叫 **combine**（收回，把专家算出的结果送回 token 所在的卡）。每一次两组的卡都要按兼容的次序参加；用到通信结果的计算须等相关结果就绪，不要求所有卡在同一物理时刻进入或返回。

无论哪种专家切法，任何一组算 MoE 层都要别的组参加同一轮通信。所以 MoE 模型在 `DP > 1` 时，空闲组必须陪跑：某一组暂时没有请求，也得用一份假输入陪另一组走完同一步前向，这叫 **dummy run**（源码方法名 `execute_dummy_batch`）。触发陪跑的是 MoE，不是 EP。

在上游引擎进程初始化时，vLLM 明确把这两类模型分开。开启 DP 的 MoE 模型创建带跨组协调职责的 `DPEngineCoreProc`。非 MoE 模型则调用 `reconfigure_for_independent_dp_rank()`，把每个执行组内部的 `dp_size` 和 `dp_size_local` 都重设为 `1`（仅用 `data_parallel_index` 保留组号），使用普通 `EngineCoreProc` 独立运行。因此，前端把请求分给多个组，与执行侧是否走 MoE 陪跑协调路径，是两件独立的事。

```wiki-diagram
file: data-parallel
```

上图按开了 EP 的情形示意（GLM 双机正是如此）：新请求只派进组 0；组 1 的等待队列和运行队列都空着，但组 0 的 token 在 MoE 层会选中组 1 卡上的专家，组 1 于是跑一步只为陪跑的前向——假输入自己的输出直接丢掉，替组 0 算的专家结果照常送回组 0（组内 TP 未在图中展开）。

在 MoE 模型上，DP 的同步代价集中在「各组必须同波进退」上：

1. **前向之前对齐一次。** 同一 DP 通信组的卡先做一次 [All-Reduce](collective-communication.md#all-reduce)，交换本组这一步有多少 token、能不能回放预先录好的计算图（graph mode）。满足补齐条件（如回放计算图、草拟模型、启用 MC2 / AllGather 通信或跨 DP 细粒度 TP）时，各组统一补到最大 token 数；图模式则取各组里最保守的值——只要任一组退回逐算子下发的 eager 模式，全组这一步都不回放图。补齐的位置不等于请求新增的真实输入位置，也不能仅凭单组本地输入判断最终执行宽度。
2. **每个 MoE 层的专家通信。** 各组的卡一起 dispatch、一起 combine；任何一张卡慢了，依赖它的其他组也要等。
3. **周期性查一次全局停机状态。** 各组交换「还有没有未完成请求」与「是否达成运维暂停共识」。在 `v0.30.0` 与 `main` 主基线中，`dp_sync_interval` 默认是 `16`（且第 `1` 步也会检查，空闲唤醒后只需 `1` 次 dummy batch 即可停回）；而在历史 GLM 绑定快照（`0fc695fc`）中固定每 `32` 步查一次，无新请求且无待达成暂停共识时，最后一条请求结束后最多空跑 `31` 步。

请求派定后不迁移，负载长期不均时，空闲组的开销不看它自己有多少活，而看忙的那组拉到多宽。把四维基础并行放在一起对照，并特别注意 `v0.30.0` 跨节点 RoCE 的拓扑禁配边界：

| 并行方式 | 首先切分的对象 | 主要运行代价与 `v0.30.0` 跨机耦合边界 |
|---|---|---|
| TP | 层内的线性层矩阵 | 每层合并部分结果的机内高频集合通信 |
| [PP（流水线并行）](pipeline-parallel.md) | 模型的层顺序段 | 阶段点对点交接与流水线气泡；**跨节点 RoCE 部署 MoE 时严禁同时开启 `PP > 1` 与 `DP > 1`** |
| DP | 请求归属与调度队列 | 组间负载不均；MoE 下每步对齐宽度、空闲组陪跑 |
| EP | MoE 路由专家集合 | 跨卡 dispatch / combine 通信与各专家负载不均 |

在 `v0.30.0` 与 `main` 的官方流水线并行指南中明确规定：**跨节点 RoCE 部署 MoE 模型时，不能同时开启 `PP > 1` 与 `DP > 1`**，因为底层 `MoeDistributeDispatch` 通信路径不支持该组合拓扑。更需警惕的是，`platform.py` 与 `ascend_config.py` **没有任何 Python 启动期前置断言拦截这一组合**；误配后进程能走过初始化，却会在运行期通信处静默挂死或报错。跨机 RoCE 部署 MoE 时，必须在 `PP = 1` 与 `DP = 1` 之间二选一。下图把稠密独立副本、MoE 波次陪跑与跨机 RoCE `PP×DP` 禁配放在同一画布对照：

```wiki-diagram
file: dp-fig-dummy-and-exclusion
```

## 在 vLLM 里，一个 DP 组由什么组成？

**每个 DP 组有自己的 `EngineCore` 进程，里面有独立的 scheduler 和 KV cache 池；组外还有前端和一个 `DPCoordinator` 进程：前端给请求选组，`DPCoordinator` 汇总各组负载并协调各组同波开工、同波停下。**

- **`EngineCore`（每组一个）。** 每一步调度一次，再驱动本组每张卡上的 worker（每卡一个执行模型的进程）跑前向。MoE 模型在 `DP > 1` 时采用子类 `DPEngineCoreProc`，多出上文的陪跑与波次逻辑；非 MoE 模型的各组互不依赖，内部按 `DP = 1` 运行，既不每步对齐，也不陪跑。
- **前端（API server 进程）。** 接收 HTTP 请求、分词，按下一节规则给请求选组后直接送进目标 `EngineCore`；每条请求派到哪一组也记在前端本地，中途取消按这份记录定位。
- **`DPCoordinator`（整个部署一个，仅 MoE 开启波次协调）。** 做两件事：一是收集每组等待队列、运行队列（及 `v0.30.0` 的 KV 使用率）推给前端供选组，最小统计更新间隔默认是 `100 ms`，实际推送还受统计是否变化与轮询返回影响，并非固定每 `100 ms` 一次；二是跟踪各组当前处于「一起运行」还是「一起暂停」，某组收到新请求时向全组广播 `START_DP_WAVE` 唤醒消息。它不转发请求数据，也不参加每步对齐。
- **request wave。** 各组在「一起运行」和「一起暂停」之间切换；每从运行切回暂停一次，波次编号加 `1`，调试日志里的 `wave` 就是它。

双机上一共有哪些进程、`DPCoordinator` 按什么口径计入「`20` 个进程」示意账，见[双机部署里一共有哪些进程](engine-processes.md#双机部署里一共有哪些进程)。

读源码和日志时，要把两层「DP 组」严格分开：

- **DP 执行组**：上面的调度单位，全局设几个 DP 就有几组。
- **DP 通信组**（`_DP`）：各执行组里 TP 位置相同的卡配成一组，每步前向前的宽度对齐就在这种组里完成。每个执行组有几张卡，就有几个 DP 通信组；每个通信组的成员数等于 `dp_size`。

开了 EP 的 MoE 模型，EP 组（`_EP`）把所有执行组的全部卡都包进来：不开上下文并行（把一条长请求的不同位置分给多张卡算）时，$\text{EP 卡数} = \text{DP 数} \times \text{每组 TP 卡数}$。因此 EP 和 DP 不是二选一：attention 和稠密层按 DP 执行组各算各的请求，路由专家按 EP 组摊在全部卡上。

```wiki-diagram
file: dp-ep-groups
```

上图把两种形态上下对照。上方是标准稠密 DP（如 `Qwen3-8B DP=2`），两个完整副本互不等待。下方用 4 卡示意 MoE `DP=2 × TP=2 + EP=4`（如 `Qwen3-30B-A3B` 多组扩展）：横着的每个框既是一个 DP 执行组也是 TP 组，`rank 0` 与 `rank 2` 配成 DP 通信组 `{0, 2}`，`rank 1` 与 `rank 3` 配成 `{1, 3}`。全部四张卡合成一个 EP 组各持 `1/4` 路由专家（例如 `Qwen3-30B-A3B` 的 `128` 个专家均分为每卡 `32` 个；专家切分见 [EP 页](expert-parallel.md)）。

只设 DP、不开 `--enable-expert-parallel` 时，专家不会整份分卡：上游 `FusedMoE` 通过 `flatten_tp_across_dp_and_pcp` 把 MoE 层按 TP 方式展平切到全部 $\text{DP} \times \text{TP}$ 张卡上，每个专家矩阵都被切成这么多片。MoE 层照样横跨各组，各组照样要一起走；反过来，只看到 `DP > 1` 推不出专家已按 EP 整份分卡。

工程配置时还要留意两项与 DP 绑定的底层预算规则：

1. **DP 通信组的 HCCL 缓冲下限（`50 MiB`）。** 在 `vllm-ascend`（`v0.23.0` 至 `main`）中，名为 `"dp"` 的逻辑通信组不沿用普通通信组默认的 `200 MiB`，而按 `dp_size + 1` 个 `int32`（`4 B`）向上取整并与下限取最大：
   $$\text{hccl\_buffer\_size}_{\text{dp}} = \max\!\left(\left\lceil \frac{(\text{dp\_size} + 1) \times 4\text{ B}}{1\text{ MiB}} \right\rceil,\; 50\text{ MiB}\right)$$
   常规规模下该值恒为 `50 MiB`；底层同成员兼容通信域的复用与 `mc2` 组缓冲详见 [HCCL buffer](hccl-buffer.md)。
2. **`use_batched_dp_moe` 的 `256` 词批上限分支。** 上游 `ParallelConfig.use_batched_dp_moe` 仅在 `all2all_backend` 选自 `"deepep_low_latency"` 或 `"nixl_ep"` 且同时满足 `enable_expert_parallel` 与 `DP > 1` 时为真；命中且未显式传 `--max-num-batched-tokens` 时，默认每步批上限会收紧到 `256`（吞吐模式下翻倍为 `512`）。昇腾原生 MoE 走 `mc2`、`allgather_reducescatter` 或 `auto` 后端，该属性为 `False`，不会隐式触发 `256` 上限。

## 请求怎样派进某一组？

**前端先看请求是否显式指定了组号，再看是否命中专用查询复用分支；普通请求则按各组负载打分挑最小的一组，并在本地立即补记等待计数。请求一旦派定，全程留在原组不再迁移。**

选组先后顺序固定为三步：请求头（如 `X-data-parallel-rank`）已指定 `data_parallel_rank` 时直接去该组；未指定时尝试 late-interaction（迟交互池化检索/重排模型，先将查询编码为向量缓存在进程内存中，再与候选文档逐一打分）专用选择，让同一查询标识落到同一引擎以复用进程内保存的查询向量。只有前两个分支都未给出结果时，才进入普通负载评分。

在历史 GLM 绑定基线（`vllm@0fc695fc`）及 `v0.26.0` 中，普通负载打分公式是 **`等待队列条数 × 4 + 运行队列条数`**。源码没有写明为什么取系数 `4`，可以这样辅助理解：等待中的请求尚未做 prefill（处理提示词），接下来要先吃掉一大段每步 token 预算，因此按 `4` 条运行中请求折算。这是帮助理解权重的解释性推测，源码未证明其设计动机；该分数只数条数、不比较请求真实长度或剩余计算量，分低只代表优先选中，不承诺更快完成。

用两组 `DP0`、`DP1` 算一遍（数字为示意）：某一刻 `DP0` 有 `1` 条在等、`24` 条在跑，`DP1` 有 `4` 条在等、`14` 条在跑。`DP0` 得 $1 \times 4 + 24 = 28$ 分，`DP1` 得 $4 \times 4 + 14 = 30$ 分。只数总条数 `DP1`（`18` 条）比 `DP0`（`25` 条）少，但 `DP1` 有 `4` 条待做 prefill，新请求派给分数更低的 `DP0`。若两组都没有等待请求，分数就退化为运行条数（主线场景 M 正是如此，见[多条请求的第 1 站](concurrent-requests.md#第-1-站-入口新请求先挑一个-dp-组)）。由于 `DPCoordinator` 推送有间隔，前端每派出一条请求就先在本地给目标组等待计数加上前端实例数（GLM 双机单 API server 即加 `1`）：派出后 `DP0` 本地记成 `2` 条在等，分数变为 $2 \times 4 + 24 = 32$，下次推送前再来一条就会因 $32 > 30$ 改派 `DP1`（单请求 R1 落组见[一条请求的第 1 站](one-request.md#第-1-站-入口从-http-到-node0-的引擎)）。

到了 **`v0.30.0`（`ced6857a`）与 `main`（`ba15685a`）**，上游把普通负载打分升级为「在途下界 + KV 缓存压力惩罚」，并每次轮转扫描起点 `eng_start_index` 消除平分偏置（`main` 另在入口最前增加流式会话亲和 `streaming_reqs`）：
$$\text{score} = \max(\text{client\_count} \times \text{inflight},\; \text{waiting} + \text{running}) + \mathbb{I}(\text{waiting} > 0) \cdot 6.0 \cdot \text{waiting} \cdot \max(0,\; \text{kv\_cache\_usage} - 0.5)$$
当某组 KV 占用不超过 `50%` 时不额外重罚瞬时等待队列，突发流量保持轮询打散；当 KV 逼近满载（从 `50%` 升至 `100%`）时，等待惩罚线性拉升至 `3` 倍（连同基础项共折合 `4` 倍），把新请求推离受困于显存的引擎。外部负载均衡或请求头直指组号均跳过前端打分；完整步骤与跨版细节见 [DP 请求路由](dp-request-routing.md)。

## 两组每一步怎样对齐宽度？

**在 MoE 的 `DP > 1` 路径里，「同步」实际包含四件不同颗粒度的事：前向前宽度/图模式对齐、MoE 层跨卡专家通信、周期性停机共识，以及停波唤醒与运维暂停。** 先用一张双轨时序与数据流图把前三种同步和空闲组陪跑的因果串起来：

```wiki-diagram
file: dp-fig-width-and-escort
```

| 同步环节 | 通信通道与时机 | 交换内容与结果 | 稠密 DP=2 是否发生 |
|---|---|---|---|
| **① 前向前宽度与图模式对齐** | DP 通信组 CPU `gloo` `All-Reduce`，每步前向前 | `2 × dp_size` `int32` 表 → 宽度取 `max`，图模式取 `min`（最保守） | **否**（直接跳过） |
| **② MoE 专家派发与收回** | 全组 `EP`（或 `DP×TP`），每个 MoE 层 | `dispatch` 发 token 向量、`combine` 收专家结果；空闲组必须到场 | **否**（无跨组专家） |
| **③ 周期停机共识** | `sync_dp_state` 两元素求和，按步距触发 | 各组「是否有未完成请求」的 `0/1` 标志求和（`>0` 即有活） + `暂停计数`；`v0.30.0` 第 1 步及每 `16` 步（GLM 每 `32` 步） | **否**（无波次循环） |
| **④ 停波唤醒 / 运维暂停** | `DPCoordinator` 广播 `START_DP_WAVE` / 显式恢复 | 自然空闲停波由新请求唤醒；运维暂停置 `ignore_start_dp_wave=True`，须显式 `resume_scheduler` | **否**（阻塞输入队列） |

### 1. 两行整数表怎样定宽度和图模式

参加同一次集合通信的卡必须按兼容次序和形状进入。各组 scheduler 独立排批，本地 token 数通常不等，因此前向前先对一张 `2 × dp_size` 的 `int32` 表做 `All-Reduce(SUM)`（每组只在自己那一列填本地值，其余列填 `0`）：

- **第一行（token 数）取最大值。** 如上图所示，两组填 `[3, 0]` 与 `[0, 1]`，相加得 `[3, 1]`，两边各自得出最大宽度 `3`。专家通信选路也看这一最大值：例如 Atlas A2 上的 GLM 双机在最大宽度超过 `128` 行时，整机一起从 **MC2** 切到 **AllGather**（见[一条请求的 MoE 通信](one-request.md#moe-通信走-mc2-还是-allgather)）。
- **第二行（图模式）取最小值。** **graph mode**（图模式）整段回放预先录好的算子序列，**eager mode** 逐算子下发。相加后本地取最小值：只要任一组本步退回 eager（如混入长 prefill），全组这一步都不回放图。

### 2. 条件补齐与跳过门控

拿到最大宽度后，是否把本组输入补齐到最大值，由版本与运行分支决定：

- **`v0.30.0` `MRV1`（`model_runner_v1.py`）补齐条件**：只要命中以下任一条件，各组统一补齐到最大宽度——同步后仍回放计算图、处于草拟模型（MTP）、MoE 通信命中 `ALLGATHER` / `MC2`、CANN MegaMoE 命中 `FUSED_MC2`，或任一跨 DP 细粒度 TP 大于 `1`（`oproj` / `lmhead` / `embedding` / `mlp`）。未命中时保留各自真实宽度向量。
- **历史快照与 `main` 边界**：历史 GLM `db701c1f` 快照里，本地初选允许补齐或开启序列并行/细粒度投影 TP 时，即使对侧退回 eager 仍保留补齐宽度；`main` 的 `MRV2` 改由上游 `GPUModelRunnerV2` 统一协调，并补充 `requires_lmhead_dp_sync` 判定。注意 eager 不等于一定不补齐，草拟模型保留最大宽度也不推出它永不进图。

何时能省掉这次每步 `All-Reduce`？`should_skip_allreduce_across_dp_group` 按固定顺序把关：

- **一律不跳过**：开启分层通信（`mc2_comm_alg == "hierarchy"`），或配置/运行模式启用 MegaMoE（`is_mega_moe_supported()` / `use_cann_megamoe`）。
- **直接跳过**：非 MoE 稠密模型（每组独立副本，零跨组同步）。
- **条件跳过（仅 PD 分离 KV 接收端）**：MoE 模型仅在充当 `is_kv_consumer`、未命中 `use_cann_megamoe`，且满足 `decode_can_skip and (chunked_prefill_can_skip or recompute_scheduler_enable)` 时允许跳过。其中 `decode_can_skip` 要求 decode 潜在最大宽度走 `MC2`/`FUSED_MC2`；`chunked_prefill_can_skip` 要求 `max_num_batched_tokens` 走 `MC2`/`FUSED_MC2` 且前向图模式不拆独立例程（`uniform_cudagraph_mode`）；`recompute_scheduler_enable` 仅替代 prefill 侧检查，不能豁免 `decode_can_skip`。常规一体式 MoE 部署每步必同步（整批补齐演算见[多条请求：再补到两组的最大值](concurrent-requests.md#再补到两组的最大值)）。

## 空闲的组由谁叫起来陪跑，陪跑时算什么？

**空闲组由自身的 `DPEngineCoreProc` 主循环驱动陪跑：只要全局运行标志 `engines_running` 仍亮着，本步无真实请求就用一条整齐 decode 大小的假输入执行 `execute_dummy_batch()`，假输入自身输出丢弃，替忙组算出的真实专家贡献照常送回。** 整批被拉宽的数值算例统一见[多条请求：空闲的 DP 组为什么还要陪跑](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)。

### 1. 谁来决定跑，怎样构造假输入

决定权不在忙组，也不在 `DPCoordinator` 每步下令，而在空闲组自己的 `DPEngineCoreProc` 主循环。每轮先处理输入队列再尝试调度：若本步未排入真实请求，且「本地仍有未完成请求」或「全局运行标志 `engines_running` 为真」（且未处于 sleep 休眠态），就调用 `execute_dummy_batch()`；两者皆否才空转不进前向。

Worker 执行 `execute_dummy_batch()` 时按以下口径准备输入（对应上图第二轨）：

- **本地起点与状态保护**：在 `v0.26.0rc`、`v0.30.0` 与 `main` 中，worker 先记一次显存统计，再按 `uniform_decode_query_len = 1 + 草拟词数` 构造最小整齐 decode 形状，并传 `skip_gdn_state_update=True`（`main` `MRV2` 映射为 `skip_ring_state_update`）防止假输入污染线性注意力递推状态。历史 GLM 镜像（`db701c1f`）开启 MTP 每步猜 `3` 词，本地起点为 `4` 个 token 且不记显存统计。
- **对齐拉宽与简化执行**：假输入进入 `_dummy_run` 后照样参与宽度对齐（对侧纯 decode 时补齐回放图，混入长 prefill 时补齐并退回 eager；强制 eager 且未命中补齐条件时保留本地宽度）。逐层必走 TP 与专家通信，但**开销不等同于同宽真实请求**：dummy 路径默认不构建 attention 元数据（仅命中 FULL 图等条件时构建），例如 GLM 的 KDA 层在无元数据 eager 路径下做完输入投影即提前返回，跳过状态递推。

### 什么时候停，怎样再叫醒

`engines_running` 在收到新请求或 `START_DP_WAVE` 广播时亮起，在周期性 `sync_dp_state` 两元素求和确认「全组无未完成请求」且「无待达成运维暂停共识」时熄灭——此时 `current_wave` 加 `1`，由 `DP0` 向 `DPCoordinator` 报告 `wave_complete`：

- **检查节拍**：`v0.30.0` 与 `main` 在 **`step_counter == 1` 以及每隔 `dp_sync_interval`（默认 `16`）步** 检查（刚唤醒无活只需 `1` 步即可停回，尾段最多空跑 `15` 步）；历史 GLM 快照（`0fc695fc`）固定在第 `32, 64, 96...` 步检查，尾段最多空跑 `31` 步。
- **唤醒与运维暂停边界**：自然空闲停波后，新请求到达前端会触发 `DPCoordinator` 广播 `START_DP_WAVE` 唤醒其余组（收到旧波次请求且未暂停的引擎也会主动通知开新波）。一旦达成**运维主动暂停**共识，引擎置位 `ignore_start_dp_wave = True` 丢弃普通唤醒消息，必须显式调用 `resume_scheduler` 清除暂停态并完成全组协调，不能仅靠新请求唤醒。

## 真机实测：Ascend 910B3 上 MoE 扩至 DP=2 的陪跑与双池代价

在单机八卡 `Ascend 910B3`（`CANN 9.1.0`、`vllm-ascend 0.30.0`、`u=0.88`、`INFO` 干净态）上，使用统一脚本（平均 `262` prompt tokens、`128` 输出 tokens）对比了 `Qwen3-30B-A3B` 的四卡单组 `DP=1 (TP=4+EP=4)` 与八卡双组 `DP=2 (DP=2+TP=4+EP=8)`（完整对账日志、指标摘录与计量口径见 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)）。这组实测直接把上文讲的「双池隔离」「空闲组陪跑」与「跨 DP 专家同步」变成了可量化的数字：

```wiki-diagram
file: ep-fig-910b3-moe-vs-dense-and-ep8
```

| 实测项（`Qwen3-30B-A3B` BF16，统一 `262`-tok 输入 / `128`-tok 输出） | `DP=1`（`TP4+EP4`，4 卡） | `DP=2`（`DP2+TP4+EP8`，8 卡） | 变化与归因 |
| --- | ---: | ---: | --- |
| 运行请求分发（`c=1 / c=4 / c=16`） | 全部在单组 | `1/0` · `2/2` · `8/8`（正式 `11/10`，零抢占） | 证实前端路由已均分至双 DP，非单组打满 |
| 可用 KV 容量（单 DP / 总容量） | `1,692,032` tokens | `1,975,168 / DP`（双 DP 合计 **`3,950,336`**） | 路由专家权重精确减半（`13.500→6.750 GiB`），单卡总重 `14.2652→7.5152 GiB`（实降 `47.32%`，详账见[EP 页](expert-parallel.md#落到标准部署qwen3-30b-a3b-的-ep4-专家分工)） |
| `c=1` TTFT / TPOT（`ms`） | `331.10` / **`77.90`** | `445.66` / `96.36` | TTFT `+34.60%`、TPOT `+18.46 ms (+23.70%)` |
| `c=16` 总吞吐 / 单卡效率（`tok/s`） | **`179.70`** / **`44.93`** | `149.45` / `18.68` | 总吞吐 `-16.83%`，单卡效率 `-58.4%` |
| 前缀缓存命中率（全轮累计） | **`25.49%`**（`1,536 / 6,026`） | `16.99%`（`1,024 / 6,026`） | 双 DP 各自维护独立 KV 池，前缀复用被分池稀释 |

把四项 DP 运行代价对号入座：

1. **单请求下 `DP1` 空闲陪跑。** `c=1` 运行快照记录 `DP0=1、DP1=0`；虽然 `DP1` 没有用户请求，但因 `Qwen3-30B-A3B` 的路由专家跨 8 卡仅放一份，`DP1` 仍须走 `execute_dummy_batch()` 同步进入每层跨组通信。本组对比观测到 `c=1` `TPOT` 净增 `+18.46 ms`（`TTFT` 增 `+114.56 ms`）；跨 DP 集合通信、空闲陪跑、HCCS/NUMA 与绑核回退均可列为候选因素，现有采集缺少逐步通信与 NUMA 轨迹，尚不能确认各项是否存在净贡献或拆分各自份额。
2. **A2 无 LoRA 下 `ep_world_size = 8 < 16` 走 `ALLGATHER`，`dp_size > 1` 触发跨 DP 收集归约。** 源码在 A2 硬件画像下需要 `ep_world_size >= 16` 才切入 `MC2`；四卡 `DP=1, EP=4` 与八卡 `DP=2, EP=8` 均选中 `ALLGATHER`，且 `dp_size > 1` 仅在八卡双 DP 组触发每层沿 DP 通信组的 `all_gather`（收集两份激活与 router 分数）和收尾 `reduce_scatter`（而非 `AllToAll`），把两组的步频和通信绑定在一起。
3. **低中并发下的批度稀释与双池隔离。** `c=16` 均分给双 DP 后每组仅 `8` 个并发请求，单组矩阵计算批度减半，同时原本在单池里能复用的共享前缀被拆散到两个互不共享的 KV 池中（命中率从 `25.49%` 跌至 `16.99%`），且 Host 绑核因缺少拓扑亲和映射回退到 `global-slice`；上述多项变化同时出现时，观测到 8 卡 `c=16` 总吞吐低于 4 卡（`149.45` vs `179.70 tok/s`）。
4. **实测边界。** 双 DP 解锁的 `3,950,336 tokens` 是显存容量上限而非吞吐拐点；`c=32` 仅是均分下让每 DP 回到 `16` 个请求的第一个对照点。因本次最高测到 `c=16` 且未采集 `EP=8` 逐步通信或 NUMA 流量 trace，暂不能把 `+18.46 ms` 精确拆给陪跑、HCCS 或 NUMA，也不能未经实测宣称 `c=32` 必然反超。

## 双机 16 卡混合部署：DP2 宽度对齐与空闲陪跑

到了跨节点的 **GLM-5.3-Flash 双机算例**（固定快照 `vllm@0fc695fc + vllm-ascend@db701c1f`，`2×A2×8`、`TP8 / DP2 / EP16`，完整前提回链[部署前提](glm-5-3-flash-two-node.md#部署前提)），缓存与步宽口径和标准 GQA 有所不同：稀疏 MLA 存压缩潜向量，KDA 另有卷积与递推状态；单组每步预算 `8192`，MTP 令单条 decode 与 dummy batch 起点均为 `4` 个 token，且该快照固定每 `32` 步检查一次全局停机。

下图给出该固定 GLM 快照中，一个 MoE DP 组的 `DPEngineCoreProc` 主循环每转一圈的完整状态流转：

```wiki-diagram
file: data-parallel-loop
```

### 每台机器一个 DP 组与一步五站推进

**双机算例采用 `DP2`：`node0`、`node1` 各是一个 DP 执行组，组内 `8` 张卡用 `TP8` 合作；`EP16` 横跨两组，`node1` 的 `8` 张卡持有编号 `E144–E287` 的后一半路由专家（每个 MoE 层共 `288` 个路由专家，编号 `E0–E287`）。** 每卡专家连续编号表见 [EP 页](expert-parallel.md#放到-glm-双机一个-token-走过一层-moe)。

下图先展示两台机器各自驻留的模块，再演示两条请求怎样按打分整条进入不同执行组、各自算完并把回复送回各自用户；MoE 层的跨组专家协作按下文和 EP 页执行。

```wiki-scene
parallel-mechanism:6
```

沿着双机里的「一步」从头走一遍：

1. **进程分布。** `node0` 运行 API server、`DPCoordinator` 和 `DP0` 的 `EngineCore`；`node1` 以 `--headless` 模式启动，不建前端，只跑 `DP1` 的 `EngineCore`。每个 `EngineCore` 各管本机 `8` 个 worker（进程清单见[双机部署里一共有哪些进程](engine-processes.md#双机部署里一共有哪些进程)，启动时序见[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)）。
2. **入口派组。** 请求到达 `node0` 的 API server，未指定组号且非专用分支时按 `waiting × 4 + running` 挑 `DP0` 或 `DP1` 直送对应 `EngineCore`。每组 scheduler 每步最多排 `32` 条请求、`8192` 个 token（见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)），两组各享一份 `8192` 预算。
3. **跨机对齐。** `16` 张卡按两机同号配成 `8` 个 DP 通信组 `{0, 8}`、`{1, 9}` 直至 `{7, 15}`，每组 `2` 张卡；每步前向前 `8` 组各自做一次对齐拿到同一宽度（分组表见 [16 张卡怎样分组](glm-5-3-flash-two-node.md#16-张卡怎样分组)）。
4. **逐层前向。** 两组按对齐后的宽度跑 `45` 层主干；每个 MoE 层两组的 token 在 `16` 张卡之间 dispatch 与 combine，最宽一组超过 `128` 行时两台机器一起切到 AllGather。
5. **全局停机检查。** 每 `32` 步两个 `EngineCore` 交换一次是否还有未完成请求。

**单请求 R1 与负载不均的场景 M：**
- **单条请求 `R1`（落在 `DP0`）**：`node1` 无请求，每步跑 `dummy batch`（见[一条请求的第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)）；decode 步里 `DP0` 与 `DP1` 假输入起点都是 `4` 个 token，对齐后各自回放 `4` 词计算图。
- **场景 M 与变体 M′**：`DP0` 有 `12` 条 decode 请求并混入一条 `6000` 词 prefill，`DP1` 有 `7` 条 decode（设定见[示例场景 M 与变体 M′](concurrent-requests.md#示例场景-m-与变体-m)）。纯 decode 步两组均按 `64` 宽回放图；混入 `6000` 词 prefill 那一步两组均按 `6048` 宽退回 eager，`DP1` 真正有用的只有 `28` 行。在 `DP1` 完全空闲的变体 **M′** 中，其 `dummy batch` 从本地 `4` 词出发同样被拉到 `64` 或 `6048`（推导见[空闲的 DP 组为什么还要陪跑](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)与 [EP 陪跑小节](expert-parallel.md#两个-dp-组为什么要陪跑)）。
- **显存不能按 DP 简单乘除**：attention、稠密层与共享专家每台各有一份，`288` 个路由专家 `16` 卡合起来只有一份，因此每台既不是一份完整模型也不是半份（逐项显存账见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)）。

## 常见误解

```wiki-diagram
file: dp-fig-myths
```

- **「每个 DP 组都是一份完整的模型副本。」** 稠密模型如此，MoE 模型不是：在 GLM 双机（及一般跨组 EP 部署）里，路由专家分在全部组的卡上，各组合起来才构成一份完整模型，单组算 MoE 层离不开其余组。
- **「只有开了 `--enable-expert-parallel` 才会触发空闲组陪跑。」** 错。陪跑由 MoE 模型在 `DP > 1` 时自动走 `DPEngineCoreProc` 触发；不开 EP 时上游 `FusedMoE` 把每个专家矩阵按 $\text{DP} \times \text{TP}$ 切成片摊到全部卡上，跨组集合通信照样每层发生。
- **「跨节点 RoCE 部署 MoE 可以同时打开 `PP > 1` 和 `DP > 1`。」** 错。`MoeDistributeDispatch` 不支持跨机 RoCE 下的 `PP + DP` 组合，且无 Python 启动期拦截，误配会在运行期挂死或报错。
- **「DP 把单条请求拆成几份并行算。」** DP 切分的是请求归属与调度队列；请求归原执行组，attention 等由组内 TP 合作，路由专家才经 EP 跨组协作。
- **「空闲组恒跑 1 个假词、固定 32 步才停，或者空闲组完全不花算力。」** 仅本地本步未跑请求且全局仍在波次中才跑 `dummy batch`；本地起点为 `1 + 投机词数`（GLM 为 `4`），满足补齐条件时会被对侧长 prefill 拉到几千行（假词自身输出丢弃，替对侧算的专家结果是真的）；`v0.30.0` 默认第 `1` 步及每 `16` 步核对停机。
- **「双机只传 `--data-parallel-size 2` 就会自动跨两台机器分两组，且分数变了请求会迁移。」** 普通 `mp` 缺省 `local = dp` 会在单机起两个组，双机必须显式传 `-dpl 1` 与副节点 `--headless`；请求派定后 KV cache 留在原组池中，绝不自动搬家。
- **「加一组 DP，吞吐就严格翻倍。」** 吞吐受序列长度、并发度、批次满载率、双池前缀复用稀释及跨组对齐与专家通信制约。在 `Ascend 910B3` 真机实测中，`Qwen3-30B-A3B` 在 `c=16` 并发下由 `DP=1` 扩到 `DP=2` 后，虽把双组请求精确均分为 `8/8`、解锁 `3.95M` KV 容量，总吞吐反而从 `179.70` 跌至 `149.45 tok/s`（前缀命中率亦从 `25.49%` 降至 `16.99%`）。

## 对照源码

### 怎么开

双机两端完整启动命令见[双机部署的「怎么开」](glm-5-3-flash-two-node.md#怎么开)与[双机启动参数](engine-processes.md#怎么开)，与 DP 直接相关的核心参数如下：

| 参数 | CLI / Python 入口 | 输入缺省与约束 | GLM 双机取值与工程要点 |
|---|---|---|---|
| `data_parallel_size` | `--data-parallel-size` / `-dp`；`EngineArgs`、`LLM` 同名 | `int`，默认 `1`，`ParallelConfig` 要求 $\ge 1$ [C1] | 两端均传 `2`（全局两个执行组）；跨机 RoCE 跑 MoE 时若 `DP > 1` 须保持 `PP = 1` [S11] |
| `data_parallel_size_local` | `--data-parallel-size-local` / `-dpl`；`EngineArgs`、`LLM` 同名 | `EngineArgs` 默认 `None`（按启动拓扑派生），`ParallelConfig` 字段默认 `1`，要求 $0 \le \text{local} \le \text{dp}$ [C1][C4] | 两端均显式传 `1`（每台起 `1` 个 `EngineCore`）；省略时普通 `mp` 会取全局 `DP` 尝试单机起两组 |
| `dp_sync_interval` | `--dp-sync-interval`（`v0.30.0+` `ParallelConfig` 字段） | `int`，`v0.30.0` / `main` 默认 `16`，要求 $\ge 1$ 且各 rank 一致 [C1] | 控制全局未完成请求与暂停共识的 `All-Reduce` 步距（历史 `0fc695fc` 固定 `32` [C44]） |

- **本地组数、编号与环境变量回退**：每个本地组连续占用一个全局 DP 编号（`node0` 从 `0` 起、`node1` `--headless` 从 `1` 起覆盖 `[0, 2)`，本地 worker 数为 $\text{local} \times \text{TP} \times \text{PP} \times \text{PCP}$）。`local = 0` 是低层“本进程无本地引擎”哨兵值而非关闭 DP；显式传 `--data-parallel-rank` 会切入外部负载均衡（`local` 限定 `1` 或 `None` 并归一为 `1`，且仅支持 MoE 在线多实例）。当传入 `DP = 1` 且 `local != 0` 时，`ParallelConfig` 会回退读取 `VLLM_DP_*` 环境变量（在线单入口同样可达该分支，缺省 `VLLM_DP_SIZE = 1`）。
- **自动开关与附加控制**：陪跑无独立开关——MoE 且 `DP > 1` 自动实例化 `DPEngineCoreProc` 并由 `DPCoordinator` 打开波次协调，非 MoE 自动调 `reconfigure_for_independent_dp_rank()` 按 `DP = 1` 独立运行 [C6][C8]；请求头传 `X-data-parallel-rank: 0` 可直指目标组（否则依次走 late-interaction 与负载打分）；仅 `v0.23.0` 的 `additional_config` 含 `dp_allreduce_on_npu`（默认关，开启后每步对齐由 CPU `gloo` 改走 NPU）；`use_batched_dp_moe` 仅对 `deepep_low_latency` / `nixl_ep` + `EP` + `DP > 1` 把缺省 `max_num_batched_tokens` 压到 `256` [C2][C5]；DP 逻辑组 HCCL 缓冲由 `calculate_dp_buffer_size()` 固定按下限 `50 MiB` 兜底 [C12][C13]。

### 会报什么错

- **拓扑与组数校验失败**：`DP <= 0` 或 `local < 0` 被字段下界拒绝；`local > data_parallel_size` 报 `must be <= data_parallel_size`；`--headless` 配 `local = 0` 报 `data_parallel_size_local must be > 0 in headless mode`；显式 `data_parallel_rank` 混配 `local > 1` 或开启 `hybrid_lb` 缺本地数均在 `EngineArgs` 组合检查报错；`main` 分支对非整除的跨节点组数显式抛 `ValueError: Invalid data parallel configuration: nnodes ... must be divisible by ...` [C17]。
- **请求头越界与暂停恢复冲突**：`X-data-parallel-rank` 越界抛 `ValueError: data_parallel_rank 2 is out of range [0, 2).`（非整数值则按未指定处理）；暂停共识尚未完成就调恢复抛 `RuntimeError: resume_scheduler called while pause is still in flight.`。
- **跨机 RoCE `PP > 1 × DP > 1` 静默挂死陷阱**：跨节点 RoCE 部署 MoE 同时打开 `PP > 1` 与 `DP > 1` 时无 Python 启动异常，会在 `MoeDistributeDispatch` 阶段挂死或报错 [S11][S22]。认站调试日志包括停波时 `Wave %d finished, pausing engine loop.`、空闲唤醒 `EngineCore starting idle loop for wave %d.` 及暂停共识 `DP pause consensus reached, ignoring START_DP_WAVE.` [C7]。

### 开销和什么时候别开

- **四项运行期开销**：① 每步一次 `2 × DP` `int32` 的对齐 `All-Reduce`（eager 模式亦不省，仅非 MoE 或满足条件的 PD KV 接收端跳过 [C14][C16]）；② 空闲组 `dummy batch` 陪跑（受对侧长 prefill 与补齐规则拉宽，虽可跳过部分 attention / 递推状态，仍占设备与通信时间）；③ 周期性全局停机检查（`v0.30.0` 默认每 `16` 步且含第 `1` 步 [C7]，历史 `0fc695fc` 每 `32` 步最多尾跑 `31` 步 [D]）；④ 请求派定不迁移与约 `100 ms` 统计推送滞后带来的长尾不均。
- **什么时候别开**：并发请求长期喂不满单组时，多开的 MoE DP 组不仅大部分时间都在陪跑，还会把单组批度切薄并拆分前缀缓存池——在 `Ascend 910B3`（`v0.30.0`）真机实测中，`Qwen3-30B-A3B` 扩至 `DP=2+TP=4+EP=8` 后在 `c≤16` 下反呈负扩展（`c=1 TPOT` `77.90 → 96.36 ms`，`c=16` 总吞吐 `179.70 → 149.45 tok/s`，前缀命中 `25.49% → 16.99%`，见[Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)）；跨节点 RoCE 已启用 `PP > 1` 的 MoE 部署严禁再开 `DP > 1`（而 GLM 双机因单机 `8` 卡装不下全部 `288` 个专家才采用 `TP8 + DP2 + EP16`，理由见[为什么是两台机器](glm-5-3-flash-two-node.md#为什么是两台机器不是一台)）。

### 版本差异

本页 GLM 双机绑定算例（`32` 步检查间隔、每卡 `4` 个 dummy token、`waiting × 4 + running` 打分）对应独立部署镜像 `vllm@0fc695fc + vllm-ascend@db701c1f`（包含 `2c59ff10` 维护分支未合入的 GLM MoE 模型代码；其对齐与 dummy 逻辑和 `2c59ff10` 除行号偏移及不记显存统计外一致）。下表按站内统一四列基线汇总控制面与执行侧演进：

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| **前端默认选组打分** | `waiting * 4 + running`，本地补记 `+ client_count` [C36] | 维持 `waiting * 4 + running`，新增轮转 `eng_start_index` 消平分偏置 | 改为 `max(client_count * inflight, waiting + running)` 加 `waiting * 6.0 * max(0, kv_usage - 0.5)` KV 压力惩罚 [C9] | 延续 KV 压力打分，入口最前新增 `streaming_reqs` 流式会话亲和 |
| **全局停机检查间隔** | 固定每 `32` 步查一次（尾段最多多跑 `31` 步） | 同 `v0.23.0` | 新增配置项 `dp_sync_interval`（默认 `16`），且 `step_counter == 1` 首步必查 | 同 `v0.30.0`（默认 `16` + 首步必查） |
| **`local` 与跨节点拓扑校验** | 普通 `mp` 缺省取全局 `DP`；非零 `start_rank` 才推断 `hybrid_lb`；部分非法组合用 `assert` | 同 `v0.23.0` | 显式 `start_rank=0` 也保留并触发推断；规模计入 `PCP`；多项 `assert` 改为 `ValueError` | 延续 `v0.30.0`，`nnodes_within_dp` 对非整除节点数显式抛 `ValueError` |
| **Worker `dummy batch` 动作** | 起点 `decode_token_per_req = 1 + 草拟词数`；记显存统计，不传 GDN 开关（镜像 `db701c1f` 不记统计） | 起点改读 `uniform_decode_query_len`；记统计并传 `skip_gdn_state_update=True` | 延续 `v0.26.0rc`（`worker.py#L1278-L1282`） | `@runtime_guard_idle_step` 装饰并注入 `vllm_config`，`MRV2` 转 `skip_ring_state_update` 且尾段补 `lmhead_tp` join |
| **每步对齐通道与补齐条件** | 默认 CPU `gloo`（`dp_allreduce_on_npu` 可切 NPU）；允许补齐或草拟时统一拉宽 | 固定 CPU `gloo`（移除 NPU 开关）；延续两行表同步规则 | `MRV1` 扩大补齐：图回放、草拟、`ALLGATHER`/`MC2`、MegaMoE `FUSED_MC2`、任一细粒度 TP `> 1` 均补到最大宽度 | 退役 `MRV1` 迁至 `MRV2`，复用上游 DP 协调并结合 `should_skip_allreduce_across_dp_group` 与 `requires_lmhead_dp_sync` |
| **DP HCCL 缓冲、`use_batched_dp_moe` 与跨机 `PP×DP`** | `"dp"` 缓冲 $\max(\lceil(dp+1)\times 4\text{ B}/1\text{ MiB}\rceil, 50\text{ MiB})$；`deepep_low_latency`/`nixl_ep` 触发 `256` 批上限 | 同 `v0.23.0` | 延续 `50 MiB` 缓冲下限与 `256` 批上限分支；官方文档明确跨机 RoCE 下 MoE 禁配 `PP > 1 × DP > 1`（无 Python 启动拦截） | 同 `v0.30.0`（跨机 RoCE `PP×DP` 仍禁配且无启动期 Python 断言） |

### 源码位置

- **上游 `vllm` 参数、协调与路由**：`data_parallel_size`、`data_parallel_size_local`、`dp_sync_interval`、`use_batched_dp_moe` 与 `sync_dp_state` 见 `ced6857a` `vllm/config/parallel.py#L128-L165, #L740-L805`（`256` 常量见 `vllm/config/scheduler.py#L43`，缺省批上限分支与本地组数派生见 `vllm/engine/arg_utils.py#L2215-L2310, #L2919-L2942`；`v0.23.0` / `v0.26.0` / `main` 对照见 `0fc695fc`、`568afb3a`、`ba15685a` 同名文件）；MoE `DPEngineCoreProc` 与稠密 `reconfigure_for_independent_dp_rank` 分流、波次循环、`execute_dummy_batch` 与 `START_DP_WAVE` 见 `ced6857a` `vllm/v1/engine/core.py#L1318-L1329, #L1996-L2281` 及 `coordinator.py#L23-L55`（`0fc695fc` 对照见 `core.py#L1152-L1162, #L1788-L1945` 与 `coordinator.py#L23-L278`）；前端选组打分、请求头解析与 `late_interaction` 见 `ced6857a` `core_client.py#L1546-L1597`、`ba15685a` `core_client.py#L1811-L1871` 及 `0fc695fc` `core_client.py#L1398-L1426`、`serving.py#L398-L411`、`input_processor.py#L258-L268`、`late_interaction.py#L15-L36`；DP/EP 建组与 `FusedMoE` 无 EP 展平切片见 `0fc695fc` `parallel_state.py#L1833-L1875` 与 `ced6857a` `fused_moe/config.py#L1212-L1250`。
- **昇腾 `vllm-ascend` 执行侧、缓冲与跨机边界**：跨节点 RoCE 下 MoE `PP > 1 × DP > 1` 互斥限制见 `c09d3e20` `docs/source/user_guide/feature_guide/pipeline_parallel.md#L438-L440`（`main` `8d6180e2` `#L430-L432`）；`"dp"` 组 `50 MiB` HCCL 缓冲计算与每步对齐跳过谓词见 `c09d3e20` `vllm_ascend/utils.py#L73-L75, #L1266-L1289, #L1378-L1435`（`2c59ff10`、`2ed6cbba`、`8d6180e2` 同文件对照）；`execute_dummy_batch`、`_sync_metadata_across_dp` 与 `_dummy_run` 见 `c09d3e20` `worker/worker.py#L1278-L1282`、`worker/model_runner_v1.py#L823-L884`、`8d6180e2` `worker/worker.py#L1397-L1405`、`worker/v2/model_runner.py#L720-L756, #L1293-L1340`，以及历史 GLM 镜像 `db701c1f` `worker/model_runner_v1.py#L652-L740, #L2898-L3012, #L3332-L3652, #L5383-L5389` 与 `models/glm5_next.py#L1453-L1508, #L1707-L1758`。
- **A2 `EP=8` 跨 DP 选路与 910B3 真机实测**：A2 策略 `CAPACITY_AND_EXPERT_DENSITY` 及 `ep_world_size >= 16` 门槛见 `c09d3e20` `device/hardware_profile.py#L281-L292`、`ascend_forward_context.py#L297-L315`；跨 DP `all_gather` 与 `reduce_scatter` 见 `ops/fused_moe/prepare_finalize.py#L452-L464, #L552-L569`；`Qwen3-30B-A3B` `DP=1` 与 `DP=2` 真机对账与压测摘录见 `raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L952-L1077` 与 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)。
- **推导、示意与推断说明**：DP 通信组个数与每组成员数、常规一体式 MoE 部署每步必对齐、双机单机显存不按 DP 线性乘除均由通信组构造与权重切分严格推出 [D]；`8` 条请求、`10 GB / 100 GB` 权重、`8` 专家与打分条数为教学示意设定 [A]；历史公式等待数乘 `4` 对应 prefill 预算开销属辅助理解推测 [I]。

**待核：**

- `dummy batch` 在不同注意力后端与各计算图模式下的完整算子级耗时占比（GLM KDA 无元数据提前返回已由源码确认，其余后端仍待实测）。
- 单组未进入对齐 `All-Reduce` 或跨机 RoCE 误开 `PP > 1 × DP > 1` 时，HCCL / `MoeDistributeDispatch` 实际打印的底层超时与错误码文本（缺实机故障日志）。
- 仅依赖 `VLLM_DP_*` 环境变量回退而不传显式 CLI 参数启动在线多组服务的端到端设备验收。
