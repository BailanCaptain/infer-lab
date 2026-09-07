# KV Cache Spec — 源码片段

## vllm_ascend/worker/worker.py#L983-L994

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

引用理由：Worker 侧的 `get_kv_cache_spec` 只是转发给 model runner，说明「按层声明」这件事发生在 model runner 里，Worker 只额外留一份给 sparse offload 用。

## vllm_ascend/worker/worker.py#L1009-L1020

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

引用理由：这是「声明 → 分配」两段式的第二段入口，engine 把算好的 `KVCacheConfig` 发回 Worker 才真正分配显存。

## vllm_ascend/worker/model_runner_v1.py#L374-L376

```python
        self.is_multimodal_model = self.model_config.is_multimodal_model
        self.block_size = vllm_config.cache_config.block_size
```

引用理由：spec 里的 `block_size` 直接来自 `cache_config.block_size`，不是 runner 自己算的。

## vllm_ascend/utils.py#L1171-L1179

```python
    cache_config = vllm_config.cache_config
    scheduler_config = vllm_config.scheduler_config
    model_config = vllm_config.model_config

    if not cache_config:
        return

    if cache_config.block_size is None:
        cache_config.block_size = 128
```

引用理由：给出 Ascend 上 `block_size` 的默认值 128，是 page 字节数计算的输入之一。

## vllm_ascend/worker/model_runner_v1.py#L4947-L4986

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

引用理由：这是「按层声明」的主体：遍历 static forward context 里的注意力层，逐层产出一个 spec；不需要 KV 的层（返回 None、跨层共享）直接不进字典。

## vllm_ascend/worker/model_runner_v1.py#L5076-L5085

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
```

引用理由：说明混合模型里 attention 层的 page 会被 padding 到 mamba page 大小，即 spec 声明的字节数不一定等于实际占用字节数。

## vllm_ascend/core/kv_cache_interface.py#L50-L61

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
```

引用理由：Ascend 自己重写 page 字节数的地方（MLA spec），展示 page_size_bytes 的通用构成：block_size × num_kv_heads × 每 head 字节。

## vllm_ascend/attention/attention_v1.py#L114-L121

```python
    def get_kv_cache_shape(
        num_blocks: int,
        block_size: int,
        num_kv_heads: int,
        head_size: int,
        cache_dtype_str: str = "",
    ) -> tuple[int, ...]:
        return (2, num_blocks, block_size, num_kv_heads, head_size)
```

引用理由：普通 attention backend 声明的 block 形状，首维 2 就是 K 与 V 两份。

## vllm_ascend/worker/model_runner_v1.py#L3910-L3938

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

引用理由：`initialize_kv_cache` 的职责顺序：先按 config 定 attention backend 与 input batch，再交给 `initialize_kv_cache_tensors` 分配张量。

## vllm_ascend/worker/model_runner_v1.py#L3986-L4000

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
```

引用理由：分配张量的两步骨架——先按字节数申请裸 buffer，再 view 成目标形状。

## vllm_ascend/worker/model_runner_v1.py#L4032-L4052

```python
    def _get_layer_kv_cache_specs(self, kv_cache_config: KVCacheConfig) -> dict[str, KVCacheSpec]:
        compilation_config = getattr(self, "compilation_config", None)
        if compilation_config is None:
            compilation_config = getattr(self.vllm_config, "compilation_config", None)
        static_forward_context = getattr(compilation_config, "static_forward_context", None)

        layer_kv_cache_spec: dict[str, KVCacheSpec] = {}
        for group_kv_cache_spec in kv_cache_config.kv_cache_groups:
            group_spec = group_kv_cache_spec.kv_cache_spec
            for layer_name in group_kv_cache_spec.layer_names:
                if isinstance(group_spec, UniformTypeKVCacheSpecs):
                    layer_kv_cache_spec[layer_name] = group_spec.kv_cache_specs[layer_name]
                else:
                    layer_kv_cache_spec[layer_name] = group_spec
                if static_forward_context is not None:
                    attn_layer = static_forward_context.get(layer_name)
                    if isinstance(attn_layer, AttentionLayerBase):
                        spec = attn_layer.get_kv_cache_spec(self.vllm_config)
                        if isinstance(spec, AscendSFAIndexerCacheSpec):
                            layer_kv_cache_spec[layer_name] = spec
        return layer_kv_cache_spec
```

引用理由：分配阶段把 group 级的 spec 摊回到每一层，得到 layer_name → spec 的映射，后面所有字节数计算都用它。

## vllm_ascend/worker/model_runner_v1.py#L4288-L4317

```python
                elif "attn" in layer_name and layer_name not in kv_cache_raw_tensors and not use_mamba:
                    # NOTE: We need to init k cache tensor (nope cache tensor in mla) and
                    # v cache tensor (rope cache tensor in mla) separately to support prefill disaggregation,
                    # as it only support the 0-dim of kv_cache is `num_blocks`.
                    # For deepseek mla, we need to spilt cache tensor accrodding to the nope head dim
                    # and rope head dim.
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
```

引用理由：普通注意力层的分配路径：K 和 V 拆成两个独立张量，按 head 维比例切分 `kv_cache_tensor.size` 字节。

## vllm_ascend/utils.py#L1380-L1382

```python
def calc_split_factor(num_list: list[int]):
    total = sum(num_list)
    return [total / num for num in num_list]
```

引用理由：K/V 切分因子的定义；对 MHA/GQA（k_dim == v_dim）结果是 [2.0, 2.0]，即各占一半。

## vllm_ascend/worker/model_runner_v1.py#L4598-L4614

```python
                    else:
                        raw_k_tensor, raw_v_tensor = kv_cache_raw_tensors[  # type: ignore
                            layer_name
                        ]
                        sum_page_size_bytes = raw_k_tensor.numel() + raw_v_tensor.numel()
                    assert raw_k_tensor is not None
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

引用理由：`num_blocks = (K 字节 + V 字节) / page_size_bytes`，这条断言反过来钉死了 page_size_bytes 必须同时覆盖 K 与 V。

## vllm_ascend/worker/model_runner_v1.py#L4647-L4659

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

引用理由：非 MLA 路径里 K/V 各自的形状是 `get_kv_cache_shape` 去掉首维 2 之后的 4 维形状。

## vllm_ascend/worker/model_runner_v1.py#L4693-L4704

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

引用理由：最终每层拿到的是 `(k_cache, v_cache)` 二元组，而不是一个合并张量；int8 裸 buffer 在这里 `view` 成目标 dtype。

## vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L608-L619

```python
        kv_head_num = self.topk_buffers_k[0].size(-2)
        head_dim_k = self.topk_buffers_k[0].size(-1)
        head_dim_v = self.topk_buffers_v[0].size(-1)
        dtype = self.topk_buffers_k[0].dtype
        assert kv_head_num == 1, "Sparse KV offload only support sfa(mla)"
        if dtype != torch.bfloat16:
            raise ValueError(
                "Sparse KV offload requires a BF16 main SFA cache; sparse LI "
                "C8 is supported only for the device-resident indexer cache."
            )
        self.token_size_bytes_k = kv_head_num * head_dim_k * dtype.itemsize
        self.token_size_bytes_v = kv_head_num * head_dim_v * dtype.itemsize
```

引用理由：仓库内唯一显式写出「每 token 每层 KV 字节」的地方，形式是 `num_kv_heads × head_dim × dtype.itemsize`，K 与 V 分开算。
