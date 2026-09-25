---
id: attention-cost
title: 四种注意力的代价
type: concept
summary: 每记住一个 token，一层要花多少显存？Qwen3.6-35B-A3B 的全注意力层要 2 KiB，DeepSeek 系的 MLA 只要 1152 字节，稀疏注意力比 MLA 还多一点；线性注意力干脆不按 token 记，每层只留一份固定大小的状态。数字各挂各的模型，差别真正的来源是存的东西不一样。
aliases: [KV 占用, 每 token 字节数, MLA 省多少, page_size_bytes, 稀疏注意力代价, indexer]
chapters: ["04"]
order: 20
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L78-L112
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L80-L106
  - vllm-ascend@2c59ff10:vllm_ascend/attention/sfa_v1.py#L135-L165
  - vllm-ascend@2c59ff10:vllm_ascend/attention/dsa_v1.py#L212-L217
  - vllm-ascend@2c59ff10:vllm_ascend/core/kv_cache_interface.py#L28-L55
  - vllm-ascend@2c59ff10:vllm_ascend/core/kv_cache_interface.py#L66-L121
  - vllm-ascend@2c59ff10:vllm_ascend/core/kv_cache_interface.py#L19-L25
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4976-L4986
  - vllm-ascend@2c59ff10:tests/ut/attention/a2/test_mla_cp.py#L269-L272
  - vllm-ascend@2c59ff10:tests/ut/worker/a2/test_model_runner_v1.py#L338-L342
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L160-L211
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L255-L353
  - vllm@0fc695fc:vllm/model_executor/layers/attention/mla_attention.py#L960-L970
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4987-L4999
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L815-L841
  - vllm-ascend@2ed6cbba:vllm_ascend/core/kv_cache_interface.py#L104-L129
  - vllm-ascend@2ed6cbba:vllm_ascend/worker/model_runner_v1.py#L5008-L5052
  - vllm-ascend@2ed6cbba:tests/ut/worker/a2/test_model_runner_v1.py#L625-L646
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: attention-backend-family
    kind: builds-on
    note: 那一页讲三元组怎么查出一个后端，这一页讲查中之后各自要付多少字节
  - to: one-request
    kind: builds-on
    note: 全注意力 10 层每颗每 token 1 KiB、线性注意力 30 层约 30.7 MiB 的账都在那一页算过，这里拿来跟另外几种并排
  - to: kv-cache-spec
    kind: builds-on
    note: 普通注意力那一条的完整推导在那一页，这里只取结果拿来跟另外几条并排比
  - to: attention-qkv
    kind: builds-on
    note: 这一页比的「存下来的 K 和 V」是什么、为什么要存，在那一页讲
  - to: linear-attention
    kind: builds-on
    note: 线性注意力为什么只留一份固定大小的状态，在那一页讲；这里只比它存多少
contradicts: []
updated: "2026-09-25"
origin: seed
---

每记住一个 token，一层要花多少显存？答案取决于这一层**存的是什么**：普通注意力存 K 和 V 两份真实向量，MLA 只存一份压缩过的潜向量，稀疏注意力在 MLA 之上多存一小份「目录」，线性注意力干脆不按 token 存，只留一份固定大小的状态。四种存法，四种长法。

```wiki-diagram
file: attention-cost
```

## 先看一个具体问题

拿贯穿全库的 [Qwen3.6-35B-A3B](one-request.md) 来问：它回答得越长，显存涨得越快吗？

这个模型 40 层里有两种注意力：

- **10 层全注意力**。每来一个 token，就把这个 token 的 K 和 V 存进 [KV Cache](kv-cache.md)，后面的 token 要回头看它（K、V 是什么见 [注意力的 Q、K、V](attention-qkv.md)）。一个 token 在一层里存 K、V 各一份，每份是 2 个头、每头 256 个数、每个数 2 字节——合起来 **2 KiB**。两颗 NPU 分着存时，每颗 1 KiB。
- **30 层线性注意力**。它不给每个 token 留 KV，只在手里攥着一份固定大小的「状态」，每看完一个 token 就把它揉进去（见 [线性注意力](linear-attention.md)）。那条请求里，这份状态每层每颗 NPU 约 **1 MiB**，30 层合起来约 30.7 MiB，**不管回答 200 个 token 还是 2000 个 token 都是这么大**。

所以答案是：只有那 10 层会随长度涨，另外 30 层不涨。这是它和纯注意力模型最大的不同——同样 40 层的纯注意力模型，40 层都要一直涨。

上面的图就是这件事：一条斜线，一条平线。按每颗 NPU 每层来算，全注意力每个 token 加 1 KiB，线性注意力的状态从第一个 token 起就是约 1 MiB，**大约到一千个 token 时，一层全注意力存的 KV 才追上一层线性注意力的状态**。话短时状态是大头，话长时 KV 是大头。

## 四种存法并排

下面这张表每一行都挂在**自己那个模型**上，头数、维度一换数字就变。它不是让你横着比「谁省几成」，而是看**每一行存的是什么东西**。

| 注意力 | 数字取自 | 每 token 每层存多少 | 存的是什么 |
|---|---|---|---|
| 普通注意力（GQA） | Qwen3.6-35B-A3B 的全注意力层 | **2 KiB**（两颗 NPU 时每颗 1 KiB） | K 一份、V 一份，每个 KV 头各存一套 |
| MLA | DeepSeek 系 | **1152 字节** | 一份压缩过的潜向量，加一小段位置编码 |
| 稀疏注意力（SFA / DSA） | DeepSeek 系 | **1408 字节** | MLA 那一份，再加一份「目录」用的 key |
| 同上，目录用 8 位存 | DeepSeek 系 | **1282 字节** | 目录那份 key 换成 8 位整数，再配一个缩放系数 |
| 线性注意力 | Qwen3.6-35B-A3B 的线性层 | **不按 token 算**：每层每颗约 1 MiB，长短无关 | 一份固定大小的状态 |

前四行都是「每来一个 token 就多存一份」，只是每份大小不同；最后一行根本不是这个形状。

## 普通注意力：为什么前面有个 2

普通注意力那一行的算式是 `2 × KV 头数 × 每头维度 × 每个数的字节数`。最前面这个 2 就是「K 一份、V 一份」。

**这个 2 是算显存时最常出错的地方。** 它只属于普通注意力；MLA 那几行一条都没有。

KV 头数也要算对：Qwen3.6-35B-A3B 有 16 个查询头，却只有 2 个 KV 头——几个查询头共用一套 K 和 V，这就是 [GQA](gqa.md)。存的是 KV 头，所以乘的是 2 而不是 16。

## MLA 省在哪

不在压缩率，在**存的东西换了**。

不管模型有多少个注意力头，MLA 每个 token 每层只存一份东西，长度是 512 + 64：

- 512 那一段是压缩过的潜向量，要算注意力时再展开成每个头要的 K 和 V；
- 64 那一段是旋转位置编码的部分，它没法压进潜向量，只能原样存着。

所以账是 `(512 + 64) × 2 字节 = 1152 字节`：没有那个 2，也不乘头数。它里面装的是什么、谁装进去的，在 [MLA](mla.md) 那一页细讲，那一页也有同一个模型自己跟自己比的干净算法。

代价在别处：**省下的显存换成了算力**——每次用都要把潜向量展开。这是一笔明确的交换，不是白得的。

## 稀疏注意力多出来的是什么

稀疏注意力在 MLA 的基础上多存一份东西：一个小的「目录」模块要用的 key，每个 token 128 个数。

多存 `128 × 2 = 256` 字节换到的是：算注意力时**只读挑出来的那一小部分 token**，而不是把前面所有 token 都读一遍。序列越长这笔交换越划算——多出来的是常数，省下的随序列长度增长。

目录那份 key 还能再省一点：换成 8 位整数存，另配一个 2 字节的缩放系数，每个 token 每层从 1408 降到 1282 字节，降约 9%。省的只有目录那一段，潜向量本身一个字节都没动。而且这两个数用什么类型**跟硬件走**，同一份配置在两代卡上算出来的字节数不一样。

## 线性注意力：不按 token 算的那一种

前面几种不管省多省少，都是「一个 token 一份」，回答越长存得越多。线性注意力跳出了这个形状：它的状态从第一个 token 起就在那里，之后大小不变。

这带来两个直觉之外的结果：

- **短请求反而吃亏。** 那条请求只有 237 个 token，10 层全注意力的 KV 一共才 2.3 MiB，线性注意力的状态却有约 30.7 MiB——占地方的大头是那份一开始就固定的状态。
- **它在显存里占的比它本身大。** 为了和全注意力的块摆齐，每层的状态要补齐到一整块那么大，30 层实际占约 60.7 MiB，一半左右是补出来的空白。怎么补、为什么补，在 [那条请求](one-request.md) 那一页。

## 算显存最容易错的四处

1. **给 MLA 也乘了 2。** 那个 2 只属于普通注意力，套上去直接偏一倍。
2. **忘了稀疏注意力的目录那一份。** 它是要单算的，而且不同版本记在不同的地方（见下半）。
3. **把混合模型的每一层都当全注意力算。** Qwen3.6-35B-A3B 40 层里只有 10 层存 KV；按 40 层算会多算三倍，还漏掉了状态那一整块。
4. **拿「每 token 字节数」直接乘序列长度就当成占用。** 实际占用按**块**取整：那条请求 237 个 token 只写进约 2.3 MiB 的 KV，却占住一整个 2048 位置的块，每颗 NPU 20 MiB。零头是拿不回来的。

## 常见误解

- **「MLA 是把 KV 压缩了」**——它存的是另一种东西（潜向量），不是把 K 和 V 压小。所以没有「压缩率」可谈，只有维度对比。
- **「稀疏注意力省显存」**——它存的反而**比 MLA 多**。它省的是读取量，不是存储量。
- **「线性注意力什么都不存」**——它不存 KV，但存一份状态，而且在短请求里这份状态比 KV 还大。
- **「目录用 8 位存能把 KV 砍一半」**——它只动目录那一段，整体降约 9%。

## 对照源码

### 怎么开

后端不用手选：昇腾平台按 `(use_mla, use_sparse, use_compress)` 三个布尔量查表 [C15]。Qwen3.6-35B-A3B 的配置里没有 MLA 和稀疏的字段，全注意力层三个都是 `False`，查到 `AscendAttentionBackend`（`vllm_ascend/platform.py:822-824`，v0.23 检出已核）。`(True, False, False)` 是 `AscendMLABackend`，`(True, True, False)` 是 `AscendSFABackend`，`(True, False, True)` 是 `AscendDSABackend`。

各后端的 KV 张量形状 [C1][C2][C3][C4]：

| 后端 | `get_kv_cache_shape` 返回 | 已核位置（v0.23 检出） |
|---|---|---|
| `AscendAttentionBackend` | `(2, num_blocks, block_size, num_kv_heads, head_size)`，五维，最前面的 `2` 是 K 和 V | `attention_v1.py:105-112` |
| `AscendMLABackend` | `(num_blocks, block_size, num_kv_heads, head_size)`，四维 | `mla_v1.py:99-106` |
| `AscendSFABackend` | 同上，四维 | `sfa_v1.py:158-165` |
| `AscendDSABackend` | 同上，四维 | `dsa_v1.py:212-213` |

### 开销和什么时候别开

**每 token 每层的推导** [D]，都是 `page_size_bytes ÷ 块里的 token 数`，与块大小无关：

| 档 | 算式 | 结果 |
|---|---|---|
| GQA（Qwen3.6-35B-A3B 全注意力层，TP=1） | `2 × 2（num_key_value_heads）× 256（head_dim）× 2 B` | 2048 B = 2 KiB |
| 同上，TP=2 每颗 | `2 × 1 × 256 × 2 B` | 1 KiB（与 [one-request](one-request.md) 一致） |
| MLA | `1 × (512 + 64) × 2 B` | 1152 B |
| SFA / DSA | `1 × (512 + 64 + 128) × 2 B` | 1408 B |
| SFA / DSA，开 LI C8 | `576 × 2 + 128 × 1 + 1 × 2` | 1282 B |

- 模型形状取自官方配置 [S19]：`num_hidden_layers: 40`、`full_attention_interval: 4`（10 层全注意力）、`num_attention_heads: 16`、`num_key_value_heads: 2`、`head_dim: 256`、`dtype: bfloat16`。全模型每 token 的 KV 是 `2 KiB × 10 层 = 20 KiB`，TP=2 每颗 10 KiB。
- MLA 与稀疏几档的维度是仓库测试夹具在用的那一组：`kv_lora_rank = 512`、`qk_rope_head_dim = 64` [C9]，`index_head_dim = 128` [C10]。
- **那个 2 的出处**：上游 `AttentionSpec.real_page_size_bytes` 返回 `2 * block_size * num_kv_heads * head_size * dtype_size`（`vllm/v1/kv_cache_interface.py:194-200`，0fc695fc 检出已核）[C11]；`FullAttentionSpec` 改写成 `(head_size + head_size_v)`（同文件 `:309-314`）[C12]，K 和 V 头维可以不同，相等时与乘 2 一样。
- **MLA 的 `num_kv_heads` 是 1**：昇腾只在开稀疏时自己重算 spec，传 `num_kv_heads=1`、`head_size = sum(sparse_head_dim)` [C8]；不开稀疏的 MLA 层照搬上游 `MLAAttention` 给的 spec，`num_kv_heads` 同样写死成 1 [C13][C14]。
- **indexer 的四条张量**：`AscendMLAAttentionSpec` 的 docstring 写明 `kv_cache[0]` 是 kv_lora、`[1]` 是 k_rope、`[2]` 是 indexer 的 key、`[3]` 是 key 的量化 scale，最后一条只在开 LI C8 时存在（`vllm_ascend/core/kv_cache_interface.py:28-55`，v0.23 检出已核）[C5]。
- **C8 档的公式**：`cache_sparse_li_c8` 分支按 `(k_head_dim + v_head_dim) × dtype + index_head_dim × c8_k_cache_dtype + c8_k_scale_cache_dtype` 计（同文件 `:88-99`）[C6]。dtype 跟硬件走：A5 上 key 是 `float8_e4m3fn`、scale 是 `float32`，其余型号是 `int8` 加 `float16`（同文件 `:19-24`）[C7]。1282 对 1408 少 126 字节，降约 9% [D]。
- **全注意力与线性注意力的交叉点** [D]：TP=2 每颗每层，KV 是 `1 KiB × n`，线性注意力状态是 SSM 1 MiB + 卷积 24 KiB = 1048 KiB（形状与精度的推导见 [one-request](one-request.md) 下半）。两者在 n ≈ 1048 个 token 相等。TP=1 时两边各翻一倍，交叉点不变。这里比的是状态本身；补齐后的实际占用（每层 2 MiB + 24 KiB）约要 2072 个 token 才追平。
- **块取整**：Qwen3.6-35B-A3B 在 TP=1/2 下块是 2048 个位置，一块每颗 `2048 × 10 KiB = 20 MiB`；那条请求 237 个 token 写进 `237 × 10 KiB ≈ 2.31 MiB`，占住一整块（数字取自 [one-request](one-request.md)）。

### 版本差异

稀疏那两档的账在 v0.26 上被拆成两份 spec 记，每 token 的总字节数没变。MLA 那一支的页字节覆写方法也改了名，见 [KV Cache Spec](kv-cache-spec.md)。

| 项 | v0.23 维护分支 | v0.26 起 | 意味着什么 |
|---|---|---|---|
| 稀疏层的 KV spec | 一份 `AscendMLAAttentionSpec`，`head_size` 是 512+64+128 | MLA 主缓存的 `head_size` 只剩 512+64，indexer 另起一份 `AscendSFAIndexerCacheSpec` [C17] | 拿单份 spec 的页字节算稀疏层显存，v0.26 上只会拿到 1152，漏掉 indexer 那一份 `[!]` |
| indexer 的 key 与 scale | 主缓存的 `kv_cache[2]` 与 `kv_cache[3]` | indexer 层自己的一份 spec 和物理张量 [C16] | 按下标去主缓存取 indexer 的 key，v0.26 上取不到 |
| 每 token 每层总字节 | 1408，C8 档 1282 | 主缓存 1152 ＋ indexer 256（C8 档 130）[C18] | 合起来还是 1408 与 1282，换的只是记在哪份 spec 上 |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 三元组查后端 | `vllm_ascend/platform.py`，`get_attn_backend_cls` |
| 各后端 KV 形状 | `vllm_ascend/attention/{attention_v1,mla_v1,sfa_v1,dsa_v1}.py`，`get_kv_cache_shape` |
| MLA / 稀疏的页字节 | `vllm_ascend/core/kv_cache_interface.py`，`AscendMLAAttentionSpec.page_size_bytes` |
| 普通注意力的页字节 | 上游 `vllm/v1/kv_cache_interface.py`，`AttentionSpec` / `FullAttentionSpec.real_page_size_bytes` |
| 稀疏层怎么重算 spec | `vllm_ascend/worker/model_runner_v1.py`，稀疏分支 [C8] |
| 线性注意力状态的形状与补齐 | 见 [one-request](one-request.md) 的源码位置表 |
