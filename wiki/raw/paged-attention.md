# paged-attention 引用的源码片段

来源仓库：vllm-ascend@28bf3a2e（ref main）。

## vllm_ascend/attention/attention_v1.py#L77-L83

```python
@register_backend(AttentionBackendEnum.CUSTOM, "ASCEND")
class AscendAttentionBackend(AttentionBackend):
    accept_output_buffer: bool = True

    @staticmethod
    def get_name() -> str:
        return "CUSTOM"
```

昇腾后端不是上游某个 PagedAttention 后端的子类，而是以 `AttentionBackendEnum.CUSTOM` 注册的独立后端，后端名字面量是 `"CUSTOM"`。用于说明「与上游的差异」一节里「同一套 block 抽象、不同的后端实现」这一点。

## vllm_ascend/attention/attention_v1.py#L113-L153

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

    @staticmethod
    def swap_blocks(
        src_kv_cache: list[torch.Tensor],
        dst_kv_cache: list[torch.Tensor],
        src_to_dst: torch.Tensor,
    ) -> None:
        src_key_cache, src_value_cache = src_kv_cache[0], src_kv_cache[1]
        dst_key_cache, dst_value_cache = dst_kv_cache[0], dst_kv_cache[1]
        src_indices = src_to_dst[:, 0]
        dst_indices = src_to_dst[:, 1]

        dst_key_cache[dst_indices] = src_key_cache[src_indices].to(dst_key_cache.device)
        dst_value_cache[dst_indices] = src_value_cache[src_indices].to(dst_key_cache.device)

    @staticmethod
    def copy_blocks(
        kv_caches: list[torch.Tensor],
        src_to_dists: torch.Tensor,
    ) -> None:
        src_indices = src_to_dists[:, 0]
        dst_indices = src_to_dists[:, 1]

        for kv_cache in kv_caches:
            key_caches = kv_cache[0]
            value_caches = kv_cache[1]
            key_caches[dst_indices] = key_caches[src_indices]
            value_caches[dst_indices] = value_caches[src_indices]

    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]
```

页面的核心事实：KV Cache 声明形状 `(2, num_blocks, block_size, num_kv_heads, head_size)`；`swap_blocks` / `copy_blocks` 都以 block 为最小搬运单位、直接对第 0 维做索引赋值；后端只声明支持 `block_size = 128`。

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

`AscendMetadata` 里 block_table 与 slot_mapping 两个字段的形状与语义（slot = block_id × block_size + offset），用于「怎么工作」与事实表。

## vllm_ascend/attention/attention_v1.py#L251-L253

```python
        self.max_num_blocks_per_req = cdiv(
            self.model_config.max_model_len, AscendAttentionBackend.get_supported_kernel_block_sizes()[0]
        )
```

block_table 的列数由 `cdiv(max_model_len, 128)` 决定，用于「拿真实数字走一遍」里算出 320 列。

## vllm_ascend/attention/attention_v1.py#L1637-L1657

```python
        if len(kv_cache) > 1:
            if self.key_cache is None:
                self.key_cache, self.value_cache = kv_cache[0], kv_cache[1]
            if self.kv_sharing_target_layer_name is not None:
                # KV-sharing target layers consume another layer's cache.
                # Writing their dummy/current K/V would overwrite shared slots.
                if self.is_kv_producer:
                    attn_metadata.reshape_cache_event.record()
                return query, key, value, output
            slots = attn_metadata.slot_mapping
            encoder_decoder = self.attn_type == AttentionType.ENCODER_DECODER
            DeviceOperator.reshape_and_cache(
                key=key[: attn_metadata.num_actual_tokens] if not encoder_decoder else key,
                value=value[: attn_metadata.num_actual_tokens] if not encoder_decoder else value,
                key_cache=self.key_cache,
                value_cache=self.value_cache,
                # quick fix to make sure slots is int32 for cross attention case.
                # see: https://github.com/vllm-project/vllm/blob/ce88756b967c2c5006746a424c15dd59a284ed8c/vllm/model_executor/layers/attention/cross_attention.py#L117
                slot_mapping=slots[: attn_metadata.num_actual_tokens] if not encoder_decoder else slots.to(torch.int32),
            )
            notify_kv_cache_written()
```

写侧：`kv_cache[0]` / `kv_cache[1]` 被拆成 key_cache 与 value_cache，本步新算出的 K/V 按 `slot_mapping` 散写进去。

## vllm_ascend/device/device_op.py#L43-L53

```python
class BaseDeviceAdaptor:
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

写侧最终落到的昇腾算子是 `npu_scatter_pa_kv_cache`（默认设备适配器），用于「怎么工作」的图与事实表。

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

FIA 路径怎么把分页缓存交给算子：block_size 从 `key_cache.shape[1]` 读出，key/value 被 reshape 成 `(num_block, block_size, num_kv_heads * head_size)`，block_table 直接取 `attn_metadata.block_tables`；只有 `PrefillNoCache` 传 `block_table=None`。

## vllm_ascend/attention/attention_v1.py#L1453-L1474

```python
                attn_output, _ = DeviceOperator.npu_fused_infer_attention_score(
                    query=query,
                    key=key,
                    value=value,
                    atten_mask=attn_metadata.attn_mask,
                    block_table=block_table,
                    input_layout="TND",
                    block_size=block_size,
                    actual_seq_lengths=attn_metadata.actual_seq_lengths_q,
                    actual_seq_lengths_kv=actual_seq_lengths_kv,
                    num_key_value_heads=self.num_kv_heads,
                    num_heads=self.num_heads,
                    head_size=self.head_size,
                    scale=self.scale,
                    key_cache=self.key_cache,
                    value_cache=self.value_cache,
                    current_key=key,
                    current_value=passed_value,
                    attn_metadata=attn_metadata,
                    is_prefill_no_cache=attn_metadata.attn_state == AscendAttentionState.PrefillNoCache,
                    sparse_mode=3,
                )
```

默认读路径（causal、无 sliding window）最终调用的 FIA 算子，`block_table` 与 `block_size` 作为普通入参传入，layout 是 `TND`。

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

PA 路径：decode 时 `block_table` 与 `context_lens` 直接作为参数传进 `torch_npu._npu_paged_attention`，KV 传的是未 reshape 的 `key_cache` / `value_cache`。

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

PA 与 FIA 的分流点，以及走 PA 的三个必要条件（DecodeOnly、无 sliding window、`using_paged_attention` 为真）。

## vllm_ascend/attention/attention_v1.py#L1695-L1705

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

forward 的输入输出张量形状，事实表用。

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

PA 开关的全部判定条件：投机解码关、A5 关、`cudagraph_mode` 必须是 `FULL_DECODE_ONLY`、当前 batch 的 token 数必须命中 `pa_shape_list`。

## vllm_ascend/attention/utils.py#L94-L138

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

图模式下 block_table 怎么更新：捕获时记下的 `_captured_block_table` 被丢弃，重放前用本步 metadata 里的 `block_table` 与 `seq_lens` 重新下发任务。

## vllm_ascend/utils.py#L1178-L1204

```python
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

block_size 的实际来源：不指定就是 128；开了 prefix caching 或 chunked prefill 会被强制改回 128（deepseek_v4 与 hybrid 模型走各自的分支）。

## docs/source/user_guide/configuration/additional_config.md#L61-L61

```markdown
| `pa_shape_list`                     | list | `[]`    | The custom shape list of page attention ops.                                                              |
```

`pa_shape_list` 的类型与默认值（默认空列表，即默认不走 PA 算子）。

## docs/source/faqs.md#L304-L306

```markdown
### 25. What is the difference between FIA and PA operators for attention?

FIA (Flash Attention) is the default attention operator in vLLM-Ascend. In some batch-size settings (particularly medium concurrency), FIA may exhibit suboptimal performance. The PA (Page Attention) operator can be manually enabled via `pa_shape_list` in `--additional-config`. When the runtime batch size matches a value in `pa_shape_list`, the framework switches to PA. This is a temporary tuning knob — future FIA optimizations will make this parameter obsolete.
```

官方对 FIA 与 PA 两个算子关系的说明：FIA 是默认，PA 是临时调优开关。这是「为什么需要它」里唯一的官方级依据。

## docs/source/user_guide/feature_guide/graph_mode.md#L76-L79

````markdown
```bash
vllm serve Qwen/Qwen3-0.6B \
  --compilation-config '{"cudagraph_mode": "PIECEWISE"}'
```
````

官方给出的 `cudagraph_mode` 命令行写法，「拿真实数字走一遍」的配置片段照此格式写成 `FULL_DECODE_ONLY`。
