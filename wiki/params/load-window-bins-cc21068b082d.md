---
id: load-window-bins-cc21068b082d
title: load_window_bins
type: param
summary: >-
  STAIR 把上游 EPLB 负载窗口按时间顺序压成至多这么多段再算均衡度、方差与协方差：默认 64，范围 2 到 256。rc2 保留压缩含义并已接入
  MRV2；早期快照 4d1412d1 的规划器尚未接入服务。
origin: seed
evidence: C
updated: 2026-11-03T00:00:00.000Z
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
  - to: ascend-config-system
    kind: builds-on
    note: >-
      load_window_bins 必须放在 additional_config.eplb_config.stair_config
      层级中，其配置方式依赖 AscendConfig 的分层解析机制。
---
## 一句话

**v0.30.0rc2 对照：** 默认仍为 64，合法范围 2–256，已由 MRV2 STAIR 的负载统计实际读取。样本按时间聚合成 min(样本数,上限) 个 bin，每段保留负载和与样本数；不同长度的段继续按样本权重参与统计，不是任意挑 64 个时间点。旧“规划器尚未接线”的范围不扩展到 rc2。

`load_window_bins` 决定 STAIR 把一段负载记录**压成至多多少段**再分析。上游 EPLB 会记下最近一段时间里每一步、每层、每个专家处理了多少 token，这一串记录叫负载窗口；STAIR 不逐步分析，而是按时间顺序把窗口切成至多这么多段，每段只留平均值和这一段有几步 [C2][C4]。默认 `64`，合法范围 `2` 到 `256` [C3]。

举个数感：vLLM v0.23.0 上游 EPLB 窗口的默认长度是 1000 步 [C8]，压成 64 段就是每段 15 或 16 步 [D]。不过在本页所据的快照上 STAIR 还没接进运行时（见下面「存在范围」），以后接入时窗口实际多长，要看那时的上游配置。

STAIR 是 vllm-ascend 为 Model Runner V2（MRv2）写的 EPLB 规划算法（总介绍见 [stair_config](stair-config-cca9e594a052.md)）。它后面用到的几样东西——判断要不要重排的均衡度、筛候选用的平均与 p95 峰均比、估风险用的均值方差协方差——**全都从压缩后的这些段算出来**（见事实表）。所以这个数管的是「STAIR 看负载有多细」。

**旧版本范围**：v0.23、GLM 快照 `db701c1f`、v0.26、固定 main `baa023ad` 没有此键，写入会启动报错。它在 2026-09-26 随 `bbb5672a`（[PR #17511](https://github.com/vllm-project/vllm-ascend/pull/17511)）加入，10-02 的 `4ebb3090` 仍默认 `64`。下文按 `4d1412d1` 讲历史行为：规划器内部读取该值压缩窗口，但尚未接入推理服务；次日 `a32719ef` 才接入 MRV2，见 [接入说明](absolute-balance-threshold-71578a0c428d.md#开了的代价)。当前参数定义取 rc2，谱系 main 仍指旧钉点，rc2 单列。

**GLM 双机这套部署上它不存在，也用不上**：本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 不认 `stair_config`。

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

## 事实表

| 项 | 值 | 意味着什么 |
|---|---|---|
| 四个旧快照 | 都没有；v0.23 / GLM 快照 / v0.26 报 `Config has no attribute 'stair_config'` [C9]，main `baa023ad` 被 `extra="forbid"` 拒收 [C10] | 服务起不来，不是静默忽略 |
| 完整路径与默认值（`4d1412d1`） | `additional_config["eplb_config"]["stair_config"]["load_window_bins"]`，`int`，默认 `64` | 只写这一个子键时，其余 STAIR 字段取默认值 |
| 合法取值 | 整数 `2` 到 `256`；越界报 `stair_config.load_window_bins must be between 2 and 256`；写成布尔值报 `STAIR numeric fields must not be booleans` [C11] | 不能写 1 把整个窗口并成一段 |
| 怎么切 | 段数 = `min(窗口步数, 本值)`；按时间顺序切，边界取整，各段步数最多差 1；每段存平均负载和步数 | 不打乱时间顺序，相邻的步才会并在一起 |
| 窗口比它短时 | 每一步自成一段，不压缩 | 这时改它不起作用 [D] |
| 什么不变 | 按步数加权后的平均负载与压缩前完全相同 | 「哪个专家平均更热」不受影响 [D] |
| 什么会变 | 每段先平均再算峰均比，均衡度和 p95 都按段算 [C6]；方差、协方差也按段算，只剩段与段之间的起伏 [C7] | 段内的短时尖峰会被抹平 |
| p95 怎么取 | 各段峰均比从小到大排，按步数累加，取第 95% 那一步所在的那段 | 段越少，p95 越粗；只有 2 段时，p95 就是较差的那一半 [D] |
| 运行时谁读它（`4d1412d1`） | 规划入口第一步就按它压缩窗口 [C5]，但这个入口在该快照上没有调用方 | 在这个快照上改它，不改变任何行为 |


压缩函数要求三维的“步数 × 层数 × 专家数”负载记录，步数非零，值有限且非负。函数接口允许最大段数为 1，但公开配置仍限制在 2 到 256；不能用内部函数的宽松范围替代配置校验。

## 为什么存在

负载窗口可能很长：按上面的例子，1000 步 × 每层几百个专家。STAIR 规划一层时要试很多候选摆法，每试一个都要把窗口里的负载按新摆法重新加一遍，算出均衡度和 p95；估风险时还要算专家两两之间的协方差。这些计算的量都跟窗口里有多少个样本成正比 [D]。先把窗口压成至多 64 段，限制的是压缩后交给候选评估与统计计算的样本规模。压缩本身仍须读取原始窗口并计算各段平均值，工作量仍受原始窗口长度影响；不能把段数上限解释为整个处理流程的计算量与窗口长度无关。

用一层、两个专家的五步负载作示意：专家 A 依次承担 2、6、0、4、8，专家 B 依次承担 8、4、10、6、2。段数上限设为 2 时，前两步合成第一段，后三步合成第二段。第一段中，A 的负载相加得到 8，除以步数 2 得到平均负载 4；B 的负载相加得到 12，除以 2 得到 6。第二段中，A 的负载相加得到 12，除以 3 仍为 4；B 的负载相加得到 18，除以 3 仍为 6。因此，两段平均负载都是 A 为 4、B 为 6，但各自代表 2 步和 3 步。后续按这两个步数加权，仍能得到整个窗口的平均负载；计算方差和协方差时，两段平均值却完全相同，结果都为零。原始五步的起伏已在段内平均时丢失。

另一层考虑是噪声：单独一步的负载受这一步碰巧来了哪些 token 影响很大，十几步平均一下，专家的热度会稳定得多 [I]。之所以**按时间顺序**切段而不是随便分组，是为了保留「一阵子这几个专家热、过一阵换另一批」这种时间上的起伏——STAIR 估协方差、找「一起变热的专家」，靠的正是这种起伏 [I]。PR 说明对这一步的描述是「按时间顺序压缩，每段权重精确」；64 这个默认值的来由，源码注释和 PR 说明都没有写。

## 开了的代价

**先说清楚本页有什么、没有什么**：下面是配置值和由计算方式推出来的影响方向，不是测出来的效果。本页没有不同段数下的规划耗时或均衡度对照；`4d1412d1` 的规划函数可单独调用和测试，但尚未接入推理服务，因此不能把这些推导当成该快照的服务收益实测。

**调小（往 2 靠）**：交给候选评估和统计的段数减少，段内的负载变化被平均掉，p95 也只剩更少的段可选。减少的是这部分计算的样本规模，最终规划耗时仍取决于候选和回溯过程。不能据此断定均衡度一定升高、[两道重排门槛](absolute-balance-threshold-71578a0c428d.md)一定更难打开，或方差一定减小：[load_risk_quantile](load-risk-quantile-d89a080ba048.md) 所乘的波动项仍要按实际分段计算。[C4][C6][C7]

例如，两卡各放一个专家，四步负载依次为 `(1000,0)`、`(1,1)`、`(1,1)`、`(1,1)`。四段时，峰均比为 `2、1、1、1`，平均为 1.25，均衡度为 0.8；压成两段后，段均值为 `(500.5,0.5)` 和 `(1,1)`，各代表两步，平均峰均比约 1.499，均衡度反而降到约 0.667。原因是“先把负载平均，再求峰均比”不等于“先求每步峰均比，再平均”。若已有锚点且相对条件不触发，绝对阈值取 0.7，这个例子会从绝对门不放行变为放行。它是按固定源码统计公式计算的反例，不是设备性能测量。[A][D]

不同段数还会重新计算分段边界，较少的段不一定由较多的段直接合并而成。因此，不能从段数大小推出压缩后方差的单调变化；具体反例见 [风险分位数页](load-risk-quantile-d89a080ba048.md#开了的代价)。相对于原始逐步数据，按给定分段取均值会丢失段内起伏；这与比较两种不同分段的统计量是两回事。

这里的 p95 不是原始逐步峰均比的 p95；改变分段后它如何变化，要结合具体负载判断，不能仅按段数推断数值一定往哪个方向变。

**调大（往 256 靠）**：看得更细，越接近逐步分析，代价是每个候选的评估和协方差计算都按段数成比例变慢 [D]；而且段越短，每段的负载越受单步偶然性影响，估出来的协方差也越噪 [I]。窗口本身不超过 256 步时，写 256 等于完全不压缩。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：16 张卡、EP16，每层 288 个路由专家）：

- 本部署[没开 EPLB](../concepts/eplb.md#放到-glm-双机本部署没开-eplb)，GLM 代码所在的 `db701c1f` 也不认这个键，照 `4d1412d1` 的写法配进去启动就报 `Config has no attribute 'stair_config'`。下面只是按规划器源码推演。
- 默认 64 段时，每层要用 64 个时间段去估 288 个专家两两之间的协方差。样本数比专家数少得多，单个协方差值会比较噪，「哪两个专家总是一起热」的判断不一定稳 [I]。想让这个判断更稳，方向是多给段数，代价就是上面说的规划变慢。

## 版本谱系

范围限定为 `vllm_ascend/ascend_config.py` 中的 `StairConfig.load_window_bins` 字段定义。定义存在不等于配置可写或运行时可用；行为条件见本页正文。未核定字段的精确引入／移除提交，不以同名文本的历史代替。

| 版本 | 定义是否存在 | 固定提交 |
| --- | --- | --- |
| main | 有 | `8d6180e2` |
| releases/v0.23.0 | 无 | `2c59ff10` |
| releases/v0.26.0rc | 无 | `2ed6cbba` |
| releases/v0.30.0rc2 | 有 | `7d825229` |
| releases/v0.30.0 | 有 | `c09d3e20` |

## 对照源码

### 源码位置

五步负载是示意输入，分段与零方差结论为手算推导 [A][D]。实际核读来源 4 的 `4d1412d1` 分段实现：边界向下取整得到 0、2、5；来源 7 的加权中心项为零，故方差和协方差均为零。来源 6 按段峰均比排序，以步数为权重取第向上取整的 95% 位置；零负载段的峰均比按 1 处理。以上是固定源码与静态推导，没有在设备上测量收益。

旧4d1412d1的规划器在来源5第1003行读取该字段，但当时尚无服务侧调用；算法隔离测试与运行时接入是两回事。rc2的controller/factory已接入，版本范围见前文，服务收益仍须设备对照。

- 来源 17、6：vllm-ascend@4d1412d1，vllm_ascend/distributed/eplb/policy/stair.py，L86–L99、L157–L168。
- 来源 3：vllm-ascend@4d1412d1，vllm_ascend/ascend_config.py，L242–L243。

来源 4 的固定 `4d1412d1:stair.py` L85–L98 先检查原始负载数组，再逐段读取并求平均；因此段数限制约束压缩后的样本规模，不消除读取原始窗口的成本。本页没有新增规划耗时实测。
