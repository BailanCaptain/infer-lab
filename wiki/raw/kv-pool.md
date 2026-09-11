# KV Pool 引用片段

来源仓库 `vllm-ascend@28bf3a2e`（ref main）。

## docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L3-L15

```markdown
## Why KV Cache Pool?

Prefix caching is an important feature in LLM inference that can reduce prefill computation time drastically.

However, the performance gain from prefix caching is highly dependent on the cache hit rate, while the cache hit rate can be limited if one only uses on-chip memory for KV cache storage.

Hence, KV Cache Pool is proposed to utilize various types of storage including on-chip memory, DRAM, and SSD, making a pool for KV Cache storage while making the prefix of requests visible across all nodes, increasing the cache hit rate for all requests.

vLLM Ascend currently supports [MooncakeStore](https://github.com/kvcache-ai/Mooncake), one of the most recognized KV Cache storage engines.

While one can utilize MooncakeStore in vLLM V1 engine by setting it as a remote backend of LMCache with GPU (see [Tutorial](https://github.com/LMCache/LMCache/blob/dev/examples/kv_cache_reuse/remote_backends/mooncakestore/README.md)), we find it would be better to integrate a connector that directly supports MooncakeStore and can utilize the data transfer strategy that best fits Huawei NPU hardware.

Hence, we propose to integrate MooncakeStore with a brand new **MooncakeStoreConnectorV1**, which is indeed largely inspired by **LMCacheConnectorV1** (see the [How is MooncakeStoreConnectorV1 Implemented?](#how-is-mooncakestoreconnectorv1-implemented) section).
```

官方设计文档对「为什么需要 KV Pool」的原始表述：HBM 容量限制了前缀缓存命中率，池把 DRAM/SSD 也纳进来并跨节点共享前缀。用于 `## 为什么需要它`。

## docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L38-L44

```markdown
**Workflow**:

1. The engine first checks for prefix hits in the on-chip memory cache.

2. After getting the number of hit tokens on on-chip memory, it queries the KV Pool via the connector. If there are additional hits in the KV Pool, we get the **additional blocks only** from the KV Pool, and get the rest of the blocks directly from on-chip memory to minimize the data transfer latency.

3. After the KV Caches in the KV Pool are loaded into on-chip memory, the remaining process is the same as Prefix Caching in on-chip memory.
```

官方文档明确「只取增量块」的分工，是 KV Pool 与 prefix caching 关系的一手依据。用于 `## 为什么需要它` 与 `## 常见误解`。

## docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L46-L52

```markdown
### 2. Combining KV Cache Pool with Mooncake PD Disaggregation

When used together with Mooncake PD (Prefill-Decode) Disaggregation, the KV Cache Pool can further decouple prefill and decode stages across devices or nodes.

Currently, we only perform put and get operations of KV Pool for **Prefill Nodes**, and Decode Nodes get their KV Cache from Mooncake P2P KV Connector, i.e., MooncakeConnector.

The key benefit of doing this is that we can keep the gain in performance by computing less with Prefix Caching from on-chip memory and KV Pool for Prefill Nodes, while not sacrificing the data transfer efficiency between Prefill and Decode nodes with P2P KV Connector that transfers KV Caches between NPU devices directly.
```

说明 PD 分离下默认只有 Prefill 侧读写池，Decode 侧走 P2P connector。用于 `## 怎么工作` 与 `## 常见误解`。

## docs/source/developer_guide/Design_Documents/KV_Cache_Pool_Guide.md#L82-L91

```markdown
## DFX

1. When looking up a key in KV Pool, if we cannot find the key, there is no Cache Hit for this specific block; we return no hit for this block and do not look up further blocks for the current request.
2. Similarly, when we are trying to put a block into KV Pool and it fails, we do not put further blocks (subject to change).

## Limitations

1. Currently, MooncakeStore for vLLM Ascend only supports DRAM as the storage for KV Cache Pool.

2. For now, if we successfully looked up a key and found it exists, but failed to get it when calling KV Pool's get function, we just output a log indicating the get operation failed and keep going; hence, the accuracy of that specific request may be affected. We will handle this situation by falling back the request and re-compute everything assuming there's no prefix cache hit (or even better, revert only one block and keep using the Prefix Caches before that).
```

lookup 遇首个未命中即停（只认连续前缀）、以及 get 失败的精度风险。用于 `## 事实表` 与 `## 常见误解`。

## docs/source/user_guide/feature_guide/kv_pool.md#L13-L43

```markdown
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

### Environment Variable Configuration

To guarantee uniform hash generation, it is required to synchronize the PYTHONHASHSEED environment variable across all nodes upon enabling KV Pool.

```bash
export PYTHONHASHSEED=0
```
```

配置项默认值与约束的一手来源，以及 `PYTHONHASHSEED` 的硬性要求。用于 `## 事实表`。

## docs/source/user_guide/feature_guide/kv_pool.md#L107-L118

```markdown
| Parameter | Description |
| :--- | :--- |
| `metadata_server` | Configured as **P2PHANDSHAKE**. |
| `protocol` | Must be set to `ascend` on the NPU. |
| `device_name` | Leave as empty string `""`.The ascend protocol does not use device names. |
| `master_server_address` | IP and port of the master service. It can also be set via the **MOONCAKE_MASTER** environment variable, which takes precedence over this configuration item (useful for injecting the master address through Kubernetes). |
| `global_segment_size` | Registered memory size per card to the KV Pool. **Needs to be aligned to 1GB.** It can also be set via the **MOONCAKE_GLOBAL_SEGMENT_SIZE** environment variable, which takes precedence over this configuration item. |
| `preferred_segment` | Whether to prefer storing KV on the local segment when putting objects to the KV Pool. Defaults to **false**. |
| `prefer_alloc_in_same_node` | Whether to prefer allocating KV on the same node. Defaults to **true**. |
| `enable_ssd_offload` | Set to `true` to enable SSD offload. Environment variables are not supported. |
| `ssd_offload_path` | **Required when `enable_ssd_offload` is `true`.** Absolute path to a local directory where Mooncake stores offloaded KV data (for example, `/nvme/mooncake_offload`). The directory must exist and be writable by the vLLM process; create it before startup (`mkdir -p <path>`). Relative paths, symbolic links, and paths containing `..` are rejected by Mooncake. |
| `tenant_id` | Optional Mooncake tenant namespace. Missing, `null`, empty, or whitespace-only values use `default`; surrounding whitespace is removed. All Prefill, Decode, scheduler, and replica instances that share KV entries must use the same tenant ID. Non-default tenants require Mooncake `0.3.12` or later. |
```

`mooncake.json` 侧的池容量与协议约束（每卡 `global_segment_size` 要 1GB 对齐、NPU 上 `protocol` 必须是 `ascend`）。用于 `## 事实表` 与 `## 拿真实数字走一遍`。

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

PD 混布（单实例）下最小可用配置，用于 `## 拿真实数字走一遍` 的配置片段。

## docs/source/user_guide/feature_guide/kv_pool.md#L1100-L1125

```bash
python3 -m vllm.entrypoints.openai.api_server \
    --model /xxxxx/Qwen2.5-7B-Instruct \
    --port 8100 \
    --trust-remote-code \
    --enforce-eager \
    --no-enable-prefix-caching \
    --tensor-parallel-size 1 \
    --data-parallel-size 1 \
    --max-model-len 10000 \
    --block-size 128 \
    --max-num-batched-tokens 4096 \
    --kv-transfer-config \
    '{
    "kv_connector": "AscendStoreConnector",
    "kv_role": "kv_both",
    "kv_load_failure_policy": "recompute",
    "kv_connector_extra_config": {
        "lookup_rpc_port": "1",
        "backend": "yuanrong"
    }
}'

`lookup_rpc_port` is the RPC port used between the pooling scheduler process
and the worker process. Each instance must use a unique port value.
```

完整启动命令示例（含 `--block-size 128`、`kv_load_failure_policy`），以及 `lookup_rpc_port` 的官方说明。用于 `## 拿真实数字走一遍` 与 `## 事实表`。

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

两个注册名指向同一个类，说明 `MooncakeConnectorStoreV1` 是历史别名。用于 `## 事实表`。

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

连接器按 role 分裂成 `KVPoolScheduler` 与 `KVPoolWorker`，且 lookup 服务只在非 layerwise 的 rank 0 worker 上起。用于 `## 怎么工作` 的图与 `## 事实表`。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L232-L263

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

保存路径的角色门禁：`kv_consumer` 不显式开 `consumer_is_to_put` 就整段 return。用于 `## 怎么工作` 与 `## 常见误解`。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L291-L334

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

调度进程与 worker 之间那一跳 zmq REQ/REP 的服务端：收块哈希、回命中 token 数。用于 `## 怎么工作` 的图。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L456-L511

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

调度侧查池的完整入口：consumer 默认不 load、prompt 不足一个传输粒度直接返回 0、以及 `need_to_allocate = 池命中 − HBM 命中` 这条增量公式。用于 `## 怎么工作`、`## 拿真实数字走一遍`、`## 常见误解`。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L521-L545

```python
        # In layerwise mode, even when vLLM has local cached tokens, we still
        # need to load KV cache from the pool because layerwise transfer loads
        # per-layer data that may not be in HBM.
        force_layerwise_load = self.use_layerwise and store_skip_tokens > 0
        if need_to_allocate <= 0 and not force_layerwise_load:
            return 0, False

        self.load_specs[request.request_id] = LoadSpec(
            vllm_cached_tokens=num_computed_tokens,
            kvpool_cached_tokens=num_external_hit_tokens,
            can_load=force_layerwise_load,
            kvpool_store_skip_tokens=store_skip_tokens,
        )
        logger.debug(
            "KV pool load spec created req=%s vllm_cached=%d kvpool_cached=%d "
            "need_to_allocate=%d load_async=%s use_layerwise=%s",
            request.request_id,
            num_computed_tokens,
            num_external_hit_tokens,
            need_to_allocate,
            self.load_async,
            self.use_layerwise,
        )

        return need_to_allocate, self.load_async and not self.use_layerwise
```

`LoadSpec` 的两个字段（HBM 已算 token 数、池命中 token 数）是后面 worker 决定搬哪一段的唯一依据；返回值第二项表示是否异步加载。用于 `## 怎么工作` 与 `## 事实表`。

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

`lookup_rpc_port` 实际拼成的是一个 ipc 路径而不是 TCP 端口，同机同名会撞。用于 `## 事实表` 与 `## 常见误解`。

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

`backend` 默认 `mooncake`，非法值直接抛错；layerwise 的 GVA 路径只在 `memcache` 下启用。用于 `## 事实表`。

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

每个 KV 张量一个块占多少字节的算式，是 `## 拿真实数字走一遍` 里 256 KiB / 14 MiB 的出处。

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

注册阶段把 HBM 里 KV 张量的地址区间交给后端（`register_buffer`），后续 get/put 才能直接写进 HBM；注释也给出了 `block_len = block_size * num_kv_head_per_local_rank * head_dim * elem_size`。用于 `## 怎么工作` 与 `## 拿真实数字走一遍`。

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
            logger.debug(
                "KV pool worker calls backend get request=%s token_len=%d groups=%s keys=%d sample_keys=%s",
                request.req_id,
                token_len,
                load_group_ids,
                len(key_list_c),
                key_list_c[:3],
            )
            ret = self.m_store.get(key_list_c, addr_list_c, size_list_c)
```

同步加载路径：`mask_num` 跳过 HBM 已有的整块，只为剩下的块拼 (key, addr, size)，再一次性 `m_store.get`；各 rank 用 `_circular_shift` 错开起点以分散池侧热点。用于 `## 怎么工作` 与 `## 拿真实数字走一遍`。

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

池对象 key 的确切字符串格式，决定了哪些实例之间能互相复用前缀。用于 `## 事实表` 与 `## 拿真实数字走一遍`。

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

一个 key 对应的 value 由多段 HBM 地址拼起来：每个 KV 张量出一段 `base_addr + block_id * block_stride`。用于 `## 怎么工作` 与 `## 拿真实数字走一遍`。

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

源码侧可选后端的全集，与文档的 `backend` 取值一致。用于 `## 事实表`。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L194-L245

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
                logger.debug("Failed to put key details. keys=%s, result=%s", keys, res)
                if self._lazy_init:
                    logger.warning("First DSV4(compress) request failure is expected. This is normal behavior.")
        except Exception as e:
            logger.error(
                "Failed to put %d keys out of %d. type=%s, error=%s. Check store state and memory.",
                len(keys),
                len(keys),
                type(e).__name__,
                e,
            )
            logger.debug("Failed to put key details. keys=%s", keys)
            if self._lazy_init:
                logger.warning("First DSV4(compress) request failure is expected. This is normal behavior.")

    def get(self, keys: list[str], addrs: list[list[int]], sizes: list[list[int]]):
        if self._lazy_init and not self._store_initialized:
            logger.error(
                "Failed to get %d keys out of %d. Store is not initialized; "
                "call put() first to trigger initialization.",
                len(keys),
                len(keys),
            )
            logger.debug("Failed to get key details. keys=%s", keys)
            return
        assert self.store is not None
        logger.debug(
            "MooncakeBackend.get enter keys=%d sample_keys=%s",
            len(keys),
            keys[:3],
        )
        try:
            res = self.store.batch_get_into_multi_buffers(keys, addrs, sizes)
```

Mooncake 后端最终调用的两个批量接口 `batch_put_from_multi_buffers` / `batch_get_into_multi_buffers`，说明搬运是「多段 HBM 缓冲 ↔ 池对象」而非先落地本地缓冲。用于 `## 怎么工作`。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/kv_transfer.py#L854-L865

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

保存走后台发送线程：先等 `torch.npu.Event` 同步确认这一步的 KV 已写进 HBM，再 `put`。用于 `## 怎么工作` 的图。

## docs/source/user_guide/feature_guide/kv_pool.md#L63-L78

````markdown
    * Install Mooncake

        Mooncake is the serving platform for Kimi, a leading LLM service provided by Moonshot AI.
        The Mooncake wheel requires glibc 2.35 or later. Check the installed glibc version before installation:

        ```shell
        ldd --version
        ```

        Install Mooncake with pip:

        ```shell
        python3 -m pip install mooncake-transfer-engine-npu==0.3.11.post1 --extra-index-url https://mirrors.aliyun.com/pypi/web/simple
        ```

        Mooncake `0.3.11.post1` remains supported when `tenant_id` is omitted or resolves to `default`. A non-default tenant requires a Mooncake version whose `MooncakeDistributedStore.setup()` accepts `tenant_id`; use Mooncake `0.3.12` or later for multi-tenant deployments.
````

Mooncake 后端的版本下限，以及多租户所需的更高版本。用于 `## 事实表`。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L63-L68

```python
class MooncakeBackend(Backend):
    def __init__(self, parallel_config: ParallelConfig, lazy_init: bool = False, contribute_memory: bool = True):
        self.parallel_config = parallel_config
        self.config = MooncakeStoreConfig.load_from_env()
        if self.config.protocol != "ascend":
            raise NotImplementedError(f"MooncakeBackend does not support protocol {self.config.protocol!r}.")
```

文档说的「NPU 上 protocol 必须是 ascend」在源码里是一条硬断言。用于 `## 事实表`。
