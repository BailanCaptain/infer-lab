# Wiki 索引

派生文件，由 `pnpm wiki:build` 生成，勿手改。共 11 页。

## 概念（concept）
- [Block Table](concepts/block-table.md) — 一张 [请求槽位 × 逻辑块号] 的 int32 表，把每条序列内部连续的块号翻译成 KV cache 里离散的物理块号。 `11`

## 特性（feature）
- [KV Cache CPU Offload](concepts/kv-cache-cpu-offload.md) — 把 NPU 上暂时用不到的 KV 块经专用 DMA 流批量拷到预分配的 CPU 内存池，前缀命中时再异步拷回，用主机内存换重算。 `11`
- [Layerwise KV Offload](concepts/kv-cache-layerwise-offload.md) — 把 KV cache 的存取从「整趟前向结束后一次搬」改成「每算完一层立刻搬一层」，让搬运与下一层计算重叠；memcache 后端上还能让多层共用同一块 HBM 缓冲。 `11`
- [KV Cache Memory Profiling](concepts/kv-cache-memory-profiling.md) — 启动时跑一次假 batch 前向，量出权重、激活峰值与非 torch 内存，再从 gpu_memory_utilization 划定的预算里减掉，剩下的字节全给 KV Cache。 `11`
- [KV Cache Quantization](concepts/kv-cache-quantization.md) — 把 KV cache 从 bf16 降到 INT8（昇腾称 C8），显存减半；scale 来自 ModelSlim 量化 checkpoint，attention 算子直接吃 INT8 分页 cache 加反量化 scale。 `11 17`
- [Sparse KV Offload](concepts/kv-cache-sparse-offload.md) — Decode 节点把完整主 KV 放主机内存，每步只把 indexer 选中的 top-k token 搬回 NPU 的常驻热缓冲区。 `11`
- [KV Cache Spec](concepts/kv-cache-spec.md) — 每个注意力层用一份 KVCacheSpec 声明自己一个 block 的形状与字节数，引擎据此算出块数，runner 再按字节申请裸内存并 view 成张量。 `11`
- [KV Pool](concepts/kv-pool.md) — 把 KV cache 存到 HBM 之外的 DRAM/SSD 池里，并让所有实例共享同一份前缀，把 prefix caching 的命中率从「单卡可见」扩到「全集群可见」。 `11`
- [PagedAttention](concepts/paged-attention.md) — 把 KV Cache 切成固定 128 token 的物理块，用 block_table 把逻辑序列映射到分散的块，attention 算子按块号取 KV。 `11`
- [Prefix Caching](concepts/prefix-caching.md) — 把已经算过的前缀 KV 按 block 哈希存下来，后续请求命中就直接跳过这段 prefill，只算没命中的尾巴。 `11`
- [Recompute CPU Offload](concepts/recompute-cpu-offload.md) — P/D 分离的 Decode 节点抢占请求时，把它已算好的 KV 块从 HBM 拷到 pinned CPU 内存留着，重新调度时再拷回来，避免整条请求被打回 Prefill 重算。 `11 12`

## 按章节

### 11 KV Cache 内存系统
- [Block Table](concepts/block-table.md)
- [KV Cache CPU Offload](concepts/kv-cache-cpu-offload.md)
- [Layerwise KV Offload](concepts/kv-cache-layerwise-offload.md)
- [KV Cache Memory Profiling](concepts/kv-cache-memory-profiling.md)
- [KV Cache Quantization](concepts/kv-cache-quantization.md)
- [Sparse KV Offload](concepts/kv-cache-sparse-offload.md)
- [KV Cache Spec](concepts/kv-cache-spec.md)
- [KV Pool](concepts/kv-pool.md)
- [PagedAttention](concepts/paged-attention.md)
- [Prefix Caching](concepts/prefix-caching.md)
- [Recompute CPU Offload](concepts/recompute-cpu-offload.md)

### 12 调度
- [Recompute CPU Offload](concepts/recompute-cpu-offload.md)

### 17 量化与投机解码
- [KV Cache Quantization](concepts/kv-cache-quantization.md)
