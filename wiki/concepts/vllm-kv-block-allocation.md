---
id: vllm-kv-block-allocation
title: KV 块是怎么分出来的
type: concept
summary: 全机只有一队空闲的 KV 块。请求要块就从队头取，每块记着有几条请求在用；用完计数减到 0，块排回队里等下一个人。那条 237 个 token 的请求只要了 1 块。
aliases: [BlockPool, KVCacheManager, allocate_slots, get_new_blocks, 分块, 块分配, 空闲块队列, 引用计数, ref_cnt]
chapters: ["11"]
order: 10
sources:
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L238-L250
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L196-L238
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L216-L226
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L438-L446
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L333-L363
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L130-L172
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L211-L226
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L142-L144
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L419-L441
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1369-L1406
  - vllm@568afb3a:vllm/v1/core/block_pool.py#L719-L740
  - vllm@568afb3a:vllm/v1/core/single_type_kv_cache_manager.py#L753-L763
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L173-L177
  - vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L90-L119
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_mamba_config.py#L94-L107
  - vllm@568afb3a:vllm/v1/core/kv_cache_utils.py#L626-L688
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L402-L417
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: vllm-scheduler
    kind: builds-on
    note: 每次调度挑中一条请求，紧接着就给它要块；块不够就退回去抢占
  - to: kv-cache
    kind: builds-on
    note: 分出去的块装的就是 KV Cache；这一页只管「给哪一块」，不管块里写什么
contradicts: []
updated: "2026-09-25"
origin: seed
---

你那句 37 个 token 的提问，模型要为它存下 [KV Cache](kv-cache.md)。存的地方从哪来？答案是：显存里的 KV Cache 事先被切成一个个**KV 块**，没人用的块排成一队，全机只有这一队。请求要块就从队头取，每块身上记一个数——**引用计数**，意思是「现在有几条请求在用我」；用完计数减回 0，块排回队里等下一个人。

[那条请求](one-request.md)从头到尾只要了 **1 块**：一块有 2048 个位置，问题 37 个加回答 200 个，一共 237 个 token，一块就装下了。

```wiki-diagram
file: block-allocation
```

## 一块有多大，池子在哪

一个 KV 块能放固定个数的 token。块里放一个 token 的格子叫**槽位**，一块就是一排连着编号的槽位。

这个模型在两颗 NPU 上跑时，一块是 **2048 个位置**。它有 40 层，其中只有 10 层是全注意力、要存 KV Cache（另外 30 层是[线性注意力](linear-attention.md)，存的是另一种固定大小的状态）。一个块号同时管这 10 层：每个 token 在每颗 NPU 上每层占 1 KiB，10 层合计 10 KiB，所以一块在每颗 NPU 上是 20 MiB。

开机时，程序先算出显存里放得下多少块，给它们从 0 开始编号，排成一队——这就是**空闲池**。之后所有请求都只从这一队里领块，没有「每条请求一个池子」这回事。有一个小细节：**0 号块一开机就被拿出来当占位用**，永远不会发给任何请求。

还有一点容易忽略：管块的这一侧手里只有**块号**，一串整数。它不碰显存，不知道块里写了什么。把块号换算成「第几个 token 写进哪个槽位」，是后面另一段代码的事，见 [块表](block-table.md) 与 [准备输入](prepare-inputs-flow.md)。

## 那条请求一共要了几次块

**第 1 步：问题进来。** [调度器](vllm-scheduler.md) 挑中这条请求，要给 37 个 token 找地方放。37 除以 2048 向上取整，是 1 块。于是从空闲队的**队头**取走一块，把它的引用计数从 0 改成 1。

**第 2 步到最后：一个字一个字往外吐。** 每一步多出 1 个 token，每一步都要再问一次「还放得下吗」。答案一直是放得下——237 个 token 连这块的零头都没用完。所以整个回答过程中，**一块新块都没再要过**。

**结束。** 引用计数从 1 减回 0，这块排回空闲队的**队尾**。注意，块里的内容**没有被清掉**，它只是回到了「谁都可以拿走」的状态。

对比一下就能看出块大小的影响：如果一块只有 128 个位置（昇腾上普通纯注意力模型的默认值），同样这 237 个 token 就要 2 块，第二块要等写第 129 个 token 时再要一次。块越大，要块的次数越少，但空着的也越多——这条请求占住 2048 个位置，只用了 237 个，剩下 1811 个别的请求也拿不走。

## 为什么要记引用计数

只有一条请求用一块时，计数只在 0 和 1 之间跳，看起来多此一举。它真正派上用场是在[前缀缓存](prefix-caching.md)打开之后：两条请求开头一模一样，第二条可以直接指向第一条已经算好的块，这块的计数就变成 2。第一条请求结束时计数减到 1，块**不能**回收，因为第二条还在用。只有减到 0，块才排回空闲队。

排回队里的块，如果之前登记过「我里面装的是哪一段内容」，那么在它被别人取走之前，后来的请求还能把它认领回来接着用——这就是前缀缓存能跨请求生效的原因。等它真被一个新请求从队头取走时，旧的登记才被抹掉。

## 这条请求的块为什么进不了前缀缓存

一块只有**写满**以后，才会被登记成「可以给别人复用」的缓存块。这条请求的块 2048 个位置只写了 237 个，到结束都没写满，所以它**从来没被登记过**，不会给后来的请求留下任何可复用的东西。

换句话说：对这个模型，提问加回答加起来不到 2048 个 token 的请求，按「只认写满的块」这条规则，一块都进不了缓存。常见的困惑「为什么前缀缓存总是按块对齐、尾巴那点 token 永远复用不上」，答案也在这里——没写满的块不算数。块越大，这个「尾巴」就越长。（这个模型在已发布的两个版本上默认连前缀缓存都没开，见[那条请求](one-request.md)。）

还有一个反直觉的细节：就算整段问题都命中了缓存，**最后一个 token 也必须重算**，因为要拿它的结果去预测下一个 token。而重算的起点要对齐到块的边界，所以「少算一个 token」在实现上可能变成**整整一块重算**。

## 还回去的块排在队伍哪一头

取块总是从队头取，所以排在队尾的块最晚被取走、内容留得最久。

一条请求有好几块时，是**倒着还**的：最后一块先排回去、最先被取走；第一块最后排回去、留得最久。理由是开头那几块最可能被下一条请求复用——前缀就在序列开头。

从 v0.26 起规则更细：**没登记过的块插到队头**，马上就会被取走；登记过的照旧排队尾。这条请求的块从没登记过，所以在 v0.26 上，它会被下一条请求立刻拿走；在 v0.23 上，它还排在整条空闲队的最后面。

## 线性注意力那 30 层的状态从哪来

也从**同一个空闲池**里领。这个模型的块之所以定成 2048 这么大，就是为了让线性注意力的状态和注意力的块摆得一样齐——块的大小是倒着从状态的大小算出来的，不是随手定的。这 30 层的状态实际占了多少显存、为什么有一半是补出来的空白，见[那条请求](one-request.md)。

## 常见误解

- **「每吐一个字都要分一次块」**——那条请求吐了 200 个字，只在第一步分过 1 次块。绝大多数步一块都不要。
- **「块池是每条请求一份」**——全机一份，所有请求从同一队里领。
- **「释放就是清空内容」**——不是。释放只把计数减掉、把块排回队里；内容留着，等真被别人取走时才作废。
- **「块大小可以随手调」**——对这个模型，传得比算出来的小会被静默改大；对普通纯注意力模型，开着前缀缓存或 Chunked Prefill（分块预填充）时也会被改回 128。

## 对照源码

### 怎么开

分块不需要打开，一直在跑。和它相关、能动的只有块大小：

- 通用那条路 `refresh_block_size` 在没设时填 128，开着前缀缓存或 chunked prefill 时把不是 128 的值改回 128 [C10]。后端报的 `get_supported_kernel_block_sizes() -> [128]` [C8] 是 kernel 支持范围，不是改块大小的那一步。
- 混合模型在 `refresh_block_size` 里直接返回、不走上面那条；改由昇腾的 `patch_mamba_config` 按「SSM 页对齐」算 `attn_block_size`，用户没设或设得比它小时覆盖成算出的值，只打一条 info 日志 [C15]。Qwen3.6-35B-A3B 在 TP=2 下算出 2048 [D]（推导见 [那条请求](one-request.md) 下半）。
- 形状数字来自官方配置 [S1]：`num_hidden_layers: 40`、`full_attention_interval: 4`（10 层全注意力）、`num_key_value_heads: 2`、`head_dim: 256`。TP=2 每颗 1 个 KV 头，每 token 每层 `2 × 256 × 1 × 2 B = 1 KiB` [D]，10 层 10 KiB，一块 `2048 × 10 KiB = 20 MiB` [D]。

### 会报什么错

- `get_new_blocks` 在要的块数超过空闲块数时直接抛 `ValueError("Cannot get {num_blocks} free blocks from the pool")` [C5]。正常路径上走不到这里：`allocate_slots` 的返回类型是 `KVCacheBlocks | None` [C1]，块不够时由调度器退回去抢占，见 [调度器](vllm-scheduler.md)。
- 块大小被改大时不报错，只有 info 日志 `Setting attention block size to %d tokens ...`；想按 128 一块理解这个模型的人会在这里对不上账。

### 开销和什么时候别开

- **大块的代价**：一块 20 MiB/NPU，这条请求只写进 `237 × 10 KiB ≈ 2.3 MiB` [D]。短请求、高并发时，每条请求至少占住一整块。
- **块大小 128 时的对照**：`ceil(237 / 128) = 2` 块，第二块在写下标 128（第 129 个 token）时由 `allocate_slots` 再要一次 [D]。
- **整块重算**：`get_computed_blocks` 把命中上限压成 `num_tokens - 1`，并注明因为 `allocate_slots` 要求 `num_computed_tokens` 对齐块边界，可能触发整块重算，将来去掉这条限制还能再快一点 [C3]。块是 2048 时这笔账按 2048 算 [D]。
- **只认写满的块**：`cache_full_blocks` 只登记整块 [C7]；这条请求 237 < 2048，按这条规则一块都不登记 [D]。

### 版本差异

| 项 | v0.23 | v0.26 | 意味着什么 |
|---|---|---|---|
| `free_blocks` 把还回来的块排在哪一头 | 一律 `append_n` 排队尾，另有 `prepend` 开关整批插队头 [C9] | 按有没有哈希分两拨：没哈希的 `prepend_n` 插队头，有哈希的 `append_n` 排队尾，`prepend` 参数取消 [C11] | 那条请求的块从没登记，v0.26 上会被下一条请求立刻取走，v0.23 上排在整条空闲队最后 |
| 没写满的块能不能进缓存表 | 不能 | `FullAttentionManager.cache_blocks` 多一个例外：该组 `block_size` 不等于 `hash_block_size` 时，prompt 尾部落在块中间的那一段登记一条「部分」条目；两者相等就直接 return [C12] | `hash_block_size` 在多组时取各组块大小的最大公约数（或 `prefix_match_unit`），前缀缓存和 KV connector 都没开时等于调度块大小 [C16]。Qwen3.6-35B-A3B 开了前缀缓存后各组的实际块大小本页没核，能不能碰到这个例外**未核**；按默认启动（前缀缓存关）碰不到 |

main 配套的上游没有检出，main 上 `free_blocks` 与部分缓存条目的行为本页未核。

### 源码位置

那条请求在代码里的路径（v0.23 配套上游）：

1. 开机：`KVCacheCoordinator` 只建**一个** `BlockPool`，所有 KV cache group（含线性注意力的状态）共用；`BlockPool` 持有全部块和 `free_block_queue`，并先 `popleft` 出 0 号块当 `null_block`。
2. 调度挑中后先 `get_computed_blocks` 查缓存；第一次问、前缀缓存默认关，返回空。
3. `allocate_slots(request, num_new_tokens=37)`，`ceil(37 / 2048) = 1` 块 [D]；转到 `BlockPool.get_new_blocks(1)`：`free_block_queue.popleft_n(1)`，开缓存时先 `_maybe_evict_cached_block` 抹掉旧登记，再 `ref_cnt` 0 → 1。
4. 之后每步 `allocate_slots(request, 1)`，一块都不要 [D]。
5. 前缀命中别人的块时走 `touch`：`ref_cnt == 0` 的先从空闲队里摘出来，再 `ref_cnt += 1`。
6. 结束：`KVCacheManager.free(request)`，docstring 写明按逆序还、让尾块先被淘汰；`free_blocks` 把 `ref_cnt` 减 1，减到 0 且不是 null 块的才回空闲队。

| 想看什么 | 去哪 |
|---|---|
| 要块、还块的入口 | `vllm/v1/core/kv_cache_manager.py`：`allocate_slots`、`get_computed_blocks`、`free` |
| 空闲队、引用计数、缓存表 | `vllm/v1/core/block_pool.py`：`BlockPool`、`get_new_blocks`、`touch`、`free_blocks`、`cache_full_blocks` |
| 全机一个池子 | `vllm/v1/core/kv_cache_coordinator.py` |
| 块大小从哪来 | `vllm_ascend/utils.py` 的 `refresh_block_size`；混合模型看 `vllm_ascend/patch/platform/patch_mamba_config.py` |
| v0.26 的哈希粒度 | `vllm/v1/core/kv_cache_utils.py`：`resolve_kv_cache_block_sizes` |
