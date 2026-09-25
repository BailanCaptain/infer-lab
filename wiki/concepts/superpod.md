---
id: superpod
title: "超节点：连接成整体，数据仍有位置"
type: concept
summary: 超节点将多个计算设备通过高速互联组织成协作系统。内存池化还需要软件支持，统一访问不等于所有数据都变成本地显存。
aliases: [超节点, SuperPoD, Atlas 900 A3 SuperPoD, 内存池化, MemFabric, MemCache]
chapters: ["08"]
order: 140
sources:
  - https://www.hiascend.com/developer/techArticles/20251203-5
  - https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/others/acldevg/aclcppdevg_000537.html
verified: []
evidence: "S"
relations:
  - to: device-memory
    kind: builds-on
    note: 理解主机内存与显存的位置后，才能分清跨机池化改变了什么
  - to: cann-hccl
    kind: builds-on
    note: 互联提供通路，通信与内存软件负责让计算实际用到它
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 很多机器连在一起，就会自动变成一颗巨大的 NPU 吗

不会。**超节点**把多个计算设备通过高速互联组织成协作整体，但各设备和存储资源仍然有自己的位置。本页用官方的 Atlas 900 A3 SuperPoD 内存池化实践说明这件事，不把它的能力外推成所有集群的标准配置。

```wiki-diagram
file: superpod
```

图中两台机器仅作示意，不代表该产品的实际规模。连接以后仍要安排模型怎样拆分、计算由谁做、数据从哪里访问。设备数、布线、带宽和软件支持应按具体产品与部署版本核对。

## 统一访问是一层软件能力，不是把内存焊成一块

官方案例中，互联先提供 CPU、NPU 之间的物理通路；**MemFabric** 再把分散的主机内存与显存组织成统一编址、可跨机访问的资源。更上层的 **MemCache** 提供按对象存取的接口，可以服务于 KV Cache 缓存池。

这三个层次要分开：有高速连接，不表示某个普通程序已自动获得一个巨大内存池；有内存池，也不表示读取远端数据与读取本地显存具有相同代价。程序要使用相应接口和部署能力。

## 「零拷贝」也不是「没有数据移动」

有些资料用「零拷贝」描述省去中转副本的传输路径。数据仍需从来源位置到达使用位置。读到这个词，应该继续问清省掉的是哪次中转，不能据此把通信时间记成零。

## 对照源码

### 版本差异

本页依据 2025-12-03 的 Atlas A3 超节点官方软件实践，核读于 2026-09-25。没有在超节点上部署或测量，不给出未逐项核验的芯片数量、带宽或普遍可用的池容量。

### 源码位置

- 官方文章区分互联基础、MemFabric 内存语义与 MemCache 对象语义，并说明特定 A3 超节点路径中「零拷贝」指无中转的数据操作 [S1]。
- HCCL 的多机通信接口说明另一类组织设备协作的方法；它与内存池接口不能直接互换 [S2]。本页不是三版本的软件兼容性承诺。
