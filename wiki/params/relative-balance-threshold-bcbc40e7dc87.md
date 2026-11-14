---
id: relative-balance-threshold-bcbc40e7dc87
title: relative_balance_threshold
type: param
origin: seed
evidence: C
summary: >-
  STAIR 的相对重排门槛：某层当前平衡度 ÷ 上次提交新摆法时预测的平衡度 ≤ 本值（默认
  0.95）就重新规划这一层，与绝对门槛是「或」的关系；从没提交过的层不看门槛。rc2 已接入 MRV2 的 EPLB；早期扫描快照尚未接入服务。
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
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
updated: 2026-11-03T00:00:00.000Z
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
    raw/sha256-ebc514e0f60b58ff8115eb677ddc78fa222976b6c86c214942a1d9f8502a3fe7.md
---
## 一句话

**v0.30.0rc2 对照。** 默认 0.95、范围 (0,1] 与旧扫描一致，MRV2 STAIR 现已实际读取。比较的分母是最近一次真正提交的专家摆放所预测的均衡度，不是上一轮未提交候选；绝对门槛与相对门槛仍是“或”。非零负载但尚无提交锚点时直接评估，零负载窗口跳过。下文规划器未接入的限制只属于原先的历史快照。

`relative_balance_threshold` 是 [stair_config](stair-config-cca9e594a052.md) 下的一个小数，回答 STAIR 每轮规划前的一个问题：**这一层比上次调好时变差了多少，才值得再调一次**。它比的是平衡度——平衡度 = 1 ÷ 平均峰均比，1 表示各卡完全均匀，越小越不均（峰均比怎么算见 [EPLB 页](../concepts/eplb.md#怎么算数配对比峰均换位置)）[C7]。某层当前平衡度 ÷ 上次提交新摆法时预测的平衡度 ≤ 本值，这一层就进入本轮规划 [C2]。默认 0.95。

换成峰均比说更直观：默认值下，当前峰均比要涨到上次预测值的 1 ÷ 0.95 ≈ 1.053 倍以上才会重排，比如上次预测 1.20，现在要到约 1.263 才动 [D]。这道门槛和 [absolute_balance_threshold](absolute-balance-threshold-71578a0c428d.md) 是「或」的关系，任一个触发都算 [C4]。

**旧版本与 GLM 范围**：v0.23、GLM 镜像、v0.26、固定 main baa023ad 没有此键，写入会启动报错；下文算法走读按后来的 main 提交 4d1412d1，当时规划器尚未接入服务。当前参数定义取 rc2，谱系 main 仍是 baa023ad、rc2 单列，启用条件见 [stair_config](stair-config-cca9e594a052.md#一句话)。GLM 双机没开 EPLB，这个键用不上。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["relative_balance_threshold"]` |
| 类型 | `float` |
| 默认表达式 | `0.95` |
| 定义 | `vllm_ascend/ascend_config.py:220` [C19] |
| 版本 | releases/v0.30.0rc2 · 7d825229c77025cfb185a010c25819c1214b9450 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 事实表

| 项 | 扫描提交 4d1412d1 上的值或行为 | 意味着什么 |
|---|---|---|
| 完整路径 | `additional_config["eplb_config"]["stair_config"]["relative_balance_threshold"]` | 只能嵌在 `stair_config` 里 |
| 旧钉点上是否存在 | v0.23、GLM 镜像、v0.26、main baa023ad 都没有 | rc2 已有并接入服务；旧版报错见 [stair_config 事实表](stair-config-cca9e594a052.md#事实表) |
| 类型 / 默认值 | `float`，0.95 | 默认容忍约 5% 的平衡度下滑 |
| 合法取值 | 0 < 值 ≤ 1 且为有限数；否则报 `stair_config.relative_balance_threshold must be between zero and one`（源码是 f-string，键名由循环填入）[C3] | 0 不合法：写 0、负数或 1.2 都会启动报错，不能靠写 0 关掉这道门槛 |
| 触发条件 | 当前平衡度 ÷ 上次提交时预测的平衡度 ≤ 本值，或当前平衡度 ≤ 绝对阈值 [C4] | 两道门槛任一道放行即可 |
| 不看门槛的情形 | 这一层从没提交过新摆法（锚点为空）时直接放行；整个负载窗口全是 0 时直接跳过 [C4] | 第一轮规划所有有负载的层都会参与 |
| 锚点从哪来 | 规划结果里每层的预测峰均比；4d1412d1 上没有调用方写回，4ebb3090 上在这一层搬完、刷新路由表之后才写回 [C6] | 比的是「上次规划说会有多好」，不是「上次实际有多好」 |
| 放行之后 | 只是进入本轮规划；候选摆法的平均与 p95 峰均比都不能比现状差，选出来的仍是现状就不动 [C9] | 门槛放行不等于一定会搬 |
| 取 1.0 时 | 只要当前不比预测好，每轮都放行 [D] | 迟滞基本失效，规划器每轮都会重算这些层 |

在本页所述实现中，锚点也可以用 NaN 表示尚无预测基准；这种情况下，有非零负载就直接放行。全零负载窗口的跳过检查在前，因此不会因为缺少锚点而被放行。

## 为什么存在

EPLB 每次重排都要把专家权重在卡之间拷来拷去（代价见 [EPLB 页的代价一节](../concepts/eplb.md#代价多占的显存搬运和等待)）。负载本身总在抖动，如果「比上次差一点就重排」，规划器就会被抖动牵着反复搬。STAIR 的源码注释把这道「迟滞」写成策略必有的行为 [C7]，本键就是它的松紧：只有退化超过一定比例才动手。

为什么用「相对」而不只用一个绝对下限：不同层的负载形状不同，有的层调到最好峰均比也下不来，有的层能调到接近 1。只设绝对下限，前一种层每轮都低于下限、每轮都被重排；后一种层要退化很多才碰到下限。拿「这一层自己上次的预测」做基准，每层按自己的水平判断有没有变差 [I]。

锚点用的是上次规划时**预测**的峰均比，不是实测值 [C4]。好处是不需要在搬完之后再额外统计一次；代价是预测本身偏乐观时（预测会按「负载平均分给各份副本」来估 [C8]，实际分摊方式见 [EPLB 页的副本一节](../concepts/eplb.md#最热的专家怎么办多放一份副本)），搬完后的实测峰均比可能一上来就比预测差，于是下一轮马上又被放行 [I]。

## 开了的代价

rc2已接入运行时；下面说明阈值对触发条件的影响，尚缺相同负载下不同阈值的设备对照。

**调高（靠近 1）**：对有有效锚点、负载窗口非全零的层，相对门槛变松，小幅退化也可能进入规划；在 1.0 时，当前平衡度不高于预测基准就通过相对门槛。增加的是规划机会，是否实际搬运还取决于候选筛选。

**调低**：相对门槛变紧，需要更明显的退化才能触发，可能让负载不均持续更久。写 0 会报错；使用很小的正数可减少相对门槛的触发，但绝对门槛仍能放行达到其条件的层。

进入规划后，候选的平均峰均比和按样本计数计算的 p95 峰均比都不能更差；最终放置与当前相同，也不产生新方案。因此，触发规划与实际搬运不是一回事。

**和绝对门槛的关系**：两者是「或」。绝对门槛比的是**当前**平衡度，与锚点无关 [C4]。如果某层的当前平衡度一直低于绝对下限（调到最好也上不去），它每轮都会被绝对门槛放行，本键对它形同虚设 [D]；反过来，已有锚点、且当前平衡度在绝对下限之上的层，只能靠本键放行。

**锚点只在「真的提交了」之后更新** [!]：在 4ebb3090 上，写回发生在这一层搬完并刷新路由表之后；规划了但没搬（例如候选都不比现状好）的层，锚点保持上一次的值，下一轮还拿旧锚点比 [C6]。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：在这套部署用的镜像 db701c1f 上，写这个键就是启动失败（原文见 [stair_config 的「一句话」](stair-config-cca9e594a052.md#一句话)）。假如换到已接入 STAIR 的 main，门槛是每个 MoE 层各自判的 [C5]；但这套部署没有逐层负载的实测数据（见 [EPLB 页的这一节](../concepts/eplb.md#负载有多不均只有理想均分没有实测)），所以哪些层会被放行、多久放行一次，现在都说不出来。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.relative_balance_threshold` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 无 | `baa023ad` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |

## 对照源码

### 源码位置

实际核读来源 4 的 `4d1412d1` 实现：209–210 行先跳过全零窗口，211–212 行对 `None` 或 `NaN` 锚点直接返回当前负载指标；其余锚点须为不小于 1 的有限数，才进入相对或绝对门槛检查。这是该固定实现的输入边界，不扩大本页版本范围，也不表示放行后一定产生搬运。

- 来源 14、15：vllm-ascend@4d1412d1，vllm_ascend/distributed/eplb/policy/stair.py，L198–L223、L950–L983。
