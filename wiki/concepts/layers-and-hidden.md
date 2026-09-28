---
id: layers-and-hidden
title: "层与隐藏表示：GLM 的 45 层如何连接"
type: concept
summary: hidden 是模型为每个输入位置维护、逐层改写的向量。GLM-5.3-Flash 的 45 层之间用 mHC 传四条残差流：每个子层把四条加权合成一条去算，再把输出写回，旧流经 Sinkhorn 约束的 4×4 矩阵混合；每层两次，一次前向 90 次、1,800 轮 Sinkhorn，末层求平均回到一条。
aliases: [层, layer, Transformer 层, Decoder 层, 隐藏向量, 隐藏态, hidden state, hidden, 隐藏维度, 残差流, 四条残差流, 多路残差, mHC, Manifold-Constrained Hyper-Connections, Hyper-Connections, Sinkhorn, 双随机矩阵]
chapters: ["03"]
order: 50
sources:
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - https://arxiv.org/abs/2512.24880
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2064-L2127
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2128-L2145
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2147-L2169
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2189-L2241
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L148-L153
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2293-L2319
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2454-L2470
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2515-L2517
  - vllm-ascend@db701c1f:vllm_ascend/ops/mhc.py#L5-L37
  - vllm-ascend@db701c1f:vllm_ascend/transformers_utils/configs/glm5_next.py#L107-L118
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L109-L121
  - vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L23-L37
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L419-L459
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L461-L514
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/ops/mhc_ops.py#L13-L20
  - vllm-ascend@db701c1f:glm-5-next-adapt-0826/glm-5-next-transformers.patch#L1965-L2000
  - vllm-ascend@db701c1f:glm-5-next-adapt-0826/glm-5-next-transformers.patch#L2990-L3026
  - vllm-ascend@2c59ff10:vllm_ascend/ops/mhc.py#L5-L37
  - vllm-ascend@2ed6cbba:csrc/torch_binding.cpp#L3046-L3070
  - vllm-ascend@baa023ad:csrc/torch_binding.cpp#L3509-L3525
verified: []
evidence: "C"
relations:
  - to: embedding
    kind: builds-on
    note: embedding 查出的 [T, 4096] 是 hidden 的起点；本页从这里往后讲它怎样穿过 45 层
  - to: glm-5-3-flash
    kind: builds-on
    note: 模型总览给出 45 层的层表和各种子层；本页展开层与层之间的四条残差流
  - to: one-request
    kind: builds-on
    note: 本页的计算发生在主线第 4 站逐层前向；R1 每一站的形状、字节数和通信次数在主线页
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 一层接过什么、交出什么？GLM 为什么在层间传四条？

**hidden（隐藏向量）是模型给每个输入位置维护的一条数值向量：每一层读它、算出改动、改写后交给下一层。GLM-5.3-Flash 在层与层之间同时传四条这样的向量，叫四条残差流；每个子层先从四条里合出一条去计算，再把结果写回四条。**

[Embedding](embedding.md) 把每个 token 编号换成一行数字，这就是 hidden 的起点。本轮要处理 T 个位置，就有 T 条 hidden，摞起来写成 [T, hidden size]，hidden size 是每条向量有多少个数。模型由许多结构相同的层（layer，也叫 Decoder 层）叠成，每层有两段子层：attention 段让当前位置读取前文，MLP 段对每个位置单独做一次非线性变换。层与层交界处 hidden 的宽度不变，所以任何一层的输出都能直接交给下一层；层内部的投影可以换宽度，出来时再回到 hidden size。

子层并不直接替换 hidden，而是算出「要改多少」再加回去：输入沿一条不做变换的旁路送到出口，和子层输出相加。这条旁路叫 residual（残差连接），它从第一层一直通到最后一层，所以也叫 residual 流（残差流）；单条残差的写法和作用见[前馈、残差与 RMSNorm](mlp-residual-norm.md#残差连接保留一条输入路径)。**mHC**（Manifold-Constrained Hyper-Connections）把这一条旁路扩成 n 条并行的流，并规定流之间怎样混合、子层结果怎样写回。GLM 取 n = 4：

```wiki-diagram
file: layers-and-hidden-intuition.yaml
```

图里是一段子层（attention 段或 MLP 段）的一次进出。一层有两段，所以一层做两次：

1. **分出一路。** 入口先根据四条流当前的值算出一组系数，其中 4 个入口权重把四条流加权合成一条。这一条的形状和普通模型的 hidden 一样。
2. **计算。** 这一条先做 RMSNorm（把向量缩放到稳定的数值范围），再送进 attention 或 MLP，输出仍是一条。
3. **写回。** 子层输出按 4 个写回权重分别加到四条流上，每条流分到的份量不同。
4. **汇合。** 旁路上的旧四条流不是原样通过，而是先经过一个 4×4 混合矩阵互相混合，再和写回的输出按流相加，成为下一段的四条流。

图中两条虚线表示：入口一次算出的系数，一部分送到旁路上当混合矩阵，一部分送到写回那一步当写回权重。4×4 矩阵第 g 行第 h 列的数，表示旧流 g 有多少份量进入新流 h。入口算出的原始系数可以是任意数，Sinkhorn 迭代把它改造成每行、每列加起来都是 1 的矩阵，下一节讲为什么要这样约束。入口权重、写回权重和混合矩阵都是每个 token 按自己此刻的四条流单独算出来的，不是全模型共用的常数；学出来并固定下来的是「怎样从四条流算出这些系数」的那组参数。

## 为什么要四条流，Sinkhorn 又管什么，代价在哪？

**多条流让每个子层能学着选择从哪几条读、往哪几条写；但 45 层 × 2 段 = 90 次混合是串起来的，旁路上的信息要连着被乘 90 次，混合矩阵只要稍微放大或缩小，连乘后就会失控。Sinkhorn 把每次混合限制成「加权平均」，换来稳定；代价是每段多一次小矩阵乘和 20 轮迭代，残差占的字节变成四倍。**

**为什么不只留一条。** 单条残差里，每层只能往同一条向量上叠加改动，早先写进去的信息和后来的改动混在一起，谁也拿不出来。Hyper-Connections 把残差加宽成 n 条：子层可以按 token 学着决定从哪几条读、写到哪几条，旧流之间也能交换内容，层与层之间怎样连由训练决定，不再只有一条直通。mHC 论文把这种做法概括为加宽残差流、让连接方式多样化，并报告了明显的效果提升。

**不加约束会怎样。** 最初的 Hyper-Connections 对 n×n 混合矩阵不加限制。第 0 层入口的内容要走到最后一层，途中经过的是全部 90 个混合矩阵的连乘：每个矩阵哪怕只把数放大一点点，连乘后也会爆炸；缩小一点点，连乘后就趋于 0。单条残差原本有一个好性质，输入能原样直达出口（恒等映射），加宽后这个性质丢了。mHC 论文指出，这正是它在大规模训练里不稳定、难以放大的原因。

**Sinkhorn 把混合矩阵变成双随机矩阵。** 双随机矩阵的每个数都不小于 0，每行、每列加起来都是 1。用它混合旧流有三个直接后果：

- 每列和为 1：每条新流都是四条旧流的加权平均，每一维的数都落在四条旧流这一维的最小值和最大值之间。
- 每行和为 1：每条旧流的内容恰好分完，四条流加起来的总量混合前后不变。
- 两个双随机矩阵相乘仍是双随机矩阵：连乘 90 次以后，旁路仍是一次加权平均，不会爆炸也不会消失。什么都不混的单位矩阵本身也是双随机矩阵，所以「原样直通」是它的一个特例。

**Sinkhorn 迭代怎样做到。** 入口算出的 16 个原始系数排成 4×4，先按行做 softmax，得到全是正数、每行和为 1 的矩阵；接着交替做两件事：每一列除以这一列的和，每一行除以这一行的和。每做一次，一个方向的和变成 1，另一个方向被轻微打乱；来回几轮后两个方向都接近 1。GLM 配置的是 20 轮，和 mHC 论文实验所用的轮数相同。轮数有限，所以结果是近似的：参考实现每轮最后一步是按列归一，列和（每条新流的权重）精确为 1，行和接近 1。

**入口和写回权重也有范围。** 入口权重经过 sigmoid，落在 0 到 1 之间；写回权重是 2 × sigmoid，落在 0 到 2 之间。两者都不为负，四条流就不会在合成或写回时互相抵消。注意 Sinkhorn 只约束旧流之间的混合，子层输出照样加上去，这和单条残差里「子层输出加回输入」是同一个意思。

| 连接方式 | 层间传几条 | 旧流怎样混合 | 子层输出怎样加回 |
|---|---|---|---|
| 单条残差 | 1 条 | 不混合，原样直通 | 直接相加 |
| Hyper-Connections | n 条 | n×n 矩阵，数值不受约束 | 按学到的权重写回 n 条 |
| mHC（GLM 用的） | n 条，GLM 取 4 | Sinkhorn 约束成每行、每列和为 1 | 写回权重限制在 0 到 2 |

**为什么是 4 条。** 条数 n 同时决定收益和代价：残差要存 n 份，入口每次要算 (2 + n) × n 个系数，混合矩阵是 n × n。GLM 的配置写的是 4 条，mHC 论文的实验也取 n = 4；n = 4 时每段入口算 24 个系数（4 个入口权重、4 个写回权重、16 个混合系数）。GLM 自己为什么选 4，官方没有公开说明。

**代价落在哪里。** 每段入口要把四条流拼成一条 4 × 4096 = 16384 维的长向量，做一次不带可学习增益的 RMSNorm（只用来算系数，不改四条流本身），再乘一个 16384 × 24 的小矩阵得到 24 个系数，然后跑 20 轮 Sinkhorn；出口再做一次写回加混合。这些都在卡内完成，不产生任何集合通信；混合参数也不按 TP 切，同一个 TP 组的 8 张卡各存一份、各算一遍，结果相同。

```calc
title: mHC 在一次前向里多做的事
入口混合次数 = 45 层 × 2 段 = 90 次
Sinkhorn 总轮数 = 90 次 × 20 轮 = 1,800 轮
每层混合参数 = 2 套 × 24 × 16384 × 4 B = 3,145,728 B = 3.0 MiB
45 层混合参数 = 45 × 3.0 MiB = 135 MiB
每 token 的四条残差 = 4 × 4096 × 2 B = 32,768 B
> 混合参数是 FP32（每个数 4 B），每卡一份；残差按每个数 2 B 计，单条残差是 8,192 B；出口的写回混合同样是 90 次
```

## 放到 GLM 双机：hidden 怎样穿过 45 层？

**GLM-5.3-Flash 的文本主干有 45 层，编号 0–44；hidden 宽 4096。一次前向里，hidden 从 embedding 出来是一条，进第 0 层时变成四条，45 层里每层做两次 mHC，第 44 层结束时求平均回到一条，再去算词表分数。**

固定部署是两台 Atlas 800 A2、TP8/DP2/EP16、W8A8，前提统一见[部署前提](glm-5-3-flash-two-node.md#部署前提)。一条请求的前向在一个 DP 组的 8 张卡上跑，8 张卡按 TP8 分摊每层的矩阵。下面沿主线的示例请求 R1 走一遍：R1 是提示词为 4 个 token 的那条请求，设定见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)，这一步 T = 4。

### 45 层怎样排

每层都是「attention 段 + MLP 段」，但两段各用哪种子层由层号决定。这里出现三种子层：**KDA** 是一种线性 attention，用一个固定大小的矩阵状态汇总全部历史；**稀疏 MLA** 先把历史压成低维的潜向量，再只挑一部分历史去读；**MoE** 是一组专家 MLP，每个 token 只选其中几个来算。三者的原理分别见模型总览的 [KDA](glm-5-3-flash.md#kda把全部历史压进一个固定大小的矩阵)、[稀疏 MLA](glm-5-3-flash.md#稀疏-mla先把历史压短再挑着读) 和 [MoE](glm-5-3-flash.md#moe288-个专家里每次挑-8-个) 三节，排法的由来见[45 层怎样排](glm-5-3-flash.md#45-层怎样排)。

| 层号 | attention 段 | MLP 段 | 层数 |
|---|---|---|---|
| 0、1、2 | KDA | 稠密 MLP | 3 |
| 3、7、11、15、19、23、27、31、35、39、43 | 稀疏 MLA | MoE | 11 |
| 其余（4–6、8–10、…、40–42、44） | KDA | MoE | 31 |

按 attention 数：34 层 KDA、11 层稀疏 MLA，「KDA、KDA、KDA、稀疏 MLA」四层一组重复 11 次共 44 层，最后的第 44 层是 KDA。按 MLP 数：前 3 层稠密，后面 42 层全是 MoE。实现按层号分别建出每一层的模块，每层有自己的一份权重；同一层的权重被这一步里所有位置、所有请求共用，45 层之间并不是反复调用同一份权重。

稠密 MLP 和每个专家内部是同一种前馈结构，只是宽度不同，见[前馈网络](mlp-residual-norm.md#前馈网络怎样变换一个位置的特征)。不管子层是哪一种，层与层之间的连接都一样：每段前后各一次 mHC。所以 mHC 的次数只看层数，一次前向固定是 45 × 2 = 90 次，与层型无关。一层两段首尾相接的样子见[模型总览的单层图](glm-5-3-flash.md#一层有两段计算四条-residual-流贯穿两段)。

### R1 的 hidden 一路走下来

下图是这一站的先后与分支，文字按图从上往下讲。

```wiki-diagram
file: layers-stack.yaml
```

1. **embedding。** 4 个编号查表得到 [4, 4096]。TP8 下每张卡只存词表的八分之一，各查一段再做一次 All-Reduce（组内各卡按位置相加并都拿到结果，见[集合通信](collective-communication.md#all-reduce)），8 张卡都得到完整的 [4, 4096]。查表细节见[Embedding 的 GLM 双机一节](embedding.md#放到-glm-双机8-张卡怎么查同一张表)。
2. **第 0 层入口复制成四条。** [4, 4096] 复制四份成 [4, 4, 4096]：4 个位置、4 条流、每条 4096。实现把后两维摊平，存成 [4, 16384]；两种写法是同一份数据，[T, 4, 4096] 是讲道理用的逻辑形状，不规定内存布局。刚复制时四条完全相同，差别是之后的混合和写回一点点造出来的。R1 这份四条残差占多少字节见[主线页的词嵌入一节](one-request.md#词嵌入与四路残差)。
3. **每层的 attention 段。** 入口混合把 [4, 16384] 合成 [4, 4096]，经 RMSNorm 送进 KDA 或稀疏 MLA。attention 的输出投影在 TP8 下按行切，末尾一次 All-Reduce 让 8 张卡都拿到完整的 [4, 4096]（切法见[TP 页](tensor-parallel.md#先过-attention各算自己的头再合回-hidden)）；拿齐以后才写回四条流，得到新的 [4, 16384]。
4. **每层的 MLP 段。** 同样先入口混合、再 RMSNorm，送进稠密 MLP 或 MoE；MoE 把 token 派到专家所在的卡、算完收回来，这些通信都在子层内部完成，写回时手里已是完整的 [4, 4096]。
5. **第 44 层结束时求平均。** 第 44 层 MLP 段写回之后，四条流沿「流」这一维直接求平均，回到 [4, 4096]。这是不带权重的平均，不是再学一次混合。
6. **最终 RMSNorm 和输出投影。** 平均后的 hidden 先做最终 RMSNorm，再乘输出投影（lm_head，一张「词表 × 4096」的权重）得到每个词的分数，交给第 5 站采样。不是每个位置都要算分数：R1 的 prefill 只取最后一个位置，前 3 个位置这一步的作用是把历史写进各层的状态，见[主线页的最终归一化一节](one-request.md#最终归一化与词表投影)。

这一路上有两种 RMSNorm，别混：mHC 入口那一次作用在拼起来的 16384 维长向量上，没有可学习的增益，只用来算混合系数，四条流本身不被它改动；子层前的 RMSNorm 作用在合成出来的 4096 维向量上，带每层自己学到的增益，结果才是子层的输入。代码里 mHC 入口在前，子层的 RMSNorm 在后。

四条流在 TP 组的 8 张卡上各有一份完整的，mHC 在每张卡上重复算一遍，结果相同，所以不需要通信。整次前向的集合通信次数和载荷见[主线页的通信账](one-request.md#一次前向的通信账)，里面没有一次属于 mHC。

### 本轮 hidden、历史状态和权重各管什么

hidden（包括四条流）只在这一次前向里逐层传递，算完就不保留。下一轮要用的前文信息存在另外的地方：

| 数据 | 放在哪 | 活多久 |
|---|---|---|
| 本轮 hidden 与四条流 | 前向过程中的临时张量 | 这一次前向 |
| 各层的 attention 历史 | KV cache：KDA 层存递推矩阵状态和短卷积状态，稀疏 MLA 层存潜向量、indexer 的池 K 和尾状态 | 跟着请求，一轮轮接着读写 |
| 模型权重 | 常驻显存 | 服务整个生命周期，所有请求共用 |

KDA 和稀疏 MLA 留下的历史形式不同，不能把 hidden 和一种统一的 K/V 缓存混为一谈；两类历史各存什么见[KV cache 页](kv-cache.md#混合模型到底要保留哪几类状态)。prefill 和 decode 都完整走过 45 层，变的是本轮送进来的位置数和能读到的历史，不是层数。没有投机解码时，decode 每轮每条请求只送 1 个新位置（T = 1），但 attention 会读此前存下的历史，模型并不是只凭这一个位置做预测；固定部署开了 MTP 草拟，R1 的 decode 一步验证 1 + 3 = 4 个位置，所以也是 T = 4，见[主线页的第二圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)。多条请求同时在跑时，引擎把它们这一轮的位置拼成一批，T 是这一批的总位置数，见[并发请求](concurrent-requests.md)。

末层交出的是连续的向量，不是 token。模型层负责更新表示，输出投影负责给每个候选词打分，采样负责选出 token；这一轮之后什么时候开始下一轮由引擎决定，各组件的分工见[框架架构](vllm-v1-shape.md)。

## 哪几层的连接和别的层不一样？

**45 层里只有首尾两层多一步：第 0 层入口复制成四条，第 44 层出口求平均。主干之外的 MTP 层完全不走 mHC。其余层不管子层是什么，连接方式都相同。**

- **第 0 层。** 入口先把 embedding 交来的一条复制成四条，再做这一层的第一次入口混合。其他层接到的已经是四条。
- **第 44 层。** MLP 段写回之后多一步，四条流求平均回到一条，交给最终 RMSNorm。求平均不带可学习的权重；参考实现的注释特意写明，这一点和 DeepSeek-V4 用可学习权重汇合不同。
- **MTP 层（第 45 层）。** 它是模型附带的一层，用来给投机解码草拟候选，不属于 45 层主干。它只有一条普通残差：RMSNorm、子层、加回输入，没有 mHC 的混合参数。MTP 层的结构见[模型总览的 MTP 一节](glm-5-3-flash.md#mtp主干之外的第-45-层)。
- **KDA 层和稀疏 MLA 层、稠密层和 MoE 层。** mHC 只包在子层外面，看到的永远是进出子层的一条 4096 维向量。子层内部怎样切到 8 张卡、要不要跨卡通信，由子层自己决定，写回时手里已经是完整结果。

## 常见误解

- **「GLM 的 hidden 宽 16384。」** 子层的输入和输出都是 4096 维。16384 是四条流拼起来的宽度，只在子层之间的旁路上存在；embedding 的输出和末层求平均后的结果也都是 4096 维。
- **「四条流是四份模型，或者四个 attention 头。」** 四条流共用同一套子层和权重，每段只把合成出来的一条送进子层。它们的区别只来自入口权重、写回权重和混合矩阵，而这些系数是每个 token 单独算的。
- **「Sinkhorn 归一化的是 hidden。」** 它归一化的是 4×4 混合矩阵，hidden 的数值不受这个约束；子层输出照样按写回权重加上去。
- **「四条流从一开始就各不相同。」** 进第 0 层时四条是同一份的复制，差别由之后每段的混合与写回逐步产生。
- **「最后一层挑一条流当输出。」** 第 44 层结束时是四条求平均，不是取其中一条，也没有再学一组汇合权重。
- **「mHC 要按 TP 切，或者要跨卡通信。」** 混合参数每卡一份不切，四条流在 TP 组 8 张卡上各有一份完整的，各卡重复计算同样的结果，mHC 本身不产生集合通信。
- **「hidden 就是 KV cache。」** hidden 只活在一次前向里；跨轮保留的是各层 attention 的历史状态，KDA 和稀疏 MLA 的历史形式还不一样。
- **「decode 只送 1 个位置，模型只凭这个位置预测。」** 这个位置在每层的 attention 里会读取此前存下的历史；而且固定部署开了 MTP，R1 的 decode 一步送的是 1 + 3 = 4 个位置。
- **「45 层是同一层重复 45 次。」** 层的骨架相同，但每层有自己的权重，attention 和 MLP 的类型也按层号不同。

## 对照源码

### 怎么开

mHC 不是运行参数，由模型配置决定：GLM 的配置写着 `mhc=true`、`hc_mult=4`、`hc_sinkhorn_iters=20`，层数 45、hidden 4096，层型由 `kda_layers` 和 `mlp_layer_types` 两张表给出。[S1] vllm-ascend 的配置类把 checkpoint 里的 `hc_mult`、`hc_sinkhorn_iters` 读进自己的 `mhc_num_residual_streams`、`mhc_sinkhorn_iterations`，两个名字同时保留。[C12]

Decoder 层构造时，只有 `self.mhc` 为真且不是 MTP 层，才建 `hc_attn_*`、`hc_ffn_*` 两套参数：每套一个 24 × 16384 的 FP32 矩阵、24 个偏置和 3 个缩放。[C4] checkpoint 里这些参数叫 `attn_hc.fn`、`ffn_hc.fn` 等，加载时按名字映射过去。[C13] 前向里 `self.mhc` 为假或是 MTP 层就走单条残差分支，否则走四条流分支。[C6]

### 会报什么错

- mHC 这段路径在 `glm5_next.py` 里没有自己的 `raise` 或 `assert`。它直接调用 vllm-ascend C++ 扩展里的两个融合算子 `npu_hc_pre_v2`、`npu_hc_post`；[C5] 扩展没有编进安装包时，第一次前向会在查找这两个算子时失败，具体报错文本本基线没有实测。
- 配置字段名对不上不会报错，只会悄悄用默认值。配置类的注释记下过一次真实的教训：专家数字段没映射上，默认值 7 被当成了训练时的 8。mHC 两个字段的默认值恰好就是 4 和 20，所以即使映射失效，本模型也不会算错，但换一个取值不同的模型就会静默出错。

### 开销和什么时候别开

- 不能关。mHC 是模型结构的一部分，权重按四条流训练；把 `mhc` 改成假，代码会走单条残差分支，但算出来的已不是这个模型。
- 开销的推导在上文「代价落在哪里」：一次前向 90 次入口混合、1,800 轮 Sinkhorn、90 次写回，混合参数每卡 135 MiB，四条残差每 token 32,768 B。这些量只随层数和本步 token 数变化，与 TP、EP 的切法无关，因为 mHC 在 TP 组内每卡重复计算。[D] 与每卡约 20 GiB 的主干权重相比，135 MiB 很小，每卡权重账见[部署页](glm-5-3-flash-two-node.md#每张卡上放了什么)。
- 论文报告 n = 4 时训练时间只多约 6.7%，那是训练侧加上算子融合、重计算等优化后的数；[S2] 推理时 mHC 在昇腾上的耗时本基线没有实测。

### 版本差异

GLM 双机的数字固定在执行侧 `db701c1f`。下表的 main 指仓库约定的固定提交。

| 核对项 | v0.23：2c59ff10 | v0.26：2ed6cbba | main：baa023ad | 对使用者意味着什么 |
| --- | --- | --- | --- | --- |
| GLM-5.3-Flash 模型代码 | 没有 | 没有 | 在 `models/glm5next/` | 两个发布分支跑不了本模型 |
| mHC 融合算子 | 已注册入口、写回两个算子，另有给 DeepSeek-V4 用的 Python 参考实现[C20] | 已注册同样两个算子[C21] | 仍注册这两个，去掉了旧版入口算子[C22] | 算子先于 GLM 模型进入仓库，接口三版一致 |
| 每段入口混合、Sinkhorn 轮数 | — | — | 仍是每段一次、20 轮[C15] | 90 次、1,800 轮不变 |
| 出口写回怎样调用 | — | — | 推迟到下一段入口，与入口混合合成一次调用；末层单独补最后一次写回再求平均[C16] | 数学不变，算子调用次数减少 |
| 子层前 RMSNorm、序列并行 | — | — | RMSNorm 挪进入口混合的同一个函数；可在按 token 切开的分片上做 mHC，attention 前后再收集、分发 | 打开序列并行时每卡只存一段 token 的四条流 |

main 的两处改动都没有改变每段「入口混合 → RMSNorm → 子层 → 写回混合」的数学，也没改末层的无权重平均，末层仍是直接求平均。[C17] 核对方法：对两个发布分支执行 `git ls-tree -r --name-only <提交>`，`vllm_ascend/models/` 下没有任何 glm 文件。

### 源码位置

阅读顺序：先看 `models/glm5_next.py` 的 `AscendGlm5NextDecoderLayer`：构造函数按层号选 attention 与 MLP，[C3] 并建 mHC 参数；`hc_pre`、`hc_post` 两个方法只是把张量交给融合算子；`forward` 里依次是第 0 层复制、attention 段、MLP 段、第 44 层求平均，复制用的是同文件开头的 `_expand_mhc_residual_streams`。[C7] 再看 `AscendGlm5NextModel.forward`：查表、逐层循环、最终 RMSNorm；[C8] 输出投影和 `compute_logits` 在同一文件末尾。[C9][C10] 残差按 TP 分片的辅助函数在 attention 输出与残差 token 数相同时原样返回，本部署没开序列并行，走的就是这条。[C14]

融合算子内部看不到 Python，入口权重的 sigmoid、写回权重的 2 × sigmoid、不带增益的 RMSNorm 和 Sinkhorn 迭代，本页按同一提交里的两份参考实现来讲：`ops/mhc.py` 的 `hc_split_sinkhorn_ref`，[C11] 以及适配补丁里 transformers 版的 `Glm5NextTextHyperConnection`；[C18] 写回公式「新流 h = 写回权重 h × 子层输出 + Σ 混合矩阵[g, h] × 旧流 g」取自补丁里的 Decoder 层。[C19] main 在入口混合函数的注释里也写明，融合算子对写回权重用的是 2 × sigmoid。

数值出处：45 层、4096、4 条、20 轮和层型表来自固定 revision 的模型配置；[S1] 90 次、1,800 轮、3.0 MiB、135 MiB、32,768 B 由形状与精度推导；[D] 双随机约束的作用、n = 4 与 20 轮的实验设定来自 mHC 论文，已联网核对摘要与正文。[S2]

待核：
- `npu_hc_pre_v2`、`npu_hc_post` 的 AscendC 实现与参考实现是否数值等价，只对过接口和参数顺序，没有跑过。
- 两份参考实现的 Sinkhorn 循环写法略有不同：`ops/mhc.py` 在 softmax 后做 20 轮「先行后列」；补丁版在 softmax 后先按列归一一次，再做 19 轮「先行后列」。softmax 已让每行和为 1，所以两者只差一次几乎不改变结果的按行归一，且都以按列归一结束。融合算子内部按哪一种写，要读 C++ 源码确认。
- GLM 为什么取 4 条流、20 轮，缺官方技术报告。
