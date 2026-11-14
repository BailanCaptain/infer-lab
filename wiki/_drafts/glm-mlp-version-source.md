---
id: glm-mlp-version-source
title: GLM 稠密 MLP 固定快照与限幅激活来源摘要
type: source
summary: 两份固定源码摘录展示了 GLM 稠密前馈模块的投影、限幅激活和序列并行接口；调用参数与层型回退规则存在差异，发布分支支持范围仍缺材料。
aliases:
  - Glm5NextMLP
  - GLM MLP
  - SiluAndMul
  - SiluAndMulWithClamp
  - disable_tp
  - reduce_results
chapters:
  - '10'
order: 10
sources:
  - >-
    raw:sha256-7fd336d8ba7a2e4258f0cd798513aa67d5350ae68038b3a8615ec44980a87309.md#L1-L255
evidence: I
relations:
  - to: mlp-residual-norm
    kind: builds-on
    note: 理解前馈投影与逐元素激活后，才能区分摘录中的计算步骤和限幅位置
  - to: sequence-parallel
    kind: builds-on
    note: 区分位置分片与张量计算分片，才能理解两个快照传入的并行参数及其局部通信边界
contradicts: []
updated: '2026-11-03'
origin: gap
rawSources:
  - >-
    raw/sha256-7fd336d8ba7a2e4258f0cd798513aa67d5350ae68038b3a8615ec44980a87309.md
---

## 这份材料能核对什么？

MLP 是对每个输入位置独立施加的前馈变换。本页整理 GLM 稠密 MLP 的两份固定源码摘录，比较输入投影、激活、输出投影以及调用者传入的并行设置。这里的稠密路径与 MoE 路径分别构造：MoE 使用多个专家及路由机制组织前馈计算。

材料包含三个源码快照中的片段：

| 快照与文件 | 材料位置 | 覆盖内容 |
| --- | --- | --- |
| vllm-ascend `baa023ad`，`vllm_ascend/models/glm5next/model.py` | 第 1–135 行 | `Glm5NextMLP`、层型选择、稠密调用参数及 attention 周围的 SP 调用 |
| vllm-ascend `db701c1f`，`vllm_ascend/models/glm5_next.py` | 第 136–208 行 | `AscendGlm5NextMLP`、层型选择及稠密调用参数 |
| vLLM `0fc695fc`，`vllm/model_executor/layers/activation.py` | 第 209–242 行 | 限幅激活组件的注册、形状说明和原生计算 |
| vllm-ascend `db701c1f`，`vllm_ascend/ops/activation.py` | 第 243–255 行 | Ascend 限幅激活方法及其预取调用 |

这些是归档材料内的源码摘录，本页只以该本地材料为依据。材料没有提供四个社区分支与提交的登记映射、实际模型配置或运行日志，因此不登记 `verified`，也不据此认证完整部署或实机性能。

## 两份稠密模块共有怎样的计算顺序？

两个模块都按以下顺序处理输入：

1. 输入投影 `gate_up_proj` 产生两组中间表示。
2. 激活组件处理这两组表示，得到一组中间结果。
3. 输出投影 `down_proj` 将中间结果映射回隐藏维度。

构造时，输入投影从 `hidden_size` 映射到两个 `intermediate_size` 宽度；输出投影从 `intermediate_size` 映射回 `hidden_size`。两个投影均设置 `bias=False`，并接收同一个 `quant_config`。这些是接口中的逻辑维度与配置传递关系，每卡权重布局及量化存储方式还需要底层线性层材料才能确认。

两份模块都根据 `swiglu_limit` 选择激活组件：非 `None` 时构造 `SiluAndMulWithClamp`，否则构造 `SiluAndMul`。本次材料提供了前者的计算定义，没有提供后者的实现。

## 限幅发生在哪里，输入输出形状怎样变化？

限幅是把超过边界的输入值截到边界。材料中的 `SiluAndMulWithClamp` 将输入最后一维等分为 gate 和 up 两半；若最后一维长度为 `2d`，每半长度就是 `d`。

原生实现依次执行：

- gate 只限制上界，最大为 `swiglu_limit`，代码没有为它设置下界。
- up 同时限制下界和上界，范围为负、正 `swiglu_limit`。
- 对处理后的 gate 应用 SiLU，再与处理后的 up 按位置相乘。

因此，限幅发生在 SiLU 与乘法之前；它处理的是两路输入，不是把最终输出统一截到同一个范围。材料第 216–240 行同时给出说明和原生实现。

组件说明列出了两类形状：输入为 `(num_tokens, 2 * d)` 时，输出为 `(num_tokens, d)`；输入为 `(batch_size, seq_len, 2 * d)` 时，输出为 `(batch_size, seq_len, d)`。其中 `num_tokens` 是输入位置数，`batch_size` 是批次大小，`seq_len` 是每条序列的位置数；这些前置维度保留，最后一维由两路表示合成为一路。

Ascend 方法也先分别限幅 gate 和 up，再沿最后一维拼接，交给 `torch_npu.npu_swiglu` 处理。调用前后还分别执行权重预取的预处理、后处理钩子。材料没有给出该设备算子的内部实现，也没有给出实际组件注册与分发入口，因此只能确认这个方法体的步骤，不能据此确定安装环境最终调用了它。

## 两个快照有哪些需要保留的差异？

这些差异属于给定快照之间的代码对照，不代表已经核清发布版本的演进关系。

| 比较项 | `Glm5NextMLP` 所在摘录 | `AscendGlm5NextMLP` 所在摘录 | 对理解的影响 |
| --- | --- | --- | --- |
| 激活名称检查 | `hidden_act` 不为 `"silu"` 时抛出 `ValueError` | 构造签名接收 `hidden_act`，但所给构造函数中没有该检查，也没有使用它选择激活 | 不能把前者的报错行为套到后者 |
| 层型列表为空时 | 回退为 `"sparse"` | 根据层索引与 `first_k_dense_replace` 的关系选择 `"dense"` 或 `"sparse"` | 空列表下的层型选择规则不同 |
| 稠密模块调用参数 | 显式传入 SP 状态，并令 `reduce_results` 为 SP 状态的反值 | 所给调用没有传入这两个参数，使用构造默认值 `False` 和 `True` | 不能沿用另一快照的稠密 SP 调用结论 |

激活检查的报错文本是：

> Unsupported activation: {hidden_act}. Only silu is supported for now.

当层型列表非空时，两份摘录都在层索引未超出列表范围时取对应项，超出时沿用最后一项。随后，只有 `self.is_moe` 为真、`self.num_experts` 非 `None` 且所选层型为 `"sparse"`，才构造相应的 MoE 模块；其余情况构造稠密 MLP。

这些分支还不足以确定某个模型各层实际走哪条路径，因为本次材料没有提供对应配置值。特别是 `db701c1f` 的稠密调用省略了 SP 参数，只能确认该次构造采用默认设置，不能由此推断整个模型是否使用 SP。

## 序列并行的局部通信边界在哪里？

张量并行（TP）把一次张量计算分片到多个设备；序列并行（SP）在这里按输入位置分配局部激活。rank 是通信组内的成员编号，集合通信则是组内成员共同参与的数据交换操作。完整基础见[序列并行](../concepts/sequence-parallel.md)。

`Glm5NextMLP` 的注释说明：SP 情况下，输入和输出按 TP 组成员分片，权重复制，模块内部不需要集合通信；非 SP 情况下使用标准 TP，并在末尾归约。构造代码中，两个投影都接收 `disable_tp=is_sequence_parallel`，输出投影另外接收 `reduce_results`。

需要把模块默认值与调用者设置分开看。模块的 `reduce_results` 默认是 `True`，但允许调用者覆盖；本次给出的调用者明确传入：

- SP 开启：`disable_tp=True`，`reduce_results=False`。
- SP 关闭：`disable_tp=False`，`reduce_results=True`。

这组参数与注释描述相配，但材料未包含底层线性层实现，无法进一步核实实际通信过程或量化权重加载方式。

同一快照的外层代码还展示了 attention 周围的通信：SP 开启时，先执行 `sp_all_gather(x)`，按 `positions.shape[0]` 截取后送入 attention；attention 返回后执行 `sp_reduce_scatter(x)`，再进行 attention 后混合、前馈前混合及输入 RMSNorm，最后进入前馈模块。这里的 RMSNorm 是根据输入均方根缩放表示的归一化操作。

因此，稠密 MLP 的局部通信说明只覆盖该模块，外层仍有明确的通信调用。通信函数内部布局、实际发送量和同步代价不在这份摘录范围内。

## 后续整合还需要补哪些证据？

本次材料支持整理计算步骤和快照差异，以下问题仍需追加材料：

- **四个社区版本的范围。** 没有 v0.23 维护分支、v0.26 分支、v0.30.0rc2 分支与 main 开发主线的完整对应材料，不能判断各分支是否存在该功能、默认行为是否一致，或指定路径是否缺失。
- **GLM-5.3-Flash 的实际层分布与限幅值。** 需要固定模型配置及其与执行代码的对应关系；仅有通用构造分支不能确定层数、层型分布或 `swiglu_limit` 的实际取值。
- **底层线性层与通信实现。** 需要核实权重分片、量化布局、归约执行条件，以及 SP 通信函数的输入输出布局。
- **实际激活分发。** 材料中有通用组件注册和 Ascend 方法体，但缺少将该方法接入最终执行路径的证据。
- **运行与性能。** 本次没有实机结果，无法确认启动是否成功、预取是否生效或性能是否改善。

前馈计算的教学衔接见[MLP、residual 与 RMSNorm](../concepts/mlp-residual-norm.md)。本页保存的是本次材料能够支持的来源摘要；未提供的配置、发布分支和执行入口需在后续整合中分别核对。
