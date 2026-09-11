# Sparse KV Offload —— 引用片段

所有片段取自 `vllm-ascend@28bf3a2e`（ref `main`）。

## docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L203-L241

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

官方指南的启用方式、三个参数的含义与约束（`topk_buffer_size >= index_topk` 且能被 `block_size` 整除）。线上版：<https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.html>

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

官方设计文档给出的内存分区与 decode 单步七个阶段，是「怎么工作」一节的骨架，也是「全量历史留在主机、只搬 miss」这一结论的官方依据。线上版：<https://docs.vllm.ai/projects/ascend/en/latest/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.html>

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

模块自述的数据面：decode 侧完全没有 NPU 主 K/V 缓存，只保留 indexer K cache。这是整页「保留哪些 token 的 KV」的核心依据。

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

decode 分支用 `_compute_kv_only` 算出当前 token 的 K/V 后直接 D2H 写主机池，`k_cache_npu=None`；prefill 分支只在 PD 共置调试下可达。

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

decode 路径的主干：先把越界 / 未写入的 top-k 位置置 -1，再 `onload_topk_kv` 把 miss 行搬上设备，最后把注意力算子指向热缓冲区视图而不是分页主缓存。

## vllm_ascend/attention/sfa_kv_offload.py#L189-L215

```python
    @staticmethod
    def _resident_views(manager, layer_name: str, rows: int):
        layer_id = manager._get_offload_layer_id(layer_name)
        buffer_k = manager.topk_buffers_k[layer_id]
        buffer_v = manager.topk_buffers_v[layer_id]
        pages_per_row = manager.topk_buffer_size // manager.block_size
        resident_pages = rows * pages_per_row
        resident_k = buffer_k[:rows].view(
            resident_pages,
            manager.block_size,
            buffer_k.shape[-2],
            buffer_k.shape[-1],
        )
        resident_v = buffer_v[:rows].view(
            resident_pages,
            manager.block_size,
            buffer_v.shape[-2],
            buffer_v.shape[-1],
        )
        return (
            resident_k,
            resident_v,
            manager.current_slots_npu[:rows],
            manager.resident_block_table_npu[:rows],
            manager.resident_query_lens_npu[:rows],
            manager.resident_seq_lens_npu[:rows],
        )
```

热缓冲区被重新 view 成分页形状 `(rows * pages_per_row, block_size, n_kv, d)`，配上一张恒等块表 `resident_block_table_npu`，注意力算子看到的是「一张只有 topk_buffer_size 个位置的迷你分页缓存」。

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

热缓冲区的形状与字节数公式：每层 K/V 各一块，行数 = `min(max_num_batched_tokens, max_num_seqs * decode_width)`，每行 `topk_buffer_size` 个 token 位，dtype 固定 BF16。事实表与算例都用这一段。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L608-L654

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

        # D2H uses a separate descriptor set from the shared H2D buffers below.
        # Both prefill (colocate debug only, gated by keep_device_kv_cache)
        # and decode can produce up to max_num_tokens rows.
        d2h_descriptor_rows = self.max_num_tokens * 2
        device = self.topk_buffers_k[0].device
        self.d2h_src_ptrs_npu = torch.empty(d2h_descriptor_rows, dtype=torch.int64, device=device)
        self.d2h_dst_ptrs_npu = torch.empty(d2h_descriptor_rows, dtype=torch.int64, device=device)
        self.d2h_lengths_npu = torch.empty(d2h_descriptor_rows, dtype=torch.int32, device=device)
        self.d2h_size_npu = torch.empty(1, dtype=torch.int32, device=device)
        self.d2h_token_indices_npu = torch.arange(self.max_num_tokens, dtype=torch.int64, device=device)

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

三条硬约束（`num_kv_heads == 1`、主缓存必须 BF16、`topk_buffer_size % block_size == 0`）、每 token 字节数公式，以及注意力看到的恒等块表 / 固定 `seq_len = topk_buffer_size`。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L1072-L1101

```python
            if capturing:
                current_compute_stream = torch_npu.npu.current_stream()
                subscribed_compute_streams = get_subscribed_compute_streams()
                if current_compute_stream not in subscribed_compute_streams:
                    torch_npu.npu._subscribe_report(current_compute_stream)
                    subscribed_compute_streams.add(current_compute_stream)
                torch_npu.npu._launch_host_func(
                    current_compute_stream,
                    self._onload_topk_kv_cpu,
                    args,
                )
            else:
                self._onload_topk_kv_cpu(args)

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

        current_slots_cpu = self.lru_current_slots_cpu[:num_tokens]
        current_slots_npu[:num_tokens].copy_(current_slots_cpu, non_blocking=capturing)
```

LRU 决策在 CPU 侧跑（图模式下通过 `_launch_host_func` 挂到计算流上），产出的地址描述符回灌 NPU，再由 `offload.sparse_copy` 一次性把 miss 行 H2D；`current_slots` 是逻辑 top-k 位置到物理槽位的重映射表。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload.cpp#L99-L147

```cpp
  const int64_t req_id = req_ids[row];
  if (UNLIKELY(last_req_ids[row] != req_id)) {
    reset_lru_resident_row(slot_to_token_row, lru_slots_row, capacity);
    last_req_ids[row] = req_id;
  }
  const int32_t stable_prefix_len = std::clamp(stable_prefix_lens[row], 0, max_token);

  const int32_t base = next_lru_resident_epoch(token_mark, token_pos, epoch, max_token);
  for (int32_t pos = 0; pos < topk; ++pos) {
    const int32_t token = topk_row[pos];
    if (LIKELY(is_valid_lru_resident_token(token, max_token)) && token_mark[token] != base) {
      token_mark[token] = base;
      token_pos[token] = pos;
    }
  }

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
```

命中判定与失效规则的原文：请求换人就整行重置；`token >= stable_prefix_len` 的投机后缀强制作废（主机池里那几行可能已被下一步覆写）；其余按 `slot_to_token` 判命中，未命中的槽位进可驱逐列表。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload.cpp#L149-L173

```cpp
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

驱逐与 LRU 重排：miss 只能拿到 `min(miss, evictable)` 个槽位，重排后的顺序是「剩余可驱逐 → 本步新装入 → 本步命中」，也就是越靠前越先被驱逐。

## vllm_ascend/ascend_config.py#L1228-L1245

```python
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

四个用户可见字段的默认值；`topk` 不是用户参数，是从模型配置里读出来的（见下一段）。

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

启用前置条件的完整清单，以及 `topk = hf_text_config.index_topk` 这条关键赋值——k 的大小由模型自己定，不是这个特性的参数。

## vllm_ascend/device/device_op.py#L325-L358

```python
        if enable_sparse_li_c8:
            assert len(kv_cache) == (3 if sfa_impl.enable_sparse_sfa_c8 else 4)
            assert q_li_scale is not None
            assert q_li_shape_ori is not None
            weights = weights.to(torch.float16)
            topk_indices = torch.ops._C_ascend.npu_lightning_indexer_quant(
                query=q_li.view(q_li_shape_ori),
                key=kv_cache[indexer_cache_idx],
                weights=weights,
                query_dequant_scale=q_li_scale.view(q_li_shape_ori[:-1]),
                key_dequant_scale=kv_cache[indexer_scale_cache_idx].squeeze(2),  # B S N D -> B S D
                actual_seq_lengths_query=actual_seq_lengths_query,
                actual_seq_lengths_key=actual_seq_lengths_key,
                block_table=attn_metadata.block_table,
                query_quant_mode=0,
                key_quant_mode=0,
                layout_query="TND",
                layout_key="PA_BSND",
                sparse_count=2048,
                sparse_mode=3,
            )
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
```

top-k 索引的实际产出方：lightning indexer 算子。它读的是设备驻留的 indexer K cache 和真实的 `attn_metadata.block_table`，与卸载无关——卸载只消费它的输出。

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

部分层没有自己的 indexer（`skip_topk`），直接复用缓存下来的上一层 top-k 索引；这条分支决定了卸载侧 `onload_topk_kv(skip_topk=...)` 能不能省掉一次 LRU 计算。

## vllm_ascend/attention/sfa_v1.py#L110-L138

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
```

开关生效的位置：`AscendSFABackend` 在建 metadata builder 和 impl 时按 `sparse_kv_offload_config.enabled` 整体换一套 SFA 实现，而不是在热路径上插 if。

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

`store_on_host` 这个 Ascend 私有 spec 字段是整条分配路径的开关：置位的层，主 KV 只在主机侧分配。

## vllm_ascend/worker/worker.py#L500-L534

```python
    def _apply_kv_offload_decode_memory_constraints(
        self,
        available_device_memory_bytes: int,
    ) -> int:
        GiB = lambda b: b / GiB_bytes
        sparse_kv_offload_config = get_ascend_config().sparse_kv_offload_config
        if not sparse_kv_offload_config.enabled:
            return int(available_device_memory_bytes)

        kv_cache_spec = getattr(self, "kv_cache_spec", None) or self.get_kv_cache_spec()
        dram_limit_bytes = int(sparse_kv_offload_config.dram_size_per_dp_GB * GiB_bytes)
        budget = plan_sparse_kv_offload_memory(
            kv_cache_spec=kv_cache_spec,
            vllm_config=self.vllm_config,
            available_device_memory_bytes=available_device_memory_bytes,
            dram_limit_bytes=dram_limit_bytes,
            keep_device_kv_cache=sparse_kv_offload_config.keep_device_kv_cache,
        )
        logger.info_once(
            "Sparse KV offload memory plan: npu_limit=%d blocks, "
            "dram_limit=%d blocks, workload_limit=%d blocks, "
            "final=%d blocks (%s limited), planner=%.2f GiB, "
            "host=%.2f GiB, device=%.2f GiB, alignment_reserve=%.2f GiB.",
            budget.npu_limit_blocks,
            budget.dram_limit_blocks,
            budget.workload_limit_blocks,
            budget.final_num_blocks,
            budget.limiting_factor,
            GiB(budget.final_planner_bytes),
            GiB(budget.planned_host_bytes),
            GiB(budget.planned_device_bytes),
            GiB(budget.host_alignment_reserve_bytes),
            scope="local",
        )
        return int(budget.final_planner_bytes)
```

显存探测的结果在这里被改写：返回给调度器的不再是「NPU 还剩多少」，而是 NPU / DRAM / 工作负载三者取最小后折算出来的字节数。

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

块数上限的三路取最小，以及 `_CPU_CACHE_MAX_ALIGNMENT_OVERHEAD_PER_LAYER`（每层 3×2 MiB）的对齐预留——算例里的 `dram_limit_blocks` 就按这里算。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L898-L923

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

        if has_prefill:
            if k_cache_npu is None or v_cache_npu is None:
                raise ValueError("prefill offload requires NPU paged K/V caches")
            device = k_cache_npu.device
        else:
            if k is None or v is None:
                raise ValueError("decode offload requires current-token K/V")
            device = k.device

        slots = slot_mapping.reshape(-1).to(device=device, dtype=torch.int64)
```

TP 下只有 rank 0 写新 token 的 K/V（MLA 的 K/V 在 TP 间是复制的），其余 rank 直接返回；主机池由一个 DP 组内的所有 TP rank 共享。

## vllm_ascend/attention/utils.py#L61-L66

```python
def build_valid_topk_mask(
    topk_indices: torch.Tensor,
    seq_len_thresholds: torch.Tensor,
) -> torch.Tensor:
    """Mask padding and unwritten tail-block positions in SFA top-k rows."""
    return (topk_indices >= 0) & (topk_indices < seq_len_thresholds)
```

合法 top-k 位置的判据：非负且小于该行的真实 key 长度。越界的位置被替换成 -1，后续 LRU 与地址计算都会跳过。

## docs/source/locale/zh_CN/LC_MESSAGES/user_guide/feature_guide/sparse_kv_cache_offload.po#L166-L170

```po
msgid ""
"- `enabled` (bool, default: `False`): Whether to enable sparse KV Cache offload.\n"
"- `topk_buffer_size` (int, default: `4096`): Size of the device hot KV buffer, should be greater than the model's `index_topk`. Increase this size will increase topk KV hit rate thus reduce tpot, but will bring higher device memory usage. Normally we set it to 2 * `index_topk` to achieve a balance between topk KV hit rate and device memory usage.\n"
"- `dram_size_per_dp_GB` (bool, default: `128`): Reserved host memory size in Gigabyte per DP group. An error will be raised if this reserved size is not enough to contain the whole host KV cache buffer. All ranks in one TP group will share one host KV cache buffer, so the total host memory usage will be `dram_size_per_dp_GB` * `data_parallel_size`.\n"
"- `keep_device_kv_cache` (bool, optional, default: `False`): Whether to allocate the device KV Cache buffer. If enabled, we will still allocate device KV Cache, thus we can't save KV cache device memory usage, and can not improve sequence length or batch_size. Only reserved for PD-colocate debugging, you **SHOULD NOT** enable it in actual production environment."
```

唯一明确写出「`topk_buffer_size` 越大命中率越高、TPOT 越低，代价是设备显存」这条吞吐取舍的上游文本，以及 `dram_size_per_dp_GB` 的总量口径（× DP 数）。注意这是 zh_CN 本地化目录里保存的**旧版**英文原文（对应的英文页 `sparse_kv_cache_offload.md` 在本 commit 已被 `layerwise_and_sparse_kv_cache_offloading.md` 取代），与现行文档并存但未被渲染。

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

与 KV Cache 量化互斥的直接证据：主 SFA 缓存一旦走 sparse SFA C8，实现类在构造时就抛 `NotImplementedError`；CP 同理。
