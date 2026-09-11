# Sparse KV Offload 源码片段

来源仓库：vllm-ascend@28bf3a2e（ref main）。

## docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L203-L241

````markdown
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
````

官方用户文档给出 Decode 侧的完整启动配置与三个参数的含义，是「怎么配」与「开了的代价」的一手依据。

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

官方列出的并行度与后端限制，正文「事实表」的约束行引用它。

## docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L148-L186

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

官方设计文档的七步 decode 流程，是正文「怎么工作」一节的骨架，与源码逐步对照。

## docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L262-L272

```markdown
- Layerwise shared-buffer offload requires the Memcache backend and eager mode.
- Sparse Decode Offload requires Model Runner V1 and an SFA/MLA sparse-attention
  model. The main KV cache must use BF16; LIC8 quantization is supported only
  for the device-resident indexer cache.
- Hybrid KV cache layouts are not supported.
- Sparse Decode Offload supports DP and TP; CP and PP are not supported.
- Joint deployment requires Prefill TP to be greater than or equal to, and
  divisible by, Decode TP.
- MemFabric is the only supported Remote D2H transfer backend.
```

官方给出的「主缓存必须 BF16、LIC8 只用于 indexer」的边界，与 `register_kv_caches` 里的 raise 相互印证。

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

四个可配字段的默认值，以及 `topk` 是 `init=False` 的派生字段（用户不能设）。

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

这段是「保留多少 token」的最终答案：`topk` 直接等于模型配置里的 `index_topk`，并且启用前置条件（稀疏模型、无 CP/PP、PD 分离的 D 节点、Model Runner V1）全在这里校验。

## vllm_ascend/attention/sfa_v1.py#L110-L142

```python
    @staticmethod
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

开关如何切换到独立的卸载实现类，以及 SFA 后端只支持 `block_size = 128`。

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

`topk_indices` 的两个来源：本层 indexer 现算，或 `skip_topk` 层复用缓存下来的上一层索引。卸载路径拿到的就是这个张量，自己不做任何再筛选。

## vllm_ascend/device/device_op.py#L346-L372

```python
        elif sfa_impl.use_torch_npu_lightning_indexer:
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
        else:
            topk_indices, _ = torch.ops._C_ascend.npu_lightning_indexer(
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

选择依据的算子本体：lightning indexer 只读设备常驻的 indexer K cache，不读被卸载的主 KV。

## vllm_ascend/platform.py#L377-L392

```python
            if use_index_cache:
                index_topk_pattern = getattr(config, "index_topk_pattern", None)
                if index_topk_pattern is None:
                    index_topk_freq = getattr(config, "index_topk_freq", 1)
                    index_skip_topk_offset = getattr(config, "index_skip_topk_offset", 2)
                    skip_topk = max(start_layer - index_skip_topk_offset + 1, 0) % index_topk_freq != 0
                else:
                    skip_topk = start_layer < len(index_topk_pattern) and index_topk_pattern[start_layer] == "S"
                if skip_topk:
                    raise ValueError(
                        "Index cache dependency crosses a pipeline-parallel stage boundary: "
                        f"PP rank {pp_rank}/{pp_size} owns layers [{start_layer}, {end_layer}), "
                        f"but layer {start_layer} skips Top-K computation without a preceding "
                        "Top-K recomputation in the same PP stage. "
                        "Cross-PP Top-K index propagation is not supported."
                    )
```

`skip_topk` 由模型配置的 `index_topk_pattern` / `index_topk_freq` 决定，说明「哪些层复用索引」是模型属性而非卸载特性引入的。

## vllm_ascend/attention/sfa_kv_offload.py#L166-L180

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

启用卸载后被强制关掉的两件事：主缓存 C8 量化，以及融合的 prolog 预处理算子。

## vllm_ascend/attention/sfa_kv_offload.py#L297-L343

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

decode 分支完全不写 NPU 分页主缓存：新 token 的 K/V 算完直接 D2H 落到主机池。

## vllm_ascend/attention/sfa_kv_offload.py#L390-L437

```python
        stable_prefix_lens = (actual_seq_lengths_key[:num_decodes] - decode_query_lens).clamp_min_(0)
        decode_stable_prefix_lens = torch.index_select(
            stable_prefix_lens,
            0,
            row_to_req,
        )
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
```

top-k 索引先被掩成合法范围，再交给 manager 做常驻映射；`stable_prefix_lens` 把 MTP 可能被改写的 query 段排除在可复用范围外。

## vllm_ascend/attention/utils.py#L61-L66

```python
def build_valid_topk_mask(
    topk_indices: torch.Tensor,
    seq_len_thresholds: torch.Tensor,
) -> torch.Tensor:
    """Mask padding and unwritten tail-block positions in SFA top-k rows."""
    return (topk_indices >= 0) & (topk_indices < seq_len_thresholds)
```

合法 top-k 的判定：非负且小于该行的实际 key 长度。

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

设备热缓冲区的精确形状与字节数公式，算例里的 72 MiB/层就来自这里。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L189-L241

```python
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
    final_planner_bytes = final_num_blocks * total_page_size_bytes
    planned_host_bytes = final_num_blocks * host_page_size_bytes
    planned_device_bytes = final_num_blocks * npu_page_size_bytes
    return SparseKVOffloadMemoryBudget(
        npu_limit_blocks=npu_limit_blocks,
        dram_limit_blocks=dram_limit_blocks,
        workload_limit_blocks=workload_limit_blocks,
        final_num_blocks=final_num_blocks,
        final_planner_bytes=final_planner_bytes,
        planned_host_bytes=planned_host_bytes,
        planned_device_bytes=planned_device_bytes,
        host_alignment_reserve_bytes=host_alignment_reserve_bytes,
        limiting_factor=limiting_factor,
    )
```

块数上限的三方取小（NPU / DRAM / 工作负载），算例里 15,237 块就按这里的 `dram_limit_blocks` 算。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L602-L624

```python
            self.topk_buffers_k.append(cache_or_caches[OFFLOAD_TOPK_BUFFER_K_INDEX])
            self.topk_buffers_v.append(cache_or_caches[OFFLOAD_TOPK_BUFFER_V_INDEX])
            if self.tp_rank == 0:
                self.k_caches_cpu.append(cache_or_caches[OFFLOAD_K_CACHE_CPU_INDEX])
                self.v_caches_cpu.append(cache_or_caches[OFFLOAD_V_CACHE_CPU_INDEX])

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

每 token 字节数的定义（注意紧邻的 `assert kv_head_num == 1`，只对 MLA/SFA 成立），以及 BF16 与整除约束。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L637-L654

```python
        pages_per_row = self.topk_buffer_size // self.block_size
        self.current_slots_npu = torch.empty(
            (self.max_num_topk_rows, self.topk),
            dtype=torch.int32,
            device=device,
        )
        self.resident_block_table_npu = torch.arange(
            self.max_num_topk_rows * pages_per_row,
            dtype=torch.int32,
            device=device,
        ).view(self.max_num_topk_rows, pages_per_row)
        self.resident_query_lens_npu = torch.arange(1, self.max_num_topk_rows + 1, dtype=torch.int32, device=device)
        self.resident_seq_lens_npu = torch.full(
            (self.max_num_topk_rows,),
            self.topk_buffer_size,
            dtype=torch.int32,
            device=device,
        )
```

常驻视图的「假 block_table」：每行独占 `pages_per_row` 个连续页，序列长度恒为 `topk_buffer_size`，注意力算子因此看不出数据是搬上来的。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L898-L912

```python
        # the has_prefill path (NPU paged cache -> CPU pool D2H) only exists
        # for single-node PD-colocate debug.
        if self.tp_rank != 0:
            # Decode-produced K/V is replicated across TP ranks, so TP0 alone
            # writes new decode tokens. PD pull fills disjoint parts of this
            # shared pool from all TP ranks through the broadcast GVA.
            return
        if k_cache_cpu is None or v_cache_cpu is None:
            raise RuntimeError("Sparse KV offload TP0 CPU cache is not registered")
        if has_prefill and not self.sparse_kv_offload_config.keep_device_kv_cache:
            raise RuntimeError(
                "Sparse KV offload prefill offload requires "
                "keep_device_kv_cache=True; a PD-disaggregated decode node "
                "never stages prefill KV in an NPU paged cache"
            )
```

同一 DP 内只有 TP0 写主机池，其它 TP rank 直接返回。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L940-L978

```python
        if has_prefill:
            assert k_cache_npu is not None and v_cache_npu is not None
            src_k = int(k_cache_npu.data_ptr()) + safe_slots * self.token_size_bytes_k
            src_v = int(v_cache_npu.data_ptr()) + safe_slots * self.token_size_bytes_v
        else:
            assert k is not None and v is not None
            k_rows = k.reshape(-1, self.token_size_bytes_k // k.element_size())
            v_rows = v.reshape(-1, self.token_size_bytes_v // v.element_size())
            if k_rows.shape[0] != token_count or v_rows.shape[0] != token_count:
                raise ValueError("decode K/V row counts must match slot_mapping")
            if not k_rows.is_contiguous():
                k_rows = k_rows.contiguous()
            if not v_rows.is_contiguous():
                v_rows = v_rows.contiguous()
            token_indices = self.d2h_token_indices_npu[:token_count]
            src_k = int(k_rows.data_ptr()) + token_indices * self.token_size_bytes_k
            src_v = int(v_rows.data_ptr()) + token_indices * self.token_size_bytes_v

        dst_k = int(k_cache_cpu.data_ptr()) + safe_slots * self.token_size_bytes_k
        dst_v = int(v_cache_cpu.data_ptr()) + safe_slots * self.token_size_bytes_v
        self.d2h_src_ptrs_npu[:token_count].copy_(src_k)
        self.d2h_src_ptrs_npu[token_count : 2 * token_count].copy_(src_v)
        self.d2h_dst_ptrs_npu[:token_count].copy_(dst_k)
        self.d2h_dst_ptrs_npu[token_count : 2 * token_count].copy_(dst_v)
        self.d2h_lengths_npu[:token_count].fill_(self.token_size_bytes_k)
        self.d2h_lengths_npu[token_count : 2 * token_count].fill_(self.token_size_bytes_v)
        self.d2h_lengths_npu[:token_count].masked_fill_(~valid, 0)
        self.d2h_lengths_npu[token_count : 2 * token_count].masked_fill_(~valid, 0)
        self.d2h_size_npu.fill_(2 * token_count)

        result = offload.sparse_copy(
            self.d2h_src_ptrs_npu,
            self.d2h_dst_ptrs_npu,
            self.d2h_lengths_npu,
            self.d2h_size_npu,
            device,
        )
        if result not in (None, 0):
            raise RuntimeError(f"memfabric D2H sparse_copy failed with result={result}")
```

新 token 的 D2H 是逐 token 行的散列拷贝：每行一个 (src, dst, len) 描述符，落点由 `slot_mapping` 决定，非法 slot 把长度置 0 而不是跳过。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1086-L1101

```python
            self.sparse_copy_args_buffer_npu.copy_(self.sparse_copy_args_buffer_cpu, non_blocking=capturing)

        if self.tp_size > 1:
            # Make sure that tp0 d2h is finished before other tp's h2d.
            # NOTE we can't use barrier since it can't be captured in graph.
            self.tp_group.broadcast(torch.empty([], dtype=torch.int8, device="npu"), src=0)
        offload.sparse_copy(
            self.gvas_buffer_npu,
            self.addr_buffer_npu,
            self.size_buffer_npu,
            self.num_tokens_buffer_npu,
            self.topk_buffers_k[0].device,
        )
```

H2D 侧同样走 `offload.sparse_copy`，但描述符只覆盖 miss 行；TP>1 时用一次 broadcast 保证 TP0 的 D2H 先于其它 rank 的 H2D。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload.cpp#L115-L169

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
```

命中判定、可淘汰槽收集、miss 分配与 LRU 顺序重排的全部逻辑；末尾三段写回决定了「淘汰候选在前、刚装入的在后、命中的最后」的复用次序。

## vllm_ascend/core/kv_cache_interface.py#L55-L61

```python
    @property
    def real_page_size_bytes(self) -> int:
        return (
            self.storage_block_size
            * self.num_kv_heads
            * (self.head_size * get_dtype_size(self.dtype) + self.scale_dim * get_dtype_size(self.scale_dtype))
        )
```

主机池按块计价时的每块字节数公式，算例里 144 KiB/块/层由它得出。

## vllm_ascend/worker/model_runner_v1.py#L5006-L5014

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

开关直接把主 MLA 缓存的 spec 标成 `store_on_host`，后续的内存规划与分配据此区分主机侧/设备侧。

## vllm_ascend/worker/model_runner_v1.py#L3713-L3720

```python
    def profile_run(self) -> None:
        self.eplb_warmup()
        if self.sparse_kv_offload_enabled:
            allocate_kv_offload_topk_profile_buffers(
                getattr(self, "kv_cache_spec", None) or self.get_kv_cache_spec(),
                self.vllm_config,
                self.sparse_kv_offload_config,
            )
```

profile run 阶段就要把热缓冲区实打实分配一遍，否则显存探测会高估可用容量。
