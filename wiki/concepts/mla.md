---
id: mla
title: "MLA：历史压成一条潜向量，用时再展开"
type: concept
summary: MLA（Multi-head Latent Attention）把每个位置给所有头用的 K/V 压成一条共用的潜向量存进 KV cache，读取时由各头的上投影展开，或把展开吸收进查询和输出投影；GLM-5.3-Flash 的稀疏 MLA 每位置只存 512 维潜向量、不带 RoPE 段，读哪些位置由 indexer 另行决定，主缓存、indexer 缓存与计算开销分别计量。
aliases: [MLA, Multi-head Latent Attention, 多头潜在注意力, 潜向量, latent, kv_lora_rank, q_lora_rank, 低秩压缩, 矩阵吸收, absorb, decoupled RoPE, 稀疏 MLA]
chapters: ["04"]
order: 30
sources:
  - https://arxiv.org/html/2405.04434v5
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1900-L1963
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1965-L2000
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L744-L788
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L776-L793
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1349-L1361
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104
  - vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793
  - vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028
  - vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L69-L134
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L800-L855
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L261-L362
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1106-L1134
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1235-L1291
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L573-L579
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_config.py#L12-L30
  - vllm@0fc695fc:vllm/config/model.py#L1284-L1288
  - vllm@0fc695fc:vllm/config/model.py#L1646-L1648
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L945-L956
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/mla_v1.py#L1549-L1560
  - vllm-ascend@baa023ad:vllm_ascend/attention/mla_v1.py#L1405-L1415
  - vllm-ascend@baa023ad:vllm_ascend/models/glm5next/attention.py#L180-L230
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_glm5next_config.py#L34-L51
  - vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L1606-L1618
  - vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L1134-L1214
  - vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L508-L522
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - { to: attention-qkv, kind: builds-on, note: 多头打分、softmax 和 V 汇合在那里讲；本页只改历史怎样存、怎样读 }
  - { to: glm-5-3-flash-two-node, kind: builds-on, note: 每 token 1,024 B、12 层合计 13,056 B 和 KV 块数的唯一推导 }
  - { to: kv-cache-spec, kind: builds-on, note: 主缓存、indexer 缓存与尾状态三份规格怎样变成页和组 }
  - { to: one-request, kind: builds-on, note: R1 在第 4 站经过 11 层稀疏 MLA 时每卡的形状 }
  - { to: linear-attention, kind: alternative-to, note: GLM 中与稀疏 MLA 交替使用的 KDA 状态机制 }
contradicts: []
updated: "2026-09-28"
origin: seed
---

## 每个历史位置都要把各个头的 K 和 V 全存下来吗？

[attention](attention-qkv.md) 里，每个注意力头都拿当前位置的 query（查询向量）去和历史位置的 key（键向量）打分，再按分数把 value（值向量）加权求和。为了不在每一步重算历史，推理引擎把每个历史位置的 K 和 V 存进 [KV cache](kv-cache.md)，也就是专门保存历史中间结果的一块显存。普通多头 attention 有多少个头，每个位置就要存多少份 K 和 V。

**MLA（Multi-head Latent Attention，多头潜在注意力）把一个位置给所有头用的 K 和 V 先压成一条短得多的向量，叫潜向量（latent），存进 KV cache；用到这个位置时，再由每个头各自的投影矩阵从潜向量得到这个头的 K 和 V，照常参与注意力计算。**

```wiki-diagram
file: mla-intuition
```

图从上往下读：

1. **压缩。** 新位置的隐藏向量（在层与层之间传递的那条向量）乘一个下投影矩阵，得到潜向量 c。所有头共用这一条，不再每个头各算一份 K、V 去存。
2. **只存潜向量。** KV cache 里每个位置只放一条 c。
3. **只取要用的位置。** 普通做法取因果范围内的全部位置（当前位置和它之前的位置）；GLM 这类稀疏模型只取 indexer（一个给历史位置打分、挑出本次要读哪些位置的小分支）选中的那些，怎么选归[稀疏注意力](sparse-attention.md)。
4. **展开。** 每个头用自己的上投影矩阵，从 c 得到这个头的 Kᵢ 和 Vᵢ。
5. **照常做 attention。** 多头打分、softmax、按权重汇合 V，和普通 attention 一模一样。MLA 改的是历史怎样存、怎样读，不改 attention 本身。

第 4 步画成「展开」，是为了看清数学关系。GLM 的稀疏 MLA 在推理时一次都不展开，而是把 K 的上投影挪到查询一侧、V 的上投影挪到汇合之后再乘，这叫**吸收**（absorb）；推导和什么时候仍会展开，见[后文](#吸收不展开也能打分和汇合)。

## 为什么要压，代价在哪？

**省的是 KV cache。** 以 GLM-5.3-Flash 的稀疏 MLA 层为例：64 个注意力头，每头 K、V 各 256 维。按普通多头 attention 存，每个位置每层要存 32,768 个数；MLA 只存一条 512 维潜向量：

```calc
title: 一个位置在一层里要存多少个数
普通多头 = 64 个头 × (256 + 256) = 32,768 个数
MLA = 潜向量 512 + RoPE 段 0 = 512 个数
压缩比 = 32,768 ÷ 512 = 64 倍
> RoPE 段在 GLM 为 0 维，原因见后文
```

换成字节、再乘上层数，每个 token 要占多少显存、一张卡能装多少块，只在部署页推一次：主潜向量每层每 token 1,024 B，连同 indexer 的压缩缓存，主干 11 层加 MTP 层合计每 token 13,056 B，见[部署页 · 剩下的显存变成多少 KV cache](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。

**代价有四笔：**

1. **模型必须按 MLA 训练。** 下投影、上投影都是模型参数，和模型一起训练。不能把一个已训练好的普通多头 attention 模型直接改成 MLA，还指望输出不变。
2. **读的时候多做矩阵乘。** 要么把读到的潜向量展开成各头的 K、V，要么用吸收把展开并进查询和输出投影。吸收以后，每个头在 512 维的潜空间里打分，比展开后的 256 维宽一倍。省下的显存有一部分换成了计算，最后快还是慢，要看历史长度、读取的位置数和内核实现，不能一概而论。
3. **TP 切不开潜向量。** 潜向量是所有头共用的。[TP（张量并行）](tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)把 64 个头分给 8 张卡以后，每张卡仍要存一份完整的潜向量；按头切的普通 K/V 在 TP8 下每卡只存八分之一。
4. **RoPE 挡住吸收。** 旋转位置编码 RoPE 会按位置旋转 K，让吸收失效，DeepSeek-V2 为此另存一小段带 RoPE 的 K，见[后文](#rope-为什么要另存一段)。GLM 没有这一段。

几种做法存的东西不一样：

| 做法 | 每个位置、每层存什么 | 每位置每层存多少个数 |
|---|---|---|
| 普通多头 attention（MHA） | 每个头一份 K、一份 V | 2 × 头数 × 每头维度 |
| [GQA](gqa.md) | 一组头共用一份 K、V | 2 × 组数 × 每头维度 |
| MLA | 一条所有头共用的潜向量，外加可选的 RoPE 段 | 潜向量维度 + RoPE 段维度 |
| [稀疏注意力](sparse-attention.md) | 不改存法，改每次读哪些位置 | 取决于和它搭配的存法 |

MLA 和稀疏注意力管的是两件事，可以叠加：GLM 的「稀疏 MLA」就是按 MLA 存、按稀疏选择读，[后文](#稀疏选择是压缩之上的另一层机制)专门讲两者怎样配合。

## 低秩压缩：一条潜向量怎样变回每个头的 K 和 V

MLA 由 DeepSeek-V2 提出。全页用行向量记法：向量写在左边，乘右边的矩阵。设 hₜ 是位置 t 的隐藏向量，所有头共用的下投影是 W_DKV，第 i 个头的上投影是 W_UKᵢ 和 W_UVᵢ：

```text
cₜ   = hₜ W_DKV       压缩：隐藏向量 → 潜向量，宽 d_c
kₜ,ᵢ = cₜ W_UKᵢ       第 i 个头的 K，从同一条 cₜ 上投影
vₜ,ᵢ = cₜ W_UVᵢ       第 i 个头的 V，用另一块矩阵
```

KV cache 里只存 cₜ。d_c 远小于「头数 × 每头维度」，所以叫**低秩**：把所有头的 K 投影拼成一个宽矩阵看，从隐藏向量到 K 等于先乘 W_DKV 压到 d_c 维、再乘拼起来的 W_UK 放大，是两片矩阵的乘积，秩不超过 d_c；V 也一样。不看中间的归一化时，这就是一个大矩阵被拆成了两片小矩阵。

实际模型比上面三行多两样东西。一是潜向量后面有一个 RMSNorm（一种只按均方根缩放的归一化），论文说是为了训练稳定；GLM 的实现在把潜向量写进缓存之前做这一步。二是 Q 也走一条压缩路线：先压成 d_c′ 维的中间表示，再上投影成各头的 Q。论文说 Q 的压缩是为了减少训练时的激活显存；它**不进 KV cache**，因为 Q 只属于当前位置，用完就丢。GLM 里 Q 的中间表示是 1536 维（配置项 q_lora_rank），缓存里的潜向量是 512 维（配置项 kv_lora_rank），这是两个不同的张量。

论文里的 DeepSeek-V2 取 128 个头、每头 128 维、d_c = 512、d_c′ = 1536，另有 64 维的 RoPE 段（下一节讲）。于是每个位置每层缓存 512 + 64 = 576 个数，而普通多头要 2 × 128 × 128 = 32,768 个；论文把 MLA 的缓存量折算成「只有 2.25 组的 GQA」，同时报告效果不输普通多头。GLM-5.3-Flash 沿用同样的结构，只是头数、每头维度不同，而且没有 RoPE 段。

## 吸收：不展开也能打分和汇合

把历史潜向量按位置排成矩阵 C（每行一个位置），第 i 个头展开后的 K、V 和这个头的打分、汇合可以改写成：

```text
Kᵢ = C W_UKᵢ
Vᵢ = C W_UVᵢ
qᵢ Kᵢᵀ = (qᵢ W_UKᵢᵀ) Cᵀ
pᵢ Vᵢ  = (pᵢ C) W_UVᵢ
```

qᵢ 是当前位置第 i 个头的查询，pᵢ 是打分经过缩放、掩码和 softmax 之后的权重。第三行把 K 的上投影挪到了查询一侧：先把 qᵢ 乘上 W_UKᵢᵀ，得到一条 d_c 维的「潜空间查询」，直接和潜向量 C 打分。第四行把 V 的上投影挪到了汇合之后：先用权重把潜向量加起来，得到 d_c 维的结果，再乘一次 W_UVᵢ。W_UKᵢ 和 W_UVᵢ 与位置无关，先乘哪一边结果都一样。挪到查询一侧更省：本轮新算的 token 只有几个，历史却可能有成千上万个位置，这样就不用把每个历史位置逐个展开。

这样一来，打分和汇合用的是**同一份** C：打分时它当 K，汇合时它当 V。GLM 在昇腾上的实现正是这样做的：

1. **加载权重后拆矩阵。** KV 的展开投影（kv_b_proj）被拆成 K 的一块和 V 的一块，转好布局存下，原来的投影随即释放，所以显存里不会同时放两份。
2. **查询进潜空间。** 每卡 8 个头的查询先由 Q 展开投影得到（每头 256 维），再乘 K 的那一块，变成每头 512 维。
3. **内核只读潜向量。** 稀疏 FlashAttention 内核（FlashAttention 是把打分、softmax、汇合融合进一个分块计算的内核写法，中间的分数矩阵不整块写回显存）把同一份 512 维潜向量缓存同时当作 key 和 value 传入，按位置清单逐个读取，打分、softmax、汇合都在 512 维里完成。
4. **汇合后再回到每头维度。** 内核输出每头 512 维，乘 V 的那一块回到每头 256 维，再交给输出投影。

吸收不是唯一的做法。vllm-ascend 给 DeepSeek 这类模型用的通用 MLA 后端，在 prefill（一次处理整段提示词）时本轮新 token 多，不走吸收：本轮新位置的潜向量，连同已经缓存的前文（分块 prefill 的前几块，或前缀缓存命中的部分，按块从缓存取回），都经 KV 展开投影展开成各头的 K、V，按普通多头 attention 算；decode（逐个生成）时才走吸收。GLM 的稀疏 MLA 后端在加载后就释放了 KV 展开投影，prefill 和 decode 都走吸收。

所以不能把「先把全部历史展开成 K、V」写成 MLA 每一步必经的环节。上面的等式说明计算为什么成立；实际内核还会融合投影、处理分片、调整布局。压缩减少的是要长期保存的状态，计算量则由投影、潜空间宽度和内核实现共同决定，不能据此断言一定更快，也不能断言一定多算。

## RoPE 为什么要另存一段

[RoPE（旋转位置编码）](rope.md)按位置编号把 Q 和 K 各旋转一个角度，让打分能感知两个位置相隔多远。旋转矩阵随位置变化。如果把 RoPE 直接加在从潜向量展开的 K 上，打分就变成 qᵢ · R(t−s) · W_UKᵢᵀ · cₛᵀ 这样的形式（t 是当前位置，s 是某个历史位置，R(t−s) 是转过 t−s 个位置的旋转），中间夹着一个随两个位置之差变化的旋转，每个历史位置都不一样。矩阵乘法不能随意交换顺序，找不到一个固定矩阵能把 W_UKᵢ 并进查询一侧，吸收失效。

DeepSeek-V2 的办法叫 **decoupled RoPE**：把位置信息拆到一条单独的小通道里。每个头多出一小段带 RoPE 的查询，所有头共用一小段带 RoPE 的键；这段键直接从隐藏向量算出、旋转后存进缓存。打分时，不带位置的部分走吸收，带位置的小段照常点乘，两部分相加。代价是每个位置多存 d_h^R 个数，DeepSeek-V2 里是 64。

### GLM 的这一配置不保存 RoPE 段

GLM-5.3-Flash 的配置把 RoPE 段宽度（qk_rope_head_dim）设成 0。模型代码只在这个宽度大于 0 时才为主 attention 和 indexer 构造 RoPE；写缓存的函数也只在宽度大于 0 时才旋转。于是每层主缓存只剩 512 维潜向量，没有额外的 64 维位置段，吸收也不用绕开任何东西。

没有 RoPE 不等于没有位置信息。稀疏 MLA 层和 indexer 都不加 RoPE，模型的位置感来自别处：[KDA](linear-attention.md) 层（一种不存逐位置 K/V、只保留固定大小状态的线性注意力）按顺序逐个递推，indexer 压池时带池内位置偏置，attention 本身又有因果范围。三处的细节见[模型页的稀疏 MLA](glm-5-3-flash.md#稀疏-mla先把历史压短再挑着读)。

### 每个位置缓存多少字节

按上面的结构，一个 MLA 层给每个位置存的就是「潜向量 + RoPE 段」这一条，每位置每层的字节数 = (d_c + d_h^R) × 每个数占的字节。vLLM 把 MLA 层当成只有 1 个 KV 头：缓存规格里每层每位置 1 个「头」，头宽就是 d_c + d_h^R，没有「K 一份、V 一份」的那个 2。因此配置文件里的 num_key_value_heads（GLM 写的是 64）不能代进普通 K/V 缓存公式；实际保存什么，以这一层的实现和缓存规格为准。

GLM 的三个取值是：潜向量 512 维、RoPE 段 0 维、主缓存精度在代码里写死为 BF16。代入后每层每 token 占多少字节，主干 11 层加 MTP 层、连同 indexer 压缩缓存每 token 合计多少，都只在[部署页 · 为什么一个逻辑块是 640 个 token](glm-5-3-flash-two-node.md#为什么一个逻辑块是-640-个-token) 和[占住一个块号要用多少显存](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)里推导，结果见[为什么要压，代价在哪](#为什么要压代价在哪)。

主潜向量之外，一层稀疏 MLA 还有 indexer 的压缩缓存和尾状态；块里有空位，前向还有临时张量。只算主潜向量得不到这一层的全部状态。三份缓存各自的规格、怎样对齐成页、分成几个组，见 [KV Cache Spec · 每张卡报四份规格](kv-cache-spec.md#每张卡报四份规格)。

## 放到 GLM 双机：一个 token 走过一层稀疏 MLA

这一站在主线的[第 4 站 · 11 层稀疏 MLA](one-request.md#11-层稀疏-mla)。部署是 2 台 A2 × 8 卡、机内 TP8，前提统一见[部署前提](glm-5-3-flash-two-node.md#部署前提)。

### 哪些层是 MLA，每层存什么

GLM-5.3-Flash 主干 45 层里，第 3、7、11……43 层共 11 层是稀疏 MLA，其余 34 层是 [KDA](linear-attention.md)。开了 MTP（模型自带的草稿层，先猜后面几个 token）的部署里，第 45 层也是一个稀疏 MLA 层，有自己的一套缓存，所以存 KV 的 MLA 层按 12 层计。每个稀疏 MLA 层在本轮为新位置产生潜向量和 indexer 状态，并读取可见的历史；层输出接着送进残差连接和后面的前馈部分。

配置里和 MLA 有关的几项：

| 配置项 | GLM 的值 | 管什么 |
|---|---|---|
| hidden_size | 4096 | 进出这一层的隐藏向量宽度 |
| num_attention_heads | 64 | 主 attention 的头数，TP8 下每卡 8 个 |
| kv_lora_rank | 512 | 缓存里潜向量的宽度 |
| q_lora_rank | 1536 | Q 中间表示的宽度，不进缓存 |
| qk_nope_head_dim / qk_rope_head_dim | 256 / 0 | 每头 K 的不带位置部分 / RoPE 段 |
| v_head_dim | 256 | 每头 V 的宽度 |

**因为 q_lora_rank 有值，每层只建四个投影：** Q 与 KV 合并的压缩投影（4096 → 1536 + 512）、Q 展开投影（1536 → 64 × 256）、KV 展开投影（512 → 64 × (256 + 256)）、输出投影（64 × 256 → 4096）。q_lora_rank 为空的模型才会改建单独的 KV 压缩投影和 Q 投影。两个 RMSNorm 只带一条缩放向量，不算投影。四个投影建层时都接了量化配置，实际是 8 位还是 BF16 由量化描述文件决定，见[量化 · 哪些矩阵是 8 位](quantization.md#哪些矩阵是-8-位哪些保持-bf16)。

分工上，vLLM 为这些状态规划容量、管理请求与块的对应关系；vllm-ascend 的 GLM 专用层和后端负责具体的缓存布局与算子执行。

### 一个 token 走过一层：每张卡做什么

跟着一个新 token 看它在一层稀疏 MLA 里的六步，形状都按每张卡写：

1. **压缩。** 本卡用一整份合并压缩投影（不按 TP 切，每卡各算一遍）把 4096 维隐藏向量变成 2048 维，切成 1536 维的 Q 中间表示和 512 维的 KV 潜向量，各做一次 RMSNorm。
2. **写历史。** 512 维潜向量写进本层主缓存里这个位置的槽位；RoPE 段为 0，跳过旋转。TP 组 8 张卡写的是同一份完整潜向量。
3. **选位置。** indexer 用同一份 1536 维 Q 中间表示和隐藏向量给历史打分，交出这个 token 的位置清单，每行最多 2051 个位置（来历见[稀疏注意力](sparse-attention.md#候选位置从哪里来)）。
4. **准备查询。** Q 展开投影按头切，本卡只算 8 个头、每头 256 维；再乘 K 的上投影块，吸收成每头 512 维。
5. **读和汇合。** 稀疏 FlashAttention 内核按清单经 [block table](block-table.md) 找到各位置的潜向量，一次取一个位置，把它同时当 K 和 V，在 512 维里算完本卡 8 个头的打分、softmax 和汇合。
6. **回到隐藏维。** 每头 512 维乘 V 的上投影块回到 256 维，8 个头拼成 2048 维，经输出投影（按行切）得到 4096 维的部分和；最后一次 TP8 [All-Reduce](collective-communication.md#all-reduce) 把 8 张卡的部分和加起来。

```wiki-diagram
file: mla
```

图里三列分别是写历史、准备查询、选位置，三路在内核处汇合。一层只有第 6 步那一次集合通信；indexer 和选位置都在卡内完成、不通信（每卡各算一遍、各存一份 indexer 权重），按卡怎样分工见[稀疏注意力 · 放到 GLM 双机](sparse-attention.md#放到-glm-双机一个查询在一层稀疏-mla-里怎样挑怎样读)。TP8 下每一步为什么这样切，见[张量并行 · 稀疏 MLA](tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)。R1 是主线里 prompt 为 4 个 token 的示例请求，它在这一层每卡的具体形状见[一条请求 · 11 层稀疏 MLA](one-request.md#11-层稀疏-mla)。

### 稀疏选择是压缩之上的另一层机制

压缩后的 MLA 本身仍可以对全部可见历史打分。稀疏结构再加一个较轻的 indexer 分支：先选候选位置，再做主 attention。所以 **MLA 决定历史怎样表示，稀疏选择决定这次查询用哪些历史位置**；新增的成本是 indexer 的计算和它自己的状态。indexer 怎样压池、打分、选池、补尾，归[稀疏注意力 · 候选位置从哪里来](sparse-attention.md#候选位置从哪里来)，这里只讲两者怎样接上。

GLM 的 indexer 取 32 个查询头、每头 128 维，每 4 个位置压成一池，每个查询的位置预算 index_topk 为 2048（不是缓存块大小），这几个数怎样用见[稀疏注意力 · 候选位置从哪里来](sparse-attention.md#候选位置从哪里来)。

两者在一层里有三个接口：

1. **共用 Q 的中间表示。** indexer 的查询投影从 MLA 那条 1536 维 Q 中间表示出发，展开成 32 头 × 128 维；它的 K 另由隐藏向量算出。所以 MLA 的合并压缩投影同时在给 indexer 备料。
2. **indexer 交位置编号，MLA 按编号读潜向量。** indexer 的输出是一张位置清单；主 attention 按清单去读 MLA 主缓存里对应位置的 512 维潜向量，一次一个位置。清单里的 −1 是空名额，不读。
3. **状态各存各的。** 一层稀疏 MLA 挂三份缓存：MLA 主潜向量、indexer 已完成池的压缩缓存，以及未凑满一池的位置留下的高精度尾状态。池化让一个完整的池只占一条 indexer 条目；没凑满的池还在更新，要另外留着。三份各有缓存规格，见 [KV Cache Spec](kv-cache-spec.md#每张卡报四份规格)。

几条边界：查询先筛候选、再在候选范围内做主 attention，因果范围和有效位置照样要检查。候选变少不代表 indexer 阶段不花时间，也不代表没选中的历史可以从缓存里删掉：不同查询会选不同位置，后面的 token 仍可能用到此前落选的历史。历史不超过 2051 个位置时，稀疏 MLA 读到的就是全部因果历史，见[稀疏什么时候才真的起作用](sparse-attention.md#稀疏什么时候才真的起作用)。容量与计算两种代价怎样分开比较，见[注意力代价](attention-cost.md)。

## 常见误解

- **「decode 时要先把潜向量解压回每个头的 K 和 V。」** 不用。吸收把 K 的上投影挪到查询一侧、V 的上投影挪到汇合之后；GLM 的内核把同一份潜向量同时当 K 和 V 读，见[吸收](#吸收不展开也能打分和汇合)。
- **「配置里 num_key_value_heads 是 64，所以每个位置存 64 份 K/V。」** 不对。vLLM 把 MLA 层按 1 个 KV 头处理，每位置每层只存一条潜向量（外加 RoPE 段，GLM 为 0），见[每个位置缓存多少字节](#每个位置缓存多少字节)。
- **「TP8 下每张卡只存八分之一的潜向量。」** 不对。潜向量是所有头共用的，TP 组里每张卡都存完整一份；按头切的只有 Q 展开、KV 展开和输出三个投影。
- **「Q 的 1536 维中间表示也进了缓存。」** 不对。它只属于当前位置，用来展开 Q 和喂给 indexer，用完就丢；缓存里只有 512 维潜向量。
- **「GLM 的 MLA 也有 64 维 RoPE 段。」** 64 维是 DeepSeek-V2 的配置。GLM 的 RoPE 段宽度为 0，主缓存只有 512 维潜向量。
- **「MLA 和稀疏注意力是一回事。」** MLA 决定每个位置存成什么，稀疏决定这次读哪些位置；GLM 两者都用，但可以分开理解。
- **「压缩了 64 倍，attention 就快 64 倍。」** 64 倍说的是缓存大小。吸收以后每个头在 512 维里打分，比展开后的 256 维还宽；快慢要看读取的位置数、内核和访存，没有实测不能折算。
- **「只算潜向量就能得到稀疏 MLA 层的全部显存。」** 还要加 indexer 的压缩缓存和尾状态，以及块里的空位；12 层合计的账见[部署页](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)。

## 对照源码

### 怎么开

MLA 没有单独的开关，由模型配置和模型代码决定，要满足三处：

1. **vLLM 认出这是 MLA 模型。** vLLM 用 `use_mla` 判断：模型在 MLA 白名单里，且环境变量 `VLLM_MLA_DISABLE` 没有设置。vLLM 0.23 的白名单里没有 GLM 的模型类型，GLM 镜像的插件补丁改成「配置里有 `kv_lora_rank` 就算 MLA」。于是 `use_mla` 为真，缓存头宽取 `kv_lora_rank + qk_rope_head_dim`（512 + 0），每卡 KV 头数取 1。
2. **模型按层号建稀疏 MLA 层。** 不在 KDA 层号表里的层建成稀疏 MLA；`q_lora_rank` 有值，所以走合并压缩投影那一支，只建 `fused_qkv_a_proj`、`q_b_proj`、`kv_b_proj`、`o_proj` 四个投影。
3. **GLM 子类关掉两条融合路径。** 注意力后端的 GLM 子类在初始化时把 `enable_sfa_prolog_v3` 和 `enable_mlapo` 强制设为假，本部署一定走分步的原生路径，也就是流程图画的那一条。

部署命令统一见[部署前提](glm-5-3-flash-two-node.md#部署前提)。`VLLM_MLA_DISABLE` 本部署不设置；GLM 专用层自己报缓存规格（固定 1 个头、512 维），设置这个变量后行为会怎样，没有核对。

### 会报什么错

| 条件 | 报错 | 本部署上怎样判断 |
| --- | --- | --- |
| 头数不能被 TP 大小整除 | 建层时 `assert num_heads % tp_size == 0` 失败 | 64 个头、TP8，每卡 8 个，不会触发 |
| 缓存份数不对 | `ValueError: Indexer KPool MLA expects ... caches, got ...` | 一层应挂主潜向量、indexer 状态、indexer 缓存三份 |
| 三份缓存的角色顺序不对 | `ValueError: Indexer KPool MLA metadata roles must match cache order ...` | 顺序固定为主缓存、indexer 状态、indexer 缓存 |
| 潜向量缓存宽度不对 | `ValueError: Indexer KPool MLA latent cache dim must be ...` | 应等于 `kv_lora_rank`，本配置为 512 |
| RoPE 缓存宽度不对 | `ValueError: Indexer KPool MLA RoPE cache dim must be ...` | 应等于 `qk_rope_head_dim`，本配置为 0 |
| 取不到打包的潜向量缓存 | `ValueError: Indexer KPool MLA sparse attention requires the packed MLA cache.` | 内核读的是打包后的整份主缓存 |

以上都是源码里的检查点，没有在 NPU 上故意触发。和位置清单、掩码模式有关的报错见[稀疏注意力的报错表](sparse-attention.md#会报什么错)。

### 开销和什么时候别开

这个模型不能关掉 MLA：权重就是按 MLA 训练的。能看的是开销落在哪里。

- **潜向量每卡一整份。** TP 分不掉 512 维主缓存；每 token 每层的字节数和能切出多少 KV 块，见[部署页的 KV 预算](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。
- **合并压缩投影和 indexer 每卡一整份。** 它们不按 TP 切，每卡各存、各算一遍，换掉一次通信；每卡每层的权重见[部署页 · 每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)。
- **KV 展开投影不占两份。** 加载后拆成 K、V 两块，原投影立即释放。
- **打分宽度变成 512。** 吸收后每头在 512 维里打分和汇合；按清单宽度算的每卡计算上界和读取量见[稀疏注意力](sparse-attention.md#稀疏什么时候才真的起作用)。
- **主缓存精度写死为 BF16。** 缓存规格里直接写了 bfloat16，启动参数 `--kv-cache-dtype` 改不了它，见[部署页 · 怎么开](glm-5-3-flash-two-node.md#怎么开)。

### 版本差异

**吸收的做法三版一致；差别在有没有 GLM 模型、怎样把 GLM 认作 MLA，以及没有 RoPE 段时怎样写缓存。** 按知识库的固定快照核对：v0.23 为 Ascend 2c59ff10 维护快照，v0.26 为 Ascend 2ed6cbba，main 为 Ascend baa023ad；本页的 GLM 行为按专用镜像 db701c1f 解释。

| 检查项 | v0.23 | v0.26 | main |
| --- | --- | --- | --- |
| 通用 MLA 后端的吸收 | 有：加载后把 KV 展开投影拆成 K、V 两块 | 同 v0.23 | 同 v0.23 |
| 无 RoPE 段时写缓存 | 通用后端没有这条分支；镜像 db701c1f 由 GLM 子类按 RoPE 段宽度是否大于 0 决定旋不旋转 | 通用后端有 `use_mla_rope`，为假时走不带 RoPE 的写缓存函数 | 同 v0.26 |
| GLM 模型与四个投影 | 维护快照没有；镜像中为 `models/glm5_next.py` | 没有 GLM 模型文件 | 拆到 `models/glm5next/`，仍按 `q_lora_rank` 分两支；`kv_b_proj` 建层时不接量化配置 |
| 把 GLM 认作 MLA | vLLM 0.23 白名单没有 GLM；镜像插件补丁按 `kv_lora_rank` 判断 | 没有 GLM，不涉及 | 插件补丁改写 `is_deepseek_mla`，GLM 的模型类型按 `kv_lora_rank` 判断 |

main 的 GLM 从模型层到内核的完整调用链、主缓存精度是否仍写死为 BF16，没有逐行核对；三个版本能否整套跑通本部署，也没有核验。

### 源码位置

按「建层 → 写缓存 → 吸收 → 读取 → 输出」的顺序读，可以把流程图对回实现：

| 要核对什么 | 固定源码位置 |
| --- | --- |
| 四个投影、按 `q_lora_rank` 分支、头数整除检查 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1900-L1963` |
| RoPE 只在宽度大于 0 时构造 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1965-L2000` |
| 写缓存：RMSNorm、按条件旋转、写槽位 | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L744-L788` |
| 加载后拆出 K、V 两块上投影 | `vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L776-L793` |
| 查询吸收 K 的上投影 | `vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1349-L1361` |
| 推理用的稀疏 attention 入口（子类重写） | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104` |
| 设备算子：潜向量同时当 K、V，不传 RoPE | `vllm-ascend@db701c1f:vllm_ascend/device/device_op.py#L719-L793` |
| V 的上投影、输出投影与 All-Reduce | `vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1994-L2028` |
| 主缓存规格：头宽、BF16、1 个 KV 头 | `vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L69-L134` |
| 三份缓存的份数与角色检查 | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L800-L855` |
| indexer 压缩缓存与尾状态的规格 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L261-L362` |
| indexer 接收 Q 中间表示 | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1106-L1134`；`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1235-L1291` |
| 融合路径强制关闭 | `vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L573-L579` |
| 通用 MLA 后端：prefill 按块取回已缓存前文、经 KV 展开投影展开 | `vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L1134-L1214`；前文长度取已算 token 数：`vllm-ascend@db701c1f:vllm_ascend/attention/mla_v1.py#L508-L522` |
| 插件把 GLM 认作 MLA | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_config.py#L12-L30` |
| vLLM：MLA 每卡 1 个 KV 头；`use_mla` 与禁用变量 | `vllm@0fc695fc:vllm/config/model.py#L1284-L1288`；`vllm@0fc695fc:vllm/config/model.py#L1646-L1648` |

流程图的分支：`q_lora_rank` 有值时建合并压缩投影，否则建单独的 `kv_a_proj_with_mqa` 和 `q_proj`；写缓存时 RoPE 段宽度大于 0 才旋转。读取侧执行子类重写的入口，A2 落到基础设备适配器，见[稀疏注意力的源码位置](sparse-attention.md#源码位置)。

**出处修正。** 旧版把「按选中位置取潜向量、算分数与 softmax」的出处指向 `indexer_kpool_mla_v1.py` 第 980–1061 行。这一段属于 `_sparse_attention_pytorch`（第 857–1064 行），只有单测调用，推理时不执行。本页改为上表「推理用的稀疏 attention 入口」和「设备算子」两行，与稀疏注意力页一致。

**正文证据索引。** 低秩联合压缩、上投影可吸收进查询与输出投影、Q 的压缩只为减少训练激活显存、潜向量后的 RMSNorm、decoupled RoPE 的动机与结构、各种注意力每位置缓存量的公式与「2.25 组 GQA」、DeepSeek-V2 的头数和各维度，见 [S1]。GLM 的头数、各维度、RoPE 段为 0、num_key_value_heads、indexer 参数与层号，见 [S2]。四个投影与分支见 [C3]；RoPE 的条件见 [C4]、[C5]；吸收见 [C6]、[C7]，通用后端在 prefill 时仍展开见 [C25]；推理读取见 [C8]、[C9]；V 的上投影、输出投影与通信见 [C10]；主缓存规格见 [C11]；三份缓存见 [C12]、[C13]；indexer 接 Q 中间表示见 [C14]、[C15]；融合路径见 [C16]；把 GLM 认作 MLA 见 [C17]、[C24]；每卡 1 个 KV 头与禁用变量见 [C18]、[C19]。版本差异依据 [C20]、[C21]、[C22]、[C23]；v0.23 通用后端没有无 RoPE 分支，是在 2c59ff10 的 `mla_v1.py` 中检索 `use_mla_rope` 与 `_exec_kv_no_rope` 无结果得出的。

正文算式和结论各自采用以下推导口径：

- 64 倍压缩比按配置直接计算，取自主线底稿 02 §5.1、§5.2。[D]
- 四个投影的形状、每卡 8 个头、合并压缩投影与 indexer 不按 TP 切、一层一次 All-Reduce，取自底稿 02 §5.2、§5.8。[D]
- 三份缓存、每层每 token 1,024 B 与每 token 13,056 B 的结论取自底稿 02 §5.6，推导在部署页；R1 的形状取自 §5.9，在主线页。[D]
- 直觉图的 10 个位置、选中 4 个是教学假设，不是 GLM 的实际选择。[A]

**待核：** 本页依据固定源码和论文分析，没有在 NPU 上运行，也没有验证最终镜像；部署依据与未决项统一记录在[来源基线](../sources/glm-5-3-flash-baseline.md)。缺稀疏 FlashAttention 内核的设备 trace，吸收后 512 维打分的实际耗时、分块方式和 HBM 读写量都没有实测。四个投影的实际精度缺量化描述文件。main 的 GLM 调用链与主缓存精度未逐行核对。`VLLM_MLA_DISABLE` 对 GLM 专用层的影响未核。
