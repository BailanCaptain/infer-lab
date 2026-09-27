---
id: embedding
title: "嵌入：token 编号如何变成输入向量"
type: concept
summary: 嵌入按 token 编号从训练好的权重表中选取向量。GLM 文本嵌入的逻辑形状为 [154880, 4096]，本轮 4 个输入编号得到 [4, 4096]；后续层再结合位置与上下文更新表示。
aliases: [embedding, 词向量, 词嵌入, 嵌入向量, 嵌入层, embedding 表, 词嵌入表, embedding lookup]
chapters: ["01"]
order: 30
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2263-L2313
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2450-L2470
  - vllm@0fc695fc:vllm/model_executor/layers/vocab_parallel_embedding.py#L77-L78
  - vllm@0fc695fc:vllm/model_executor/layers/vocab_parallel_embedding.py#L477-L497
verified: []
evidence: "C"
relations:
  - to: token
    kind: builds-on
    note: 分词得到 token 编号，嵌入用这些编号选择输入向量
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 从离散编号到可计算的表示

[Token 编号](token.md)用于标识词表中的条目。编号相邻只说明索引相邻，其数值差不能直接衡量含义的相似程度。模型为每个编号保存一个可学习的向量，后续层通过这些向量进行矩阵运算和上下文交互。

保存这些向量的矩阵称为**嵌入权重表**，记作 `E`。若词表维度是 `V`、隐藏维度是 `H`，它的逻辑形状为 `[V, H]`。输入编号 `t` 选择第 `t` 行，得到长度为 `H` 的向量：

```text
输入编号 t → E[t, :] → 一个 H 维向量
```

GLM-5.3-Flash 文本配置给出 `V = 154880`、`H = 4096`；固定 Ascend 实现用这两个维度创建嵌入层，并在文本输入路径中按编号取得隐藏表示。[S1][C2]

## 一组编号怎样取出一组向量

沿用单请求页的 4 个输入位置。为了展开查表过程，图中额外假设编号为 `[8, 9, 312, 8]`，与任何实际提示词无关；表格只画部分行和维度。[A]

```wiki-diagram
file: embedding-lookup
```

图中第一个和第四个位置都使用编号 8，因此在固定权重、相同查表路径下，取出的初始词嵌入相同。两者仍是序列中的不同位置，进入后续层后，各自的上下文和位置参与计算，隐藏表示可以随之不同。

按输入顺序排列取出的行，便得到本轮输入张量：

```text
input_ids = [8, 9, 312, 8]         形状 [4]
X = [E[8, :], E[9, :],
     E[312, :], E[8, :]]          形状 [4, 4096]
```

这里的“行”对应本轮处理的 token 位置。在[多请求并发](concurrent-requests.md)中，同样的 `[4, 4096]` 可能来自 A 的 1 个位置和 C 的 3 个位置；请求归属另由序列边界和状态映射维护。[D]

## 嵌入表与请求表示具有不同的生命周期

嵌入表属于模型权重，训练时学习其中的数值；固定模型的普通推理读取这些权重。由查表产生的 `X` 则是本轮输入的表示，随编号、批次和后续计算变化。

| 对象 | GLM 文本路径中的逻辑形状 | 含义 |
|---|---|---|
| 嵌入权重 `E` | `[154880, 4096]` | 为词表编号提供初始向量 |
| 本轮 4 个输入的嵌入 | `[4, 4096]` | 按本轮编号取出的 4 行 |
| 单请求普通 decode 的新输入 | `[1, 4096]` | 新 token 的初始向量；已有历史另由状态保存 |

嵌入表包含 `154880 × 4096 = 634388480` 个标量。若仅为估算而假设每个标量占 2 字节，则其未分片权重载荷约为 `1.18 GiB`；这不包括词表填充、额外缓冲，也不代表某个设备的实际占用。[A][D]

4096 是文本嵌入的宽度。进入 GLM 的 mHC 残差结构后，每个位置维护四路表示，子层计算前再组合为一个 4096 维向量；这些连接在[模型单层图](glm-5-3-flash.md)展开。嵌入页的二维张量描述的是模型入口。

## 按行选择如何落实到执行实现

在数学定义上，嵌入是按编号取行。所引上游实现的普通嵌入方法调用 `F.embedding`；词表并行层还包含编号映射、无关分片输出屏蔽和跨分片归约，因此完整执行可能涉及通信。[C4][C5]

固定 GLM 实现通过 `VocabParallelEmbedding` 建立入口，`embed_input_ids` 也委托给这张表。`forward` 可以接收已经准备好的 `inputs_embeds`，在这种路径下直接使用输入表示；本页的编号查表图对应纯文本编号入口。[C2][C3]

输入嵌入和输出投影分别承担“编号到向量”与“隐藏表示到词表分数”的工作。GLM 配置的 `tie_word_embeddings` 为 false，不能因为两者都带词表维度就把它们计作同一份权重。[S1]

源码依据沿用[主线来源基线](../sources/glm-5-3-flash-baseline.md)：Ascend 专用快照解释 GLM 入口，上游 v0.23.0 展示词表并行层的通用实现；尚未验证专用镜像内最终安装组合及实际通信路径。接着阅读[矩阵乘与权重](matmul-and-weights.md)，看取得的向量如何被投影为新的表示。
