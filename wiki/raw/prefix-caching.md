# Prefix Caching —— 引用片段

所有源码片段取自 `vllm-ascend@28bf3a2e`（ref `main`），行号为实际打开阅读的行。

## vllm_ascend/utils.py#L1167-L1204

```python
def refresh_block_size(vllm_config):
    """
    Refresh the block size in cache config.
    """
    cache_config = vllm_config.cache_config
    scheduler_config = vllm_config.scheduler_config
    model_config = vllm_config.model_config

    if not cache_config:
        return

    if cache_config.block_size is None:
        cache_config.block_size = 128

    if not scheduler_config or not model_config:
        return

    if model_config.hf_config.model_type == "deepseek_v4":
        if cache_config.block_size is None:
            cache_config.block_size = 32
        elif cache_config.block_size not in [32, 64, 128]:
            logger.warning(
                "For deepseek_v4 model, block size should be 32, 64 or 128. "
                "Setting block size to 32 for better performance."
            )
            cache_config.block_size = 32
        return

    if model_config.is_hybrid:
        # Hybrid attention+mamba models rely on the model-specific sizing
        # logic rather than the generic platform default.
        return

    if cache_config.block_size != 128:
        if cache_config.enable_prefix_caching or scheduler_config.enable_chunked_prefill:
            logger.info("Block size is set to 128 if prefix cache or chunked prefill is enabled.")
            cache_config.block_size = 128
            return
```

开启前缀缓存（或 chunked prefill）会把 `block_size` 强制改写成 128，并列出 deepseek_v4 与 hybrid 两个例外分支。页面「怎么工作」「事实表」都引用这一段。

## vllm_ascend/platform.py#L441-L462

```python
        # 4.Make sure the config is compatible with Ascend
        _fix_incompatible_config(vllm_config)

        # 5.Initialize Ascend config and validate Ascend-specific options
        # (fused MC2 exclusivity + scheduler extension policies)
        # ascend_config is only used for verification, this object must NOT be modified here
        ascend_config = init_ascend_config(vllm_config)
        _check_ascend_config(vllm_config, ascend_config)

        # 6.Update compilation / cudagraph modes (ascend_config -> vllm_config).
        _update_compilation_modes(vllm_config, ascend_config)

        # 7.Recompute cudagraph sizes and setup compile backend (vllm_config).
        _setup_compile_backend(
            vllm_config,
            compile_backend=cls.get_compile_backend(),
            enable_shared_expert_dp=ascend_config.enable_shared_expert_dp,
            enable_dsa_cp=ascend_config.enable_dsa_cp,
        )

        # 8.Setup worker class, custom ops and scheduler (ascend_config -> vllm_config).
        _setup_worker_and_scheduler(vllm_config, ascend_config)
```

这是 `NPUPlatform.check_and_update_config`（定义在同文件 L413-L414）的后半段，说明 block size 改写发生在第 8 步、启动期一次性完成。页面「怎么工作」的配置流程图引用它。

## vllm_ascend/platform.py#L1195-L1210

```python
    # Select worker class and refresh block size
    parallel_config = vllm_config.parallel_config
    if parallel_config and parallel_config.worker_cls == "auto":
        additional_config = vllm_config.additional_config or {}
        if ("enable_flashcomm1" not in additional_config) and (not os.getenv("VLLM_ASCEND_ENABLE_FLASHCOMM1")):
            parallel_config.all2all_backend = "flashinfer_all2allv"  # a trikky way to disable SP moe.
        hardware_profile = get_current_hardware_profile()
        if ascend_config.xlite_graph_config.enabled and hardware_profile.supports(
            HardwareCapability.STANDARD_WORKER_PATCHES
        ):
            logger.info("openEuler Xlite enabled. See: https://atomgit.com/openeuler/GVirt/tree/master/xlite")
            parallel_config.worker_cls = "vllm_ascend.xlite.xlite_worker.XliteWorker"
        else:
            parallel_config.worker_cls = hardware_profile.default_worker_cls

    refresh_block_size(vllm_config)
```

`_setup_worker_and_scheduler` 里调用 `refresh_block_size`，把上一段和 utils.py 那段接起来。页面「怎么工作」引用它。

## vllm_ascend/platform.py#L325-L345

```python
    @classmethod
    def update_block_size_for_backend(cls, vllm_config: VllmConfig) -> None:
        # TODO: NPU still sets block_size in check_and_update_config.
        # Move that logic here so block_size is chosen by the backend.
        using_kv_transfer_with_hybrid = (
            not vllm_config.scheduler_config.disable_hybrid_kv_cache_manager and vllm_config.kv_transfer_config
        )
        cache_config = vllm_config.cache_config
        model_config = vllm_config.model_config
        if (
            not cache_config.enable_prefix_caching
            and using_kv_transfer_with_hybrid
            and cache_config.mamba_cache_mode == "align"
        ):
            if cache_config.mamba_block_size is None or cache_config.mamba_block_size == model_config.max_model_len:
                cache_config.mamba_block_size = cache_config.block_size
            else:
                # mamba_block_size must be a multiple of block_size, so that it can hand the block hash
                assert cache_config.mamba_block_size % cache_config.block_size == 0, (
                    f"mamba_block_size must be a multiple of block_size: {cache_config.block_size}"
                )
```

这是 `platform.py` 里第二处读 `enable_prefix_caching` 的地方：hybrid（Mamba）路径下 mamba_block_size 必须是 block_size 的整数倍，注释明说是「so that it can hand the block hash」。页面用它佐证「哈希以 block 为单位」以及 hybrid 的例外。

## vllm_ascend/models/layer/attention/layer.py#L121-L128

```python
        # NOTE(zxr): vllm_is_batch_invariant is delete during updating to v0.20.1
        if (
            cache_config is not None
            and cache_config.enable_prefix_caching
            and (self.attn_backend.get_name() == "TRITON_MLA" or self.attn_backend.get_name() == "FLASHINFER")
        ):
            cache_config.enable_prefix_caching = False
```

昇腾侧唯一一处「静默关掉前缀缓存」的代码，位于 DeepSeek-V4 稀疏注意力层的构造函数中。页面「事实表」与「常见误解」引用它。

## vllm_ascend/_310p/worker/v2/model_runner.py#L99-L106

```python
        # TODO: Support speculative decoding in the next 310P MRV2 iteration.
        if vllm_config.speculative_config is not None:
            raise NotImplementedError("Speculative decoding is not supported by model runner v2 on 310P.")
        if vllm_config.kv_transfer_config is not None:
            raise NotImplementedError("KV cache transfer is not supported by model runner v2 on 310P.")
        # TODO: Support prefix caching in the next 310P MRV2 iteration.
        if vllm_config.cache_config.enable_prefix_caching:
            raise NotImplementedError("Prefix caching is not supported by model runner v2 on 310P.")
```

310P + model runner v2 直接拒绝启动。页面「事实表」引用它。

## vllm_ascend/worker/model_runner_v1.py#L1167-L1176

```python
        # Get positions.
        cu_num_tokens = self._get_cumsum_and_arange(
            num_scheduled_tokens, self.query_pos.np
        )
        positions_np = self._positions_np_buf[:total_num_scheduled_tokens]
        np.add(
            self.input_batch.num_computed_tokens_cpu[req_indices],
            self.query_pos.np[: cu_num_tokens[-1]],
            out=positions_np,
        )
```

命中后位置编号从 `num_computed_tokens` 起算，而不是从 0 起算。页面「怎么工作」「拿真实数字走一遍」引用它。

## vllm_ascend/worker/model_runner_v1.py#L1216-L1231

```python
        # Get token indices.
        # E.g., [0, 1, 0, 1, 2, 3, 4, 0, 1, 2]
        # -> [0, 1, M, M + 1, M + 2, M + 3, M + 4, 2 * M, 2 * M + 1, 2 * M + 2]
        # where M is the max_model_len.
        token_indices = positions_np + req_indices * self.input_batch.token_ids_cpu.shape[1]
        token_indices_tensor = torch.from_numpy(token_indices)
        # Prepare input_ids.
        # NOTE(woosuk): We use torch.index_select instead of np.take here
        # because torch.index_select is much faster than np.take for large
        # tensors.
        torch.index_select(
            self.input_batch.token_ids_cpu_tensor.flatten(),
            0,
            token_indices_tensor,
            out=self.input_ids.cpu[:total_num_scheduled_tokens],
        )
```

`input_ids` 只按 `positions_np` 取本次被调度的 token——命中的前缀 token 根本不进 forward 的输入。页面「怎么工作」的「跳过了什么」引用它。

## vllm_ascend/worker/model_runner_v1.py#L1295-L1300

```python
        torch.add(
            self.input_batch.num_computed_tokens_cpu_tensor[:num_reqs],
            torch.from_numpy(num_scheduled_tokens),
            out=self.optimistic_seq_lens_cpu[:num_reqs],
        )
        self.optimistic_seq_lens_cpu[num_reqs:].fill_(0)
```

`seq_len = num_computed_tokens + num_scheduled_tokens`：注意力仍然覆盖完整序列，只是前半段从 KV cache 读。页面用它说明「省的是写，不是读」。

## vllm_ascend/worker/model_runner_v1.py#L1542-L1569

```python
    def _build_attn_state(self, num_reqs, num_scheduled_tokens, num_valid_tokens):
        if np.all(self.input_batch.num_computed_tokens_cpu[:num_reqs] == 0):
            attn_state = AscendAttentionState.PrefillNoCache
        # We assume it is the decode stage, where prefill occurs but only one token is not hit in cache.
        elif np.all(num_scheduled_tokens == 1):
            attn_state = AscendAttentionState.DecodeOnly
            if self.speculative_config and self.speculative_config.method == "mtp":
                # SpecDecoding now supports seq_len=1 and seq_len=2
                # In Prefilling Decoding Disaggregation scenario, SpecDecoding need to supports seq_len=1
                attn_state = AscendAttentionState.SpecDecoding
        # Speculative decoding.
        elif np.all(num_valid_tokens == 1):
            if self.speculative_config:
                attn_state = AscendAttentionState.SpecDecoding
            else:
                attn_state = AscendAttentionState.ChunkedPrefill
        # splitfuse
        elif self.scheduler_config.enable_chunked_prefill:
            attn_state = AscendAttentionState.ChunkedPrefill
        else:
            attn_state = AscendAttentionState.PrefillCacheHit

        if attn_state == AscendAttentionState.SpecDecoding and self.speculative_config.method != "mtp":
            self.attn_state = AscendAttentionState.ChunkedPrefill  # type: ignore
        else:
            self.attn_state = attn_state  # type: ignore

        return attn_state
```

昇腾侧最核心的适配：命中与否决定走哪条 kernel 分支，且 `PrefillCacheHit` 只在 chunked prefill **未开启**时才可能出现。页面「怎么工作」「与 chunked prefill 的耦合」「常见误解」都引用它。

## vllm_ascend/worker/v2/attn_utils.py#L314-L336

```python
    elif np.array_equal(seq_lens_np[:num_reqs], num_scheduled_tokens):
        attn_state = AscendAttentionState.PrefillNoCache
    # We assume it is the decode stage, where prefill occurs
    # but only one token is not hit in cache.
    elif np.all(num_scheduled_tokens == 1):
        attn_state = AscendAttentionState.DecodeOnly
        if vllm_config.speculative_config and vllm_config.speculative_config.method == "mtp":
            # SpecDecoding now supports seq_len=1 and seq_len=2
            # In Prefilling Decoding Disaggregation scenario, SpecDecoding
            # need to supports seq_len=1
            attn_state = AscendAttentionState.SpecDecoding
    # Speculative decoding.
    elif np.all(num_valid_tokens == 1):
        if vllm_config.speculative_config and vllm_config.speculative_config.method == "mtp":
            attn_state = AscendAttentionState.SpecDecoding
        else:
            attn_state = AscendAttentionState.ChunkedPrefill
    # splitfuse
    elif vllm_config.scheduler_config.enable_chunked_prefill:
        attn_state = AscendAttentionState.ChunkedPrefill
    else:
        attn_state = AscendAttentionState.PrefillCacheHit
    return attn_state
```

model runner v2 的同名逻辑，判定条件与 v1 一致。页面用它说明两代 runner 的行为一致，不是 v1 独有。

## vllm_ascend/attention/attention_v1.py#L151-L161

```python
    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]


class AscendAttentionState(Enum):
    PrefillNoCache = 0
    PrefillCacheHit = 1
    DecodeOnly = 2
    ChunkedPrefill = 3
    SpecDecoding = 4
```

后端只认 128 的 kernel block size，以及命中态枚举本身。页面「事实表」引用它。

## vllm_ascend/attention/attention_v1.py#L1307-L1345

```python
        if attn_metadata.attn_state == AscendAttentionState.PrefillNoCache:
            block_size = 128
            block_table = None
            actual_seq_lengths_kv = attn_metadata.actual_seq_lengths_q
            if self.attn_type == AttentionType.ENCODER_DECODER:
                actual_seq_lengths_kv = torch.cumsum(attn_metadata.seq_lens, dim=0).tolist()
        elif attn_metadata.attn_state == AscendAttentionState.PrefillCacheHit:
            batch_size = attn_metadata.seq_lens.shape[0]
            block_table = attn_metadata.block_tables[:batch_size, :]
            num_block, block_size, _, _ = self.key_cache.shape  # type: ignore
            key = self.key_cache.view(  # type: ignore
                num_block, block_size, -1
            )
            value = self.value_cache.view(  # type: ignore
                num_block, block_size, -1
            )
            actual_seq_lengths_kv = attn_metadata.seq_lens_list
        elif attn_metadata.attn_state == AscendAttentionState.DecodeOnly:
            num_block, block_size, _, _ = self.key_cache.shape  # type: ignore
            key = self.key_cache.view(  # type: ignore
                num_block, block_size, -1
            )
            value = self.value_cache.view(  # type: ignore
                num_block, block_size, -1
            )
            block_table = attn_metadata.block_tables
            actual_seq_lengths_kv = attn_metadata.seq_lens_list
        # chunked prefill.
        else:
            num_block, block_size, _, _ = self.key_cache.shape  # type: ignore
            key = self.key_cache.view(  # type: ignore
                num_block, block_size, -1
            )
            value = self.value_cache.view(  # type: ignore
                num_block, block_size, -1
            )
            block_table = attn_metadata.block_tables
            actual_seq_lengths_kv = attn_metadata.seq_lens_list
        return key, value, block_size, block_table, actual_seq_lengths_kv
```

`PrefillNoCache` 是唯一 `block_table = None` 的分支；一旦命中，K/V 改为从分页 KV cache 按 block table 取。页面「怎么工作」引用它，说明命中把「无缓存 prefill」变成「带 block table 的 prefill」。

## vllm_ascend/patch/platform/patch_kv_cache_utils.py#L51-L84

```python
def _ascend_resolve_kv_cache_block_sizes(
    kv_cache_config: KVCacheConfig,
    vllm_config: VllmConfig,
) -> tuple[int, int]:
    """Ascend-compatible resolve_kv_cache_block_sizes.

    vLLM PR #40860 added a restriction that hybrid KV cache groups with
    multiple block sizes do not support DCP.
    This restriction is correct for CUDA but not for Ascend, which implements
    context parallelism for MLA and SWA-MLA layers independently.

    For multiple KV cache groups with CP, compute scheduler_block_size as
    lcm(group_block_sizes) * dcp to maintain alignment.
    """
    cache_config = vllm_config.cache_config
    dcp = vllm_config.parallel_config.decode_context_parallel_size
    groups = kv_cache_config.kv_cache_groups

    if len(groups) <= 1:
        bs = cache_config.block_size * dcp
        return bs, bs

    if dcp != 1:
        # Ascend supports CP with multiple KV cache groups; compute
        # scheduler_block_size using the LCM of all group block sizes
        # multiplied by the CP factors for proper alignment.
        group_block_sizes = [g.kv_cache_spec.block_size for g in groups]
        scheduler_block_size = math.lcm(*group_block_sizes) * dcp
        if not cache_config.enable_prefix_caching:
            return scheduler_block_size, scheduler_block_size
        hash_block_size = math.gcd(*group_block_sizes)
        return scheduler_block_size, hash_block_size
    return _orig_resolve_kv_cache_block_sizes(kv_cache_config, vllm_config)
```

函数返回 `(scheduler_block_size, hash_block_size)`——「哈希块大小」是一个独立于调度块大小的一等概念，而且只在 `enable_prefix_caching` 为真时才与调度块大小分离。页面「哈希以 block 为单位的依据」引用它。

## vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L156-L172

```python
            # hash_block_size: the block size used to compute block hashes.
            # The actual block size usually equals hash_block_size, but in cases where
            # different KV cache groups have different block sizes, the actual block size
            # can be a multiple of hash_block_size.
            self.hash_block_size = hash_block_size
            if enable_caching:
                assert all(
                    self._get_effective_block_size(g.kv_cache_spec) % hash_block_size == 0
                    for g in kv_cache_config.kv_cache_groups
                ), "block_size must be divisible by hash_block_size"
            self.enable_partial_hash_hits = dcp_world_size == 1 and any(
                isinstance(g.kv_cache_spec, MambaSpec)
                and g.kv_cache_spec.mamba_cache_mode == "align"
                and g.kv_cache_spec.block_size > hash_block_size
                for g in kv_cache_config.kv_cache_groups
            )
            self.verify_and_split_kv_cache_groups()
```

昇腾侧重写的 KV cache coordinator 构造函数，注释直接定义了 `hash_block_size` 是「用来算 block hash 的块大小」，并断言每个组的 block_size 必须能被它整除。页面「哈希以 block 为单位的依据」「事实表」引用它。

## vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L377-L398

```python
    def find_longest_cache_hit(
        self,
        block_hashes: list[BlockHash],
        max_cache_hit_length: int,
    ) -> tuple[tuple[list[KVCacheBlock], ...], int] | tuple[tuple[list[KVCacheBlock], ...], int, int]:
        """
        Find the longest cache hit using an iterative fixed-point algorithm.

        Each attention type either accepts the current candidate length or
        reduces it. If any type reduces the length, restart checks over all
        types. This converges because length monotonically decreases and is
        bounded below by 0.

        Args:
            block_hashes: The block hashes of the request.
            max_cache_hit_length: The maximum length of the cache hit.

        Returns:
            A tuple containing:
                - A tuple of the cache hit blocks for each single type manager.
                - The number of tokens of the longest cache hit.
        """
```

命中查找的入口，所在类是同文件 L70 的 `AscendHybridKVCacheCoordinator`。签名直接显示输入是 `list[BlockHash]`（每满块一个 hash）、输出是命中的 token 数——这是「哈希以 block 为单位」在接口层面的体现。页面「怎么工作」的时序图引用它。

## vllm_ascend/patch/__init__.py#L151-L173

```python
# ** 8. File: platform/patch_kv_cache_coordinator.py**
# ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
#   1. `vllm.v1.core.kv_cache_coordinator.HybridKVCacheCoordinator.find_longest_cache_hit_per_group`
#    Why:
#       In PD disaggregation with hybrid Mamba models, the D side receives
#       FullAttention KV blocks from the P side but has no local prefix-cache
#       hit for Mamba groups. Upstream's min-reduction across all KV groups
#       collapses the FullAttention hit length to 0, preventing partial
#       FullAttention-only prefix cache reuse on the D side.
#    How:
#       For Mamba hybrid models,
#       num_new_local_computed_tokens should be the FA hit
#       length. This value is passed to the connector's
#       get_num_new_matched_tokens which computes:
#       external = total - local_computed.
#       Using the FA hit skips re-transferring FA blocks
#       already cached on D-side.
#    Related PR (if no, explain why):
#       https://github.com/vllm-project/vllm/pull/42524
#       https://github.com/vllm-project/vllm/pull/44243
#    Future Plan:
#       Remove this patch when vLLM PR #42524 and #44243 is included in the supported
#       upstream vLLM version.
```

仓库自己写的 patch 清单，明说前缀缓存的查找入口是上游的 `find_longest_cache_hit_per_group`，昇腾只是打补丁改它的归约方式。页面「昇腾侧只做了哪些适配」引用它。

## tests/e2e/pull_request/two_card/test_prefix_caching.py#L63-L90

```python
@pytest.mark.parametrize("model", MODELS)
@pytest.mark.parametrize("max_tokens", [50])
def test_models_prefix_cache_tp2(model: str, max_tokens: int) -> None:
    with VllmRunner(
        model,
        max_model_len=2048,
        tensor_parallel_size=2,
        cudagraph_capture_sizes=[1, 2, 4, 8],
        gpu_memory_utilization=0.7,
    ) as vllm_model:
        prefix_cache_output = vllm_model.generate_greedy(INPUT_PROMPTS, max_tokens)

    with VllmRunner(
        model,
        enable_prefix_caching=False,
        max_model_len=2048,
        tensor_parallel_size=2,
        cudagraph_capture_sizes=[1, 2, 4, 8],
        gpu_memory_utilization=0.7,
    ) as vllm_model:
        vllm_output = vllm_model.generate_greedy(INPUT_PROMPTS, max_tokens)

    check_outputs_equal(
        outputs_0_lst=vllm_output,
        outputs_1_lst=prefix_cache_output,
        name_0="vllm_output",
        name_1="prefix_cache_output",
    )
```

e2e 测试：第一个 runner 不传任何开关（默认开），第二个显式 `enable_prefix_caching=False`，然后断言两边逐 token 输出完全相同。这既证明默认开启，也给出了正确性契约。页面「为什么需要它」「事实表」引用它。

## docs/source/user_guide/support_matrix/supported_features.md#L9-L12

```markdown
| Feature                       |      Status    | Next Step                                                              |
|-------------------------------|----------------|------------------------------------------------------------------------|
| Chunked Prefill               | 🟢 Functional    | Functional, see detailed note: [Chunked Prefill][cp]                     |
| Automatic Prefix Caching      | 🟢 Functional    | Functional, see detailed note: [vllm-ascend#732][apc]                    |
```

官方特性矩阵中的支持状态。线上对应 <https://docs.vllm.ai/projects/ascend/en/latest/user_guide/support_matrix/supported_features.html>。页面「事实表」引用它。

## docs/source/user_guide/release_notes.md#L71-L71

```markdown
- Improved DeepSeek V4 prefix-cache hit rates when MTP is enabled. Prefix caching is enabled by default in vLLM V1; no flag is needed unless it was previously disabled. [#11107](https://github.com/vllm-project/vllm-ascend/pull/11107)
```

官方 release notes 明写「vLLM V1 下前缀缓存默认开启」。线上对应 <https://docs.vllm.ai/projects/ascend/en/latest/user_guide/release_notes.html>。页面「一句话」「事实表」引用它。

## docs/source/user_guide/release_notes.md#L1506-L1508

```markdown
- CANN is upgraded to 8.3.RC1. TorchNPU is upgraded to 2.7.1. [#3945](https://github.com/vllm-project/vllm-ascend/pull/3945) [#3896](https://github.com/vllm-project/vllm-ascend/pull/3896)
- PrefixCache and Chunked Prefill are enabled by default. [#3967](https://github.com/vllm-project/vllm-ascend/pull/3967)
- W4A4 quantization is supported now. [#3427](https://github.com/vllm-project/vllm-ascend/pull/3427) Official tutorial is available at [single_npu_qwen3_w4a4](https://github.com/vllm-project/vllm-ascend/pull/4076/files).
```

历史节点：前缀缓存与 chunked prefill 是**同一个 PR**一起改成默认开启的，佐证正文里「这两个开关在昇腾侧一直被当成一对处理」。线上对应 <https://docs.vllm.ai/projects/ascend/en/latest/user_guide/release_notes.html>。

## docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L383-L389

```markdown
### Q2: Why does enabling prefix caching not improve performance?

**Phenomenon:** Prefix caching is enabled, but throughput or latency does not improve.

**Cause:** Prefix caching only helps when requests share reusable prefixes. For random prompts or low cache hit rates, it may add memory pressure without visible gains.

**Solution:** Enable prefix caching for repeated-prefix workloads. For random benchmark datasets or memory-constrained long-context workloads, compare with `--no-enable-prefix-caching`.
```

官方模型教程的 FAQ，给出关闭开关的写法 `--no-enable-prefix-caching`，以及「命中率低时只增加内存压力」的官方判断。线上对应 <https://docs.vllm.ai/projects/ascend/en/latest/tutorials/models/Qwen3.6-35B-A3B.html>。页面「开了的代价」「常见误解」引用它。

## https://docs.vllm.ai/en/latest/design/prefix_caching.html

> "we hash each kv-cache block by the tokens in the block and the tokens in the prefix before the block"

> "We only cache full blocks."

hash 的组成为「父块 hash + 本块 token ids + extra keys（LoRA ID、多模态输入 hash、cache salt）」，默认算法在 v0.11 起为 SHA-256。

上游官方设计文档，是「哈希以 block 为单位、只缓存满块」这两条论断的直接依据。页面「怎么工作」「常见误解」引用它。（本地未克隆 vLLM 仓库，无法给源码行号，故只给线上地址。）

## https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/

> APC "only reduces the time of processing the queries (the prefilling phase)"

文档同时列出两类无收益场景：vLLM 大部分时间在生成回答时，以及新请求与已有请求不共享前缀时。

上游官方特性文档，页面「为什么需要它」「开了的代价」引用它。

## https://huggingface.co/Qwen/Qwen3-0.6B/blob/main/config.json

```json
"hidden_size": 1024,
"intermediate_size": 3072,
"num_hidden_layers": 28,
"num_attention_heads": 16,
"num_key_value_heads": 8,
"head_dim": 128,
"torch_dtype": "bfloat16"
```

（按模型卡 config.json 的字段整理，非逐字节原文。）「拿真实数字走一遍」里每 token KV 字节数与省下的 FLOPs 都以这组维度为输入，`intermediate_size = 3072` 只能从这里拿到。
