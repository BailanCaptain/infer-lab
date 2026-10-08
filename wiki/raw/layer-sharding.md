# layer_sharding 源码与文档片段

对照两个 ref：`vllm-ascend@2c59ff10`（releases/v0.23.0）与 `vllm-ascend@28bf3a2e`（main）。

## vllm_ascend/ascend_config.py#L105-L112

```python
        self.layer_sharding = additional_config.get("layer_sharding", None)
        if self.layer_sharding:
            logger.info_once(
                "Linear layer sharding enabled with config: %s. "
                "Note: This feature works optimally with FLASHCOMM2 and DSA-CP enabled; "
                "using it without these features may result in significant performance degradation.",
                str(self.layer_sharding),
            )
```

参数唯一的读取点。默认值是 `None` 而不是官方表写的 `{}`，且没有任何子键解析——拿到什么就原样存着。同时给出上游自己的告警：不配 FLASHCOMM2 / DSA-CP 就开，性能会显著变差。

## vllm_ascend/platform.py#L338-L346

```python
    @classmethod
    def _validate_layer_sharding_config(cls, vllm_config: VllmConfig) -> None:
        additional_config = vllm_config.additional_config or {}
        layer_sharding = additional_config.get("layer_sharding") or []
        if not layer_sharding:
            return

        kv_transfer_config = vllm_config.kv_transfer_config
        if kv_transfer_config is None or kv_transfer_config.kv_role != "kv_producer":
            raise ValueError("additional_config.layer_sharding can only be enabled in PD-disaggregated's P node.")
```

「只能在 P 节点开」是启动期硬校验，不是建议。`kv_role` 不是 `kv_producer`（含未配 `kv_transfer_config` 的混合部署、以及 `kv_both`）直接抛 `ValueError`。

## vllm_ascend/ops/layer_shard_linear.py#L39-L56

```python
@dataclass
class SeriesMetadata:
    """Metadata for a weight shard series."""

    group: GroupCoordinator
    start_layer: int
    end_layer: int
    num_layers: int
    prefetch_step: int
    dummy_weight: torch.Tensor  # Dummy weight to replace the loaded weight matrix.
    # All the layers in the series share the same dummy weight tensor.
    layers: list[LayerMetadata]
    shard_windows: list[ShardWindowMetadata]  # Shard windows for prefetching. The window size is (`prefetch_step` + 1),
    # as only the weights for the next (`prefetch_step` + 1) layers need to be stored.
    window_offset: int  # The index of the window for the next coming layer.

    def is_source(self, layer_idx) -> bool:
        return layer_idx % self.group.world_size == self.group.rank_in_group
```

切分规则的定义处：第 `i` 层的权重只存在组内 rank `i % world_size` 上。也给出窗口缓冲数 = `prefetch_step + 1` 的出处。

## vllm_ascend/ops/layer_shard_linear.py#L211-L253

```python
def register_layer_to_shard_weight_series(
    series_name: str,
    group: GroupCoordinator,
    layer: LinearBase,
    prefetch_step: int = 1,
):
    global _series_dict
    if series_name not in _series_dict:
        _series_dict[series_name] = SeriesMetadata(
            group=group,
            start_layer=0,
            end_layer=0,
            num_layers=0,
            prefetch_step=prefetch_step,
            dummy_weight=torch.empty_like(layer.weight),
            layers=[],
            shard_windows=[],
            window_offset=prefetch_step,
        )
    series = _series_dict[series_name]
    assert layer.quant_method is not None
    layer_idx = extract_layer_index(layer.prefix)
    series.layers.append(
        LayerMetadata(
            layer_idx=layer_idx,
            layer=layer,
            post_method=layer.quant_method.process_weights_after_loading,
            weight=layer.weight,
            window_idx=-1,
        )
    )
    # Discard the original `process_weights_after_loading` method such that it won't be called by others.
    layer.quant_method.process_weights_after_loading = lambda layer: None
    # When the layer not intended to be stored in this device, dispose the tensor and skip weight loading.
    if not series.is_source(layer_idx):
        dispose_tensor(layer.weight)
        layer.weight.weight_loader = lambda *args, **kwargs: None
    layer.forward = _create_forward_wrapper(layer.forward, series, layer_idx)
```

显存是怎么省下来的：非本卡负责的层，权重张量被 `dispose_tensor` 置空、`weight_loader` 被换成 no-op（连加载都跳过）。同时 `forward` 被包一层，进函数先等广播到位。

## vllm_ascend/ops/layer_shard_linear.py#L122-L152

```python
    def reach_layer(self, layer_idx: int):
        # The index of the layer to be prefetched.
        next_layer_idx = (layer_idx + self.prefetch_step) % self.num_layers + self.start_layer
        next_layer = self.layers[next_layer_idx - self.start_layer]
        # The index of the window to store the weight for the coming layer.
        next_layer.window_idx = self.window_offset
        window = self.shard_windows[next_layer.window_idx]
        # When the layer not intended to be stored in this device, link to the corresponding window's tensor.
        if not self.is_source(next_layer_idx):
            next_layer.weight.set_(window.weight)
        # Update `window_offset` by rolling one step.
        self.window_offset = (self.window_offset + 1) % (self.prefetch_step + 1)
        assert window.data_layer_idx != next_layer_idx
        window.data_layer_idx = next_layer_idx
        # Start asynchronous broadcast work.
        window.work = dist.broadcast(
            next_layer.weight,
            src=self.group.ranks[next_layer_idx % self.group.world_size],
            group=self.group.device_group,
            async_op=True,
        )

    def wait_weight(self, layer_idx: int):
        # Find the asynchronous broadcast work and wait for it.
        assert self.shard_windows
        window = self.shard_windows[self.layers[layer_idx - self.start_layer].window_idx]
        # Make sure the data in the corresponding shard window is for the current layer.
        assert window.data_layer_idx == layer_idx
        if window.work is not None:
            window.work.wait()
            window.work = None
```

通信代价的出处：每层一次 `dist.broadcast`（异步），源 rank 为 `layer_idx % world_size`；`wait_weight` 在该层 `forward` 入口阻塞等待。这是「用通信换显存」的那笔通信。

## vllm_ascend/ops/layer_shard_linear.py#L285-L296

```python
def register_all_layers_to_shard_weight_series(
    layer_sharding: list[LinearBase],
):
    for curr_layer in layer_sharding or []:
        if is_hidden_layer(curr_layer):
            layer_name = curr_layer.prefix.split(".")[-1]
            register_layer_to_shard_weight_series(
                series_name=layer_name,
                group=get_shard_weight_group(),
                layer=curr_layer,
                prefetch_step=1,
            )
```

MLA / SFA 路径的注册入口：`prefetch_step` 写死为 1，且 series 按 prefix 最后一段（即 `o_proj`、`q_b_proj` 这种名字）分组。形参名叫 `layer_sharding` 但类型是 `list[LinearBase]`，与配置项同名易混。

## vllm_ascend/ops/linear_op.py#L412-L417

```python
    def update_attrs(self):
        super().update_attrs()
        self.input_is_parallel = self.layer.input_is_parallel
        self.input_size_per_partition = self.layer.input_size_per_partition
        if flashcomm2_oshard_manager.flashcomm2_oshard_enable():
            flashcomm2_oshard_manager.register_layer(self.layer, prefetch_step=1)
```

FlashComm2 路径的注册入口，同样传 `prefetch_step=1`。与上一段合起来证明：全仓两个注册点都是 1，用户无从调整。

## vllm_ascend/ops/linear_op.py#L712-L724

```python
    if "wo_b" in prefix and oproj_tp_enable():
        return DSV4OProjRowParallelOp(layer)
    if enable_dsa_cp_with_layer_shard() and "o_proj" in prefix:
        return ShardedCPRowParallelOp(layer)
    if "down_proj" in prefix and mlp_tp_enable():
        return MLPRowParallelOp(layer)
    if "o_proj" in prefix and oproj_tp_enable():
        return OProjRowParallelOp(layer)
    if matmul_allreduce_enable():
        return MatmulAllreduceRowParallelOp(layer)
    if flashcomm2_enable():
        if "o_proj" in prefix or "out_proj" in prefix:
            return Flashcomm2OProjRowParallelOp(layer)
```

开了之后 `o_proj` 具体走哪个算子的分派顺序，以及它与 `oproj_tensor_parallel_size`、matmul-allreduce、FlashComm2 各条 row-parallel 路径的优先级关系。（`is_moe_layer(prefix)` 一段为节省篇幅略去。）

## vllm_ascend/distributed/parallel_state.py#L191-L226

```python
    def create_shard_weight_group(module_tp_group_ranks: None) -> GroupCoordinator:
        # Argument module_tp_group_ranks: The module specific tensor parallel group.
        # There are three situations.
        # 1. If it is None, then the TP_size of the specific module is 1 and is replicated linear layer.
        # 2. If it is not None, and the module tp_group is same as the global tp_group.
        # 3. If it is not None, and the module tp_group is different from the global tp_group.(eg. flashcomm2_otp)
        group_ranks = []
        pp_group_ranks = all_ranks.transpose(2, 4).reshape(-1, global_pp_size)
        if module_tp_group_ranks is None:
            # If it is None, then the TP_size of this shard weight is 1.
            shard_weight_group_ranks = pp_group_ranks.transpose(0, 1).unbind(0)
            group_ranks = [x.tolist() for x in shard_weight_group_ranks]
        else:
            # combine standard tp group and non-standard tp group to build  shard_weight comm_group
            module_tp_tanspose_ranks = module_tp_group_ranks.transpose(0, 1)
            G = world_size // (global_pp_size * module_tp_group_ranks.size(1))
            shard_weight_group_ranks = torch.stack([t.view(global_pp_size, G) for t in module_tp_tanspose_ranks], dim=1)
            group_ranks = shard_weight_group_ranks.view(-1, G).tolist()
        return init_model_parallel_group(group_ranks, get_world_group().local_rank, backend, group_name="shard_weight")

    # Create shard weight group if enabled
    if get_ascend_config().layer_sharding is not None:
        global _SHARD_WEIGHT
        if flashcomm2_enable():
            if len(flashcomm2_otp_group_ranks) == 0:
                FC2_group_ranks = None
            else:
                FC2_group_ranks = torch.tensor(flashcomm2_otp_group_ranks).squeeze(0)
            _SHARD_WEIGHT = create_shard_weight_group(FC2_group_ranks)
        elif enable_dsa_cp_with_layer_shard():
            # For dsa_cp, all shard layers are replicated.
            _SHARD_WEIGHT = create_shard_weight_group(None)
        else:
            # For standard tp, use global tp group_ranks
            tp_group_ranks = all_ranks.view(-1, global_tp_size)
            _SHARD_WEIGHT = create_shard_weight_group(tp_group_ranks)
```

回答「切到哪几张卡上」：`shard_weight` 组是在 TP 之外的正交维度上建的，三种建法对应 FlashComm2 otp 组 / DSA-CP 全复制 / 标准 TP。注意判据是 `is not None`——传空列表 `[]` 也会建组。

## vllm_ascend/utils.py#L1293-L1297

```python
def o_shard_enable() -> bool:
    layer_sharding = get_ascend_config().layer_sharding
    if layer_sharding is None:
        return False
    return "o_proj" in layer_sharding
```

配置值被当成容器做 `in` 判断——这是它实际是 list（或至少是可 `in` 的容器）而非结构化 dict 的直接证据。

## vllm_ascend/utils.py#L1309-L1317

```python
    layer_sharding = ascend_config.layer_sharding or []
    if layer_sharding:
        if layer_sharding == ["o_proj"]:
            logger.info_once("Enable FLASHCOMM2 with o_proj layer sharding for reduced memory consumption.")
        else:
            raise ValueError(
                "FLASHCOMM2 only supports 'o_proj' as the sole layer sharding configuration! "
                f"Found invalid layer_sharding: {layer_sharding}"
            )
```

与 FlashComm2 的耦合约束：同开时取值只能严格等于 `["o_proj"]`，多一个元素或换序都抛 `ValueError`。这里的 `== ["o_proj"]` 也再次坐实配置值是 list。

## vllm_ascend/utils.py#L1538-L1549

```python
@lru_cache(maxsize=1)
def enable_dsa_cp_with_layer_shard() -> bool:
    if not enable_dsa_cp():
        return False
    from vllm.config import get_current_vllm_config

    vllm_config = get_current_vllm_config()
    kv_transfer_config = vllm_config.kv_transfer_config
    # Layer sharding broadcast only pays off when it can be hidden by the
    # heavier prefill-stage compute, so enable it only on the P-side instance.
    is_prefill_instance = kv_transfer_config is not None and kv_transfer_config.kv_role == "kv_producer"
    return is_prefill_instance
```

上游自己写出的「为什么只能在 P 节点」：广播只有被更重的 prefill 计算盖住才划算。这是该限制的设计动机，而非仅仅是实现约束。

## vllm_ascend/model_loader/rfork/rfork_loader.py#L236-L247

```python
            if _is_layer_sharding_enabled(vllm_config):
                bypass_reason = "additional_config.layer_sharding"
            elif _is_dynamic_eplb_enabled(vllm_config):
                bypass_reason = "dynamic EPLB"

            if bypass_reason is not None:
                logger.warning(
                    "RFork transfer is disabled when %s is enabled; using the default model loader.",
                    bypass_reason,
                )
                fallback_load_config = _make_fallback_load_config(self.load_config)
```

与 RFork 的互斥是「静默降级」而不是报错：开了 layer_sharding，`--load-format rfork` 被忽略，退回默认 loader，只留一条 warning。

## vllm_ascend/attention/mla_v1.py#L766-L775

```python
        self.layer_sharding_kwargs = []
        for layer_name in get_ascend_config().layer_sharding or []:
            if layer_name in kwargs:
                self.layer_sharding_kwargs.append(kwargs[layer_name])
            else:
                logger.warning_once(
                    f"Layer '{layer_name}' not found in kwargs, skipping sharding. "
                    f"Check layer_sharding config and model layer names."
                )
        register_all_layers_to_shard_weight_series(self.layer_sharding_kwargs)
```

配置项里的字符串是如何落到具体 Linear 对象上的：按名字去 MLA 的 `kwargs` 里查。名字拼错不会报错，只有一条 `warning_once`，然后静默不切。

## docs/source/user_guide/feature_guide/layer_sharding.md#L5-L18

```markdown
**Layer Sharding Linear** is a memory-optimization feature designed for large language model (LLM) inference. It addresses the high memory pressure caused by **repeated linear operators across many layers** that share identical structure but have distinct weights.

Instead of replicating all weights on every device, **Layer Sharding Linear shards the weights of a "series" of such operators across the NPU devices in a communication group**:

- The **i-th layer's linear weight** is stored **only on device `i % K`**, where `K` is the number of devices in the group.
- Other devices hold a lightweight **shared dummy tensor** during initialization and fetch the real weight **on-demand** via asynchronous broadcast during the forward pass.

As illustrated in the figure below, this design enables broadcast to reach weights: while the current layer (e.g., MLA or MOE) is being computed, the system **asynchronously broadcasts the next layer's weight** in the background. Because the attention computation in the MLA module is sufficiently latency-bound, the weight transfer for `o_proj` is **fully overlapped with computation**, making the communication **latency-free from the perspective of end-to-end inference**.

This approach **preserves exact computational semantics** while **significantly reducing NPU memory footprint**, especially critical for:

- Extremely deep architectures (e.g., DeepSeek-V3/R1 with 61 layers);
- Models using **[DSA-CP](https://github.com/vllm-project/vllm-ascend/pull/4702)** or **[FlashComm2](https://github.com/vllm-project/vllm-ascend/pull/4188)**, where the full `O` (output) projection matrix must reside in memory per layer;
- Scenarios where **attention computation latency fully overlaps** (hides) the communication cost of weight broadcasting.
```

官方对「它解决什么问题」的表述，以及 `i % K` 归属规则的官方确认（与源码 `is_source` 一致）。也是「适用场景」那三条的出处。

## docs/source/user_guide/feature_guide/layer_sharding.md#L30-L42

```markdown
## Getting Started

To enable **Layer Sharding Linear**, specify the target linear layers using the `--additional-config` argument when launching your inference job. For example, to shard the `o_proj` and `q_b_proj` layers, use:

```bash
--additional-config '{
  "layer_sharding": ["o_proj", "q_b_proj"]
}'
```

> **Restriction**
> Layer Sharding can only be enabled in PD disaggregated's **P node**.
> Layer Sharding is not supported by RFork weight transfer. If `--load-format rfork` is used with `layer_sharding`, RFork transfer is bypassed and the model is loaded through the default model loader.
```

官方唯一一处给出完整用法的地方：值是 JSON 数组。与 additional_config.md 里「dict / `{}`」的写法直接冲突。

## docs/source/user_guide/configuration/additional_config.md#L86

```markdown
| `layer_sharding`                    | dict | `{}`    | Configuration options for Layer Sharding Linear. Layer Sharding can only be enabled in PD-disaggregated's P node. |
```

官方参数总表里的那一行。类型与默认值两项都与源码和 feature guide 不符，是本页要纠正的对象。

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

v0.23.0 自己就把 Layer sharding 和它最主要的搭档 FlashComm2 一起列入待废弃。这是「新部署不要用」这条建议的官方依据，也解释了 main 上为何两者一起消失。

## docs/source/tutorials/models/GLM5.md#L359

```markdown
- `VLLM_ASCEND_ENABLE_FLASHCOMM1=1`: Enables FlashComm optimization to reduce communication overhead (mainly benefits the prefill path). With FlashComm enabled, `layer_sharding` cannot include `o_proj`.
```

与 feature guide 的 DSA-CP 示例（`VLLM_ASCEND_ENABLE_FLASHCOMM1=1` + `["q_b_proj", "o_proj"]`）直接矛盾的一条模型侧说明。InternVL3.5.md#L180、GLM5.2.md#L782 有同样表述。

## docs/source/tutorials/models/DeepSeek-V3.2.md#L486

```bash
       --additional-config '{"layer_sharding": ["q_b_proj", "o_proj"], "enable_dsa_cp": true}' \
```

DeepSeek-V3.2 教程给出的可直接复制的真实启动片段，与 GLM 系列教程的说法相反：这里 FlashComm1/DSA-CP 场景下 `o_proj` 是被允许的。

## main: vllm_ascend/utils.py#L1324-L1337

```python
def enable_dsa_cp_with_o_proj_tp() -> bool:
    if not enable_dsa_cp():
        return False
    from vllm.config import get_current_vllm_config

    vllm_config = get_current_vllm_config()
    kv_transfer_config = vllm_config.kv_transfer_config

    # Keep the original TP o_proj weight when:
    # 1) KV pooling is disabled, or
    # 2) KV pooling is enabled on a prefill producer (including kv_both).
    # DSA-CP prefill produces a full-head attention output, so the runtime
    # asynchronously gathers a temporary full o_proj weight for the forward.
    return kv_transfer_config is None or kv_transfer_config.is_kv_producer
```

main 上取代 `enable_dsa_cp_with_layer_shard` 的函数（注意名字从 `layer_shard` 变成 `o_proj_tp`）。注释说明了新做法：权重常驻 TP 分片态，前向时按需异步 all-gather 出一份临时全量 `o_proj`。没有对应的用户开关。

## main: vllm_ascend/quantization/tp_weight_switch.py#L70-L106

```python
class TPWeightSwitchMixin:
    """Opt-in TP/full weight switching for one linear method.

    Subclasses declare the direct layer attributes needed by a full-weight
    forward after ``process_weights_after_loading()`` has completed. The
    input-sharded specs are used by row-parallel linears and the
    output-sharded specs by column-parallel linears. When adding support for a
    quantization type, document the following in the subclass docstring or
    adjacent spec declaration:

    1. The post-processing layout and TP-sharded dimension of every declared
       attribute. ``TPWeightGatherSpec.gather_dim`` must identify that exact
       dimension, including packed or transposed weight layouts.
    2. Every attribute that must be concatenated across TP ranks in
       ``tp_weight_gather_specs``. This normally includes the weight and any
       rank-distinct scale or metadata consumed by the full-weight kernel.
    3. Every attribute that must be repeated locally in
       ``tp_weight_repeat_specs``. Use this only when the full-weight kernel
       expects the same rank-local value once per TP shard; rank-distinct data
       must be gathered instead.
    4. Both input- and output-sharded layouts when the method can be used by
       row- and column-parallel linears. Include every quantization parameter
       that becomes TP-sharded in each layout.
    5. Set ``supports_tp_weight_switch = True`` only after validating every
       declared layout. Callers use this as the common opt-in gate; it carries
       no SFA- or DSA-CP-specific meaning.

    ``attr_name`` must name a direct tensor attribute on the layer. The mixin
    owns only reusable TP/full state and collective handles; subclasses retain
    ownership of the attribute list and its quantization-specific semantics.
    """

    tp_weight_gather_specs: ClassVar[tuple[TPWeightGatherSpec, ...]] = ()
    tp_weight_repeat_specs: ClassVar[tuple[TPWeightRepeatSpec, ...]] = ()
    tp_weight_output_gather_specs: ClassVar[tuple[TPWeightGatherSpec, ...]] = ()
    tp_weight_output_repeat_specs: ClassVar[tuple[TPWeightRepeatSpec, ...]] = ()
    supports_tp_weight_switch: ClassVar[bool] = False
```

main 上承接这件事的新机制：TP 分片态与全量态之间来回切换的通用 mixin。与 layer_sharding 的关键差别是它由量化方法声明、由 DSA-CP 运行时调用，不暴露成 `additional_config` 开关。

## main: docs/source/tutorials/models/GLM5.2.md#L184

```markdown
- `"enable_dsa_cp": true`: Enables DSA context parallelism to accelerate long-context prefill. With DSA-CP enabled, `layer_sharding` cannot include `o_proj`.
```

main 上 `layer_sharding` 仅存的正文残留。参数本身已从 `additional_config.md` 表格和全部 Python 代码中删除，这条属于没清理干净的过时文字。
