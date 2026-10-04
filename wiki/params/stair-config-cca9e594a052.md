---
id: stair-config-cca9e594a052
title: stair_config
type: param
origin: seed
evidence: C
summary: >-
  eplb_config 下给 STAIR（vllm-ascend 为 model runner v2 写的 EPLB 规划算法）调参的嵌套 dict，十个键分管负载窗口、重排门槛、副本数搜索、搬运上限与回退次数；知识库钉住的 v0.23、GLM 镜像、v0.26、main 四个版本都没有它，写上就启动报错，2026-09-26 起才进 main。
aliases:
  - STAIR 配置
  - STAIR EPLB policy config
relations:
  - to: eplb
    kind: builds-on
    note: STAIR 是 EPLB 规划器的一种算法；峰均比、冗余副本、搬专家的代价都在那一页讲，本页只讲 STAIR 多出来的旋钮
  - to: ascend-config-system
    kind: builds-on
    note: 这个键是 additional_config.eplb_config 里的嵌套 dict；钉点上写了为什么会起不来（逐键报错与 extra="forbid"）在那一页
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
updated: '2026-10-04'
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L300
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L186-L231'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L233-L262'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L987-L1056'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L846-L856'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L828-L838'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L889-L899'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L175-L197'
  - 'vllm-ascend@baa023ad:vllm_ascend/config_utils.py#L32-L50'
  - 'vllm-ascend@4ebb3090:vllm_ascend/distributed/eplb/policy/factory.py#L10-L16'
  - 'vllm-ascend@4ebb3090:vllm_ascend/platform.py#L940-L983'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L899-L985'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L190-L224'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L255-L388'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L277-L324'
rawSources:
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
---
## 一句话

`stair_config` 是 `eplb_config` 下的一个嵌套 dict，专门给 STAIR 调参。STAIR 是 vllm-ascend 为 model runner v2 写的一套 EPLB 规划算法（策略类 `StairEplbPolicy`）。EPLB 要解决什么、规划器拿什么衡量「不均」（峰均比），见 [EPLB 页](../concepts/eplb.md#怎么算数配对比峰均换位置)；STAIR 做的是同一件事——按各层专家的负载重新摆专家、必要时给热门专家多放副本——只是多了三样东西：按「均值加波动」估负载，只在平衡度变差到一定程度时才重排，每一轮限制每张卡、每台机器能搬几个专家。这个 dict 的十个键就是这三样东西的旋钮；不传就全用默认值，只传几个时其余照旧取默认。

**存在范围：知识库钉住的四个版本都没有这个键。** v0.23 维护分支 2c59ff10、GLM 镜像 db701c1f、v0.26 分支 2ed6cbba、main 钉点 baa023ad（2026-09-21）里都找不到它。它是 2026-09-26 由 PR #17511 进的 main，同一天 #17512 又加上了带搬运上限的摆放。本页和各子参数页讲的行为，都按 main 提交 4d1412d1 写；参数扫描用过 4d1412d1 与稍晚的 8d4409d6 两个 main 提交，两者的配置类逐行相同，也都不是钉点。

**在 4d1412d1 上，它只被校验、不被使用。** 那一版的 STAIR 只有一组在 CPU 上算摆法的函数和这个配置类：整个 vllm_ascend 包里没有任何运行时代码创建 `StairEplbPolicy`，也没有地方读这个键，调用它们的只有单测 [D]。所以在 4d1412d1 上写这个 dict，值不合法会让启动失败，值合法则对运行毫无影响。真正接进运行时的是第二天合入的 PR #17514：按 2026-10-02 的 main 快照 4ebb3090（不是钉点）核，上游 vLLM 的 EPLB 策略名写成 `"stair"` 时，工厂函数才拿这份配置去构造 `StairEplbPolicy` [C10]。从 4d1412d1 到 4ebb3090，规划代码里门槛判断、副本数搜索、带约束摆放这几段没有改动，所以各子参数页按 4d1412d1 讲的行为在 4ebb3090 上同样成立 [D]。

**GLM 双机这套部署用不上它。** 部署本身没开 EPLB（见 [EPLB 页的 GLM 段](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)）。就算在 `eplb_config` 里加上这个键，GLM 镜像的 `EplbConfig` 也不认识它，启动解析配置时直接抛 `ValueError: Config has no attribute 'stair_config'` [C6]。何况 STAIR 只服务 model runner v2，而配套的 vLLM 0.23.0 上连 v2 都选不上，设了开关也会退回 v1（见 [npu-model-runner「会报什么错」](../concepts/npu-model-runner.md#会报什么错)）。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]` |
| 类型 | `StairConfig` |
| 默认表达式 | `dataclasses.field(default_factory=StairConfig)` |
| 定义 | `vllm_ascend/ascend_config.py:300` [C1] |
| 版本 | main · 4d1412d102c16669af3ec73174fc5f8b359b56d9 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 事实表

| 项 | v0.23 / GLM 镜像 | v0.26 | main 钉点 baa023ad | 扫描提交 4d1412d1 | 意味着什么 |
|---|---|---|---|---|---|
| 是否存在 | 无 | 无 | 无 | `eplb_config.stair_config`，类型 `StairConfig` | 钉点上写它，都是写了一个不存在的键 |
| 写了这个键会怎样 | 启动时 `ValueError: Config has no attribute 'stair_config'` [C5] | 同左 [C7] | `EplbConfig` 是带 `extra="forbid"` 的 pydantic dataclass，未知键被拒，启动失败 [C8][C9] | 接受 | 三个钉点上都是起不来，不存在「配了没人读」的静默情形 [!] |
| 十个子键的默认值 | — | — | — | 窗口分箱 64、风险分位 0.75、相对阈值 0.95、绝对阈值 0.90、每卡搬运上限 1、每机跨机上限 1、搜索阶段 4、搜索半径 8、束宽 64、回退上限 32 [C2] | 每个键管哪一步见下面「为什么存在」 |
| 取值校验 | — | — | — | 布尔值一律拒（`STAIR numeric fields must not be booleans`），十个键各有合法范围，越界在建配置时抛 `ValueError` [C3] | 写错就起不来，不会静默丢掉 |
| 子键拼错 | — | — | — | `StairConfig` 同样套了默认 `extra="forbid"` 的装饰器，另加 `frozen=True` [C2] | 拼错一个子键也是启动失败 |
| 谁会读它 | — | — | — | 只有单测 [D]；到 4ebb3090 才在 model runner v2、上游 EPLB 策略名为 `"stair"` 时被读 | 在 4d1412d1 上调这些值看不到任何运行效果 |
| 和 model runner 的关系 | — | — | — | 只服务 v2；4ebb3090 上在 v1 下写这个键会报 `stair_config and load_collection_phase are only supported by Model Runner V2; use eplb_heat_collection_stage with Model Runner V1.` [C11] | v1 的 dynamic EPLB 与 STAIR 是两条不相通的路 |
| 和 `eplb_policy_type` 的关系 | 该键 0–3 选 v1 的规划算法 | 同左 | 同左 | 仍只认 0–3，没有给 STAIR 编号 [C15]；4ebb3090 上 v2 模式的 `eplb_config` 只放行 `load_collection_phase` 与 `stair_config` 两个键 | 想用 STAIR 不是去改 `eplb_policy_type` |
| 页底自动生成区里的 main | — | — | — | 「参数定义」记的是 4d1412d1，「版本谱系」的 main 行是更新的 origin/main | 那两处说「main 有」，指的不是钉点 baa023ad |

## 为什么存在

STAIR 一轮规划对每个 MoE 层走四步，十个键各管其中一步 [C4]：

1. **压缩负载窗口**（[`load_window_bins`](load-window-bins-cc21068b082d.md)）：把上游 EPLB 攒下的逐步负载按时间顺序并成至多这么多个箱，每个箱记均值和样本数，后面所有统计都在箱上算。
2. **决定哪些层要重排**（[`relative_balance_threshold`](relative-balance-threshold-bcbc40e7dc87.md)、[`absolute_balance_threshold`](absolute-balance-threshold-71578a0c428d.md)）：平衡度定义为 1 ÷ 平均峰均比，1 最好。从没提交过新摆法的层直接参与；提交过的层，要等当前平衡度跌到上次提交时预测值的某个比例以下、或者跌破一个绝对下限才重排 [C13]。要重排的层按当前峰均比从高到低排队。
3. **估风险、定副本数**（[`load_risk_quantile`](load-risk-quantile-d89a080ba048.md) 与三个副本搜索键：[`replica_search_num_stages`](replica-search-num-stages-e4b10925ff97.md)、[`replica_search_radius`](replica-search-radius-cd3118b5aae5.md)、[`replica_search_beam_size`](replica-search-beam-size-6556d1650a62.md)）：每个专家的风险 = 负载均值 + z × 标准差，z 由分位数换算；再分阶段搜索每个专家该有几份副本 [C14]。
4. **带约束地摆放**（[`rank_transfer_limit`](rank-transfer-limit-99529b37d91d.md)、[`cross_node_transfer_limit`](cross-node-transfer-limit-06ee92260b7a.md)、[`placement_search_backtrack_limit`](placement-search-backtrack-limit-82b03cef98b0.md)）：按风险从高到低，把副本一份份放到「放进去后风险最低」的合法卡上——这是 LPT（最长任务优先：先排最重的，每次放到最空的位置）的思路——同时守住每卡、每台机器的搬运上限，走不通时最多回退若干次。

四步之后还有一道关：候选摆法的平均峰均比和 p95 峰均比（按样本数加权的第 95 百分位）都不能比现状差；过关的里面取平均峰均比最低的，差不多时选跨机搬运更少的；选出来的若就是现状，这一层就不动 [C12]。

源码注释把「考虑波动的风险估计」和「迟滞」写成这个策略必有的行为，没有提供关掉它们的键 [C2]。迟滞指第 2 步那道门槛：平衡度只是小幅变差时不重排。设这道门槛的道理可以从搬运代价推出来：每次重排都要把专家权重从一张卡拷到另一张卡（代价见 [EPLB 页的代价一节](../concepts/eplb.md#代价多占的显存搬运和等待)），没有门槛时，负载的小抖动就会让规划器反复搬 [I]。

## 开了的代价

**先说清本页有什么、没有什么**：钉点上没有这个特性，上游也没有给出可引用的开与不开的时延、吞吐对照，我们手上没有实测。下面只有配置值和从源码读出的成本结构。

**规划在 CPU 上算，搜索规模由三个 `replica_search_*` 决定。** 副本数搜索把专家按风险从高到低分成「阶段数」组，前面每组的每个候选状态都要试「贪心给的副本数 ± 半径」以内的每个取值，每阶段只留「束宽」个最好的状态往下走 [C14]。第一阶段从一个状态起步，所以默认值下三个展开阶段的状态数上限是 1、17、64，展开次数上限依次是 17、289、1,088，合计 1,394 次，每次展开要做两遍贪心分配 [D]。搜完再朝目标逐个挪副本，留下至多 64 个候选，每个候选各跑一遍带约束的摆放 [D]。这些都是每层、每轮规划的次数上限，不是测出来的耗时；三个键各自的影响见 [replica_search_num_stages](replica-search-num-stages-e4b10925ff97.md)、[replica_search_radius](replica-search-radius-cd3118b5aae5.md)、[replica_search_beam_size](replica-search-beam-size-6556d1650a62.md)。

**单轮能搬的量被压得很低。** 默认每层每张卡至多换进 1 个新专家、至多给别的卡发出 1 份，每台机器每层至多跨机发出、接收各 1 次 [C2]。好处是单轮搬运量小；代价是一轮可能到不了副本搜索给出的目标，要靠多轮逐步逼近 [I]。细节见 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 与 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md)。

**写错就起不来。** 布尔值、越界值、拼错的子键都在建配置时报错（事实表第 4、5 行）。这比「越界静默丢弃」安全，但也意味着旧脚本换版本时要逐键核对。

**跨版本搬脚本：在任何一个钉点上都起不来** [!]。v0.23、GLM 镜像、v0.26 报「没有这个属性」，main 钉点被 `extra="forbid"` 拒；到了已经接上运行时的 4ebb3090，在 model runner v1 下写它仍然报错（事实表第 7 行）。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：

- 在这套部署用的镜像 db701c1f 上，写这个键就是启动失败，原文见「一句话」末段。
- 假如换到已接入 STAIR 的 main 并走 model runner v2，而专家摆法沿用现在的零冗余——每卡 18 个专家、没有副本位（见 [EP 页的 16 张卡怎样分专家](../concepts/expert-parallel.md#16-张卡怎样分专家)）——那么总槽位正好等于专家数，副本数没有可搜的余地，三个 `replica_search_*` 不起作用，STAIR 只能在卡之间换位置 [D]。默认上限下每张卡每层最多换进 1 个、发出 1 个，也就是它的 18 个专家里每层最多换掉 1 个；两台机器之间每层最多各发、各收 1 个 [D]。这些是按源码推的，没有在 GLM 上跑过。

**待核**：4ebb3090 上 vllm-ascend 一侧把策略名 `"stair"` 交给工厂函数，但配套的上游 vLLM 是哪个版本、它的 EPLB 配置是否接受这个策略名，本页没有核；上游为 STAIR 给出的设计动机与效果数字，钉住的源码树里没有。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 无 |
| releases/v0.18.0 | 无 |
| releases/v0.20.2rc | 无 |
| releases/v0.21.0rc | 无 |
| releases/v0.22.1rc | 无 |
| releases/v0.23.0 | 无 |
| releases/v0.24.0rc | 无 |
| releases/v0.25.1rc | 无 |
| releases/v0.26.0rc | 无 |
| releases/v0.27.1rc | 无 |
| releases/v0.28.0rc | 无 |
| releases/v0.29.0rc | 无 |
| main | 有（1 个文件） |

- **引入**：2026-09-26 · bbb5672af80b1972c301852aa505b13374fa6355 · PR [#17511](https://github.com/vllm-project/vllm-ascend/pull/17511) —— [Feature][EPLB] Add STAIR load and replica planning (#17511)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/ascend_config.py` +79 / −2（文本行变化）
  - `vllm_ascend/distributed/eplb/policy/__init__.py` +2 / −0（文本行变化）
  - `vllm_ascend/distributed/eplb/policy/stair.py` +325 / −0（文本行变化）

当前含该标识符的 tag：未找到
