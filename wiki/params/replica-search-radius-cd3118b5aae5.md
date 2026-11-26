---
id: replica-search-radius-cd3118b5aae5
title: replica_search_radius
type: param
origin: seed
evidence: C
summary: >-
  STAIR 分阶段副本数搜索中每段的预算试探半径：以贪心分配给该组的额外副本位个数为中心，向少与多两侧各试至多本值个取值并按可行区间裁剪；默认 8，合法范围 0–32，设为 0 只试贪心中心预算（不关闭 EPLB）。v0.30.0 与 main 已接入 MRv2。
aliases:
  - stair_config.replica_search_radius
  - 副本搜索半径
  - STAIR 副本搜索半径
  - STAIR replica search radius
relations:
  - to: replica-search-num-stages-e4b10925ff97
    kind: builds-on
    note: 副本数搜索的完整走法（分组、逐组选择、从现状挪向目标）写在那一页，本页只讲「每次试几个取值」
  - to: stair-config-cca9e594a052
    kind: builds-on
    note: 这是 stair_config 的一个子键；搜索规模的推导、钉点上写了为什么起不来，都在父参数页
  - to: ascend-config-system
    kind: builds-on
    note: >-
      该参数必须嵌在 additional_config.eplb_config.stair_config 中，依赖 AscendConfig
      的分层解析机制；已有关系尚未声明此方向。
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: 2026-11-19T00:00:00.000Z
legacyAnchors:
  一句话: 它管什么每段试哪些预算值
  为什么存在: 为什么要在贪心附近试探与示意走读
  开了的代价: 半径增减的代价边界与放到-glm-双机
sources:
  - >-
    vllm-ascend@8d4409d6256d8a6729140ddcc0d1889e3f96cdd6:vllm_ascend/ascend_config.py#L225
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L210-L211'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L256-L257'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L254-L262'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L278-L303'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L233-L238'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L304-L321'
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L213
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L222
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L223
  - >-
    raw:sha256-acfa23238086d36edf2d39c744d6a86a4f03ff138805956c525353eb009de42f.md#L1-L96
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L224-L259'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L461-L468'
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L1149-L1162
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L45-L59'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L225
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L226
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L223
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L223-L256'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L465-L533'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L1157-L1166'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/eplb.py#L37-L60'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L437-L456'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L230-L263'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L233-L252'
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-65d54946941ea330e074d4e1af21a89adb32a93b429eded382abc0e76d278ed8.md
  - >-
    raw/sha256-7436bca2da55bc360fe67512927c3c9d50eab079a7e874139be1e5a94bbc55ce.md
  - >-
    raw/sha256-acfa23238086d36edf2d39c744d6a86a4f03ff138805956c525353eb009de42f.md
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
---
## 它管什么，每段试哪些预算值？

`replica_search_radius` 是 [stair_config](stair-config-cca9e594a052.md) 下的整数参数，控制 STAIR 分阶段副本数搜索中**每一段围绕贪心预算的试探半径**。每一段要决定「这一组专家一共多拿几个额外副本位」：规划器先看贪心规则会给本组几个，以该中心预算为起点，按距离 `0, 1, ..., radius` 由近到远向少、多两侧各试至多 `replica_search_radius` 个取值，并只保留落在可行区间内的合法预算。

默认 `8`（每状态每段至多试 $2 \times 8 + 1 = 17$ 个取值），合法范围 `0–32`。常规冗余规模（如冗余专家槽位十几个以内）保持默认 `8` 即可覆盖大部分合法预算；设为 `0` 时每段只试贪心中心那一个预算——不会关闭整个 EPLB，目标只剩纯贪心那一个（从现状朝该目标增量挪动途中的中间步仍保留为候选）。副本数搜索的完整走法（分组、评分、增量挪动）统一写在 [replica_search_num_stages](replica-search-num-stages-e4b10925ff97.md#副本数搜索完整走法与手算例子)，本页聚焦每段预算试探与区间裁剪。`v0.30.0` 与 `main` 已在 MRv2 STAIR 中实际读取该参数；`v0.23.0`、`v0.26.0rc` 与 GLM 固定镜像 `db701c1f` 没有 `stair_config`，写入直接启动报错（见 [stair_config](stair-config-cca9e594a052.md)）。

## 事实表

调整 `replica_search_radius` 前，先核对合法预算裁剪区间以及设为 `0` 或超过冗余槽位数时的行为：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["eplb_config"]["stair_config"]["replica_search_radius"]`（`int = 8`） | 每个状态每段至多试探 $2 \times 8 + 1 = 17$ 个预算取值 |
| 合法取值 | 整数 `0–32`（拒绝布尔值，越界抛 `ValueError`） | `0` 合法，表示不向两侧试探，仅保留贪心中心预算 |
| 合法预算区间 | 下限 `= max(0, 待分位置数 - 后续各组可容纳数)`；上限 `= min(待分位置数, 本组可容纳数)` | 保证本段无论取何值，后续各组都能把剩余冗余位分完；越界一侧直接裁剪 |
| 设为 `0` 的效果 | 目标只剩纯贪心一个；从现状挪向它的中间步仍进入候选并按束宽截断 | 阶段数不再带来额外目标，但不关闭 EPLB 物理重排 |
| 半径超过待分位置数 | 合法区间至多含 `待分位置数 + 1` 个整数，再大半径不增加有效展开候选 | 冗余位少的部署中默认 `8` 已覆盖全部合法取值，继续调大只徒增距离循环检查 |

## 为什么要在贪心附近试探，与示意走读

贪心预算只看粗分数（每份副本平均扛多少风险），看不见每卡槽位容量、同卡专家负载共热协方差和搬运上限，因此贪心分出的副本份数未必在最终摆放时最均衡（来龙去脉见 [replica_search_num_stages](replica-search-num-stages-e4b10925ff97.md#副本数搜索完整走法与手算例子)）。`replica_search_radius` 决定「在贪心中心周围看多远」：本组每试一个不同预算，都会联动改变后续各组的贪心补齐结果，从而构造出多样化的副本份数候选。

```wiki-diagram
file: param-stair-replica-search-tree
```

如上图 B 区所示（教学示意，非实测）：假设某段还剩 `6` 个额外副本位待分，贪心分给本组 `4` 个，后续各组容量充足，因此合法区间为 `0–6`：
- **半径 `2`**：由近到远试 `4, 3, 5, 2, 6` 共 `5` 个取值；
- **半径 `8`**：区间两端早已到头，有效预算就是 `0–6` 全部 `7` 个。

所有有效预算展开后统一按粗分数排序再截断到 [replica_search_beam_size](replica-search-beam-size-6556d1650a62.md)，因此「由近到远」的枚举次序不影响最终留下的候选集合，只影响先算出谁。

## 半径增减的代价边界与放到 GLM 双机

以下方向分析基于源码枚举逻辑推导，尚缺相同负载下不同半径的设备耗时与均衡度实测对照。

- **半径越大，CPU 上展开越多**：每状态每段至多展开 `2 × 半径 + 1` 次，每次执行两遍贪心分配；默认 `8` 时为 `17` 次，乘上束宽与阶段数后的总上限（默认值下合计 `1,394` 次）统一推导于 [stair_config](stair-config-cca9e594a052.md#代价通信器回退陷阱与放到-glm-双机)。虽然可行区间会把实际送去展开的预算数截下来（冗余位越少，扩大半径越不会新增有效候选预算），但源码仍会完整遍历 `0..radius` 的所有距离再过滤越界值，不会在覆盖整个区间后提前退出——因此必须区分「距离检查次数」与「实际展开的有效候选数」，有效候选数不变不代表循环检查量完全不变。
- **半径越小，备选越贴近贪心**：设为 `0` 时目标只剩纯贪心那一个，送入摆放的仅是现状、纯贪心目标及从现状挪向它途中的中间份数；此时无论阶段数设多大都换不来其他目标。
- **与束宽的配合**：半径决定每段「生出」多少候选，[replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 决定每段「留下」多少；半径很大而束宽很小时，大部分试出来的取值会被当场淘汰，徒增打分时间。
- **放到 GLM 双机部署**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：当前部署固定镜像 `db701c1f` 没有 `stair_config`，写入直接启动失败（报错见 [stair_config](stair-config-cca9e594a052.md)）。若迁移到已接入 STAIR 的 `v0.30.0`/`main` 并沿用当前零冗余摆法（每卡 18 个专家、无副本位，见 [EP 页](../concepts/expert-parallel.md#16-张卡怎样分专家)），待分额外副本位为 `0`，合法区间只有 `0` 这一个值，半径写多少都只展开这唯一取值。

## 对照源码

下表对照 `stair_config.replica_search_radius` 在四个固定版本快照上的半径校验、区间裁剪与阶段展开消费：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与范围 | 无（无 `stair_config`） | 无 | `StairConfig.replica_search_radius: int = 8`，合法 `0..32` [C18][C19] | 同左 [C24] | 写负数、超 32 或布尔值均在建配置时抛 `ValueError` |
| 枚举与裁剪接入 | — | — | MRv2 controller 接入，`_candidate_group_budgets` 遍历 `0..radius` 并按合法区间过滤，`_expand_replica_search_stage` 仅对有效预算展开 [C20][C21][C22] | 同左（`stair.py` 零 diff） | 区间被覆盖后不会提前退出距离循环，但不会多余展开副本分配 [!] |

- **算法与推演核对**：`v0.30.0` 与 `main` 共用 `stair.py#L465-L533`（`_candidate_group_budgets` 与 `_expand_replica_search_stage`，[C20]）及 `#L1157-L1166`（`plan_layer` 传入 `budget_radius`，[C21]）。写 `0` 只剩贪心目标、半径超过待分位置数不增有效候选、大半径配小束宽徒增打分以及 GLM 零冗余仅试 `0` 均为静态推导 [D]。
- **官方文档**：`v0.30.0`（`expert_parallelism_load_balancer.md#L437-L456`，[S23]）与 `main`（`#L233-L252`，[S25]）均记录默认 `8` 与范围 `0–32`。
- **待核**：本工作区无 NPU 实机环境，尚无不同 `replica_search_radius` 下的规划耗时与峰均比改善实测对照。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.replica_search_radius` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 标识 | `additional_config["eplb_config"]["stair_config"]["replica_search_radius"]` |
| 所属类 | `StairConfig` |
| 类型 | `int` |
| 默认表达式 | `8` |
| 定义 | `vllm_ascend/ascend_config.py:223` [C18] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if not 0 <= self.replica_search_radius <= 32:
    raise ValueError('stair_config.replica_search_radius must be between 0 and 32')
````
