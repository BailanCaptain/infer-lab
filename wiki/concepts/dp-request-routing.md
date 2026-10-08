---
id: dp-request-routing
title: DP 请求路由：新请求派给哪一个 DP 组
type: concept
summary: 开了 DP 以后，前端给每条新请求挑一个 DP 组：请求头写了组号就直接去，否则按 waiting × 4 + running 取分数最小的组，并在本地先记一笔。讲清计数从哪来、为什么会过时、挑偏的代价（排队、KV 池、每步对齐、前缀缓存），几种部署方式与各版本打分差异，以及 GLM 双机上怎样选。
aliases: ["DP 请求路由","DP routing","DP 负载均衡","DP load balancing","选 DP 组","前端路由","get_core_engine_for_request","X-data-parallel-rank","data_parallel_rank","data_parallel_hybrid_lb","external LB","hybrid LB","internal LB","DPAsyncMPClient","DPLBAsyncMPClient","lb_engines","engine_inflight"]
chapters: ["13"]
order: 35
sources:
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L1365-L1426
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L1314-L1357
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L108-L131
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L267-L270
  - vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L397-L410
  - vllm@0fc695fc:vllm/v1/engine/input_processor.py#L259-L267
  - vllm@0fc695fc:vllm/v1/engine/coordinator.py#L22-L56
  - vllm@0fc695fc:vllm/v1/engine/coordinator.py#L254-L278
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1856-L1888
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1233-L1262
  - vllm@0fc695fc:vllm/v1/engine/core.py#L913-L919
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1797-L1799
  - vllm@0fc695fc:vllm/v1/pool/late_interaction.py#L15-L36
  - vllm@0fc695fc:vllm/config/parallel.py#L138-L150
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L1818-L1899
  - vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L71-L121
  - vllm@0fc695fc:vllm/config/parallel.py#L794-L799
  - vllm@568afb3a:vllm/v1/engine/core_client.py#L1413-L1442
  - vllm@98dff2a8:vllm/v1/engine/core_client.py#L1472-L1543
  - vllm-ascend@2c59ff10:Dockerfile#L42-L42
  - vllm-ascend@2ed6cbba:Dockerfile#L54-L54
  - vllm-ascend@baa023ad:Dockerfile#L46-L46
verified: []
evidence: "C"
relations:
  - {to: data-parallel, kind: builds-on, note: DP 组是什么、各组各有 scheduler 与 KV 池、waiting 为什么按 4 倍算、请求派定不迁移}
  - {to: request-call-chain, kind: builds-on, note: 前端、协调器、EngineCore 各在哪个进程，请求和计数走哪条通道}
  - {to: vllm-engine-core, kind: builds-on, note: 引擎一圈的顺序决定计数什么时候报、新请求什么时候进 waiting}
  - {to: concurrent-requests, kind: builds-on, note: 场景 M 的两组打分，以及两组每步按最宽的一组对齐}
  - {to: balance-scheduling, kind: builds-on, note: 路由只数条数、计数会过时留下的缺口，由它在各组准入时补}
  - {to: prefix-caching, kind: builds-on, note: 前缀缓存只在一组自己的池子里命中，派到别组要重算}
contradicts: []
updated: "2026-09-29"
origin: direct
---

## 一条新请求进来，派给哪一个 DP 组？

**DP 请求路由，是开了 DP 以后前端给每条新请求挑一个 DP 组的那一步。对生成文字的请求，vLLM 默认的前端有两条路：请求头里写明了组号，就直接派给那组；没写，就按每组排队和在算的请求条数打一个分，派给分数最小的那组。派定以后，这条请求一直留在那组。**

先把几个词说清。[DP（data parallel，数据并行）](data-parallel.md)把请求分给几组卡去算，每组叫一个 DP 组：稠密模型每组各放一份完整权重；[MoE](moe.md)（mixture of experts，混合专家）模型把一部分层换成许多并排的「专家」小网络，专家只放一份、摊在所有组的卡上，几组合起来才是一份完整模型。每组各有一个 EngineCore（这一组的引擎进程）和它里面的 scheduler（调度器，每一步决定这组算哪些请求）。scheduler 手里有两个队列：**running** 放已经开始算的请求，**waiting** 放已经到了、还没开始算的请求。**前端**是接 HTTP、做分词的 API server 进程，所有请求都先到它这里，再由它交给某一组的引擎（各进程怎样分布，见[七站分在三种进程里](request-call-chain.md#七站分在三种进程里)）。选组之前，前端已经做完检查、套模板、分词和定采样参数，见[API server 入口](api-server-entry.md)。

看一个例子（数为示意）：两组 DP0、DP1，此刻 DP0 有 6 条请求在算，DP1 有 3 条，两组都没有排队的。

- 请求 A 的请求头里写着组号 0。前端不做任何比较，直接派给 DP0。上游如果有自己的路由器，想把某些请求固定送到某一组，走的就是这条路。
- 请求 B 什么都没写。前端看自己手里的计数表，给两组各打一个分：分数 = waiting 条数 × 4 + running 条数。DP0 得 6，DP1 得 3，B 派给分数小的 DP1。派出以后，前端先在本地给 DP1 的 waiting 记上 1 条，免得下一条请求还拿旧数去比。

```wiki-diagram
file: dp-request-routing
```

两条路只在一处分叉：请求头里有没有组号。有组号的请求不参与打分，前端的计数表也不记它；没组号的请求才看计数表，选完还要在表上记一笔。两条路的终点相同：请求经进程间消息送进那一组引擎的输入队列，再进那组的 waiting。

**派定以后不换组。** 请求的 KV cache（存放它已经算过的上下文）从那组的池子里分，它的每一步都由那组的 scheduler 安排；组与组之间没有搬请求的机制，所以这一次选择决定了这条请求从头到尾在哪组算。

## 为什么要挑，挑偏了代价在哪？

**DP 多出来的吞吐，来自几组同时各算各的请求；请求分得越匀，每组排队越少，各组手上的活也越接近。前端挑偏了，代价落在四处：排队、KV 池、MoE 的每步对齐，以及前缀缓存。**

如果不挑、所有请求都进 DP0，DP1 那组卡和它上面的权重就闲着，能同时服务的请求数退回一组的水平。在 MoE 模型里更糟：DP1 没有请求也得每一步陪着跑（原因见[MoE 模型里，两组为什么不能各跑各的](data-parallel.md#moe-模型里两组为什么不能各跑各的)），卡在转，却不产出。轮流派（第一条给 DP0、第二条给 DP1……）也不够：请求的长短差得很远，一组可能被几条长请求占住，轮到它时它并不空。所以默认前端看的是每组此刻的队列长度；waiting 为什么按 4 倍算，见[请求怎样派进某一组](data-parallel.md#请求怎样派进某一组)。

但分数只数条数，不知道每条请求要算多久；手里的数又会过时（后面两节细讲），所以总有挑偏的时候。挑偏的代价有四种：

1. **排队。** 每组同时在算的请求有上限（见[请求数上限](vllm-scheduler.md#为什么按-token-设预算还要另设请求数上限)）。派进已满的那组，新请求只能在它的 waiting 里等；另一组空着位置也接不走它，第一个 token 出来得更晚。
2. **KV 池。** 每组有自己的一池 KV 块。长请求扎堆在一组，这组的块先用光，就要让最后进来的请求让位、以后重算（见[一组的请求共用一个池子](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)），而另一组的池子还空着。
3. **MoE 的每步对齐。** MoE 模型的各组每一步一起进出专家通信，这一步的宽度按最宽的那组对齐（见[再补到两组的最大值](concurrent-requests.md#再补到两组的最大值)）。负载堆在一组，每一步的宽度就被这组拉高，另一组也得按这个宽度陪着跑。宽度之外还有时长：宽度对齐了，各组这一步要读的历史（条数 × 各自的上下文长度）并不一样，谁最重，谁就定下这一步走多久，快的组在通信点上等它（见[快的组要在通信点上等慢的组](balance-scheduling.md#为什么需要它快的组要在通信点上等慢的组)）。
4. **前缀缓存。** [Prefix caching](prefix-caching.md)（前缀缓存：开头相同的请求直接复用已经算好的那几块 KV）只在一组自己的池子里查。开头相同的两条请求被派到两组，这段开头就要在两组各算一遍、各存一份。默认的打分只看条数，不看开头是否相同。

用示意数看第 4 种。设一块装 16 个 token，前缀缓存只认写满的整块；两条请求 P、Q 开头都是同一段 2,048 个 token 的系统提示，后面各跟 100 个 token 的问题。P 先到，已经在 DP0 算完。

```calc
title: 开头相同的两条请求，同组和分组各要算多少（示意）
共同开头写满的块 = 2,048 ÷ 16 = 128 块
Q 与 P 同组时要算的 token = 2,148 − 128 × 16 = 100 个 token
Q 派到另一组时要算的 token = 2,148 个 token
> 另一组的池子里还要再存一份这 128 块
```

同组时 Q 只算自己那 100 个 token；派到另一组，2,148 个 token 全要算，多出来的 2,048 个正是那段共同开头。这种代价只在打开了 prefix caching 的部署里才有；GLM 双机上它是关着的，见后面 GLM 一节。

## 怎么挑：把一次选组一步步算出来

**前端每派一条请求，按固定顺序做四件事：先看请求头有没有组号；没有，就从起点那组开始逐组算分，遇到严格更小的才换；选中后在本地计数表上给那组的 waiting 加一笔；最后登记「这条请求在哪组」，把它发过去。**

1. **看请求头。** 前端从请求头 `X-data-parallel-rank` 里取组号。值能读成整数，就直接用它，后面的打分和记账都跳过；读不成整数（比如写了个字母），当作没写；是整数但不在 0 到「组数 − 1」之间，请求在入口就被拒掉（报错原文见[会报什么错](#会报什么错)）。
2. **逐组算分。** 分数 = waiting 条数 × 4 + running 条数。从「起点」那组开始依次往后比，只有分数**严格小于**目前的最小值才换成它，所以两组分数相同时，先比到的那组胜出。只有一个前端时，起点就是 DP0：两组都空着时，新请求落在 DP0。
3. **本地记一笔。** 给选中那组的 waiting 加上前端的个数（只有一个前端时加 1），相当于这组的分数立刻涨 4 分。协调器推来新数之前，后面的请求都拿这张记过账的表来比。
4. **登记归属，发出去。** 前端记下请求去了哪组，以后取消时按这份记录找到那组；然后经 ZMQ（一个进程间消息库）把请求送进那组引擎的输入队列。要是此刻各组都停着，前端还顺带通知协调器，把各组一起叫醒（见[什么时候停，怎样再叫醒](data-parallel.md#什么时候停怎样再叫醒)）。

接着开头的例子，看一串请求在两次推送之间连着到来时，前端怎样逐条挑组（数为示意）。刚收到的推送是 DP0 有 0 条 waiting、6 条 running，DP1 有 0 条 waiting、3 条 running；随后 100 ms 内依次来了 A、B、C、D 四条，只有 A 的请求头写了组号 0。

```calc
title: 两次推送之间连来四条请求，前端逐条挑组（示意）
A 的去向 = 请求头写了 0，直接去 DP0，本地表不动

B 看 DP0 = 0 × 4 + 6 = 6
B 看 DP1 = 0 × 4 + 3 = 3
> 3 更小，B 去 DP1；本地把 DP1 的 waiting 记成 1

C 看 DP0 = 0 × 4 + 6 = 6
C 看 DP1 = 1 × 4 + 3 = 7
> 6 更小，C 去 DP0；本地把 DP0 的 waiting 记成 1

D 看 DP0 = 1 × 4 + 6 = 10
D 看 DP1 = 1 × 4 + 3 = 7
> 7 更小，D 去 DP1；本地把 DP1 的 waiting 记成 2
```

四条请求两组各分到两条：DP0 多了 A、C，DP1 多了 B、D。本地记账让 B、C、D 在两组之间交替，没有一窝蜂全落进当时最空的 DP1。但这本账不全：C 算分时，前端以为 DP0 的 waiting 还是 0，其实 A 已经先进了 DP0。要是 A 也记在账上，C 看到的 DP0 是 1 × 4 + 6 = 10 分，比 DP1 的 7 分大，C 就会去 DP1。**请求头指定组号的请求不进本地账**，这是计数表偏离真实负载的一个来源；另一个来源是计数本身的延迟，下一节讲。

## 计数表从哪来，为什么会过时？

**计数表里的数由各组引擎报给 DP 协调器，协调器再推给前端，前端收到就把整张表换掉。引擎只在每一步的前后报数，协调器在数有变化时最快每 100 ms 推一次，所以前端看到的总是稍早一刻的样子；两次推送之间，只有前端自己记的那几笔在补。**

```wiki-diagram
file: dp-request-routing-flow
```

1. **引擎报数。** 每个 DP 组的 EngineCore 一圈一圈地转（见[一圈按什么顺序走](vllm-engine-core.md#一圈按什么顺序走一条示意请求转两圈)）：先把输入队列里新到的请求收进 waiting，报一次两个条数；算完这一步，再报一次。条数没变就不报。waiting 这个数还包括因为条件暂时不满足、被放在另一条等待队列里的请求。
2. **协调器推送。** DP 协调器是 node0 上汇总各组负载的小进程。它收到新数后，离上次推送满 100 ms 就推给前端；各组的数一直没变时，每 5 s 推一次。
3. **前端换表。** 前端收到推送，把整张计数表换成推来的数，本地记的那几笔随之清掉，由引擎报上来的真实条数接替。
4. **请求进引擎。** 前端派出的请求先停在那组引擎的输入队列里。引擎正在算一步时不收新请求，要等这一步算完、下一圈开头才把它们收进 waiting，这时报出的数里才有它们。

所以前端手里的数，通常要落后「一步的时长，再加上 100 ms 量级」。一步很长（比如正在算一段几千个 token 的提示词）时，这一步里到达的请求都还在输入队列里，协调器也没有新数可推，前端只能靠自己记的账；有请求算完、腾出位置时，也要等这一步结束、下一次推送到了，前端才知道。这个盲区会让新请求排进已满的那组，另一组的空位闲着，见 [Balance Scheduling 的例子](balance-scheduling.md#为什么需要它快的组要在通信点上等慢的组)。

接上一节的例子：A 到 D 到达时，两组正在算一步。这一步结束后，两组引擎把输入队列里的请求收进 waiting，DP1 这一步还有 2 条请求算完了；下一次推送到达时，设 A 到 D 还没开始算，这时又来一条请求 E。

```calc
title: 推送到达以后，第五条请求 E 看到的分数（示意）
推来的 DP0（waiting, running） = (2, 6)
推来的 DP1（waiting, running） = (2, 3 − 2) = (2, 1)
E 看 DP0 = 2 × 4 + 6 = 14
E 看 DP1 = 2 × 4 + 1 = 9
> 9 更小，E 去 DP1
```

推送把两处偏差一起纠正了：DP0 的 waiting 从本地账上的 1 变成真实的 2，漏记的 A 回到了账上；DP1 刚算完的 2 条也反映出来，running 从 3 降到 1。反过来，推来的数也可能早于 A 到 D 进 waiting：协调器等各组报齐一步再推，有时推的是上一步汇总好的数；一步很长、各组都没报新数时，它还会每 5 s 把旧数重推一次。这时本地记的那几笔被清掉，这几条请求暂时从前端的账上消失，后面的请求会按偏低的数去比。

## 不走默认打分的几种情况

**默认打分管的是「前端看得到全部组」这一种部署。另有三种情况会绕开或改写它：池化模型的 late interaction 请求按键固定组；几个前端一起派时，每个前端各记各的账；部署成 hybrid 或 external 方式时，组与组之间交给 vLLM 之外的负载均衡器来分。**

**池化模型的 late interaction 请求。** 池化模型输出的是向量，不生成文字；late interaction 是其中一种打分方式：先把查询算成一组向量缓存起来，再拿去和一批文档逐个比。这份缓存放在那一组 worker 进程的本地内存里，所以前端把带同一个查询键的请求，按键的哈希值固定派到同一组，不打分。这是默认前端里唯一一条「看缓存选组」的规则，生成文字的请求不走它。

**几个前端一起派。** 一台机器可以起几个 API server 进程，一起分担接 HTTP 和分词。每个前端都有自己的一张计数表，协调器的推送同时发给所有前端；两次推送之间，各前端看不到别人派了什么，所以每派一条，就给所选组记上「前端个数」条 waiting，按「别的前端大概也在这么派」来估。各前端比较的起点也错开：起点 = 组数 × 前端编号 ÷ 前端个数（向下取整）。比如 4 组、2 个前端时，前端 0 从 DP0 比起，前端 1 从 DP2 比起，各组都空时两个前端不会都先挑 DP0。不写前端个数时，默认方式会起「组数」个前端。

**三种部署方式。** 前面讲的都是 internal 方式。另两种把「组与组之间怎么分」交给外部：

| 方式 | 谁给请求挑组 | 怎样进入这种方式 |
|---|---|---|
| internal（默认） | 看得到全部组的前端，按分数挑 | 不写相关参数；其余机器用 headless 方式只起引擎 |
| hybrid | 每台机器的前端只在本机几组里按分数挑；机器之间由外部负载均衡器分 | 显式打开，或没用 headless 的机器写了非 0 的起始组号 |
| external | 每组一个前端，只管自己那组；组与组之间全由外部负载均衡器分 | 显式打开，或启动时写了本组组号；只支持 MoE 模型 |

external 方式下，引擎不再向协调器报条数，协调器只转发各组的启停状态；它还有一个变体，由一个监管进程给本机每组各起一个前端、各占一个端口。hybrid 方式下引擎照常报数，每个前端从推来的整张表里只取本机那几组。外部负载均衡器按什么规则分（看不看前缀、要不要同一会话落在同一组），由它自己决定，不在 vLLM 里。另外，推断成 hybrid 的机器上本机只有 1 组时，会自动改成 external 并打一条 warning（原文见[会报什么错](#会报什么错)）。

**派出去以后的补救。** 路由只在请求进门时决定一次，派偏以后 vLLM 不搬请求。vllm-ascend 另有两种在各组内部调节的机制：[Balance Scheduling](balance-scheduling.md) 在某一组顶满时让所有组暂停接纳 waiting；[DyntraLB](dyntra-lb.md) 只在 main 上、PD 分离的 decode 端按各组的 KV 块数暂停或接纳请求。两者都不改变请求派到哪组。

## 放到 GLM 双机：node0 上一个前端给两台机器派活

**官方双机是 DP2：node0 上只有一个前端，它按 v0.23 的规则给 DP0（node0）和 DP1（node1）打分派活；示例请求 R1 落到 DP0，场景 M 的新请求默认会去 DP1。本部署的两组每一步按最宽的一组对齐，所以一条长提示词落在哪组，这一步两组的宽度几乎一样；派偏改变的是哪组更重——每一步走多久由它决定——以及排队和 KV 池的压力堆在哪组。**

部署参数见[部署前提](glm-5-3-flash-two-node.md#部署前提)。落到路由上是这几条：

- **一个前端，internal 方式。** node0 正常启动，起一个 API server（前端个数设成 1）、DP 协调器和 DP0 的引擎；node1 用 headless 方式只起 DP1 的引擎，连回 node0（见[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)）。两组都由 node0 这一个前端来挑：每派一条，本地记 1 条 waiting；比较的起点固定是 DP0。
- **打分规则是 v0.23 的。** 本部署镜像配的上游 vLLM 是 v0.23.0，分数就是 waiting × 4 + running；vllm-ascend 没有改选组这一步，Balance Scheduling 也没开。
- **前缀缓存关着。** GLM 同时有全注意力和线性注意力两类层，vLLM 默认判定这类模型不支持 prefix caching，教程也没打开它（见[GLM 双机上它开着吗](prefix-caching.md#glm-双机上它开着吗)）。所以前面说的第 4 种代价在本部署是零：开头相同的请求派到哪组，开头都要完整算一遍。
- **R1 落到 DP0。** R1 是主线的示例请求，提示词 4 个 token。它到来时两组都空，分数都是 0；DP0 先比，平分时先比到的胜出，所以 R1 进了 DP0（见[一条请求的第 1 站](one-request.md#第-1-站-入口从-http-到-node0-的引擎)）。
- **场景 M 的新请求默认去 DP1。** 场景 M 是主线的多请求示例：DP0 有 12 条请求在 decode（逐个生成新 token 的阶段，与处理提示词的 prefill 阶段相对），DP1 有 7 条，这时来了一条提示词 6000 个 token 的新请求 N，场景设定它落在 DP0。按 12 对 7 的分数，默认前端其实会把 N 派给 DP1；落到 DP0 只可能是请求头指定了组号 0，或者计数滞后（打分过程见[多条请求的第 1 站](concurrent-requests.md#第-1-站-入口新请求先挑一个-dp-组)）。

N 落在哪组，差别有多大？先交代三条规则：decode 时每条请求一步占 4 个位置（上一步确定的 1 个 token，加上 MTP——multi-token prediction，模型自带的草稿层——草拟的 3 个候选）；纯 decode 的一步先补到最近的图尺寸——启动时只按 4、8、16、32、64、96、128 这几档 token 宽度录了计算图，补到其中第一个不小于它的一档——混着 prefill 的一步不用图、不补；两组再取两者中较宽的那个一起跑（规则的来历见[宽度先按自己补，再按对面补](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)）。

```calc
title: 场景 M 里 N 落在哪组，两组这一步和下一步多宽
N 在 DP0 时这一步 = max(12 × 4 + 6000, 7 × 4 → 32) = 6048 个 token
N 在 DP1 时这一步 = max(12 × 4 → 64, 7 × 4 + 6000) = 6028 个 token
N 在 DP0 时下一步 = max(13 × 4 → 64, 7 × 4 → 32) = 64 个 token
N 在 DP1 时下一步 = max(12 × 4 → 64, 8 × 4 → 32) = 64 个 token
> 这一步有一组混着 prefill，两组都不用图；下一步两组都是纯 decode，都补到 64 用图
```

这一步只差 20 行，下一步一样宽：本部署两组每步按最宽的一组对齐，一条长提示词落在哪组，它自己就定下了这一步两组的宽度。但宽度一样不等于代价一样。一头是时长：N 落进哪组，那组之后每一步都要多读一段 6000 token 的历史，这一步走多久由更重的那组决定，另一组在通信点上等它——N 进 DP0 是 13 对 7，本来就重的那组更重；N 进 DP1 是 12 对 8，两组接近。另一头是额度：每组最多同时算 32 条请求、每步最多 8192 个 token（见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)），KV 块也是每组一池，先顶满的那组要让新请求排队、或让已有请求让位，另一组的余量帮不上。如果上游用请求头把请求全钉在 DP0，DP1 就只剩每步陪跑（见[空闲的 DP 组为什么还要陪跑](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)）。

## 常见误解

- **「DP 路由和 MoE 的 router 是一回事。」** MoE 的 router 在每一层里给每个 token 挑专家，挑中的专家可能在另一组的卡上；DP 路由在请求进门时给整条请求挑一个组，只挑一次。一个管 token 在层内去哪算，一个管请求在哪组排队。
- **「前端会把请求派给前缀能命中的那组。」** v0.23 的默认打分只看 waiting、running 两个条数。要按前缀或会话分组，得在前端之前放一个自己的路由器、用请求头指定组号，或者用 hybrid / external 方式交给外部负载均衡器。默认前端里唯一看缓存的规则，只管池化模型的 late interaction 请求。
- **「请求头指定的组号也会记进计数表。」** 不会。显式指定跳过打分，也跳过本地记账，要等引擎报上来、协调器推回来，前端才看得到它；main 配套的上游版本另加了一个在途计数，会把它记上（见[版本差异](#版本差异)）。
- **「两组分数相同时随机挑。」** v0.23 是固定的：从起点那组开始比，严格更小才换，只有一个前端时平分总落在 DP0。v0.26 起每打一次分，起点往后挪一组，平分才轮流。
- **「前端手里的负载是实时的。」** 引擎只在每一步前后报数，协调器有变化时最快每 100 ms 推一次，前端手里的数通常落后一步的时长再加 100 ms 量级。
- **「派进去以后，忙的组会把请求交给闲的组。」** 请求派定后从头到尾在那一组，KV cache 也留在那组，没有迁移。
- **「把新请求派给闲的那组，这一步两组就能少算。」** 不能。两组加起来要算的量不变，宽度也按最宽的那组对齐：场景 M 的 N 派给 DP0 还是 DP1，这一步的宽度是 6048 对 6028，下一步都是 64。变的是哪组更重——每一步走多久由最重的那组决定，派得越偏，另一组在通信点上等得越久。

## 对照源码

### 怎么开

- **默认就有。** 数据并行组数大于 1、又没选 external 方式时，前端自动用带打分的引擎客户端（DPLBAsyncMPClient）；选了 external，就换成只连一组的客户端（DPAsyncMPClient）。选组函数是 `get_core_engine_for_request`。
- **指定组号。** 在 chat、completion 等 OpenAI 兼容接口的请求头里写 `X-data-parallel-rank: 1`，前端就不再打分。
- **前端个数。** `--api-server-count N`；internal 方式下不写时默认等于数据并行组数，external 与多端口方式默认 1，hybrid 默认等于本机组数。
- **hybrid。** `--data-parallel-hybrid-lb`（`-dph`），或者没用 `--headless` 的机器写了非 0 的 `--data-parallel-start-rank`，自动推断成 hybrid。
- **external。** `--data-parallel-external-lb`（`-dpe`），或者启动时写了 `--data-parallel-rank`（`-dpn`）；多端口变体是 `--data-parallel-multi-port-external-lb`。
- **GLM 双机。** node0 普通启动、`--api-server-count 1`；node1 带 `--headless` 和 `--data-parallel-start-rank 1`，所以整体是 internal 方式 [A]。

### 会报什么错

- 组号越界：`ValueError: data_parallel_rank 2 is out of range [0, 2).`。hybrid 与 external 方式下，上限是本机组数，不是全局组数。
- 请求头的值不是整数：不报错，按没写处理。
- 非 MoE 模型用 external：`ValueError: Non-MoE models do not support external data parallel mode. For external load balancing, launch independent vLLM instances without --data-parallel-* arguments.`
- 同时选了两种方式：`ValueError: Cannot use more than one data parallel load balancing mode. ...`
- headless 又开 hybrid：断言失败，`data_parallel_hybrid_lb is not applicable in headless mode`。
- 本机只有 1 组却推断成 hybrid：warning `data_parallel_hybrid_lb is not eligible when data_parallel_size_local = 1, autoswitch to data_parallel_external_lb.`，随后按 external 起。GLM 的 node1 如果漏了 `--headless` 又留着起始组号，启动时会看到这一条 [D]。
- elastic EP 与 hybrid / external 同开：`NotImplementedError: Elastic EP is not compatible with data_parallel_external_lb or data_parallel_hybrid_lb. ...`

### 开销和什么时候别开

- 选组本身很便宜：每条请求把各组的分数比一遍，源码注释说组数多了以后打算改成只随机抽两组来比。
- 计数通常落后一步的时长再加 100 ms 量级；一步越长，前端越依赖本地记的账 [D]。
- 请求头指定组号适合上游路由器要做会话粘连、前缀亲和的场景；代价是这些请求不进前端本地账，和默认打分混用时，被指定那组的负载会被低估 [D]。
- hybrid / external 适合每组一个 pod 的大规模 EP 部署，或需要自带分配策略的外部路由器；external 只支持 MoE，且两种方式都不能和 elastic EP 同开。
- GLM 双机只有两组、一个前端，默认 internal 方式就够；选组的计算开销可以忽略，要留意的是计数滞后和请求头指定造成的偏斜。

### 版本差异

| | v0.23 | v0.26 | main |
|---|---|---|---|
| 配套的上游 vLLM | 0fc695fc（v0.23.0）；GLM 镜像 db701c1f 用同一版上游 | 568afb3a（v0.26.0） | 98dff2a8（v0.29.0） |
| 分数 | waiting × 4 + running | 同 v0.23 | max(前端个数 × 本前端在途条数, waiting + running)；waiting 不为 0 时再加 waiting × 6 × max(0, KV 占用 − 0.5) |
| 平分 | 起点固定，单前端总是 DP0 | 每打一次分，起点后移一组 | 同 v0.26 |
| 请求头指定的请求 | 不进本地账 | 同 v0.23 | 仍不改计数表，但记进在途条数 |
| late interaction 固定组、三种部署方式 | 有 | 同 v0.23 | 同 v0.23 |
| vllm-ascend 是否改选组 | 否 | 否 | 否 |

配套关系按 vllm-ascend 各钉点 Dockerfile 里写的上游版本号取：2c59ff10 写 v0.23.0，2ed6cbba 写 v0.26.0，baa023ad 写 v0.29.0。v0.23 与 v0.26 的打分逐字相同，差别只在 v0.26 打完分后把起点后移一组。main 配套版本的改动有两处：

- **在途条数兜底。** 在途条数是本前端派出、还没结束的请求条数，请求头指定的也算。它只在本前端里增减，推送覆盖不掉，所以一串请求在两次推送之间涌来时，仍会轮流落到各组。
- **waiting 的权重随 KV 占用变化。** KV 占用不超过 50% 时不加罚分，waiting 与 running 同样按 1 条算；占用到 100% 时每条 waiting 多算 3 分，合起来就是 v0.23 的 4 倍。KV 占用由引擎和两个条数一起报上来。

### 源码位置

| 做什么 | 位置 |
|---|---|
| 选组：请求头 → late interaction → 打分 → 本地记账 → 登记归属；前端个数与起点 | `vllm@0fc695fc:vllm/v1/engine/core_client.py#L1365-L1426` |
| 收推送、整张换表；发送请求、叫醒各组 | `vllm@0fc695fc:vllm/v1/engine/core_client.py#L1314-L1357` |
| 按部署方式选引擎客户端 | `vllm@0fc695fc:vllm/v1/engine/core_client.py#L108-L131` |
| 请求头取组号、组号范围检查 | `vllm/entrypoints/openai/engine/serving.py#L397-L410`、`vllm/v1/engine/input_processor.py#L259-L267` |
| 协调器的职责与推送节奏 | `vllm/v1/engine/coordinator.py#L22-L56`、`#L254-L278` |
| 引擎每步前后报数、只在 internal / hybrid 报 | `vllm/v1/engine/core.py#L1856-L1888`、`#L913-L919` |
| 一步中间到达的请求停在输入队列 | `vllm/v1/engine/core.py#L1233-L1262` |
| waiting 条数含被跳过的请求 | `vllm/v1/core/sched/scheduler.py#L1797-L1799` |
| late interaction 按键固定组 | `vllm/v1/pool/late_interaction.py#L15-L36` |
| 部署方式的参数、推断与默认前端个数 | `vllm/config/parallel.py#L138-L150`、`vllm/engine/arg_utils.py#L1818-L1899`、`vllm/entrypoints/cli/serve.py#L71-L121` |
| v0.26 / main 配套版本的选组 | `vllm@568afb3a:vllm/v1/engine/core_client.py#L1413-L1442`、`vllm@98dff2a8:vllm/v1/engine/core_client.py#L1472-L1543` |

**证据索引。** 选组四步、平分规则、前端个数与起点见 [C1]；换表与发送见 [C2]；部署方式与客户端见 [C3][C14][C15][C16]；请求头与越界见 [C4][C5][C6]；计数的报、推、口径与输入队列见 [C7][C8][C9][C10][C11][C12]；late interaction 见 [C13]；elastic EP 的限制见 [C17]；版本差异见 [C18][C19]，配套关系见 [C20][C21][C22]。「计数落后一步再加 100 ms 量级」和「推送的旧数会清掉本地账」是按源码时序推出来的 [D]，GLM 两种落点的宽度按底稿 01 的对齐规则推算 [D]；GLM 启动参数取自底稿 01 的进程账，本页没有直接读教程命令 [A]。

**待核。**
- 计数滞后在实机上的量级（一步多长、推送实际间隔）：缺实测日志。
- vllm-ascend main 实际部署时可能配别的上游 commit（例如 2026-09-21 的 vLLM main 6b858751，这段逻辑与 v0.29.0 相同）：缺部署侧的版本钉点。
- 多前端时 late interaction 与在途计数的交互：本页未展开。
