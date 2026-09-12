# PagedAttention — 引用的源码片段

## vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L113-L153

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

`AscendAttentionBackend` 声明的 KV Cache 形状与唯一支持的 block_size；块级的 swap/copy 也在这里，说明「块」是搬运的最小单位。

## vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L104-L144

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

v0.23.0 的同一段，用来确认形状与 block_size 声明两版一致。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4647-L4659

```python
                    else:
                        kv_cache_shape = attn_backend.get_kv_cache_shape(
                            num_blocks,
                            current_kv_cache_spec.block_size,
                            current_kv_cache_spec.num_kv_heads,
                            current_kv_cache_spec.head_size,
                        )
                    if not isinstance(current_kv_cache_spec, AscendMLAAttentionSpec):
                        k_shape = kv_cache_shape[1:]
                        if hasattr(current_kv_cache_spec, "head_size_v"):
                            v_shape = (*kv_cache_shape[1:-1], current_kv_cache_spec.head_size_v)
                        else:
                            v_shape = k_shape
```

证明 `get_kv_cache_shape` 的前导 2 不是张量的一维，而是「切成 K、V 两份」的记号：真正落盘的形状是 `kv_cache_shape[1:]`。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4693-L4704

```python
                    k_cache = raw_k_tensor.view(k_cache_dtype).view(k_shape)
                    if current_sparse_sfa_c8:
                        v_cache = None
                    else:
                        assert raw_v_tensor is not None
                        v_cache = raw_v_tensor.view(v_cache_dtype).view(v_shape)

                    if current_sparse_sfa_c8:
                        kv_caches[layer_name] = (k_cache,)
                    else:
                        assert v_cache is not None
                        kv_caches[layer_name] = (k_cache, v_cache)
```

K、V 是两个各自 4 维的独立张量，算子收到的也是两个入参 `key_cache` / `value_cache`。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1660-L1681

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

PA 与 FIA 的唯一分派点，也是「PA 只在 DecodeOnly 且非滑窗层」这条结论的依据。

## vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1456-L1477

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
        num_tokens = query.shape[0]
        record_attention_compute_start()

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

v0.23.0 的分派条件与 main 完全一致（只有两行语句顺序不同）。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/utils.py#L206-L222

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

PA 生效的全部前置条件：投机解码早退、A5 早退、512 头维强制走 PA、必须 FULL_DECODE_ONLY、batch 命中 `pa_shape_list`。

## vllm-ascend@2c59ff10:vllm_ascend/attention/utils.py#L104-L120

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

v0.23.0 逐字相同，确认门槛两版一致。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1561-L1580

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

decode 时块表怎么进算子：`block_table=attn_metadata.block_tables`、`context_lens=attn_metadata.seq_lens`，key/value cache 保持 4 维原样传入。

## vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1363-L1382

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

v0.23.0 的调用参数逐字相同。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1307-L1345

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

默认路径（FIA）同样按块读缓存：block_size 从 `key_cache.shape[1]` 反推，K/V 压成三维 `(num_block, block_size, num_kv_heads*head_size)`，只有 PrefillNoCache 不传块表。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L239-L253

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

后端自己按 `get_supported_kernel_block_sizes()[0]`（即 128）算每请求最大块数，即块表列数的来源。v0.23.0 同一段在 L242-L244，写法相同。

## vllm-ascend@28bf3a2e:vllm_ascend/utils.py#L1167-L1204

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

block_size 的实际取值规则：不指定则 128；开 prefix caching 或 chunked prefill 强制回 128。v0.23.0 同一函数在 utils.py#L1369-L1406，逐字相同。

## vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L380-L383

```python
    draft_window_size: int | None = None
    mix_placement: bool = False
    pa_shape_list: list[Any] = dataclasses.field(default_factory=list)
    mega_moe_max_tokens: int = 131072
```

main 上 `pa_shape_list` 已改成 dataclass 字段，默认仍是空列表。

## vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L242-L246

```python
        # We find that _npu_paged_attention still performs better than
        # npu_fused_infer_attention_score in some cases. We allow to execute
        # _npu_paged_attention in this cases. This should be removed once
        # npu_fused_infer_attention_score performs better on all scenarios.
        self.pa_shape_list = additional_config.get("pa_shape_list", [])
```

v0.23.0 上是 `__init__` 里的普通属性，默认同为 `[]`；紧邻的注释写明了这个开关存在的理由（PA 在部分 shape 上仍快过 FIA，是临时调优口子）。

## vllm-ascend@28bf3a2e:vllm_ascend/device/device_op.py#L43-L53

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

main 的 KV 写入算子：按 slot 号散写进分块缓存。

## vllm-ascend@2c59ff10:vllm_ascend/device/device_op.py#L47-L52

```python
class BaseDeviceAdaptor:
    @classmethod
    def reshape_and_cache(cls, key, value, key_cache, value_cache, slot_mapping):
        torch_npu._npu_reshape_and_cache(
            key=key, value=value, key_cache=key_cache, value_cache=value_cache, slot_indices=slot_mapping
        )
```

v0.23.0 用的是另一个算子、另一个参数名（`slot_indices`），是两版之间实打实的差异。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/utils.py#L83-L138

```python
@dataclass
class PagedAttentionGraphParam:
    """Mark PA params when PA and FIA share one graph replay list."""

    params: tuple
    layer_name: str | None

    def __iter__(self):
        return iter(self.params)


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

main 新增的能力：同一张图重放列表里 PA 和 FIA 可以混着存，靠这个带类型的包装区分，并在重放前把新的 block_table / seq_lens 换进去。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1253-L1268

```python
            graph_params.attn_params[num_tokens].append(
                PagedAttentionGraphParam(
                    (
                        weak_ref_tensors(query),
                        weak_ref_tensors(self.key_cache),
                        weak_ref_tensors(self.value_cache),
                        self.num_kv_heads,
                        self.num_heads,
                        self.scale,
                        attn_metadata.block_tables,
                        attn_metadata.seq_lens,
                        weak_ref_tensors(output),
                    ),
                    self._graph_metadata_layer_name() if self._use_layer_aware_fia_graph_replay else None,
                )
            )
```

main 捕获 PA 时挂的是带类型的 `PagedAttentionGraphParam`。

## vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1143-L1155

```python
            graph_params.attn_params[num_tokens].append(
                (
                    weak_ref_tensors(query),
                    weak_ref_tensors(self.key_cache),
                    weak_ref_tensors(self.value_cache),
                    self.num_kv_heads,
                    self.num_heads,
                    self.scale,
                    attn_metadata.block_tables,
                    attn_metadata.seq_lens,
                    weak_ref_tensors(output),
                )
            )
```

v0.23.0 挂的是裸 9 元组，重放侧靠 `using_paged_attention` 一次性判定整张图走 PA 还是走 FIA，两者无法混存。

## vllm-ascend@28bf3a2e:docs/source/faqs.md#L304-L306

```markdown
### 25. What is the difference between FIA and PA operators for attention?

FIA (Flash Attention) is the default attention operator in vLLM-Ascend. In some batch-size settings (particularly medium concurrency), FIA may exhibit suboptimal performance. The PA (Page Attention) operator can be manually enabled via `pa_shape_list` in `--additional-config`. When the runtime batch size matches a value in `pa_shape_list`, the framework switches to PA. This is a temporary tuning knob — future FIA optimizations will make this parameter obsolete.
```

官方对 FIA 与 PA 关系的定性：FIA 是默认，PA 是按 batch 手工挑的临时调优项。

## vllm-ascend@28bf3a2e:docs/source/user_guide/configuration/additional_config.md#L59-L61

```markdown
| `multistream_overlap_shared_expert` | bool | `False` | Whether to enable multi-stream shared expert. This option only takes effect on MoE models with shared experts. |
| `enable_cpu_binding`                | bool | `True`  | Enables Ascend-native CPU binding on ARM servers. Set to `False` to disable. See [CPU Binding](../feature_guide/cpu_binding.md). |
| `pa_shape_list`                     | list | `[]`    | The custom shape list of page attention ops.                                                              |
```

官方参数表里 `pa_shape_list` 的类型与默认值（v0.23.0 同一行在 additional_config.md#L84）。

## vllm-ascend@28bf3a2e:docs/source/tutorials/models/Qwen3-Dense.md#L524-L543

```bash
export HCCL_OP_EXPANSION_MODE="AIV"
export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3
export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True

vllm serve your_model_path \
    --served-model-name qwen3 \
    --trust-remote-code \
    --distributed-executor-backend "mp" \
    --tensor-parallel-size 4 \
    --max-model-len 5500 \
    --max-num-batched-tokens 40960 \
    --no-enable-prefix-caching \
    --quantization ascend \
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY","cudagraph_capture_sizes":[4,8,64,72,76,80,96,100,120,140,144,160,192,216,240,252,288,320,336,360,384,400,408,416,420,432,480,540,576,600]}' \
    --additional-config '{"weight_prefetch_config":{"enabled":true}, "pa_shape_list":[32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,160,161,162,163,164,165,166,167,168,169,170,171,172,173,174,175,176,177,178,179,180,181,182,183,184,185,186,187,188,189,190,191,192,193,194,195,196,197,198,199,200,201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,219,220,221,222,223,224,225,226,227,228,229,230,231,232,233,234,235,236,237,238,239,240,241,242,243,244,245,246,247,248,249,250,251,252,253,254,255,256]}' \
    --host <host_ip> \
    --port <port> \
    --block-size 128 \
    --gpu-memory-utilization 0.9
```

官方唯一一份把 `FULL_DECODE_ONLY`、`--block-size 128` 和 `pa_shape_list` 配齐的完整示例，本页配置片段以它为底本。

## vllm-ascend@28bf3a2e:docs/source/tutorials/features/suffix_speculative_decoding.md#L85-L95

```bash
vllm serve /data/Qwen3-32B \
  --served-model-name qwen3 \
  --trust-remote-code \
  --distributed-executor-backend mp \
  --tensor-parallel-size 4 \
  --max-model-len 5500 \
  --max-num-batched-tokens 40960 \
  --speculative-config '{"method": "suffix", "num_speculative_tokens": 3}' \
  --gpu-memory-utilization 0.9 \
  --additional-config '{"pa_shape_list":[48,64,72,80], "weight_prefetch_config":{"enable":true}}' \
  --port 8011
```

官方教程同时给了 `--speculative-config` 和 `pa_shape_list`，但 `using_paged_attention` 第一句就在 speculative_config 非 None 时返回 False——这条命令里 PA 实际不会启用，是文档与代码的冲突。
