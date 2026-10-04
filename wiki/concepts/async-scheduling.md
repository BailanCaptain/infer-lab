---
id: async-scheduling
title: Async scheduling：趁卡在算，先把下一步排好
type: feature
summary: 异步调度让 CPU 在 NPU 算这一步时就排好下一步：调度器用输出占位记下还没回来的 token，Worker 在卡上补真值，结果回来再销账。讲清收益与代价、投机解码下先按全接受排再改正、在途结果怎样收尾、换调度器的特性为何要备异步版，以及 GLM 双机上 R1 每一步的占位账。
aliases: ["异步调度","Async Scheduling","async scheduling","AsyncScheduler","num_output_placeholders","async_scheduling","输出占位"]
chapters: ["12"]
order: 20
sources:
  - vllm@0fc695fc:vllm/config/scheduler.py#L146-L188
  - vllm@0fc695fc:vllm/config/vllm.py#L931-L1002
  - vllm@0fc695fc:vllm/config/vllm.py#L497-L507
  - vllm@0fc695fc:vllm/config/vllm.py#L1017-L1027
  - vllm@0fc695fc:vllm/v1/engine/core.py#L484-L598
  - vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L19-L67
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L376-L407
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1005-L1013
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L519-L535
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1414-L1432
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1953-L1971
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1700-L1826
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1462-L1482
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2684-L2710
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2569-L2582
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1608-L1628
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1580-L1598
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1886-L1896
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2526-L2533
  - vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L244-L258
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L702-L714
  - vllm-ascend@db701c1f:vllm_ascend/core/recompute_scheduler.py#L56-L69
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L660-L725
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L966-L984
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1254-L1282
  - vllm@568afb3a:vllm/v1/core/sched/async_scheduler.py#L30-L42
  - vllm@568afb3a:vllm/config/vllm.py#L525-L533
  - vllm@568afb3a:vllm/config/scheduler.py#L190-L198
  - vllm@568afb3a:vllm/config/vllm.py#L1030-L1110
  - vllm@0fc695fc:vllm/v1/engine/core.py#L474-L482
  - vllm-ascend@baa023ad:docs/source/tutorials/features/dynamic_chunked_pipeline_parallel.md#L131-L131
  - vllm-ascend@baa023ad:docs/source/user_guide/support_matrix/feature_matrix.md#L16-L16
  - vllm-ascend@baa023ad:docs/source/user_guide/support_matrix/supported_features.md#L20-L20
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L511-L513
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L712-L726
  - vllm@84030bbe:vllm/config/vllm.py#L1300-L1380
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: vllm-scheduler, kind: builds-on, note: 「应算减已算」这道减法和已算数当场前推在那一页，本页只讲异步多出来的输出占位}
  - {to: npu-model-runner, kind: builds-on, note: Worker 怎样准备输入、采样，本页只讲异步时 token 值留在卡上、结果晚一步拷回}
  - {to: speculative-decoding, kind: builds-on, note: 候选被拒后已算数怎样回退；异步下先按全接受排、回来再改正}
contradicts: []
updated: "2026-09-29"
origin: direct
---

## 卡在算这一步时，CPU 能不能先把下一步排好？

**Async scheduling**（异步调度）是 vLLM 引擎的一种排步方式：NPU 还在算第 k 步，CPU 上的调度器就把第 k+1 步排好、提交下去，不等第 k 步的结果回来。

先看一条请求怎样往前走。大模型的回答是一个 token 接一个 token 生成的，引擎每转一圈叫一**步**（step）。每一步分两半：CPU 上的 [Scheduler](vllm-scheduler.md)（调度器）先定这一步让哪些请求上、各算几个位置；NPU 再按这份计划做一次前向，采出新 token。前向算完，CPU 还有一串杂活：把新 token 收回来接到请求上，看它停没停，再排下一步。

如果这些活一件接一件做，NPU 每算完一步就得停下来，等 CPU 收完、排完。async scheduling 把这段等待挪走：CPU 趁 NPU 在算，先把下一步排好，NPU 一算完，下一步的计划已经在门口。

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

这些活的耗时主要看请求条数，和模型大小关系不大。模型一步前向的长短却差得很远：prefill（把整段提示词一次算完）一步要算成百上千个位置，这点 CPU 时间不显眼；decode（在已有历史上往后生成）一步里每条请求只算 1 个或几个位置，前向很短，CPU 那一段的占比就大了。一条回答有几百步 decode，同步时每步都空等一次。

按图里的示意格数，把步数拉长来看 NPU 有多少时间在干活：

```calc
title: 示意格数下 NPU 忙碌的比例（CPU 一段 1 格，NPU 一步 3 格）
同步 3 步 = 1 + 3 × 3 + 2 × 1 + 1 = 13 格，步与步之间 NPU 各空等 1 格
异步 3 步 = 1 + 3 × 3 + 1 = 11 格
同步 200 步的 NPU 忙碌比例 = 600 ÷ (1 + 600 + 199 + 1) = 600 ÷ 801 ≈ 75%
异步 200 步的 NPU 忙碌比例 = 600 ÷ (1 + 600 + 1) = 600 ÷ 602 ≈ 99.7%
```

这个算法有个前提：CPU 一段活不比 NPU 一步长。要是 CPU 一段要 4 格、NPU 一步只要 3 格，异步之后每步的节奏由 CPU 定，NPU 仍会等，只是比同步等得少。格数只说明原理，不是任何部署的实测。

代价都来自同一件事：计划发出去的时候，上一步的结果还没回来。

- **多压一批在途。** 引擎同时最多压着 2 批：一批在卡上算，一批已经排好。批次队列怎样建、为什么队列满了才等最老的一批，见 [EngineCore 的批次队列](vllm-engine-core.md#批次队列下一圈的调度和这一圈的计算叠起来)。
- **记账变复杂。** 调度器要给还没回来的 token 记占位，结果回来再销掉；带[投机解码](speculative-decoding.md)（先草拟几个候选 token，下一步由主模型一次验证）时，还要先按「候选全被接受」排，回来再改正。下面三节讲这些。
- **有些活还是得等上一步。** 三种情况会让重叠少一点：结构化输出（按 JSON 等格式约束输出）要看上一步的 token 才能算这一步的约束；强制清空前缀缓存（丢掉留着复用的 KV 块）时，路上的结果要逐份丢掉；图模式（把一次前向录下来、之后每步重放）回放前要先同步一次。详见[在途的结果怎样收尾](#在途的结果怎样收尾抢占结构化输出与图回放)。

几个名字常被混在一起，它们重叠的东西不同：

| 名字 | 重叠的是什么 |
|---|---|
| async scheduling | 下一步在 CPU 上的调度，和这一步在 NPU 上的计算 |
| 批次队列 | 本身不是重叠，是让引擎同时压着几批的容器；async scheduling 和 PP 都靠它 |
| 结果的异步拷贝 | 把采样结果拷回主机，和卡上接下来的计算；开着 async scheduling 时 Worker 才这样拷 |
| [PP](pipeline-parallel.md)（流水线并行） | 模型按层分成几段放在不同的卡上，各段同时算不同的批 |

## 结果还没回来，下一步怎么排：先记输出占位

调度器给一条请求排几个位置，用的是[同一道减法](vllm-scheduler.md#调度器怎样排一步还差几个--截断--借块--记账)：应算减已算。「已算」在排完一步时就当场往前推，不等卡上真算完，这样下一步能接着往后排。

麻烦出在 decode 请求上。取一组示意数：一条请求已知 8 个 token；第 k 步已经排出去、还在卡上算，排完那一刻已算记成 8，前 8 个位置都算进去了。第 k 步要采出的第 9 个 token 还在卡上，调度器这边的已知仍是 8。这时排第 k+1 步：

```calc
title: 排下一步时这条请求还差几个位置（示意数，不带投机解码）
不记占位 = 已知 8 − 已算 8 = 0 个，这条请求会被当成这一步没活
记 1 个输出占位 = 已知 8 + 输出占位 1 − 已算 8 = 1 个，和同步时每步 1 个一样
```

AsyncScheduler（上游专门用于异步的调度器）的办法，是在请求上多记一个数，叫**输出占位**：每排完一步，就给会产出 token 的请求记上「这一步会产出 1 个，只是还没回来」。减法多加这一项，结果就和同步时一样。这里的 1 只是**个数**，不说明是词表里的哪个 token；调度器排计划用不着值，值由 Worker 在卡上补，见下一节。

结果回来时，按实际收到的个数把占位销掉。连着看三个时刻，占位在 1 和 2 之间来回：

| 时刻 | 已知 | 输出占位 | 已算 | 接下来 |
|---|---|---|---|---|
| 排第 k+1 步之前（第 k 步在卡上） | 8 | 1 | 8 | 还差 8 + 1 − 8 = 1，排 1 个位置 |
| 排完第 k+1 步 | 8 | 2 | 9 | 两步在途，队列满，等第 k 步的结果 |
| 第 k 步的 token 回来 | 9 | 1 | 9 | 还差 9 + 1 − 9 = 1，接着排第 k+2 步 |

占位还管着三件收尾的事：

- **只登记算完、回来了的位置。** 开着 [prefix caching](prefix-caching.md)（前缀缓存：把算过的开头部分的 KV 块留给后来的请求复用）时，结果回来后只把「已算 − 输出占位」个位置登记进缓存。上表第三行是 9 − 1 = 8：第 9 个位置已经排进第 k+1 步，它的 KV 还在卡上算，先不登记。
- **分段算的提示词先不记。** 被 [chunked prefill](chunked-prefill.md)（分块预填充：长提示词分几步算完）切开的提示词，前几段不产出 token，不记占位；最后一段算完才产出第一个 token，这时记 1 个。
- **快到长度上限时不多排。** 请求自带一个最多生成多少 token 的上限。异步下排下一步时，在途的那一步也许已经把长度用满了；只要能确定「就算候选全被拒，在途那一步回来后也到上限了」，调度器就跳过这条请求，不再多排一步。

## 真 token 怎样到卡上：Worker 在卡上补值

计划里只有个数，第 k+1 步的输入却要真 token。这件事交给 Worker 进程里的 model runner（按计划准备输入、跑前向和采样的那段代码），它让 token 的值根本不用经过 CPU：

- **主机侧只写 −1。** Worker 在主机内存里也存着每条请求的 token 表。异步时，新 token 那一格先写 −1 占着。
- **真值留在卡上。** 采出的 token 在卡上留一份。准备第 k+1 步的输入时，卡上直接把它抄进输入的那一格，CPU 从头到尾不用知道它是几号。
- **候选也留在卡上。** 带[投机解码](speculative-decoding.md)（先草拟几个候选 token，下一步由主模型一次验证）时，草拟出的候选同样在卡上抄进输入。只有请求用到结构化输出、或采样参数要看已生成的 token 时，候选才拷回主机。
- **结果照样回到 CPU，只是晚一步。** 采样结果由另一条专门的拷贝流拷回主机内存，拷完记一个完成事件。EngineCore 在下一圈等这一步的结果时读它，接到请求上、发回前端。异步改的是「什么时候等」，没有省掉这条回程。

把两个进程在一圈里各做什么画成流程：

```wiki-diagram
file: async-scheduling-flow
```

左边是 EngineCore 进程，跑的是上游 vLLM 的代码，昇腾没有改；右边是 Worker 进程，由昇腾的 [NPUModelRunner](npu-model-runner.md) 做上面几件事。看图时顺着左列往下走一圈：① 排计划、② 记账、③ 提交后，只要批次队列没满就直接回到 ①，不等结果；队列满了才在 ④ 等最老的一批，⑤ 销账，⑥ 把 token 发回前端。右列 ⑧ 算完的采样值分两路：一路留在卡上给下一步的 ⑦，一路拷回主机，下一圈由 ④ 收下。

昇腾这边另有两处和异步有关：用 PP 时，NPUModelRunner 让最后一段直接把采样结果发给其他段，不绕 EngineCore；ACL graph（昇腾的计算图录制与回放）在 FULL 模式下回放前要先等卡上的上一步做完，原因见[在途的结果怎样收尾](#在途的结果怎样收尾抢占结构化输出与图回放)。

## 带投机解码时：先按候选全被接受排，回来再改

投机解码让一步验证好几个候选，接受几个事先不知道。异步下排第 k+1 步时，第 k 步接受了几个还没回来，所以调度器和 Worker 都先按「候选全被接受」算，结果回来再改：

- **调度器这边。** 排一步，输出占位加「1 + 候选数」，因为这一步最多产出这么多 token；调度器手里的候选列表也换成候选数个 −1 占位，排下一步时照常把它们排进计划。结果回来，先按被拒的个数把已算和输出占位各减一次，再按实际收到的 token 数把输出占位减一次。
- **Worker 这边。** 准备第 k+1 步时，先假定第 k 步的候选全被接受，算出每条请求的长度和位置；再用第 k 步拷回来的「有效 token 数」改正。这份数在第 k 步末尾就开始单独拷，到用的时候一般已经拷完，不会多等。

用示意数（每步 2 个候选，这一步接受了 1 个）走一遍一步的占位怎样加、怎样销：

```calc
title: 一步的输出占位怎样记、怎样销（示意：每步 2 个候选，接受 1 个）
排这一步时加 = 1 + 2 = 3 个，1 个确定位置加 2 个候选
结果回来先减被拒的 = 2 − 1 = 1 个，已算同样减 1
再减实际收到的 = 1 + 1 = 2 个，接受的 1 个候选加 1 个新 token
合计减 = 1 + 2 = 3 个，和排的时候加的相等
```

所以每一步排给这条请求的位置数是固定的（1 + 候选数），产出的 token 数却在 1 到 1 + 候选数之间变：占位数和最终输出数不能画等号。被拒候选写进 KV 的那几格不用专门清，Worker 改正位置后从回退处接着写，把它们盖掉，见[投机解码](speculative-decoding.md)。

## 在途的结果怎样收尾：抢占、结构化输出与图回放

计划已经发出去、结果还在路上，这段时间里碰上下面三件事，要单独处理：

- **强制清空前缀缓存时，丢掉在途的结果。** 清空前缀缓存这个操作可以要求先把所有在跑的请求抢占掉（让出 KV 块、退回等待队列）。被抢占的请求还有结果在路上。调度器把它当时的输出占位数记成「待丢弃」的计数、占位清零；之后每回来一份结果就把计数减 1，这份结果直接跳过，不接到请求上。这条丢弃路径只为这种强制抢占而设。请求判停或被中止时，在途的结果怎样丢掉、worker 为什么晚一步才删它，见[请求收尾](request-teardown.md#异步调度下判停的时候下一步已经排好了)。
- **结构化输出要等上一步的 token。** [结构化输出](structured-output.md)（按 JSON schema 等格式约束，每步屏蔽不合法的 token）要根据已生成的 token 算下一步的屏蔽表。上一步的 token 还没回来时，这一步的前向照样提交，采样推迟到上一步的结果处理完再做，见[思考阶段、异步调度与收尾](structured-output.md#思考阶段异步调度与收尾有什么不同)。
- **图回放前先同步。** [ACL graph](acl-graph.md) 把一次前向录成图，之后每步重放，只更新注意力参数等少数输入。异步下 CPU 跑在卡前面，会赶在上一步的图还没放完时就去改下一步要用的参数。所以 FULL 模式回放前，昇腾先等卡上当前的工作全部做完，再发起重放、更新这一步的参数；图里的计算等参数更新好了才开始跑。调度和大部分输入准备在这次等待之前已经做完，重叠还在；代价是每步多一个同步点。

## 换了调度器的特性，要备一个异步版

AsyncScheduler 只在没人指定调度器类时才会被选上。某个特性一旦在配置里填了自己的调度器类，引擎就原样用它，不会自动套上异步的那一层。这时批次队列照样建（它只看异步开关），可如果这个类只继承了普通的 Scheduler，就没人记输出占位：排下一步时这条请求的差是 0，要等上一步的结果回来才排得上，重叠就没了。v0.26 起上游在启动日志里专门提醒这件事。

所以换调度器的特性要备两版，按异步开关挑一版装上。昇腾的几个调度特性，各版本备齐的情况不同：

- [Recompute Scheduler](recompute-scheduler.md)：各版本都有同步、异步两版。
- [ShortRequestFirst](short-request-first.md)、[BatchJobAwareScheduler](batch-job-aware-scheduler.md)：v0.26 才有这两个特性，一出现就带着异步版；main 上新增的 [DyntraLB](dyntra-lb.md) 也带异步版。
- SchedulerDynamicBatch（按服务的时延目标动态调每步预算，v0.26 起已移除）和 ProfilingChunkScheduler（先测 prefill 耗时，再定长提示词每段切多长）：只有同步版，开关一开平台就直接换上，不看异步开关。官方的[动态分块 PP](dynamic-chunked-pp.md) 教程在启动命令里显式关掉了 async scheduling。

## 落到 GLM 双机：R1 每一步的占位账

部署前提见[部署页](glm-5-3-flash-two-node.md#部署前提)。落到 async scheduling 上是这几件事。

**开着，靠自动判定。** 官方双机命令没写 async scheduling 的开关，走自动判定：模型不是 pooling 类；投机方法是 MTP（GLM 自带的多 token 预测层，每步草拟 3 个候选），在允许的名单里；没有关掉候选批次的补齐；多进程执行器支持异步。四条都过，所以是开的。启动日志里有一行写明开没开，本部署还缺这份日志。

**两个 EngineCore 各记各的账。** 两台机器各是一个 DP 组，各有一个 EngineCore、一个 AsyncScheduler、一条最多 2 批的批次队列。上面讲的昇腾调度特性本部署一个都没开；按导入顺序推断，AsyncScheduler 继承的是昇腾换上的 BalanceScheduler，它的闸门默认关，每步仍走上游逻辑，见[昇腾上跑的是哪个调度器](vllm-scheduler.md#昇腾上跑的是哪个调度器)。一圈里各发什么、收什么，见[两个 EngineCore 各转各的圈](vllm-engine-core.md#落到-glm-双机两个-enginecore-各转各的圈)。

**每条 decode 请求每步排 4 个位置，输出占位每步加 4。** MTP 每步 3 个候选，排一步输出占位加 1 + 3 = 4。下面跟着 [R1](one-request.md#示例请求-r1-与官方双机部署)（主线的示例请求，提示词 4 个 token，是为演示取的设定）看调度器账上的数。R1 在 DP0 上；和[第二圈和第三圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)一样，假设第 2 步接受 1 个候选、第 3 步全部接受。

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

第 2 步有候选被拒，最能看出两次减账：

```calc
title: R1 第 2 步的结果回来时怎样销账（接受 1 个候选、拒 2 个）
已算 = 12 − 2 = 10 个位置，被拒的 2 个退回
输出占位 = 8 − 2 − 2 = 4 个，先减被拒的 2 个，再减收到的 2 个 token
算完且回来了的位置 = 10 − 4 = 6 个，与同步记法下第 2 步之后的已算一致
排第 4 步 = 7 + 3 + 4 − 10 = 4 个位置
```

Worker 那边也要改一次。第 3 步是在第 2 步的结果回来之前排的，调度器按候选全接受，把它排在位置 8–11。Worker 准备第 3 步时同样先按全接受算，再用第 2 步拷回的有效 token 数 2（接受 1 个）改正 3 − 1 = 2 格，实际算的是位置 6–9，和[第二圈和第三圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)里第 3 步的位置一致；第 2 步在位置 6、7 上写下的被拒候选的 KV，就在这时被盖掉。本部署 prefix caching 默认关着（见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)），「算完且回来了的位置」这条线只在显式打开时用于登记缓存。

**多条请求时照样按条记。** 场景 M（DP0 上 12 条 decode 加 1 条 6000 token 的新请求，设定见[示例场景 M](concurrent-requests.md#示例场景-m-与变体-m)）里，12 条 decode 请求每条都照上表记，每步各加 4；新请求一步就算完整段提示词，不算分段，排完记 1 个输出占位。整批一步排多少、怎样补齐到图尺寸、空闲的 DP1 怎样陪跑，只在[多条请求](concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)里推导；async scheduling 不改这些数，只改这些计划什么时候发出去。

**纯 decode 步回放图前多一次同步。** 本部署纯 decode 步走 FULL_DECODE_ONLY 图（只在纯 decode 步录图、回放），两个 DP 组每步回放前都要先等卡上的上一步做完（上一节第三条）。这次等待占多少时间、开和关 async scheduling 时吞吐与时延差多少，本部署都没有实测数；图里的格数只说明原理，不能当成本部署的加速比。

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

- 开关是 `SchedulerConfig.async_scheduling`，类型 `bool | None`，默认 `None`；命令行自动生成 `--async-scheduling` / `--no-async-scheduling` 一对。vllm-ascend 不改这个默认值。
- 三种写法在 `VllmConfig.__post_init__` 那段 if/elif 里分开：显式 `True` 走硬失败分支（见下一节）；`None` 走自动分支，按代码顺序检查，命中任一条就置 `False`：`runner_type == "pooling"`（只打 debug 日志）；有 `speculative_config` 且 `method` 既不在 `EagleModelTypes` 也不在 `NgramGPUTypes`——自动分支**不像**显式分支那样放行 `draft_model`，草稿模型方法在自动分支下会被关掉；`disable_padded_drafter_batch=True`；执行器的 `supports_async_scheduling()` 返回 `False`。都没命中才置 `True`。最后打一行 info：`Asynchronous scheduling is enabled.` 或 `... disabled.`。
- 选调度器类：`SchedulerConfig.get_scheduler_cls()` 只在 `scheduler_cls is None` 时看 `async_scheduling`，为真返回 `AsyncScheduler`，否则 `Scheduler`；`scheduler_cls` 一旦被填，直接返回那个类，并打「自定义调度器接口不公开」的 warning。
- 最多并发批数 `max_concurrent_batches`：开了异步时，V1 model runner 在 PP=1 返回 2，V2 model runner 返回 `pp_size + 1`；其余情况返回 `pp_size`。`EngineCore` 在它大于 1 时建 `batch_queue`，`step_fn` 指向 `step_with_batch_queue`，否则是 `step`。
- 同步时每圈末尾 `post_step` 调 `take_draft_token_ids()` 把候选交给调度器；异步时不调，候选留在 Worker，调度器用 `_spec_token_placeholders`（一串 `-1`）顶上。
- 本部署：`speculative_config.method = "mtp"`，在 `EagleModelTypes` 里；`disable_padded_drafter_batch` 没开；多进程执行器 `MultiprocExecutor.supports_async_scheduling()` 返回 `True`。自动分支置 `True`，批次队列长度 2。

### 会报什么错

- 显式 `--async-scheduling` 时撞上不兼容项，启动即失败：
  - 投机方法不是 EAGLE / MTP / 草稿模型 / NGram GPU 之一：`ValueError: Currently, async scheduling is only supported with EAGLE/MTP/Draft Model/NGram GPU kind of speculative decoding`
  - `disable_padded_drafter_batch=True`：`ValueError: Async scheduling is not compatible with disable_padded_drafter_batch=True.`
  - 执行器不支持：``ValueError: `<backend>` does not support async scheduling yet.``
- 默认 `None` 撞上同样的条件，不报错，只打一行 warning 并关掉异步。
- 投机解码与异步同开：不报错，打 warning `Disabling cascade attention (not yet compatible with async speculative decoding).` 并强制 `disable_cascade_attn = True`。
- 占位账记乱：`AsyncScheduler._update_request_with_output` 里 `assert request.num_output_placeholders >= 0` 会失败。
- vllm-ascend：v0.26 上 ShortRequestFirst 与 `profiling_chunk_config` 直接互斥（`ValueError`）；main 上允许同开，但要求关掉异步，否则 `ValueError: ShortRequestFirst with profiling_chunk_config requires synchronous scheduling. Please disable async scheduling.`
- 静默失效（不报错）：`SchedulerDynamicBatch`（v0.23 维护分支、`db701c1f`）和 `ProfilingChunkScheduler`（各版本）都直接继承 `Scheduler`，对应开关一开，平台层就无条件改写 `scheduler_cls`。这时 `async_scheduling` 仍为 `True`，`batch_queue` 照建、model runner 照写 `-1`，但调度器不是 `AsyncScheduler`，不记输出占位。v0.23 只打「接口不公开」那句 warning；v0.26 起多一句：继承 `Scheduler` 而不是 `AsyncScheduler`，会因异步调度失效而性能下降。官方 main 的动态分块 PP 教程启动命令写了 `--no-async-scheduling`。
- 文档与代码：vllm-ascend 的 `feature_matrix.md` 里 Async Scheduling 一行没有标不兼容，但上面几条硬 `raise` 都在，以代码为准。

### 开销和什么时候别开

- 省下的是每步卡算完后等 CPU 的那一段：结果拷回、更新请求、排下一步、计划跨进程发给 Worker、Worker 在主机侧备输入。步越短占比越大，decode 步最明显。本部署没有这段的耗时数。
- 代价：
  - 多一批在途，`max_concurrent_batches` 从 1 变 2；
  - 每条请求多维护输出占位和候选占位；
  - 带投机解码时，Worker 要先按全接受算长度，再用 `valid_sampled_token_count` 改正；
  - 强制清空前缀缓存时，在途结果要逐份丢弃；
  - 结构化输出请求依赖上一步时，采样推迟到上一步的结果处理完；
  - ACL graph FULL 模式回放前多一次 `torch.npu.current_stream().synchronize()`（`enable_enpu` 或 EAGLE 草稿合图时跳过；本部署主模型不跳）。这次同步不看异步开关，关了异步也照做，但代码注释写明它就是为异步下 CPU 跑在卡前面而加的。
- v0.26 起新增 `max_in_flight_tokens = max_concurrent_batches × max_num_batched_tokens`：滑窗、chunked-local 这类按已处理 token 回收块的 KV 规格，要为在途的批多留这些位置。
- 什么时候别开：pooling 模型自动分支默认就关，代码注释写明当前实现对它的性能不利；时延敏感的服务，开、关各测一次 TTFT 与 TPOT 再定；用了只写同步版调度器的昇腾特性时，显式写 `--no-async-scheduling`。

### 版本差异

主线行为——默认自动判定、输出占位、带批次队列的那条循环——在三个版本上一致。机制在上游，按配套的 vLLM 快照分；接线在昇腾，按 vllm-ascend 的快照分。正文的 EngineCore 与调度器一侧引的是上游 v0.23，Worker 一侧引的是含 GLM 代码的 `db701c1f`；本部署实际装的是哪一对，按[来源基线](../sources/glm-5-3-flash-baseline.md)核对。

**上游 vLLM**（v0.23 = `vllm@0fc695fc`，v0.26 = `vllm@568afb3a`，main = `vllm@84030bbe`）：

| 项 | v0.23 | v0.26 | main | 意味着什么 |
|---|---|---|---|---|
| 显式开的硬失败项 | 投机方法不在名单、关掉候选批次补齐、执行器不支持 | 多一条 ROCm DeepEP 高吞吐 DBO；`dspark` 进投机名单（自动分支同样处理这两项） | 同 v0.26 | 昇腾碰不到 ROCm 那条；能多开一种投机方法 |
| 每步加多少输出占位 | `1 + 候选数` | `num_sampled_tokens_per_step + 候选数` | 同 v0.26 | 给没有 bonus token 的扩散式模型留口子，自回归模型上两者相等 |
| 在途 token 的块预留 | 无 | 新增 `max_in_flight_tokens` | 同 v0.26 | 滑窗类 KV 规格多留一份 |
| 自定义 `scheduler_cls` 的 warning | 只说接口不公开 | 多一句：继承 `Scheduler` 而不是 `AsyncScheduler` 会失去异步 | 同 v0.26 | 同一段自定义调度器，v0.23 上不提醒 |
| `max_concurrent_batches` | V1 且 PP=1 为 2，V2 为 `pp_size + 1` | 同 v0.23 | 同 v0.23 | 批次队列长度不变 |

**vllm-ascend**（v0.23 = 维护分支 `2c59ff10`，不含 GLM 代码；`db701c1f` = 含 GLM 代码的快照；v0.26 = `2ed6cbba`；main = `baa023ad`）：

| 项 | v0.23 维护分支 | db701c1f | v0.26 | main |
|---|---|---|---|---|
| 平台层按异步开关挑调度器 | 只有 `RecomputeSchedulerConfig` 自己挑 `AsyncRecomputeScheduler` | 同 v0.23 | ShortRequestFirst、BatchJobAware 各多一个 Async 版 | 抽成 `_get_recompute_scheduler_cls`、`_get_dyntra_lb_scheduler_cls`，DyntraLB 也有 Async 版 |
| 只有同步版、平台无条件换上的调度器 | `SchedulerDynamicBatch`、`ProfilingChunkScheduler` | 同 v0.23 | `ProfilingChunkScheduler` | `ProfilingChunkScheduler` |
| ShortRequestFirst + profiling chunk | 没有 ShortRequestFirst | 没有 ShortRequestFirst | 直接 `ValueError` 互斥 | 允许，但必须关异步 |
| Worker 侧（主机写 `-1`、采样值留卡上、异步拷回、按全接受算长度再改正、FULL 图回放前同步） | 有 | 有 | 有 | 有 |
| PP 下采样值直发其他段 | `_pp_broadcast_prev_sampled_token_ids` | 同 v0.23 | 换了实现，旧函数名不再出现 | 同 v0.26 |

- 文档叫法：vllm-ascend main 的支持特性表里最接近的是 `Async output`（🟢 Functional，备注 CI needed），特性互斥表里写的才是 `Async Scheduling`。

### 源码位置

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

**正文证据归档。** 开关默认留空、自动判定的四个条件与日志 [C2]；指定了调度器类就原样使用，开关说明里写明异步让时延和吞吐都受益 [C1]；最多 2 批在途与带队列的循环 [C3][C5]。本部署按自动判定为开，由 MTP 在允许名单、执行器支持异步推出 [D]。

输出占位的加减、强制抢占后的丢弃计数、只登记「已算 − 输出占位」个位置 [C6]；减法与长度上限处的跳过 [C7]；候选占位照常排进计划 [C9]；被拒时已算与输出占位各减一次 [C10]；强制清空前缀缓存时占位转成丢弃计数 [C11]。示意格数 13 与 11、忙碌比例、8 + 1 − 8 与三时刻表，都由上述规则推出 [D]；R1 的逐圈账沿用一条请求页的接受假设推出 [D]，与底稿按同步记的逻辑值相差在途一步的 4 [D]。

Worker 在卡上把采样值与候选抄进输入 [C12]；昇腾主机侧写 `-1`、采样值留在卡上 [C14]，结果经单独的拷贝流拷回 [C15]；先按全接受算长度，再用拷回的有效数改正 [C17]；候选只在结构化输出或需要已生成 token 时拷回 [C18]；FULL 图回放前同步 [C20]。

昇腾平台层换调度器 [C21]，v0.26 与 main 的 Async 版和互斥规则 [C23][C24]；v0.26 起占位按每步采样数记、自定义调度器的新 warning [C26][C28]。只继承 `Scheduler` 的类会失去重叠，由减法推出 [I]。官方动态分块 PP 教程显式关异步 [S31]；互斥表里 Async Scheduling 一行 [S32]。

**待核。**

- 本部署的启动日志：`Asynchronous scheduling is enabled.` 一行与批次队列长度 2。
- 本部署开、关 async scheduling 的吞吐、首 token 时延、生成间隔对照；每步 CPU 一段的耗时；FULL 图回放前同步的耗时。
- 普通抢占（KV 块不够时）与取消路径下，在途结果怎样处理：本页只核了强制清空前缀缓存这一条。
- 只继承 `Scheduler` 的调度器在异步开着、又带投机解码时，候选还能不能排进计划：异步时 EngineCore 不取回候选，普通调度器也不填候选占位，按代码推断排不进，没有实跑。
- v0.26、main 上 PP 下采样值直发的新实现。
