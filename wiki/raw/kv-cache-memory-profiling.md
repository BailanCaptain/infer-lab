# KV Cache Memory Profiling — 源码片段

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

引用理由：这是 `gpu_memory_utilization` 在昇腾上的唯一语义定义——预算 = **total_memory × util**（不是 free 的比例），并给出启动期 free < requested 的硬失败检查。

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

引用理由：函数签名与快路径——`--kv-cache-memory` 一旦给定就完全绕过 profiling 计算（但仍跑 `profile_run()` 编译模型），且明确「不再遵守 gpu_memory_utilization」。

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

引用理由：核心公式。三项扣除（weights / activation peak / non-torch）的构成、torch peak 在 graph capture 之前取值的原因、以及最终 `available = requested - non_kv_cache_memory`。

## vllm_ascend/worker/worker.py#L500-L517

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
```

引用理由：profiling 结果并非终点——sparse KV offload 开启时会用 DRAM 上限重新规划，返回值被替换为 planner 的预算。

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

引用理由：物理字节数在 layerwise 复用下被放大成「逻辑预算」，说明返回值不总等于真实 HBM 字节；也给出日志 `Available KV cache memory` 的出处。

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

引用理由：NPU graph 显存在 profiling **之后**才发生，不在 `determine_available_memory` 的扣除里；这里补记账并给出 150 MiB 冗余与两个 `--kv-cache-memory` 建议值。

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

引用理由：昇腾侧 `profile_run` 的额外动作——EPLB warmup、sparse offload 的 topk buffer 预分配、MC2 容量下的额外 dummy run；这些分配都会计入 profiling 峰值。

## vllm_ascend/worker/model_runner_v1.py#L3836-L3837

```python
        self.model_memory_usage = m.consumed_memory
        logger.info("Loading model weights took %.4f GB", m.consumed_memory / float(2**30))
```

引用理由：`weights_memory` 的来源是 `load_model()` 里 `DeviceMemoryProfiler` 实测的权重占用，不是按参数量估算的。

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

引用理由：310P 覆写了同名方法——结果再对半砍以给算子 workspace 留量，RC 设备还按主机内存算；说明「预算公式」并非全平台一致。

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

引用理由：仓库内实测记录，佐证 profiling 会低估 graph capture 峰值而导致 worker 崩溃，以及规避开关 `VLLM_MEMORY_PROFILER_ESTIMATE_CUDAGRAPHS`。
