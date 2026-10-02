---
id: vllm-scheduler
title: "Scheduler：每一步给哪些请求算几个 token"
type: concept
summary: Scheduler 在 EngineCore 每步开头只看每条请求还差几个位置，在 token 预算、请求数上限和KV 块之内先续 running、再用余量接 waiting，借不到块就抢占或停止接纳，在调度器里不分 prefill 和 decode（worker 侧仍有分路）；GLM 双机上每个 DP 组一步最多 8192 个 token、32 条请求，纯 decode 步只用 128 个。
aliases: [调度器, Scheduler, schedule, token budget, token 预算, token 名额, 名额, 调度一步, max_num_batched_tokens, max_num_seqs, num_computed_tokens, num_scheduled_tokens, num_tokens_with_spec, long_prefill_token_threshold, waiting, running]
chapters: ["12"]
order: 10
sources:
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L351
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L359-L362
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L376-L416
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L445-L516
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L563-L568
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L679-L691
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L761-L778
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L872-L874
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L997-L1003
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L263
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L103-L109
  - vllm@0fc695fc:vllm/config/scheduler.py#L42-L90
  - vllm@0fc695fc:vllm/config/scheduler.py#L224-L246
  - vllm@0fc695fc:vllm/config/scheduler.py#L140-L144
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2305-L2335
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2370-L2392
  - vllm@0fc695fc:vllm/config/model.py#L1805-L1810
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L354-L368
  - vllm@0fc695fc:vllm/model_executor/models/config.py#L371-L374
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L275-L281
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L84-L88
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L718-L718
  - vllm-ascend@db701c1f:vllm_ascend/envs.py#L103-L105
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L680-L715
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L9-L57
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L426-L437
  - vllm@84030bbe:vllm/engine/arg_utils.py#L2709-L2735
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L225-L237
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L936-L936
  - vllm@0fc695fc:vllm/config/scheduler.py#L168-L176
  - vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L6-L12
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L355-L475
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L506-L600
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L557-L557
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - { to: vllm-engine-core, kind: builds-on, note: 调度器是 EngineCore 每一步开头做的第一件事；谁在什么时候调它，写在那一页 }
  - { to: concurrent-requests, kind: builds-on, note: 场景 M 的整批账（一步 6048 个 token、20,000 token 提示词分三步）在那一页；本页给规则和结论 }
  - { to: kv-cache, kind: builds-on, note: 请求能不能推进，还要看有没有空闲 KV 块存下它的历史 }
contradicts: []
updated: "2026-09-29"
origin: seed
---

## 一步要算哪些请求、各算几个 token，谁来定？

**Scheduler（调度器）是 EngineCore 每一步开头运行的一段逻辑：它看每条请求还差几个位置没算，在这一步的 token 预算、请求数上限和空闲 KV 块之内，决定给哪些请求各算几个 token、各借哪些块，写成一份计划交给 worker 去执行。** 这里的「一步」是模型对一批请求做的一次前向；EngineCore 是在 CPU 上管理一组请求的引擎进程，它每转一圈调一次调度器，见[引擎循环](vllm-engine-core.md)。「位置」是 token 在请求序列里的序号：提示词有 4 个 token，就占位置 0–3。

调度器不区分 prefill（把整段提示词算完）和 decode（逐个生成新 token）两个阶段。它对每条请求只记两个数：**应该算到第几个位置**（提示词、已生成的 token、待验证的候选 token 加在一起；候选 token 来自 speculative decoding，即投机解码：先猜几个 token，下一步由模型一起验证），和**已经算到第几个位置**。两者之差就是这条请求还差的工作量，每一步尽量把差补上。刚到的请求差整段提示词，它这一步做的就是人们说的 prefill；正在生成的请求只差上一步刚出的那 1 个 token，这一步就是 decode。两种请求因此可以排进同一步。「不分阶段」只在调度器里成立：计划交到 worker 以后，部分层仍按 prefill 和 decode 走不同的路，比如 GLM 的 KDA 层（线性注意力，每条请求只存一份固定大小的状态）prefill 分段算、decode 逐位置递推，见[线性注意力](linear-attention.md#prefill-用-chunked-计算decode-逐位置推进)。本部署还只有纯 decode 步才走 graph mode（图模式：把一步的算子序列录下来，之后整段回放），混进 prefill 的一步不走。

```wiki-diagram
file: token-budget
```

图里 A、B 已经在跑，各差 1 个位置；C、D 刚到，整段提示词都没算。调度器先给 running（已经排上、正在推进的请求）续上各自差的位置，再把剩余预算给 waiting（已经到达、还没排上的请求）：C 拿到全部余量，只算提示词的前一段，余下的留到下一步；预算用完，D 这一步排不上。每排一条请求，还要保证本步要写的位置有 KV 块可用。KV 块是显存里预先切好的一格格存储，存每个位置算出的历史，后面的 token 要读它；一块能装很多个位置，请求手里的块写满了才借新块，图里的格子只表示块借给了谁。块借不到时，running 一侧会抢占别的请求，waiting 一侧就等下一步。

预算数的是这一步要算的位置个数，不是请求条数；一步最多排几条请求，是另一道上限。

## 为什么按 token 设预算，还要另设请求数上限？

一条请求一步往往只差 1 个位置，单独为它算一步很亏。每一步都有一部分开销不随 token 数变。最大的一笔是读权重：每张卡约 20.58 GiB 权重（见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)），其中 17.72 GiB（86%）是路由专家。attention、稠密层和共享专家的那部分每步都要从显存完整读一遍；路由专家只读本步有 token 路由到的那些，读多少随这一步的路由变化。此外，模型的 45 层要依次跑一遍，每层的集合通信都要发起（次数见[一次前向的通信账](one-request.md#一次前向的通信账)），算子要下发到 NPU；走 graph mode 的步，下发换成回放一次录好的图。只为 1 个 token 付这笔开销，硬件大部分时间在等数据从显存读进来。所以调度器要把多条请求凑进同一步。它每一步都重新挑一批：一条请求结束，下一步就能补进新的，不必等整批一起结束。这种做法叫 continuous batching（连续批处理）。

凑批时只按请求条数设上限不够，因为不同请求一步的工作量差得太远。GLM 双机上，一条 decode 请求一步算 4 个位置：1 个确定的 token，加 3 个 MTP 候选（MTP 是 GLM 自带的多 token 预测层，每步先草拟 3 个候选，下一步由主模型一起验证）；[场景 M](concurrent-requests.md#示例场景-m-与变体-m) 里新来的一条请求，一步要算 6000 个提示词位置，是前者的 1500 倍。只数条数，管不住一步的计算量和激活显存。所以调度器同时守两道上限，外加 KV 块这一项资源。GLM 双机的两台机器各是一个 DP 组（data parallel 的执行组，各自独立排请求），下表的数是每组各一份：

| 约束 | 管的是什么 | GLM 双机（每个 DP 组） |
|---|---|---|
| token 预算 | 一步最多算多少个位置，决定这一步的计算量和激活大小 | 8192 |
| 请求数上限 | running 里最多同时有几条请求，决定批的宽度 | 32 |
| 空闲 KV 块 | 这一步要写的位置有没有地方存 | 看块池余量，见[块分配](vllm-kv-block-allocation.md) |

代价有三处。第一，先续 running、后接 waiting 的顺序保护了正在生成的请求，高负载时新请求要多排一会儿。第二，预算封住了一步的大小，长提示词超过余量就要分几步算完，这条请求拿到第一个输出 token 会更晚；换来的是 running 里的请求每步照常推进，不会被一条长提示词整段卡住。第三，KV 块不够时要抢占，被抢占的请求已算的位置全部作废，之后从头重算。

## 调度器怎样排一步：还差几个 → 截断 → 借块 → 记账

每一步从预算上限开始。调度器先按顺序扫 running 队列，再扫 waiting 队列；扫到的每条请求都过同样四关：

1. **还差几个位置。** 应算减已算。running 里的请求把待验证的候选 token 也算进「应算」，开了 async scheduling（异步调度：不等上一步结果回来就先排下一步）时还要加上结果的占位数；waiting 里的请求是它现有的全部 token 减去已算：新请求就是整段提示词，被抢占退回来的请求还包括它已经生成的部分。
2. **截断。** 先按单条请求一步的上限截（默认不设），再按剩余预算截；running 里的请求还要保证位置不超过单请求最大长度。截完是 0 就跳过这条。
3. **借块。** 按「已算 + 本步要算 + 为下一步候选预留的位置」，求这条请求每个缓存组还差几块，加起来和空闲块数比，够才一次全部借出。缓存组是存储格式和借块规则相同的一组层，各组各算各的块数；GLM 分 5 组，怎么编的见 [KV cache 规格](kv-cache-spec.md)。
4. **记账。** 从预算里扣掉本步安排的数。整步排完后，不等 worker 算完，调度器就把每条请求的已算数往前推，下一步从新位置接着排。

```wiki-diagram
file: vllm-scheduler-flow
```

waiting 里的请求要进来，还得满足三个条件：这一步没有发生过抢占，引擎没有暂停，running 还没满上限。关掉 [chunked prefill](chunked-prefill.md)（分块预填充：长提示词分几步算完）时，一条新请求差的位置比剩余预算多，调度器不会切开它，而是直接停止接纳 waiting，排在它后面的请求也一起等。第 3 关对 waiting 更严：默认先检查这条请求全部 token 的块放不放得下，而不只看这一步这一段，免得接纳之后下一段借不到块、再被抢占。

running 里的请求借不到块时，调度器按先来先服务，从 running 队尾取一条抢占：这条请求的块全部还回池子，已算数清零，候选清空，退回 waiting 队首；然后再试一次借块。被抢的正是当前这条时，running 这一轮扫描到此为止。这一步只要抢占过，就不再接纳 waiting。所以「先续 running」不等于「running 永远不被阻塞」：块不够时，最晚排进来的那条会被整条退回去。抢占和请求结束都会把块全部还回池子，两者差在哪，见[请求收尾](request-teardown.md#抢占不是收尾块还了请求还在)。

最终安排量可能小于还差的量，因为它被预算、单条上限或长度上限截过。预算里的数也不是字数，也不是这一步产出的 token 数：长提示词分几步算时，前几步不产出返回给用户的 token；开了 speculative decoding 时，一步验证多个候选，可能一次确认好几个 token。余下的预算不必填满，没有合适的请求时，一步可以远低于上限。

## 放到 GLM 双机：一个 DP 组里的 R1

部署前提见[部署页](glm-5-3-flash-two-node.md#部署前提)。两台机器是两个 DP 组，各跑一个 EngineCore，**各有一个调度器**，各有一份 8192 的 token 预算、一个 32 条的请求数上限和一个 KV 块池；请求先被分到某一组，之后只由那一组的调度器排，见[第 1 站 入口](one-request.md#第-1-站-入口从-http-到-node0-的引擎)。这两个上限是官方配方在启动命令里显式给的，作用见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)；不给时昇腾上会落到多少，见页末[怎么开](#怎么开)。

[R1](one-request.md#示例请求-r1-与官方双机部署) 是主线的示例请求，提示词为 4 个 token（教学设定）。它在调度器眼里走过的几步，是同一道减法的不同结果：

- **第一步。** R1 在 waiting 里，应算 4、已算 0，差 4 个，预算 8192 足够，给 4 个。借块时还要为下一步 MTP 的 3 个候选预留位置（这 3 个预留叫 lookahead），一共留 7 个位置，借到 15 个块号，逐组算式见[一条请求第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)。prefix caching（前缀缓存：开头相同的请求复用已经算好的 KV cache）在本部署默认关着，查命中直接返回空，这 4 个 token 一定要算，原因见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)。
- **之后每一步（decode）。** R1 的「应算」里多了上一步确定的 1 个 token 和 MTP 草拟的 3 个候选，已算数恰好落后 4 个，于是每步给 4 个。验证后被拒的候选会让已算数回退几格，下一步的差仍是 4。三圈的逐项账见[第二圈和第三圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)。

调度器交给本组 8 个 worker 的计划，对每条请求主要是三样：本步几个 token（R1 第一步是 4）、本步新借的块号（按缓存组分开）、要验证的候选 token（第一步为空）；新排进来的请求还附带它的提示词和采样参数。它不决定用哪个算子、走不走 graph mode：worker 按收到的 token 数自己判断，规则见[图尺寸补齐](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)。这份计划怎样变成每张卡上的输入张量、位置和槽位，见[输入准备](prepare-inputs-flow.md)。

本部署没有显式设置 async scheduling，按默认条件推断是开的：MTP 与多进程执行器都满足打开条件，缺启动日志确认。开着时调度器不等上一步的结果回来就先排下一步，用占位数先把还没回来的 1 个 token 和 3 个候选记上，见 [async scheduling](async-scheduling.md)。时间上前后两步交错，但每步排给 R1 的仍是 4 个 token。

## 多条请求时：预算先给 decode，余量给提示词

一个 DP 组跑满 32 条 decode 请求时，每条 4 个，一步共 128 个 token（见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)），只用掉预算的一小部分：

```calc
title: 纯 decode 步最多用掉多少预算
占一步预算 = 128 ÷ 8192 ≈ 1.6%
```

所以纯 decode 步先碰到的是 32 条的上限，不是预算；128 也正是本部署最大的图捕获尺寸。预算在新提示词进来时才起作用：running 先按每条 4 个扣，剩下的全给新请求的提示词。[场景 M](concurrent-requests.md#示例场景-m-与变体-m) 里 DP0 有 12 条 decode，新来的 6000 个提示词一步装得下，这一步合计 6048 个 token、13 条请求；逐项账见[第 2 站 调度](concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)。

由此得出切分门槛：新提示词比「8192 − 4 × running 条数」长，才需要分几步算。新请求能进来时 running 最多 31 条，门槛最低是 8068；running 已满 32 条时，新请求这一步根本进不来。把场景 M 的新请求换成 20,000 个 token，它要分三步算完提示词：前两步把预算用满，第 3 步算完最后一段才得到第一个输出 token，见[分几步算](concurrent-requests.md#提示词超过剩余预算时分几步算)。单条请求一步的上限本部署没设，保持默认的不截断；若启动命令另设了它，这些门槛要按它重算。

调度器切提示词时不看 KV 块的边界。一个逻辑块是 640 个位置，8192 不是它的整数倍，两者本来就管不同的事：预算管一步算多少，块管历史存在哪。KDA 层（线性注意力，每条请求只存一份固定大小的状态）的缓存模式，在 prefix caching 关着时是「不按块留档」，调度器不需要把每段提示词切在 KDA 状态的块边界上；昇腾为按块对齐模式准备的切分补丁，在本部署不生效。开了 prefix caching 会怎样变，见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)。

块不够时的抢占，在本部署很贵：prefix caching 关着，被抢占的请求没有前缀可复用，提示词和已生成的部分都要从头重算，KDA 状态也要重建。32 条请求各走到多长时开始抢占、被抢的一条还回多少块，见[池子不够时](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)和[多条请求的 KV 块](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)。

## 昇腾上跑的是哪个调度器

vllm-ascend 的平台补丁在启动时，把上游的 Scheduler 类整体换成自己的 BalanceScheduler。它多了一道闸门：按各执行组 running 的条数，决定这一步还接不接纳新请求。这道闸门默认关着；关着时，BalanceScheduler 每一步直接调用上游的调度逻辑，所以本页讲的规则就是本部署实际在跑的规则。开着 async scheduling 时，引擎建的是上游的 AsyncScheduler；它在平台补丁之后才被导入，按导入顺序推断，它继承的正是替换后的 BalanceScheduler，每一步仍落到同一套上游调度逻辑，这一点没有实跑确认。闸门打开后的行为见 [Balance Scheduling](balance-scheduling.md)。

镜像里另有几种调度器变体，各有自己的开关，本部署一个都没开，它们对本部署的效果也没有实测数：

- [Recompute Scheduler](recompute-scheduler.md)：只能在 PD 分离（prefill 和 decode 分到不同节点）的 decode 节点上开；在本部署这种混合部署里打开，启动时直接报错。
- SchedulerDynamicBatch：按 SLO（服务给出的时延目标）动态调整每一步的 token 预算，开关默认不开。
- ProfilingChunkScheduler：启动时先测 prefill 的耗时，再据此决定长提示词每段切多长，开关默认关。

## 常见误解

- **「prefill 和 decode 是两条代码路径」**——在调度器里不是。上游在调度函数开头的注释里明确否定了这个说法；两者是同一道减法的不同结果，也能排进同一步。到了 worker 一侧就不同了：GLM 的 KDA 层仍为 prefill 和 decode 走不同分支（prefill 分段算，decode 与候选验证逐位置递推），稀疏 MLA 层则对一步里的全部 token 走同一条路、不分 prefill 和 decode；本部署还只有纯 decode 步才回放图，混进 prefill 的一步整步不走图。
- **「一步 8192 个 token，就是一步最多 8192 条请求」**——预算数的是位置，不是请求。本部署一步最多 32 条请求，纯 decode 时只用掉 128 个位置。
- **「8192 是整套部署一步的总量」**——是每个 DP 组各自的量。两组各有一个调度器、一份预算和一个块池。
- **「chunked prefill 要手动开」**——不用。生成式模型默认就开着，本部署也开着。要当心的是反过来：手动关掉后，长提示词不是被切开，而是排不进这一步，还挡住后面的新请求。
- **「先排 running，所以正在生成的请求永远不会被卡住」**——块不够时，running 队尾的请求会被抢占，退回 waiting 从头重算。
- **「预算没用满就是浪费，应该塞满」**——余下的预算不必填满。纯 decode 时本来就只用掉很小一部分，这时限制批大小的是请求数上限和 KV 块。
- **「调度器决定用哪个算子、走不走图」**——不决定。它只交出每条请求算几个 token、借了哪些块、验证哪些候选，新请求再附上提示词和采样参数；走不走图由 worker 按 token 数判断。
- **「调大预算或请求数上限，吞吐一定上去」**——不一定。预算调大，启动时按它试跑量出的激活峰值更高，留给 KV cache 的显存变少，混进长提示词的那一步也更大；请求数上限调大，同时在跑的请求受块池容量限制，块不够时只会带来更多抢占。

## 对照源码

### 怎么开

调度器没有总开关，每一步都在跑。能调的是下面几项；行为按 vLLM `0fc695fc`，昇腾侧按 GLM 镜像 `db701c1f`：

- **一步的 token 预算**：`--max-num-batched-tokens`。`schedule()` 每步开头把 `token_budget` 设成 `self.max_num_scheduled_tokens`，它没单独设时等于 `max_num_batched_tokens`；引擎处于 `PAUSED_ALL` 时直接置 0，这一步什么也不排 [C2]。
- **请求数上限**：`--max-num-seqs`，调度器里叫 `max_num_running_reqs`；waiting 循环第一句就是 `if len(self.running) == self.max_num_running_reqs: break` [C12]。
- **不显式给时的默认值**：字段兜底是 `DEFAULT_MAX_NUM_BATCHED_TOKENS = 2048`、`DEFAULT_MAX_NUM_SEQS = 128`；真正生效的由 `EngineArgs` 查表：`get_device_total_memory() >= 70 GiB` 且设备名不含 `a100` 时，`LLM` 类 16384、API server 8192，`max_num_seqs` 都是 1024；否则 `LLM` 类 8192、API server 2048，`max_num_seqs` 都是 256；查询抛异常时显存按 0 算 [C16]。昇腾的 `NPUPlatform.get_device_total_memory` 直接 `raise NotImplementedError`，注释说实现它会过早初始化 torch_npu [C21]。所以在昇腾上 `vllm serve` 不给这两个参数时，是 2048 个 token、256 条 [D]，与卡上实际有多少显存无关；不实现这个接口的理由见 [NPUPlatform](npu-platform.md)。这说明硬件插件能间接改掉调度器的默认值，上游留给硬件插件的其他接口也可能这样波及别处，见 [Platform 接口](vllm-platform-interface.md)。官方双机配方显式给了 8192 和 32，不受这张表影响。
- **两道减法**：running 一侧是 `num_tokens_with_spec + num_output_placeholders - num_computed_tokens`，再依次被 `long_prefill_token_threshold`、`token_budget`、`max_model_len - 1 - num_computed_tokens` 截 [C3]；waiting 一侧是 `request.num_tokens - num_computed_tokens`，先截阈值，`enable_chunked_prefill` 关着且大于剩余预算就 `break`，否则 `min(num_new_tokens, token_budget)` [C6]。代入 R1：首步 `min(4, 8192) = 4`，decode 步 `(5 + 3) − 4 = 4` [D]。
- **单条上限**：`--long-prefill-token-threshold`，大于 0 才生效，字段默认 0；只有 `max_num_partial_prefills > 1` 时，`__post_init__` 才把它自动设成 `max_model_len` 的 4% [C14]。本部署两者都没设。
- **Chunked prefill**：字段兜底 `True`，真正的默认由 `_set_default_chunked_prefill_and_prefix_caching_args` 取 `model_config.is_chunked_prefill_supported`，生成式模型只有 encoder-decoder 返回 False [C17]。
- **整段放得下才接纳**：`scheduler_reserve_full_isl` 默认 True，waiting 侧调 `allocate_slots(..., full_sequence_must_fit=True)`，先按 `min(request.num_tokens, max_model_len)` 求各组块数，比空闲块多就返回 None [C19]。running 侧的 `allocate_slots` 不带这个参数。
- **调度策略**：`--scheduling-policy`，默认 `fcfs`，借不到块时抢占 `self.running.pop()`；`priority` 时抢占优先级最低、到达最晚的那条，并把它本步已拿的预算退回 `token_budget`。
- **KDA 对齐切分**：`need_mamba_block_aligned_split` 只在有 mamba 层且 `mamba_cache_mode == "align"` 时为真 [C11]；本部署 prefix caching 关着，`mamba_cache_mode = "none"`，不切 [D]。昇腾为 align 模式准备的 `patch_glm5_next_mamba_scheduler` 因此不生效。
- **昇腾换掉调度器类**：`vllm_ascend/patch/platform/__init__.py` 无条件 `import patch_balance_schedule`，文件末尾 `vllm.v1.core.sched.scheduler.Scheduler = BalanceScheduler` [C23]；开关读 additional config 的 `enable_balance_scheduling`，没有时读环境变量 `VLLM_ASCEND_BALANCE_SCHEDULING`，默认 `"0"`；关着时 `schedule()` 直接 `return super().schedule()` [C22]。
- **其他变体的开关**：`recompute_scheduler_enable`、`SLO_limits_for_dynamic_batch`（默认 -1）、`profiling_chunk_config.enabled`（默认 False），都在 `NPUPlatform.check_and_update_config` 里改写 `scheduler_cls` 或调度配置。

### 会报什么错

- 函数末尾 `assert total_num_scheduled_tokens <= self.max_num_scheduled_tokens` 和 `assert token_budget >= 0`：预算透支直接断言失败，正常路径不会触发 [C8]。
- 生成式模型手动关 chunked prefill，打一条 warning：`This model does not officially support disabling chunked prefill. Disabling this manually may cause the engine to crash or produce incorrect outputs.`
- 关 chunked prefill 后，新请求差的比剩余预算多，waiting 循环直接 `break`，不报错，只是这一步不排。
- 混合模型落到 align 模式而 chunked prefill 关着，启动断言失败：`Chunked prefill is required for mamba cache mode 'align'.` [C20]
- 抢占不报错：`_preempt_request` 释放 KV 块和 encoder 缓存，状态改成 `PREEMPTED`，`num_computed_tokens = 0`，清空候选，`num_preemptions += 1`，再 `waiting.prepend_request` [C9]。抢占频繁时看这个计数和 `PREEMPTED` 事件。
- 昇腾上在非 `kv_consumer` 节点开 `recompute_scheduler_enable`：`kv_producer` 节点打 warning 并忽略，其余（包括本部署这种混合部署）抛 `ValueError`，提示只能在 PD 分离的 D 节点开 [C25]。

### 开销和什么时候别开

- 先扫 running、后扫 waiting 的顺序保护已开始生成的请求，代价是高负载时新请求排队更久 [D]。
- 别关 chunked prefill：关掉后，一条比剩余预算长的新请求堵在 waiting 队头，这一步后面的新请求也被 `break` 挡住；GLM 这类生成式模型还会收到上面那条 warning。
- `long_prefill_token_threshold` 设小，长提示词每步少占预算，别的新请求能同一步进来，代价是这条长提示词要多分几步、首个输出 token 更晚 [D]。
- `max_num_batched_tokens` 调大：启动试跑按它量激活峰值，留给 KV cache 的块变少，见[显存量测](kv-cache-memory-profiling.md#试跑两次先按-128-个-token再按-8192-个)；混进提示词的那一步更大，这一步里 decode 请求的时延也更长。
- `max_num_seqs` 调大：本部署 32 × 4 = 128 恰好是最大的图捕获尺寸，超过 32 条的纯 decode 步没有对应的图，要连捕获尺寸一起改；每条请求常驻 15–16 块状态，条数越多，块池越早用完、越早抢占 [D]。

### 版本差异

钉点：v0.23 为 vLLM `0fc695fc` + Ascend `2c59ff10`（维护分支，没有 GLM 代码）；**本页 GLM 行为按专用镜像 Ascend `db701c1f`**，它配的也是 vLLM `0fc695fc`；v0.26 为 vLLM `568afb3a` + Ascend `2ed6cbba`；main 为 vLLM `84030bbe` + Ascend `baa023ad`。

| 项 | v0.23 | v0.26 | main |
|---|---|---|---|
| 「没有 prefill、decode 阶段」的注释，先 running 后 waiting，两道减法 | 有 | 同，注释移到第 428 行 [C27] | 同，注释在第 566 行 |
| 单条上限默认 0、chunked prefill 默认开、整段放得下才接纳 | 有 | 同 | 同 |
| 不显式给参数时的默认表 | ≥70 GiB 且非 A100：serve 8192、1024 条；否则 2048、256 条 | 同 | 新增 ≥160 GiB 一档，`LLM` 类和 serve 都是 16384、1024 条 [C28] |
| 昇腾报不报显存 | 2c59ff10、db701c1f 都抛 `NotImplementedError`，落小档 | 同 | torch_npu 初始化后返回实际显存，初始化前仍抛异常；查默认表发生在初始化前，仍落小档 [C29] |
| BalanceScheduler 替换上游类 | 无条件替换，开关默认关，关时直接回落上游 | 同样无条件替换，写法改成 `_sched_mod.Scheduler = BalanceScheduler` [C30]；关时仍回落上游，但混合模型会临时把 `has_mamba_layers` 置假，让上游走全组的 prefix caching 命中查找 | 同 v0.26 写法；开关挪进 Ascend 配置的 `scheduler_config`，默认 False；关时直接回落 |
| 其他调度器变体 | recompute、dynamic batch、profiling chunk 三种；没有 short-request-first | 没有 dynamic batch；新增 short-request-first | 同 v0.26，short-request-first 是独立的调度器文件 |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 「没有阶段」的注释、预算初值 | `vllm/v1/core/sched/scheduler.py` 的 `schedule()` 开头 |
| running 一侧的减法、借块与抢占 | 同文件，第一个 `while` |
| waiting 一侧的准入条件、减法、chunked prefill 开关、借不到就停 | 同文件，第二个 `while` |
| 已算数当场前移 | 同文件 `_update_after_schedule` |
| 抢占 | 同文件 `_preempt_request` |
| KDA 按块对齐切分 | 同文件 `_mamba_block_aligned_split`；开关在 `__init__` 的 `need_mamba_block_aligned_split` |
| 默认预算表 | `vllm/engine/arg_utils.py`；字段兜底与阈值自动设置在 `vllm/config/scheduler.py` |
| 整段放得下才接纳 | `vllm/v1/core/kv_cache_manager.py` 的 `allocate_slots` |
| 昇腾不报显存 | `vllm_ascend/platform.py` 的 `get_device_total_memory` |
| 昇腾换掉调度器类 | `vllm_ascend/patch/platform/__init__.py`、`patch_balance_schedule.py` |
| 开 async scheduling 时建哪个类 | `vllm/config/scheduler.py` 的 `get_scheduler_cls`：`scheduler_cls` 为空且 `async_scheduling` 为真时懒导入 `AsyncScheduler`；`vllm/v1/core/sched/async_scheduler.py` 里 `class AsyncScheduler(Scheduler)` 的父类取自导入那一刻的 `scheduler.Scheduler` |
| 调度器之外，prefill 和 decode 仍分路的地方 | GLM 的 KDA 层：`vllm_ascend/ops/kimi_kda.py` 先把投机 token 与非投机 token 分开，投机部分走 `_run_recurrent`（逐位置递推），非投机部分有 prefill 时走 `_run_prefill`（分段）；稀疏 MLA 层走 `indexer_kpool_mla_v1.py` 的 `AscendIndexerKPoolMLAImpl` → 父类 `AscendSFAImpl.forward`，本部署下一步里的全部 token 同一条路，不按 prefill、decode 分支 |
| 昇腾调度器变体的开关 | `vllm_ascend/platform.py` 的 `check_and_update_config`；配置默认值在 `vllm_ascend/ascend_config.py` |

**待核。**

1. async scheduling 是否真的开着：按自动判定条件推断为开，缺启动日志里 `Asynchronous scheduling is ...` 那一行确认 [!]。
2. 预算 8192 与逻辑块 640 不整除（8192 = 12 × 640 + 512），是否有 kernel 路径要求一步的 token 数对齐到块，未核 [!]。
