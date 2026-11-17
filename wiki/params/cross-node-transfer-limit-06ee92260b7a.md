---
id: cross-node-transfer-limit-06ee92260b7a
title: cross_node_transfer_limit
type: param
summary: >-
  STAIR 一次层规划里每个节点跨节点发出、接收的专家搬运各自的上限：-1 不限、0 禁止跨节点。rc2 已接入 MRV2，声明默认 -1；自动回退
  Gloo 时仅把未显式配置的限额收紧为 1。早期扫描快照默认 1。
origin: seed
evidence: C
updated: 2026-11-03T00:00:00.000Z
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
  - 'https://github.com/vllm-project/vllm-ascend/pull/17512'
  - >-
    vllm-ascend@ac1b7bceb370265e8f794f38d32a88041b0c51c9:vllm_ascend/ascend_config.py#L223
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L211
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L220
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L221
  - >-
    raw:sha256-4b2f2b96f81d41aabdeffc7dff51c43c51df9ed9eb4ba380ccf80c59116abe55.md#L1-L117
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L15'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L157-L168'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L951-L983'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L218-L253'
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L1503-L1524
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L152-L184'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L45-L59'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L223
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L224
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L221
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-4b2f2b96f81d41aabdeffc7dff51c43c51df9ed9eb4ba380ccf80c59116abe55.md
  - >-
    raw/sha256-80f9325693f686699c926cb52fcbe2c1637294f0505b370c2046bc437e0a41ef.md
  - >-
    raw/sha256-a52d9cc085c40ec036fa54c6a3a61ce2365f83c1330e65e21f81e4ee516df871.md
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
---
## 一句话

**v0.30.0rc2 对照：** STAIR 已接入 MRV2，跨节点搬运上限的声明默认从下面旧快照的 1 改为 -1；-1 不限，0 禁止跨节点，分别限制节点的发送和接收数量。自动选择 HIXL 失败而回退 torch_gloo 时，仅把用户未显式设置的限制收紧到 1；显式 0 或其他值保留。不能将“声明默认 -1”解释为任何现场都无限搬运。

`cross_node_transfer_limit` 管 STAIR 每次给一层重排专家时，**有多少个专家可以跨机器搬**：每个节点（一台机器）往外发的跨节点搬运、往里收的跨节点搬运，各自不能超过这个数。历史 `4d1412d1` 默认 `1`，rc2 声明默认 `-1`；`-1` 表示不限；`0` 表示完全不许跨节点搬 [C1][C2][C24]。

这里的「一次搬运」是指：新摆法里某个槽位要放一个它原来没有的专家，权重得从**当前持有这个专家**的某张卡拷过来；源卡和目标卡不在同一个节点，就算一次跨节点搬运 [C4]。哪些卡算同一个节点，由调用方给每张卡传的节点编号决定，编号相同就是同一节点 [C6]。

STAIR 是 vllm-ascend 为 Model Runner V2（MRv2）写的 EPLB 规划算法（总介绍见 [stair_config](stair-config-cca9e594a052.md)），两道门决定哪几层要重排（见 [absolute_balance_threshold](absolute-balance-threshold-71578a0c428d.md)），本页这个数则约束**进了规划的那一层最多能怎么改**。

**旧版本范围**：v0.23、GLM 快照 `db701c1f`、v0.26 和固定 main `baa023ad` 没有此键，写入会启动报错。它在 2026-09-26 随约束摆放 `eb31db4d`（[PR #17512](https://github.com/vllm-project/vllm-ascend/pull/17512)）加入，比多数 STAIR 字段晚一个 PR；10-02 的 `4ebb3090` 仍默认 `1`。下文按 `4d1412d1` 讲历史行为，该快照尚无服务运行时消费，次日 `a32719ef` 才接入 MRV2，见 [接入说明](absolute-balance-threshold-71578a0c428d.md#开了的代价)。当前参数定义取 rc2，谱系 main 仍指旧钉点，rc2 单列；显式指定 communicator 时会跳过本页开头所述自动回退与限额收紧。

**GLM 双机这套部署上它不存在，也用不上**：本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 不认 `stair_config`。但 GLM 恰好是两台机器，这个数如果真跑起来会卡得很紧，推演见下面「开了的代价」。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["cross_node_transfer_limit"]` |
| 所属类 | `StairConfig` |
| 类型 | `int` |
| 默认表达式 | `-1` |
| 定义 | `vllm_ascend/ascend_config.py:221` [C26] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

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
| 四个旧快照 | 都没有；v0.23 / GLM 快照 / v0.26 报 `Config has no attribute 'stair_config'` [C7]，main `baa023ad` 被 `extra="forbid"` 拒收 [C8] | 服务起不来，不是静默忽略 |
| 完整路径与默认值（`4d1412d1`） | `additional_config["eplb_config"]["stair_config"]["cross_node_transfer_limit"]`，`int`，默认 `1` | 只写这一个子键时，其余 STAIR 字段取默认值 |
| 合法取值 | 整数且 `≥ -1`；小于 -1 报 `stair_config.cross_node_transfer_limit must be at least -1` [C3]；写成布尔值报 `STAIR numeric fields must not be booleans` [C9] | 和 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 不同，这里 `0` 合法 [C10] |
| 计数单位 | 按**节点**计，一次层规划里每个节点「发出」和「收进」的跨节点搬运各算各的 | 不是全局总数，也不是每张卡 |
| 全局上限 | 非负上限下，一层一次最多 `节点数 × 上限` 次跨节点搬运；`-1` 只取消这道跨节点次数限制，仍受来源卡的搬运额度和可行摆放约束，且不超过这一层待搬运的总数 | 有效限额为 1、两个节点时，一层一次最多 2 次 [D] |
| 超出上限的摆法 | 摆放时每一步都要能在上限内找到搬运来源，回溯也找不到就作废这个候选；所有候选都作废，这一层这次不出计划 | 上限越紧，能选的摆法越少 |
| 不碰上限时 | 平均峰均比打平（差在 1e-9 以内）的候选里，先挑跨节点搬运更少的，再比同节点跨卡搬运 [C5] | 即使写 `-1`，规划器也偏向少跨机器 |
| 单节点部署 | 所有卡节点编号相同，任何搬运都不跨节点 | 这个值不起作用 [D] |
| 运行时谁读它（`4d1412d1`） | 没有调用方，只做解析和校验 | 在这个快照上改它，不改变任何行为 |

## 为什么存在

EPLB 重排专家，本质是把专家权重从一张卡拷到另一张卡。同一台机器里的卡之间和两台机器之间走的是不同的链路，带宽差一截（[硬件页的官方带宽规格](../concepts/hardware-devices.md#官方带宽规格能说明什么)），同样一个专家，跨机器拷要慢得多。所以 STAIR 在「每张卡最多搬几个」（[rank_transfer_limit](rank-transfer-limit-99529b37d91d.md)）之外，单独给跨节点搬运设了一道上限。

上限按**节点**而不是按卡来数，一个说得通的理由是：跨机器的流量最终都要挤过这台机器对外的那几条链路，同一台机器上哪张卡在发并不重要 [I]。源码注释只写了「每个节点、一次层规划里发出和收进的跨节点搬运上限」，没有解释为什么这样设计。

旧快照 `4d1412d1` 的默认值取得很紧（`1`），效果是每次只许每台机器跨机器换进换出一个专家，大的调整要分好几轮完成；这个旧默认取舍的来由源码与 PR 说明都没有写。rc2 要在显式设为 1，或自动回退 Gloo 将未设值收紧为 1 后，才有同样的限额。即使不碰上限，规划器在效果打平时也会挑跨节点搬运更少的摆法——跨机器搬运被当成最贵的那一种 [C5]。

进入事实表所说的并列比较之前，候选的平均峰均比和 p95 峰均比都不能比当前摆法更差。p95 将各段的峰均比排序，按每段代表的样本数累计，取达到总样本数 95% 的位置对应的值。通过筛选后，预测平均比率距最小值不超过 1e-9 的候选按表中搬运次数比较；仍打平时，依次按目标专家编号、来源 rank 编号和来源槽位编号确定顺序。rank 是分布式执行中的成员编号。这是规划器的确定性排序规则，不是不同链路实际搬运耗时的测量。

## 开了的代价

**先说清楚本页有什么、没有什么**：下面是配置值和按规划器源码推出来的上界，不是测出来的效果。上游没有公开不同取值下的搬运耗时与均衡度对照；而在 `4d1412d1` 上这个值根本不被读，也没法测。

**调小（往 `0` 靠）**：能选的摆法越来越少，均衡度改进得慢，甚至这一层这一轮找不到合法摆法、干脆不动。写 `0` 时，每台机器上有哪些专家就被锁死了：只能在机器内部换位置，新加的副本也只能拷本机已有的专家 [D]。如果最热的几个专家都挤在同一台机器上，`0` 就意味着这台机器的负载永远分不出去 [D]。

**调大（或写 `-1`）**：放宽的是一次规划所允许的跨机器搬运范围；实际搬运和均衡度是否改变，还取决于其他限制及选出的摆法。若最终多搬了专家，机间链路上的字节和等待开销也会增加。`-1` 不再施加这道跨节点次数限制，但来源卡的搬运额度和可行摆放约束仍在；这一层待搬运的总数只是额外的自然上界。

**和其他字段的关系**：它与 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 同时生效，两个都满足才算合法；放不下的候选在摆放阶段就被作废，所以副本数搜索（[replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 等）留下的候选里，有一部分可能因为这道上限被淘汰。摆放阶段的回溯次数由 [placement_search_backtrack_limit](placement-search-backtrack-limit-82b03cef98b0.md) 控制，上限越紧，第一选择越常走不通，回溯越容易用完 [D]。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16，每卡每层 18 个路由专家，没有冗余专家）：

- 本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 也不认这个键，照 `4d1412d1` 的写法配进去启动就报 `Config has no attribute 'stair_config'`。下面两条只是按规划器源码推演「如果这套摆法交给 STAIR」。
- 没有冗余专家时，16 卡 × 18 槽正好装下 288 个专家各一份，副本数没有调整余地，重排只能是**换位置** [D]。**显式设为 1，或自动回退 Gloo 后有效限额为 1 时**，跨机器换一对专家，两台机器各发一个、各收一个，正好用满上限：**每层每次最多跨机器对调一对专家** [D]。rc2 的声明默认 -1 本身不保证这个上界。
- 按[每个专家每层 24 MiB](../concepts/glm-5-3-flash-two-node.md#为什么是两台机器不是一台)算，这一对就是每层每次最多 48 MiB 过机间链路 [D]。负载要是整体偏在一台机器上，靠这样一对一对地换，需要很多轮才能摊开。

4d1412d1分别检查每卡与跨节点额度，取消跨节点限制不会跳过来源rank的额度检查（来源4，479–512）。最终候选按951–983行的次序比较，内部绝对容差为1e-9，p95由样本计数确定（来源17–19）。这是旧算法快照的条件，真实调用版本及rc2默认按前文区分。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.cross_node_transfer_limit` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |
| releases/v0.30.0 | 有 | `c09d3e20` |
