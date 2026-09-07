---
id: block-table
title: Block Table
type: concept
summary: 每个请求一行、记录它按顺序占用了哪些物理 KV block 的整数表；配合 slot_mapping 把 token 位置翻译成 KV cache 里的写入槽位。
aliases: [块表, 块映射表]
chapters: ["11"]
sources:
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/block_table.py#L84-L98
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/block_table.py#L100-L119
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/block_table.py#L140-L179
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/block_table.py#L248-L272
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/block_table.py#L278-L283
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/block_table.py#L347-L353
  - vllm-ascend@28bf3a2e:vllm_ascend/ops/triton/compute_slot_mapping.py#L30-L41
  - vllm-ascend@28bf3a2e:vllm_ascend/ops/triton/compute_slot_mapping.py#L43-L84
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/npu_input_batch.py#L131-L144
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L1143-L1145
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L1468-L1472
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L3152-L3158
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L200-L210
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1646-L1656
evidence: "C"
related: [paged-attention, kv-cache-spec, prefix-caching]
contradicts: []
updated: "2026-09-06"
---

## 是什么

一个请求的 KV cache 在显存里不是连续的一整条，而是被切成固定大小的 block 散落存放（见 [PagedAttention](paged-attention.md)）。Block table 解决的就是「散落之后怎么找回来」：它是一张二维整数表，第 `i` 行属于 batch 里第 `i` 个请求，第 `j` 列存这个请求第 `j` 个逻辑 block 落在了哪个物理 block 上。`AscendMetadata` 里对它的原文描述是 "Block addresses per sequence (Seq id -> list of physical block)"，形状 `(batch_size, max_blocks_per_seq)`（[来源](../raw/block-table.md)，`vllm_ascend/attention/attention_v1.py#L200-L210`）。

表本身只回答「逻辑 block → 物理 block」。要把它变成「第 t 个 token 写哪儿」，还需要 `slot_mapping`：长度等于本步 token 数的一维数组，第 t 项就是这个 token 的 K/V 在 KV cache 里的绝对槽位号。两者一起构成 vLLM 的地址转换层——block table 是页表，slot_mapping 是这一步查表得到的物理地址。

## 形状与数值

两个缓冲区都是 `CpuGpuBuffer`（CPU pinned + NPU 各一份），dtype 都是 `int32`（`vllm_ascend/worker/block_table.py#L87-L95`）：

- `block_table`：`(max_num_reqs * duplicate_size, logical_table_size)`。非 DCP 场景 `duplicate_size = 1`、`logical_table_size = max_num_blocks_per_req`，即 `(max_num_reqs, max_num_blocks_per_req)`。
- `slot_mapping`：`(max_num_batched_tokens + max(num_speculative_tokens - 1, 0) * max_num_reqs,)`。多出的那段是给 MTP 草稿位置用的。

列数默认由 `cdiv(max_model_len, block_size * dcp_world_size)` 算出（`block_table.py#L347-L353`）。取 `max_model_len = 32768`、`block_size = 128`、`dcp_world_size = 1`，列数就是 256；再取 `max_num_reqs = 256`，整张表是 `256 × 256` 的 int32，256 KiB——相对 KV cache 本体可以忽略，所以它是常驻缓冲，不按需分配。

槽位公式（`ops/triton/compute_slot_mapping.py#L53-L54, L81`，非 CP 分支）：

```
block_indices = pos // block_size
slot_offsets  = pos %  block_size
block_numbers = block_table[req_idx, block_indices]
slot          = block_numbers * block_size + slot_offsets
```

举一个 `block_size = 128` 的例子：请求 3 的表行是 `[7, 3, 12, ...]`，某 token 的 `positions` 是 130，则 `block_indices = 1`、`slot_offsets = 2`，查表得物理 block 3，最终 `slot = 3 * 128 + 2 = 386`。写入时 `reshape_and_cache` 把这个 token 的 K/V 放进 KV cache 展平后的第 386 个位置（`attention_v1.py#L1646-L1656`）。

用 Qwen3-0.6B 的维度（28 层，n_kv=8，d_h=128）推算一个物理 block 的体积：单层 K 是 `128 × 8 × 128` 个 bf16 元素 = 256 KiB，K+V 512 KiB，28 层合计 14 MiB。也就是说 block table 里每一个 int32，背后对应 14 MiB 显存——这是「表极小、寻址极便宜」的直观来源。

`num_blocks_per_row` 是一个纯 CPU 的 `np.int32` 数组（长度 `max_num_reqs`），记每行当前已填了多少列，不上设备。

## 在哪一步出现

对应课程第 11 章。表由 `InputBatch` 持有，每个 KV cache group 一张，统一包在 `MultiGroupBlockTable` 里（`vllm_ascend/worker/npu_input_batch.py#L131-L144`）。一次 forward 的路径是：

1. **追加**——scheduler 给某请求分配了新块时，`BlockTable.append_row(block_ids, row_idx)` 把新块号从 `num_blocks_per_row[row_idx]` 开始写进 numpy 视图，并把计数往前推（`block_table.py#L100-L119`）。`block_ids` 为空直接返回，所以 decode 步里没跨过 block 边界就什么都不做。`add_row` 是先清零计数再 append，用于新请求上批。行的搬迁用 `move_row` / `swap_row`，只动 CPU 侧。
2. **提交**——`_prepare_inputs` 的第一件事是 `commit_block_table(num_reqs)`，把前 `num_reqs` 行整体 H2D 拷贝；放在最前面是为了和后面的 CPU 工作重叠（`model_runner_v1.py#L1143-L1145`）。实现就是 `self.block_table.copy_to_gpu(num_reqs)`（`block_table.py#L278-L279`）。
3. **算槽位**——同一函数后段调用 `compute_slot_mapping(num_reqs, query_start_loc, positions)`（`model_runner_v1.py#L1468-L1472`）。非 DCP 路径直接起 Triton kernel `_compute_slot_mapping_kernel`，grid 是 `num_reqs + 1`：前 `num_reqs` 个 program 每个负责一个请求的 `[query_start_loc[i], query_start_loc[i+1])` 区间，最后一个 program 专门把 `[num_tokens, max_num_tokens)` 填成 `PAD_SLOT_ID`，让 graph 捕获时形状固定（`compute_slot_mapping.py#L30-L41`）。kernel 内部按 1024 个 token 一 tile，先取 tile 内最小 block index 作基址，只加载一个窗口的表行再 `tl.gather`，避免逐 token 随机访存。
4. **消费**——metadata 构造时取 `get_device_tensor()[:num_reqs_padded]` 和 `slot_mapping.gpu[:num_tokens_padded]`，padding 区分别填 0 和 -1（`model_runner_v1.py#L3152-L3158`）。之后 block table 交给 attention 算子读历史 KV，slot_mapping 交给 `reshape_and_cache` 写本步 KV。

DCP（decode context parallel）开启时走 `_compute_dcp_slot_mapping`，按 `cp_kv_cache_interleave_size` 判断某 token 是否归本 rank，不归本 rank 的槽位置 -1（`block_table.py#L248-L272`）。

## 常见误解

- **表里存的不是显存地址**，是物理 block 的整数编号；乘以 `block_size` 再加块内偏移才得到槽位号，真正的指针运算在算子内部完成。
- **列不是「第几个 token」，是「该请求的第几个逻辑 block」**；表宽只是上限，一行里超出 `num_blocks_per_row` 的部分是残留旧值或 0，靠 `seq_lens` 截断，读到它们不代表数据有效。
- **`commit_block_table` 不是「提交新增的块」**，它是把前 `num_reqs` 行整表 H2D 拷一遍；`append_row` 只改 numpy 侧，不 commit 设备上就还是上一步的表。
- **decode 每步不一定新增 block**，但每步都要 commit 并重算 slot_mapping——因为 `positions` 变了，槽位就变了。
