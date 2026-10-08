---
id: cross-node-transfer-limit-06ee92260b7a
title: cross_node_transfer_limit
type: param
summary: 'STAIR 一次层规划里每个节点跨节点发出、接收的专家搬运各自的上限：默认 1，-1 不限，0 禁止跨节点；只在 main 快照 4d1412d1 上有，且那里没有运行时代码读它。'
origin: seed
evidence: C
updated: '2026-10-04'
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L223
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L205-L207
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L252-L253
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L479-L512
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L907-L913
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L662-L673
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ascend_config.py#L837
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/ascend_config.py#L179-L180
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L233-L237
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L709-L713
  - >-
    https://github.com/vllm-project/vllm-ascend/pull/17512
rawSources:
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
---
## 一句话

`cross_node_transfer_limit` 管 STAIR 每次给一层重排专家时，**有多少个专家可以跨机器搬**：每个节点（一台机器）往外发的跨节点搬运、往里收的跨节点搬运，各自不能超过这个数。默认 `1`；`-1` 表示不限；`0` 表示完全不许跨节点搬 [C2]。

这里的「一次搬运」是指：新摆法里某个槽位要放一个它原来没有的专家，权重得从**当前持有这个专家**的某张卡拷过来；源卡和目标卡不在同一个节点，就算一次跨节点搬运 [C4]。哪些卡算同一个节点，由调用方给每张卡传的节点编号决定，编号相同就是同一节点 [C6]。

STAIR 是 vllm-ascend 为 Model Runner V2（MRv2）写的 EPLB 规划算法（总介绍见 [stair_config](stair-config-cca9e594a052.md)），两道门决定哪几层要重排（见 [absolute_balance_threshold](absolute-balance-threshold-71578a0c428d.md)），本页这个数则约束**进了规划的那一层最多能怎么改**。

**存在范围**：我们钉住的四个版本——v0.23 维护分支、GLM 快照 `db701c1f`、v0.26、main `baa023ad`（2026-09-21）——都没有它，写进去启动就报错（见事实表）。它是 2026-09-26 随 `eb31db4d`（[PR #17512](https://github.com/vllm-project/vllm-ascend/pull/17512)）进的 main，比其余多数 STAIR 字段晚一个 PR，随约束摆放一起加入，此后的 main 一直保留（2026-10-02 的 `4ebb3090` 上默认值仍是 `1`）；本页按 09-26 的 main 快照 `4d1412d1` 描述。下方「版本谱系」表里的「main：有」指的就是这条最新 main，不是钉住的 `baa023ad`。**在 `4d1412d1` 上它也只被解析和校验，没有运行时代码读它**（核对方法见 [absolute_balance_threshold 的一句话](absolute-balance-threshold-71578a0c428d.md#一句话)）。次日的 `a32719ef` 起 STAIR 才接进 MRv2，见 [absolute_balance_threshold 的「之后的版本」](absolute-balance-threshold-71578a0c428d.md#开了的代价)。

**GLM 双机这套部署上它不存在，也用不上**：本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 不认 `stair_config`。但 GLM 恰好是两台机器，这个数如果真跑起来会卡得很紧，推演见下面「开了的代价」。

## 参数定义（自动生成）


> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["cross_node_transfer_limit"]` |
| 类型 | `int` |
| 默认表达式 | `1` |
| 定义 | `vllm_ascend/ascend_config.py:223` [C1] |
| 版本 | main · 4d1412d102c16669af3ec73174fc5f8b359b56d9 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if self.cross_node_transfer_limit < -1:
    raise ValueError('stair_config.cross_node_transfer_limit must be at least -1')
````

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 钉住的四个版本 | 都没有；v0.23 / GLM 快照 / v0.26 报 `Config has no attribute 'stair_config'` [C7]，main `baa023ad` 被 `extra="forbid"` 拒收 [C8] | 服务起不来，不是静默忽略 |
| 完整路径与默认值（`4d1412d1`） | `additional_config["eplb_config"]["stair_config"]["cross_node_transfer_limit"]`，`int`，默认 `1` | 只写这一个子键时，其余 STAIR 字段取默认值 |
| 合法取值 | 整数且 `≥ -1`；小于 -1 报 `stair_config.cross_node_transfer_limit must be at least -1` [C3]；写成布尔值报 `STAIR numeric fields must not be booleans` [C9] | 和 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 不同，这里 `0` 合法 [C10] |
| 计数单位 | 按**节点**计，一次层规划里每个节点「发出」和「收进」的跨节点搬运各算各的 | 不是全局总数，也不是每张卡 |
| 全局上限 | 一层一次最多 `节点数 × 上限` 次跨节点搬运；`-1` 时只受这一层要搬的专家数限制 | 默认值、两个节点时，一层一次最多 2 次 [D] |
| 超出上限的摆法 | 摆放时每一步都要能在上限内找到搬运来源，回溯也找不到就作废这个候选；所有候选都作废，这一层这次不出计划 | 上限越紧，能选的摆法越少 |
| 不碰上限时 | 平均峰均比打平（差在 1e-9 以内）的候选里，先挑跨节点搬运更少的，再比同节点跨卡搬运 [C5] | 即使写 `-1`，规划器也偏向少跨机器 |
| 单节点部署 | 所有卡节点编号相同，任何搬运都不跨节点 | 这个值不起作用 [D] |
| 运行时谁读它（`4d1412d1`） | 没有调用方，只做解析和校验 | 在这个快照上改它，不改变任何行为 |

## 为什么存在

EPLB 重排专家，本质是把专家权重从一张卡拷到另一张卡。同一台机器里的卡之间和两台机器之间走的是不同的链路，带宽差一截（[硬件页的官方带宽规格](../concepts/hardware-devices.md#官方带宽规格能说明什么)），同样一个专家，跨机器拷要慢得多。所以 STAIR 在「每张卡最多搬几个」（[rank_transfer_limit](rank-transfer-limit-99529b37d91d.md)）之外，单独给跨节点搬运设了一道上限。

上限按**节点**而不是按卡来数，一个说得通的理由是：跨机器的流量最终都要挤过这台机器对外的那几条链路，同一台机器上哪张卡在发并不重要 [I]。源码注释只写了「每个节点、一次层规划里发出和收进的跨节点搬运上限」，没有解释为什么这样设计。

默认值取得很紧（`1`），效果是每次只许每台机器跨机器换进换出一个专家，大的调整要分好几轮完成；这个取舍的来由源码与 PR 说明都没有写。即使不碰上限，规划器在效果打平时也会挑跨节点搬运更少的摆法——跨机器搬运被当成最贵的那一种 [C5]。

## 开了的代价

**先说清楚本页有什么、没有什么**：下面是配置值和按规划器源码推出来的上界，不是测出来的效果。上游没有公开不同取值下的搬运耗时与均衡度对照；而在 `4d1412d1` 上这个值根本不被读，也没法测。

**调小（往 `0` 靠）**：能选的摆法越来越少，均衡度改进得慢，甚至这一层这一轮找不到合法摆法、干脆不动。写 `0` 时，每台机器上有哪些专家就被锁死了：只能在机器内部换位置，新加的副本也只能拷本机已有的专家 [D]。如果最热的几个专家都挤在同一台机器上，`0` 就意味着这台机器的负载永远分不出去 [D]。

**调大（或写 `-1`）**：一次规划允许更多跨机器拷贝，均衡度能一步改得更多，代价是这一次要过机间链路的字节数更多、搬完要等得更久。`-1` 时唯一的上限是这一层要搬的专家总数。

**和其他字段的关系**：它与 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 同时生效，两个都满足才算合法；放不下的候选在摆放阶段就被作废，所以副本数搜索（[replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 等）留下的候选里，有一部分可能因为这道上限被淘汰。摆放阶段的回溯次数由 [placement_search_backtrack_limit](placement-search-backtrack-limit-82b03cef98b0.md) 控制，上限越紧，第一选择越常走不通，回溯越容易用完 [D]。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16，每卡每层 18 个路由专家，没有冗余专家）：

- 本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 也不认这个键，照 `4d1412d1` 的写法配进去启动就报 `Config has no attribute 'stair_config'`。下面两条只是按规划器源码推演「如果这套摆法交给 STAIR」。
- 没有冗余专家时，16 卡 × 18 槽正好装下 288 个专家各一份，副本数没有调整余地，重排只能是**换位置** [D]。跨机器换一对专家，两台机器各发一个、各收一个，正好用满默认的上限 1：**每层每次最多跨机器对调一对专家** [D]。
- 按[每个专家每层 24 MiB](../concepts/glm-5-3-flash-two-node.md#为什么是两台机器不是一台)算，这一对就是每层每次最多 48 MiB 过机间链路 [D]。负载要是整体偏在一台机器上，靠这样一对一对地换，需要很多轮才能摊开。

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
