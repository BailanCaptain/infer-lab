---
id: load-risk-quantile-d89a080ba048
title: load_risk_quantile
type: param
summary: 'STAIR 估负载时按多悲观的分位数算：专家与每张卡的负载记作均值加 z 倍标准差，z 由这个分位数换算，默认 0.75 即 z 约 0.674；只在 main 快照 4d1412d1 上有，且那里没有运行时代码读它。'
origin: seed
evidence: C
updated: '2026-10-04'
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L219
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L190-L198
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L229-L231
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L244-L245
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L172-L187
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L809-L810
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L443-L452
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L102-L122
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L662-L667
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L950-L955
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ascend_config.py#L837
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/config_utils.py#L43
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L233-L237
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L227-L237
  - >-
    https://github.com/vllm-project/vllm-ascend/pull/17511
rawSources:
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
---
## 一句话

`load_risk_quantile` 决定 STAIR 估算负载时**按多悲观的情形来算**。专家的负载会忽高忽低，STAIR 不只看平均，而是把每个专家、每张卡的负载都记成「均值 + z × 标准差」；z 就由这个分位数换算——源码注释原话是「单侧标准正态分位数，换成 z-score」[C2][C3]。默认 `0.75`，对应 z ≈ 0.674；合法范围是 `0.5 < 值 < 1`，两端都不含 [C4]。

几个常见取值换成 z：0.75 → 0.674，0.9 → 1.282，0.95 → 1.645，0.99 → 2.326 [D]。z 越大，越把「波动大的专家」当成重负载来对待。

STAIR 是 vllm-ascend 为 Model Runner V2（MRv2）写的 EPLB 规划算法（总介绍见 [stair_config](stair-config-cca9e594a052.md)）。这个数**只影响候选摆法怎么生成**——哪个专家多放几份、先摆谁、摆到哪张卡——**不影响候选怎么评判**：门槛判断和最后挑哪个候选，用的都是窗口里的实际负载，跟 z 无关（见事实表）。

**存在范围**：我们钉住的四个版本——v0.23 维护分支、GLM 快照 `db701c1f`、v0.26、main `baa023ad`（2026-09-21）——都没有它，写进去启动就报错（见事实表）。它是 2026-09-26 随 `bbb5672a`（[PR #17511](https://github.com/vllm-project/vllm-ascend/pull/17511)）进的 main，此后的 main 一直保留（2026-10-02 的 `4ebb3090` 上默认值仍是 `0.75`）；本页按 09-26 的 main 快照 `4d1412d1` 描述。下方「版本谱系」表里的「main：有」指的就是这条最新 main，不是钉住的 `baa023ad`。**在 `4d1412d1` 上它也只被解析和校验，没有运行时代码读它**（核对方法见 [absolute_balance_threshold 的一句话](absolute-balance-threshold-71578a0c428d.md#一句话)）。次日的 `a32719ef` 起 STAIR 才接进 MRv2，见 [absolute_balance_threshold 的「之后的版本」](absolute-balance-threshold-71578a0c428d.md#开了的代价)。

**GLM 双机这套部署上它不存在，也用不上**：本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 不认 `stair_config`。

## 参数定义（自动生成）


> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["load_risk_quantile"]` |
| 类型 | `float` |
| 默认表达式 | `0.75` |
| 定义 | `vllm_ascend/ascend_config.py:219` [C1] |
| 版本 | main · 4d1412d102c16669af3ec73174fc5f8b359b56d9 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if not math.isfinite(self.load_risk_quantile) or not 0.5 < self.load_risk_quantile < 1:
    raise ValueError('stair_config.load_risk_quantile must be between 0.5 and one')
````

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 钉住的四个版本 | 都没有；v0.23 / GLM 快照 / v0.26 报 `Config has no attribute 'stair_config'` [C11]，main `baa023ad` 被 `extra="forbid"` 拒收 [C12] | 服务起不来，不是静默忽略 |
| 完整路径与默认值（`4d1412d1`） | `additional_config["eplb_config"]["stair_config"]["load_risk_quantile"]`，`float`，默认 `0.75` | 只写这一个子键时，其余 STAIR 字段取默认值 |
| 合法取值 | 有限值且 `0.5 < 值 < 1`；越界报 `stair_config.load_risk_quantile must be between 0.5 and one`；写成布尔值报 `STAIR numeric fields must not be booleans` [C13] | 不能写 0.5 退回「只看均值」，只能无限接近 |
| 换算 | `z = NormalDist().inv_cdf(值)`，取值 > 0.5 保证 z > 0 | 默认 z ≈ 0.674 |
| 专家风险 | `均值 + z × 标准差`，均值、方差都按样本数加权，从压缩后的窗口算 [C5][C8] | 波动大的专家风险更高 |
| 用在哪里① 放几份 | 多出来的副本位，按「风险 ÷ 已有份数」从高到低一个个分 [C14] | z 越大，波动大的专家越容易多拿一份 |
| 用在哪里② 摆到哪 | 专家按每份风险从高到低依次摆，每份放到「加上它以后风险最低」的那张卡；卡的风险也是 `均值 + z × 标准差`，方差里算上同卡专家之间的协方差 [C6][C7][C9] | 会一起变热的专家，z 越大越不愿意放同一张卡 |
| 不用在哪里 | 两道重排门槛和候选的去留、排名，都按窗口里实际负载的峰均比算 [C10] | z 改的是「提哪些候选」，不是「选哪个」 |
| 运行时谁读它（`4d1412d1`） | 没有调用方，只做解析和校验 | 在这个快照上改它，不改变任何行为 |

## 为什么存在

最直接的做法是按每个专家的**平均**负载来摆：平均上各卡差不多，就算均衡。但专家的热度会随时间起伏，而且可能是成组起伏——比如同一类请求进来，几个专家一起变热 [I]。平均上均衡的摆法，可能恰好把两个「一起热」的专家放在同一张卡上，平时看不出来，一到那种时刻这张卡就成了最慢的那一个（峰均比的含义见 [EPLB 页](../concepts/eplb.md#怎么算数配对比峰均换位置)）。

STAIR 的办法是把波动也算进负载：单个专家用「均值 + z × 标准差」，一张卡用卡上所有专家加起来的均值和方差，方差里带上专家两两之间的协方差 [C7]——一起变热的专家放在一起，卡的方差会额外变大，于是规划器倾向于把它们拆开。源码注释把这种「看协方差的风险」写成策略的固定行为，不能关 [C2]，能调的只有 z 的大小，也就是本页这个分位数。

用分位数而不是直接给 z，是因为分位数更好理解：如果负载近似正态分布，0.75 大致是「按四次里有三次不会超过的负载来准备」。但负载是不是真的近似正态，源码没有检验，这层解读只是帮助理解 [I]。0.75 这个默认值的来由，源码注释与 PR 说明都没有写。

## 开了的代价

**先说清楚本页有什么、没有什么**：下面是配置值和由公式推出来的影响方向，不是测出来的效果。上游没有公开不同分位数下的均衡度或时延对照；而在 `4d1412d1` 上它根本不被读，也没法测。

**调高（往 1 靠）**：z 变大，规划器越来越按「最坏时刻」来摆，波动大的专家会多拿副本、被单独摆开。代价是这样生成的候选，按平均负载看未必最均衡；而候选最后是按窗口里的平均峰均比排名、按平均和 p95 两项「不许变差」来筛的 [C10]，z 太大时，提出来的候选可能大多比不过当前摆法，这一层就不动 [I]。

**调低（往 0.5 靠）**：z 趋近 0，退化成只看平均，波动和协方差都不起作用；这时 p95 只靠「不许比当前更差」这一条兜底 [D]。

**搜索规模不变，耗时可能略有出入。** 副本数搜索的规模由 [replica_search_num_stages](replica-search-num-stages-e4b10925ff97.md)、[replica_search_radius](replica-search-radius-cd3118b5aae5.md)、[replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 决定，不随 z 变 [D]；但 z 不同，提出来的候选就不同，摆放时的回溯次数、能走通的候选数也会跟着变，具体耗时可能略有出入 [I]。

**它依赖窗口里算出来的方差。** 方差是从压缩后的窗口算的：每一段先把负载平均掉，段内的起伏就看不见了。窗口压得越狠（[load_window_bins](load-window-bins-cc21068b082d.md) 越小），算出来的方差越小，z 乘上去的效果越弱；窗口里只有一个样本时方差直接是 0，这个数完全不起作用 [D][C8]。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：16 张卡、EP16，每卡每层 18 个路由专家，没有冗余专家）：

- 本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 也不认这个键，照 `4d1412d1` 的写法配进去启动就报 `Config has no attribute 'stair_config'`。下面只是按规划器源码推演。
- 没有冗余专家时，288 个专家各一份正好填满 16 × 18 个槽位，「放几份」这一步没有余地 [D]，z 只剩下「先摆谁、摆到哪张卡」这一个用处。
- 每层要估 288 个专家两两之间的协方差，即一个 288 × 288 的矩阵；这是 CPU 上的小矩阵运算，规模本身不构成瓶颈 [I]。

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
