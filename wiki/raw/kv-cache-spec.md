# KV Cache Spec —— 引用的源码片段

全部来自 vllm-ascend@28bf3a2e（ref main）。

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

Worker 侧的 `get_kv_cache_spec` 只是转发给 model runner，用来说明「声明」这一步的入口在 worker、实现在 runner。

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

「分配」这一步的入口：引擎把算好的 `KVCacheConfig` 发回 worker，worker 再调 runner 的 `initialize_kv_cache`；sleep mode 下分配发生在 `CaMemAllocator` 的 `kv_cache` 内存池里。

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

逐层声明的主循环：以层名为 key，不需要 KV 的层根本不进字典；跨层共享的层登记到 `shared_kv_cache_layers` 后 `continue`。GQA（Qwen3）走 `isinstance(attn_module, Attention)` 这一支，spec 直接由上游 `Attention.get_kv_cache_spec` 生成。

## vllm_ascend/worker/model_runner_v1.py#L5031-L5047

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

MLA / SFA indexer 走昇腾自己的 spec 类，说明「按层类型分支」不是只有一种 spec。

## vllm_ascend/worker/model_runner_v1.py#L5076-L5089

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

混合模型里 attention 层的 page 会被 padding 到 mamba 的 page 大小，这是 `page_size_padded` 唯一的来源。

## vllm_ascend/core/kv_cache_interface.py#L33-L61

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
```

MLA 的每 block 字节数公式；注意它没有 K/V 两份的因子 2（MLA 只存一份压缩 latent），与 GQA 的算法不同。

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

`initialize_kv_cache` 的编排顺序：先补层、选后端、重建 input batch，最后才真正分配张量。

## vllm_ascend/worker/model_runner_v1.py#L3986-L4004

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

分配分两步（申请裸字节 → 改形状），再把跨层共享的层指向目标层的同一块张量。

## vllm_ascend/worker/model_runner_v1.py#L4019-L4030

```python
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

分配完的张量通过 `bind_kv_cache` 挂回 `static_forward_context`，attention 层 forward 时就是从这里拿到自己的 cache。

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

分配阶段把「组级 spec」还原成「层级 spec」——组内 spec 相同则共享，`UniformTypeKVCacheSpecs` 则按层取回各自的 spec。

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

attention 层的分配主路径：`kv_cache_tensor.size` 按 K/V 头维比例切成两块，GQA 下 `k_dim == v_dim` 故各占一半。

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

裸张量一律按 int8 字节申请，dtype 是 reshape 阶段 `view` 出来的——这是「先按字节数分配，再按形状解释」的直接证据。

## vllm_ascend/worker/model_runner_v1.py#L4355-L4361

```python
        layer_names = set()
        for group in kv_cache_config.kv_cache_groups:
            for layer_name in group.layer_names:
                if layer_name in self.runner_only_attn_layers:
                    continue
                layer_names.add(layer_name)
        assert layer_names == set(kv_cache_raw_tensors.keys()), "Some layers are not correctly initialized"
```

分配完成后断言每个需要 KV 的层都拿到了张量。

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

`num_blocks = (K 字节 + V 字节) / page_size_bytes`，并断言不小于调度器认定的块数——这是 spec 与实际分配之间的对账点。

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

非 MLA 路径：去掉后端返回形状的第 0 维（那一维是常量 2，即 K/V 两份），K 与 V 各拿 `(num_blocks, block_size, num_kv_heads, head_size)`。

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

最终每层拿到的是 `(k_cache, v_cache)` 二元组，int8 裸缓冲在这里被 `view` 成目标 dtype 与目标形状。

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

GQA 后端声明的 block 形状，首维 2 即 K 与 V 两份。

## vllm_ascend/attention/attention_v1.py#L151-L153

```python
    @staticmethod
    def get_supported_kernel_block_sizes() -> list[int]:
        return [128]
```

昇腾 GQA 算子只支持 128 的 kernel block size。

## vllm_ascend/utils.py#L1380-L1382

```python
def calc_split_factor(num_list: list[int]):
    total = sum(num_list)
    return [total / num for num in num_list]
```

K/V 切分因子：`[d_h, d_h]` 得到 `[2.0, 2.0]`，即各占一半。

## vllm_ascend/utils.py#L1167-L1180

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
```

昇腾侧 `block_size` 的默认值来源。

## vllm_ascend/worker/model_runner_v1.py#L376

```python
        self.block_size = vllm_config.cache_config.block_size
```

runner 构造 spec 时用的 `block_size` 直接来自 `cache_config`。

## vllm_ascend/worker/v2/attn_utils.py#L64-L93

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

v2 worker 路径上同名的模块级函数，逻辑与 v1 的方法版一致（逐层问 spec、跳过共享层），用于说明两条 runner 路径的声明规则相同。

## docs/source/user_guide/configuration/additional_config.md#L174

```markdown
| `long_req_block_threshold` | int | `700` | In dynamic mode, a newly added request above this block count activates balancing. The default threshold corresponds to approximately 89,600 tokens when `block_size=128`. |
```

官方文档里用 `700 blocks ≈ 89,600 tokens @ block_size=128` 反推 block 与 token 的换算关系，可与源码默认值互相印证。
