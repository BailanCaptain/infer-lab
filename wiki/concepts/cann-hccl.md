---
id: cann-hccl
title: "CANN 与 HCCL：计算和通信由谁接到硬件"
type: concept
summary: CANN 把上层计算框架接到昇腾设备；HCCL 是其中负责多设备通信的组件。软件库与物理链路是不同层次。
aliases: [CANN, 昇腾软件栈, HCCL, 集合通信库, Huawei Collective Communication Library]
chapters: ["07", "09"]
order: 130
sources:
  - https://www.hiascend.com/developer/techArticles/20240914-1
  - https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/others/acldevg/aclcppdevg_000537.html
verified: []
evidence: "S"
relations:
  - to: hardware-devices
    kind: builds-on
    note: 先数清参与计算的设备，再讨论谁负责设备之间的数据交换
  - to: tensor-parallel
    kind: builds-on
    note: 张量并行把一层分给多个设备，需要通信库协作合并结果
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 模型已经写成程序了，为什么还需要 CANN

因为上层写的是计算任务，硬件需要具体的执行安排。**CANN** 是昇腾的异构计算软件体系：对接上层框架，并提供运行时、算子、图优化和通信等能力，使计算能落到昇腾设备上。

```wiki-diagram
file: cann-hccl
```

这里说的是软件职责，不是某个版本必须安装的完整包清单。排查环境时，要记录框架、适配层、CANN、驱动与固件各自的版本，不能用一个「昇腾版本」代替所有组件。

## HCCL 是软件库，不是网线

模型拆到两个设备上以后，一边的结果可能要交给另一边，或者两边要一起合并结果。**HCCL（昇腾集合通信库）**负责这些通信操作；它是 CANN 的组件，既支持同一机器内的通信，也支持多机器间的通信。

物理链路负责连通，通信库负责组织数据怎样经过链路。官方文档列出的链路包括 HCCS、RoCE、PCIe、Unified Bus；这是一组支持路径，不表示任意产品、任意两台机器都同时具备它们。

## 多设备合并结果，还要约定怎么合

以求和为例：每个参与者提供自己的一份数字，合并后各自拿到总和。这类操作叫 all-reduce；它也可以使用最大值等其他归约规则，不等于永远做加法。这里知道它是通信库提供的操作就够了，具体数据流放在[张量并行](tensor-parallel.md)里读。

## 对照源码

### 版本差异

本页核读于 2026-09-25。CANN 总体职责引用 2024-09-14 官方介绍，通信能力引用 CANN 9.1.0 文档；不据此保证旧版 CANN 或本库各 vLLM-Ascend 分支支持全部新接口与链路。

### 源码位置

- CANN 作为上层框架与处理器之间的软件体系，提供运行时、算子、图与通信接口 [S1]。
- HCCL 属于 CANN，提供单机/多机的集合通信与点对点通信；all-reduce 可选 sum、prod、max、min 等归约 [S2]。本页只解释角色，不提供未经核验的安装组合。
