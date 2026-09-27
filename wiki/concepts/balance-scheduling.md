---
id: balance-scheduling
title: 均衡调度：DP 执行组的统一准入条件
type: feature
summary: 用各rank的运行请求数决定是否继续接纳等待请求，解释统一准入与请求迁移、实际计算负载之间的区别。
aliases: ["Balance Scheduling","均衡调度","BalanceScheduler","enable_balance_scheduling","balance_gather"]
chapters: ["12"]
order: 60
sources:
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L65-L88
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L289-L305
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L616-L658
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L34-L49
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L668-L675
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L685-L698
verified: []
evidence: "C"
relations:
  - {to: data-parallel, kind: builds-on, note: 理解多个执行组的请求归属与协作}
  - {to: vllm-scheduler, kind: builds-on, note: 理解运行集合和等待准入}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 请求数不均与执行组之间的等待

[数据并行](data-parallel.md)把不同请求交给不同执行组。对于共同参与专家通信的 MoE 执行组，各组的工作量差异可能转化为同步等待。新请求持续进入某些组，也可能使这种差异延续。

**Balance Scheduling**使用一个粗粒度信号：各 DP rank 当前正在运行多少个请求。它基于这个信号统一限制等待请求的准入，已经运行的请求仍按本地调度规则前进。请求保持原来的 rank 归属，缓存也留在原处。

## 一次统计如何影响下一次准入

固定 Ascend 实现将本地 `len(running)` 放进 CPU 整数张量，通过 all-gather 收集到 `balance_queue`。[C1] 统计发生在引擎步之后，并接在全组是否还有工作的同步判断之后；无本地可执行工作的组仍需要参与相应协调。[C3]

进入下一次等待队列处理时，调度器检查收集到的最大运行请求数是否等于 `max_num_running_reqs`。若相等，就退出等待准入循环。[C2] 这份统计有时序边界，表示上次交换时的状态，而不是随请求到达瞬时更新的全局队列。

```wiki-diagram
file: balance-scheduling
```

设两个 rank 的运行上限都是 4，交换到的计数为 [4,2]。[A] 两边本次都暂停从等待队列接纳新请求；DP1 的两个空位不会因此接收 DP0 的请求。之后计数变为 [3,2]，全局条件解除，两边仍要各自检查本地 token 预算、并发上限与缓存是否足够。[D]

这解释了策略的取舍：暂时放弃轻载组的一些准入机会，让已有请求继续推进。它没有将运行请求平均分配，也不保证下一轮请求数立即相等。

## 计数信号能说明什么

两个 rank 都运行两项请求，计算负载仍可能明显不同。输入长度、已经积累的注意力历史、MTP 接受情况、专家路由及缓存命中都会改变本步工作量。该策略只比较数量，不读取这些请求的完整成本。

因此应分别观察准入等待、各 rank 的运行数、每步耗时与全组吞吐。若瓶颈来自一项极长历史的请求，单纯关闭新请求准入不一定能改善已有批次的同步等待。按历史块数估计的 [DynTra](dyntra-lb.md)是另一份扩展实现，其版本和适用条件独立核对。

## 固定源码的接入边界

本页引用 GLM 专用源码快照中的 Balance 路径，配置读取 `enable_balance_scheduling`，并保留环境变量回退入口。[C4] 平台只允许混部形态：没有 KV-transfer 配置，或角色为 `kv_both`；独立 P producer、D consumer 会被拒绝。[C5]

其启动补丁在 DP 条件下选择专用引擎循环。[C6] 同时，固定 `BalanceScheduler` 直接继承同步基础调度器，不能由“异步开关为真”就推断它自动具备[异步占位协议](async-scheduling.md)。自定义调度器与执行队列的组合须独立核对。[C4]

[GLM 官方双机](../sources/glm-5-3-flash-baseline.md)提供 DP/TP/EP 拓扑，但没有在命令中启用此策略。本页的 [4,2] 是教学计数，不是那套部署的观测数据或性能结论。

