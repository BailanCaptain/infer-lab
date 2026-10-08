---
id: replica-search-radius-cd3118b5aae5
title: replica_search_radius
type: param
origin: seed
evidence: C
summary: >-
  STAIR 副本数搜索每一段的试探范围：以贪心给这一组的额外副本位个数为中心，向两边各试多少个取值；默认 8，合法 0–32，写 0 时目标只剩贪心那一个。知识库钉住的四个版本都没有这个键，行为按 main 提交 4d1412d1 写。
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
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
updated: '2026-10-04'
sources:
  - >-
    vllm-ascend@8d4409d6256d8a6729140ddcc0d1889e3f96cdd6:vllm_ascend/ascend_config.py#L225
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L210-L211'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L256-L257'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L254-L262'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L278-L303'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L233-L238'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L304-L321'
rawSources:
  - >-
    raw/sha256-7436bca2da55bc360fe67512927c3c9d50eab079a7e874139be1e5a94bbc55ce.md
---
## 一句话

`replica_search_radius` 是 [stair_config](stair-config-cca9e594a052.md) 下的一个整数，管 STAIR 副本数搜索里每一段「试几个取值」[C2]。每一段要决定「这一组专家一共多拿几个额外副本位」：先看贪心规则会给这一组几个，以它为中心，向少、多两边各试最多这么多个取值，由近到远 [C4]。默认 8，合法范围 0–32。写 0 时每段只试贪心那一个数，搜出来的目标只剩纯贪心那一个，从现状挪向它途中的中间步仍是候选 [D]。

副本数搜索的完整走法——专家怎么分组、每段怎么打分、最后怎么从现状挪过去——只写在 [replica_search_num_stages 的「为什么存在」](replica-search-num-stages-e4b10925ff97.md#为什么存在)，本页不重复。

**存在范围与 GLM 结论**跟父参数一样：知识库钉住的 v0.23、GLM 镜像、v0.26、main 四个版本都没有这个键，写上就启动报错；本页行为按 main 提交 4d1412d1 写；页底「参数定义」记的扫描提交是 8d4409d6，两者都在钉点 baa023ad 之后、都不是钉点（「版本谱系」里 main 一行写「有」，指的也是钉点之后的 origin/main），那一版的 STAIR 还没接进运行时，详见 [stair_config 的「一句话」](stair-config-cca9e594a052.md#一句话)。GLM 双机这套部署没开 EPLB，而且是零冗余，这个键在那里不起作用（见下面「开了的代价」末尾）。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["replica_search_radius"]` |
| 类型 | `int` |
| 默认表达式 | `8` |
| 定义 | `vllm_ascend/ascend_config.py:225` [C1] |
| 版本 | main · 8d4409d6256d8a6729140ddcc0d1889e3f96cdd6 |

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
| 钉点上是否存在 | v0.23、GLM 镜像、v0.26、main 钉点 baa023ad 都没有 | 页底「版本谱系」的 main 行写「有」，指钉点之后的 origin/main；版本细节与报错见 [stair_config 事实表](stair-config-cca9e594a052.md#事实表) |
| 类型 / 默认值 | `int`，8 | 每个状态每段最多试 17 个取值 |
| 合法取值 | 0–32；越界报 `stair_config.replica_search_radius must be between 0 and 32` [C3]；写 `true` 报 `STAIR numeric fields must not be booleans` [C6] | 0 合法，表示不试探 |
| 试哪些取值 | 中心、中心 ± 1、……、中心 ± 半径，只留落在合法区间里的 [C4] | 区间外的一侧直接没了，实际个数常常不到 2 × 半径 + 1 |
| 合法区间 | 下限 = 待分位置数 − 后面各组还能收的位置数（不小于 0）；上限 = 待分位置数与本组还能收的位置数中较小的那个 [C5] | 保证本段怎么选，后面各组都还能把剩下的位置分完 |
| 写 0 时 | 每个状态每段只产出贪心那一个取值，目标只剩贪心那一个；从现状挪向它途中的中间步仍是候选，再按束宽截断 [D] | 阶段数不再带来别的目标；搬运上限把挪动步数截短时可能走不到目标，被摆的就是这些中间份数 |
| 写得比待分位置数还大 | 合法区间本身最多只有「待分位置数 + 1」个整数，再大的半径不会多试 [D] | 冗余位少的部署，默认 8 很可能已经覆盖全部可能 |
| 页底「参数定义」的提交 | 记的是 8d4409d6（2026-09-27），`StairConfig` 一段与 4d1412d1 逐行相同；两者都在钉点 baa023ad 之后，都不是钉点 | 自动区与本页正文口径一致，都不代表钉住的 main |

## 为什么存在

贪心给出的「这一组拿几个」只依据一个粗略分数（每份副本平均扛多少风险），后面真正的摆放还要受每卡位置数、同卡专家负载一起涨落、搬运上限的约束，贪心的那个数不一定摆得最好（这一点的来龙去脉见 [num_stages 页](replica-search-num-stages-e4b10925ff97.md#为什么存在)）。半径就是「在贪心附近看多远」：试出来的每个取值，都会让后面各组的贪心补齐跟着变，从而产生一个不同的候选份数 [C5]。

一个示意（数为示意）：某一段还有 6 个额外副本位待分，贪心给了这一组 4 个，后面各组能收的位置足够多，所以合法区间是 0–6。半径 2 时试 4、3、5、2、6 这 5 个取值；半径 8 时区间两端早就到头，试的是 0–6 全部 7 个。

试出来的所有取值统一按分数排序后再截到束宽，所以「由近到远」的枚举顺序不影响结果，只影响谁先被算出来 [C7]。

## 开了的代价

本页没有实测数：钉点上没有这个特性，上游也没有公开不同半径的对照。下面是从源码推出来的行为。

**半径越大，CPU 上算得越多。** 每个状态每段最多展开 2 × 半径 + 1 次，每次两遍贪心分配；默认 8 时是 17 次，乘上束宽和段数后的总量（默认值下合计 1,394 次展开）只在 [stair_config 的代价一节](stair-config-cca9e594a052.md#开了的代价) 推导 [D]。但合法区间会把实际个数截下来，冗余位越少，加大半径越不起作用。

**半径越小，备选越贴近贪心。** 写 0 时目标只剩贪心那一个，进入摆放的是现状、这个目标，以及从现状挪向它途中的中间份数；阶段数设多大都换不来别的目标 [D]。

**和束宽的关系**：半径决定每段「生出」多少状态，束宽决定每段「留下」多少。半径大而束宽小，大部分试出来的取值会被当场丢掉，只多花了打分的时间 [D]。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：在这套部署用的镜像 db701c1f 上，写这个键就是启动失败（原文见 [stair_config 的「一句话」](stair-config-cca9e594a052.md#一句话)）。假如换到已接入 STAIR 的 main，而摆法沿用现在的零冗余（每卡 18 个专家、没有副本位，见 [EP 页的 16 张卡怎样分专家](../concepts/expert-parallel.md#16-张卡怎样分专家)），待分的额外副本位是 0，合法区间只有 0 这一个数，半径写多少都只试这一个 [D]。

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
