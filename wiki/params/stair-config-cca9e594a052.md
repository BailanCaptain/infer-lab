---
id: stair-config-cca9e594a052
title: stair_config
type: param
origin: seed
evidence: C
summary: >-
  additional_config.eplb_config 下给 MRv2 STAIR（StairEplbPolicy）调参的嵌套字典，十个数值键分管负载窗口压缩、滞回重排门槛、风险分位数、副本数搜索、搬运上限与有界回溯。v0.30.0 与 main 已接入 MRv2 并默认启用 stair 策略，未指定通信器回退 Gloo 时自动收紧未显式配置的搬运限额。
aliases:
  - STAIR
  - StairConfig
  - StairEplbPolicy
  - eplb_config.stair_config
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
  - to: model-runner-v2
    kind: builds-on
    note: STAIR 仅在 Model Runner V2 的 AscendEPLBController 中接入并默认启用，MRv1 旧规划器拒绝 stair_config
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: 2026-11-19T00:00:00.000Z
legacyAnchors:
  一句话: 它管什么十个旋钮如何配合
  为什么存在: 一轮规划怎么走与-mrv1--mrv2-边界
  开了的代价: 搜索开销、通信器回退收紧与零冗余边界
  代价通信器回退陷阱与放到-glm-双机: 搜索开销、通信器回退收紧与零冗余边界
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
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L690-L696'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L819-L833'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L398-L433'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L485-L515'
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

**启用 MRv2 动态 [EPLB](../concepts/eplb.md#怎么算数配对比峰均换位置) 时，默认参数已经够用；只有在线上观测到重排过频、跨机权重搬运挤占带宽或 CPU 规划耗时偏高时，才在 `stair_config` 里挑对应的子键单独微调。**

在 MoE 分布式推理中，热门专家所在的卡容易排长队，冷门卡却在空等。**STAIR（`StairEplbPolicy`）** 是 `v0.30.0` 与 `main` 在 [Model Runner V2（MRv2）](../concepts/model-runner-v2.md) 上默认启用的 EPLB 规划算法，对应不可变字典配置 `additional_config["eplb_config"]["stair_config"]`（`StairConfig`，`frozen=True`），在常规重排之上增加了三道机制：
1. **波动留余量**：按「均值 + $z \times$ 标准差（含同卡专家协方差）」给专家与单卡打风险分；
2. **双门滞回防抖**：过滤轻微抖动，只让明显变不均的层进入本轮规划；
3. **搬运限流与有界回溯**：约束单轮每卡与跨节点的权重搬运上限。

以下以 `Qwen/Qwen3-30B-A3B` 展示 `v0.30.0` 下的按需覆写形式（`v0.30.0` 启用 V2 EPLB 须导出 `VLLM_USE_V2_MODEL_RUNNER=1`，本工作区无 NPU 实机执行验证）：

```bash
VLLM_USE_V2_MODEL_RUNNER=1 vllm serve Qwen/Qwen3-30B-A3B \
  --tensor-parallel-size 4 \
  --enable-expert-parallel \
  --enable-eplb \
  --eplb-config '{"num_redundant_experts": 4}' \
  --additional-config '{"eplb_config": {"stair_config": {"relative_balance_threshold": 0.93, "cross_node_transfer_limit": 0}}}'
```

## 事实表

启用或排障 `stair_config` 前，先核对以下整体生效门槛与自动回退规则：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["eplb_config"]["stair_config"]`（`StairConfig`） | 省略时 10 个子键全取默认值；只传部分子键时其余子键自动补默认 |
| 生效前提 | [Model Runner V2](../concepts/model-runner-v2.md) + `--enable-eplb` + `policy="stair"`（默认已是 `stair`） | `v0.30.0` 在默认 MRV1 下传入 `stair_config` 会直接抛 `ValueError`；显式选 `policy="default"` 则忽略本字典 |
| 类型与越界校验 | 10 个数值键均严禁布尔值，越界立即抛 `ValueError` | 传 `true`/`false` 报 `STAIR numeric fields must not be booleans`；`v0.30.0` 拼错子键名报错，`main` 告警过滤未知子键 |
| Gloo 通信回退收紧 | 未显式指定 `communicator` 且 **HIXL**（昇腾高速单边内存直传库）共识失败、退回慢速 CPU `torch_gloo` 通信时触发 | 系统仅将**未显式配置**的 `rank_transfer_limit` 与 `cross_node_transfer_limit` 从 `-1` 自动限流收紧为每步只搬 `1` 个专家 |
| 两道独立互斥校验 | ① `parallel_config.enable_eplb` 禁配权重 offload/prefetch 与 elastic EP（并强制异步）；② `enable_force_eplb` 硬互斥只查旧 `eplb_config.dynamic_eplb`（MoE） | MRv2 开 `--enable-eplb` 不会触发 [`enable_force_eplb`](enable-force-eplb-b7ec3661121f.md) 报错，但强制路由会篡改输出，测真实 EPLB 时必须手动关闭它 |
| 版本可用性 | `v0.30.0`、`v0.30.0rc2`、`main` 支持；`v0.23.0`、`v0.26.0rc` 无 | 旧分支（及历史旧镜像）写入会报 `Config has no attribute 'stair_config'` |

## 十个子键分工与范围一览

十个子键的分工、声明默认值与合法取值范围一览如下：

| 子键 | 所属步骤 | 声明默认（v0.30.0 / main） | 合法范围 | 一句话作用 |
| --- | --- | --- | --- | --- |
| [`load_window_bins`](load-window-bins-cc21068b082d.md) | ① 压缩负载窗口 | `64` | `2`–`256` | 按时间顺序将窗口步数压成至多这么多段 |
| [`relative_balance_threshold`](relative-balance-threshold-bcbc40e7dc87.md) | ② 滞回重排门槛 | `0.95` | `(0, 1]` | 当前平衡度 ÷ 上次提交预测平衡度 `≤` 本值时放行进入规划 |
| [`absolute_balance_threshold`](absolute-balance-threshold-71578a0c428d.md) | ② 滞回重排门槛 | `0.90` | `(0, 1]` | 当前平衡度 `≤` 本值时放行进入规划（与相对门槛为“或”） |
| [`load_risk_quantile`](load-risk-quantile-d89a080ba048.md) | ③ 风险估计 | `0.75` | `(0.5, 1)` | 单侧标准正态分位数换算 `z`（默认约 `0.674`） |
| [`replica_search_num_stages`](replica-search-num-stages-e4b10925ff97.md) | ③ 副本数搜索 | `4` | `1`–`8` | 按风险排序的专家分阶段组数 |
| [`replica_search_radius`](replica-search-radius-cd3118b5aae5.md) | ③ 副本数搜索 | `8` | `0`–`32` | 每段以贪心预算为中心的左右试探半径 |
| [`replica_search_beam_size`](replica-search-beam-size-6556d1650a62.md) | ③ 副本数搜索 | `64` | `1`–`128` | 每段与最终进入摆放保留的候选上限 |
| [`rank_transfer_limit`](rank-transfer-limit-99529b37d91d.md) | ④ 约束摆放 | `-1`（不限） | `-1` 或 `≥ 1` | 单层单轮每卡换入与发出上限，并截断副本调整步数 |
| [`cross_node_transfer_limit`](cross-node-transfer-limit-06ee92260b7a.md) | ④ 约束摆放 | `-1`（不限） | `≥ -1`（`0` 禁跨机） | 单层单轮每节点跨机发出与接收上限 |
| [`placement_search_backtrack_limit`](placement-search-backtrack-limit-82b03cef98b0.md) | ④ 约束摆放 | `32` | `0`–`64` | 单个候选带约束 LPT 摆放允许的替代可行分支次数 |

## 一轮规划怎么走，与 MRV1 / MRV2 边界

在 `v0.30.0` 与 `main` 上，只要运行在 MRv2 下并开启 `--enable-eplb`，`patch_eplb.py` 已把上游默认策略改为 `stair`（显式设 `policy="default"` 则不消费 `stair_config`）。运行期由 `AscendEPLBController` 按设定步长采集负载并调用 `StairEplbPolicy`，每轮严格区分**允许进入规划**、**候选胜出**与**实际搬运**三个事件：

```wiki-diagram
file: param-stair-config-pipeline
```

1. **压缩负载窗口**：按时间顺序把上游累积的逐步负载并成至多 `load_window_bins` 个分箱，每箱保留段均值与样本步数，后续统计全部在分箱上完成。
2. **双门滞回放行规划**：平衡度定义为 `1 ÷ 平均峰均比`（`1` 最佳）。先跳过全零窗口层；从未提交过新摆法的非零层直接放行；已提交过的层满足 `当前平衡度 ÷ 上次提交预测平衡度 <= relative_balance_threshold` **或** `当前平衡度 <= absolute_balance_threshold`（两道门均含等号）时**放行进入本轮规划**，并按当前平均峰均比降序排队。
3. **风险打分与分阶段副本数搜索**：按 `均值 + z × 标准差` 计算每个专家风险。随后把按风险降序排列的专家分成 `min(replica_search_num_stages, 专家数)` 组（不建空组），逐段在中心贪心预算 `± replica_search_radius` 内展开并按 `replica_search_beam_size` 截断，生成副本份数候选。
4. **带约束 LPT 摆放、候选胜出与实际搬运裁决**：对每个候选按风险从高到低跑 LPT（每次放入放后风险最低的合法卡，含同卡协方差），遵守每卡与跨机限额并允许有界回溯。**候选过关条件仅要求预测平均峰均比与加权 p95 峰均比均不退化（`<=` 现状，代码无“至少一项严格改善”条件）**；过关者取平均峰均比最小（容差内依次按跨节点迁移数、同节点远端迁移数、目标专家编号、来源 rank、来源槽位确定平局次序）选出**胜出方案**；仅当胜出方案的物理专家排布不同于现状时，才触发**实际权重搬运**。

用一个 **2 节点 × 2 卡（共 4 卡）、每卡 2 槽（共 8 槽）、6 个逻辑专家 `E0..E5`（额外副本槽 $8 - 6 = 2$）** 的单层示意算例串联四步（设默认门槛，有效搬运限额均为 `1`）：

| 规划阶段 | 关键参数与输入（示意） | 实际计算与输出 |
| --- | --- | --- |
| ① 压缩负载窗口 | 窗口累计 `128` 步，`load_window_bins = 64` | 每连续 2 步合并为 1 箱，压成 `64` 箱（每箱记均值与样本数 `2`） |
| ② 滞回门槛筛选 | 上次预测峰均比 `1.10`（平衡度 $1/1.10 \approx 0.909$），当前 `1.25`（平衡度 `0.800`） | 相对比值 $0.800 / 0.909 = 0.880 \le 0.95$，绝对值 $0.800 \le 0.90$，**放行进入规划** |
| ③ 风险与副本搜索 | `load_risk_quantile = 0.75`（$z \approx 0.674$），`rank_transfer_limit = 1` | 按 $\mu + 0.674\,\sigma$ 排序搜索副本数；增量挪动步数截断为 $\min(8 - 6,\ 4 \times 1) = 2$ 步 |
| ④ 约束 LPT 与裁决 | 每卡限 `1` 进/`1` 出、每节点限 `1` 跨机进/出，回溯上限 `32` | 逐份放完 8 份副本；预测平均与加权 p95 峰均比均不劣于现状（`<=`）即可参选，胜出摆法异于现状才实际搬运 |

**固定行为与两道互斥校验边界**：「含协方差的风险估计」与「双门滞回」是 STAIR 的内置行为，无关闭开关。各版本及运行路径校验规则如下：

| 版本 / 运行路径 | 实际行为与校验结果 |
| --- | --- |
| `v0.23.0` / `v0.26.0rc`（及历史旧镜像） | 无此键；写入触发 `ValueError: Config has no attribute 'stair_config'` |
| 早期 `main`（如 `baa023ad`） | 无此键；被 pydantic `extra="forbid"` 拒收 |
| 2026-09-26 PR #17511/#17512（如 `4d1412d1`） | 仅存在配置校验与单测、尚未接入服务；次日 PR #17514 才接入 MRv2 工厂 |
| `v0.30.0` + MRV1 | `eplb_policy_type`（`0–3`）只属于 MRv1 旧规划器且无 STAIR 编号；MRv1 下写 `stair_config` 或 `load_collection_phase` 直接抛 `ValueError` |
| `v0.30.0` + MRV2 | `additional_config.eplb_config` 只接受 `stair_config` 与 `load_collection_phase`，拒绝其余旧键；未知子键由 `StairConfig` 的 `extra="forbid"` 报错 |
| `main`（已移除 MRV1） | `_validate_eplb_config` 对 MRv2 中不支持的 `eplb_config` 键与未知 `stair_config` 子键**打印警告并过滤丢弃**后再解析；已知子键的布尔/越界值仍会启动报错 |
| 两道独立互斥校验 | ① 平台层按 `parallel_config.enable_eplb`（`--enable-eplb`）拦截权重 offload/prefetch 与 elastic EP，并将同步 EPLB 强制改写为异步；② [`enable_force_eplb`](enable-force-eplb-b7ec3661121f.md) 的硬互斥读取旧 `additional_config.eplb_config.dynamic_eplb`（且限 MoE 模型），不拦截 MRv2 `--enable-eplb`，跑真实 EPLB 时须手动确保强制路由关闭 |

## 搜索开销、通信器回退收紧与零冗余边界

- **副本数搜索的预算展开上界与贪心次数**：副本数搜索只对前 `num_stages - 1` 组展开，每阶段保留至多 `beam_size` 个状态。在默认值（阶段 `4`、半径 `8`、束宽 `64`）下，三个展开阶段的输入状态数上界依次为 `1`、`17`、`64`（共至多 `82` 个输入状态）：每个输入状态先做 **1 次贪心分配**求出该组中心预算，再对合法区间内的至多 `2 × 8 + 1 = 17` 个预算逐一展开（每次展开做 **2 次贪心分配**）。因此 `17 + 289 + 1,088 = 1,394` 是**预算展开次数的配置上界**（越界预算会被合法区间裁掉）；搜完再从现状朝目标逐份挪动，送入至多 `64` 次带约束 LPT 摆放（详见 [replica_search_num_stages](replica-search-num-stages-e4b10925ff97.md)、[replica_search_radius](replica-search-radius-cd3118b5aae5.md)、[replica_search_beam_size](replica-search-beam-size-6556d1650a62.md)）。
- **Gloo 自动回退仅收紧未显式填写的搬运限额**：`v0.30.0` 与 `main` 中，`rank_transfer_limit` 与 `cross_node_transfer_limit` 的声明默认均为 `-1`（不封顶）。当用户**未显式填写 `eplb_config.communicator`** 时，Worker 启动期会检查全组 HIXL 可用性与绑定一致性；一旦回退到慢速 CPU `torch_gloo`，系统只会把**用户未显式配置**的限额从 `-1` 收紧为 `1`，用户手写的值（如 `0` 或 `-1`）原样保留。若显式指定了 `communicator`，则跳过整条自动回退收紧逻辑（见上图 B 区，细则见 [每卡限制](rank-transfer-limit-99529b37d91d.md) 与 [跨机限制](cross-node-transfer-limit-06ee92260b7a.md)）。
- **零冗余槽位与跨版本迁移边界**：当 `num_redundant_experts = 0`（总物理槽位等于逻辑专家数）时，副本份数没有搜索余地，STAIR 只能在现有专家之间调换物理卡位；给定限额下的每卡与跨节点搬运次数上界分别见 [`rank_transfer_limit`](rank-transfer-limit-99529b37d91d.md) 与 [`cross_node_transfer_limit`](cross-node-transfer-limit-06ee92260b7a.md)，历史双机部署的版本演进与零冗余后果已集中归入[固定双机部署的参数后果](../concepts/glm-5-3-flash-two-node.md#这套部署给后面各章留下的后果)。

## 对照源码

下表对照 `eplb_config.stair_config` 在四个固定版本快照上的字段定义、MRv2 策略接入与未知键处理：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段定义 | 无 [C5] | 无 [C7] | `EplbConfig.stair_config: StairConfig` [C31][C32] | 同左 [C39][C40] | 旧版直接报 `Config has no attribute 'stair_config'` [!] |
| 策略接入与默认 | — | — | MRv2 controller + factory 接入，`patch_eplb` 默认策略为 `stair` [C34][C36] | 同左 | 显式选 `policy="default"` 时不消费 `stair_config` |
| 未知键处理（MRv2） | — | — | `_validate_eplb_config` 拒收不支持 `eplb_config` 键，`StairConfig` `extra="forbid"` 拒收拼错子键 [C33] | `_validate_eplb_config` 告警并过滤不支持的 `eplb_config` / `stair_config` 键 [C42] | `main` 对拼错子键由报错改为告警过滤，需看启动日志 [!] |
| 搬运限额默认与回退 | — | — | 声明默认均为 `-1`；自动回退 `torch_gloo` 时仅将未显式填写项收紧为 `1` [C35] | 同左 | 须同时核对显式配置与实际通信器 |

- **门控、搜索与两道互斥核对**：`v0.30.0` 与 `main` 的 `stair.py` 完全一致——两道含等号的滞回门放行规划见 `stair.py#L398-L433` [C46]，每输入状态先做一次贪心求中心预算再按合法区间展开见 `stair.py#L485-L515` [C47]，`plan_layer` 仅要求平均与 p95 峰均比均不退化（`<=`）并在异于现状时返回新方案见 `stair.py#L1129-L1255` [C37]；平台层按 `parallel_config.enable_eplb` 检查卸载/elastic EP 见 `platform.py` [C33][C42]，而 `enable_force_eplb` 硬互斥读取旧 `eplb_config.dynamic_eplb` 见 `ascend_config.py` [C44][C45][!]。默认值下 `17 + 289 + 1,088 = 1,394` 次展开上界与零冗余仅换位均为静态推导 [D]；滞回防抖动机来自搬运代价推理 [I]。
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
