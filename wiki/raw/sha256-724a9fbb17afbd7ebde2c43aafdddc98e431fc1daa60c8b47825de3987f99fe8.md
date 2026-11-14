# rc2 comparison: pinned excerpts read for this update

Recorded 2026-11-03. These are exact source excerpts, not an NPU test or a reconstructed historical agent receipt.

Source: vllm-ascend@7d825229:vllm_ascend/worker/worker.py#L1273-L1287
Online: https://github.com/vllm-project/vllm-ascend/blob/7d825229/vllm_ascend/worker/worker.py#L1273-L1287

```text
    def _init_worker_distributed_environment(self) -> None:
        """Initialize the distributed environment."""
        init_batch_invariance()
        init_distributed_environment(
            self.parallel_config.world_size, self.rank, self.distributed_init_method, self.local_rank, "hccl"
        )
        group_config = self.vllm_config
        if group_config.engram_config is not None and self.parallel_config.prefill_context_parallel_size > 1:
            # Skip upstream's DP-only Engram group so Ascend can create
            # _ENGRAM_DP once with DP x PCP ranks. Copy the config to preserve
            # the original Engram settings for Ascend and model initialization.
            group_config = copy.copy(group_config)
            group_config.engram_config = None
        with set_current_vllm_config(group_config):
            ensure_model_parallel_initialized(
```

Source: vllm-ascend@7d825229:tools/ai_qos.py#L436-L449
Online: https://github.com/vllm-project/vllm-ascend/blob/7d825229/tools/ai_qos.py#L436-L449

```text
        " Multiple apply reuses the "
        "first snapshot in the state file; unset restores that baseline and removes the file."
    )
    parser.add_argument(
        "command",
        nargs="?",
        default="apply",
        choices=["apply", "unset"],
        help='Run "unset" to restore the first-apply snapshot and delete the state file.',
    )
    parser.add_argument("--mode", type=str, default="auto", choices=["auto", "manual"])
    parser.add_argument("--AIV", type=str, default="high", choices=["low", "middle", "high"])
    parser.add_argument("--SDMA", type=str, default="low", choices=["low", "middle", "high"])
    parser.add_argument("--PCIEDMA", type=str, default="high", choices=["low", "middle", "high"])
```

Source: vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/utils/utils.py#L18-L47
Online: https://github.com/vllm-project/vllm-ascend/blob/7d825229/vllm_ascend/distributed/kv_transfer/utils/utils.py#L18-L47

```text
QOS_KEY = "comm_resource_config.qos"
PD_QOS_DEFAULT = 1
QOS_MAX = 4


def inject_qos(qos: int) -> None:
    """Merge P/D QoS before engine initialization, preserving all other fields."""
    if type(qos) is not int or not 0 <= qos <= QOS_MAX:
        raise ValueError("kv_connector_extra_config.qos_priority must be an integer in [0, 4]")
    raw = os.getenv("ASCEND_GLOBAL_RESOURCE_CONFIG", "")
    try:
        config = json.loads(raw) if raw else {}
    except (ValueError, TypeError) as exc:
        raise ValueError("ASCEND_GLOBAL_RESOURCE_CONFIG must be a JSON object") from exc
    if not isinstance(config, dict):
        raise ValueError("ASCEND_GLOBAL_RESOURCE_CONFIG must be a JSON object")
    if QOS_KEY in config:
        logger.warning(
            "Overriding comm_resource_config.qos=%s from ASCEND_GLOBAL_RESOURCE_CONFIG "
            "with qos=%s from kv_connector_extra_config (or the P/D default).",
            config[QOS_KEY],
            qos,
        )
    config[QOS_KEY] = qos
    os.environ["ASCEND_GLOBAL_RESOURCE_CONFIG"] = json.dumps(config)
    logger.info(
        "Injected comm_resource_config.qos=%d from kv_connector_extra_config "
        "(or the P/D default) into ASCEND_GLOBAL_RESOURCE_CONFIG.",
        qos,
    )
```

Source: vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2196-L2196
Online: https://github.com/vllm-project/vllm-ascend/blob/7d825229/vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2196-L2196

```text
        inject_qos(vllm_config.kv_transfer_config.get_from_extra_config("qos_priority", PD_QOS_DEFAULT))
```

Source: vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1239-L1239
Online: https://github.com/vllm-project/vllm-ascend/blob/7d825229/vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_layerwise_connector.py#L1239-L1239

```text
        inject_qos(vllm_config.kv_transfer_config.get_from_extra_config("qos_priority", PD_QOS_DEFAULT))
```

Source: vllm-ascend@7d825229:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1734-L1734
Online: https://github.com/vllm-project/vllm-ascend/blob/7d825229/vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_hybrid_connector.py#L1734-L1734

```text
        inject_qos(vllm_config.kv_transfer_config.get_from_extra_config("qos_priority", PD_QOS_DEFAULT))
```

Source: vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L63-L71
Online: https://github.com/vllm-project/vllm-ascend/blob/7d825229/vllm_ascend/device_allocator/sleep_mem_optimized.py#L63-L71

```text
        model_runner = self._model_runner_getter()
        if model_runner.use_aclgraph:
            self.acl_graph.wakeup(tags)
        if tags is None or "kv_cache" in tags:
            # Keep the anchor alive until graph recapture is complete. For
            # staged level-2 wakeup, weights are restored first and recapture
            # happens only after the KV cache is restored.
            self.hccl.release_lifecycle_anchor()

```

Source: vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L154-L242
Online: https://github.com/vllm-project/vllm-ascend/blob/7d825229/vllm_ascend/device_allocator/sleep_mem_optimized.py#L154-L242

```text
    def _ensure_lifecycle_anchor(self) -> bool:
        """Create and physically initialize the HCCL sleep anchor.

        HCCL process-group creation can be lazy. Running a device barrier is
        therefore required before treating the group as a lifecycle anchor.
        The coordinator is registered with vLLM's normal distributed
        lifecycle. Its HCCL communicator is restored once per sleep cycle and
        released after business groups and ACL graphs are restored. Single-rank
        processes skip the anchor: there is no multi-rank HCCL control plane
        to keep alive.
        """
        try:
            if torch.distributed.get_world_size() <= 1:
                return False
            if self._lifecycle_anchor_group is None:
                world_size = torch.distributed.get_world_size()
                ranks = list(range(world_size))
                self._lifecycle_anchor_group = init_model_parallel_group(
                    [ranks],
                    get_world_group().local_rank,
                    "hccl",
                    use_device_communicator=False,
                    group_name=SLEEP_LIFECYCLE_ANCHOR_GROUP_NAME,
                )

            device_group = getattr(self._lifecycle_anchor_group, "device_group", None)
            if device_group is None:
                if not self._lifecycle_anchor_group.restore_hccl():
                    raise RuntimeError("failed to restore the HCCL lifecycle anchor")
                device_group = getattr(self._lifecycle_anchor_group, "device_group", None)

            torch.distributed.barrier(
                group=device_group,
                device_ids=[torch.npu.current_device()],
            )
            return True
        except Exception:
            logger.exception(
                "Failed to initialize the HCCL sleep lifecycle anchor; sleep_hccl_policy=skip for this sleep cycle."
            )
            return False

    def release_lifecycle_anchor(self) -> bool:
        """Release the temporary anchor after business groups and graphs recover."""
        anchor_group = self._lifecycle_anchor_group
        device_group = getattr(anchor_group, "device_group", None)
        if anchor_group is None or device_group is None:
            return False

        # All ranks must finish recapture before the collective anchor is
        # destroyed. The coordinator remains registered and is restored on the
        # next sleep cycle instead of creating another group with the same name.
        torch.distributed.barrier(
            group=device_group,
            device_ids=[torch.npu.current_device()],
        )
        destroyed = anchor_group.destroy_hccl()
        if destroyed:
            logger.info(
                "Released HCCL sleep lifecycle anchor '%s' after wake-up recovery.",
                SLEEP_LIFECYCLE_ANCHOR_GROUP_NAME,
            )
        return destroyed

    def destroy_hccl(self) -> int:
        groups = list(self.iter_alive_group_coordinators())
        self._skip_hccl_cleanup_for_cycle = False
        if not self._ensure_lifecycle_anchor():
            self._skip_hccl_cleanup_for_cycle = True
            return 0

        if not self.prepare_moe_hccl_teardown():
            self._skip_hccl_cleanup_for_cycle = True
            return 0

        num_destroyed = 0
        for group in groups:
            if group is self._lifecycle_anchor_group:
                continue
            if group.destroy_hccl():
                num_destroyed += 1
        return num_destroyed

    def restore_hccl(self) -> int:
        if self._skip_hccl_cleanup_for_cycle:
            self._skip_hccl_cleanup_for_cycle = False
            return 0

        num_restored = 0
```

Source: vllm-ascend@7d825229:vllm_ascend/device_allocator/sleep_mem_optimized.py#L257-L302
Online: https://github.com/vllm-project/vllm-ascend/blob/7d825229/vllm_ascend/device_allocator/sleep_mem_optimized.py#L257-L302

```text
            if callable(refresh_fn):
                refresh_fn()

    @staticmethod
    def prepare_moe_hccl_teardown() -> bool:
        """Prepare MoE resources before their HCCL groups are destroyed."""
        from vllm_ascend.ops.fused_moe.moe_comm_method import _MoECommMethods

        try:
            for comm_method in _MoECommMethods.values():
                prepare_fn = getattr(comm_method, "prepare_hccl_teardown", None)
                if callable(prepare_fn):
                    prepare_fn()
            return True
        except Exception:
            logger.exception(
                "Failed to prepare MoE state for HCCL teardown; skipping HCCL cleanup for this sleep cycle."
            )
            return False

    @staticmethod
    def refresh_moe_hccl_runtime_state() -> None:
        """Refresh MoE runtime resources after HCCL groups are restored."""
        from vllm_ascend.ops.fused_moe.moe_comm_method import _MoECommMethods

        for comm_method in _MoECommMethods.values():
            refresh_fn = getattr(comm_method, "refresh_hccl_runtime_state", None)
            if callable(refresh_fn):
                refresh_fn()

    def sleep(self) -> None:
        if torch.distributed.is_available() and torch.distributed.is_initialized():
            for handle in getattr(self.worker, "_pp_send_work", []):
                handle.wait()
            self.worker._pp_send_work = []
            torch.npu.synchronize()
            num_destroyed = self.destroy_hccl()
            if num_destroyed > 0:
                logger.info("Destroyed %d HCCL process groups for sleep mode.", num_destroyed)

    def wakeup(self) -> None:
        with set_current_vllm_config(self.vllm_config):
            num_restored = self.restore_hccl()
            self.refresh_moe_hccl_groups()
            self.refresh_moe_hccl_runtime_state()
        logger.info("Restored %d HCCL process groups after sleep mode.", num_restored)
```
