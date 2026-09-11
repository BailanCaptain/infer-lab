# PagedAttention 引用片段（vllm-ascend@28bf3a2e）

## vllm_ascend/attention/attention_v1.py#L77-L83

```python
@register_backend(AttentionBackendEnum.CUSTOM, "ASCEND")
class AscendAttentionBackend(AttentionBackend):
    accept_output_buffer: bool = True

    @staticmethod
    def get_name() -> str:
        return "CUSTOM"
```

昇腾的通用 attention 后端以 `CUSTOM` 名义注册进上游的后端注册表，说明它不是复用上游任何一个现成 backend，而是整套自己实现。

## vllm_ascend/attention/attention_v1.py#L113-L121

```python
    @staticmethod
    def get_kv_cache_shape(
        num_blocks: int,
        block_size: int,
        num_kv_heads: int,
        head_size: int,
        cache_dtype_str: str = "",
    ) -> tuple[int, ...]:
        return (2, num_blocks, block_size, num_kv_heads, head_size)
```

页面的核心事实：昇腾后端声明的每层 KV Cache 形状，第 0 维 2 表示 K 与 V 各一份。

## vllm_ascend/attention/attention_v1.py#L151-L153

```python
    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]
```

后端向上游声明它只支持 `block_size = 128`，列表里只有一个值。

## vllm_ascend/attention/attention_v1.py#L200-L210

```python
    # ********************** KV Cache Related Properties ********************* #
    # Block addresses per sequence (Seq id -> list of physical block).
    # (batch_size, max_blocks_per_seq)
    block_tables: torch.Tensor = None

    # The indices of the token slots that input tokens will be stored into.
    # E.g., if `slot_mapping` is [35, 2, 17] and the block size is 16, the
    # three tokens are stored in the 3rd slot in block 2, 2nd slot in block 0,
    # and 1st slot in block 1, respectively.
    # (num_tokens,)
    slot_mapping: torch.Tensor = None
```

`block_tables` 与 `slot_mapping` 的形状与语义；注释里 `35 → block 2, slot 3` 直接给出 `slot = block_id * block_size + offset` 这条换算。

## vllm_ascend/attention/attention_v1.py#L239-L253

```python
    def __init__(
        self,
        kv_cache_spec: AttentionSpec,
        layer_names: list[str],
        vllm_config: VllmConfig,
        device: torch.device,
    ):
        super().__init__(kv_cache_spec, layer_names, vllm_config, device)
        self.vllm_config = vllm_config
        self.model_config = vllm_config.model_config
        self.compilation_config = vllm_config.compilation_config
        self.device = device
        self.max_num_blocks_per_req = cdiv(
            self.model_config.max_model_len, AscendAttentionBackend.get_supported_kernel_block_sizes()[0]
        )
```

块表的列数（每个请求最多几块）= `cdiv(max_model_len, 128)`，直接取自后端声明的 block_size。

## vllm_ascend/attention/attention_v1.py#L1324-L1333

```python
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
```

FIA 路径 decode 分支：把 4 维块化缓存 view 成 `[num_blocks, block_size, n_kv*d_h]` 三维再交给算子，block_size 从 `key_cache.shape[1]` 推出。

## vllm_ascend/attention/attention_v1.py#L1561-L1580

```python
    def forward_paged_attention(
        self,
        query: torch.Tensor,
        attn_metadata: AscendMetadata,
        output: torch.Tensor | None = None,
    ) -> torch.Tensor:
        if _EXTRA_CTX.capturing:
            return self.full_graph_pa(query, attn_metadata, output)
        torch_npu._npu_paged_attention(
            query=query,
            key_cache=self.key_cache,
            value_cache=self.value_cache,
            num_kv_heads=self.num_kv_heads,
            num_heads=self.num_heads,
            scale_value=self.scale,
            block_table=attn_metadata.block_tables,
            context_lens=attn_metadata.seq_lens,
            out=output,
        )
        return output
```

PA 算子的完整入参：块表 + 每序列 KV 长度，没有 block_size 参数。

## vllm_ascend/attention/attention_v1.py#L1660-L1681

```python
    def forward_impl(
        self,
        query: torch.Tensor,
        key: torch.Tensor,
        value: torch.Tensor,
        kv_cache: tuple[torch.Tensor],
        attn_metadata: AscendMetadata,
        output: torch.Tensor,
    ):
        record_attention_compute_start()
        num_tokens = query.shape[0]

        if (
            attn_metadata.attn_state == AscendAttentionState.DecodeOnly
            and self.sliding_window is None
            and using_paged_attention(num_tokens, self.vllm_config, self.head_size)
        ):
            output = self.forward_paged_attention(query, attn_metadata, output)
        else:
            output = self.forward_fused_infer_attention(query, key, value, attn_metadata, output, kv_cache)

        return output
```

两条读路径的分派点：只有 DecodeOnly + 无滑窗 + `using_paged_attention` 全成立才走 PA 算子，其余一律走 FIA。

## vllm_ascend/attention/attention_v1.py#L1694-L1705

```python
        """Forward pass with Ascend attention.
        Args:
            query: shape = [num_tokens, num_heads, head_size]
            key: shape = [num_tokens, num_kv_heads, head_size]
            value: shape = [num_tokens, num_kv_heads, head_size]
            kv_cache: shape =
                [2, num_blocks, block_size, num_kv_heads, head_size]
            attn_metadata: Metadata for attention.
        Returns:
            shape = [num_tokens, num_heads * head_size]
        """
```

forward 的入参形状表，把逐 token 的 q/k/v 与块化的 kv_cache 放在一起对照。

## vllm_ascend/attention/utils.py#L206-L222

```python
def using_paged_attention(runtime_shape: int, vllm_config: VllmConfig, head_size: int | None = None) -> bool:
    if vllm_config.speculative_config is not None:
        return False
    if get_ascend_device_type() == AscendDeviceType.A5:
        return False
    # TODO: Remove this fallback when A2/A3 FIA TND supports Gemma4's
    # 512-dim global attention heads. Decode can use PA directly; prefill is
    # handled by the device adaptor.
    if head_size == FIA_TND_LARGE_HEAD_FALLBACK_HEAD_SIZE:
        return True
    from vllm.config.compilation import CUDAGraphMode

    cudagraph_mode = vllm_config.compilation_config.cudagraph_mode
    if cudagraph_mode != CUDAGraphMode.FULL_DECODE_ONLY:
        return False

    return runtime_shape in get_ascend_config().pa_shape_list
```

PA 算子的四道门槛（无投机解码、非 A5、FULL_DECODE_ONLY、batch 形状在 `pa_shape_list` 里），以及 Gemma4 大 head_size 的强制回退。

## vllm_ascend/attention/utils.py#L94-L137

```python
def update_paged_attention_graph_param(
    update_stream,
    handle,
    event,
    param: PagedAttentionGraphParam,
    block_table: torch.Tensor,
    seq_lens: torch.Tensor,
) -> None:
    (
        query,
        key_cache,
        value_cache,
        num_kv_heads,
        num_heads,
        scale,
        _captured_block_table,
        _captured_seq_lens,
        output,
    ) = param.params
    workspace = torch_npu._npu_paged_attention_get_workspace(
        query=query,
        key_cache=key_cache,
        value_cache=value_cache,
        num_kv_heads=num_kv_heads,
        num_heads=num_heads,
        scale_value=scale,
        block_table=block_table,
        context_lens=seq_lens,
        out=output,
    )
    torch.npu.graph_task_update_begin(update_stream, handle)
    torch_npu._npu_paged_attention(
        query=query,
        key_cache=key_cache,
        value_cache=value_cache,
        num_kv_heads=num_kv_heads,
        num_heads=num_heads,
        scale_value=scale,
        block_table=block_table,
        context_lens=seq_lens,
        out=output,
        workspace=workspace,
    )
    torch.npu.graph_task_update_end(update_stream)
    event.record(update_stream)
```

图捕获后每步重放时，捕获期的块表被丢弃（`_captured_block_table`），换成当步新的 `block_table` 与 `seq_lens` 重新下发算子。

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

block_size 的实际决定权在平台启动时的这个函数：默认 128，开了 prefix caching 或 chunked prefill 一律改回 128；deepseek_v4 与 hybrid 模型例外。

## vllm_ascend/device/device_op.py#L44-L53

```python
    @classmethod
    def reshape_and_cache(cls, key, value, key_cache, value_cache, slot_mapping):
        torch_npu.npu_scatter_pa_kv_cache(
            key=key.contiguous(),
            value=value.contiguous(),
            key_cache=key_cache,
            value_cache=value_cache,
            slot_mapping=slot_mapping.contiguous(),
            cache_mode="Norm",
        )
```

写路径：逐 token 的 K/V 按 `slot_mapping` 散写进块化缓存，算子名里的 `pa` 就是 paged attention。

## docs/source/user_guide/configuration/additional_config.md#L61

```markdown
| `pa_shape_list`                     | list | `[]`    | The custom shape list of page attention ops.                                                              |
```

官方文档对 `pa_shape_list` 的定义与默认值（空列表）。线上同页：<https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html>

## docs/source/user_guide/release_notes.md#L114-L128

```markdown
### Ready to Deprecate

The following features and optimizations are planned for deprecation in a future release:

- Layer sharding.
- FlashComm2.
- The FlashComm3 multistream-overlap gate.
- Hamming sparse.
- Asynchronous exponential overlap.
- Matmul all-reduce and matmul all-reduce RMSNorm fusions.
- Weight prefetch.
- Dynamic-batch SLO.
- KV offload in KV Pool.
- Fused MC2 mode 2 (`enable_fused_mc2=2`).
- Paged attention and `pa_shape_list`.
```

官方 release notes 把「paged attention 算子与 `pa_shape_list`」列为计划废弃——这是本页最反直觉的一条事实。线上同页：<https://docs.vllm.ai/projects/ascend/en/latest/user_guide/release_notes.html>

## docs/source/user_guide/feature_guide/graph_mode.md#L33-L37

```markdown
The default graph path on Ascend involves two stages: **compile-time optimization** and **runtime capture/replay**. ACLGraph handles the runtime capture/replay. The compile-time stage differs by `cudagraph_mode`:

- **FULL_AND_PIECEWISE**: Default mode, same as the upstream vLLM strategy. The compile-time path follows PIECEWISE compilation, while the runtime may still use full-graph behavior for uniform decode batches.
- **FULL / FULL_DECODE_ONLY**: Npugraph_ex optimizes the FX graph via npugraph_ex (`force_eager=True`, compile-time only, no capture). The optimized callable is then captured and replayed by ACLGraph at runtime.
```

官方文档写明默认 `cudagraph_mode` 是 `FULL_AND_PIECEWISE`——不是 PA 算子要求的 `FULL_DECODE_ONLY`。线上同页：<https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/graph_mode.html>

## docs/source/user_guide/feature_guide/graph_mode.md#L76-L79

```bash
vllm serve Qwen/Qwen3-0.6B \
  --compilation-config '{"cudagraph_mode": "PIECEWISE"}'
```

官方给出的 `cudagraph_mode` 命令行写法，本页的配置片段照它改成 `FULL_DECODE_ONLY`。

## https://arxiv.org/abs/2309.06180

> "When managed inefficiently, this memory can be significantly wasted by fragmentation and redundant duplication, limiting the batch size."
>
> "PagedAttention, an attention algorithm inspired by the classical virtual memory and paging techniques in operating systems."
>
> "(1) near-zero waste in KV cache memory and (2) flexible sharing of KV cache within and across requests to further reduce memory usage."

原始论文 *Efficient Memory Management for Large Language Model Serving with PagedAttention* 的摘要，用于「为什么需要它」一节的动机来源。
