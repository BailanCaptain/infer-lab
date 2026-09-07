# Recompute CPU Offload — 源码片段

## vllm_ascend/distributed/kv_transfer/__init__.py#L91-L95

```python
    KVConnectorFactory.register_connector(
        "RecomputeCPUOffloadConnector",
        "vllm_ascend.distributed.kv_transfer.kv_pool.recompute_cpu_offload.recompute_cpu_offload_connector",
        "RecomputeCPUOffloadConnectorV1",
    )
```

配置里写的 `kv_connector: "RecomputeCPUOffloadConnector"` 实际解析到哪个类。

## vllm_ascend/platform.py#L966-L996

```python
    # recompute_scheduler_enable: only supported on PD-disaggregated D nodes
    if scheduler_extension_config.recompute_scheduler_enable:
        kv_transfer_config = vllm_config.kv_transfer_config
        kv_role = getattr(kv_transfer_config, "kv_role", None)
        if kv_role == "kv_producer":
            logger.warning(
                "recompute_scheduler_enable is ignored on PD-disaggregated P nodes "
                "(kv_role='kv_producer') and will be deprecated on P nodes in a future release. "
                "Please remove it from P-node configs and keep it only on PD-disaggregated D nodes "
                "(kv_role='kv_consumer')."
            )
            # Write the fix back into vllm_config.additional_config so worker
            # processes (which re-create AscendConfig) observe recompute disabled.
            additional_scheduler_config = additional_config.get("scheduler_config")
            if additional_scheduler_config is None:
                additional_scheduler_config = {}
                additional_config["scheduler_config"] = additional_scheduler_config
            additional_scheduler_config["recompute_scheduler_enable"] = False
        elif kv_transfer_config is None or kv_role != "kv_consumer":
            raise ValueError(
                "recompute_scheduler_enable can only be enabled on PD-disaggregated D nodes "
                f"(kv_role='kv_consumer', but got kv_role={kv_role!r}), and is not supported in PD-mixed mode."
            )
        else:
            async_scheduling = vllm_config.scheduler_config.async_scheduling
            recompute_scheduler_config = RecomputeSchedulerConfig.initialize_from_config(vllm_config)
            recompute_scheduler_config.scheduler_cls = _get_recompute_scheduler_cls(
                async_scheduling=async_scheduling,
                dyntra_lb_enabled=dyntra_lb_config.enabled,
            )
            vllm_config.scheduler_config = recompute_scheduler_config
```

`recompute_scheduler_enable` 的启动期校验：P 节点静默关闭、PD 混合直接报错、只有 D 节点才把 `scheduler_cls` 换成 `RecomputeScheduler`。这是「为什么只在 PD 分离 D 节点可用」的直接依据。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/recompute_cpu_offload_connector.py#L39-L70

```python
# Default CPU capacity: 8 GB
DEFAULT_CPU_CAPACITY_BYTES = 8 * (1024**3)


class RecomputeCPUOffloadConnectorV1(KVConnectorBase_V1, SupportsHMA):
    """CPU KV cache preservation for recompute-preempted requests."""

    def __init__(
        self,
        vllm_config: VllmConfig,
        role: KVConnectorRole,
        kv_cache_config: "KVCacheConfig | None" = None,
    ):
        super().__init__(vllm_config, role, kv_cache_config)

        extra_config = self._kv_transfer_config.kv_connector_extra_config or {}
        cpu_capacity_bytes = int(extra_config.get("cpu_bytes_to_use", DEFAULT_CPU_CAPACITY_BYTES))
        enable_offload_prefix_caching = extra_config.get("enable_offload_prefix_caching", False)
        if not isinstance(enable_offload_prefix_caching, bool):
            raise ValueError(f"enable_offload_prefix_caching must be a boolean, got {enable_offload_prefix_caching!r}")
        world_size = vllm_config.parallel_config.world_size
        cpu_capacity_per_rank = cpu_capacity_bytes // world_size
        if "cpu_bytes_to_use_per_rank" in extra_config:
            explicit = int(extra_config["cpu_bytes_to_use_per_rank"])
            if explicit != cpu_capacity_per_rank:
                logger.warning(
                    "cpu_bytes_to_use_per_rank (%.2f GB) != "
                    "cpu_bytes_to_use/world_size (%.2f GB). Using per-rank value.",
                    explicit / (1024**3),
                    cpu_capacity_per_rank / (1024**3),
                )
            cpu_capacity_per_rank = explicit
```

三个配置项的默认值与优先级：`cpu_bytes_to_use` 默认 8 GiB 且要除以 `world_size`，`cpu_bytes_to_use_per_rank` 存在时直接覆盖，`enable_offload_prefix_caching` 默认 `False`。

## vllm_ascend/core/recompute_scheduler.py#L415-L467

```python
                    transfer_config = self.vllm_config.kv_transfer_config
                    if transfer_config is not None and not transfer_config.is_kv_producer:
                        recomputed_req = preempted_req
                        recomputed_req_id = recomputed_req.request_id
                        recomputed_block_ids = self.kv_cache_manager.get_block_ids(recomputed_req_id)
                        recomputed_num_computed_tokens = recomputed_req.num_computed_tokens
                        preempt_hook = (
                            getattr(self.connector, "update_state_before_preempt", None)
                            if self.connector is not None
                            else None
                        )
                        offloaded = False
                        if preempt_hook is not None:
                            offloaded = bool(
                                preempt_hook(
                                    recomputed_req,
                                    recomputed_block_ids,
                                    recomputed_num_computed_tokens,
                                )
                            )
                        if offloaded:
                            logger.info(
                                "[RecomputeScheduler] Recompute preemption offload "
                                "enabled for request %s, computed_tokens=%d.",
                                recomputed_req_id,
                                recomputed_num_computed_tokens,
                            )
                            preempted_req_data.append(
                                PreemptedRequestData(
                                    req_id=recomputed_req_id,
                                    block_ids=recomputed_block_ids,
                                    num_computed_tokens=recomputed_num_computed_tokens,
                                )
                            )
                            self._preempt_request(
                                recomputed_req,
                                scheduled_timestamp,
                                drop_stale_output=self.requires_kv_delivery,
                            )
                            preempted_reqs.append(recomputed_req)
                        else:
                            logger.info(
                                "[RecomputeScheduler] Recompute preemption falls back "
                                "without offload for request %s, computed_tokens=%d.",
                                recomputed_req_id,
                                recomputed_num_computed_tokens,
                            )
                            self._finish_recomputed_request(
                                recomputed_req,
                                recomputed_reqs,
                            )
                        if recomputed_req == request:
                            break
```

换出决策的唯一分叉点：`allocate_slots` 返回 `None` 后调用 `update_state_before_preempt`；返回 `True` 走保留 KV 的抢占，返回 `False` 走「终止请求、退回 P 节点重算」。

## vllm_ascend/core/recompute_scheduler.py#L222-L239

```python
    def _finish_recomputed_request(
        self,
        request: Request,
        recomputed_reqs: list[RecomputeReqInfo],
    ) -> None:
        """Finish a fallback-recomputed request through the normal abort path."""
        recomputed_reqs.append(
            RecomputeReqInfo(
                request.request_id,
                request.output_token_ids,
                request.client_index,
            )
        )
        finished_reqs = self.finish_requests(
            request.request_id,
            RequestStatus.FINISHED_ABORTED,
        )
        assert [(r.request_id, r.client_index) for r in finished_reqs] == [(request.request_id, request.client_index)]
```

普通 recompute 抢占的实际动作：请求被 `FINISHED_ABORTED` 终止，而不是留在 D 节点排队。

## vllm_ascend/core/recompute_scheduler.py#L1054-L1073

```python
    @staticmethod
    def _add_recomputed_outputs(
        scheduler_output: SchedulerOutput,
        outputs: dict[int, list[EngineCoreOutput]],
    ) -> None:
        """Add terminal outputs for requests that must retry on prefill."""
        recomputed_reqs = getattr(scheduler_output, "recomputed_reqs", None)
        for req_info in recomputed_reqs or []:
            logger.warning(
                "[RecomputeScheduler] Recompute triggered for request %s.",
                req_info.request_id,
            )
            outputs[req_info.client_index].append(
                EngineCoreOutput(
                    request_id=req_info.request_id,
                    finish_reason=FinishReason.STOP,
                    new_token_ids=[],
                    stop_reason="recomputed",
                )
            )
```

回退路径给前端发的是 `stop_reason="recomputed"` 的终止输出，由上层重新走 prefill；开启 offload 后这条路径不会触发。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L148-L172

```python
    @staticmethod
    def _derive_cpu_config(gpu_config: "KVCacheConfig", cpu_capacity_bytes: int) -> "KVCacheConfig":
        from vllm.v1.kv_cache_interface import KVCacheConfig as KVCacheConfigCls
        from vllm.v1.kv_cache_interface import KVCacheTensor

        assert gpu_config.kv_cache_tensors
        gpu_kv_cache_tensors = []
        for t in gpu_config.kv_cache_tensors:
            if t.shared_by:
                gpu_kv_cache_tensors.append(t)
        gpu_total_bytes = sum(t.size for t in gpu_kv_cache_tensors)
        num_gpu_blocks = gpu_config.num_blocks
        num_cpu_blocks = max(1, num_gpu_blocks * cpu_capacity_bytes // gpu_total_bytes)
        cpu_tensors = [
            KVCacheTensor(
                size=t.size // num_gpu_blocks * num_cpu_blocks,
                shared_by=list(t.shared_by),
            )
            for t in gpu_kv_cache_tensors
        ]
        return KVCacheConfigCls(
            num_blocks=num_cpu_blocks,
            kv_cache_tensors=cpu_tensors,
            kv_cache_groups=gpu_config.kv_cache_groups,
        )
```

CPU 侧块数怎么从字节预算换算出来：按 HBM 单块字节数等比缩放，`kv_cache_groups` 直接复用 HBM 的配置。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L308-L318

```python
        num_needed = num_unhashed + len(missing_hashes) + num_mamba_blocks
        if not any(any(gpu_block is not None for gpu_block in group) for group in group_gpu_blocks):
            return False
        if num_needed > self.cpu_block_pool.get_num_free_blocks():
            logger.warning(
                "Skip recompute offload for request %s: CPU cache has %d free blocks, but %d new blocks are required.",
                req_id,
                self.cpu_block_pool.get_num_free_blocks(),
                num_needed,
            )
            return False
```

容量不足时的行为：返回 `False`，让调度器退回原始 recompute 路径；开启 `enable_offload_prefix_caching` 时已命中的 hash 块不计入 `num_needed`。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L174-L187

```python
    def _align_group_block_ids(
        self,
        group_idx: int,
        group_block_ids: list[int],
        logical_num_blocks: int,
    ) -> list[int]:
        if logical_num_blocks <= 0:
            return []
        aligned_group_block_ids = list(group_block_ids)
        if self._group_is_sliding_window[group_idx] and len(aligned_group_block_ids) < logical_num_blocks:
            aligned_group_block_ids = [0] * (
                logical_num_blocks - len(aligned_group_block_ids)
            ) + aligned_group_block_ids
        return aligned_group_block_ids[:logical_num_blocks]
```

sliding window 的 block table 用前导 0 补齐到逻辑块数，保证 CPU 侧下标与逻辑位置一一对应。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L195-L216

```python
    def get_num_new_matched_tokens(self, request: "Request", num_computed_tokens: int) -> tuple[int | None, bool]:
        state = self._preempted_req_states.get(request.request_id)
        if state is None:
            return 0, False
        if not state.ready:
            return None, False

        restorable_tokens = min(state.num_computed_tokens, request.num_tokens)
        hit_length = max(0, restorable_tokens - num_computed_tokens)
        if hit_length <= 0:
            self._cleanup_preempt_cache_request(request.request_id)
            return 0, False

        state.load_start_tokens = num_computed_tokens
        logger.debug(
            "Recompute offload cache hit for request %s: load_start=%d, load_tokens=%d, stored_tokens=%d.",
            request.request_id,
            num_computed_tokens,
            hit_length,
            state.num_computed_tokens,
        )
        return hit_length, True
```

换回决策：被抢占请求重新排到时，连接器以「外部命中 token 数」的形式报出可恢复长度；`ready=False`（D2H 未完成）时返回 `None`，调度器本步跳过该请求。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L534-L570

```python
    def update_connector_output(self, connector_output: KVConnectorOutput) -> None:
        for req_id in list(connector_output.finished_recving or []):
            if req_id in self._preempted_req_states:
                self._cleanup_preempt_load_request(req_id)

        meta = connector_output.kv_connector_worker_meta
        if not isinstance(meta, RecomputeCPUOffloadWorkerMetadata):
            return
        for event_idx, count in meta.completed_store_events.items():
            total = self._store_event_pending_counts.get(event_idx, 0) + count
            if total >= self._expected_worker_count:
                self._store_event_pending_counts.pop(event_idx, None)
                self._process_preempt_store_event(event_idx)
            else:
                self._store_event_pending_counts[event_idx] = total

    def _process_preempt_store_event(self, event_idx: int) -> None:
        transfer = self._preempt_store_event_to_blocks.pop(event_idx)
        req_ids = self._preempt_store_event_to_reqs.pop(event_idx, [])

        for cpu_block_id in transfer.cpu_block_ids:
            cpu_block = self.cpu_block_pool.blocks[cpu_block_id]
            block_hash = cpu_block.block_hash
            if block_hash is None:
                continue
            cached_block = self.cpu_block_pool.cached_block_hash_to_block.get_one_block(block_hash)
            if cached_block is None:
                self.cpu_block_pool.cached_block_hash_to_block.insert(block_hash, cpu_block)
            elif cached_block.block_id != cpu_block.block_id:
                cpu_block.reset_hash()

        for req_id in req_ids:
            state = self._preempted_req_states.get(req_id)
            if state is not None:
                state.ready = True
                if state.finished:
                    self._cleanup_preempt_cache_request(req_id)
```

`ready` 什么时候翻成 `True`：store event 必须被 `world_size` 个 worker 都报完成，才允许该请求被换回。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/metadata.py#L35-L52

```python
@dataclass
class RecomputeCPUOffloadWorkerMetadata(KVConnectorWorkerMetadata):
    """Worker -> Scheduler metadata for completed store events.

    Each worker reports {event_idx: 1} for newly completed stores.
    ``aggregate()`` sums counts across workers within a step.
    The scheduler-side manager accumulates across steps and processes
    a store completion only when count reaches ``world_size``.
    """

    completed_store_events: dict[int, int]

    def aggregate(self, other: "KVConnectorWorkerMetadata") -> "KVConnectorWorkerMetadata":
        assert isinstance(other, RecomputeCPUOffloadWorkerMetadata)
        merged = dict(self.completed_store_events)
        for k, v in other.completed_store_events.items():
            merged[k] = merged.get(k, 0) + v
        return RecomputeCPUOffloadWorkerMetadata(completed_store_events=merged)
```

worker → scheduler 的完成计数如何跨 rank 聚合，配合上一段的 `>= world_size` 判据。

## vllm_ascend/worker/model_runner_v1.py#L2088-L2093

```python
        if has_kv_transfer_group():
            kv_connector_metadata = scheduler_output.kv_connector_metadata
            assert kv_connector_metadata is not None
            # Preemption stores must run before _update_states() zeroes newly
            # allocated blocks that may reuse the same physical KV cache IDs.
            get_kv_transfer_group().handle_preemptions(kv_connector_metadata)
```

D2H 在 model runner 里的插入位置：必须早于 `_update_states()`，因为同一步里被换出的物理块可能立刻分配给别的请求。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L104-L122

```python
        self.gpu_kv_caches = unique_gpu_caches
        self.cpu_kv_caches = {}
        for name, gpu_tensor in unique_gpu_caches.items():
            tensor_block_size_scale = self.block_size_scale[name]
            cpu_shape = (self.num_cpu_blocks * tensor_block_size_scale,) + gpu_tensor.shape[1:]
            self.cpu_kv_caches[name] = torch.zeros(
                cpu_shape,
                dtype=gpu_tensor.dtype,
                pin_memory=True,
                device="cpu",
            )

        self.load_stream = torch.npu.Stream()
        self.store_stream = torch.npu.Stream()

        logger.info(
            "RecomputeCPUOffloadWorker scaffold registered %d unique KV tensors, allocating %d CPU blocks (%.2f GB).",
            len(unique_gpu_caches),
            self.num_cpu_blocks,
            (self.num_cpu_blocks * total_bytes_per_block) / (1024**3),
        )
```

CPU 侧张量按 `pin_memory=True` 一次性分配（Docker `--shm-size` 要求的来源），形状与 HBM 张量除首维块数外完全一致。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L134-L165

```python
    def handle_preemptions(
        self,
        kv_connector_metadata: RecomputeCPUOffloadMetadata,
    ) -> None:
        """Save preempted blocks before input preparation can overwrite them."""
        if kv_connector_metadata.need_flush:
            self._flush_and_sync_all()

        # The scheduler may immediately reuse preempted block IDs in this same
        # step. This blocking D2H must therefore run before _update_states()
        # processes new_block_ids_to_zero and before model forward writes KV.
        self._submit_transfer(
            kv_connector_metadata.preempt_store_gpu_blocks,
            kv_connector_metadata.preempt_store_cpu_blocks,
            kv_connector_metadata.preempt_store_event,
            is_store=True,
            sync=True,
        )

    def start_load_kv(self) -> None:
        """Submit pre-forward recompute H2D transfers."""
        metadata = self._connector_metadata
        if metadata is None:
            return

        self._submit_transfer(
            metadata.preempt_load_cpu_blocks,
            metadata.preempt_load_gpu_blocks,
            metadata.preempt_load_event,
            is_store=False,
            sync=True,
        )
```

D2H 与 H2D 两个方向都用 `sync=True` 同步等待，说明当前实现是阻塞式、正确性优先。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L227-L253

```python
        stream = self.store_stream if is_store else self.load_stream
        assert stream is not None
        torch.npu.synchronize()

        with torch.npu.stream(stream):
            for src_block_id, dst_block_id in zip(src_block_ids, dst_block_ids):
                for name, gpu_tensor in self.gpu_kv_caches.items():
                    cpu_tensor = self.cpu_kv_caches[name]
                    tensor_block_size_scale = self.block_size_scale[name]
                    if is_store:
                        # TODO: Replace this D2H torch copy with the NPU copy
                        # backend dedicated kernel.
                        if tensor_block_size_scale > 1:
                            cpu_tensor[
                                dst_block_id * tensor_block_size_scale : (dst_block_id + 1) * tensor_block_size_scale
                            ].copy_(
                                gpu_tensor[
                                    src_block_id * tensor_block_size_scale : (src_block_id + 1)
                                    * tensor_block_size_scale
                                ],
                                non_blocking=True,
                            )
                        else:
                            cpu_tensor[dst_block_id].copy_(
                                gpu_tensor[src_block_id],
                                non_blocking=True,
                            )
```

真正的搬运是逐块逐层 `torch.Tensor.copy_`，代码里自带 TODO 说明尚未换成专用 NPU 拷贝算子。
