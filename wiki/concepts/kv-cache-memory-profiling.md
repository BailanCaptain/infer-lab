---
id: kv-cache-memory-profiling
title: KV cache 显存预算：启动时怎样一项项扣出来
type: concept
summary: >-
  每张 NPU 在启动期按「总显存 × 显存比例」划定实例预算，加载权重后通过一次最大批量的 profile run
  量出激活峰值与包含 HCCL 缓冲在内的非 Torch 增量，三项扣完后将剩余预算按每块字节数切成物理 KV 块；ACLGraph
  录图与运行期新增缓冲由预算外 1−u 余量支付，切出的块数也不等于固定并发请求数。
aliases:
  - KV Cache Memory Profiling
  - memory profiling
  - 显存探测
  - 显存量测
  - 显存预算
  - 显存容量
  - 缓存预算
  - gpu_memory_utilization
  - gpu-memory-utilization
  - '--gpu-memory-utilization'
  - kv_cache_memory_bytes
  - '--kv-cache-memory'
  - kv-cache-memory-bytes
  - '--kv-cache-memory-bytes'
  - num_gpu_blocks_override
  - num-gpu-blocks-override
  - KV 显式字节预算
  - KV 块数覆盖
  - profile_run
  - profile run
  - determine_available_memory
  - non_torch_increase
  - 非 torch 增量
chapters:
  - '05'
sources:
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L460-L496'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L566-L667'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L668-L754'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/worker.py#L879-L955'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L3909-L3923'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L4328-L4348'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L4372-L4478'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L209-L212'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L73-L77'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1241-L1288'
  - 'vllm-ascend@c09d3e20:vllm_ascend/utils.py#L1482-L1545'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/worker/patch_distributed.py#L39-L187'
  - 'vllm@ced6857a:vllm/utils/mem_utils.py#L81-L161'
  - 'vllm@ced6857a:vllm/utils/mem_utils.py#L228-L321'
  - 'vllm@ced6857a:vllm/config/cache.py#L103-L126'
  - 'vllm@ced6857a:vllm/config/cache.py#L228-L235'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L254-L320'
  - 'vllm@ced6857a:vllm/v1/engine/core_client.py#L814-L818'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_utils.py#L975-L1015'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_utils.py#L2697-L2774'
  - 'vllm@ced6857a:vllm/v1/worker/gpu_worker.py#L528-L600'
  - 'vllm@ced6857a:vllm/v1/worker/gpu_model_runner.py#L6522-L6535'
  - 'vllm@ced6857a:docs/configuration/conserving_memory.md#L78-L185'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L475-L587'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L670-L865'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/worker.py#L1034-L1075'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L804-L835'
  - 'vllm@ba15685a:vllm/config/cache.py#L216-L256'
  - 'vllm@ba15685a:vllm/config/cache.py#L381-L390'
  - 'vllm@ba15685a:vllm/v1/core/kv_cache_planning.py#L1521-L1605'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L527-L742'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/worker/worker.py#L575-L819'
  - 'vllm@0fc695fc:vllm/config/cache.py#L67-L88'
  - 'vllm@568afb3a:vllm/config/cache.py#L68-L89'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L464-L597'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L717-L758'
  - 'vllm-ascend@db701c1f:vllm_ascend/attention/sfa_v1.py#L1660-L1666'
  - 'vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L233-L284'
  - 'vllm-ascend@db701c1f:vllm_ascend/ops/kimi_kda.py#L244-L291'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L459-L548'
  - 'https://github.com/vllm-project/vllm/issues/56830'
  - >-
    raw:sha256-33dba601f999712c1a51ec9bd5b263c1cb45ff47b831f0e31ecff03e8120e6e3.md#L1-L1457
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: kv-cache
    kind: builds-on
    note: 先理解每层为什么要跨步保留历史 K、V，才能看清为什么要把剩余显存全部拨给缓存池
  - to: paged-attention
    kind: builds-on
    note: 扣完非 KV 开销后的可用字节预算，最终要按固定块长切成物理分页块供请求借还
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 显存快照、通信建组、装权重、量预算、建池与录图的严格先后顺序由 Worker 启动链固定
contradicts: []
updated: '2026-11-18'
origin: gap
rawSources:
  - >-
    raw/sha256-33dba601f999712c1a51ec9bd5b263c1cb45ff47b831f0e31ecff03e8120e6e3.md
  - >-
    raw/sha256-56af680207818f343bdc2d4b2dd36d4c1663bd196134b8a93711cb7d6ec2217f.md
  - >-
    raw/sha256-a1026f7df3575e077953d95909c1d1d1639fcad49299256f5fcb3069614b9e26.md
---

## 启动时怎样知道还能给 KV cache 多少显存？

**memory profiling（显存量测，对应 `NPUWorker.determine_available_memory`）是 vLLM 在接请求前做的一次显存记账。它先按「整卡总显存 × 显存比例」划定本实例预算，再用假输入试跑一次单步最大批量，扣掉常驻权重、激活峰值与非 Torch 增量后，把预算余量一次性切成物理 KV 块。** [KV cache](kv-cache.md) 保存每条请求已算过的历史键值向量，经 [PagedAttention](paged-attention.md) 切成定长块按需借还；它分到多少显存，直接决定实例能同时留住多少条请求、多长的上下文。

这一步固定发生在 [NPUWorker 启动](npu-worker-lifecycle.md)的第 4 步：此时选卡建组与加载权重已经完成，但缓存池尚未分配，decode 图（[ACLGraph](acl-graph.md)，预先捕获单步前向算子序列以便同尺寸直接回放）也尚未录制。以 `vllm-ascend` `v0.30.0`（配套 `vllm` `v0.30.0`）为主基线，整张 NPU 的高带宽显存（HBM，设备侧三类数据分工见[设备内存](device-memory.md)）在冷启动到稳态运行之间按**七级顺序**切分落位：

```wiki-diagram
file: mem-prof-plate-cutaway
```

顺着剖面图的六根引线对照下方分层瀑布条，每一级都在上一级基础上继续收敛边界：

```wiki-diagram
file: kv-cache-memory-profiling
```

1. **第 1–2 级 · 拍启动快照、划定预算上限与预算外 `1 − u` 余量。** `NPUWorker._init_device` 在**初始化分布式通信组之前**拍下 `init_snapshot`（`MemorySnapshot`），记下整卡总显存 `total_memory` 与空闲显存 `free_memory`。随后按 `requested_memory = total_memory × gpu_memory_utilization` 定下实例预算（`v0.30.0` 源码 `CacheConfig` 默认 `0.92`，生产部署常显式传 `0.90` 多留余量）。若此时 `init_snapshot.free_memory < requested_memory`（说明同卡其他进程或底层上下文已占走超过 `1 − u` 的空间），进程当场抛 `ValueError` 退出。
2. **第 3 级 · 扣常驻模型权重（`weights_memory`）。** 建好通信组后，`load_model()` 包在 `DeviceMemoryProfiler` 里加载本卡分到的权重分片、完成 `FRACTAL_NZ` 等昇腾分块布局重排与量化缩放系数构造。前后 `torch.npu.max_memory_allocated` 之差记为 `model_memory_usage`，推理全程常驻不释放。
3. **第 4 级 · 扣试跑激活与算子工作区峰值（`torch_peak_increase`）。** 进入 `memory_profiling` 上下文后，`model_runner.profile_run()` 按单步最大批量（`max_num_batched_tokens`）构造假输入跑一次前向（MoE 模型满足 MC2 门槛时先加跑一次小批量试跑）。读取 PyTorch 分配器峰值增量 `profile_torch_peak - before_profile.torch_peak` 特意安排在**图捕获之前**，避免把后续图池显存重复算进激活。
4. **第 5 级 · 扣非 Torch 增量（`non_torch_increase`，已含已具象化 HCCL 缓冲——严禁二次重扣！）。** HCCL（昇腾集合通信库）通信域缓冲、CANN 流与算子底层上下文不经过 PyTorch 分配器，只能用「设备已用（`total - free`）减去 PyTorch 已保留（`memory_reserved`）」衡量非 Torch 占用。由于 `init_snapshot` 拍在 `_init_worker_distributed_environment()` **之前**，而 `profile_run()` 的前向与通信预热已触发通信域具象化，试跑差值 `non_torch_increase` **已经完整包含了建组与试跑期间落地的 HCCL/MC2 缓冲**。因此，只有在启动前做纯静态纸面估算时才需要单独估 [HCCL buffer](hccl-buffer.md)；一旦读取 `profile_run` 结果或启动日志，**绝对不能在 `non_kv_cache_memory` 之上再手工减一遍 HCCL 缓冲**。
5. **第 6 级 · 切分页 KV 块池（`available_kv_cache_memory_bytes → min_num_blocks`）。** 预算扣完上述三项（并按需经过多组布局、层复用、稀疏卸载或 KVPP 修正）后报给 `EngineCore`。`EngineCore` 按每块字节数（昇腾标准注意力默认 `block_size = 128` 个 token）在同组各卡间取最小块数 `min_num_blocks`，一次性分配物理 KV 池。
6. **第 7 级 · 切完 KV 才录制的 `ACLGraph` 与 `150 MiB` 建议值安全裕度。** 建完 KV 池后，`compile_or_warm_up_model()` 才执行预热并调用 `capture_model()` 录制 decode 图。图显存（`npugraph_memory_bytes`）、快照前已被占的显存以及首次真实请求才分配的运行期缓冲，全部由最右侧斜纹的**预算外 `1 − u` 余量**买单。未显式指定 `--kv-cache-memory-bytes` 时，Worker 录完图还会打印一行汇总日志，在扣除权重、激活峰值、非 Torch 增量和图显存四项之外再多留 **`150 MiB`**（`redundancy_buffer`），兜住 ACL 上下文、HCCL 缓冲与驱动层可能存在的少量非 Torch 低估。

## 为什么要先试跑？代价落在哪里？

**权重、临时激活与 KV cache 的生命周期截然不同，决定了不能跳过试跑直接把“当前空闲显存”全分给缓存池。** 权重大小加载完就固定；激活张量与算子 workspace 随单步 token 数、量化方案和通信路径剧烈波动，算完一步后缓冲池可留待下一步复用；而 KV cache 一旦借给在途请求就要跨许多轮保留。只有先按配置的批次上限真跑一次前向，把这条路径的峰值工作区与非 Torch 增量圈出来，剩下的显存才能安全交给 KV 池长期持有。

这套机制的工程代价落在三处：

- **启动期多跑前向并触发首次编译。** `profile_run()` 要按单步 token 上限真跑前向（MoE 混跑 MC2 时跑两次）；由于它同时承担算子与模型的首次编译，即便手动传了 `--kv-cache-memory-bytes` 显式指定字节预算，试跑也照样执行，省掉的只是扣减算式。
- **量测结果与当前配置强绑定。** 量到的是当前 `--max-num-batched-tokens`、量化精度、并行切分与执行模式下的开销（参数联动细节见[核心 CLI 调参](core-cli-params.md)）；改动其中任意一项，权重或工作区峰值都会变化，旧的预算建议值不再成立。
- **量不到切完 KV 之后才出现的占用。** 试跑时尚未录图，且试跑按 `force_eager` 执行、不构造真实注意力块表元数据（`_should_build_dummy_attn_metadata` 返回 `False`），部分模型在首次真实前向或录图阶段才创建的缓冲不在三项扣减之内，必须靠 `1 − u` 预算外余量兜底。

读启动日志与排障时，务必先把下面三个名字相近的量分清：

| 显存口径 | 计算关系 | 实际装什么 |
|---|---|---|
| 实例总预算（`requested_memory`） | $\text{总显存} \times \text{gpu\_memory\_utilization}$ | 常驻权重、试跑激活峰值、非 Torch 增量（含 HCCL）与可用 KV 池共用 |
| 可用 KV 显存（`available_kv_cache_memory_bytes`） | $\text{实例总预算} - (\text{权重} + \text{激活峰值} + \text{非 Torch 增量})$（含布局修正） | 只给 KV cache，按每块字节数一次性切成物理块 |
| 预算外余量（Unbudgeted Headroom） | $\text{总显存} \times (1 - \text{gpu\_memory\_utilization})$ | 快照前已被占显存、切完 KV 后录制的 `ACLGraph`、运行期延迟创建的缓冲 |

## 放到 v0.30.0 标准部署：Qwen3-8B 单卡与 Qwen3-30B-A3B 四卡怎么算？

把上述七级流水线写成单卡代数算式：设单卡总显存为 $M_{\text{total}}$、预算比例为 $u$、常驻权重为 $M_{\text{weights}}$、试跑激活增量为 $\Delta M_{\text{torch\_peak}}$、非 Torch 增量为 $\Delta M_{\text{non\_torch}}$，每块字节数为 $B_{\text{block}}$。在不触发特殊压缩或分层卸载缩放的标准路径下，单卡可用字节与同组最终块数满足：

$$M_{\text{KV}} = M_{\text{total}} \times u - \bigl(M_{\text{weights}} + \Delta M_{\text{torch\_peak}} + \Delta M_{\text{non\_torch}}\bigr), \qquad N_{\text{blocks}} = \min_{r} \left\lfloor \frac{M_{\text{KV}}^{(r)}}{B_{\text{block}}} \right\rfloor$$

下面落到 `64 GiB` Atlas 800 A2，对比本站两组标准标尺模型：

- **显存水位**：取默认 $u = 0.92$，对应预算上限 $58.88\text{ GiB}$、预算外余量 $5.12\text{ GiB}$（若生产环境显式传 `--gpu-memory-utilization 0.90`，预算上限收敛为 $57.60\text{ GiB}$、预算外余量扩至 $6.40\text{ GiB}$）。
- **单卡 `Qwen3-8B`**：`BF16` 稠密 GQA，36 层、8 个 KV 头、`head_dim = 128`（参数推导见[读懂 HF 模型目录](hf-model-anatomy.md#完整算账对照qwen3-8b-vs-qwen3-30b-a3b)）。
- **四卡 `Qwen3-30B-A3B`**：`W8A8_DYNAMIC` 混合专家，`TP=4 + EP=4`、`DP=1`，48 层共 128 个专家（每卡 32 个本地专家），4 个 KV 头按 TP4 切到每卡 1 个 KV 头（量化布局见[量化](quantization.md#放到-v0300-标准部署两个-8-位分别从哪来)）。

```wiki-diagram
file: mem-prof-fig-qwen3-waterfall
```

对照上图的上下两栏，把两套部署在单张 64 GiB 卡上的七级账目逐行摊开。权重与每块 KV 字节由模型配置静态精确推出；试跑激活峰值、非 Torch 实测增量与图显存随 CANN 版本及批大小变化，表中取算账示意值演示扣减闭环，真机以启动日志 `Actual usage` 行复核为准：

| 七级显存账目（单张 `64 GiB` A2 视角） | `Qwen3-8B`（`BF16`，`TP=1` 单卡） | `Qwen3-30B-A3B`（`W8A8_DYNAMIC`，`TP=4 + EP=4, DP=1`） |
|---|---|---|
| 1–2. 总显存与实例预算（默认 $u = 0.92$） | 总计 `64.00 GiB`；预算 `58.88 GiB`，预算外 `1 − u` 留 `5.12 GiB` | 总计 `64.00 GiB`；每卡预算 `58.88 GiB`，预算外 `1 − u` 留 `5.12 GiB` |
| 3. 常驻权重 `weights_memory` | 纯参数 `8.19B × 2 B ≈ 15.26 GiB`（默认 `weight_nz_mode=1` 下 `BF16` 保持 `ND`；设 `2` 才转 `FRACTAL_NZ`） | 本卡 32 专家与切分投影 INT8（默认转 `FRACTAL_NZ`）+ 词表/门控 BF16 + 缩放系数 `≈ 7.40 GiB` |
| 4. 试跑激活峰值 `torch_peak_increase` | 按单步批上限跑 1 次前向（示意 `2.14 GiB`） | 若批上限超 `mc2_tokens_capacity` 且命中 MC2，先加跑 MC2 再跑主试跑（示意 `2.30 GiB`） |
| 5. 非 Torch 增量 `non_torch_increase`（含 HCCL） | 若跨组名复用则仅 `world(200M) + dp(50M)` 两项配置（实占含 CANN 流示意 `0.60 GiB`） | 逻辑 7 组在跨 `group_name` 复用前提下经 `_HCCL_PG_REGISTRY` 去重为 `450 MiB` 上限 + `mc2` 归 CANN 管理（示意 `0.90 GiB`，**已含在试跑差值内**） |
| 6. 可用 KV 池与 `128 token` 物理块切分 | 剩余 `40.88 GiB`；每 token 全层 `144 KiB`，每块 **`18.000 MiB`** $\to$ **`2,325` 块**（扣 1 空块剩 `2,324` 可用块） | 单卡剩余 `48.28 GiB`；每卡 1 个 KV 头对应 `24 KiB/tok`，每块 **`3.000 MiB`** $\to$ **`16,479` 块**（扣 1 空块剩 `16,478` 可用块） |
| 7. 切完 KV 后的 `ACLGraph` 与 `150 MiB` 裕度 | `capture_model()` 图显存从 `5.12 GiB` 预算外支付；建议值另扣 `150 MiB` | 四卡同步录制 decode 图并从各自 `5.12 GiB` 预算外支付；建议值另扣 `150 MiB` |

这里最值得留心的是第 5 级的 **HCCL 通信域去重规则**（详见 [HCCL buffer](hccl-buffer.md)）。在 `v0.30.0` 中，普通通信组默认配 `_DEFAULT_BUFFER_SIZE = 200 MiB`，DP 组按 $\max(\lceil(\text{dp\_size}+1)\times 4 / 1\text{ MiB}\rceil, 50)$ 取保底 `50 MiB`，而 `patch_distributed.py` 的 `_HCCL_PG_REGISTRY` 会按 `(backend, ranks, options_key, reuse_domain)` 对共享通信域去重。以 `TP=4, EP=4, DP=1` 下的 **`rank 0`** 为例：在跨 `group_name` 复用的前提下，`tp` 与 `ep` 复用 `world [0..3]` 的同一个 `200 MiB` 句柄，`pcp` 与 `pp` 复用 `dcp [0]`，加上 `dp [0]` 的 `50 MiB`，PyTorch 侧配置上限合计为 `450 MiB`。更关键的是，无论底层最终复用了几组、物理上具象化了多少兆字节，它们都发生在 `init_snapshot` 之后、`after_profile` 之前，**早已包含在 `non_torch_increase` 中**。

> **边界与例外（跨 `group_name` 拆键与 `mc2` 托管）**：`create_hccl_pg_options` 会向 `Options.hccl_config` 写入不同的 `"group_name"` 字段；若真机据此拆键（详见 [HCCL buffer](hccl-buffer.md) 待核项），7 个逻辑组的配置字段合计为 `1,250 MiB`。此外，`mc2` 组传入 `pg_options=None`，其缓冲大小直接交由 CANN 环境变量 `HCCL_BUFFSIZE` 控制。

### 切成块：各卡取最小，块数不等于并发数

**`EngineCore` 收齐本组所有 Worker 报来的可用 KV 字节数后，先按每块字节数各自整除，再取全组最小的块数 `min_num_blocks` 统一分配，并把多算出的张量空间按比例缩回，避免大卡白占显存。** 各卡的激活峰值与非 Torch 增量存在细微波动，取最小值才能保证同一并行组内每张卡都装得下同一张块表。若开启多组数据并行（DP），每个 `EngineCore` 只在自己管辖的卡组内取最小，前端 `core_client.py` 汇总日志时再把各 DP 引擎的 `num_gpu_blocks` 相加（API 侧打印的总块数是多组之和，不是单组容量）。

切块前还有三道准入关卡：可用显存不大于零直接报 `No available memory`；`v0.30.0` 与 `main` 先从校验预算 `check_memory` 里扣出 `BlockPool` 永久保留的 **1 个空块（null block）**；若剩余空间连 1 条 `max_model_len` 满长请求都装不下，同样当场报错退出（多缓存组每块规格见 [KV cache 规格](kv-cache-spec.md)）。

**切出来的物理块数绝不等于能同时服务的并发请求数（`max_num_seqs`）。** 物理块池装的是 token 槽位（例如 `Qwen3-8B` 单卡 `2,324` 个可用块共 `297,472` 个 token 槽位）。如果线上全是 `512` token 的短对话，两百多条并发也绰绰有余，真正卡住并发上限的是调度阈值 `--max-num-seqs`（默认 `256`）；如果全是 `32,768` token 的长文档（每条占 `256` 块），不到 10 条请求就会把块池借光并触发抢占重算。若遇到带线性注意力状态的混合模型，每条请求还会额外占住固定数量的状态块，块数与并发数的换算就更不能一刀切。

## 空闲显存变多，为什么量测反而失败

**“整张卡空闲了多少”与“当前 vLLM 实例新占了多少”是两笔不同的账。** `NPUWorker` 在量测末尾有一条硬断言：`assert self.init_snapshot.free_memory > free_gpu_memory`，要求试跑结束时的整卡空闲显存必须严格小于启动快照时的空闲显存。容器只隔离进程视图，不自动隔离同卡的物理 HBM；一旦同卡上的另一个进程恰好在 `init_snapshot` 与 `after_profile` 之间释放了显存，差分读数就会失真。

用一个简化的教学示意数算一遍：设拍启动快照时整卡空闲 $80\text{ GiB}$，当前 vLLM 实例在加载与试跑期间净增占用 $2\text{ GiB}$，但同卡另一个容器恰好在这几秒内退场释放了 $10\text{ GiB}$：

$$M_{\text{free,after}} = 80 - 2 + 10 = 88\text{ GiB}, \qquad \Delta M_{\text{consumed}} = 80 - 88 = -8\text{ GiB}$$

把整卡表观读数与本实例真实增量放在一起对比：

| 观察视角 | 快照初值 | 窗口内变化 | 试跑后读数与判定结果 |
|---|---|---|---|
| 本实例真实占用（待测目标） | `0 GiB` | 加载与试跑新增 `+2 GiB` | 真实消耗 `+2 GiB`，本应从预算正常扣除 |
| 同卡其他进程占用（外部干扰） | 已占若干 | 量测窗口内释放 `−10 GiB` | 整卡空闲显存反而从 `80 GiB` 涨到 `88 GiB` |
| `NPUWorker` 整卡差分断言 | `init = 80 GiB` | 表观消耗 `80 − 88 = −8 GiB` | 违反 `init_snapshot.free_memory > free_gpu_memory`，抛 `AssertionError` 中止 |

这类 **`Error in memory profiling` 断言失败**代表“记账基准被外部污染”，与显存不够分配的 **OOM** 完全不是一回事。排障时先按[启动排障](inference-troubleshooting.md#启动依赖与加载还没到接请求这一步)定位挂在加载、试跑、建池还是录图阶段，再核对同一时间窗内是否有其他任务启停（注意 PyTorch 分配器的 `memory_reserved` 包含缓存待复用的块，不能只看 `memory_allocated`）。最小验证实验是固定配置做两组对照：一组让旁路进程提前占稳显存全程不释放，另一组在启动窗口内释放；只有释放组复现断言失败而占稳组正常通过，才能确认为外部释放干扰——正确修法是隔离设备或错峰拉起，绝不是注释掉断言。

## 多模态输入的量测尺寸，等于运行时限制吗？

**传给试跑的多模态尺寸提示（profiling size hints），只改变启动时假输入张量按多大规格构造，不会在运行期自动缩放真实媒体或封顶编码缓存。** 多模态模型除了文本 token，还要用视觉或音频编码器处理图片、视频与语音；图像分辨率、视频帧数与音频时长直接决定编码阶段的中间激活体积，仅靠文本批上限无法刻画这笔开销。

上游官方显存指南给出的典型写法是：通过 `limit_mm_per_prompt` 同时传入数量上限与试跑尺寸提示（例如单请求最多 `5` 张图、试跑按 `512×512` 构造；最多 `1` 段视频、试跑按 `32` 帧 `640×640` 构造）。这里必须把两件事彻底拆开：“最多几张图/几段视频”（`count`）是运行期准入硬限制；`width` / `height` / `num_frames` 只是给 `profile_run()` 造假输入用的尺寸提示（超出模型上限时钳回有效最大值），**既不会把线上真实大图自动缩成 `512×512`，也不会把运行期的 `encoder cache`（存放视觉编码输出供语言主干读取的缓存）封顶在该尺寸**。

因此，如果业务允许更高清的图片或更长视频，必须在目标输入尺寸下核实峰值；若想真正压低线上媒体开销，应配置模型对应的预处理器像素上限，而不是只调小试跑提示。同时要把 NPU 显存不足与主机内存不足分开：多模态预处理缓存放在主机 DRAM（由 `mm_processor_cache_gb` 控制），调小设备侧 KV 预算不会缩小主机侧缓存。

## 放到 GLM 双机：一张卡的预算怎样扣

以下小节对照**「09 旗舰异构模型全案」GLM-5.3-Flash 历史绑定全案**（钉住 `vllm@0fc695fc + vllm-ascend@db701c1f`，双机 2 台 Atlas 800 A2 共 16 卡、`TP8 / DP2 / EP16`、`W8A8` 量化，教程将 `--gpu-memory-utilization` 设为 `0.85`，部署前提见[双机部署前提](glm-5-3-flash-two-node.md#部署前提)）。量测对应[双机启动的第五步](glm-5-3-flash-two-node.md#启动时发生了什么)：16 个 Worker 各自拍快照、建通信组、加载权重并试跑，再由两台机器各自的 `EngineCore` 收齐本机 8 张卡的结果定块数、建池并录图：

```wiki-diagram
file: kv-cache-memory-profiling-flow
```

### 试跑两次：先按 128 个 token，再按 8192 个

**GLM 在同一个 `memory_profiling` 区间内连续试跑两次，是为了把 MoE 层的两条通信路径都量进去。** 该部署单步调度上限为 `8192` 个 token（见[调度的 token 预算](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)）。但 MoE 层在总 token 数不超过 `128` 时走昇腾融合的 MC2 路径，超过 `128` 则切到 AllGather 路径（见[MoE 通信选择](one-request.md#moe-通信走-mc2-还是-allgather)）。若只跑 `8192` 个 token，MC2 分支不会触发；因此当批上限大于 `mc2_tokens_capacity`（`128`）且该门槛命中 MC2 时，`model_runner.profile_run()` 先按 `128` 个 token 跑一次 MC2 假前向，再跑 `8192` 个 token 的主试跑，激活峰值取两次合起来的最高点减去试跑前基准。

**但试跑按 eager 执行且不构造注意力元数据（`attn_metadata is None`），GLM 的两类注意力核心计算在试跑中均提前返回：**

- **11 层稀疏 MLA**（见[稀疏注意力](sparse-attention.md)）：见到元数据为空直接将输出填零返回，内部的动态选块索引器（indexer）完全未运行。索引器在首次真实运行或录图时才转出的两份 FP32 副本（每卡约 `54 MiB`，见 [TP 页](tensor-parallel.md#加载权重之外每卡还会创建同样大的运行时副本)）也不会在试跑期出现。
- **34 层 KDA 线性注意力**（见[线性注意力](linear-attention.md)）：照常算完输入侧的 `q`、`k`、`v`、$\beta$ 与门控投影，但在短卷积和分块递归之前就早退，拿着全零输出继续跑完层末归一化与输出投影。

由于真实请求的批次形状、缓冲复用和异步流生命周期与假输入不同，试跑跳过的分支既不能简单把单层差值乘 34 当作上界，也不能断言最多只差一层；真实负载的额外临时开销必须靠预算外余量承接并由实机压测确认。注意区分“试跑跳过了递归算子”与“状态本身占多少缓存”：KDA 的递归状态常驻在 KV 池里，每条请求固定占 `12` 个块号（一条仅 7 个 token 的短请求也要占 `15` 块，见[为什么短请求也占 15 个块](glm-5-3-flash-two-node.md#为什么短请求也占-15-个块)），不会因为试跑早退而少占块。

### 三项扣减在 GLM 里各是什么

在双机历史绑定算例中，单张 64 GiB 卡按 `0.85` 划出 `54.40 GiB` 预算，三项非 KV 扣减的构成如下：

| 扣减项 | GLM 双机单卡口径 | 算例取值与边界说明 |
|---|---|---|
| 权重 | 须涵盖语言主干、视觉塔、MTP 草稿层及量化辅助张量 | 教学算例假设整卡实载 `21 GiB`（已列语言子账 `21,078 MiB ≈ 20.58 GiB` 未含视觉塔等表外项，见[每张卡上放了什么](glm-5-3-flash-two-node.md#每张卡上放了什么)） |
| 激活峰值 | 128 与 8192 两次试跑合算的 PyTorch 分配最高点增量 | 缺实机日志，与下项合并按教学假设取值 |
| 非 Torch 增量 | 快照之后建立的 HCCL 跨卡通信组缓冲等 | 四个跨卡逻辑组配置字段之和为 `650 M`（折算参考约 `82` 块，不等同实占损失，见[HCCL 容量折算](hccl-buffer.md#配置值怎样折算成容量参考)）；与激活峰值合计假设为 `3.4 GiB` |

按这组教学假设扣完后，单卡剩余 **`30.00 GiB`** 可用 KV 显存，按每块 [7.969 MiB](glm-5-3-flash-two-node.md#占住一个块号要用多少显存)（`8,355,840 B`）切出 **`3,855` 块**。若仅代入已列语言权重子账则对应 `3,908` 块，但尚未扣除视觉塔等表外项，不能当成精确设备容量。这两组块数的完整字节推导与适用场景只在唯一出处 [glm-5-3-flash-two-node「剩下的显存变成多少 KV cache」](glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache) 维护，本页不重复展开。

### 预算外的 15%：图、副本和启动前已被占的

教程取 `0.85` 意味着每张 64 GiB 卡留出 **`15%`（`9.6 GiB`）** 不进预算（见[两种块数各在什么时候用](glm-5-3-flash-two-node.md#两种块数各在什么时候用)），专门承接四笔预算外开销：启动快照前已被占的显存、切完 KV 后按 7 个固定尺寸录制的 decode 图（见[启动第七步](glm-5-3-flash-two-node.md#启动时发生了什么)）、每卡约 `54 MiB` 的索引器 FP32 运行时副本，以及试跑早退未覆盖到的稀疏 MLA 注意力与 KDA 短卷积/递归临时缓冲。录完图后，未设显式字节预算的 Worker 会打印 `Actual usage` 四项汇总与扣除 `150 MiB` 后的 `--kv-cache-memory` 建议值，这是核对真机激活峰值、非 Torch 增量与图显存的唯一权威入口。

## 常见误解

先把最容易踩坑的五组错误直觉与 `v0.30.0` 源码机制并排对照，再逐条核实原因：

```wiki-diagram
file: mem-prof-fig-myths
```

- **「做显存对账时，拿 `profile_run` 扣完的数再减一遍 HCCL 缓冲才保险。」** 错。`init_snapshot` 拍在建通信组之前，`profile_run` 结束时的 `non_torch_increase` 已经包含了具象化的 HCCL 与 MC2 缓冲（共享通信域另经 `_HCCL_PG_REGISTRY` 按 `(backend, ranks, options_key, reuse_domain)` 判键复用，跨 `group_name` 是否拆键见 [HCCL buffer](hccl-buffer.md) 待核项）。再减一遍属于双重扣减，只会平白浪费 KV 容量。
- **「`0.92`（或教程的 `0.85`）就是专门留给 KV cache 的比例。」** 错。显存比例圈出的是整份实例预算，权重、试跑激活峰值和非 Torch 增量全都先从这份预算里扣，扣剩下的尾款才归 KV cache。
- **「预算外那 `8%`～`15%` 空着也是浪费，把比例拉到 `0.98` 能多切块。」** 危险。昇腾 `NPUWorker` 在切完 KV 之后才调 `capture_model()` 录图，图显存、快照前占用与运行期延迟创建的缓冲全靠预算外 `1 − u` 余量买单；留太薄会在录图或首条请求时直接 OOM。
- **「上游 GPU 代码会预先估算图显存并从预算扣除，昇腾也一样。」** 不一样。上游 `GPUWorker` 仅在 CUDA 平台且显式开启环境变量 `VLLM_MEMORY_PROFILER_ESTIMATE_CUDAGRAPHS` 时才在量测阶段预估图显存；昇腾 `NPUWorker` 没有这一步，图显存一律从预算外支付。
- **「非 Torch 增量可以按张量形状算出来，试跑峰值就是任意真实负载的最高峰。」** 两半都错。非 Torch 占用不走 PyTorch 分配器，只能靠设备快照差测量；而试跑不录图、不建注意力块表元数据（如稀疏 MLA 与 KDA 核心分支会早退），不能代表所有真实输入组合的绝对上界。
- **「切出来的物理块数就是能同时服务的并发请求数。」** 错。一条请求占多少块随上下文长度动态增长（混合线性注意力模型还额外占固定状态块），并发上限由块池容量与 `--max-num-seqs` 共同制约。
- **「传了 `--kv-cache-memory-bytes` 就不用跑 `profile_run` 了，启动能变快。」** 错。显式字节路径照常执行 `profile_run()` 完成首次编译，只跳过自动扣减算式；启动快照的空闲显存检查与后续稀疏卸载、KVPP 约束依旧生效。

## 对照源码

### 怎么开

显存预算自动量测每次启动默认执行，无需手动开启；以下三个参数用于调整预算水位或按字节/块数显式接管：

| CLI 参数 / Python 字段 | `v0.30.0` 默认与校验边界 | 运行时实际作用 |
|---|---|---|
| `--gpu-memory-utilization` / `gpu_memory_utilization` | 浮点数，默认 **`0.92`**，范围 `(0, 1]`（常见生产脚本手传 `0.90`；GLM 教程设为 `0.85`） | 设定每卡实例总预算比例 `total_memory × u`，涵盖权重、试跑激活、非 Torch 增量与 KV 池 |
| `--kv-cache-memory-bytes` / `kv_cache_memory_bytes`（旧简写 `--kv-cache-memory`） | 整数或 `None`，默认 `None`（字段定义无正数下限校验，`0`/负数分支见下） | 指定每卡（非 TP 合计）KV 字节预算；`NPUWorker` 对真值仍跑 `profile_run` 编译，跳过比例扣减 |
| `--num-gpu-blocks-override` / `num_gpu_blocks_override` | 整数或 `None`，默认 `None`（按 `is not None` 判定，`0` 不恢复自动） | 在 `EngineCore` 规划阶段以 `override × bytes_per_block` 重写有效容量，主用于抢占测试 |

**覆盖先后顺序与 `None` / `0` / 单位陷阱：**
1. **先 Worker 报字节，再引擎定块数。** 未传显式字节时走四项记账；传正字节数时打印 `skipping memory profiling` 并跳过按 `u` 扣减，**但启动快照 `free_memory >= requested_memory` 检查仍按 `u` 执行**。进入 `EngineCore` 后，若 `num_gpu_blocks_override is not None`，则以指定块数重写有效预算（打印 `Overriding num_gpu_blocks=...`），不是与显式字节取较小值；在 GLM 双机历史钉点上，由于混合分组含不等页大小而上游 `get_uniform_page_size` 断言单页大小，切勿对 GLM 传 `--num-gpu-blocks-override`。
2. **`None`、`0` 与负数不可混用。** `NPUWorker` 用真值判断 `if kv_cache_memory_bytes := ...`：`None` 和 `0` 都走自动扣减，但录图后建议日志要求 `kv_cache_memory_bytes is None`，传 `0` 会静默吞掉建议日志；传负数则为真值，直接触发无可用缓存报错。`num_gpu_blocks_override` 用 `is not None` 判断，传 `0` 或负数会算出非正容量导致初始化失败。
3. **CLI 字节单位区分十进制与二进制。** `30g` 表示 $30 \times 10^9\text{ B}$，`30G` 表示 $30 \times 1024^3 = 32,212,254,720\text{ B}$（`30 GiB`）；`25.6g` 合法，而二进制后缀带小数（如 `30.5G`）会被参数解析器直接拒绝；Python API 直接传整数字节数（如 `30 * 1024**3`）。

标准部署与固化字节预算命令片段（接入完整 `vllm serve` 命令；`--max-num-batched-tokens` 在昇腾在线服务默认回落 `2048`、离线默认 `8192`，`--enforce-eager` 开启时跳过录图使图显存归零；多模态通过 `--limit-mm-per-prompt '{"image":{"count":5,"width":512,"height":512}}'` 传数量上限与试跑提示，主机预处理缓存用 `--mm-processor-cache-gb` 控制，CPU 后端的 `VLLM_CPU_KVCACHE_SPACE` 不作用于昇腾 NPU）：

```bash
# 1. 自动量测路径：显式留出 10% 预算外余量装 ACLGraph，并固定单步最大批预算
vllm serve Qwen/Qwen3-8B --gpu-memory-utilization 0.90 --max-num-batched-tokens 4096

# 2. 固化字节路径：首轮拿到 Actual usage 建议值后，同环境重启固定单卡 KV 池大小
vllm serve Qwen/Qwen3-8B --gpu-memory-utilization 0.90 --kv-cache-memory-bytes 38G
```

### 会报什么错

- `gpu_memory_utilization` 设为 `0`、负数或大于 `1`：配置校验阶段直接拒绝；设 `1.0` 语法合法，但预算外余量为 `0`，极易在录图或运行峰值时设备 OOM。
- `Free memory on device (x/y GiB) on startup is less than desired GPU memory utilization (...)`：拍 `init_snapshot` 时空闲显存已小于 `requested_memory`。先查同卡残留进程，再决定是否调低比例。
- `Error in memory profiling. Initial free memory ... current free memory ...`：昇腾 `NPUWorker` 要求 `init_snapshot.free_memory > free_gpu_memory`（严格大于，相等或回升均报错；上游 GPU 实现为 `>=`）。优先排查启动窗口内是否有同卡容器释放显存，对照方法见[空闲显存变多](#空闲显存变多为什么量测反而失败)。
- `No available memory for the cache blocks.`：预算减完权重、激活峰值与非 Torch 增量后可用字节 $\le 0$。
- `To serve at least one request with the model's max seq len (...)`：扣除 1 个保留空块后的可用 KV 显存装不下 1 条 `max_model_len` 请求，报错文本会附带当前显存可支撑的估算最大长度。
- 混合不等页大小模型开启 `--num-gpu-blocks-override`：在 `get_uniform_page_size` 处触发 `len(page_sizes) == 1` 断言失败，应移除该覆盖参数。
- 切完 KV 之后在 `capture_model()` 录图或首条真实请求阶段报底层 NPU 内存分配失败：无专属量测报错前缀，说明 `1 − u` 预算外余量不足，需调低 `--gpu-memory-utilization`、收敛图捕获尺寸或核查未量到的运行期分支。

### 开销和什么时候别开

- **显式字节预算只求块数稳定，不省启动耗时。** 自动路径与 `--kv-cache-memory-bytes` 都会执行 `profile_run()`（MoE 命中 MC2 条件时均跑两次）。显式预算仅适合独占整卡、配置锁死且希望每次重启块数严格一致的生产环境；一旦同卡有混部进程，或改了量化方案、并行度、批上限与图模式，必须撤掉显式字节重跑自动量测。
- **调高显存比例前先读 `Actual usage` 四项账单。** 确认 `total_memory × (1 - u)` 在装下 `npugraph_memory_bytes` 与 `150 MiB` 安全裕度后仍有富余，切忌只看 `npu-smi` 空闲数值盲目把比例推向 `0.98`。
- **`--num-gpu-blocks-override` 仅限受控容量/抢占测试。** 它改写的是整池块数而非单请求配额，设得高于真实物理可用块数只会把崩溃推迟到张量分配时刻。

### 版本差异

下表对照四套固定仓库快照在显存预算、试跑修正与块池规划上的演进（以 `v0.30.0` 正式版替换原 `rc2` 过渡快照）：

| 核对维度 | `v0.23.0` (`0fc695fc` / `2c59ff10`) | `v0.26.0rc` (`568afb3a` / `2ed6cbba`) | `v0.30.0` (`ced6857a` / `c09d3e20`) | `main` (`ba15685a` / `8d6180e2`) | 对使用者意味着什么 |
|---|---|---|---|---|---|
| 1. 比例默认值与主公式 | `CacheConfig` 默认 `0.92`；预算减权重、激活峰值与非 Torch 增量（`worker.py#L527-L742`） | 默认 `0.92`；主扣减公式一致（`worker.py#L575-L819`） | 默认 **`0.92`**[C15]；录图前读取 `profile_torch_peak` 防图池重复计入 | 字段改为 `None` 并延迟解析 `resolved_gpu_memory_utilization`（常规仍为 `0.92`，可扩展 KV 池为 `1.0`）[C28]，经 `_get_gpu_memory_utilization()` 读取 | 常规部署四版默认均为 `0.92` 且主扣减公式一致 |
| 2. MC2 双次试跑 | 批上限超 `mc2_tokens_capacity` 且命中 MC2 时加跑一次 | 加跑时关闭编译，稀疏卸载先分配 `topk` 缓冲 | `model_runner_v1.py#L4328-L4348` 延续加跑与 `disable_compilation`[C6] | 迁入 MRV2 `v2/model_runner.py#L804-L835`，支持 DP `randomize_inputs`[C27] | MoE 在昇腾上会自动双跑以覆盖 MC2 与主路径峰值 |
| 3. 自动扣减后的布局缩放 | 无多组或分层缩放 | 新增层复用放大与稀疏 decode 卸载约束 | 依次执行 `_scale_kv_cache_memory_for_multi_group`、层复用、稀疏卸载与 KVPP；豁免 `deepseek_v4/v41` 及紧凑布局的 `Attention + (Mamba \| Step3.5/3.7 \| V2 共享池)`[C3] | 新增 `hisparse_config` 豁免、将 `glm5_next` 纳入显式豁免并将紧凑条件放宽至 `is_block_compact`[C25] | 混合多组模型的返回值是规划器逻辑字节，未必等于裸物理差值 |
| 4. 显式字节路径行为 | `profile_run` 后直接原样返回 | 仍经过稀疏卸载调整 | `profile_run` 后仍经过稀疏卸载与 KVPP 预算转换，不走多组缩放 | 显式字节在卸载与 KVPP 之前**同样先过 `_scale_kv_cache_memory_for_multi_group`** | `main` 修补了显式物理字节在私有分配多组下的越界风险 |
| 5. 保留空块与录图建议 | 无 `null block` 预扣；录图后给 `150 MiB` 裕度建议 | 同 `v0.23.0`，日志增报 reserved/allocated | `kv_cache_utils.py#L2722-L2762` 准入前先扣 1 个永久 `null block` 再取 `min_num_blocks`[C20]；录图后留 `150 MiB` | 规划迁入 `kv_cache_planning.py#L1521-L1605`[C30]，延续 1 空块预扣与 `150 MiB` 裕度 | `v0.30.0` 起临界容量比旧版少 1 块可用额度；多模态提示边界四版一致[S23] |

### 源码位置

以 `v0.30.0`（`vllm-ascend@c09d3e20` + `vllm@ced6857a`）为主基线定位七级闭环：

- **第 1–2 级（启动快照、比例校验与 HCCL 建组先后）**：`NPUWorker._init_device`（`vllm_ascend/worker/worker.py#L460-L496`）先建 `init_snapshot` 并校验 `free_memory >= requested_memory`，随后才调用 `_init_worker_distributed_environment()`[C1]；HCCL 组缓冲默认 `200 MiB`（`utils.py#L73-L77`）、DP 保底 `50 MiB`（`utils.py#L1241-L1288`）与共享域 `_HCCL_PG_REGISTRY` 去重见 `patch_distributed.py#L39-L187`[C12]，标准块长 `128` 见 `refresh_block_size`（`utils.py#L1482-L1545`）。
- **第 3–5 级（权重量测、试跑峰值与非 Torch 差分）**：`NPUModelRunner.load_model`（`model_runner_v1.py#L4372-L4478`）与 `NPUPlatform.get_current_memory_usage`（`platform.py#L209-L212`）记录权重峰值增量[C7]；`MemorySnapshot` 与 `memory_profiling`（`vllm/utils/mem_utils.py#L81-L321`）定义 `(total - free) - memory_reserved` 非 Torch 差分[C14]；`determine_available_memory`（`worker.py#L566-L667`）包住 `profile_run`（`model_runner_v1.py#L3909-L3923` 不建注意力元数据，`gpu_model_runner.py#L6522-L6535` 含上游 `_dummy_sampler_run` 采样试跑），完成三项扣减、`free_memory` 严格递减断言与多组缩放[C2]。
- **第 6–7 级（跨卡取最小块数、录图与 `150 MiB` 建议值）**：`EngineCore._initialize_kv_caches`（`vllm/v1/engine/core.py#L254-L320`）与 `get_kv_cache_configs`（`kv_cache_utils.py#L975-L1015, #L2697-L2774`）处理块数覆盖、1 空块预扣与 `min_num_blocks` 收缩，多 DP 客户端在 `core_client.py#L814-L818` 汇总相加；`compile_or_warm_up_model`（`worker.py#L879-L955`）执行 `capture_model()` 并按 `150 MiB` 安全裕度打印建议值[C4]（上游 CUDA 专属图预估门控见 `gpu_worker.py#L528-L600`[C21]）。
- **GLM 双机例外与外部容器干扰参考**：「09 旗舰异构模型全案」GLM 教程 `0.85` 配方见 [S35]，固定镜像 `db701c1f` 的量测、录图、稀疏 MLA（`sfa_v1.py#L1660-L1666`）/ KDA（`kimi_gdn_linear_attn.py#L233-L284`、`kimi_kda.py#L244-L291`）早退及混合分组（`patch_kv_cache_utils.py#L459-L548`）均已归入本页来源索引；同卡容器释放显存触发断言的社区复现记录见 [issue #56830](https://github.com/vllm-project/vllm/issues/56830)[S42]。

证据归属与待核边界：HCCL 缓冲已含在 `non_torch_increase` 中且严禁二次重扣，由 `init_snapshot` 先于 `_init_worker_distributed_environment()` 及试跑触发通信具象化的时序直接推出[D]；`Qwen3-8B`（`15.26 GiB` 权重、`18.000 MiB/块`）与 `Qwen3-30B-A3B`（TP4 下每卡 `3.000 MiB/块`、跨组名复用假设下 `450 MiB` 配置上限）由模型配置与通信域规则静态推出[D]，两表中的试跑激活峰值、非 Torch 实占数及 `80 / 2 / 10 / 88 GiB` 差分例子均为方便算账核对的教学示意设定，不代表真机实测读数[A]；将七步归纳为“预算内三扣减 + 预算外录图兜底”属架构总结[I]；GLM 双机算例中的 `64 GiB`、`21 GiB`、`3.4 GiB` 沿用双机页教学假设[A]，该固定部署的真机 `Actual usage` 日志、`main` 分支实跑布局转储、单成员 HCCL 组的硬件实占字节数以及 `Options.hccl_config["group_name"]` 在真机 `torch_npu` 下是否分离复用键仍属待核项（详见 [HCCL buffer 待核说明](hccl-buffer.md)）。
