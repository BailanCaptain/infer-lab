---
id: chunked-prefill
title: Chunked prefill：长提示词分几步算完，正在生成的请求不被卡住
type: feature
summary: >-
  Chunked prefill
  让调度器在一条长提示词装不下这一步时，只给它排剩余预算那么多个位置，下一步从断开处接着算；历史和状态跨段延续，只有最后一段产出首个 token。它让正在
  decode 的请求每步照常前进，代价是长请求的首 token 更晚、旧历史要重复读、每步多一点杂活。
aliases:
  - Chunked Prefill
  - 分块预填充
  - 分块 Prefill
chapters:
  - '11'
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
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L9-L57
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
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L186-L188
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L1327-L1350'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L222-L225
  - 'https://arxiv.org/abs/2308.16369'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L1396-L1433'
  - >-
    raw:sha256-ab8d477aec6bfdfa592d8282eafcfa581f0abbd5f9a7f08e30f386f9a7864ecd.md#L1-L725
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/core/sched/scheduler.py#L689-L699
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/engine/arg_utils.py#L2370-L2377
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
  - 'vllm-ascend@7d825229:docs/source/user_guide/feature_guide/batch_invariance.md#L184-L190'
verified: []
evidence: C
relations:
  - to: prefill
    kind: variant-of
    note: 同一条请求的 prefill 分到几步做，只有最后一段产出首个 token
  - to: vllm-scheduler
    kind: builds-on
    note: 切多长由调度器每步的「还差几个」和剩余预算决定
  - to: concurrent-requests
    kind: builds-on
    note: 多条请求时 20,000 token 提示词每一步的预算账
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 每一段要借多少块，尾状态组为什么临时借两千多块
  - to: pd-disaggregation
    kind: alternative-to
    note: 分块把 prefill 压到每步预算内；PD 分离让 prefill 和 decode 不在同一步
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-a784826e7872c29e9344402dd0c34d9437753b13b503dd7eb663ea72c2414099.md
  - >-
    raw/sha256-ab8d477aec6bfdfa592d8282eafcfa581f0abbd5f9a7f08e30f386f9a7864ecd.md
---

## 一条很长的提示词，能不能分几步算完？

**chunked prefill（分块预填充）是调度器处理长提示词的方式：一条提示词在这一步装不下时，只给它排这一步剩下的预算那么多个位置，先算前一段、把这一段的历史存好，下一步从断开的位置接着算，直到整段提示词算完，才选出回答的第一个 token。**

prefill 是处理提示词、建立后续计算所需历史的阶段，可以经过一步或多步；处理到最后一个提示词位置后，选出回答的第一个 token。之后进入 decode，普通路径逐个推进，投机路径可以一轮验证多个候选。区别见 [Prefill 与 Decode](prefill.md#回答的第一个字出来之前模型在算什么)。「一步」是模型对一批请求做的一次前向；一步的位置预算由调度器封顶，为什么按位置而非请求条数算，见[调度器](vllm-scheduler.md#为什么按-token-设预算还要另设请求数上限)。

下面用示意数感受一下。假设每步最多算 8 个位置。A、B 两条请求已经在生成回答，每步各算 1 个位置；这时来了一条新请求 C，提示词有 14 个 token，占位置 0–13。

```wiki-diagram
file: chunked-prefill
```

- **每一步先照顾 A、B。** 它们各拿 1 个，8 个里还剩 6 个，全给 C。
- **C 的 14 个位置分三步算完。** 第 1 步算位置 0–5，第 2 步算 6–11，第 3 步算 12–13。三段不是三份各自独立的提示词：第 2 段从位置 6 接着编号，并读第 1 段存下的历史。
- **只有最后一段产出回答。** 每一步末尾，模型都会在 C 本步最后一个位置上选一个 token，但前两步提示词还没读完，选出来的不作为请求输出；第 3 步算完位置 13，选出的 `y₀` 才是 C 的第一个输出 token。
- **第 4 步起 C 也转入 decode。** 它送进 `y₀`，和 A、B 一样每步 1 个位置。
- **A、B 一步也没停。** 这 4 步里它们每步都前进 1 个位置。

## 为什么要切：不切的话，一步会被一条长提示词撑大

在单条上限保持默认的示意场景中，关闭分块后，一条提示词要一步算完。要让 C 进得来，每步的预算就得开到装得下整段提示词（真实部署里要装得下允许的最长输入），C 进来的那一步就变大了：

```calc
title: C 进来的那一步有多大（示意）
不切，C 一步算完 = 1 + 1 + 14 = 16 个位置
切开，每步最多 = 1 + 1 + 6 = 8 个位置
> A、B 的下一个 token 都要等所在的那一步整步算完
```

同一步里的请求是一起算完、一起拿结果的。A、B 各只差 1 个位置，也得等这 16 个位置的一整步算完，才拿到下一个 token。提示词越长，这一步越大：一条几万 token 的提示词，会让正在生成的请求在这一步上明显卡一下。切开以后每步最多 8 个位置，A、B 每步照常前进，长提示词的工作量被摊进几步，每步只多出一小段。衡量这种卡顿的指标是 ITL（inter-token latency，同一条请求相邻两个输出 token 之间隔多久）。

分块还带来第二个好处：每一步都能把 decode 和一段提示词拼在一起算，增加权重复用和分摊调用开销的机会。decode 每条请求的新位置少，提示词块则常包含较多位置；合批后多行输入共用同一张权重。实际读量、是否更快以及主要瓶颈仍取决于缓存、内核与批次，理想复用模型见 [Prefill 与 Decode](prefill.md#为什么把已知的位置合成一步代价在哪)。

关闭分块且单条上限保持默认时，还有一个麻烦出在排队上：一条新请求整段装不下这一步的余量，调度器这一步便不再接纳新请求，排在它后面的短请求也跟着等。

预算封住的是一步算多少个位置，不是一步花多少毫秒。每步实际多久，还要看模型、历史长度、同批的请求和通信。

## 代价在哪：首个 token 更晚，旧历史要再读几遍

切开不是白来的，代价有三处。

**C 的第一个 token 要等三步。** 不切时，C 在进来那一步末尾就有 `y₀`，只是那一步很大；切开后前两步都只在「读题」。衡量这段等待的指标是 TTFT（time to first token，从请求到达到第一个输出 token 的时间）。注意预算限制的是**本步处理的位置数**，不是**执行时间**：同样数量的位置，在不同历史长度、同批请求和通信条件下耗时并不相同。因此，只有当剩余预算实际构成限制（未被单条上限 `--long-prefill-token-threshold` 或 KV 块余量等先行卡住）时，调小预算才会缩小每步可排的分块、可能让长提示词跨越更多步，调大预算才给本步留出更多 prefill 空间、可能减少步数（而非必然减少步数）；调小预算不能单方面保证输出 token 之间的时间间隔（ITL）更稳，调大预算也不能单方面保证 TTFT 更短，必须在具体负载下一起实测。

**后面的块仍要访问前面的可见历史。** 对保留全部因果历史的注意力，各位置要使用自己与前面位置的 K、V（这份存储叫 [KV cache](kv-cache.md)）。第 2 段依赖第 1 段，第 3 段依赖前两段。下面按“每个调度块内充分复用、每段可见历史只计一次”比较逻辑历史访问量，不是实际 HBM 读取次数：

```calc
title: 切成三段，注意力的账怎样变（示意，普通因果注意力）
不切，可见历史范围计一次 = 14 个位置
切开，三段可见历史分别计一次 = 6 + 12 + 14 = 32 个位置
打分的位置对，切不切都一样 = 1 + 2 + … + 14 = 105 对
> 位置 i 只和 0 到 i 打分，与它在哪一步算无关
```

这份账增加的是跨段重复覆盖的历史范围，不是打分次数；实际从显存重复读取多少，还取决于内核分块与缓存复用。chunked prefill 并不通过删掉因果位置对来省计算，而是把一次很重的 prefill 摊到多步。

**每一步都多一点杂活。** 步数多了，调度、准备输入这些每步都有的开销也多做几次；前两步还在 C 的最后一个位置上白做一次词表投影和采样，结果扔掉。白做的只有这一个位置，不是整个前向重走一遍。

调一次预算好不好，要同时看 TTFT、ITL、总吞吐，以及长、短请求各自的分布，并记下当时的并发、输入输出长度和实际生效的预算。只看平均吞吐会掩盖长请求等得久，只看短请求的 ITL 又会忽略长提示词推进得慢。

## 怎么切：每一步都是同一道减法

调度器里没有一个单独的「切块模式」。它对每条请求只记两个数：应该算到第几个位置、已经算到第几个位置，两者之差就是还差几个。每一步先续已经在跑的请求（`running` 队列），再用剩下的预算接纳刚到的请求（`waiting` 队列），对每条请求做同一道减法：本步给它的位置数，取「还差几个」和「剩余预算」里小的那个。两个队列和每一关的细节见[调度器](vllm-scheduler.md#调度器怎样排一步还差几个--截断--借块--记账)。

按剩余预算截断长提示词，以允许分块为前提：关闭分块时，如果等待请求经过单条上限截断后的位置数仍超过剩余预算，调度器会退出 `waiting` 接纳循环；允许分块时，才安排预算容得下的部分。短提示词一步就差完了；长提示词差不完，剩下的自然留到下一步。切块只是这道减法减不完时留下的余数。C 的三步是：

```calc
title: C 的 14 个位置怎样切成 6、6、2（示意）
第 1 步 = min(14 − 0, 8 − 2) = 6
第 2 步 = min(14 − 6, 8 − 2) = 6
第 3 步 = min(14 − 12, 8 − 2) = 2
> 每步先扣掉 A、B 的 2 个；第 3 步只用掉 4 个，余下的可以再排别的新请求，没有也不必填满
```

下面的简化伪代码省略了前缀缓存命中、异步输出占位（`num_output_placeholders = 0`）与借块回退，只保留 `running` 先续跑、`waiting` 后接纳的两道减法，以及“先记下步前进度与本步计划，排完一整步再统一把已算数推到步末”的先后顺序（其中 `num_tokens_with_spec` 是请求当前应算到的总位置数，含已生成的词元和待验证的投机草稿候选；无草稿候选时就等于 `num_tokens`）：

```python
scheduled = []  # 记录 (req, 步前已算位置, 本步排入位置数)

# 1. 先续已在 running 里的请求（含上一步没算完的提示词续段）
for req in running:
    need = req.num_tokens_with_spec - req.num_computed_tokens  # 应算到的位置数（含草稿候选）− 已算位置数
    if long_prefill_token_threshold > 0:
        need = min(need, long_prefill_token_threshold)
    num_new_tokens = min(need, token_budget)
    token_budget -= num_new_tokens
    scheduled.append((req, req.num_computed_tokens, num_new_tokens))  # 先保留步前进度与本步计划（省略借块）

# 2. 再用剩余 token_budget 接纳 waiting 里的新请求（无缓存命中时 num_computed_tokens 为 0）
for req in waiting:
    need = req.num_tokens - req.num_computed_tokens  # 新请求提示词长度 − 已算位置数
    if long_prefill_token_threshold > 0:
        need = min(need, long_prefill_token_threshold)
    if not enable_chunked_prefill and need > token_budget:
        break  # 关闭分块且等待请求截后仍超剩余预算时，停止本步 waiting 接纳
    num_new_tokens = min(need, token_budget)
    token_budget -= num_new_tokens
    scheduled.append((req, req.num_computed_tokens, num_new_tokens))  # 先保留步前进度与本步计划（省略借块与入队）

# 3. 本步计划生成后，统一把已算数推到步末（_update_after_schedule）
for req, _, num_new_tokens in scheduled:
    req.num_computed_tokens += num_new_tokens
    req.is_prefill_chunk = req.num_computed_tokens < req.num_tokens
```

第 1 步 C 还在 `waiting` 里；排进这一步以后，它就留在 `running` 里，第 2、3 步和 A、B 一起先被续上。每一步排完，调度器不等模型算完，就先把 C 的「已算」往前推：`0 → 6 → 12 → 14`，下一步直接从新位置接着排；同时记下「这条请求的提示词还没算完」。

这份安排交给执行侧以后，一段提示词在一步里依次经过主线七站（一条请求从进门到返回要走的七个环节，见[一条请求](one-request.md#一条请求要走过七站)）里的第 2 到第 5 站。下图以 C 的第 2 段（位置 `6–11`）为例展示这四站的数据接力：

```wiki-diagram
file: chunked-prefill-flow
```

1. **第 2 站 调度。** 定下这一段排几个位置（本段排 `6` 个），排完立刻把已算数从 `6` 推到 `12`，并标记提示词尚未算完。
2. **第 3 站 准备输入。** 执行侧从本步开始前的已算数（`6`）编位置号，而不是用调度器刚前推的步末值（`12`）：第 2 段的位置号是 `6、7……11`，不从 `0` 重来。每个位置的历史要写进哪一格（格号），按这条请求的 [block table](block-table.md)（块表：记着请求借到了哪几个 KV 块）查出来。整批还会贴一个执行标签：在本页 `6 / 6 / 2` 这类各 prefill 段长度大于 1 的例子里，一批里既有 decode 又有一段提示词，或者一段提示词接着前面算，都贴 `ChunkedPrefill`，意思是「有一部分历史已经在缓存里」。这些张量怎样拼成一批，见[输入准备](prepare-inputs-flow.md)。
3. **第 4 站 前向。** 普通注意力读前面各段存下的历史和本段新算的；线性注意力从上一段留下的递推状态接着推；本段的历史写进格号指定的地方。
4. **第 5 站 采样。** 每条请求都在自己本步最后一个位置选一个 token。C 的提示词还没算完（`12 < 14`），这个 token 丢掉并回拨带种子随机数，下一步回到调度从 `12` 续排；算完了（如第 3 段末 `14 == 14`），选出的就是第一个输出 token `y₀`，从下一步起 C 按 decode 排。

下面把 A、B、C 放到同一条调度时间轴上。虚线浅色格是已排入的计划，实色格是执行完成的位置；下方保留 C 已建立的历史。列宽只划分调度步，不表示每步耗时相等。

```wiki-scene
inference-mechanism:7
```

## 历史状态必须跨段延续

切成几段，听上去像要把几段结果「拼起来」，其实没有拼这一步。分块保持提示词的位置顺序，后一段直接依赖前面已经建立的历史，靠的是三样东西接得上：

- **位置号接得上。** 第 2 段从位置 `6` 开始编，[因果掩码](attention-qkv.md#因果掩码限定每个位置能访问的历史)（每个位置只能看自己和前面的位置）照常生效：位置 `6` 看得到 `0–6`，位置 `11` 看得到 `0–11`。所以每个位置算出来的结果和不切时一样，分段不改位置编号，也不改因果关系。
- **历史接得上（随模型结构不同而保存不同形态的历史）。** 普通注意力保存供后续位置读取的逐位置 K、V 表示：第 1 段写进 KV cache 的内容原样留着，第 2 段只追加新位置，做注意力时把旧的读进来。[线性注意力](linear-attention.md)（每条请求只存一份固定大小的递推状态，随新位置到来原地更新以汇总此前历史）不存逐个位置的历史：分段时，它读入上一段算完的状态作为初始状态，这一段算完再写回最终状态。两者的保存布局不同，不能把“存好历史”一概理解为保存逐位置的 K 和 V。
- **请求之间互不干扰。** A、B、C 在同一步里一起算，但各用各的位置号、各自的块和状态槽；A 的 decode 读的是 A 的历史，C 的一段读的是 C 的历史。

丢弃只针对本步结束后「已算」还没追上提示词长度的请求：这次选出的 token 不追加到请求上，也不返回给客户端；请求自带随机种子时，随机数生成器还会往回拨，免得这次白采样打乱之后真正的采样。

## 细节：切点、单条上限和关掉分块

- **切点不看 KV 块的边界。** token 预算管一步算多少个位置；KV 块大小管历史按多大一格存、怎样寻址。即使两者数值相等，含义也不同。调度器按预算切，一段可以停在某个块的中间，下一段接着往这个块里写。例外是混合模型（既有普通注意力层、又有线性注意力层）开了 prefix caching（开头相同的请求复用已经算好的历史），而模型不支持逐块保存线性注意力状态、落到按块对齐存档（`align`）的模式时：调度器把每段向下取整到块大小的整数倍，最后不足一块的尾巴照常算。支持逐块保存状态的模型不需要这样对齐。

这里还要区分物理存储块与完整状态的保存边界。GLM-Next 补丁允许混合缓存的最小物理块对应 4 个 token，但完整递推状态的可缓存边界采用调度器解析后的公共边界（`self.block_size`）。前者说明存储怎样分格，后者说明在哪些位置能留下供后续复用的完整状态；不能由物理块大小为 4 推出每隔 4 个位置都能保存完整历史状态。
- **单条请求一步的上限。** 可以另设「一条请求一步最多拿多少个位置」（`--long-prefill-token-threshold`），它在剩余预算之前先截一刀，`running` 和 `waiting` 两边都截。默认是 `0`，表示不设。假如示意里把它设成 `4`，C 就要按 `4、4、4、2` 分四步，前三步各给别的新请求留出 2 个位置，代价是 C 的第一个 token 再晚一步。
- **关掉分块。** 本部署按模型支持条件默认开启。手动关闭且单条上限保持默认 `0` 时，一条比余量长的新请求排不进来，这一步停止接纳新请求；若另设正的单条上限，代码先截断再检查分块开关，截后能排入预算而原请求仍有余量时，下一步进了 `running` 就会继续分段，组合边界见 [Scheduler 参数参考](vllm-scheduler.md#怎么开)。关闭分块还要求每步预算不小于允许的最长输入，否则启动报错；上游会警告，关掉它可能让引擎崩溃或算出错误结果。原文见页末。

默认启用还有模型支持条件：用户没有显式设置开关时，配置解析使用模型的分块支持检查结果。pooling 请求是否允许分块也需检查配置，不能只套用生成模型的默认设置。

- **每步实际切多少，不只看预算。** 在跑的请求数、KV 块够不够、已算进度、为 speculative decoding（投机解码：先草拟几个候选 token，下一步一起验证）预留的位置，以及块不够时的抢占，都会改变某一步排给长提示词的量。示意图里的 `6、6、2` 是能手算的安排，不代表调度策略对各请求公平。
- **昇腾自带的变体。** 镜像里还有按性能剖析决定每段切多长的 `ProfilingChunkScheduler`、按时延目标动态调预算的调度器等，本部署都没启用，见[昇腾上跑的是哪个调度器](vllm-scheduler.md#昇腾上跑的是哪个调度器)和 [profiling chunk 配置](../params/profiling-chunk-config.md)。

## 放到 GLM 双机：20,000 个 token 的提示词分三步

部署前提见[部署页](glm-5-3-flash-two-node.md#部署前提)。两台机器各是一个 DP 组（各自独立排请求的执行组），各有一个调度器，每组每步预算 `8192` 个位置、最多 `32` 条请求，见[调度器的 GLM 一节](vllm-scheduler.md#放到-glm-双机一个-dp-组里的-r1)。chunked prefill 本部署按默认开着。每条 decode 请求一步算 `4` 个位置：`1` 个确定的 token，加 `3` 个 MTP 候选（MTP 是 GLM 自带的多 token 预测层，每步先草拟 `3` 个候选，下一步由主模型一起验证）。

所以新提示词比「`8192 − 4 × 在跑的条数`」还长才会被切；新请求能进来时，这个门槛最低是 `8068`，推导见[并发页](concurrent-requests.md#提示词超过剩余预算时分几步算)。主线的示例请求 [R1](one-request.md#示例请求-r1-与官方双机部署) 提示词只有 `4` 个 token（教学设定），[场景 M](concurrent-requests.md#示例场景-m-与变体-m)（一个 DP 组里已有 `12` 条请求在 decode，又来一条 `6000` token 的新请求）的新提示词也一步装得下，它们都用不上分块。

把场景 M 的新请求换成一条 `20,000` token 的提示词：前两步各算 `8144` 个位置、把预算用满，第 3 步算最后 `3712` 个，本步末得到第一个输出 token，第 4 步起它也每步 `4` 个；逐步的预算账在[并发页](concurrent-requests.md#提示词超过剩余预算时分几步算)。和示意图一样，那 `12` 条 decode 请求在这 4 步里每步都照常前进（这里的「每步都照常前进」只表示那 `12` 条请求每轮都获得计算机会，不表示它们的输出时间间隔保持不变）：

| 步序（DP0，总预算 8192） | 12 条 decode 占用 | 新请求 C 本步排入 | C 步末累计已算 | 本步末 C 的状态与产出 |
| --- | --- | --- | --- | --- |
| 第 1 步 | 12 × 4 = 48 | 8144（位置 0–8143） | 8144 / 20000 | prefill 未完，段末采样丢弃 |
| 第 2 步 | 12 × 4 = 48 | 8144（位置 8144–16287） | 16288 / 20000 | prefill 未完，段末采样丢弃 |
| 第 3 步 | 12 × 4 = 48 | 3712（位置 16288–19999） | 20000 / 20000 | prefill 算完，产出首个输出 token `y₀` |
| 第 4 步 | 12 × 4 = 48 | 4（`y₀` + 3 个 MTP 候选） | 20004 | 转入 decode，与前 12 条同批推进 |

执行侧，这三步和纯 decode 步有几处不同：

- **不回放图，MoE 通信换路径。** 这几步整批贴 `ChunkedPrefill` 标签，走 eager mode（由 CPU 逐个下发算子），不回放录好的 decode 图；一步超过 `128` 个 token，MoE 层（每个 token 只挑几个专家来算）的通信改走 `AllGather`（两台机器先互相收齐这一步全部 token 的隐藏向量，每张卡再挑出路由给自己专家的那些），两台机器一起改，见[并发页的 MoE 通信](concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)。
- **34 层 KDA 接着上一段的状态算。** KDA 是 GLM 的线性注意力层，每条请求只存一份固定大小的状态。每一段在 KDA 算子里面还会再切成每 `64` 个位置一小段并行算，那是 KDA 自己的算法，和调度器的分块是两回事，见[线性注意力](linear-attention.md#prefill-用-chunked-计算decode-逐位置推进)。
- **11 层稀疏 MLA 在前面全部位置里挑着读。** 稀疏 MLA 是 GLM 的另一类注意力层，每个查询只挑一部分历史位置来读。第 2 段的查询面前已有 `8144` 个以上的位置：indexer（一个很便宜的打分网络）先给因果范围内的历史打分，主注意力只读挑中的那部分，清单每行最多 `2051` 个位置。所以真实读取量不是「各段历史长度之和」，见[稀疏注意力](sparse-attention.md#放到-glm-双机一个查询在一层稀疏-mla-里怎样挑怎样读)。
- **切点不对齐到块。** 一个逻辑块是 `640` 个位置，`8144 = 12 × 640 + 464`，第 2 段从第 `13` 块的第 `465` 格接着写。本部署关着 prefix caching，KDA 的缓存不按块存档，调度器不需要对齐切分；昇腾为按块对齐准备的 GLM 补丁在本部署不生效。开了 prefix caching 会怎样，见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)。

分块还决定了每一步要借多少 KV 块。GLM 的块分 5 个缓存组（存储格式和借块规则相同的一组层）：full 组存稀疏 MLA 和 indexer 的逐位置历史，每 `640` 个位置一块；三个 KDA 组每组固定 `4` 块；尾状态组暂存 indexer 还没凑满 `4` 个的位置，窗口和块都是 `4` 个位置，见[块分配](vllm-kv-block-allocation.md#kda-组和尾状态组借法和普通注意力不同)。每一步借块时，还要为下一步的 `3` 个 MTP 候选多留 `3` 个位置：

```calc
title: 20,000 token 提示词每一步借块（DP0，这一条请求）
full 组第 1 步 = ceil((8,144 + 3) ÷ 640) = 13 块
full 组第 2 步再借 = ceil((16,288 + 3) ÷ 640) − 13 = 13 块
full 组第 3 步再借 = ceil((20,000 + 3) ÷ 640) − 26 = 6 块
尾状态组第 1 步手里 = ceil(8,147 ÷ 4) − 0 = 2,037 块
尾状态组第 2 步手里 = ceil(16,291 ÷ 4) − floor(8,141 ÷ 4) = 2,038 块
尾状态组第 3 步手里 = ceil(20,003 ÷ 4) − floor(16,285 ÷ 4) = 930 块
> 尾状态组：前一项是到这一步为止累计借过的块号数（含已还的），后一项是窗口外已还的块数；KDA 三组始终 12 块
```

尾状态组的数最扎眼。它要为本步全部新位置留格子，一段 `8144` 个位置当步就借 `2037` 块，按每块 `7.969 MiB` 约 `15.9 GiB`，占这个 DP 组 `3,855` 块池子（算例，见[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)）的一半多，比 full 组的 `13` 块多两个数量级；下一步已算数追上来，窗口外的整块马上还回去。第 3 段只有 `3712` 个位置，手里回落到 `930` 块；第 4 步进入 decode 后回到 `3` 块，此后在 `3–4` 块之间变动。所以在这套部署上，每段切多长不只影响这一步的计算量，也决定这一步临时要占多少块。

这些都是按源码推出来的静态账，本页没有 GLM 双机上开关分块或调预算的实测数。没有设备时，可以照上面的算式复算每一步的预算和已算位置，并沿[输入准备](prepare-inputs-flow.md)检查每一段的起始位置号和它读到的历史是否一致。

## 常见误解

- **「chunked prefill 是要手动打开的优化」**——本部署默认开着。用户未显式设置开关时，框架按模型是否支持分块来决定；生成式 encoder-decoder 模型不支持，因此不能概括成所有生成式模型都默认开启。这里的 encoder-decoder 指编码器先处理输入、解码器再据此生成输出的模型结构。每步预算和单条请求上限决定开启分块后怎样安排工作，是否开启则由开关与模型支持条件共同决定。
- **「切开以后总计算量变少了」**——没有变少。打分的位置对切不切都一样多，还多了重复读旧历史和每步的杂活；它换来的是每一步的工作量有上限。
- **「每一段都会吐出一个 token」**——只有最后一段产出第一个输出 token。中间几段也会采样，但结果不追加到请求输出。
- **「后一段要把前几段的结果拼起来」**——没有拼这一步。后一段从下一个位置号接着算，读前面存下的历史和状态。
- **「关掉它，正在生成的请求就不会被 prefill 拖慢」**——正相反。关掉后每步预算要开到装得下最长输入，一步里涌进来的位置只会更多。真正让 prefill 不和 decode 挤在同一步的做法，是把两者放到不同的节点上，也就是 [PD 分离](pd-disaggregation.md)。
- **「每一段正好是一个 KV 块」**——预算和块大小是两回事。本部署一段 8144 个位置，块是 640 个位置，切点落在块中间。
- **「KDA 的 64 位置分段就是 chunked prefill」**——不是。那是一步之内 KDA 算子重排计算的方式；chunked prefill 是调度器把一条提示词分到好几步里。
- **「每步 8192 个位置，就是每步时延有了固定上限」**——预算封的是位置数，不是毫秒。每步多久还取决于历史长度、同批请求和通信。

## 对照源码

钉点：v0.23 为 vLLM `0fc695fc` + Ascend `2c59ff10`（维护分支，没有 GLM 代码）；**本页 GLM 行为按专用镜像 Ascend `db701c1f`**，它配的也是 vLLM `0fc695fc`；v0.26 为 vLLM `568afb3a` + Ascend `2ed6cbba`；v0.30.0rc2 为 vLLM `ced6857a` + Ascend `7d825229`；main 为 vLLM `84030bbe` + Ascend `baa023ad`。

### 怎么开

完整参数类型、启动入口校验与各版变化统一见 [Scheduler 参数参考](vllm-scheduler.md#怎么开)，包括两个 partial-prefill 参数在固定版只接受默认值、在 main 已删除的边界。本页保留分块与执行路径的解释。

- **默认开着。** `SchedulerConfig.enable_chunked_prefill` 字段兜底是 `True`，docstring 说这个默认值主要为测试方便，真正生效的值由 `EngineArgs` 定（字段说明见来源 5）；在固定上游 `0fc695fc` 下，用户未显式设置开关时，`_set_default_chunked_prefill_and_prefix_caching_args` 取 `model_config.is_chunked_prefill_supported`（生成式模型只有 encoder-decoder 返回 `False`，见来源 7、10、34）[C7]。开着时启动日志有一行 `Chunked prefill is enabled with max_num_batched_tokens=%d.` [C6]，本部署应打出 `8192`。
- **每步预算**：`--max-num-batched-tokens`，本部署 `8192`；不给时昇腾上落到多少，见[调度器的怎么开](vllm-scheduler.md#怎么开)。
- **单条上限**：`--long-prefill-token-threshold`，字段默认 `0`，大于 `0` 才截。`running` 一侧先截它、再 `min(num_new_tokens, token_budget)`；`waiting` 一侧先截它，再判断关没关分块，最后 `min`（`vllm/v1/core/sched/scheduler.py#L689-L699`，见来源 3、33）[C3]。docstring 说它是「prompt 比这个数长就算长请求」的分类阈值，代码里它是直接把本步 token 数截到这个值的一道闸 [!]。只有 `max_num_partial_prefills > 1` 时它才会被自动设成 `max_model_len` 的 `4%`，而 V1 只要这两个 partial prefill 参数被改过就抛 `NotImplementedError` [C8]，所以它只能手写。
- **切点对齐与状态保存边界**：保存的历史随模型结构变化，不能据此认定所有线性注意力都支持相同的分块、状态保存边界或缓存复用。`need_mamba_block_aligned_split` 只在有 mamba 类层且 `mamba_cache_mode == "align"` 时为真；`_mamba_block_aligned_split` 在 prefill 阶段把 `num_new_tokens` 向下取整到 `block_size` 的整数倍，不足一块的尾巴照算 [C12]。GLM 专用补丁换掉这个函数：对齐单位改用调度器的共同块边界 `self.block_size`（完整 KDA 递推状态能存档的边界），而不是可能被改写成 `4` 的 `cache_config.block_size`（4-token 的 indexer-state 物理块不是所有缓存组的完整状态保存粒度，见来源 13）[C13]。本部署 `mamba_cache_mode = "none"`，这些都不生效 [D]。
- **块大小会被顺手改。** 昇腾的 `refresh_block_size` 对普通注意力模型：开着 chunked prefill 或 prefix caching、块大小又不是 `128` 时，打一条 `info` 日志并改成 `128`（`vllm_ascend/utils.py#L1429-L1432`，见来源 31）；`deepseek_v4` 和混合结构模型在更早的分支里返回，不受影响。GLM 属于混合结构，逻辑块 `640` 另有算法，见 [KV cache 规格](kv-cache-spec.md#配置阶段逻辑块先定成-640)。

### 会报什么错

- **`ValueError: max_num_batched_tokens (...) is smaller than max_model_len (...)`**：关掉分块、且显式给的预算小于 `max_model_len` 时，`verify_max_model_len` 抛出。没显式给预算时，`EngineArgs` 先把预算抬到 `max(max_model_len, 默认值)` 再校验，不报错 [C9]。本部署显式给 `8192`、`max_model_len` 是 `133120`，关掉分块就起不来 [D]。这个报错条件使用严格小于：预算恰好等于模型最大长度时，不会被这一项校验拒绝；上游优化文档使用“必须大于”的措辞，与校验在相等边界上有差异，且通过这一项校验不代表其他启动条件必然通过（来源 6、20）。
- **warning**：生成式模型手动关分块时打一次 `This model does not officially support disabling chunked prefill. Disabling this manually may cause the engine to crash or produce incorrect outputs.`
- **`NotImplementedError`（Concurrent Partial Prefill）**：改了 `max_num_partial_prefills` 或 `max_long_partial_prefills` 就抛。
- **断言 `Chunked prefill is required for mamba cache mode 'align'.`**：混合模型落到 `align` 模式、分块却关着时，启动断言失败 [C21]。
- 关掉分块后，新请求经单条阈值截断仍比余量长时 `waiting` 循环直接 `break`，不报错，只是这一步不再排新请求。

### 开销和什么时候别开

- **已算数在前向之前就前推。** `_update_after_schedule` 把本步数量加进 `num_computed_tokens`，再按「是否仍小于 `num_tokens + num_output_placeholders`」置 `is_prefill_chunk` [C4]；执行侧的位置号是 `num_computed_tokens_cpu` 加本步序号。
- **未完成 prefill 的采样不作为输出。** runner 按 `optimistic_seq_lens < num_tokens` 算出 `discard_requests_mask`，下标写进 `discard_request_indices` [C15]；采样之后，对这些请求把带种子的随机数生成器 offset 往回拨 `4` [C17]。固定 GLM runner 的同步普通采样直接清空对应行，投机采样按丢弃行过滤；异步路径先从下步输入索引和请求输出追加中排除这些行，再由异步输出对象等拷回完成后清空或过滤。各分支最终都不追加这些 token，处理时点不同；完整消费者见来源 48–51。
- **执行标签。** `_build_attn_state`（`vllm_ascend/worker/model_runner_v1.py#L1444-L1471`）分两步确定标签：① 局部 `attn_state` 先按优先级依次判断——整批 `num_computed_tokens` 全为 `0` 是 `PrefillNoCache`；否则整批 `num_scheduled_tokens` 全为 `1` 时，开 MTP 是 `SpecDecoding`、未开是 `DecodeOnly`；否则整批 `num_valid_tokens` 全为 `1`（`#L1455-L1459`，独立于后续分块开关）时，开了投机是 `SpecDecoding`、未开投机直接返回 `ChunkedPrefill`；否则最后才看 `enable_chunked_prefill`，开着叫 `ChunkedPrefill`、关着叫 `PrefillCacheHit`；② 随后 `#L1466-L1471` 在写入最终 `self.attn_state` 前做一道后置改写：若局部 `attn_state` 为 `SpecDecoding` 但投机方法非 MTP，最终 `self.attn_state` 会被改写为 `ChunkedPrefill` [C16]。在本页 `6 / 6 / 2` 与双机 `8144 / 8144 / 3712` 等各 prefill 段长度均大于 `1` 的具体算例下，一条长提示词单独进来时第 1 段是 `PrefillNoCache`、后几段是 `ChunkedPrefill`，和 decode 混批时每段都是 `ChunkedPrefill`（注意不要泛化到所有末段：若某条长提示词最后一段恰好只剩 `1` 个位置、且同批其余请求也各排 `1` 个位置，会先命中 `all(num_scheduled_tokens == 1)` 而落入 `DecodeOnly` 或 MTP 下的 `SpecDecoding`）[D]。
- **历史怎样跨段读与 KDA 算子内部 64 分段常量。** 两类状态分别对应来源 18、19：KDA 的 prefill 按 `has_initial_state` 取上一段的状态或清零，`output_final_state=True` 写回（KDA 算子内部的 `64` 位置分段常量见 `vllm_ascend/ops/kimi_kda.py#L38` 来源 39，它与调度器跨步切分的预算分别定义）；稀疏 MLA 的元数据里 KV 长度取 `seq_lens`，即含已算前文的全长，位置清单宽度是 `index_topk + index_kpool − 1`。[C18]
- **预算往哪个方向调。** 官方优化文档：小预算（例如 `2048`）ITL 更好，大预算 TTFT 更好 [S20]。预算限制的是位置数，不是时延；输出间隔、TTFT 与吞吐的变化还受历史长度、并发和通信影响，需要结合具体负载测量，不能据此保证首 token 等待、输出间隔和吞吐同时最优（来源 20）。本部署没有实测数。
- **要逐位可复现时得关。** 固定 `v0.30.0rc2` 快照 `7d825229` 与 `main` 快照 `baa023ad` 的 batch invariance 文档写明：chunked prefill、prefix caching 和抢占都不支持 batch invariance，要求用户显式关掉前两者并配 `--block-size 128`，且该模式不支持驱逐请求后通过重新计算恢复进度的抢占方式；这些限制针对该文档规定的特定运行模式和快照，不能推广为其他运行模式的共同限制（来源 27、56）[S27][S56]。本部署照做还要先解决上面那条预算小于最长输入的报错。
- **它不等于 PD 分离。** 分块只把混进 decode 步的 prefill 压到每步预算以内；要让两者不在同一步，见 [PD 分离](pd-disaggregation.md)。

### 版本差异

| 项 | v0.23 | v0.26 | v0.30.0rc2 | main |
|---|---|---|---|---|
| 未显式设置时的分块默认值 | 按模型支持能力推导，见 [Prefill 版本对照](prefill.md#版本差异) | 同左 | 同左（配套上游 `ced6857a` 仍按模型支持推导 `enable_chunked_prefill`） | 同左 |
| 单条上限与关闭分块时的接纳 | 上限默认 0；截后仍超剩余预算时停止 waiting 接纳 | 同左 | 上限默认 0；同左 | 同左；截断时多比一道为并行草稿方法预留的输入预算 [C25]，MTP 的预留是 0，GLM 的切法不变 [C26] |
| DP 组之间对齐 prefill 的节流 | 无 | 新增 DP 节拍门控；非对齐步还要满足下述运行条件才推迟本地 prefill，默认间隔 1 不触发 | `prefill_schedule_interval` 默认 1（表示不额外节流 DP 接纳，不表示关闭分块） | 同 v0.26，固定消费者的条件相同 |
| 昇腾谁会替你打开它与动态分块扩展 | `2c59ff10` 与 `db701c1f`：设了 `SLO_limits_for_dynamic_batch` 就顺手置 `enable_chunked_prefill = True` [C22] | 这段删掉，不碰这个开关 | 区分普通分块默认与动态分块扩展：Ascend `profiling_chunk` 已能在 `MRV2` 下搭配 `async`，`MRV1` 仍拒绝该组合，不改变普通 `chunked prefill` 默认值判断 | 同 v0.26 |
| runner 的执行标签 | 如上 | 标签判据相同 [C28] | 标签判据相同 | 标签判据相同 |
| batch invariance 文档 | 不提 chunked prefill | 不提 | 与 main 一致：明确 chunked prefill、prefix caching 和抢占均不兼容，须显式关掉前两者并配 `--block-size 128` [S56] | 写明要关掉 chunked prefill 与 prefix caching，并配 `--block-size 128` [S27] |

DP 节拍门控有两层条件：引擎只有在 `prefill_schedule_interval > 1` 且步号不能被间隔整除时才请求节流；Scheduler 还要求 `prefill_capacity_bound=False`，并且 `running` 中至少有一条 `is_prefill_chunk=False` 的请求。都满足时，已经在 `running` 里的 prefill 分块也会暂缓；`waiting` 里的请求若仍需本地计算多于 `1` 个位置，且没有进入异步加载远端 KV 的分支，就停止这处接纳循环。`prefill_capacity_bound` 在放行步骤按 `waiting` 是否还剩请求更新：仍有等待请求时，下一步不因这道门控继续推迟 prefill。它是调度器的容量受限标记，不是显存余量测量；v0.26 的两层判断与更新见来源 40–43，main 见来源 44–47。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 「调度器没有 prefill、decode 阶段」的注释 | `vllm/v1/core/sched/scheduler.py` 的 `schedule()` 开头 [C1] |
| running、waiting 两道减法，单条上限，关分块时停 | 同文件两个 `while`（含 `#L689-L699` 来源 33） |
| 已算数前推、`is_prefill_chunk` | 同文件 `_update_after_schedule` |
| 字段默认、自动阈值、启动日志、`verify_max_model_len` | `vllm/config/scheduler.py` |
| 默认开不开、手动关的警告、partial prefill 报错 | `vllm/engine/arg_utils.py`（含 `#L2370-L2377` 来源 34） |
| 对齐切分 | 上游 `_mamba_block_aligned_split`，开关在 `__init__`；GLM 补丁 `patch_glm5_next_mamba_scheduler.py`；APC 与 align 同开时的状态块大小在 `patch_mamba_config.py` [C29] |
| 位置号、执行标签、丢弃采样 | `vllm_ascend/worker/model_runner_v1.py` |
| KDA 接状态与 64 位置分段常量 | `vllm_ascend/ops/kimi_kda.py`（含 `#L38` 来源 39） |
| 稀疏 MLA 的 KV 长度与清单宽度 | `vllm_ascend/attention/indexer_kpool_mla_v1.py` |
| 五缓存组（full、KDA、尾状态滑窗）借块与归还 | `vllm/v1/core/single_type_kv_cache_manager.py`（`#L259-L290`、`#L448-L501`、`#L767-L793`、`#L1121-L1132`，来源 52–55） |
| 概念出处 | SARATHI 论文：把长 prefill 切成等长的块，让 decode 搭在同一批里一起算 [S30]；vLLM 优化文档里的两条好处与调参方向 |

**待核。**

1. 本部署启动日志里 `Chunked prefill is enabled with max_num_batched_tokens=8192.` 这一行，缺实机日志确认 [!]。
2. 开关分块、调整每步预算对 GLM 双机 TTFT 与 ITL 的影响，没有实测数。
