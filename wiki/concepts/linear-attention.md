---
id: linear-attention
title: "KDA：通过递推状态处理序列"
type: concept
summary: GLM-5.3-Flash 的 KDA 层用按通道衰减、误差更新和查询读出维护矩阵状态，另保留短卷积历史；Prefill 与 Decode 分别使用适合批量和递推的执行路径。
aliases: [线性注意力, Linear Attention, KDA, Kimi Delta Attention, Gated DeltaNet, 递推状态, recurrent state]
chapters: ["04"]
order: 35
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - https://arxiv.org/html/2510.26692v1
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2072-L2105
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L169-L300
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L398-L474
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L496-L558
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L32
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2489-L2509
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768
  - https://arxiv.org/abs/2006.16236
  - https://arxiv.org/abs/2102.11174
  - https://arxiv.org/html/2406.06484v3
  - https://arxiv.org/html/2412.06464v3
verified: []
evidence: "C"
relations:
  - { to: attention-qkv, kind: builds-on, note: 比较逐位置评分与矩阵状态读出 }
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 从逐位置注意力到矩阵状态

[普通 softmax 注意力](attention-qkv.md)为当前 Q 与可见历史 K 逐一评分，再对 V 加权汇合。随着序列变长，需要保存和访问的历史也增加。线性注意力的一条基本路线是改变相似度函数，使历史贡献能够先汇总为固定形状的矩阵状态。[S10]

设 φ 是把 Q/K 转成特征向量的映射。一种带归一化的因果线性注意力可写为：[S10][D]

```text
Sₜ = Sₜ₋₁ + φ(kₜ) vₜᵀ
zₜ = zₜ₋₁ + φ(kₜ)
oₜ = Sₜᵀ φ(qₜ) / (zₜᵀ φ(qₜ))
```

S 汇总键和值的外积，z 汇总归一化需要的键特征。当前查询直接读取这两个状态，无需重新遍历每个历史位置。这里改变了注意力的相似度形式；softmax 包含非线性归一化，不能直接把 `softmax(QKᵀ)V` 任意改写成 `Q(KᵀV)`。

下面为比较更新机制，使用省略显式归一化分母、以已处理的 q/k 表示特征的递推形式。不同线性注意力的特征映射、归一化和门控可以不同；这段推导不是所有模型共有的完整实现。[S12]

## 从累加更新到 DeltaNet 的误差修正

基础累加形式为 `S_new=S_old+k vᵀ`，每个位置都把新的键值关联加入状态。它不先检查状态中同类键已经关联了什么值；键之间相似时，历史写入可能相互干扰。

DeltaNet 将直接累加改为根据当前预测误差更新：先用当前 k 读出 `v̂=S_oldᵀk`，再将 `β k(v−v̂)ᵀ` 加到状态中。这样更新的是与该键相关的偏差，而不是重复加入完整 v。β 控制更新强度。[S11][S12]

例如令 S 为零，k=(1,0)、v=(2,0)，并连续写入同一键值两次。累加更新使第一行从 (0,0) 变为 (2,0)，再变为 (4,0)；Delta 更新若 β=1，第二次已能正确预测 v，误差为零，第一行仍是 (2,0)。这是单位键、无衰减的教学算例，用来展示两种写入规则的区别。[A][D]

## 从 DeltaNet 到遗忘门，再到 KDA

误差更新针对当前键修正关联；另一个问题是如何主动减弱不再需要的旧信息。Gated DeltaNet 把遗忘门与 delta 更新结合，在修正前对旧状态施加衰减。这两种控制分别负责旧信息保留程度和当前键的定向修正。[S13]

KDA 进一步将每头一个衰减标量改为按 key 通道变化的衰减向量。同一头中，不同状态通道因而可以采用不同的保留程度，而不必一起缩放。[S2]

```wiki-diagram
file: kda-evolution
```

| 更新形式 | 从前一个基础保留什么 | 新增的变化 |
|---|---|---|
| 累加式线性注意力 | 用固定形状状态汇总历史 | 每个位置加入键值外积 |
| DeltaNet | 矩阵状态与查询读出 | 根据当前键的预测误差修正状态 |
| Gated DeltaNet | delta 定向更新 | 加入按头的遗忘门 |
| KDA | 遗忘门与 delta 更新 | 将遗忘控制细化到 key 通道 |

这条线索说明本页所需的机制关系，不是所有高效注意力的完整历史。MLA 走的是压缩历史表示路线，稀疏注意力限制查询范围；GLM 将这些机制与 KDA 放在不同层中组合，而不是用 KDA 全面替代它们。

## GLM 中的 KDA 状态与数据流

GLM-5.3-Flash 的主干采用 34 个 KDA 层和 11 个稀疏 MLA 层。KDA 是 Kimi Delta Attention：每处理一个位置，就更新一份矩阵状态，并用当前查询从状态中读出结果。普通自回归 Decode 中，状态形状不随已处理长度增加；新增 token 改变的是状态内容。[S1][S2]

KDA 是一种具体的线性注意力机制。这里的“线性”描述固定模型宽度下序列处理成本随长度的增长方式，不表示模型中只有线性变换，也不表示它与 softmax 注意力在数学上等价。

```wiki-diagram
file: linear-attention-state
```

图中画出单个注意力头、单个位置的逻辑递推。模型先从隐藏表示生成 Q/K/V、衰减门和更新强度；Q/K/V 经过短卷积，Q/K 还进行 L2 归一化，随后参与状态更新。多个头独立维护状态，结果再经过输出门控、归一化和投影返回隐藏宽度。[C4]

## 衰减、修正与读出

下面使用 `S∈R^(d_k×d_v)` 的数学布局，Q/K/V 使用列向量。省略批次、头编号、缩放与投影，令 D 为按 key 通道取值的对角衰减矩阵，β 为更新强度，可把一次更新写成：[S2][D]

```text
衰减：   S̄ = D S_old
预测：   v̂ = S̄ᵀ k
误差：   e = v − v̂
更新：   S_new = S̄ + β k eᵀ
读出：   o = S_newᵀ q
```

`k eᵀ` 是外积：用当前位置的键和值预测误差修正状态。β 控制此次修正强度，D 控制旧状态各通道的保留程度。KDA 相比按头使用单一衰减系数的 Gated DeltaNet，进一步细化了衰减粒度。[S2]

一个二维教学例子：取旧状态为单位矩阵，D=diag(0.5,1)，k=q=(1,0)，v=(3,2)，β=0.5。衰减后的预测为 (0.5,0)，误差为 (2.5,2)，更新后状态为 `[[1.75,1],[0,1]]`，读出为 (1.75,1)。这些数仅用于检查上述递推，不是 GLM 的实际激活值。[A][D]

模型每步更新的是请求状态，投影权重仍保持固定。状态把多个历史位置的信息融合在一起，通常不能从中逐个还原此前的 K/V；有限状态容量也会影响可表达的历史信息。

## 矩阵状态之外还有短卷积历史

固定配置的 KDA 为 64 个头、每头 128 维、短卷积核长度 4。以未作 TP 分片、未启用投机的形状为例，每层每请求的递推状态有 `64×128×128=1,048,576` 个标量；Q/K/V 的短卷积还需要保存 `3×64×128×(4−1)=73,728` 个标量。[S1][C7][D]

状态字节数还取决于 dtype。若递推状态使用 FP32、卷积状态使用 BF16，则两者分别为 4 MiB 和 144 KiB；这是明确精度假设下的逻辑容量，不代表运行时完整分配量。[A][D]

实现中的状态布局也可能与数学布局相反。专用 Prefill 路径从缓存读取 `[H,V,K]`，在算子边界转为 `[H,K,V]`，返回后转回。[C5] 检查张量时应同时核对维度含义，而不只看数值尺寸；本模型 K/V 维度相同，单看形状尤其容易遗漏转置。

## Prefill 批量处理，Decode 延续状态

Prefill 已知一段输入，可以使用 chunk 算法把部分递推改写成适合并行执行的运算。它读取请求已有的初始状态，在段内计算输出，并将最终状态写回。没有可复用初始状态时，从清零状态开始；已有初始状态时，在其基础上继续处理当前输入段。[C5]

Decode 通常只推进一个新位置，以递推方式读取和更新状态。启用投机解码时，一轮可能涉及多个候选位置，还需要根据接受数量选择有效状态；短卷积缓存也须保留相应空间。专用形状函数将投机 token 数计入卷积状态长度，不能沿用无投机时的容量结果。[C6][C7][C8]

因此，KDA 的数学固定状态与系统为前缀复用、投机、对齐预留的物理空间是两层问题。实际缓存分配见 [KV Cache Spec](kv-cache-spec.md)。

## 在 GLM 实现中定位 KDA

固定专用源码的 Decoder 在 KDA 层实例化 `KimiGatedDeltaNetAttention`，专用快照在上游版本为 0.23.0 时注册 Ascend 替换类，承接本页分析的 NPU 路径。[C3][C4][C9] 最终镜像中的实际安装组合仍待核实。 该类沿用 `AscendGDNAttentionBackend` 的接口名称，但 Prefill 调用的是 KDA 算子；后端名称不能单独证明模型使用 GDN 算法。[C4][C5]

阅读源码可按“Decoder 选择层 → Q/K/V 与门控投影 → 短卷积和递推 → 输出归一化及投影 → 状态规格”追踪。稀疏 MLA 则保留可按位置访问的历史。两类层共同组成模型，KDA 层状态不增长并不意味着整个 GLM 的缓存不增长。源码版本与部署验证范围见[来源基线](../sources/glm-5-3-flash-baseline.md)。


