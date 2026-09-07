---
id: kv-cache-sparse-offload
title: Sparse KV Offload
type: feature
summary: Decode 节点把整份 KV cache 放在主机 DRAM，每步只把稀疏注意力 indexer 选中的 top-k token 的 KV 拉回 NPU 常驻 buffer 上算一次注意力。
aliases: [稀疏 KV 卸载, Sparse KV Cache Offload, Sparse Decode Offload]
chapters: ["11"]
sources:
  - vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L203-L241
  - vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L260-L268
  - vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L1227-L1245
  - vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L1257-L1292
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/sfa_kv_offload.py#L1-L17
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/sfa_kv_offload.py#L166-L173
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/sfa_kv_offload.py#L306-L322
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/sfa_kv_offload.py#L396-L448
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/sfa_v1.py#L1661-L1688
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/utils.py#L61-L66
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload.cpp#L115-L173
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L53-L84
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L194-L227
  - vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L756-L776
evidence: "C"
related: [kv-cache-layerwise-offload, kv-cache-quantization, kv-cache-spec, kv-cache-memory-profiling]
contradicts: []
updated: "2026-09-07"
---

## 是什么

它要解决的问题是：decode 阶段 KV cache 占满了 NPU 显存，batch 和上下文长度都被卡住，可是稀疏注意力模型每一步其实只读极少数 token。Sparse KV Offload 把整份主 KV cache 搬到主机 DRAM（每个 DP rank 一个共享池，TP rank 共用），NPU 上只留一块固定大小的常驻 top-k buffer 和 indexer 自己的 K cache（[sfa_kv_offload.py#L1-L17](../raw/kv-cache-sparse-offload.md)）。

保留哪些 token 完全由模型自己的稀疏注意力决定，不是这个特性另加的一层筛选。每层每个 decode token 的 `topk_indices` 只有两个来源：本层 lightning indexer 打分后 `indexer_select_post_process` 选出的 top-k，或者当这一层设了 `skip_topk` 时直接复用 index cache 里上一层算好的索引（[sfa_v1.py#L1661-L1688](../raw/kv-cache-sparse-offload.md)）。`topk` 的取值也不是用户填的，而是启动时直接读模型配置里的 `index_topk`；`hf_text_config` 上没有 `index_topk` 的模型会被直接拒绝（`ascend_config.py#L1263`、`#L1287`）。

真正属于这个特性的机制是常驻 buffer 的换入换出。每层、每个 decode 行都各自维护一份 LRU：本步 top-k 里已经在 buffer 中的 token 记为命中、保住槽位，其余槽位可驱逐，只有 miss 的 token 需要从 CPU 池 H2D 搬进来；重排后槽位顺序是「未使用 → 本步新装入 → 命中」（[sparse_kv_offload.cpp#L115-L173](../raw/kv-cache-sparse-offload.md)）。因为相邻 decode step 选中的 token 高度重叠，实际每步搬运量远小于 `topk`。

## 形状与数值

这一节不能用 Qwen3-0.6B 的维度：该特性只对带 `index_topk` 的 MLA/SFA 稀疏注意力模型生效（文档列出 GLM-5.1、GLM-5.2、DeepSeek-V3.2），Qwen3-0.6B 走的是普通 GQA，`ascend_config.py#L1263` 会直接报 "Sparse KV offload only support sparse attention model."。下面写配置默认值与形状表达式。

配置项（`SparseKVOffloadConfig`，`ascend_config.py#L1233-L1237`）：

| 字段 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `enabled` | `False` | 只在 PD 分离的 D 节点开；否则必须显式开 `keep_device_kv_cache` 走 colocate 调试路径（`ascend_config.py#L1277-L1283`） |
| `topk_buffer_size` | `4096` | 常驻 buffer 每行槽位数，必须 ≥ `topk` 且能整除 `block_size`；文档建议取 `2 × index_topk` |
| `dram_size_per_dp_GB` | `128` | 每 DP rank 的主机 KV 池上限，必须放得下整份 KV cache |
| `keep_device_kv_cache` | `False` | 仅调试；开了就还会分配整份设备 KV cache，拿不到任何容量收益 |
| `topk` | `0`（`init=False`） | 启动时被覆写为 `hf_text_config.index_topk` |

常驻 buffer 的形状是 `[max_num_topk_rows, topk_buffer_size, 1, k_dim]`（K）与 `[..., v_dim]`（V），bfloat16，K/V 一次性连续分配再切分。其中 `num_kv_heads = 1`（只支持 SFA/MLA），`k_dim = kv_lora_rank`，`v_dim = qk_rope_head_dim`，`max_num_topk_rows = min(max_num_batched_tokens, max_num_seqs × decode_width)`，`decode_width = 1 + num_speculative_tokens`（[sparse_kv_offload_manager.py#L53-L84](../raw/kv-cache-sparse-offload.md)）。每层的显存开销即 `max_num_topk_rows × topk_buffer_size × (kv_lora_rank + qk_rope_head_dim) × 2 B`，与序列长度无关——这正是它能把长度/并发从显存里解耦出来的原因。

LRU 状态按层独立：`slot_to_token` 形状 `[max_num_topk_rows, topk_buffer_size]`、初值 -1，`lru_slots` 是每行 `arange(topk_buffer_size)`，都在 pinned CPU 内存上，每层一份（[manager#L756-L776](../raw/kv-cache-sparse-offload.md)）。

块数上限取三者最小：`npu`、`dram`、`workload`。开启卸载后 NPU 侧每块只按 device spec 计费（不含 host spec），主机侧按 `dram_size_per_dp_GB` 算；若 DRAM 比 NPU 更紧会打 warning 提示调大（[manager#L194-L227](../raw/kv-cache-sparse-offload.md)）。

## 在哪一步出现

对应课程第 11 章。请求路径上它只出现在 **PD 分离部署的 D 节点 decode 阶段**：prompt 的 KV 由 P 节点经 `SfaRemoteD2HConnector` 送来，D 节点不跑真正的 prefill。

- 入口选择：`sparse_kv_offload_config.enabled` 时 `AscendSFABackend.get_impl_cls()/get_builder_cls()` 换成 `AscendSFAKVOffloadImpl` / `AscendSFAKVOffloadMetadataBuilder`（`vllm_ascend/attention/sfa_kv_offload.py#L1-L17`、`#L63-L136`）。
- 元数据：`_populate_offload_metadata` 拆 decode/prefill，并对 PD consumer 打开 `treat_short_extends_as_decodes`，让 vLLM 误判为 prefill 的「N-1 边界步」也走 decode 卸载路径（`sfa_kv_offload.py#L90-L110`）。
- 当前 token 的 KV：`AscendSFAKVOffloadImpl.exec_kv` 在纯 decode 时调 `_compute_kv_only` 只算不写 paged cache，然后 `manager.offload_new_kv(...)` 直接 D2H 落进 CPU 池（`sfa_kv_offload.py#L297-L322`）。
- 取回与计算：`_execute_sparse_flash_attention_process` 先用 `build_valid_topk_mask` 把非法索引置 -1，再 `manager.onload_topk_kv(...)` 把 miss 行 H2D 装入常驻 buffer，最后 `DeviceOperator.execute_sparse_flash_attention_process` 在 `(resident_k, resident_v)` 上跑一次注意力（`sfa_kv_offload.py#L345-L450`）。
- 主机侧 LRU：`onload_topk_kv` 把索引拷到 pinned 内存后调用 C++ 扩展 `lru_resident_compact`；graph 模式下通过 `torch_npu.npu._launch_host_func` 挂到计算流上异步执行（`sparse_kv_offload_manager.py#L1017-L1084`）。

与 [Layerwise KV Offload](kv-cache-layerwise-offload.md) 是同一套部署的两半：layerwise 用在 P 节点 prefill，sparse 用在 D 节点 decode，文档明确要求 P 节点不要设 `sparse_kv_offload_config`。

## 常见误解

- **不是「丢弃冷 token 换速度」的有损近似**：整份 KV 始终完好地留在主机池里，稀疏性来自模型自带的 DSA/SFA indexer，卸载只改变 KV 存放位置与搬运时机。源码里没有任何按重要性丢弃 KV 的实现，因此不能把精度下降归给这个特性。
- **`topk_buffer_size` 不是 top-k 的个数**：top-k 个数固定等于模型的 `index_topk`；`topk_buffer_size` 是常驻缓存的槽位数，取大只是提高跨 step 的命中率、减少 H2D，代价是显存。
- **每步实际参与注意力的 token 可能少于 `topk`**：`build_valid_topk_mask` 会把负索引和 ≥ 当前 seq_len 的尾块位置刷成 -1；投机解码时超出 stable prefix 的槽位也会被主动作废重取。
- **收益不是「decode 更快」而是「装得下更多」**：卸载把 NPU 每块的计费降为 device spec，从而放大 batch 与上下文长度；每步新增的 miss H2D 搬运是纯开销，源码与文档都没有给出吞吐加速的量化结论。
- **和 KV 量化不是自由组合**：主 cache 的 sparse SFA C8 在卸载路径下直接 `NotImplementedError`，只有 device 常驻的 indexer cache 支持 sparse LI C8（`sfa_kv_offload.py#L166-L173`）；`compress_ratios` 类压缩同样被拒。参见 [KV Cache 量化](kv-cache-quantization.md)。
- **并行方式受限**：只支持 DP + TP，CP 与 PP 在配置校验期就报错，且必须用 Model Runner V1。
