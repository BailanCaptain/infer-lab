---
id: placement-search-backtrack-limit-82b03cef98b0
title: placement_search_backtrack_limit
type: param
summary: >-
  STAIR 为每个候选限制接受可行替代摆放的次数：默认 32，范围 0 到 64；0 仍允许每个决策的首个可行选择及跳过不可行试放，只禁止接受替代可行选择。
  rc2 已接入 MRV2 的 EPLB；历史走读使用的 4d1412d1 规划器尚未接入服务。
origin: seed
evidence: C
updated: 2026-11-03T00:00:00.000Z
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L227
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L214-L215
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L260-L261
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L662-L670
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L858-L869
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L783-L786
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L932-L949
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ascend_config.py#L837
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/config_utils.py#L43
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L233-L237
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L876-L878
  - 'https://github.com/vllm-project/vllm-ascend/pull/17511'
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L215
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L224
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L225
  - >-
    raw:sha256-9198fa0857064ad6dd8c91dbb6d7315f423a3864b583f6a993354117e9480f2e.md#L1-L102
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L224-L261'
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L1163-L1176
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L936-L1087'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L45-L59'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L227
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L228
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L225
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-8aee88a8655f94436c1debd866502a010af1cae1a114c5294fc5664492948023.md
  - >-
    raw/sha256-9198fa0857064ad6dd8c91dbb6d7315f423a3864b583f6a993354117e9480f2e.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-c464f43f6b53bd43e74846ad95a26448484a9ba179597922409ed7774ce99fff.md
  - >-
    raw/sha256-c72498576a170455c135d749651303ce5defbeb08b46a62e6c257bd2f15dcced.md
  - >-
    raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md
  - >-
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
relations:
  - to: ascend-config-system
    kind: builds-on
    note: >-
      该参数嵌在 additional_config 的 eplb_config.stair_config 下，其配置位置和旧版本拒收行为依赖
      AscendConfig 的分层解析与 EPLB 未识别键校验规则。
  - to: cross-node-transfer-limit-06ee92260b7a
    kind: builds-on
    note: 有界回溯在满足跨节点搬运上限的约束摆放中寻找可行方案；跨节点上限越紧，越容易出现需要回溯的死路。
---
## 一句话

**v0.30.0rc2 对照。** 默认仍为 32，范围仍为 0–64；变化在于 MRV2 的 STAIR controller 已把它传入实际的逐层摆放规划。需要启用 EPLB 且最终 policy 为 stair；rc2 默认已是 stair，显式选 default 则不消费 STAIR 配置，入口统一见 [stair_config](stair-config-cca9e594a052.md#一句话)。设为 0 只把“接受替代可行分支”的回溯预算归零，初次摆放和失败候选检查仍会进行，不能把它解释成关闭搜索。下文“未接入”指原先钉住的旧快照。

`placement_search_backtrack_limit` 限制 STAIR 在为**一个候选**摆放专家副本时，最多接受多少次替代的可行选择。专家是执行特定计算的模块，副本是该专家的一份实例；“可行”还要求能在搬运限额内找到权重来源。预算只计接受替代选择，不是每试一张卡都扣一次；具体计数见事实表。默认 `32`，合法范围 `0` 到 `64` [C3]。

STAIR 是 vllm-ascend 为 Model Runner V2（MRv2）写的 EPLB 规划算法（总介绍见 [stair_config](stair-config-cca9e594a052.md)）。它给一层定下「每个专家放几份」的若干候选之后，逐个候选用带约束的 LPT（Longest Processing Time first：先放最重的，每份放到放完以后最轻的那张卡）把副本摆到卡上 [C4]。本页这个数只管这一步里的回溯。

**旧版本范围**：v0.23、GLM 快照 `db701c1f`、v0.26、固定 main `baa023ad` 没有此键，写入会启动报错。它在 2026-09-26 随 `bbb5672a`（[PR #17511](https://github.com/vllm-project/vllm-ascend/pull/17511)）加入，10-02 的 `4ebb3090` 仍默认 `32`。下文按 `4d1412d1` 讲历史行为：规划器内部读取预算，但尚未接入推理服务；次日 `a32719ef` 才接入 MRV2，见 [接入说明](absolute-balance-threshold-71578a0c428d.md#开了的代价)。当前参数定义取 rc2，谱系 main 仍指旧钉点，rc2 单列。

**GLM 双机这套部署上它不存在，也用不上**：本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 不认 `stair_config`。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["placement_search_backtrack_limit"]` |
| 所属类 | `StairConfig` |
| 类型 | `int` |
| 默认表达式 | `32` |
| 定义 | `vllm_ascend/ascend_config.py:225` [C23] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if not 0 <= self.placement_search_backtrack_limit <= 64:
    raise ValueError('stair_config.placement_search_backtrack_limit must be between 0 and 64')
````

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 四个旧快照 | 都没有；v0.23 / GLM 快照 / v0.26 报 `Config has no attribute 'stair_config'` [C8]，main `baa023ad` 被 `extra="forbid"` 拒收 [C9] | 服务起不来，不是静默忽略 |
| 完整路径与默认值（`4d1412d1`） | `additional_config["eplb_config"]["stair_config"]["placement_search_backtrack_limit"]`，`int`，默认 `32` | 只写这一个子键时，其余 STAIR 字段取默认值 |
| 合法取值 | 整数 `0` 到 `64`；越界报 `stair_config.placement_search_backtrack_limit must be between 0 and 64`；写成布尔值报 `STAIR numeric fields must not be booleans` [C10] | 上限 64 是写死的校验 |
| 计数范围 | 每个候选单独计数，换下一个候选重新从 0 开始 [C7] | 不是整层或整轮规划的总预算 |
| 什么算一次 | 每份副本按「放上去以后风险最低」的顺序试卡；凑不出搬运来源的卡直接跳过、不计数；某一步第一次选定不计数；搜索退回到这一步、改选另一张可行的卡，才扣一次 [C5] | 预算数的是「改主意」，不是「试了几张卡」 |
| 预算用完 | 下一次要改选时，直接放弃这个候选 [C5]；退回到第一步也无路可走，同样放弃 [C11] | 放弃的是这个候选，不是整层 |
| 死路从哪来 | 每份副本只能放到：还有空槽、还没放这个专家，且（有限额时）要么原来就有这个专家（放回原卡不占收进名额）、要么收进的专家数没到 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 的卡 [C6]；搬运来源还得满足 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md) | 搬运限额越紧，越容易走进死路 |
| 候选被放弃之后 | 跳过它，试下一个候选；所有候选都被放弃或都不如当前，这一层这次不出计划 [C7] | 回溯预算太小，可能让一层错过本可以做的改进 |
| 运行时谁读它（`4d1412d1`） | 规划器的候选循环读取该字段，传入每个候选的摆放函数 | 改变内部搜索预算，但该快照没有接入推理服务 |

## 为什么存在

LPT 是一种很快的贪心法：先放最重的，每次都放到当前最轻的地方，一遍走完。约束越少，它越不容易走进死路；但 STAIR 的摆放带着好几条约束——每张卡的槽位数固定、同一张卡不放同一个专家两份、每张卡每次最多收进几个新专家、每台机器每次最多跨机器搬几个——前面每一步都在消耗这些名额，贪心只看眼前，可能把后面某份副本的去路全占掉 [D]。

彻底的回溯（把所有放法都试一遍）在几百个专家、十几张卡的规模上是指数级的，规划不可能等得起。所以 STAIR 只给一个有限的回溯预算：大部分候选贪心一遍就成，少数走进死路的，允许回头改几次救回来，救不回来就放弃这个候选，换下一个。约束摆放这一步是紧接着的 [PR #17512](https://github.com/vllm-project/vllm-ascend/pull/17512) 加进来的，说明里写的是 covariance-aware LPT placement with bounded backtracking（看协方差的 LPT 摆放，带有界回溯）；32 这个默认值的来由，源码注释与 PR 说明都没有写。

## 开了的代价

下面讨论配置值及根据控制流推断的影响方向。本页没有不同回溯预算下的规划耗时、摆放成功率或硬件实测；讨论内部规划函数，不把它当作该快照上已经接入的服务行为。

**调大（往 64 靠）**：走进死路的候选更有机会被救回来，能挑的候选更多。代价是规划时间：每次回溯都要撤掉已经放好的若干份、重新试卡，每试一张需要搬运的卡还要检查搬运来源能不能凑齐（这一步本身也是一个小搜索，结果会缓存）[D]。最坏情况下每个候选都把预算用满，而一层可能有几十个候选（由 [replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 等决定），时间会成倍增加 [D]。

**调小（往 0 靠）**：会更早截断需要接受替代选择的搜索路径。设为 0 时仍可跳过来源不可行的试放，并接受每个摆放决策的第一个来源可行选择；不能再接受该决策的替代可行选择。预算刚好用满后，当前路径仍可继续完成；只有再次需要接受替代可行选择时才因预算不足失败。失败后的处理见事实表，不会因此终止整层的其他候选。

**它的作用大小取决于搬运限额。** [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 与 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md) 越紧，死路越多，回溯预算越常被用上；两者都写 `-1` 时，剩下的约束只有槽位和「同卡不放同专家两份」，走进死路的机会小得多，这个数基本不起作用 [I]。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：16 张卡、两台机器，每卡每层 18 个路由专家，没有冗余专家）：

- 本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 也不认这个键，照 `4d1412d1` 的写法配进去启动就报 `Config has no attribute 'stair_config'`。下面只是按规划器源码推演。
- 没有冗余专家时，每个候选都要把 288 份副本逐份摆完 [D]。搬运限额取默认值（每卡收进 1 个、每台机器跨机器进出各 1 个）时，绝大多数专家只能留在原来的卡上，贪心想把某份副本挪走时，常常发现名额已被前面占用——这种「名额紧、步数多」的情形，正是回溯预算会被真正用上的场景 [I]。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.placement_search_backtrack_limit` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |
| releases/v0.30.0 | 有 | `c09d3e20` |

## 对照源码

### 源码位置

4d1412d1的首个来源可行选择不耗回退预算，来源不可行的试放撤销后继续；已有可行选择、又要接受替代可行选择且预算已满时才返回失败（来源4、5、11）。候选循环传入预算，并跳过失败候选（来源7，945–949）。这份旧快照尚无外部服务调用；rc2接入与实际运行成本按前文分别判断。
