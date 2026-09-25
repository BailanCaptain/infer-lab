---
id: device-memory
title: "主机内存与显存：数据现在放在哪"
type: concept
summary: CPU 一侧的主机内存和 NPU 一侧的设备内存要分别计算。模型能放进主机，不代表设备有足够空间直接执行。
aliases: [显存, 设备内存, HBM, 主机内存, host memory, CPU 内存, Host]
chapters: ["07", "09"]
order: 110
sources:
  - https://www.hiascend.com/document/detail/zh/CANNCommunityEdition/900beta1/API/appdevgapi/aclcppdevg_03_0107.html
  - https://www.hiascend.com/document/detail/en/CANNCommunityEdition/910/API/runtimeapi/aclcppdevg_03_1804.html
  - https://www.hiascend.com/developer/techArticles/20251203-5
verified: []
evidence: "S"
relations:
  - to: hardware-devices
    kind: builds-on
    note: 先明确设备边界，才能回答某段内存归哪个设备使用
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: 该页把设备容量进一步分成权重、运行开销与 KV Cache 预算
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 机器还有很多内存，为什么模型仍然报显存不够

因为「机器还剩多少」与「当前 NPU 还能分配多少」不是同一本账。**主机内存**位于 CPU 一侧；本库说的**显存**指 NPU 的设备内存。权重、KV Cache 和计算临时结果要按实际存放位置分别算。

```wiki-diagram
file: device-memory
```

把数据放在主机内存，可以减轻设备常驻数据的负担；但计算用到它时，还需要合适的数据访问或搬运路径。空间多出来，不意味着访问免费。KV 卸载的具体流程在 [CPU 卸载](kv-cache-cpu-offload.md)。

## HBM 是内存技术名字，显存是这里的用途叫法

HBM 常用于高带宽设备内存，但不能把「所有昇腾设备内存」都直接改叫 HBM。官方接口也考虑了不支持 HBM 的设备，查询时会转向 DDR。知道某台机器用了 HBM，还不能仅凭这个词推算容量和带宽。

读规格时要分清两件事：**容量**回答能放多少字节；**带宽**回答每秒能传多少字节。模型太大是容量问题；模型装得下却等待取数，可能是带宽或其他执行瓶颈，需要测量才能定位。

## 能访问，不等于已经复制到本地

某些产品和软件版本允许把主机内存注册成设备可访问的地址；超节点还可能通过软件把分散内存组织成池。这样的地址映射改变了访问方式，不应据此把所有字节计成当前 NPU 的本地显存。普通部署预算仍应明确「本地分配」「远端访问」和「搬运」各自发生在哪里。

## 对照源码

### 版本差异

核读日期为 2026-09-25。下面分别引用 CANN 9.0.0-beta.1、9.1.0 和特定 Atlas A3 超节点的软件实践；它们不是一套已经在本库三版本上实测的环境。

### 源码位置

- `aclrtGetMemInfo` 按所选设备返回可用内存，并明确不支持 HBM 时的 DDR 查询行为 [S1]。
- `aclrtHostRegister` 把主机内存注册并映射为设备可访问地址；支持型号、页对齐和系统限制以该接口文档为准，不能推广到所有硬件 [S2]。
- MemFabric 的跨机异构内存映射是另一个有前提的软件能力；内存池化不代表存储介质消失或传输耗时为零 [S3]。
