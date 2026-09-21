---
id: rope
title: RoPE (Rotary Position Embedding)
type: concept
summary: 把 Q 和 K 的每两个分量当成平面上的一个点，按「位置 × 频率」转一个角度。转完之后，两个 token 的注意力分数只取决于它们相隔多远。
aliases: [旋转位置编码, 旋转位置嵌入, rotary embedding, 位置编码]
chapters: ["04"]
order: 10
sources:
  - vllm@0fc695fc:vllm/model_executor/models/qwen3.py#L145-L162
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/base.py#L80-L103
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/common.py#L164-L177
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/__init__.py#L33-L40
  - https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/config.json
  - https://arxiv.org/abs/2104.09864
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations: []
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

注意力本身不认顺序——把句子里的 token 打乱，算出来的分数一模一样。RoPE 补上顺序的办法是：**在算分数之前，把每个 token 的 Q 和 K 按它的位置转一个角度。** 位置越靠后转得越多；两个向量一点乘，各自转的角度相减，剩下的只有「相隔多远」。

## 它解决的是哪个问题

「猫追狗」和「狗追猫」用的是同样三个 token。如果模型分不出谁在前，这两句话对它就是同一句。

早期的做法是给每个位置配一个向量，加到 embedding 上。这有两个麻烦：位置信息和词义混在同一个向量里，过了几层就搅在一起；训练时没见过的位置，模型完全没有对应的向量。

RoPE 换了个思路：**不加东西，只转方向。** 转动不改变向量的长度，所以词义的「强度」不受影响；而两个转过的向量做点乘时，结果只跟两个转角的差有关——论文证明的就是这一条 [S6]。对模型来说，「第 5 个 token 看第 3 个」和「第 105 个看第 103 个」是同一种关系，不用分别学。

## 它在一层里的位置

看 Qwen3 的注意力 `forward`，顺序是固定的 [C1]：

1. `qkv_proj` 算出 Q、K、V；
2. Q 和 K 各自按头做一次 RMSNorm（qk-norm）；
3. **`rotary_emb(positions, q, k)`——只转 Q 和 K**；
4. 进注意力算子。

两个值得记住的细节。**V 不转**：位置只需要影响「谁该看谁」（分数），不需要影响「看到的内容」。**K 是转完才进缓存的**：第 3 步在第 4 步之前，所以 [KV Cache](kv-cache.md) 里存的 K 已经带着它自己的位置，之后每一步 decode 直接拿来用，不用重转。

## 怎么转

把一个头的 128 维切成 64 对，每一对是平面上的一个点 `(x1, x2)`。位置 `p` 上的第 `i` 对转的角度是 `p × f_i`，其中

```
f_i = 1 / θ^(2i / 128)        i = 0, 1, …, 63
```

这就是 `_compute_inv_freq` 里那一行 [C2]。转动本身是中学学过的旋转公式 [C3]：

```
o1 = x1·cos − x2·sin
o2 = x2·cos + x1·sin
```

64 对的频率从快到慢排开，像一块表上的 64 根指针：最快的那根每走一个 token 就转 1 弧度，用来分辨相邻的 token；最慢的那根几百万个 token 才转一圈，用来分辨很远的距离。

所有位置的 cos 和 sin 在模型加载时一次算好，存成一张 `[最大位置数, 128]` 的表（前 64 列 cos、后 64 列 sin）[C2]。运行时不算三角函数，只按 `positions` 查表。

## 拿 Qwen3-0.6B 的真实数字走一遍

配置里 `rope_theta = 1000000`、`head_dim = 128`、`max_position_embeddings = 40960`，没有 `rope_scaling` [S5]。

| 第几对 | 每个 token 转多少弧度 | 转一整圈要多少个 token |
|---|---|---|
| 第 0 对（最快） | `1 / 1000000^0 = 1` | 2π ≈ 6.3 |
| 第 32 对（中间） | `1 / 1000000^0.5 = 0.001` | ≈ 6283 |
| 第 63 对（最慢） | `1 / 1000000^(126/128) ≈ 1.24 × 10⁻⁶` | ≈ 506 万 |

第三列是 `2π ÷ 第二列` [D]。最慢的那一对在 40960 个位置内只转了约 0.05 弧度（不到 3 度）[D]——这就是 θ 取一百万的用意：上下文再长，慢指针也远没转满一圈，不会「套圈」把远处和近处搞混。

那张查表的大小：`40960 × 128` 个数，按 float32 算是 20 MiB [D]。全模型 28 层共用同一张，不是每层一份 [I]。

## 那条请求走到这里

[那条请求](one-request.md)的问题有 37 个 token，位置是 0 到 36。

- **prefill 那一步**：37 个位置一次查表，37 个 token 的 Q、K 各转各的角度。位置 0 的转角全是 0，等于没转；位置 36 的第 0 对转了 36 弧度。
- **第 1 步 decode**：新 token 的位置是 37，只查表里第 37 行，只转这一个 token 的 Q 和 K。前面 37 个 K 已经在缓存里，是转好的。
- **第 92 步换块的时候**：RoPE 什么都不知道。位置是 128 就查第 128 行，K 写进哪一块、第几格是[块表](block-table.md)的事。位置编号和存储位置是两套编号，互不相干。

## 常见误解

- **「配对是相邻的两个分量」。** 在 vLLM 里默认不是。`get_rope` 的 `is_neox_style` 默认为真 [C4]，这种风格把向量从中间劈成前后两半，第 `i` 个分量和第 `i + 64` 个配对 [C3]；相邻配对是另一种（GPT-J）风格。两种风格数学上等价，但权重不能混用。
- **「RoPE 是加在 embedding 上的」。** 它不碰 embedding，也不碰 V；它在每一层的注意力里，只作用于 Q 和 K [C1]。
- **「位置信息存在模型权重里」。** RoPE 没有任何可训练参数，那张 cos/sin 表完全由 θ 和维度算出来 [C2]。
