---
id: vllm-scheduler
title: Scheduler：每一步给哪些请求算几个 token
type: concept
legacyAnchors:
  放到-glm-双机一个-dp-组里的-r1: 复杂异构实战对照：GLM 双机 5 缓存组与 MTP 1+3 占位
  多条请求时已有请求都在-decode余量怎样给新提示词: 复杂异构实战对照：GLM 双机 5 缓存组与 MTP 1+3 占位
summary: >-
  Scheduler 在 EngineCore 每步开头按位置差额统一安排请求，在 token 预算、请求数上限与空闲 KV 块之内先续 running
  再用余量接 waiting，块不足时触发抢占或暂缓接纳，调度器自身不按 prefill/decode 分阶段；前半以 v0.30.0 标准单缓存组请求走读扣减与抢占主干，后半对照
  GLM 双机 5 缓存组与 MTP 占位实战。
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
  - Preemption
  - Recomputation
  - 抢占重算
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
  - to: kv-cache
    kind: builds-on
    note: 请求能不能推进，还要看有没有空闲 KV 块存下它的历史
  - to: continuous-batching
    kind: builds-on
    note: 每步动态重选批次、请求结束立刻补进新请求，是调度器统一混排的基础
  - to: chunked-prefill
    kind: builds-on
    note: 分块预填充把长提示词按剩余预算切段，避免单条长输入独占整步并拖慢 decode
  - to: prefix-caching
    kind: builds-on
    note: 前缀缓存命中时直接复用已算块，影响 waiting 准入差额与被抢占后的重算代价
  - to: async-scheduling
    kind: builds-on
    note: 开启异步调度时，调度器为在途结果追加输出占位，并在回调更新时按实际产出对账
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

**Scheduler（调度器）是 EngineCore 每一步开头运行的决策逻辑：它看每条请求还差几个位置没算，在 token 预算、请求数上限和空闲 KV 块之内，决定给哪些请求各算几个 token、借哪些块，再把计划交给 worker 执行。** 这里的「一步」指模型对一批请求做的一次前向。`EngineCore` 是在 CPU 上管理一批请求的引擎进程，每转一圈就调一次调度器，见[引擎循环](vllm-engine-core.md)。「位置」是 token 在请求序列里的序号：4 个 token 的提示词占位置 0–3。

调度器用位置进度统一安排 prefill（处理提示词、可分多轮完成）与 decode（继续生成新 token）。它对每条请求只盯两个数：

- **应该算到第几个位置**：提示词、已生成 token，加上开启投机解码时的待验证候选 token。
- **已经算到第几个位置**：历史状态已经写进 KV cache 的进度。

两者相减就是这条请求还差的工作量，每一步在预算内尽量补齐。刚到的请求整个提示词都没算（prefill）；标准单缓存组请求（如 `Qwen3-8B`）在普通 decode 阶段只差上一步刚产出的 1 个输入位置。因为两者算的是同一道减法，prefill 和 decode 可以直接混排进同一步。

> **说明**：调度器本身不分 prefill 与 decode，但计划交到 worker 之后，部分模型层与执行模式仍会分路——例如异构线性注意力层区分分段 prefill 与逐位置递推，graph mode（图模式：录制整步算子序列并回放）通常只覆写纯 decode 步。这部分异构细节放至后半「复杂异构实战对照」展开。

统一调度需要承担三类代价：先续已在运行的请求，新请求会多等几步；长提示词被预算切段后，首个输出 token 出现更晚；KV 块不足时会收回部分请求的状态并在后续补算。预算守住了单步上限，但不保证每条请求每一步都有进展。

```wiki-diagram
file: token-budget
```

图里 A、B 已经在跑（`running` 队列），各差 1 个位置；C、D 刚到（`waiting` 队列），整段提示词尚未计算。调度器先给 `running` 续上差额，再把余量交给 `waiting`：C 拿走剩余预算算出前一段提示词，余下部分留给下一步；预算耗尽后，D 本步不排。

每排入一条请求，还必须确保本步待写位置有足够的 KV 块。KV 块是显存里预先切好的固定格子，用于保存历史计算结果；一块可装多个位置，只有手里的块写满时才借新块。块不足时，`running` 一侧通过抢占腾出空间，`waiting` 一侧则顺延到下一步。

图中的示意预算为 20 个位置：A、B 各用 1 个，剩下 18 个给 C；C 还有 9 个位置留在下一步。这个例子采用不带投机解码的标准单缓存组示意，格子仅表达借用归属，不代表 1 token 对应 1 块。

## 为什么按 token 设预算，还要另设请求数上限？

一条正在 decode 的请求，每一步通常只差 1 个位置。如果每步只算这一条，单次前向的权重读取、逐层调度与 NPU 算子下发成本都由这 1 个 token 独自承担。把多条请求凑成一批，可以让同一轮读取的权重服务更多输入、摊薄固定开销（具体是否受带宽或算子受限需以实测为准）。调度器每一步动态重选批次，某条请求结束、下一步立刻补进新请求，无需等整批同时完成——这种机制叫 **continuous batching（连续批处理）**。

只按请求条数封顶无法管住单步计算量与激活显存，因为不同请求的步长差距极大。以 `v0.30.0` 主基线上的标准稠密模型 `Qwen3-8B` 为例：一条 decode 请求一步只算 `1` 个位置，而一条新到达的 `2,000` token 提示词一步要算 `2,000` 个位置，工作量相差 `2,000` 倍。因此调度器同时卡住两道静态上限，再加上动态 KV 块资源（下表列出 `v0.30.0` 昇腾普通 `serve` 分块开启时的默认档位）：

| 约束维度 | 管控对象 | `v0.30.0` 昇腾默认档（标准 `serve`） | 越界时的行为 |
|---|---|---|---|
| token 预算 | 单步计算位置总数（决定计算量与激活峰值） | `2048`（离线 LLM 类为 `8192`） | 截断长提示词，余量留给下一步 |
| 请求数上限 | `running` 队列同时在跑的请求条数（批宽度） | `256` | 满额即停止从 `waiting` 接纳新请求 |
| 空闲 KV 块 | 本步待写位置所需的显存块余量 | 由显存量测后的块池决定，见[块分配](vllm-kv-block-allocation.md) | `running` 触发抢占，`waiting` 暂缓接纳 |

这种双上限加块池的安排带来三处权衡：

1. **新请求排队变长**：优先保障 `running` 推进，高并发下新请求在 `waiting` 停留更久。
2. **长提示词首字变晚**：超过余量的提示词被拆成多步，首 token 延后，换来已有 `running` 请求不被单条长输入整步卡死。
3. **块荒时发生抢占（Preemption / Recomputation）**：当空闲 KV 块耗尽时，暂停部分正在运行的请求、收回其全部 KV 块，已算进度归零并退回 `waiting`，待稍后重新匹配前缀缓存再补算（重算）缺失段。抢占保留已生成的 token 编号，与请求收尾的区别见[抢占不是收尾](request-teardown.md#抢占不是收尾块还了请求还在)。

## 调度器怎样排一步：还差几个 → 截断 → 借块 → 记账

每一步从预算上限出发。调度器按顺序先扫 `running` 队列，再扫 `waiting` 队列。扫到的每条请求依次过四关：

1. **算差额（还差几个位置）**。用「应算位置 − 已算位置」求本步需求。`running` 请求的应算位置计入待验证候选 token；开启 async scheduling（异步调度：不等上步结果就先排下一步）时再计入输出占位。`waiting` 请求则是全部已有 token 减已算位置：新请求是整段提示词，被抢占退回的请求还包括已生成部分。
2. **做截断**。`running` 请求依次受正的单条上限阈值、剩余预算和单请求最大长度约束；截到 0 时跳过当前条。`waiting` 请求先按正阈值截断；若关闭分块且仍超剩余预算，直接终止本轮接纳，否则再按剩余预算截断。若后续编码器预算或状态对齐使 `waiting` 安排量归零，同样立即终止本轮接纳，不跳过找下一条。
3. **借 KV 块**。按「已算 + 本步要算 + 下一步候选预留」折算所需块数。对于 `Qwen3-8B` 这类纯注意力单缓存组模型（`FullAttentionSpec`），只需核算 1 组块数；多缓存组混合模型（Hybrid KV Cache Groups，例如同时含按位置线性增块的 `AttentionSpec` 与按请求定额留块的递推线性状态 `MambaSpec`）则在各组分别折算，总数不超过空闲块池时一次借齐。缓存组编排见 [KV cache 规格](kv-cache-spec.md)。
4. **扣预算并推进记账**。从本步预算扣去安排的位置数。整步排完后，调度器不等 worker 算完就将各请求的「已算位置」前移，下一步直接从新位置接着算差额。

把单步四关放进 `v0.30.0` / `main` 的双预算演进里看，`running → waiting` 漏斗无需按 prefill / decode 切阶段，同时协调草拟槽位预算、抢占止损与昇腾覆写链：

```wiki-diagram
file: vllm-scheduler-fig-dual-budget
```

### 边界与例外

`waiting` 与 `running` 两条队列的退路并不对称，几类改变执行路径的关键边界如下：

- **waiting 准入三门槛**：只有同时满足「本步未发生抢占」「引擎未暂停」「`running` 未达条数上限」时，才尝试接纳 `waiting`。关闭 [chunked prefill](chunked-prefill.md) 且单条上限为默认 `0` 时，队头新请求只要超出剩余预算，调度器就直接 `break` 停止本轮接纳，排在后面的请求一并等待；若额外设了正的单条上限，由于先截阈值再查分块开关，仍可能排入首段（两项联动见页末）。
- **完整输入容量预检（`scheduler_reserve_full_isl`，ISL 即 Input Sequence Length 输入序列长度）**：默认对 `waiting` 开启。第 3 关先检验「整条完整输入折算后的块数」能否装下，防止刚接进来就在后续分块缺块触发抢占。**预检容量与当场借块是两件事**：预检通过后仍只借本步所需与候选预留块，不会提前为未知输出预留全部空间。
- **running 缺块抢占（`fcfs` vs `priority`）**：`running` 借不到块时，按策略挑选一条请求抢占——`fcfs`（First-Come, First-Served，先来先服务）固定取 `running` 队尾（最晚进入者），`priority`（按显式优先级数值排序）取「优先级数值、到达时间」二元组最大者（数值相同才比到达时间）。被抢占请求归还全部 KV 块、已算位置清零、清空候选并退回 `waiting` 队首，随后当前请求重试借块。若被抢占的正是当前条，`running` 扫描随即终止；**只要本步发生过抢占，就不再接纳任何 `waiting`**。`v0.30.0` 起若失败原因指向延迟释放块（connector 尚未放回），会及时止损，避免无意义的连续抢占。
- **排入位置数 ≠ 产出 token 数**：截断会使安排量小于差额；分块 prefill 前几步只消化输入、无新输出；投机解码按实际接受数一次确认多个 token。余下预算无需强行填满，无符合条件请求时单步可远低于上限。

## 多个 DP 组怎样对齐 prefill 的节奏？

多 DP 组各自独立调度，但跨组集合通信（如 MoE EP）要求各组同步推进。如果某一组频繁混入长提示词，其余只跑 decode 的组就会反复空等。较新版本（`v0.26.0rc` 起）支持按固定步数间隔对齐 prefill：它只改变「哪一步放行 prefill」，不改变提示词长度，也不替代单步 token 预算。

这项节流并非死板的「每 N 步才接一条新请求」。在非间隔步，引擎发出暂缓信号后，调度器还要同时满足两项条件才真正延后本地 prefill：

1. 上次放行步没有留下未接纳的 `waiting` 请求；
2. 当前 `running` 中存在非 prefill 请求（如 decode）可继续推进。

条件全部成立时，**已在 `running` 中的 prefill 分块也会暂停一轮**，`waiting` 中待算位置多于 1 个的请求会挡住后续接纳。异步拉取远端 KV 的分支先处理，不受本地计算闸门拦截。

下表给出间隔为 3 时的示意：第 0 步放行后 `waiting` 清空，`running` 含正在 decode 的 A 和未完 prefill 的 P；新请求 N 在第 0 步后到达。

| 引擎步号 | 本步调度策略 | 对请求 A / P / N 的影响 |
|---|---|---|
| 0 | 放行 prefill（仍受预算与块池限制） | P 推进一段，A 正常 decode |
| 1、2 | 暂缓条件成立：仅续 decode，延后本地 prefill | A 继续生成；P 下一段与 N 首段暂停等待 |
| 3 | 再次放行 prefill，按正常队列与预算排程 | P、N 重新参与分配（不保证一步算完） |

这项节流自带四条护栏，避免错误空转：纯 prefill 负载无 decode 可续时不空转；上次放行仍有积压 `waiting` 时豁免暂缓；引擎从闲置恢复时步计数归 `0` 并立即放行；普通单组（非 DP）引擎不触发节流（自定义调度器是否响应视具体实现）。代价是部分提示词首字变晚，收益须在同一负载下实测首字与 decode 时延权衡。

## 复杂异构实战对照：GLM 双机 5 缓存组与 MTP 1+3 占位

看清标准单缓存组 `Qwen3` 的四关漏斗后，再切到例外 B 审定基线——**GLM-5.3-Flash 双机异构部署**（[部署前提](glm-5-3-flash-two-node.md#部署前提)）。调度四关的核心公式保持不变，但每步位置数、缓存组核算与预算余量都会放大；注意固定 GLM 旧控制流不含上节的 `prefill_schedule_interval`，R1 与场景 M 均沿用原配方。

### 双机 DP 组上限与异构并批动机

两台机器各是一个 DP 执行组，各跑一个 `EngineCore`、**各有一个调度器**，并各自独享 `8192` token 预算、`32` 条请求上限与一份 KV 块池（入口分派见[第 1 站 入口](one-request.md#第-1-站-入口从-http-到-node0-的引擎)，参数含义见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)）。

并批在异构 MoE 上同样为了摊薄固定开销。按 `3121f187` 配方，[每卡主要语言权重子账](glm-5-3-flash-two-node.md#每张卡上放了什么)约 `20.58 GiB`，其中路由专家占 `17.72 GiB`（约 `86%`），视觉塔、MTP 旋转矩阵与量化辅助张量另计。这是静态驻留容量估算，并非每步 HBM 实读量——注意力、稠密层与共享专家每轮必算，路由专家按实际选中参与；同时 45 层需依次执行并发起集合通信（次数见[一次前向的通信账](one-request.md#一次前向的通信账)）。

| 单 DP 组静态约束 | GLM 双机显式配置 | 对应作用 |
|---|---|---|
| token 预算 | `8192` | 封顶单步计算量与激活峰值 |
| 请求数上限 | `32` | 封顶 `running` 并发宽度 |
| 单条 decode 步长 | `4`（`1` 确定 + `3` MTP 候选） | 相对场景 M 的 `6000` 提示词差 `1500` 倍 |

### 单请求 R1：5 缓存组与 MTP `1+3` 占位

[R1](one-request.md#示例请求-r1-与官方双机部署) 是教学设定的 4 token 提示词请求，prefix caching 在本部署默认关闭（原因见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)）：

- **第 1 步（waiting → running）**：应算 4、已算 0，差 4 个位置。借块时叠加下一步 MTP 的 `3` 个 lookahead 预留，一共按 7 个位置向 **5 个缓存组**（见 [KV cache 规格](kv-cache-spec.md)）分别折算，一次借出 15 个块号（逐组算式见[第 2 站 调度](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)）。
- **后续每步（decode）**：R1 应算位置包含上步确定的 `1` 个 token 与 `3` 个 MTP 候选，差额恒为 `4`（被拒候选让已算回退，下一步差额仍为 `4`，逐圈账见[第二圈和第三圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)）。

调度器只向本组 8 个 worker 下发「本步 token 数、按缓存组分开的新借块号、待验证候选（首步为空）」，新请求另附提示词与采样参数。**算子分路与图模式完全由 worker 侧自决**：KDA 层自行区分分段 prefill 与逐位置递推（见[线性注意力](linear-attention.md#prefill-用-chunked-计算decode-逐位置推进)），且仅纯 decode 步回放图模式（见[图尺寸补齐](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)、[输入准备](prepare-inputs-flow.md)）。此外，本部署未显式配置 async scheduling，按 MTP 与多进程执行器条件推断默认开启（缺启动日志实证），前后步交错但每步排给 R1 的仍是 `4` 个位置（见 [async scheduling](async-scheduling.md)）。

### 多请求满载余量、切分门槛与高成本抢占

对照前图第 3 栏的真实比例条：单 DP 组跑满 32 条纯 decode 请求时，每条占 4 个位置，仅消耗总预算的极小比例：

$$\text{ratio}_{\text{decode}} = \frac{32 \times 4}{8192} = \frac{128}{8192} \approx 1.6\%$$

| 指标（GLM 单 DP 组纯 decode 满载） | 算式 | 数值 | 工程含义 |
|---|---|---|---|
| 本步 token 总数 | $32 \times (1 + 3)$ | **128 个 token** | 恰为本部署最大图捕获尺寸 |
| 预算占用比例 | $128 \div 8192$ | **约 1.6%** | 先撞上 32 条上限而非预算 |
| 剩余预算（若未满 32 条） | $8192 - 4 \times N_{\text{decode}}$ | 最低 **8,068**（31 条时） | 超过此长度的新提示词须分步 |

以下结论仅适用于已有 `running` 全在 decode 的场景（若 `running` 含未完 prefill 须按实际差额扣除）：

- **一步装下 vs 分步切分**：[场景 M](concurrent-requests.md#示例场景-m-与变体-m) 中 DP0 有 12 条 decode（占 `48`），新来 `6,000` token 提示词一步装下，合计 `6,048` token、13 条请求（见[场景 M 第 2 站](concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)）。换成 `20,000` token 则须分三步算完，第 3 步才出首 token（见[分几步算](concurrent-requests.md#提示词超过剩余预算时分几步算)）。本部署单条上限保持 `0`；若另设正阈值，切分门槛须重算。
- **切块不对齐 KV 逻辑块**：预算 `8,192` 并非逻辑块长 `640` 的整数倍，两者各管各的。prefix caching 关闭时 KDA 缓存模式为 `none`（不按块留档），昇腾为 `align` 模式准备的块对齐切分补丁不生效。
- **无缓存复用下的昂贵抢占**：因 prefix caching 关闭，被抢占请求无法复用前缀，提示词和已生成编号都要重算以重建包括 KDA 在内的状态（见[池子不够时](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)与[多条请求的 KV 块](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)）。

## 昇腾上跑的是哪个调度器

`vllm-ascend` 的平台补丁在启动时把上游 `Scheduler` 替换为 `BalanceScheduler`。它增加一道跨 DP 组准入闸门（默认关闭）：关着时每步直接调用 `super().schedule()` 透传回上游逻辑，因此正文所述规则即实际生效路径。开启 async scheduling 后引擎懒导入上游 `AsyncScheduler`，因其在平台补丁之后加载，按导入顺序推断其继承的是替换后的 `BalanceScheduler`，最终仍落回同一套上游逻辑（缺实跑日志确认）；开启均衡闸门后的行为见 [Balance Scheduling](balance-scheduling.md)。

昇腾各版本另提供若干可选调度器变体（默认均不开启）：

| 调度器变体 | 适用场景与约束 | 版本状态 |
|---|---|---|
| [Recompute Scheduler](recompute-scheduler.md) | 仅限 PD 分离的 decode 节点启用，混合部署直接报错 | 全四版保留 |
| `SchedulerDynamicBatch` | 按 SLO（服务等级目标，如首字或每字时延上限）动态调整 token 预算 | 仅旧基线镜像存在，后续版本已移除 |
| `ProfilingChunkScheduler` | 启动时剖析 prefill 耗时并决定分块大小 | `main` 已移除 |
| [Batch Job Aware Scheduler](batch-job-aware-scheduler.md) | 按批任务与长度层级排程（与 `short-request-first` 互斥） | `v0.30.0` / `main` 提供 |

## 常见误解

- **「prefill 和 decode 是两条代码路径」**——在调度器里不是。两者共用同一道位置减法并可混排同一步；分路发生在 worker 侧（例如 GLM 的 KDA 层区分分段 prefill 与逐位置递推，而稀疏 MLA 层整步统一处理；图模式仅覆盖纯 decode 步）。
- **「一步 8192 个 token，就是一步最多 8192 条请求」**——预算数的是位置，不是请求数。GLM 双机一步最多 32 条请求，纯 decode 满载只用 128 个位置。
- **「8192 是整套部署一步的总量」**——是单个 DP 组的预算；多 DP 部署中各组独享调度器、预算与块池。
- **「chunked prefill 要手动开」**——标准模型默认开启（生成式 encoder-decoder 除外）。关闭且单条上限为 0 时，超余量的新请求会直接阻塞后续 `waiting`；预算小于模型最大长度更会在启动校验报错。
- **「先排 running，所以正在生成的请求永远不会被卡住」**——块不足时，`fcfs` 抢占 `running` 队尾，`priority` 按优先级与到达时间挑选；被抢占者退回 `waiting` 并按缓存命中情况补算。
- **「预算没用满就是浪费，应该塞满」**——余量无需填满。纯 decode 步受请求条数与块池上限约束，本就只消耗很小比例的 token 预算。
- **「调度器决定用哪个算子、走不走图」**——不决定。调度器只交付每条请求的 token 数、新借块号与候选列表，图模式与算子选择由 worker 决定。
- **「调大预算或请求数上限，吞吐一定上去」**——不一定。预算调大会抬高启动试跑的激活峰值、挤压 KV 块池并拖慢混排步的 decode 时延；条数调大而块池不足只会加剧抢占。

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

**DP prefill 间隔。** `v0.26.0rc`、`v0.30.0` 与 `main` 上游快照均提供启动参数 `--prefill-schedule-interval`，EngineArgs / LLM 与 SchedulerConfig 字段为 prefill_schedule_interval，整数且 ≥1，默认 1，表示不施加这项间隔。比如设为 3，只改变前述 DP 节流条件；它不是单次请求参数，也不是 chunk 长度。0 不表示关闭，会在配置校验中失败。普通 EngineCore 返回不节流，DP EngineCore 根据各 rank 对齐的 step_counter 判定，并在普通 step 与批次队列两条执行路径传给 Scheduler；使用 Ascend 的其他调度器时，仍须核对应版本是否传递和消费该信号。

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
- 来源 59–61：`v0.30.0`（及历史候选快照）的延迟释放抢占检查、阈值字段和完整输入容量准入。
- 来源 62–72：`v0.30.0`（及历史候选快照）参数与异步判定，Ascend 显存查询、BalanceScheduler 的关闭路径及 batch-job 选类；v0.26 的 Mamba KV producer 临时查找行为也在此组。
- 来源 73–88、93–96：`v0.26`、`v0.30.0`（及历史候选快照）与 `main` 的 prefill 间隔参数、EngineCore 传递、DP 节拍、运行请求与新请求的节流分支，以及容量受限标记的更新。
- 来源 89–92：GLM 稀疏 MLA 包装到 SFA 的实际调用和输入处理；KDA 的两条执行路径见来源 33–34。
- 来源 97–102：`v0.30.0` / `main` 的输入容量初值与运行请求的草拟槽位扣减；新请求的容量检查见来源 86、95，两种预算不能混算。
- 来源 103–105：历史 `main` 的 short-request 与 profiling 组合限制、profiling/batch-job 选类顺序，以及 `v0.30.0` 的 profiling 异步 MRV2 门槛。
- `v0.30.0`（`ced6857a` / `c09d3e20`）与 `main`（`ba15685a` / `8d6180e2`）核心入口见文首 `sources` 末尾 9 条（`scheduler.py`、`config/scheduler.py`、`patch_balance_schedule.py`、`platform.py`）。
