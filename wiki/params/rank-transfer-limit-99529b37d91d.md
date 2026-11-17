---
id: rank-transfer-limit-99529b37d91d
title: rank_transfer_limit
type: param
origin: seed
evidence: C
summary: >-
  STAIR 的每卡搬运上限：一层一次规划里限制每卡换入专家与充当搬运来源的次数，也约束副本数调整步数。rc2 声明默认 -1 表示不限；自动回退 Gloo
  时仅将未显式配置的限额收紧为 1。历史扫描快照默认 1。
aliases:
  - 每卡专家搬运上限
  - STAIR rank transfer limit
relations:
  - to: stair-config-cca9e594a052
    kind: builds-on
    note: 这是 stair_config 的一个子键；STAIR 怎么走一轮规划、为什么钉点上写了起不来，都在父参数页
  - to: eplb
    kind: builds-on
    note: 「搬一个专家」在 EPLB 里意味着什么、要付什么代价，在 EPLB 页
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
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L222
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L203-L204'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L250-L251'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L924-L932'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L410-L432'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L780-L786'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L541-L604'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L947-L985'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L947-L983'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L233-L238'
  - >-
    vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L222
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L210
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L219
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L220
  - >-
    raw:sha256-61d4d98059ac20efe4d1bac0093607adb902428a7f2bdcb15fe521c00ed6eeac.md#L1-L203
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L858-L874'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L218-L251'
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L1149-L1175
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L1503-L1524
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L152-L184'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L222
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L223
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L220
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-61d4d98059ac20efe4d1bac0093607adb902428a7f2bdcb15fe521c00ed6eeac.md
  - >-
    raw/sha256-80f9325693f686699c926cb52fcbe2c1637294f0505b370c2046bc437e0a41ef.md
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
    raw/sha256-e8d4009d557761ee24c30bfe4fdf046610f9145817df6b3e11aecbfe9d227608.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
---
## 一句话

**v0.30.0rc2 对照。** 声明默认从旧扫描快照的 1 改为 -1，表示不限；合法值仍只有 -1 或正整数，0 仍非法。MRV2 STAIR 已实际消费它：每卡收、发分别受限，有限值还限制一轮副本数调整的步数不超过卡数×本值。自动选择 HIXL 失败并回退 torch_gloo 时，只有用户未显式填写的限额会收紧为 1；显式值会保留。因此要同时核对声明默认和实际通信器，下面的默认 1 属于旧扫描记录。

`rank_transfer_limit`是[stair_config](stair-config-cca9e594a052.md)下的整数，控制每层一轮规划里每张卡接收、发送专家的数量，两方向分别计数。历史4d1412d1默认1；rc2声明默认-1，自动回退通信器后的有效值见首段。只允许-1（不限）或正整数，0和其他负数都会报错。兄弟字段[cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md)则允许0。[C2][C3]

它还有第二处用途：STAIR 先搜出每个专家「理想上该有几份副本」，再从现状一份一份地挪过去，挪的总步数也被截在「卡数 × 本值」（-1 时截在总槽位数）[C4]。所以这个数既管摆放时的搬运，也管副本数一轮能改多少。

**旧版本与 GLM 范围**：v0.23、GLM 镜像、v0.26、固定 main baa023ad 没有此键，写入会启动报错；下文算法走读按后来的 main 提交 4d1412d1，当时规划器还未接入服务。当前参数定义取 rc2，谱系 main 仍是 baa023ad、rc2 单列，服务接入见 [stair_config](stair-config-cca9e594a052.md#一句话)。显式指定 communicator 会跳过 rc2 的自动选择与限额收紧。GLM 双机没开 EPLB，这个键用不上；已接入后的搬运代价见下面对应一节。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["rank_transfer_limit"]` |
| 所属类 | `StairConfig` |
| 类型 | `int` |
| 默认表达式 | `-1` |
| 定义 | `vllm_ascend/ascend_config.py:220` [C23] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.rank_transfer_limit != -1 and self.rank_transfer_limit < 1:
    raise ValueError('stair_config.rank_transfer_limit must be -1 or positive')
````

## 事实表

| 项 | 扫描提交 4d1412d1 上的值或行为 | 意味着什么 |
|---|---|---|
| 完整路径 | `additional_config["eplb_config"]["stair_config"]["rank_transfer_limit"]` | 只能嵌在 `stair_config` 里，不是 `eplb_config` 的直接子键 |
| 旧钉点上是否存在 | v0.23、GLM 镜像、v0.26、main baa023ad 都没有 | rc2 已有，默认与自动回退规则见本页开头；旧版报错见 [stair_config 事实表](stair-config-cca9e594a052.md#事实表) |
| 类型 / 默认值 | `int`，1 | 默认已经是最紧的正数档 |
| 合法取值 | -1 或 ≥ 1；不合法时报 `stair_config.rank_transfer_limit must be -1 or positive` [C3]；写 `true` 报 `STAIR numeric fields must not be booleans` [C10] | 没有上界，写多大都能启动 |
| 管什么 | 一层一次规划里，每张卡「换进」与「发出」各自的次数上限 [C2] | 原来就在这张卡上、被保留下来的专家不计数 |
| 第二处用途 | 副本数朝目标挪的步数上限 = 卡数 × 本值；-1 时为总槽位数 [C4] | 16张卡、显式设1时，一层一轮至多调整16份副本（每次给一个专家加1份、另一个减1份）[D] |
| 卡在上限时 | 摆放时只在没到上限的卡里挑；在上限内摆不出合法方案的候选被丢弃，某层没有候选过关时，这一层本轮保持原样 [C8] | 不会报错，只是「这一轮不动」 |
| -1 与大数 | -1 不设上限；本值不小于每卡槽位数时，换进那一侧已经不可能被它卡住 [D] | 每张卡一共就那么多位置，换进的个数不会超过位置数 |

## 为什么存在

EPLB 每轮「数、算、搬」的最后一步是把专家权重在卡之间拷来拷去（一轮循环怎么走见 [EPLB 页](../concepts/eplb.md#一轮循环怎么走数算搬)）。STAIR 把这一步的量直接写进规划：摆放时，一个副本只能落在「原来就有这个专家」的卡上，或者落在换进次数还没到上限的卡上 [C6]；给每个换进的专家找来源卡时，也要求来源卡发出的次数没到上限 [C7]。

接收额度只是摆放条件之一：目标卡还必须有空位置，且当前构造的目标摆放中尚未放置这个专家。因此，即使接收次数没有达到上限，也不能在已满的卡上继续放置，或在同一卡上重复放置同一个专家。

为什么按「每张卡」限、而不是只限总数：拷贝的读写落在发出卡和接收卡上，总数相同的搬运，集中在一两张卡上和摊到所有卡上，对单卡的打扰差别很大；按卡封顶就保证了没有哪张卡在一轮里被连换好几个专家 [I]。代价是一轮能改的东西少，见下一节。

第二处用途是同一个思路往前推：既然一轮里每张卡至多换 1 个，副本数一次改太多也摆不出来，所以在搜副本数的时候就按「卡数 × 本值」截住挪动步数 [C5]。

这里的一次副本数调整不直接等于一次最终权重搬运；具体从哪张卡取权重，还要等候选完成摆放及来源匹配后才能确定。

## 开了的代价

rc2已有运行入口；下面说明参数对规划和搬运的影响，尚缺相同负载下不同取值的设备对照。

**调大（或写 -1）**：一轮里能换的专家变多，规划器更可能一步走到它搜出来的最佳摆法；同时一轮要拷的权重变多，搬运占用的带宽和时间跟着涨。搬一个专家要付什么，见 [EPLB 页的代价一节](../concepts/eplb.md#代价多占的显存搬运和等待)。

**有效限额为1时**，每卡每层每轮最多接收、发送各1份专家。离目标很远时可能需要多轮；若额度内摆不出合法方案且回退预算耗尽，候选会被丢弃。全部候选失败或没有更优候选时，这层保持原样，属于规划结果，不一定报错。rc2是否取1要看显式值及通信器选择，不能只按旧默认判断。[C9][I]

**和另外两个键一起看**：跨机那一侧还有每台机器的上限 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md)。本键按卡分别限制接收与来源次数，跨节点上限则按节点分别限制跨节点接收与发出次数；方案必须同时满足两者。统计对象不同，不能简单取两个数中较小的值作为统一上限。上限越紧，带约束摆放越容易走进死胡同，接受可行替代选择的次数由 [placement_search_backtrack_limit](placement-search-backtrack-limit-82b03cef98b0.md) 封顶；预算刚好用满时仍可沿当前路径继续，只有又需要接受额外的可行替代选择且预算已满时，才因此放弃这个候选。目标副本数搜索的阶段数、半径和束宽由另三个键控制；本键限制的是从现状朝目标逐步调整的步数，不能把它理解为对整个副本搜索都没有影响。各阶段成本见 [stair_config 的代价一节](stair-config-cca9e594a052.md#开了的代价)。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：

- 在这套部署用的镜像 db701c1f 上，写这个键就是启动失败（原文见 [stair_config 的「一句话」](stair-config-cca9e594a052.md#一句话)）。
- 假如换到已接入 STAIR 的版本，且沿用现在的零冗余摆法——每卡 18 个专家、没有副本位（见 [EP 页的 16 张卡怎样分专家](../concepts/expert-parallel.md#16-张卡怎样分专家)）——**显式设为 1，或自动回退 Gloo 后有效限额为 1 时**，每层每轮至多 16 次搬运，每张卡最多换掉 18 个专家里的 1 个 [D]。rc2 的声明默认 -1 本身不保证这个上界。零冗余时每个专家只有一份，副本数没得挪，第二处用途不起作用 [D]。本值写到 18 及以上，就和 -1 一样不再限制这套摆法 [D]。这些是按源码推的，没有在 GLM 上跑过。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.rank_transfer_limit` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |
| releases/v0.30.0 | 有 | `c09d3e20` |

## 对照源码

### 源码位置

实际核读 `4d1412d1`：来源 6 的 783–786 行先检查空槽与同卡无重复专家，再检查有限接收额度；来源 4 的 924–932 行给增量调整传入卡数乘上限，或在 -1 时传入当前摆放总槽位数。来源 5 的 414–426 行每步只改一个专家加一份、另一个减一份；最终搬运来源由来源 7 的 541–604 行另行匹配。该段同时分别统计每卡接收/发出和每节点跨节点接收/发出，所以两类限制必须同时满足，而不是取一个统一的较小数字。以上是固定源码行为，没有搬运性能实测。

新增来源 16 的 858–874 行限定回溯预算失败：来源可行、该决策已有可行选择且预算已满，三者同时成立才因预算耗尽返回失败；刚接受最后一个预算内的替代选择后仍能继续当前路径。

来源 9 的 947–983 行说明候选失败后的结果：没有可接受候选，或最终选出的摆法与当前相同，都会返回 `None`，本层本轮不生成迁移计划。
