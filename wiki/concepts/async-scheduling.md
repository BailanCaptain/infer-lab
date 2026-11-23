---
id: async-scheduling
title: Async scheduling：趁卡在算，先把下一步排好
type: feature
summary: >-
  异步调度让 CPU 在 NPU 算这一步时就排好下一步：调度器用输出占位记下还没回来的 token，Worker
  在卡上补真值，结果回来再销账。讲清收益与代价、投机解码下先按全接受排再改正、在途结果怎样收尾、换调度器的特性为何要备异步版，以及 GLM 双机上 R1
  每一步的占位账。
aliases:
  - 异步调度
  - Async Scheduling
  - async scheduling
  - AsyncScheduler
  - num_output_placeholders
  - async_scheduling
  - 输出占位
  - Dual Batch Overlap
  - DBO
  - 双批次重叠
  - microbatch
chapters:
  - '12'
order: 20
sources:
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L146-L188'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L931-L1002'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L497-L507'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1017-L1027'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L484-L598'
  - 'vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L19-L67'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L376-L407'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1005-L1013'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L519-L535'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1414-L1432'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1953-L1971'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1700-L1826'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1461-L1493'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2684-L2710'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2569-L2582'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1608-L1628'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1580-L1606'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1886-L1896'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2526-L2533'
  - 'vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L244-L258'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L702-L714'
  - 'vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L56-L69'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L660-L725'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L966-L984'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1254-L1282'
  - 'vllm@568afb3a:vllm/v1/core/sched/async_scheduler.py#L30-L42'
  - 'vllm@568afb3a:vllm/config/vllm.py#L512-L533'
  - 'vllm@568afb3a:vllm/config/scheduler.py#L190-L198'
  - 'vllm@568afb3a:vllm/config/vllm.py#L1014-L1112'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L474-L482'
  - >-
    vllm-ascend@baa023ad:docs/source/tutorials/features/dynamic_chunked_pipeline_parallel.md#L131-L131
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/support_matrix/feature_matrix.md#L5-L41
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/support_matrix/supported_features.md#L20-L20
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L511-L513'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L712-L726'
  - 'vllm@84030bbe:vllm/config/vllm.py#L1286-L1386'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1067-L1075'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1377-L1387'
  - >-
    vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L30
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1130-L1153'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1233-L1245'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L504-L510'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L239-L316'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2372-L2387'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L4645-L4690'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2403-L2418'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2559-L2564'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L758-L839'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L845-L925'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_pp_mtp.py#L37-L206'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_pp_mtp.py#L37-L206'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_pp_mtp.py#L237-L290'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_pp_mtp.py#L237-L290'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1471-L1488'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L188-L220'
  - 'vllm@84030bbe:vllm/config/vllm.py#L581-L602'
  - 'vllm@84030bbe:vllm/v1/core/sched/async_scheduler.py#L19-L49'
  - 'vllm@84030bbe:vllm/config/scheduler.py#L212-L233'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/utils.py#L7-L73'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1613-L1661'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1439-L1487'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L1802-L1850'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2600-L2613'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2714-L2740'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L2538-L2551'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L2657-L2683'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L2936-L2950'
  - 'vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L3076-L3102'
  - 'vllm-ascend@2c59ff10:vllm_ascend/compilation/acl_graph.py#L244-L258'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/compilation/acl_graph.py#L275-L289'
  - 'vllm-ascend@baa023ad:vllm_ascend/compilation/acl_graph.py#L284-L300'
  - 'vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L56-L69'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/recompute_scheduler.py#L55-L68'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_pp_mtp.py#L334-L347'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_pp_mtp.py#L336-L349'
  - 'vllm@0fc695fc:vllm/config/speculative.py#L34-L58'
  - 'vllm@0fc695fc:vllm/config/speculative.py#L128-L132'
  - 'vllm@568afb3a:vllm/v1/worker/gpu_model_runner.py#L258-L313'
  - 'vllm@84030bbe:vllm/v1/worker/gpu_model_runner.py#L289-L351'
  - "vllm@0fc695fc:docs/design/dbo.md#L1-L88"
  - "vllm@0fc695fc:vllm/config/parallel.py#L200-L215"
  - "vllm@0fc695fc:vllm/v1/worker/ubatch_utils.py#L38-L46"
  - "vllm@0fc695fc:vllm/v1/worker/dp_utils.py#L57-L74"
  - "vllm@568afb3a:vllm/config/parallel.py#L209-L224"
  - "vllm@568afb3a:vllm/v1/worker/ubatch_utils.py#L38-L46"
  - "vllm@568afb3a:vllm/v1/worker/dp_utils.py#L57-L74"
  - "vllm@ced6857a:vllm/config/parallel.py#L222-L237"
  - "vllm@ced6857a:vllm/v1/worker/ubatch_utils.py#L141-L149"
  - "vllm@ced6857a:vllm/v1/worker/dp_utils.py#L79-L96"
  - "vllm@84030bbe:vllm/config/parallel.py#L220-L235"
  - "vllm@84030bbe:vllm/v1/worker/ubatch_utils.py#L141-L149"
  - "vllm@84030bbe:vllm/v1/worker/dp_utils.py#L62-L79"
  - "vllm-ascend@2c59ff10:vllm_ascend/platform.py#L1250-L1263"
  - "vllm-ascend@db701c1f:vllm_ascend/platform.py#L1240-L1253"
  - "vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L1250-L1263"
  - "vllm-ascend@7d825229:vllm_ascend/platform.py#L918-L930"
  - "vllm-ascend@baa023ad:vllm_ascend/platform.py#L840-L852"
  - "vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L3751-L3769"
  - "vllm@0fc695fc:vllm/v1/worker/dp_utils.py#L101-L161"
  - "vllm@0fc695fc:vllm/v1/worker/ubatch_utils.py#L63-L114"
  - "vllm@0fc695fc:vllm/v1/worker/ubatching.py#L94-L105"
  - "vllm@0fc695fc:vllm/config/vllm.py#L1412-L1427"
  - "vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L5252-L5261"
  - "vllm@0fc695fc:vllm/v1/worker/gpu_ubatch_wrapper.py#L295-L331"
  - "vllm@0fc695fc:vllm/v1/worker/gpu_ubatch_wrapper.py#L431-L527"
  - "vllm@0fc695fc:vllm/model_executor/layers/fused_moe/modular_kernel.py#L1124-L1186"
  - "vllm@0fc695fc:vllm/config/parallel.py#L506-L512"
  - "vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1075-L1085"
  - "vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1386-L1407"
  - "vllm-ascend@c09d3e20:vllm_ascend/platform.py#L919-L923"
  - "vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L18-L42"
  - "vllm-ascend@8d6180e2:vllm_ascend/mrv2_utils.py#L29-L36"
  - "vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1083-L1087"
  - "vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L37-L37"
  - "vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L890-L976"
  - "vllm@ced6857a:vllm/config/scheduler.py#L190-L220"
  - "vllm@ced6857a:vllm/config/vllm.py#L589-L605"
  - "vllm@ba15685a:vllm/config/scheduler.py#L247-L275"
  - "vllm@ba15685a:vllm/config/vllm.py#L616-L635"
  - "vllm@ba15685a:vllm/config/vllm.py#L1799-L1851"
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: continuous-batching
    kind: builds-on
    note: 异步调度是在连续批处理逐迭代排步循环之上叠加的输出占位与在途批次队列机制
  - to: speculative-decoding
    kind: builds-on
    note: 候选被拒后已算数怎样回退；异步下先按全接受排、回来再改正
contradicts: []
updated: '2026-11-19'
origin: direct
---

## 卡在算这一步时，CPU 能不能先把下一步排好？

**Async scheduling**（异步调度）是 vLLM 引擎的一种排步方式：NPU 还在算第 k 步，CPU 上的调度器就把第 k+1 步排好、提交下去，不等第 k 步的结果回来。

先看一条请求怎样往前走。大模型的回答是一个 token 接一个 token 生成的，引擎每转一圈叫一**步**（step）。每一步分两半：CPU 上的 [Scheduler](vllm-scheduler.md)（调度器）先定这一步让哪些请求上、各算几个位置；NPU 再按这份计划做一次前向，采出新 token。前向算完，CPU 还有一串杂活：把新 token 收回来接到请求上，看它停没停，再排下一步。

如果这些活一件接一件做，NPU 每算完一步就得停下来，等 CPU 收完、排完。async scheduling 把这段等待挪走：CPU 趁 NPU 在算，先把下一步排好，NPU 一算完，下一步的计划已经在门口。

代价是多留一批在途工作，并为还没回来的 token 记输出占位；结果回来后还要处理接受、丢弃和资源回收，不能省掉这些记账与同步。

```wiki-diagram
file: async-scheduling
```

图里 CPU 上的一段活记 1 格，NPU 算一步记 3 格，同一条请求连走 3 步。同步时每两步之间 NPU 空等 1 格，3 步用 13 格；开了 async scheduling，第 2 步在第 1 步还在算的时候就排好了，NPU 从第 1 格一直算到第 10 格，3 步用 11 格。

有一点先说清：提前的只是**计划**，不是**计算**。第 k+1 步的前向要拿第 k 步采出的 token 当输入，所以 NPU 上仍是算完一步才算下一步；CPU 排第 k+1 步时并不知道那个 token 是什么，只知道「会有一个」。在不知道值的情况下怎样把账记对，是这一页的主体。

## 为什么需要它：decode 一步很短，CPU 的杂活就显眼了

每一步在 CPU 上要做的事，大致是这几件：

1. 把上一步采出的 token 从卡上拷回主机内存；
2. 把 token 接到对应请求上，判断是否碰到结束记号或长度上限；
3. 排下一步：谁上、各算几个位置、借哪些 [KV cache](kv-cache.md) 块（存放每个位置注意力中间结果的显存块）；
4. 把计划从 [EngineCore](vllm-engine-core.md)（引擎主循环所在的进程）发给各个 Worker 进程（每张卡一个、真正驱动 NPU 干活的进程）；
5. Worker 按计划在主机侧备好输入表，再交给卡。

这些活的耗时受请求条数、输入表大小、采样约束和所用后端等影响。模型前向的长短也有差别：prefill（处理提示词、可分多轮完成的阶段）的一轮常算成百上千个位置，CPU 准备占比相对较小；decode（在已有历史上往后生成）一步里每条请求只算 `1` 个或几个位置，前向变短后 CPU 这段开销就显眼了。一条回答可能有几百步 decode，同步等待会反复出现，实际占比仍须按批次和模型测量。

按图里的示意格数（CPU 一段 1 格，NPU 一步 3 格），把步数拉长来看 NPU 有多少时间在干活：

$$\text{Util}_{\text{sync}}(S) = \frac{3S}{1 + 3S + (S - 1) + 1}, \qquad \text{Util}_{\text{async}}(S) = \frac{3S}{1 + 3S + 1}$$

| 调度方式与步数（示意格数） | 总格数或忙碌比例算式 | 结果 |
|---|---|---|
| 同步 3 步（步间 NPU 各空等 1 格） | $1 + 3 \times 3 + 2 \times 1 + 1$ | **13 格** |
| 异步 3 步 | $1 + 3 \times 3 + 1$ | **11 格** |
| 同步 200 步的 NPU 忙碌比例 | $600 \div (1 + 600 + 199 + 1) = 600 \div 801$ | **约 75%** |
| 异步 200 步的 NPU 忙碌比例 | $600 \div (1 + 600 + 1) = 600 \div 602$ | **约 99.7%** |

这个算法有个前提：CPU 一段活不比 NPU 一步长。要是 CPU 一段要 4 格、NPU 一步只要 3 格，异步之后每步的节奏由 CPU 定，NPU 仍会等，只是比同步等得少。格数只说明原理，不是任何部署的实测。

代价都来自同一件事：计划发出去的时候，上一步的结果还没回来。

- **多压一批在途。** 本页先按 PP=1（不含流水线并行）的 V1 runner（第一代 Model Runner 执行器）解释，引擎最多保留 2 批：一批在卡上算，一批已经排好。PP 与 V2 runner（第二代执行器）的上限见本页[怎么开](#怎么开)。队列满、没有更多可排工作或采样需要前批结果时，要处理最老的一批，见 [EngineCore 的批次队列](vllm-engine-core.md#批次队列下一圈的调度和这一圈的计算叠起来)。
- **记账变复杂。** 调度器要给还没回来的 token 记占位，结果回来再销掉；带[投机解码](speculative-decoding.md)（先草拟几个候选 token，下一步由主模型一次验证）时，还要先按「候选全被接受」排，回来再改正。下面三节讲这些。
- **有些活仍依赖上一步。** 结构化输出（按 JSON 等格式约束输出）可能要先收到上一步 token 才能计算采样约束；强制清空前缀缓存时要识别并丢弃旧的在途结果；本页固定实现的 FULL 图回放还有当前流同步点。图同步并非异步开关专属，具体条件见[在途的结果怎样收尾](#在途的结果怎样收尾抢占结构化输出与图回放)。

几个名字常被混在一起，它们重叠的东西不同：

| 名字 | 重叠的是什么 |
|---|---|
| async scheduling | 下一步在 CPU 上的调度，和这一步在 NPU 上的计算 |
| 批次队列 | 本身不是重叠，是让引擎同时压着几批的容器；async scheduling 和 PP 都靠它 |
| 结果的异步拷贝 | 把采样结果拷回主机，和卡上接下来的计算；开着 async scheduling 时 Worker 才这样拷 |
| [PP](pipeline-parallel.md)（流水线并行） | 模型按层分成几段放在不同的卡上，各段同时算不同的批 |
| [DBO](#把一批拆成两半能否让通信和计算同时进行dbo)（双批次重叠） | 把同一步的输入拆成两个微批，让一份的专家通信与另一份的计算重叠；后端须专门支持 |

## 结果还没回来，下一步怎么排：先记输出占位

调度器给一条请求排几个位置，用的是[同一道减法](vllm-scheduler.md#调度器怎样排一步还差几个--截断--借块--记账)：应算减已算。「已算」在排完一步时就当场往前推，不等卡上真算完，这样下一步能接着往后排。

麻烦出在 decode 请求上。取一组示意数：一条请求已知 8 个 token；第 $k$ 步已经排出去、还在卡上算，排完那一刻已算记成 8，前 8 个位置都算进去了。第 $k$ 步要采出的第 9 个 token 还在卡上，调度器这边的已知仍是 8。这时排第 $k+1$ 步（不带投机解码）：

$$\Delta_{\text{new}} = N_{\text{known}} + N_{\text{placeholder}} - N_{\text{computed}}$$

| 记账方式（示意数，不带投机解码） | 算式 | 结果与调度后果 |
|---|---|---|
| 不记输出占位 | $8 - 8 = \mathbf{0\text{ 个}}$ | 这条请求会被当成这一步没活 |
| 记 1 个输出占位 | $8 + 1 - 8 = \mathbf{1\text{ 个}}$ | 与同步时每步 1 个位置一致 |

AsyncScheduler（上游专门用于异步的调度器）的办法，是在请求上多记一个数，叫**输出占位**：每排完一步，就给会产出 token 的请求记上「这一步会产出 1 个，只是还没回来」。减法多加这一项，结果就和同步时一样。这里的 1 只是**个数**，不说明是词表里的哪个 token；调度器排计划用不着值，值由 Worker 在卡上补，见下一节。

结果回来时，按实际收到的个数把占位销掉。连着看三个时刻，占位在 1 和 2 之间来回：

| 时刻 | 已知 | 输出占位 | 已算 | 接下来 |
|---|---|---|---|---|
| 排第 k+1 步之前（第 k 步在卡上） | 8 | 1 | 8 | 还差 8 + 1 − 8 = 1，排 1 个位置 |
| 排完第 k+1 步 | 8 | 2 | 9 | 两步在途，队列满，等第 k 步的结果 |
| 第 k 步的 token 回来 | 9 | 1 | 9 | 还差 9 + 1 − 9 = 1，接着排第 k+2 步 |

占位还管着三件收尾的事：

- **只允许登记已经完成的位置。** 开着 [prefix caching](prefix-caching.md)（前缀缓存：把算过的开头部分的 KV 块留给后来的请求复用）时，对仍在运行的请求，结果处理后的缓存登记上限是「已算 − 输出占位」；真正登记还受完整块等规则约束。上表第三行是 9 − 1 = 8：第 9 个位置已经排进第 k+1 步，尚不能作为已完成的缓存登记。
- **分段算的提示词先不记。** 被 [chunked prefill](chunked-prefill.md)（分块预填充：长提示词分几步算完）切开的提示词，前几段不产出 token，不记占位；最后一段算完才产出第一个 token，这时记 1 个。
- **快到长度上限时不多排。** 请求自带一个最多生成多少 token 的上限。异步下排下一步时，在途的那一步也许已经把长度用满了；只要能确定「就算候选全被拒，在途那一步回来后也到上限了」，调度器就跳过这条请求，不再多排一步。

把「CPU 提前排步隐藏气泡」「输出占位与卡上补真值闭环」以及 `v0.30.0` 下的并发批数与平台边界合到一张总览图里，后续各节逐块拆开看：

```wiki-diagram
file: async-scheduling-fig-overlap-placeholder
```

## 真 token 怎样到卡上：Worker 在卡上补值

计划里只有个数，第 k+1 步的输入却要真 token。这件事交给 Worker 进程里的 model runner（按计划准备输入、跑前向和采样的那段代码），它让 token 的值根本不用经过 CPU：

- **主机侧只写 −1。** Worker 在主机内存里也存着每条请求的 token 表。异步时，新 token 那一格先写 −1 占着。
- **真值留在卡上。** 采出的 token 在卡上留一份。准备第 k+1 步的输入时，卡上直接把它抄进输入的那一格，这条输入准备路径无需先把真值拷到 CPU 再传回。
- **候选也留在卡上。** 带[投机解码](speculative-decoding.md)（先草拟几个候选 token，下一步由主模型一次验证）时，草拟出的候选同样在卡上抄进输入。只有请求用到结构化输出、或采样参数要看已生成的 token 时，候选才拷回主机。
- **结果照样回到 CPU，只是晚一步。** 采样结果由另一条专门的拷贝流拷回主机内存，拷完记一个完成事件。EngineCore 在下一圈等这一步的结果时读它，接到请求上、发回前端。异步改的是「什么时候等」，没有省掉这条回程。

把两个进程在一圈里各做什么画成流程：

```wiki-diagram
file: async-scheduling-flow
```

左边展示固定旧版上游 EngineCore 的批次循环与占位协议；调度类仍可能被昇腾扩展，不能把整个进程视为完全未修改。右边由昇腾的 [NPUModelRunner](npu-model-runner.md) 准备输入和执行。图按 PP=1、普通生成请求画出主要路径：① 排计划、② 记账、③ 提交后，队列未满且还有计算或待排请求时，直接回到 ①；否则在 ④ 处理最老的一批，⑤ 销账，⑥ 把 token 发回前端。结构化输出需要前批 token 时，还有先提交前向、处理前批结果、再提交采样的分支。右列 ⑧ 的采样值一路留在卡上给下一步的 ⑦，一路拷回主机，由后续的 ④ 收下。

昇腾这边还有版本相关的接线。固定旧版在异步 PP、且本 Worker 不是 [PD 分离](pd-disaggregation.md)的 P 节点（Prefill 预填充节点）时，让最后一段直接广播采样结果；继承的广播函数要求每条请求只有一个采样值，纯中间 prefill 批还会跳过广播，不能把它当成所有 PP 与投机组合的支持保证。v0.26 rc 和 main 的 V1 PP 改为经调度输出传回，见版本表。ACL graph（昇腾的计算图录制与回放）的同步条件见[在途的结果怎样收尾](#在途的结果怎样收尾抢占结构化输出与图回放)。

## 带投机解码时：先按候选全被接受排，回来再改

投机解码让一步验证好几个候选，接受几个事先不知道。异步下排第 k+1 步时，第 k 步接受了几个还没回来，所以调度器和 Worker 都先按「候选全被接受」算，结果回来再改：

- **调度器这边。** 排一步，输出占位加「1 + 候选数」，因为这一步最多产出这么多 token；调度器手里的候选列表也换成候选数个 −1 占位，排下一步时照常把它们排进计划。结果回来，先按被拒的个数把已算和输出占位各减一次，再按实际收到的 token 数把输出占位减一次。
- **Worker 这边。** 先按全接受准备乐观的长度，再用上一步实际的「有效 token 数」纠正。本页固定 NPU runner 在设备上修正已算数，并据此计算位置；只有注意力后端需要 CPU 长度时，才另用拷回主机的有效数修正 CPU 长度。主机读取前会等待完成事件，拷贝提前发起有利于重叠，但不保证等待耗时为零。

用示意数（每步 2 个候选，这一步接受了 1 个）走一遍一步的输出占位怎样加、怎样销：

$$\Delta_{\text{cancel}} = (K - A) + (1 + A) = 1 + K = \Delta_{\text{add}}$$

| 记账时刻（示意：$K = 2$，接受 $A = 1$ 个） | 算式 | 变化结果 |
|---|---|---|
| 排这一步时加占位 | $1 + 2$ | **+3 个**（1 个确定位置 + 2 个候选） |
| 结果回来先减被拒数 | $2 - 1$ | **-1 个**（已算同样减 1） |
| 再减实际收到 token 数 | $1 + 1$ | **-2 个**（接受的 1 个候选 + 1 个新 token） |
| 合计销账 | $1 + 2$ | **-3 个**（与排步时所加相等） |

在候选数固定、预算足够、请求未触发停止或抢占的这段连续 decode 示例中，每步排 `1 + 候选数` 个位置；实际接受多少仍会变化，占位数和最终输出数不能画等号。真实调度还会受预算、长度上限与状态变化影响。被拒候选写进注意力 KV 的位置不作为有效历史继续使用，后续从修正后的位置覆盖；混合模型的循环状态另有恢复规则，见[投机解码](speculative-decoding.md)。

## 在途的结果怎样收尾：抢占、结构化输出与图回放

计划已经发出去、结果还在路上，这段时间里碰上下面三件事，要单独处理：

- **强制清空前缀缓存时，丢掉在途的结果。** 清空前缀缓存这个操作可以要求先把所有在跑的请求抢占掉（让出 KV 块、退回等待队列）。被抢占的请求还有结果在路上。调度器把它当时的输出占位数记成「待丢弃」的计数、占位清零；之后每回来一份结果就把计数减 1，这份结果直接跳过，不接到请求上。这条丢弃路径只为这种强制抢占而设。请求判停或被中止时，在途的结果怎样丢掉、worker 为什么晚一步才删它，见[请求收尾](request-teardown.md#异步调度下判停的时候下一步已经排好了)。
- **结构化输出要等上一步的 token。** [结构化输出](structured-output.md)（按 JSON schema 等格式约束，每步屏蔽不合法的 token）要根据已生成的 token 算下一步的屏蔽表。上一步的 token 还没回来时，这一步的前向照样提交，采样推迟到上一步的结果处理完再做，见[思考阶段、异步调度与收尾](structured-output.md#思考阶段异步调度与收尾有什么不同)。
- **FULL 图回放有当前流同步点。** [ACL graph](acl-graph.md) 复用已录制的计算图，执行前需协调参数更新与前批回放的先后。本页固定实现只在 FULL、非 EAGLE 草稿且未启用 ENPU（昇腾扩展图优化模式）时，调用 `torch.npu.current_stream().synchronize()`，等待当前流此前提交的工作完成；它不是整个设备的无条件同步，也不检查异步开关。异步调度和输入准备仍可在此前重叠，实际同步耗时取决于到达这一点时的工作进度。

## 换了调度器的特性，要备一个异步版

AsyncScheduler 只在没人指定调度器类时才会被选上。某个特性一旦在配置里填了自己的类，引擎就用它，不会自动套上异步协议。批次队列仍按并发批数上限创建；若新类沿用普通 Scheduler 且没有实现输出占位，连续 decode 可能算出“应算减已算为 0”，需要先收到上一步结果才能继续。这里失去的是相应请求的提前排步，不能推断所有其他请求、PP 批次也完全没有重叠。本页 v0.26 rc 的启动警告专门提醒这种性能风险。

因此自定义调度器必须实现所需的异步占位协议；昇腾的常见做法是备同步、异步两版，再按开关选择。各版本情况不同：

- [Recompute Scheduler](recompute-scheduler.md)：各版本都有同步、异步两版。
- [ShortRequestFirst](short-request-first.md)、[BatchJobAwareScheduler](batch-job-aware-scheduler.md)：本页 v0.26 rc 快照带异步版；main 上的 [DyntraLB](dyntra-lb.md) 也带异步版。
- `SchedulerDynamicBatch`（按服务时延目标动态调预算）在旧版快照中仅提供同步类；`ProfilingChunkScheduler`（先测 prefill 耗时再动态定块长）在早期快照中也由平台直接选择同步类。`v0.30.0` 已增加异步版 `ProfilingChunkAsyncScheduler`，要求同时开启 MRV2（第二代 Model Runner 执行器，`VLLM_USE_V2_MODEL_RUNNER=1`）。当前 `main` 则全面收敛至 MRV2，不能沿用早期纯同步限制（见[版本差异](#版本差异)）。早期 `main` 的[动态分块 PP](dynamic-chunked-pp.md) 教程显式关掉 async scheduling，并说明 P 节点的 prefill 性能考虑。

若调度还依赖草稿的置信预测，异步也会影响“这次决定用了哪一轮信息”。[DSpark 的 CPU/设备分工](dspark.md#cpu-已经排下一步新的置信度还没回来怎么办)把总预算与逐请求长度分开讲，示范怎样记录步号和请求映射；它不是 GLM 占位机制的另一个名称。

## 把一批拆成两半，能否让通信和计算同时进行：DBO

**Dual Batch Overlap（DBO，双批次重叠）把一次前向的输入拆成两个微批，让一份输入等待专家通信时，设备继续计算另一份。** 微批就是原批次中分出来的一部分 token；模型仍要处理全部输入，改变的是执行顺序。它主要针对 [EP](expert-parallel.md) 中把 token 发给不同专家、再把结果汇回的等待。

例如微批 A 已发起 dispatch（将 token 发往持有专家的设备），结果还没收齐，这时可以计算微批 B 已经就绪的 attention 或专家运算。等 A 的数据就绪，再继续 A 的专家计算；combine（把专家结果汇回）期间也可安排另一份已就绪的计算。每份输入自己的依赖仍须满足，不能提前使用尚未收到的数据。

上游所核实现由 model runner 拆输入及 attention 元数据，再由两个 CPU 工作线程轮流提交设备工作。线程到约定位置时让出执行权，通信流与计算流用事件维持依赖；并不是两个线程随时同时改同一份前向状态。录好的整图可以直接回放这套顺序，不必每次重走主机线程切换。未走整图时，源码也保留微批线程执行路径，不能把“DBO 图只录整图”理解成“DBO 一定不能 eager 执行”。

### 为什么每个 DP 组不能自己决定拆不拆？

这些 DP 组还在通过 EP 一起做专家通信，必须对这一步的拆分方式达成一致。固定上游实现先让各组报告是否满足条件，再对齐补齐后的 token 数；任何一组不适合拆，所有组都取消这一步的微批。达到本地门槛也不保证第二微批有真实 token，还要看组间对齐后的切分位置。

用两个 DP 组、普通单 token decode 的示意来看。假设已经开启受支持的 DBO 路径，并且本轮最终对齐长度为 96（中点 48 切分）：

```wiki-diagram
file: async-scheduling-fig-dbo-split
```

| 两组实际 token 数 | 本地都达到 32 的门槛吗 | 按共同边界 96 ÷ 2 = 48 切开 | 这一步是否拆微批 |
|---|---|---|---|
| 64、96 | 是 | 第一组为 48 + 16，第二组为 48 + 48；不足的部分补齐 | 可以，仍须满足其余执行条件 |
| 32、96 | 是，恰好 32 也达到 | 第一组所有真实 token 都在前半，后半没有真实 token | 全组取消微批 |
| 16、96 | 第一组未达到 | 不进入共同拆分 | 全组取消微批 |

因此，“开关为真”“本组够 32 个 token”和“本轮确实按两个微批运行”是三个不同判断。切分按 token 位置，必要时会跨过某条请求的边界，执行器要同步修正那条请求在各微批中的长度和位置；不是一律把请求列表各分一半。

代价包括主机线程协调、额外的切片与元数据、为保持组间一致而补齐输入；较小矩阵的计算效率也要按尺寸重新衡量。要比较藏住的通信时间与这些新增开销：前者不足以抵消后者时，总耗时反而增加。通信本来很短、输入过少或两组负载差得很大时，应重点比较这两笔耗时。它与提前排下一步的 async scheduling、把模型按层分段的 PP 分工不同；是否能组合，要看各自的版本和后端条件。

## 复杂异构实战对照：GLM 双机 R1 占位账与 DBO 边界

以上是通用引擎的异步调度与 DBO 机制：在 `Qwen3-8B` / `Qwen3-30B-A3B` 等 `v0.30.0` 标准单卡或多卡昇腾部署中，**异步调度直接生效**（无投机时每步输出占位恒为 `1`）；而上游 **DBO 在昇腾 `v0.30.0` 平台初始化时仍会被强制重置关闭**（`enable_dbo=False`、`ubatch_size=0`）。下面对照历史 **GLM-5.3-Flash 官方双机**（钉住 `vllm@0fc695fc + vllm-ascend@db701c1f`，部署前提见[部署页](glm-5-3-flash-two-node.md#部署前提)），核对 DBO 边界与带 MTP 3 草稿的 R1 占位账。

### 固定 GLM 双机能直接照官方 DBO 命令开吗？

这里的官方 DBO 设计描述的是上游 GPU 的 DP+EP 路径。所核 Ascend 平台会把这个上游开关重置为关闭，并记录警告，所以不能把加上 DBO 参数当成固定 GLM 获得通信重叠的办法。固定 GLM 的异步调度仍按本页原来的占位协议工作；昇腾的专家通信优化另见 [MC2](expert-parallel.md#mc2-还是-allgather)，它有自己的算子、设备与规模条件。

### 落到 GLM 双机：R1 每一步的占位账

**开着，靠自动判定。** 官方双机命令没写 async scheduling 的开关，因此走自动判定：模型不是 pooling 类，投机方法 MTP（每步草拟 `3` 个候选）在允许名单里，未关掉候选批次补齐，且多进程执行器支持异步。四条全部通过，所以处于开启状态（启动日志里有一行写明开关结果，本部署还缺这份日志）。

**两个 EngineCore 各记各的账。** 在这组 DP2、TP8、PP1 部署条件下，每台机器的一组请求由自己的 EngineCore 调度，使用异步占位协议和最多 2 批的队列。上面列出的专用调度配置没有出现在命令中；若 AsyncScheduler 首次定义在 Scheduler 被替换之后，它继承 BalanceScheduler，均衡关闭时回父类调度；若已经提前导入，后来换名不会改变父类。实际类型要结合目标进程的 MRO（Python 类继承的方法解析顺序，Method Resolution Order）核对，见[补丁系统](ascend-patch-system.md#落到-glm-双机哪些-patch-真的起作用)。一圈里各发什么、收什么，见[两个 EngineCore 各转各的圈](vllm-engine-core.md#落到-glm-双机两个-enginecore-各转各的圈)。

**R1 连续 decode 示例每步排 4 个位置，输出占位每步加 4。** 假设每步 3 个候选齐备、预算足够且请求尚未停止或被抢占，占位增量为 `1 + 3 = 4`。下面跟着 [R1](one-request.md#示例请求-r1-与官方双机部署)（提示词 4 个 token，是教学设定）看账上的数。R1 在 DP0 上；和[第二圈和第三圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)一样，假设第 2 步接受 1 个候选、第 3 步全部接受。

| 时刻 | 已知 | 候选占位 | 输出占位 | 已算 | 这一步排几个 |
|---|---|---|---|---|---|
| 排第 1 步（prefill） | 4 | 0 | 0 → 1 | 0 → 4 | 4 − 0 = 4 |
| 排第 2 步 | 4 | 3 | 1 → 5 | 4 → 8 | 4 + 3 + 1 − 4 = 4 |
| 第 1 步的 y₀ 回来 | 5 | 3 | 4 | 8 | 队列空出一格 |
| 排第 3 步 | 5 | 3 | 4 → 8 | 8 → 12 | 5 + 3 + 4 − 8 = 4 |
| 第 2 步回来：拒 2 个，收 2 个 | 7 | 3 | 4 | 10 | 队列空出一格 |
| 排第 4 步 | 7 | 3 | 4 → 8 | 10 → 14 | 7 + 3 + 4 − 10 = 4 |
| 第 3 步回来：全接受，收 4 个 | 11 | 3 | 4 | 14 | 队列空出一格 |

表里有三处规律。一是每一步排的都是 4 个位置。二是两次结果之间，输出占位稳定在 4，正好是还在卡上算的那一步最多能产出的个数。三是这里的已算总比[一条请求](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)里按同步记的逻辑值多 4：那一页的已算是 4 → 6 → 10，正是这里的 8 − 4、10 − 4、14 − 4，多出来的就是已经排出去、结果还在路上的那一步。候选占位排完第 1 步就换成了 3 个 −1，真的候选一直留在 Worker 那边。

第 2 步有候选被拒（接受 1 个候选、拒 2 个），最能看出 EngineCore 两次减账与 Worker 卡上纠正怎样对齐——下图把两者画在同一条水平时间轴上：

```wiki-diagram
file: async-scheduling-fig-inflight-ledger
```

$$\text{已算}_{\text{new}} = 12 - 2 = 10, \qquad \text{输出占位}_{\text{new}} = 8 - 2 - 2 = 4$$

| 销账分项（R1 第 2 步回来：接受 1 个、拒 2 个） | 算式 | 结果与含义 |
|---|---|---|
| 已算位置回退 | $12 - 2$ | **10 个位置**（被拒的 2 个退回） |
| 输出占位两次减账 | $8 - 2 - 2$ | **4 个**（先减被拒 2 个，再减收到 2 个 token） |
| 算完且回来了的位置 | $10 - 4$ | **6 个**（与同步记法下第 2 步之后一致） |
| 排第 4 步的新增位置 | $7 + 3 + 4 - 10$ | **4 个位置** |

Worker 那边也会在卡上先改一次。第 3 步排出时，第 2 步结果尚未回到 EngineCore，调度器按全接受把位置推到 8–11。Worker 准备输入时，直接用卡上保存的有效数 2（接受 1 个）修正设备已算数，把位置回退 2 格到 6–9（与[第二圈和第三圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)一致，CPU 长度按前述后端条件另行修正）。第 2 步在位置 6、7 写下的注意力 KV 会被后续有效计算原地覆盖。本部署 prefix caching 默认关着（见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)），「算完且回来了的位置」这条线只在显式打开时用于登记缓存。

**多条请求时照样按条记。** 场景 M（DP0 上 12 条 decode 加 1 条 6000 token 的新请求，设定见[示例场景 M](concurrent-requests.md#示例场景-m-与变体-m)）里，12 条 decode 请求每条都照上表记，每步各加 4；新请求一步就算完整段提示词，不算分段，排完记 1 个输出占位。整批一步排多少、怎样补齐到图尺寸、空闲的 DP1 怎样陪跑，只在[多条请求](concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)里推导；async scheduling 不改这些数，只改这些计划什么时候发出去。

**纯 decode 图回放保留同步点。** 在本部署采用 FULL_DECODE_ONLY 且未由运行环境开启 ENPU 的前提下，主模型 FULL 回放前会等待当前流；这不是仅开启异步才新增的动作。等待耗时以及异步开关前后的吞吐、时延差异，都需要设备对照测量；图里的格数不代表本部署加速比。

## 常见误解

- **「async scheduling 要自己打开。」** 不用。开关默认留空，由启动时的检查决定；本部署没写开关，按检查是开的。想关要显式写关。
- **「异步了，下一步的计算就提前开始了。」** 提前的只是 CPU 上的调度和输入准备。第 k+1 步的前向要用第 k 步的 token，卡上仍是算完一步才算下一步；token 的值由 Worker 在卡上补。
- **「异步就是把采样挪到另一条流上做。」** 采样仍在前向之后、同一条主流上做。挪到另一条流上的，只有把结果拷回主机那一次。
- **「输出占位就是这一步会产出的 token 数。」** 带投机解码时，占位按最多能产出的个数记（1 + 候选数），实际产出 1 到 1 + 候选数个；回来后按被拒数和收到数分两次销。
- **「官方特性互斥表里 Async Scheduling 一行没标不兼容，就能和什么都同开。」** 代码里有启动即报错的组合（部分投机方法、关掉候选批次补齐、执行器不支持），还有只备了同步版的昇腾调度器。以代码为准。
- **「支持特性表里找不到 Async Scheduling，说明昇腾没适配。」** 那张表里最接近的一行叫 Async output，互斥表里才叫 Async Scheduling；两者是不是同一件事，文档没写。
- **「开了异步，每条请求都更快。」** 省下的是步与步之间卡的空等；上游在开关的说明里写的是时延和吞吐都能受益，直觉图里同一条请求也从 13 格缩到 11 格。但具体到本部署某条请求的首 token 时延和生成间隔省多少，要开、关各测一次才知道，本部署没有这组数。

## 对照源码

### 怎么开

引擎启动参数的完整入口表、调度器类覆盖关系和预算联动见 [Scheduler 参数参考](vllm-scheduler.md#怎么开)。本节维护异步的自动判定与执行条件。

- 开关是 `SchedulerConfig.async_scheduling`，类型 `bool | None`，默认 `None`；命令行自动生成 `--async-scheduling` / `--no-async-scheduling` 一对。vllm-ascend 不改这个默认值。
- 三种写法在 `VllmConfig.__post_init__` 那段 if/elif 里分开：显式 True 走硬失败分支（见下一节）；None 走自动分支，按代码顺序检查，命中任一条就置 False：runner_type 为 pooling（只打 debug 日志）；有 speculative_config 且 method 既不在 EagleModelTypes 也不在 NgramGPUTypes——固定基线自动分支**不像**显式分支那样放行 draft_model，草稿模型方法在自动分支下会被关掉；disable_padded_drafter_batch=True；执行器的 supports_async_scheduling() 返回 False。都没命中才置 True。最后打一行 info：`Asynchronous scheduling is enabled.` 或 `... disabled.`。
- 选调度器类：SchedulerConfig.get_scheduler_cls() 只在 scheduler_cls is None 时看 async_scheduling，为真返回 AsyncScheduler，否则 Scheduler；scheduler_cls 一旦被填，直接返回那个类，并打「自定义调度器接口不公开」的 warning。
- 最多并发批数 max_concurrent_batches：开了异步时，V1 model runner 在 PP=1 返回 2，V2 model runner 返回 pp_size + 1；其余情况返回 pp_size。EngineCore 在它大于 1 时建 batch_queue，step_fn 指向 step_with_batch_queue，否则是 step。
- 同步时每圈末尾 post_step 调 take_draft_token_ids() 把候选交给调度器；异步时不调，候选留在 Worker，调度器用 _spec_token_placeholders（一串 -1）顶上。
- 本部署：speculative_config.method 为 mtp，在 EagleModelTypes 里；disable_padded_drafter_batch 没开；多进程执行器 MultiprocExecutor.supports_async_scheduling() 返回 True。自动分支置 True，批次队列长度 2。

**上游 DBO 的独立入口。** `--enable-dbo` 默认 false；所核官方部署要求 DP 大于 1、启用 EP，并安装 DeepEP，选择 deepep_low_latency 或 deepep_high_throughput 后端。固定上游配置对其他 All-to-All 后端拒绝微批，并关闭 cascade attention。DBO 默认切成两个微批，不能用引擎批次队列长度代替它。

`--dbo-decode-token-threshold` 默认 32，`--dbo-prefill-token-threshold` 默认 512，两者允许非负整数。实际判断使用当前批次未补齐的 token 数，且是“大于或等于”；不是某个请求的历史长度。选择哪条门槛由 runner 的 uniform_decode 判定决定：各请求本步长度一致且等于该 runner 的 decode 查询长度时走 decode 门槛，其余走另一条。普通单 token decode 对应前面的示意，带投机的批次要看实际查询长度，不能只凭请求阶段名称猜测。

Ascend 上看到 `Parameter is currently ignored on Ascend. parameter=enable_dbo, action: resetting to False.`，表示该开关被平台清掉。显式设置 ubatch_size 也会被重置为 0。运行确认应检查平台处理后的配置和实际执行路径，不能把命令成功解析当成 DBO 已生效。

### 会报什么错

- 显式 `--async-scheduling` 时撞上不兼容项，启动即失败：
  - 投机方法不在该版本的 `EagleModelTypes`、`NgramGPUTypes` 中，也不是 `draft_model`：`ValueError: Currently, async scheduling is only supported with EAGLE/MTP/Draft Model/NGram GPU kind of speculative decoding`。按实际类型表判断；旧版 `EagleModelTypes` 还包含 `extract_hidden_states`、MTP 类型和 `dflash`，报错文案不是完整枚举。
  - `disable_padded_drafter_batch=True`：`ValueError: Async scheduling is not compatible with disable_padded_drafter_batch=True.`
  - 执行器不支持：``ValueError: `<backend>` does not support async scheduling yet.``
- 默认 `None` 走自动分支，不兼容时关闭异步；pooling 分支记 debug，其余列出的禁用分支记 warning。旧版自动分支不放行 `draft_model`，与显式开启的名单不同。
- 投机解码与异步同开：不报错，打 warning `Disabling cascade attention (not yet compatible with async speculative decoding).` 并强制 `disable_cascade_attn = True`。
- 占位账记乱：`AsyncScheduler._update_request_with_output` 里 `assert request.num_output_placeholders >= 0` 会失败。
- vllm-ascend：本页 v0.26 rc 上 ShortRequestFirst 与 `profiling_chunk_config` 直接互斥（`ValueError`）；main 上允许同开，但要求关掉异步，否则 `ValueError: ShortRequestFirst with profiling_chunk_config requires synchronous scheduling. Please disable async scheduling.`
- 自定义调度器可能失去占位带来的重叠：SchedulerDynamicBatch 在 v0.23 维护分支和 db 中，以及 ProfilingChunkScheduler 在本页 db、v0.23、v0.26 rc、main 快照中，都选择普通 Scheduler 的派生类。平台不会仅凭异步开关给它补上 AsyncScheduler 的协议。开关仍为 True 时，执行侧仍可能采用异步输入路径，不能只看开关认定已获得同样重叠。v0.23 日志只提示接口不公开，v0.26 rc 另提醒这类继承可能导致性能下降。rc2 的 profiling 异步类另算，见版本差异；固定 main 的动态分块 PP 教程使用 `--no-async-scheduling`。
- 文档与代码：vllm-ascend 的 `feature_matrix.md` 里 Async Scheduling 一行没有标不兼容，但上面几条硬 `raise` 都在，以代码为准。

### 开销和什么时候别开

- 省下的是每步卡算完后等 CPU 的那一段：结果拷回、更新请求、排下一步、计划跨进程发给 Worker、Worker 在主机侧备输入。步越短占比越大，decode 步最明显。本部署没有这段的耗时数。
- 代价：
  - PP=1 的本页示例多一批在途，`max_concurrent_batches` 从 1 变 2；其他 PP/runner 组合按前述公式；
  - 每条请求多维护输出占位和候选占位；
  - 带投机解码时，Worker 先按全接受准备，再用设备上的有效数修正；需要 CPU 长度的后端还有主机事件等待与修正；
  - 强制清空前缀缓存时，在途结果要逐份丢弃；
  - 结构化输出请求依赖上一步时，采样推迟到上一步的结果处理完；
  - ACL graph FULL 模式回放前多一次 `torch.npu.current_stream().synchronize()`（`enable_enpu` 或 EAGLE 草稿合图时跳过；本部署主模型不跳）。这次同步不看异步开关，关了异步也照做，但代码注释写明它就是为异步下 CPU 跑在卡前面而加的。
- 本页 v0.26 rc 与 main 有 `max_in_flight_tokens = max_concurrent_batches × max_num_batched_tokens`：它为在途 token 给出预算上界，供滑窗、chunked-local 等规格计算容量，不代表每条请求都额外占满这么多 token。
- 什么时候别开：pooling 模型自动分支默认就关，代码注释写明当前实现对它的性能不利；时延敏感的服务，开、关各测一次 TTFT 与 TPOT 再定；用了只写同步版调度器的昇腾特性时，显式写 `--no-async-scheduling`。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）；**本文 GLM 双机绑定算例采用例外 B 专用镜像 `vllm-ascend@db701c1f` + `vllm@0fc695fc`**。主线机制（默认自动判定、输出占位与批次队列循环）在四版保持一致。

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| 上游 `async_scheduling` 判定与占位 | `None` 自动分支不放行 `draft_model`；占位加 `1 + K`；无 `max_in_flight_tokens`；V1 PP=1 并发 2 批、V2 为 `pp_size + 1` | 新增 `max_in_flight_tokens` 与 `dspark`；占位改为 `num_sampled_tokens_per_step + K`；自定义 `Scheduler` 告警提醒失去异步 | `None` 自动分支放行 `draft_model`（`scheduler.py#L190-L220`、`vllm.py#L589-L605`）；并发批数公式延续 | 延续 `pp_size + 1` 并发批数与 `max_in_flight_tokens`（`vllm.py#L616-L635`）；V1 不兼容列表单列集中校验（`#L1799-L1851`），Ascend 端不再受 V1 限制 |
| `profiling_chunk`（CPP）与 MRV2 约束 | 平台无条件选同步 `ProfilingChunkScheduler`（`db701c1f` 同样） | 仍无条件选同步 `ProfilingChunkScheduler`；`ShortRequestFirst` 与 `profiling_chunk_config` 直接互斥 | **`async_scheduling` + `profiling_chunk_config`（CPP）强制要求 MRV2**（`platform.py#L1075-L1085` 校验 `VLLM_USE_V2_MODEL_RUNNER=1`，否则 `ValueError`）；满足时分派 `ProfilingChunkAsyncScheduler`（`#L1386-L1407`）；`patch_use_v2_model_runner.py#L18-L42` 按 env 开关决定 V1/V2 | **删除 MRV1，全仓唯一保留 MRV2**（`mrv2_utils.py#L29-L36`，设 `VLLM_USE_V2_MODEL_RUNNER=0` 直接报错）；CPP 与异步调度默认直接在 MRV2 上组合 |
| 昇腾异步调度器族与 V1 PP 采样传递 | 仅 `RecomputeScheduler` 备异步版；V1 非 PD-P 异步 PP 走继承广播 `_pp_broadcast_prev_sampled_token_ids` | `ShortRequestFirst`、`BatchJobAware` 新增异步版；V1 PP 改为经调度输出 IPC 传递 token | 新增 `DyntraLB` 异步版及 `ProfilingChunkAsyncScheduler`；V1 PP 延续调度输出 IPC；MRV2 独立走 V2 PP 传输 | 移除 V1 路径，所有异步调度器与 PP 传输收敛至 MRV2 体系 |
| Worker 异步拷贝与 DBO 开关 | MRV1 主机写 `-1`、采样值留卡上、异步拷贝流回传；Ascend 将上游 `enable_dbo` 重置 `False`、`ubatch_size` 置 `0` | 延续 MRV1 异步拷贝与 DBO 重置 | MRV1 延续旧异步拷贝；MRV2 接入 `async_tensor_h2d` 异步 H2D 拷贝；`platform.py#L919-L923` 仍将 `enable_dbo` 重置 `False` | **MRV2 全面采用 `vllm.utils.torch_utils.async_tensor_h2d` 异步 H2D 拷贝**（`worker/v2/model_runner.py#L37`、`#L890-L976`，覆盖 `idx_mapping`、`cu_num_logits`、`query_start_loc` 等输入缓冲）；`platform.py#L1083-L1087` 仍重置 `enable_dbo=False` |

上表同时覆盖上游 DBO（`enable_dbo` 默认 `false`、decode/prefill 门槛 `32 / 512` 且实际比较为 `≥`、DP 全组须共同同意拆分且末微批非空，四版上游均一致；Ascend 四版均重置 `enable_dbo=False` 与 `ubatch_size=0`）。文档叫法方面：支持特性表写作 `Async output`（🟢 Functional，备注 CI needed），互斥三角矩阵写作 `Async Scheduling`，须同时对照行、列、图例及上述代码硬检查。

### 源码位置

DBO 的官方设计全文见来源 80；四版默认、实际 ≥ 门槛和全组拆分决策分别见 81–92。Ascend 的五个比较点如何清掉上游开关和微批数见 93–97；不能仅从 GPU 官方参数推断 NPU 生效。uniform_decode 的实际判定见 98，组间补齐与请求切片见 99–100，线程让出与 dispatch 接收回调见 101、106。固定上游后端名单见 102，整图或普通微批执行的分支见 103–105，两个微批的数量来源见 107。64/96、32/96 和 16/96 是按这些条件构造的教学例子，96 是示意中已选定的最终对齐长度，不是默认图尺寸。

| 看什么 | 去哪里 |
|---|---|
| 开关字段、选调度器类 | `vllm@0fc695fc:vllm/config/scheduler.py`，`async_scheduling`、`get_scheduler_cls` |
| 自动判定、硬失败、日志、关 cascade attention、并发批数 | `vllm@0fc695fc:vllm/config/vllm.py`，`__post_init__` 那段 if/elif；`max_concurrent_batches` |
| 两批压着跑的循环、结构化输出推迟采样、同步时取回候选 | `vllm@0fc695fc:vllm/v1/engine/core.py`，`step_with_batch_queue`、`post_step` |
| 输出占位的加、减、丢弃与缓存登记边界 | `vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py` |
| 减法、长度上限跳过、候选排进计划、被拒回退、强制清空 | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py` |
| 卡上补值、按全接受算长度再改正（上游） | `vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py`，`_prepare_input_ids`、`correct_spec_decode_token_counts` |
| 昇腾 Worker 侧 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py`：写 `-1` 与 `prev_sampled_token_ids`、`AsyncGPUModelRunnerOutput`、`_copy_valid_sampled_token_count`、`_correct_optimistic_seq_lens_cpu`、`_copy_draft_token_ids_to_cpu` |
| 图回放前同步 | `vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py` |
| 昇腾挑调度器 | `vllm_ascend/platform.py`；`vllm_ascend/core/recompute_scheduler.py` |

**正文证据索引。** 开关默认留空、自动判定的四个条件与日志 [C2]；指定调度器类后的选择规则、开关说明中的预期收益见 [C1]；PP/runner 条件下的批数上限与队列循环见 [C3][C5]。固定 GLM 参数下自动判定为开，由 MTP 名单、批次补齐和执行器条件推出 [D]，不代替启动日志。

输出占位的加减、强制抢占后的丢弃计数、缓存登记上限见 [C6]；减法与长度上限跳过见 [C7]；候选进入计划见 [C9]；被拒时两项回退见 [C10]；强制清空时的计数转移见 [C11]。13/11 格、忙碌比例和三时刻表按给定时长与规则推导 [D]；R1 采用一条请求页的接受假设，多记的 4 个已算位置来自下一步已提交但结果尚未处理 [D]。

Worker 在卡上把采样值与候选抄进输入见 [C12]；主机占位及设备采样缓存见 [C14]，异步结果对象调用见 [C15]、完成事件与回收实现见来源 43；设备已算数修正见 40、59，CPU 长度消费者与条件见 41–42，CPU 读取前的事件等待见 [C17]。候选回传条件见 [C18]，FULL 当前流同步的谓词见 [C20]。

昇腾平台选择调度类见 [C21]，v0.26 rc/main 的异步类与互斥规则见 [C23][C24]；v0.26 rc 的占位采样数与新警告见 [C26][C28]。普通 Scheduler 若没有占位协议，同一连续 decode 请求需先收结果才有下一步预算，由减法推出 [I]；这不是所有请求都无重叠的结论。官方动态分块 PP 教程示例关异步见 [S31]，兼容矩阵及图例见 [S32]。

旧版 PP 的发送条件与继承实现见来源 19、44–47；v0.26 rc/main 的 V1 PP 输入重建与 IPC 补丁见 48–53，模块安装调用见 74–75；main 调度类选择 helper 见 54，队列创建见 55，上游 main 的批数、占位与自定义调度规则见 56–58。版本表中的 CPU 长度修正、采样结果对象与占位写入逐版见 60–68，图同步条件见 69–71，维护 v0.23 与 v0.26 rc 的重算调度选择见 72–73。

固定旧版的投机方法类型表和批次补齐默认值见来源 76–77；v0.26 rc/main 结果对象的实际拷贝与事件等待见 78–79。

**运行时确认。** 部署时核对启动日志中的异步开关和批次队列长度，并在相同请求负载下比较吞吐、TTFT、TPOT 与同步点耗时。本页没有这组设备测量。普通抢占、取消及判停的在途收尾见[请求收尾](request-teardown.md)；自定义调度器则须核对实际类、占位协议和候选传递，不能用“开关为 True”替代运行验证。
