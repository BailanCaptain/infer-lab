# 逐句证据账本

本账本用于解释图中 `[Dxx]` 与 `[Axx]`。直接事实 `[Sxx]` 的 URL、固定 commit 和使用范围见 `SOURCE_INDEX.md`。

## 推导项 `[D]`

| ID | 出现页 | 图中结论 | 推导依据 |
|---|---:|---|---|
| D01 | 01 | TP 切 hidden/head/FFN 维，不切 layer depth 或 sequence。 | S01/S02 的层内矩阵切法；与 S04 的 layer-depth PP、S09 的 sequence CP 对照。 |
| D02 | 01/02 | 经典 dense Megatron、未启用 SP 时，Attention 与 MLP 各一次 row-parallel AllReduce，常见 2×AR/layer。 | S01/S02 的 Attention O-proj 和 MLP down-proj；限定 forward 与经典结构。 |
| D03 | 01 | 模型显存不严格除以 TP。 | S02/S03 显示仅被支持的大矩阵/heads 分片，norm、bias、少量 heads 等可复制。 |
| D04 | 02/13 | Ascend GQA 的 TP2+DCP2 公式只有 `num_kv_heads=1` 才满足。 | S12：`TP//KV_heads >= DCP`；代入 `TP=2,DCP=2`。 |
| D05 | 03 | PP stage 边界逻辑 shape 可写 `[N,H]`，物理 transport 可保持 TP-sharded。 | S04 的 stage activation 语义 + S20 的 TP lane 布局；不假设实现一定 gather 完整 H。 |
| D06 | 04 | 一条 64K 请求整体进入一个 DP engine。 | S05 的 independent request batches / per-engine scheduling；DP 没有 sequence-split 定义。 |
| D07 | 04 | 在线 DP 本地 token rows 应写 `T₀,T₁`，通常不相等。 | S05 按 engine 队列负载均衡；不同请求长度和批次自然导致不等长。 |
| D08 | 04 | DP+TP+PP 复制的是完整 TP/PP replica。 | S05 的 DP×TP 卡数与 DP replica；S04/S20 定义每个 replica 内的 TP/PP 坐标。 |
| D09 | 04 | Dense inference forward 没有训练 DDP 的 gradient AllReduce。 | S05 是 inference serving；S21 的 gradient sync 发生在 backward。 |
| D10 | 04 | DP 主要提高 aggregate concurrency/throughput，不自动缩短单请求。 | 单请求仅选一个 DP engine（D06），其计算不由另一个副本共同完成。 |
| D11 | 05 | EP 通信搬 token activation / metadata，不在每步搬整套 expert weights。 | S06/S07：expert 权重常驻 owner，dispatcher 交换 token rows。 |
| D12 | 05 | dropless Top-k 逻辑 assignment rows 为 `T×k`，每 rank 数量依路由。 | S07：每个 T token 产生 k 个 expert choices；按 destination expert 分桶。 |
| D13 | 06 | DPA 不切同一条 64K sequence/KV。 | S05/S06 的 request-level DP Attention；同请求归一个 DP engine。 |
| D14 | 06 | KV cache 按请求归属 DP engine，不沿 DP 切同请求。 | S05 的独立 KV cache + request ownership。 |
| D15 | 06 | RS→A2A→A2A→AG 是某些 DPA+TP+EP 的 layout conversion，不是 DPA 定义。 | S18 实现；S05/S06 的抽象定义没有规定这组固定 primitive。 |
| D16 | 07 | 精确措辞应是“经典 SP 不切 Attention 的跨-token 上下文依赖”。 | S08/S09：SP 只切 LN/Dropout 等非 TP 区域，进入 TP 区域用 AG 恢复布局。 |
| D17 | 07 | 一层 forward 可画 Attention/MLP 各 1×AG+1×RS，共 2×AG+2×RS。 | S08 Figure/算法给出两组同构边界；仅取 forward。 |
| D18 | 07 | 推理系统可复用 SP 布局，不改变经典机制定义。 | 经典定义来自 S08/S09；部署使用不改变 shape/collective 语义。 |
| D19 | 08 | CP=c 时 residual/local Q 为 `[S/c,B,H]`，语义上仍依赖全 S 的 K/V。 | S09 的全层 sequence shard 与 Attention KV exchange。 |
| D20 | 08 | 因果前后片段工作量不同，可用 zigzag/dual-chunk 平衡。 | causal mask 可见 key 数随 query position 增长；S15 展示 current dual-chunk 实例。 |
| D21 | 08 | CP≠Ring，zigzag 也不等于通信原语。 | S09/S10 分别描述 CP 语义与 Ring 实现；token layout 与 transport 是不同层次。 |
| D22 | 09 | SP/CP 对照表是经典 Megatron 口径，不泛化所有同名实现。 | S08/S09 的定义范围。 |
| D23 | 09 | SP/CP/PCP/DCP 不能互套 rank 数与兼容公式。 | S09 的 Megatron CP 笛卡尔积与 S12/S14 的 vLLM PCP/DCP rank 规则不同。 |
| D24 | 10 | PCP2 四块 causal 工作量约 `0.5,1.5,2.5,3.5 m²`；镜像配对两边都约 `4m²`。 | 对每个长度 m 的 query block，累加其可见 key block 数并计本块半三角；S15 给出镜像配对。 |
| D25 | 11 | PCP local Q 仍需跨 rank 的 earlier K/V。 | S11 的 Partial-Q 策略；causal mask 的全局前缀依赖。 |
| D26 | 11 | 不把 Ring 画成 Ascend current 稳定开关。 | S11 将两种策略标为 active development；S22 直接确认的是 cache-write AllGather。 |
| D27 | 12 | `B=128,D=2` 时一个 virtual block 覆盖 256 positions。 | S13 公式 `B×D`。 |
| D28 | 12 | 65,536 tokens = 512×128 blocks；DCP2 每 rank 256 blocks=32,768 positions。 | 整数除法与偶/奇 block 交错。 |
| D29 | 12/17 | position 65,536 在 `B=I=128,D=2` 时落 DCP0。 | `65,536 mod 256=0`，lane 0，rank 0。 |
| D30 | 12 | DCP 不切 layer/replica/Prefill rows。 | S12/S13 的对象是 Decode KV cache；与 S04/S05/S11 对照。 |
| D31 | 13 | GQA Decode 不需 AllGather 完整 KV。 | S13 的执行路径只收集所需 Q、计算 local KV、合并 partial O/LSE。 |
| D32 | 13 | LSE-aware merge 等价于对完整 KV 做一次 softmax Attention。 | S23 的 global logsumexp 与归一化权重公式。 |
| D33 | 13 | concat/average partial O 都不等价。 | concat 改 shape；average 忽略不同 local normalizer，违反 S23 公式。 |
| D34 | 14 | 目标几何是 16 workers，不是 32。 | S14：`TP×PP×PCP×DP = 2⁴=16`，DCP 不增加 world size。 |
| D35 | 14 | 定义按指南讲、可运行性服从 pinned runtime。 | S12/S13/S17 发生冲突；只有运行时代码实际决定启动是否报错。 |
| D36 | 15 | TP groups `{R0,R1}/{R2,R3}`，PCP groups `{R0,R2}/{R1,R3}`；权重沿 PCP 复制。 | S24 的轴顺序与 group 生成；PCP 切 token rows而非 weight。 |
| D37 | 15 | Path A 中 DP1/PP1/DCP1 分别没有请求副本、stage transfer、KV shard。 | 各 size=1，按 S04/S05/S12 的定义退化为单组。 |
| D38 | 15 | PP/DP 在 Path B 单独展示，不能强行塞进 PCP flow。 | S14/S16/S17 的 current 禁配。 |
| D39 | 16 | TP2×PP2×DP2、PCP1、DCP2 的 worker 数是 8。 | `2×2×2=8`；S14 说明 DCP 不乘。 |
| D40 | 17 | Prefill 末位 logits 产生 first generated token。 | causal LM 的 next-token 语义 + S04 最后 stage 执行 LM head/sampling。 |
| D41 | 17 | Path B 没有 PCP；64K 仍是一个 scheduler request，DCP 只改 KV ownership。 | PCP1 退化；S12/S13 定义 DCP 对象。 |
| D42 | 17 | PP1 stage 完成 sampling 后逐 token 重复 Decode。 | S04 的 stage1 output/sampling + autoregressive generation 定义。 |
| D43 | 17 | PP2 顺序穿 stage；DCP2 在每个 stage 内并行读各自 KV shard。 | S04 的 PP lane + S13 的 local KV Decode。 |
| D44 | 17 | 另一 DP replica 不参加 Req A 的 KV merge。 | S05：请求与 KV 属于选定 engine；DCP group 位于 replica 内。 |
| D45 | 18 | 用 PCP-only 与 PP/DP/DCP 候选路径拆分，保留知识但不伪造同实例。 | S14/S16/S17 证明原组合 current 不可运行；两路径各自只讲未被禁配的维度。 |

## 教学假设 `[A]`

| ID | 出现页 | 假设 | 为什么需要明确标注 |
|---|---:|---|---|
| A01 | 01 | 模型 A：Dense GQA，L32/H4096/Q32/KV8/dh128/F16384。 | 只用于 TP shape；不是已验证 checkpoint。 |
| A02 | 03 | 32 hidden layers 均分为 PP2 的 `[0,16)` 与 `[16,32)`。 | 官方保证连续分层；具体模型还需考虑 stage balance。 |
| A03 | 03 | μ0…μ3 是理想均衡的 forward-only toy micro-work items。 | 不冒充 vLLM scheduler trace 或实测 bubble 比例。 |
| A04 | 06 | world16、Attention DP4×TP4、MoE EP16。 | 用于解释 DPA rank 重组；不是 DeepSeek 官方生产规模。 |
| A05 | 10 | DualChunkSwap 工作量示意忽略 padding、kernel 差异和 chunked scheduler。 | 只解释 causal 三角为何需要镜像平衡。 |
| A06 | 13 | 教学 MQA 设 KV_heads=1。 | 让 TP2+DCP2 同时满足 S12 的 GQA 公式。 |
| A07 | 15 | 模型 B：L32/H4096/Q32/KV8/dh128，Dense GQA。 | 只用于 PCP rank/shape 推演；不保证 Ascend current backend。 |
| A08 | 15 | `64K=65,536`，一次调度展示完整 prompt。 | 排除 64,000 歧义；真实 scheduler 可能切成多次 chunk。 |
| A09 | 16/17 | 模型 C：L32/H4096/Q32/KV1/dh128，Dense MQA。 | 用户允许自定 shape；明确满足 TP2+DCP2 数学约束但不是 checkpoint。 |
| A10 | 16/17 | Stage0 `[0,16)`；Stage1 `[16,32)`+output modules。 | 用于画 PP2；真实 stage balance 要实测。 |

## Current 组合审计

目标：`TP2 · PP2 · PCP2 · DP2 · DCP2`

| 检查 | 结果 | 依据 |
|---|---|---|
| 名义 worker 数 | `2×2×2×2=16`；DCP 不再乘 | S14 |
| PCP2 × DP2 | 配置层直接失败 | S14 |
| PCP2 × PP2 | Ascend 文档与 current PCPManager 拒绝 | S04/S17 |
| PCP2 × DCP2 | Ascend current MLA/GQA backend 抛 `NotImplementedError` | S16 |
| PCP docs ↔ code | 用户指南、设计文档、HEAD PCPManager 的 backend 范围不一致 | S12/S13/S17 |
| 结论 | 只能作为正交维度的概念几何；不能标成 current 可部署拓扑 | 上述全部 |

## 使用建议

教学时先展示 `14-target-topology-audit.png`，再展示 Path A 与 Path B。不要跳过审计页直接把两条流拼成一个实例。若要改成某个发行版的“可启动命令版”，需重新锁定 release、模型、硬件、feature matrix、启动日志和准确性测试；本套图没有伪造这些尚未提供的运行证据。
