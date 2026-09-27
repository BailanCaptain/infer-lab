---
id: data-parallel
title: 数据并行（DP）：请求分配与副本协作
type: feature
summary: 先理解请求分给多个执行副本，再区分普通副本、跨副本专家并行与元数据协调；不把 DP 规模等同于固定性能收益。
aliases: [Data Parallel, 数据并行, DP, DP rank, data_parallel_size, dp_size, DPEngineCoreProc, DPCoordinator, DPLBAsyncMPClient, data-parallel-size, 前端负载均衡]
chapters: ["13"]
order: 30
sources:
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L1398-L1426
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1890-L1904
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L1833-L1875
  - vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1155-L1168
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L692-L740
  - vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1453-L1508
verified: []
evidence: "C"
relations:
  - {to: concurrent-requests, kind: builds-on, note: 先理解一个执行副本如何处理并发}
  - {to: collective-communication, kind: builds-on, note: 理解通信组和求和归约}
  - {to: tensor-parallel, kind: builds-on, note: 理解一个执行副本内部也可使用多设备}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 从一个队列扩展到多个执行副本

一个引擎可以用连续批处理同时服务多个请求。若单个执行副本的容量或吞吐不能满足负载，可以建立多个副本，把不同请求分配过去。**数据并行（Data Parallelism，DP）首先划分的是请求数据**；同一个请求的模型前向并没有因此被拆成 DP 份。

```wiki-diagram
file: data-parallel
```

图示请求 A、B 分给副本 0，C、D 分给副本 1。每个副本管理自己的等待队列、运行批次与请求状态；副本内部仍可用 TP 分布到多个设备。选择副本改变排队位置，不能等同于单次前向必然加速。

## 请求怎样选择副本

固定上游的内部负载均衡路径读取各引擎 waiting/running 计数，以 `waiting×4 + running` 选择较低负载，并记录请求归属。[C1] 例如两个副本的计数为 `(2,1)` 与 `(0,3)`，分数分别为 9 与 3，该策略会选第二个。

这是特定实现的决策依据，计数快照也可能滞后。已有请求不会因为下一次分数变化就自动迁移；状态迁移需要额外机制。外部路由、指定 DP rank 或其他部署模式还可以决定入口选择，不能把一个打分公式当作 DP 的定义。

## 普通副本与 MoE 的跨副本协作

普通模型副本可以分别完成各自的前向。在 **MoE + EP** 组合下，注意力侧仍按 DP 请求批次执行，专家却可以分布在更大的设备组中，因此来自不同 DP 副本的 token 可能共同进入专家通信。[C3][C4]

```wiki-diagram
file: dp-ep-groups
```

图以 DP=2、TP=2、EP 开启的四设备教学网格说明逻辑分组：横向每两个 rank 是一个 TP 组；纵向相同 TP 位置组成 DP 组；专家通信可以覆盖四个 rank。它不是官方双机规模，也不意味着四个设备各存一份完整模型。

GLM 专用 MoE 类读取 EP rank/size，并依据物理专家数计算本地范围。[C6] 专家权重如何分配属于 [EP](expert-parallel.md)；请求归属和注意力状态仍需按 DP/TP 组合分别追踪。仅设置 DP 不能推出专家已经按 EP 分片。

## 为什么还会同步各副本的批次信息

参与同一组通信的 rank 必须按兼容的次序执行。固定 Ascend Runner 有一条 DP 元数据同步路径，用来获得各副本的 token 数及图执行模式。[C5] 以两个副本分别有 3 与 1 个 token 为例，只看数量行：

| 阶段 | DP rank 0（副本 0） | DP rank 1（副本 1） |
|---|---|---|
| 本地填入各自槽位 | `[3,0]` | `[0,1]` |
| All-Reduce(SUM) 后 | `[3,1]` | `[3,1]` |
| 各自本地取最大值 | `3` | `3` |

表中的 DP rank 是副本编号，与图中的全局设备 rank 分开计数。这里通过 SUM 收集稀疏填写的槽位，然后本地取 max；并非直接调用 MAX 归约。真实张量还有一行模式信息。是否将各副本补到同一数量，取决于 `allow_dp_padding`、draft 等条件；某些路径还会跳过该归约。[C5]

上游协调执行中也有本地无工作而其他参与者仍在执行时的 dummy batch 分支。[C2] 这用于维持所需通信进度，不能概括为“所有 DP 副本每步都固定执行一个假 token”。补齐行或空批执行也不表示产生了额外用户请求。

## 与 TP、PP 的组合和取舍

| 策略 | 首先分配什么 | 主要代价或限制 |
|---|---|---|
| TP | 层内矩阵与计算 | 合并或重排中间张量 |
| PP | 模型层与阶段 | 阶段交接、依赖和气泡 |
| DP | 请求批次 | 副本资源、负载不均；组合模式中的协调 |

增加 DP 常用于提高服务容量，但实际吞吐受输入输出长度、并发、批次效率和共享通信影响，不保证按副本数线性增长。排队时间可能缩短，竞争和同步也可能改变延迟。对于混合注意力与 MoE，应分别计算注意力权重、专家权重、请求状态和运行缓冲，而不是把“每卡显存”统一乘除一个 DP 数。

GLM 官方双机主线的 TP=8、DP=2 及其实际设备映射另见[固定来源](../sources/glm-5-3-flash-baseline.md)；本页的四设备图是缩小后的逻辑示意。
