---
id: absolute-balance-threshold-71578a0c428d
title: absolute_balance_threshold
type: param
summary: >-
  STAIR 判断某层是否重新规划的绝对滞回门槛：当前均衡度（平均峰均比的倒数）跌至本值（默认 0.90，约合峰均比 1.11，合法范围 (0, 1]）及以下即放行该层进入规划，与相对门槛为“或”关系。v0.30.0 与 main 已在 MRv2 STAIR 中生效。
aliases:
  - stair_config.absolute_balance_threshold
  - 绝对平衡阈值
  - 绝对滞回门槛
  - STAIR absolute balance threshold
origin: seed
evidence: C
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: 2026-11-19T00:00:00.000Z
legacyAnchors:
  一句话: 它管什么绝对门槛与相对门槛怎么配合
  为什么存在: 为什么仅有相对门槛还不够
  开了的代价: 调高调低的边界与放到-glm-双机
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
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L219
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L218-L248'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L348-L377'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L398-L435'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L1183-L1217'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/eplb.py#L37-L60'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L437-L468'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L225-L255'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L233-L265'
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
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
relations:
  - to: stair-config-cca9e594a052
    kind: builds-on
    note: 这是 stair_config 的双门滞回子键之一；STAIR 四步规划流程与 MRv2 入口见父参数页
  - to: eplb
    kind: builds-on
    note: 绝对门槛比较的平衡度是 EPLB 峰均比的倒数，重排与搬运代价见 EPLB 页
  - to: load-window-bins-cc21068b082d
    kind: builds-on
    note: 绝对门槛所比较的均衡度基于压缩后的负载窗口计算，因此窗口分段方式影响门槛是否触发。
  - to: ascend-config-system
    kind: builds-on
    note: >-
      该参数通过 AscendConfig 的 JSON 子配置层级解析，能否配置取决于对应版本的 EPLB 配置是否识别
      stair_config；旧版本会拒绝这个未知键。
---
## 它管什么，绝对门槛与相对门槛怎么配合？

`absolute_balance_threshold` 是 [stair_config](stair-config-cca9e594a052.md) 下的浮点参数，为 STAIR（vllm-ascend 为 [Model Runner V2](../concepts/model-runner-v2.md) 编写的动态 [EPLB](../concepts/eplb.md) 专家负载均衡规划算法）设定每一层 MoE 的**绝对滞回门槛**（滞回指用回差门槛防抖，避免轻微负载波动就反复搬运权重）：只要某层当前均衡度跌至本值及以下，就直接放行该层进入本轮重排规划。默认值 `0.90`，合法范围 `0 < 值 ≤ 1`。

均衡度是 [EPLB 峰均比](../concepts/eplb.md#怎么算数配对比峰均换位置)的倒数：先在压缩后的每个时间段算「最忙卡负载 ÷ 各卡平均负载」，按各段样本步数加权平均后再取倒数（完全均匀为 `1`，越不均越小）。默认 `0.90` 换算回峰均比约 `1.11`——按窗口加权平均，最忙卡比各卡均值高出约 11% 时即触发本门槛。

STAIR 靠两道逻辑「或」的门决定本轮重排哪些层：本键盯**现在有多不均**，[relative_balance_threshold](relative-balance-threshold-bcbc40e7dc87.md) 盯**比上次提交时差了多少**，任一满足即放行。一般负载保持默认 `0.90` 即可，仅当某些先天偏斜层始终低于 `0.90` 导致每轮重复触发无用规划时才适度下调。版本边界：`v0.30.0` 与 `main` 已在 MRv2 STAIR 中实际读取该键（须开启 `--enable-eplb` 且最终 `policy == "stair"`，默认已是 `stair`，显式选 `default` 则不消费 `stair_config`）；`v0.23.0`、`v0.26.0rc` 与 GLM 固定镜像 `db701c1f` 均无此键，写入会直接启动报错。

## 事实表

调整 `absolute_balance_threshold` 前，先核对均衡度口径、门控前置顺序与进规划后的裁决条件：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["eplb_config"]["stair_config"]["absolute_balance_threshold"]`（`float = 0.90`） | 默认对应平均峰均比约 `1.11`；需开启 MRv2 EPLB 且走 `stair` 策略 |
| 合法取值 | 有限浮点数且 `0 < 值 ≤ 1`（拒绝布尔值，越界抛 `ValueError`） | 写 `0` 会启动失败；想让绝对门几乎不触发只能写极小正数（单测下边界用 `0.000001`） |
| 门控前置顺序 | 全零窗口跳过 → 非零且无提交锚点（`None`/`NaN`）直接放行 → 相对或绝对门（含 `≤`） | 首轮所有非零负载层均进规划；极小绝对阈值既关不掉相对门，也拦不住无锚点层 |
| 均衡度口径 | 按压缩窗口各段“最忙卡负载 ÷ 各卡均值”做步数加权平均，再取倒数 | 衡量整窗平均状态，段内短时尖峰或最忙卡轮换会被均值摊薄 |
| 进规划不等于搬运 | 候选的平均峰均比或加权 p95 峰均比只要有一项差于现状就剔除，与现状相同也不搬运 | 写 `1` 会拆掉绝对侧滞回让每层每轮重算，但无更优候选时仍不会触发权重拷贝 |

## 为什么仅有相对门槛还不够？

每次 EPLB 重排都要跨卡拷贝专家权重并等待同步（代价见 [EPLB 页代价一节](../concepts/eplb.md#代价多占的显存搬运和等待)），不能随小抖动反复搬运；STAIR 将双门滞回（hysteresis）作为策略固有行为、无法关闭，仅开放两个阈值调节松紧。

**单相对门槛会留下「低锚点停滞盲区」**：假设某层上一轮受 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 或 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md) 等搬运限额所限，落定时的预测平衡度本身就不高（例如只有 `0.85`）。若只有默认 `0.95` 的相对门，要等到它继续跌到 $0.85 \times 0.95 = 0.8075 \approx 0.81$ 才放行，该层就会长期卡在明显不均的状态无人继续逼近最优。

绝对门槛补的正是这个缺口：不管历史锚点是多少，只要当前平衡度在 `0.90` 及以下，每一轮都会放行该层继续尝试改进。

```wiki-diagram
file: param-stair-dual-gate-hysteresis
```

源码注释与 PR #17511 未公开 `0.90` 的标定场景或推导过程；官方特性文档建议一般负载保持 STAIR 默认值，仅在实测需要时再调整。

## 调高调低的边界与放到 GLM 双机

它是一道触发阈值而非开关；以下方向分析由配置校验和规划源码推导，尚无不同阈值下的端到端时延或吞吐实测对照。

- **调高（往 `1` 靠）**：在同一负载窗口和落定锚点下，进入规划的层集合只增不减（当相对门槛尚未触发但当前均衡度落入新阈值内时新增放行，相对门槛早已触发时则保持不变；未来运行中的规划频率仍随实时负载而变，不能仅凭阈值静态推算）。进入规划的层数越多，CPU 上执行副本数搜索与有界回溯 LPT（最长任务优先，即按风险从重到轻优先摆进最轻卡）摆放的开销越高；采纳新摆法后还会触发权重拷贝。写 `1` 是极端情况：均衡度上限就是 `1`，`≤ 1` 恒成立，只要负载窗口非全零，每层每轮都会进入规划，相当于拆掉了绝对侧滞回。
- **调低（往 `0` 靠）**：绝对门槛越来越难触发，最终主要剩相对门槛起作用，上一节所述「受搬运限额所限、落定时均衡度本就不高的层」在未继续退化触发相对门时会持续停留在低均衡状态。由于合法范围不含 `0`，若想近似关闭绝对门只能填极小正数（单测以 `0.000001` 作下边界）。
- **门开了也不一定搬，且筛选与窗口压缩会改变结果**：
  - **双指标筛选与确定性破平局**：候选须同时满足预测平均峰均比与加权 p95 峰均比都不差于现状（加权 p95 将各段峰均比升序排列并按每段样本数累计，取达到总样本数 95% 位置的值，描述分布较差一侧的位置，而非保证最差 5% 的每一步都不退化）。过关后按平均峰均比选优，在内部绝对容差并列时依次比较跨节点迁移数、同节点跨 rank 迁移数及确定性排序键（用于破平局，不是把迁移数直接加进峰均比）；若最终与现状相同仍不搬运。
  - **窗口压缩摊薄效应**：均衡度基于压缩后的至多 [load_window_bins](load-window-bins-cc21068b082d.md) 段计算。若最忙卡在段内不同步轮换，段内平均会抹平差距、使算出的均衡度偏高，从而让本门槛更难打开。
- **放到 GLM 双机部署**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、TP8 / DP2 / EP16）：当前部署[只开 EP、未开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，专家摆放固定不变且走 [model runner v1](../concepts/eplb.md#对照源码)；GLM 固定镜像 `db701c1f` 的 `eplb_config` 不认 `stair_config`，写入启动即报 `Config has no attribute 'stair_config'`。在已接入 MRv2 STAIR 的 `v0.30.0` 与 `main` 上，策略入口与启用条件统一见 [stair_config](stair-config-cca9e594a052.md)。

## 对照源码

下表对照 `stair_config.absolute_balance_threshold` 在四个固定版本快照上的阈值校验、滞回放行与候选筛选：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与范围 | 无（报 `Config has no attribute 'stair_config'`）[C12] | 无 [C13] | `StairConfig.absolute_balance_threshold: float = 0.90`，有限且 `(0, 1]` [C26][C27] | 同左 [C33] | 写 `0` 或布尔值均在建配置时抛 `ValueError` |
| 门控与运行时接入 | — | — | MRv2 controller 接入，`gated_layer_imbalance` 按全零跳过 → 无锚点/`NaN` 放行 → 绝对或相对门控执行 [C29][C31] | 同左（`stair.py` 零 diff） | 早期 `4d1412d1` 未接入服务的限制不适用于 `v0.30.0`/`main` [!] |
| 候选筛选与平局 | — | — | `plan_layer` 按加权 mean + p95 过滤，再按迁移数与确定键破平局 [C28][C30] | 同左 | 放行后仍可能无候选胜出而不搬运 |

- **公式与边界核对**：`v0.30.0` 与 `main` 共用 `stair.py#L348-L377`（`placement_imbalance` 加权 mean 与最近秩 p95，[C28]）、`#L398-L435`（`gated_layer_imbalance`，[C29]）与 `#L1183-L1217`（`plan_layer` 筛选与平局排序，[C30]）；默认 `0.90 ≈ 1.11` 峰均比换算、上次 `0.85` 需跌至 `0.81` 才开相对门、写 `1` 恒触发以及段内轮换平均使均衡度偏高均为公式推导 [D]。
- **官方文档**：`v0.30.0`（`expert_parallelism_load_balancer.md#L437-L468`，[S32]）与 `main`（`#L233-L265`，[S34]）均列出默认 `0.90`、范围 `(0, 1]`，并指出一般负载保持默认即可、单改 `step_interval` 不会绕过滞回门槛 [S10]。
- **待核**：本工作区无 NPU 实机环境，尚无不同 `absolute_balance_threshold` 取值下的实际重排频率与端到端吞吐实测对照。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.absolute_balance_threshold` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |
| releases/v0.30.0 | 有 | `c09d3e20` |

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["absolute_balance_threshold"]` |
| 所属类 | `StairConfig` |
| 类型 | `float` |
| 默认表达式 | `0.9` |
| 定义 | `vllm_ascend/ascend_config.py:219` [C26] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
