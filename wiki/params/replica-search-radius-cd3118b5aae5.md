---
id: replica-search-radius-cd3118b5aae5
title: replica_search_radius
type: param
origin: seed
evidence: C
summary: >-
  STAIR 副本数搜索每一段的试探范围：以贪心给这一组的额外副本位个数为中心，向两边各试多少个取值；默认 8，合法 0–32，写 0
  时目标只剩贪心那一个。rc2 保留这一含义并已接入 MRV2；历史走读使用早期扫描快照 4d1412d1。
aliases:
  - 副本搜索半径
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
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
updated: 2026-11-03T00:00:00.000Z
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
## 一句话

**v0.30.0rc2 对照。** 默认 8、范围 0–32 不变；以当前组的贪心额外副本预算为中心向两侧试值，并按可行边界裁剪。设为 0 只试中心预算，不会关闭整个 EPLB。与原先扫描快照的区别是 MRV2 STAIR 的逐层规划器已实际传入这个字段；下文“未接入”仅描述旧快照。

`replica_search_radius` 是 [stair_config](stair-config-cca9e594a052.md) 下的一个整数，管 STAIR 副本数搜索里每一段「试几个取值」[C2]。每一段要决定「这一组专家一共多拿几个额外副本位」：先看贪心规则会给这一组几个，以它为中心，向少、多两边各试最多这么多个取值，由近到远 [C4]。默认 8，合法范围 0–32。写 0 时每段只试贪心那一个数，搜出来的目标只剩纯贪心那一个，从现状挪向它途中的中间步仍是候选 [D]。

副本数搜索的完整走法——专家怎么分组、每段怎么打分、最后怎么从现状挪过去——只写在 [replica_search_num_stages 的「为什么存在」](replica-search-num-stages-e4b10925ff97.md#为什么存在)，本页不重复。

**旧版本与 GLM 范围**：v0.23、GLM 镜像、v0.26、固定 main baa023ad 没有此键，写入会启动报错。下文算法走读按后来的 main 提交 4d1412d1，早期扫描还用过 8d4409d6，当时规划器尚未接入服务。当前参数定义取 rc2，谱系 main 仍是 baa023ad、rc2 单列，启用条件见 [stair_config](stair-config-cca9e594a052.md#一句话)。GLM 双机没开 EPLB且零冗余，这个键在那里不起作用（见「开了的代价」）。

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

## 事实表

| 项 | main 提交 4d1412d1 上的值或行为 | 意味着什么 |
|---|---|---|
| 完整路径 | `additional_config["eplb_config"]["stair_config"]["replica_search_radius"]` | 只能嵌在 `stair_config` 里 |
| 旧钉点上是否存在 | v0.23、GLM 镜像、v0.26、main baa023ad 都没有 | rc2 已有并接入服务；旧版报错见 [stair_config 事实表](stair-config-cca9e594a052.md#事实表) |
| 类型 / 默认值 | `int`，8 | 每个状态每段最多试 17 个取值 |
| 合法取值 | 0–32；越界报 `stair_config.replica_search_radius must be between 0 and 32` [C3]；写 `true` 报 `STAIR numeric fields must not be booleans` [C6] | 0 合法，表示不试探 |
| 试哪些取值 | 中心、中心 ± 1、……、中心 ± 半径，只留落在合法区间里的 [C4] | 区间外的一侧直接没了，实际个数常常不到 2 × 半径 + 1 |
| 合法区间 | 下限 = 待分位置数 − 后面各组还能收的位置数（不小于 0）；上限 = 待分位置数与本组还能收的位置数中较小的那个 [C5] | 保证本段怎么选，后面各组都还能把剩下的位置分完 |
| 写 0 时 | 每个状态每段只产出贪心那一个取值，目标只剩贪心那一个；从现状挪向它途中的中间步仍是候选，再按束宽截断 [D] | 阶段数不再带来别的目标；搬运上限把挪动步数截短时可能走不到目标，被摆的就是这些中间份数 |
| 写得比待分位置数还大 | 合法区间本身最多只有「待分位置数 + 1」个整数，再大的半径不会多试 [D] | 冗余位少的部署，默认 8 很可能已经覆盖全部可能 |
| 扫描与走读提交 | 历史扫描 8d4409d6 的 `StairConfig` 与 4d1412d1 相同；当前自动参数定义改取 rc2 | 自动区是 rc2 静态定义，历史算法例子仍有明确旧范围，均不代表固定 main baa023ad |

## 为什么存在

贪心给出的「这一组拿几个」只依据一个粗略分数（每份副本平均扛多少风险），后面真正的摆放还要受每卡位置数、同卡专家负载一起涨落、搬运上限的约束，贪心的那个数不一定摆得最好（这一点的来龙去脉见 [num_stages 页](replica-search-num-stages-e4b10925ff97.md#为什么存在)）。半径就是「在贪心附近看多远」：试出来的每个取值，都会让后面各组的贪心补齐跟着变，从而产生一个不同的候选份数 [C5]。

一个示意（数为示意）：某一段还有 6 个额外副本位待分，贪心给了这一组 4 个，后面各组能收的位置足够多，所以合法区间是 0–6。半径 2 时试 4、3、5、2、6 这 5 个取值；半径 8 时区间两端早就到头，试的是 0–6 全部 7 个。

试出来的所有取值统一按分数排序后再截到束宽，所以「由近到远」的枚举顺序不影响结果，只影响谁先被算出来 [C7]。

## 开了的代价

rc2已接入运行时；下面说明半径对搜索范围的影响，尚缺相同负载下不同半径的设备对照。

**半径越大，CPU 上算得越多。** 每个状态每段最多展开 2 × 半径 + 1 次，每次两遍贪心分配；默认 8 时是 17 次，乘上束宽和段数后的总量（默认值下合计 1,394 次展开）只在 [stair_config 的代价一节](stair-config-cca9e594a052.md#开了的代价) 推导 [D]。但合法区间会把实际个数截下来，冗余位越少，加大半径越不起作用。

这里的“不起作用”指不再增加有效候选预算。合法区间已被覆盖后，继续扩大半径，枚举循环仍会检查更远的距离；有效候选数不变，不代表循环检查量也不变。

**半径越小，备选越贴近贪心。** 写 0 时目标只剩贪心那一个，进入摆放的是现状、这个目标，以及从现状挪向它途中的中间份数；阶段数设多大都换不来别的目标 [D]。

**和束宽的关系**：半径决定每段「生出」多少状态，束宽决定每段「留下」多少。半径大而束宽小，大部分试出来的取值会被当场丢掉，只多花了打分的时间 [D]。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：在这套部署用的镜像 db701c1f 上，写这个键就是启动失败（原文见 [stair_config 的「一句话」](stair-config-cca9e594a052.md#一句话)）。假如换到已接入 STAIR 的 main，而摆法沿用现在的零冗余（每卡 18 个专家、没有副本位，见 [EP 页的 16 张卡怎样分专家](../concepts/expert-parallel.md#16-张卡怎样分专家)），待分的额外副本位是 0，合法区间只有 0 这一个数，半径写多少都只试这一个 [D]。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.replica_search_radius` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |
| releases/v0.30.0 | 有 | `c09d3e20` |

## 对照源码

### 源码位置

实际核读来源 4 的 `4d1412d1` 实现：258–260 行遍历从 0 到半径的所有距离，再过滤不在合法区间的预算，没有在覆盖整个区间后提前退出。来源 5 的 291–303 行只对过滤后预算做副本分配；因此要区分距离检查次数与真正展开的候选数。此处没有据此给出实际耗时增幅。
