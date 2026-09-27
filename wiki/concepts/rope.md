---
id: rope
title: "RoPE：旋转如何把相对位置引入注意力"
type: concept
summary: RoPE 对 Q/K 的成对分量施加与位置相关的旋转，使点积包含相对位置关系；是否使用、旋转维度及缩放方式由模型结构决定。
aliases: [旋转位置编码, 旋转位置嵌入, rotary embedding, 位置编码, partial rotary, 部分旋转]
chapters: ["04"]
order: 10
sources:
  - https://arxiv.org/html/2104.09864v5
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/base.py#L80-L103
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/base.py#L160-L201
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/common.py#L143-L183
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1965-L2000
verified: []
evidence: "C"
relations:
  - to: attention-qkv
    kind: builds-on
    note: 在 Q/K 点积评分的基础上，解释位置怎样进入分数计算
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 位置编码补充哪一类信息

[注意力](attention-qkv.md)通过 Q/K 点积计算匹配分数。仅看这一步的内容匹配公式，并没有显式的“相距几个位置”变量；位置编码为计算加入这种关系。因果掩码规定可访问范围，与表示位置距离承担不同作用。

RoPE（Rotary Position Embedding，旋转位置编码）是一种通用方法。本页介绍它的数学结构与 vLLM 实现；**当前固定的 GLM-5.3-Flash 配置将 `qk_rope_head_dim` 设为 0**，专用实现据此不为稀疏 MLA 的主注意力与索引器创建 RoPE 模块。[S5][C6] 因此，以下旋转图用于理解一种可供比较的位置机制。

## 把向量分成二维分量对

设参与旋转的维度为偶数 `d_r`。每一对分量 `(x₁,x₂)` 可视为二维向量，在位置 `p` 旋转角度 `pω_i`，其中 `i` 为分量对编号。基础 RoPE 的频率为 `ω_i = θ^(−2i/d_r)`，`θ` 是旋转基数。[S1][C2]

```text
x₁' = x₁ cos(pω_i) − x₂ sin(pω_i)
x₂' = x₁ sin(pω_i) + x₂ cos(pω_i)
```

不同分量对采用不同频率。同一位置因此作用于多个旋转平面，而不是把整个高维向量按一个角度转动。上游 vLLM 的基础实现按位置生成 cos/sin 表，前向时按 `positions` 取对应行，再应用旋转。[C2][C3]

## 为什么点积依赖相对位置

用 `R(p)` 表示位置 `p` 的旋转矩阵。若 Q 位于 `p`、K 位于 `r`，则：[S1]

```text
(R(p)q)ᵀ(R(r)k) = qᵀR(r − p)k
```

共同移动两个位置，旋转差不变。下图只画一个二维平面，固定旋转前的 q/k，并假设每个位置转 20°：左侧位置为 3 与 5，右侧为 103 与 105，差值均为 2。[A]

```wiki-diagram
file: rope
```

这项等式保留了 q 与 k 的数值依赖：相同距离上的不同内容，仍可以得到不同分数。旋转保持二维向量的长度，也不意味着完整模型的语义、输出或长文本质量保持不变。因果约束、内容表示以及其他位置机制仍会影响结果。

## 部分旋转与分量配对

一个注意力头可以只旋转其中 `d_r` 维，剩余分量直接保留。在所引 vLLM 基础实现中，前 `rotary_dim` 维进入旋转，后面的维度与旋转结果重新拼接；Q 与 K 都按这一方式处理。[C3]

假设某个通用头有 8 维，其中 4 维参与旋转，则它包含两个旋转平面和四个保留分量。这个例子用于展示 partial rotary，**不是 GLM 的维度配置**。[A]

| 配对方式 | 参与旋转的四个分量怎样组成两对 |
|---|---|
| 相邻配对 | `(x₀,x₁)`、`(x₂,x₃)` |
| 前后半区配对 | `(x₀,x₂)`、`(x₁,x₃)` |

所引实现支持这两种布局，由 `is_neox_style` 选择。[C4] 它们都是二维旋转的组织方式，但对应的权重与张量布局必须一致，不能在已有模型上任意切换。

## RoPE 的位置与缓存地址不同

普通使用 RoPE 的点积注意力，先得到 Q/K，再按位置旋转参与点积的分量；V 不参与本页这项旋转。若该实现缓存旋转后的 K，后续查询可直接与它评分，无需因生成推进而再次旋转旧 K。压缩注意力的缓存对象和旋转位置需要按具体实现另查。

位置编号描述 token 在序列中的位置；[块表](block-table.md)描述状态存放在哪个物理块。把同一逻辑位置的缓存搬到另一块，并不会因此改变它的 RoPE 位置。多个请求也可以各有位置 0，其缓存仍分别管理。

旋转基数、频率缩放与旋转维度都属于模型的计算约定。数学公式能为更大的位置计算角度，不等于模型在该长度上有可靠质量，也不等于设备能容纳对应状态；不能只调整一个最大长度字段，就宣称完成长上下文扩展。

## 在当前主模型中怎样定位

固定 GLM 配置的 `qk_nope_head_dim = 256`、`qk_rope_head_dim = 0`。在所引专用实现中，两处创建旋转模块的分支都要求旋转维度大于 0；本配置不满足，主注意力和索引器的旋转模块均为 `None`。[S5][C6] 这一分支不执行前述旋转计算。

这不表示 GLM 完全没有顺序信息：因果访问范围、KDA 的递推与卷积等都与序列顺序相关。具体结构见[模型注意力图](glm-5-3-flash.md)及[线性注意力](linear-attention.md)。RoPE 本身也不是所有线性注意力都不能使用的机制，原论文讨论了与线性自注意力结合的形式。[S1]

基础实现引用固定在上游 v0.23.0；GLM 部分使用[专用配置与源码基线](../sources/glm-5-3-flash-baseline.md)。两者的实现范围分别说明，设备内核与长文本效果尚未实测。
