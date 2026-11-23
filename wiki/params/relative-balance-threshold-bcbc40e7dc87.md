---
id: relative-balance-threshold-bcbc40e7dc87
title: relative_balance_threshold
type: param
origin: seed
evidence: C
summary: >-
  STAIR 判断某层是否重新规划的相对滞回门槛：当前平衡度 ÷ 上次提交摆法时预测的平衡度 ≤ 本值（默认 0.95，合法范围 (0, 1]）即放行该层，与绝对门槛为“或”关系；从未提交过或锚点为空/NaN 的非零负载层直接放行。v0.30.0 与 main 已在 MRv2 STAIR 中生效。
aliases:
  - 相对平衡阈值
  - STAIR relative balance threshold
relations:
  - to: stair-config-cca9e594a052
    kind: builds-on
    note: 这是 stair_config 的一个子键；STAIR 一轮规划的四步、钉点上写了为什么起不来，都在父参数页
  - to: eplb
    kind: builds-on
    note: 平衡度是峰均比的倒数，峰均比怎么算在 EPLB 页
  - to: ascend-config-system
    kind: builds-on
    note: 该参数依赖 AscendConfig 的分层解析机制，必须放在 eplb_config.stair_config 下，并受版本与未知键检查约束。
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
updated: 2026-11-19T00:00:00.000Z
legacyAnchors:
  一句话: 它管什么相对门槛怎么触发
  事实表: 它管什么相对门槛怎么触发
  为什么存在: 为什么需要相对锚点与绝对门槛如何配合
  开了的代价: 调高调低的代价与放到-glm-双机
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L220
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L199-L200'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L246-L249'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L198-L224'
  - >-
    vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L1029-L1041
  - 'vllm-ascend@4ebb3090:vllm_ascend/patch/platform/patch_eplb.py#L493-L498'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L190-L191'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L150-L168'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L947-L985'
  - >-
    vllm-ascend@9f9da5562089280a7f01c3d03e855b258e372807:vllm_ascend/ascend_config.py#L208
  - >-
    vllm-ascend@75bfb762267c86fbec4cf3458ce08a094c0a4c72:vllm_ascend/ascend_config.py#L217
  - >-
    vllm-ascend@2581a69bcc16ee6af56e72985a15799bb5f61808:vllm_ascend/ascend_config.py#L218
  - >-
    raw:sha256-c3bc8568d738df214f635e441cab92474d72242844aaf704866ca1e51d6d0cdd.md#L1-L151
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L198-L223
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/distributed/eplb/policy/stair.py#L950-L983
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L218-L249'
  - 'vllm-ascend@7d825229:vllm_ascend/distributed/eplb/policy/stair.py#L395-L430'
  - 'vllm-ascend@7d825229:vllm_ascend/worker/v2/eplb.py#L45-L59'
  - >-
    vllm-ascend@7d825229c77025cfb185a010c25819c1214b9450:vllm_ascend/ascend_config.py#L220
  - >-
    vllm-ascend@01741ac93f1c3c6241a90b19c14dc58b093eb49c:vllm_ascend/ascend_config.py#L221
  - >-
    vllm-ascend@c09d3e20b9c45c80b34ae3781440d90904a44023:vllm_ascend/ascend_config.py#L218
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L218-L248'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L348-L377'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L398-L435'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/eplb/policy/stair.py#L1183-L1217'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/eplb.py#L37-L60'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L437-L468'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L225-L255'
  - 'vllm-ascend@8d6180e2:docs/source/user_guide/feature_guide/expert_parallelism_load_balancer.md#L233-L265'
rawSources:
  - >-
    raw/sha256-1aa8655fe7ae8108619083e6d270af174771aee2760cba56fafd6c548c5514f8.md
  - >-
    raw/sha256-a05f30259b03d4a7972498440de275ba86ae6396f9bccf57dc441c46a726c65e.md
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
  - >-
    raw/sha256-c3bc8568d738df214f635e441cab92474d72242844aaf704866ca1e51d6d0cdd.md
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
## 它管什么，相对门槛怎么触发？

每一轮 MoE 负载均衡规划前，STAIR 都要筛选「哪些层确实变不均、值得花通信代价重排，哪些层只是轻微抖动、不必折腾」。`relative_balance_threshold` 是 [stair_config](stair-config-cca9e594a052.md) 下的**相对退化门槛**（`float`，默认 `0.95`，合法范围 `(0, 1]`）：它把某层**当前的平衡度**与**上次提交新摆法时预测的平衡度**作比，跌到后者的 `relative_balance_threshold` 倍及以下时，放行该层进入本轮规划。

这里的**平衡度**定义为 $\text{balance} = 1 / \text{平均峰均比}$（`1` 表示各卡完全均匀，越小越不均；峰均比算式见 [EPLB 页](../concepts/eplb.md#怎么算数配对比峰均换位置)）。当某层满足下式即放行：

$$\frac{\text{当前平衡度}}{\text{上次提交时预测的平衡度}} = \frac{\text{上次预测平均峰均比}}{\text{当前平均峰均比}} \le \text{relative\_balance\_threshold}$$

默认值 `0.95` 换算成峰均比约为 $1 / 0.95 \approx 1.053$ 倍：例如上次预测峰均比 `1.20`，当前须升至约 `1.263` 才会触发本门。它与 [absolute_balance_threshold](absolute-balance-threshold-71578a0c428d.md) 是逻辑「或」关系，任一道门槛放行即进入规划。`v0.30.0` 与 `main` 已在 MRv2 STAIR 中实际读取该键；`v0.23.0`、`v0.26.0rc` 与 GLM 固定镜像 `db701c1f` 没有 `stair_config`，写入直接启动报错（入口与旧版报错见 [stair_config](stair-config-cca9e594a052.md)）。

| 维度 | 行为与约束 | 工程含义 |
| --- | --- | --- |
| 配置路径与默认 | `additional_config["eplb_config"]["stair_config"]["relative_balance_threshold"]`，`float`，默认 `0.95` | 默认容忍约 5% 的平衡度相对下滑；需 MRv2 + `--enable-eplb` 且策略为 `stair` |
| 合法取值 | 有限数且 `0 < 值 ≤ 1`；越界报 `stair_config.relative_balance_threshold must be between zero and one`（布尔值报非布尔错误） | `0` 不合法，不能靠写 `0` 关闭该门槛；写负数或大于 `1` 均启动报错 |
| 门控前置顺序 | 先判全零窗口（全零直接跳过，返回 `None`）；再判无提交锚点（`None` 或 `NaN` 且负载非零时直接放行）；其余已存储的预测峰均比须为 `≥ 1` 的有限数（取倒数得平衡度锚点 ∈ `(0, 1]`）才比门槛 | 首轮规划所有非零负载层均直接参与，不因缺少锚点或小阈值被拦下 |
| 锚点来源与更新时机 | 分母取最近一次**真正提交**（搬完权重并刷新路由表）后写回的**预测**平均峰均比，而非上一轮未提交候选或搬完后的实测值 | 规划了但未采纳（如候选都不优于现状）时锚点不变，下一轮仍拿旧锚点比较 |
| 放行后的裁决 | 放行只代表进入规划；候选的平均峰均比和按样本数加权的 p95 峰均比均不得差于现状，胜出者与现状相同则不搬运 | 触发规划与实际搬运不是一回事 |
| 极端取值 `1.0` | 只要当前平衡度不高于上次预测值，每轮都通过相对门槛 | 相对滞回基本失效，每轮重算这些层 |

## 为什么需要相对锚点，与绝对门槛如何配合？

EPLB 每次重排都要把专家权重在卡间拷贝（代价见 [EPLB 页代价一节](../concepts/eplb.md#代价多占的显存搬运和等待)）。负载本就存在抖动，若稍有波动就重排，规划器会被噪声牵着反复搬运。STAIR 将滞回（hysteresis）作为固定策略行为、不提供关闭键，而 `relative_balance_threshold` 控制的就是相对滞回的松紧。

**为什么不能只靠绝对下限？** 不同 MoE 层的负载形态差异很大：
- **先天偏斜层**：即使调到最优峰均比也降不到很低；若只设绝对下限，这类层每轮都会跌破下限、反复重算。
- **高均衡层**：原本能调到接近 `1.0`；若只靠 `0.90` 绝对下限，要退化将近 10% 才被发现。

用各层自己上次提交时的预测值作锚点，就能按每层自身水平判断是否明显变差。需要注意，锚点取的是**预测**峰均比而非搬完后的实测值，省去了提交后再采样的步骤；但预测假定同一专家负载均匀分摊给各份副本（见 [EPLB 副本一节](../concepts/eplb.md#最热的专家怎么办多放一份副本)），若预测偏乐观，搬完后的实测峰均比可能一开始就略差于预测值，从而在下一轮更快再次触发相对门槛。

它与 [absolute_balance_threshold](absolute-balance-threshold-71578a0c428d.md) 为逻辑「或」：绝对门槛只看**当前**平衡度、与锚点无关。若某层最优平衡度始终低于绝对下限，它每轮都会被绝对门槛放行，此时相对门槛不起阻拦作用；反过来，已有锚点且当前平衡度高于绝对下限的层，则只能靠本键放行。

```wiki-diagram
file: param-stair-dual-gate-hysteresis
```

用默认配置（`relative_balance_threshold = 0.95`、`absolute_balance_threshold = 0.90`）对照四组具体数字（**示意**，严格对应 `gated_layer_imbalance` 判据）：

| 场景（示意） | 上次预测峰均比（锚点平衡度） | 当前峰均比（当前平衡度） | 相对比值（$\le 0.95$?） | 绝对值（$\le 0.90$?） | 门控结果 |
| --- | --- | --- | --- | --- | --- |
| A：轻微抖动 | `1.05`（`0.952`） | `1.08`（`0.926`） | $1.05 / 1.08 = 0.972$（否） | `0.926`（否） | **拦截跳过**（过滤噪声） |
| B：好层退化 | `1.02`（`0.980`） | `1.09`（`0.917`） | $1.02 / 1.09 = 0.936$（**是**） | `0.917`（否） | **相对门槛放行**（绝对门槛抓不到） |
| C：先天偏斜层 | `1.18`（`0.847`） | `1.19`（`0.840`） | $1.18 / 1.19 = 0.992$（否） | `0.840`（**是**） | **绝对门槛放行**（相对门槛未触发） |
| D：首轮无锚点 | `None`（未提交过） | `1.03`（`0.971`） | 跳过门槛判断 | 跳过门槛判断 | **直接放行**（非零负载且无锚点） |

## 调高调低的代价与放到 GLM 双机

以下方向分析基于源码控制流与公式，尚缺相同负载下不同阈值的设备实测对照。

- **调高（靠近 `1.0`）**：对已有有效锚点且负载非全零的层，相对门槛变松，小幅退化即可进入规划；取 `1.0` 时只要当前平衡度不高于上次预测值即放行。调高直接增加的是规划机会，是否真正搬运仍取决于候选筛选（平均峰均比与加权 p95 均不得变差，且胜出摆法须不同于现状）。
- **调低（靠近 `0`）**：相对门槛变紧，需更明显退化才会触发，可能令负载不均持续更久。写 `0` 启动报错；写极小正数虽能减少相对门槛触发，但绝对门槛仍可放行满足其条件的层，且无锚点层不受两道门槛拦截。
- **锚点更新陷阱**：锚点仅在某层真正提交新摆法（搬完并刷新路由表）后写回。若某轮放行了规划但最终未采纳搬运，锚点保持旧值，下一轮继续拿旧锚点比对。
- **放到 GLM 双机部署**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：当前部署[未开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，固定镜像 `db701c1f` 也不认 `stair_config`，写入即启动失败（报错见 [stair_config](stair-config-cca9e594a052.md)）。若迁移到支持 STAIR 的版本，该门槛按每个 MoE 层独立判定；但本部署缺乏逐层实测负载分布（见 [EPLB 负载不均说明](../concepts/eplb.md#负载有多不均只有理想均分没有实测)），无法预估具体哪些层触发或触发频率。

## 对照源码

下表对照 `stair_config.relative_balance_threshold` 在四个固定版本快照上的阈值校验、门控顺序与锚点更新：

| 项 | v0.23.0 (`2c59ff10`) | v0.26.0rc (`2ed6cbba`) | v0.30.0 (`c09d3e20`) | main (`8d6180e2`) | 意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 字段与范围 | 无（无 `stair_config`） | 无 | `StairConfig.relative_balance_threshold: float = 0.95`，有限且 `(0, 1]` [C21][C22] | 同左 [C28] | 写 `0`、负数或布尔值均启动报错 |
| 门控与运行时接入 | — | — | MRv2 controller 接入，`gated_layer_imbalance` 按全零跳过 → 无锚点/`NaN` 放行 → 相对或绝对门控执行 [C24][C26] | 同左（`stair.py` 零 diff） | 锚点仅在提交后更新，未搬运不改锚点 [!] |
| 候选筛优 | — | — | `plan_layer` 要求预测平均与 p95 峰均比均不差于现状 [C23][C25] | 同左 | 门槛放行不等于必然发生搬运 |

- **门控与公式核对**：`v0.30.0` 与 `main` 共用 `stair.py#L398-L435`（`gated_layer_imbalance`，[C24]）和 `stair.py#L1183-L1217`（`plan_layer` 非退化筛选，[C25]）；`1 ÷ 0.95 ≈ 1.053` 倍换算、取 `1.0` 时失效及始终低于绝对下限时相对门槛形同虚设均为公式推导 [D]；单层独立锚点动机与预测偏乐观导致次轮再触发为工程推断 [I]。
- **官方文档**：`v0.30.0`（`expert_parallelism_load_balancer.md#L437-L468`，[S27]）与 `main`（`#L233-L265`，[S29]）均写明默认 `0.95`、范围 `(0, 1]`，并指出 STAIR 仅在滞回门槛触发时重排，单靠缩短 `step_interval` 不会强制持续搬运。
- **待核**：本工作区无 NPU 实机环境，尚无不同 `relative_balance_threshold` 取值下的实际重排频次与端到端时延对照。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.relative_balance_threshold` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

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
| 标识 | `additional_config["eplb_config"]["stair_config"]["relative_balance_threshold"]` |
| 所属类 | `StairConfig` |
| 类型 | `float` |
| 默认表达式 | `0.95` |
| 定义 | `vllm_ascend/ascend_config.py:218` [C21] |
| 版本 | releases/v0.30.0 · c09d3e20b9c45c80b34ae3781440d90904a44023 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：
