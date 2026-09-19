# Wiki 索引

派生文件，由 `pnpm wiki:build` 生成，勿手改。共 61 页。

## 概念（concept）
- [四种注意力的代价](concepts/attention-cost.md) — 同样存一个 token 一层，普通 GQA 要 4096 字节，MLA 只要 1152。差别不是压缩得好，是存的东西根本不一样。 `04`
- [Block Table](concepts/block-table.md) — 一张 (请求数 × 每请求最大块数) 的 int32 表，把序列内第几个块翻译成显存里的物理块号，再由它算出每个 token 的写入槽位。 `11`
- [三个进程与 patch 注入点](concepts/engine-processes.md) — V1 引擎跑起来是 Main、EngineCore、Worker 三类进程；昇腾的 patch 要分别进这三处，用的是三条不同的路。 `10`
- [KV Cache](concepts/kv-cache.md) — 把每一层、每个已经算过的 token 的 K 和 V 留在显存里。下一步生成新 token 时只算新的那一个，旧的直接读。 `05 11`
- [贯穿全书的那条请求](concepts/one-request.md) — 全库只跟一条请求：Qwen3-0.6B、单卡、37 个 token 的问题、200 个 token 的回答。每一页都在讲它走到某一步时发生了什么。 `00`
- [一个算子从 Python 走到 AI Core](concepts/op-to-ai-core.md) — 拿 RMSNorm 走一遍四层。最关键的一段是 ops/layernorm.py 里的一个 if——它两边一边是自己编的融合算子，一边是 CANN 现成的算子加一次额外的逐元素加法。 `16`
- [Prefill](concepts/prefill.md) — 生成第一个字之前，把整段问题一次过完模型、把每个 token 的 K 和 V 写进缓存的那一步。它算得多、只做一次，决定了「多久出第一个字」。 `05`
- [怎么读这个仓库](concepts/reading-vllm-ascend.md) — 三条定位路线：手上有 traceback、有特性名、有上游类名各走一条；两个 ref 的对照法与三个会得出错结论的查法。 `20`
- [一次请求的调用链](concepts/request-call-chain.md) — 从 HTTP 到 token 一共七跳。前两跳在上游 vLLM，进程边界在第二跳与第三跳之间，之后全在昇腾侧。 `09`
- [RoPE (Rotary Position Embedding)](concepts/rope.md) — 把 Q 和 K 的每两个分量当成平面上的一个点，按「位置 × 频率」转一个角度。转完之后，两个 token 的注意力分数只取决于它们相隔多远。 `04`
- [vLLM-Ascend 是什么](concepts/vllm-ascend-overview.md) — 一个装在 vLLM 旁边的硬件插件：自己是独立的 Python 包，靠 entry point 把昇腾实现挂进 vLLM 的各层，不改上游一行代码。 `10`
- [vllm_ascend 目录地图](concepts/vllm-ascend-repo-map.md) — 23 个子目录、442 个 .py、130661 行。按职责分成六组，主干只有 worker、attention、ops 三个。 `20`
- [EngineCore：那个 while 循环](concepts/vllm-engine-core.md) — 整个推理引擎的心脏是一个不到十行的 while 循环。那条请求的 200 步，就是它转了 200 圈。 `10`
- [block 是怎么分出来的](concepts/vllm-kv-block-allocation.md) — 那条请求一共要了两次块：第 1 步要了一块，第 92 步 decode 又要了一块。要块、给块、还块，全在上游的 EngineCore 进程里。 `11`
- [Platform：上游留给硬件的那张问卷](concepts/vllm-platform-interface.md) — 上游把「凡是跟硬件有关的事」收成一个 Platform 类，88 个口子，全仓 873 处在问它。昇腾插件要做的就是把这张问卷答上。 `10`
- [调度器：没有 prefill 和 decode 之分](concepts/vllm-scheduler.md) — 调度器只做一道减法——每条请求还差多少 token 没算——再拿 token 预算去填。prefill 和 decode 是这道减法的两个结果，不是两条代码路径。 `12`
- [vLLM 的形状：三个进程，两道边界](concepts/vllm-v1-shape.md) — 那条请求要下去两层再上来两层。每跨一道边界，它携带的东西就换一种：字 → 整数 → 张量。 `10`
- [vLLM 与昇腾各管什么](concepts/who-owns-what.md) — vLLM 决定这一步算哪些 token，昇腾决定这些 token 怎么算出来。分界线落在调度交出 SchedulerOutput 的那一刻，也正好是进程边界。 `10`

## 特性（feature）
- [AscendConfig 配置系统](concepts/ascend-config-system.md) — --additional-config 的那段 JSON 由 AscendConfig 按键拆成十来个子配置对象，存成进程内单例；环境变量走另一条路。 `10`
- [Patch 机制](concepts/ascend-patch-system.md) — 上游没留口子的地方，昇腾在运行时把上游的类和函数换掉。两个目录对应两个时机，靠 import 副作用生效。 `10`
- [注意力后端家族](concepts/attention-backend-family.md) — attention/ 下五个后端类，按 (use_mla, use_sparse, use_compress) 三元组查表选出；普通后端的 KV 形状是五维，MLA 系是四维。 `04`
- [图模式层](concepts/graph-mode-layer.md) — 昇腾不走上游的 torch.compile 默认路径，而是用自己的编译后端加 ACLGraphWrapper；捕获在启动最后一步发生。 `16`
- [KV Cache CPU Offload](concepts/kv-cache-cpu-offload.md) — 把 NPU 上要被淘汰的 KV 块异步拷到主机内存留一份备份，下次同一前缀在 NPU 上没命中但 CPU 池里还在，就再异步拷回来，省掉重新 prefill。 `11`
- [Layerwise KV Offload](concepts/kv-cache-layerwise-offload.md) — 把 KV 的存取从「整趟前向做完一次性搬」改成「每层算完立刻搬」，搬运与下一层计算重叠；main 上还能让多层共用一份 HBM buffer。 `11`
- [KV Cache Memory Profiling](concepts/kv-cache-memory-profiling.md) — 启动时跑一遍假数据前向，量出权重、激活峰值、非 torch 三块占用，再用「整卡容量 × gpu_memory_utilization 减去这三块」定下 KV Cache 能拿多少字节。 `11`
- [KV Cache Quantization](concepts/kv-cache-quantization.md) — 用 ModelSlim 标定好的静态 scale 把 KV cache 存成 int8，decode 时交给 npu_fused_infer_attention_score 就地反量化；由 checkpoint 里的 kv_cache_type = C8 触发，不看 --kv-cache-dtype。 `11 17`
- [Sparse KV Offload](concepts/kv-cache-sparse-offload.md) — PD 分离的 D 节点上，主 KV 全部住在主机内存，每步只把 indexer 选中的 top-k token 里未命中的那几行搬回 NPU 热缓冲区。 `11`
- [KV Cache Spec](concepts/kv-cache-spec.md) — 每个注意力层向引擎声明自己的 KV Cache 长什么样——块大小、KV 头数、头维、dtype，引擎据此换算每块字节数并决定分配多少块。 `11`
- [KV Pool](concepts/kv-pool.md) — 把 KV Cache 存进 HBM 之外、跨节点共享的存储池，让前缀命中不再受单卡显存与单节点边界限制。 `11`
- [NPUModelRunner 怎么读](concepts/npu-model-runner.md) — 5251 行的单文件，继承上游 GPUModelRunner。按九个区读，不要从头读；每个区对应一个可以单独进入的方法。 `09`
- [NPUPlatform](concepts/npu-platform.md) — 继承上游 Platform 的那个类。vLLM 一切硬件相关的问题都问它，它还会在启动时真的改写用户给的配置。 `10`
- [NPUWorker 启动时序](concepts/npu-worker-lifecycle.md) — 从建对象到能接请求，六步固定顺序：打 patch、选卡建 runner、装权重、profile 出显存预算、分配 KV 张量、编译与捕获图。 `10`
- [算子层与自定义算子](concepts/ops-and-kernels.md) — ops/ 用 CustomOp 注册把上游算子换成昇腾实现；再往下是 torch_npu，最底下是 csrc/ 编出来的自定义 aclnn 算子，绑在 torch.ops._C_ascend 上。 `16`
- [PagedAttention](concepts/paged-attention.md) — 昇腾后端把 KV Cache 切成 128 token 的定长块，decode 时由块表指路、算子按块号跳着取 K/V；专用的 _npu_paged_attention 算子默认不启用，需手工配 pa_shape_list。 `11`
- [插件注册机制](concepts/platform-plugin-registration.md) — 装包时声明两组 entry point，vLLM 启动时扫出来：一个给平台类，四个给连接器、加载器、profiling 与模型注册。 `10`
- [Prefix Caching](concepts/prefix-caching.md) — 把已算过的 KV 块按内容哈希留在池子里，下一条请求若开头完全相同就直接复用这些块，只对不同的尾巴做前向。 `11`
- [prepare_inputs 数据流](concepts/prepare-inputs-flow.md) — 调度器给的请求集合，经 NPUInputBatch 与 BlockTable 变成算子要的四个张量；槽位由一个 Triton kernel 算出来。 `09`
- [Recompute CPU Offload](concepts/recompute-cpu-offload.md) — PD 分离的 Decode 节点抢占请求时，把它已算好的 KV 块从 HBM 拷到锁页 CPU 内存里存着，恢复时再拷回来，避免整条请求被打回 Prefill 重算。 `11 12`

## 参数（param）
- [combine_quant_mode](params/combine-quant-mode-2a3f7cd47997.md) — combine_quant_mode 的静态定义，正文待补。
- [enable_async_exponential](params/enable-async-exponential.md) — 把采样用的指数分布随机数提前挪到副 stream 上生成，与本步 model forward 重叠；v0.23.0 默认关闭并已标记待废弃，main 上已整体删除。 `19`
- [enable_force_eplb](params/enable-force-eplb-b7ec3661121f.md) — enable_force_eplb 的静态定义，正文待补。
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md) — 把 RowParallelLinear 的「矩阵乘完再 AllReduce」换成 MC2 融合算子 npu_mm_all_reduce_base，让通信藏进计算里；v0.23.0 有，main 已整体移除。 `13`
- [enable_pcp_o_proj_weight_sharding](params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md) — enable_pcp_o_proj_weight_sharding 的静态定义，正文待补。
- [enable_sleep_mode_extra_cleanup](params/enable-sleep-mode-extra-cleanup.md) — sleep 时额外销毁 HCCL 通信域并清空 ACL 图工作区，把更多显存还给训练进程；默认关闭，因为唤醒要重建通信域并重新捕获图。 `19`
- [enable_super_kernel](params/enable-super-kernel-ce990e186bfa.md) — enable_super_kernel 的静态定义，正文待补。
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md) — 把 Linear 的 matmul、TP AllReduce、残差加法与 RMSNorm 融成一个算子；因与序列并行争抢同一段子图而默认关闭，main 上已整体删除。 `13`
- [group](params/group-2b49ce9bdb0a.md) — group 的静态定义，正文待补。
- [kvpp_config](params/kvpp-config-0445bd352140.md) — kvpp_config 的静态定义，正文待补。
- [layer_sharding](params/layer-sharding.md) — 点名一组同构 Linear，让第 i 层的权重只存在通信组内第 i % K 张卡上，前向时异步广播取回；只能在 PD 分离的 P 节点开，main 上已整体删除。 `13`
- [mask](params/mask-e1795029cbdd.md) — mask 的静态定义，正文待补。
- [multistream_overlap_gate](params/multistream-overlap-gate.md) — v0.23.0 的 FlashComm3 门控重叠开关，把共享专家前向与 select_experts 路由挪到副流，与 MoE prepare 里的动态量化 + all-gather 并行；main 上已整体删除。 `14`
- [prefetch_ratio](params/prefetch-ratio.md) — weight_prefetch_config 下的嵌套 dict，按 attn/moe/mlp 三组、五个权重分别指定"预取权重的前百分之几"；v0.23.0 存在，main 已随整个 weight prefetch 一起删除。 `19`
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md) — 通过启动时的 profiling 调整 chunk 大小，默认关闭。main 开发主线要求 PP>1，且不能与负载均衡调度同时开启；与 v0.23 维护分支对 need_timing 的处理不同。 `12 13`
- [rank](params/rank-d6a905e66735.md) — rank 的静态定义，正文待补。
- [sfa_dcp_force_tmajor_restore](params/sfa-dcp-force-tmajor-restore-6d9c266d3ece.md) — sfa_dcp_force_tmajor_restore 的静态定义，正文待补。
- [shard_axis](params/shard-axis-036e26ba7f4b.md) — shard_axis 的静态定义，正文待补。
- [size](params/size-40a1c2ca47b8.md) — size 的静态定义，正文待补。
- [use_fused_overlap](params/use-fused-overlap-75a180fff6ab.md) — use_fused_overlap 的静态定义，正文待补。
- [use_layerwise](params/use-layerwise-b475778cd352.md) — use_layerwise 的静态定义，正文待补。
- [weight_prefetch_config](params/weight-prefetch-config.md) — v0.23.0 的 additional_config 开关，把 linear 层权重提前搬进 L2 cache，藏在 quantize / gating / SwiGLU 这些 vector 计算背后；main 上整套机制已删除，传这个键会直接报错。 `19`
- [world_size](params/world-size-bbb55aac584a.md) — world_size 的静态定义，正文待补。

## 按章节

### 10 引擎架构与插件机制
- [AscendConfig 配置系统](concepts/ascend-config-system.md)
- [Patch 机制](concepts/ascend-patch-system.md)
- [三个进程与 patch 注入点](concepts/engine-processes.md)
- [NPUPlatform](concepts/npu-platform.md)
- [NPUWorker 启动时序](concepts/npu-worker-lifecycle.md)
- [插件注册机制](concepts/platform-plugin-registration.md)
- [vLLM-Ascend 是什么](concepts/vllm-ascend-overview.md)
- [EngineCore：那个 while 循环](concepts/vllm-engine-core.md)
- [Platform：上游留给硬件的那张问卷](concepts/vllm-platform-interface.md)
- [vLLM 的形状：三个进程，两道边界](concepts/vllm-v1-shape.md)
- [vLLM 与昇腾各管什么](concepts/who-owns-what.md)

### 11 KV Cache 内存系统
- [Block Table](concepts/block-table.md)
- [KV Cache](concepts/kv-cache.md)
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
- [block 是怎么分出来的](concepts/vllm-kv-block-allocation.md)

### 12 调度
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md)
- [Recompute CPU Offload](concepts/recompute-cpu-offload.md)
- [调度器：没有 prefill 和 decode 之分](concepts/vllm-scheduler.md)

### 13 并行 I：TP / PP / DP
- [enable_matmul_allreduce](params/enable-matmul-allreduce.md)
- [fuse_allreduce_rms](params/fuse-allreduce-rms.md)
- [layer_sharding](params/layer-sharding.md)
- [动态切块配置（profiling_chunk_config）](params/profiling-chunk-config.md)

### 14 并行 II：EP / DPA / EPLB / large-scale EP
- [multistream_overlap_gate](params/multistream-overlap-gate.md)

### 16 图模式与算子
- [图模式层](concepts/graph-mode-layer.md)
- [一个算子从 Python 走到 AI Core](concepts/op-to-ai-core.md)
- [算子层与自定义算子](concepts/ops-and-kernels.md)

### 17 量化与投机解码
- [KV Cache Quantization](concepts/kv-cache-quantization.md)

### 19 性能工程
- [enable_async_exponential](params/enable-async-exponential.md)
- [enable_sleep_mode_extra_cleanup](params/enable-sleep-mode-extra-cleanup.md)
- [prefetch_ratio](params/prefetch-ratio.md)
- [weight_prefetch_config](params/weight-prefetch-config.md)

### 20 读源码
- [怎么读这个仓库](concepts/reading-vllm-ascend.md)
- [vllm_ascend 目录地图](concepts/vllm-ascend-repo-map.md)

### 00 从一次对话开始：推理到底在算什么
- [贯穿全书的那条请求](concepts/one-request.md)

### 04 Attention 深入
- [注意力后端家族](concepts/attention-backend-family.md)
- [四种注意力的代价](concepts/attention-cost.md)
- [RoPE (Rotary Position Embedding)](concepts/rope.md)

### 05 Prefill 与 Decode
- [KV Cache](concepts/kv-cache.md)
- [Prefill](concepts/prefill.md)

### 09 一次请求的硬件旅程
- [NPUModelRunner 怎么读](concepts/npu-model-runner.md)
- [prepare_inputs 数据流](concepts/prepare-inputs-flow.md)
- [一次请求的调用链](concepts/request-call-chain.md)
