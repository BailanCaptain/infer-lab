---
id: mlp-residual-norm
title: "前馈、残差与 RMSNorm：模型子层如何更新表示"
type: concept
summary: 门控前馈网络沿两条投影分支变换特征，残差连接保留输入路径，RMSNorm 按向量均方根调整尺度。结合 GLM 的实际宽度与四路连接，理解各部件的输入、输出和作用。
aliases: [MLP, FFN, 前馈网络, 残差, residual, 残差连接, 归一化, LayerNorm, RMSNorm, SwiGLU, SiLU, 门控前馈]
chapters: ["03"]
order: 70
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1442
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2107-L2145
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2241
  - vllm-ascend@db701c1f:vllm_ascend/ops/activation.py#L46-L56
  - vllm@0fc695fc:vllm/model_executor/layers/layernorm.py#L36-L102
  - https://arxiv.org/abs/1910.07467
  - https://arxiv.org/abs/2002.05202
verified: []
evidence: "C"
relations:
  - to: layers-and-hidden
    kind: builds-on
    note: 在层间隐藏表示的基础上，展开前馈、归一化与残差连接的计算
  - to: matmul-and-weights
    kind: builds-on
    note: 前馈网络的 gate、up、down 投影使用矩阵乘，理解其输入与输出宽度有助于追踪两条分支
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 前馈网络怎样变换一个位置的特征

[模型层](layers-and-hidden.md)中的前馈网络通常称为 FFN 或 MLP。它接收当前 token 的隐藏表示，经线性投影和非线性运算形成新的特征组合，再返回隐藏宽度。在这一计算内部，各位置分别使用相同的网络；输入本身已经可以包含注意力引入的上下文。

普通两投影 FFN 可写为 `Y=φ(XW₁)W₂`：第一片权重将隐藏特征映射到中间宽度，φ 是非线性激活，第二片权重再映射回隐藏宽度。若省去非线性，两次线性变换仍可以合并成一次，表达形式就受到限制。[D]

门控 FFN 保留这个输入输出接口，在中间增加一条由输入产生的投影分支，再用逐元素乘法调节特征。SwiGLU 使用 SiLU 构造这条门控；它改变的是中间计算结构，需要相应训练的权重，并非运行时随意给普通 FFN 增加的开关。[S8]

GLM 的 Dense FFN 与专家网络使用门控结构。对本轮输入 `X`，将输入宽度记为 `H`、中间宽度记为 `F`，两条分支先分别进行投影：

```text
g = X W_gate         W_gate: [H, F]
u = X W_up           W_up:   [H, F]
z = SiLU(g) ⊙ u
Y = z W_down         W_down: [F, H]
```

`⊙` 表示对应元素相乘。SiLU 是连续的非线性函数，`SiLU(g) = g × sigmoid(g)`；门控分支由输入决定如何调节另一分支的特征，输出并不是一组离散的开/关选择。门控线性单元及其变体的研究依据见原论文。[S8]

GLM 配置还设置了 `swiglu_limit = 10`。所引 Ascend 激活实现先将 gate 限制为不大于 10、up 限制在 −10 到 10，再执行 SwiGLU。上面的公式描述两分支与逐元素乘的基本关系，图中同时保留这一截断步骤。[S1][C2][C5]

```wiki-diagram
file: gated-ffn
```

输入和输出形状都是 `[T, H]`，中间两分支为 `[T, F]`，其中 `T` 是本轮输入位置数。所引实现把 gate/up 投影合并成一次线性调用；计算中的两组权重和后续拆分仍然存在。[C2]

## Dense FFN 与专家的宽度

GLM 的前三层采用 Dense FFN，其余 42 层采用 MoE。两者都以 4096 维表示作为输入，但中间宽度不同：[S1][C3]

| 前馈部件 | 输入 H | 中间 F | 输出 H |
|---|---:|---:|---:|
| Dense FFN | 4096 | 12288 | 4096 |
| 单个路由专家 | 4096 | 2048 | 4096 |
| 本模型的共享专家 | 4096 | 2048 | 4096 |

Dense FFN 扩展中间宽度，单个专家则使用更窄的中间表示。专家数量和路由机制决定哪些网络参与当前 token 的计算，见 [MoE](moe.md)。前馈部件的三片逻辑权重与运算量推导见[矩阵乘与权重](matmul-and-weights.md)。

## 残差连接保留一条输入路径

普通单路残差子层可写为 `Y = X + F(Norm(X))`。`F` 代表注意力或前馈计算，输入 `X` 同时沿旁路参与最终相加。下图单独说明这种常见的 Pre-Norm 连接，即归一化位于子层之前；它是通用构件示意，GLM 的四路连接在下一节对应。[A]

```wiki-diagram
file: mlp-residual-layer
```

相加要求两路形状一致，因此前馈计算最终返回隐藏宽度。子层输出可以很大，也可以很小，残差加法本身不限制改变量。旁路提供直接的输入依赖；原输入参与新的结果，并不作为一份永远不变的表示继续传递。

## RMSNorm 怎样调整向量尺度

模型层反复变换表示，归一化为进入子层的特征提供可控的尺度。LayerNorm 对同一位置的特征先减去均值，再按标准差缩放；RMSNorm 保留尺度调整，改为直接使用均方根，不做均值中心化。这是两种归一化操作的差别，不是将输出各维变得相同。[S7]

对一个位置的 `H` 维向量 `x`，RMSNorm 先计算平方均值，再进行缩放，并乘上每一维的可学习系数 `γ`：

```text
r = sqrt((x₀² + … + xₕ₋₁²) / H + ε)
yᵢ = γᵢ × xᵢ / r
```

`ε` 是避免分母过小的常数。运算保留向量宽度，不在不同 token 之间求平均。与通常的 LayerNorm 相比，RMSNorm 不先减去特征均值；学习到的 `γ` 也意味着输出各维并不被强制变成相同大小。[S7][C6]

例如取 `x = [3, 4]`、`γ = [1, 1]`，为手算暂取 `ε = 0`，则 `r = sqrt(12.5)`，输出约为 `[0.849, 1.131]`。两个分量共同调整尺度，原来的比例保留。[A][D]

GLM 配置中的 `rms_norm_eps = 0.00001`，每层为注意力和前馈分别建立 RMSNorm。[S1][C3] 具体内核可以融合残差、转换精度或使用设备算子；这里的公式描述数学操作，不据此推断独立内核的数量。

## 这些部件如何进入 GLM 的四路连接

普通残差在子层之间传递一条隐藏表示，并将它与子层输出相加。GLM 主干使用 mHC，将中间表示扩展为多路，再学习如何混合输入与输出；输入旁路与子层计算仍可分别追踪。对注意力和前馈两个子层，固定实现都先混合四路输入，得到一个 4096 维表示，再执行 RMSNorm 和对应子层；子层输出与四路残差按混合系数组合，形成新的四路表示。[C4]

因此，本页的单路加法图用于解释残差这一基本关系；GLM 的实际连接应以[模型单层图](glm-5-3-flash.md)为准。前馈分支计算、RMSNorm 与残差连接分别回答“怎样变换特征”“怎样调整尺度”“怎样组合输入和子层结果”，可以据此逐个定位实现。

本页 GLM 部分依据[固定配置与 Ascend 专用快照](../sources/glm-5-3-flash-baseline.md)，上游 RMSNorm 引用用于说明通用接口；未验证专用镜像内最终安装组合，也没有内核耗时实测。

