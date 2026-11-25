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
  事实表: 它管什么什么才扣回溯预算
  为什么存在: 为什么带约束-lpt-需要有界回溯
  开了的代价: 调大调小的边界与放到-glm-双机
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

给 MoE 专家分卡位时，最快的做法是按负载从重到轻依次把每份专家副本塞进当前最轻的卡（即 **LPT，Longest Processing Time first** 贪心摆放）。但一旦叠加上四道硬约束——每卡槽位固定、同卡不放重复专家、单卡搬运次数封顶、跨节点搬运次数封顶——前面贪心放下的副本很可能把后面副本的合法去路全部堵死。

`placement_search_backtrack_limit` 是 [stair_config](stair-config-cca9e594a052.md) 下的**单候选「悔棋」预算上限**（`int`，默认 `32`，合法范围 `0–64`）：它限制 STAIR（[Model Runner V2](../concepts/model-runner-v2.md) 默认的动态 [EPLB](../concepts/eplb.md) 规划算法）为**单个候选**摆放专家副本时，最多允许回退改选多少次**替代的可行分支**。这里的专家是执行特定计算的 MoE 模块，副本是该专家的一份权重实例，「可行」还要求能在每卡与跨节点搬运限额内凑出权重来源。

**关键区分**：预算计数的是「改主意」（回退到某一步并接受该步另一张来源可行的卡），而不是「试了几张卡」。设为 `0` 只把「接受替代可行分支」的预算归零，仍会执行每步的首个来源可行选择并跳过来源不可行的试放，不能解释为关闭搜索。`v0.30.0` 与 `main` 已在 MRv2 STAIR 中实际传入逐层规划器（须开启 `--enable-eplb` 且最终策略为 `stair`，默认已是 `stair`，显式选 `default` 则不消费 `stair_config`，入口见 [stair_config](stair-config-cca9e594a052.md)）；`v0.23.0`、`v0.26.0rc` 与 GLM 固定镜像 `db701c1f` 没有 `stair_config`，写入直接启动报错。

| 维度 | 行为与约束 | 工程含义 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["eplb_config"]["stair_config"]["placement_search_backtrack_limit"]`，`int`，默认 `32` | 只配这一项时其余 STAIR 字段取默认 |
| 合法取值 | 整数 `0–64`；越界报 `stair_config.placement_search_backtrack_limit must be between 0 and 64`，布尔值报 `STAIR numeric fields must not be booleans` | 上限 `64` 在校验器中硬编码 |
| 计数粒度 | **每个候选单独从 `0` 开始计数**，换下一个候选重新归零 | 不是整层或整轮规划的总预算 |
| 扣减规则 | 每份副本按“放后卡风险最低”试卡：凑不出搬运来源的卡撤销跳过、**不扣预算**；某步首次选定来源可行卡**不扣预算**；只有回退到该步、接受另一张来源可行卡时才扣 1 次 | 预算衡量的是可行分支反转次数，不是试放总次数 |
| 预算耗尽与失败 | 仅当“来源可行 + 该步已有过可行选择 + 已用回溯数达到上限”三者同时成立时，放弃该候选；预算刚好用满时当前路径仍可继续走完；退回第一步仍无路可走同样放弃该候选 | 放弃的是当前候选，跳过它继续试下一个；全层无可行或更优候选时本层本轮不出计划 |
| 死路来源 | 目标卡须有空槽、未重复放同专家、且原卡已有该专家（不占换入名额）或换入未达 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md)；同时全部换入须在 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md) 与来源卡发出额度内凑齐来源 | 搬运限额越紧，越容易走进死路 |

## 为什么带约束 LPT 需要有界回溯？

无约束或少约束下的 LPT 是一遍走完的快速贪心算法；但 STAIR 的摆放叠加了四类硬约束——每卡槽位数固定、同卡不重复放同一专家、单卡换入/发出不超 [rank_transfer_limit](rank-transfer-limit-99529b37d91d.md)、单节点跨机发/收不超 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md)。前面每放一份副本都在消耗槽位和搬运额度，只看眼前的贪心选择可能把后面某份副本的合法去路全部堵死。

在数百个专家、十几张卡的规模上做彻底回溯（穷举全部可行放法）是指数级复杂度，线上异步规划等不起。因此 PR #17512 引入了「看协方差的带约束 LPT + 有界回溯」：多数候选一遍贪心就能摆完，少数撞墙的候选允许回头改选有限次救回来，救不回来则果断放弃、换下一个副本数候选继续。源码注释与 PR 说明均未给出默认值 `32` 的公开标定推导。

```wiki-diagram
file: param-stair-lpt-backtrack
```

拿上图只放 3 份副本 `A → B → C` 的微型过程核对每一步状态（**示意**：设 `placement_search_backtrack_limit = 1`，`backtracks_used` 从 `0` 起计，严格对应 `lpt_placement` 主循环）：

| 步骤 | 摆放动作（示意） | 来源可行？ | 本步已有可行选择？ | `backtracks_used` | 结果 |
| --- | --- | --- | --- | --- | --- |
| 1 | 放 `A`：首选 `R0` 凑不出搬运来源，撤销跳过 | 否 | 否 | `0`（**不扣**） | 跳过不可行卡，继续试 `A` 下一张卡 |
| 2 | 放 `A`：次选 `R1` 来源可行，接受并前进 | 是 | 否 → 是 | `0`（**不扣**） | 首次选定可行卡不耗预算，前进到 `B` |
| 3 | 放 `B`：首个可行卡 `R2` 接受并前进 | 是 | 否 → 是 | `0`（**不扣**） | 前进到 `C` |
| 4 | 放 `C`：剩余卡都因额度/槽位撞墙，**回退到 `B`** | 否 | — | `0` | 撤销 `B` 在 `R2` 的摆放 |
| 5 | 回到 `B`：改选另一张可行卡 `R3`（`0 < 1`） | 是 | **是** | `0 → 1`（**扣 1 次**） | 预算刚好用满，**当前路径继续**再试放 `C` |
| 6 | 若放 `C` 仍撞墙再退回 `A`，找到替代可行卡 `R2` | 是 | **是**且 `1 == 1` | 触发 `budget_exhausted` | 三条件齐备，**放弃当前候选**，换下一个候选归零重试 |

由此也容易看出 `placement_search_backtrack_limit = 0` 的真实含义：第 1–3 步照常执行（照样跳过来源不可行的 `R0`、接受每步的首个可行卡），只是到第 5 步试图改选替代可行卡时立刻满足 `backtracks_used == 0`，当场放弃该候选。

## 调大调小的边界与放到 GLM 双机

以下方向分析基于源码控制流推导，尚无不同回溯预算下的规划耗时、摆放成功率或端到端性能实测对照。

- **调大（往 `64` 靠）**：走进死路的候选更有机会被救回来，进入最终峰均比对比的可行候选更多。代价是 CPU 规划耗时：每次回溯都要撤销已放好的若干副本并重新试卡，每试一张需搬运的卡还要执行一次搬运来源可行性小搜索（虽然结果按有序需求键缓存）。最坏情况下一层几十个候选（由 [replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 等决定）全部打满预算，规划时间可能成倍拉长。
- **调小（往 `0` 靠）**：更早截断需要接受替代分支的搜索路径。设为 `0` 时仍会跳过来源不可行的试放并接受每步的第一个来源可行选择，仅禁止在同一决策步接受第二个及以后的可行选择；预算刚好用满后当前路径仍可继续走完，只有再次需要接受替代可行选择时才因预算不足放弃该候选，且放弃单个候选不会终止整层的其余候选。
- **作用大小高度依赖搬运限额**：[rank_transfer_limit](rank-transfer-limit-99529b37d91d.md) 与 [cross_node_transfer_limit](cross-node-transfer-limit-06ee92260b7a.md) 越紧，死路越多，回溯预算越常被消耗。当两者均取 `-1`（且未触发 Gloo 回退收紧）时，仅剩槽位容量与同卡不重复两项约束，撞墙概率大大下降，本参数基本不起作用。
- **放到 GLM 双机部署**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、每卡每层 18 个路由专家，零冗余）：
  - 当前部署[未开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，固定镜像 `db701c1f` 不认 `stair_config`，写入即报 `Config has no attribute 'stair_config'`。
  - 按源码推演，若迁移到支持 STAIR 的版本并沿用零冗余摆法，每个候选需逐份摆完 288 份副本；若两项搬运限额有效值均为 `1`（显式配置或自动回退 Gloo 收紧），绝大多数专家只能留在原卡，贪心尝试挪走某份副本时极易发现额度已被前面占满——这种「名额紧、步数多」的场景正是回溯预算真正发挥作用的典型工况。

## 对照源码

下表对照 `stair_config.placement_search_backtrack_limit` 在四个固定版本快照上的预算校验、单候选回溯计数与失败处理：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与范围 | 无（报缺属性）[C8] | 无 | `StairConfig.placement_search_backtrack_limit: int = 32`，合法 `0..64` [C23][C24] | 同左 [C30] | 越界或布尔值均在建配置时抛 `ValueError` |
| 回溯计数与接入 | — | — | MRv2 controller 接入，`lpt_placement` 对每个候选单独计数；仅当来源可行、该步已有可行选择且已满上限时放弃候选 [C25][C26][C27][C28] | 同左（`stair.py` 零 diff） | 设为 `0` 仍走首个可行选择并跳过不可行试放，并非关闭搜索 [!] |

- **实现与推演核对**：`v0.30.0` 与 `main` 共用 `stair.py#L876-L998`（合法卡筛选与状态初始化，[C25]）、`#L1055-L1127`（来源可行性缓存、回溯计数与撤销，[C26]）及 `#L1166-L1189`（候选循环传入预算并跳过失败候选，[C27]）。调大最坏成倍拉长耗时、GLM 288 份逐份摆放属静态推导 [D]，限额全为 `-1` 时基本不触发回溯与 GLM 限额为 `1` 时易触发回溯为工程推断 [I]。
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
