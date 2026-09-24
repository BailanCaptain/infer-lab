---
id: rope
title: RoPE (Rotary Position Embedding)
type: concept
summary: 注意力本身分不清词的先后。RoPE 的办法是在算分数之前，把 Q 和 K 里的数字两两一对、按这个 token 的位置转一个角度；两个转过的向量相乘时，位置只剩「隔了几格」这一项。
aliases: [旋转位置编码, 旋转位置嵌入, rotary embedding, 位置编码, partial rotary, 部分旋转]
chapters: ["04"]
order: 10
sources:
  - vllm@0fc695fc:vllm/model_executor/models/qwen3.py#L145-L162
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/base.py#L80-L103
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/common.py#L164-L177
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/__init__.py#L33-L40
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - https://arxiv.org/abs/2104.09864
  - vllm@0fc695fc:vllm/model_executor/models/gemma3.py#L161-L180
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/__init__.py#L63-L112
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/base.py#L173-L193
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/mrope.py#L235-L251
  - vllm@0fc695fc:vllm/model_executor/layers/rotary_embedding/mrope.py#L279-L322
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L260-L315
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_5.py#L137-L153
  - vllm-ascend@2c59ff10:vllm_ascend/ops/rotary_embedding.py#L517-L528
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L740
  - vllm@84030bbe:vllm/model_executor/layers/rotary_embedding/__init__.py#L60-L120
  - vllm@84030bbe:vllm/model_executor/layers/rotary_embedding/base.py#L178-L192
  - vllm@84030bbe:vllm/model_executor/models/qwen3_next.py#L445
  - vllm-ascend@baa023ad:vllm_ascend/ops/rotary_embedding.py#L529
  - vllm-ascend@baa023ad:vllm_ascend/utils.py#L831-L847
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: attention-qkv
    kind: builds-on
    note: RoPE 转的就是注意力里的 Q 和 K，分数怎么算、为什么 V 不用转，先看那一页
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一句话

RoPE 给注意力补位置信息的办法只有一句：**在算分数之前，把每个 token 的 Q 和 K 按它自己的位置转一个角度。** 两个转过的向量一相乘，位置带来的那一项只跟两个转角之差有关，也就是只跟「隔了几格」有关；词义照样参与，分数不是只由距离决定。

```wiki-diagram
file: rope
```

## 「猫追狗」和「狗追猫」，注意力分得清吗

「猫追狗」和「狗追猫」用的是同样三个 [token](token.md)。[注意力](attention-qkv.md)的分数是 Q 和 K 相乘，这两份数字都只由词义算出来——不另外把位置告诉模型，这两句话对它就是同一句。

最直白的补法是把一份位置数字加到 [embedding](embedding.md) 上。有两处别扭：**加法把「这是什么词」和「它排第几」揉进了同一份数字**，后面每一层都得自己拆开；而位置数字若是一张学出来的表，表有几行就只能用到第几个位置，更长的位置没有对应的行。（按公式现算的位置数字不受第二条限制，所以不能一概说加法都用不到更长。）

## 不加东西，只转方向

RoPE 换了个思路：不往里加东西，只把方向转一下。

- **转不改长度。** 每一对数字转完还是原来那么长，词义的强弱不会被位置冲淡。
- **相乘时只剩转角差。** Q 按自己的位置转、K 按自己的位置转，两个一相乘，位置只剩下「两个转角差多少」这一项。RoPE 的论文把这叫作把相对位置直接写进注意力的算式里，模型不必把每一种远近关系分别学一遍。

限定词要留住：只有在两边词义算出来的数字相同时，「位置 5 看位置 3」和「位置 105 看位置 103」才得到相同的分数。真实模型在这两处算出来的 Q 和 K 不一定相同，所以 RoPE 保证的是「位置的那一份贡献」只看距离，不是「分数只看距离」。

## 在一层里的哪一步转

拿 Qwen3.6-35B-A3B 的一层全注意力来看，顺序是固定的：

1. 从这一层的输入算出 Q、K、V；
2. Q 和 K 各自按头做一次归一化；
3. **按位置转 Q 和 K**；
4. 进注意力，算分数、收 V。

两个值得记住的细节。**V 不转**：位置只需要影响「谁该看谁」（分数），不需要影响「看到的内容」。**K 是转完才存下的**：第 3 步在第 4 步之前，所以 [KV Cache](kv-cache.md) 里存的 K 已经带着它自己的位置，之后每一步都直接拿来用，不用再转。

这个模型 [40 层里只有 10 层是全注意力](one-request.md)，RoPE 也只在这 10 层里做。另外 30 层是[线性注意力](linear-attention.md)，它不逐个回看前面的 token，那一路压根不接收位置编号，也就没有这一步。

## 怎么转：把数字两两配对，按位置转角度

一份要转的数字切成一对一对，每一对当成平面上的一个点。位置 `p` 上的第 `i` 对转 `p × f_i` 这么多弧度，`f_i` 是这一对的「转速」：

```
f_i = 1 / θ^(2i / 要转的数字个数)
```

转动本身就是中学学过的旋转公式：

```
新的第一个数 = x1·cos − x2·sin
新的第二个数 = x2·cos + x1·sin
```

各对的转速从快到慢排开，像一块表上的好几根指针：最快的那根每走一个 token 就转 1 弧度，用来分辨挨着的 token；最慢的那根要走几千万个 token 才转一圈，用来分辨很远的距离。

所有位置的 cos 和 sin 在模型加载时一次算好，存成一张表，一行对应一个位置。运行时不算三角函数，只按位置编号查表。这张表完全由 θ 和维数算出来，没有任何要训练的数字。

## 这个模型只转 256 个里的 64 个

Qwen3.6 的一个注意力头有 256 个数。它的配置里写着「只转四分之一」：**每个头只转开头的 64 个数，后面 192 个原样不动。** 64 个数配成 32 对，也就是表上 32 根指针。

不转的那 192 个数照样参与 Q 和 K 相乘，只是它们那一份跟位置无关，只看词义。所以这个模型的一个头里同时有两种成分：一部分带着位置，一部分只管内容。（[MLA](mla.md) 也是类似的分法：只有单独那一小段带 RoPE，其余不带位置。）

配置里还有一套给图片、视频用的位置方案（多模态版 RoPE），会把那 32 对拆成三组，分别按时间、高、宽去转。只输入文字的时候，三组用的是同一个位置编号，和普通 RoPE 一样。本页只讲文字。

## 拿 Qwen3.6 的真实数字走一遍

配置里旋转基数 θ 是一千万，要转的数字 64 个，最长支持 262144 个位置。代进上面的式子：

| 第几对 | 每个 token 转多少弧度 | 转一整圈要多少个 token |
|---|---|---|
| 第 0 对（最快） | `1 / 10000000^0 = 1` | 2π ≈ 6.3 |
| 第 16 对（中间） | `1 / 10000000^0.5 ≈ 3.16 × 10⁻⁴` | ≈ 1.99 万 |
| 第 31 对（最慢） | `1 / 10000000^(62/64) ≈ 1.65 × 10⁻⁷` | ≈ 3800 万 |

第三列是 2π 除以第二列。最慢的那一对转满一圈要约 3800 万个 token，而这个模型最长只支持 262144 个位置——它在整个窗口里只转了约 0.043 弧度，不到 2.5 度。**慢指针在窗口内远远转不满一圈，位置 260000 和位置 100 不会因为「转了整圈又回到同一角度」而撞在一起。** 快的那几对负责分辨挨着的 token，慢的那几对负责把远近拉开，一张表两头都占住了。

不过「不套圈」只是必要条件：它不保证任意长的上下文都分得开，也不能单凭配置反推训练者为什么这样设。

## 那条请求走到这里

[那条请求](one-request.md)的问题有 37 个 token，位置是 0 到 36。

- **第一步（prefill）**：37 个位置一次查表，37 个 token 的 Q、K 各转各的角度。位置 0 的转角全是 0，等于没转；位置 36 的第 0 对转了 36 弧度，差不多 5.7 圈；同一个 token 的第 31 对只转了约 6 × 10⁻⁶ 弧度，几乎没动。
- **第 1 步 decode**：新 token 的位置是 37，只查表里第 37 行，只转这一个 token 的 Q 和 K。前面 37 个 K 已经在缓存里，是转好的。
- **存到哪里跟 RoPE 无关**：K 写进哪一块、第几格是[块表](block-table.md)的事。这条请求一共 237 个 token，全落在同一个 2048 个位置的块里；换成更长的请求要换块时，RoPE 照样只看位置编号。位置编号和存储位置是两套编号，互不相干。
- **每一层都转一次**：10 层全注意力各自转自己那一层的 Q 和 K，查的是同一张表。

## 常见误解

- **「配对是相邻的两个数」。** 在 vLLM 里默认不是。默认风格把要转的那 64 个数从中间劈成前后两半，第 `i` 个和第 `i + 32` 个配对；相邻配对是另一种风格。两种风格数学上等价，但权重不能混用。
- **「RoPE 是加在 embedding 上的」。** 它不碰 embedding，也不碰 V；它在每一层全注意力里，只作用于 Q 和 K。
- **「位置信息存在模型权重里」。** RoPE 没有任何要训练的数字，那张 cos/sin 表完全由 θ 和维数算出来。
- **「一个头的 256 个数都带位置」。** 这个模型只转开头 64 个，其余 192 个不带位置。

## 对照源码

### 怎么开

RoPE 不是开关，由模型配置决定。Qwen3.6 的 `text_config` 里相关字段 [S5]：`head_dim: 256`、`partial_rotary_factor: 0.25`、`max_position_embeddings: 262144`，以及 `rope_parameters: {rope_type: "default", rope_theta: 10000000, partial_rotary_factor: 0.25, mrope_section: [11, 11, 10], mrope_interleaved: true}`。

- **转几维**：`get_rope` 先看 `rope_parameters` 里有没有 `rope_dim`，没有就取 `partial_rotary_factor`（默认 1.0，必须在 (0, 1] 内），`rotary_dim = int(head_size × partial_rotary_factor)` [C8]。代入：`int(256 × 0.25) = 64` [D]。
- **只转前段**：`query_rot = query[..., :rotary_dim]`、`query_pass = query[..., rotary_dim:]`，转完再 `cat` 回去；K 同样处理 [C9]。所以是「开头 64 个转、后 192 个原样」。
- **走哪个类**：`rope_type` 为 `default` 且 `rope_parameters` 里有 `mrope_section`，就建 `MRotaryEmbedding`。它断言 `sum(mrope_section) == rotary_dim // 2` [C10]，代入 `11 + 11 + 10 = 32 = 64 / 2` [D]。
- **纯文本等于普通 RoPE**：`MRotaryEmbedding.forward_native` 的 `positions` 是一维（纯文本）时直接用查到的 cos/sin；只有二维 `[3, num_tokens]`（带图片视频）才按 `mrope_section` 拆三组 [C11]。
- **转速公式**：`_compute_inv_freq` 是 `1 / base^(arange(0, rotary_dim, 2) / rotary_dim)`，表是 `cat(cos, sin)` [C2]。所以表宽是 `rotary_dim`，前一半 cos、后一半 sin。
- **哪些层有 RoPE**：`Qwen3_5DecoderLayer` 按 `layer_type` 分支，`full_attention` 建 `Qwen3NextAttention`，`linear_attention` 建 `QwenGatedDeltaNetAttention` [C13]。前者在 `__init__` 里 `get_rope(...)`、`forward` 里 `qkv_proj → q_norm/k_norm → rotary_emb(positions, q, k) → attn` [C12]；后者所在的 `layers/mamba/gdn/` 下 grep `rotary`/`rope` 没有相关命中，`qwen_gdn_linear_attn.py` 里 `positions` 只出现在一处注释里 [D]。
- **配对风格**：`get_rope` 的 `is_neox_style` 默认为真 [C4]，`Qwen3NextAttention` 调用时没有传这个参数；neox 风格 `torch.chunk(x, 2)` 把要转的部分劈成两半配对 [C3]。
- Qwen3 的注意力 `forward` 也是同样的顺序（`qkv_proj` → qk-norm → `rotary_emb` → 注意力）[C1]。

### 会报什么错

- `partial_rotary_factor` 不在 (0, 1] 内：`ValueError: partial_rotary_factor=... must be between 0.0 and 1.0`。
- `mrope_section` 三段加起来不等于 `rotary_dim // 2`：`MRotaryEmbedding.__init__` 里 `assert` 失败。改了 `partial_rotary_factor` 却没同步改 `mrope_section`，就会在建模型时撞上这一条 [D]。

### 开销和什么时候别开

- **表的大小**：`MRotaryEmbedding` 把表的行数放大到 `max_position_embeddings × 4`（注释说是为了视频位置编号可能更大），即 `262144 × 4 = 1048576` 行；列数 `rotary_dim = 64`，共 `1048576 × 64 ≈ 6.7 × 10⁷` 个数 [D]。表按 `get_rope` 的 `dtype`（不传时取 `torch.get_default_dtype()`）存；若为 bf16（2 字节）约 128 MiB，fp32 则 256 MiB [D]。加载时的默认 dtype 是什么本页没有核。
- **10 层共用一张表**：`get_rope` 按 `(head_size, rotary_dim, max_position, is_neox_style, rope_parameters, …, dtype)` 做 key 缓存在 `_ROPE_DICT` 里，同 key 直接返回同一个对象。10 层全注意力参数相同，所以共用一份 [D]。层型交替、各层 θ 不同的模型不是这样——Gemma3 的滑动窗口层用另一个 θ，按层型各建各的表 [C7]。
- 性质来源：「显式相对位置依赖」「序列长度的灵活性」是论文列出的 RoPE 性质 [S6]；「长度不变、词义强弱不被冲淡」是旋转的数学性质 [D]；「不必把每种远近分别学一遍」「一张表两头都占住」是解读 [I]。

### 版本差异

| 事实 | v0.23（上游 `0fc695fc` / vllm-ascend `2c59ff10`） | v0.26（上游 `releases-v0.26.0` / vllm-ascend `releases-v0.26.0rc`） | main |
|---|---|---|---|
| `rotary_dim = int(head_size × partial_rotary_factor)` | `__init__.py:72` | 同，`__init__.py:72` | 同，`__init__.py:72`（另多一条 `rope_dim` 覆盖分支，本模型的配置没有这个键）[C16] |
| 有 `mrope_section` 就走 `MRotaryEmbedding` | `__init__.py:102` | 同，`__init__.py:102` | 同，`__init__.py:112-113` [C16] |
| 只转前 `rotary_dim` 个 | `base.py:178-179` | 同，`base.py:178` | 同，`base.py:178` [C17] |
| 全注意力层在 `forward` 里调 `rotary_emb` | `qwen3_next.py:313` | 同，`qwen3_next.py:386` | 同，`qwen3_next.py:445` [C18] |
| 昇腾换成 `AscendMRotaryEmbedding` | `utils.py:740` | 类仍在，`ops/rotary_embedding.py:487` | 类在 `ops/rotary_embedding.py:529`，`utils.py:847` 登记替换 [C19][C20] |

### 源码位置

- 转几维、选哪个类、表缓存：`vllm/model_executor/layers/rotary_embedding/__init__.py:63-112`
- 转速公式与 cos/sin 表：`.../rotary_embedding/base.py:80-103`；只转前段：`base.py:173-193`
- 旋转公式与两种配对风格：`.../rotary_embedding/common.py:164-177`；`is_neox_style` 默认值：`__init__.py:33-40`
- 多模态版：表放大 4 倍与分组断言 `.../rotary_embedding/mrope.py:235-251`；一维/二维位置分支 `mrope.py:279-322`
- Qwen3.6 全注意力：`vllm/model_executor/models/qwen3_next.py:260-315`；按层型分支：`models/qwen3_5.py:137-153`
- 昇腾：`vllm_ascend/utils.py:740` 把 `MRotaryEmbedding` 换成 `AscendMRotaryEmbedding`；它的 `forward_oot` 只在二维位置且 interleaved 时走 Triton，`mrope_section` 不是 `[16, 24, 24]` 时交回父类实现。Qwen3.6 纯文本是一维位置、`mrope_section` 为 `[11, 11, 10]`，所以走父类那一支 [D]。v0.26 分支对应判断在 `ops/rotary_embedding.py:538`、`:542`。
- 对照：Qwen3 注意力顺序 `models/qwen3.py:145-162`；Gemma3 按层型分表 `models/gemma3.py:161-180`；论文 [S6]
