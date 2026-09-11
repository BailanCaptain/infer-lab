# KV Cache CPU Offload —— 引用片段

来源仓库：`vllm-ascend@28bf3a2e`（ref `main`）。

## docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L3-L13

```markdown
## Overview

KV Cache CPU Offload enables offloading inactive KV cache blocks from NPU memory to CPU memory, allowing vLLM to handle longer contexts or more concurrent requests when NPU memory is limited. When a prefix cache miss occurs on the NPU but the data exists in CPU memory, the KV cache is asynchronously loaded back to the NPU, reducing recomputation latency.

This feature is built on vLLM's `OffloadingConnector` framework and provides an Ascend NPU-specific implementation (`NPUOffloadingSpec`) that uses dedicated NPU streams for efficient asynchronous data transfers between NPU and CPU.

## Key Concepts

- **CPU Block Pool**: A pre-allocated pool of CPU memory blocks (optionally pinned) used to store offloaded KV cache data.
- **Asynchronous Transfer**: NPU-to-CPU (D2H) and CPU-to-NPU (H2D) transfers are performed on separate NPU streams, overlapping with computation to minimize latency impact.
- **LRU Eviction**: The CPU-side block pool uses an LRU (Least Recently Used) eviction policy to manage limited CPU memory efficiently.
```

官方文档对这个特性的定位、三个核心概念（CPU 块池、异步传输、LRU 淘汰）的权威说明，用于「为什么需要它」与「一句话」。

## docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L47-L62

````markdown
### Online Serving

```bash
vllm serve Qwen/Qwen3-0.6B \
    --gpu-memory-utilization 0.5 \
    --kv-transfer-config '{
        "kv_connector": "OffloadingConnector",
        "kv_role": "kv_both",
        "kv_connector_extra_config": {
            "cpu_bytes_to_use": 4294967296,
            "blocks_per_chunk": 8,
            "spec_name": "NPUOffloadingSpec",
            "spec_module_path": "vllm_ascend.distributed.kv_transfer.kv_pool.kv_offload.native.npu"
        }
    }'
```
````

官方给出的完整可复制启动命令，「拿真实数字走一遍」里的配置片段以它为准。

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

事实表里每个配置项的官方定义，以及 `num_cpu_blocks` 的兼容状态。

## docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L75-L80

```markdown
## How It Works

1. **Normal inference**: KV cache blocks are computed and stored on the NPU as usual.
2. **Eviction to CPU**: When NPU memory is full and new blocks are needed, inactive KV cache blocks are asynchronously copied to CPU memory via a dedicated D2H NPU stream.
3. **Prefix cache hit (CPU)**: When a request shares a prefix with previously computed data, and the prefix cache is not found on NPU but exists in CPU memory, the KV cache blocks are asynchronously loaded back from CPU to NPU via a dedicated H2D NPU stream.
4. **LRU management**: The CPU block pool uses LRU eviction to discard the least recently used blocks when CPU memory is full.
```

触发条件的官方描述：什么时候 D2H、什么时候 H2D。

## docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L104-L111

```markdown
## Notes

- This feature requires vLLM v1 engine.
- Adjust `cpu_bytes_to_use` based on available CPU memory. Reserving too much may cause host out-of-memory errors.
- Pinned (page-locked) memory is used when available for optimal transfer performance.
- The `gpu_memory_utilization` parameter controls how much NPU memory is reserved for KV cache. Lower values leave less NPU memory for KV cache, making offloading more active.
- For production workloads, benchmark with realistic request patterns to find the optimal `cpu_bytes_to_use` and `blocks_per_chunk` settings.
```

约束与代价：v1 引擎、主机 OOM 风险、pinned 内存、`gpu_memory_utilization` 与卸载活跃度的关系。

## docs/source/user_guide/release_notes.md#L37-L40

```markdown
- Reduced scheduler issuance bubbles for workloads using asynchronous scheduling. Enable it with `--async-scheduling`. [#8766](https://github.com/vllm-project/vllm-ascend/pull/8766)
- Added zero-bubble scheduling for asynchronous speculative decoding. Enable it with `--async-scheduling` together with a speculative decoding configuration. [#7640](https://github.com/vllm-project/vllm-ascend/pull/7640)
- Batched KV-cache offload copies with `aclrtMemcpyBatchAsync` for CPU-offload workloads. Configure KV cache CPU offload as documented; batching is automatic within that path. [#7819](https://github.com/vllm-project/vllm-ascend/pull/7819)
- Reduced PCP/DCP KV-cache all-gather traffic by selecting the required blocks before communication. Enable PCP or DCP with `--prefill-context-parallel-size` or `--decode-context-parallel-size`; no separate optimization switch is needed. [#8050](https://github.com/vllm-project/vllm-ascend/pull/8050)
```

官方 release notes 确认「批量化拷贝走 `aclrtMemcpyBatchAsync`、在该路径内自动生效、无需额外开关」。

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

解释为什么配置里写上游名字 `OffloadingConnector` 却跑到昇腾实现：注册表被就地替换。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/offloading_connector.py#L317-L338

```python
class AscendOffloadingConnector(OffloadingConnector):
    """vLLM OffloadingConnector with an Ascend layout adapter."""

    # vLLM is skipped by the Ascend mypy invocation, so inherited attributes
    # are not visible to the type checker. Keep this aligned with upstream;
    # ``super().__init__`` still owns initialization and role handling.
    connector_worker: OffloadingConnectorWorker | None

    def __init__(
        self,
        vllm_config: VllmConfig,
        role: KVConnectorRole,
        kv_cache_config: KVCacheConfig,
    ) -> None:
        super().__init__(vllm_config, role, kv_cache_config)
        connector_worker = self.connector_worker
        if connector_worker is not None:
            self.connector_worker = AscendOffloadingConnectorWorker(
                connector_worker.spec,
                vllm_config,
                kv_cache_config,
            )
```

昇腾只替换 worker 侧，调度器侧完全复用上游。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/offloading_connector.py#L159-L190

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

布局适配只在昇腾把 K/V 拆成多个张量时才启动，否则原样走上游。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/offloading_connector.py#L234-L265

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

`[num_blocks, page_size_bytes]` 的 int8 零拷贝视图怎么造出来；拆分 K/V 时每个分量各注册一个视图。

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

给出容量换算公式：`cpu_bytes_to_use = num_cpu_blocks × round_up(worker_kv_bytes_per_block × world_size × blocks_per_chunk, BLOCK_SIZE_ALIGNMENT)`，以及 `cpu_bytes_to_use` 优先于 `num_cpu_blocks` 的优先级；`num_cpu_blocks <= 0` 报错。

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

`NPUOffloadingSpec` 存在的唯一理由：绕开上游 `CPUOffloadingSpec.get_worker()` 的 CUDA/XPU 平台门禁，其余生命周期照旧。

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
    assert "cpu_bytes_to_use" not in extra_config
```

单测把容量换算走了一个来回：`cpu_bytes_to_use = 10 × aligned_bytes_per_chunk` 反解出 `num_blocks == 10`，证明「CPU 块数 = 字节预算 ÷ 对齐后的每 chunk 字节」；同时确认 CPU 侧管理器就是上游 `CPUOffloadingManager`（LRU 归它管）。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L270-L313

```python
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
```

CPU 侧内存是**启动时一次性 `torch.zeros` 预分配**的，形状 `[num_cpu_blocks, npu_page_size_bytes × blocks_per_chunk]`，每个 canonical 张量一份；`pin_memory` 由 `is_pin_memory_available()` 决定。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L28-L31

```python
# Direction codes shared with csrc/torch_binding.cpp::swap_blocks_batch.
DIRECTION_H2D = 0
DIRECTION_D2H = 1
```

方向码与 C++ 侧的约定。

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
```

两个方向各一个 handler、各自持有独立张量列表；`blocks_per_chunk` 只加在 CPU 一侧（NPU 侧恒为 1），这是 NPU 块与 CPU chunk 的换算关系来源。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L116-L136

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

        src_offset = 0
        dst_offset = 0
        op_idx = 0
        num_transfer_bytes = 0
```

一次传输拆成多少条 memcpy 描述符：`num_copy_ops = Σ(块数 × 该组的 data_ref 数)`，描述符缓冲区来自复用池。

## vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/native/cpu_npu.py#L159-L178

```python
            for data_ref in group_data_refs:
                tensor_idx = data_ref.tensor_idx
                end_idx = op_idx + group_size
                compute_sub_block_ptrs(
                    group_src,
                    self.src_blocks_per_chunk,
                    all_src[op_idx:end_idx],
                    self.src_tensors[tensor_idx],
                    skip_count=src_blocks_to_skip,
                )
                compute_sub_block_ptrs(
                    group_dst,
                    self.dst_blocks_per_chunk,
                    all_dst[op_idx:end_idx],
                    self.dst_tensors[tensor_idx],
                    skip_count=dst_blocks_to_skip,
                )
                all_sizes[op_idx:end_idx] = data_ref.page_size_bytes
                num_transfer_bytes += group_size * data_ref.page_size_bytes
                op_idx = end_idx
```

传输字节数的准确定义：`num_transfer_bytes = Σ(块数 × data_ref.page_size_bytes)`，即每个 K/V 分量视图各算一遍。

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

拷贝路径的核心：专用 NPU stream、D2H 先 `wait_stream(current_stream)` 等模型流写完、同方向任务靠 `wait_event(上一笔 end_event)` 串成有序队列、最终一次 `swap_blocks_batch`。

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

完成检测是**非阻塞轮询** `end_event.query()`，且按 FIFO 顺序回收；`transfer_time` 由 NPU event 实测（`elapsed_time` 毫秒 × 1e-3 转秒），`transfer_size` 就是上面算出的字节数——这是「带宽代价」可观测的出口。

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

算子签名与方向码到 `aclrtMemcpyKind` 的映射；它提交到 `getCurrentNPUStream()`，所以 Python 侧必须在 `torch.npu.stream(...)` 上下文里调用才会落到专用流。

## csrc/torch_binding.cpp#L177-L231

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
#endif
```

两条路径的分支：CANN 8.5+ 编译出 `CANN_MEMCPY_BATCH_ASYNC` 时把 n 条拷贝合成**一次** `aclrtMemcpyBatchAsync` 下发。

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

回退路径：逐条 `aclrtMemcpyAsync`，n 次下发。这是「描述符条数」直接变成下发开销的地方。

## csrc/torch_binding.cpp#L2119-L2123

```cpp
    // swap_blocks_batch takes CPU tensors (int64 pointer/size arrays), not NPU
    // tensors, so dispatch must be registered on the CPU backend. The function
    // internally submits async memcpy on the current NPU stream.
    ops.def("swap_blocks_batch(Tensor x, Tensor y, Tensor z, int direction) -> ()");
    ops.impl("swap_blocks_batch", torch::kCPU, &vllm_ascend::swap_blocks_batch);
```

算子注册在 CPU backend 上——因为它的三个入参是指针/长度数组而非 KV 张量本身。

## vllm_ascend/utils.py#L1167-L1180

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

昇腾侧 `block_size` 默认 128，「拿真实数字走一遍」的每块 token 数以此为准。
