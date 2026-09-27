---
id: kv-cache-memory-profiling
title: 显存容量：从运行开销算出缓存预算
type: concept
summary: 区分权重、激活、运行时与持久缓存，解释启动 profiling 如何估计缓存预算，以及预算为什么不能直接换成固定并发数。
aliases: [KV Cache Memory Profiling, 显存探测, 显存预算, gpu_memory_utilization, kv_cache_memory_bytes, profile_run]
chapters: ["11"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L469-L480
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L527-L597
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L717-L751
verified: []
evidence: "C"
relations:
  - {to: device-memory, kind: builds-on, note: 区分设备内存中的权重和运行状态}
  - {to: kv-cache-spec, kind: builds-on, note: 缓存预算需按缓存规格换算成可分配页}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 模型能装入显存，还不等于可以服务请求

模型权重加载完成后，推理仍需要空间保存中间激活、算子工作区和请求的历史状态。[设备内存](device-memory.md)介绍了这些对象的用途；本页讨论启动时如何为它们分配容量。

权重通常在服务期间保持驻留。激活和工作区随批次的 token 数、算子实现及执行模式变化。注意力缓存或 KDA 状态则跨越多次前向执行，保留到请求结束或被回收。它们的生命周期不同，不能把“空闲显存”全部分给缓存。

vllm-ascend 的固定实现先加载权重，再运行一次 profiling 工作负载，估计非缓存部分的用量，最后给缓存管理器一个字节预算。[C2] 这是当前配置下的测量；后续执行是否超出它，还取决于真实批次、图捕获以及其他进程的内存变化。

## 自动预算怎样计算

记设备总内存为 M，配置比例为 u。启动时请求的内存份额是 M×u，分母是设备总内存；同时检查当时空闲内存是否足够提供这份容量。[C1]

固定实现的自动路径使用：

`缓存预算 = M×u − 权重内存 − 激活峰值增量 − 非 PyTorch 内存增量`

权重容量由加载阶段记录；激活峰值和非 PyTorch 增量来自 profiling 前后的统计。通信库等运行时分配可能落入后一个类别，不能只用张量元素数替代这项测量。[C2]

```wiki-diagram
file: kv-cache-memory-profiling
```

图中取一颗 **64 GiB** 设备，u=0.9，并假设权重30 GiB、激活峰值增量4 GiB、其他增量2 GiB。这组数用于演算，不是 GLM 的实测结果。[A]

| 容量项 | 计算 | 结果 |
|---|---|---:|
| 请求使用的份额 | 64×0.9 | 57.6 GiB |
| 非缓存用量 | 30+4+2 | 36 GiB |
| 自动缓存预算 | 57.6−36 | 21.6 GiB |
| 请求份额之外的空间 | 64−57.6 | 6.4 GiB |

最后一项不是“随时可用的额外缓存”。其他进程可能占用它，后续图执行也可能产生尚未计入的分配。

## 字节预算怎样变成缓存页

[缓存规格](kv-cache-spec.md)决定每组的一页包含什么数据、占多少字节、代表多少位置。假设全部缓存只有一种页，每页2 MiB，21.6 GiB预算最多容纳 `floor(21.6×1024/2)=11059` 页。[A][D] 实际分配还要满足实现的布局和对齐约束。

并发数需要再按请求的驻留状态计算。对普通按位置增长的 KV，若每页容纳16个位置，一个已有100个位置的请求至少需要7页；共享前缀、滑窗回收或其他状态形式会改变这笔账。这种算例解释页分配的取整，不能作为整个 GLM 的请求容量估计。

GLM-5.3-Flash 的[缓存](kv-cache.md)同时包括 KDA 递归状态和稀疏注意力历史。计算本地容量时，应列出各缓存组的实际规格、dtype、并行归属和分配页数，再汇总字节。请求长度、当前批次的计算量与活跃请求数分别影响不同项。

## 图捕获和显式预算的影响

这份固定源码在自动预算计算之后调用 `capture_model()`。图内存没有作为初始公式中的独立扣减项；图捕获完成后，日志给出的预算建议会把图内存加进开销，并额外扣除150 MiB余量。[C3] 因此 profiling 成功不能单独保证图捕获和之后的运行一定有足够空间。

如果设置 `kv_cache_memory_bytes`，Worker 仍执行 `profile_run()`以准备运行，但直接使用指定缓存字节数，跳过上述自动预算计算。[C2] 这只改变预算取得方式，启动空闲检查、实际设备容量和运行峰值仍然存在。

## 在固定基线上阅读配置

本页依据[GLM 来源基线](../sources/glm-5-3-flash-baseline.md)中的 Ascend Worker 实现。`gpu_memory_utilization` 控制自动路径请求的份额；`kv_cache_memory_bytes` 控制显式缓存预算。这里未给出 GLM 的推荐值，也未运行设备测量。

更换量化方案、并行布局、批次上限或图模式后，权重和运行开销都可能变化，需要重新评估。其他快照中的层复用、稀疏卸载等预算修正属于对应实现；本页的公式应与实际采用的 Worker 返回路径一起阅读。
