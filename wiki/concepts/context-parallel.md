---
id: context-parallel
title: 上下文并行（CP）：位置分工与注意力结果合并
type: feature
summary: 从密集因果注意力的跨位置依赖解释 PCP 与 DCP，推导局部 softmax 输出的合并，并明确 GLM 混合注意力的支持边界。
aliases: [Context Parallel, 上下文并行, CP, PCP, DCP, Prefill Context Parallel, Decode Context Parallel, 前缀上下文并行, 解码上下文并行, prefill_context_parallel_size, decode_context_parallel_size, cp_kv_cache_interleave_size, enable_cp, enable_dcp, enable_pcp, AscendAttentionCPImpl, AscendMlaCPImpl, AscendAttentionDCPImpl]
chapters: ["15"]
order: 20
sources:
  - vllm-ascend@db701c1f:docs/source/developer_guide/Design_Documents/context_parallel.md#L11-L20
  - vllm-ascend@db701c1f:vllm_ascend/worker/pcp_utils.py#L663-L721
  - vllm-ascend@db701c1f:vllm_ascend/worker/pcp_utils.py#L751-L780
  - vllm-ascend@db701c1f:vllm_ascend/worker/block_table.py#L231-L276
  - vllm-ascend@db701c1f:vllm_ascend/attention/context_parallel/common_cp.py#L111-L130
  - vllm-ascend@db701c1f:vllm_ascend/attention/context_parallel/common_cp.py#L186-L197
  - vllm@0fc695fc:vllm/distributed/parallel_state.py#L1774-L1794
  - vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L390-L403
  - vllm-ascend@db701c1f:vllm_ascend/utils.py#L114-L136
  - vllm-ascend@db701c1f:vllm_ascend/platform.py#L717-L730
  - vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L508-L509
  - vllm@0fc695fc:vllm/v1/core/kv_cache_coordinator.py#L702-L729
verified: []
evidence: "C"
relations:
  - {to: attention-qkv, kind: builds-on, note: 先理解完整的评分、softmax 与 V 汇合}
  - {to: collective-communication, kind: builds-on, note: 理解交换、收集与归约}
  - {to: block-table, kind: builds-on, note: 理解逻辑位置与物理存储槽位}
  - {to: sequence-parallel, kind: builds-on, note: 区分局部激活分片与跨位置注意力}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 长上下文中的两种压力

密集因果注意力中，位置 i 的查询需要访问从开头到当前位置的 K/V。输入越长，prefill 的有效查询–键组合越多；生成阶段虽然查询较少，仍需要读取较长历史。上下文并行（Context Parallelism，CP）沿序列位置组织多设备协作，以分担相关计算或历史存储。

先以普通密集注意力理解机制。GLM 使用稀疏 MLA 与 KDA，组件拥有不同的历史状态和计算规则；本页后面单列固定版本的支持限制，以下通用推导不构成 GLM 的 CP 部署方案。

| 维度 | 首先划分什么 | 需要解决的依赖 |
|---|---|---|
| SP 局部区域 | 当前激活的 token 行 | 逐行运算后恢复下一阶段所需布局 |
| PCP | prefill 的查询位置与相关执行 | 不同查询需要的历史可见范围不同 |
| DCP | decode 等路径的历史 KV 位置 | 同一查询的局部注意力结果要正确合并 |

固定文档用 PCP 扩展执行设备维度，用 DCP 复用 TP 设备来减少重复 KV 存储。[S1] 这是本实现的组织方式，不是所有 CP 算法的唯一分类。

## PCP：相同位置数不一定计算量相同

考虑长度 8 的普通因果序列，位置 0–7 分别有 1–8 个可见键，合计 36 对。若前四个查询给 rank 0、后四个给 rank 1，工作量分别为 10 和 26 对。

```wiki-diagram
file: context-parallel-prefill
```

一种更均衡的切法把序列分成四段，首尾配对：rank 0 处理位置 0、1、6、7，共 18 对；rank 1 处理 2、3、4、5，也是 18 对。固定 PCP 输入准备使用双块头尾组织，并保存补齐和恢复顺序所需的信息。[C2][C3]

分到哪些查询，不等于只需读取同一段 K/V。位置 7 仍依赖所有可见历史；实际注意力路径必须交换所需数据并保持因果掩码。矩阵上改变的是计算归属，合法可见范围没有改变。

## DCP：分区保存历史，再合并同一查询的结果

```wiki-diagram
file: context-parallel
```

图假设两个 DCP rank、交错粒度为 1，将历史位置轮流存放；这只是教学布局，不声明 GLM 的默认配置。物理写入由块表和槽位映射完成，具体粒度与后端必须匹配。[C4]

每个 rank 使用本地历史计算同一个查询的局部输出。因为局部 softmax 的分母只含本地位置，直接把局部输出相加或平均都不正确。

```wiki-diagram
file: context-parallel-merge
```

设第 r 个历史分区的评分为 s，定义：

`Zᵣ = Σ exp(sⱼ)`，`Oᵣ = Σ exp(sⱼ) Vⱼ / Zᵣ`

Zᵣ 是该分区的未归一化权重和。为了稳定计算，通常保存 `Lᵣ = log(Zᵣ)`，即 log-sum-exp（LSE）。合并公式为：

`L = log Σ exp(Lᵣ)`，`O = Σ exp(Lᵣ − L) Oᵣ`

例如两个分区 Z₀=2、Z₁=6，局部标量输出 O₀=10、O₁=30，则全局输出为 `2/8×10 + 6/8×30 = 25`，既不是 40，也不是 20。向量输出对每个分量采用相同权重。

这个合并要求各分区对应同一查询与头、评分和掩码定义一致，且共同覆盖所需历史。固定实现交换局部输出和 LSE，再按上述公式更新；具体路径在 DCP 轴使用 All-to-All，PCP 轴还可进行 All-Gather。[C5][C6] 并非每种 CP 路径都搬整份 KV，也并非都采用同一种通信组合。

## 复用设备仍需建立逻辑组

固定上游 DCP 将已有 TP 设备划成 DCP 组，不额外扩大 world size，但仍调用建组逻辑。[C7] 所以“复用 TP 设备”不等于“不建立通信组”。TP、DCP rank 和物理设备编号也不能混为同一个下标。

DCP 可以分散相应历史存储和读取工作，却引入查询或结果交换、布局转换与同步。稀疏索引状态、其他注意力状态及临时缓冲可能采用不同的复制/分片方式，不能把整个混合模型缓存统一除以 DCP 数。

## GLM 固定版本的适用边界

当前主线不能直接启用上述所有组合：

- **PCP**：GLM 使用的 KDA prefill 在 PCP>1 时明确抛出 `NotImplementedError`。[C8] 通用 PCP 注意力实现的存在不代表整个混合模型可用。
- **SFA 的 DCP 条件**：满足 `index_topk` 存在、`compress_ratios` 不存在、PCP=1、DCP>1 等判定时，固定平台要求 DCP=TP。[C9][C10] GLM 固定配置具有相应字段特征，但最终配置适配与完整运行组合仍需验证。
- **混合缓存协调**：上游参考提交在启用前缀缓存且进入多缓存组 Hybrid coordinator 的路径中，要求 DCP/PCP 均为 1。[C11][C12] 这是该参考快照的条件限制；关闭前缀缓存也不能单独证明其余路径全部兼容。

本知识库用这些例子解释并行基础，并保留来源条件。GLM 的实际双机学习主线继续采用[官方 TP/DP 配置](../sources/glm-5-3-flash-baseline.md)，不将未验证 CP 组合混进部署命令。
