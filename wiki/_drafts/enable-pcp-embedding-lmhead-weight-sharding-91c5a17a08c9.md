---
id: enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9
title: enable_pcp_embedding_lmhead_weight_sharding
type: param
summary: >-
  当 PCP 大于 1 且模块满足分片条件时，把 embedding 和 LM Head 权重进一步分给 PCP 组内的设备保存；与这些模块的细粒度 TP
  有冲突。
aliases:
  - enable_pcp_embedding_lmhead_weight_sharding
  - PCP embedding/LM-head 权重切分
chapters:
  - '01'
  - '13'
  - '15'
sources:
  - >-
    raw:sha256-b346c3f6ca3186e3fe20c23f3907c51cc579f529441baa8c0dbeb614edfda361.md#L1-L388
evidence: I
relations:
  - to: context-parallel
    kind: builds-on
    note: 是否进入权重分片路径取决于 prefill context parallel 的组大小
  - to: fine-grained-tp
    kind: conflicts-with
    note: 进入 PCP 权重分片路径后，不能同时启用对应 embedding 或 LM Head 的细粒度 TP
updated: '2026-11-03'
origin: gap
rawSources:
  - >-
    raw/sha256-b346c3f6ca3186e3fe20c23f3907c51cc579f529441baa8c0dbeb614edfda361.md
---

## 一句话

`enable_pcp_embedding_lmhead_weight_sharding` 控制 embedding 和 LM Head 是否在普通 TP 分片的基础上，再沿 PCP 组分片保存权重。

[embedding](../concepts/embedding.md) 按 token 编号读取向量；[LM Head](../concepts/lm-head.md) 把隐藏向量转换成词表中各 token 的分数。TP（tensor parallel）把张量计算及相关权重分给多个设备；PCP（prefill context parallel）则在处理提示词时按上下文位置分工。本选项利用 PCP 组进一步分配这两类模块的常驻权重，改变的是权重如何保存和参与计算。

本页依据提供的文档与代码摘录整理，未直接核读上游完整文件，也没有设备运行结果。下文将不同提交中的片段分别说明，不把它们合并为已经验证过的单一版本行为。

## 事实表

| 项 | 值 | 意味着什么 |
| --- | --- | --- |
| 文档声明的类型与默认值 | 布尔值，默认 `True` | 文档将此行为设为默认开启，但仍须满足运行时分支条件；这不是本页重新生成的静态参数定义。 |
| PCP 条件 | PCP size > 1 | PCP 为 1 时，不会因本选项进入 PCP 权重分片分支。 |
| 模块匹配条件 | 前缀包含 `embed_tokens` 或 `head` | 材料中的实现按模块前缀选择分支，不是对所有权重统一分片。 |
| 优先例外 | `disable_tp=True` 返回复制模式 | 显式要求复制的权重先退出，不会仅因名称含有 `head` 被切开。 |
| 分片规模 | TP size × PCP size | 每个设备保存整个 TP×PCP 网格中的一个词表分片。 |
| 组内编号 | TP rank × PCP size + PCP rank | PCP rank 是线性编号中的内层维度，用于确定本设备负责的分片。 |
| 对应细粒度 TP | 进入 PCP 分片分支时不能同开 | embedding 与 LM Head 分别检查自己的细粒度 TP 设置，冲突时抛出 `ValueError`。 |
| reduce sample | 所引校验片段在两项同开且 PCP > 1 时拒绝配置 | 不能把这条冲突扩大为 PCP=1 时也必然报错。 |
| 关闭方式 | 将本选项设为 `false` | 所引文档说明可关闭 TP×PCP 常驻权重分片；材料不足以完整说明关闭后的所有替代执行路径。 |

表中类型、默认值及关闭方式来自材料第 115、119 行的文档摘录；模块条件、复制例外和细粒度 TP 冲突来自第 10—34 行；reduce sample 冲突来自第 79—87 行；分片规模与编号来自第 378—384 行。它们均通过页头所列的本地材料核对，不作为本次直接核验源码的结论。

## 为什么存在

普通 TP 已经沿词表维度分配权重。本选项进一步利用 PCP 组内的设备，让原本属于一个 TP 分片的 embedding 或 LM Head 权重继续拆分，而不是只扩大参与处理上下文的设备数。所引上下文并行文档将这种布局称为 TP×PCP 常驻分片。

材料中的 `VocabParallelPlan` 记录了这种布局：总分片数是 TP 组大小乘以 PCP 组大小，本设备的分片编号由两个组内 rank 共同确定。rank 是设备在某个通信组中的成员编号；这里 TP rank 和 PCP rank 各自属于不同的组，不能混作同一个编号。

这条分支有明确的判断顺序。实现先处理 `disable_tp=True`，直接返回复制模式；之后才检查模块前缀、本选项和 PCP 大小。材料以 DSpark 的 Markov head 为例：它的 `markov_w2` 虽然由 `ParallelLMHead` 构造，名称也包含 `head`，但显式设置了 `disable_tp=True`，因此保留复制布局。

对于未提前返回的模块，只有前缀匹配、本选项开启且 PCP 大于 1，才进入 PCP 分片分支。所引文档称此行为适用于“所有受支持的 attention backend”，即负责注意力计算的受支持后端；材料没有列出这些后端及其模型、硬件和量化组合，不能据此扩展成任意配置均可用。

## 开了的代价

进一步分片权重后，计算还需要组织输入和结果。材料中的分片计划为 embedding 指定 PCP token 交换组和 TP 输出归约组：前者负责参与 token 输入交换，后者负责组合输出。LM Head 在这份计划中没有设置这两个组；这只能说明该计划字段的区别，不能据此判断 LM Head 完全没有通信。

另一份提交中的 logits 路径展示了调用条件的影响。logits 是模型为词表各 token 给出的分数；当调用方设置 `skip_gather=True` 时，代码直接返回 `_apply_head` 的结果，先于 PCP×TP 专用 logits 路径执行。该片段的注释将此情况关联到投机解码和 top-k 调用者。因此，分析输出是否会被收集重建时，必须同时查看调用方，不能只看权重是否分片。现有摘录没有提供专用路径的完整正文，无法据此列出通信次数或时延。

配置冲突有两类：

- **对应模块的细粒度 TP。** 进入 PCP 权重分片分支后，若 embedding 启用了自己的细粒度 TP，或 LM Head 启用了自己的细粒度 TP，就抛出 `ValueError`。这条限制针对对应模块的额外分片设置，普通 TP×PCP 正是本选项采用的布局。
- **reduce sample。** 材料所示检查位于 `enable_reduce_sample` 开启的分支内；本选项也开启且 PCP 大于 1 时，抛出 `ValueError`，提示关闭其中一项。

版本边界仍有缺口：材料包含 `39fef3f8`、`7d825229` 和 `4d1412d1` 等提交摘录，但没有提供足以核实其发布分支归属及先后关系的资料。本页不能据此认定 v0.23 维护分支、v0.26 分支、v0.30.0rc2 分支或 main 开发主线分别具有哪些完整行为，因此不填写 `verified`。

当前也没有显存或时延实测，以及完整的权重填充、token 交换和 logits 重建实现。可确认材料描述了进一步分配常驻权重的机制；具体节省多少设备内存、增加多少通信开销，以及在哪些运行组合中值得开启，仍需补充对应固定版本的完整实现与运行证据。
