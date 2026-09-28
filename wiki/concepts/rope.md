---
id: rope
title: "RoPE：把位置变成旋转，让注意力分数只看相隔多远"
type: concept
summary: RoPE 在 q、k 点积之前按各自的位置编号旋转它们的二维分量对，点积里只剩两者的位置差；频率基数和 YaRN 等缩放决定能覆盖多长。固定部署的 GLM-5.3-Flash 把 RoPE 维数设为 0：稀疏 MLA 与索引器都不旋转，KDA 层本来就不用 RoPE。
aliases: [旋转位置编码, 旋转位置嵌入, Rotary Position Embedding, rotary embedding, 位置编码, partial rotary, 部分旋转, rope_theta, 旋转基数, 频率基数, YaRN, NoPE, qk_rope_head_dim, 位置插值]
chapters: ["04"]
order: 10
sources:
  - https://arxiv.org/html/2104.09864v5
  - https://arxiv.org/html/2309.00071v2
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/base.py#L80-L103
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/base.py#L160-L201
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/common.py#L143-L183
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/__init__.py#L63-L72
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/__init__.py#L243-L288
  - vllm@0fc695fc:vllm/config/model.py#L2178-L2248
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - vllm-ascend@db701c1f:vllm_ascend/transformers_utils/configs/glm5_next.py#L102-L105
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1965-L2000
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2089-L2103
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1256-L1269
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1357-L1383
  - vllm-ascend@db701c1f:vllm_ascend/ops/glm5_next_kpool_state_compress.py#L200-L202
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L70-L71
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L641-L646
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L251
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L863-L868
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L735-L755
  - vllm-ascend@db701c1f:vllm_ascend/ops/rotary_embedding.py#L216-L250
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L231-L266
  - vllm-ascend@baa023ad:vllm_ascend/attention/indexer_kpool.py#L308-L313
  - vllm-ascend@baa023ad:vllm_ascend/attention/mla_v1.py#L288-L294
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L236-L251
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L841
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L880-L887
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: attention-qkv, kind: builds-on, note: RoPE 改的是 q、k 点积打分这一步；打分、softmax、因果掩码本身在那一页}
  - {to: one-request, kind: builds-on, note: 挂靠第 4 站逐层前向；位置编号在第 3 站准备输入时算好}
  - {to: mla, kind: builds-on, note: MLA 为什么要把 RoPE 段和潜向量分开存；GLM 这一段是 0 维}
  - {to: linear-attention, kind: builds-on, note: KDA 不用 RoPE，顺序靠短卷积和逐位置递推}
  - {to: glm-5-3-flash, kind: builds-on, note: 这套模型没有位置编码时，顺序信息从哪三处来}
  - {to: sparse-attention, kind: builds-on, note: 索引器压池时的池内偏置与 RoPE 缓存视图的检查}
  - {to: block-table, kind: builds-on, note: 位置编号决定旋转角度，块表只决定缓存存在哪一格}
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 注意力怎样知道两个 token 相隔多远？

[attention](attention-qkv.md) 用两条向量给历史打分：当前位置算出的 q（查询），和每个历史位置算出的 k（键）；两者做点积，得到“该从那个位置读多少”的分数。**RoPE（Rotary Position Embedding，旋转位置编码）在做点积之前，按各自的位置编号把 q 和 k 各转一个角度；两者一乘，转角相减，分数里只留下“相隔几个位置”。**

```wiki-diagram
file: rope
```

图只画 q、k 里的一对分量：两个数当成平面上的一支箭头，每前进一个位置转 20°。左边是旋转前，q 和 k 由各自 token 的内容算出，夹角 30°。中间 k 在位置 3、q 在位置 5，k 转 60°，q 转 100°，夹角变成 30° + 40° = 70°。右边两个位置都往后挪 100，两支箭头各多转 2000°，夹角仍是 70°。

点积等于两支箭头的长度相乘，再乘夹角的余弦。旋转不改长度，所以两组位置得到同一个分数：它只随位置差 2 变化，与位置本身是 5 还是 105 无关。旋转前的 30° 仍由内容决定，换一对 token，同样相隔 2 个位置也会得到不同分数。只有 q 和 k 旋转；v（值，被读走的内容）不转。

请求走到[主线第 4 站：逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)的 attention 层时会遇到这一步：投影出 q、k 之后，打分之前。本知识库跟踪的 GLM 双机部署在这一步**不做旋转**，它的 RoPE 维数是 0；哪里本该转、为什么没转，见后文「放到 GLM 双机」。

## 为什么需要位置编码，代价在哪？

**attention 的打分公式里没有“位置”这一项。** 把历史里两个 token 对调，只要它们的向量不变，各自拿到的分数就不变，按分数加权得到的输出也不变。RoFormer 论文开篇就指出，自注意力结构本身对位置是无感的，必须另外把位置信息放进去。[因果掩码](attention-qkv.md#因果掩码限定每个位置能访问的历史)只规定一个位置能看哪些位置（自己和之前的），不告诉模型隔了多远；“我打你”和“你打我”用的是同一组词，意思却相反，靠的就是先后。

早期做法是**绝对位置编码**：给每个位置准备一条位置向量，加到词向量上再送进模型。RoPE 换了一种做法：不加向量，而是**乘上一个旋转**。每条 q、k 按自己的绝对位置编号转，点积里却只剩两者的位置差，所以它同时带有绝对位置和相对位置的性质。论文还证明了一个“远程衰减”性质：在默认频率下，q·k 能取到的上界随相对距离增大而下降，离得越远的 token，潜在的相互作用越弱。这是一个上界，并不保证远处的分数一定小。

代价分三处：

- **计算。** 每层给 q、k 中参与旋转的分量各做一次逐元素的乘加，没有要学习的权重。
- **显存。** 一张按位置预先算好的 cos、sin 表；K 以转好的值写进 [KV cache](kv-cache.md)，以后不必再转。
- **长度。** 训练时没见过的位置会转出没见过的角度，模型未必会用；想跑更长，要配合下文的频率缩放和续训。

对 MLA 还有一笔额外代价：旋转矩阵随位置变化，夹在 q 的投影和 k 的解压矩阵之间，两者无法提前合并。所以 DeepSeek 式 MLA 让 RoPE 只作用在单独留出的一小段 q/k 上，这段 k 与潜向量并排存进缓存。GLM-5.3-Flash 把这一段设为 0 维：稀疏 MLA 的主缓存每层每 token 只存 512 维潜向量，没有旋转段，详见 [MLA](mla.md#glm-的这一配置不保存-rope-段)。

几个容易混在一起的“位置”：

| 概念 | 回答的问题 |
|---|---|
| 位置编号 | 这个 token 在本请求里排第几，从 0 起 |
| 因果掩码 | 这个位置能看哪些位置 |
| [block table](block-table.md) | 这个位置的 KV 存在缓存池的哪一格 |
| RoPE | 两个位置相隔多远怎样进入分数 |

## 一条高维向量怎样转：拆成许多二维分量对

图里只转了一个平面。真实的 q、k 有几十到几百维，RoPE 把其中参与旋转的 d_r 维（必须是偶数）两两配成一对，共 d_r/2 对；每一对 (x₁, x₂) 当成平面上的一支箭头，在位置 p 转过角度 p·ω_i，i 是分量对的编号：

```text
x₁' = x₁·cos(p·ω_i) − x₂·sin(p·ω_i)
x₂' = x₁·sin(p·ω_i) + x₂·cos(p·ω_i)
```

**每一对的转速不同。** 论文取 ω_i = θ^(−2i/d_r)，i 从 0 数到 d_r/2 − 1，θ 叫旋转基数（频率基数），论文用 10000。第 0 对每前进一个位置转 1 弧度，越往后的对转得越慢。同一个位置因此同时作用在许多个旋转平面上，而不是把整条高维向量按一个角度转：快的几对像秒针，分辨相邻几个位置；慢的几对像时针，区分远处的大段距离。

```calc
title: 示意：d_r = 8、基数 10000 时四对分量的转速（非 GLM 配置）
第 0 对 = 10000^(−0/8) = 1 弧度/位置
第 1 对 = 10000^(−2/8) = 0.1 弧度/位置
第 2 对 = 10000^(−4/8) = 0.01 弧度/位置
第 3 对 = 10000^(−6/8) = 0.001 弧度/位置
第 3 对转满一圈 = 2π ÷ 0.001 ≈ 6,283 个位置
```

基数调大，慢的那几对转得更慢，一圈覆盖的位置更多；这就是模型配置里 rope_theta 的含义，vLLM 在配置没写时按 10000 处理。

**实现上不做矩阵乘。** 旋转矩阵是块对角的，大部分元素是 0，论文给出的等价写法是两次逐元素乘再相加：一次乘 cos，一次乘交换并变号后的分量再乘 sin。vLLM 的基础实现照此把每个位置、每一对的 cos 和 sin 预先算成一张表，行数是最大位置数；前向时按本步 token 的位置编号取出对应的行，再对 q、k 做旋转。

**一个头可以只转一部分维度。** 这叫 partial rotary：只取头里的前 d_r 维旋转，剩下的原样保留，再拼回去；q 与 k 都这样处理。比如一个 8 维的头只转 4 维，就是两个旋转平面加四个不转的分量。vLLM 用配置里的比例乘以头宽得到参与旋转的维数，比例必须落在 0 到 1 之间；也可以直接给出维数。

哪些分量配成一对，有两种布局。以参与旋转的 4 个分量为例：

| 布局 | 四个分量怎样组成两对 | vLLM 里的名字 |
|---|---|---|
| 相邻配对（论文的写法） | (x₀, x₁)、(x₂, x₃) | GPT-J 风格 |
| 前后半区配对 | (x₀, x₂)、(x₁, x₃) | GPT-NeoX 风格 |

两种都是二维旋转，数学性质相同；但模型训练时用哪种，推理就必须用哪种，权重和张量布局是跟着它排的，不能在已有模型上随意切换。vLLM 用一个布尔开关选择：开为前后半区，关为相邻配对。

## 为什么点积里只剩位置差？

用 R(p) 表示“在位置 p 把每一对分量各转 p·ω_i”的整个旋转。旋转有两个性质：转回去等于反着转，R(p) 的转置就是 R(−p)；连着转两次，角度相加。于是 q 在位置 p、k 在位置 r 时：

```text
(R(p)·q)ᵀ (R(r)·k) = qᵀ · R(p)ᵀ · R(r) · k = qᵀ · R(r − p) · k
```

右边只含 r − p。两个位置一起平移，差不变，分数就不变；这正是首图右边那一组的情形。按分量对拆开看更直观：第 i 对的贡献等于两段箭头的长度相乘，再乘 cos(内容夹角 + (p − r)·ω_i)。内容夹角由 q、k 本身的数值决定，位置只通过 p − r 进入。

这个等式有三条边界：

- **内容依赖保留。** 相同距离上的不同内容，仍可以得到不同分数；RoPE 只是把距离写进了分数，没有让距离取代内容。
- **只管打分这一步。** 旋转保持每对分量的长度，但这不等于整个模型的输出、语义或长文本质量不受位置影响；因果掩码、内容表示和其他层的计算都会影响结果。
- **不限于 softmax attention。** 论文第 3.3 节给出了与线性注意力结合的写法：把旋转乘在分子里经过非负映射后的 q、k 上，分母保持不变，避免除以零。GLM 的 [KDA 线性注意力](linear-attention.md)不用 RoPE 是这个模型的设计选择，不是线性注意力用不了 RoPE。

## 频率基数与长上下文：YaRN 这类方法改的是什么？

模型训练时只见过一定长度以内的位置。超过这个长度，慢的那几对分量会转到训练中从未出现的角度，模型不知道怎样解读，质量通常明显下降。长上下文扩展的办法，都是在改“位置 → 角度”这张对照关系，让长序列的角度落回模型熟悉的范围，再配合少量续训。YaRN 论文按先后梳理了几种：

| 方法 | 改了什么 |
|---|---|
| Position Interpolation（PI，位置插值） | 把位置编号按比例 s 压缩，长序列整体挤回训练长度 |
| NTK-aware | 不压位置，改旋转基数，把压缩分摊到各对分量 |
| NTK-by-parts | 一圈远短于训练长度的快对不动，一圈超过训练长度的慢对插值，中间平滑过渡 |
| YaRN | NTK-by-parts 再加注意力温度：q、k 同乘系数 0.1·ln(s) + 1 |

YaRN 的温度也通过缩放 cos、sin 表实现，不必改 attention 的代码。论文报告，它比此前方法少用约 10 倍的续训 token 和 2.5 倍的训练步数。

在 vLLM 里，这些都写在模型配置的 RoPE 参数里：基数、缩放类型、缩放倍数、原始训练长度，以及上面说的旋转比例。vLLM 按缩放类型构造对应的旋转模块；类型写错会直接报错。它还会用配置推出允许的最大长度：用 YaRN 时是原始训练长度乘以缩放倍数。部署时指定的最大长度超过推出值就会报错，强行放开要设环境变量，vLLM 的提示写明，超出这个长度的 RoPE 位置会算出 NaN。

所以**基数、缩放方式和旋转维数都是模型训练时定下的计算约定。**公式能为任意大的位置算出角度，不等于模型在那个长度上有可靠质量，也不等于设备放得下对应的 KV；只改一个最大长度字段，不能算完成了长上下文扩展。

GLM-5.3-Flash 的固定配置里没有基数，也没有任何 RoPE 缩放字段；最大位置字段写的是 1,048,576，官方双机教程把服务的最大长度设为 133,120。由于 RoPE 维数是 0，这两个数都不驱动任何旋转表。单条请求最长多少由部署参数给定，显存里能同时装下多少历史由 KV 预算决定，见 [glm-5-3-flash-two-node](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

## 在推理引擎里，旋转发生在哪一步？

对一个使用 RoPE 的普通 attention 层，一步前向里的顺序是：

1. **位置编号在进层之前就算好。** [主线第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)准备输入时，model runner 给每个 token 算出位置编号：本请求已经算过的 token 数，加上它在本步里的序号。R1（主线跟踪的示例请求，提示词 4 个 token）第一步的位置编号是 0、1、2、3。
2. **投影出 q、k、v 之后旋转 q 和 k。** 按位置编号取出 cos、sin 表的对应行，只转参与旋转的那部分维度，v 不动。
3. **把转好的 k 写进 KV cache，再打分。** 缓存里存的是旋转后的 k。decode 时新 token 只转自己的 q 和 k，历史里的 k 在写入时已经转好，不必随生成推进再转一遍。

位置编号和缓存地址是两回事。位置编号说的是 token 在序列里排第几；[block table](block-table.md) 说的是它的状态存在哪个物理块。同一逻辑位置的缓存换到另一块，它的 RoPE 位置不变；多条请求可以各有自己的位置 0，缓存仍各管各的。

压缩注意力要另看缓存里存的是什么、在哪里转。以 DeepSeek 式 MLA 为例，缓存每 token 存两段：不旋转的潜向量，和转好的那一小段 RoPE 键；潜向量本身从不旋转。GLM 所用的 Ascend 实现也按这两段组织缓存，只是 RoPE 段宽度为 0，写入时只剩潜向量。

在昇腾上，vLLM 的通用旋转模块，包括基础 RoPE、YaRN 缩放、DeepSeek 式缩放和多模态用的 M-RoPE，都在 vllm-ascend 启动时被替换成 Ascend 版本，前向改调 NPU 上的旋转算子；数学定义不变。

## 放到 GLM 双机：哪里本该转，为什么没转？

**结论：固定部署的 GLM-5.3-Flash 在 45 层主干里没有一处做 RoPE 旋转。** 固定配置把 RoPE 维数设为 0，同时声明稀疏 MLA 不用位置编码（NoPE，No Position Embedding），也没有给出任何 RoPE 参数。官方部署是 [2 台 A2 各 8 卡、TP8 / DP2 / EP16、W8A8](glm-5-3-flash-two-node.md#部署前提)；RoPE 不涉及跨卡通信，也没有权重，所以这些切分对本页没有影响，每张卡上的结论都一样。

```wiki-diagram
file: rope-glm
```

位置编号照样算：R1 第一步的 0、1、2、3 仍然传进每一层。区别在于各层拿它做什么。

### 稀疏 MLA：本该转的那一段是 0 维

一般的 MLA 把每个头的 q、k 分成两部分：不带位置的部分参与矩阵吸收，RoPE 部分单独旋转；RoPE 只作用在后者，不碰潜向量。GLM 的专用实现在构造 11 层稀疏 MLA 时，要同时满足三项才会建主注意力的旋转模块：RoPE 维数大于 0、这一层不是 NoPE、配置里有 RoPE 参数。本配置三项都不满足，旋转模块为空，前向不执行旋转。

```calc
title: RoPE 维数为 0 时，稀疏 MLA 的两处宽度
每头打分宽度 = 256（不带位置）+ 0（RoPE）= 256 维
主缓存每 token 每层 = 512（潜向量）+ 0（RoPE 段）= 512 维
```

每头打分宽度决定打分的缩放系数，推导见 [attention](attention-qkv.md#落到-glm-双机两类-attention-各改了哪一步)；512 维潜向量怎样压缩、怎样在潜空间打分，见 [MLA](mla.md)。加载权重时，实现里有一个为 NoPE 检查点补零的分支，只在 RoPE 维数大于 0 时才补；本配置维数为 0，不补。

### 索引器：也不转，压池时另有池内偏置

[稀疏 attention](sparse-attention.md) 的索引器先给历史打分、挑出要读的位置。它的 RoPE 维数直接取模型的 RoPE 维数，本配置为 0：构造时不建旋转模块，前向跳过旋转分支，q、k 保持未旋转。配置里“索引器用相邻配对”的开关只在有旋转时决定配对布局，本配置下不起作用。

索引器仍然用位置编号：它按位置把每 4 个 token 归成一个 pool，并限定因果范围。把 4 个 token 的键压成一个时，每个 token 先得到一组门控分数，再加上它在 pool 里所处槽位（0 到 3）对应的一组学到的偏置，在 4 个槽位间做 softmax 加权求和。这组偏置只区分 token 在池里排第几，是加法偏置，不是旋转，也不表示两个 pool 之间相隔多远。

### KDA：从来不用 RoPE

34 层 [KDA 线性注意力](linear-attention.md)的前向收下位置编号后立刻丢弃。它的顺序信息来自结构本身：q、k、v 先过一个核长 4 的短卷积，每个位置混入前 3 个位置的信息；状态再按位置逐个递推，带遗忘门，旧信息按通道衰减。

合起来，这套模型对 token 先后敏感的地方有三处：KDA 的短卷积与递推、索引器压池时的池内偏置、attention 的因果范围。三者的关系见 [GLM-5.3-Flash 的稀疏 MLA](glm-5-3-flash.md#稀疏-mla先把历史压短再挑着读)。

## 常见误解

- **“RoPE 是把一条位置向量加到 q、k 上。”** 加法是绝对位置编码的做法。RoPE 是乘上一个旋转，不增加向量，也不改变每对分量的长度。
- **“RoPE 只编码相对位置，模型不知道绝对位置。”** 每条 q、k 都按自己的绝对位置转；只是两者做点积时，结果只依赖位置差。
- **“v 也要旋转。”** 只转 q 和 k；v 是被读走的内容，不参与打分，也不转。
- **“把最大位置字段或服务的最大长度调大，就能处理更长文本。”** 公式能算出任意位置的角度，但模型没在那些角度上训练过；扩展要配合 YaRN 这类缩放和续训，还要显存放得下对应的 KV。vLLM 也会拒绝超过推导上限的最大长度。
- **“GLM 的稀疏 MLA 把 RoPE 用在 q、k 的 RoPE 部分。”** 一般的 MLA 确实只转那一部分、不转潜向量；但本配置这一部分是 0 维，主注意力和索引器都没有建旋转模块，什么也不转。
- **“配置里有索引器用相邻配对的开关，说明索引器在做 RoPE。”** 这个开关只在有旋转时选择配对布局；RoPE 维数为 0 时不起作用。
- **“GLM 没有 RoPE，所以模型不知道词序。”** 顺序信息来自 KDA 的短卷积与逐位置递推、索引器压池时的池内偏置，以及因果范围。
- **“线性注意力用不了 RoPE。”** RoFormer 论文给出了与线性注意力结合的写法；GLM 的 KDA 不用 RoPE，是模型结构的选择。
- **“block table 把缓存搬到别的块，RoPE 位置就变了。”** 旋转角度只由位置编号决定；块号只决定存在哪里，而 k 在写入时就已经按位置转好。

沿请求继续看[主线第 4 站的 11 层稀疏 MLA](one-request.md#11-层稀疏-mla)；想知道没有 RoPE 时顺序从哪来，读 [KDA 线性注意力](linear-attention.md)；想看 MLA 为什么要把 RoPE 段分开存，读 [MLA](mla.md)。

## 对照源码

### 怎么开

RoPE 不是服务端开关，而是模型结构的一部分，由 Hugging Face 配置决定：

- `rope_parameters` 里的 `rope_theta`（基数）、`rope_type`（`default`、`linear`、`dynamic`、`yarn`、`llama3`、`longrope`、`deepseek_yarn` 等）、`factor`、`original_max_position_embeddings`，以及 `partial_rotary_factor` 或 `rope_dim`（参与旋转的比例或维数）。vLLM 的 `get_rope` 读取它们；字段缺省时基数按 10000、类型按 `default`、比例按 1.0 处理。
- 服务时如需覆盖配置字段，vLLM 提供 `--hf-overrides`；只有模型训练时确实采用了相应缩放，这样改才有意义。
- 最大长度由 `--max-model-len` 给定，vLLM 会拿它与配置推导出的上限比较。

GLM-5.3-Flash 没有可开的项：检查点写的是 `qk_rope_head_dim: 0`、`qk_nope_head_dim: 256`、`mla_use_nope: true`、`indexer_rope_interleave: true`、`max_position_embeddings: 1048576`，没有 `rope_theta` 和缩放字段。专用配置类把 `mla_use_nope` 映射为 `mla_nope`，`rope_parameters` 缺省为空。把 RoPE 维数改成非 0 不等于“打开 RoPE”：检查点里没有这段权重，镜像的加载函数只会补零，main 的 KPool 索引器会直接拒绝。

### 会报什么错

| 报错 | 在哪一步 | 含义 |
|---|---|---|
| `ValueError: partial_rotary_factor=... must be between 0.0 and 1.0` | vLLM 构造旋转模块 | 参与旋转的比例不在 (0, 1] |
| `ValueError: Unknown RoPE scaling type ...` | vLLM 构造旋转模块 | `rope_type` 不在支持列表里 |
| `User-specified max_model_len (...) is greater than the derived max_model_len (...)` | 引擎读取模型配置 | 最大长度超过配置推导的上限；设 `VLLM_ALLOW_LONG_MAX_MODEL_LEN=1` 可放行，提示写明 RoPE 模型超出位置会得到 NaN |
| `GLM-5 Indexer requires rope_parameters when qk_rope_head_dim is non-zero.` | 镜像 GLM 专用实现构造 MLA | RoPE 维数非 0 却没有 RoPE 参数 |
| `GLM-5 Indexer requires rotary embedding when qk_rope_head_dim is non-zero.` | 镜像索引器前向 | RoPE 维数非 0 却没有传入旋转模块 |
| `GLM-Next KPool indexing supports NoPE queries only, got qk_rope_head_dim=...` | main 的 KPool 索引器构造 | main 只支持 RoPE 维数为 0 |

与 RoPE 缓存视图宽度相关的报错（缓存视图少于两份、RoPE 缓存宽度不等于 `qk_rope_head_dim`）属于稀疏 attention 的入口检查，见 [sparse-attention 的会报什么错](sparse-attention.md#会报什么错)。

### 开销和什么时候别开

- **计算**：每层对 q、k 的旋转维做逐元素乘加，与投影矩阵乘相比很小；Ascend 用 NPU 旋转算子执行。设备上的实际耗时尚未实测。
- **显存**：`cos_sin_cache` 形状为 [最大位置数, 旋转维数]，每个旋转模块一份；MLA 的 RoPE 段另外占缓存宽度。GLM 两者都是 0。
- **什么时候别动**：已训练好的模型不能随意开关 RoPE、改基数、改缩放或换配对布局，这些都会改变模型学到的角度含义；GLM 按检查点保持 NoPE。

### 版本差异

按知识库固定快照核对：v0.23 为 Ascend `2c59ff10` / vLLM `0fc695fc`；v0.26 为 Ascend `2ed6cbba` / vLLM `568afb3a`；main 为 Ascend `baa023ad` / vLLM `84030bbe`。执行侧镜像为 Ascend `db701c1f`。

| 检查项 | v0.23 | v0.26 | main |
|---|---|---|---|
| vLLM `get_rope`：默认基数 10000、`yarn` 与 `deepseek_yarn` 分支、未知类型报错 | 有 | 有，相同 | 有，相同（行号前移 2 行） |
| vllm-ascend 替换 `RotaryEmbedding`、`YaRNScalingRotaryEmbedding`、`DeepseekScalingRotaryEmbedding` | 有 | 有 | 有 |
| GLM 专用实现 | 维护快照没有；镜像 `db701c1f` 的 `models/glm5_next.py` 有：主注意力需三项同时满足才建旋转，索引器维数大于 0 才建 | 维护快照没有 | `models/glm5next/`：主注意力只看 `skip_rope`（即 `mla_nope`）；稀疏配置下索引器总会调用 `get_rope` 并传入维数 0；KPool 索引器要求维数为 0；MLA 后端为 NoPE 模型准备全零的 RoPE 操作数 |

三版在固定配置下的结论一致：GLM 主干不做 RoPE 旋转。GLM 配置与专用源码的钉点见[专用配置与源码基线](../sources/glm-5-3-flash-baseline.md)。

### 源码位置

| 位置 | 看什么 |
|---|---|
| vLLM `rotary_embedding/__init__.py` 63–72、243–288 行 | `get_rope` 的缺省值、旋转维数、`yarn` 与 `deepseek_yarn` 分支 |
| vLLM `rotary_embedding/base.py` 80–103、160–201 行 | 频率 `inv_freq`、`cos_sin_cache`；按 `positions` 取行，前 `rotary_dim` 维旋转后与其余维拼接 |
| vLLM `rotary_embedding/common.py` 143–183 行 | `is_neox_style` 为真时前后半区配对，为假时相邻配对 |
| vLLM `config/model.py` 2178–2248 行 | 用缩放倍数推导最大长度，超限报错 |
| Ascend `worker/model_runner_v1.py` 863–868 行 | 位置编号 = 已算 token 数 + 本步序号 |
| Ascend `utils.py` 735–755 行、`ops/rotary_embedding.py` 216–250 行 | 通用旋转模块替换为 Ascend 版本，调用 NPU 旋转算子 |
| Ascend `models/glm5_next.py` 1965–2000、2089–2103 行 | MLA 与索引器的旋转模块在什么条件下建立；`skip_rope` 取自 `mla_nope` |
| Ascend `models/glm5_next.py` 1256–1269、1357–1383、880–887 行 | 索引器的 RoPE 维数、配对布局、池内偏置参数、旋转分支、按位置算因果 pool 数 |
| Ascend `ops/glm5_next_kpool_state_compress.py` 200–202 行 | 门控分数加池内偏置，在 4 个槽位间 softmax 后压成一个键 |
| Ascend `ops/indexer_kpool_mla.py` 70–71 行、`attention/indexer_kpool_mla_v1.py` 641–646 行 | 主缓存宽度 = 潜向量 + RoPE 段；NoPE 时只写潜向量 |
| Ascend `ops/kimi_kda.py` 244–251 行 | KDA 前向丢弃位置编号 |

**来源索引。** RoPE 的定义、旋转公式、频率取值、相对位置等式、远程衰减、与线性注意力的结合、逐元素实现，以及“自注意力对位置无感”的动机，见 [S1]。PI、NTK-aware、NTK-by-parts、YaRN 的温度公式与续训开销，见 [S2]。vLLM 的频率与 cos/sin 表、按位置取行与部分旋转在 base.py [C4]，两种配对布局在 common.py [C5]；缺省基数、旋转比例与缩放类型分支在 get_rope [C7]，最大长度推导与报错在 model.py [C8]。GLM 固定配置字段 [S9]。MLA 与索引器的旋转构造条件 [C11][C12]；索引器的维数、配对布局、池内偏置参数与按位置限定因果 pool [C13][C27]，偏置参与压缩 [C15]；主缓存宽度与 NoPE 时只写潜向量 [C17]；KDA 丢弃位置编号 [C18]；位置编号的计算 [C19]；Ascend 替换旋转模块 [C20]；main 的 NoPE 限制 [C23]。首图每个位置转 20° 与 d_r = 8 的转速表是示意取值 [A]；256 + 0 与 512 + 0 两处宽度由配置字段相加得出 [D]。其余来源是上表各行的原始位置。

**待核。** 设备上 RoPE 算子的耗时未实测；本页不涉及长文本效果，也未实测；main 以 0 维构造的索引器旋转模块在前向中是否执行未核；池内偏置只核对了 PyTorch 写法的那条路径，融合算子内部未逐行核对。
