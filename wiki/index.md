# Wiki 索引

派生文件，由 `pnpm wiki:build` 生成，勿手改。共 11 页。

## 概念（concept）
- [Block Table](concepts/block-table.md) — 每个请求一行、记录它按顺序占用了哪些物理 KV block 的整数表；配合 slot_mapping 把 token 位置翻译成 KV cache 里的写入槽位。 `11`

## 特性（feature）
- [KV Cache CPU Offload](concepts/kv-cache-cpu-offload.md) — 把 NPU 上被淘汰的 KV block 异步搬到 CPU 内存做二级前缀缓存，命中时再用专用 NPU stream 搬回来，省掉重算。 `11`
- [Layerwise KV Offload](concepts/kv-cache-layerwise-offload.md) — 把 KV cache 的存/取从「整个 forward 一次性搬运」拆成「每层算完就搬」，用后一层的注意力计算掩盖前一层的传输，并让多层共用少量 NPU buffer。 `11`
- [KV Cache Memory Profiling](concepts/kv-cache-memory-profiling.md) — 启动时跑一次假的前向，量出权重、激活峰值和非 torch 显存，用 total_memory×gpu_memory_utilization 减掉它们，得到能分给 KV Cache 的字节数。 `11`
- [KV Cache Quantization](concepts/kv-cache-quantization.md) — 把写进 KV cache 的 K/V 从 bf16 降到 int8（A5 上为 fp8_e4m3fn），显存减半；scale 来自 ModelSlim checkpoint 里的 kv_cache_scale，attention 算子按 antiquant scale 在核内反量化。 `11 17`
- [Sparse KV Offload](concepts/kv-cache-sparse-offload.md) — Decode 节点把整份 KV cache 放在主机 DRAM，每步只把稀疏注意力 indexer 选中的 top-k token 的 KV 拉回 NPU 常驻 buffer 上算一次注意力。 `11`
- [KV Cache Spec](concepts/kv-cache-spec.md) — 每个注意力层向引擎申报一张"规格单"（block_size、num_kv_heads、head_size、dtype），引擎据此算出每 block 字节数与总 block 数，再回头按规格单分配真实张量。 `11`
- [KV Pool](concepts/kv-pool.md) — 把 KV cache 存进 HBM 之外的共享存储池（Mooncake / Memcache / Yuanrong），让前缀命中能跨请求、跨实例复用；AscendStoreConnector 在调度侧查命中数、在 worker 侧按块地址把 KV 搬进搬出 HBM。 `11`
- [PagedAttention](concepts/paged-attention.md) — 把 KV Cache 切成固定 128 token 的物理块，attention 靠 block_table 按块寻址读取；昇腾上它是一个可选算子分支，默认走 FIA。 `11`
- [Prefix Caching](concepts/prefix-caching.md) — 把已算过的前缀 KV 按 block 哈希存下来，新请求命中多少个整块就跳过多少 token 的前向计算。 `11`
- [Recompute CPU Offload](concepts/recompute-cpu-offload.md) — PD 分离 D 节点被抢占的请求，把已算好的 KV 块从 HBM 拷到 CPU 内存暂存，重新排到时再拷回，避免退回 P 节点重跑 prefill。 `11 12`

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
