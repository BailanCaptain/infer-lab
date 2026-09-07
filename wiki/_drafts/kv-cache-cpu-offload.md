---
id: kv-cache-cpu-offload
title: KV Cache CPU Offload
type: feature
summary: 把 NPU 上被淘汰的 KV block 异步搬到 CPU 内存做二级前缀缓存，命中时再用专用 NPU stream 搬回来，省掉重算。
aliases: [KV Cache CPU 卸载, NPUOffloadingSpec, OffloadingConnector]
chapters: ["11"]
sources:
  - vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L64-L81
  - vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L104-L110
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/__init__.py#L63-L73
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/offloading_connector.py#L86-L97
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/offloading_connector.py#L159-L189
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L22-L55
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L74-L93
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L45-L53
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L116-L131
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L276-L313
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L315-L328
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L187-L222
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L224-L247
  - vllm-ascend@28bf3a2e:csrc/torch_binding.cpp#L136-L175
  - vllm-ascend@28bf3a2e:csrc/torch_binding.cpp#L217-L256
  - vllm-ascend@28bf3a2e:vllm_ascend/utils.py#L1175-L1179
evidence: "C"
related: [paged-attention, block-table, prefix-caching, kv-pool, recompute-cpu-offload, kv-cache-layerwise-offload, kv-cache-memory-profiling]
contradicts: []
updated: "2026-09-06"
---

## 是什么

NPU 上给 KV cache 的显存是固定的一块（见 [KV Cache 显存 profiling](kv-cache-memory-profiling.md)），装不下的前缀块只能被淘汰，下次同样的前缀来了就得重算。KV Cache CPU Offload 在 NPU 显存和「丢弃」之间插了一层 CPU 内存：块被淘汰时异步拷到主机内存，之后如果新请求的前缀在 NPU 上没命中、却还留在 CPU 池里，就异步搬回 NPU，用一次 H2D 拷贝换掉一次 prefill 重算（[docs#L75-L81](../raw/kv-cache-cpu-offload.md)）。

它是 vLLM 上游 `OffloadingConnector` 框架的 Ascend 实现。配置里写 `kv_connector: "OffloadingConnector"`，实际拿到的是 vllm-ascend 在 `register_connector()` 里替换过的 `AscendOffloadingConnector`——上游的调度器、CPU 块管理器、LRU、指标全部复用，只换掉 worker 侧的两处：KV cache 的布局规范化（Ascend 把 K/V 存成分离张量，上游假设是一个打包张量）和真正的拷贝实现（`torch.ops._C_ascend.swap_blocks_batch`）。

## 形状与数值

**CPU 池的形状。** worker 为每个 canonical KV 张量分配一块 CPU 张量，形状 `[num_cpu_blocks, npu_page_size_bytes * blocks_per_chunk]`，`dtype=torch.int8`，`pin_memory=is_pin_memory_available()`（`cpu_npu.py#L296-L304`）。NPU 侧要求是二维 int8 视图且 `shape[1] == page_size_bytes`，否则直接 `ValueError`（`cpu_npu.py#L284-L295`）。这些 int8 视图由 `_canonicalize_split_attention_cache()` 用 `as_strided` 从原 NPU storage 上切出来，零拷贝、不额外占显存（`offloading_connector.py#L86-L97`）。

**Qwen3-0.6B 的量（推导，取 bf16、`block_size=128`，Ascend 平台默认 `cache_config.block_size = 128`，见 `utils.py#L1178-L1179`）：**

| 量 | 计算 | 结果 |
| --- | --- | --- |
| 一层的 K（或 V）一个 block | 128 token × n_kv 8 × d_h 128 × 2 B | 256 KiB |
| 一个 NPU 逻辑块（28 层 × K/V） | 56 × 256 KiB | 14 MiB |
| `blocks_per_chunk=8` 时一个 CPU 块 | 8 × 14 MiB | 112 MiB |
| `cpu_bytes_to_use=4 GiB` 能装下 | 4096 MiB ÷ 112 MiB | 约 36 个 CPU 块 ≈ 288 个 NPU 块 ≈ 36 K token |

（最后一行忽略了 `BLOCK_SIZE_ALIGNMENT` 对齐和跨 worker 切分，实际略少。）

**一次传输的描述符规模。** `transfer_async()` 先算 `num_copy_ops = Σ group_size × len(group_data_refs)`，然后在三个 int64、pinned 的主机缓冲里填 src 指针、dst 指针、每段字节数（`cpu_npu.py#L45-L53`、`#L116-L131`）。Qwen3-0.6B 单组 28 层、K/V 分离共 56 个 ref，搬一个 8 块的 chunk 就是 448 条描述符（推导）。

**配置项**（`docs#L64-L73`）：

- `kv_connector`：必须 `"OffloadingConnector"`。
- `kv_role`：`"kv_both"`，存和取都要。
- `cpu_bytes_to_use`：**整机**的 CPU 容量（字节），由上游框架切给各 worker。示例值 `4 * 1024**3`。
- `blocks_per_chunk`：一个 CPU 块打包多少个 NPU 块，必须 > 0。示例值 `8`。
- `spec_name` / `spec_module_path`：必须是 `"NPUOffloadingSpec"` 和 `vllm_ascend.distributed.kv_transfer.kv_pool.kv_offload.native.npu`。
- legacy 的 `num_cpu_blocks` 仍兼容：只有在没写 `cpu_bytes_to_use` 时才生效，按 `num_cpu_blocks × round_up(worker_kv_bytes_per_block × world_size × blocks_per_chunk, alignment)` 折算成字节（`npu.py#L28-L55`）。
- `gpu_memory_utilization` 调低 → NPU 上留给 KV cache 的显存少 → offload 更活跃（`docs#L108`）。

## 在哪一步出现

第 11 章。请求路径上它挂在 prefix cache 查找与块淘汰两处，落到源码是四段：

1. **注册**：`register_connector()` 把 `"OffloadingConnector"` 从 factory 里 pop 掉再指向 `AscendOffloadingConnector`（`vllm_ascend/distributed/kv_transfer/__init__.py#L63-L73`）。
2. **建 worker**：`NPUOffloadingSpec.get_worker()` 绕开上游 `CPUOffloadingSpec` 里只认 CUDA/XPU 的平台闸门，构造 `NPUOffloadingWorker`（`npu.py#L74-L93`）；worker 在 `__init__` 里一次性把 CPU 池 `torch.zeros` 出来（`cpu_npu.py#L296-L304`）。
3. **注册 KV cache**：`AscendOffloadingConnectorWorker.register_kv_caches()` 把 Ascend 的分离 K/V（以及 Mamba 状态）折成 canonical 视图再交给 worker（`offloading_connector.py#L159-L189`、`#L86-L97`）。
4. **传输**：每个方向一个 `SingleDirectionNPUOffloadingHandler`，D2H 用 `_store_handler`、H2D 用 `_load_handler`（`cpu_npu.py#L315-L328`）。

**拷贝路径与代价**（`cpu_npu.py#L187-L222`）：

- 每次传输从池里取一条 `torch.npu.Stream` 和两个 `enable_timing=True` 的 Event，不占模型主流。
- D2H 前先 `stream.wait_stream(torch.npu.current_stream())`——KV 是在模型流上写的，不等它写完就读会读到半成品。H2D 没有这个等待。
- 同方向的传输之间 `stream.wait_event(self._transfers[-1].end_event)`，串成一条有序 DMA 队列：同方向不会并发，队列越长排队越久。
- 实际拷贝是 `torch.ops._C_ascend.swap_blocks_batch(src, dst, sizes, direction)`，`direction` 0=H2D、1=D2H。三个参数都是 CPU 上的 int64 数组（指针、指针、字节数），下发到当前 NPU stream（`torch_binding.cpp#L136-L175`）。
- 底层两条路：CANN 8.5+ 走 `aclrtMemcpyBatchAsync`，一次 API 调用提交全部 n 段；否则退化成逐段 `aclrtMemcpyAsync` 循环（`torch_binding.cpp#L217-L256`）。所以描述符条数越多、单段越小，第二条路的下发开销越明显——这正是 `blocks_per_chunk` 存在的意义：把多个 NPU 块并成一个更大的 CPU 页，摊薄每段的固定开销。
- 代价可观测：`get_finished()` 用 start/end event 的 `elapsed_time` 算出每个 job 的 `transfer_time`，连同 `transfer_size = Σ group_size × page_size_bytes` 一起回报给上游（`cpu_npu.py#L226-L236`）。stream、event、描述符缓冲全部回收进池子复用。

## 常见误解

- **不是「显存不够就把当前请求换出去接着算」。** CPU 池只是 [prefix caching](prefix-caching.md) 的第二级；attention 永远只读 NPU 上的块，回搬必须在这些块被用到之前完成。前缀在 CPU 里没命中，照样重算。
- **`blocks_per_chunk` 不是 `block_size`。** 它只决定多少个 NPU 页打包成一个 CPU 页（影响 CPU 侧的分配粒度、LRU 粒度和 DMA 段大小），NPU 侧的 [block table](block-table.md) 和 block_size 一点不变。
- **`cpu_bytes_to_use` 是整机预算，不是每卡预算。** 上游框架会把它切给各 worker（`docs#L68`）；照着单卡估会超配，主机 OOM。
