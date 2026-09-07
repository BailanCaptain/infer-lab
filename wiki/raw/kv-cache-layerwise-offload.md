# Layerwise KV Offload — 引用片段

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

官方特性文档对「逐层存/取如何与前向重叠」的定义，正文「是什么」一节据此写。

## docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L79-L88

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
| `discard_partial_chunks` | `true` (non-layerwise) / `false` (layerwise) | Whether to discard KV for incomplete chunk boundaries. Layerwise defaults to `false` to preserve partial layers. |
```

配置项与文档声称的默认值；正文「形状与数值」用它，并对照代码指出 `layerwise_prefetch_layers` 的默认值与代码不一致。

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

适用的注意力后端与限制；正文「在哪一步出现」「常见误解」引用，并与 `dsa_cp.py` 的实际调用对照。

## docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L144-L196

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

Prefill 侧逐层卸载的实际启动配置与共享缓冲区参数；正文「形状与数值」「在哪一步出现」引用。

## vllm_ascend/attention/utils.py#L473-L522

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

注意力后端与 connector 之间的三个逐层挂钩点；正文的调用链从这里开始。

## vllm_ascend/attention/mla_v1.py#L1898-L1913

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

MLA 后端里「等本层 KV 到位」的确切位置：只在有 prefill token 时等，等待发生在 preprocess 之前。

## vllm_ascend/attention/sfa_v1.py#L1694-L1700

```python
            output,
            parallel_context.gather_full_o_proj,
        )

        maybe_save_kv_layer_to_connector(layer_name, list(kv_cache))

        return output
```

SFA 后端里「本层算完立刻交给 connector 保存」的位置：在 o_proj 之后、返回之前。

## vllm_ascend/attention/context_parallel/dsa_cp.py#L1430-L1434

```python
        layer_metadata = self._get_layer_metadata(layer_name, attn_metadata)
        common_attn_metadata = layer_metadata.compressor_cache
        if common_attn_metadata is None:
            common_attn_metadata = layer_metadata.swa
        wait_for_kv_layer_from_connector(layer_name)
```

CP 变体 `dsa_cp` 实际已经调用了逐层等待，与文档「CP 变体尚未接入 layerwise wait/save」的说法不一致；正文「常见误解」据此提示。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L77-L83

```python
    @classmethod
    def requires_piecewise_for_cudagraph(cls, extra_config: dict[str, Any]) -> bool:
        """
        AscendStore requires PIECEWISE CUDA graph mode when layerwise
        operations are enabled.
        """
        return extra_config.get("use_layerwise", False)
```

开启 layerwise 后对图模式的约束（PIECEWISE），正文「常见误解」用它区分「必须 eager」这一说法。

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

    def wait_for_save(self, self_unused=None):
        if self.kv_role == "kv_consumer" and not self.consumer_is_to_put:
            # Don't do save if the role is kv_consumer
            return

        if self.use_layerwise:
            return

        self.connector_worker.wait_for_save(self._get_connector_metadata())
```

connector 层的分流：未开 layerwise 时两个逐层钩子直接返回；开了 layerwise 后步末的整批 `wait_for_save` 被跳过。（`wait_for_save` 的签名在原文件为 `def wait_for_save(self):`，此处仅为片段抄录时的笔误标注，见 L243。）

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L154-L157

```python
        self.consumer_is_to_put = extra_config.get("consumer_is_to_put", False)
        self.backend = extra_config.get("backend", "mooncake")
        self.backend_name = self.backend.lower()
        self.use_gva_layerwise = self.use_layerwise and self.backend_name == "memcache"
```

「layerwise 只支持 memcache」在代码里的落点：只有 memcache 后端才走 GVA 逐层路径。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L183-L185

```python
        self.h2d_stagger_us = int(extra_config.get("h2d_stagger_us", 0))
        self.layerwise_max_transfer_blocks = int(extra_config.get("layerwise_max_transfer_blocks", 0))
        self.layerwise_max_transfer_bytes = int(extra_config.get("layerwise_max_transfer_bytes", 0))
```

三个搬运节流参数的默认值（均为 0），正文「形状与数值」引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L236-L241

```python
            if self.use_layerwise:
                raise ValueError(
                    f"TP mismatch (local_tp={self.tp_size}, peer_tp={self.peer_tp_size}) "
                    "is not supported with layerwise KV transfer (use_layerwise=True). "
                    "The layerwise threads do not implement TP-mismatch handling."
                )
```

layerwise 与 P/D 两侧 TP 不一致互斥的硬约束。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L463-L492

```python
    def _start_kv_transfer_threads(self) -> None:
        if self._transfer_threads_started:
            return

        if self.use_layerwise:
            self.get_event = threading.Event()
            self.layer_load_finished_events = [threading.Event() for i in range(self.num_layers)]
            self.layer_save_finished_events = [threading.Event() for i in range(self.num_layers)]
            self.sync_save_events = [torch.npu.Event() for i in range(self.num_layers)]
            can_save = self.kv_role in ["kv_producer", "kv_both"] or self.consumer_is_to_put
            if self.use_gva_layerwise and can_save:
                ready_event_sending = threading.Event()
                self.kv_send_thread = KVCacheStoreLayerSendingThread(
                    self.m_store,
                    self.token_database,
                    self.block_size,
                    self.tp_rank,
                    self.tp_size,
                    self.dcp_size,
                    self.page_size_bytes,
                    ready_event_sending,
                    self.num_layers,
                    self.layer_save_finished_events,
                    self.sync_save_events,
                    self.layerwise_max_transfer_blocks,
                    self.layerwise_max_transfer_bytes,
                    group_builders=self._build_group_layer_builders(),
                )
                self.kv_send_thread.start()
                ready_event_sending.wait()
```

逐层模式下创建的同步对象与后台线程：每层各一个 `threading.Event`（load/save 完成）和一个 `torch.npu.Event`（save 的设备侧同步），发送/接收各一条 Python 线程。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1620-L1645

```python
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

预取的提交节奏：第 0 层一次性提交 `num_prefetch_layers` 个，之后每等一层就补提交一层；只有「未来层」的任务才挂 attention 门。

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

worker 侧的两个同步点本体：等待用 10 秒轮询的 `threading.Event`；保存先 `record()` 一个 NPU event 再把任务丢给发送线程，只有最后一层才阻塞等发送完成，`current_layer` 在这里推进。

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

重叠的关键同步原语：在计算流上记录一个 NPU event，搬运线程 `event.synchronize()` 后才发起 H2D，保证搬运真的和 attention 计算并行而不是抢在它前面。

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

`h2d_stagger_us` 的确切算法：错峰量 = `((tp_rank + layer_id) % tp_size) * h2d_stagger_us` 微秒，用忙等实现。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1484-L1501

```python
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

共享缓冲区带来的额外同步点：要往某个 buffer 里灌新层数据前，必须先等上一个占用该 buffer 的层保存完（CPU 事件 + NPU 事件都要等）。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1533-L1554

```python
        if attention_start_gate is not None:
            while not attention_start_gate.wait(timeout=10):
                logger.info("Layerwise %d load waits for attention compute start", layer_id)

        all_load_keys: list[str] = []
        all_req_ids: set[str] = set()
        last_chunk_req_ids: set[str] = set()
        all_gvas = []
        all_addrs = []
        all_sizes = []
        for task, req_meta in task_metas:
            if req_meta.load_keys:
                all_load_keys.extend(req_meta.load_keys)
            for req_id, is_last_chunk in zip(req_meta.req_ids, req_meta.is_last_chunks):
                all_req_ids.add(req_id)
                if is_last_chunk:
                    last_chunk_req_ids.add(req_id)
            all_gvas.append(req_meta.gvas_array)
            all_addrs.append(req_meta.addr_array)
            all_sizes.append(req_meta.size_array)

        self._stagger_h2d_submit(layer_id)
```

接收线程的完整顺序：等 attention 门 → 拼批 → 错峰 → 发起 `batch_copy`，正文「在哪一步出现」按这个顺序描述重叠。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L17-L21

```python
_NUM_SHARED_BUFFERS = "layerwise_num_shared_buffers"
_PREFETCH_LAYERS = "layerwise_prefetch_layers"
_INDEPENDENT_LAYERS = "layerwise_independent_layers"
_DEFAULT_MAX_PREFETCH_LAYERS = 8
_INDEXER_CACHE_SUFFIX = ".indexer.k_cache"
```

预取层数的代码上限常量 8，用于指出文档写的默认值 1 与代码不符。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L118-L164

```python
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
```

三个 buffer 参数的真实默认值与含义：不配 `layerwise_num_shared_buffers` 时等于层数（即不复用），预取层数默认 `min(shared_buffers, 8)`，独立层默认 `[0]`。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L245-L253

```python
    buffer_slots: list[tuple[int, ...]] = [(layer,) for layer in independent_layers]
    prefetch_layer_map: dict[int, int] = {}
    for _, bucket_layers in signature_buckets:
        num_shared_buffers = min(base_layout.num_shared_buffers, len(bucket_layers))
        for buffer_index in range(num_shared_buffers):
            layers_sharing_buffer = tuple(bucket_layers[buffer_index::num_shared_buffers])
            buffer_slots.append(layers_sharing_buffer)
            for owner_index in range(1, len(layers_sharing_buffer)):
                prefetch_layer_map[layers_sharing_buffer[owner_index]] = layers_sharing_buffer[owner_index - 1]
```

共享 buffer 的分配规则：层按 `buffer_index::num_shared_buffers` 轮转共用一块 HBM，`prefetch_layer_map[i]` 记录 i 必须等哪一层先保存完。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L341-L357

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

缓冲区复用是通过改写 `kv_cache_config.kv_cache_tensors`（多层共用一个 `KVCacheTensor`）实现的；文档里那条确认日志就是这里打出来的。

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

用来划清边界：Decode 侧的稀疏卸载是另一条独立数据面（另一页 `kv-cache-sparse-offload`），与本页的逐层存/取不是同一套机制。
