# enable_matmul_allreduce 源码片段

对照 2 个 ref：`vllm-ascend@2c59ff10`（releases/v0.23.0）与 `vllm-ascend@28bf3a2e`（main）。

## vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L167-L172

```python
        self.enable_matmul_allreduce = self._get_config_value(
            additional_config,
            "enable_matmul_allreduce",
            "VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE",
            ascend_envs.VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE,
        )
```

配置项在 v0.23.0 的唯一定义处，也是「配置项名 / 环境变量名 / 环境变量默认值」三者的绑定点。

## vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L353-L365

```python
    @staticmethod
    def _get_config_value(additional_config: dict[str, Any], config_key: str, env_key: str, env_value: Any) -> Any:
        if config_key in additional_config:
            value = additional_config[config_key]
            logger.info_once(f"AscendConfig.{config_key} is set from additional_config with value {value}.")
            return value
        if env_key in os.environ:
            logger.info_once(
                f"AscendConfig.{config_key} falls back to environment variable {env_key} with value {env_value}. "
                f"Please use additional_config.{config_key} instead, because {env_key} will be removed in the "
                "next release."
            )
        return env_value
```

优先级的判据：`additional_config` 里只要出现了这个 key 就直接返回，环境变量连读都不读；否则回落到环境变量并打印一条「下个版本要删」的提示。

## vllm-ascend@2c59ff10:vllm_ascend/envs.py#L69-L71

```python
    # Whether to enable MatmulAllReduce fusion kernel when tensor parallel is enabled.
    # this feature is supported in A2, and eager mode will get better performance.
    "VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE": lambda: bool(int(os.getenv("VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE", "0"))),
```

环境变量默认 `"0"`、取 `bool(int(...))`（所以只接受 `"0"`/`"1"` 这类整数字面量），以及「A2 支持、eager 模式收益更好」的一手注释。

## vllm-ascend@2c59ff10:vllm_ascend/utils.py#L895-L896

```python
def matmul_allreduce_enable() -> bool:
    return get_ascend_config().enable_matmul_allreduce
```

配置项到使用点之间的唯一跳板，说明它没有任何附加的硬件 / 模型 / 阶段判断。

## vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L700-L739

```python
def _get_row_parallel_op(
    prefix, layer
) -> (
    MLPRowParallelOp
    | OProjRowParallelOp
    | DSV4OProjRowParallelOp
    | Flashcomm2OProjRowParallelOp
    | MatmulAllreduceRowParallelOp
    | SequenceRowParallelOp
    | ShardedCPRowParallelOp
    | None
):
    if "wo_b" in prefix and oproj_tp_enable():
        return DSV4OProjRowParallelOp(layer)
    if enable_dsa_cp_with_layer_shard() and "o_proj" in prefix:
        return ShardedCPRowParallelOp(layer)
    if "down_proj" in prefix and mlp_tp_enable() and not is_moe_layer(prefix):
        return MLPRowParallelOp(layer)
    if "o_proj" in prefix and oproj_tp_enable():
        return OProjRowParallelOp(layer)
    if matmul_allreduce_enable():
        return MatmulAllreduceRowParallelOp(layer)
    if flashcomm2_enable():
        if "o_proj" in prefix or "out_proj" in prefix:
            return Flashcomm2OProjRowParallelOp(layer)
    if enable_sp():
        if "shared_expert" in prefix:
            return None
        sp_row_prefixes = [
            "o_proj",  # attn output linear of most LLMs
            "out_proj",  # attn output linear of Qwen3 Next
            "down_proj",  # second MLP of most LLMs
            "attention.dense",  # attn output linear of Bailing
            "wo_b",  # attn output linear of v4
        ]
        for a_prefix in sp_row_prefixes:
            if a_prefix in prefix:
                return SequenceRowParallelOp(layer)

    return None
```

派发顺序是这一页最关键的事实：`matmul_allreduce_enable()` 这一支**没有 prefix 过滤**，一旦为真就吃掉所有还没被前面分支认领的 RowParallelLinear，并且排在 `flashcomm2_enable()` 与 `enable_sp()` 之前，把这两条路径整个遮蔽掉，且不打任何日志。

## vllm-ascend@2c59ff10:vllm_ascend/ops/linear_op.py#L420-L441

```python
class MatmulAllreduceRowParallelOp(CustomRowParallelOp):
    _HCOMM_INFO = None

    def __init__(self, layer):
        super().__init__(layer)
        self.hcomm_info = self.get_hcomm_info(self.comm_group.device_group)

    def apply_impl(self, input_: torch.Tensor) -> torch.Tensor | tuple[torch.Tensor, Parameter | None]:
        input_parallel = self.get_input_parallel(input_)
        """Calculate the output tensor of forward by considering
        fusing communication and computation."""
        bias_ = None if (self.tp_rank > 0 or self.skip_bias_add) else self.bias
        if self.reduce_results and self.tp_size > 1:
            output = torch_npu.npu_mm_all_reduce_base(
                input_parallel, self.layer.weight.t(), self.hcomm_info, bias=bias_
            )
        else:
            assert self.quant_method is not None
            output = self.quant_method.apply(self.layer, input_parallel, bias=bias_)

        output_bias = self.bias if self.skip_bias_add else None
        return output, output_bias
```

融合实际落到 `torch_npu.npu_mm_all_reduce_base` 这一个 MC2 算子上；生效前提是 `reduce_results and tp_size > 1`；融合分支直接传 `self.layer.weight.t()` 而不经过 `quant_method.apply`（量化权重只会走 else 分支）。

## vllm-ascend@2c59ff10:vllm_ascend/batch_invariant.py#L76-L93

```python
def override_envs_for_invariance():
    from vllm_ascend.ascend_config import get_ascend_config

    ascend_config = get_ascend_config()
    ascend_config.weight_nz_mode = 0
    ascend_config.enable_matmul_allreduce = False

    os.environ["HCCL_DETERMINISTIC"] = "strict"
    os.environ["LCCL_DETERMINISTIC"] = "1"

    # Enable deterministic computation for operators. Some operators on Ascend A5
    # do not have deterministic mode enabled by default and must be explicitly set.
    torch.use_deterministic_algorithms(True, warn_only=True)

    logger.debug(
        "Batch-invariant env override: weight_nz_mode=0, enable_matmul_allreduce=False, "
        "HCCL_DETERMINISTIC=strict, LCCL_DETERMINISTIC=1, use_deterministic_algorithms=True",
    )
```

batch-invariant 模式会在配置生效后把它强制改回 `False`，是仓库内唯一一处覆盖用户设置的地方。

## vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L5-L27

```markdown
## Migration Guide

Starting from [PR #9064](https://github.com/vllm-project/vllm-ascend/pull/9064), vLLM Ascend is migrating **10 environment variables** to `--additional-config`.

### Important Notice

- **Current Support**: Both environment variables and `--additional-config` are supported during the transition period
- **Recommendation**: Use `--additional-config` for new deployments and migrate existing configurations
- **Future Plan**: Environment variables will be **removed** in a future release; only `--additional-config` will be supported

### Quick Reference

| Environment Variable | Config Key | Type Conversion |
|---------------------|------------|-----------------|
| `VLLM_ASCEND_BALANCE_SCHEDULING` | `enable_balance_scheduling` | `"1"` → `true`, `"0"` → `false` |
| `VLLM_ASCEND_ENABLE_FLASHCOMM1` | `enable_flashcomm1` | `"1"` → `true`, `"0"` → `false` |
| `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` | `enable_matmul_allreduce` | `"1"` → `true`, `"0"` → `false` |
| `VLLM_ASCEND_FLASHCOMM2_PARALLEL_SIZE` | `enable_flashcomm2_parallel_size` | Integer (unchanged) |
| `MSMONITOR_USE_DAEMON` | `msmonitor_use_daemon` | `"1"` → `true`, `"0"` → `false` |
| `VLLM_ASCEND_ENABLE_MLAPO` | `enable_mlapo` | `"1"` → `true`, `"0"` → `false` |
| `VLLM_ASCEND_ENABLE_NZ` | `weight_nz_mode` | Integer (unchanged, field name changed) |
| `VLLM_ASCEND_ENABLE_FUSED_MC2` | `enable_fused_mc2` | Integer (unchanged) |
| `VLLM_ASCEND_FUSION_OP_TRANSPOSE_KV_CACHE_BY_BLOCK` | `enable_transpose_kv_cache_by_block` | `"1"` → `true`, `"0"` → `false` |
```

v0.23.0 官方把这个环境变量列进了「迁移期双轨支持」清单，并明确写了环境变量将来会被移除。

## vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L96-L96

```markdown
| `enable_matmul_allreduce`           | bool | `False` | Whether to enable matmul allreduce optimization. Can also be configured via the `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` environment variable during the migration period. |
```

官方参数表里的类型与默认值。

## vllm-ascend@2c59ff10:tests/e2e/pull_request/two_card/test_external_launcher.py#L209-L229

```python
@pytest.mark.skipif(
    DEVICE_NAME != "Ascend910B",
    reason="This test is only for Ascend910B devices.",
)
@pytest.mark.parametrize("model", MODELS)
@wait_until_npu_memory_free(target_free_percentage=0.7)
@patch.dict(os.environ, {"VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE": "1", "HCCL_BUFFSIZE": "500"})
def test_qwen3_external_launcher_with_matmul_allreduce(model):
    env = os.environ.copy()
    cmd = [
        sys.executable,
        str(EXTERNAL_LAUNCHER_SCRIPT),
        "--model",
        model,
        "--trust-remote-code",
    ]

    proc, output = _run_external_launcher(cmd, env)

    assert "Generated text:" in output
    assert proc.returncode == 0
```

CI 里唯一开启这个特性的门禁用例：`MODELS = ["Qwen/Qwen3-0.6B"]`（同文件 L36），只在 `Ascend910B`（A2）上跑，并且同时把 `HCCL_BUFFSIZE` 拉到 500。

## vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py#L28-L36

```python
# computation-communication tiling block is 512
ALLREDUCE_NORM_FUSE_THRESHOLD = 512


class MiddleLayerMatmulAllReduceAddRMSNormPattern(BasePattern):
    """
    recognizing the Matmul+AllReduce+AddRMSNorm computation pattern
    AllReduce is optimized in the fusion operator to a two-stage communication of ReduceScatter+AllGather
    """
```

仓库内对「融合算子内部怎么重叠」最直接的一手描述：计算/通信的切分块是 512 行，AllReduce 在算子内部被拆成 ReduceScatter + AllGather 两段。

## vllm-ascend@2c59ff10:vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py#L154-L159

```python
    def is_applicable_for_range(self, compile_range: Range) -> bool:
        """
        Check if the pass is applicable for the current configuration.
        """
        applicable = compile_range.start > ALLREDUCE_NORM_FUSE_THRESHOLD
        return applicable
```

图模式那条同族路径给出的划算门槛：token 数必须大于 512 才启用融合。

## vllm-ascend@2c59ff10:docs/source/user_guide/release_notes.md#L1764-L1779

```markdown
    - Implement the fusion of allreduce and matmul in prefill phase when tp is enabled. Enable this feature by setting `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` to `1`. [#1926](https://github.com/vllm-project/vllm-ascend/pull/1926)
    - Optimize Quantized MoE Performance by Reducing All2All Communication. [#2195](https://github.com/vllm-project/vllm-ascend/pull/2195)
    - Use AddRmsNormQuant ops in the custom model to optimize Qwen3's performance [#1806](https://github.com/vllm-project/vllm-ascend/pull/1806)
    - Use multicast to avoid padding decode request to prefill size [#1555](https://github.com/vllm-project/vllm-ascend/pull/1555)
    - The performance of LoRA has been improved. [#1884](https://github.com/vllm-project/vllm-ascend/pull/1884)
- A batch of refactoring prs to enhance the code architecture:
    - Torchair model runner refactor [#2205](https://github.com/vllm-project/vllm-ascend/pull/2205)
    - Refactoring forward_context and model_runner_v1. [#1979](https://github.com/vllm-project/vllm-ascend/pull/1979)
    - Refactor AscendMetaData Comments. [#1967](https://github.com/vllm-project/vllm-ascend/pull/1967)
    - Refactor torchair utils. [#1892](https://github.com/vllm-project/vllm-ascend/pull/1892)
    - Refactor torchair worker. [#1885](https://github.com/vllm-project/vllm-ascend/pull/1885)
    - Register activation customop instead of overwrite forward_oot. [#1841](https://github.com/vllm-project/vllm-ascend/pull/1841)
- Parameters changes:
    - `expert_tensor_parallel_size` in `additional_config` is removed now, and the EP and TP is aligned with vLLM now. [#1681](https://github.com/vllm-project/vllm-ascend/pull/1681)
    - Add `VLLM_ASCEND_MLA_PA` in environ variables, use this to enable mla paged attention operator for deepseek mla decode.
    - Add `VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` in environ variables, enable `MatmulAllReduce` fusion kernel when tensor parallel is enabled. This feature is supported in A2, and eager mode will get better performance.
```

引入它的 PR（#1926）与官方对适用范围的原始说法。注意第一条写的是 "in prefill phase"，而代码里没有任何 prefill 判断——这是文档与源码的分歧点。

## vllm-ascend@28bf3a2e:vllm_ascend/ops/linear_op.py#L311-L318

```python
def _get_row_parallel_op(prefix, layer) -> MLPRowParallelOp | OProjRowParallelOp | DSV4OProjRowParallelOp | None:
    if "wo_b" in prefix and oproj_tp_enable():
        return DSV4OProjRowParallelOp(layer)
    if "down_proj" in prefix and mlp_tp_enable() and not is_moe_layer(prefix):
        return MLPRowParallelOp(layer)
    if "o_proj" in prefix and oproj_tp_enable():
        return OProjRowParallelOp(layer)
    return None
```

main 上同一个派发函数：`MatmulAllreduceRowParallelOp` 连同 `matmul_allreduce_enable()` 分支已整体消失（返回类型标注里也没有了）。

## vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L367-L373

```python
    """

    model_config = ConfigDict(extra="forbid")

    # ---- user-input switches: bool/int/list/str, auto type validation ----
    enable_cpu_binding: bool = True
    multistream_dsv4_dsa_overlap: bool = True
```

main 的 `AscendConfig` 已改写成 pydantic 模型并设了 `extra="forbid"`：任何未声明的 key 都会在构造时报错，而不是被忽略。

## vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L1316-L1322

```python
def init_ascend_config(vllm_config):
    additional_config = vllm_config.additional_config if vllm_config.additional_config is not None else {}
    if "enable_flashcomm1" in additional_config or os.getenv("VLLM_ASCEND_ENABLE_FLASHCOMM1") is not None:
        logger.warning(
            "FlashComm is deprecated; remove enable_flashcomm1 and "
            "VLLM_ASCEND_ENABLE_FLASHCOMM1 from the configuration. Use upstream configuration instead"
        )
```

main 为另一个同批下线的开关 `enable_flashcomm1` 保留了显式的废弃提示；`enable_matmul_allreduce` 没有对应的一条。

## vllm-ascend@28bf3a2e:vllm_ascend/ascend_config.py#L1351-L1360

```python
    # Keys that must NOT flow from additional_config into AscendConfig.
    # These are stripped so that only user-configurable keys reach pydantic,
    # where extra="forbid" can reject unknown options.
    _NON_USER_INPUT_KEYS = {
        # control-flow flag (singleton/cache refresh), not a configuration field
        "refresh",
        # Removed upstream option: warn above, but do not pass it into the
        # strict AscendConfig schema where it would be reported as a typo.
        "enable_flashcomm1",
```

豁免名单里只有 `enable_flashcomm1`，没有 `enable_matmul_allreduce`——后者会原样进入 `extra="forbid"` 的 pydantic 校验。

## vllm-ascend@28bf3a2e:docs/source/user_guide/configuration/additional_config.md#L7-L24

```markdown
Starting from [PR #9064](https://github.com/vllm-project/vllm-ascend/pull/9064), vLLM Ascend is migrating supported environment variables to `--additional-config`.

### Important Notice

- **Current Support**: Both environment variables and `--additional-config` are supported during the transition period
- **Recommendation**: Use `--additional-config` for new deployments and migrate existing configurations
- **Future Plan**: Environment variables will be **removed** in a future release; only `--additional-config` will be supported

### Quick Reference

| Environment Variable | Config Key | Type Conversion |
|---------------------|------------|-----------------|
| `VLLM_ASCEND_BALANCE_SCHEDULING` | `scheduler_config.enable_balance_scheduling` | `"1"` → `true`, `"0"` → `false` |
| `MSMONITOR_USE_DAEMON` | `msmonitor_use_daemon` | `"1"` → `true`, `"0"` → `false` |
| `VLLM_ASCEND_ENABLE_MLAPO` | `enable_mlapo` | `"1"` → `true`, `"0"` → `false` |
| `VLLM_ASCEND_ENABLE_NZ` | `weight_nz_mode` | Integer (unchanged, field name changed) |
| `VLLM_ASCEND_ENABLE_FUSED_MC2` | `enable_fused_mc2` | Integer (unchanged) |
| `VLLM_ASCEND_FUSION_OP_TRANSPOSE_KV_CACHE_BY_BLOCK` | `enable_transpose_kv_cache_by_block` | `"1"` → `true`, `"0"` → `false` |
```

main 的迁移表从 v0.23.0 的 9 行缩到 6 行，`VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE` 已从表中删除；正文里的「**10 environment variables**」也改成了泛指的 "supported environment variables"。

## vllm-ascend@28bf3a2e:vllm_ascend/compilation/graph_fusion_pass_manager.py#L49-L69

```python
    def configure(self, config: VllmConfig):
        from vllm_ascend.ascend_config import get_ascend_config
        from vllm_ascend.utils import is_310p

        # Consume the recursively validated config rather than re-reading the
        # raw additional_config dict (where e.g. "false" is truthy).
        self.ascend_compilation_config = get_ascend_config().ascend_compilation_config
        if self.ascend_compilation_config.fuse_norm_quant and not is_310p():
            from .passes.norm_quant_fusion_pass import AddRMSNormQuantFusionPass

            self.passes.append(AddRMSNormQuantFusionPass(config))

        if self.ascend_compilation_config.fuse_qknorm_rope:
            from .passes.qknorm_rope_fusion_pass import QKNormRopeFusionPass

            self.passes.append(QKNormRopeFusionPass(config))

        if self.ascend_compilation_config.fuse_muls_add and not is_310p():
            from .passes.muls_add_pass import MulsAddFusionPass

            self.passes.append(MulsAddFusionPass(config))
```

main 的图融合 pass 注册表里只剩三条，v0.23.0 里那条 `if self.ascend_compilation_config.get("fuse_allreduce_rms", True): self.passes.append(MatmulAllReduceAddRMSNormPass(config))` 已消失（`vllm_ascend/compilation/passes/` 下也不再有 `allreduce_rmsnorm_fusion_pass.py`）。说明 main 上 eager 与图模式两条 matmul+allreduce 融合入口是一起下线的。

## https://www.hiascend.com/developer/techArticles/20240729-1

> 将通信和计算的操作过程融合，使得计算和通信可以流水并行提升性能
>
> 典型算子包括AllGatherMatMul、MatMulReduceScatter、MatMulAllReduce等，这些算子将AllGather、ReduceScatter等通信过程和MatMul计算融合
>
> 可将SP、TP等并行场景下的通信和矩阵计算(Linear)流水并行
>
> 可将GPT-3的整网性能提升10%左右

昇腾官方对 MC2 通算融合算子族（MatMulAllReduce 属于其中）工作原理与收益量级的说明，用来回答「重叠的是什么、省的是什么」。
