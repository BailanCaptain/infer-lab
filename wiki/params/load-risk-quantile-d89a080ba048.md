---
id: load-risk-quantile-d89a080ba048
title: load_risk_quantile
type: param
summary: >-
  STAIR 评估专家与卡负载风险时所用的单侧标准正态分位数：把负载记为均值 + z × 标准差（卡级风险计入同卡专家协方差），默认 0.75（z ≈ 0.674），合法范围 (0.5, 1)。只影响候选生成（副本数与摆放），不影响门槛和最终优胜筛选。v0.30.0 与 main 已接入 MRv2。
aliases:
  - stair_config.load_risk_quantile
  - 负载风险分位数
  - STAIR load risk quantile
  - 专家负载协方差风险
origin: seed
evidence: C
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: 2026-11-19T00:00:00.000Z
legacyAnchors:
  一句话: 它管什么分位数如何换算为风险分数
  为什么存在: 为什么算波动和协方差以及它用在哪里不用在哪里
  开了的代价: 调高调低的边界与放到-glm-双机
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L219
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L190-L198
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L229-L231
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L244-L245
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L172-L187
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L809-L810
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L443-L452
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L102-L122
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L662-L667
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L950-L955
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ascend_config.py#L837
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/config_utils.py#L43
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L233-L237
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L227-L237
  - 'https://github.com/vllm-project/vllm-ascend/pull/17511'
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L207
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L216
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L217
  - >-
    raw:sha256-a5141c836fde46945c437fc0895f72b7b64f4a757636c9423fe4e9f460a474bd.md#L1-L147
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L197-L198
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L218-L231
  - >-
    raw:sha256-0d8caf444d3fca63a7fe53e9facbc116e65fbc7a525aa94e3adb80c6e8909f73.md#L1-L169
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L218-L245'
  - >-
    vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L1142-L1175
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L45-L59'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L219
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L220
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L217
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L217-L244'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L310-L330'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L380-L396'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L1145-L1189'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/eplb.py#L37-L60'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L437-L456'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L224-L251'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L233-L252'
rawSources:
  - >-
    raw/sha256-0d8caf444d3fca63a7fe53e9facbc116e65fbc7a525aa94e3adb80c6e8909f73.md
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-76c09d1a58e3f562ecbbab086104b06ff633e817a512decb4721eec64b143f43.md
  - >-
    raw/sha256-a5141c836fde46945c437fc0895f72b7b64f4a757636c9423fe4e9f460a474bd.md
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
    note: 这是 stair_config 的风险估计子键；STAIR 四步规划流程与 MRv2 默认接入边界见父参数页
  - to: eplb
    kind: builds-on
    note: 按风险分数分配冗余副本并摆放专家用于降低 MoE 峰均比，EPLB 原理与副本机制见该页
  - to: load-window-bins-cc21068b082d
    kind: builds-on
    note: 风险分位数作用于压缩窗口估出的方差与协方差，其效果依赖窗口分段保留的负载波动。
  - to: ascend-config-system
    kind: builds-on
    note: >-
      该参数通过 additional_config 的 eplb_config.stair_config 层级配置，依赖 AscendConfig
      按子配置层级解析；是否接受该键须按版本判断。
---
## 它管什么，分位数如何换算为风险分数？

`load_risk_quantile` 是 [stair_config](stair-config-cca9e594a052.md) 下的浮点参数（默认 `0.75`，合法开区间 `(0.5, 1)`），决定 STAIR（vllm-ascend 为 [Model Runner V2](../concepts/model-runner-v2.md) 编写的动态 [EPLB](../concepts/eplb.md) 规划算法）估算专家和单卡负载时**按多保守的波动余量计分**。常规负载保持默认 `0.75` 即可，仅在突发尖峰共热明显、希望更积极拆分高波动专家时适度上调（如 `0.85`–`0.90`）；它只管 EPLB 规划评分，与模型解码采样分位数无关。

专家负载会随时间起伏，STAIR 不只看平均负载，而是把每个专家与每张卡的负载记为：

$$\text{risk} = \mu + z \cdot \sigma, \quad z = \Phi^{-1}(\text{load\_risk\_quantile})$$

其中 $\Phi^{-1}$ 为标准正态分布的反累积分布函数（`NormalDist().inv_cdf(load_risk_quantile)`）。默认 `0.75` 对应 `z ≈ 0.674`；常见取值对应 `0.75 → 0.674`、`0.90 → 1.282`、`0.95 → 1.645`、`0.99 → 2.326`。`z` 越大，规划器越把「波动大的专家」当成重负载来优先照顾。

**正态假定与版本边界**：这里只是借用标准正态分位数给波动项加权。只有在负载近似正态且均值、标准差准确描述该分布时，风险分数才具对应分位点的概率含义；对一般实际负载，它只是「均值加波动余量」的启发式评分，源码不检验负载是否服从正态分布，默认 `0.75` 也不保证实际负载有 75% 概率低于该分数。`v0.30.0` 与 `main` 已在 MRv2 STAIR 中实际消费该参数；`v0.23.0`、`v0.26.0rc` 与 GLM 固定镜像 `db701c1f` 不存在 `stair_config`，写入直接启动失败。

## 事实表

调整 `load_risk_quantile` 前，先分清它在「生成候选」与「裁决优胜」两个阶段的作用边界：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["eplb_config"]["stair_config"]["load_risk_quantile"]`（`float = 0.75`） | 默认对应 $z \approx 0.674$；在 `v0.30.0`/`main` 需启用 MRv2 与 `--enable-eplb` 且策略为 `stair` |
| 合法取值 | 有限浮点数且 `0.5 < 值 < 1`（两端均不含，拒绝布尔值） | 强制保证 $z > 0$，不能写 `0.5` 关闭波动项，只能用接近 `0.5` 的小数弱化波动权重 |
| 专家风险计算 | 从压缩窗口按步数加权求均值与样本方差，算 `均值 + z × 标准差` | 平均负载相同时，时间波动更大的专家风险分更高 |
| 生效位置① 副本份数 | 额外副本位按 `风险 ÷ 已有份数` 从高到低分配 | `z` 越大，波动大的专家越优先分到冗余副本 |
| 生效位置② 卡上摆放 | LPT 每次选“放入后卡风险最低”的合法卡，卡方差计入同卡专家两两协方差 | 正协方差（同卡共热）会推高卡方差，`z` 越大越倾向把一起变热的专家拆到不同卡 |
| 不生效位置 | 两道滞回重排门槛、候选去留与最终排名均按窗口内实际负载的峰均比计算 | `z` 只决定“提出哪些候选”，过高会导致候选的平均峰均比偏离最优而被最终裁决淘汰 |

## 为什么算波动和协方差，以及它用在哪里、不用在哪里？

若只按每个专家的平均负载来摆放，平均上看似均衡的摆法一旦把两个「成组变热」的专家（例如同一类请求进来时同时被高频路由）放在同一张卡上，平时均值看不出异常，一到并发高峰这张卡就会拉高整层峰均比（峰均比定义见 [EPLB 页](../concepts/eplb.md#怎么算数配对比峰均换位置)）。STAIR 把单专家波动和同卡专家两两**协方差**（衡量两个专家是否经常在同一时段一起变热的统计量）都写进风险公式，让一起变热的专家叠加出更大的卡级方差，从而推动 **LPT**（最长任务优先，按风险从重到轻优先摆进最轻卡）摆放把它们拆开。源码注释将「考虑协方差的风险估计」定义为策略固定行为、不可关闭，用户能调节的只有 `z` 的大小。

```wiki-diagram
file: param-load-risk-quantile-scope
```

**同均值拉分示意（教学假设，非设备测量）**：两个专家平均负载都是 `10`，标准差分别为 `0` 和 `4`。取默认 `0.75`（`z ≈ 0.674`）时，二者风险分数分别为 $10 + 0.674 \times 0 = 10$ 与 $10 + 0.674 \times 4 \approx 12.696$。均值相同的专家因波动不同在规划器眼中拉开差距；注意该分数仅用于规划排序，不代表多出来的实际计算量。源码注释与 PR #17511 说明了分位数换算方式，但未公开 `0.75` 默认值的具体标定场景。

**严格分清「候选生成」与「候选裁决」的分工**：
- **候选生成（受 `z` 驱动）**：副本数搜索与带约束 LPT 摆放使用 `z`，用来提出更抗抖动的摆法。
- **候选裁决（与 `z` 无关）**：该层是否进入规划（相对/绝对门槛）以及最终采纳哪个候选（平均峰均比与加权 p95 峰均比均不得差于现状，再按平均峰均比最小及迁移次数平局规则选优），全部依据压缩窗口里的实际负载。

## 调高调低的边界与放到 GLM 双机

以下方向分析来自配置规则与源码统计公式推导，尚无不同分位数下的均衡度或端到端时延实测对照。

- **调高（往 1 靠）**：`z` 增大，规划器越按最坏波动情形摆放，波动大的专家更易多拿副本并被拆开。代价是这样生成的候选按平均负载看未必最均衡；而最终裁决仍要求平均峰均比与 p95 峰均比都不差于现状并按平均峰均比排名，因此 `z` 过高时提出的候选容易因平均峰均比劣化而通不过裁决，反而导致该层保持不动。
- **调低（往 0.5 靠）**：`z` 趋近 0，风险估计退化为近似只看均值，方差与协方差作用减弱；此时长尾 p95 主要靠最终裁决中的「p95 不得变差」硬约束兜底。
- **搜索规模不变，回溯次数随候选排序变化**：副本数搜索规模由 [replica_search_num_stages](replica-search-num-stages-e4b10925ff97.md)、[replica_search_radius](replica-search-radius-cd3118b5aae5.md) 与 [replica_search_beam_size](replica-search-beam-size-6556d1650a62.md) 决定，不随 `z` 变化；但 `z` 改变后产出的候选与排序不同，LPT 摆放时的回溯次数与可行候选数也会随之变化。
- **依赖压缩窗口的方差（零方差与非单调边界）**：
  - **零方差条件**：方差由压缩分段后的加权协方差对角线算出，段内起伏已被平均。窗口只有 1 个样本时方差直接为 0；即使总样本数大于 1，只要某专家在所有压缩分段里的段均值完全相同，去均值偏差全为零，其方差仍为 0——此时提高分位数不会增加该专家的风险波动项（这是压缩后统计量的代数条件，不代表原始逐步负载从未波动）。
  - **边界重切导致非单调**：改变 [load_window_bins](load-window-bins-cc21068b082d.md) 会重切分段边界，较少段不一定由较多段直接合并而成，不能断定减少段数一定会降低方差或削弱 `z` 的作用。以单专家八步负载 `0, 0, 0, 10, 0, 0, 0, 0` 手算对照（按源码公式，非实测，全窗均值均为 `1.25`）：

| 分段数 | 含峰值 `10` 所在段的切法 | 压缩后加权样本方差 | 结论 |
| --- | --- | --- | --- |
| `6` 段 | `10` 与前一个 `0` 合并，段均值 `5`（权重 `2`） | `≈ 5.357` | 峰被邻步摊低 |
| `5` 段 | `10` 单独成段，段均值 `10`（权重 `1`） | `12.5` | 段数更少，方差反而升高一倍以上 |

- **放到 GLM 双机部署**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：16 张卡、EP16，每卡每层 18 个路由专家，零冗余）：当前部署[未开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，固定镜像 `db701c1f` 不认 `stair_config`，写入直接报 `Config has no attribute 'stair_config'`。按源码推演，若在支持 STAIR 的版本上以零冗余运行，288 个专家各 1 份正好填满 `16 × 18` 槽位，「分几份」没有余地，`z` 只剩「先摆谁、摆到哪张卡」的作用；每层计算 `288 × 288` 协方差矩阵在 CPU 上属于小矩阵运算，规模本身不构成主要瓶颈。

## 对照源码

下表对照 `stair_config.load_risk_quantile` 在四个固定版本快照上的分位数校验、风险换算与候选生成消费：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与校验 | 无（无 `stair_config`）[C11] | 无 | `StairConfig.load_risk_quantile: float = 0.75`，有限且 `(0.5, 1)`，`z_score = NormalDist().inv_cdf(...)` [C28][C29] | 同左 [C35] | 不能填 `0.5` 关闭波动项，布尔值与越界均抛 `ValueError` |
| 运行时消费 | — | — | MRv2 controller 接入，`weighted_moments` + `expert_risk` + `plan_layer` 实际消费 [C30][C31][C32][C33] | 同左（`stair.py` 零 diff） | 与早期 `4d1412d1` 仅单测不同，现已进入 MRv2 实际规划 [!] |
| 候选筛选分工 | — | — | `plan_layer` 用 `z_score` 生成候选，用实际窗口负载的 mean/p95 峰均比筛优 [C32] | 同左 | 调高 `z` 不改变优胜评判口径，过高反而可能令候选难以过关 [D] |

- **公式与反例核对**：`weighted_moments`（`stair.py#L310-L330`，[C30]）与 `expert_risk`（`#L380-L396`，[C31]）在 `v0.30.0` 与 `main` 上一致；正态分位数到 `z` 换算、`10 / 12.696` 示意示例、零方差条件及 6 段（`5.357`）vs 5 段（`12.5`）方差反例均为按固定公式的代数推导 [D]，288×288 CPU 小矩阵开销与 `z` 过大易无候选过关为工程推断 [I]。
- **官方文档**：`v0.30.0`（`expert_parallelism_load_balancer.md#L437-L456`，[S34]）与 `main`（`#L233-L252`，[S36]）均记载默认 `0.75` 与开区间 `(0.5, 1.0)`。
- **待核**：本工作区无 NPU 实机环境，尚无不同 `load_risk_quantile` 取值下的实际峰均比、搬运频次与端到端时延实测对照。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.load_risk_quantile` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 标识 | `additional_config["eplb_config"]["stair_config"]["load_risk_quantile"]` |
| 所属类 | `StairConfig` |
| 类型 | `float` |
| 默认表达式 | `0.75` |
| 定义 | `vllm_ascend/ascend_config.py:217` [C28] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if not math.isfinite(self.load_risk_quantile) or not 0.5 < self.load_risk_quantile < 1:
    raise ValueError('stair_config.load_risk_quantile must be between 0.5 and one')
````
