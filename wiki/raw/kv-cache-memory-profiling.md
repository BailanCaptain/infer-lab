# raw: kv-cache-memory-profiling

引用自 vllm-ascend@28bf3a2e。

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

`gpu_memory_utilization` 的基数是 `total_memory` 而不是 `free_memory`，以及启动期的可行性检查，都在这里。页面用它说明「requested_memory 怎么来」与「为什么同卡多实例不会互相把对方的占用算进自己的开销」。

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

`--kv-cache-memory` 快路径：跳过 profiling 计算但仍跑 `profile_run()`，且明确声明不再遵守 `gpu_memory_utilization`。页面用它写「常见误解」与事实表的 fast path 行。

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

页面的核心公式来源：三项扣除（non_torch_increase + torch_peak_increase + weights_memory）与 `requested_memory - non_kv_cache_memory`，以及 profiling 失效时的 assert。

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

profiling 结果之后的两道修正：layerwise 复用把「物理字节」放大成「逻辑字节」，sparse KV offload 再做一次重规划。页面用它画流程图末段。

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

未开 sparse offload 时这一步是恒等函数——用来说明「默认路径下 profiling 的结果就是最终返回值」。

## vllm_ascend/worker/worker.py#L1009-L1020

```python
    def initialize_from_config(self, kv_cache_config: KVCacheConfig) -> None:
        """Allocate NPU KV cache with the specified kv_cache_config."""
        ensure_kv_transfer_initialized(self.vllm_config, kv_cache_config)
        if self.vllm_config.model_config.enable_sleep_mode:
            allocator = CaMemAllocator.get_instance()
            context = allocator.use_memory_pool(tag="kv_cache")
        else:
            from contextlib import nullcontext

            context = nullcontext()  # type: ignore
        with context:
            self.model_runner.initialize_kv_cache(kv_cache_config)
```

KV 张量的真正分配点。它排在 `compile_or_warm_up_model()` 之前，页面用它论证「ACL graph 显存花的是 KV 分配之后的余量」。

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

第五类内存（ACL graph pool）在这里才被测出，并只进入 `--kv-cache-memory` 的建议值，不回头修正已分配的 KV 预算；150 MiB 冗余量也在这里。页面的事实表与「常见误解」第 3 条都引它。

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

昇腾侧在上游 `profile_run` 之前额外跑一次 MC2 容量的 dummy run，把 MC2 通信算子的 HCCL buffer 也纳入 peak；页面用它讲「昇腾侧与上游的差异」。

## vllm_ascend/worker/model_runner_v1.py#L340-L341

```python
        self.max_num_tokens = self.scheduler_config.max_num_batched_tokens
        self.max_num_reqs = self.scheduler_config.max_num_seqs
```

profiling 的 dummy batch 形状由这两个调度器上限决定，页面的事实表与 worked example 需要它。

## vllm_ascend/worker/model_runner_v1.py#L5175-L5185

```python
    def capture_model(self) -> int:
        """Capture NPU graphs and return actual graph pool memory bytes consumed."""
        parent_module_name = _get_gpu_model_runner_module_name(self)
        with _torch_cuda_wrapper(), _replace_gpu_model_runner_function_wrapper(parent_module_name):
            cuda_graph_size = GPUModelRunner.capture_model(self)

        mgr = self.encoder_cudagraph_manager
        if mgr is not None and self.update_stream is not None:
            mgr.update_stream = self.update_stream

        return cuda_graph_size
```

`capture_model()` 返回真实占用的 graph pool 字节数——这是 `npugraph_memory_bytes` 的来源，说明它是「实测」而非估算。

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

`MemorySnapshot` 的 `free_memory` / `total_memory` 在昇腾上实际来自 `torch.npu.mem_get_info`，即驱动层整卡口径——页面据此说明 `gpu_memory_utilization` 的分母是什么。

## vllm_ascend/_310p/worker_310p.py#L113-L125

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
```

310I Duo 走另一条实现：结果再除以 2，RC 模式还改用主机内存口径。页面用它说明「这页讲的是 A2/A3 主线路径，310P 不同」。

## docs/source/faqs.md#L138-L148

```markdown
### 12. How to handle the out-of-memory issue?

OOM errors typically occur when the model exceeds the memory capacity of a single NPU. For general guidance, you can refer to [vLLM OOM troubleshooting documentation](https://docs.vllm.ai/en/latest/usage/troubleshooting/#out-of-memory).

In scenarios where NPUs have limited high bandwidth memory (on-chip memory) capacity, dynamic memory allocation/deallocation during inference can exacerbate memory fragmentation, leading to OOM. To address this:

- **Limit `--max-model-len`**: It can save the on-chip memory usage for KV cache initialization step.

- **Adjust `--gpu-memory-utilization`**: If unspecified, the default value is `0.9`. You can decrease this value to reserve more memory to reduce fragmentation risks. See details in: [vLLM - Inference and Serving - Engine Arguments](https://docs.vllm.ai/en/latest/cli/serve/#-gpu-memory-utilization).

- **Configure `PYTORCH_NPU_ALLOC_CONF`**: Set this environment variable to optimize NPU memory management. For example, you can use `export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True` to enable virtual memory feature to mitigate memory fragmentation caused by frequent dynamic memory size adjustments during runtime. See details in [PYTORCH_NPU_ALLOC_CONF](https://www.hiascend.com/document/detail/zh/Pytorch/700/comref/Envvariables/Envir_012.html).
```

官方文档对 `--gpu-memory-utilization` 默认值 0.9 与调小它的用途（留碎片余量）的唯一一手表述，页面的「为什么需要它」与事实表默认值行引它。

## tests/ut/worker/a2/test_worker_multi_instance.py#L172-L223

```python
    @patch("vllm_ascend.worker.worker.get_ascend_config")
    @patch("vllm_ascend.worker.worker.logger")
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

同卡多实例语义的权威说明（含 PR #7427 的前后对比），页面「为什么需要它」与「常见误解」第 2 条引它。

## tests/ut/worker/a2/test_worker_multi_instance.py#L146-L168

```python
    @patch("vllm_ascend.worker.worker.get_ascend_config")
    @patch("vllm_ascend.worker.worker.logger")
    def test_determine_available_memory_does_not_profile_npugraph_memory(self, mock_logger, mock_get_ascend_config):
        mock_get_ascend_config.return_value.sparse_kv_offload_config.enabled = False
        total = int(64 * GiB_bytes)
        requested_memory = int(total * 0.9)
        init_free = int(60 * GiB_bytes)
        non_kv_cache = int(1 * GiB_bytes)

        worker = self._make_worker(requested_memory, init_free, total)
        worker.model_runner.profile_cudagraph_memory = MagicMock()
        profile_result = self._make_profile_result(
            free_memory_after=init_free - non_kv_cache,
            non_kv_cache_memory=non_kv_cache,
        )

        with self._patch_memory_profiling(profile_result):
            result = worker.determine_available_memory()

        worker.model_runner.profile_cudagraph_memory.assert_not_called()
        self.assertFalse(hasattr(worker, "npugraph_memory_estimate"))
        self.assertEqual(result, requested_memory - non_kv_cache)
```

锁死了「ACL graph 显存不在 determine_available_memory 里扣」这条行为，页面「常见误解」第 3 条引它。
