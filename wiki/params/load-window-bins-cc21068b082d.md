---
id: load-window-bins-cc21068b082d
title: load_window_bins
type: param
summary: >-
  STAIR 在分析上游 EPLB 负载窗口前按时间顺序压缩的最多分段数：默认 64，合法范围 2–256。每段保留段均负载与步数权重，后续均衡度、p95 峰均比、方差与协方差均基于压缩后的分段计算。v0.30.0 与 main 已在 MRv2 STAIR 中实际读取。
aliases:
  - stair_config.load_window_bins
  - 负载窗口分段数
  - 负载窗口压缩箱数
  - STAIR load window bins
origin: seed
evidence: C
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: 2026-11-19T00:00:00.000Z
legacyAnchors:
  一句话: 它管什么分段压缩怎么切
  为什么存在: 为什么先压缩压缩后什么不变什么会变
  开了的代价: 调大调小的反直觉边界与调参前提
  调大调小的反直觉边界与放到-glm-双机: 调大调小的反直觉边界与调参前提
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L218
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L194-L196
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L242-L243
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L85-L98
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L1003
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L157-L168
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L113-L122
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/config/parallel.py#L59-L60
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ascend_config.py#L837
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/config_utils.py#L43
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L233-L237
  - 'https://github.com/vllm-project/vllm-ascend/pull/17511'
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L206
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L215
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L216
  - >-
    raw:sha256-080e7ed22afcadd8bcaeef718f8923b32f03f90a64696b48f85a369ec5adb80d.md#L1-L96
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L86-L99
  - >-
    raw:sha256-ac6ed56054ad9e3191242471b4a0509bf66b62cb87e7c75f8e867267ed988468.md#L1-L113
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L218-L243'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L278-L299'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L45-L59'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L218
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L219
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L216
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L216-L242'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L279-L330'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L348-L377'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/eplb.py#L37-L60'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L437-L456'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L223-L249'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1116-L1154'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L233-L252'
rawSources:
  - >-
    raw/sha256-080e7ed22afcadd8bcaeef718f8923b32f03f90a64696b48f85a369ec5adb80d.md
  - >-
    raw/sha256-108ef212c68577fc9cbea296d8919fc3186e819875398dce5a51863208871ca8.md
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-ac6ed56054ad9e3191242471b4a0509bf66b62cb87e7c75f8e867267ed988468.md
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
    note: 这是 stair_config 第一步窗口压缩的子键；STAIR 四步规划流程与 MRv2 入口见父参数页
  - to: eplb
    kind: builds-on
    note: 压缩的对象是 EPLB 收集的逐专家负载窗口，重排与峰均比计算基础见 EPLB 页
  - to: ascend-config-system
    kind: builds-on
    note: >-
      load_window_bins 必须放在 additional_config.eplb_config.stair_config
      层级中，其配置方式依赖 AscendConfig 的分层解析机制。
---
## 它管什么，分段压缩怎么切？

`load_window_bins` 是 [stair_config](stair-config-cca9e594a052.md) 下的整数参数（默认 `64`，合法范围 `2–256`），决定 STAIR（[Model Runner V2](../concepts/model-runner-v2.md) 默认的动态 [EPLB](../concepts/eplb.md) 规划算法）在分析负载前，把上游收集的逐步负载窗口**按时间顺序压缩成至多多少段**。常规场景保持默认 `64` 即可；调大能保留更细的时间起伏结构，调小则减少后续候选评估扫描的分段数。

上游负载窗口记录最近若干步中每一步、每层、每个专家处理的 token 数。STAIR 不直接逐步运算，而是把样本聚合成 `min(窗口步数, load_window_bins)` 个连续时间箱（bin），每段保留段均负载（或局部聚合时的负载和）与步数权重——并非随机抽 64 个时间点。

后续所有规划统计——判断是否放行规划的均衡度、筛候选所用的平均与加权 p95 峰均比、风险估计所需的均值、方差与协方差——全部基于压缩后的这些段计算。例如上游默认窗口长度为 `1,000` 步时，压成 `64` 段相当于每段合并 `15` 或 `16` 步（实际步数取决于上游 EPLB 窗口参数）。`v0.30.0` 与 `main` 已在 MRv2 STAIR 中实际读取该字段；`v0.23.0` 与 `v0.26.0rc`（及历史旧镜像）无 `stair_config`，写入直接启动报错。

## 事实表

调整 `load_window_bins` 前，先核对分段切法以及压缩前后哪些统计量不变、哪些会变：

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["eplb_config"]["stair_config"]["load_window_bins"]`（`int = 64`） | 只配这一项时其余 STAIR 字段取默认；在 `v0.30.0`/`main` 需启用 MRv2 与 `--enable-eplb` 且策略为 `stair` |
| 合法取值 | 整数 `2`–`256`（拒绝布尔值，越界抛 `ValueError`） | 不能写 `1` 把整个窗口并成一段（尽管内部压缩函数接口允许 `max_bins=1`，公开配置锁死在 `2–256`） |
| 切段方式 | 段数 `= min(窗口步数, load_window_bins)`；边界向下取整，各段步数最多差 1 | 严格保持时间顺序合并相邻步；窗口步数不超过本值时每步自成一段，调大不起作用 |
| 输入校验 | 要求三维 `[steps, layers, experts]` 负载数组，步数非零且数值有限非负 | 不会接受负数、`NaN` 或空窗口 |
| 压缩后不变项 | 按各段步数加权求出的全窗口平均负载与压缩前完全一致 | “哪个专家全窗平均更热”不受段数影响 |
| 压缩后变化项 | 每段先平均再求峰均比（零负载段按 `1` 处理），平均/p95 峰均比及方差、协方差均按段算 | 段内短时尖峰被平滑，只保留段间起伏；重切边界后均衡度与方差均不保证随段数单调变化 |

## 为什么先压缩，压缩后什么不变、什么会变？

原始负载窗口跨度往往达到上千步（例如 1,000 步 × 每层数百个专家）。STAIR 为一层规划时要评估数十个候选摆法，逐一重算窗口均衡度与 p95，还要计算专家两两之间的协方差矩阵——这些计算量与送入评估的样本段数成正比。先把窗口压成至多 64 段，控制的是压缩后交给候选评估与统计计算的样本规模。需要注意，压缩本身仍须读取全部原始窗口并求各段和/均值，预处理开销仍随原始窗口长度增长，不能误解为「整条规划流程与窗口长度无关」。

同时，单步负载受偶然到达的 token 影响较大。按时间顺序把相邻十几步合并，既能降低单步噪声，又能保留「一段时间某批专家热、过一阵换另一批专家热」的阶段性起伏——STAIR 计算协方差以识别「一起变热的专家」，依赖的正是这种段间时间起伏。

```wiki-diagram
file: param-load-window-bins-compression
```

用上图 A 区的五步负载（一层、两专家，教学假设非实测）验证「什么不变、什么消失」：专家 A 依次承担 `2, 6, 0, 4, 8`，专家 B 依次承担 `8, 4, 10, 6, 2`。当 `load_window_bins = 2` 时，边界向下取整为 `0, 2, 5`：

- **第一段（权重 2 步）**：A 均 $(2+6)/2 = 4$，B 均 $(8+4)/2 = 6$。
- **第二段（权重 3 步）**：A 均 $(0+4+8)/3 = 4$，B 均 $(10+6+2)/3 = 6$。
- **结果**：按步数加权后，全窗口均值仍精确为 A=4、B=6；但两段均值完全相等、去均值偏差全为零，压缩后的方差与协方差全部归零——原始五步内的段内起伏在段内平均时已经丢失。源码与 PR #17511 说明此步按时间顺序精确加权压缩，但未给出默认值 `64` 的公开标定推导。

## 调大调小的反直觉边界与调参前提

以下方向性质由源码分段与加权矩公式决定，尚无不同段数下的规划耗时或均衡度实测对照：

- **调大（往 `256` 靠）与调小（往 `2` 靠）的确定边界**：当原始窗口步数大于当前设置时，调大段数能保证保留更细的时间起伏细节（原始步数不超过 `256` 时写 `256` 等于不压缩），同时线性增加每个候选重算峰均比与求协方差所遍历的分段数；至于压缩后方差大小、协方差估计的稳定性与整轮 CPU 实际规划耗时，还共同取决于原始样本步数、真实路由波动形态及候选回溯次数，不能单凭段数增减断定“必然降噪”或“必然变快”。
- **均衡度反向下降反例（调小未必让[两道滞回门槛](absolute-balance-threshold-71578a0c428d.md)更难打开）**：因为「先求段内平均负载、再算峰均比」不等于「先算每步峰均比、再取平均」。设两张卡各放 1 个专家，四步负载依次为 `(1000, 0)`、`(1, 1)`、`(1, 1)`、`(1, 1)`（见上图 B 区，按源码公式手算）：

| 分段设置 | 各段负载（步数权重） | 各段峰均比 | 加权平均峰均比 | 平衡度（`1 / 峰均比`） |
| --- | --- | --- | --- | --- |
| 原 `4` 段 | `(1000, 0)`、`(1, 1)` × 3（各占 `1` 步） | `2, 1, 1, 1` | `1.25` | **`0.800`** |
| 压成 `2` 段 | `(500.5, 0.5)` 与 `(1, 1)`（各占 `2` 步） | `≈ 1.998, 1` | `≈ 1.499` | **`≈ 0.667`（反向下降）** |

  若该层已有历史锚点、相对门槛未触发且绝对阈值设为 `0.70`，压成 `2` 段反而会让它从跳过变成放行规划。
- **重切边界导致方差与加权 p95 非单调**：改变段数会重新切分整数边界，较少段并非较多段的简单两两合并，因此压缩后方差及 [load_risk_quantile](load-risk-quantile-d89a080ba048.md#调高调低与窗口分段的交互边界) 所乘波动项均不随段数单调变化；加权 p95 同样基于段峰均比计算而非原始逐步 p95。
- **调参前提**：段数会同时改变风险估计和滞回门槛的统计输入，调整前须对照线上实际配置的 EPLB 采集窗口长度与采样阶段一并评估。

## 对照源码

下表对照 `stair_config.load_window_bins` 在四个固定版本快照上的范围校验、窗口压缩接入与统计口径：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与范围 | 无（无 `stair_config`）[C9] | 无 | `StairConfig.load_window_bins: int = 64`，合法 `2..256` [C24][C25] | 同左 [C30] | 旧版启动即报缺属性；新版越界或布尔值均抛 `ValueError` |
| 运行时接入 | — | — | MRv2 `AscendEPLBController` 接入，规划前调用 `prepare_local_load_stats` / `compress_load_window` [C26][C28] | 同左（MRv2 `_validate_eplb_config` 改为告警过滤未知子键 [C31]） | `v0.30.0` 与 `main` 均为真实运行时消费，非早期 `4d1412d1` 仅单测状态 [!] |
| 统计公式 | — | — | 按段均值加权算均衡度、p95 与协方差 [C26][C27] | 与 `v0.30.0` 零 diff | 五步归零与四步均衡度反向下降均由该实现推导 [D] |

- **实现与公式核对**：`v0.30.0` 与 `main` 共用完全相同的 `stair.py#L279-L330`（边界向下取整、局部加和分箱、全窗口压缩与加权矩，[C26]）和 `stair.py#L348-L377`（加权均值与最近秩 p95 峰均比，零负载段峰均比按 1 处理，[C27]）。段数减少不消除原始窗口扫描开销、以及协方差稳定性与实际耗时依赖样本形态的边界属于静态推导与统计推断 [D][I]。
- **官方文档**：`v0.30.0`（`expert_parallelism_load_balancer.md#L437-L456`，[S29]）与 `main`（`#L233-L252`，[S32]）均记录默认值 `64` 与范围 `2–256`。
- **待核**：本工作区无 NPU 实机环境，尚无不同 `load_window_bins` 取值下的实际规划耗时、协方差估计稳定性与端到端吞吐对照。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.load_window_bins` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 标识 | `additional_config["eplb_config"]["stair_config"]["load_window_bins"]` |
| 所属类 | `StairConfig` |
| 类型 | `int` |
| 默认表达式 | `64` |
| 定义 | `vllm_ascend/ascend_config.py:216` [C24] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

````python
if not 2 <= self.load_window_bins <= 256:
    raise ValueError('stair_config.load_window_bins must be between 2 and 256')
````
