---
id: attention-backend-family
title: 注意力后端：模型机制、状态布局与设备实现的连接
type: concept
summary: 模型层定义注意力机制，后端实现把该机制与缓存布局、批次元数据和设备算子连接起来。以 GLM 的稀疏 MLA 和 KDA 两条路径说明为什么不能只用一个通用后端名称代表整个模型。
aliases: [attention backend, 注意力后端, AttentionBackend, metadata builder, IndexerKPoolMLA, Kimi KDA,
  FlashAttention, Flash Attention 3, FA3, AscendFAImpl, flash_attn_npu_v3, flash_attn_npu,
  flash_attn_with_kvcache, _validate_fa3_backend, 训推一致, 训练推理一致, enable_training_consistency]
chapters: ["09", "16"]
order: 50
sources:
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2018-L2049
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2072-L2105
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L763-L768
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L246-L300
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5041-L5063
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L390-L474
  - vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L980-L1061
  - https://arxiv.org/abs/2205.14135
  - https://arxiv.org/abs/2407.08608
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/flash_attention.md#L8-L43
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/flash_attention.md#L45-L73
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/flash_attention.md#L134-L156
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L805-L810
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L834-L858
  - vllm-ascend@db701c1f:vllm_ascend/attention/fa3_v1.py#L12-L60
  - vllm-ascend@db701c1f:vllm_ascend/attention/fa3_v1.py#L62-L97
  - vllm-ascend@db701c1f:vllm_ascend/attention/fa3_v1.py#L99-L145
verified: []
evidence: "C"
relations:
  - {to: attention-qkv, kind: builds-on, note: 后端要实现已经定义的注意力计算和因果约束}
  - {to: mla, kind: builds-on, note: 理解压缩历史、索引和尾状态，才能解释对应后端输入}
  - {to: linear-attention, kind: builds-on, note: KDA 的递推与卷积状态需要不同于位置 K/V 页的访问方式}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 从数学机制到可执行接口

[密集注意力](attention-qkv.md)描述评分、归一化与 V 汇合；[稀疏注意力](sparse-attention.md)进一步限定访问位置；[KDA](linear-attention.md)使用递推状态更新。设备实现必须保留相应的计算语义、因果关系和请求隔离，同时利用目标硬件上的算子。

后端因此不只是一个速度选项。它还规定所需元数据、状态布局以及执行路径。模型层决定使用什么机制，Runner 提供本轮请求与位置的信息，后端及算子将两者连接起来。

```wiki-diagram
file: attention-backend-choice
```

## 同一模型可以连接不同后端

固定 GLM 实现按层类型构造 KDA 或 MLA 子层。[C2] 稀疏 MLA 分支使用带 Indexer/KPool 的专用注意力对象，并传入投影、归一化、索引器及 top-k 索引缓冲等模块。[C1] 它不能仅用“普通注意力后端”四个字概括。

KDA 分支在模型层中使用 KimiGatedDeltaNetAttention；专用快照中，替换为 Ascend Kimi KDA 实现的注册带有上游版本 `v0.23.0` 条件。[C3] 因而这里的源码路径说明有明确注册前提，不能无条件推广到其他上游版本。

## 稀疏 MLA 路径使用位置索引

MLA 的压缩历史仍按位置保存。索引过程为当前查询形成候选位置，主注意力根据索引访问所选历史并完成信息汇合。固定参考路径接收已有候选索引，检查因果范围与位置有效性，再读取潜向量并完成主注意力评分、softmax 和汇合。[C7]

后端因此需要的不只是 Q/K/V 张量，还包括缓存布局、请求边界、有效长度和位置索引。GLM 的主历史、池化索引与尾状态分别承担不同职责，具体见 [MLA](mla.md)与[缓存规格](kv-cache-spec.md)。

## KDA 路径使用递推和卷积状态

Ascend Kimi KDA 先产生独立 Q/K/V 投影、写入系数及门控量，再调用 KDA 运算并完成输出归一化与投影。[C4] 历史信息通过递推矩阵状态和卷积状态延续，不采用“每层都追加相同 K/V 行”的统一布局。

不同输入形态仍会影响设备执行。固定实现分别处理相应状态和 Prefill 计算，并明确拒绝 `PCP>1` 的路径。[C6] 因而框架存在某个上下文并行模块，不足以证明当前完整 GLM 混合模型支持该组合。

## Runner 怎样为后端组织数据

Runner 遍历缓存组内的层，调用层的后端查询方法，以后端完整类名和该层缓存规格组织注意力组。[C5] 这种分组使兼容的层共享元数据构建方式，而不同机制仍保留各自的状态需求。

| 输入信息 | 后端需要据此确定什么 |
|---|---|
| 查询边界、有效 token 数 | 哪些行属于同一个请求，哪些是有效输入 |
| 已计算长度与当前位置 | 可访问的因果历史和本轮更新位置 |
| 块表或状态索引 | 从哪读取、向哪写入状态 |
| 层与缓存规格 | 元数据格式、张量形状与访问方式 |
| 并行与执行模式 | 本地分片、通信及相应支持条件 |

表格说明接口职责，不意味着所有后端使用同名字段或完全相同的布局。

## 更换后端需要验证的兼容关系

一个候选后端至少要正确实现该层机制、状态布局、dtype、head 形状和并行约束。满足某一种模型或设备的条件，不自动等于 GLM 全层可用。性能比较也必须在语义与功能一致的前提下进行。

阅读实现时，先从具体模型层找到实际构造的对象，再查注册替换、后端元数据构建和最终算子调用。[A] 这比只根据平台上的一个通用选择函数推断整个模型更可靠。完整安装组合未核实的部分继续保留在[来源基线](../sources/glm-5-3-flash-baseline.md)。

## FlashAttention 与昇腾 FA3 后端（原 flash-attention-3 页）

以下事实由原 `flash-attention-3` 页并入，2026-09-27 只作搬运，未重写文风。

FlashAttention 把 Q、K、V 分块装入更靠近计算单元的存储，在处理不同 K/V 块时维护每行的归一化统计量和输出累积值；它改变执行顺序和数据存放方式，避免把完整注意力矩阵反复写回设备内存。“精确注意力”指没有采用稀疏或低秩近似，有限精度下仍可能有舍入差异。[S8] FlashAttention-3 原论文研究的是 NVIDIA Hopper 上的异步执行和低精度计算组织，不能直接当作昇腾 NPU 的执行说明。[S9]

固定版本 `db701c1f` 的 FA3 适配层调用外部包提供的注意力算子，文档强调它在训练、推理使用一致实现方面的用途。[S10] 适配层接收 query、分页 K/V、有效历史长度、query 的累计长度与页表，调用外部算子后返回注意力输出。[C16] 它声明的缓存形状是 `[2, num_blocks, block_size, num_kv_heads, head_size]`，最前一维区分 K 和 V，声明支持的 kernel block size 为 128。[C15] 这是该后端的布局约束，不能推导出全库通用的缓存页大小。

混合批经过适配层时，实现按元数据切分 query 和序列信息，分别调用外部算子，再按原来的两段顺序拼接输出：普通 decode 传入 `causal=False`（合法历史范围已由长度与缓存布局界定），prefill 传入 `causal=True`。[C17]

条件与边界：固定版本只在显式选择 `FLASH_ATTN` 且启用批不变路径时才尝试 FA3，未启用批不变时退回默认后端选择流程；MLA/SFA 组合被明确拒绝，外部模块及必要接口也必须存在。[C13][C14] 后端初始化还明确拒绝 sliding window，以及非 eager 条件下的 `FULL_DECODE_ONLY`。[C15] 固定文档把该功能列为 A2/A3 上的 beta，图模式建议使用 PIECEWISE。[S11][S12][S10] 因此这条路径是密集 MHA/GQA 实现的扩展阅读，GLM 主线的稀疏 MLA 不能直接切换过来。
