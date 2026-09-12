# Sparse KV Offload 源码片段

## vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L203-L241

```markdown
## 3. Sparse KV Cache Offload on Decode

Requirements:

- use disaggregated Prefill/Decode deployment;
- enable the feature only on Decode; and
- use Model Runner V1.

Add the following options to the Decode launch command:

```bash
--additional-config '{
    "sparse_kv_offload_config": {
        "enabled": true,
        "topk_buffer_size": 4096,
        "dram_size_per_dp_GB": 128
    }
}' \
--kv-transfer-config '{
    "kv_connector": "SfaRemoteD2HConnector",
    "kv_role": "kv_consumer",
    "kv_port": 20050,
    "kv_connector_extra_config": {
        "transfer_backend": "memfabric",
        "use_layerwise": true
    }
}'
```

On Decode, reserve
`decode_data_parallel_size * decode_tensor_parallel_size` consecutive ports
starting from `kv_port`.

| Parameter | Description |
| :--- | :--- |
| `topk_buffer_size` | Device hot-buffer size. It must be at least `index_topk` and divisible by `block_size`. Twice `index_topk` is a practical starting point. |
| `dram_size_per_dp_GB` | Host memory reserved per DP rank. It must hold the full KV cache. TP ranks share this pool. |
| `keep_device_kv_cache` | Debug-only option that retains the full device KV cache. Keep it `false` in production. |
```

官方使用指南给出 D 节点的完整启动配置与三个参数的含义，正文的「怎么配」「一句话」两节据此写。

## vllm-ascend@28bf3a2e:docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L148-L186

```markdown
## 4. Sparse Decode Offload

### Memory layout

Sparse Decode Offload keeps the full main KV cache in a pinned Decode host
pool. Decode NPU memory contains:

- the rank-local indexer cache used to select important tokens; and
- per-layer K/V hot buffers containing recently selected main-KV entries for
  active Decode rows.

Each Decode DP rank owns a separate main host pool. Within one DP rank, its TP
ranks share that pool, while every TP rank owns the indexer data required by its
local attention computation. Control-plane ports are assigned as
`kv_port + dp_rank * d_tp_size + tp_rank`, keeping DP and TP endpoints disjoint.

### Decode step

For each Decode step:

1. Decode generates the new-token K/V without writing it to a full NPU paged
   main cache;
2. the new K/V rows are copied to their logical slots in the shared host pool;
3. the indexer selects logical top-k token positions;
4. the per-layer LRU residency table identifies hits, assigns physical hot
   buffer slots to misses, and selects eviction slots when necessary;
5. only miss rows are copied from host memory to the NPU;
6. logical top-k positions are remapped to physical hot-buffer slots; and
7. sparse attention consumes the resident K/V while residency metadata is
   retained for the next step.

With tensor parallelism, Decode-produced K/V is replicated. TP rank 0 allocates
the shared host pool and writes the new-token rows. All TP ranks access that
allocation through the broadcast global virtual addresses provided by the
MemFabric offload path.

The full history remains available in host memory, but transfer volume is
proportional to top-k misses rather than total sequence length. This makes
offload practical for the low-compute Decode stage.
```

设计文档的 decode 七步流程，是正文「怎么工作」一节和 mermaid 图的骨架来源。

## vllm-ascend@28bf3a2e:docs/source/locale/zh_CN/LC_MESSAGES/user_guide/feature_guide/sparse_kv_cache_offload.po#L166-L170

```po
msgid ""
"- `enabled` (bool, default: `False`): Whether to enable sparse KV Cache offload.\n"
"- `topk_buffer_size` (int, default: `4096`): Size of the device hot KV buffer, should be greater than the model's `index_topk`. Increase this size will increase topk KV hit rate thus reduce tpot, but will bring higher device memory usage. Normally we set it to 2 * `index_topk` to achieve a balance between topk KV hit rate and device memory usage.\n"
"- `dram_size_per_dp_GB` (bool, default: `128`): Reserved host memory size in Gigabyte per DP group. An error will be raised if this reserved size is not enough to contain the whole host KV cache buffer. All ranks in one TP group will share one host KV cache buffer, so the total host memory usage will be `dram_size_per_dp_GB` * `data_parallel_size`.\n"
"- `keep_device_kv_cache` (bool, optional, default: `False`): Whether to allocate the device KV Cache buffer. If enabled, we will still allocate device KV Cache, thus we can't save KV cache device memory usage, and can not improve sequence length or batch_size. Only reserved for PD-colocate debugging, you **SHOULD NOT** enable it in actual production environment."
```

`msgid` 是上游文档的英文原文。当前 `.md` 只说「两倍是可行起点」，这里明确写出「更大的缓冲区提高命中率从而降低 TPOT」与「主机总占用 = dram_size_per_dp_GB × data_parallel_size」，是吞吐影响与主机内存换算的直接依据。

## vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L1227-L1246

```python
@config
class SparseKVOffloadConfig:
    """
    Configuration for the Sparse KV cache offloading.
    """

    enabled: bool = False
    topk_buffer_size: int = 4096
    dram_size_per_dp_GB: int = 128
    keep_device_kv_cache: bool = False
    topk: int = dataclasses.field(default=0, init=False)

    @model_validator(mode="after")
    def _validate_values(self):
        if self.topk_buffer_size <= 0:
            raise ValueError("sparse_kv_offload_config.topk_buffer_size must be positive")
        if self.dram_size_per_dp_GB <= 0:
            raise ValueError("sparse_kv_offload_config.dram_size_per_dp_GB must be positive")
        return self
```

四个配置项的默认值，以及 `topk` 是推导字段（`init=False`，由模型配置填入）——事实表的默认值行据此。

## vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L1257-L1292

```python
    def _validate_preconditions(self, vllm_config: VllmConfig) -> None:
        if not self.enabled:
            return

        if hasattr(vllm_config.model_config.hf_text_config, "compress_ratios"):
            raise ValueError("Sparse KV offload don't support compress now.")
        if not hasattr(vllm_config.model_config.hf_text_config, "index_topk"):
            raise ValueError("Sparse KV offload only support sparse attention model.")
        parallel_config = vllm_config.parallel_config
        if parallel_config.prefill_context_parallel_size * parallel_config.decode_context_parallel_size > 1:
            raise ValueError("Sparse KV offload don't support context parallel now.")
        if parallel_config.pipeline_parallel_size > 1:
            raise ValueError("Sparse KV offload don't support pipeline parallel now.")
        if self.keep_device_kv_cache:
            logger.warning_once(
                "Init sparse KV offload with keep_device_kv_cache enabled, "
                "in this case we will still allocate device kv cache "
                "and can not improve sequence length or batch_size. "
                "You should only use it for debugging in PD colocate scenario."
            )
        else:
            if vllm_config.kv_transfer_config is None or not vllm_config.kv_transfer_config.is_kv_consumer:
                raise AssertionError(
                    "Sparse KV offload is only supported in PD disaggregate scenario "
                    "and can only be used in D node. For debugging in PD colocate scenario, "
                    "you can enable keep_device_kv_cache."
                )
        if vllm_config.use_v2_model_runner:
            raise ValueError("Sparse KV offload doesn't support model_runner_v2 now.")

        self.topk = vllm_config.model_config.hf_text_config.index_topk
        if self.topk_buffer_size < self.topk:
            raise ValueError(
                "sparse_kv_offload_config.topk_buffer_size must be >= topk, "
                f"got topk_buffer_size={self.topk_buffer_size}, topk={self.topk}"
            )
```

硬性前提全在这一段：必须是带 `index_topk` 的稀疏注意力模型、必须是 PD 分离的 D 节点、CP/PP/model runner v2 一律报错，`topk` 直接取自模型配置的 `index_topk`，且 `topk_buffer_size >= topk` 是启动期校验。

## vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L689-L695

```python
    def _validate_sparse_c8_kv_offload_compatibility(self) -> None:
        if self.sparse_kv_offload_config.enabled and self.enable_sparse_sfa_c8:
            raise NotImplementedError(
                "Sparse KV offload does not support the sparse SFA C8 main "
                "cache. Disable enable_sparse_sfa_c8; enable_sparse_li_c8 is "
                "supported because the indexer cache remains device-resident."
            )
```

与主缓存量化互斥、但 indexer 的 LI C8 不受影响——`conflicts-with kv-cache-quantization` 这条边的依据。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/sfa_v1.py#L111-L142

```python
    def get_builder_cls():
        if get_ascend_config().sparse_kv_offload_config.enabled:
            from vllm_ascend.attention.sfa_kv_offload import AscendSFAKVOffloadMetadataBuilder

            return AscendSFAKVOffloadMetadataBuilder
        from vllm_ascend.attention.context_parallel.sfa_cp import resolve_sfa_metadata_builder

        return resolve_sfa_metadata_builder()

    @staticmethod
    def get_kv_cache_shape(
        num_blocks: int,
        block_size: int,
        num_kv_heads: int,
        head_size: int,
        cache_type: str = "",
    ) -> tuple[int, ...]:
        return (num_blocks, block_size, num_kv_heads, head_size)

    @staticmethod
    def get_impl_cls() -> type["AscendSFAImpl"]:
        if get_ascend_config().sparse_kv_offload_config.enabled:
            from vllm_ascend.attention.sfa_kv_offload import AscendSFAKVOffloadImpl

            return AscendSFAKVOffloadImpl
        from vllm_ascend.attention.context_parallel.sfa_cp import resolve_sfa_impl

        return resolve_sfa_impl(get_current_vllm_config())

    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]
```

开关一开，`AscendSFABackend` 就把 impl/builder 换成卸载版本；同一个类里 `get_supported_kernel_block_sizes` 写死 `[128]`，所以 `topk_buffer_size % block_size == 0` 这条约束等价于「必须是 128 的倍数」。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/sfa_kv_offload.py#L166-L180

```python
        if enable_dsa_cp():
            raise NotImplementedError("Sparse KV offload currently requires TP without context parallelism")
        if self.enable_sparse_sfa_c8:
            raise NotImplementedError(
                "Sparse KV offload does not support the sparse SFA C8 main "
                "cache; sparse LI C8 is supported for the device-resident "
                "indexer cache."
            )
        self._current_layer_name: str | None = None

    def _resolve_preprocess_type(self, act_dtype: torch.dtype) -> PreprocessType:
        logger.warning_once(
            "Sparse KV offload requires the native SFA preprocessing path; sfa_prolog_v3/mlapo is disabled."
        )
        return PreprocessType.NATIVE
```

impl 侧再挡一次 CP 与主缓存 C8；并且强制走 `PreprocessType.NATIVE`，即关掉 sfa_prolog_v3/mlapo 融合预处理——这是开启后确定要付的吞吐代价。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/sfa_kv_offload.py#L297-L343

```python
    def exec_kv(
        self,
        kv_no_split: torch.Tensor,
        cos: torch.Tensor,
        sin: torch.Tensor,
        kv_cache: tuple,
        slots: torch.Tensor,
        attn_metadata: M,
    ):
        if self._is_decode_only(attn_metadata):
            k_nope, k_pe = self._compute_kv_only(kv_no_split, cos, sin)
            manager = get_sparse_kv_offload_manager()
            layer_name = self._offload_layer_name()
            k_cache_cpu, v_cache_cpu = self._cpu_cache_pair(manager, layer_name)
            manager.offload_new_kv(
                slot_mapping=slots,
                k_cache_cpu=k_cache_cpu,
                v_cache_cpu=v_cache_cpu,
                k_cache_npu=None,
                v_cache_npu=None,
                k=k_nope,
                v=k_pe,
                has_prefill=False,
                capturing=self._in_graph_runtime(),
            )
            return k_pe, k_nope

        # Prefill / mixed batch (colocate debug only): stage in the NPU paged
        # main cache as usual, then commit the written rows D2H into the
        # shared CPU pool.
        _check_device_kv_cache_exist()
        result = super().exec_kv(kv_no_split, cos, sin, kv_cache, slots, attn_metadata)
        manager = get_sparse_kv_offload_manager()
        layer_name = self._offload_layer_name()
        k_cache_cpu, v_cache_cpu = self._cpu_cache_pair(manager, layer_name)
        manager.offload_new_kv(
            slot_mapping=slots,
            k_cache_cpu=k_cache_cpu,
            v_cache_cpu=v_cache_cpu,
            k_cache_npu=kv_cache[0],
            v_cache_npu=kv_cache[1],
            k=None,
            v=None,
            has_prefill=True,
            capturing=self._in_graph_runtime(),
        )
        return result
```

decode 路径 `k_cache_npu=None`：新 token 的 K/V 算完直接 D2H 写主机池，NPU 上根本没有主 paged 缓存可写。prefill 分支是反过来的（`k=None, v=None`，从 NPU paged 缓存把写过的行 D2H），且只在 `keep_device_kv_cache=True` 的调试场景可达。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/sfa_kv_offload.py#L396-L448

```python
        decode_topk = topk_indices[:num_decode_tokens]
        seq_len_thresholds = decode_seq_lens.view(
            decode_seq_lens.shape[0],
            *([1] * (decode_topk.ndim - 1)),
        )
        valid_topk = build_valid_topk_mask(decode_topk, seq_len_thresholds)
        decode_topk = torch.where(
            valid_topk,
            decode_topk,
            torch.full_like(decode_topk, -1),
        )
        if decode_topk.ndim == 3 and decode_topk.shape[1] == 1:
            decode_topk = decode_topk.squeeze(1)
        if decode_topk.ndim != 2:
            raise ValueError("Sparse KV offload top-k must have [tokens, topk] shape")

        (
            resident_k,
            resident_v,
            resident_slot_indices,
            resident_block_table,
            resident_query_lens,
            resident_seq_lens,
        ) = self._resident_views(manager, layer_name, num_decode_tokens)
        decode_req_ids = torch.index_select(
            attn_metadata.req_ids_tensor[:num_decodes],
            0,
            row_to_req,
        )
        manager.onload_topk_kv(
            layer_name,
            num_decode_tokens,
            num_decodes,
            attn_metadata.block_table[:num_decodes],
            decode_topk,
            resident_slot_indices,
            decode_req_ids,
            decode_stable_prefix_lens,
            token_to_req,
            capturing=self._in_graph_runtime(),
            skip_topk=self.skip_topk,
        )
        decode_attn_output = DeviceOperator.execute_sparse_flash_attention_process(
            self,
            ql_nope[:num_decode_tokens],
            q_pe[:num_decode_tokens],
            (resident_k, resident_v),
            resident_slot_indices.unsqueeze(1),
            attn_metadata,
            resident_query_lens,
            resident_seq_lens,
            block_table=resident_block_table,
        )
```

decode 主干：top-k 先被 `build_valid_topk_mask` 按 `seq_len` 过滤（越界与 padding 置 -1），再交给 `onload_topk_kv` 换入，最后注意力算子读的是 `resident_k/resident_v`（热缓冲区视图）而不是 `kv_cache`。

## vllm-ascend@28bf3a2e:vllm_ascend/device/device_op.py#L1514-L1527

```python
        else:
            topk_indices, _ = torch_npu.npu_lightning_indexer(
                query=q_li,
                key=kv_cache[indexer_cache_idx],
                weights=weights,
                actual_seq_lengths_query=actual_seq_lengths_query,
                actual_seq_lengths_key=actual_seq_lengths_key,
                block_table=attn_metadata.block_table,
                layout_query="TND",
                layout_key="PA_BSND",
                sparse_count=2048,
                sparse_mode=3,
            )
        return topk_indices
```

top-k 的选择依据：由 `torch_npu.npu_lightning_indexer` 用 indexer 的 K 缓存算出，与是否卸载无关——卸载只决定被选中的 KV 从哪里取。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L53-L84

```python
def allocate_kv_offload_topk_buffer_pair(
    vllm_config: VllmConfig,
    sparse_kv_offload_config: SparseKVOffloadConfig,
) -> tuple[torch.Tensor, torch.Tensor]:
    decode_width = 1
    if vllm_config.speculative_config is not None:
        decode_width += vllm_config.speculative_config.num_speculative_tokens

    topk_buffer_size = sparse_kv_offload_config.topk_buffer_size
    num_kv_heads = 1  # sparse kv offload only support sfa(mla) now.
    k_dim = vllm_config.model_config.hf_text_config.kv_lora_rank
    v_dim = vllm_config.model_config.hf_text_config.qk_rope_head_dim
    max_num_topk_rows = min(
        vllm_config.scheduler_config.max_num_batched_tokens,
        vllm_config.scheduler_config.max_num_seqs * decode_width,
    )
    topk_buffer_k_size_bytes = max_num_topk_rows * topk_buffer_size * num_kv_heads * k_dim * torch.bfloat16.itemsize
    topk_buffer_v_size_bytes = max_num_topk_rows * topk_buffer_size * num_kv_heads * v_dim * torch.bfloat16.itemsize
    # NOTE make sure to allocate k+v together and split them after allocate.
    # Refer to the comment in empty_aligned_int8_cpu_tensors for reason.
    topk_buffer_raw = torch.empty([topk_buffer_k_size_bytes + topk_buffer_v_size_bytes], dtype=torch.int8, device="npu")
    topk_buffer_k = (
        topk_buffer_raw[:topk_buffer_k_size_bytes]
        .view(torch.bfloat16)
        .view([max_num_topk_rows, topk_buffer_size, num_kv_heads, k_dim])
    )
    topk_buffer_v = (
        topk_buffer_raw[topk_buffer_k_size_bytes : topk_buffer_k_size_bytes + topk_buffer_v_size_bytes]
        .view(torch.bfloat16)
        .view([max_num_topk_rows, topk_buffer_size, num_kv_heads, v_dim])
    )
    return (topk_buffer_k, topk_buffer_v)
```

热缓冲区的精确形状与字节数：`[max_num_topk_rows, topk_buffer_size, 1, kv_lora_rank]` 与 `[..., qk_rope_head_dim]`，BF16。「拿真实数字走一遍」里的常驻显存全部由这一段算出。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L181-L230

```python
def plan_sparse_kv_offload_memory(
    kv_cache_spec: dict[str, KVCacheSpec],
    vllm_config: VllmConfig,
    available_device_memory_bytes: int,
    dram_limit_bytes: int,
    keep_device_kv_cache: bool,
) -> SparseKVOffloadMemoryBudget:
    """Bound sparse KV offload blocks by NPU, DRAM, and active demand."""
    host_specs, device_specs = _split_host_device_kv_specs(kv_cache_spec)
    host_page_size_bytes = sum(spec.page_size_bytes for spec in host_specs)
    device_page_size_bytes = sum(spec.page_size_bytes for spec in device_specs)
    total_page_size_bytes = host_page_size_bytes + device_page_size_bytes

    host_alignment_reserve_bytes = len(host_specs) * _CPU_CACHE_MAX_ALIGNMENT_OVERHEAD_PER_LAYER
    usable_dram_bytes = max(dram_limit_bytes - host_alignment_reserve_bytes, 0)
    dram_limit_blocks = usable_dram_bytes // host_page_size_bytes

    npu_page_size_bytes = total_page_size_bytes if keep_device_kv_cache else device_page_size_bytes
    npu_limit_blocks = max(available_device_memory_bytes, 0) // npu_page_size_bytes

    max_blocks_per_request = max(
        cdiv(
            spec.max_memory_usage_bytes(vllm_config),
            spec.page_size_bytes,
        )
        for spec in host_specs + device_specs
    )
    workload_limit_blocks = max_blocks_per_request * vllm_config.scheduler_config.max_num_seqs + _VLLM_NULL_BLOCK_COUNT

    limits = {
        "npu": npu_limit_blocks,
        "dram": dram_limit_blocks,
        "workload": workload_limit_blocks,
    }
    if dram_limit_blocks < npu_limit_blocks:
        logger.warning_once(
            "Sparse KV offload: host DRAM budget allows only %d KV blocks while NPU "
            "memory could hold %d, so batch size / max_model_len capacity is limited "
            "by host memory. Consider increasing sparse_kv_offload_config."
            "dram_size_per_dp_GB (current budget %.2f GiB) to use more of the NPU "
            "capacity.",
            dram_limit_blocks,
            npu_limit_blocks,
            dram_limit_bytes / (1 << 30),
        )
    limiting_factor = min(limits, key=lambda name: limits[name])
    final_num_blocks = limits[limiting_factor]
```

块数由 npu / dram / workload 三个上限取最小；`_CPU_CACHE_MAX_ALIGNMENT_OVERHEAD_PER_LAYER = 3 * 2 MiB`（见同文件 L108-L113）要先从 DRAM 预算里扣掉。worked example 里 15,237 块这个数就是走这个公式算的。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L608-L624

```python
        kv_head_num = self.topk_buffers_k[0].size(-2)
        head_dim_k = self.topk_buffers_k[0].size(-1)
        head_dim_v = self.topk_buffers_v[0].size(-1)
        dtype = self.topk_buffers_k[0].dtype
        assert kv_head_num == 1, "Sparse KV offload only support sfa(mla)"
        if dtype != torch.bfloat16:
            raise ValueError(
                "Sparse KV offload requires a BF16 main SFA cache; sparse LI "
                "C8 is supported only for the device-resident indexer cache."
            )
        self.token_size_bytes_k = kv_head_num * head_dim_k * dtype.itemsize
        self.token_size_bytes_v = kv_head_num * head_dim_v * dtype.itemsize
        if self.topk_buffer_size % self.block_size != 0:
            raise ValueError(
                "Sparse KV offload topk_buffer_size must be divisible by "
                f"block_size, got {self.topk_buffer_size} and {self.block_size}"
            )
```

每 token 每层的搬运粒度（K、V 两条）、BF16 强制、以及 `topk_buffer_size % block_size == 0` 的运行期校验。注意 `token_size_bytes_*` 紧跟 `assert kv_head_num == 1`，只对 MLA/SFA 成立。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload.cpp#L115-L173

```cpp
  int32_t hit_count = 0;
  int32_t evictable_count = 0;
  for (int32_t order = 0; order < capacity; ++order) {
    const int32_t slot = lru_slots_row[order];
    if (UNLIKELY(slot < 0 || slot >= capacity)) {
      continue;
    }
    int32_t token = slot_to_token_row[slot];
    // The speculative suffix may have been overwritten in the CPU KV pool.
    if (LIKELY(is_valid_lru_resident_token(token, max_token)) && UNLIKELY(token >= stable_prefix_len)) {
      slot_to_token_row[slot] = -1;
      token = -1;
    }
    if (LIKELY(is_valid_lru_resident_token(token, max_token)) && token_mark[token] == base) {
      const int32_t pos = token_pos[token];
      current_slots_row[pos] = slot;
      hit_slots[hit_count] = slot;
      ++hit_count;
    } else {
      evictable_slots[evictable_count] = slot;
      ++evictable_count;
    }
  }

  int32_t local_miss_count = 0;
  for (int32_t pos = 0; pos < topk; ++pos) {
    const int32_t token = topk_row[pos];
    if (LIKELY(is_valid_lru_resident_token(token, max_token)) && current_slots_row[pos] < 0) {
      miss_tokens_row[local_miss_count] = token;
      miss_positions[local_miss_count] = pos;
      ++local_miss_count;
    }
  }

  const int32_t assign_count = std::min(local_miss_count, evictable_count);
  for (int32_t miss_idx = 0; miss_idx < assign_count; ++miss_idx) {
    const int32_t slot = evictable_slots[miss_idx];
    const int32_t token = miss_tokens_row[miss_idx];
    const int32_t pos = miss_positions[miss_idx];
    slot_to_token_row[slot] = token;
    current_slots_row[pos] = slot;
    miss_slots_row[miss_idx] = slot;
    assigned_miss_slots[miss_idx] = slot;
    miss_count[row] = miss_idx + 1;
  }

  int32_t write_pos = 0;
  for (int32_t idx = assign_count; idx < evictable_count; ++idx) {
    lru_slots_row[write_pos] = evictable_slots[idx];
    ++write_pos;
  }
  for (int32_t idx = 0; idx < assign_count; ++idx) {
    lru_slots_row[write_pos] = assigned_miss_slots[idx];
    ++write_pos;
  }
  for (int32_t idx = 0; idx < hit_count; ++idx) {
    lru_slots_row[write_pos] = hit_slots[idx];
    ++write_pos;
  }
}
```

LRU 的全部逻辑：`lru_slots_row` 从最久未用排到最近使用，命中的槽位被挪到队尾，未命中优先占用队首的可驱逐槽位；`evictable_count = capacity - hit_count`，这是「miss 一定分得到槽位」这条推导的依据。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L5006-L5014

```python
                    kv_cache_spec[layer_name] = AscendMLAAttentionSpec(
                        block_size=self.block_size,
                        num_kv_heads=1,
                        head_size=head_size,
                        dtype=dtype,
                        cache_dtype_str=self.vllm_config.cache_config.cache_dtype,
                        cache_sparse_sfa_c8=cache_sparse_sfa_c8,
                        store_on_host=self.sparse_kv_offload_enabled,
                    )
```

开关直接落在 KV cache spec 的 `store_on_host` 上——`builds-on kv-cache-spec` 这条边的依据。

## vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/index.md#L5-L37

```markdown
:::{toctree}
:caption: Feature Guide
:maxdepth: 1
graph_mode
cpu_binding
Ai_QoS_introduction_en
quantization
sleep_mode
structured_output
lora
expert_parallelism_load_balancer
netloader
rfork
dynamic_batch
epd_disaggregation
kv_pool
layerwise_kv_pool
kv_cache_cpu_offload
recompute_cpu_offload
external_dp
large_scale_ep
ucm_deployment
Fine_grained_TP
layer_sharding
speculative_decoding
context_parallel
weight_prefetch
sequence_parallelism
batch_invariance
lmcache_ascend_deployment
dynamic_chunk_pipeline_parallel
flash_attention
:::
```

v0.23.0 的特性指南目录里没有 layerwise/sparse 卸载这一页；配合「全仓 grep `sparse_kv_offload` 零命中」，说明该特性在 v0.23.0 完全不存在。

## vllm-ascend@2c59ff10:vllm_ascend/attention/sfa_v1.py#L1553-L1566

```python
        record_attention_compute_start()
        return DeviceOperator.indexer_select_post_process(
            self,
            q_li,
            q_li_scale,
            q_li_shape_ori,
            weights,
            kv_cache,
            attn_metadata,
            actual_seq_lengths_query,
            actual_seq_lengths_key,
            self.enable_sparse_li_c8,
            self.use_torch_npu_lightning_indexer,
        )
```

v0.23.0 有完整的 SFA + lightning indexer 稀疏注意力，只是选出来的 KV 仍然全部读 NPU 上的 paged 主缓存——差的正是「卸载」这一层。

## https://huggingface.co/deepseek-ai/DeepSeek-V3.2-Exp

```json
{
  "index_topk": 2048,
  "kv_lora_rank": 512,
  "qk_rope_head_dim": 64,
  "num_hidden_layers": 61
}
```

模型卡 `config.json` 中与本页计算相关的四个字段（节选）。worked example 的全部维度来自这里。
