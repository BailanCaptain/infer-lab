# KV Pool 源码片段（vllm-ascend@28bf3a2e）

## vllm_ascend/distributed/kv_transfer/__init__.py#L39-L49

```python
    KVConnectorFactory.register_connector(
        "MooncakeConnectorStoreV1",
        "vllm_ascend.distributed.kv_transfer.kv_pool.ascend_store.ascend_store_connector",
        "AscendStoreConnector",
    )

    KVConnectorFactory.register_connector(
        "AscendStoreConnector",
        "vllm_ascend.distributed.kv_transfer.kv_pool.ascend_store.ascend_store_connector",
        "AscendStoreConnector",
    )
```

证明 `kv_connector` 里能写的两个名字（`AscendStoreConnector` 与旧名 `MooncakeConnectorStoreV1`）都指向同一个类。

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

`use_layerwise` 与图模式的约束来源。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L85-L116

```python
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

一个类按 role 分流成 `KVPoolScheduler` / `KVPoolWorker`；`LookupKeyServer` 只在非 layerwise 且 rank 0 起。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L128-L149

```python
    def get_num_new_matched_tokens(self, request: "Request", num_computed_tokens: int) -> tuple[int, bool]:
        assert self.connector_scheduler is not None
        return self.connector_scheduler.get_num_new_matched_tokens(request, num_computed_tokens)

    def update_state_after_alloc(self, request: "Request", blocks: "KVCacheBlocks", num_external_tokens: int):
        assert self.connector_scheduler is not None
        return self.connector_scheduler.update_state_after_alloc(request, blocks, num_external_tokens)

    def build_connector_meta(
        self,
        scheduler_output: SchedulerOutput,
    ) -> KVConnectorMetadata:
        assert self.connector_scheduler is not None
        return self.connector_scheduler.build_connector_meta(scheduler_output)

    def request_finished(
        self,
        request: "Request",
        block_ids: list[int],
    ) -> tuple[bool, dict[str, Any] | None]:
        assert self.connector_scheduler is not None
        return self.connector_scheduler.request_finished(request, block_ids)
```

调度侧四个 KV Connector V1 钩子，全部转发给 `KVPoolScheduler`。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L204-L263

```python
    def register_kv_caches(self, kv_caches: dict[str, torch.Tensor]):
        assert self.connector_worker is not None
        self.connector_worker.register_kv_caches(kv_caches)

    def start_load_kv(self, forward_context: "ForwardContext", **kwargs) -> None:
        assert self.connector_worker is not None
        metadata = self._get_connector_metadata()
        self._current_step_has_real_forward = forward_context is not None
        ...
        self.connector_worker.start_load_kv(metadata)

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

    def get_finished(self, finished_req_ids: set[str]) -> tuple[set[str], set[str]]:
        """Get the finished recving and sending requests."""
        assert self.connector_worker is not None
        metadata = self._get_connector_metadata()
        if self._current_step_has_real_forward:
            try:
                self.connector_worker.ensure_store_initialized()
            finally:
                self._current_step_has_real_forward = False
        done_sending, done_recving = self.connector_worker.get_finished(finished_req_ids, metadata)
        return done_sending, done_recving
```

（中间日志语句用 `...` 省略，其余原文）Worker 侧六个钩子，以及 `kv_consumer` + `consumer_is_to_put=false` 时不落盘的分支。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L291-L335

```python
class LookupKeyServer:
    def __init__(
        self,
        pool_worker: KVPoolWorker,
        vllm_config: "VllmConfig",
    ):
        self.decoder = MsgpackDecoder()
        self.ctx = zmq.Context()  # type: ignore[attr-defined]
        socket_path = get_zmq_rpc_path_lookup(vllm_config)
        self.socket = make_zmq_socket(
            self.ctx,
            socket_path,
            zmq.REP,  # type: ignore[attr-defined]
            bind=True,
        )

        self.pool_worker = pool_worker
        self.running = True

        def process_request():
            while self.running:
                all_frames = self.socket.recv_multipart(copy=False)
                token_len = int.from_bytes(all_frames[0], byteorder="big")
                kv_group_ids = self.decoder.decode([all_frames[1]])
                hbm_hit_tokens = int.from_bytes(all_frames[2], byteorder="big")
                hashes_str = self.decoder.decode(all_frames[3:])
                result = self.pool_worker.lookup_scheduler(
                    token_len,
                    hashes_str,
                    kv_group_ids,
                    use_layerwise=False,
                    hbm_hit_tokens=hbm_hit_tokens,
                )
                ...
                response = result.to_bytes(4, "big")
                self.socket.send(response)

        self.thread = threading.Thread(target=process_request, daemon=True)
        self.thread.start()
```

调度进程查池命中要走 ZMQ 到 worker 进程，因为只有 worker 连着存储后端。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L90-L102

```python
        self.kv_role = vllm_config.kv_transfer_config.kv_role
        self.consumer_is_to_load = vllm_config.kv_transfer_config.kv_connector_extra_config.get(
            "consumer_is_to_load", False
        )
        self.consumer_is_to_put = vllm_config.kv_transfer_config.kv_connector_extra_config.get(
            "consumer_is_to_put", False
        )
        self.load_async = vllm_config.kv_transfer_config.kv_connector_extra_config.get("load_async", False)
        retention_interval = getattr(envs, "VLLM_PREFIX_CACHE_RETENTION_INTERVAL", None)
        self.retention_interval = retention_interval if isinstance(retention_interval, int) else None
        self.save_decode_cache = vllm_config.kv_transfer_config.kv_connector_extra_config.get(
            "save_decode_cache", False
        )
```

`consumer_is_to_load` / `consumer_is_to_put` / `load_async` 的默认值（都是 `False`）与读取位置。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L161-L172

```python
        backend_name = vllm_config.kv_transfer_config.kv_connector_extra_config.get("backend", "mooncake")
        self.backend_name = backend_name.lower()
        self.use_gva_layerwise = self.use_layerwise and self.backend_name == "memcache"
        backend = backend_map.get(self.backend_name)
        if backend is None:
            raise ValueError(f"Unsupported KV pool backend: {backend_name}")
        backend_path = backend.get("path")
        backend_class_name = backend.get("name")
        assert backend_path is not None and backend_class_name is not None
        backend_module = importlib.import_module(backend_path)
        backend_class = getattr(backend_module, backend_class_name)
        self.store_scheduler = backend_class.create_scheduler_client(vllm_config.parallel_config)
```

`backend` 默认 `mooncake`；GVA layerwise 只在 memcache 后端生效。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L178-L188

```python
        self.use_mla = False
        if hasattr(model_config, "use_mla") and isinstance(model_config.use_mla, bool) and model_config.use_mla:
            self.use_mla = True
        if self.use_mla:
            self.num_kv_head = 1
        else:
            self.num_kv_head = model_config.get_total_num_kv_heads()
        if self.num_kv_head < self.tp_size:
            self.put_step = self.tp_size // self.num_kv_head
        else:
            self.put_step = 1
```

`put_step` 的定义，决定一个块要拆成几个 key（`head_or_tp_ranks = tp_size // put_step`）；MLA 走 `num_kv_head = 1` 的分支。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L456-L512

```python
        if self.kv_role == "kv_consumer" and not self.consumer_is_to_load:
            return 0, False

        prompt_token_len = len(request.prompt_token_ids)
        if (
            self.retention_interval is not None
            and not self.use_layerwise
            and prompt_token_len < 2 * self.retention_interval
        ):
            return 0, False

        if self.use_gva_layerwise:
            token_len = prompt_token_len
            num_external_hit_tokens = self._get_layerwise_gva_hit_tokens(request, token_len, num_computed_tokens)
        else:
            if self._discard_partial_chunks:
                token_len = self._floor_to_cache_transfer_granularity(prompt_token_len)
            else:
                token_len = prompt_token_len

            if token_len < self.cache_transfer_granularity:
                return 0, False

            if self.use_layerwise:
                num_external_hit_tokens = self._get_store_lookup_hit_tokens(
                    request, token_len, num_computed_tokens, include_layers=True
                )
            else:
                if num_computed_tokens >= token_len:
                    return 0, False
                if self.client is None:
                    self.client = LookupKeyClient(self.vllm_config)
                num_external_hit_tokens = self.client.lookup(
                    token_len,
                    request.block_hashes,
                    self.kv_cache_group_ids,
                    hbm_hit_tokens=num_computed_tokens,
                )

        if num_external_hit_tokens == 0:
            return 0, False

        store_skip_tokens = num_external_hit_tokens
        if self.use_layerwise and self.use_eagle:
            # TODO(lf): Support loading the trailing block as dirty data.
            num_external_hit_tokens = max(
                num_computed_tokens,
                num_external_hit_tokens - self.lcm_block_size,
            )
        if num_external_hit_tokens == request.num_tokens:
            num_external_hit_tokens -= 1

        if num_external_hit_tokens < num_computed_tokens:
            need_to_allocate = 0
        else:
            need_to_allocate = num_external_hit_tokens - num_computed_tokens
```

整页最核心的一段：池命中如何与 HBM prefix caching 命中相减，只把「多出来的」token 交给 vLLM 分配；以及 `consumer_is_to_load` 的早退、全命中减 1 的规则。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L935-L951

```python
        if self.kv_role == "kv_consumer" and not self.consumer_is_to_put:
            self._delayed_free_req_ids.discard(request.request_id)
            return False, None
        if self.use_layerwise:
            self._delayed_free_req_ids.discard(request.request_id)
            return False, None
        tracker = self._request_trackers.get(request.request_id)
        if tracker is None or tracker.num_saved_tokens <= 0:
            self._delayed_free_req_ids.discard(request.request_id)
            return False, None
        delay_free_blocks = len(block_ids) > 0
        if delay_free_blocks:
            self._delayed_free_req_ids.add(request.request_id)
            logger.debug("Delaying free of %d blocks for request %s", len(block_ids), request.request_id)
        else:
            self._delayed_free_req_ids.discard(request.request_id)
        return delay_free_blocks, None
```

请求结束时块要不要延迟释放——异步 put 还在读 HBM 就不能立刻回收。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L1034-L1049

```python
def get_zmq_rpc_path_lookup(vllm_config: "VllmConfig") -> str:
    dp_rank = vllm_config.parallel_config.data_parallel_rank
    base_url = envs.VLLM_RPC_BASE_PATH
    # Default to 0 if not configured
    rpc_port = 0
    if vllm_config is not None:
        extra_config = vllm_config.kv_transfer_config.kv_connector_extra_config
        if "lookup_rpc_port" in extra_config:
            rpc_port = extra_config["lookup_rpc_port"]
        elif "mooncake_rpc_port" in extra_config:
            rpc_port = extra_config["mooncake_rpc_port"]
            logger.warning(
                "It is recommended to use the lookup_rpc_port, as the mooncake_rpc_port will be removed in the future."
            )
    logger.debug("Base URL: %s, RPC Port: %s", base_url, rpc_port)
    return f"ipc://{base_url}/lookup_rpc_port_{rpc_port}_dp_rank{dp_rank}"
```

`lookup_rpc_port` 其实不是 TCP 端口，而是 IPC 路径里的一段标识；这解释了为什么同机多实例必须各配一个。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L635-L644

```python
    def _get_cache_block_metadata(self, cache: torch.Tensor) -> tuple[int, int, int, int]:
        tensor_num_blocks = cache.shape[0]
        assert tensor_num_blocks % self.num_blocks == 0, (
            "The external block size must be an integer multiple of the kernel block size."
        )
        block_size_scale = tensor_num_blocks // self.num_blocks
        block_len = cache[0].numel() * cache.element_size() * block_size_scale
        block_stride = cache.stride(0) * cache.element_size() * block_size_scale
        region_len = (self.num_blocks - 1) * block_stride + block_len if self.num_blocks else 0
        return block_len, block_stride, region_len, block_size_scale
```

单块字节数的定义，worked example 的算式基础。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L790-L819

```python
        self.page_size_bytes = sum(self.block_len)
        self.token_database.set_group_buffers(
            self.group_kv_caches_base_addr,
            self.group_block_len,
            self.group_block_stride,
            cache_role="kv",
            group_cache_families=self.group_kv_cache_families,
            group_num_layers=self.group_num_layers,
            group_layer_cache_entry_offsets=self.group_layer_cache_entry_offsets,
        )

        if self.tp_mismatch:
            first_cache = self._as_cache_tuple(next(iter(kv_caches.values())))[0]
            self.elem_size = first_cache.element_size()
            self.head_dim = first_cache.shape[-1]
            # block_len[0] = block_size * num_kv_head_per_local_rank * head_dim * elem_size
            self.per_token_bytes = self.group_block_len[0][0] // self.block_size
            self.sub_size_bytes = self.effective_heads_per_rank * self.head_dim * self.elem_size
            logger.info(
                "TP mismatch strided I/O: per_token_bytes=%d, sub_size_bytes=%d",
                self.per_token_bytes,
                self.sub_size_bytes,
            )

        # Initialize store, register buffers, and start transfer threads
        # directly here (like main) — no separate init_backend handshake.
        if self.use_gva_layerwise:
            self.m_store.ensure_initialized()
        self.m_store.register_buffer(ptrs, lengths)
        self._start_kv_transfer_threads()
```

`register_kv_caches` 的末尾：把 HBM 上的 KV 区间注册给后端（零拷贝 RDMA 的前提），然后起搬运线程。注释里也给出了 `block_len` 的构成公式。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L874-L931

```python
            addr_list = []
            size_list = []
            key_list = []
            block_id_list: list[int] = []
            load_masks = self.token_database.load_mask(request.block_hashes, token_len)
            for group_id in load_group_ids:
                if group_id >= len(request.block_ids_by_group):
                    continue
                block_ids = request.block_ids_by_group[group_id]
                group_block_size = self.grouped_block_size[group_id]
                mask_num = load_spec.vllm_cached_tokens // group_block_size * group_block_size
                skip_null = group_id < len(self.group_uses_align_state) and self.group_uses_align_state[group_id]

                def chunk_filter(start: int, group_id=group_id, load_masks=load_masks) -> bool:
                    return self.token_database.mask_allows_chunk(load_masks, group_id, start)

                for (
                    start,
                    end,
                    key,
                    _block_hash,
                    block_id,
                ) in self.token_database.process_token_key_strings_with_block_ids(
                    token_len,
                    request.block_hashes,
                    block_ids,
                    mask_num,
                    kv_cache_group_id=group_id,
                    skip_null_blocks=skip_null,
                    chunk_filter=chunk_filter,
                ):
                    addr, size, block_id = self.token_database.prepare_value(
                        start,
                        end,
                        block_ids,
                        kv_cache_group_id=group_id,
                        block_id=block_id,
                    )
                    key_list.append(key)
                    addr_list.append(addr)
                    size_list.append(size)
                    block_id_list.append(block_id)
            if not key_list:
                continue
            key_list_c = _circular_shift(key_list, self.tp_rank % len(key_list))
            addr_list_c = _circular_shift(addr_list, self.tp_rank % len(addr_list))
            size_list_c = _circular_shift(size_list, self.tp_rank % len(size_list))
            block_id_list_c = _circular_shift(block_id_list, self.tp_rank % len(block_id_list))
            ...
            ret = self.m_store.get(key_list_c, addr_list_c, size_list_c)
            if ret is not None and any(r != 0 for r in ret):
                missing_block_ids = record_failed_blocks(
                    block_id_list_c,
                    ret,
                )
                if len(request.block_ids_by_group) == 1:
                    self._invalid_block_ids.update(missing_block_ids)
```

同步 load 主路径：`mask_num` 跳过 HBM 已有的块，`prepare_value` 把 block_id 换成 HBM 地址，`_circular_shift` 按 tp_rank 错开请求顺序，失败块记入 `_invalid_block_ids`。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1701-L1719

```python
    def wait_for_save(self, connector_metadata: AscendConnectorMetadata):
        current_event = None
        assert self.kv_send_thread is not None
        send_thread = self.kv_send_thread

        for request in connector_metadata.requests:
            can_save = request.can_save
            if can_save is None or not can_save:
                continue
            if current_event is None:
                current_event = torch.npu.Event()
                current_event.record()
            request.skip_null_blocks_by_group = self.group_uses_align_state
            request.current_event = current_event
            send_thread.add_stored_request(request.req_id)
            send_thread.add_request(request)

        if current_event is not None:
            send_thread.request_queue.join()
```

非 layerwise 的 put 路径：录一个 NPU event 保证算子写完，再把请求丢给发送线程。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L2310-L2349

```python
            for group_id in kv_cache_group_ids:
                keys, starts, ends = self._build_lookup_keys(token_len, block_hashes, group_id, use_layerwise)

                if not keys:
                    return 0

                multi_tp_keys = self._expand_lookup_keys_by_rank(keys, group_id)
                num_ranks = len(multi_tp_keys) // len(keys)
                res = self.m_store.exists(multi_tp_keys)  # type: ignore[assignment]
                num_block = len(keys)
                if use_layerwise:
                    res = self.check_all_layers_exists(res, self.num_layers)
                    num_block = len(keys) // self.num_layers
                multi_tp_values = [
                    res[i * num_block : (i + 1) * num_block]  # type: ignore[index]
                    for i in range(num_ranks)
                ]
                ...
                if group_id < len(self.group_uses_align_state) and self.group_uses_align_state[group_id]:
                    group_hits = self.find_all_discontinuous_hit_positions(
                        multi_tp_values, ends, num_block, max_hit_position, self.cache_transfer_granularity
                    )
                else:
                    group_hits = self.find_all_continuous_hit_positions(
                        multi_tp_values, ends, num_block, max_hit_position, self.cache_transfer_granularity
                    )
                if not group_hits:
                    return 0
                max_hit_position = min(max_hit_position, group_hits[-1])
                hits.append(group_hits)
```

worker 侧真正的命中查询：一次 `exists` 批量问所有 rank 的 key，逐 group 取交集。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/metadata.py#L115-L125

```python
    def to_string(self):
        return (
            f"{self.key_metadata.model_name}"
            f"@pcp{self.key_metadata.pcp_rank}@dcp{self.key_metadata.dcp_rank}"
            f"@head_or_tp_rank:{self.key_metadata.head_or_tp_rank}"
            f"@pp_rank:{self.key_metadata.pp_rank}"
            f"@group:{self.key_metadata.kv_cache_group_id}"
            f"@cache_role:{self.key_metadata.cache_role}"
            f"@cache_family:{self.key_metadata.cache_family}"
            f"@{self.chunk_hash}"
        )
```

池里对象的 key 长什么样——决定了哪些实例之间能互相命中。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/metadata.py#L437-L465

```python
    def prepare_value(
        self,
        start: int,
        end: int,
        block_ids: list[int],
        kv_cache_group_id: int = 0,
        cache_role: str = "kv",
        block_id: int | None = None,
    ):
        addr_list: list[int] = []
        size_list: list[int] = []
        group_block_size = self.get_block_size(kv_cache_group_id)
        if block_id is None:
            block_idx = start // group_block_size
            if block_idx >= len(block_ids):
                return addr_list, size_list, 0
            block_id = block_ids[block_idx]
        group_addrs, group_block_len, group_block_stride = self._get_group_buffers(kv_cache_group_id, cache_role)
        length = len(group_block_len)
        if length == 0:
            return addr_list, size_list, block_id
        for index, base_addr in enumerate(group_addrs):
            block_len = group_block_len[index % length]
            block_stride = group_block_stride[index % length] if group_block_stride else block_len
            addr = base_addr + block_id * block_stride
            size = int(block_len / group_block_size * (end - start))
            addr_list.append(addr)
            size_list.append(size)
        return addr_list, size_list, block_id
```

一个 key 对应多少段内存：对每层的每个 K/V 张量各出一段 `(addr, size)`。worked example 的算式直接来自这里。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/__init__.py#L17-L30

```python
backend_map = {
    "mooncake": {
        "name": "MooncakeBackend",
        "path": "vllm_ascend.distributed.kv_transfer.kv_pool.ascend_store.backend.mooncake_backend",
    },
    "memcache": {
        "name": "MemcacheBackend",
        "path": "vllm_ascend.distributed.kv_transfer.kv_pool.ascend_store.backend.memcache_backend",
    },
    "yuanrong": {
        "name": "YuanrongBackend",
        "path": "vllm_ascend.distributed.kv_transfer.kv_pool.ascend_store.backend.yuanrong_backend",
    },
}
```

三个可选后端的全集。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L194-L212

```python
    def put(self, keys: list[str], addrs: list[list[int]], sizes: list[list[int]]):
        self.ensure_initialized()
        assert self.store is not None
        try:
            config = ReplicateConfig()
            if self.config.preferred_segment:
                config.preferred_segment = self.local_seg
            config.prefer_alloc_in_same_node = self.config.prefer_alloc_in_same_node
            res = self.store.batch_put_from_multi_buffers(keys, addrs, sizes, config)
            failed_codes = [int(value) for value in res if value < 0]
            failed_count = len(failed_codes)
            if failed_count:
                error_codes = sorted(set(failed_codes))
                logger.error(
                    "Failed to put %d keys out of %d. error_codes=%s. Check memory and store capacity.",
                    failed_count,
                    len(keys),
                    error_codes,
                )
```

后端的最后一跳：`batch_put_from_multi_buffers` 直接从注册过的 HBM 地址写入池，中间没有落到 host 的中转 buffer。

## docs/source/user_guide/feature_guide/kv_pool.md#L13-L22

```markdown
#### `kv_load_failure_policy`: KV Load Failure Handling Policy

`kv_load_failure_policy` is a top-level field in `kv-transfer-config`.

* `recompute`: When KV loading fails, vLLM rolls the request back to the last valid prefix and reschedules it to recompute the failed KV blocks. Hybrid attention models (e.g. DeepSeekV4, Qwen 3.5) are not supported yet.
* `fail`: When KV loading fails, the affected request is terminated directly with an error.

The default value in vLLM is `fail`. If you want the request to fall back to recomputation after a KV load failure, set it to `recompute`.

When `MultiConnector` is used, configure `kv_load_failure_policy` on the `MultiConnector` top-level `kv-transfer-config` instead of the child connectors.
```

加载失败的兜底策略，以及它必须配在 `MultiConnector` 顶层这一坑。

## docs/source/user_guide/feature_guide/kv_pool.md#L24-L43

````markdown
#### `kv_connector_extra_config`: Additional Configurable Parameters for Pooling

| Parameter | Description |
| :--- | :--- |
| `lookup_rpc_port` | Port for RPC Communication Between Pooling Scheduler Process and Worker Process: Each Instance Requires a Unique Port Configuration. |
| `load_async` | Whether to Enable Asynchronous Loading. The default value is false. |
| `backend` | Set the storage backend for kvpool (`mooncake`, `memcache`, `yuanrong`), with the default being `mooncake`. |
| `consumer_is_to_put` | Whether Decode node put KV Cache into KV Pool. The default value is false. |
| `consumer_is_to_load` | Whether Decode node load KV cache from KV Pool. The default value is false. |
| `use_layerwise` | Enable layer-by-layer KV save/load. Only supported on the Prefill node and requires the `memcache` backend. The default value is false. |
| `prefill_pp_size` | Prefill PP size, needs to be set when Prefill node enables PP. |
| `prefill_pp_layer_partition` | Prefill PP layer partition, needs to be set when Prefill node enables PP. |

### Environment Variable Configuration

To guarantee uniform hash generation, it is required to synchronize the PYTHONHASHSEED environment variable across all nodes upon enabling KV Pool.

```bash
export PYTHONHASHSEED=0
```
````

官方的配置项全表 + `PYTHONHASHSEED` 要求，事实表主要依据。

## docs/source/user_guide/feature_guide/kv_pool.md#L299-L314

````markdown
Currently, the key-value pool in PD Disaggregate only stores the kv cache generated by the Prefill node by default. In models using MLA, it is now supported that the Decode node stores the kv cache for use by the Prefill node, enabled by adding `consumer_is_to_put: true` to the AscendStoreConnector. If the Prefill node enables PP, `prefill_pp_size` or `prefill_pp_layer_partition` also needs to be set. Example as follows:

```python
{
    "kv_connector": "AscendStoreConnector",
    "kv_role": "kv_consumer",
    "kv_load_failure_policy": "recompute",
    "kv_connector_extra_config": {
        "lookup_rpc_port": "0",
        "backend": "mooncake",
        "consumer_is_to_put": true,
        "prefill_pp_size": 2,
        "prefill_pp_layer_partition": "30,31"
    }
}
```
````

D 节点回写池的适用范围（MLA 模型）与 PP 场景下的附加配置。

## docs/source/user_guide/feature_guide/kv_pool.md#L405-L412

```shell
KV_CONFIG='{
  "kv_connector": "AscendStoreConnector",
  "kv_role": "kv_both",
  "kv_connector_extra_config": {
     "backend": "mooncake",
     "lookup_rpc_port": "0"
     }
}'
```

PD 混合部署下最小可用配置，worked example 的配置片段来源。

## docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L5-L13

```markdown
Prefix caching is an important feature in LLM inference that can reduce prefill computation time drastically.

However, the performance gain from prefix caching is highly dependent on the cache hit rate, while the cache hit rate can be limited if one only uses on-chip memory for KV cache storage.

Hence, KV Cache Pool is proposed to utilize various types of storage including on-chip memory, DRAM, and SSD, making a pool for KV Cache storage while making the prefix of requests visible across all nodes, increasing the cache hit rate for all requests.

vLLM Ascend currently supports [MooncakeStore](https://github.com/kvcache-ai/Mooncake), one of the most recognized KV Cache storage engines.
```

官方对「为什么需要它」的表述。

## docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L38-L52

```markdown
**Workflow**:

1. The engine first checks for prefix hits in the on-chip memory cache.

2. After getting the number of hit tokens on on-chip memory, it queries the KV Pool via the connector. If there are additional hits in the KV Pool, we get the **additional blocks only** from the KV Pool, and get the rest of the blocks directly from on-chip memory to minimize the data transfer latency.

3. After the KV Caches in the KV Pool are loaded into on-chip memory, the remaining process is the same as Prefix Caching in on-chip memory.

### 2. Combining KV Cache Pool with Mooncake PD Disaggregation

When used together with Mooncake PD (Prefill-Decode) Disaggregation, the KV Cache Pool can further decouple prefill and decode stages across devices or nodes.

Currently, we only perform put and get operations of KV Pool for **Prefill Nodes**, and Decode Nodes get their KV Cache from Mooncake P2P KV Connector, i.e., MooncakeConnector.
```

与 prefix caching 的三步协作，以及 PD 分离下默认只有 P 节点读写池。

## docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L84-L91

```markdown
1. When looking up a key in KV Pool, if we cannot find the key, there is no Cache Hit for this specific block; we return no hit for this block and do not look up further blocks for the current request.
2. Similarly, when we are trying to put a block into KV Pool and it fails, we do not put further blocks (subject to change).

## Limitations

1. Currently, MooncakeStore for vLLM Ascend only supports DRAM as the storage for KV Cache Pool.

2. For now, if we successfully looked up a key and found it exists, but failed to get it when calling KV Pool's get function, we just output a log indicating the get operation failed and keep going; hence, the accuracy of that specific request may be affected.
```

官方 DFX 与限制条款。注：第 2 条与现在的 `kv_load_failure_policy` 已不一致，第 1 条也与用户指南里的 SSD offload 章节不一致，设计文档已落后于实现。
