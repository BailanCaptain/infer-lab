# multistream_overlap_gate — 源码片段

两个 ref：`vllm-ascend@2c59ff10`（releases/v0.23.0）与 `vllm-ascend@28bf3a2e`（main）。

## vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L139-L140

```python
        self.multistream_overlap_shared_expert = additional_config.get("multistream_overlap_shared_expert", False)
        self.multistream_overlap_gate = additional_config.get("multistream_overlap_gate", False)
```

v0.23.0 上开关的唯一定义处：`additional_config` 里读一个 bool，默认 `False`。与紧邻的 `multistream_overlap_shared_expert` 是两个独立开关。

## vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L78-L79

```markdown
| `multistream_overlap_shared_expert` | bool | `False` | Whether to enable multi-stream shared expert. This option only takes effect on MoE models with shared experts. |
| `multistream_overlap_gate`          | bool | `False` | Whether to enable multi-stream overlap gate. This option only takes effect on MoE models with shared experts.  |
```

官方参数表原文，页面里要核对的那条描述。

## vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L372-L383

```python
            ascend_config = get_ascend_config()
            self._shared_experts = shared_experts
            has_shared_experts = self._shared_experts is not None

            self.shared_multistream_overlap_gate = ascend_config.multistream_overlap_gate and has_shared_experts
            self.enable_npugraph_ex_static_kernel = ascend_config.ascend_compilation_config.enable_static_kernel

            # flashcommon3 gate stream
            self.multistream_overlap_gate = ascend_config.multistream_overlap_gate
            if self.multistream_overlap_gate and AscendMoERunner.gate_stream is None:
                AscendMoERunner.gate_stream = torch.npu.Stream()
```

关键：只有 `shared_multistream_overlap_gate` 与 `has_shared_experts` 做了与；`self.multistream_overlap_gate` 直接取开关值，不带共享专家条件。这正是「文档说只对带共享专家的 MoE 生效」与实际行为的分歧点。同时是 `gate_stream`（第二条流）的创建处，`AscendMoERunner` 类级单例。

## vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L600-L640

```python
            if self.multistream_overlap_gate:
                fc3_context = get_flash_common3_context()
                assert fc3_context is not None
                assert AscendMoERunner.gate_stream is not None
                AscendMoERunner.gate_stream.wait_stream(torch.npu.current_stream())
                with npu_stream_switch(AscendMoERunner.gate_stream, enabled=self.multistream_overlap_gate):
                    # share_expert
                    assert fc3_context.shared_experts is not None
                    shared_out = fc3_context.shared_experts(hidden_states)
                    # NOTE: This is exactly the opposite of `maybe_all_reduce_tensor_model_parallel`
                    moe_comm_type = _EXTRA_CTX.moe_comm_type
                    if (
                        moe_comm_type in {MoECommType.ALLTOALL, MoECommType.MC2, MoECommType.FUSED_MC2}
                        and not shared_expert_dp_enabled()
                    ):
                        shared_out = tensor_model_parallel_all_reduce(shared_out)
                    set_flash_common3_context(shared_out=shared_out)
                    input_ids = getattr(get_forward_context(), "input_ids", None)

                    topk_weights, topk_ids = select_experts(
                        hidden_states=hidden_states,
                        router_logits=router_logits,
                        top_k=self.top_k,
                        use_grouped_topk=self.use_grouped_topk,
                        renormalize=self.renormalize,
                        topk_group=self.topk_group,
                        num_expert_group=self.num_expert_group,
                        custom_routing_function=self.custom_routing_function,
                        scoring_func=self.scoring_func,
                        routed_scaling_factor=self._original_routed_scaling_factor,
                        e_score_correction_bias=self.e_score_correction_bias,
                        num_experts=self.moe_config.num_experts,
                        input_ids=input_ids,
                        tid2eid=self.tid2eid,
                    )

                    if isinstance(_EXTRA_CTX.moe_comm_method, AllGatherCommImpl):
                        topk_weights = torch.ops.vllm.maybe_all_gather_and_maybe_unpad(topk_weights, True, True)
                        topk_ids = torch.ops.vllm.maybe_all_gather_and_maybe_unpad(topk_ids, True, True)

                    set_flash_common3_context(topk_weights=topk_weights, topk_ids=topk_ids)
```

页面主体：被挪到副流上的两段计算就是「共享专家前向（含 TP all-reduce）」和「`select_experts` 路由」；结果写进进程级 context。`assert fc3_context is not None` 与 `assert fc3_context.shared_experts is not None` 是「没有共享专家就直接失败」这条结论的依据。

## vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L655-L658

```python
            # Make sure the default stream waits for the gate stream to finish.
            if self.multistream_overlap_gate:
                assert AscendMoERunner.gate_stream is not None
                torch.npu.current_stream().wait_stream(AscendMoERunner.gate_stream)
```

重叠窗口的右边界：默认流在调用 `quant_method.apply` 前 join 回 gate 流。窗口 = `prepare()` 那一段。

## vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L834-L881

```python
        def shared_forward_impl(  # type: ignore[override]
            self, hidden_states: torch.Tensor, router_logits: torch.Tensor
        ):
            if self.shared_multistream_overlap_gate:
                set_flash_common3_context(shared_experts=self._shared_experts)

            if self.is_internal_router:
                gate = self.gate
                assert gate is not None
                # NOTE(Angazenn): To make this cast explicitly, the hbm usage might
                # increase with extra hidden states. We also assume that all gate
                # linear is unquantized so that we the weight is pre-casted in
                # process_weights_after_loading of AscendUnquantizedLinearMethod.
                hidden_states_fp32 = hidden_states.float()
                before_routed_experts = torch.npu.current_stream().record_event()
                router_logits = F.linear(hidden_states_fp32, gate.weight_fp32)
                after_routed_experts = torch.npu.current_stream().record_event()
            else:
                before_routed_experts = torch.npu.current_stream().record_event()
                after_routed_experts = None

            fused_moe_results = self.no_shared_forward_impl(
                hidden_states,
                router_logits,
                return_with_event=True,
            )
            routed_out = fused_moe_results.routed_out

            if self._shared_experts is None:
                return routed_out

            if self.shared_multistream_overlap_gate:
                fc3_context = get_flash_common3_context()
                assert fc3_context is not None
                shared_out = fc3_context.shared_out
            else:
                shared_out = self._forward_shared_experts(
                    hidden_states,
                    FusedMoEEvents(
                        after_routed_experts=after_routed_experts,
                        before_routed_experts=before_routed_experts,
                        before_dispatch=fused_moe_results.before_dispatch_evt,
                        before_gmm2=fused_moe_results.before_gmm2_evt,
                        before_combine=fused_moe_results.before_combine_evt,
                        swiglu_limit=fused_moe_results.swiglu_limit,
                    ),
                )
            return shared_out, routed_out
```

唯一往 context 里写 `shared_experts` 的地方（`set_flash_common3_context(shared_experts=...)`），且条件是 `shared_multistream_overlap_gate`——即必须有共享专家。取回时直接读 `fc3_context.shared_out`，不再走 `_forward_shared_experts`。

## vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L883-L894

```python
        def _forward_impl(
            self,
            hidden_states: torch.Tensor,
            router_logits: torch.Tensor,
            shared_experts_input: torch.Tensor | None,
            input_ids: torch.Tensor | None = None,
        ) -> torch.Tensor | tuple[torch.Tensor, torch.Tensor]:
            with self._sequence_parallel_context():
                if self.shared_experts is None:
                    return self.no_shared_forward_impl(hidden_states, router_logits)
                else:
                    return self.shared_forward_impl(hidden_states, router_logits)
```

无共享专家的模型直接进 `no_shared_forward_impl`，绕过了唯一写 context 的 `shared_forward_impl`——所以 `assert fc3_context is not None` 会命中。

## vllm-ascend@2c59ff10:vllm_ascend/flash_common3_context.py#L1-L42

```python
from dataclasses import dataclass

import torch
from vllm.model_executor.layers.linear import LinearBase


@dataclass
class FlashCommon3Context:
    gate: LinearBase | None = None
    topk_weights: torch.Tensor | None = None
    topk_ids: torch.Tensor | None = None
    row_idx: torch.Tensor | None = None
    shared_experts: torch.nn.Module | None = None
    shared_out: torch.Tensor | None = None


_flash_common3_context: FlashCommon3Context | None = None


def get_flash_common3_context() -> FlashCommon3Context | None:
    return _flash_common3_context


def set_flash_common3_context(
    topk_weights: torch.Tensor | None = None,
    topk_ids: torch.Tensor | None = None,
    shared_experts: torch.nn.Module | None = None,
    shared_out: torch.Tensor | None = None,
):
    global _flash_common3_context
    if _flash_common3_context is None:
        _flash_common3_context = FlashCommon3Context()

    if topk_weights is not None:
        _flash_common3_context.topk_weights = topk_weights
    if topk_ids is not None:
        _flash_common3_context.topk_ids = topk_ids
    if shared_experts is not None:
        _flash_common3_context.shared_experts = shared_experts
    if shared_out is not None:
        _flash_common3_context.shared_out = shared_out
```

跨流传结果的载体，是一个模块级全局单例（不是 per-layer、不是 per-request），页面里的「进程级单例」与字段清单出自这里。

## vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L52-L59

```python
    quant_stream: torch.npu.Stream | None = None

    def __init__(self, moe_config: FusedMoEConfig):
        self.moe_config = moe_config
        ascend_config = get_ascend_config()
        self.multistream_overlap_gate = ascend_config.multistream_overlap_gate
        if self.multistream_overlap_gate and PrepareAndFinalize.quant_stream is None:
            PrepareAndFinalize.quant_stream = torch.npu.Stream()
```

第二条被创建的流：`quant_stream`。开关一开就多两条 NPU stream（`gate_stream` + `quant_stream`），事实表里那一行的依据。

## vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L363-L399

```python
    def _prepare_with_ep_group(
        self, hidden_states: torch.Tensor, router_logits: torch.Tensor, quant_type=QuantType.NONE
    ) -> MoEPrepareOutput:
        pertoken_scale = None
        if quant_type == QuantType.W8A8:
            hidden_states, pertoken_scale = torch_npu.npu_dynamic_quant(hidden_states)
        elif quant_type in (QuantType.MXFP8, QuantType.W4A8MXFP):
            hidden_states, pertoken_scale = torch_npu.npu_dynamic_mx_quant(
                hidden_states,
                dst_type=torch.float8_e4m3fn,
            )
        elif quant_type == QuantType.MXFP4:
            hidden_states, pertoken_scale = torch_npu.npu_dynamic_mx_quant(
                hidden_states,
                dst_type=torch_npu.float4_e2m1fn_x2,
                round_mode="round",
            )

        if self.multistream_overlap_gate:
            assert PrepareAndFinalize.quant_stream is not None
            PrepareAndFinalize.quant_stream.wait_stream(torch.npu.current_stream())
            with npu_stream_switch(PrepareAndFinalize.quant_stream, enabled=self.multistream_overlap_gate):
                hidden_states = fc3_all_gather_and_maybe_unpad_impl(hidden_states)
        else:
            hidden_states = torch.ops.vllm.maybe_all_gather_and_maybe_unpad(hidden_states, True, True)
            router_logits = torch.ops.vllm.maybe_all_gather_and_maybe_unpad(router_logits, True, True)

        # TODO(fuzhihong): To adapt to self.num_token in the all_gather_input_id_with_dp_group method,
        #  when flashcomm1 is used and dp = N(N >=2).
        self.num_tokens = hidden_states.shape[0]

        if pertoken_scale is not None:
            pertoken_scale = torch.ops.vllm.maybe_all_gather_and_maybe_unpad(pertoken_scale, True, True)

        if self.multistream_overlap_gate:
            torch.npu.current_stream().wait_stream(PrepareAndFinalize.quant_stream)
```

与它并行的另一半：量化后的 `hidden_states` 在 `quant_stream` 上做 all-gather。注意开关打开的分支**不再 all-gather `router_logits`**——因为路由已经在 gate 流上算完存进 context 了。这是「只有读 context 的量化方法接得住」这条推论的依据。所在类是 `PrepareAndFinalizeWithAllGather`（同文件 L321）。

## vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L104-L108

```python
    if get_ascend_config().multistream_overlap_gate:
        global _FC3_QUANT_X
        _FC3_QUANT_X = init_model_parallel_group(
            group_ranks, get_world_group().local_rank, backend, group_name="fc3_quant_x"
        )
```

开关还多建一个 HCCL 通信组 `fc3_quant_x`（rank 划分与 `mc2` 组同一份 `group_ranks`）。事实表里「额外一个通信组」的依据。

## vllm-ascend@2c59ff10:vllm_ascend/distributed/utils.py#L21-L47

```python
def fc3_all_gather_and_maybe_unpad_impl(
    x: torch.Tensor,
) -> torch.Tensor:
    try:
        forward_context = get_forward_context()
    except AssertionError:
        return x
    x = get_fc3_quant_x_group().all_gather(x, 0)
    dp_metadata = forward_context.dp_metadata
    if dp_metadata is None:
        pad_size = _EXTRA_CTX.pad_size
        if pad_size > 0:
            x = x[:-pad_size]
    else:
        # unpad
        num_tokens_across_dp_cpu = dp_metadata.num_tokens_across_dp_cpu
        result = torch.empty((num_tokens_across_dp_cpu.sum(), *x.shape[1:]), device=x.device, dtype=x.dtype)
        dp_size = get_dp_group().world_size
        x = x.view(dp_size, _EXTRA_CTX.padded_length, *x.shape[1:])
        offset = 0
        for idx in range(dp_size):
            num_tokens_dp = num_tokens_across_dp_cpu[idx]
            result[offset : offset + num_tokens_dp] = x[idx, :num_tokens_dp]
            offset += num_tokens_dp
        x = result
    return x
```

副流上真正跑的通信：走专用的 `fc3_quant_x` 组 all-gather，而不是复用 `torch.ops.vllm.maybe_all_gather_and_maybe_unpad`。为什么要另建组（自定义算子不方便挂到非默认流上）在正文里作为推断给出。

## vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_dynamic.py#L262-L269

```python
        if self.multistream_overlap_gate:
            fc3_context = get_flash_common3_context()
            assert fc3_context is not None, (
                "[vllm-ascend/W8A8_DYNAMIC] flash_common3 context is required when multistream_overlap_gate is enabled."
            )
            topk_weights = fc3_context.topk_weights
            topk_ids = fc3_context.topk_ids
        else:
            topk_weights, topk_ids = select_experts(
                hidden_states=x,
                router_logits=router_logits,
```

消费端：量化方法跳过自己的 `select_experts`，改读 context。只有 `w8a8_dynamic` 与 `w8a8_mxfp8` 两个量化方法有这段；未量化的 MoE 方法没有。

## vllm-ascend@2c59ff10:vllm_ascend/lora/fused_moe.py#L82-L87

```python
    if getattr(base_layer, "multistream_overlap_gate", False):
        raise AssertionError(
            "multistream_overlap_gate=True interleaves quant_method.apply "
            "calls on multiple streams; the MoE LoRA path has not been "
            "validated under this overlap. Disable it for MoE LoRA."
        )
```

硬互斥：与 MoE LoRA v1 同开直接抛 `AssertionError`。

## vllm-ascend@2c59ff10:vllm_ascend/_310p/fused_moe/fused_moe.py#L182-L184

```python
            self.multistream_overlap_gate = False
            self.shared_multistream_overlap_gate = False
            self.multistream_overlap_shared_expert = False
```

310P（Atlas 300I Duo / 200I Pro）路径上无条件置 `False`，用户设了也不生效。

## vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L192-L207

```python
        ascend_config = get_ascend_config()
        self.multistream_overlap_shared_expert = ascend_config.multistream_overlap_shared_expert and has_shared_experts
        self.shared_multistream_overlap_gate = ascend_config.multistream_overlap_gate and has_shared_experts
        if self.multistream_overlap_shared_expert:
            logger.info_once("[fused_moe/layer] Multistream overlap shared expert is enabled.")
        if enable_sp() and has_shared_experts:
            logger.info_once(
                "[fused_moe/layer] Sequence parallelism is enabled, shared experts are replicated for best performance."
            )

        # flashcommon3 gate stream
        self.multistream_overlap_gate = ascend_config.multistream_overlap_gate
        if self.multistream_overlap_gate and AscendFusedMoE.gate_stream is None:
            AscendFusedMoE.gate_stream = torch.npu.Stream()
        if self.multistream_overlap_gate:
            logger.info_once("[fused_moe/layer] Multistream overlap gate is enabled.")
```

v0.23.0 同时带着 legacy 的 `AscendFusedMoE`，门控逻辑与 `AscendMoERunner` 一致（各自持有一条类级 `gate_stream`），说明这不是单条代码路径的特例。也是「开了会打日志 `Multistream overlap gate is enabled.`」的出处。

## vllm-ascend@28bf3a2e:docs/source/user_guide/release_notes.md#L114-L120

```markdown
### Ready to Deprecate

The following features and optimizations are planned for deprecation in a future release:

- Layer sharding.
- FlashComm2.
- The FlashComm3 multistream-overlap gate.
```

上游对这个开关的官方定名与去向：v0.23.0 发版时已列入待废弃。页面里「main 上已删」的官方说法依据。

## vllm-ascend@28bf3a2e:docs/source/user_guide/configuration/additional_config.md#L58-L60

```markdown
| `enable_shared_expert_dp`           | bool | `False` | Replicate shared-expert weights across TP ranks and run the shared expert with data parallelism. This option is independent of upstream MoE sequence parallelism; either feature or both can be enabled. It improves performance but consumes more memory. |
| `multistream_overlap_shared_expert` | bool | `False` | Whether to enable multi-stream shared expert. This option only takes effect on MoE models with shared experts. |
| `enable_cpu_binding`                | bool | `True`  | Enables Ascend-native CPU binding on ARM servers. Set to `False` to disable. See [CPU Binding](../feature_guide/cpu_binding.md). |
```

main 的参数表里 `multistream_overlap_shared_expert` 之后直接是 `enable_cpu_binding`，`multistream_overlap_gate` 这一行已经不存在；`multistream_overlap_shared_expert` 保留下来，说明被删的只是 gate 这一个开关。

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

main 上 `AscendConfig` 是 pydantic 模型且 `extra="forbid"`，所以留在启动脚本里的 `multistream_overlap_gate` 不会被静默忽略，而是当作未知键报错。这是「升级 main 前必须从命令行里删掉」的依据。
