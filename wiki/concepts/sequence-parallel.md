---
id: sequence-parallel
title: 序列并行（SP）：让局部激活按 token 分片
type: feature
summary: TP 之后，残差相加、RMSNorm 这类逐 token 的步骤在每张卡上重复做；序列并行把那次 All-Reduce 拆成 Reduce-Scatter 和 All-Gather，中间每张卡只算、只存自己那几个 token。通信量不变，代价是补齐和调用开销；GLM 双机没有开。
aliases: [Sequence Parallel, 序列并行, SP, FlashComm1, FlashComm V1, enable_flashcomm1, enable_sp, sp_min_token_num, maybe_pad_and_reduce, SequenceRowParallelOp, use_sequence_parallel_moe]
chapters: ["15"]
order: 10
sources:
  - https://arxiv.org/abs/2205.05198
  - vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L458-L478
  - vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L550-L611
  - vllm-ascend@db701c1f:vllm_ascend/ops/register_custom_ops.py#L23-L116
  - vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L114-L144
  - vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L164-L172
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2171-L2235
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L375-L407
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L905-L936
  - vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L672-L747
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L84-L137
  - vllm-ascend@db701c1f:vllm_ascend/envs.py#L75
  - vllm-ascend@db701c1f:vllm_ascend/compilation/passes/sequence_parallelism.py#L13-L135
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L291-L295
  - vllm@0fc695fc:vllm/config/parallel.py#L625-L640
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L653
  - vllm@0fc695fc:vllm/config/vllm.py#L96-L101
  - vllm-ascend@2ed6cbba:vllm_ascend/utils.py#L861-L888
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L608-L628
  - vllm-ascend@baa023ad:vllm_ascend/utils.py#L945-L957
  - vllm-ascend@baa023ad:vllm_ascend/ops/register_custom_ops.py#L88-L115
  - vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L751-L756
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/fused_moe.py#L605-L614
  - vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L240-L252
  - vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/prepare_finalize.py#L333-L373
verified: []
evidence: "C"
relations:
  - {to: tensor-parallel, kind: builds-on, note: 先理解完整归约结果与部分和}
  - {to: collective-communication, kind: builds-on, note: 掌握 Reduce-Scatter 和 All-Gather}
  - {to: mlp-residual-norm, kind: builds-on, note: 理解逐 token 的归一化和残差}
contradicts: []
updated: "2026-09-29"
origin: seed
---

## 序列并行是什么？

模型一次前向处理的是一批 token。[token](token.md) 是文本切分后的最小单位；每个 token 在模型里是一条长度为 H 的向量，叫 hidden（见[层与 hidden](layers-and-hidden.md)）。这一批 T 个 token 按顺序排好就是一个「序列」，叠在一起是一张 T 行 H 列的表，记作 [T, H]，**一行是一个 token**。

每一层对这张表做的事分两类：

- **要看别的 token 的**：attention（注意力）让每个 token 去读前面 token 的信息，算第 3 行时要用到第 1、2 行。
- **每个 token 各算各的**：比如 residual（残差）相加，把子层的输入原样加回输出；RMSNorm（均方根归一化），把一个 token 的向量按它自己的大小缩放到统一的尺度（两者见[残差、MLP 与归一化](mlp-residual-norm.md)）。算第 3 行只用第 3 行自己的数，别的行一个都不需要。

**sequence parallelism（SP，序列并行）把第二类「各算各的」活沿 token 这一维分给几张卡：T 行分成几段，每张卡只存、只算自己那一段行。** 名字里的「序列」指的就是 token 这一维。

举个例子（示意）：一句话切成 4 个 token「今天 / 天气 / 很 / 好」，两张卡（加速卡，每张有自己的显存和算力）一起跑。不用 SP 时，两张卡都要把这 4 个 token 各归一化一遍；用了 SP，卡 0 只管「今天、天气」两行，卡 1 只管「很、好」两行，谁也不碰对方的行。

SP 不单独使用，它总和 [TP](tensor-parallel.md)（tensor parallel，张量并行）搭配，用的就是同一组 TP 卡。TP 把一层里的权重矩阵切给几张卡，每张卡只存一片权重，但每张卡仍要处理全部 T 行；SP 补的是 TP 没切到的那一段：不乘权重、逐 token 独立的那几步，改成按行切。这个做法出自 Megatron-LM 团队的论文 Korthikanti et al. 2022（*Reducing Activation Recomputation in Large Transformer Models*）。在 vllm-ascend（让 vLLM 推理框架跑在昇腾 NPU 上的插件）里，它的实现叫 FlashComm1，[后文](#vllm-ascend-里的-sp-是怎样接进去的)再讲。

## 为什么需要它：TP 之后每张卡都在重复同一份活？

先用一段话回顾 TP 怎么切（逐数演算见 [TP 页](tensor-parallel.md#两种切法各算一遍拼起来还是加起来)）。一层里的矩阵乘成对出现：第一个矩阵**按列切**，每张卡算出输出的一段；第二个矩阵**按行切**，每张卡只用自己那一段输入和对应的几行权重，算出的是一份**部分和**：形状和完整结果一样，但每个数只加了本卡那一份贡献，把各卡的部分和按位置相加才是真结果。所以普通 TP 在行切之后做一次 [All-Reduce](collective-communication.md#all-reduce)：各卡的部分和按位置相加，而且**每张卡都拿到一整份** [T, H] 结果。

问题出在接下来那几步。行切之后紧跟着的是残差相加和下一个子层入口的 RMSNorm，它们不乘权重，每个 token 各算各的。可这时每张卡手里的 [T, H] 一模一样，于是：

- **计算重复**：N 张卡（N 是一起做 TP 的卡数）各把同样的 T 行归一化一遍，结果完全相同，其中 N−1 份是白算的；
- **存储重复**：这一段的中间结果（叫激活，activation）每张卡都存一整份，N 张卡存了 N 份一样的数。

```wiki-diagram
file: sequence-parallel
```

上半幅是只用 TP：All-Reduce 之后两张卡的 4 行一样，各自把 4 行都算一遍。能不能像下半幅那样，每张卡只算 T/N 行？两个条件都满足：

1. 这几步逐 token 独立，卡 0 算 token 0、1 时用不到 token 2、3 的任何一个数；
2. All-Reduce 本身就能拆成两半：先 [Reduce-Scatter](collective-communication.md#reduce-scatter)，按位置相加，但每张卡只拿走结果里属于自己的那一段；再 [All-Gather](collective-communication.md#all-gather)，每张卡把自己那段发给其他卡，拼回整份。两半合起来正好是一次 All-Reduce，集合通信页已经[逐块演过](collective-communication.md#all-reduce)。

SP 就是把这两半拉开：行切之后只做 Reduce-Scatter，每张卡拿到 T/N 行的完整值，逐 token 的几步只算这几行；等下一对矩阵开始、它的列切要求每张卡都有全部 T 行输入时，再做 All-Gather 把行拼回来。**中间一直保持按 token 分片，到了需要完整行集合的投影之前才收集。**

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

```wiki-diagram
file: sequence-parallel-steps
```

**第 1 步 Reduce-Scatter：只把属于自己的行加齐。** 约定 token 0、1 归卡 0，token 2、3 归卡 1。卡 1 把它手里 token 0、1 的部分和 [0, 4]、[4, 0] 发给卡 0，卡 0 加进自己的 [1, 3]、[3, 1]，得到 [1, 7]、[7, 1]；同时卡 0 把 token 2、3 的 [2, 2]、[8, 15] 发给卡 1，卡 1 加出 [5, 5]、[17, 31]。这一步之后，每张卡手里有 2 行**完整**的值；另外 2 行只是已经发出去的输入，不再算作结果（图中第 1 步的结果只画 2 行）。

**第 2 步 本卡计算：各自只做自己的两行。** 以卡 0 的 token 0 为例：

```calc
title: 卡 0 对 token 0 做 RMSNorm（γ 取 1，ε 取 0，数为示意）
token 0 的完整值 = [1, 3] + [0, 4] = [1, 7]
平方的平均 = (1² + 7²) ÷ 2 = 50 ÷ 2 = 25
均方根 = √25 = 5
归一化结果 = [1 ÷ 5, 7 ÷ 5] = [0.2, 1.4]
```

同样算，卡 0 得到 token 1 的 [1.4, 0.2]；卡 1 得到 token 2 的 [1, 1]（均方根 5）和 token 3 的 [0.68, 1.24]（(17² + 31²) ÷ 2 = 625，均方根 25）。这一步两张卡之间一个数也不传。

**第 3 步 All-Gather：拼回完整的 4 行。** 卡 0 把算好的两行发给卡 1，卡 1 把它的两行发给卡 0，按 token 顺序放好。两张卡都得到 token 0 [0.2, 1.4]、token 1 [1.4, 0.2]、token 2 [1, 1]、token 3 [0.68, 1.24]。

**结果和只用 TP 时逐数相同。** 只用 TP 时，All-Reduce 让两张卡都拿到 [1, 7]、[7, 1]、[5, 5]、[17, 31]，再各自把 4 行归一化，得到的正是上面这 4 行。原因是 RMSNorm 每一行只用这一行自己的数，先把行分开算、再拼起来，和整张表一起算没有区别。一般地说，只要中间的函数逐行独立，「先归约并分片 → 逐行计算 → 收集」与「先完整归约 → 逐行计算」结果一致。

两种做法的工作量：

```calc
title: 同一个例子里两种做法各做了多少（数为示意）
只用 TP·每卡 RMSNorm = 4 行
只用 TP·两卡合计 = 4 + 4 = 8 行，其中 4 行是重复的
TP + SP·每卡 RMSNorm = 2 行
TP + SP·两卡合计 = 2 + 2 = 4 行，没有重复
只用 TP·每卡存的这段激活 = 4 行 × 2 个数 = 8 个数
TP + SP·每卡存的这段激活 = 2 行 × 2 个数 = 4 个数
```

**切的是行，不是列。** RMSNorm 要用一个 token 的全部 H 个数求均方根：token 0 的 1 和 7 必须在同一张卡上。所以 SP 沿 token 维切，每张卡拿到的是完整的行，H 维保持完整；如果改成按列切，卡 0 只有 1、卡 1 只有 7，谁都算不出均方根 5。

**哪些步骤能放进这一段。** 「逐 token 独立」只适用于残差相加、RMSNorm 这类运算。attention 要读其他位置，不能只拿自己的几行算，所以进入 attention 的投影之前必须先 All-Gather。同一段里一起参与计算的其他张量，比如残差、位置信息，也必须按同样的 token 归属切：卡 0 手里是 token 0、1 的子层输出，就得配 token 0、1 的残差，否则会把不同 token 的数加到一起。

**放回一层里。** 一层 Transformer 有两个子层（attention 和 MLP），每个子层末尾都是一次行切矩阵乘。用了 SP 以后，原来「attention 输出投影后一次 All-Reduce、MLP 降维后一次 All-Reduce」变成：

1. attention 的输出投影（行切）→ Reduce-Scatter → 本卡几行做残差相加和 MLP 入口的 RMSNorm → All-Gather → MLP 的升维投影（列切）；
2. MLP 的降维投影（行切）→ Reduce-Scatter → 本卡几行做残差相加和下一层入口的 RMSNorm → All-Gather → 下一层 attention 的 q、k、v 投影（列切）。

## 省下了什么，又要付出什么？

**通信量没有变。** SP 没有新增通信，只是把原来那次 All-Reduce 的两半分开放。还用上面的例子数一数：卡数 N = 2，每张卡的完整张量 M = 4 行 × 2 = 8 个数（公式里的 N、M 怎么数，见[集合通信页](collective-communication.md#通信量里的-n-和-m-到底数什么)）。

```calc
title: 两种做法每张卡发出多少个数（N = 2，M = 8 个数，数为示意）
Reduce-Scatter = (N − 1) × M ÷ N = 1 × 8 ÷ 2 = 4 个数，卡 0 发出 token 2、3 的 4 个部分和
All-Gather = (N − 1) × M ÷ N = 1 × 8 ÷ 2 = 4 个数，卡 0 发出 token 0、1 的 4 个归一化结果
SP 合计 = 4 + 4 = 8 个数
All-Reduce（ring） = 2 × (N − 1) × M ÷ N = 2 × 1 × 8 ÷ 2 = 8 个数
```

All-Gather 传的是归一化后的结果而不是原始的和，但形状一样、数据类型一样，所以字节数也一样。

**省下的是这一段的激活和重复计算。** 换成真实模型常见的尺寸（示意）：H = 4096，每个数用 BF16（一种 16 位浮点格式，每个数 2 字节），一个 token 的一行就是 8 KiB。

```calc
title: H = 4096、BF16 时，逐 token 这一段每张卡存多少（示意）
一个 token 一行 = 4096 × 2 B = 8,192 B = 8 KiB
只用 TP·每卡存 4 行 = 4 × 8 KiB = 32 KiB
TP + SP（2 张卡）·每卡存 2 行 = 2 × 8 KiB = 16 KiB
```

省下的只是这一段逐 token 区域里的激活和重复的逐行计算，不是整个模型的全部运行内存：权重、KV cache（为后续生成缓存的历史 token 的 key 和 value，见 [KV cache](kv-cache.md)）、attention 和 MLP 内部的中间结果都不受影响。推理只做前向，激活不必为反向传播一直保留，论文里那笔最大的训练显存收益在这里要打折扣。

**要付出的代价有三样。**

- **调用次数变多，耗时不一定相同。** 语义上 All-Reduce 等于 Reduce-Scatter 加 All-Gather，但拆开后是两次调用，各有启动和同步开销，通信库对两者的实现也不同，不能保证任何后端上两种做法的线上字节和执行耗时完全一样。批很小时，这点固定开销可能比省下的计算还多：vllm-ascend 对稠密模型只在一步的 token 数超过 1000 时才走 SP，源码注释说这是经验值，低于它时切换通信方式可能反而变慢。
- **行数不整除要补齐。** Reduce-Scatter 要把 T 行平分给 N 张卡，T 不能被 N 整除时，先在末尾补几行空行（padding）再通信，All-Gather 之后再把补的行去掉。比如 T = 5、N = 2：补 1 行到 6 行，每卡 3 行，卡 1 的第 3 行是空行。Ascend 的自定义算子正是在 Reduce-Scatter 前补齐、All-Gather 后去掉补齐；有多个 DP（data parallel，数据并行：几组卡各自处理不同的请求，见[数据并行](data-parallel.md)）组时，还要把各组的行数对齐：取各组 token 数的最大值，向上补到 N 的倍数。补的空行、临时缓冲、图模式（把一步的算子预先录成图、之后直接重放）只按几档固定尺寸录制带来的额外补齐，都会吃掉一部分收益。
- **评估要分开量。** 比较开不开 SP 时，局部激活占用、通信输入的精度和形状、线上实际流量、端到端耗时这四样要分别报，任何一样都代替不了其余几样。

## vllm-ascend 里的 SP 是怎样接进去的？

vllm-ascend 把 SP 叫 FlashComm1，开关是 `enable_flashcomm1`，也可以用环境变量 `VLLM_ASCEND_ENABLE_FLASHCOMM1`，默认关。打开以后，每一步前向开始时先判断这一步走不走 SP，再按上一节的流程改三处：

1. **这一步走不走。** MoE 模型（前馈层由多个专家网络组成的模型，见 [MoE](moe.md)）只要开关打开，每一步都走；稠密模型（没有专家、每层就是普通 MLP 的模型）只在这一步 token 数超过 1000 时才走；稠密的草稿模型（投机解码里负责先猜几个 token 的小模型）一律不走。决定走 SP 时，同时算好要补几行：补齐行数 = (N − T mod N) mod N。
2. **行切投影的出口换成 Reduce-Scatter。** attention 的输出投影、MLP 的降维投影这些按行切的矩阵，不再做 All-Reduce，而是先补齐、再 Reduce-Scatter。非 MoE 模型且 TP 不超过 8 时，还能把矩阵乘和 Reduce-Scatter 融合成一个算子；其中 W8A8 量化（权重和激活都用 8 位整数存、算，见[量化](quantization.md)）的融合路径把输出显式设成 BF16。开关没开时，这里仍是一次 All-Reduce。
3. **列切投影的入口先 All-Gather。** attention 的 q、k、v 投影和 MLP 的升维投影这些按列切的矩阵，在矩阵乘之前先 All-Gather 输入、去掉补齐行，拿到全部行再算。

共享专家（MoE 里每个 token 都会经过的那个专家）另有安排：SP 打开后它**不再按 TP 切**，每张卡存一整份共享专家权重，只算本卡那几行 token，输出也不做 TP 的 All-Reduce。这是 SP 里少见的「权重反而变多」的地方；好处是共享专家直接在本卡已有的 token 行上算，不用先 All-Gather。

残差也跟着切：attention 输出只剩本卡几行时，残差先补到同样的总行数，再按卡号取出自己那一段，两者 token 对齐后才相加。

**MoE 层怎么接。** 这要看 MoE 层用哪种方式在卡之间搬 token。EP（expert parallel，专家并行）把 MoE 的专家分到不同卡上，每个 token 要被送到持有它所选专家的卡（见[专家并行](expert-parallel.md)）；搬法主要有两种：MC2（昇腾把派发、专家计算前后的通信融合在一起的实现，按目的地直接发）和 AllGather（先把所有卡的输入收齐，再只算本卡的专家），A2 上怎么选见 [EP 页](expert-parallel.md#mc2-还是-allgather)。

- **走 AllGather 时**（比如 token 数超过 MC2 的容量）：SP 打开后，MoE 层入口改在 EP 组里 All-Gather 各卡的 token 行，路由分数（决定每个 token 去哪几个专家的打分）也一起收集；走 W8A8 量化时，先把激活动态量化成 INT8（8 位整数，每个数 1 字节），再连同每个 token 的量化尺度一起收集。
- **走 MC2 时**：不开 SP 时，MC2 入口会先把完整的 token 行按 TP 卡数分给各卡、每卡只派发自己那份；SP 打开后各卡手里本来就只有自己那几行，这一步直接跳过，也不做 EP 收集，本卡的行直接派发出去。

同样多的元素，INT8 载荷只有 BF16 的一半，但这只是这一次收集的激活载荷变小，推不出整个 MoE 层、整层或整个网络的通信量减半。

**名字相近的另外两条路。** 上面讲的都是 FlashComm1，由 vllm-ascend 自己的开关决定。上游 vLLM 还有两样东西也叫「序列并行」：一个是判断 MoE 层要不要按序列并行处理的属性，一个是编译配置里的图改写开关。三者不是同一个开关，触发条件要分别核对，见[对照源码](#怎么开)。

## 放到 GLM 双机：这套部署开了 SP 吗？

部署是两台 Atlas 800 A2、每台 8 卡，TP8、DP2、EP16，W8A8 量化，完整前提见[部署前提](glm-5-3-flash-two-node.md#部署前提)。

**没有开，三条路都关着。**

- **FlashComm1**：官方启动命令没有传 `--additional-config`，环境变量也保持默认的 0，所以判断 SP 是否启用的函数返回假，每一步都不走 SP（[Ascend 配置页](ascend-config-system.md)有同样结论）。
- **图编译改写**：上游这个版本把编译配置里 `enable_sp` 的默认值定为关，默认档位中「是稠密模型才开」的条件目前恒为假；启动命令也没有另外打开。
- **上游 `use_sequence_parallel_moe`**：Ascend 在编译配置没开 `enable_sp` 时，把 all2all 后端（MoE 层在卡之间派发 token 所用的通信实现）改成不在名单里的一种，专门让这个属性为假；所以共享专家照常按 TP8 切（见 [TP 页](tensor-parallel.md#稠密-mlp-与共享专家每卡各留一段通道)）。

所以本部署每个 TP 出口都走普通 All-Reduce：词嵌入入口一次（见[词嵌入](embedding.md)），每层 attention 输出投影后、稠密 MLP 降维后各一次，次数和字节见[集合通信页的 GLM 走读](collective-communication.md#从嵌入到逐层投影)。每张卡在这些位置拿到的都是完整的 [T, H]。

**假如打开（变体，本部署没有用）。** 下面按源码规则推一遍会变什么，都没有实测过。

GLM 是 MoE 模型，没有 1000 token 的门槛，每一步都走 SP。示例请求 R1 的一步只有 T = 4 个 token（见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)），TP8 要补齐：

```calc
title: 假如 GLM 双机打开 SP，R1 一步 T = 4 怎样补齐（按源码规则推算，未实测）
补齐行数 = (8 − 4 mod 8) mod 8 = (8 − 4) mod 8 = 4 行
补齐后总行数 = 4 + 4 = 8 行
每张卡 = 8 ÷ 8 = 1 行，8 张卡里有 4 张拿到的是补齐的空行
```

这么小的批，每卡省下的只是几行激活，却多了补齐和两次调用；有 DP2 时，两组的行数还要先对齐到两组最大值向上取 8 的倍数。其余几处也会跟着变：

- 融合的「矩阵乘 + Reduce-Scatter」算子只给非 MoE 模型用，GLM 会先做完矩阵乘、再单独 Reduce-Scatter。
- 共享专家从 TP8 的切片变成每卡一整份权重，只算本卡的 token 行（见上一节）；[TP 页的显存账](tensor-parallel.md#稠密-mlp-与共享专家每卡各留一段通道)里共享专家那一项要重算。
- 词嵌入入口的归约在 v0.23、v0.26 上会改走补齐加 Reduce-Scatter（见[词嵌入](embedding.md)）。
- MoE 入口：R1 这样的小批走 MC2（GLM 每卡 288 ÷ 16 = 18 个专家、EP16，见 [EP 页](expert-parallel.md#mc2-还是-allgather)），入口不做 EP 收集，本卡的 token 行直接派发；大批改走 AllGather 时，才在 EP 组里收集 INT8 激活和尺度。

各页已经算好的通信账都要按新路径重算。

**GLM 的四路残差。** GLM 的残差不是一条而是 4 条并行的流（mHC，见[层与 hidden](layers-and-hidden.md#一层接过什么交出什么glm-为什么在层间传四条)），每个 token 的残差是 4 × H 个数。打开 FlashComm1 时，attention 输出只留本卡的 token 行，mHC 的四路残差，以及每个 token 在子层入口算出的写回权重（post）和流间混合矩阵（comb），也按同样的 token 行切分。SP 改变的只是 token 这一维归谁，4 条流这一维仍然完整。前面 [T, H] 的算例描述的是子层的输入输出；数残差缓冲时要乘 4，不能按单路算。GLM 的 hidden 宽度正好是 4096（见 [GLM-5.3-Flash](glm-5-3-flash.md)），所以[代价一节](#省下了什么又要付出什么)按 BF16 算的「一行 8 KiB」，就是 GLM 单路 [T, H] 的一行；四路残差缓冲每个 token 是它的 4 倍。

## 常见误解

- **「SP 多了一次通信，所以更慢。」** 通信的数据量没有变：Reduce-Scatter 和 All-Gather 正好是原来那次 All-Reduce 的两半，[上面的例子](#省下了什么又要付出什么)两边都是每卡 8 个数。真正的差别在调用次数、补齐行和小批时的固定开销。
- **「SP 把 attention 也按 token 切开了。」** 没有。attention 要读其他位置，进 q、k、v 投影之前已经 All-Gather 拼回全部行。SP 只管局部的逐 token 激活；把 attention 本身和历史状态按序列分到几张卡上，是[上下文并行](context-parallel.md)的事，两者切分的目的和通信都不同，不能混用。
- **「SP 要另外一组卡。」** 不要。SP 用的就是 TP 那组卡和那个通信组，只是改变了行切之后那一段数据归谁。
- **「既然逐 token 独立，那也能按 H 维切。」** 不能。RMSNorm 要用一个 token 的全部 H 个数求均方根，SP 只切行、不切列。
- **「开了 SP，每张卡的显存就除以 N。」** 只有逐 token 那一段的激活变成 1/N，KV cache、attention 和 MLP 内部的中间结果都不变；权重大多不变，MoE 模型的共享专家反而从 1/N 的切片变成每卡一整份。
- **「W8A8 下 SP 的通信量减半。」** 只有 MoE 走 AllGather 时，入口那次收集的激活载荷从 BF16 变成 INT8（走 MC2 时入口根本不做这次收集）；路由分数和逐 token 尺度照样要传，行投影出口的 Reduce-Scatter 输出仍是 BF16。
- **「凡是叫 sequence parallelism 的都是这一页讲的东西。」** 不是。这个名字在别的工作里（比如 DeepSpeed-Ulysses）指连 attention 一起按序列切到几张卡上，更接近本站的[上下文并行](context-parallel.md)；本页的 SP 是 Megatron-LM 那种、配合 TP 只切逐 token 区段的做法。读文档和论文时先看它切的是哪一段。
- **「GLM 双机开了 FlashComm1。」** 没有，三条路都关着，见[上一节](#放到-glm-双机这套部署开了-sp-吗)。

## 对照源码

### 怎么开

- **FlashComm1**：`--additional-config '{"enable_flashcomm1": true}'`，或环境变量 `VLLM_ASCEND_ENABLE_FLASHCOMM1=1`。`enable_sp()` 先看 `additional_config` 里有没有这个键，没有再读 `ascend_config.enable_flashcomm1`，后者默认取环境变量；结果缓存在模块变量里，`additional_config` 带 `refresh` 时才重算。[C9]
- **被动打开**：固定版本和 v0.23 上，`enable_shared_expert_dp=True` 且开了 EP、TP > 1 时，配置阶段会强制 `enable_sp()` 为真；[C11] v0.26 起不再强制。[C18]
- **上游 `use_sequence_parallel_moe`**：不是开关，而是 vLLM 根据配置算出的属性，要求 all2all 后端在指定名单里、开了 EP、TP > 1、DP > 1；上游用它决定 MoE 层是否按序列并行处理，比如共享专家是否跳过 TP 切分。[C15] main 上 `enable_sp()` 直接等于它（见版本差异）。
- **图编译改写**：它把「All-Reduce → 残差相加 + RMSNorm」整段换成「Reduce-Scatter → 残差相加 + RMSNorm → All-Gather」，只在不强制 eager（逐算子直接执行）的图模式下生效。`--compilation-config '{"pass_config": {"enable_sp": true}}'`，并且模型不能 `enforce_eager`，这时 `enable_sp_by_pass` 为真。[C14] Ascend 把 `sp_min_token_num` 的默认值设成 MoE 模型 1、稠密模型 1000，编译范围的起点低于它时不改写。[C13]
- **和 PCP 一起开**：prefill 上下文并行（PCP）大于 1 且 SP 打开时，`max_num_batched_tokens` 会被上调到 TP × PCP 的倍数。

### 会报什么错

固定版本里 FlashComm1 没有专门的 `raise`；能看到的是下面这些日志：

| 情况 | 日志 | 版本 |
|---|---|---|
| `enable_shared_expert_dp` 把 SP 强制打开 | info：`shared_expert_dp requires enable_sp=True. enable_sp has been set to True.` | 固定版本、v0.23 |
| PCP > 1 且 `max_num_batched_tokens` 不是 TP × PCP 的倍数 | warning：`When using FLASHCOMM1, the max_num_batched_tokens should be divisible by tp_size * pcp_size ...`，随后自动上调 | 固定版本 |
| 配置里仍写了 `enable_flashcomm1` 或环境变量 | warning：`FlashComm is deprecated; remove enable_flashcomm1 ...` | main |
| 打开了 FlashComm1，但配置不满足上游 sequence-parallel MoE | warning：`FlashComm1 is enabled, but the current config does not support sp MoE. Disabling` | main |

### 开销和什么时候别开

- **小批**：稠密模型的 1000 token 门槛是经验值，低于它时两次调用和切换通信方式的开销可能超过收益；MoE 模型没有这道门槛，T 比 TP 小时大半是补齐行（见 GLM 一节的推算）。
- **融合算子的条件**：矩阵乘和 Reduce-Scatter 的融合只在 TP ≤ 8 时可用（源码注释：底层融合算子还不支持 TP ≥ 16），MoE 模型一律不用融合。
- **多个 DP 组**：各组要补到同一行数，组间 token 数差得越多，补的空行越多。
- 判断收益时按[代价一节](#省下了什么又要付出什么)的四样分别量。

### 版本差异

| 项 | v0.23 | v0.26 | main |
|---|---|---|---|
| 开关 | `enable_flashcomm1` / 环境变量，默认关 | 同 v0.23 | 标为 deprecated，提示改用上游配置[C19] |
| `enable_shared_expert_dp` 强制打开 SP | 会 | 不再强制 | 只看上游属性 |
| `enable_sp()` 的含义 | FlashComm1 是否打开 | 同 v0.23 | 等于上游 `use_sequence_parallel_moe`[C20] |
| 稠密模型 1000 token 门槛 | 有 | 有 | 前向上下文里已没有这项判断 |
| 打开后的行切投影出口 | `SequenceRowParallelOp`：补齐后 Reduce-Scatter 或融合算子 | 同 v0.23 | 该类已移除；`maybe_pad_and_reduce` 只剩 EP 通信一种用途[C21] |
| 打开后的词嵌入入口 | 补齐后 Reduce-Scatter | 同 v0.23 | 始终 All-Reduce，见[词嵌入](embedding.md) |
| 打开后的稠密 MLP | 升维入口 All-Gather、降维出口 Reduce-Scatter | 同 v0.23 | 不按 TP 切、不做末尾 All-Reduce，见[残差、MLP 与归一化](mlp-residual-norm.md) |

### 源码位置

- **开关与判定**：`vllm_ascend/utils.py` 的 `enable_sp()`；`ascend_config.py` 里 `enable_flashcomm1`、`enable_shared_expert_dp`、PCP 调整；`envs.py` 的默认值（`VLLM_ASCEND_ENABLE_FLASHCOMM1` 默认 `"0"`）；[C12] 上游 `vllm/config/parallel.py` 的 `use_sequence_parallel_moe`。
- **每一步走不走、补几行**：`ascend_forward_context.py` 的 `flash_comm_v1_enabled`（MoE 无门槛、稠密要超过 1000、稠密草稿不走）、`mmrs_fusion`（TP ≤ 8 且非 MoE）、`pad_size`；[C5] 多个 DP 组时的 `padded_length`（取各组最大 token 数，向上补到 TP 的倍数）。[C6]
- **行切出口与列切入口**：`ops/linear_op.py` 的 `SequenceRowParallelOp.matmul_and_reduce`（开关关时 All-Reduce；打开时补齐后 Reduce-Scatter 或融合算子，W8A8 融合路径 `output_dtype = bfloat16`）、[C3] `SequenceColumnParallelOp.apply_impl`（先 All-Gather 再去补齐），[C2] 以及按层名前缀选择它们的 `_get_column_parallel_op` / `_get_row_parallel_op`。
- **共享专家不切**：`get_parallel_op` 在层名含 shared_expert 且 `shared_expert_dp_enabled()` 为真时返回 tp_size = 1；[C22] `fused_moe.py` 这时也不对共享专家输出做 TP All-Reduce。
- **补齐、Reduce-Scatter、All-Gather、残差切分**：`ops/register_custom_ops.py` 的 `maybe_pad_and_reduce`、`maybe_all_gather_and_maybe_unpad`、`maybe_chunk_residual`。[C4]
- **MoE 入口**：A2 上 `_select_a2_moe_comm_method` 决定走 MC2 还是 AllGather；只有 `PrepareAndFinalizeWithAllGather.prepare` 在 SP 下走 `_prepare_with_ep_group`，W8A8 时先 `npu_dynamic_quant` 再连同逐 token 尺度一起 All-Gather。[C8]
- **GLM 的 mHC 分片**：`models/glm5_next.py` 的 `_make_attention_output` 与 decoder 层 `forward`，残差、post、comb 都经 `maybe_chunk_residual`。[C7]
- **GLM 双机为什么三条路都关**：启动命令没有 `--additional-config`、环境变量取默认（见 02 底稿）；上游 `IS_DENSE = False` 使编译配置的 `enable_sp` 默认关；[C17] Ascend 在它为假时把 all2all 后端设成 `flashinfer_all2allv`，让 `use_sequence_parallel_moe` 为假。[C16] 三条合起来得出「本部署没开」。[D]
- **图编译改写**：`compilation/passes/sequence_parallelism.py` 的 `MiddleAllReduceRMSNormPattern` 等。

正文里几条不是直接读源码得到的结论，出处如下：

- SP 与 TP 搭配、按序列维切开以减少训练激活显存，出自 Korthikanti et al. 2022。[S1]
- 「先归约并分片 → 逐行计算 → 收集」与只用 TP 的结果逐数相同，由 RMSNorm 逐行独立推得；[D] 通信量不变，由 All-Reduce = Reduce-Scatter + All-Gather 与 ring 通信量公式推得。[D]
- 推理只做前向、激活不必留到反向传播，所以论文的训练显存收益在推理里要打折扣，是推断，没有在本系统上测过。[I]
- GLM 双机打开 SP 的变体（R1 一步 T = 4 补到 8 行、每卡 1 行，MoE 入口小批走 MC2），按上面的源码规则推算，未实测。[D]
