---
id: load-risk-quantile-d89a080ba048
title: load_risk_quantile
type: param
summary: >-
  STAIR 估负载时按多悲观的分位数算：专家与每张卡的负载记作均值加 z 倍标准差，z 由这个分位数换算，默认 0.75 即 z 约 0.674。rc2
  已接入 MRV2 的 EPLB；早期扫描快照尚未接入服务。
origin: seed
evidence: C
updated: 2026-11-03T00:00:00.000Z
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
  - 'https://github.com/vllm-project/vllm-ascend/pull/17511'
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L207
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L216
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L217
  - >-
    raw:sha256-a5141c836fde46945c437fc0895f72b7b64f4a757636c9423fe4e9f460a474bd.md#L1-L147
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L197-L198
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L218-L231
  - >-
    raw:sha256-0d8caf444d3fca63a7fe53e9facbc116e65fbc7a525aa94e3adb80c6e8909f73.md#L1-L169
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L218-L245'
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L1142-L1175
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L45-L59'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L219
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L220
rawSources:
  - >-
    raw/sha256-0d8caf444d3fca63a7fe53e9facbc116e65fbc7a525aa94e3adb80c6e8909f73.md
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-76c09d1a58e3f562ecbbab086104b06ff633e817a512decb4721eec64b143f43.md
  - >-
    raw/sha256-a5141c836fde46945c437fc0895f72b7b64f4a757636c9423fe4e9f460a474bd.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-c464f43f6b53bd43e74846ad95a26448484a9ba179597922409ed7774ce99fff.md
  - >-
    raw/sha256-c72498576a170455c135d749651303ce5defbeb08b46a62e6c257bd2f15dcced.md
  - >-
    raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
relations:
  - to: load-window-bins-cc21068b082d
    kind: builds-on
    note: 风险分位数作用于压缩窗口估出的方差与协方差，其效果依赖窗口分段保留的负载波动。
  - to: ascend-config-system
    kind: builds-on
    note: >-
      该参数通过 additional_config 的 eplb_config.stair_config 层级配置，依赖 AscendConfig
      按子配置层级解析；是否接受该键须按版本判断。
---
## 一句话

**v0.30.0rc2 对照：** 默认仍为 0.75，要求有限且在 (0.5,1) 内，z_score 仍取标准正态分位数；默认约 0.674 的手算解释保留。不同于旧扫描快照，MRV2 已接入 STAIR，layer planner 会把该值用于专家风险及包含方差、协方差的摆放估计。它是规划风险参数，不是模型采样分位数。

`load_risk_quantile` 决定 STAIR 估算负载时**按多悲观的情形来算**。专家的负载会忽高忽低，STAIR 不只看平均，而是把每个专家、每张卡的负载都记成「均值 + z × 标准差」；z 就由这个分位数换算——源码注释原话是「单侧标准正态分位数，换成 z-score」[C2][C3]。默认 `0.75`，对应 z ≈ 0.674；合法范围是 `0.5 < 值 < 1`，两端都不含 [C4]。

几个常见取值换成 z：0.75 → 0.674，0.9 → 1.282，0.95 → 1.645，0.99 → 2.326 [D]。z 越大，越把「波动大的专家」当成重负载来对待。

这里借用标准正态分位数给波动项加权。若负载服从正态分布，且均值与标准差准确描述该分布，风险分数才有相应正态分位点的解释；对一般负载，它只是“均值加波动余量”的评分。默认 0.75 本身不提供实际负载有 75% 概率低于该分数的保证。


STAIR 是 vllm-ascend 为 Model Runner V2（MRv2）写的 EPLB 规划算法（总介绍见 [stair_config](stair-config-cca9e594a052.md)）。这个数**只影响候选摆法怎么生成**——哪个专家多放几份、先摆谁、摆到哪张卡——**不影响候选怎么评判**：门槛判断和最后挑哪个候选，用的都是窗口里的实际负载，跟 z 无关（见事实表）。

**旧版本范围**：v0.23、GLM 快照 `db701c1f`、v0.26、固定 main `baa023ad` 没有此键，写入会启动报错。它在 2026-09-26 随 `bbb5672a`（[PR #17511](https://github.com/vllm-project/vllm-ascend/pull/17511)）加入，10-02 的 `4ebb3090` 仍默认 `0.75`。下文按 `4d1412d1` 讲历史行为；该快照尚无服务运行时消费，次日 `a32719ef` 才接入 MRV2，核对范围见 [absolute_balance_threshold](absolute-balance-threshold-71578a0c428d.md#一句话)。当前参数定义取 rc2，谱系 main 仍指旧钉点，rc2 单列。

**GLM 双机这套部署上它不存在，也用不上**：本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 不认 `stair_config`。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["load_risk_quantile"]` |
| 类型 | `float` |
| 默认表达式 | `0.75` |
| 定义 | `vllm_ascend/ascend_config.py:219` [C26] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |

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
| 四个旧快照 | 都没有；v0.23 / GLM 快照 / v0.26 报 `Config has no attribute 'stair_config'` [C11]，main `baa023ad` 被 `extra="forbid"` 拒收 [C12] | 服务起不来，不是静默忽略 |
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

用两个假设的专家作示意：平均负载都是 10，标准差分别为 0 和 4。分位数 0.75 对应 z≈0.674，因此风险分数分别为 10 + 0.674 × 0 = 10，以及 10 + 0.674 × 4 ≈ 12.696。两者平均负载相同，差别来自波动项；风险分数供规划使用，不是多出来的实际工作量。这组数是教学假设，没有对应的设备测量。

用分位数而不是直接给 z，是因为分位数更好理解：如果负载近似正态分布，0.75 大致是「按四次里有三次不会超过的负载来准备」。但负载是不是真的近似正态，源码没有检验，这层解读只是帮助理解 [I]。0.75 这个默认值的来由，源码注释与 PR 说明都没有写。

## 开了的代价

**先说清楚本页有什么、没有什么**：下面是配置值和由公式推出来的影响方向，不是测出来的效果。上游没有公开不同分位数下的均衡度或时延对照；而在 `4d1412d1` 上它根本不被读，也没法测。

**调高（往 1 靠）**：z 变大，规划器越来越按「最坏时刻」来摆，波动大的专家会多拿副本、被单独摆开。代价是这样生成的候选，按平均负载看未必最均衡；而候选最后是按窗口里的平均峰均比排名、按平均和 p95 两项「不许变差」来筛的 [C10]，z 太大时，提出来的候选可能大多比不过当前摆法，这一层就不动 [I]。

**调低（往 0.5 靠）**：z 趋近 0，退化成只看平均，波动和协方差都不起作用；这时 p95 只靠「不许比当前更差」这一条兜底 [D]。

**搜索规模不变，耗时可能略有出入。** 副本数搜索的规模由 [replica_search_num_stages](replica-search-num-stages-e4b10925ff97.md)、[replica_search_radius](replica-search-radius-cd3118b5aae5.md)、[replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 决定，不随 z 变 [D]；但 z 不同，提出来的候选就不同，摆放时的回溯次数、能走通的候选数也会跟着变，具体耗时可能略有出入 [I]。

**它依赖窗口里算出来的方差。** 方差是从压缩后的窗口算的：每一段先把负载平均掉，段内的起伏就看不见了。但改变 [load_window_bins](load-window-bins-cc21068b082d.md) 会重新计算分段边界，较少的段不一定由较多的段直接合并而成，不能据此断定方差一定变小、z 的作用一定变弱。窗口里只有一个样本时方差直接是 0，这个数完全不影响风险公式的波动项。[D][C8]

例如，单个专家的八步负载为 `0、0、0、10、0、0、0、0`。上限为 6 段时，含 10 的那一步与前一个 0 合并，段均值为 5、权重为 2；按源码的样本方差公式，方差约为 5.357。改成 5 段时，该步单独成段，均值为 10、权重为 1，方差反而升到 12.5。两种分段的全窗口均值都仍为 1.25；变化来自分段边界保留了不同的起伏。这是按固定分段与统计公式计算的反例，不是负载实测。[A][D]

即使总样本数大于 1，只要某个专家在所有分段中的负载均值都相同，按这套加权统计公式得到的该专家方差也为零；此时提高分位数不会增加该专家风险公式中的波动项。这里说的是压缩分段后的统计量，不代表原始负载从未波动。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：16 张卡、EP16，每卡每层 18 个路由专家，没有冗余专家）：

- 本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 也不认这个键，照 `4d1412d1` 的写法配进去启动就报 `Config has no attribute 'stair_config'`。下面只是按规划器源码推演。
- 没有冗余专家时，288 个专家各一份正好填满 16 × 18 个槽位，「放几份」这一步没有余地 [D]，z 只剩下「先摆谁、摆到哪张卡」这一个用处。
- 每层要估 288 个专家两两之间的协方差，即一个 288 × 288 的矩阵；这是 CPU 上的小矩阵运算，规模本身不构成瓶颈 [I]。

4d1412d1按各段样本数算均值，再用去均值后的加权协方差对角线得到方差；某专家各段值全同，该列偏差就是零（来源8，102–122）。风险公式再对方差开方得到波动项（来源5，172–187）。零方差的代数条件不证明实际负载服从正态分布，也不保证性能收益。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.load_risk_quantile` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 无 | `baa023ad` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |

## 对照源码

- 来源 20、21：vllm-ascend@4d1412d1，vllm_ascend/ascend_config.py，L197–L198、L218–L231。
- 来源 5：vllm-ascend@4d1412d1，vllm_ascend/distributed/eplb/policy/stair.py，L172–L187。

风险示例使用来源 5 的 `4d1412d1:stair.py` L172–L187 中 `mean + z_score × sqrt(variance)` 公式，以及来源 3 的 `ascend_config.py` L229–L231 中正态分位数到 z 的换算。均值 10、标准差 0/4 是教学假设；以 z≈0.674 算得 10/12.696 是代数示例，不是负载测量。
