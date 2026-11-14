# Layerwise KV Offload —— 引用片段

对照 ref：`vllm-ascend@28bf3a2e`（main）与 `vllm-ascend@2c59ff10`（releases/v0.23.0）。

## vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L14-L36

```markdown
## How It Works (Brief)

Without layerwise mode, the KV cache for a request is saved to (or loaded from)
the pool as one bulk operation after the full forward pass completes (or before
it starts). For long prompts this bulk transfer introduces a serialization
stall.

Layerwise mode splits the save/load at the layer granularity:

1. **Saving** (producer / kv_both): after computing layer *i*'s attention, the
   KV for that layer is immediately sent to the pool backend. The next layer's
   computation proceeds in parallel with the transfer.
2. **Loading** (consumer / kv_both): before computing layer *i*'s attention, the
   system waits for layer *i*'s KV to arrive from the pool
   (`wait_for_layer_load`), then proceeds. The transfer of layer *i+1* overlaps
   with the attention computation of layer *i*.

The net effect: save/load latency is amortized across the forward pass rather
than concentrated as a single blocking step.
```

官方对「为什么要按层切」的表述，用于 `## 为什么需要它`。

## vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L77-L88

```markdown
| `use_layerwise` | `false` | Enable layer-by-layer KV save/load. Requires `backend: "memcache"`. |
| `backend` | `"mooncake"` | Storage backend. Layerwise currently supports `"memcache"` only. |
| `mooncake_rpc_port` | `"0"` | RPC port for the scheduler↔worker lookup service. Use `"0"` to auto-assign, or a unique port per instance. |
| `layerwise_prefetch_layers` | `1` | Number of layers to prefetch ahead of the compute frontier. Higher values improve overlap at the cost of memory. |
| `layerwise_max_transfer_blocks` | `0` (unlimited) | Maximum number of KV blocks per transfer batch. |
| `layerwise_max_transfer_bytes` | `0` (unlimited) | Maximum bytes per transfer batch. |
| `h2d_stagger_us` | `0` | Stagger delay (microseconds) between H2D copies across TP ranks to avoid bus contention. |
| `discard_partial_chunks` | `true` (non-layerwise) / `false` (layerwise) | Whether to discard KV for incomplete chunk boundaries. Layerwise defaults to `false` to preserve partial layers. |
```

参数默认值的官方说法；其中 `layerwise_prefetch_layers` 默认 `1` 与 main 源码不一致，用于 `## 常见误解`。

## vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L220-L245

```markdown
## Supported Models

Layerwise mode integrates with the **MLA** (`mla_v1`) and **SFA** (`sfa_v1`)
attention backends. DeepSeek-V2/V3 and other MLA-based models are supported.

Basic full attention (`attention_v1`) and all context-parallel (CP) variants
(`mla_cp`, `sfa_cp`, `attention_cp`) do **not** yet integrate the layerwise
wait/save calls. Layerwise + CP is future work.

## Limitations

* **Backend**: Only `memcache` is supported for layerwise mode (`mooncake` and
  `yuanrong` do not support `use_layerwise`).
* **Hybrid KV cache**: Not supported — layerwise raises
  `NotImplementedError` when the model has multiple KV cache group families
  (hybrid MLA + sliding-window attention).
* **Context parallel**: Layerwise is not yet integrated with CP attention
  backends.
* **PD disaggregation proxy**: When using `kv_producer` / `kv_consumer`, the
  dedicated layerwise proxy
  (`load_balance_proxy_layerwise_server_example.py`) is required — the standard
  disagg proxy does not serve the `/v1/metaserver` endpoint.
```

适用模型与限制的官方说法；其中 CP 一条与 `dsa_cp.py` 的实际代码不符，用于 `## 常见误解`。

## vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L75-L84

```markdown
| Parameter | Default | Description |
| :--- | :--- | :--- |
| `use_layerwise` | `false` | Enable layer-by-layer KV save/load. Requires `backend: "memcache"`. |
| `backend` | `"mooncake"` | Storage backend. Layerwise currently supports `"memcache"` only. |
| `mooncake_rpc_port` | `"0"` | RPC port for the scheduler↔worker lookup service. Use `"0"` to auto-assign, or a unique port per instance. |
| `layerwise_prefetch_layers` | `1` | Number of layers to prefetch ahead of the compute frontier. Higher values improve overlap at the cost of memory. |
| `layerwise_max_transfer_blocks` | `0` (unlimited) | Maximum number of KV blocks per transfer batch. |
| `layerwise_max_transfer_bytes` | `0` (unlimited) | Maximum bytes per transfer batch. |
| `h2d_stagger_us` | `0` | Stagger delay (microseconds) between H2D copies across TP ranks to avoid bus contention. |
```

v0.23.0 的同一张表，用来确认两版文档在这批参数上一致（v0.23.0 无 `layerwise_num_shared_buffers` 一类条目）。

## vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L144-L196

```markdown
## 2. Layerwise KV Cache Offload on Prefill

Use this mode on a dedicated Prefill node with:

- `kv_role: "kv_producer"`;
- the Memcache backend;
- an MLA, SFA, or DSA attention backend; and
- eager execution.

For a combined deployment, Prefill TP must be greater than or equal to Decode
TP and divisible by it.

Add the following options to the Prefill launch command. `MultiConnector` lets
`AscendStoreConnector` offload layer buffers to Memcache while
`SfaRemoteD2HConnector` exposes the same buffers to Decode:

```bash
--enforce-eager \
--kv-transfer-config '{
    "kv_connector": "MultiConnector",
    "kv_role": "kv_producer",
    "kv_connector_extra_config": {
        "connectors": [
            {
                "kv_connector": "SfaRemoteD2HConnector",
                "kv_role": "kv_producer",
                "kv_connector_extra_config": {
                    "transfer_backend": "memfabric"
                }
            },
            {
                "kv_connector": "AscendStoreConnector",
                "kv_role": "kv_producer",
                "kv_connector_extra_config": {
                    "backend": "memcache",
                    "use_layerwise": true,
                    "layerwise_num_shared_buffers": 3,
                    "layerwise_independent_layers": [0]
                }
            }
        ]
    }
}'
```

Do not set `sparse_kv_offload_config` on Prefill. The
`AscendStoreConnector` entry uses the following buffer options:

| Parameter | Description |
| :--- | :--- |
| `layerwise_num_shared_buffers` | Number of reusable NPU buffers. Start with two to four and tune for memory and transfer bandwidth. |
| `layerwise_independent_layers` | Layers that keep dedicated buffers. The default is `[0]`; `"all"` disables cross-layer reuse. |
```

main 独有文档，给出共享 buffer 复用的完整配置样例与两个新参数的语义。

## vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L260-L268

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

共享 buffer 复用的互斥与前提条件。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/utils.py#L473-L501

```python
def wait_for_kv_layer_from_connector(layer_name: str):
    if not has_kv_transfer_group() or not is_v1_kv_transfer_group():
        return

    connector = get_kv_transfer_group()

    forward_context: ForwardContext = get_forward_context()
    attn_metadata = forward_context.attn_metadata
    if attn_metadata is None:
        return
    # TODO: assert ascendMetadata
    connector.wait_for_layer_load(layer_name)


def maybe_save_kv_layer_to_connector(
    layer_name: str,
    kv_cache_layer: list[torch.Tensor],
):
    if not has_kv_transfer_group() or not is_v1_kv_transfer_group():
        return

    connector = get_kv_transfer_group()

    forward_context: ForwardContext = get_forward_context()
    attn_metadata = forward_context.attn_metadata
    if attn_metadata is None:
        return
    # TODO: assert ascendMetadata
    connector.save_kv_layer(layer_name, kv_cache_layer, attn_metadata)
```

注意力后端与 connector 之间的两个逐层挂钩点；v0.23.0 同文件 `#L428` / `#L442` 处代码等价。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/mla_v1.py#L1898-L1913

```python
        decode_preprocess_res = None
        prefill_preprocess_res = None
        if has_prefill:
            wait_for_kv_layer_from_connector(layer_name)
        # Preprocess for decode tokens
        if has_decode:
            decode_preprocess_res = self.mla_preprocess_decode(q_c, kv_no_split, kv_cache, attn_metadata)
        # Preprocess for prefill tokens
        if has_prefill:
            prefill_preprocess_res = self.mla_preprocess_prefill(q_c, kv_no_split, kv_cache, attn_metadata)
        # Let the connector record any sync primitive it needs once the paged KV
        # cache for this layer has been written. No-op for connectors that don't
        # implement on_kv_cache_written; the decision to actually transfer is made
        # by the connector/scheduler, not here.
        notify_kv_cache_written(layer_name)
        return decode_preprocess_res, prefill_preprocess_res
```

等待点的精确位置：只在 `has_prefill` 时等；v0.23.0 同文件 `#L1680-L1693` 处代码等价。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/mla_v1.py#L2013-L2020

```python
        if gate is not None:
            o_proj_input.mul_(torch.sigmoid(gate))
        # O proj
        output[...] = self.o_proj(o_proj_input, is_prefill=prefill_preprocess_res is not None)[0]

        del o_proj_input
        maybe_save_kv_layer_to_connector(layer_name, list(kv_cache))
        return output_padded
```

保存点在本层 `o_proj` 之后、返回之前；v0.23.0 同文件 `#L1806` 处代码等价。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/attention_fence.py#L27-L61

```python
class AttentionComputeStartGate:
    """Gate that opens when the compute stream reaches attention.

    The attention worker records an NPU event immediately before submitting the
    attention op. MemCache worker threads wait for that event to complete before
    submitting H2D/L2G work, so transfer starts when the compute stream is
    actually at the attention boundary rather than merely after the Python call
    site was reached.
    """

    def __init__(self) -> None:
        self._condition = threading.Condition()
        self._event: torch.npu.Event | None = None

    def record(
        self,
        stream: torch.npu.Stream | None = None,
    ) -> None:
        stream = stream or torch.npu.current_stream()
        event = torch.npu.Event()
        event.record(stream)
        with self._condition:
            if self._event is None:
                self._event = event
                self._condition.notify_all()

    def wait(self, timeout: float = 10.0) -> bool:
        with self._condition:
            while self._event is None:
                if not self._condition.wait(timeout=timeout):
                    return False
            event = self._event

        event.synchronize()
        return True
```

main 上的计算流栅栏：预取线程靠它对齐到 attention 算子真正下发的时刻。

## vllm-ascend@2c59ff10:vllm_ascend/memcache_comm_fence.py#L27-L61

```python
class AttentionComputeStartGate:
    """Gate that opens when the compute stream reaches attention.

    The attention worker records an NPU event immediately before submitting the
    attention op. MemCache worker threads wait for that event to complete before
    submitting H2D/L2G work, so transfer starts when the compute stream is
    actually at the attention boundary rather than merely after the Python call
    site was reached.
    """

    def __init__(self) -> None:
        self._condition = threading.Condition()
        self._event: torch.npu.Event | None = None

    def record(
        self,
        stream: torch.npu.Stream | None = None,
    ) -> None:
        stream = stream or torch.npu.current_stream()
        event = torch.npu.Event()
        event.record(stream)
        with self._condition:
            if self._event is None:
                self._event = event
                self._condition.notify_all()

    def wait(self, timeout: float = 10.0) -> bool:
        with self._condition:
            while self._event is None:
                if not self._condition.wait(timeout=timeout):
                    return False
            event = self._event

        event.synchronize()
        return True
```

v0.23.0 上同一个类，只是模块路径不同（`vllm_ascend/memcache_comm_fence.py`），代码逐字相同。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1618-L1664

```python
    def _submit_ready_layer_loads(self) -> None:
        assert self.kv_recv_thread is not None
        recv_thread = self.kv_recv_thread

        def submit_layer_load(layer_id: int) -> bool:
            reuse_source = self.prefetch_layer_map.get(layer_id)
            if not self.layer_load_tasks[layer_id] and reuse_source is None:
                return False
            attention_start_gate = None
            if self.layer_load_tasks[layer_id] and layer_id != self.current_layer:
                attention_start_gate = get_attention_compute_start_gate()
            recv_thread.add_request(
                LayerLoadTask(  # type: ignore[arg-type]
                    wait_for_save_layer=reuse_source,
                    transfer_tasks=self.layer_load_tasks[layer_id],
                    layer_id=layer_id,
                    attention_start_gate=attention_start_gate,
                )
            )
            return True

        submit_count = self.num_prefetch_layers if self.current_layer == 0 else 1
        submitted_layers = 0
        while submitted_layers < submit_count and self.next_layer_to_submit < self.num_layers:
            layer_id = self.next_layer_to_submit
            self.next_layer_to_submit += 1
            if submit_layer_load(layer_id):
                submitted_layers += 1

    def wait_for_layer_load(self) -> None:
        if self.current_layer >= self.num_layers:
            return
        assert self.layer_load_finished_events is not None
        assert self.kv_recv_thread is not None
        self.kv_recv_thread.raise_if_failed()
        reset_attention_compute_start_gate()
        self._submit_ready_layer_loads()
        should_wait = bool(self.layer_load_tasks[self.current_layer]) or self.current_layer in self.prefetch_layer_map
        if not should_wait:
            self.layer_load_finished_events[self.current_layer].clear()
            if self.external_slot_release_waiter is not None:
                self.external_slot_release_waiter(self.current_layer)
            return
        while not self.layer_load_finished_events[self.current_layer].wait(timeout=10):
            self.kv_recv_thread.raise_if_failed()
            logger.info("Layerwise %d load not done, keep waiting", self.current_layer)
        self.layer_load_finished_events[self.current_layer].clear()
```

main 的加载侧：首层一次提交 `num_prefetch_layers` 个任务、之后每层补一个；超时后循环继续等。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1672-L1699

```python
    def save_kv_layer(self, connector_metadata: AscendConnectorMetadata) -> None:
        if self.current_layer >= self.num_layers:
            return
        assert self.sync_save_events is not None
        assert self.layer_save_finished_events is not None
        assert self.kv_send_thread is not None
        send_thread = self.kv_send_thread
        send_thread.raise_if_failed()
        self.sync_save_events[self.current_layer].record()
        if self.layer_save_tasks[self.current_layer]:
            for task in self.layer_save_tasks[self.current_layer]:
                for block_range in task.block_ranges:
                    send_thread.add_stored_request(block_range.request.req_id)
            send_thread.add_request(self.layer_save_tasks[self.current_layer])  # type: ignore[arg-type]
        else:
            self.layer_save_finished_events[self.current_layer].set()
        if self.current_layer == self.num_layers - 1:
            while not self.layer_save_finished_events[self.num_layers - 1].wait(timeout=10):
                send_thread.raise_if_failed()
                logger.info("Layerwise %d save not done, keep waiting", self.current_layer)
            reuse_source_layers = set(self.prefetch_layer_map.values())
            for layer_id in range(self.num_layers):
                if layer_id in reuse_source_layers:
                    continue
                if self.layer_save_finished_events[layer_id].is_set():
                    self.layer_save_finished_events[layer_id].clear()

        self.current_layer = self.current_layer + 1
```

main 的保存侧：本层录 NPU Event 后立即投递、不阻塞；只有最后一层做一次整体收口。

## vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1356-L1399

```python
    def _submit_ready_layer_loads(self) -> None:
        assert self.kv_recv_thread is not None
        recv_thread = self.kv_recv_thread

        def submit_layer_load(layer_id: int) -> bool:
            if not self.layer_load_tasks[layer_id]:
                return False
            wait_for_save_layer = None
            attention_start_gate = None
            if layer_id != self.current_layer:
                attention_start_gate = get_attention_compute_start_gate()
            recv_thread.add_request(
                LayerLoadTask(  # type: ignore[arg-type]
                    wait_for_save_layer=wait_for_save_layer,
                    transfer_tasks=self.layer_load_tasks[layer_id],
                    layer_id=layer_id,
                    attention_start_gate=attention_start_gate,
                )
            )
            return True

        submit_count = self.num_prefetch_layers if self.current_layer == 0 else 1
        submitted_layers = 0
        while submitted_layers < submit_count and self.next_layer_to_submit < self.num_layers:
            layer_id = self.next_layer_to_submit
            self.next_layer_to_submit += 1
            if submit_layer_load(layer_id):
                submitted_layers += 1

    def wait_for_layer_load(self) -> None:
        if self.current_layer >= self.num_layers:
            return
        assert self.layer_load_finished_events is not None
        reset_attention_compute_start_gate()
        self._submit_ready_layer_loads()
        should_wait = bool(self.layer_load_tasks[self.current_layer])
        if not should_wait:
            self.layer_load_finished_events[self.current_layer].clear()
            return
        is_finish = self.layer_load_finished_events[self.current_layer].wait(timeout=10)
        if not is_finish:
            logger.info("Layerwise %d load wait timed out", self.current_layer)
        logger.debug(">>>>>>>>>>>>>>>>>>>> clear load layer %d", self.current_layer)
        self.layer_load_finished_events[self.current_layer].clear()
```

v0.23.0 的加载侧：`wait_for_save_layer` 恒为 `None`（无 buffer 复用），且超时 10 秒后直接放行。

## vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1407-L1430

```python
    def save_kv_layer(self, connector_metadata: AscendConnectorMetadata) -> None:
        if self.current_layer >= self.num_layers:
            return
        assert self.sync_save_events is not None
        assert self.layer_save_finished_events is not None
        assert self.kv_send_thread is not None
        send_thread = self.kv_send_thread
        self.sync_save_events[self.current_layer].record()
        if self.layer_save_tasks[self.current_layer]:
            for task in self.layer_save_tasks[self.current_layer]:
                for block_range in task.block_ranges:
                    send_thread.add_stored_request(block_range.request.req_id)
            send_thread.add_request(self.layer_save_tasks[self.current_layer])  # type: ignore[arg-type]
        else:
            self.layer_save_finished_events[self.current_layer].set()
        if self.current_layer == self.num_layers - 1:
            is_finish = self.layer_save_finished_events[self.num_layers - 1].wait(timeout=10)
            if not is_finish:
                logger.info("Layerwise %d save wait timed out", self.current_layer)
            for layer_id in range(self.num_layers):
                if self.layer_save_finished_events[layer_id].is_set():
                    self.layer_save_finished_events[layer_id].clear()

        self.current_layer = self.current_layer + 1
```

v0.23.0 的保存侧：结构与 main 相同，差别在超时后不再重试、且清事件时不跳过复用源层。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1358-L1372

```python
        if has_any_save:
            self.sync_save_events[physical_layer].synchronize()
            gvas_array = np.concatenate(all_gvas) if len(all_gvas) > 1 else all_gvas[0]
            addr_array = np.concatenate(all_addrs) if len(all_addrs) > 1 else all_addrs[0]
            size_array = np.concatenate(all_sizes) if len(all_sizes) > 1 else all_sizes[0]
            res = self._batch_copy_with_limits(
                gvas_array,
                addr_array,
                size_array,
                0,
                self.max_transfer_blocks,
                self.max_transfer_bytes,
            )
            if res != 0:
                raise RuntimeError(f"Layerwise {physical_layer} save batch_copy failed with return code {res}")
```

`KVCacheStoreLayerSendingThread` 在真正搬运前对本层的 NPU Event 做 `synchronize()`——这是 D2H 侧的关键同步点。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1481-L1536

```python
    def _handle_request(  # type: ignore[override]
        self, data: LayerLoadTask
    ):
        wait_for_save = data.wait_for_save_layer
        transfer_tasks = data.transfer_tasks
        layer_id = data.layer_id
        attention_start_gate = data.attention_start_gate

        if wait_for_save is not None:
            while not self.layer_save_finished_events[wait_for_save].wait(timeout=10):
                if self.save_failure_checker is not None:
                    self.save_failure_checker()
                logger.info("Layerwise %d save wait timed out, keep waiting before load", wait_for_save)
            if self.save_failure_checker is not None:
                self.save_failure_checker()
            # Non-saving TP ranks have no D2H task to synchronize the event.
            # Their CPU save-finished signal only means the event was recorded;
            # wait for the NPU work before reusing the local HBM buffer.
            self.sync_save_events[wait_for_save].synchronize()
            logger.debug("Layer save event cleared: layer %d", wait_for_save)
            self.layer_save_finished_events[wait_for_save].clear()

        if len(transfer_tasks) == 0:
            if self.external_slot_release_waiter is not None:
                self.external_slot_release_waiter(layer_id)
            assert not self.layer_load_finished_events[layer_id].is_set()
            logger.debug("Layer load event set: layer %d", layer_id)
            self.layer_load_finished_events[layer_id].set()
            self.request_queue.task_done()
            return

        # Build req_meta for all tasks first; if all are None, early return.
        task_metas: list[tuple[LayerTransferTask, LayerBatchReqMeta]] = []
        for task in transfer_tasks:
            shared = task.shared_block_data
            builder = self.group_builders[task.group_id] if self.group_builders else self.layer_batch_builder
            if shared is not None:
                req_meta: LayerBatchReqMeta | None = builder.build_addrs(shared, task.layer_idx_in_group)
            else:
                req_meta = builder.build(task, is_save=False)
            if req_meta is not None:
                task_metas.append((task, req_meta))

        if not task_metas:
            if self.external_slot_release_waiter is not None:
                self.external_slot_release_waiter(layer_id)
            assert not self.layer_load_finished_events[layer_id].is_set()
            logger.debug("Layer load event set: layer %d", layer_id)
            self.layer_load_finished_events[layer_id].set()
            self.request_queue.task_done()
            return

        if attention_start_gate is not None:
            while not attention_start_gate.wait(timeout=10):
                logger.info("Layerwise %d load waits for attention compute start", layer_id)
```

`KVCacheStoreLayerRecvingThread` 的三个同步点：等复用源层落盘、等该层 NPU Event、等计算流到达 attention。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1467-L1479

```python
    def _get_h2d_stagger_delay_us(self, layer_id: int) -> int:
        if self.h2d_stagger_us <= 0:
            return 0
        slot = (self.tp_rank + layer_id) % self.tp_size
        return slot * self.h2d_stagger_us

    def _stagger_h2d_submit(self, layer_id: int) -> None:
        delay_us = self._get_h2d_stagger_delay_us(layer_id)
        if delay_us <= 0:
            return
        deadline = time.perf_counter() + delay_us / 1_000_000
        while time.perf_counter() < deadline:
            pass
```

`h2d_stagger_us` 的实际公式：错开量 = `(tp_rank + layer_id) % tp_size * h2d_stagger_us`，且用忙等实现。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L114-L134

```python
def build_layerwise_cache_layout(
    num_layers: int,
    extra_config: dict[str, Any] | None = None,
) -> LayerwiseCacheLayout:
    shared_buffers_value = extra_config.get(_NUM_SHARED_BUFFERS) if extra_config else None
    if shared_buffers_value is None:
        if num_layers < 1:
            raise ValueError("num_layers must be at least 1")
        num_shared_buffers = num_layers
    else:
        num_shared_buffers = _parse_int_config(shared_buffers_value, _NUM_SHARED_BUFFERS)
        if num_shared_buffers < 1:
            raise ValueError(f"{_NUM_SHARED_BUFFERS} must be at least 1")

    prefetch_value = extra_config.get(_PREFETCH_LAYERS) if extra_config else None
    if prefetch_value is None:
        num_prefetch_layers = min(num_shared_buffers, _DEFAULT_MAX_PREFETCH_LAYERS)
    else:
        num_prefetch_layers = _parse_int_config(prefetch_value, _PREFETCH_LAYERS)
        if num_prefetch_layers < 1:
            raise ValueError(f"{_PREFETCH_LAYERS} must be at least 1")
```

main 上两个默认值的真实来源：`layerwise_num_shared_buffers` 缺省等于层数，`layerwise_prefetch_layers` 缺省等于 `min(num_shared_buffers, 8)`（`_DEFAULT_MAX_PREFETCH_LAYERS = 8`，同文件 `#L20`）。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L136-L178

```python
    independent_value = extra_config.get(_INDEPENDENT_LAYERS) if extra_config else None
    if independent_value is None:
        layer_indices = [0]
    elif isinstance(independent_value, str) and independent_value.strip().lower() == "all":
        layer_indices = list(range(num_layers))
    elif isinstance(independent_value, list):
        layer_indices = [_parse_int_config(index, _INDEPENDENT_LAYERS) for index in independent_value]
    else:
        raise TypeError(f"{_INDEPENDENT_LAYERS} must be a list of integers or 'all'")

    normalized_indices = set()
    for layer_index in layer_indices:
        if layer_index < 0:
            layer_index += num_layers
        if layer_index < 0 or layer_index >= num_layers:
            raise ValueError(
                f"{_INDEPENDENT_LAYERS} contains out-of-range layer index "
                f"{layer_index}; valid range is [0, {num_layers - 1}]"
            )
        normalized_indices.add(layer_index)
    independent_layers = sorted(normalized_indices)

    independent_layer_set = set(independent_layers)
    reused_layers = [index for index in range(num_layers) if index not in independent_layer_set]
    has_layer_reuse = len(reused_layers) > num_shared_buffers
    prefetch_layer_map = {
        reused_layers[next_index]: reused_layers[next_index - num_shared_buffers]
        for next_index in range(num_shared_buffers, len(reused_layers))
    }
    storage_indices = [[layer] for layer in independent_layers]
    for slot in range(num_shared_buffers):
        members = list(range(slot, len(reused_layers), num_shared_buffers))
        if members:
            storage_indices.append([reused_layers[index] for index in members])

    return LayerwiseCacheLayout(
        num_shared_buffers=num_shared_buffers,
        num_prefetch_layers=num_prefetch_layers,
        independent_layers=independent_layers,
        prefetch_layer_map=prefetch_layer_map,
        storage_indices=storage_indices,
        has_layer_reuse=has_layer_reuse,
    )
```

`## 拿真实数字走一遍` 直接复算的就是这段：`prefetch_layer_map` 与 `storage_indices` 的构造。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L341-L357

```python
    new_tensors: list[KVCacheTensor] = []
    for slot in reuse_layout.buffer_slots:
        _merge_specs([reuse_layout.layer_cache_specs[layer].main for layer in slot])
        indexer_specs: list[NamedKVCacheSpec] = []
        for layer in slot:
            indexer = reuse_layout.layer_cache_specs[layer].indexer
            if indexer is not None:
                indexer_specs.append(indexer)
        if indexer_specs:
            _merge_specs(indexer_specs)
    kv_cache_config.kv_cache_tensors = new_tensors
    logger.info(
        "Layerwise KV cache reuse merged %d descriptors into %d descriptors using %d buffer assignments.",
        len(old_tensors),
        len(new_tensors),
        len(reuse_layout.buffer_slots),
    )
```

显存怎么省下来的：同一 slot 的各层被合并成一个 `KVCacheTensor`，`shared_by` 列出共用它的层名；这也是文档里那条确认日志的出处。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L76-L115

```python
class AscendStoreConnector(KVConnectorBase_V1, SupportsHMA):
    @classmethod
    def requires_piecewise_for_cudagraph(cls, extra_config: dict[str, Any]) -> bool:
        """
        AscendStore requires PIECEWISE CUDA graph mode when layerwise
        operations are enabled.
        """
        return extra_config.get("use_layerwise", False)

    def __init__(self, vllm_config: VllmConfig, role: KVConnectorRole, kv_cache_config: KVCacheConfig | None = None):
        super().__init__(vllm_config=vllm_config, role=role, kv_cache_config=kv_cache_config)
        self.kv_role = vllm_config.kv_transfer_config.kv_role

        extra_config = vllm_config.kv_transfer_config.kv_connector_extra_config
        self.use_layerwise = extra_config.get("use_layerwise", False)
        self.consumer_is_to_put = extra_config.get("consumer_is_to_put", False)

        connector_name = vllm_config.kv_transfer_config.kv_connector
        if connector_name == "MooncakeConnectorStoreV1":
            logger.warning(
                "It is recommended to use the AscendStoreConnector, "
                "as the MoonCakeStoreConnector will be removed in the future."
            )

        self._kv_cache_events: AscendStoreKVEvents | None = None

        self._current_step_has_real_forward = False

        if role == KVConnectorRole.SCHEDULER:
            assert kv_cache_config is not None
            self.connector_scheduler = KVPoolScheduler(vllm_config, self.use_layerwise, kv_cache_config)
        else:
            self.connector_worker = KVPoolWorker(
                vllm_config,
                self.use_layerwise,
                kv_cache_config,
            )
            assert self.connector_worker is not None
            if not self.use_layerwise and vllm_config.parallel_config.rank == 0:
                self.lookup_server = LookupKeyServer(self.connector_worker, vllm_config)
```

`use_layerwise` 的读取点，以及它强制 PIECEWISE 图模式；v0.23.0 同文件 `#L78` 处有同名 classmethod。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L227-L251

```python
    def wait_for_layer_load(self, layer_name: str) -> None:
        if not self.use_layerwise:
            return
        self.connector_worker.wait_for_layer_load()

    def save_kv_layer(
        self, layer_name: str, kv_layer: torch.Tensor, attn_metadata: "AttentionMetadata", **kwargs
    ) -> None:
        if not self.use_layerwise:
            return

        if self.kv_role == "kv_consumer" and not self.consumer_is_to_put:
            # A load-only consumer does not publish KV.
            return
        self.connector_worker.save_kv_layer(self._get_connector_metadata())

    def wait_for_save(self):
        if self.kv_role == "kv_consumer" and not self.consumer_is_to_put:
            # Don't do save if the role is kv_consumer
            return

        if self.use_layerwise:
            return

        self.connector_worker.wait_for_save(self._get_connector_metadata())
```

开关生效的位置，以及 layerwise 与整体 `wait_for_save` 的互斥关系：开了 layerwise，步末的整体收口就直接返回。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L226-L241

```python
        self.peer_tp_size = tp_mismatch_info.peer_tp_size
        self.effective_tp_size = tp_mismatch_info.effective_tp_size
        self.tp_mismatch = tp_mismatch_info.enabled
        if self.tp_mismatch:
            if self.use_sparse:
                raise ValueError(
                    f"TP mismatch (local_tp={self.tp_size}, peer_tp={self.peer_tp_size}) "
                    "is not supported with sparse KV layouts (use_sparse=True). "
                    "Strided I/O requires uniform block_len across all cache entries."
                )
            if self.use_layerwise:
                raise ValueError(
                    f"TP mismatch (local_tp={self.tp_size}, peer_tp={self.peer_tp_size}) "
                    "is not supported with layerwise KV transfer (use_layerwise=True). "
                    "The layerwise threads do not implement TP-mismatch handling."
                )
```

layerwise 在源码里唯一一条硬报错的组合限制：P/D 两侧 TP 不一致。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L414-L434

```python
        self.next_layer_to_submit = 0
        self.layerwise_offload = False
        self.independent_layers: list[int] = []
        self.prefetch_layer_map: dict[int, int] = {}
        if self.use_gva_layerwise:
            if self._layerwise_reuse_layout is None:
                cache_layout = build_layerwise_cache_layout(
                    self.num_layers,
                    self._extra_config,
                )
                self.layerwise_offload = cache_layout.has_layer_reuse
                self.independent_layers = cache_layout.independent_layers
                self.prefetch_layer_map = cache_layout.prefetch_layer_map
                self.num_prefetch_layers = cache_layout.num_prefetch_layers
            else:
                self.layerwise_offload = self._layerwise_reuse_layout.has_layer_reuse
                self.independent_layers = self._layerwise_reuse_layout.independent_layers
                self.prefetch_layer_map = self._layerwise_reuse_layout.prefetch_layer_map
                self.num_prefetch_layers = self._layerwise_reuse_layout.num_prefetch_layers
        else:
            self.num_prefetch_layers = int(self._extra_config.get("layerwise_prefetch_layers", 1))
```

main 上 `num_prefetch_layers` 的两条来源；`use_gva_layerwise = use_layerwise and backend == "memcache"`（同文件 `#L157`），而 layerwise 只支持 memcache，所以实际走的是 layout 那条分支。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L3917-L3923

```python
        kv_cache_config = deepcopy(kv_cache_config)
        self.kv_cache_config = kv_cache_config
        self._mamba_bufs = None
        self._mamba_copy_bufs = None
        self.may_add_encoder_only_layers_to_kv_cache_config()
        apply_layerwise_kv_cache_plan(kv_cache_config, self.vllm_config)
        self.maybe_add_kv_sharing_layers_to_kv_cache_groups(kv_cache_config)
```

buffer 合并发生在 KV cache 真正分配之前（`initialize_kv_cache`），所以省下来的是真实 HBM。
