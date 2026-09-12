# KV Cache Quantization — 引用片段

两个 ref：`main = vllm-ascend@28bf3a2e`，`releases/v0.23.0 = vllm-ascend@2c59ff10`。

## vllm_ascend/quantization/configs/modelslim_config.py#L1097-L1115 （main）

```python
    def _add_kvcache_quant_metadata(self):
        fa_quant_type = self.quant_description.get("fa_quant_type", "")
        self.enable_fa_quant = fa_quant_type != ""
        self.kvcache_quant_layers = []
        indexer_quant_type = self.quant_description.get("indexer_quant_type", "")
        self.enable_indexer_quant = indexer_quant_type != ""
        self.indexer_quant_layers = []
        kv_quant_type = self.quant_description.get("kv_cache_type", "")
        self.enable_c8_quant = kv_quant_type == "C8"
        self.c8_quant_layers = []
        if self.enable_fa_quant or self.enable_indexer_quant or self.enable_c8_quant:
            for key in self.quant_description:
                _id = "".join(re.findall(r"\.(\d+)\.", key))
                if "fa_k.scale" in key:
                    self.kvcache_quant_layers.append(int(_id))
                if "indexer.quant_type" in key:
                    self.indexer_quant_layers.append(int(_id))
                if "k_proj.kv_cache_scale" in key:
                    self.c8_quant_layers.append(int(_id))
```

C8 的唯一开关：checkpoint 的 `quant_model_description.json` 里 `kv_cache_type == "C8"`。哪些层参与，由描述里出现 `k_proj.kv_cache_scale` 的层号决定。这是「KV 量化不靠 `--kv-cache-dtype`」这条结论的直接依据。

## vllm_ascend/quantization/modelslim_config.py#L934-L952 （v0.23.0）

```python
    def _add_kvcache_quant_metadata(self):
        fa_quant_type = self.quant_description.get("fa_quant_type", "")
        self.enable_fa_quant = fa_quant_type != ""
        self.kvcache_quant_layers = []
        indexer_quant_type = self.quant_description.get("indexer_quant_type", "")
        self.enable_indexer_quant = indexer_quant_type != ""
        self.indexer_quant_layers = []
        kv_quant_type = self.quant_description.get("kv_cache_type", "")
        self.enable_c8_quant = kv_quant_type == "C8"
        self.c8_quant_layers = []
        if self.enable_fa_quant or self.enable_indexer_quant or self.enable_c8_quant:
            for key in self.quant_description:
                _id = "".join(re.findall(r"\.(\d+)\.", key))
                if "fa_k.scale" in key:
                    self.kvcache_quant_layers.append(int(_id))
                if "indexer.quant_type" in key:
                    self.indexer_quant_layers.append(int(_id))
                if "k_proj.kv_cache_scale" in key:
                    self.c8_quant_layers.append(int(_id))
```

用来确认开关逻辑在两个版本上逐字一致（只有文件路径从 `quantization/` 移到 `quantization/configs/`）。

## vllm_ascend/quantization/methods/kv_cache/kv_c8.py#L108-L145 （main）

```python
class AscendC8KVCacheAttentionMethod(AscendAttentionScheme):
    """C8 INT8 KV cache quantization for dense-attention models (e.g. Qwen3)."""

    def __init__(self, quant_description: dict, prefix: str):
        self.quant_description = quant_description
        self.prefix = prefix
        vllm_config = get_current_vllm_config()
        self.is_kv_producer = False
        if vllm_config.kv_transfer_config is not None:
            self.is_kv_producer = vllm_config.kv_transfer_config.is_kv_producer

    def create_weights(self, layer: torch.nn.Module) -> None:
        # Returns int8 if the P node is not a PD detachment node.
        if not self.is_kv_producer:
            logger.info_once(
                "[vllm-ascend/C8_KV] KV cache producer is disabled; setting kv_cache_torch_dtype to torch.int8."
            )
            layer.kv_cache_torch_dtype = torch.int8
        # Upgrade impl to the C8-specific subclass so the C8 forward path is always used.
        if hasattr(layer, "impl"):
            from vllm_ascend.attention.attention_v1 import AscendC8AttentionBackendImpl

            layer.impl.__class__ = AscendC8AttentionBackendImpl
        dtype = torch.get_default_dtype()
        layer.k_cache_scale = torch.nn.Parameter(torch.ones(1, dtype=dtype), requires_grad=False)
        layer.k_cache_scale.weight_loader = _c8_kv_scale_weight_loader
        layer.k_cache_offset = torch.nn.Parameter(torch.zeros(1, dtype=dtype), requires_grad=False)
        layer.k_cache_offset.weight_loader = _c8_kv_scale_weight_loader
        layer.v_cache_scale = torch.nn.Parameter(torch.ones(1, dtype=dtype), requires_grad=False)
        layer.v_cache_scale.weight_loader = _c8_kv_scale_weight_loader
        layer.v_cache_offset = torch.nn.Parameter(torch.zeros(1, dtype=dtype), requires_grad=False)
        layer.v_cache_offset.weight_loader = _c8_kv_scale_weight_loader

    def process_weights_after_loading(self, layer: torch.nn.Module) -> None:
        layer.k_cache_scale.data = layer.k_cache_scale.data.flatten()
        layer.k_cache_offset.data = layer.k_cache_offset.data.flatten()
        layer.v_cache_scale.data = layer.v_cache_scale.data.flatten()
        layer.v_cache_offset.data = layer.v_cache_offset.data.flatten()
```

四个来源事实都在这一段：KV cache 被声明成 `torch.int8`、`impl` 被换类、四个 scale/offset 参数的默认值（scale=1、offset=0）与 dtype（`torch.get_default_dtype()`，即模型 dtype）、以及 PD 分离时生产端不降 dtype 的例外。

## vllm_ascend/quantization/methods/kv_c8.py#L119-L139 （v0.23.0）

```python
    def create_weights(self, layer: torch.nn.Module) -> None:
        # Returns int8 if the P node is not a PD detachment node.
        if not self.is_kv_producer:
            logger.info_once(
                "[vllm-ascend/C8_KV] KV cache producer is disabled; setting kv_cache_torch_dtype to torch.int8."
            )
            layer.kv_cache_torch_dtype = torch.int8
        # Upgrade impl to the C8-specific subclass so the C8 forward path is always used.
        if hasattr(layer, "impl"):
            from vllm_ascend.attention.attention_v1 import AscendC8AttentionBackendImpl

            layer.impl.__class__ = AscendC8AttentionBackendImpl
        dtype = torch.get_default_dtype()
        layer.k_cache_scale = torch.nn.Parameter(torch.ones(1, dtype=dtype), requires_grad=False)
        layer.k_cache_scale.weight_loader = _c8_kv_scale_weight_loader
        layer.k_cache_offset = torch.nn.Parameter(torch.zeros(1, dtype=dtype), requires_grad=False)
        layer.k_cache_offset.weight_loader = _c8_kv_scale_weight_loader
        layer.v_cache_scale = torch.nn.Parameter(torch.ones(1, dtype=dtype), requires_grad=False)
        layer.v_cache_scale.weight_loader = _c8_kv_scale_weight_loader
        layer.v_cache_offset = torch.nn.Parameter(torch.zeros(1, dtype=dtype), requires_grad=False)
        layer.v_cache_offset.weight_loader = _c8_kv_scale_weight_loader
```

确认 v0.23.0 的 `create_weights` 与 main 逐字一致。

## vllm_ascend/quantization/configs/modelslim_config.py#L658-L670 （main）

```python
    def get_cache_scale_mapper(self) -> "WeightsMapper":
        """Upstream use staticmethod, but we need to use instance attribute"""
        suffix_map = {}
        regex_map = {}
        if self.enable_c8_quant:
            suffix_map.update(
                {
                    ".k_proj.kv_cache_scale": ".attn.k_cache_scale",
                    ".k_proj.kv_cache_offset": ".attn.k_cache_offset",
                    ".v_proj.kv_cache_scale": ".attn.v_cache_scale",
                    ".v_proj.kv_cache_offset": ".attn.v_cache_offset",
                }
            )
```

scale 的来路：checkpoint 里挂在 `k_proj` / `v_proj` 上的 `kv_cache_scale` / `kv_cache_offset`，被改名到 attention 层的 `k_cache_scale` 等参数上。main 用 `WeightsMapper`。

## vllm_ascend/quantization/modelslim_config.py#L545-L558 （v0.23.0）

```python
    def get_cache_scale(self, name: str) -> str | None:
        """Map checkpoint C8 KV scale/offset names to vLLM parameter names."""
        if self.quant_description.get("kv_cache_type") != "C8":
            return None
        _C8_SCALE_MAPPING = {
            "k_proj.kv_cache_scale": "attn.k_cache_scale",
            "k_proj.kv_cache_offset": "attn.k_cache_offset",
            "v_proj.kv_cache_scale": "attn.v_cache_scale",
            "v_proj.kv_cache_offset": "attn.v_cache_offset",
        }
        for src_suffix, dst_suffix in _C8_SCALE_MAPPING.items():
            if name.endswith(src_suffix):
                return name[: -len(src_suffix)] + dst_suffix
        return None
```

同一件事在 v0.23.0 是逐名字映射的 `get_cache_scale`，不是 mapper。映射目标四个名字两版一致——这是版本差异那一行的依据。

## vllm_ascend/quantization/configs/modelslim_config.py#L789-L809 （main）

```python
        if isinstance(layer, LinearBase):
            if self.is_layer_skipped_ascend(prefix, self.packed_modules_mapping):
                # Delayed import to avoid circular import
                from vllm_ascend.ops.linear import AscendUnquantizedLinearMethod

                logger.debug("Select AscendUnquantizedLinearMethod for %s (layer=%s)", prefix, "LinearBase")
                return AscendUnquantizedLinearMethod()
            scheme = create_scheme_for_layer(self.quant_description, prefix, "linear", self.packed_modules_mapping)
            logger.debug("Select AscendLinearMethod for %s (layer=%s)", prefix, "LinearBase")
            return AscendLinearMethod(scheme)
        elif isinstance(layer, AttentionLayerBase) and (
            self.is_fa_quant_layer(prefix) or self.is_indexer_quant_layer(prefix)
        ):
            scheme = create_scheme_for_layer(self.quant_description, prefix, "attention", self.packed_modules_mapping)
            logger.debug("Select AscendKVCacheMethod for %s (layer=%s)", prefix, "AttentionLayerBase[fa/indexer]")
            return AscendKVCacheMethod(scheme)
        elif isinstance(layer, AttentionLayerBase) and self.is_c8_quant_layer(prefix):
            from ..methods.kv_cache.kv_c8 import AscendC8KVCacheAttentionMethod

            logger.debug("Select AscendKVCacheMethod(C8) for %s (layer=%s)", prefix, "AttentionLayerBase[C8]")
            return AscendKVCacheMethod(AscendC8KVCacheAttentionMethod(self.quant_description, prefix))
```

与权重量化的关系：同一个 `AscendModelSlimConfig.get_quant_method` 按层类型分发，`LinearBase` 走权重量化、`AttentionLayerBase` 走 KV 量化，两者出自同一份描述文件，所以 `--quantization ascend` 一次打开两件事。

## vllm_ascend/attention/attention_v1.py#L1898-L1931 （main）

```python
    def _prepare_c8_scales(self, layer: AttentionLayer, device: torch.device) -> None:
        """Shard per-channel C8 scales/offsets to this TP rank and pre-compute
        BF16 BNSD antiquant tensors for FIA V1 decode fast path.
        """
        if hasattr(layer, "_c8_scales_prepared"):
            return

        def _shard_and_reshape(raw: torch.Tensor) -> torch.Tensor:
            if raw.numel() == 1:
                return raw.to(device=device)
            expected = self.num_kv_heads * self.head_size
            if raw.numel() != expected:
                total_kv_heads = raw.numel() // self.head_size
                tp_rank = get_tensor_model_parallel_rank()
                tp_size = get_tensor_model_parallel_world_size()
                kv_head_start = tp_rank * total_kv_heads // tp_size
                raw = raw.view(total_kv_heads, self.head_size)[
                    kv_head_start : kv_head_start + self.num_kv_heads
                ].contiguous()
            return raw.view(1, self.num_kv_heads, self.head_size).to(device=device)

        layer._c8_k_scale = _shard_and_reshape(layer.k_cache_scale.data)
        layer._c8_k_offset = _shard_and_reshape(layer.k_cache_offset.data)
        layer._c8_v_scale = _shard_and_reshape(layer.v_cache_scale.data)
        layer._c8_v_offset = _shard_and_reshape(layer.v_cache_offset.data)

        layer._c8_k_inv_scale = 1.0 / layer._c8_k_scale
        layer._c8_v_inv_scale = 1.0 / layer._c8_v_scale

        nz_bnsd = (self.num_kv_heads, 1, self.head_size)
        layer._c8_k_aq_scale_nz_bnsd = layer._c8_k_scale.view(nz_bnsd).contiguous()
        layer._c8_v_aq_scale_nz_bnsd = layer._c8_v_scale.view(nz_bnsd).contiguous()

        layer._c8_scales_prepared = True
```

scale 的粒度与形状：per-channel 时 numel 应为 `num_kv_heads * head_size`，按 TP rank 切片，最终整形成 `(num_kv_heads, 1, head_size)` 给算子；numel==1 时退化为 per-tensor。事实表里 scale 形状那一行、以及「首次 forward 时才准备」这条来自这里。

## vllm_ascend/attention/attention_v1.py#L1981-L2002 （main）

```python
    def _quantize_kv_to_int8(
        self,
        key: torch.Tensor,
        value: torch.Tensor,
        layer: AttentionLayer,
        num_actual_tokens: int,
    ) -> tuple[torch.Tensor, torch.Tensor]:
        """Quantize K/V from float to INT8 using static per-channel C8 scales."""
        actual_key = key[:num_actual_tokens]
        actual_value = value[:num_actual_tokens]

        k_int8 = torch.clamp(
            torch.round(actual_key * layer._c8_k_inv_scale + layer._c8_k_offset),
            -128,
            127,
        ).to(torch.int8)
        v_int8 = torch.clamp(
            torch.round(actual_value * layer._c8_v_inv_scale + layer._c8_v_offset),
            -128,
            127,
        ).to(torch.int8)
        return k_int8, v_int8
```

量化算式本身，`## 拿真实数字走一遍` 那一节的算式就是它。也是「offset 在量化时加上」的依据。

## vllm_ascend/attention/attention_v1.py#L2004-L2040 （main）

```python
    def _forward_c8_decode(
        self,
        query: torch.Tensor,
        attn_metadata: AscendMetadata,
        output: torch.Tensor,
        layer: AttentionLayer,
    ) -> torch.Tensor:
        """C8 decode via FIA V1 BNSD with native paged INT8 KV + perchannel antiquant."""
        num_block, block_size, _, _ = self.key_cache.shape  # type: ignore[attr-defined]
        assert block_size % 32 == 0, f"C8 INT8 KV cache requires block_size to be a multiple of 32, got {block_size}"
        batch_size = len(attn_metadata.seq_lens_list)

        key = self._nz_5d_view(self.key_cache, block_size)
        value = self._nz_5d_view(self.value_cache, block_size)

        attn_output, _ = torch_npu.npu_fused_infer_attention_score(
            query[:batch_size].unsqueeze(2),
            key,
            value,
            key_antiquant_scale=layer._c8_k_aq_scale_nz_bnsd,
            value_antiquant_scale=layer._c8_v_aq_scale_nz_bnsd,
            block_table=attn_metadata.block_tables,
            actual_seq_lengths_kv=attn_metadata.seq_lens_list,
            num_heads=self.num_heads,
            num_key_value_heads=self.num_kv_heads,
            input_layout="BNSD",
            scale=self.scale,
            block_size=block_size,
            antiquant_mode=0,
            key_antiquant_mode=0,
            value_antiquant_mode=0,
            inner_precise=1,
            sparse_mode=0,
        )
        attn_output = attn_output.squeeze(2)
        output[:batch_size] = attn_output
        return output
```

「算子如何消费量化 KV」的核心答案：decode 不做显式反量化，直接把 int8 块表交给 `npu_fused_infer_attention_score`，scale 以 `key_antiquant_scale` / `value_antiquant_scale` 传入，`*_antiquant_mode=0`。`block_size % 32 == 0` 这条硬约束也在这里。

## vllm_ascend/attention/attention_v1.py#L1756-L1792 （v0.23.0）

```python
    def _forward_c8_decode(
        self,
        query: torch.Tensor,
        attn_metadata: AscendMetadata,
        output: torch.Tensor,
        layer: AttentionLayer,
    ) -> torch.Tensor:
        """C8 decode via FIA V1 BNSD with native paged INT8 KV + perchannel antiquant."""
        num_block, block_size, _, _ = self.key_cache.shape  # type: ignore[attr-defined]
        assert block_size % 32 == 0, f"C8 INT8 KV cache requires block_size to be a multiple of 32, got {block_size}"
        batch_size = len(attn_metadata.seq_lens_list)

        key = self._nz_5d_view(self.key_cache, block_size)
        value = self._nz_5d_view(self.value_cache, block_size)

        attn_output, _ = torch_npu.npu_fused_infer_attention_score(
            query[:batch_size].unsqueeze(2),
            key,
            value,
            key_antiquant_scale=layer._c8_k_aq_scale_nz_bnsd,
            value_antiquant_scale=layer._c8_v_aq_scale_nz_bnsd,
            block_table=attn_metadata.block_tables,
            actual_seq_lengths_kv=attn_metadata.seq_lens_list,
            num_heads=self.num_heads,
            num_key_value_heads=self.num_kv_heads,
            input_layout="BNSD",
            scale=self.scale,
            block_size=block_size,
            antiquant_mode=0,
            key_antiquant_mode=0,
            value_antiquant_mode=0,
            inner_precise=1,
            sparse_mode=0,
        )
        attn_output = attn_output.squeeze(2)
        output[:batch_size] = attn_output
        return output
```

确认 decode 路径两版逐字一致，`block_size` 约束与 antiquant 传参没有变。

## vllm_ascend/attention/attention_v1.py#L1893-L1896 （main）

```python
    def _nz_5d_view(self, cache: torch.Tensor, block_size: int) -> torch.Tensor:
        """View a KV cache tensor in NZ 5D layout: (num_blocks, num_kv_heads, head_size//nz, block_size, nz)."""
        NZ_FMT_LAST_DIM = 32
        return cache.view(-1, self.num_kv_heads, self.head_size // NZ_FMT_LAST_DIM, block_size, NZ_FMT_LAST_DIM)
```

NZ 5D 布局：末维固定 32，因此 `head_size` 也必须能被 32 整除。事实表里布局那一行出自这里。

## vllm_ascend/attention/attention_v1.py#L1973-L1979 （main）

```python
        dense_k = gathered_k.view(-1, self.num_kv_heads, self.head_size)[valid_mask]
        dense_v = gathered_v.view(-1, self.num_kv_heads, self.head_size)[valid_mask]

        # Scale-only dequant for NZ (symmetric)
        dense_k = dense_k.to(target_dtype) * layer._c8_k_scale
        dense_v = dense_v.to(target_dtype) * layer._c8_v_scale
        return dense_k, dense_v
```

gather 回来后的反量化只乘 scale、不减 offset——「offset 只在一条分支上被减掉」这条结论的一半。

## vllm_ascend/attention/attention_v1.py#L2168-L2181 （main）

```python
        if key.dtype == torch.int8:
            if block_table is not None:
                seq_lens = (
                    actual_seq_lengths_kv if isinstance(actual_seq_lengths_kv, list) else actual_seq_lengths_kv.tolist()
                )
                key, value = self._dequant_paged_kv_to_dense(key, value, block_table, seq_lens, query.dtype, layer)
                block_table = None
                # block_table is None after dequant; FIA ignores block_size.
                # Use cache block_size for consistency rather than a magic number.
                block_size = self.key_cache.shape[1]  # type: ignore[attr-defined]
                actual_seq_lengths_kv = torch.tensor(seq_lens, dtype=torch.int32).cumsum(dim=0)
            else:
                key = (key.to(query.dtype) - layer._c8_k_offset) * layer._c8_k_scale
                value = (value.to(query.dtype) - layer._c8_v_offset) * layer._c8_v_scale
```

唯一一条把 offset 减回去的反量化分支（非分页、KV 已在寄存的 int8 张量里）。与上一段并读才能得出「三条读路径里只有这一条对称处理 offset」。

## vllm_ascend/attention/attention_v1.py#L2059-L2117 （main）

```python
        if num_decode_tokens > 0:
            num_block, block_size, _, _ = self.key_cache.shape  # type: ignore[attr-defined]
            assert block_size % 32 == 0, (
                f"C8 INT8 KV cache requires block_size to be a multiple of 32, got {block_size}"
            )
            kv_k = self._nz_5d_view(self.key_cache, block_size)
            kv_v = self._nz_5d_view(self.value_cache, block_size)

            attn_out, _ = torch_npu.npu_fused_infer_attention_score(
                query[:num_decode_tokens].unsqueeze(2),
                kv_k,
                kv_v,
                key_antiquant_scale=layer._c8_k_aq_scale_nz_bnsd,
                value_antiquant_scale=layer._c8_v_aq_scale_nz_bnsd,
                block_table=attn_metadata.block_tables[:num_decodes],
                actual_seq_lengths_kv=attn_metadata.seq_lens_list[:num_decodes],
                num_heads=self.num_heads,
                num_key_value_heads=self.num_kv_heads,
                input_layout="BNSD",
                scale=self.scale,
                block_size=block_size,
                antiquant_mode=0,
                key_antiquant_mode=0,
                value_antiquant_mode=0,
                inner_precise=1,
                sparse_mode=0,
            )
            output[:num_decode_tokens] = attn_out.squeeze(2)

        if attn_metadata.num_prefills > 0:
            prefill_q = query[num_decode_tokens:num_tokens]

            prefill_seq_qlen = [
                actual_seq_qlen[i] - num_decode_tokens for i in range(num_decodes, len(actual_seq_qlen))
            ]

            all_new_prefill = True
            for i in range(num_decodes, len(attn_metadata.seq_lens_list)):
                q_start = actual_seq_qlen[i - 1] if i > 0 else 0
                qlen_i = actual_seq_qlen[i] - q_start
                if attn_metadata.seq_lens_list[i] > qlen_i:
                    all_new_prefill = False
                    break

            if all_new_prefill and float_key is not None and float_value is not None:
                prefill_k = float_key[num_decode_tokens:num_tokens]
                prefill_v = float_value[num_decode_tokens:num_tokens]
                prefill_seq_kvlen = prefill_seq_qlen
            else:
                num_block, blk_size, _, _ = self.key_cache.shape  # type: ignore[attr-defined]
                paged_k = self._nz_5d_view(self.key_cache, blk_size)
                paged_v = self._nz_5d_view(self.value_cache, blk_size)

                prefill_bt = attn_metadata.block_tables[num_decodes:]
                prefill_sl = attn_metadata.seq_lens_list[num_decodes:]
                prefill_k, prefill_v = self._dequant_paged_kv_to_dense(
                    paged_k, paged_v, prefill_bt, prefill_sl, query.dtype, layer
                )
                prefill_seq_kvlen = torch.tensor(prefill_sl, dtype=torch.int32).cumsum(dim=0)
```

chunked prefill 下 decode 与 prefill 分两段算：decode 段吃分页 int8 零 gather，prefill 段若全是新序列就直接用未量化的 float KV，否则 gather+反量化成 dense。这是「prefill 命中缓存时才付 gather 代价」这条结论的依据。

## vllm_ascend/attention/attention_v1.py#L2219-L2234 （main）

```python
            slots = attn_metadata.slot_mapping

            encoder_decoder = self.attn_type == AttentionType.ENCODER_DECODER

            # NZ write path: 5D view + npu_scatter_pa_kv_cache
            block_size = self.vllm_config.cache_config.block_size
            k_cache_layer = self._nz_5d_view(self.key_cache, block_size)
            v_cache_layer = self._nz_5d_view(self.value_cache, block_size)

            torch_npu.npu_scatter_pa_kv_cache(
                key=key[: attn_metadata.num_actual_tokens] if not encoder_decoder else key,
                value=value[: attn_metadata.num_actual_tokens] if not encoder_decoder else value,
                key_cache=k_cache_layer,
                value_cache=v_cache_layer,
                slot_mapping=slots[: attn_metadata.num_actual_tokens] if not encoder_decoder else slots,
            )
```

写入路径：int8 K/V 通过 `npu_scatter_pa_kv_cache` 按 `slot_mapping` 散写进 NZ 5D 视图，不走通用的 reshape_and_cache。图里的写入节点用它。

## vllm_ascend/attention/attention_v1.py#L950-L967 （main）

```python
        extra_args = {}
        if self.enable_c8_quant and layer is not None:
            extra_args = {
                "key_antiquant_scale": layer._c8_k_aq_scale_nz_bnsd,
                "value_antiquant_scale": layer._c8_v_aq_scale_nz_bnsd,
                "key_antiquant_mode": 0,
                "value_antiquant_mode": 0,
                "inner_precise": 1,
            }

            # change key/value shape
            _, block_size, _, _ = self.key_cache.shape  # type: ignore
            key = self._nz_5d_view(self.key_cache, block_size)
            value = self._nz_5d_view(self.value_cache, block_size)

            # TODO: change layerout from BNSD to TND.
            input_layout = "BNSD"
            query = query.unsqueeze(2)
```

图模式（ACL graph 捕获）下的 C8 分支：同样只加 antiquant 参数并把 layout 切成 BNSD。用于说明 C8 不排斥图模式。

## vllm_ascend/quantization/configs/modelslim_config.py#L905-L914 （main）

```python
    def get_kv_quant_dtype(self, layer_name, cache_dtype, model_config):
        if self.enable_fa_quant and self.is_fa_quant_layer(layer_name):
            ori_dtype = model_config.dtype
            quant_dtype = torch.float8_e4m3fn if get_ascend_device_type() == AscendDeviceType.A5 else torch.int8
            # For MLA models like deepseek, we only quantify K cache to ensure accuracy
            if model_config.use_mla:
                return quant_dtype, ori_dtype
            else:
                return quant_dtype, quant_dtype
        return cache_dtype, cache_dtype
```

另一条 KV 量化路线 FAKQuant（`fa_quant_type` 非空）：A5 上是 `float8_e4m3fn`、其余是 int8；MLA 模型只量化 K，V 保持模型 dtype。事实表里「哪些 dtype」那一行与 MLA 只量 K 那条都出自这里。

## vllm_ascend/ascend_config.py#L697-L721 （main）

```python
    @classmethod
    def _check_mooncake_c8_kv_cache_quant(cls, vllm_config: VllmConfig) -> None:
        kv_transfer_config = getattr(vllm_config, "kv_transfer_config", None)
        if kv_transfer_config is None:
            return

        quant_config = getattr(vllm_config, "quant_config", None)
        enable_c8_quant = getattr(quant_config, "enable_c8_quant", False)
        if enable_c8_quant is not True:
            return

        from vllm_ascend.utils import is_gqa_backend, uses_mooncake_connector

        if not is_gqa_backend(vllm_config):
            return

        if not uses_mooncake_connector(kv_transfer_config):
            return

        raise ValueError(
            "MooncakeConnector does not support C8 KV cache quantization on GQA models. "
            "The producer keeps KV cache in bf16 while the consumer allocates int8 KV cache, so raw "
            "Mooncake transfer would reinterpret bf16 bytes as int8. Please disable C8 KV cache quantization "
            "or use MooncakeLayerwiseConnector, which quantizes KV cache before transfer."
        )
```

硬互斥：GQA 模型 + `MooncakeConnector`/`MooncakeConnectorV1` + C8 会在启动时抛 `ValueError`，错误文本本身解释了原因（生产端 bf16、消费端 int8）。`conflicts-with` 那条边的依据。

## vllm_ascend/ascend_config.py#L367-L391 （v0.23.0）

```python
    @classmethod
    def _check_mooncake_c8_kv_cache_quant(cls, vllm_config: "VllmConfig") -> None:
        kv_transfer_config = getattr(vllm_config, "kv_transfer_config", None)
        if kv_transfer_config is None:
            return

        quant_config = getattr(vllm_config, "quant_config", None)
        enable_c8_quant = getattr(quant_config, "enable_c8_quant", False)
        if enable_c8_quant is not True:
            return

        from vllm_ascend.utils import is_gqa_backend, uses_mooncake_connector

        if not is_gqa_backend(vllm_config):
            return

        if not uses_mooncake_connector(kv_transfer_config):
            return

        raise ValueError(
            "MooncakeConnector does not support C8 KV cache quantization on GQA models. "
            "The producer keeps KV cache in bf16 while the consumer allocates int8 KV cache, so raw "
            "Mooncake transfer would reinterpret bf16 bytes as int8. Please disable C8 KV cache quantization "
            "or use MooncakeLayerwiseConnector, which quantizes KV cache before transfer."
        )
```

确认这条互斥两版一致。

## vllm_ascend/models/minimax_m3/msa_m3.py#L638-L646 （main）

```python
class AscendMiniMaxM3SparseBackend(AttentionBackend):
    supported_dtypes: ClassVar[list[torch.dtype]] = [torch.bfloat16, torch.float16]
    supported_kv_cache_dtypes: ClassVar[list[CacheDType]] = [
        "auto",
        "bfloat16",
        "fp8",
        "fp8_e4m3",
        "fp8_e5m2",
    ]
```

全仓唯一声明 `supported_kv_cache_dtypes` 的地方（另一处是同文件的 `AscendMiniMaxM3IndexerBackend`），v0.23.0 全仓无此符号。「`--kv-cache-dtype` 只在 MiniMax-M3 稀疏后端上被显式声明」这条事实与版本差异都出自这里。

## vllm_ascend/platform.py#L1033-L1034 （main）

```python
    if model_config and hasattr(model_config.hf_text_config, "index_topk"):
        vllm_config.cache_config.cache_dtype = str(model_config.dtype).replace("torch.", "")
```

反直觉事实：带 `index_topk` 的模型（DeepSeek 稀疏注意力一类），用户传的 `--kv-cache-dtype` 会被平台静默改写回模型 dtype。

## vllm_ascend/platform.py#L504-L505 （v0.23.0）

```python
        if model_config and hasattr(model_config.hf_text_config, "index_topk"):
            vllm_config.cache_config.cache_dtype = str(model_config.dtype).replace("torch.", "")
```

确认这条覆写两版一致（v0.23.0 在 `check_and_update_config` 方法体内，main 提到了模块级函数里）。

## docs/source/user_guide/feature_guide/quantization.md#L122-L124 （main）

```markdown
## Running Quantized Models

Once you have a quantized model which is generated by **ModelSlim**, you can use vLLM Ascend for inference by specifying the `--quantization ascend` parameter to enable quantization features, while for models quantized by **LLM-Compressor**, it is not necessary to add this parameter.
```

官方文档对 ModelSlim 模型的启动要求：`--quantization ascend`。同时也是「官方量化指南全篇不提 KV cache 量化、不提 `--kv-cache-dtype`」这条观察的落点。
线上地址：<https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/quantization.html>

## docs/source/user_guide/feature_guide/quantization.md#L105-L107 （v0.23.0）

```markdown
## Running Quantized Models

Once you have a quantized model which is generated by **ModelSlim**, you can use vLLM Ascend for inference by specifying the `--quantization ascend` parameter to enable quantization features, while for models quantized by **LLM-Compressor**, it is not necessary to add this parameter.
```

同一句话在 v0.23.0 的位置；文档正文在这一点上两版一致。
线上地址：<https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/quantization.html>

## docs/source/user_guide/feature_guide/quantization.md#L105-L116 （main，v0.23.0 无此节）

````markdown
### 3. Native FP8 checkpoints (no quantization step needed)

Many models are now published directly in FP8, for example [Qwen/Qwen3.8-27B-FP8](https://modelscope.cn/models/Qwen/Qwen3.8-27B-FP8). Their `config.json` carries `"quant_method": "fp8"` together with a `weight_block_size`, meaning every quantized weight is stored as `float8_e4m3fn` plus one `float32` scale per weight block. vLLM Ascend detects and serves these checkpoints as published, so no offline re-quantization is required:

```bash
vllm serve /path/to/Qwen3.8-27B-FP8 --trust-remote-code
```

How the weights are executed depends on the hardware:

- **Ascend 950**: the block scales are re-grouped into MXFP8 at load time, so weights stay at one byte per element and the native FP8 matmul is used.
- **Other Ascend generations**: the block scales are resolved into the model dtype at load time and served by the BF16 matmul. Numerically equivalent to the checkpoint, but plan for roughly twice the weight memory.
````

main 新增的一节，讲的是**权重** FP8，和 KV cache 无关——用来支撑「FP8 checkpoint 不等于 FP8 KV cache」这条常见误解。
线上地址：<https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/quantization.html>
