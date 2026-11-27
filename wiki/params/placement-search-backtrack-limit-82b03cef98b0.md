---
id: placement-search-backtrack-limit-82b03cef98b0
title: placement_search_backtrack_limit
type: param
summary: >-
  STAIR 用带约束 LPT 为单个候选摆放专家副本时允许接受替代可行分支的回溯预算上限：默认 32，合法范围 0–64，每个候选单独计数；设为 0 只禁止接受替代可行选择，仍会执行首个可行选择及跳过来源不可行的试放。v0.30.0 与 main 已接入 MRv2。
aliases:
  - stair_config.placement_search_backtrack_limit
  - 摆放搜索回溯上限
  - 带约束 LPT 回溯预算
  - LPT 专家放置
  - STAIR placement search backtrack limit
origin: seed
evidence: C
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: 2026-11-19T00:00:00.000Z
legacyAnchors:
  一句话: 它管什么什么才扣回溯预算
  为什么存在: 为什么带约束-lpt-需要有界回溯
  开了的代价: 调大调小与搬运限额的耦合边界
  调大调小的边界与放到-glm-双机: 调大调小与搬运限额的耦合边界
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L227
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L214-L215
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L260-L261
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L662-L670
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L858-L869
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L783-L786
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L932-L949
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ascend_config.py#L837
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/config_utils.py#L43
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L233-L237
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L876-L878
  - 'https://github.com/vllm-project/vllm-ascend/pull/17511'
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L215
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L224
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L225
  - >-
    raw:sha256-9198fa0857064ad6dd8c91dbb6d7315f423a3864b583f6a993354117e9480f2e.md#L1-L102
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L224-L261'
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L1163-L1176
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L936-L1087'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L45-L59'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L227
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L228
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L225
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L225-L260'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L876-L998'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L1055-L1127'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L1166-L1189'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/eplb.py#L37-L60'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L437-L456'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L232-L267'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L233-L252'
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-8aee88a8655f94436c1debd866502a010af1cae1a114c5294fc5664492948023.md
  - >-
    raw/sha256-9198fa0857064ad6dd8c91dbb6d7315f423a3864b583f6a993354117e9480f2e.md
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
    note: 这是 stair_config 第四步带约束 LPT 摆放的回溯预算子键，STAIR 整体四步流程见父参数页
  - to: rank-transfer-limit-99529b37d91d
    kind: builds-on
    note: 每卡双向搬运上限与跨节点上限共同构成摆放硬约束，限额越紧越容易触发有界回溯
  - to: eplb
    kind: builds-on
    note: 带约束 LPT 摆放为 EPLB 生成新的专家物理卡位方案，专家搬运与槽位规则见该页
  - to: ascend-config-system
    kind: builds-on
    note: >-
      该参数嵌在 additional_config 的 eplb_config.stair_config 下，其配置位置和旧版本拒收行为依赖
      AscendConfig 的分层解析与 EPLB 未识别键校验规则。
  - to: cross-node-transfer-limit-06ee92260b7a
    kind: builds-on
    note: 有界回溯在满足跨节点搬运上限的约束摆放中寻找可行方案；跨节点上限越紧，越容易出现需要回溯的死路。
---
## 它管什么，什么才扣回溯预算？

按风险从重到轻依次把专家副本塞进当前最轻的卡（**LPT，Longest Processing Time first**）时，**前一步贪心放下的副本很容易提前占掉某张卡的槽位或搬运额度，把后面副本的合法卡位全部堵死。**

`placement_search_backtrack_limit` 是 [stair_config](stair-config-cca9e594a052.md) 下的单候选「悔棋」预算上限（`int`，默认 `32`，合法范围 `0–64`）：当后续步骤撞墙退回前一步时，它限制 STAIR（[Model Runner V2](../concepts/model-runner-v2.md) 默认的动态 [EPLB](../concepts/eplb.md) 规划算法）为**单个候选**最多改选多少次**替代的可行分支**。一般场景保持默认 `32` 即可；仅当搬运限额收得很紧导致大量候选撞墙无解时适度调高，或单轮 CPU 规划耗时偏高时适度调低。

核对它的计数规则只需分清三件事：
- 跳过凑不出搬运来源的卡**不扣预算**，接受每步首个来源可行的卡也**不扣预算**（设为 `0` 仍会走完首个可行选择，并非关闭摆放搜索）；
- 只有回退到某一步、改选该步第二张及以后的来源可行卡时，才扣 `1` 次预算；
- 预算刚好扣满归零后，当前路径仍可继续走完，只有再次回退需要接受新替代分支时才放弃该候选。

版本上，`v0.30.0` 与 `main` 已在 MRv2 STAIR 中读取该键；`v0.23.0` 与 `v0.26.0rc`（及历史旧镜像）无 `stair_config`，写入直接启动报错（见 [stair_config](stair-config-cca9e594a052.md)）。

## 事实表

调整 `placement_search_backtrack_limit` 前，先弄清它的单候选计数粒度与不扣预算的情形：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["eplb_config"]["stair_config"]["placement_search_backtrack_limit"]`（`int = 32`） | 只配这一项时其余 STAIR 字段取默认 |
| 合法取值 | 整数 `0–64`（拒绝布尔值，越界抛 `ValueError`） | 上限 `64` 在校验器中硬编码；`0` 合法但不代表关闭摆放搜索 |
| 计数粒度 | **每个候选单独从 `0` 开始计数**，换下一个候选重新归零 | 并非整层或整轮规划共享的总预算 |
| 扣减规则 | 跳过凑不出搬运来源的卡**不扣**；某步首次选定来源可行卡**不扣**；仅回退到某步改选另一张来源可行卡时扣 `1` 次 | 预算衡量的是可行分支反转次数，而非遍历尝试的卡数 |
| 预算耗尽与失败 | “来源可行 + 该步已有过可行选择 + 已用回溯数达到上限”同时成立时放弃当前候选 | 预算刚好用满后当前路径仍可继续走完；放弃单个候选不影响其余候选继续试摆 |
| 耦合触发条件 | 死路主要来自 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 与 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md) 紧缩 | 两项搬运上限有效值均为 `-1` 时很少撞墙，本参数基本不消耗 |

## 为什么带约束 LPT 需要有界回溯？

无约束下的 LPT 是一遍走完的贪心算法；但 STAIR 的摆放同时受四道硬约束限制：每卡槽位数固定、同卡不重复放同一专家、单卡收发不超 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md)、单节点跨机收发不超 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md)。在额度吃紧时，前面放下的副本常把后面副本的合法去路占死。

在数百个专家、十几张卡的规模上穷举全部可行放法是指数级复杂度，线上异步规划等不起。因此 PR #17512 采用「带协方差的 LPT + 有界回溯」：多数候选一遍贪心摆完，撞墙候选允许有限次回退改选，耗尽仍无解则放弃该候选并换下一个副本份数候选继续（源码与 PR 未公开默认值 `32` 的标定推导）。

```wiki-diagram
file: param-stair-lpt-backtrack
```

沿上图 3 份副本 `A → B → C` 的微型过程逐行核对计数事件（示意：设 `placement_search_backtrack_limit = 1`，`backtracks_used` 从 `0` 起计）：

| 步骤 | 摆放动作（示意） | 来源可行？ | 本步已有可行选择？ | `backtracks_used` | 结果 |
| --- | --- | --- | --- | --- | --- |
| 1 | 放 `A`：首选 `R0` 凑不出搬运来源，撤销跳过 | 否 | 否 | `0`（**不扣**） | 跳过不可行卡，继续试 `A` 下一张卡 |
| 2 | 放 `A`：次选 `R1` 来源可行，接受并前进 | 是 | 否 → 是 | `0`（**不扣**） | 首次选定可行卡不耗预算，前进到 `B` |
| 3 | 放 `B`：首个可行卡 `R2` 接受并前进 | 是 | 否 → 是 | `0`（**不扣**） | 前进到 `C` |
| 4 | 放 `C`：剩余卡都因额度/槽位撞墙，**回退到 `B`** | 否 | — | `0` | 撤销 `B` 在 `R2` 的摆放 |
| 5 | 回到 `B`：改选另一张可行卡 `R3`（`0 < 1`） | 是 | **是** | `0 → 1`（**扣 1 次**） | 预算刚好用满，**当前路径继续**再试放 `C` |
| 6 | 若放 `C` 仍撞墙再退回 `A`，找到替代可行卡 `R2` | 是 | **是**且 `1 == 1` | 触发 `budget_exhausted` | 三条件齐备，**放弃当前候选**，换下一个候选归零重试 |

对照上表即可看清 `placement_search_backtrack_limit = 0` 的行为：第 1–3 步照常跳过不可行卡并接受每步首个可行卡；直到第 5 步试图改选替代可行卡时，因 `backtracks_used == 0` 当场放弃当前候选。

## 调大调小与搬运限额的耦合边界

以下方向分析基于源码控制流推导，尚无不同回溯预算下的规划耗时、摆放成功率或端到端性能实测对照。

- **调大（往 `64` 靠）**：走进死路的候选更有机会被救回来，进入最终峰均比对比的可行候选增多。代价是 CPU 规划耗时：每次回溯要撤销已放副本重跑来源匹配（虽有需求键缓存），最坏情况下至多 [replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 个候选全部耗尽预算，规划耗时会成倍拉长。
- **调小（往 `0` 靠）**：更早放弃需要改选替代分支的候选，而放弃单个候选不会终止同层其余候选。
- **调参适用边界**：当 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 与 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md) 有效值均为 `-1` 时很少撞墙，本参数基本不消耗；只有**搬运额度很紧且已有候选经常摆不下时，调高回溯预算才可能有帮助**。

## 对照源码

下表对照 `stair_config.placement_search_backtrack_limit` 在四个固定版本快照上的预算校验、单候选回溯计数与失败处理：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与范围 | 无（报缺属性）[C8] | 无 | `StairConfig.placement_search_backtrack_limit: int = 32`，合法 `0..64` [C23][C24] | 同左 [C30] | 越界或布尔值均在建配置时抛 `ValueError` |
| 回溯计数与接入 | — | — | MRv2 controller 接入，`lpt_placement` 对每个候选单独计数；仅当来源可行、该步已有可行选择且已满上限时放弃候选 [C25][C26][C27][C28] | 同左（`stair.py` 零 diff） | 设为 `0` 仍走首个可行选择并跳过不可行试放，并非关闭搜索 [!] |

- **实现与推演核对**：`v0.30.0` 与 `main` 共用 `stair.py#L876-L998`（合法卡筛选与状态初始化，[C25]）、`#L1055-L1127`（来源可行性缓存、回溯计数与撤销，[C26]）及 `#L1166-L1189`（候选循环传入预算并跳过失败候选，[C27]）。调大最坏成倍拉长耗时属静态推导 [D]，限额全为 `-1` 时基本不触发回溯与搬运限额收紧时易触发回溯为工程推断 [I]。
- **官方文档**：`v0.30.0`（`expert_parallelism_load_balancer.md#L437-L456`，[S29]）与 `main`（`#L233-L252`，[S31]）均记录默认 `32` 与范围 `0–64`。
- **待核**：本工作区无 NPU 实机环境，尚无不同回溯预算下的实际规划耗时与候选摆放成功率对照。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.placement_search_backtrack_limit` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 标识 | `additional_config["eplb_config"]["stair_config"]["placement_search_backtrack_limit"]` |
| 所属类 | `StairConfig` |
| 类型 | `int` |
| 默认表达式 | `32` |
| 定义 | `vllm_ascend/ascend_config.py:225` [C23] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if not 0 <= self.placement_search_backtrack_limit <= 64:
    raise ValueError('stair_config.placement_search_backtrack_limit must be between 0 and 64')
````
