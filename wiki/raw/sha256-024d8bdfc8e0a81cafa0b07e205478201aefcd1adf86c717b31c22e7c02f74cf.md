# enable_sleep_mode_extra_cleanup 源码片段

## vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L162-L163

```python
        self.enable_cpu_binding = additional_config.get("enable_cpu_binding", True)
        self.enable_sleep_mode_extra_cleanup = additional_config.get("enable_sleep_mode_extra_cleanup", False)
```

v0.23.0 上这是一个顶层开关，默认 `False`，直接用 `additional_config.get` 取原值，没有类型校验。

## vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L216-L228

```python
    def sleep(self, level: int = 1) -> None:
        free_bytes_before_sleep = torch.npu.mem_get_info()[0]
        # Save the buffers before level 2 sleep
        if level == 2:
            model = self.model_runner.model
            self._sleep_saved_buffers = {name: buffer.cpu().clone() for name, buffer in model.named_buffers()}

        cleanup_enabled = getattr(get_ascend_config(), "enable_sleep_mode_extra_cleanup", False)
        if cleanup_enabled:
            self.sleep_wakeup_manager.sleep()

        allocator = CaMemAllocator.get_instance()
        allocator.sleep(offload_tags=("weights",) if level == 1 else tuple())
```

v0.23.0 的 sleep 入口：额外清理发生在 `CaMemAllocator.sleep()` **之前**，单条件门控。

## vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L272-L280

```python
        # Restore the buffers after level 2 sleep
        if len(self._sleep_saved_buffers):
            for name, buffer in model.named_buffers():
                if name in self._sleep_saved_buffers:
                    buffer.data.copy_(self._sleep_saved_buffers[name].data)
            self._sleep_saved_buffers = {}
        cleanup_enabled = getattr(get_ascend_config(), "enable_sleep_mode_extra_cleanup", False)
        if cleanup_enabled:
            self.sleep_wakeup_manager.wakeup(tags)
```

v0.23.0 的 wake_up 尾部：唤醒侧的恢复动作同样由这一个开关门控，且排在分配器恢复之后。

## vllm-ascend@2c59ff10:vllm_ascend/device_allocator/sleep_mem_optimized.py#L47-L64

```python
    def sleep(self) -> None:
        model_runner = self._model_runner_getter()
        free_bytes_before_cleanup = torch.npu.mem_get_info()[0]
        if model_runner.use_aclgraph:
            self.acl_graph.sleep()
        self.hccl.sleep()
        free_bytes_after_cleanup = torch.npu.mem_get_info()[0]
        free_mem = free_bytes_after_cleanup - free_bytes_before_cleanup
        logger.info(
            "Sleep mode released HCCL and attention workspace memory: %.3f GiB.",
            free_mem / GiB_bytes,
        )

    def wakeup(self, tags: list[str] | None = None) -> None:
        self.hccl.wakeup()
        model_runner = self._model_runner_getter()
        if model_runner.use_aclgraph:
            self.acl_graph.wakeup(tags)
```

开关打开后实际执行的两件事，以及 ACL 图那一半额外受 `model_runner.use_aclgraph` 门控。两个版本此文件完全一致。

## vllm-ascend@2c59ff10:vllm_ascend/device_allocator/sleep_mem_optimized.py#L116-L128

```python
    def sleep(self) -> None:
        self.clear_all_attention_workspaces()
        self.reset_all_graph_params()
        self.reset_model_runner_graph_manager(self._model_runner_getter())

    def wakeup(self, tags: list[str] | None = None) -> None:
        if tags is not None and "kv_cache" not in tags:
            # Level-2 wakeup restores weights before external weight loading;
            # recapture graphs only after KV cache is restored.
            return
        model_runner = self._model_runner_getter()
        with set_current_vllm_config(self.vllm_config):
            model_runner.capture_model()
```

唤醒时重新 `capture_model()` 就是「开了的代价」的主体；分标签唤醒时只有含 `kv_cache` 的那一次才重捕获。

## vllm-ascend@2c59ff10:vllm_ascend/device_allocator/sleep_mem_optimized.py#L172-L186

```python
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
        logger.info("Restored %d HCCL process groups after sleep mode.", num_restored)
```

HCCL 侧：睡前等 PP send 完成 + 同步 + 销毁通信域，唤醒时重建并刷新 MoE dispatcher 的通信域句柄。

## vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L82-L82

```markdown
| `enable_sleep_mode_extra_cleanup`   | bool | `False` | Enables extra sleep-mode cleanup for RL workloads, including HCCL process-group release and ACL graph workspace cleanup. Disabled by default because wakeup may need to restore HCCL and recapture ACL graphs. |
```

v0.23.0 官方参数表原文，给出默认值与「默认关闭的理由」。

## vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/sleep_mode.md#L48-L58

```markdown
When `enable_sleep_mode_extra_cleanup` is enabled, `sleep()` additionally:

- clears ACL graph attention workspaces and invalidates captured ACL graph caches when ACL graph is enabled;
- resets the model runner graph manager so ACL graphs can be captured again after wakeup;
- waits for pending pipeline-parallel send work, synchronizes the NPU, and destroys HCCL process groups.

During `wake_up()`, vLLM Ascend restores the HCCL process groups, refreshes MoE dispatcher HCCL metadata, restores sleep-mode allocator memory, and recaptures ACL graphs when needed.

:::{note}
Extra cleanup trades lower sleep-time NPU memory usage for longer wakeup latency. In particular, if ACL graph is enabled, `wake_up()` must call `capture_model()` again after the model state has been restored. Keep `enable_sleep_mode_extra_cleanup` disabled when lower wakeup latency is more important than releasing HCCL and ACL graph workspace memory.
:::
```

官方对这一开关的完整说明与取舍表述，v0.23.0 版。

## vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L177-L208

```python
@config
class RlConfig:
    """Unified defaults for reinforcement-learning workloads.

    Migrated to ``@config`` so bool values use the same pydantic lax coercion
    and unknown-key rejection as other vLLM-independent sub-configs.
    """

    enabled: bool = False
    sleep_mode_extra_cleanup: bool = False
    enable_training_consistency: bool = False
    enable_batch_invariant: bool = False

    def apply(self, ascend_config: AscendConfig) -> None:
        if not self.enabled:
            return

        if ascend_config.weight_nz_mode != 0:
            logger.warning(
                "RL config requires weight_nz_mode=0; overriding AscendConfig.weight_nz_mode from %s to 0.",
                ascend_config.weight_nz_mode,
            )
        ascend_config.weight_nz_mode = 0

        from vllm_ascend.platform import _disable_expandable_segments

        _disable_expandable_segments()

        if self.enable_batch_invariant:
            os.environ["VLLM_BATCH_INVARIANT"] = "1"

        os.environ["VLLM_SERVER_DEV_MODE"] = "1"
```

main 上开关的新家：`rl_config.sleep_mode_extra_cleanup`，默认 `False`；`enabled` 为假时 `apply()` 直接返回，其余字段不生效。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L246-L249

```python
        rl_config = get_ascend_config().rl_config
        cleanup_enabled = rl_config.enabled and rl_config.sleep_mode_extra_cleanup
        if cleanup_enabled:
            self.sleep_wakeup_manager.sleep()
```

main 的 sleep 门控变成两个条件的与。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L288-L291

```python
        rl_config = get_ascend_config().rl_config
        cleanup_enabled = rl_config.enabled and rl_config.sleep_mode_extra_cleanup
        if cleanup_enabled:
            self.sleep_wakeup_manager.wakeup(tags)
```

main 的 wake_up 门控同样是两个条件的与。

## vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L1351-L1395

```python
    # Keys that must NOT flow from additional_config into AscendConfig.
    # These are stripped so that only user-configurable keys reach pydantic,
    # where extra="forbid" can reject unknown options.
    _NON_USER_INPUT_KEYS = {
        # control-flow flag (singleton/cache refresh), not a configuration field
        "refresh",
        # Removed upstream option: warn above, but do not pass it into the
        # strict AscendConfig schema where it would be reported as a typo.
        "enable_flashcomm1",
        # injected fields (factory passes explicitly; a copy in additional_config would conflict)
        "scheduler_config",
        "sparse_kv_offload_config",
        # Factory-only input: materialized by _resolve_dump_config_path and
        # replaced with the validated dump_config_path field below.
        "dump_config",
        "dump_config_path",
        ...
    }
    kwargs = {k: v for k, v in additional_config.items() if k not in _NON_USER_INPUT_KEYS}

    new_config = AscendConfig(  # type: ignore[call-arg]
        scheduler_config=sched,
        sparse_kv_offload_config=sparse_kv,
        dump_config_path=dump_config_path,
        **kwargs,
    )
```

（中间的键名列表已用 `...` 省略，未省略的行与源码逐字一致。）旧的顶层键不在豁免名单里，会原样进入 `extra="forbid"` 的 `AscendConfig`，因此在 main 上照抄旧写法会启动即报错，而不是被静默忽略。`AscendConfig.model_config = ConfigDict(extra="forbid")` 在同文件 L369。

## vllm-ascend@28bf3a2e:docs/source/user_guide/configuration/additional_config.md#L239-L239

```markdown
| `sleep_mode_extra_cleanup` | bool | `false` | Same-device mode. Enables HCCL process-group release + ACL graph workspace cleanup during sleep, returning more NPU memory to the trainer at the cost of increased wakeup latency. This option is available only under `rl_config`; the former top-level `enable_sleep_mode_extra_cleanup` key has been removed. |
```

main 官方参数表：明确写出旧顶层键已移除，且此开关限「同卡部署」。

## vllm-ascend@28bf3a2e:docs/source/user_guide/configuration/additional_config.md#L286-L293

```markdown
| Before | After |
| ------ | ----- |
| `export VLLM_ASCEND_ENABLE_NZ=0` | `"rl_config": {"enabled": true}` |
| `export VLLM_SERVER_DEV_MODE=1` | `"rl_config": {"enabled": true}` |
| `export VLLM_BATCH_INVARIANT=1` | `"rl_config": {"enabled": true, "enable_batch_invariant": true}` |
| `--attention-backend FLASH_ATTN` for FA3 consistency mode | `"rl_config": {"enabled": true, "enable_training_consistency": true}` |
| top-level `"weight_nz_mode": 0` for RL | `"rl_config": {"enabled": true}` |
| top-level `"enable_sleep_mode_extra_cleanup": true` | `"rl_config": {"enabled": true, "sleep_mode_extra_cleanup": true}` |
```

官方迁移表最后一行给出逐字的改写方式。

## vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/sleep_mode.md#L53-L63

```markdown
When `rl_config.sleep_mode_extra_cleanup` is enabled, `sleep()` additionally:

- clears ACL graph attention workspaces and invalidates captured ACL graph caches when ACL graph is enabled;
- resets the model runner graph manager so ACL graphs can be captured again after wakeup;
- waits for pending pipeline-parallel send work, synchronizes the NPU, and destroys HCCL process groups.

During `wake_up()`, vLLM Ascend restores the HCCL process groups, refreshes MoE dispatcher HCCL metadata, restores sleep-mode allocator memory, and recaptures ACL graphs when needed.

!!! note

    Extra cleanup trades lower sleep-time NPU memory usage for longer wakeup latency. In particular, if ACL graph is enabled, `wake_up()` must call `capture_model()` again after the model state has been restored. Keep `rl_config.sleep_mode_extra_cleanup` disabled when lower wakeup latency is more important than releasing HCCL and ACL graph workspace memory. The former top-level `enable_sleep_mode_extra_cleanup` option has been removed.
```

main 的同一段文档：行为描述逐字未变，只换了键名并追加一句「旧键已移除」。

## vllm-ascend@28bf3a2e:tests/ut/worker/a2/test_worker_v1.py#L450-L453

```python
        mock_get_config.return_value = SimpleNamespace(
            weight_nz_mode=0,
            rl_config=SimpleNamespace(enabled=False, sleep_mode_extra_cleanup=True),
        )
```

上游单测里就有 `enabled=False` + `sleep_mode_extra_cleanup=True` 这一组合，用来验证此时不走额外清理路径。

## vllm-ascend@28bf3a2e:docs/source/user_guide/feature_guide/rl.md#L102-L116

```markdown
To release HCCL process groups and ACL graph workspaces as well, enable extra
cleanup:

```bash
VLLM_WORKER_MULTIPROC_METHOD=spawn \
vllm serve Qwen/Qwen3-0.6B \
    --enable-sleep-mode \
    --additional-config '{"rl_config": {"enabled": true, "sleep_mode_extra_cleanup": true}}'
```

Extra cleanup reduces sleep-time NPU memory use, but HCCL groups must be
restored and ACL graphs must be recaptured during wake-up. RL mode removes
`expandable_segments` from `PYTORCH_NPU_ALLOC_CONF` because it is incompatible
with the sleep-mode memory pool. The former top-level
`enable_sleep_mode_extra_cleanup` option has been removed.
```

main 新增的 RL 指南给出完整可复制的启动命令，也是 `enable_sleep_mode` 与本开关必须配套的直接依据。
