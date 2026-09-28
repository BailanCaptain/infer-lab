---
id: attention-qkv
title: "Attention 与 Q/K/V：当前位置怎样从历史里取信息"
type: concept
summary: attention 让当前位置用查询 q 给自己和此前每个位置的键 k 打分，softmax 换成权重后把各位置的值 v 加权汇合。本页对照原论文讲清 Q/K/V 从哪来、为什么除以 √d、多头和 causal mask，再看 GLM 的稀疏 MLA 与 KDA 各改了哪一步。
aliases: [注意力, attention, 自注意力, self-attention, "Q、K、V", QKV, Query/Key/Value, 查询, 键, 值, 注意力分数, attention score, softmax, 归一化指数, 缩放点积注意力, scaled dot-product attention, attention head, 因果掩码, causal mask, 头维度, head dim, head_size, attention scale]
chapters: ["04"]
order: 60
sources:
  - https://arxiv.org/html/1706.03762v7
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L177-L210
  - vllm@0fc695fc:vllm/v1/attention/backend.py#L32-L44
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2075-L2105
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1881-L2030
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L39-L182
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L291
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L366-L472
  - vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028
  - vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L111-L117
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L140-L175
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L292-L306
  - vllm@568afb3a:vllm/model_executor/layers/attention/attention.py#L223-L256
  - vllm@84030bbe:vllm/model_executor/layers/attention/attention.py#L225-L258
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L576-L592
  - vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L836-L836
  - vllm-ascend@db701c1f:vllm_ascend/attention/context_parallel/sfa_cp.py#L1303-L1307
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: layers-and-hidden, kind: builds-on, note: 隐藏向量是 attention 的输入，本页展开位置之间怎样交换信息}
  - {to: matmul-and-weights, kind: builds-on, note: Q/K/V 投影、点积打分和输出投影都是矩阵乘}
  - {to: one-request, kind: builds-on, note: 本页的计算发生在主线第 4 站逐层前向，R1 每站形状在主线页}
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 当前位置怎样从历史里取信息

**attention（注意力）让当前位置提出一个查询 q，拿它和自己及此前每个位置的键 k 逐一打分，把分数换成加起来等于 1 的权重，再按权重把这些位置的值 v 加成一条新向量。** q、k、v 都由这一层的隐藏向量（每个位置在层与层之间传递的那条向量，见[层与隐藏表示](layers-and-hidden.md)）分别乘三个学到的权重矩阵得到。

```wiki-diagram
file: attention-qkv-flow
```

图里的当前位置是 2。① q₂ 分别和 k₀、k₁、k₂ 做点积，也就是对应维相乘再求和，点积越大表示越对得上；② 点积除以 √d 得到分数，d 是 q、k 的维数，原因后面单独讲；③ softmax 把这一排分数换成非负、加起来等于 1 的权重；④⑤ 每个位置的 v 乘上自己的权重再相加，得到位置 2 的输出 o₂。k 只决定读谁、读多少，v 才是被读走的内容，所以两者分开。

在标准 Transformer 的一层里，[前馈网络（MLP）](mlp-residual-norm.md)对每个位置各算各的，位置之间不交换信息；attention 是层里让一个位置读到其他位置的那一步。它的输出再经输出投影回到隐藏宽度，交给残差连接。沿主线看，这一步发生在[一条请求的第 4 站：逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)，每一层都做一次。

## 为什么需要它，代价在哪

**要预测下一个 token，最后一个位置必须用上前文；attention 让它按内容决定从哪些位置取多少。** 权重不是固定的：同一层参数下，换一段输入，q 和 k 就变了，权重也跟着变。没有这一步，每个位置的表示只取决于自己那个 token。

代价来自「每个查询都要看一遍全部可见位置」：

- **计算随长度平方增长。** 一次处理 T 个提示词位置时，每个头要算约 T²/2 个点积，每个点积之后还有一次加权。
- **历史要一直留着。** 生成新 token 时，新位置的 q 仍要和全部历史的 k、v 打交道；为免每步重算，历史的 K、V 存进 [KV cache](kv-cache.md)，占用随长度线性增长，每步还要把它们读一遍。

按这套部署允许的最长请求 133,120 个 token 算，标准的全注意力里最后一个位置在每层每个头都要给 133,120 个 k 打分、汇合 133,120 个 v。GLM-5.3-Flash 因此换掉了标准形式：稀疏 MLA 每个查询最多只读 2,051 个挑中的位置，KDA 只读一个固定大小的状态。两个数的出处见 [KV cache 的代价一节](kv-cache.md#省了重算要付什么代价)，后文分别讲它们改了哪一步。

几个相邻概念各管一件事：

| 概念 | 管什么 |
|---|---|
| attention | 本步每个查询位置从可见位置读信息的计算 |
| KV cache | 把历史位置的 K、V（或它们的压缩形式）存下来，供之后的查询读 |
| MLP | 对每个位置单独变换，不跨位置 |
| 采样前的 softmax | 在词表上把 logits 换成下一个 token 的概率，作用对象是词，不是位置 |

## Q、K、V 从哪里来，各管什么

**Q、K、V 不是输入里现成的三份数据，而是同一份隐藏向量乘三个不同权重矩阵的结果。** 把一层的输入写成矩阵 X，每行是一个位置的隐藏向量：

```text
Q = X · W_Q      K = X · W_K      V = X · W_V
```

每一行仍对应一个位置：第 i 行 qᵢ 是位置 i 的查询，kᵢ、vᵢ 是它的键和值。一行向量乘权重矩阵怎样得到一行输出，见[矩阵乘和权重](matmul-and-weights.md)。《Attention Is All You Need》里的 self-attention（自注意力）三者都来自上一层的同一份输出；原论文的编码器—解码器结构另有一种 Q 来自解码器、K/V 来自编码器的注意力。GLM 这类只有解码器的模型只用前一种，而且带 causal mask（因果掩码，后文讲）。

| 表示 | 在计算里做什么 | 宽度 |
|---|---|---|
| Q（query，查询） | 当前位置拿去和可见位置比对 | d_k，必须与 K 相同才能做点积 |
| K（key，键） | 被查询比对，决定这个位置分到多少权重 | d_k |
| V（value，值） | 按权重被加起来，成为输出的内容 | d_v，可以与 d_k 不同 |

K 和 V 用两套矩阵，评分空间和内容空间就能分开学：一个位置凭什么被选中，和被选中后交出什么，可以是两回事。每层都有自己的三套权重；经过前面几层之后，一个位置的隐藏向量已经混进了上下文，下一层的 Q、K、V 就从这份带上下文的向量算出来。

## 一个查询怎样得到输出

**一个查询位置 i 的输出，是各可见位置 v 的加权和；权重由 qᵢ 与各位置 k 的缩放点积经 softmax 得到。** 论文把整批写成 softmax(QKᵀ/√d_k)·V，拆到单个查询位置 i 和键位置 j 上是三步：

```text
s_ij = (q_i · k_j) / √d_k + m_ij        打分
a_ij = exp(s_ij) / Σ_l exp(s_il)        softmax，沿键位置 j 归一化
o_i  = Σ_j a_ij · v_j                   按权重汇合 V
```

m_ij 是掩码项：允许访问的位置取 0，被屏蔽的位置取负无穷，下一节细讲。softmax 沿键位置归一化，所以一个查询位置的全部权重加起来等于 1。它和采样前在词表上做的 softmax 公式相同，作用对象不同：这里分配的是「读哪个位置多少」，那里分配的是「下一个 token 取哪个词」。

把首图换成手算的小数字，走一遍位置 2：

```calc
title: 首图位置 2 的一次手算
分数 s = [ln 2, 0, 0]
取指数 = [e^(ln 2), e⁰, e⁰] = [2, 1, 1]
权重 a = [2, 1, 1] ÷ (2 + 1 + 1) = [0.5, 0.25, 0.25]
输出 o₂ = 0.5 × [2, 0] + 0.25 × [0, 2] + 0.25 × [2, 2] = [1.5, 1]
> 分数和 v₀、v₁、v₂ 都是为演示挑的小数字，不是模型运行结果
```

权重只控制各个 v 贡献多少，输出仍是一条和 v 同宽的向量。实际计算时，softmax 通常先把一行分数都减去这一行的最大值再取指数，结果不变，却能避免对大正数直接取指数而溢出。公式描述的是数学关系：中间那张「查询数 × 键数」的分数表是否真的写进显存，由具体的 attention 内核决定，融合内核可以分块边算边汇合。

## 为什么要除以 √d

**点积的波动幅度随维数 d 增长，约为 √d；除以 √d 把分数拉回同一量级，softmax 才不会一边倒。** 论文的理由是：假设 q、k 的每一维都是均值 0、方差 1 的独立随机数，点积 q·k 是 d 项乘积之和，均值仍是 0，方差却是 d，标准差是 √d。

维数越大，一排分数之间的差距就越大。softmax 对差距是按指数放大的：分数一旦拉开，几乎全部权重都落到最大的那一项上，其余位置接近 0。论文指出，这时 softmax 处在梯度极小的区域，训练很难往前推。除以 √d 之后，无论每头多宽，分数的方差都回到 1 左右。下面以每头 256 维为例，GLM 稀疏 MLA 的每头正是这个宽度：

```calc
title: d = 256 时，缩放前后两个分数的权重比
点积标准差 = √256 = 16
不缩放、分数相差一个标准差时的权重比 = e¹⁶ ≈ 8,886,111
除以 16 后的权重比 = e¹ ≈ 2.72
```

缩放系数是模型定义的一部分：模型按它训练，推理也必须用同一个值，改了它输出就变了。它的 d 指每个头里 q、k 做点积的宽度 d_k，不是隐藏宽度，也不一定是缓存里存的宽度；GLM 的两类 attention 分别用多少，放在后面的 GLM 一节。

## 因果掩码限定每个位置能访问的历史

**causal mask（因果掩码）让位置 i 只能读位置 0…i，模型据此预测位置 i+1；做法是在 softmax 之前把未来位置的分数设成负无穷。** e 的负无穷次方是 0，这些位置的权重就恰好为 0，这正是原论文在解码器里用的办法：把非法连接对应的 softmax 输入设为 −∞。

它不只用在逐个生成的阶段。提示词一次性整段送进模型时，位置 1 也不能偷看位置 2，否则同一个位置在「整段送入」和「逐个生成」时会算出不同的结果。沿用首图的手算：如果位置 3 也在同一批里，位置 2 给它的分数就是 −∞，分数变成 [ln 2, 0, 0, −∞]，权重仍是 [0.5, 0.25, 0.25, 0]。

```wiki-diagram
file: attention-causal
```

左图用[主线示例请求 R1](one-request.md#示例请求-r1-与官方双机部署) 的四个提示词位置：prefill（第一次处理提示词）同时计算位置 0–3，每行有自己的可见范围，最后一行能看到全部四个输入。右图是之后把生成的 token 放到位置 4：普通 decode（接着历史逐步生成）只新增一个查询位置，它读取此前各位置的 K、V，再加上位置 4 自己的一份。

**decode 时只为新位置算 q、k、v；历史的 K、V 从 [KV cache](kv-cache.md) 读，不重算。** 此前位置的 q 在算完自己的输出后就用不上了，后面的位置各用自己的新 q；而它们的 k、v 每一步都还要被读，所以缓存只存 K、V，不存 Q。因为 causal mask 保证后来的 token 改不了旧位置的 K、V，读缓存和每步重算得到的是同一组数。GLM 的两类 attention 缓存的对象不同：稀疏 MLA 存压缩后的潜向量，KDA 存固定大小的状态，后文分开讲。

**本轮查询数和可见历史长度是两个维度。** 对单个头，可以写成 Q [T, d_k]、K [S, d_k]、V [S, d_v]、分数表 [T, S]、输出 [T, d_v]：T 是这一轮新算的查询位置数，S 是包括本轮在内的可见键位置数。R1 的 prefill 是 T = 4、S = 4；R1 开着 MTP（模型自带的草稿层，先猜后面几个 token），它的 decode 一步验证位置 4 的真 token 和 5–7 三个草稿，T = 4、S = 8，位置 0–3 的历史从缓存读，本轮这 4 行之间仍按位置遮挡。多条请求合批时，每个查询也只能读所属请求自己的历史，位置怎样映射见[并发请求](concurrent-requests.md)。

## 多头：同一个位置同时按几套方式去读

**multi-head attention（多头注意力）把 Q、K、V 各切成 h 段，每段叫一个 attention head（注意力头），各自独立算一遍打分、softmax 和汇合，最后把各头输出拼起来再乘一个输出矩阵。** 原论文写成：

```text
MultiHead(X) = Concat(head_1, …, head_h) · W_O
head_i       = Attention(X·W_Q,i , X·W_K,i , X·W_V,i)
```

其中每个头的 W_Q,i、W_K,i 是 [d_model, d_k]，W_V,i 是 [d_model, d_v]，W_O 是 [h·d_v, d_model]，d_model 是隐藏宽度。论文的基础模型取 h = 8、d_k = d_v = d_model / h = 64。

为什么要拆：单头只能形成一组权重，把所有线索按一套比例平均到一起；多头让不同的投影在不同的表示子空间里各选各的位置，同一个位置可以同时按几套标准去读。每头变窄了，所以总计算量和一个全宽的单头差不多。每个头学成什么由输入和训练决定，并不保证对应某种能叫出名字的语义。

```wiki-diagram
file: attention-heads
```

实现里不会真的存 h 个小矩阵：把各头的 W_Q,i 并排拼成一个 [d_model, h·d_k] 的大矩阵，一次矩阵乘算出全部头的 q，再按头切段；K、V 同理。各头之间直到输出投影之前都不交换数据，所以多卡可以按头分工，见 [tensor parallel](tensor-parallel.md#先过-attention各算自己的头再合回-hidden)。

Q 头数、KV 头数和每头宽度是分别配置的结构量。多个 Q 头共用同一组 K、V 的做法叫 [GQA](gqa.md)，它减少的是要缓存的 K、V 份数，Q 头数不变。

## 落到 GLM 双机：两类 attention 各改了哪一步

**GLM-5.3-Flash 的 45 层主干里有两种 attention：34 层 KDA、11 层稀疏 MLA，都没有照搬上面的标准形式。** 模型配置列出了 MLA 所在的层号：从 0 数的第 3、7、11……43 层，也就是每 4 层里 3 层 KDA 接 1 层 MLA；主干之外的 MTP 层也是 MLA。两种层都是 64 个头，在[官方双机部署](glm-5-3-flash-two-node.md#部署前提)的 TP8 下每卡算 8 个。

```wiki-diagram
file: attention-glm-paths
```

图是[主线第 4 站](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)里一层 attention 在每张卡上的先后顺序。本节只讲两条路径和标准形式差在哪；它们各自的推导在专页，R1 每一步的形状在主线的 [34 层 KDA](one-request.md#34-层-kda) 和 [11 层稀疏 MLA](one-request.md#11-层稀疏-mla) 两小节。

### 稀疏 MLA：仍是 softmax attention，改的是存什么、读哪些

**稀疏 MLA 保留了打分、缩放、softmax 和按权重汇合这四步，也保留 causal mask；变的是历史存成什么形式、每个查询读哪些位置。**

- **存什么。** 标准多头 attention 要为每个历史位置、每个头各存一份 K 和 V。按这 11 层的配置（64 个头，每头 K、V 各 256 维），每个 token 每层要存 32,768 个数，推导见[模型页](glm-5-3-flash.md#稀疏-mla先把历史压短再挑着读)。[MLA](mla.md)（Multi-head Latent Attention）只为每个位置存一条 512 维的潜向量，各头的 K、V 需要时再从它解压。配置里的 64 个「KV 头」是计算上的逻辑头，**不代表缓存里有 64 份完整的 K/V**。
- **怎么比。** 解压 K 的矩阵被提前乘到 q 上，这叫矩阵吸收：每头 256 维的 q 变成 512 维，直接和缓存里的潜向量做点积；解压 V 的矩阵并进输出一侧，把每头 512 维结果还原成 256 维，本卡 8 个头拼成 2048 维，再经输出投影回到 4096 维；全模型 64 个头合起来是 64 × 256 = 16,384 维。吸收只改变乘法顺序，点积的值不变，所以缩放仍按每头 256 维算。
- **读哪些。** 一个叫索引器的小网络先给历史打分，每个查询只在它挑中的位置上做 softmax，因果范围内最多 2,051 个位置；挑选方法见[稀疏注意力](sparse-attention.md)。R1 的历史远短于这个上限（prefill 4 个位置，第一步 decode 也只有 8 个），因果范围内的位置全部被选中，结果与稠密的因果 attention 相同。
- **没有位置旋转。** 这一配置的 RoPE 维数是 0，分数里不含显式的位置项；位置信息由 KDA 的递推和短卷积携带，RoPE 本身见 [RoPE](rope.md)。

```calc
title: 稀疏 MLA 的缩放系数
每头 q·k 宽度 = 256 + 0 = 256
> 256 维不带位置旋转的部分，加 0 维 RoPE 部分；不是缓存里的 512 维
缩放系数 = 1 ÷ √256 = 0.0625
```

这里有两处在 TP8 下不切：512 维潜向量在每张卡上各存完整一份，供本卡 8 个头共用；索引器在每张卡上各算一遍。头投影和输出投影则按头切开，末尾一次 All-Reduce。切法见 [tensor parallel 的稀疏 MLA 一节](tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)，缓存字节见 [KV cache](kv-cache.md#混合模型到底要保留哪几类状态)。

### KDA：保留 q、k、v，去掉逐位置的 softmax

**KDA（Kimi Delta Attention）同样从隐藏向量投影出 q、k、v，但不给每个历史位置打分，而是把历史累积进每头一个 128 × 128 的状态矩阵，再用 q 去读它。** 它属于 [linear attention](linear-attention.md)（线性注意力）：用固定大小的递推状态汇总历史的一类方法。

64 个头每头 128 维，所以 q、k、v 投影各把 4096 维变成 64 × 128 = 8192 维，TP8 后每卡 1024 维、8 个头。投影之后先过一个宽度为 4 的因果短卷积，只混合当前和前 3 个位置；q、k 再各自归一到长度 1。之后每来一个位置，就按带遗忘门的 delta 规则更新状态，再用 q 读出结果；读出时也乘 1/√128 ≈ 0.0884，但没有一排逐位置的分数，也就没有沿位置的 softmax。更新规则和图解见 [KDA 专页](linear-attention.md)。

后果有三条。第一，KDA 层不按位置存 K、V，每条请求只占固定大小的状态，长度增长时不变，状态多大见 [KV cache](kv-cache.md#混合模型到底要保留哪几类状态)。第二，prefill 把一段位置分块并行地推进状态，decode 逐个推进，两者数学上等价。第三，读代码时看到 q、k、v 投影，不能断定这一层是 softmax attention：KDA 也显式算 q、k、v，另外还算写入强度和门控这些控制状态更新的量。TP8 下每卡保存、更新自己 8 个头的状态，不跨卡交换，整层只在输出投影后归约一次，见 [tensor parallel 的 KDA 一节](tensor-parallel.md#kda状态跟着头一起切)。

### 三种形式对照

| | 标准因果 attention | GLM 稀疏 MLA | GLM KDA |
|---|---|---|---|
| 历史存成什么 | 每位置、每个 KV 头的 K 和 V | 每位置一条 512 维潜向量，另有索引器摘要 | 每头一个 128 × 128 状态，加短卷积的最近几步 |
| 每个查询读多少 | 全部可见位置 | 挑中的位置，最多 2,051 个 | 固定大小的状态 |
| 有没有逐位置 softmax | 有，对全部可见位置 | 有，只对挑中的位置 | 没有 |
| 缩放系数 | 1/√d_k | 1/√256 = 0.0625 | 1/√128 ≈ 0.0884 |

两类层最后都回到同一个出口：本卡 8 个头的结果经输出投影得到 [T, 4096] 的部分和，TP8 All-Reduce 相加后写回残差流。R1 每次归约的张量是 32,768 B，整次前向的通信账在[主线第 4 站](one-request.md#一次前向的通信账)。本页没有设备上的 attention 耗时实测。

## 常见误解

- **「Q、K、V 是输入里本来就有的三份数据。」** 它们是同一份隐藏向量乘三个学到的矩阵得到的，每层各有一套矩阵。
- **「权重最大的位置就是模型『理解』的依据，每个头对应一种语法功能。」** 权重只说明这一次汇合里各位置的 v 占多少，头学成什么由训练决定，不保证能叫出名字。
- **「除以 √d 只是可有可无的归一化。」** 缩放系数是模型定义的一部分，训练和推理必须一致。GLM 稀疏 MLA 用 1/√256，按每头 q·k 的宽度算，不按缓存里的 512 维算。
- **「causal mask 只在逐个生成时需要，prefill 可以看全文。」** prefill 同样要遮住未来位置，否则同一位置在整段送入和逐个生成时结果不同。
- **「decode 每步要把历史位置的 Q、K、V 都重算一遍。」** 只为新位置算 q、k、v；历史 K、V 从缓存读，历史的 q 已经用不上。
- **「attention 里的 softmax 和采样时的 softmax 是一回事。」** 公式相同，前者在位置上分配读取比例，后者在词表上给出下一个 token 的概率。
- **「64 个查询头，缓存里就存了 64 份 K/V。」** GLM 稀疏 MLA 的 64 个是逻辑头，每个位置只缓存一条 512 维潜向量；KDA 更是不按位置缓存。
- **「看到 q、k、v 投影，这一层就是 softmax attention。」** KDA 也显式算 q、k、v，后面走的是状态更新，没有逐位置 softmax。
- **「稀疏 MLA 对 R1 也只读了一部分历史。」** R1 的历史只有几个位置，全部在选中范围内；2,051 的上限要到长历史才起作用。

沿请求继续看[主线第 4 站](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)；想知道历史存多大读 [KV cache](kv-cache.md)；想看两类 GLM attention 的推导读 [MLA](mla.md) 和 [KDA](linear-attention.md)。

## 对照源码

### 怎么开

attention 随模型前向执行，没有单独的开关；用哪种 attention、多少个头、缩放系数取多少，都由模型代码按模型配置决定。部署命令统一见[部署前提](glm-5-3-flash-two-node.md#部署前提)。

**vLLM 的通用 attention 层。** 标准模型在构造时创建 `Attention(num_heads, head_size, scale, num_kv_heads, …)`：头数、每头宽度和缩放系数都由模型传入，框架不替模型算 √d；类说明写明它先把输入的 K、V 存进 KV cache，再做多头、多查询或分组查询 attention。`attn_type` 默认是 `AttentionType.DECODER`，即解码器里对上一层 Q/K/V 做的 self-attention。

**GLM 按层号选路径。** 解码器层用 `_is_kda_layer` 查配置里的 KDA 层名单：命中就构造上游的 `KimiGatedDeltaNetAttention`，否则构造 `AscendGlm5NextMLAAttention`。在 vLLM 0.23.0 下，Ascend 通过 `REGISTERED_ASCEND_OPS` 把前者换成 `AscendKimiGatedDeltaNetAttention` 执行。两条路径都不经过上面的通用层：MLA 的包装类注释写明它不构造通用的 `MLAAttention`，自己登记潜向量缓存和两份索引器缓存。

**两个缩放系数怎样来。** MLA 构造时取 `qk_head_dim = qk_nope_head_dim + qk_rope_head_dim = 256`，`scaling = qk_head_dim ** -0.5`；只有 RoPE 维数大于 0 时才会进入另一分支，建 `rotary_emb` 并可能按 YaRN 系数修正缩放，这一配置不进，`rotary_emb=None`。缩放经包装类传到实现对象的 `self.scale`，稀疏 attention 调 `npu_sparse_flash_attention` 时作为 `scale_value` 传入，挑中的位置以 `sparse_indices=topk_indices` 传入；返回后再做 `_v_up_proj` 和 `o_proj`。KDA 的 decode 调 `recurrent_kda(..., scale=self.head_dim**-0.5, use_qk_l2norm_in_kernel=True)`，prefill 调 `chunk_kda_fwd`，同样传 `head_dim**-0.5`；q、k、v 由 `q_proj`、`k_proj`、`v_proj` 三个投影算出。

### 会报什么错

| 条件 | 报错或检查点 | 本模型上怎样判断 |
| --- | --- | --- |
| MLA 头数不能被 TP 整除 | `assert num_heads % tp_size == 0` | 64 个头，TP 取 64 的约数才能过 |
| KDA 头数不能被 TP 整除 | `assert self.num_heads % self.tp_size == 0` | KDA 自己的 64 个头 |
| 稀疏 attention 的掩码模式不对 | `ValueError: Indexer KPool MLA only supports sparse_mode=3, got ...` | 该入口的默认值就是 3（右下对齐的因果掩码），调用方改传其他值才会触发 |

MLA 与 KDA 的断言分别在各自的构造函数里。稀疏 attention 的检查在设备算子入口。sparse_mode=3 是右下对齐的因果掩码：本轮 T 个查询对齐到 S 个键的最后 T 个位置，第 r 行（从 0 数）只能看到键 0 到 S − T + r；昇腾的通用 attention 后端把「因果」映射成 3、滑窗映射成 4、不加掩码映射成 0，[C19] 上下文并行路径的注释也把 3 对应的行为称作稀疏 attention 的右下对齐因果裁剪，并因坐标重映射改传 0。[C20]vLLM 在读配置时对总 attention 头数的整除检查，以及投影维度的整除断言，集中在 [tensor parallel 的报错表](tensor-parallel.md#会报什么错)。以上是源码检查点，未在 NPU 上故意触发。

### 开销和什么时候别开

attention 不能关：去掉它，模型就不再是同一个模型。能改变开销的是输入规模和结构：标准 attention 的 prefill 计算量随「本轮查询数 × 可见位置数」增长，decode 每步要读一遍全部可见的 K、V。GLM 的稀疏 MLA 把每个查询读取的位置限制在 2,051 个以内，但索引器仍要扫过全部压池后的摘要；KDA 每步只读写固定大小的状态。各类缓存每 token 占多少、能切出多少块，见 [KV cache](kv-cache.md#省了重算要付什么代价) 和[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)；不同结构的代价对照见[四种注意力的代价](attention-cost.md)。

待核：没有固定双机上 attention 算子的耗时、HBM 读写量和 tiling 实测；稀疏 attention 内核的实际分块方式未知，单测参考实现里的分块常量不能代表 NPU 推理路径。

### 版本差异

**attention 的数学定义没有版本开关；变化在框架类的位置和 GLM 专用实现的文件组织。** 下表按知识库固定快照核对：v0.23 为 Ascend 2c59ff10 / vLLM 0fc695fc，v0.26 为 Ascend 2ed6cbba / vLLM 568afb3a，main 为 Ascend baa023ad / vLLM 84030bbe；本页 GLM 行为按专用镜像 Ascend db701c1f 解释。

| 检查项 | v0.23 | v0.26 | main |
| --- | --- | --- | --- |
| vLLM 通用 `Attention` 类 | 有；`scale` 由模型传入，`attn_type` 默认 DECODER | 同一文件路径；`scale` 参数、DECODER 默认值和类说明仍在 | 同上 |
| Ascend 的 GLM 专用 attention | 维护快照没有 GLM 模型文件，也没有 KDA 算子文件；专用镜像 db701c1f 有 `models/glm5_next.py` | 有 `ops/kimi_kda.py`，没有 GLM-5.3-Flash 的模型文件 | 拆成 `models/glm5next/` 下的 `attention.py`、`kda.py` 等文件 |
| MLA 缩放公式 | 镜像中为 `qk_head_dim ** -0.5` | 无 GLM 模型文件可比 | `Glm5NextMLAAttention` 用同一公式 |
| 按层选 KDA 或 MLA | 镜像按 `kda_layers` 名单 | 无 GLM 模型文件可比 | `config.is_kda_layer` 判断；KDA 分支改为构造 `Glm5NextLinearAttention` |

通用类的比较见来源 3、16、17；main 的 GLM 缩放与选层见来源 14、15。各版本文件是否存在，是用 git ls-tree 列出对应 commit 的全部文件后检索得到的。main 与镜像在头切分、低秩投影合并方式上的差异见 [tensor parallel 的版本差异](tensor-parallel.md#版本差异)；三版能否整套运行本文部署，未做核验。

### 源码位置

| 入口 | 对照什么 | 说明了什么 |
| --- | --- | --- |
| vLLM `Attention` 类，attention.py 177–210 行 | 构造参数与类说明 | 头数、宽度、缩放由模型给；K、V 进缓存后做 attention |
| glm5_next.py 2075–2105 行 | 按层号构造 KDA 或 MLA | 两类 attention 的分岔点 |
| glm5_next.py 1881–2030 行 | MLA 的头数、`scaling`、RoPE 分支、包装类构造 | 缩放按 256 维算，本配置不建位置旋转 |
| indexer_kpool_mla.py 39–182 行 | 缓存层、实现对象与三份缓存 | 不走通用 MLA 层，缩放传入实现 |
| device_op.py 719–793 行；sfa_v1.py 1994–2028 行 | 稀疏 attention 调用与其后的 V 解压、输出投影 | softmax 只在挑中的位置上做 |
| kimi_kda.py 244–291、366–472 行 | q/k/v 投影、decode 递推与 prefill 分块 | KDA 也算 q、k、v，缩放 1/√128，没有逐位置 softmax |

**来源与结论对应：**

- 缩放点积公式、除以 √d_k 的方差论证、多头公式与 h = 8、d_k = 64、解码器用 −∞ 屏蔽非法连接、self-attention 的 Q/K/V 都来自上一层输出，均对照原论文 3.1、3.2 节。[S1]
- 64 个 attention 头、每头 q·k 256 维与 v 256 维、RoPE 维数 0、潜向量 512 维、64 个 KV 头、KDA 64 头 × 128 维与短卷积宽度 4、MLA 所在层号，来自固定模型配置；配置版本与一致性记录见[来源基线](../sources/glm-5-3-flash-baseline.md)。[S2]
- 通用 attention 层的构造参数、类说明与默认类型，对照来源 3、4、16、17。[C3][C4][C16][C17]
- 按层选型、KDA 运行时替换、MLA 包装类不走通用层，对照来源 5、13、7。[C5][C13][C7]
- MLA 缩放 256^-0.5 = 0.0625、RoPE 分支不执行与头数整除断言，对照来源 6；稀疏 attention 只支持 sparse_mode=3 的检查在来源 10，3 即右下对齐的因果掩码，对照来源 19、20；缩放传到稀疏 attention 内核、挑中位置作为稀疏索引传入、其后的 V 解压与输出投影，对照来源 7、18、10、11。[C6][C7][C18][C10][C19][C20][C11]
- KDA 的 q/k/v 投影、归一化与 1/√128 缩放，对照来源 8、9；KDA 头数整除断言对照来源 12。[C8][C9][C12]
- 各版本文件是否存在，由 git ls-tree 列出对应 commit 的全部文件后检索得出。[D]
- 手算例的分数与 v 是教学假设；e¹⁶ ≈ 8,886,111、1/√128 ≈ 0.0884 为本页推导。32,768 个数、2,051 个位置、133,120 个 token 与 R1 的 32,768 B 引用正文链接的主线与专页。[A][D]

**待核：** 没有固定双机的 attention 设备 trace，缺算子耗时、HBM 读写量与稀疏 attention 的实际分块；R1 decode 时本轮 4 行之间按位置遮挡，与 sparse_mode=3 的右下对齐因果掩码一致（语义取自来源 19 的因果→3 映射与来源 20 的注释），稀疏 attention 内核内部的掩码实现未审；三版整模型运行兼容性未做核验。
