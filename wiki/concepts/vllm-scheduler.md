---
id: vllm-scheduler
title: Scheduler：每一步给哪些请求算几个 token
type: concept
summary: >-
  Scheduler 在 EngineCore 每步开头只看每条请求还差几个位置，在 token 预算、请求数上限和KV 块之内先续
  running、再用余量接 waiting，借不到块就抢占或停止接纳，在调度器里不分 prefill 和 decode（worker 侧仍有分路）；GLM
  双机上每个 DP 组一步最多 8192 个 token、32 条请求，纯 decode 步只用 128 个。
aliases:
  - 调度器
  - Scheduler
  - schedule
  - token budget
  - token 预算
  - token 名额
  - 名额
  - 调度一步
  - max_num_batched_tokens
  - max-num-batched-tokens
  - max_num_seqs
  - max-num-seqs
  - enable_chunked_prefill
  - enable-chunked-prefill
  - max_num_partial_prefills
  - max-num-partial-prefills
  - max_long_partial_prefills
  - max-long-partial-prefills
  - scheduler_cls
  - scheduler-cls
  - scheduler_reserve_full_isl
  - scheduler-reserve-full-isl
  - scheduling_policy
  - scheduling-policy
  - num_computed_tokens
  - num_scheduled_tokens
  - num_tokens_with_spec
  - long_prefill_token_threshold
  - long-prefill-token-threshold
  - waiting
  - running
  - prefill_schedule_interval
  - prefill-schedule-interval
chapters:
  - '12'
order: 10
sources:
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L351'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L359-L362'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L376-L416'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L445-L516'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L563-L568'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L679-L733'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L761-L778'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L872-L874'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L997-L1003'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L263'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L103-L109'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L42-L90'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L224-L246'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L140-L144'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2305-L2335'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2370-L2392'
  - 'vllm@0fc695fc:vllm/config/model.py#L1805-L1810'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L354-L368'
  - 'vllm@0fc695fc:vllm/model_executor/models/config.py#L371-L374'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L275-L281'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L84-L88
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L718-L718
  - 'vllm-ascend@db701c1f:vllm_ascend/envs.py#L103-L105'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L680-L715'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L9-L57
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L426-L437'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L2709-L2735'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L225-L237'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L936-L936
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L168-L176'
  - 'vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L6-L12'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L355-L475'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L506-L659'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L557-L557'
  - >-
    raw:sha256-38af36d411736054fb629b1d478b30d72eca081e299a63fd8e66839045b8f6fb.md#L1-L857
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/core/sched/scheduler.py#L104-L109
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/core/sched/scheduler.py#L472-L478
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/core/sched/scheduler.py#L768-L770
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/core/kv_cache_manager.py#L354-L418
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/config/scheduler.py#L140-L144
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L42-L188'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L223-L308'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1363-L1417'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2259-L2267'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2480-L2569'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L927-L1002'
  - 'vllm@568afb3a:vllm/config/scheduler.py#L42-L198'
  - 'vllm@568afb3a:vllm/config/scheduler.py#L254-L321'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L2403-L2411'
  - 'vllm@568afb3a:vllm/config/vllm.py#L1020-L1111'
  - 'vllm@84030bbe:vllm/config/scheduler.py#L42-L233'
  - 'vllm@84030bbe:vllm/config/scheduler.py#L273-L331'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L1570-L1632'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L2883-L2972'
  - 'vllm@84030bbe:vllm/config/vllm.py#L1290-L1381'
  - 'vllm@568afb3a:vllm/v1/core/kv_cache_manager.py#L402-L427'
  - 'vllm@84030bbe:vllm/v1/core/kv_cache_manager.py#L479-L504'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L729-L757'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L42-L103'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_manager.py#L499-L524'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L116-L233'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L273-L331'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2701-L2760'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2904-L2993'
  - 'vllm@ced6857a:vllm/config/vllm.py#L1396-L1487'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L232-L244'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L123-L178'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_balance_schedule.py#L82-L100'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_balance_schedule.py#L145-L166'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_balance_schedule.py#L158-L166'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1377-L1399'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L1471-L1483'
  - 'vllm@568afb3a:vllm/engine/arg_utils.py#L2191-L2201'
  - 'vllm@568afb3a:vllm/v1/engine/core.py#L571-L588'
  - 'vllm@568afb3a:vllm/v1/engine/core.py#L638-L649'
  - 'vllm@568afb3a:vllm/v1/engine/core.py#L2015-L2023'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L463-L499'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L826-L837'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L1058-L1063'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L1628-L1642'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2437-L2449'
  - 'vllm@84030bbe:vllm/engine/arg_utils.py#L2418-L2430'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L2013-L2020'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L2171-L2179'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L604-L644'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1025-L1039'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1293-L1298'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L557-L580'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L800-L861'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1650-L1766'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1980-L2031'
  - 'vllm@84030bbe:vllm/v1/engine/core.py#L2171-L2179'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L604-L645'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L1021-L1034'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L1288-L1298'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L579-L584'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L656-L668'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L802-L810'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L581-L586'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L658-L670'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L799-L807'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L954-L982'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1254-L1279'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1041-L1076'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L561-L595'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1477-L1510'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_balance_schedule.py#L880-L899'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1395-L1415'
  - 'vllm@ba15685a:vllm/v1/core/sched/scheduler.py#L721-L760'
  - 'vllm@ba15685a:vllm/config/scheduler.py#L90-L115'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_balance_schedule.py#L910-L928'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1240-L1320'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1585-L1630'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: vllm-engine-core
    kind: builds-on
    note: 调度器是 EngineCore 每一步开头做的第一件事；谁在什么时候调它，写在那一页
  - to: concurrent-requests
    kind: builds-on
    note: 场景 M 的整批账（一步 6048 个 token、20000 token 提示词分三步）在那一页；本页给规则和结论
  - to: kv-cache
    kind: builds-on
    note: 请求能不能推进，还要看有没有空闲 KV 块存下它的历史
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-38af36d411736054fb629b1d478b30d72eca081e299a63fd8e66839045b8f6fb.md
  - >-
    raw/sha256-6b43f1dfe0cea2d4bfb372bac99ee60cc28b9a3c5e26ad46cfc900ef07a0cbba.md
---

## 一步要算哪些请求、各算几个 token，谁来定？

**Scheduler（调度器）是 EngineCore 每一步开头运行的一段逻辑：它看每条请求还差几个位置没算，在这一步的 token 预算、请求数上限和空闲 KV 块之内，决定给哪些请求各算几个 token、各借哪些块，写成一份计划交给 worker 去执行。** 这里的「一步」是模型对一批请求做的一次前向；EngineCore 是在 CPU 上管理一组请求的引擎进程，它每转一圈调一次调度器，见[引擎循环](vllm-engine-core.md)。「位置」是 token 在请求序列里的序号：提示词有 4 个 token，就占位置 0–3。

调度器用位置进度统一安排 prefill（处理提示词、可分多轮完成）和 decode（继续生成新 token）。它对每条请求记两个数：**应该算到第几个位置**（提示词、已生成的 token、待验证的候选 token 加在一起；候选 token 来自 speculative decoding，即投机解码：先猜几个 token，下一步由模型一起验证），和**已经算到第几个位置**。两者之差就是还差的工作量，每一步在预算内尽量补上。新请求尚未处理的提示词属于 prefill；普通逐 token 生成只差上一步刚出的那 1 个输入位置。两种请求因此可以排进同一步。计划交到 worker 以后，部分层仍按执行形态走不同路径，比如 GLM 的 KDA 层 prefill 分段算、decode 逐位置递推，见[线性注意力](linear-attention.md#prefill-用-chunked-计算decode-逐位置推进)。本部署还只有符合纯 decode 条件的步才走 graph mode（图模式：把一步的算子序列录下来，之后整段回放），混进 prefill 的一步不走。

这样安排要付出等待和重算的代价：先续已经在跑的请求，新请求可能多等；长提示词拆成几步后，第一个输出也会更晚；KV 块不足时，还可能收回某条请求的状态，之后重新补算。预算保护了单步的大小，却不能保证每条请求每一步都有进展。

```wiki-diagram
file: token-budget
```

图里 A、B 已经在跑，各差 1 个位置；C、D 刚到，整段提示词都没算。调度器先给 running（已经排上、正在推进的请求）续上各自差的位置，再把剩余预算给 waiting（已经到达、还没排上的请求）：C 拿到全部余量，只算提示词的前一段，余下的留到下一步；预算用完，D 这一步排不上。每排一条请求，还要保证本步要写的位置有 KV 块可用。KV 块是显存里预先切好的一格格存储，存每个位置算出的历史，后面的 token 要读它；一块能装很多个位置，请求手里的块写满了才借新块，图里的格子只表示块借给了谁。块借不到时，running 一侧会抢占别的请求，waiting 一侧就等下一步。

图中的预算是 20 个位置：A、B 各拿 1 个，剩下 18 个给 C；C 还有 9 个没算，下一步继续。这里用的是不带投机解码的示意请求，块格只表示借用关系，不代表一个 token 对应一块。预算数的是这一步要算的位置个数，不是请求条数；一步最多排几条请求，是另一道上限。

## 为什么按 token 设预算，还要另设请求数上限？

一条请求一步往往只差 1 个位置，单独为它算一步时，调用和权重读取等成本由很少的输入承担。[每卡主要语言权重子账](glm-5-3-flash-two-node.md#每张卡上放了什么)按 3121f187 配方约为 20.58 GiB，其中 17.72 GiB（约占这份子账 86%）是路由专家；视觉塔、MTP 旋转矩阵和量化辅助张量等另计。这是驻留容量的估算，不是每步 HBM 流量。attention、稠密层和共享专家参与本轮计算，路由专家则按实际选中情况参与；各自真实读量还受缓存和内核分块影响。此外，模型的 45 层要依次执行，每层的集合通信都要发起（次数见[一次前向的通信账](one-request.md#一次前向的通信账)），算子要下发到 NPU；走 graph mode 的步则回放录好的图。并批能增加权重复用机会、摊薄部分固定开销，具体瓶颈须实测。调度器每一步重新挑一批：一条请求结束，下一步就能补进新的，不必等整批一起结束。这种做法叫 continuous batching（连续批处理）。

凑批时只按请求条数设上限不够，因为不同请求一步的工作量差得太远。GLM 双机上，一条 decode 请求一步算 4 个位置：1 个确定的 token，加 3 个 MTP 候选（MTP 是 GLM 自带的多 token 预测层，每步先草拟 3 个候选，下一步由主模型一起验证）；[场景 M](concurrent-requests.md#示例场景-m-与变体-m) 里新来的一条请求，一步要算 6000 个提示词位置，是前者的 1500 倍。只数条数，管不住一步的计算量和激活显存。所以调度器同时守两道上限，外加 KV 块这一项资源。GLM 双机的两台机器各是一个 DP 组（data parallel 的执行组，各自独立排请求），下表的数是每组各一份：

| 约束 | 管的是什么 | GLM 双机（每个 DP 组） |
|---|---|---|
| token 预算 | 一步最多算多少个位置，决定这一步的计算量和激活大小 | 8192 |
| 请求数上限 | running 里最多同时有几条请求，决定批的宽度 | 32 |
| 空闲 KV 块 | 这一步要写的位置有没有地方存 | 看块池余量，见[块分配](vllm-kv-block-allocation.md) |

代价有三处。第一，先续 running、后接 waiting 的顺序保护了正在生成的请求，高负载时新请求要多排一会儿。第二，预算封住了一步的大小，长提示词超过余量就要分几步算完，这条请求拿到第一个输出 token 会更晚；换来的是 running 里的请求每步照常推进，不会被一条长提示词整段卡住。第三，KV 块不够时要抢占：请求的已算进度归零、退回 waiting，之后重新匹配可用缓存，再补算缺失部分。它保留已生成的编号；重建计算状态与重新生成、重新交付的区别见[抢占不是收尾](request-teardown.md#抢占不是收尾块还了请求还在)。

## 调度器怎样排一步：还差几个 → 截断 → 借块 → 记账

每一步从预算上限开始。调度器先按顺序扫 running 队列，再扫 waiting 队列；扫到的每条请求都过同样四关：

1. **还差几个位置。** 应算减已算。running 里的请求把待验证的候选 token 也算进「应算」，开了 async scheduling（异步调度：不等上一步结果回来就先排下一步）时还要加上结果的占位数；waiting 里的请求是它现有的全部 token 减去已算：新请求就是整段提示词，被抢占退回来的请求还包括它已经生成的部分。
2. **截断。** running 依次受正的单条阈值、剩余预算和单请求长度限制，安排量变成 0 时跳过本条。waiting 先截正阈值；若关闭分块且仍超预算，就停止本轮接纳，否则再按预算截。后续编码器预算或状态对齐把 waiting 的安排量变成 0 时，同样停止接纳，不能套用 running 的“跳过这条继续找”。
3. **借块。** 按「已算 + 本步要算 + 为下一步候选预留的位置」，求这条请求每个缓存组还差几块，加起来和空闲块数比，够才一次全部借出。缓存组是存储格式和借块规则相同的一组层，各组各算各的块数；GLM 分 5 组，怎么编的见 [KV cache 规格](kv-cache-spec.md)。
4. **记账。** 从预算里扣掉本步安排的数。整步排完后，不等 worker 算完，调度器就把每条请求的已算数往前推，下一步从新位置接着排。

```wiki-diagram
file: vllm-scheduler-flow
```

waiting 里的请求要进来，还得满足三个条件：这一步没有发生过抢占，引擎没有暂停，running 还没满上限。关掉 [chunked prefill](chunked-prefill.md)（分块预填充：长提示词分几步算完），并保持单条上限为默认的“不截断”时，一条新请求差的位置比剩余预算多，调度器直接停止接纳 waiting，排在它后面的请求也一起等。若另外设置了正的单条上限，先做这道截断，再检查分块开关，因此仍可能只排入一段；两项联动见页末。

第 3 关对 waiting 还有一道默认开启的容量检查：先看完整输入按各缓存组折算后放不放得下，而不只看本步这一段。启用它时，即使预算和空闲块足够算第一段，完整输入放不下仍会暂缓接纳，避免刚接进来就因后续缺块而抢占。**检查放不放得下，与当场借出多少块，是两件事**：检查本身不触发全量预分配，通过后仍按本步需要和候选预留位置借块。本步若恰好计算完整输入，就会分配相应的块；未知输出的全部空间仍不会提前预留。现场先确认这项检查的生效配置，参数与版本见页末。

running 里的请求借不到块时，调度器按先来先服务，从 running 队尾取一条抢占：这条请求的块全部还回池子，已算数清零，候选清空，退回 waiting 队首；然后再试一次借块。被抢的正是当前这条时，running 这一轮扫描到此为止。这一步只要抢占过，就不再接纳 waiting。所以「先续 running」不等于「running 永远不被阻塞」：块不够时，最晚排进来的那条会被整条退回去。抢占和请求结束都会把块全部还回池子，两者差在哪，见[请求收尾](request-teardown.md#抢占不是收尾块还了请求还在)。

从 running 队尾挑受抢占请求，对应先来先服务策略。采用优先级策略时，实现选取“优先级字段、到达时间”二元组最大的一条；字段相同才比较到达时间。因此，不能仅凭进入 running 的先后判断谁被抢占。


预算、单条上限或长度上限一旦截掉了一部分工作，最终安排量就小于原先还差的量。安排的位置数也不等于新输出数：长提示词分几步算时，前几步是在处理输入，还没有返回给用户的 token；投机解码则要看本步候选被接受多少，能一次确认多个 token。余下的预算不必填满，没有同时满足这些条件的请求时，一步可以远低于上限。

## 多个 DP 组怎样对齐 prefill 的节奏？

不同执行组各自调度，但专家通信又要求它们一起推进。如果每一步都可能在某一组混入长提示词，另一组的 decode 便可能反复等它。较新版本可以给 prefill 设一个共同的步数间隔，让各组尽量在相同的步骤处理这类计算；它改变“哪一步安排”，不改变请求的提示词长度，也不代替每步 token 预算。

这个间隔不是严格的“每 N 步只接一条新请求”。引擎在非间隔步提出暂缓信号，调度器还要检查：上次放行时是否仍有 waiting 请求留下，以及 running 中是否已有非 prefill 请求。只有需要暂缓、上次没有留下 waiting、并且还有 decode 等非 prefill 工作可做时，才延后本地 prefill。**已经在 running 中的 prefill chunk 也会暂停这一轮**；waiting 中仍需处理多于最后一个位置的请求会挡住后续接纳。异步加载远端 KV 的分支先处理，不属于这道本地计算闸门。

例如下表是间隔为 3 的示意：第 0 步放行后 waiting 已空，running 留有正在 decode 的 A 和尚未算完提示词的 P；新的 N 在第 0 步之后到达。

| 引擎步号 | 这一步怎样安排 | 对请求的影响 |
|---|---|---|
| 0 | 可以安排 prefill；仍受预算与块容量限制 | P 算一段，A 继续生成 |
| 1、2 | 上述暂缓条件成立时，续 A，暂缓 P 和 N 的本地 prefill | P 的下一段与 N 的首段都要等 |
| 3 | 再次放行 prefill，按正常队列、预算与块容量安排 | 不保证 P、N 都能在这一步算完 |

纯 prefill 负载没有非 prefill 请求可续时，不因间隔强行空转；上次放行仍留下 waiting 的容量受限情形也会免于暂缓。闲置后新一轮工作的计数从 0 开始，因此能立即放行。普通非 DP 引擎的节流判定为假，自定义调度器是否接收这项信号还要看其实现。代价是部分提示词更晚开始或更晚算完，收益是否抵得过等待，应看同一负载下的首 token 与 decode 时延。固定 GLM 的旧控制流没有这一开关，后面的 R1 与场景 M 均沿用原配方。

## 放到 GLM 双机：一个 DP 组里的 R1

部署前提见[部署页](glm-5-3-flash-two-node.md#部署前提)。两台机器是两个 DP 组，各跑一个 EngineCore，**各有一个调度器**，各有一份 8192 的 token 预算、一个 32 条的请求数上限和一个 KV 块池；请求先被分到某一组，之后只由那一组的调度器排，见[第 1 站 入口](one-request.md#第-1-站-入口从-http-到-node0-的引擎)。这两个上限是官方配方在启动命令里显式给的，作用见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)；不给时昇腾上会落到多少，见页末[怎么开](#怎么开)。

[R1](one-request.md#示例请求-r1-与官方双机部署) 是主线的示例请求，提示词为 4 个 token（教学设定）。它在调度器眼里走过的几步，是同一道减法的不同结果：

- **第一步。** R1 在 waiting 里，应算 4、已算 0，差 4 个，预算 8192 足够，给 4 个。借块时还要为下一步 MTP 的 3 个候选预留位置（这 3 个预留叫 lookahead），一共留 7 个位置，借到 15 个块号，逐组算式见[一条请求第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)。prefix caching（前缀缓存：开头相同的请求复用已经算好的 KV cache）在本部署默认关着，查命中直接返回空，这 4 个 token 一定要算，原因见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)。
- **之后每一步（decode）。** R1 的「应算」里多了上一步确定的 1 个 token 和 MTP 草拟的 3 个候选，已算数恰好落后 4 个，于是每步给 4 个。验证后被拒的候选会让已算数回退几格，下一步的差仍是 4。三圈的逐项账见[第二圈和第三圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)。

调度器交给本组 8 个 worker 的计划，对每条请求主要是三样：本步几个 token（R1 第一步是 4）、本步新借的块号（按缓存组分开）、要验证的候选 token（第一步为空）；新排进来的请求还附带它的提示词和采样参数。它不决定用哪个算子、走不走 graph mode：worker 按收到的 token 数自己判断，规则见[图尺寸补齐](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)。这份计划怎样变成每张卡上的输入张量、位置和槽位，见[输入准备](prepare-inputs-flow.md)。

本部署没有显式设置 async scheduling，按默认条件推断是开的：MTP 与多进程执行器都满足打开条件，缺启动日志确认。开着时调度器不等上一步的结果回来就先排下一步，用占位数先把还没回来的 1 个 token 和 3 个候选记上，见 [async scheduling](async-scheduling.md)。时间上前后两步交错，但每步排给 R1 的仍是 4 个 token。

## 多条请求时：已有请求都在 decode，余量怎样给新提示词

一个 DP 组跑满 32 条 decode 请求时，每条 4 个，一步共 128 个 token（见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)），只用掉预算的一小部分：

$$\text{ratio}_{\text{decode}} = \frac{32 \times 4}{8192} = \frac{128}{8192} \approx 1.6\%$$

| 纯 decode 满载步（单 DP 组） | 算式 | 结果 |
| --- | --- | --- |
| 本步 token 总数 | $32\text{ 条} \times (1 + 3)$ | **128 个 token**（恰为最大图捕获尺寸） |
| 占单步预算比例 | $128 \div 8192$ | **约 1.6%**（剩余 8,064 个留给新提示词） |

所以纯 decode 步先碰到的是 32 条的上限，不是预算；128 也正是本部署最大的图捕获尺寸。以下只讨论已有 running 全在 decode 的场景：先按每条 4 个扣，剩下的给新提示词。running 也可能包含上一步没算完的 prefill，那时须按实际差值扣，不能每条都算 4。[场景 M](concurrent-requests.md#示例场景-m-与变体-m) 里 DP0 有 12 条 decode，新来的 6000 个提示词一步装得下，这一步合计 6048 个 token、13 条请求；逐项账见[第 2 站 调度](concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)。

由此得出切分门槛：新提示词比「8192 − 4 × running 条数」长，才需要分几步算。新请求能进来时 running 最多 31 条，门槛最低是 8068；running 已满 32 条时，新请求这一步根本进不来。把场景 M 的新请求换成 20,000 个 token，它要分三步算完提示词：前两步把预算用满，第 3 步算完最后一段才得到第一个输出 token，见[分几步算](concurrent-requests.md#提示词超过剩余预算时分几步算)。单条请求一步的上限本部署没设，保持默认的不截断；若启动命令另设了它，这些门槛要按它重算。

调度器切提示词时不看 KV 块的边界。一个逻辑块是 640 个位置，8192 不是它的整数倍，两者本来就管不同的事：预算管一步算多少，块管历史存在哪。KDA 层（线性注意力，每条请求只存一份固定大小的状态）的缓存模式，在 prefix caching 关着时是「不按块留档」，调度器不需要把每段提示词切在 KDA 状态的块边界上；昇腾为按块对齐模式准备的切分补丁，在本部署不生效。开了 prefix caching 会怎样变，见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)。

块不够时的抢占，在本部署很贵：prefix caching 关着，被抢占的请求没有前缀可复用，提示词和已生成编号都要重新作为输入，重建包括 KDA 在内的计算状态。32 条请求各走到多长时开始抢占、被抢的一条还回多少块，见[池子不够时](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)和[多条请求的 KV 块](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)。

## 昇腾上跑的是哪个调度器

vllm-ascend 的平台补丁在启动时，把上游的 Scheduler 类整体换成自己的 BalanceScheduler。它多了一道闸门：按各执行组 running 的条数，决定这一步还接不接纳新请求。这道闸门默认关着；关着时，BalanceScheduler 每一步直接调用上游的调度逻辑，所以本页讲的规则就是本部署实际在跑的规则。开着 async scheduling 时，引擎建的是上游的 AsyncScheduler；它在平台补丁之后才被导入，按导入顺序推断，它继承的正是替换后的 BalanceScheduler，每一步仍落到同一套上游调度逻辑，这一点没有实跑确认。闸门打开后的行为见 [Balance Scheduling](balance-scheduling.md)。

镜像里另有几种调度器变体，各有自己的开关，本部署一个都没开，它们对本部署的效果也没有实测数：

- [Recompute Scheduler](recompute-scheduler.md)：只能在 PD 分离（prefill 和 decode 分到不同节点）的 decode 节点上开；在本部署这种混合部署里打开，启动时直接报错。
- SchedulerDynamicBatch：按 SLO（服务给出的时延目标）动态调整每一步的 token 预算，开关默认不开。
- ProfilingChunkScheduler：启动时先测 prefill 的耗时，再据此决定长提示词每段切多长，开关默认关。

这份列表针对固定 GLM 镜像。新分支还提供 [Batch Job Aware Scheduler](batch-job-aware-scheduler.md)，按批任务和长度层级安排请求；它与每步限制位置总数是不同的调度选择，适用版本和启用方法见该页及下方版本表。

## 常见误解

- **「prefill 和 decode 是两条代码路径」**——在调度器里不是。上游在调度函数开头的注释里明确否定了这个说法；两者是同一道减法的不同结果，也能排进同一步。到了 worker 一侧就不同了：GLM 的 KDA 层仍为 prefill 和 decode 走不同分支（prefill 分段算，decode 与候选验证逐位置递推），稀疏 MLA 层则对一步里的全部 token 走同一条路、不分 prefill 和 decode；本部署还只有纯 decode 步才回放图，混进 prefill 的一步整步不走图。
- **「一步 8192 个 token，就是一步最多 8192 条请求」**——预算数的是位置，不是请求。本部署一步最多 32 条请求，纯 decode 时只用掉 128 个位置。
- **「8192 是整套部署一步的总量」**——是每个 DP 组各自的量。两组各有一个调度器、一份预算和一个块池。
- **「chunked prefill 要手动开」**——本部署默认开着；未显式设置时按模型支持条件决定，生成式 encoder-decoder（先编码输入、再解码输出的结构）除外。关掉且单条上限保持默认时，超过剩余预算的新请求排不进这一步，还会挡住后面的新请求；预算小于模型最大长度时更早在启动校验中失败。
- **「先排 running，所以正在生成的请求永远不会被卡住」**——块不够时，默认 fcfs 会抢占 running 队尾；priority 改按优先级与到达时间挑选。受抢占请求退回 waiting，按缓存复用结果补算缺失部分。
- **「预算没用满就是浪费，应该塞满」**——余下的预算不必填满。纯 decode 时本来就只用掉很小一部分，这时限制批大小的是请求数上限和 KV 块。
- **「调度器决定用哪个算子、走不走图」**——不决定。它只交出每条请求算几个 token、借了哪些块、验证哪些候选，新请求再附上提示词和采样参数；走不走图由 worker 按 token 数判断。
- **「调大预算或请求数上限，吞吐一定上去」**——不一定。预算调大，启动时按它试跑量出的激活峰值更高，留给 KV cache 的显存变少，混进长提示词的那一步也更大；请求数上限调大，同时在跑的请求受块池容量限制，块不够时只会带来更多抢占。

## 对照源码

### 怎么开

调度器没有总开关，每一步都在跑。以下是引擎启动参数，作用于每个 DP 执行组；不能放进单次 Chat/Completion 请求来改变调度器。Python 的 EngineArgs / LLM 使用下划线名，CLI 使用表中的连字符名；直接构造 SchedulerConfig 时，调度策略字段名是 policy。行为按 vLLM `0fc695fc`，昇腾侧按 GLM 参考快照 `db701c1f`；固定源码与现场安装内容的关系见[来源基线](../sources/glm-5-3-flash-baseline.md)。

| 参数与 CLI | 输入默认、类型和范围 | 生效位置与固定部署 |
|---|---|---|
| max_num_batched_tokens；--max-num-batched-tokens | EngineArgs/CLI 为 None，配置类兜底 2048；最终正整数 ≥1 | 每步处理的位置上限，也是试跑/缓冲区容量依据。GLM 显式 8192；完整默认推导见下文 |
| max_num_seqs；--max-num-seqs | EngineArgs/CLI 为 None，配置类兜底 128；最终正整数 ≥1 | running 并发条数上限，不限制 waiting 队列总长，也不是 [HTTP 超额拒绝开关](api-server-entry.md#版本差异)。GLM 显式 32 |
| enable_chunked_prefill；--enable-chunked-prefill / --no-enable-chunked-prefill | 输入 None 表示自动；配置类兜底 True；最终 bool | 由模型支持条件决定，GLM 为 True；关掉时要求预算至少等于模型最大长度。分块历史与执行路径见 [chunked prefill](chunked-prefill.md) |
| long_prefill_token_threshold；--long-prefill-token-threshold | int，默认 0；基线仅在 >0 时截断 | 是单条请求本步位置数的上限，running 和 waiting 都用；0 不截，GLM 保持 0。不是给整个 prompt 设拒绝门槛 |
| max_num_partial_prefills；--max-num-partial-prefills | int，默认 1，字段要求 ≥1 | 字段意图是同时部分预填充的条数，但标准启动入口只接受默认 1；不能用 2 打开这项能力 |
| max_long_partial_prefills；--max-long-partial-prefills | int，默认 1，字段要求 ≥1，且不得大于上一项 | 字段意图是长提示词的部分预填充并发上限；标准启动入口同样只接受 1。这两个 1 不等于 V1 实际只能同时推进一条 prefill |
| scheduling_policy；--scheduling-policy | fcfs 或 priority，默认 fcfs | 写入 SchedulerConfig.policy，决定等待队列顺序与缺块时的受抢占者；GLM 未覆盖 |
| scheduler_reserve_full_isl；--scheduler-reserve-full-isl / --no-scheduler-reserve-full-isl | bool，默认 True | waiting 准入先检查完整输入的容量；False 只按本步需要检查。检查与实际分配分开，GLM 保持 True |
| async_scheduling；--async-scheduling / --no-async-scheduling | bool 或 None，默认 None | None 自动决定，False 关闭，True 显式启用且不兼容时失败。GLM 按 MTP/执行器条件推断开启，仍缺日志；完整判定与开销见[异步调度参考](async-scheduling.md#怎么开) |
| scheduler_cls；--scheduler-cls | 默认 None；Python 接受类对象或模块限定字符串，CLI 使用类路径字符串 | None 才按异步开关选默认类；显式路径例如 vllm.v1.core.sched.scheduler.Scheduler 会绕过自动选 AsyncScheduler。GLM 不显式指定；Ascend 特性仍可能在平台配置阶段覆盖它 |

这些开关的正负形式由布尔参数解析器生成，不在命令后面写 Python 的 True/False。恢复 async 的自动判定应省略该选项；--no-async-scheduling 是明确关闭。下面只摘出固定部署已有启动命令中的调度部分，其余模型、并行与 Ascend 参数沿用[部署配方](glm-5-3-flash-two-node.md#关键参数各管哪一步)：

```bash
--max-num-batched-tokens 8192 --max-num-seqs 32
```

**预算与条数怎样得到最终值。** 先记住用户是否显式给值，再选硬件/入口默认值；后续自动补值不会把明确给出的 8192、32 翻倍或自动缩小。普通生成场景的顺序是：

1. 未给预算时，batched-DP MoE 专用模式先取 256；其他模式按下面默认表取值。未给条数时按同一张表取值。这里的 batched-DP 专用模式与 GLM 的 DP2 不是同一个条件。
2. performance_mode 为 throughput 时，只把未显式给出的项目翻倍。
3. 预算未显式给出且关闭分块时，至少抬到模型最大长度；多模态 prefix-LM 另有容纳单个最大输入项的下限。随后将自动预算封顶为“当前条数 × 模型最大长度”。GLM 不走多模态这一支。
4. 条数未显式给出时，最后取“当前条数、最终预算”的较小值。两者都显式给出则保留输入，交给下一节的联合校验。

例如普通昇腾 serve、分块开启、非 throughput 模式下，显式预算 32 而省略条数，自动条数会由 256 降到 32；若显式给预算 32、条数 64，则启动失败，不会自动修成 32。这是配置分支演算，不是吞吐测量。模型最大长度还须允许该示例。

- **一步的 token 预算**：--max-num-batched-tokens。schedule() 每步开头把 token_budget 设成 self.max_num_scheduled_tokens，它没单独设时等于 max_num_batched_tokens；引擎处于 PAUSED_ALL 时直接置 0，这一步什么也不排 [C2]。
- **请求数上限**：`--max-num-seqs`，调度器里叫 `max_num_running_reqs`；waiting 循环第一句就是 `if len(self.running) == self.max_num_running_reqs: break` [C12]。
- **默认表的普通硬件档**：设备显存 ≥70 GiB 且设备名不含 a100 时，LLM 类预算 16384、API server 8192，条数都是 1024；否则 LLM 类预算 8192、API server 2048，条数都是 256；查询抛异常时显存按 0 算（来源 16）。昇腾的设备显存接口直接抛 NotImplementedError，原因是避免过早初始化 torch_npu（来源 21）。所以普通昇腾 serve 在分块开启、非 throughput、非 batched-DP 特殊模式且长度封顶不收紧时，自动落到 2048 个 token、256 条；LLM 类则是 8192、256。硬件接口与默认表关系见 [NPUPlatform](npu-platform.md) 和 [Platform 接口](vllm-platform-interface.md)。CPU/TPU 另有专表，不能套用这个 NPU 结论。GLM 显式给了 8192 和 32，不受自动表影响。
- **两道减法**：running 一侧是 `num_tokens_with_spec + num_output_placeholders - num_computed_tokens`，再依次被 `long_prefill_token_threshold`、`token_budget`、`max_model_len - 1 - num_computed_tokens` 截 [C3]；waiting 一侧是 `request.num_tokens - num_computed_tokens`，先截阈值，`enable_chunked_prefill` 关着且大于剩余预算就 `break`，否则 `min(num_new_tokens, token_budget)` [C6]。代入 R1：首步 `min(4, 8192) = 4`，decode 步 `(5 + 3) − 4 = 4` [D]。

单轮调度预算还可以单独配置：指定 max_num_scheduled_tokens 时使用该值，否则回退到 max_num_batched_tokens；本页固定部署的示例预算保持不变。

**DP prefill 间隔。** v0.26 及本文所列 rc2/main 上游快照提供启动参数 `--prefill-schedule-interval`，EngineArgs / LLM 与 SchedulerConfig 字段为 prefill_schedule_interval，整数且 ≥1，默认 1，表示不施加这项间隔。比如设为 3，只改变前述 DP 节流条件；它不是单次请求参数，也不是 chunk 长度。0 不表示关闭，会在配置校验中失败。普通 EngineCore 返回不节流，DP EngineCore 根据各 rank 对齐的 step_counter 判定，并在普通 step 与批次队列两条执行路径传给 Scheduler；使用 Ascend 的其他调度器时，仍须核对应版本是否传递和消费该信号。

**分块开关与单条阈值的顺序。** waiting 先按正阈值截断，再检查关闭分块时是否超剩余预算。示意输入长 100、模型最大长度 100、预算 100、阈值 20，即使关闭分块，本步仍可排 20，留下 80。若目标是避免这种分段，需要同时保留阈值 0。running 也受阈值限制：GLM 常规 decode 差值为 4，设成 2 会把它先截成 2，不能把该项理解成只影响长 prefill 的分类标签。

- **单条上限与两个保留字段**：long_prefill_token_threshold 大于 0 才截断；基线没有非负字段约束，负数也不触发截断，但不应把负数作为跨版本关闭方式。用 0 表示不截断。两个 partial-prefill 参数任一不等于 1，EngineArgs 会先抛 Concurrent Partial Prefill 不支持错误。因此配置类里“并发数 >1 且阈值为 0 时取模型最大长度的 4%”只是构造分支，不是本部署可用的自动调参方案；也不能从字段说明推断已有短请求插队能力。四版变化见后表。
- **Chunked prefill**：字段兜底 `True`，真正的默认由 `_set_default_chunked_prefill_and_prefix_caching_args` 取 `model_config.is_chunked_prefill_supported`，生成式模型只有 encoder-decoder 返回 False [C17]。
- **整段放得下才接纳**：`scheduler_reserve_full_isl` 默认 True，waiting 侧调 `allocate_slots(..., full_sequence_must_fit=True)`，先按 `min(request.num_tokens, max_model_len)` 求各组块数，比空闲块多就返回 None [C19]。running 侧的 `allocate_slots` 不带这个参数。
- **调度策略**：fcfs 按到达顺序排 waiting，缺块时从 running 队尾抢占；priority 按“请求 priority 数值、到达时间”升序排 waiting，数值越小越优先，例如 -1 先于 0，0 先于 5。同值才比到达时间；缺块时从 running 取该二元组最大的一条，并退回它本步已拿的预算。priority 不把主循环改成“每步把所有运行中和等待中的请求重新全局排序”；等待中的高优先请求仍须通过条数、预算与容量检查。
- **异步与自定义类的组合**：None 只在配置对象里表示自动选类，不是一个可导入的类名。自定义类必须实现相应调度接口，字符串在取类时动态导入；路径不存在会在导入/取属性时失败。该接口不承诺跨版本兼容。显式指定同步 Scheduler 不会因为 async_scheduling=True 自动换成异步子类；配置开关仍可能保持 True，不能只看开关值判断实际类。Ascend 的动态批、profiling chunk 与重算调度选择及后写覆盖顺序，见[异步调度](async-scheduling.md#会报什么错)和[重算调度](recompute-scheduler.md#会报什么错)。
- **KDA 对齐切分**：`need_mamba_block_aligned_split` 只在有 mamba 层且 `mamba_cache_mode == "align"` 时为真 [C11]；本部署 prefix caching 关着，`mamba_cache_mode = "none"`，不切 [D]。昇腾为 align 模式准备的 `patch_glm5_next_mamba_scheduler` 因此不生效。
- **昇腾换掉调度器类**：`vllm_ascend/patch/platform/__init__.py` 无条件 `import patch_balance_schedule`，文件末尾 `vllm.v1.core.sched.scheduler.Scheduler = BalanceScheduler` [C23]；开关读 additional config 的 `enable_balance_scheduling`，没有时读环境变量 `VLLM_ASCEND_BALANCE_SCHEDULING`，默认 `"0"`；关着时 `schedule()` 直接 `return super().schedule()` [C22]。
- **其他变体的开关**：`recompute_scheduler_enable`、`SLO_limits_for_dynamic_batch`（默认 -1）、`profiling_chunk_config.enabled`（默认 False），都在 `NPUPlatform.check_and_update_config` 里改写 `scheduler_cls` 或调度配置。

### 会报什么错

- 预算和条数最终都必须为正整数，0 不表示无限。预算小于条数时抛 ValueError；关闭分块时预算小于模型最大长度也抛 ValueError，等于该长度可通过这项校验。预算超过“条数 × 模型最大长度”只是 warning，不是同一个硬失败条件。
- 固定 GLM 的预算 8192、最大长度 133120：只追加 --no-enable-chunked-prefill 会在长度校验中失败。省略预算让框架自动抬高虽然可通过这一项，却会改变试跑规模与显存占用，不能当成原配方的等价写法。
- max_num_partial_prefills 或 max_long_partial_prefills 非默认 1：标准启动入口抛 NotImplementedError，错误包含 Concurrent Partial Prefill；直接构造配置类还有“长并发数 ≤总并发数”“并发数 >1 必须开分块”的检查。绕过入口构造配置不等于 V1 支持该能力。
- async 显式 True 与自动 None 的失败方式不同：不支持的投机方法、关闭候选批次补齐或执行器不支持时，显式启用会失败，自动判定会关闭；pooling 在自动分支默认关闭。完整报错和 draft_model 的版本例外见[异步调度](async-scheduling.md#会报什么错)。
- 函数末尾 `assert total_num_scheduled_tokens <= self.max_num_scheduled_tokens` 和 `assert token_budget >= 0`：预算透支直接断言失败，正常路径不会触发 [C8]。
- 生成式模型手动关 chunked prefill，打一条 warning：`This model does not officially support disabling chunked prefill. Disabling this manually may cause the engine to crash or produce incorrect outputs.`
- 关 chunked prefill 后，新请求经单条阈值截断仍比剩余预算多，waiting 循环直接 `break`，不报错，只是这一步不排。
- 混合模型落到 align 模式而 chunked prefill 关着，启动断言失败：`Chunked prefill is required for mamba cache mode 'align'.` [C20] 此模式还要求预算容纳块长、正阈值不小于块长，完整检查见 [KV 规格校验](kv-cache-spec.md#会报什么错)。固定 GLM 的 none 模式不套用这组 align 条件。
- 抢占不报错：`_preempt_request` 释放 KV 块和 encoder 缓存，状态改成 `PREEMPTED`，`num_computed_tokens = 0`，清空候选，`num_preemptions += 1`，再 `waiting.prepend_request` [C9]。抢占频繁时看这个计数和 `PREEMPTED` 事件。
- 昇腾上在非 `kv_consumer` 节点开 `recompute_scheduler_enable`：`kv_producer` 节点打 warning 并忽略，其余（包括本部署这种混合部署）抛 `ValueError`，提示只能在 PD 分离的 D 节点开 [C25]。

### 开销和什么时候别开

- 先扫 running、后扫 waiting 的顺序保护已开始生成的请求，代价是高负载时新请求排队更久 [D]。
- 关闭 chunked prefill 且单条阈值保持 0 时，一条比剩余预算长的新请求堵在 waiting 队头，这一步后面的新请求也被 `break` 挡住；GLM 这类生成式模型还会收到上面那条 warning。
- `long_prefill_token_threshold` 设小，长提示词每步少占预算，别的新请求能同一步进来，代价是这条长提示词要多分几步、首个输出 token 更晚 [D]。
- `max_num_batched_tokens` 调大：启动试跑按它量激活峰值，留给 KV cache 的块变少，见[显存量测](kv-cache-memory-profiling.md#试跑两次先按-128-个-token再按-8192-个)；混进提示词的那一步更大，这一步里 decode 请求的时延也更长。
- `max_num_seqs` 调大：本部署 32 × 4 = 128 恰好是最大的图捕获尺寸，超过 32 条的纯 decode 步没有对应的图，要连捕获尺寸一起改；每条请求常驻 15–16 块状态，条数越多，块池越早用完、越早抢占 [D]。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm@0fc695fc` / `vllm-ascend@2c59ff10`，无 GLM 代码；**本页 GLM 行为按专用镜像 `db701c1f`**，配套 `vllm@0fc695fc`）、`v0.26.0rc`（`vllm@568afb3a` / `vllm-ascend@2ed6cbba`）、`v0.30.0` 主基线（`vllm@ced6857a` / `vllm-ascend@c09d3e20`）与 `main`（`vllm@ba15685a` / `vllm-ascend@8d6180e2`）。

**`v0.30.0` 起上游避免“连续抢占却无块可用”，并拆分“调度位置预算”与“输入容量预算”**：分配失败后先检查 connector 的待释放块，若抢占只会产生延迟释放则本轮停止继续抢占；`watermark` 仅在本步已有请求且候选为 `WAITING`/`PREEMPTED` 时追加。到了 `main`，上游在 `SchedulerConfig` 新增 `long_prefill_token_threshold_adaptive`（默认 `False`），而昇腾侧移除旧 `profiling_chunk` 调度器、保留 `ShortRequestFirst` / `Recompute` / `DyntraLB` / `BatchJobAware` 与 `BalanceScheduler` 覆写链。

| 核验维度 | `v0.23.0`（`0fc695fc` / `2c59ff10`） | `v0.26.0rc`（`568afb3a` / `2ed6cbba`） | `v0.30.0`（`ced6857a` / `c09d3e20`，主基线） | `main`（`ba15685a` / `8d6180e2`） |
| --- | --- | --- | --- | --- |
| V1 `Scheduler` 核心循环与预算 | 统一位置进度，先 running 后 waiting；无阶段切换 | 新增条件性 `prefill_schedule_interval`（默认 1）节流 | `scheduler.py#L561` 拆分调度位置预算与输入容量预算（含草拟预留槽位），加延迟释放抢占止损 | `scheduler.py#L721` 延续双预算与止损机制；`config/scheduler.py#L99` 新增 `long_prefill_token_threshold_adaptive`（默认 `False`） |
| 自动预算表与显存查询 | ≥70 GiB 非 A100：serve 8192/1024；否则 2048/256；Ascend 显存查询抛 `NotImplementedError` 落小档 | 同 `v0.23.0` | 增加 ≥160 GiB 档（LLM/serve 均为 16384/1024）；Ascend 初始化后返回实值、早期 CLI 仍落小档 | 同 `v0.30.0` 档位与早期查询规则 |
| 阈值、partial-prefill 与 `scheduler_reserve_full_isl` | `long_prefill_token_threshold=0`（允许负值）；两项 partial-prefill 默认 1 但入口拒绝；完整输入准入默认 True | 阈值加 `≥0`；完整输入准入新增 `watermark`（默认 0） | 阈值强制 `0 ≤ v ≤ max_model_len`，删 4% 派生；**删除两项 partial-prefill 参数** | 同 `v0.30.0`；另增自适应阈值开关 |
| `async_scheduling` 与 `scheduler_cls` | `draft_model` 仅显式 True 允许、自动关闭；`scheduler_cls=None` 自动选类 | 增 DSpark / ROCm DeepEP 闸；显式同步子类加提示 | `draft_model` 自动判定亦可开；`scheduler_cls` 选类规则不变 | 同 `v0.30.0` |
| 昇腾 `BalanceScheduler` 覆写链 | 无条件替换 `Scheduler`；关闭时直接回上游 | 关闭时仅 Mamba KV producer 临时关 `has_mamba_layers` 查全组命中 | `patch_balance_schedule.py#L897` 仍做 `_sched_mod.Scheduler = BalanceScheduler` 覆写；关闭直接回上游 | `patch_balance_schedule.py#L926` 延续类覆写，关闭直接回上游 |
| 昇腾扩展调度器变体 | recompute、dynamic batch、profiling chunk | 删 dynamic batch，增 short-request-first | 保留 short-request / recompute / DyntraLB / profiling（支持异步+MRV2）/ batch-job | `platform.py#L1240-L1320`、`#L1585-L1630`：**移除 `profiling_chunk` 调度器**，保留 short-request、recompute、DyntraLB、batch-job（并显式互斥 short-request 与 batch-job） |

`v0.30.0` 与 `main` 分别记**调度位置预算**（初值 `max_num_scheduled_tokens`）与**输入容量预算**（初值 `max_num_batched_tokens`）：给请求安排新位置时，还需为草拟阶段扣除 `max_num_new_slots_for_drafting`（例如示意输入容量剩 10，安排 4 个新位置且草拟需 2 槽，输入容量扣 6 剩 4、调度位置只扣 4；它与 KV 管理器的 lookahead 计数是两回事）。`v0.26.0rc` 对 Mamba KV producer 的临时全组命中查找仅在该版本成立，`v0.30.0`/`main` 的 `BalanceScheduler` 关闭路径直接回上游；short-request-first 与 [batch-job](batch-job-aware-scheduler.md#版本差异) 不能同时开启，也不等于多个自定义调度器叠加生效。完整异步参数对照见[异步调度版本表](async-scheduling.md#版本差异)。

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

**配置与实测边界。**

1. async scheduling 是否真的开着：按自动判定条件推断为开，缺启动日志里 `Asynchronous scheduling is ...` 那一行确认 [!]。
2. 预算 8192 与逻辑块 640 不整除（8192 = 12 × 640 + 512）。固定 none 模式下，调度器不为 640 做块对齐切分；KDA 与 SFA 的输入包装仍分别按请求边界和缓存映射处理。底层算子的 tile、工作区及内部补齐属于另一层，不能从调度器规则推断全部 kernel 都无需对齐；这套配置的实际执行仍缺 NPU 日志与完整底层核验。

- 来源 37、38、39：vllm@0fc695fc，vllm/v1/core/sched/scheduler.py，L104–L109、L472–L478、L768–L770。
- 来源 40：vllm@0fc695fc，vllm/v1/core/kv_cache_manager.py，L354–L418。
- 来源 41：vllm@0fc695fc，vllm/config/scheduler.py，L140–L144。

- 来源 42–47：固定基线的参数字段/取类、联合校验、CLI 映射、partial-prefill 入口拒绝、默认派生与异步自动/显式分支。
- 来源 48–51：v0.26 对应字段、阈值边界、partial-prefill 拒绝和异步差异。
- 来源 52–56：main 的完整字段段落与 CLI、阈值校验、默认派生和异步判定；两项 partial-prefill 已从配置与 CLI 删除。
- 来源 57–58：v0.26/main 完整输入容量检查与 watermark 的叠加条件；默认 watermark 为 0，字段见来源 48、52。
- 来源 59–61：rc2 的延迟释放抢占检查、阈值字段和完整输入容量准入。
- 来源 62–72：rc2 参数与异步判定，Ascend 显存查询、BalanceScheduler 的关闭路径及 batch-job 选类；v0.26 的 Mamba KV producer 临时查找行为也在此组。
- 来源 73–88、93–96：v0.26、rc2 与固定 main 的 prefill 间隔参数、EngineCore 传递、DP 节拍、运行请求与新请求的节流分支，以及容量受限标记的更新。
- 来源 89–92：GLM 稀疏 MLA 包装到 SFA 的实际调用和输入处理；KDA 的两条执行路径见来源 33–34。
- 来源 97–102：rc2/main 的输入容量初值与运行请求的草拟槽位扣减；新请求的容量检查见来源 86、95，两种预算不能混算。
- 来源 103–105：固定 main 的 short-request 与 profiling 组合限制、profiling/batch-job 选类顺序，以及 rc2 的 profiling 异步 MRV2 门槛。
- `v0.30.0`（`ced6857a` / `c09d3e20`）与 `main`（`ba15685a` / `8d6180e2`）核心入口见文首 `sources` 末尾 9 条（`scheduler.py`、`config/scheduler.py`、`patch_balance_schedule.py`、`platform.py`）。
