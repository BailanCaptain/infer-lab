---
id: replica-search-num-stages-e4b10925ff97
title: replica_search_num_stages
type: param
origin: seed
evidence: C
summary: >-
  STAIR 搜「每个专家放几份副本」时分几段做决定：专家按风险从高到低切成这么多组，前面每组各选一次「这组多拿几个副本位」，最后一组贪心补齐；默认 4，合法 1–8，写 1 时目标只剩贪心那一个。知识库钉住的四个版本都没有这个键，行为按 main 提交 4d1412d1 写。
aliases:
  - 副本搜索阶段数
  - STAIR replica search stages
relations:
  - to: stair-config-cca9e594a052
    kind: builds-on
    note: 这是 stair_config 的一个子键；STAIR 一轮规划的四步、搜索规模的推导、钉点上写了为什么起不来，都在父参数页
  - to: eplb
    kind: builds-on
    note: 冗余副本是什么、为什么热门专家要多放一份，在 EPLB 页
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
updated: '2026-10-04'
sources:
  - >-
    vllm-ascend@8d4409d6256d8a6729140ddcc0d1889e3f96cdd6:vllm_ascend/ascend_config.py#L224
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L208-L209'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L254-L255'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L227-L252'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L264-L321'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L355-L388'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L390-L432'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L924-L947'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L233-L238'
rawSources:
  - >-
    raw/sha256-7436bca2da55bc360fe67512927c3c9d50eab079a7e874139be1e5a94bbc55ce.md
---
## 一句话

`replica_search_num_stages` 是 [stair_config](stair-config-cca9e594a052.md) 下的一个整数，管 STAIR 规划里「每个专家该放几份副本」这一步分几段来做决定 [C2]。专家先按风险（负载均值加上若干倍波动）从高到低排好，切成这么多组；前面每一组各做一次选择——这一组一共多拿几个副本位——最后一组按贪心规则补齐剩下的位置 [C6]。默认 4，合法范围 1–8。写 1 时一次选择都不做，搜出来的目标只剩纯贪心那一个，从现状挪向它途中的中间步仍是候选 [D]。

副本是什么、为什么热门专家要多放一份，见 [EPLB 页](../concepts/eplb.md#最热的专家怎么办多放一份副本)。整个副本数搜索怎么走，本页「为什么存在」一节是唯一的完整说明，[replica_search_radius](replica-search-radius-cd3118b5aae5.md) 与 [replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 两页都链回这里。

**存在范围与 GLM 结论**跟父参数一样：知识库钉住的 v0.23、GLM 镜像、v0.26、main 四个版本都没有这个键，写上就启动报错；本页行为按 main 提交 4d1412d1 写；页底「参数定义」记的扫描提交是 8d4409d6，两者都在钉点 baa023ad 之后、都不是钉点（「版本谱系」里 main 一行写「有」，指的也是钉点之后的 origin/main），那一版的 STAIR 还没接进运行时，详见 [stair_config 的「一句话」](stair-config-cca9e594a052.md#一句话)。GLM 双机这套部署没开 EPLB，而且是零冗余，就算换到新版 main，这个键也不起作用（见下面「开了的代价」末尾）。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["replica_search_num_stages"]` |
| 类型 | `int` |
| 默认表达式 | `4` |
| 定义 | `vllm_ascend/ascend_config.py:224` [C1] |
| 版本 | main · 8d4409d6256d8a6729140ddcc0d1889e3f96cdd6 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if not 1 <= self.replica_search_num_stages <= 8:
    raise ValueError('stair_config.replica_search_num_stages must be between 1 and 8')
````

## 事实表

| 项 | main 提交 4d1412d1 上的值或行为 | 意味着什么 |
|---|---|---|
| 完整路径 | `additional_config["eplb_config"]["stair_config"]["replica_search_num_stages"]` | 只能嵌在 `stair_config` 里 |
| 钉点上是否存在 | v0.23、GLM 镜像、v0.26、main 钉点 baa023ad 都没有 | 页底「版本谱系」的 main 行写「有」，指钉点之后的 origin/main；版本细节与报错见 [stair_config 事实表](stair-config-cca9e594a052.md#事实表) |
| 类型 / 默认值 | `int`，4 | 前 3 组各选一次，第 4 组贪心补齐 |
| 合法取值 | 1–8；越界报 `stair_config.replica_search_num_stages must be between 1 and 8` [C3]；写 `true` 报 `STAIR numeric fields must not be booleans` [C9] | 最多 8 段 |
| 怎么分组 | 按风险从高到低排序后切成 min(本值, 专家数) 组，组大小尽量相等，除不尽时前面的组多 1 个 [C6] | 一组里的专家风险相近 |
| 写 1 时 | 不做任何选择，只产出贪心那一个目标 [D] | 搜索半径不再起作用，束宽只剩截断候选数的作用 |
| 和另两个键的分工 | 本键定「做几次选择」；半径定「每次试几个取值」；束宽定「每次留几个往下走」[C5] | 三者一起决定搜索规模 |
| 页底「参数定义」的提交 | 记的是 8d4409d6（2026-09-27），`StairConfig` 一段与 4d1412d1 逐行相同；两者都在钉点 baa023ad 之后，都不是钉点 | 自动区与本页正文口径一致，都不代表钉住的 main |

## 为什么存在

STAIR 要先定「每个专家放几份」，再定「每份放在哪张卡」。前一步有一个现成的快办法——**贪心**：每个专家先放 1 份，然后把多出来的副本位一个个发出去，每次发给「风险 ÷ 已有份数」最大的那个专家，单个专家的份数不超过卡数 [C4]。贪心看的分数只是「每份副本平均扛多少风险」，它不知道这些副本最后要塞进每张卡固定数目的位置、不知道同卡专家的负载会一起涨落（协方差）、也不知道每轮搬运有上限。所以只拿贪心这一个答案去摆，可能错过「份数稍微不同、但摆起来更均匀」的方案 [I]。副本数搜索就是在贪心附近多留几个备选，交给后面真正的摆放去比。

**副本数搜索怎么走**（4d1412d1 的 `replica_candidates` 与 `incremental_replica_candidates`）：

1. **起点**：每个专家 1 份，多出来的位置（总位置数 − 专家数）是待分的额外副本位 [C6]。
2. **分组**：专家按风险从高到低排好，切成本键这么多组。
3. **逐组选择**：对前面每一组，先用贪心把所有待分的位置分一遍，看贪心给了这一组几个，以这个数为中心，向两边各试 [replica_search_radius](replica-search-radius-cd3118b5aae5.md) 个取值；每个取值都先在本组内贪心分，再用贪心把后面各组补齐，按「补齐后每份副本扛的最大风险」打分，只留 [replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 个最好的状态进入下一组 [C5]。
4. **收尾**：最后一组用贪心补齐，得到至多「束宽」个目标份数 [C6]。
5. **从现状出发**：从当前的份数朝每个目标一份一份地挪——每一步一个专家加 1 份、另一个减 1 份，步数受每卡搬运上限约束——途中每一步都算一个候选；按同一个分数排序后留「束宽」个，并保证「份数不变」这个选项一定在里面 [C7]。
6. **交给摆放**：每个候选各跑一次带约束的摆放，算出真实的预测峰均比，再按父参数页说的那道关挑最好的 [C8]。

**一个手算例子**（数为示意）：6 个专家、4 张卡、每卡 2 个位置，共 8 个位置，所以有 2 个额外副本位；风险依次是 E0 10、E1 8、E2 4、E3 3、E4 2、E5 1；分 2 段、半径 1、束宽取默认。

- 第 2 步分组：前一组 E0–E2，后一组 E3–E5。
- 第 3 步（只有前一组要选）：贪心先把 2 个位置分一遍——第一个给「风险 ÷ 份数」最大的 E0（10 ÷ 1），E0 变成 2 份、每份 5；第二个给此时最大的 E1（8 ÷ 1）——所以贪心给前一组 2 个，中心是 2。半径 1 要试 1、2、3，但待分的只有 2 个，3 被合法区间截掉。取 2：E0、E1 各 2 份，补齐后每份风险最大是 5（E0 的 10 ÷ 2）。取 1：前一组只给 E0，剩下 1 个由后一组贪心拿走、给了 E3，补齐后最大是 E1 的 8 ÷ 1 = 8。
- 第 4 步：两个状态各自补齐，得到两个目标——「E0、E1 各 2 份，其余 1 份」（分数 5）和「E0、E3 各 2 份，其余 1 份」（分数 8）。

按粗分数，第一个目标明显更好，它就是纯贪心的答案；第二个也被留下，是为了第 6 步真正摆到卡上时多一个备选——位置数、同卡专家一起涨落、搬运上限这些约束，粗分数都看不见 [I]。

分段的意义在第 3 步：风险最高的那一组先定份数，后面每组都是在前面已经定下的基础上再选，每一段的选择都会改变后面贪心补齐的结果。段数越多，可选的组合越细；段数为 1 时没有第 3 步，只剩贪心那一个目标 [D]。

## 开了的代价

本页没有实测数：钉点上没有这个特性，上游也没有公开不同段数的对照。下面是从源码推出来的行为。

**段数越多，CPU 上算得越多。** 每多一段就多一次第 3 步，每次最多展开「束宽 × (2 × 半径 + 1)」个状态，每个展开要做两遍贪心分配 [D]。默认值下三次展开的上限合计 1,394 次，这个数的推导只写在 [stair_config 的代价一节](stair-config-cca9e594a052.md#开了的代价)。注意第一段只从 1 个状态起步，所以段数从 1 加到 2 时增加的量最少，之后每段都可能顶到上限 [D]。

**段数少，备选就少。** 写 1 时只剩贪心目标，以及从现状挪向它途中的那些中间步；如果贪心的份数摆起来并不理想，规划器就没有别的份数可试 [D]。

**段数大于专家数时按专家数截**，不会报错，也不会多算 [C6]。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：在这套部署用的镜像 db701c1f 上，写这个键就是启动失败（原文见 [stair_config 的「一句话」](stair-config-cca9e594a052.md#一句话)）。假如换到已接入 STAIR 的 main，而摆法沿用现在的零冗余（每卡 18 个专家、没有副本位，见 [EP 页的 16 张卡怎样分专家](../concepts/expert-parallel.md#16-张卡怎样分专家)），第 1 步的额外副本位就是 0，每一段都只有「这一组拿 0 个」这一种选择，搜出来的只有「每个专家 1 份」，段数写多少都一样 [D]。要让它起作用，先得配冗余副本位；冗余数必须让每卡位置数除得尽，这条规则见 [EPLB 页的副本一节](../concepts/eplb.md#最热的专家怎么办多放一份副本)。

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
