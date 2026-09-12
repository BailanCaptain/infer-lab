# KV Cache Memory Profiling — 引用片段

## vllm_ascend/worker/worker.py#L441-L454 （main, 28bf3a2e）

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

`gpu_memory_utilization` 的分母是 `total_memory` 而不是 `free_memory`，以及启动期唯一一处「空闲不够就直接报错」的检查——页面「为什么需要它」「事实表」两处都依赖它。

## vllm_ascend/worker/worker.py#L464-L480 （v0.23.0, 2c59ff10）

```python
        # take current memory snapshot
        if vllm_version_is("0.23.0"):
            self.init_snapshot = MemorySnapshot()
        else:
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

与 main 的唯一差异是快照构造多一个 `vllm_version_is("0.23.0")` 分支——事实表最后一行的版本差异来自这里。

## vllm_ascend/worker/worker.py#L536-L584 （main, 28bf3a2e）

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
```

主流程的前半段：`--kv-cache-memory-bytes` 快路径、`memory_profiling` 上下文、以及 `non_kv_cache_memory` 三项相加的定义。

## vllm_ascend/worker/worker.py#L586-L630 （main, 28bf3a2e）

```python
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

主公式 `requested_memory − non_kv_cache_memory`、profiling 失效时的断言，以及 main 独有的两道后处理（层复用缩放、sparse offload 重规划）。

## vllm_ascend/worker/worker.py#L526-L574 （v0.23.0, 2c59ff10）

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
            return kv_cache_memory_bytes

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
```

v0.23.0 的同一段：快路径**直接返回** `kv_cache_memory_bytes`，没有 main 的 sparse 规划包装。

## vllm_ascend/worker/worker.py#L576-L597 （v0.23.0, 2c59ff10）

```python
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

        logger.debug(profile_result)
        logger.info_once(
            "Available KV cache memory: %.2f GiB", GiB(self.available_kv_cache_memory_bytes), scope="local"
        )

        return int(self.available_kv_cache_memory_bytes)
```

v0.23.0 算完主公式就返回——没有层复用缩放、没有 sparse offload 重规划。

## vllm_ascend/worker/worker.py#L500-L534 （main, 28bf3a2e）

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

main 独有的后处理：未开启 sparse offload 时原样返回，开启后由 `plan_sparse_kv_offload_memory` 重算预算——这是「main 上返回值不一定等于主公式」的依据。

## vllm_ascend/worker/worker.py#L778-L821 （main, 28bf3a2e）

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

图捕获发生在 KV cache 分配**之后**，图池字节数只进入建议值、不进入预算；150 MiB 冗余量和两个建议值的算式也在这里。

## vllm_ascend/worker/worker.py#L730-L771 （v0.23.0, 2c59ff10）

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
                f"{format_gib(self.available_kv_cache_memory_bytes)} GiB."
            )
            logger.info(msg)
```

v0.23.0 的同一段——两个建议值算式与 150 MiB 冗余量逐字相同，仅日志末尾少了 warmup 后的 torch reserved/allocated 两项。

## vllm_ascend/worker/model_runner_v1.py#L3713-L3727 （main, 28bf3a2e）

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

vllm-ascend 对 `profile_run` 的加料：EPLB 预热、sparse offload 的 topk 缓冲、MC2 容量上限的额外 dummy run，最后才落到上游 `GPUModelRunner.profile_run`。

## vllm_ascend/worker/model_runner_v1.py#L3684-L3697 （v0.23.0, 2c59ff10）

```python
    def profile_run(self) -> None:
        self.eplb_warmup()
        mc2_tokens_capacity = get_mc2_tokens_capacity()
        if self.max_num_tokens > mc2_tokens_capacity and select_moe_comm_method(
            mc2_tokens_capacity, self.vllm_config
        ) in {MoECommType.MC2, MoECommType.FUSED_MC2}:
            self._dummy_run(mc2_tokens_capacity, with_prefill=True, is_profile=True)
        origin_max_num_tokens = self.max_num_tokens
        # in the pcp scenario, the split sequence needs to be used for profile run
        # TODO: after the vllm pcp function is launched, this logic needs to be brought up to the community
        if self.pcp_size > 1:
            self.max_num_tokens = math.ceil(self.max_num_tokens / (self.pcp_size * 2)) * 2
        super().profile_run()
        self.max_num_tokens = origin_max_num_tokens
```

v0.23.0 独有的 PCP 分支：`pcp_size > 1` 时按 `pcp_size * 2` 缩小 profile 的 token 数，直接改变测出的激活峰值。

## vllm_ascend/worker/model_runner_v1.py#L3834-L3837 （main, 28bf3a2e）

```python
            if self.lora_config:
                self.model = self.load_lora_model(self.model, self.vllm_config, self.device)
        self.model_memory_usage = m.consumed_memory
        logger.info("Loading model weights took %.4f GB", m.consumed_memory / float(2**30))
```

`weights_memory` 的来源：`DeviceMemoryProfiler` 包住整个 `load_model`，把权重加载消耗记成 `model_memory_usage`。

## vllm_ascend/worker/model_runner_v1.py#L5175-L5185 （main, 28bf3a2e）

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

图池内存是 `capture_model` 的**返回值**（实测，不是估算），而这个调用在 KV cache 分配之后。

## vllm_ascend/_310p/worker_310p.py#L113-L133 （main, 28bf3a2e）

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

Atlas 300I Duo（310P）覆盖了整个方法：预算再折半，且 RC 形态改用主机内存统计。

## vllm_ascend/_310p/worker_310p.py#L103-L123 （v0.23.0, 2c59ff10）

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

两版逐字相同——用来确认 310P 折半这条结论不分版本。

## tests/ut/worker/a2/test_worker_multi_instance.py#L172-L223 （main, 28bf3a2e）

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

上游自己写下的「同卡多实例」语义：第二个实例照样拿 `total × util`，因为扣的是本进程 profiling 期间的增量，不是卡上已被别人占走的量。

## tests/ut/worker/a2/test_worker_multi_instance.py#L146-L168 （main, 28bf3a2e）

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

        worker.model_runner.profile_run.assert_called_once()
        worker.model_runner.profile_cudagraph_memory.assert_not_called()
        self.assertFalse(hasattr(worker, "npugraph_memory_estimate"))
        self.assertEqual(result, requested_memory - non_kv_cache)
```

明确断言 vllm-ascend **不**调用上游的 `profile_cudagraph_memory`、也不设 `npugraph_memory_estimate`——「图内存不进预算」是有意为之。

## tests/ut/worker/a2/test_worker_v1.py#L1109-L1116 （main, 28bf3a2e）

```python
            mock_torch_memory_stats.return_value = {"allocated_bytes.all.peak": 9000}

            result = worker.determine_available_memory()

            # non_kv_cache_memory = 1000 + 9000 + 500 = 10500
            # available = requested(8000) - non_kv_cache(10500) = -2500
            # upstream no longer clamps to 0, returns int(negative)
            self.assertEqual(result, int(8000 - 10500))
```

预算算成负数时**不夹到 0**，原样返回——「常见误解」第三条的依据。

## docs/source/faqs.md#L138-L148 （main, 28bf3a2e）

```markdown
### 12. How to handle the out-of-memory issue?

OOM errors typically occur when the model exceeds the memory capacity of a single NPU. For general guidance, you can refer to [vLLM OOM troubleshooting documentation](https://docs.vllm.ai/en/latest/usage/troubleshooting/#out-of-memory).

In scenarios where NPUs have limited high bandwidth memory (on-chip memory) capacity, dynamic memory allocation/deallocation during inference can exacerbate memory fragmentation, leading to OOM. To address this:

- **Limit `--max-model-len`**: It can save the on-chip memory usage for KV cache initialization step.

- **Adjust `--gpu-memory-utilization`**: If unspecified, the default value is `0.9`. You can decrease this value to reserve more memory to reduce fragmentation risks. See details in: [vLLM - Inference and Serving - Engine Arguments](https://docs.vllm.ai/en/latest/cli/serve/#-gpu-memory-utilization).

- **Configure `PYTORCH_NPU_ALLOC_CONF`**: Set this environment variable to optimize NPU memory management. For example, you can use `export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True` to enable virtual memory feature to mitigate memory fragmentation caused by frequent dynamic memory size adjustments during runtime. See details in [PYTORCH_NPU_ALLOC_CONF](https://www.hiascend.com/document/detail/zh/Pytorch/700/comref/Envvariables/Envir_012.html).
```

官方文档给出的默认值 0.9，以及「调小它是为了给碎片留余量」这层用意——源码里只有算式，没有这层解释。v0.23.0 同内容位于 `docs/source/faqs.md#L140-L150`。

## docs/source/tutorials/models/Dots3-Note.md#L398-L408 （main, 28bf3a2e）

```markdown
#### 5.5.3 KV Cache Configuration

| Form | KV cache | Reason |
|---|---|---|
| text-only | `--gpu-memory-utilization 0.92` | Automatic profiling, validated |
| image | `--kv-cache-memory-bytes 2816M` | FusedMC2 peak needs about 3.64 GiB per card; too large a KV (3328M) causes OOM; combined with `--max-num-batched-tokens 1024` to chunk large-image prefill |
| audio | `--kv-cache-memory-bytes 4G` | Single-request budget is about 1,131 tokens (text 360 + audio 259 + output 512); 1G provides only 2,220 tokens, insufficient, while 4G provides 8,956 tokens (2.19x) |

> **Why image/audio use explicit `--kv-cache-memory-bytes` (measured)**: automatic profiling under v0.22.1 can allocate a large KV (audio gets 21,565 tokens at 0.92 and 25,686 tokens at 0.95), but the actual peak memory during graph capture exceeds the limit and causes the worker to exit, with logs showing `Worker proc VllmWorker-* died unexpectedly`. Explicit KV is more conservative than automatic profiling and reserves headroom for the about 3.76 GiB peak of graph capture, so it is the currently validated stable approach.
>
> If you insist on automatic profiling, you can set `VLLM_MEMORY_PROFILER_ESTIMATE_CUDAGRAPHS=0` to disable the ACL graph memory estimation and try again; this approach has not been validated on single modality and is not recommended as the default configuration for external deployment testing.
```

官方实测记录：自动 profiling 通过、图捕获阶段却把 worker 撑死——「profiling 通过不等于不会 OOM」这条误解的一手证据。

## docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L109-L110 （main, 28bf3a2e）

```markdown
- The `gpu_memory_utilization` parameter controls how much NPU memory is reserved for KV cache. Lower values leave less NPU memory for KV cache, making offloading more active.
- For production workloads, benchmark with realistic request patterns to find the optimal `cpu_bytes_to_use` and `blocks_per_chunk` settings.
```

官方把「调小 `gpu_memory_utilization`」直接当成驱动 CPU offload 的手柄——本页与 offload 那页的接口。v0.23.0 同一句位于 `docs/source/user_guide/feature_guide/kv_cache_cpu_offload.md#L107`。
