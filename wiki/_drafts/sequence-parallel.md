---
id: sequence-parallel
title: Sequence Parallel：按 token 分工与 Ascend 的启用路径
type: concept
summary: 序列并行让一组设备按 token 分担部分计算与中间结果；在 Ascend 中，配置开关、运行时条件和通信策略共同决定实际走哪条路径，不能只看一个开关。
aliases:
  - Sequence Parallel
  - 序列并行
  - SP
  - FlashComm1
  - FlashComm V1
  - enable_flashcomm1
  - enable_sp
  - sp_min_token_num
  - maybe_pad_and_reduce
  - SequenceRowParallelOp
  - use_sequence_parallel_moe
chapters:
  - '15'
order: 10
sources:
  - >-
    raw:sha256-d285403369c43f4a8f0c515ba0f64e941468da36b7b6503fef40578827fb25a6.md#L1-L1179
verified: []
evidence: I
relations:
  - to: tensor-parallel
    kind: builds-on
    note: 需要先理解同一次张量计算怎样分片，才能区分 SP 的位置分工与 TP 的内部计算分工
  - to: collective-communication
    kind: builds-on
    note: SP 的数据布局转换依赖 All-Gather、Reduce-Scatter 与 All-Reduce 的不同结果归属
  - to: mlp-residual-norm
    kind: builds-on
    note: 理解归一化与残差区域的计算职责，是继续理解 SP 分工范围的基础
contradicts: []
updated: '2026-11-03'
origin: gap
rawSources:
  - >-
    raw/sha256-d285403369c43f4a8f0c515ba0f64e941468da36b7b6503fef40578827fb25a6.md
---

Sequence parallel（SP，序列并行）涉及按 token 位置分担计算与中间结果。本页聚焦材料能够核对的 Ascend 实现：配置怎样进入运行时判断，以及实际通信怎样在 All-Reduce 与 Reduce-Scatter 等路径之间选择。

token 是分词器输出的离散符号，模型计算时通常用整数编号表示；这里讨论的是这些位置对应的中间向量怎样分配。理解布局之前，还需要区分两个问题：**配置允许使用 SP，和当前这次前向计算实际使用 SP，是不同的判断。** 材料中的函数分别处理这两个问题，其含义还会随源码快照变化。

## 为什么打开一个开关，还不能确定实际怎么运行？

张量并行（TP）把一次张量计算分给多个设备，并通过通信组合结果。有关分片计算的基础见 [Tensor Parallel](../concepts/tensor-parallel.md)。SP 的启用判断建立在这种分布式执行环境上，但材料没有把它实现成一个始终生效的全局分支。

材料中的实现至少有三层判断：

| 判断层次 | 要回答的问题 | 材料中的例子 |
| --- | --- | --- |
| 配置解析 | 配置是否允许相应路径？ | 从附加配置、Ascend 配置或环境变量取得设置 |
| 当前前向计算 | 这次计算是否满足使用条件？ | 模型类别、是否为草稿模型、token 数是否已知 |
| 通信执行 | 当前张量应当怎样组合和分配？ | 使用 All-Reduce，或补齐后执行 Reduce-Scatter |

因此，排查时需要沿着这三层继续看。只看到设置为真，尚不能确定当前输入会进入哪种通信。

## 当前 token 数怎样改变运行路径？

材料第 201–209 行给出了固定执行侧快照中的运行时判断。这里的 MoE 是用路由机制组织多个专家模块的模型结构；草稿模型是投机解码中负责提出候选 token 的模型。

这段代码按以下顺序分支：

| 当前分支 | FlashComm1 的运行时条件 | 同段代码中的其他变化 |
| --- | --- | --- |
| 上下文标记为 MoE 模型 | SP 设置为真，且 token 数已知 | 关闭名为 mmrs_fusion 的融合标记 |
| 非上述分支，且为草稿模型 | 关闭 | 注释说明该分支中的 dense drafter 存在 DP、graph 兼容问题 |
| 其余分支 | SP 设置为真、token 数已知，且严格大于 1000 | 保留严格大于的边界 |

可以直接代入条件检查边界：在“其余分支”中，即使 SP 设置为真，token 数为 1000 时仍不满足条件；改为 1001 才满足这一项。若 token 数未知，也不能进入该路径。

这个判断不能推广成“所有模型都超过 1000 才使用 SP”：MoE 分支在这段代码中没有该数量门槛。材料也没有提供基准测试，不能由这个常量推出特定硬件或负载下的性能收益。

## 通信端怎样决定结果留在哪里？

通信组是共同参与一次通信的成员集合。理解下面的分支需要区分三种操作：

- All-Reduce：对成员的对应元素做归约，并让每个成员取得完整结果。
- Reduce-Scatter：先归约对应元素，再把结果分片交给各成员。
- All-Gather：收集各成员的分片，让每个成员取得完整集合。

这些操作的输入输出区别见[通信基础](../concepts/collective-communication.md)。

材料第 163–171 行展示了 `maybe_pad_and_reduce` 的一部分实现。未启用相应运行路径时，它返回 TP All-Reduce 的结果。对于视觉语言模型的草稿分支，如果当前不是 EP 通信，也返回 TP All-Reduce 的结果。EP 是在设备间分配专家、按路由传递输入并组合专家输出的并行方式。

进入已启用路径后，**没有 DP 元数据，或者当前不是 EP 通信**，都会进入材料展示的同一分支：

1. 读取需要补齐的大小。
2. 大小大于零时，调用补齐操作。
3. 沿第 0 维执行 TP Reduce-Scatter。

这里改变的不只是通信名称。All-Reduce 让成员取得完整归约结果；Reduce-Scatter 让成员取得归约结果的各自分片，后续计算必须与这种结果分布配合。

材料摘录没有展示存在 DP 元数据且属于 EP 通信时的完整处理，不能把上述分支写成该函数的全部行为。

## SP 怎样与专家通信组合？

材料第 842 行给出 `PrepareAndFinalizeWithAllGather` 所描述的通信顺序：

> TP All-Gather → attention → TP Reduce-Scatter → EP All-Gather → MoE → EP Reduce-Scatter

attention 利用查询与键形成权重，再汇合相应的值向量；MoE 则通过路由组织专家计算。在这条策略描述中，attention 与 MoE 前后的通信组不同，分别标为 TP 和 EP。

这段材料描述的优化，是把相关 TP、DP 收集合并为 EP All-Gather，并把对应的归约分片合并为 EP Reduce-Scatter。它说明了某种通信策略怎样组织相邻计算，不能据此认定所有 SP 实现、所有 MoE 后端都使用这条顺序。

## GLM 双机案例应当怎样接续这条实现？

本次材料涉及 GLM 教学基线使用的上游控制流快照与 Ascend 执行侧快照，但没有提供足以复原完整请求的模型输入、每卡张量形状、通信字节数及运行日志。因此，本页只能接续配置与运行时条件，不能给出该部署实际启用路径或性能结果。

上游快照中的 `use_sequence_parallel_moe` 要求以下条件同时成立：

- 通信后端属于代码列出的集合。
- 启用 EP。
- TP 大小大于 1。
- DP 大小大于 1。

允许的后端在材料中列为 allgather_reducescatter、deepep_high_throughput、deepep_low_latency、mori_high_throughput、mori_low_latency 与 nixl_ep。

这组条件定义的是上游属性。它与执行侧的 FlashComm1 配置查询、当前前向计算是否启用相应路径，需要分别核对，不能仅因名称都涉及 SP 就视为同一个布尔值。

## 哪些判断需要分开？

**设置为真与当前前向生效需要分开。** 当前模型分支、token 数是否已知以及数量门槛，仍会影响运行时选择。

**FlashComm1 设置与 SP MoE 条件需要分开。** 材料中不同快照的同名查询函数读取了不同对象，调用者必须结合对应实现理解结果。

**通信策略描述与实际执行记录需要分开。** 材料展示了条件和代码路径，没有提供设备运行结果，不能据此声称已经验证通信次数、显存收益或吞吐提升。

**配置快照差异与发布版本差异需要分开。** 本次摘录不能完整确定各快照与四个在册社区版本的映射，不能将提交变化直接写成某个发布分支的变化。

## 对照源码

### 怎么开

固定执行侧快照中的 `enable_sp` 带有缓存：只有缓存尚未初始化，或者调用要求刷新时，才重新解析设置。

材料第 352–359 行展示的解析顺序是：

1. 附加配置明确包含 `enable_flashcomm1` 时，对该值取布尔值。
2. 否则读取 Ascend 配置中的同名设置。
3. 读取 Ascend 配置触发 `RuntimeError` 时，回退到 `VLLM_ASCEND_ENABLE_FLASHCOMM1`。

同一初始化或刷新分支中，如果结果尚未开启，而 `enable_shared_expert_dp` 为真，代码会将 SP 设置改为真。这不能解释为每次查询都会重新强制开启。

另外，材料第 640–644 行展示了通过编译 pass 启用 SP 的条件：模型配置存在、未要求 eager 执行，并且 `pass_config.enable_sp` 为真。编译 pass 是对计算图进行处理的步骤；这条路径需要单独检查，不能只查 FlashComm1 开关。

本次材料不足以给出经过验证的完整启动命令。

### 会报什么错

材料展示了一条配置调整日志：

> shared_expert_dp requires enable_sp=True. enable_sp has been set to True.

它表示初始化或刷新配置时，设置被自动调整；不是本段材料所证明的启动失败。

材料中的配置解析还展示了针对 `RuntimeError` 的环境变量回退。摘录没有提供完整报错列表，不能将这一回退概括为捕获任意异常。

### 开销和什么时候别开

材料能够确认，部分输入在通信前需要补齐，通信端也可能由 All-Reduce 改走 Reduce-Scatter；但摘录没有给出补齐规模、实际传输量或耗时。

固定执行侧快照对非 MoE 草稿分支关闭 FlashComm1，注释将原因关联到 dense drafter 与 DP、graph 的兼容问题。这是该代码分支的限制，不能推广为所有草稿模型均不支持 SP。

非 MoE、非草稿分支使用严格大于 1000 的 token 数条件。缺少基准数据，尚不能判断这一门槛在其他模型、硬件或实现上的适用性。

### 版本差异

以下仅比较材料展示的源码快照，不将快照擅自映射成发布版本：

| 源码快照 | 材料展示的查询行为 | 意味着什么 |
| --- | --- | --- |
| vllm-ascend@db701c1f | 缓存 FlashComm1 设置；初始化或刷新时，共享专家相关选项可将其改为开启 | 查询结果受解析时机和配置来源影响 |
| vllm-ascend@2ed6cbba | 函数文档说明查询 FlashComm1；共享专家相关参数仅为兼容保留，不再改变该设置 | 不能沿用前一快照的自动开启解释 |
| vllm-ascend@baa023ad、vllm-ascend@7d825229 | 无法取得配置时返回假，否则读取上游 SP MoE 属性 | 同名函数查询的对象发生变化 |

同名函数的语义在上述快照间存在差异。[!]

本次材料未提供足以逐项核对 v0.23 维护分支、v0.26 分支、v0.30.0rc2 分支及 main 开发主线的版本映射与完整行为，因此 `verified` 留空。已有页面的比较性摘录不作为本次新增验证依据。

### 源码位置

本次唯一来源是归档材料，未将其中转录的代码提升为已经独立核验的上游源码证据。各项结论在材料中的定位如下：

| 材料行号 | 对应内容 |
| --- | --- |
| 163–171 | 归约辅助函数的 All-Reduce 回退、补齐与第 0 维 Reduce-Scatter 分支 |
| 201–209 | MoE、草稿模型及其余分支的运行时启用条件 |
| 352–363 | 设置缓存、配置读取顺序与共享专家相关选项触发的自动开启 |
| 640–644 | 编译 pass 路径的启用条件 |
| 649–663 | 上游 SP MoE 属性的后端、EP、TP 与 DP 条件 |
| 684–688 | 另一快照中查询函数的文档语义 |
| 747–750 | 直接读取上游 SP MoE 属性的实现片段 |
| 842 | TP 与 EP 收集、归约分片的通信策略顺序 |

仍需补齐的教学依据包括：标准 Megatron SP 的完整机制、可手算的张量算例、归一化与残差区域的具体布局、激活与 KV cache 的资源边界，以及 GLM 双机的实际调用和张量流。补齐这些原始材料后，才能完成基础原理到固定部署的完整讲解。
