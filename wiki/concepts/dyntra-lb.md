---
id: dyntra-lb
title: DyntraLB：D 端各 DP 组按 KV 块数换人，少等最重的组
type: feature
legacyAnchors:
  放到-glm-双机本部署没开也开不了: 复杂异构实战对照：GLM 双机为何未启用与块尺偏差
summary: >-
  vllm-ascend v0.30.0 与 main 中 PD 分离 decode 端的 DP 负载均衡：各组每步互报按 token 数估计的 KV
  块数，下一步在本组内暂停或接纳请求，让各组注意力负载接近；不搬请求，暂停不还 KV。讲清与 EPLB、Balance Scheduling
  的分工、计划怎样算、何时生效，以及本部署为何没开。
aliases:
  - DyntraLB
  - DynTra
  - Dynamic Intra-Decoder Data-Parallel Load Balancing
  - dyntra_lb_config
  - 动态 DP 负载均衡
  - D 端 DP 负载均衡
  - lb_pause_request
chapters:
  - '12'
order: 70
sources:
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L3-L25
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L27-L45
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L71-L86
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L88-L157
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L159-L210
  - 'vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L41-L52'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L166-L248'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L250-L292'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L364-L419'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L436-L443'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L700-L705'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L123-L175
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L175-L239
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L240-L321
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L324-L399
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L401-L470
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L472-L517
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_engine_core.py#L32-L42'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L984-L1012'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1254-L1260'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L1470-L1488'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1363-L1397'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1450-L1464'
  - 'vllm@84030bbe:vllm/v1/engine/core.py#L1319-L1328'
  - 'vllm@84030bbe:vllm/v1/engine/core.py#L2242-L2270'
  - 'vllm@84030bbe:vllm/config/parallel.py#L752-L759'
  - 'vllm@84030bbe:vllm/v1/engine/core.py#L333-L349'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995'
  - 'vllm@98dff2a8:vllm/v1/engine/core.py#L332-L338'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/kv_cache.py#L28-L42'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_interface.py#L303-L322'
  - 'vllm@84030bbe:vllm/config/parallel.py#L145-L146'
  - 'vllm-ascend@baa023ad:.github/vllm-main-verified.commit#L1-L1'
  - >-
    raw:sha256-3e07f4028502f4e2131e207ceedc843577a113f5e4d515cc6d16c782b6c39398.md#L1-L1125
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:docs/source/user_guide/feature_guide/dyntra_lb.md#L8-L12
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:docs/source/user_guide/feature_guide/dyntra_lb.md#L155-L157
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:docs/source/user_guide/feature_guide/dyntra_lb.md#L198-L207
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L201-L204
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1583-L1618'
  - 'vllm-ascend@7d825229:vllm_ascend/core/dyntra_lb_scheduler.py#L40-L51'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1078-L1106'
  - 'vllm@ced6857a:vllm/config/parallel.py#L145-L145'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L2016-L2016'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L2263-L2271'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L667-L720'
  - 'vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L800-L879'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1420-L1464'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1613-L1685'
  - 'vllm-ascend@baa023ad:.github/vllm-release-tag.commit#L1-L1'
  - 'vllm@98dff2a8:vllm/v1/engine/core.py#L2268-L2281'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1579-L1635'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1086-L1115'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1380-L1385'
  - 'vllm-ascend@c09d3e20:vllm_ascend/core/dyntra_lb_scheduler.py#L140-L245'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1672-L1727'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1260-L1287'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1586-L1630'
  - 'vllm-ascend@8d6180e2:vllm_ascend/core/dyntra_lb_scheduler.py#L140-L230'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: data-parallel
    kind: builds-on
    note: 各组为什么每一步要一起走、请求为什么一直留在派进去的那组
  - to: pd-disaggregation
    kind: builds-on
    note: D 节点是什么，候选请求的 KV 怎样从 P 拉过来
  - to: balance-scheduling
    kind: alternative-to
    note: 同样防「等最重的组」但只数条数，v0.30.0 与 main 中都与本特性二选一
  - to: expert-parallel
    kind: builds-on
    note: dispatch 与 combine 把各组绑在一起；专家那一段的等待归 EPLB 管
  - to: vllm-scheduler
    kind: builds-on
    note: running 与 waiting，以及真正的抢占怎样收回 KV 块
  - to: profiling-chunk-config
    kind: conflicts-with
    note: DyntraLB 的启动检查禁止与 profiling_chunk_config 同开；后者开启 CPP 动态切块。
  - to: collective-communication
    kind: builds-on
    note: DyntraLB 依靠 All-Gather 汇集各组负载，其机制建立在集合通信的数据交换规则上。
  - to: concurrent-requests
    kind: builds-on
    note: 借用多请求页的场景 M 区分混合 prefill 造成的宽度差距与 DyntraLB 处理的纯 decode 历史负载差距。
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-16c2ece421b5494c3468011118fda8b28b59e3a03ad29ba53c79243f56bf61de.md
  - >-
    raw/sha256-3e07f4028502f4e2131e207ceedc843577a113f5e4d515cc6d16c782b6c39398.md
---

## DyntraLB 是什么？

**DyntraLB（Dynamic Intra-Decoder Data-Parallel Load Balancing）是 `vllm-ascend` 给 PD 分离 D 节点用的负载均衡。** 同一个 decode 实例里的几个 DP 组，每步末尾按每条请求已有 token 数估计 KV 块数并互相汇报，再按同一张表算出下一步各组暂停或接纳哪些请求，使各组历史负载接近。它在 `v0.30.0` 与 `main` 中提供；请求不在组间搬迁，被暂停的请求也不交还 KV 块。

先交代几个词。[PD 分离](pd-disaggregation.md)把一条请求的 prefill（一次算完整段提示词）和 decode（之后逐个生成 token）交给两组机器，专做 decode 的那组叫 D 节点，新请求带着 P 那边算好的 KV cache 过来。[DP](data-parallel.md) 把一个实例分成几个 DP 组，每组有自己的调度器，手里两个队列：running 放正在算的请求，waiting 放已经到了、还没开始算的请求（见 [vLLM 调度器](vllm-scheduler.md)）。KV cache 按块存放（见[缓存按块存放](kv-cache.md#缓存按块存放一个位置的-kv-写进哪一格)），一条请求的历史越长，占的块越多。

看一个例子（数为示意，每组最多同时跑 4 条，DyntraLB 这一步已经生效；用普通全注意力、等大小的历史块建立直觉）。某一步结束时，DP0 在跑一条很长的对话，历史按 128 块算，外加三条各按 1 块算的短问答；DP1 在跑四条 1 块的短问答，waiting 里还有一条 KV 已经从 P 拉到、按 64 块算的请求。按条数算两组都是 4 条，历史负载估计却是 DP0 的 131 块对 DP1 的 4 块。DyntraLB 让两组用一次 All-Gather（每组交一份，结束后人人拿到全部）把块数汇成同一张表，算出计划：DP1 暂停一条 1 块的短问答，把那条 64 块的请求换进来；DP0 这一步不接新请求。

```wiki-diagram
file: dyntra-lb
```

换完以后两组的历史负载估计分别为 131 块和 67 块。DP0 那条长对话仍在 DP0；DP1 被暂停的短问答仍在 DP1，KV 块原样留着，等以后计划点到它再接着算。DyntraLB 能动的只有「这一步各组让谁上」。

这次调整的目标，是让 DP1 用等待 DP0 的时间推进那条长请求。两组参与计算的请求条数没变，只是 DP1 换了参与者。若 DP0 的耗时保持原水平，且 DP1 加入长请求后仍先完成自己的计算，新增工作就落在原来的等待时间内；若 DP1 反而更晚完成，它就成了新的等待对象。被暂停的短问答这一轮不再生成，下一次输出要等它恢复后才能继续。

这里的块数是工作量估计，不是设备耗时测量。规划器用固定公式估计吞吐，模型特有成本、投机解码中的候选生成工作和算子差异并没有被逐项计时。因此，131 块与 67 块只说明这次计划选了哪些工作。要判断是否少等，应比较调整前后两组在对应步骤的计算结束、通信等待和整步完成时间，再检查被暂停请求的输出间隔；整组吞吐与延迟按[推理测量](inference-benchmarking.md)的同负载口径复验。后续步骤的请求和历史还会变化，这次计划也不能保证以后始终由同一组决定耗时。

## 为什么需要它：各组要在 MoE 通信点等最重的一组

**当 MoE 的 DP 组共同参加专家通信时，先完成本组注意力的组要等其他参与者到齐。对于全注意力、执行条件相近的 decode 请求，较长的历史带来更多读取工作，因此 KV 块数可用来估计组间负载；实际谁最晚到，仍由执行时间决定。DyntraLB 用块数挑选本地请求，目标就是减少这一段等待。**

[MoE](moe.md) 在这里采用跨 DP 组的专家通信：一组算 MoE 层时，把 token 发到专家所在的卡（dispatch）、算完再收回来（combine），其他参与者也要进入同一轮通信（见[两组为什么不能各跑各的](data-parallel.md#moe-模型里两组为什么不能各跑各的)）。注意力不一样：每组的请求和 KV cache 在本组，各算各的。下面用分阶段执行的示意画出 dispatch、combine 两处可能出现的等待；实际一层何时完成，要看所需计算和通信的关键路径，通信与计算也可能重叠：

```wiki-diagram
file: dyntra-lb-bubble
```

第一处等待在 dispatch 之前。普通全注意力的 decode 每生成一个 token，都要再读取这条请求的历史（见[每一步注意力要读多少](attention-cost.md#历史越来越长每一步注意力要读多少)）。图中假设较长的读取决定了 DP0 的注意力耗时，DP1 提前完成后等待它。第二处在 combine 之前：图中 DP1 持有的专家更热门、处理工作更多，于是 DP0 等它交回结果（见 [EP 的负载不均](expert-parallel.md#负载不均最慢的卡决定这一层多久)）。这张图是在说明两种等待出现的位置，现场仍要用各参与者的时间记录确认瓶颈。两处由不同的机制来调整：

| 机制 | 压平哪一处等待 | 调整什么 | 依据 |
|---|---|---|---|
| DyntraLB | dispatch 前：各组各算的那段（主要是注意力） | 各组这一步让哪些请求上 | 每条请求的 KV 块数 |
| [Balance Scheduling](balance-scheduling.md) | 同一处，只防差距再拉大 | 各组下一步还收不收新请求 | 各组 running 的条数 |
| [EPLB](eplb.md) | combine 前：专家那一段 | 专家放在哪张卡、热门的多放几份 | 每个专家接到的 token 数 |

DyntraLB 和 Balance Scheduling 管同一段，启动时不能同开；它和 EPLB 管的是不同的两段，源码里没有互斥检查，两者一起开的效果没有资料。这页挂在主线「两个 DP 组怎样分请求、空闲的组为什么陪跑」那一站的 PD 分离变体上：主线本身是混部，两组的互等见[示例场景 M](concurrent-requests.md#示例场景-m-与变体-m)。

代价有三样。一是被暂停的请求这一步不出 token，它的时延变长，同组请求的先来后到也被打乱；官方把「decode 吞吐比严格保持本地执行顺序更重要」列为适用前提。二是每一步多一次跨组互报，还要提前替候选请求把 KV 从 P 拉过来，这些 KV 先占着本组的块。三是块数只是估计：一步的真实耗时还取决于模型结构、投机解码的草稿和算子，块数多一倍不一定慢一倍。

## 怎么算：数块、量失衡、组内换人

**一条请求的估计块数 = 已有 token 数 ÷ 配置的块大小，向上取整；一组的负载 = 它 running 里各条请求估计块数之和；失衡 = 最重一组比各组平均多出的块数，达到门槛（默认 5 块）时才尝试换人或暂停。**

块数每一步都要重数：decode 每生成一个 token，编号列表就长一点，跨过块边界就多算一块。计数使用请求全部 token 编号：最新产出的编号在下一次主干前向之前也已经加入列表；物理分配块、不同缓存组、共享前缀和投机预留块另有各自的账。按每块 128 个 token 示意，100 token 算 1 块，16,384 token 算 128 块，8,192 token 算 64 块，就是开头例子里的三种请求。对照 [Balance Scheduling](balance-scheduling.md)：它只数条数，1 块的短问答和 128 块的长对话都算一条，这是两者最根本的区别。

失衡有两种量法，由门槛本身的大小决定：门槛不小于 1 时，量的是块数差「最重 − 平均」；门槛小于 1 时，量的是比例「(最重 − 平均) ÷ 最重」。默认门槛 5.0 属于前一种，意思是 5 块，不是 5%。代入开头的示意例子（门槛 5 块）：

$$\text{bubble} = L_{\max} - \bar{L}$$

| 阶段（示意，门槛 5 块） | 各组平均块数 $\bar{L}$ | 失衡度 $L_{\max} - \bar{L}$ |
| --- | --- | --- |
| 换人前（DP0 131 块，DP1 4 块） | $(131 + 4) \div 2 = 67.5$ 块 | $131 - 67.5 =$ **63.5 块** |
| 换人后（DP0 131 块，DP1 67 块） | $(131 + 67) \div 2 = 99$ 块 | $131 - 99 =$ **32 块** |

32 块仍高于门槛，但已经找不到可做的动作，计划就停在这里。算计划时先一次性补空位，然后一轮轮做后面三步；某一轮什么都没做，或者失衡已经低于门槛，就停下（最多 1000 轮）。补空位本身不受失衡门槛限制：

1. **先补空位，只在开始时做一次。** 哪组 running 没满，就按排队顺序把候选请求补进去，这一步不看轻重。循环里不再补，所以第 4 步停掉的那条不会被立刻补回来。
2. **让最轻的组变重。** 在最轻的组里找一对「running 里的一条 ↔ 候选里更重的一条」，挑换完以后这组离新平均值最近的那一对来换。例子里 DP1 用 1 块换 64 块，离平均的距离从 63.5 块降到 32 块。
3. **让最重的组变轻。** 同样的找法，换成更轻的候选。例子里 DP0 没有候选，换不了。
4. **两边都换不动，才考虑让最重的组停一条。** 停不停、停谁，看下一节那笔吞吐账。

算完还有两步收尾：同一组里块数相同的一出一进互相抵消，换了等于没换；没有任何「进」的组标成冻结，下一步一条新请求也不接，例子里的 DP0 就是这样。

### 两边都换不动时：一笔写死的吞吐账

**第 4 步用一个固定公式估一步多久：20000 + 19.2 × 最重那组的块数；吞吐 = 各组 running 的总条数 ÷ 这个时长。它挑估计吞吐更高的停法；估计值恰好相同时，还可能优先撤回本次规划刚补进来的请求。**

两个常数没有单位，是这份实现写死的启发式，不是哪个模型的实测时延。代入换人之后的局面（两组共 8 条在跑，DP0 131 块、DP1 67 块），按每 $10^6$ 个时间单位完成的条数计，停 DP0 的哪一条都不划算：

$$\text{throughput} = \frac{N_{\text{running}}}{20000 + 19.2 \times L_{\max}}$$

| 候选方案（示意，按每 $10^6$ 时间单位完成条数） | 算式 | 估计吞吐 |
| --- | --- | --- |
| 维持现状（8 条，$L_{\max}=131$） | $8 \div (20000 + 19.2 \times 131) \times 10^6 = 8 \div 22{,}515.2 \times 10^6$ | **约 355.3** |
| 停掉 128 块那条（7 条，$L_{\max}=67$） | $7 \div (20000 + 19.2 \times 67) \times 10^6 = 7 \div 21{,}286.4 \times 10^6$ | **约 328.8** |
| 停掉一条 1 块的（7 条，$L_{\max}=130$） | $7 \div (20000 + 19.2 \times 130) \times 10^6 = 7 \div 22{,}496 \times 10^6$ | **约 311.2** |

停掉 128 块那条以后，最重的变成 DP1 的 67 块，所以按 67 算。两种停法都比现在低，于是这一轮既没换也没停，计划结束。固定项 20000 相当于 20000 ÷ 19.2 ≈ 1,042 块，但这不是允许暂停的块数门槛：是否划算还取决于总请求数，以及停掉一条后各组最大负载能降多少。例如两组共有 100 条请求，最重组 249 块（200 块的一条加 49 条各 1 块），另一组 50 条各 1 块时，暂停 200 块那条会提高公式中的吞吐估计。

## 计划怎样落地：只传块数，下一步开头对号入座

**计划在这一步的末尾算、下一步的开头执行。跨组传的只有一串块数，没有请求编号；每组拿到自己那份以后，在本地按块数去找对得上的请求。**

每组引擎每一步都会走到「全局还有没有活」那次判断，空闲的组陪跑时也会走到（见[空闲的组由谁叫起来陪跑](data-parallel.md#空闲的组由谁叫起来陪跑陪跑时算什么)）。全局还有活、且 DyntraLB 这一步生效时，每组接着做三件事：

```wiki-diagram
file: dyntra-lb-flow
```

1. **准备候选。** 先刷新 waiting 中被阻塞的请求，并尝试替尚未计算的新请求预取远端 KV。异步拉取中的请求、连接器暂时无法确定命中量的请求、此次预取借不到块或超过预取名额的请求不进候选；暂停后仍保有 KV 的请求可以进入。一次最多考察「请求数上限的两倍 − 正在跑的条数」条尚未计算的请求；失败的尝试也占这个名额。候选表示可以继续尝试调度；报告零远端命中或无需异步加载本身不排除候选，实际进入仍依赖其他检查，因此候选身份没有包含“全部历史 KV 已到齐”这个条件。
2. **互报。** 每组把一串定长整数发给所有组（[All-Gather](collective-communication.md#all-gather)：每个成员交一份，结束后人人拿到全部）。前面依次是 running 里每条请求的块数、候选里每条的块数，不够长补 0；倒数第二格是 running 的条数，用来分开这两段；最后一格标记本组有没有来过超长的新请求。整串长度是「请求数上限 × 2 + 2」，例子里上限是 4，DP1 发出的是 [1, 1, 1, 1, 64, 0, 0, 0, 4, 0]。
3. **各自算计划。** 每组拿到同一张表、跑同一套算法，算出的计划必然一致，不需要谁来下命令；每组只留下自己那份：停哪些块数、进哪些块数、冻不冻结。

下一步调度一开始先执行计划：拿「停」的块数去 running 里找块数相同的请求，找到一条停一条；拿「进」的块数去候选里找。计划里只有数字，两条块数相同的请求在它眼里没有区别，最后停的是哪一条，取决于它们在 running 里的先后。接着调度器照常先排 running、再尝试接纳 waiting，只多一道准入关：计划生效时，只有被计划点到的候选才有资格进入。点到也不保证本步实际执行，仍须通过 token 预算、运行请求数、KV、LoRA 和异步旧输出等检查。

计划每一步重算一份，只用一次。一波请求的第一步没有上一步留下的计划，照常调度。

## 暂停、抢占、预取：三种状态怎么分

**DyntraLB 的暂停只是这一步不让它上，KV 块全部留着；真正的抢占是块不够时收回一条请求的全部块、以后从头重算；预取是替还没开跑的请求先分块、拉 KV。三者的对象、粒度和恢复条件都不同。**

| | 对象与粒度 | KV 块 | 怎样恢复 |
|---|---|---|---|
| DyntraLB 暂停 | 一整条正在跑的请求，逐步决定 | 一块不还，已算进度保留 | 它排在候选里，后面某步计划点到它的块数，或 DyntraLB 不生效时按普通顺序接回；不用重算 |
| 真正的抢占 | running 队尾那条（默认先来先服务） | 全部收回，已算进度清零 | 排回 waiting 队首，拿到块后从头重算（见[池子不够时](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)） |
| 候选预取 | waiting 里还没开跑的新请求 | 先在本组分好块，从 P 拉 KV | 拉完才成为候选，等计划点名 |

被暂停的请求排回 waiting 的最前面，状态值和被抢占的请求一样，都是 PREEMPTED，看日志时要看是谁触发的：负载均衡的暂停另记在一个集合里，真抢占发生时先把请求从这个集合里划掉。表里「真正的抢占」一行是上游默认的做法；D 节点同时开了 recompute 调度时，抢占改走另一条路，先试着把 KV 存走（见 [recompute 调度器](recompute-scheduler.md)），DyntraLB 这时换用配套的调度器类，暂停的做法不变。

这也划出了 DyntraLB 的作用范围：它调整各组本步执行哪些请求，目标是减少组间等待，实际收益要按前面的时间记录确认。暂停本身不还块，所以不能靠它腾空某组的 KV 池（见下文常见误解）。它也从不把 KV 换出到 CPU 内存，那是另一类特性（见 [KV cache CPU offload](kv-cache-cpu-offload.md)）。

## 什么时候生效：两种模式与开启前提

**默认的 `dynamic` 模式平时不动，要等来了一条超过 700 块的新请求才激活，之后连续 256 个有效规划步没有新的超长请求就关掉；`static` 模式在配置的步数区间内一直评估负载，官方只建议排障时用。两种模式默认都从每一波第 250 步完成后的快照起生成下一步计划。**

在展开触发细节之前，先用一张图把 DyntraLB 步末互报的定长 `int32` 向量、四步规划器、暂停与抢占的区别，以及 `dynamic` 模式下的块长门槛陷阱（例如 `block=640` 时永远够不着 `700` 块）串起来：

```wiki-diagram
file: dyntra-lb-fig-watermark-routing
```

- **dynamic 怎样被叫醒。** 新请求进本组时数一次块数，严格大于 700 块才算超长。还没启动时，各组每步额外做一次两个整数的 All-Reduce（取最大值），只要有一组见过超长请求，全部组同时启动；启动后，互报里那一格「有没有新的超长请求」为真，就把 256 步的计数清零。
- **第 250 步从哪数。** 步数每一波从头数：各组都闲下来、这一波结束时归零，下一批请求到来重新数。还可以设一个不包含在内的结束步，默认不设。`dynamic` 的 256 步计数只在已激活且处于这个起止区间、实际汇总负载的步骤增加，不等于激活后任意经过 256 个引擎步。
- **阈值的单位是块，不是 token。** 块多大，阈值就等于多少 token：每块 `128` 个 token 时，`700` 块对应 `89,600` 个 token，须至少 `701` 块才算超长；每块 `32` 个 token 时只有 `22,400` 个 token。反过来，块很大、上下文上限又短的模型可能永远够不着。例如每块 `2,048` 个 token、上下文上限 `262,144` 个 token 时，一条请求最多 `128` 块，默认 `dynamic` 永不触发，须改为 `static` 或把阈值调到 `128` 以下。

超过长请求阈值只触发长请求标记，让尚未激活的 `dynamic` 模式开始评估负载；是否调整各组下一步执行的本地请求，仍取决于后续负载判断。因此，出现超过阈值的请求，并不意味着一定会暂停某个请求。

开启前提有四道写进了启动检查，不满足服务就起不来：

1. **必须是 D 节点**，也就是 PD 分离里接收 KV 的一方（`kv_role` 为 `kv_consumer`）。PD 混部、P 节点都不行。
2. **DP 至少两组**，只有一组没什么可均衡的。
3. **不能与不兼容调度特性同开。** `v0.30.0` 同时禁止与 Balance Scheduling、`profiling_chunk_config` 同开。`main` 移除了 `profiling_chunk_config` 及对应互斥项，保留与 Balance Scheduling 互斥，并在开启 DyntraLB 时自动关闭 SWA bounded replay。
4. **只在一台机器内。** 官方要求这个 decode 实例的所有 DP 组都在一台机器上。启动检查实际拦的是「单个 DP 组跨了几台机器」：一组横跨两台会报错；每台一整组、两组分在两台时，这项检查算出来是 1，不报错，但已经不在官方支持的范围内。

还有一个不报错的前提：**模型必须是 MoE**。DyntraLB 靠替换「MoE 模型开 DP 时才用的那种引擎进程」挂上去；dense 模型的各组彼此独立，vLLM 根本不建这种进程，于是检查全过、启动正常，均衡却一次也不跑。源码注释里验证过的模型只有 Qwen3-30B 和 Qwen3.5-35B。

## 复杂异构实战对照：GLM 双机为何未启用与块尺偏差

前面用标准全注意力、每块 128 token 的 D 端双 DP 组走通了 DyntraLB 的换人与触发机制。下面切换标尺，对照**例外 B 历史绑定算例**[官方 GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)：两台机器是 PD 混部且各跑一个 DP 组，绑定镜像里也没有 DyntraLB 代码；以下只拿双机事实对照门槛与块尺偏差，不给它在 GLM 上的效果数字。

- **开不了的三个原因。** 其一，本部署没有配 KV 传输、不是 D 节点；采用含 DyntraLB 的版本也过不了 D 节点检查。其二，本部署钉住的 vllm-ascend 提交里没有 DyntraLB，本文对照的 `v0.30.0` 与 `main` 才有。其三，即使照 [PD 页的拆法](pd-disaggregation.md#把这两台机器拆成一-p-一-d)把两台拆成一 P 一 D，D 也只剩一台 8 卡的实例，按主线的 TP8 切法只有一个 DP 组，过不了「DP 至少两组」；在一台 8 卡里再分出多个 DP 组是另一套配置，本站没有它的数字。现在这两个 DP 组分在两台机器上，也不在官方支持的「一台机器内」范围里。
- **主线里同样有「等最重的组」，但原因不同。** 场景 M 里 DP0 这一步有 6,048 个有效 token、DP1 只有 28 个，执行使用 6,048 的共同宽度，具体算子怎样处理有效行和补齐行见[示例场景 M](concurrent-requests.md#示例场景-m-与变体-m)。差距来自 DP0 正在 prefill 的一条 6,000 token 新请求；正常 PD 分工将这段工作交给 P，DyntraLB 主要针对 D 端 decode 的历史长短差距。不过 D 的调度代码仍能计算未命中的 token，不能把“D 端绝不做 prefill”当成保证。混部时对应的机制是 Balance Scheduling，本部署也没开（见 [Balance Scheduling 放到 GLM 双机](balance-scheduling.md#放到-glm-双机本部署没开开了会怎样)）。
- **块数这把尺子在 GLM 上偏得更多。** GLM 主干 `45` 层里 `34` 层是 KDA，每条请求的状态大小固定，每步读多少和历史长短无关。另外 `11` 层（加 MTP 共 `12` 层）是稀疏 MLA，主 attention 最多细读 `2,048` 挑中位置加最多 `3` 个尾位置（合计至多 `2,051` 个，见[稀疏 MLA 读哪些位置](attention-cost.md#稀疏-mla一层挂三份缓存只有主潜向量被主-attention-读)）。真正随历史变长的只有打分 indexer（见 [GLM 两类层各读多少](attention-cost.md#放到-glm-双机一个-token-走过两类层各存多少读多少)）。因此「块数多一倍，这一步就慢一倍」在 GLM 上弱得多，且暂无实测。
- **「一块」是多少 token，取决于配套的上游。** DyntraLB 读的是调度器配置里的块大小，上游在 KV 初始化后会把它改写成各缓存组块大小的最小值。社区 `main` 取最小值时跳过不参与前缀缓存的组（含 GLM 每条只占一块的 indexer 尾状态组），于是「一块」落到全注意力组的逻辑块（固定镜像上为 `640` token，`main` 具体值未核）。而 `v0.29.0` 不跳过，一块就成了尾状态组的 `4 + 3 = 7` 个 token（压缩比 `4` 加 MTP `3` 草稿）。按 `640` 计，上下文上限 `133,120` 最多 `208` 块，够不着默认 `700` 块阈值，`dynamic` 不会自动激活；只要块长超过约 `190` 个 token，都是这个结果。
- **暂停和抢占在 GLM 上差在哪。** 主线里一条约 `67,000` 个 token 的请求被抢占时，会还掉 `120–121` 块；之后要重算约 `9` 步 prefill，KDA 状态也要重建（见[并发页的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)）。同一条请求若被 DyntraLB 暂停，这 `120–121` 块一块不还，回来时不用重算。前者腾显存、后者保进度，这是两种状态本身的区别，不是 DyntraLB 在 GLM 上的收益。

## 常见误解

- **「它会把请求从忙的组挪到闲的组。」** 一条都不挪。请求派到哪一组仍由前端决定，DyntraLB 只在每组自己手上暂停或接纳。
- **「开了它，每一步就变短了。」** 组内换人能改变本步推进哪些请求，却不直接给出步耗时。开篇例子既要检查 DP1 能否在原等待时间内做完新增工作，也要检查 DP0 的耗时是否变化；即使减少最重组的块数，仍须计入模型、投机草稿和算子成本。用块数判断候选计划，用时间记录判断收益。
- **「失衡门槛 5 是 5%。」** 门槛不小于 1 时是块数差，默认的 5 就是 5 块；小于 1 时才按比例算。
- **「开了它就一直在均衡。」** 默认的 dynamic 模式要等一条超长请求才激活，连续 256 个有效规划步没有新的超长请求又会关掉；块大、上下文短的模型在默认配置下可能永远等不到。
- **「暂停能腾出显存。」** 被暂停的请求 KV 块一块不还，预取还会提前占块；显存不够时靠的是真正的抢占。
- **「它和 EPLB 是一回事。」** EPLB 调的是专家放在哪张卡，压平专家那一段的等待；DyntraLB 调的是各组这一步让哪些请求上，压平注意力那一段的等待。
- **「块数就是显存字节。」** 块数只是估负载的尺子：不按字节算，不区分块里存的是哪种状态，也不看专家路由。

## 对照源码

### 怎么开

- 只在 D 节点上配，P 节点不要加。一段示例（模型路径和连接器按实际改）：

  ```bash
  vllm serve /path/to/model \
    --data-parallel-size 2 \
    --kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer"}' \
    --additional-config '{"scheduler_config": {"dyntra_lb_config": {"enabled": true}}}'
  ```

- 全部键和默认值：`enabled=false`、`mode="dynamic"`、`start_step=250`、`end_step=-1`、`bubble_threshold=5.0`、`long_req_block_threshold=700`、`dynamic_max_step=256`、`enable_diagnostics=false`。官方示例只写 `enabled` 一个键。
- `dyntra_lb_config` 只从 `scheduler_config` 里读。另外五个调度键（`enable_balance_scheduling` 等）写在 `additional_config` 顶层还能走兼容路径、打一条弃用警告，它没有这条路；普通 Ascend 配置会把顶层同名键作为未知键拒绝。若环境可找到 vllm_omni，工厂会警告并移除未知键，这也不会开启 DyntraLB，仍应使用嵌套写法。
- 排障：官方建议先设 `start_step=0`、`mode="static"`、`enable_diagnostics=true` 做一次短跑，确认各组都进了同样的收集步、没有请求一直卡在等 KV；测性能前关掉诊断，再切回 dynamic，按观测到的块数分布调三个阈值。`bubble_threshold` 太小会频繁暂停、换人，太大则几乎不改原调度。
- 装上去的是两部分。调度器类：没开 recompute 调度时，同步用 `DyntraLBScheduler`、async scheduling 用 `AsyncDyntraLBScheduler`；开了 recompute 调度则换成 `DyntraLBRecomputeScheduler` / `AsyncDyntraLBRecomputeScheduler`，四个类共用 `DyntraLBPolicyMixin` 这一份策略代码。引擎进程：`vllm.v1.engine.core.DPEngineCoreProc` 这个名字被整个换成 `DyntraLBDPEngineCoreProc`，这一支排在 Balance Scheduling 那一支前面（`if … elif`）。
- MoE 这道暗门：上游只在「开了 DP 且模型是 MoE」时构造 `DPEngineCoreProc`，dense 模型的每个 DP rank 按 DP=1 的独立引擎处理，所以 dense 模型上 `run_balance_load` 永远不会被调用。
- 计划何时算、何时用：`run_balance_load` 挂在 `_has_global_unfinished_reqs` 返回真之后，和 Balance Scheduling 同一个位置、同一个理由（陪跑的组也要到场参加集合通信）。上游这个函数每步把 `step_counter` 加一，一波结束时把它清零，`start_step` 比的就是它；真做跨组同步的间隔随上游而变：站内核 main 用的提交是第 1 步和之后每 `dp_sync_interval`（默认 16）步一次，v0.23.0 与 v0.29.0 是每 32 步一次。只要这个函数返回真，`run_balance_load` 每步都跑，不受同步间隔影响。下一步 `schedule()` 一开头调 `_apply_load_balance_modifications` 执行计划，waiting 循环里由 `_can_admit_waiting_request` 把关。
- 互报向量：定长 int32，长 `2 × max_num_seqs + 2`，缓冲区在 `_init_data_parallel` 里一次分配、每步原地覆盖；长请求检测在 `add_request` 里，只在 dynamic 模式比较 `blk_num > long_req_block_threshold`。
- 计划格式：`{"out_blk": [...], "in_blk": [...], "freeze": bool}`；`freeze` 恰好等于 `len(in_blk) == 0`，返回前同组同块数的一出一进两两抵消。补空位的 `fill_running_from_waiting`、换人的 `find_best_swap` 与停一条的 `try_drop_for_throughput` 都是 `_balance_load` 里的内部函数。
- 挑暂停对象的两轮：第一轮只挑带 `lb_newly_added` 属性的请求，但全仓除单元测试外没有地方给 `Request` 设这个属性，上游 84030bbe 与 v0.29.0 也都没有，所以第一轮实际空手，只剩第二轮「按 running 顺序先匹配上的」[I]。planner 内部 `_RequestItem` 的 `newly_added` 是另一回事，只在同分时优先换掉刚补进来的项。
- 候选预取：`prepare_dyntra_lb_step` 先刷新阻塞中的请求，再调 `_run_lb_kv_prefetch`；只考察 `num_computed_tokens == 0` 的请求，尝试上限 `2 × max_num_running_reqs − len(running)`，超出上限、连接器还给不出结果或借不到块的记为未就绪。`ext_tokens == 0` 或无需异步加载的分支直接继续，未把请求标成未就绪；候选最终按 WAITING/PREEMPTED 与未就绪集合筛选，不是“全部 KV 已到齐”的判定。下一步仍执行常规准入和未命中 token 的预算检查。
- 暂停与抢占：`_lb_pause_request` 断言请求在 RUNNING，改状态为 PREEMPTED、记进 `_lb_paused_req_ids`、`prepend_request` 塞回队首，一个块都不释放；`_preempt_request` 第一件事是把 id 从这个集合里划掉，再交给上游那条释放全部块、`num_computed_tokens` 清零的路径。
- 失衡的两种单位：`calc_bubble` 里 `threshold < 1` 分岔；官方参数表写明 1 表示一个 KV 块，不是 100%。

### 会报什么错

- 启动检查按顺序连设五道 `ValueError`：
  - 同开 Balance Scheduling：`DyntraLB cannot be used with enable_balance_scheduling.`
  - 没有 `kv_transfer_config` 或 `kv_role` 不是 `kv_consumer`：`DyntraLB is only supported on PD-disaggregated D nodes ...`
  - `data_parallel_size <= 1`：`DyntraLB requires data_parallel_size > 1.`
  - `nnodes_within_dp > 1`：`DyntraLB only supports decoder instances that run on a single node ...`
  - 同开 `profiling_chunk_config`：`DyntraLB cannot be used with profiling_chunk_config.`
- `nnodes_within_dp` 在上游按 `nnodes // (data_parallel_size // data_parallel_size_local)` 计算，只有一台时恒为 1。两台机器各一个完整 DP 组时，分母为 2、结果为 1，所以第四道只拦「一组跨机」，拦不住「两组分两台」；后者由官方文档的「所有 DP 组在一台机器」排除。
- `DyntraLBConfig` 自身的校验：`mode` 不在 static、dynamic 里，`start_step < 0`，`end_step < -1`，设了 `end_step` 却不大于 `start_step`，`bubble_threshold <= 0`，`long_req_block_threshold <= 0`，`dynamic_max_step <= 0`，各报一条 `ValueError`。
- 块大小不是正整数：`RuntimeError: Invalid DyntraLB block size: ...`。
- 不报错的：dense 模型上一切正常启动，但均衡从不运行。源码注释的验证模型只有 Qwen3-30B、Qwen3.5-35B。

### 开销和什么时候别开

- 每步的集合通信都走 DP 组的通信组：生效期间一次 All-Gather，每组交 `2 × max_num_seqs + 2` 个 int32；dynamic 未激活时一次两个 int32 的 All-Reduce（取最大）。
- 规划本身最多 1000 轮，每轮对最轻、最重两组做「running × 候选」的配对搜索。
- 吞吐估计是写死的：`STEP_LATENCY_FIXED_OVERHEAD = 20000`、`STEP_LATENCY_PER_BLOCK = 19.2`，没有单位，也没有标定说明。官方说块数估计不是对每个模型、每种流量的时延或吞吐保证，并要求和投机解码、async scheduling 组合时按实际版本验证。
- 什么时候别开：dense 模型（开了不跑）；PD 混部或 P 节点（起不来）；请求长短差不多的流量、只有一个 DP 组、DP 组分在多台机器；块大、上下文上限短于「长请求阈值 × 块大小」的模型又不改默认值时（dynamic 永远不激活，每步白做一次 All-Reduce）。
- 设计上它一条请求都不跨组搬；调整本地请求的执行资格可能减少其他组等待，但块数只是工作量估计，是否减少等待仍取决于实际执行耗时。暂停的请求保留已分配的 KV cache，因此暂停本身不会释放这些缓存，也不能通过跨组迁移缓解某组的 KV 池容量压力。

### 版本差异

本文流程图中的旧主线同步循环保留原基线；配套 vLLM 0.30 的 `dp_sync_interval` 默认 16 且可配置，dummy 步宽按投机配置推导，不能从旧 GLM 图沿用 32 圈/4 token 常数。

**`v0.30.0 (c09d3e20)` 与 `main (8d6180e2)` 均保留 DyntraLB 配置及默认关闭状态。** `scheduler_config.dyntra_lb_config` 默认 `enabled=false`、`mode="dynamic"`、`start_step=250`、`end_step=-1`、`bubble_threshold=5.0`、`long_req_block_threshold=700`、`dynamic_max_step=256`。块长读取 `scheduler.cache_config.block_size`，须为正整数，请求负载按全部 token 数向上取块数，不能固定按 128 token 一块。启动仍要求 `kv_role` 严格为 `kv_consumer`、`DP>1`、`nnodes_within_dp<=1` 且与 Balance Scheduling 互斥；`main (8d6180e2)` 移除了 `profiling_chunk_config` 及其互斥校验，将等待队列由 `skipped_waiting` 改接上游 `kv_holding_waiting`，并在开启 DyntraLB 时经 `_swa_bounded_replay_unsupported_mode` 自动关闭 SWA bounded replay。配置检查不等于证明所有 DP rank 真在同一台机器，官方单节点 decoder 的支持范围仍要保留。

| 项 | v0.23.0 (2c59ff10) | v0.26.0rc (2ed6cbba) | v0.30.0 (c09d3e20) | main (8d6180e2) |
|---|---|---|---|---|
| DyntraLB 功能与默认状态 | 无 | 无 | 有，默认关（仅支持 `scheduler_config.dyntra_lb_config` 嵌套写法） | 有，默认关（同 v0.30.0 嵌套写法与 7 项默认参数） |
| 互斥检查与调度器接入 | 无 | 无 | 互斥 `enable_balance_scheduling` 与 `profiling_chunk_config`；可与 `recompute_scheduler_enable` 组合为 4 个专用类 | 移除 `profiling_chunk_config` 及其互斥检查；保留与 Balance 互斥和 Recompute 4 类组合；开启时自动降级关闭 SWA bounded replay |
| 等待队列与预取追踪 | 无 | 无 | 基于 `skipped_waiting` 与 `waiting` 合并排序并执行 KV 预取 | 改接 `kv_holding_waiting` 与 `waiting`，统一经 `_handle_blocked_waiting_request` 刷新 |

本部署镜像 `db701c1f` 亦无 DyntraLB 的调度器、引擎补丁与配置分支。早期社区 `main`（`baa023ad`）仓库登记的已验证 vLLM 提交为 `84030bbe`，发布标签另登记为 `v0.29.0`（`98dff2a8`）；二者在跨组同步间隔（每 16 步可调 vs 每 32 步）与 KV 初始化改写块大小（是否跳过 GLM 尾状态组）上存在差异，其中 DyntraLB 每步照跑不受同步间隔影响，而块大小差异决定 GLM 上「一块」对应多少 token（见上文 GLM 一节）。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 块数怎么算 | `vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L41-L52` |
| 候选准备与 KV 预取 | `vllm-ascend@c09d3e20:vllm_ascend/core/dyntra_lb_scheduler.py#L140-L245`；`main (8d6180e2)` 改接 `kv_holding_waiting` 见 `#L140-L230` |
| 计划落地、准入 | `vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L250-L292`、`#L436-L443`、`#L700-L705` |
| 暂停与抢占 | 同一文件 `#L364-L419` |
| planner：失衡、补位、换人、停一条、收尾 | `vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L123-L321` |
| 缓冲区、长请求检测、何时生效 | 同一文件 `#L324-L470` |
| 打包与 All-Gather | 同一文件 `#L472-L517` |
| 引擎进程替换 | `vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_engine_core.py#L32-L42` |
| 启动检查、调度器类与 SWA 降级 | `vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1086-L1115`、`#L1380-L1385`；`vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1260-L1287`、`#L1586-L1630` |
| 配置项、默认值、只认嵌套写法 | `vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1579-L1635`；`vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1672-L1727` |
| 官方说明 | `vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md` |
| 上游 main：只为 MoE 建 DP 进程；步数、波次与同步间隔；节点数定义；块大小改写跳过不参与前缀缓存的组 | `vllm@84030bbe:vllm/v1/engine/core.py#L1319-L1328`、`#L2242-L2270`、`#L333-L349`；`vllm/config/parallel.py#L145-L146`、`#L752-L759` |
| v0.29.0 的块大小改写（不跳过）；上游抢占 | `vllm@98dff2a8:vllm/v1/engine/core.py#L332-L338`；`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995` |
| GLM 尾状态组：每块 = 压缩比 + 草稿数，不参与前缀缓存 | `vllm-ascend@baa023ad:vllm_ascend/models/glm5next/kv_cache.py#L28-L42`；`vllm_ascend/core/kv_cache_interface.py#L303-L322` |

**证据索引。** 是什么、不搬请求、暂停保留 KV、适用前提见 [S1]；开启前提与互斥见 [S2][C19]；阈值以块计、1 表示一个块见 [S3]；两种模式与「本步末尾算、下一步执行」见 [S4][C16]；排障与调参建议见 [S5]；块数公式见 [C6]；planner 的补位、换人、停一条与收尾见 [C12][C13][C14]；缓冲区、长请求检测与打包见 [C15][C17]；计划落地与准入见 [C8]；预取见 [C7]；暂停与抢占见 [C9][C28]；引擎进程替换与 MoE 暗门见 [C18][C24]；配置默认值、校验与只认嵌套写法见 [C22][C23]；步数与波次见 [C25]；节点数定义见 [C26]；调度器类名与执行点见上面的源码位置表；版本差异按三个提交整仓检索。

以下由上述源码推出 [D]：失衡 63.5 → 32 块与吞吐账三个数、DP1 的互报向量、阈值在不同块大小下的 token 等价、「两组分两台时第四道检查算出 1」，以及 GLM 上「一块」的两种取值与「每块 640 个 token 时最多 208 块、默认阈值够不着」（由两版上游的块大小改写 [C27][C29]、GLM 尾状态组的块大小与不参与前缀缓存 [C30][C31] 推出；main 的上游口径见 [C33]）。GLM 的层数、读取量与 2,051 的上限、上下文上限 133,120、场景 M 与抢占的 120–121 块、约 9 步重算取自部署、模型、注意力开销与并发页。

**待核：缺以下材料。**

- DyntraLB 在任何 GLM 配置上的吞吐和时延，包括被暂停请求和长请求的尾延迟会不会变差：没有实测，也没有「D 节点、单机多 DP 组」的 GLM 配置。
- 块数与真实步长的相关性：官方与源码都没给标定数据，20000、19.2 两个常数的来历不明。
- main 上 GLM 全注意力组的逻辑块具体是多少 token：本部署镜像上是 640；main 的对齐规则改过，没有实跑确认。只要超过约 190 个 token，默认长请求阈值在本部署的上下文上限内就够不着。
- 两个 DP 组分在两台机器、第四道检查没拦住时，DyntraLB 能否正常运行：官方不支持，没有验证记录。
- 与投机解码（GLM 用 MTP）、async scheduling 同开时的行为：官方要求按实际版本验证。
- 与 EPLB 同开的效果：源码没有互斥检查，也没有资料。

长请求标记只触发评估，不保证产生调整。固定 main 的 `patch_dyntra_lb_core.py` 先处理跨组标记、动态激活和起止步限制，再汇总负载生成并交付计划（来源 16、17）。是否减少等待、能否提高吞吐，仍需在满足该版本支持条件的部署上测量。

- 来源 35、36、37：vllm-ascend@baa023ad，docs/source/user_guide/feature_guide/dyntra_lb.md，L8–L12、L155–L157、L198–L207。
- 来源 38：vllm-ascend@baa023ad，vllm_ascend/patch/platform/patch_dyntra_lb_core.py，L201–L204。
- 来源 45–46 补充候选进入常规调度后仍受异步输出、LoRA、token 预算等约束，以及 D 端计算未命中 token 的实际分支；47–48 补充调度配置兼容优先级、顶层未知键的严格校验及 Omni 例外；49–50 对应登记的发布标签与 v0.29.0 的 32 步同步。来源 13–14 的实际比较分别为吞吐更高或特定平局、失衡不小于门槛，不能从固定开销折算出的 1,042 块另造暂停门槛。
