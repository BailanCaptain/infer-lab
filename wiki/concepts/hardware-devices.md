---
id: hardware-devices
title: "NPU、卡与机器：先把数量数对"
type: concept
summary: 一台机器、一块板卡和一个软件可见的 NPU 设备不是同一个计数单位。先确认设备边界，再决定模型分到哪里。
aliases: [NPU, 昇腾芯片, device, 卡, 单卡, 加速卡, 机器, 节点, 服务器, 单机, Atlas A2, Atlas A3]
chapters: ["07", "08"]
order: 100
sources:
  - https://www.hiascend.com/developer/techArticles/20240914-1
  - https://www.hiascend.com/doc_center/source/en/CANNCommunityEdition/910/others/acldevg/aclcppdevg_000537.html
  - https://www.hiascend.com/document/detail/zh/CANNCommunityEdition/900beta1/API/appdevgapi/aclcppdevg_03_0107.html
verified: []
evidence: "S"
relations:
  - to: one-request
    kind: builds-on
    note: 贯穿例子用两个 NPU 设备部署；本页解释为什么设备数不能直接用板卡数代替
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 说「用两张卡」，到底给了程序几个设备

[贯穿例子](one-request.md)把模型放在两个 NPU 设备上。这里首先要数清楚：是两台机器、两块板卡，还是程序可以分别选择的两个计算设备？这三个数字不能直接互换。

**机器**是物理服务器。**卡**说的是板级硬件。**NPU**原本指神经网络处理器，本库在描述 vLLM 部署时，用它指程序可见、可选择的昇腾计算设备。它不是机器里的一切，也不是设备内部某个 AI Core。

```wiki-diagram
file: hardware-devices
```

图只演示一台机器里有两个可见设备，不规定它们对应几块板卡或几个封装。启动并行服务前，先检查当前环境实际能用的设备数量；不能由「一张卡」推导一定只有一个设备。

## 产品系列名字不能代替完整规格

Atlas A2、Atlas A3 是产品系列称呼，不应把芯片型号、系列名和另一代产品名全塞进同义词表。同属带 A2 字样的产品，也不等于内部计算单元布局完全相同，具体例子见 [AI Core](ai-core.md)。

因此，描述环境时要分别记录完整产品型号、软件可见设备数和每个设备可用显存。部署里的「两个设备」描述软件边界；物理板卡与设备的映射应另查对应产品手册，本页不提供跨型号的固定换算。

## 对照源码

### 版本差异

这是一页硬件与运行时术语说明，证据为官方文档 S，不是三个 vLLM-Ascend 分支的设备实测。资料核读于 2026-09-25，未在真实昇腾服务器上枚举设备。

### 源码位置

- CANN 官方介绍把 NPU 作为异构计算中的处理器，区别于上层框架 [S1]。
- CANN 9.1.0 的集合通信示例先调用 `aclrtGetDeviceCount()` 查询可用设备，再为设备建立通信参与者；示例的数量不是产品统一规格 [S2]。
- CANN 9.0.0-beta.1 的 `aclrtGetMemInfo` 要求先选定 Device，说明内存查询有具体设备边界；返回总量不包含系统预留内存 [S3]。
