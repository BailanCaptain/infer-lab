# KV Cache Spec —— 引用的源码片段

## vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L983-L994

```python
    def get_kv_cache_spec(self) -> dict[str, KVCacheSpec]:
        kv_cache_spec = self.model_runner.get_kv_cache_spec()
        extra_config = get_gva_layerwise_config(self.vllm_config.kv_transfer_config)
        if extra_config is not None:
            self._gva_layerwise_memory_info = self._get_layerwise_kv_cache_memory_info(
                kv_cache_spec,
                extra_config,
            )
        if get_ascend_config().sparse_kv_offload_config.enabled:
            # reserve kv_cache_spec for sparse kv offload memory profile usage.
            self.kv_cache_spec = kv_cache_spec
        return kv_cache_spec
```

main 上 worker 层的入口：除了转发给 model runner，还会为 layerwise offload 与 sparse offload 留一份 spec。用于说明版本差异。

## vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L891-L892

```python
    def get_kv_cache_spec(self) -> dict[str, KVCacheSpec]:
        return self.model_runner.get_kv_cache_spec()
```

v0.23.0 上同一个入口是纯转发。与上一段对照给出版本差异。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4947-L4986

```python
    def get_kv_cache_spec(self) -> dict[str, KVCacheSpec]:
        """
        Generates the KVCacheSpec by parsing the kv cache format from each
        Attention module in the static forward context.
        Returns:
            KVCacheSpec: A dictionary mapping layer names to their KV cache
            format. Layers that do not need KV cache are not included.
        """

        if has_ec_transfer() and not get_ec_transfer().is_consumer:
            return {}

        kv_cache_spec: dict[str, KVCacheSpec] = {}
        attn_layers = get_layers_from_vllm_config(self.vllm_config, AttentionLayerBase)
        from vllm.model_executor.models.deepseek_v2 import DeepseekV32IndexerCache

        # NOTE: Must process Attention/MLAAttention before MambaBase to maintain
        # ordering expected by graph parameter update logic in attention backends.
        mamba_layers: dict[str, MambaBase] = {}
        attn_layer_names = set()
        for layer_name, attn_module in attn_layers.items():
            if (isinstance(attn_module, Attention)
                    and (kv_tgt_layer := attn_module.kv_sharing_target_layer_name) is not None):
                # The layer doesn't need its own KV cache and will use that of
                # the target layer. We skip creating a KVCacheSpec for it, so
                # that KV cache management logic will act as this layer does
                # not exist, and doesn't allocate KV cache for the layer. This
                # enables the memory saving of cross-layer kv sharing, allowing
                # a given amount of memory to accommodate longer context lengths
                # or enable more requests to be processed simultaneously.
                self.shared_kv_cache_layers[layer_name] = kv_tgt_layer
                continue
            elif self.use_compress:
                # Skip modules that don't need KV cache (eg encoder-only attention)
                if spec := attn_module.get_kv_cache_spec(self.vllm_config):
                    kv_cache_spec[layer_name] = spec
            elif isinstance(attn_module, Attention):
                if spec := attn_module.get_kv_cache_spec(self.vllm_config):
                    kv_cache_spec[layer_name] = spec
                    attn_layer_names.add(layer_name)
```

main 上 spec 的按层分发：遍历 static forward context 里所有 `AttentionLayerBase`，按模块类型决定写哪种 spec；KV 共享层直接跳过不建 spec。这是「如何按层声明」的主体证据。

## vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4909-L4946

```python
    def get_kv_cache_spec(self) -> dict[str, KVCacheSpec]:
        """
        Generates the KVCacheSpec by parsing the kv cache format from each
        Attention module in the static forward context.
        Returns:
            KVCacheSpec: A dictionary mapping layer names to their KV cache
            format. Layers that do not need KV cache are not included.
        """

        if has_ec_transfer() and get_ec_transfer().is_producer:
            return {}

        kv_cache_spec: dict[str, list[KVCacheSpec]] = defaultdict(list)
        attn_layers = get_layers_from_vllm_config(self.vllm_config, AttentionLayerBase)
        # NOTE: Must process Attention/MLAAttention before MambaBase to maintain
        # ordering expected by graph parameter update logic in attention backends.
        mamba_layers: dict[str, MambaBase] = {}
        attn_layer_names = set()
        for layer_name, attn_module in attn_layers.items():
            if (isinstance(attn_module, Attention)
                    and (kv_tgt_layer := attn_module.kv_sharing_target_layer_name) is not None):
                # The layer doesn't need its own KV cache and will use that of
                # the target layer. We skip creating a KVCacheSpec for it, so
                # that KV cache management logic will act as this layer does
                # not exist, and doesn't allocate KV cache for the layer. This
                # enables the memory saving of cross-layer kv sharing, allowing
                # a given amount of memory to accommodate longer context lengths
                # or enable more requests to be processed simultaneously.
                self.shared_kv_cache_layers[layer_name] = kv_tgt_layer
                continue
            elif self.use_compress:
                # Skip modules that don't need KV cache (eg encoder-only attention)
                if spec := attn_module.get_kv_cache_spec(self.vllm_config):
                    kv_cache_spec[layer_name] = spec
            elif isinstance(attn_module, Attention):
                if spec := attn_module.get_kv_cache_spec(self.vllm_config):
                    kv_cache_spec[layer_name] = spec
                    attn_layer_names.add(layer_name)
```

v0.23.0 上同一段：稠密 GQA 分支逐字相同，说明这条主线两版一致。EC transfer 的早退条件相反（`is_producer` vs `not is_consumer`）。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L5031-L5047

```python
            elif isinstance(attn_module, DeepseekV32IndexerCache):
                # TODO: This mirrors upstream's separated KV/indexer specs for
                # SFA, but keeps Ascend-specific shape/block-size accounting.
                # Remove this special case once the generic vLLM spec/backend
                # path can describe the Ascend SFA indexer layout directly.
                cache_sparse_li_c8 = self.ascend_config.is_sparse_li_c8_layer(layer_name)
                kv_cache_spec[layer_name] = AscendSFAIndexerCacheSpec(
                    block_size=self.block_size,
                    num_kv_heads=1,
                    head_size=self.model_config.hf_text_config.index_head_dim,
                    dtype=self.c8_k_cache_dtype if cache_sparse_li_c8 else self.kv_cache_dtype,
                    cache_dtype_str=self.vllm_config.cache_config.cache_dtype,
                    scale_dim=1 if cache_sparse_li_c8 else 0,
                    scale_dtype=self.c8_k_scale_cache_dtype if cache_sparse_li_c8 else torch.int8,
                    cache_sparse_li_c8=cache_sparse_li_c8,
                    sfa_dcp_replicated_indexer_size=self.sfa_dcp_replicated_indexer_size,
                )
```

main 为 SFA indexer 单独建了一类 spec。用于事实表里的版本差异行。

## vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L5005-L5011

```python
            elif isinstance(attn_module, CacheOnlyAttentionLayer):
                # Only CacheOnlyAttentionLayer (extract_hidden_states draft model)
                # is handled here. Other AttentionLayerBase subclasses such as
                # DeepseekV32IndexerCache are intentionally skipped: on Ascend,
                # the indexer's k_cache is replaced by IndexerWrapper, so its
                # KV cache is unused.
                if spec := attn_module.get_kv_cache_spec(self.vllm_config):
```

v0.23.0 明确跳过 `DeepseekV32IndexerCache`，indexer 的字节被折进 `AscendMLAAttentionSpec.sparse_head_dim`。与上一段对照。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L5076-L5089

```python
        if len(mamba_layers) > 0:
            mamba_page_size_padded = 0
            for layer_name, mamba_module in mamba_layers.items():
                if spec := mamba_module.get_kv_cache_spec(self.vllm_config):
                    kv_cache_spec[layer_name] = spec
                    mamba_page_size_padded = spec.page_size_bytes
            # align attn_page_size to mamba_page_size_padded
            for layer_name in attn_layer_names:
                if kv_cache_spec[layer_name].page_size_bytes < mamba_page_size_padded:  # type: ignore[attr-defined]
                    object.__setattr__(kv_cache_spec[layer_name], "page_size_padded", mamba_page_size_padded)

        if self.sparse_kv_offload_enabled:
            self.kv_cache_spec = kv_cache_spec # reserve for Sparse KV offload usage
        return kv_cache_spec
```

函数收尾：mamba 混合模型下注意力层的页会被 padding 到 mamba 页大小。说明 `page_size_padded` 的来源。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L113-L121

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

GQA 后端声明的 block 形状，首维 2 就是 K 与 V。

## vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L104-L112

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

v0.23.0 上逐字相同，证明形状结论两版一致。

## vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L151-L153

```python
    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]
```

GQA 后端只支持 128 这一个 kernel block size。

## vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L142-L144

```python
    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]
```

v0.23.0 相同。

## vllm-ascend@28bf3a2e:docs/source/user_guide/configuration/additional_config.md#L174-L174

```markdown
| `long_req_block_threshold` | int | `700` | In dynamic mode, a newly added request above this block count activates balancing. The default threshold corresponds to approximately 89,600 tokens when `block_size=128`. |
```

官方文档在别处的参数说明里把 `block_size=128` 当作既定前提（700 × 128 = 89600）。用于佐证 128 是实际生效的块大小。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/worker.py#L1009-L1020

```python
    def initialize_from_config(self, kv_cache_config: KVCacheConfig) -> None:
        """Allocate NPU KV cache with the specified kv_cache_config."""
        ensure_kv_transfer_initialized(self.vllm_config, kv_cache_config)
        if self.vllm_config.model_config.enable_sleep_mode:
            allocator = CaMemAllocator.get_instance()
            context = allocator.use_memory_pool(tag="kv_cache")
        else:
            from contextlib import nullcontext

            context = nullcontext()  # type: ignore
        with context:
            self.model_runner.initialize_kv_cache(kv_cache_config)
```

分配阶段的外层入口：engine 把算好的 `KVCacheConfig` 递进来，worker 再交给 model runner。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L3910-L3938

```python
    def initialize_kv_cache(self, kv_cache_config: KVCacheConfig) -> None:
        """
        Initialize KV cache based on `kv_cache_config`.
        Args:
            kv_cache_config: Configuration for the KV cache, including the KV
            cache size of each layer
        """
        kv_cache_config = deepcopy(kv_cache_config)
        self.kv_cache_config = kv_cache_config
        self._mamba_bufs = None
        self._mamba_copy_bufs = None
        self.may_add_encoder_only_layers_to_kv_cache_config()
        apply_layerwise_kv_cache_plan(kv_cache_config, self.vllm_config)
        self.maybe_add_kv_sharing_layers_to_kv_cache_groups(kv_cache_config)
        # NOTE(cmq): initialize_attn_backend must before using self.attn_groups
        self.initialize_attn_backend(kv_cache_config)
        self.use_hybrid_blocks = len(self.attn_groups) > 1
        # K3's packed layout keeps Mamba specs inside UniformType groups, so the
        # old first-spec scan over attn_groups cannot recognize them.
        self.need_accepted_tokens = kv_cache_config.has_mamba_layers

        self.may_reinitialize_input_batch(kv_cache_config)
        if self.sparse_kv_offload_enabled:
            self.sparse_kv_offload_manager = init_sparse_kv_offload_manager(
                self.vllm_config,
                kv_cache_config,
                self.sparse_kv_offload_config,
            )
        kv_caches = self.initialize_kv_cache_tensors(kv_cache_config)
```

main 上 `initialize_kv_cache` 的主干顺序：改写 config → 选后端 → 重建 input batch → 真正分配张量。

## vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3843-L3865

```python
    def initialize_kv_cache(self, kv_cache_config: KVCacheConfig) -> None:
        """
        Initialize KV cache based on `kv_cache_config`.
        Args:
            kv_cache_config: Configuration for the KV cache, including the KV
            cache size of each layer
        """
        kv_cache_config = deepcopy(kv_cache_config)
        self.kv_cache_config = kv_cache_config
        self._mamba_bufs = None
        self._mamba_copy_bufs = None
        self.may_add_encoder_only_layers_to_kv_cache_config()
        self.maybe_add_kv_sharing_layers_to_kv_cache_groups(kv_cache_config)
        # NOTE(cmq): initialize_attn_backend must before using self.attn_groups
        self.initialize_attn_backend(kv_cache_config)
        self.use_hybrid_blocks = len(self.attn_groups) > 1
        # NOTE: Currently, we determine whether we need `num_accepted_tokens` through `MambaSpec`.
        self.need_accepted_tokens = any(
            [isinstance(attn_group[0].kv_cache_spec, MambaSpec) for attn_group in self.attn_groups]
        )

        self.may_reinitialize_input_batch(kv_cache_config)
        kv_caches = self.initialize_kv_cache_tensors(kv_cache_config)
```

v0.23.0 上同一主干：没有 `apply_layerwise_kv_cache_plan` 与 sparse offload manager 两步，其余顺序一致。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L3986-L4004

```python
    def initialize_kv_cache_tensors(self, kv_cache_config: KVCacheConfig) -> dict[str, torch.Tensor]:
        """
        Initialize the memory buffer for KV cache.

        Args:
            kv_cache_config: The KV cache config
        Returns:
            Dict[str, torch.Tensor]: A map between layer names to their
            corresponding memory buffer for KV cache.
        """
        # Initialize the memory buffer for KV cache
        kv_cache_raw_tensors = self._allocate_kv_cache_tensors(kv_cache_config)
        # Change the memory buffer to the desired shape
        kv_caches = self._reshape_kv_cache_tensors(kv_cache_config, kv_cache_raw_tensors)

        # Set up cross-layer KV cache sharing
        for layer_name, target_layer_name in self.shared_kv_cache_layers.items():
            logger.debug("%s reuses KV cache of %s", layer_name, target_layer_name)
            kv_caches[layer_name] = kv_caches[target_layer_name]
```

分配的两段式结构：先按字节数申请原始 buffer，再 view 成目标形状；KV 共享层在这里补回指针。v0.23.0 的 L3917-L3935 结构相同。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4294-L4345

```python
                    current_kv_cache_spec = layer_kv_cache_spec[layer_name]
                    assert isinstance(current_kv_cache_spec, AttentionSpec)
                    current_sparse_sfa_c8 = self.use_sparse and kv_cache_spec_uses_sparse_sfa_c8(
                        current_kv_cache_spec
                    )

                    if current_sparse_sfa_c8:
                        k_tensor_size = kv_cache_tensor.size
                        v_tensor_size = None
                    else:
                        k_dim, v_dim = self._get_attention_kv_cache_dims(layer_name, current_kv_cache_spec)
                        assert k_dim > 0 and v_dim > 0
                        kv_head_dim_list = [
                            k_dim,
                            v_dim,
                        ]
                        if not self.use_sparse and enable_fa_quant(self.vllm_config):
                            k_tensor_split_factor, v_tensor_split_factor = (
                                self.vllm_config.quant_config.get_kv_quant_split_factor(layer_name, kv_head_dim_list)
                            )
                        else:
                            k_tensor_split_factor, v_tensor_split_factor = calc_split_factor(kv_head_dim_list)
                        k_tensor_size = int(kv_cache_tensor.size // k_tensor_split_factor)
                        v_tensor_size = int(kv_cache_tensor.size // v_tensor_split_factor)
                    if self.sparse_kv_offload_enabled:
                        assert self.use_sparse, "Sparse KV offload only support sparse attention."
                        assert not current_sparse_sfa_c8, "Sparse KV offload do not support sparse SFA C8."
                        assert v_tensor_size is not None
                        raw_tensors = allocate_kv_cache_tensors_for_sparse_kv_offload(
                            k_tensor_size,
                            v_tensor_size,
                            alignment,
                            self.tp_rank,
                            self.sparse_kv_offload_config.keep_device_kv_cache,
                            self._allocate_int8_cache_tensor,
                        )
                        assert len(kv_cache_tensor.shared_by) == 1, "Sparse KV offload do not support HMA."
                        kv_cache_raw_tensors[layer_name] = raw_tensors
                        continue
                    # Allocate raw int8 tensors. Even bf16/fp16 KV cache entries
                    # are allocated as int8 raw bytes first and then viewed as
                    # the target dtype in _reshape_kv_cache_tensors.
                    v_tensor = None
                    k_tensor = self._allocate_int8_cache_tensor(
                        k_tensor_size,
                        alignment,
                    )
                    if v_tensor_size is not None:
                        v_tensor = self._allocate_int8_cache_tensor(
                            v_tensor_size,
                            alignment,
                        )
```

main 上稠密注意力层的分配分支：按 K/V 头维之比把 `kv_cache_tensor.size` 切成两块，各自以 int8 原始字节申请。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4347-L4354

```python
                    for layer_name_inner in kv_cache_tensor.shared_by:
                        # shared the attn kvcache for all shared layers
                        if "attn" in layer_name_inner and "linear_attn" not in layer_name_inner:
                            if current_sparse_sfa_c8:
                                kv_cache_raw_tensors[layer_name_inner] = (k_tensor,)
                            else:
                                assert v_tensor is not None
                                kv_cache_raw_tensors[layer_name_inner] = (k_tensor, v_tensor)
```

稠密路径最终登记的是 `(k_tensor, v_tensor)` 二元组，而不是一整块。

## vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4212-L4232

```python
                    else:
                        k_dim, v_dim = self._get_attention_kv_cache_dims(layer_name, current_kv_cache_spec)
                        assert k_dim > 0 and v_dim > 0
                        kv_head_dim_list = [
                            k_dim,
                            v_dim,
                        ]
                        if enable_fa_quant(self.vllm_config):
                            k_tensor_split_factor, v_tensor_split_factor = (
                                self.vllm_config.quant_config.get_kv_quant_split_factor(layer_name, kv_head_dim_list)
                            )
                        else:
                            k_tensor_split_factor, v_tensor_split_factor = calc_split_factor(kv_head_dim_list)

                    if not (self.use_sparse and current_sparse_sfa_c8):
                        k_tensor_size = int(kv_cache_tensor.size // k_tensor_split_factor)
                        v_tensor_size = (
                            int(kv_cache_tensor.size // v_tensor_split_factor)
                            if v_tensor_split_factor is not None
                            else None
                        )
```

v0.23.0 上稠密分支的同一段逻辑，切分公式一致。

## vllm-ascend@28bf3a2e:vllm_ascend/utils.py#L1380-L1382

```python
def calc_split_factor(num_list: list[int]):
    total = sum(num_list)
    return [total / num for num in num_list]
```

切分因子的定义：GQA 下 `[head_size, head_size]` 得到 `[2.0, 2.0]`。v0.23.0 的 L1611-L1613 逐字相同。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4054-L4073

```python
    def _get_attention_kv_cache_dims(self, layer_name: str, kv_cache_spec: AttentionSpec) -> tuple[int, int]:
        if isinstance(kv_cache_spec, AscendMLAAttentionSpec):
            attn_layers = get_layers_from_vllm_config(
                self.vllm_config,
                AttentionLayerBase,
                [layer_name],
            )
            attn_layer = attn_layers[layer_name]
            if isinstance(attn_layer, MLAAttention):
                # DeepSeek MLA: K=kv_lora_rank, V=qk_rope_head_dim
                return attn_layer.kv_lora_rank, attn_layer.qk_rope_head_dim
            # CacheOnlyAttentionLayer uses AscendMLAAttentionSpec but isn't MLAAttention
            if isinstance(attn_layer, CacheOnlyAttentionLayer):
                return kv_cache_spec.head_size, kv_cache_spec.head_size
            raise TypeError(
                f"Expected MLAAttention layer for {layer_name}, got {type(attn_layer).__name__}."
            )

        head_size_v = kv_cache_spec.head_size_v if hasattr(kv_cache_spec, "head_size_v") else kv_cache_spec.head_size
        return kv_cache_spec.head_size, head_size_v
```

K 维与 V 维的来源：GQA 走最后两行，两者都等于 `head_size`，所以切分因子是 2 : 2。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4647-L4704

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
                    else:
                        # k_cache: nope_cache    v_cache: rope_cache
                        mla_num_blocks, mla_block_size, num_kv_heads, _ = kv_cache_shape
                        k_dim, v_dim = self._get_attention_kv_cache_dims(layer_name, current_kv_cache_spec)
                        k_shape = (
                            mla_num_blocks,
                            mla_block_size,
                            num_kv_heads,
                            k_dim,
                        )
                        if current_sparse_sfa_c8:
                            k_shape = (
                                mla_num_blocks,
                                mla_block_size,
                                num_kv_heads,
                                current_kv_cache_spec.head_size,
                            )
                            v_dim = 0
                        v_shape = (
                            mla_num_blocks,
                            mla_block_size,
                            num_kv_heads,
                            v_dim,
                        )
                    k_cache_dtype = v_cache_dtype = current_kv_cache_spec.dtype
                    if enable_fa_quant(self.vllm_config):
                        k_cache_dtype, v_cache_dtype = self.vllm_config.quant_config.get_kv_quant_dtype(
                            layer_name, current_kv_cache_spec.dtype, self.model_config
                        )

                    if current_sparse_sfa_c8:
                        k_cache_dtype = self.c8_k_cache_dtype

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

reshape 阶段：GQA 的 K、V 各被 view 成 `(num_blocks, block_size, num_kv_heads, head_size)`，也就是 `get_kv_cache_shape` 去掉首维 2。v0.23.0 的 L4592-L4650 结构一致。

## vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L4604-L4614

```python
                    assert sum_page_size_bytes % current_kv_cache_spec.page_size_bytes == 0
                    num_blocks = sum_page_size_bytes // current_kv_cache_spec.page_size_bytes

                    # `num_blocks` is the number of blocks the model runner can use.
                    # `kv_cache_config.num_blocks` is the number of blocks that
                    # KVCacheManager may allocate.
                    # Since different GPUs may have different number of layers and
                    # different memory capacities, `num_blocks` can be different on
                    # different GPUs, and `kv_cache_config.num_blocks` is set to
                    # the min of all `num_blocks`. Verify it here.
                    assert num_blocks >= kv_cache_config.num_blocks
```

把「K 字节 + V 字节」除以 `page_size_bytes` 反推块数，并与调度器侧的 `num_blocks` 对账。这是推导每 token 字节公式的关键约束。

## vllm-ascend@28bf3a2e:vllm_ascend/core/kv_cache_interface.py#L50-L65

```python
    @property
    def storage_block_size(self) -> int:
        """Return the physical block size consumed by Ascend kernels."""
        return self.block_size // self.compress_ratio

    @property
    def real_page_size_bytes(self) -> int:
        return (
            self.storage_block_size
            * self.num_kv_heads
            * (self.head_size * get_dtype_size(self.dtype) + self.scale_dim * get_dtype_size(self.scale_dtype))
        )

    @property
    def unpadded_page_size_bytes(self) -> int:
        return self.real_page_size_bytes
```

main 上 MLA spec 的页字节：属性名是 `real_page_size_bytes`，块大小要先除以 `compress_ratio`。

## vllm-ascend@2c59ff10:vllm_ascend/core/kv_cache_interface.py#L101-L121

```python
        if (
            self.sparse_head_dim is not None
            and len(self.sparse_head_dim) == 3
            and self.sfa_dcp_replicated_indexer_size > 1
        ):
            k_head_dim, v_head_dim, index_head_dim = self.sparse_head_dim
            replicated_head_size = k_head_dim + v_head_dim + index_head_dim * self.sfa_dcp_replicated_indexer_size
            return (
                self.block_size
                * self.num_kv_heads
                * (
                    replicated_head_size * get_dtype_size(self.dtype)
                    + self.scale_dim * get_dtype_size(self.scale_dtype)
                )
            )

        return (
            self.block_size
            * self.num_kv_heads
            * (self.head_size * get_dtype_size(self.dtype) + self.scale_dim * get_dtype_size(self.scale_dtype))
        )
```

v0.23.0 上 MLA spec 直接覆写 `page_size_bytes`，且把 indexer 的字节算在同一个属性里。与上一段对照说明版本差异。
