# Recompute CPU Offload 源码片段

## vllm-ascend@28bf3a2e:vllm_ascend/core/recompute_scheduler.py#L415-L467

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

main 上的抢占分支：`kv_consumer` 节点走 connector 的 `update_state_before_preempt` 钩子，成功则正常抢占，失败则终止请求。注意 `recomputed_req = preempted_req` —— 受害者已由上方的 PRIORITY / FCFS 选择逻辑挑好。

## vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L294-L347

```python
                    # The request cannot be scheduled.
                    # Preempt the lowest-priority request.
                    # NOTE: We add the preempted_req to recomputed_reqs in kv_consumer to
                    # drop the request to PD proxy.
                    transfer_config = self.vllm_config.kv_transfer_config
                    if transfer_config is not None and not transfer_config.is_kv_producer:
                        recomputed_req = self.running.pop()
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
                                "Recompute preemption offload enabled for request %s, computed_tokens=%d.",
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
                            self._preempt_request(recomputed_req, scheduled_timestamp)
                            preempted_reqs.append(recomputed_req)
                        else:
                            self.kv_cache_manager.free(recomputed_req)
                            logger.info(
                                "Recompute preemption falls back without offload for request %s, computed_tokens=%d.",
                                recomputed_req_id,
                                recomputed_num_computed_tokens,
                            )
                            recomputed_reqs.append(
                                RecomputeReqInfo(
                                    recomputed_req_id,
                                    recomputed_req.output_token_ids,
                                    recomputed_req.client_index,
                                )
                            )
                        if recomputed_req == request:
                            break
```

v0.23.0 的同一段：受害者固定是 `self.running.pop()`（不看 PRIORITY 策略），回退路径直接 `kv_cache_manager.free()` 并手工追加 `RecomputeReqInfo`。用来对照两版的受害者选择与回退实现差异。

## vllm-ascend@28bf3a2e:vllm_ascend/core/recompute_scheduler.py#L222-L239

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

main 把回退路径统一到 `finish_requests(FINISHED_ABORTED)`，取代 v0.23.0 的手工 `free()`。

## vllm-ascend@28bf3a2e:vllm_ascend/core/recompute_scheduler.py#L1054-L1073

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

回退路径对外的可见后果：请求以 `stop_reason="recomputed"` 结束，由 PD proxy 重新投给 Prefill 节点。

## vllm-ascend@28bf3a2e:vllm_ascend/core/recompute_scheduler.py#L621-L635

```python
                    # Get externally-cached tokens if using a KVConnector.
                    if self.connector is not None:
                        partial_tail = num_new_local_computed_tokens % self.block_size
                        block_aligned_local = num_new_local_computed_tokens - partial_tail
                        ext_tokens, load_kv_async = self.connector.get_num_new_matched_tokens(
                            request, block_aligned_local
                        )

                        if ext_tokens is None:
                            # The request cannot be scheduled because
                            # the KVConnector couldn't determine
                            # the number of matched tokens.
                            request_queue.pop_request()
                            step_skipped_waiting.prepend_request(request)
                            continue
```

`get_num_new_matched_tokens` 返回 `None` 时请求被挪到 skipped 队列 —— 这就是 D2H 还没落盘时恢复被推迟的机制。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L84-L107

```python
        logger.info(
            "RecomputeCPUOffloadScheduler: allocating %d CPU blocks (%.2f GB) for recompute offload, prefix caching=%s",
            self.num_cpu_blocks,
            cpu_capacity_bytes / (1024**3),
            self.enable_offload_prefix_caching,
        )

        dcp_world_size = vllm_config.parallel_config.decode_context_parallel_size
        pcp_world_size = vllm_config.parallel_config.prefill_context_parallel_size
        assert dcp_world_size == 1 and pcp_world_size == 1
        scheduler_block_size, hash_block_size = resolve_kv_cache_block_sizes(kv_cache_config, vllm_config)
        self.cpu_coordinator: KVCacheCoordinator = get_kv_cache_coordinator(
            kv_cache_config=self.cpu_kv_cache_config,
            max_model_len=vllm_config.model_config.max_model_len,
            max_num_batched_tokens=(vllm_config.scheduler_config.max_num_batched_tokens),
            use_eagle=False,
            enable_caching=self.enable_offload_prefix_caching,
            enable_kv_cache_events=self.enable_kv_cache_events,
            dcp_world_size=dcp_world_size,
            pcp_world_size=pcp_world_size,
            scheduler_block_size=scheduler_block_size,
            hash_block_size=hash_block_size,
        )
        self.cpu_block_pool: BlockPool = self.cpu_coordinator.block_pool
```

CPU 侧复用 vLLM 的 `KVCacheCoordinator` / `BlockPool`，并硬性要求 dcp/pcp 均为 1。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L148-L172

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

CPU 块数 = 每卡预算 ÷ 每块字节数，且直接复用 GPU 侧的 `kv_cache_groups`（含 block_size）。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L195-L216

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

换回的入口：报告可恢复 token 数，第二个返回值 `True` 表示走异步 KV 加载路径。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L268-L320

```python
        for g, group_gpu_ids in enumerate(block_ids_by_group):
            gpu_blocks: list[KVCacheBlock | None] = []
            effective_hashes: list[BlockHashWithGroupId | None] = []
            if self._group_is_mamba[g]:
                # For Mamba cache, only the last `1 + num_spec_tokens` blocks need to offload
                offload_start_idx = len(group_gpu_ids) - self.num_spec_tokens - 1
                for block_idx, block_id in enumerate(group_gpu_ids):
                    if block_idx >= offload_start_idx:
                        num_mamba_blocks += 1
                        gpu_block = self._gpu_block_pool.blocks[block_id]
                        gpu_blocks.append(gpu_block)
                        effective_hashes.append(None)
            else:
                group_block_size = kv_cache_groups[g].kv_cache_spec.block_size
                logical_num_blocks = cdiv(num_computed_tokens, group_block_size)
                aligned_group_gpu_ids = self._align_group_block_ids(g, group_gpu_ids, logical_num_blocks)

                for block_idx, block_id in enumerate(aligned_group_gpu_ids):
                    if block_id <= 0:
                        gpu_blocks.append(None)
                        effective_hashes.append(None)
                        continue

                    gpu_block = self._gpu_block_pool.blocks[block_id]
                    block_is_computed = (block_idx + 1) * group_block_size <= num_computed_tokens
                    block_hash = (
                        gpu_block.block_hash if block_is_computed and self.enable_offload_prefix_caching else None
                    )
                    gpu_blocks.append(gpu_block)
                    effective_hashes.append(block_hash)
                    if block_hash is None:
                        num_unhashed += 1
                    elif (
                        self.cpu_block_pool.cached_block_hash_to_block.get_one_block(block_hash) is None
                        and block_hash not in self._pending_hash_blocks
                    ):
                        missing_hashes.add(block_hash)
            group_gpu_blocks.append(gpu_blocks)
            group_gpu_hashes.append(effective_hashes)

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

main 的 `_create_preempt_state` 主体：Mamba 组只卸最后 `1 + num_spec_tokens` 块；`block_id <= 0` 的空洞位保留为 `None` 以对齐滑窗块表；CPU 空闲块不够就返回 False（静默回退）。

## vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L251-L299

```python
        for g, group_gpu_ids in enumerate(block_ids_by_group):
            group_block_size = kv_cache_groups[g].kv_cache_spec.block_size
            logical_num_blocks = cdiv(num_computed_tokens, group_block_size)
            aligned_group_gpu_ids = self._align_group_block_ids(g, group_gpu_ids, logical_num_blocks)
            eviction_group_gpu_ids = self._align_group_block_ids(
                g,
                group_gpu_ids,
                max(logical_num_blocks, len(group_gpu_ids)),
            )
            gpu_blocks: list[KVCacheBlock | None] = []
            effective_hashes: list[BlockHashWithGroupId | None] = []

            for block_idx, block_id in enumerate(eviction_group_gpu_ids):
                if block_id <= 0:
                    continue
                gpu_block = self._gpu_block_pool.blocks[block_id]
                block_is_computed = (block_idx + 1) * group_block_size <= num_computed_tokens
                if not block_is_computed and gpu_block.block_hash is not None:
                    # allocate_slots() may assign a hash using tokens planned
                    # for this scheduling step. If the request is then
                    # preempted before forward, that block does not contain the
                    # hashed KV and must not remain in the GPU prefix cache.
                    self._gpu_block_pool._maybe_evict_cached_block(gpu_block)

            for block_idx, block_id in enumerate(aligned_group_gpu_ids):
                if block_id <= 0:
                    gpu_blocks.append(None)
                    effective_hashes.append(None)
                    continue

                gpu_block = self._gpu_block_pool.blocks[block_id]
                block_is_computed = (block_idx + 1) * group_block_size <= num_computed_tokens
                block_hash = gpu_block.block_hash if block_is_computed and self.enable_offload_prefix_caching else None
                gpu_blocks.append(gpu_block)
                effective_hashes.append(block_hash)
                if block_hash is None:
                    num_unhashed += 1
                elif (
                    self.cpu_block_pool.cached_block_hash_to_block.get_one_block(block_hash) is None
                    and block_hash not in self._pending_hash_blocks
                ):
                    missing_hashes.add(block_hash)
            group_gpu_blocks.append(gpu_blocks)
            group_gpu_hashes.append(effective_hashes)

        num_needed = num_unhashed + len(missing_hashes)
        if not any(any(gpu_block is not None for gpu_block in group) for group in group_gpu_blocks):
            return False
        if num_needed > self.cpu_block_pool.get_num_free_blocks():
```

v0.23.0 的同一段：没有 Mamba 分支，但多一个 `_maybe_evict_cached_block` 循环，把「本步刚打上 hash 但还没前向写入」的 GPU 块从 prefix cache 里逐出。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L534-L570

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

store 事件必须集齐 `world_size` 个 worker 的回报才置 `ready=True`，请求才变得可恢复。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/recompute_cpu_offload_connector.py#L39-L95

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

        self.scheduler_manager: RecomputeCPUOffloadScheduler | None = None
        self.worker_handler: RecomputeCPUOffloadWorker | None = None

        logger.info(
            "RecomputeCPUOffloadConnector: role=%s, per_rank=%.2f GB, world_size=%d, offload_prefix_caching=%s",
            role.name,
            cpu_capacity_per_rank / (1024**3),
            world_size,
            enable_offload_prefix_caching,
        )

        if role == KVConnectorRole.SCHEDULER:
            self.scheduler_manager = RecomputeCPUOffloadScheduler(
                vllm_config,
                kv_cache_config,
                cpu_capacity_per_rank,
                enable_offload_prefix_caching,
            )
        elif role == KVConnectorRole.WORKER:
            self.worker_handler = RecomputeCPUOffloadWorker(
                vllm_config,
                kv_cache_config,
                cpu_capacity_per_rank,
            )
```

三个配置项的默认值与优先级。v0.23.0 的 `recompute_cpu_offload_connector.py#L39-L95` 与此逐字一致。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L90-L122

```python
        per_tensor_bytes_per_block = [tensor.shape[-1] * tensor.element_size() for tensor in unique_gpu_caches.values()]
        total_bytes_per_block = sum(per_tensor_bytes_per_block)
        self.num_cpu_blocks = max(1, self.cpu_capacity_bytes // total_bytes_per_block)
        if self.num_cpu_blocks != scheduler_num_cpu_blocks:
            self.num_cpu_blocks = scheduler_num_cpu_blocks
            logger.warning(
                "RecomputeCPUOffloadScheduler has different num_blocks: %d,"
                "worker-side num_block is set to %d to align with scheduler.",
                scheduler_num_cpu_blocks,
                scheduler_num_cpu_blocks,
            )

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

CPU 侧是 pinned（锁页）张量，启动时一次性全量分配 —— 这就是文档要求放大 Docker `--shm-size` 的原因。v0.23.0 的 `worker.py#L90-L122` 与此逐字一致。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L134-L175

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

    def wait_for_layer_load(self) -> None:
        """Make the current forward stream wait for the recompute H2D copy."""
        if self._load_stream_waited or self.load_stream is None:
            return
        metadata = self._connector_metadata
        if metadata is None or metadata.preempt_load_event < 0:
            return
        torch.npu.current_stream().wait_stream(self.load_stream)
        self._load_stream_waited = True
```

D2H 与 H2D 都以 `sync=True` 提交 —— 两个方向的搬运都在关键路径上同步阻塞。v0.23.0 的 `worker.py#L134-L175` 与此逐字一致。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L223-L253

```python
        assert len(src_block_ids) == len(dst_block_ids)
        assert self.gpu_kv_caches is not None
        assert self.cpu_kv_caches is not None

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

搬运实现是逐块逐张量的 `torch.Tensor.copy_`，且进循环前有一次全设备 `torch.npu.synchronize()`；源码自带 TODO 说明还没换成专用算子。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L2088-L2093

```python
        if has_kv_transfer_group():
            kv_connector_metadata = scheduler_output.kv_connector_metadata
            assert kv_connector_metadata is not None
            # Preemption stores must run before _update_states() zeroes newly
            # allocated blocks that may reuse the same physical KV cache IDs.
            get_kv_transfer_group().handle_preemptions(kv_connector_metadata)
```

模型侧的调用点，说明 D2H 为什么必须早于 `_update_states()`。v0.23.0 在 `model_runner_v1.py#L2017-L2022` 有逐字相同的一段。

## vllm-ascend@28bf3a2e:vllm_ascend/platform.py#L966-L996

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

main 的部署形态校验：只有 `kv_role == "kv_consumer"` 才真正换上 `RecomputeScheduler`，PD 混布直接 ValueError。

## vllm-ascend@2c59ff10:vllm_ascend/platform.py#L689-L710

```python
        if ascend_config.recompute_scheduler_enable:
            kv_transfer_config = vllm_config.kv_transfer_config
            kv_role = getattr(kv_transfer_config, "kv_role", None)
            if kv_role == "kv_producer":
                logger.warning(
                    "recompute_scheduler_enable is ignored on PD-disaggregated P nodes "
                    "(kv_role='kv_producer') and will be deprecated on P nodes in a future release. "
                    "Please remove it from P-node configs and keep it only on PD-disaggregated D nodes "
                    "(kv_role='kv_consumer')."
                )
                ascend_config.recompute_scheduler_enable = False
                vllm_config.additional_config["recompute_scheduler_enable"] = False
            elif kv_transfer_config is None or kv_role != "kv_consumer":
                raise ValueError(
                    "recompute_scheduler_enable can only be enabled on PD-disaggregated D nodes "
                    f"(kv_role='kv_consumer', but got kv_role={kv_role!r}), and is not supported in PD-mixed mode."
                )
            else:
                from vllm_ascend.core.recompute_scheduler import RecomputeSchedulerConfig

                recompute_scheduler_config = RecomputeSchedulerConfig.initialize_from_config(vllm_config)
                vllm_config.scheduler_config = recompute_scheduler_config
```

v0.23.0 的同一段校验：约束一致，但读写的是 `additional_config` 顶层键。

## vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L1191-L1214

```python
        def _resolve(config_key: str, default: Any) -> Any:
            if config_key in scheduler_config:
                if config_key in additional_config:
                    logger.warning_once(
                        "additional_config.%s is deprecated and ignored because "
                        "additional_config.scheduler_config.%s is set.",
                        config_key,
                        config_key,
                    )
                return scheduler_config[config_key]
            if config_key in additional_config:
                logger.warning_once(
                    "additional_config.%s is deprecated; use additional_config.scheduler_config.%s instead.",
                    config_key,
                    config_key,
                )
                return additional_config[config_key]
            return default

        resolved = {
            # Balance scheduling is configured only through additional_config;
            # the legacy environment fallback has been removed.
            "enable_balance_scheduling": _resolve("enable_balance_scheduling", False),
            "recompute_scheduler_enable": _resolve("recompute_scheduler_enable", False),
```

main 上开关搬到了 `additional_config.scheduler_config` 下，顶层旧写法仍被接受但打弃用警告。

## vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L139-L142

```python
        self.multistream_overlap_shared_expert = additional_config.get("multistream_overlap_shared_expert", False)
        self.multistream_overlap_gate = additional_config.get("multistream_overlap_gate", False)
        # PD-disaggregated D node only (kv_consumer); invalid on P nodes and in PD-mixed mode.
        self.recompute_scheduler_enable = additional_config.get("recompute_scheduler_enable", False)
```

v0.23.0 只从 `additional_config` 顶层读这个键，没有 `scheduler_config` 这一层。

## vllm-ascend@28bf3a2e:vllm_ascend/distributed/kv_transfer/__init__.py#L91-L95

```python
    KVConnectorFactory.register_connector(
        "RecomputeCPUOffloadConnector",
        "vllm_ascend.distributed.kv_transfer.kv_pool.recompute_cpu_offload.recompute_cpu_offload_connector",
        "RecomputeCPUOffloadConnectorV1",
    )
```

`kv_connector` 里写的名字 `RecomputeCPUOffloadConnector` 与实现类名 `RecomputeCPUOffloadConnectorV1` 不同，注册表负责这层映射。

## vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L40-L74

```markdown
## Configuration Parameters

`RecomputeCPUOffloadConnector` is configured through `kv-transfer-config`.

| Parameter | Description |
| :--- | :--- |
| `kv_connector` | Must be set to `RecomputeCPUOffloadConnector`. |
| `kv_role` | Set to `kv_consumer` on Decode nodes. |
| `cpu_bytes_to_use_per_rank` | Optional and recommended. CPU memory budget in bytes used by each rank/card for recompute offload. If set, it overrides `cpu_bytes_to_use / world_size`. |
| `cpu_bytes_to_use` | Optional. Total CPU memory budget in bytes for this vLLM instance. The connector divides it by `world_size` to get the per-rank budget. This is less direct than `cpu_bytes_to_use_per_rank` and is easier to misconfigure in DP deployments. The default is 8 GiB total. |
| `enable_offload_prefix_caching` | Optional. Enables CPU block sharing for full hashed blocks with the same prefix-cache hash. The default is `false`; keep it disabled unless explicitly testing prefix sharing. |

Prefer `cpu_bytes_to_use_per_rank` when you want every rank/card to use the
same offload capacity. For example, set `cpu_bytes_to_use_per_rank` to
`17179869184` for 16 GiB per rank/card.

If you use `cpu_bytes_to_use`, remember that it is divided by `world_size`. In
typical P/D Decode deployments, this means the value is divided by the active
Decode DP size. For example, when starting a DP2TP8 Decode service, setting
`cpu_bytes_to_use` to 16 GiB gives each DP rank's cards about 8 GiB of recompute
offload space. To avoid ambiguity, use `cpu_bytes_to_use_per_rank` for new
deployments.

`scheduler_config.recompute_scheduler_enable` must also be enabled in `additional-config` on
P/D-disaggregated Decode nodes:

```bash
--additional-config '{"scheduler_config":{"recompute_scheduler_enable":true}}'
```

```{note}
`scheduler_config.recompute_scheduler_enable` is only valid in P/D-disaggregated mode
(`kv_role` is `kv_producer` or `kv_consumer`). Do not enable it in PD-mixed
mode (`kv_role` is `kv_both`).
```
```

main 官方文档的配置参数表与开关写法。

## vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L63-L74

```markdown
`recompute_scheduler_enable` must also be enabled in `additional-config` on
P/D-disaggregated Decode nodes:

```bash
--additional-config '{"recompute_scheduler_enable":true}'
```

```{note}
`recompute_scheduler_enable` is only valid in P/D-disaggregated mode
(`kv_role` is `kv_producer` or `kv_consumer`). Do not enable it in PD-mixed
mode (`kv_role` is `kv_both`).
```
```

v0.23.0 官方文档给的是顶层键写法。

## vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L256-L274

```markdown
## Notes and Limitations

* This feature requires the vLLM V1 engine and the vLLM-Ascend recompute
  scheduler.
* The feature is only intended for Decode nodes in P/D disaggregation. It is not
  supported in PD-mixed or normal non-P/D deployments.
* Do not enable `scheduler_config.recompute_scheduler_enable` in PD-mixed deployments. Without
  P/D-disaggregated Decode-side `RecomputeScheduler`, recompute CPU offload is
  not active and vLLM follows the normal recompute path.
* When running in Docker with a large per-rank offload budget, reserve enough
  shared memory. For typical A3 deployments with 16 GiB per-card offload, use
  `--shm-size=1024g`.
* `enable_offload_prefix_caching` is experimental and disabled by default.
* Current D2H and H2D transfers use basic torch copy operations. They are
  correctness-oriented and not yet optimized for transfer throughput.
* Qwen3.5 with async scheduling is not fully supported yet. Disable async
  scheduling when using recompute CPU offload with Qwen3.5 models.
* If CPU memory capacity is insufficient, the connector skips offload for that
  request and the scheduler falls back to the original recompute behavior.
```

官方给出的适用范围与已知限制（Docker shm、实验性 prefix 共享、未优化的 torch copy、Qwen3.5 async scheduling）。v0.23.0 的 `docs/.../recompute_cpu_offload.md#L256-L274` 除开关键名外逐字相同。
