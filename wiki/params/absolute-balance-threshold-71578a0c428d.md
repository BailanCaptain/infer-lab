---
id: absolute-balance-threshold-71578a0c428d
title: absolute_balance_threshold
type: param
summary: >-
  STAIR 判断某层要不要重排的绝对门槛：均衡度（峰均比的倒数）跌到 0.90 及以下就进规划。rc2 已接入 MRV2 的 EPLB；早期扫描快照
  4d1412d1 尚未接入服务。
origin: seed
evidence: C
updated: 2026-11-03T00:00:00.000Z
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L221
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L246-L249
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L209-L223
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L157-L168
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ascend_config.py#L837
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L179-L180
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L951-L983
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L190-L191
  - >-
    vllm-ascend@a32719ef9512c1172b2724c8b84674b13cdb0ac2:vllm_ascend/distributed/eplb/policy/factory.py#L14-L15
  - >-
    vllm-ascend@a32719ef9512c1172b2724c8b84674b13cdb0ac2:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L84-L87
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L233-L237
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L856
  - >-
    vllm-ascend@2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f:vllm_ascend/ascend_config.py#L898
  - 'https://github.com/vllm-project/vllm-ascend/pull/17511'
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L209
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L218
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L219
  - >-
    raw:sha256-0086ec9731534b60a962917a3a760e0469472d148be11dc2ff09ea283fa3720e.md#L1-L133
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L950-L983
  - >-
    raw:sha256-9362c3d57aaddeb0ff3fc85b656f1946640a44606b1925f4c76c5458c9b0fd96.md#L1-L170
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L218-L249'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L395-L430'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L45-L66'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L221
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L222
rawSources:
  - >-
    raw/sha256-0086ec9731534b60a962917a3a760e0469472d148be11dc2ff09ea283fa3720e.md
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-9362c3d57aaddeb0ff3fc85b656f1946640a44606b1925f4c76c5458c9b0fd96.md
  - >-
    raw/sha256-a6eecd8841f88ca29a27180f7860715dce5ca56afe8f2f3dd8456f5a82b00a0b.md
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
    note: 绝对门槛所比较的均衡度基于压缩后的负载窗口计算，因此窗口分段方式影响门槛是否触发。
  - to: ascend-config-system
    kind: builds-on
    note: >-
      该参数通过 AscendConfig 的 JSON 子配置层级解析，能否配置取决于对应版本的 EPLB 配置是否识别
      stair_config；旧版本会拒绝这个未知键。
---
## 一句话

**v0.30.0rc2 对照：** 默认仍是 0.90，范围 (0,1]；MRV2 已把 STAIR controller 接到实际策略，旧扫描快照“尚无运行时消费”的限制不适用于 rc2。非零负载且没有已提交锚点时直接评估；已有锚点时，绝对或相对门槛任一满足即可规划，零负载窗口跳过。须启用 EPLB 且最终 policy 为 stair；rc2 的默认策略已是 stair，显式选 default 则不消费 STAIR 配置，字段存在本身不会启动搬运。策略入口统一见 [stair_config](stair-config-cca9e594a052.md#一句话)。

`absolute_balance_threshold` 是 STAIR（vllm-ascend 为 Model Runner V2——下文简称 MRv2——写的一套 EPLB 规划算法，总介绍见 [stair_config](stair-config-cca9e594a052.md)）给每一层 MoE 设的**绝对门槛**：这一层当前的**均衡度**跌到这个数或更低，就把这一层送去重新规划专家摆放。默认 `0.90`，合法范围是 `0 < 值 ≤ 1` [C1]。

均衡度就是 [EPLB 用的峰均比](../concepts/eplb.md#怎么算数配对比峰均换位置)倒过来：先在负载窗口的每个时间段里算「最忙那张卡的负载 ÷ 各卡平均负载」，按每段的样本数加权平均，再取倒数 [C4]。完全均匀是 1，越不均越小。默认的 0.90 换回峰均比约是 1.11——按窗口平均，最忙的卡比各卡均值多出约 11% 时，这道门就开 [D]。

STAIR 决定「这一轮重排哪几层」靠两道门：本页这道看**现在有多不均**，另一道 [relative_balance_threshold](relative-balance-threshold-bcbc40e7dc87.md) 看**比上次落定时差了多少**；任意一道开，这一层就进规划 [C3]。

源码把“没有上次落定锚点”表示为 `None` 或 NaN：窗口负载非零时，这两种情况都直接返回当前不均衡信息，不比较阈值；全零窗口则先返回 `None`。因此，小的合法绝对阈值不能关闭相对条件，也不能阻止无锚点时进入规划。这里核对的是固定 `4d1412d1` 的判断分支；完整触发情形见下方事实表。

**旧版本范围**：v0.23 维护分支 `2c59ff10`、GLM 快照 `db701c1f`、v0.26 `2ed6cbba`、固定 main `baa023ad` 没有 `stair_config`，写入会启动报错。该字段在 2026-09-26 随 `bbb5672a`（[PR #17511](https://github.com/vllm-project/vllm-ascend/pull/17511)）进入 main，10-02 的 `4ebb3090` 仍默认 `0.90`。下文算法走读保留 `4d1412d1` 范围；**那时仅解析和校验，没有服务运行时代码消费**，全仓命中配置、规划器及两份单测，次日 `a32719ef` 才接入 MRV2。当前参数定义取 rc2，谱系 main 仍指旧钉点 `baa023ad`，rc2 单列。

**GLM 双机这套部署上它不存在，也用不上。** 本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，走的是 model runner v1；GLM 代码所在的 `db701c1f` 也不认这个键。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["absolute_balance_threshold"]` |
| 类型 | `float` |
| 默认表达式 | `0.9` |
| 定义 | `vllm_ascend/ascend_config.py:221` [C24] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 旧版本的存在范围 | v0.23 维护分支、GLM 快照、v0.26、main `baa023ad` 都没有；09-26 起的 main 才有，下表按 `4d1412d1` 描述 | rc2 已有并接入服务，见本页开头；谱系按固定快照列示 |
| v0.23 / GLM 快照 / v0.26 上写了会怎样 | `EplbConfig` 逐键比对已知键，不认识就抛 `ValueError`，原文 `Config has no attribute 'stair_config'`（GLM 快照 [C5]；v0.23 [C12]、v0.26 [C13] 是同一行代码） | 服务直接起不来，不是静默忽略 |
| main `baa023ad` 上写了会怎样 | `EplbConfig` 已改成 pydantic dataclass，未知键由 `extra="forbid"` 拒收 [C6] | 同样起不来；报错文本由 pydantic 生成，不在 vllm-ascend 源码里 |
| 完整路径与默认值（`4d1412d1`） | `additional_config["eplb_config"]["stair_config"]["absolute_balance_threshold"]`，`float`，默认 `0.90` | 只写这一个子键时，其余 STAIR 字段取默认值 |
| 合法范围 | 有限值且 `0 < 值 ≤ 1`；越界报 `stair_config.absolute_balance_threshold must be between zero and one` [C2]；写成布尔值报 `STAIR numeric fields must not be booleans` [C11] | 写 `0` 想「关掉这道门」会起不来；要它几乎不触发，只能写一个很小的正数 |
| 均衡度怎么算 | 每个时间段「最忙卡负载 ÷ 各卡平均负载」，按样本数加权平均，再取倒数（源码注释原话是 mean max-to-average rank-load ratio 的倒数 [C8]） | 看的是整个窗口的平均，短时尖峰会被摊薄 |
| 判据与相对门的关系 | 当前均衡度 `≤` 阈值就触发，等号也算；和相对门是「或」，任一触发这一层就进规划 | 在同一负载窗口和落定锚点下，调高绝对门槛不会缩小触发集合；相对门可能早已触发，所以进入规划的层数可能增加，也可能不变 |
| 什么时候不看它 | 窗口负载全为 0：不规划；这一层还没有「上次落定」的锚点：只要负载非零就直接进规划，两道门都不看 | 第一轮所有有负载的层都会进规划 |
| 进了规划不等于一定搬 | 候选摆法的平均峰均比或 p95 峰均比只要有一项比当前差就丢掉；最后选中的和当前摆法一样，也不出计划 [C7] | 按窗口里的负载算，不会被搬到更差；多花的主要是规划算力 |
| 运行时谁读它（`4d1412d1`） | 没有调用方，只做解析和校验 | 在这个快照上改它，不改变任何行为 |

## 为什么存在

EPLB 要定期决定：哪些层值得把专家重新摆一遍。搬专家不是免费的——要搬权重、要等搬完（见 [EPLB 页的代价一节](../concepts/eplb.md#代价多占的显存搬运和等待)）——所以不能负载一波动就搬。STAIR 给每层设两道门，负载坏到一定程度才动，动完以后要再坏一截才再动；源码注释把这种「滞回」（hysteresis）写成策略的固定行为，不能关，只能调这两个阈值 [C8]。

**只有相对门为什么不够。** 相对门比的是「现在 ÷ 上次落定时预测的均衡度」，默认要跌到 0.95 倍才开。如果上次落定的摆法本身就不太好——每卡、每节点能搬几个专家都有上限（[rank_transfer_limit](rank-transfer-limit-99529b37d91d.md)、[cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md)），假设规划出来只有 0.85——那么相对门要等它跌到 0.85 × 0.95 ≈ 0.81 才开，这一层会一直停在明显不均的状态里没人管 [D]。绝对门补的就是这个口子：不看历史，只要均衡度在 0.90 及以下，每次规划都会把这一层重新算一遍 [D]。

**0.90 这个数从哪来**，源码注释和 PR 说明都没有给推导，也没有公开标定场景。在 `4d1412d1` 次日把 STAIR 接进 MRv2 的那个提交里，官方文档写的是 STAIR 的默认值不需要调 [S10]。

## 开了的代价

**先说清楚本页有什么、没有什么**：它不是开关，是一道阈值。本页的数都是配置值和由公式换算出来的值，不是测出来的效果。上游没有公开不同阈值下的时延、吞吐对照；而在 `4d1412d1` 上它根本不被读，也没法测。

**调高（往 1 靠）**：在同一负载窗口和落定锚点下，可能让更多层进规划，也可能因相对门已触发而不变；不能仅据阈值推出未来运行中的规划频率。规划是 CPU 上的搜索——先搜每个专家放几份，再在搬运上限内找摆法——层越多算得越久；接入运行时以后，被采纳的新摆法还意味着真的搬权重。写 `1` 是极端：均衡度最大就是 1，`≤ 1` 恒成立，只要窗口里有负载，每层每次都会进规划，等于把绝对这一侧的滞回拆掉 [D]。

**调低（往 0 靠）**：绝对门越来越难开，最后只剩相对门起作用，上一节说的「落定时就不太好的层」会一直留着 [D]。合法范围不含 0，想让它几乎不触发只能写很小的正数，单测里用作下边界的是 `0.000001`。

**门开了也不一定搬。** 见事实表倒数第二行：比当前差的候选一律丢掉，选中的和当前一样就不出计划。所以把阈值调高，多花的首先是规划算力；搬不搬、搬多少，还要看这一层的负载有没有改进空间、以及每次规划的搬运上限 [D]。


候选先按平均峰均比筛选；落在最优值的近似并列容差内时，再依次比较跨节点迁移数、节点内跨 rank 迁移数及确定性排序键。这是在可行候选之间打破并列，不是把两类迁移数直接加进平均峰均比。

这里的 p95 峰均比把各段的峰均比从小到大排列，按每段代表的样本计数累计，取达到总样本数 95% 的位置所对应的值。它描述负载分布较差一侧的位置，不是最差 5% 样本逐个都不得变差的保证。

**均衡度受窗口压缩方式影响。** 负载窗口会先被压成至多 [load_window_bins](load-window-bins-cc21068b082d.md) 段，每段先把负载平均掉再算峰均比。最忙的卡如果在不同时刻轮换，平均之后差距会被抹平，算出来的均衡度偏高，这道门就更难开 [D]。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、TP8 / DP2 / EP16）：

- 本部署[只开了 EP、没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，专家摆法从启动起固定不变，没有任何重排策略在跑。
- GLM 代码所在的 `db701c1f` 上，`eplb_config` 不认 `stair_config`：照着 `4d1412d1` 的写法配进去，启动时就报 `Config has no attribute 'stair_config'`。
- STAIR 是 MRv2 的策略，而本部署走的是 [model runner v1](../concepts/eplb.md#对照源码)；就算换到 `4d1412d1`，上面已经说过，那里也没有代码读这个值。

**之后的版本。** 次日的 `a32719ef`（PR #17514）把 STAIR 接进 MRV2：`policy` 为 `stair` 时由工厂函数创建 STAIR 规划器 [C9]。rc2 已包含接入后的实现，启用条件与默认策略见本页开头及 [stair_config](stair-config-cca9e594a052.md#一句话)。

4d1412d1先处理全零窗口与无锚点情形，再以相对条件或绝对条件放行规划（来源3，209–223）。固定同一窗口和锚点，提高绝对阈值只会保持或扩大触发集合；这不保证最终搬运。p95按排序后的累计样本数确定（来源4，157–168），最终候选还要按均值和p95筛选（来源7，951–983）。历史算法快照没有服务调用，rc2接入范围见前文，设备收益另测。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.absolute_balance_threshold` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 无 | `baa023ad` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |

## 对照源码

- 来源 19：vllm-ascend@4d1412d1，vllm_ascend/distributed/eplb/policy/stair.py，L950–L983。
