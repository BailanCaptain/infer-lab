---
id: replica-search-beam-size-6556d1650a62
title: replica_search_beam_size
type: param
origin: seed
evidence: C
summary: >-
  STAIR 副本数搜索的束宽：每一段只留这么多个最好的候选往下走，最终至多这么多组副本份数进入带约束的摆放；默认 64，合法 1–128。写 1
  时唯一的候选会被换成「份数不变」，副本数不调。rc2 保留这一含义并已接入 MRV2；历史走读使用早期扫描快照 4d1412d1。
aliases:
  - 副本搜索束宽
  - STAIR replica search beam size
relations:
  - to: replica-search-num-stages-e4b10925ff97
    kind: builds-on
    note: 副本数搜索的完整走法（分组、逐组选择、从现状挪向目标）写在那一页，本页只讲「每次留几个」
  - to: stair-config-cca9e594a052
    kind: builds-on
    note: 这是 stair_config 的一个子键；搜索规模的推导、钉点上写了为什么起不来，都在父参数页
  - to: ascend-config-system
    kind: builds-on
    note: 该参数嵌套在 AscendConfig 的 EPLB 子配置中；钉住版本不认识此键时启动失败，依赖 EPLB 子配置拒绝未知键的校验机制。
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
updated: 2026-11-03T00:00:00.000Z
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L226
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L212-L213'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L258-L259'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L304-L321'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L374-L388'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L413-L431'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L933-L949'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L233-L238'
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L214
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L223
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L224
  - >-
    raw:sha256-1d6fe088dcd10aa7626a3a782ceb0191cf38e491409a789f990536dce044c9f3.md#L1-L115
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L224-L261'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L514-L528'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L620-L638'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L45-L59'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L226
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L227
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-1d6fe088dcd10aa7626a3a782ceb0191cf38e491409a789f990536dce044c9f3.md
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
  - >-
    raw/sha256-f9720e44c7545e407e6d4299d83ed92cfd0a1302a950457cf6ae48bb064a50ae.md
---
## 一句话

**v0.30.0rc2 对照。** 默认 64、范围 1–128 不变，MRV2 STAIR 已把它传给实际副本搜索。每段筛选仍最多保留这个数量，最终候选还强制保留当前副本数，因此设为 1 时留下的是当前副本数候选。这限制的是“每个专家有几份”的搜索，不足以证明后续物理摆放绝对不变。旧页所述未接入状态只限原先扫描提交。

`replica_search_beam_size` 是 [stair_config](stair-config-cca9e594a052.md) 下的一个整数，管 STAIR 副本数搜索「每次留几个」[C2]。束宽（beam size）是束搜索的说法：每走一步都会生出很多候选，只按分数留最好的若干个往下走，其余当场丢掉。在 STAIR 里它卡三处：每一段展开后留几个状态 [C4]，最后产出几个目标份数 [C5]，以及从现状挪向目标之后、真正进入带约束摆放的候选有几个 [C6]。默认 64，合法范围 1–128。

第三处最直接：带约束的摆放对每个候选各跑一次 [C7]，所以束宽就是「每层每轮最多摆几次」。每次摆放都要逐份副本更新协方差、可能还要回退，按代码结构看它很可能比副本数搜索更重，但没有测过耗时，**待核** [I]。副本数搜索的完整走法只写在 [replica_search_num_stages 的「为什么存在」](replica-search-num-stages-e4b10925ff97.md#为什么存在)，本页不重复。

**旧版本与 GLM 范围**：v0.23、GLM 镜像、v0.26、固定 main baa023ad 没有此键，写入会启动报错；下文算法走读按后来的 main 提交 4d1412d1，当时规划器尚未接入服务。当前参数定义取 rc2，谱系 main 仍是 baa023ad、rc2 单列，启用条件见 [stair_config](stair-config-cca9e594a052.md#一句话)。GLM 双机没开 EPLB，而且零冗余，这个键在那里不起作用（见「开了的代价」）。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["replica_search_beam_size"]` |
| 类型 | `int` |
| 默认表达式 | `64` |
| 定义 | `vllm_ascend/ascend_config.py:226` [C17] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if not 1 <= self.replica_search_beam_size <= 128:
    raise ValueError('stair_config.replica_search_beam_size must be between 1 and 128')
````

## 事实表

| 项 | 扫描提交 4d1412d1 上的值或行为 | 意味着什么 |
|---|---|---|
| 完整路径 | `additional_config["eplb_config"]["stair_config"]["replica_search_beam_size"]` | 只能嵌在 `stair_config` 里 |
| 旧钉点上是否存在 | v0.23、GLM 镜像、v0.26、main baa023ad 都没有 | rc2 已有并接入服务；旧版报错见 [stair_config 事实表](stair-config-cca9e594a052.md#事实表) |
| 类型 / 默认值 | `int`，64 | 每层每轮至多 64 次带约束摆放 |
| 合法取值 | 1–128；越界报 `stair_config.replica_search_beam_size must be between 1 and 128` [C3]；写 `true` 报 `STAIR numeric fields must not be booleans` [C8] | 0 不合法：写 0 启动即报错（下限是 1），不能靠写 0 关掉搜索 |
| 按什么分数留 | 每份副本扛的最大风险（专家风险 ÷ 份数的最大值），越小越好；同分按份数向量的字典序 [C4] | 这是个粗分数，真正的峰均比要到摆放之后才算 |
| 「份数不变」的保留位 | 最后一次截断后，若「份数不变」不在留下的候选里，就用它替换掉最后一个 [C6] | 束宽为 n 时，改了份数的候选至多 n − 1 个 |
| 写 1 时 | 唯一的位置被「份数不变」占去，副本数永远不会被调整，只剩换位置 [D] | 表面上是「最省」，实际是关掉了副本数调整 [!] |
| 和阶段数、半径的关系 | 每段展开上限 = 束宽 × (2 × 半径 + 1)；推导与默认值下的合计见父参数页 | 束宽同时放大搜索和摆放两头的成本 |

## 为什么存在

副本数搜索每走一段，候选状态就要乘上「每个状态试几个取值」（由半径决定），不截断的话几段之后就是指数增长 [D]。束宽是最直接的闸门：每段按粗分数留最好的若干个，搜索规模随段数大致线性增长，而不是指数增长 [C4]。

截断用的是粗分数，而不是摆完之后的真实峰均比：后者要对每个候选跑一遍带约束的摆放，代价高得多 [I]。束宽留得宽一些，就是给「粗分数略差、但摆起来更均匀」的候选留一个进入最终比较的机会 [I]。最后进入摆放的候选同样被束宽截住 [C7]；搜索与摆放两头的耗时谁占大头，钉点上没有实测，待核。

「份数不变」被强制留在最终候选里 [C6]：这样规划器总能比较「只换位置、不动副本数」这一选项，副本数调整不会被粗分数一票否决 [I]。

## 开了的代价

rc2已接入运行时；下面说明束宽对搜索的影响，尚缺相同负载下不同束宽的设备对照。

**束宽越大，CPU 上算得越多，两头都涨**：每段展开的状态上限按束宽线性涨，最后进入带约束摆放的候选数也按束宽线性涨；后者每次摆放还可能用掉若干次回退（上限见 [placement_search_backtrack_limit](placement-search-backtrack-limit-82b03cef98b0.md)）[D]。默认值下的展开次数合计只在 [stair_config 的代价一节](stair-config-cca9e594a052.md#开了的代价) 推导。

**束宽越小，越接近贪心**：留下的备选少，粗分数排名靠后的方案没有机会进入摆放比较。

束宽给出的是保留候选数量的上限，实际数量可能更少：重复方案会被去重，不能形成有效候选的结果不会留下；进入摆放后，摆放失败的候选也会被跳过。因此，增大束宽不保证最终得到更多可用方案，也不能仅按束宽的倍数推算耗时。

**写 1 的陷阱** [!]：看上去是「只留最好的一个」，但最终那一个位置会被「份数不变」占去，副本数从此不再调整，STAIR 只能在现有份数下换位置（事实表倒数第二行）[D]。想要最省又保留副本数调整，至少要写 2。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：在这套部署用的镜像 db701c1f 上，写这个键就是启动失败（原文见 [stair_config 的「一句话」](stair-config-cca9e594a052.md#一句话)）。假如换到已接入 STAIR 的 main，而摆法沿用现在的零冗余（每卡 18 个专家、没有副本位，见 [EP 页的 16 张卡怎样分专家](../concepts/expert-parallel.md#16-张卡怎样分专家)），副本数搜索只产出「每个专家 1 份」这一个候选，它本身就是「份数不变」，所以每层每轮只摆 1 次，束宽写多少都一样 [D]。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.replica_search_beam_size` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 无 | `baa023ad` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |

## 对照源码

### 源码位置

实际核读 `4d1412d1`：来源 4 的 304–321 行只保留能补齐的阶段状态，按份数去重再截断；来源 5 的 377–387 行对最终候选同样过滤、去重、截断；来源 7 的 948–949 行跳过摆放失败的候选。由这些条件推断，束宽上限与最终可用方案数、实际耗时没有固定倍数关系 [I]；没有不同束宽的设备实测。
