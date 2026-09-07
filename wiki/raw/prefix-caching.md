# Prefix Caching 源码片段

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

昇腾侧唯一一处把「开了前缀缓存」直接翻译成配置改写的地方：prefix caching 与 chunked prefill 共用同一条分支，两者任一开启都把 `block_size` 强制为 128。

## vllm_ascend/platform.py#L1196-L1210

```python
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

证明 `refresh_block_size` 是在 platform 的配置检查阶段被调用的，即启动时改写 `cache_config.block_size`。

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

一是后端只支持 128 的 kernel block size（解释上面为何强制 128），二是昇腾把「有没有命中前缀」直接编码进注意力状态枚举。

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

命中判定的实际代码：`num_computed_tokens_cpu` 全为 0 才是 PrefillNoCache；否则在没开 chunked prefill 时落到 PrefillCacheHit。也是「与 chunked prefill 耦合」的直接证据——开了 chunked prefill，命中场景会被 ChunkedPrefill 分支吃掉。

## vllm_ascend/worker/v2/attn_utils.py#L305-L336

```python
    """Build attention state for npu's attention backend."""
    if vllm_config.model_config.runner_type == "pooling":
        if isinstance(
            vllm_config.kv_cache_config.kv_cache_groups[0].kv_cache_spec,
            EncoderOnlyAttentionSpec,
        ):
            attn_state = AscendAttentionState.PrefillNoCache
        else:
            attn_state = AscendAttentionState.PrefillCacheHit
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

model runner v2 上的同一套判定，判据换成 `seq_lens_np == num_scheduled_tokens`（本次要算的 token 数等于整条序列长度即没有命中），用来说明两条 runner 路径的判定等价。

## vllm_ascend/attention/attention_v1.py#L1287-L1345

```python
    def _get_fia_params(self, key: torch.Tensor, value: torch.Tensor, attn_metadata: AscendMetadata, kv_cache=None):
        # PrefillNoCache doesn't need key_cache, but other modes do
        # Only initialize/require cache for modes that actually use it
        if attn_metadata.attn_state != AscendAttentionState.PrefillNoCache:
            # Initialize cache from kv_cache if not already set (for DecodeOnly mode)
            if self.key_cache is None and kv_cache is not None:
                if (
                    isinstance(kv_cache, torch.Tensor)
                    and kv_cache.dim() > 0
                    and kv_cache.shape[0] == 2
                    or isinstance(kv_cache, (list, tuple))
                    and len(kv_cache) >= 2
                ):
                    self.key_cache, self.value_cache = kv_cache[0], kv_cache[1]

            if self.key_cache is None:
                raise RuntimeError(
                    f"key_cache is None in _get_fia_params for mode {attn_metadata.attn_state}. kv_cache={kv_cache}"
                )

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
```

命中后 kernel 参数怎么变：PrefillCacheHit 不再用本次前向算出的 dense `key`/`value`，而是把 paged KV cache 视图 + `block_table` 交给 FIA，KV 长度取整条 `seq_lens_list`（含被复用的前缀），Q 只有未命中的那段。

## vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L156-L171

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
```

「哈希以 block 为单位」的直接依据：存在独立的 `hash_block_size`，且只有 `enable_caching` 时才断言各组 block_size 必须是它的整数倍。

## vllm_ascend/patch/platform/patch_kv_cache_utils.py#L55-L84

```python
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

昇腾侧对哈希粒度做的唯一实质改写：多 KV cache group + DCP 时，调度粒度取 lcm，哈希粒度取 gcd，且只在 `enable_prefix_caching` 时才走 gcd 分支。

## vllm_ascend/core/recompute_scheduler.py#L107-L143

```python
    def _get_computed_blocks_for_connector(self, request: Request) -> tuple[KVCacheBlocks, int, int, bool]:
        kv_cache_manager = self.kv_cache_manager
        coordinator = kv_cache_manager.coordinator
        if (
            request.kv_transfer_params
            and request.kv_transfer_params.get("do_remote_prefill")
            and isinstance(coordinator, HybridKVCacheCoordinator)
            and getattr(coordinator, "full_attention_group_id", None) is not None
        ):
            prefix_cache_lookup_enabled = kv_cache_manager.enable_caching and not request.skip_reading_prefix_cache
            if not prefix_cache_lookup_enabled:
                return kv_cache_manager.empty_kv_cache_blocks, 0, 0, False

            fa_group_id = coordinator.full_attention_group_id
            assert fa_group_id is not None
            computed, per_group_hits = coordinator.find_longest_cache_hit_per_group(
                request.block_hashes,
                request.num_tokens - 1,
            )
            if not any(hit > per_group_hits[fa_group_id] for hit in per_group_hits):
                num_local = per_group_hits[fa_group_id]
                hit_diverged = min(per_group_hits) < num_local
                if hit_diverged:
                    blocks = kv_cache_manager.create_kv_cache_blocks(computed)
```

查表入口：命中长度由 `find_longest_cache_hit_per_group(request.block_hashes, ...)` 给出，输入是逐 block 的哈希列表，输出是每组命中的 token 数——命中总是整块整块地增长。

## vllm_ascend/models/layer/attention/layer.py#L121-L127

```python
        # NOTE(zxr): vllm_is_batch_invariant is delete during updating to v0.20.1
        if (
            cache_config is not None
            and cache_config.enable_prefix_caching
            and (self.attn_backend.get_name() == "TRITON_MLA" or self.attn_backend.get_name() == "FLASHINFER")
        ):
            cache_config.enable_prefix_caching = False
```

被静默关闭的一条路径：DSA 注意力层在 TRITON_MLA / FLASHINFER 后端下会把 `enable_prefix_caching` 直接改回 False。

## vllm_ascend/_310p/worker/v2/model_runner.py#L99-L109

```python
        # TODO: Support speculative decoding in the next 310P MRV2 iteration.
        if vllm_config.speculative_config is not None:
            raise NotImplementedError("Speculative decoding is not supported by model runner v2 on 310P.")
        if vllm_config.kv_transfer_config is not None:
            raise NotImplementedError("KV cache transfer is not supported by model runner v2 on 310P.")
        # TODO: Support prefix caching in the next 310P MRV2 iteration.
        if vllm_config.cache_config.enable_prefix_caching:
            raise NotImplementedError("Prefix caching is not supported by model runner v2 on 310P.")
        # TODO: Support LoRA in the next 310P MRV2 iteration.
        if vllm_config.lora_config is not None:
            raise NotImplementedError("LoRA is not supported by model runner v2 on 310P.")
```

硬性禁用的一条路径：310P 的 model runner v2 上开前缀缓存直接抛 NotImplementedError。
