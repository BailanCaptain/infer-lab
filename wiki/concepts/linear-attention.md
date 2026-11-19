---
id: linear-attention
title: KDA：用一个固定大小的状态代替逐位置历史
type: concept
summary: >-
  linear attention 去掉逐位置的 softmax，让历史先合成一个形状固定的状态矩阵；KDA 在此之上加按 key 通道的衰减和 delta
  规则的纠错写入。本页先讲机制，再落到 GLM-5.3-Flash 的 34 层 KDA：每卡状态多大、为什么固定占 12 个块号、prefill 与
  decode 两条执行路径差在哪。
aliases:
  - 线性注意力
  - Linear Attention
  - KDA
  - Kimi Delta Attention
  - Gated DeltaNet
  - DeltaNet
  - 递推状态
  - recurrent state
  - 矩阵状态
  - chunked 计算
chapters:
  - '04'
order: 35
sources:
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - 'https://arxiv.org/html/2510.26692v1'
  - 'https://arxiv.org/abs/2006.16236'
  - 'https://arxiv.org/abs/2102.11174'
  - 'https://arxiv.org/html/2406.06484v3'
  - 'https://arxiv.org/html/2412.06464v3'
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L102-L231
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2072-L2105'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L169-L242'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L291'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L294-L331'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L343-L388'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L390-L474'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L477-L494'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L528-L560'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L586-L659'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L32'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2489-L2509'
  - 'vllm@0fc695fc:vllm/model_executor/layers/mamba/mamba_utils.py#L119-L125'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L44-L56
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L191-L228
  - 'vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L627-L636'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3332-L3344'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/triton/kda/kda.py#L1287-L1331'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L725-L734'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/kimi_kda_state.py#L28-L49'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/kda.py#L103-L160'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/kda.py#L348-L395'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/ops/kda.py#L1-L60'
  - >-
    raw:sha256-f1eb696b50d5560664ed320075d8c1a7bbd054b35e5f158fbd2b78fc2047b335.md#L1-L1026
  - 'vllm-ascend@7d825229:vllm_ascend/models/glm5next/kda.py#L108-L187'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/kda.py#L107-L190'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/kda.py#L211-L310'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/kda_input_projection_tp.py#L18-L62'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/recoverssm_config.py#L13-L44'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: attention-qkv
    kind: builds-on
    note: 那页讲标准 attention 的 q/k/v 与逐位置 softmax，并列出 GLM 两类 attention；本页是其中 KDA 的详细页
  - to: glm-5-3-flash
    kind: builds-on
    note: 34 层 KDA、64 个头 128 维、短卷积核长 4 这些模型形状以那页为准
  - to: glm-5-3-flash-two-node
    kind: builds-on
    note: 逻辑块 640、一个块号 7.969 MiB、短请求 15 块的推导唯一出处在那页
  - to: speculative-decoding
    kind: builds-on
    note: 状态为什么要为 3 个草稿位置多留格子
  - to: mla
    kind: alternative-to
    note: 每 4 层里那 1 层用另一条路线，保留按位置访问的历史
contradicts: []
updated: '2026-11-19'
origin: gap
rawSources:
  - >-
    raw/sha256-6a6dff10afedce0b969fbfd878381c2a124f841ffc5b71a163eb02405f1ae2fc.md
  - >-
    raw/sha256-f1eb696b50d5560664ed320075d8c1a7bbd054b35e5f158fbd2b78fc2047b335.md
---

## KDA 是什么，历史怎样装进一个固定大小的状态？

**linear attention（线性注意力）去掉 attention 里逐位置的 softmax，让全部历史先合成一个形状固定的矩阵，这个矩阵叫状态（state）；每来一个 token（分词后的一个位置），先用它的 k、v 更新状态，再用它的 q 从状态里读出这一层的输出。KDA（Kimi Delta Attention）是 linear attention 的一种具体更新规则。**

q、k、v 是每个位置从隐藏向量（模型为这个位置保存的中间表示）投影出来的三个向量：q 是这个位置发出的查询，k 是它给别人当索引的键，v 是它提供的内容。标准 attention 用当前 q 和每个历史位置的 k 打分，再按分数汇合各位置的 v，细节见 [attention 与 Q/K/V](attention-qkv.md)。linear attention 保留 q、k、v，换掉的是「逐位置打分再汇合」这一步。

```wiki-diagram
file: linear-attention-intuition
```

图上半是标准做法：历史每个位置的 k、v 都要留着，当前位置和它们一个个打分，位置越多，要存的和要读的越多。下半是 linear attention：同一段历史先压进一个大小固定的状态，当前 token 分两步走，先用自己的 k、v 改写状态，再用自己的 q 从改写后的状态里读出结果，状态随后留给下一个位置接着用。图里的格子只表示状态有固定的行和列，不代表具体数值。

名字里的「线性」说的是成本：模型宽度固定时，处理一段序列的开销随位置数线性增长，而不是随位置数的平方增长。它不表示这一层里只有线性变换（门控和归一化都是非线性的），也不表示它和 softmax attention 算出来的结果相同。

## 为什么去掉 softmax 就能从平方降到线性？

标准 attention 的第 t 个位置要和它前面每个位置各算一个分数，一段 n 个位置的提示词因此有 n 的平方量级的分数要算；生成阶段每走一步，也要把已有的历史读一遍。这是 softmax 逼出来的：一排分数要先凑齐，才能归一化成加起来等于 1 的权重。

去掉 softmax 之后，输出就是历史各位置的 v 按「当前 q 与该位置 k 的内积」加权相加。内积和求和可以换顺序，于是同一个式子有两种算法：要么先算 q 和每个 k 的内积，代价随历史长度增长；要么先把每个位置的 k 与 v 的外积加起来（外积是把 k 的每一维乘 v 的每一维，排成一个矩阵），再让 q 去乘这个矩阵。后者把历史压成一个与长度无关的矩阵，这就是省下来的地方。Katharopoulos 等人 2020 年的线性 transformer 论文正是这样做的：用核特征映射把 self-attention 写成线性的点积形式，再借矩阵乘法的结合律，把复杂度从位置数的平方降到线性。

设 φ 是把 q、k 转成特征向量的映射，一种带归一化的因果 linear attention 可以写成：

```text
Sₜ = Sₜ₋₁ + φ(kₜ) vₜᵀ
zₜ = zₜ₋₁ + φ(kₜ)
oₜ = Sₜᵀ φ(qₜ) / (zₜᵀ φ(qₜ))
```

S 汇总键和值的外积，z 汇总归一化要用的键特征。当前查询直接读这两份状态，不再遍历历史位置。注意这里换掉的是相似度的形式：softmax 自带一层非线性归一化，所以不能把「softmax 打完分再乘 V」直接改写成「先算 K 与 V 的乘积再乘 Q」，能换顺序的是去掉 softmax 之后的式子。

代价也在同一处：

| | 逐位置 attention | 固定大小的状态 |
|---|---|---|
| 生成一步要读多少历史 | 全部可见位置的 K、V | 一份状态 |
| 一段 n 个位置的成本 | 随 n 的平方增长 | 随 n 线性增长 |
| 能不能取回某个旧位置 | 能，K、V 原样存着 | 不能，已经融进同一个矩阵 |
| 能记住多少细节 | 受显存限制 | 受状态容量限制 |

一个真实的量能说明动机：这套部署允许的最长请求是 133,120 个 token，标准全注意力下最后一个位置在每层每个头都要给 133,120 个 k 打分，而 KDA 只读一份状态，两个数的对照见 [attention 页的三种形式对照](attention-qkv.md#三种形式对照)。反过来，状态融合了很多位置的信息，通常无法从中逐个还原此前的 K、V，容量有限也限制了能表达的历史细节。

下面比较各种更新规则时，都省略显式的归一化分母，直接用已处理的 q、k 写递推。不同 linear attention 的特征映射、归一化和门控各不相同，这段推导不是所有模型共有的完整实现。

## 只做累加会写坏状态：delta 规则、遗忘门、按通道衰减

最朴素的写法是每个位置都把自己的键值关联加进去，也就是把 `k vᵀ` 累加到状态上。它不检查状态里已经为相似的键存了什么，键之间相近时，先后写入会互相干扰，旧关联也擦不掉。

**DeltaNet 把直接累加换成按误差修正。** 它先用当前的 k 从旧状态里读出「状态现在以为的 v」，记作 v̂；再把真正的 v 与 v̂ 之差乘上写入强度 β，作为外积加进状态。这样加进去的是这个键对应的偏差，而不是再来一份完整的 v。这条规则来自把注意力看成快速权重编程器的那一支工作，Schlag 等人用它替换纯累加的写入，Yang 等人给出了能并行执行的形式。

举个只为看清区别的例子：状态从零开始，k=(1,0)、v=(2,0)，同一个键值连写两次。累加写法让第一行从 (0,0) 变成 (2,0)，再变成 (4,0)；delta 写法在 β=1 时，第二次已经能正确预测出 v，误差为零，第一行仍是 (2,0)。这是单位键、无衰减的教学算例。

**Gated DeltaNet 再加一个遗忘门。** 纠错解决的是「这个键对应的值写得准不准」，还有一个问题是怎么主动减弱不再需要的旧信息。它在修正之前先给整个旧状态乘一个 0 到 1 之间的衰减系数，每个头每一步一个系数。两种控制分工明确：衰减管旧信息保留多少，delta 管当前键怎么修。

**KDA 把衰减从「每头一个数」细化到「每个 key 通道一个数」。** 论文里这一项写成 Diag(αₜ)，对角线上每个元素对应 k 的一维；Gated DeltaNet 那一项是一个标量门。于是同一个头里，状态的不同通道可以各自决定保留多少，不必一起缩放。KDA 也是 Kimi Linear 用的 linear attention 层，那篇论文同时给出 3 层 KDA 配 1 层全注意力的混合比例。

```wiki-diagram
file: kda-evolution
```

| 更新形式 | 从前一个基础保留什么 | 新增的变化 |
|---|---|---|
| 累加式 linear attention | 用固定形状的状态汇总历史 | 每个位置加入一份键值外积 |
| DeltaNet | 矩阵状态与查询读出 | 按当前键的预测误差修正状态 |
| Gated DeltaNet | delta 定向更新 | 加入每头一个的遗忘门 |
| KDA | 遗忘门与 delta 更新 | 把遗忘控制细化到 key 通道 |

这条线索只交代本页需要的机制关系，不是高效注意力的完整历史。同一个问题还有别的走法：[MLA](mla.md) 压缩每个位置的历史表示，[稀疏注意力](sparse-attention.md)限制每个查询能读的范围。GLM-5.3-Flash 把这些机制放在不同层里组合，而不是用 KDA 全面替代它们。

## KDA 一步完整的更新和读出

下面用 `S∈R^(dₖ×dᵥ)` 的数学布局，q、k、v 都是列向量，省略批次、头编号、缩放和外层投影。令 D 是按 key 通道取值的对角衰减矩阵，β 是写入强度，一次更新就是五步：

```text
衰减：   S̄ = D Sₜ₋₁
预测：   v̂ = S̄ᵀ k
误差：   e = v − v̂
更新：   Sₜ = S̄ + β k eᵀ
读出：   o = Sₜᵀ q
```

论文把同一件事写成一行：Sₜ = (I − β k kᵀ) Diag(α) Sₜ₋₁ + β k vᵀ，读出仍是 Sₜᵀ q。两种写法完全等价，把 e = v − S̄ᵀk 代进第四步展开即可：β k eᵀ = β k vᵀ − β k kᵀ S̄，与 S̄ 合并就得到 (I − β k kᵀ) S̄ + β k vᵀ。看源码时会遇到这两种形式，它们不是两套算法。

```wiki-diagram
file: linear-attention-state
```

图画的是单个头、单个位置的递推。真实一层还要多几步：模型先从隐藏向量投影出 q、k、v，以及写入强度和两个门；q、k、v 各过一个短卷积，q、k 再各自归一到长度 1（L2 归一化），这一步让 (I − β k kᵀ) 不会把状态放大；多个头各自维护自己的状态，读出结果最后经输出门、归一化和输出投影回到隐藏宽度。

把这五步在两维上走一遍就能看清各项的作用（示意数，用来检查五步公式，不是 GLM 的实际激活值）。取旧状态 $S_{t-1} = I$，按通道衰减 $D = \text{diag}(0.5, 1)$（第一通道每步只留一半、第二通道全保留），再取 $k = q = (1, 0)^\top$、$v = (3, 2)^\top$、写入强度 $\beta = 0.5$：

| 步骤 | 算式 | 结果 |
|---|---|---|
| 1. 衰减 $\bar{S}$ | $D S_{t-1} = \text{diag}(0.5, 1) \cdot I$ | $\begin{bmatrix}0.5 & 0 \\ 0 & 1\end{bmatrix}$ |
| 2. 预测 $\hat{v}$ | $\bar{S}^\top k$ | $(0.5,\; 0)^\top$ |
| 3. 误差 $e$ | $v - \hat{v} = (3, 2)^\top - (0.5, 0)^\top$ | $(2.5,\; 2)^\top$ |
| 4. 更新 $S_t$ | $\bar{S} + 0.5\, k e^\top$ | $\begin{bmatrix}1.75 & 1 \\ 0 & 1\end{bmatrix}$ |
| 5. 读出 $o$ | $S_t^\top q$ | $(1.75,\; 1)^\top$ |

每步改写的是这条请求的状态，投影权重始终不变。所以同一份权重服务很多请求，各请求的状态互不相干；而状态一旦被覆盖，就没有别处能把它算回来，这也是抢占（把请求的缓存收回、以后重算）在这类层上代价更高的原因。

想把这一步放回完整模型，可以打开[模型探索：KDA 状态更新与读出](#/model?view=play&segment=14)。该段保留状态矩阵与 Q/K/V 的位置关系；前一段展示衰减门和写入强度如何产生。

## 放到 GLM 双机：34 层 KDA 的状态有多大

**GLM-5.3-Flash 的 45 层主干里有 34 层 KDA、11 层稀疏 MLA，排法是 3 层 KDA 接 1 层 MLA；KDA 层不按位置存 K、V，一条请求在一层里只占一份大小固定的状态。** 层号名单和各层维度以[模型总览](glm-5-3-flash.md#45-层怎样排)为准，请求走到这里就是[主线第 4 站的 34 层 KDA](one-request.md#34-层-kda)。本页之后的数字都用[官方双机部署](glm-5-3-flash-two-node.md#部署前提)：两台 Atlas 800 A2、每台 8 卡，机内 TP8。

**64 个头按 TP 切给 8 张卡，每卡 8 个头。** q、k、v 三个投影各把 4096 维变成 64 × 128 = 8192 维，切完每卡 1024 列；输出投影按行切，每卡 1024 行输入、输出 4096 维，之后做一次 All-Reduce（各卡把同一位置的部分结果相加）。状态跟着头走：每卡只存、只更新自己 8 个头那一份，状态不跨卡交换，所以整层只有这一次集合通信。切法见 [tensor parallel 的 KDA 一节](tensor-parallel.md#kda状态跟着头一起切)，归约操作本身见 [All-Reduce](collective-communication.md#all-reduce)。

### 矩阵状态之外还有短卷积历史

一条请求在一个 KDA 层里要跨步保留的是两份东西，不是一份：

- **递推状态**：本卡 8 个头各一个 128 × 128 的矩阵，按 FP32 存，每卡 512 KiB；整层 64 个头合起来是 4 MiB。这就是前面讲的那个状态。
- **卷积状态**：短卷积要回看的最近几个位置的 q、k、v，按模型精度 BF16 存，长度是核长 4 减 1 再加 3 个草稿位置，共 6 格（草稿位置来自[投机解码](speculative-decoding.md)：每轮先起草 3 个 token，再和当前位置一起验证，所以要为它们多留格子）；每卡 36 KiB，整层 288 KiB。

两份加起来，每层每卡 561,152 B，34 层约 18.2 MiB；逐项的分片字节账在 [tensor parallel 的 KDA 状态一节](tensor-parallel.md#kda状态跟着头一起切)，本页不重算。

**为一条请求保留投机状态并补齐页面后，KDA 对应的页容量是 85 MiB，不是 18.2 MiB。** 中间有两步放大，来自状态份数和分配对齐，不能当成每步实际写入量：

1. **一份状态被补齐到和一个 MLA 页一样大。** GLM 是 hybrid 模型，KDA 的固定状态和 MLA 的按位置历史要共用同一批物理槽，页大小取两者的较大值 655,360 B，放进 561,152 B 的状态后，页里约 14.4% 是填充。655,360 和逻辑块 640 个 token 的由来见[部署页](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token)。

   这里取较大值的是单页容量，不是把 KDA 各层与 MLA 各层的总缓存取较大值；物理槽位采用相同容量，也不表示两类层共享同一份历史内容。
2. **投机解码再要 3 页。** 一轮验证会算出 3 个候选位置各自的状态，每个候选存一页；下一步按实际接受了几个，从对应那页接着算。于是每层每请求是 1 + 3 = 4 页，每页 655,360 B。

34 层各 4 页，合起来就是 85 MiB，逐项算式见 [tensor parallel 的源码位置一节](tensor-parallel.md#源码位置)；按并发上限 32 条算，每卡对应约 2.66 GiB 页容量。这两个数包含页内填充；内核是否写到这些填充位置、每步读写几份状态须另查执行。按块池的块号记账还要更多，见下一节。

这 85 MiB 与请求多长无关：4 个 token 的请求和 13 万 token 的请求付一样多。MLA 那一侧相反，每个 token 每张卡要 13,056 B，越长越多（见[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)）。所以 KDA 层的状态不增长，并不等于这个模型的缓存不增长：每 4 层里那 1 层稀疏 MLA 仍然按位置保留可回看的历史。因此短请求里 KDA 状态反而是大头，长请求里它的比重越来越小；两类状态的分类和折算见 [KV cache](kv-cache.md#混合模型到底要保留哪几类状态)。

### 状态怎么占到块号上

**34 层 KDA 在块池里分成 3 个缓存组，每组每请求 4 块，所以 KDA 固定占 12 个块号。** 分组按层号步长 3，得到 12、11、11 层三组；同组各层存储格式相同，共用一张块号清单。每组那 4 块就是上面的 1 页当前状态加 3 页草稿状态。块号怎么申请，见 [KV cache](kv-cache.md#混合模型到底要保留哪几类状态)；一条提示词只有 4 个 token 的短请求（加上 3 个草稿位置共 7 格）为什么合计占 15 块，见[短请求也占 15 个块](glm-5-3-flash-two-node.md#为什么短请求也占-15-个块)。

**12 个块号折成显存约 95.6 MiB，比上一节的 85 MiB 多，因为两个数算的东西不同。** 85 MiB 只计 34 层对应的已补齐页面。块池却按整个块号记账：一个块号在每张卡上对应 12 个 655,360 B 的主槽和 12 个 40,960 B 的索引器小槽，合 7.969 MiB；同一时刻一个块号只归一个组，所以哪个组拿到它，这 7.969 MiB 就整份算被占住，推导见[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。KDA 组拿到块号后用不满：12 层那组占用 12 个主槽，11 层的两组各空一个；索引器小槽给稀疏 MLA 使用，KDA 组不用。

一条请求的 KDA 状态在两种记账口径下相差约 $10.6\text{ MiB}$，拆解如下：

| 记账项 | 算式 | 字节数 | MiB |
|---|---|---|---|
| KDA 对应页容量（含页内填充） | $34\text{ 层} \times 4\text{ 页} \times 655{,}360\text{ B}$ | $89{,}128{,}960\text{ B}$ | $85.0\text{ MiB}$ |
| 按块号记账（12 个块号） | $12 \times 8{,}355{,}840\text{ B}$ | $100{,}270{,}080\text{ B}$ | $\approx 95.6\text{ MiB}$ |
| 差额合计 | $100{,}270{,}080 - 89{,}128{,}960$ | $11{,}141{,}120\text{ B}$ | $\approx 10.6\text{ MiB}$ |
| ↳ 差额 1：11 层两组空出的主槽 | $2\text{ 组} \times 4\text{ 块} \times 655{,}360\text{ B}$ | $5{,}242{,}880\text{ B}$ | $5.0\text{ MiB}$ |
| ↳ 差额 2：KDA 用不上的索引器小槽 | $12\text{ 块} \times 12 \times 40{,}960\text{ B}$ | $5{,}898{,}240\text{ B}$ | $\approx 5.6\text{ MiB}$ |

问单份有效状态看前面的 561,152 B/层；含投机份数和页内填充的页面容量看 85 MiB；估算块池还能放多少请求，则按 12 个块号、约 95.6 MiB。部署页短请求的「15 块约 119.5 MiB」也是块号口径。这三者都不直接给出每步访存流量。

**这里的「块大小」和逻辑块不是一个数。** KDA 组的块大小被设成最大请求长度 133,120，意思是「一条请求的状态一页装得下，和它多长无关」；KV 池和 MLA 用的逻辑块是 640 个 token，稀疏注意力算子按 128 个 token 一块读取；调度器的对齐单位是各组块大小的最小公倍数，也等于 133,120。block_size 这个词在这套部署里一共有五种含义，对照表和换算见 [KV cache 规格](kv-cache-spec.md#block_size-到底指哪一个五种含义)。

## Prefill 用 chunked 计算，decode 逐位置推进

**同一条递推规则有两种算法：已知一整段输入时按段并行算，只推进一个位置时直接递推。**

```wiki-diagram
file: linear-attention-flow
```

图是一层 KDA 的先后与分支。投影和短卷积对所有位置一样；接下来按这一步要算的位置种类分三条路，算完拼回原来的行序，再过输出门控与输出投影，最后在 TP 组内归约一次。

**chunked 计算（分段计算）把一段位置切成每段 64 个。** 段内可以把逐位置递推改写成矩阵运算，一次算完整段的输出；段与段之间仍按顺序传状态，后一段的初始状态就是前一段算完的状态。这和 KDA 论文里 64 的段长一致。所以分段只是重排计算的顺序，不改算法语义，与逐位置递推在数学上等价，差别只在浮点累加顺序。

**prefill 读初始状态、写回最终状态。** 没有可复用的初始状态时从清零的状态开始；分块预填充（把一段长提示词分几轮算完）时，后一轮在前一轮留下的状态上接着算，这条延续要求见[分块预填充](chunked-prefill.md#历史状态必须跨段延续)。本部署关着 prefix caching，所以开头相同的两条请求不会共用状态。

**decode 每步只推进一个位置**，走递推算子，q、k 的归一化和门控都在算子内部完成。开了投机解码时一轮要验证 1 + 3 个位置：这些位置走投机分支，按接受数量推进状态，卷积状态多留的 3 格就是为它们准备的，接受与回退见[投机解码](speculative-decoding.md)。

**一步里同时有 prefill 和 decode 的请求时，两条路都要走。** 实现先按位置种类把这一步的行分开，decode 的行走递推、prefill 的行走分段，各自算完再按原来的行序拼回一份输出。

**存储布局和数学布局可能是反的。** 缓存里的递推状态按「头、dᵥ、dₖ」排，分段算子要的是「头、dₖ、dᵥ」，所以只在算子边界转置一次，返回时再转回去。本模型 dₖ 和 dᵥ 都是 128，只看张量形状看不出转没转，检查时要同时核对每一维的含义。

最后要分清两层账：KDA 数学上的固定状态是一回事，系统为页对齐、投机和前缀复用预留的物理空间是另一回事。缓存规格怎么声明、五个组怎么分，见 [KV cache spec](kv-cache-spec.md)。

## 多条请求和空闲组：状态按槽位号各归各的

**一步里多条请求的行拼成同一个张量做矩阵乘，读写状态时各归各的。** 每条请求在每个缓存组有自己的槽位号，KDA 按槽位号取自己那份状态；这一步新来的请求先把状态清零再开始。批次怎么拼见[多请求的第 3 站](concurrent-requests.md#第-3-站-准备输入13-条请求拼成一个-6048-行的张量)。

**空闲的 DP 组也要陪跑，KDA 的外层计算仍会执行。** 两台机器是两个独立调度的执行组，前向却必须同步，所以本地没有请求的那一步也要拿填充行走一次前向。34 层 KDA 的输入投影、输出归一化与门控、输出投影仍会执行；短卷积和递推是否执行，则取决于有没有 attention 元数据（告诉算子每行属于哪条请求、状态在哪个槽位的那张表）。陪跑用的是补出来的行，不属于任何真实请求。

本部署给纯 decode 步录了图，也就是启动时把一整步的算子顺序录下来，之后整张回放，省掉逐个下发算子的开销，见 [ACL Graph](acl-graph.md)。陪跑步回放 decode 图时建元数据；这一步只能 eager 执行时（不走图、算子逐个下发，比如对端正在跑含 prefill 的混合步）就不建，启动时量显存的那次试跑也不建。没有元数据时，KDA 在进入短卷积前就返回，同时跳过短卷积和递推状态更新，外层计算继续执行。陪跑的代价见[空闲的 DP 组为什么还要陪跑](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)。

**抢占会把状态一起收走。** KDA 那 12 个块号被回收后，34 层的状态没有别处能恢复，只能把整条提示词重扫一遍重建，代价见[多请求的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)。

## 常见误解

- **「KDA 只是把 softmax attention 改写了一下，结果一样。」** 换掉 softmax 就换了相似度的形式，输出不等价。能靠结合律换顺序的是去掉 softmax 之后的式子；固定容量的状态也装不下任意多的历史细节。
- **「状态大小固定，所以 KDA 层几乎不占显存。」** 每条请求在每张卡上的 KDA 页面容量为 85 MiB、占住 12 个块号（约 95.6 MiB），短请求里它是大头；固定容量不等于每步写入量。
- **「KDA 层没有 KV cache，所以不进 KV cache 管理。」** 引擎把它当作一类缓存规格统一声明、统一分块，和 MLA 的历史共用同一个池子，见 [KV cache spec](kv-cache-spec.md)。
- **「prefill 分段并行，算出来和逐个递推不同。」** 段间仍按顺序传状态，两者数学上等价，差别只在浮点累加顺序。
- **「递推状态和卷积状态是一回事。」** 两份不同的东西：一份是汇总全部历史的矩阵，一份是短卷积要回看的最近几个位置，精度、形状、用途都不同。

- **「后端类名里带 GDN，所以这个模型跑的是 Gated DeltaNet。」** 昇腾的 KDA 实现沿用了 GDN 后端的接口名，实际调用的是 KDA 算子；类名不能证明算法，见[后端家族](attention-backend-family.md#放到-glm-双机一个-token-走过-45-层要问-45-次)。

## 对照源码

### 怎么开

**KDA 不是一个开关，是层的类型。** 解码器按配置里的 KDA 层名单选型：命中就构造 KDA 层，否则构造稀疏 MLA 层。[C9] 固定配置给出 64 个头、每头 128 维、短卷积核长 4、门的下界 −5.0；专用镜像同时认旧的 `linear_attn_config` 字典和新的平铺字段。[S1]

**这套部署里真正执行的是昇腾替换类。** 模型构造的是上游 vLLM 的 KDA 层，vLLM 版本为 0.23.0 时，昇腾把这个类名替换成自己的实现。[C8] prefill 走 AscendC 算子 `kda_gate_cumsum` 与 `chunk_kda_fwd`，decode 走 `recurrent_kda`。[C14]

**状态的精度和形状由两处决定。** 递推状态是 FP32，卷积状态用模型精度；[C20] 形状函数把投机 token 数加进卷积状态长度，上游那份通用函数不加。[C18]

**页大小和块大小被补丁改写。** 这类状态的页被补到「注意力页与状态原始大小的较大值」，[C21] 填充比例写进启动日志；KDA 组的块大小等于最大请求长度。[C22] 每请求的页数是 1 加投机块数。[C23]

### 会报什么错

| 情况 | 检查或报错 |
|---|---|
| 头数不能被 TP 整除 | 构造时断言 `num_heads % tp_size == 0`；64 个头要求 TP 是 64 的约数 |
| 卷积缓存布局不对 | `Ascend Kimi KDA requires the convolution cache layout [num_cache_lines, state_len, qkv_dim].` |
| 缺 prefill 算子 | 逐个检查 `kda_gate_cumsum`、`chunk_kda_fwd` 是否注册，缺一个就抛错 |
| prefill 遇到 PCP 并行 | `Kimi KDA prefill does not yet support PCP.` |
| prefill 元数据行数对不上 | `Kimi KDA prefill metadata is inconsistent: …` |
| 已钉 main 与 rc2 的构造期检查 | 要求每头 128 维、BF16 激活、投机 token 数不超过 7、卷积核宽在 2 到 4 之间、开 MTP 时核宽必须是 4、门下界落在 −5 到 0 之间 |

以上都是源码里的检查点，没有在设备上故意触发。头数断言在上游层的构造函数里，[C7] 布局检查与三处 prefill 报错在昇腾实现里，[C12][C14] 构造期限制的 main 实现见来源 28；rc2 同样保留这些检查，详见下方版本差异。[C28]

### 开销和什么时候别开

KDA 不能关：去掉它，模型就不是这个模型。它省掉的是随长度增长的那部分开销，代价有四笔：

- 每条请求每张卡固定 85 MiB 的 KDA 页容量、12 个块号，短请求也照付；
- 分段计算段内并行、段间串行，段长 64 决定这条串行链有多长；
- 投机解码把状态份数从 1 份增加到 4 份，再叠加页内填充，得到上面的 85 MiB 页容量；
- 固定容量限制了能记住的历史细节，这也是模型每 4 层留 1 层稀疏 MLA 的原因。

两个 KDA 算子的实测耗时与算术强度本页没有，只读了接口。

### 版本差异

**`v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）沿用 GLM 自带的 `Glm5NextLinearAttention`，并在 `main` 上进一步新增细粒度输入投影 TP（`KDAInputProjectionTP`）、PCP 列切与 RecoverSSM 开关。** `Glm5NextLinearAttention` 继承 `GatedDeltaNetAttention`，状态形状交给上游 `MambaStateShapeCalculator.kda_state_shape` 并传入 `num_spec` 为投机保留卷积状态空间；构造期强校验 `BF16` 激活、`head_dim=128`、卷积宽度在 2–4、投机数不超过 7（开启投机时核宽须为 4）及门下界在 `[-5, 0)`。

与旧镜像 `db701c1f` 分别构造投影的路径相比，`v0.30.0` 与 `main` 将 `q, k, v, b, f_a, g_a` 合并为一次 `in_proj_qkvbfg_a`（`f_a, g_a` 在 TP rank 间复制，其余按输出分片加载）。`main` 还额外引入两条新能力：① `KDAInputProjectionTP`（配 `finegrained_tp_config.qkv_iproj_tensor_parallel_size`），通过异步 `all_to_all_single` 与本地 `f_b_proj` / `g_b_proj` 上投影重叠；② `use_glm_recoverssm`（借上游 `cache_config.use_replayssm` 开关，要求开启投机解码、`PP=1`、`DCP=1`，`PCP>1` 时须 `TP=1` 且为 `kv_producer`）。递推公式、历史状态的数学含义没有因合并投影而改变，但旧镜像的 GEMM 次数与逐参数显存账不能直接套用到 `v0.30.0` / `main`。

**四版本核验矩阵（本页 GLM 双机数字固定于专用镜像 `db701c1f` + vLLM `0fc695fc`）：**

| 项目 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| KDA 层实现 | 维护快照仅有 triton 版算子，无 `kimi_kda.py` 与 GLM 模型（本页算例取镜像 `db701c1f`） | 有 `kimi_kda.py` 与状态形状函数，仍无 GLM-5.3-Flash 模型文件 | `models/glm5next/kda.py` 自带 `Glm5NextLinearAttention`，合并 `in_proj_qkvbfg_a` | 同 `v0.30.0`，新增 `PCPGlm5NextMergedColumnParallelLinear`、细粒度 `KDAInputProjectionTP` 与 `use_glm_recoverssm` |
| 替换时机 | 镜像仅在 vLLM 0.23.0 时走替换表 | 无条件登记替换表 | 模型直接构造，不走替换表 | 同 `v0.30.0` |
| 卷积状态留投机位 | 维护快照无此文件（镜像手动加 `num_spec`） | 核长减 1 加投机数 | 交上游 `kda_state_shape(..., num_spec=self.num_spec)` | 同 `v0.30.0` |
| 分段段长 | triton 分段算法 | AscendC 分段算子，段长 64 | 段长 64 | 同 `v0.30.0` |
| 投机上限与构造检查 | 无构造期检查 | 仅运行期查元数据 | 构造期强校验 `BF16`、`head_dim=128`、投机数 $\le 7$、核宽 2–4（投机须为 4） | 同 `v0.30.0`，另增 `validate_glm_recoverssm` 拓扑校验 |
| 状态布局转置 | 维护快照无此文件 | 缓存按「头、$d_v$、$d_k$」，算子边界转置 | 转置改在卷积状态侧，按 AscendC 算子维度约定 | 同 `v0.30.0` |

四版能否在双机上整套跑通本页部署未做实机验证；各分支与镜像的对应见[来源基线](../sources/glm-5-3-flash-baseline.md)。表中各版本证据位置：`v0.23.0` 见来源 25、`v0.26.0rc` 见来源 26–27、`rc2`/旧 `main` 见来源 28–30 与 32、`v0.30.0`（`c09d3e20`）`Glm5NextLinearAttention` 见来源 33、`main`（`8d6180e2`）`KDAInputProjectionTP` 与 `recoverssm_config` 见来源 34–36。

### 源码位置

**检索名称。** linear attention 在源码里不叫这个名字：KDA 的层类名带 `GatedDeltaNet`，状态由 `mamba` 那一套接口管理（vLLM 把递推状态类模型都归到这一套里），所以搜 `kimi_kda`、`kda_state`、`mamba_page_size_padded` 比搜 linear attention 有效。递推状态叫 `recurrent_state`，短卷积状态叫 `conv_state`，投机接受数叫 `num_accepted_tokens`，分段段长常数叫 `_KDA_CHUNK_SIZE`。

按「怎么选到这一层 → 投影和门 → 短卷积 → 两条计算路径 → 状态规格和页」读，能把本页的机制对回实现：

| 要核对什么 | 固定源码位置 |
|---|---|
| 按层号选 KDA 还是稀疏 MLA | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2072-L2105` |
| 运行时把上游 KDA 层替换成昇腾实现 | `vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768` |
| 上游层的权重定义与头数断言 | `vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L102-L231` |
| 投影、写入强度、两个门与输出投影 | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L291` |
| 短卷积与缓存布局检查 | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L294-L331` |
| decode 的逐位置递推 | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L343-L388` |
| prefill 的分段计算与状态写回 | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L390-L474` |
| 投机分支按接受数量推进 | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L528-L560` |
| 混合批次的拆分与拼回 | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L586-L659` |
| 状态形状与投机位 | `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda_state.py#L9-L32` |
| 模型侧的状态精度与形状入口 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2489-L2509` |
| 页补齐、填充比例与 KDA 组块大小 | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L44-L56`、`#L191-L228` |
| 每请求页数等于 1 加投机块数 | `vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L627-L636` |
| 空批次要不要建 attention 元数据 | `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3332-L3344` |

没有 attention 元数据时在短卷积前返回，见来源 15；外层投影、输出归一化与门控、输出投影仍继续执行，见来源 11。4 份状态与补齐后的页面容量，分别由来源 23、21–22 确定。

机制来源分开记：linear attention 把复杂度从平方降到线性的原始论述来自 Katharopoulos 等人；[S3] delta 规则的写入形式来自 Schlag 等人的快速权重工作[S4]和 Yang 等人的并行化形式；[S5] 每头一个遗忘门的组合来自 Gated DeltaNet；[S6] 按 key 通道衰减的 Diag(α)、64 的段长和 3 层 KDA 配 1 层全注意力的比例来自 Kimi Linear 论文。[S2] 教学算例的数字是按上面五步手算的，只用来检查递推。[A] 85 MiB 与 18.2 MiB 的逐项字节都在 tensor parallel 页，2.66 GiB 是 32 条并发的乘积；按块号记账的 95.6 MiB 由部署页每个块号 7.969 MiB 乘 12 得到，差额按块号的主槽、小槽构成拆开。[D]

状态口径按固定源码核对：来源 18 第 27–32 行分别给出短卷积形状与按本地头组织的递推矩阵，来源 21 第 44–56 行对 GLM 取两类单页容量的较大值，来源 22 负责页补齐，来源 23 还按缓存模式和投机块数计算总占用。因此，单页补齐不等于两类层共享历史，固定状态接口也不证明与密集注意力等价或整个混合模型不保存逐位置历史；这些边界保持为分析结论，没有设备实测。[I]

**待核。** 以下几项本页没有一手证据：两个 KDA 算子的实测耗时与算术强度；投机接受数在卷积状态里回退的确切语义（回退逻辑在 AscendC 算子内部，只读到了参数）；前 3 层 KDA 与其余 31 层是否有任何差别（从配置和代码看没有）；最终运行镜像里实际安装的 vLLM 与 vllm-ascend 组合。
