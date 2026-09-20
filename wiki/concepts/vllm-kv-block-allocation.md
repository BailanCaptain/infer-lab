---
id: vllm-kv-block-allocation
title: block 是怎么分出来的
type: concept
summary: 那条请求一共要了两次块：第 1 步要了一块，第 92 步 decode 又要了一块。要块、给块、还块，全在上游的 EngineCore 进程里。
aliases: [BlockPool, KVCacheManager, allocate_slots, get_new_blocks, 分块, 块分配, 第 92 步]
chapters: ["11"]
order: 10
sources:
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L238-L250
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L196-L238
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L216-L226
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L438-L444
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L333-L360
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L130-L172
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L211-L218
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L142-L144
evidence: "C"
relations:
  - to: vllm-scheduler
    kind: builds-on
    note: 每次调度挑中一条请求，紧接着就调 allocate_slots；块不够就退回去抢占
contradicts: []
updated: "2026-09-19"
origin: seed
---

## 一句话

KV block 的分配完全在上游、完全在 EngineCore 进程里、完全只有整数。[那条请求](one-request.md)一共触发两次分配：**第 1 步一次，第 92 步 decode 一次**。

```wiki-diagram
file: block-allocation
```

## 那条请求走到这里

**第 1 步（prompt）。** 调度器挑中它之后调 `allocate_slots(request, num_new_tokens=37)` [C1]。37 个 token 要 `ceil(37 / 128) = 1` 块 [D]。`block_size` 是 128，因为昇腾的注意力后端只支持这一个值 [C8]。

`KVCacheManager` 转身向 `BlockPool.get_new_blocks(1)` 要 [C5]。`BlockPool` 从 `free_block_queue` 队头 `popleft_n(1)` 取一块，把它的 `ref_cnt` 从 0 加到 1 [C5]。

**第 2 到第 91 步 decode。** 每步 `allocate_slots(request, 1)`，但**一块都不要** [D]——第 0 块里还有空格。这一段里分配器基本上什么都没做。

**第 92 步 decode。** 已算 128 个 token，第 0 块的 128 格正好填满。这一步要写位置 128，`allocate_slots` 算出还差一块，于是第二次 `get_new_blocks(1)` [D]。

**结束。** `free(request)` 把两块**按逆序**还回队列，docstring 写明了理由：让序列尾部的块先被淘汰 [C4]。反过来说就是开头那块留得最久——前缀在序列开头，最可能被下一条请求复用的正是它。

## 为什么要先问「有没有现成的」

`allocate_slots` 之前还有一步 `get_computed_blocks` [C2]：拿请求的 block hash 去查有没有算过的块可以直接用。

那条请求是第一次问，一块都命中不了，返回 0 [C2]。但这条路径值得知道它的形状，因为它有一个反直觉的细节：**就算整个 prompt 全部命中，也必须留最后一个 token 重算**。源码注释写明了理由——要拿到 logits 就必须真的算一次，所以缓存命中长度上限被压成 `num_tokens - 1` [C3]。

更麻烦的是它的连带效果：`allocate_slots` 要求 `num_computed_tokens` 对齐到块边界，所以「少算一个 token」在实现上可能变成**整整一块要重算** [C3]。这条限制上游自己标了 TODO。

## 块什么时候才算「可以被别人复用」

拿到块只是占住了位置。只有当一块**写满**，它才会被登记进哈希表变成可复用的缓存块——这件事由 `cache_full_blocks` 做 [C7]。

对那条请求：第 0 块在第 91 步 decode 之后写满，这时它才带着哈希进表；第 1 块只用了 109 格，到请求结束都没写满，**所以它永远没进过缓存表** [D]。

这解释了一个常见困惑：为什么前缀缓存的命中率总是按块对齐的、尾巴上那点 token 从来复用不上。答案就在这里——**没写满的块不算数**。

## 同一个 block 的两种下标

这一页里的「块」全程只是一个整数 id。它离真正的显存地址还差一层：

- **上游给的是块 id 列表**——那条请求结束时是 `[b0, b1]`，两个整数；
- **昇腾算的是槽位下标**——第 128 个 token 落进 `b1 * 128 + 0` 这一格。

后半句不在这一页，也不在这个进程。见 [块表](block-table.md) 与 [准备输入](prepare-inputs-flow.md)。

## 常见误解

- **「decode 每一步都要分块」**——那条请求 199 步 decode 只分了 1 次 [D]。绝大多数步一块都不要。
- **「块池是每个请求一份」**——是全机一份。`BlockPool` 持有全部块和那条空闲队列 [C6]。
- **「释放就是清空内容」**——不是。`free` 只把 `ref_cnt` 减回去、块排进队尾；内容留着，等真被别人取走时才失效 [C5]。
- **「block_size 可以随便调」**——在昇腾上不行，后端只返回 `[128]` [C8]。
