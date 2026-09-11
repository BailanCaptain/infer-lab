# prefix-caching 引用的源码片段

来源仓库：vllm-ascend@28bf3a2e（ref `main`）。以下片段原文照录，未改动一字。

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

引用理由：这是昇腾侧唯一一处把「前缀缓存开启」直接翻译成硬件约束的地方——开了 APC 或 chunked prefill 就把 `block_size` 强制成 128；同时暴露了两条早退（deepseek_v4、is_hybrid）说明这条规则不是全局成立。

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

引用理由：给出 128 这个数字在算子侧的出处，以及「前缀命中」在昇腾后端是一个独立的枚举状态 `PrefillCacheHit`。

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

引用理由：前缀缓存与 chunked prefill 的耦合点。分支顺序说明 `PrefillCacheHit` 只在 chunked prefill 关闭时才可能被选中；`num_computed_tokens_cpu` 是否为 0 是判断「有没有命中」的唯一依据。

## vllm_ascend/attention/attention_v1.py#L1307-L1323

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
```

引用理由：命中与不命中在算子入参上的实际差别——不命中时 `block_table=None` 且 KV 长度等于 query 长度；命中时改为传块表、KV 长度取整条序列 `seq_lens_list`，query 仍只有未命中的那几个 token。

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

引用理由：`hash_block_size` 这个概念的存在本身就是「哈希以 block 为单位」的证据；这里还给出昇腾侧对它的唯一改写——多组 + DCP 时取各组 `block_size` 的 gcd。

## vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/metadata.py#L657-L687

```python
def get_block_hashes(
    block_hashes: BlockHashList | list[str],
    group_block_size: int,
    hash_block_size: int,
) -> Sequence[BlockHash | str]:
    if group_block_size == hash_block_size:
        return block_hashes
    assert group_block_size % hash_block_size == 0, "block_size must be divisible by hash_block_size"
    return _LazyGroupedBlockHashList(block_hashes, group_block_size // hash_block_size)


class _LazyGroupedBlockHashList(Sequence[BlockHash | str]):
    def __init__(self, block_hashes: Sequence[BlockHash | str], scale_factor: int) -> None:
        self._block_hashes = block_hashes
        self._scale_factor = scale_factor
        self._length = len(block_hashes) // scale_factor

    def __len__(self) -> int:
        return self._length

    def __getitem__(self, index):
        if isinstance(index, slice):
            return [self[idx] for idx in range(*index.indices(self._length))]
        if index < 0:
            index += self._length
        if index < 0 or index >= self._length:
            raise IndexError(index)
        # Chained hashes make the final fine-grained hash identify the
        # complete larger block. Resolve it lazily so filtered paths avoid
        # traversing hashes for chunks they will not use.
        return self._block_hashes[(index + 1) * self._scale_factor - 1]
```

引用理由：注释 "Chained hashes make the final fine-grained hash identify the complete larger block" 直接说明哈希是**链式前缀哈希**、每 `hash_block_size` 个 token 一格，因此一格的哈希值唯一确定「从头到这一格结尾」的整段前缀——这正是块粒度哈希能当前缀匹配用的原因。

## vllm_ascend/core/recompute_scheduler.py#L107-L128

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
```

引用理由：昇腾自带调度器里查表的实际写法——输入是 `request.block_hashes`（一个按块排列的哈希序列），出口是 `find_longest_cache_hit_per_group`（上游 `KVCacheManager` 的协调器方法）。同时给出 `enable_caching` 与 `skip_reading_prefix_cache` 两个开关。

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

引用理由：唯一一处会在建模阶段**静默**把 `enable_prefix_caching` 改成 `False` 的代码，位于 DeepSeek-V4 DSA attention layer 的构造函数中。

## vllm_ascend/_310p/worker/v2/model_runner.py#L104-L106

```python
        # TODO: Support prefix caching in the next 310P MRV2 iteration.
        if vllm_config.cache_config.enable_prefix_caching:
            raise NotImplementedError("Prefix caching is not supported by model runner v2 on 310P.")
```

引用理由：硬性不支持的组合，启动即抛异常。

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

引用理由：`platform.py` 中唯一读 `enable_prefix_caching` 的位置。证明昇腾平台层**没有**前缀缓存的开关或校验，只在 mamba align 路径上根据它取不同分支。

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

引用理由：model runner v2 的同名逻辑。与 v1 的差别在第一条判据：v2 用 `seq_lens == num_scheduled_tokens`（本次调度覆盖整条序列），v1 用 `num_computed_tokens == 0`。

## docs/source/user_guide/support_matrix/supported_features.md#L9-L12

```markdown
| Feature                       |      Status    | Next Step                                                              |
|-------------------------------|----------------|------------------------------------------------------------------------|
| Chunked Prefill               | 🟢 Functional    | Functional, see detailed note: [Chunked Prefill][cp]                     |
| Automatic Prefix Caching      | 🟢 Functional    | Functional, see detailed note: [vllm-ascend#732][apc]                    |
```

引用理由：官方支持矩阵中 APC 的状态。同页顶部写明本项目的特性支持原则是 "aligned with vLLM"，是「主体在上游」这一判断的文档依据。

## docs/source/user_guide/release_notes.md#L71

```markdown
- Improved DeepSeek V4 prefix-cache hit rates when MTP is enabled. Prefix caching is enabled by default in vLLM V1; no flag is needed unless it was previously disabled. [#11107](https://github.com/vllm-project/vllm-ascend/pull/11107)
```

引用理由：官方明确「V1 引擎下前缀缓存默认开启」，不需要额外加参数。

## docs/source/user_guide/release_notes.md#L1600

```markdown
- Please do not enable chunked prefill with prefix cache when running with Ascend scheduler. The performance and accuracy is not good/correct. [#2943](https://github.com/vllm-project/vllm-ascend/issues/2943)
```

引用理由：v0.10.2rc1 的 Known Issues，前缀缓存与 chunked prefill 在昇腾自研调度器下曾经互斥。记为历史约束——`vllm_ascend/core/` 下已不存在该 AscendScheduler。

## docs/source/tutorials/models/Qwen3.8-27B.md#L462-L464

```markdown
| Optimization Technique | Applicable Scenarios | Enablement Method | Technical Principle | Precautions |
| --- | --- | --- | --- | --- |
| Prefix Cache | Scenarios with repeated prefixes (e.g., shared system prompts, few-shot examples) | `--enable-prefix-caching` | Reuses cached KV state for repeated prefixes, avoiding redundant prefill computation. | The benefit depends on the prefix cache hit rate. |
```

引用理由：官方调优表给出「什么时候该开」与命令行开关的准确拼写，以及唯一的收益前提——取决于命中率。
