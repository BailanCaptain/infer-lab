# 第 03、04 组独立内容审查

日期：2026-11-03。审查者：review_groups_03_04。此报告用于第二轮整改方案与验收，不是教学页。

42 / 42 页正文已完整阅读；相关 123 张 SVG 的全部文字标签已读。发现 3 项 P1、13 项 P2、1 项 P3。所有 P1/P2 已在审查中向主执行 Agent 发送；本审查者没有修改教学页。

## 范围与证据边界

- 逐页阅读包括首屏概念与代价、推导/算例、怎么开、版本比较和页末来源说明。全文阅读不等于逐条复核所有来源。
- 已完整读取 19 份固定 `921ccc52c6d8c9864190b981792318a489aeadf4` 的官方功能/设计文档；另完整读取 KV Pool 指南字符区间 `[0,18000)`，其余 76,611 字符未全读。此范围没有冒充 167 份官网文档全读。
- 代码按提交使用 `git show` 定位核对。旧镜像、旧 main、rc2、新官网快照分别记录，不能把新默认值回填为旧版事实。
- SVG 只验文字语义与 XML 可解析性，没有浏览器渲染/布局/交互验收；没有 NPU，所有性能与部署正确性均未实测。
- JSON 保留每页完整阅读时的 SHA-256；并行 rc2 修改后的哈希另列，最终整改需要验收最终版本。

## 逐页记录

| 页面 | 核对重点及结果 | 发现 | 阅读后有并行变化 |
| --- | --- | --- | --- |
| [ai-core](../../../wiki/concepts/ai-core.md) | Cube/Vector/Scalar、GM与片上缓冲、矩阵与搬运算例、W8A8版本边界完整核读；硬件流量与核数保留未实测边界。 | 无新增重大问题；非全事实通过 | 是 |
| [ai-qos](../../../wiki/concepts/ai-qos.md) | 服务优先级与吞吐区别、端点/交换机分步配置、恢复风险、五键至三键版本变化；对照921官方AI QoS指南全文。 | 无新增重大问题；非全事实通过 | 是 |
| [ascend-950-architecture](../../../wiki/concepts/ascend-950-architecture.md) | CV直通、NDDMA地址算例、Buffer ID、SIMD/SIMT、规格口径与A2区分；白皮书尚未重新核读。 | 无新增重大问题；非全事实通过 | 否 |
| [ascend-950-execution-interconnect](../../../wiki/concepts/ascend-950-execution-interconnect.md) | STARS/CCU与请求调度区别、URMA/UB Memory、端口复用与关键路径算例；白皮书尚未重新核读。 | 无新增重大问题；非全事实通过 | 否 |
| [hardware-devices](../../../wiki/concepts/hardware-devices.md) | 设备层级、逻辑设备/rank、TP/EP、规格峰值单位、内存池边界；发现末尾维护口吻需转为支持范围。 | G34-P2-02 | 否 |
| [device-memory](../../../wiki/concepts/device-memory.md) | 加载副本、容器与设备内存、cgroup事件不能单独定因、allocator注入/sleep差异；本轮未重新核全部外链。 | 无新增重大问题；非全事实通过 | 是 |
| [cann-hccl](../../../wiki/concepts/cann-hccl.md) | 软件/通信/链路分层、DP设备组与执行组、AI QoS与KV QoS区分；维护口吻尾段需整理。 | G34-P2-02 | 否 |
| [op-to-ai-core](../../../wiki/concepts/op-to-ai-core.md) | RMSNorm残差分支与GLM实际单参数调用、Host tiling与KV块区别、融合数据量；末尾raw过程说明需整理。 | G34-P2-02 | 否 |
| [ops-and-kernels](../../../wiki/concepts/ops-and-kernels.md) | 分派/编译/算子/kernel分层、固定GLM调用；确认MC2只限decode的误导和raw未核声明噪声。 | G34-P2-01, G34-P2-02 | 否 |
| [collective-communication](../../../wiki/concepts/collective-communication.md) | 集合通信语义与ring数据量、MC2短prefill边界、根节点算法绝对化与审计尾段。 | G34-P2-02, G34-P3-17 | 否 |
| [dynamic-chunked-pp](../../../wiki/concepts/dynamic-chunked-pp.md) | chunk等时推导、原版与rc2拟合/调度差异、DP执行组与完整MoE副本误用。 | G34-P2-02, G34-P1-03, G34-P2-04, G34-P2-14 | 否 |
| [pipeline-parallel](../../../wiki/concepts/pipeline-parallel.md) | 层分段/中间状态/批队列、跨节点启动与rank关系、源码索引副本口径。 | G34-P2-02, G34-P1-03, G34-P2-07, G34-P2-14 | 否 |
| [data-parallel](../../../wiki/concepts/data-parallel.md) | 逻辑请求分流、TP与EP通信组、DP engine边界及版本实现、维护审计尾段。 | G34-P2-02 | 否 |
| [context-parallel](../../../wiki/concepts/context-parallel.md) | PCP/DCP拆分与缓存归属、GLM固定部署开关、最新官方支持组合及版本差异。 | 无新增重大问题；非全事实通过 | 是 |
| [cpu-binding](../../../wiki/concepts/cpu-binding.md) | 完整cluster、NUMA线程/内存迁移区别、版本硬件边界对照最新指南。 | G34-P2-02 | 否 |
| [dyntra-lb](../../../wiki/concepts/dyntra-lb.md) | 块数负载启发式、暂停与抢占、单节点和MoE入口、动态阈值与最新版支持范围。 | G34-P2-02 | 否 |
| [eplb](../../../wiki/concepts/eplb.md) | 专家重排与副本算例、代价、MRV1/MRV2开关不混用、格式硬件边界；审计噪声。 | G34-P2-02 | 否 |
| [fine-grained-tp](../../../wiki/concepts/fine-grained-tp.md) | 沿DP模块分组与通信、实测不能相加、普通TP全层统一切分的错误定义。 | G34-P2-02, G34-P1-05 | 否 |
| [large-scale-ep](../../../wiki/concepts/large-scale-ep.md) | P/D实例计数、DP入口和EP专家域、MC2前提及失效官方启动片段。 | G34-P2-02 | 否 |
| [expert-parallel](../../../wiki/concepts/expert-parallel.md) | 完整专家和token分配、MC2/AllGather边界、负载/通信算例及公式口径。 | 无新增重大问题；非全事实通过 | 否 |
| [sequence-parallel](../../../wiki/concepts/sequence-parallel.md) | Megatron SP与CP区别、手算、通信载荷与调用代价、GLM四路残差。 | 无新增重大问题；非全事实通过 | 是 |
| [tensor-parallel](../../../wiki/concepts/tensor-parallel.md) | 列行配对算例、特殊复制矩阵、TP4/8/16口径和完整通信账。 | G34-P1-05 | 否 |
| [glm-5-3-flash-two-node](../../../wiki/concepts/glm-5-3-flash-two-node.md) | 固定双机完整容量/进程/启动/缓存账；发现陪跑半算力浪费及所有dispatch必跨机的绝对化。 | G34-P2-06 | 否 |
| [deepseek-serving-case](../../../wiki/concepts/deepseek-serving-case.md) | 完整核读模型专属部署：Engram 主机表/本地 DP 共享、A3 逻辑设备整除、P/D 实例与 DP 入口数；未发现新增重大问题，未再次全读 DeepSeek 原教程。 | 无新增重大问题；非全事实通过 | 否 |
| [block-table](../../../wiki/concepts/block-table.md) | 完整核读块表/slot mapping、GLM 五组表大小与拷贝字节、CPU/GPU 分工；134 KiB 推出关键路径可忽略没有 profiling。 | G34-P2-02, G34-P2-09 | 否 |
| [kv-cache](../../../wiki/concepts/kv-cache.md) | 完整核读 K/V 与递推状态区别、每层/每卡字节、物理页与有效数据差异；未发现新的计算错误，清理维护口吻。 | G34-P2-02 | 否 |
| [kv-cache-cpu-offload](../../../wiki/concepts/kv-cache-cpu-offload.md) | 完整核读异步保存/加载生命周期、prefix 命中、块粒度、预算与手工上限；对照 921 指南全文，保留源码与官方旧例预算口径差异。 | G34-P2-02 | 否 |
| [prefix-caching](../../../wiki/concepts/prefix-caching.md) | 完整核读前缀哈希链、整块命中/部分尾块、完整命中回退一个位置与混合状态限制；无新增重大问题，期间有并行 rc2 改动。 | 无新增重大问题；非全事实通过 | 是 |
| [swa-bounded-replay](../../../wiki/concepts/swa-bounded-replay.md) | 完整核读窗口保留/重放、元数据与 KV 生命周期、示例边界；未发现新增重大问题，未声称所有底层源码逐行复核。 | 无新增重大问题；非全事实通过 | 否 |
| [kv-cache-memory-profiling](../../../wiki/concepts/kv-cache-memory-profiling.md) | 完整核读预跑/权重/非 PyTorch/图/显式预算账；源码确认跳过 attention/KDA，但“只会低估且最多一层”界限不成立。 | G34-P2-02, G34-P2-10 | 是 |
| [kv-cache-layerwise-offload](../../../wiki/concepts/kv-cache-layerwise-offload.md) | 完整核读层间缓冲复用、传输/计算等待、P 侧流水与 D 侧 sparse 区别；对照最新指南和设计全文，需补新版本支持入口。 | G34-P2-13 | 是 |
| [kv-cache-sparse-offload](../../../wiki/concepts/kv-cache-sparse-offload.md) | 完整核读主机全历史与设备热缓冲、索引查找与复制路径、TP 共享/DP 隔离预算；修完整模型副本称呼，补 921 新默认/互斥/950 边界。 | G34-P2-02, G34-P1-03, G34-P2-13, G34-P2-14 | 否 |
| [kv-cache-spec](../../../wiki/concepts/kv-cache-spec.md) | 完整核读各种 cache spec、对齐/填充与统一块池、Mamba 状态结构和混合分组；无新增公式错误，正式正文的维护来源串需整理。 | G34-P2-02 | 否 |
| [kv-pool](../../../wiki/concepts/kv-pool.md) | 完整核读池键/命中/加载/写回、backend、命名空间、DP/TP/PP 兼容；补最新 strided MLA 格式迁移、tenant 与 SSD prefetch 部署边界。 | G34-P2-02, G34-P1-15, G34-P2-16 | 是 |
| [kvpp](../../../wiki/concepts/kvpp.md) | 完整核读 owner 常驻/暂存预算、广播就绪/等待时序、性能表与版本支持；修 PP 隐藏向量绝对化和 DP 副本口径，补新 pooling/组合边界。 | G34-P2-02, G34-P1-03, G34-P2-07, G34-P2-13, G34-P2-14 | 否 |
| [lmcache](../../../wiki/concepts/lmcache.md) | 完整核读 scheduler/worker 分工、异步加载返回、混合状态/依赖边界及部署示例；无新增重大问题，未全读外部 LMCache 项目文档。 | 无新增重大问题；非全事实通过 | 是 |
| [mooncake-connector](../../../wiki/concepts/mooncake-connector.md) | 完整核读握手/块地址/实际读写/TP 不对称、Mamba 单状态与两种状态张量；源码确认单状态规则并发现 PD 页陈旧口径，需补 D2RH 导航。 | G34-P2-02, G34-P2-13 | 否 |
| [pd-disaggregation](../../../wiki/concepts/pd-disaggregation.md) | 完整核读分阶段权衡、普通/混合请求交接点、P/D 实例卡数和块预算、各连接器；首屏分块/MTP 边界、MC2、KDA 实际传输及新 D2RH 入口待修。 | G34-P2-01, G34-P2-02, G34-P2-08, G34-P2-12, G34-P2-13 | 是 |
| [recompute-cpu-offload](../../../wiki/concepts/recompute-cpu-offload.md) | 完整核读抢占同步 D2H 与恢复 H2D、预算按 world size、版本改名/多组限制；正文先重分块号正确，SVG 相反，已核 worker 原始注释。 | G34-P2-02, G34-P2-11 | 否 |
| [recompute-scheduler](../../../wiki/concepts/recompute-scheduler.md) | 完整核读退回 P 的状态转换、DP token 同步变化、支持约束和固定部署预算；首屏 prefill 一次算完需限定，维护说明移出。 | G34-P2-02, G34-P2-12 | 否 |
| [ucm](../../../wiki/concepts/ucm.md) | 完整核读内部适配接口、外部实现边界、部署依赖及与池/PD 的区别；保留未读取外部 UCM 实现的能力边界，去维护过程描述。 | G34-P2-02 | 是 |
| [vllm-kv-block-allocation](../../../wiki/concepts/vllm-kv-block-allocation.md) | 完整核读 free queue/refcount/hit/evict、窗口与 KDA 块、waiting/running 准入；原始源码核实 remove_skipped 先行和 Mamba 本步命中依赖，移除草稿未核噪声。 | G34-P2-02 | 否 |

## 发现与最小修法

### G34-P2-01 · 把 MC2 定义为纯 decode/小批量 decode 路径。

**级别：P2。位置：** ops-and-kernels.md:144,174; pd-disaggregation.md:316。

**影响：** R1 的 4 token 短 prefill 也可选择 MC2，错误定义会导致对混合批调度和通信路径的错误预测。

**原始证据/复核入口：**

- `vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L239-L252`
- `wiki/concepts/tensor-parallel.md:302`

**最小修法：** 按每卡专家数、EP 规模和实际对齐 token 数表述条件；短 prefill 可走 MC2，链接唯一参数/请求账。

### G34-P2-02 · 正式教学正文仍反复显示本轮、raw 归档、草稿转述、来源第几行、未独立核验等维护过程。

**级别：P2。位置：** 各页正式正文末尾证据/待核段；具体例：ops-and-kernels.md:193,195,205,215；vllm-kv-block-allocation.md:359-367。

**影响：** 读者承担审计过程噪声，且旧的未核状态与已存在的原始证据互相打架；单删免责声明又会把不确定结论变成无依据断言。

**原始证据/复核入口：**

- `docs/wiki-writing-standard.md`
- `vllm@0fc695fc:vllm/model_executor/custom_op.py#L174-L207`
- `vllm-ascend@db701c1f:vllm_ascend/ops/fused_moe/token_dispatcher.py#L110-L113,L225-L238,L329-L340`
- `vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L375-L398`
- `vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1063-L1072`

**最小修法：** 把过程记录移入 reviews；在教学页保留有用的版本、前提、未实测边界和直达原始来源。已实际核对的 CustomOp、dispatch/combine 版本判断、remove_skipped 与 Mamba 同步依赖可改为直接事实；其余逐条核证，不能无证据升级。

### G34-P1-03 · 把一个 DP 执行组无条件当成独立、完整的模型副本。

**级别：P1。位置：** dynamic-chunked-pp.md:268；pipeline-parallel.md:350 的来源说明；kv-cache-sparse-offload.md:196,214；KVPP 的 DP 副本称呼。

**影响：** GLM TP8/DP2/EP16 中专家跨两组分片，两台合起来才有一份完整专家集；按副本理解会错误规划 PP 变体、卡数和专家内存。

**原始证据/复核入口：**

- `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1454-L1459,L1493-L1500`
- `wiki/concepts/glm-5-3-flash-two-node.md:94,148`
- `wiki/concepts/pd-disaggregation.md:354-L358`

**最小修法：** 通用口径改为 DP 请求执行组/一组参与计算的设备；明确无跨 DP EP 时才可称完整副本。CPP 16 卡变体写每组设备从 8 到 16、DP 组数从 2 到 1，并另核 EP 分布。SVG 仅改误用标签，不改整体布局。

### G34-P2-04 · 旧基线公式 a*C*(C+H)+b*(C+H)+c 未与 rc2 新公式区分，异步限制容易跨版本套用。

**级别：P2。位置：** 拟合公式及 v0.30.0rc2 比较段；旧末尾“无异步版本”。

**影响：** 照旧公式解释 rc2 会误解校准点、拟合自变量和求根行为；同页版本支持互相冲突。

**原始证据/复核入口：**

- `vllm-ascend@7d825229:vllm_ascend/core/profiling_chunk_predictor.py#L166-L205,L245-L255,L350-L362`
- `vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_profiling_chunk.py#L35-L140`
- `official@921ccc52:user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md`

**最小修法：** 保留旧基线推导并显式标版本；rc2 新式是 a*C*(C+H)+b*C+c，NNLS；异步限制按执行器/版本列出，不能写全版本无异步。

### G34-P1-05 · 把普通 TP 讲成所有模块/所有权重都按统一 TP 规模切片。

**级别：P1。位置：** fine-grained-tp 首屏普通 TP 定义；tensor-parallel.md:487；wiki/diagrams/fine-grained-tp-intuition.svg 末尾标签。

**影响：** 这是首屏基础概念错误；GLM 中存在 disable_tp 的低秩输入和 ReplicatedLinear，后面的容量账又明确保留复制，读者无法形成一致模型。

**原始证据/复核入口：**

- `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1918-L1924,L1935-L1940`
- `wiki/concepts/tensor-parallel.md:488`

**最小修法：** 改成普通 TP 为支持切分的算子提供组，模块可切分、复制或使用特殊分组；fine-grained TP 是按指定模块另定分组。修 SVG 单条标签。fine-grained-tp-flow 的旧开关组合/报错语义标旧基线，避免冒充 rc2。

### G34-P2-06 · 请求只够一组时“一半算力白烧”；MoE dispatch/combine“一定走机间链路”。

**级别：P2。位置：** glm-5-3-flash-two-node.md:381-L382。

**影响：** 跨 DP 的 EP 专家仍可能为另一组真实 token 工作；只有目的专家跨机器的数据需走机间链路，不能从请求数得出固定浪费比例。

**原始证据/复核入口：**

- `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1454-L1459,L1493-L1500`
- `wiki/concepts/expert-parallel.md:436-L444`
- `wiki/concepts/glm-5-3-flash-two-node.md:148`

**最小修法：** 改成空闲请求组也有 dummy/补齐开销，同时可能承接真实专家计算；代价需量测。按远端专家目的地描述跨机流量，不给无证据百分比。

### G34-P2-07 · KVPP 对照表仍说 PP 段间只交接隐藏向量。

**级别：P2。位置：** kvpp.md:152；pipeline-parallel-split.svg 的交接标签。

**影响：** 与用户明确要求废弃的说法完全相同，掩盖 residual 等模型相关中间状态，并影响通信量估算。

**原始证据/复核入口：**

- `wiki/concepts/pipeline-parallel.md 的模型相关中间状态说明`
- `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2212-L2241,L2263-L2319`
- `official@921ccc52:user_guide/feature_guide/pipeline_parallel.md:1-L20`

**最小修法：** 统一为下一段继续计算所需的中间状态；示意图若只画隐藏向量，在图注限定此简化示例。保留具体 GLM 图中已逐项核定的张量。

### G34-P2-08 · 把 KDA 每请求为 MTP 保留的 4 块当成 PD 原样全读的传输块。

**级别：P2。位置：** pd-disaggregation.md:488；递推组“块照原样传”段。

**影响：** 调度元数据的所有块号不等于网络实际读的字节，错误上界会扩大 KDA 传输预算。

**原始证据/复核入口：**

- `vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L864-L888`
- `wiki/concepts/mooncake-connector.md 的 Mamba/KDA 单当前状态传输说明`

**最小修法：** 说明传输索引 len(remote_blocks)-num_speculative_blocks-1 选当前状态，远端单状态映射本地首槽；缓存分配的候选块与实际传输分开记账，复用 Mooncake 页字节推导。

### G34-P2-09 · 由约 134 KiB 拷贝和槽位操作量推断两者“不在关键路径占多少时间”。

**级别：P2。位置：** block-table.md:258,327。

**影响：** 没有链路/同步/调度 profiling，少量字节及可重叠不证明开销可忽略。

**原始证据/复核入口：**

- `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L835-L837`
- `wiki/concepts/block-table.md:327 明确没有 profiling`

**最小修法：** 保留字节账和提前拷贝以重叠 CPU 工作的事实；改为实际是否落在关键路径、占多少需 trace 测量。

### G34-P2-10 · 断言 profile 峰值“只会偏低不会偏高”“最多偏一层的量”。

**级别：P2。位置：** kv-cache-memory-profiling.md:192,221,229 及证据尾段。

**影响：** 固定 dummy 形状不是任意真实负载的单调下界；跳过分支还可能关联持久副本、缓冲和异步生命周期，未证明统一一层上界。

**原始证据/复核入口：**

- `vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1660-L1666`
- `vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L487-L489`
- `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3683-L3696`
- `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L537-L590`

**最小修法：** 保留 profile 确实跳过的分支和漏记运行时分配风险；删除没有证明的方向/数量界，按实际形状和 allocator/stream 生命周期量峰值。

### G34-P2-11 · 图写“拷完 3 块，才把块号给 C”，正文却正确写调度器可同一步先复用块号。

**级别：P2。位置：** wiki/diagrams/recompute-cpu-offload.svg:90。

**影响：** 把逻辑分配顺序与物理字节覆盖顺序混淆，读图会得到相反的同步保障。

**原始证据/复核入口：**

- `vllm-ascend@db701c1f:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/worker.py#L134-L151`
- `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1984-L1989`
- `wiki/concepts/recompute-cpu-offload.md:157`

**最小修法：** 只改标签为可先重分块号，新数据写入前拷完；保留现有图结构与正文。

### G34-P2-12 · 把 P 的 prefill 定义为整段提示词一次前向算完，decode 定义为总是一步一个 token。

**级别：P2。位置：** pd-disaggregation.md:182 及前置概念；recompute-scheduler.md:106；pd-intuition.svg 示例图注。

**影响：** 首屏定义遗漏 chunked prefill 与投机解码，和本站后文实际 GLM 调度冲突。

**原始证据/复核入口：**

- `official@921ccc52:user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md`
- `wiki/concepts/pd-disaggregation.md:318 的每请求 4 token 步`
- `wiki/concepts/dynamic-chunked-pp.md 的分块解释`

**最小修法：** 定义为 P 负责处理提示词，可分多步；普通自回归 decode 每步确认下一 token，MTP 等可一次处理候选。4 token 图只需标这是未分块示例。

### G34-P2-13 · 官网已扩展 D2RH、稀疏 offload 默认值/互斥、KVPP layerwise pooling，现有旧基线/rc2 页没有足够入口。

**级别：P2。位置：** 缺少新的官方能力导航与角色/版本支持边界。

**影响：** 读者会把旧能力当最新全集，或把新能力/默认值倒灌到 db701/rc2；不能据协议支持 950 就认为 sparse offload 支持 950。

**原始证据/复核入口：**

- `official@921ccc52:developer_guide/Design_Documents/disaggregated_prefill.md:65-L95`
- `official@921ccc52:user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md:127-L160`
- `official@921ccc52:user_guide/feature_guide/kvpp.md:23-L54,L133-L151`

**最小修法：** 添加固定 921 版本入口并链接权威主题页：D2RH 两跳 P HBM→D DRAM→D HBM；sparse 在该快照不支持 950、与 PreemptOffload 互斥、Copy-SFA buffer 约束；KVPP eager/PIECEWISE、投机方法和 MultiConnector 子角色、实验性 Mooncake layerwise load_async=false 与已验证范围。不能覆盖旧版本事实。

### G34-P2-14 · 只说明 PP 能开及叠加特性，缺少最新指南的 RoCE 跨节点 MoE PP/DP 互斥和 KVPP 正确性限制。

**级别：P2。位置：** 最新 PP 组合支持与部署限制入口缺口。

**影响：** 数学上设备数足够不等于该通信路径支持；缺少角色边界会把 P 侧可用能力套到 D 侧。

**原始证据/复核入口：**

- `official@921ccc52:user_guide/feature_guide/pipeline_parallel.md:304-L305,L436-L454`
- `official@921ccc52:user_guide/feature_guide/kvpp.md:141-L145`
- `official@921ccc52:developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md`

**最小修法：** 注明该最新快照下跨节点 RoCE MoE 要保持 PP 或 DP 为 1；PP+KVPP 有间歇 e2e 输出不一致在调查。Sparse+layerwise 的 PP 支持与 D 侧 PP 限制按角色列出，不能武断称官网矛盾或全部组合支持。

### G34-P1-15 · 相同总字节数不保证旧池对象和新 physical-page-major bulk 对象兼容；现有页未提供该升级约束。

**级别：P1。位置：** KV Pool 版本升级/兼容条件缺少 strided MLA 对象格式迁移。

**影响：** 混用持久化 KV 格式可能加载错误状态；重启 worker 不会自动清理旧池对象，属于实际升级正确性风险。

**原始证据/复核入口：**

- `official@921ccc52:user_guide/feature_guide/kv_cache_pool_ascend_store.md:55-L63`

**最小修法：** 增加明确固定快照的升级边界：所有读写端一起升级，清除受影响对象或换 namespace/cache_salt；bulk 新格式也不与 layerwise/不同布局读端混用。旧版解释保留并标范围。

### G34-P2-16 · 现有池配置介绍未包含新 tenant strict mode 与 SSD prefetch 所改变的行为。

**级别：P2。位置：** KV Pool 新部署配置的 tenancy/SSD prefetch/TransferEngine 范围。

**影响：** 仅设置 tenant_id 不构成隔离/认证；开启 prefetch knobs 后不能继续假定 Store 与 PD 总共享同一 TransferEngine。

**原始证据/复核入口：**

- `official@921ccc52:user_guide/feature_guide/kv_cache_pool_ascend_store.md:137-L154,L213-L216`

**最小修法：** 最新版本补充：strict master 未开启时 tenant_id 被忽略；tenant 不是身份认证；SSD prefetch 与 offload 分离、依赖 ExistOptions、缺失时警告回退；config-dict setup 会另建 Store engine。独立小节链接，勿覆盖旧代码的全局引擎解释。

### G34-P3-17 · 用“通信库不会先集中一张卡再发”绝对化所有 All-Reduce 实现。

**级别：P3。位置：** collective-communication.md:201 附近算法说明。

**影响：** 集合通信规定结果语义，不规定唯一拓扑/算法；把 ring 示例当成库级保障。

**原始证据/复核入口：**

- `wiki/concepts/collective-communication.md 的 ring 算例与 All-Reduce 定义`

**最小修法：** 限定为本节 ring 示意不需要先集中到一张卡；具体算法由实现/拓扑/消息量选择。本条没有声称发现当前 HCCL 实际使用中央汇总。

## 官方阅读记录

下列路径均相对固定官方快照的 `docs/source/`；完整文件哈希在相邻 JSON。

- 全文：`user_guide/feature_guide/Ai_QoS_introduction_en.md`。
- 全文：`user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md`。
- 全文：`developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md`。
- 全文：`developer_guide/Design_Documents/context_parallel.md`。
- 全文：`user_guide/feature_guide/context_parallel.md`。
- 全文：`user_guide/feature_guide/cpu_binding.md`。
- 全文：`user_guide/feature_guide/dyntra_lb.md`。
- 全文：`user_guide/feature_guide/expert_parallelism_load_balancer.md`。
- 全文：`user_guide/feature_guide/large_scale_ep.md`。
- 全文：`user_guide/feature_guide/kv_cache_cpu_offload.md`。
- 全文：`user_guide/feature_guide/layerwise_and_sparse_kv_cache_offloading.md`。
- 全文：`developer_guide/Design_Documents/kvpp.md`。
- 全文：`user_guide/feature_guide/kvpp.md`。
- 全文：`developer_guide/Design_Documents/disaggregated_prefill.md`。
- 全文：`user_guide/feature_guide/mooncake_hybrid_attention.md`。
- 全文：`user_guide/feature_guide/preempt_offload_connector.md`。
- 全文：`user_guide/feature_guide/mooncake_layerwise_adaptation_and_optimization.md`。
- 全文：`developer_guide/Design_Documents/layerwise_and_sparse_kv_cache_offloading.md`。
- 全文：`user_guide/feature_guide/pipeline_parallel.md`。

- 部分：`user_guide/feature_guide/kv_cache_pool_ascend_store.md`，字符 `[0,18000)`，共 94,611 字符。覆盖引言、支持矩阵、strided MLA 格式升级、Mooncake 环境/参数、SSD prefetch、tenant 与启动脚本开头。

## 保留的有效解释与验收重点

- 保留原来的矩阵/缓存字节手算、PP 气泡示意、DP 与 EP 分工、混合状态交接、KVPP owner/临时缓冲算例；仅修概念定义、支持范围及错误标签，不重做已认可布局。
- 普通 TP 允许复制分量，DP 执行组不必是完整 MoE 副本；这两个基础口径必须先统一，再验容量与设备乘法。
- 不把“未实测”全部删掉：实际时延、峰值、收益、组合部署仍需保留测量边界。删的是维护过程，不是事实限制。
- 新官网 PP 与 sparse 的角色差异不能直接称为矛盾：P 侧 PP 支持不证明 D 侧 PP 支持。KVPP 的组合声明也不等于 layerwise pooling 已覆盖同样的验证拓扑。
- 新官网 PreemptOffload 指南仍可能沿用 DP 除数示例，而固定代码按 world size 预算；保留本站已按代码纠正的口径，不能照抄指南回退。
- 硬件白皮书、外部 LMCache/UCM 实现及 167 份官方材料中未列出的文档不在本审查者的完整阅读声明内。

报告的机器可读逐页哈希、图标签范围、官方源哈希和问题字段见 [groups-03-04.json](groups-03-04.json)。

## 整改结果与待独立验收

主执行 Agent 授权后，本审查者按上述发现修订了 32 页与 6 张图的 YAML；SVG 已按现有生成器同步。没有改项目代码，没有重做图布局。这里是整改自查记录，不能代替 root 对 3 项 P1 的独立复审。最终文件清单和 SHA-256 见 JSON 的 remediation 字段；原始全读哈希仍保留。

| 发现 | 已写入的修订与定位 |
| --- | --- |
| G34-P1-03 | dynamic-chunked-pp 的 16 卡变体改为 DP 执行组设备数，明确 EP 专家跨组；pipeline-parallel 来源表及 sparse offload、KVPP 正文/流程图统一口径 |
| G34-P1-05 | fine-grained-tp 首屏改为算子可分片或复制，保留 DP4 分模块算例；tensor-parallel 常见误解同步；fine-grained-tp-intuition 图标签及 flow 图旧基线说明同步 |
| G34-P1-15 | kv-pool 版本差异新增 strided MLA 的旧连续/分量优先/物理页优先格式边界，明确统一升级、换命名空间或清对象、单重启无效和逐层读端隔离 |
| G34-P2-01、06 | MC2 选路按专家布局与 token 容量；空闲 DP 组仍可能承接有效专家工作，跨机流量按远端目的地描述 |
| G34-P2-02 | 维护核验过程改为直接事实、来源对应和有用的支持/测量边界；CustomOp、Mamba 同步依赖与 remove_skipped 已回到原始代码，不再显示“草稿转述未独立核验” |
| G34-P2-04 | 保留旧 CPP 公式，rc2 单列非负最小二乘与 b·C；旧同步限制不覆盖 rc2 异步变体 |
| G34-P2-07、08 | PP 交接改为模型相关中间状态；KDA 保留块号元数据与 worker 单当前状态传输分开记账 |
| G34-P2-09、10 | 保留块表字节账、预跑跳过分支与容量例；去除无 trace 的关键路径结论及无证明的峰值方向/单层上界 |
| G34-P2-11、12 | 抢占图改为新数据覆盖前完成拷贝；PD 首屏明确可分块与多候选 decode，直觉图限定简化示例 |
| G34-P2-13、14 | 新官网单列 D2RH 两跳、sparse 默认/950/互斥、KVPP 实验组合及 RoCE PP/DP 限制；不覆盖旧基线/rc2 有效解释 |
| G34-P2-16 | KV Pool 新版操作表补租户/SSD 预取、D 写回、SSD rank 目录与容量、IPC/TCP 端口区别、Memcache 独立存储及 Yuanrong 联动条件 |
| G34-P3-17 | All-Reduce 结果语义与 ring 示例分开，不再断言通信库永不使用根节点式实现 |
| root 独立复审追加 | fine-grained-tp 的 1/k 改成相同工作量、理想一次读取的矩阵字节预算，保留缓存/重复读取/批次/通信以及 embedding 仅查选中行的区别 |
| root 独立复审追加 | Memcache 的 force_new_disk=true 明确每次清盘并要求可清理的专用缓存设备；同版不提供故障恢复保证，关闭清盘不证明旧缓存可安全恢复 |

有效解释保留：PP 气泡与层分段例、TP 列行配对、DP/EP 分工、KDA/MLA 字节账、KVPP owner 与两个暂存区算例、PD 交接点、offload 同步/异步恢复状态均保留。旧版本的启动条件、失败分支及性能数据仍按原提交列出；新增官网条件单列，不用较新快照改写旧算例。设备内存页曾列“1600 GB/s、PCIe 4.0 x16”但同时承认中文表头与部署型号未核：本轮把这条未核线索留在此维护记录，教学页改为要求型号配套，不把它升级成部署事实。

验证结果：

- `pnpm check:content`：通过，registry 163 页，11 个主主题、163 篇完整且不重复。
- `pnpm wiki:diagrams` 后 `pnpm wiki:diagrams --check`：通过，331 张 SVG 与 spec 一致；现存非阻断图文建议仍有记录。此次未作浏览器视觉验收。
- `pnpm wiki:audit`：本地来源 5436 条行号有效，无无效 commit/缺文件/越界；357 个 URL 未联网验。全站仅 attention-cost 的正文角标阻断，不在本组；已通知 root。
- `pnpm wiki:lint`：全站仅 rfork-troubleshooting 指向 rfork-official-guide 的旧锚点阻断，不在本组；已通知 root。其余标记密度建议不阻断。
- 日志：`.tmp/doc-gap-2026-11-03/g34-content.log`、`g34-diagrams-final.log`、`g34-wiki-audit.log`、`g34-wiki-lint.log`。root 将对最终合并文件重新跑全站验收，以上不冒充其结果。

本审查者的 KV Pool 阅读记录仍是前 18,000 字符；root 后来完整读了该 94,611 字符指南，并提供新版部署表的余文依据。总覆盖可另计 root 完整阅读，不修改本审查者的初读声明。无 NPU 实测，UI 按本轮工具限制未打开；性能和端到端组合仍按教学页的实测边界表述。
