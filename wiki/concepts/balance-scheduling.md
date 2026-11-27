---
id: balance-scheduling
title: Balance Scheduling：一组顶满，各组一起停收新请求
type: feature
legacyAnchors:
  放到-glm-双机本部署没开开了会怎样: 双机-dp2-场景推演gloo-互报闸门上限与步宽对齐边界
  复杂异构实战对照glm-双机部署下的表现与边界: 双机-dp2-场景推演gloo-互报闸门上限与步宽对齐边界
  异构双机-dp2-对照场景-m-闸门判定与宽度对齐边界: 双机-dp2-场景推演gloo-互报闸门上限与步宽对齐边界
summary: >-
  MoE 模型的多个 DP 组每步互报 running 条数，最满的一组顶到上限时所有组暂停接纳 waiting；讲清为什么需要、闸门与互报放在哪、只数条数的局限，以及双机 DP2 场景下的闸门与宽度对齐边界。
aliases:
  - Balance Scheduling
  - 均衡调度
  - DP 均衡调度
  - 共同闸门
  - 统一准入
  - running 条数同步
  - BalanceScheduler
  - enable_balance_scheduling
  - balance_gather
  - BalanceDPEngineCoreProc
  - VLLM_ASCEND_BALANCE_SCHEDULING
chapters:
  - '12'
order: 60
sources:
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L65-L88
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L289-L305
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L616-L658
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L34-L49
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L668-L675'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L661-L718
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L78-L94'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L562-L572'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L102-L106'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1152-L1162'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1713-L1718'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1945'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L688-L745
  - 'vllm-ascend@2c59ff10:vllm_ascend/envs.py#L103-L105'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L81-L101
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L882-L959
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L1003-L1039'
  - >-
    vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_balance_schedule.py#L84-L104
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_engine_core.py#L21-L46'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1446-L1456'
  - 'vllm-ascend@baa023ad:vllm_ascend/platform.py#L941-L995'
  - >-
    vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L26-L45
  - >-
    vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L176-L240
  - >-
    vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L328-L348
  - >-
    vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L484-L490
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L237-L353'
  - 'vllm-ascend@baa023ad:docs/source/tutorials/models/GLM5.3.md#L180-L210'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L17-L20
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L147-L150
  - >-
    raw:sha256-c8158192e740899aa15fdbe9c30781e389538032e62fd46b87784686beb0fab6.md#L1-L958
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_engine_core.py#L32-L42'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1078-L1088'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L590-L604'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L971-L985'
  - 'vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L319-L330'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L412-L423'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_balance_schedule.py#L397-L408'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_balance_schedule.py#L396-L407'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_balance_schedule.py#L392-L407'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_engine_core.py#L32-L44'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1036-L1097'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L731-L736'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_balance_schedule.py#L425-L438'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_engine_core.py#L31-L43'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1221-L1232'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: data-parallel
    kind: builds-on
    note: 各组怎样分请求、为什么每一步要同步推进、空闲组怎样陪跑
  - to: collective-communication
    kind: builds-on
    note: 各 DP 组每步末尾通过 CPU Gloo All-Gather 交换 running 条数，形成统一准入共识
  - to: dp-request-routing
    kind: builds-on
    note: 前端路由只数条数且计数滞后，留下某组率先顶满的缺口，Balance Scheduling 在组内准入侧补上这道共同闸门
  - to: dyntra-lb
    kind: alternative-to
    note: DyntraLB 用各组 KV 块数而不是请求条数估计负载，仅面向 PD 分离 D 节点，与本特性互斥二选一
  - to: recompute-scheduler
    kind: conflicts-with
    note: >-
      两种调度器的生效部署条件互斥：Balance Scheduling 只支持 PD 混部，RecomputeScheduler 只允许在 PD 分离的
      D 节点启用，不能同时生效。
  - to: profiling-chunk-config
    kind: conflicts-with
    note: >-
      固定 db701c1f 与 v0.30.0 中，Balance Scheduling 与动态切块配置不能同时启用；同开会在配置校验时报
      ValueError。具体配置入口及环境变量兜底仍按两页的版本条件核对。
contradicts: []
updated: '2026-11-26'
origin: gap
rawSources:
  - >-
    raw/sha256-c8158192e740899aa15fdbe9c30781e389538032e62fd46b87784686beb0fab6.md
  - >-
    raw/sha256-dd8e18dfcf5021b060243fde9d44f724d06569029c45be7972b6d538abb2dfa5.md
---

## Balance Scheduling 是什么？

**Balance Scheduling（均衡调度）是 vllm-ascend 给多 DP 组 MoE 部署加的一道共同闸门。** 每一步末尾，各组互报正在跑的请求条数；只要有一组顶到请求数上限，下一步所有组都暂停接纳排队请求，已在跑的请求照常往前算。它不搬请求，也不改变新请求派到哪一组。

先把几个词说清。[DP（data parallel，数据并行）](data-parallel.md)把请求分给几组卡，每组叫一个 DP 组，各有一个调度器（scheduler），每一步决定这组算哪些请求。稠密模型（如 `Qwen3-8B`）通常每组放完整权重；MoE 模型（如 `Qwen3-30B-A3B`）若开启跨组 EP，专家会分散在各组卡上，单个 DP 组并非完整模型副本。调度器手里有两个队列：**running** 放已经开始算的请求，**waiting** 放已到达、尚未开始算的请求。每组能同时跑的请求条数有上限，running 满了就不再从 waiting 往里放（见[请求数上限](vllm-scheduler.md#为什么按-token-设预算还要另设请求数上限)）。

看一个具体例子（数为示意）：两个 DP 组，每组最多同时跑 4 条。某一步结束时，DP0 正跑着 A、B、C、D 四条，已经满了，waiting 里还有 E、F；DP1 只跑着 G、H 两条，有两个空位，waiting 里有 I、J。

- **不开 Balance Scheduling**：DP1 下一步照常把 I、J 接进 running，填满空位；DP0 满了，E、F 继续等。
- **打开以后**：两组先交换条数，各自拿到同一张计数表 [4, 2]。表里最大的 4 等于上限，所以两组下一步**都**不接新请求，I、J 也要等。两组照旧一起走下一步，各算手上已有的请求；DP1 的两个空位空着，也不会去接 DP0 那边的 E、F。等 DP0 有请求算完、表里的最大值降到 3，闸门才抬起。

```wiki-diagram
file: balance-scheduling
```

## 为什么需要它：快的组要在通信点上等慢的组

**MoE 模型开了 DP 以后，各组每一步都要一起进出专家通信，这一步谁最重，谁就定下这一步的时长；Balance Scheduling 要防的，是负载已经不均时，其余组继续接新请求，把差距越拉越大。**

[MoE](moe.md)（mixture of experts，混合专家）开启跨组 EP 时，专家分散在所有组的卡上，任何一组算 MoE 层都要别的组同时到场；每一步前向之前，各组还要先对齐一次这一步的 token 数，通常按最宽的那组一起跑。所以各组不是各跑各的，而是一步一步同步推进（见[MoE 模型里，两组为什么不能各跑各的](data-parallel.md#moe-模型里两组为什么不能各跑各的)）。

另一方面，请求派进某组后终生不迁移，KV cache 也留在那组（见[请求怎样派进某一组](data-parallel.md#请求怎样派进某一组)）。一旦某组请求扎堆顶满 `running`，就会出现滚雪球失衡：

- 顶满组同一步混着 prefill 与 decode，单步越来越慢；
- 其余组还有空位继续接新请求，新请求一进来先做 prefill，经跨组步宽对齐（见[宽度先按自己补，再按对面补](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)）又把顶满组一起拖慢，导致顶满组手上请求迟迟排不空，差距越拉越大。

前端明明挑的是最空的组，为何还会一组先满？因为前端**只数条数**、不知道每条跑多久，且手里的计数是定期推来的：设两组上限各 `4`，前端先派成 `4 + 4`；DP1 的 4 条短输出几步算完腾空，DP0 的 4 条长生成仍占着坑。在协调器把新数推到前端前的窗口里，前端眼里两组仍一样满，新请求仍可能落进 DP0 排队，而 DP1 的空位却闲着。

前端怎样选组、计数从哪来、为什么会过时，见 [DP 请求路由](dp-request-routing.md)。

Balance Scheduling 的办法是：只要有一组顶满，所有组就暂时一起停收，让顶满那组有机会把手上的请求算完、腾出位置，差距不再扩大。闸门只在某一组顶满时才落，所以总并发离「组数 × 每组上限」（示意里是 2 × 4 = 8）还远时，它几乎不起作用；它针对的正是 DP 组多、总并发接近这个乘积的高负载部署。

代价在另一头：落闸的那几步里，其余组的空位空着，waiting 里的请求要多等，拿到第一个输出 token 更晚。它也不主动把各组的条数拉平。和它容易混的两种机制对照如下：

| 机制 | 决定什么 | 看什么 |
|---|---|---|
| 前端选组 | 新请求派进哪一组 | 各组 waiting 与 running 的条数 |
| Balance Scheduling | 这一步各组还接不接 waiting | 各组 running 条数里的最大值 |
| [DynTra](dyntra-lb.md) | 在 decode 端调整各组正在跑的请求 | 各组请求占用的 KV 块数 |

## 怎么做：每步互报条数，最满的一组顶到上限就一起停收

**每一步末尾，各组用一次 All-Gather 交换自己 running 的条数，人人拿到同一张计数表；下一步接纳 waiting 之前，先看表里最大的数是不是等于上限，等于就这一步不接。**

[All-Gather](collective-communication.md#all-gather) 是一种集合通信：每个成员贡献一份数据，结束后每个成员都拿到全部成员的数据。这里每组只贡献一个整数，所以各组手里的计数表完全一样，各自做出的判断也一样。不需要谁来下命令：每组按同一张表，各自得出同一个结论，这就是「统一准入」。

判断只有一句：表里的最大值等于上限就停。换一个四组的例子手算一遍（数为示意，上限缩成 8 是为了能手算，真实上限要大得多）：此刻四组 running 里分别有 8、3、5、2 条。

| 时刻与判定项（四组、每组上限 8，示意） | 算式 | 结果与闸门动作 |
| --- | --- | --- |
| 当前计数表最大值 | $\max(8,\, 3,\, 5,\, 2) = 8$ | 等于上限 8 → **四组都不接 waiting** |
| 其余三组空着的名额 | $(8 - 3) + (8 - 5) + (8 - 2)$ | **14 个名额**本步空着 |
| 下一步若第 0 组算完 1 条 | $\max(7,\, 3,\, 5,\, 2) = 7 < 8$ | 小于上限 → **闸门抬起，各组照常接纳** |

有两点要看清。第一，比的是**最大值**：只要有一组顶满就落闸，其余三组空位再多也一起停；不开时，那三组这一步会照常往 14 个空位里接请求。此刻四组合计 8 + 3 + 5 + 2 = 18 条在跑；闸门落着的时候，这个数只会随请求算完而减少，不会增加。第二，只有真顶满才落闸：最大值是 7 时，差一条也不落。running 的条数本来就不会超过上限，所以「等于上限」和「达到上限」是一回事。

闸门抬起以后，空位也不是一下子被填满：每组照常走自己原有的准入检查，这一步的 token 预算还剩多少、本组 running 满没满、KV cache 的块够不够（见[已有请求都在 decode 时的余量](vllm-scheduler.md#多条请求时已有请求都在-decode余量怎样给新提示词)）。Balance Scheduling 在这些检查之外多加一道，不替换它们。

接纳等待请求还要满足两项条件：调度器没有暂停，本轮没有发生抢占。抢占是暂时让正在运行的请求退出执行、留待后续恢复。因此，即使共同闸门放行且本组还有空位，下一条等待请求也未必能在这一步进入运行队列。

## 闸门插在哪一步，互报为什么不放进调度器

**闸门在调度器接纳 waiting 的循环里，紧跟在「本组 running 满没满」那道检查后面；互报挂在引擎主循环每一步都会经过的「全局还有没有活」那次判断之后，没有请求、只在陪跑的组也会走到。**

每个 DP 组有一个 EngineCore（管这组卡的引擎进程），它一步转一圈：收新请求、调度并执行一步、判断全局还有没有活。调度器在「调度」那一段里先给 running 里的请求排上这一步要算的 token，再用剩下的预算从 waiting 里一条条往外取，这就是主线第 2 站（见[第 2 站 调度](concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)）。每取一条之前，调度器原本就会问「本组 running 满了没有」，满了就停；Balance Scheduling 在后面再问一句「计数表里的最大值是不是等于上限」，是也停。所以它只拦 waiting，running 里的请求每一步照常推进。

计数表是上一步末尾交换来的，这一步调度期间不会更新：这一步里新到的请求只进 waiting，别的组这一步做了什么，要到这一步末尾才再交换一次。

**互报为什么不能放进调度器？** `All-Gather` 要求全体 DP 组到场，少一个就会永远卡死。但 MoE 开 DP 时，手上没请求的空闲组**根本不进调度器**——只要全局还有活，它直接拿假输入 `dummy batch` 陪跑（见[空闲的组由谁叫起来陪跑](data-parallel.md#空闲的组由谁叫起来陪跑陪跑时算什么)）。因此互报必须挂在“全局还有没有活”判断之后：无论真算还是陪跑，每组每圈必经此处（原判断每 32 步才真正跨组同步一次，而 Balance Scheduling 的 `All-Gather` 每步都做）。

```wiki-diagram
file: balance-scheduling-fig-gate-vs-width
```

**边界与例外：`v0.30.0` 与 `main` 的接线收口。**

- **条件式替换与互斥**：闸门语义不变，但引擎侧改为仅在开启开关时条件替换 `DPEngineCoreProc`；它与按 KV 块数调节的 `DyntraLB` 互斥，且后者优先。
- **配置入口收口**：原环境变量 `VLLM_ASCEND_BALANCE_SCHEDULING` 已删除，配置统一写在 `scheduler_config.enable_balance_scheduling`。
- **稠密模型兼容**：稠密模型配多 DP 组时不再启动断言崩溃，改为静默不生效（详见文末[版本差异](#版本差异)）。

## 什么时候它不起作用：单组、dense 模型与只数条数

**只有一个 DP 组时它什么也不做；模型不是 MoE 时它挂不上去；它只数请求条数，看不见每条请求有多重。**

- **只有一组。** 没有别的组可以互报，交换那一步不会执行，计数表一直是初值 0；上限至少是 1，0 永远够不着。开着它和不开，每一步接纳的请求一模一样。
- **dense 模型。** 稠密（dense，没有专家层）模型的各组之间本来不通信，vLLM 把每组当成独立的单组部署来建引擎进程，交换那一步挂不上去。在 v0.23 维护分支与历史 `db701c1f` 快照上，dense 模型多组部署再打开开关会在启动时报错；v0.26 起改为不报错也不生效（见页末「会报什么错」）。
- **只数条数。** 两组都跑 2 条请求，单步工作量仍可能相差很远：提示词长度、[prefix caching](prefix-caching.md) 命中比例、已积累上下文对应的 KV cache 读取量、MTP 草稿接受个数以及专家路由分布，都会改变单步耗时，而计数表里没有这些信息。若某组变慢来自长上下文请求，停收新请求不一定让它变快；[DynTra](dyntra-lb.md) 改用请求占用的 KV 块数估计负载，是另一套机制，不能与 Balance Scheduling 同开。

## 双机 DP2 场景推演：Gloo 互报、闸门上限与步宽对齐边界

**历史 GLM 双机配方默认未开启 `enable_balance_scheduling`（[部署前提](glm-5-3-flash-two-node.md#部署前提)，前缀缓存亦关闭，见[五组缓存页面](prefix-caching.md#glm-双机上它开着吗)），插件加载替换后的 `BalanceScheduler` 每步直接委托回上游原版调度（替换机制见 [patch 系统](ascend-patch-system.md)与[昇腾上跑的是哪个调度器](vllm-scheduler.md#昇腾上跑的是哪个调度器)）。** 假如在这套双机 DP2 混部上打开开关，两台机器各一个 DP 组、每组上限 `32` 条，闸门只在某一组 `running` 跑满 `32` 条时落下：

- **谁在互报。** 两个 DP 组各有一个 EngineCore，分别在 node0 与 node1。计数表只有 `2` 格，每一步做一次跨机 `All-Gather`，每组只交一个整数，走 CPU 上的 Gloo 集合通信通道。
- **上限与混部前提。** 闸门比较的上限就是每组的请求数上限 `32`（见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)）；GLM-5.3-Flash 是 MoE 且该配方采用 PD 混部，满足挂载与启用条件。
- **什么时候落闸。** 只有某一组 `running` 满 `32` 条时落下；那一刻另一组若有 $n$ 条在跑，就有 $32 - n$ 个名额这一步不接新请求。

拿主线的[场景 M](concurrent-requests.md#示例场景-m-与变体-m)对照：DP0 有 12 条 decode 请求，一条 6000 token 提示词的新请求 N 进了 DP0 的 waiting；DP1 有 7 条 decode 请求。判定如下：

$$\max(12,\, 7) = 12 < 32 \quad \Longrightarrow \quad \text{闸门不落}$$

最大值 12 离上限 32 还远，闸门不落，N 照常被 DP0 接纳，这一步和不开时完全一样。场景 M 里真正的浪费，是 DP1 的 28 个 token 先补到 32，再按对面补到 6048 宽、改走 eager（逐个下发算子，不回放录好的计算图）（见[宽度先按自己补，再按对面补](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)）。那是每一步宽度对齐的浪费，按 token 数算；Balance Scheduling 只数条数、只在顶满时起作用，管不到它。

这里沿用上面的本地准入条件；计数表中的 12 和 7 只说明共同闸门放行，N 能否进入运行队列还取决于这些条件是否满足。

反过来，闸门一旦落下，两组都不接新的提示词：接下来几步里，不会再有新来的 prefill 把两组一起拉宽、退回 eager；已经在分块做 prefill 的请求照常继续。这样省下的时间能不能抵过空着的名额，要看负载，这套部署还没有开启它的实测数据（见页末「待核」）。

## 常见误解

- **「Balance Scheduling 会把请求从忙的组挪到闲的组。」** 一条也不搬。新请求派进哪组由前端决定，派定后就留在那组，KV cache 也在那组；Balance Scheduling 只决定各组这一步接不接 waiting。
- **「它会让落后的组追上领先的组，把条数拉平。」** vllm-ascend main 分支的设计文档（balance schedule refactor）明确否掉了这种语义。曾有一种提法是把每组的上限临时改成当前最满那组的条数，那样落后的组还能一直接请求，追到和最满的组一样多；这被拒绝了。现在的规则只有一条：最满的组顶到上限就全体停收，没顶到就各组照常。
- **「关掉开关就等于没装。」** 调度器类在插件加载时就被换掉了，关着只是一上来就交回上游原版。v0.26 上 BalanceScheduler 的父类是 vllm-ascend 自己的另一个调度器，那一版关着时走的也不是纯上游（见页末「版本差异」）。
- **「闸门看的是此刻的实时条数。」** 看的是上一步末尾交换来的计数表。
- **「打开它就能省掉场景 M 那种宽度对齐浪费。」** 不能。那是宽度对齐按 token 数产生的浪费；闸门只看条数，只在顶满时落下。
- **「设一个环境变量就能开。」** `v0.23.0` 和 `v0.26.0rc` 可以，但已标注将淘汰；`v0.30.0` 与 `main` 上已经删掉，设了服务照常启动，闸门却不会打开。

## 对照源码

### 怎么开

- 开关名 `enable_balance_scheduling`，默认 `false`。`v0.23.0` 维护分支和本部署镜像 `db701c1f` 写在 `additional-config` 顶层：`--additional-config '{"enable_balance_scheduling": true}'`。`v0.26.0rc`、`v0.30.0` 和 `main` 推荐写在 `scheduler_config` 下：`'{"scheduler_config": {"enable_balance_scheduling": true}}'`；顶层写法仍认，但会打 deprecation 警告，两处都写时以 `scheduler_config` 为准。
- 环境变量 `VLLM_ASCEND_BALANCE_SCHEDULING=1`：`v0.23.0`、`db701c1f`、`v0.26.0rc` 认，源码注释标着将在后续版本删除；`v0.30.0` 与 `main` 已删除。`v0.23.0` 和 `db701c1f` 的补丁判断开关时依次看 `AscendConfig`、`additional-config`、环境变量；`AscendConfig` 自己也是先看 `additional-config`，没有才退到环境变量。
- 生效前提：`--data-parallel-size` 大于 1；模型是 MoE；PD 混部（不配 `kv_transfer_config`，或 `kv_role` 为 `kv_both`）。
- 闸门比的 `max_num_running_reqs` 就是 `--max-num-seqs`，调它会同时改变单组并发和全局落闸的触发点。GLM-5.3-Flash 双机教程取 32，没有写 `additional-config`。
- 显式指定了调度器类（`scheduler_cls`，如重算调度、动态批、分块性能采集用的那几种）的部署不经过 `BalanceScheduler`。
- 参照：所列开发主线 GLM-5.3（不是 Flash）的 DP8 多机教程片段在 `additional-config` 里打开了它。

### 会报什么错

- 与 `profiling_chunk_config` 同开：`ValueError: profiling_chunk_config and balance scheduling (enable_balance_scheduling) cannot be enabled at the same time. Please disable one of them.`（`v0.23.0`、`db701c1f`、`v0.26.0rc`、`v0.30.0` 均有；`main` 已移除 `profiling_chunk_config`）。
- PD 分离角色：配了 `kv_transfer_config` 且 `kv_role` 不是 `kv_both` 时报 `ValueError: enable_balance_scheduling only supports PD-mixed mode (kv_role='kv_both' or no kv_transfer_config), and is not supported in PD-disaggregated mode (kv_role='kv_producer'/'kv_consumer').`
- `v0.30.0` 与 `main` 上与 `DyntraLB` 同开：`ValueError: DyntraLB cannot be used with enable_balance_scheduling.`
- `v0.23.0` 与 `db701c1f`：dense 模型、DP 大于 1 再打开开关，启动时撞断言 `DPEngineCoreProc should only be used for MoE models`。补丁版入口函数只看 DP 大于 1 就建 `BalanceDPEngineCoreProc`，它的父类构造时断言模型是 MoE。`v0.26.0rc` 起（含 `v0.30.0` 与 `main`）改成开关打开时才把模块里的 `DPEngineCoreProc` 换成 `BalanceDPEngineCoreProc`，要不要建 DP 进程交回上游判断，dense 模型于是不报错也不生效。

### 开销和什么时候别开

- **空着的名额。** 落闸期间其余组的空位不接新请求（上文四组示意里是 14 个），新请求排队变长，拿到第一个 token 更晚。
- **每步一次 All-Gather。** 每组交一个 int32，走 DP 组的 CPU gloo 通道；GLM 双机上两个 EngineCore 分在两台机器，这次交换跨机。挂载点那次「全局还有没有活」的 All-Reduce 每 32 步才真做一次，但这个函数每个非空转的圈都会调用，挂在它后面的 All-Gather 仍是每步一次。
- **抄件漂移。** 为了在接纳循环里插进那两行，`BalanceScheduler` 的 `schedule()` 是上游 `schedule()` 的整段副本，设计文档记为约 520 行，四个版本上都还在；`v0.23.0` 和 `db701c1f` 还整段抄了引擎主循环 `run_busy_loop` 和入口 `run_engine_core`（`v0.23.0` 这份补丁共 745 行，绝大部分是上游原文），`v0.26.0rc` 起引擎侧只剩一个钩子。上游改了这些函数，副本不会跟着变，设计文档记录过旧副本已经和上游漂开。
- **怎样判断它有没有用。** 只看吞吐不够，要分别看新请求的排队时间、各组 running 条数、每步耗时和整体吞吐：闸门换来的是顶满那组更快排空，付出的是别的组空着名额。
- **别开的场景。** DP=1（不起作用）；dense 模型（`v0.23.0` 和 `db701c1f` 起不来，之后不生效）；PD 分离的 prefill 或 decode 实例（直接报错）；负载不均主要来自请求长短而不是条数时，它帮不上。

### 版本差异

闸门语义在四版本正式钉点上一致：读上一步末尾的计数表，最大值等于上限就停收；差异都在外围接线与互斥组合。在 `v0.30.0` 主基线与 `main` 中，只有 `AscendConfig` 的 `scheduler_config.enable_balance_scheduling` 显式开启时，才在 `patch_engine_core.py` 里把 `DPEngineCoreProc` 条件替换为 `BalanceDPEngineCoreProc`，且 `DyntraLB` 分支优先并与之互斥；默认 `Scheduler` 正常排批不等于开启均衡调度，历史文档里的环境变量也不能当成 `v0.30.0` / `main` 的有效入口。四版本钉点为 `v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）、`v0.30.0` 主基线（`c09d3e20`）与 `main`（`8d6180e2`）；本部署 GLM 固定镜像 `db701c1f` 与 `v0.23.0` 行为一致。

| 核对项 | `v0.23.0`（`2c59ff10` / `db701c1f`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
|---|---|---|---|---|
| 配置键 | 只认顶层 `enable_balance_scheduling` | 顶层或 `scheduler_config`，后者优先，顶层告警 | 同 `v0.26.0rc`（`ascend_config.py#L1629-L1669`） | 同 `v0.30.0`（`ascend_config.py#L1722-L1761`） |
| 环境变量 | 认 `VLLM_ASCEND_BALANCE_SCHEDULING`，标注将删 | 认，标注将删 | 已删除 | 已删除 |
| 引擎侧接线与准入闸门 | 整段抄 `run_busy_loop`、`run_engine_core`；dense+DP>1 启动断言失败 | 只覆盖 `_has_global_unfinished_reqs`，开关开时换类名；dense+DP>1 不报错不生效 | `patch_engine_core.py#L32-L44` 条件替换 `DPEngineCoreProc`（DyntraLB 优先）；准入闸门在 `patch_balance_schedule.py#L395-L403` | 同 `v0.30.0`（`patch_engine_core.py#L31-L43`；准入闸门在 `patch_balance_schedule.py#L432`） |
| `BalanceScheduler` 父类 | 上游 `Scheduler` | `KVDeliveryScheduler` | 上游 `Scheduler` | 上游 `Scheduler` |
| 互斥与部署限制 | PD 混部；与 `profiling_chunk_config` 互斥 | 同 `v0.23.0` | PD 混部（`platform.py#L1036-L1045`）；与 `profiling_chunk_config`（`ascend_config.py#L731-L736`）、`DyntraLB`（`platform.py#L1095-L1096`）互斥 | PD 混部（`platform.py#L1221-L1232`）；与 `DyntraLB` 互斥（`profiling_chunk_config` 已在 `main` 移除） |

靠环境变量打开它的部署升到 `v0.30.0` 或 `main` 会静默失效：服务照起，闸门不会打开。早期配置文档前后不一（开头的迁移表仍列着该环境变量对应 `scheduler_config.enable_balance_scheduling`，同一文件的参数表却写明它已不再支持），以代码为准。

### 源码位置

| 要核对什么 | 固定源码位置 |
|---|---|
| 上游接纳 waiting 的循环：先判本组满没满，再取队列 | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L562-L572` |
| 上限就是 `max_num_seqs` | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L102-L106` |
| 开关解析（本部署镜像） | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L34-L49`；`vllm_ascend/ascend_config.py#L78-L94` |
| 计数表每格初值 0、All-Gather 本组条数、没开就交回上游 | 同一补丁文件 `#L65-L88` |
| 闸门两行；原来的 assert 换成取不到队列就停 | 同一补丁文件 `#L289-L305` |
| 互报挂在「全局还有没有活」之后 | 同一补丁文件 `#L616-L658` |
| 补丁版入口：DP 大于 1 就建 `BalanceDPEngineCoreProc`；替换调度器类名 | 同一补丁文件 `#L661-L718` |
| 只支持 PD 混部 | `vllm-ascend@db701c1f:vllm_ascend/platform.py#L668-L675` |
| 上游只为 MoE 建 DP 进程；DP 进程断言 MoE | `vllm@0fc695fc:vllm/v1/engine/core.py#L1152-L1162`；`#L1713-L1718` |
| 主循环、陪跑、每 32 步的全局检查 | `vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1945` |
| v0.23 的入口与类名替换；环境变量标注将删 | `vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L688-L745`；`vllm_ascend/envs.py#L103-L105` |
| v0.26 的开关解析与父类、钩子与条件换名、配置键优先级 | `vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L81-L101`、`#L882-L959`；`vllm_ascend/ascend_config.py#L1003-L1039` |
| main 的开关解析、条件换名与 DyntraLB 二选一、环境变量已删、互斥检查 | `vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_balance_schedule.py#L84-L104`；`vllm_ascend/patch/platform/patch_engine_core.py#L21-L46`；`vllm_ascend/ascend_config.py#L1446-L1456`；`vllm_ascend/platform.py#L941-L995` |
| 设计意图、拒绝「追平」、互报为什么不放进调度器、另指定调度器类时绕开 | `vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L26-L45`、`#L176-L240`、`#L328-L348`、`#L484-L490` |

**证据索引。** 闸门的判断位置与上游接纳循环见 [C2][C8]，上限就是请求数上限见 [C9]；计数表初值、每步 All-Gather 与关着时交回上游见 [C1]，互报的挂载点与每 32 步的全局检查见 [C3][C12]；入口选择与类名替换见 [C6][C13]；开关解析与默认值见 [C4][C7][C15][C17][C18]，环境变量的去留见 [C14][C20]；只支持混部与 DyntraLB 互斥见 [C5][C21]；只有 MoE 建 DP 进程、DP 进程断言 MoE 见 [C10][C11]；v0.26 与 main 的钩子和条件换名见 [C16][C19]。设计意图、否掉「追平」、`==` 与 `>=` 等价、互报不放进调度器的原因见 [S22][S24][S23]，另指定调度器类时绕开见 [S25]；本部署教程未开启、上限 32 见 [S26]，main 的 GLM-5.3 教程开启见 [S27]，main 配置文档前后不一见 [S28][S29]。

以下几条是由上述源码推出的：单组时计数表保持 0、永不落闸；GLM 双机上每步一次跨机的 gloo 交换；场景 M 下最大值 12 小于 32、闸门不落；落闸期间不会有新来的 prefill 拉宽步长 [D]。

**待核：**

- 本部署打开它以后的实测：多久落一次闸、空着的名额和步长缩短哪个影响大，缺实机数据。
- 跨机 gloo All-Gather 一次的耗时，缺实测。
- 开了 async scheduling 时，引擎实例化的 AsyncScheduler 的父类是否已经是替换后的 BalanceScheduler：按导入顺序推断是，尚未实跑确认，和 [vLLM 调度器](vllm-scheduler.md#昇腾上跑的是哪个调度器)页是同一条待核。

固定 db701c1f 的共同闸门只是准入检查之一：调度暂停、本轮发生抢占或本地名额不足时，仍不能接纳等待请求。这些条件不表示本页 GLM 双机配方已启用均衡调度，其他分支按版本表判断。等待队列循环见来源 2。

CPU DP 通信组明确使用 gloo（来源 33）；`v0.26.0rc` 的环境变量值由配置构造传入通用回退函数（来源 34）。`v0.23.0`、`v0.26.0rc`、`v0.30.0`（及历史 `baa023ad` / `7d825229` 快照）与 `main` 的实际准入分支见来源 35–39、43，均比较上一轮计数的最大值与本组上限是否相等。
