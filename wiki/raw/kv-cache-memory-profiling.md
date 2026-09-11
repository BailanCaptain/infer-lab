# KV Cache Memory Profiling —— 源码片段

全部摘自 `vllm-ascend@28bf3a2e`（ref `main`），原文未作任何改动。

## vllm_ascend/worker/worker.py#L441-L454

```python
        # take current memory snapshot
        self.init_snapshot = MemorySnapshot(device=device)
        self.requested_memory = self.init_snapshot.total_memory * self.cache_config.gpu_memory_utilization
        if self.init_snapshot.free_memory < self.requested_memory:
            GiB = lambda b: round(b / GiB_bytes, 2)
            raise ValueError(
                f"Free memory on device "
                f"({GiB(self.init_snapshot.free_memory)}/"
                f"{GiB(self.init_snapshot.total_memory)} GiB) on startup "
                f"is less than desired GPU memory utilization "
                f"({self.cache_config.gpu_memory_utilization}, "
                f"{GiB(self.requested_memory)} GiB). Decrease GPU memory "
                f"utilization or reduce GPU memory used by other processes."
            )
```

引用理由：确定 `gpu_memory_utilization` 的语义——它乘的是 `total_memory` 而不是 `free_memory`；同时给出启动期的硬性校验（free < requested 直接抛 `ValueError`）。

## vllm_ascend/worker/worker.py#L536-L563

```python
    @torch.inference_mode()
    def determine_available_memory(self) -> int:
        """Profiles the peak memory usage of the model to determine how much
        memory can be used for KV cache without OOMs.

        The engine will first conduct a profiling of the existing memory usage.
        Then, it calculates the free memory that can be used for KV cache in
        bytes.
        """
        GiB = lambda b: b / GiB_bytes

        # Fast path: user has explicitly specified KV cache size via
        # --kv-cache-memory. Still run profile_run() to compile the model,
        # but skip the memory profiling calculation entirely.
        if kv_cache_memory_bytes := self.cache_config.kv_cache_memory_bytes:
            self.model_runner.profile_run()
            logger.info(
                "Initial free memory %.2f GiB, reserved %.2f GiB for KV Cache "
                "as specified by kv_cache_memory_bytes, skipping memory profiling. "
                "This does not respect the gpu_memory_utilization config. "
                "Only use kv_cache_memory_bytes when you want manual control of "
                "KV cache memory size. If OOM'ed, check the difference of initial "
                "free memory between the current run and the previous run where "
                "kv_cache_memory_bytes is suggested and update it correspondingly.",
                GiB(self.init_snapshot.free_memory),
                GiB(kv_cache_memory_bytes),
            )
            return self._apply_kv_offload_decode_memory_constraints(kv_cache_memory_bytes)
```

引用理由：快路径。说明 `kv_cache_memory_bytes` 一旦给定就整体绕过测量，且**仍然跑 `profile_run()`**（为了编译），以及它「不遵守 gpu_memory_utilization」这一官方措辞。

## vllm_ascend/worker/worker.py#L565-L600

```python
        # Execute a forward pass with dummy inputs to profile the memory usage
        # of the model.
        with memory_profiling(
            self.init_snapshot,
            weights_memory=int(self.model_runner.model_memory_usage),
        ) as profile_result:
            self.model_runner.profile_run()

            # Record torch peak INSIDE the context and BEFORE graph capture,
            # so that graph pool allocations don't inflate the activation peak.
            # The memory_profiling context will also compute torch_peak_increase
            # on exit, but we override it below with this pre-graph value.
            profile_torch_peak = torch.npu.memory_stats(self.device).get("allocated_bytes.all.peak", 0)

        # Override torch_peak_increase with the pre-graph-capture value to
        # avoid double-counting graph pool memory as activation memory.
        profile_result.torch_peak_increase = profile_torch_peak - profile_result.before_profile.torch_peak
        profile_result.non_kv_cache_memory = (
            profile_result.non_torch_increase + profile_result.torch_peak_increase + profile_result.weights_memory
        )

        # Save per-category memory for use in compile_or_warm_up_model() (step 5).
        self.peak_activation_memory = profile_result.torch_peak_increase
        self.non_torch_memory = profile_result.non_torch_increase

        free_gpu_memory = profile_result.after_profile.free_memory
        assert self.init_snapshot.free_memory > free_gpu_memory, (
            "Error in memory profiling. "
            f"Initial free memory {GiB(self.init_snapshot.free_memory)} GiB, "
            f"current free memory {GiB(free_gpu_memory)} GiB. "
            "This happens when other processes sharing the same container "
            "release GPU memory while vLLM is profiling during initialization. "
            "To fix this, ensure consistent GPU memory allocation or "
            "isolate vLLM in its own container."
        )
        self.available_kv_cache_memory_bytes = self.requested_memory - profile_result.non_kv_cache_memory
```

引用理由：整页的主体公式。三项扣除（`non_torch_increase` + `torch_peak_increase` + `weights_memory`）、峰值在图捕获之前取样、以及 free memory 单调性断言。

## vllm_ascend/worker/worker.py#L602-L630

```python
        extra_config = get_gva_layerwise_config(self.vllm_config.kv_transfer_config)
        if extra_config is not None:
            memory_info = getattr(self, "_gva_layerwise_memory_info", None)
            if memory_info is None:
                num_layers = self.model_config.get_num_layers(self.parallel_config)
                layout = build_layerwise_cache_layout(num_layers, extra_config)
                num_buffer_assignments = len(layout.storage_indices)
                factor = num_layers / num_buffer_assignments if layout.has_layer_reuse else 1.0
            else:
                num_layers, num_buffer_assignments, factor = memory_info
            if factor != 1.0:
                self.available_kv_cache_memory_bytes = int(self.available_kv_cache_memory_bytes * factor)
                logger.info(
                    "Layerwise KV cache reuse maps %d layers onto %d buffer assignments; "
                    "scale logical KV budget by %.3f.",
                    num_layers,
                    num_buffer_assignments,
                    factor,
                )

        logger.debug(profile_result)
        logger.info_once(
            "Available KV cache memory: %.2f GiB", GiB(self.available_kv_cache_memory_bytes), scope="local"
        )
        self.available_kv_cache_memory_bytes = self._apply_kv_offload_decode_memory_constraints(
            self.available_kv_cache_memory_bytes
        )

        return int(self.available_kv_cache_memory_bytes)
```

引用理由：预算落地前的两道后处理（layerwise 复用按 factor 放大逻辑预算、sparse offload 约束），以及最终 `int()` 返回、没有对负值做钳位。

## vllm_ascend/worker/worker.py#L500-L534

```python
    def _apply_kv_offload_decode_memory_constraints(
        self,
        available_device_memory_bytes: int,
    ) -> int:
        GiB = lambda b: b / GiB_bytes
        sparse_kv_offload_config = get_ascend_config().sparse_kv_offload_config
        if not sparse_kv_offload_config.enabled:
            return int(available_device_memory_bytes)

        kv_cache_spec = getattr(self, "kv_cache_spec", None) or self.get_kv_cache_spec()
        dram_limit_bytes = int(sparse_kv_offload_config.dram_size_per_dp_GB * GiB_bytes)
        budget = plan_sparse_kv_offload_memory(
            kv_cache_spec=kv_cache_spec,
            vllm_config=self.vllm_config,
            available_device_memory_bytes=available_device_memory_bytes,
            dram_limit_bytes=dram_limit_bytes,
            keep_device_kv_cache=sparse_kv_offload_config.keep_device_kv_cache,
        )
        logger.info_once(
            "Sparse KV offload memory plan: npu_limit=%d blocks, "
            "dram_limit=%d blocks, workload_limit=%d blocks, "
            "final=%d blocks (%s limited), planner=%.2f GiB, "
            "host=%.2f GiB, device=%.2f GiB, alignment_reserve=%.2f GiB.",
            budget.npu_limit_blocks,
            budget.dram_limit_blocks,
            budget.workload_limit_blocks,
            budget.final_num_blocks,
            budget.limiting_factor,
            GiB(budget.final_planner_bytes),
            GiB(budget.planned_host_bytes),
            GiB(budget.planned_device_bytes),
            GiB(budget.host_alignment_reserve_bytes),
            scope="local",
        )
        return int(budget.final_planner_bytes)
```

引用理由：说明这道后处理在未开启 sparse offload 时是恒等函数，开启后会用 planner 的结果整体替换预算。

## vllm_ascend/worker/worker.py#L778-L821

```python
        npugraph_memory_bytes = 0
        if not self.model_config.enforce_eager:
            npugraph_memory_bytes = self.model_runner.capture_model()

        # Suggest an optimal --kv-cache-memory value for future runs.
        # Only emitted when we ran full profiling (kv_cache_memory_bytes was not
        # pre-specified) so that peak_activation_memory etc. are available.
        # non_kv_memory already includes NPU graph memory, so the suggestion
        # accounts for all measured memory categories. A 150 MiB buffer is kept
        # because memory_profiling may slightly underestimate non-torch
        # allocations (ACL context, HCCL buffers, driver layer, etc.).
        if self.cache_config.kv_cache_memory_bytes is None and hasattr(self, "peak_activation_memory"):
            redundancy_buffer = 150 * (1 << 20)  # 150 MiB safety margin
            non_kv_memory = (
                self.model_runner.model_memory_usage
                + self.peak_activation_memory
                + self.non_torch_memory
                + npugraph_memory_bytes
            )
            self.npugraph_memory_bytes = npugraph_memory_bytes
            suggested_to_requested = int(self.requested_memory) - non_kv_memory - redundancy_buffer
            suggested_to_gpu_limit = int(self.init_snapshot.free_memory) - non_kv_memory - redundancy_buffer
            msg = (
                f"Free memory on device "
                f"({format_gib(self.init_snapshot.free_memory)}/"
                f"{format_gib(self.init_snapshot.total_memory)} GiB) on startup. "
                f"Desired GPU memory utilization is "
                f"({self.cache_config.gpu_memory_utilization}, "
                f"{format_gib(self.requested_memory)} GiB). "
                f"Actual usage: {format_gib(self.model_runner.model_memory_usage)} GiB "
                f"for weights, {format_gib(self.peak_activation_memory)} GiB for peak "
                f"activation, {format_gib(self.non_torch_memory)} GiB for non-torch "
                f"memory, {format_gib(npugraph_memory_bytes)} GiB for NPU graph memory. "
                f"Replace gpu_memory_utilization with "
                f"`--kv-cache-memory={suggested_to_requested}` "
                f"({format_gib(suggested_to_requested)} GiB) to fit into requested "
                f"memory, or `--kv-cache-memory={suggested_to_gpu_limit}` "
                f"({format_gib(suggested_to_gpu_limit)} GiB) to fully utilize NPU "
                f"free memory. Current KV cache memory: "
                f"{format_gib(self.available_kv_cache_memory_bytes)} GiB. "
                f"After warmup: torch reserved memory {format_gib(torch.npu.memory_reserved())} GiB, "
                f"torch allocated memory {format_gib(torch.npu.memory_allocated())} GiB."
            )
            logger.info(msg)
```

引用理由：ACL 图内存 `npugraph_memory_bytes` 在 KV 预算**之后**才产生；建议值的公式与 150 MiB 冗余；日志里给出的两个候选值分别对齐 `requested_memory` 与 `free_memory`。

## vllm_ascend/worker/model_runner_v1.py#L3713-L3727

```python
    def profile_run(self) -> None:
        self.eplb_warmup()
        if self.sparse_kv_offload_enabled:
            allocate_kv_offload_topk_profile_buffers(
                getattr(self, "kv_cache_spec", None) or self.get_kv_cache_spec(),
                self.vllm_config,
                self.sparse_kv_offload_config,
            )

        mc2_tokens_capacity = get_mc2_tokens_capacity()
        if self.max_num_tokens > mc2_tokens_capacity and select_moe_comm_method(
            mc2_tokens_capacity, self.vllm_config
        ) in {MoECommType.MC2, MoECommType.FUSED_MC2}:
            self._dummy_run(mc2_tokens_capacity, with_prefill=True, is_profile=True)
        super().profile_run()
```

引用理由：昇腾侧 `profile_run` 的增量——EPLB 预热、sparse offload 的 topk buffer、以及 MC2 容量下的额外一次 dummy run；主体仍委托给上游 `super().profile_run()`。

## vllm_ascend/worker/model_runner_v1.py#L3760-L3766

```python
        with DeviceMemoryProfiler() as m:  # noqa: SIM117
            if self.eplb_enable:
                def mock_pass(param1, param2):
                    return
                from vllm.model_executor.model_loader.default_loader import DefaultModelLoader
                DefaultModelLoader._init_ep_weight_filter = mock_pass
            self.model: nn.Module = get_model(vllm_config=self.vllm_config)
```

引用理由：权重内存不是在 profiling 阶段量的，而是 `load_model()` 里由 `DeviceMemoryProfiler` 包住 `get_model()` 单独量的。

## vllm_ascend/worker/model_runner_v1.py#L3834-L3837

```python
            if self.lora_config:
                self.model = self.load_lora_model(self.model, self.vllm_config, self.device)
        self.model_memory_usage = m.consumed_memory
        logger.info("Loading model weights took %.4f GB", m.consumed_memory / float(2**30))
```

引用理由：`model_memory_usage` 的赋值点，即 `determine_available_memory` 里 `weights_memory=` 的来源。

## vllm_ascend/worker/model_runner_v1.py#L340-L341

```python
        self.max_num_tokens = self.scheduler_config.max_num_batched_tokens
        self.max_num_reqs = self.scheduler_config.max_num_seqs
```

引用理由：profiling 那一次前向的形状由这两个调度器参数决定，解释了为什么 `--max-num-batched-tokens` 会直接改变 KV 预算。

## vllm_ascend/patch/platform/patch_torch_accelerator.py#L10-L23

```python
# Monkey-patch torch.accelerator memory APIs for NPU compatibility.
# Upstream vLLM (commit 747b068) replaced current_platform.memory_stats()
# with torch.accelerator.memory_stats(), but torch.accelerator does not
# properly delegate to NPU. We redirect to torch.npu.* equivalents.
torch.accelerator.memory_stats = torch.npu.memory_stats  # type: ignore[attr-defined]
torch.accelerator.memory_reserved = torch.npu.memory_reserved  # type: ignore[attr-defined]
torch.accelerator.reset_peak_memory_stats = torch.npu.reset_peak_memory_stats  # type: ignore[attr-defined]
# torch.accelerator.get_memory_info() routes through c10's
# CachingDeviceAllocator and asserts the backend allocator is a
# DeviceAllocator; NPU's caching allocator is not, so it crashes with
# "Allocator for npu is not a DeviceAllocator". Redirect to the
# NPU-native API. This is needed on v0.24.0+ where MemorySnapshot
# is constructed with an explicit device arg that triggers this path.
torch.accelerator.get_memory_info = torch.npu.mem_get_info  # type: ignore[attr-defined]
```

引用理由：昇腾上 `MemorySnapshot` 能读到真实数字，靠的是这层 monkey patch 把 `torch.accelerator.*` 重定向到 `torch.npu.*`；这是「同一套上游 profiling 代码在昇腾上跑得通」的前提。

## vllm_ascend/_310p/worker_310p.py#L113-L133

```python
        # Divide the available memory by 2, to reserved more memory for other operators workspace and other cache
        # This could avoid OOM with default gpu_memory_utilization
        # The 310P RC device shares the host memory and device memory.
        # Therefore, the space available for allocating KV cache and Mamba cache needs to be calculated
        # based on the already occupied space of the system memory.

        if is_rc_device():
            vm = psutil.virtual_memory()
            self.available_kv_cache_memory_bytes = (self.requested_memory - (vm.total - vm.available)) // 2
        else:
            self.available_kv_cache_memory_bytes = (
                self.requested_memory - profile_result.non_kv_cache_memory - non_torch_memory_cleared_by_empty_cache
            ) // 2

        logger.debug(profile_result)
        logger.info_once(
            "Available KV cache memory: %.2f GiB (halved for workspace)",
            GiB(self.available_kv_cache_memory_bytes),
            scope="local",
        )
        return int(self.available_kv_cache_memory_bytes)
```

引用理由：310P 走的是另一套算法——结果整体除以 2，且 RC 设备改用主机内存口径。说明「A2/A3 的公式」不能推广到全部昇腾硬件。

## tests/ut/worker/a2/test_worker_multi_instance.py#L172-L223

```python
    def test_second_instance_on_same_card_positive_kv_cache(self, mock_logger, mock_get_ascend_config):
        """
        Regression test for PR #7427.

        Scenario (64 GiB Ascend 910B card, two Qwen3-0.6B instances,
        gpu_memory_utilization=0.4):

          ┌───────────────────────────────────────────────────────────────┐
          │ Card total:  64 GiB                                           │
          │ Instance 1:  requested_memory = 64 * 0.4 = 25.6 GiB (in use) │
          │ Instance 2 start: init_snapshot.free_memory ≈ 38.4 GiB       │
          │ Instance 2: requested_memory = 25.6 GiB                      │
          │ Profiling (fixed):  non_kv_cache_memory = 0.5 GiB (weights)  │
          │ available = 25.6 - 0.5 = 25.1 GiB  → must be > 0  ✓         │
          └───────────────────────────────────────────────────────────────┘

        Before the fix, non_kv_cache_memory was inflated to include first
        instance memory (~25.6 GiB), yielding available ≈ -1.32 GiB (OOM).
        """
        mock_get_ascend_config.return_value.sparse_kv_offload_config.enabled = False
        total = int(64 * GiB_bytes)
        gpu_util = 0.4
        requested_memory = int(total * gpu_util)  # 25.6 GiB

        # First instance already occupies its full requested_memory slice
        first_instance_used = requested_memory  # 25.6 GiB
        init_free = total - first_instance_used  # ~38.4 GiB

        # After the fix: profiling correctly reports only the second
        # instance's own model weights, not the first instance's memory.
        non_kv_cache = int(0.5 * GiB_bytes)  # Qwen3-0.6B weights

        worker = self._make_worker(requested_memory, init_free, total)
        profile_result = self._make_profile_result(
            free_memory_after=init_free - non_kv_cache,
            non_kv_cache_memory=non_kv_cache,
        )

        with self._patch_memory_profiling(profile_result):
            result = worker.determine_available_memory()

        self.assertGreater(
            result,
            0,
            "Second instance must have positive KV cache memory. "
            "A non-positive value means the multi-instance OOM bug "
            "(PR #7427) has regressed.",
        )
        expected = requested_memory - non_kv_cache
        self.assertEqual(result, expected)
        # Verify model_runner.profile_run() was called during profiling
        worker.model_runner.profile_run.assert_called_once()
```

引用理由：仓库自己写死的多实例场景，直接给出「一张 64 GiB 卡跑两个 Qwen3-0.6B、util=0.4」的真实数字，也说明了「差值只减自己这一份占用」这条不变量。

## tests/ut/worker/a2/test_worker_v1.py#L943-L949

```python
            worker.model_runner.profile_run.assert_called_once()

            # non_kv_cache_memory = non_torch_increase(1000) + torch_peak_increase(2000-0) + weights_memory(500) = 3500
            # result = requested_memory(8000) - non_kv_cache_memory(3500) = 4500
            expected_result = int(10000 * 0.8 - 3500)
            self.assertEqual(result, expected_result)
            worker._apply_kv_offload_decode_memory_constraints.assert_called_once_with(expected_result)
```

引用理由：把三项扣除的加法与最终减法写死成断言，是对主体公式最直接的确认。

## tests/ut/worker/a2/test_worker_v1.py#L1111-L1116

```python
            result = worker.determine_available_memory()

            # non_kv_cache_memory = 1000 + 9000 + 500 = 10500
            # available = requested(8000) - non_kv_cache(10500) = -2500
            # upstream no longer clamps to 0, returns int(negative)
            self.assertEqual(result, int(8000 - 10500))
```

引用理由：明确「预算算成负数时不会被钳位到 0」，用于「常见误解」一节。

## vllm_ascend/worker/model_runner_v1.py#L3694-L3711

```python
    @torch.inference_mode()
    def _dummy_sampler_run(
        self,
        hidden_states: torch.Tensor,
    ) -> torch.Tensor:
        output = None

        # For profile, have maximum num_reqs and that collectively have
        # maximum num_tokens.
        min_tokens_per_req = self.max_num_tokens // self.max_num_reqs
        num_scheduled_tokens_list = [min_tokens_per_req] * self.max_num_reqs
        num_scheduled_tokens_list[-1] += self.max_num_tokens % self.max_num_reqs
        num_scheduled_tokens = np.array(num_scheduled_tokens_list, dtype=np.int32)
        logit_indices = np.cumsum(num_scheduled_tokens) - 1
        # TODO: need to rum a dummy sampler for generate task
        hidden_states = hidden_states[logit_indices]
        output = self.model.compute_logits(hidden_states)
        return output
```

引用理由：profiling 那一次前向按「`max_num_reqs` 条请求、合计 `max_num_tokens` 个 token」的最坏形状构造，这是激活峰值口径的直接证据。

## docs/source/faqs.md#L138-L148

```markdown
### 12. How to handle the out-of-memory issue?

OOM errors typically occur when the model exceeds the memory capacity of a single NPU. For general guidance, you can refer to [vLLM OOM troubleshooting documentation](https://docs.vllm.ai/en/latest/usage/troubleshooting/#out-of-memory).

In scenarios where NPUs have limited high bandwidth memory (on-chip memory) capacity, dynamic memory allocation/deallocation during inference can exacerbate memory fragmentation, leading to OOM. To address this:

- **Limit `--max-model-len`**: It can save the on-chip memory usage for KV cache initialization step.

- **Adjust `--gpu-memory-utilization`**: If unspecified, the default value is `0.9`. You can decrease this value to reserve more memory to reduce fragmentation risks. See details in: [vLLM - Inference and Serving - Engine Arguments](https://docs.vllm.ai/en/latest/cli/serve/#-gpu-memory-utilization).

- **Configure `PYTORCH_NPU_ALLOC_CONF`**: Set this environment variable to optimize NPU memory management. For example, you can use `export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True` to enable virtual memory feature to mitigate memory fragmentation caused by frequent dynamic memory size adjustments during runtime. See details in [PYTORCH_NPU_ALLOC_CONF](https://www.hiascend.com/document/detail/zh/Pytorch/700/comref/Envvariables/Envir_012.html).
```

引用理由：官方文档给出 `gpu_memory_utilization` 的默认值 0.9，以及「调小它是为了给碎片留余量」这一使用侧解释——源码里读不到这层意图。

## docs/source/tutorials/models/Dots3-Note.md#L400-L408

```markdown
| Form | KV cache | Reason |
|---|---|---|
| text-only | `--gpu-memory-utilization 0.92` | Automatic profiling, validated |
| image | `--kv-cache-memory-bytes 2816M` | FusedMC2 peak needs about 3.64 GiB per card; too large a KV (3328M) causes OOM; combined with `--max-num-batched-tokens 1024` to chunk large-image prefill |
| audio | `--kv-cache-memory-bytes 4G` | Single-request budget is about 1,131 tokens (text 360 + audio 259 + output 512); 1G provides only 2,220 tokens, insufficient, while 4G provides 8,956 tokens (2.19x) |

> **Why image/audio use explicit `--kv-cache-memory-bytes` (measured)**: automatic profiling under v0.22.1 can allocate a large KV (audio gets 21,565 tokens at 0.92 and 25,686 tokens at 0.95), but the actual peak memory during graph capture exceeds the limit and causes the worker to exit, with logs showing `Worker proc VllmWorker-* died unexpectedly`. Explicit KV is more conservative than automatic profiling and reserves headroom for the about 3.76 GiB peak of graph capture, so it is the currently validated stable approach.
>
> If you insist on automatic profiling, you can set `VLLM_MEMORY_PROFILER_ESTIMATE_CUDAGRAPHS=0` to disable the ACL graph memory estimation and try again; this approach has not been validated on single modality and is not recommended as the default configuration for external deployment testing.
```

引用理由：官方文档实测记录，证明「图捕获阶段的峰值不在 KV 预算里」会真的把 worker 打死，也给出了真实场景下改用显式字节数的理由与 `--kv-cache-memory-bytes` 的实际拼写。
