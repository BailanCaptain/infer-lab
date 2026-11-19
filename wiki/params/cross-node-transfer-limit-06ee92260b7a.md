---
id: cross-node-transfer-limit-06ee92260b7a
title: cross_node_transfer_limit
type: param
summary: >-
  STAIR 单层一轮规划里每个节点跨节点发出与接收专家搬运的各自上限：-1 不限，0 禁止跨节点，正整数按节点双向封顶。v0.30.0 与 main 已接入 MRv2，声明默认 -1；未显式指定通信器而自动回退 torch_gloo 时，仅将未显式配置的限额收紧为 1。
origin: seed
evidence: C
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: 2026-11-19T00:00:00.000Z
legacyAnchors:
  一句话: 它管什么声明默认与-gloo-回退收紧的区别
  事实表: 它管什么声明默认与-gloo-回退收紧的区别
  为什么存在: 为什么按节点双向封顶与打平排序规则
  开了的代价: 调紧放宽的代价与放到-glm-双机
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
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L221-L252'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L680-L738'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L739-L842'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L1183-L1217'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_eplb.py#L152-L240'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L437-L465'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L228-L259'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L233-L261'
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
## 它管什么，声明默认与 Gloo 回退收紧的区别？

同一台机器内卡间走高速互联，跨机器搬专家权重则要挤占窄得多的机间网络链路。`cross_node_transfer_limit` 是 [stair_config](stair-config-cca9e594a052.md) 下的**节点级跨机搬运闸门**（`int`），控制 STAIR 给单层重排专家时**每个节点（每台机器）往外发出与往里接收跨节点专家搬运的各自次数上限**。所谓“一次搬运”指新摆法中某槽位要放入原卡没有的专家、须从当前持有该专家的某张源卡拷贝权重；当源卡与目标卡的节点编号不同（节点编号由调用方按卡传入，编号相同即为同节点）时，计为一次跨节点搬运。

`-1` 表示取消这道跨节点次数限制，`0` 表示完全禁止跨节点搬运，正整数则按节点双向封顶。**声明默认与运行时有效值须结合通信器核对**：早期快照 `4d1412d1`（随 PR #17512 引入）声明默认为 `1`；到了 `v0.30.0` 与 `main`，声明默认改为 `-1`，但当用户未显式指定 `eplb_config.communicator` 而全组 HIXL 探查失败（任一 rank 不可用或绑定类型不一致）自动回退 `torch_gloo` 时，系统仅把**未显式配置**的限额收紧为 `1`（显式写的 `0`、`-1` 或其他正整数都会保留；显式指定 `communicator` 也跳过自动回退与收紧）。因此不能把“声明默认 `-1`”理解为所有现场都不限跨节点搬运。`v0.23.0`、`v0.26.0rc` 与 GLM 固定镜像 `db701c1f` 没有此键，写入即启动失败。

| 维度 | 行为与约束 | 工程含义 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["eplb_config"]["stair_config"]["cross_node_transfer_limit"]`，`int`，`v0.30.0`/`main` 声明默认 `-1` | 只配这一项时其余 STAIR 字段取默认；自动回退 Gloo 时未显式设置项收紧为 `1` |
| 合法取值 | 整数且 `≥ -1`；小于 `-1` 报 `stair_config.cross_node_transfer_limit must be at least -1`，布尔值报 `STAIR numeric fields must not be booleans` | 与 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 不同，这里 `0` 合法（禁跨节点） |
| 计数单位与全局上界 | 按**节点**分别计“跨节点发出”和“跨节点接收”；非负上限下单层一轮全局最多 `节点数 × 上限` 次跨节点搬运 | 例如有效限额为 `1`、两台机器时，单层一轮至多 2 次跨节点搬运；`-1` 仅取消跨节点次数上限，仍受来源卡额度与总待搬运数制约 |
| 单节点部署 | 所有卡节点编号相同，不存在跨节点搬运 | 本参数在单节点部署中不起作用 |
| 超出上限与平局偏好 | 摆放每一步都须能在限额内凑出搬运来源，回溯耗尽仍无解则作废该候选；全部作废则本层本轮不出计划；在平均峰均比打平（差在 `1e-9` 以内）的合法候选中，先挑跨节点搬运更少的 | 即使写 `-1`，规划器在效果打平时仍优先少跨机器 |

## 为什么按节点双向封顶，与打平排序规则

同机卡间互联与跨机网络链路带宽差距显著（见 [硬件页官方带宽规格](../concepts/hardware-devices.md#官方带宽规格能说明什么)），同样一份专家权重跨机拷贝耗时更长。STAIR 在按卡封顶的 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 之外单独增设跨节点上限，并按**节点**而非按单卡计数——因为跨机流量最终汇集到整台机器对外的那几条机间链路，具体由本机哪张卡发出并不改变跨机出口拥塞（源码注释只说明了按节点双向计数的规则，未展开说明设计取舍及早期默认 `1` 的标定来源）。

即使未触碰跨节点上限，STAIR 在候选裁决中依然把跨机器搬运视为成本最高的一类迁移：
1. 先淘汰预测平均峰均比或加权 p95 峰均比（各段峰均比升序按段样本数累计取 95% 位置）劣于现状的候选；
2. 对预测平均峰均比距最小值不超过内部绝对容差 `1e-9` 的近似并列候选，依次按**跨节点迁移次数**、同节点跨卡迁移次数、目标专家编号、来源 rank（分布式执行成员编号）、来源槽位编号取较小者。这组规则保证了同等均衡度下的确定性偏好，不构成不同链路的实测耗时数据。

拿一个 **2 台机器 × 2 卡**（节点 0 含 `R0, R1`，节点 1 含 `R2, R3`）的例子对照「按卡」与「按节点」两套独立账本（**示意**：设 `rank_transfer_limit = 2`、`cross_node_transfer_limit = 1`）：

| 候选搬运组合（单层一轮示意） | 每卡额度（上限 `2`） | 节点 0（跨机收 / 发，上限 `1`） | 节点 1（跨机收 / 发，上限 `1`） | 裁决结果 |
| --- | --- | --- | --- | --- |
| ① `R2 → R0` 且 `R3 → R1`（同向两笔跨机） | 4 张卡各占 `1 ≤ 2` | `2 / 0`（**收超限**） | `0 / 2`（**发超限**） | **拒绝**（虽每卡未满，节点超限） |
| ② `R2 → R0` 且 `R1 → R3`（双向各一笔对调） | 4 张卡各占 `1 ≤ 2` | `1 / 1`（通过） | `1 / 1`（通过） | **允许**（全局达 $2 \times 1 = 2$ 次上限） |
| ③ `R2 → R0` 且机内 `R0 ↔ R1` | `R0` 收 2 发 1、`R1` 收 1 发 1（均 `≤ 2`） | `1 / 0`（机内不计跨机） | `0 / 1`（通过） | **允许**（机内搬运不消耗跨节点额度） |

## 调紧放宽的代价与放到 GLM 双机

以下方向与上界分析基于源码规则推导，尚无不同跨节点限额下的实际搬运耗时与均衡度实测对照。

- **调小（往 `0` 靠）**：可选摆法收窄，均衡度收敛变慢，甚至该层本轮找不到合法摆法而保持不动。设为 `0` 时，每台机器上持有的专家集合被彻底锁死——只能在机内卡间换位置，新增副本也只能拷贝本机已有专家；如果最热的几个专家都挤在同一台机器上，`0` 会导致这台机器的高负载永远无法分摊出去。
- **调大（或写 `-1`）**：放宽的是一轮允许跨节点搬运的范围；实际搬运量与均衡度变化仍取决于其他约束及最终选出的摆法。若最终多搬了专家，机间链路的字节传输与同步等待也随之增加。注意 `-1` 仅取消跨节点次数封顶，来源卡的 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 额度与可行摆放约束依然生效，同时受本层待搬运总数的自然上界制约。
- **与其他 STAIR 字段的耦合**：本键与 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 同时生效、须双双满足；副本数搜索（[replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 等）产出的候选若在摆放阶段无法凑出合法来源就会被淘汰。限额越紧，LPT 摆放的首选卡越容易撞墙，[placement_search_backtrack_limit](placement-search-backtrack-limit-82b03cef98b0.md) 回溯预算越易耗尽。
- **放到 GLM 双机部署**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16，每卡每层 18 个路由专家，零冗余）：
  - 当前部署[未开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，固定镜像 `db701c1f` 不认 `stair_config`，写入直接报 `Config has no attribute 'stair_config'`。
  - 若迁移到已接入 STAIR 的 `v0.30.0`/`main` 并沿用当前零冗余摆法（16 卡 × 18 槽刚好装下 288 个专家各 1 份，无副本增减余地，只能换位置）：当**显式设为 `1`，或自动回退 Gloo 收紧为 `1` 时**，跨机器对调一对专家会使两台机器各发 1 个、各收 1 个，恰好用满上限——即**每层每轮最多跨机器对调一对专家**（声明默认 `-1` 本身不保证此上界）。按[每个专家每层 24 MiB](../concepts/glm-5-3-flash-two-node.md#为什么是两台机器不是一台) 估算，一对专家相当于每层每轮至多 `48 MiB` 过机间链路；若热点集中在同一台机器上，靠逐对交换需多轮才能摊开。

## 对照源码

下表对照 `stair_config.cross_node_transfer_limit` 在四个固定版本快照上的声明默认、Gloo 回退收紧与跨节点约束：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与默认 | 无（报缺属性）[C7] | 无 | `StairConfig.cross_node_transfer_limit: int = -1`，合法 `≥ -1`（`0` 禁跨机）[C26][C27] | 同左 [C33] | 小于 `-1` 或布尔值均抛 `ValueError` |
| Gloo 自动回退收紧 | — | — | 未显式指定 `communicator` 且 HIXL 共识失败回退 `torch_gloo` 时，仅将未显式填写的限额收紧为 `1` [C31] | 同左 | 显式 `0`/`-1` 或显式 `communicator` 均不被覆盖 [!] |
| 约束检查与打平排序 | — | — | `_has_feasible_migration_sources` / `_migration_sources` 分别核对卡与节点额度；`plan_layer` 容差 `1e-9` 内优先少跨节点 [C28][C29][C30] | 同左（`stair.py` 零 diff） | 写 `-1` 不跳过来源卡额度，打平时仍偏向少跨机 |

- **算法与推演核对**：`v0.30.0` 与 `main` 共用 `stair.py#L680-L842`（双向卡/节点额度匹配，[C28][C29]）与 `#L1183-L1217`（mean/p95 过滤与 `1e-9` 并列排序，[C30]）。全局上界 `节点数 × 上限`、单节点不生效、写 `0` 锁死本机专家集合以及 GLM 双机每层至多对调一对（`48 MiB`）均为静态推导 [D]；按节点而非按卡计数的出口链路解释为工程推断 [I]。
- **官方文档**：`v0.30.0`（`expert_parallelism_load_balancer.md#L437-L465`，[S32]）与 `main`（`#L233-L261`，[S34]）均列出默认 `-1`、范围 `-1` 或非负整数，并给出 `cross_node_transfer_limit: 0` 示例。
- **待核**：本工作区无 NPU 实机环境，尚无不同跨节点限额下的实际跨机传输耗时与均衡度实测对照。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.cross_node_transfer_limit` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
