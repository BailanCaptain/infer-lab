---
id: layers-and-hidden
title: "层与隐藏表示：GLM 的 45 层如何连接"
type: concept
summary: 模型层逐步更新本轮输入的隐藏表示。GLM 文本主干包含 45 层，注意力与前馈类型按层号配置；层间使用四路残差表示，末层汇合后再经归一化和输出投影产生词表分数。
aliases: [层, layer, Transformer 层, Decoder 层, 隐藏向量, 隐藏态, hidden state, 隐藏维度, 残差流]
chapters: ["03"]
order: 50
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2053-L2145
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2241
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2263-L2319
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L148-L153
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2454-L2470
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2515-L2517
verified: []
evidence: "C"
relations:
  - to: embedding
    kind: builds-on
    note: 嵌入提供本轮输入向量，模型层在这些向量上继续更新表示
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 模型层接收和交出什么

[嵌入](embedding.md)把 token 编号转换为输入向量。随后，模型按顺序执行各个 Decoder 层，每层结合本层权重和可访问的上下文，更新当前输入位置的表示。这些中间向量称为**隐藏表示**，它们保留连续的数值特征，供后续层继续计算。

GLM-5.3-Flash 文本主干有 45 层，编号为 0–44。每层先执行注意力子层，再执行前馈子层；层的骨架相似，实际注意力类型、前馈类型与参数由配置和层号决定。[S1][C2] 下图以 `T` 表示本轮处理的 token 位置数。

```wiki-diagram
file: layers-stack
```

图中每层旁的权重表示该层自己的参数。实现按层号分别构造模块；同一层的权重被不同输入位置和请求复用，各层并不是反复调用同一份权重。[C4]

## 相同的层骨架可以使用不同组件

注意力负责将上下文信息引入当前表示，前馈网络对各位置的特征进行非线性变换。两段计算的内部结构可以独立选择。

| GLM 层号 | 注意力类型 | 前馈类型 |
|---|---|---|
| 0、1、2 | KDA 线性注意力 | Dense FFN |
| 3、7、11、15、19、23、27、31、35、39、43 | 稀疏注意力 | MoE |
| 其余层，包含末层 44 | KDA 线性注意力 | MoE |

上述排列来自固定模型配置：34 层 KDA、11 层稀疏注意力；3 层 Dense FFN、42 层 MoE。[S1] 两类注意力怎样访问历史，见[模型的注意力组件图](glm-5-3-flash.md)；Dense 与 MoE 的共同计算部件在[前馈网络](mlp-residual-norm.md)中展开。

## 隐藏维度与残差流分别表示什么

设本轮处理 `T` 个 token 位置。文本嵌入的逻辑形状为 `[T, 4096]`，其中 4096 是每个向量的宽度。GLM 的 mHC 连接在第 0 层入口将这份表示展开为四路；所引实现以相同输入初始化四路，后续通过混合和子层计算更新它们。[S1][C3][C5]

在层间，将这些数据按逻辑轴展开可写为 `[T, 4, 4096]`：`T` 是输入位置数，4 是残差流数，4096 是每路宽度。代码中的存储可以将后两维展平；形状记法服务于解释数据归属，并不指定每个算子的物理布局。

每次进入注意力或前馈子层前，四路表示先混合为 `[T, 4096]`，经过 RMSNorm 后参与子层计算。子层输出与保留的四路表示再次混合，形成后续使用的四路表示。末层前馈计算完成后，所引实现沿四路求平均，恢复为 `[T, 4096]`，再执行最终 RMSNorm。[C3][C4]

mHC 的四路残差表示与子层的单路输入具有不同形状：前馈投影接收的宽度仍为 4096。完整连接见[模型单层图](glm-5-3-flash.md)。

## 本轮表示与历史状态怎样配合

单请求教学示例中，Prefill 的 `T = 4`，普通 Decode 的 `T = 1`。两种情况都经过完整文本主干：变化的是本轮参与计算的位置数和历史条件，而不是模型层数。[A]

| 数据 | 怎样使用 |
|---|---|
| 本轮隐藏表示 | 沿各层更新，承担当前输入位置的计算 |
| 各层的注意力历史状态 | 在该层的注意力实现中读取和更新，供后续轮次继续使用 |
| 模型权重 | 为固定模型的不同请求和轮次提供参数 |

Decode 中只送入一个新位置，不表示模型仅依据这个位置进行预测：注意力还会利用此前建立的历史状态。GLM 的 KDA 状态与稀疏注意力存储形式不同，不能把“隐藏表示”与一种统一的 K/V 缓存混写。历史如何按请求维护，见[单请求全过程](one-request.md)和[并发请求](concurrent-requests.md)。

## 从末层表示到下一个 token

末层汇合和最终归一化交出的是连续向量。普通生成路径取得各请求所需的最后位置表示，经输出投影产生词表分数，再由生成策略选择 token。GLM 的输出头按词表维度与隐藏维度建立，`compute_logits` 使用该头计算分数。[C6][C7]

因此，模型层、词表投影和 token 选择分别承担表示更新、候选评分与输出决策。请求何时开始下一轮由引擎负责，完整对应关系见[框架架构](vllm-v1-shape.md)。

本页依据[固定 GLM 配置和 Ascend 专用源码](../sources/glm-5-3-flash-baseline.md)描述文本主干，不含额外 MTP 路径，也没有设备运行结果。图中的本轮表示均采用逻辑形状，未展开并行分片。
