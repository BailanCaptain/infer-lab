---
id: multistream-overlap-gate
title: multistream_overlap_gate
type: param
summary: >-
  v0.23.0 的 FlashComm3 门控重叠开关，把共享专家前向与 select_experts 路由挪到副流，与 MoE prepare
  里的动态量化 + all-gather 并行；v0.24.0rc 起整套实现已删除，键留在启动命令里 v0.26 上被静默忽略、main 通常拒收，能发现
  vLLM-Omni 时会警告并过滤未知顶层键。
aliases:
  - FlashComm3 多流重叠门控
  - 多流门控重叠
chapters:
  - '14'
sources:
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L139-L140'
  - >-
    vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L78-L79
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L372-L383'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L600-L640'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L655-L658'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L834-L881'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L883-L894'
  - 'vllm-ascend@2c59ff10:vllm_ascend/flash_common3_context.py#L1-L41'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L52-L59'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L363-L399'
  - 'vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L104-L108'
  - 'vllm-ascend@2c59ff10:vllm_ascend/distributed/utils.py#L21-L47'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_dynamic.py#L262-L269
  - 'vllm-ascend@2c59ff10:vllm_ascend/lora/fused_moe.py#L82-L87'
  - 'vllm-ascend@2c59ff10:vllm_ascend/_310p/fused_moe/fused_moe.py#L182-L184'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L192-L207'
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L235-L241'
  - >-
    vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L59-L61
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L437-L455'
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L140
  - 'vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L56-L64'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1679'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L73'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L153-L153'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L438-L494'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L268-L291'
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
evidence: C
relations:
  - to: ascend-config-system
    kind: builds-on
    note: >-
      它是 additional_config 里的一个键，main 上通常让启动失败的不是 MoE 代码，而是 AscendConfig 那层
      extra="forbid" 的模式校验
contradicts: []
updated: '2026-10-08'
rawSources:
  - >-
    raw/sha256-36624e5fb90c839df56eefbde64f189759712d22035d7e1b93292fb9afd596fb.md
  - >-
    raw/sha256-88d6f3fe29d6159c03e5648c07ca4bf766dc05c0f6547e10b189260cb1c34c59.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
---

## 一句话

`multistream_overlap_gate` 是 v0.23.0 上的 bool 开关（默认 `False`），把 MoE 层里的**共享专家前向**（每个 token 都要过的那一个专家，见 [MoE 的共享专家](../concepts/moe.md#共享专家每个-token-都要过的那一个)）和 **`select_experts` 路由**（给每个 token 挑专家，见[跟着一个 token 走一遍](../concepts/moe.md#moe-怎么算跟着一个-token-走一遍)）整体搬到一条副流 `gate_stream` 上，让它们与主线里的「动态量化 + all-gather 隐藏态」并行跑。这里的 **stream（流）** 是 NPU 上一条按顺序执行的任务队列：同一条流里的活一件接一件做，不同流上的活可以同时在设备上跑；模型默认在一条主流上跑，另开的叫副流。一条流停下来等另一条流做完、再接着往下走，本页叫 **join（汇合）**——汇合之后才能用对方算出的结果。上游管它叫 **FlashComm3 multistream-overlap gate** [S17]。

它挑食得厉害：模型得有共享专家、MoE 得是 W8A8-dynamic 或 MXFP8 量化的、序列并行得开着（vllm-ascend 自己的 FlashComm1，或者图编译 pass 版的 SP，两者都算，见[序列并行在 vllm-ascend 里的接法](../concepts/sequence-parallel.md#vllm-ascend-里的-sp-是怎样接进去的)）——三条少一条，要么白开，要么第一次前向直接断言失败。反过来说，稠密模型（没有 MoE 层）、或者只有一张卡、没有专家并行的部署，这个开关根本无处可用。GLM 双机这条主线没开这个键；硬开会怎样，见「开了的代价」最后一段。

**存在范围**：它到 v0.23 维护分支为止能用，v0.24.0rc 起这个开关连同整套 FlashComm3 实现被删干净，v0.26 分支（2026-09-17 的源码快照）与 main 开发主线上都不剩一处引用，是哪个 PR 删的见下面「版本谱系」。**升级前都得从启动命令里删掉，但两边留着的后果不同** [!]：v0.26 的 `AscendConfig` 还是普通类，逐个键 `.get()` 取值，不认识的键被静默忽略 [C23]，服务照常起来、重叠一次都不会发生；main 的 `extra="forbid"` 通常会拒收；若能发现 vLLM-Omni，未知顶层键会警告并过滤，功能仍已删除（详见「开了的代价」第 8 条）。

## 事实表

| 项 | v0.23.0 | v0.26.0rc | main | 意味着什么 |
|---|---|---|---|---|
| 配置键与默认值 | `additional_config.multistream_overlap_gate`，bool，`False` | 不存在，未知键静默忽略 | 不存在，被当未知键拒掉 | 升级前两边都要删：v0.26 上留着是白留，main 上留着起不来（装了 `vllm_omni` 才降成 warning）[C22] |
| GLM 双机这条线 | GLM 代码所在的 db701c1f 上键还在、默认 `False`，官方部署没开，MoE 走不带门控的直路 | 键不存在 | 键不存在，留着起不来 | 主线没用它；序列并行也没开，硬开按源码推多半对不上，见「开了的代价」末段 |
| 上游状态 | 发版时即列入 Ready to Deprecate | 已移除 | 已移除 | 不要往新部署里投入，v0.23.0 上也只当短期手段 |
| 搬到副流的计算 | 共享专家前向（含 TP all-reduce）+ `select_experts` | 不存在 | 不存在 | 省的是这两段，**不是**路由专家的 GEMM |
| 与之并行的主线 | `_prepare_with_ep_group` 的动态量化 + all-gather | 不存在 | 不存在 | 重叠窗口只有 `prepare()` 这一段，见「开了的代价」 |
| 新建 NPU stream | 2 条：`gate_stream` + `quant_stream` | 不存在 | 不存在 | 每条流有独立内存池，显存会多占一块 [I] |
| 新建 HCCL 通信组 | 1 个，`group_name="fc3_quant_x"` | 不存在 | 不存在 | 多一份通信域资源，启动时多一次建组 |
| 能接住它的量化方法 | 只有 `w8a8_dynamic` 与 `w8a8_mxfp8` | 不存在 | 不存在 | 未量化（BF16）MoE 上没有接收端 [D] |
| 有无共享专家时的降级 | 无：`self.multistream_overlap_gate` 直接取开关值，只有 `shared_multistream_overlap_gate` 与 `has_shared_experts` 做与 | 不存在 | 不存在 | 官方描述里的「只对带共享专家的 MoE 生效」不是静默降级 [!] |
| 硬互斥 / 硬失效 | MoE LoRA v1 同开抛 `AssertionError`；310P 路径无条件置 `False` | 不存在 | 不存在 | 前者二选一无自动降级；后者在 Atlas 300I Duo / 200I Pro 上设了也白设 |

## 为什么存在

MoE 层在做专家计算之前有一段串行的「准备期」（prepare）。开着序列并行、MoE 又走 AllGather 路径时，这一段是：先把本卡的隐藏态动态量化成 int8/fp8，再在 EP 组里做一次 [All-Gather](../concepts/collective-communication.md#all-gather) 拼成全局张量。为什么要收、在哪个组里收、量化让这次载荷小了多少，见[序列并行的 MoE 接法](../concepts/sequence-parallel.md#vllm-ascend-里的-sp-是怎样接进去的)；什么时候走 AllGather、什么时候走 MC2，见[专家并行](../concepts/expert-parallel.md#mc2-还是-allgather)，本页不重推。这段时间里 NPU 的计算单元基本闲着——它在等通信。而同一层里还有两件不依赖这次收集的活可以现在就干：**共享专家的 FFN**（输入就是还没收集的本地隐藏态）和 **`select_experts` 路由**（输入是 `router_logits`）。这个开关做的就是把这两件活挪到另一条流上，塞进那段等待里。

它的名字里有 "FlashComm3"，是因为它只在序列并行开着时的那条路径上才有意义：`PrepareAndFinalizeWithAllGather.prepare` 只有在 `enable_sp() or enable_sp_by_pass()` 为真时才走 `_prepare_with_ep_group`，也就是上面那次「先量化、再在 EP 组里收齐」的路 [C10]。前一个函数看 FlashComm1 开没开；后一个是图编译 pass 版的 SP，条件是不强制 eager 且编译配置里打开了 `enable_sp`。两者都没开时走的是另一条按 DP 组收集的分支，`quant_stream` 那半边的逻辑一行都不在里面。

跨流传结果靠一个模块级全局单例 `FlashCommon3Context`，实际用来传结果的是 `topk_weights` / `topk_ids` / `shared_experts` / `shared_out` 这 4 个字段（类里另有 `gate`、`row_idx` 两个字段，这个开关不写它们）。

```wiki-diagram
file: multistream-overlap-gate
```

图里的汇合（join）点是硬约束：`quant_stream` 在 `_prepare_with_ep_group` 内部就 join 回来 [C10]，`gate_stream` 在调用 `quant_method.apply` 之前 join [C4]。所以真正的重叠窗口只有 `prepare()` 这一段，收益上限是 `min(共享专家前向 + 路由, 动态量化 + all-gather)`，而不是两段时间之和 [D]。

两条副流都是**类级单例**：`gate_stream` 挂在 MoE 层的类上（配 vLLM 0.23.0 实际加载的 legacy 实现里是 `AscendFusedMoE`，新实现里是 `AscendMoERunner`）、`quant_stream` 挂在 `PrepareAndFinalize` 上，第一次构造时才建，不随层数增长。

副流上的 all-gather 走的是专门新建的 `fc3_quant_x` 通信组（rank 划分与 `mc2` 组共用同一份 `group_ranks`），调用 `fc3_all_gather_and_maybe_unpad_impl` 而不是主线用的 `torch.ops.vllm.maybe_all_gather_and_maybe_unpad`。另起一个组和一个纯 Python 实现，看起来是为了避开自定义算子在非默认流上的行为问题 [I]。

消费端在量化方法里：`apply()` 发现开关开着就跳过自己的 `select_experts`，改从 context 取 `topk_weights` / `topk_ids`。**只有 `w8a8_dynamic` 和 `w8a8_mxfp8` 两个量化方法有这段**——未量化的 MoE 方法不读 context，而开关打开时 `_prepare_with_ep_group` 又不再 all-gather `router_logits`，两边对不上，所以这个开关实质上绑定在 W8A8 / MXFP8 量化 MoE 上 [D]。

v0.23.0 里 `AscendMoERunner`（新）和 `AscendFusedMoE`（legacy）两套实现都带同一份门控逻辑，各持一条类级 `gate_stream`。配 vLLM 0.23.0 时 `fused_moe.py` 换上的是 legacy 那套，它在开启时打一条 info 日志，原文是 `[fused_moe/layer] Multistream overlap gate is enabled.`（`fused_moe_0_23_0.py` 第 207 行，`info_once`，整个进程只打一次），可以用它确认是否真的生效；新实现里没有这条日志。

**至于省多少**：v0.23.0 仓库里没有给出任何针对这个开关的收益数字或 e2e 基准，官方参数表也只有一句功能描述（线上：<https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html>）。按上面的窗口分析，它的收益完全取决于 `prepare()` 里那次 EP all-gather 有多长——EP 规模大、每步 token 少的 decode 场景窗口最宽，序列长时量化+通信被计算淹没，收益趋近于零 [D]。这里有个前提：这一步得真走 AllGather 路径。A2 上 token 数不超过 MC2 容量的小批走的是 MC2，它的准备期只补齐、切片，不发通信，没有能藏的等待（即使开着 SP 也一样，见[序列并行页](../concepts/sequence-parallel.md#放到-glm-双机这套部署开了-sp-吗)那段「假如打开」）。

## 开了的代价

**1. 没有共享专家的 MoE 上，它不是「不生效」，是起不来。** 官方描述写的是 "This option only takes effect on MoE models with shared experts"，容易读成「没有共享专家时自动忽略」。源码不是这样：`self.multistream_overlap_gate` 直接等于开关值，只有另一个字段 `shared_multistream_overlap_gate` 才与 `has_shared_experts` 做了与 [C3]。而往 context 里写 `shared_experts` 的唯一一处在 `shared_forward_impl` 里，条件正是 `shared_multistream_overlap_gate`；没有共享专家的模型从不经过那一处，context 单例也就一直没建出来。配 vLLM v0.23.0 时实际加载的是 legacy 那套（`fused_moe_0_23_0.py` 里的 `AscendFusedMoE`），没有共享专家时 runner 直接调层的 `forward_impl`，进门控分支的第一句 `assert fc3_context is not None` 就断；新实现里同一句断言在 `no_shared_forward_impl` 里。两处都是不带消息的裸断言，日志里只有 `AssertionError` 和这一行代码，第一次前向时命中 [D]。**只在带共享专家的 MoE（DeepSeek 系、GLM-5 系、Qwen3 MoE 的共享专家变体）上开它。**

**2. 必须是 W8A8-dynamic 或 MXFP8 量化的 MoE。** 理由见上一节「消费端」那段。

**3. 必须开着序列并行（FlashComm1 或图编译 pass 版 SP）。** `quant_stream` 那半边的逻辑只写在 `_prepare_with_ep_group` 里，而 `prepare()` 只有 `enable_sp() or enable_sp_by_pass()` 为真时才走这条分支；否则 `gate_stream` 这半边照样跑，`quant_stream` 那半边不跑，重叠就没了 [D]。多卡部署在 SP 没开时还不止「白开」：主线这边，MC2 路径会把隐藏态补齐后按 TP 切片，AllGather 路径会按 DP 组把隐藏态收齐，而副流算出的路由结果都没跟着变，两边可能行数对不上，GLM 双机就是这种情况，见本节最后一段。开着 FlashComm1 时隐藏态已经是本卡那几行，MC2 不再补齐切片，AllGather 路径也会给路由结果补收一次，两边对得上。只开图编译 pass 版 SP 时，AllGather 路径同样会补收；MC2 路径是否补齐切片只看 FlashComm1，这种组合下两边对不对得上，待核：缺这时 MC2 准备期拿到的隐藏态行数。

**4. 与 MoE LoRA v1 硬互斥。** 同开会抛 `AssertionError`，消息原文是 "multistream_overlap_gate=True interleaves quant_method.apply calls on multiple streams; the MoE LoRA path has not been validated under this overlap. Disable it for MoE LoRA."（`vllm_ascend/lora/fused_moe.py` 第 82–87 行，v0.23 维护分支与 GLM 所在的 db701c1f 逐字相同）。意思是：开关会让 `quant_method.apply` 在多条流上交错，LoRA 路径没有在这种重叠下验证过，没有自动降级，只能二选一。

**5. 310P 上无条件失效。** `_310p` 的 MoE 路径把 `multistream_overlap_gate`、`shared_multistream_overlap_gate`、`multistream_overlap_shared_expert` 三个字段一起置 `False`，用户配了不会报错也不会生效。

**6. 额外资源：2 条 NPU stream + 1 个 HCCL 通信组。** 流是类级单例，不随层数增长，通信组在 `init_ascend_config` 之后建组时创建。多流各自持有内存池，显存开销会有可观察的增加 [I]。

**7. 它和 `multistream_overlap_shared_expert` 是两个开关，共享专家只会被其中一个接管。** 后者把共享专家挪到 `shared_experts_calculation_stream()`；前者把共享专家挪到 `gate_stream` 并顺带把路由也带走，取结果时直接读 `fc3_context.shared_out`，完全不走 `_forward_shared_experts`。两个开关都开时共享专家由 gate 路径接管，`multistream_overlap_shared_expert` 那条分支变成死代码 [D]。注意 `multistream_overlap_shared_expert` 在 v0.26 分支 [C24] 和 main 开发主线 [S18] 上都仍然活着，参数表里还有它那一行——被删的只是 gate 这一个，别把两个一起当成废弃项删掉。

**8. 去向：v0.24.0rc 起整套删干净了。** v0.23.0 的 release notes 发版时就把 "The FlashComm3 multistream-overlap gate" 写进了 Ready to Deprecate [S17]；v0.26.0rc1 的「Deprecation and Breaking Changes」里兑现成一条 "Removed multistream overlap gate."，PR [#11956](https://github.com/vllm-project/vllm-ascend/pull/11956) [S21]。v0.26 分支与 main 上参数表里这一行都没有了 [S18]，`flash_common3_context.py`、`fc3_quant_x` 通信组、`fc3_all_gather_and_maybe_unpad_impl` 也一并不在。

**迁移时这是第一个要删的东西，而且两个目标版本的报错方式不一样。** 到 main，`AscendConfig` 是 pydantic 模型且 `model_config = ConfigDict(extra="forbid")` [C19]，留在 `--additional-config` 里的这个键不会被静默忽略，而是在构造配置时就报未知选项、让进程起不来。这条报错的文字由 pydantic 库生成，vllm-ascend 源码里没有自己写的原文（待核：缺 main 上带这个键启动的实际日志）。**只有一个例外**：进程里装了 `vllm_omni` 时，工厂会把所有未知键先打一条 warning 再从 kwargs 里剔掉，warning 原文是 "The following additional_config keys are invalid for vLLM-Ascend: %s. They may be used by vLLM-Omni or another project. Please remove them if they are not needed for your use case."，`%s` 处是排好序的未知键列表；这时它才是「被忽略」而不是「起不来」[C22]。别指望这个例外——它是给 vLLM-Omni 共用这份配置留的口子，不是给废弃键兜底的。到 v0.26 分支则根本没有这道校验，键安安静静地被跳过，启动日志里那条 `[fused_moe/layer] Multistream overlap gate is enabled.` 自然也不会再出现——想确认重叠有没有生效，就靠这条日志。

**放到 GLM 双机：主线没开它；硬开的话，按源码推多半对不上（待核）。** 那套部署是两台 A2、TP8 / DP2 / EP16、W8A8（见[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)）。GLM 的代码在 db701c1f 上，这个键在那里还在、默认 `False`，官方启动命令没传它，所以 42 层 MoE 都走不带门控的直路，共享专家排在路由专家之后串行算（见 [MoE 页的共享专家一节](../concepts/moe.md#共享专家按-tp8-切走融合算子)）。三条前提它占了两条：有 1 个共享专家、路由专家走 W8A8 动态量化；缺的是序列并行，FlashComm1 和图编译 pass 版 SP 这套部署都没开（见[序列并行页](../concepts/sequence-parallel.md#放到-glm-双机这套部署开了-sp-吗)）。

假如在这套部署上硬把它打开，按 db701c1f 的源码一步步推，示例请求 R1 的一步（每边 4 个 token，走 MC2；补齐与切片的形状见[一条请求的 MoE 通信](../concepts/one-request.md#moe-通信走-mc2-还是-allgather)）会变成这样：

- 启动时多建 2 条副流和 `fc3_quant_x` 通信组，日志多出那条 `[fused_moe/layer] Multistream overlap gate is enabled.`（GLM 这条线配的是 vLLM 0.23.0，加载的正是会打这条日志的 legacy 实现）。
- 每层 MoE，副流上先算共享专家、并在副流上做它那次 TP8 All-Reduce，接着在完整的 4 个 token 上算路由，得到 4 行「选了哪 8 个专家」的结果 [C25]。
- 主线同时做 MC2 的准备：4 行补到 8 行，TP8 每卡只留 1 行 [C26]。这一步不发任何通信，没有能藏进去的等待。
- 两条流在专家计算之前汇合，量化方法直接拿副流那 4 行路由结果，去配本卡这 1 行隐藏态。源码只在走 AllGather 时给路由结果补了一次收集，MC2 路径没有对应的切分，两边行数对不上 [I]。

所以对这条主线，就算不出错，重叠窗口也只有补齐和切片这点活，省不下时间；按源码读，更可能的是路由结果和隐藏态行数不一致。超过 128 个 token、翻到 AllGather 的大批同理：SP 没开时主线按 DP 组把隐藏态收齐，而副流给路由结果的那次补收只在 FlashComm1 或图编译 pass 版 SP 开着时才真的收，这套部署两者都关，同样可能对不上。到底是派发算子报形状错，还是不报错却算错，**待核：缺在真机上带这个键跑一次的日志**；本页也没有任何针对它的收益实测数，不给加速比。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| releases/v0.13.0 | 有（5 个文件） |
| releases/v0.18.0 | 有（5 个文件） |
| releases/v0.20.2rc | 有（5 个文件） |
| releases/v0.21.0rc | 有（6 个文件） |
| releases/v0.22.1rc | 有（6 个文件） |
| releases/v0.23.0 | 有（9 个文件） |
| releases/v0.24.0rc | 无 |
| releases/v0.25.1rc | 无 |
| releases/v0.26.0rc | 无 |
| releases/v0.27.1rc | 无 |
| releases/v0.28.0rc | 无 |
| releases/v0.29.0rc | 无 |
| main | 无 |

- **引入**：2025-12-14 · ba28d54f359278c83ed0f55ba78de9b1996f2b12 · PR [#4065](https://github.com/vllm-project/vllm-ascend/pull/4065) —— [Perf]enable prefill flashcommon3 (#4065)
  包含该提交的 tag：v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann
  - `vllm_ascend/ops/fused_moe/fused_moe.py` +87 / −21（文本行变化）
  - `vllm_ascend/quantization/w8a8_dynamic.py` +22 / −12（文本行变化）
  - `vllm_ascend/ops/fused_moe/prepare_finalize.py` +29 / −5（文本行变化）
  - `vllm_ascend/distributed/parallel_state.py` +21 / −1（文本行变化）
  - `vllm_ascend/distributed/utils.py` +32 / −1（文本行变化）
- **移除**：2026-07-15 · 77baade98ded755b3e5ea30091bcf40a30ae0335 · PR [#11956](https://github.com/vllm-project/vllm-ascend/pull/11956) —— [Refactor] Remove multistream overlap gate (#11956)
  包含该提交的 tag：v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2；分支：main、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel
  - `vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py` +11 / −76（文本行变化）
  - `vllm_ascend/ops/fused_moe/fused_moe.py` +11 / −75（文本行变化）
  - `vllm_ascend/flash_common3_context.py` +0 / −41（文本行变化）
  - `vllm_ascend/distributed/utils.py` +1 / −34（文本行变化）
  - `vllm_ascend/quantization/methods/w8a8_dynamic.py` +18 / −29（文本行变化）

当前含该标识符的 tag：v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1

## 参数定义（自动生成）

> 此节由参数扫描结果生成；静态定义不保证运行时最终值。

| 项 | 静态记录 |
| --- | --- |
| 标识 | `additional_config["multistream_overlap_gate"]` |
| 类型 | `unknown` |
| 默认表达式 | `False` |
| 定义 | `vllm_ascend/ascend_config.py:140` [C20] |
| 版本 | releases/v0.23.0 · 2c59ff1047573f40a471cf7535f01a8877344415 |

字段注释：

源码未提供字段注释。

约束线索（须结合 validator 的控制流核对，不作为独立运行时保证）：

## 已废弃的说法

### 2026-10-08 · 修订 246c6aa2616ddd09

旧说法（历史记录，已废弃）：

```text
main 的 `extra="forbid"` 则把它当错别字拒绝，进程直接起不来（唯一的例外见「开了的代价」第 8 条）。
```

替代结论：

```text
main 的 `extra="forbid"` 通常会拒收；若能发现 vLLM-Omni，未知顶层键会警告并过滤，功能仍已删除（详见「开了的代价」第 8 条）。
```

废弃依据（来源是否支持结论仍须人审）：

- `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1679`

旧文的来源编号（仅解释上方历史原文）：

1. `vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L139-L140`
2. `vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L78-L79`
3. `vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L372-L383`
4. `vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L600-L640`
5. `vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L655-L658`
6. `vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L834-L881`
7. `vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L883-L894`
8. `vllm-ascend@2c59ff10:vllm_ascend/flash_common3_context.py#L1-L41`
9. `vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L52-L59`
10. `vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L363-L399`
11. `vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L104-L108`
12. `vllm-ascend@2c59ff10:vllm_ascend/distributed/utils.py#L21-L47`
13. `vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_dynamic.py#L262-L269`
14. `vllm-ascend@2c59ff10:vllm_ascend/lora/fused_moe.py#L82-L87`
15. `vllm-ascend@2c59ff10:vllm_ascend/_310p/fused_moe/fused_moe.py#L182-L184`
16. `vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L192-L207`
17. `vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L235-L241`
18. `vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L59-L61`
19. `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L437-L455`
20. `vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ascend_config.py#L140`
21. `vllm-ascend@baa023ad:docs/source/user_guide/release_notes.md#L56-L64`
22. `vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1660-L1679`
23. `vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L73`
24. `vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L153-L153`
25. `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L438-L494`
26. `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L268-L291`
