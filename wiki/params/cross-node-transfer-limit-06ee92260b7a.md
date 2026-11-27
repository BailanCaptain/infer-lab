---
id: cross-node-transfer-limit-06ee92260b7a
title: cross_node_transfer_limit
type: param
summary: >-
  STAIR 单层一轮规划里每个节点跨节点发出与接收专家搬运的各自上限：-1 不限，0 禁止跨节点，正整数按节点双向封顶。v0.30.0 与 main 已接入 MRv2，声明默认 -1；未显式指定通信器而自动回退 torch_gloo 时，仅将未显式配置的限额收紧为 1。
aliases:
  - stair_config.cross_node_transfer_limit
  - 跨节点专家搬运上限
  - 跨机搬运限额
  - STAIR cross node transfer limit
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
  为什么存在: 为什么按节点双向封顶与打平排序规则
  开了的代价: 调紧放宽与多键耦合边界
  调紧放宽的代价与放到-glm-双机: 跨两台机器交换一对专家要搬多少权重
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
relations:
  - to: stair-config-cca9e594a052
    kind: builds-on
    note: 这是 stair_config 下的跨节点搬运限额子键；STAIR 四步规划与 Gloo 回退收紧机制见父参数页
  - to: eplb
    kind: builds-on
    note: 单层跨节点重排搬运的是 EPLB 管理的 MoE 专家权重，搬运代价与循环流程见 EPLB 页
  - to: ascend-config-system
    kind: builds-on
    note: 该键嵌在 additional_config.eplb_config.stair_config 下，版本识别与严格校验遵循 AscendConfig 体系
  - to: hardware-devices
    kind: builds-on
    note: 按节点而非单卡双向封顶的动机在于同机卡间与跨机网络链路的带宽差异，硬件拓扑规格见该页
---
## 它管什么，声明默认与 Gloo 回退收紧的区别？

**`cross_node_transfer_limit` 给每台机器（每个节点）设了两个独立的跨机额度：单层一轮 STAIR 规划里，本机往外机最多发出几份专家权重，以及从外机最多接收几份专家权重。**

只要新摆法需要从另一台机器的源卡拷贝本卡没有的专家，源节点计 `1` 次跨机发出，目标节点计 `1` 次跨机接收；同一台机器内的卡间搬运不消耗这两个额度。它是 [stair_config](stair-config-cca9e594a052.md) 下的整数参数（服务于 [Model Runner V2](../concepts/model-runner-v2.md) 的动态 [EPLB](../concepts/eplb.md)），三档取值如下：
- `-1`：取消这道跨节点次数封顶；
- `0`：完全禁止跨节点搬运（禁止从外机引入本机当前没有的专家，只允许在机内重排或扩增本机已有专家副本）；
- 正整数：按节点对跨机收、发分别封顶。

**运行边界（显式配置 vs 自动回退收紧）**：`v0.30.0` 与 `main` 的声明默认为 `-1`（早期快照 `4d1412d1` 曾默认 `1`）。若用户未显式配置 `eplb_config.communicator`，且全组 HIXL（昇腾高速单边直传引擎）探查未达成一致而自动回退到 CPU `torch_gloo`，系统只会把**用户未显式填写**的本限额收紧为 `1`；用户手写的 `0`、`-1` 或正整数，以及显式指定 `communicator` 的部署均原样保留、不走自动收紧。`v0.23.0` 与 `v0.26.0rc`（及历史旧镜像）无此键，写入会因 [AscendConfig](../concepts/ascend-config-system.md) 不识别而启动失败。

## 事实表

多机调整 `cross_node_transfer_limit` 前，先核对合法取值（允许 `0`）、节点计数规则与平局偏好：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["eplb_config"]["stair_config"]["cross_node_transfer_limit"]`（`int = -1`） | 声明默认不限跨机次数；自动回退 `torch_gloo` 时未显式设置项会自动收紧为 `1` |
| 合法取值 | 整数且 `≥ -1`（拒绝布尔值，`< -1` 抛 `ValueError`） | 与 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 不同，此处 **`0` 合法**（完全禁止跨节点搬运） |
| 计数单位与全局上界 | 按**节点**分别计“跨机发出”和“跨机接收”；非负上限下单层一轮全局最多 `节点数 × 上限` 次 | 有效限额为 `1`、两台机器时，单层一轮全局至多 2 次跨机搬运（双向对调一对） |
| 单节点部署 | 所有卡节点编号相同，跨机计数恒为 `0` | 单机多卡部署中改动本参数没有任何作用 |
| 超限淘汰与平局偏好 | 超限无解的候选作废（全层无解则保持不动）；平均峰均比差在 `1e-9` 内时优先选跨节点搬运更少的 | 即使写 `-1`，规划器在均衡效果打平时仍优先走同机卡间搬运 |

## 为什么按节点双向封顶，与打平排序规则

同机卡间高速互联与跨机网络链路的带宽相差悬殊（见 [硬件页官方带宽规格](../concepts/hardware-devices.md#官方带宽规格能说明什么)），同一份专家权重跨机拷贝耗时显著更长。由于跨机流量最终汇集到整台机器对外的机间网卡，STAIR 在按卡封顶的 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 之外，直接以**节点**为单位对跨机收发分别限流。

即使未触碰跨节点上限，STAIR 在候选裁决中依然把跨机器搬运视为成本最高的一类迁移：
1. 先淘汰预测平均峰均比或加权 p95 峰均比（各段峰均比升序按段样本数累计取 95% 位置）劣于现状的候选；
2. 对预测平均峰均比距最小值不超过内部绝对容差 `1e-9` 的近似并列候选，依次按**跨节点迁移次数**、同节点跨卡迁移次数、目标专家编号、来源 rank（分布式执行成员编号）、来源槽位编号取较小者。这组规则保证同等均衡度下的确定性偏好，不构成不同链路的实测耗时数据。

```wiki-diagram
file: param-stair-transfer-limits
```

用 **2 台机器 × 2 卡**（节点 0 含 `R0, R1`，节点 1 含 `R2, R3`）的示意算例，把「按卡计数」和「按节点计数」两套独立账本并排对照（设 `rank_transfer_limit = 2`、`cross_node_transfer_limit = 1`）：

| 候选搬运组合（单层一轮示意） | 每卡额度（上限 `2`） | 节点 0（跨机收 / 发，上限 `1`） | 节点 1（跨机收 / 发，上限 `1`） | 裁决结果 |
| --- | --- | --- | --- | --- |
| ① `R2 → R0` 且 `R3 → R1`（同向两笔跨机） | 4 张卡各占 `1 ≤ 2` | `2 / 0`（**收超限**） | `0 / 2`（**发超限**） | **拒绝**（虽每卡未满，节点超限） |
| ② `R2 → R0` 且 `R1 → R3`（双向各一笔对调） | 4 张卡各占 `1 ≤ 2` | `1 / 1`（通过） | `1 / 1`（通过） | **允许**（全局达 $2 \times 1 = 2$ 次上限） |
| ③ `R2 → R0` 且机内 `R0 ↔ R1` | `R0` 收 2 发 1、`R1` 收 1 发 1（均 `≤ 2`） | `1 / 0`（机内不计跨机） | `0 / 1`（通过） | **允许**（机内搬运不消耗跨节点额度） |

## 调紧放宽与多键耦合边界

以下方向与上界分析基于源码规则推导，尚无不同跨节点限额下的实际搬运耗时与均衡度实测对照。

- **调小（往 `0` 靠）**：可行摆法收窄，跨机偏斜收敛变慢。设为 `0` 时完全禁止引入外机专家（有冗余槽位允许扩增本机专家覆盖其他槽位时，本机去重专家集合会缩小；零冗余下集合不变），若热点专家全挤在同一台机器上，就无法靠跨机迁出分摊负载。
- **调大（或写 `-1`）**：放宽跨机搬运上限，同时可能增加单轮机间链路的传输字节与等待时间。注意写 `-1` 只取消跨节点次数封顶，来源与目标卡的 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 依然生效。
- **与其他 STAIR 字段的耦合**：候选必须同时满足每卡限额与跨节点限额；限额越紧，LPT 贪心选卡越易碰壁，[placement_search_backtrack_limit](placement-search-backtrack-limit-82b03cef98b0.md) 回溯预算也越容易耗尽。

## 跨两台机器交换一对专家要搬多少权重

在两台机器共 `16` 张卡（`EP16`）、每卡每层 `18` 个路由专家且采用零冗余配置（`288` 个专家各占 `1` 份，只能交换物理位置）的拓扑下，考察**有效 `cross_node_transfer_limit = 1`** 的情形（显式设为 `1` 或自动回退 `torch_gloo` 收紧为 `1`；声明默认 `-1` 本身不设此封顶）：

- **双向各一笔恰好用满额度**：跨两台机器对调一对专家时，节点 0 发 `1` 份、收 `1` 份，节点 1 同样发 `1` 份、收 `1` 份，单层一轮最多只能跨机器对调这一对专家（共 `2` 次跨机搬运）。
- **机间链路字节估算**：按[单个 W8A8 路由专家每层约 `24 MiB`](../concepts/glm-5-3-flash-two-node.md#为什么是两台机器不是一台) 代入，跨机交换一对专家每层每轮至多向机间链路发送 **$2 \times 24\text{ MiB} = 48\text{ MiB}$** 权重载荷；若多个热门专家集中在同一台机器上，受限于有效限额 `1`，需要跨越多个规划周期逐对迁出。

## 对照源码

下表对照 `stair_config.cross_node_transfer_limit` 在四个固定版本快照上的声明默认、Gloo 回退收紧与跨节点约束：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与默认 | 无（报缺属性）[C7] | 无 | `StairConfig.cross_node_transfer_limit: int = -1`，合法 `≥ -1`（`0` 禁跨机）[C26][C27] | 同左 [C33] | 小于 `-1` 或布尔值均抛 `ValueError` |
| Gloo 自动回退收紧 | — | — | 未显式指定 `communicator` 且 HIXL 共识失败回退 `torch_gloo` 时，仅将未显式填写的限额收紧为 `1` [C31] | 同左 | 显式 `0`/`-1` 或显式 `communicator` 均不被覆盖 [!] |
| 约束检查与打平排序 | — | — | `_has_feasible_migration_sources` / `_migration_sources` 分别核对卡与节点额度；`plan_layer` 容差 `1e-9` 内优先少跨节点 [C28][C29][C30] | 同左（`stair.py` 零 diff） | 写 `-1` 不跳过来源卡额度，打平时仍偏向少跨机 |

- **算法与推演核对**：`v0.30.0` 与 `main` 共用 `stair.py#L680-L842`（双向卡/节点额度匹配，[C28][C29]）与 `#L1183-L1217`（mean/p95 过滤与 `1e-9` 并列排序，[C30]）。全局上界 `节点数 × 上限`、单节点不生效、写 `0` 禁止从外机引入本机当前没有的专家（允许机内扩副本覆盖时集合仍可缩小）以及 GLM 双机每层至多对调一对（`48 MiB`）均为静态推导 [D]；按节点而非按卡计数的出口链路解释为工程推断 [I]。
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
