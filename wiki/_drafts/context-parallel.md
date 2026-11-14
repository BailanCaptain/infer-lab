---
id: context-parallel
title: Context Parallel：按上下文位置分担计算与历史状态
type: concept
summary: >-
  Context Parallel 按上下文位置分担计算或历史状态。PCP 与 DCP
  使用的设备范围、影响阶段和缓存布局不同；能否启用还取决于模型、注意力后端与执行器，不能只看参数名称。
aliases:
  - Context Parallel
  - 上下文并行
  - CP
  - PCP
  - DCP
  - Prefill Context Parallel
  - Decode Context Parallel
  - 前缀上下文并行
  - 解码上下文并行
  - prefill_context_parallel_size
  - decode_context_parallel_size
  - cp_kv_cache_interleave_size
  - enable_cp
  - enable_dcp
  - enable_pcp
  - AscendAttentionCPImpl
  - AscendMlaCPImpl
  - AscendAttentionDCPImpl
  - Ring Attention
  - Ulysses
  - zigzag
  - 头尾配对
chapters:
  - '04'
  - '05'
  - '11'
  - '15'
order: 10
sources:
  - >-
    raw:sha256-57dc2ab8eec58f72301eeb64b799f6008e6b9f4900058ce4b239ad6c6b8e8294.md#L1-L1111
verified: []
evidence: I
relations:
  - to: attention-qkv
    kind: builds-on
    note: 理解查询如何使用历史键和值，才能判断按上下文分工后还缺哪些数据
  - to: collective-communication
    kind: builds-on
    note: 分布在不同设备上的计算与状态需要通过通信形成所需结果
  - to: block-table
    kind: builds-on
    note: 理解逻辑位置与物理缓存的映射，才能继续阅读上下文分片的缓存布局
  - to: attention-backend-family
    kind: builds-on
    note: PCP 与 DCP 的可用组合受注意力后端和状态布局约束
contradicts: []
updated: '2026-11-03'
origin: gap
rawSources:
  - >-
    raw/sha256-57dc2ab8eec58f72301eeb64b799f6008e6b9f4900058ce4b239ad6c6b8e8294.md
---

Context Parallel（CP，上下文并行）沿输入序列的位置分配计算或历史状态，让多个设备共同承担同一段上下文。理解具体方案时，需要分别追踪三个对象：当前要计算的位置、已经保存的历史状态，以及参与这项工作的设备集合。

本页依据提供的本地摘录解释 PCP、DCP 及相关支持边界。材料包含不同源码快照的文档与校验片段，尚不足以完成四个社区分支的逐项验证；下文保留快照边界，不把片段中的能力推广到所有模型或版本。

## 按上下文分工，究竟分的是哪些东西？

一个 token 是分词器输出的离散符号，在模型输入中占据一个位置。Attention 使用当前位置的查询 Q，与允许访问位置的键 K 计算匹配分数，再按得到的权重汇合值 V。Q、K、V 是三类向量表示，具体计算见 [Attention 与 Q/K/V](../concepts/attention-qkv.md)。

这里有两类可以分配的工作：

- **计算位置的分工**：不同设备处理不同位置的查询或其他计算。
- **历史状态的分工**：不同设备分别保存一部分历史位置所需的状态。

这两件事需要分开观察。设备只计算部分查询，并不意味着它只保存部分历史；后文的实验性 SFA 路径就是查询分片、相关缓存仍复制的例子。

KV cache 是保存后续 attention 所需历史表示的缓存。普通 K/V、压缩表示和递推状态的布局可能不同，详见 [KV cache](../concepts/kv-cache.md)。本页涉及的 DCP 文档主要讨论：在原本存在重复历史存储的设备之间，怎样按序列位置分摊这部分存储。

## PCP 与 DCP 分别想解决什么问题？

Prefill 是处理提示词中尚未计算的位置并建立历史状态的阶段。Prefill Context Parallel（PCP）在这个阶段按序列位置分工，让不同设备同时计算不同片段。

提供材料中，固定执行侧快照的设计文档说明：PCP 扩大参与执行的设备总数，并使用专用通信域；KV cache 也沿序列维度分片。这里的通信域指共同参与相应通信的一组设备。历史状态分散以后，后续 decode 读取历史的方式也会受到影响，因此 PCP 的影响并不止于 prefill。

Decode 是在已有历史上继续生成输出的过程。Decode Context Parallel（DCP）复用 Tensor Parallel（TP，张量并行）的通信域。TP 把一次张量计算分片到多个设备，基础机制见 [Tensor Parallel](../concepts/tensor-parallel.md)。在材料所述基础方案中，DCP 不增加设备，而是利用 TP 域内原本重复保存 KV cache 的设备，沿序列位置分摊这些历史状态。

| 对照项 | 材料中的 PCP 基础方案 | 材料中的 DCP 基础方案 |
| --- | --- | --- |
| 主要目标 | 在 prefill 按序列位置分担计算 | 减少 TP 域内重复保存的 KV cache |
| 设备范围 | 扩大设备总数，使用专用通信域 | 复用 TP 通信域，不增加设备 |
| 影响范围 | Prefill 与 decode 均受影响 | 主要影响 decode，也影响分块及缓存命中的 prefill |

Chunked prefill 是把未完成的提示词计算分到多轮执行；cached prefill 是利用已有缓存处理提示词的路径。这两种情况下，当前输入都可能需要接续已有历史，因此材料明确把它们列入 DCP 的影响范围。

历史分片让单个设备持有的数据发生变化，也使执行依赖相应的跨设备协作。现有摘录没有给出完整通信顺序、张量形状和调用次数，不能据此计算通信字节数或判断收益是否超过通信代价。

## 用几个位置，怎样看清“计算分片”和“缓存分片”？

设一段示意输入有四个位置，编号为 0、1、2、3，两台示意设备分别叫设备 A、设备 B；这些编号与设备数仅用于解释分工。[A]

如果按查询位置分工，可以让设备 A 计算位置 0、1 的查询，设备 B 计算位置 2、3 的查询。这个分配只回答“谁计算哪个查询”，尚未回答“历史键和值保存在哪里”。

如果按历史位置分片，可以让设备 A 保存位置 0、1 的历史，设备 B 保存位置 2、3 的历史。这个分配只回答“谁保存哪段历史”，尚未回答查询计算怎样取得完整结果。

也可以只采用前一种分工，同时让两台设备各自保留全部历史。这样计算位置已经分开，历史缓存仍然存在副本。它说明了为什么“上下文并行”这个名称本身不足以推出缓存节省比例。[I]

上述分配是抽象示意，不代表材料中任一实现的实际位置排列。摘录不足以展开一次完整 attention 的跨设备数值演算，也不足以确定各实现是否采用连续分段、交错位置或其他布局。

## DCP 的约束为什么会随注意力结构改变？

材料中的用户指南对 MLA 与 GQA 给出了不同约束。

MLA 使用压缩潜在表示组织多头 attention。对于材料列出的 MLA 路径，DCP 大小不能超过 TP 大小，而且 TP 大小必须能被 DCP 大小整除。

GQA 让多个查询注意力头共享一组键和值表示。对于材料列出的 GQA 路径，约束对象是“TP 大小除以 KV 头数的整数商”，而非直接使用 TP 大小。这里的 KV 头数是键和值表示的分支数量。具体配置表达式集中列在页末。

这一区别意味着，知道 TP 的设备数还不足以判断 DCP 配置是否合法。注意力的表示方式、KV 头数以及后端校验都参与决定可用组合。

材料还包含另一类 SFA 校验。SFA 是材料中稀疏 attention 路径的称呼；稀疏 attention 只使用允许历史中的一个子集。对于其中 replicated-indexer 路径，即索引器采用复制布局的路径，校验允许 DCP 大小等于 PCP 大小，或等于 TP 大小乘 PCP 大小。

因此，不能把基础文档中的约束当成所有后续路径的统一公式，也不能在计算设备或缓存组规模时机械地把 PCP 与 DCP 再乘一次。具体组成员仍需核对对应实现；现有片段只证明校验允许哪些数值关系。[I]

## GLM-5.3-Flash 的实验性路径分担了什么？

材料中的 GLM-5.3-Flash 指南描述了一条实验性 SFA context parallelism 路径：它在 TP 组内分片 SFA 查询位置，同时让主 KV、索引池与尾缓存保持复制。

索引池和尾缓存是该指南列出的另外两类缓存，摘录没有展开它们各自的数据结构。这里能确定的是它们继续保留副本，不能把查询计算的分片比例当成这些缓存的缩减比例。

同一指南说明，KDA 继续使用已有 TP 路径。KDA 是采用按通道遗忘的 delta 更新机制，以递推状态汇总历史；本材料没有展开其计算过程。指南要求 PCP 与 DCP 大小都保持为 1，实验开关另列于页末。

这条路径因此需要单独理解：它分担的是 SFA 查询位置，不能作为 GLM 已经支持通用 PCP、DCP 的依据，也不能用来推算 KV cache 按 DCP 大小缩减。

对于本站固定 GLM 双机部署，本材料不足以重新计算每卡形状、缓存预算或通信账单，也没有提供实机结果。本页不据此修改既有双机算例。

## 哪些看似相同的说法，需要分开判断？

**“PCP 主要用于 prefill”与“PCP 只改变 prefill”含义不同。** 材料明确指出，PCP 的历史分片也会影响 decode；DCP 同样可能影响 chunked prefill 和 cached prefill。

**文档写着“不支持”与平台代码的实际拒绝条件需要一起读。** 一段文档直接写 PCP 不受支持，另一段平台代码却只在未使用 Model Runner V2 且 PCP 大于 1 时拒绝。Model Runner 是组织模型执行的软件组件，V2 表示这里的另一条执行路径。通过这项校验只说明没有被这一条件拦下，完整支持仍需检查其余路径。

**设备型号相同，也可能因算子路径不同而有不同限制。** 材料中的注释区分 A5 的非 C8 SFA DCP 与 C8 replicated-indexer DCP。摘录没有解释 C8 的完整含义，因此这里只保留原路径名称；不能据此概括为“A5 全面支持”或“A5 全面不支持”SFA DCP。

**工具函数处理了某类输入，不等于整个模型组合可用。** 材料说明，PCP 工具函数涉及 hybrid-attention 的 token 处理，而另有上游 HybridKVCacheCoordinator 路径禁止 CP。前者涉及输入处理，后者涉及缓存协调；这些片段尚不能拼成某个混合模型端到端支持的证明。

## 对照源码

### 怎么开

材料给出的相关配置名包括：

- `prefill_context_parallel_size`：PCP 大小。
- `decode_context_parallel_size`：DCP 大小。
- `tensor_parallel_size`：TP 大小。

在材料所引固定执行侧快照的用户指南中，MLA 路径要求：

- `tensor_parallel_size >= decode_context_parallel_size`
- `tensor_parallel_size % decode_context_parallel_size == 0`

GQA 路径要求：

- `(tensor_parallel_size // num_key_value_heads) >= decode_context_parallel_size`
- `(tensor_parallel_size // num_key_value_heads) % decode_context_parallel_size == 0`

这些是摘录所列路径的配置约束，不构成其他模型、后端或版本的启动配方。

GLM 指南中的实验性 SFA 路径使用：

```text
--additional-config '{"enable_dsa_cp": true}'
```

该指南同时要求 PCP 与 DCP 大小保持为 1。材料未提供足够的完整启动条件，本页不补造部署命令。

### 会报什么错

材料中的平台校验在“未使用 V2 Model Runner，并且 PCP 大于 1”时抛出错误，错误文本包含：

```text
PCP (Prefill Context Parallelism) is not supported by vLLM Ascend.
Please set --prefill-context-parallel-size to 1.
```

读这段报错时，应保留它前面的条件判断。错误字符串本身没有呈现执行器条件。

材料中的 SFA replicated-indexer 校验要求 DCP 大小属于以下两者之一：

- PCP 大小；
- TP 大小乘 PCP 大小。

不满足时会抛出 `AssertionError`，文本说明 DCP 必须取上述两种大小之一。满足这一条仍不足以证明完整配置可运行。

### 开销和什么时候别开

PCP 基础方案增加参与设备，并改变 prefill 与 decode 的协作；DCP 基础方案利用已有 TP 设备分摊重复历史存储。收益与通信成本应按实际后端、历史长度和缓存布局评估，材料未提供可复算的性能数据。

若目的是减少 GLM 实验性 SFA 路径的 KV 占用，该路径的查询分片不能提供这一结论：指南明确说主 KV、索引池和尾缓存仍复制。

若执行器或后端的校验拒绝当前组合，应先核对具体拒绝条件。修改大小参数或启用另一条执行路径，本身不证明模型已经满足全部运行条件。

### 版本差异

本地材料没有提供完整的 seeds 分支映射，也不足以逐项确认四个社区分支的默认值与运行行为。因此本页不登记 `verified`，各分支状态如下。

| 分支 | 本次材料能够确认的范围 |
| --- | --- |
| v0.23 维护分支 | 尚不能完成该分支 PCP、DCP 的逐项核对 |
| v0.26 分支 | 尚不能完成该分支 PCP、DCP 的逐项核对，也未确定对应快照日期 |
| v0.30.0rc2 分支 | 材料包含相关对照片段，但缺少可独立核验的分支映射，不能据此登记整页验证 |
| main 开发主线 | 材料包含多个提交的片段，不能视为对浮动 main 的统一结论 |

材料能够保留的快照差异包括：

- 固定执行侧设计文档介绍 PCP 与 DCP 基础方案。
- 另一段设计文档写 PCP 不受支持；平台代码的拒绝条件则包含是否使用 V2 Model Runner，二者的概括范围需要进一步核对。[!]
- 后续 SFA replicated-indexer 校验允许 DCP 等于 PCP 或 TP 乘 PCP，不能直接沿用基础 MLA 文档的约束解释全部路径。[!]
- A5 限制在不同摘录中涉及不同算子路径，不能脱离路径名称判断设备整体支持范围。[!]

这些差异尚不能证明某项能力首次出现、删除或修复于哪个发布版本。

### 源码位置

本次唯一来源是归档的本地材料。以下行号用于在该材料中定位，不作为独立的官方或源码证据等级：

| 材料行号 | 对应内容 |
| --- | --- |
| 7–14 | PCP 扩大设备范围、DCP 复用 TP 域，以及各自影响阶段 |
| 380–386 | MLA 与 GQA 的不同 DCP 约束 |
| 529–534 | PCP 拒绝条件包含未使用 V2 Model Runner |
| 798–805 | SFA replicated-indexer 的 DCP 大小校验 |
| 806–807 | A5 非 C8 与 C8 路径的区别 |
| 970 | 文档关于 PCP 不支持的表述 |
| 1020–1024 | GLM 实验性 SFA 查询分片、缓存复制及 PCP/DCP 大小要求 |

待核：补齐各片段与四个社区分支的固定提交映射；核对实际通信组成员、位置布局、张量形状和通信顺序；确认混合缓存协调器与具体模型的完整执行路径。现有材料还不足以补充可手算的完整跨设备 attention 演示、性能账单或实机验证结论。
