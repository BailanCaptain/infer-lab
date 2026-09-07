# paged-attention 源码片段

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

昇腾后端向 vLLM 声明的 KV Cache 张量形状，K 与 V 打包在同一张量的第 0 维。

## vllm_ascend/attention/attention_v1.py#L123-L149

```python
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
```

块搬运/复制以块号张量索引第 1 维，说明 block 是唯一的迁移与复用粒度。

## vllm_ascend/attention/attention_v1.py#L151-L153

```python
    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]
```

后端只声明支持 block_size=128，是「支持的 block_size」问题的直接证据。

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

AscendMetadata 中承载 block_table 与 slot_mapping 的字段及其形状注释。

## vllm_ascend/attention/attention_v1.py#L249-L253

```python
        self.max_num_blocks_per_req = cdiv(
            self.model_config.max_model_len, AscendAttentionBackend.get_supported_kernel_block_sizes()[0]
        )
```

block_table 的列数由 max_model_len 除以 128 向上取整算出。

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

decode 走 FIA 时，KV Cache 被压成三维 (num_block, block_size, n_kv*d_h)，block_table 原样取自 metadata。

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

PA 算子的实际调用点：block_table 与 context_lens 直接从 metadata 传入，KV Cache 保持四维原布局。

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

PA 与 FIA 的分叉点：只有 DecodeOnly、无 sliding window、且 using_paged_attention 为真才走 PA。

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

forward 入口对 query/key/value 与 kv_cache 形状的自述，用于「形状与数值」一节。

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

PA 分支的全部启用条件，是「PA 默认不开」这一结论的依据。

## vllm_ascend/ascend_config.py#L378-L383

```python
    enable_reduce_sample: bool = False
    enable_dsa_cp: bool = False
    draft_window_size: int | None = None
    mix_placement: bool = False
    pa_shape_list: list[Any] = dataclasses.field(default_factory=list)
    mega_moe_max_tokens: int = 131072
```

`pa_shape_list` 的默认值为空列表。

## docs/source/user_guide/configuration/additional_config.md#L61

```markdown
| `pa_shape_list`                     | list | `[]`    | The custom shape list of page attention ops.                                                              |
```

官方配置表中 `pa_shape_list` 的类型与默认值。

## docs/source/faqs.md#L304-L306

```markdown
### 25. What is the difference between FIA and PA operators for attention?

FIA (Flash Attention) is the default attention operator in vLLM-Ascend. In some batch-size settings (particularly medium concurrency), FIA may exhibit suboptimal performance. The PA (Page Attention) operator can be manually enabled via `pa_shape_list` in `--additional-config`. When the runtime batch size matches a value in `pa_shape_list`, the framework switches to PA. This is a temporary tuning knob — future FIA optimizations will make this parameter obsolete.
```

仓库自带文档对 FIA 与 PA 定位的官方说明。

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

block_size 默认值与被强制拉回 128 的路径。

## vllm_ascend/worker/model_runner_v1.py#L4850-L4863

```python
            def backend_supports_kernel_block_size(
                attn_backend: type[AttentionBackend],
                block_size: int,
            ) -> bool:
                for supported_size in attn_backend.get_supported_kernel_block_sizes():
                    if isinstance(supported_size, int):
                        if block_size == supported_size:
                            return True
                    elif isinstance(supported_size, MultipleOf):
                        if block_size % supported_size.base == 0:
                            return True
                    else:
                        raise ValueError(f"Unknown supported size: {supported_size}")
                return False
```

`get_supported_kernel_block_sizes()` 的消费方：runner 用它校验实际 block_size 是否被后端接受。

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

分页写入侧：按 slot_mapping 把本步 K/V 散写进块内槽位。

## vllm_ascend/attention/attention_v1.py#L1628-L1657

```python
    def reshape_and_cache(
        self,
        query: torch.Tensor,
        key: torch.Tensor,
        value: torch.Tensor,
        kv_cache: tuple[torch.Tensor],
        attn_metadata: AscendMetadata,
        output: torch.Tensor,
    ):
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
        return query, key, value, output
```

`self.key_cache / self.value_cache` 由 `kv_cache[0] / kv_cache[1]` 切出，写入发生在 attention 计算之前。
