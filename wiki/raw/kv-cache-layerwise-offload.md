# raw: kv-cache-layerwise-offload

源仓库 `vllm-ascend@28bf3a2e`（ref `main`）。以下片段为原文照贴，未改动一字。

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

官方文档对「逐层」这件事的定义性描述，页面 `## 为什么需要它` 与 `## 一句话` 引用它说明动机（bulk 传输造成串行停顿）。

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

官方参数表。页面 `## 事实表` 的默认值一列与之对照，并指出 `layerwise_prefetch_layers` 在 memcache(GVA) 路径上的实际默认值与此表不一致。

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

官方给出的「适用的模型与注意力类型」与限制清单，页面 `## 事实表` 与 `## 常见误解` 引用。

## docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L12-L21

```markdown
## Supported Models

The combined deployment currently supports the following sparse-attention
model families:

- [GLM-5.1](../../tutorials/models/GLM5.md)
- [GLM-5.2](../../tutorials/models/GLM5.2.md)
- [DeepSeek-V3.2](../../tutorials/models/DeepSeek-V3.2.md)

Other sparse-attention models have not been validated.
```

共享缓冲区版 layerwise（Prefill 卸载 + 稀疏 Decode 组合部署）官方验证过的模型族，页面 `## 事实表` 引用。

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

共享缓冲区版的官方启动配置（含 `--enforce-eager`、MultiConnector 两个子 connector 的分工、两个缓冲区参数的含义）。页面 `## 拿真实数字走一遍` 的配置片段与 `## 开了的代价`/`## 事实表` 引用。

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

共享缓冲区版的限制清单，页面 `## 事实表` 与 `## 常见误解` 引用。

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

注意力层与 connector 之间的三个 hook。页面 `## 怎么工作` 的时序图以这三个函数为边界。

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

MLA 后端的等待点与写完通知点，且 `wait_for_kv_layer_from_connector` 只在 `has_prefill` 时调用。页面 `## 怎么工作` 与 `## 常见误解` 引用。

## vllm_ascend/attention/mla_v1.py#L2015-L2020

```python
        # O proj
        output[...] = self.o_proj(o_proj_input, is_prefill=prefill_preprocess_res is not None)[0]

        del o_proj_input
        maybe_save_kv_layer_to_connector(layer_name, list(kv_cache))
        return output_padded
```

MLA 后端的逐层保存点在 o_proj 之后。页面 `## 怎么工作` 引用。

## vllm_ascend/attention/sfa_v1.py#L1588-L1600

```python
                k_li, k_li_scale = None, None

            wait_for_kv_layer_from_connector(layer_name)

            kv_outputs = self.exec_kv(
                kv_no_split,
                cos,
                sin,
                kv_cache,
                parallel_context.kv_slot_mapping,
                attn_metadata,
            )
            k_pe, k_nope = kv_outputs[:2]
```

SFA 后端 native 预处理路径的等待点：等待本层 KV 到位后才写 `exec_kv`。页面 `## 怎么工作` 引用。

## vllm_ascend/attention/sfa_v1.py#L1650-L1659

```python

        # Notify for every layer that wrote the cache, not just indexer layers:
        # by this point all of the layer's KV (main + indexer) has been
        # scattered, so the connector can dispatch the PD pull immediately.
        notify_kv_cache_written(self.layer_name or "")

        # Open the prefetch gate for every SFA layer. Some GLM-5.2 layers
        # reuse cached top-k indices and have no indexer, so recording this
        # inside indexer_select_post_process would leave their gate closed.
        record_attention_compute_start()
```

SFA 后端在 scatter 完成后立刻通知 connector，并记录「计算流到达 attention」的事件。页面 `## 怎么工作` 的 `AttentionComputeStartGate` 一段引用。

## vllm_ascend/attention/sfa_v1.py#L1692-L1700

```python
        output = self._finalize_o_proj(
            attn_output,
            output,
            parallel_context.gather_full_o_proj,
        )

        maybe_save_kv_layer_to_connector(layer_name, list(kv_cache))

        return output
```

SFA 后端的逐层保存点。与 MLA 一致地位于该层输出投影之后。页面 `## 怎么工作` 引用。

## vllm_ascend/attention/sfa_kv_offload.py#L7-L17

```python
Data plane (see zsc-sfa-kv-offload-merge-plan.md):

- prefill (debug intermediate state, only reachable with
  ``keep_device_kv_cache=True``): ``exec_kv`` writes the NPU paged main
  cache as usual, then the layer's cache rows are committed D2H
  (``cache_cpu[slot] = cache_npu[slot]``) through the manager;
- decode: no NPU main K/V cache at all (indexer K cache only). The current
  token's K/V is produced compute-only and committed D2H directly; top-k
  misses are loaded H2D into the resident (topk) buffer and a single
  resident SFA attention runs.
```

说明组合部署里 Decode 侧走的是另一条数据面（稀疏 offload，无 NPU 主 KV cache），页面 `## 为什么需要它` 用它划清本页与 `kv-cache-sparse-offload` 的边界。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L77-L90

```python
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
```

`use_layerwise` 默认 `False`，以及开启后强制 PIECEWISE 图模式。页面 `## 事实表` 与 `## 开了的代价` 引用。

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

`use_layerwise` 是两条路径的唯一分叉点：开了走逐层 `wait_for_layer_load`/`save_kv_layer`，关了走整趟 `wait_for_save`。页面 `## 怎么工作` 引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L155-L157

```python
        self.backend = extra_config.get("backend", "mooncake")
        self.backend_name = self.backend.lower()
        self.use_gva_layerwise = self.use_layerwise and self.backend_name == "memcache"
```

「memcache 才有共享缓冲区/GVA 路径」这一条的代码依据。页面 `## 事实表` 与 `## 常见误解` 引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L183-L185

```python
        self.h2d_stagger_us = int(extra_config.get("h2d_stagger_us", 0))
        self.layerwise_max_transfer_blocks = int(extra_config.get("layerwise_max_transfer_blocks", 0))
        self.layerwise_max_transfer_bytes = int(extra_config.get("layerwise_max_transfer_bytes", 0))
```

三个传输节流参数的默认值。页面 `## 事实表` 引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L236-L241

```python
            if self.use_layerwise:
                raise ValueError(
                    f"TP mismatch (local_tp={self.tp_size}, peer_tp={self.peer_tp_size}) "
                    "is not supported with layerwise KV transfer (use_layerwise=True). "
                    "The layerwise threads do not implement TP-mismatch handling."
                )
```

layerwise 与 TP mismatch 互斥。页面 `## 事实表` 引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L414-L434

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

`num_prefetch_layers` 两条路径的取值来源不同——memcache(GVA) 路径从 layout 取，非 GVA 路径才是默认 `1`。页面 `## 事实表` 与 `## 常见误解` 引用。

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

三组同步原语：两组 per-layer 的 `threading.Event`（CPU 侧）与一组 per-layer 的 `torch.npu.Event`（设备侧）。页面 `## 事实表` 的同步点表引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1618-L1664

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

预取窗口的推进规则（第 0 层一次提交 `num_prefetch_layers` 个，之后每层补 1 个）与加载侧阻塞点（10 s 轮询）。页面 `## 怎么工作`、`## 拿真实数字走一遍`、`## 事实表` 引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1672-L1699

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

保存侧的关键事实：主线程只 `record()` 一个 NPU event 就返回（不阻塞），真正的等待推迟到最后一层；`current_layer` 由这里推进。页面 `## 怎么工作` 与 `## 事实表` 引用。

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

预取节流的核心机制：传输线程不是在 Python 调用点就开搬，而是等计算流真的推进到 attention 边界。页面 `## 怎么工作` 与 `## 常见误解` 引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/attention_fence.py#L64-L91

```python
def reset_attention_compute_start_gate() -> AttentionComputeStartGate:
    """Create a new per-layer gate for MemCache work.

    Layerwise prefetch tasks keep a reference to the gate that was current when
    they were submitted. The attention path opens that same gate when attention
    compute is about to be launched.
    """
    global _attention_compute_start_gate
    gate = AttentionComputeStartGate()
    with _lock:
        _attention_compute_start_gate = gate
    return gate


def get_attention_compute_start_gate() -> AttentionComputeStartGate:
    with _lock:
        gate = _attention_compute_start_gate
    if gate is None:
        gate = reset_attention_compute_start_gate()
    return gate


def record_attention_compute_start() -> None:
    """Record the compute-stream boundary immediately before attention."""
    with _lock:
        gate = _attention_compute_start_gate
    if gate is not None:
        gate.record()
```

gate 的生命周期：每层 `wait_for_layer_load` 开头换新、attention 前打开。页面 `## 怎么工作` 的时序图引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L435-L445

```python
        if len(gvas) == 0:
            return 0

        # direction: 0/SMEMB_COPY_L2G = save (write), 1/SMEMB_COPY_G2L = load (read)
        dir_name = "save(L2G)" if direction == 0 else "load(G2L)" if direction == 1 else f"dir{direction}"
        logger.debug(
            "[KVPOOL] batch_copy %s gvas=%d total_bytes=%d",
            dir_name,
            len(gvas),
            int(sizes.sum()) if len(sizes) else 0,
        )
```

`batch_copy` 的方向编码：0 = 存（L2G），1 = 取（G2L）。页面 `## 事实表` 引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1358-L1402

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
            if all_save_keys:
                save_keys = list(dict.fromkeys(all_save_keys))
                for key in save_keys:
                    self.write_results[key] = self.write_results.get(key, 0) or res
            if write_finish_keys:
                finish_keys = list(dict.fromkeys(write_finish_keys))
                results = [self.write_results.pop(key) for key in finish_keys]
                finish_results = self.m_store.batch_write_finish(finish_keys, results)
                if len(finish_results) != len(finish_keys) or any(result != 0 for result in finish_results):
                    raise RuntimeError(
                        f"Layerwise save batch_write_finish failed: "
                        f"expected={len(finish_keys)}, results={finish_results}"
                    )
            for req_id in all_req_ids:
                if self.try_finish_and_delete_stored_request(req_id):
                    self.set_finished_request(req_id)
        if not has_any_save:
            assert not self.layer_save_finished_events[physical_layer].is_set(), (
                f"thread: {physical_layer} save failed "
            )
            logger.debug("Layer save event set: layer %d", physical_layer)
            self.layer_save_finished_events[physical_layer].set()
            transfer_tasks.clear()
            self.request_queue.task_done()
            return
        assert not self.layer_save_finished_events[physical_layer].is_set(), f"thread: {physical_layer} save failed "
        logger.debug("Layer save event set: layer %d", physical_layer)
        self.layer_save_finished_events[physical_layer].set()
        transfer_tasks.clear()
        self.request_queue.task_done()
```

发送线程的同步点：先 `sync_save_events[layer].synchronize()` 确认计算流已把该层 KV 写进 HBM，再发 `batch_copy(direction=0)`，最后 `set()` 本层保存完成事件。页面 `## 怎么工作` 引用。

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

`h2d_stagger_us` 的确切公式（含 `layer_id` 参与轮转）与实现方式（忙等）。页面 `## 事实表` 与 `## 开了的代价` 引用。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1484-L1535

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

接收线程里最关键的一段：复用同一块 HBM 缓冲的层，必须先等上一个占用者的保存完成（CPU 事件 + NPU event 双重等待），才允许写入；随后再等 attention 开始门。页面 `## 怎么工作` 与 `## 拿真实数字走一遍` 引用。

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

共享缓冲区方案的识别条件：connector 是 AscendStore 系、`backend == memcache` 且 `use_layerwise` 为真（MultiConnector 下逐个子 connector 查）。页面 `## 怎么工作` 引用。

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

`layerwise_num_shared_buffers` 默认等于层数（即不复用），`layerwise_prefetch_layers` 在这条路径上默认 `min(num_shared_buffers, 8)`。页面 `## 事实表`、`## 拿真实数字走一遍`、`## 常见误解` 引用。

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

缓冲区分配算法本体：`independent_layers` 默认 `[0]`、支持 `"all"` 与负索引；`prefetch_layer_map[层] = 上一个占用同一缓冲区的层`；`storage_indices` 按步长 `num_shared_buffers` 分组。页面 `## 拿真实数字走一遍` 的全部算式来自这里。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L245-L276

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

    if prefetch_layer_map:
        unsupported_specs = [
            named_spec
            for named_specs in named_specs_by_layer.values()
            for named_spec in named_specs
            if not isinstance(named_spec.spec, AttentionSpec)
        ]
        if unsupported_specs:
            named_spec = unsupported_specs[0]
            raise NotImplementedError(
                "Layerwise KV cache reuse supports attention cache specs only; "
                f"{named_spec.layer_name} uses {type(named_spec.spec).__name__}."
            )

    return LayerwiseReuseLayout(
        layer_cache_specs=layer_cache_specs,
        buffer_slots=tuple(buffer_slots),
        prefetch_layer_map=prefetch_layer_map,
        independent_layers=independent_layers,
        num_prefetch_layers=base_layout.num_prefetch_layers,
        has_layer_reuse=bool(prefetch_layer_map),
    )
```

实际生效的版本：按 KV cache spec 分桶后再分配缓冲区槽，且只支持 `AttentionSpec`（Mamba 等非注意力 spec 会 `NotImplementedError`）。页面 `## 怎么工作` 与 `## 事实表` 引用。

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

显存节省的落地方式：把每层一个 `KVCacheTensor` 重写为按 `buffer_slots` 合并后的描述符（`shared_by` 含多层），并打出官方文档里用来确认的那行日志。页面 `## 怎么工作` 与 `## 拿真实数字走一遍` 引用。

## vllm_ascend/distributed/kv_transfer/ascend_multi_connector.py#L31-L57

```python
    def _configure_layerwise_reuse_completion(self) -> None:
        # Producers that report when a shared physical KV slot is safe to reuse.
        self._layerwise_slot_release_providers = [
            connector
            for connector in self._connectors
            if getattr(connector, "is_producer", False)
            and getattr(connector, "connector_worker", None) is not None
            and getattr(connector, "supports_layerwise_buffer_reuse", False)
            and callable(getattr(connector, "wait_for_layer_reuse", None))
        ]
        # All remaining connectors, which run after the slot-release providers.
        self._non_slot_release_connectors = [
            connector
            for connector in self._connectors
            if all(connector is not provider for provider in self._layerwise_slot_release_providers)
        ]
        self._external_slot_release_sink_configured = False
        if not self._layerwise_slot_release_providers:
            return
        for connector in self._connectors:
            set_waiter = getattr(connector, "set_external_slot_release_waiter", None)
            if callable(set_waiter) and set_waiter(self._wait_for_external_slot_release) is not False:
                self._external_slot_release_sink_configured = True
```

`supports_layerwise_buffer_reuse` 是组合部署能否安全复用缓冲区的门槛属性；`AscendStoreConnector` 通过 `set_external_slot_release_waiter` 接过等待职责。页面 `## 怎么工作` 与 `## 常见误解` 引用。

## vllm_ascend/distributed/kv_transfer/ascend_multi_connector.py#L59-L95

```python
    def wait_for_layer_load(self, layer_name: str) -> None:
        if getattr(self, "_external_slot_release_sink_configured", False):
            # AscendStore owns the layer-entry reuse wait after accepting the
            # composite waiter, so provider layer-entry waits are redundant.
            connectors = self._non_slot_release_connectors
        else:
            # Without a sink, preserve the original protection by waiting on
            # providers before any sibling connector can write shared slots.
            connectors = [*self._layerwise_slot_release_providers, *self._non_slot_release_connectors]
        for connector in connectors:
            connector.wait_for_layer_load(layer_name)

    def save_kv_layer(
        self,
        layer_name: str,
        kv_layer,
        attn_metadata: Any,
        **kwargs,
    ) -> None:
        # Phase 1: providers must close any new slot gate before returning.
        for connector in self._layerwise_slot_release_providers:
            connector.save_kv_layer(layer_name, kv_layer, attn_metadata, **kwargs)
        # Phase 2: siblings may now publish work that can enable slot reuse.
        for connector in self._non_slot_release_connectors:
            connector.save_kv_layer(layer_name, kv_layer, attn_metadata, **kwargs)

    def on_kv_cache_written(self, layer_name: str = "") -> None:
        # Phase 1: providers close their gates at the earliest cache-write hook.
        for connector in self._layerwise_slot_release_providers:
            hook = getattr(connector, "on_kv_cache_written", None)
            if callable(hook):
                hook(layer_name)
        # Phase 2: only then may sibling hooks publish reuse-enabling work.
        for connector in self._non_slot_release_connectors:
            hook = getattr(connector, "on_kv_cache_written", None)
            if callable(hook):
                hook(layer_name)
```

组合部署里三个 hook 的两阶段顺序（先关门的 provider，后发布工作的 sibling）。页面 `## 怎么工作` 引用。

## vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/connector.py#L54-L69

```python
    supports_layerwise_buffer_reuse = True

    def __init__(
        self,
        vllm_config: VllmConfig,
        role: KVConnectorRole,
        kv_cache_config: KVCacheConfig | None = None,
    ):
        super().__init__(vllm_config=vllm_config, role=role, kv_cache_config=kv_cache_config)
        assert vllm_config.kv_transfer_config is not None
        self.kv_role = vllm_config.kv_transfer_config.kv_role
        self.is_producer = vllm_config.kv_transfer_config.is_kv_producer
        self.is_consumer = vllm_config.kv_transfer_config.is_kv_consumer
        self.requires_full_blocks_on_update_after_alloc = role == KVConnectorRole.SCHEDULER and self.is_producer
        # SFA path is layer-wise on both sides.
        self.use_layerwise = vllm_config.kv_transfer_config.kv_connector_extra_config.get("use_layerwise", True)
```

`SfaRemoteD2HConnector` 声明支持缓冲区复用，且它的 `use_layerwise` 默认是 `True`（与 `AscendStoreConnector` 的默认 `False` 相反）。页面 `## 事实表` 与 `## 常见误解` 引用。

## vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/connector.py#L236-L243

```python
    def wait_for_layer_send(self, layer_idx: int) -> None:
        worker = self.connector_worker
        if worker is None or not hasattr(worker, "wait_for_layer_send"):
            return
        worker.wait_for_layer_send(layer_idx)

    def wait_for_layer_reuse(self, layer_idx: int) -> None:
        self.wait_for_layer_send(layer_idx)
```

缓冲区复用等待就是「等对端把这一层读走」。页面 `## 怎么工作` 引用。

## vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/worker.py#L833-L851

```python
    def wait_for_layer_send(self, layer_idx: int) -> None:
        """Block until D has read layer ``layer_idx``'s KV (buffer-reuse gate).

        In pull mode D reads P's KV via memfabric; this waits until D replies
        with READ_DONE or READ_FAILED before P reuses the KV buffer for a later
        layer, so D is no longer reading before P overwrites it.
        """
        if self.kv_send_layer_thread is None:
            return
        if layer_idx not in self.layer_storage_slots:
            raise RuntimeError(f"SFA layerwise reuse mapping is missing layer {layer_idx}")
        storage_slots = self.layer_storage_slots[layer_idx]
        if storage_slots:
            for slot_id in storage_slots:
                self._wait_for_pd_read_completion(
                    self.kv_send_layer_thread.get_storage_send_event(slot_id),
                    lambda slot_id=slot_id: self.kv_send_layer_thread.get_storage_error(slot_id),
                    f"physical KV storage slot {slot_id} for layer {layer_idx}",
                )
```

共享缓冲区在 PD 场景下的第二道闸：P 侧重用某层缓冲前必须等 D 侧读完。页面 `## 怎么工作` 与 `## 开了的代价` 引用。

## vllm_ascend/worker/model_runner_v1.py#L3917-L3923

```python
        kv_cache_config = deepcopy(kv_cache_config)
        self.kv_cache_config = kv_cache_config
        self._mamba_bufs = None
        self._mamba_copy_bufs = None
        self.may_add_encoder_only_layers_to_kv_cache_config()
        apply_layerwise_kv_cache_plan(kv_cache_config, self.vllm_config)
        self.maybe_add_kv_sharing_layers_to_kv_cache_config()
```

共享缓冲区的改写发生在 `initialize_kv_cache` 里、在 attention backend 初始化之前。页面 `## 怎么工作` 引用。
