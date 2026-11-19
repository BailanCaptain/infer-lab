---
id: batch-job-aware-scheduler
title: Batch-Job-Aware Scheduler：先给正在生成的请求留块，再按作业接新请求
type: feature
summary: >-
  vllm-ascend 为离线批处理准备的调度器：接新请求前先估计 running 下一步要借几块 KV 块并扣下来，只拿余额接新请求；waiting
  按作业分桶，用已自然结束请求的输出长度估计决定先接哪个作业，桶内挑放得进预算的最长提示词。只改 waiting 一段，不防饿死；GLM
  双机钉住的镜像里没有它。
aliases:
  - Batch-Job-Aware Scheduler
  - 批作业感知调度器
  - 批作业感知调度
  - BatchJobAwareScheduler
  - BatchJobAwareRequestQueue
  - RunningBlockReserver
  - JobDecodeEstimator
  - batch_job_sched_config
  - job_name
  - EWMA
chapters:
  - '12'
order: 40
sources:
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L622-L641'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L238-L287'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L509-L541'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L57-L74'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L126-L173'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L554-L609'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L315-L333'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L643-L682'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L496-L507'
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/batch_job_aware_scheduler.md#L3-L5
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L757-L802'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L652-L680'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L709-L725'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L191-L236'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L372-L397'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L419-L495'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L611-L620'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L669-L694'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L1963-L1986'
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/batch_job_aware_scheduler.md#L7-L19
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/batch_job_aware_scheduler.md#L52-L75
  - >-
    vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/batch_job_aware_scheduler.md#L77-L89
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L240-L263'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L357-L378
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L98-L117
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1261-L1280'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1300-L1337'
  - >-
    vllm-ascend@2ed6cbba:tests/e2e/pull_request/one_card/test_batch_job_aware_scheduler_e2e.py#L13-L207
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L998-L1026'
  - 'vllm-ascend@baa023ad:vllm_ascend/config_utils.py#L35-L48'
  - 'vllm@568afb3a:vllm/v1/request.py#L109-L114'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L2134-L2139'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L2586-L2610'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L1228-L1234'
  - >-
    raw:sha256-bb72568af59f87eff3e608fc6086a5eab677a5aaf04811b539162a69ca5b6049.md#L1-L1024
  - 'vllm-ascend@7d825229:vllm_ascend/core/batch_job_aware_scheduler.py#L57-L74'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1389-L1398'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1052-L1056'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1377-L1398'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/model.py#L824-L857'
  - 'vllm@568afb3a:vllm/v1/engine/output_processor.py#L649-L696'
  - 'vllm@568afb3a:vllm/v1/engine/async_llm.py#L685-L689'
  - 'vllm@568afb3a:vllm/v1/engine/core.py#L479-L483'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1517-L1555'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1058-L1066'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1380-L1408'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1610-L1648'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1243-L1252'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1586-L1630'
  - 'vllm-ascend@8d6180e2:vllm_ascend/core/batch_job_aware_scheduler.py#L445-L458'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: vllm-scheduler
    kind: builds-on
    note: 理解等待队列如何影响准入
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 理解缓存增长与抢占回收
  - to: chunked-prefill
    kind: builds-on
    note: 理解当前轮和下一轮的输入预算
  - to: concurrent-requests
    kind: builds-on
    note: 场景 M 第 2 站的整批预算与块账，本页只讲在它上面多出的准入检查
  - to: short-request-first
    kind: alternative-to
    note: 另一种改 waiting 顺序的调度器，两者同开启动即报错
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-12b04055f0789082f8ee94e05542b97c0e2891c1a33877063f1757252ab660ed.md
  - >-
    raw/sha256-bb72568af59f87eff3e608fc6086a5eab677a5aaf04811b539162a69ca5b6049.md
---

## 一大批请求排着队，这一步该放几条新请求进来？

**Batch-Job-Aware Scheduler（批作业感知调度器）是 vllm-ascend 为离线批处理准备的调度器：接新请求之前，它先估计正在生成的请求下一步还要借几块 KV 块，把这部分从空闲块里扣下来，只拿剩下的余额接新请求；先接谁，则看请求属于哪个「作业」，以及这个作业以往的输出有多长。**

几个词先说清楚。调度器每一步决定哪些请求各算几个 token，见[调度器](vllm-scheduler.md)；它手里有两队请求：running 是已经排上、正在推进的请求，waiting 是已经到达、还没排上的请求。KV 块是显存里预先切好的一格格存储，存每个位置算出的历史，一块能装好几个位置，请求把手里的块写满了才借新块，见[块分配](vllm-kv-block-allocation.md)。作业（job）是一次提交的一批同类请求，比如「给一万篇文章各写一段摘要」；提交时在请求 ID 里写上作业名，调度器就知道哪些请求是一伙的。

下图用一个小例子（数为示意）：一块装 4 个位置，池子里空闲 6 块。running 里的 A 这一步会把手里的块正好写满，下一步得借 1 块新的；B 的块里还空着一格，下一步不用借。调度器先替它们留出这 1 块，再加 2 块余量，一共扣下 3 块。剩下 3 块能装 12 个位置：waiting 里提示词 10 个位置的 X 放得下，这一步接进来，借走这 3 块；8 个位置的 Y 已经没有余额，先等（先接哪条的规则后面讲）。这就是图中「预留」那一行。

```wiki-diagram
file: batch-job-aware-scheduler
```

它和上游默认调度器的区别只在 waiting 这一段。running 的请求怎么续、每步的 token 预算和请求数上限怎么管，全都照旧。默认调度器接一条新请求时，只看这条请求自己要的块现在够不够；批作业感知调度多做两件事：先替 running 留出下一步要借的块，再决定先接哪个作业的哪一条。

## 为什么要先留：新请求把块分光，下一步就要抢占

请求在 decode（逐个生成新 token）时，每一步都往后写位置，手里的块写满就要借新块。默认调度器接新请求时不管 running 下一步还要借多少。离线批处理一次交上来成百上千条请求，waiting 一直是满的，空闲块很容易在一步里被新请求分光。

还是上面的例子，看图的下面一行。不预留时，6 块都算余额：X 借走 3 块，Y 再借走 2 块，池里只剩 1 块。下一步 A 先借走这最后 1 块；Y 的提示词正好写满 2 块，它的第一个新 token 也要 1 块新块，却借不到了。running 的请求借不到块时，调度器做 preemption（抢占）：从 running 队尾取一条，通常就是最晚接进来的请求，这里正是 Y 自己；把它的块全部还回池子、已算的位置清零，退回 waiting，以后从头重算，见[池子不够时](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)。Y 上一步做的 prefill（把整段提示词算一遍）就白做了。

预留把这件事往前挪了一步：宁可这一步少接几条，也别让下一步去抢占。代价有三处：

- **接得慢。** 例子里余额从 24 个位置降到 12 个，Y 要等后面的步。留得越多，池子里暂时闲着的块越多。
- **只顾下一步。** 它估计的只是 running 下一步要借的块，更远的增长不管；估计少了，或者预留碰到上限，照样会抢占。
- **不保证公平。** 它按作业挑请求，没有防饿死的机制，有的请求可能一直排在后面。官方文档因此只推荐它用于离线批处理，或者不在乎等待时间的在线场景。

为什么还要按作业分组？同一个作业的请求做的是同一件事，输出长度往往差不多：摘要作业每条输出几百个 token，分类作业每条只输出一个标签。作业里已经结束的请求输出了多长，是估计同作业其余请求的好线索。有了这个估计，调度器在余额宽裕时先接输出长的作业，长任务先开工、短任务填空档，官方把这个思路叫 LPT（longest processing time first，最长任务优先）：长请求若拖到最后才开工，批的尾部就只剩少数几条在跑，每一步只算寥寥几个 token。余额紧时反过来先接输出短的作业。官方只写了这条规则、没写理由；从效果看，短输出的请求几步就结束，块很快还回池子。

## 预留怎么算：先把这一步走完，再看下一步要不要新块

留多少由一个叫 RunningBlockReserver（运行请求的块预留器）的部件算。它对 running 里的每条请求问三个问题：

1. **这一步会走到哪个位置。** 调度器排这一步时，已算的位置数要等整步排完才往前推（见[调度器的记账](vllm-scheduler.md#调度器怎样排一步还差几个--截断--借块--记账)），所以预留器自己先模拟一遍：提示词还没算完的请求，这一步走「剩下的提示词」和「每步 token 上限」中较小的那个；decode 的请求走 1 个位置，再加上调度器为投机解码留的 lookahead 个位置。投机解码是先猜几个 token、下一步一起验证；MTP、EAGLE 这类方法每步猜几个，lookahead 就是几个。
2. **下一步要走几个位置。** 同样的规则，从这一步走完的位置接着算。
3. **下一步要几块新块。** 看这一步走完后，手里最后一块还空几格。下一步要走的位置不超过空格，就是 0 块；超出的部分按每块 B 个位置向上取整。

所有 running 请求的新块数加起来记作 $R$。$R$ 加上安全余量 $m$（默认 2 块），但不超过上限 $M$（默认 8 块），就是预留块数 $P$。空闲块数 $F$ 减去 $P$，再乘每块的位置数 $B$，就是这一步接新请求的额度，叫**准入预算**，单位是位置：

$$P = \min(R + m,\; M), \qquad \text{Budget} = \max(0,\; (F - P) \times B)$$

用第一张图的数演一遍（示意：$B = 4$、$F = 6$、$m = 2$、$M = 8$，不开投机解码；对比不预留时为 $6 \times 4 = 24$ 个位置）：

| 预留与余额核算（示意：$B=4$，$F=6$） | 算式 | 结果 |
| --- | --- | --- |
| A 本步走完与下一步新块（块已满、空格 0） | $3 + 1 = 4$ 位置；$\lceil (1 - 0) \div 4 \rceil$ | **1 块** |
| B 本步走完与下一步新块（块内还空 1 格） | $2 + 1 = 3$ 位置；下一步 1 位置放得进空格 | **0 块** |
| 合计需求 $R$ 与预留块数 $P$ | $R = 1 + 0 = 1$；$P = \min(1 + 2,\; 8)$ | **3 块** |
| 本步准入预算 | $(6 - 3) \times 4$ | **12 个位置**（不预留为 24） |

这组数背后有几条规则：

- **预留不是借块。** P 只是接新请求时少算的额度，那 3 块仍在池子里，并没有记到 A 的名下；真正借块还是 KV cache 管理器按原来的规则做。
- **每接一条，余额就小一截。** 同一步里每接进一条新请求，它就进了 running，预留器把这一条的下一步需求加进 R（只算新增的这一条，不重扫全部）；它借走的块也让 F 变小。所以下一条看到的预算更小，直到预算为 0，队列就对调度器回答「没有能接的请求」，这一步的 waiting 到此为止。下一步开头，预留器清掉缓存，把 running 从头扫一遍。
- **余量也受上限约束。** R 为 0 时预留 min(m, M) 块；running 里一条请求都没有，准入预算也是 max(0, (F − min(m, M)) × B)。默认 m = 2、M = 8 时至少扣下 2 块额度；配置允许 m 大于 M，此时只扣 M 块，空闲块不足时预算直接归零。
- **上限 M 管住预留本身。** running 很多、又碰巧一起跨块时，R 会很大；M 给预留封顶，免得一条新请求都接不进来。代价是 R 超过 M 时，留下的块不够 running 下一步全部要借的。
- **估的只是个大概。** prefill 的一段按每步 token 上限去估，实际这一段可能因为预算被别的请求用掉一部分而更短，切点和估计的不一样；更远的步数它不看。所以这是经验估计，不保证覆盖任意长的输出。
- **B 是一个统一的块大小。** 示意里用 4 是为了好算。混合结构模型的块池里，不同缓存组的一块装的位置数不一样，(F − P) × B 就不能直接当成「还能装下多少个位置」；GLM 双机上差在哪，见后面的 GLM 一节。

## 先接谁：作业标签和输出长度估计

**作业名从请求 ID 里认出来。** 请求 ID 里写上 `#job_name[作业名]#`，调度器用正则把作业名找出来：标记放在 ID 的开头、结尾还是中间都认，作业名里不能有方括号。没写的请求都归进同一个默认作业，留块和桶内挑选照常生效，只是没有了作业之间的先后。这个标记只用来分组和共用统计，不会进模型。

材料中的解析规则还要求作业名非空，因此空标签也不能形成一个独立作业；没有匹配标签的请求归入名为 __default__ 的默认作业。解析结果按请求 ID 缓存，同一个 ID 再次解析时可以复用已有结果。

**每个作业一个桶。** waiting 不再是一条先来先服务的队列，而是每个作业一个桶，桶里按提示词长度分格放请求。被抢占退回的请求也放回自己作业的桶，不像默认调度器那样插回队首。

**每个作业有一个输出长度的估计值：**

- 还没有请求结束时，估计值是 128 个 token。
- 请求在引擎内因 EOS 或停止 token 编号正常结束时，记下它输出了多少个 token。第一个样本直接当估计值；之后按指数移动平均更新：$\hat{L}_k = 0.1 \times L_k + 0.9 \times \hat{L}_{k-1}$。旧样本的分量每更新一次就乘一次 0.9，慢慢淡出。
- 每个作业最多记 10 个样本，记满以后估计值不再变。
- 因为生成长度到了上限才结束的请求不记。前端命中停止字符串、再通知尚未结束的引擎取消时，引擎记录的是取消，也不记进这个估计器；客户端看到的 stop 不等于引擎的正常结束状态。一个作业若一直没有可记录样本，估计值就停在 128；只截断一部分时，估计只从引擎内正常结束的样本里学，可能偏小。

| 作业输出长度估计更新步骤（示意） | 算式 | 更新后估计值 |
| --- | --- | --- |
| 尚无自然结束样本 | 默认冷启动初值 | **128 token** |
| 第 1 条自然结束（输出 20 token） | 首样本直接赋值 | **20 token** |
| 第 2 条自然结束（输出 40 token） | $0.1 \times 40 + 0.9 \times 20$ | **22 token** |

**长作业和短作业。** 用于分类与排序的估计先转成整数，正的移动平均值因此向下取整；这个整数大于 32（默认阈值）的作业算长作业，否则算短作业。例如内部平均值 32.9 会按 32 分类，仍算短作业。新作业没有样本，估计是 128，所以一开始都算长作业。

这个估计说的是「这个作业的请求一般输出多长」，不是某一条请求还要生成多少；它也不参与预留的计算，只决定先接哪个作业。

## 一次准入怎么走：冷启动 → 作业排先后 → 桶里挑一条

这件事发生在主线的[第 2 站 调度](concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)。上游调度器先把 running 排完，再扫 waiting；每接一条之前，都先问队列「现在有能接的吗」。批作业感知的队列按下图回答：

```wiki-diagram
file: batch-job-aware-scheduler-flow
```

1. **先算准入预算。** 为 0 就回答「没有」，这一步不再接新请求。
2. **冷启动请求优先。** 一个作业的桶从空变成有请求以后，最先进来的 3 条算冷启动请求。只要预算大于 0，就先接它们，不管提示词放不放得进预算，好让新作业尽早有请求跑完、攒出估计用的样本。桶被取空时这个计数清零，这个作业之后再来的请求，头 3 条又算冷启动。
3. **作业排先后。** 预算大于 4096 个位置（默认阈值）时长作业在前，否则短作业在前。长短两类都有时，每一类内部都按估计值从大到小排；只有一类时，预算大就从大到小，预算小就从小到大。准入预算总是 B 的整数倍，块越大，4096 这道门槛就越粗：比如 B = 2048 时，「大于 4096」就等于扣完预留还剩至少 3 块。
4. **排第一的作业里挑一条。** 在它的桶里找提示词不超过预算的最长一条（best fit：尽量把额度用满）；全都超过预算，就挑最短的一条。比较的是整段提示词的长度。
5. **交回上游。** 上游照常把这条请求截到剩余的 token 预算、借块；借到了就进 running，预留器把它的下一步需求加进 R，再回到第 1 步问下一条。借不到块，按上游的规则这一步停止接新请求。

把第一张图的例子接着往下走。设有两个作业，都已过了冷启动：摘要作业估计输出 200 个 token，算长作业，桶里有提示词 9 和 15 个位置的两条；分类作业估计输出 8 个 token，算短作业，桶里有 3 和 5 个位置的两条。池子仍是 F = 6，running 里的 A、B 让 R = 1：

| 第几次问 | 空闲块 F | 预留 P | 准入预算 | 谁在前 | 挑中哪条 |
|---|---|---|---|---|---|
| 1 | 6 | 3 | 12 个位置 | 12 ≤ 4096，短的分类作业在前 | 分类作业里不超过 12 的最长一条：5 个位置 |
| 2 | 4，上一条借走 2 块 | 3，新请求下一步不用新块 | 4 个位置 | 同上 | 不超过 4 的最长一条：3 个位置 |
| 3 | 3，又借走 1 块 | 3 | 0 | — | 回答「没有」，这一步不再接 |

第 2 行的 P 没变：5 个位置的请求这一步写到第 2 块的第 1 格，下一步 decode 只走 1 个位置，放得进剩下的 3 格。第 3 行预算归零时，摘要作业的两条一条也没轮到。只要分类作业的桶不空、预算又紧，排在第一的永远是它；预算大于 4096 时反过来，短作业一直等。排第一的作业桶只要不空，总能交出一条（放得进的最长一条，或放不进时的最短一条），后面的作业这一轮根本不会被看到。这就是「不防饿死」的具体样子，也是它算不上严格的最短作业优先的原因。

还有几处边界：

- **只换了 waiting 这一条队列。** 上游另有一条挂起队列，放暂时不能排的请求，先来先服务模式下上游先从它取，进了这条队列的请求不经过预留、冷启动、作业排序和 best fit。带结构化输出（structured output，比如按 JSON schema 生成）的请求**一到达就进挂起队列**，等语法编译好，直接从那里排上，整条绕过本调度器；只有它后来被抢占，才退回作业桶。等远端传来的 KV、LoRA 个数已满这类请求，则是这一步排到时临时放进去的。离线批处理里用 JSON schema 做抽取、分类很常见，这类负载上本调度器新增的逻辑基本不起作用。
- **估计不准照样会抢占。** 预留只看下一步，R 又被 M 封顶；最终还是由上游在借块时决定抢不抢。
- **不看被抢占请求的真实工作量。** best fit 比的是提示词长度；被抢占退回的请求要重算的还包括它已经生成的部分，实际比提示词长。

## 放到 GLM 双机：本部署没有它，场景 M 里它会多问什么

本部署（见[部署前提](glm-5-3-flash-two-node.md#部署前提)）用的 vllm-ascend GLM 镜像里没有这个调度器。在原有 v0.23、v0.26、main 三版比较中，它从 v0.26 才有，而 v0.26 又没有 GLM-5.3-Flash，仅 main 同时包含两者；rc2 也保留这两份实现，但源码共存不表示已经验证过 GLM 双机启动组合和性能。下面只拿主线第 2 站已经算好的场景，看这道新增的检查落在哪、本部署的块账和它的假设差在哪。

**它只插在 waiting 那一段。** [场景 M](concurrent-requests.md#示例场景-m-与变体-m) 的第 2 步，DP0（两台机器各是一个 DP 组，各有自己的调度器和块池）先给 12 条 decode 各排 4 个位置（1 个确定的 token 加 3 个 MTP 候选），剩下的 8144 个 token 预算给新到的请求 N；N 的 6000 个位置一步装得下，块也够。整步的账见[第 2 站](concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)和[多条请求的 KV 块](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)，这里不重算。换成批作业感知调度，running 那一段、8192 的 token 预算、32 条的请求数上限都不变；N 进来之前多了两件事：先估计 12 条 decode 下一步还要几块新块，再按作业标签决定 N 是不是这一步排第一的那条。

**full 组通常隔多步才续块；尾状态组仍逐步借还。** 本部署的块分 5 个缓存组（存储格式和借块规则相同的一组层）。随长度增长的只有 full 组，一块装 640 个位置；三个 KDA 组每条请求固定共 12 块，不随长度变；尾状态组每走 4 个位置借 1 块、还 1 块，手里总在 3–4 块之间，见[块分配](vllm-kv-block-allocation.md#kda-组和尾状态组借法和普通注意力不同)。在候选持续全接受、忽略块内起点与 lookahead 边界的理想示意下，一条 decode 请求要走很多步才需要一块新的 full 组块：

$$N_{\text{rounds}} = \frac{640}{1 + 3} = 160\text{ 轮}$$

| full 组跨块周期理想示意（DP0，一条请求，候选持续全接受） | 算式 | 结果 |
| --- | --- | --- |
| 一块 full 组块容量与每轮验证位置数 | $640$ 位置；$1 + 3$ | **640 位置**；**4 位置/轮** |
| 忽略块内起点与 lookahead 边界的跨块周期 | $640 \div 4$ | **160 轮** |

验证位置数不等于净推进数：候选被拒时已算进度要回退，本配置一轮实际推进 1–4 个位置。因此 160 轮不是固定跨块周期；实际申请还要看当前块内偏移和预留位置。

只看 full 组，12 条 decode 多数轮不需要新块，接近边界的请求才要续块；尾状态组仍有前面说的临时借还，不能据此断言所有缓存组都不申请。预留还受估算口径与上限影响。默认上限 8 块只是 DP0 块池 3,855 块（算例，见[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)）的零头，按每个块号每卡 7.969 MiB 算约 64 MiB。

**一次要很多块的，是新请求的 prefill。** 按本部署的借块规则，尾状态组要为一步 prefill 的每 4 个位置留 1 块。场景 M 的 N 第一步要 1,523 个块号，其中尾状态组 1,501 块、full 组只有 10 块，见[多条请求的 KV 块](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)；把 N 换成 20,000 个 token、每段 8144 个位置，第一段光尾状态组就要 2,037 块，占 DP0 块池的一半多，见 [20,000 token 分三步](chunked-prefill.md#放到-glm-双机20000-个-token-的提示词分三步)。准入预算却假设每块都装 B 个位置：即便按 full 组的 640 折算，6000 个位置也只值 10 块，比 N 实际要的 1,523 块少两个数量级。N 进不进得来不受影响，上游借块时按各组的真实块数检查；受影响的是准入预算和 best fit，它们在本部署量不准一条新请求要占多少块。

**代码里的 B 取的是调度器的块大小。** 本部署钉住的版本里，这个数是各缓存组块大小的最小公倍数 133,120 个位置，等于一条请求的最大长度，见 [block_size 的五种含义](kv-cache-spec.md#block_size-到底指哪一个五种含义)。假如 main 上 GLM 的调度器块大小也是它：running 请求要走到 133,120 的边界才算「要新块」，而请求本来就走不过这个长度，R 始终是 0，预留只剩 2 块余量；准入预算是 (F − 2) × 133,120，只要空闲块多于 2 块，就远大于 4096，永远是长作业在前。main 在 GLM 这条路上改过调度器块大小的取法，实际取值还要核，所以本页不给调参建议。

能确定的是：它不改 running 那一段，也不改 8192 和 32 这两道上限；新增的预留和作业排序只影响 waiting 那一段接不接、先接谁。它在这套部署上能少几次抢占、会不会少接请求，没有实测数。

## 常见误解

- **「预留就是把块提前借给 running」**——不是。预留只让准入预算少算几块，那几块仍在池子里，谁先借谁拿；真正借块照旧由 KV cache 管理器按每条请求的实际需要做。
- **「开了它就不会再抢占」**——它只估计下一步，预留还被上限 M 封顶；挂起队列里的请求，包括所有带结构化输出的请求，都不经过这道检查；估计少了照样抢占。
- **「它就是短作业优先」**——预算大于阈值时是长作业在前；两类都有时，类内还都按估计值从大到小排。它是一组作业级的经验规则，不是严格的最短作业优先。
- **「估计值就是这条请求还要生成多少」**——它是这个作业以往自然结束的请求的平均输出长度：没有样本时是 128，记满 10 个样本就不再变，被长度上限截断的请求不记。它只决定先接哪个作业，不参与预留的计算。

- **「作业标签会进模型的输入」**——标签只写在请求 ID 里，调度器拿它分组，不改提示词。

- **「max_jobs 设成 0 就是不限作业数」**——配置里的注释确实这么写，但建桶时 0 表示不查上限，记统计时 0 却表示一个作业都不许记；第一条请求自然结束时就抛异常。
- **「作业数上限就是并发请求数上限」**——它数的是有请求在排队的作业有几个、以及出现过自然结束请求的作业累计有几个，和同时在跑多少条请求无关；超了不是排队，是抛异常。
- **「本部署加一行配置就能打开」**——本部署的镜像里没有这个类；v0.26 有它，但没有 GLM-5.3-Flash；已钉 main 与 rc2 同时包含两者，仍须单独验证模型与调度器的组合。
- **「只改了先后顺序，输出一定和默认调度器逐 token 相同」**——官方的端到端测试只在一张卡上用 Qwen3-0.6B、贪心解码、每条生成 4 个 token，比较开和不开的输出是否逐 token 相同。更长的生成、更大的批里，每一步和哪些请求拼成一批变了；批的组成会不会改变数值，见[批不变性](batch-invariance.md)。
- **「准入预算乘出来的位置数，就是池子还能装下的 token 数」**——混合结构模型各缓存组一块装的位置数不同；本部署一段 prefill 每 4 个位置就要 1 块尾状态块，按单一块大小折算会差出几个数量级。

## 对照源码

钉点：v0.23 为 vLLM `0fc695fc` + Ascend `2c59ff10`（维护分支），GLM 专用镜像为 Ascend `db701c1f`，两者都没有本调度器；v0.26 为 vLLM `568afb3a` + Ascend `2ed6cbba`；main 为 vLLM `84030bbe` + Ascend `baa023ad`。下面行号按 `2ed6cbba`，main 的调度器文件与它逐行相同。

### 怎么开

- **开关**：`--additional-config '{"scheduler_config": {"batch_job_sched_config": {"enabled": true}}}'`。官方文档写明目前只支持离线批处理，示例用 `vllm.entrypoints.openai.run_batch` 读 jsonl 输入，并把作业标记同时写进每条请求的 `custom_id` 和 `body.request_id` [S21]；文档把它概括成三条策略：LPT、KV cache 预留、按作业分组 [S20]。
- **参数**（嵌在 `scheduler_config.batch_job_sched_config` 下，默认值见 [C11]）：

| 参数 | 默认 | 管什么 |
|---|---|---|
| `enabled` | false | 总开关 |
| `max_jobs` | 20 | 作业桶个数与统计表个数的上限 |
| `reserve_margin_blocks` | 2 | 安全余量 m |
| `reserve_max_blocks` | 8 | 预留上限 M |
| `low_available_tokens_threshold` | 4096 | 准入预算高于它长作业在前，否则短作业在前 |
| `short_decode_token_threshold` | 32 | 估计输出大于它算长作业 |

- **旧写法**：把 `batch_job_sched_config` 直接放在 `additional_config` 顶层也认，但打 deprecated 警告；两处都写时以 `scheduler_config` 下的为准，顶层的被忽略 [C29]。
- **作业标记**：正则 `#job_name\[([^\[\]]+)\]#` 用 `search` 在请求 ID 里找，所以位置不限；搜不到归 `__default__` [C4]。
- **装上去的方式**：平台钩子按 `async_scheduling` 把 `scheduler_cls` 设成 `BatchJobAwareScheduler` 或 `BatchJobAwareAsyncScheduler`（平台选择见来源 13）；构造时把 `self.waiting` 换成 `BatchJobAwareRequestQueue`，队列持有 `RunningBlockReserver` 和 `JobDecodeEstimator` [C1]；上游另建的 `skipped_waiting` 不换。异步版靠多继承把[异步调度](async-scheduling.md)和这套逻辑拼在一起。
- **队列怎样让上游停下**：`__bool__` 返回「有没有可接的请求」[C17]，上游 waiting 循环的条件 `while (self.waiting or self.skipped_waiting) and token_budget > 0` 据此结束；`peek_request` 找不到时抛 `IndexError`。

### 会报什么错

- **`ValueError: ShortRequestFirst scheduling cannot be enabled with batch_job_sched_config. Please disable one of them.`**：与[短请求优先](short-request-first.md)同开 [C12]。
- **`ValueError: batch_job_sched_config.* must be ...`**：`max_jobs`、`reserve_margin_blocks` 为负，`reserve_max_blocks` 或两个阈值不为正。`max_jobs` 旁的注释写「0 = unlimited」，校验也放行 0，但见下一条。
- **子键名写错**：v0.26 用 `config.get(键, 默认值)` 逐个取，拼错的键被静默忽略、按默认值跑；main 的配置类由 `@config` 生成，合并了 `extra="forbid"` [C30]，拼错会被拒绝 [D]。
- **`RuntimeError: Maximum number of jobs (...) exceeded`**：两处。一是有请求在排的作业数超过 `max_jobs` 时建新桶 [C9]，桶空了会删；二是估计器的统计表，它从不删，引擎整个生命期里，第 `max_jobs` + 1 个作业出现第一条自然结束的请求时就抛 [C5]。`max_jobs = 0` 时建桶那处因为 `if self._config.max_jobs and ...` 直接跳过，统计那处 `len(...) >= 0` 恒真，第一条请求自然结束就抛 [D]。

### 开销和什么时候别开

- **每判一次「队列非空」都完整挑一遍。** `__bool__` 和 `peek_request` 都走 `_find_admittable`：算预算、查冷启动、按作业收集估计值并排序、桶内二分查找 [C3]。预留器靠缓存省掉重扫：running 条数不变直接复用，多 1 条只加这一条 [C14]。
- **预留的逐条算法**：本轮 prefill 取 `min(剩余提示词, max_num_scheduled_tokens)`，decode 取 `1 + num_lookahead_tokens`，下一轮同理，再对 `self._scheduler.block_size` 求余 [C2]。上游 MTP、EAGLE、draft model 时 `num_lookahead_tokens` 等于猜测个数（v0.26 配对 vLLM 的 `Scheduler.__init__`）。
- **估计器**：冷启动默认 128、α = 0.1、每作业最多 10 个样本；只在 `_free_request` 里对 `FINISHED_STOPPED` 记样本，达到长度上限的 `FINISHED_LENGTH_CAPPED` 不记 [C8]。前端停止字符串触发的清理经 abort 进入 `FINISHED_ABORTED`，也不作为样本；若引擎已经正常结束，则按原引擎状态处理（来源 41–43）。分类与排序使用 `int(ewma_average)`，不是未取整的平均值（来源 5）。

- **冷启动**：`_COLD_START_MIN_SAMPLES = 3`；`add_request` 按作业计数，前 3 条进冷启动集合；桶取空时计数清零 [C16]。docstring 写「短作业 = 估计 < 阈值」，代码是「估计 > 阈值才算长」，恰好等于阈值时两者不一致，以代码为准 [!]。
- **结果一致性**：所列官方 e2e 用 Qwen3-0.6B、`max_model_len=2048`、贪心解码、`max_tokens=4`，把开与不开的输出做逐 token 相等断言，另有异步调度、分块预填充、自定义参数三组同样的比较 [C28]。这份测试不覆盖更大的模型或更长的输出。
- **被抢占的请求**：`prepend_request` 直接调 `add_request`，放回作业桶，不回队首。
- **挂起队列 `skipped_waiting`**：带 structured output 的请求在 `Request` 构造时状态就是 `WAITING_FOR_STRUCTURED_OUTPUT_GRAMMAR` [C31]；上游 `add_request` 经 `_enqueue_waiting_request` 把这类挂起状态（还有 `WAITING_FOR_REMOTE_KVS`、`WAITING_FOR_STREAMING_REQ`）直接放进 `skipped_waiting`，FCFS 下 `_select_waiting_queue_for_scheduling` 先取它 [C19]；语法就绪后 `_try_promote_blocked_waiting_request` 在循环里把状态改回 `WAITING`，就地从这条队列排上 [C18]。只有抢占（`_preempt_request` 用 `self.waiting.prepend_request`）会把它送回作业桶。`BatchJobAwareScheduler` 没有覆盖入队与选队列的方法；main（vLLM `84030bbe`）同样先取 `skipped_waiting`。
- **别开的场景**：有时延或公平要求的在线服务——官方明说不做饥饿防护 [S10]；要用短请求优先时二选一；同开 profiling chunk 时，平台先设 `ProfilingChunkScheduler` 并导入它的补丁，再被本调度器的类覆盖。
- **调参方向**：m、M 调小，接得多，下一步抢占的机会也多；调大，抢占少，池子闲得多。输出长度估计和块预算的误差，都只能在实际负载上观察；本部署没有调这几个参数的实测依据 [!]。

### 版本差异

**`v0.30.0 (c09d3e20)` 与 `main (8d6180e2)` 均保留 `BatchJobAwareScheduler` 及其 6 项配置默认值。** 作业名仍从 `request_id` 的 `#job_name[...]#` 标记提取，未带标记归入 `__default__`，平台仍按 `async_scheduling` 选同步或异步变体。在多调度器覆盖优先级上，`v0.30.0` 的 `batch_job_sched_config.enabled` 位于 `recompute_scheduler`、`dyntra_lb`、`profiling_chunk` 之后，同时开启时会静默覆盖前者写入的 `scheduler_cls`；与 `ShortRequestFirst` 同开仍显式报 `ValueError`。**`main (8d6180e2)` 移除了 `profiling_chunk_config`，`batch_job_sched_config.enabled` 仍位于最后并静默覆盖 `recompute_scheduler` / `dyntra_lb` 的 `scheduler_cls`**，同时在 `remove_request` 中修复了移除请求时未清空缓存 `_peeked` 的边界问题（`#L449-L451`），并在 `_swa_bounded_replay_unsupported_mode` 中确认其调用 `super().schedule()` 因而保留 SWA bounded replay 支持。

| 项 | v0.23.0 (2c59ff10) | v0.26.0rc (2ed6cbba) | v0.30.0 (c09d3e20) | main (8d6180e2) |
|---|---|---|---|---|
| 调度器与配置类 | 无 | 有；`dict.get` 取参（拼错键静默忽略） | 有；`@config` Pydantic 校验（拼错键拒绝），默认参数不变 | 同 v0.30.0 |
| 多调度器互斥与覆盖顺序 | — | 与 `ShortRequestFirst` 互斥报错；覆写排在前的 `recompute` / `profiling_chunk` | 同 v0.26.0rc（`platform.py#L1380-L1408`：`recompute` → `dyntra_lb` → `profiling_chunk` → `batch_job_sched`） | 移除 `profiling_chunk`；`batch_job_sched` 仍排最后覆写 `recompute` / `dyntra_lb`（`#L1586-L1602`）；且保留 SWA bounded replay |
| `remove_request` 清理 `_peeked` | — | 未清理（被移除请求可能残留于 `_peeked`） | 同 v0.26.0rc | 已修复：移除匹配请求时同步清空 `self._peeked = None` |
| GLM-5.3-Flash 与调度器块大小 $B$ | 维护分支无模型；镜像 `db701c1f` 有模型但无本调度器（$B=133{,}120$ [C24]） | 无 GLM 模型 | 含模型与本调度器，GLM 过滤私有缓存组算 $B$ [C25]；组合性能仍待实测 | 同 v0.30.0 |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 调度器类、替换 waiting、每步清缓存、记样本 | `vllm_ascend/core/batch_job_aware_scheduler.py` 的 `BatchJobAwareScheduler`（`main (8d6180e2)` `remove_request` 清 `_peeked` 见 `#L445-L458`） |
| 预留 $P$ 与逐条需求 | 同文件 `RunningBlockReserver` |
| 准入预算、冷启动、作业排序、best fit | 同文件 `BatchJobAwareRequestQueue`、`RequestBucket` |
| 作业名解析、输出长度估计 | 同文件 `JobNameParser`、`JobDecodeEstimator` |
| 参数与校验 | `vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1517-L1555`；`main (8d6180e2)` 见 `#L1610-L1648` |
| 多调度器互斥、覆盖顺序与 SWA 兼容说明 | `vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1058-L1066`、`#L1380-L1408`；`main (8d6180e2)` 见 `#L1243-L1252`、`#L1586-L1630` |
| 上游 waiting 循环、挂起队列 | vLLM `vllm/v1/core/sched/scheduler.py` |
| 调度器块大小怎么定 | 上游 `vllm/v1/core/kv_cache_utils.py` 的 `resolve_kv_cache_block_sizes`；昇腾补丁 `vllm_ascend/patch/platform/patch_kv_cache_utils.py` |
| 官方说明、端到端测试 | `docs/source/user_guide/feature_guide/batch_job_aware_scheduler.md`；`tests/e2e/pull_request/one_card/test_batch_job_aware_scheduler_e2e.py` |

**待核。**

1. `v0.30.0` / `main` 上 GLM-5.3-Flash 的 `Scheduler.block_size` 实际取值，以及本调度器在这套模型上的预算是否有意义；缺实际镜像启动日志 [!]。
2. 在 GLM 双机上打开后，抢占次数、吞吐与等待时间的变化；缺实测。
3. 队列缓存的 `_peeked` 在 `main (8d6180e2)` 已于 `remove_request` 清空，但在上游 `peek` 后因借不到块 `break` 的场景下每步开头仍未主动清空；下一步 `peek_request` 是否跳过重挑需实跑确认。

作业解析器按请求 ID 中的非空标签分组，并缓存解析结果；它不按业务内容自动识别作业。由来源 4 的解析与默认名称规则可知：不同业务若都没有匹配标签，就会共用默认作业的统计，因此要先检查实际请求 ID 再判断分组是否正确。
