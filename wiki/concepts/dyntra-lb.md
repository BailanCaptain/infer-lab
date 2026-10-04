---
id: dyntra-lb
title: DyntraLB：D 端各 DP 组按 KV 块数换人，少等最重的组
type: feature
summary: vllm-ascend main 上 PD 分离 decode 端的 DP 负载均衡：各组每步互报请求的 KV 块数，下一步在本组内暂停或接纳请求，让各组注意力负载接近；不搬请求，暂停不还 KV。讲清与 EPLB、Balance Scheduling 的分工、计划怎样算、何时生效，以及本部署为何没开。
aliases: ["DyntraLB","DynTra","Dynamic Intra-Decoder Data-Parallel Load Balancing","dyntra_lb_config","动态 DP 负载均衡","D 端 DP 负载均衡","lb_pause_request"]
chapters: ["12"]
order: 70
sources:
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L3-L25
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L27-L45
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L71-L86
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L88-L157
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md#L159-L210
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L41-L52
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L166-L248
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L250-L292
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L364-L419
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L436-L443
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L700-L705
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L123-L175
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L175-L239
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L240-L321
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L324-L399
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L401-L470
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L472-L517
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_engine_core.py#L32-L42
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L984-L1012
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1254-L1260
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1470-L1488
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1363-L1397
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1450-L1464
  - vllm@84030bbe:vllm/v1/engine/core.py#L1319-L1328
  - vllm@84030bbe:vllm/v1/engine/core.py#L2242-L2270
  - vllm@84030bbe:vllm/config/parallel.py#L752-L759
  - vllm@84030bbe:vllm/v1/engine/core.py#L333-L349
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995
  - vllm@98dff2a8:vllm/v1/engine/core.py#L332-L338
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/kv_cache.py#L28-L42
  - vllm-ascend@baa023ad:vllm_ascend/core/kv_cache_interface.py#L303-L322
  - vllm@84030bbe:vllm/config/parallel.py#L145-L146
  - vllm-ascend@baa023ad:.github/vllm-main-verified.commit#L1-L1
verified: []
evidence: "C"
relations:
  - {to: data-parallel, kind: builds-on, note: 各组为什么每一步要一起走、请求为什么一直留在派进去的那组}
  - {to: pd-disaggregation, kind: builds-on, note: D 节点是什么，候选请求的 KV 怎样从 P 拉过来}
  - {to: balance-scheduling, kind: alternative-to, note: 同样防「等最重的组」但只数条数，main 上与本特性二选一}
  - {to: expert-parallel, kind: builds-on, note: dispatch 与 combine 把各组绑在一起；专家那一段的等待归 EPLB 管}
  - {to: vllm-scheduler, kind: builds-on, note: running 与 waiting，以及真正的抢占怎样收回 KV 块}
contradicts: []
updated: "2026-09-29"
origin: direct
---

## DyntraLB 是什么？

**DyntraLB（Dynamic Intra-Decoder Data-Parallel Load Balancing）是 vllm-ascend 开发主线上给 PD 分离的 decode 端用的负载均衡：同一个 decode 实例里的几个 DP 组，每一步末尾互报手上每条请求占了几个 KV 块，按同一张表算出下一步各组暂停哪几条、接纳哪几条，让各组这一步要读的历史差不多多。请求不在组之间搬，被暂停的请求也不交还 KV 块。**

先交代几个词。[PD 分离](pd-disaggregation.md)把一条请求的 prefill（一次算完整段提示词）和 decode（之后逐个生成 token）交给两组机器，专做 decode 的那组叫 D 节点，新请求带着 P 那边算好的 KV cache 过来。[DP](data-parallel.md) 把一个实例分成几个 DP 组，每组有自己的调度器，手里两个队列：running 放正在算的请求，waiting 放已经到了、还没开始算的请求（见 [vLLM 调度器](vllm-scheduler.md)）。KV cache 按块存放（见[缓存按块存放](kv-cache.md#缓存按块存放一个位置的-kv-写进哪一格)），一条请求的历史越长，占的块越多。

看一个例子（数为示意，每组最多同时跑 4 条，DyntraLB 这一步已经生效）。某一步结束时，DP0 在跑一条很长的对话，历史占 128 块，外加三条各占 1 块的短问答；DP1 在跑四条 1 块的短问答，waiting 里还有一条 KV 已经从 P 拉到、占 64 块的请求。按条数算两组都是 4 条，可 DP0 每一步要读 131 块历史，DP1 只读 4 块。DyntraLB 让两组用一次 All-Gather（每组交一份，结束后人人拿到全部）把块数汇成同一张表，算出计划：DP1 暂停一条 1 块的短问答，把那条 64 块的请求换进来；DP0 这一步不接新请求。

```wiki-diagram
file: dyntra-lb
```

换完以后两组分别读 131 块和 67 块。DP0 那条长对话仍在 DP0；DP1 被暂停的短问答仍在 DP1，KV 块原样留着，等以后计划点到它再接着算。DyntraLB 能动的只有「这一步各组让谁上」。

这样换赚在哪？两组的条数没变，这一步也还是由读 131 块的 DP0 定时长；可那条 64 块的请求迟早要算，趁 DP0 反正要慢的时候让 DP1 把它算了，DP1 原本空等的时间就变成了干活的时间，这条长请求也不会在以后某一步让 DP1 自己成为最重的那组。亏的是被暂停的那条短问答，它要多等几步。

## 为什么需要它：各组要在 MoE 通信点等最重的一组

**MoE 模型开了 DP 以后，每个 MoE 层里各组都先各算自己请求的注意力，再一起进出专家通信；注意力读得最多的那组最晚到，其余组只能空等，一步里有多少个 MoE 层就等多少回。decode 端各组的请求条数差不多时，决定谁最重的是手上的历史有多长，所以 DyntraLB 数块而不数条。**

[MoE](moe.md) 的专家摊在所有组的卡上，任何一组算 MoE 层，都要把 token 发到专家所在的卡（dispatch）、算完再收回来（combine），别的组必须同时到场（见[两组为什么不能各跑各的](data-parallel.md#moe-模型里两组为什么不能各跑各的)）。注意力不一样：每组的请求和 KV cache 只在本组，各算各的。于是每个 MoE 层里都有两处会合、两种等待；一步 decode 要走过全部层，这样的会合就重复一层又一层，每层都由最慢的组定时长：

```wiki-diagram
file: dyntra-lb-bubble
```

第一处等待在 dispatch 之前。decode 每生成一个 token，注意力都要把这条请求的历史再读一遍（见[每一步注意力要读多少](attention-cost.md#历史越来越长每一步注意力要读多少)），历史长的组算得慢，历史短的组先到、干等。第二处在 combine 之前：这段时间哪张卡上的专家被选得多，哪张卡就最晚交回结果（见 [EP 的负载不均](expert-parallel.md#负载不均最慢的卡决定这一层多久)）。两处由不同的机制来压平：

| 机制 | 压平哪一处等待 | 调整什么 | 依据 |
|---|---|---|---|
| DyntraLB | dispatch 前：各组各算的那段（主要是注意力） | 各组这一步让哪些请求上 | 每条请求的 KV 块数 |
| [Balance Scheduling](balance-scheduling.md) | 同一处，只防差距再拉大 | 各组下一步还收不收新请求 | 各组 running 的条数 |
| [EPLB](eplb.md) | combine 前：专家那一段 | 专家放在哪张卡、热门的多放几份 | 每个专家接到的 token 数 |

DyntraLB 和 Balance Scheduling 管同一段，启动时不能同开；它和 EPLB 管的是不同的两段，源码里没有互斥检查，两者一起开的效果没有资料。这页挂在主线「两个 DP 组怎样分请求、空闲的组为什么陪跑」那一站的 PD 分离变体上：主线本身是混部，两组的互等见[示例场景 M](concurrent-requests.md#示例场景-m-与变体-m)。

代价有三样。一是被暂停的请求这一步不出 token，它的时延变长，同组请求的先来后到也被打乱；官方把「decode 吞吐比严格保持本地执行顺序更重要」列为适用前提。二是每一步多一次跨组互报，还要提前替候选请求把 KV 从 P 拉过来，这些 KV 先占着本组的块。三是块数只是估计：一步的真实耗时还取决于模型结构、投机解码的草稿和算子，块数多一倍不一定慢一倍。

## 怎么算：数块、量失衡、组内换人

**一条请求的块数 = 已有 token 数 ÷ 每块能放的 token 数，向上取整；一组的负载 = 它 running 里各条请求块数之和；失衡 = 最重一组比各组平均多出的块数，超过门槛（默认 5 块）才动手。**

块数每一步都要重数：decode 每生成一个 token，历史就长一点，跨过块边界就多一块。这里只数 token 占了几块，不管块里存的是哪种状态、每块多少字节。按每块 128 个 token 示意，一条 100 token 的短问答占 1 块，一条 16,384 token 的对话占 128 块，一条 8,192 token 的请求占 64 块，就是开头例子里的三种请求。对照 [Balance Scheduling](balance-scheduling.md)：它只数条数，1 块的短问答和 128 块的长对话都算一条，这是两者最根本的区别。

失衡有两种量法，由门槛本身的大小决定：门槛不小于 1 时，量的是块数差「最重 − 平均」；门槛小于 1 时，量的是比例「(最重 − 平均) ÷ 最重」。默认门槛 5.0 属于前一种，意思是 5 块，不是 5%。代入开头的例子：

```calc
title: 换人前后的失衡（数为示意，门槛 5 块）
换人前的平均 = (131 + 4) ÷ 2 = 67.5 块
换人前的失衡 = 131 − 67.5 = 63.5 块
换人后的平均 = (131 + 67) ÷ 2 = 99 块
换人后的失衡 = 131 − 99 = 32 块
```

32 块仍高于门槛，但已经找不到可做的动作，计划就停在这里。算计划时先一次性补空位，然后一轮轮做后面三步；某一轮什么都没做，或者失衡已经低于门槛，就停下（最多 1000 轮）：

1. **先补空位，只在开始时做一次。** 哪组 running 没满，就按排队顺序把候选请求补进去，这一步不看轻重。循环里不再补，所以第 4 步停掉的那条不会被立刻补回来。
2. **让最轻的组变重。** 在最轻的组里找一对「running 里的一条 ↔ 候选里更重的一条」，挑换完以后这组离新平均值最近的那一对来换。例子里 DP1 用 1 块换 64 块，离平均的距离从 63.5 块降到 32 块。
3. **让最重的组变轻。** 同样的找法，换成更轻的候选。例子里 DP0 没有候选，换不了。
4. **两边都换不动，才考虑让最重的组停一条。** 停不停、停谁，看下一节那笔吞吐账。

算完还有两步收尾：同一组里块数相同的一出一进互相抵消，换了等于没换；没有任何「进」的组标成冻结，下一步一条新请求也不接，例子里的 DP0 就是这样。

### 两边都换不动时：一笔写死的吞吐账

**第 4 步用一个固定公式估一步多久：20000 + 19.2 × 最重那组的块数；吞吐 = 各组 running 的总条数 ÷ 这个时长。停掉某一条以后吞吐更高才停，否则这一轮什么都不做。**

两个常数没有单位，是这份实现写死的启发式，不是哪个模型的实测时延。代入换人之后的局面（两组共 8 条在跑，DP0 131 块、DP1 67 块），停 DP0 的哪一条都不划算：

```calc
title: 停一条划不划算（按每 10⁶ 个时间单位完成的条数，数为示意）
现在 = 8 ÷ (20000 + 19.2 × 131) × 10⁶ = 8 ÷ 22,515.2 × 10⁶ ≈ 355.3
停掉 128 块那条 = 7 ÷ (20000 + 19.2 × 67) × 10⁶ = 7 ÷ 21,286.4 × 10⁶ ≈ 328.8
停掉一条 1 块的 = 7 ÷ (20000 + 19.2 × 130) × 10⁶ = 7 ÷ 22,496 × 10⁶ ≈ 311.2
```

停掉 128 块那条以后，最重的变成 DP1 的 67 块，所以按 67 算。两种停法都比现在低，于是这一轮既没换也没停，计划结束。固定项 20000 相当于 20000 ÷ 19.2 ≈ 1,042 块：只有最重的组堆了上千块、停一条能让最大值降下一大截时，这笔账才可能算得过来。

## 计划怎样落地：只传块数，下一步开头对号入座

**计划在这一步的末尾算、下一步的开头执行。跨组传的只有一串块数，没有请求编号；每组拿到自己那份以后，在本地按块数去找对得上的请求。**

每组引擎每一步都会走到「全局还有没有活」那次判断，空闲的组陪跑时也会走到（见[空闲的组由谁叫起来陪跑](data-parallel.md#空闲的组由谁叫起来陪跑陪跑时算什么)）。全局还有活、且 DyntraLB 这一步生效时，每组接着做三件事：

```wiki-diagram
file: dyntra-lb-flow
```

1. **准备候选。** 候选是 waiting 里 KV 已经在本组、可以直接开跑的请求。刚从 P 转来的新请求要先在本组分好块、把 KV 拉过来，还没拉完的不算候选；被暂停过的请求 KV 本来就在，直接算候选。一次最多替「请求数上限的两倍 − 正在跑的条数」条新请求拉 KV，超出的这一步不当候选。
2. **互报。** 每组把一串定长整数发给所有组（[All-Gather](collective-communication.md#all-gather)：每个成员交一份，结束后人人拿到全部）。前面依次是 running 里每条请求的块数、候选里每条的块数，不够长补 0；倒数第二格是 running 的条数，用来分开这两段；最后一格标记本组有没有来过超长的新请求。整串长度是「请求数上限 × 2 + 2」，例子里上限是 4，DP1 发出的是 [1, 1, 1, 1, 64, 0, 0, 0, 4, 0]。
3. **各自算计划。** 每组拿到同一张表、跑同一套算法，算出的计划必然一致，不需要谁来下命令；每组只留下自己那份：停哪些块数、进哪些块数、冻不冻结。

下一步调度一开始先执行计划：拿「停」的块数去 running 里找块数相同的请求，找到一条停一条；拿「进」的块数去候选里找。计划里只有数字，两条块数相同的请求在它眼里没有区别，最后停的是哪一条，取决于它们在 running 里的先后。接着调度器照常先排 running、再从 waiting 里接纳，只多一道关：计划生效时，只有被计划点到的候选能进，没点到的这一步一律不接。

计划每一步重算一份，只用一次。一波请求的第一步没有上一步留下的计划，照常调度。

## 暂停、抢占、预取：三种状态怎么分

**DyntraLB 的暂停只是这一步不让它上，KV 块全部留着；真正的抢占是块不够时收回一条请求的全部块、以后从头重算；预取是替还没开跑的请求先分块、拉 KV。三者的对象、粒度和恢复条件都不同。**

| | 对象与粒度 | KV 块 | 怎样恢复 |
|---|---|---|---|
| DyntraLB 暂停 | 一整条正在跑的请求，逐步决定 | 一块不还，已算进度保留 | 它排在候选里，后面某步计划点到它的块数，或 DyntraLB 不生效时按普通顺序接回；不用重算 |
| 真正的抢占 | running 队尾那条（默认先来先服务） | 全部收回，已算进度清零 | 排回 waiting 队首，拿到块后从头重算（见[池子不够时](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)） |
| 候选预取 | waiting 里还没开跑的新请求 | 先在本组分好块，从 P 拉 KV | 拉完才成为候选，等计划点名 |

被暂停的请求排回 waiting 的最前面，状态值和被抢占的请求一样，都是 PREEMPTED，看日志时要看是谁触发的：负载均衡的暂停另记在一个集合里，真抢占发生时先把请求从这个集合里划掉。表里「真正的抢占」一行是上游默认的做法；D 节点同时开了 recompute 调度时，抢占改走另一条路，先试着把 KV 存走（见 [recompute 调度器](recompute-scheduler.md)），DyntraLB 这时换用配套的调度器类，暂停的做法不变。

这也划出了 DyntraLB 管不到的地方：它缓解的是「每步等最重的组」，缓解不了「某组的 KV 池快满了」（见下文常见误解）。它也从不把 KV 换出到 CPU 内存，那是另一类特性（见 [KV cache CPU offload](kv-cache-cpu-offload.md)）。

## 什么时候生效：两种模式与开启前提

**默认的 dynamic 模式平时不动，要等来了一条超过 700 块的新请求才启动，之后连续 256 步没有新的超长请求就自己关掉；static 模式一直开着，官方只建议排障时用。两种模式都要从每一波的第 250 步起才出计划。**

- **dynamic 怎样被叫醒。** 新请求进本组时数一次块数，严格大于 700 块才算超长。还没启动时，各组每步额外做一次两个整数的 All-Reduce（取最大值），只要有一组见过超长请求，全部组同时启动；启动后，互报里那一格「有没有新的超长请求」为真，就把 256 步的计数清零。
- **第 250 步从哪数。** 步数每一波从头数：各组都闲下来、这一波结束时归零，下一批请求到来重新数。还可以设一个结束步，默认不设。
- **阈值的单位是块，不是 token。** 块多大，阈值就等于多少 token：每块 128 个 token 时，700 块对应 89,600 个 token，要超过它（至少 701 块）才算超长；每块 32 个 token 时只有 22,400 个 token。反过来，块很大、上下文上限又短的模型可能永远够不着：每块 2,048 个 token、上下文上限 262,144 个 token 的模型，一条请求最多 128 块，默认配置下 dynamic 永远不会启动，得改成 static，或把长请求阈值调到 128 以下。

开启前提有四个写进了启动检查，不满足服务就起不来：

1. **必须是 D 节点**，也就是 PD 分离里接收 KV 的一方。PD 混部、P 节点都不行。
2. **DP 至少两组**，只有一组没什么可均衡的。
3. **不能和 Balance Scheduling、profiling chunk 同开。**
4. **只在一台机器内。** 官方要求这个 decode 实例的所有 DP 组都在一台机器上。启动检查实际拦的是「单个 DP 组跨了几台机器」：一组横跨两台会报错；每台一整组、两组分在两台时，这项检查算出来是 1，不报错，但已经不在官方支持的范围内。

还有一个不报错的前提：**模型必须是 MoE**。DyntraLB 靠替换「MoE 模型开 DP 时才用的那种引擎进程」挂上去；dense 模型的各组彼此独立，vLLM 根本不建这种进程，于是检查全过、启动正常，均衡却一次也不跑。源码注释里验证过的模型只有 Qwen3-30B 和 Qwen3.5-35B。

## 放到 GLM 双机：本部署没开，也开不了

**本站的固定部署是 PD 混部，两台机器各是一个 DP 组；DyntraLB 只在 PD 分离的 D 节点上能开，本部署镜像里也没有它的代码。下面只拿主线的事实做对照，不给它在 GLM 上的效果数字。**

部署本身见[部署前提](glm-5-3-flash-two-node.md#部署前提)。

- **开不了的三个原因。** 其一，本部署没有配 KV 传输、不是 D 节点，启动检查第一关就会拦下。其二，本部署钉住的 vllm-ascend 提交里没有 DyntraLB，它只在开发主线上。其三，即使照 [PD 页的拆法](pd-disaggregation.md#把这两台机器拆成一-p-一-d)把两台拆成一 P 一 D，D 也只剩一台 8 卡的实例，按主线的 TP8 切法只有一个 DP 组，过不了「DP 至少两组」；在一台 8 卡里再分出多个 DP 组是另一套配置，本站没有它的数字。现在这两个 DP 组分在两台机器上，也不在官方支持的「一台机器内」范围里。
- **主线里同样有「等最重的组」，但原因不同。** 场景 M 里 DP0 这一步有 6,048 个 token、DP1 只有 28 个，两组都按 6,048 宽前向，步长由忙的那组决定（见[示例场景 M](concurrent-requests.md#示例场景-m-与变体-m)）。那里的差距来自 DP0 正在 prefill 的一条 6,000 token 新请求；D 节点上没有 prefill，这类差距本来就不存在，DyntraLB 对付的是纯 decode 时历史长短造成的差距。混部时对应的机制是 Balance Scheduling，本部署也没开（见 [Balance Scheduling 放到 GLM 双机](balance-scheduling.md#放到-glm-双机本部署没开开了会怎样)）。
- **块数这把尺子在 GLM 上偏得更多。** GLM 主干 45 层里 34 层是 KDA，每条请求的状态大小固定，每步读多少和历史长短无关；另外 11 层（加上 MTP 那一层）是稀疏 MLA，主 attention 按 2,048 个位置的预算挑，连同最多 3 个还没凑满一池的尾部位置，每个查询至多读 2,051 个位置，不随历史变长（见[稀疏 MLA 读哪些位置](attention-cost.md#稀疏-mla一层挂三份缓存只有主潜向量被主-attention-读)）；只有给历史打分的 indexer 那一步随历史变长（见 [GLM 两类层各读多少](attention-cost.md#放到-glm-双机一个-token-走过两类层各存多少读多少)）。所以「块数多一倍，这一步就慢一倍」在 GLM 上比在普通全注意力模型上弱得多；到底弱多少，没有实测。
- **「一块」是多少 token，取决于配套的上游。** DyntraLB 读的是调度器配置里的块大小，上游在 KV 初始化之后会把它改写成各缓存组块大小里的最小值。站内核 main 用的上游提交在取最小值时跳过不参与前缀缓存的组，其中就有 GLM 每条请求只占一块的 indexer 尾状态组，于是一块就是全注意力组的逻辑块（本部署镜像上是 640 个 token，main 上的具体值没核）；v0.29.0 发布版不跳过，一块就成了尾状态组的 4 + 3 = 7 个 token（压缩比 4，加上 MTP 每轮 3 个草稿位置）。按前一种、每块 640 个 token 算，本部署上下文上限 133,120 个 token，一条请求最多 208 块，默认 700 块的长请求阈值够不着，dynamic 不会自己启动；只要一块超过约 190 个 token，都是这个结果。
- **暂停和抢占在 GLM 上差在哪。** 主线里一条约 67,000 个 token 的请求被抢占，会还掉 120–121 块，之后要约 9 步把 prefill 重算回来，KDA 状态也要重建（见[并发页的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)）；同一条请求若是被 DyntraLB 暂停，这 120–121 块一块不还，回来时不用重算。前者腾显存、后者保进度，这是两种状态本身的区别，不是 DyntraLB 在 GLM 上的收益。

## 常见误解

- **「它会把请求从忙的组挪到闲的组。」** 一条都不挪。请求派到哪一组仍由前端决定，DyntraLB 只在每组自己手上暂停或接纳。
- **「开了它，每一步就变短了。」** 例子里最重的 DP0 还是 131 块，这一步并没有变短；变的是 DP1：它原来读完 4 块就开始等，现在把一条 64 块的请求提前算了，等的时间拿来干活。只有「最重的组换轻」和「停掉一条」这两种动作才会直接缩短一步。
- **「失衡门槛 5 是 5%。」** 门槛不小于 1 时是块数差，默认的 5 就是 5 块；小于 1 时才按比例算。
- **「开了它就一直在均衡。」** 默认的 dynamic 模式要等一条超长请求才启动，连续 256 步没有新的超长请求又会关掉；块大、上下文短的模型在默认配置下可能永远等不到。
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
- `dyntra_lb_config` 只从 `scheduler_config` 里读。另外五个调度键（`enable_balance_scheduling` 等）写在 `additional_config` 顶层还能走兼容路径、打一条弃用警告，它没有这条路；顶层的 `AscendConfig` 禁止未知键，写到顶层会在配置校验时报错。
- 排障：官方建议先设 `start_step=0`、`mode="static"`、`enable_diagnostics=true` 做一次短跑，确认各组都进了同样的收集步、没有请求一直卡在等 KV；测性能前关掉诊断，再切回 dynamic，按观测到的块数分布调三个阈值。`bubble_threshold` 太小会频繁暂停、换人，太大则几乎不改原调度。
- 装上去的是两部分。调度器类：没开 recompute 调度时，同步用 `DyntraLBScheduler`、async scheduling 用 `AsyncDyntraLBScheduler`；开了 recompute 调度则换成 `DyntraLBRecomputeScheduler` / `AsyncDyntraLBRecomputeScheduler`，四个类共用 `DyntraLBPolicyMixin` 这一份策略代码。引擎进程：`vllm.v1.engine.core.DPEngineCoreProc` 这个名字被整个换成 `DyntraLBDPEngineCoreProc`，这一支排在 Balance Scheduling 那一支前面（`if … elif`）。
- MoE 这道暗门：上游只在「开了 DP 且模型是 MoE」时构造 `DPEngineCoreProc`，dense 模型的每个 DP rank 按 DP=1 的独立引擎处理，所以 dense 模型上 `run_balance_load` 永远不会被调用。
- 计划何时算、何时用：`run_balance_load` 挂在 `_has_global_unfinished_reqs` 返回真之后，和 Balance Scheduling 同一个位置、同一个理由（陪跑的组也要到场参加集合通信）。上游这个函数每步把 `step_counter` 加一，一波结束时把它清零，`start_step` 比的就是它；真做跨组同步的间隔随上游而变：站内核 main 用的提交是第 1 步和之后每 `dp_sync_interval`（默认 16）步一次，v0.23.0 与 v0.29.0 是每 32 步一次。只要这个函数返回真，`run_balance_load` 每步都跑，不受同步间隔影响。下一步 `schedule()` 一开头调 `_apply_load_balance_modifications` 执行计划，waiting 循环里由 `_can_admit_waiting_request` 把关。
- 互报向量：定长 int32，长 `2 × max_num_seqs + 2`，缓冲区在 `_init_data_parallel` 里一次分配、每步原地覆盖；长请求检测在 `add_request` 里，只在 dynamic 模式比较 `blk_num > long_req_block_threshold`。
- 计划格式：`{"out_blk": [...], "in_blk": [...], "freeze": bool}`；`freeze` 恰好等于 `len(in_blk) == 0`，返回前同组同块数的一出一进两两抵消。补空位的 `fill_running_from_waiting`、换人的 `find_best_swap` 与停一条的 `try_drop_for_throughput` 都是 `_balance_load` 里的内部函数。
- 挑暂停对象的两轮：第一轮只挑带 `lb_newly_added` 属性的请求，但全仓除单元测试外没有地方给 `Request` 设这个属性，上游 84030bbe 与 v0.29.0 也都没有，所以第一轮实际空手，只剩第二轮「按 running 顺序先匹配上的」[I]。planner 内部 `_RequestItem` 的 `newly_added` 是另一回事，只在同分时优先换掉刚补进来的项。
- 候选预取：`prepare_dyntra_lb_step` 先刷新阻塞中的请求，再调 `_run_lb_kv_prefetch`；只替 `num_computed_tokens == 0` 的请求拉，上限 `2 × max_num_running_reqs − len(running)`，超出上限、连接器还给不出结果或借不到块的记为未就绪，不进候选。
- 暂停与抢占：`_lb_pause_request` 断言请求在 RUNNING，改状态为 PREEMPTED、记进 `_lb_paused_req_ids`、`prepend_request` 塞回队首，一个块都不释放；`_preempt_request` 第一件事是把 id 从这个集合里划掉，再交给上游那条释放全部块、`num_computed_tokens` 清零的路径。
- 失衡的两种单位：`calc_bubble` 里 `threshold < 1` 分岔；官方参数表写明 1 表示一个 KV 块，不是 100%。

### 会报什么错

- 启动检查按顺序连设五道 `ValueError`：
  - 同开 Balance Scheduling：`DyntraLB cannot be used with enable_balance_scheduling.`
  - 没有 `kv_transfer_config` 或 `kv_role` 不是 `kv_consumer`：`DyntraLB is only supported on PD-disaggregated D nodes ...`
  - `data_parallel_size <= 1`：`DyntraLB requires data_parallel_size > 1.`
  - `nnodes_within_dp > 1`：`DyntraLB only supports decoder instances that run on a single node ...`
  - 同开 `profiling_chunk_config`：`DyntraLB cannot be used with profiling_chunk_config.`
- `nnodes_within_dp` 在上游定义为「总节点数 ÷ DP 组占了几台节点」，只有一台时恒为 1。每台一整组、两组分两台时它也是 1，所以第四道只拦「一组跨机」，拦不住「两组分两台」；后者由官方文档的「所有 DP 组在一台机器」排除。
- `DyntraLBConfig` 自身的校验：`mode` 不在 static、dynamic 里，`start_step < 0`，`end_step < -1`，设了 `end_step` 却不大于 `start_step`，`bubble_threshold <= 0`，`long_req_block_threshold <= 0`，`dynamic_max_step <= 0`，各报一条 `ValueError`。
- 块大小不是正整数：`RuntimeError: Invalid DyntraLB block size: ...`。
- 不报错的：dense 模型上一切正常启动，但均衡从不运行。源码注释的验证模型只有 Qwen3-30B、Qwen3.5-35B。

### 开销和什么时候别开

- 每步的集合通信都走 DP 组的通信组：生效期间一次 All-Gather，每组交 `2 × max_num_seqs + 2` 个 int32；dynamic 未激活时一次两个 int32 的 All-Reduce（取最大）。
- 规划本身最多 1000 轮，每轮对最轻、最重两组做「running × 候选」的配对搜索。
- 吞吐估计是写死的：`STEP_LATENCY_FIXED_OVERHEAD = 20000`、`STEP_LATENCY_PER_BLOCK = 19.2`，没有单位，也没有标定说明。官方说块数估计不是对每个模型、每种流量的时延或吞吐保证，并要求和投机解码、async scheduling 组合时按实际版本验证。
- 什么时候别开：dense 模型（开了不跑）；PD 混部或 P 节点（起不来）；请求长短差不多的流量、只有一个 DP 组、DP 组分在多台机器；块大、上下文上限短于「长请求阈值 × 块大小」的模型又不改默认值时（dynamic 永远不激活，每步白做一次 All-Reduce）。
- 设计上它一条请求都不跨组搬，所以缓解得了「每步等最重的组」，缓解不了「某组 KV 池满」。

### 版本差异

| | v0.23 维护分支 2c59ff10 | 本部署镜像 db701c1f | v0.26 2ed6cbba | main baa023ad |
|---|---|---|---|---|
| DyntraLB | 无 | 无 | 无 | 有，默认关 |

前三个提交整仓搜 dyntra 一条都没有：调度器文件、引擎补丁、官方说明都不存在，挑调度器那段代码里也没有它的分支。main 配套的上游有两种口径：仓库里登记的「已验证的 vLLM main 提交」是 84030bbe，站内核 main 都按它；发布依赖是 vLLM v0.29.0（98dff2a8）。本页按 84030bbe 核对，两者在本页相关的地方有两处不同：「全局还有没有活」的跨组同步，84030bbe 是第 1 步和之后每 16 步（可调）一次，v0.29.0 是每 32 步一次，DyntraLB 每步照跑不受影响；KV 初始化后改写块大小时，84030bbe 跳过 GLM 的尾状态组，v0.29.0 不跳过，于是 GLM 上「一块」是多少 token 不同（见上文 GLM 一节）。本页讲的全是开发主线，随时可能变。

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 块数怎么算 | `vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L41-L52` |
| 候选准备与 KV 预取 | 同一文件 `#L166-L248` |
| 计划落地、准入 | 同一文件 `#L250-L292`、`#L436-L443`、`#L700-L705` |
| 暂停与抢占 | 同一文件 `#L364-L419` |
| planner：失衡、补位、换人、停一条、收尾 | `vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L123-L321` |
| 缓冲区、长请求检测、何时生效 | 同一文件 `#L324-L470` |
| 打包与 All-Gather | 同一文件 `#L472-L517` |
| 引擎进程替换 | `vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_engine_core.py#L32-L42` |
| 启动检查、调度器类 | `vllm-ascend@baa023ad:vllm_ascend/platform.py#L984-L1012`、`#L1254-L1260`、`#L1470-L1488` |
| 配置项、默认值、只认嵌套写法 | `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1363-L1397`、`#L1450-L1464` |
| 官方说明 | `vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/dyntra_lb.md` |
| main 登记的已验证上游提交 | `vllm-ascend@baa023ad:.github/vllm-main-verified.commit#L1-L1` |
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
