---
id: stair-config-cca9e594a052
title: stair_config
type: param
origin: seed
evidence: C
summary: >-
  eplb_config 下给 STAIR（vllm-ascend 为 model runner v2 写的 EPLB 规划算法）调参的嵌套
  dict，十个键分管负载窗口、重排门槛、副本数搜索、搬运上限与回退次数。rc2 已接入 MRV2 且默认策略为 stair；旧 v0.23、GLM
  镜像、v0.26 和固定 main baa023ad 没有这个键。
aliases:
  - STAIR 配置
  - STAIR EPLB policy config
relations:
  - to: eplb
    kind: builds-on
    note: STAIR 是 EPLB 规划器的一种算法；峰均比、冗余副本、搬专家的代价都在那一页讲，本页只讲 STAIR 多出来的旋钮
  - to: ascend-config-system
    kind: builds-on
    note: >-
      这个键是 additional_config.eplb_config 里的嵌套 dict；钉点上写了为什么会起不来（逐键报错与
      extra="forbid"）在那一页
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
updated: 2026-11-03T00:00:00.000Z
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
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L288
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L297
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L298
  - >-
    raw:sha256-9b9fa5a8ca3602c995585694ca642e402a070c85e6099a398fa730c507b3570b.md#L1-L633
  - >-
    vllm-ascend@1eda0ddad8b67f791a1019741d254cc97f9617ad:vllm_ascend/ascend_config.py#L302
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L360-L362
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L186-L261'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L289-L300'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L38-L66'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/factory.py#L10-L16'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L152-L184'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L300
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L283-L314'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L204-L239'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L305
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-1b0bd120973ed640e9ff8963fd65beaab611b24f70266f27179d4691edf23a53.md
  - >-
    raw/sha256-9b9fa5a8ca3602c995585694ca642e402a070c85e6099a398fa730c507b3570b.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-c464f43f6b53bd43e74846ad95a26448484a9ba179597922409ed7774ce99fff.md
  - >-
    raw/sha256-c72498576a170455c135d749651303ce5defbeb08b46a62e6c257bd2f15dcced.md
  - >-
    raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md
  - >-
    raw/sha256-d52e6721dafc61ddfe3628246bcae3cda0e6200d1a0263ff862b9e4889c9a67d.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
---
## 一句话

**v0.30.0rc2 对照。** rc2 已在 EplbConfig 提供这十个字段，并由 MRV2 controller/factory 接到 StairEplbPolicy；原先四个快照“没有该键”和旧规划器“未接入”的结论不适用于 rc2。需要启用 EPLB 且最终 eplb_config.policy 为 stair；rc2 补丁已将默认策略设为 stair，显式选 default 则使用另一种策略，不消费 STAIR 的嵌套配置。两个搬运限额 rank_transfer_limit、cross_node_transfer_limit 的声明默认改为 -1，其余八项仍为 64、0.75、0.95、0.90、4、8、64、32（按下文事实表字段顺序）。未指定 communicator 时进行全组 HIXL 可用性与实现一致性检查，自动回退 torch_gloo 时仅把未显式给出的两个搬运限额收紧为 1；显式指定 communicator 会跳过这条自动选择与收紧路径。

`stair_config` 是 `eplb_config` 下的一个嵌套 dict，专门给 STAIR 调参。STAIR 是 vllm-ascend 为 model runner v2 写的一套 EPLB 规划算法（策略类 `StairEplbPolicy`）。EPLB 要解决什么、规划器拿什么衡量「不均」（峰均比），见 [EPLB 页](../concepts/eplb.md#怎么算数配对比峰均换位置)；STAIR 做的是同一件事——按各层专家的负载重新摆专家、必要时给热门专家多放副本——只是多了三样东西：按「均值加波动」估负载，只在平衡度变差到一定程度时才重排，每一轮限制每张卡、每台机器能搬几个专家。这个 dict 的十个键就是这三样东西的旋钮；不传就全用默认值，只传几个时其余照旧取默认。

**旧版本范围。** v0.23 维护分支 2c59ff10、GLM 镜像 db701c1f、v0.26 分支 2ed6cbba、固定 main baa023ad（2026-09-21）没有这个键，rc2 已有。它在 2026-09-26 随 PR #17511 进入 main，同一天 #17512 加上带搬运上限的摆放。下面的历史事实表与算法走读保留 main 提交 4d1412d1 的范围；早期扫描还用过配置类相同的 8d4409d6。当前自动生成的参数定义已改为 rc2，版本谱系按 seeds 的固定快照计算，不能把历史扫描 main 当成固定 main。

**在 4d1412d1 上，它只被校验、不被使用。** 那一版的 STAIR 只有一组在 CPU 上算摆法的函数和这个配置类：整个 vllm_ascend 包里没有任何运行时代码创建 `StairEplbPolicy`，也没有地方读这个键，调用它们的只有单测 [D]。所以在 4d1412d1 上写这个 dict，值不合法会让启动失败，值合法则对运行毫无影响。真正接进运行时的是第二天合入的 PR #17514：按 2026-10-02 的 main 快照 4ebb3090（不是钉点）核，上游 vLLM 的 EPLB 策略名写成 `"stair"` 时，工厂函数才拿这份配置去构造 `StairEplbPolicy` [C10]。从 4d1412d1 到 4ebb3090，规划代码里门槛判断、副本数搜索、带约束摆放这几段没有改动，所以各子参数页按 4d1412d1 讲的行为在 4ebb3090 上同样成立 [D]。

**GLM 双机这套部署用不上它。** 部署本身没开 EPLB（见 [EPLB 页的 GLM 段](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)）。就算在 `eplb_config` 里加上这个键，GLM 镜像的 `EplbConfig` 也不认识它，启动解析配置时直接抛 `ValueError: Config has no attribute 'stair_config'` [C6]。何况 STAIR 只服务 model runner v2，而配套的 vLLM 0.23.0 上连 v2 都选不上，设了开关也会退回 v1（见 [npu-model-runner「会报什么错」](../concepts/npu-model-runner.md#会报什么错)）。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]` |
| 类型 | `StairConfig` |
| 默认表达式 | `dataclasses.field(default_factory=StairConfig)` |
| 定义 | `vllm_ascend/ascend_config.py:300` [C27] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |

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
| 当前自动生成区的口径 | — | — | — | 参数定义取 rc2；谱系 main 固定为 baa023ad，另有 rc2 一行 | 历史算法走读和当前扫描记录分开读 |

## 为什么存在

STAIR 一轮规划对每个 MoE 层走四步，十个键各管其中一步 [C4]：

1. **压缩负载窗口**（[`load_window_bins`](load-window-bins-cc21068b082d.md)）：把上游 EPLB 攒下的逐步负载按时间顺序并成至多这么多个箱，每个箱记均值和样本数，后面所有统计都在箱上算。
2. **决定哪些层要重排**（[`relative_balance_threshold`](relative-balance-threshold-bcbc40e7dc87.md)、[`absolute_balance_threshold`](absolute-balance-threshold-71578a0c428d.md)）：平衡度定义为 1 ÷ 平均峰均比，1 最好。先跳过负载窗口全为零的层；其余层中，从没提交过新摆法的层直接参与，提交过的层要等当前平衡度跌到上次提交时预测值的某个比例以下、或者跌破一个绝对下限才重排 [C13]。要重排的层按当前峰均比从高到低排队。
3. **估风险、定副本数**（[`load_risk_quantile`](load-risk-quantile-d89a080ba048.md) 与三个副本搜索键：[`replica_search_num_stages`](replica-search-num-stages-e4b10925ff97.md)、[`replica_search_radius`](replica-search-radius-cd3118b5aae5.md)、[`replica_search_beam_size`](replica-search-beam-size-6556d1650a62.md)）：每个专家的风险 = 负载均值 + z × 标准差，z 由分位数换算；再分阶段搜索每个专家该有几份副本 [C14]。

实际阶段数还受专家数量限制：取配置阶段数与专家数中的较小值，再把按风险排序的专家分组。因此，配置的阶段数多于专家数时，不会为多出的阶段建立空组。

4. **带约束地摆放**（[`rank_transfer_limit`](rank-transfer-limit-99529b37d91d.md)、[`cross_node_transfer_limit`](cross-node-transfer-limit-06ee92260b7a.md)、[`placement_search_backtrack_limit`](placement-search-backtrack-limit-82b03cef98b0.md)）：按风险从高到低，把副本一份份放到「放进去后风险最低」的合法卡上——这是 LPT（最长任务优先：先排最重的，每次放到最空的位置）的思路——同时守住每卡、每台机器的搬运上限，走不通时最多回退若干次。

四步之后还有一道关：候选摆法的平均峰均比和 p95 峰均比（按样本数加权的第 95 百分位）都不能比现状差；过关的里面取平均峰均比最低的，差不多时选跨机搬运更少的；选出来的若就是现状，这一层就不动 [C12]。

源码注释把「考虑波动的风险估计」和「迟滞」写成这个策略必有的行为，没有提供关掉它们的键 [C2]。迟滞指第 2 步那道门槛：平衡度只是小幅变差时不重排。设这道门槛的道理可以从搬运代价推出来：每次重排都要把专家权重从一张卡拷到另一张卡（代价见 [EPLB 页的代价一节](../concepts/eplb.md#代价多占的显存搬运和等待)），没有门槛时，负载的小抖动就会让规划器反复搬 [I]。

## 开了的代价

**成本分配置版本看。** rc2 已接入真实运行时；下文算法次数沿用4d1412d1走读，搬运上限另标旧默认与rc2默认。这里没有设备上的开关时延、吞吐对照，搜索次数不等于实际耗时。

**规划在 CPU 上算，搜索规模由三个 `replica_search_*` 决定。** 副本数搜索把专家按风险从高到低分成「阶段数」组，前面每组的每个候选状态都要试「贪心给的副本数 ± 半径」以内的每个取值，每阶段只留「束宽」个最好的状态往下走 [C14]。第一阶段从一个状态起步，所以默认值下三个展开阶段的状态数上限是 1、17、64，展开次数上限依次是 17、289、1,088，合计 1,394 次，每次展开要做两遍贪心分配 [D]。搜完再朝目标逐个挪副本，留下至多 64 个候选，每个候选各跑一遍带约束的摆放 [D]。这些都是每层、每轮规划的次数上限，不是测出来的耗时；三个键各自的影响见 [replica_search_num_stages](replica-search-num-stages-e4b10925ff97.md)、[replica_search_radius](replica-search-radius-cd3118b5aae5.md)、[replica_search_beam_size](replica-search-beam-size-6556d1650a62.md)。

**搬运上限决定能否一轮到达目标。** 历史4d1412d1默认每卡每层接收、发送各至多1份专家，每机跨机发送、接收各至多1次；rc2两项声明默认为-1，表示不以这个限额封顶。rc2自动选通信器并回退torch_gloo时，才把未显式配置的限额收紧为1。小上限减少单轮搬运，却可能需要多轮逼近目标；显式参数和通信器会改变结果。细节见[每卡限制](rank-transfer-limit-99529b37d91d.md)与[跨机限制](cross-node-transfer-limit-06ee92260b7a.md)。

**写错就起不来。** 布尔值、越界值、拼错的子键都在建配置时报错（事实表第 4、5 行）。这比「越界静默丢弃」安全，但也意味着旧脚本换版本时要逐键核对。

**跨版本搬脚本要先选对入口。** v0.23、GLM镜像、v0.26没有此属性，旧main baa023ad拒收未知键；rc2已经支持，须走MRV2并使用stair策略。4ebb3090已接入运行时，但MRV1仍拒收这份嵌套配置，不能把“能解析配置”与“选中规划器”混为一谈。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：

- 在这套部署用的镜像 db701c1f 上，写这个键就是启动失败，原文见「一句话」末段。
- 假如换到已接入STAIR的版本并走MRV2，而专家摆法沿用现在的零冗余——每卡18个专家、没有副本位（见[EP页](../concepts/expert-parallel.md#16-张卡怎样分专家)）——总槽位等于专家数，副本数没有搜索余地，只能重新摆位置。**若显式将两项搬运限额都设为1**，则每卡每层最多换进、发出各1份，两机每层跨机各发、收至多1次；这是给定限额的推演，不是rc2所有通信器下的默认行为，也没有在GLM上实测。

**待核**：4ebb3090 上 vllm-ascend 一侧把策略名 `"stair"` 交给工厂函数，但配套的上游 vLLM 是哪个版本、它的 EPLB 配置是否接受这个策略名，本页没有核；上游为 STAIR 给出的设计动机与效果数字，钉住的源码树里没有。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `EplbConfig.stair_config` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 无 | `baa023ad` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |

## 对照源码

### 源码位置

历史4d1412d1的plan_layer先排除平均峰均比或p95峰均比比现状差的候选，再让预测平均峰均比不超过最小值加内部容差的候选比较平局。依次比较跨节点迁移次数、同节点远端迁移次数、目标专家编号、来源rank和来源槽位，取较小者（来源12，stair.py 951–983）。这是确定选择次序，不是设备收益保证。

- 来源 21：vllm-ascend@4d1412d1，vllm_ascend/distributed/eplb/policy/stair.py，L360–L362。
