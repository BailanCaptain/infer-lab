# Prefix Caching 源码片段

## vllm-ascend@28bf3a2e:vllm_ascend/utils.py#L1200-L1204

```python
    if cache_config.block_size != 128:
        if cache_config.enable_prefix_caching or scheduler_config.enable_chunked_prefill:
            logger.info("Block size is set to 128 if prefix cache or chunked prefill is enabled.")
            cache_config.block_size = 128
            return
```

`refresh_block_size` 里唯一一处因前缀缓存改配置的地方：开了 APC（或 chunked prefill）就把 block_size 强制成 128。页面用它说明「开 APC 会静默覆盖 `--block-size`」。

## vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1402-L1406

```python
    if cache_config.block_size != 128:
        if cache_config.enable_prefix_caching or scheduler_config.enable_chunked_prefill:
            logger.info("Block size is set to 128 if prefix cache or chunked prefill is enabled.")
            cache_config.block_size = 128
            return
```

v0.23.0 的同一段，逐字一致——页面据此把这条结论写成两版共有、不分版本列。

## vllm-ascend@28bf3a2e:vllm_ascend/platform.py#L1208-L1212

```python
            parallel_config.worker_cls = hardware_profile.default_worker_cls

    refresh_block_size(vllm_config)

    # Automatically activate all custom ops on profiles using the standard path.
```

`platform.py` 的配置检查阶段调用 `refresh_block_size`，页面用它把「platform.py 的配置检查」这一环接进调用链。

## vllm-ascend@2c59ff10:vllm_ascend/platform.py#L669-L671

```python
                parallel_config.worker_cls = "vllm_ascend.worker.worker.NPUWorker"

        refresh_block_size(vllm_config)
```

v0.23.0 的同一处调用（缩进不同，因为还在 `check_and_update_config` 的类方法体内）。页面用它确认调用点两版一致。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L1542-L1569

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

命中与否唯一决定 attn_state 的地方：`num_computed_tokens_cpu` 全为 0 才是 PrefillNoCache，否则最终落到 ChunkedPrefill 或 PrefillCacheHit。页面的「怎么工作」与事实表第 5 行都出自这里。

## vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1477-L1506

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

        # For the overlay of the PCP feature and the eagle3, attn_state needs to be recovered
        # TODO: Resolved the conflict between the sunset of attn_state and the PCP that requires this interface.
        if attn_state == AscendAttentionState.SpecDecoding and self.speculative_config.method != "mtp":
            self.attn_state = AscendAttentionState.ChunkedPrefill  # type: ignore
        else:
            self.attn_state = attn_state  # type: ignore

        return attn_state
```

v0.23.0 的同一函数，分支逻辑逐条一致（只多两行注释）。页面据此把 attn_state 判定写成两版共有。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L1167-L1176

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

「命中时跳过哪些计算」的直接依据：position 从 `num_computed_tokens` 起算，前面的 token 根本不进这一步前向。

## vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L907-L916

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

v0.23.0 的同一段，逐字一致。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L156-L162

```python
class AscendAttentionState(Enum):
    PrefillNoCache = 0
    PrefillCacheHit = 1
    DecodeOnly = 2
    ChunkedPrefill = 3
    SpecDecoding = 4
```

昇腾侧为前缀命中单列了一个状态枚举，页面用它说明「适配点在算子入参的组装，不在缓存管理本身」。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1313-L1323

```python
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

命中后算子拿到的是 `block_tables` 加全长的 `seq_lens_list`——页面用它反驳「命中就不读 KV 了」这条误解。

## vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1200-L1210

```python
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

v0.23.0 的同一分支，逐字一致。

## vllm-ascend@28bf3a2e:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L65-L84

```python
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
```

「哈希以 block 为单位」的直接依据：这个函数的返回值就是 `(scheduler_block_size, hash_block_size)`，且 `hash_block_size` 只在 APC 打开时才与调度块大小分开取值。main 只乘 `dcp`。

## vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L127-L147

```python
    cache_config = vllm_config.cache_config
    dcp = vllm_config.parallel_config.decode_context_parallel_size
    pcp = vllm_config.parallel_config.prefill_context_parallel_size
    groups = kv_cache_config.kv_cache_groups

    if len(groups) <= 1:
        bs = cache_config.block_size * dcp * pcp
        return bs, bs

    if dcp != 1 or pcp != 1:
        # Ascend supports CP with multiple KV cache groups; compute
        # scheduler_block_size using the LCM of all group block sizes
        # multiplied by the CP factors for proper alignment.
        group_block_sizes = [g.kv_cache_spec.block_size for g in groups]
        scheduler_block_size = math.lcm(*group_block_sizes) * dcp * pcp
        if not cache_config.enable_prefix_caching:
            return scheduler_block_size, scheduler_block_size
        hash_block_size = math.gcd(*group_block_sizes)
        return scheduler_block_size, hash_block_size
```

v0.23.0 把 PCP 也乘进 scheduler_block_size，且 `pcp != 1` 单独就能触发这条分支——这是页面里标 `[!]` 的版本差异。

## vllm-ascend@28bf3a2e:tests/ut/patch/platform/test_prefix_cache_cp_patches.py#L239-L263

```python
@pytest.mark.parametrize(
    ("enable_prefix_caching", "expected_hash_block_size"),
    [
        pytest.param(False, math.lcm(16, 32) * 2, id="dcp-without-prefix-caching"),
        pytest.param(True, math.gcd(16, 32), id="dcp-with-prefix-caching"),
    ],
)
def test_resolve_kv_cache_block_sizes_with_cp_hybrid_groups(
    enable_prefix_caching: bool,
    expected_hash_block_size: int,
) -> None:
    kv_cache_config = _make_hybrid_kv_cache_config(full_block_size=16, mamba_block_size=32)
    vllm_config = _make_vllm_config(
        enable_prefix_caching=enable_prefix_caching,
        dcp=2,
    )

    scheduler_block_size, hash_block_size = _ascend_resolve_kv_cache_block_sizes(
        kv_cache_config,
        vllm_config,
    )

    expected_scheduler_block_size = math.lcm(16, 32) * 2
    assert scheduler_block_size == expected_scheduler_block_size
    assert hash_block_size == expected_hash_block_size
```

上游 UT 给出的具体数：group block size 为 16 与 32、dcp=2 时，开 APC 后哈希块是 `gcd(16,32)=16`，调度块是 `lcm(16,32)*2=64`。页面事实表第 3、4 行引这里。

## vllm-ascend@28bf3a2e:vllm_ascend/models/layer/attention/layer.py#L121-L127

```python
        # NOTE(zxr): vllm_is_batch_invariant is delete during updating to v0.20.1
        if (
            cache_config is not None
            and cache_config.enable_prefix_caching
            and (self.attn_backend.get_name() == "TRITON_MLA" or self.attn_backend.get_name() == "FLASHINFER")
        ):
            cache_config.enable_prefix_caching = False
```

vllm-ascend 里唯一一处把 `enable_prefix_caching` 改成 `False` 的代码。页面用它 + 下面的后端名说明这条分支在昇腾上永远不成立。

## vllm-ascend@2c59ff10:vllm_ascend/models/layer/attention/layer.py#L114-L120

```python
        # NOTE(zxr): vllm_is_batch_invariant is delete during updating to v0.20.1
        if (
            cache_config is not None
            and cache_config.enable_prefix_caching
            and (self.attn_backend.get_name() == "TRITON_MLA" or self.attn_backend.get_name() == "FLASHINFER")
        ):
            cache_config.enable_prefix_caching = False
```

v0.23.0 的同一段，逐字一致（上一行 `self.attn_backend` 只赋 `AscendDSABackend` 一种）。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/dsa_v1.py#L146-L173

```python
class AscendDSAC4Backend(AscendDSABackend):
    @staticmethod
    def get_name() -> str:
        return "ASCEND_DSA_C4"

    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        # Align with upstream's logical block-size contract: Ascend's physical
        # 32/64/128-token C4 pages represent 128/256/512 raw scheduler tokens.
        return [128, 256, 512]


class AscendDSAC128Backend(AscendDSABackend):
    @staticmethod
    def get_name() -> str:
        return "ASCEND_DSA_C128"

    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        # Align with upstream's logical block-size contract: Ascend's physical
        # 32/64/128-token C128 pages represent 4096/8192/16384 raw scheduler tokens.
        return [4096, 8192, 16384]


class AscendDSASWABackend(AscendDSABackend):
    @staticmethod
    def get_name() -> str:
        return "ASCEND_DSA_SWA"
```

`layer.py` 那条分支上能取到的三个后端名都是 `ASCEND_DSA*`，没有一个等于 `TRITON_MLA` 或 `FLASHINFER`。页面「常见误解」第 3 条引这里。

## vllm-ascend@28bf3a2e:vllm_ascend/_310p/worker/v2/model_runner.py#L104-L106

```python
        # TODO: Support prefix caching in the next 310P MRV2 iteration.
        if vllm_config.cache_config.enable_prefix_caching:
            raise NotImplementedError("Prefix caching is not supported by model runner v2 on 310P.")
```

main 新增的 310P model runner v2 直接拒绝 APC。v0.23.0 没有 `vllm_ascend/_310p/worker/` 这个目录，所以这是版本差异，页面标 `[!]`。

## vllm-ascend@28bf3a2e:vllm_ascend/patch/platform/patch_mamba_config.py#L143-L146

```python
    if cache_config.enable_prefix_caching and cache_config.mamba_cache_mode == "align":
        cache_config.mamba_block_size = cache_config.block_size
    else:
        cache_config.mamba_block_size = model_config.max_model_len
```

混合 attention+mamba 模型上，APC 开关直接决定 mamba 状态块按 block_size 还是按 max_model_len 分配。v0.23.0 同文件同行号一致。页面事实表第 9 行引这里。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L151-L153

```python
    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]
```

`AscendAttentionBackend` 只支持 128 一个 kernel block size，和 `refresh_block_size` 的强制值对得上。v0.23.0 在同文件 L142-L144 一致。

## vllm-ascend@28bf3a2e:docs/source/user_guide/support_matrix/feature_matrix.md#L17-L17

```markdown
| [<abbr title="Automatic Prefix Caching">APC</abbr>](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/) | ✅ | ✅ | ✅ | ✅ |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
```

官方互斥矩阵里 APC 那一行：与 ACLGraph（两种模式）、Async Scheduling 以及自身都是 ✅（完全兼容）。下一行 Chunked Prefill 对 APC 列也是 ✅。页面用它支撑「与 chunked prefill 不互斥」。

## vllm-ascend@28bf3a2e:docs/source/user_guide/release_notes.md#L2110-L2110

```markdown
- Upgrade CANN version to 8.1.RC1 to support chunked prefill and automatic prefix caching (`--enable_prefix_caching`) when V1 is enabled [#747](https://github.com/vllm-project/vllm-ascend/pull/747)
```

官方 release note：APC 在昇腾上可用的前提是 CANN 8.1.RC1，且与 chunked prefill 是同一批打通的。页面「为什么需要它」引这里说明两者在昇腾上的历史耦合。

## vllm-ascend@28bf3a2e:tests/e2e/pull_request/two_card/test_prefix_caching.py#L63-L90

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

昇腾 CI 对 APC 的验收标准：开与关必须逐 token 相同（`check_outputs_equal`），MHA（Qwen3-8B）与 MLA（DeepSeek-V2-Lite）各测一遍。页面用它说明「APC 是无损优化」以及两个 INPUT_PROMPTS 共享长前缀的构造方式。
