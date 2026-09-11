# Layerwise KV Offload — 引用片段

全部取自 `vllm-ascend@28bf3a2e`。编号与 `_drafts/kv-cache-layerwise-offload.md` 的 `sources` 顺序一致。

## 1. vllm_ascend/attention/utils.py#L473-L521

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

三个挂钩点的定义：逐层等待、逐层保存、写完 KV 的通知。页面用它说明「按层粒度」是怎么进入 attention 前向的。

## 2. vllm_ascend/attention/mla_v1.py#L1898-L1913

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

MLA 后端里 wait 的位置：只在 `has_prefill` 时等待；写完 KV 后立刻 notify。

## 3. vllm_ascend/attention/mla_v1.py#L2016-L2020

```python
        output[...] = self.o_proj(o_proj_input, is_prefill=prefill_preprocess_res is not None)[0]

        del o_proj_input
        maybe_save_kv_layer_to_connector(layer_name, list(kv_cache))
        return output_padded
```

save 在 o_proj 之后、这一层返回之前，说明保存动作落在层尾。

## 4. vllm_ascend/attention/sfa_v1.py#L1651-L1659

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

SFA 后端把 notify 与「计算流栅栏」记录点放在一起，注释说明了栅栏为什么必须每层都记。

## 5. vllm_ascend/attention/sfa_v1.py#L1695-L1700

```python
            parallel_context.gather_full_o_proj,
        )

        maybe_save_kv_layer_to_connector(layer_name, list(kv_cache))

        return output
```

SFA 后端同样在层尾保存，与 MLA 一致。

## 6. vllm_ascend/attention/context_parallel/dsa_cp.py#L1430-L1434

```python
        layer_metadata = self._get_layer_metadata(layer_name, attn_metadata)
        common_attn_metadata = layer_metadata.compressor_cache
        if common_attn_metadata is None:
            common_attn_metadata = layer_metadata.swa
        wait_for_kv_layer_from_connector(layer_name)
```

用来支撑「官方文档称 CP 变体都未接入逐层调用，但 dsa_cp 已经接入」这一条冲突。

## 7. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/attention_fence.py#L27-L61

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

页面的核心同步点之一：传输线程等的不是 Python 调用点，而是计算流上真正到达 attention 的 NPU event。

## 8. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/attention_fence.py#L64-L91

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

栅栏是「每层一个」的：每层进入 wait 时重置，提交预取任务时抓取当前那一个。

## 9. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L76-L91

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

图模式约束的代码依据：开了 `use_layerwise` 就要求 PIECEWISE 图。

## 10. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L227-L236

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
```

connector 层的开关：不开 `use_layerwise`，这两个挂钩点直接空转。

## 11. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L155-L157

```python
        self.backend = extra_config.get("backend", "mooncake")
        self.backend_name = self.backend.lower()
        self.use_gva_layerwise = self.use_layerwise and self.backend_name == "memcache"
```

「逐层只支持 memcache」的代码依据，以及 GVA 路径的判定式。

## 12. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L183-L185

```python
        self.h2d_stagger_us = int(extra_config.get("h2d_stagger_us", 0))
        self.layerwise_max_transfer_blocks = int(extra_config.get("layerwise_max_transfer_blocks", 0))
        self.layerwise_max_transfer_bytes = int(extra_config.get("layerwise_max_transfer_bytes", 0))
```

三个调优项的默认值来源。

## 13. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L467-L491

```python
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

每层三组同步对象（两组 `threading.Event` + 一组 `torch.npu.Event`）在这里按层数创建；发送线程类名在这里确定。

## 14. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L510-L534

```python
            ready_event = threading.Event()
            if self.use_gva_layerwise:
                self.kv_recv_thread = KVCacheStoreLayerRecvingThread(
                    self.m_store,
                    self.token_database,
                    self.block_size,
                    self.tp_rank,
                    self.tp_size,
                    self.dcp_size,
                    self.page_size_bytes,
                    ready_event,
                    self.get_event,
                    self.layer_load_finished_events,
                    self.layer_save_finished_events,
                    self.sync_save_events,
                    self.num_layers,
                    self.h2d_stagger_us,
                    self.layerwise_max_transfer_blocks,
                    self.layerwise_max_transfer_bytes,
                    group_builders=self._build_group_layer_builders(),
                    external_slot_release_waiter=self.external_slot_release_waiter,
                    save_failure_checker=(
                        self.kv_send_thread.raise_if_failed if self.kv_send_thread is not None else None
                    ),
                )
```

接收线程同时持有 save 事件与 `external_slot_release_waiter`，这是「复用前必须等保存与远端读完成」的连线处。

## 15. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L821-L837

```python
    def start_load_kv(self, metadata: AscendConnectorMetadata):
        self.current_layer = 0
        self.layerwise_retrievers: list[Any] = []
        if self.use_layerwise:
            self.next_layer_to_submit = 0
            # Transfer threads receive these lists by reference. Give every
            # step fresh lists so a late clear of a previous step cannot drop
            # newly prepared loads/saves and leave a reused buffer stale.
            self.layer_save_tasks = [[] for _ in range(self.num_layers)]
            self.layer_load_tasks = [[] for _ in range(self.num_layers)]
            reset_attention_compute_start_gate()
        logger.debug("KV pool worker start_load_kv requests=%d", len(metadata.requests))
        if len(metadata.requests) == 0:
            return
        if self.use_layerwise:
            self.process_layer_data(metadata.requests)
            return
```

每步开始时 `current_layer` 归零、按层任务表重建，逐层路径在这里与整请求路径分叉。

## 16. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1618-L1665

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

预取深度怎么用（第 0 层一次提交 `num_prefetch_layers` 个，之后每层补一个）、当前层怎么阻塞等待、以及只有非当前层才挂栅栏。

## 17. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1672-L1699

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

保存侧：记录 NPU event 后立刻把任务丢给发送线程（不阻塞），只有最后一层才等保存完成；`current_layer` 在这里推进。

## 18. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L426-L477

```python
    def _batch_copy_with_limits(
        self,
        gvas: np.ndarray,
        addrs: np.ndarray,
        sizes: np.ndarray,
        direction: int,
        max_transfer_blocks: int,
        max_transfer_bytes: int,
    ) -> int:
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

        max_transfer_addrs = 0
        if max_transfer_blocks > 0:
            max_transfer_addrs = max_transfer_blocks * self.num_addrs_per_block
        if max_transfer_addrs <= 0:
            max_transfer_addrs = len(gvas)

        assert self.m_store.store is not None
        for start in range(0, len(gvas), max_transfer_addrs):
            end = start + max_transfer_addrs
            split_gvas, split_addrs, split_sizes = self._split_transfer_packets(
                gvas[start:end],
                addrs[start:end],
                sizes[start:end],
                max_transfer_bytes,
            )
            logger.debug(
                "[KVPOOL] batch_copy %s split_gvas=%s split_sizes=%s",
                dir_name,
                split_gvas.tolist(),
                split_sizes.tolist(),
            )
            res = self.m_store.store.batch_copy(
                split_gvas.tolist(),
                split_addrs.tolist(),
                split_sizes.tolist(),
                direction,
            )
            if res != 0:
                logger.error("[KVPOOL] batch_copy %s FAILED res=%d", dir_name, res)
                return res
        return 0
```

真正的搬运原语：Memcache 的 `batch_copy`，方向 0 = 存（L2G）、1 = 取（G2L）；两个 `layerwise_max_transfer_*` 在这里切分批次。

## 19. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1335-L1372

```python
        physical_layer = transfer_tasks[0].layer_id
        has_any_save = False
        all_gvas = []
        all_addrs = []
        all_sizes = []
        all_req_ids = []
        all_save_keys: list[str] = []
        write_finish_keys: list[str] = []
        for task in transfer_tasks:
            shared = task.shared_block_data
            if shared is None:
                continue
            has_any_save = True
            builder = self.group_builders[task.group_id] if self.group_builders else self.layer_batch_builder
            req_meta = builder.build_addrs(shared, task.layer_idx_in_group)
            for req_id in req_meta.req_ids:
                self.dec_stored_request(req_id)
                all_req_ids.append(req_id)
            all_save_keys.extend(shared.save_keys)
            write_finish_keys.extend(task.write_finish_keys)
            all_gvas.append(req_meta.gvas_array)
            all_addrs.append(req_meta.addr_array)
            all_sizes.append(req_meta.size_array)
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

`KVCacheStoreLayerSendingThread._handle_request`：搬运前 `sync_save_events[layer].synchronize()`，这是「等计算流把这一层 KV 写完」的那个同步点。

## 20. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1467-L1479

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

`h2d_stagger_us` 的实际语义：按 `(tp_rank + layer_id) % tp_size` 算出错峰槽位，忙等这么多微秒再提交。

## 21. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L1481-L1535

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

接收线程的三道门：先等复用源层保存完（CPU 事件 + NPU event），再等 `external_slot_release_waiter`（远端读完成），最后等计算流进入 attention 才发 G2L 拷贝。

## 22. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L70-L102

```python
def get_gva_layerwise_config(kv_transfer_config: Any) -> dict[str, Any] | None:
    """Return extra config for the MemCache GVA layerwise path."""
    if kv_transfer_config is None:
        return None

    connector_name = getattr(kv_transfer_config, "kv_connector", None)
    root_extra_config = getattr(kv_transfer_config, "kv_connector_extra_config", None) or {}
    if connector_name in ("AscendStoreConnector", "MooncakeConnectorStoreV1"):
        connector_configs = [
            {
                "kv_connector": connector_name,
                "kv_connector_extra_config": root_extra_config,
            }
        ]
    elif connector_name == "MultiConnector":
        connector_configs = root_extra_config.get("connectors", [])
    else:
        return None

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

buffer 规划的入口判定：支持从 `MultiConnector` 的子连接器里把 AscendStore 的配置挖出来。

## 23. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L114-L135

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

两个默认值的真实来源：不配 `layerwise_num_shared_buffers` 就等于层数（即不复用）；`layerwise_prefetch_layers` 在 GVA 路径下默认是 `min(共享 buffer 数, 8)`。

## 24. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L136-L178

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

`## 拿真实数字走一遍` 逐行对着算的就是这段：独立层默认 `[0]`、支持负索引与 `"all"`、`prefetch_layer_map` 与 `storage_indices` 的构造、以及 `has_layer_reuse` 的判据。

## 25. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L245-L267

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
```

按 spec 分桶后轮转分配 buffer；非 `AttentionSpec`（如 Mamba）直接拒绝，这是「hybrid 布局不支持」的一条具体表现。

## 26. vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L300-L357

```python
    if not reuse_layout.has_layer_reuse:
        return
    if any(len(tensor.shared_by) != 1 or tensor.offset != 0 or tensor.block_stride != 0 for tensor in old_tensors):
        raise NotImplementedError(
            "Layerwise KV cache reuse does not support pre-shared or packed KV cache tensor descriptors."
        )

    if actual_layers < base_layers:
        logger.warning(
            "Layer reuse expected at least %d layers, got %d; skip tensor merge.",
            base_layers,
            actual_layers,
        )
        return
    if actual_layers > base_layers:
        logger.info(
            "Layer reuse includes %d base and %d MTP/spec-decode layer(s).",
            base_layers,
            actual_layers - base_layers,
        )

    tensors_by_name = {tensor.shared_by[0]: tensor for tensor in old_tensors}

    def _merge_specs(named_specs: list[NamedKVCacheSpec]) -> None:
        shared_by = [named_spec.layer_name for named_spec in named_specs]
        cache_tensors = [tensors_by_name[layer_name] for layer_name in shared_by]
        tensor_sizes = {tensor.size for tensor in cache_tensors}
        if len(tensor_sizes) != 1:
            raise ValueError("Layers sharing layerwise KV buffers must have equal tensor sizes for every cache spec.")
        reference_spec = layer_specs[shared_by[0]]
        if any(layer_specs[layer_name] != reference_spec for layer_name in shared_by[1:]):
            raise ValueError(
                "Layers sharing layerwise KV buffers must have identical cache specs for every named cache spec."
            )
        new_tensors.append(
            KVCacheTensor(
                shared_by=shared_by,
                size=cache_tensors[0].size,
            )
        )

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

省显存到底发生在哪：把每层一个 `KVCacheTensor` 合并成每 slot 一个，`size` 不变而数量变少；等尺寸与等 spec 是硬校验；MTP 层参与同一套规划；日志正是用户指南让人对照的那一行。

## 27. vllm_ascend/distributed/kv_transfer/ascend_multi_connector.py#L31-L57

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

    def _wait_for_external_slot_release(self, layer_idx: int) -> None:
        for provider in self._layerwise_slot_release_providers:
            provider.wait_for_layer_reuse(layer_idx)
```

联合部署时「复用闸门」怎么组合：谁提供 slot 释放信号、闸门怎么注入给 AscendStore。

## 28. vllm_ascend/distributed/kv_transfer/ascend_multi_connector.py#L71-L95

```python
    def save_kv_layer(
        self,
        layer_name: str,
        kv_layer: Any,
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

两阶段顺序：无论配置里怎么排，完成信号提供方一律先跑——页面用它说明「配置顺序不影响正确性」。

## 29. vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/connector.py#L48-L54

```python
    * SCHEDULER + consumer : D-side vLLM block-id / advertisement tracking.
    * WORKER + producer    : P-side layer-wise READ_READY notifications.
    * WORKER + consumer    : D-side manager CPU-pool + memfabric pull read +
      indexer/main split registration.
    """

    supports_layerwise_buffer_reuse = True
```

`SfaRemoteD2HConnector` 自报能提供逐层 buffer 复用完成信号。

## 30. vllm_ascend/distributed/kv_transfer/kv_p2p/sfa_pd_rd2h/connector.py#L242-L243

```python
    def wait_for_layer_reuse(self, layer_idx: int) -> None:
        self.wait_for_layer_send(layer_idx)
```

复用等待就是等这一层发送（远端读）完成。

## 31. vllm_ascend/worker/model_runner_v1.py#L3917-L3925

```python
        kv_cache_config = deepcopy(kv_cache_config)
        self.kv_cache_config = kv_cache_config
        self._mamba_bufs = None
        self._mamba_copy_bufs = None
        self.may_add_encoder_only_layers_to_kv_cache_config()
        apply_layerwise_kv_cache_plan(kv_cache_config, self.vllm_config)
        self.maybe_add_kv_sharing_layers_to_kv_cache_groups(kv_cache_config)
        # NOTE(cmq): initialize_attn_backend must before using self.attn_groups
        self.initialize_attn_backend(kv_cache_config)
```

buffer 合并发生在 `initialize_kv_cache` 里、真正分配张量之前，说明它改写的是已经定好尺寸的 `kv_cache_config`。

## 32. docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L18-L36

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

官方对「为什么逐层」的表述，页面 `## 为什么需要它` 用它。

## 33. docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L77-L88

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

参数表的官方版本；页面事实表与之对照，并指出 `layerwise_prefetch_layers` 的默认值在 GVA 路径下与此不同。

## 34. docs/source/user_guide/feature_guide/layerwise_kv_pool.md#L224-L245

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

适用注意力后端与限制的官方表述，也是页面里那条冲突标记的对照物。

## 35. docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L144-L196

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

官方的 Prefill 侧完整配置与两个 buffer 参数的说明；页面 `## 拿真实数字走一遍` 的配置片段以它为底本。

## 36. docs/source/user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md#L260-L268

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

联合部署侧的限制清单。

## 37. docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L19-L27

```markdown
| Stage | Compute pattern | Offload strategy | NPU-resident data |
| :--- | :--- | :--- | :--- |
| Prefill | High computation per layer | Transfer complete layers and overlap transfer with computation | A few reusable layer buffers |
| Decode | Low computation per token | Keep full KV in host memory and load only selected entries | Indexer cache and per-layer hot top-k buffers |

Loading a complete layer during every Decode step would add transfer latency
that cannot be hidden by Decode computation. Sparse Decode Offload avoids that
cost by moving only the entries selected by sparse attention.
```

「为什么 Prefill 用逐层、Decode 不用」的官方论证，页面据此写 `alternative-to` 的 note。

## 38. docs/source/developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md#L92-L146

```markdown
### Buffer planning

Layerwise Prefill Offload maps many logical cache-bearing layers onto fewer
physical NPU buffers. Some layers can keep dedicated buffers; the remaining
compatible layers share a reusable buffer pool.

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
```

官方的 buffer 数公式、执行流水线与复用不变量，页面事实表与 worked example 都引它。
