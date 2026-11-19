---
id: stair-config-cca9e594a052
title: stair_config
type: param
origin: seed
evidence: C
summary: >-
  additional_config.eplb_config 下给 MRv2 STAIR（StairEplbPolicy）调参的嵌套字典，十个数值键分管负载窗口压缩、滞回重排门槛、风险分位数、副本数搜索、搬运上限与有界回溯。v0.30.0 与 main 已接入 MRv2 并默认启用 stair 策略，未指定通信器回退 Gloo 时自动收紧未显式配置的搬运限额。
aliases:
  - STAIR 配置
  - STAIR EPLB policy config
relations:
  - to: eplb
    kind: builds-on
    note: STAIR 是 EPLB 规划器的一种算法；峰均比、冗余副本、搬专家的代价都在那一页讲，本页只讲 STAIR 多出来的旋钮
  - to: ascend-config-system
    kind: builds-on
    note: >-
      这个键是 additional_config.eplb_config 里的嵌套 dict；钉点上写了为什么会起不来（逐键报错与
      extra="forbid"）在那一页
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: 2026-11-19T00:00:00.000Z
legacyAnchors:
  一句话: 它管什么十个旋钮如何配合
  事实表: 它管什么十个旋钮如何配合
  为什么存在: 一轮规划怎么走与-mrv1--mrv2-边界
  开了的代价: 代价通信器回退陷阱与放到-glm-双机
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L300
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L186-L231'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L233-L262'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L987-L1056'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L846-L856'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L828-L838'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L889-L899'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L175-L197'
  - 'vllm-ascend@baa023ad:vllm_ascend/config_utils.py#L32-L50'
  - 'vllm-ascend@4ebb3090:vllm_ascend/distributed/eplb/policy/factory.py#L10-L16'
  - 'vllm-ascend@4ebb3090:vllm_ascend/platform.py#L940-L983'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L899-L985'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L190-L224'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L255-L388'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L277-L324'
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L288
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L297
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L298
  - >-
    raw:sha256-9b9fa5a8ca3602c995585694ca642e402a070c85e6099a398fa730c507b3570b.md#L1-L633
  - >-
    vllm-ascend@1eda0ddad8b67f791a1019741d254cc97f9617ad:vllm_ascend/ascend_config.py#L302
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L360-L362
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L186-L261'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L289-L300'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L38-L66'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/factory.py#L10-L16'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L152-L184'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L300
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L283-L314'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_eplb.py#L204-L239'
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L305
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L298
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L184-L261'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L961-L1017'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/eplb.py#L37-L67'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_eplb.py#L152-L240'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_eplb.py#L283-L315'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L1129-L1255'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L437-L468'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L191-L268'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L286-L310'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L98-L99'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1116-L1195'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L233-L265'
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-1b0bd120973ed640e9ff8963fd65beaab611b24f70266f27179d4691edf23a53.md
  - >-
    raw/sha256-9b9fa5a8ca3602c995585694ca642e402a070c85e6099a398fa730c507b3570b.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-c464f43f6b53bd43e74846ad95a26448484a9ba179597922409ed7774ce99fff.md
  - >-
    raw/sha256-c72498576a170455c135d749651303ce5defbeb08b46a62e6c257bd2f15dcced.md
  - >-
    raw/sha256-c972368829e7e384b3c21d0815797ac0f5e2be6ddf069b67ecd9ccc8e557e677.md
  - >-
    raw/sha256-d52e6721dafc61ddfe3628246bcae3cda0e6200d1a0263ff862b9e4889c9a67d.md
  - >-
    raw/sha256-e224a73e7bf7fcecea30207720d1ad2c4b83c8765a0247f4b252b2fa35c9796d.md
  - >-
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
---
## 它管什么，十个旋钮如何配合？

`stair_config` 是 `additional_config["eplb_config"]` 下的嵌套字典（对应不可变配置类 `StairConfig`，`frozen=True`），专门用于调整 vllm-ascend 为 Model Runner V2（MRv2）编写的 EPLB 规划算法 STAIR（策略类 `StairEplbPolicy`）。EPLB 解决的问题及峰均比衡量方式见 [EPLB 页](../concepts/eplb.md#怎么算数配对比峰均换位置)；STAIR 在此基础上新增三项核心机制：按“均值 + z × 标准差（含专家协方差）”评估负载风险、通过滞回门槛避免因小幅抖动反复搬运、以及在每轮规划中约束每卡与跨节点的搬运上限。

不传 `stair_config` 时十个键全部取默认值，只传部分子键时其余自动取默认；所有数值字段均拒绝布尔值（传入 `true`/`false` 抛出 `STAIR numeric fields must not be booleans`），越界值在构造配置时即抛 `ValueError`：

| 子键 | 所属步骤 | 声明默认（v0.30.0 / main） | 合法范围 | 一句话作用 |
| --- | --- | --- | --- | --- |
| [`load_window_bins`](load-window-bins-cc21068b082d.md) | ① 压缩负载窗口 | `64` | `2`–`256` | 按时间顺序将窗口步数压成至多这么多段 |
| [`relative_balance_threshold`](relative-balance-threshold-bcbc40e7dc87.md) | ② 滞回重排门槛 | `0.95` | `(0, 1]` | 当前平衡度 ÷ 上次提交预测平衡度 ≤ 本值时重排 |
| [`absolute_balance_threshold`](absolute-balance-threshold-71578a0c428d.md) | ② 滞回重排门槛 | `0.90` | `(0, 1]` | 当前平衡度 ≤ 本值时重排（与相对门槛“或”） |
| [`load_risk_quantile`](load-risk-quantile-d89a080ba048.md) | ③ 风险估计 | `0.75` | `(0.5, 1)` | 单侧标准正态分位数换算 `z`（默认约 `0.674`） |
| [`replica_search_num_stages`](replica-search-num-stages-e4b10925ff97.md) | ③ 副本数搜索 | `4` | `1`–`8` | 按风险排序的专家分阶段组数 |
| [`replica_search_radius`](replica-search-radius-cd3118b5aae5.md) | ③ 副本数搜索 | `8` | `0`–`32` | 每段以贪心预算为中心的左右试探半径 |
| [`replica_search_beam_size`](replica-search-beam-size-6556d1650a62.md) | ③ 副本数搜索 | `64` | `1`–`128` | 每段与最终进入摆放保留的候选上限 |
| [`rank_transfer_limit`](rank-transfer-limit-99529b37d91d.md) | ④ 约束摆放 | `-1`（不限） | `-1` 或 `≥ 1` | 单层单轮每卡换入与发出上限，并截断副本调整步数 |
| [`cross_node_transfer_limit`](cross-node-transfer-limit-06ee92260b7a.md) | ④ 约束摆放 | `-1`（不限） | `≥ -1`（`0` 禁跨机） | 单层单轮每节点跨机发出与接收上限 |
| [`placement_search_backtrack_limit`](placement-search-backtrack-limit-82b03cef98b0.md) | ④ 约束摆放 | `32` | `0`–`64` | 单个候选带约束 LPT 摆放允许的替代可行分支次数 |

## 一轮规划怎么走，与 MRV1 / MRV2 边界

在 `v0.30.0` 与 `main` 上，只要开启 `--enable-eplb` 且运行在 MRv2 下，`patch_eplb.py` 已把上游 EPLB 默认策略改为 `stair`（显式设 `policy="default"` 则走默认策略、不消费 `stair_config`），由 `AscendEPLBController` 经工厂函数把 `stair_config` 传给 `StairEplbPolicy`。每轮规划对每个 MoE 层依次走四步：

1. **压缩负载窗口**：按时间顺序将上游累积的逐步负载并成至多 `load_window_bins` 个箱，每箱保留均值与样本数，后续统计均在箱上完成。
2. **迟滞筛选重排层**：平衡度定义为 `1 ÷ 平均峰均比`（1 最佳）。先跳过全零负载层；其余层中，从未提交过新摆法的层直接进入规划，已提交过的层须当前平衡度跌至上次提交预测值的 `relative_balance_threshold` 倍及以下，或跌破 `absolute_balance_threshold` 才进入规划，并按当前峰均比降序排队。
3. **风险估计与分阶段副本数搜索**：按 `均值 + z × 标准差` 计算每个专家风险，将按风险降序排列的专家分成 `min(replica_search_num_stages, 专家数)` 组（配置段数多于专家数时不会建空组），逐段在贪心预算 ± 半径内展开并按束宽截断，得到副本数候选。
4. **带约束 LPT 摆放与最终筛优**：按风险从高到低采用 LPT（最长任务优先：先排最重、每次放进放后风险最低的合法卡，含同卡协方差），同时遵守每卡与每节点的搬运上限并在死路时做有界回溯。四步结束后还有一道把关：候选的预测平均峰均比与加权 p95 峰均比均不得差于现状；过关者取平均峰均比最低，在内部容差打平时依次按跨节点迁移数、同节点远端迁移数、目标专家编号、来源 rank、来源槽位确定排序；若胜出方案与现状相同则本层本轮不搬运。

“含协方差的风险估计”与“滞回门槛”是 STAIR 的强制行为，没有关闭开关。版本与运行路径边界需严格区分：
- **旧版不存在且启动即报错**：`v0.23.0`、GLM 固定镜像 `db701c1f` 与 `v0.26.0rc` 均无此键，写入会触发 `ValueError: Config has no attribute 'stair_config'`；早期 `main`（如 `baa023ad`）也没有此键，会被 pydantic `extra="forbid"` 拒收；2026-09-26 随 PR #17511/#17512 刚入库时（如 `4d1412d1`）只存在配置校验与单测、尚未接入服务，次日 PR #17514 才接入 MRv2 工厂。
- **MRV1 vs MRV2 不可混用**：`eplb_policy_type`（`0–3`）只属于 MRv1 的旧规划器，没有给 STAIR 编号；在 `v0.30.0` 上，MRv1 下写 `stair_config` 或 `load_collection_phase` 会直接抛 `ValueError`，MRv2 的 `additional_config.eplb_config` 也只接受这两项并拒绝其余旧键（未知子键由 `StairConfig` 的 `extra="forbid"` 报错）。到了 `main`，MRv1 已被移除，`_validate_eplb_config` 对 MRv2 中不支持的 `eplb_config` 键与未知 `stair_config` 子键改为**打印警告并过滤丢弃**后再交给配置类解析（已知子键的布尔/越界值仍会启动报错）。此外，开启 EPLB 与权重 offload/prefetch（`cpu_offload_gb > 0` 或 `offload_group_size > 0`）或 elastic EP 互斥，且同步 EPLB 会被强制改为异步。

## 代价、通信器回退陷阱与放到 GLM 双机

- **CPU 规划搜索规模由三个 `replica_search_*` 共同决定**：副本数搜索把按风险降序排列的专家分成阶段数对应的组，前面每组的每个候选状态都要在“贪心给的副本数 ± 半径”内展开，每阶段仅保留束宽个最佳状态。第一阶段从 1 个状态起步，因此在默认值（阶段 4、半径 8、束宽 64）下三个展开阶段的状态数上限为 `1`、`17`、`64`，展开次数上限依次为 `17`、`289`、`1,088`，合计 `1,394` 次，每次展开做两遍贪心分配；搜完再从现状朝目标逐份挪动，留下至多 `64` 个候选，每个候选各跑一次带约束 LPT 摆放。以上均为每层、每轮规划的次数上限，不直接等于实际耗时；三个键各自的影响见 [replica_search_num_stages](replica-search-num-stages-e4b10925ff97.md)、[replica_search_radius](replica-search-radius-cd3118b5aae5.md)、[replica_search_beam_size](replica-search-beam-size-6556d1650a62.md)。
- **搬运限额的声明默认与自动回退收紧不同**：早期快照 `4d1412d1` 中 `rank_transfer_limit` 与 `cross_node_transfer_limit` 默认均为 `1`；到了 `v0.30.0` 与 `main`，两项声明默认都改为 `-1`（不以该限额封顶），但当用户**未显式指定 `eplb_config.communicator`** 时，worker 启动会做全组 HIXL 可用性与绑定类型一致性共识——若任一 rank 不可用或绑定类型不一致而自动回退 `torch_gloo`，仅把**用户未显式配置**的搬运限额收紧为 `1`，用户显式写出的值（如 `0` 或 `-1`）会被保留；显式指定 `communicator` 则跳过这条自动选择与收紧路径。细节见 [每卡限制](rank-transfer-limit-99529b37d91d.md) 与 [跨机限制](cross-node-transfer-limit-06ee92260b7a.md)。
- **写错键与跨版本迁移注意**：布尔值、越界值在构造 `StairConfig` 时直接抛 `ValueError`；`v0.30.0` 在 MRv2 中遇到未知 `eplb_config`/`stair_config` 键也会启动失败，而 `main` 改为告警并过滤未知键（不再静默生效，但也不会立刻因拼错子键中断启动）。能解析配置不等于已选中 STAIR，必须同时满足 MRv2、开启 `--enable-eplb` 且最终 `policy == "stair"`。
- **放到 GLM 双机部署**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：
  - 当前 GLM 双机固定镜像 `db701c1f` 未开 EPLB（见 [EPLB 页的 GLM 段](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)），也不认 `stair_config`，写入直接抛 `ValueError: Config has no attribute 'stair_config'`；而且配套 vLLM 0.23.0 无法选上 MRv2（见 [npu-model-runner「会报什么错」](../concepts/npu-model-runner.md#会报什么错)）。
  - 若换到已接入 STAIR 的 `v0.30.0`/`main` 并走 MRv2，但仍沿用零冗余摆法（每卡 18 个专家、无副本位，见 [EP 页](../concepts/expert-parallel.md#16-张卡怎样分专家)），总槽位等于逻辑专家数，副本数无搜索余地、只能换位置。若显式把两项搬运限额设为 `1`（或自动回退 Gloo 收紧为 `1`），则每卡每层至多换进和发出各 1 份、两机每层跨机发收各至多 1 次；这属于给定限额的静态推演，不是所有通信器下的默认行为，也无 GLM 实测。

## 对照源码

下表对照 `eplb_config.stair_config` 在四个固定版本快照上的字段定义、MRv2 策略接入与未知键处理：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段定义 | 无 [C5] | 无 [C7] | `EplbConfig.stair_config: StairConfig` [C31][C32] | 同左 [C39][C40] | 旧版直接报 `Config has no attribute 'stair_config'` [!] |
| 策略接入与默认 | — | — | MRv2 controller + factory 接入，`patch_eplb` 默认策略为 `stair` [C34][C36] | 同左 | 显式选 `policy="default"` 时不消费 `stair_config` |
| 未知键处理（MRv2） | — | — | `_validate_eplb_config` 拒收不支持 `eplb_config` 键，`StairConfig` `extra="forbid"` 拒收拼错子键 [C33] | `_validate_eplb_config` 告警并过滤不支持的 `eplb_config` / `stair_config` 键 [C42] | `main` 对拼错子键由报错改为告警过滤，需看启动日志 [!] |
| 搬运限额默认与回退 | — | — | 声明默认均为 `-1`；自动回退 `torch_gloo` 时仅将未显式填写项收紧为 `1` [C35] | 同左 | 须同时核对显式配置与实际通信器 |

- **规划器与平局排序**：`v0.30.0` 与 `main` 的 `stair.py#L1129-L1255` 实现一致 [C37]：`plan_layer` 剔除平均或 p95 峰均比劣于现状的候选，在内部绝对容差内打平时依次比较跨节点迁移数、同节点远端迁移数、目标专家编号、来源 rank、来源槽位；这是确定性次序，不构成设备收益保证。默认值下 `17 + 289 + 1,088 = 1,394` 次展开与至多 64 次摆放及 GLM 零冗余推演均为按源码结构的静态推导 [D]；设滞回门槛防止小抖动反复搬运来自搬运代价推理 [I]。
- **官方文档**：`v0.30.0`（`expert_parallelism_load_balancer.md#L437-L468`，[S38]）与 `main`（`#L233-L265`，[S43]）均列出十个 STAIR 子键的默认值、合法范围与 `Qwen3-30B-A3B` 示例，并说明默认配置覆盖一般负载、仅在实测需要时再调参。
- **待核**：本工作区无 NPU 实机环境，尚无不同 STAIR 参数组合下的端到端时延、吞吐与搬运开销实测对照。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `EplbConfig.stair_config` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 标识 | `additional_config["eplb_config"]["stair_config"]` |
| 所属类 | `EplbConfig` |
| 类型 | `StairConfig` |
| 默认表达式 | `dataclasses.field(default_factory=StairConfig)` |
| 定义 | `vllm_ascend/ascend_config.py:298` [C31] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
