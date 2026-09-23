---
id: kv-cache
title: KV Cache
type: concept
summary: 把已经算过的 token 的注意力中间量留在显存里，下一步生成新 token 时只算新的那一个，旧的直接读。MHA/GQA 模型存的是每层的 K 和 V；MLA 存的是压缩后的 latent，不是 K、V 本身。
aliases: [KV 缓存, 键值缓存, kv cache, KV 显存]
chapters: ["05", "11"]
order: 5
sources:
  - vllm@0fc695fc:vllm/model_executor/models/qwen3.py#L145-L162
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L182-L200
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L105-L112
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1408-L1428
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4928-L4938
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: prefill
    kind: builds-on
    note: 缓存是 prefill 那一步一次写满前 37 格、之后 decode 每步追加一格；先分清这两种步，才看得懂缓存什么时候写、什么时候读
  - to: rope
    kind: builds-on
    note: 存进缓存的 K 是已经按位置转过的 K，所以缓存内容跟位置绑定，不用每步重转
contradicts: []
updated: "2026-09-24"
origin: seed
---

## 一句话

模型每生成一个 token，都要让它「看」一遍前面的 token。看的方式是拿新 token 的 Q 去和前面每个 token 的 K 点乘、再按分数取它们的 V。**前面那些 token 的 K 和 V 一旦算出来就再也不会变**，所以算一次、留在显存里，后面每一步直接读——这块显存就是 KV Cache。

本页整段按全量注意力加 [GQA](gqa.md) 讲——示例模型 Qwen3-0.6B 就是这种。**存什么、读多少由注意力结构定**：[MLA](mla.md) 存的不是 K、V 本身而是压缩后的 latent；滑动窗口与稀疏注意力也不是每步读前面全部。换了结构，本页的「K 和 V」要按那一页的说法换算。

```wiki-diagram
file: kv-cache
```

## 没有它会怎样

拿[那条请求](one-request.md)算：问题 37 个 token，回答 200 个 token。

没有缓存，每一步都得把「到目前为止的整段」重新过一遍模型，才能拿到前面所有 token 的 K 和 V：

```
第 1 步过 37 个 token，第 2 步过 38 个，…，第 200 步过 236 个
合计 = 200 × 37 + (0 + 1 + … + 199) = 7400 + 19900 = 27300 个 token 次
```

有缓存，第 1 步过 37 个，之后 199 步每步只过 1 个新 token：

```
合计 = 37 + 199 = 236 个 token 次
```

差了约 116 倍 [D]，而且差距随回答长度按平方增长——回答越长，没缓存的那条路越走不动。

## 为什么只存 K 和 V，不存 Q

因为 Q 是「提问的一方」，只有当前这个新 token 需要提问；K 和 V 是「被看的一方」，每个旧 token 都要一直被后面的人看。

旧 token 的 Q 在它自己那一步用完就没用了。再加上因果掩码保证旧 token 永远看不到新 token，所以旧 token 的 K、V 不会因为后面来了新 token 而改变——这就是「算一次、永远有效」的依据 [D]。

## 缓存里存的到底是什么

看 Qwen3 一层注意力的 `forward` [C1]：Q、K、V 先由 `qkv_proj` 算出来，Q 和 K 做 qk-norm，再过 [RoPE](rope.md)，然后才交给注意力算子。K 和 V 是在**交给注意力算子之后**写进缓存的，所以：

- 存进去的 K 已经带着它自己的位置（转过了），读出来直接能用；
- 存进去的 V 是没转过的原样——RoPE 本来就不碰 V；
- **每一层各存各的**。第 3 层的 K 和第 4 层的 K 是两套完全不同的数，Qwen3-0.6B 的 28 层就是 28 份。少数模型声明跨层共享：声明了共享目标的层不建自己的缓存，直接读目标层那一份 [C5]。

在昇腾上，写缓存这个动作是 `do_kv_cache_update`：拿到这一步新算出来的 `key`、`value` 和一个 `slot_mapping`，调一次 `reshape_and_cache`，把它们写进 `slot_mapping` 指定的格子里 [C4]。「哪一格」不是这一页的事，见 [Block Table](block-table.md)。

## 它长什么样、有多大

昇腾普通注意力（GQA）后端给每一层声明的缓存张量形状是 [C3]（MLA 系后端是另一套形状，见 [MLA](mla.md) 与[后端家族](attention-backend-family.md)）：

```
(2, num_blocks, block_size, num_kv_heads, head_size)
 │       │          │            │            └ 每个头 128 维
 │       │          │            └ 8 个 KV 头（不是 16 个 Q 头——GQA 省的就是这里）
 │       │          └ 每块 128 个 token 的位置
 │       └ 显存够分多少块
 └ K 一份、V 一份
```

上游算一块要多少字节用的是同一个式子：`2 × block_size × num_kv_heads × head_size × 每个数的字节数` [C2]。

代入 Qwen3-0.6B，得到全库反复用的那两个数：**每个 token 112 KiB，每块 14 MiB**。推导写在 [KV Cache Spec](kv-cache-spec.md)，这里不重算。那条请求总共 237 个 token，占 2 块、28 MiB。

值得停一下看这个量级：Qwen3-0.6B 的全部权重大约 1.2 GB [D]（0.6B 个参数 × 2 字节）。一条 1 万 token 的长对话，光 KV Cache 就是 `10000 × 112 KiB ≈ 1.07 GiB` [D]——**一条长请求的缓存就和整个模型差不多大**。所以在权重小、上下文长的场景里，推理服务的显存大头是缓存，不是模型；权重占掉整卡大半、对话又短时，天平会倒回去——缓存预算本来就是整卡减掉权重和激活之后剩下的部分（见 [KV Cache 显存预算](kv-cache-memory-profiling.md)）。后面整个第 11 章都在处理缓存这一侧。

## 那条请求走到这里

- **第 1 步（prefill）**：37 个 token 的 K、V 在每一层各写 37 格，一次写完。
- **第 2 到第 200 步（decode）**：每步每层只写 1 格，读的时候读前面全部。
- **第 92 步 decode**：第 0 块的 128 格写满了，新 token 的 K、V 要写进第 1 块的第 0 格。对缓存本身来说这只是「换一个地址写」；谁去要的新块、地址怎么算出来的，见[那条请求](one-request.md)里对这一刻的拆解。

## 它引出的一串问题

缓存一旦成了显存的大头，后面的问题就都是围着它转的：

- 按整条请求预留连续显存太浪费 → 切成块按需分配：[PagedAttention](paged-attention.md)
- 开机时到底能分出多少块 → [KV Cache 显存预算](kv-cache-memory-profiling.md)
- 两条请求开头一样，缓存能不能共用 → [Prefix Caching](prefix-caching.md)
- 每个数能不能存得更小 → [KV Cache 量化](kv-cache-quantization.md)
- 显存不够时能不能挪到 CPU → [KV Cache CPU Offload](kv-cache-cpu-offload.md)
- 不同的注意力结构每 token 要存多少 → [四种注意力的代价](attention-cost.md)

## 常见误解

- **「KV Cache 是为了省显存」。** 反了。它是**拿显存换计算**：多占显存，换来每步只算一个 token。
- **「缓存的是 token 或者 embedding」。** 缓存的是注意力算出来的中间量——GQA 是每层的 K、V 两个张量，MLA 是压缩后的 latent——和输入的 token id、embedding 都不是一回事；同一个 token 在 28 层里有 28 份互不相同的缓存。
- **「开了缓存结果会有点不一样」。** 数学上完全等价——缓存里的就是不缓存时每步会重算出来的那些数，只是不重算了 [D]。
