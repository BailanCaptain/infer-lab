---
id: kv-cache-layerwise-offload
title: 逐层缓存传输：计算重叠与缓冲区复用
type: feature
summary: 按模型层安排缓存读写，解释等待如何与计算重叠，以及缓存规格、完成事件和共享槽位怎样限制显存复用。
aliases: [Layerwise KV Offload, 逐层 KV 卸载, 逐层缓存传输, Layerwise KV Pool, shared buffer, layerwise_cache_layout]
chapters: ["11", "18"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L85-L108
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L229-L253
  - vllm-ascend@db701c1f:vllm_ascend/attention/utils.py#L429-L473
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L128-L192
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L210-L294
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/layerwise_cache_layout.py#L297-L381
verified: []
evidence: "C"
relations:
  - {to: kv-pool, kind: builds-on, note: 在外部缓存生命周期中细化每层的传输时机}
  - {to: kv-cache-spec, kind: builds-on, note: 缓存规格决定哪些层可以共享物理缓冲区}
  - {to: pd-disaggregation, kind: builds-on, note: P和D消费历史状态的时间不同}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 层之间存在可利用的时间间隔

模型按层执行前向。当第 L 层完成时，这一层新产生的缓存已经可供保存，而第 L+1 层仍需要计算。如果等所有层完成后才开始传输，部分等待就集中在整个前向的末尾。

逐层传输把外部缓存的读写安排到层边界：产生一层就可以提交这一层的保存；读取外部历史时，在当前层使用前等待它的数据就绪。固定 Ascend 的 attention 辅助接口和连接器提供了这些保存、等待入口。[C2][C3]

这个安排使部分计算和传输可以重叠。是否真正缩短等待，取决于每层计算时间、数据量、可用带宽和同步依赖；每层传输耗时超过可重叠窗口时，后续计算仍需等待。

## 传输完成决定缓冲区何时可以覆盖

假设第 L 层的缓存保存在设备缓冲区 S，保存任务正在从 S 读取。如果第 L+1 层直接覆盖 S，外部存储就可能收到混合的数据。因此缓存的生命周期需要包含以下边界：

1. 第 L 层计算完成，S 的内容可保存。
2. 保存任务读取 S，S 暂时不能被后续层覆盖。
3. 传输完成，保存任务不再依赖 S。
4. 后续层才能用 S 存放自己的结果。

加载方向也一样：预取下一层缓存时，目标槽必须可写；真正执行这一层之前，加载必须完成。这些依赖决定能否复用内存，而不是“已经调用保存接口”就意味着原空间可释放。

## 从逐层传输到共享槽位

逐层传输和物理 buffer 复用是两个能力。前者改变时间安排，后者让不同层在不重叠的生命周期中占用同一块物理内存。

用于说明复用的 main 开发主线固定快照按缓存规格分组，并给每组安排独占层和共享槽。[C4][C5] 以下示意假设8个 attention 层缓存规格完全一致，每层原本需要 P 字节；第0层独占，剩下7层使用两个共享槽。[A]

```wiki-diagram
file: kv-cache-layerwise-offload
```

| 物理槽 | 依次使用它的层 |
|---|---|
| 独占槽 | L0 |
| 共享槽 S0 | L1、L3、L5、L7 |
| 共享槽 S1 | L2、L4、L6 |

在各次覆盖都等待前一用户不再使用后，缓存主体由8P降到3P，即原来的37.5%。若 P=8 MiB，则由64 MiB降到24 MiB。[D] 外部存储、传输工作区和元数据仍要另外计算。

## 不同缓存规格要分开计算

实际布局先按主 `KVCacheSpec` 分桶，每桶分别分配共享槽；合并缓冲时还检查规格与字节大小一致。[C5][C6] 如果8层分成两个不同规格的组，就不能继续用上面的“总共3槽”推导。

缓存 dtype、头数、维度、附加索引状态或不同的层类型都可能改变规格。该扩展实现遇到实际复用且包含非 `AttentionSpec` 的状态时会拒绝构造。[C5] 因而它对 GLM 的 KDA/稀疏混合状态是否适用，需要逐组和逐个调用点核实，不能按模型总层数直接计算缩减倍数。

## 数据规模和重叠窗口

若一层待保存的数据是8 MiB，有效传输带宽为8 GiB/s，则理想传输时间约0.98毫秒。[A][D] 如果后续允许重叠的计算只有0.4毫秒，即使没有其他开销也不能完全隐藏这次传输。增加共享槽可以提供更宽的预取和保存窗口，同时会占用更多设备内存。

因此逐层方案应同时观察设备缓存容量、每层传输量、等待事件耗时和整体前向时间。减少槽位不是无条件的延迟优化。

## 固定基线与扩展实现

GLM 来源基线的 AscendStore 已有 `use_layerwise` 模式以及对应回调；该快照的 consumer 在 `save_kv_layer` 中直接返回，模式和角色会影响数据流。[C1][C2] 上面用于缓冲复用的布局实现来自另外的 main 开发主线固定快照，来源分别列出，没有把二者拼成一份已验证部署。

本页的8层同规格布局是可手算的内存复用例子，GLM 的完整运行支持仍以模型、连接器、缓存规格和版本组合为单位判断。本文未做设备验证。
