# fuse-allreduce-rms 引用片段

## vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py#L28-L84

```python
# computation-communication tiling block is 512
ALLREDUCE_NORM_FUSE_THRESHOLD = 512


class MiddleLayerMatmulAllReduceAddRMSNormPattern(BasePattern):
    """
    recognizing the Matmul+AllReduce+AddRMSNorm computation pattern
    AllReduce is optimized in the fusion operator to a two-stage communication of ReduceScatter+AllGather
    """

    def __init__(self, vllm_config, eps=1e-6):
        self.vllm_config = vllm_config
        self.eps = eps
        device_group = get_tp_group().device_group
        backend = device_group._get_backend(torch.device("npu"))
        self.local_rank = torch.distributed.get_rank(group=device_group)
        self.tp_group_name = backend.get_hccl_comm_name(self.local_rank)
        self.tp_size = get_tensor_model_parallel_world_size()

    def get_inputs(self):
        batch_size, seq_len = 2, 4
        hidden_size = 4096
        x = torch.randn(batch_size, seq_len, hidden_size, device="npu")
        weight = torch.randn(hidden_size, hidden_size, device="npu")
        residual = torch.randn(batch_size, seq_len, hidden_size, device="npu")
        rms_norm_weight = torch.randn(hidden_size, device="npu")
        return [x, weight, residual, rms_norm_weight]

    def get_pattern(self):
        def pattern(x, weight, residual, rms_norm_weight):
            mm = torch.ops.vllm.unquantized_gemm(x, weight, None)
            all_reduce_ = tensor_model_parallel_all_reduce(mm)
            chunked_residual = torch.ops.vllm.maybe_chunk_residual(all_reduce_, residual)
            output = torch.ops._C_ascend.npu_add_rms_norm_bias(all_reduce_, chunked_residual, rms_norm_weight, None)
            out0 = output[0]
            out1 = output[2]
            return out0, out1

        return pattern

    def get_replacement(self):
        def replacement(x, weight, residual, rms_norm_weight):
            out0, out1 = torch.ops._C_ascend.matmul_allreduce_add_rmsnorm(
                x,
                weight,
                residual,
                rms_norm_weight,
                self.tp_group_name,
                self.tp_size,
                self.local_rank,
                self.eps,
                True,
                False,
            )
            return out0, out1

        return replacement
```

这是「融成什么」的唯一权威依据：被匹配的子图是 `unquantized_gemm → all_reduce → maybe_chunk_residual → npu_add_rms_norm_bias`，替换成单个 `matmul_allreduce_add_rmsnorm` 算子；类 docstring 说明该算子内部把 AllReduce 拆成 ReduceScatter+AllGather 两段。常量 512 是计算-通信流水的 tiling 块大小。

## vllm_ascend/compilation/passes/allreduce_rmsnorm_fusion_pass.py#L134-L159

```python
class MatmulAllReduceAddRMSNormPass(VllmInductorPass):
    def __init__(self, vllm_config: VllmConfig):
        super().__init__(vllm_config)
        self.pattern_match_passes: PatternMatcherPass = PatternMatcherPass(pass_name="allreduce_rmsnorm_fusion_pass")

        MiddleLayerMatmulAllReduceAddRMSNormPattern(vllm_config).register(self.pattern_match_passes)
        LastLayerMatmulAllReduceAddRMSNormPattern(vllm_config).register(self.pattern_match_passes)

    def __call__(self, graph: torch.fx.Graph):
        self.begin()
        self.matched_count = self.pattern_match_passes.apply(graph)
        pattern_idx = 0
        for pattern_entry in self.pattern_match_passes.patterns.values():
            for p in pattern_entry:
                p_str = PatternPrettyPrinter.run(p.pattern)
                logger.debug("Pattern %d: %s", pattern_idx, p_str)
                pattern_idx += 1
        logger.debug("Replaced %s patterns", self.matched_count)
        self.end_and_log()

    def is_applicable_for_range(self, compile_range: Range) -> bool:
        """
        Check if the pass is applicable for the current configuration.
        """
        applicable = compile_range.start > ALLREDUCE_NORM_FUSE_THRESHOLD
        return applicable
```

证明 pass 注册了两个 pattern（中间层 / 末层），且只在 `compile_range.start > 512` 的编译区间生效——这是「小 batch 不生效」这条结论的依据。

## vllm_ascend/compilation/graph_fusion_pass_manager.py#L36-L79

```python
    def __call__(self, graph: fx.Graph) -> fx.Graph:
        compile_range = get_pass_context().compile_range

        for pass_ in self.passes:
            if pass_.is_applicable_for_range(compile_range):
                pass_(graph)
        graph.recompile()
        return graph

    def add(self, pass_: VllmInductorPass):
        assert isinstance(pass_, VllmInductorPass)
        self.passes.append(pass_)

    def configure(self, config: VllmConfig):
        from vllm_ascend.utils import is_310p

        # By default, we enable the graph fusion and quantization fusion pass.
        self.ascend_compilation_config: dict = config.additional_config.get("ascend_compilation_config", {})
        if self.ascend_compilation_config.get("fuse_norm_quant", True) and not is_310p():
            from .passes.norm_quant_fusion_pass import AddRMSNormQuantFusionPass

            self.passes.append(AddRMSNormQuantFusionPass(config))

        if self.ascend_compilation_config.get("fuse_qknorm_rope", True):
            from .passes.qknorm_rope_fusion_pass import QKNormRopeFusionPass

            self.passes.append(QKNormRopeFusionPass(config))

        if self.ascend_compilation_config.get("fuse_allreduce_rms", True):
            from .passes.allreduce_rmsnorm_fusion_pass import MatmulAllReduceAddRMSNormPass

            self.passes.append(MatmulAllReduceAddRMSNormPass(config))

        if self.ascend_compilation_config.get("fuse_muls_add", True) and not is_310p():
            from .passes.muls_add_pass import MulsAddFusionPass

            self.passes.append(MulsAddFusionPass(config))

        if config.compilation_config.pass_config.enable_sp:
            from .passes.sequence_parallelism import SequenceParallelismPass
            from .passes.sequence_parallelism_moe import SequenceParallelismMoePass

            self.passes.append(SequenceParallelismPass(config))
            self.passes.append(SequenceParallelismMoePass(config))
```

三件事的依据：（1）`__call__` 按 `self.passes` 列表顺序执行，先注册的先改图；（2）融合 pass 与 SP pass 注册在同一个 manager 里，且融合 pass 排在 SP 之前；（3）这里读的是 **原始 dict** 且缺省值写成 `True`，与 `AscendCompilationConfig` 的 `False` 不一致。

## vllm_ascend/compilation/passes/sequence_parallelism.py#L75-L99

```python
    def register(self, pm_pass: PatternMatcherPass):
        def pattern(
            input: torch.Tensor,
            weight: torch.Tensor,
            residual: torch.Tensor,
        ) -> tuple[torch.Tensor, torch.Tensor]:
            x = self._all_reduce(input)
            result, _, residual = torch.ops._C_ascend.npu_add_rms_norm_bias(x, residual, weight, None, self.eps)

            return result, residual

        def replacement(
            input: torch.Tensor,
            weight: torch.Tensor,
            residual: torch.Tensor,
        ) -> tuple[torch.Tensor, torch.Tensor]:
            reduce_scatter = self._reduce_scatter(input)
            residual = torch.ops.vllm.maybe_chunk_residual(reduce_scatter, residual)
            result, _, residual = torch.ops._C_ascend.npu_add_rms_norm_bias(
                reduce_scatter, residual, weight, None, self.eps
            )
            all_gather = self._all_gather(result)
            return all_gather, residual

        pm.register_replacement(pattern, replacement, self.get_inputs(), pm.fwd_only, pm_pass)
```

冲突的直接证据：SP 的 `MiddleAllReduceRMSNormPattern` 匹配的是 `all_reduce → npu_add_rms_norm_bias`，与融合 pass 争抢同一段子图；两者的 replacement 都以 ReduceScatter+AllGather 重写这次 AllReduce，但归宿不同（SP 让后续算子停在 1/tp 长度，融合 pass 在算子内部 AllGather 回全长）。

## vllm_ascend/ascend_config.py#L37-L44（releases/v0.23.0）

```python
        xlite_graph_config = additional_config.get("xlite_graph_config", {})
        self.xlite_graph_config = XliteGraphConfig(xlite_graph_config, vllm_config)

        ascend_compilation_config = additional_config.get("ascend_compilation_config", {})
        self.ascend_compilation_config = AscendCompilationConfig(**ascend_compilation_config)

        ascend_fusion_config = additional_config.get("ascend_fusion_config", {})
        self.ascend_fusion_config = AscendFusionConfig(**ascend_fusion_config)
```

v0.23.0 用 `**dict` 直接展开构造，配合 `AscendCompilationConfig.__init__` 的 `**kwargs`，未知键被静默吞掉——与 main 的 `extra="forbid"` 形成对照。

## vllm_ascend/ascend_config.py#L607-L659（releases/v0.23.0）

```python
    def __init__(
        self,
        enable_npugraph_ex: bool = True,
        enable_static_kernel: bool = False,
        fuse_norm_quant: bool = True,
        fuse_qknorm_rope: bool = True,
        fuse_allreduce_rms: bool = False,
        **kwargs,
    ):
        """
        Initialize the configuration.

        Args:
            enable_npugraph_ex (bool): Whether to enable npugraph_ex backend.
                When set to True, the Fx graph generated by Dymano will be
                optimized and compiled by the npugraph_ex backend.
                Default: True
            enable_static_kernel (bool): Whether to enable static kernel.
                Static kernel is suitable for scenarios with purely static shapes
                or minimal shape changes, and can improve network performance.
                When set to True, when during graph capture, it will compile operator
                binary files with the corresponding shapes based on the current batch_size,
                which usually takes some time.
                Default: False
            fuse_norm_quant (bool): Whether to enable norm and quant fusion optimization.
                When set to True, the system will optimize norm and quant operations.
                Default: True
            fuse_qknorm_rope (bool): Whether to enable qknorm and rope fusion optimization.
                Default: True
            fuse_allreduce_rms (bool): Whether to enable allreduce and addrmsnorm fusion optimization.
                Default: False
            **kwargs: Additional optional parameters for forward compatibility and configuration extension.
        """
        from vllm_ascend.utils import is_310p

        if is_310p():
            if enable_npugraph_ex:
                logger.warning("npugraph_ex is not supported on Ascend 310P. Disabling it.")
            if enable_static_kernel:
                logger.warning(
                    "static kernel requires npugraph_ex, which is not supported on Ascend 310P. Disabling it."
                )
            enable_npugraph_ex = False
            enable_static_kernel = False

        self.fuse_norm_quant = fuse_norm_quant
        self.fuse_qknorm_rope = fuse_qknorm_rope
        self.fuse_allreduce_rms = fuse_allreduce_rms
        self.enable_npugraph_ex = enable_npugraph_ex
        self.enable_static_kernel = enable_static_kernel
        self.fuse_muls_add = kwargs.get("fuse_muls_add", True)
        if self.enable_static_kernel:
            assert self.enable_npugraph_ex, "Static kernel generation requires npugraph_ex to be enabled."
```

类型、默认值 `False`、以及一句话语义（allreduce + addrmsnorm 融合）的来源；同时证明这个类里没有任何与 SP 的互斥校验。

## vllm_ascend/ascend_config.py#L491-L521（releases/v0.23.0）

```python
    def update_compile_ranges_split_points(self):
        vllm_config = self.vllm_config
        if self.ascend_compilation_config.enable_npugraph_ex:
            if self.ascend_compilation_config.fuse_allreduce_rms:
                from vllm_ascend.compilation.passes.allreduce_rmsnorm_fusion_pass import ALLREDUCE_NORM_FUSE_THRESHOLD

                new_compile_ranges_split_points = self._get_compile_ranges(vllm_config.compilation_config)
                new_compile_ranges_split_points.append(ALLREDUCE_NORM_FUSE_THRESHOLD)
                new_compile_ranges_split_points = sorted(new_compile_ranges_split_points)
                self._set_compile_ranges(vllm_config.compilation_config, new_compile_ranges_split_points)
                logger.debug(
                    "Set compile_ranges_split_points to %s for matmul and allreduce fusion",
                    new_compile_ranges_split_points,
                )

        else:
            new_compile_ranges_split_points = self._get_compile_ranges(vllm_config.compilation_config)
            if vllm_config.additional_config.get("ascend_compilation_config", {}).get("fuse_allreduce_rms", True):
                from vllm_ascend.compilation.passes.allreduce_rmsnorm_fusion_pass import ALLREDUCE_NORM_FUSE_THRESHOLD

                new_compile_ranges_split_points.append(ALLREDUCE_NORM_FUSE_THRESHOLD)
                new_compile_ranges_split_points = sorted(new_compile_ranges_split_points)
                self._set_compile_ranges(vllm_config.compilation_config, new_compile_ranges_split_points)
                logger.debug(
                    "Set compile_ranges_split_points to %s for matmul and allreduce fusion",
                    new_compile_ranges_split_points,
                )

            if len(new_compile_ranges_split_points) > len(self._get_compile_ranges(vllm_config.compilation_config)):
                new_compile_ranges_split_points = sorted(new_compile_ranges_split_points)
                self._set_compile_ranges(vllm_config.compilation_config, new_compile_ranges_split_points)
```

开启后会往 `compile_ranges_endpoints` 插入 512 这个切分点，使编译区间在 512 处断开——`is_applicable_for_range` 才能干净地按区间开关。同时注意两个分支读的默认值不同：`enable_npugraph_ex` 为真时读类型化字段（默认 False），为假时读原始 dict（默认 True）。

## vllm_ascend/platform.py#L167-L173（releases/v0.23.0）

```python
    @classmethod
    def get_pass_manager_cls(cls) -> str:
        """
        Get the pass manager class for this platform.
        It will be registered as a custom pass under the current_platform.pass_key.
        """
        return "vllm_ascend.compilation.graph_fusion_pass_manager.GraphFusionPassManager"
```

证明 `GraphFusionPassManager` 就是昇腾平台实际生效的 pass manager，因而它 `configure()` 里那个 `default=True` 不是死代码。

## docs/source/user_guide/configuration/additional_config.md#L135-L142（releases/v0.23.0）

```markdown
| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `enable_npugraph_ex`               | bool | `True` | Whether to enable npugraph_ex backend.                                                 |
| `enable_static_kernel` | bool | `False` | Whether to enable static kernel. Suitable for scenarios where shape changes are minimal and some time is available for static kernel compilation. |
| `fuse_norm_quant`  | bool | `True` | Whether to enable fuse_norm_quant pass. |
| `fuse_qknorm_rope` | bool | `True` | Whether to enable fuse_qknorm_rope pass. If Triton is not in the environment, set it to False. |
| `fuse_allreduce_rms` | bool | `False` | Whether to enable fuse_allreduce_rms pass. It's set to False because of conflict with SP. |
| `fuse_muls_add` | bool | `True` | Whether to enable fuse_muls_add pass.|
```

官方参数表原文，也是「因与 SP 冲突所以默认关闭」这句话的唯一官方出处。

## docs/source/user_guide/release_notes.md#L1223-L1223（releases/v0.23.0）

```markdown
- Add Matmul Allreduce Rmsnorm fusion Pass. It's disabled by default. Set `fuse_allreduce_rms=True` in `--additional_config` to enable it. [#5034](https://github.com/vllm-project/vllm-ascend/pull/5034)
```

引入这个特性的 PR 与官方对「默认关闭」的表述。

## vllm_ascend/compilation/graph_fusion_pass_manager.py#L49-L69（main）

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

main 的去向证据：`fuse_allreduce_rms` 分支、`MatmulAllReduceAddRMSNormPass` 的 import、以及 SP 两个 pass 的注册全部消失；并且改为读类型化配置对象，注释明说不再直读原始 dict。

## vllm_ascend/ascend_config.py#L44-L58（main）

```python
@config
class AscendCompilationConfig:
    """Configuration for controlling the behavior of Ascend graph optimization.

    Migrated to ``@config`` (pydantic dataclass). Hardware-profile runtime
    downgrades (disable npugraph_ex / static_kernel) and the
    static_kernel→npugraph_ex dependency check are applied in an ``after``
    model_validator.
    """

    enable_npugraph_ex: bool = True
    enable_static_kernel: bool = False
    fuse_norm_quant: bool = True
    fuse_qknorm_rope: bool = True
    fuse_muls_add: bool = True
```

main 上字段已删除：同一个类里 `fuse_norm_quant` / `fuse_qknorm_rope` / `fuse_muls_add` 都在，唯独没有 `fuse_allreduce_rms`。

## vllm_ascend/ascend_config.py#L403-L406（main）

```python
    # ---- sub-configs (no vllm_config dep): pydantic dict→dataclass coercion ----
    ascend_compilation_config: AscendCompilationConfig = dataclasses.field(default_factory=AscendCompilationConfig)
    ascend_fusion_config: AscendFusionConfig = dataclasses.field(default_factory=AscendFusionConfig)
    eplb_config: EplbConfig = dataclasses.field(default_factory=EplbConfig)
```

`ascend_compilation_config` 在 main 上是类型化嵌套字段，用户传入的 dict 由 pydantic 强制转换成 `AscendCompilationConfig`——这是嵌套未知键会被 `extra="forbid"` 拦下的前提。

## vllm_ascend/config_utils.py#L43-L50（main）

```python
    merged_config = ConfigDict(extra="forbid")
    if config is not None:
        merged_config.update(config)

    def decorator(config_cls: type[ConfigT]) -> type[ConfigT]:
        return dataclass(config_cls, config=merged_config, **kwargs)  # type: ignore[return-value]

    return decorator if cls is None else decorator(cls)
```

`@config` 装饰器统一设置 `extra="forbid"`，因而 main 上继续传 `fuse_allreduce_rms` 不再被静默忽略。

## vllm_ascend/ascend_config.py#L620-L624（main）

```python
        self.enable_sp_by_pass = (
            vc.model_config is not None
            and not vc.model_config.enforce_eager
            and vc.compilation_config.pass_config.enable_sp
        )
```

证明 main 上 SP 这条路径仍然存在（`pass_config.enable_sp` 仍被读取）——被删掉的是冲突的另一方，不是 SP。

## docs/source/user_guide/configuration/additional_config.md#L103-L109（main）

```markdown
| Name | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `enable_npugraph_ex`               | bool | `True` | Whether to enable npugraph_ex backend.                                                 |
| `enable_static_kernel` | bool | `False` | Whether to enable static kernel. Suitable for scenarios where shape changes are minimal and some time is available for static kernel compilation. |
| `fuse_norm_quant`  | bool | `True` | Whether to enable fuse_norm_quant pass. |
| `fuse_qknorm_rope` | bool | `True` | Whether to enable fuse_qknorm_rope pass. If Triton is not in the environment, set it to False. |
| `fuse_muls_add` | bool | `True` | Whether to enable fuse_muls_add pass.|
```

main 官方参数表里 `fuse_allreduce_rms` 一行已经不存在（对比 v0.23.0 同表的 `#L135-L142`，其余五行逐行相同，只少了这一行），文档与代码同步删除。
