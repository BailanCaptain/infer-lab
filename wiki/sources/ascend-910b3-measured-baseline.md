---
id: ascend-910b3-measured-baseline
title: Ascend 910B3 真机实测与六大劣化来源基线（v0.30.0）
type: source
origin: drop
summary: >-
  归档单卡与八卡 Ascend 910B3（CANN 9.1.0、vllm-ascend 0.30.0 正式版 c09d3e20）不可变实测快照、算子与 HCCL 剖析、显存对账及六类实测劣化根因；页内引用的 main（8d6180e2）仅作局部源码对照，未做同机复测。
aliases:
  - Ascend 910B3 实测基线
  - 910B3 真机实测
  - 910B3 性能劣化根因
  - KV 整池连续化实测
  - Ascend 910B3
  - 910B3 实测
  - 910B3 基准
  - CANNLab 910B3
  - MatMulV3
  - QuantBatchMatmulV3
chapters:
  - '10'
  - '15'
order: 5
sources:
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L3-L258
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L260-L292
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L294-L703
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L705-L950
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L952-L1077
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L1079-L1390
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L1392-L1462
  - >-
    raw:sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md#L1464-L2441
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L109-L118'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L571-L586'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L660-L715'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L823-L873'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L5054-L5076'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L5884-L5931'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L279-L286'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L599-L635'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L762-L778'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L905-L928'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L373-L386'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L879-L884'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/device_op.py#L212-L224'
  - 'vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L282-L291'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_forward_context.py#L297-L315'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/moe_comm_method.py#L156-L184'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/prepare_finalize.py#L453-L465'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/fused_moe/prepare_finalize.py#L552-L569'
  - 'vllm-ascend@c09d3e20:vllm_ascend/compilation/acl_graph.py#L275-L319'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L110-L120'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_executor/warmup/nz_warmup.py#L30-L81'
  - 'vllm-ascend@c09d3e20:vllm_ascend/model_loader/rfork/safety.py#L9-L18'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L322-L353'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/attn_utils.py#L856-L888'
  - 'vllm@ced6857a:vllm/v1/worker/gpu_model_runner.py#L6888-L6932'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L2210-L2225'
verified:
  - releases/v0.30.0
evidence: M
rawSources:
  - >-
    raw/sha256-98d6d73e95b70ca222595dae1ec4a72589432e386f6e09b0ac90a1dc34696aef.md
relations:
  - to: tensor-parallel
    kind: builds-on
    note: 提供 Qwen3-8B 单卡至八卡 TP 扩展与 HCCS AllReduce 微基准实测数据
  - to: acl-graph
    kind: builds-on
    note: 提供 FULL_AND_PIECEWISE 录图显存随 TP 增长、u=0.90 捕获期 OOM 与 Eager 劣化实测
  - to: expert-parallel
    kind: builds-on
    note: 提供 Qwen3-30B-A3B 四卡 TP4+EP4 与八卡 DP2+TP4+EP8 的真权重分片和吞吐对照
  - to: pd-disaggregation
    kind: builds-on
    note: 提供 MooncakeConnectorV1 ADXL 同机 1P1D/2P2D/4P4D 闭环与短输入劣化实测
  - to: sleep-mode
    kind: builds-on
    note: 提供 level 1/2 休眠唤醒耗时、显存净残留与 weight_nz_mode 唤醒守卫报错标本
  - to: v030-release-baseline
    kind: builds-on
    note: 提供 v0.30.0 正式版在 Ascend 910B3 上的真机显存基数、配置守卫报错标本与运行期劣化实证
  - to: inference-benchmarking
    kind: builds-on
    note: 提供单卡 /v1/chat/completions 与八卡 /v1/completions 的 TTFT、TPOT、吞吐实测数据与对比口径边界
  - to: inference-performance-analysis
    kind: builds-on
    note: 提供 AI Core / Vector Core 算子微观 Profiler 占比、整池 KV Slice 热点剖析与 DEBUG 热路径开销实测
  - to: cpu-binding
    kind: builds-on
    note: 提供 192 vCPUs 八 NUMA 宿主机指纹，以及 DP=2+TP=4+EP=8 下绑核回退 global-slice 的实机观测
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: 提供 npu-smi 65,536 MB 与 acl.rt.get_mem_info 60.96 GiB 显存基数差额，以及多拓扑可用 KV 容量与录图期 OOM 实测
contradicts: []
updated: '2026-11-23'
---

## 硬件与软件基线指纹

本档案汇总 GitCode CANNLab 上单卡与八卡 `Ascend 910B3`（A2 代际）在 `vLLM 0.30.0`（`ced6857a`）+ `vllm-ascend 0.30.0`（`c09d3e20`，升级变更见 [v0.30.0 正式版升级与避坑清单](../concepts/v030-release-baseline.md)）下的全量实机采集证据；下文提及的 `main@8d6180e2` 仅用于核对 V2 源码路径演进，不包含 `main` 真机重测结果。所有原始 Profiler CSV、压测 JSON、启动显存对账日志与真实故障标本均已通过 SHA-256 完整性校验，并摘录固化于本页绑定的不可变 `raw` 快照中。

| 维度 | 实测指纹 | 阅读各页时的计量边界 |
|---|---|---|
| NPU 与可见显存 | `8 × Ascend 910B3`，`npu-smi 25.5.0` 标称 `65,536 MB` / 卡，空载板级占用 `3,426 ~ 3,453 MB`；`acl.rt.get_mem_info` OS 可见总容量 **`60.96 GiB`**，启动空闲 `60.57 ~ 60.59 GiB` | [KV cache 显存预算](../concepts/kv-cache-memory-profiling.md)公式 `total × u` 的基数是 **`60.96 GiB`** 而非 `64.00 GiB`；相差的 `3.04 GiB` 为底层预留，不可二次扣减（主机侧与设备侧容量分账另见 [主机内存、大页与 IPC 稳态](../concepts/host-memory-and-hugepages.md)） |
| 宿主机拓扑 | 八卡实例为 `192 vCPUs` `HiSilicon TaishanV110` `aarch64`（`8 Sockets / 8 NUMA`，NUMA 即非统一内存访问节点，每 Socket 24 核，`2,400 MHz` 且 `Frequency boost: disabled`，`1.4 TiB` RAM）；单卡实例暴露 `16 vCPUs`（`2 Sockets / 2 NUMA`） | 禁睿频 `2.4 GHz` ARM 核心对 Eager（单算子逐条下发）发射敏感，绑核策略见 [CPU 绑核](../concepts/cpu-binding.md)；跨单卡与八卡比较首 token 时还须区分下文输入长度差异 |
| 软件与通信栈 | `HDK 25.5.0` · `CANN 9.1.0` · `Python 3.11.4` · `torch 2.10.0` · `torch_npu 2.10.0.post7` · `vllm 0.30.0`（对照 `ced6857a`）· `vllm_ascend 0.30.0`（对照 `c09d3e20`）· `Mooncake` ADXL `AscendDirectTransport` | 四卡 `TP=4` 微基准实测走机内高速互联 `HCCS`（单次 `16 MiB` 输出张量，环网 transit `25.17 MB` @ `17.63 ~ 17.93 GB/s`），未走跨机以太网 RDMA 协议 `RoCE` |
| 基准口径差异 | 单卡 `TP=1` 使用 `/v1/chat/completions`（`24 ~ 40` prompt tokens，取 `5/8/16` 请求中位数）；八卡实验使用 `/v1/completions`（平均 `262` prompt tokens，取均值，各档完成 `128/512/2,048` 输出 tokens） | 压测指标定义见 [推理测量](../concepts/inference-benchmarking.md)：八卡内部 `TP=2 → 4 → 8` 严格同脚本同输入；单卡与八卡直接对比时，稳态 128 步 `TPOT`（每输出 token 平均时延）可对照，首 token `TTFT`（首词延迟）受输入长度影响不可混作单变量 A/B |

## 算子微观剖析与全拓扑端到端账本

在形状 `M=2048, K=4096, N=4096` 的 3 次活跃采样微基准中（瓶颈分解方法见 [性能分析](../concepts/inference-performance-analysis.md)）：

- **BF16 `AddRmsNorm`**（`AI_VECTOR_CORE / 40`）：耗时 `63.04 ~ 64.00 µs`（均值 **`63.58 µs`**），`aiv_vec_ratio` **`74.4% ~ 75.2%`**，`aiv_mte2_ratio` `18.0% ~ 18.9%`，`aiv_mte3_ratio` `26.8% ~ 27.0%`。大 token 融合残差归一化下，FP32 平方均值与倒数平方根向量算术占 AIV 主导。
- **BF16 `MatMulV3`**（`AI_CORE / 20`）：耗时 `256.12 ~ 257.10 µs`（均值 **`256.61 µs`**），`cube_utilization` **`96.82% ~ 97.01%`**，`aic_mac_ratio` **`95.4%`** 与 `aic_mte2_ratio` **`82.4%`** 并行重叠（硬件流水重叠，非互斥墙钟占比）。
- **W8A8 动态量化链**（`DynamicQuant` `AIV / 40` **`31.79 µs`** → `QuantBatchMatmulV3` `MIX_AIC / 20+20` **`195.61 µs`**，`cube_utilization` `91.17% ~ 92.85%`）：纯矩阵乘较 BF16 提速 **`1.312×`**，但未与前序归一化融合时，独立 `DynamicQuant` 的二次读写把两算子合计提速压缩至 **`1.128×`**（含 `AddRmsNorm` 整段为 `1.095×`）。
- **四卡 `TP=4` 归约微基准**：[张量并行（TP）](../concepts/tensor-parallel.md)下 `MatMulV3`（`[2048, 1024] × [4096, 1024]ᵀ`）耗时降至 **`70.57 µs`**（省约 `186 µs`），但紧随其后的 `hcom_allReduce_` 耗时 **`522.66 ~ 525.10 µs`**，通信重叠为 **`0.0 µs`**。

下表汇总全部 8 组服务态实测（`Qwen3-8B` 统一 `u=0.85`、`max_model_len=32768`；混部 `Qwen3-30B-A3B` 统一 `u=0.88`；`INFO` 干净态）：

| 模型与并行拓扑 | 权重/卡 | `non_torch` | 可用 KV/卡 | KV 总容量 (`tokens`) | 图显存 (`INFO` 耗时) | `c=1` TTFT / TPOT (`ms`) | `c=16` TTFT / TPOT (`ms`) | `c=16` 总吞吐 (`tok/s`) |
|---|---|---|---|---|---|---:|---:|---:|
| `Qwen3-8B` · `TP=1` | `15.29 GiB` | `0.03 GiB` | `36.29 GiB` | `264,192` | `2.59 GiB` (`22s`) | `73.24` / **`78.54`** | `222.17` / `80.77` | **`195.28`** |
| `Qwen3-8B` · `TP=2` | `7.66 GiB` | `0.43 GiB` | `43.52 GiB` | `633,728` | `2.92 GiB` (`32s`) | `125.84` / **`87.12`** | `467.10` / `89.94` | `171.13` |
| `Qwen3-8B` · `TP=4` | `3.84 GiB` | `0.43 GiB` | `47.36 GiB` | `1,379,200` | `3.10 GiB` (`35s`) | `124.14` / **`90.57`** | `430.48` / `92.34` | `167.30` |
| `Qwen3-8B` · `TP=8` | `1.94 GiB` | `0.44 GiB` | `49.27 GiB` | `2,869,888` | `3.21 GiB` (`36s`) | `139.07` / **`94.42`** | `515.60` / `95.73` | `160.38` |
| `Qwen3-30B-A3B` · `TP=4+EP=4` | `14.27 GiB` | `0.45 GiB` | `38.73 GiB` | `1,692,032` | `2.30 GiB` (`67s`) | `331.10` / **`77.90`** | `591.19` / `84.40` | **`179.70`** |
| `Qwen3-30B-A3B` · `DP=2+TP=4+EP=8` | `7.52 GiB` | `0.55 GiB` | `45.21 GiB` | `3,950,336` (`双 DP`) | `2.64 GiB` (`83s`) | `445.66` / **`96.36`** | `981.17` / `99.78` | `149.45` |
| `Qwen3-8B` · `2P+2D` (`Eager`) | `7.66 GiB` | — | — | — | 未录图 | `763.42` / **`150.59`** | `2,343.86` / `160.15` | `88.53` |
| `Qwen3-30B-A3B` · `4P+4D` (`Eager`) | `14.27 GiB` | — | — | — | 未录图 | `728.07` / **`307.83`** | `3,064.87` / `325.09` | `45.59` |

## 六类实测劣化的物理与源码根因

### 1. 整池 KV 非连续物化与稠密 TP=1→8 单调负扩展

在 `vllm-ascend@c09d3e20`（及 `main@8d6180e2`）中，普通 GQA（分组查询注意力）层默认分配单块共享显存 `[2, num_blocks, block_size, kv_heads, head_dim]`，通过 `torch.as_strided` 将前两维步长设为 `(H, 2H)`（每页 K 后紧跟该页 V）。单独取出 `kv_cache[0]` 与 `kv_cache[1]` 后跨页不连续，线上服务日志直接记录 `shape=(2,2064,128,8,128)`、`stride=(131072,262144,1024,128,1)`、`k_contiguous=False v_contiguous=False`。

在两份 Eager Profiler 轨迹中，Decode 阶段的 `aclnnFusedInferAttentionScoreV3` 在内部调用 `aclnnContiguous`（设备核函数 `aclnnContiguous_SliceAiCore_Slice`），无视 `block_table` 实际命中的少量历史块，**每层每步将整个已分配物理 KV 池完整复制一遍**：

- **`Qwen3-8B`（36 层，`u=0.75`，`1,678` 块）**：两个 Decode 步共触发 **`144/144` 次**整池大 `Slice`（每步 `36 × 2 = 72` 次，单次 `593.60 ~ 691.48 µs`，合计 `92.3106 ms`，占设备算子总时间 **`62.220%`**；全部 290 次 `Slice` 占 `62.463%`），两步各自耗费 **`46.1552 ms` 与 `46.1554 ms`**，每步最低读写流量达 **`58.992 GiB`**（折合有效带宽 `1.372 TB/s`）；而 108 次真正的 `FusedInferAttentionScore` 计算核函数合计仅耗时 **`2.356 ms`**。首个 Prefill 步未触发整池 `Slice`。
- **2 层裁剪 MoE（`u=0.60`，`66,139` 块）**：因空闲显存集中分给 2 层，单层 K 或 V 视图高达 `8.074 GiB`，8 次整池 `Slice` 单次耗时 **`13.45 ~ 13.67 ms`**，占设备算子总时间的 **`95.990%`**（全部 18 次 `Slice` 占 `96.012%`），直接证明该复制开销与**已分配物理块数**呈线性正比。
- **线上 `FULL` 图单卡平台期与负 TP 扩展的条件解释边界**：线上日志确认单请求 Decode 运行 `FULL` 图（`npu_fused_infer_attention_score.out`，图捕获机制见 [ACL Graph](../concepts/acl-graph.md)）。**若**图内重放同等整池连续化且保持 Eager 有效带宽（强条件外推，包内尚无线上 `FULL` 设备时间线实测），固定 `u=0.85` 将 `TP` 从 `1` 扩到 `2/4/8` 时，每卡本地 K+V 容量会从 `36.28 GiB` 反增至 `43.52 / 47.35 / 49.27 GiB`（条件外推复制耗时 `56.77 → 68.09 → 74.09 → 77.09 ms`）。再结合启用多卡 TP 时源码存在的 **72 个行并行 `AllReduce` 位置**（`0.0 µs` 重叠仅在独立 `16 MiB` 微基准中测得，线上重叠与分项时延贡献仍待实测），这组候选机制与观测到的两组现象相吻合：一是 `TP=1→8` 下 `TPOT`（`78.54 → 94.42 ms`）与 `c=16` 吞吐（`195.28 → 160.38 tok/s`）单调劣化；二是 `TP=1` 从 `c=1→16` 时 `TPOT` 仅微增 `+2.23 ms (+2.84%)`，吞吐却跃升 `15.3×`。

### 2. 4P4D / 2P2D 叠加 Eager 等配置下 MoE Decode 持续步延迟劣化 3.952×

`Qwen3-30B-A3B` 从四卡混部 [ACL Graph](../concepts/acl-graph.md) 切换到八卡 `4P4D` [PD 分离](../concepts/pd-disaggregation.md)（同时改变拆池拓扑、双端 `--enforce-eager`、`prefix_caching=False`、`max_model_len=16384` 与 `u=0.88→0.85`）后，`c=1` `TPOT` 从 **`77.90 ms` 恶化至 `307.83 ms`（`3.952×`，每步净增 `+229.93 ms`）**，`c=16` 吞吐从 `179.70` 跌至 `45.59 tok/s`；稠密 `Qwen3-8B`（`TP=2` 混部 Graph 对 `2P2D` Eager）的 `c=1` `TPOT` 从 `87.12 ms` 增至 `150.59 ms`（`1.729×`）。跨实例 KV 移交每请求只发生一次（`30B c=1` 最慢 rank 传输段仅 `16.64 ms`），其余 127 个生成步累计多出的 **`29.20 s`** 全部落在 Decode 实例的逐 token 执行路径上；纯 Eager 与纯 PD 的独立份额仍需同拓扑控制变量实验拆分。

### 3. 均匀 262-token 负载下 2P2D（8B）与 4P4D（30B）首 token 放大 6.07× / 2.20×

`0.6B` `1P1D` 仅提供 `18+40` tokens 功能闭环而无性能对照。八卡 `2P2D`（8B）与 `4P4D`（30B）在无长短混合 Prefill 干扰的 `262-token` 均匀输入 + `128-token` 输出下，P 池在运行中采样时刻全部处于 `Running: 0`（8B `8/8`、30B `7/7`），整机一半算力在漫长 Decode 期间无法分担解码。同时，示例代理串行执行 P 端 `do_remote_decode=True, max_tokens=1` 与 D 端二次建流：`8B` D 端每请求拼装 `216` 段离散块地址（`27 MiB/rank`，`c=1` 传输段 `207.49 / 346.74 ms`），且 D 端日志出现大量 `Dest buffer device_id >= endpoint count ... falling back` 回退告警（8B `4,991` 行、30B `19,941` 行）。在上述及双端 Eager 等组合条件下，观测到 `c=1` `TTFT` 为 `763.42 ms`（8B，`6.07×`）与 `728.07 ms`（30B，`2.20×`），各项独立份额待单变量对照拆分。

### 4. Qwen3-30B-A3B 扩至 DP=2+TP=4+EP=8 在 c≤16 出现负扩展

运行指标证实请求已均分至双 DP（`c=1` 为 `1/0`，`c=4` 为 `2/2`，`c=16` 为 `8/8`）；[专家并行（EP）](../concepts/expert-parallel.md)下路由专家权重精确减半（`54.000 GiB ÷ 8 = 6.750 GiB`），叠加非专家 `0.7652 GiB` 后单卡总权重由 `14.2652` 降至 **`7.5152 GiB`**（下降 `47.32%`），双引擎合计解锁 `3,950,336 tokens` KV 容量。在 A2 无 LoRA 下，`ep_world_size = 4` 与 `8`（均 `< 16`）都选 **`ALLGATHER`**，其中 `dp_size > 1` 的八卡组还须执行跨 DP gather 与 reduce-scatter，且空闲 DP 在 `c=1` 时运行 dummy batch 同步推进；`c=16` 时每 DP 仅分得 8 个并发请求，双池隔离使前缀命中率从 `25.49%` 降至 `16.99%`、[CPU 绑核](../concepts/cpu-binding.md)回退至 `global-slice`，观测到总吞吐从 `179.70` 降至 `149.45 tok/s`（单卡吞吐从 `44.93` 降至 `18.68 tok/s`；各项时延子份额待逐步通信轨迹拆分）。

### 5. DEBUG 日志热路径开销与三类启动配置陷阱

- **日志 `VLLM_LOGGING_LEVEL=DEBUG` 采样开销**：`worker.py` 每步在 DEBUG 分支读取 `torch.npu.memory_reserved()` / `memory_allocated()` 并格式化输出（`TP=8` 达 `3,312` 行，运行期环境变量与下发开销边界见 [CANN Runtime 与任务下发调优](../concepts/ascend-runtime-and-tuning.md)），配合 `acl_graph.py` 的输入 `data_ptr()` 遍历校验，使 `TP=8 c=1` 单样本 `TTFT` 从 `139.07 ms` 升至 `193.98 ms (+39.48%)`。
- **图显存随 TP 逆向增长与 `u=0.90` 捕获期 OOM**：`Qwen3-0.6B` 在 `u=0.90` 下通过 `profile_run()`（分配 `53.47 GiB` KV、`500,480 tokens`）及 35 档 `PIECEWISE` 后，在 `FULL` Decode `1/35` 的 `FIA` 内因申请 `1.98 GiB`（仅剩 `1.71 GiB`）触发 OOM（`u=0.82` 成功录图占 `3.90 GiB`）。`Qwen3-8B` 随 `TP=1→8` 每层本地 KV 视图从 `1.008 GiB` 扩至 `1.368 GiB`，捕获前后设备空闲显存差值反从 **`2.59 GiB` 递增至 `3.21 GiB`**。
- **Sleep Mode 守卫、冷启动微基准与静态量化校验**：默认 `weight_nz_mode=1` 下 BF16 普通权重本不转 NZ（昇腾分形分块格式），但 `worker.py:279-286` 在 [Sleep Mode](../concepts/sleep-mode.md) 的 `wake_up()` 中只要配置非零即抛 `ValueError: FRACTAL_NZ mode is enabled`；显式设 `weight_nz_mode=0` 后 `2.482s` 唤醒成功（较 `95.83s` 完整初始化快 `38.61×`，`npu-smi` 从 `55,740 MB` 降至 `6,211 MB`，较初始空载 `3,453 MB` 净增 `2.693 GiB`），且启用 Sleep 会使 [RFork](../concepts/rfork.md) 安全检查返回 `sleep mode` 回退默认加载。八进程并发导入预编译 `.pyc` 耗时从 `24.311s` 降至 `12.598s`（省 `11.713s`）；首次 `npu_format_cast(NZ)` 懒加载耗时 `7.1618s`（二次 `0.0007s`）。未量化 GQA 模型传 `--kv-cache-dtype int8`（参见 [KV cache 量化](../concepts/kv-cache-quantization.md)）在 `attention_v1.py:583` 直接抛静态量化权重缺失异常，而 `MooncakeConnectorV2`（`MooncakePullConnector`）在 `base_worker.py:116` 拒绝 `kv_both` 双角色。

## 对照源码

- 不可变真机摘录分节：来源 1（硬件与环境指纹）、来源 2（AI Core BF16/W8A8 微基准 CSV）、来源 3（整池 KV `Slice` 与线上非连续步长日志）、来源 4（`Qwen3-8B` `TP=1..8` 对账、基准与 `TP=4` HCCS 通信矩阵）、来源 5（`Qwen3-30B-A3B` `TP4+EP4` 与 `DP2+TP4+EP8`）、来源 6（`1P1D / 2P2D / 4P4D` 分离服务）、来源 7（Sleep Mode 与 `.pyc` / NZ 冷启动微基准）、来源 8（五份真实报错栈标本）。
- GQA 共享单块非连续 KV 分配与 `FIA` 图捕获 / Decode 视图：来源 9、11、12、13、14、21，以及 `main` V2 对照来源 32。
- 显存对账、DEBUG 分配器计数、录图安全垫与 Sleep `weight_nz_mode` 守卫：来源 15、16、17、18、19、27、30、33。
- A2 MoE `ep_world_size < 16` 选择 `ALLGATHER`、跨 DP gather/reduce-scatter 与空闲 DP dummy batch：来源 22、23、24、25、26、34。
- PD 整除断言、`MooncakePullConnector` 单角色校验、GQA 静态 C8 校验与早期 NZ 预热代际演进：来源 10、20、28、29、31。
