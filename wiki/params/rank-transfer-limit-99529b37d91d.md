---
id: rank-transfer-limit-99529b37d91d
title: rank_transfer_limit
type: param
origin: seed
evidence: C
summary: >-
  STAIR 的每卡搬运上限：一层一次规划里，每张卡至多换进几个原来没有的专家、至多给别的卡当几次搬运来源，默认 1，-1 表示不限；它同时把副本数调整的步数截到「卡数 × 本值」。知识库钉住的四个版本都没有这个键，行为按扫描提交 4d1412d1 写。
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
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
updated: '2026-10-04'
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
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L1036-L1040'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L233-L238'
rawSources:
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
---
## 一句话

`rank_transfer_limit` 是 [stair_config](stair-config-cca9e594a052.md) 下的一个整数，回答 STAIR 规划时的一个问题：**一层的一次规划里，每张卡最多能换几个专家**。「换进」指这张卡收下一个它原来没有的专家（权重要从别的卡拷过来），「发出」指它把自己手里的专家拷给别的卡；两个方向各自不超过这个数 [C2]。默认是 1。只能写 -1（不设上限）或正整数：校验条件是「不等于 -1 且小于 1 就报错」，所以写 0 或其他负数，启动时都会失败 [C3]。注意兄弟键 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md) 的规则不同，那边允许写 0。

它还有第二处用途：STAIR 先搜出每个专家「理想上该有几份副本」，再从现状一份一份地挪过去，挪的总步数也被截在「卡数 × 本值」（-1 时截在总槽位数）[C4]。所以这个数既管摆放时的搬运，也管副本数一轮能改多少。

**存在范围与 GLM 结论**跟父参数一样：知识库钉住的 v0.23、GLM 镜像、v0.26、main 四个版本都没有这个键，写上就启动报错；本页行为按 main 提交 4d1412d1 写，它在钉点 baa023ad 之后、同样不是钉点（页底「版本谱系」里 main 一行写「有」，指的也是钉点之后的 origin/main），而那一版的 STAIR 还没接进运行时，详见 [stair_config 的「一句话」](stair-config-cca9e594a052.md#一句话)。GLM 双机这套部署没开 EPLB，这个键用不上；假如换到已接入的 main 上会怎样，见下面「开了的代价」末尾。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["rank_transfer_limit"]` |
| 类型 | `int` |
| 默认表达式 | `1` |
| 定义 | `vllm_ascend/ascend_config.py:222` [C1] |
| 版本 | main · 4d1412d102c16669af3ec73174fc5f8b359b56d9 |

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
| 钉点上是否存在 | v0.23、GLM 镜像、v0.26、main 钉点 baa023ad 都没有 | 页底「版本谱系」的 main 行写「有」，指钉点之后的 origin/main；版本细节与报错见 [stair_config 事实表](stair-config-cca9e594a052.md#事实表) |
| 类型 / 默认值 | `int`，1 | 默认已经是最紧的正数档 |
| 合法取值 | -1 或 ≥ 1；不合法时报 `stair_config.rank_transfer_limit must be -1 or positive` [C3]；写 `true` 报 `STAIR numeric fields must not be booleans` [C10] | 没有上界，写多大都能启动 |
| 管什么 | 一层一次规划里，每张卡「换进」与「发出」各自的次数上限 [C2] | 原来就在这张卡上、被保留下来的专家不计数 |
| 第二处用途 | 副本数朝目标挪的步数上限 = 卡数 × 本值；-1 时为总槽位数 [C4] | 16 张卡、默认 1 时，一层一轮至多挪 16 份副本（每挪一份，一个专家加 1 份、另一个减 1 份）[D] |
| 卡在上限时 | 摆放时只在没到上限的卡里挑；在上限内摆不出合法方案的候选被丢弃，某层没有候选过关时，这一层本轮保持原样 [C8] | 不会报错，只是「这一轮不动」 |
| -1 与大数 | -1 不设上限；本值不小于每卡槽位数时，换进那一侧已经不可能被它卡住 [D] | 每张卡一共就那么多位置，换进的个数不会超过位置数 |

## 为什么存在

EPLB 每轮「数、算、搬」的最后一步是把专家权重在卡之间拷来拷去（一轮循环怎么走见 [EPLB 页](../concepts/eplb.md#一轮循环怎么走数算搬)）。STAIR 把这一步的量直接写进规划：摆放时，一个副本只能落在「原来就有这个专家」的卡上，或者落在换进次数还没到上限的卡上 [C6]；给每个换进的专家找来源卡时，也要求来源卡发出的次数没到上限 [C7]。

为什么按「每张卡」限、而不是只限总数：拷贝的读写落在发出卡和接收卡上，总数相同的搬运，集中在一两张卡上和摊到所有卡上，对单卡的打扰差别很大；按卡封顶就保证了没有哪张卡在一轮里被连换好几个专家 [I]。代价是一轮能改的东西少，见下一节。

第二处用途是同一个思路往前推：既然一轮里每张卡至多换 1 个，副本数一次改太多也摆不出来，所以在搜副本数的时候就按「卡数 × 本值」截住挪动步数 [C5]。

## 开了的代价

本页没有实测数：钉点上没有这个特性，上游也没有公开不同取值的对照。下面是从源码推出来的行为。

**调大（或写 -1）**：一轮里能换的专家变多，规划器更可能一步走到它搜出来的最佳摆法；同时一轮要拷的权重变多，搬运占用的带宽和时间跟着涨。搬一个专家要付什么，见 [EPLB 页的代价一节](../concepts/eplb.md#代价多占的显存搬运和等待)。

**保持默认 1**：每张卡每层每轮最多换 1 个专家。离理想摆法差得远时，要靠很多轮慢慢逼近 [I]；更紧的情况是，在上限之内某个候选摆不出合法方案（回退次数也用完），这个候选就被丢掉；某层所有候选都被丢掉、或者摆出来的都不比现状好，这一层本轮一个都不换。这种情况在规划函数里只是返回「无方案」、这一层原样保留 [C9]，不抛错 [!]，看上去就是这一层的摆法一直没变。

**和另外两个键一起看**：跨机那一侧还有每台机器的上限 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md)，两个上限同时生效，取更紧的那个。上限越紧，带约束摆放越容易走进死胡同，回退次数由 [placement_search_backtrack_limit](placement-search-backtrack-limit-82b03cef98b0.md) 封顶，用完就放弃这个候选。副本搜索本身的规模不受本键影响，见 [stair_config 的代价一节](stair-config-cca9e594a052.md#开了的代价)。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：

- 在这套部署用的镜像 db701c1f 上，写这个键就是启动失败（原文见 [stair_config 的「一句话」](stair-config-cca9e594a052.md#一句话)）。
- 假如换到已接入 STAIR 的 main，且沿用现在的零冗余摆法——每卡 18 个专家、没有副本位（见 [EP 页的 16 张卡怎样分专家](../concepts/expert-parallel.md#16-张卡怎样分专家)）——那么默认值下每层每轮至多 16 次搬运，每张卡最多换掉 18 个专家里的 1 个 [D]。零冗余时每个专家只有一份，副本数没得挪，第二处用途不起作用 [D]。本值写到 18 及以上，就和 -1 一样不再限制这套摆法 [D]。这些是按源码推的，没有在 GLM 上跑过。

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

- **引入**：2026-09-26 · eb31db4d75622a8043703d2cbb55e9df75e70f98 · PR [#17512](https://github.com/vllm-project/vllm-ascend/pull/17512) —— [Feature][EPLB] Add constrained STAIR placement (#17512)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/distributed/eplb/policy/stair.py` +829 / −7（文本行变化）
  - `vllm_ascend/ascend_config.py` +11 / −5（文本行变化）

当前含该标识符的 tag：未找到
