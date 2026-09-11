# Wiki 索引

派生文件，由 `pnpm wiki:build` 生成，勿手改。共 11 页。

## 概念（concept）
- [Block Table](concepts/block-table.md) — 一张 [请求槽位 × 逻辑块号] 的 int32 表，把每条序列内部第几块 KV 翻译成显存里的全局物理块号。 `11`

## 特性（feature）
- [KV Cache CPU Offload](concepts/kv-cache-cpu-offload.md) — 把已算完的 KV 块按 chunk 批量 DMA 到锁页 CPU 内存，NPU 前缀未命中而 CPU 命中时再异步搬回，用主机带宽换 prefill 重算。 `11`
- [Layerwise KV Offload](concepts/kv-cache-layerwise-offload.md) — 把「整份 KV 一次搬」拆成「算完一层搬一层」，用 NPU event 让第 i 层的搬运与第 i+1 层的计算重叠；多个层还可共用少数几块物理 buffer 来省 HBM。 `11`
- [KV Cache Memory Profiling](concepts/kv-cache-memory-profiling.md) — 启动时先跑一次最坏形状的空转前向，量出权重、激活峰值与非 torch 占用，再从 total_memory × gpu_memory_utilization 里减掉它们，得到 KV Cache 能用的字节数。 `11`
- [KV Cache Quantization](concepts/kv-cache-quantization.md) — 把每层缓存的 K/V 从 BF16 降到 INT8（昇腾 950 上为 FP8）存放，配合每通道 scale 由 attention 算子内反量化，每 token 字节数减半。 `11 17`
- [Sparse KV Offload](concepts/kv-cache-sparse-offload.md) — Decode 节点把 MLA 主 KV 全量放在主机内存，每步只把稀疏注意力选中的 top-k token 中未驻留的那些搬回 NPU 热缓冲区。 `11`
- [KV Cache Spec](concepts/kv-cache-spec.md) — 每个注意力层自己申报一条 spec——块大小、KV 头数、head dim、dtype——引擎据此算出能开多少块，Worker 据此把显存切成真正的张量。 `11`
- [KV Pool](concepts/kv-pool.md) — 把已算好的 KV 块存进一个跨节点共享的外部存储（Mooncake/Memcache/Yuanrong），命中时直接搬回 HBM，替代重算。 `11`
- [PagedAttention](concepts/paged-attention.md) — 把每层 KV Cache 切成定长块散放在显存里，attention 算子拿着块表按块去取，序列不必占一段连续显存。 `11`
- [Prefix Caching](concepts/prefix-caching.md) — 把已算过的 KV 按块哈希存下来，新请求前缀相同就直接挂上旧块，只对未命中的尾部做 prefill。 `11`
- [Recompute CPU Offload](concepts/recompute-cpu-offload.md) — Decode 节点抢占请求时，先把它已算出的 KV 块从 HBM 拷到 pinned CPU 内存，重新排到时再拷回来，避免把请求打回 Prefill 重算。 `11 12`

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
