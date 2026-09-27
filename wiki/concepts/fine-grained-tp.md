---
id: fine-grained-tp
title: 细粒度 TP：为特定模块选择分片组
type: feature
summary: 从 DP 中重复保存的非专家权重出发，解释沿 DP 维度组成模块通信组，以及 embedding、词表输出和注意力输出各自不同的数据交换。
aliases:
  [
    Fine-Grained Tensor Parallelism,
    Fine-grained TP,
    细粒度 TP,
    细粒度张量并行,
    模块级张量并行,
    FinegrainedTPConfig,
    finegrained_tp_config,
    oproj_tensor_parallel_size,
    lmhead_tensor_parallel_size,
    embedding_tensor_parallel_size,
    mlp_tensor_parallel_size,
    olora_tensor_parallel_size,
    OProjRowParallelOp,
    get_otp_group,
    lmheadtp,
  ]
chapters: ["13"]
order: 20
sources:
  - vllm-ascend@db701c1f:vllm_ascend/distributed/parallel_state.py#L117-L149
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L505-L577
  - vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L164-L227
  - vllm-ascend@db701c1f:vllm_ascend/ops/vocab_parallel_embedding.py#L302-L321
  - vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L183-L222
  - vllm-ascend@db701c1f:vllm_ascend/ops/linear_op.py#L258-L299
  - vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L143-L161
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L680-L700
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L877-L894
verified: []
evidence: "C"
relations:
  - {to: tensor-parallel, kind: builds-on, note: 理解矩阵分片与输出拼接或求和}
  - {to: data-parallel, kind: builds-on, note: 区分请求副本与并行通信组}
  - {to: expert-parallel, kind: builds-on, note: 理解 MoE 专家与非专家权重的不同布局}
  - {to: collective-communication, kind: builds-on, note: 理解收集与归约分片的输入输出}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 从全模型布局到模块布局

[DP](data-parallel.md)给不同请求安排不同执行副本；与 [EP](expert-parallel.md)组合后，路由专家可以跨副本分配，非专家部分仍可能保留重复权重。普通 [TP](tensor-parallel.md)在模型各层采用一套张量切分规模；**细粒度 TP**允许某些模块另用一个通信组，在这些模块中减少重复存储。

固定 Ascend 实现沿 DP 维度建立模块组，并固定其他 PP、TP 坐标。[C1] 这会让不同请求副本在该模块上协作：各 rank 的输入需要按模块要求交换，输出再回到原来的请求归属。它不是把多个请求合成同一条序列，也不改变专家路由函数。

以 DP=4、普通 TP=1、某模块分片组大小为 2 的教学布局为例，DP rank 0/1 组成一组，2/3 组成另一组。每组共同保存一份完整模块权重，每个 rank 保存其中一半。[A] 其他模块继续使用自己的布局。

## 一个完整的数据例子：分片词表查找

词表按编号分片时，某个 rank 接到的 token ID 可能属于另一个 rank 保存的词表范围。因此只做本地查找还不够。

```wiki-diagram
file: fine-grained-tp
```

图将词表缩为 8 行：rank 0 保存编号 0–3，rank 1 保存 4–7；两边各处理一个请求，输入编号分别是 1 和 6。[A]

1. **All-Gather token IDs**：两边都得到 `[1,6]`，并保留它们原本属于哪个 rank。
2. **本地查表**：rank 0 得到 `[e₁,0]`，rank 1 得到 `[0,e₆]`。不属于本地词表的行贡献零。
3. **Reduce-Scatter**：对应位置相加后按请求归属分发，rank 0 得到 e₁，rank 1 得到 e₆。

这里收集的是整数 token IDs，归约的是隐藏向量；两次通信的形状和数据类型不同。固定 embedding 实现包含输入收集、本地掩码与结果归约分片。[C3] 若输入长度不同，实际实现还需协调尺寸；示例的一行输入只是便于手算。

## 不同模块需要不同通信

同样是权重分片，输出的含义不同，交换方式也不同：

| 模块 | 固定实现中的主要数据流 | 为什么需要这样交换 |
|---|---|---|
| Embedding | 收集 token IDs → 本地词表查找 → Reduce-Scatter hidden | 各词表片段对同一 token 贡献互斥，求和恢复完整向量 [C3] |
| LM Head | 收集 hidden → 词表分片投影 → 通常 All-to-All logits | 不同 rank 得到不同词表区间的分数，需要回到请求所属 rank；另有 reduce-sample 分支 [C4] |
| Dense MLP | 列投影前收集输入，行投影后归约分片 | 分别对应中间维度分片与输出部分和 [C5] |
| 注意力输出投影 | 布局重排 → All-to-All → 本地矩阵乘 → Reduce-Scatter | 输入特征需先交换到持有对应权重的位置，再合并输出 [C6] |

这张表描述引用路径，不表示所有模型都构造这些类。尤其注意力输出投影与模型内部的低秩结构、prefix 和张量布局有关，需要检查实际模型接入。

## 容量收益与通信成本

[GLM 固定配置](glm-5-3-flash.md)的词表大小为 154880、隐藏维度为 4096。若只估算一张 BF16 词表矩阵，其逻辑容量为：

`154880 × 4096 × 2 = 1,268,776,960 B ≈ 1.182 GiB`

理想地均分为两片，每片约 0.591 GiB；这是单矩阵、不计补齐、量化元数据及运行缓冲的容量推导。[D] 本页用主模型尺寸说明数量级，没有由此证明 GLM 的细粒度 TP 部署组合可用。

权重容量下降的同时，激活、编号或 logits 需要额外重排与通信。词表模块通常每次前向使用一次，层内模块可能重复使用很多次，但实际收益仍取决于批量、链路、精度、计算效率和重叠机会。容量节省不能直接换算成吞吐提升或固定延迟损失。

## 配置约束来自多处协作

`db701c1f` 的配置包含 embedding、lmhead、oproj、mlp、olora 五类分片字段。启用项要求 MoE，并须能整除 DP 规模；OProj、OLoRA 还有各自的图模式、D 节点等条件。[C2] 配置类能接受某个值，不代表模型一定进入对应执行路径。

Embedding 与 OProj 还要求重算调度器；平台又把该调度器限制在 PD 的 D 消费者侧，P 侧会告警关闭，普通混部模式会拒绝。[C7][C8] 因此只在普通 DP 启动命令里补一个开关，仍不能构成完整部署方案。

本固定源码按配置值判断细粒度模块是否启用，并在已有 TP 坐标上建立 DP 维度的组。[C1][C9] OProj 明确限制普通 TP>1；不能将这一限制扩写为“其他模块在 TP>1 时一律无效”，也不能反向声称剩余组合已验证。[C2]

本页聚焦权重、输入和输出的归属。具体模块是否适用于 GLM 专用模型类，需要沿[源码阅读路线](reading-vllm-ascend.md)继续核对；官方双机主线没有被替换为这里的教学布局。
