---
id: sequence-parallel
title: 序列并行（SP）：让局部激活按 token 分片
type: feature
summary: 从 TP 归约后的重复激活出发，解释 Reduce-Scatter、逐 token 计算与 All-Gather，区分容量收益、补齐开销和量化通信条件。
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
verified: []
evidence: "C"
relations:
  - {to: tensor-parallel, kind: builds-on, note: 先理解完整归约结果与部分和}
  - {to: collective-communication, kind: builds-on, note: 掌握 Reduce-Scatter 和 All-Gather}
  - {to: mlp-residual-norm, kind: builds-on, note: 理解逐 token 的归一化和残差}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## TP 之后仍可能重复保存激活

在普通 TP 行并行出口，各 rank 的部分和经过 All-Reduce 后，每个 rank 都持有相同的 `[T,H]` 结果。紧接着的 RMSNorm 等运算独立处理每个 token 行，不需要其他 token 的输入；这段激活和计算可以沿 token 轴分配。

**序列并行（Sequence Parallelism，SP）**在这些局部区域保留 token 分片，进入需要完整行集合的 TP 投影前再收集。相关研究将 SP 与 TP 结合以减少训练激活存储；[S1] 本页讨论推理的前向布局，不将论文训练收益外推为本系统推理结果。

```wiki-diagram
file: sequence-parallel
```

## 将结果留在需要它的 rank

沿[并发页](concurrent-requests.md)的 A/C 四行输入，记位置为 `A.y₁、C.p₀、C.p₁、C.p₂`。假设 TP=2：

1. 行并行矩阵乘后，两边各持有四行的部分和。
2. Reduce-Scatter 对应求和，再把前两行给 rank 0、后两行给 rank 1；两边各得到 `[2,H]`。
3. 各 rank 对自己的两行做 RMSNorm 或其他满足逐行独立条件的运算。
4. 下一阶段需要四行时，用 All-Gather 按顺序恢复 `[4,H]`。

RMSNorm 归一化的是每一行的隐藏维度 H，保留完整 H 后才能本地计算。不能把“逐 token 独立”推广到需要跨位置依赖的注意力过程；残差、位置与其他关联张量也必须采用一致的 token 切分。

数学上，先归约分片、执行逐行函数、再收集，可以得到与对完整归约结果逐行计算一致的结果。通信演示中的 Reduce-Scatter/All-Gather 展示了两个基本动作；图中保留所有时刻的行归属，便于同时比较。

## 激活容量与补齐

如果 H=4096 且激活为 BF16，完整四行需要 32 KiB；在上述局部区域，每个 rank 只持有两行，即 16 KiB。节省的是这一区域的逻辑激活与重复逐行计算，不是整个模型的所有运行内存。

实际 token 数不一定能整除 TP。有的路径先补齐，再通信，在适当边界去除填充行；Ascend 的自定义操作明确处理 Reduce-Scatter 前补齐和 All-Gather 后去补齐。[C4] 跨 DP 时还可能按协调后的数量对齐。[C5][C6] 补齐、临时缓冲和图执行档位都会影响实际收益。

## 在 Ascend 和 GLM 中怎样接入

固定 Linear 路径在需要时于列投影前收集输入，行投影后选择 All-Reduce、Reduce-Scatter 或融合实现。[C2][C3] FlashComm1 的启用判定与 `use_sequence_parallel_moe` 不是同一个开关，触发条件需要分别核对。[C5][C9]

GLM 的 FlashComm 注意力输出使用本地 token 分片，mHC 的残差、post、comb 也随对应行切分。[C7] SP 改变 token 轴的归属，四路残差这一额外维度仍然存在。上述 `[T,H]` 教学算例描述子层输入输出，不把四路 mHC 缓冲误算成单路。

## 量化只改变特定传输的数据表示

固定 MoE 的一条 W8A8 路径在 All-Gather 前动态量化激活；它还会通信路由分数和逐 token 尺度。[C8] 对相同元素数，INT8 激活载荷是 BF16 的一半，但不能推出整个 MoE、整层或网络总传输减半。行投影的量化融合 Reduce-Scatter 路径还显式输出 BF16。[C3]

因此比较 SP 时，应分别报告局部激活占用、通信输入的精度/形状、线上流量和端到端耗时。语义上的 All-Reduce 可由 Reduce-Scatter 加 All-Gather 实现，不保证任意后端的两种调用具有完全相同的线上字节与执行成本。

SP 聚焦某些局部激活区域；下一页的[上下文并行](context-parallel.md)处理跨位置注意力计算和历史状态分区，二者的切分目的与通信不能混用。
