---
id: pipeline-parallel
title: 流水线并行（PP）：层分段、状态交接与气泡
type: feature
summary: 将连续模型层分到多个阶段，说明阶段之间的张量与通信、单请求生成依赖，以及多个批次怎样提高流水线利用率。
aliases: [Pipeline Parallel, 流水线并行, 管线并行, PP, pipeline_parallel_size, PPMissingLayer, IntermediateTensors, get_pp_indices, make_layers, VLLM_PP_LAYER_PARTITION, PP stage, 流水线气泡]
chapters: ["13"]
order: 20
sources:
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2263-L2319
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2241
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2132-L2169
  - vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L607-L650
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L912-L949
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L987-L1013
  - vllm@0fc695fc:vllm/v1/engine/core.py#L484-L499
  - vllm@0fc695fc:vllm/config/model.py#L1188-L1207
verified: []
evidence: "C"
relations:
  - {to: layers-and-hidden, kind: builds-on, note: 先理解层间表示与 GLM 的四路连接}
  - {to: collective-communication, kind: builds-on, note: 理解点对点收发与组内收集}
  - {to: vllm-engine-core, kind: builds-on, note: 理解引擎批队列与结果更新}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 按连续层分配执行阶段

张量并行切开层内矩阵；**流水线并行（Pipeline Parallelism，PP）将连续模型层分成阶段**。前一阶段计算后，将下一阶段需要的中间表示交过去。阶段内部还可以使用 TP。

```wiki-diagram
file: pipeline-parallel
```

图以 GLM 的 45 层示意分为 `[0,23)` 与 `[23,45)`，即 0–22 层和 23–44 层。它解释分段机制，并非已验证的 GLM 双机 PP 部署；官方主线使用 TP/DP。

固定 GLM 模型代码按阶段创建本地层：首阶段创建嵌入，末阶段创建最终归一化，非本阶段位置使用占位。[C1] 各阶段权重与状态由所承担的层决定。23 层和 22 层不意味着负载接近，因为层类型、专家负载及首尾计算不同。

## 阶段边界传递什么

阶段边界传递下一阶段所需的中间数据，通常不是整份权重或所有历史缓存。GLM 的普通 mHC 层输出保留四路表示，最后一层才汇合；这条路径的 `residual` 返回 None。[C2][C3] 因而 `IntermediateTensors` 中出现 hidden/residual 两个键，不能据此推断一定传两份等大的张量。[C1]

只作容量推导：若边界持有 T 行、每行四路、每路 H=4096 的 BF16 表示，且未做 token 分片，则逻辑激活大小为：

`T × 4 × 4096 × 2 字节 = T × 32 KiB`

T=1 为 32 KiB，T=4 为 128 KiB。这一设定需同时满足表示、精度和布局条件；实际边界还受序列并行与实现影响，不能作为实测链路流量。

每个阶段维护其本地层所需的历史状态。GLM 两类注意力与专家层并不均匀地消耗同一种资源，因此不能仅用总层数除以 PP 数估计每阶段全部内存。

## 一次逻辑交接包含哪些通信

Ascend Worker 对非首阶段接收中间张量，对非末阶段发送 Runner 返回的中间结果，并在所需边界等待异步工作完成。[C4] 这提供重叠机会，但不会取消后一阶段对输入的依赖。

上游的张量字典传输包含元数据，以及对各个张量的收发；某些条件下还把张量切片发往下一阶段，再在接收侧通过 TP 组 All-Gather 还原。[C5][C6] 因此图上的一条交接箭头表示逻辑数据依赖，不代表一次物理发送、一个网络包或固定字节数。

## 单请求为何留出空闲时段

对一个未使用投机候选的自回归请求，下一轮输入依赖本轮采样结果。阶段 0 先计算，阶段 1 才能处理同一轮；阶段 1 完成输出后，新 token 才能进入下一轮的阶段 0。两阶段交替等待产生流水线气泡。

```wiki-diagram
file: pipeline-parallel-bubble
```

图上半将一个请求的相邻生成轮次画在同一时间轴；下半让两个独立批次交错，阶段 1 处理 A 时，阶段 0 可以处理 B。示意假定阶段等时，忽略传输和采样耗时；真实部署还会受负载不均、批次形状和同步影响，不能保证从第二个时间格开始一直满载。

vLLM 的批队列执行允许多批工作处于执行与等待状态，支撑这类重叠。[C7] 具体的拆批与重叠方式还受调度和高级 PP 实现影响，不能一概声称 PP 不会拆分输入。

## 何时考虑 PP

PP 可以分散各阶段的权重与状态，跨阶段交接通常比逐层多次通信更集中；单请求的层间计算仍有依赖，并可能增加传输与等待。是否优于其他并行组合，需要结合设备容量、网络、阶段负载和并发测量。

启用还要求模型具有相应的阶段支持，上游配置对此进行检查。[C8] 本页确认了固定 GLM 源码中的分段接口，尚未验证其完整 PP 部署组合；详细启动案例仍以已经核读的[官方双机来源](../sources/glm-5-3-flash-baseline.md)为主。
