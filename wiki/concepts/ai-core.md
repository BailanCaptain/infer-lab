---
id: ai-core
title: AI Core：计算单元与数据搬运
type: concept
summary: 从矩阵乘和逐项运算认识 Cube、Vector、Scalar，沿设备内存到片上缓冲区的数据路径理解计算与访存的配合。
aliases: [AI Core, AICore, Cube, Vector, Scalar, AIC, AIV, AI Cube, AI Vector]
chapters: ["07"]
order: 120
sources:
  - https://www.hiascend.com/doc_center/source/zh/canncommercial/80RC2/developmentguide/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html
  - vllm-ascend@db701c1f:csrc/moe/add_rms_norm_bias/op_kernel/add_rms_norm_bias.h#L96-L155
verified: []
evidence: "C"
relations:
  - {to: hardware-devices, kind: builds-on, note: 先区分设备与设备内部的核心}
  - {to: device-memory, kind: builds-on, note: 理解设备内存与数据访问}
  - {to: matmul-and-weights, kind: builds-on, note: 认识矩阵计算需要的输入与权重}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 从一个矩阵乘进入设备内部

[矩阵乘](matmul-and-weights.md)把输入 X 与权重 W 相乘得到 Y。执行时既要计算乘加，也要把 X、W 搬到计算单元能够使用的位置，再保存结果。**AI Core 是 NPU 内承担计算的一类核心**；整个 NPU 还包含其他资源。

Cube 承担矩阵计算，Vector 承担向量计算，Scalar 处理标量与控制；MTE 等搬运部件连接存储与计算单元。[S1] 矩阵乘后的激活或归一化涉及另一组运算，因此一个模型子层可能经过不同单元。

```wiki-diagram
file: ai-core
```

## 数据必须先到达计算单元

图按官方分离架构画两条典型路径，省略部分控制与搬运细节。[S1]

| 路径 | 输入在哪里准备 | 计算与结果 |
|---|---|---|
| 向量路径 | 全局内存 GM → 片上 Unified Buffer（UB） | Vector 使用缓冲数据，结果再写回 GM |
| 矩阵路径 | GM → L1 → L0A/L0B | Cube 计算，结果经 L0C、Fixpipe 写回 GM 或 L1 |

这里的 GM 表示设备侧全局内存空间；片上缓冲容量有限，较大的张量通常分块处理。[算子到 AI Core](op-to-ai-core.md)中的融合归一化 kernel 就有 CopyIn、Compute、CopyOut 三段。[C2] 它们解释了为什么只计算 FLOPs 不足以预测耗时：等待输入和保存结果也会占用执行时间。

一个简化教学块含 4 个 FP32 数，装入需要 16 字节，输出同样大小又有 16 字节写回。这是逻辑数据量；真实访问还取决于复用、对齐和实现，不能直接换算成一次硬件测量。

## 核心组织与产品条件

耦合架构在同一核心内组织 Cube 和 Vector；分离架构由 AIC、AIV 分别承担矩阵和向量计算，各有标量控制，跨两侧的数据交接需要相应存储与同步。[S1] 图中的一对 AIC/AIV 不代表实际数量比例。

本页依据 CANN 8.0.RC2 架构指南解释组织方式，不推断 A3 或后续产品的核数、面积、缓冲容量。这里 **UB 是 Unified Buffer**；[CANN 与 HCCL](cann-hccl.md)里 AI QoS 一节的 UB 指 Unified Bus，二者属于不同层次。
