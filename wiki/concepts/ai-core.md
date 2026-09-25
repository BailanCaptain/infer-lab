---
id: ai-core
title: "AI Core、Cube 与 Vector：设备里面谁在算"
type: concept
summary: AI Core 不是 NPU 的别名。矩阵、向量和标量计算有不同单元，Cube 与 Vector 可能耦合在一起，也可能分成独立的核心。
aliases: [AI Core, AICore, Cube, Vector, Scalar, AIC, AIV, AI Cube, AI Vector]
chapters: ["07"]
order: 120
sources:
  - https://www.hiascend.com/doc_center/source/zh/canncommercial/80RC2/developmentguide/opdevg/Ascendcopdevg/atlas_ascendc_10_0008.html
  - https://www.hiascend.com/developer/techArticles/20240914-1
verified: []
evidence: "S"
relations:
  - to: matmul-and-weights
    kind: builds-on
    note: 模型的大量矩阵乘需要硬件执行；本页把执行单元与整个设备分开
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一个 NPU 能算矩阵乘，是里面每个部件都在做同一件事吗

不是。**NPU 是整个计算设备的叫法，AI Core 是其中承担计算的一类核心**。往核心里再看，矩阵、向量与标量计算有不同的执行单元，旁边还有存储、数据搬运和控制部件。

可以先记住分工：**Cube** 处理矩阵运算；**Vector** 处理向量运算，例如一批数的逐项计算；**Scalar** 处理标量运算与控制。它们配合完成工作，所以不能把 Cube、Vector、AI Core 当成三个完全相同的名字。

```wiki-diagram
file: ai-core
```

## Cube 和 Vector 是邻居，还是各有一间房，要看架构

官方开发指南区分两种组织形式。**耦合模式**把 Cube 与 Vector 放在同一个 AI Core 内；**分离模式**中，矩阵计算一侧称 AIC（AI Cube），向量计算一侧称 AIV（AI Vector），两侧各有自己的 Scalar 部件，独立执行并由系统调度。

这张图只画层级关系，不表达某款设备有几个核心，也不表达 AIC 与 AIV 的数量比例。看到「A2」也不能直接选右图：所引指南将 Atlas A2 训练产品与 Atlas 800I A2 推理产品列为分离模式，而 Atlas 200I/500 A2 推理产品列为耦合模式。

## 看懂这层分工，才能读懂算子优化

一个模型算子可能包含矩阵计算，也包含激活、归一化或搬运。优化时要看每段实际落在哪类单元，以及它们怎样交接数据；不能只用「矩阵乘快」判断整段一定快。更具体的算子路径见 [算子与执行实现](ops-and-kernels.md)。

## 对照源码

### 版本差异

本页依据 CANN 商用版 8.0.RC2 的 AI Core 架构指南，核读于 2026-09-25。型号归类严格限于该文档列出的产品；不据此推断 A3 或后续芯片的核数、比例、缓存容量。

### 源码位置

- AI Core 的计算、存储、搬运和控制组成，以及耦合/分离模式、AIC/AIV 的定义和上述产品归类，均见官方架构指南 [S1]。
- CANN 官方概述进一步说明异构单元与软件调度的分工 [S2]。本页为文档证据 S，没有做硬件性能测量。
