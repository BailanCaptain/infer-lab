# KV Cache CPU Offload — 源码片段

## vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L5-L13

```markdown
KV Cache CPU Offload enables offloading inactive KV cache blocks from NPU memory to CPU memory, allowing vLLM to handle longer contexts or more concurrent requests when NPU memory is limited. When a prefix cache miss occurs on the NPU but the data exists in CPU memory, the KV cache is asynchronously loaded back to the NPU, reducing recomputation latency.

This feature is built on vLLM's `OffloadingConnector` framework and provides an Ascend NPU-specific implementation (`NPUOffloadingSpec`) that uses dedicated NPU streams for efficient asynchronous data transfers between NPU and CPU.

## Key Concepts

- **CPU Block Pool**: A pre-allocated pool of CPU memory blocks (optionally pinned) used to store offloaded KV cache data.
- **Asynchronous Transfer**: NPU-to-CPU (D2H) and CPU-to-NPU (H2D) transfers are performed on separate NPU streams, overlapping with computation to minimize latency impact.
- **LRU Eviction**: The CPU-side block pool uses an LRU (Least Recently Used) eviction policy to manage limited CPU memory efficiently.
```

官方文档对这个特性的定义、触发条件（NPU 前缀未命中 + CPU 有）与三个核心概念。

## vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L64-L73

```markdown
## Configuration Parameters

- `kv_connector`: Must be set to `"OffloadingConnector"`.
- `kv_role`: Set to `"kv_both"` to enable both storing and loading of KV cache.
- `cpu_bytes_to_use`: Server-wide CPU memory capacity in bytes. It is divided across workers by the upstream vLLM offloading framework.
- `blocks_per_chunk`: Number of NPU KV-cache blocks stored in one CPU offload block. It must be greater than zero.
- `spec_name`: Must be `"NPUOffloadingSpec"` for Ascend NPU.
- `spec_module_path`: Must be `"vllm_ascend.distributed.kv_transfer.kv_pool.kv_offload.native.npu"`.

The legacy Ascend-only `num_cpu_blocks` option remains supported for compatibility, but new configurations should use vLLM's native `cpu_bytes_to_use` option.
```

main 上的配置项清单，以及「num_cpu_blocks 是遗留项」这一说明。

## vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L104-L110

```markdown
## Notes

- This feature requires vLLM v1 engine.
- Adjust `cpu_bytes_to_use` based on available CPU memory. Reserving too much may cause host out-of-memory errors.
- Pinned (page-locked) memory is used when available for optimal transfer performance.
- The `gpu_memory_utilization` parameter controls how much NPU memory is reserved for KV cache. Lower values leave less NPU memory for KV cache, making offloading more active.
- For production workloads, benchmark with realistic request patterns to find the optimal `cpu_bytes_to_use` and `blocks_per_chunk` settings.
```

官方对使用代价的提示：主机 OOM 风险、pinned 内存、`gpu_memory_utilization` 与卸载活跃度的关系。

## vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L64-L71

```markdown
## Configuration Parameters

- `kv_connector`: Must be set to `"OffloadingConnector"`.
- `kv_role`: Set to `"kv_both"` to enable both storing and loading of KV cache.
- `num_cpu_blocks`: Number of blocks to allocate in CPU memory. Increase this value for longer context scenarios. Each block consumes memory proportional to `block_size × num_layers × (key_size + value_size)`.
- `block_size`: The CPU-side block size. Should be a multiple of the NPU-side block size. Typical value: `128`.
- `spec_name`: Must be `"NPUOffloadingSpec"` for Ascend NPU.
- `spec_module_path`: Must be `"vllm_ascend.kv_offload.npu"`.
```

v0.23.0 上的同名章节，参数名与 `spec_module_path` 都与 main 不同，是版本差异的直接依据。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/__init__.py#L63-L73

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

main 把 `OffloadingConnector` 这个名字从注册表里摘掉重注册成昇腾版本，并写明了为什么（K/V 分离布局）。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/offloading_connector.py#L86-L97

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

说明 main 为什么要做布局规范化，以及这层视图是零拷贝的（不在模型执行路径上增加开销）。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/offloading_connector.py#L159-L189

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

main 的适配只在布局确实不同（AttentionSpec 但不是单张量、或 MambaSpec 是 list）时才介入，其余走上游原路。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L22-L55

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

main 上遗留参数 `num_cpu_blocks` 如何被折算成 `cpu_bytes_to_use`：`cpu_bytes_to_use` 优先，块数按「每块字节 × world_size × blocks_per_chunk 再对齐」换算。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L58-L97

```python
class NPUOffloadingSpec(_CPUOffloadingSpec):
    """Use vLLM's CPU manager with an Ascend-specific transfer worker."""

    # vLLM is skipped by the Ascend mypy invocation, so redeclare the
    # inherited worker cache without taking over its runtime initialization.
    _worker: NPUOffloadingWorker | None

    def __init__(self, config: OffloadingConfig):
        normalized_config, legacy_num_blocks = _normalize_legacy_num_blocks(
            config,
            self.BLOCK_SIZE_ALIGNMENT,
        )
        super().__init__(normalized_config)
        if legacy_num_blocks is not None and config.worker_kv_bytes_per_block <= 0:
            self.num_blocks = legacy_num_blocks

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

main 的 spec：继承上游 `CPUOffloadingSpec`，只换掉 worker 构造与平台门禁；淘汰策略、容量核算仍是上游的。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L56-L94

```python
class SingleDirectionNPUOffloadingHandler:
    """Transfer blocks in one direction using an ordered NPU DMA stream."""

    def __init__(
        self,
        npu_tensors: list[torch.Tensor],
        cpu_tensors: list[torch.Tensor],
        blocks_per_chunk: int,
        kv_cache_groups_data_refs: list[list[CanonicalKVCacheRef]],
        npu_to_cpu: bool,
    ) -> None:
        assert len(npu_tensors) == len(cpu_tensors)
        assert npu_tensors

        for npu_tensor, cpu_tensor in zip(npu_tensors, cpu_tensors):
            assert npu_tensor.dtype == torch.int8
            assert npu_tensor.ndim == 2
            assert npu_tensor.device.type == "npu"
            assert cpu_tensor.dtype == torch.int8
            assert cpu_tensor.ndim == 2
            assert cpu_tensor.device.type == "cpu"
            assert cpu_tensor.shape[1] == (npu_tensor.shape[1] * blocks_per_chunk)

        # Keep independent lists in each handler so one direction can be shut
        # down without releasing tensors still referenced by the other.
        self.src_tensors = list(npu_tensors if npu_to_cpu else cpu_tensors)
        self.dst_tensors = list(cpu_tensors if npu_to_cpu else npu_tensors)
        self.npu_to_cpu = npu_to_cpu
        self.kv_cache_groups_data_refs = kv_cache_groups_data_refs
        self.src_blocks_per_chunk = 1 if npu_to_cpu else blocks_per_chunk
        self.dst_blocks_per_chunk = blocks_per_chunk if npu_to_cpu else 1
        self.direction = DIRECTION_D2H if npu_to_cpu else DIRECTION_H2D

        self._transfer_events: dict[int, torch.npu.Event] = {}
        self._transfers: deque[Transfer] = deque()
        self._stream_pool: list[torch.npu.Stream] = []
        self._event_pool: list[torch.npu.Event] = []
        self._buffer_pool: list[tuple[torch.Tensor, torch.Tensor, torch.Tensor]] = []
```

main 的单方向搬运器：CPU 侧每块正好是 NPU 侧每块的 `blocks_per_chunk` 倍（断言锁死），两侧张量都是 int8 二维视图；一个方向一个实例。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L187-L222

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

main 的下发时序：D2H 先等模型主流写完 KV；同方向的后一笔等前一笔的 `end_event`；实际拷贝是一次 `swap_blocks_batch`。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L224-L247

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

回收路径：传输字节数与 event 实测耗时被一起上报，流 / event / 描述符缓冲全部回池复用。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L276-L313

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

main 的 CPU 池分配公式：每个规范张量一块 `[num_cpu_blocks, npu_page_size_bytes × blocks_per_chunk]` 的 int8 pinned 内存。

## vllm-ascend@28bf3a2e:csrc/torch_binding.cpp#L152-L175

```cpp
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

direction 整数到 `aclrtMemcpyKind` 的映射，以及拷贝挂在「当前 NPU 流」上——所以 Python 侧的 `with torch.npu.stream(...)` 决定了它跑在哪条流。

## vllm-ascend@28bf3a2e:csrc/torch_binding.cpp#L177-L231

```cpp
    // =========================================================================
    // path 1: aclrtMemcpyBatchAsync (CANN 8.5+)
    // =========================================================================
#if defined(CANN_MEMCPY_BATCH_ASYNC)
    if (memcpy_kind != ACL_MEMCPY_DEVICE_TO_DEVICE) {
        static_assert(sizeof(void*) == sizeof(int64_t),
                      "void* and int64_t must be the same size");
        static_assert(sizeof(size_t) == sizeof(int64_t),
                      "size_t and int64_t must be the same size");

        void** dst_arr = reinterpret_cast<void**>(
            const_cast<int64_t*>(dst_data));
        void** src_arr = reinterpret_cast<void**>(
            const_cast<int64_t*>(src_data));
        size_t* size_arr = reinterpret_cast<size_t*>(
            const_cast<int64_t*>(size_data));
        size_t* dest_maxs = size_arr;

        // aclrtMemcpyBatchAttr uses srcLoc/dstLoc (aclrtMemLocation)
        // to specify memory locations, not aclrtMemcpyKind.
        int32_t device_id = 0;
        aclrtGetDevice(&device_id);

        aclrtMemLocation host_loc = {};
        host_loc.type = ACL_MEM_LOCATION_TYPE_HOST;
        host_loc.id = 0;

        aclrtMemLocation device_loc = {};
        device_loc.type = ACL_MEM_LOCATION_TYPE_DEVICE;
        device_loc.id = device_id;

        aclrtMemcpyBatchAttr attr = {};
        if (memcpy_kind == ACL_MEMCPY_HOST_TO_DEVICE) {
            attr.srcLoc = host_loc;
            attr.dstLoc = device_loc;
        } else {  // ACL_MEMCPY_DEVICE_TO_HOST
            attr.srcLoc = device_loc;
            attr.dstLoc = host_loc;
        }

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
```

CANN 8.5+ 上整批描述符压成一次 `aclrtMemcpyBatchAsync` 下发，这是「一次传输 = 一次下发」的依据。

## vllm-ascend@28bf3a2e:csrc/torch_binding.cpp#L233-L247

```cpp
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
```

没有批量接口时的退化路径：逐个描述符一次 `aclrtMemcpyAsync`，下发次数等于描述符个数。

## vllm-ascend@2c59ff10:csrc/torch_binding.cpp#L149-L172

```cpp
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

    // =========================================================================
    // path 1: aclrtMemcpyBatchAsync (CANN 8.5+)
    // =========================================================================
#if defined(CANN_MEMCPY_BATCH_ASYNC)
    if (memcpy_kind != ACL_MEMCPY_DEVICE_TO_DEVICE) {
```

v0.23.0 的 `swap_blocks_batch` 与 main 逐字相同：同样的 direction 编码、同样的 CANN 8.5+ 批量分支，证明底层拷贝路径两版一致。

## vllm-ascend@2c59ff10:vllm_ascend/kv_offload/npu.py#L16-L43

```python
class NPUOffloadingSpec(OffloadingSpec):
    def __init__(self, vllm_config: VllmConfig, kv_cache_config: KVCacheConfig | None = None):
        super().__init__(vllm_config, kv_cache_config)

        num_cpu_blocks = self.extra_config.get("num_cpu_blocks")
        if not num_cpu_blocks:
            raise Exception("num_cpu_blocks must be specified in kv_connector_extra_config")
        self.num_cpu_blocks: int = num_cpu_blocks

        # scheduler-side
        self._manager: OffloadingManager | None = None

        # worker-side
        self._handler: OffloadingHandler | None = None

    def get_manager(self) -> OffloadingManager:
        if not self._manager:
            kv_events_config = self.vllm_config.kv_events_config
            enable_events = kv_events_config is not None and kv_events_config.enable_kv_cache_events
            assert len(self.gpu_block_size) == 1
            gpu_block_size = self.gpu_block_size[0]
            offloaded_block_size = gpu_block_size * self.block_size_factor
            self._manager = CPUOffloadingManager(
                block_size=offloaded_block_size,
                num_blocks=self.num_cpu_blocks,
                enable_events=enable_events,
            )
        return self._manager
```

v0.23.0 的 spec：`num_cpu_blocks` 是必填项（缺了直接抛异常），CPU 块大小 = NPU 块大小 × `block_size_factor`，淘汰交给上游 `CPUOffloadingManager`。

## vllm-ascend@2c59ff10:vllm_ascend/kv_offload/cpu_npu.py#L54-L108

```python
class CpuNpuOffloadingHandler(OffloadingHandler):
    def __init__(
        self,
        gpu_block_size: int,
        cpu_block_size: int,
        num_cpu_blocks: int,
        gpu_caches: dict[str, torch.Tensor],
        attn_backends: dict[str, type[AttentionBackend]],
    ):
        assert cpu_block_size % gpu_block_size == 0
        self.block_size_factor = cpu_block_size // gpu_block_size

        # npu streams for npu->cpu and cpu->npu
        self.d2h_stream = torch.npu.Stream()
        self.h2d_stream = torch.npu.Stream()

        # Ordered queue of in-flight transfers per direction
        self._d2h_transfers: deque[Transfer] = deque()
        self._h2d_transfers: deque[Transfer] = deque()

        # Reusable event pool to avoid allocation overhead
        self._event_pool: list[torch.npu.Event] = []

        pin_memory = is_pin_memory_available()

        # allocate cpu tensors
        logger.info("Allocating %d CPU tensors...", len(gpu_caches))
        self.npu_tensors: list[torch.Tensor] = []
        self.cpu_tensors: list[torch.Tensor] = []
        for layer_name, gpu_tensor in gpu_caches.items():
            self.npu_tensors.append(gpu_tensor)

            gpu_shape = gpu_tensor[0].shape

            num_blocks_idx = 0
            cpu_shape = list(gpu_shape)
            cpu_shape[num_blocks_idx] = num_cpu_blocks * self.block_size_factor

            logger.debug("Allocating CPU tensor of shape %r", cpu_shape)
            self.cpu_tensors.append(
                (
                    torch.zeros(
                        cpu_shape,
                        dtype=gpu_tensor[0].dtype,
                        device="cpu",
                        pin_memory=pin_memory,
                    ),
                    torch.zeros(
                        cpu_shape,
                        dtype=gpu_tensor[0].dtype,
                        device="cpu",
                        pin_memory=pin_memory,
                    ),
                )
            )
```

v0.23.0 的 handler：两条固定流；CPU 张量保留原 dtype 与原 shape（只改第 0 维），每层固定分配两张（K、V）。

## vllm-ascend@2c59ff10:vllm_ascend/kv_offload/cpu_npu.py#L205-L230

```python
        if is_d2h:
            # Wait for model computation to finish before reading NPU data
            stream.wait_stream(torch.npu.current_stream())
        if transfers:
            # Ensure this transfer starts only after the previous one completes
            last_transfer = transfers[-1]
            stream.wait_event(last_transfer.end_event)

        with torch.npu.stream(stream):
            start_event.record(stream)
            if total > 0:
                direction = 0 if not is_d2h else 1
                torch.ops._C_ascend.swap_blocks_batch(batch_src, batch_dst, batch_sizes, direction)
            end_event.record(stream)

        transfers.append(
            Transfer(
                job_id=job_id,
                stream=stream,
                start_event=start_event,
                end_event=end_event,
                num_bytes=src_sub_block_count * self._total_bytes_per_block,
            )
        )

        return True
```

v0.23.0 的下发时序与 main 同构：D2H 等模型主流、同方向串行、同一个 `swap_blocks_batch`。

## vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/__init__.py#L57-L87

```python
    KVConnectorFactory.register_connector(
        "UCMConnector", "vllm_ascend.distributed.kv_transfer.kv_pool.ucm_connector", "UCMConnectorV1"
    )

    KVConnectorFactory.register_connector(
        "LMCacheAscendConnector",
        "vllm_ascend.distributed.kv_transfer.kv_pool.lmcache_ascend_connector",
        "LMCacheConnectorV1",
    )

    # Override the upstream SimpleCPUOffloadConnector with the NPU
    # adaptation that uses aclrtMemcpyBatchAsync + torch.npu streams.
    # Only override if the upstream module exists in this vLLM version.
    try:
        import vllm.v1.simple_kv_offload  # noqa: F401
    except ImportError:
        pass
    else:
        if "SimpleCPUOffloadConnector" in KVConnectorFactory._registry:
            KVConnectorFactory._registry.pop("SimpleCPUOffloadConnector")
        KVConnectorFactory.register_connector(
            "SimpleCPUOffloadConnector",
            "vllm_ascend.distributed.kv_transfer.kv_pool.simple_cpu_offload.simple_cpu_offload_connector",  # noqa: E501
            "AscendSimpleCPUOffloadConnector",
        )

    KVConnectorFactory.register_connector(
        "RecomputeCPUOffloadConnector",
        "vllm_ascend.distributed.kv_transfer.kv_pool.recompute_cpu_offload.recompute_cpu_offload_connector",
        "RecomputeCPUOffloadConnectorV1",
    )
```

v0.23.0 的 `register_connector` 末尾：这里覆盖了 `SimpleCPUOffloadConnector`，但整份文件里没有 `OffloadingConnector` 这一项（全文件 grep 无匹配），说明 v0.23.0 用的是上游原版连接器，昇腾只经 `spec_module_path` 插入 spec。

## vllm-ascend@2c59ff10:tests/e2e/pull_request/one_card/test_cpu_offloading.py#L131-L147

```python
@pytest.mark.skip(reason="cpu offload connector is deprecated.")
def test_cpu_offloading() -> None:
    """
    Tests OffloadingConnector with CPUOffloadingSpec.
    """

    # configure OffloadingConnector (spec_name=CPUOffloadingSpec by default)
    kv_transfer_config = KVTransferConfig(
        kv_connector="OffloadingConnector",
        kv_role="kv_both",
        kv_connector_extra_config={
            "num_cpu_blocks": 1000,
            "block_size": 128,
            "spec_name": "NPUOffloadingSpec",
            "spec_module_path": "vllm_ascend.kv_offload.npu",
        },
    )
```

v0.23.0 的 e2e 用例被 skip 掉，理由写的是「cpu offload connector is deprecated」——这条路径在该版本上没有 CI 守着。

## vllm-ascend@28bf3a2e:tests/e2e/pull_request/one_card/test_cpu_offloading.py#L136-L145

```python
    kv_transfer_config = KVTransferConfig(
        kv_connector="OffloadingConnector",
        kv_role="kv_both",
        kv_connector_extra_config={
            "cpu_bytes_to_use": 1 << 30,
            "block_size": 128,
            "spec_name": "NPUOffloadingSpec",
            "spec_module_path": "vllm_ascend.distributed.kv_transfer.kv_pool.kv_offload.native.npu",
        },
    )
```

main 的 e2e 用例正常执行，但传的分块键名是 `block_size` 而不是文档里的 `blocks_per_chunk`。

## vllm-ascend@28bf3a2e:vllm_ascend/utils.py#L1167-L1180

```python
def refresh_block_size(vllm_config):
    """
    Refresh the block size in cache config.
    """
    cache_config = vllm_config.cache_config
    scheduler_config = vllm_config.scheduler_config
    model_config = vllm_config.model_config

    if not cache_config:
        return

    if cache_config.block_size is None:
        cache_config.block_size = 128
```

NPU 侧块大小默认 128 token，是本页所有字节数算例的起点。
