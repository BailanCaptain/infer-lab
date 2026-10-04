---
id: relative-balance-threshold-bcbc40e7dc87
title: relative_balance_threshold
type: param
origin: seed
evidence: C
summary: >-
  STAIR 的相对重排门槛：某层当前平衡度 ÷ 上次提交新摆法时预测的平衡度 ≤ 本值（默认 0.95）就重新规划这一层，与绝对门槛是「或」的关系；从没提交过的层不看门槛。知识库钉住的四个版本都没有这个键，行为按扫描提交 4d1412d1 写。
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
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
updated: '2026-10-04'
sources:
  - >-
    vllm-ascend@4d1412d102c16669af3ec73174fc5f8b359b56d9:vllm_ascend/ascend_config.py#L220
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L199-L200'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L246-L249'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L198-L224'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L1029-L1041'
  - 'vllm-ascend@4ebb3090:vllm_ascend/patch/platform/patch_eplb.py#L493-L498'
  - 'vllm-ascend@4d1412d1:vllm_ascend/ascend_config.py#L190-L191'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L150-L168'
  - 'vllm-ascend@4d1412d1:vllm_ascend/distributed/eplb/policy/stair.py#L947-L985'
rawSources:
  - >-
    raw/sha256-bddcda0a13c3adcf3c60db59b54087b75b8e79a44f558dce1a8eef950c237ae8.md
---
## 一句话

`relative_balance_threshold` 是 [stair_config](stair-config-cca9e594a052.md) 下的一个小数，回答 STAIR 每轮规划前的一个问题：**这一层比上次调好时变差了多少，才值得再调一次**。它比的是平衡度——平衡度 = 1 ÷ 平均峰均比，1 表示各卡完全均匀，越小越不均（峰均比怎么算见 [EPLB 页](../concepts/eplb.md#怎么算数配对比峰均换位置)）[C7]。某层当前平衡度 ÷ 上次提交新摆法时预测的平衡度 ≤ 本值，这一层就进入本轮规划 [C2]。默认 0.95。

换成峰均比说更直观：默认值下，当前峰均比要涨到上次预测值的 1 ÷ 0.95 ≈ 1.053 倍以上才会重排，比如上次预测 1.20，现在要到约 1.263 才动 [D]。这道门槛和 [absolute_balance_threshold](absolute-balance-threshold-71578a0c428d.md) 是「或」的关系，任一个触发都算 [C4]。

**存在范围与 GLM 结论**跟父参数一样：知识库钉住的 v0.23、GLM 镜像、v0.26、main 四个版本都没有这个键，写上就启动报错；本页行为按 main 提交 4d1412d1 写，它在钉点 baa023ad 之后、同样不是钉点（页底「版本谱系」里 main 一行写「有」，指的也是钉点之后的 origin/main），而那一版的 STAIR 还没接进运行时，详见 [stair_config 的「一句话」](stair-config-cca9e594a052.md#一句话)。GLM 双机这套部署没开 EPLB，这个键用不上。

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["eplb_config"]["stair_config"]["relative_balance_threshold"]` |
| 类型 | `float` |
| 默认表达式 | `0.95` |
| 定义 | `vllm_ascend/ascend_config.py:220` [C1] |
| 版本 | main · 4d1412d102c16669af3ec73174fc5f8b359b56d9 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 事实表

| 项 | 扫描提交 4d1412d1 上的值或行为 | 意味着什么 |
|---|---|---|
| 完整路径 | `additional_config["eplb_config"]["stair_config"]["relative_balance_threshold"]` | 只能嵌在 `stair_config` 里 |
| 钉点上是否存在 | v0.23、GLM 镜像、v0.26、main 钉点 baa023ad 都没有 | 页底「版本谱系」的 main 行写「有」，指钉点之后的 origin/main；版本细节与报错见 [stair_config 事实表](stair-config-cca9e594a052.md#事实表) |
| 类型 / 默认值 | `float`，0.95 | 默认容忍约 5% 的平衡度下滑 |
| 合法取值 | 0 < 值 ≤ 1 且为有限数；否则报 `stair_config.relative_balance_threshold must be between zero and one`（源码是 f-string，键名由循环填入）[C3] | 0 不合法：写 0、负数或 1.2 都会启动报错，不能靠写 0 关掉这道门槛 |
| 触发条件 | 当前平衡度 ÷ 上次提交时预测的平衡度 ≤ 本值，或当前平衡度 ≤ 绝对阈值 [C4] | 两道门槛任一道放行即可 |
| 不看门槛的情形 | 这一层从没提交过新摆法（锚点为空）时直接放行；整个负载窗口全是 0 时直接跳过 [C4] | 第一轮规划所有有负载的层都会参与 |
| 锚点从哪来 | 规划结果里每层的预测峰均比；4d1412d1 上没有调用方写回，4ebb3090 上在这一层搬完、刷新路由表之后才写回 [C6] | 比的是「上次规划说会有多好」，不是「上次实际有多好」 |
| 放行之后 | 只是进入本轮规划；候选摆法的平均与 p95 峰均比都不能比现状差，选出来的仍是现状就不动 [C9] | 门槛放行不等于一定会搬 |
| 取 1.0 时 | 只要当前不比预测好，每轮都放行 [D] | 迟滞基本失效，规划器每轮都会重算这些层 |

## 为什么存在

EPLB 每次重排都要把专家权重在卡之间拷来拷去（代价见 [EPLB 页的代价一节](../concepts/eplb.md#代价多占的显存搬运和等待)）。负载本身总在抖动，如果「比上次差一点就重排」，规划器就会被抖动牵着反复搬。STAIR 的源码注释把这道「迟滞」写成策略必有的行为 [C7]，本键就是它的松紧：只有退化超过一定比例才动手。

为什么用「相对」而不只用一个绝对下限：不同层的负载形状不同，有的层调到最好峰均比也下不来，有的层能调到接近 1。只设绝对下限，前一种层每轮都低于下限、每轮都被重排；后一种层要退化很多才碰到下限。拿「这一层自己上次的预测」做基准，每层按自己的水平判断有没有变差 [I]。

锚点用的是上次规划时**预测**的峰均比，不是实测值 [C4]。好处是不需要在搬完之后再额外统计一次；代价是预测本身偏乐观时（预测会按「负载平均分给各份副本」来估 [C8]，实际分摊方式见 [EPLB 页的副本一节](../concepts/eplb.md#最热的专家怎么办多放一份副本)），搬完后的实测峰均比可能一上来就比预测差，于是下一轮马上又被放行 [I]。

## 开了的代价

本页没有实测数：钉点上没有这个特性，上游也没有公开不同取值的对照。下面是从源码推出来的行为。

**调高（靠近 1）**：门槛变松，小幅退化就重排，搬运更频繁；在 1.0 时只要不比预测好就放行（事实表最后一行）。

**调低**：门槛变紧，退化很多才重排，搬运少，但负载不均会持续更久。写 0 会启动报错（下限是开区间），想让「相对」这道门槛几乎不起作用只能写一个很小的正数；即便如此，绝对门槛照样会放行跌破下限的层 [D]。

**和绝对门槛的关系**：两者是「或」。绝对门槛比的是**当前**平衡度，与锚点无关 [C4]。如果某层的当前平衡度一直低于绝对下限（调到最好也上不去），它每轮都会被绝对门槛放行，本键对它形同虚设 [D]；反过来，已有锚点、且当前平衡度在绝对下限之上的层，只能靠本键放行。

**锚点只在「真的提交了」之后更新** [!]：在 4ebb3090 上，写回发生在这一层搬完并刷新路由表之后；规划了但没搬（例如候选都不比现状好）的层，锚点保持上一次的值，下一轮还拿旧锚点比 [C6]。

**放到 GLM 双机上会怎样**（[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)：两台机器 16 张卡、EP16、W8A8）：在这套部署用的镜像 db701c1f 上，写这个键就是启动失败（原文见 [stair_config 的「一句话」](stair-config-cca9e594a052.md#一句话)）。假如换到已接入 STAIR 的 main，门槛是每个 MoE 层各自判的 [C5]；但这套部署没有逐层负载的实测数据（见 [EPLB 页的这一节](../concepts/eplb.md#负载有多不均只有理想均分没有实测)），所以哪些层会被放行、多久放行一次，现在都说不出来。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 无 |
| releases/v0.18.0 | 无 |
| releases/v0.20.2rc | 无 |
| releases/v0.21.0rc | 无 |
| releases/v0.22.1rc | 无 |
| releases/v0.23.0 | 无 |
| releases/v0.24.0rc | 无 |
| releases/v0.25.1rc | 无 |
| releases/v0.26.0rc | 无 |
| releases/v0.27.1rc | 无 |
| releases/v0.28.0rc | 无 |
| releases/v0.29.0rc | 无 |
| main | 有（2 个文件） |

- **引入**：2026-09-26 · bbb5672af80b1972c301852aa505b13374fa6355 · PR [#17511](https://github.com/vllm-project/vllm-ascend/pull/17511) —— [Feature][EPLB] Add STAIR load and replica planning (#17511)
  包含该提交的 tag：未找到；分支：origin/main
  - `vllm_ascend/ascend_config.py` +79 / −2（文本行变化）
  - `vllm_ascend/distributed/eplb/policy/__init__.py` +2 / −0（文本行变化）
  - `vllm_ascend/distributed/eplb/policy/stair.py` +325 / −0（文本行变化）

当前含该标识符的 tag：未找到
