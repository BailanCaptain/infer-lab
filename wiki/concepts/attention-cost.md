---
id: attention-cost
title: 四种注意力的代价
type: concept
summary: 同样存一个 token 一层，普通 GQA 要 4096 字节，MLA 只要 1152。差别不是压缩得好，是存的东西根本不一样。
aliases: [KV 占用, 每 token 字节数, MLA 省多少, page_size_bytes, 稀疏注意力代价, indexer]
chapters: ["04"]
order: 20
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L105-L112
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L99-L106
  - vllm-ascend@2c59ff10:vllm_ascend/attention/sfa_v1.py#L158-L165
  - vllm-ascend@2c59ff10:vllm_ascend/attention/dsa_v1.py#L212-L217
  - vllm-ascend@2c59ff10:vllm_ascend/core/kv_cache_interface.py#L28-L55
  - vllm-ascend@2c59ff10:vllm_ascend/core/kv_cache_interface.py#L66-L121
  - vllm-ascend@2c59ff10:vllm_ascend/core/kv_cache_interface.py#L19-L25
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4976-L4986
  - vllm-ascend@2c59ff10:tests/ut/attention/a2/test_mla_cp.py#L269-L272
  - vllm-ascend@2c59ff10:tests/ut/worker/a2/test_model_runner_v1.py#L338-L342
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L194-L200
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L295-L315
evidence: "C"
relations:
  - to: attention-backend-family
    kind: builds-on
    note: 那一页讲三元组怎么查出一个后端，这一页讲查中之后各自要付多少字节
  - to: one-request
    kind: builds-on
    note: 那条请求走的是这四条里最贵的一条，它那 112 KiB 就是从这儿来的
  - to: kv-cache-spec
    kind: builds-on
    note: GQA 那一条的完整推导在那一页，这里只取结果拿来跟另外三条并排比
contradicts: []
updated: "2026-09-19"
origin: seed
---

## 一句话

同样是"存一个 token 在一层里的 KV"，普通 GQA 要 **4096 字节**，MLA 只要 **1152 字节**。差的三倍半**不来自压缩算法，来自存的东西不一样**：前者存 K 和 V 两份真实向量，后者只存一份压缩过的潜向量，要用的时候再展开。

```wiki-diagram
file: attention-cost
```

## 那条请求走到这里

[那条请求](one-request.md)走的是图上**最长的那一条**。

Qwen3-0.6B 是普通 GQA 模型，三个布尔量全是 `False`，查表查到 `AscendAttentionBackend` [C1]。它每个 token 每层要 4096 字节，28 层合起来 112 KiB [D]——这个数在全库反复出现，源头就在这条最长的条上。

**它是四条里最贵的。** 同样 237 个 token，换成一个 MLA 模型，每层的 KV 会少掉七成以上 [D]。

## 四个数并排

`block_size` 取 128、KV 用 bf16，按各后端的 `page_size_bytes` 公式除以 128 得到"每 token 每层"[D]：

| 后端 | 每 token 每层 | 算式 | KV 张量长什么样 |
|---|---|---|---|
| `AscendAttentionBackend` | **4096 B** | `2 × 8 × 128 × 2` | 五维，最前面那个 `2` 是 K 和 V [C1] |
| `AscendMLABackend` | **1152 B** | `1 × (512 + 64) × 2` | 四维，只有一份潜向量 [C2] |
| `AscendSFABackend` / `AscendDSABackend` | **1408 B** | `1 × (512 + 64 + 128) × 2` | 四维，另加一份 indexer 的 key [C3] |
| 同上，开 LI C8 | **1282 B** | `576×2 + 128×1 + 1×2` | indexer 的 key 换成 int8，再配一个 scale [C6] |

里面那几个维度不是我编的，是仓库自己的测试夹具在用的那一组：`kv_lora_rank = 512`、`qk_rope_head_dim = 64` [C9]，`index_head_dim = 128` [C10]。第一行的 `n_kv = 8`、`d_h = 128` 来自 Qwen3-0.6B。

## 为什么 GQA 那条前面有个 2

上游 `AttentionSpec` 的基础公式明写着这个 2 [C11]：

```python
return 2 * self.block_size * self.num_kv_heads * self.head_size * get_dtype_size(self.dtype)
```

它就是"K 一份、V 一份"。`FullAttentionSpec` 把它改写成 `head_size + head_size_v` [C12]——更通用的写法，K 和 V 的头维可以不一样；两者相等时结果和乘 2 一模一样。

**这个 2 是算显存时最常出错的地方。** 它只属于走五维形状的那些后端；MLA 系一条都没有。

## MLA 省在哪

不在压缩率，在**存的东西换了**。

MLA 构造 KV spec 时传的是 `num_kv_heads=1`、`head_size = sum(sparse_head_dim)` [C8]——也就是说，不管模型有多少个注意力头，**KV 里只存一份**，长度是 `kv_lora_rank + qk_rope_head_dim`。

- `kv_lora_rank = 512`：那份压缩过的潜向量，算注意力时再展开成每个头要的 K 和 V；
- `qk_rope_head_dim = 64`：旋转位置编码那一段，它没法压进潜向量，只能原样存着。

所以 MLA 的账是 `(512 + 64) × 2 = 1152` 字节，没有那个 2，`num_kv_heads` 也是 1 而不是 8 [D]。

代价在别处：**省下的显存换成了算力**——每次用都要把潜向量展开。这是一笔明确的交换，不是白得的。

## 稀疏那两条多出来的是什么

SFA 和 DSA 在 MLA 的基础上多存一份东西：**indexer 的 key**。

`AscendMLAAttentionSpec` 的 docstring 把这几条张量列得很清楚 [C5]：`kv_cache[0]` 是 kv_lora，`kv_cache[1]` 是 k_rope，`kv_cache[2]` 是 indexer 模块的 key，`kv_cache[3]` 是那份 key 的量化 scale——**最后一条只在开了 LI C8 时才存在**。

多存 `128 × 2 = 256` 字节换到的是：算注意力时**只读 top-k 个 token**，而不是把前面所有 token 都读一遍。序列越长这笔交换越划算——多出来的是常数，省下的随序列长度增长 [D]。

## C8 那一档在省什么

开 LI C8 之后，indexer 那份 key 从 bf16 换成 int8，另外补一个 fp16 的 scale [C6][C7]：

```
576 × 2（潜向量，还是 bf16） + 128 × 1（key，int8） + 1 × 2（scale，fp16） = 1282 B
```

比不开的 1408 少 126 字节，**降幅约 9%** [D]。注意省的只有 indexer 那一段，潜向量本身一个字节都没动。

还有一条容易踩的：这几个 dtype **跟硬件走**。A5 上 key 用的是 `float8_e4m3fn`、scale 用 `float32`；其余型号是 `int8` 加 `float16` [C7]。**同一份配置在两代卡上算出来的每 token 字节数不一样**，拿一台机器测出来的数去推另一台会偏。

## 算显存最容易错的三处

1. **给 MLA 也乘了 2。** 那个 2 只属于五维那条，套上去直接偏一倍 [D]。
2. **忘了 indexer 那一份。** 开稀疏时 `head_size` 是三段之和，不是两段 [C8]。
3. **拿"每 token 字节数"直接乘序列长度就当成占用。** 实际占用按**块**取整——那条请求 237 个 token 真正用掉 25.9 MiB，却占住两个整块 28 MiB。零头是拿不回来的。

## 常见误解

- **「MLA 是把 KV 压缩了」**——它存的是另一种东西（潜向量），不是把 K 和 V 压小。所以没有"压缩率"可谈，只有维度对比 [C2][C8]。
- **「稀疏注意力省显存」**——它的 KV 占用反而**比 MLA 多** [D]。它省的是读取量，不是存储量。
- **「四个后端的形状只是 head_size 不同」**——差一整个维度：普通后端五维，MLA 系四维 [C1][C2]，字节数差三倍半 [D]。
- **「C8 能把 KV 砍一半」**——它只动 indexer 那一段，整体降约 9% [D]。
