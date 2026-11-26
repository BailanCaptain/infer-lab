---
id: glm-5-3-flash
title: 认识 GLM-5.3-Flash：模型长什么样，每种层从哪里来
type: concept
origin: gap
summary: >-
  GLM-5.3-Flash 模型形状的唯一出处：45 层里 34 层 KDA、11 层稀疏 MLA，四条 residual 流，前 3 层稠密 MLP、其余
  42 层 288 选 8 的 MoE，外加 1 个 MTP 层；每种层先讲它从哪个基础机制演变来，再给 GLM 的具体维度、参数量与权重精度。
aliases:
  - GLM 模型总览
  - GLM-5.3-Flash 模型结构
  - 模型计算全景
  - GLM 层型表
  - GLM-5.3-Flash 配置
  - GLM 参数量
  - 模型维度
  - 路由专家
  - 四路残差
  - 词表分数
  - 索引器
  - kpool
  - DSA
  - DeepSeek Sparse Attention
  - lightning indexer
  - GLM
  - GLM5.3-Flash
  - GLM-5.3
  - Glm5NextForCausalLM
  - Glm5NextForConditionalGeneration
  - Glm5NextMTP
chapters:
  - '00'
order: 5
sources:
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - 'https://huggingface.co/zai-org/GLM-5.3-Flash'
  - >-
    https://www.modelscope.cn/api/v1/models/Eco-Tech/GLM-5.3-Flash-w8a8/repo?Revision=9e55cbc8e2b19e20c63b08b916d2582f25a22504&FilePath=config.json
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2053-L2242'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2245-L2319'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2437-L2517'
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L102-L385
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L353'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/triton/kda/kda.py#L1276-L1288'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1881-L2050'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1235-L1400'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/ops/glm5_next_kpool_state_compress.py#L139-L293
  - >-
    vllm-ascend@db701c1f:vllm_ascend/ops/triton/glm5_next_lightning_indexer.py#L23-L237
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1403-L1539'
  - 'vllm@0fc695fc:vllm/model_executor/layers/fused_moe/cpu_fused_moe.py#L63-L117'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/experts_selector.py#L292-L309'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L39-L125'
  - 'vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L489-L596'
  - 'vllm-ascend@db701c1f:vllm_ascend/quantization/modelslim_config.py#L632-L736'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L55-L100
  - 'https://arxiv.org/html/2512.02556v1'
  - 'https://arxiv.org/html/2405.04434v5'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L94-L191'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1173-L1454
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1140-L1232'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/ops/glm5_next_lightning_indexer.py#L166-L504
  - >-
    raw:sha256-a8adad8cb834fac4c89fe9f8175c501254f418b7a8fe8975ca54df642b753303.md#L1-L2798
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/kda.py#L108-L187'
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/attention.py#L96-L137'
  - 'vllm-ascend@7d825229:docs/source/tutorials/models/GLM5.3-Flash.md#L17-L43'
  - 'vllm-ascend@7d825229:docs/source/tutorials/models/GLM5.3-Flash.md#L1-L9'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/indexer_kpool.py#L437-L476'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/tutorials/models/GLM5.3-Flash.md#L17-L43
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/7d825229/docs/source/tutorials/models/GLM5.3-Flash.md#L1-L9
  - >-
    https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/9e55cbc8e2b19e20c63b08b916d2582f25a22504/quant_model_description.json
  - >-
    https://www.modelscope.cn/models/Eco-Tech/GLM-5.3-Flash-w8a8/resolve/3121f187149ef2defa15f2b28adad10e272681d9/quant_model_description.json
  - >-
    https://huggingface.co/api/models/zai-org/GLM-5.3-Flash/revision/690b705278a3a58e538fcb37c2ca8b5f9511213c
  - 'vllm@0fc695fc:vllm/model_executor/models/deepseek_mtp.py#L43-L60'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/kda.py#L171-L185'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/attention.py#L183-L220'
  - 'vllm-ascend@c09d3e20:docs/source/tutorials/models/GLM5.3-Flash.md#L1-L45'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/kda.py#L299-L325'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/kda_input_projection_tp.py#L18-L45'
  - 'vllm-ascend@8d6180e2:docs/source/tutorials/models/GLM5.3-Flash.md#L1-L45'
relations:
  - to: learning-guide
    kind: builds-on
    note: 阅读指南说明学习路线与证据记号，本页开始展开其中的模型计算
  - to: token
    kind: builds-on
    note: 模型输入是分词后的编号；不熟悉 token 时先了解文本如何被切分
  - to: kv-cache
    kind: builds-on
    note: 模型页对跨轮次状态及引擎职责的说明，依赖 KV cache 对不同历史状态的统一管理。
  - to: lm-head
    kind: builds-on
    note: 模型页的最终词表打分步骤建立在 lm_head 输出投影机制上，并给出 GLM 的具体权重形状和词表大小。
  - to: mla
    kind: builds-on
    note: GLM 的 11 层稀疏 MLA 与第 45 层 MTP 沿用 MLA 潜向量压缩与矩阵吸收原理，并取消 RoPE 且前置 kpool 索引器
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
contradicts: []
updated: '2026-11-03'
rawSources:
  - >-
    raw/sha256-a8adad8cb834fac4c89fe9f8175c501254f418b7a8fe8975ca54df642b753303.md
  - >-
    raw/sha256-c8fdb2ea48313e1846c2fd534f5fc31911123b5a235758f64b667774c8ac9c13.md
---

## 先认识引擎要执行的模型

GLM-5.3-Flash 把文本变成张量（多维数组），逐层汇入前文信息，最后给下一个 token（分词后的单位）打分。推理引擎围绕这次计算准备输入、保存历史、返回结果。

本页讲文字模型：每层先做 attention，把前文信息汇到当前位置；再做 MLP，对这个位置单独加工。attention 有 KDA（把历史压进固定大小的矩阵）和稀疏 MLA（逐位置压短历史，再挑一部分读）；MLP 有稠密 MLP（全部 token 共用）和 MoE（从多个小 MLP 专家中挑选）。下文先讲机制，再列形状、参数量与精度。模型也有图像和视频入口，本文不展开。

部署条件统一见[部署前提](glm-5-3-flash-two-node.md#部署前提)；本页的计算发生在[一条请求的第 4 站](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)。

## 模型怎样产生下一个 token

文本先经分词器变成一串 token 编号，记为 `x₁ … xₚ`。token 是分词器切出来的离散符号，用整数编号表示，一个 token 不一定对应一个字或一个词，切分方式见 [token](token.md)。普通的**自回归生成**（每次把刚产出的 token 拼回末尾作为下一轮输入，逐个往后生成）每一轮只产出一个新 token，每一轮都走下面四步：

1. **查 embedding。** embedding（词向量）是一张 154880 行、4096 列的权重表。每个 token 编号取出其中一行，得到一条 4096 维的**隐藏向量**（hidden）——模型给每个位置维护的中间表示，后面所有层改的都是它。154880 是词表大小，4096 是隐藏宽度。查表过程见 [embedding](embedding.md)。
2. **沿 45 层更新隐藏向量。** 隐藏向量沿 residual 流一层层往下走，每层把算出的改动加到它上面（GLM 用四条并行的 residual 流，下一节讲）。每一层先做 **attention**：当前位置生成一个查询向量 **Q**，每个历史位置有一个键向量 **K** 和一个值向量 **V**；Q 和每个 K 算出匹配分数，再按分数把各位置的 V 加权汇合，前文的信息就这样汇到当前位置。attention 通常分成多个**头**（attention head），每个头在自己的一小段维度里独立做一遍，结果再拼起来。然后做 **MLP**：对每个位置单独做一次「升维、非线性、降维」的前馈变换，加工这个位置自己的表示。开头说的两种 attention（KDA、稀疏 MLA）和两种 MLP（稠密 MLP、MoE），后文各有一节。
3. **把最后位置变成词表分数。** 45 层走完，最后一个位置的隐藏向量先做一次 RMSNorm（按向量的均方根把它缩放到稳定的数值范围），再乘输出投影 `lm_head`（一张 154880 × 4096 的权重），得到 154880 个分数，叫 **logits**。每个分数对应词表里的一个候选 token。
4. **选出 token，进入下一轮。** 生成策略根据 logits 选一个 token：贪心就取分数最高的那个，采样就先把分数换成概率再抽。选出的编号交给解码器变成文字；还没满足停止条件时，它也是下一轮的输入。

```wiki-diagram
file: glm-flash-overview
```

图右侧是 45 层 attention 的排法：K 是 KDA 层，S 是稀疏 MLA 层。「K K K S」这组顺序重复 11 次，一共 44 层，最后再接一个 K，所以最后的第 44 层也是 KDA。

处理提示词、建立后续历史状态的阶段叫 **prefill**，可以一次完成，也可以按预算分多轮；完成最后一个提示词位置后，其 logits 用来选出第一个生成的 token。之后的生成阶段叫 **decode**：普通逐 token 路径只送进上一轮选出的那 1 个 token，历史状态接着用。多条请求同时在跑时，引擎把它们这一轮要算的 token 拼成一批，一起走一次前向。官方部署还开了 speculative decoding（投机解码：先猜出后面几个候选 token，再让主模型一次验证），候选由模型自带的 MTP 层（Multi-Token Prediction）来猜，decode 一轮会多送几个候选 token，见后文「MTP」一节。

## 一层有两段计算，四条 residual 流贯穿两段

**先看最基础的一层。** 普通 Transformer 的一层有两段子层：attention 段和 MLP 段。两段的套路相同：先用 RMSNorm 把输入缩放到稳定的数值范围，再算子层，最后把子层输出**加回**子层的输入。最后这一步叫 **residual**（残差连接）：输入沿一条不做任何变换的旁路直接送到出口，子层只需要算出「在输入上改多少」。这条旁路从第 0 层一直通到最后一层，所以常叫 residual 流。三个部件的基础讲法见[前馈、残差与 RMSNorm](mlp-residual-norm.md)。

**GLM 把这条旁路扩成四条。** GLM 用 mHC（Manifold-Constrained Hyper-Connections）在层间同时传四条 residual 流，每条宽 4096。每段子层入口先把四条按权重合成一条去算（入口混合）；出口再把输出写回四条，并让旧的四条经 Sinkhorn 约束（反复把矩阵各行、各列归一化，使四路混合权重保持双随机、防止残差逐层放大或衰减）的 4 × 4 矩阵互相混合（出口混合）。每层做两次，到第 44 层结束时四条求平均回到一条。为什么要四条、Sinkhorn 管什么，见[层与隐藏表示](layers-and-hidden.md#为什么要四条流sinkhorn-又管什么代价在哪)；在 GLM 上代价多大，见[mHC 在 GLM 上多花了什么](layers-and-hidden.md#mhc-在-glm-上多花了什么)。

```wiki-diagram
file: glm-flash-layer
```

图中左右两框是同一层的两段。青色旁路是原来的四条流，它们绕过子层直接到出口；虚线是入口处算出的混合系数，送到出口去用。attention 段出口的四条流就是 MLP 段入口的四条流。

MTP 层（第 45 层）不用 mHC，只有一条普通 residual 流，见后文「MTP」一节。

下面用每路 **4 个通道**的完整向量观察入口混合。四行是同一个 token 的四路 residual，不是四个 token；横向 c0–c3 才是向量的通道。每路乘自己的 pre 系数，再把同一列的四份贡献相加，得到 `[2,4,4,8]`；随后整行做 RMSNorm，得到 `[0.4,0.8,0.8,1.6]`。系数和数值仅为教学示意，取 γ=1、忽略 ε，真实每路宽 4096。

```wiki-scene
model-compute:0
```

出口处再单独观察四路如何接回子层输出：四路旧值经 comb 混合，示意子层输出 `[2,−2,4,−4]` 经各路 post 系数缩放，两支在同一通道上相加。输出仍是四行、每行四个通道；这四条完整向量一起交给后续子层。这里的子层输出是另给的示意值，不是省略的 attention 运算结果。

```wiki-scene
model-compute:3
```

## 45 层怎样排

每层都是上面那两段，区别只在 attention 段用 KDA 还是稀疏 MLA、MLP 段用稠密 MLP 还是 MoE。层号从 0 开始：

| 层号 | 层数 | attention | MLP |
|---|---|---|---|
| 0、1、2 | 3 | KDA | 稠密 MLP |
| 3、7、11、15、19、23、27、31、35、39、43 | 11 | 稀疏 MLA | MoE |
| 其余：4–6、8–10、…、40–42，以及最后的 44 | 31 | KDA | MoE |
| 主干之外的 MTP 层：45 | 1 | 稀疏 MLA | MoE |

按 attention 分，主干是 **34 层 KDA、11 层稀疏 MLA**；按 MLP 分，是**前 3 层稠密、其余 42 层 MoE**。两种划分互相独立：前 3 层的 attention 仍是 KDA，11 个稀疏 MLA 层都落在 MoE 段里。

**两种 attention 为什么混着用。** 它们的长处和短处正好互补，下两节细讲：

- KDA 的历史是一个固定大小的矩阵。上下文再长，每层要存、要读的都一样多；代价是全部历史被压进同一个矩阵，固定大小的矩阵装不下任意多的细节，很久以前某个 token 的原样信息可能已经被后来的更新冲淡。
- 稀疏 MLA 给每个历史 token 都留了一条向量，能按位置直接找回；代价是要存的东西随上下文变长而增加。

GLM 让 3 层 KDA 配 1 层稀疏 MLA：大部分层的开销不随上下文增长，每隔 4 层仍有一层能直接回看历史上的具体位置。

## KDA：把全部历史压进一个固定大小的矩阵

**起点：标准 attention 要留住每一个历史位置。** 标准 attention 算分数后会经过 softmax（把一排分数换算成加起来等于 1 的比例），再按比例汇合 V。第 t 个位置要用自己的 Q 和前面全部 t 个 K 算分数、汇合全部 t 个 V，所以每个历史位置的 K、V 都得存着。这份存储叫 **KV cache**。生成第 t 个 token 要读 t 份，上下文越长，读得越多、占的显存也越多。基础公式见 [attention 与 Q/K/V](attention-qkv.md)。

**第一步：linear attention 把历史攒成一个矩阵。** 去掉 softmax 之后，所有历史位置的 `k vᵀ`（外积：k 的每一维乘 v 的每一维，排成一个 128 × 128 的矩阵）可以先加在一起，攒成一个矩阵 S，叫**状态**。每来一个新 token，把它的 `k vᵀ` 加进 S，再用 q 从 S 里读出结果：`o = Sᵀq`。状态大小固定，和历史多长无关，这类方法叫 **linear attention**（线性注意力）。

**第二步：DeltaNet 改成纠错式写入。** 只做加法时，同一个 k 反复写入会越叠越多，旧的关联也擦不掉。DeltaNet 先用当前的 k 从 S 里读出「状态现在以为的 v」，和真正的 v 相减，只把差值写回去，写入强度是一个 0 到 1 之间的数 β。

**第三步：Gated DeltaNet 加遗忘门。** 写入之前，先把整个旧状态乘一个 0 到 1 之间的衰减系数 α，让不再需要的旧信息逐渐淡出。每个头每一步只有一个 α。

**第四步：KDA 把遗忘细化到每个通道。** KDA 把「每个头一个 α」换成「每个头 128 个 α」，k 的每一维（通道）各自决定保留多少。一次更新写成：

```text
S ← (I − β k kᵀ) · Diag(α) · S + β k vᵀ
o = Sᵀ q
```

第一行的 `Diag(α)` 先按通道衰减旧状态，`(I − β k kᵀ)` 和 `β k vᵀ` 合起来就是 DeltaNet 的纠错写入。每一步的演变和图解见 [KDA 专页](linear-attention.md)。

**GLM 的 KDA 层。** 64 个头，每头 128 维，64 × 128 = 8192。一个 token 的 4096 维输入在 attention 段里依次经过：

| 步骤 | 形状 | 作用 |
|---|---|---|
| Q、K、V 投影 | 各 4096 → 8192 | 每头得到 128 维的 q、k、v |
| 短卷积 | 核长 4，逐通道作用在 Q、K、V 上 | 把当前 token 和前 3 个 token 按通道加权混合，带进相邻位置的信息；卷积后再过一次 SiLU（`x · sigmoid(x)`，平滑非线性激活函数） |
| L2 归一化 | q、k 各自归一到长度 1 | `(I − β k kᵀ)` 这一项因此不会把状态放大 |
| 写入强度 β | 4096 → 64，经 sigmoid（把任意实数压到 0 到 1 之间的函数） | 每头每步一个 0 到 1 之间的数 |
| 遗忘门 α | 4096 → 128 → 8192 | 每头 128 个衰减系数；α 的对数被限制在 −5 到 0 之间，也就是每一步每个通道至少保留 e⁻⁵ ≈ 0.7% |
| 状态更新与读出 | 每头一个 128 × 128 的状态矩阵 | 上面那两行公式 |
| 输出门与归一化 | 门也是 4096 → 128 → 8192；每头 128 维做 RMSNorm | 归一后的输出乘上 sigmoid 门，按当前 token 决定各通道放出多少 |
| 输出投影 | 8192 → 4096 | 回到隐藏宽度，交给 mHC 的出口混合 |

一个请求在一个 KDA 层里要保存的只有两样：64 个 128 × 128 的状态矩阵，和短卷积要用的最近 3 个 token 的 Q、K、V。两样都和请求已经多长无关。prefill 时一整段提示词切成块并行算，数学上等价于逐个递推；decode 时逐个 token 递推。状态占多少显存、每张卡存哪几个头，见[我们的部署](glm-5-3-flash-two-node.md)。

## 稀疏 MLA：先把历史压短，再挑着读

**起点：多头 attention 每个头都要存 K 和 V。** 标准多头 attention 里，每个历史 token 在每一层要为每个头各存一份 K 和一份 V。按 GLM 这 11 层的头数算（64 个头，每头 K、V 各 256 维），每个 token 每层要存 64 × (256 + 256) = 32768 个数。

**第一步：MLA 把 K 和 V 压成一条潜向量。** MLA 只缓存一条短向量，需要各头的 K、V 时再用投影矩阵解压。还可以改变乘法顺序：原来是「先解压历史，再与 Q 匹配」，现在把 K 的解压矩阵先乘到 Q 上，再去匹配压缩的历史；V 的解压同样并进输出投影。这叫**矩阵吸收**，省掉了每次读历史时的展开，推导见 [MLA](mla.md)。

GLM 的潜向量宽 512，是 32768 的 1/64；解压形状为 512 → 64 × (256 + 256)，吸收后打分和汇合直接在 512 维里做。Q 另有一条 1536 → 64 × 256 的压缩、展开路径，只减少投影参数和计算，不改变缓存。

**GLM 的这一配置没有位置编码。** RoPE（旋转位置编码）按位置编号把 Q 和 K「旋转」一个角度，让分数能感知两个 token 相隔多远。DeepSeek 原版的 MLA 里，RoPE 会挡住矩阵吸收：旋转矩阵随当前 token 的位置变化，夹在 Q 的投影和 K 的解压矩阵之间，两者就没法提前合并。所以原版另留一小段带 RoPE 的 K，所有头共用，和潜向量一起存进缓存。GLM 把 RoPE 维数设成 0，这一段就没有了：缓存里只剩 512 维潜向量，矩阵吸收也不用再绕开它。

**第二步：用 indexer 先筛出值得读的位置。** MLA 缩短了每条历史，却仍要逐条读：历史有 10 万个 token，就要给 10 万条潜向量打分。DeepSeek-V3.2 提出的 DSA（DeepSeek Sparse Attention）在主 attention 旁加了轻量的 lightning indexer。它先粗筛，交出位置编号，主 attention 再去这些位置读取潜向量、汇合内容。这就是 sparse attention：每次只读因果范围内的一部分历史，即当前位置及其之前的位置。

**第三步：kpool 让粗筛也少做一些工作。** 原版 DSA 逐个 token 挑；GLM 把相邻 token 的 indexer K 合成一个 kpool，给整池打分。池 K 是供粗筛使用的摘要，主 attention 缓存的各条潜向量仍各自保留。一次查询按以下顺序走：

1. **准备查询与摘要材料。** 当前 token 生成 indexer 的多头 Q、各头权重，以及自己的 K 和压池门控；K 与门控得分写入状态，等相邻位置凑成完整池。
2. **压池。** 用压池门控把池内各位置的 K 加权合成一条池 K，写入 indexer 缓存。每个通道分别决定池内哪些位置占多少比例。
3. **选池。** 当前查询的各头 Q 与池 K 匹配；头权重决定各头的分数占多少，合成池分数后取最高的一批。原版 DSA 对各头点积先做 ReLU（把负值置零）再加权求和；本基线直接对带符号的点积加权求和，实现时先合成头加权查询，再与池 K 点乘。
4. **展开并补尾。** 将选中的池编号展开成 token 位置；最新几个尚未凑成完整池的位置直接补入，确保它们也能被读到。
5. **主 attention 读内容。** 按这些位置取出 MLA 潜向量，完成精细打分、汇合和输出投影。

落到 GLM：每 4 个相邻位置压成一池，2048 个 token 的预算对应 512 个池。例如选中位置 0–3 所在的池，就读取这四条潜向量；未满下一池的最新位置作为尾部另加。原版 DSA 的预算也是 2048，但逐个位置选择。

选池前还要限定哪些完整池可见：所示实现先将当前位置加 1，再除以池大小并向下取整，得到因果范围内已经形成的完整池数；随后与请求实际拥有的池数取较小值。因此，512 个池是选择预算，不代表每个位置都有这么多完整池可选。

```wiki-diagram
file: glm-flash-indexer-flow
```

**两种权重沿不同方向起作用。** 压池门控在「同一通道的不同位置」之间分配比例；头权重在「同一查询的不同头」之间分配影响。对应形状如下：

| 材料 | 从哪里来 | 用在哪里 |
|---|---|---|
| 压池门控 | 每个位置的 4096 维隐藏向量 → 128 个值，再加池内位置偏置 | 每个通道在 4 个位置间做 softmax，加权合成池 K |
| 头权重 | 当前隐藏向量经同一条 4096 → 160 投影，同时得到 128 维 K 与 32 个头权重；头权重再乘 128⁻¹ᐟ² × 32⁻¹ᐟ² | 每个 indexer 头一个权重，合成池分数 |
| indexer Q 与池 K | MLA 的 1536 维 Q → 32 头 × 每头 128 维；池 K 为 128 维 | 所有头共用同一条池 K 来匹配 |

主 attention 的 64 个头随后读取所选位置的 512 维潜向量，输出投影回 4096 维。最新位置最多差 3 个才凑满一池，因此尾部额外预留 3 个位置：

$$\text{单次查询最大读取位置数} = 512\text{ 池} \times 4\text{ 位置/池} + 3\text{ 尾部位置} = 2048 + 3 = 2051\text{ 个位置}$$

| 读取预算分项 | 算式 | 位置数 |
| --- | --- | --- |
| 选中的完整池 | $512\text{ 池} \times 4\text{ 个位置}$ | **2,048** |
| 未凑满一池的尾部预留 | 最多 3 个最新位置 | **+3** |
| **单次查询读取上限** | $2048 + 3$ | **2,051 个位置** |

历史不到 2051 个 token 时稀疏 MLA 层等于读全部历史，更长才真正挑选：到部署上限 133120 个 token 时只读其中 1/65，推导见[稀疏注意力](sparse-attention.md#稀疏什么时候才真的起作用)。

**位置信息从哪来。** 稀疏 MLA 层和索引器都不加 RoPE。模型里对 token 先后顺序敏感的计算只剩三处：KDA 层（按顺序逐个递推，短卷积只看前 3 个 token）；索引器压池时的池内位置偏置（只区分一个 token 在池里排第几）；attention 的因果范围（每个位置只能看它自己和它之前的位置）。

## 两类 attention 各自留下什么历史

```wiki-diagram
file: glm-flash-attention
```

上半图是 KDA 的一步：上一步的状态矩阵先按遗忘门衰减，再写入当前 token 的 k、v，得到更新后的状态，q 从里面读出当前输出；虚线表示状态留给下一个位置接着用。下半图是稀疏 MLA 的一步：当前隐藏向量一路生成 Q，一路进索引器。索引器读的是自己那份缓存里的池 K（上面一行，每个池一条），给池打分；选中的池再落到下面一行对应的 4 个潜向量上，连同还没凑满一池的尾巴，一起拿去和 Q 算 attention。图中每 4 格一个池，只画了 1 个池的预算，省略了头数和维度。

每处理一个 token，这些历史就更新一次，下一轮接着用。一个请求在各层留下的东西：

| 保存的东西 | 在哪些层 | 每个请求存多少 | 上下文变长时 |
|---|---|---|---|
| KDA 状态矩阵 | 34 个 KDA 层 | 每层 64 个 128 × 128 | 不变 |
| KDA 短卷积历史 | 34 个 KDA 层 | 每层最近 3 个 token 的 Q、K、V，各 8192 维 | 不变 |
| MLA 潜向量 | 11 个稀疏 MLA 层 | 每层每个 token 一条 512 维 | 跟着 token 数增长 |
| 索引器的池 K | 11 个稀疏 MLA 层 | 每层每 4 个 token 一条 128 维 | 跟着 token 数增长 |
| 索引器未满一池的尾巴 | 11 个稀疏 MLA 层 | 每层最近几个 token 的 K 和得分，等凑满 4 个再压成池 | 不变 |
| 四条 residual 流 | 45 层之间 | 只在本轮前向里逐层传递，算完不保留 | 与历史无关 |

前五样都要跨轮次保存。vLLM 把它们统一交给 KV cache 管理，包括本来不是 K 和 V 的 KDA 状态。开了 MTP 的部署里，第 45 层也是一个稀疏 MLA 层，多存一份潜向量和池 K。这些东西各占多少字节、一张卡能装多少，见[我们的部署 · 剩下的显存变成多少 KV cache](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

## MoE：288 个专家里每次挑 8 个

**起点：稠密 MLP。** 前 3 层的 MLP 是带门控的 **SwiGLU** 结构：输入 4096 维，同时乘两个 4096 → 12288 的矩阵，得到 gate 和 up 两份。gate 经过 SiLU（`x · sigmoid(x)`，一种平滑的非线性函数）后和 up 逐元素相乘，GLM 还用 `swiglu_limit=10` 限制这一步的数值范围（路由专家和共享专家也有同样的上限）。最后乘一个 12288 → 4096 的矩阵降回隐藏宽度；所有 token 都用同一套权重。

**第一步：MoE 把一个大 MLP 换成很多小 MLP。** MoE 准备很多个结构相同、权重不同的小 MLP，每个叫一个专家（expert）。每层还有一个 **router**（路由器）：一个小线性层，给每个 token 对每个专家打分，只让分最高的几个专家处理这个 token，再把它们的输出按分数加权合起来。参数总量可以很大，每个 token 只用到其中一小部分。基础讲法见 [MoE](moe.md)。

**第二步：专家切得更细，再加一个共享专家。** GLM 的专家很窄：中间宽度只有 2048（稠密 MLP 是 12288），但数量多，每层 288 个，每个 token 挑 8 个。另有 1 个**共享专家**（shared expert），结构和路由专家相同，不参加挑选，所有 token 都要过它；它的输出和 8 个路由专家的加权和直接相加。可供 router 选择的那 288 个叫**路由专家**。

**GLM 的 router 怎样打分。**

1. router 是一个 4096 → 288 的线性层，用 FP32（32 位浮点数）计算，给每个专家一个分，经 sigmoid 变成 0 到 1 之间的数。
2. 挑选时给每个专家的分数加一个偏置（`e_score_correction_bias`，每层 288 个数），再取前 8 名。偏置只决定「选谁」：组合权重用的仍是加偏置之前的分数。
3. 选中的 8 个分数先归一到和为 1，再整体乘 2.5，作为 8 个专家输出的组合权重。
4. 配置里 `n_group=1`、`topk_group=1`，专家不分组，直接在 288 个里选 8 个。

```wiki-diagram
file: glm-flash-moe
```

图中是一个 token 在一个 MoE 层里的计算：选中的 8 个路由专家各自接收这个 token 的隐藏向量，其余 280 个不参与这个 token 的计算；共享专家单独算，结果在出口相加，宽度仍是 4096。同一批里的其他 token 可以选不同的专家；进入下一个 MoE 层时，那一层的 router 按新的隐藏向量重新选。

42 个 MoE 层的路由专家占全模型最大的一块参数（见下文「参数量」）；怎样分到各卡并交换 token，见[部署前提](glm-5-3-flash-two-node.md#部署前提)与[专家并行](expert-parallel.md)。

## MTP：主干之外的第 45 层

`config.json` 还带 1 个 **MTP** 层（Multi-Token Prediction，多 token 预测），编号 45。它不在 45 层主干里，用途是给 **speculative decoding**（投机解码）出候选：先用便宜的办法猜出后面几个 token，再让主模型一次前向把它们一起验证，猜对几个，这一轮就推进几个位置。原理见[投机解码](speculative-decoding.md)。

```wiki-diagram
file: glm-flash-mtp-flow
```

两路输入相差一个位置，是因为预测第 t + 2 个 token 时，既要利用第 t 个位置已经汇总的上下文，也要知道刚确定的第 t + 1 个 token。位置 0 的 embedding 输入先置零。反馈的隐藏向量取自预测层后的 RMSNorm，词表投影从它另行算出 logits。

中间的 `mtp_block` 有自己的稀疏 MLA、索引器和 MoE 专家，使用单条 residual 流；本基线 PP=1、没有压缩模型标记 `compress_ratios`，embedding 与 `lm_head` 共享主模型权重。共享 embedding 的代码另有 PP 与压缩模型条件，不能推到所有 MTP 部署。每遍取 logits 最大值生成候选，达到配置数量后交给主模型验证，接受与回退的算例见[一条请求](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)。

一轮要猜几个候选，由部署参数决定，同一个 MTP 层可以接连跑几次；配置见[部署前提](glm-5-3-flash-two-node.md#部署前提)，每遍索引器是否重算、实际宽度与通信见[一条请求的草拟过程](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)。

后续草拟步骤还要区分缓冲区行数与本轮实际查询行数：逐步即时执行（eager）时，缓冲区可能仍保留首轮长度。所示实现会在实际 token 数与位置数组长度之间取较小值，避免多出的填充行参与缓存与索引器寻址；完整计算图（FULL）路径则保留捕获时的固定形状。这个区别针对这里的实现，不代表所有 MTP 实现。

## 全模型形状总表

前面几节讲到的维度汇总在这里，全知识库引用 GLM 的维度时以这张表为准。值全部来自 `config.json` 的 `text_config`；层号从 0 数起。

| 部件 | GLM-5.3-Flash 的值 | `config.json` 字段 |
|---|---|---|
| 主干层数 | 45 层，编号 0–44 | `num_hidden_layers` |
| 隐藏宽度 | 4096 | `hidden_size` |
| 词表 | 154880；embedding 和 `lm_head` 各有一张，不共用 | `vocab_size`、`tie_word_embeddings=false` |
| residual 流 | 4 条，每条宽 4096，用 mHC 混合 | `mhc=true`、`hc_mult=4`、`hc_sinkhorn_iters=20` |
| attention 层型 | 34 层 KDA；11 层稀疏 MLA，层号 3、7、11、…、43 | `layer_types`、`linear_attn_config.kda_layers` |
| MLP 层型 | 第 0–2 层是稠密 MLP，中间宽度 12288；第 3–44 层共 42 层是 MoE | `first_k_dense_replace=3`、`intermediate_size`、`mlp_layer_types` |
| MoE | 288 个路由专家，每个 token 选 8 个；另有 1 个共享专家；每个专家的中间宽度 2048 | `n_routed_experts`、`num_experts_per_tok`、`n_shared_experts`、`moe_intermediate_size` |
| router 打分 | sigmoid 打分，加一份偏置后选前 8 名，8 个分数归一化后再乘 2.5 | `scoring_func`、`topk_method=noaux_tc`、`norm_topk_prob`、`routed_scaling_factor` |
| KDA | 64 个头，每头 128 维；短卷积核长 4；遗忘门的下界 −5 | `linear_attn_config` |
| 稀疏 MLA | 64 个头；Q 先压到 1536 维；K 和 V 共用一条 512 维潜向量；每头 Q/K 和 V 都是 256 维；RoPE 维数为 0 | `num_attention_heads`、`q_lora_rank`、`kv_lora_rank`、`qk_nope_head_dim`、`v_head_dim`、`qk_rope_head_dim` |
| 索引器 | 32 个头，每头 128 维；每 4 个位置压成 1 个池；每个查询最多读 2048 个历史位置，另加最多 3 个没凑满一池的最新位置 | `index_n_heads`、`index_head_dim`、`index_kpool=4`、`index_topk=2048` |
| MTP | 1 层，编号 45 | `num_nextn_predict_layers` |
| 位置上限 | 1048576 | `max_position_embeddings` |
| 原版权重精度 | FP8（8 位浮点，e4m3），每 128 × 128 一块共用一个缩放系数；embedding、`lm_head`、归一化、KDA 的投影、索引器等存成 BF16（16 位浮点）。加载后 router、mHC 的混合矩阵、KDA 短卷积等是 FP32，见「权重精度」一节 | `quantization_config`、`moe_router_dtype=float32` |

几个容易看错的地方：

- `num_key_value_heads` 也写着 64，但稀疏 MLA 层存进缓存的是每个 token 一条 512 维的共享潜向量，不是 64 个头各存一份 K 和 V。
- `num_hidden_layers=45` 不含 MTP 层；MTP 层另由 `num_nextn_predict_layers=1` 给出，编号接着排到 45。
- 位置上限 1048576 是模型配置允许的最长位置，实际服务开多长由部署决定，见[我们的部署](glm-5-3-flash-two-node.md)。

## 参数量：3133 亿里 97% 是路由专家

**参数量**是模型里可学习的数一共有多少个。把上表的形状逐项相乘，主干 45 层加上 embedding 和 `lm_head`，一共约 **3133 亿**个参数：

| 部件 | 参数量 | 怎么乘出来 |
|---|---|---|
| 路由专家 | 3044.1 亿 | 42 层 × 288 个 × 3 个矩阵 × 4096 × 2048 |
| KDA 层的 attention | 46.8 亿 | 34 层 × 每层约 1.38 亿 |
| 稀疏 MLA 层的 attention | 12.9 亿 | 11 层 × 每层约 1.17 亿 |
| 索引器 | 0.8 亿 | 11 层 × 每层约 747 万 |
| 共享专家 | 10.6 亿 | 42 层 × 3 × 4096 × 2048 |
| 稠密 MLP | 4.5 亿 | 3 层 × 3 × 4096 × 12288 |
| embedding 与 `lm_head` | 12.7 亿 | 2 张 × 154880 × 4096 |
| router、mHC、RMSNorm | 0.9 亿 | 其余小参数 |
| **主干合计** | **约 3133 亿** | 路由专家占 97.2% |

**每个 token 用到多少。** 路由专家每层只用 288 个里的 8 个：每层 8 × 3 × 4096 × 2048 ≈ 2.01 亿，42 层约 84.6 亿。加上路由专家以外的约 89.2 亿，一个 token 走完主干要经过约 **174 亿**个参数，这就是本页口径下的**激活参数**；embedding 只是按编号取一行、不做矩阵乘，扣掉它约 167 亿。所以不能拿总参数乘 8/288 估计每个 token 的计算量：路由专家以外的部分每个 token 都要全算。

读本页先记住**主干总参数约 3133 亿、每 token 激活约 174 亿**。模型卡的 320B 和 18B 是另一组口径；把 MTP 与视觉编码器也计入后，总参数约 3213 亿（约 321B）。各部分明细及 18B 的反推放在[对照源码](#对照源码)，反推不等于模型卡确认。

```wiki-diagram
file: glm-5-3-flash-fig-param-budget
```

参数量不等于占用字节：每个参数占几个字节取决于存成什么精度，见下一节。

## 权重精度：文件里怎么存，加载后变成什么

同一份模型可以用不同的数值格式存。**quantization**（量化）把权重或激活换成位数更少的格式，另配缩放系数把它们换回原来的数值范围，用来省显存、省带宽，并用低精度的矩阵乘提速。FP32 是 32 位浮点数，BF16 是 16 位浮点数；FP8 和 INT8 都只有 8 位。基础讲法见[量化](quantization.md)。

**先分清两件事。** HF 原版在主要矩阵上用 FP8 浮点数；[部署前提](glm-5-3-flash-two-node.md#部署前提)里的 W8A8 用 INT8 整数。两份模型的文字部分形状一致，变化的是存储和计算精度。逐部件的存法与缩放粒度见页末[开销和什么时候别开](#开销和什么时候别开)。

**显存要按加载后的类型算。** vLLM 按代码指定的类型创建参数，再把文件里的数转换进去。例如 router 与 mHC 的混合矩阵在 HF 文件里是 BF16，加载后是 FP32；indexer 还会另建 FP32 副本。每卡字节账见[我们的部署 · 每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。

想比较另一种“历史怎样少存、少算”的设计，可读 [DeepSeek-V4.1-Flash](deepseek-v4-1-flash.md)。沿着“谁生产状态、谁复用、生成时还要保留什么”比较两者；GLM 的 KDA、稀疏 MLA 与部署形状仍以本页为准。

## 接下来把模型放进推理引擎

模型执行一次前向，需要本轮的输入 token、位置和各层的历史状态。推理引擎负责把这些准备好：scheduler 决定本轮算哪些请求、每条算几个 token；KV cache 管理器分配并维护历史状态的存储；模型执行器组织计算；昇腾后端在 NPU（昇腾的计算设备）上执行具体算子。接着读：

- 16 张卡怎样分组、每张卡放了什么、为什么要两台机器、KV cache 能装多少：[我们的部署](glm-5-3-flash-two-node.md)。
- 一条请求怎样从提示词走到回答结束，每一站的形状、通信和字节：[一条请求](one-request.md)。
- 多条请求同一步怎样拼在一起、宽度怎样补齐：[多条请求](concurrent-requests.md)。
- 这些步骤各在哪个进程、经过哪些函数：[一条请求的代码路径](request-call-chain.md)。

## 对照源码

### 怎么开

模型形状由权重仓库的 `config.json.text_config` 决定，字段对应见「全模型形状总表」；加载方式与参数统一见[部署前提](glm-5-3-flash-two-node.md#部署前提)。

### 会报什么错

排查模型执行异常时，先按 traceback 区分 KDA、稀疏 MLA、MoE 与 MTP，再查下方「源码位置」的对应入口。跨进程报错与超时的识别方法见[调用链的定位步骤](request-call-chain.md#出问题时判断它停在哪一站)。

### 开销和什么时候别开

**HF 原版：FP8 分块量化。** `zai-org/GLM-5.3-Flash` 仓库里，MLP 通路（稠密 MLP、路由专家、共享专家）和 MLA 的四个大投影（Q 的压缩与展开、KV 的压缩、输出投影）存成 FP8：格式是 e4m3，即 4 位指数、3 位尾数的浮点数；每 128 × 128 的一块权重共用一个缩放系数；激活在运行时动态量化。其余部分存成 BF16，少数小参数存成 FP32，见下面第二张表。

**W8A8。** 部署权重来自 `Eco-Tech/GLM-5.3-Flash-w8a8`，以 `--quantization ascend` 加载。权重（W）和激活（A）都用 8 位整数：权重离线存成 INT8，每个输出通道配缩放系数；激活在矩阵乘前转成 INT8；整数矩阵乘的结果再按缩放系数换回。

| | HF 原版 FP8 | 部署用 W8A8 |
|---|---|---|
| 8 位数的格式 | 浮点（e4m3）：刻度随数值变大而变疏，小数值附近更密 | 整数：刻度均匀 |
| 权重的缩放粒度 | 每 128 × 128 一块一个系数 | 每个输出通道一个系数（vllm-ascend 的 W8A8 实现） |
| 哪些部分是 8 位 | MLP 通路和 MLA 的四个大投影 | 取决于权重 revision：`9e55cbc8` 只量化 MLP 通路，MLA 四个大投影标为 `FLOAT`；`3121f187` 才把这四个投影改为 `W8A8_DYNAMIC`。实现合并 Q、KV 两个压缩投影，所以运行时数成三个 |

两个仓库的 `text_config` 完全一致，不能据此认为量化配方也相同。上述两个 W8A8 revision 的量化描述均明确保留 KDA、KV 解压投影、索引器、router 和视觉塔为 `FLOAT`；具体加载类型还由实现决定。文件类型与加载后类型的对应如下；[部署账](glm-5-3-flash-two-node.md#量化版本和视觉塔怎样补进这份账)分别列出权重版本和子账之外的项目。

| 部件 | HF 文件里 | 加载后 | 为什么 |
|---|---|---|---|
| MLP 通路 | FP8，每块配 FP32 缩放 | 两个 W8A8 revision 均为 INT8，每通道配缩放 | 量化描述与 W8A8 实现 |
| MLA 四个大投影 | FP8，每块配 FP32 缩放 | `9e55cbc8` 按模型类型加载为 BF16；`3121f187` 是 INT8，每通道配缩放 | 配置形状不变，量化描述发生变化 |
| embedding、`lm_head`、各处 RMSNorm、KDA 的 Q/K/V/输出投影与两个门、MLA 的 KV 解压投影、索引器的 Q 投影 | BF16 | BF16 | 按模型默认精度建参数 |
| 索引器的 K 投影与压池打分投影 | BF16 | BF16，前向第一次运行时另存一份 FP32 副本 | 索引器的 K 和池内得分整条链在 FP32 里算，压好的池 K 写进缓存时才转成 BF16 |
| router 的权重 | BF16 | **FP32** | `config.json` 写着 `moe_router_dtype=float32`；router 的打分也强制用 FP32 算 |
| router 的偏置 | FP32 | FP32 | 同上 |
| mHC 的两张混合矩阵（每层各 24 × 16384） | BF16 | **FP32** | 代码直接建成 FP32。原因待核：源码无注释；推断是让流间混合和 20 轮 Sinkhorn 在 FP32 里算 |
| mHC 的偏置与缩放 | FP32 | FP32 | 同上 |
| KDA 的短卷积（每层 3 × 8192 × 4） | BF16 | **FP32** | 上游 vLLM 的 KDA 层就这样建；昇腾的卷积算子要求输入、权重、缓存同一类型，计算前再转回 BF16 |
| KDA 的衰减参数 `A_log`、`dt_bias` | FP32 | FP32 | 文件和代码都是 FP32 |
| 索引器压池用的池内位置偏置（4 × 128） | BF16 | **FP32** | 索引器的 FP32 链 |

### 版本差异

**社区 `v0.30.0` 与 `main` 已将 GLM-5.3-Flash 重构为 `models/glm5next/` 模块化实现，但不改变本文固定模型配置和例外 B 镜像（`db701c1f`）的双机绑定算例。** 下表对照四版社区分支的模型代码、投影与缓存演进（`v0.23.0` 与 `v0.26.0rc` 维护分支对 `vllm_ascend/models/` 检索均无 GLM-5.3-Flash 模型文件）：

| 核验维度 | `v0.23.0`（`2c59ff10` / `0fc695fc`） | `v0.26.0rc`（`2ed6cbba` / `568afb3a`） | `v0.30.0`（`c09d3e20` / `ced6857a`，主基线） | `main`（`8d6180e2` / `ba15685a`） |
| --- | --- | --- | --- | --- |
| 模型目录与类结构 | 无（绑定算例在镜像 `db701c1f` 单文件 `models/glm5_next.py`） | 无 | 模块化拆至 `models/glm5next/`；KDA 由 `Glm5NextLinearAttention` 实现，要求 BF16 激活、`head_dim=128`、卷积宽度 2–4（投机时须为 4，最多 7 候选） | 延续 `models/glm5next/`，新增 `kda_input_projection_tp.py` 与 `recoverssm_*` |
| KDA / MLA 投影融合 | — | — | KDA 六路输入合并为 `in_proj_qkvbfg_a`（`kda.py#L171-L185`）；MLA 低秩输入改用 `DeepSeekV2FusedQkvAProjLinear` 且 `kv_b_proj` 显式设 `quant_config=None`（`attention.py#L183-L220`）[C40] | `in_proj_qkvbfg_a` 扩展支持细粒度 `qkv_iproj_tensor_parallel_size`（`KDAInputProjectionTP`，`kda.py#L299-L325`）[C43] |
| 索引器缓存与 Runner 限制 | — | — | 完成 KPool 缓存用 BF16、未完成池尾状态改为 FP32 环形缓冲；官方教程要求 Model Runner V1（`VLLM_USE_V2_MODEL_RUNNER=0`），支持实验性 SFA-only DSA-CP（仅 TP 组内分摊查询，PCP/DCP 仍为 1）[S42] | 官方教程全面切换至 **Model Runner V2**（`VLLM_USE_V2_MODEL_RUNNER=1`），A3 PD Prefill 支持 `PCP8/TP1` 与 BF16 SSM 状态 [S45] |
| 显存与算例口径边界 | 不适用 | 不适用 | 缓存组与规格已重构，显存预算须按 `v0.30.0` 实际 `KVCacheSpec` 与 profile 重算，不直接沿用旧镜像 3,855 块算例 | 同 `v0.30.0`，须按 MRV2 与新规格另行核定 |

- 模型形状按 `zai-org/GLM-5.3-Flash` 在 revision `690b705278a3a58e538fcb37c2ca8b5f9511213c` 的 `config.json` [S1]，`moe_router_dtype=float32` 也在这份配置里。[来源基线](../sources/glm-5-3-flash-baseline.md)固定的是后来的 revision `eb9eb208`，并把两个 revision 的配置和 glm-flow 母版的副本比对过，三者一致，所以两处引用可以互换。
- 模型卡标称总参数 320B、激活参数 18B [S2]。本页的 3133 亿、174 亿、3213 亿按配置里的形状逐项相乘得出 [D]；HF 固定快照的参数总数是 321323031390，约 3213 亿，不包含量化缩放数组（来源 38）。18B 对应「主干 173.77 亿 + MTP 3.86 亿 = 177.63 亿」是按数字反推的口径 [I]；换成主干加视觉编码器（173.77 + 5.64 = 179.41 亿）也约等于 18B。模型卡用的是哪种，待核：缺模型卡的口径说明。
- 量化仓库 `Eco-Tech/GLM-5.3-Flash-w8a8` 在 `9e55cbc8` 的 `text_config` 与原模型一致 [S3]。逐层精度以固定量化描述为准：来源 36 是 `9e55cbc8`，来源 37 是 `3121f187`，两版 12 个稀疏层（含 MTP）的 Q 压缩、KV 压缩、Q 展开和输出投影由 `FLOAT` 改为 `W8A8_DYNAMIC`。`FLOAT` 表示不走该量化方法，不等于一律 FP32；具体类型见构造代码和上表。
- 执行侧按 `vllm-ascend@db701c1f` 读，控制流按 `vllm@0fc695fc` 读，后者就是 v0.23.0。KDA 层在模型里构造的是上游 vLLM 的 `KimiGatedDeltaNetAttention`，vLLM 为 0.23.0 时被替换成 vllm-ascend 的 `AscendKimiGatedDeltaNetAttention` [C10]，所以本基线执行的是昇腾版。同一个 `glm5_next.py` 里还有一个 `AscendGlm5NextLinearAttention` 类，它不在这条执行路径上，核对 KDA 时读 `kimi_kda.py`。
- mHC 的 Sinkhorn 迭代、入口权重（sigmoid）、写回权重（2 × sigmoid，Python 侧只看得到系数 2.0）和入口那次不带增益的 RMSNorm，都在融合算子 `npu_hc_pre_v2` 里完成，Python 侧只看得到迭代轮数 20 等参数被传进去。本页按这些运算的定义讲 [I]；待核：该算子的 AscendC 源码。
- 「每个通道至少保留 $e^{-5} \approx 0.7\%$」由遗忘门公式 $-5 \cdot \sigma(\cdot)$ 的取值范围 $(-5, 0)$ 推出 [D]。
- DeepSeek-V3.2 技术报告第 2.1 节的 DSA 按 $I = \sum_j w_j \cdot \text{ReLU}(q_j \cdot k)$ 给每个历史 token 打分，按 token 选前 2048 个 [S22]。本基线的 GLM 则走 `ops/glm5_next_lightning_indexer.py`：NPU 上满足输入条件时进入 triton 路径，否则走同一文件的 PyTorch 回退；两条路径都直接合成头加权查询再点乘池 K。补尾固定执行，配置的 `index_kpool_always_select_tail=true` 与这一行为一致；运行时由算子直接决定补尾。
- DeepSeek 原版 MLA 另留一段带 RoPE 的 K，原因见 DeepSeek-V2 技术报告第 2.1.3 节「Decoupled Rotary Position Embedding」[S23]。

**参数量的口径反推。** MTP 层约 74.3 亿，其中 72.5 亿是自己的 288 个路由专家；视觉编码器约 5.6 亿。主干、MTP 与视觉合计约 3213 亿，对应模型卡标称的总参数 320B。

18B 的一种反推按文字 token 计算：主干含 embedding 和 `lm_head`，路由专家只计每层选中的 8 个，再加 MTP 激活部分；视觉编码器只处理图像和视频，文字 token 不经过它。这一解释仍缺模型卡的口径确认，另一种凑近 18B 的口径见上文（各项先取两位小数再相加，最后一步才取整）：

| 每个 token 激活参数反推分项 | 算式 | 结果 |
| --- | --- | --- |
| 主干激活参数 | $89.21\text{ 亿（路由专家以外）} + 84.56\text{ 亿（42 层} \times 8\text{ 个专家）}$ | **173.77 亿** |
| MTP 激活参数 | $74.33\text{ 亿} - 72.48\text{ 亿（全部路由专家）} + 2.01\text{ 亿（其中 8 个）}$ | **3.86 亿** |
| **合计** | $173.77\text{ 亿} + 3.86\text{ 亿}$ | **$177.63\text{ 亿} \approx \mathbf{18\text{B}}$** |

对外引用时注明范围：3133 亿 / 174 亿为主干，320B / 18B 为模型卡标称；后者的激活范围尚未确认。

待核：取 4 条 residual 流、20 轮 Sinkhorn、3 层 KDA 配 1 层稀疏 MLA，以及前 3 层使用稠密 MLP 的具体权衡，缺 GLM 官方技术报告；router 选专家的偏置在训练中如何调整，缺官方训练说明。关于社区活跃食谱与绑定镜像的增量对照，另见[部署页增量对照节](glm-5-3-flash-two-node.md#活跃食谱增量对照v0300-与-main-变了什么)。

### 源码位置

模型形状取自 Hugging Face（存放开源模型权重的平台）上 `zai-org/GLM-5.3-Flash` 在 revision（仓库提交）`690b7052` 的 `config.json.text_config`。GLM 的 11 个稀疏层名为 `deepseek_sparse_attention`，按池选择配置为 `index_kpool=4`、`index_kpool_compress=true`。

indexer 的池分数是 $\sum_j w_j \times (q_j \cdot \text{池 } K)$；实现先合成 $\bar{q} = \sum_j w_j q_j$，再点乘池 K。原版 DSA 在各头点积后先做 ReLU（负值置零），本基线直接加权。压池、选位置分属两个算子；选池、展开和补尾由后一个算子一起完成，调用位置见下表。

MTP 的量化描述启用旋转时，隐藏输入在 `hnorm` 前经过 `rot`。这里两个 W8A8 revision 都设置了 `is_rot_used=true`，因此该步骤实际纳入它们的代码路径；旋转矩阵的容量在部署账中单列。预测层后的 `SharedHead.forward` 只做 RMSNorm，词表投影由 `compute_logits` 另行调用（来源 24、39）。

| 想核对的结构 | 读哪里 |
|---|---|
| 每层的 attention 与 MLP 怎样按层号选，mHC 的两次混合与参数建成 FP32，第 44 层四条流求平均，MTP 层走单条 residual 流 | `vllm_ascend/models/glm5_next.py` 的 `AscendGlm5NextDecoderLayer`（来源 4）[C4] |
| embedding、逐层循环、最终 RMSNorm；`lm_head`、KDA 状态的形状接口、logits | `AscendGlm5NextModel`、`AscendGlm5NextForCausalLM`（来源 5–6） |
| KDA 各投影、短卷积、前向、遗忘门下界 −5 | 上游 `kimi_gdn_linear_attn.py`、`vllm_ascend/ops/kimi_kda.py`、`ops/triton/kda/kda.py`（来源 7–9）[C7] |
| MLA 的压缩投影、RoPE 维为 0 时不建位置编码、索引器 Q/K/头权重与两份缓存 | `AscendGlm5NextMLAAttention`、`AscendGlm5NextIndexer`（来源 11–12）[C11] |
| 写状态、逐通道压池并写入池 K；头加权查询、选池、展开与补尾 | `ops/glm5_next_kpool_state_compress.py`、`ops/triton/glm5_next_lightning_indexer.py`、`ops/glm5_next_lightning_indexer.py`、`AscendSparseAttnIndexerKpool.forward_ascend`（来源 13–14、26–27）[C13] |
| 稠密 MLP、共享专家与 MoE 的构造，router 建成 FP32，sigmoid 打分与 2.5 缩放 | `AscendGlm5NextMLP`、`AscendGlm5NextMoE`、上游 `grouped_topk`、`ops/fused_moe/experts_selector.py`（来源 15–17）[C15] |
| MTP 层的两路输入与单层结构、embedding 共享条件与 `lm_head` 复用 | `vllm_ascend/models/glm5_next_mtp.py`、`spec_decode/llm_base_proposer.py`（来源 18–19）[C18] |
| 部署时逐层量化判断与 W8A8 动态量化 | `quantization/modelslim_config.py`、`quantization/methods/w8a8_dynamic.py`（来源 20–21）[C20] |
| `v0.30.0` / `main` 的 `models/glm5next/` 投影融合与细粒度 TP | `c09d3e20`：`glm5next/kda.py#L171-L185`、`attention.py#L183-L220`；`8d6180e2`：`glm5next/kda.py#L299-L325`、`kda_input_projection_tp.py#L18-L45`（来源 40–41、43–44） |

补充核对：上表来源 27 中，可见完整池数的计算在固定执行侧 `ops/glm5_next_lightning_indexer.py` 244–250 行；此处描述该文件所示路径，不把它推广到全部后端。上表来源 26 中，草拟步骤中实际查询行数与固定缓冲形状的区分在 `models/glm5_next.py` 1191–1199 行：非 FULL 路径取 `min(attn_metadata.num_actual_tokens, positions.shape[0])`，FULL 路径保留捕获形状。
