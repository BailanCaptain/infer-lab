---
id: kv-pool
title: 外部 KV 池：前缀匹配、加载和完成状态
type: feature
summary: 解释外部缓存怎样补充本地前缀命中，如何识别数据归属，以及命中计划到实际可读之间需要哪些步骤。
aliases: [KV Pool, KV 池, AscendStoreConnector, 外部前缀缓存, get_num_new_matched_tokens, cache_transfer_granularity]
chapters: ["11"]
sources:
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/config_data.py#L29-L75
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/pool_scheduler.py#L491-L584
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L85-L108
  - vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/ascend_store_connector.py#L229-L253
verified: []
evidence: "C"
relations:
  - {to: prefix-caching, kind: builds-on, note: 从本地前缀复用扩展到外部存储}
  - {to: block-table, kind: builds-on, note: 外部数据加载后仍需本地物理块映射}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 从本地命中扩展到外部状态

[前缀缓存](prefix-caching.md)让相同开头的请求复用已计算的状态。本地设备容量有限，也可能有多个服务实例希望访问可复用数据。外部 KV 池把缓存放到连接器管理的另一处存储，提供匹配、加载和保存能力。

池可以依赖本机内存、远端内存或其他后端。是否跨机器共享、是否持久化、容量是否更大，取决于具体后端和部署；这些属性不由“KV Pool”这个名字单独决定。

本页采用固定 AscendStore 说明外部缓存与 vLLM 的交接。它保存的是模型计算状态，服务恢复这些状态之前，仍需要本地设备空间和正确的块映射。

## 命中数量描述的是哪一段

调度器已经知道本地可以复用多少位置，再询问外部池能提供到哪个位置。在普通非逐层路径下，外部可提供范围减去本地已计算范围，得到还需要加载的逻辑位置数。[C2]

设请求 A 有24个位置，本地可复用前8个，外部池可提供前20个：[A]

`外部新增范围 = [8,20)，共20−8=12个位置`

前8个位置可以直接使用本地状态；位置8至19需要外部加载；位置20至23还要计算。图按每4个位置一格展示范围，格子的大小只是教学假设。

```wiki-diagram
file: kv-pool
```

固定实现还处理完整命中：如果外部命中覆盖请求的全部 token，会保留最后一个位置继续计算，以产生后续所需结果。[C2] 例如请求恰好20个位置，外部命中20、本地命中8时，可替代计算的外部新增范围按 `19−8=11` 个位置计。实际搬运可能按完整页执行，逻辑位置数与线上字节数不是同一个量。

## 查询成功以后，数据还没有自动到达

外部缓存的生命周期包含两个不同层面：调度侧决定使用哪些已有状态，Worker 侧负责让对应字节在需要时可读。

1. **查询**：检查前缀身份和可提供的范围，形成外部命中计划。
2. **分配**：为缺少的本地状态申请设备页，建立加载目标。
3. **传输**：把外部内容放入对应目标，跟踪加载进度。
4. **使用**：完成依赖满足后，模型才读取加载的历史。
5. **保存与回收**：新计算的数据按连接器策略保存；仍被传输使用的空间必须保持有效。

不同连接器可以同步或异步完成其中的传输。命中是计划使用某段已有数据，不等于这些数据已经驻留设备，也不保证后续传输一定成功。

## 缓存键要描述数据身份

相同的 token 前缀只有在模型和状态解释一致时才可共享。固定 AscendStore 的键除了 chunk hash，还包含模型名、相关并行 rank、缓存 group、cache role 和 cache family 等字段。[C1]

这些信息用于区别同一前缀在不同模型、分片和状态类型下的内容。两个 rank 的同一位置可能保存不同头或不同分片，KDA 状态与稀疏注意力缓存也具有不同含义；把它们放在同一个后端不意味着可以互换。

传输还有粒度约束。固定查询路径可以把 prompt 长度向下取整到 `cache_transfer_granularity`，不足一个粒度时不提交查询。[C2] 如果教学例子设粒度16，长度10不形成完整段，长度35可查询到32的位置范围。[A][D] 实际粒度来自配置和缓存布局，不是所有模型固定为2048。

## 逐层模式为什么有例外

上述“只补本地缺失部分”适用于普通路径。逐层模式可能在逻辑上已经命中某段历史，但当前层的数据并未驻留设备；固定代码因此允许强制执行逐层加载。[C2] 对应连接器也分别提供按层等待和保存接口。[C4]

本地命中数为0仍然可以定义外部查询的起点。是否必须开启某个前缀缓存选项，需要看使用路径的独立配置检查，不能仅从“外部命中减本地命中”这道公式推出。

## 使用边界与后续方案

AscendStore 选择后端和逐层模式的入口在连接器配置中。[C3] 选择一种配置前，应先明确它的保存粒度、数据身份、完成信号和失败处理，再评估命中率与传输成本。

GLM 的完整恢复需要覆盖全部相关缓存组。源码具有多 group 键或逐层接口，不足以证明某一 GLM 组合已经端到端可用。本页未进行设备验证。[LMCache](lmcache.md)与[UCM](ucm.md)进一步展示不同外部实现如何接入这些职责。
