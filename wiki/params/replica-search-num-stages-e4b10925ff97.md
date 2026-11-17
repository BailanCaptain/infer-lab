---
id: replica-search-num-stages-e4b10925ff97
title: replica_search_num_stages
type: param
origin: seed
evidence: C
summary: >-
  STAIR 搜「每个专家放几份副本」时分几段做决定：专家按风险从高到低切成这么多组，前面每组各选一次「这组多拿几个副本位」，最后一组贪心补齐；默认 4，合法
  1–8，写 1 时目标只剩贪心那一个。rc2 保留这一含义并已接入 MRV2；历史走读使用早期扫描快照 4d1412d1。
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
  - to: ascend-config-system
    kind: builds-on
    note: 该参数通过 AscendConfig 的嵌套子配置输入，正确层级及对应版本是否识别该键是配置生效的前提。
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
updated: 2026-11-03T00:00:00.000Z
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
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L212
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L221
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L222
  - >-
    raw:sha256-bf9ac72e1f9b1d351d9fcc8cb8e4593a532825870ac37d990d5ae3720160a440.md#L1-L234
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L360-L362
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L224-L255'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L567-L594'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L45-L59'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L224
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L225
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L222
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-7436bca2da55bc360fe67512927c3c9d50eab079a7e874139be1e5a94bbc55ce.md
  - >-
    raw/sha256-89407265de5b7c0826e8ae0a890841ce901f8058bdc7891b86d06dece485e079.md
  - >-
    raw/sha256-bf9ac72e1f9b1d351d9fcc8cb8e4593a532825870ac37d990d5ae3720160a440.md
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

**v0.30.0rc2 对照。** 默认 4、范围 1–8 与旧扫描一致，MRV2 STAIR 已接入实际运行。分组对象仍是按风险排序的专家，实际组数取配置值与专家数的较小者；最后一组用贪心补足剩余副本槽。设为 1 会直接进入这最后一组，不再执行前面的分组扩展，不能解释成把模型层或流水线分成一段。

`replica_search_num_stages` 是 [stair_config](stair-config-cca9e594a052.md) 下的一个整数，管 STAIR 规划里「每个专家该放几份副本」这一步分几段来做决定 [C2]。专家先按风险（负载均值加上若干倍波动）从高到低排好，切成这么多组；前面每一组各做一次选择——这一组一共多拿几个副本位——最后一组按贪心规则补齐剩下的位置 [C6]。默认 4，合法范围 1–8。写 1 时一次选择都不做，搜出来的目标只剩纯贪心那一个，从现状挪向它途中的中间步仍是候选 [D]。

副本是什么、为什么热门专家要多放一份，见 [EPLB 页](../concepts/eplb.md#最热的专家怎么办多放一份副本)。整个副本数搜索怎么走，本页「为什么存在」一节是唯一的完整说明，[replica_search_radius](replica-search-radius-cd3118b5aae5.md) 与 [replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 两页都链回这里。

**旧版本与 GLM 范围**：v0.23、GLM 镜像、v0.26、固定 main baa023ad 没有此键，写入会启动报错。下文算法走读按后来的 main 提交 4d1412d1，早期扫描还用过 8d4409d6，当时规划器尚未接入服务。当前参数定义取 rc2，谱系 main 仍是 baa023ad、rc2 单列，启用条件见 [stair_config](stair-config-cca9e594a052.md#一句话)。GLM 双机没开 EPLB且零冗余；保持零冗余时换用新版也不会靠此键增加副本，见「开了的代价」。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["replica_search_num_stages"]` |
| 所属类 | `StairConfig` |
| 类型 | `int` |
| 默认表达式 | `4` |
| 定义 | `vllm_ascend/ascend_config.py:222` [C20] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

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
| 旧钉点上是否存在 | v0.23、GLM 镜像、v0.26、main baa023ad 都没有 | rc2 已有并接入服务；旧版报错见 [stair_config 事实表](stair-config-cca9e594a052.md#事实表) |
| 类型 / 默认值 | `int`，4 | 前 3 组各选一次，第 4 组贪心补齐 |
| 合法取值 | 1–8；越界报 `stair_config.replica_search_num_stages must be between 1 and 8` [C3]；写 `true` 报 `STAIR numeric fields must not be booleans` [C9] | 最多 8 段 |
| 怎么分组 | 按风险从高到低排序后切成 min(本值, 专家数) 组，组大小尽量相等，除不尽时前面的组多 1 个 [C6] | 一组里的专家风险相近 |
| 写 1 时 | 不做任何选择，只产出贪心那一个目标 [D] | 搜索半径不再起作用，束宽只剩截断候选数的作用 |
| 和另两个键的分工 | 本键定「做几次选择」；半径定「每次试几个取值」；束宽定「每次留几个往下走」[C5] | 三者一起决定搜索规模 |
| 页底「参数定义」的提交 | 当前取 rc2 `7d825229`；历史扫描曾取 8d4409d6，算法走读取 4d1412d1 | 三个快照都不代表固定 main baa023ad；当前定义与历史走读分别核对 |

## 为什么存在

STAIR 要先定「每个专家放几份」，再定「每份放在哪张卡」。前一步有一个现成的快办法——**贪心**：每个专家先放 1 份，然后把多出来的副本位一个个发出去，每次发给「风险 ÷ 已有份数」最大的那个专家，单个专家的份数不超过卡数 [C4]。贪心看的分数只是「每份副本平均扛多少风险」，它不知道这些副本最后要塞进每张卡固定数目的位置、不知道同卡专家的负载会一起涨落（协方差）、也不知道每轮搬运有上限。所以只拿贪心这一个答案去摆，可能错过「份数稍微不同、但摆起来更均匀」的方案 [I]。副本数搜索就是在贪心附近多留几个备选，交给后面真正的摆放去比。

**副本数搜索怎么走**（4d1412d1 的 `replica_candidates` 与 `incremental_replica_candidates`）：

1. **起点**：每个专家 1 份，多出来的位置（总位置数 − 专家数）是待分的额外副本位 [C6]。

   搜索函数要求总位置数不能少于专家数，不能超过专家数乘执行设备数，并且必须能被执行设备数整除。这些条件分别让每个专家至少有一份、不突破单专家副本上限，以及各设备具有相等的位置容量。
2. **分组**：专家按风险从高到低排好，切成本键这么多组。

专家风险相同时，排序用专家编号升序打破并列，再按实际阶段数分组。这样，同一组风险输入的分组顺序保持确定，不依赖原数组遍历碰巧先看到哪个同分专家。

3. **逐组选择**：对前面每一组，先用贪心把所有待分的位置分一遍，看贪心给了这一组几个，以这个数为中心，向两边各试 [replica_search_radius](replica-search-radius-cd3118b5aae5.md) 个取值；每个取值都先在本组内贪心分，再用贪心把后面各组补齐，按「补齐后每份副本扛的最大风险」打分，只留 [replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 个最好的状态进入下一组 [C5]。
   进入下一组时，固定的是本组及此前各组已确定的份数，以及尚未分配的位置数；为了评分而对后续组做的贪心补齐尚未固定，后续组仍会继续选择预算。筛选过程还会去重，因此实际保留的状态数可能少于束宽。

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

rc2已接入运行时；下面说明阶段数对搜索的影响，尚缺相同负载下不同阶段数的设备对照。

**段数越多，CPU 上算得越多。** 每多一段就多一次第 3 步，每次最多展开「束宽 × (2 × 半径 + 1)」个状态，每个展开要做两遍贪心分配 [D]。默认值下三次展开的上限合计 1,394 次，这个数的推导只写在 [stair_config 的代价一节](stair-config-cca9e594a052.md#开了的代价)。注意第一段只从 1 个状态起步，所以段数从 1 加到 2 时增加的量最少，之后每段都可能顶到上限 [D]。

**段数少，备选就少。** 写 1 时只剩贪心目标，以及从现状挪向它途中的那些中间步；如果贪心的份数摆起来并不理想，规划器就没有别的份数可试 [D]。

**段数大于专家数时按专家数截**，不会报错，也不会多算 [C6]。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：在这套部署用的镜像 db701c1f 上，写这个键就是启动失败（原文见 [stair_config 的「一句话」](stair-config-cca9e594a052.md#一句话)）。假如换到已接入 STAIR 的 main，而摆法沿用现在的零冗余（每卡 18 个专家、没有副本位，见 [EP 页的 16 张卡怎样分专家](../concepts/expert-parallel.md#16-张卡怎样分专家)），第 1 步的额外副本位就是 0，每一段都只有「这一组拿 0 个」这一种选择，搜出来的只有「每个专家 1 份」，段数写多少都一样 [D]。要让它起作用，先得配冗余副本位；冗余数必须让每卡位置数除得尽，这条规则见 [EPLB 页的副本一节](../concepts/eplb.md#最热的专家怎么办多放一份副本)。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.replica_search_num_stages` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |
| releases/v0.30.0 | 有 | `c09d3e20` |

## 对照源码

### 源码位置

实际核读 `4d1412d1`：来源 6 的 355–356 行检查总位置数的上下界及可整除条件，363 行以每专家一份开始；来源 5 的 304–320 行把部分份数、剩余位置及评分用的完整补齐分开存储，按部分份数去重，评分后只把部分份数和剩余位置传入下一阶段。因此后面各组的临时贪心补齐不会提前固化为最终选择。

- 来源 14：vllm-ascend@4d1412d1，vllm_ascend/distributed/eplb/policy/stair.py，L360–L362。
