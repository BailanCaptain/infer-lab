---
id: large-scale-ep
title: 大规模 EP：请求路由、专家域与跨机通信
type: feature
summary: 从单个专家组扩展到多服务器，区分外部请求路由、组内专家通信和 P/D 状态传输，并解释服务端点与进程的区别。
aliases: [Large-Scale EP, 大规模专家并行, 大规模 EP, wide-EP, Distributed DP Server, 分布式 DP server, 外置 DP 负载均衡, external DP LB, data_parallel_external_lb, data-parallel-rank, large_scale_ep, VLLM_ASCEND_EXTERNAL_DP_LB_ENABLED, load_balance_proxy_server_example, external_online_dp]
chapters: ["14"]
order: 20
sources:
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L479-L489
  - vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L276-L287
  - vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L790-L806
  - vllm-ascend@db701c1f:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L898-L945
  - vllm@0fc695fc:vllm/config/parallel.py#L138-L144
  - vllm@0fc695fc:vllm/config/parallel.py#L514-L520
  - vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L71-L107
  - vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L240-L282
  - vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/large_scale_ep.md#L5-L6
verified: []
evidence: "C"
relations:
  - {to: expert-parallel, kind: builds-on, note: 理解专家放置和派发组合}
  - {to: data-parallel, kind: builds-on, note: 理解请求副本与 EP 组的关系}
  - {to: pd-disaggregation, kind: builds-on, note: 理解 P/D 之间的状态交接}
  - {to: engine-processes, kind: builds-on, note: 区分服务实例与其内部进程}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## EP 组扩大后，改变的是协作范围

[专家并行](expert-parallel.md)把路由专家分到多个 rank。一个 token 选择的专家可能在本机，也可能在另一台服务器；激活按目的专家派发，计算结果按 token 归属组合。组扩大后，每个 rank 可以保存更少的路由专家，同时更多计算依赖跨设备交换与同步。

“大规模 EP”描述这种规模与部署组织，没有一个能代替其余配置的通用开关。请求入口怎么分流、一个 DP 实例使用多少设备、EP 组跨哪些服务器、是否分离 P/D，仍是不同选择。EP 的成员范围也不等于集群内所有 NPU。

## 三类通信承担不同职责

```wiki-diagram
file: large-scale-ep
```

图用缩小的两组服务表示三类数据流：

- **请求与控制元数据**：路由组件接收请求、选择服务端点，并传递恢复执行所需的信息。
- **EP 组内通信**：当前 token 的激活与专家结果在本组成员间交换。P 组与 D 组各自形成专家协作域。
- **P→D 状态传输**：采用 [PD 分离](pd-disaggregation.md)时，把请求已有的历史状态交给 D 侧。它不是专家输出，也不经过 HTTP 代理逐元素中转。

只有明确数据对象和参与组，才能判断哪条链路承担什么工作。建立独立逻辑组不表示物理网络互不争用；模型激活、KV 与其他业务仍可能共享链路。

## 外部路由与 DP 实例

外置 DP 负载均衡把请求选择放在服务实例之外。上游配置用 `data_parallel_external_lb` 表示这一模式，本地客户端只连接本地引擎；启动逻辑也相应选择前端数量。[C5][C6][C7]

一个外部可路由端点不等于一个操作系统进程。实例内部仍包含前端、EngineCore、Worker 等职责和进程；TP>1 时一个 DP 实例还可使用多个 Worker。按 URL 或 DP rank 统计出的实例数不能直接当作进程总数。

固定仓库中的示例代理为每个后端维护估计负载。P 端评分为 `active_tokens + 0.3 × active_kv_cache`，D 端评分为 `active_tokens`。[C2] 这是这个示例的路由策略，既不是实时设备利用率，也不是所有外置负载均衡器的统一算法。

代理先提交 P 请求，取得返回的 KV 传输元数据，再选择 D 端点继续处理；P 请求中设置了相应的 remote-decode 参数与输出限制。[C3][C4] 传输元数据告诉执行组件到哪里恢复状态，数据搬运由连接器和传输引擎完成。

## 官方大规模拓扑与 GLM 主线分开阅读

固定文档提供的 DeepSeek-R1 示例是特定规模的扩展参考：P 每台使用 DP2×TP8，D 侧使用 DP64×TP1；推荐表记录了这些配置。[S1] 该例的四台 P 服务器各自形成 EP16 组，四台 D 服务器共同形成 EP64 组。[S9] 它们并不是一个统一的 EP128 组。

按四台 P 各 2 个端点、D 全局 64 个端点计算，一共有 `4×2+64=72` 个外部可路由 DP 实例。[D] 这个数没有包含每个实例内部的多个进程。

这个官方扩展例用于解释大规模组织方式，不替换本站 GLM 主线。GLM 的两台服务器、TP8/DP2、量化权重与 MTP 条件统一见[模型与双机来源基线](../sources/glm-5-3-flash-baseline.md)。不能把其他模型的专家数量、容量或最佳参数直接代入 GLM。

## 更大的组不自动意味着更高吞吐

扩展 EP 可以降低每设备路由专家权重，但路由不均衡、消息数量、临时缓冲、链路争用和同步会影响执行。每个 token 的 top-k 产生若干逻辑专家关联，不对应固定数量的物理消息或 API 调用。

Ascend 根据设备代际、EP 规模、每设备专家数、token 数和配置选择 MoE 通信路径。A2 与 A3 的分支条件不同。[C8] MC2 采用设备支持的通信与计算协作方式；不能用“A2 的 EP≥16 条件”定义所有硬件的大规模 EP，也不能只满足规模条件就断言已选中该路径。

PD 分离可以让两个阶段分别选择并行布局和调度参数，但增加了状态传输与独立资源池的管理。是否采用 PD，需要结合输入/输出长度、请求分布、网络和容量判断；它不是 EP 的定义前提。
