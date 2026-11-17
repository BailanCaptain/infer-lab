---
id: chunked-prefill-v2
title: Chunked prefill（循序渐进样板）：长提示词怎样分几步算完
type: feature
summary: >-
  长文章和其他用户的回答一起计算时，可能让他们等得更久。Chunked prefill 把处理长输入的工作分到几步，每步也让其他回答继续生成。长输入要跨步等待首个输出，还会多出每步开销和可能的历史重复读取；实际时延取决于这些步骤各花多久。
aliases:
  - Chunked prefill 循序渐进样板
chapters: []
toc:
  part: references
  section: 新增教学页（待编排）
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
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L259-L290'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L448-L501'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L767-L793'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1121-L1132'
verified: []
evidence: C
relations:
  - to: chunked-prefill
    kind: alternative-to
    note: 同一机制的另一种讲法，可对照分段接续、调度边界和三步借块演算
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
updated: '2026-11-10'
origin: gap
rawSources:
  - >-
    raw/sha256-a784826e7872c29e9344402dd0c34d9437753b13b503dd7eb663ea72c2414099.md
  - >-
    raw/sha256-ab8d477aec6bfdfa592d8282eafcfa581f0abbd5f9a7f08e30f386f9a7864ecd.md
---

## 一篇长文章，为什么会影响别人的回答？

**chunked prefill 把处理长输入的工作分到几步，让模型在这些步骤中也能继续生成其他用户的回答。**

假设一个聊天服务正在回答两位用户的问题，文字还在陆续出现在他们的屏幕上。此时，第三位用户提交了一篇长文章，请模型概括要点。服务要同时处理这三次提问，也就是三条**请求**。

第三位用户交给模型的文章和要求合起来叫**提示词**。模型要先处理这些输入，保存后续生成会用到的信息，才能开始回答；这个阶段叫 **prefill**。前两位用户已经收到一部分回答，模型正在接着往下生成，这个阶段叫 **decode**。

服务可以把不同请求当前要做的计算合成一批，交给模型一起执行。如果这一批既要续写前两人的回答，又要一次处理完第三人的整篇文章，前两人也得等这一批结束，才能看到新内容。文章越长，带进这一批的工作越多，就可能把他们这次的等待拉长。

有了 chunked prefill，服务每批只放入长文章的一部分，同时续写前两人的回答。下一批利用已经保存的信息，从文章断开的地方接着处理。这样，前两人的回答可以在长文章处理完之前继续往下走；提交文章的人仍要等全部输入处理完，才开始收到自己的回答。

```wiki-diagram
file: chunked-prefill-intuition-v2
```

## 三条请求放在一起，每一步怎么算？

分块发生在服务内部，用户仍然一次提交整篇文章。具体每次处理多少，由**调度器**决定：它负责安排这一批放哪些请求、各做多少工作。

调度时先数本步要新算的 **token**。一个 token 大致是一个字、一个词或词的一部分，在输入或输出序列中占一个位置。把一批输入送进模型、算出结果，叫一次前向计算，下面简称「一步」。调度器给每一步设置**位置预算**，限制整批最多新算多少个位置。

为了手算，用一条只有 14 个 token 的提示词代表那篇长文章，位置从 0 编到 13；再把每步预算设为 8。这些都是示意数。把前两位用户的请求记作 **A、B**，处理长文章的请求记作 **C**。本例中 A、B 每步各送入上一次选出的 1 个 token，模型算出分数后再各选下一个，继续回答；根据分数选 token 的过程叫**采样**。

调度器先接着处理已经在运行的请求，再用剩下的预算接纳新请求。A、B 每步合用 2 个位置，8 个里还剩 6 个，可以分给 C。C 每步实际拿多少，还要看它有多少位置没算：把提示词总长减去已算数量，再和剩余预算比较，取较小值。下面的 min 就表示取较小值。

```calc
title: C 的提示词怎样分三步处理（示意）
第 1 步 = min(14 − 0, 8 − 2) = 6 个位置
第 2 步 = min(14 − 6, 8 − 2) = 6 个位置
第 3 步 = min(14 − 12, 8 − 2) = 2 个位置
```

第一步，C 还没算过，剩下 14 个位置，本步只能拿到 6 个，于是处理位置 0–5。第二步，它还剩 8 个，仍拿 6 个，接着处理位置 6–11，并使用前一步保存的信息。第三步，只剩位置 12、13，算完这两个就把提示词读完了。这一步 A、B、C 合计只用 4 个位置；其余预算可以接纳别的请求，没有也不必填满。短提示词如果一开始就装得进余量，便能一步处理完。

**C 的第一个回答 token 在第三步末尾出现。** 前两步也会在 C 本步最后一个位置做采样，但提示词还没处理完，结果直接丢弃。第三步算完位置 13，采样选出的 token 才作为回答返回，图里把它记作 y₀。第四步把 y₀ 送回模型，C 从此也像 A、B 一样，每步处理 1 个位置、继续生成。A、B 在这四步中每步都前进了一次。

```wiki-diagram
file: chunked-prefill
```

图中的三段长度是每步根据余量算出来的，最后一段只有 2 个位置。真实运行时，每步能给 C 多少还会随其他请求和可用存储变化，后文会展开；预算为什么按位置而非请求条数计算，见[调度器](../../../../wiki/concepts/vllm-scheduler.md#为什么按-token-设预算还要另设请求数上限)。

## 分成三步，换来了什么？

回到前两位用户的等待。在单条请求上限保持默认、不另行截断的情况下，关闭分块就要求 C 的 14 个位置在一次计算里处理完。要把它和 A、B 放进同一批，不切的方案得先把预算开大，容纳三条请求这一步的全部工作；分块的方案仍用刚才的预算 8：

```calc
title: C 加入时，同一批要新算多少位置（示意）
不切，C 一步算完 = 1 + 1 + 14 = 16 个位置
切开，每步最多 = 1 + 1 + 6 = 8 个位置
> 两种安排下，A、B 都要等自己所在的这一批计算结束，才能拿到下一个 token
```

不切时，A、B 等的是包含 C 整条提示词的一步；切开后，每步只混入 C 的一段。C 的大段工作被分散到几步，A、B 在这几步里都有生成机会。真实配置还要求关闭分块时的预算能覆盖允许的最长输入，具体校验和单条上限的组合见后文。

对正在看回答的用户，关心的是相邻两个输出 token 之间隔了多久，这个间隔叫 **ITL（inter-token latency）**。位置数从 16 降到 8，只说明这一批新算的位置少了；历史有多长、同批还有什么请求、计算和通信各花多久，都会影响耗时，因此不能直接推出等待减半。

对提交长文章的用户，情况又不同：C 跨三步才开始回答，期间还穿插着其他请求的计算。分块增加了调度和准备输入等每步开销，也可能重复读取前面的计算信息。每步工作变少和完成整条请求需要更多步骤，是这项安排同时带来的两面；实际首输出等多久，要结合每步耗时看。

把两种工作放在同一批还有复用权重的机会。权重是模型计算时反复使用的参数；decode 每条请求只有很少的新位置，提示词块则提供了更多位置。合批后，多行输入共用同一份权重，一次读取可以服务多个位置，每步固定的调用开销也有机会分摊。实际读量和收益取决于缓存、内核与批次，理想情况下的复用怎么算，见 [Prefill 与 Decode](../../../../wiki/concepts/prefill.md#为什么把已知的位置合成一步代价在哪)。

还有一个问题：C 到第二步只新算位置 6–11，为什么仍能利用位置 0–5 的内容？这要看分段之间究竟保存了什么。

## 为什么能接上：位置号、历史和状态

第 2 步只新算 C 的位置 6–11，位置 6 却还需要前面的 0–5。接上前文，靠的是保留原来的位置号，以及上一段已经存下的信息。

**先看普通因果注意力。** 注意力让当前位置根据相关程度取用前面位置的信息。为此，每个位置会留下两个向量：K（键，用来比较相关程度）和 V（值，按相关程度取用的内容）。这些向量保存在显存里，叫 [KV cache](../../../../wiki/concepts/kv-cache.md)。后一段直接读取它们，就不用重新计算前一段。

- **位置号继续往后。** 准备输入时，位置号从本步开始前的「已算」往后编，而不是用调度器刚前推的步末值：第 2 段的位置号是 6、7……11，不从 0 重来。[因果掩码](../../../../wiki/concepts/attention-qkv.md#因果掩码限定每个位置能访问的历史)限定每个位置只能看自己和前面的位置：位置 6 看 0–6，位置 11 看 0–11。分段前后，位置编号和因果注意力的计算关系都没有改变。
- **历史在原处追加。** KV cache 按固定大小的块借给请求，每条请求有一张 [block table](../../../../wiki/concepts/block-table.md)（块表，记着它借到了哪些块）。准备输入时，按块表查出新位置的 K、V 要写进哪一格。第 1 段的内容留下，第 2 段只追加；计算第 2 段时，注意力一起使用前文和本段的 K、V。这些张量怎样拼成一批，见[输入准备](../../../../wiki/concepts/prepare-inputs-flow.md)。

**线性注意力保留的是递推状态。** [线性注意力](../../../../wiki/concepts/linear-attention.md)层可以为每条请求保存一份固定大小的状态，用它汇总此前历史，而不是保存每个位置的 K、V。读到新 token 时，状态随之更新。上一段的最终状态成为下一段的初始状态，算完再写回。两类层保存的信息不同，都能沿着同一条请求继续计算。

A、B、C 在同一步里一起算，但互不干扰：各用各的位置号、各自的块和状态槽；A 的 decode 读的是 A 的历史，C 的一段读的是 C 的历史。

最后是采样，也就是根据模型给出的分数选出一个 token。每条请求都在自己本步最后一个位置选一次。C 的「已算」还没追上提示词长度时，这个 token 当场丢掉：不追加到请求上，也不返回给客户端，下一步回到调度；追上了，选出的就是第一个输出 token，从下一步起 C 按 decode 排。首个输出与后续生成怎样衔接，见 [Prefill 与 Decode](../../../../wiki/concepts/prefill.md#回答的第一个字出来之前模型在算什么)。

把这些动作放回[一条请求的主线](../../../../wiki/concepts/one-request.md#一条请求要走过七站)，每段都经过第 2 到第 5 站：调度、准备输入、前向、采样。下图中的 ChunkedPrefill 是本例这种混合批次的执行标签；不同批次怎样选标签，见页末源码区。

```wiki-diagram
file: chunked-prefill-flow
```

## 代价在哪：首个 token 更晚，旧历史要再读几遍

切开不是白来的，代价有三处。

**C 的第一个 token 要等三步。** 不切时，C 在进来那一步末尾就有 y₀，只是那一步很大；切开后前两步都只在「读题」。衡量这段等待的指标是 TTFT（time to first token）：从请求到达到第一个输出 token 的时间。预算越小，长提示词要跨越的步数越多；预算越大，某一步里塞进的 prefill 计算越多。要注意，预算封住的是一步算多少个位置，不是一步花多少毫秒：同样数量的位置，历史长短、同批请求和通信不同，耗时也不同。所以减小预算不保证 ITL 更稳，增大预算也不保证 TTFT 更短，这些指标怎样变化要在具体负载下测量。

**后面的段要再读前面的历史。** 普通因果注意力里，每个位置都要用到自己和前面所有位置的 K、V。第 2 段依赖第 1 段，第 3 段依赖前两段。下面比较的是「逻辑访问量」：把每一段需要看到的历史位置数加起来，假设一段之内充分复用、每段只把可见历史计一次。它不是硬件上真的从显存（昇腾卡上的 HBM，高带宽显存）读了几次：

```calc
title: 切成三段，注意力的账怎样变（示意，普通因果注意力）
不切，可见历史范围计一次 = 14 个位置
切开，三段可见历史分别计一次 = 6 + 12 + 14 = 32 个位置
打分的位置对，切不切都一样 = 1 + 2 + … + 14 = 105 对
> 位置 i 只和 0 到 i 打分，与它在哪一步算无关
```

多出来的是跨段重复覆盖的历史范围，不是打分次数。chunked prefill 并不通过删掉因果位置对来省计算，而是把一次很重的 prefill 摊到多步。

**每一步都多一点杂活。** 步数多了，调度、准备输入这些每步都有的开销也多做几次。前两步还在 C 的最后一个位置上白做一次词表投影（把这个位置的向量变成每个候选 token 的分数）和采样，结果扔掉；白做的只有这一个位置，不是整个前向重走一遍。

所以调一次预算好不好，要同时看 TTFT、ITL、总吞吐，以及长、短请求各自的分布，并记下当时的并发、输入输出长度和实际生效的预算。只看平均吞吐会掩盖长请求等得久，只看短请求的 ITL 又会忽略长提示词推进得慢。

## 还能怎么切：单条上限、关闭分块和对齐切分

**单条请求一步的上限。** 可以另设「一条请求一步最多拿多少个位置」。它在剩余预算之前先截一刀，正在运行和等待接纳的请求都受这个上限限制；默认是 0，表示不设。假如示意里把它设成 4，C 就按 4、4、4、2 分四步，前三步各给别的新请求留出 2 个位置，代价是 C 的第一个 token 再晚一步。

**关闭分块。** 分块默认开着：用户没有显式设置开关时，按模型是否支持分块来决定。手动关闭、且单条上限保持默认 0 时，一条比本步余量长的新请求排不进来，调度器这一步就停止接纳新请求，排在它后面的短请求也跟着等。若另设了正的单条上限，调度器先按上限截断、再检查分块开关：截完能排进预算、原请求还有剩余时，仍然分段。关闭分块还要求每步预算装得下允许的最长输入，否则启动时就报错；上游还会警告，手动关掉可能让引擎崩溃或算出错误结果。pooling 请求是否允许分块要另查配置，不能照搬生成模型的默认。各参数组合的边界见 [Scheduler 参数参考](../../../../wiki/concepts/vllm-scheduler.md#怎么开)。

**切点和 KV 块。** 位置预算管一步算多少个位置；KV 块大小管历史按多大一格存、怎样寻址。即使两者数值相等，含义也不同。调度器按预算切，一段可以停在某个块的中间，下一段接着往这个块里写。例外出在混合模型（既有普通注意力层、又有线性注意力层）开了 prefix caching（开头相同的请求复用已经算好的历史）时：如果模型不支持逐块保存线性注意力的状态，就落到按块对齐存档的模式，调度器把每段向下取整到块大小的整数倍，最后不足一块的尾巴照常算。支持逐块保存状态的模型不需要这样对齐。物理存储块也可以比完整状态的保存边界小：存储按多大分格，和在哪些位置能留下供复用的完整状态，是两件事。

**每步实际切多少，不只看预算。** 在跑的请求数、KV 块够不够、已算进度、为 speculative decoding（投机解码：先草拟几个候选 token，下一步一起验证）预留的位置，以及块不够时的抢占，都会改变某一步排给长提示词的量。示意里的 6、6、2 是能手算的安排，不代表调度策略对各请求公平。

**昇腾自带的变体。** 镜像里还有按性能剖析决定每段切多长的 ProfilingChunkScheduler、按时延目标动态调预算的调度器等，本部署都没启用，见[昇腾上跑的是哪个调度器](../../../../wiki/concepts/vllm-scheduler.md#昇腾上跑的是哪个调度器)和 [profiling chunk 配置](../../../../wiki/params/profiling-chunk-config.md)。

## 放到 GLM 双机：20,000 个 token 的提示词分三步

部署前提见[部署页](../../../../wiki/concepts/glm-5-3-flash-two-node.md#部署前提)。两台机器各是一个 DP 组（各自独立排请求的执行组），各有一个调度器，每组每步预算 8192 个位置、最多 32 条请求，见[调度器的 GLM 一节](../../../../wiki/concepts/vllm-scheduler.md#放到-glm-双机一个-dp-组里的-r1)。chunked prefill 本部署按默认开着。每条 decode 请求一步算 4 个位置：1 个确定的 token，加 3 个 MTP 候选（MTP 是 GLM 自带的多 token 预测层，每步先草拟 3 个候选，下一步由主模型一起验证）。

所以新提示词比「8192 − 4 × 在跑的条数」还长才会被切；新请求能进来时，这个门槛最低是 8068，推导见[并发页](../../../../wiki/concepts/concurrent-requests.md#提示词超过剩余预算时分几步算)。主线的示例请求 [R1](../../../../wiki/concepts/one-request.md#示例请求-r1-与官方双机部署) 提示词只有 4 个 token（教学设定），[场景 M](../../../../wiki/concepts/concurrent-requests.md#示例场景-m-与变体-m)（一个 DP 组里已有 12 条请求在 decode，又来一条 6000 token 的新请求）的新提示词也一步装得下，它们都用不上分块。

把场景 M 的新请求换成一条 20,000 token 的提示词：前两步各算 8144 个位置、把预算用满，第 3 步算最后 3712 个，本步末得到第一个输出 token，第 4 步起它也每步 4 个；逐步的预算账在[并发页](../../../../wiki/concepts/concurrent-requests.md#提示词超过剩余预算时分几步算)。和示意图一样，那 12 条 decode 请求在这 4 步里每步都被排进去、各前进一轮；它们的输出间隔会不会变长，取决于这几步各花多久。

执行侧，这三步和纯 decode 步有几处不同，这里只给结论，机制在各自页面：

- **不回放图，MoE 通信换路径。** 一批里既有 decode 又有一段提示词，或者一段提示词接着前面算，整批都贴 ChunkedPrefill 执行标签，意思是「有一部分历史已经在缓存里」。这几步因此走 eager mode（由 CPU 逐个下发算子），不回放录好的 decode 图；一步超过 128 个 token，MoE 层（每个 token 只挑几个专家来算）的通信改走 AllGather（两台机器先互相收齐这一步全部 token 的隐藏向量，每张卡再挑出路由给自己专家的那些），两台机器一起改，见[并发页的 MoE 通信](../../../../wiki/concepts/concurrent-requests.md#第-4-站-moe-通信6048-个-token-把两台机器一起推过-128-的门槛)。
- **34 层 KDA 接着上一段的状态算。** KDA 是 GLM 的线性注意力层。每一段在 KDA 算子里面还会再切成每 64 个位置一小段并行算，那是 KDA 自己的算法，和调度器的分块是两回事，见[线性注意力](../../../../wiki/concepts/linear-attention.md#prefill-用-chunked-计算decode-逐位置推进)。
- **11 层稀疏 MLA 在前面全部位置里挑着读。** 稀疏 MLA 是 GLM 的另一类注意力层，每个查询只挑一部分历史位置来读。第 2 段的查询面前已有 8144 个以上的位置：indexer（一个很便宜的打分网络）先给因果范围内的历史打分，主注意力只读挑中的那部分，清单每行最多 2051 个位置。所以真实读取量不是「各段历史长度之和」，见[稀疏注意力](../../../../wiki/concepts/sparse-attention.md#放到-glm-双机一个查询在一层稀疏-mla-里怎样挑怎样读)。
- **切点不对齐到块。** 一个逻辑块是 640 个位置，8144 = 12 × 640 + 464，第 2 段从第 13 块的第 465 格接着写。本部署关着 prefix caching，KDA 的缓存不按块存档，调度器不需要对齐切分；昇腾为按块对齐准备的 GLM 补丁在本部署不生效。开了 prefix caching 会怎样，见 [prefix caching](../../../../wiki/concepts/prefix-caching.md#glm-双机上它开着吗)。

### 这三步怎样借块和还块

同一条 20,000 token 请求，每步还要借到足够的 KV 块，才能把历史和状态存下来。这里按上面的三段长度连续推算；块数是静态演算，池子不足、调度安排改变时要重新算。

GLM 把存储格式和借块规则相同的层归为一个缓存组，共有五组。**full 组**存稀疏 MLA 和 indexer 的逐位置历史，每 640 个位置一块，随着请求推进继续借；**三个 KDA 组**各留 1 份当前状态和 3 份 MTP 候选状态，每组固定 4 块，第一步借齐。**尾状态组**暂存 indexer 还没凑满 4 个位置的信息，窗口和块都是 4 个位置：它要为本步全部新位置留空间，下一步再还掉窗口外的整块。各组的管理规则见[块分配](../../../../wiki/concepts/vllm-kv-block-allocation.md#kda-组和尾状态组借法和普通注意力不同)。

每步还为下一步的 3 个 MTP 候选预留位置。full 组先算累计需要多少块，再减去已经借到的块；尾状态组先还窗口外的整块，再补到装得下本步末尾和预留位置。若步前已经算了 c 个位置，窗口外有 c − 3 个位置，只有其中凑满整块的才归还；第一步尚无历史可还。下面 ceil 表示向上取整，不足一块也要借一块；floor 表示向下取整，只数已经完整越过窗口的块。

```calc
title: 20,000 token 提示词三步借块（DP0，只计这一条请求）
full 第 1 步借 = ceil((8,144 + 3) ÷ 640) = 13 块
full 第 2 步再借 = ceil((16,288 + 3) ÷ 640) − 13 = 13 块
full 第 3 步再借 = ceil((20,000 + 3) ÷ 640) − 26 = 6 块

尾状态第 1 步持有 = ceil(8,147 ÷ 4) − 0 = 2,037 块
尾状态第 2 步持有 = ceil(16,291 ÷ 4) − floor(8,141 ÷ 4) = 2,038 块
尾状态第 3 步持有 = ceil(20,003 ÷ 4) − floor(16,285 ÷ 4) = 930 块
> 前一项是累计需要覆盖的块号数，后一项是窗口外已经归还的整块数

KDA 三组常驻 = 3 × (1 + 3) = 12 块
```

注意两种数字的区别：full 组的 13、13、6 是各步**新借**的数量，第三步后累计持有 32 块；尾状态组的 2037、2038、930 是各步借还完成后**手里还留着**的数量。它一边借、一边还，不能把三步持有量加起来当成最终占用。

这也解释了为什么长段会暂时占很多块。第一段的尾状态组就要 2037 块，按[每张卡每块约 7.969 MiB、池子 3,855 块的预算算例](../../../../wiki/concepts/glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)，在每张卡上约占 15.9 GiB，超过该卡 KV 池预算的一半；块数比 full 组的 13 块多两个数量级。第三段缩到 3712 个位置时，它回落到 930 块；第四步按前述每轮 4 个位置进入 decode，回到 3 块，后续完整 decode 步常在 3–4 块之间变动，具体条件见[尾状态组的借还规则](../../../../wiki/concepts/vllm-kv-block-allocation.md#kda-组和尾状态组借法和普通注意力不同)。所以段长既影响本步的计算，也影响本步临时需要的存储空间。

## 常见误解

- **「chunked prefill 是要手动打开的优化」**——本部署默认开着。用户未显式设置开关时，框架按模型是否支持分块来决定；生成式 encoder-decoder 模型（编码器先处理输入、解码器再据此生成输出的结构）不支持，因此不能概括成所有生成式模型都默认开启。每步预算和单条上限决定开启后怎样安排工作，是否开启则由开关与模型支持条件共同决定。
- **「切开以后总计算量变少了」**——没有变少。打分的位置对切不切都一样多，还多了重复读旧历史和每步的杂活；它换来的是每一步的工作量有上限。
- **「每一段都会吐出一个 token」**——只有最后一段产出第一个输出 token。中间几段也会采样，但结果当场丢掉。
- **「后一段要把前几段的结果拼起来」**——没有拼这一步。后一段从下一个位置号接着算，读前面存下的历史和状态。
- **「关掉它，正在生成的请求就不会被 prefill 拖慢」**——正相反。关掉后每步预算要开到装得下最长输入，一步里涌进来的位置只会更多。真正让 prefill 不和 decode 挤在同一步的做法，是把两者放到不同的节点上，也就是 [PD 分离](../../../../wiki/concepts/pd-disaggregation.md)。
- **「每一段正好是一个 KV 块」**——预算和块大小是两回事。本部署一段 8144 个位置，块是 640 个位置，切点落在块中间。
- **「KDA 的 64 位置分段就是 chunked prefill」**——不是。那是一步之内 KDA 算子重排计算的方式；chunked prefill 是调度器把一条提示词分到好几步里。
- **「每步 8192 个位置，就是每步时延有了固定上限」**——预算封的是位置数，不是毫秒，见上文「代价在哪」。

## 对照源码

钉点：v0.23 为 vLLM `0fc695fc` + Ascend `2c59ff10`（维护分支，没有 GLM 代码）；**本页 GLM 行为按专用镜像 Ascend `db701c1f`**，它配的也是 vLLM `0fc695fc`；v0.26 为 vLLM `568afb3a` + Ascend `2ed6cbba`；main 为 vLLM `84030bbe` + Ascend `baa023ad`。

### 怎么开

完整参数类型、启动入口校验与三版变化统一见 [Scheduler 参数参考](../../../../wiki/concepts/vllm-scheduler.md#怎么开)，包括两个 partial-prefill 参数在固定版只接受默认值、在 main 已删除的边界。本页保留分块与执行路径的解释。

- **默认开着。** `SchedulerConfig.enable_chunked_prefill` 字段兜底是 `True`，docstring 说这个默认值主要为测试方便，真正生效的值由 `EngineArgs` 定（字段说明见来源 5）；用户没写时，`_set_default_chunked_prefill_and_prefix_caching_args` 取 `model_config.is_chunked_prefill_supported`，生成式模型只有 encoder-decoder 返回 False [C7]（固定上游 0fc695fc，另见来源 10）。开着时启动日志有一行 `Chunked prefill is enabled with max_num_batched_tokens=%d.` [C6]，本部署应打出 8192。
- **每步预算**：`--max-num-batched-tokens`，本部署 8192；不给时昇腾上落到多少，见[调度器的怎么开](../../../../wiki/concepts/vllm-scheduler.md#怎么开)。
- **单条上限**：`--long-prefill-token-threshold`，字段默认 0，大于 0 才截。running（正在运行的请求队列）一侧先截它、再 `min(num_new_tokens, token_budget)`；waiting（等待接纳的请求队列）一侧先截它，再判断关没关分块，最后 `min` [C3]。docstring 说它是「prompt 比这个数长就算长请求」的分类阈值，代码里它是直接把本步 token 数截到这个值的一道闸 [!]。只有 `max_num_partial_prefills > 1` 时它才会被自动设成 `max_model_len` 的 4%，而 V1 只要这两个 partial prefill 参数被改过就抛 `NotImplementedError` [C8]，所以它只能手写。
- **切点对齐**：`need_mamba_block_aligned_split` 只在有 mamba 类层且 `mamba_cache_mode == "align"` 时为真；`_mamba_block_aligned_split` 在 prefill 阶段把 `num_new_tokens` 向下取整到 `block_size` 的整数倍，不足一块的尾巴照算 [C12]。GLM 镜像用补丁 `patch_glm5_next_mamba_scheduler.py` 换掉这个函数：对齐单位改用调度器的 `self.block_size`（完整 KDA 状态能存档的公共边界），而不是可能被改写成 4 的 `cache_config.block_size` [C13]。这个补丁允许混合缓存的最小物理块对应 4 个 token，它只是 indexer-state 的物理分格，不是所有缓存组的完整状态保存粒度，不能由此推出每隔 4 个位置都能存下完整递推状态。本部署 `mamba_cache_mode = "none"`，这些都不生效 [D]。
- **块大小会被顺手改。** 昇腾的 `refresh_block_size` 对普通注意力模型：开着 chunked prefill 或 prefix caching、块大小又不是 128 时，静默改成 128，只打一条 info 日志；`deepseek_v4` 和混合结构模型在更早的分支里返回，不受影响。GLM 属于混合结构，逻辑块 640 另有算法，见 [KV cache 规格](../../../../wiki/concepts/kv-cache-spec.md#配置阶段逻辑块先定成-640)。

### 会报什么错

- **`ValueError: max_num_batched_tokens (...) is smaller than max_model_len (...)`**：关掉分块、且显式给的预算小于 `max_model_len` 时，`verify_max_model_len` 抛出。没显式给预算时，`EngineArgs` 先把预算抬到 `max(max_model_len, 默认值)` 再校验，不报错 [C9]。本部署显式给 8192、`max_model_len` 是 133120，关掉分块就起不来 [D]。这个条件是严格小于：预算恰好等于 `max_model_len` 时能通过这一项校验，但优化文档写作「必须大于」，通过这一项也不代表其他启动条件必然通过（来源 6、20）。
- **warning**：生成式模型手动关分块时打一次 `This model does not officially support disabling chunked prefill. Disabling this manually may cause the engine to crash or produce incorrect outputs.`
- **`NotImplementedError`（Concurrent Partial Prefill）**：改了 `max_num_partial_prefills` 或 `max_long_partial_prefills` 就抛。
- **断言 `Chunked prefill is required for mamba cache mode 'align'.`**：混合模型落到 align 模式、分块却关着时，启动断言失败 [C21]。
- 关掉分块后，新请求经单条阈值截断仍比余量长时，接纳新请求的循环直接 `break`，不报错，只是这一步不再排新请求。

### 开销和什么时候别开

- **队列与提前记账。** 调度器先续上 running 队列中的请求，再用剩余预算从 waiting 队列接纳请求。示意中的 C 第一步从 waiting 排入，随后留在 running，第二、三步和 A、B 一起先被续上。每步安排完成后、前向执行之前，`_update_after_schedule` 就把本步数量加进 `num_computed_tokens`：本例依次从 0 前推到 6、12、14，供下一步接着排；再按「是否仍小于 `num_tokens + num_output_placeholders`」置 `is_prefill_chunk`，标明提示词是否仍未算完 [C4]。执行侧仍用步前的 `num_computed_tokens_cpu` 加本步序号来排位置。两个队列和每一关的细节见[调度器](../../../../wiki/concepts/vllm-scheduler.md#调度器怎样排一步还差几个--截断--借块--记账)。
- **白采样当场扔掉。** runner 按 `optimistic_seq_lens < num_tokens` 算出 `discard_requests_mask`，下标写进 `discard_request_indices` [C15]；请求自带随机种子时，采样之后对这些请求把随机数生成器的 offset 往回拨 4，免得这次白采样打乱之后真正的采样 [C17]。
- **执行标签。** `_build_attn_state` 依次判断：整批都没算过是 `PrefillNoCache`；整批每条 1 个 token 是 `DecodeOnly`（开 MTP 时改成 `SpecDecoding`）；有效 token 全是 1 且开了投机是 `SpecDecoding`；剩下的，开着分块叫 `ChunkedPrefill`，关着叫 `PrefillCacheHit` [C16]。一条长提示词单独进来时，第 1 段是 `PrefillNoCache`、后几段是 `ChunkedPrefill`；和 decode 混批时每段都是 `ChunkedPrefill` [D]。
- **历史怎样跨段读。** 两类状态分别对应来源 18、19：KDA 的 prefill 按 `has_initial_state` 取上一段的状态或清零，`output_final_state=True` 写回；稀疏 MLA 的元数据里 KV 长度取 `seq_lens`，即含已算前文的全长，位置清单宽度是 `index_topk + index_kpool − 1`。[C18] KDA 算子内部的 64 位置分段常量见来源 39，它与调度器跨步切分的预算分别定义。
- **合批的好处有多大不固定。** decode 与提示词块合批带来的权重复用，实际读量、是否更快以及主要瓶颈仍取决于缓存、内核与批次。
- **预算往哪个方向调。** 官方优化文档：小预算（例如 2048）ITL 更好，大预算 TTFT 更好 [S20]。这只是方向，不能据此保证首 token 等待、输出间隔和吞吐同时最优，具体数值仍须在负载下测量。
- **要逐位可复现时得关。** main（快照 `baa023ad`）的 batch invariance 文档写明：chunked prefill、prefix caching 和抢占都不支持 batch invariance，要显式关掉前两者，并把关分块和 `--block-size 128` 配在一起；该模式也不支持驱逐请求后靠重新计算恢复进度的抢占 [S27]。这些要求只针对该文档规定的运行模式和快照，不能推广为所有部署的限制。本部署照做还要先解决上面那条预算小于最长输入的报错。
- **它不等于 PD 分离。** 分块只把混进 decode 步的 prefill 压到每步预算以内；要让两者不在同一步，见 [PD 分离](../../../../wiki/concepts/pd-disaggregation.md)。

### 版本差异

**v0.30.0rc2 区分普通分块默认与动态分块扩展。** 配套上游仍按模型支持推导 enable_chunked_prefill，long_prefill_token_threshold 默认 0，DP 的 prefill_schedule_interval 默认 1；间隔为 1 表示不额外节流 DP 接纳，不表示关闭分块。Ascend profiling_chunk 已能在 MRV2 下搭配 async，MRV1 仍拒绝该组合；这不改变普通 chunked prefill 的默认值判断。

| 项 | v0.23 | v0.26 | main |
|---|---|---|---|
| 默认开、单条上限默认 0、关分块时 waiting 直接停 | 有 | 同 | 同；截断时多比一道为并行草稿方法预留的输入预算 [C25]，MTP 的预留是 0，GLM 的切法不变 [C26] |
| DP 组之间对齐 prefill 的节流 | 无 | 新增 `throttle_prefills`：`prefill_schedule_interval > 1` 时非对齐步推迟新 prefill；默认 1，不触发 [C23] | 同 v0.26 |
| 昇腾谁会替你打开它 | `2c59ff10` 与 `db701c1f`：设了 `SLO_limits_for_dynamic_batch` 就顺手置 `enable_chunked_prefill = True` [C22] | 这段删掉，不碰这个开关 | 同 v0.26 |
| 执行标签与丢弃采样 | 如上 | 判据相同 [C28] | 相同 |
| batch invariance 文档 | 不提 chunked prefill | 不提 | 写明要关掉 chunked prefill 与 prefix caching，并配 `--block-size 128` |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 「调度器没有 prefill、decode 阶段」的注释 | `vllm/v1/core/sched/scheduler.py` 的 `schedule()` 开头 [C1] |
| running、waiting 两道减法，单条上限，关分块时停 | 同文件两个 `while` |
| 已算数前推、`is_prefill_chunk` | 同文件 `_update_after_schedule` |
| 字段默认、自动阈值、启动日志、`verify_max_model_len` | `vllm/config/scheduler.py` |
| 默认开不开、手动关的警告、partial prefill 报错 | `vllm/engine/arg_utils.py` |
| 对齐切分 | 上游 `_mamba_block_aligned_split`，开关在 `__init__`；GLM 补丁 `patch_glm5_next_mamba_scheduler.py`；APC 与 align 同开时的状态块大小在 `patch_mamba_config.py` [C29] |
| 位置号、执行标签、丢弃采样 | `vllm_ascend/worker/model_runner_v1.py` |
| KDA 接状态 | `vllm_ascend/ops/kimi_kda.py` |
| 稀疏 MLA 的 KV 长度与清单宽度 | `vllm_ascend/attention/indexer_kpool_mla_v1.py` |
| full、尾状态、KDA 三组的借块与归还 | `vllm/v1/core/single_type_kv_cache_manager.py`：full 分配见来源 40；滑窗归还见来源 41；窗口外整块数公式见来源 42；KDA 预留见来源 43 |
| 概念出处 | SARATHI 论文：把长 prefill 切成等长的块，让 decode 搭在同一批里一起算 [S30]；vLLM 优化文档里的两条好处与调参方向 |

**待核。**

1. 本部署启动日志里 `Chunked prefill is enabled with max_num_batched_tokens=8192.` 这一行，缺实机日志确认 [!]。
2. 开关分块、调整每步预算对 GLM 双机 TTFT 与 ITL 的影响，没有实测数。GLM 一节的切法与借块都是按源码推出的静态账；没有设备时，可以照上面的算式复算每一步的预算和已算位置，并沿[输入准备](../../../../wiki/concepts/prepare-inputs-flow.md)检查每一段的起始位置号和它读到的历史是否一致。

**适用边界。** 保存的历史随模型结构变化，不能据此认定所有线性注意力都支持相同的分块、状态保存边界或缓存复用（GLM 补丁的保存边界见上文「切点对齐」与来源 13）。

- 来源 33：vllm@0fc695fc，vllm/v1/core/sched/scheduler.py，L689–L699。
- 来源 34：vllm@0fc695fc，vllm/engine/arg_utils.py，L2370–L2377。
