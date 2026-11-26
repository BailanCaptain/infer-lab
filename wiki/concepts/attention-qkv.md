---
id: attention-qkv
title: Attention 与 Q/K/V：当前位置怎样从历史里取信息
type: concept
legacyAnchors:
  落到-glm-双机两类-attention-各改了哪一步: 复杂异构实战对照：GLM 稀疏 MLA 与 KDA 各改了哪一步
summary: >-
  attention 让每个位置按相关程度从自己和前面的位置取信息。本页先用 3 位置小例手算 Q/K/V 打分、1/√d 缩放、softmax、因果掩码与多头，
  再落到标准 Qwen3-8B 的 32Q:8KV GQA 与逐头 QK-Norm，最后在复杂异构对照节展开历史 GLM 稀疏 MLA 与 KDA。
aliases:
  - 注意力
  - attention
  - 自注意力
  - self-attention
  - Q、K、V
  - QKV
  - Query/Key/Value
  - 查询
  - 键
  - 值
  - 注意力分数
  - attention score
  - softmax
  - 归一化指数
  - 缩放点积注意力
  - scaled dot-product attention
  - attention head
  - 因果掩码
  - causal mask
  - 头维度
  - head dim
  - head_size
  - attention scale
  - attention-scores
  - attention-weights
  - causal-mask
  - context-vector
  - dot-product
  - head-dim
  - query
  - key
  - value
  - output-projection
  - multi-head
  - QK
  - q_proj
  - k_proj
  - v_proj
  - q_norm
  - k_norm
chapters:
  - '02'
order: 60
sources:
  - 'https://arxiv.org/html/1706.03762v7'
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - 'vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L177-L210'
  - 'vllm@0fc695fc:vllm/v1/attention/backend.py#L32-L44'
  - 'vllm@568afb3a:vllm/model_executor/layers/attention/attention.py#L223-L256'
  - 'vllm@ced6857a:vllm/model_executor/layers/attention/attention.py#L225-L258'
  - 'vllm@ced6857a:vllm/v1/attention/backend.py#L36-L45'
  - 'vllm@ba15685a:vllm/model_executor/layers/attention/attention.py#L244-L276'
  - 'vllm@ba15685a:vllm/v1/attention/backend.py#L35-L44'
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L835-L839'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L871-L875'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/kimi_kda.py#L427-L435'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L632-L636'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/model.py#L291-L315'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/model.py#L717-L735'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/attention.py#L140-L258'
  - 'vllm-ascend@c09d3e20:vllm_ascend/models/glm5next/kda.py#L148-L185'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/kda.py#L16-L57'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/device_op.py#L529-L577'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/context_parallel/sfa_cp.py#L1845-L1860'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/model.py#L104-L107'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/model.py#L319-L342'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/attention.py#L151-L266'
  - 'vllm-ascend@8d6180e2:vllm_ascend/models/glm5next/kda.py#L264-L325'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1881-L2105'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L39-L182'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L472'
  - 'vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L576-L592'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/context_parallel/sfa_cp.py#L1303-L1307'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768'
  - 'vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L111-L117'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L836-L836'
  - >-
    raw:sha256-7d2c441832b6dfd0350ca61862c6d7bd0be162c67d8d213eafe23d8cd5a0483d.md#L1-L845
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: token
    kind: builds-on
    note: 每个 token 占据序列里的一个位置，attention 在这些位置之间建立上下文读取关系
  - to: embedding
    kind: builds-on
    note: 按编号查出的嵌入向量是第 1 层隐藏表示的起点，attention 从隐藏表示投影出 Q、K、V
  - to: matmul-and-weights
    kind: builds-on
    note: Q/K/V 线性投影、点积打分和输出投影都遵循矩阵乘与权重切分规则
contradicts: []
updated: '2026-11-18'
origin: gap
rawSources:
  - >-
    raw/sha256-3d6d4a9ab058b825bb78d7cab17c0079b051acbb2a61e64fc6a9648dc9758460.md
  - >-
    raw/sha256-7d2c441832b6dfd0350ca61862c6d7bd0be162c67d8d213eafe23d8cd5a0483d.md
---

## attention 是什么？

**attention（注意力）让每个位置去看上下文里的其他位置（也包括自己），按相关程度把那些位置的信息取过来，并进自己的表示里。**

一个词是什么意思，常常要看上下文才定得下来。「小明把书借给小红，因为她……」里的「她」指谁，要回头看到「小红」才知道；「苹果」在「苹果发布了新手机」和「我吃了一个苹果」里是两样东西，要看旁边的词才分得开。模型读文本时，每个 [token](token.md)（文本切出的一个小片段；这里为了好读，一个词算一个）占一个位置，先通过[嵌入（embedding）](embedding.md)查出初始向量，之后每个位置维护一条隐藏向量：向量就是一排数，记着这个位置到目前为止知道的信息，在层与层之间传递，见[层与隐藏表示](layers-and-hidden.md)。attention 让「她」这个位置回头看前面每个位置，判断各自有多相关，再按相关程度把它们的信息取过来：

```wiki-diagram
file: attention-intuition
```

这些比重不是人定的，是模型按内容现算出来的，后面会一步步算。在只有解码器的自回归模型（如标准 `Qwen3-8B`）里，一个位置只看自己和前面的位置，原因见后面因果掩码一节，所以图里「她」只看到自己为止。

在标准 Transformer（《Attention Is All You Need》提出的模型结构）的一层里，[前馈网络（MLP）](mlp-residual-norm.md)对每个位置各算各的，位置之间不交换信息；attention 是层里让一个位置读到其他位置的那一步。它的输出再经输出投影回到隐藏宽度，交给残差连接加回原来的隐藏向量。

## 为什么需要 attention，代价在哪？

**要预测下一个 token，最后一个位置必须用上前文；attention 让它按内容决定从哪些位置取多少。** 没有这一步，每个位置的表示只取决于自己那个 token：「她」的位置只知道自己是个「她」，不知道指的是小红还是小明，也就猜不准后面该接什么。

在 Transformer 之前，处理文本的主流做法是循环网络（RNN）：从左到右逐个读，把读过的内容压进一个状态，一步步往后传；attention 最早也是加在循环网络上用的。循环网络有两个毛病：离得远的信息要经过很多步才传到，一路容易被新内容冲淡；而且必须等前一个位置算完才能算下一个，没法并行。Transformer 去掉循环、只用 attention 连接位置：「她」读「小红」只要一步，整段提示词也可以在 [prefill](prefill.md) 阶段同时算。《Attention Is All You Need》第 4 节比较了每层计算量、最少串行步数和长距离路径长度，后两项正是这里说的两点。

取多少也不是固定的：同一层参数下，换一段输入，比重就跟着变。后面会看到，这个比重（算法里叫权重）由每个位置的 q 和 k 算出，输入一变，q、k 就变，比重也跟着变。

代价在于每个位置都要和它能看到的全部位置两两打分：

- **计算随长度平方增长。** 3 个位置要打 $1 + 2 + 3 = 6$ 次分；一次处理 $T$ 个位置，要打 $T(T+1)/2 \approx T^2/2$ 次（多头时每个头各打这么多），每次打分后还有一次按比重汇合。1,000 个位置就是 $500{,}500$ 次，且每层都要算一遍。硬件执行时，融合算子把分块打分、在线 softmax 与加权汇合留在片上完成，省去巨型中间矩阵读写，见 [Ascend FlashAttention](ascend-flash-attention.md)。
- **历史要一直留着。** 生成新 token 时，新位置仍要和全部历史位置打分、取信息。为免每步重算，历史位置的 K、V 存进 [KV cache](kv-cache.md)，占用随长度线性增长，每步还要把它们读一遍；1,000 个位置就要存并读 1,000 个位置的量。

因此现代模型发展出三类降本思路：减少独立 K/V 头份数（如标准 `Qwen3-8B` 采用的 [GQA](gqa.md)）、只挑部分历史位置来读（[稀疏注意力](sparse-attention.md)），或把历史压成固定大小状态（[linear attention](linear-attention.md)，支持分块并行推进）。代价随长度怎样涨、落在计算还是访存上，见[注意力代价](attention-cost.md)。异构混合模型怎样组合稀疏 MLA 与线性注意力，放在后半「复杂异构实战对照」展开。

## attention 怎么算？跟着一个位置走一遍

**具体算法是：当前位置拿自己的查询向量 q 和每个位置的键向量 k 各算一个匹配分数（两者的点积，再按长度缩小），把这排分数换成加起来等于 1 的权重，再按权重把各位置的值向量 v 加成一条新向量。**

q（query，查询）、k（key，键）、v（value，值）都从隐藏向量算出来：q 是拿去找别人的，k 是等着被找的，v 是被找到后交出去的内容。为了能手算，下面换成一个缩到最小的例子：3 个位置，每条向量只有 4 个数，真实模型有几千个；数是为演示编的（教学示意），算法和真实模型相同。跟着位置 2 走：它要从位置 0、1、2 读信息，算出自己的输出 $o_2$。位置 2 就像前面的「她」；算下来它给位置 0 的权重最大，位置 0 就像「小红」。

```wiki-diagram
file: attention-qkv-flow
```

**① 乘三套权重，得到 q、k、v。** 每个位置的隐藏向量分别乘三个 $4 \times 4$ 的权重矩阵，得到 q、k、v 三条向量，每条仍是 4 个数。三套权重记作 $W_Q$、$W_K$、$W_V$，里面的数是训练学到的，所有位置共用同一套；一条向量乘一个矩阵怎样得到新向量，见[矩阵乘和权重](matmul-and-weights.md)。位置 2 得到 $q_2 = [1, 2, 0, 1]$，位置 0、1 也各有自己的 q、k、v。

**② 打分：$q_2$ 和每个 k 做点积。** dot product（点积）把两条一样长的向量对应位置的数相乘，再把乘积全部加起来，得到一个数。$q_2$ 和 $k_0$ 的点积是 $1\times 2 + 2\times 1 + 0\times 0 + 1\times 0 = 4$；和 $k_1$、$k_2$ 的点积分别是 $2$ 和 $0$。点积越大，表示 $q_2$ 要找的东西和这个位置的 k 越对得上。

**③ 缩小，再用 softmax 换成权重。** 三个点积先除以 $\sqrt{d}$，$d$ 是 q、k 的长度，这里 $d = 4$、$\sqrt{4} = 2$，得到分数 $[2, 1, 0]$；为什么要除，后面「为什么要除以 √d」一节单独讲。softmax（归一化指数）把一排分数换成非负、加起来等于 1 的权重：每个分数先变成 $e$ 的这个数次方（$e \approx 2.718$），再各自除以它们的总和。分数高的权重大，而且差距被指数放大。位置 2 得到的权重是 $[0.67, 0.24, 0.09]$。

**④ 按权重把 v 加起来。** 每个 v 整条乘上自己的权重，再按列相加，就是位置 2 的输出 $o_2$。以 $o_2$ 的第 3 个数为例：三个 v 的第 3 个数是 $2$、$1$、$0$，加权相加是 $0.67\times 2 + 0.24\times 1 + 0.09\times 0 = 1.58$。四列都这样算，$o_2 = [0.76, 0.33, 1.58, 0.42]$，和 v 一样是 4 个数。下图把 ② 和 ④ 各放大一个数：

```wiki-diagram
file: attention-qkv-zoom
```

把位置 2 的四步计算写成一行关系式，并对照每一步的具体数值（指数与权重保留两位小数，三个指数之和为 $11.11$，因此三项权重相加恰好等于 $1$）：

$$\text{score}_j = \frac{q_2 \cdot k_j}{\sqrt{4}}, \quad a_j = \frac{e^{\text{score}_j}}{\sum_{l=0}^{2} e^{\text{score}_l}}, \quad o_2 = \sum_{j=0}^{2} a_j v_j$$

| 计算步骤（位置 2 示意手算） | 对位置 0（$j=0$） | 对位置 1（$j=1$） | 对位置 2（$j=2$） | 汇总或输出 |
| --- | --- | --- | --- | --- |
| 点积 $q_2 \cdot k_j$ | $4$ | $2$ | $0$ | $[4, 2, 0]$ |
| 除以 $\sqrt{4} = 2$ 得分数 | $2$ | $1$ | $0$ | $[2, 1, 0]$ |
| 取指数 $e^{\text{score}_j}$ | $e^2 \approx 7.39$ | $e^1 \approx 2.72$ | $e^0 = 1.00$ | 总和 $11.11$ |
| Softmax 权重 $a_j$ | $7.39 \div 11.11 \approx 0.67$ | $2.72 \div 11.11 \approx 0.24$ | $1.00 \div 11.11 \approx 0.09$ | 权重和 $= 1$ |
| 加权汇合 $a_j v_j$ | $0.67 \times [1,0,2,0]$ | $0.24 \times [0,1,1,1]$ | $0.09 \times [1,1,0,2]$ | $o_2 = [0.76, 0.33, 1.58, 0.42]$ |

例子里也看得出 k 和 v 分工不同：$k_0$ 和 $q_2$ 最对得上，位置 0 因此分到 $0.67$ 的权重，但真正被搬进 $o_2$ 的是 $v_0$ 里的数。k 只决定读谁、读多少，v 才是被读走的内容，所以两者分开算。

## 所有位置一起算：写成矩阵

**每个位置都按上面四步各算一遍；把各位置的 q、k、v 按行叠成矩阵 $Q$、$K$、$V$，四步就合成论文里的一个式子：$\text{softmax}(QK^\top / \sqrt{d_k}) V$。** $d_k$ 就是上面的 $d$，即 q、k 的长度。

$K^\top$ 是 $K$ 的转置：把 $K$ 的行竖过来当列，$k_0$、$k_1$、$k_2$ 各占一列。这样 $Q$ 的第 $i$ 行乘 $K^\top$ 的第 $j$ 列，正好是 $q_i$ 和 $k_j$ 的点积；一次矩阵乘就把所有「查询 × 键」的点积算齐，排成一张表，行是查询位置，列是键位置。

```wiki-diagram
file: attention-qkv-matrix
```

点积表的第 3 行 $[4, 2, 0]$ 就是上一节位置 2 的三个点积。除以 $\sqrt{4}$ 之后，每行里「未来位置」的分数会被换成 $-\infty$（负无穷），也就是 **causal mask（因果掩码）**：位置 0 只能看位置 0，位置 1 只能看位置 0、1（原理见下文[因果掩码](#因果掩码限定每个位置能访问的历史)）。

接着每行各自做 softmax：位置 0 只剩一个可见位置，权重为 $[1, 0, 0]$；位置 1 两个分数相等，平分成 $[0.5, 0.5, 0]$；位置 2 就是前面算出的 $[0.67, 0.24, 0.09]$。最后权重表乘 $V$：第 $i$ 行权重给 $V$ 的各行加权求和，得到输出 $o_i$（因此 $o_0 = v_0$）。遮掉未来位置后，每行真正参与计算的格子分别是 1、2、3 个，合计 6 个，正好对应前文的 $T(T+1)/2$ 次打分。

拆到单个查询位置 $i$ 和键位置 $j$ 上，对应打分、沿键位置 $j$ 归一化和按权重汇合 $V$ 这三步：

$$s_{ij} = \frac{q_i \cdot k_j}{\sqrt{d_k}} + m_{ij}, \quad a_{ij} = \frac{\exp(s_{ij})}{\sum_l \exp(s_{il})}, \quad o_i = \sum_j a_{ij} v_j$$

$m_{ij}$ 是掩码项：允许访问的位置取 $0$，被屏蔽的位置取 $-\infty$。softmax 沿键位置归一化，所以一个查询位置的全部权重之和等于 $1$，图里权重表每行之和都是 $1$。它和采样前在词表上做的 softmax 公式相同，作用对象不同：这里分配「读哪个位置多少」，那里分配「下一个 token 取哪个词」。

权重只控制各个 v 贡献多少，输出仍是一条与 v 同宽的向量。实际实现里，softmax 会先让整行分数减去本行最大值再取指数：位置 2 的 $[2, 1, 0]$ 减去 $2$ 变成 $[0, -1, -2]$，取指数约 $[1, 0.368, 0.135]$，除以总和后仍是 $[0.67, 0.24, 0.09]$。这样做结果不变，却能避免大正数直接取指数时发生数值溢出。

公式表达的是数学等价关系。中间那张「查询数 × 键数」的分数表是否真的写进显存，取决于具体的 attention 内核：融合内核可以分块边算边汇合（见 [Ascend FlashAttention](ascend-flash-attention.md)）。

几个相邻概念各管一件事：

| 概念 | 管什么 |
|---|---|
| attention | 本步每个查询位置从可见位置读信息的计算 |
| KV cache | 把历史位置的 K、V（或它们的压缩形式）存下来，供之后的查询读 |
| MLP | 对每个位置单独变换，不跨位置 |
| 采样前的 softmax | 在词表上把 logits（模型给每个词打的原始分）换成下一个 token 的概率，作用对象是词，不是位置 |

下面用一组八位置、四通道的单头注意力教学算例，在单卡上连续观察「认清 Q/K/V → 匹配分数变成原始份数 → 除以总份数得到占比 → 逐行累加 V 的四通道贡献」完整四步，核对整表输出 $[25, 15, 12.5, 7.5]$（这里的“总份数”就是归一化的分母；把同一组八行历史按奇偶位置分给多张卡并合并局部输出的对照，见后续 [Context Parallel](context-parallel.md#scene-parallel-mechanism-3)）。

```wiki-scene
inference-mechanism:0
```

想直观浏览标准单层前向里的 Q/K/V 投影与缩放点积过程，可打开[Qwen3 标准注意力演示](#/model?view=play)；历史 GLM 稀疏 MLA 的两段专用演示入口保留在后文「复杂异构实战对照」一节。

## Q、K、V 从哪里来，各管什么

**Q、K、V 不是输入里现成的三份数据，而是同一份隐藏向量乘三个不同权重矩阵的结果。** 把一层的输入写成矩阵 $X$，每行是一个位置的隐藏向量，例子里 $X$ 是 3 行 4 列：

$$Q = X W_Q, \quad K = X W_K, \quad V = X W_V$$

每一行仍对应一个位置：$X$ 的第 $i$ 行乘 $W_Q$，得到 $Q$ 的第 $i$ 行 $q_i$（即位置 $i$ 的查询），$k_i$、$v_i$ 同理。例子里的 $W_Q$ 是 $4 \times 4$，行数等于隐藏宽度，列数等于 $q$ 的宽度（矩阵乘规则见[矩阵乘和权重](matmul-and-weights.md)）。《Attention Is All You Need》里的 self-attention 三者都来自上一层同一份输出；编码器—解码器结构另有一种 Q 来自解码器、K/V 来自编码器的交叉注意力。主流自回归解码器模型只用前者，并施加 causal mask。

同一个位置的 q 和 k 也不一样，因为乘的是两套矩阵：位置 2 的 $q_2 = [1, 2, 0, 1]$，$k_2 = [1, 0, 1, -1]$。q 表示「我要找什么」，k 表示「别人来找时，我拿什么去匹配」。例子里 $q_2$ 和自己的 $k_2$ 点积是 $0$，位置 2 分给自己的权重最少：一个位置不一定最「像」自己。

| 表示 | 在计算里做什么 | 宽度 |
|---|---|---|
| Q（query，查询） | 当前位置拿去和可见位置比对 | $d_k$，必须与 K 相同才能做点积 |
| K（key，键） | 被查询比对，决定这个位置分到多少权重 | $d_k$ |
| V（value，值） | 按权重被加起来，成为输出的内容 | $d_v$，可以与 $d_k$ 不同 |

例子里 $d_k$ 和 $d_v$ 都是 4。K 和 V 用两套矩阵，评分空间和内容空间就能分开学：一个位置凭什么被选中，和被选中后交出什么，可以是两回事。每层都有自己的三套权重；经过前面几层之后，一个位置的隐藏向量已经混进了上下文，下一层的 Q、K、V 就从这份带上下文的向量算出来。

## 为什么要除以 √d

**点积的波动幅度随维数 $d$ 增长，约为 $\sqrt{d}$；除以 $\sqrt{d}$ 把分数拉回同一量级，softmax 才不会一边倒。**

先用例子看不除会怎样。位置 2 的三个点积是 $[4, 2, 0]$，除以 $\sqrt{4} = 2$ 再做 softmax，权重是 $[0.67, 0.24, 0.09]$。直接拿 $[4, 2, 0]$ 做 softmax，$e^4 \approx 54.6$、$e^2 \approx 7.39$、$e^0 = 1$，权重变成约 $[0.87, 0.12, 0.02]$：最大的一项从 $0.67$ 涨到 $0.87$，位置 2 自己几乎分不到。分数之间差得越开，softmax 越往最大的一项倒。

维数越大，这种差距就越大。先说三个统计词：一排数的均值就是平均值；方差衡量这排数离均值有多散，算法是每个数减去均值、平方，再取平均；标准差是方差的平方根，可以当成「典型地偏离均值多少」。比如 $[1, -1, 1, -1]$ 的均值是 $0$，每个数都离均值 $1$，方差是 $1$，标准差是 $1$；$[2, -2, 2, -2]$ 的方差是 $4$，标准差是 $2$。

论文的理由是：假设 q、k 的每一维都是均值 $0$、方差 $1$ 的独立随机数，点积 $q \cdot k$ 是 $d$ 项乘积之和。每项乘积均值 $0$、方差 $1$；独立项相加时方差相加，因此点积均值为 $0$、方差为 $d$、标准差为 $\sqrt{d}$。$d = 4$ 时点积典型偏离约 $2$，标准 `Qwen3-8B` 的 $d = 128$ 时约 $11.31$，$d = 256$ 时约 $16$；除以 $\sqrt{d}$ 正好把典型偏离拉回 $1$。

softmax 按指数放大分差：分数一旦拉开，几乎全部权重落到最大项，其余位置趋近 $0$。训练期这会进入梯度极小的饱和区，推理期也会挤占低精度浮点动态范围。下图把标准 `Qwen3-8B`（$d_h = 128$）的 $1/\sqrt{d_h}$ 缩放与下三角因果掩码放在同一画布对照：

```wiki-diagram
file: attn-qkv-fig-scale-softmax
```

设两个点积相差一个标准差，它们在 softmax 里的权重比就是 $e$ 的分差次方之比：

$$\text{Var}(q \cdot k) = d \implies \text{Std}(q \cdot k) = \sqrt{d}, \quad \frac{\exp(s_{\text{high}})}{\exp(s_{\text{low}})} = \exp(\Delta s)$$

| 单头宽度设定 | 点积标准差 $\sqrt{d}$ | 未缩放（相差 $1$ 个标准差或示意分） | 乘 $1/\sqrt{d}$ 缩放后 | 直观后果 |
| --- | --- | --- | --- | --- |
| 小算例 $d = 4$ | $\sqrt{4} = 2$ | 点积 $[4, 2, 0] \to [0.87, 0.12, 0.02]$ | 分数 $[2, 1, 0] \to [0.67, 0.24, 0.09]$ | 避免最大项吃掉近九成比重 |
| 标准 Qwen3-8B（$d = 128$） | $\sqrt{128} \approx 11.31$ | 分差 $11.31$：$e^{11.31} \div e^0 \approx 81{,}634$ | 除以 $\sqrt{128}$ 后分差 $1$：$e^1 \div e^0 \approx 2.72$ | 缩放系数 $1/\sqrt{128} \approx 0.0884$，拉回单位方差 |
| 更宽单头 $d = 256$（如后文 MLA） | $\sqrt{256} = 16$ | 分差 $16$：$e^{16} \div e^0 \approx 8{,}886{,}111$ | 除以 $16$ 后分差 $1$：$e^1 \div e^0 \approx 2.72$ | 方差回到 $1$，脱离梯度饱和区 |

缩放系数是模型定义的一部分：模型按它训练，推理也必须用同一个值，改了它输出就变了。它的 $d$ 指每个头里 q、k 做点积的宽度 $d_k$，不是隐藏宽度，也不一定是缓存里存的宽度。后面多头一节把例子切成两个头，每个头的 q、k 只有 2 个数，就除以 $\sqrt{2}$ 而不是 $\sqrt{4}$。

## 因果掩码限定每个位置能访问的历史

**causal mask（因果掩码）让位置 $i$ 只能读位置 $0 \dots i$，模型据此预测位置 $i+1$；做法是在 softmax 之前把未来位置的分数设成负无穷。** $e$ 的负无穷次方是 $0$，这些位置的权重就恰好为 $0$，这正是原论文在解码器里用的办法：把非法连接对应的 softmax 输入设为 $-\infty$。为什么不能看后面：训练时位置 $i$ 的任务就是预测位置 $i+1$ 的 token，要是能读到位置 $i+1$，就等于直接看到了答案。

用例子里位置 1 那一行看遮与不遮的差别。除以 $\sqrt{4}$ 之后，位置 1 对位置 0、1、2 的分数是 $[0.5, 0.5, -0.5]$，其中位置 2 在它后面，属于未来（指数与权重保留两位小数）：

$$s_{1,:}^{\text{masked}} = [0.5,\; 0.5,\; -\infty], \quad \exp(s_{1,:}^{\text{masked}}) \approx [1.65,\; 1.65,\; 0] \implies a_{1,:} = [0.5,\; 0.5,\; 0]$$

| 位置 1（查询 $q_1$）处理方式 | 对位置 0、1、2 的分数 | 取指数 $\exp(s_{1,j})$ 与分母总和 | 最终权重 $a_{1,:}$ | 物理含义 |
| --- | --- | --- | --- | --- |
| 不加因果掩码（违规） | $[0.5, 0.5, -0.5]$ | $[1.65, 1.65, 0.61]$，总和 $3.91$ | $[0.42, 0.42, 0.16]$ | 偷看未来位置 2，读走 $16\%$ 的内容 |
| 施加因果掩码（合规） | $[0.5, 0.5, -\infty]$ | $[1.65, 1.65, 0]$，总和 $3.30$ | $[0.5, 0.5, 0]$ | 未来权重归零，剩余相等项平分 |

不遮的话，位置 1 会从还没出现的位置 2 读走 $16\%$ 的内容；遮住之后这份权重变成 $0$，由位置 0、1 平分。矩阵图里权重表右上角的几个 $0$ 都是这样来的。

核对实现时，要区分因果可见性规则和某个算子的裁剪开关。在所核对的[上下文并行](context-parallel.md)路径中，索引器已经限制了查询能看到的位置；位置重映射后，局部 KV 与全局查询的坐标不同，所以后续算子关闭了二次因果裁剪。关闭这一步裁剪不等于允许查询访问未来位置。

它不只用在逐个生成的阶段。提示词在 [prefill](prefill.md) 阶段一次性整段送进模型时，位置 1 也不能偷看位置 2，否则同一个位置在「整段送入」和「逐个生成」时会算出不同的结果。沿用例子：如果位置 3 也在同一批里，位置 2 给它的分数就是 $-\infty$，分数变成 $[2, 1, 0, -\infty]$，权重仍是 $[0.67, 0.24, 0.09, 0]$。

```wiki-diagram
file: attention-causal
```

左图是例子整段送入的情形：prefill（第一次处理提示词）同时计算位置 0–2，每行有自己的可见范围，格里的权重就是矩阵图里那张权重表，最后一行能看到全部三个输入。右图是之后把生成的 token 放到位置 3：普通 decode（接着历史逐步生成）只新增一个查询位置，它读取此前各位置的 K、V，再加上位置 3 自己的一份。

**decode 时只为新位置算 q、k、v；历史的 K、V 从 [KV cache](kv-cache.md) 读，不重算。** 此前位置的 q 在算完自己的输出后就用不上了，后面的位置各用自己的新 q；而它们的 k、v 每一步都还要被读，所以缓存只存 K、V，不存 Q。因为 causal mask 保证后来的 token 改不了旧位置的 K、V，读缓存和每步重算得到的是同一组数。

**本轮查询数和可见历史长度是两个维度。** 对单个头，张量形状写成 $Q\;[T, d_k]$、$K\;[S, d_k]$、$V\;[S, d_v]$、分数表 $[T, S]$、输出 $[T, d_v]$：$T$ 是本轮新算的查询位置数，$S$ 是包含本轮在内的可见键位置数。

例子里整段送入时 $T = 3$、$S = 3$；生成位置 3 时只算一个新查询，$T = 1$、$S = 4$，位置 0–2 的 K、V 直接从缓存读。一轮也可以同时算多个新位置（如投机解码一次验证多词），此时 $T > 1$，本轮各行之间仍按位置遮挡。多条请求合批时，每个查询只能读所属请求自己的历史，位置映射见[并发请求](concurrent-requests.md)。

## 多头：同一个位置同时按几套方式去读

**multi-head attention（多头注意力）把 Q、K、V 各切成 $h$ 段，每段叫一个 attention head（注意力头），各自独立算一遍打分、softmax 和汇合，最后把各头输出拼起来再乘一个输出矩阵。**

把例子切成两个头（$h = 2$）：q、k、v 的 4 个数按列切成两半，头 0 只用前两个数，头 1 只用后两个数。每个头的 q、k 只有 2 个数，所以缩放除以 $\sqrt{2}$。

```wiki-diagram
file: attention-heads
```

原论文将 $h$ 个头的独立注意力与末尾拼接投影写成如下关系（其中每个头的 $W_{Q,i}$、$W_{K,i}$ 形状为 $[d_{\text{model}}, d_k]$，$W_{V,i}$ 为 $[d_{\text{model}}, d_v]$，$W_O$ 为 $[h \cdot d_v, d_{\text{model}}]$；小例子取 $d_{\text{model}} = 4$、$h = 2$、$d_k = d_v = 2$，论文基础模型取 $h = 8$、$d_k = d_v = d_{\text{model}}/h = 64$）：

$$\text{MultiHead}(X) = \text{Concat}(\text{head}_1, \dots, \text{head}_h) W_O, \quad \text{head}_i = \text{Attention}(X W_{Q,i},\; X W_{K,i},\; X W_{V,i})$$

把位置 2 在两个头里的点积、$\div \sqrt{2}$ 缩放分数、保留两位小数的 softmax 权重和加权输出并列核对：

| 头编号与切分通道 | 位置 2 对 $k_0, k_1, k_2$ 的点积 | 除以 $\sqrt{2}$ 后分数 | Softmax 权重 | 本头输出向量 |
| --- | --- | --- | --- | --- |
| 头 0（前 2 个数） | $[1\times 2+2\times 1,\; 1\times 0+2\times 1,\; 1\times 1+2\times 0] = [4, 2, 1]$ | $[2.83, 1.41, 0.71]$ | $[0.73, 0.18, 0.09]$ | $0.73[1,0] + 0.18[0,1] + 0.09[1,1] = [0.82, 0.27]$ |
| 头 1（后 2 个数） | $[0\times 0+1\times 0,\; 0\times 1+1\times 0,\; 0\times 1+1\times(-1)] = [0, 0, -1]$ | $[0, 0, -0.71]$ | $[0.40, 0.40, 0.20]$ | $0.40[2,0] + 0.40[1,1] + 0.20[0,2] = [1.20, 0.80]$ |
| 拼接回全宽（对照单头） | 单头全 4 维点积为 $[4, 2, 0]$ | 单头 $\div\sqrt{4}$ 为 $[2, 1, 0]$ | 单头为 $[0.67, 0.24, 0.09]$ | 两头拼成 $[0.82, 0.27, 1.20, 0.80]$，再乘 $4\times 4$ 的 $W_O$ |

同一个位置、同一组向量，两个头读出了两种分配：头 0 把 $0.73$ 的权重给位置 0，头 1 在位置 0、1 之间平分，还给位置 2 留了 $0.20$；只用一个头时，这三个权重是 $[0.67, 0.24, 0.09]$。

为什么要拆：单头只能形成一组权重，把所有线索按一套比例平均到一起；多头让不同的投影在不同的表示子空间里各选各的位置，同一个位置可以同时按几套标准去读。每头变窄了，所以总计算量和一个全宽的单头差不多：例子里两个头各算 3 个 2 维点积，共 12 次乘法，和单头算 3 个 4 维点积一样多。每个头学成什么由输入和训练决定，并不保证对应某种能叫出名字的语义。

实现里不会真的存 $h$ 个小矩阵：把各头的 $W_{Q,i}$ 并排拼成一个 $[d_{\text{model}}, h \cdot d_k]$ 的大矩阵，一次矩阵乘算出全部头的 q，再按头切段；K、V 同理。例子里的 $4\times 4$ $W_Q$ 就可以看成两个 $[4, 2]$ 的头矩阵并排，所以「把 q 的 4 个数切成两半」和「每个头各乘自己的矩阵」是同一件事。各头之间直到输出投影之前都不交换数据，所以多卡可以按头分工，见 [tensor parallel](tensor-parallel.md#先过-attention各算自己的头再合回-hidden)。

Q 头数、KV 头数和每头宽度是分别配置的结构量。多个 Q 头共用同一组 K、V 的做法叫 [GQA](gqa.md)，它减少的是要缓存的 K、V 份数，Q 头数不变。

## 标准主干走读：Qwen3-8B 的 `32Q:8KV` GQA 与逐头 QK-Norm

在 `v0.30.0` 标准主基线下，**Qwen3-8B** 全 36 层全部使用标准分组查询注意力（GQA），是理解生产模型注意力形状的标准标尺（交互演示见[Qwen3 标准注意力演示](#/model?view=play)）。下图把单层从无偏置 Q/K/V 投影、逐头 `q_norm / k_norm` + RoPE、V 旁路直通到缩放点积与 `o_proj` 的完整流向收在一张图里：

```wiki-diagram
file: attention-qkv-fig-qwen3-gqa-qknorm
```

- **头数配比与无偏置投影**：隐藏宽度 `4096`，每层 `32` 个 Q 头、`8` 个 KV 头（`4:1` 分组共享），每头宽度 $d_h = 128$；`q_proj`、`k_proj`、`v_proj` 与 `o_proj` 均无偏置（`bias = false`）。
- **逐头 QK-Norm 与 V 旁路**：Q、K 投影后先各自做 `128` 维逐头 RMSNorm——同层内所有 Q 头共享一套 `q_norm` `[128]` 增益，所有 K 头共享另一套独立的 `k_norm` `[128]` 增益（每层共两套 128 维增益，两者互不共用，见 [Q/K Norm](mlp-residual-norm.md#qk-norm先按头归一化再加入位置)），随后再施加 [RoPE](rope.md)；V 不做归一化和旋转，直接写入 KV cache 并参与加权汇合。
- **缩放打分与回写**：单头缩放系数为 $1/\sqrt{128} \approx 0.0884$；新 K/V 写入单一 128-tok 缓存组后，`AscendAttentionBackend` 按阶段调用昇腾融合注意力算子 **FIA**（Fused Infer Attention，见 [Ascend FlashAttention](ascend-flash-attention.md)）或分页解码算子 **PA**（[PagedAttention](paged-attention.md)），开启右下三角因果掩码模式（`sparse_mode = 3`）完成打分与汇合，再经 `o_proj` 回到 `4096` 维残差流。

| Qwen3-8B 单层注意力步骤（TP=1，T 个 token） | 形状变化 | 关键设定 |
| --- | --- | --- |
| Q / K / V 无偏置投影 | `[T, 4096]` → Q `[T, 32, 128]`，K/V `[T, 8, 128]` | `32` Q 头 : `8` KV 头（`4:1` GQA） |
| 逐头 `q_norm` / `k_norm` + RoPE | Q `[T, 32, 128]`，K `[T, 8, 128]` | 先做 128 维逐头 RMSNorm，再旋转位置；V 旁路直通 |
| 缩放点积 + 因果掩码 + 汇合 | 输出 `[T, 32, 128]` → 拼接 `[T, 4096]` | 缩放 $1/\sqrt{128} \approx 0.0884$，单组 128-tok KV |
| 输出投影 `o_proj` | `[T, 4096]` → `[T, 4096]` | 无偏置，交回单残差流 |

只有当模型把长上下文压缩推向极限、同时混装线性递推层与低秩稀疏层时，注意力才会明显偏离这套标准 GQA 形态——下面转入历史 GLM 双机对照。

## 复杂异构实战对照：GLM 稀疏 MLA 与 KDA 各改了哪一步

**例外 B 历史绑定算例 GLM-5.3-Flash 的 45 层主干里有两种异构 attention：34 层 KDA、11 层稀疏 MLA，都没有照搬标准 GQA。** 模型配置列出了 MLA 所在层号：从 0 数的第 3、7、11……43 层（每 4 层里 3 层 KDA 接 1 层 MLA），主干之外的 MTP 层也是 MLA。两种层都是 64 个头，在[官方双机部署](glm-5-3-flash-two-node.md#部署前提)的 TP8 下每卡算 8 个。对应 GLM 稀疏 MLA 的模型内部分段演练，可查看[注意力打分与 softmax](#/model?view=play&segment=31)与[取回 V、合头与投影](#/model?view=play&segment=32)。

为什么要改：按这套部署允许的最长请求 133,120 个 token 算，标准的全注意力里最后一个位置在每层每个头都要给 133,120 个 k 打分、汇合 133,120 个 v；稀疏 MLA 每个查询最多只读 2,051 个挑中的位置，KDA 只读一个固定大小的状态。两个数的出处见 [KV cache 的代价一节](kv-cache.md#每步读多少稀疏-mla-只读挑中的位置)。

```wiki-diagram
file: attention-glm-paths
```

图是[主线第 4 站](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)里一层 attention 在每张卡上的先后顺序。本节只讲两条路径和标准形式差在哪；它们各自的推导在专页，R1 每一步的形状在主线的 [34 层 KDA](one-request.md#34-层-kda) 和 [11 层稀疏 MLA](one-request.md#11-层稀疏-mla) 两小节。

放到[主线示例请求 R1](one-request.md#示例请求-r1-与官方双机部署) 上，前面因果掩码一节的 $T$、$S$ 是：prefill 一次算 4 个提示词位置，$T = 4$、$S = 4$；R1 开着 MTP（模型自带的草稿层，先猜后面几个 token），它的 decode 一步验证位置 4 的真 token 和 5–7 三个草稿，$T = 4$、$S = 8$，位置 0–3 的历史从缓存读，本轮这 4 行之间仍按位置遮挡。两类层缓存的对象也不同：稀疏 MLA 存压缩后的潜向量，KDA 存固定大小的状态，下面分开讲。

### 稀疏 MLA：仍是 softmax attention，改的是存什么、读哪些

**稀疏 MLA 保留了打分、缩放、softmax 和按权重汇合这四步，也保留 causal mask；变的是历史存成什么形式、每个查询读哪些位置。**

- **存什么。** 标准多头 attention 要为每个历史位置、每个头各存一份 K 和 V。按这 11 层的配置（64 个头，每头 K、V 各 256 维），每个 token 每层要存 32,768 个数，推导见[模型页](glm-5-3-flash.md#稀疏-mla先把历史压短再挑着读)。[MLA](mla.md)（Multi-head Latent Attention）只为每个位置存一条 512 维的潜向量，各头的 K、V 需要时再从它解压。配置里的 64 个「KV 头」是计算上的逻辑头，**不代表缓存里有 64 份完整的 K/V**。
- **怎么比。** 解压 K 的矩阵被提前乘到 q 上，称为**矩阵吸收**：每头 256 维的 q 变为 512 维，直接与缓存里的潜向量做点积。解压 V 的矩阵并入输出侧，把每头 512 维结果还原为 256 维；本卡 8 个头拼成 2048 维，再经输出投影回到 4096 维（全模型 64 个头共 $64 \times 256 = 16{,}384$ 维）。吸收只改乘法顺序、不改点积值，因此缩放仍按每头 256 维算。
- **读哪些。** 一个叫索引器的小网络先给历史打分，每个查询只在它挑中的位置上做 softmax，因果范围内最多 2,051 个位置；挑选方法见[稀疏注意力](sparse-attention.md)。R1 的历史远短于这个上限（prefill 4 个位置，第一步 decode 也只有 8 个），因果范围内的位置全部被选中，结果与稠密的因果 attention 相同。
- **没有位置旋转。** 这一配置的 RoPE 维数是 0，分数里不含显式的位置项；位置信息由 KDA 的递推和短卷积携带，RoPE 本身见 [RoPE](rope.md)。

缩放系数因此按每头 256 维算，前面 √d 一节举的 $d = 256$ 正是这一层每个头的宽度：

$$d_{\text{qk}} = d_{\text{nope}} + d_{\text{rope}} = 256 + 0 = 256, \quad \text{scale} = \frac{1}{\sqrt{256}} = 0.0625$$

| 维度或参数 | 数值 | 为什么这样取 |
| --- | --- | --- |
| 每头逻辑 $q \cdot k$ 宽度 $d_{\text{qk}}$ | $256 + 0 = 256$ | 256 维不带位置旋转的 NoPE 部分，加 0 维 RoPE 部分 |
| 缓存潜向量宽度 | $512$ | 矩阵吸收后在 512 维空间做内积，但数学内积值等价于解压后的 256 维点积 |
| Softmax 缩放系数 | $1 \div \sqrt{256} = 0.0625$ | 按单头逻辑点积宽度 $256$ 归一方差，绝不按缓存里的 $512$ 维算 |

这里有两处在 TP8 下不切：512 维潜向量在每张卡上各存完整一份，供本卡 8 个头共用；索引器在每张卡上各算一遍。头投影和输出投影则按头切开，末尾一次 All-Reduce。切法见 [tensor parallel 的稀疏 MLA 一节](tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)，缓存字节见 [KV cache](kv-cache.md#混合模型到底要保留哪几类状态)。

所核对的 GLM 专用缓存路径还把完整 MLA KV cache 保持为 BF16，供 A5 上直接使用共享 KV 的算子读取。这是该路径的存储约束，不能推广为所有模型、设备或量化配置的缓存类型。

### KDA：保留 q、k、v，去掉逐位置的 softmax

**KDA（Kimi Delta Attention）同样从隐藏向量投影出 q、k、v，但不给每个历史位置打分，而是把历史累积进每头一个 $128 \times 128$ 的状态矩阵，再用 q 去读它。** 它属于 [linear attention](linear-attention.md)（线性注意力）：用固定大小的递推状态汇总历史的一类方法。

64 个头每头 128 维，所以 q、k、v 投影各把 4096 维变成 $64 \times 128 = 8192$ 维，TP8 后每卡 1024 维、8 个头。投影之后先过一个宽度为 4 的因果短卷积，只混合当前和前 3 个位置；q、k 再各自归一到长度 1。之后每来一个位置，就按带遗忘门的 delta 规则更新状态，再用 q 读出结果；读出时也乘 $1/\sqrt{128} \approx 0.0884$，但没有一排逐位置的分数，也就没有沿位置的 softmax。更新规则和图解见 [KDA 专页](linear-attention.md)。

这一设计带来三条直接后果：

- **显存与长度解耦**：KDA 层不按位置存 K、V，每条请求只占固定大小的状态，不随长度增长（大小见 [KV cache](kv-cache.md#混合模型到底要保留哪几类状态)）。
- **prefill 与 decode 等价**：prefill 把一段位置分块并行推进状态，decode 逐个推进，两者数学上等价。
- **不能见 q/k/v 就断定是 softmax**：KDA 也显式算 q、k、v，同时还计算写入强度和门控来控制状态更新。TP8 下每卡维护自己 8 个头的状态、不跨卡交换，整层只在输出投影后归约一次（见 [tensor parallel 的 KDA 一节](tensor-parallel.md#kda状态跟着头一起切)）。

### 三种形式对照

| 对比维度 | 标准因果 attention | GLM 稀疏 MLA | GLM KDA |
|---|---|---|---|
| 历史存成什么 | 每位置、每个 KV 头的 K 和 V | 每位置一条 512 维潜向量，另有索引器摘要 | 每头一个 $128 \times 128$ 状态，加短卷积的最近几步 |
| 每个查询读多少 | 全部可见位置 | 挑中的位置，最多 2,051 个 | 固定大小的状态 |
| 有没有逐位置 softmax | 有，对全部可见位置 | 有，只对挑中的位置 | 没有 |
| 缩放系数 | $1/\sqrt{d_k}$ | $1/\sqrt{256} = 0.0625$ | $1/\sqrt{128} \approx 0.0884$ |

两类层最后都回到同一个出口：本卡 8 个头的结果经输出投影得到 $[T, 4096]$ 的部分和，TP8 All-Reduce 相加后写回残差流。R1 每次归约的张量是 32,768 B，整次前向的通信账在[主线第 4 站](one-request.md#一次前向的通信账)。本页没有设备上的 attention 耗时实测。

## 常见误解

下图先把五组最容易踩坑的直觉误区与论文及源码判据放在一起对照，再逐条拆解九项常见误读：

```wiki-diagram
file: attn-qkv-fig-myths
```

- **「Q、K、V 是输入里本来就有的三份数据。」** 它们是同一份隐藏向量乘三个学到的矩阵得到的，每层各有一套矩阵。
- **「权重最大的位置就是模型『理解』的依据，每个头对应一种语法功能。」** 权重只说明这一次汇合里各位置的 v 占多少，头学成什么由训练决定，不保证能叫出名字。
- **「除以 √d 只是可有可无的归一化。」** 缩放系数是模型定义的一部分，训练和推理必须一致。GLM 稀疏 MLA 用 $1/\sqrt{256}$，按每头 $q \cdot k$ 的宽度算，不按缓存里的 512 维算。
- **「causal mask 只在逐个生成时需要，prefill 可以看全文。」** prefill 同样要遮住未来位置，否则同一位置在整段送入和逐个生成时结果不同。
- **「decode 每步要把历史位置的 Q、K、V 都重算一遍。」** 只为新位置算 q、k、v；历史 K、V 从缓存读，历史的 q 已经用不上。
- **「attention 里的 softmax 和采样时的 softmax 是一回事。」** 公式相同，前者在位置上分配读取比例，后者在词表上给出下一个 token 的概率。
- **「64 个查询头，缓存里就存了 64 份 K/V。」** GLM 稀疏 MLA 的 64 个是逻辑头，每个位置只缓存一条 512 维潜向量；KDA 更是不按位置缓存。
- **「看到 q、k、v 投影，这一层就是 softmax attention。」** KDA 也显式算 q、k、v，后面走的是状态更新，没有逐位置 softmax。
- **「稀疏 MLA 对 R1 也只读了一部分历史。」** R1 的历史只有几个位置，全部在选中范围内；2,051 的上限要到长历史才起作用。

沿请求继续看[主线第 4 站](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)；看查询头分组共享 K/V 读 [GQA](gqa.md)；看整段提示词并行计算读 [prefill](prefill.md)；看历史存多大读 [KV cache](kv-cache.md)；看片上分块融合执行读 [Ascend FlashAttention](ascend-flash-attention.md)；想看两类 GLM attention 的推导读 [MLA](mla.md) 和 [KDA](linear-attention.md)。

## 对照源码

### 怎么开

attention 随模型前向执行，没有单独的开关；用哪种 attention、多少个头、缩放系数取多少，都由模型代码按模型配置决定。历史双机案例的启动命令统一见[部署前提](glm-5-3-flash-two-node.md#部署前提)。

**vLLM 的通用 attention 层。** 标准模型在构造时创建 `Attention(num_heads, head_size, scale, num_kv_heads, …)`：头数、每头宽度和缩放系数都由模型显式传入，框架不替模型算 $\sqrt{d}$；类说明写明它先把输入的 K、V 存进 KV cache，再做多头、多查询或分组查询 attention。`attn_type` 默认是 `AttentionType.DECODER`，即解码器里对上一层 Q/K/V 做的 self-attention（见来源 3–9）[C6]。

**GLM 按层号选路径。** 在历史绑定镜像 `db701c1f`（配套 `vllm@0fc695fc`）中，解码器层用 `_is_kda_layer` 查配置里的 KDA 层名单：命中就构造上游的 `KimiGatedDeltaNetAttention`（Ascend 通过 `REGISTERED_ASCEND_OPS` 替换成 `AscendKimiGatedDeltaNetAttention` 执行），否则构造 `AscendGlm5NextMLAAttention`，并由 `IndexerKPoolMLACacheLayer` 登记潜向量缓存和两份索引器缓存（来源 25、26、32）[C25]。在 `v0.30.0`（`c09d3e20`）与 `main`（`8d6180e2`）中，GLM 专用实现拆分为 `vllm_ascend/models/glm5next/` 子包，按层号分流到 `Glm5NextLinearAttention` 或 `Glm5NextMLAAttention`[C14][C22]。

**两个缩放系数怎样来。** MLA 构造时取 `qk_head_dim = qk_nope_head_dim + qk_rope_head_dim = 256`，`scaling = qk_head_dim ** -0.5`；只有 RoPE 维数大于 0 时才会建 `rotary_emb` 并可能按 YaRN `mscale` 修正缩放，本配置 `qk_rope_head_dim = 0`，`rotary_emb = None`[C16]。稀疏 attention 调用 `npu_sparse_flash_attention` 时以 `scale_value` 传入缩放、以 `sparse_indices=topk_indices` 传入挑中位置，返回后再做 `_v_up_proj` 和 `o_proj`（来源 19、28–30）[C19]。KDA 在 `db701c1f` 经 `q_proj`、`k_proj`、`v_proj` 投影后调 `recurrent_kda` / `chunk_kda_fwd` 并传 `head_dim**-0.5`[C27]；在 `v0.30.0` 与 `main` 则把 `q, k, v, b, f_a, g_a` 六个投影合并进 `in_proj_qkvbfg_a` 单次 GEMM，并在 `run_recurrent_kda` 内传入 `scale=q.shape[-1] ** -0.5`[C17][C18]。

### 会报什么错

| 条件 | 报错或检查点 | 本模型上怎样判断 |
| --- | --- | --- |
| MLA 头数不能被 TP 整除 | `assert num_heads % tp_size == 0` | 64 个头，TP 取 64 的约数才能过 |
| KDA 头数不能被 TP 整除 / 规格越界 | `assert self.num_heads % self.tp_size == 0`；`v0.30.0` 另校验 `GLM AscendC KDA requires BF16 activations and head_dim=128.` | KDA 自己的 64 个头与 128 维 BF16 约束 |
| 稀疏 attention 的掩码模式不对 | `ValueError: Indexer KPool MLA only supports sparse_mode=3, got ...`（`db701c1f`） | 入口默认值就是 `3`（右下对齐的因果掩码），调用方改传其他值才会触发 |

MLA 与 KDA 的整除断言分别在各自的构造函数里（来源 16、17、25、33）。`sparse_mode=3` 是右下对齐的因果掩码：本轮 $T$ 个查询对齐到 $S$ 个键的最后 $T$ 个位置，第 $r$ 行（从 0 数）只能看到键 $0$ 到 $S - T + r$；昇腾通用后端 `attention_v1.py` 在四版中统一把滑窗映射成 `4`、因果映射成 `3`、不加掩码映射成 `0`（来源 10、11、13、34）[C13]。上下文并行（DCP）路径在索引器完成因果筛选并经 `_remap_sparse_indices` 重映射坐标后改传 `sparse_mode=0`，关闭二次裁剪并不等于放开未来位置访问[C20][C31][!]。更多 TP 整除断言见 [tensor parallel 的报错表](tensor-parallel.md#会报什么错)。以上检查点未在 NPU 上故意触发。

### 开销和什么时候别开

attention 不能关：去掉它，模型就不再是同一个模型。能改变开销的是输入规模和结构：标准 attention 的 prefill 计算量随「本轮查询数 × 可见位置数」增长，decode 每步要读一遍全部可见的 K、V。GLM 的稀疏 MLA 把每个查询读取的位置限制在 2,051 个以内，但索引器仍要扫过全部压池后的摘要；KDA 每步只读写固定大小的状态。各类缓存每 token 占多少、能切出多少块，见 [KV cache](kv-cache.md#省了重算要付什么代价) 和[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)；不同结构的代价对照见[四种注意力的代价](attention-cost.md)。

### 版本差异

**四个社区版本与历史专用镜像都不改变 QK 打分、$1/\sqrt{d_k}$ 缩放、因果可见范围与加权汇合的数学关系；差异集中在文件组织、投影合并与并行扩展。** 下表对照四版社区基线（`v0.23.0`：`0fc695fc / 2c59ff10`；`v0.26.0rc`：`568afb3a / 2ed6cbba`；`v0.30.0`：`ced6857a / c09d3e20`；`main`：`ba15685a / 8d6180e2`），本页 GLM 绑定算例按例外 B 固定镜像 `db701c1f + 0fc695fc` 核对：

| 检查项 | `v0.23.0` (`0fc695fc` / `2c59ff10`) | `v0.26.0rc` (`568afb3a` / `2ed6cbba`) | `v0.30.0` (`ced6857a` / `c09d3e20`) | `main` (`ba15685a` / `8d6180e2`) |
| --- | --- | --- | --- | --- |
| 上游通用 `Attention` 类 | `scale` 由模型传入，`attn_type` 默认 `DECODER`（来源 3、4） | 同路径保留 `scale` 与 `DECODER` 默认，增 `mm_prefix_clamp_sliding_window`（来源 5） | 同上，保留 `head_size_v` 与 KV cache 写入说明（来源 6、7） | 同上，新增 `query_pre_quantized: bool = False` 入参[C8] |
| 昇腾通用后端 `sparse_mode` | `attention_v1.py` 按滑窗 `4` / 因果 `3` / 无掩码 `0` 映射（来源 10） | 同一映射逻辑（来源 11） | 同一映射并接入 FIA 任务注册（来源 13） | 抽出 `_get_fia_mask_params`，`4/3/0` 语义不变 |
| GLM 专用模型与选层入口 | 分支无 `glm5next`；专用镜像 `db701c1f` 在 `models/glm5_next.py` 用 `_is_kda_layer` 分流 | 有 `ops/kimi_kda.py`（`scale=self.head_dim**-0.5`，来源 12），无 `glm5next` 模型目录 | 拆为 `models/glm5next/`，`model.py` 调 `config.is_kda_layer(layer_idx)` 选 KDA 或 MLA | `model.py` 用 `_is_kda_layer` 查 `layer_types == "linear_attention"` 且排除 `is_mtp_layer`（来源 21、22） |
| GLM MLA 缩放与投影融合 | 镜像 `db701c1f` 取 `qk_head_dim ** -0.5`，`RoPE=0` 时 `rotary_emb=None` | 无 GLM 模型文件可比 | `Glm5NextMLAAttention` 用同一公式；加载映射把 `q_a_proj` 与 `kv_a_proj_with_mqa` 合入 `fused_qkv_a_proj`[C15] | 入参类型细化为 `Glm5NextTextConfig`，缩放、YaRN 分支与 `fused_qkv_a_proj` 保持一致（来源 23） |
| GLM KDA 投影与算子调用 | 镜像 `db701c1f` 分设 `q/k/v_proj`，调 `recurrent_kda` / `chunk_kda_fwd` | `ops/kimi_kda.py` 保持 `head_dim**-0.5` | `Glm5NextLinearAttention` 将 `q,k,v,b,f_a,g_a` 合为 `in_proj_qkvbfg_a` 单次 GEMM，`ops/kda.py` 传 `q.shape[-1]**-0.5` | 保持六合一 GEMM 与缩放，新增 PCP 输入投影 `KDAInputProjectionTP` 与 RecoverSSM 支持（来源 24） |

因此，数学上逻辑投影有几份与代码里实际发起几次 GEMM 不能混同，GLM NoPE（`qk_rope_head_dim = 0`）下的裸缩放也不能直接套到带 YaRN `mscale` 的其他 MLA 模型上[!]。头切分与低秩投影合并的并行细节见 [tensor parallel 的版本差异](tensor-parallel.md#版本差异)[D]。

### 源码位置

| 入口 | 对照什么 | 说明了什么 |
| --- | --- | --- |
| `vllm` `attention.py`（`ced6857a` 225–258 行；`0fc695fc` 177–210 行） | `Attention` 构造参数与类说明 | 头数、宽度、`scale` 由模型给；K、V 进缓存后做 attention |
| `glm5next/model.py`（`c09d3e20` 291–315、717–735 行）与 `db701c1f` `glm5_next.py` 2075–2105 行 | 按层号构造 KDA 或 MLA，以及低秩/六合一加载映射 | 两类 attention 的分岔点与融合权重映射 |
| `glm5next/attention.py`（`c09d3e20` 140–258 行）与 `db701c1f` `glm5_next.py` 1881–2030 行 | MLA 头数、`scaling`、RoPE 分支与整除断言 | 缩放按 256 维算，本配置不建位置旋转 |
| `db701c1f` `ops/indexer_kpool_mla.py` 39–182 行 | 缓存层、实现对象与三份缓存（含 `kv_cache_dtype = "bfloat16"`） | 不走通用 MLA 层，缩放传入实现 |
| `device_op.py`（`c09d3e20` 529–577 行；`db701c1f` 719–793 行）与 `sfa_v1.py` | `npu_sparse_flash_attention` 调用及其后的 `_v_up_proj`、`o_proj` | softmax 只在索引器挑中的位置上做，默认 `sparse_mode=3` |
| `glm5next/kda.py` + `ops/kda.py`（`c09d3e20`）与 `db701c1f` `ops/kimi_kda.py` | KDA 投影、decode 递推与 prefill 分块 | KDA 也算 q、k、v，缩放 $1/\sqrt{128}$，没有逐位置 softmax |

**来源与结论对应：**

- 缩放点积公式、除以 $\sqrt{d_k}$ 的独立同分布方差论证、多头公式与 $h = 8, d_k = 64$、解码器用 $-\infty$ 屏蔽非法连接、self-attention 的 Q/K/V 来自上一层同一输出，对照原论文第 3.1、3.2、4 节[S1]。
- GLM-5.3-Flash 的 64 个 attention 头、每头 $q \cdot k$ 256 维与 $v$ 256 维、RoPE 维数 0、潜向量 512 维、64 个逻辑 KV 头、KDA 64 头 × 128 维与短卷积宽度 4、MLA 所在层号，来自固定模型配置；一致性记录见[来源基线](../sources/glm-5-3-flash-baseline.md)[S2]。
- 通用 `Attention` 层构造参数与 `DECODER` 默认见来源 3–9；昇腾通用后端 `sparse_mode` 映射见来源 10、11、13、34；DCP 重映射后改传 `sparse_mode=0` 见来源 20、31；历史专用缓存层设置 `self.kv_cache_dtype = "bfloat16"` 供 A5 shared-KV 读取见来源 26 的 74–76 行[C26][C28]。
- 手算小例子的隐藏向量、点积与 $v$ 为教学假设[A]；$e^{16} \approx 8{,}886{,}111$、$1/\sqrt{128} \approx 0.0884$ 及跨四版文件存在性对照为本页静态推导与 `git ls-tree` 检索结果[A][D][D]。32,768 个数、2,051 个位置、133,120 个 token 与 R1 的 32,768 B 引用正文链接的主线与专页。

**待核：** 没有固定双机的 attention 设备 trace，缺算子耗时、HBM 读写量与稀疏 attention 的实际分块；R1 decode 时本轮 4 行之间按位置遮挡，与 `sparse_mode=3` 的右下对齐因果掩码一致（语义取自通用后端因果→3 映射与上下文并行注释），稀疏 attention 内核内部的掩码实现未审；各社区分支整模型运行本双机配置的端到端兼容性未做硬件实测。
