---
id: embedding
title: Embedding：把 token 编号变成模型输入向量
type: concept
summary: >-
  token embedding 按 token 编号从权重表读取向量，作为模型的输入表示。词表分片后还需要通信；结果保留完整 token
  行还是分散到各成员，取决于具体实现与执行条件。
aliases:
  - embedding
  - 词向量
  - 词嵌入
  - 嵌入向量
  - 嵌入层
  - embedding 表
  - 词嵌入表
  - embedding lookup
chapters:
  - '01'
  - '13'
sources:
  - >-
    raw:sha256-2b8ab5d0ca6d2b5b549eac571cea8abcb81cbcd3d23d83b9f650a952de4c999d.md#L1-L536
verified: []
evidence: I
relations:
  - to: token
    kind: builds-on
    note: embedding 用 token 编号选择权重表中的对应行
  - to: tensor-parallel
    kind: builds-on
    note: 理解词表分片后怎样组合各成员的局部查表结果，需要了解 TP 的分片与通信
contradicts: []
updated: '2026-11-03'
origin: gap
rawSources:
  - >-
    raw/sha256-2b8ab5d0ca6d2b5b549eac571cea8abcb81cbcd3d23d83b9f650a952de4c999d.md
---

Embedding 在本页指 token embedding：按 token 编号从一张权重表中读取向量，把离散编号变成模型后续计算使用的输入表示。

本页讨论查表及其并行通信。材料没有证明句向量生成、池化或 embedding API 服务的支持情况，这些任务的输入输出不能直接由这里的查表过程推出。

## 一个 token 编号怎样变成一行数字？

[token](../concepts/token.md) 是分词器输出的离散符号，通常以整数编号表示。编号用于定位词表中的条目；编号之间的数值距离本身不表示含义的接近程度。

Embedding 表是一张权重矩阵：每一行对应一个 token，每一列对应向量的一个分量。输入编号确定要取哪一行，取出的整行就是这个位置的输入向量。材料中的基础实现调用 PyTorch 的 `F.embedding`，以输入索引读取模块的权重表。

若输入有多个 token，就按输入顺序分别取行。相同编号可以出现多次，输出也会在相应位置重复出现同一行。这里的顺序是请求的位置顺序，不是把编号排序之后再查表。

## 为什么模型需要查表，而不是直接使用编号？

编号只解决“这是词表中的哪一个条目”。查表为每个条目提供一个多分量表示，使后续计算接收到向量，而不是只接收到一个用于索引的整数。

需要区分表中的权重与本轮输出：

- 权重表保存每个 token 可读取的向量。
- 本轮输出只包含本轮输入编号对应的行，并按输入位置排列。
- 查表本身不更新权重表，也不在这一步汇合其他位置的信息。

表越大，存放权重所需的空间越大。将词表拆分到多个执行成员可以减少每个成员持有的行数，但输入编号可能属于其他成员的分片，因此还需要通信来形成后续计算需要的输出布局。

这里的执行成员称为 rank，即分布式执行中的成员编号；通信组则规定一次通信由哪些成员参加。[Tensor parallel（TP）](../concepts/tensor-parallel.md) 把计算或权重分片到多个成员，并通过通信组合结果。

## 能用一张小表走完查表和分片吗？

设一张示意权重表有 4 行，每行包含 2 个分量；本轮输入编号为 `[2, 0, 2]`。这些数字只用于演示查表，不代表真实模型权重。[A]

| token 编号 | 对应向量 |
| --- | --- |
| 0 | `[1, 2]` |
| 1 | `[3, 4]` |
| 2 | `[5, 6]` |
| 3 | `[7, 8]` |

第一个位置读取第 2 行，得到 `[5, 6]`；第二个位置读取第 0 行，得到 `[1, 2]`；第三个位置再次读取第 2 行。因此，输出按位置排列为：

```text
输入编号       查表输出
2              [5, 6]
0              [1, 2]
2              [5, 6]
```

输入包含 3 个位置，每个位置得到 2 个分量，所以输出是一个 3 行、2 列的矩阵。输入中的重复编号保留为重复的输出行。[D]

现在把同一张表分给两个 TP 成员：成员 0 保存编号 0、1 的行，成员 1 保存编号 2、3 的行。采用材料展示的“本地查表后，将不属于本片的结果置零”的做法，各成员形成下面的局部结果。[A]

| 输入位置及编号 | 成员 0 的局部结果 | 成员 1 的局部结果 |
| --- | --- | --- |
| 位置 0，编号 2 | `[0, 0]` | `[5, 6]` |
| 位置 1，编号 0 | `[1, 2]` | `[0, 0]` |
| 位置 2，编号 2 | `[0, 0]` | `[5, 6]` |

如果随后执行求和 All-Reduce，即把各成员对应位置的数相加，并让每个成员都获得完整结果，那么第一个位置得到 `[0 + 5, 0 + 6] = [5, 6]`，其余位置同理。求和在这里用于组合分散的查表结果；它没有把不同输入位置的向量混到一起。

权重表按词条分片，与输出按 token 位置分片，是两种不同的布局。前者决定谁保存某个词条的权重，后者决定通信结束后谁继续处理哪些输入行。

## 查表之后为什么可能使用不同的通信？

材料中的若干普通 embedding 实现都遵循同一段局部处理：本地查表，将不属于当前词表分片的输出置零，然后调用 `maybe_pad_and_reduce`。但调用这个函数，并不足以判断输出最终是什么布局。

All-Reduce 会让每个成员获得完整归约结果。Reduce-Scatter 则先归约，再把结果分片交给各成员；每个成员只保留自己的结果片段。两者都可以组合局部数值，但输出归属不同。

材料展示了两种具体情况：

- 一份实现根据 FlashComm 及前向上下文选择路径：部分条件下返回 TP All-Reduce；另一个分支按需补齐 token 行，再沿第 0 维执行 TP Reduce-Scatter。
- 另一份实现让普通 TP embedding 显式执行 All-Reduce。其注释解释，配套的 vLLM 0.26 前向要求首个 decoder layer 接收完整 token 序列；序列并行要到该层 attention 输出之后才开始。

Decoder layer 是模型中继续更新隐藏表示的计算层。若它期待完整序列，embedding 却只交付一部分 token 行，就需要额外的配套协议才能接续计算。通信选择因此同时取决于局部查表和下游对输入布局的要求。

专用 embedding TP 路径另有自己的 gather/scatter 协议，不能把普通路径的要求直接套给它。Gather 表示收集分片，scatter 表示分发分片；具体参与组、行数与通信顺序仍须对照对应实现。

## GLM 双机的一次前向一定从查表开始吗？

在固定执行侧快照 `vllm-ascend@db701c1f` 的 GLM5 Next 片段中，是否查表有明确分支：

1. 代码先判断当前成员是否为 PP 的首个 rank。PP 即 pipeline parallel，把模型计算按阶段分配给不同成员。
2. 在首个 rank 上，若调用者已传入 `inputs_embeds`，代码直接把它作为隐藏表示。
3. 只有未提供 `inputs_embeds` 时，才调用 `embed_tokens(input_ids)`，从 token 编号生成隐藏表示。

隐藏表示是模型为输入位置维护的中间向量。这里的两个入口说明，模型可以接收已经准备好的输入向量，也可以接收编号并在内部查表。因此，“一次前向经过输入表示这一站”与“这次一定调用 embedding 查表”应分开描述。

材料没有提供足以独立核对 GLM 双机词表行数、每卡分片规模与显存账单的配置原文，本稿不重算这些数字。固定模型与部署的阅读入口分别是[模型来源基线](../sources/glm-5-3-flash-baseline.md)和[双机部署页](../concepts/glm-5-3-flash-two-node.md)。

## 理解 embedding 时还需要区分哪些事情？

**本地查表与整层前向的通信不同。** 基础 `F.embedding` 片段只展示按权重表读取向量。分片后的 masking 和通信由外围路径完成，不能用基础函数没有通信来概括整个并行 embedding。

**普通 TP 与专用 embedding TP 的协议不同。** 普通路径是否保留完整 token 行，要看该实现的通信分支；专用路径还涉及自己的收集、分发与容量条件。

**开关值与实际分支不同。** 即使某项分片开关开启，还可能受通信组规模、模块前缀或更早返回分支影响。判断运行行为需要沿条件进入实际执行路径。

**版本标签与提交片段不同。** 本次材料主要用提交标识实现，没有提供完整发布映射。不能把几个片段拼成所有社区版本都一致的结论，也不能据此确定某行为首次进入哪个发布版本。

## 对照源码

### 怎么开

基础查表片段直接使用输入索引和权重表；本次材料没有给出完整的服务启动入口。

专用 embedding TP 的已知配置约束来自固定 GLM 执行侧快照：当 `finegrained_tp_config.embedding_tensor_parallel_size` 大于 0 时，必须同时开启 `recompute_scheduler_enable`。检查中的解释是，跨 DP 的 HCCL 集合通信需要不同 DP rank 的 token 数一致，而该配置检查只在启用 recompute scheduler 时认可这一保证。

DP 在这里表示处理不同请求或批次的执行组；HCCL 是昇腾侧用于集合通信的库。该约束针对跨组通信所需的输入一致性，不是对查表数学操作本身的要求。

材料另展示了 PCP 权重分片分支。PCP 是 prefill 阶段沿上下文分配工作的并行路径。是否进入该分支还取决于模块前缀、相应权重分片开关以及 PCP 组规模；`disable_tp` 会更早返回整表复制模式。进入该分支且对象为 token embedding 时，不允许同时使用细粒度 embedding TP。

本次材料未提供完整的 PCP 查表通信实现，因此不据此补写其通信顺序、默认值或启动命令。

### 会报什么错

固定 GLM 执行侧快照中的配置检查，在启用细粒度 embedding TP、但未开启 recompute scheduler 时抛出 `AssertionError`。报错关键内容为：

```text
oproj_tensor_parallel_size / embedding_tensor_parallel_size
require recompute_scheduler_enable=true
```

同一快照的专用 embedding TP 路径会检查静态容量。如果本轮 token 数超过 `get_potential_max_tokens()` 返回的容量，会抛出 `ValueError`：

```text
embedding_tp static capacity {capacity} < num_tokens {num_tokens};
increase max_cudagraph_capture_size or max_num_batched_tokens.
```

这里检查的是该路径预留的 token 容量，不是词表里有多少种 token。

PCP 分片片段则在 token embedding 同时启用两类分片时抛出 `ValueError`：

```text
PCP embedding weight sharding cannot be combined with
finegrained_tp_config.embedding_tensor_parallel_size.
```

### 开销和什么时候别开

词表分片减少各成员保存的权重行，但引入组合局部查表结果的通信。输出保持完整序列，还是按 token 行分散到不同成员，还会影响下一步如何接收输入。

材料没有提供这些路径的通信字节数、时延或实机收益，因而不能给出吞吐提升比例或性能优劣排序。

配置选择有两条已展示的硬边界：细粒度 embedding TP 需要满足 recompute scheduler 检查；token embedding 的 PCP 权重分片不能与细粒度 embedding TP 同时使用。静态容量也必须容纳本轮输入。满足这些检查只是进入相应路径的必要条件，性能选择还需要与实际工作负载和下游布局一起验证。

### 版本差异

本次提供的是局部源码摘录，未完成整页四版本核对，因此 `verified` 留空。

| 社区版本 | 本次材料能够确认的边界 |
| --- | --- |
| v0.23 维护分支 | 缺少与该分支固定提交的映射，未完成核对。 |
| v0.26 分支 | 一份源码注释明确讨论 vLLM 0.26 首层接收完整序列的要求，但不足以证明该片段对应在册分支的固定快照，也未给出快照日期。 |
| v0.30.0rc2 分支 | 新材料没有提供片段与用户指定分支固定快照的映射，未完成核对。 |
| main 开发主线 | 缺少与在册固定 main 快照的映射，未完成核对。 |

可以确认的实现差异按提交片段区分：

| 实现片段 | 材料展示的行为 | 对理解的影响 |
| --- | --- | --- |
| `2ed6cbba` | 普通查表后调用的辅助函数，在所示条件下可执行 All-Reduce，或补齐后执行 Reduce-Scatter。 | 不能把该路径概括成始终 All-Reduce。 |
| `baa023ad` | 普通 TP embedding 显式 All-Reduce；注释要求配套前向的首层获得完整序列。 | 结论须保留普通路径和下游输入要求。 |
| `db701c1f` | GLM 输入表示入口存在传入向量与内部查表两条分支；专用 embedding TP 有配置及静态容量检查。 | 不能断言每次前向都查表，配置也不能只看分片规模。 |
| `7d825229` | token embedding 的 PCP 权重分片与细粒度 embedding TP 互斥。 | 两类分片不能直接叠加。 |

这些提交之间的时间、祖先关系和首次发布归属尚未由材料证明，不将表格顺序解释为演进顺序。

### 源码位置

本稿只引用给定的本地材料快照；以下行号用于在该快照内定位，不将摘录提升为已独立核读的上游源码证据。

| 材料行号 | 对应内容 |
| --- | --- |
| 13–17 | GLM5 Next 在 PP 首 rank 上选择传入向量或内部查表。 |
| 40–41 | 基础 embedding 方法调用 `F.embedding`。 |
| 119–124 | 普通路径的本地查表、范围外结果置零及辅助归约调用。 |
| 143–151 | 细粒度 embedding TP 对 recompute scheduler 的配置检查。 |
| 161–166 | 专用 embedding TP 的静态 token 容量检查。 |
| 241–247 | 普通 TP embedding 显式 All-Reduce，以及首层完整序列要求的注释。 |
| 364–372 | 辅助函数在所示条件下选择 All-Reduce 或 Reduce-Scatter。 |
| 420–426 | token embedding 的 PCP 分片与细粒度 embedding TP 互斥检查。 |

待核事项是：将片段映射到四个在册社区版本；补齐 PCP 路径的实际通信实现与配置默认；核对固定 GLM 双机路径最终进入的通信分支。材料未包含实机运行记录，本稿没有部署或性能实测结论。
