---
id: load-window-bins-cc21068b082d
title: load_window_bins
type: param
summary: 'STAIR 把上游 EPLB 负载窗口按时间顺序压成至多这么多段再算均衡度、方差与协方差：默认 64，范围 2 到 256；只在 main 快照 4d1412d1 上有，且那里没有运行时代码读它。'
origin: seed
evidence: C
updated: '2026-10-04'
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L218
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L194-L196
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L242-L243
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L85-L98
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L1003
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L157-L168
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L113-L122
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/config/parallel.py#L59-L60
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ascend_config.py#L837
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/config_utils.py#L43
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L233-L237
  - >-
    https://github.com/vllm-project/vllm-ascend/pull/17511
rawSources:
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
---
## 一句话

`load_window_bins` 决定 STAIR 把一段负载记录**压成至多多少段**再分析。上游 EPLB 会记下最近一段时间里每一步、每层、每个专家处理了多少 token，这一串记录叫负载窗口；STAIR 不逐步分析，而是按时间顺序把窗口切成至多这么多段，每段只留平均值和这一段有几步 [C2][C4]。默认 `64`，合法范围 `2` 到 `256` [C3]。

举个数感：vLLM v0.23.0 上游 EPLB 窗口的默认长度是 1000 步 [C8]，压成 64 段就是每段 15 或 16 步 [D]。不过在本页所据的快照上 STAIR 还没接进运行时（见下面「存在范围」），以后接入时窗口实际多长，要看那时的上游配置。

STAIR 是 vllm-ascend 为 Model Runner V2（MRv2）写的 EPLB 规划算法（总介绍见 [stair_config](stair-config-cca9e594a052.md)）。它后面用到的几样东西——判断要不要重排的均衡度、筛候选用的平均与 p95 峰均比、估风险用的均值方差协方差——**全都从压缩后的这些段算出来**（见事实表）。所以这个数管的是「STAIR 看负载有多细」。

**存在范围**：我们钉住的四个版本——v0.23 维护分支、GLM 快照 `db701c1f`、v0.26、main `baa023ad`（2026-09-21）——都没有它，写进去启动就报错（见事实表）。它是 2026-09-26 随 `bbb5672a`（[PR #17511](https://github.com/vllm-project/vllm-ascend/pull/17511)）进的 main，此后的 main 一直保留（2026-10-02 的 `4ebb3090` 上默认值仍是 `64`）；本页按 09-26 的 main 快照 `4d1412d1` 描述。下方「版本谱系」表里的「main：有」指的就是这条最新 main，不是钉住的 `baa023ad`。**在 `4d1412d1` 上它也只被解析和校验，没有运行时代码读它**（核对方法见 [absolute_balance_threshold 的一句话](absolute-balance-threshold-71578a0c428d.md#一句话)）。次日的 `a32719ef` 起 STAIR 才接进 MRv2，见 [absolute_balance_threshold 的「之后的版本」](absolute-balance-threshold-71578a0c428d.md#开了的代价)。

**GLM 双机这套部署上它不存在，也用不上**：本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 不认 `stair_config`。

## 参数定义（自动生成）


> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["load_window_bins"]` |
| 类型 | `int` |
| 默认表达式 | `64` |
| 定义 | `vllm_ascend/ascend_config.py:218` [C1] |
| 版本 | main · 4d1412d102c16669af3ec73174fc5f8b359b56d9 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if not 2 <= self.load_window_bins <= 256:
    raise ValueError('stair_config.load_window_bins must be between 2 and 256')
````

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 钉住的四个版本 | 都没有；v0.23 / GLM 快照 / v0.26 报 `Config has no attribute 'stair_config'` [C9]，main `baa023ad` 被 `extra="forbid"` 拒收 [C10] | 服务起不来，不是静默忽略 |
| 完整路径与默认值（`4d1412d1`） | `additional_config["eplb_config"]["stair_config"]["load_window_bins"]`，`int`，默认 `64` | 只写这一个子键时，其余 STAIR 字段取默认值 |
| 合法取值 | 整数 `2` 到 `256`；越界报 `stair_config.load_window_bins must be between 2 and 256`；写成布尔值报 `STAIR numeric fields must not be booleans` [C11] | 不能写 1 把整个窗口并成一段 |
| 怎么切 | 段数 = `min(窗口步数, 本值)`；按时间顺序切，边界取整，各段步数最多差 1；每段存平均负载和步数 | 不打乱时间顺序，相邻的步才会并在一起 |
| 窗口比它短时 | 每一步自成一段，不压缩 | 这时改它不起作用 [D] |
| 什么不变 | 按步数加权后的平均负载与压缩前完全相同 | 「哪个专家平均更热」不受影响 [D] |
| 什么会变 | 每段先平均再算峰均比，均衡度和 p95 都按段算 [C6]；方差、协方差也按段算，只剩段与段之间的起伏 [C7] | 段内的短时尖峰会被抹平 |
| p95 怎么取 | 各段峰均比从小到大排，按步数累加，取第 95% 那一步所在的那段 | 段越少，p95 越粗；只有 2 段时，p95 就是较差的那一半 [D] |
| 运行时谁读它（`4d1412d1`） | 规划入口第一步就按它压缩窗口 [C5]，但这个入口在该快照上没有调用方 | 在这个快照上改它，不改变任何行为 |

## 为什么存在

负载窗口可能很长：按上面的例子，1000 步 × 每层几百个专家。STAIR 规划一层时要试很多候选摆法，每试一个都要把窗口里的负载按新摆法重新加一遍，算出均衡度和 p95；估风险时还要算专家两两之间的协方差。这些计算的量都跟窗口里有多少个样本成正比 [D]。先把窗口压成至多 64 段，计算量就有了一个跟窗口长度无关的上限。

另一层考虑是噪声：单独一步的负载受这一步碰巧来了哪些 token 影响很大，十几步平均一下，专家的热度会稳定得多 [I]。之所以**按时间顺序**切段而不是随便分组，是为了保留「一阵子这几个专家热、过一阵换另一批」这种时间上的起伏——STAIR 估协方差、找「一起变热的专家」，靠的正是这种起伏 [I]。PR 说明对这一步的描述是「按时间顺序压缩，每段权重精确」；64 这个默认值的来由，源码注释和 PR 说明都没有写。

## 开了的代价

**先说清楚本页有什么、没有什么**：下面是配置值和由计算方式推出来的影响方向，不是测出来的效果。上游没有公开不同段数下的规划耗时或均衡度对照；而在 `4d1412d1` 上它根本不被读，也没法测。

**调小（往 2 靠）**：规划算得更快，但看负载更粗。每段平均得越多，短时尖峰越被抹平，算出来的均衡度偏高，[两道重排门槛](absolute-balance-threshold-71578a0c428d.md)更难打开；方差和协方差通常也跟着变小（段内的起伏被丢掉了），[load_risk_quantile](load-risk-quantile-d89a080ba048.md) 的作用随之变弱；p95 只剩寥寥几段可选，变得很粗 [D]。

**调大（往 256 靠）**：看得更细，越接近逐步分析，代价是每个候选的评估和协方差计算都按段数成比例变慢 [D]；而且段越短，每段的负载越受单步偶然性影响，估出来的协方差也越噪 [I]。窗口本身不超过 256 步时，写 256 等于完全不压缩。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：16 张卡、EP16，每层 288 个路由专家）：

- 本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 也不认这个键，照 `4d1412d1` 的写法配进去启动就报 `Config has no attribute 'stair_config'`。下面只是按规划器源码推演。
- 默认 64 段时，每层要用 64 个时间段去估 288 个专家两两之间的协方差。样本数比专家数少得多，单个协方差值会比较噪，「哪两个专家总是一起热」的判断不一定稳 [I]。想让这个判断更稳，方向是多给段数，代价就是上面说的规划变慢。

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
