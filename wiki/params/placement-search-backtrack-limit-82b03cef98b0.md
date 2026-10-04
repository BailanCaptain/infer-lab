---
id: placement-search-backtrack-limit-82b03cef98b0
title: placement_search_backtrack_limit
type: param
summary: 'STAIR 为一个候选摆专家时最多回头改几次主意：默认 32，范围 0 到 64，0 即纯贪心、走进死路就放弃这个候选；只在 main 快照 4d1412d1 上有，且那里没有运行时代码读它。'
origin: seed
evidence: C
updated: '2026-10-04'
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
  - >-
    https://github.com/vllm-project/vllm-ascend/pull/17511
rawSources:
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
---
## 一句话

`placement_search_backtrack_limit` 规定 STAIR 在为**一个候选**摆专家时，最多能**回头改几次主意**。摆法是贪心地一份一份放的，前面放得太随意，后面可能有专家无处可放；这时可以退回前面某一步换个位置重来，每换一次扣一次预算，扣完还走不通，就放弃这个候选 [C2][C4]。默认 `32`，合法范围 `0` 到 `64`；写 `0` 就是纯贪心、一次都不回头 [C3]。

STAIR 是 vllm-ascend 为 Model Runner V2（MRv2）写的 EPLB 规划算法（总介绍见 [stair_config](stair-config-cca9e594a052.md)）。它给一层定下「每个专家放几份」的若干候选之后，逐个候选用带约束的 LPT（Longest Processing Time first：先放最重的，每份放到放完以后最轻的那张卡）把副本摆到卡上 [C4]。本页这个数只管这一步里的回溯。

**存在范围**：我们钉住的四个版本——v0.23 维护分支、GLM 快照 `db701c1f`、v0.26、main `baa023ad`（2026-09-21）——都没有它，写进去启动就报错（见事实表）。它是 2026-09-26 随 `bbb5672a`（[PR #17511](https://github.com/vllm-project/vllm-ascend/pull/17511)）进的 main，此后的 main 一直保留（2026-10-02 的 `4ebb3090` 上默认值仍是 `32`）；本页按 09-26 的 main 快照 `4d1412d1` 描述。下方「版本谱系」表里的「main：有」指的就是这条最新 main，不是钉住的 `baa023ad`。**在 `4d1412d1` 上它也只被解析和校验，没有运行时代码读它**（核对方法见 [absolute_balance_threshold 的一句话](absolute-balance-threshold-71578a0c428d.md#一句话)）。次日的 `a32719ef` 起 STAIR 才接进 MRv2，见 [absolute_balance_threshold 的「之后的版本」](absolute-balance-threshold-71578a0c428d.md#开了的代价)。

**GLM 双机这套部署上它不存在，也用不上**：本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 不认 `stair_config`。

## 参数定义（自动生成）


> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["placement_search_backtrack_limit"]` |
| 类型 | `int` |
| 默认表达式 | `32` |
| 定义 | `vllm_ascend/ascend_config.py:227` [C1] |
| 版本 | main · 4d1412d102c16669af3ec73174fc5f8b359b56d9 |

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
| 钉住的四个版本 | 都没有；v0.23 / GLM 快照 / v0.26 报 `Config has no attribute 'stair_config'` [C8]，main `baa023ad` 被 `extra="forbid"` 拒收 [C9] | 服务起不来，不是静默忽略 |
| 完整路径与默认值（`4d1412d1`） | `additional_config["eplb_config"]["stair_config"]["placement_search_backtrack_limit"]`，`int`，默认 `32` | 只写这一个子键时，其余 STAIR 字段取默认值 |
| 合法取值 | 整数 `0` 到 `64`；越界报 `stair_config.placement_search_backtrack_limit must be between 0 and 64`；写成布尔值报 `STAIR numeric fields must not be booleans` [C10] | 上限 64 是写死的校验 |
| 计数范围 | 每个候选单独计数，换下一个候选重新从 0 开始 [C7] | 不是整层或整轮规划的总预算 |
| 什么算一次 | 每份副本按「放上去以后风险最低」的顺序试卡；凑不出搬运来源的卡直接跳过、不计数；某一步第一次选定不计数；搜索退回到这一步、改选另一张可行的卡，才扣一次 [C5] | 预算数的是「改主意」，不是「试了几张卡」 |
| 预算用完 | 下一次要改选时，直接放弃这个候选 [C5]；退回到第一步也无路可走，同样放弃 [C11] | 放弃的是这个候选，不是整层 |
| 死路从哪来 | 每份副本只能放到：还有空槽、还没放这个专家，且（有限额时）要么原来就有这个专家（放回原卡不占收进名额）、要么收进的专家数没到 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 的卡 [C6]；搬运来源还得满足 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md) | 搬运限额越紧，越容易走进死路 |
| 候选被放弃之后 | 跳过它，试下一个候选；所有候选都被放弃或都不如当前，这一层这次不出计划 [C7] | 回溯预算太小，可能让一层错过本可以做的改进 |
| 运行时谁读它（`4d1412d1`） | 没有调用方，只做解析和校验 | 在这个快照上改它，不改变任何行为 |

## 为什么存在

LPT 是一种很快的贪心法：先放最重的，每次都放到当前最轻的地方，一遍走完。约束越少，它越不容易走进死路；但 STAIR 的摆放带着好几条约束——每张卡的槽位数固定、同一张卡不放同一个专家两份、每张卡每次最多收进几个新专家、每台机器每次最多跨机器搬几个——前面每一步都在消耗这些名额，贪心只看眼前，可能把后面某份副本的去路全占掉 [D]。

彻底的回溯（把所有放法都试一遍）在几百个专家、十几张卡的规模上是指数级的，规划不可能等得起。所以 STAIR 只给一个有限的回溯预算：大部分候选贪心一遍就成，少数走进死路的，允许回头改几次救回来，救不回来就放弃这个候选，换下一个。约束摆放这一步是紧接着的 [PR #17512](https://github.com/vllm-project/vllm-ascend/pull/17512) 加进来的，说明里写的是 covariance-aware LPT placement with bounded backtracking（看协方差的 LPT 摆放，带有界回溯）；32 这个默认值的来由，源码注释与 PR 说明都没有写。

## 开了的代价

**先说清楚本页有什么、没有什么**：下面是配置值和由算法推出来的影响方向，不是测出来的效果。上游没有公开不同回溯预算下的规划耗时或成功率；而在 `4d1412d1` 上它根本不被读，也没法测。

**调大（往 64 靠）**：走进死路的候选更有机会被救回来，能挑的候选更多。代价是规划时间：每次回溯都要撤掉已经放好的若干份、重新试卡，每试一张需要搬运的卡还要检查搬运来源能不能凑齐（这一步本身也是一个小搜索，结果会缓存）[D]。最坏情况下每个候选都把预算用满，而一层可能有几十个候选（由 [replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 等决定），时间会成倍增加 [D]。

**调小（往 0 靠）**：规划更快，但只要贪心走进死路，这个候选就直接作废。搬运限额很紧时，可能大部分候选都被作废，这一层这次就不动 [D]。

**它的作用大小取决于搬运限额。** [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 与 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md) 越紧，死路越多，回溯预算越常被用上；两者都写 `-1` 时，剩下的约束只有槽位和「同卡不放同专家两份」，走进死路的机会小得多，这个数基本不起作用 [I]。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：16 张卡、两台机器，每卡每层 18 个路由专家，没有冗余专家）：

- 本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 也不认这个键，照 `4d1412d1` 的写法配进去启动就报 `Config has no attribute 'stair_config'`。下面只是按规划器源码推演。
- 没有冗余专家时，每个候选都要把 288 份副本逐份摆完 [D]。搬运限额取默认值（每卡收进 1 个、每台机器跨机器进出各 1 个）时，绝大多数专家只能留在原来的卡上，贪心想把某份副本挪走时，常常发现名额已被前面占用——这种「名额紧、步数多」的情形，正是回溯预算会被真正用上的场景 [I]。

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
| main | 有（2 个文件） |

- **引入**：2026-09-26 · bbb5672af80b1972c301852aa505b13374fa6355 · PR [#17511](https://github.com/vllm-project/vllm-ascend/pull/17511) —— [Feature][EPLB] Add STAIR load and replica planning (#17511)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/ascend_config.py` +79 / −2（文本行变化）
  - `vllm_ascend/distributed/eplb/policy/__init__.py` +2 / −0（文本行变化）
  - `vllm_ascend/distributed/eplb/policy/stair.py` +325 / −0（文本行变化）

当前含该标识符的 tag：未找到
