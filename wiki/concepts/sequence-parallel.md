---
id: sequence-parallel
title: 序列并行（SP）：让局部激活按 token 分片
type: feature
summary: >-
  Megatron SP 配合 TP，让归一化、残差等区域按 token 分工；沿同一组数看清部分和怎样归约、每卡怎样计算、何时收集并交给下一次投影，并区分
  Ulysses、CP 与 Ascend FlashComm1。
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
  - 'https://arxiv.org/abs/2205.05198v1'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L458-L478'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L527-L611'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L23-L116'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L114-L144'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L164-L172'
  - 'vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2171-L2235'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L375-L407'
  - 'vllm-ascend@db701c1f:vllm_ascend/utils.py#L905-L936'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L672-L747'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L84-L137'
  - 'vllm-ascend@db701c1f:vllm_ascend/envs.py#L75'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/compilation/passes/sequence_parallelism.py#L13-L234
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L291-L295'
  - 'vllm@0fc695fc:vllm/config/parallel.py#L625-L640'
  - 'vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L653'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L96-L101'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L861-L888'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L608-L628'
  - 'vllm-ascend@baa023ad:vllm_ascend/utils.py#L945-L957'
  - 'vllm-ascend@baa023ad:vllm_ascend/ops/register_custom_ops.py#L88-L120'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L751-L757'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe.py#L605-L616'
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L240-L252'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L333-L373'
  - 'https://arxiv.org/abs/2309.14509v1'
  - >-
    https://docs.nvidia.com/megatron-core/developer-guide/latest/user-guide/features/context_parallel.html
  - >-
    raw:sha256-e9a0b6e2c73cbc271e0491a87a633bc955cb058c36e22b899664e9fa891b1a25.md#L1-L863
  - >-
    vllm-ascend@db701c1fd31de40ab028628ee2580ae68c7fd3c0:vllm_ascend/ascend_forward_context.py#L125-L137
  - 'vllm-ascend@7d825229:vllm_ascend/utils.py#L997-L1009'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L752-L806'
  - 'vllm-ascend@7d825229:vllm_ascend/ascend_config.py#L808-L820'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L608-L679'
  - 'vllm-ascend@7d825229:vllm_ascend/ops/linear_op.py#L156-L264'
  - 'vllm-ascend@7d825229:vllm_ascend/models/kimi_k3.py#L534-L554'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L201-L277'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L1170-L1200'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L90-L138'
  - 'vllm-ascend@baa023ad:vllm_ascend/models/glm5next/model.py#L282-L359'
  - 'vllm-ascend@2c59ff10:vllm_ascend/utils.py#L903-L934'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L84-L137'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ascend_forward_context.py#L114-L144'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ascend_forward_context.py#L165-L193'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_forward_context.py#L171-L207'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1557-L1563'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L228-L314'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe.py#L642-L648'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe.py#L726-L832'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L739-L828'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1071-L1084'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1437-L1443'
  - 'vllm@ced6857a:vllm/config/vllm.py#L1877-L1898'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L837-L898'
  - 'vllm-ascend@8d6180e2:vllm_ascend/utils.py#L1050-L1065'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1724-L1730'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: tensor-parallel
    kind: builds-on
    note: 先理解完整归约结果与部分和
  - to: collective-communication
    kind: builds-on
    note: 掌握 Reduce-Scatter 和 All-Gather
  - to: mlp-residual-norm
    kind: builds-on
    note: 理解逐 token 的归一化和残差
contradicts: []
updated: '2026-11-19'
origin: direct
---

## 序列并行是什么？

**本页的 sequence parallelism（SP，序列并行）指 Megatron SP：在张量并行的一组卡里，把原本各卡重复保存、重复计算的归一化和残差区域，改成按 token 分工。** 张量并行（TP）把权重矩阵分给多张加速卡；SP 接着处理这些矩阵之间的数据布局，两者使用同一组卡。

一个 token 是文本切分后的一个单位，在模型里用一行向量表示。T 个 token、每行 H 个数，排成 [T, H] 的矩阵；H 叫 hidden size，即向量宽度。SP 沿 T 这一维切行，每张卡拿到的行仍有完整的 H 个数。推理的一批 token 可以来自多条请求，行的分配保持请求身份；attention（按相关程度读取其他位置的信息）仍遵循各请求自己的可见范围。

例如把「今天 / 天气 / 很 / 好」作为 4 个示意 token。归一化根据每一行自己的数调整尺度，RMSNorm 使用该行的均方根来缩放；残差相加则把子层输入加回输出。只用 TP 时，两张卡各做一遍这 4 行。加上 SP 后，卡 0 负责前两行、卡 1 负责后两行。到了下一次需要各卡处理全部行的 TP 投影，再交换各自的结果。

```wiki-diagram
file: sequence-parallel
```

图中的 All-Reduce 表示“各卡的贡献相加，每卡得到整份”；Reduce-Scatter 表示“贡献相加后，每卡只拿结果的一部分”；All-Gather 表示“把各卡不同的部分收齐”。下半幅把中间的本地计算放在后两种通信之间。

同名的 **DeepSpeed Ulysses** 也叫 sequence parallelism，它解决长序列 attention 的分布式计算，机制不同，见[与 CP、Ulysses 的关系](#spcpulysses-是什么关系)。本站讲 SP 时采用 Megatron 的含义；在固定版本的 vllm-ascend（vLLM 的昇腾执行插件）中，相关实现是 FlashComm1。

在[一条请求的逐层前向](one-request.md#第-4-站-逐层前向每张卡上的形状通信和字节)中，这种布局变化发生在每层 attention、前馈网络与残差连接之间，不发生在客户端拆词或调度请求的阶段。

## 为什么需要它：TP 之后每张卡都在重复同一份活？

先用一段话回顾 TP 怎么切（逐数演算见 [TP 页](tensor-parallel.md#两种切法各算一遍拼起来还是加起来)）。一层里的矩阵乘成对出现：第一个矩阵**按列切**，每张卡算出输出的一段；第二个矩阵**按行切**，每张卡只用自己那一段输入和对应的几行权重，算出的是一份**部分和**：形状和完整结果一样，但每个数只加了本卡那一份贡献，把各卡的部分和按位置相加才是真结果。所以普通 TP 在行切之后做一次 [All-Reduce](collective-communication.md#all-reduce)：各卡的部分和按位置相加，而且**每张卡都拿到一整份** [T, H] 结果。

问题出在接下来那几步。残差相加把子层输入加回输出；RMSNorm 根据每行的均方根缩放向量，再乘可学习的逐通道系数。它们都能逐行计算，无需读取别的 token。可这时每张卡手里的 [T, H] 一模一样，于是：

- **计算重复**：N 张卡（N 是一起做 TP 的卡数）各把同样的 T 行归一化一遍，结果完全相同，其中 N−1 份是白算的；
- **存储重复**：这一段的中间结果（叫激活，activation）每张卡都存一整份，N 张卡存了 N 份一样的数。

第一张图的上半幅中，两张卡各自算了相同的 4 行；下半幅每张卡只算 T/N 行。这个转换有两个依据：

1. 这几步逐 token 独立，卡 0 算 token 0、1 时用不到 token 2、3 的任何一个数；
2. All-Reduce 本身就能拆成两半：先 [Reduce-Scatter](collective-communication.md#reduce-scatter)，按位置相加，但每张卡只拿走结果里属于自己的那一段；再 [All-Gather](collective-communication.md#all-gather)，每张卡把自己那段发给其他卡，拼回整份。两半合起来正好是一次 All-Reduce，集合通信页已经[逐块演过](collective-communication.md#all-reduce)。

SP 就是把这两半拉开：行切之后只做 Reduce-Scatter，每张卡拿到 T/N 行的完整值，逐 token 的几步只算这几行；等下一对矩阵开始、它的列切要求每张卡都有全部 T 行输入时，再做 All-Gather 把行拼回来。**中间一直保持按 token 分片，到了需要完整行集合的投影之前才收集。**

标准 attention + 稠密 MLP 的前向每层有两处这样的边界。MLP 是逐 token 的前馈网络，稠密表示每个 token 都经过这套网络；它通过权重投影和逐通道的非线性变换调整向量。两次 All-Reduce 换成两次 Reduce-Scatter 和两次 All-Gather；本地归一化要等本行贡献加齐，下一投影要等所需输入收齐。额外调用与补齐的等待，必须和省下的激活、重复计算一起衡量。

论文提出 SP 的动机是训练：TP 之后，归一化等位置的激活在每张卡上重复保存，训练又要把它们留到反向传播，按序列维切开能明显减少激活显存。本页讲的是推理的前向布局，不把论文的训练收益搬过来当作本系统推理的结果。

## 怎么做：一次 All-Reduce 拆成两半，中间只算自己的行？

用一个能手算的例子（数为示意，算式是真的）：2 张卡，4 个 token（就是上面的「今天 / 天气 / 很 / 好」），H = 2，也就是每个 token 只有 2 个数。刚做完行切矩阵乘，两张卡各有一份 4 行 × 2 列的部分和：

| token | 卡 0 的部分和 | 卡 1 的部分和 | 两者相加（真值） |
|---|---|---|---|
| token 0 | [1, 3] | [0, 4] | [1, 7] |
| token 1 | [3, 1] | [4, 0] | [7, 1] |
| token 2 | [2, 2] | [3, 3] | [5, 5] |
| token 3 | [8, 15] | [9, 16] | [17, 31] |

每一行的真值都要两张卡的部分和相加才得到，只看一张卡，哪一行都不对。接下来要对每个 token 做 RMSNorm。为了只看 SP 本身，这里先不加残差，RMSNorm 的可学习系数 γ 取 1、防止分母过小的常数 ε 取 0（完整公式见 [RMSNorm 一节](mlp-residual-norm.md#rmsnorm-怎样调整向量尺度)）。下图从上往下一格一步：紫色箭头是两张卡之间发送的块，灰色虚线是本卡自己的那块，不用发。

交互 3D 用**四通道的扩展示例**保留完整矩阵：把表中的每行 `[a,b]` 扩为 `[a,b,b,a]`，两卡的部分和都按这个规则扩展。例如“今天”先得到 `[1,3,3,1]+[0,4,4,0]=[1,7,7,1]`，RMS=5，归一化结果为 `[0.2,1.4,1.4,0.2]`。切分仍按行，每张卡暂时持有 2×4；All-Gather 后各持有完整 4×4。末段另用一个 4→2 的示意投影：两卡分别持有权重列 `[1,2,−1,1]` 和 `[3,1,1,−1]`，各读取全部四个输入通道。“今天”得到输出 1.8、3.2，合起来是两个不同的输出通道，不再相加。下方静态分格图和手算继续使用表中的两通道例子。

```wiki-scene
parallel-mechanism:1
```

```wiki-diagram
file: sequence-parallel-steps
```

**第 1 步 Reduce-Scatter：只把属于自己的行加齐。** 约定 token 0、1 归卡 0，token 2、3 归卡 1。卡 1 把它手里 token 0、1 的部分和 [0, 4]、[4, 0] 发给卡 0，卡 0 加进自己的 [1, 3]、[3, 1]，得到 [1, 7]、[7, 1]；同时卡 0 把 token 2、3 的 [2, 2]、[8, 15] 发给卡 1，卡 1 加出 [5, 5]、[17, 31]。这一步之后，每张卡手里有 2 行**完整**的值；另外 2 行只是已经发出去的输入，不再算作结果（图中第 1 步的结果只画 2 行）。

**第 2 步 本卡计算：各自只做自己的两行。** 以卡 0 的 token 0 为例（$\gamma = 1$、$\varepsilon = 0$，数为示意）：

$$\text{RMS}(x_0) = \sqrt{\frac{1^2 + 7^2}{2}} = \sqrt{25} = 5, \qquad \text{RMSNorm}(x_0) = \frac{[1,\, 7]}{5} = [0.2,\, 1.4]$$

| 步骤（卡 0 · token 0，示意） | 算式 | 结果 |
| --- | --- | --- |
| 完整值（Reduce-Scatter 后） | $[1,\, 3] + [0,\, 4]$ | **$[1,\, 7]$** |
| 平方的平均 | $(1^2 + 7^2) \div 2 = 50 \div 2$ | **$25$** |
| 均方根 | $\sqrt{25}$ | **$5$** |
| 归一化结果 | $[1 \div 5,\, 7 \div 5]$ | **$[0.2,\, 1.4]$** |

同样算，卡 0 得到 token 1 的 [1.4, 0.2]；卡 1 得到 token 2 的 [1, 1]（均方根 5）和 token 3 的 [0.68, 1.24]（(17² + 31²) ÷ 2 = 625，均方根 25）。这一步两张卡之间一个数也不传。

**第 3 步 All-Gather：拼回完整的 4 行。** 卡 0 把算好的两行发给卡 1，卡 1 把它的两行发给卡 0，按 token 顺序放好。两张卡都得到 token 0 [0.2, 1.4]、token 1 [1.4, 0.2]、token 2 [1, 1]、token 3 [0.68, 1.24]。

**这个数学算例与只用 TP 得到相同结果。** 只用 TP 时，All-Reduce 让两张卡都拿到 [1, 7]、[7, 1]、[5, 5]、[17, 31]，再各自把 4 行归一化，得到的正是上面这 4 行。原因是 RMSNorm 每一行只用这一行自己的数，先把行分开算、再拼起来，和整张表一起算没有区别。一般地说，只要中间的函数逐行独立且采用相同参数，两种布局表示同一个数学运算；真实浮点实现还可能改变归约顺序、融合和量化路径，不能据此保证逐 bit 相同。

只用 TP 时，每卡归一化 4 行，两卡合计做 8 行，其中 4 行重复；加上 SP，每卡做 2 行，合计 4 行。这段归一化激活也从每卡 8 个数减到 4 个数。归一化的数学规则没有改变，改变的是各行结果的持有者。

**每行 H 个数保持完整，才能在本卡独立完成 RMSNorm。** 如果把 [1, 7] 的两列拆到两张卡，各卡还得交换平方和等统计量，才能得到共同的均方根 5。本页的 SP 沿 token 行切，正是为了让这一段不需要这种跨卡归一化。

同一行的残差和位置标识也必须跟着走：卡 0 拿到 token 0、1 的子层结果，就要和 token 0、1 的残差相加，不能误接到其他行。

## 下一次矩阵乘为什么又要收齐输入？

沿用 token 0 的归一化结果 [0.2, 1.4]，看它交给下一次列切投影后发生什么。设这次完整权重为两列：第一列 [1, 2] 在卡 0，第二列 [3, 1] 在卡 1。每张卡要为全部 4 个 token 计算自己负责的输出列。

All-Gather 之前，token 0 的这一行只在卡 0，卡 1 缺少计算第二列的输入；token 2、3 则相反。收集后，两卡都有全部 4 行，但仍各自只持有自己的权重列（每卡得到自己负责的完整输出列，此处无需把两列相加，也不必马上拼在同一张卡；数为示意）：

| 参与卡（token 0 接入下一次列切投影） | 本地权重列与点积算式 | 本地输出列 |
| --- | --- | --- |
| 卡 0（第 0 列） | $0.2 \times 1 + 1.4 \times 2$ | **$3.0$** |
| 卡 1（第 1 列） | $0.2 \times 3 + 1.4 \times 1$ | **$2.0$** |
| 两卡共同表示的输出行 | 逻辑拼接（无须立刻求和或收集） | **$[3.0,\, 2.0]$** |

**收齐行，是这套 TP 权重分工的要求。** 单独看线性投影或 MLP，它们也可以逐 token 计算，并不需要读取别的 token；但这里各卡只存部分权重，需要用全部输入行计算自己的输出通道。换一种权重布局，可以选择不同的通信方式，后文共享专家复制权重就是实例。

真正需要跨位置数据的是 attention 的评分与加权汇合：Q 是当前查询，K 供查询匹配，V 是被加权取回的内容；某个查询要和允许访问的 K/V 一起计算。Megatron SP 在 TP 投影之前恢复行集合，不另外把这个 attention 区域按查询位置分给 SP 卡。跨位置的分布式 attention 由 [CP](context-parallel.md) 等机制处理。

## 放回完整一层，哪里按行分工、哪里按通道分工？

以常规的“attention 子层 + 稠密 MLP 子层”为例。attention 的一个头是一套独立的查询匹配与加权汇合，不同头可以分工；MLP 则在列切升维后，各卡对本卡通道应用非线性函数，再用行切降维得到部分和。沿同一个 token 追踪一层，布局按以下顺序转换：

| 走到哪里 | 每张卡持有什么 | 下一步如何衔接 |
|---|---|---|
| 子层入口的残差、RMSNorm | 部分 token，完整 H 维 | All-Gather 收齐 token 行 |
| attention 的 Q/K/V 投影，或 MLP 升维 | 全部 token，本卡权重对应的头/通道 | 本地 attention 或逐通道激活 |
| attention 输出投影，或 MLP 降维 | 全部 token 的 H 维部分和 | Reduce-Scatter 相加，再分配完整行 |
| 下一子层的残差、RMSNorm | 部分 token，完整 H 维 | 继续保持行分片，到下一次投影才收集 |

因此标准前向每层有两处这样的边界：attention 输出之后接 MLP 入口，MLP 输出之后接下一层 attention 入口。对应两次 Reduce-Scatter、两次 All-Gather，替换原来的两次 All-Reduce。表里的“全部 token”指当前这组 TP 参与计算的行集合；与 CP 组合时，它可以只是全序列的一部分。

```wiki-diagram
file: sequence-parallel-layer
```

图中沿纵向走完一个子层，再回到下一子层相同的布局。token 的身份不变，权重分片也没有在卡间来回搬；变化的是激活的行/通道归属。MoE 的专家派发以及 GLM 的多路残差有各自的入口处理，见后文实现节。

## 省下了什么，又要付出什么？

**在形状、数据类型相同且不额外补齐时，标准前向的理想通信载荷相同。** 还用上面的例子数一数：卡数 $N = 2$，每张卡的完整张量 $M = 4 \text{ 行} \times 2 = 8$ 个数（公式口径见[集合通信页](collective-communication.md#通信量里的-n-和-m-到底数什么)）。这里只比较一次 TP 边界的发送载荷，不包括训练的重计算、其他通信或实现额外的缓冲与协议开销：

$$\text{Send}_{\text{RS}} + \text{Send}_{\text{AG}} = \frac{N - 1}{N} M + \frac{N - 1}{N} M = \frac{2(N - 1)}{N} M = \text{Send}_{\text{All-Reduce (ring)}}$$

| 做法与阶段（$N = 2,\; M = 8$ 个数，示意） | 每卡发出算式 | 每卡发出数与内容 |
| --- | --- | --- |
| SP · Reduce-Scatter | $(N - 1) \times M \div N = 1 \times 8 \div 2$ | **4 个数**（卡 0 发出 token 2、3 的 4 个部分和） |
| SP · All-Gather | $(N - 1) \times M \div N = 1 \times 8 \div 2$ | **4 个数**（卡 0 发出 token 0、1 的 4 个归一化结果） |
| **SP 合计** | $4 + 4$ | **8 个数** |
| **All-Reduce（ring）** | $2 \times (N - 1) \times M \div N = 2 \times 1 \times 8 \div 2$ | **8 个数** |

All-Gather 传的是归一化后的结果而不是原始的和，但形状一样、数据类型一样，所以字节数也一样。

**省下的是分片区域的激活和重复计算。** 以 H = 4096、BF16（每个数 2 字节）为示意，一行是 4096 × 2 B = 8,192 B，即 8 KiB；4 行占 32 KiB，分到两卡后每卡 2 行、16 KiB。这是一个激活张量的账，实际峰值还取决于同时活跃的张量和缓冲。

标准 Megatron SP 保留 TP 的权重分片和内部通道分工；[KV cache](kv-cache.md)保存供后续计算复用的历史结果或状态，普通 attention 保存 K/V，GLM 还涉及压缩表示和递推状态。这些状态不因这里的归一化行分片而自动缩小。整个模型显存也不会统一除以卡数。训练要为反向传播保存激活，论文主要研究这部分收益；推理只做前向，收益需要按实际请求和实现测量。Ascend 的共享专家等变体还会改变权重复制方式，不能直接套用标准区域的显存账。

**要付出的代价有三样。**

- **调用次数变多，耗时不一定相同。** 语义上 All-Reduce 等于 Reduce-Scatter 加 All-Gather，但拆开后是两次调用，各有启动和同步开销，通信库对两者的实现也不同，不能保证任何后端上两种做法的线上字节和执行耗时完全一样。批很小时，这点固定开销可能比省下的计算还多：本页固定 Ascend 镜像的稠密主模型 FlashComm1 路径要求一步 token 数超过 1000，源码注释说这是经验值，低于它时切换通信方式可能反而变慢。
- **行数不整除要补齐。** Reduce-Scatter 要把 T 行平分给 N 张卡，T 不能被 N 整除时，先在末尾补几行空行（padding）再通信，All-Gather 之后再把补的行去掉。比如 T = 5、N = 2：补 1 行到 6 行，每卡 3 行，卡 1 的第 3 行是空行。Ascend 的自定义算子正是在 Reduce-Scatter 前补齐、All-Gather 后去掉补齐；有多个 DP（data parallel，数据并行：几组卡各自处理不同的请求，见[数据并行](data-parallel.md)）组时，还要把各组的行数对齐：取各组 token 数的最大值，向上补到 N 的倍数。补的空行、临时缓冲、图模式（把一步的算子预先录成图、之后直接重放）只按几档固定尺寸录制带来的额外补齐，都会吃掉一部分收益。
- **评估要分开量。** 比较开不开 SP 时，局部激活占用、通信输入的精度和形状、线上实际流量、端到端耗时这四样要分别报，任何一样都代替不了其余几样。

## SP、CP、Ulysses 是什么关系？

Megatron SP 解决 TP 组内部分激活重复的问题；[context parallelism（CP，上下文并行）](context-parallel.md)则让长序列的不同位置由不同设备计算，并处理 attention 对远端位置的依赖。两者可以组合，使用的通信组和负责的维度要分别标清。

举一个 4 卡组合布局的示意：卡 0、1 组成一个 TP2 组，负责前 4 个位置；卡 2、3 组成另一个 TP2 组，负责后 4 个位置。SP 在每个 TP 组内运行：归一化时每卡 2 行，组内 All-Gather 后每卡得到本组的 4 行，再算本卡通道。CP 通信组连接持有对应 TP 分片的卡，即卡 0 与 2、卡 1 与 3，在 attention 中交换远端位置的 K/V。这里 SP 的 All-Gather 没有收齐全序列的 8 行。

DeepSpeed Ulysses 的命名也属于 sequence parallelism。一个 attention 头是一套独立的查询匹配与加权汇合；Ulysses 通过 All-to-All，在“部分位置、全部头”和“全部位置、部分头”两种布局间转换，从而完成分布式 attention。它与 Megatron SP 的通信位置和作用不同；具体的前后形状及其与 Ring 的组合，统一见 [CP 页的 Ulysses 一节](context-parallel.md#ulysses-怎样把位置分工换成头分工)。

## vllm-ascend 里的 SP 是怎样接进去的？

以下按本页固定镜像 `db701c1f` 解释 FlashComm1。它是 Ascend 的一条 SP 路径，开关是 `enable_flashcomm1`，也可以用环境变量 `VLLM_ASCEND_ENABLE_FLASHCOMM1`，该开关默认关；共享专家配置还可能间接开启它，见[怎么开](#怎么开)。每一步前向开始时先判断这一步走不走 SP，再为选中的投影路径改三处。细粒度 TP、FlashComm2、视觉编码器和模型专用路径另有分支，不能把下面的入口出口替换套到所有线性层。


固定镜像的 MoE 上下文除了检查 SP 开关，还要求本次 token 数不为空；进入这条分支时会关闭单独的矩阵乘加 Reduce-Scatter 融合标志。这是该 MoE 分支的组合条件，不能只凭全局开关推断所有层的通信融合。

1. **这一步走不走。** MoE 模型（前馈层由多个专家网络组成的模型，见 [MoE](moe.md)）要求开关打开且本次 `num_tokens` 不是 `None`，没有 1000 token 门槛；稠密模型（没有专家、每层就是普通 MLP 的模型）还要求这一步 token 数超过 1000；稠密的草稿模型（投机解码里负责先猜几个 token 的小模型）不走这条路径。决定走 SP 时，同时算好要补几行：补齐行数 = (N − T mod N) mod N。
2. **行切投影的出口换成 Reduce-Scatter。** 进入 `SequenceRowParallelOp` 且需要 TP 归约的 attention 输出、MLP 降维等投影，不再做 All-Reduce，而是补齐后 Reduce-Scatter。非 MoE 模型且 TP 不超过 8 时，未量化或所支持的静态 W8A8 方法还能把矩阵乘与归约融合；动态 W8A8 等其他方法仍分开执行。静态 W8A8 融合输出显式设成 BF16（量化精度见[量化页](quantization.md)）。本次 FlashComm1 未生效时，这个归约分支仍执行 All-Reduce。
3. **列切投影的入口先 All-Gather。** 选入 `SequenceColumnParallelOp` 的投影在矩阵乘之前收集输入、去掉补齐行，拿到该 TP 组的全部行再算；视觉语言模型首层 attention 已持有完整嵌入输入时会跳过这次收集。

共享专家（MoE 里每个 token 都会经过的那个专家）另有安排：固定版本的 `shared_expert_dp_enabled()` 在共享专家 DP、FlashComm1 或图改写 SP 任一开启时为真；匹配共享专家前缀的线性层便**不再按 TP 切**。在本页正常 FlashComm1 前向中，每张卡存一整份共享专家权重，只算本卡那几行 token，输出也不再为共享权重切片做 TP All-Reduce。这是这种实现里「权重反而变多」的地方；共享专家直接在本卡已有的 token 行上算，不用先 All-Gather。其他模型的共享分支和新版实现仍需分别核对。

残差也跟着切：attention 输出只剩本卡几行时，残差先补到同样的总行数，再按卡号取出自己那一段，两者 token 对齐后才相加。

**MoE 层怎么接。** 这要看 MoE 层用哪种方式在卡之间搬 token。EP（expert parallel，专家并行）把 MoE 的专家分到不同卡上，每个 token 要被送到持有它所选专家的卡（见[专家并行](expert-parallel.md)）。本页普通 A2 路径主要比较 MC2（按目的专家派发并汇合结果）与 AllGather（先收齐输入，再只算本卡专家）；MC2 的派发、汇合算子不等于把专家矩阵乘也全部融合成一个算子。A2 上怎么选见 [EP 页](expert-parallel.md#mc2-还是-allgather)。

- **走 AllGather 时**（比如 token 数超过 MC2 的容量）：在本页 DP2、FlashComm1 生效且门控多流关闭的分支，MoE 入口在 EP 组收集 token 行和路由分数（决定每个 token 去哪几个专家的打分）；走 W8A8 时先把激活动态量化成 INT8，再连同逐 token 的量化尺度一起收集。没有 DP metadata 时辅助函数使用 TP 组；门控多流开启时则另有收集激活与路由结果的顺序。
- **走 MC2 时**：在共享专家 DP 和替代归约均关闭的普通路径，入口把完整 token 行按 TP 卡数分给各卡，每卡只派发自己那份。本次 FlashComm1 生效后，调用者将 `replace_allreduce` 置真：各卡已经持有各自的行，跳过这次补齐和切分，也不在入口额外做 EP All-Gather。

同样多的元素，INT8 载荷只有 BF16 的一半，但这只是这一次收集的激活载荷变小，推不出整个 MoE 层、整层或整个网络的通信量减半。

**名字相近的另外两条路。** 上面讲的都是 FlashComm1，由 vllm-ascend 自己的开关决定。上游 vLLM 还有两样东西也叫「序列并行」：一个是判断 MoE 层要不要按序列并行处理的属性，一个是编译配置里的图改写开关。三者不是同一个开关，触发条件要分别核对，见[对照源码](#怎么开)。

## 放到 GLM 双机：这套部署开了 SP 吗？

部署是两台 Atlas 800 A2、每台 8 卡，TP8、DP2、EP16，W8A8 量化，完整前提见[部署前提](glm-5-3-flash-two-node.md#部署前提)。

**在固定双机基线、没有额外配置覆盖时，三条路都关闭。** 这个结论包含共享专家 DP、图改写 SP、FlashComm2 和细粒度 TP 均关闭的前提；它不表示只要启动命令没写 FlashComm1，所有部署就必然关闭 SP。

- **FlashComm1**：官方启动命令没有传 `--additional-config`，环境变量保持默认 0，并且没有共享专家 DP 在初始化或刷新时将 SP 打开，因而这条基线的 `enable_sp()` 返回假（配置优先级和缓存见 [Ascend 配置页](ascend-config-system.md)）。
- **图编译改写**：上游这个版本把编译配置里 `enable_sp` 的默认值定为关，默认档位中「是稠密模型才开」的条件目前恒为假；启动命令也没有另外打开。
- **上游 `use_sequence_parallel_moe`**：Ascend 在编译配置没开 `enable_sp` 时，把 all2all 后端（MoE 层在卡之间派发 token 所用的通信实现）改成不在名单里的一种，专门让这个属性为假；所以共享专家照常按 TP8 切（见 [TP 页](tensor-parallel.md#稠密-mlp-与共享专家每卡各留一段通道)）。

因此本基线的词嵌入归约，以及需要归约的普通 TP attention 输出、稠密 MLP 降维，采用 All-Reduce：词嵌入入口一次（见[词嵌入](embedding.md)），attention 输出投影后各一次，稠密 MLP 层降维后各一次。MoE 派发、共享专家与末尾归约按各自路径计，完整次数和字节见[集合通信页的 GLM 走读](collective-communication.md#从嵌入到逐层投影)。这里所列普通 TP 归约后的每卡结果是完整的 [T, H]。

**假如打开（变体，本部署没有用）。** 下面按源码规则推一遍会变什么，都没有实测过。

GLM 是 MoE 模型，没有 1000 token 门槛；在本次 token 数已提供、FlashComm1 生效的前向中，示例请求 R1 的一步只有 $T = 4$ 个 token（见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)），TP8 按源码规则补齐如下（静态推算，未实测）：

$$\text{pad} = (N - T \bmod N) \bmod N = (8 - 4) \bmod 8 = 4\text{ 行}$$

| 假如 GLM 双机打开 SP（R1 一步 $T = 4$，TP8） | 算式 | 结果 |
| --- | --- | --- |
| 补齐行数 | $(8 - 4 \bmod 8) \bmod 8$ | **4 行** |
| 补齐后总行数 | $4 + 4$ | **8 行** |
| 每张卡分到行数 | $8 \div 8$ | **1 行**（8 张卡里有 4 张拿到补齐空行） |

这么小的批，每卡省下的只是几行激活，却多了补齐和两次调用；有 DP2 时，两组的行数还要先对齐到两组最大值向上取 8 的倍数。其余几处也会跟着变：

- 融合的「矩阵乘 + Reduce-Scatter」算子只给非 MoE 模型用，GLM 会先做完矩阵乘、再单独 Reduce-Scatter。
- 共享专家从 TP8 的切片变成每卡一整份权重，只算本卡的 token 行（见上一节）；[TP 页的显存账](tensor-parallel.md#稠密-mlp-与共享专家每卡各留一段通道)里共享专家那一项要重算。
- 词嵌入入口的归约在 v0.23、v0.26 rc 的适用分支会改走补齐加 Reduce-Scatter（见[词嵌入](embedding.md)）。
- MoE 入口：R1 这样的小批走 MC2（GLM 每卡 288 ÷ 16 = 18 个专家、EP16，见 [EP 页](expert-parallel.md#mc2-还是-allgather)），入口不做 EP 收集，本卡的 token 行直接派发；大批改走 AllGather 时，才在 EP 组里收集 INT8 激活和尺度。

各页已经算好的通信账都要按新路径重算。

**GLM 的四路残差。** GLM 的残差不是一条而是 4 条并行的流（mHC，见[层与 hidden](layers-and-hidden.md#一层接过什么交出什么glm-为什么在层间传四条)），每个 token 的残差是 4 × H 个数。打开 FlashComm1 时，attention 输出只留本卡的 token 行，mHC 的四路残差，以及每个 token 在子层入口算出的写回权重（post）和流间混合矩阵（comb），也按同样的 token 行切分。SP 改变的只是 token 这一维归谁，4 条流这一维仍然完整。前面 [T, H] 的算例描述的是子层的输入输出；数残差缓冲时要乘 4，不能按单路算。GLM 的 hidden 宽度正好是 4096（见 [GLM-5.3-Flash](glm-5-3-flash.md)），所以[代价一节](#省下了什么又要付出什么)按 BF16 算的「一行 8 KiB」，就是 GLM 单路 [T, H] 的一行；四路残差缓冲每个 token 是它的 4 倍。

## 常见误解

- **「SP 多了一次通信，所以一定更慢。」** [标准示例](#省下了什么又要付出什么)中两边都是每卡发送 8 个数，但调用次数、补齐、融合与重叠不同，实际耗时要测。载荷相等不等于性能相等。
- **「SP 把 attention 也按查询位置分给各卡了。」** 本页的 Megatron SP 在 TP 投影前恢复组内行集合；CP 或 Ulysses 才另外组织跨位置 attention。SP 与 CP 可以组合，不能仅凭 SP 这个缩写判断布局。
- **「SP 要另外一组卡。」** 不要。SP 用的就是 TP 那组卡和那个通信组，只是改变了行切之后那一段数据归谁。
- **「把 RMSNorm 的 H 维切开，也能完全本地计算。」** 分列后需要跨卡合并平方和等统计；按 token 行切且保留完整 H 维，才可以逐卡独立完成本页的 RMSNorm。
- **「开了 SP，每张卡的显存就除以 N。」** 标准区域的激活按行减少，KV cache、权重和其他缓冲要另算；固定 Ascend 的共享专家还会从 TP 切片变成每卡一整份权重。
- **「W8A8 下 SP 的通信量减半。」** 只有 MoE 走 AllGather 时，入口那次收集的激活载荷从 BF16 变成 INT8（走 MC2 时入口根本不做这次收集）；路由分数和逐 token 尺度照样要传，行投影出口的 Reduce-Scatter 输出仍是 BF16。
- **「只有残差和归一化能逐 token 计算。」** 线性投影、MLP 也逐 token 独立；本页在投影入口收集行，是为了配合各卡已有的 TP 权重分片。跨位置依赖出现在 attention 的评分和加权汇合。
- **「GLM 双机开了 FlashComm1。」** 本页固定基线的三条路关闭；额外配置可能改变它，见[上一节](#放到-glm-双机这套部署开了-sp-吗)。

## 对照源码

### 怎么开

- **FlashComm1**：`--additional-config '{"enable_flashcomm1": true}'`，或环境变量 `VLLM_ASCEND_ENABLE_FLASHCOMM1=1`。固定版本的 `enable_sp()` 首次初始化缓存或 `additional_config.refresh` 为真时才重新解析：先读 JSON 中的该键，否则读 Ascend 配置，读取配置触发 RuntimeError 时回退到环境变量。没有重算时直接返回缓存；只带一个值为假的 `refresh` 键不会刷新。[C9]
- **被动打开**：固定版本和 v0.23 上，`enable_shared_expert_dp=True` 且开了 EP、TP > 1 时，配置阶段调用 `enable_sp(..., enable_shared_expert_dp=True)`；在其初始化或刷新分支中，原为假的 SP 会被置真。若已有假缓存且未刷新，该次调用不会重算，配置中的断言会失败。[C11] v0.26 rc 不再用这个兼容参数强制开启 SP。[C18]
- **上游 `use_sequence_parallel_moe`**：不是开关，而是 vLLM 根据配置算出的属性，要求 all2all 后端在指定名单里、开了 EP、TP > 1、DP > 1；上游用它决定 MoE 层是否按序列并行处理，比如共享专家是否跳过 TP 切分。[C15] main 上 `enable_sp()` 直接等于它（见版本差异）。
- **图编译改写**：它把「All-Reduce → 残差相加 + RMSNorm」整段换成「Reduce-Scatter → 残差相加 + RMSNorm → All-Gather」，只在不强制 eager（逐算子直接执行）的图模式下生效。`--compilation-config '{"pass_config": {"enable_sp": true}}'`，并且模型不能 `enforce_eager`，这时 `enable_sp_by_pass` 为真。[C14] Ascend 把 `sp_min_token_num` 的默认值设成 MoE 模型 1、稠密模型 1000，编译范围的起点低于它时不改写。[C13]
- **和 PCP 一起开**：prefill 上下文并行（PCP）大于 1 且 SP 打开时，`max_num_batched_tokens` 会被上调到 TP × PCP 的倍数。

### 会报什么错

开启路径不仅要看日志，还要看派生结果。例如上面的共享专家 DP 断言失败时会阻止配置完成；以下列出与本页路径直接相关的提示，不是完整错误清单：

| 情况 | 日志 | 版本 |
|---|---|---|
| `enable_shared_expert_dp` 把 SP 强制打开 | info：`shared_expert_dp requires enable_sp=True. enable_sp has been set to True.` | 固定版本、v0.23 |
| PCP > 1 且 `max_num_batched_tokens` 不是 TP × PCP 的倍数 | warning：`When using FLASHCOMM1, the max_num_batched_tokens should be divisible by tp_size * pcp_size ...`，随后自动上调 | 固定版本 |
| 配置里仍写了 `enable_flashcomm1` 或环境变量 | warning：`FlashComm is deprecated; remove enable_flashcomm1 ...` | main |
| 打开了 FlashComm1，但配置不满足上游 sequence-parallel MoE | warning：`FlashComm1 is enabled, but the current config does not support sp MoE. Disabling` | main |

### 开销和什么时候别开

- **小批**：稠密模型的 1000 token 门槛是经验值，低于它时两次调用和切换通信方式的开销可能超过收益；MoE 模型没有这道门槛，T 比 TP 小时大半是补齐行（见 GLM 一节的推算）。
- **融合算子的条件**：固定版本这条 `SequenceRowParallelOp` 融合要求本次 FlashComm1 生效、TP ≤ 8、非 MoE 上下文，并匹配未量化或受支持的静态 W8A8 方法；其他方法走单独矩阵乘和 Reduce-Scatter。这个限制不覆盖新版 Kimi 的另一套融合实现。
- **多个 DP 组**：各组要补到同一行数，组间 token 数差得越多，补的空行越多。
- 判断收益时按[代价一节](#省下了什么又要付出什么)的四样分别量。

### 版本差异

rc2 Kimi O projection 新增有条件的 MM+ReduceScatter 融合，只改变合适纯 prefill 的实现，其他路径仍返回同样的 SP token 片；完整硬件、残差、LoRA 和 dtype 门槛见 [TP 版本对照](tensor-parallel.md#版本差异)，不是 GLM 的通用默认。

FlashComm1 在固定 main 的消费逻辑已经有效；rc2 的变化是移除工厂中的弃用告警，不是重新恢复一项曾被忽略的开关。下面比较开关时，以最终消费者和实际派生结果为准。

**v0.30.0rc2 仍实际读取 FlashComm1 开关，不能沿用旧 main 的弃用说法。** enable_sp 最终读取上游 use_sequence_parallel_moe，但 AscendConfig 会将 JSON 的 enable_flashcomm1 与环境变量 VLLM_ASCEND_ENABLE_FLASHCOMM1 的 1/true 取或；DSA-CP 也会自动开启 FlashComm。两者均未开时会改写 all2all_backend 以禁用 SP MoE，若配置本身不支持 SP MoE 还会告警关闭 DSA-CP。PCP>1 且 SP 生效时，最大批 token 数向上补齐到 TP×PCP 的倍数；这是一项容量对齐，不是额外的真实 token。

按四版本正式钉点核对：`v0.23.0`（`2c59ff10` / `0fc695fc`）、`v0.26.0rc`（`2ed6cbba` / `568afb3a`）、`v0.30.0` 主基线（`c09d3e20` / `ced6857a`）与 `main`（`8d6180e2` / `ba15685a`）；本文 GLM 双机绑定算例另钉住例外 B 镜像 `db701c1f`（历史快照 `baa023ad` / `7d825229` 见来源清单与上方说明）。

| 核对项 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
|---|---|---|---|---|
| FlashComm1 开关与派生 | `enable_flashcomm1` / 环境变量，默认关；`enable_shared_expert_dp` 会强制打开 SP | 同 `v0.23.0`，但 `enable_shared_expert_dp` 不再强制开 SP | JSON `enable_flashcomm1` 与 `VLLM_ASCEND_ENABLE_FLASHCOMM1` 取或，`enable_dsa_cp` 自动联动开启；同时驱动 Qwen3.5 稠密族 SP（`ascend_config.py#L747-L780`） | 保留 FlashComm1 JSON / 环境变量与 Qwen3.5 稠密族 SP，不再由 `enable_dsa_cp` 联动开启；`FlashComm1` + `use_sequence_parallel_moe` 同时启用时通过 `logger.warning_once` 告警并将 `quantized_all_reduce_config.enable` 置 `False`（`ascend_config.py#L845-L885`）[C19] |
| `enable_sp()` 判定与校验 | 判断 FlashComm1 缓存 | 同 `v0.23.0` | `use_sequence_parallel_moe or enable_dense_sp`（`utils.py#L1071-L1084`）；`platform.py#L1437-L1443` 强校验 `tp_size > 1` 且 MoE 须开 EP | 同 `v0.30.0`（`utils.py#L1050-L1065`、`platform.py#L1724-L1730`）[C20] |
| 上游图改写 `PassConfig.enable_sp` 与 `SP+PP` | 存在，默认关 | 存在，默认关 | 存在；`SP + PP > 1` 时若未显式禁用 `-rms_norm`，上游自动向 `custom_ops` 追加 `+rms_norm`（`vllm@ced6857a:vllm/config/vllm.py#L1877-L1898`） | **上游 `vllm@ba15685a` 已移除 `PassConfig.enable_sp`** |
| `SP + PCP > 1` 批长对齐 | 固定镜像调整至 `tp * pcp` 倍数 | 延续 | `max_num_batched_tokens` 向上取整至 `tp_size * pcp_size` 倍数并打 warning（`ascend_config.py#L816-L828`） | 同 `v0.30.0`（`ascend_config.py#L886-L897`） |
| 稠密 1000 token 门槛与行切出口 | 有 1000 token 门槛；`SequenceRowParallelOp` 补齐后 RS 或融合算子 | 同 `v0.23.0` | 已移除 `SequenceRowParallelOp` 与前向上下文 1000 门槛；`maybe_pad_and_reduce` 仅用于 EP 通信；Kimi `o_proj` 新增条件式 MM+RS 融合 | 同 `v0.30.0`（`register_custom_ops.py#L101`）[C21] |
| 词嵌入入口与 GLM 稠密 MLP | 嵌入补齐后 RS；GLM 稠密 MLP 走普通 SP 线性路径 | 同 `v0.23.0` | 嵌入固定 All-Reduce；GLM 稠密 MLP 传入 `is_sequence_parallel=True` 时复制权重并关末尾归约 | 同 `v0.30.0` |

### 源码位置

- **开关与判定**：`vllm_ascend/utils.py` 的 `enable_sp()`；`ascend_config.py` 里 `enable_flashcomm1`、`enable_shared_expert_dp`、PCP 调整；`envs.py` 的默认值（`VLLM_ASCEND_ENABLE_FLASHCOMM1` 默认 `"0"`）；[C12] 上游 `vllm/config/parallel.py` 的 `use_sequence_parallel_moe`。
- **每一步走不走、补几行**：`ascend_forward_context.py` 的 `flash_comm_v1_enabled`（MoE 无门槛、稠密要超过 1000、稠密草稿不走）、`mmrs_fusion`（TP ≤ 8 且非 MoE）、`pad_size`；[C5] 多个 DP 组时的 `padded_length`（取各组最大 token 数，向上补到 TP 的倍数）。[C6]
- **行切出口与列切入口**：`ops/linear_op.py` 的 `SequenceRowParallelOp.matmul_and_reduce`（开关关时 All-Reduce；打开时补齐后 Reduce-Scatter 或融合算子，W8A8 融合路径 `output_dtype = bfloat16`）、[C3] `SequenceColumnParallelOp.apply_impl`（先 All-Gather 再去补齐），[C2] 以及按层名前缀选择它们的 `_get_column_parallel_op` / `_get_row_parallel_op`。
- **共享专家不切**：`get_parallel_op` 在层名含 shared_expert 且 `shared_expert_dp_enabled()` 为真时返回 tp_size = 1；[C22] `fused_moe.py` 这时也不对共享专家输出做 TP All-Reduce。
- **补齐、Reduce-Scatter、All-Gather、残差切分**：`ops/register_custom_ops.py` 的 `maybe_pad_and_reduce`、`maybe_all_gather_and_maybe_unpad`、`maybe_chunk_residual`。[C4]
- **MoE 入口**：A2 上 `_select_a2_moe_comm_method` 决定走 MC2 还是 AllGather；只有 `PrepareAndFinalizeWithAllGather.prepare` 在 SP 下走 `_prepare_with_ep_group`，W8A8 时先 `npu_dynamic_quant` 再连同逐 token 尺度一起 All-Gather。[C8]
- **GLM 的 mHC 分片**：`models/glm5_next.py` 的 `_make_attention_output` 与 decoder 层 `forward`，残差、post、comb 都经 `maybe_chunk_residual`。[C7]
- **GLM 双机关闭的依据和前提**：固定部署没有额外覆盖共享专家 DP、FlashComm1 和图编译参数；`IS_DENSE = False` 与优化档位的 SP 默认值共同支持图改写未开。[C17] Ascend 在自动 worker 分支中把 all2all 后端改成 `flashinfer_all2allv`，让 `use_sequence_parallel_moe` 为假。[C16] 这是本页基线推导，修改启动配置后须重新核对。[D]
- **图编译改写**：`compilation/passes/sequence_parallelism.py` 的 `MiddleAllReduceRMSNormPattern` 等。

正文里几条不是直接读源码得到的结论，出处如下：

- Megatron SP 的范围、完整层布局和前向通信边界：Korthikanti et al. 2022 的 §4.2.2、图 5/6；论文表 4 也区分通信载荷与实测耗时。[S1]
- Ulysses 的序列/头布局互换见其论文图 2；Megatron SP 与 CP 的范围及可组合关系见官方 CP 说明。[S26][S27]
- 四行归一化、下一次投影、SP+CP 组合布局均为教学推导；γ=1、ε=0、两卡与小矩阵是示意条件。[D]
- 相同形状/精度、无额外补齐的标准前向边界中，Reduce-Scatter 与 All-Gather 的理想发送量之和等于 ring All-Reduce；不据此推断实际时延相同。[D]
- 普通推理不为反向传播保存训练激活，因此不能直接复用论文的训练显存节省比例；推理收益须单独测量，本页未作实测。[I]
- GLM 双机打开 SP 的变体（R1 一步 T = 4 补到 8 行、每卡 1 行，MoE 入口小批走 MC2），按上面的源码规则推算，未实测。[D]

上述辅助函数的回退条件见来源 4（db701c1f）的第 51–95 行：读取前向上下文触发 AssertionError 时，maybe_all_gather_and_maybe_unpad 原样返回输入，maybe_pad_and_reduce 则执行 TP All-Reduce；这里捕获的是这一种异常。上下文存在时，收集须 label 为真，并且同时满足以下之一：FlashComm1 已启用；或图编译 SP 改写已启用且用于 EP 通信。归约端在这两种路径都未启用，或视觉语言模型的草稿分支且不是 EP 通信时，也回退到 TP All-Reduce。

两版 enable_sp 的接口差异见来源 18、20：2ed6cbba 仍接受 enable_shared_expert_dp 参数，但它只为兼容调用保留，不再改变 FlashComm1 设置；baa023ad 不再接受该参数，返回上游 use_sequence_parallel_moe。后一版本未传配置时会读取当前配置；该读取触发 AssertionError 后仍无配置，就返回 False，不能把这一分支套到前一版本，也不能据此推断其他异常都会被吞掉。

- 来源 29、42、43：固定镜像及 v0.23 / v0.26 rc 的 MoE、稠密和草稿前向分支；来源 44 对照 main 的上下文设置。
- 来源 36、37：上游默认优化档位、异步 TP 对 SP 的依赖，以及 TP / 阈值校验；不能只凭 `IS_DENSE` 常量判断任意显式配置。
- 来源 38、39：main 的 GLM 稠密 MLP 构造及其 `is_sequence_parallel` 调用条件；来源 40、41 是 v0.23 的缓存、共享专家 DP 与 PCP 配置。
- 来源 45：main 工厂的弃用告警原文；告警与来源 19、33 的实际消费需一起读。
- 来源 46、47：MC2 的补齐切分门控与调用者传入的 `replace_allreduce`；来源 23、48 分别支持门控多流和独立共享分支的输出归约条件。
