---
id: kv-cache-sparse-offload
title: 稀疏缓存卸载：按选中位置加载历史数据
type: feature
summary: 从稀疏注意力的访问集合出发，解释主机全量历史、设备索引状态、热缓存和缺失行加载，计算容量与搬运代价。
aliases: [Sparse KV Offload, 稀疏 KV 卸载, sparse_kv_offload, SFA, resident buffer, index_topk]
chapters: ["11"]
sources:
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1467-L1533
  - vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L7-L20
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L107-L138
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L170-L197
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L213-L295
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/sparse_kv_offload/sparse_kv_offload_manager.py#L316-L346
  - vllm-ascend@baa023ad:vllm_ascend/attention/sfa_kv_offload.py#L1035-L1134
verified: []
evidence: "C"
relations:
  - {to: sparse-attention, kind: builds-on, note: 先理解索引器如何选择注意力访问的位置}
  - {to: kv-cache, kind: builds-on, note: 区分索引状态和注意力历史缓存}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 稀疏读取创造了分层存储的机会

[稀疏注意力](sparse-attention.md)先选择历史位置，再对选中位置执行注意力计算。模型可能保留很长的历史，但某一步真正读取的主注意力数据只是其中一部分。

稀疏卸载利用这个访问模式：把完整的主注意力历史放到主机内存，在设备上保留近期使用的部分；每一步选出位置后，只把设备缺少的行加载进来。这改变数据所在的位置和取得数据的过程，模型的选择规则仍由注意力机制决定。

本页对应 main 开发主线中的稀疏卸载固定快照，是扩展专题，下文热缓存流程采用默认的 `use_fused_overlap: false` 路径。[C1][C7] GLM 来源基线没有同一套实现；GLM 包含稀疏层这一事实，不等于整模已经支持该卸载方案。

## 设备上不只有热 KV

这套实现涉及三类主要数据：

| 数据 | 作用与位置 |
|---|---|
| 完整主注意力历史 | 保存于主机，供选中位置按需加载 |
| 索引器缓存 | 仍保留在设备，帮助对历史位置评分和选择 |
| 主注意力热缓冲 | 在设备保存部分历史行，减少重复加载 |

固定后端明确保留设备端的 indexer K cache；不保留完整设备主 KV 的设置并不会一并移走索引器状态。[C2] 选中位置、地址映射和 top-k 工作区也需要空间，其中工作区行数还考虑当前 token 预算、并发和推测 token 数。[C3]

```wiki-diagram
file: kv-cache-sparse-offload
```

## 用两次访问计算需要搬哪些行

设主机有历史位置0至7，热缓冲有4个槽，目前包含 `{0,2,4,6}`。这一步模型选择 `{2,5}`：[A]

1. 位置2命中设备热缓冲，可以继续使用。
2. 位置5缺失，需要从主机读取一行。
3. 在不覆盖本步仍需使用的位置2的前提下，为位置5安排槽位；图中假设选择原来保存位置6的槽。
4. 缺失行加载完成后，注意力读取位置2和5。

固定实现将有效选中位置交给 onload 路径，并让注意力使用对应的 resident buffer 视图。[C7] 热缓存只减少搬运，不能省掉本步选中但尚未到达的行。

如果下一步选择 `{2,5}`，两行都可能命中；若选择 `{1,7}`且都不在缓冲，则仍要加载两行。跨步访问的重合程度由模型和输入决定，不能预先保证稳定后只有很少的缺失。

## 容量和流量分别怎样算

对一个同规格的教学例子，假设每个历史位置的主数据是512个 latent 元素加64个位置相关元素，均为BF16；共有61层、32个请求，每请求每层有4096个热槽。[A]

`每位置每层字节 = (512+64)×2 = 1152 B`

`热缓冲主体 = 32×61×4096×1152 B ≈ 8.58 GiB`

这是主注意力热缓冲的容量。[D] 设备总开销还包括索引器缓存、工作区、元数据和其他模型运行对象。这里的61层同构算例不是 GLM 形状。

假设每请求每层本步读取2048行，完全未命中时的主数据加载载荷是 `32×61×2048×1152 B≈4.29 GiB`；若只缺失其十分之一，主数据载荷也约为十分之一。[A][D] 这只计算字节，不包含主机访问、地址映射、同步以及链路争用。

完整主机历史还需要按页分配并对齐。[C4] 固定 manager 同时计算主存与设备缓存规格，最终页数受 **设备容量、扣除对齐后的主存容量、工作负载需求** 三者共同限制。[C5] 上下文长度因此仍可能受设备索引缓存制约。

## 实现条件与代价

固定扩展配置要求模型具有 `index_topk`，热缓冲不少于一次选择所需的位置数，并要求 PCP=1、DCP=1、PP=1。它拒绝含 `compress_ratios` 的模型与 v2 runner；`keep_device_kv_cache: false` 时必须配置为 KV consumer，用于 PD 分离的 D 端。设为 true 则保留完整设备缓存，是另外的调试路径。[C1] 这些检查通过仍不等于具体模型已完成运行验证。

主缓存在TP组内的主存分配也有指定归属，不能把一个组的容量再逐 rank 重复相加。[C6] 同一快照还提供 `use_fused_overlap` 分支，将读取与注意力交给另一条融合执行路径；本页的热槽访问算例与容量组成不直接代表该分支的全部缓冲布局。[C7]

更大的热缓冲可能提高命中率，同时占用更多设备内存；更大的主存池可保存更长历史，同时增加主机资源压力。相邻步骤选中集合变化较大时，加载成本会接近完全未命中情况。

正确的卸载实现应提供本步规定的全部选中数据，不额外丢弃历史；不同算子路径的浮点输出是否逐位相同仍是另一项验证。本页未验证 GLM 的 KDA 状态与该稀疏卸载共同运行，也未给出硬件性能结果。
