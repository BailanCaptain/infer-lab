---
id: cpu-binding
title: CPU 绑核：线程亲和性与 NUMA 局部性
type: feature
summary: 模型在 NPU 执行，Host 仍负责调度和下发；本页解释怎样限制 Worker 的 CPU 运行范围，以及内存迁移、拓扑和 cpuset 的条件。
aliases:
- CPU 绑核
- CPU Binding
- cpu_binding
- enable_cpu_binding
- bind_cpus
- CpuAlloc
- global_slice
- topo_affinity
- 核绑定
- NPU 亲和性绑核
chapters:
- '16'
order: 120
sources:
- vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L760-L773
- vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L15-L44
- vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L183-L204
- vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L249-L258
- vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L444-L517
- vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L538-L577
- vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L595-L623
- vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L643-L708
- vllm-ascend@db701c1f:vllm_ascend/cpu_binding.py#L792-L806
- vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/cpu_binding.md#L3-L26
- vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/cpu_binding.md#L66-L95
verified: []
evidence: C
relations:
- to: engine-processes
  kind: builds-on
  note: 理解 Host 上的 Worker 与设备执行职责
- to: hardware-devices
  kind: builds-on
  note: 区分 CPU、NPU 和服务器
- to: device-memory
  kind: builds-on
  note: 区分主机内存和设备内存
contradicts: []
updated: '2026-09-26'
origin: seed
---

## NPU 计算仍需要 Host 配合

[Worker](engine-processes.md)在主机 CPU 上运行，准备张量与执行元数据，并调用运行时向 NPU 提交任务。操作系统可以让线程在允许的 CPU 上迁移；多个进程还会竞争 CPU 时间。设备计算较短或主机负载较高时，线程调度与下发间隔可能影响延迟。

**CPU affinity（CPU 亲和性）**规定一个线程允许在哪些逻辑 CPU 上运行。绑核是在这一基础上，为 Worker 及指定运行时线程选择较稳定的 CPU 集合。它没有改变模型计算，也没有替进程取得这些 CPU 的系统级独占权。

多插槽服务器通常还有 **NUMA（非一致内存访问）**结构：CPU 访问本地内存与其他 NUMA 节点的内存，路径和成本可能不同。线程留在某个节点，却不断访问远端页，仍会产生跨节点数据移动。因此 CPU 范围与内存位置需要一起观察。

```wiki-diagram
file: cpu-binding
```

图只表示主机的两个 NUMA 域与一个 NPU 执行端，不对应某款服务器的真实核数或链路规格。[A]

## 分配范围取决于进程实际可见的资源

固定实现读取 `/proc/self/status` 的 `Cpus_allowed_list`，获得进程允许使用的逻辑 CPU；还可查询 NPU 拓扑亲和信息。[C3] 容器或作业的 cpuset 可能只是整台机器的一部分，所以按主机总核数推导每个 Worker 的份额并不可靠。

A3 的 `global_slice` 策略按全局逻辑 NPU 编号切分允许的 CPU 集合，避免不同可见设备子集各自从同一段 CPU 开始分配。[C5] 假设允许 CPU 共 40 个、全局有 4 个逻辑 NPU，每个分到 10 个；普通角色分配中可以保留 2 个给中断、6 个给主线程及普通线程、另各 1 个给 ACL 和 release 线程。[A][D]

这份算式说明分配算法，不是 GLM 双机服务器的实际绑核结果。若 CPU 集合、全局 NPU 数量或产品策略改变，结果也会改变。

## 亲和性与内存迁移是两个动作

代码用 `taskset` 设置 Worker 及线程的允许运行范围，再将识别出的 ACL、release 线程调整到其指定集合。[C4][C8] 这两类角色不代表进程总共只有两条后台线程。

随后 `migratepages` 尝试把进程已经分配的页迁到选择的 NUMA 节点。这个动作发生在 warmup 之后；工具不存在时只跳过迁移，CPU 亲和性仍可保留。[C1][C8] 它是对已有页的一次迁移尝试，不是规定所有后续分配都落在该节点的持久内存策略。

`global_slice` 本身不根据 NPU 拓扑选择最近内存，它的局部性还依赖 CPU 编号与 NUMA 布局。[C5] 因而“CPU 范围互不重叠”与“访问都在本地”是不同性质。

## 产品条件与运行成本

固定源码按产品选择不同策略：A2、A3、310P 和 A5 的分配并非完全相同，A5 还有独立的 CPU cluster 路径；缺少拓扑信息时，部分路径回退到 global slicing。[C2][C6][C7] 不应把普通角色分配表套到所有产品。

本页所用固定文档说明 ARM Ascend 服务器默认启用该功能；入口在非 ARM 上跳过。Worker 捕获绑核异常后记录警告并继续运行，因此服务启动成功不证明绑核已经按预期生效。[S10][C9][C1]

绑核可能减少线程迁移和 CPU 争用，也可能因可用范围过小限制并发。内存迁移依赖工具、权限及实际页状态；IRQ 处理还有独立条件。[C8][S11] 检查结果应结合允许 CPU、线程亲和性、NUMA 页分布和负载，而不以开关值推断性能提升。

这属于主机执行组织，与[图回放](acl-graph.md)减少任务下发开销可以协作。两者都不提供对所有部署的固定加速比例。
