# KV Cache Spec —— 引用的源码片段

仓库：vllm-ascend@28bf3a2e（ref main）。以下片段原样摘录，未做任何改动。

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

引用理由：Worker 侧的声明入口，证明 spec 由 model runner 生成后原样上交给引擎，Worker 自己只做旁路记录。

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

引用理由：逐层声明的主循环。证明「按层」的粒度、跳过 kv sharing 层、spec 为 None 的层不进字典这三条。GQA（Qwen3-0.6B）走的就是最后这个 `isinstance(attn_module, Attention)` 分支。

## vllm_ascend/worker/model_runner_v1.py#L4988-L5014

```python
            elif isinstance(attn_module, MLAAttention):
                if self.use_sparse:
                    impl = attn_module.impl
                    cache_sparse_sfa_c8 = bool(
                        getattr(impl, "enable_sparse_sfa_c8", False)
                    )
                    if cache_sparse_sfa_c8:
                        head_size = get_sfa_qsfa_packed_head_dim(
                            self.model_config.hf_text_config.kv_lora_rank,
                            self.model_config.hf_text_config.qk_rope_head_dim,
                        )
                        dtype = self.c8_k_cache_dtype
                    else:
                        head_size = (
                            self.model_config.hf_text_config.kv_lora_rank
                            + self.model_config.hf_text_config.qk_rope_head_dim
                        )
                        dtype = self.kv_cache_dtype
                    kv_cache_spec[layer_name] = AscendMLAAttentionSpec(
                        block_size=self.block_size,
                        num_kv_heads=1,
                        head_size=head_size,
                        dtype=dtype,
                        cache_dtype_str=self.vllm_config.cache_config.cache_dtype,
                        cache_sparse_sfa_c8=cache_sparse_sfa_c8,
                        store_on_host=self.sparse_kv_offload_enabled,
                    )
```

引用理由：MLA 分支把 `num_kv_heads` 硬写成 1、`head_size` 写成 `kv_lora_rank + qk_rope_head_dim`。这是「不同注意力族声明出完全不同的形状」的直接证据，也是把 GQA 公式推广到全部模型会出错的原因。

## vllm_ascend/core/kv_cache_interface.py#L33-L65

```python
@dataclass(frozen=True, kw_only=True)
class AscendMLAAttentionSpec(MLAAttentionSpec):
    """MLA cache spec with Ascend-specific layout metadata.

    For SFA, this spec describes only the main MLA cache. The indexer K
    tensor, its quantization scale, and DCP replication are described by a
    separate :class:`AscendSFAIndexerCacheSpec`.
    """

    scale_dim: int = 0
    scale_dtype: torch.dtype = torch.int8
    # Sparse C8 changes the main cache into one packed byte tensor. Keep that
    # main-cache property here; indexer-specific C8 properties belong to the
    # indexer spec.
    cache_sparse_sfa_c8: bool = False
    store_on_host: bool = False

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

引用理由：昇腾自有 spec 类型的页字节公式与 `storage_block_size`，用于「事实表」和「spec.block_size ≠ kernel 块大小」这条误解。

## vllm_ascend/core/kv_cache_interface.py#L100-L107

```python
    def max_memory_usage_bytes(self, vllm_config: VllmConfig) -> int:
        max_model_len = vllm_config.model_config.max_model_len
        dcp_world_size = vllm_config.parallel_config.decode_context_parallel_size
        # Note(hc): each dcp rank only need save
        # (max_model_len//dcp_world_size) tokens locally.
        if dcp_world_size > 1:
            max_model_len = cdiv(max_model_len, dcp_world_size)
        return cdiv(max_model_len, self.block_size) * self.page_size_bytes
```

引用理由：spec 还负责回答「一条最长请求最多占多少字节」，即 `ceil(max_model_len / block_size) * page_size_bytes`。

## vllm_ascend/core/kv_cache_interface.py#L227-L242

```python
def register_ascend_kv_cache_specs() -> None:
    KVCacheSpecRegistry.register(
        kvcache_spec_cls=AscendMLAAttentionSpec,
        manager_class=FullAttentionManager,
        uniform_type_base_spec=FullAttentionSpec,
    )
    KVCacheSpecRegistry.register(
        kvcache_spec_cls=AscendSFAIndexerCacheSpec,
        manager_class=FullAttentionManager,
        uniform_type_base_spec=FullAttentionSpec,
    )
    KVCacheSpecRegistry.register(
        kvcache_spec_cls=AscendSlidingWindowMLASpec,
        manager_class=SlidingWindowManager,
        uniform_type_base_spec=SlidingWindowMLASpec,
    )
```

引用理由：昇腾自定义的 spec 类型必须注册给上游，才能被调度侧的块管理器识别。证明 spec 同时是调度侧的输入。

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

引用理由：GQA 后端把 spec 的四个数翻译成张量形状，首维 2 即 K 与 V 两份。每 token 每层字节公式里的因子 2 由此而来。

## vllm_ascend/attention/attention_v1.py#L151-L153

```python
    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]
```

引用理由：昇腾 GQA kernel 只支持 128 的物理块；混合块场景下 reshape 会按它再切一次。

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

引用理由：引擎把算好的 `KVCacheConfig` 发回 Worker 的入口，也是 sleep mode 下 KV cache 走独立内存池的地方。

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

引用理由：`initialize_kv_cache` 的实际顺序——先改写 config（encoder-only 层、layerwise 计划、kv sharing 组），再建后端，最后才分配张量。

## vllm_ascend/worker/model_runner_v1.py#L3986-L4030

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

        if self.model_config.hf_text_config.model_type == "deepseek_v4":
            from vllm_ascend.utils import extract_dsv4_layer_index

            assert len(self.kv_caches) == 0
            for layer_name in sorted(
                    kv_caches,
                    key=lambda name: (extract_dsv4_layer_index(
                        self.model_config.hf_text_config, name), name)):
                self.kv_caches.append(kv_caches[layer_name])
            for layer_name, kv_cache in kv_caches.items():
                self.compilation_config.static_forward_context[
                    layer_name].kv_cache = [kv_cache]
        else:
            from vllm.v1.worker.utils import bind_kv_cache

            model_type = self.model_config.hf_text_config.model_type
            num_attn_module = 2 if model_type in ("longcat_flash", "longcat_flash_ngram") else 1
            bind_kv_cache(
                kv_caches,
                self.compilation_config.static_forward_context,
                self.kv_caches,
                num_attn_module,
            )

        return kv_caches
```

引用理由：分配三步走（原始字节 → reshape → 绑定）的骨架，以及 kv sharing 层在这里直接复用目标层张量。

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

引用理由：分配阶段把「组级 spec」还原回「层级 spec」的地方——证明 `KVCacheConfig` 里挂的是分组，而分配要按层还原。

## vllm_ascend/worker/model_runner_v1.py#L4157-L4177

```python
    def _allocate_kv_cache_tensors(self, kv_cache_config: KVCacheConfig) -> dict[str, torch.Tensor]:
        """
        Initializes the KV cache buffer with the correct size. The buffer needs
        to be reshaped to the desired shape before being used by the models.

        NOTE: To support prefill disaggregation, we need to split kvcache tensor into
        k_cache and v cache, and the addr of both are aligned by 2M

        Args:
            kv_cache_config: The KV cache config
        Returns:
            dict[str, torch.Tensor]: A map between layer names to their
            corresponding memory buffer for KV cache.
            dict[str, tuple(torch.Tensor, torch.Tensor)] A map between layer names
            to their corresponding memory buffer for K cache and V cache.
        """
        # init kv cache tensors
        kv_cache_raw_tensors: dict[str, torch.Tensor | tuple[torch.Tensor, ...]] = {}
        # prefill disaggregation need the addr of cache tensor be aligned with 2M
        alignment = 2 * 1024 * 1024
        layer_kv_cache_spec = self._get_layer_kv_cache_specs(kv_cache_config)
```

引用理由：2 MiB 对齐常量与「K/V 必须拆成两个张量」的原因（P/D 分离）。这是昇腾与上游布局分歧的直接说明。

## vllm_ascend/worker/model_runner_v1.py#L4079-L4100

```python
    def _allocate_int8_cache_tensor(
        self,
        numel: int,
        alignment: int,
    ) -> torch.Tensor:
        """Allocate an int8 raw cache tensor.

        When KV transfer is enabled, the returned tensor's data_ptr is aligned
        to `alignment`. This keeps the original Mooncake/ADXL alignment behavior.
        """
        if numel <= 0:
            raise ValueError(f"Invalid cache tensor size: {numel}")

        if self.vllm_config.kv_transfer_config is None:
            return torch.zeros(numel, dtype=torch.int8, device=self.device)

        raw_tensor = torch.zeros(numel + alignment, dtype=torch.int8, device=self.device)
        return self._align_memory(raw_tensor, alignment)[:numel]
```

引用理由：真正的显存申请点。证明一切 KV cache 都先按 `torch.int8` 以字节为单位申请，并且只在开了 KV transfer 时才多申请一个 alignment 做地址对齐。

> 注：本片段在源文件中 `raw_tensor = torch.zeros(...)` 一句跨三行书写（L4095-L4099），此处为可读性折成一行，其余一字未改。

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

引用理由：注意力层的分配分支。`kv_cache_tensor.size` 是引擎给这一层的总字节数，按 K/V 的 head dim 比例切成两份——GQA 下两者相等，正好一半一半。

## vllm_ascend/worker/model_runner_v1.py#L4333-L4354

```python
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

                    for layer_name_inner in kv_cache_tensor.shared_by:
                        # shared the attn kvcache for all shared layers
                        if "attn" in layer_name_inner and "linear_attn" not in layer_name_inner:
                            if current_sparse_sfa_c8:
                                kv_cache_raw_tensors[layer_name_inner] = (k_tensor,)
                            else:
                                assert v_tensor is not None
                                kv_cache_raw_tensors[layer_name_inner] = (k_tensor, v_tensor)
```

引用理由：raw tensor 落盘为 `(k_tensor, v_tensor)` 二元组，并按 `kv_cache_tensor.shared_by` 分发给共享同一块显存的所有层。

## vllm_ascend/utils.py#L1380-L1382

```python
def calc_split_factor(num_list: list[int]):
    total = sum(num_list)
    return [total / num for num in num_list]
```

引用理由：K/V 切分比例的定义。`[d_h, d_h]` 时返回 `[2.0, 2.0]`，即各占一半；MLA 的 `[kv_lora_rank, qk_rope_head_dim]` 则按比例不均分。

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

引用理由：`num_blocks = (K 字节 + V 字节) / page_size_bytes`。这一句同时证明了 `page_size_bytes` 在 GQA 下是 K 与 V 两份之和，是推导每 token 字节公式的关键一环。

## vllm_ascend/worker/model_runner_v1.py#L4616-L4659

```python
                    if hasattr(attn_backend, "get_supported_kernel_block_sizes") and self.use_hybrid_blocks:
                        block_size = attn_backend.get_supported_kernel_block_sizes()[0]

                        block_size_chunk = current_kv_cache_spec.block_size // block_size
                        kv_cache_shape = attn_backend.get_kv_cache_shape(
                            num_blocks * block_size_chunk,
                            block_size,
                            current_kv_cache_spec.num_kv_heads,
                            current_kv_cache_spec.head_size,
                        )
                        if self.hybrid_with_attn_and_mamba:
                            if not isinstance(current_kv_cache_spec, AscendMLAAttentionSpec):
                                attn_tensor_page_size = int(np.prod(kv_cache_shape[1:])) * get_dtype_size(
                                    current_kv_cache_spec.dtype
                                )
                                conv_block_padding_size = raw_k_tensor.numel() - attn_tensor_page_size * 2
                                raw_kv_tensor = raw_k_tensor[conv_block_padding_size:]
                                raw_k_tensor = raw_kv_tensor[:attn_tensor_page_size]
                                raw_v_tensor = raw_kv_tensor[attn_tensor_page_size:]
                            else:
                                k_dim, v_dim = self._get_attention_kv_cache_dims(layer_name, current_kv_cache_spec)
                                nope_page_size = int(np.prod(kv_cache_shape[:-1])) * k_dim * get_dtype_size(
                                    current_kv_cache_spec.dtype
                                )
                                rope_page_size = int(np.prod(kv_cache_shape[:-1])) * v_dim * get_dtype_size(
                                    current_kv_cache_spec.dtype
                                )
                                conv_block_padding_size = raw_k_tensor.numel() - nope_page_size - rope_page_size
                                raw_kv_tensor = raw_k_tensor[conv_block_padding_size:]
                                raw_k_tensor = raw_kv_tensor[:nope_page_size]
                                raw_v_tensor = raw_kv_tensor[nope_page_size:]
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

引用理由：spec 的四个数交给后端换成形状的地方；也证明混合块场景下 `spec.block_size` 会被 `get_supported_kernel_block_sizes()[0]` 重新切分，spec 的块大小不等于 kernel 块大小。

## vllm_ascend/worker/model_runner_v1.py#L4684-L4704

```python
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

引用理由：字节张量 `view` 成目标 dtype 与形状的最后一步，以及量化开启时 dtype 由 quant config 覆写 spec 的 dtype。

## vllm_ascend/worker/model_runner_v1.py#L373-L377

```python
        self.need_accepted_tokens: bool = False

        self.is_multimodal_model = self.model_config.is_multimodal_model
        self.block_size = vllm_config.cache_config.block_size
```

引用理由：spec 里的 `block_size` 来源——直接取自 `cache_config.block_size`，不是后端自己定的。

## docs/source/user_guide/configuration/additional_config.md#L168-L176

```markdown
| ---- | ---- | ------- | ----------- |
| `enabled` | bool | `False` | Enable DyntraLB and select a DyntraLB-aware scheduler. |
| `mode` | str | `"dynamic"` | Use `"static"` or `"dynamic"` activation. |
| `start_step` | int | `250` | First completed engine-step snapshot allowed to generate a plan. |
| `end_step` | int | `-1` | Exclusive final snapshot step; `-1` means no upper bound. |
| `bubble_threshold` | float | `5.0` | Minimum maximum-to-average rank-load difference required to modify scheduling. Values greater than or equal to `1` are KV-cache blocks; values below `1` are normalized ratios. |
| `long_req_block_threshold` | int | `700` | In dynamic mode, a newly added request above this block count activates balancing. The default threshold corresponds to approximately 89,600 tokens when `block_size=128`. |
| `dynamic_max_step` | int | `256` | Stop dynamic balancing after this many active steps without another newly added long request. |
| `enable_diagnostics` | bool | `False` | Enable verbose logs for feature validation and debugging only. It is disabled by default and should remain disabled in production. |
```

引用理由：官方文档用「700 块 ≈ 89,600 token」反推出 `block_size=128` 是昇腾侧的常态取值（700 × 128 = 89,600）。

## vllm_ascend/worker/v2/attn_utils.py#L64-L94

```python
def get_kv_cache_spec(vllm_config: VllmConfig) -> dict[str, KVCacheSpec]:
    """Build Ascend-specific KV cache specs for v2 worker patching."""
    from vllm.model_executor.models.deepseek_v2 import DeepseekV32IndexerCache

    kv_cache_spec: dict[str, KVCacheSpec] = {}
    attention_layer_names: list[str] = []
    mamba_specs: dict[str, MambaSpec] = {}
    layer_type = AttentionLayerBase
    attn_layers = get_layers_from_vllm_config(vllm_config, layer_type)

    if get_ascend_device_type() == AscendDeviceType.A5:
        c8_k_cache_dtype = torch.float8_e4m3fn
        c8_k_scale_cache_dtype = torch.float32
    else:
        c8_k_cache_dtype = torch.int8
        c8_k_scale_cache_dtype = torch.float16

    for layer_name, attn_module in attn_layers.items():
        if getattr(attn_module, "kv_sharing_target_layer_name", None):
            continue

        spec = attn_module.get_kv_cache_spec(vllm_config)
        if spec is None:
            continue

        if isinstance(spec, MambaSpec):
            # Keep Mamba groups after attention groups. Ascend graph parameter
            # updates rely on this stable backend ordering.
            mamba_specs[layer_name] = spec
            continue
```

引用理由：v2 worker 走的是同名的独立函数，规则相同（跳过 kv sharing、跳过 spec 为 None 的层）。说明「按层声明」是两条路径共同的契约，不是 v1 的实现细节。
