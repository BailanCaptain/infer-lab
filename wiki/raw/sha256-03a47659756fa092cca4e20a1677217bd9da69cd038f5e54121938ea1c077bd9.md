# weight_prefetch_config — 源码与文档片段

对照两个 ref：`vllm-ascend@2c59ff10`（releases/v0.23.0）与 `vllm-ascend@28bf3a2e`（main）。

---

## vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/weight_prefetch.md#L1-L5

```markdown
# Weight Prefetch Guide

Weight prefetching optimizes memory usage by preloading weights into the cache before they are needed, minimizing delays caused by memory access during model execution. Linear layers sometimes exhibit relatively high MTE utilization. To address this, we create a separate pipeline specifically for weight prefetching, which runs in parallel with the original vector computation pipeline, such as quantize, MoE gating top_k, RMSNorm and SwiGlu. This approach allows the weights to be preloaded to L2 cache ahead of time, reducing MTE utilization during the linear layer computations and indirectly improving Cube computation efficiency by minimizing resource contention and optimizing data flow.

Since we use vector computations to hide the weight prefetching pipeline, this has an effect on computation. If you prioritize low latency over high throughput, it is best not to enable prefetching.
```

官方对「预取什么、预取到哪一级存储、为什么有用、什么时候不该开」的唯一正面表述：预取的是 linear 层权重，目的地是 **L2 cache**，藏在 vector 计算流水（quantize / MoE gating top_k / RMSNorm / SwiGlu）背后；并明确说明优先低延迟的场景不应开启。

---

## vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/weight_prefetch.md#L25-L32

```markdown
Above values are the default config, the default value has a good performance for Qwen3-235B-A22B-W8A8 when `--max-num-seqs` is 144, for Qwen3-32B-W8A8 when `--max-num-seqs` is 72.

However, this may not be the optimal configuration for your scenario. For higher concurrency, you can try increasing the prefetch size. For lower concurrency, prefetching may not offer any advantages, so you can decrease the size or disable prefetching. Determine if the prefetch size is appropriate by collecting profiling data. Specifically, check if the time required for the prefetch operation (e.g., MLP Down Proj weight prefetching) overlaps with the time required for parallel vector computation operators (e.g., SwiGlu computation), and whether the prefetch operation is no later than the completion time of the vector computation operator. In the profiling timeline, a prefetch operation appears as a CMO operation on a single stream; this CMO operation is the prefetch operation.

Notes:

1) Weight prefetch of MLP `down` project prefetch depends on sequence parallel, if you want to open for mlp `down` please also enable sequence parallel.
2) Due to the current size of the L2 cache, the maximum prefetch cannot exceed 18MB. If `prefetch_ratio * linear_layer_weight_size >= 18 * 1024 * 1024` bytes, the backend will only prefetch 18 MB.
```

默认值的调参前提（两个 W8A8 模型、特定并发）、18 MiB 上限的来由（L2 容量）、MLP `down` 对 sequence parallel 的依赖、以及「低并发下可能没有收益」的官方建议。

---

## https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/weight_prefetch.html

上面那两段本地文档的线上渲染版（v0.23.0 版本段）。已实际打开核对：开篇段落与两条 Notes 逐字一致，L2 cache 与 18MB 上限的说法相同。线上页无行号，本地文件用于给出可核对的行范围。

---

## vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L66-L69

```markdown
| Name                                | Type | Default | Description                                                                                               |
|-------------------------------------|------|---------|-----------------------------------------------------------------------------------------------------------|
| `xlite_graph_config`                | dict | `{}`    | Configuration options for Xlite graph mode                                                                |
| `weight_prefetch_config`            | dict | `{}`    | Configuration options for weight prefetch                                                                 |
```

官方参数表里 `weight_prefetch_config` 这一行：类型 dict、默认 `{}`。

---

## vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L117-L122

```markdown
**weight_prefetch_config**

| Name             | Type | Default                                                     | Description                        |
|------------------|------|-------------------------------------------------------------|------------------------------------|
| `enabled`        | bool | `False`                                                     | Whether to enable weight prefetch. |
| `prefetch_ratio` | dict | `{"attn": {"qkv": 1.0, "o": 1.0}, "moe": {"gate_up": 0.8}, "mlp": { "gate_up": 1.0,  "down": 1.0}}` | Prefetch ratio of each weight.     |
```

两个子键的官方名字、类型与默认值。注意子键是 `enabled` 而不是 `enable`。

---

## vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L52-L53

```python
        weight_prefetch_config = additional_config.get("weight_prefetch_config", {})
        self.weight_prefetch_config = WeightPrefetchConfig(weight_prefetch_config)
```

v0.23.0 的 `AscendConfig.__init__` 用普通 dict 取键构造子配置——缺键就走默认，未知子键被静默忽略。

---

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

配置对象本体：`enabled` 默认 `False`，`prefetch_ratio` 的默认值与官方文档表一致。`get("prefetch_ratio", ...)` 是整体替换而非逐键合并——用户只写 `{"mlp": {...}}` 时 `attn`/`moe` 的默认值会一起消失。

---

## vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L13-L15

```python
SUPPORTED_MODULES = ["attn", "mlp", "moe"]
MOE_PREFETCH_TOKEN_THRESHOLD = 96
MAX_PREFETCH_WEIGHT_SIZE = 18 * 1024 * 1024
```

三个模块名的白名单、MoE 路径的 token 门槛 96、以及代码里写死的 18 MiB 上限。

---

## vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L26-L34

```python
    def __post_init__(self) -> None:
        self.prefetch_ratio = {prefix: ratio for prefix, ratio in self.prefetch_ratio.items() if 0 <= ratio <= 1}

        assert self.module_name in SUPPORTED_MODULES, (
            f"Invalid module name {self.module_name}, should be one of {SUPPORTED_MODULES}"
        )

        if self.module_name in SUPPORTED_MODULES:
            self.enable = self.enable and any(self.prefetch_ratio.values()) > 0
```

取值范围校验：落在 `[0, 1]` 之外的 ratio 被**静默丢弃**（不是报错、不是 clamp）；ratio 全为 0 或全被丢弃时该模块自动关闭。

---

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

一个开关展开成三个模块开关：`moe` 只在 MoE 模型上生效、`mlp` 只在非 MoE 模型上生效、`attn` 两者都开。另外 `.get(..., {}) or {...}` 意味着子键缺失时会**逐模块回填**默认 ratio，抵消了上一处整体替换的一部分影响。

---

## vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L71-L86

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
```

attn 路径的预取字节数算式：`element_size × numel × ratio`；注意这条路径**没有** 18 MiB 的显式 clamp，超限靠后端截断。

---

## vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L88-L104

```python
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

MoE 路径的运行期门槛：本次 forward 的 token 数 `>= 96` 才预取，否则整条路径跳过。

---

## vllm-ascend@2c59ff10:vllm_ascend/ops/weight_prefetch.py#L134-L156

```python
    def maybe_prefetch_mlp_weight_preprocess(
        self, prefetch_layer_name: str, x_dependency: torch.Tensor | None, curr_layer_prefix: str | None = None
    ):
        if not self.mlp.enable:
            self.mlp.is_active_this_forward = False
            return

        try:
            forward_context = get_forward_context()
        except AssertionError:
            return
        self.mlp.is_active_this_forward = (
            _EXTRA_CTX.layer_idx is not None and _EXTRA_CTX.num_tokens is not None and _EXTRA_CTX.num_tokens < 500
        )
        if not self.mlp.is_active_this_forward:
            return

        if prefetch_layer_name == self.MLP_GATE_UP:
            self._maybe_prefetch_mlp_gate_up_weight_preprocess(x_dependency, forward_context, curr_layer_prefix)
        elif prefetch_layer_name == self.MLP_DOWN:
            self._maybe_prefetch_mlp_down_weight_preprocess(x_dependency, forward_context)
```

Dense 模型 MLP 路径的运行期门槛：本次 forward 的 `num_tokens < 500` 才预取——与 MoE 路径的方向**相反**。这是判断「开了对首 token 延迟有没有影响」的关键。

---

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
        _EXTRA_CTX.layer_idx = layer_idx + 1
```

18 MiB clamp 在代码里**只出现在 MLP 这两条路径**；`gate_up` 的预取起点是 `self_attn.o_proj`（`curr_layer_prefix.split(".")[-2] == "self_attn"`），也就是说它提前了整整一个 attention 的距离。

---

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

链路终点：最终落到 `torch_npu.npu_prefetch`，只搬数据、不分配张量——这是「不额外吃 HBM」这条结论的依据。

---

## vllm-ascend@2c59ff10:vllm_ascend/ops/register_custom_ops.py#L126-L145

```python
def _prefetch_preprocess_impl(weight: torch.Tensor, start_flag: torch.Tensor, max_weight_size: int) -> None:
    calculation_stream = torch_npu.npu.current_stream()
    weight_prefetch_stream = prefetch_stream()
    weight_prefetch_stream.wait_stream(calculation_stream)
    with npu_stream_switch(weight_prefetch_stream):
        maybe_npu_prefetch(inputs=weight, dependency=start_flag, max_size=max_weight_size)


def _prefetch_preprocess_impl_fake(weight: torch.Tensor, start_flag: torch.Tensor, max_weight_size: int) -> None:
    return


def _prefetch_postprocess_impl(stop_flag: torch.Tensor) -> None:
    calculation_stream = torch_npu.npu.current_stream()
    weight_prefetch_stream = prefetch_stream()
    calculation_stream.wait_stream(weight_prefetch_stream)


def _prefetch_postprocess_impl_fake(stop_flag: torch.Tensor) -> None:
    return
```

pre/post 这对算子就是一对 stream 同步：pre 让预取流等计算流、切到预取流发预取；post 让计算流等预取流。官方文档说的「独立流水线」在代码里就是这个第二条 stream。

---

## vllm-ascend@2c59ff10:vllm_ascend/utils.py#L509-L528

```python
def prefetch_stream() -> torch.npu.Stream:
    global _PREFETCH_STREAM
    if _PREFETCH_STREAM is None:
        # when this function is called before any stream is set,
        # we return the default stream.
        _PREFETCH_STREAM = torch_npu.npu.Stream()
    return _PREFETCH_STREAM


def set_weight_prefetch_method(weight_prefetch_config: WeightPrefetchConfig):
    global _WEIGHT_PREFETCH_METHOD
    if _WEIGHT_PREFETCH_METHOD is None:
        from vllm_ascend.ops.weight_prefetch import WeightPrefetchMethod

        _WEIGHT_PREFETCH_METHOD = WeightPrefetchMethod(weight_prefetch_config)
    return _WEIGHT_PREFETCH_METHOD
```

预取流是进程内单例；`WeightPrefetchMethod` 也是进程内全局单例，各算子通过 `get_weight_prefetch_method()` 取到同一个对象。

---

## vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L336-L338

```python
        # Ascend-specific configurations
        self.ascend_config = get_ascend_config()
        set_weight_prefetch_method(self.ascend_config.weight_prefetch_config)
```

配置进入运行期的唯一入口：`NPUModelRunner.__init__` 里把 `weight_prefetch_config` 交给全局单例。

---

## vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_static.py#L81-L89

```python
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

attn 的 qkv / o 预取**只有这一处调用点**，在 `AscendW8A8LinearMethod.apply` 里，且还要求 `x.dtype != torch.int8`——非 W8A8 量化的模型跑不到这条分支。

---

## vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L153-L158

```python
    def apply(self, input_):
        output, output_bias = self.apply_impl(input_)
        weight_prefetch_method = get_weight_prefetch_method()
        weight_prefetch_method.maybe_prefetch_mlp_weight_preprocess(
            weight_prefetch_method.MLP_GATE_UP, output, self.prefix
        )
```

MLP `gate_up` 预取的触发点：任意 `CustomRowParallelOp.apply` 之后（内部再判断 prefix 是不是 `self_attn.*`）。

---

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

MLP `down` 预取被夹在 SwiGLU 前后——这就是官方文档说「藏在 SwiGlu 背后」的具体实现。

---

## vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/experts_selector.py#L71-L74

```python
    # prefetch w1_w3_proj.weight preprocess
    weight_prefetch_method = get_weight_prefetch_method()
    if weight_prefetch_method:
        weight_prefetch_method.maybe_prefetch_moe_weight_preprocess(hidden_states, "gate_up")
```

MoE `gate_up`（即 `w13_weight`）预取的触发点在 `select_experts` 里，藏在 MoE gating top_k 背后。

---

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

main 上 `AscendConfig`（`vllm_ascend/ascend_config.py:212`）已迁到 pydantic 且 `extra="forbid"`。配合「main 上 `weight_prefetch_config` 这个字段不存在」，得到：在 main 上传这个键不是被忽略，而是直接报错。

---

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

v0.23.0 的 release notes 就已经把 Weight prefetch 列进「Ready to Deprecate」——这是「main 上删除」的官方预告，也说明去向是**直接下线**，没有替代参数。

---

## vllm-ascend@28bf3a2e:docs/source/tutorials/features/suffix_speculative_decoding.md#L92-L95

```markdown
  --speculative-config '{"method": "suffix", "num_speculative_tokens": 3}' \
  --gpu-memory-utilization 0.9 \
  --additional-config '{"pa_shape_list":[48,64,72,80], "weight_prefetch_config":{"enable":true}}' \
  --port 8011
```

main 上残留的过期示例：既用了已被删除的 `weight_prefetch_config`，子键还写成 `enable`（正确拼写是 `enabled`）。照抄这条命令在 main 上会被 `extra="forbid"` 直接拒掉。
