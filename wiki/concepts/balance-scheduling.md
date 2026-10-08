---
id: balance-scheduling
title: Balance Scheduling：一组顶满，各组一起停收新请求
type: feature
summary: MoE 模型的多个 DP 组每步互报 running 条数，最满的一组顶到上限时所有组暂停接纳 waiting；讲清为什么需要、闸门与互报放在哪、只数条数的局限，以及 GLM 双机未启用时的对照。
aliases: ["Balance Scheduling","均衡调度","BalanceScheduler","enable_balance_scheduling","balance_gather","BalanceDPEngineCoreProc","VLLM_ASCEND_BALANCE_SCHEDULING"]
chapters: ["12"]
order: 60
sources:
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L65-L88
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L289-L305
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L616-L658
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L34-L49
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L668-L675
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L661-L718
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L78-L94
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L562-L572
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L102-L106
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1152-L1162
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1713-L1718
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1945
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L688-L745
  - vllm-ascend@2c59ff10:vllm_ascend/envs.py#L103-L105
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L81-L101
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L882-L959
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L1003-L1039
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_balance_schedule.py#L84-L104
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_engine_core.py#L21-L46
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1446-L1456
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L941-L995
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L26-L45
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L176-L240
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L328-L348
  - vllm-ascend@baa023ad:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L484-L490
  - vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L237-L353
  - vllm-ascend@baa023ad:docs/source/tutorials/models/GLM5.3.md#L180-L210
  - vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L17-L20
  - vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L147-L150
verified: []
evidence: "C"
relations:
  - {to: data-parallel, kind: builds-on, note: 各组怎样分请求、为什么每一步要同步推进、空闲组怎样陪跑}
  - {to: vllm-scheduler, kind: builds-on, note: running 与 waiting、请求数上限，以及接纳 waiting 时原有的几道检查}
  - {to: concurrent-requests, kind: builds-on, note: 场景 M 的宽度对齐浪费，用来对照闸门管得到什么、管不到什么}
  - {to: dyntra-lb, kind: alternative-to, note: 用 KV 块数而不是请求条数估计负载，main 上与本特性二选一}
contradicts: []
updated: "2026-09-29"
origin: direct
---

## Balance Scheduling 是什么？

**Balance Scheduling（均衡调度）是 vllm-ascend 给「MoE 模型开了多个 DP 组」这种部署加的一道共同闸门：每一步末尾，各组互报自己正在跑几条请求；只要有一组已经顶到请求数上限，下一步所有组都暂停接纳排队中的请求，已经在跑的请求照常往前算。它不搬请求，也不改变新请求派到哪一组。**

先把几个词说清。[DP（data parallel，数据并行）](data-parallel.md)把模型复制成几组卡，每组叫一个 DP 组，各有一个调度器（scheduler），每一步决定这组算哪些请求。调度器手里有两个队列：**running** 放已经开始算的请求，**waiting** 放已经到了、还没开始算的请求。每组能同时跑的请求条数有上限，running 满了就不再从 waiting 往里放（见[请求数上限](vllm-scheduler.md#为什么按-token-设预算还要另设请求数上限)）。

看一个具体例子（数为示意）：两个 DP 组，每组最多同时跑 4 条。某一步结束时，DP0 正跑着 A、B、C、D 四条，已经满了，waiting 里还有 E、F；DP1 只跑着 G、H 两条，有两个空位，waiting 里有 I、J。

- **不开 Balance Scheduling**：DP1 下一步照常把 I、J 接进 running，填满空位；DP0 满了，E、F 继续等。
- **打开以后**：两组先交换条数，各自拿到同一张计数表 [4, 2]。表里最大的 4 等于上限，所以两组下一步**都**不接新请求，I、J 也要等。两组照旧一起走下一步，各算手上已有的请求；DP1 的两个空位空着，也不会去接 DP0 那边的 E、F。等 DP0 有请求算完、表里的最大值降到 3，闸门才抬起。

```wiki-diagram
file: balance-scheduling
```

## 为什么需要它：快的组要在通信点上等慢的组

**MoE 模型开了 DP 以后，各组每一步都要一起进出专家通信，这一步谁最重，谁就定下这一步的时长；Balance Scheduling 要防的，是负载已经不均时，其余组继续接新请求，把差距越拉越大。**

[MoE](moe.md)（mixture of experts，混合专家）模型的专家只放一份，摊在所有组的卡上，任何一组算 MoE 层，都要别的组同时到场；每一步前向之前，各组还要先对齐一次这一步的 token 数，通常按最宽的那组一起跑。所以各组不是各跑各的，而是一步一步同步推进（见[MoE 模型里，两组为什么不能各跑各的](data-parallel.md#moe-模型里两组为什么不能各跑各的)）。

另一方面，请求一旦派进某一组，就一直留在那组，它的 KV cache（存放这条请求已经算过的上下文）也在那组（见[请求怎样派进某一组](data-parallel.md#请求怎样派进某一组)）。于是负载会不均：请求扎堆在某一组，那组的 running 顶满，同一步里既有请求在处理提示词（prefill），又有请求在逐个生成 token（decode），越来越慢；其余组还有空位，照样接新请求。新请求一进来先做 prefill，而这一步的宽度要按最宽的那组对齐（见[宽度先按自己补，再按对面补](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)），顶满那组也跟着慢下来，手上的请求迟迟算不完，差距继续拉大。

前端派请求时明明挑的是最空的组，为什么还会有一组先满？因为它只数条数，不知道每条请求要跑多久；它手里的计数又是定期推来的，两次推送之间可能已经过时。看一个示意：两组上限各 4，前端先把 8 条请求派成 4 + 4。DP1 那 4 条输出很短，几步就算完、腾空了；DP0 那 4 条要生成上千个 token，一直占着位置。DP1 腾空之后、新的计数推到前端之前，前端看到的两组还是一样满，接着到的一条请求仍可能被派进 DP0，只能在 DP0 的 waiting 里排队，而 DP1 的空位正闲着。请求派定后不迁移，这几条就一直等 DP0 腾位置。

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

```calc
title: 一组顶满时，其余三组空着多少名额（示意）
表里的最大值 = max(8, 3, 5, 2) = 8 条，等于上限 8，四组这一步都不接 waiting
其余三组的空位 = (8 − 3) + (8 − 5) + (8 − 2) = 14 个，这一步空着
下一步若第 0 组算完 1 条 = max(7, 3, 5, 2) = 7 条，小于上限，各组照常接纳
```

有两点要看清。第一，比的是**最大值**：只要有一组顶满就落闸，其余三组空位再多也一起停；不开时，那三组这一步会照常往 14 个空位里接请求。此刻四组合计 8 + 3 + 5 + 2 = 18 条在跑；闸门落着的时候，这个数只会随请求算完而减少，不会增加。第二，只有真顶满才落闸：最大值是 7 时，差一条也不落。running 的条数本来就不会超过上限，所以「等于上限」和「达到上限」是一回事。

闸门抬起以后，空位也不是一下子被填满：每组照常走自己原有的准入检查，这一步的 token 预算还剩多少、本组 running 满没满、KV cache 的块够不够（见[预算先给 decode，余量给提示词](vllm-scheduler.md#多条请求时预算先给-decode余量给提示词)）。Balance Scheduling 在这些检查之外多加一道，不替换它们。

## 闸门插在哪一步，互报为什么不放进调度器

**闸门在调度器接纳 waiting 的循环里，紧跟在「本组 running 满没满」那道检查后面；互报挂在引擎主循环每一步都会经过的「全局还有没有活」那次判断之后，没有请求、只在陪跑的组也会走到。**

每个 DP 组有一个 EngineCore（管这组卡的引擎进程），它一步转一圈：收新请求、调度并执行一步、判断全局还有没有活。调度器在「调度」那一段里先给 running 里的请求排上这一步要算的 token，再用剩下的预算从 waiting 里一条条往外取，这就是主线第 2 站（见[第 2 站 调度](concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求)）。每取一条之前，调度器原本就会问「本组 running 满了没有」，满了就停；Balance Scheduling 在后面再问一句「计数表里的最大值是不是等于上限」，是也停。所以它只拦 waiting，running 里的请求每一步照常推进。

```wiki-diagram
file: balance-scheduling-flow
```

计数表是上一步末尾交换来的，这一步调度期间不会更新：这一步里新到的请求只进 waiting，别的组这一步做了什么，要到这一步末尾才再交换一次。

互报为什么不放进调度器？All-Gather 要求所有组都参加，缺一个，其余的就一直等下去。可是 MoE 模型开 DP 时，手上没有请求的那组**不进调度器**：只要全局还有活，它就用一份假输入陪别的组跑一步，叫 dummy batch（见[空闲的组由谁叫起来陪跑](data-parallel.md#空闲的组由谁叫起来陪跑陪跑时算什么)）。交换要是放在调度器里，忙的组会等一个永远不来的参与者，整个服务卡住。所以交换挂在「全局还有没有活」那次判断之后：不管这一步是真算还是陪跑，每组每一圈都经过这里。那次判断本身每 32 步才真正跨组同步一次，但 Balance Scheduling 的交换每一步都做。

## 什么时候它不起作用：单组、dense 模型与只数条数

**只有一个 DP 组时它什么也不做；模型不是 MoE 时它挂不上去；它只数请求条数，看不见每条请求有多重。**

- **只有一组。** 没有别的组可以互报，交换那一步不会执行，计数表一直是初值 0；上限至少是 1，0 永远够不着。开着它和不开，每一步接纳的请求一模一样。
- **dense 模型。** 稠密（dense，没有专家层）模型的各组之间本来不通信，vLLM 把每组当成独立的单组部署来建引擎进程，交换那一步挂不上去。在 v0.23 维护分支和本部署的镜像上，dense 模型多组部署再打开开关，启动时就报错；v0.26 起改成不报错也不生效（见页末「会报什么错」）。
- **只数条数。** 两组都跑 2 条请求，一步的工作量可以差很远：提示词多长、前缀缓存命中了多少（命中的开头不用再算；本部署默认关着，见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)）、已经积累了多长的上下文（每步要读多少 KV cache）、MTP（每步先草拟几个候选 token、下一步一起验证的多 token 预测）草稿被接受了几个、token 被路由到哪些专家，都会改变一步的耗时，计数表里没有这些信息。如果某组慢是因为有一条上下文极长的请求，停收新请求不一定让它快起来。[DynTra](dyntra-lb.md) 改用请求占用的 KV 块数估计负载，是另一套机制，不能和 Balance Scheduling 同时打开。

## 放到 GLM 双机：本部署没开，开了会怎样

**官方 GLM 双机教程没有打开 Balance Scheduling，本部署每一步的调度就是上游原版的规则；假如打开，两台机器各一个 DP 组、每组上限 32 条，闸门只在某一组 running 跑满 32 条时落下，主线场景 M 里它不会落。**

先说「没开」怎么确认。开关默认关闭，要在启动参数的 additional-config 里写，或者设一个已标注将要淘汰的环境变量；[双机部署](glm-5-3-flash-two-node.md#部署前提)的两条启动命令都没有写 additional-config，也没有设这个环境变量。

没开也不等于没装。vllm-ascend 一加载，就把上游的调度器类换成 BalanceScheduler，把引擎进程的入口函数换成自己的版本（这种加载即替换的做法见 [patch 系统](ascend-patch-system.md)）。开关关着时，BalanceScheduler 每一步第一件事就是交回上游原版的调度，入口函数也直接转给上游原函数，所以行为和上游一致（见[昇腾上跑的是哪个调度器](vllm-scheduler.md#昇腾上跑的是哪个调度器)）。

假如打开，放到这套部署上：

- **谁在互报。** 两个 DP 组各有一个 EngineCore，一个在 node0、一个在 node1。计数表只有 2 格，每一步一次 All-Gather，只传两个整数，走 CPU 上的 gloo 通道（PyTorch 里在 CPU 上做集合通信的后端），跨两台机器。
- **上限是多少。** 闸门比的上限就是每组的请求数上限 32（见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)）。
- **前提都满足。** GLM-5.3-Flash 是 MoE，两组走的正是能挂上互报的那种引擎进程；这套部署没有配 KV 传输，prefill 和 decode 在同一个实例里做（PD 混部），满足它只支持混部的要求。
- **什么时候落闸。** 只有某一组 running 满 32 条时。那一刻另一组若有 n 条在跑，就有 32 − n 个名额这一步不接新请求。

拿主线的[场景 M](concurrent-requests.md#示例场景-m-与变体-m)对照：DP0 有 12 条 decode 请求，一条 6000 token 提示词的新请求 N 进了 DP0 的 waiting；DP1 有 7 条 decode 请求。

```calc
title: 场景 M 下闸门会不会落
计数表里的最大值 = max(12, 7) = 12 条 < 32 条
```

最大值 12 离上限 32 还远，闸门不落，N 照常被 DP0 接纳，这一步和不开时完全一样。场景 M 里真正的浪费，是 DP1 的 28 个 token 先补到 32，再按对面补到 6048 宽、改走 eager（逐个下发算子，不回放录好的计算图）（见[宽度先按自己补，再按对面补](concurrent-requests.md#进入第-4-站之前宽度先按自己补再按对面补)）。那是每一步宽度对齐的浪费，按 token 数算；Balance Scheduling 只数条数、只在顶满时起作用，管不到它。

反过来，闸门一旦落下，两组都不接新的提示词：接下来几步里，不会再有新来的 prefill 把两组一起拉宽、退回 eager；已经在分块做 prefill 的请求照常继续。这样省下的时间能不能抵过空着的名额，要看负载，这套部署还没有开启它的实测数据（见页末「待核」）。

## 常见误解

- **「Balance Scheduling 会把请求从忙的组挪到闲的组。」** 一条也不搬。新请求派进哪组由前端决定，派定后就留在那组，KV cache 也在那组；Balance Scheduling 只决定各组这一步接不接 waiting。
- **「它会让落后的组追上领先的组，把条数拉平。」** vllm-ascend main 分支的设计文档（balance schedule refactor）明确否掉了这种语义。曾有一种提法是把每组的上限临时改成当前最满那组的条数，那样落后的组还能一直接请求，追到和最满的组一样多；这被拒绝了。现在的规则只有一条：最满的组顶到上限就全体停收，没顶到就各组照常。
- **「关掉开关就等于没装。」** 调度器类在插件加载时就被换掉了，关着只是一上来就交回上游原版。v0.26 上 BalanceScheduler 的父类是 vllm-ascend 自己的另一个调度器，那一版关着时走的也不是纯上游（见页末「版本差异」）。
- **「闸门看的是此刻的实时条数。」** 看的是上一步末尾交换来的计数表。
- **「打开它就能省掉场景 M 那种宽度对齐浪费。」** 不能。那是宽度对齐按 token 数产生的浪费；闸门只看条数，只在顶满时落下。
- **「设一个环境变量就能开。」** v0.23 和 v0.26 可以，但已标注将淘汰；main 上已经删掉，设了服务照常启动，闸门却不会打开。

## 对照源码

### 怎么开

- 开关名 `enable_balance_scheduling`，默认 `false`。v0.23 维护分支和本部署镜像 db701c1f 写在 additional-config 顶层：`--additional-config '{"enable_balance_scheduling": true}'`。v0.26 和 main 推荐写在 `scheduler_config` 下：`'{"scheduler_config": {"enable_balance_scheduling": true}}'`；顶层写法仍认，但会打 deprecation 警告，两处都写时以 `scheduler_config` 为准。
- 环境变量 `VLLM_ASCEND_BALANCE_SCHEDULING=1`：v0.23、db701c1f、v0.26 认，源码注释标着将在后续版本删除；main 已删除。v0.23 和 db701c1f 的补丁判断开关时依次看 AscendConfig、additional-config、环境变量；AscendConfig 自己也是先看 additional-config，没有才退到环境变量。
- 生效前提：`--data-parallel-size` 大于 1；模型是 MoE；PD 混部（不配 `kv_transfer_config`，或 `kv_role` 为 `kv_both`）。
- 闸门比的 `max_num_running_reqs` 就是 `--max-num-seqs`，调它会同时改变单组并发和全局落闸的触发点。GLM-5.3-Flash 双机教程取 32，没有写 additional-config。
- 显式指定了调度器类（`scheduler_cls`，如重算调度、动态批、分块性能采集用的那几种）的部署不经过 BalanceScheduler。
- 参照：main 分支 GLM-5.3（不是 Flash）的多机教程在 additional-config 里打开了它，DP8、DP4 几套配置都开。

### 会报什么错

- 与 `profiling_chunk_config` 同开：`ValueError: profiling_chunk_config and balance scheduling (enable_balance_scheduling) cannot be enabled at the same time. Please disable one of them.`，三个分支和 db701c1f 都有。
- PD 分离角色：配了 `kv_transfer_config` 且 `kv_role` 不是 `kv_both` 时报 `ValueError: enable_balance_scheduling only supports PD-mixed mode (kv_role='kv_both' or no kv_transfer_config), and is not supported in PD-disaggregated mode (kv_role='kv_producer'/'kv_consumer').`
- main 上与 DyntraLB 同开：`ValueError: DyntraLB cannot be used with enable_balance_scheduling.`
- v0.23 与 db701c1f：dense 模型、DP 大于 1 再打开开关，启动时撞断言 `DPEngineCoreProc should only be used for MoE models`。补丁版入口函数只看 DP 大于 1 就建 `BalanceDPEngineCoreProc`，它的父类构造时断言模型是 MoE。v0.26 起改成开关打开时才把模块里的 `DPEngineCoreProc` 换成 `BalanceDPEngineCoreProc`，要不要建 DP 进程交回上游判断，dense 模型于是不报错也不生效。

### 开销和什么时候别开

- **空着的名额。** 落闸期间其余组的空位不接新请求（上文四组示意里是 14 个），新请求排队变长，拿到第一个 token 更晚。
- **每步一次 All-Gather。** 每组交一个 int32，走 DP 组的 CPU gloo 通道；GLM 双机上两个 EngineCore 分在两台机器，这次交换跨机。挂载点那次「全局还有没有活」的 All-Reduce 每 32 步才真做一次，但这个函数每个非空转的圈都会调用，挂在它后面的 All-Gather 仍是每步一次。
- **抄件漂移。** 为了在接纳循环里插进那两行，BalanceScheduler 的 `schedule()` 是上游 `schedule()` 的整段副本，设计文档记为约 520 行，三个分支上都还在；v0.23 和 db701c1f 还整段抄了引擎主循环 `run_busy_loop` 和入口 `run_engine_core`（v0.23 这份补丁共 745 行，绝大部分是上游原文），v0.26 起引擎侧只剩一个钩子。上游改了这些函数，副本不会跟着变，设计文档记录过旧副本已经和上游漂开。
- **怎样判断它有没有用。** 只看吞吐不够，要分别看新请求的排队时间、各组 running 条数、每步耗时和整体吞吐：闸门换来的是顶满那组更快排空，付出的是别的组空着名额。
- **别开的场景。** DP=1（不起作用）；dense 模型（v0.23 和 db701c1f 起不来，之后不生效）；PD 分离的 prefill 或 decode 实例（直接报错）；负载不均主要来自请求长短而不是条数时，它帮不上。

### 版本差异

闸门语义在四个快照上一致：读上一步末尾的计数表，最大值等于上限就停收。差异都在外围。v0.23 列是维护分支 2c59ff10，db701c1f 是本部署镜像（另一个 orphan commit），v0.26 列是 2ed6cbba，main 列是 baa023ad。

| 项目 | v0.23 | db701c1f | v0.26 | main |
|---|---|---|---|---|
| 配置键 | 只认顶层 | 只认顶层 | 顶层或 `scheduler_config`，后者优先，顶层告警 | 同 v0.26 |
| 环境变量 | 认，标注将删 | 认，标注将删 | 认，标注将删 | 已删除 |
| 引擎侧 | 整段抄 `run_busy_loop`、`run_engine_core` | 同 v0.23 | 只覆盖 `_has_global_unfinished_reqs`，开关开时才换类名 | 同 v0.26，换名挪进 `patch_engine_core.py` |
| dense 模型 + DP>1 + 开关 | 启动断言失败 | 同 v0.23 | 不报错，不生效 | 同 v0.26 |
| BalanceScheduler 的父类 | 上游 `Scheduler` | 上游 `Scheduler` | `KVDeliveryScheduler`（vllm-ascend 的调度器） | 上游 `Scheduler` |
| 与 DyntraLB | 无此特性 | 无此特性 | 无此特性 | 同开报错 |

靠环境变量打开它的部署升到 main 会静默失效：服务照起，闸门不会打开。main 的配置文档前后不一，开头的迁移表仍列着这个环境变量对应 `scheduler_config.enable_balance_scheduling`，同一文件的参数表却写明它已不再支持，以代码为准。

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
