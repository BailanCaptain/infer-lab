---
id: absolute-balance-threshold-71578a0c428d
title: absolute_balance_threshold
type: param
summary: 'STAIR 判断某层要不要重排的绝对门槛：均衡度（峰均比的倒数）跌到 0.90 及以下就进规划；只在 main 快照 4d1412d1 上有，且那里没有运行时代码读它。'
origin: seed
evidence: C
updated: '2026-10-04'
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
  - >-
    https://github.com/vllm-project/vllm-ascend/pull/17511
rawSources:
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
---
## 一句话

`absolute_balance_threshold` 是 STAIR（vllm-ascend 为 Model Runner V2——下文简称 MRv2——写的一套 EPLB 规划算法，总介绍见 [stair_config](stair-config-cca9e594a052.md)）给每一层 MoE 设的**绝对门槛**：这一层当前的**均衡度**跌到这个数或更低，就把这一层送去重新规划专家摆放。默认 `0.90`，合法范围是 `0 < 值 ≤ 1` [C1]。

均衡度就是 [EPLB 用的峰均比](../concepts/eplb.md#怎么算数配对比峰均换位置)倒过来：先在负载窗口的每个时间段里算「最忙那张卡的负载 ÷ 各卡平均负载」，按每段的样本数加权平均，再取倒数 [C4]。完全均匀是 1，越不均越小。默认的 0.90 换回峰均比约是 1.11——按窗口平均，最忙的卡比各卡均值多出约 11% 时，这道门就开 [D]。

STAIR 决定「这一轮重排哪几层」靠两道门：本页这道看**现在有多不均**，另一道 [relative_balance_threshold](relative-balance-threshold-bcbc40e7dc87.md) 看**比上次落定时差了多少**；任意一道开，这一层就进规划 [C3]。

**存在范围**：我们钉住的四个版本——v0.23 维护分支 `2c59ff10`、含 GLM 代码的快照 `db701c1f`、v0.26 `2ed6cbba`、main `baa023ad`（2026-09-21）——都没有 `stair_config` 这个键，写进去会在启动时报错（见事实表）。它是 2026-09-26 随 `bbb5672a`（[PR #17511](https://github.com/vllm-project/vllm-ascend/pull/17511)）进的 main，此后的 main 一直保留（2026-10-02 的 `4ebb3090` 上默认值仍是 `0.90`）；本页按 09-26 的 main 快照 `4d1412d1` 描述。下方「版本谱系」表里的「main：有」指的就是这条最新 main，不是钉住的 `baa023ad`。**在 `4d1412d1` 上，它也只被解析和校验，没有任何运行时代码读它**：那个快照里全仓搜 `stair`，只命中配置定义、规划器 `stair.py` 本身和两份单测；PR 说明也写明这批字段本身不会选中或执行 STAIR。次日的 `a32719ef` 才把 STAIR 接进 MRv2，见本页末尾「之后的版本」。

**GLM 双机这套部署上它不存在，也用不上。** 本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，走的是 model runner v1；GLM 代码所在的 `db701c1f` 也不认这个键。

## 参数定义（自动生成）


> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["absolute_balance_threshold"]` |
| 类型 | `float` |
| 默认表达式 | `0.9` |
| 定义 | `vllm_ascend/ascend_config.py:221` [C1] |
| 版本 | main · 4d1412d102c16669af3ec73174fc5f8b359b56d9 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 在哪些版本里 | 钉住的四版（v0.23 维护分支、GLM 快照、v0.26、main `baa023ad`）都没有；09-26 起的 main 才有，本页按 `4d1412d1` 描述 | 钉住的四个版本上都配不了它；谱系表的「main：有」指最新 main |
| v0.23 / GLM 快照 / v0.26 上写了会怎样 | `EplbConfig` 逐键比对已知键，不认识就抛 `ValueError`，原文 `Config has no attribute 'stair_config'`（GLM 快照 [C5]；v0.23 [C12]、v0.26 [C13] 是同一行代码） | 服务直接起不来，不是静默忽略 |
| main `baa023ad` 上写了会怎样 | `EplbConfig` 已改成 pydantic dataclass，未知键由 `extra="forbid"` 拒收 [C6] | 同样起不来；报错文本由 pydantic 生成，不在 vllm-ascend 源码里 |
| 完整路径与默认值（`4d1412d1`） | `additional_config["eplb_config"]["stair_config"]["absolute_balance_threshold"]`，`float`，默认 `0.90` | 只写这一个子键时，其余 STAIR 字段取默认值 |
| 合法范围 | 有限值且 `0 < 值 ≤ 1`；越界报 `stair_config.absolute_balance_threshold must be between zero and one` [C2]；写成布尔值报 `STAIR numeric fields must not be booleans` [C11] | 写 `0` 想「关掉这道门」会起不来；要它几乎不触发，只能写一个很小的正数 |
| 均衡度怎么算 | 每个时间段「最忙卡负载 ÷ 各卡平均负载」，按样本数加权平均，再取倒数（源码注释原话是 mean max-to-average rank-load ratio 的倒数 [C8]） | 看的是整个窗口的平均，短时尖峰会被摊薄 |
| 判据与相对门的关系 | 当前均衡度 `≤` 阈值就触发，等号也算；和相对门是「或」，任一触发这一层就进规划 | 调高任何一道，都会让更多层进规划 |
| 什么时候不看它 | 窗口负载全为 0：不规划；这一层还没有「上次落定」的锚点：只要负载非零就直接进规划，两道门都不看 | 第一轮所有有负载的层都会进规划 |
| 进了规划不等于一定搬 | 候选摆法的平均峰均比或 p95 峰均比只要有一项比当前差就丢掉；最后选中的和当前摆法一样，也不出计划 [C7] | 按窗口里的负载算，不会被搬到更差；多花的主要是规划算力 |
| 运行时谁读它（`4d1412d1`） | 没有调用方，只做解析和校验 | 在这个快照上改它，不改变任何行为 |

## 为什么存在

EPLB 要定期决定：哪些层值得把专家重新摆一遍。搬专家不是免费的——要搬权重、要等搬完（见 [EPLB 页的代价一节](../concepts/eplb.md#代价多占的显存搬运和等待)）——所以不能负载一波动就搬。STAIR 给每层设两道门，负载坏到一定程度才动，动完以后要再坏一截才再动；源码注释把这种「滞回」（hysteresis）写成策略的固定行为，不能关，只能调这两个阈值 [C8]。

**只有相对门为什么不够。** 相对门比的是「现在 ÷ 上次落定时预测的均衡度」，默认要跌到 0.95 倍才开。如果上次落定的摆法本身就不太好——每卡、每节点能搬几个专家都有上限（[rank_transfer_limit](rank-transfer-limit-99529b37d91d.md)、[cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md)），假设规划出来只有 0.85——那么相对门要等它跌到 0.85 × 0.95 ≈ 0.81 才开，这一层会一直停在明显不均的状态里没人管 [D]。绝对门补的就是这个口子：不看历史，只要均衡度在 0.90 及以下，每次规划都会把这一层重新算一遍 [D]。

**0.90 这个数从哪来**，源码注释和 PR 说明都没有给推导，也没有公开标定场景。在 `4d1412d1` 次日把 STAIR 接进 MRv2 的那个提交里，官方文档写的是 STAIR 的默认值不需要调 [S10]。

## 开了的代价

**先说清楚本页有什么、没有什么**：它不是开关，是一道阈值。本页的数都是配置值和由公式换算出来的值，不是测出来的效果。上游没有公开不同阈值下的时延、吞吐对照；而在 `4d1412d1` 上它根本不被读，也没法测。

**调高（往 1 靠）**：更多层、更频繁地进规划。规划是 CPU 上的搜索——先搜每个专家放几份，再在搬运上限内找摆法——层越多算得越久；接入运行时以后，被采纳的新摆法还意味着真的搬权重。写 `1` 是极端：均衡度最大就是 1，`≤ 1` 恒成立，只要窗口里有负载，每层每次都会进规划，等于把绝对这一侧的滞回拆掉 [D]。

**调低（往 0 靠）**：绝对门越来越难开，最后只剩相对门起作用，上一节说的「落定时就不太好的层」会一直留着 [D]。合法范围不含 0，想让它几乎不触发只能写很小的正数，单测里用作下边界的是 `0.000001`。

**门开了也不一定搬。** 见事实表倒数第二行：比当前差的候选一律丢掉，选中的和当前一样就不出计划。所以把阈值调高，多花的首先是规划算力；搬不搬、搬多少，还要看这一层的负载有没有改进空间、以及每次规划的搬运上限 [D]。

**均衡度受窗口压缩方式影响。** 负载窗口会先被压成至多 [load_window_bins](load-window-bins-cc21068b082d.md) 段，每段先把负载平均掉再算峰均比。最忙的卡如果在不同时刻轮换，平均之后差距会被抹平，算出来的均衡度偏高，这道门就更难开 [D]。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、TP8 / DP2 / EP16）：

- 本部署[只开了 EP、没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，专家摆法从启动起固定不变，没有任何重排策略在跑。
- GLM 代码所在的 `db701c1f` 上，`eplb_config` 不认 `stair_config`：照着 `4d1412d1` 的写法配进去，启动时就报 `Config has no attribute 'stair_config'`。
- STAIR 是 MRv2 的策略，而本部署走的是 [model runner v1](../concepts/eplb.md#对照源码)；就算换到 `4d1412d1`，上面已经说过，那里也没有代码读这个值。

**之后的版本。** 次日的 `a32719ef`（PR #17514）才把 STAIR 接进 MRv2：`policy` 为 `stair` 时由工厂函数创建 STAIR 规划器 [C9]。这个提交不在本库任何钉住版本里，接入以后怎么配、怎么跑，本页不展开。

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
