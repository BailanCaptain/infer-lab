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
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/prepare_finalize.py#L351-L399'
  - 'vllm-ascend@2c59ff10:vllm_ascend/distributed/parallel_state.py#L104-L108'
  - 'vllm-ascend@2c59ff10:vllm_ascend/distributed/utils.py#L21-L47'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_dynamic.py#L262-L269
  - 'vllm-ascend@2c59ff10:vllm_ascend/lora/fused_moe.py#L75-L87'
  - 'vllm-ascend@2c59ff10:vllm_ascend/_310p/fused_moe/fused_moe.py#L143-L184'
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
  - >-
    raw:sha256-d38ceded99e5ddc680dc7956be0c8b72c57648f1fe2a604334d6a4d605c3e3d6.md#L1-L507
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/ops/fused_moe/prepare_finalize.py#L381-L398
  - >-
    vllm-ascend@2c59ff1047573f40a471cf7535f01a8877344415:vllm_ascend/distributed/utils.py#L21-L44
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L577-L581'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L832-L847'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L1844-L1912'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/methods/w8a8_mxfp8.py#L285-L318'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe.py#L290-L298'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L673-L721'
  - 'vllm-ascend@2c59ff10:vllm_ascend/_310p/fused_moe/fused_moe.py#L188-L259'
  - 'vllm-ascend@2c59ff10:vllm_ascend/_310p/fused_moe/fused_moe.py#L310-L367'
verified:
  - main
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0rc2
evidence: C
relations:
  - to: ascend-config-system
    kind: builds-on
    note: >-
      它是 additional_config 里的一个键，main 上通常让启动失败的不是 MoE 代码，而是 AscendConfig 那层
      extra="forbid" 的模式校验
contradicts: []
updated: 2026-11-03T00:00:00.000Z
rawSources:
  - >-
    raw/sha256-36624e5fb90c839df56eefbde64f189759712d22035d7e1b93292fb9afd596fb.md
  - >-
    raw/sha256-46ac2bccb9747d7b0cac39aeb069990d5bde8cc3ad91bd6f37d002973c94897a.md
  - >-
    raw/sha256-88d6f3fe29d6159c03e5648c07ca4bf766dc05c0f6547e10b189260cb1c34c59.md
  - >-
    raw/sha256-9daa2e46e9b22baee085d38bb2acc8c292168ab314f18ddfc5ae277f4533e295.md
  - >-
    raw/sha256-d38ceded99e5ddc680dc7956be0c8b72c57648f1fe2a604334d6a4d605c3e3d6.md
---

## 一句话

**v0.30.0rc2 对照。** rc2 没有恢复这个旧 FlashComm3 配置键；普通 Ascend 进程传入它会按未知顶层键拒收。新配置 multistream_overlap_shared_expert 默认 false，且融合 MC2 路径会告警关闭它；它有自己的适用条件，不是旧 gate 键的别名。下面的 gate stream 走读仍对应原先的 v0.23 快照。

`multistream_overlap_gate` 是 v0.23.0 上的 bool 开关（默认 `False`），把 MoE 层里的**共享专家前向**（每个 token 都要过的那一个专家，见 [MoE 的共享专家](../concepts/moe.md#共享专家每个-token-都要过的那一个)）和 **`select_experts` 路由**（给每个 token 挑专家，见[跟着一个 token 走一遍](../concepts/moe.md#moe-怎么算跟着一个-token-走一遍)）整体搬到一条副流 `gate_stream` 上，让它们与主线里的「动态量化 + all-gather 隐藏态」并行跑。这里的 **stream（流）** 是 NPU 上一条按顺序执行的任务队列：同一条流里的活一件接一件做，不同流上的活可以同时在设备上跑；模型默认在一条主流上跑，另开的叫副流。一条流停下来等另一条流做完、再接着往下走，本页叫 **join（汇合）**——汇合之后才能用对方算出的结果。上游管它叫 **FlashComm3 multistream-overlap gate** [S17]。

它有严格的路径要求：模型需要共享专家、消费预先路由结果的量化方法，以及匹配的 prepare 路径。这里已核对的消费方法是 W8A8-dynamic 和 MXFP8；要走图中 EP All-Gather 重叠，还须开启 FlashComm1 或图编译 pass 版 SP（见[序列并行接法](../concepts/sequence-parallel.md#vllm-ascend-里的-sp-是怎样接进去的)）。缺少条件可能导致首次前向断言失败或张量行数不匹配，不能把这三项当成完整部署验收。稠密模型没有 MoE 入口；单卡没有可隐藏的跨卡 All-Gather 通信，但这不等于配置层禁止单卡。GLM 主线未开此键，强行开启的分析见下文。

**存在范围**：本页的 v0.23 维护分支保留了这条实现；v0.24.0rc 起这个开关连同旧 FlashComm3 路径被删除，固定的 v0.26 分支与 main 快照中均无这些标识符，移除提交见下面「版本谱系」。**升级时应从启动命令里删掉，但留着的后果不同** [!]：v0.26 的 `AscendConfig` 还是普通类，逐个键 `.get()` 取值，不认识的键被静默忽略 [C23]，这个键不会再开启重叠；这不保证其余部署配置都能通过。main 的 `extra="forbid"` 通常会拒收；若能发现 vLLM-Omni，未知顶层键会警告并过滤，功能仍已删除（详见「开了的代价」第 8 条）。

## 事实表

| 项 | v0.23.0 | v0.26.0rc | main | 意味着什么 |
|---|---|---|---|---|
| 配置键与默认值 | `additional_config.multistream_overlap_gate`，bool，`False` | 不存在，未知键静默忽略 | 不存在，被当未知键拒掉 | 升级前两边都要删：v0.26 上留着是白留，main 上留着起不来（装了 `vllm_omni` 才降成 warning）[C22] |
| GLM 双机这条线 | GLM 代码所在的 db701c1f 上键还在、默认 `False`，官方部署没开，MoE 走不带门控的直路 | 键不存在 | 键不存在，通常拒收 | 主线没用它；序列并行也没开，硬开按源码推多半对不上，见「开了的代价」末段 |
| 上游状态 | 发版时即列入 Ready to Deprecate | 已移除 | 已移除 | 不要往新部署里投入，v0.23.0 上也只当短期手段 |
| 搬到副流的计算 | 共享专家前向（含 TP all-reduce）+ `select_experts` | 不存在 | 不存在 | 省的是这两段，**不是**路由专家的 GEMM |
| 与之并行的主线 | `_prepare_with_ep_group` 的动态量化 + all-gather | 不存在 | 不存在 | 重叠窗口只有 `prepare()` 这一段，见「开了的代价」 |
| 新建 NPU stream | 2 条类级单例：`gate_stream` + `quant_stream` | 不存在 | 不存在 | 增加任务提交与同步资源；不能从流数推导显存池数或固定显存增量 |
| 新建 HCCL 通信组 | 1 个，`group_name="fc3_quant_x"` | 不存在 | 不存在 | 多一份通信域资源，启动时多一次建组 |
| 能接住它的量化方法 | 只有 `w8a8_dynamic` 与 `w8a8_mxfp8` | 不存在 | 不存在 | 未量化（BF16）MoE 上没有接收端 [D] |
| 有无共享专家时的降级 | 无：`self.multistream_overlap_gate` 直接取开关值，只有 `shared_multistream_overlap_gate` 与 `has_shared_experts` 做与 | 不存在 | 不存在 | 官方描述里的「只对带共享专家的 MoE 生效」不是静默降级 [!] |
| 硬互斥 / 310P 差异 | MoE LoRA v1 拒绝此组合；310P 新 runner 置 `False`，legacy 则另有串行前向 | 不存在 | 不存在 | 不能把新 runner 的字段覆盖外推到所有 310P 实现，见下文 |

## 为什么存在

MoE 层在专家计算之前有一段「准备期」（prepare）。开着序列并行、MoE 走 AllGather 路径时，先量化本卡隐藏态，再在 EP 组收集隐藏态和相应量化尺度。通信与计算可能存在重叠机会，但源码不能证明此时所有计算单元都闲置。共享专家 FFN 可先使用本地隐藏态，select_experts 可先使用已算出的 router_logits，因此这两段能提前提交到另一条流。AllGather 路径还会汇集选专家结果；它并非完全免通信。组和载荷见[序列并行接法](../concepts/sequence-parallel.md#vllm-ascend-里的-sp-是怎样接进去的)，通信方法选择见[专家并行](../concepts/expert-parallel.md#mc2-还是-allgather)。

它的名字里有 "FlashComm3"，是因为它只在序列并行开着时的那条路径上才有意义：`PrepareAndFinalizeWithAllGather.prepare` 只有在 `enable_sp() or enable_sp_by_pass()` 为真时才走 `_prepare_with_ep_group`，也就是上面那次「先量化、再在 EP 组里收齐」的路 [C10]。前一个函数看 FlashComm1 开没开；后一个是图编译 pass 版的 SP，条件是不强制 eager 且编译配置里打开了 `enable_sp`。两者都没开时走的是另一条按 DP 组收集的分支，`quant_stream` 那半边的逻辑一行都不在里面。

跨流传结果靠一个模块级全局单例 `FlashCommon3Context`，实际用来传结果的是 `topk_weights` / `topk_ids` / `shared_experts` / `shared_out` 这 4 个字段（类里另有 `gate`、`row_idx` 两个字段，这个开关不写它们）。

```wiki-diagram
file: multistream-overlap-gate
```

图里的汇合点是硬约束：quant_stream 在 prepare 内等待回来 [C10]，gate_stream 在专家量化方法执行前等待回来 [C5]。若示意中两段独立工作原本各需 A、B 时间，且重叠不改变各自速度、没有额外同步与通信代价，串行 A+B 可缩成 max(A,B)，最多省 min(A,B)。实际 gate 路径含选专家结果的收集，prepare 还含量化尺度收集；二者会竞争资源，不能把理想差额当成设备收益上限测量。

两条副流都是**类级单例**：`gate_stream` 挂在 MoE 层的类上（配 vLLM 0.23.0 实际加载的 legacy 实现里是 `AscendFusedMoE`，新实现里是 `AscendMoERunner`）、`quant_stream` 挂在 `PrepareAndFinalize` 上，第一次构造时才建，不随层数增长。

副流上的 all-gather 走的是专门新建的 `fc3_quant_x` 通信组（rank 划分与 `mc2` 组共用同一份 `group_ranks`），调用 `fc3_all_gather_and_maybe_unpad_impl` 而不是主线用的 `torch.ops.vllm.maybe_all_gather_and_maybe_unpad`。另起一个组和一个纯 Python 实现，看起来是为了避开自定义算子在非默认流上的行为问题 [I]。

量化侧流开始处理前，先等待当前流；随后在侧流上汇集隐藏向量，并按各 DP 成员的有效长度去掉填充。当前流在后续使用这些结果前又等待侧流。因此，另开一条流不等于这些步骤之间没有依赖。


消费端在量化方法里：`apply()` 发现开关开着就跳过自己的 `select_experts`，改从 context 取 `topk_weights` / `topk_ids`。**只有 `w8a8_dynamic` 和 `w8a8_mxfp8` 两个量化方法有这段**——未量化的 MoE 方法不读 context，而开关打开时 `_prepare_with_ep_group` 又不再 all-gather `router_logits`，两边对不上，所以这个开关实质上绑定在 W8A8 / MXFP8 量化 MoE 上 [D]。

v0.23.0 里新、legacy 两套实现均有门控路径，各持类级 gate_stream；配套 vLLM 0.23.0 时导入 legacy 实现。构造时的 `[fused_moe/layer] Multistream overlap gate is enabled.` 是 info_once 日志，只能证明该配置分支已开启，不能证明首次前向成功、设备上发生有效重叠或性能提升。实际路径还需结合执行结果和 profiling。

**至于省多少**：[官方参数表](https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html)只给功能与默认值，没有该部署的开关对照。引入 PR 另有图片记录，不能用参数表没有数值推断上游从未测试。仅凭源码也不能断言“小 decode 收益最大”或“长序列收益趋零”：共享专家、路由、通信、同步与资源争用都影响总耗时。图中窗口还要求实际走 AllGather；A2 小批若选中 MC2，prepare 主要做补齐和切片，没有这次 EP All-Gather，不能套用通信隐藏收益。是否省时仍须比较同一负载的完整执行时间。

## 开了的代价

**1. 没有共享专家的 MoE 上，它可能在首次前向断言失败，不会自动忽略。** 官方描述写的是 "This option only takes effect on MoE models with shared experts"，容易读成「没有共享专家时自动忽略」。源码不是这样：`self.multistream_overlap_gate` 直接等于开关值，只有另一个字段 `shared_multistream_overlap_gate` 才与 `has_shared_experts` 做了与 [C3]。而往 context 里写 `shared_experts` 的一处在 `shared_forward_impl` 里，条件正是 `shared_multistream_overlap_gate`；如果进程此前未建立该 context，没有共享专家的模型不会经过这次初始化。配 vLLM v0.23.0 时实际加载的是 legacy 那套（`fused_moe_0_23_0.py` 里的 `AscendFusedMoE`），没有共享专家时 runner 直接调层的 `forward_impl`，进门控分支的第一句 `assert fc3_context is not None` 就断；新实现里同一句断言在 `no_shared_forward_impl` 里。两处都是不带消息的裸断言；这是该路径的源码推导，尚无本页对应的实机错误日志 [D]。开启前须确认实际模型提供共享专家，并同时满足消费方法、prepare 和张量形状要求；不能仅按模型家族名判断。

**2. 必须是 W8A8-dynamic 或 MXFP8 量化的 MoE。** 理由见上一节「消费端」那段。

**3. 必须开着序列并行（FlashComm1 或图编译 pass 版 SP）。** `quant_stream` 那半边的逻辑只写在 `_prepare_with_ep_group` 里，而 `prepare()` 只有 `enable_sp() or enable_sp_by_pass()` 为真时才走这条分支；否则 `gate_stream` 这半边照样跑，`quant_stream` 那半边不跑，重叠就没了 [D]。多卡部署在 SP 没开时还不止「白开」：主线这边，MC2 路径会把隐藏态补齐后按 TP 切片，AllGather 路径会按 DP 组把隐藏态收齐，而副流算出的路由结果都没跟着变，两边可能行数对不上，GLM 双机就是这种情况，见本节最后一段。开着 FlashComm1 时隐藏态已经是本卡那几行，MC2 不再补齐切片，AllGather 路径也会给路由结果补收一次，两边对得上。只开图编译 pass 版 SP 时，AllGather 路径同样会补收；MC2 路径是否补齐切片只看 FlashComm1，这种组合下两边对不对得上，待核：缺这时 MC2 准备期拿到的隐藏态行数。

**4. 与 MoE LoRA v1 硬互斥。** 若此前检查通过，门控检查会抛 `AssertionError`，消息原文是 "multistream_overlap_gate=True interleaves quant_method.apply calls on multiple streams; the MoE LoRA path has not been validated under this overlap. Disable it for MoE LoRA."（`vllm_ascend/lora/fused_moe.py` 第 82–87 行）。带共享专家的层可能先在第 75–81 行被拒绝，因而不会走到这条消息。两种检查都没有自动降级：该 LoRA 路径既未支持共享专家，也未验证这项重叠。

**5. 310P 要区分新 runner 和 legacy 前向。** 固定快照里，仅非 vLLM 0.23.0 的 `AscendMoERunner310` 构造器明确把 `multistream_overlap_gate`、`shared_multistream_overlap_gate`、`multistream_overlap_shared_expert` 三个字段一起置 `False`。`AscendFusedMoE310` 的 legacy 类没有这组三字段覆盖，但它自行实现的 `shared_forward_impl` 先算路由专家，再算共享专家，也没有图中的门控重叠。不能据新 runner 的三行赋值断言所有 310P 配置都会静默通过，或完全没有初始化开销。

**6. 额外资源：2 条 NPU stream + 1 个 HCCL 通信组。** 流是类级单例，不随层数增长，通信组在分布式初始化时创建。还要承担跨流等待以及结果张量存活期间的资源占用；流数本身不能证明独立内存池数量。具体峰值显存和耗时增量需要对应运行时测量。

**7. 它和 `multistream_overlap_shared_expert` 是两个开关，共享专家只会被其中一个接管。** 后者把共享专家挪到 `shared_experts_calculation_stream()`；前者把共享专家挪到 `gate_stream` 并顺带把路由也带走，取结果时直接读 `fc3_context.shared_out`，完全不走 `_forward_shared_experts`。两个开关都开时共享专家由 gate 路径接管，`multistream_overlap_shared_expert` 那条分支变成死代码 [D]。注意 `multistream_overlap_shared_expert` 在 v0.26 分支 [C24] 和 main 开发主线 [S18] 上都仍然活着，参数表里还有它那一行——被删的只是 gate 这一个，别把两个一起当成废弃项删掉。

**8. 去向：v0.24.0rc 起整套删干净了。** v0.23.0 的 release notes 发版时就把 "The FlashComm3 multistream-overlap gate" 写进了 Ready to Deprecate [S17]；v0.26.0rc1 的「Deprecation and Breaking Changes」里兑现成一条 "Removed multistream overlap gate."，PR [#11956](https://github.com/vllm-project/vllm-ascend/pull/11956) [S21]。v0.26 分支与 main 上参数表里这一行都没有了 [S18]，`flash_common3_context.py`、`fc3_quant_x` 通信组、`fc3_all_gather_and_maybe_unpad_impl` 也一并不在。

**迁移时删掉此键，并区分配置处理方式。** main 的 `AscendConfig` 是 pydantic 模型，`model_config = ConfigDict(extra="forbid")` [C19]，通常在构造时拒收未知键；具体异常文本由 pydantic 生成，本页没有带此键启动的实机日志。若进程能发现 `vllm_omni`，工厂则先警告，再过滤未知顶层键。警告为 "The following additional_config keys are invalid for vLLM-Ascend: %s. They may be used by vLLM-Omni or another project. Please remove them if they are not needed for your use case."，`%s` 是排序后的未知键列表 [C22]。过滤不会恢复已删除的功能。v0.26 分支没有这道未知键校验，这个键会被跳过，旧初始化日志也不会再出现。旧版本即使出现该日志，也只能证明配置分支开启，不能据此确认重叠成功。

**放到 GLM 双机：主线没开它；硬开的话，按源码推多半对不上（待核）。** 那套部署是两台 A2、TP8 / DP2 / EP16、W8A8（见[部署前提](../concepts/glm-5-3-flash-two-node.md#部署前提)）。GLM 的代码在 db701c1f 上，这个键在那里还在、默认 `False`，官方启动命令没传它，所以 42 层 MoE 都走不带门控的直路，共享专家排在路由专家之后串行算（见 [MoE 页的共享专家一节](../concepts/moe.md#共享专家按-tp8-切走融合算子)）。三条前提它占了两条：有 1 个共享专家、路由专家走 W8A8 动态量化；缺的是序列并行，FlashComm1 和图编译 pass 版 SP 这套部署都没开（见[序列并行页](../concepts/sequence-parallel.md#放到-glm-双机这套部署开了-sp-吗)）。

假如在这套部署上硬把它打开，按 db701c1f 的源码一步步推，示例请求 R1 的一步（每边 4 个 token，走 MC2；补齐与切片的形状见[一条请求的 MoE 通信](../concepts/one-request.md#moe-通信走-mc2-还是-allgather)）会变成这样：

- 启动时多建 2 条副流和 `fc3_quant_x` 通信组，日志多出那条 `[fused_moe/layer] Multistream overlap gate is enabled.`（GLM 这条线配的是 vLLM 0.23.0，加载的正是会打这条日志的 legacy 实现）。
- 每层 MoE，副流上先算共享专家、并在副流上做它那次 TP8 All-Reduce，接着在完整的 4 个 token 上算路由，得到 4 行「选了哪 8 个专家」的结果 [C25]。
- 主线同时做 MC2 的准备：4 行补到 8 行，TP8 每卡只留 1 行 [C26]。这一步不发任何通信，没有能藏进去的等待。
- 两条流在专家计算之前汇合，量化方法直接拿副流那 4 行路由结果，去配本卡这 1 行隐藏态。源码只在走 AllGather 时给路由结果补了一次收集，MC2 路径没有对应的切分，两边行数对不上 [I]。

这条主线的上述 MC2 算例已经能从源码推出路由结果与隐藏态行数不一致；具体下游报错或数值后果仍需实机验证。该步也没有图中那次 EP All-Gather，不能按它估算通信隐藏收益。超过容量转入 AllGather 时，SP 未开会使主线按 DP 组汇集隐藏态，而路由结果的辅助收集不执行相同变换，同样存在行数风险。缺少真机日志与同负载对照，不能由窗口较短再断言绝不省时。

## 版本谱系

> 本节由 `pnpm wiki:lineage` 从 git 历史算出。标识符的文本存在不等同于运行时功能可用；引入／移除均比较提交与父提交。

| 版本 | 是否存在 |
| --- | --- |
| main | 无 |
| releases/v0.23.0 | 有（9 个文件） |
| releases/v0.26.0rc | 无 |
| releases/v0.30.0rc2 | 无 |
| releases/v0.30.0 | 无 |

- **引入**：2025-12-14 · ba28d54f359278c83ed0f55ba78de9b1996f2b12 · PR [#4065](https://github.com/vllm-project/vllm-ascend/pull/4065) —— [Perf]enable prefill flashcommon3 (#4065)
  包含该提交的 tag：v0.13.0、v0.13.0rc1、v0.13.0rc2、v0.13.0rc3、v0.14.0rc1、v0.15.0rc1、v0.16.0rc1、v0.17.0rc1、v0.18.0、v0.18.0rc1、v0.19.1rc1、v0.20.2rc1、v0.21.0rc1、v0.22.1rc1、v0.23.0、v0.23.0.post1、v0.23.0rc1、v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.13.0、origin/releases/v0.18.0、origin/releases/v0.20.2rc、origin/releases/v0.21.0rc、origin/releases/v0.22.1rc、origin/releases/v0.23.0、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-13905-releases/v0.23.0_bugbix_w8a8_mxfp8_for_rl、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/community-contrib、origin/rfc/megakernel、origin/rfc/vllm_cann、origin/zxy_fix_boradash
  - `vllm_ascend/ops/fused_moe/fused_moe.py` +87 / −21（文本行变化）
  - `vllm_ascend/quantization/w8a8_dynamic.py` +22 / −12（文本行变化）
  - `vllm_ascend/ops/fused_moe/prepare_finalize.py` +29 / −5（文本行变化）
  - `vllm_ascend/distributed/parallel_state.py` +21 / −1（文本行变化）
  - `vllm_ascend/distributed/utils.py` +32 / −1（文本行变化）
- **移除**：2026-07-15 · 77baade98ded755b3e5ea30091bcf40a30ae0335 · PR [#11956](https://github.com/vllm-project/vllm-ascend/pull/11956) —— [Refactor] Remove multistream overlap gate (#11956)
  包含该提交的 tag：v0.24.0rc1、v0.25.1rc1、v0.26.0rc1、v0.26.0rc2、v0.27.1rc1、v0.28.0.rc1、v0.29.0.rc1、v0.30.0、v0.30.0rc1、v0.30.0rc2、v0.31.0rc1、v0.32.0rc1；分支：origin/arc-fedsched-e2e-lab、origin/dependabot/github_actions/actions/labeler-7、origin/dependabot/github_actions/actions/setup-python-7.0.0、origin/main、origin/pr-20926、origin/releases/v0.24.0rc、origin/releases/v0.25.1rc、origin/releases/v0.26.0rc、origin/releases/v0.27.1rc、origin/releases/v0.28.0rc、origin/releases/v0.29.0rc、origin/releases/v0.30.0、origin/releases/v0.30.0rc2、origin/releases/v0.31.0rc、origin/releases/v0.32.0rc、origin/revert-15210-glm52_v2_dspark、origin/revert-15908-new-refactor、origin/rfc/0.26.0rc1-bugfix、origin/rfc/megakernel、origin/zxy_fix_boradash
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

## 对照源码

- 来源 28：vllm-ascend@2c59ff10，vllm_ascend/ops/fused_moe/prepare_finalize.py，L381–L398。
- 来源 29：vllm-ascend@2c59ff10，vllm_ascend/distributed/utils.py，L21–L44。
- 来源 33 补 MXFP8 消费预先选专家结果的分支；34 固定 vLLM 0.23.0 的 legacy 导入；35 给出共享专家 context 初始化和两个重叠开关的取结果优先级。来源 10 的量化发生在当前流，隐藏态收集才切到 quant_stream；量化尺度另在当前流收集。
- 来源 15 限定 310P 新 runner 的条件；36–37 给出 legacy 构造与独立前向，不能由新 runner 的字段赋值概括所有 310P 路径。
