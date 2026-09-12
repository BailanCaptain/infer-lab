# KV Pool 引用片段

## vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/kv_pool.md#L3-L43

```markdown
## 1. Environmental Dependencies

* Software:
    * CANN >= 8.5.0
    * vLLM：main branch
    * vLLM-Ascend：main branch
    * mooncake：>= 0.3.11.post1

### KV Pool Parameter Description

#### `kv_load_failure_policy`: KV Load Failure Handling Policy

`kv_load_failure_policy` is a top-level field in `kv-transfer-config`.

* `recompute`: When KV loading fails, vLLM rolls the request back to the last valid prefix and reschedules it to recompute the failed KV blocks. Hybrid attention models (e.g. DeepSeekV4, Qwen 3.5) are not supported yet.
* `fail`: When KV loading fails, the affected request is terminated directly with an error.

The default value in vLLM is `fail`. If you want the request to fall back to recomputation after a KV load failure, set it to `recompute`.

When `MultiConnector` is used, configure `kv_load_failure_policy` on the `MultiConnector` top-level `kv-transfer-config` instead of the child connectors.

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
```

官方部署文档的环境依赖与 `kv_connector_extra_config` 参数表；页面的「事实表」默认值、`kv_load_failure_policy` 两种取值都取自这里。v0.23.0 的同名文件 L11-L43 内容逐字相同，故该结论版本一致。

## https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/kv_pool.html

上一节本地文件渲染后的线上地址（`latest` 段对应 main）。用于给读者一个可点开的官方入口；实测该页确实列出 `lookup_rpc_port` / `load_async` / `backend` / `consumer_is_to_put` / `consumer_is_to_load` / `use_layerwise` / `prefill_pp_size` / `prefill_pp_layer_partition` 与 CANN >= 8.5.0、mooncake >= 0.3.11.post1。线上 `latest` 比钉住的 28bf3a2e 略新（多出 `qos_priority` 一行），页面只按钉住的 commit 写。

## vllm-ascend@28bf3a2e:docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L3-L15

```markdown
## Why KV Cache Pool?

Prefix caching is an important feature in LLM inference that can reduce prefill computation time drastically.

However, the performance gain from prefix caching is highly dependent on the cache hit rate, while the cache hit rate can be limited if one only uses on-chip memory for KV cache storage.

Hence, KV Cache Pool is proposed to utilize various types of storage including on-chip memory, DRAM, and SSD, making a pool for KV Cache storage while making the prefix of requests visible across all nodes, increasing the cache hit rate for all requests.

vLLM Ascend currently supports [MooncakeStore](https://github.com/kvcache-ai/Mooncake), one of the most recognized KV Cache storage engines.

While one can utilize MooncakeStore in vLLM V1 engine by setting it as a remote backend of LMCache with GPU (see [Tutorial](https://github.com/LMCache/LMCache/blob/dev/examples/kv_cache_reuse/remote_backends/mooncakestore/README.md)), we find it would be better to integrate a connector that directly supports MooncakeStore and can utilize the data transfer strategy that best fits Huawei NPU hardware.

Hence, we propose to integrate MooncakeStore with a brand new **MooncakeStoreConnectorV1**, which is indeed largely inspired by **LMCacheConnectorV1** (see the [How is MooncakeStoreConnectorV1 Implemented?](#how-is-mooncakestoreconnectorv1-implemented) section).
```

上游对「为什么需要 KV Pool」的一手陈述：命中率受限于片上内存容量、池要跨节点可见。用于「为什么需要它」一节。v0.23.0 同名文件同段内容一致。

## vllm-ascend@28bf3a2e:docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L38-L52

```markdown
**Workflow**:

1. The engine first checks for prefix hits in the on-chip memory cache.

2. After getting the number of hit tokens on on-chip memory, it queries the KV Pool via the connector. If there are additional hits in the KV Pool, we get the **additional blocks only** from the KV Pool, and get the rest of the blocks directly from on-chip memory to minimize the data transfer latency.

3. After the KV Caches in the KV Pool are loaded into on-chip memory, the remaining process is the same as Prefix Caching in on-chip memory.

### 2. Combining KV Cache Pool with Mooncake PD Disaggregation

When used together with Mooncake PD (Prefill-Decode) Disaggregation, the KV Cache Pool can further decouple prefill and decode stages across devices or nodes.

Currently, we only perform put and get operations of KV Pool for **Prefill Nodes**, and Decode Nodes get their KV Cache from Mooncake P2P KV Connector, i.e., MooncakeConnector.

The key benefit of doing this is that we can keep the gain in performance by computing less with Prefix Caching from on-chip memory and KV Pool for Prefill Nodes, while not sacrificing the data transfer efficiency between Prefill and Decode nodes with P2P KV Connector that transfers KV Caches between NPU devices directly.
```

官方说明 KV Pool 与片上 prefix caching 的分工（只取多出来的块），以及 PD 分离下默认只有 Prefill 节点读写池。v0.23.0 同名文件 L38-L52 内容一致。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/__init__.py#L39-L49

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

证明 `AscendStoreConnector` 与旧名 `MooncakeConnectorStoreV1` 指向同一个类，配置里两个名字都能用。

## vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/__init__.py#L39-L49

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

同一段在 v0.23.0 逐字相同，用来说明「两个注册名」这条结论版本一致。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L85-L116

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

连接器一体两面：SCHEDULER 角色造 `KVPoolScheduler`，WORKER 角色造 `KVPoolWorker`，且只有 rank 0 的 worker 起 `LookupKeyServer`。用于「怎么工作」的进程结构与图。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L232-L252

```python
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

main 上 layerwise 的 `save_kv_layer` 也认 `consumer_is_to_put`。与下一段 v0.23.0 对照，是本页标 `[!]` 的版本差异。

## vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L234-L253

```python
    def save_kv_layer(
        self, layer_name: str, kv_layer: torch.Tensor, attn_metadata: "AttentionMetadata", **kwargs
    ) -> None:
        if not self.use_layerwise:
            return

        if self.kv_role == "kv_consumer":
            # Don't do save if the role is kv_consumer
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

v0.23.0 上 layerwise 路径只看 `kv_role`，`consumer_is_to_put` 被忽略——同一份配置在两版行为不同。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L291-L334

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
                logger.debug(
                    "KV pool lookup response token_len=%d groups=%s hit_tokens=%d",
                    token_len,
                    kv_group_ids,
                    result,
                )
                response = result.to_bytes(4, "big")
                self.socket.send(response)

        self.thread = threading.Thread(target=process_request, daemon=True)
        self.thread.start()
```

查表走的是 worker 进程里一个 ZMQ REP 后台线程，调度器进程通过它问「池里有多少命中」。用于「怎么工作」的跨进程调用链与时序图。v0.23.0 L293-L336 内容相同。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L456-L511

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

`get_num_new_matched_tokens` 的主体：`kv_consumer` 默认直接返回 0；命中数减去 HBM 已命中的 `num_computed_tokens` 才是要从池里搬的量；整段提示命中时还要退 1 个 token。v0.23.0 L508-L563 除 eagle 那三行外相同。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L161-L172

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

`backend` 默认 `mooncake`、不认的名字直接 `ValueError`、以及 `use_layerwise` 只在 `memcache` 上走 GVA 路径，都出自这一段。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L1034-L1049

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

`lookup_rpc_port` 其实只是 IPC 套接字文件名的一段，不是 TCP 端口——「常见误解」一节的依据。v0.23.0 L1146-L1161 逐字相同。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/__init__.py#L17-L30

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

三个可选后端的登记表，`backend` 取值范围出自这里。v0.23.0 同路径同内容。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/base.py#L20-L56

```python
    @abstractmethod
    def set_device(self):
        pass

    @abstractmethod
    def register_buffer(self, ptrs: list[int], lengths: list[int]):
        pass

    @abstractmethod
    def exists(self, keys: list[str]) -> list[int]:
        pass

    def batch_is_exist(self, keys: list[str]) -> list[int]:
        return self.exists(keys)

    def batch_get_key_info(self, keys: list[str]):
        raise NotImplementedError(f"{type(self).__name__} does not support batch_get_key_info")

    def batch_alloc(self, keys: list[str], sizes: list[int]) -> list[int]:
        raise NotImplementedError(f"{type(self).__name__} does not support batch_alloc")

    def batch_add_lease(self, keys: list[str], lease_ttl_ms: int = 0) -> list[int]:
        raise NotImplementedError(f"{type(self).__name__} does not support batch_add_lease")

    def batch_remove_lease(self, keys: list[str]) -> int:
        raise NotImplementedError(f"{type(self).__name__} does not support batch_remove_lease")

    def batch_write_finish(self, keys: list[str], results: list[int]) -> list[int]:
        raise NotImplementedError(f"{type(self).__name__} does not support batch_write_finish")

    @abstractmethod
    def put(self, keys: list[str], addrs: list[list[int]], sizes: list[list[int]]):
        pass

    @abstractmethod
    def get(self, keys: list[str], addrs: list[list[int]], sizes: list[list[int]]):
        pass
```

后端只需实现四个必选动作：`register_buffer` / `exists` / `put` / `get`，且 put/get 收的是裸地址与长度而不是张量。v0.23.0 的同一接口在 `backend/backend.py#L20-L56`，方法签名一致。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L629-L644

```python
    @staticmethod
    def _as_cache_tuple(cache_or_caches) -> tuple[torch.Tensor, ...]:
        if isinstance(cache_or_caches, torch.Tensor):
            return (cache_or_caches,)
        return tuple(cache_or_caches)

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

每块字节数 `block_len = cache[0].numel() * element_size` 的定义，以及「一层可能注册成 1 个或多个张量」（`_as_cache_tuple`）——「拿真实数字走一遍」的算式基础。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L743-L764

```python
        self.kv_caches_base_addr = []

        registered_regions: dict[int, tuple[int, int]] = {}
        for cache_or_caches in kv_caches.values():
            for cache in self._as_cache_tuple(cache_or_caches):
                base_addr = cache.data_ptr()
                _, _, region_len, _ = self._get_cache_block_metadata(cache)
                if not isinstance(region_len, int):
                    region_len = 0
                self.kv_caches_base_addr.append(base_addr)
                storage_key = self._get_storage_key(cache)
                start = base_addr
                end = base_addr + region_len
                if storage_key in registered_regions:
                    old_start, old_end = registered_regions[storage_key]
                    registered_regions[storage_key] = (min(old_start, start), max(old_end, end))
                else:
                    registered_regions[storage_key] = (start, end)

        self._align_kv_ptrs(registered_regions)
        ptrs = [start for start, _ in registered_regions.values()]
        lengths = [end - start for start, end in registered_regions.values()]
```

注册阶段把每个 KV cache 张量的地址区间合并成若干大块，准备交给后端。说明搬运走的是 HBM 原地址、没有额外的中转缓冲。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L790-L819

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

`register_kv_caches` 的收尾：算出 `page_size_bytes`、把地址交给后端 `register_buffer`、起搬运线程。注释里 `block_len[0] = block_size * num_kv_head_per_local_rank * head_dim * elem_size` 是「拿真实数字走一遍」里每块字节数公式的上游确认。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L905-L937

```python
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
            logger.debug(
                "KV pool worker calls backend get request=%s token_len=%d groups=%s keys=%d sample_keys=%s",
                request.req_id,
                token_len,
                load_group_ids,
                len(key_list_c),
                key_list_c[:3],
            )
            ret = self.m_store.get(key_list_c, addr_list_c, size_list_c)
            if ret is not None and any(r != 0 for r in ret):
                missing_block_ids = record_failed_blocks(
                    block_id_list_c,
                    ret,
                )
                if len(request.block_ids_by_group) == 1:
                    self._invalid_block_ids.update(missing_block_ids)
                elif missing_block_ids:
                    logger.error(
                        "KV load failed for hybrid request %s. "
                        "Skip invalid-block fallback to avoid scheduler crash. "
                        "failed_blocks=%s",
                        request.req_id,
                        missing_block_ids,
                    )
```

同步 get 路径：按 key 组出地址与长度，按 `tp_rank` 循环错位以打散各卡对同一个 key 的并发压力，失败的块记进 `_invalid_block_ids`。v0.23.0 L818-L850 结构相同。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_worker.py#L1701-L1719

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

写回路径：前向结束后录一个 NPU event，把请求丢进发送线程队列。说明 put 是后台线程做的，但 `wait_for_save` 会 `join()` 等队列排空。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L854-L865

```python
            if self.kv_role == "kv_consumer":
                keys, addrs, sizes = self._decode_adaptor_prefill_pp(
                    keys,
                    addrs,
                    sizes,
                    kv_cache_group_id=group_id,
                )
            if current_event is not None:
                current_event.synchronize()
            self.m_store.put(keys, addrs, sizes)
            if self.enable_kv_event and stored_events:
                self.update_kv_event(stored_events)
```

发送线程真正调用后端 `put` 的地方：先 `synchronize()` 等前向把 KV 写进 HBM，再从 HBM 地址直接 put。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/metadata.py#L115-L125

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

池里 key 的完整组成：模型名 + 各并行维度的 rank + group + chunk hash。解释了为什么改并行切分或模型名会让旧数据全部失效。

## vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/config_data.py#L66-L76

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

v0.23.0 的 key 格式逐字相同，只是模块名还叫 `config_data.py`（main 上改名为 `metadata.py`）——key 兼容，import 路径不兼容。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/metadata.py#L437-L465

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

一条 key 对应的 value 是一串 (addr, size)：对该 group 的**每一个** cache 张量（逐层、K 与 V 各一条）都算出 `base_addr + block_id * block_stride`。这是「一条 key 覆盖整块的所有层」以及每条 key 搬多少字节的依据。
