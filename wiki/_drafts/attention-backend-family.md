---
id: attention-backend-family
title: Attention backend：每种层怎样找到自己的执行实现
type: concept
summary: Attention backend 把模型层接到对应的执行实现；不同层可以走不同路径。选择时要同时看模型结构、设备、依赖和版本，不能只改一个后端名称。
aliases:
  - attention backend
  - 注意力后端
  - AttentionBackend
  - metadata builder
  - IndexerKPoolMLA
  - Kimi KDA
  - AscendGDNAttentionBackend
  - AscendIndexerKPoolMLABackend
  - attention group
  - 注意力组
  - FlashAttention
  - Flash Attention 3
  - FA3
  - AscendFAImpl
  - flash_attn_npu_v3
  - flash_attn_npu
  - flash_attn_with_kvcache
  - _validate_fa3_backend
  - 训推一致
  - 训练推理一致
  - enable_training_consistency
chapters:
  - '04'
  - '10'
  - '16'
order: 20
sources:
  - >-
    raw:sha256-850b6caa1d5a8526fd441a2cebd55b2c9e0ad849fb3c3b07fde7b0cc941b8361.md#L1-L1239
verified: []
evidence: I
relations:
  - to: attention-qkv
    kind: builds-on
    note: 先理解查询、键和值怎样形成注意力结果，才能区分计算机制与执行后端
  - to: mla
    kind: builds-on
    note: MLA 使用压缩历史表示，后端选择必须与这种表示匹配
  - to: linear-attention
    kind: builds-on
    note: KDA 使用递推状态，其后端路径与逐位置读取历史的注意力不同
  - to: sparse-attention
    kind: builds-on
    note: 稀疏注意力只访问选定位置，执行入口对稀疏模式有专门约束
  - to: glm-5-3-flash-baseline
    kind: builds-on
    note: GLM 案例的模型与部署身份以固定来源基线为准
contradicts: []
updated: '2026-10-29'
origin: gap
rawSources:
  - >-
    raw/sha256-850b6caa1d5a8526fd441a2cebd55b2c9e0ad849fb3c3b07fde7b0cc941b8361.md
---

Attention backend 是模型层连接具体执行实现的接口：模型层决定需要完成什么计算，后端路径则把这项计算接到相应的设备实现和状态处理方式。

本页解决两个问题：为什么同一个模型可以涉及多个后端，以及为什么显式指定一个后端名称仍不保证能够运行。适用范围是所给材料中的代码和文档摘录；其中 GLM 路径来自固定部署执行侧快照，社区分支的选择逻辑另作比较。

## 一个模型为什么会涉及不止一种后端？

[Attention](../concepts/attention-qkv.md) 利用查询 Q 与键 K 算出匹配权重，再按权重汇合值 V。不同机制会改变历史的表示、访问范围或更新方法，执行实现也要随之适配。

[MLA](../concepts/mla.md) 用压缩潜在表示组织多头注意力；[稀疏注意力](../concepts/sparse-attention.md) 让每个查询只访问允许历史中的部分位置；[KDA](../concepts/linear-attention.md) 则通过更新固定形状的矩阵状态汇总历史。它们可以出现在同一个混合模型里，但交给执行侧的数据和状态并不相同。

材料中的 GLM 实现按层判断使用 KDA 还是 MLA。KDA 实现返回 AscendGDNAttentionBackend；所示 MLA 层则显式指定 AscendIndexerKPoolMLABackend。因此，平台提供的通用选择表不能代表模型中所有层的后端来源。

还要区分三类名称：

| 名称所在层次 | 回答的问题 | 材料中的例子 |
| --- | --- | --- |
| 模型计算机制 | 这一层怎样使用历史？ | KDA、MLA |
| 后端类 | 这一层通过哪个接口接入执行？ | AscendGDNAttentionBackend、AscendIndexerKPoolMLABackend |
| 具体算子 | 最终调用哪个计算操作？ | npu_sparse_flash_attention |

后端名称里带有 GDN，并不把调用它的 KDA 层变成另一种模型结构。同样，看到一个缓存后端类，也不能直接认定它就是完成注意力数值计算的算子。

## 为什么不能只按“哪个更快”选择？

后端需要匹配计算语义和数据表示。一个实现若不支持模型所需的历史表示、位置处理或窗口范围，性能比较就没有共同前提。

材料中的 FA3 是一个具体例子。Flash Attention 是注意力计算实现；这里的 FA3 指 vllm-ascend 接入的相应后端路径。固定部署快照的文档介绍它时，重点是强化学习场景中的训练与推理一致性：训练侧使用 Flash Attention，而推理侧默认的 Fused Infer Attention（FIA）实现存在差别，可能带来计算结果不一致。

为此切换实现会引入条件和代价：

- 设备和依赖必须符合要求，配置名称本身不会安装算子包。
- 模型需要的特性必须受支持。例如该快照的 FA3 不支持 MLA、SFA 或滑动窗口注意力。
- 执行方式可能改变。例如该文档要求使用分段图模式。
- 性能可能下降；材料没有给出可推广到所有场景的下降比例。

因此，后端选择同时是兼容性选择和执行策略选择。训练与推理一致性的目标，也不能直接等同于任意模型、任意批次和任意硬件上的结果保证。

## 怎样用一个小例子走完选择过程？

下面用一个示意配置演示判断顺序，不代表真实 GLM 的层布局。

假定模型有四层，编号为 0、1、2、3；配置没有提供专门的层判断方法，但列出了 KDA 层编号 1 和 3。按照材料中的判定逻辑：

1. 判断第 0 层：0 不在列表中，标为 MLA。
2. 判断第 1 层：1 在列表中，标为 KDA。
3. 判断第 2 层：2 不在列表中，标为 MLA。
4. 判断第 3 层：3 在列表中，标为 KDA。

结果是各层分别保留自己的类型，再据此构造对应的计算组件。这一步是在选择实现路径，没有执行 Q、K、V 的矩阵运算，也没有产生注意力输出。

这个判断还有优先级。配置若提供了专门的层判断方法，先采用该方法；否则检查非空的 KDA 层列表；列表为空时，继续查看逐层类型是否写为 linear_attention。空列表在这里意味着继续回退判断，不能单独用它断言模型没有 KDA 层。

平台通用选择表是另一条路径。材料给出的三项判断依次是“是否使用 MLA、是否使用稀疏路径、是否使用压缩路径”：

| 判断组合 | 映射结果 |
| --- | --- |
| 否、否、否 | AscendAttentionBackend |
| 是、否、否 | AscendMLABackend |
| 是、是、否 | AscendSFABackend |
| 是、否、是 | AscendDSABackend |

这张表表达代码中的四项映射。它既没有覆盖模型层直接指定的所有后端，也没有为其他布尔组合提供支持证明。若走到直接索引该表的分支，表外组合也没有通用回退。

## GLM 的 KDA 与 MLA 层分别走到哪里？

贯穿模型及双机部署的身份见[来源基线](../sources/glm-5-3-flash-baseline.md)。本节只解释材料展示的执行分工；材料没有提供足以复算双机通信次数、每卡完整形状或显存预算的内容。

在 KDA 路径中，模型代码使用 KimiGatedDeltaNetAttention 这个组件名。所示算子注册分支在版本检查条件成立时，将其替换为昇腾实现；该实现返回 AscendGDNAttentionBackend。这里有两次不同的选择：先把模型组件接到设备实现，再由设备实现报告后端。

这条路径的 prefill，即处理提示词中尚未计算的位置并建立历史状态的阶段，会检查 PCP 通信组大小。PCP 是沿上下文位置分配 prefill 工作的一种并行路径；所示 KDA 实现遇到组大小大于 1 会直接拒绝。因此，某个通用后端拥有上下文并行入口，并不足以证明这个混合模型的所有层都支持该组合。

MLA 路径中，材料展示的层显式指定 AscendIndexerKPoolMLABackend，并把完整 MLA 历史缓存的数据类型设为 bfloat16。这个声明属于该层的缓存，不是所有注意力后端的统一精度规则。

Indexer KPool 还提供状态后端和仅管理缓存的后端入口。它们采用延迟导入，代码注释给出的原因是避免模型检查阶段出现循环导入。理解这部分时，需要分别追踪缓存管理入口和真正的注意力执行入口。

所示注意力执行入口调用 npu_sparse_flash_attention，只接受指定的稀疏模式，并且不提供 LSE 输出。LSE 是对分数指数和取对数的归一化统计量；需要该输出的调用方不能直接使用这一入口。

## 哪些看似相近的说法需要分开理解？

**配置项可填写，不代表设备实现支持全部选项。** 上游配置允许指定 Flash Attention 版本 2、3、4，并注明只对相应后端有效。这是上游配置接口的范围，不能据此得出 Ascend 支持全部这些实现。

**独立 RoPE 参数为空，不代表模型没有位置信息。** RoPE 通过旋转表示引入位置信息。Indexer KPool MLA 的所示算子调用将独立的查询和键 RoPE 参数设为空，这只能说明该次调用没有通过这两个参数传入数据。FA3 文档中的限制也针对内核内部的 RoPE，框架另有 PyTorch 原生回退。

**后端选择表有回退，不代表每条路径都有回退。** 所示兼容设备分支对未命中的组合回退到普通兼容后端；其他设备的通用三元映射采用直接索引。main 开发主线摘录中的 PCP 分支又会对未列出的组合显式报错。

**固定部署快照不等于社区维护分支。** 比较部署行为与社区代码时，需要保留各自身份，不能只根据它们都涉及某个上游版本就合并结论。

## 对照源码

### 怎么开

一般应先确认模型层是否自己指定后端，再检查平台选择逻辑。对于模型直接指定的后端，通用配置未必控制该层的最终路径。

固定部署执行侧快照的 FA3 文档要求同时设置：

```bash
export VLLM_BATCH_INVARIANT=1
```

并在相应的 LLM 配置中指定：

```python
attention_backend="FLASH_ATTN"
```

batch invariant 指批不变性：目标是让同一输入与不同输入组成一批时，结果保持逐位一致。所示固定快照的验证逻辑要求启用这一模式，再检查模型类型和依赖。

同一快照文档还要求 Atlas A2/A3 推理 NPU，以及 flash_attn_npu 包提供的 flash_attn_npu_v3 模块和 flash_attn_with_kvcache 算子。文档在该快照中说明依赖包尚未发布；这是一条快照时点的可用性限制，材料不能证明当前发布状态。

### 会报什么错

| 路径 | 触发条件 | 所示结果 |
| --- | --- | --- |
| Kimi KDA prefill | PCP 组大小大于 1 | 抛出 `Kimi KDA prefill does not yet support PCP.` |
| Indexer KPool MLA | 请求 LSE 输出 | 抛出 `Indexer KPool MLA attention does not expose LSE.` |
| Indexer KPool MLA | sparse_mode 不等于 3 | 抛出 ValueError，并报告传入值 |
| 固定快照的 AscendFAImpl | sliding_window 非空 | 抛出 ValueError，提示关闭滑动窗口或使用默认 FIA |
| main 开发主线摘录中的 PCP 分支 | 已进入该分支，但组合不在映射中 | 抛出 NotImplementedError，报告不支持的后端组合 |

最后一行有执行顺序条件：兼容硬件分支位于 PCP 分支之前，可能已经返回。不能把 PCP 分支中的错误概括成所有配置的必经结果。

### 开销和什么时候别开

固定快照的 FA3 文档列出以下边界：

- 不支持滑动窗口、MLA、SFA。
- 不支持 ALiBi，即向注意力分数加入线性位置偏置的方法。
- 不支持 attention logit softcapping，即对归一化前分数作平滑限幅。
- 不支持 FP8 量化注意力。
- 注意力内核不支持内部 RoPE，框架使用 PyTorch 原生回退。
- 算子的 tiling 在主机侧处理，文档说明不支持 ACL Graph 捕获，并要求使用 PIECEWISE 配置。

所示实现还声明 kernel block size 仅支持 128；在未强制 eager 执行且图模式为 FULL_DECODE_ONLY 时，拒绝相应的图捕获配置。

文档明确提示 FA3 相对默认 FIA 可能降低性能。因此，它适合在计算一致性目标、模型能力和环境条件均匹配时评估，不能把它当作 GLM 混合注意力路径的通用替代项。本材料没有设备实测结果。

### 版本差异

以下只比较材料展示的局部路径。v0.26 分支仍处于 rc 阶段；材料未提供这些摘录对应快照的日期，因此日期尚待补核。

| 项目 | 固定部署执行侧快照 | v0.23 维护分支 | v0.26 分支 | main 开发主线 |
| --- | --- | --- | --- | --- |
| 通用三元后端映射 | 展示相同四项 | 展示相同四项 | 展示相同四项 | 展示相同四项 |
| 兼容设备分流 | 使用 is_310p 判断 | 使用 is_310p 判断 | 使用 is_310p 判断 | 改按硬件 profile 的后端家族判断 |
| FA3 入口 | 显式选择 FLASH_ATTN，且验证通过 | 摘录中的入口同左 | 摘录中的入口同左 | 未启用 PCP，且验证通过；该入口不再检查显式选择项 |
| FA3 验证细节 | 材料说明要求 batch invariant，并检查模型和依赖 | 所给摘录不足以完整核对验证条件 | 所给摘录不足以完整核对验证条件 | 材料说明要求启用 RL 配置和训练一致性，并检查模型和依赖 |
| 模型层直接返回 GDN 后端 | 展示 Kimi KDA 路径 | 材料不足以确认对应模型路径 | 材料不足以确认对应模型路径 | 展示模型内 KDA 路径 |

这些分支差异会改变后端是否被尝试以及何处失败，不能把固定部署中的启用方式直接当作 main 开发主线的规则。[!]

本页未据此填写任何已核对版本：局部摘录不足以完成整页逐版本认证，也不能证明功能首次引入或删除的版本。

### 源码位置

本页唯一来源是提供的本地材料快照。以下行号帮助定位材料内部内容，不能替代独立打开上游源码核验：

| 材料位置 | 可核对内容 |
| --- | --- |
| 第 6、40–51 行 | 按层区分 KDA/MLA，以及配置判断优先级 |
| 第 55–70 行 | Indexer KPool 状态与缓存后端的延迟导入 |
| 第 147–157 行 | 受版本检查控制的 Kimi KDA 替换注册，以及返回 GDN 后端 |
| 第 271–273 行 | KDA prefill 对 PCP 的拒绝条件 |
| 第 405–409、447–453 行 | 稀疏注意力入口限制和调用参数 |
| 第 561–583 行 | 显式 FA3 入口、通用后端映射及兼容设备分支 |
| 第 650–654 行 | FA3 对滑动窗口的拒绝 |
| 第 881–913 行 | main 开发主线中的 FA3、硬件家族与 PCP 分支顺序 |
| 第 947–950 行 | main 模型层直接返回 GDN 后端 |
| 第 1110–1115 行 | 上游后端配置和 Flash Attention 版本字段 |
| 第 1123、1160–1203 行 | FA3 的动机、设备依赖、启用方式和限制 |
| 第 1226–1230 行 | 所示 MLA 层的缓存类型和显式后端 |

待核：独立读取各分支的完整入口、验证函数及调用方；补齐快照日期；确认版本检查函数的精确语义与其他注册分支；确认依赖包当前可用性。双机实际执行、数值一致性和性能均需另行运行验证。
