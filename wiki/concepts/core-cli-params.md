---
id: core-cli-params
title: vllm serve 核心参数全分支调优指南：显存水位、批预算 6 分支与图编译联动
type: concept
origin: direct
summary: >-
  打通 vllm serve 四大核心旋钮与单卡显存水位的联动机制，完整拆解昇腾 v0.30.0 上 max-num-batched-tokens 早退回落 2048 的 6 分支决策树与 SP+PCP 静默向上取整，并收拢图编译、调度器覆盖链与 Mooncake P/D 双实例互斥红线。
aliases:
  - vllm serve 核心参数
  - 核心参数调优
  - CLI 参数调优
  - 启动参数调优
  - 批预算全分支
  - '--max-num-batched-tokens'
  - '--max-num-seqs'
  - '--max-model-len'
  - '--performance-mode'
  - performance_mode
  - 参数静默改写
  - 参数互斥联检
  - P/D 联检工作台
chapters:
  - '06'
order: 1
sources:
  - 'vllm@ced6857a:vllm/config/cache.py#L103-L110'
  - 'vllm@ced6857a:vllm/config/model.py#L2497-L2544'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L42-L86'
  - 'vllm@ced6857a:vllm/config/compilation.py#L60-L111'
  - 'vllm@ced6857a:vllm/config/vllm.py#L1877-L1899'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2701-L2792'
  - 'vllm@ced6857a:vllm/engine/arg_utils.py#L2904-L2990'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L581-L665'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_utils.py#L2722-L2742'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3.py#L297-L308'
  - 'vllm@ced6857a:vllm/v1/worker/gpu_model_runner.py#L6523-L6534'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L231-L245'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1052-L1147'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1313-L1408'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1650-L1701'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L131-L170'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L697-L839'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1019-L1043'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L461-L475'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L601-L638'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L907-L945'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/fa3_v1.py#L42-L59'
  - 'vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2145-L2242'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L17-L34'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L558-L563'
  - 'vllm-ascend@c09d3e20:vllm_ascend/envs.py#L66-L69'
  - 'vllm-ascend@c09d3e20:docs/source/faqs.md#L146-L150'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/pipeline_parallel.md#L180-L257'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/pipeline_parallel.md#L437-L440'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/flash_attention.md#L40-L145'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L196-L208'
  - 'vllm-ascend@2c59ff10:vllm_ascend/platform.py#L274-L282'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L273-L281'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1518-L1601'
  - 'vllm-ascend@8d6180e2:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L114-L128'
  - 'vllm@ba15685a:vllm/config/cache.py#L216-L228'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: ascend-model-onboarding
    kind: builds-on
    note: 先锁死五维环境配套与权重路径，再按本页规则微调启动参数与双实例拓扑
  - to: chunked-prefill
    kind: builds-on
    note: 理解单步先扣 Decode 再分给 Prefill 的预算博弈，才能看清批预算参数对时延的影响
  - to: kv-cache-memory-profiling
    kind: builds-on
    note: 显存水位比例与试跑扣减账单在那页展开，本页聚焦四个参数如何联动挤压该账单
  - to: ascend-config-system
    kind: builds-on
    note: 理解 additional_config 的解析入口与校验时机，才能追踪跨子系统静默改写
  - to: npugraph-ex
    kind: builds-on
    note: 图模式与 static_kernel、super_kernel 的三级依赖状态机与录图开销细节见该页
  - to: pd-disaggregation
    kind: builds-on
    note: P/D 分离两侧不对称并行目标与 Mooncake 传输约束是双实例联检的架构前提
contradicts: []
updated: '2026-11-24'
---

在昇腾（Ascend）上跑通最小 `vllm serve` 命令只是起点。进入压测与上线调优时，容量、首字时延与解码吞吐由四个彼此咬合的核心旋钮共同决定：`--gpu-memory-utilization`、`--max-model-len`、`--max-num-seqs` 与 `--max-num-batched-tokens`。

如果把它们当成互不相干的开关单点拧动，最容易触发三类典型失配：

- **批预算反噬显存池**：单独调大 `--max-num-batched-tokens` 想降首字时延，会推高启动试跑的激活峰值，导致 **KV cache**（保存前文键值表示以避免重复计算的显存池）缩水。
- **水位拉满导致录图 OOM**：把 `--gpu-memory-utilization` 拉到 `0.98` 想多切块，却会在切完 KV 之后的 **ACL Graph**（昇腾图模式，预先捕获算子序列再按固定尺寸回放以省去逐算子下发开销）录图阶段直接显存溢出。
- **跨子系统组合被静默改写**：同时开启 `PIECEWISE` 图模式与 `enable_super_kernel` 时，进程不会报错，却会把融合开关静默刷回 `False`。

本文以 `vLLM Ascend v0.30.0` 配对上游 `vLLM v0.30.0` 为标准主基线，以 `Qwen3-8B`（Dense GQA，多个查询头共享一组键值头的密集模型）和 `Qwen3-30B-A3B`（MoE，每个输入 token 仅路由激活部分专家的混合专家模型）为标尺。下文依次串通四大旋钮的显存联动、`--max-num-batched-tokens` 的 6 分支求值树，以及跨子系统的静默改写与硬互斥红线。

## 四个核心旋钮怎样共同切分显存与单步预算？

容量、首字时延（TTFT，从收到请求到吐出第一个生成 token 的耗时）与解码吞吐，都绕不开这四个参数的联动。前两者卡住单卡 **显存（HBM）** 的分配上下界；后两者决定每一轮 **step**（调度、前向与采样的单次迭代）的计算形状，而计算形状又会通过启动试跑反噬显存池：

```wiki-diagram
file: core-cli-four-knobs
```

顺着上图的显存比例条，设备执行进程 **Worker**（`NPUWorker`，完整冷启动顺序见 [NPUWorker 启动](npu-worker-lifecycle.md)）会先按整卡总显存 $M_{\text{total}}$ 乘显存比例 $u$ 定出预算池 `requested_memory`。接着它跑一次假输入前向 `profile_run()`，扣掉三笔刚性开销后才切出 KV 块（逐项记账细节见 [KV cache 显存预算](kv-cache-memory-profiling.md)）：

$$M_{\text{KV}} = M_{\text{total}} \times u - \bigl(M_{\text{weights}} + M_{\text{act}}(B_{\text{tokens}}) + M_{\text{non-torch}}\bigr)$$

把式中的每一项对应回四个命令行参数，就能看清谁在挤压谁：

| 核心参数 | `v0.30.0` 默认行为 | 直接控制什么 | 调大或调小的连锁反应 |
|---|---|---|---|
| `--gpu-memory-utilization` | 源码 `CacheConfig` 默认 **`0.92`**（部分旧 FAQ 仍沿写历史值 `0.9`，生产食谱也常手传 `0.9` 多留余量） | 按整卡 OS 可见总显存 $M_{\text{total}}$ 划定实例预算上限 $M_{\text{total}} \times u$（不自动感知同卡其他进程；例如 `Ascend 910B3` 标称 64 GiB、OS 可见 `60.96 GiB`，详见 [Ascend 910B3 真机实测基线](../sources/ascend-910b3-measured-baseline.md)） | 调大可多切 KV 块；但 **ACL Graph / `npugraph_ex` 录图发生在切完 KV 之后**，录图显存与运行期波动只能吃剩余 $1 - u$ 的预算外余量，拉太满会在录图阶段直接 OOM（真机实测 `Qwen3-0.6B` 在 `u=0.90` 录 `FULL` 图即触 OOM，降至 `u=0.82` 成功） |
| `--max-model-len` | 默认取模型 `config.json` 推导上下文上限（如 `Qwen3-8B` / `Qwen3-30B-A3B` 为 `40960`；传 `-1` 按可用显存自动收敛） | 单条请求允许的「提示词 + 生成词」最大总长度；启动期在预留 1 个永久空块后，强制校验 $M_{\text{KV}}$ 至少装得下 1 条满长序列 | 不截短直接跑超长默认值时，若剩余 $M_{\text{KV}}$ 装不下 1 条 `max_model_len` 序列，引擎在接请求前即报错退出；超模型训练上限且未设 `VLLM_ALLOW_LONG_MAX_MODEL_LEN=1` 则抛 `ValueError` |
| `--max-num-seqs` | 昇腾 `vllm serve` 默认落入 **`256`**（按每个 **DP** 数据并行副本独立计数；API 进程级总排队阀门另用 `--max-num-queued-reqs`） | 单步最多并发拼入多少条序列，同时决定采样张量上界与默认图捕获档位 | 在 **chunked prefill**（分块预填充，把长提示词拆成多轮与解码混跑，见 [Chunked Prefill](chunked-prefill.md)）中，每条在跑 **decode**（逐词生成）请求每步先扣 `1` 个 token（开启投机解码草拟 $K$ 词则扣 $1 + K$ 个），高并发会压缩留给新请求 **prefill**（预填充）的剩余额度 |
| `--max-num-batched-tokens` | 昇腾 `vllm serve` 默认回落 **`2048`**（离线 `LLM` 类默认 `8192`） | 单步所有请求合计调度的 token 总上限 $B_{\text{tokens}}$，并直接决定 `profile_run()` 假输入总 token 数 | 调大能让长提示词少切几刀、显著降低 TTFT 并提高矩阵乘算术强度；但会直接推高试跑激活与算子工作区峰值 $M_{\text{act}}(B_{\text{tokens}})$，等量扣减可用 KV 池 $M_{\text{KV}}$ |

看一组单卡 **64 GiB** 运行 `Qwen3-8B`（`BF16`）的容量联动示意（仅作算账关系示意，真实读数随版本与图模式变化，以启动日志 `Actual usage` 为准）：

- **固定底座**：设驻留权重 $M_{\text{weights}} = 16.5\text{ GiB}$，非 Torch 增量 $M_{\text{non-torch}} = 1.5\text{ GiB}$。该增量已包含 **HCCL**（昇腾集合通信库）按共享域去重后的通信缓冲，启动建议值另留 `150 MiB` 安全裕度。
- **默认批预算（$u = 0.92, B_{\text{tokens}} = 2048$）**：预算池为 `58.88 GiB`（预算外留 `5.12 GiB` 给录图）。若试跑激活峰值 $M_{\text{act}} = 1.88\text{ GiB}$，可用 KV 池为 $58.88 - 16.5 - 1.88 - 1.5 = \mathbf{39.0\text{ GiB}}$。
- **猛拉批预算（$B_{\text{tokens}} = 16384$）**：若试跑激活峰值涨到 $6.38\text{ GiB}$，哪怕一条请求还没接，可用 KV 池也会立刻缩水到 **`34.5 GiB`**。

## 为什么昇腾在线服务默认批预算是 2048？拆解 6 分支求值与 SP+PCP 静默取整

很多熟悉 GPU 的开发者看到 Atlas A2/A3 单卡有 64 GiB 显存、950DT 甚至高达 128 GiB 以上，会想当然地认为 `vllm serve` 会命中上游 vLLM 为大显存卡准备的 `8192` 或 `16384` 默认档。但在 `v0.30.0` 的昇腾环境里，不显式传 `--max-num-batched-tokens` 时，**所有昇腾卡跑 `vllm serve` 默认都会退回 `2048`**。背后的完整求值链路如下图所示：

```wiki-diagram
file: core-cli-batch-tokens-tree
```

### 1. 参数解析早退：`NotImplementedError` 如何把 `device_memory` 置零

上游 `EngineArgs.get_batch_defaults()` 在解析命令行参数时，会先调用 `current_platform.get_device_total_memory()` 读取单卡总显存：若 `>= 160 GiB` 则在线与离线默认都给 `16384`；若 `>= 70 GiB`（且非 A100）则在线给 `8192`、离线给 `16384`；否则进入兜底分支。

然而在昇腾上，**命令行参数解析发生在主进程启动早期，此时 Worker 尚未拉起、`torch_npu` 尚未初始化**。过早调用底层接口读取显存，会提前触发 `torch_npu` 全局单次初始化并干扰多进程派生。因此 `v0.30.0` 的 `NPUPlatform.get_device_total_memory()` 先检查 `not hasattr(torch, "npu") or not torch.npu.is_initialized()`，满足其一时直接抛出 `NotImplementedError`。上游 `arg_utils.py` 捕获该异常后，静默把 `device_memory` 置为 `0`。

> **边界提示（自定义 Python 启动脚本）**：若外层脚本在构造 `EngineArgs` 前已提前初始化 `torch.npu`，实际命中档位应以真机开启 `VLLM_LOGGING_LEVEL=DEBUG` 后的日志 `Defaulting max_num_batched_tokens to ...` 复核为准。

### 2. 未手传参数时的 6 条顺序分支

一旦 `device_memory` 归零，当你**没有**显式传入 `--max-num-batched-tokens` 时，`_set_default_max_num_seqs_and_batched_tokens_args()` 会按严格先后顺序走完以下 6 条分支（若你手传了具体数值，则这 6 条默认推导全部跳过）：

| 执行顺序 | 触发条件 | 对 `max_num_batched_tokens`（及 `max_num_seqs`）的改写 | 典型结果示例 |
|---|---|---|---|
| **分支 1：入口基线查表** | `use_batched_dp_moe == False`（常规部署） | `vllm serve`（`OPENAI_API_SERVER`）取 **`2048`**；离线 `LLM(...)`（`LLM_CLASS`）取 **`8192`**；无上下文兜底取 `2048`（前两者默认 `max_num_seqs = 256`，兜底 `128`） | 昇腾 `vllm serve` 起步值为 `2048` |
| **分支 2：Batched DP MoE 初值** | `parallel_config.use_batched_dp_moe == True`（面向多 DP 批量同步执行 MoE 的专用低批预算路径） | 不用分支 1 查表值，直接采用 `DEFAULT_MAX_NUM_BATCHED_TOKENS_FOR_BATCHED_DP = 256` | 起步值压低为 `256` |
| **分支 3：吞吐模式翻倍** | `--performance-mode throughput` | 将所有未手传项乘 `2`：`max_num_batched_tokens *= 2`，未手传的 `max_num_seqs` 同步 `*= 2` | `vllm serve` 变为 `4096`（并发 `512`） |
| **分支 4：关闭分块预填充抬下限** | `--no-enable-chunked-prefill`（`enable_chunked_prefill == False`） | 整条提示词必须单步算完，取 $\max(\text{max\_model\_len},\ \text{当前值})$ | 若 `max_model_len = 8192`，由 `2048` 抬升至 `8192` |
| **分支 5：多模态 Prefix-LM 保底** | `is_multimodal_model` 且 `is_mm_prefix_lm`（如 Gemma 4） | 单项多模态输入不支持切块，若单项上限 `mm_min` 更大则抬升至 `mm_min` | 自动放宽以容纳单张大图/长音频 token 数 |
| **分支 6：模型总容量封顶** | 始终在默认推导末尾执行 | 取 $\min(\text{max\_num\_seqs} \times \text{max\_model\_len},\ \text{当前值})$；若 `max_num_seqs` 亦未手传，再执行 `max_num_seqs = min(max_num_seqs, max_num_batched_tokens)` | 防止短序列专用模型（如 Whisper）批预算越界 |

### 3. 后置静默取整与 `PP > 1` 抬升批预算的空间从哪来

走完上游 6 分支还不是终点。进入昇腾插件层构造 `AscendConfig` 时，如果同时开启了 **prefill context parallel**（`PCP`，`--prefill-context-parallel-size > 1`，见 [Context Parallel](context-parallel.md)）与 **sequence parallel**（`SP`，把 TP 的 `All-Reduce` 拆为 `Reduce-Scatter + All-Gather`，见 [Sequence Parallel](sequence-parallel.md)），就会触发强制对齐。无论 `max_num_batched_tokens` 是默认推出还是**命令行手传**，都会被静默向上取整到 $\text{TP} \times \text{PCP}$ 的整数倍：

$$B'_{\text{tokens}} = \left\lceil \frac{B_{\text{tokens}}}{\text{TP} \times \text{PCP}} \right\rceil \times (\text{TP} \times \text{PCP})$$

你可以换任意一组数验算：设 `TP = 8, PCP = 2`，整除粒度为 $8 \times 2 = 16$。若命令行传入 `--max-num-batched-tokens 2050`，因 $\lceil 2050 / 16 \rceil = 129$，`AscendConfig` 会打印告警并静默改写为 `2064`，确保各卡分片等长。

反过来，什么时候应该**主动把 `--max-num-batched-tokens` 调大**？单机长文压测常从默认 `2048` 调到 `4096 ~ 16384` 以吃满矩阵核。开启 **pipeline parallel**（`PP > 1`，按层段纵切模型并异步 `Send/Recv` 传激活，见 [Pipeline Parallel](pipeline-parallel.md)）后，单卡还会释放三大块显存空间，使调大批预算格外划算：
1. **层权重与 KV 减负**：`N` 层 Transformer 均摊到 `PP` 个阶段。每张卡仅常驻约 $1/\text{PP}$ 的隐藏层权重和每 token KV 缓存。
2. **前 `PP - 1` 段免除词表 Logits 峰值**：阶段 `0 .. PP - 2` 把 `lm_head`（将末层隐藏状态投影到全词表分数的输出头）替换为占位层 `PPMissingLayer`，且 `profile_run()` 跳过 `_dummy_sampler_run`（`output = None`），直接省掉全词表（如 Qwen3 `151936`）打分与采样工作区峰值。层数不能被 `PP` 整除时，vLLM 优先把余数层往前段放（或用 `VLLM_PP_LAYER_PARTITION` 手工前移），为承担 `lm_head` 的末段腾出显存。
3. **叠开动态分块流水并行（`CPP`）推荐放大 `2~4` 倍**：`v0.30.0` 开启 [`profiling_chunk_config`](../params/profiling-chunk-config.md) 后，调度器把 `max_num_batched_tokens` 当作二次耗时拟合的首块基准来求解后续等时分块。官方指南建议设为固定分块时的 **2～4 倍**（如 64K 配 `20480`、128K 配 `32768`，见 [Dynamic Chunked PP](dynamic-chunked-pp.md)）。该特性要求 `PP > 1` 且与 `enable_balance_scheduling` 互斥；若填的 `min_chunk` 大于 SP 取整前的 `max_num_batched_tokens`，会被静默截断到该上限。

## 跨子系统联动：哪些组合会静默失效，哪些会直接报错？

把容量和批预算定稳后，真正的深水区在 `--compilation-config`（上游编译与图捕获配置）与 `--additional-config`（昇腾扩展字典，见 [Ascend 配置体系](ascend-config-system.md)）之间的跨模块校验。在 `v0.30.0` 中，不兼容组合有两类截然不同的结局：**硬性互斥**在启动期直接抛 `ValueError` / `AssertionError` 拦停进程；**静默改写**只打一行告警甚至不报错，悄悄把加速开关刷回 `False` 或换掉调度器：

```wiki-diagram
file: core-cli-graph-sched-matrix
```

### 1. 图模式、`FA3` 与三级图融合开关（`npugraph_ex → static_kernel → super_kernel`）

昇腾上的图执行分为外层捕获策略 `cudagraph_mode`（见 [ACL Graph](acl-graph.md)）与内层三级整图下沉优化 `enable_npugraph_ex`、`enable_static_kernel`、`enable_super_kernel`（见 [npugraph_ex](npugraph-ex.md)），二者耦合极紧：

- **三级依赖链与单开报错**：内层融合遵循单向依赖 `enable_npugraph_ex → enable_static_kernel →` [`enable_super_kernel`](../params/enable-super-kernel-ce990e186bfa.md)。若只传 `enable_static_kernel: true` 而省略 `enable_super_kernel`，`_default_super_kernel_to_static_kernel` 会**静默把 `enable_super_kernel` 补为 `true`**。反之，在 Atlas A2 / A3 / 950 上单开 `enable_super_kernel: true` 却未开 `enable_static_kernel: true`（或开 `static_kernel` 却关 `npugraph_ex`），启动直接抛 `AssertionError`。唯一例外是 **Atlas 300I DUO（`310P`）**：因硬件无 `NPUGRAPH_EX` 能力，会打告警并将三项开关**全部静默重置为 `False`**。
- **非完整图模式静默清空三项融合**：在 `NPUPlatform._setup_compile_backend` 中，只有 `FULL_DECODE_ONLY`（仅对 decode 录完整图）和 `FULL`（全路径录完整图）保留上述三项开关。一旦 `cudagraph_mode` 设为 `NONE`、`PIECEWISE`（在注意力处分段编译，要求 `CompilationMode.VLLM_COMPILE`）或 `FULL_AND_PIECEWISE`（decode 走整图、prefill 走分段图的混合模式），代码会**静默将三项融合开关全部刷回 `False`**。此外，开启 `PCP > 1` 时不支持 `FULL` 图模式。
- **`FA3`（Flash Attention 3）注意力后端与其它编译期联动**：启用 `FA3`（`AscendFAImpl`，含开启强化学习 `rl_config` 路径）时，主机侧分块逻辑不支持 `FULL_DECODE_ONLY`。配该模式会直接抛 `ValueError`，必须改配 `PIECEWISE` 或 `--enforce-eager`。另须留意三处静默行为：
  - `v0.30.0` 在 `Ascend 950` 上因暂缺 `RUNTIME_CUSTOM_OPS`，会静默禁用 `vllm_ascend_C` 自定义算子库。
  - `PassConfig.enable_sp` 与 `PP > 1` 同开且未禁用 `-rms_norm` 时，会静默向 `custom_ops` 追加 `+rms_norm`。
  - 开启 `rl_config.enabled=True`（见 [vLLM-Ascend 用于 RL](vllm-ascend-for-rl.md)）会强制把 `weight_nz_mode` 置 `0`。叠开睡眠模式（`enable_sleep_mode`）时，还会从 `PYTORCH_NPU_ALLOC_CONF` 剥离 `expandable_segments`（未开睡眠模式时后续初始化会重新追加）。

### 2. 多调度器并存时的「后写胜出」静默覆盖链

在 `additional_config.scheduler_config` 下配置扩展调度器时，系统先做前置互斥拦截，再按固定顺序赋值给同一个 `vllm_config.scheduler_config.scheduler_cls`：

- **前置硬拦截与角色门禁**：`recompute_scheduler_enable: true`（见 [Recompute Scheduler](recompute-scheduler.md)）仅服务于 **PD disaggregation**（PD 分离，见 [PD 分离](pd-disaggregation.md)）的 D 节点（`kv_role="kv_consumer"`）。单机混部或 `kv_role="kv_both"` 开启会抛 `ValueError`；P 节点（`kv_role="kv_producer"`）开启则**打告警并静默置回 `False`**。细粒度张量并行 `finegrained_tp_config` 强依赖 `recompute_scheduler_enable=True`，否则抛 `AssertionError`。`short_request_first_config`（见 [Short Request First](short-request-first.md)）禁止与 `batch_job_sched_config` 同开或用于 D 节点。`dyntra_lb_config`（见 [Dyntra LB](dyntra-lb.md)）仅限单节点 `DP > 1` 的 D 节点，与 `enable_balance_scheduling`、`profiling_chunk_config` 同开均抛 `ValueError`。
- **顺序无条件覆盖（Last Writer Wins）**：未触发上述异常时，`_setup_worker_and_scheduler` 在 `v0.30.0` 按 `dyntra_lb（未开 recompute 时）→ profiling_chunk_config → batch_job_sched_config` 依次覆盖 `scheduler_cls`。在 D 节点同开 `recompute_scheduler_enable` 与 `profiling_chunk_config` 时，生效的是 `ProfilingChunkScheduler`（内部仍兼容 `short_request_first` 等待队列）。若再开 `batch_job_sched_config`（见 [Batch-Job-Aware Scheduler](batch-job-aware-scheduler.md)），它会作为最后写入者**无声覆盖前序所有调度器**，最终只跑 `BatchJobAwareScheduler`。

### 3. P/D 分离 `MooncakeConnector`、并行拓扑与量化红线

双实例联调时，单边参数合法不代表两侧拼起来能跑，上线前须逐条核验以下跨系统硬红线（Mooncake 细节见 [Mooncake Connector](mooncake-connector.md)）：

| 联检维度 | 硬性互斥或静默改写规则（`v0.30.0`） | 排障与修正方法 |
|---|---|---|
| **`MooncakeConnectorV1` 并行约束** | D 节点（`kv_consumer`）强制要求 **`PP_D == 1`** 且 **`PCP_D == 1`**；任一实例禁止 `PP > 1` 与 `PCP > 1` 同开；跨实例头分片拉取要求 **`TP_P % TP_D == 0`** | D 节点保持单段流水（靠大 `DP + EP` 扩吞吐），并将 P 端 `TP_P` 设为 D 端 `TP_D` 的整数倍 |
| **`Mooncake + GQA + C8` 量化冲突** | `MooncakeConnector` / `V1` / `V2` 在 GQA 模型上开启 `enable_c8_quant=True` 直接抛 `ValueError`（P 端存 `bf16`、D 端分 `int8`，裸传会把 `bf16` 字节误读为 `int8`） | 改用传输前逐层量化的 **`MooncakeLayerwiseConnector`**，或关闭 C8 KV 量化；另注意 P 动 D 静混合权重量化注册名为 `W8A8_MIX`（非 `W8A8_PDMIX`），`cache_dtype="mxfp8"` 要求 `block_size` 为 `512` 倍数（自动选块静默改 `512`，手传非倍数抛 `ValueError`） |
| **`PCP` / `DCP` 与 `MRV2` 门禁** | `PCP > 1` 必须显式设置环境变量 `VLLM_USE_V2_MODEL_RUNNER=1`（不会静默自动开启，漏设直接抛 `ValueError`）；`PCP=1` 时须 `TP % DCP == 0`，`PCP > 1` 时 `DCP` 只能取 `{1, PCP, TP*PCP}`；对 GQA 模型，只要 `DCP > 1` 即要求 `TP > num_kv_heads`，叠开 `PCP > 1` 且 `DCP > 1` 时还须满足 `PCP == DCP` | 开启上下文并行前先导出 `VLLM_USE_V2_MODEL_RUNNER=1`，并核对 KV 头整除关系（Ulysses / Ring 仅为架构对照路线，仓内零启动开关） |
| **跨机 RoCE MoE 与原生 `FP8`** | 跨机 RoCE 部署 **MoE**（带 **EP** 专家并行）严禁同时开 **`PP > 1` 与 `DP > 1`**（`MoeDistributeDispatch` 不支持，且**无 Python 启动期断言拦截**，会在运行时卡死或报错）；原生分块 `FP8` 在 `950DT` 重排为 `MXFP8`（约 `1 B`/参数），在 `A2/A3` 静默反量化回 `BF16`（翻倍至约 `2 B`/参数），`310P` 不支持 | 跨机 RoCE MoE 固定 `PP=1` 或 `DP=1`；A2/A3 优先选用 ModelSlim `W8A8` / `W4A8`（`--quantization ascend`） |

准备上线命令或双实例脚本时，可直接将参数粘入下方联检工作台，对照 `v0.30.0` 同源规则库一键核出静默改写项、硬报错与待核环境变量：

```wiki-tool
tool: config-doctor
mode: full
title: vllm serve 全参数与 P/D 联检工作台
summary: 对照 v0.30.0 源码规则核验单实例或 P/D 双实例启动参数、静默改写与互斥冲突
```

## 常见误解

调参排障时最容易踩中的四组认知偏差，可对照下方「错误直觉 vs 源码真相」速查板逐一核销：

```wiki-diagram
file: core-cli-myths-vs-truth
```

- **「64 GiB / 128 GiB 的昇腾卡跟 H100 一样，`vllm serve` 默认 `max_num_batched_tokens` 是 `8192`」**：错。参数解析早于 `torch_npu` 初始化，`NPUPlatform.get_device_total_memory()` 抛 `NotImplementedError` 使 `device_memory` 归零。因此 `vllm serve` 在全系昇腾卡上默认回落 `2048`（离线 `LLM` 类才是 `8192`），长文压测应显式传 `--max-num-batched-tokens`。
- **「`--gpu-memory-utilization` 默认是 `0.9`，而且只要不超过它录图就不会 OOM」**：两半都错。首先，`v0.30.0` 源码 `CacheConfig` 默认值是 **`0.92`**（`0.9` 是旧 FAQ 历史写法或食谱保守手传值）。其次，ACL Graph 录图发生在切完 KV 块之后，吃的是剩余 $1 - u$ 的预算外显存，盲目拉到 `0.96+` 极易在录图阶段爆显存。
- **「开了 `PIECEWISE` 再把 `enable_static_kernel` 和 `enable_super_kernel` 都设成 `true` 能叠加提速」**：错。`_setup_compile_backend` 在 `NONE`、`PIECEWISE` 和 `FULL_AND_PIECEWISE` 下会把三项融合开关全部静默置为 `False`。只有 `FULL_DECODE_ONLY` 和 `FULL` 才保留三级图融合，在 A2/A3/950 上漏开 `static_kernel` 单开 `super_kernel` 会直接抛 `AssertionError`。
- **「脚本里的 `HCCL_BUFFSIZE_EP` 等环境变量在 `vllm_ascend/envs.py` 搜不到，说明是写错的废参数」**：错。仓内 Python/C++ 代码只显式读取 `HCCL_SO_PATH`、`HCCL_BUFFSIZE`、`ASCEND_HOME_PATH`、`ASCEND_RT_VISIBLE_DEVICES` 等十余个变量。其余四十余个文档出现的 `HCCL_*` / `ASCEND_*` 变量可能由底层 `libhccl.so` 或 CANN 运行时直接读取，在没有对应版本 CANN 手册证伪前应归为待核 `unknown`，不能武断当成拼写错误删除。

## 对照源码

### 怎么开

上线调优与自检实际生效值时，可对照以下标准启动模板与日志取证命令：

```bash
# 1. Atlas A2/A3 四卡调优 Qwen3-30B-A3B：显式拉高批预算 + 开启完整 Decode 图与三级融合
export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3
export PYTORCH_NPU_ALLOC_CONF=expandable_segments:True
export VLLM_LOGGING_LEVEL=DEBUG
vllm serve /path/to/Qwen3-30B-A3B-W8A8 \
    --served-model-name qwen3-30b-a3b \
    --tensor-parallel-size 4 \
    --enable-expert-parallel \
    --quantization ascend \
    --gpu-memory-utilization 0.90 \
    --max-model-len 16384 \
    --max-num-seqs 128 \
    --max-num-batched-tokens 8192 \
    --compilation-config '{"cudagraph_mode":"FULL_DECODE_ONLY"}' \
    --additional-config '{"ascend_compilation_config":{"enable_npugraph_ex":true,"enable_static_kernel":true}}'

# 2. 从启动日志核实默认批预算求值结果与显存四项实测账单
grep -E "Defaulting max_num_batched_tokens|Actual usage:|Available KV cache memory" serve.log
```

- **核验显存比例与预算外余量**：`CacheConfig.gpu_memory_utilization` 在源码中默认为 `0.92`[C1]（`faqs.md` 仍残留 `0.9` 旧文案[S27]）；`NPUWorker` 按 `total_memory * gpu_memory_utilization` 计算预算池，经 `profile_run()` 扣减权重、激活峰值与非 Torch 增量后切出 KV 块[C20]，随后才执行 `capture_model()` 录图并按 `150 MiB` 安全裕度打印 `--kv-cache-memory` 替换建议。`--max-model-len` 未传时取 `config.json` 推导值，并在预留 1 个空块后通过 `_check_enough_kv_cache_memory` 校验单条满长容量[C2][C9]。
- **核验批预算 6 分支与 `SP + PCP` 写回**：`NPUPlatform.get_device_total_memory()` 在 `torch_npu` 初始化前抛 `NotImplementedError`[C12]，使 `get_batch_defaults()` 将 `device_memory` 置 `0` 落入 `2048` / `8192` 基线[C6]，再经 `_set_default_max_num_seqs_and_batched_tokens_args()` 依次处理 `use_batched_dp_moe`、`throughput` 翻倍、关闭 `chunked_prefill`、多模态 `is_mm_prefix_lm` 与模型上限截断[C7]（自定义启动器是否提前初始化 `torch_npu` 须由真机 debug 日志确认[I]）。开启 `PP > 1` 时前 `PP - 1` 段将 `lm_head` 替换为 `PPMissingLayer` 并跳过采样试跑[C10][S28]；叠 `CPP` 时官方指南推荐将 `max_num_batched_tokens` 放大 `2~4` 倍[S31]；开启 `PCP > 1` 且 `enable_sp` 激活时，`AscendConfig` 按 `cdiv` 将其静默向上取整为 `tp * pcp` 倍数[C17]。
- **核验图模式、调度器与环境分级**：`enable_static_kernel=True` 在省略 `enable_super_kernel` 时默认联动置真，`310P` 静默全关，其余卡型缺前置单开抛 `AssertionError`[C16]；而 `NONE`、`PIECEWISE`、`FULL_AND_PIECEWISE` 会在 `_setup_compile_backend` 中将三项融合静默重置为 `False`[C14]，且 `FA3`（`AscendFAImpl`）要求 `PIECEWISE`[C22][S30]。无仓内 Python/C++ 读取点的 `HCCL_*` / `ASCEND_*` 变量（如 `HCCL_BUFFSIZE_EP`）不能排除底层 CANN 消费，统一判为待核 `unknown`[I]。

### 会报什么错

| 触发场景 | 现象（异常或静默改写） | 源码根因与修法 |
|---|---|---|
| A2/A3/950 单开 `enable_super_kernel: true` 未开 `enable_static_kernel` | 启动抛 `AssertionError: Super kernel generation requires static kernel to be enabled.` | 补齐 `enable_npugraph_ex: true` 与 `enable_static_kernel: true`，且保持 `FULL_DECODE_ONLY` / `FULL`（来源 16） |
| `FA3` 配 `cudagraph_mode: "FULL_DECODE_ONLY"` | 启动抛 `ValueError: AscendFAImpl does not support ACL graph capture with FULL_DECODE_ONLY mode.` | 改为 `"PIECEWISE"` 或传 `--enforce-eager`（来源 22） |
| `PCP > 1` 未导出 `VLLM_USE_V2_MODEL_RUNNER=1` | 启动抛 `ValueError: PCP ... is not supported by vLLM Ascend.`（不会静默代开 `MRV2`） | 启动前设置 `export VLLM_USE_V2_MODEL_RUNNER=1`[C15] |
| 多扩展调度器同时开启（如 `recompute_scheduler` + `batch_job_sched`） | 不报错，`scheduler_cls` 被后写者静默覆盖为 `BatchJobAwareScheduler`（与 `short_request_first` 同开则抛 `ValueError`） | 单实例只保留一种扩展调度策略[C13] |
| `MooncakeConnectorV1` 在 GQA 模型开 C8 KV 量化或 D 端 `PP > 1` | GQA+C8 抛 `ValueError`；D 端 `PP > 1` 触发 `AssertionError`；跨机 RoCE MoE 同开 `PP > 1` 与 `DP > 1` 无启动守卫但在运行期失败 | GQA+C8 换 `MooncakeLayerwiseConnector`[C18]；D 端固定 `PP=1`；跨机 RoCE MoE 固定 `PP=1` 或 `DP=1`[S29] |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| `get_device_total_memory` 与默认批预算 | 无条件抛 `NotImplementedError`[C32]，`vllm serve` 回落 `2048` | 仍无条件抛 `NotImplementedError`，6 分支结构与 `2048` 回落一致 | `torch_npu` 未初始化时抛 `NotImplementedError`（初始化后供 `StartPlan` 读取 `mem_get_info`）；`vllm serve` 仍回落 `2048`，保留 `SP+PCP` 整除写回 | 延续未初始化抛 `NotImplementedError` 与 `SP+PCP` 整除写回机制 |
| `gpu_memory_utilization` 默认行为 | `CacheConfig` 字段默认 `0.92` | `CacheConfig` 字段默认 `0.92` | `CacheConfig` 字段默认 `0.92`（`faqs.md` 滞留 `0.9` 文本） | 字段改为 `None`，由 `resolved_gpu_memory_utilization` 在常规模式下解析为 `0.92`（可扩展 KV 模式为 `1.0`） |
| 三级图融合与 `950` 自定义算子 | 仅 `enable_npugraph_ex` / `enable_static_kernel`，尚无 `enable_super_kernel` | 引入 `enable_super_kernel`（省略时默认跟随 `static_kernel`，`310P` 与分段图静默置假） | 迁入 `@config` 校验链，保持单开 `AssertionError` 与非完整图重置；`950 (A5)` 缺 `RUNTIME_CUSTOM_OPS` 静默禁用 `vllm_ascend_C` | `950 (A5)` 补齐 `RUNTIME_CUSTOM_OPS` 默认启用 `vllm_ascend_C`（除非设 `VLLM_BATCH_INVARIANT`） |
| 扩展调度器链与动态分块 `CPP` | 顶层 `profiling_chunk_config` 要求 `PP > 1` 并覆盖前序调度器 | 收拢至 `scheduler_config` 下（顶层同名键打印弃用告警），延续多调度器顺序覆盖 | 迁入 `@config` Pydantic 校验链，保持嵌套兼容及 `profiling_chunk` → `batch_job_sched` 依次静默后写覆盖 | **彻底移除 `profiling_chunk_config`（`CPP`，PR #21310）**，`batch_job_sched_config` 仍无条件覆盖前序调度器[C34] |
| 序列并行与原生分块 `FP8` 联动 | 早期 SP 与分块 `FP8` 适配阶段 | 延续上游 `PassConfig.enable_sp` | `PassConfig.enable_sp` 配 `PP > 1` 静默追加 `+rms_norm`；原生分块 `FP8` 在 `950` 转 `MXFP8`、在 `A2/A3` 静默反量化回 `BF16`（显存翻倍）[D] | 上游移除 `PassConfig.enable_sp`（`FlashComm1` 激活时打印 `warning_once` 告警并关闭 `quantized_all_reduce_config`）；`A2/A3` 加载原生分块 `FP8` 改为直接抛 `NotImplementedError`[C35] |

### 源码位置

以下编号一一对应页首 `sources` 列表的第 1–36 项（源码项为 `C1`–`C26`、`C32`–`C36`，官方文档项为 `S27`–`S31`）：

- 来源 1（C1）：`vllm@ced6857a:vllm/config/cache.py#L103-L110` — `CacheConfig.gpu_memory_utilization` 默认值 `0.92` 与单实例比例定义。
- 来源 2（C2）：`vllm@ced6857a:vllm/config/model.py#L2497-L2544` — `max_model_len` 默认推导、`-1` 自动适配与 `VLLM_ALLOW_LONG_MAX_MODEL_LEN` 越界检查。
- 来源 3（C3）：`vllm@ced6857a:vllm/config/scheduler.py#L42-L86` — `DEFAULT_MAX_NUM_BATCHED_TOKENS=2048`、`BATCHED_DP=256`、`DEFAULT_MAX_NUM_SEQS=128` 及 `max_num_queued_reqs` 区别。
- 来源 4（C4）：`vllm@ced6857a:vllm/config/compilation.py#L60-L111` — `CUDAGraphMode` 枚举、`requires_piecewise_compilation()` 与 `has_full_cudagraphs()`。
- 来源 5（C5）：`vllm@ced6857a:vllm/config/vllm.py#L1877-L1899` — `PassConfig.enable_sp` 与 `PP > 1` 同开时静默追加 `+rms_norm`。
- 来源 6（C6）：`vllm@ced6857a:vllm/engine/arg_utils.py#L2701-L2792` — `EngineArgs.get_batch_defaults()` 捕获异常置 `device_memory = 0` 及三档硬件查表。
- 来源 7（C7）：`vllm@ced6857a:vllm/engine/arg_utils.py#L2904-L2990` — `_set_default_max_num_seqs_and_batched_tokens_args()` 完整 6 分支顺序求值。
- 来源 8（C8）：`vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L581-L665` — V1 调度器每步先扣在跑 Decode 请求 `1`（或投机 `1+K`）token 预算。
- 来源 9（C9）：`vllm@ced6857a:vllm/v1/core/kv_cache_utils.py#L2722-L2742` — 预留 1 个永久空块后执行 `_check_enough_kv_cache_memory` 校验 `max_model_len`。
- 来源 10（C10）：`vllm@ced6857a:vllm/model_executor/models/qwen3.py#L297-L308` — 非末段 PP 将 `lm_head` 替换为 `PPMissingLayer`。
- 来源 11（C11）：`vllm@ced6857a:vllm/v1/worker/gpu_model_runner.py#L6523-L6534` — `profile_run()` 在非末段 PP 跳过 `_dummy_sampler_run`。
- 来源 12（C12）：`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L231-L245` — `NPUPlatform.get_device_total_memory()` 在 `torch_npu` 初始化前抛 `NotImplementedError`。
- 来源 13（C13）：`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1052-L1147` — `short_request_first`、`dyntra_lb`、`profiling_chunk` 异步校验及 `recompute_scheduler` 角色门禁。
- 来源 14（C14）：`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1313-L1408` — `_setup_compile_backend` 非完整图重置三项融合与 `_setup_worker_and_scheduler` 顺序覆盖链。
- 来源 15（C15）：`vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1650-L1701` — `PCP > 1` 强制校验 `use_v2_model_runner` 及 `PCP + DCP` 整除约束。
- 来源 16（C16）：`vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L131-L170` — `static_kernel` 默认联动 `super_kernel`、`310P` 静默降级与单开 `AssertionError`。
- 来源 17（C17）：`vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L697-L839` — `DSA-CP`、`CPP` 约束、`FlashComm1` 降级、`SP+PCP` 向上取整写回及 `finegrained_tp` 校验。
- 来源 18（C18）：`vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1019-L1043` — `_check_mooncake_c8_kv_cache_quant` 拦截 GQA + C8 并提示改用 `MooncakeLayerwiseConnector`。
- 来源 19（C19）：`vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L461-L475` — `requested_memory = init_snapshot.total_memory * gpu_memory_utilization`。
- 来源 20（C20）：`vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L601-L638` — `determine_available_memory` 扣减权重、激活峰值与非 Torch 增量。
- 来源 21（C21）：`vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L907-L945` — KV 分配后 `capture_model()` 录图显存统计与 `150 MiB` 裕度建议。
- 来源 22（C22）：`vllm-ascend@c09d3e20:vllm_ascend/attention/fa3_v1.py#L42-L59` — `AscendFAImpl`（FA3）拒绝 `FULL_DECODE_ONLY`。
- 来源 23（C23）：`vllm-ascend@c09d3e20:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2145-L2242` — `MooncakeConnector` 禁止 `PP > 1` 与 `PCP > 1` 同开，并断言 D 端 `PCP == 1`、`PP == 1`。
- 来源 24（C24）：`vllm-ascend@c09d3e20:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L17-L34` — 原生分块 `FP8` 在 `950` 转 `MXFP8` 与在 `A2/A3` 静默反量化回 `BF16`。
- 来源 25（C25）：`vllm-ascend@c09d3e20:vllm_ascend/utils.py#L558-L563` — `v0.30.0` 在 `950` 上静默禁用 `vllm_ascend_C`。
- 来源 26（C26）：`vllm-ascend@c09d3e20:vllm_ascend/envs.py#L66-L69` — 仓内显式注册的 `ASCEND_HOME_PATH`、`HCCL_SO_PATH` 等环境变量。
- 来源 27（S27）：`vllm-ascend@c09d3e20:docs/source/faqs.md#L146-L150` — FAQ 中保留的 `--gpu-memory-utilization` `0.9` 历史说明。
- 来源 28（S28）：`vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/pipeline_parallel.md#L180-L257` — PP 层段自动/手工划分与末段 `lm_head`/采样平衡说明。
- 来源 29（S29）：`vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/pipeline_parallel.md#L437-L440` — 跨机 RoCE MoE 禁止 `PP > 1` + `DP > 1` 及 D 端 `PP=1` 约束。
- 来源 30（S30）：`vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/flash_attention.md#L40-L145` — `FA3` 须配 `PIECEWISE` 图模式文档说明。
- 来源 31（S31）：`vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L196-L208` — 动态分块 `CPP` 推荐将 `max_num_batched_tokens` 调大 `2~4` 倍。
- 来源 32–36（C32–C36）：`v0.23.0`（`2c59ff10`）、`v0.26.0rc`（`2ed6cbba`）无条件抛 `NotImplementedError`，以及社区 `main`（`8d6180e2` / `ba15685a`）移除 `CPP`、`A2/A3` 原生 `FP8` 报错与 `resolved_gpu_memory_utilization` 演进对照。
- 推导与待核边界说明：原版浮点与分块 `FP8` 在 `A2/A3` 上驻留字节翻倍由 `fp8_block.py`（来源 24）反量化回 `BF16`（2 字节/元素）直接推出；自定义 Python 入口是否提前初始化 `torch_npu` 及零仓内读取的 `HCCL_*` / `ASCEND_*` 变量是否被特定版本 CANN 消费，需结合运行期日志与对应版本 CANN 手册实测确认。
