# KV Cache CPU Offload —— 引用片段

全部取自 `vllm-ascend@28bf3a2e`（ref `main`）。

## docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L3-L14

```markdown
## Overview

KV Cache CPU Offload enables offloading inactive KV cache blocks from NPU memory to CPU memory, allowing vLLM to handle longer contexts or more concurrent requests when NPU memory is limited. When a prefix cache miss occurs on the NPU but the data exists in CPU memory, the KV cache is asynchronously loaded back to the NPU, reducing recomputation latency.

This feature is built on vLLM's `OffloadingConnector` framework and provides an Ascend NPU-specific implementation (`NPUOffloadingSpec`) that uses dedicated NPU streams for efficient asynchronous data transfers between NPU and CPU.

## Key Concepts

- **CPU Block Pool**: A pre-allocated pool of CPU memory blocks (optionally pinned) used to store offloaded KV cache data.
- **Asynchronous Transfer**: NPU-to-CPU (D2H) and CPU-to-NPU (H2D) transfers are performed on separate NPU streams, overlapping with computation to minimize latency impact.
- **LRU Eviction**: The CPU-side block pool uses an LRU (Least Recently Used) eviction policy to manage limited CPU memory efficiently.
```

官方文档对特性目标、触发条件（NPU 前缀未命中而 CPU 命中）与三个核心机制的定义，用于「一句话」「为什么需要它」两节。

## docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L75-L81

```markdown
## How It Works

1. **Normal inference**: KV cache blocks are computed and stored on the NPU as usual.
2. **Eviction to CPU**: When NPU memory is full and new blocks are needed, inactive KV cache blocks are asynchronously copied to CPU memory via a dedicated D2H NPU stream.
3. **Prefix cache hit (CPU)**: When a request shares a prefix with previously computed data, and the prefix cache is not found on NPU but exists in CPU memory, the KV cache blocks are asynchronously loaded back from CPU to NPU via a dedicated H2D NPU stream.
4. **LRU management**: The CPU block pool uses LRU eviction to discard the least recently used blocks when CPU memory is full.
```

官方文档给出的四步流程，页面的「怎么工作」以它为骨架；其中第 2 步「显存满了才搬」与 e2e 测试的观察不一致，页面在常见误解里点出。

## docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L64-L73

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

配置项的取值与语义，事实表里的配置行直接来自这里；`cpu_bytes_to_use` 是「整机口径」这一条也出自这里。

## docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L104-L111

```markdown
## Notes

- This feature requires vLLM v1 engine.
- Adjust `cpu_bytes_to_use` based on available CPU memory. Reserving too much may cause host out-of-memory errors.
- Pinned (page-locked) memory is used when available for optimal transfer performance.
- The `gpu_memory_utilization` parameter controls how much NPU memory is reserved for KV cache. Lower values leave less NPU memory for KV cache, making offloading more active.
- For production workloads, benchmark with realistic request patterns to find the optimal `cpu_bytes_to_use` and `blocks_per_chunk` settings.
```

使用约束与调参建议，用于「开了的代价」相关的叙述与常见误解第一条（`gpu_memory_utilization` 决定 NPU 侧容量，卸载不会把它变大）。

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

解释为什么用户填的 `kv_connector="OffloadingConnector"` 实际拿到的是 `AscendOffloadingConnector`，以及昇腾侧只替换了哪一段。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/offloading_connector.py#L234-L267

```python
                if isinstance(layer_spec, AttentionSpec):
                    if isinstance(layer_cache, torch.Tensor):
                        page_size_bytes = layer_spec.page_size_bytes
                        element_size = layer_cache.element_size()
                        block_stride_bytes = (
                            layer_cache.stride(0) * element_size
                            if layer_is_packed.get(layer_name, False)
                            else page_size_bytes
                        )
                        raw = torch.empty(
                            0,
                            dtype=torch.int8,
                            device=layer_cache.device,
                        ).set_(layer_cache.untyped_storage())
                        view = torch.as_strided(
                            raw,
                            (num_blocks, page_size_bytes),
                            (block_stride_bytes, 1),
                            layer_cache.storage_offset() * element_size,
                        )
                        add_view(
                            layer_name,
                            view,
                            layer_spec.unpadded_page_size_bytes,
                        )
                    elif isinstance(layer_cache, (tuple, list)):
                        for view, copy_size_bytes in _canonicalize_split_attention_cache(
                            layer_cache,
                            num_blocks,
                            layer_spec.unpadded_page_size_bytes,
                        ):
                            add_view(layer_name, view, copy_size_bytes)
                    else:
                        raise TypeError(f"Unsupported KV cache type for {layer_name}: {type(layer_cache).__name__}")
```

每块搬多少字节由 KV Cache Spec 的 `page_size_bytes` / `unpadded_page_size_bytes` 决定；昇腾分离的 K/V 张量走 `_canonicalize_split_attention_cache` 变成零拷贝 int8 视图。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/npu.py#L27-L55

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
```

给出 CPU 块数 ↔ 字节数的换算式（`worker_kv_bytes_per_block × world_size × blocks_per_chunk` 再对齐），以及 `cpu_bytes_to_use` 优先于 legacy `num_cpu_blocks`。

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

`NPUOffloadingSpec` 相对上游 `CPUOffloadingSpec` 只改了平台闸门与 worker 构造，其余（manager、LRU、事件）全部沿用上游。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L267-L314

```python
class NPUOffloadingWorker(CPUOffloadingWorker):
    """Native CPU offloading worker backed by Ascend batched DMA."""

    def __init__(
        self,
        kv_caches: CanonicalKVCaches,
        blocks_per_chunk: int,
        num_cpu_blocks: int,
    ) -> None:
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

CPU 侧内存在 worker 构造时一次性 `torch.zeros` 预分配（可用则锁页），形状是 `[num_cpu_blocks, npu_page_size_bytes × blocks_per_chunk]`，每个 canonical 张量一份。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L56-L94

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

两个方向各一个 handler、各自独立的流池与事件池；CPU 页宽恰为 NPU 页宽的 `blocks_per_chunk` 倍这条硬约束写在 assert 里。

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

一次传输拆成多少条 memcpy 描述符：`Σ(组内块数 × 该组的 canonical 引用数)`；描述符缓冲区从池里复用。

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

传输的流序：D2H 先 `wait_stream(current_stream)` 等模型流写完 KV，H2D 不等；同方向的相邻传输用 `wait_event` 串成一条链。

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
```

完成检测是非阻塞的 `Event.query()`；传输字节数与耗时（秒）作为 `TransferResult` 上报，这是页面里「带宽代价可观测」的依据。

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

方向码与 `aclrtMemcpyKind` 的对应；算子取的是「当前 NPU 流」，所以 Python 侧的 `with torch.npu.stream(stream)` 决定它落在哪条流上。

## csrc/torch_binding.cpp#L180-L231

```cpp
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
#endif
```

快路径：整批描述符一次 `aclrtMemcpyBatchAsync` 下发，仅在编译期定义了 `CANN_MEMCPY_BATCH_ASYNC` 且方向不是 D2D 时走。

## csrc/torch_binding.cpp#L233-L256

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

        TORCH_CHECK(ret == ACL_SUCCESS,
                    "aclrtMemcpyAsync failed at index ", i,
                    " with error code ", ret,
                    ", src=", src_data[i],
                    ", dst=", dst_data[i],
                    ", size=", size_data[i]);
    }
}
```

回退路径：逐条 `aclrtMemcpyAsync`，下发次数等于描述符条数——页面用它说明 `blocks_per_chunk` 与层数如何放大下发开销。

## csrc/torch_binding.cpp#L2119-L2123

```cpp
    // swap_blocks_batch takes CPU tensors (int64 pointer/size arrays), not NPU
    // tensors, so dispatch must be registered on the CPU backend. The function
    // internally submits async memcpy on the current NPU stream.
    ops.def("swap_blocks_batch(Tensor x, Tensor y, Tensor z, int direction) -> ()");
    ops.impl("swap_blocks_batch", torch::kCPU, &vllm_ascend::swap_blocks_batch);
```

算子注册在 kCPU 分发键上——解释了为什么描述符张量必须留在 CPU（且做成锁页内存）。

## vllm_ascend/attention/attention_v1.py#L113-L121

```python
    @staticmethod
    def get_kv_cache_shape(
        num_blocks: int,
        block_size: int,
        num_kv_heads: int,
        head_size: int,
        cache_dtype_str: str = "",
    ) -> tuple[int, ...]:
        return (2, num_blocks, block_size, num_kv_heads, head_size)
```

真实数字一节算 `page_size_bytes` 用的形状：K 与 V 是最外层维度为 2 的两份 `[num_blocks, block_size, num_kv_heads, head_size]`。

## vllm_ascend/attention/attention_v1.py#L151-L153

```python
    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]
```

`AscendAttentionBackend` 只支持 128 token 的块，真实数字一节据此取 `block_size = 128`。

## tests/ut/kv_offload/test_native_cpu_offload.py#L80-L101

```python
def test_npu_offloading_spec_uses_upstream_cpu_manager() -> None:
    bytes_per_chunk = 64 * 2 * 2
    aligned_bytes_per_chunk = round_up(
        bytes_per_chunk,
        NPUOffloadingSpec.BLOCK_SIZE_ALIGNMENT,
    )
    spec = NPUOffloadingSpec(_make_config({"cpu_bytes_to_use": 10 * aligned_bytes_per_chunk}))

    assert spec.num_blocks == 10
    assert isinstance(spec.get_manager(), CPUOffloadingManager)

def test_npu_offloading_spec_supports_legacy_num_cpu_blocks() -> None:
    extra_config: dict[str, object] = {"num_cpu_blocks": 10}
    spec = NPUOffloadingSpec(_make_config(extra_config))
    aligned_bytes_per_chunk = round_up(
        64 * 2 * 2,
        NPUOffloadingSpec.BLOCK_SIZE_ALIGNMENT,
    )

    assert spec.num_blocks == 10
    assert spec.extra_config["cpu_bytes_to_use"] == 10 * aligned_bytes_per_chunk
```

单测把 `num_blocks = cpu_bytes_to_use ÷ round_up(worker_kv_bytes_per_block × world_size × blocks_per_chunk)` 这条换算钉死（用例里 64×2×2 即 `worker_kv_bytes_per_block=64`、`world_size=2`、`blocks_per_chunk=2`），也确认 manager 用的是上游 `CPUOffloadingManager`（LRU 在上游）。

## tests/e2e/pull_request/one_card/test_cpu_offloading.py#L108-L119

```python
def _accuracy_test(llm: LLM, subscriber: MockSubscriber):
    sampling_params = SamplingParams(max_tokens=1)
    cpu_block_size = llm.llm_engine.vllm_config.kv_transfer_config.kv_connector_extra_config["block_size"]

    subscriber.get_new_cpu_stored_events()

    # prepend prompt to be cpu block aligned
    prompt = "Let's count to 10. One, two, three, four,"
    while len(llm.generate(prompt, use_tqdm=False)[0].prompt_token_ids) % cpu_block_size != 0:
        prompt = ". " + prompt

    assert subscriber.get_new_cpu_stored_events()
```

e2e 测试要把 prompt 补齐到 CPU 块对齐才保证有 `BlockStored(medium="CPU")` 事件——常见误解「不足一个 chunk 的尾巴也会被存下」的反证。

## tests/e2e/pull_request/one_card/test_cpu_offloading.py#L130-L165

```python
def test_cpu_offloading() -> None:
    """
    Tests OffloadingConnector with CPUOffloadingSpec.
    """

    # Configure OffloadingConnector with the Ascend transfer worker.
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

    port: int
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("0.0.0.0", 0))
        port = s.getsockname()[1]

    events_endpoint = f"tcp://*:{port}"
    kv_events_config = KVEventsConfig(
        enable_kv_cache_events=True,
        publisher="zmq",
        endpoint=events_endpoint,
        topic="test",
    )

    llm = LLM(
        model="Qwen/Qwen3-0.6B",
        gpu_memory_utilization=0.5,
        kv_events_config=kv_events_config,
        kv_transfer_config=kv_transfer_config,
    )
```

仓库内实际跑的配置：除文档写的 `blocks_per_chunk` 外还可用 `block_size`（chunk 的 token 数）指定同一件事；同时说明这个用例跑的是 Qwen3-0.6B、`gpu_memory_utilization=0.5`——NPU 侧并没有显存压力，却仍然产生了 CPU 侧的 `BlockStored` 事件。

## tests/e2e/pull_request/one_card/test_cpu_offloading.py#L61-L105

```python
def _latency_test(llm: LLM, subscriber: MockSubscriber):
    sampling_params = SamplingParams(max_tokens=1)

    num_times_cpu_better_than_cold = 0
    num_tests = 10
    total_cold_time = 0.0
    total_gpu_hit_time = 0.0
    total_cpu_hit_time = 0.0
    prompt_token_ids = [0] * 10001
    for i in range(num_tests):
        prompt_token_ids[0] = i
        prompts = [TokensPrompt(prompt_token_ids=prompt_token_ids)]

        # run generation - this should trigger saving KV cache
        start_time = time.time()
        llm.generate(prompts, sampling_params, use_tqdm=False)
        cold_time = time.time() - start_time
        total_cold_time += cold_time

        # run generation again - should hit the GPU prefix cache
        start_time = time.time()
        llm.generate(prompts, sampling_params, use_tqdm=False)
        gpu_hit_time = time.time() - start_time
        total_gpu_hit_time += gpu_hit_time

        # reset prefix cache to avoid GPU hit.
        llm.reset_prefix_cache()

        assert subscriber.get_new_cpu_stored_events()

        # run generation again - this should trigger loading from CPU
        start_time = time.time()
        llm.generate(prompts, sampling_params, use_tqdm=False)
        cpu_hit_time = time.time() - start_time
        total_cpu_hit_time += cpu_hit_time

        if cpu_hit_time < cold_time:
            num_times_cpu_better_than_cold += 1

    print("Average times:")
    print(f"    Cold: {total_cold_time * 1000 / num_tests:.2f}ms")
    print(f"    GPU hit: {total_gpu_hit_time * 1000 / num_tests:.2f}ms")
    print(f"    CPU hit: {total_cpu_hit_time * 1000 / num_tests:.2f}ms")

    assert num_times_cpu_better_than_cold >= 0.8 * num_tests
```

仓库对「值不值」的唯一量化承诺：10001 token 的 prompt、清掉 NPU 前缀缓存后，从 CPU 命中要在 10 次里至少 8 次快过冷启动——只是 `<` 关系，没有给出加速比。
