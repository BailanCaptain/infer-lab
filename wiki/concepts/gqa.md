---
id: gqa
title: GQA：几个查询头共读一组 K、V，省下什么、付出什么
type: concept
summary: >-
  GQA 把查询头分组，同组共读一组 K、V，K/V 投影与缓存按 KV 头数缩小，打分与汇合仍逐头计算，且须在训练时定下。GLM 的稀疏 MLA 与 KDA
  都不是 GQA，本页只作对照。
aliases:
  - GQA
  - Grouped-Query Attention
  - 分组查询注意力
  - 分组查询
  - MQA
  - Multi-Query Attention
  - 多查询注意力
  - MHA
  - Multi-Head Attention
  - 多头注意力
  - num_key_value_heads
  - num_kv_heads
  - num_queries_per_kv
  - num_kv_head_replicas
  - KV 头数
  - 注意力头
  - head
  - 多头
  - Q 头
  - KV 头
chapters:
  - '04'
order: 15
sources:
  - 'https://arxiv.org/html/2305.13245v3'
  - 'vllm@0fc695fc:vllm/model_executor/layers/linear.py#L1000-L1042'
  - 'vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L279-L292'
  - 'vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L452-L513'
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L414-L428'
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1336-L1359'
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/eb9eb208eb0d988989d07a6a12d0fdeb5f52574a/config.json
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1901-L1962'
  - 'vllm@0fc695fc:vllm/model_executor/models/llama.py#L144-L156'
  - 'vllm@0fc695fc:vllm/model_executor/models/llama.py#L290-L296'
  - 'vllm@0fc695fc:vllm/model_executor/layers/linear.py#L1358-L1363'
  - 'vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L183-L201'
  - 'vllm@0fc695fc:vllm/v1/attention/backends/cpu_attn.py#L444-L456'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L440-L451'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L1378-L1389'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L526-L538'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L948-L959'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L121-L134'
  - >-
    vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L110-L134
  - 'vllm@0fc695fc:vllm/distributed/utils.py#L52-L63'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/attention_v1.py#L414-L428'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/transformers_utils/configs/glm5_next.py#L23-L50
  - >-
    vllm-ascend@db701c1f:vllm_ascend/transformers_utils/configs/glm5_next.py#L128-L134
  - >-
    raw:sha256-96369723e69c470d91ca318d4e4d5324d91cb9d72c37ce9b045a7596a6aad1bf.md#L1-L490
  - >-
    vllm-ascend@baa023ada41a5b889cac6249845a688aab130892:vllm_ascend/models/glm5next/model.py#L79-L82
  - 'vllm-ascend@7d825229:vllm_ascend/attention/attention_v1.py#L549-L564'
  - 'vllm-ascend@7d825229:vllm_ascend/attention/attention_v1.py#L958-L990'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1688-L1701'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1714-L1768'
  - 'vllm-ascend@7d825229:vllm_ascend/platform.py#L1688-L1711'
  - 'vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L928-L947'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - main
evidence: C
relations:
  - to: attention-qkv
    kind: builds-on
    note: 多头各自打分与汇合在那里讲；本页只讲查询头和 K、V 之间怎样共享
  - to: one-request
    kind: builds-on
    note: R1 在第 4 站走过 34 层 KDA 与 11 层稀疏 MLA 时每卡的形状，唯一推导处
  - to: tensor-parallel
    kind: builds-on
    note: 按头切到各卡的做法；本页补 KV 头少于卡数时的复制
  - to: mla
    kind: alternative-to
    note: GLM 稀疏 MLA 层存一条共享潜向量，而不是减少 K、V 的组数
  - to: linear-attention
    kind: alternative-to
    note: GLM 的 KDA 层不存逐位置的 K、V，历史压进固定大小的状态
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-88aad6e2c87b2b55e02c8d48d87f34f1dc39543c6eef52e0db3e6532d6466ee5.md
  - >-
    raw/sha256-96369723e69c470d91ca318d4e4d5324d91cb9d72c37ce9b045a7596a6aad1bf.md
---

## 几个查询头能不能共读一组 K、V？

先回顾 [attention](attention-qkv.md)：每个位置的隐藏向量（一排数）乘三个不同的权重矩阵，得到三条向量。查询 Q（query）是这个位置拿去找别人的，表示「我要找什么」；键 K（key）是每个位置等着被找的，决定它分到多少权重；值 V（value）是被找到后交出去的内容。当前位置拿自己的 Q 和每个历史位置的 K 做点积打分，把分数换成加起来等于 1 的权重，再按权重把各位置的 V 加成自己的输出。

多头注意力 MHA（Multi-Head Attention）把 Q、K、V 各切成几段，每段叫一个注意力头（attention head），各自打分、各自汇合，最后把各头的输出拼起来，见[多头](attention-qkv.md#多头同一个位置同时按几套方式去读)；所以在 MHA 里，每个头都有自己的 Q、K、V。为了不在每一步重算历史，推理时每个历史位置的 K、V 要存进 [KV cache](kv-cache.md)；头越多，存得越多。

**GQA（Grouped-Query Attention，分组查询注意力）把查询头分成几组，同一组里的查询头读同一组 K、V：它们面对的历史一样，但各用自己的 Q 打分，仍各自得到一份输出。少了的是 K、V 的份数，查询头和输出的份数不变。**

```wiki-diagram
file: gqa
```

图从下往上读：最下面是一组组 K、V，箭头指向读它的查询头；每个查询头再得出自己那一份输出。三栏的查询头都是 4 个，只有 K、V 的组数不同：

| 结构 | K、V 组数（KV 头数） | 每组几个查询头 |
|---|---|---|
| MHA | 等于查询头数 | 1 个 |
| GQA | 多于 1、少于查询头数 | 查询头数 ÷ 组数 |
| MQA（Multi-Query Attention，多查询注意力） | 1 | 全部查询头 |

Ainslie 等人 2023 年的 GQA 论文把分成 G 组的做法记作 GQA-G：只有 1 组时就是 MQA，组数等于查询头数时就是 MHA，三者是同一个旋钮的不同位置。实现里「一组 K、V」常叫一个 KV 头，组数就是 KV 头数；分组要等分，查询头数必须是 KV 头数的整数倍。

共享只发生在一个请求的同一层、同一个位置之内：同组查询头读的是这个请求自己的历史 K、V，不同请求的历史不会因为 GQA 混在一起。

## 为什么要省 K、V，代价在哪？

**K、V 值得省，是因为 KV cache 又大、又每一步都要读。** KV cache 为每个请求、每一层、每个历史位置各存一份 K、V：历史越长、同时处理的请求越多，它就越大，占住的显存越多，一张卡能同时接的请求就越少。按 [KV cache 页](kv-cache.md#存一份要多少从一个位置一层往上乘)的示意尺寸（32 个查询头、每头 128 维、32 层、BF16，每个数 2 字节），一条 4,096 token 的请求，如果每个查询头各配一组 K、V（MHA），要占 2 GiB；让 4 个查询头共读一组（8 组 K、V），降到 512 MiB。这笔账在[缓存容量](#缓存容量按-kv-头数计算)一节一步步算。

decode（逐个生成新 token 的阶段）每一步只算很少几个新位置，但每个新位置的每个查询头都要把这一层所有历史位置的 K、V 读一遍。GQA 论文指出，解码时反复从显存载入 K、V 的带宽开销是推理变慢的主要来源之一；K、V 的份数少了，要存的和每步要读的都跟着少。

MQA 把 K、V 砍到 1 组，缓存和每步要载入的 K、V 都缩到 MHA 的「1 ÷ 查询头数」，速度快，但论文观察到质量会下降，训练也可能不稳定。GQA 取中间：论文在 T5 XXL 上把 MHA 改成 8 组（GQA-8），质量接近 MHA，推理速度接近 MQA。论文还指出，模型越大查询头越多，MQA 砍得越狠；按组共享能让 K、V 随模型放大保持同样的缩减比例。

代价有三笔：

1. **质量换容量。** 组越少，同一段历史能以多少种不同的 K、V 被读到就越少。组数是在质量和 K、V 开销之间取的折中。
2. **只能在训练时定。** KV 头数是模型结构的一部分，K、V 投影矩阵按它训练。论文把已训练好的 MHA 模型改成 GQA 的做法是：同组各头的 K、V 投影矩阵取平均合成一个，再用约原预训练 5% 的计算量继续训练（论文叫 uptraining）。只改配置里的 KV 头数、沿用原权重，既不是无损压缩，也不是推理时的开关。
3. **打分和汇合一点没少。** 共享的只是 K、V，每个查询头照样逐位置打分、汇合。三处开销要分开看：

| 环节 | 查询头数和每头宽度不变、只减少 KV 头时 |
|---|---|
| 算出 K、V 的投影 | 输出宽度按 KV 头数缩小；忽略偏置时参数量 = 隐藏宽度 × KV 头数 × (K 每头宽 + V 每头宽)，乘加同比例减少 |
| 打分与汇合 | 一个位置读 S 个历史位置，打分约要 查询头数 × S × K 每头宽 次乘加，汇合约要 查询头数 × S × V 每头宽 次，和 KV 头数无关 |
| 缓存与读取 | 要存的 K、V 份数按 KV 头数缩小；同组查询头能否共用一次读取，由算子实现决定 |

所以「GQA 省显存、不省计算」说得太绝对：K、V 投影的计算省了，打分与汇合没省。也不能从缓存缩小的比例直接推出加速倍数：prefill（处理提示词、可分多轮完成的阶段）和 decode、批大小、上下文长度、算子实现都会改变瓶颈，快多少要按负载实测。

## 同组的查询头怎样共读一组 K、V？算一遍

**同一组里的查询头拿到的是同一份 K、V，但各用自己的 Q 打分，所以权重不同，输出也不同。** 用图里 GQA 那一栏当例子（示意）：4 个查询头 Q₀–Q₃ 分成 2 组，Q₀、Q₁ 读第 0 组 K、V，Q₂、Q₃ 读第 1 组；每头 2 个数，历史有 3 个位置（0、1、2）。第 0 组的 K、V 沿用 [attention 页多头一节](attention-qkv.md#多头同一个位置同时按几套方式去读)里头 0 的数：

| 第 0 组（示意） | 位置 0 | 位置 1 | 位置 2 |
|---|---|---|---|
| K | k₀ = [2, 1] | k₁ = [0, 1] | k₂ = [1, 0] |
| V | v₀ = [1, 0] | v₁ = [0, 1] | v₂ = [1, 1] |

跟着位置 2 走：它的 Q₀ = [1, 2]，Q₁ = [0, 1]（示意）。两个查询头各拿自己的 Q 和同一组 k₀、k₁、k₂ 做点积；每头 2 个数，所以分数除以 √2（为什么要缩小，见 [attention 页](attention-qkv.md#为什么要除以-d)）；再用 softmax（把一排分数换成加起来等于 1 的权重的函数）换成权重；最后按权重把同一组 v₀、v₁、v₂ 加起来：

```calc
title: 同组两个查询头读同一组 K、V（示意）
Q₀ 的点积 = [1×2 + 2×1, 1×0 + 2×1, 1×1 + 2×0] = [4, 2, 1]
Q₀ 的权重（保留两位小数） = softmax([4, 2, 1] ÷ √2) = softmax([2.83, 1.41, 0.71]) = [0.73, 0.18, 0.09]
Q₀ 的输出 = 0.73 × [1, 0] + 0.18 × [0, 1] + 0.09 × [1, 1] = [0.82, 0.27]
Q₁ 的点积 = [0×2 + 1×1, 0×0 + 1×1, 0×1 + 1×0] = [1, 1, 0]
Q₁ 的权重（保留两位小数） = softmax([1, 1, 0] ÷ √2) = softmax([0.71, 0.71, 0]) = [0.40, 0.40, 0.20]
Q₁ 的输出 = 0.40 × [1, 0] + 0.40 × [0, 1] + 0.20 × [1, 1] = [0.60, 0.60]
```

两个查询头读的是同一张 3 行的 K 表和 V 表：Q₀ 把 0.73 的权重给位置 0，Q₁ 在位置 0、1 之间平分，输出一个是 [0.82, 0.27]，一个是 [0.60, 0.60]。Q₂、Q₃ 用同样的算法读第 1 组。和 MHA 比，差别只在 Q₁ 没有自己的一组 k、v，借用了 Q₀ 那一组。假如 Q₁ 有自己的一组，比如取 attention 页多头一节头 1 的 k、v，它读到的是 [1.20, 0.80]；共读第 0 组后变成 [0.60, 0.60]。两次的权重碰巧都是 [0.40, 0.40, 0.20]，不同的是被加起来的 v。组越少，各查询头能读到的不同 K、V 就越少，这就是上一节代价 1 说的「质量换容量」。

这个例子也能数出上一节代价 3 说的几处开销。设隐藏宽度为 8（4 个查询头 × 每头 2 个数，示意），不计偏置：

| 开销（一层，示意） | MHA（4 组 K、V） | GQA（2 组） | MQA（1 组） |
|---|---|---|---|
| 位置 2 打分的乘法：查询头数 × 位置数 × 每头宽 | 4 × 3 × 2 = 24 次 | 24 次 | 24 次 |
| 位置 2 汇合的乘法：查询头数 × 位置数 × 每头宽 | 4 × 3 × 2 = 24 次 | 24 次 | 24 次 |
| K、V 投影的参数：隐藏宽度 × KV 头数 × (K 宽 + V 宽) | 8 × 4 × (2 + 2) = 128 个 | 8 × 2 × 4 = 64 个 | 8 × 1 × 4 = 32 个 |

打分和汇合三种结构一样多，和 KV 头数无关；K、V 投影随 KV 头数按 4 : 2 : 1 减少，一个位置算一次 K、V 的乘法次数正好等于这个参数个数。

## 缓存容量按 KV 头数计算

普通（不压缩）的 KV cache 里，一个 token 在一层要存多少，只由 KV 头数和每头宽度决定，查询头数不出现在式子里：

```text
每个 token、每层的 KV 字节数 = KV 头数 × (K 每头宽 + V 每头宽) × 每个数的字节数
```

精度和每头宽度相同时，GQA 相对 MHA 的缓存按「KV 头数 ÷ 查询头数」缩小：论文的 GQA-8 缩到 MHA 的「8 ÷ 查询头数」，MQA 缩到「1 ÷ 查询头数」。

先拿上一节的小例子数格子。一层的缓存里，每个位置要为每组 K、V 各存一行 K、一行 V：

```wiki-diagram
file: gqa-cache
```

```calc
title: 3 个位置、4 个查询头、每头 2 个数，一层各存多少（示意）
MHA 每个位置 = 4 个 KV 头 × (2 + 2) = 16 个数
MHA 3 个位置 = 16 × 3 = 48 个数
GQA 每个位置 = 2 个 KV 头 × (2 + 2) = 8 个数
GQA 3 个位置 = 8 × 3 = 24 个数，是 MHA 的 1/2（2 组 ÷ 4 个查询头）
MQA 每个位置 = 1 个 KV 头 × (2 + 2) = 4 个数
MQA 3 个位置 = 4 × 3 = 12 个数，是 MHA 的 1/4（1 组 ÷ 4 个查询头）
```

换成 [KV cache 页](kv-cache.md#存一份要多少从一个位置一层往上乘)那组示意尺寸（32 个查询头、每头 128 维、32 层，BF16 每个数 2 B），差距就到了 GB 级：

```calc
title: 一条 4,096 token 的请求要存多少（示意）
MHA 一个位置、一层 = 32 个 KV 头 × (128 + 128) × 2 B = 16,384 B
GQA-8 一个位置、一层 = 8 个 KV 头 × (128 + 128) × 2 B = 4,096 B
MQA 一个位置、一层 = 1 个 KV 头 × (128 + 128) × 2 B = 512 B

MHA 整条请求 = 16,384 B × 32 层 × 4,096 个位置 = 2 GiB
GQA-8 整条请求 = 4,096 B × 32 层 × 4,096 个位置 = 512 MiB
MQA 整条请求 = 512 B × 32 层 × 4,096 个位置 = 64 MiB
> 1 KiB = 1,024 B，1 MiB = 1,024 KiB，1 GiB = 1,024 MiB
```

GQA-8 这一行就是 KV cache 页算的那个模型。decode 每生成一个 token，这条请求在每一层的历史 K、V 都要读一遍，所以逻辑上要读的量也按同样比例缩小：MHA 每步 2 GiB，GQA-8 每步 512 MiB。同组查询头能不能真的只读一次，看算子实现。

vLLM 按块分配缓存，一块装固定个数 token 的 K、V。每块字节数 = K、V 两份 × 每块 token 数 × 本卡 KV 头数 × 每头宽 × 每个数的字节数；这个式子默认 K、V 每头同宽，「本卡 KV 头数」是张量并行切分之后的数，见下一节。接着用 GQA-8 的尺寸，只用一张卡、每块装 16 个 token（示意），一块就是 2 × 16 × 8 × 128 × 2 B = 65,536 B，即 64 KiB。

以上都是逻辑数据量。真实占用还要算上没填满的块里的空位、量化用的缩放系数、元数据、临时缓冲，以及下一节的跨卡复制。一张卡上到底能分出多少块，由启动时的显存预算决定；GLM 双机的这笔账只在[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)推一次。

## 张量并行时，KV 头不够分就要复制

[TP（张量并行）](tensor-parallel.md)把一层的注意力头分给几张卡，每张卡算自己那几个头，最后再合回来，见[先过 attention](tensor-parallel.md#先过-attention各算自己的头再合回-hidden)。查询头直接等分；KV 头分两种情况：

- **KV 头数不少于卡数：** 按头切开，每卡分到「KV 头数 ÷ 卡数」个 KV 头，必须整除。每卡的 KV cache 也只存自己那几个头。
- **KV 头数少于卡数：** 每卡只放 1 个 KV 头，同一个 KV 头在「卡数 ÷ KV 头数」张卡上各存一份，也必须整除。加载权重时，第 r 张卡取第 ⌊r ÷ 复制份数⌋ 个 KV 头。

拿图里 GQA 那一栏（4 个查询头、2 组 K、V）当示意：TP=2 时每卡 2 个查询头、1 组 K、V，刚好切开；TP=4 时每卡 1 个查询头、1 组 K、V，两组 K、V 各在两张卡上存了一份。后一种情况下每张卡局部看起来是一对一，但全模型仍然只有 2 组 K、V，不能说模型变成了 MHA。

按上面数格子的办法，看每张卡为一个位置存几个数：

```calc
title: 小例子每张卡、每个位置、一层存几个数（示意：2 组 K、V，每头 2 个数）
一张卡 = 2 个 KV 头 × (2 + 2) = 8 个数
TP=2 时每卡 = 1 个 KV 头 × (2 + 2) = 4 个数，2 张卡合计 8 个，没有重复
TP=4 时每卡 = 1 个 KV 头 × (2 + 2) = 4 个数，4 张卡合计 16 个，每组 K、V 存了 2 份
```

复制有两个后果：卡数超过 KV 头数以后，每卡每 token 仍至少存 1 个 KV 头，再加卡也不会让每卡的 KV cache 继续变小；K、V 投影的权重也在几张卡上重复存放。GLM 的稀疏 [MLA](mla.md)（把每层历史压成一条所有头共用的潜向量来存的做法）正好落在这一情况的极端，见下一节。

## 落到 GLM 双机：两类注意力层都不按 KV 头存历史

本部署的固定前提见[部署前提](glm-5-3-flash-two-node.md#部署前提)。示例请求 R1 是一条 prompt 为 4 个 token 的请求（见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)），它在[第 4 站 逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)经过的注意力层只有两类：34 层 [KDA](linear-attention.md) 和 11 层稀疏 [MLA](mla.md)，MTP 草拟层也是稀疏 MLA；两类层在模型里怎样交替排列，见 [GLM-5.3-Flash](glm-5-3-flash.md)。**没有一层是 GQA，所以本部署没有 GQA 自己的账。** 本页出现的 GQA 数字（例如论文的 GQA-8）都只是对照，出处是论文；GLM 每 token 的字节数和块数不能用上一节的公式套算。

### 配置写着 64 个 KV 头，缓存却不按 64 头存

GLM 的模型配置里，查询头数 `num_attention_heads` 和 KV 头数 `num_key_value_heads` 都是 64。按 GQA 的读法，两者相等就是 MHA，每个位置每层要存 64 组 K、V。实际上两类层都不按这个字段存缓存：

- **稀疏 MLA** 每个位置每层只存一条所有头共用的 512 维潜向量（latent），用时每个头再用自己的投影矩阵从它得到这个头的 K、V。和按 64 个头存 K、V 相比少存 64 倍，推导见 [MLA · 为什么要压](mla.md#为什么要压代价在哪)。vLLM 给它的缓存规格写的是「1 个 KV 头、头宽等于潜向量宽」，这只是套用按头计数的格式。
- **KDA** 的 q、k、v 都是 64 个头、每头 128 维，头数相同，没有分组。它不存逐位置的 K、V，而是每个头维持一个固定大小的状态，历史再长也不变大，见 [KDA 的状态有多大](linear-attention.md#放到-glm-双机34-层-kda-的状态有多大)。

每层每 token 的字节数、每卡能装多少块，统一见[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)；R1 在两类层上每卡的形状见 one-request 的 [34 层 KDA](one-request.md#34-层-kda) 与 [11 层稀疏 MLA](one-request.md#11-层稀疏-mla)。

### TP8 下几种做法怎样落到卡上

本部署每个 DP 组 8 张卡、TP8。把 GQA 放进同样的 8 张卡作对照：

| 做法 | 查询头 | 缓存的历史 |
|---|---|---|
| GQA（对照），KV 头数不少于 8 | 等分到 8 张卡 | 按 KV 头切，每卡存 1/8 |
| GQA（对照），KV 头数少于 8 | 等分到 8 张卡 | 每卡 1 个 KV 头，按上一节复制 |
| GLM 稀疏 MLA | 64 头，每卡 8 头 | 潜向量不分头，8 张卡各存一份完整的 |
| GLM KDA | 64 头，每卡 8 头 | 状态按头切，跟着头走 |

MLA 的潜向量由一次不切分的压缩投影算出，8 张卡各算一遍、各存一份。它在 vLLM 里记作 1 个 KV 头，正是上一节「KV 头少于卡数」推到极端：全模型只有 1 份历史，TP 组里每张卡都存。KDA 则和按头切的普通注意力一样，每卡只管自己的 8 个头。两者的切法细节见 TP 页的[稀疏 MLA](tensor-parallel.md#稀疏-mla头投影切开压缩历史逐卡复制)与 [KDA](tensor-parallel.md#kda状态跟着头一起切)。

### 在 vLLM 里从哪一步分岔

```wiki-diagram
file: gqa-flow
```

左支是 GQA 模型在 vLLM 里走的路。加载模型时，从模型配置读出两种头数，按 TP 定本卡几个查询头、几个 KV 头；启动时，缓存规格按本卡 KV 头数算每块字节；到第 4 站，每层把查询头数和 KV 头数一起交给注意力算子。vLLM 不在调用前把 K、V 复制成查询头数，同组对应在算子内部完成：Ascend 的融合注意力算子分别接收两种头数，PyTorch 的通用注意力函数则打开一个按组广播 K、V 的开关。

中、右两支是 GLM。稀疏 MLA 在 Ascend 的专用实现里自建压缩投影和缓存规格，KDA 走线性注意力的状态路径，都不经过左支按 KV 头切分、复制的逻辑。

### 为什么是 MLA 和 KDA，而不是 GQA

三种做法都在减少每个位置要存、要读的历史，减的方式不同：

| 做法 | 怎样减 | 代价 |
|---|---|---|
| GQA | 减少 K、V 的份数，同组查询头读完全相同的 K、V | 组越少，各头能读到的不同 K、V 越少 |
| MLA | 存一条共享潜向量，各头仍用自己的投影得到各不相同的 K、V | 读时多做矩阵乘；潜向量在 TP 下切不开 |
| KDA | 不存逐位置的 K、V，把历史压进固定大小的状态 | 状态大小有限，保留什么全靠更新规则 |

GLM 用 MLA 压缩 11 层（外加 MTP 层）的逐位置历史，用 KDA 让另外 34 层完全不随上下文增长。

## 常见误解

- **「GQA 把一组查询头合并成一个头。」** 不对。查询头一个不少，每个头仍用自己的 Q 打分，各出一份输出；合并的只是它们要读的 K、V。
- **「GQA 省显存、不省计算。」** 太绝对。K、V 投影的参数和乘加按 KV 头数减少；打分与汇合仍按查询头数算，这部分没省。
- **「把配置里的 KV 头数改小，就给模型开了 GQA。」** 不对。KV 头数是训练时定下的结构；论文的转换要先把同组各头的 K、V 投影取平均，再继续训练。只改配置沿用原权重，得到的已经不是原模型。
- **「TP 卡数超过 KV 头数后，每卡一对一，模型就成了 MHA。」** 不对。那是同一个 KV 头在几张卡上复制，全模型的 KV 头数没变，每卡的缓存也不再随卡数减少。
- **「GLM 配置写着 64 个 KV 头，所以它是 MHA，每个位置每层存 64 组 K、V。」** 不对。稀疏 MLA 只存一条 512 维潜向量，KDA 不存逐位置的 K、V，见 [MLA 的常见误解](mla.md#常见误解)。
- **「vLLM 给 MLA 写的是 1 个 KV 头，所以 MLA 就是 MQA。」** 不对。MQA 的各头读完全相同的 K、V；MLA 缓存的是潜向量，每个头用自己的投影从它得到不同的 K、V。「1 个 KV 头」只是缓存规格的记账方式。
- **「GQA 的共享和 prefix caching 的共享是一回事。」** 不是。GQA 在一个请求内部，让同一层、同一位置的几个查询头读同一组 K、V；[prefix caching](prefix-caching.md) 在请求之间复用前缀相同的缓存块，能不能命中看的是[命中条件](prefix-caching.md#哪些块能被共享)。这两者又都不决定一张卡能分到多少块，块数由启动时的显存预算定，见[部署页](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)。
- **「论文里 GQA-8 省了多少，就能拿来估 GLM 的 KV cache。」** 不能。GLM 没有 GQA 层，它的缓存按潜向量和 KDA 状态计算，只以部署页的推导为准。

## 对照源码

### 怎么开

GQA 没有运行时开关，由模型权重和配置决定。以 vLLM 的 Llama 实现为例：从 Hugging Face 配置读 `num_key_value_heads`，缺省时取 `num_attention_heads`，也就是 MHA；再按 TP 算本卡 KV 头数 `max(1, total_num_kv_heads // tp_size)`，够分就切、不够就复制 [C9]。`QKVParallelLinear` 据此定 Q、K、V 三段输出宽度，并记下复制份数 `num_kv_head_replicas`，加载权重时第 r 张卡取第 `r // num_kv_head_replicas` 个 KV 头 [C11]。注意力层 `Attention` 保存 `num_heads` 与 `num_kv_heads`，前向把 Q 整理成 `[token, num_heads, head_size]`，K、V 整理成 `[token, num_kv_heads, head_size]`；缓存规格每块字节 = `2 × block_size × num_kv_heads × head_size × dtype 字节` [C12]。

分组对应交给后端算子：Ascend 普通注意力后端算出 `num_queries_per_kv`，把 `num_heads` 与 `num_key_value_heads` 分别传给融合注意力算子 [C6]；vLLM 的 CPU 后端调用 PyTorch `scaled_dot_product_attention` 时传 `enable_gqa`，由算子按组广播 K、V [C13]。

这里的 CPU 调用仅在 `num_heads > num_kv_heads` 时把 `enable_gqa` 设为真。[C13] `Attention` 的整除检查则允许两种头数相等。[C3] 前者是该次调用启用分组的条件，后者是头数的合法性检查，不能把两者当作同一个判断。

GLM 不需要也不能开：`num_key_value_heads` 缺省等于查询头数 64 [S7]；稀疏 MLA 的压缩投影与缓存规格在 `glm5_next.py`、`indexer_kpool_mla.py` 里单独建，规格固定 `num_kv_heads=1` [C18]；KDA 的 q、k、v 投影同为 `num_heads × head_dim` 宽，按 TP 等分头 [C19]。

### 会报什么错

| 报错 | 触发条件 | 出处 |
|---|---|---|
| `num_heads (X) is not divisible by num_kv_heads (Y)` | 查询头数不是 KV 头数的整数倍 | 上游 `Attention.__init__` [C3] |
| `X is not divisible by Y` | `QKVParallelLinear` 按 TP 切查询头、切或复制 KV 头时不能整除 | `divide` → `ensure_divisibility` [C20] |
| 不带消息的 `AssertionError` | Llama 类模型：KV 头数不少于 TP 却不被 TP 整除，或少于 TP 却不能整除 TP | `LlamaAttention.__init__` |
| 不带消息的 `AssertionError` | Ascend 普通注意力后端：查询头数不被 KV 头数整除 | `AscendAttentionBackendImpl.__init__` |

### 开销和什么时候别开

- KV 头数是训练时的选择。已训练好的模型不要手改 `num_key_value_heads` 来「开 GQA」；论文的转换包括同组 K、V 投影取平均和约 5% 预训练计算量的继续训练 [S1]。
- TP 卡数超过 KV 头数时，K、V 投影权重在「卡数 ÷ KV 头数」张卡上重复，每卡 KV cache 不再随卡数减少 [D]。
- 论文的动机是 decoder 推理时载入 K、V 的带宽；它没有在 encoder 自注意力上用 GQA，理由是 encoder 的表示并行算出、带宽通常不是主要瓶颈。实际能快多少按负载实测。
- 本部署不涉及：GLM 没有 GQA 层。

### 版本差异

**v0.30.0rc2 保留 GQA 的头共享定义，需检查并行组合与执行拆分条件。** 未指定 KV 头数仍取 Q 头数，要求 Q 头数可被 KV 头数整除；FIA 分别接收两种头数，不在调用前复制出完整的分组 K/V。新增的 GQA/MQA 组合校验要求同时使用 PCP>1 与 DCP>1 时 PCP=DCP，独立草稿另有 TP/KV 头/DCP 校验。batch-invariant 模式拆开 mixed prefill/decode 调用 FIA 的条件则在固定 main 已存在，不只依赖硬件画像的 phase-split 能力；这改变执行次序，不改变 GQA 数学，也不能代替 GLM 稀疏 MLA/KDA 的缓存容量公式。

上游控制流（`Attention`、`QKVParallelLinear`、缓存规格）按 `vllm@0fc695fc` 读。执行侧按知识库固定快照核对：v0.23 列是 vllm-ascend 维护分支 2c59ff10，v0.26 列是 2ed6cbba，main 列是 baa023ad。**本部署的专用镜像 db701c1f 是另一个 orphan commit，不算进 v0.23 列。所列 v0.23、v0.26 维护快照没有 GLM 模型文件；main（baa023ad）已在 models/glm5next/ 下提供 GLM 实现，并接入 MLA 与 KDA 模块。**[C25] 代码存在不代表它与专用镜像的行为完全一致；本页的部署走读仍以 db701c1f 为准。

| 项目 | v0.23 | v0.26 | main |
|---|---|---|---|
| 普通注意力后端：KV 头数缺省、整除检查、每组查询头数 | 缺省等于查询头数；断言整除；算 `num_queries_per_kv` [C5] | 同 v0.23 [C14] | 同 v0.23 [C16] |
| 融合注意力算子收到的头数 | 查询头数与 KV 头数分开传，调用前不展开 K、V [C6] | 同 v0.23 [C15] | 同 v0.23 [C17] |
| GLM 的稀疏 MLA、KDA 代码 | 无 | 无 | 有，位于 models/glm5next/；不等同于专用镜像 |

镜像 db701c1f 的普通注意力后端与上表一致 [C21]；GLM 的稀疏 MLA 缓存规格写 1 个 KV 头，KDA 走线性注意力状态，都不经过这套分组参数。三个分支在 GQA 的表达上没有差别。

### 源码位置

| 要核对什么 | 固定源码位置 |
|---|---|
| 论文：GQA-G 定义、平均池化转换、uptraining、GQA-8 结果、只用于 decoder | https://arxiv.org/html/2305.13245v3 |
| 配置读 KV 头数、按 TP 切或复制 | `vllm@0fc695fc:vllm/model_executor/models/llama.py#L290-L296`；`#L144-L156` |
| QKV 投影的三段宽度、复制份数、按份数取 KV 头 | `vllm@0fc695fc:vllm/model_executor/layers/linear.py#L1000-L1042`；`#L1358-L1363`；`vllm/distributed/utils.py#L52-L63` |
| 注意力层保存两种头数、整除检查、按头整理 Q/K/V | `vllm@0fc695fc:vllm/model_executor/layers/attention/attention.py#L279-L292`；`#L452-L513` |
| 缓存每块字节随 KV 头数 | `vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L183-L201` |
| 算子内部按组广播（PyTorch SDPA） | `vllm@0fc695fc:vllm/v1/attention/backends/cpu_attn.py#L444-L456` |
| Ascend 普通注意力后端（v0.23 / v0.26 / main / 镜像） | `vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L414-L428`、`#L1336-L1359`；`@2ed6cbba` `#L440-L451`、`#L1378-L1389`；`@baa023ad` `#L526-L538`、`#L948-L959`；`@db701c1f` `#L414-L428` |
| GLM 配置的头数 | Hugging Face `zai-org/GLM-5.3-Flash` config.json（eb9eb208）；`vllm-ascend@db701c1f:vllm_ascend/transformers_utils/configs/glm5_next.py#L23-L50`、`#L128-L134` |
| GLM 稀疏 MLA 的投影与缓存规格 | `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1901-L1962`；`vllm_ascend/ops/indexer_kpool_mla.py#L121-L134` |
| KDA 的 q、k、v 头数与按 TP 切头 | `vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L110-L134` |

**证据索引。** 正文里 GQA 的定义、MHA 与 MQA 作为两端、同组平均池化与约 5% 的继续训练、带宽动机、MQA 的质量与训练稳定性问题、GQA-8 的质量与速度、按组共享随模型放大保持比例、不用于 encoder，都出自论文 [S1]。其余机制按上表的源码位置逐条对应。GLM 的层数、TP8 下每卡 8 个头、潜向量逐卡复制取自主线底稿 02 §0.2、§4.3、§5.2、§5.6，推导只在链接到的页面里做。

以下由上述证据推出：复制后每卡缓存不再随卡数减少、投影权重重复存放 [D]；打分与汇合的乘加次数估算 [D]；缓存容量公式与相对 MHA 的缩小比例 [D]；GQA 那一栏 TP=2、TP=4 的分法用的是图中 4 个查询头、2 组 K、V 的示意设定 [A]。

**待核：**

- Ascend 融合注意力算子对头宽、每组查询头数、精度的支持范围：需按部署的 CANN 与算子版本核对，本页未逐项查。
- 同组查询头在 Ascend 算子内部是否共用一次 K、V 读取：接口只说明分别接收两种头数，内部访存缺证据。
- GQA、MLA、KDA 在 GLM 上的质量差异：没有实验数据。
- 专用镜像的完整安装组合：以[来源基线](../sources/glm-5-3-flash-baseline.md)记录的待核项为准。
