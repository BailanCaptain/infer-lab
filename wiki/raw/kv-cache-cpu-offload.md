# KV Cache CPU Offload 引用片段（vllm-ascend@28bf3a2e）

## docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L64-L81

~~~~markdown
## Configuration Parameters

- `kv_connector`: Must be set to `"OffloadingConnector"`.
- `kv_role`: Set to `"kv_both"` to enable both storing and loading of KV cache.
- `cpu_bytes_to_use`: Server-wide CPU memory capacity in bytes. It is divided across workers by the upstream vLLM offloading framework.
- `blocks_per_chunk`: Number of NPU KV-cache blocks stored in one CPU offload block. It must be greater than zero.
- `spec_name`: Must be `"NPUOffloadingSpec"` for Ascend NPU.
- `spec_module_path`: Must be `"vllm_ascend.distributed.kv_transfer.kv_pool.kv_offload.native.npu"`.

The legacy Ascend-only `num_cpu_blocks` option remains supported for compatibility, but new configurations should use vLLM's native `cpu_bytes_to_use` option.

## How It Works

1. **Normal inference**: KV cache blocks are computed and stored on the NPU as usual.
2. **Eviction to CPU**: When NPU memory is full and new blocks are needed, inactive KV cache blocks are asynchronously copied to CPU memory via a dedicated D2H NPU stream.
3. **Prefix cache hit (CPU)**: When a request shares a prefix with previously computed data, and the prefix cache is not found on NPU but exists in CPU memory, the KV cache blocks are asynchronously loaded back from CPU to NPU via a dedicated H2D NPU stream.
4. **LRU management**: The CPU block pool uses LRU eviction to discard the least recently used blocks when CPU memory is full.
~~~~

配置项清单与触发条件的唯一权威描述，正文的「配置」「触发条件」两处都引用它。

## docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L104-L110

~~~~markdown
## Notes

- This feature requires vLLM v1 engine.
- Adjust `cpu_bytes_to_use` based on available CPU memory. Reserving too much may cause host out-of-memory errors.
- Pinned (page-locked) memory is used when available for optimal transfer performance.
- The `gpu_memory_utilization` parameter controls how much NPU memory is reserved for KV cache. Lower values leave less NPU memory for KV cache, making offloading more active.
- For production workloads, benchmark with realistic request patterns to find the optimal `cpu_bytes_to_use` and `blocks_per_chunk` settings.
~~~~

说明 pinned memory 与 `gpu_memory_utilization` 对 offload 活跃度的影响，用于正文「常见误解」和「配置」。

## vllm_ascend/distributed/kv_transfer/__init__.py#L63-L73

```python
    # vLLM's native offloading worker assumes attention KV caches are packed
    # into one Tensor. Ascend keeps K/V as separate tensors, so replace only
    # the connector's worker-side canonicalization boundary while reusing the
    # upstream scheduler, manager, metrics, and transfer lifecycle.
    if "OffloadingConnector" in KVConnectorFactory._registry:
        KVConnectorFactory._registry.pop("OffloadingConnector")
    KVConnectorFactory.register_connector(
        "OffloadingConnector",
        "vllm_ascend.distributed.kv_transfer.kv_pool.kv_offload.native.offloading_connector",
        "AscendOffloadingConnector",
    )
```

证明配置里写 `"OffloadingConnector"` 实际拿到的是 Ascend 版连接器，正文「在哪一步出现」引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/offloading_connector.py#L86-L97

```python
def _canonicalize_split_attention_cache(
    cache_parts: Sequence[torch.Tensor],
    num_blocks: int,
    unpadded_page_size_bytes: int,
) -> tuple[tuple[torch.Tensor, int], ...]:
    """Canonicalize Ascend's separate K/V (and optional scale) tensors.

    Ascend attention keeps cache components as separate tensors while vLLM's
    native offloading worker expects a canonical block-level representation.
    The returned views alias the original NPU storage and therefore add no
    allocation or copy on the model execution path.
    """
```

说明 Ascend 的 K/V 分离布局被折成 `[num_blocks, page_bytes]` 的零拷贝 int8 视图，正文「形状与数值」引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L22-L55

```python
def _normalize_legacy_num_blocks(
    config: OffloadingConfig,
    alignment: int,
) -> tuple[OffloadingConfig, int | None]:
    """Translate legacy block capacity without mutating vLLM's config."""
    extra_config = config.extra_config
    if extra_config.get("cpu_bytes_to_use") is not None:
        return config, None

    num_cpu_blocks = extra_config.get("num_cpu_blocks")
    if num_cpu_blocks is None:
        return config, None
    num_cpu_blocks = int(num_cpu_blocks)
    if num_cpu_blocks <= 0:
        raise ValueError("num_cpu_blocks must be greater than 0")

    world_size = config.parallel.world_size
    worker_kv_bytes_per_block = config.worker_kv_bytes_per_block
    if worker_kv_bytes_per_block <= 0 or world_size <= 0:
        # The scheduler can construct the spec before worker cache sizing is
        # available. Use a non-zero placeholder to pass upstream validation;
        # NPUOffloadingSpec restores the legacy block capacity after init.
        cpu_bytes_to_use = 1
    else:
        kv_bytes_per_chunk = worker_kv_bytes_per_block * world_size * config.cache.blocks_per_chunk
        aligned_kv_bytes_per_chunk = round_up(
            kv_bytes_per_chunk,
            alignment,
        )
        cpu_bytes_to_use = num_cpu_blocks * aligned_kv_bytes_per_chunk

    normalized_extra_config = dict(extra_config)
    normalized_extra_config["cpu_bytes_to_use"] = cpu_bytes_to_use
    return replace(config, extra_config=normalized_extra_config), num_cpu_blocks
```

`cpu_bytes_to_use` 与 legacy `num_cpu_blocks` 的换算关系（含 world_size 与 blocks_per_chunk 因子），正文「形状与数值」「配置」引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L74-L93

```python
    def create_worker(
        self,
        kv_caches: CanonicalKVCaches,
    ) -> NPUOffloadingWorker:
        return NPUOffloadingWorker(
            kv_caches=kv_caches,
            blocks_per_chunk=self.blocks_per_chunk,
            num_cpu_blocks=self.num_blocks,
        )

    def get_worker(
        self,
        kv_caches: CanonicalKVCaches,
    ) -> OffloadingWorker:
        # CPUOffloadingSpec rejects non-CUDA/XPU platforms in get_worker().
        # Keep its worker cache and lifecycle, replacing only that platform
        # gate with the NPU-specific worker construction.
        if self._worker is None:
            self._worker = self.create_worker(kv_caches)
        return self._worker
```

`NPUOffloadingSpec` 绕开上游的 CUDA/XPU 平台闸门并构造 NPU worker，正文「在哪一步出现」引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L276-L313

```python
        pin_memory = is_pin_memory_available()
        logger.info("Allocating %d CPU tensors...", len(kv_caches.tensors))

        npu_tensors: list[torch.Tensor] = []
        cpu_tensors: list[torch.Tensor] = []
        for kv_cache_tensor in kv_caches.tensors:
            npu_page_size_bytes = kv_cache_tensor.page_size_bytes
            npu_tensor = kv_cache_tensor.tensor
            if npu_tensor.dtype != torch.int8 or npu_tensor.ndim != 2:
                raise ValueError(
                    "Canonical NPU KV cache tensors must be two-dimensional "
                    f"int8 views, got shape={tuple(npu_tensor.shape)}, "
                    f"dtype={npu_tensor.dtype}"
                )
            if npu_tensor.shape[1] != npu_page_size_bytes:
                raise ValueError(
                    "Canonical NPU KV cache page size mismatch: "
                    f"shape[1]={npu_tensor.shape[1]}, "
                    f"page_size_bytes={npu_page_size_bytes}"
                )
            cpu_page_size_bytes = npu_page_size_bytes * blocks_per_chunk

            start_time = time.monotonic()
            cpu_tensor = torch.zeros(
                (num_cpu_blocks, cpu_page_size_bytes),
                dtype=torch.int8,
                device="cpu",
                pin_memory=pin_memory,
            )
            logger.debug(
                "Allocated pinned CPU tensor %d x %d (%.2f GB): %.3f s",
                num_cpu_blocks,
                cpu_page_size_bytes,
                num_cpu_blocks * cpu_page_size_bytes / 1e9,
                time.monotonic() - start_time,
            )
            npu_tensors.append(npu_tensor)
            cpu_tensors.append(cpu_tensor)
```

CPU 侧内存的实际形状 `[num_cpu_blocks, npu_page_size_bytes * blocks_per_chunk]` 与 pinned 分配，正文「形状与数值」引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L187-L222

```python
        stream = self._stream_pool.pop() if self._stream_pool else torch.npu.Stream()
        start_event = self._event_pool.pop() if self._event_pool else torch.npu.Event(enable_timing=True)
        end_event = self._event_pool.pop() if self._event_pool else torch.npu.Event(enable_timing=True)

        if self.npu_to_cpu:
            # KV writes happen on the model stream. D2H must not read a block
            # until those writes are complete.
            stream.wait_stream(torch.npu.current_stream())
        if self._transfers:
            stream.wait_event(self._transfers[-1].end_event)

        with torch.npu.stream(stream):
            start_event.record(stream)
            if num_copy_ops > 0:
                torch.ops._C_ascend.swap_blocks_batch(
                    src,
                    dst,
                    sizes,
                    self.direction,
                )
            end_event.record(stream)

        self._transfer_events[job_id] = end_event
        self._transfers.append(
            Transfer(
                job_id=job_id,
                stream=stream,
                start_event=start_event,
                end_event=end_event,
                num_bytes=num_transfer_bytes,
                batch_src=batch_src,
                batch_dst=batch_dst,
                batch_sizes=batch_sizes,
            )
        )
        return True
```

拷贝路径的核心：独立 NPU stream、与模型流的同步、同方向 transfer 串行化、下发 `swap_blocks_batch`。正文「拷贝路径」引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L224-L247

```python
    def get_finished(self) -> list[TransferResult]:
        results: list[TransferResult] = []
        while self._transfers and self._transfers[0].end_event.query():
            transfer = self._transfers.popleft()
            transfer_time = transfer.start_event.elapsed_time(transfer.end_event) * 1e-3
            results.append(
                TransferResult(
                    job_id=transfer.job_id,
                    success=True,
                    transfer_size=transfer.num_bytes,
                    transfer_time=transfer_time,
                )
            )
            self._stream_pool.append(transfer.stream)
            self._event_pool.extend((transfer.end_event, transfer.start_event))
            self._buffer_pool.append(
                (
                    transfer.batch_src,
                    transfer.batch_dst,
                    transfer.batch_sizes,
                )
            )
            del self._transfer_events[transfer.job_id]
        return results
```

传输字节数与耗时由 start/end event 计时后上报，是「带宽代价」可观测的来源；stream / event / 描述符缓冲复用池也在这里归还。

## csrc/torch_binding.cpp#L136-L175

```cpp
void swap_blocks_batch(const torch::Tensor& src_ptrs,
                       const torch::Tensor& dst_ptrs,
                       const torch::Tensor& sizes,
                       int64_t direction) {

    TORCH_CHECK(src_ptrs.device().is_cpu(), "src_ptrs must be on CPU");
    TORCH_CHECK(dst_ptrs.device().is_cpu(), "dst_ptrs must be on CPU");
    TORCH_CHECK(sizes.device().is_cpu(), "sizes must be on CPU");
    TORCH_CHECK(src_ptrs.dtype() == torch::kInt64, "src_ptrs must be int64");
    TORCH_CHECK(dst_ptrs.dtype() == torch::kInt64, "dst_ptrs must be int64");
    TORCH_CHECK(sizes.dtype() == torch::kInt64, "sizes must be int64");

    const int64_t n = src_ptrs.size(0);
    TORCH_CHECK(dst_ptrs.size(0) == n, "dst_ptrs length must match src_ptrs");
    TORCH_CHECK(sizes.size(0) == n, "sizes length must match src_ptrs");

    if (n == 0) return;

    const int64_t* src_data = src_ptrs.data_ptr<int64_t>();
    const int64_t* dst_data = dst_ptrs.data_ptr<int64_t>();
    const int64_t* size_data = sizes.data_ptr<int64_t>();

    aclrtStream stream = c10_npu::getCurrentNPUStream().stream();

    aclrtMemcpyKind memcpy_kind;
    switch (direction) {
        case 0:
            memcpy_kind = ACL_MEMCPY_HOST_TO_DEVICE;
            break;
        case 1:
            memcpy_kind = ACL_MEMCPY_DEVICE_TO_HOST;
            break;
        case 2:
            memcpy_kind = ACL_MEMCPY_DEVICE_TO_DEVICE;
            break;
        default:
            TORCH_CHECK(false,
                        "swap_blocks_batch: invalid direction ", direction,
                        " (expected 0=H2D, 1=D2H, 2=D2D)");
    }
```

拷贝入口的签名：接受三个 CPU 上的 int64 描述符数组 + 方向码，落到当前 NPU stream。正文「拷贝路径」「形状与数值」引用。

## csrc/torch_binding.cpp#L217-L256

```cpp
        size_t attrs_index = 0;
        size_t fail_index = 0;

        aclError result = aclrtMemcpyBatchAsync(
            dst_arr, dest_maxs, src_arr, size_arr,
            static_cast<size_t>(n),
            &attr, &attrs_index, 1,
            &fail_index, stream);

        TORCH_CHECK(result == ACL_SUCCESS,
                    "aclrtMemcpyBatchAsync failed at index ", fail_index,
                    " with error code ", result);
        return;
    }
#endif

    // =========================================================================
    // path 2: aclrtMemcpyAsync
    // =========================================================================
    for (int64_t i = 0; i < n; i++) {
        void* dst = reinterpret_cast<void*>(dst_data[i]);
        const void* src = reinterpret_cast<const void*>(src_data[i]);
        size_t copy_size = static_cast<size_t>(size_data[i]);

        aclError ret = aclrtMemcpyAsync(
            dst,
            copy_size,
            src,
            copy_size,
            memcpy_kind,
            stream);

        TORCH_CHECK(ret == ACL_SUCCESS,
                    "aclrtMemcpyAsync failed at index ", i,
                    " with error code ", ret,
                    ", src=", src_data[i],
                    ", dst=", dst_data[i],
                    ", size=", size_data[i]);
    }
}
```

两条实际拷贝路径：CANN 8.5+ 的批量 `aclrtMemcpyBatchAsync`，否则退化成逐块 `aclrtMemcpyAsync` 循环。正文「拷贝路径」引用。

## vllm_ascend/utils.py#L1175-L1179

```python
    if not cache_config:
        return

    if cache_config.block_size is None:
        cache_config.block_size = 128
```

Ascend 平台上 KV block 默认 128 token，正文「形状与数值」算 page 字节数时引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L45-L53

```python
def _new_descriptor_buffers(
    num_copy_ops: int,
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    pin_memory = is_pin_memory_available()
    return (
        torch.empty(num_copy_ops, dtype=torch.int64, pin_memory=pin_memory),
        torch.empty(num_copy_ops, dtype=torch.int64, pin_memory=pin_memory),
        torch.empty(num_copy_ops, dtype=torch.int64, pin_memory=pin_memory),
    )
```

三个 int64 pinned 描述符缓冲（src 指针 / dst 指针 / 字节数）的形状，正文「形状与数值」引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L116-L131

```python
        num_copy_ops = sum(
            group_size * len(group_data_refs)
            for group_size, group_data_refs in zip(group_sizes, self.kv_cache_groups_data_refs)
        )
        batch_src, batch_dst, batch_sizes = (
            self._buffer_pool.pop() if self._buffer_pool else _new_descriptor_buffers(num_copy_ops)
        )
        if batch_src.numel() < num_copy_ops:
            batch_src, batch_dst, batch_sizes = _new_descriptor_buffers(num_copy_ops)

        src = batch_src[:num_copy_ops]
        dst = batch_dst[:num_copy_ops]
        sizes = batch_sizes[:num_copy_ops]
        all_src = src.numpy()
        all_dst = dst.numpy()
        all_sizes = sizes.numpy()
```

`num_copy_ops` 的定义式（组内块数 × 该组 canonical 张量数），正文用它算 Qwen3-0.6B 的描述符条数。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L315-L328

```python
        self._store_handler = SingleDirectionNPUOffloadingHandler(
            npu_tensors=npu_tensors,
            cpu_tensors=cpu_tensors,
            blocks_per_chunk=blocks_per_chunk,
            kv_cache_groups_data_refs=kv_caches.group_data_refs,
            npu_to_cpu=True,
        )
        self._load_handler = SingleDirectionNPUOffloadingHandler(
            npu_tensors=npu_tensors,
            cpu_tensors=cpu_tensors,
            blocks_per_chunk=blocks_per_chunk,
            kv_cache_groups_data_refs=kv_caches.group_data_refs,
            npu_to_cpu=False,
        )
```

存（D2H）与取（H2D）各一个单向 handler，正文「在哪一步出现」引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/offloading_connector.py#L159-L189

```python
class AscendOffloadingConnectorWorker(OffloadingConnectorWorker):
    """Offloading worker boundary supporting Ascend's separate K/V layout."""

    def register_kv_caches(
        self,
        kv_caches: dict[
            str,
            torch.Tensor | list[torch.Tensor] | tuple[torch.Tensor, ...],
        ],
    ) -> None:
        kv_cache_config = self.kv_cache_config

        requires_layout_adaptation = False
        for group in kv_cache_config.kv_cache_groups:
            group_spec = group.kv_cache_spec
            per_layer_specs = group_spec.kv_cache_specs if isinstance(group_spec, UniformTypeKVCacheSpecs) else {}
            for layer_name in group.layer_names:
                layer_spec = per_layer_specs.get(layer_name, group_spec)
                layer_cache = kv_caches[layer_name]
                if (isinstance(layer_spec, AttentionSpec) and not isinstance(layer_cache, torch.Tensor)) or (
                    isinstance(layer_spec, MambaSpec) and isinstance(layer_cache, list)
                ):
                    requires_layout_adaptation = True
                    break
            if requires_layout_adaptation:
                break

        # Preserve upstream behavior verbatim for upstream-compatible layouts.
        if not requires_layout_adaptation:
            super().register_kv_caches(kv_caches)  # type: ignore[arg-type]
            return
```

KV cache 注册的入口与「只在需要时才做布局适配」的分支，正文「在哪一步出现」第 3 步引用。
