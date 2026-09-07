# Layerwise KV Offload — 源码片段

## docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L18-L36

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

「是什么」一节的定义来源：逐层保存/加载替代整包搬运，以及重叠的基本方向。

## docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L77-L88

```markdown
### Key Parameters

| Parameter | Default | Description |
| :--- | :--- | :--- |
| `use_layerwise` | `false` | Enable layer-by-layer KV save/load. Requires `backend: "memcache"`. |
| `backend` | `"mooncake"` | Storage backend. Layerwise currently supports `"memcache"` only. |
| `mooncake_rpc_port` | `"0"` | RPC port for the scheduler↔worker lookup service. Use `"0"` to auto-assign, or a unique port per instance. |
| `layerwise_prefetch_layers` | `1` | Number of layers to prefetch ahead of the compute frontier. Higher values improve overlap at the cost of memory. |
| `layerwise_max_transfer_blocks` | `0` (unlimited) | Maximum number of KV blocks per transfer batch. |
| `layerwise_max_transfer_bytes` | `0` (unlimited) | Maximum bytes per transfer batch. |
| `h2d_stagger_us` | `0` | Stagger delay (microseconds) between H2D copies across TP ranks to avoid bus contention. |
| `discard_partial_chunks` | `true` (non-layerwise) / `false` (layerwise) | Whether to discard KV for incomplete chunk boundaries. Layerwise defaults to `false` to preserve partial layers. |
```

「形状与数值」列配置项时引用；同时是「常见误解」中 `layerwise_prefetch_layers` 默认值与代码不一致的文档侧证据。

## docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L224-L245

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

「适用的模型与注意力类型」与限制清单的文档侧来源；也是「常见误解」中该清单已落后于代码的对照对象。

## docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L98-L146

````markdown
For a uniform cache layout:

```text
N = number of cache-bearing layers
I = number of independent layers
R = N - I
B = configured shared-buffer count

physical buffers = I + min(B, R)

main-KV NPU footprint ratio ~= physical buffers / N
```

The footprint ratio assumes a uniform cache layout with equal-size layer
buffers. It describes only main-KV storage and does not include the indexer or
other fixed NPU allocations.

Reusable layers are assigned to the shared buffers in round-robin order.
Layers with incompatible main KV specifications do not share a physical
buffer. MTP layers participate in the same planning. Optional indexer caches
follow their main buffer assignment and are allocated only where needed.

Before tensor descriptors are merged, the planner validates cache
specifications, tensor sizes, and optional indexer layouts. An incompatible
layout fails initialization instead of sharing incorrectly sized storage.

### Execution pipeline

For each layer:

1. load the cached prefix from Memcache when required;
2. wait until the target physical buffer is safe to overwrite;
3. run attention and update KV;
4. save the updated KV to host memory; and
5. prefetch a later layer while computation continues.

Multiple physical buffers let transfer and computation overlap. Prefill has
enough per-layer computation to hide much of the load and save latency, which
is why full-layer transfer is suitable for this stage.

### Reuse invariant

A physical buffer cannot be reused until every consumer of its previous
contents has finished. Its Memcache save must complete before reuse. In the
joint deployment, the Decode-side remote read must also complete.

The implementation tracks completion by physical storage slot rather than only
by logical layer name. This matters because several logical layers can refer to
the same NPU address.
````

「形状与数值」的 buffer 数量公式、「在哪一步出现」的五步流水线、以及复用不变式（buffer 释放条件）的来源。

## docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L192-L202

```markdown
Prefill uses `MultiConnector` to compose the Remote D2H completion provider and
`AscendStoreConnector`. `AscendMultiConnector` invokes the completion provider
first regardless of their order in the connector configuration. For every
layer buffer:

- AscendStore saves the layer to the Prefill host KV pool; and
- Remote D2H publishes source metadata and waits for Decode acknowledgements.

The buffer-reuse gate opens only after both paths finish. This prevents Prefill
from overwriting a shared physical buffer while Decode is still reading it.
```

说明与 `SfaRemoteD2HConnector` 联合部署时 buffer 释放需要两条路径都完成，对应正文中的外部释放门。

## docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L160-L196

````markdown
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
````

「形状与数值」里 B=3、I=[0] 的配置样例来源，以及 `--enforce-eager` 要求。

## vllm_ascend/attention/utils.py#L473-L521

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


def notify_kv_cache_written(layer_name: str = ""):
    """Notify the connector that the paged KV cache for ``layer_name`` has been
    written for the current step.

    The attention layer calls this unconditionally; each connector decides whether
    it needs to record a synchronization primitive (e.g. a compute-stream event
    later waited on by the resharding stream to overlap the outgoing KV copy).
    The AscendStore pool and SFA-PD connectors implement
    ``on_kv_cache_written`` to dispatch a layerwise save or PD-pull
    notification at scatter time. Other connectors can omit the hook.
    """
    if not has_kv_transfer_group() or not is_v1_kv_transfer_group():
        return

    connector = get_kv_transfer_group()
    on_kv_cache_written = getattr(connector, "on_kv_cache_written", None)
    if on_kv_cache_written is not None:
        on_kv_cache_written(layer_name)
```

注意力后端与 connector 之间的三个逐层钩子；正文「在哪一步出现」以此为调用链起点。

## vllm_ascend/attention/mla_v1.py#L1898-L1907

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
```

MLA 后端里 load 等待点的位置：只在 `has_prefill` 时调用，位于本层 preprocess 之前。

## vllm_ascend/attention/mla_v1.py#L2016-L2020

```python
        output[...] = self.o_proj(o_proj_input, is_prefill=prefill_preprocess_res is not None)[0]

        del o_proj_input
        maybe_save_kv_layer_to_connector(layer_name, list(kv_cache))
        return output_padded
```

MLA 后端里 save 触发点的位置：本层 o_proj 之后、返回之前。

## vllm_ascend/attention/mla_v1.py#L1356-L1362

```python
            "actual_seq_lengths": actual_seq_lengths_q,
            "actual_seq_lengths_kv": actual_seq_lengths_kv,
        }
        record_attention_compute_start()

        if self.head_padding > 0:
            query = torch.cat((q_nope, q_pe), dim=-1)
```

attention gate 的打开点：紧邻 `npu_fused_infer_attention_score` 之前记录 compute stream 事件。

## vllm_ascend/attention/dsa_v1.py#L1250-L1261

```python
        wait_for_kv_layer_from_connector(layer_name)
        cache_is_prepared = self._prepare_caches_before_attention(
            layer_name,
            hidden_states,
            kv_cache,
            attn_metadata,
        )
        if actual_tokens == 0:
            output.zero_()
            notify_kv_cache_written(layer_name)
            maybe_save_kv_layer_to_connector(layer_name, list(kv_cache))
            return output
```

证明 `dsa_v1` 同样接入了逐层 wait/save 钩子（文档「Supported Models」只列了 mla_v1 / sfa_v1）。

## vllm_ascend/attention/sfa_v1.py#L1546-L1551

```python
            if self.has_indexer:
                k_li, k_li_scale = self.indexer_select_pre_process(x=hidden_states, cos=cos, sin=sin)
            else:
                k_li, k_li_scale = None, None
            wait_for_kv_layer_from_connector(layer_name)

```

证明 SFA 后端接入逐层等待，且等待发生在 indexer 预处理之后。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/attention_fence.py#L27-L61

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

「stream 与同步点」的核心：预取线程不是等 Python 调用返回，而是等 compute stream 真正跑到 attention 边界的 NPU event。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L463-L471

```python
    def _start_kv_transfer_threads(self) -> None:
        if self._transfer_threads_started:
            return

        if self.use_layerwise:
            self.get_event = threading.Event()
            self.layer_load_finished_events = [threading.Event() for i in range(self.num_layers)]
            self.layer_save_finished_events = [threading.Event() for i in range(self.num_layers)]
            self.sync_save_events = [torch.npu.Event() for i in range(self.num_layers)]
```

三组每层同步原语：两组 CPU 线程事件 + 一组 NPU event，正文「同步点」按此列举。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1618-L1645

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
```

预取节奏：第 0 层一次投 `num_prefetch_layers` 个，之后每层补 1 个；`wait_for_save_layer` 即复用同一 buffer 的上一层。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1647-L1699

```python
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

    def get_block_ids_with_load_errors(self) -> set[int]:
        with self._invalid_block_ids_lock:
            invalid_blocks = self._invalid_block_ids.copy()
            self._invalid_block_ids.clear()
        return invalid_blocks

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

主机侧逐层状态机：load 侧阻塞等本层事件、save 侧只 record NPU event 后异步入队，只有最后一层才同步等待；`current_layer` 在 save 后自增。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L236-L247

```python
            if self.use_layerwise:
                raise ValueError(
                    f"TP mismatch (local_tp={self.tp_size}, peer_tp={self.peer_tp_size}) "
                    "is not supported with layerwise KV transfer (use_layerwise=True). "
                    "The layerwise threads do not implement TP-mismatch handling."
                )
            if self.use_hybrid:
                raise NotImplementedError(
                    f"TP mismatch (local_tp={self.tp_size}, peer_tp={self.peer_tp_size}) "
                    "is not yet supported with hybrid KV cache layouts (e.g. DSV4). "
                    "The strided I/O path assumes a single dense KV group."
                )
```

TP mismatch 与 layerwise 互斥的硬失败点，用于「常见误解」中区分 AscendStore 侧 TP 约束与 P/D 联合部署的 TP 比例要求。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1481-L1502

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
```

buffer 复用门的实现：接收线程在写目标 buffer 前，先等上一占用层的 CPU save 事件，再 `synchronize()` 该层的 NPU event。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1533-L1535

```python
        if attention_start_gate is not None:
            while not attention_start_gate.wait(timeout=10):
                logger.info("Layerwise %d load waits for attention compute start", layer_id)
```

预取线程在真正发起 H2D 前等待 attention gate，避免搬运抢在本层 attention 之前挤占带宽。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1467-L1479

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

`h2d_stagger_us` 的实际语义：按 `(tp_rank + layer_id) % tp_size` 错峰，且是忙等自旋。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1147-L1164

```python
        if key_list:
            exists_states = self.lookup(key_list)
            missing_indices = [index for index, exists in enumerate(exists_states) if not exists]
            keys_to_put = [key_list[index] for index in missing_indices]
            addrs_to_put = [addr_list[index] for index in missing_indices]
            sizes_to_put = [size_list[index] for index in missing_indices]
            if keys_to_put:
                self.sync_save_events[layer_id].synchronize()
                self.m_store.put(keys_to_put, addrs_to_put, sizes_to_put)

        if layer_id == self.final_layer_id:
            for req_id, is_last_chunk in zip(req_ids, is_last_chunks):
                if is_last_chunk and self.try_finish_and_delete_stored_request(req_id):
                    self.set_finished_request(req_id)

        assert not self.layer_save_finished_events[layer_id].is_set(), f"thread: {layer_id} save failed "
        logger.debug("Key-based layer save event set: layer %d", layer_id)
        self.layer_save_finished_events[layer_id].set()
```

发送线程侧的同步点：`put` 之前 `synchronize()` 本层 NPU event，确保 attention 已把 KV 写进 buffer；完成后 set CPU 事件。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L89-L102

```python
    for connector_config in connector_configs:
        if not isinstance(connector_config, dict):
            continue
        if connector_config.get("kv_connector") not in (
            "AscendStoreConnector",
            "MooncakeConnectorStoreV1",
        ):
            continue
        extra_config = connector_config.get("kv_connector_extra_config") or {}
        if str(extra_config.get("backend", "mooncake")).lower() == "memcache" and extra_config.get(
            "use_layerwise", False
        ):
            return extra_config
    return None
```

buffer 复用规划只在 `backend == "memcache"` 且 `use_layerwise` 同时成立时启用；也说明 `MultiConnector` 下会逐个子 connector 匹配。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L114-L134

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

配置默认值的代码真相：`layerwise_num_shared_buffers` 缺省等于层数（不复用），`layerwise_prefetch_layers` 缺省是 `min(shared_buffers, 8)` 而非文档写的 1。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L136-L178

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

round-robin 分配与 `prefetch_layer_map`（层 i 复用第 i−B 个可复用层的 buffer）的确切构造，是「形状与数值」中占用比公式的实现依据。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L76-L91

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
```

开关入口与图模式约束：开启 layerwise 时要求 PIECEWISE cudagraph（对应文档的 eager 要求）。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L227-L251

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

connector 侧的分发：`layer_name` 只用于开关判断，实际按 worker 内部的 `current_layer` 计数推进；layerwise 开启后整包 `wait_for_save` 直接短路。
