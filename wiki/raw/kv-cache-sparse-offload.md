# Sparse KV Offload 源码片段

来源仓库：vllm-ascend@28bf3a2e

## docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L203-L241

~~~markdown
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
~~~

官方启动方式与三个配置项的语义来源；正文「形状与数值」「在哪一步出现」引用它说明只在 D 节点开启、以及 `topk_buffer_size` 与 `index_topk` / `block_size` 的约束。

## docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L260-L268

```markdown
## 5. Limitations

- Shared-buffer Layerwise Prefill Offload requires Memcache and eager mode.
- Context parallelism has not been validated with Layerwise Prefill Offload.
- Sparse Decode Offload supports DP and TP; CP and PP are not supported.
- MemFabric is the only supported `SfaRemoteD2HConnector` transfer backend.
- Layerwise buffer reuse cannot currently be combined with
  `MooncakeLayerwiseConnector` because per-buffer transfer completion gating is
  not yet implemented. Support is planned in a follow-up update.
```

并行方式限制的官方陈述，正文「常见误解」与限制段引用。

## vllm_ascend/ascend_config.py#L1227-L1245

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

四个配置项的默认值来源（`topk` 不由用户填，`init=False`），正文「形状与数值」引用。

## vllm_ascend/ascend_config.py#L1257-L1292

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

最关键的一段：`topk` 直接取模型配置里的 `index_topk`，且没有 `index_topk` 的模型一律拒绝开启。正文「是什么」「常见误解」引用。

## vllm_ascend/attention/sfa_kv_offload.py#L1-L17

```python
"""Standalone SFA backend for Sparse KV offload.

All Sparse KV offload related attention logic lives in this module and is selected by
``AscendSFABackend.get_impl_cls()`` / ``get_builder_cls()`` when
``sparse_kv_offload_config.enabled`` is set, keeping ``sfa_v1.py`` clean.

Data plane (see zsc-sfa-kv-offload-merge-plan.md):

- prefill (debug intermediate state, only reachable with
  ``keep_device_kv_cache=True``): ``exec_kv`` writes the NPU paged main
  cache as usual, then the layer's cache rows are committed D2H
  (``cache_cpu[slot] = cache_npu[slot]``) through the manager;
- decode: no NPU main K/V cache at all (indexer K cache only). The current
  token's K/V is produced compute-only and committed D2H directly; top-k
  misses are loaded H2D into the resident (topk) buffer and a single
  resident SFA attention runs.
"""
```

数据面总述：decode 端设备上没有主 K/V cache，只留 indexer K cache。正文「是什么」「在哪一步出现」引用。

## vllm_ascend/attention/sfa_kv_offload.py#L166-L173

```python
        if enable_dsa_cp():
            raise NotImplementedError("Sparse KV offload currently requires TP without context parallelism")
        if self.enable_sparse_sfa_c8:
            raise NotImplementedError(
                "Sparse KV offload does not support the sparse SFA C8 main "
                "cache; sparse LI C8 is supported for the device-resident "
                "indexer cache."
            )
```

与 KV 量化的互斥关系：主 cache 的 SFA C8 不支持，indexer 的 LI C8 支持。正文「常见误解」与 related 到 [[kv-cache-quantization]] 时引用。

## vllm_ascend/attention/sfa_kv_offload.py#L306-L322

```python
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
```

decode 步新产生的 K/V 直接 D2H 写入 CPU 池，不经过 NPU paged cache。正文「在哪一步出现」引用。

## vllm_ascend/attention/sfa_kv_offload.py#L396-L448

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

decode 主路径：top-k 索引先过合法性 mask，再交给 manager 把缺失行 H2D 拉进常驻 buffer，最后 attention 只在常驻 buffer 上算一次。正文「在哪一步出现」「形状与数值」引用。

## vllm_ascend/attention/sfa_v1.py#L1661-L1688

```python
        if self.skip_topk:
            topk_indices = self._get_indexcache_topk_indices(parallel_context.topk_num_tokens)
        else:
            if not self.has_indexer:
                raise RuntimeError(f"skip_topk is False but indexer is None. layer_name={self.layer_name}.")
            assert q_c is not None
            topk_indices = self.indexer_select_post_process(
                x=hidden_states,
                q_c=q_c,
                kv_cache=kv_cache,
                attn_metadata=attn_metadata,
                cos=cos,
                sin=sin,
                actual_seq_lengths_query=actual_seq_lengths_query,
                actual_seq_lengths_key=actual_seq_lengths_key,
            )
            if self.use_index_cache:
                self._update_indexcache_topk_indices(topk_indices)

        attn_output = self._execute_sparse_flash_attention_process(
            ql_nope,
            q_pe,
            kv_cache,
            topk_indices,
            attn_metadata,
            actual_seq_lengths_query,
            actual_seq_lengths_key,
        )
```

`topk_indices` 的唯一两个来源：本层 lightning indexer 打分，或 `skip_topk` 时复用 index cache 里上一层的结果。正文「是什么」引用。

## vllm_ascend/attention/utils.py#L61-L66

```python
def build_valid_topk_mask(
    topk_indices: torch.Tensor,
    seq_len_thresholds: torch.Tensor,
) -> torch.Tensor:
    """Mask padding and unwritten tail-block positions in SFA top-k rows."""
    return (topk_indices >= 0) & (topk_indices < seq_len_thresholds)
```

top-k 行里 padding 位与尚未写入的尾块位被判为无效，说明实际保留的 token 数可以少于 `topk`。正文「常见误解」引用。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload.cpp#L115-L173

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

常驻 buffer 的 LRU 逻辑：命中的 slot 留下、其余可驱逐、只有 miss 的 token 需要 H2D；重排后顺序为「未用 → 新装入 → 命中」。正文「是什么」「形状与数值」引用。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L53-L84

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

常驻 buffer 的真实形状与显存开销公式。正文「形状与数值」引用。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L756-L776

```python
        self.lru_slot_to_token_cpu_list = [
            torch.full(
                [self.max_num_topk_rows, self.topk_buffer_size],
                -1,
                dtype=torch.int32,
                device="cpu",
                pin_memory=True,
            )
            for _ in range(self.num_layers)
        ]
        self.lru_slots_cpu_list = [
            torch.arange(
                self.topk_buffer_size,
                dtype=torch.int32,
                device="cpu",
            )
            .view(1, -1)
            .repeat(self.max_num_topk_rows, 1)
            .pin_memory()
            for _ in range(self.num_layers)
        ]
```

LRU 状态是「每层 × 每行」独立的，容量等于 `topk_buffer_size`。正文「形状与数值」引用。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L194-L227

```python
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

块数由 NPU / DRAM / workload 三者取最小；开启卸载后 NPU 每块只算 device spec，这是吞吐（并发与长度）收益的来源。正文「是什么」「常见误解」引用。
