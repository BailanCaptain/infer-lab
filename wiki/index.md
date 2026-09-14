# Wiki 索引

派生文件，由 `pnpm wiki:build` 生成，勿手改。共 19 页。

## 概念（concept）
- [Block Table](concepts/block-table.md) — 一张 (请求数 × 每请求最大块数) 的 int32 表，把序列内第几个块翻译成显存里的物理块号，再由它算出每个 token 的写入槽位。 `11`

## 特性（feature）
- [KV Cache CPU Offload](concepts/kv-cache-cpu-offload.md) — 把 NPU 上要被淘汰的 KV 块异步拷到主机内存留一份备份，下次同一前缀在 NPU 上没命中但 CPU 池里还在，就再异步拷回来，省掉重新 prefill。 `11`
- [Layerwise KV Offload](concepts/kv-cache-layerwise-offload.md) — 把 KV 的存取从「整趟前向做完一次性搬」改成「每层算完立刻搬」，搬运与下一层计算重叠；main 上还能让多层共用一份 HBM buffer。 `11`
- [KV Cache Memory Profiling](concepts/kv-cache-memory-profiling.md) — 启动时跑一遍假数据前向，量出权重、激活峰值、非 torch 三块占用，再用「整卡容量 × gpu_memory_utilization 减去这三块」定下 KV Cache 能拿多少字节。 `11`
- [KV Cache Quantization](concepts/kv-cache-quantization.md) — 用 ModelSlim 标定好的静态 scale 把 KV cache 存成 int8，decode 时交给 npu_fused_infer_attention_score 就地反量化；由 checkpoint 里的 kv_cache_type = C8 触发，不看 --kv-cache-dtype。 `11 17`
- [Sparse KV Offload](concepts/kv-cache-sparse-offload.md) — PD 分离的 D 节点上，主 KV 全部住在主机内存，每步只把 indexer 选中的 top-k token 里未命中的那几行搬回 NPU 热缓冲区。 `11`
- [KV Cache Spec](concepts/kv-cache-spec.md) — 每个注意力层向引擎声明自己的 KV Cache 长什么样——块大小、KV 头数、头维、dtype，引擎据此换算每块字节数并决定分配多少块。 `11`
- [KV Pool](concepts/kv-pool.md) — 把 KV Cache 存进 HBM 之外、跨节点共享的存储池，让前缀命中不再受单卡显存与单节点边界限制。 `11`
- [PagedAttention](concepts/paged-attention.md) — 昇腾后端把 KV Cache 切成 128 token 的定长块，decode 时由块表指路、算子按块号跳着取 K/V；专用的 _npu_paged_attention 算子默认不启用，需手工配 pa_shape_list。 `11`
- [Prefix Caching](concepts/prefix-caching.md) — 把已算过的 KV 块按内容哈希留在池子里，下一条请求若开头完全相同就直接复用这些块，只对不同的尾巴做前向。 `11`
- [Recompute CPU Offload](concepts/recompute-cpu-offload.md) — PD 分离的 Decode 节点抢占请求时，把它已算好的 KV 块从 HBM 拷到锁页 CPU 内存里存着，恢复时再拷回来，避免整条请求被打回 Prefill 重算。 `11 12`

## 参数（param）
- [enable_async_exponential](params/enable-async-exponential.md) — 把采样用的指数分布随机数提前挪到副 stream 上生成，与本步 model forward 重叠；v0.23.0 默认关闭并已标记待废弃，main 上已整体删除。 `19`
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md) — 把 RowParallelLinear 的「矩阵乘完再 AllReduce」换成 MC2 融合算子 npu_mm_all_reduce_base，让通信藏进计算里；v0.23.0 有，main 已整体移除。 `13`
- [enable_sleep_mode_extra_cleanup](params/enable-sleep-mode-extra-cleanup.md) — sleep 时额外销毁 HCCL 通信域并清空 ACL 图工作区，把更多显存还给训练进程；默认关闭，因为唤醒要重建通信域并重新捕获图。 `19`
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md) — 把 Linear 的 matmul、TP AllReduce、残差加法与 RMSNorm 融成一个算子；因与序列并行争抢同一段子图而默认关闭，main 上已整体删除。 `13`
- [layer_sharding](params/layer-sharding.md) — 点名一组同构 Linear，让第 i 层的权重只存在通信组内第 i % K 张卡上，前向时异步广播取回；只能在 PD 分离的 P 节点开，main 上已整体删除。 `13`
- [multistream_overlap_gate](params/multistream-overlap-gate.md) — v0.23.0 的 FlashComm3 门控重叠开关，把共享专家前向与 select_experts 路由挪到副流，与 MoE prepare 里的动态量化 + all-gather 并行；main 上已整体删除。 `14`
- [prefetch_ratio](params/prefetch-ratio.md) — weight_prefetch_config 下的嵌套 dict，按 attn/moe/mlp 三组、五个权重分别指定"预取权重的前百分之几"；v0.23.0 存在，main 已随整个 weight prefetch 一起删除。 `19`
- [weight_prefetch_config](params/weight-prefetch-config.md) — v0.23.0 的 additional_config 开关，把 linear 层权重提前搬进 L2 cache，藏在 quantize / gating / SwiGLU 这些 vector 计算背后；main 上整套机制已删除，传这个键会直接报错。 `19`

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

### 13 并行 I：TP / PP / DP
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md)
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md)
- [layer_sharding](params/layer-sharding.md)

### 14 并行 II：EP / DPA / EPLB / large-scale EP
- [multistream_overlap_gate](params/multistream-overlap-gate.md)

### 17 量化与投机解码
- [KV Cache Quantization](concepts/kv-cache-quantization.md)

### 19 性能工程
- [enable_async_exponential](params/enable-async-exponential.md)
- [enable_sleep_mode_extra_cleanup](params/enable-sleep-mode-extra-cleanup.md)
- [prefetch_ratio](params/prefetch-ratio.md)
- [weight_prefetch_config](params/weight-prefetch-config.md)
