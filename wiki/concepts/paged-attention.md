---
id: paged-attention
title: PagedAttention
type: feature
summary: 把 KV Cache 切成固定 128 token 的物理块，attention 靠 block_table 按块寻址读取；昇腾上它是一个可选算子分支，默认走 FIA。
aliases: [分页注意力, PA]
chapters: ["11"]
sources:
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L113-L121
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L123-L149
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L151-L153
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L200-L210
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L249-L253
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1324-L1333
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1561-L1580
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1628-L1657
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1660-L1681
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1695-L1705
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/utils.py#L206-L222
  - vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L378-L383
  - vllm-ascend@28bf3a2e:vllm_ascend/device/device_op.py#L43-L53
  - vllm-ascend@28bf3a2e:vllm_ascend/utils.py#L1167-L1204
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4850-L4863
  - vllm-ascend@28bf3a2e:docs/source/user_guide/configuration/additional_config.md#L61
  - vllm-ascend@28bf3a2e:docs/source/faqs.md#L304-L306
evidence: "C"
related: [block-table, kv-cache-spec, prefix-caching, kv-cache-memory-profiling, kv-pool, kv-cache-cpu-offload, recompute-cpu-offload]
contradicts: []
updated: "2026-09-07"
---

## 是什么

PagedAttention 解决的是「一条序列的 KV Cache 必须占一段连续显存」带来的浪费：按 `max_model_len` 预留会大量留白，按实际长度增长又会把显存打碎。它的做法是把 KV Cache 切成固定大小的物理块（block），一条序列拿到的是一串块号而不是一段连续地址，attention 计算时通过 [block_table](block-table.md) 把逻辑位置翻译成物理块再去读。

在昇腾后端上，「分页」是 KV Cache 的存储组织方式（始终生效），而 `_npu_paged_attention`（下面简称 PA）只是读这份分页缓存的其中一个算子。默认读取算子是 FIA（`npu_fused_infer_attention_score`），它同样接收 `block_table` 和 `block_size`，也是按块寻址（`docs/source/faqs.md#L304-L306`）。

## 形状与数值

`AscendAttentionBackend.get_kv_cache_shape` 向 vLLM 声明每层 KV Cache 的形状（`attention_v1.py#L113-L121`）：

```
(2, num_blocks, block_size, num_kv_heads, head_size)
```

第 0 维的 2 是 K 和 V，实现里通过 `kv_cache[0] / kv_cache[1]` 切出 `self.key_cache / self.value_cache`（`attention_v1.py#L1628-L1657`）。

`get_supported_kernel_block_sizes()` 只返回 `[128]`（`attention_v1.py#L151-L153`），model runner 用它校验实际 `block_size`（`model_runner_v1.py#L4850-L4863`）。配置侧 `refresh_block_size` 把未指定的 `block_size` 设为 128，且开了 prefix caching 或 chunked prefill 时会强制拉回 128（`utils.py#L1167-L1204`）。

代入 Qwen3-0.6B（n_kv=8，d_h=128，28 层，bf16）：

- 单层单块：`2 × 128 × 8 × 128 × 2 B = 512 KiB`
- 28 层合计：一个块（装 128 个 token）占 **14 MiB**，折合每 token **112 KiB**
- `block_table` 形状 `(batch_size, max_num_blocks_per_req)`，列数 `= cdiv(max_model_len, 128)`（`attention_v1.py#L249-L253`）；若 `max_model_len = 32768`，则为 256 列

PA 分支的开关 `pa_shape_list` 默认是空列表（`ascend_config.py#L378-L383`、`additional_config.md#L61`），也就是 **PA 默认不启用**。

## 在哪一步出现

对应课程第 11 章，请求路径上的 attention 计算阶段，每层每步都走一遍。源码顺序是「先写后读」：

1. **写**：`AscendAttentionBackendImpl.reshape_and_cache`（`attention_v1.py#L1628-L1657`）取 `attn_metadata.slot_mapping`，调到 `BaseDeviceAdaptor.reshape_and_cache` → `torch_npu.npu_scatter_pa_kv_cache`（`device/device_op.py#L43-L53`），把本步的 K/V 散写进各自的块内槽位。`slot_mapping` 是展平后的全局槽号（`attention_v1.py#L200-L210` 的注释给了例子）。
2. **选路**：`forward_impl`（`attention_v1.py#L1660-L1681`）判断三个条件全为真才走 PA —— `attn_state == DecodeOnly`、`sliding_window is None`、`using_paged_attention(...)` 为真；否则走 FIA。
3. **PA 读**：`forward_paged_attention`（`attention_v1.py#L1561-L1580`）把 `attn_metadata.block_tables` 作为 `block_table`、`attn_metadata.seq_lens` 作为 `context_lens` 直接传给 `torch_npu._npu_paged_attention`，KV Cache 保持四维原布局传入。
4. **FIA 读**：`_get_fia_params` 的 DecodeOnly 分支（`attention_v1.py#L1324-L1333`）先把 KV Cache view 成 `(num_blocks, block_size, num_kv_heads*head_size)`（Qwen3-0.6B 即 `(num_blocks, 128, 1024)`），再连同 `block_table`、`block_size` 和 `seq_lens_list`（作 `actual_seq_lengths_kv`）交给算子。
5. **块搬运**：`swap_blocks / copy_blocks`（`attention_v1.py#L123-L149`）按块号索引第 1 维，是 [prefix-caching](prefix-caching.md) 与换出换入的粒度。

`using_paged_attention`（`attention/utils.py#L206-L222`）的完整条件：无投机解码配置、设备不是 A5、`cudagraph_mode == FULL_DECODE_ONLY`、且当前 batch 的 `runtime_shape` 命中 `pa_shape_list`；另有一条 `head_size == FIA_TND_LARGE_HEAD_FALLBACK_HEAD_SIZE` 的提前返回，用于 FIA TND 不支持的大 head 维度。

与上游 vLLM 的差异：昇腾把 K 和 V 打包进同一个 `(2, ...)` 张量并按 `(num_blocks, block_size, n_kv, d_h)` 排布，`block_size` 被后端锁死为 128，读取默认交给 FIA 而不是专门的 paged attention kernel——PA 只是命中 `pa_shape_list` 时的性能调优分支（`docs/source/faqs.md#L304-L306` 明确称其为临时调优旋钮）。上游 CUDA 后端的具体块布局与可选 block_size 未在本仓库中核对，此处不做断言。

引用的完整片段见[源码摘录](../raw/paged-attention.md)。

## 常见误解

- **「PagedAttention 是 vLLM-Ascend 的默认注意力算子」**——不是，默认是 FIA；PA 要在 `--additional-config` 里显式配 `pa_shape_list` 且满足全图 decode 等条件才会被选中。
- **「走 FIA 就没分页了」**——分页是存储布局，FIA 同样接 `block_table` 与 `block_size` 按块读，只是把 KV Cache view 成了三维。
- **「block_size 可以按显存自由调」**——该后端只声明支持 128，配了别的值会被 `refresh_block_size` 或 runner 的校验挡回去（deepseek_v4 等模型走各自的分支）。
