---
id: chunked-prefill
title: Chunked prefill：长提示词分几步算完，正在生成的请求不被卡住
type: feature
summary: >-
  Chunked prefill
  让调度器在一条长提示词装不下本步剩余预算时，只排预算容得下的那一段、下一步从断点续算，历史与递推状态跨段延续，仅最后一段产出首个输出
  token；它保护同批 decode 请求不被长提示词卡住，代价是长请求首字更晚与前缀历史重复读取。
aliases:
  - Chunked Prefill
  - 分块预填充
  - 分块 Prefill
chapters:
  - '03'
sources:
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L352'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L401-L410'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L678-L700'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L997-L1019'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L70-L90'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L238-L272'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2370-L2394'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2258-L2267'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2518-L2528'
  - 'vllm@0fc695fc:vllm/config/model.py#L1803-L1811'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L263'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L293-L338'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L9-L57'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L858-L867'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1078-L1099'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1444-L1470'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2631-L2671'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L398-L474'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L477-L498'
  - 'vllm@0fc695fc:docs/configuration/optimization.md#L41-L62'
  - 'vllm@0fc695fc:vllm/model_executor/models/config.py#L371-L374'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L713-L718'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L463-L467'
  - 'vllm@568afb3a:vllm/config/scheduler.py#L153-L156'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L1026-L1076'
  - 'vllm@84030bbe:vllm/config/speculative.py#L1811-L1850'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L186-L188'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1327-L1350'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L222-L225'
  - 'https://arxiv.org/abs/2308.16369'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1396-L1433'
  - 'raw:sha256-ab8d477aec6bfdfa592d8282eafcfa581f0abbd5f9a7f08e30f386f9a7864ecd.md#L1-L725'
  - 'vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/core/sched/scheduler.py#L689-L699'
  - 'vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/engine/arg_utils.py#L2370-L2377'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2794-L2816'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L70-L74'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L185-L194'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1067-L1075'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L38-L38'
  - 'vllm@568afb3a:vllm/v1/engine/core.py#L2015-L2022'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L463-L500'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L828-L835'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L1059-L1062'
  - 'vllm@84030bbe:vllm/v1/engine/core.py#L2171-L2178'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L606-L645'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L1021-L1029'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L1289-L1294'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2631-L2731'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2569-L2582'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L239-L310'
  - 'vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L249-L283'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L259-L290'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L448-L501'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L767-L793'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1121-L1132'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L561-L665'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1066-L1085'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1520-L1545'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2705-L2760'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L287-L315'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L231-L245'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1075-L1115'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L712-L736'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L816-L828'
  - 'vllm-ascend@c09d3e20:vllm_ascend/core/scheduler_profiling_chunk.py#L107-L115'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1479-L1488'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1706-L1734'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1482-L1553'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/batch_invariance.md#L186-L192'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L196-L208'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/pipeline_parallel.md#L180-L257'
  - 'vllm@ced6857a:vllm/distributed/utils.py#L127-L160'
  - 'vllm@ba15685a:vllm/v1/core/sched/scheduler.py#L776-L792'
  - 'vllm@ba15685a:vllm/config/scheduler.py#L91-L96'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1585-L1601'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/attn_utils.py#L719-L750'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/batch_invariance.md#L186-L192'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: prefill
    kind: variant-of
    note: 同一条请求的 prefill 分到几步做，只有最后一段产出首个 token
  - to: continuous-batching
    kind: builds-on
    note: 复用 waiting 与 running 两队列及单步进度差公式，把长提示词余量拼进同轮迭代混跑
  - to: paged-attention
    kind: builds-on
    note: 前序段落算出的 KV 按分页块留在显存，后续分块直接跨段读取而无需事后拼接结果
  - to: block-table
    kind: builds-on
    note: 分块切点不必对齐物理块边界，执行侧按步前已算进度编位置号并查块表定位写入槽位
  - to: pd-disaggregation
    kind: alternative-to
    note: 分块把混进同一步的 prefill 压在预算内；PD 分离让 prefill 与 decode 不在同一步执行
contradicts: []
updated: '2026-11-18'
origin: gap
rawSources:
  - raw/sha256-a784826e7872c29e9344402dd0c34d9437753b13b503dd7eb663ea72c2414099.md
  - raw/sha256-ab8d477aec6bfdfa592d8282eafcfa581f0abbd5f9a7f08e30f386f9a7864ecd.md
---

## 一条很长的提示词，能不能分几步算完？

**chunked prefill（分块预填充）是调度器处理长提示词的方式：一条提示词在这一步装不下时，只给它排这一步剩下的预算那么多个位置，先算前一段、把这一段的历史存好，下一步从断开的位置接着算，直到整段提示词算完，才选出回答的第一个 token。**

prefill 是处理提示词、建立后续计算所需历史的阶段，可以经过一步或多步；处理到最后一个提示词位置后，选出回答的第一个 token。之后进入 decode，普通路径逐个推进，投机路径可以一轮验证多个候选，区别见 [Prefill 与 Decode](prefill.md#回答的第一个字出来之前模型在算什么)。「一步」是模型对一批请求做的一次前向；一步的位置预算由调度器封顶，为什么按位置而非请求条数算，见 [连续批处理](continuous-batching.md) 与 [调度器](vllm-scheduler.md#为什么按-token-设预算还要另设请求数上限)。

下面用与后文冻结 3D 场景绑定的示意数走一遍。假设每步最多算 `8` 个位置。`A`、`B` 两条请求已经在生成回答，每步各算 `1` 个位置；这时来了一条新请求 `C`，提示词有 `14` 个 token，占位置 `0–13`。

```wiki-diagram
file: chunked-prefill
```

- **每一步先照顾 A、B。** 它们各拿 `1` 个，`8` 个里还剩 `6` 个，全给 `C`。
- **C 的 14 个位置分三步算完。** 第 1 步算位置 `0–5`，第 2 步算 `6–11`，第 3 步算 `12–13`。三段不是三份各自独立的提示词：第 2 段从位置 `6` 接着编号，并读第 1 段存下的历史。
- **只有最后一段产出回答。** 每一步末尾，模型都会在 `C` 本步最后一个位置上选一个 token，但前两步提示词还没读完，选出来的不作为请求输出；第 3 步算完位置 `13`，选出的 `y₀` 才是 `C` 的第一个输出 token。
- **第 4 步起 C 也转入 decode。** 它送进 `y₀`，和 `A`、`B` 一样每步 `1` 个位置。
- **A、B 一步也没停。** 这 4 步里它们每步都前进 `1` 个位置。

## 为什么要切：不切的话，一步会被一条长提示词撑大

在单条请求上限保持默认的示意场景中，关闭分块后，一条提示词必须一步算完。要让 `C` 进得来，每步的预算就得开到装得下整段提示词（真实部署里要装得下允许的最长输入 `max_model_len`），`C` 进来的那一步就被撑大了：

$$N_{\text{不切}} = 1 + 1 + 14 = 16\text{ 个位置}, \qquad N_{\text{切开}} = 1 + 1 + 6 = 8\text{ 个位置}$$

| 调度方式（示意：A、B 各占 `1` 个位置，C 提示词 `14` 个位置） | C 进场那一步的位置账 | 对同批 A、B 输出间隔（ITL）的影响 |
| --- | --- | --- |
| **不切（C 一步算完）** | `1 + 1 + 14 = 16` 个位置 | A、B 各只差 `1` 个位置，也必须等这 `16` 个位置整步算完才拿到下一个 token |
| **切开（每步最多 `8` 个位置）** | `1 + 1 + 6 = 8` 个位置 | 长提示词工作量摊入 3 步，每步最多 `8` 个位置，A、B 每步照常推进 |

同一步里的请求是一起算完、一起拿结果的。提示词越长，不切的那一步就越大：一条几万 token 的提示词，会让正在流式生成的请求在这一步上明显卡顿。衡量这种相邻两个输出 token 时间间隔的指标叫 **ITL**（inter-token latency）。

分块还带来第二个好处：**每一步都能把 decode 和一段提示词拼在同一批里做前向**，增加权重复用和分摊算子下发开销的机会。decode 每条请求的新位置少，提示词块常包含较多位置，合批后多行输入共用同一张权重矩阵；实际访存量与加速幅度取决于缓存命中、内核分块和批次形状，理想复用模型见 [Prefill 与 Decode](prefill.md#为什么把已知的位置合成一步代价在哪)。

关闭分块且单条上限保持默认 `0` 时，还有一处排队阻塞：只要队首那条新请求整段装不下本步余量，调度器这一步便直接停止接纳后续等待请求，排在它后面的短请求也只能跟着干等。注意预算封住的是**一步算多少个位置**，不是一步花多少毫秒；每步实际耗时还取决于模型结构、历史长度、同批并发与跨卡通信。

## 代价在哪：首个 token 更晚，旧历史要再读几遍

把长提示词切开不是白来的，代价集中在三处：

1. **C 的第一个 token 要等三步（拉长 TTFT）。** 不切时，`C` 在进场那一步末尾就拿到 `y₀`；切开后前两步都只在读提示词，从请求到达到首个输出 token 的耗时（**TTFT**，time to first token）随之拉长。调参时须先看瓶颈在哪：只有在剩余预算实际构成截断上限（未被单条上限 `--long-prefill-token-threshold` 或 KV 块余量先行卡住）时，调小预算才会缩小单步分块，调大预算才给单步留出更多 prefill 空间。由于相同位置数在不同历史长度与通信负载下耗时不同，TTFT、ITL 与吞吐须在目标负载下联合实测，并同时观察长短请求的分位分布。
2. **后面的块仍要重访前面的可见历史。** 对保留全部因果历史的普通注意力，各位置要读取自己与前序位置的 K、V（存放在 [KV cache](kv-cache.md) 与分页块池 [PagedAttention](paged-attention.md) 中）。第 2 段依赖第 1 段，第 3 段依赖前两段。假设每个调度块内充分复用、每段可见历史只计一次（比较逻辑覆盖范围，非实际 HBM 读取次数），因果打分总对数仍保持 $\sum_{i=1}^{14} i = 105$ 对不变，但跨步重复覆盖的前序历史范围显著扩大：

| 统计项（示意，普通因果注意力） | 不切（1 步算完） | 按 `6、6、2` 切成三段 | 因果与访存含义 |
| --- | --- | --- | --- |
| **可见历史范围分别计一次** | `14` 个位置 | $6 + 12 + 14 = 32$ 个位置 | 增加跨段重复覆盖的前序历史范围（实际 HBM 读量取决于内核分块与缓存复用） |
| **因果打分的位置对总数** | $1 + 2 + \dots + 14 = 105$ 对 | `105` 对 | 位置 $i$ 始终只和 $0 \dots i$ 打分，分块不删减因果计算量 |

3. **每一步都多一点步间杂活。** 步数变多后，调度与输入准备每步都要多跑一次；前两步末尾还会在 `C` 本段最后一个位置上白做一次词表投影和采样并丢弃结果（白做的只是这 1 个位置，不是整段前向重跑）。

## 怎么切：每一步都是同一道减法

调度器里没有一个单独的「切块模式」。它对每条请求只记两个数：应该算到第几个位置、已经算到第几个位置，两者之差就是还差几个。每一步先续已经在跑的请求（`running` 列表），再用剩下的预算接纳刚到的请求（`waiting` 队列），对每条请求做同一道减法——本步排给它的位置数，取「还差几个」与「剩余预算」中较小的那个（两队列完整细节见[调度器](vllm-scheduler.md#调度器怎样排一步还差几个--截断--借块--记账)）：

$$\Delta n = \min(\text{应算总位置数} - \text{已算位置数},\ \text{剩余预算})$$

按剩余预算截断长提示词以允许分块为前提：关闭分块时，如果 `waiting` 请求经过单条上限截断后的位置数仍超过剩余预算，调度器会退出 `waiting` 接纳循环；允许分块时，才先排入预算容得下的部分，差不完的余数自然留到下一步。对照示意数（每步总预算 `8`，`A`、`B` 先扣 `2` 个，剩 `6` 个），`C` 的 `14` 个位置按 `6、6、2` 切成三步：

| 步序 | 步前已算与待补差额 | 本步分配算式 | 步末已算数与预算余量 |
| --- | --- | --- | --- |
| **第 1 步**（从 `waiting` 接纳） | 已算 `0`，还差 $14 - 0 = 14$ | $\min(14 - 0,\ 8 - 2) = 6$（算位置 `0–5`） | 已算推至 `6`；整步用满 `8` |
| **第 2 步**（留在 `running` 续跑） | 已算 `6`，还差 $14 - 6 = 8$ | $\min(14 - 6,\ 8 - 2) = 6$（算位置 `6–11`） | 已算推至 `12`；整步用满 `8` |
| **第 3 步**（在 `running` 收尾） | 已算 `12`，还差 $14 - 12 = 2$ | $\min(14 - 12,\ 8 - 2) = 2$（算位置 `12–13`） | 已算推至 `14` 选出 `y₀`；整步只用 `4`，余下 `4` 可排别的新请求或空着 |

下面的精简伪代码省略了前缀缓存命中、异步输出占位与借块回退，集中展示 `running` 先续跑、`waiting` 后接纳的截断顺序差异，以及「先用步前进度生成计划，排完本步再统一前推已算数」的记账时机（`num_tokens_with_spec` 含已生成词与投机草稿候选，无草稿时即等于 `num_tokens`）：

```python
scheduled = []  # (req, 步前已算位置, 本步排入位置数)
for req in running:  # 1. 先续已在 running 里的请求（含未算完的提示词续段）
    need = req.num_tokens_with_spec - req.num_computed_tokens
    if 0 < long_prefill_token_threshold < need:
        need = long_prefill_token_threshold
    n = min(need, token_budget)
    token_budget -= n
    scheduled.append((req, req.num_computed_tokens, n))

for req in waiting:  # 2. 再用剩余 token_budget 接纳 waiting 新请求
    need = req.num_tokens - req.num_computed_tokens
    if 0 < long_prefill_token_threshold < need:
        need = long_prefill_token_threshold
    if not enable_chunked_prefill and need > token_budget:
        break  # 关闭分块且截后仍超余量时，直接停止本步 waiting 接纳
    n = min(need, token_budget)
    token_budget -= n
    scheduled.append((req, req.num_computed_tokens, n))

for req, _, n in scheduled:  # 3. 统一在步末前推已算数（_update_after_schedule）
    req.num_computed_tokens += n
    req.is_prefill_chunk = req.num_computed_tokens < req.num_tokens
```

第 1 步 `C` 排进批次后就转入 `running`，第 2、3 步与 `A`、`B` 一起优先续跑；调度器不等模型前向跑完，就先把 `C` 的已算数按 `0 → 6 → 12 → 14` 往前推，并标记提示词是否尚未算完。这份安排交给执行侧以后，一段提示词在一步内依次走过主线七站（见[一条请求](one-request.md#一条请求要走过七站)）里的第 2 到第 5 站：

```wiki-diagram
file: chunked-prefill-flow
```

1. **第 2 站 调度。** 定下这一段排几个位置，已算数立即前推并标记 `is_prefill_chunk`。
2. **第 3 站 准备输入。** 执行侧从**本步开始前的已算数**编位置号，而不是用调度器刚推到的步末值：第 2 段位置号是 `6、7……11`，不从 `0` 重来。每个位置写往哪一格由请求的 [block table](block-table.md)（块表：记录请求借到了哪几个物理 KV 块）查出；在本例各 prefill 段长度大于 `1` 的情形下，混批或续段整批贴 `ChunkedPrefill` 执行标签，表示「有一部分历史已在缓存里」（拼批细节见[输入准备](prepare-inputs-flow.md)）。
3. **第 4 站 前向。** 普通注意力读前面各段存下的历史与本段新算的 K、V；线性注意力从上一段留下的状态接着推；本段新增历史写进槽位指定的地址。
4. **第 5 站 采样。** 每条请求都在自己本步最后一个位置选一个 token。`C` 的提示词还没算完时，这个 token 丢掉，下一步回到调度续排；算完了，选出的就是第一个输出 token `y₀`，下一步起 `C` 按 decode 排。

下面把 A、B、C 放到同一条调度时间轴上。虚线浅色格是已排入的计划，实色格是执行完成的位置；下方保留 C 已建立的历史。列宽只划分调度步，不表示每步耗时相等。

```wiki-scene
inference-mechanism:7
```

## 历史状态必须跨段延续

切成几段听上去像事后要把几段结果「拼起来」，其实根本没有拼接这一步。分块保持提示词原有位置顺序，后一段直接依赖前序已建好的历史，靠三样东西严丝合缝接上：

- **位置号接得上。** 第 2 段从位置 `6` 开始编，[因果掩码](attention-qkv.md#因果掩码限定每个位置能访问的历史)（每个位置只能看自己和前面的位置）照常生效：位置 `6` 看得到 `0–6`，位置 `11` 看得到 `0–11`。分段既不改位置编号，也不改因果依赖关系，算出的结果与一步算完一致。
- **历史接得上（保存形态随模型结构而异）。** 普通注意力保存供后续位置读取的逐位置 K、V 表示：第 1 段写进 KV cache 的内容原样留着，第 2 段只追加新位置并把旧历史读进来。[线性注意力](linear-attention.md)（每条请求只维护一份固定大小的递推状态，随新位置到来原地更新以汇总此前历史）不存逐位置 K、V：分段时读入上一段算完的状态作为初始状态，本段算完再写回最终状态，不能把「存好历史」一概理解为保存逐位置的 K 和 V。
- **请求之间互不干扰。** `A`、`B`、`C` 在同一步里一维紧致合批前向，但各自使用独立的位置号、各自的块表与状态槽；`A` 的 decode 读 `A` 的历史，`C` 的分块读 `C` 的历史。

丢弃采样只针对本步结束后已算数还没追上提示词长度的请求：这次选出的 token 既不追加到请求输出，也不返回客户端；若请求携带了随机种子，随机数生成器偏移量还会往回拨，避免白采样打乱后续真正的生成采样。

## 细节：切点、单条上限和关掉分块

- **切点不看 KV 块的边界。** token 预算管一步算多少个位置，KV 块大小管历史按多大一格存、怎样寻址；即使两者数值相等，含义也不同。调度器按预算切分，一段可以停在物理块中间，下一段接着往同一块的剩余槽位写。
  - **边界与例外（混合模型 `align` 模式）**：只有混合模型开启 [prefix caching](prefix-caching.md)（开头相同的请求复用历史）、又不支持逐块保存线性注意力状态而回退到 `align` 模式时，调度器才把每段向下取整到块长整数倍（最后不足一块的尾巴照常算）。同时要区分物理分格与完整状态边界：GLM-Next 补丁允许混合缓存中最小物理块对应 `4` 个 token，但完整递推状态的可缓存边界取调度器公共边界 `self.block_size`，不能由 `4` 推出每 `4` 个位置都能存档。
- **单条请求一步的上限（`--long-prefill-token-threshold`）。** 该参数限制单条请求在一步里最多拿多少位置，默认 `0`（不限）；它在剩余预算之前先截一刀，`running` 和 `waiting` 两边都生效。假如在首屏示意里设成 `4`，`C` 会按 `4、4、4、2` 分四步算完，前三步各给其他新请求留出 `2` 个位置，代价是 `C` 的首个输出 token 再晚一步。
- **关掉分块。** 用户未显式传参时，框架按模型是否支持分块自动决定（pooling 请求需单独查配置，不直接套用生成模型默认）。手动关闭且单条上限为默认 `0` 时，一条比余量长的新请求排不进来，本步立即停止接纳后续等待请求。关闭分块还要求每步预算不小于 `max_model_len`，否则启动报错；生成式模型手动关闭分块时上游还会打印警告，提示可能引发崩溃或输出错误。
  - **边界与例外（关分块叠正单条上限）**：在 `v0.23.0`–`v0.30.0` 中，代码先按 `--long-prefill-token-threshold` 截断再检查分块开关；若首段截后装得进余量而原请求未完，后续进入 `running` 仍会继续分段。社区 `main` 已改为关闭分块时直接忽略单条上限（见 [Scheduler 参数参考](vllm-scheduler.md#怎么开)）。
- **每步实际切多少，不只看预算。** 在跑请求数、空闲 KV 块余量、已算进度、为[投机解码](speculative-decoding.md)预留的位置以及块不够时的抢占，都会改变某一步实际分给长提示词的额度。首屏 `6、6、2` 只是便于手算的定常算例，不代表默认策略对多条长请求公平。
- **昇腾自带的扩展变体。** `vllm-ascend` 还提供按耗时画像动态切块的 `ProfilingChunkScheduler`、按批量作业水位控准入的调度器等扩展（见[昇腾上跑的是哪个调度器](vllm-scheduler.md#昇腾上跑的是哪个调度器)与 [profiling chunk 配置](../params/profiling-chunk-config.md)），未显式开启时默认不接管。

## 落到标准部署：Qwen3-8B 在 2048 预算下怎样切开 6,000 词？

在 `v0.30.0` 通用昇腾部署（`vllm@ced6857a` + `vllm-ascend@c09d3e20`）中，以单卡 **`Qwen3-8B`**（无投机解码，单组标准 GQA，`block_size = 128`）运行在线 `vllm serve` 为例，默认单步预算为 **`max_num_batched_tokens = 2048`**。

假设此时 `running` 队列里已有 `2` 条正在 decode 的请求，每条每步只占 `1` 个位置（无投机候选，共占 `2` 格）。这时新来一条 `6,000` token 的长提示词：每步可供它使用的剩余预算为 $2048 - 2 = 2046$ 个位置，于是整段提示词干净地拆成 `3` 步算完，**仅在最后一段产出首个输出 token `y₀`**：

| 步序（`Qwen3-8B`，总预算 `2048`） | `2` 条 decode 占用 | 新提示词本步排入 | 步末累计已算与 KV 块（`128` 词/块） | 本步末状态与产出 |
| --- | --- | --- | --- | --- |
| **第 1 步** | `2` | `2,046`（位置 `0–2045`） | `2,046 / 6,000`；累计借 `16` 块 | prefill 未完，段末采样丢弃 |
| **第 2 步** | `2` | `2,046`（位置 `2046–4091`） | `4,092 / 6,000`；累计借 `32` 块 | prefill 未完，段末采样丢弃 |
| **第 3 步** | `2` | `1,908`（位置 `4092–5999`） | `6,000 / 6,000`；累计借 `47` 块 | prefill 算完，产出首个输出 `y₀`；余 `138` 预算 |
| **第 4 步** | `2` | `1`（送入 `y₀`） | `6,001`；仍占 `47` 块 | 转入 decode，与前 `2` 条同批推进 |

把这笔账和物理块池对照，可以直观印证两点：
- **切点直接落在物理块中间。** `2,046 = 15 × 128 + 126`：第 1 段停在第 `15` 个逻辑块的第 `126` 格，第 2 段从同一块剩下的 `2` 格接着写，填满后再借第 `16` 块。
- **单组 GQA 的借块单调平滑、没有临时尖峰。** `Qwen3-8B` 每块占 `18 MiB`，三步分别累计占用 `16 → 32 → 47` 块（共 `846 MiB`），不会像后文的混合模型那样因索引器尾状态出现上千块的单步尖峰。

### v0.30.0 通用预算博弈：2048 默认值、投机扣额与并行耦合

在 `v0.30.0` 标准昇腾部署中，`max_num_batched_tokens` 从命令行解析到单步扣减，共有四条直接影响分块粒度的耦合链路（完整求值树见 [核心 CLI 参数](core-cli-params.md)）：

```wiki-diagram
file: chunked-prefill-fig-budget-game
```

1. **为什么昇腾 `vllm serve` 默认预算只有 `2048`？** 上游 `EngineArgs.get_batch_defaults` 按设备总显存分档给默认值，$\ge 70\text{ GiB}$ 在线默认本应给 `8192`。但参数解析时 Worker 尚未初始化 `torch_npu`，`NPUPlatform.get_device_total_memory()` 主动抛 `NotImplementedError`，外层回落到 `device_memory = 0` 分支。因此在线 `vllm serve` 默认落到 `max_num_batched_tokens = 2048`、`max_num_seqs = 256`（离线 `LLM` 类默认 `8192` / `256`）。传入 `--performance-mode throughput` 会把未显式指定的两者翻倍；外部启动器若提前初始化了 `torch_npu`，以启动日志实际打印值为准。
2. **`running` 先扣 `1` 或 `1 + K` 个投机槽位。** V1 `Scheduler.schedule` 将单步 `token_budget` 初始化为 `max_num_scheduled_tokens`。它先遍历 `running`，为每条在跑 decode 请求扣除 $1 + K$ 个位置（$K$ 为投机草稿数 `num_spec_tokens`，普通解码 $K = 0$）。剩余预算才切给续跑或新入场的长提示词：高并发或大草稿数会压缩每步分块长度，迫使长文跨更多步并拉长 TTFT。
3. **`SP + PCP > 1` 向上取整（打印 `warning_once`）。** 当开启 Prefill Context Parallelism（`prefill_context_parallel_size > 1`）且序列并行（SP）生效时，`AscendConfig` 需要让各 `tp × pcp` 分片切得均等。它会按 $\lceil B / (\text{tp} \times \text{pcp})\rceil \times (\text{tp} \times \text{pcp})$ 向上取整 `max_num_batched_tokens`，并通过 `logger.warning_once` 显式打印调整值，并非静默改写。
4. **`PP > 1` 与 `CPP` 允许把预算放宽 `2~4×`（先下钳 `min_chunk`，再走 `SP + PCP` 取整）。** 开启[流水线并行](pipeline-parallel.md)（`PP > 1`）后，`get_pp_indices` 将层权重与 KV 拆到不同阶段，非末级阶段省去 `lm_head` 与大词表 logits 峰值，单卡可承受更大的预算。若在 `PP > 1` 下进一步开启[动态分块流水线 CPP](dynamic-chunked-pp.md)（`profiling_chunk_config`，与 `enable_balance_scheduling`、`dyntra_lb_config` 互斥），`AscendConfig` 会**先于** `SP + PCP` 取整检查初始预算。若预算小于 `min_chunk`，代码显式打印 `logger.warning` 并将 `min_chunk` 下钳至该预算值。运行期再以最终预算作为二次耗时曲线 $f(l)=al^2+bl+c$ 的首块基准求解等耗时分块；官方调优指南建议把预算设为固定分块的 `2~4` 倍（该特性已在社区 `main` 移除）。

## 异构旗舰对照：GLM 双机与投机步下的分块账

下面转入例外 B 历史绑定算例——**GLM-5.3-Flash 官方双机**（钉住 `vllm@0fc695fc + vllm-ascend@db701c1f`，完整前提见[部署页](glm-5-3-flash-two-node.md#部署前提)）。与上面的 `Qwen3-8B` 单组标准路径不同，这里同时叠加三项异构变量：显式放宽预算至 `8192`、每条 decode 叠加 MTP 投机解码（`1 + 3 = 4` 个位置/步），以及 5 缓存组里索引器尾状态组的临时借块尖峰。

### 放到 GLM 双机：20,000 个 token 的提示词分三步

两台机器各是一个 DP 组（各自独立排请求的执行组），各有一个调度器。每组显式配置每步预算 `8192` 个位置、最多 `32` 条请求（见[调度器的 GLM 一节](vllm-scheduler.md#放到-glm-双机一个-dp-组里的-r1)），chunked prefill 按默认开着。每条 decode 请求一步算 `4` 个位置：`1` 个确定的 token，加 `3` 个 MTP 候选（MTP 是 GLM 自带的多 token 预测层，每步草拟 `3` 个候选，下一步由主模型一起验证）。

因此新提示词比 `8192 − 4 × 在跑条数` 还长才会被切；新请求能进场时，这个触发门槛最低是 `8068`，推导见[并发页](concurrent-requests.md#提示词超过剩余预算时分几步算)。主线的示例请求 [R1](one-request.md#示例请求-r1-与官方双机部署) 提示词只有 `4` 个 token（教学设定），[场景 M](concurrent-requests.md#示例场景-m-与变体-m)（一个 DP 组里已有 `12` 条请求在 decode，又来一条 `6000` token 的新请求）的新提示词也一步装得下，它们都用不上分块。

把场景 M 的新请求换成一条 `20,000` token 的提示词：前两步各算 `8144` 个位置、把预算用满，第 3 步算最后 `3712` 个，本步末得到第一个输出 token `y₀`，第 4 步起它也每步 `4` 个（逐步预算账见[并发页](concurrent-requests.md#提示词超过剩余预算时分几步算)）。那 `12` 条 decode 请求在这 4 步里每步都照常前进——这里的「照常前进」指每轮都获得调度计算，不表示它们的输出时间间隔保持不变：

| 步序（DP0，总预算 `8192`） | `12` 条 decode 占用 | 新提示词本步排入 | 步末累计已算 | 本步末状态与产出 |
| --- | --- | --- | --- | --- |
| **第 1 步** | `12 × 4 = 48` | `8,144`（位置 `0–8143`） | `8,144 / 20,000` | prefill 未完，段末采样丢弃 |
| **第 2 步** | `12 × 4 = 48` | `8,144`（位置 `8144–16287`） | `16,288 / 20,000` | prefill 未完，段末采样丢弃 |
| **第 3 步** | `12 × 4 = 48` | `3,712`（位置 `16288–19999`） | `20,000 / 20,000` | prefill 算完，产出首个输出 token `y₀` |
| **第 4 步** | `12 × 4 = 48` | `4`（`y₀` + `3` 个 MTP 候选） | `20,004` | 转入 decode，与前 `12` 条同批推进 |

执行侧，这三步和纯 decode 步有四处关键不同：

- **不回放图，MoE 通信换路径。** 这几步整批贴 `ChunkedPrefill` 标签，走 eager mode（由 CPU 逐个下发算子），不回放录好的 decode 图；一步超过 `128` 个 token，MoE 层（每个 token 只挑几个专家来算）的通信改走 `AllGather`（两台机器先互相收齐本步全部 token 的隐藏向量，每张卡再挑出路由给自己专家的那些），两台机器一起切换，见[并发页的 MoE 通信](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)。
- **34 层 KDA 接着上一段的状态算。** KDA 是 GLM 的线性注意力层，每条请求只存一份固定大小的状态。每一段在 KDA 算子内部还会再切成每 `64` 个位置一小段并行算，那是算子自己的内部算法，和调度器跨步分块是两回事，见[线性注意力](linear-attention.md#prefill-用-chunked-计算decode-逐位置推进)。
- **11 层稀疏 MLA 在前面全部位置里挑着读。** 稀疏 MLA 是 GLM 的另一类注意力层，每个查询只挑一部分历史位置来读。第 2 段的查询面前已有 `8,144` 个以上位置：indexer（轻量打分网络）先给因果范围内的历史打分，主注意力只读挑中的那部分，清单每行最多 `2,051` 个位置，真实读取量不是「各段历史长度之和」，见[稀疏注意力](sparse-attention.md#放到-glm-双机一个查询在一层稀疏-mla-里怎样挑怎样读)。
- **切点不对齐到块。** 一个逻辑块是 `640` 个位置，$8144 = 12 \times 640 + 464$，第 2 段从第 `13` 块的第 `465` 格接着写。本部署关着 prefix caching，KDA 缓存不按块存档，调度器无需对齐切分，昇腾为按块对齐准备的 GLM 补丁在本部署不生效；开启 prefix caching 后的变化见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)。

分块还决定了每一步要借多少 KV 块。GLM 的块分 5 个缓存组（存储格式和借块规则相同的一组层）：full 组存稀疏 MLA 和 indexer 的逐位置历史，每 `640` 个位置一块；三个 KDA 组每组固定 `4` 块（合计常驻 `12` 块）；尾状态组暂存 indexer 还没凑满 `4` 个的位置，窗口和块都是 `4` 个位置，见[块分配](vllm-kv-block-allocation.md#kda-组和尾状态组借法和普通注意力不同)。每一步借块时还要为下一步的 `3` 个 MTP 候选多预留 `3` 个位置（尾状态组手里持有量等于「累计借过的块数减去窗口外已归还的块数」）：

$$b_{\text{full}}(L) = \lceil (L + 3) / 640 \rceil, \qquad b_{\text{tail}}(L_{\text{prev}}, L) = \lceil (L + 3) / 4 \rceil - \lfloor \max(0, L_{\text{prev}} - 3) / 4 \rfloor$$

| 步序（DP0，单条 `20,000` token 请求，KDA 三组始终 `12` 块） | full 组当步新借与累计持有 | 尾状态组当步手里持有块数 |
| --- | --- | --- |
| **第 1 步**（步末已算 `8,144`） | $\lceil (8144 + 3) / 640 \rceil = 13$ 块（累计 `13` 块） | $\lceil 8147 / 4 \rceil - 0 = 2,037$ 块 |
| **第 2 步**（步末已算 `16,288`） | $\lceil (16288 + 3) / 640 \rceil - 13 = 13$ 块（累计 `26` 块） | $\lceil 16291 / 4 \rceil - \lfloor 8141 / 4 \rfloor = 2,038$ 块 |
| **第 3 步**（步末已算 `20,000`） | $\lceil (20000 + 3) / 640 \rceil - 26 = 6$ 块（累计 `32` 块） | $\lceil 20003 / 4 \rceil - \lfloor 16285 / 4 \rfloor = 930$ 块 |

尾状态组的尖峰最扎眼：它要为本步全部新位置留格子，一段 `8,144` 个位置当步就借 `2,037` 块。按每块 `7.969 MiB` 折合约 `15.9 GiB`，占这个 DP 组 `3,855` 块池子（预算算例，见[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)）的一半多，比 full 组的 `13` 块大两个数量级。

下一步已算数追上来后，窗口外的整块立刻归还。第 3 段只有 `3,712` 个位置，持有量回落到 `930` 块；第 4 步进入 decode 后回到 `3` 块，此后在 `3–4` 块之间波动。可见在这套混合部署上，每段切多长不只影响单步计算量，还直接决定当步临时占池峰值。以上均为源码静态推导账，本页没有 GLM 双机上开关分块或调预算的硬件实测数；无设备时可按上述算式复算每步预算与已算位置，并沿[输入准备](prepare-inputs-flow.md)核对每段起始位置号与所读历史。

## 常见误解

```wiki-diagram
file: chunked-prefill-fig-myths
```

- **「chunked prefill 是要手动打开的优化」**——默认开着。用户未显式设置开关时，框架按模型是否支持分块来决定；生成式 encoder-decoder（编码器先处理输入、解码器再生成输出的结构）返回不支持，因此不能概括成所有生成式模型都默认开启。每步预算与单条上限管开启后怎样切分，是否开启由开关与模型支持条件共同决定。
- **「切开以后总计算量变少了」**——没有变少。因果打分的位置对切不切都一样多，还多了重复读旧历史和每步的调度采样杂活；它换来的是单步工作量封顶。
- **「每一段都会吐出一个 token」**——只有最后一段产出首个输出 token `y₀`。中间几段虽然也会采样，但结果被直接丢弃，不追加到请求输出。
- **「后一段要把前几段的结果拼起来」**——没有拼接这一步。后一段从下一个位置号接着算，直接读前面存下的 KV 历史或递推状态。
- **「关掉它，正在生成的请求就不会被 prefill 拖慢」**——恰恰相反。关掉后每步预算必须开到装得下最长输入，单步涌入的位置只会更多；真正让 prefill 与 decode 不挤在同一步的做法是把两者拆到不同节点，即 [PD 分离](pd-disaggregation.md)。
- **「每一段正好是一个 KV 块，或者预算限制了 `max_model_len`」**——单步预算既不等于物理块长（GLM 双机一段 `8,144` 个位置、逻辑块 `640` 个位置，切点落在块中间），在开启分块时也不限制 `max_model_len`（默认 `2048` 预算照常跨多步跑完几万词长文）。
- **「KDA 的 64 位置分段就是 chunked prefill」**——不是。那是一步之内 KDA 算子重排计算的方式；chunked prefill 是调度器把一条提示词拆到多个引擎步里。
- **「每步设了固定位置预算，每步时延就有了固定毫秒上限，且多条长单会自动均分预算」**——预算封住的是位置数而非毫秒；且默认 `--long-prefill-token-threshold=0` 时先入 `running` 的长请求会吃满余量，需显式设正阈值才会截断单条配额。

## 对照源码

钉点说明：全站默认主基线 `v0.30.0` 为 vLLM `ced6857a` + Ascend `c09d3e20`；社区 `main` 为 vLLM `ba15685a` + Ascend `8d6180e2`（含阶段一归档对照 `84030bbe` / `baa023ad`）；`v0.26.0rc` 为 vLLM `568afb3a` + Ascend `2ed6cbba`；`v0.23.0` 为 vLLM `0fc695fc` + Ascend `2c59ff10`；**本页历史 GLM-5.3-Flash 双机算例遵守例外 B，钉住专用镜像 Ascend `db701c1f` + vLLM `0fc695fc`**。

### 怎么开

完整参数类型、启动入口校验与跨版参数变更统一见 [Scheduler 参数参考](vllm-scheduler.md#怎么开) 与 [核心 CLI 参数](core-cli-params.md)，本节聚焦分块策略与执行耦合点：

- **默认开着。** `SchedulerConfig.enable_chunked_prefill` 字段静态兜底为 `True`（docstring 说明主要供测试，实际生效值由 `EngineArgs` 决定）；用户未显式传参时，`_set_default_chunked_prefill_and_prefix_caching_args` 取 `model_config.is_chunked_prefill_supported`（生成式模型仅 encoder-decoder 返回 `False`）[C7]。启用时启动日志打印 `Chunked prefill is enabled with max_num_batched_tokens=%d.` [C6]，历史 GLM 双机应打出 `8192`。
- **每步预算与昇腾默认回退（`--max-num-batched-tokens`）。** 历史 GLM 双机显式传 `8192`。在通用昇腾部署不显式传参时，因解析期 Worker 尚未初始化 `torch_npu`，`NPUPlatform.get_device_total_memory` 抛 `NotImplementedError` 使 `get_batch_defaults` 按 `0` 显存回落至在线 `vllm serve` `2048` / `256`、离线 `LLM` `8192` / `256` [C61]（外部启动器是否提前初始化运行时需以启动日志实测确认为准 [I]）；开启 `prefill_context_parallel_size > 1` 且序列并行生效时，`AscendConfig` 通过 `logger.warning_once` 显式告警并将预算向上取整至 `tp_size * pcp_size` 的整数倍 [C64]。
- **单条上限（`--long-prefill-token-threshold`）。** 字段默认 `0`，设正值时在 `v0.23.0`–`v0.30.0` 对 `running` 先截阈值再 `min(..., token_budget)`，对 `waiting` 先截阈值再检查分块开关最后 `min` [C3]；docstring 称其为「长请求分类阈值」，代码实为直接截断单步 token 数的闸门 [!]。仅 `v0.23.0` 与 `v0.26.0rc` 保留遗留参数 `max_num_partial_prefills` / `max_long_partial_prefills`（`> 1` 时虽有自动设为 `max_model_len` `4%` 的旧分支，但 V1 改动任一参数即抛 `NotImplementedError` [C8]）；**`v0.30.0 (ced6857a)` 已移除这两个 partial-prefill 参数**，社区 `main` 进一步改为在关闭分块或单请求独跑时忽略该阈值 [C73]。
- **切点对齐与块大小刷新。** 保存的历史随模型结构变化，不可假定所有线性注意力具有相同的分块或状态保存边界。`need_mamba_block_aligned_split` 仅在含 mamba 类层且 `mamba_cache_mode == "align"` 时为真，由 `_mamba_block_aligned_split` 将 prefill 段向下取整到块长整数倍，不足一块的尾巴照算 [C12]；GLM 专用补丁改用调度器公共块边界 `self.block_size` 对齐完整 KDA 状态，而非 `4`-token 的 indexer-state 物理块 [C13]（双机默认 `mamba_cache_mode = "none"` 不触发 [D]）。昇腾 `refresh_block_size` 对普通注意力模型在开启 chunked prefill 或 prefix caching 且块长非 `128` 时打 `info` 日志并改为 `128`（`deepseek_v4` 与混合结构提前返回不受影响，GLM 逻辑块 `640` 见 [KV cache 规格](kv-cache-spec.md#配置阶段逻辑块先定成-640)）[C68]。

### 会报什么错

- **`ValueError: max_num_batched_tokens (...) is smaller than max_model_len (...)`**：关闭分块且显式传入的预算严格小于 `max_model_len` 时由 `verify_max_model_len` 抛出；未显式传预算时 `EngineArgs` 先抬到 `max(max_model_len, 默认值)` 不报此错 [C9]。双机显式传 `8192 < 133120`，直接关分块会启动失败。注意代码使用严格小于（相等值不被此项拒绝），而上游优化文档写作「必须大于」，且通过此项不代表其他启动条件必然通过。
- **手动关闭分块的 warning 与旧版 partial-prefill 异常**：生成式模型手动关闭分块会打印一次可能引发崩溃或输出错误的警告；在仍保留 `max_num_partial_prefills` 与 `max_long_partial_prefills` 的 `v0.23.0` 与 `v0.26.0rc` 中修改二者会抛 `NotImplementedError`（`v0.30.0` 与 `main` 已移除这两个参数）。关闭分块后，若等待请求截断后仍超剩余预算，`waiting` 循环直接 `break` 停止本步接纳而不抛异常。
- **混合对齐断言与昇腾 CPP 校验报错**：混合模型落入 `align` 模式却关掉分块时触发断言 `Chunked prefill is required for mamba cache mode 'align'.` [C21]；在 `v0.30.0` 开启 `profiling_chunk_config`（CPP）时，若 `pp <= 1`、同时开启 `enable_balance_scheduling` 或 `dyntra_lb_config`、或在 `MRV1` 下配 `async_scheduling`（未设 `VLLM_USE_V2_MODEL_RUNNER=1`）均抛 `ValueError`；而在 `SP + PCP > 1` 向上取整（`logger.warning_once`）之前，若初始 `max_num_batched_tokens` 小于 `min_chunk`，会显式调用 `logger.warning` 将 `min_chunk` 下钳至该预算值，两处均非静默改写 [C63]（`main` 已彻底删除 `profiling_chunk_config`，传入即无效）。

### 开销和什么时候别开

- **步前记账、未完采样丢弃与执行标签。** `_update_after_schedule` 在前向前先把本步数加进 `num_computed_tokens` 并按 `< num_tokens + num_output_placeholders` 置 `is_prefill_chunk` [C4]，Worker 按步前 `num_computed_tokens_cpu` 编位置号。runner 按 `optimistic_seq_lens < num_tokens` 生成 `discard_requests_mask` / `discard_request_indices`，采样后将带种子 RNG offset 回拨 `4` [C15]（同步普通采样直接清空对应行、投机拒绝采样按丢弃行过滤、异步路径先从下步输入与请求输出排除再待拷回后清空或过滤，见来源 48–51）。在 MRV1 `_build_attn_state` 中，局部状态先按全 `0`（`PrefillNoCache`）、全排 `1`（`DecodeOnly` 或 MTP 下 `SpecDecoding`）、有效 token 全 `1`（开投机为 `SpecDecoding`、未开为 `ChunkedPrefill`）、最后看分块开关（`ChunkedPrefill` / `PrefillCacheHit`）求值，再把非 MTP 的 `SpecDecoding` 后置改写为 `ChunkedPrefill` [C16]；本页 `6/6/2` 与 `8144/8144/3712` 各段均大于 `1`，单进首段为 `PrefillNoCache`、后段及混批为 `ChunkedPrefill`（若末段恰好剩 `1` 且同批全排 `1`，则会先落入 `DecodeOnly` 或 `SpecDecoding`）。
- **跨段读历史与预算调参方向。** GLM 的 KDA 按 `has_initial_state` 接上一段状态并 `output_final_state=True` 写回（算子内部 `64` 位置分段常量见来源 39 `kimi_kda.py#L38`），稀疏 MLA 元数据取 `seq_lens` 全长、清单宽 `index_topk + index_kpool - 1`（见来源 18–19）。上游优化文档指出小预算（如 `2048`）偏 ITL、大预算偏 TTFT [S20]；昇腾流水线与 CPP 文档指出 `PP > 1` 分摊层与 KV 并省去非末级 logits 峰值，CPP 推荐把预算放宽至固定分块的 `2~4` 倍 [S70][S71]，但具体耗时受历史长度与通信制约，不能同时保证 TTFT、ITL 与吞吐最优。
- **要求逐位确定性（batch invariance）时必须显式关闭。** `v0.30.0` 与 `main` 的昇腾 `batch_invariance.md` 写明该模式不支持 chunked prefill、prefix caching 及驱逐后重算恢复进度的抢占，须显式传 `--no-enable-chunked-prefill --no-enable-prefix-caching --block-size 128` [S69][S77]（此要求仅限 batch invariance 模式，不可推广到常规部署；双机照做还须先满足预算 `>= max_model_len`）。分块不等同于 [PD 分离](pd-disaggregation.md)。

### 版本差异

下表汇总四套固定版本基线在分块默认值、单条阈值截断、DP 节拍门控、昇腾动态分块扩展、执行标签与确定性模式上的核验结果（历史 GLM 双机算例固定对照 `vllm@0fc695fc` + `vllm-ascend@db701c1f`）：

| 核验维度 | `v0.23.0`（`0fc695fc` / `2c59ff10`，及 GLM `db701c1f`） | `v0.26.0rc`（`568afb3a` / `2ed6cbba`） | `v0.30.0`（`ced6857a` / `c09d3e20`，主基线） | `main`（`ba15685a` / `8d6180e2`） |
| --- | --- | --- | --- | --- |
| **未显式设置时的分块默认与批预算** | 按 `is_chunked_prefill_supported` 推导（见 [Prefill 版本对照](prefill.md#版本差异)）；昇腾 `get_device_total_memory` 直接抛 `NotImplementedError` 回落在线 `2048` | 分块默认同左；默认批预算回落在线 `2048` | 分块默认同左；`get_device_total_memory` 改为 `torch_npu` 初始化前抛异常，解析期仍回落在线 `2048` / `256`，且先做 CPP `min_chunk` 告警下钳、再做 `SP + PCP > 1` `warning_once` 向上取整至 `tp × pcp` | 分块默认、初始化前 `2048` 回落与 `SP + PCP` `warning_once` 向上取整逻辑同 `v0.30.0` |
| **单条上限与关闭分块时的接纳** | 上限默认 `0`；先截单条上限再查分块开关，超余量 `break`；保留 `max_num_partial_prefills` / `max_long_partial_prefills`（V1 改动抛 `NotImplementedError`） | 同 `v0.23.0`（保留两项 partial-prefill 遗留字段，V1 改动仍抛 `NotImplementedError`） | **已移除 `max_num_partial_prefills` 与 `max_long_partial_prefills`**；上限默认 `0`，截断与 `break` 顺序同左；多比一道并行草稿预留 `input_budget - draft_slots`（MTP 预留为 `0`，GLM 切法不变，见来源 25–26、56） | 延续移除两项 partial-prefill 参数；**单请求独跑或关闭分块时忽略单条上限**（置 `0`），并新增 `long_prefill_token_threshold_adaptive` 按 `input_budget // num_eligible_reqs` 兜底公平份额（来源 73–74） |
| **DP 组间对齐 prefill 的节流** | 无此节拍门控 | 新增 `prefill_schedule_interval`（默认 `1` 不触发）与两层延迟条件 | `prefill_schedule_interval` 默认 `1`（表示不额外节流 DP 接纳，不表示关闭分块），两层条件同左 | 延续 DP 门控并同步支持本地间隔节流，按活跃等待数更新 `prefill_capacity_bound` |
| **昇腾联动开关与动态分块（CPP）** | `2c59ff10` 与 `db701c1f` 设 `SLO_limits_for_dynamic_batch` 会顺手置 `enable_chunked_prefill = True`（来源 22）；含同步 `ProfilingChunkScheduler` | 移除 `SLO_limits` 顺手改写开关；收拢嵌套 `scheduler_config` | 普通分块默认与 CPP 解耦：新增 `ProfilingChunkAsyncScheduler`（配 `async` 须开 `MRV2`，`MRV1` 抛 `ValueError`），与 `balance`/`dyntra_lb` 互斥 | **彻底移除 `profiling_chunk_config` 与 CPP 调度器**（PR `#21310`）[C75] |
| **Worker 执行标签（`attn_state`）** | MRV1 `_build_attn_state` 两步判据（来源 16） | MRV1 标签判据相同（来源 28） | MRV1 标签判据相同（`model_runner_v1.py#L1706-L1734`，来源 67） | 切换至 MRV2 `worker/v2/attn_utils.py#L719-L750`：新增 `pooling` 分支，并将 `all(num_valid_tokens == 1)` 与 `enable_chunked_prefill` 合并为 `ChunkedPrefill`（来源 76） |
| **`batch_invariance.md` 文档约束** | 未提及 chunked prefill | 未提及 chunked prefill | 写明须显式关闭 chunked prefill 与 prefix caching、配 `--block-size 128`，且不支持驱逐重算抢占 | 与 `v0.30.0` 一致（阶段一归档 `baa023ad` 与当前 `8d6180e2` 均同，来源 27、77） |

DP 节拍门控有两层触发条件：第一层在引擎侧，只有 `prefill_schedule_interval > 1` 且当前步号不能被间隔整除时才请求节流（`throttle_prefills=True`）；第二层在 Scheduler 内部，还要求 `prefill_capacity_bound=False` 且 `running` 中至少有一条 `is_prefill_chunk=False` 的请求。两层同时满足时，已在 `running` 里的 prefill 续段也会暂缓推进，`waiting` 里若仍需本地计算多于 `1` 个位置且未进入异步加载远端 KV 分支的请求则停止本步接纳。`prefill_capacity_bound` 在放行步骤按 `waiting` 是否仍有未延迟等待请求更新：仍有等待请求时，下一步不再因该门控推迟 prefill；它是调度器内部的容量受限标记，不是设备显存余量读数（`v0.26`、`v0.30.0` 与 `main` 对应源码见来源 23–24、37、40–47、56）。

### 源码位置

| 看什么 | 在哪（含 `v0.30.0` 主基线与历史 GLM `db701c1f` / `0fc695fc`） |
| --- | --- |
| 「调度器没有 prefill、decode 阶段」注释与预算扣减 | `vllm/v1/core/sched/scheduler.py` 的 `schedule()`（`ced6857a#L561-L665`、`0fc695fc#L340-L410`，来源 1–2、56） |
| `running` / `waiting` 截断、单条上限与关分块 `break` | 同文件两趟循环（`ced6857a#L660-L665`、`#L1066-L1085`；`0fc695fc#L678-L700`，来源 3、33、56–57；`main` 单请求豁免见 `ba15685a#L776-L792` 来源 73） |
| 步前记账推进 `num_computed_tokens` 与 `is_prefill_chunk` | 同文件 `_update_after_schedule`（`ced6857a#L1520-L1545`、`0fc695fc#L997-L1019`，来源 4、58） |
| 字段默认、启动日志与 `verify_max_model_len` 严格小于校验 | `vllm/config/scheduler.py`（`ced6857a#L70-L74`、`#L185-L194`、`#L287-L315`；`0fc695fc#L70-L90`、`#L238-L272`，来源 5–6、36–37、60） |
| 默认启用推导、`get_batch_defaults` 与昇腾 `2048` 回退 | `vllm/engine/arg_utils.py`（`ced6857a#L2705-L2816`、`0fc695fc#L2258-L2528`）与 `vllm_ascend/platform.py#L231-L245`（来源 7–10、34–35、59、61） |
| `SP + PCP` 向上取整、`PP > 1` 分层与昇腾 CPP 动态分块 | `vllm_ascend/ascend_config.py#L712-L828`、`scheduler_profiling_chunk.py#L107-L115`、`vllm/distributed/utils.py#L127-L160`（`main` 移除见 `platform.py#L1585-L1601`，来源 62–65、72、75） |
| 混合模型 `align` 对齐切分与普通注意力块长 `128` 刷新 | 上游 `_mamba_block_aligned_split`、GLM 补丁 `patch_glm5_next_mamba_scheduler.py` / `patch_mamba_config.py`（来源 11–13、21、29）与 `vllm_ascend/utils.py#L1482-L1553`（来源 31、68） |
| 位置号、执行标签与未完段采样丢弃/RNG 回拨 | MRV1 `vllm_ascend/worker/model_runner_v1.py`（`c09d3e20#L1479-L1488`、`#L1706-L1734`；`db701c1f#L858-L2731`）及 `main` MRV2 `worker/v2/attn_utils.py#L719-L750`（来源 14–17、48–51、66–67、76） |
| GLM KDA 跨段接状态、稀疏 MLA 清单与五缓存组借块 | `kimi_kda.py`（`#L38`、`#L398-L474`）、`indexer_kpool_mla_v1.py#L477-L498` 与 `single_type_kv_cache_manager.py`（来源 18–19、39、52–55） |
| 概念出处与教学算例设定 | SARATHI 论文提出将长 prefill 切块与 decode 同批混跑 [S30]；首屏每步预算 `8`（`A/B` 各 `1`、`C` `14 → 6, 6, 2`）为配合冻结 3D 时间轴的教学人为设定 [A] |

**待核。**

1. 历史 GLM 双机启动日志里 `Chunked prefill is enabled with max_num_batched_tokens=8192.` 这一行，以及通用昇腾不同外部启动器在 `EngineArgs` 解析前是否触发 `torch_npu` 初始化，缺实机日志确认 [!]。
2. 开关分块、调整每步预算对历史 GLM 双机及通用昇腾在线服务 TTFT 与 ITL 的具体延迟分布影响，本页无实机测量数据。
