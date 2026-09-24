---
id: kv-cache
title: KV Cache
type: concept
summary: 模型每吐一个新 token，都要回头看一遍前面所有 token。前面那些 token 被看的那一份数字算出来就不会再变，所以算一次、留在显存里，后面每步直接读，只给新来的那一个现算——这块显存就是 KV Cache。贯穿例子的 40 层里只有 10 层要存它。
aliases: [KV 缓存, 键值缓存, kv cache, KV 显存]
chapters: ["05", "11"]
order: 5
sources:
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_next.py#L286-L315
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L182-L200
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L105-L112
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1408-L1428
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4928-L4938
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm@0fc695fc:vllm/model_executor/models/qwen3_5.py#L82-L88
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L107-L107
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_v1.py#L1531-L1551
  - vllm-ascend@baa023ad:vllm_ascend/attention/attention_v1.py#L111-L1115
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: prefill
    kind: builds-on
    note: 缓存是 prefill 那一步一次写满前 37 格、之后 decode 每步追加一格；先分清这两种步，才看得懂缓存什么时候写、什么时候读
  - to: rope
    kind: builds-on
    note: 存进缓存的 K 是已经按位置转过的 K，所以缓存内容跟位置绑定，不用每步重转
  - to: attention-qkv
    kind: builds-on
    note: 缓存里存的就是那一页讲的 K 和 V；Q、K、V 各是什么、怎么配合，本页不重讲
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一句话

先看一个具体的问题：[贯穿例子](one-request.md)里，问题有 37 个 token。模型吐出回答的第 1 个 token 之后，要吐第 2 个——这时它得再看一遍问题里那 37 个 token。那 37 个 token 在注意力里要用到的数字，要不要重算一遍？

不用。新 token 看前面的方式，是拿自己的 Q 去和前面每个 token 的 K 比、再按比出来的分数取它们的 V（K、V 是什么见[注意力：Q、K、V](attention-qkv.md)）。**前面那些 token 的 K 和 V 一旦算出来就再也不会变**，所以算一次、留在显存里，后面每一步直接读，只给新来的那一个 token 现算——这块显存就是 KV Cache。贯穿例子里把它叫作「笔记」：每个 token 留一份，话越长，笔记越多。

```wiki-diagram
file: kv-cache
```

本页按全注意力加 [GQA](gqa.md) 讲，贯穿例子的全注意力层就是这种。**存什么、读多少由注意力结构定**：[MLA](mla.md) 存的不是 K、V 本身而是压缩后的一份小向量；滑动窗口与稀疏注意力也不是每步读前面全部；[线性注意力](linear-attention.md)干脆不留笔记。换了结构，本页的「K 和 V」要按那一页的说法换算。

## 没有它会怎样

拿贯穿例子算：问题 37 个 token，回答 200 个 token。

没有缓存，每一步都得把「到目前为止的整段」重新过一遍模型，才能拿到前面所有 token 的 K 和 V：

```
第 1 步过 37 个 token，第 2 步过 38 个，…，第 200 步过 236 个
合计 = 200 × 37 + (0 + 1 + … + 199) = 7400 + 19900 = 27300 个 token 次
```

有缓存，第 1 步过 37 个，之后 199 步每步只过 1 个新 token：

```
合计 = 37 + 199 = 236 个 token 次
```

差了约 116 倍，而且差距随回答长度按平方增长——回答越长，没缓存的那条路越走不动。上面那张图只画了前 4 步，已经能看出两条路一个在长、一个不长。

## 为什么只存 K 和 V，不存 Q

因为 Q 是「提问的一方」，只有当前这个新 token 需要提问；K 和 V 是「被看的一方」，每个旧 token 都要一直被后面的 token 看。

旧 token 的 Q 在它自己那一步用完就没用了。再加上每个 token 只能看它前面的、永远看不到后面的，旧 token 的 K、V 不会因为后面来了新 token 而改变——这就是「算一次、永远有效」的依据。

## 缓存里存的是什么

- **存进去的 K 已经带着它自己的位置。** 模型先算出 Q、K、V，把 Q 和 K 各自归一化一下，再按位置把 Q 和 K 「转」一下（[RoPE](rope.md)），然后才去做注意力、顺手把 K 和 V 写进缓存。所以读出来的 K 直接能用，不用每步重转。
- **存进去的 V 是原样。** 按位置转只动 Q 和 K，不碰 V。
- **每一层各存各的。** 第 4 层的 K 和第 8 层的 K 是两套完全不同的数，要存几层就是几份。少数模型会声明「这一层直接借用某一层的缓存」，那样的层就不建自己的。

「写进哪一格」不是这一页的事，见[块表](block-table.md)。

## 40 层里只有 10 层要存

贯穿例子的模型有 40 层（层是什么见[层与隐藏向量](layers-and-hidden.md)），但**不是每层都留笔记**：每 4 层里只有最后 1 层是全注意力，一共 10 层；另外 30 层是[线性注意力](linear-attention.md)。

```wiki-diagram
file: one-request-layers
```

线性注意力不回头翻前面的 token，手里只带一份大小固定的「小抄」，每看完一个 token 就揉进去。它不需要 KV Cache，要存的是那份小抄，而小抄的大小和话多长无关。

所以对这个模型，「每个 token 的笔记」只有 10 层份，不是 40 层份。这是贯穿例子和普通纯注意力模型最不一样的地方：同样多的层，它的 KV Cache 只有纯注意力模型的四分之一左右。

## 每个 token 占多少

一层全注意力给一个 token 存的是：K 一份、V 一份，每份有几个 KV 头就几段，每段 256 个数，每个数 2 个字节。

- **一颗 NPU 跑整个模型时**：这个模型有 2 个 KV 头（Q 头有 16 个，[GQA](gqa.md) 让 8 个 Q 头共用一个 KV 头，省的就是这里），每 token 每层 **2 KiB**。
- **贯穿例子的两颗 NPU**：注意力对半分给两颗（见[张量并行](tensor-parallel.md)），每颗只剩 1 个 KV 头，每 token 每层每颗 **1 KiB**。10 层合计每颗 **10 KiB**。

一次提问 237 个 token（问题 37 + 回答 200），每颗 NPU 上的笔记一共 **2.31 MiB**——很小。

## 这个量级该怎么看

在这个模型上，KV Cache 省得很凶：层只存四分之一，头只有 2 个。一段 1 万 token 的长对话，每颗 NPU 上的笔记也不到 100 MiB；哪怕把模型允许的最长上下文（约 26 万 token）一次用满，每颗也就约 2.5 GiB。和两颗 NPU 上约 60 GiB 的专家权重比，一条请求的笔记不算大头。

但有两件事让它依然要紧：

- **笔记按请求数和长度一起涨。** 显存里分给缓存的，是整卡扣掉权重和运行时临时数据之后剩下的那一块（见 [KV Cache 显存预算](kv-cache-memory-profiling.md)）。同时在跑的请求越多、每条越长，这块就越早用完；它决定的是一台机器能同时接多少请求。
- **在这个模型上，占地方的另一个大头是线性注意力那份小抄。** 贯穿例子这次提问，小抄在每颗 NPU 上实际占约 60.7 MiB，远大于 2.31 MiB 的笔记。话要长到约 6 千个 token，笔记才追得上小抄。这笔账在[贯穿例子](one-request.md)和[线性注意力](linear-attention.md)里算过。

纯注意力的小模型正好相反：权重小、每层都存，长对话的笔记可以和整个模型一样大。所以「缓存是不是显存的大头」要按模型的结构算，不能一概而论。

## 那条请求走到这里

- **第 1 步（[prefill](prefill.md)）**：37 个 token 的 K、V 在那 10 层里各写 37 格，一次写完。另外 30 层把这 37 个 token 揉进各自的小抄。
- **第 2 到第 200 步（decode）**：每步在那 10 层里各写 1 格，读的时候读前面全部。
- **从头到尾不换块。** 这个模型的缓存按 2048 个位置一块来分，237 个 token 一块就装下了，这条请求走完也只用了第一块的开头 237 格。块为什么这么大、谁去要的块，见[贯穿例子](one-request.md)和[块是怎么分出来的](vllm-kv-block-allocation.md)。

## 它引出的一串问题

缓存占多少、怎么放、能不能省，后面的问题都围着它转：

- 按整条请求预留连续显存太浪费 → 切成块按需分配：[PagedAttention](paged-attention.md)
- 开机时到底能分出多少块 → [KV Cache 显存预算](kv-cache-memory-profiling.md)
- 每块、每 token 到底多少字节 → [KV Cache Spec](kv-cache-spec.md)
- 两条请求开头一样，缓存能不能共用 → [前缀缓存](prefix-caching.md)
- 本卡放不下的前缀能不能放到卡外、下次再拿回来 → [KV Pool](kv-pool.md)
- 每个数能不能存得更小 → [KV Cache 量化](kv-cache-quantization.md)
- 显存不够时能不能挪到 CPU → [KV Cache CPU Offload](kv-cache-cpu-offload.md)
- 不同的注意力结构每 token 要存多少 → [四种注意力的代价](attention-cost.md)
- 能不能干脆不留笔记 → [线性注意力](linear-attention.md)

## 常见误解

- **「KV Cache 是为了省显存」。** 反了。它是**拿显存换计算**：多占显存，换来每步只算一个 token。
- **「缓存的是 token 或者 embedding」。** 缓存的是注意力算出来的中间量——GQA 是每层的 K、V 两份，MLA 是压缩后的小向量——和输入的 token 编号、[embedding](embedding.md) 都不是一回事。同一个 token 在贯穿例子的 10 层全注意力里有 10 份互不相同的缓存。
- **「模型有几层，就存几层」。** 不一定。贯穿例子 40 层只存 10 层，另外 30 层是线性注意力，存的是固定大小的小抄。
- **「开了缓存结果会有点不一样」。** 数学上完全等价——缓存里的就是不缓存时每步会重算出来的那些数，只是不重算了。

## 对照源码

### 开销和什么时候别开

- 「没有它会怎样」那笔账：不缓存时合计 `200 × 37 + (0 + 1 + … + 199) = 27300` 个 token 次，缓存时 `37 + 199 = 236`，比值约 116 [D]。图里前 4 步：`37 + 38 + 39 + 40 = 154` 对 `37 + 1 + 1 + 1 = 40` [D]。
- 「算一次、永远有效」：因果掩码保证旧 token 看不到新 token，所以旧 token 的 K、V 不随后来者改变 [D]；也因此开缓存与不开数学上等价 [D]。
- 写缓存的时机：以贯穿例子的全注意力层为例 [C1]，`qkv_proj` 算出 Q、K、V，Q、K 做 `q_norm` / `k_norm`，再过 `rotary_emb`，然后 `self.attn(q, k, v)` 交给注意力算子；K、V 在算子里写进缓存，所以存的 K 已转过位置、V 原样。这个模型的全注意力层用的就是这个类 [C7]。它按 `partial_rotary_factor: 0.25` 只转 256 维里的 64 维 [S6]，不影响「存的 K 已转过」这一点。
- 层数与头数来自官方配置 [S6]：`num_hidden_layers: 40`、`full_attention_interval: 4`（10 层全注意力）、`num_attention_heads: 16`、`num_key_value_heads: 2`、`head_dim: 256`、`dtype: bfloat16`。
- 昇腾普通注意力（GQA）后端给每层声明的缓存张量形状 [C3]（MLA 系后端是另一套，见 [MLA](mla.md) 与[后端家族](attention-backend-family.md)）：

  ```
  (2, num_blocks, block_size, num_kv_heads, head_size)
   │       │          │            │            └ 256
   │       │          │            └ TP=2 下每颗 1 个 KV 头（不是 16 个 Q 头）
   │       │          └ 这个模型算出来是 2048
   │       └ 显存够分多少块
   └ K 一份、V 一份
  ```

- 上游算一块字节数用同一个式子：`2 × block_size × num_kv_heads × head_size × dtype 字节数` [C2]。每 token 每层：TP=1 为 `2 × 2 × 256 × 2 B = 2 KiB`，TP=2 每颗 `2 × 1 × 256 × 2 B = 1 KiB`；10 层合计每颗 10 KiB/token；237 token 为 `237 × 10 KiB = 2370 KiB ≈ 2.31 MiB` [D]。块大小 2048 的来历与「一块 20 MiB/NPU」见[贯穿例子](one-request.md)下半。
- 量级：`10000 × 10 KiB ≈ 97.7 MiB`、`262144 × 10 KiB = 2.5 GiB`（每颗，`max_position_embeddings: 262144` [S6]）[D]；笔记追上补齐后小抄的长度 `60.7 MiB ÷ 10 KiB/token ≈ 6216 token` [D]，60.7 MiB 取自[贯穿例子](one-request.md)。
- 跨层共享：声明了 `kv_sharing_target_layer_name` 的层不建自己的 `KVCacheSpec`，直接用目标层那一份 [C5]。

### 版本差异

| | v0.23.0 | v0.26.0rc | main |
| --- | --- | --- | --- |
| GQA 后端缓存形状 `(2, num_blocks, block_size, num_kv_heads, head_size)` | 有 [C3] | 相同 [C8] | 相同，`attention_v1.py:111` [C10] |
| 写缓存 `do_kv_cache_update` → `reshape_and_cache` | 有 [C4] | 相同，只是挪了行号 [C9] | 相同，`attention_v1.py:1101-1115` [C10] |

### 源码位置

- 写缓存：`vllm_ascend/attention/attention_v1.py` 的 `do_kv_cache_update`，拿本步新算出的 `key`、`value` 和 `slot_mapping` 调一次 `reshape_and_cache`，写进 `slot_mapping` 指定的格子 [C4]。
- 形状：同文件 `get_kv_cache_shape` [C3]。
- 字节数：上游 `vllm/v1/kv_cache_interface.py` 的 `real_page_size_bytes` [C2]。
- 跨层共享：`vllm_ascend/worker/model_runner_v1.py` [C5]。
- 全注意力层 `forward`：上游 `vllm/model_executor/models/qwen3_next.py` 的 `Qwen3NextAttention` [C1]，`qwen3_5.py` 从这里导入 [C7]。
