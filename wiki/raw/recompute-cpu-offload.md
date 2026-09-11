# Recompute CPU Offload —— 引用片段

来源仓库 `vllm-ascend@28bf3a2e`（ref `main`）。以下片段按页面 `sources` 列表顺序排列，编号即正文内联标记里的编号。

## docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L3-L38

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

## Key Concepts

* **Recompute preemption**: When Decode-side HBM KV cache is exhausted,
  `RecomputeScheduler` can preempt a running request and later resume it.
* **CPU DRAM preservation**: `RecomputeCPUOffloadConnector` stores the
  preempted request's computed KV blocks in CPU memory.
* **H2D restore**: When the preempted request is scheduled again, the connector
  restores the preserved KV blocks before model forward.
* **Fallback behavior**: If the connector is not configured, the recompute
  scheduler is not enabled, or CPU offload capacity is insufficient, vLLM
  falls back to the original recompute behavior.
* **`MultiConnector` integration**: In P/D disaggregation, use
  `MultiConnector` to combine the P/D connector, such as `MooncakeConnectorV1`,
  with `RecomputeCPUOffloadConnector` on Decode nodes.
```

支撑「一句话」「为什么需要它」里 Decode 节点 `max_num_batched_tokens` 的取值习惯、opt-in 定位，以及未配置连接器 / 容量不足时回退到原 recompute 行为的说法。

## docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L40-L74

````markdown
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
````

支撑「拿真实数字走一遍」的配置片段来由（每项参数的含义、`kv_role` 必须是 `kv_consumer`、`recompute_scheduler_enable` 必须同时开），以及事实表里 `kv_role` 一行。

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

支撑「怎么工作」的整体时序叙述，以及滑窗块表对齐与 MTP lookahead 夹取这两条结论的文档侧说法。

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

支撑「为什么需要它」末尾的「拷贝未做吞吐优化」、「拿真实数字走一遍」里的 `--shm-size` 提醒，以及事实表「已知不支持」一行。

## docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L303-L307

```markdown
### Is this the same as KV Cache CPU Offload?

No. `KV Cache CPU Offload` is a prefix-cache offload path for inactive KV cache
blocks. `RecomputeCPUOffloadConnector` is specifically for preserving KV blocks
of requests preempted by the Decode-side recompute scheduler.
```

支撑「常见误解」第三条与 `alternative-to: kv-cache-cpu-offload` 这条边的 note。

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

支撑事实表里「`recompute_scheduler_enable` 合法场景」一行：P 节点被强制改回 `False` 并告警，其余非 `kv_consumer` 情形直接 `ValueError`，只有 `kv_consumer` 才真正换上 `RecomputeScheduler`。

## vllm_ascend/distributed/kv_transfer/__init__.py#L91-L95

```python
    KVConnectorFactory.register_connector(
        "RecomputeCPUOffloadConnector",
        "vllm_ascend.distributed.kv_transfer.kv_pool.recompute_cpu_offload.recompute_cpu_offload_connector",
        "RecomputeCPUOffloadConnectorV1",
    )
```

支撑事实表里配置用的注册名 `RecomputeCPUOffloadConnector` 与实现类 `RecomputeCPUOffloadConnectorV1` 的对应关系。

## docs/source/user_guide/configuration/additional_config.md#L141-L144

```markdown
| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `enable_balance_scheduling` | bool | `False` | Whether to enable balance scheduling. The legacy `VLLM_ASCEND_BALANCE_SCHEDULING` environment variable is no longer supported. |
| `recompute_scheduler_enable` | bool | `False` | Whether to enable the recompute scheduler. **Only valid on PD-disaggregated D nodes** (`kv_role` is `kv_consumer`). **Do not enable on P nodes or in PD-mixed mode** (no `kv_transfer_config`, `kv_role` is `kv_producer`, or `kv_role` is `kv_both`); startup will fail with a clear error. |
```

支撑事实表里 `recompute_scheduler_enable` 的类型与默认值 `False`。

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

支撑「怎么工作 / 抢占时：三选一」流程图的全部分支条件：分支入口判据是 `transfer_config is not None and not transfer_config.is_kv_producer`，钩子用 `getattr` 取（不装连接器时恒为 `False`），返回值决定保 KV 还是打回 Prefill。

## vllm_ascend/core/recompute_scheduler.py#L468-L483

```python
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

支撑流程图最左那条分支：没有 `kv_transfer_config` 或身份是 producer 时，走的是上游原语义的普通抢占，与本特性无关。

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

支撑「为什么需要它」与「常见误解」第一条：卸载失败的请求以 `FINISHED_ABORTED` 结束。

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

支撑「打回 Prefill」这一说法的具体机制：向前端补发一条 `stop_reason="recomputed"` 的终止输出，由外部 P/D 代理重投。

## vllm_ascend/core/recompute_scheduler.py#L621-L647

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
                        selected_local_computed_tokens = num_new_local_computed_tokens
                        if partial_tail and ext_tokens > partial_tail:
                            new_computed_blocks = self._truncate_computed_blocks_for_connector(
                                new_computed_blocks, block_aligned_local
                            )
                            num_new_local_computed_tokens = block_aligned_local
                            num_external_computed_tokens = ext_tokens
                        elif partial_tail:
                            num_external_computed_tokens = 0
                            load_kv_async = False
                        else:
                            num_external_computed_tokens = ext_tokens
```

支撑「换回不是抢占的镜像，而是伪装成一次外部命中」：换回走的是 WAITING 分支里的通用连接器路径，返回 `None` 时该请求本步被跳过并放回 `skipped_waiting`。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/recompute_cpu_offload_connector.py#L39-L95

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

支撑事实表里 `cpu_bytes_to_use` 默认 8 GiB、`cpu_bytes_to_use_per_rank` 覆盖规则与告警、`enable_offload_prefix_caching` 默认 `False` 且非 bool 抛 `ValueError`。

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

支撑事实表里的 DCP / PCP 硬约束（`assert` 要求两者都为 1），以及 CPU 侧块池由 `enable_offload_prefix_caching` 决定是否开启 caching。

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

支撑「拿真实数字走一遍」里调度器侧的 CPU 块数算式，以及 `builds-on: kv-cache-spec` 这条边——CPU 块池直接复用 `gpu_config.kv_cache_groups`。

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

支撑「滑窗与 MTP」一节与事实表「滑窗组对齐」一行：前补 `0` 到 `logical_num_blocks` 而不是压缩非零 id。

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

支撑换回路径的判定：store 未完成（`ready=False`）时返回 `None` 让调度器跳过本步，完成后返回 `(hit_length, True)` 当作外部命中。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L266-L320

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

        cpu_block_iter = iter(self.cpu_block_pool.get_new_blocks(num_needed))
```

支撑「`_create_preempt_state` 是唯一的准入判定」：`logical_num_blocks = cdiv(num_computed_tokens, block_size)`、容量不足时打 warning 返回 `False`；同时支撑事实表「Mamba 组卸载范围」一行，以及 `builds-on: prefix-caching` 这条边（开 `enable_offload_prefix_caching` 才取 `gpu_block.block_hash` 做 CPU 块共享）。

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

支撑「`update_state_after_alloc` 才根据真正分到的新 HBM 块建 CPU→HBM 映射」，以及 MTP lookahead 场景下 H2D 区间被 `min(...)` 夹取的说法。

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

支撑「多卡要等齐」与事实表「store 完成判定」一行：累计计数达到 `_expected_worker_count`（= `parallel_config.world_size`）才置 `ready`；也支撑时序图末尾 `finished_recving` → `_cleanup_preempt_load_request` 这一步。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L90-L122

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

支撑「拿真实数字走一遍」第 4 步的 worker 侧块数算式与「与调度器不一致时对齐到调度器」，以及事实表里 pinned CPU 张量、两条传输流。

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

支撑「搬运发生在 `handle_preemptions()` 里」以及「常见误解」第二条：store 与 load 两条路径都以 `sync=True` 提交。

## vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L216-L253

```python
        if not src_block_ids:
            if is_store:
                self._completed_store_events[event_idx] = 1
            else:
                self._load_hwm = max(self._load_hwm, event_idx)
            return

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

支撑「常见误解」第二条与事实表「D2H / H2D 提交方式」一行：每次提交前先 `torch.npu.synchronize()`，逐块逐张量 `copy_`，且注释标明还没换成专用 NPU 拷贝算子。

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

支撑「多卡要等齐」：worker 每步上报 `{event_idx: 1}`，`aggregate()` 跨 worker 求和，调度器累计到 `world_size` 才算完成。
