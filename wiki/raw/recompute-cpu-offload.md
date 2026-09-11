# Recompute CPU Offload 源码片段

来源仓库：vllm-ascend@28bf3a2e（ref `main`）。

## docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L3-L23

```markdown
## Overview

`RecomputeCPUOffloadConnector` preserves the KV cache of requests that are
preempted by the Decode-side recompute scheduler. When HBM KV blocks are not
enough, `RecomputeScheduler` may preempt a running Decode request. Without this
connector, the request falls back to the original recompute path and may be sent
back to the Prefill node to run prefill again. With recompute CPU offload
enabled, the already-computed KV blocks are copied from HBM to CPU DRAM before
the HBM blocks are reused, and copied back to HBM when the request is scheduled
again.

This feature is designed for online P/D disaggregation workloads where Decode
nodes are tuned for decode throughput and cannot efficiently recompute long
prefills after preemption. It is opt-in and focuses on correctness first.

In a typical Decode deployment, `max_num_batched_tokens` is often sized around
`max_num_seqs * (1 + num_spec_tokens)` so that the Decode node mainly schedules
one new token, plus speculative tokens if MTP is enabled, per request. This is
efficient for decode but too small for recomputing long prompts after
preemption. Recompute CPU offload avoids sending such requests back through the
full prompt recompute path when their KV state can be preserved locally.
```

官方文档给出的「为什么需要它」——Decode 节点的 `max_num_batched_tokens` 被调成只够一步 decode，喂不下重算长 prompt。正文 `## 为什么需要它` 依据这一段。

## docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L44-L54

```markdown
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
```

配置项的官方定义与默认值，正文 `## 事实表` 的配置行依据这一段。

## docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L226-L254

```markdown
## How It Works

1. When `RecomputeScheduler` cannot allocate enough HBM KV blocks, it selects a
   Decode-side running request for preemption.
2. Before the request's HBM blocks are reused, the scheduler calls the
   connector's preemption hook. If enough CPU blocks are available, the
   connector records the HBM block to CPU block mapping.
3. The model runner calls `handle_preemptions()` before updating worker state.
   The worker copies the selected KV blocks from HBM to pinned CPU tensors.
4. After all workers report that the store is complete, the preempted request
   becomes restorable.
5. When the request is scheduled again, the connector reports the number of
   tokens that can be restored from CPU memory.
6. The scheduler allocates new HBM blocks and the connector builds the CPU block
   to HBM block reload mapping.
7. Before model forward, the worker copies the restored KV blocks back to HBM.
   Forward then continues from the restored KV state.

## Sliding-Window and MTP Support

Sliding-window models can contain logical block tables with null block IDs for
tokens outside the attention window. The connector preserves logical block
positions instead of compressing non-zero block IDs, so a block table such as
`[0, 0, 20, 21]` remains aligned as `[0, 0, cpu_20, cpu_21]` on the CPU side.
Only non-zero blocks are transferred.

With MTP or speculative decode enabled, the scheduler may allocate lookahead
blocks. The reload path clips the H2D range to the GPU block table actually
allocated for the resumed request.
```

官方给出的七步流程与滑窗/MTP 处理，正文 `## 怎么工作` 的骨架依据这一段，再用源码逐步对照。

## docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L76-L87

```markdown
## Docker Shared Memory

Recompute CPU offload allocates pinned CPU tensors for the offloaded KV blocks.
When running in Docker, make sure the container's shared memory is large enough.
If `--shm-size` is too small, a large per-card offload budget, such as 16 GiB
per card, can fail to allocate CPU tensors and may cause the service to OOM or
hang during startup.

For typical A3 deployments with a large recompute-offload budget, set
`--shm-size=1024g` when starting the container. The following snippet follows
the Docker style used by the DeepSeek-V4-Flash tutorial:
```

pinned 内存对容器 shm 的要求，正文 `## 拿真实数字走一遍` 的部署提示引用它。

## docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L256-L274

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

限制清单，正文 `## 事实表` 的限制行与 `## 常见误解` 第 3 条依据它。

## docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L303-L307

```markdown
### Is this the same as KV Cache CPU Offload?

No. `KV Cache CPU Offload` is a prefix-cache offload path for inactive KV cache
blocks. `RecomputeCPUOffloadConnector` is specifically for preserving KV blocks
of requests preempted by the Decode-side recompute scheduler.
```

官方明确区分本特性与 KV Cache CPU Offload，正文 `## 常见误解` 第 1 条依据它。

## docs/source/user_guide/configuration/additional_config.md#L141-L144

```markdown
| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `enable_balance_scheduling` | bool | `False` | Whether to enable balance scheduling. The legacy `VLLM_ASCEND_BALANCE_SCHEDULING` environment variable is no longer supported. |
| `recompute_scheduler_enable` | bool | `False` | Whether to enable the recompute scheduler. **Only valid on PD-disaggregated D nodes** (`kv_role` is `kv_consumer`). **Do not enable on P nodes or in PD-mixed mode** (no `kv_transfer_config`, `kv_role` is `kv_producer`, or `kv_role` is `kv_both`); startup will fail with a clear error. |
```

`recompute_scheduler_enable` 的类型与默认值，正文 `## 事实表` 引用。

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

`recompute_scheduler_enable` 的三分支校验：P 节点降级为关闭、非 `kv_consumer` 直接报错、D 节点才替换 `scheduler_cls`。正文 `## 为什么需要它` 与 `## 事实表` 的适用范围行依据它。

## vllm_ascend/distributed/kv_transfer/__init__.py#L91-L95

```python
    KVConnectorFactory.register_connector(
        "RecomputeCPUOffloadConnector",
        "vllm_ascend.distributed.kv_transfer.kv_pool.recompute_cpu_offload.recompute_cpu_offload_connector",
        "RecomputeCPUOffloadConnectorV1",
    )
```

配置里写的字符串 `RecomputeCPUOffloadConnector` 到实现类 `RecomputeCPUOffloadConnectorV1` 的注册映射，正文 `## 事实表` 引用。

## vllm_ascend/core/recompute_scheduler.py#L415-L484

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
                    else:
                        self._preempt_request(
                            preempted_req,
                            scheduled_timestamp,
                            drop_stale_output=self.requires_kv_delivery,
                        )
                        preempted_reqs.append(preempted_req)
                        logger.info(
                            "[RecomputeScheduler] Preempted request %s. running_count=%s, token_budget=%s",
                            preempted_req.request_id,
                            len(self.running),
                            token_budget,
                        )
                        if preempted_req == request:
                            # No more request to preempt. Cannot schedule this request.
                            break
```

抢占分叉的全部逻辑：`update_state_before_preempt` 的返回值决定「本地保留」还是「回 Prefill 重算」；`else` 分支是普通抢占。正文 `## 怎么工作`、`## 为什么需要它` 与图 1 依据它。

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

回退路径不是本地排队等重跑，而是把请求以 `FINISHED_ABORTED` 结束掉。正文 `## 为什么需要它` 与 `## 常见误解` 第 2 条依据它。

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

回退请求对外发出 `stop_reason="recomputed"` 的终止输出，由外层重投到 Prefill。正文 `## 为什么需要它` 依据它。

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

三个配置项的解析：默认 8 GiB 总量、除以 `vllm_config.parallel_config.world_size` 得到每 rank 预算、`cpu_bytes_to_use_per_rank` 覆盖前者。正文 `## 事实表`、`## 拿真实数字走一遍` 与 `## 常见误解` 第 4 条依据它。

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

CPU 侧块数的换算公式：按 HBM 侧「每块字节数」等比折算，块大小与分组沿用 HBM 的 `kv_cache_groups`。正文 `## 拿真实数字走一遍` 依据它。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L91-L106

```python
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
```

硬断言 DCP/PCP 必须为 1，以及 CPU 侧复用一套完整的 `KVCacheCoordinator` / `BlockPool`。正文 `## 事实表` 的约束行与 `## 怎么工作` 依据它。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L258-L306

```python
        if num_computed_tokens <= 0 or self._gpu_block_pool is None:
            return False

        kv_cache_groups = self.cpu_kv_cache_config.kv_cache_groups
        group_gpu_blocks: list[list[KVCacheBlock | None]] = []
        group_gpu_hashes: list[list[BlockHashWithGroupId | None]] = []
        missing_hashes: set[BlockHashWithGroupId] = set()
        num_unhashed = 0
        num_mamba_blocks = 0

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
```

`_create_preempt_state` 的第一遍扫描：按 KV group 逐块分类，算出「需要新 CPU 块」的数量（未哈希块 + 缺失哈希块 + Mamba 块）。正文 `## 怎么工作` 与 `## 拿真实数字走一遍` 依据它。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L308-L320

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

        cpu_block_iter = iter(self.cpu_block_pool.get_new_blocks(num_needed))
```

容量判定：CPU 空闲块不够就直接返回 `False`，调度器随即走回退路径。正文 `## 怎么工作`「换出」一节与 `## 常见误解` 第 2 条依据这一段。

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

滑窗组的 block table 在前面补 0 以对齐逻辑位置，正文 `## 怎么工作` 的滑窗说明依据它。

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

换回的第一道判定：未就绪返回 `None`（调度器本步跳过该请求），就绪则以「外部命中 token 数 + 异步加载」的形式返回。正文 `## 怎么工作`「换回」一节与图 2 依据它。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L396-L412

```python
    def _prepare_preempt_load_after_alloc(
        self,
        request: "Request",
        block_ids_by_group: tuple[list[int], ...],
        num_external_tokens: int,
    ) -> bool:
        state = self._preempted_req_states.get(request.request_id)
        if state is None or not state.ready:
            return False

        load_start_tokens = state.load_start_tokens
        load_end_tokens = min(
            load_start_tokens + num_external_tokens,
            state.num_computed_tokens,
        )
        if load_end_tokens <= load_start_tokens:
            return False
```

换回窗口 `[load_start_tokens, load_end_tokens)` 的计算，正文 `## 怎么工作` 与 `## 拿真实数字走一遍` 依据它。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L457-L488

```python
                aligned_group_gpu_ids = self._align_group_block_ids(
                    g,
                    block_ids_by_group[g],
                    end_block,
                )
                for block_idx in range(start_block, end_block):
                    cpu_block_id = group_cpu_ids[block_idx]
                    gpu_block_id = aligned_group_gpu_ids[block_idx]
                    if cpu_block_id <= 0 or gpu_block_id <= 0:
                        continue
                    cpu_block_ids.append(cpu_block_id)
                    gpu_block_ids.append(gpu_block_id)

        if not cpu_block_ids or len(cpu_block_ids) != len(gpu_block_ids):
            raise RuntimeError(
                "Recompute H2D block mapping is incomplete: "
                f"req_id={request.request_id}, "
                f"gpu_blocks={len(gpu_block_ids)}, "
                f"cpu_blocks={len(cpu_block_ids)}"
            )

        assert self._gpu_block_pool is not None
        self._gpu_block_pool.touch([self._gpu_block_pool.blocks[block_id] for block_id in gpu_block_ids])
        state.load_transfer_meta = TransferMeta(gpu_block_ids, cpu_block_ids)
        logger.info(
            "Prepared recompute offload H2D load for request %s: tokens=[%d, %d), blocks=%d.",
            request.request_id,
            load_start_tokens,
            load_end_tokens,
            len(gpu_block_ids),
        )
        return True
```

CPU 块 → 新分配 HBM 块的逐块配对，`block_id <= 0` 的空洞被跳过（只搬非零块）。正文 `## 怎么工作`「换回」一节依据它。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L534-L571

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

store 事件要被 `world_size` 个 worker 全部确认后才把请求置为 `ready`，之后才允许换回。正文 `## 怎么工作` 与状态图依据它。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L595-L633

```python
    def request_finished(
        self,
        request: "Request",
        block_ids: list[int],
    ) -> tuple[bool, dict[str, Any] | None]:
        state = self._preempted_req_states.get(request.request_id)
        if state is not None and state.load_event is None:
            if state.ready:
                self._cleanup_preempt_cache_request(request.request_id)
            else:
                state.finished = True
        return False, None

    def request_finished_all_groups(
        self,
        request: "Request",
        block_ids: tuple[list[int], ...],
    ) -> tuple[bool, dict[str, Any] | None]:
        return self.request_finished(request, block_ids=[])

    def _cleanup_preempt_load_request(self, req_id: str) -> None:
        state = self._preempted_req_states.get(req_id)
        if state is None:
            return

        if state.load_event is not None:
            reqs = self._preempt_load_event_to_reqs.get(state.load_event)
            if reqs is not None:
                with contextlib.suppress(ValueError):
                    reqs.remove(req_id)
                if not reqs:
                    self._preempt_load_event_to_reqs.pop(state.load_event, None)

        if state.load_transfer_meta is not None:
            assert self._gpu_block_pool is not None
            self._gpu_block_pool.free_blocks(
                self._gpu_block_pool.blocks[block_id] for block_id in state.load_transfer_meta.gpu_block_ids
            )
        self._cleanup_preempt_cache_request(req_id)
```

CPU 块的释放时机：换回完成或请求结束时归还 `cpu_block_pool`；还没 store 完的请求先打 `finished` 标记延后清理。正文的状态图依据这一段。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L90-L115

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
```

worker 侧按每块字节数算 CPU 块数（与 scheduler 侧不一致时以 scheduler 为准），并用 `pin_memory=True` 一次性分配镜像张量。正文 `## 拿真实数字走一遍` 与 shm 提示依据它。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L134-L175

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

D2H 与 H2D 两个方向都传 `sync=True`，即都阻塞在调度步内完成；注释说明了 D2H 必须早于 `_update_states()` 的原因。正文 `## 怎么工作` 与 `## 常见误解` 第 3 条依据它。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L227-L273

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
                    else:
                        # TODO: Replace this H2D torch copy with the NPU copy
                        # backend dedicated kernel.
                        if tensor_block_size_scale > 1:
                            gpu_tensor[
                                dst_block_id * tensor_block_size_scale : (dst_block_id + 1) * tensor_block_size_scale
                            ].copy_(
                                cpu_tensor[
                                    src_block_id * tensor_block_size_scale : (src_block_id + 1)
                                    * tensor_block_size_scale
                                ],
                                non_blocking=True,
                            )
                        else:
                            gpu_tensor[dst_block_id].copy_(
                                cpu_tensor[src_block_id],
                                non_blocking=True,
                            )
            event = torch.npu.Event()
            event.record(stream)
```

搬运是「每块 × 每张 KV 张量」一次 `copy_`，提交前还有一次全局 `torch.npu.synchronize()`；源码 TODO 明确说这还不是专用 kernel。正文 `## 常见误解` 第 3 条与 `## 事实表` 的性能行依据它。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/metadata.py#L15-L32

```python
@dataclass
class RecomputeCPUOffloadMetadata(KVConnectorMetadata):
    """Recompute offload transfers passed from scheduler to worker."""

    # Whether any requests were preempted this step and need flush pending transfers.
    need_flush: bool = False

    # Store blocks of newly preempted requests before their GPU blocks can
    # be reused. The list may include a final partial block without a hash.
    preempt_store_event: int = INVALID_JOB_ID
    preempt_store_gpu_blocks: list[int] = field(default_factory=list)
    preempt_store_cpu_blocks: list[int] = field(default_factory=list)

    # Preemption load event. Used when a previously preempted request resumes.
    preempt_load_event: int = INVALID_JOB_ID
    preempt_load_gpu_blocks: list[int] = field(default_factory=list)
    preempt_load_cpu_blocks: list[int] = field(default_factory=list)
    preempt_load_event_to_reqs: dict[int, list[str]] = field(default_factory=dict)
```

scheduler → worker 每步传递的全部字段，正文 `## 事实表` 与两张时序图的边依据它。

## vllm_ascend/worker/model_runner_v1.py#L2088-L2093

```python
        if has_kv_transfer_group():
            kv_connector_metadata = scheduler_output.kv_connector_metadata
            assert kv_connector_metadata is not None
            # Preemption stores must run before _update_states() zeroes newly
            # allocated blocks that may reuse the same physical KV cache IDs.
            get_kv_transfer_group().handle_preemptions(kv_connector_metadata)
```

`handle_preemptions` 在 `NPUModelRunner.execute_model` 里的唯一调用点，位置早于 `_update_states()`。正文 `## 怎么工作` 与图 1 依据它。
