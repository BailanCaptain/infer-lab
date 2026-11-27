---
id: dp-request-routing
title: DP 请求路由：新请求派给哪一个 DP 组
type: concept
legacyAnchors:
  放到-glm-双机node0-上一个前端给两台机器派活: 双机-16-卡混合部署dp2-路由与场景-m-步宽对照
  复杂异构实战对照glm-双机上的-dp2-路由与场景-m-对照: 双机-16-卡混合部署dp2-路由与场景-m-步宽对照
summary: >-
  开了 DP 以后，前端给每条新请求挑一个 DP 组：请求头写了组号就直接去（v0.30.0 与 main 仍计入本地 engine_inflight），否则按在途计数、队列条数与 KV 占用罚分（旧版为 waiting × 4 + running）取分数最小的组。讲清计数从哪来、为什么会过时、挑偏的四类代价、三种部署方式，以及双机 DP2 路由与步宽对照。
aliases:
  - DP 请求路由
  - DP routing
  - DP 路由器
  - DP 负载均衡
  - DP load balancing
  - 选 DP 组
  - 前端路由
  - waiting × 4 + running
  - 流式会话亲和
  - streaming_reqs
  - get_core_engine_for_request
  - X-data-parallel-rank
  - data_parallel_hybrid_lb
  - external LB
  - hybrid LB
  - internal LB
  - DPAsyncMPClient
  - DPLBAsyncMPClient
  - lb_engines
  - engine_inflight
chapters:
  - '13'
order: 35
sources:
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L1365-L1426'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L1314-L1357'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L108-L131'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L267-L270'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L397-L411'
  - 'vllm@0fc695fc:vllm/v1/engine/input_processor.py#L259-L267'
  - 'vllm@0fc695fc:vllm/v1/engine/coordinator.py#L22-L56'
  - 'vllm@0fc695fc:vllm/v1/engine/coordinator.py#L254-L278'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1856-L1888'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1233-L1262'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L913-L919'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1797-L1799'
  - 'vllm@0fc695fc:vllm/v1/pool/late_interaction.py#L15-L36'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L138-L150'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1818-L1899'
  - 'vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L71-L121'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L794-L799'
  - 'vllm@568afb3a:vllm/v1/engine/core_client.py#L1413-L1442'
  - 'vllm@98dff2a8:vllm/v1/engine/core_client.py#L1472-L1543'
  - 'vllm-ascend@2c59ff10:Dockerfile#L42-L42'
  - 'vllm-ascend@2ed6cbba:Dockerfile#L54-L54'
  - 'vllm-ascend@baa023ad:Dockerfile#L46-L46'
  - >-
    raw:sha256-850b15e05cc827d85bb154b23212d7f0fac2b240d834cf186185da0298198e4e.md#L1-L634
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/engine/core_client.py#L1398-L1425
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/pool/late_interaction.py#L22-L36
  - >-
    raw:sha256-a4ccb3d8c7f7604aa6a75574a211cd9f29b631c70177921e2cfa4563f9e48a3c.md#L1-L683
  - 'vllm@ced6857a:vllm/v1/engine/core_client.py#L1546-L1596'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1078-L1106'
  - 'vllm-ascend@7d825229:vllm_ascend/core/dyntra_lb_scheduler.py#L40-L51'
  - 'vllm@0fc695fc:vllm/v1/engine/coordinator.py#L145-L173'
  - 'vllm@ba15685a:vllm/v1/engine/core_client.py#L1811-L1873'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1086-L1095'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1260-L1270'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: data-parallel
    kind: builds-on
    note: DP 组是什么、各组各有 scheduler 与 KV 池、排队请求为什么要加重计分、请求派定不迁移
  - to: prefix-caching
    kind: builds-on
    note: 前缀缓存只在一组自己的池子里命中，派到别组要重算
  - to: large-scale-ep
    kind: builds-on
    note: 大规模 EP 下主节点内置单点路由易成瓶颈，需理解 hybrid 与 external 路由的演进动机
  - to: balance-scheduling
    kind: alternative-to
    note: DP 请求路由在入口按估计负载一次派定组别且终生不迁移；Balance Scheduling 则在派定后由各组每步互报 running 条数，顶满时共同暂停接纳 waiting 以防失衡滚雪球
contradicts: []
updated: '2026-11-24'
origin: gap
rawSources:
  - >-
    raw/sha256-9f7cd45d992b94fb7125f49cafe3777601bf80636f83f480111ed0d66d8a0a30.md
  - >-
    raw/sha256-a4ccb3d8c7f7604aa6a75574a211cd9f29b631c70177921e2cfa4563f9e48a3c.md
---

## 一条新请求进来，派给哪一个 DP 组？

**DP 请求路由，是开了 DP 以后前端给每条新请求挑一个 DP 组的那一步。对普通生成请求，vLLM 默认前端先看流式会话亲和（`main`）与请求头组号：写明了组号就直接派给那组；没写，就结合在途请求数、排队/在算条数与 KV 占用（旧版仅按排队与在算条数）打一个分，派给分数最小的那组。派定以后，这条请求一直留在那组。**

先对齐四个前置概念：

- **DP 组与模型形态**：[DP（data parallel，数据并行）](data-parallel.md)把请求分给多组卡并行处理。稠密模型（如 `Qwen3-8B`）每组存完整权重；[MoE](moe.md)（如 `Qwen3-30B-A3B`）若叠加跨组 EP，专家分摊在全部卡上，各组合起来才是一份完整模型（单独开 DP 不等于跨组切专家）。
- **EngineCore 与两个队列**：每组各有一个 EngineCore 与 scheduler，手握两条队列——**running**（正在算）与 **waiting**（已到达、尚未开算）。
- **前端（API server）**：负责接 HTTP、检查请求、套模板、分词与解析采样参数，再选定某组引擎投递（进程分布见[七站分在三种进程里](request-call-chain.md#七站分在三种进程里)，预处理见[API server 入口](api-server-entry.md)）。

看一个例子（数为示意）：两组 DP0、DP1，此刻 DP0 有 6 条请求在算，DP1 有 3 条，两组都没有排队的，当前只有一个前端进程。

- 请求 A 的请求头里写着组号 0。前端不做负载比较，直接派给 DP0。在 `v0.23.0 / v0.26.0rc` 上它完全不改前端本地计数；在 `v0.30.0` 与 `main` 上仍会把 DP0 的本地在途计数 `engine_inflight` 加 1。上游如果有自己的路由器，想把某些请求固定送到某一组，走的就是这条路。
- 请求 B 什么都没写。前端看自己手里的计数表，给两组各打一个分：在 `v0.23.0 / v0.26.0rc`（及历史双机快照）按 `waiting × 4 + running` 算，在 `v0.30.0` 与 `main` 按 $\max(N_{\text{api}} \times \text{inflight},\; \text{waiting} + \text{running}) + 6 \cdot \max(0,\; u_{\text{KV}} - 0.5) \cdot \text{waiting}$ 算。两组此刻 `waiting = 0`（若刚起步 `inflight` 也与 `running` 一致），DP0 得 6、DP1 得 3，B 派给分数小的 DP1。派出以后，前端先在本地给 DP1 的 `waiting` 补记「前端数量」条（单前端加 1 条，`v0.30.0 / main` 同时把 `engine_inflight` 加 1）以补偿统计更新间隔；这一步改的是本地选组估计，不表示请求已经进入目标引擎的真实 waiting 队列。

```wiki-diagram
file: dp-request-routing
```

上面生成文字的例子按请求头里有没有组号分成两条路：有组号的请求跳过负载打分与本地 `waiting` 补记（`v0.30.0` 与 `main` 仍计入本地在途计数 `engine_inflight`）；没有组号的普通生成请求才按计数表打分选组，选完再记一笔。查询与文档匹配评分的 late interaction 请求另有后文所述的固定键选组路径，不能把这两条路概括为所有请求的完整规则。它们最终都经进程间消息进入选定引擎的输入队列，再进该组的 waiting。

**派定以后不换组。** 请求的 KV cache（存放它已经算过的上下文）从那组的池子里分，它的每一步都由那组的 scheduler 安排；组与组之间没有搬请求的机制，所以这一次选择决定了这条请求从头到尾在哪组算。

## 为什么要挑，挑偏了代价在哪？

**DP 多出来的吞吐，来自几组同时各算各的请求；请求分得越匀，每组排队越少，各组手上的活也越接近。前端挑偏了，代价落在四处：排队、KV 池、MoE 的每步对齐，以及前缀缓存。**

如果不挑、所有请求都进 DP0，DP1 那组卡和它上面的权重就闲着，能同时服务的请求数退回一组的水平。在 MoE 模型里更糟：DP1 没有请求也得每一步陪着跑（原因见[MoE 模型里，两组为什么不能各跑各的](data-parallel.md#moe-模型里两组为什么不能各跑各的)），卡在转，却不产出。轮流派（第一条给 DP0、第二条给 DP1……）也不够：请求的长短差得很远，一组可能被几条长请求占住，轮到它时它并不空。所以默认前端要按各组当前负载打分：在 `v0.30.0` 与 `main` 中综合本前端在途请求数 `inflight`、`waiting + running` 队列条数，以及 KV 占用率超过 `50%` 后对 `waiting` 叠加的斜坡罚分（例如固定 `waiting = 1, running = 0, inflight = 0` 时，仅把该组 KV 占用率从 `50%` 升到 `100%`，得分就会从 `1` 变成 `4`）；在旧版 `v0.23.0 / v0.26.0rc` 中则只按 `waiting × 4 + running` 数队列条数（排队请求为什么要加重权重，见[请求怎样派进某一组](data-parallel.md#请求怎样派进某一组)）。

但无论旧版只数队列条数，还是 `v0.30.0 / main` 综合在途条数、队列条数与组级 KV 占用率斜坡罚分，前端打分都不知道每条新请求各自的提示词长度和还要生成多久；手里的快照又会过时（后面两节细讲），所以总有挑偏的时候。挑偏的代价有四种：

1. **排队。** 每组同时在算的请求有上限（见[请求数上限](vllm-scheduler.md#为什么按-token-设预算还要另设请求数上限)）。派进已满的那组，新请求只能在它的 waiting 里等；另一组空着位置也接不走它，第一个 token 出来得更晚。
2. **KV 池。** 每组有自己的一池 KV 块。长请求扎堆在一组，这组的块先用光，就要让最后进来的请求让位、以后重算（见[一组的请求共用一个池子](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)），而另一组的池子还空着。
3. **MoE 的每步对齐。** MoE 模型的各组每一步一起进出专家通信，这一步的宽度按最宽的那组对齐（见[再补到两组的最大值](concurrent-requests.md#再补到两组的最大值)）。负载堆在一组，每一步的宽度就被这组拉高，另一组也得按这个宽度陪着跑。宽度之外还有时长：宽度对齐了，各组这一步要读的历史（条数 × 各自的上下文长度）并不一样，谁最重，谁就定下这一步走多久，快的组在通信点上等它（见[快的组要在通信点上等慢的组](balance-scheduling.md#为什么需要它快的组要在通信点上等慢的组)）。
4. **前缀缓存。** [Prefix caching](prefix-caching.md)（前缀缓存：开头相同的请求直接复用已经算好的那几块 KV）只在一组自己的池子里查。开头相同的两条请求被派到两组，这段开头就要在两组各算一遍、各存一份。默认的打分只看请求条数与组级 KV 占用率（旧版只看队列条数），不看提示词开头是否相同。

用示意数看第 4 种。设一块装 16 个 token，前缀缓存只认写满的整块；两条请求 P、Q 开头都是同一段 2,048 个 token 的系统提示，后面各跟 100 个 token 的问题。P 先到，已经在 DP0 算完（另一组的池子里还要再存一份这 128 块）：

$$B_{\text{prefix}} = \frac{2{,}048}{16} = 128\text{ 块}, \qquad T_{\text{same}} = 2{,}148 - 128 \times 16 = 100\text{ 个 token}$$

| 派发去向（示意：共同前缀 2,048 token + 问题 100 token） | 算式 | Q 实际计算的 token 数 | 前缀缓存块变化 |
| --- | --- | --- | --- |
| Q 与 P 同组（DP0） | $2{,}148 - 128 \times 16$ | **100 个 token** | 复用 DP0 的 128 块 |
| Q 派到另一组（DP1） | $2{,}048 + 100$ | **2,148 个 token** | DP1 另存 128 块 |

同组时 Q 只算自己那 100 个 token；派到另一组，2,148 个 token 全要算，多出来的 2,048 个正是那段共同开头。这一代价只在开启 prefix caching 时出现；未开启时，共同前缀在任意组都会完整重算。

## 怎么挑：把一次选组一步步算出来

**前端每派一条普通生成请求，按固定顺序走完入口判断、逐组打分、本地记账与登记投递四步（`main` 最前面还会先查流式会话亲和 `streaming_reqs`，命中在途请求时直接复用原组）：**

1. **看请求头。** 前端从请求头 `X-data-parallel-rank` 里取组号。值能读成整数，就直接选中该组，跳过后面的逐组算分与 `waiting` 补记——但在 **`v0.30.0` 与 `main` 上仍会把该组的本地在途计数 `engine_inflight` 加 1**（仅旧版 `v0.23.0 / v0.26.0rc` 完全不记本地账）。读不成整数当作没写；是整数但不在 `0` 到「组数 − 1」之间，请求在入口就被拒掉（报错原文见[会报什么错](#会报什么错)）。
2. **逐组算分。** 从当前扫描起点依次往后比，只有分数**严格小于**当前最小值才换成它，平分时先比到的组胜出（`v0.23.0` 起点固定，单前端总从 DP0 比起；`v0.26.0rc` 起每次选组后把起点往后旋转一组）：
   - **`v0.30.0` 主基线与 `main`**：$\text{Score}(g) = \max(N_{\text{api}} \times \text{inflight}_g,\; \text{waiting}_g + \text{running}_g) + 6 \cdot \max(0,\; u_{\text{KV},g} - 0.5) \cdot \text{waiting}_g$。基础项用本前端在途数乘前端个数 $N_{\text{api}}$ 做下界兜底；KV 占用 $u_{\text{KV}} \le 50\%$ 时额外罚分为 `0`，$u_{\text{KV}} = 100\%$ 时每条 `waiting` 额外加 `3` 分（叠加基础项里的 `1` 倍正好恢复到 `4` 倍权重）。
   - **旧版 `v0.23.0 / v0.26.0rc`（及历史双机快照）**：$\text{Score}(g) = 4 \times \text{waiting}_g + \text{running}_g$，不统计 `engine_inflight` 与 KV 占用率。
3. **本地记一笔。** 给选中组的本地 `waiting` 加上前端个数 $N_{\text{api}}$（`v0.30.0 / main` 同时给 `engine_inflight` 加 `1`，并在请求结束时减 `1`）。这是前端计数表的本地估计，不代表目标引擎真实队列立即多了 $N_{\text{api}}$ 条；协调器推来新数时会覆盖 `waiting / running / u_KV`，但**不会清零 `engine_inflight`**。
4. **登记归属，发出去。** 前端记下请求去了哪组，以后取消时按这份记录找到那组；然后经 ZMQ（进程间消息库）把请求送进那组引擎的输入队列。要是此刻各组都停着，前端还顺带通知协调器，把各组一起叫醒（见[什么时候停，怎样再叫醒](data-parallel.md#什么时候停怎样再叫醒)）。

下面先用**旧版 `v0.23.0` 算例**把连续到达与显式指定漏账看清楚，再对照 `v0.30.0 / main` 如何补上这笔账。设刚收到的推送是 DP0 有 0 条 waiting、6 条 running，DP1 有 0 条 waiting、3 条 running；随后 100 ms 内依次来了 A、B、C、D 四条，只有 A 的请求头写了组号 0：

$$\text{Score}_{\text{legacy}}(g) = 4 \times \text{waiting}_g + \text{running}_g$$

| 到达请求（旧版 `v0.23.0` 示意，单前端 $N_{\text{api}} = 1$） | DP0 打分 | DP1 打分 | 派发去向 | 本地计数表更新 |
| --- | --- | --- | --- | --- |
| 请求 A（带头组号 `0`） | 跳过 | 跳过 | **DP0** | 不动（旧版漏记） |
| 请求 B | $0 \times 4 + 6 = 6$ | $0 \times 4 + 3 = \mathbf{3}$ | **DP1** | DP1 `waiting = 1` |
| 请求 C | $0 \times 4 + 6 = \mathbf{6}$ | $1 \times 4 + 3 = 7$ | **DP0** | DP0 `waiting = 1` |
| 请求 D | $1 \times 4 + 6 = 10$ | $1 \times 4 + 3 = \mathbf{7}$ | **DP1** | DP1 `waiting = 2` |

在旧版 `v0.23.0 / v0.26.0rc` 上，请求头指定组号的 A 不进本地账：C 算分时前端以为 DP0 的 `waiting` 仍是 `0`（得 `6` 分），没有计入刚派给 DP0 的 A。换成 **`v0.30.0` 与 `main`** 后，若此前那 6 条与 3 条请求都由同一前端发出（初始 `inflight` 分别为 `6` 和 `3`，$u_{\text{KV}} \le 50\%$），请求 A 虽跳过 `waiting` 补记，仍会把 DP0 的 `engine_inflight` 推到 `7`；轮到请求 B 选完 DP1（DP1 `inflight = 4`、`waiting = 1`）后，请求 C 看到的 DP0 基础项已是 $\max(7,\; 0 + 6) = 7$，与 DP1 的 $\max(4,\; 1 + 3) = 4$ 相比不再低估 A 的在途占位。新版仍按请求条数和组级 KV 占比估计，不替代组内调度器预算，详见文末[版本差异](#版本差异)。

```wiki-diagram
file: dp-request-routing-fig-score-sync
```

## 计数表从哪来，为什么会过时？

**计数表里的数由各组引擎报给 DP 协调器，协调器再推给前端，前端收到就把整张表换掉。引擎只在每一步的前后报数，协调器在数有变化时最快每 100 ms 推一次，所以前端看到的总是稍早一刻的样子；两次推送之间，只有前端自己记的那几笔在补。**

```wiki-diagram
file: dp-request-routing-flow
```

1. **引擎报数。** 每个 DP 组的 EngineCore 一圈一圈地转（见[一圈按什么顺序走](vllm-engine-core.md#一圈按什么顺序走一条示意请求转两圈)）：先把输入队列里新到的请求收进 waiting，报一次两个条数；算完这一步，再报一次。条数没变就不报。waiting 这个数还包括因为条件暂时不满足、被放在另一条等待队列里的请求。
2. **协调器推送。** DP 协调器是 node0 上汇总各组负载的小进程。普通统计更新的最小间隔默认 100 ms；它通过轮询超时触发推送，还会为收齐当前步统计至少等待 50 ms，因此不是满 100 ms 必定立即推送。各组的数一直没变时，使用 5 s 的重发间隔。
3. **前端换表。** 前端收到推送，把整张计数表换成推来的数，本地记的那几笔随之清掉，由引擎报上来的真实条数接替。
4. **请求进引擎。** 前端派出的请求先停在那组引擎的输入队列里。引擎正在算一步时不收新请求，要等这一步算完、下一圈开头才把它们收进 waiting，这时报出的数里才有它们。

所以前端手里的数，通常要落后「一步的时长，再加上 100 ms 量级」。一步很长（比如正在算一段几千个 token 的提示词）时，这一步里到达的请求都还在输入队列里，协调器也没有新数可推，前端只能靠自己记的账；有请求算完、腾出位置时，也要等这一步结束、下一次推送到了，前端才知道。这个盲区会让新请求排进已满的那组，另一组的空位闲着，见 [Balance Scheduling 的例子](balance-scheduling.md#为什么需要它快的组要在通信点上等慢的组)。

接上一节的旧版 `4W + R` 算例：A 到 D 到达时，两组正在算一步。这一步结束后，两组引擎把输入队列里的请求收进 waiting，DP1 这一步还有 2 条请求算完了；下一次推送到达时，设 A 到 D 还没开始算，这时又来一条请求 E（示意）：

$$\text{Score}_E(\text{DP0}) = 2 \times 4 + 6 = 14, \qquad \text{Score}_E(\text{DP1}) = 2 \times 4 + (3 - 2) = 9$$

| 组别（推送到达后） | 推来的 `(waiting, running)` | 请求 E 的打分算式 | 派发结果 |
| --- | --- | --- | --- |
| DP0 | $(2,\; 6)$ | $2 \times 4 + 6 = 14$ | 较重 |
| DP1 | $(2,\; 3 - 2) = (2,\; 1)$ | $2 \times 4 + 1 = \mathbf{9}$ | **9 更小，E 去 DP1** |

推送把两处偏差一起纠正了：DP0 的 waiting 从本地账上的 1 变成真实的 2，漏记的 A 回到了账上；DP1 刚算完的 2 条也反映出来，running 从 3 降到 1。反过来，推来的数也可能早于 A 到 D 进 waiting：协调器等各组报齐一步再推，有时推的是上一步汇总好的数；一步很长、各组都没报新数时，它还会每 5 s 把旧数重推一次。这时本地记的那几笔被清掉，这几条请求暂时从前端的账上消失，后面的请求会按偏低的数去比。

## 不走默认打分的几种情况

**默认打分管的是「前端看得到全部组」这一种部署。另有三种情况会绕开或改写它：池化模型的 late interaction 请求按键固定组；几个前端一起派时，每个前端各记各的账；部署成 hybrid 或 external 方式时，组与组之间交给 vLLM 之外的负载均衡器来分。**

**池化模型的 late interaction 请求。** 池化模型输出的是向量，不生成文字；late interaction 是其中一种打分方式：先把查询算成一组向量缓存起来，再拿去和一批文档逐个比。这份缓存放在那一组 worker 进程的本地内存里。因此在未显式指定 DP rank 时，`CACHE_QUERY` 或 `SCORE_DOC` 请求若带非空 `query_key`，前端会对键的 UTF-8 字节计算 CRC32 再对候选引擎数取余，固定派到同一组以复用查询缓存。这条规则先于队列负载比较，是默认前端里唯一一条「看缓存选组」的规则，普通生成文字的请求不走它。

**几个前端一起派。** 一台机器可以起几个 API server 进程，一起分担接 HTTP 和分词。每个前端都有自己的一张计数表，协调器的推送同时发给所有前端；两次推送之间，各前端看不到别人派了什么，所以每派一条，就给所选组记上「前端个数」条 waiting，按「别的前端大概也在这么派」来估。各前端比较的起点也错开：起点 = 组数 × 前端编号 ÷ 前端个数（向下取整）。比如 4 组、2 个前端时，前端 0 从 DP0 比起，前端 1 从 DP2 比起，各组都空时两个前端不会都先挑 DP0。不写前端个数时，默认方式会起「组数」个前端。

**三种部署方式。** 前面讲的都是 internal 方式。另两种把「组与组之间怎么分」交给外部：

| 方式 | 谁给请求挑组 | 怎样进入这种方式 |
|---|---|---|
| internal（默认） | 看得到全部组的前端，按分数挑 | 不写相关参数；其余机器用 headless 方式只起引擎 |
| hybrid | 每台机器的前端只在本机几组里按分数挑；机器之间由外部负载均衡器分 | 显式打开，或没用 headless 的机器写了非 0 的起始组号 |
| external | 每组一个前端，只管自己那组；组与组之间全由外部负载均衡器分 | 显式打开，或启动时写了本组组号；只支持 MoE 模型 |

external 方式下，引擎不再向协调器报条数，协调器只转发各组的启停状态；它还有一个变体，由一个监管进程给本机每组各起一个前端、各占一个端口。hybrid 方式下引擎照常报数，每个前端从推来的整张表里只取本机那几组。外部负载均衡器按什么规则分（看不看前缀、要不要同一会话落在同一组），由它自己决定，不在 vLLM 里，集群编排与前缀感知外部代理选型见[集群服务编排](cluster-serving.md#模式选型dp-外部拉起-vs-独立多实例代理)与[前缀感知路由](cluster-serving.md#kv-缓存与前缀感知路由别让轮询毁掉前缀命中率)。另外，推断成 hybrid 的机器上本机只有 1 组时，会自动改成 external 并打一条 warning（原文见[会报什么错](#会报什么错)）。

**派出去以后的补救。** 路由只在请求进门时决定一次，派偏以后 vLLM 不搬请求。vllm-ascend 另提供两种各组内部调节机制：[Balance Scheduling](balance-scheduling.md) 在某一组顶满时让所有组暂停接纳 waiting。另一种是 [DyntraLB](dyntra-lb.md)，在 `v0.30.0` 与 `main` 的 PD 分离 decode 端按各组 KV 块数暂停或接纳请求。两者都不改变请求派到哪组。

## 双机 16 卡混合部署：DP2 路由与场景 M 步宽对照

**历史双机部署采用 DP2（[部署前提](glm-5-3-flash-two-node.md#部署前提)）：node0 上只有一个前端，按 `v0.23.0` 规则给 DP0（node0）和 DP1（node1）打分派活。** 示例请求 R1 落到 DP0，场景 M 的新请求默认会去 DP1。两组每步按较宽的一组对齐，一条长提示词落在哪组，这一步两组的共同步宽只差 `20` 行、下一步同为 `64`；真正改变的是两组各自的上下文负担与组内配额占用，具体时延差距需实机测量。

- **一个前端，internal 方式。** node0 正常启动，起一个 API server（前端个数设成 1）、DP 协调器和 DP0 的引擎；node1 用 headless 方式只起 DP1 的引擎，连回 node0（见[启动时发生了什么](glm-5-3-flash-two-node.md#启动时发生了什么)）。两组都由 node0 这一个前端来挑：每派一条，本地记 1 条 waiting；比较的起点固定是 DP0。
- **打分规则是 v0.23 的。** 本部署镜像配的上游 vLLM 是 v0.23.0，分数就是 waiting × 4 + running；vllm-ascend 没有改选组这一步，Balance Scheduling 也没开。
- **前缀缓存关着。** GLM 同时有全注意力和线性注意力两类层，vLLM 默认判定这类模型不支持 prefix caching，教程也没打开它（见[GLM 双机上它开着吗](prefix-caching.md#glm-双机上它开着吗)）。所以前面说的第 4 种代价在本部署是零：开头相同的请求派到哪组，开头都要完整算一遍。
- **R1 落到 DP0。** R1 是主线的示例请求，提示词 4 个 token。它到来时两组都空，分数都是 0；DP0 先比，平分时先比到的胜出，所以 R1 进了 DP0（见[一条请求的第 1 站](one-request.md#第-1-站-入口从-http-到-node0-的引擎)）。
- **场景 M 的新请求默认去 DP1。** 场景 M 是主线的多请求示例：DP0 有 12 条请求在 decode（逐个生成新 token），DP1 有 7 条，此时来了一条提示词 6000 token 的新请求 N。场景设定它落在 DP0；但按 12 对 7 的分数，默认前端其实会把 N 派给 DP1，落到 DP0 只可能是请求头指定组号 0 或计数滞后（打分过程见[多条请求的第 1 站](concurrent-requests.md#第-1-站-入口新请求先挑一个-dp-组)）。

N 落在哪组，差别有多大？先交代三条对齐规则：

1. **decode 步宽**：每条请求一步占 4 个位置（上一步确定的 1 个 token，加上 MTP 草稿层草拟的 3 个候选）。
2. **图尺寸补齐**：纯 decode 的一步先补到最近的计算图档位（启动时按 4、8、16、32、64、96、128 录制），混着 prefill 的一步不用图、不补。
3. **跨组对齐**：两组最终按较宽的那组对齐一起跑（规则来历见[宽度先按自己补，再按对面补](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)）。

因此，这一步有一组混着 prefill，两组都不用图；下一步两组都是纯 decode，都补到 64 用图：

$$W_{\text{step}} = \max(W_{\text{DP0}},\; W_{\text{DP1}})$$

| 场景 M 新请求 N 的落点 | 这一步（混 prefill，两组均不用图） | 下一步（两组纯 decode，均补至 64 用图） |
| --- | --- | --- |
| N 落在 DP0 | $\max(12 \times 4 + 6000,\; 7 \times 4 \to 32) = \mathbf{6048\text{ token}}$ | $\max(13 \times 4 \to 64,\; 7 \times 4 \to 32) = \mathbf{64\text{ token}}$ |
| N 落在 DP1 | $\max(12 \times 4 \to 64,\; 7 \times 4 + 6000) = \mathbf{6028\text{ token}}$ | $\max(12 \times 4 \to 64,\; 8 \times 4 \to 32) = \mathbf{64\text{ token}}$ |

这一步共同步宽分别是 `6,048` 与 `6,028`（只差 `20` 行），下一步都是 `64`——从静态对齐规则只能推出步宽相等或接近，不能单凭步宽断言时延相同。两种落点的结构差异在三处：

- **后续每步的历史读取分布**：N 进 DP0 时两组在跑请求为 `13` 对 `7`，进 DP1 时为 `12` 对 `8`，N 所在组每步都要额外读取这段 `6,000` token 历史；单步实际相差多少毫秒取决于算子与通信重叠，留待实机测量。
- **组内配额**：每组最多同时算 `32` 条请求、每步最多 `8,192` token（见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)），KV 块也各自成池；先顶满的那组先排队或抢占，另一组的余量帮不上。
- **极端钉死**：若上游用请求头把请求全钉在 DP0，DP1 只剩每步陪跑（见[空闲的 DP 组为什么还要陪跑](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)）。

另一种生产取舍见 [DeepSeek 案例](deepseek-serving-case.md#分流看什么决定了哪些卡会一起等)：不同阶段按各自的工作量分流，共享缓存也会改变前缀亲和的必要性。

## 常见误解

- **「DP 路由和 MoE 的 router 是一回事。」** MoE 的 router 在每一层里给每个 token 挑专家，挑中的专家可能在另一组的卡上；DP 路由在请求进门时给整条请求挑一个组，只挑一次。一个管 token 在层内去哪算，一个管请求在哪组排队。
- **「前端会把请求派给前缀能命中的那组。」** 默认打分不检查提示词前缀：旧版只看 `waiting`、`running` 两个条数，`v0.30.0` 与 `main` 另加本前端在途条数和组级 KV 占用占比。要按前缀或会话分组，需在前端之前加外部路由器并用请求头指定组号，或改用 hybrid / external 方式。默认前端里唯一看缓存键的规则，只管池化模型的 late interaction 请求。
- **「请求头指定的组号也会记进计数表。」** 在 `v0.23.0 / v0.26.0rc`（及历史双机快照）上不会：显式指定跳过打分，也跳过本地 `waiting` 补记，要等引擎报上来、协调器推回来才看得到。自 **`v0.30.0` 主基线与 `main`** 起，前端新增本地在途计数 `engine_inflight`，即使请求头显式指定组号也会计入 `engine_inflight`（见前文选组四步与下节[版本差异](#版本差异)）。
- **「两组分数相同时随机挑。」** v0.23 是固定的：从起点那组开始比，严格更小才换，只有一个前端时平分总落在 DP0。v0.26 起每打一次分，起点往后挪一组，平分才轮流。
- **「前端手里的负载是实时的。」** 引擎只在每一步前后报数，协调器有变化时最快每 100 ms 推一次，前端手里的数通常落后一步的时长再加 100 ms 量级。
- **「派进去以后，忙的组会把请求交给闲的组。」** 请求派定后从头到尾在那一组，KV cache 也留在那组，没有迁移。
- **「把新请求派给闲的那组，这一步两组就能少算。」** 不能。两组加起来要算的量不变，共同步宽也按较宽的那组对齐：场景 M 的 N 派给 DP0 还是 DP1，这一步的步宽是 `6,048` 对 `6,028`，下一步都是 `64`。改变的是两组各自承担的请求与历史分布，实际单步耗时差需结合测量判断。

## 对照源码

### 怎么开

- **默认就有。** 数据并行组数大于 1、又没选 external 方式时，前端自动用带打分的引擎客户端（DPLBAsyncMPClient）；选了 external，就换成只连一组的客户端（DPAsyncMPClient）。选组函数是 `get_core_engine_for_request`。
- **指定组号。** 在 chat、completion 等 OpenAI 兼容接口的请求头里写 `X-data-parallel-rank: 1`，前端就不再打分。
- **前端个数。** `--api-server-count N`；internal 方式下不写时默认等于数据并行组数，external 与多端口方式默认 1，hybrid 默认等于本机组数。
- **hybrid。** `--data-parallel-hybrid-lb`（`-dph`），或者没用 `--headless` 的机器写了非 0 的 `--data-parallel-start-rank`，自动推断成 hybrid。
- **external。** `--data-parallel-external-lb`（`-dpe`），或者启动时写了 `--data-parallel-rank`（`-dpn`）；多端口变体是 `--data-parallel-multi-port-external-lb`。启动 rank 的默认、取值与组合约束统一见[进程页参数参考](engine-processes.md#怎么开)；它与指定单条请求去向的请求头分属两个入口。
- **GLM 双机。** node0 普通启动、`--api-server-count 1`；node1 带 `--headless` 和 `--data-parallel-start-rank 1`，所以整体是 internal 方式；这是按固定教程命令和选类条件推导的部署形态 [D]。

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
- 请求头指定组号适合上游路由器要做会话粘连、前缀亲和的场景；在 `v0.23.0 / v0.26.0rc` 上这类请求不进前端本地 `waiting` 账，混用时被指定组负载会被低估，而 `v0.30.0 / main` 已通过 `engine_inflight` 将显式选组的在途请求纳入基础负载兜底 [D]。
- hybrid / external 适合每组一个 pod 的大规模 EP 部署，或需要自带分配策略的外部路由器；external 只支持 MoE，且两种方式都不能和 elastic EP 同开。
- GLM 双机只有两组、一个前端，默认 internal 方式就够；选组的计算开销可以忽略，要留意的是计数滞后和请求头指定造成的偏斜。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）；**本文双机算例对应历史专用镜像 `db701c1f`（配套 `vllm@0fc695fc`）**。外部集群代理与前缀感知路由的完整编排对比见[集群服务编排](cluster-serving.md#模式选型dp-外部拉起-vs-独立多实例代理)。

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
|---|---|---|---|---|
| 内置 DP 打分公式 | $\text{waiting} \times 4 + \text{running}$ | 同 `v0.23.0` | $\max(N_{\text{api}} \times \text{inflight},\; \text{waiting} + \text{running}) + \text{waiting} \times 6 \times \max(0,\; u_{\text{KV}} - 0.5)$（`core_client.py#L1546-L1596`） | 同 `v0.30.0` 公式（`core_client.py#L1811-L1873`） |
| 平分决胜与流式会话亲和 | 扫描起点固定，单前端平分总落 DP0 | 每次打分后旋转扫描起点，平分轮流 | 旋转扫描起点；显式 `X-data-parallel-rank` 仍跳过打分但计入 `engine_inflight` | 旋转扫描起点；**新增 `streaming_reqs` 流式输入会话亲和**，命中 `reqs_in_flight` 直接复用原引擎（`#L1812-L1820`） |
| 外部/混合路由与 late interaction | 支持 internal / hybrid / external 及 late interaction 按键 CRC32 固定组 | 同 `v0.23.0` | 同 `v0.23.0` | 同 `v0.23.0` |
| Ascend 侧介入与组内调节 | 不修改上游选组；无 `DyntraLB` | 不修改上游选组 | 不修改上游选组；PD 解码侧可选 `dyntra_lb_config` 组内 KV 均衡（`platform.py#L1086-L1095`） | 不修改上游选组；延续 `dyntra_lb_config`（`platform.py#L1260-L1270`） |

`v0.30.0` 与 `main` 相比 `v0.23.0 / v0.26.0rc` 的核心改进有两处：一是 **在途条数兜底**（`engine_inflight` 只在本前端增减、不被协调器推送清零，显式指定组号的请求也会计入）；二是 **`waiting` 权重随 KV 占用动态变化**（KV 占用 $\le 50\%$ 时不罚分，到 $100\%$ 时每条 waiting 额外加 3 分，合起来恢复到 $4\times$）。`waiting / running` 仍是请求条数估计，不保证各组 token 工作量相等，也不替代组内 Scheduler 预算。

### 源码位置

| 做什么 | 位置 |
|---|---|
| 选组：请求头 → late interaction → 打分 → 本地记账 → 登记归属；前端个数与起点 | `vllm@0fc695fc:vllm/v1/engine/core_client.py#L1365-L1426` |
| 收推送、整张换表；发送请求、叫醒各组 | `vllm@0fc695fc:vllm/v1/engine/core_client.py#L1314-L1357` |
| 按部署方式选引擎客户端 | `vllm@0fc695fc:vllm/v1/engine/core_client.py#L108-L131` |
| 请求头取组号、组号范围检查 | `vllm/entrypoints/openai/engine/serving.py#L397-L411`、`vllm/v1/engine/input_processor.py#L259-L267` |
| 协调器的职责与推送节奏 | `vllm/v1/engine/coordinator.py#L22-L56`、`#L254-L278` |
| 引擎每步前后报数、只在 internal / hybrid 报 | `vllm/v1/engine/core.py#L1856-L1888`、`#L913-L919` |
| 一步中间到达的请求停在输入队列 | `vllm/v1/engine/core.py#L1233-L1262` |
| waiting 条数含被跳过的请求 | `vllm/v1/core/sched/scheduler.py#L1797-L1799` |
| late interaction 按键固定组 | `vllm/v1/pool/late_interaction.py#L15-L36` |
| 部署方式的参数、推断与默认前端个数 | `vllm/config/parallel.py#L138-L150`、`vllm/engine/arg_utils.py#L1818-L1899`、`vllm/entrypoints/cli/serve.py#L71-L121` |
| v0.26 / main 配套版本的选组 | `vllm@568afb3a:vllm/v1/engine/core_client.py#L1413-L1442`、`vllm@98dff2a8:vllm/v1/engine/core_client.py#L1472-L1543` |

**证据索引。** 选组四步、平分规则、前端个数与起点见 [C1]；换表与发送见 [C2]；部署方式与客户端见 [C3][C14][C15][C16]；请求头与越界见 [C4][C5][C6]；计数的报、推、口径与输入队列见 [C7][C8][C9][C10][C11][C12]；late interaction 见 [C13]；elastic EP 的限制见 [C17]；版本差异见 [C18][C19]，配套关系见 [C20][C21][C22]。「计数落后一步再加 100 ms 量级」和「推送的旧数会清掉本地账」是按源码时序推出来的 [D]，GLM 两种落点的宽度按底稿 01 的对齐规则推算 [D]；GLM 启动拓扑统一以[部署页](glm-5-3-flash-two-node.md)和[来源基线](../sources/glm-5-3-flash-baseline.md)为准。

**待核。**
- 计数滞后在实机上的量级（一步多长、推送实际间隔）：缺实测日志。
- vllm-ascend main 实际部署时可能配别的上游 commit（例如 2026-09-21 的 vLLM main 6b858751，这段逻辑与 v0.29.0 相同）：缺部署侧的版本钉点。
- 多前端时 late interaction 与在途计数的交互：本页未展开。

- 来源 24：vllm@0fc695fc，vllm/v1/engine/core_client.py，L1398–L1425。
- 来源 25：vllm@0fc695fc，vllm/v1/pool/late_interaction.py，L22–L36。

来源 24 的固定 vLLM `0fc695fc`、`core_client.py` L1398–L1425 先判断显式组号，再判断 late interaction 固定选组，最后才进入负载打分与 waiting 补记；该分支执行 `waiting += client_count`，结合 `waiting × 4 + running` 得到分数增量 4N。这是本地记账的代数结果，不是实际排队条数或性能测量。

统计最小推送间隔的默认 100 ms 由来源 30 的协调器构造参数给出；来源 8 的轮询分支还包含 50 ms 聚合等待，实际到达时间需要日志验证。
