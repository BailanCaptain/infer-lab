# prefetch_ratio 引用的源码片段

## vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L52-L53

```python
        weight_prefetch_config = additional_config.get("weight_prefetch_config", {})
        self.weight_prefetch_config = WeightPrefetchConfig(weight_prefetch_config)
```

v0.23.0 上 `prefetch_ratio` 的读取入口：它是 `additional_config.weight_prefetch_config` 的一个子键。

## vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L704-L720

```python
class WeightPrefetchConfig:
    """
    Configuration Object for weight_prefetch_config from additional_config
    """

    prefetch_ratio: dict = {
        "attn": {
            "qkv": 1.0,
            "o": 1.0,
        },
        "moe": {"gate_up": 0.8},
        "mlp": {"gate_up": 1.0, "down": 1.0},
    }

    def __init__(self, weight_prefetch_config: dict):
        self.enabled = weight_prefetch_config.get("enabled", False)
        self.prefetch_ratio = weight_prefetch_config.get("prefetch_ratio", self.prefetch_ratio)
```

默认值的唯一定义处；也说明用户一旦传了 `prefetch_ratio`，整个顶层 dict 被替换而不是逐键合并。

## vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L13-L34

```python
SUPPORTED_MODULES = ["attn", "mlp", "moe"]
MOE_PREFETCH_TOKEN_THRESHOLD = 96
MAX_PREFETCH_WEIGHT_SIZE = 18 * 1024 * 1024


@dataclass
class ModuleWeightPrefetchConfig:
    module_name: str
    enable: bool = False
    is_active_this_forward: bool = False
    prefetch_ratio: dict = field(default_factory=dict)
    linear_prefix_map: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.prefetch_ratio = {prefix: ratio for prefix, ratio in self.prefetch_ratio.items() if 0 <= ratio <= 1}

        assert self.module_name in SUPPORTED_MODULES, (
            f"Invalid module name {self.module_name}, should be one of {SUPPORTED_MODULES}"
        )

        if self.module_name in SUPPORTED_MODULES:
            self.enable = self.enable and any(self.prefetch_ratio.values()) > 0
```

取值范围 `0 ≤ r ≤ 1` 的过滤、18 MB 常量、96 token 门槛，以及"整组全为 0 就把该组关掉"的判定都在这里。

## vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L46-L69

```python
    def __init__(self, weight_prefetch_config: WeightPrefetchConfig) -> None:
        self.is_moe = is_moe_model(get_current_vllm_config())
        self.mla_sfa_prefetch_enable = weight_prefetch_config.enabled

        self.attn = ModuleWeightPrefetchConfig(
            module_name="attn",
            enable=weight_prefetch_config.enabled,
            prefetch_ratio=weight_prefetch_config.prefetch_ratio.get("attn", {}) or {"qkv": 1.0, "o": 1.0},
            linear_prefix_map={
                AscendQKVParallelLinear.__name__: "qkv",
                AscendRowParallelLinear.__name__: "o",
            },
        )
        self.moe = ModuleWeightPrefetchConfig(
            module_name="moe",
            enable=weight_prefetch_config.enabled and self.is_moe,
            prefetch_ratio=weight_prefetch_config.prefetch_ratio.get("moe", {}) or {"gate_up": 0.8},
        )

        self.mlp = ModuleWeightPrefetchConfig(
            module_name="mlp",
            enable=weight_prefetch_config.enabled and not self.is_moe,
            prefetch_ratio=weight_prefetch_config.prefetch_ratio.get("mlp", {}) or {"gate_up": 1.0, "down": 1.0},
        )

```

三组比例各自的逐组回退默认值（`... or {...}`），以及 `moe` 只对 MoE 模型、`mlp` 只对稠密模型生效的门。`linear_prefix_map` 定义了 `qkv` / `o` 两个 prefix 对应哪两个线性层类。

## vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L71-L104

```python
    def maybe_prefetch_attn_weight_preprocess(
        self, layer_cls_name: str, weight: torch.Tensor, start_flag: torch.Tensor
    ) -> None:
        if not self.attn.enable or layer_cls_name not in self.attn.linear_prefix_map:
            return

        prefix = self.attn.linear_prefix_map.get(layer_cls_name, "")
        weight_size = weight.data.element_size() * weight.data.numel() * self.attn.prefetch_ratio.get(prefix, 0)

        torch.ops.vllm.prefetch_preprocess(weight=weight, start_flag=start_flag, max_weight_size=int(weight_size))

    def maybe_prefetch_attn_weight_postprocess(self, layer_cls_name: str, stop_flag: torch.Tensor) -> None:
        if not self.attn.enable or layer_cls_name not in self.attn.linear_prefix_map:
            return

        torch.ops.vllm.prefetch_postprocess(stop_flag)

    def maybe_prefetch_moe_weight_preprocess(self, hidden_states, prefix):
        self.moe.is_active_this_forward = (
            hidden_states.shape[0] >= MOE_PREFETCH_TOKEN_THRESHOLD if self.moe.enable else False
        )
        if not self.moe.is_active_this_forward:
            return
        forward_context = get_forward_context()
        if not forward_context or _EXTRA_CTX.model_instance is None:
            return

        weight = self._get_moe_gate_up_prefetch_weight()
        if weight is None:
            self.moe.is_active_this_forward = False
            return

        weight_size = weight.data.element_size() * weight.data.numel() * self.moe.prefetch_ratio.get(prefix, 0)
        torch.ops.vllm.prefetch_preprocess(weight=weight, start_flag=None, max_weight_size=int(weight_size))
```

`attn.*` 与 `moe.gate_up` 用比例换算字节数的两处；两处都没有 18 MB 截断，且缺失的 prefix 取 `0`。`moe` 还有一个 96 token 的逐 forward 门槛。

## vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L158-L186

```python
    def _maybe_prefetch_mlp_gate_up_weight_preprocess(
        self, x_dependency: torch.Tensor, forward_context: ForwardContext, curr_layer_prefix: str | None
    ):
        if not curr_layer_prefix:
            raise ValueError("curr_layer_prefix must been specified when prefetching mlp gate_up_proj weight")

        # start point of gate_up_proj weight prefetch
        if curr_layer_prefix.split(".")[-2] == "self_attn":
            model_instance = _EXTRA_CTX.model_instance
            layer_idx = int(curr_layer_prefix.split(".")[2])
            weight = model_instance.model.layers[layer_idx].mlp.gate_up_proj.weight  # type: ignore
            weight_size = (
                weight.data.element_size() * weight.data.numel() * self.mlp.prefetch_ratio.get(self.MLP_GATE_UP, 0)
            )
            if weight_size > MAX_PREFETCH_WEIGHT_SIZE:
                weight_size = MAX_PREFETCH_WEIGHT_SIZE
            torch.ops.vllm.prefetch_preprocess(weight=weight, start_flag=x_dependency, max_weight_size=int(weight_size))
            _EXTRA_CTX.prefetch_mlp_gate_up_proj = True

    def _maybe_prefetch_mlp_down_weight_preprocess(self, x_dependency: torch.Tensor, forward_context: ForwardContext):
        layer_idx = _EXTRA_CTX.layer_idx
        model_instance = _EXTRA_CTX.model_instance
        weight = model_instance.model.layers[layer_idx].mlp.down_proj.weight  # type: ignore
        weight_size = weight.data.element_size() * weight.data.numel() * self.mlp.prefetch_ratio.get(self.MLP_DOWN, 0)
        if weight_size > MAX_PREFETCH_WEIGHT_SIZE:
            weight_size = MAX_PREFETCH_WEIGHT_SIZE
        torch.ops.vllm.prefetch_preprocess(weight=weight, start_flag=x_dependency, max_weight_size=int(weight_size))
        _EXTRA_CTX.prefetch_mlp_down_proj = True
        _EXTRA_CTX.layer_idx = layer_idx + 1  # type: ignore
```

`mlp.gate_up` / `mlp.down` 分别打到 `gate_up_proj.weight` 与 `down_proj.weight`，并且只有这两条路径在 Python 侧做了 18 MB 截断。

## vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L230-L238

```python
def maybe_npu_prefetch(
    inputs: torch.Tensor, dependency: torch.Tensor, max_size: int = 0, offset: int = 0, *, enabled: bool = True
) -> None:
    if not enabled:
        return
    input_size = inputs.element_size() * inputs.numel()
    if max_size <= 0 or max_size > input_size:
        max_size = input_size
    torch_npu.npu_prefetch(inputs, dependency, max_size, offset)
```

关键的一跳：`max_size <= 0` 被改写成"全量"。比例算出 0 字节时并不会不预取，而是变成 100% 预取。

## vllm-ascend@2c59ff10:vllm_ascend/ops/register_custom_ops.py#L126-L131

```python
def _prefetch_preprocess_impl(weight: torch.Tensor, start_flag: torch.Tensor, max_weight_size: int) -> None:
    calculation_stream = torch_npu.npu.current_stream()
    weight_prefetch_stream = prefetch_stream()
    weight_prefetch_stream.wait_stream(calculation_stream)
    with npu_stream_switch(weight_prefetch_stream):
        maybe_npu_prefetch(inputs=weight, dependency=start_flag, max_size=max_weight_size)
```

比例换算出的字节数原样传给 `maybe_npu_prefetch`，中间没有任何夹取，所以上一段的"0 变全量"确实会发生。

## vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_static.py#L74-L89

```python
    def apply(
        self,
        layer: torch.nn.Module,
        x: torch.Tensor,
        bias: torch.Tensor | None = None,
        tp_rank: int | None = 0,
    ) -> torch.Tensor:
        if x.dtype != torch.int8:
            layer_cls_name = layer.__class__.__name__
            weight_prefetch_method = get_weight_prefetch_method()
            # prefetch qkvo_proj.weight preprocess
            weight_prefetch_method.maybe_prefetch_attn_weight_preprocess(
                layer_cls_name=layer_cls_name,
                weight=layer.weight,
                start_flag=x,
            )
```

`attn.qkv` / `attn.o` 的唯一调用点在 `AscendW8A8LinearMethod.apply` 内，说明这两个比例只在 W8A8 静态量化线性层上起作用。

## vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/experts_selector.py#L71-L74

```python
    # prefetch w1_w3_proj.weight preprocess
    weight_prefetch_method = get_weight_prefetch_method()
    if weight_prefetch_method:
        weight_prefetch_method.maybe_prefetch_moe_weight_preprocess(hidden_states, "gate_up")
```

`moe.gate_up` 的预取起点是专家选择（门控 top_k）之前，被藏在门控这段 vector 计算后面。

## vllm-ascend@2c59ff10:vllm_ascend/ops/activation.py#L37-L43

```python
class AscendSiluAndMul(SiluAndMul):
    def forward_oot(self, x: torch.Tensor) -> torch.Tensor:
        weight_prefetch_method = get_weight_prefetch_method()
        weight_prefetch_method.maybe_prefetch_mlp_weight_preprocess(weight_prefetch_method.MLP_DOWN, x)
        out = torch_npu.npu_swiglu(x)
        weight_prefetch_method.maybe_prefetch_mlp_weight_postprocess(out)
        return out
```

`mlp.down` 的预取窗口是 SwiGLU 这段 vector 计算。

## vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L153-L158

```python
    def apply(self, input_):
        output, output_bias = self.apply_impl(input_)
        weight_prefetch_method = get_weight_prefetch_method()
        weight_prefetch_method.maybe_prefetch_mlp_weight_preprocess(
            weight_prefetch_method.MLP_GATE_UP, output, self.prefix
        )
```

`mlp.gate_up` 的预取从 RowParallel 线性层（attention 的 o_proj）算完之后发起。

## vllm-ascend@2c59ff10:tests/ut/ops/a2/test_weight_prefetch.py#L45-L52

```python
    def test_prefetch_ratio_filtering(self):
        config = ModuleWeightPrefetchConfig(
            module_name="attn",
            prefetch_ratio={"qkv": 0.8, "o": 1.2, "invalid": -0.5},
        )
        assert "qkv" in config.prefetch_ratio
        assert "o" not in config.prefetch_ratio
        assert "invalid" not in config.prefetch_ratio
```

上游单测锁死了"越界值被静默丢弃"这一行为。

## vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/weight_prefetch.md#L11-L32

```markdown
## Fine-tune Prefetch Ratio

Since weight prefetch uses vector computations to hide the weight prefetching pipeline, the setting of the prefetch size is crucial. If the size is too small, the optimization benefits will not be fully realized, while a larger size may lead to resource contention, resulting in performance degradation. To accommodate different scenarios, we have added `prefetch_ratio` to allow for flexible size configuration based on the specific workload, details as follows:

With `prefetch_ratio` in `"weight_prefetch_config"` to customize the weight prefetch ratio for specific linear layers.

The “attn” and “moe” configuration options are used for MoE model, details as follows:

`"attn": { "qkv": 1.0,  "o": 1.0},  "moe": {"gate_up": 0.8}`

The “mlp” configuration option is used to optimize the performance of the Dense model, details as follows:

 `"mlp": {"gate_up": 1.0, "down": 1.0}`

Above values are the default config, the default value has a good performance for Qwen3-235B-A22B-W8A8 when `--max-num-seqs` is 144, for Qwen3-32B-W8A8 when `--max-num-seqs` is 72.

However, this may not be the optimal configuration for your scenario. For higher concurrency, you can try increasing the prefetch size. For lower concurrency, prefetching may not offer any advantages, so you can decrease the size or disable prefetching. Determine if the prefetch size is appropriate by collecting profiling data. Specifically, check if the time required for the prefetch operation (e.g., MLP Down Proj weight prefetching) overlaps with the time required for parallel vector computation operators (e.g., SwiGlu computation), and whether the prefetch operation is no later than the completion time of the vector computation operator. In the profiling timeline, a prefetch operation appears as a CMO operation on a single stream; this CMO operation is the prefetch operation.

Notes:

1) Weight prefetch of MLP `down` project prefetch depends on sequence parallel, if you want to open for mlp `down` please also enable sequence parallel.
2) Due to the current size of the L2 cache, the maximum prefetch cannot exceed 18MB. If `prefetch_ratio * linear_layer_weight_size >= 18 * 1024 * 1024` bytes, the backend will only prefetch 18 MB.
```

官方对"为什么要有这个比例、怎么判断调得对不对、18 MB 硬上限、`mlp.down` 依赖序列并行、默认值是在哪两个模型上标定的"的唯一正式说明。

## vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L117-L122

```markdown
**weight_prefetch_config**

| Name             | Type | Default                                                     | Description                        |
|------------------|------|-------------------------------------------------------------|------------------------------------|
| `enabled`        | bool | `False`                                                     | Whether to enable weight prefetch. |
| `prefetch_ratio` | dict | `{"attn": {"qkv": 1.0, "o": 1.0}, "moe": {"gate_up": 0.8}, "mlp": { "gate_up": 1.0,  "down": 1.0}}` | Prefetch ratio of each weight.     |
```

v0.23.0 官方参数表里的类型与默认值。

## vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L232-L261

```python
    Example: pass this dict via ``--additional-config '<json>'``. All keys
    are optional; the values below show every supported key with its default
    value (see the mutex/validation notes below before copying).

        {
            "refresh": false,
            "enable_cpu_binding": true,
            "multistream_dsv4_dsa_overlap": true,
            "enable_prefill_mc2": false,
            "multistream_overlap_shared_expert": false,
            "enable_kv_nz": false,
            "enable_mc2_hierarchy_comm": false,
            "enable_reduce_sample": false,
            "enable_dsa_cp": false,
            "draft_window_size": null,
            "mix_placement": false,
            "pa_shape_list": [],
            "mega_moe_max_tokens": 131072,
            "ascend_log_path": "~/ascend/log/vllm_ascend",
            "c8_enable_reshape_optim": false,
            "enable_fused_mc2": 0,
            "enable_mlapo": true,
            "mlapo_keep_prefill_weights": false,
            "msmonitor_use_daemon": false,
            "enable_transpose_kv_cache_by_block": true,
            "weight_nz_mode": 1,
            "enable_shared_expert_dp": false,
            "enable_sparse_sfa_c8": false,
            "enable_sparse_li_c8": false,
            "ascend_compilation_config": {
                "enable_npugraph_ex": true,
                "enable_static_kernel": false,
                "fuse_norm_quant": true,
                "fuse_qknorm_rope": true,
                "fuse_muls_add": true
            },
```

main 上 `AscendConfig` 自称"列出每一个受支持的键"，其中已经没有 `weight_prefetch_config`，因此也没有 `prefetch_ratio`。

## vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L351-L369

```python
    Additional notes:

    - Unknown keys are rejected (``extra="forbid"``); a typo fails fast.
    - ``dump_config_path`` (str path) / ``dump_config`` (inline dict, mutually
      exclusive with ``dump_config_path``; materialized by the factory to
      ``.vllm_ascend/msprobe/msprobe_dump_config.json``) are msprobe dump
      options consumed by the factory before schema validation.
    - ``refresh`` forces reconstruction of the cached singleton config.
    - Pure-derived fields computed automatically and not user-settable:
      ``enable_sp_by_pass``, ``pd_tp_ratio``, ``pd_head_ratio``,
      ``num_head_replica``.
    - Deprecated top-level scheduler keys (``enable_balance_scheduling``,
      ``recompute_scheduler_enable``, ``short_request_first_config``,
      ``profiling_chunk_config``, ``batch_job_sched_config``) still resolve,
      but emit deprecation warnings; prefer nesting under
      ``scheduler_config`` as shown above.
    """

    model_config = ConfigDict(extra="forbid")
```

main 把未知键改成硬失败，这决定了旧启动脚本里残留的 `weight_prefetch_config` 不会被静默忽略。

## vllm-ascend@28bf3a2e:docs/source/user_guide/release_notes.md#L114-L128

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

v0.23.0 的发布说明已把 weight prefetch 整体列入待废弃，main 上的删除是这条计划的落地。

## vllm-ascend@28bf3a2e:tests/e2e/pull_request/two_card/test_qwen3_performance.py#L73-L76

```python
        "--compilation-config",
        '{"cudagraph_mode": "FULL_DECODE_ONLY"}',
        "--additional-config",
        '{"pa_shape_list":[48,64,72,80],"weight_prefetch_config":{"enabled":true}}',
```

main 仓库里仍有传 `weight_prefetch_config` 的残留启动参数，用来说明旧脚本迁移时要清理的具体形态。
