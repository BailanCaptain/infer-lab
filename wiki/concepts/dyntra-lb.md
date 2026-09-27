---
id: dyntra-lb
title: DynTra：按历史块数调整 D 端执行集合
type: feature
summary: 用块数而非请求数估计DP执行负载，说明本地暂停与准入计划、阈值和启发式代价，并保留开发快照的部署限制。
aliases: ["DyntraLB","DynTra","dyntra_lb_config","动态负载均衡","lb_pause_request"]
chapters: ["12"]
order: 70
sources:
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L41-L52
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L123-L138
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L175-L238
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L240-L322
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L454-L499
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L238-L292
  - vllm-ascend@baa023ad:vllm_ascend/core/dyntra_lb_scheduler.py#L364-L395
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L984-L1012
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1362-L1398
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_dyntra_lb_core.py#L378-L443
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_engine_core.py#L32-L42
  - vllm@568afb3a:vllm/config/parallel.py#L682-L697
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1152-L1160
verified: []
evidence: "C"
relations:
  - {to: balance-scheduling, kind: builds-on, note: 比较请求数信号与块数代理}
  - {to: pd-disaggregation, kind: builds-on, note: 理解D端请求和外部状态接收}
  - {to: data-parallel, kind: builds-on, note: 理解执行组之间的同步与各自请求归属}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 相同请求数，历史读取成本可能不同

在共同参与 MoE 通信的 DP 执行组中，一个组处理很长的历史，另一个组处理短历史，即使两边运行请求数相同，每步耗时也可能不同。[均衡调度](balance-scheduling.md)的请求数信号无法表达这种差异。

**DynTra**用请求的历史块数估计注意力负载，再调整各 rank 本地参与下一步的请求集合：暂停部分运行请求，接纳部分候选请求。请求不迁移到其他 rank，已保存的缓存也不会因为负载均衡暂停而释放。

本页只解释 main 开发快照 `baa023ad`。GLM 专用基线没有该实现；以下块数是教学输入，不是将另一模型的 block size 或部署参数套到 GLM。

## 块数是成本代理，不是显存测量

对请求 r，该实现计算：

`bᵣ = ceil(已有 token 数 / cache_config.block_size)`。[C1]

每个 rank 的代理负载是当前参与请求的块数之和。它没有逐组计算真实物理字节，也没有把 KDA 递推状态、量化布局、专家路由或不同算子的代价分别建模。块数多通常意味着较长的历史，但其与耗时的关系依赖模型和执行路径。

失衡指标也有两种解释：阈值不小于 1 时使用 `最大负载 − 平均负载`，单位为块；阈值小于 1 时使用 `(最大 − 平均) / 最大`。[C2]

## 一次本地替换怎样改变负载

假设两个 rank 各最多运行四项请求，策略已激活，阈值为 5 块。DP0 运行块数 [128,1,1,1]；DP1 运行 [1,1,1,1]，且已准备好的候选中有一个 64 块请求。[A]

```wiki-diagram
file: dyntra-lb
```

初始负载为 [131,4]，平均 67.5，最大值比平均多 63.5。规划器尝试在轻载 rank 本地将一个 1 块请求替换为 64 块候选，负载变为 [131,67]，失衡降至 32。[C3][C4][D]

这一步没有把 DP0 的长请求移给 DP1。被暂停的 1 块请求也仍在 DP1，后续继续执行。规划结果可以减少失衡而没有达到阈值；可选请求和启发式目标限制了进一步调整。

当本地替换无改善时，实现还评估暂停重载 rank 的请求。其代理吞吐为 `运行请求总数 / (20000 + 19.2 × 最大块数)`。[C3] 在上述替换后，当前值约为 8/22515.2；暂停 128 块请求后为 7/21286.4，反而更低，所以这一候选不会被采用。[D] 两个系数属于这份实现的启发式，不是 GLM 的实测延迟模型。

## 计划在下一步执行，暂停保留状态

各 rank 交换运行请求与可接纳候选的块数、运行集合分界以及新长请求标志。计划保存要退出和进入的块数，在本地匹配请求身份；相同块数请求之间的具体选择还受本地顺序影响。[C5][C6]

计划在当前引擎步结束后产生，由后续一步消费。候选准备会先处理阻塞状态与 KV 预取，未就绪的请求不会成为可接纳候选。[C5][C6]

负载均衡暂停把请求标为 PREEMPTED 并放回等待队列，但不释放其缓存；真正的资源抢占走另一条路径。[C7] 因而暂停可以改变本轮工作量，却不会自动缓解缓存占用。日志中的状态名称需要结合触发路径解释。

## 激活窗口与部署限制

该快照默认关闭；配置放在 `scheduler_config.dyntra_lb_config`。启用后的默认模式为 dynamic，从指定步数开始，并以新长请求触发激活；一段时间没有新的长请求后关闭。默认 start_step=250、长请求阈值为 700 块、持续窗口为 256 步。[C9][C10]

阈值按实际 block size 解释。例如假设 B=128，严格大于 700 块才触发，就要求至少 701 块；700×128 只表示阈值边界的 token 量，不能直接说“达到该长度便触发”。[A][D] GLM 的状态布局和有效块大小需要独立求证。

启动检查要求 PD 分离的 D consumer、DP>1，并拒绝 balance scheduling 或 profiling chunk 同开。代码还检查 `nnodes_within_dp=1`：[C8] 它限制的是单个 DP 执行组内部跨越的节点数；普通上游参考定义区分了 DP 组分布与组内节点数，因此不能简化成“所有 DP rank 必须在同一台主机”。[C12] 该开发快照实际配套上游仍需核对。

进场补丁替换 MoE 协调所用的 DP 引擎类；普通上游参考的 dense DP 使用独立引擎路径，不能只凭配置校验通过就认定均衡逻辑会运行。[C11][C13] 固定平台注释列出的验证模型也不包含 GLM。[C8]

块数汇总、候选预取、规划及暂停等待都带来成本。使用时需要验证代理负载与真实耗时是否相关，以及长请求尾延迟是否恶化；本站没有此扩展在 GLM 上的设备实测结论。

