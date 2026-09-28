# 主线底稿 01：部署、入口、调度、收尾（A0–A3、A7、B1–B3）

本文件是事实底稿，不是读者页。前提以 `docs/plans/2026-09-27-mainline-rebuild.md` §3 为准。

- 控制流：`vllm@0fc695fc`（工作树 `tools/repos/vllm`，可直接打开文件）。
- 执行侧：`vllm-ascend@db701c1f`（孤立提交，用 `git -C tools/repos/vllm-ascend show db701c1f:<path>` 读）。
- 结论标记沿用主仓 `PLAN.md` §1.4：`[S]` 官方文档/论文、`[C]` 固定 commit 源码、`[D]` 由公式/shape/rank 推导、`[A]` 教学假设、`[I]` 推断、`[M]` 实测、`[!]` 版本冲突或需要红色高亮的条件。
- 示例请求 R1：prompt 4 个 token，一直生成到结束。`[A]` 4 是演示设定，真实请求套完模板至少十几个 token，见 A1「在我们部署下的具体数字（R1）」第一条。
- 场景 M：DP0 上 12 个请求在 decode，同时来了 1 个 6000 token 的新请求；DP1 上 7 个请求在 decode。M′：DP1 空闲。

---

## 0. 全局常量（后面各站反复用）

这些数字在 A0 算出来，后面直接引用。

| 名字 | 值 | 来源 |
|---|---|---|
| 全局 HCCL world | 16 rank（node0 = 0–7，node1 = 8–15） | `[C]` `vllm@0fc695fc:vllm/distributed/parallel_state.py#L1535-L1560` |
| TP 组 | 2 个，每个 8 rank（同节点内） | `[C]` 同上 `#L1758-L1768` |
| DP 组 | 8 个，每个 2 rank（`{i, i+8}`） | `[C]` 同上 `#L1833-L1848` |
| EP 组 / MC2 组 | 1 个，16 rank | `[C]` 同上 `#L1850-L1875`；`vllm-ascend@db701c1f:vllm_ascend/distributed/parallel_state.py#L84-L96` |
| 每卡路由专家数 | 288 / 16 = 18 | `[D]` 由 EP=16 与 `n_routed_experts=288` |
| KV 逻辑块大小 block_size | **640 token** | `[C]` 见 A0 §A0.4 |
| 每个 block id 的物理开销 | **8,355,840 B ≈ 7.969 MiB**（折合 13,056 B/token） | `[D]` 见 A0 §A0.5 |
| KV cache 组数 | 5 组：1 个 full（MLA+indexer 配对）、1 个 indexer-state、3 个 KDA | `[C]` 见 A0 §A0.5 |
| 带 KV 的 MLA 层数 | **12**（主干第 3、7、…、43 层共 11 层 + MTP 第 45 层） | `[C]` 见 A0 §A0.5 |
| 每个请求的 KDA 状态开销 | 3 组 × 4 块 = **12 个 block id**（与序列长度无关） | `[C]+[D]` 见 A2 |
| decode 一步每请求的 token 数 | 1 + 3 = **4**（MTP 草稿 3） | `[C]` `vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L814`；`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L652-L656`（`decode_token_per_req`） |
| 图捕获尺寸 | 4/8/16/32/64/96/128 token = 1/2/4/8/16/24/32 个请求 | `[S]` 教程 + `[D]` 除以 4 |
| 前缀缓存 | 默认关闭（hybrid 模型） | `[C]` 见 A2 §A2.3 |
| chunked prefill | 默认开启 | `[C]` 见 B2 |

### 「block_size」这个词的五种含义

同一个词在五处指不同的东西，后文凡是写 block_size 都按这张表消歧。

| 说的是谁 | 值 | 谁在用 | 出处 |
|---|---|---|---|
| 逻辑块（`cache_config.block_size`，KV 池分配与 full 组的单位） | **640 token** | KV 池、full 组、indexer | `[C]` `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L131-L159` |
| kernel 块（SFA 算子看到的块） | **128 token**，1 个逻辑块 = 5 个 kernel 块 | worker 的 block table 视图 | `[C]` 同上 `#L11`（`GLM5_KERNEL_BLOCK_SIZE`） |
| indexer-state 组的块 | **4**（= `index_kpool` 压缩比，也是滑窗宽度） | 压缩器状态 cache | `[C]` `vllm_ascend/models/glm5_next.py#L1298-L1304` |
| KDA（mamba）组的块 | **133120**（= `max_model_len`，即一请求一页） | KDA 状态 | `[C]` `patch_mamba_config.py#L222-L225` |
| 调度器的块（token 对齐不变量） | **133120**（= 各组块大小的 lcm） | `Scheduler.block_size` | `[C]` `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L357-L378` |

另外，`EngineCore` 在 KV 初始化之后会把 `cache_config.block_size` 改写成各调度组块大小的最小值（本部署是 indexer-state 组的 4），这之后再读这个字段拿到的不是 640。`[C]` `vllm@0fc695fc:vllm/v1/engine/core.py#L279-L285`

---

## A0 部署全景与启动

### 做了什么

在两台 Atlas 800 A2（每台 8 张卡）上把 GLM-5.3-Flash 拉起来：node0 起一个前端进程 + 一个协调进程 + 一个引擎进程，node1 用 `--headless`（不带 HTTP 前端、只跑引擎的模式）只起一个引擎进程；每个引擎进程再拉 8 个 worker 进程（worker = 管一张卡、真正执行前向的那个进程），一个 worker 占一张卡。16 张卡组成一个专家并行域（专家分散在哪些卡上，这些卡就要互相收发 token），每台机器内部 8 张卡组成一个张量并行域（同一个矩阵被横着切给这 8 张卡）。启动时每张卡加载自己那份 W8A8 权重，先拿假数据跑一遍前向（profile，目的是量出激活最多占多少显存），再把剩下的显存一次性切成 KV 块，最后把几种固定批量尺寸的 decode 前向录成图（decode 图：把一次前向的算子序列预先录下来，之后按同样尺寸回放，省掉逐个下发算子的开销）。

### 怎么走的

1. **node0（无 `--headless`）**：`vllm serve` → `ServeSubcommand.cmd` → `run_server` → `launch_core_engines`
   `vllm@0fc695fc:vllm/v1/engine/utils.py#L1049-L1200`。
   其中创建 `DPCoordinator`（`#L1092`）和 `CoreEngineProcManager`（`#L1172`），后者按 `data_parallel_size_local=1` 只拉起本机的 1 个引擎进程。
2. **node1（`--headless`）**：`run_headless` `vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L173-L245`。
   它不建前端、不建协调器，只按 `data_parallel_start_rank=1` 起 1 个 `CoreEngineProcManager`，握手地址是 `node0_ip:12321`（`#L224-L232`）。
3. **引擎进程**：`DPEngineCoreProc.__init__` `vllm@0fc695fc:vllm/v1/engine/core.py#L1701-L1748`；
   `_init_data_parallel` 建立跨机的 **CPU（gloo）DP 进程组** `#L1750-L1764`，这条组只用来同步“还有没有活”，与卡上的 HCCL DP 组是两回事。
4. **执行器**：`MultiprocExecutor._init_executor` `vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L110-L247`。
   `world_size = tp × pp × pcp = 8`（`#L118-L119`、`#L249-L260`），据此 fork 8 个 `WorkerProc`（`#L176-L211`），并建立一条共享内存广播队列 `rpc_broadcast_mq`（`#L151-L157`）。
5. **worker 起卡**：`NPUWorker.init_device` → `_init_device` → `_init_worker_distributed_environment`
   `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L505-L525`、`#L975-L988`。
   后者按 `hccl` 建全局通信域，再 `ensure_model_parallel_initialized(tp=8, pp=1, pcp=1, dcp=1)` 与 `init_ascend_model_parallel`（建 MC2 组）。
   全局 rank 的偏移在 `vllm@0fc695fc:vllm/distributed/parallel_state.py#L1545-L1551`：`rank = dp_rank * 8 + local_rank`，`world_size = world_size_across_dp = 16`。
6. **模型与量化**：`--quantization ascend` 是 vllm-ascend 在解析器里补进去的选项
   `vllm-ascend@db701c1f:vllm_ascend/platform.py#L190-L200`，对应 ModelSlim 的 `AscendModelSlimConfig`。GLM 的实现类在 `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py`（`AscendGlm5NextForCausalLM`，`#L2437`）。
   - **6a. 加载权重（默认路径）**：`WorkerProc` 在 `init_device()` 之后调 `load_model()`（`vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L626-L634`）。`load_format` 默认是 `auto`，对应 `DefaultModelLoader`，依次做四件事：在卡上开空参数 → 读 safetensors → 各层 `weight_loader` 截出本卡分片拷上卡 → 昇腾版后处理把权重变成 processed layout。MTP 草稿层再单独走一遍。展开见 §A0.7。`[C]`
   - **6b. 变体：RFork 热启动**：`--load-format rfork` 时，把 6a 的「从磁盘读」换成「按地址读 seed 实例显存里的权重字节」，借不到 seed 就回退到 6a。官方 GLM 双机教程没有开它。展开见 §A0.8。`[C]+[S]`
7. **量显存**：`EngineCore._initialize_kv_caches` `vllm@0fc695fc:vllm/v1/engine/core.py#L236-L317`
   → `model_executor.determine_available_memory()` → 每个 worker 跑 `NPUWorker.determine_available_memory`
   `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L527-L597`。
   预算是 `requested_memory = 卡总显存 × gpu_memory_utilization`（`#L469`），可用 KV 显存 = `requested_memory − (权重 + 激活峰值 + 非 torch 占用)`（`#L590`）。
8. **切块**：`get_kv_cache_configs` → （被 vllm-ascend 替换的）`get_kv_cache_groups` 与 `_get_kv_cache_config_deepseek_v4`
   `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L517-L548`、`#L647-L698`。
9. **捕获图**：`NPUWorker.compile_or_warm_up_model` `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L693-L784`，
   先按 `cudagraph_capture_sizes` 之外的尺寸做 warmup `_dummy_run`，再 `capture_model()`。

### 在我们部署下的具体数字

#### A0.1 进程账

| 节点 | 进程 | 个数 |
|---|---|---|
| node0 | API server（`--api-server-count 1`） | 1 |
| node0 | DP 协调器 `DPCoordinatorProc` | 1 |
| node0 | EngineCore（DP rank 0） | 1 |
| node0 | WorkerProc（卡 0–7） | 8 |
| node1 | EngineCore（DP rank 1，headless） | 1 |
| node1 | WorkerProc（卡 8–15，本机可见设备 0–7） | 8 |

合计 20 个进程，其中 16 个占卡。`[C]` 依据上面第 1–4 步。

口径：按角色计，API server、DP 协调器、EngineCore、Worker 各算一个。node0 的 API server 就是执行 `vllm serve` 的那个进程（`--api-server-count 1`，`vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L146-L148`）。node1 执行 `vllm serve --headless` 的启动进程在拉起引擎后停在 `engine_manager.monitor_engine_liveness()`（`#L235-L253`），既不退出，也不承担任何角色，所以不计入。按进程列表数，vLLM 自己的进程是 node0 11 个、node1 10 个，合计 21 个。Python 标准库按需另起的辅助进程，以及 EPLB 等特性另起的进程，也都不计。`[C]`

#### A0.2 通信域

- **TP 组（8 rank，机内）**：`[0..7]`、`[8..15]`。走机内 HCCS。每层 attention 的 o_proj、MLP 的 down_proj 后面的 all-reduce 在这个域里。
- **DP 组（2 rank，跨机）**：`[0,8]`、`[1,9]` … `[7,15]`。
- **EP / MC2 组（16 rank，跨机）**：`[0..15]`，由 `all_ranks.transpose(1,2).reshape(-1, dp×pcp×tp)` 得到，即 `2×1×8 = 16`。MoE 的 dispatch / combine 走这条。`[C]` `vllm@0fc695fc:vllm/distributed/parallel_state.py#L1850-L1875`。
- **CPU gloo DP 组（2 rank，跨机）**：只承载 `[has_unfinished, pending_pause]` 这个 2 元素 int32 张量的 all-reduce。`[C]` `vllm@0fc695fc:vllm/config/parallel.py#L683-L707`。

#### A0.3 每张卡上放了什么（权重）

分片规则 `[C]`（按 `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py` 各层的 Linear 类型）：

- 路由专家：按 EP=16 切，每卡 288/16 = **18 个专家**。
- KDA 的 q/k/v/o、MLA 的 q_b/kv_b/o_proj、稠密 MLP、共享专家：按 TP=8 切。
- MLA 的 `fused_qkv_a_proj`、indexer 的 `wk_weights_proj`：`disable_tp=True`，**每卡整份**（`#L1918-L1925`、`#L1284-L1291`）。
- 嵌入与 lm_head：按 vocab 切 8 份。
- MTP 第 45 层：同样有一整套 MoE（每卡 18 个专家）、MLA 和 `eh_proj`，与主干分开计（`[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L53-L57`、`#L84-L92`）。

**参数个数**（不是字节数，`[D]`）：

```
每卡专家参数 = 18 experts × 3 矩阵 × 4096 × 2048 × 42 个 MoE 层
             = 452,984,832 /层 × 42 = 19,025,362,944 个
每卡 KDA    = (3×4096×8192 + 8192×4096)/8 = 16,777,216 个/层 × 34 层 = 570,425,344 个
每卡 MLA    = fused_qkv_a 8,388,608（整份）+ q_b 3,145,728 + kv_b 2,097,152
            + o_proj 8,388,608 + indexer wq_b 786,432 + wk 655,360（整份）
            = 23,461,888 个/层 × 11 层 = 258,080,768 个
每卡稠密层  = 3×4096×12288/8 = 18,874,368 个/层 × 3 层 = 56,623,104 个
每卡共享专家 = 3×4096×2048/8 = 3,145,728 个/层 × 42 层 = 132,120,576 个
每卡嵌入+lm_head = 2 × 154880×4096/8 = 158,597,120 个
```

换成字节要乘 dtype：路由专家是 W8A8 量化的主体，按 1 B/参数算 **17.72 GiB**；
注意力与嵌入这些层是否量化取决于权重仓库的 `quant_model_description`，按 1 B 算约 1.12 GiB、按 BF16 算约 2.24 GiB。

**每卡权重合计以 02 号底稿 §1.3 为准**（单一真相源，那里逐项按 dtype 算过），本节只给参数个数与分片规则。
02 §1.3 当前的整卡合计是 **21,078 MiB = 20.58 GiB**（主干 20,537 MiB + MTP 层 540.75 MiB），本文 A0.5 的算例向上取整，按 **≈21 GiB** 取值。`[D]`

#### A0.4 block_size 为什么是 640

这是本节最关键、也最容易算错的一步。链条：

1. `CacheConfig.block_size` 默认 16（`[C]` `vllm@0fc695fc:vllm/config/cache.py#L46-L48`、`#L232-L244`）。
2. Ascend 的 `refresh_block_size` 只在 `block_size is None` 时改成 128，并且对 hybrid 模型直接返回
   （`[C]` `vllm-ascend@db701c1f:vllm_ascend/utils.py#L1396-L1432`，调用点 `vllm_ascend/platform.py#L662`）。GLM-5.3-Flash 是 hybrid，所以这一步不改值。
3. 真正定值的是 vllm-ascend 替换掉的 `HybridAttentionMambaModelConfig.verify_and_update_config`
   （`[C]` `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L59-L226`，末尾 `#L228` 完成替换；vLLM 侧的调用点是 `vllm@0fc695fc:vllm/config/vllm.py#L1902-L1903`）。

代入数字：

```
KDA 状态（每层、每请求、TP=8 之后）：
  conv  : (3×64×128)/8 = 3072 ，长度 conv_kernel_size-1+num_spec = 4-1+3 = 6 ，bf16
        = 3072 × 6 × 2 = 36,864 B
  recur : (64/8, 128, 128) = (8,128,128) ，fp32
        = 8 × 128 × 128 × 4 = 524,288 B
  mamba_raw_size = 561,152 B                      [C] patch_mamba_config.py#L92-L100
                                                  [C] vllm_ascend/ops/kimi_kda_state.py#L8-L36

MLA 每 token 每层字节（use_mla ⇒ num_kv_heads = 1，qk_rope_head_dim = 0）：
  attn_token_page_size = kv_lora_rank × 1 × 2 B = 512 × 2 = 1024 B
                                                  [C] patch_mamba_config.py#L112-L118
                                                  [C] vllm@0fc695fc:vllm/config/model.py#L1284-L1288

min_attn_block_size = 128 × ceil(561152 / (128 × 1024)) = 128 × ceil(4.28) = 128 × 5 = 640
block_size          = 128 × ceil(max(16, 640) / 128) = 640                [C] #L131-L139, #L153-L159
```

即：**逻辑块 = 640 个 token**，正好是 5 个 128-token 的 SFA kernel block，一个 MLA 页（640×1024 = 655,360 B）刚好装得下整份 KDA 状态（561,152 B，填充 14.4%）。`[C]+[D]`

同一段代码还定下：

- `mamba_page_size_padded = max(655360, 561152) = 655,360 B` `[C]` `#L185-L203`
- `mamba_block_size = max_model_len = 133120`（因为前缀缓存关闭） `[C]` `#L222-L225`
- `mamba_cache_mode = "none"` `[C]` `vllm@0fc695fc:vllm/model_executor/models/config.py#L386-L394`

conv 长度 6 在两条路径上是一致的，不存在分块用 6、分配用 3 的分歧：

- 分块路径用 `AscendGlm5NextForCausalLM.get_mamba_state_shape_from_config` → `kimi_kda_state_shape(..., num_spec=3)` `[C]` `vllm_ascend/ops/kimi_kda_state.py#L8-L36`。
- 分配路径走每层的 `get_state_shape`。decoder 层实例化的是上游 `KimiGatedDeltaNetAttention`（`[C]` `vllm_ascend/models/glm5_next.py#L2080-L2085`），
  它是 `PluggableLayer`，构造时按类名查 OOT 注册表被替换成 `AscendKimiGatedDeltaNetAttention`
  （`[C]` `vllm@0fc695fc:vllm/model_executor/custom_op.py#L47-L66`；注册在 `vllm_ascend/utils.py#L763-L768`、`#L820`，本轮 vLLM 正是 0.23.0），
  而它的 `get_state_shape` 也调 `kimi_kda_state_shape(..., self.num_spec)` `[C]` `vllm_ascend/ops/kimi_kda.py#L235-L242`。
- 文件里那个用 vLLM 计算器（会丢掉 `num_spec`）的 `AscendGlm5NextLinearAttention.get_state_shape`（`glm5_next.py#L1698-L1705`）在仓库里没有被实例化过，是死代码。`[C]`

#### A0.5 KV 块怎么切、一块多少钱

GLM 走的是 vllm-ascend 专门写的分组器 `[C]` `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L517-L548`：

| 组 | 成员 | 每层每块字节 |
|---|---|---|
| full 组（1 个） | **12** 层 MLA 主 cache + **12** 个 indexer 压缩 cache，交错排列 | MLA：640×1×512×2 = **655,360**；indexer：(640/4)×1×128×2 = **40,960** |
| indexer-state 组（1 个） | **12** 个压缩器状态 cache | 4×1×256×4 = 4,096，填充到 **40,960** |
| KDA 组（3 个） | 34 层 KDA，按 `names[i::3]` 分成 12/11/11 层 | 561,152，填充到 **655,360** |

这里的 12 = 主干 11 层稀疏 MLA（第 3、7、…、43 层）+ **MTP 第 45 层**。MTP 草稿层用的是同一个 KV 池：

- MTP 层号 = `num_hidden_layers` = 45（`[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L84-L92`、`#L131`），构造的是 `AscendGlm5NextDecoderLayer`。
- `is_kda_layer(45)` 要求 `layer_idx < len(layer_types)`，而 `layer_types` 只有 45 项，所以第 45 层走 MLA 分支，带 indexer
  （`[C]` `vllm_ascend/transformers_utils/configs/glm5_next.py#L265-L270`、`vllm_ascend/models/glm5_next.py#L2075-L2105`）。
- 草稿模型复用目标模型的 `static_forward_context`（`[C]` `vllm_ascend/spec_decode/llm_base_proposer.py#L80-L95`、`#L319-L340`），
  并在 `initialize_attn_backend` 里断言草稿层必须出现在 KV cache 组中：`assert not missing_layers, "Draft layers missing from KV cache config"`
  （`[C]` 同文件 `#L400-L456`）。
- runner 通过 `cache_role` 分支把这三份 cache 收进 spec 字典（`[C]` `vllm_ascend/worker/model_runner_v1.py#L5217-L5225`）。

各份 cache 的参数来源：

- MLA 主 cache 的 `head_size = kv_lora_rank + qk_rope_head_dim = 512 + 0`，dtype 在代码里写死 bf16
  `[C]` `vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L69-L77`、`#L121-L137`。
- indexer cache `head_dim = index_head_dim = 128`、`compress_ratio = index_kpool = 4`，用的是上游 `MLAAttentionSpec`，
  `storage_block_size = block_size // compress_ratio = 160`，页 = `160 × 1 × 128 × 2`
  `[C]` `vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L365-L384`；参数出处 `vllm_ascend/models/glm5_next.py#L1255-L1257`、`#L1306-L1313`。
- 压缩器状态 `state_dim = 2 × 128 = 256`，fp32，块大小 = 窗口 = 4
  `[C]` `vllm_ascend/models/glm5_next.py#L1298-L1304`、`#L352-L363`。
- 3 个 KDA 组：34 层 KDA 的最长连续段是 3（0,1,2 / 4,5,6 / …），所以按步长 3 分成 3 组，层数 12/11/11
  `[C]` `patch_kv_cache_utils.py#L459-L514`。

一个 block id 的物理开销 `[C]` 公式在 `patch_kv_cache_utils.py#L666-L673`，计数在 `#L279-L329`：

```
main_slot_count  = max(12 个 MLA, 12, 11, 11) = 12
small_slot_count = 12 个 indexer
bytes_per_block  = 12 × 655,360 + 12 × 40,960
                 = 7,864,320 + 491,520
                 = 8,355,840 B = 7.969 MiB
折合每 token     = 8,355,840 / 640 = 13,056 B = 12 层 × 1,088 B
num_blocks       = 可用KV显存 // 8,355,840
```

`13,056 B/token` 里，主干 11 层占 `11 × 1,088 = 11,968 B`，MTP 第 45 层占 `1,088 B`。`[D]`

同一个 slot 的物理张量被 1 层 MLA 和 3 个 KDA 组各 1 层共享（`shared_by`，`#L674-L697`）；第 12 个主 slot 由 MTP 的 MLA 与 KDA 组 0 的第 12 层（主干第 44 层）共用。它们靠“同一个 id 同一时刻只属于一个组”来互不冲突，所以**占住一个 block id 就等于占住 7.969 MiB**，不管是哪一组在用。

一个算例（`[A]` 卡上 HBM 64 GiB；权重按 A0.3 的 ≈21 GiB；`[A]` 激活峰值 + 非 torch 占用合计 3.4 GiB。**图内存不在这 3.4 里**：`NPUWorker.determine_available_memory` 在录图之前量 torch 峰值（`vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L563`），可用 KV = `requested_memory − non_kv_cache_memory`（`#L590`），而 `capture_model()` 要等 KV 切完才调用（`#L719`）。所以 decode 图的显存从 `gpu_memory_utilization` 之外那 15% 里出，不从下面这 30.0 GiB 里扣。`[C]`）：

```
预算      = 64 GiB × 0.85           = 54.40 GiB
减权重    − 21 GiB                  = 33.4 GiB
减激活等  − 3.4 GiB                 = 30.0 GiB 可用 KV（激活峰值 + 非 torch，不含图）
num_blocks = 30 × 2^30 // 8,355,840 = 3,855 块
可存 token = 3,855 × 640            ≈ 2.47 M token（还要扣掉 KDA/状态占掉的 id，见 A2）
```

`[D]`，三个中间量（权重实测值、激活峰值、非 torch 占用）要看真实启动日志才能定死，见「待核」。后文凡是用到块数的地方都按 3,855 走；换一组假设时，把 `可用KV显存 // 8,355,840` 重算一遍即可，公式本身是 `[C]`。

#### A0.6 图捕获

`cudagraph_mode=FULL_DECODE_ONLY`、捕获尺寸 `[4,8,16,32,64,96,128]`（`[S]` 教程双机命令）。
`uniform_decode_query_len = 1 + num_speculative_tokens = 4` `[C]` `vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L814`，
所以这 7 个尺寸对应 **1、2、4、8、16、24、32 个请求**，最大值 128 正好等于 `max_num_seqs=32 × 4`。`[D]`
`speculative-config` 里的 `enforce_eager: true` 是草稿模型那一侧的开关（`[S]` 教程「Key Parameter Descriptions」），主模型仍然捕获 decode 图。`[I]`

### 对应知识页

`engine-processes.md`、`vllm-engine-core.md`、`npu-worker-lifecycle.md`、`npu-platform.md`、`ascend-patch-system.md`、`platform-plugin-registration.md`、`cann-hccl.md`、`collective-communication.md`、`tensor-parallel.md`、`expert-parallel.md`、`data-parallel.md`、`device-memory.md`、`kv-cache-memory-profiling.md`、`kv-cache-spec.md`、`vllm-kv-block-allocation.md`、`quantization.md`、`acl-graph.md`、`graph-mode-layer.md`、`glm-5-3-flash-two-node.md`、`hardware-devices.md`、`superpod.md`。

### 待核

1. 卡上 HBM 总量：Atlas 800 A2 每卡按 64 GiB 算是 `[A]`，没有在仓库里找到出处。需要一份官方硬件规格或一次真实启动日志的 `Free memory on device (x/y GiB)` 行。
2. 权重实际字节：`model_memory_usage` 的真值，以及哪些张量留在 BF16。KDA 的 q/k/v 走的是上游 `KimiGatedDeltaNetAttention`，投影层传的是 `quant_config=self.quant_config`（`[C]` `vllm@0fc695fc:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L120-L140`），所以是否量化只能由权重仓库的 `quant_model_description` 决定——与 02 号底稿待核 1 是同一件事，合并在那里跟。需要启动日志里 `Actual usage: ... GiB for weights` 那一行。
3. 激活峰值、非 torch 占用：只能从 `compile_or_warm_up_model` 打的那条 `Replace gpu_memory_utilization with --kv-cache-memory=...` 日志读。NPU 图内存是另一笔，它在切完 KV 之后才产生（`worker.py#L719`），本节算例不含它；它到底占多少同样要看日志。
4. 视觉塔：官方 config 的 `architectures` 是 `Glm5NextForConditionalGeneration`，注册到 `glm5_next_multimodal:AscendGlm5NextForConditionalGeneration`（`[C]` `vllm-ascend@db701c1f:vllm_ascend/models/__init__.py#L14-L17`），mamba 形状委托给 `AscendGlm5NextForCausalLM`（`#L643-L657`），所以本节的 KV 数字不变；但视觉塔是否加载、占多少权重，要看 w8a8 权重仓库的 config，未核。
5. 本节没有读官方教程里完整的启动命令块（按任务约束），只按计划 §3 的参数表。`--kv-cache-dtype`、`--block-size`、`--enable-prefix-caching` 在教程里的出现次数为 0（用 `grep -c` 核过），据此认定都走默认值。同样未独立核过的 `[S]` 项：`--api-server-count 1`、`enforce_eager` 的作用面、node0 的 `--data-parallel-start-rank`，以及 `enable_flashcomm1` / `dp_allreduce_on_npu` / `enable_balance_scheduling` 是否保持默认。

### A0.7 默认的权重加载路径（第 6a 步展开）

#### 做了什么

每个 worker 在建好 HCCL 域之后、量显存之前加载权重，分四段：

1. 按本卡分片的形状，在卡上把整张模型的参数一次开好。这时参数是空的。
2. 按文件顺序打开 checkpoint 的 safetensors 文件，把每个张量交给它所在层的 `weight_loader`。TP 切的层只截出本 tp_rank 那一段；路由专家只收本卡的 18 个，其余丢掉。截好的那段从主机内存拷进卡上的参数。
3. 全部拷完后跑一遍昇腾版后处理：int8 权重先转置，再转成 NZ（昇腾矩阵单元使用的分形存储格式），scale 另存一份 FP32 副本。后处理之后，卡上张量的样子和 checkpoint 里不一样，这种样子叫 **processed layout**。
4. 主模型这一遍不收 MTP 草稿层（第 45 层）。草稿模型会把 checkpoint 再过一遍，只收第 45 层。

每卡最终占 **20.58 GiB**，数字以 02 §1.3 为准。

#### 怎么走的

1. **调用点**：`WorkerProc.__init__` 依次调 `init_device()` 和 `load_model()`（`[C]` `vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L626-L634`）。
   接着进 `NPUWorker.load_model`（`vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L668-L679`），再进 `NPUModelRunner.load_model`（`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3717-L3795`）。
   整段包在 `DeviceMemoryProfiler` 里（`#L3729`）。结束时把显存增量记为 `model_memory_usage`，并打一行 `Loading model weights took %.4f GB`（`#L3794-L3795`）。A0 第 7 步从预算里减掉的「权重」就是这个值。`[C]`
2. **选 loader**：`get_model` 调 `get_model_loader(load_config)`（`[C]` `vllm@0fc695fc:vllm/model_executor/model_loader/__init__.py#L125-L145`）。
   `LoadConfig.load_format` 默认 `"auto"`（`vllm@0fc695fc:vllm/config/load.py#L29`），查表 `_LOAD_FORMAT_TO_MODEL_LOADER["auto"]` 得到 `DefaultModelLoader`（`__init__.py#L52-L53`）。
   教程两机命令里 `--load-format` 出现 0 次（`grep -c` 核过），所以走这条。`[C]+[S]`
3. **在卡上建空模型**：`BaseModelLoader.load_model`（`[C]` `vllm@0fc695fc:vllm/model_executor/model_loader/base_loader.py#L43-L82`）在 `with target_device:` 里调 `initialize_model`（`#L53-L59`），参数直接按本卡分片的形状分配在 NPU 上，不填值。
   量化层的形状由 quant method 决定。以路由专家为例：`w13_weight [18, 4096, 4096] int8`、`w2_weight [18, 4096, 2048] int8`，外加 `[18, 4096, 1]` 的 BF16 scale 和 offset（`vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L188-L212`）。`[C]`
4. **找文件**：`DefaultModelLoader.load_weights`（`[C]` `vllm@0fc695fc:vllm/model_executor/model_loader/default_loader.py#L382-L412`）→ `get_all_weights`（`#L288-L307`）→ `_prepare_weights`（`#L97-L209`）。
   目录里没有 `consolidated*.safetensors` 时，`auto` 变成 `hf`（`#L120-L132`）。随后在本地目录下 glob `*.safetensors`，再按 `model.safetensors.index.json` 去重（`#L176-L200`）。
5. **EP 过滤默认关**：`_init_ep_weight_filter`（`[C]` `default_loader.py#L318-L379`）只在 `enable_ep_weight_filter=True` 时生效，而它的默认值是 `False`（`vllm@0fc695fc:vllm/config/parallel.py#L156-L162`）。
   教程里 `ep-weight-filter` 出现 0 次，所以 `local_expert_ids = None`，迭代器不跳过任何张量。`[C]+[S]`
6. **读盘**：`safetensors_weights_iterator`（`[C]` `vllm@0fc695fc:vllm/model_executor/model_loader/weight_utils.py#L893-L1027`）。
   教程两机命令带了 `--safetensors-load-strategy prefetch`（`[S]` `vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L282`、`#L332`），所以分两路同时进行：
   - **后台预取**：起一个守护线程（`#L971-L976` → `_prefetch_all_checkpoints` `#L818-L890`）。本 rank 只预取 `sorted_files[rank::world_size]`（`#L829-L835`），用 8 个线程，每次 `read` 16 MiB（`vllm/config/load.py#L12-L13`）。预取只为把文件读进 OS 页缓存（`_prefetch_checkpoint` `#L801-L815`）。
   - **前台逐个读**：逐文件 `safe_open(st_file, framework="pt")`，对每个名字 `f.get_tensor(name)`，产出 CPU 张量（`#L1021-L1027`）。
   - 启动日志会打一行 `Checkpoint size: %.2f GiB. Available RAM: %.2f GiB.`（`#L922-L928`）。checkpoint 超过可用内存的 90% 时只告警，不中止（`#L917-L919`、`#L961-L969`）。
7. **名字映射与切片**：顶层 `AscendGlm5NextForConditionalGeneration.load_weights`（`[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_multimodal.py#L695-L705`）用 `AutoWeightsLoader` 把权重分给 `visual` 和 `language_model`。
   `language_model` 这一支经 `AscendGlm5NextForCausalLM.load_weights`（`vllm_ascend/models/glm5_next.py#L2519-L2531`）交给 `AscendGlm5NextModel.load_weights`（`#L2321-L2434`），逐个处理：
   - 名字属于 MTP 层（第 45 层）的直接跳过（`#L2346-L2347`），留给草稿模型。
   - 合并与拆分：`gate_proj`/`up_proj` 合成 `gate_up_proj`（`#L2322-L2325`、`#L2377-L2390`）；`q_a_proj` + `kv_a_proj_with_mqa` 合成 `fused_qkv_a_proj`，`wk` + `weights_proj` 合成 `wk_weights_proj`（`#L2326-L2331`、`#L2393-L2404`）；KDA 的 `conv1d.weight` 按 q/k/v 拆成三份（`#L2352-L2363`）。
   - 路由专家按 `expert_params_mapping` 交给 `FusedMoE.weight_loader`，先把全局专家号映射成本卡专家号，不在本卡的得到 -1，直接返回丢弃（`vllm@0fc695fc:vllm/model_executor/layers/fused_moe/layer.py#L849-L881`）。昇腾没有重载这个 loader：`git grep "def weight_loader" db701c1f -- vllm_ascend/` 只有 `vllm_ascend/ops/linear.py#L467` 一处（`AscendColumnParallelLinear`，只对前缀含 `wo_a` 的层特殊处理，其余走 `super()`；GLM 的 `glm5_next.py` 里没有 `wo_a`）。
   - TP 切的层：`ColumnParallelLinear.weight_loader` 按输出维 `narrow`（`vllm@0fc695fc:vllm/model_executor/layers/linear.py#L530-L557`），`RowParallelLinear.weight_loader` 按输入维 `narrow`（`#L1493-L1518`），截出本 tp_rank 那一段后 `copy_` 进 NPU 参数。这一次 `copy_` 就是主机到卡（H2D）的拷贝。`[C]`
8. **后处理，得到 processed layout**：`base_loader.py#L80` 调的 `process_weights_after_loading`，在昇腾上已被换成 `ascend_process_weights_after_loading`（`[C]` `vllm-ascend@db701c1f:vllm_ascend/patch/worker/patch_process_weights_after_loading.py#L31-L64`）。
   它比上游多认一个 `AscendIndexerKPoolMLAAttention`，也就是 GLM 的 MLA（`#L18-L23`、`#L47-L55`）。逐模块的处理如下：
   - **路由专家**（`AscendW8A8DynamicFusedMoEMethod`，`w8a8_dynamic.py#L353-L365`）：`w13_weight`、`w2_weight` 各做 `transpose(1, 2).contiguous()`，再 `npu_format_cast(..., ACL_FORMAT_FRACTAL_NZ)`；scale 和 offset 压成二维，另存一份 `w13_weight_scale_fp32`。
   - **W8A8 Linear**（`AscendW8A8DynamicLinearMethod`，`w8a8_dynamic.py#L127-L152`）：权重做 `transpose(0, 1).contiguous()`，int8 权重经 `maybe_trans_nz` 转成 NZ；scale 展平，另存 FP32 副本。
     `weight_nz_mode` 默认是 1，含义是「只有量化权重转 NZ」（`vllm_ascend/ascend_config.py#L247-L254`、`vllm_ascend/utils.py#L261-L298`），所以 BF16 的 KDA、索引器、`kv_b_proj`、embedding、lm_head 保持 ND。
   - **MLA**：`AscendIndexerKPoolMLAAttention.process_weights_after_loading` 转交给注意力后端的 `impl`（`vllm_ascend/ops/indexer_kpool_mla.py#L139-L140`）。
9. **草稿模型再加载一遍**：`NPUModelRunner.load_model` 接着调 `self.drafter.load_model(self.model)`（`[C]` `model_runner_v1.py#L3743-L3748`，有量化配置时先 `patch_load_weights`）。
   它经 `_get_model` 再调一次 `get_model`（`vllm_ascend/spec_decode/llm_base_proposer.py#L296-L316`）。用的 load_config 与主模型相同，理由是三处源码：
   - `draft_load_config` 默认 `None`（`vllm@0fc695fc:vllm/config/speculative.py#L187`），`get_model` 这时退回 `vllm_config.load_config`（`model_loader/__init__.py#L140`）；
   - 草稿的 `vllm_config` 由 `_create_draft_vllm_config` 从主模型配置 `replace` 出来，`load_config` 原样继承（`vllm@0fc695fc:vllm/v1/spec_decode/llm_base_proposer.py#L1157-L1175`）；
   - 昇腾的 `AscendSpecDecodeBaseProposer` 继承这个上游类（`vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L152`）。

   所以草稿模型又是一个 `DefaultModelLoader`，又做一次 prefetch 和全量迭代。MTP 的 `load_weights` 只收第 45 层的名字（`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L281-L291`）。

#### 在我们部署下的具体数字

**本卡收哪些**（`[C]+[D]`，分片规则见 A0.3，专家编号见 02 §6.3）：

- 全局 rank r（node0 = 0–7，node1 = 8–15）的 `tp_rank = r mod 8`、`ep_rank = r`，收路由专家 `[18r, 18r+18)`。例如 node1 的第 3 张卡 r = 11，收专家 198–215。43 个 MoE 层（含 MTP）每层都收这 18 个。
- TP 切的层取第 `tp_rank` 段。
- 以下每卡收整份（不切 TP）：MLA 的 `fused_qkv_a_proj`；索引器的 `wq_b`、`wk_weights_proj`、`index_kpool_compress_gate`（02 §5.7）；KDA 的 `f_a_proj`/`g_a_proj`（02 §4.4）；MTP 的 `eh_proj`（02 §7.5）；router gate；mHC 混合参数。

**卡上 processed layout，每卡每个 MoE 层**（形状 `[C]` `w8a8_dynamic.py#L188-L212`、`#L353-L365`；字节 `[D]`）：

| 张量 | loader 写入时（checkpoint 布局） | 后处理之后（processed layout） | 字节 |
|---|---|---|---|
| `w13_weight` | `[18, 4096(2I), 4096(H)]` int8，ND | `[18, 4096(H), 4096(2I)]`，FRACTAL_NZ | 288 MiB |
| `w2_weight` | `[18, 4096(H), 2048(I)]` int8，ND | `[18, 2048(I), 4096(H)]`，FRACTAL_NZ | 144 MiB |
| `w13_weight_scale` / `_offset` | `[18, 4096, 1]` BF16 | `[18, 4096]` | 各 144 KiB |
| `w2_weight_scale` / `_offset` | `[18, 4096, 1]` BF16 | `[18, 4096]` | 各 144 KiB |
| `w13_weight_scale_fp32` | 无 | 新建 `[18, 4096]` FP32，是模块属性，不是参数 | 288 KiB |

稠密 MLP、共享专家、MLA 的三个大投影按 02 §0.4 / §3.4 走 W8A8 Linear（`[I]`）。它们的权重从 `[out, in]` 转成 `[in, out]` 再转 NZ，`weight_scale` 和 `weight_offset` 展平，另存 `weight_scale_fp32`。

**显存**：

```
每卡权重（processed layout）= 21,078 MiB = 20.58 GiB          [D] 以 02 §1.3 为准
  主模型 20,537 MiB（其中路由专家 42 × 432 = 18,144 MiB）
  MTP 层   540.75 MiB（其中 18 个专家 432 MiB；lm_head 与主模型共用，不重复计）
路由专家的 scale/offset/FP32 副本 = 43 层 × 864 KiB = 36.3 MiB     [D] 02 §1.3 未计
  其中 864 KiB = 18 × 4096 × (2+2+2+2+4) B
后处理的瞬时峰值：transpose().contiguous() 先开新张量、再释放旧张量，
  最大的一块是 w13_weight，288 MiB                                [D]
```

**从磁盘读多少、分几步**（步骤 `[C]`，数量 `[D]`）：

整份 checkpoint 的大小 C，按 02 §1.3 的每卡值还原（视觉塔、scale/offset 不计）：

```
路由专家  288 × 43 层 × 3 × 4096 × 2048 × 1 B = 311,653,564,416 B = 290.25 GiB
其余部分  每卡非专家 = 21,078 − 43 × 432 = 2,502 MiB
          其中每卡收整份的（不切 TP，见 02 §4.4 / §5.7 / §7.5）
                           = router gate 4.5 × 43 + mHC 135
                             + MLA 的 fused_qkv_a 8 + 索引器 14.25（wq_b 12 + wk_weights_proj 1.25 + compress_gate 1.0），共 22.25 × 12
                             + KDA 的 f_a_proj/g_a_proj 2.0 × 34 + MTP 的 eh_proj 64
                           = 193.5 + 135 + 267 + 68 + 64 = 727.5 MiB
          （43 = 42 个主干 MoE 层 + MTP 层，12 = 11 个主干 MLA 层 + MTP 层；
            各层 RMSNorm、index_kpool_compress_ape 为 KiB 量级，未列）
          还原成整份 ≈ (2,502 − 727.5) × 8 + 727.5 = 14,923.5 MiB ≈ 14.57 GiB
C ≈ 290.25 + 14.57 ≈ 304.8 GiB
```

加载时的读取分三步：

```
① 后台预取（每 rank）   读 sorted_files[rank::16] 进页缓存，文件大小均匀时 ≈ C / 16 ≈ 19.1 GiB
                         默认进程组有 16 个 rank（A0 第 5 步，world_size = 16），
                         所以 node0 的 rank 0–7 只替本机预热约一半文件（≈ 152 GiB），
                         另一半由 node1 的 rank 8–15 预热到 node1 的页缓存
② 前台迭代（每 rank）   主模型一遍：对 C 的每个张量调一次 get_tensor
                         草稿一遍：同一份 C 再过一次，只留第 45 层
                         每 rank 过手 ≈ 2C ≈ 610 GiB，同一台机器的 8 个 rank 共用页缓存
③ 拷上卡（每卡）         只拷本卡那份 ≈ 20.58 GiB（H2D）；整实例 16 × 20.58 ≈ 329 GiB
                         （每台机器 8 × 20.58 ≈ 165 GiB）
```

①和②同时进行。主机内存装得下 C 时，每台机器从存储实际读约 C ≈ 305 GiB：一半由①读，另一半在②第一次缺页时读。`[I]`

#### 对应知识页

`npu-worker-lifecycle.md`、`quantization.md`、`matmul-and-weights.md`、`moe.md`、`expert-parallel.md`、`tensor-parallel.md`、`device-memory.md`、`kv-cache-memory-profiling.md`、`speculative-decoding.md`。model loader 和 safetensors 读取目前没有独立的知识页，本节就是它的底稿。

#### 待核

1. checkpoint 的实际大小与文件数：看启动日志 `Checkpoint size: … GiB`（`weight_utils.py#L922-L928`）。本节的 ≈ 305 GiB 是按 02 §1.3 还原的，视觉塔和 scale/offset 未计入。
2. 主机可用内存是否 ≥ C 的 90%：它决定预取会不会告警，也决定页缓存能不能装下整份 checkpoint。需要 Atlas 800 A2 主机内存规格，或同一行日志里的 `Available RAM`。
3. 权重目录放在本地盘还是共享存储，决定两台机器是各读一份还是同读一份。教程只写了 `/path/to/GLM-5.3-Flash-w8a8`（`GLM5.3-Flash.md#L269`、`#L318`）。
4. 加载耗时和实际显存：看 `Loading weights took %.2f seconds`（`default_loader.py#L396-L400`）和 `Loading model weights took %.4f GB`（`model_runner_v1.py#L3795`）。后者就是 A0 待核 2 要的 `model_memory_usage`。
5. ②里对随后会被丢弃的非本卡专家调 `get_tensor`，是否真的触发读盘，取决于 safetensors 的 mmap 实现。本节按 vLLM 自己对 EP 过滤的说明取「会读」（`vllm/config/parallel.py#L156-L162`）。`[I]`
6. 打开 `--enable-ep-weight-filter` 可以把每 rank 读的专家降到 18/288，它在昇腾上能否直接用需要实测。已核的部分：vLLM 侧的 `ep_rank` 算法与本部署一致（`default_loader.py#L357-L371`）；昇腾侧只在 EPLB 打开时把它换成空函数（`model_runner_v1.py#L3730-L3734`）。
7. MLA 的 `impl.process_weights_after_loading` 具体生成哪些运行期张量，本节没有展开。官方 RFork 文档举的例子是 `W_UV`、`W_UK_T`（`vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/rfork.md#L67-L72`）。

### A0.8 A0 变体：RFork 热启动（第 6b 步展开）

本节源码以工作版 `rfork@3284850b`（工作树 `tools/repos/rfork`，用 `git -C tools/repos/rfork show 3284850b:<path>` 读）为准。与 `vllm-ascend@db701c1f` 自带社区版的差异，集中列在本节末尾的对照表里。

**版本口径**（`[!]`）：工作版这棵树里**没有 GLM-5.3-Flash 的模型实现**。`git -C tools/repos/rfork ls-tree -r --name-only 3284850b` 里没有 `vllm_ascend/models/glm5_next*.py`，工作版带的模型是 DeepSeek-V4、Kimi-K3、MiniMax 等；GLM 的主模型与 MTP 只在 `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py`、`glm5_next_mtp.py` 里（注册见 `db701c1f:vllm_ascend/models/__init__.py#L19-L24`）。所以本节是把「工作版的 RFork loader」和「`db701c1f` 的 GLM 模型」放在一起推演出来的，不对应任何一个可以直接运行的 commit。真要跑，先确认两边合并后的代码。凡是涉及 GLM 模型本身的行号（第 9 步的 MTP 注册名、草稿的 `embed_tokens`/`shared_head`），引的都是 `db701c1f`。

#### 做了什么

RFork 要解决的是扩副本或重启时的等待。按 A0.7，每个新实例都要从存储读约 305 GiB 的 checkpoint，名字映射、切片之后再拷上卡。开了 `--load-format rfork` 的新实例，每个 worker 按下面的顺序走：

1. 照常在卡上建好空模型。W8A8 下还要对空参数跑一遍后处理，做出和 seed 一模一样的 processed layout。
2. 拿自己的 seed key 向外部的 Planner 申请一台身份相同的 seed worker。
3. 通过 YuanRong TransferEngine，按地址把 seed 显存里的权重字节直接读进自己的参数缓冲区。
4. 读完后，等借来的租约归还了，再把自己也登记成 seed，供下一个实例借。租约归还在后台线程里做，还没还完时先只做推理，归还后再补发布。

失败处理：Planner 没有可借的 seed，或任何一步出错，就先清理已登记的内存和半成品模型，再用 A0.7 的默认 loader 从磁盘加载，加载完同样登记成 seed。

RFork 只替换「权重字节从哪里来」。HCCL 建域（A0 第 5 步）、量显存（第 7 步）、切 KV 块（第 8 步）、捕获图（第 9 步），以及 A1–A7、B1–B3 的所有数字都不变。唯一可能的例外是草稿自带的两份词表张量被登记钉住、少掉约 38 个 KV 块，按源码推得，尚未实测，见本节待核 6。

#### 怎么走的

1. **注册与开启**：`@register_model_loader("rfork")`（`[C]` `rfork@3284850b:vllm_ascend/model_loader/rfork/rfork_loader.py#L414-L415`）。
   启动命令加 `--load-format rfork`，配置走 `--model-loader-extra-config` 的 JSON，或者环境变量兜底（`config.py#L100-L136`）。三项必填：`model_url`（`MODEL_URL`）、`model_deploy_strategy_name`、`rfork_scheduler_url`（`RFORK_SCHEDULER_URL`），缺一项 `RForkSession` 就报错（`session.py#L38-L44`）。官方用法见 `[S]` `vllm-ascend@db701c1f:docs/source/user_guide/feature_guide/rfork.md#L32-L47`。
2. **绕过条件**：`_is_dynamic_eplb_enabled`（`[C]` `rfork_loader.py#L373-L383`）判三个量：`enable_eplb`、`eplb_config.dynamic_eplb`、`eplb_config.expert_map_record_path`。任一为真就直接走默认 loader，只打一条 warning（`#L540-L561`）。教程两机命令里 `enable-eplb` 出现 0 次，不触发。
3. **算身份、建空模型**：`_ensure_rfork_session`（`[C]` `#L441-L490`）先取四个编号：`global_rank`、`tp_rank`、`ep_rank = get_ep_group().rank_in_group`（`#L153-L161`）、`pp_rank`（PP = 1 时为 `None`，`#L164-L171`）。
   然后做两次 SHA256：
   - 兼容性指纹 `build_compatibility_fingerprint`（`identity.py#L196-L251`），输入是 `model_url`、strategy、revision、dtype、`quantization`、量化配置摘要、架构描述、TP/PP/EP/DP 大小、`enable_expert_parallel`、`weight_nz_mode`、硬件布局策略；
   - seed key `build_seed_key`（`#L254-L287`），输入是指纹 + `tp_rank` + `pp_rank` + `ep_rank` + `is_draft_worker`。

   然后在 `with target_device:` 里调 `initialize_model`（`rfork_loader.py#L572-L577`）。
4. **判定 processed layout 并先做后处理**：`_requires_processed_layout_transfer`（`[C]` `#L503-L519`）在 `quantization` 非空时直接返回 True。
   为真时先对空模型跑 `process_weights_after_loading`，MoE 这里换成去掉包装的原始后处理（`#L354-L370`），再调 `torch.npu.synchronize()`，等异步的 NZ 转换全部落地（`#L593-L608`）。
5. **申请 seed**：`session.acquire_seed()`（`[C]` `session.py#L64-L91`）→ `RForkPlannerClient.acquire_seed`（`planner_client.py#L69-L109`）。
   请求是 `GET {planner_url}/get_seed`，带请求头 `SEED_KEY`；Planner 在响应头里回 `SEED_IP`、`SEED_PORT`、`USER_ID`、`SEED_RANK`。404 表示没有可借的 seed，其他异常也返回 `None`。
   拿不到时，loader 抛 `_RForkSeedUnavailable`（`rfork_loader.py#L610-L620`）。
6. **读权重**：`session.transfer_from_seed`（`[C]` `session.py#L103-L148`）分三段：
   - **登记本地内存** `register_memory_region`。先收集要传的张量：processed layout 下收参数、buffer 和各模块上公开的张量属性，排除 `topk_indices_buffer`（`tensor_layout.py#L21`、`#L155-L174`）。再从 NPU 显存快照里挑出与这些张量重叠的已分配块并合并，减掉草稿需要排除的块（`transfer_backend.py#L40-L69`、`#L362-L363`），按每批 ≤ 4096 项调 `batch_register_memory_ex`（`#L35`、`#L405-L422`）。
   - **向 seed 取元数据** `fetch_seed_transfer_info`：`GET http://SEED_IP:SEED_PORT/get_rfork_transfer_engine_info?seed_key=…`（`seed_client.py#L89-L96`；seed 侧路由在 `seed_server.py#L162-L172`）。拿回 seed 的 TransferEngine `session_id` 和逐张量清单（地址、长度、元素大小、形状、dtype）。
   - **按地址读** `read_weights_from_seed`（`transfer_backend.py#L616-L793`：公开方法 `#L616-L624`，实现在 `_read_weights_from_seed_locked` `#L626-L793`）：
     - 两边的名字集合必须一致，草稿与主模型共享的张量除外（`#L668-L710`）。
     - `validate_weight_manifest` 逐张量核 shape、numel、itemsize、dtype，并要求张量条数与总字节两边相等（`manifest.py#L164-L252`，条数与总字节在 `#L244-L252`）。
     - 每个张量读 `numel × element_size` 字节，由 `iter_transfer_chunks` 分批（`transfer_backend.py#L121-L152`）：先把每个张量切成 ≤ 1 GiB 的段，再按「累计 ≤ 1 GiB 且 ≤ 512 段」装成一批（`#L33-L34`）。
     - 逐批调 `batch_transfer_sync_read(session_id, 本地地址, seed 地址, 长度)`（`#L740-L775`）。

     YuanRong 引擎每个 worker 一个，初始化参数是 `initialize("ip:port", "ascend", "npu:<id>")`（`#L207-L233`）。
7. **收尾并成为 seed**：非量化模型走 checkpoint 布局分支，到这一步才跑后处理（`[C]` `rfork_loader.py#L631-L633`）。随后 `model.eval()`，调 `_start_rfork_seed_service`（`#L636-L644`）进入 `start_seed_service`。
   传输成功后，租约归还（`POST /put_seed`）交给后台线程做，不占启动线程（`session.py#L145-L147` → `_ensure_lease_release_retry_locked` `#L150-L168`；`planner_client.py#L111-L127`）。所以走到这一步时，租约可能还没还，`start_seed_service` 分两档（`[C]`）：
   - **租约已还**：依次做三件事。
     - 在 `seed_port_base + global_rank` 端口起 seed 服务；base 为 0 时由系统分配端口。
     - `POST /add_seed` 上报 Planner。
     - 之后每 30 s 心跳一次（`session.py#L364-L400`、`planner_client.py#L213-L220`，默认值见 `config.py#L11-L15`）。
   - **租约没还（`DEFERRED`）**：不起服务，把参数存进 `_deferred_seed_start` 后返回 `DEFERRED`（`session.py#L336-L345`），loader 把它当作「未启动」，本实例先只做推理（`rfork_loader.py#L100-L101`）。后台线程收到 Planner 确认归还后，由 `_promote_deferred_seed_locked` 补做上面三件事（`session.py#L197-L203`、`#L227-L250`）。
     归还默认最多试 3 次、每次间隔 30 s（`config.py#L14-L15`）。Planner 拒绝或 3 次都没成功时，丢掉这次延迟发布，本实例照常推理，但**不会成为 seed**（`session.py#L204-L213`）。
     所以启动线程走完时本实例是否已经是 seed，取决于 `POST /put_seed` 的往返。
8. **回退**：借不到 seed（`_RForkSeedUnavailable`，`#L645-L651`）或任何异常（`#L652-L655`）都进入回退，按下面的顺序处理（`[C]`）：
   1. 调 `session.prepare_for_fallback()`，最多 2 次（`FALLBACK_CLEANUP_MAX_ATTEMPTS`，`#L59`、`#L657-L662`），注销已登记的内存、停掉 seed 服务。
   2. `_reset_process_global_model_state` 撤掉半成品模型在进程级注册表里留下的条目（`#L664-L665`）。
   3. 清理失败就直接报错、拒绝回退，避免旧权重还被钉住时再分配一份模型（`#L667-L671`）。
   4. `gc` 后 `empty_cache`（`#L673-L681`）。
   5. 用 `_make_fallback_load_config`（`load_format` 改为 `"auto"`，extra config 清空，`#L174-L178`）调 `get_model`，走 A0.7 的默认路径，包括教程设的 prefetch（`#L683-L696`）。
   6. 加载成功后以 `load_source="fallback"` 登记成 seed（`#L699-L710`）。
9. **MTP 草稿**：草稿模型继承主模型的 `load_config`（见 A0.7 第 9 步），所以也走 `rfork` loader。它的 seed key 带 `is_draft_worker=True`，是另一套 session（`[C]` `rfork_loader.py#L149-L150`）。
   认草稿靠 `_is_mtp_hf_config`：`model_type` 以 `_mtp` 结尾，或 `architectures` 以 `MTPModel` 结尾（`rfork_loader.py#L112-L126`）。GLM 草稿的注册名 `Glm5NextMTPModel` 满足后一条，但这个名字来自 `db701c1f:vllm_ascend/models/__init__.py#L19`，不在工作版树里（见本节开头的版本口径）。
   `_get_target_registered_blocks` 把主模型已登记的块取来作 `exclude_blocks`（`#L492-L501`），同一段显存不会被登记两次。草稿的张量如果全落在这些块里，就直接复用、不传（`#L584-L591`）。
   **本部署里这条复用分支不触发，草稿自带的 `embed_tokens` 和 `shared_head.head` 也要传**（`[C]`）。原因是先后顺序：
   - RFork 的登记、传输、发布都在 `get_model()` **内部**做完：`initialize_model`（`rfork_loader.py#L572-L577`）→ `session.transfer_from_seed`（`#L623`）→ `eval()` 并发布 seed（`#L636-L643`）→ `return model`（`#L644`）。
   - proposer 把草稿的词表张量换成主模型的，是在 `get_model()` **返回之后**：`self.model = self._get_model()`（`vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L325`）之后才调 `_maybe_share_embeddings` / `_maybe_share_lm_head`（`#L384-L387`），在里面 `del self.model.model.embed_tokens`（`#L548`）、`layer_module.shared_head.head = target_language_model.lm_head`（`#L596`）。工作版的 proposer 顺序相同（`rfork@3284850b:vllm_ascend/spec_decode/llm_base_proposer.py#L464` → `#L535-L537`、`#L638`、`#L703`）。
   - 所以传输时刻，草稿手里还是自己新建的 `VocabParallelEmbedding(154880, 4096)`（`db701c1f:vllm_ascend/models/glm5_next_mtp.py#L145-L149`）和 `SharedHead` 里的 `ParallelLMHead`（`#L79-L83`，类定义 `vllm@0fc695fc:vllm/model_executor/models/deepseek_mtp.py#L43-L57`）。它们是刚分配的独立显存块，不在主模型的 `exclude_blocks` 里（按地址区间判定，`transfer_backend.py#L71-L90`），会被 `collect_processed_layout_tensors` 收进清单（`tensor_layout.py#L155-L174`）。seed 一侧的清单也是在同一时刻登记时生成的（`transfer_backend.py#L396`），两边名字对得上。
   - 02 §1.3 / §7.5 把 `shared_head.head` 记 0、不记草稿的 `embed_tokens`，算的是**共享之后的稳态常驻显存**，和这里「传输时刻有哪些活张量」是两本账。

#### 在我们部署下的具体数字

**seed key 的个数**（`[C]+[D]`）：EP 组 `[0..15]` 的组内序号等于全局 rank（A0.2），所以 rank r 的 key 里是 `tp_rank = r mod 8`、`ep_rank = r`。主模型 16 个 key，草稿 16 个 key，一次热启动一共 **32 次 `get_seed`、32 个租约**。
接收方的 rank r 只能借 seed 实例里同为 rank r 的那个 worker：16 个 rank 各借各的，不是整机借整机。

**每卡要传多少字节**（`[D]`）：

口径与 A0.7 相同，沿用 02 §1.3 的每卡字节，**不含视觉塔（`visual`）和 W8A8 Linear 的 scale/offset/FP32 副本**（见 A0.7 待核 1）。这两样也在张量清单里，会一起传，所以实际字节略大于下式。

```
主模型 session  = 02 §1.3 主干 20,537 MiB
                + 路由专家 scale/offset/FP32 副本 42 层 × 864 KiB = 35.4 MiB
                ≈ 20,572 MiB ≈ 20.09 GiB
草稿 session    = MTP 层 540.75 MiB + 1 层 × 864 KiB
                + 草稿自建的 embed_tokens 151.25 MiB + shared_head.head 151.25 MiB
                ≈ 844 MiB
                  （这两份在传完之后才被 proposer 换成主模型的同名张量，见「怎么走的」第 9 步；
                    所以传输时按草稿自有张量计，稳态显存仍按 02 §7.5 计）
                  每份 = 19,360 × 4096 × 2 B = 151.25 MiB（TP8 切词表，同 02 §2.3）
每卡合计        ≈ 20,572 + 844 ≈ 21,416 MiB ≈ 20.91 GiB
  其中 864 KiB/层 = 18 × 4096 × (2+2+2+2+4) B（w13/w2 的 scale、offset 为 BF16，w13_weight_scale_fp32 为 FP32）
  W8A8 Linear 的 scale/offset/FP32 副本与 buffer 另计，均为 KiB–MiB 量级
整个实例        ≈ 16 × 21,416 MiB ≈ 335 GiB，从 seed 实例 16 张卡的显存读过来
```

**分几批**（`[D]`，规则 `[C]` `transfer_backend.py#L121-L152`）：

```
主模型  每批 ≤ 1,024 MiB → 至少 ⌈20,572 / 1,024⌉ = 21 批
        单个张量最大是 w13_weight 288 MiB < 1 GiB，不会有张量被切段
草稿    ≈ 844 MiB < 1,024 MiB → 张量条数 ≤ 512 时 1 批
```

**W8A8 为什么必须走 processed-layout 分支**（`[C]+[S]`）：

- seed 跑完后处理之后，checkpoint 布局的那份字节已经不在了：`w13_weight.data` 被换成 `transpose(1, 2).contiguous()` 的结果，再 `npu_format_cast` 成 NZ；`w13_weight_scale_fp32` 是后处理新建的属性，checkpoint 里没有它（`vllm-ascend@db701c1f:vllm_ascend/quantization/methods/w8a8_dynamic.py#L353-L365`）。
- seed 显存里只剩 processed layout 这一份。接收方必须先造出名字、形状、dtype、格式都相同的缓冲区，才能按地址对拷，manifest 校验也按这几项比对。
- 量化模型的 `_requires_processed_layout_transfer` 直接返回 True（`rfork_loader.py#L503-L505`）。官方文档 `### Quantized Models` 也写明，量化模型传的是后处理之后的张量（`[S]` `rfork.md#L67-L72`）。
- 由此带来一笔固定开销（`[D]`）：接收方仍要付「建模型 + 对空参数跑一遍转置和 NZ 转换」的时间。RFork 省下的是 A0.7 的第 4–7 步，即找文件、读盘、名字映射与切片、H2D 拷贝。

**适用条件**：

- **YuanRong TransferEngine**：每个实例都要装 `yr.datasystem`，缺了会 `ImportError`（`[C]` `transfer_backend.py#L207-L217`；官方前提 `[S]` `rfork.md#L36-L39`）。
- **Planner**：要实现 `/get_seed`、`/put_seed`、`/remove_seed`、`/add_seed` 四条路由（`[C]` `planner_client.py#L73`、`#L127`、`#L188`、`#L218`）。仓库里带的是 mock：`rfork@3284850b:examples/rfork/rfork_planner.py`。
- **第二个实例**：我们的部署是一个实例，DP2 在实例内部。第一次冷启动必然借不到 seed，走第 8 步回退，还多付一次第 3–4 步（建模型 + 对空参数做后处理）的时间。收益只在扩副本或重启时出现。
  seed 实例还必须同为 TP8 / DP2 / EP16 / W8A8、同一份 checkpoint、同一 `weight_nz_mode`，否则指纹不同，Planner 配不上。`[C]+[D]`
- **官方 GLM 教程**：`vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md` 里 `load-format`、`rfork` 各出现 0 次（`grep -c` 核过），A0 主线走的是 A0.7。`[S]`
- **官方测试过的模型**（`[S]` `rfork.md#L80-L91`）：Qwen2.5-7B、Qwen3-32B、Qwen3-235B-A22B（BF16），DeepSeek-V4-Flash-W8A8-MTP（W8A8，带 MTP 草稿），GLM5-W4A8，Kimi2.5-W4A8，硬件都是 A2。表里没有 GLM-5.3-Flash W8A8。
- **代码基**：工作版 `rfork@3284850b` 树里没有 GLM-5.3-Flash 的模型实现（无 `vllm_ascend/models/glm5_next*.py`），本节是「工作版 RFork loader + `db701c1f` 的 GLM 模型」的组合推演（见本节开头的版本口径）。和上一条「官方测试表里没有 GLM-5.3-Flash W8A8」并列，都是真跑之前要先确认的前提。`[C]`
- **EPLB**：以后若在命令里加 `--enable-eplb`，RFork 会按第 2 步静默退回默认 loader，日志里只有一条 warning。`[C]`

**与社区版的差异**（`[!]`。社区版即 `vllm-ascend@db701c1f:vllm_ascend/model_loader/rfork/`，下表行号不带仓库前缀的，左列指社区版，右列指工作版）：

| 点 | 社区版 `db701c1f`（6 个文件） | 工作版 `rfork@3284850b`（13 个文件） |
|---|---|---|
| 文件 | `__init__`、`rfork_loader`、`rfork_worker`、`seed_protocol`、`seed_server`、`transfer_backend` | 去掉 `rfork_worker`、`seed_protocol`；新增 `session`、`identity`、`manifest`、`planner_client`、`seed_client`、`tensor_layout`、`config`、`types`、`compat` |
| 何时问 Planner | 建模型**之前**先调 `is_seed_available()`（`rfork_loader.py#L264-L265`） | 建完模型、做完后处理**之后**才调 `acquire_seed()`（`#L610-L620`） |
| 后处理后同步 | 没有 `torch.npu.synchronize()`（`#L275-L277`） | 有（`#L603`） |
| 绕过条件 | `layer_sharding` 或 dynamic EPLB（`#L110-L124`、`#L236-L239`） | 只有 dynamic EPLB（`#L373-L383`；目录内 `git grep layer_sharding` 0 命中） |
| seed key | 明文 `model_url$strategy$<disaggregation_mode>$<node_rank>$[pp]$<tp_rank>$[ep]$[draft]`，含 `node_rank`，不含 dtype、量化、并行大小（`seed_protocol.py#L28-L59`） | SHA256（兼容性指纹 + tp/pp/ep + draft），不含 `node_rank`（`identity.py#L196-L287`） |
| 收集张量 | 只有一种收集法，按 `data_ptr` 去重（`transfer_backend.py#L149-L204`） | 分 processed 和 checkpoint 两种；按名字去重，冲突时报错；排除 `topk_indices_buffer`（`tensor_layout.py#L118-L197`） |
| 清单校验 | 逐张量核 numel 与 element_size（`transfer_backend.py#L435-L442`） | 另核 dtype、张量条数与总字节（`manifest.py#L164-L252`） |
| 分批 | 1 GiB / 512 条，单个张量不切段（`#L27-L28`、`#L215-L248`） | 先把张量切成 ≤ 1 GiB 的段再分批（`#L121-L152`）；本部署最大张量 288 MiB，两种切法结果相同 |
| 内存登记 | `batch_register_memory(addresses, sizes)`（`#L344`） | `batch_register_memory_ex` + `MemoryRegistration`，保活 storage owner，每批 ≤ 4096 项（`#L405-L422`） |
| MTP 草稿 | 不排除与主模型重叠的地址 | 用 `exclude_blocks` 减掉主模型已登记的块，全部共享时直接复用（`rfork_loader.py#L492-L501`、`#L584-L591`） |
| 非量化分支的顺序 | 先 `start_seed_service`，再跑后处理（`#L291-L293`） | 先跑后处理、`eval()`，再发布 seed（`#L631-L644`） |
| 回退清理 | `post_transfer` + `reset_transfer_state`，然后 `del model`（`#L296-L308`） | `prepare_for_fallback` 最多 2 次，重置进程级模型状态，清理失败则拒绝回退（`#L657-L681`） |

#### 对应知识页

`rfork.md`、`rfork-terms.md`、`rfork-startup.md`、`rfork-identity.md`、`rfork-layout.md`、`rfork-memory.md`、`rfork-transfer.md`、`rfork-lifecycle.md`、`rfork-config.md`、`rfork-troubleshooting.md`、`rfork-maintenance.md`（以上在 `wiki/concepts/`），`rfork-official-guide.md`（在 `wiki/sources/`）；另有 `quantization.md`、`speculative-decoding.md`、`expert-parallel.md`。

#### 待核

1. 现场有没有装 YuanRong TransferEngine，有没有生产用的 Planner，会不会起第二个同构实例。
2. 每卡实际传输字节、批数与吞吐：看 info 级日志 `RFork weight transfer completed: weights=%d, chunks=%d, bytes=%.2f GiB, elapsed=%.4fs, throughput=%.2f GiB/s`（`transfer_backend.py#L784-L791`），用来核本节的 ≈ 20.91 GiB（主模型 ≈ 20.09 GiB + 草稿 ≈ 844 MiB）和「主模型 ≥ 21 批」。
3. **已核（不再待核）**：草稿 session 里的 `embed_tokens` 和 `shared_head.head` 在**传输时不共用**，都不在 `exclude_blocks` 里，要传。共用发生在 `get_model()` 返回之后，见「怎么走的」第 9 步；字节已计入上面的 ≈ 844 MiB。`[C]`
4. processed layout 收集的 buffer 与各模块公开张量属性的完整清单，以及其中有没有应当排除、却没排除的运行期 scratch。已知只排除了 `topk_indices_buffer`（`tensor_layout.py#L21`）。
5. 各阶段耗时：看日志 `RFork transfer stages: … registration=… metadata=… read=…`（`session.py#L138-L145`）和 `RFork %s model layout processing took %.2f seconds`（`rfork_loader.py#L604-L608`），与 A0.7 待核 4 的默认路径耗时对比。
6. 草稿自带的两份词表张量会不会被登记一直钉在显存里。登记按 storage owner 保活（`transfer_backend.py#L153-L175`，登记时存进 `_registered_transferable_storages`，`#L401`）。所以 proposer 之后 `del embed_tokens`、换掉 `shared_head.head`，也释放不了这两段显存。按源码推，本实例作为 seed 期间每卡会多占约 302.5 MiB（2 × 151.25）。KV 预算是在加载之后量的，折成 KV 块约少 302.5 MiB ÷ 8,355,840 B ≈ 38 块（A0.5 的算例 3,855 → 约 3,817）。这是新增推断 `[C]+[D]`，**未实测**：要对比同一配置下 `--load-format rfork` 与默认加载的 `Loading model weights took … GB` 和 KV 块数日志。A0.5 与 B 段的块数仍按默认路径的 3,855 写。

---

## A1 入口：HTTP → API server → 分词 → AsyncLLM → 选 DP 组 → EngineCore

### 做了什么

一条 HTTP 请求进到 node0 的 API server 进程，先套上聊天模板（模型训练时约定的对话格式，规定 system/user 各段怎么拼、用哪些特殊标记分隔），再由分词器变成一串 token id，包成一个 `EngineCoreRequest`（引擎之间传递请求用的数据结构），由负载均衡逻辑挑一个 DP 组（挑的是 DP0 还是 DP1），通过 ZMQ（进程间消息库）送进那个引擎进程的输入队列。

### 怎么走的

1. `POST /v1/chat/completions` → `create_chat_completion`
   `vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/api_router.py#L39-L73`
2. `OpenAIServingChat.create_chat_completion` `…/chat_completion/serving.py#L219-L260`
   → `render_chat_request` `#L192-L217` → `OpenAIServingRender.render_chat`
   `vllm@0fc695fc:vllm/entrypoints/serve/render/serving.py#L183-L256`
   → `preprocess_chat`（套模板、调 tokenizer，产出 `EngineInput`）
3. `self.engine_client.generate(...)` `…/chat_completion/serving.py#L341-L356`
   → `AsyncLLM.generate` → `AsyncLLM.add_request` `vllm@0fc695fc:vllm/v1/engine/async_llm.py#L280-L398`
   - `input_processor.process_inputs(...)` `#L349-L360` 产出 `EngineCoreRequest`
   - `output_processor.add_request(...)` `#L409`：在**前端进程**登记这条请求的反分词器与输出队列
   - `engine_core.add_request_async(request)` `#L412`
4. 选 DP 组：`DPLBAsyncMPClient.get_core_engine_for_request`
   `vllm@0fc695fc:vllm/v1/engine/core_client.py#L1398-L1426`
   - 若请求头里带了 `data_parallel_rank`（`…/chat_completion/serving.py#L269-L270` 取的），直接用它；
   - 否则按 `score = waiting × 4 + running` 取最小的那一组（`#L1405-L1418`）；
   - 选中后本地把该组的 waiting 计数加 `client_count`，抵消协调器 100 ms 刷新的滞后（`#L1419-L1421`）。
5. 发送：`add_request_async` `#L1344-L1357`。若此时所有引擎处于暂停状态（`engines_running=False`），还要给协调器发一条 `FIRST_REQ`，把整个 DP wave 叫醒。
6. 引擎侧收：DP 部署下入口是 `DPEngineCoreProc._handle_client_request` `vllm@0fc695fc:vllm/v1/engine/core.py#L1836-L1855`
   （它比基类多处理 `START_DP_WAVE`），基类实现在 `#L1336-L1350`
   → `EngineCore.preprocess_add_request` `#L819-L841`（构造 `Request` 对象）
   → `DPEngineCoreProc.add_request` `#L1789-L1803`（顺带对齐 wave 号）→ 基类 `EngineCore.add_request` `#L341-L377`
   → `Scheduler.add_request` `vllm/v1/core/sched/scheduler.py#L1801-L1823`，进 waiting 队列。

### 在我们部署下的具体数字（R1）

- prompt 4 个 token，`[4]` 的 int id 列表。4 是为演示取的设定，指送进引擎的 `prompt_token_ids` 总数，不是哪条真实请求套完模板后的长度：GLM-5.3-Flash 的聊天模板给单条消息加的特殊标记就有 6 个，再加 system 行和正文，真实请求至少十几个 token。与序列长度有关的形状和字节随之变大，机制不变。`[A]`（依据 `docs/mainline/review/r1-realism-2026-09-28.md` §1、§3）
- `EngineCoreRequest` 里与后面几站直接相关的字段：`prompt_token_ids`（4 个）、`sampling_params`、`data_parallel_rank`（未指定则为 None）由 `process_inputs` 填（`[C]` `vllm@0fc695fc:vllm/v1/engine/async_llm.py#L349-L360`）；`current_wave` 与 `client_index` 由客户端在发送前覆写（`[C]` `vllm/v1/engine/core_client.py#L1347-L1349`）。
- 路由打分（场景 M 的两组计数 DP0 = (0 waiting, 12 running)、DP1 = (0, 7)）：
  ```
  score(DP0) = 0×4 + 12 = 12
  score(DP1) = 0×4 + 7  = 7     → 选 DP1
  ```
  也就是说，场景 M 里那条 6000 token 的请求要落在 DP0，只可能是两种情况：请求头显式指定了 `data_parallel_rank=0`，或者协调器上一轮（≤100 ms 前）推送的计数还没反映出 DP0 的 12 条。`[C]+[D]`
  连续发 N 条时，客户端每发一条就把所选组的 waiting 本地 +1，等价于每条给它加 4 分，所以短时间内会在两组之间交替。`[C]` `#L1415-L1421`
- 计数从哪来：引擎每步前后调 `_maybe_publish_request_counts` `vllm@0fc695fc:vllm/v1/engine/core.py#L1856-L1867` → `Scheduler.get_request_counts`（`len(waiting), len(running)`，`scheduler.py#L1797-L1799`）→ 协调器按 ≥100 ms 聚合后广播（`vllm/v1/engine/coordinator.py#L149-L157`、`#L257-L278`、`#L395-L405`）。

### 对应知识页

`request-call-chain.md`、`one-request.md`、`token.md`、`engine-processes.md`、`vllm-engine-core.md`、`data-parallel.md`、`dyntra-lb.md`、`glm-5-3-flash.md`。

### 待核

1. **已核（不再待核）**：R1 的 4 是套完模板、送进引擎的 token 总数（演示设定，见上文「具体数字」第一条），不是模板前的正文长度。用 jinja2 渲染模型仓库 690b7052 的 `chat_template`，单条消息得到 `[gMASK]<sop><|system|>Reasoning Effort: Max<|user|>…<|assistant|><think>`，共 6 个特殊标记；system 行一定出现，推理强度只取 low、high、max 之一。依据：`docs/mainline/review/r1-realism-2026-09-28.md` §1、§3。残余：system 行的 token 数（本地按 tokenizer.json 复算为 6，空消息合计 12 个）还没用官方 tokenizers 库复核。
2. `--api-server-count 1` 时 `client_count` 为 1；若以后改成多 API server，打分里的 `client_count` 与 `eng_start_index`（`#L1394-L1396`）会改变分布，这里没有展开。

---

## A2 调度第一步：token 预算、KV 块分配、前缀缓存

### 做了什么

引擎进程里的调度器每一步做三件事：先给还在跑的请求各要一点 token 预算和新 KV 块，再看 waiting 队列能不能塞进新请求，最后把「谁算多少 token、用哪些块」打包成 `SchedulerOutput` 发给 8 个 worker。

### 怎么走的

1. `EngineCoreProc.run_busy_loop` → `_process_engine_step` → `EngineCore.step`
   `vllm@0fc695fc:vllm/v1/engine/core.py#L443-L473`
2. `Scheduler.schedule` `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L967`
   - **先排 running**（`#L376-L551`）：每条请求 `num_new_tokens = num_tokens_with_spec + num_output_placeholders − num_computed_tokens`，再被 `token_budget` 和 `max_model_len − 1 − num_computed` 夹一次（`#L403-L416`）。
   - **要块**：`KVCacheManager.allocate_slots(request, num_new_tokens, num_lookahead_tokens=3)`（`#L460-L466`）。
   - **再排 waiting**（`#L562-L830`）：先 `get_computed_blocks` 查前缀缓存（`#L611-L613`），再 `allocate_slots`（`#L761-L772`），成功才 `self.running.append(request)`（`#L826`）。
   - **计数前移**：`_update_after_schedule` `#L997-L1013` 在这一步就把 `num_computed_tokens` 加上去。
3. `KVCacheManager.allocate_slots` `vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L238-L436`
   - `num_tokens_need_slot = min(已算 + 新算 + lookahead, max_model_len)`（`#L370-L373`）
   - 逐组问 `coordinator.get_num_blocks_to_allocate`（`#L385-L393`），和 `block_pool.get_num_free_blocks()` 比（`#L395-L398`），不够就返回 `None`。
4. 每组自己的算法：
   - full 组 / state 组：`SingleTypeKVCacheManager.get_num_blocks_to_allocate`
     `vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L101-L140`，`ceil(num_tokens / block_size) − 已持有`。
   - KDA 组：`MambaManager.get_num_blocks_to_allocate`
     `vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1054-L1120`。`mamba_cache_mode != "align"` 这一支会先把 `num_tokens` 加上 `block_size × num_speculative_blocks`，再走通用公式。
     注意这个类被 `AscendMambaManager` 替换过（`[C]` `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_manager.py#L18-L84`，导入点 `vllm_ascend/patch/platform/__init__.py#L43`），
     替换版只改了前缀命中与外部 KV 的分支，本部署（无 KV connector、前缀缓存关闭）下每组仍是 4 块。
     但外部 KV 分支的判断 `total_computed_tokens > len(new_computed_blocks) × block_size` 且有新 token（`patch_mamba_manager.py#L76-L80`）对每条 c > 0 的运行中请求都成立（它们传入的 `new_computed_blocks` 为空，`vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L339-L342`），所以求和时每个 KDA 组多报 1 块、三组 +3；实际借块走上游 `allocate_new_blocks`，仍是 0。只让「够不够」的比较多要 3 块，不改变任何持有块数。`[C]+[D]`（2026-09-28 补）
5. 取块：`BlockPool.get_new_blocks` `vllm@0fc695fc:vllm/v1/core/block_pool.py#L333-L362`，从空闲队列头部弹出。

### 在我们部署下的具体数字

#### A2.1 预算常量

```
token_budget      = max_num_batched_tokens = 8192     [C] scheduler.py#L105-L109
max_num_running   = max_num_seqs = 32                 [C] scheduler.py#L104
num_lookahead     = num_speculative_tokens = 3        [C] scheduler.py#L212-L221
max_model_len     = 133120                            [S] 教程
```

`num_lookahead_tokens = 3` 的前提是 `use_eagle()` 为真：`method="deepseek_mtp"` 在配置阶段被归一成 `"mtp"`
（`[C]` `vllm@0fc695fc:vllm/config/speculative.py#L550-L554`、`#L1070-L1071`）。

#### A2.2 R1 第一步要几块

R1 prefill：`num_new_tokens = 4`，`num_tokens_need_slot = 4 + 3 = 7`。

| 组 | 算式 | 块数 |
|---|---|---|
| full（12 MLA + 12 indexer） | `ceil(7 / 640)` | 1 |
| KDA 组 ×3 | `ceil((7 + 133120×3) / 133120) = 4`，每组 4 块 | 12 |
| indexer-state | `ceil(7 / 4)` | 2 |
| **合计** | | **15 个 block id = 15 × 7.969 MiB ≈ 119.5 MiB** |

`[C]+[D]`。要点：**一条只有 4 个 token 的请求，80% 的块花在 KDA 循环状态上**，因为 KDA 状态按「每请求一页」分配，页大小与序列长度无关（`mamba_block_size = 133120`，再加 3 个投机块）。

上表的 15 块只是**第一步**。KDA 组此后一直是每组 4 块（`MambaManager.get_num_skipped_tokens = c − 1`，再减 3 个投机块，除以 133,120 为 0，中途不还，`vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1018-L1028`、`#L1203-L1209`）；full 组每 640 个位置多 1 块；**尾状态组每一步都在变**，账如下（2026-09-28 复核；改了哪些数、依据哪几行见文末「追加修订（2026-09-28，块数）」）。

尾状态组是 `SlidingWindowManager`，窗口 = 块 = `compress_ratio` = 4（`[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L339-L341`，登记处 `vllm_ascend/core/kv_cache_interface.py#L366-L369`；上游这个类不覆盖求块数和借块，走基类）。设本步开始时已算 `c` 个位置、本步新算 `n` 个、lookahead 3：

```
先还：remove_skipped_blocks(c)，窗口外 token = max(0, c − 4 + 1)            [C] single_type_kv_cache_manager.py#L793
      整块数 floor(max(0, c − 3) / 4) 换成 null block 还池                  [C] #L464-L501；调用在 kv_cache_manager.py#L381-L383
再借：块列表（含 null 占位）补到 cdiv(c + n + 3, 4)                         [C] kv_cache_manager.py#L370-L373；#L132、#L146-L154
手里真块数 = cdiv(c + n + 3, 4) − floor(max(0, c − 3) / 4)
```

| 时刻 | c | n | 真块数 |
|---|---|---|---|
| R1 第一步 | 0 | 4 | `cdiv(7, 4) − 0` = **2** |
| decode（1 个确定 token + 3 个候选） | ≥ 3 | 4 | `c mod 4` 为 0、1、3 时 **3**，为 2 时 **4** |
| 一次 prefill n 个 token（从 0 开始） | 0 | n | `cdiv(n + 3, 4)`：6,000 → **1,501**，8,144 → **2,037** |

`[C]+[D]`。为什么是区间不是定值：真块数取决于窗口起点落在块里的哪一格，也就是 `c mod 4`；而 MTP 每步让 `c` 前进 1–4 个位置（接受几个候选就多前进几个），所以 `c mod 4` 每步都可能换。decode 中「需要」每步涨 1–4，`cdiv(·, 4)` 最多跨一次边界，还池的整块数也最多加 1：**每前进 4 个位置借 1 块、还 1 块**，候选全被接受时每步都借还各 1 块，全被拒时每 4 步一次。开着异步调度时 `c` 在调度时含上一步未验证的候选，但它逐步不减，上面的公式和 3–4 的结论不变。

长 prompt 的 prefill 这一步，尾状态组要为本步全部新 token 留位置，所以临时借约 `n / 4` 块，下一步 `c` 追上来再还掉；上游对滑动窗口的注释写的就是「chunked prefill 时要容纳窗口内已算的 token 加本步新 token」（`[C]` `vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L499-L508`）。准入时的每请求上限 `max_admission_blocks_per_request = cdiv(3 + 8192, 4) + 1 = 2,050`，由它和 `scheduler_reserve_full_isl = True`（默认，`vllm/config/scheduler.py#L140`）一起在 waiting 侧先检查整段 prompt 放不放得下（`kv_cache_manager.py#L354-L368`）。`[C]+[D]`

对比满长度请求（133,120 token）：decode 时 `ceil(133120/640) = 208` + 12 + 尾状态组 3–4 = **223–224 块 ≈ 1.74 GiB**。按 A0.5 的算例（3,855 块），同时最多放 `floor(3,855 / 224) = 17` 条满长度请求；`max_num_seqs=32` 条请求各自常驻 15–16 块（12 + 3~4）共 480–512 块，剩 3,343–3,375 块 × 640 ≈ 2.14–2.16 M token 的历史，平均每条 ≈ 66.9–67.5 K token（按上限 512 块算 ≈ 66.9 K）。`[D]`

#### A2.3 前缀缓存

`[C]` 链条：`ModelConfig.attn_type` 对 hybrid 模型返回 `"hybrid"`（`vllm@0fc695fc:vllm/config/model.py#L1758-L1759`）→ `is_prefix_caching_supported` 对 `"hybrid"` 返回 False（`#L1851-L1857`）→ `enable_prefix_caching` 未显式给出时取这个默认值（`vllm/engine/arg_utils.py#L2404-L2405`）。
后果：

- `KVCacheManager.get_computed_blocks` 第一行就返回 `(空, 0)`（`vllm/v1/core/kv_cache_manager.py#L212-L213`），R1 的 4 个 token 一定要重算。
- `mamba_cache_mode = "none"`、`mamba_block_size = 133120`（`vllm@0fc695fc:vllm/model_executor/models/config.py#L386-L394`，Ascend 侧同一位置在 `patch_mamba_config.py#L222-L225`）。
- 调度器的 `block_size` 取各组块大小的 lcm：`lcm(640, 4, 133120) = 133120`（133120 = 640 × 208）。前缀缓存和 KV connector 都不开时，`hash_block_size` 直接等于它，也就是不做细粒度哈希。`[C]` `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L332-L410`（GLM 分支 `#L358-L378`），对应 vLLM 原版 `vllm@0fc695fc:vllm/v1/core/kv_cache_utils.py#L593-L656`。

#### A2.4 一步里发给 worker 的东西

`SchedulerOutput` 里对每条请求带：`num_scheduled_tokens[req_id]`、新分配的 block id（按组分开）、`scheduled_spec_decode_tokens`（上一轮 MTP 草拟的 3 个 token）。
R1 第一步：`{R1: 4}`，新块 15 个，草稿为空。

### 对应知识页

`vllm-scheduler.md`、`vllm-kv-block-allocation.md`、`kv-cache.md`、`kv-cache-spec.md`、`block-table.md`、`paged-attention.md`、`prefix-caching.md`、`chunked-prefill.md`、`prefill.md`、`mla.md`、`linear-attention.md`、`sparse-attention.md`、`speculative-decoding.md`、`one-request.md`。

### 待核

1. ~~indexer-state 组稳态到底占 1 块还是 2 块~~ **已核（2026-09-28，按源码推导，未实跑）**：都不是。2 块只是第一步；decode 时 3–4 块，长 prompt 的 prefill 那一步临时约 `n / 4` 块。推导见 §A2.2「尾状态组每一步」一段。
2. ~~`needs_kv_cache_zeroing` 在 GLM 上是否为真~~ **已核（2026-09-28）**：调度器侧为真（KDA 层是 `MambaBase`，`vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L873-L879`），full 组新块号会进 `new_block_ids_to_zero`（`scheduler.py#L926-L930`）；但执行侧不清零：上游 `_zero_block_ids` 只在 runner 上有 `_kv_block_zeroer` 时才动手（`vllm/v1/worker/gpu_model_runner.py#L1103-L1106`），昇腾 worker 只在投机方法为 `eagle3` 且投机 token 数大于 1 时才建它（`vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L917-L925`；v0.23 `2c59ff10` L931–L938、v0.26 `2ed6cbba` L1025–L1032 同一条件；main `baa023ad` L1146–L1158 另加一个入口：用 model runner v2 时也建）。GLM 用 `mtp`，所以借出的块不清零，抢占后重新分配也没有这笔开销。
3. `max_num_batched_tokens=8192` 与 `block_size=640` 不整除（8192 = 12×640 + 512），是否会在某些 kernel 路径上要求对齐，未核。

---

## A3 准备输入：model runner 造张量，分发给 TP8 各 worker

### 做了什么

`SchedulerOutput`（调度器这一步的决定）通过一块共享内存的消息队列同时发给本机 8 个 worker，每个 worker 自己把它翻译成这一步要算的张量：拉平成一维的 token id、每个 token 在自己那条请求里的位置、每个 token 的 KV 该写进哪个格子（slot，即「第几块的第几个位置」），以及这一步属于哪种注意力形态（纯 decode 还是含 prefill）。8 个 worker 算的是同一批 token，只是各自持有 1/8 的头和 1/16 的专家。

### 怎么走的

1. `MultiprocExecutor.execute_model` `vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L307-L318`
   → `collective_rpc("execute_model", ...)` `#L340-L380`，把 `(method, args, kwargs, output_rank)` 塞进 `rpc_broadcast_mq`。
2. 每个 `WorkerProc` 在 `worker_busy_loop` 里取出来执行；只有 `output_rank` 那一个 worker 回传结果（`#L313`、`#L247`）。
3. `NPUWorker.execute_model` `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L599-L664`
   → `NPUModelRunner.execute_model` `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1917`
4. 先更新持久批：`_update_states(scheduler_output)` `…/model_runner_v1.py#L748`
5. 再造张量：`_prepare_inputs` `…/model_runner_v1.py#L814-L975`
   - `req_indices = np.repeat(arange, num_scheduled_tokens)` `#L839`
   - `attn_state = _build_attn_state(...)` `#L853`，决定这一步是 `DecodeOnly` / `SpecDecoding` / 带 prefill；`with_prefill` 在 `#L856`
   - 位置：`positions = num_computed_tokens[req] + 组内序号` `#L863-L868`
   - token id：`token_indices = positions + req_idx × max_model_len` `#L951`，再 `torch.index_select` 从持久的 `token_ids_cpu` 里抓出来，写进 `self.input_ids.cpu[:total]` `#L957-L962`
   - block table 提交与 slot mapping：`block_table.commit_block_table(num_reqs)` `#L837`
6. 用的是 v1 runner：`VLLM_USE_V2_MODEL_RUNNER` 未设置时 `use_v2_model_runner` 返回 False
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L21`、`vllm_ascend/worker/worker.py#L513-L521`。

### 在我们部署下的具体数字（R1 的第一步，每张卡）

```
num_reqs                 = 1
total_num_scheduled_tokens = 4
input_ids                : int32 [4]
positions                : int64 [4]        值 = [0,1,2,3]
hidden_states（进模型后） : [4, 4096]        （四路残差展开见 02 号底稿）
attn_state               = 含 prefill
```

每张卡都拿到同样的 `[4]` 和 `[4, 4096]`；差别在权重分片：每卡 KDA 8 个头（64/8）、MLA 8 个头（64/8）、路由专家 18 个（288/16）。`[D]`

场景 M 的第一步（DP0）：`num_reqs = 13`，`total_num_scheduled_tokens = 12×4 + 6000 = 6048`，`input_ids` 是 `int32[6048]`，其中前 48 个是 12 条 decode 请求的「1 个已采样 token + 3 个草稿 token」，后 6000 个是新请求的 prompt。批里有 prefill，`uniform_decode` 为假（它要求 `max_num_scheduled_tokens == uniform_decode_query_len` 且 `num_tokens == 该值 × num_reqs`），所以这一步拿不到 `FULL_DECODE_ONLY` 的 decode 图，走 eager。`[C]` `…/model_runner_v1.py#L2924-L2941`（`with_prefill` 另有其用，在 `#L856`）

下一步（M 里 13 条都进 decode）：`13 × 4 = 52` token，是 uniform decode，`52` 会被补齐到捕获尺寸 **64**（4/8/16/32/**64**/96/128 中第一个 ≥52 的）。`[D]`

### 对应知识页

`prepare-inputs-flow.md`、`npu-model-runner.md`、`block-table.md`、`vllm-v1-shape.md`、`tensor-parallel.md`、`attention-backend-family.md`、`acl-graph.md`、`async-scheduling.md`。

### 待核

1. `slot_mapping` 在 GLM 上要同时喂三套 cache（MLA 主、indexer 压缩、压缩器状态），压缩那一套要过 `format_indexer_kpool_slot_mapping`（`vllm-ascend@db701c1f:vllm_ascend/core/kv_cache_interface.py#L27-L52`）。本底稿只确认了入口，没逐行核对三套 slot 的对应关系。
2. 逻辑块与 kernel 块的换算已核（见 §0 的消歧表）：调度器和 KV 池按 **640** token 一块分配，worker 侧的 SFA 算子按 **128** token 一块看，1 个逻辑块 = 5 个 kernel 块（`[C]` `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_config.py#L11`、`#L131-L139`）；compressed indexer 的 builder 会把 kernel 尺寸的子块折回调度块（`[C]` `vllm_ascend/spec_decode/llm_base_proposer.py#L437-L442`）。剩下没核的只有 `select_common_block_size` 在多组情形下的具体取值（`…/model_runner_v1.py#L4490-L4510`、`#L4750-L4770`）。

---

## A7 返回与收尾：反分词、流式输出、释放 KV 块

### 做了什么

采样出的 token id 从引擎进程回到前端进程，在前端增量反分词成文本，按 SSE 一段段吐给客户端；请求在引擎侧判定结束后，它占的所有 block id 立刻还回空闲队列。

### 怎么走的

**引擎侧**

1. `Scheduler.update_from_output` `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1329-L1650`
   → `_update_request_with_output` `#L1695-L1711`：逐个 append，`check_stop` 命中就截断后面的 token。
2. 结束：`_free_request` `#L1888-L1905` → `_free_blocks` `#L1907-L1910` → `KVCacheManager.free`
   `vllm/v1/core/kv_cache_manager.py#L438-L446` → 各组 → `BlockPool.free_blocks`
   `vllm/v1/core/block_pool.py#L419-L442`（引用计数减 1，归零的块按「尾块先被淘汰」的顺序挂回空闲队列）。
3. 请求 id 进 `finished_req_ids`，随下一次 `SchedulerOutput` 通知 8 个 worker 清掉自己的缓存状态 `#L1897`。

**前端侧**

4. `AsyncLLM._run_output_handler` `vllm@0fc695fc:vllm/v1/engine/async_llm.py#L637-L695`：
   `engine_core.get_output_async()` → 按 `chunk_size` 切片 → `output_processor.process_outputs`。
5. `OutputProcessor.process_outputs` `vllm@0fc695fc:vllm/v1/engine/output_processor.py#L576-L660`
   → `req_state.detokenizer.update(new_token_ids, stop_terminated)` `#L636-L647`
   → `make_request_output(...)` `#L651` → 塞进这条请求的 `RequestOutputCollector`。
6. 反分词器：`IncrementalDetokenizer` / `FastIncrementalDetokenizer`
   `vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L30-L166`、`#L167-L248`，逐 token 增量解码并处理 stop string。
7. SSE：`chat_completion_stream_generator` `vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L399`。

### 在我们部署下的具体数字（R1 收尾）

- 一条 decode 步最多回 4 个 token（1 个已验证 + 最多 3 个被接受的 MTP 草稿），所以流式输出的一个 chunk 可能一次带出 1–4 个 token。`[D]`
- 结束时归还 R1 占的块：起步 15 块，此后是 `ceil((c+7)/640) + 12 + 尾状态组 3~4` 块（`c` 为最后一次调度时的已算位置，尾状态组算法见 §A2.2）。R1 若生成 200 个 token，最后一步开始前已输出 196–199 个，`c = 199~202`，full 组 `ceil(≤209/640) = 1`，尾状态组 `c mod 4 = 2` 时 4 块、其余 3 块 → **`1 + 12 + 3~4 = 16~17` 块**，一次性还回；落在哪个数取决于 MTP 候选接受了几个。尾状态组这一生共借过 52–53 个块号，其中 49 个在途中已还。`[D]`（2026-09-28 由「15 块」改正）
- 归还顺序是逆序（尾块先还），这样启用前缀缓存时尾块最先被淘汰；本部署前缀缓存关闭，顺序只影响空闲队列的排列。`[C]` `kv_cache_manager.py#L438-L442`
- DP 视角：这条请求结束后 DP0 的 `running` 计数减 1，下一次 `_maybe_publish_request_counts` 会把新分数推给前端，影响后续路由（见 A1）。`[C]`

### 对应知识页

`request-call-chain.md`、`one-request.md`、`token.md`、`vllm-scheduler.md`、`vllm-kv-block-allocation.md`、`kv-cache.md`、`speculative-decoding.md`、`structured-output.md`。

### 待核

1. `check_stop` 对 GLM 三个 eos（154820/154827/154829）的处理、以及 `max_tokens` 缺省值，本底稿没有展开。
2. 异步调度（`async_scheduling`）打开时，释放块与输出回传的时序会错开一步；本部署是否默认打开未核（`vllm_ascend` 有 `async-scheduling` 相关页，需对照 `scheduler_config.async_scheduling`）。

---

## B1 两个 DP 组怎样分请求；空闲的组为什么要陪跑

### 做了什么

两台机器各自是一个 DP 执行组（机内 TP8），各自有自己的调度器和 KV 池；请求由前端按负载分给其中一组。但哪一组都不是一份完整的模型：MoE 的 288 个专家摊在全部 16 张卡上（每卡 18 个），两组合起来才是一份完整的模型，任何一组要算一层 MoE，都得另一组同时参与通信——所以没活干的那组也必须一步不落地空跑。

### 怎么走的

**分请求**（同 A1 第 4 步）：`DPLBAsyncMPClient.get_core_engine_for_request`
`vllm@0fc695fc:vllm/v1/engine/core_client.py#L1398-L1426`；计数由 `DPCoordinator` 每 ≥100 ms 推一次
`vllm@0fc695fc:vllm/v1/engine/coordinator.py#L149-L157`、`#L257-L278`、`#L395-L405`；
客户端侧接收与切片在 `core_client.py#L1227-L1342`。

**陪跑**：`DPEngineCoreProc.run_busy_loop` `vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1926`

```python
executed = self._process_engine_step()          # 没有可跑的请求 → False
if not executed:
    if not local_unfinished_reqs and not self.engines_running:
        continue                                # 全局都空闲，才真的什么都不做
    self.execute_dummy_batch()                  # 否则必须空跑一步
self.engines_running = self._has_global_unfinished_reqs(local_unfinished_reqs)
```

- `execute_dummy_batch` → `MultiprocExecutor.execute_dummy_batch`
  `vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L331-L332`
  → `NPUWorker.execute_dummy_batch` `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L972-L973`
  → `model_runner._dummy_run(num_tokens=decode_token_per_req, uniform_decode=True)`，
  其中 `decode_token_per_req = 1 + num_speculative_tokens = 4` `[C]` `vllm_ascend/worker/model_runner_v1.py#L652-L656`。
- 全局是否还有活：`_has_global_unfinished_reqs` `core.py#L1928-L1945`，**每 32 步**才做一次 all-reduce
  （`#L1929-L1932`），走 CPU gloo 组，reduce 的是 `[has_unfinished, pending_pause]`
  `vllm@0fc695fc:vllm/config/parallel.py#L683-L707`。
- **每一步内部的 DP 对齐走的是昇腾 runner 自己的实现**，不是上游 `dp_utils.coordinate_batch_across_dp`（那条路径在 v1 NPU runner 下不执行）：
  `NPUModelRunner._determine_batch_execution_and_padding` 先按本地 token 数 dispatch 一次图尺寸，再调
  `_sync_metadata_across_dp` `[C]` `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2966-L2996`、`#L692-L740`。
  规则是：
  1. all-reduce 的是一个 **2×dp_size** 的 int32 张量，两行分别是 `num_tokens`（已按本地图尺寸补齐）和 `cudagraph_mode`；默认走 CPU 组，`ascend_config.dp_allreduce_on_npu` 为真时才走 NPU 组（`#L714-L722`）。
  2. 图模式取**各 rank 的最小值**（`#L728-L730`）——只要有一个 rank 这一步没有图可用，所有 rank 这一步都 eager。
  3. token 数：本 rank 的 `allow_dp_padding` 为真时（本地图模式非 NONE，或开了 sp / oproj_tp / embedding_tp），它把自己的宽度换成**全局最大值**；为假时保留各自的真实值（`#L733-L740`）。随后用这个宽度重新 dispatch（`#L2986-L2996`）。
  4. 两个 rank 各自算各自的 `allow_dp_padding`，所以它们看到的 `num_tokens_across_dp` 数组可以不同，但数组的最大值一致。
- MoE 通信按这个最大值定规模：`set_ascend_forward_context`
  `vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L165-L190`，
  `max_tokens_across_dp = max(num_tokens_across_dp)`，`padded_num_tokens = ceil(max/tp) × tp`。
- 本部署不会跳过这次 all-reduce：跳过只发生在非 MoE 模型或 KV consumer 角色上，而这里是 MoE 且没有 `kv_transfer_config`
  `[C]` `vllm_ascend/utils.py#L1257-L1303`。

### 在我们部署下的具体数字

#### 场景 M（DP0 = 12 decode + 1 条 6000 token 新请求，DP1 = 7 decode）

| | DP0 | DP1 |
|---|---|---|
| 调度器给出的 token 数 | 12×4 + 6000 = **6048** | 7×4 = **28** |
| 本地先补到自己的图尺寸 | 6048（混合批，`uniform_decode` 为假 → 图模式 NONE，不补） | 28 → **32**（纯 decode，命中捕获尺寸 32 → 图模式 FULL） |
| all-reduce 的两行原始值 | `num_tokens = [6048, 32]`，`mode = [NONE, FULL]` | 同一份数据 |
| 本 rank 的 `allow_dp_padding` | 假（本地图模式是 NONE） | 真（本地图模式是 FULL） |
| 本 rank 看到的 `num_tokens_across_dp` | `[6048, 32]` | `[6048, 6048]` |
| 同步后的图模式 = min | NONE | NONE |
| **实际前向宽度** | **6048，eager** | **6048，eager** |
| `max_tokens_across_dp` / `padded_num_tokens = ceil(6048/8)×8` | 6048 | 6048 |

`[C]`：`model_runner_v1.py#L2966-L2996`、`#L728-L740`。
要点有两个：**DP1 参与同步的是本地补齐后的 32，不是 28**；而且因为它的 `allow_dp_padding` 为真，它这一步真的按 **6048 宽**做前向，只是其中 6016 行是填充。同时 DP0 那边的混合批把同步后的图模式压成 NONE，于是 DP1 连自己本来能用的 decode 图也用不上。**两组的步长和宽度都由忙的那组决定**，这是双机 DP + EP 部署里最直接的浪费来源。

路由打分（见 A1）：`score(DP0)=12`、`score(DP1)=7`，新请求默认会去 DP1；场景 M 描述的是它落在 DP0 的情形（显式 `data_parallel_rank` 或计数滞后）。`[C]+[D]`

#### 场景 M′（DP1 空闲）

- DP1 的调度器没有请求 → `_process_engine_step` 返回 False → `local_unfinished_reqs = False`，但 `engines_running` 还是 True（wave 未结束）→ 执行 `_dummy_run(num_tokens=4, uniform_decode=True)`。
- 这个 dummy 批次同样经过 `_determine_batch_execution_and_padding` → `_sync_metadata_across_dp`
  （`[C]` `vllm_ascend/worker/model_runner_v1.py#L3410-L3427`），所以：
  - **请求的 token 数是 4**（`decode_token_per_req`），本地 dispatch 到尺寸 4 的 decode 图，图模式 FULL → `allow_dp_padding` 为真；
  - 同步后它看到 `[6048, 6048]`，把自己的宽度换成 6048，并把 `num_tokens_across_dp[:]` 一并改成这个值（`#L3446-L3450`）；
  - 图模式被 min 压成 NONE，于是**以 6048 宽 eager 执行**。
- 这一步 DP1 仍然跑满 45 层、在 EP16 域里做 MoE 的 dispatch/combine、在 TP8 域里做 all-reduce，并且连草稿模型也陪跑一次：`self.drafter.dummy_run(num_tokens=num_tokens_padded, ...)`（`[C]` `#L3642-L3650`）。
- DP0 这一侧看到的是 `[6048, 4]`（它的 `allow_dp_padding` 为假，保留对端真实值），但 `max_tokens_across_dp` 同样是 6048，MoE 通信按 6048 对齐。
- 直到某次第 32 步的 all-reduce 发现两边都没活，`engines_running` 才变 False，`current_wave += 1`，两组一起停（`core.py#L1906-L1924`）。新请求到来时前端发 `FIRST_REQ`，协调器广播 `START_DP_WAVE` 把两组一起叫醒（`core.py#L1836-L1855`）。
- 最坏情况下，最后一条请求结束后两组还会多空跑至多 31 步；按 decode 一步的耗时 T，代价是 31T。`[D]`

### 对应知识页

`data-parallel.md`、`expert-parallel.md`、`large-scale-ep.md`、`engine-processes.md`、`vllm-engine-core.md`、`collective-communication.md`、`cann-hccl.md`、`dyntra-lb.md`、`concurrent-requests.md`、`glm-5-3-flash-two-node.md`、`eplb.md`。

### 待核

1. 空跑一步的真实耗时（一次 45 层 + 16 卡 all-to-all 的固定开销）需要实测，本底稿只给出机制。
2. 已核（原「dummy 是否短路 MoE」一条）：`_dummy_run` 请求 4 个 token，经 DP 同步被拉到对端宽度后 eager 执行整张网络，并带上草稿模型的 dummy run，见上文场景 M′ 的三条引用。剩下未核的是 `_dummy_run` 内部是否为某些层走了简化路径（`model_runner_v1.py#L3470-L3600` 未逐行读）。
3. DP 同步走 CPU 组还是 NPU 组由 `ascend_config.dp_allreduce_on_npu` 决定（`[C]` `vllm_ascend/worker/model_runner_v1.py#L714-L722`），默认值本轮按约束没读教程与 ascend 配置文件，未核。上游的 `disable_nccl_for_dp_synchronization` 在这条路径上不参与。
4. `enable_flashcomm1` / `enable_sp` / `oproj_tp` / `embedding_tp` 都按默认关闭处理；若其中任一打开，`allow_dp_padding` 会恒为真，上面两张表要重算。`[A]`

---

## B2 连续批处理：32 个请求、8192 token 预算，prefill 和 decode 混在一步里

### 做了什么

调度器每一步不分「prefill 阶段」和「decode 阶段」，只有一个 token 预算表：先让在跑的请求各拿 4 个 token（1 个真 token + 3 个草稿），剩下的预算给新请求做 prefill，装不下就把 prompt 切成几段，分几步算完。

### 怎么走的

同 A2 的 `Scheduler.schedule`；与「连续批处理」直接相关的三处：

1. 没有阶段之分：注释见 `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L342-L351`。
2. 新请求的分块：`num_new_tokens = min(request.num_tokens − num_computed_tokens, token_budget)`
   `#L684-L700`；`enable_chunked_prefill` 关闭时才会在装不下时直接 `break`（`#L691-L697`）。
3. 并发上限：`if len(self.running) == self.max_num_running_reqs: break` `#L567-L568`。

chunked prefill 默认开启：`is_chunked_prefill_supported` 对生成模型只在 encoder-decoder 时返回 False
`[C]` `vllm@0fc695fc:vllm/config/model.py#L1805-L1810`，默认值由 `arg_utils.py#L2373-L2378` 取用。
`mamba_cache_mode = "none"`，所以 `need_mamba_block_aligned_split = False`
（`[C]` `scheduler.py#L261-L263`），分块**不需要**对齐到 KDA 状态边界；
Ascend 为 align 模式准备的对齐补丁（`vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L9-L57`）在本部署下不生效。

### 在我们部署下的具体数字

#### 场景 M 的一步（DP0）

```
running 循环：12 条 decode，每条 num_tokens_with_spec − num_computed = 1 + 3 = 4
              消耗 12 × 4 = 48，剩余预算 8192 − 48 = 8144
waiting 循环：新请求 num_new_tokens = min(6000, 8144) = 6000   → 一步装得下，不用切
             len(running) 从 12 变 13 ≤ 32，通过
本步 total_num_scheduled_tokens = 6048，num_reqs = 13
```

`[C]+[D]`。可见 8192 的预算对 6000 token 的 prompt 是够的；**真正会触发切分的门槛**是
`prompt > 8192 − 4 × (在跑的请求数)`。
能让新请求进队的最大 running 数是 **31**（waiting 循环第一句就是 `if len(self.running) == self.max_num_running_reqs: break`，`[C]` `scheduler.py#L566-L568`），
这时门槛是 `8192 − 31×4 = 8068` token；running 已经满 32 条时，新请求这一步根本排不进来，只能等有请求结束。`[C]+[D]`

#### 一个会被切开的例子

同样 12 条 decode，来一条 20000 token 的 prompt：

```
第 1 步：48 + min(20000, 8144) = 8144  → 8192 token 满载
第 2 步：48 + min(11856, 8144) = 8144
第 3 步：48 + 3712              = 3760
第 4 步起：这条请求进入 decode，每步 4 个 token
```

每一步都要给它补 KV 块：第 1 步 `ceil((8144+3)/640) = 13` 块（full 组）+ 12（KDA）+ 尾状态组 `cdiv(8147, 4) = 2,037` 块；
第 2 步 full 组再补 `ceil((16288+3)/640) − 13 = 13` 块；第 3 步再补 `ceil((20003)/640) − 26 = 6` 块。`[D]`

尾状态组（算法见 §A2.2）在这三步里手里分别是 **2,037 → 2,038 → 930** 块，第 4 步进入 decode 后回到 3–4 块：
第 2 步先还 `floor((8144−3)/4) = 2,035` 块、再借 `cdiv(16291, 4) − 2,037 = 2,036` 块；第 3 步还 2,036、借 928；第 4 步还 928、借 1。
也就是说，一个 8144 token 的 chunk 会让尾状态组临时占住 3,855 块池子的一半多（2,037 × 7.969 MiB ≈ 15.9 GiB），比 full 组的 13 块多两个数量级。`[C]+[D]`（2026-09-28 补）

#### 上限

- 请求数上限 32（`max_num_seqs`），对应 decode 一步 `32 × 4 = 128` token，正好是最大的图捕获尺寸。`[D]`
- 一步最多 8192 token，等于 `12.8` 个 640-token 逻辑块的量。
- 混合步（批里有 prefill）不走图，纯 decode 步才走 `FULL_DECODE_ONLY` 图。`[C]` `…/model_runner_v1.py#L2924-L2941`（`uniform_decode` 要求 `max_num_scheduled_tokens == uniform_decode_query_len` 且 `num_tokens == 该值 × num_reqs`）。DP 打开时还要再过一次 min（见 B1）：另一组是混合批，这一组即使自己够 uniform 也用不上图。

### 对应知识页

`chunked-prefill.md`、`vllm-scheduler.md`、`concurrent-requests.md`、`prefill.md`、`short-request-first.md`、`balance-scheduling.md`、`recompute-scheduler.md`、`async-scheduling.md`、`speculative-decoding.md`。

### 待核

1. `long_prefill_token_threshold` 默认值（`scheduler.py#L408-L409`、`#L685-L687`）：若非 0 会再压一层上限，本部署未显式设置，默认值未核。
2. vllm-ascend 自带的几个调度器变体（`vllm_ascend/core/scheduler_dynamic_batch.py`、`scheduler_profiling_chunk.py`、`recompute_scheduler.py`）在默认配置下是否被启用，未核。此外 `patch_balance_schedule.py` 在全局替换了 `Scheduler`，`enable_balance_scheduling` 关闭时回落到 `super().schedule()`（`[C]` `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L84-L88`、`#L718`），本底稿按该开关默认关闭写；开关的默认值未核。

---

## B3 KV 块不够时怎样抢占和回收

### 做了什么

当一条在跑的请求要不到新块时，调度器从 running 队列的尾巴上揪一条出来，把它的块全部收回，请求退回 waiting 队列头部，`num_computed_tokens` 清零——它之前算过的 prefill 全部作废，以后要从头重算。

### 怎么走的

1. running 循环里的抢占：`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L459-L509`

```python
while True:
    new_blocks = self.kv_cache_manager.allocate_slots(request, num_new_tokens, num_lookahead_tokens=3)
    if new_blocks is not None:
        break                       # 要到了
    preempted_req = self.running.pop()        # FCFS：踢最后一条
    self._preempt_request(preempted_req, scheduled_timestamp)
    preempted_reqs.append(preempted_req)
    if preempted_req == request:
        break                       # 自己被踢了，这一步谁也排不进
```

2. `_preempt_request` `#L974-L995`：`kv_cache_manager.free(request)` → `status = PREEMPTED` →
   **`num_computed_tokens = 0`** → 清空 `spec_token_ids` → `num_preemptions += 1` → `waiting.prepend_request(request)`。
3. 本步禁新：`if not preempted_reqs and ...` `#L563`——只要这一步发生过抢占，waiting 队列一条都不排。
4. 回收：`KVCacheManager.free` → 各组 → `BlockPool.free_blocks` `vllm/v1/core/block_pool.py#L419-L442`。
5. 判断「要不要不到」的地方：`allocate_slots` 里的
   `available_blocks = block_pool.get_num_free_blocks() − reserved_blocks`，
   `num_blocks_to_allocate > available_blocks` 就返回 None
   `vllm/v1/core/kv_cache_manager.py#L385-L398`。
6. 优先级调度（`policy=PRIORITY`）下踢的是 `max(priority, arrival_time)` 那条 `#L474-L497`；默认 FCFS 走 `self.running.pop()`。

### 在我们部署下的具体数字（场景 M 的变体）

设可用块 `num_blocks = 3,855`（A0.5 算例）。DP0 上 12 条请求各已生成到 20,000 token：

```
每条已持有 = ceil(20007/640) + 12 + (3~4) = 32 + 15~16 = 47~48 块
12 条合计   = 564~576 块
剩余        = 3,855 − (564~576) = 3,279~3,291 块
```

（每条常驻 15–16 块 = KDA 12 + 尾状态组 3~4，尾状态组的算法见 §A2.2；2026-09-28 由「14 块」改正。）

这时 6000 token 的新请求第一步要 `ceil(6003/640) + 12 + cdiv(6003, 4) = 10 + 12 + 1,501 = 1,523` 块，仍装得下；但其中 1,501 块是尾状态组为 prefill 临时借的，下一步还掉，之后这条请求回到 `10 + 12 + 3~4 = 25~26` 块。
要把池子逼到抢占，需要把长度或并发拉上去，例如 **32 条各 60,000 token**（都在 decode）：

```
每条 = ceil(60007/640) + 12 + (3~4) = 94 + 15~16 = 109~110 块
32 条 = 3,488~3,520 块 ≤ 3,855，还剩 335~367 块
```

再往后每条每 640 个新 token 各要 1 块，这 335–367 块用完（平均每条再跑约 6,700–7,340 token）后，
某条请求 `allocate_slots` 返回 None，触发抢占。此时 full 组合计 `3,855 − 32×12 − 32×(3~4) = 3,343~3,375` 块，平均每条约 105 块，也就是每条约 67,000 token：

```
被踢那条已持有 ≈ ceil(67007/640) + 12 + (3~4) = 105 + 15~16 = 120~121 块
```

- 被踢的是 running 里最后一条（FCFS 下是最晚被排进来的那条）。
- 一次释放它的 **120–121 块 ≈ 956–964 MiB**，够其余请求再跑 `120~121 × 640 ≈ 77,000` 个 token 的历史。
- 被踢的那条 `num_computed_tokens = 0`：它那约 67,000 个 token 的 prefill 要全部重算。按 8192 的预算，重算要 `ceil(67000/8192) = 9` 步，并且这 9 步里每步都和别人抢预算。`[D]`（2026-09-28 按常驻 15–16 块重算，原为约 68,000 token、121 块）

抢占在本部署里特别贵的三个原因（都可由源码直接推出）：

1. **前缀缓存关着**（A2.3），被释放的块不进缓存，重算没有任何复用。`[C]`
2. **KDA 状态跟着一起丢**：那 12 块循环状态被归还，再回来时 34 层的循环状态要靠重新扫一遍全部 prompt 重建。`[C]` `_preempt_request` 调的是 `kv_cache_manager.free`，对所有组一视同仁。
3. **排回来要的块远多于它还掉的块**：它退回 waiting 队首后，准入检查（`scheduler_reserve_full_isl` 默认开）按整段 67,000 token 算 `105 + 12 + min(cdiv(67000, 4), 2,050) = 2,167` 块，第一个 chunk（预算 `8192 − 31×4 = 8,068`）实际要借 `13 + 12 + cdiv(8071, 4) = 2,043` 块，都远大于它还掉的 120–121 块。waiting 侧借不到就 `break`，所以它和排在它后面的新请求都要等池子空出约 2,170 块才进得来。`[C]+[D]`：准入与封顶见 §A2.2；`break` 见下文 `#L774-L781`。

另外两条与抢占相关的机制：

- KDA 组有一条特殊返回：当本步内另一条请求刚生成的块要被当作前缀复用时，`MambaManager.get_num_blocks_to_allocate` 直接返回 `num_gpu_blocks + 1`，制造「块不够」让这条请求推迟到下一步
  `[C]` `vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L1063-L1072`。本部署前缀缓存关闭，这条路走不到。`[I]`
- waiting 侧要不到块时不抢占，直接 `break` 结束本步的 waiting 循环 `#L774-L781`。

### 对应知识页

`vllm-scheduler.md`、`vllm-kv-block-allocation.md`、`kv-cache.md`、`block-table.md`、`prefix-caching.md`、`kv-cache-cpu-offload.md`、`recompute-cpu-offload.md`、`recompute-scheduler.md`、`concurrent-requests.md`、`linear-attention.md`。

### 待核

1. ~~抢占后重新分配到的 KDA 页是否必须清零~~ **已核（2026-09-28）**：GLM 用 `mtp`，昇腾 worker 不建清零器，借出的块不清零，没有这笔开销；见 A2 待核 2。
2. vllm-ascend 的 `recompute_scheduler.py` / `kv_offload` 是否提供了「抢占改为换出」的路径，默认是否启用，未核。
3. 上面算例里的 `num_blocks = 3,855` 依赖 A0 的显存假设；真值定下来后，本节所有块数都按同一公式重算即可（公式本身是 `[C]`）。

---

## 附：本文件用到的源码位置速查

**vllm@0fc695fc**

- 入口：`vllm/entrypoints/openai/chat_completion/api_router.py#L39-L73`、`…/chat_completion/serving.py#L192-L356`、`vllm/entrypoints/serve/render/serving.py#L183-L256`
- 前端引擎：`vllm/v1/engine/async_llm.py#L280-L415`、`#L637-L695`；`vllm/v1/engine/output_processor.py#L576-L660`；`vllm/v1/engine/detokenizer.py#L30-L248`
- DP 客户端与协调器：`vllm/v1/engine/core_client.py#L1211-L1426`；`vllm/v1/engine/coordinator.py#L145-L172`、`#L257-L278`、`#L395-L405`
- 引擎进程：`vllm/v1/engine/core.py#L145-L157`、`#L236-L317`、`#L341-L377`、`#L443-L473`、`#L785-L786`、`#L819-L841`、`#L1701-L1770`、`#L1836-L1945`
- 启动：`vllm/entrypoints/cli/serve.py#L173-L245`；`vllm/v1/engine/utils.py#L1049-L1200`
- 执行器：`vllm/v1/executor/multiproc_executor.py#L103-L247`、`#L307-L380`
- 并行域：`vllm/distributed/parallel_state.py#L1535-L1560`、`#L1740-L1880`；`vllm/config/parallel.py#L501-L502`、`#L672-L707`
- 调度器：`vllm/v1/core/sched/scheduler.py#L104-L110`、`#L212-L263`、`#L340-L967`、`#L974-L1013`、`#L1329-L1711`、`#L1797-L1910`
- KV：`vllm/v1/core/kv_cache_manager.py#L196-L446`；`vllm/v1/core/block_pool.py#L333-L442`；`vllm/v1/core/single_type_kv_cache_manager.py#L101-L140`、`#L582-L660`、`#L955-L1120`；`vllm/v1/core/kv_cache_utils.py#L593-L656`、`#L952-L970`、`#L1698-L1718`；`vllm/v1/kv_cache_interface.py#L353-L384`、`#L607-L645`
- 配置：`vllm/config/cache.py#L46-L48`、`#L92`、`#L118-L141`、`#L228-L244`；`vllm/config/model.py#L1284-L1296`、`#L1647-L1648`、`#L1749-L1869`；`vllm/config/vllm.py#L1885-L1904`；`vllm/engine/arg_utils.py#L2369-L2420`；`vllm/config/speculative.py#L543-L554`、`#L1070-L1071`
- Mamba/KDA：`vllm/model_executor/layers/mamba/abstract.py#L44-L61`；`vllm/model_executor/layers/mamba/mamba_utils.py#L119-L126`；`vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L84-L140`；`vllm/model_executor/custom_op.py#L47-L66`；`vllm/model_executor/models/config.py#L194-L226`、`#L337-L394`
- dummy 与 uniform decode：`vllm/v1/worker/gpu_worker.py#L952-L954`；`vllm/v1/worker/gpu_model_runner.py#L814`（DP 对齐在昇腾侧另有实现，上游 `dp_utils.py` 不在本部署的执行路径上）

**vllm-ascend@db701c1f**（用 `git -C tools/repos/vllm-ascend show db701c1f:<path>` 读）

- 平台与补丁：`vllm_ascend/platform.py#L185-L200`、`#L312-L331`、`#L655-L662`；`vllm_ascend/utils.py#L1396-L1432`；`vllm_ascend/patch/platform/__init__.py#L21-L45`
- block_size 与页对齐：`vllm_ascend/patch/platform/patch_mamba_config.py#L11`、`#L92-L226`
- KV 分组与块数：`vllm_ascend/patch/platform/patch_kv_cache_utils.py#L104-L226`、`#L231-L410`、`#L459-L548`、`#L647-L698`、`#L771-L808`
- GLM 配置与模型：`vllm_ascend/patch/platform/patch_glm5_next_config.py#L14-L31`；`vllm_ascend/models/glm5_next.py#L104`、`#L261-L367`、`#L1252-L1313`、`#L1541-L1706`、`#L1881-L2051`、`#L2497-L2510`
- cache 规格：`vllm_ascend/core/kv_cache_interface.py#L27-L160`、`#L288-L354`；`vllm_ascend/ops/indexer_kpool_mla.py#L39-L137`；`vllm_ascend/ops/kimi_kda_state.py#L8-L36`；`vllm_ascend/ops/kimi_kda.py#L235-L242`
- MTP 与草稿层：`vllm_ascend/models/glm5_next_mtp.py#L53-L57`、`#L84-L92`、`#L131`；`vllm_ascend/spec_decode/llm_base_proposer.py#L80-L95`、`#L319-L340`、`#L400-L456`；`vllm_ascend/transformers_utils/configs/glm5_next.py#L265-L270`
- worker / runner：`vllm_ascend/worker/worker.py#L391-L393`、`#L465-L480`、`#L505-L597`、`#L693-L784`、`#L972-L988`；`vllm_ascend/worker/model_runner_v1.py#L383`、`#L440-L460`、`#L652-L656`、`#L692-L740`、`#L748`、`#L814-L975`、`#L1917`、`#L2924-L2996`、`#L3410-L3450`、`#L3642-L3650`、`#L4988-L4999`、`#L5124-L5267`
- 前向上下文与通信域：`vllm_ascend/ascend_forward_context.py#L58-L190`；`vllm_ascend/distributed/parallel_state.py#L30-L96`；`vllm_ascend/utils.py#L763-L768`、`#L1257-L1303`
- 其他：`vllm_ascend/patch/platform/patch_use_v2_model_runner.py#L1-L21`；`vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py#L9-L57`；`vllm_ascend/patch/platform/patch_mamba_manager.py#L18-L84`；`vllm_ascend/patch/platform/patch_balance_schedule.py#L84-L88`；`vllm_ascend/models/__init__.py#L10-L20`

**main 分支差异（`vllm-ascend@baa023ad`）**：GLM 实现的目录从 `vllm_ascend/models/glm5_next.py` 变成 `vllm_ascend/models/glm5next/`。本底稿逐行引用的都是 `db701c1f`（官方镜像里跑的版本）；`main` 上对应文件的行号需要单独核对，未在本轮完成。`[!]`

---

## 修订记录（2026-09-27，依据 `docs/mainline/review/01-review.md`、`02-review.md`、`03-review.md`）

### 01-review P1

| 条目 | 处理 |
|---|---|
| P1-1 每 block id 漏算 MTP 第 45 层 | **已改**。自核过证据链：MTP 层号 45 → `is_kda_layer(45)` 为假（`layer_types` 只有 45 项）→ 走 MLA + indexer；草稿层复用同一 `static_forward_context`，并被 `assert not missing_layers` 强制出现在 KV cache 组里。计数改为 12 MLA / 12 indexer / 12 state，`bytes_per_block = 12×655,360 + 12×40,960 = 8,355,840 B`。§0、A0.3、A0.5、A2.2、B3 及附录全部按此重算 |
| P1-2 B1 的 `num_tokens_across_dp` 与陪跑宽度 | **已改**。B1「怎么走的」整段换成 `_sync_metadata_across_dp`，场景 M 的表按 DP0/DP1 分列，新增「实际前向宽度」行；M′ 改写为「请求 4 个 token，同步后按 6048 宽 eager 执行，并带草稿 dummy」 |
| P1-3 待核 5「实际分配 conv 长度是 3」 | **已改**。自核 OOT 注册（`CustomOp.register_oot` + `REGISTERED_ASCEND_OPS["KimiGatedDeltaNetAttention"]`，且本轮 vLLM 正是 0.23.0），实例化的是 `AscendKimiGatedDeltaNetAttention`，`get_state_shape` 带 `num_spec`。删除 `[!]` 待核项，改写成 A0.4 的已核结论，并注明 `AscendGlm5NextLinearAttention` 是死代码 |
| P1-4 3,873 应为 3,874 | **已改**（被 P1-1 覆盖）：按 8,355,840 重算为 **3,855** |
| P1-5 B2 满载门槛 | **已改**。改成「能进队的最大 running 数是 31，门槛 `8192 − 124 = 8068`；满 32 条时新请求排不进来」 |
| P1-6 B3 释放块数前后矛盾 | **已改**。抢占时每条已涨到约 68,000 token，被踢那条持有 `ceil(67983/640)+14 = 121` 块 ≈ 964 MiB，可腾出 77,440 token 的历史。**2026-09-28 再更正**：`+14` 把尾状态组首步的 2 块当成了常驻值，常驻应为 15–16 块；按总量重算为每条约 67,000 token、被踢那条 `105 + 15~16 = 120~121` 块 ≈ 956–964 MiB、可腾出约 77,000 token，见 §B3 与文末「追加修订（2026-09-28，块数）」 |

### 01-review P2

| 条目 | 处理 |
|---|---|
| P2-1 indexer 页引用行不支持结论 | **已改**，换成 `vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L365-L384`，并写出 `storage_block_size = 640/4 = 160` |
| P2-2 KDA `quant_config=None` 引的是死类 | **已改**。A0 待核 2 改成「投影层传的是 `quant_config=self.quant_config`（上游 `kimi_gdn_linear_attn.py#L120-L140`），是否量化取决于 `quant_model_description`，与 02 待核 1 合并」 |
| P2-3 B1 走错代码路径 | **已改**，见 P1-2。待核 3 改成「由 `dp_allreduce_on_npu` 决定走 CPU 还是 NPU 组，默认值未核」，并注明上游 `dp_utils` 不在执行路径上 |
| P2-4 每卡权重与 02 不一致、把参数个数当字节 | **已改**。A0.3 改成只给**参数个数**与分片规则，明确「换字节要乘 dtype」，合计以 02 §1.3 为单一真相源，并注明 02 尚未含 MTP 层（约 0.65 GiB），A0.5 算例按 ≈21 GiB 取值。「23 MiB/层」换成逐项算式（23,461,888 个参数/层） |
| P2-5 02 把 block_size 写成 128 | **本文件侧已改**：§0 新增「block_size 的五种含义」消歧表，A3 待核 2 给出 640 = 5×128 的换算。02 自身不归本文件改 |
| P2-6 02 每 token KV 字节漏 MTP | **已改**（本文件侧）：A0.5 补「折合 13,056 B/token = 12 层 × 1,088 B」，并标出主干 11 层占 11,968 B |
| P2-7 02 每请求 KDA 状态漏投机块 | **不改**（本文件本来就是 12 个 block id / 每组 4 块，与判定一致）；属于 02 的修订项 |
| P2-8 `fused_qkv_a_proj` 行号偏 | **已改**，`#L1924-L1933` → `#L1918-L1925` |

### 01-review P3

| 条目 | 处理 |
|---|---|
| P3-1 公式行号小偏差 | **已改**：`#L666-L673`、`shared_by` `#L674-L697`，并补 `#L279-L329` 的计数出处 |
| P3-2 漏了 `AscendMambaManager` | **已改**，A2「怎么走的」第 4 条补上补丁与导入点，并说明本部署下仍是 4 块/组 |
| P3-3 变量名 `decode_token_per_req` | **已改**，§0 与 B1 都改成这个名字并补引用 |
| P3-4 实现类是 `Glm5NextForConditionalGeneration` | **已改**，写进 A0 待核 4（数字不变，视觉塔权重未核） |
| P3-5 `block_size` 一词多义 | **已改**，§0 新增五义消歧表，含 `EngineCore` 事后把该字段改写成 4 的那一处 |
| P3-6 初学者可读性 | **已改**：A0 / A1 / A3 的「做了什么」给 headless、worker、profile、decode 图、专家并行域、聊天模板、`EngineCoreRequest`、ZMQ、共享内存队列、KV slot、注意力形态都补了一句白话 |
| P3-7 拿「没展开」代替答案（A0 待核 4、A3 待核 2、B1 待核 2） | **已改**，三条都改成已核结论；各自只留真正未核的残余（视觉塔权重、`select_common_block_size` 取值、`_dummy_run` 内部是否有简化路径） |
| P3-8 「不走 decode 图」应引 `uniform_decode` | **已改**，A3 与 B2 都换成 `#L2924-L2941`，并说明 DP 下还要再过一次 min |
| P3-9 A1 引用不完整 | **已改**：补 `DPEngineCoreProc._handle_client_request`（`#L1836-L1855`）与 `add_request`（`#L1789-L1803`），字段来源拆成 `process_inputs` 与客户端覆写两处；B2 待核 2 补 `patch_balance_schedule` |

### 跨文档判定（02-review、03-review 末表中与 01 有关的量）

| 量 | 处理 |
|---|---|
| 块大小（02 写 128） | 本文件 640 的结论两份审查都判定为对；已补消歧表说明 128 是 kernel 块 |
| 每 token KV 字节（01-review 13,056 vs 02-review 11,968） | **判定：13,056 B/token**。理由是 MTP 第 45 层的三份 cache 与主干在同一个 KV 池里：`llm_base_proposer.initialize_attn_backend` 用 `assert not missing_layers, "Draft layers missing from KV cache config"` 强制草稿层出现在 KV cache 组中（`vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L400-L456`），而 `_get_glm5_cache_layout` 是按组里的层数计数的（`patch_kv_cache_utils.py#L279-L329`）；物理侧也自洽：`8,355,840 / 640 = 13,056`。02-review 的 11,968 是**主干 11 层的分项**，本文件两个数都写出来了 |
| KDA 状态与投机块 | 与判定一致，未改 |
| conv 长度 6 | 已改，见 P1-3 |
| DP 补齐规则 | 已改，见 P1-2；两份审查此处判定一致（01-review P1-2 与 03-review 末表「01 引的是被覆写、不执行的 upstream 函数」） |
| 空闲组 `_dummy_run`（01-review 说补到 6048 eager，03-review 说原文 4 是对的） | **判定：两者说的不是同一件事，本文件把两层都写出来**。源码上：`execute_dummy_batch` 传的确实是 `decode_token_per_req = 4`（`vllm_ascend/worker/worker.py#L972-L973`、`model_runner_v1.py#L652-L656`），所以「4」对；但 `_dummy_run` 内部同样经过 `_determine_batch_execution_and_padding` → `_sync_metadata_across_dp`（`#L3410-L3427`），空闲组的本地图模式非 NONE ⇒ `allow_dp_padding` 为真 ⇒ 它把自己的宽度换成全局最大值，并且 `num_tokens_across_dp[:] = num_tokens_padded`（`#L3446-L3450`），图模式再被 min 压成 NONE，所以**实际前向宽度是 6048、eager**，还会连带 `drafter.dummy_run`（`#L3642-L3650`）。03-review 自己给的建议改法（其 P1-6）也是这个写法，两份审查在机制上并不冲突 |
| MTP 层每卡权重 | 本文件不算这笔账，只在 A0.3 注明「02 §1.3 的合计尚未含 MTP 约 0.65 GiB」，算例按 ≈21 GiB |

### 本轮跳过

- 按约束未读：HANDBOOK、官方教程 `GLM5.3-Flash.md`、`wiki/concepts/glm-5-3-flash-two-node.md`。因此所有 `[S]` 项仍按计划 §3 接受，未独立验证（已写进 A0 待核 5）。
- 未改动任何审查文件与 02 / 03 底稿；其中属于它们的修订项（02 的 block_size、每 token 字节、KDA 状态份数、MTP 权重）只在本文件里标注了正确值。
- 本轮没有命令或文件被拦截。

### 追加修订（同日，补 A0 权重加载）

- 依据 `docs/plans/2026-09-27-rfork-inventory.md` §4，A0「怎么走的」加了第 6a/6b 步，新增 §A0.7「默认的权重加载路径」和 §A0.8「A0 变体：RFork 热启动」。A0.8 以工作版 `rfork@3284850b` 为准，末尾逐点对照社区版 `db701c1f`。A0.3 引用的 02 §1.3 合计同步为 20.58 GiB。本轮读取没有被拦截。

### 追加修订（同日第三轮，依据 `docs/mainline/review/01-A0-supplement-review.md`）

| 意见 | 处理 | 说明 |
|---|---|---|
| **P1-1** 草稿 session 漏了自带的 `embed_tokens` 与 `shared_head.head` | **已改** | 对照源码核实：RFork 在 `get_model()` 内部就完成登记、传输和发布（`rfork@3284850b:…/rfork_loader.py#L572-L577`、`#L623`、`#L636-L644`）；proposer 在返回之后才共享、删除（`db701c1f:…/llm_base_proposer.py#L325` → `#L384-L387`、`#L548`、`#L596`）；seed 清单在登记时生成（`transfer_backend.py#L396`）。草稿 session 从 541.6 改为 **≈ 844 MiB**（+2 × 151.25），每卡合计从 21,114 MiB ≈ 20.62 GiB 改为 **≈ 21,416 MiB ≈ 20.91 GiB**，整实例从 330 改为 **≈ 335 GiB**。审查报告写的 20.92 是舍入误差：精确值 (20,572.5 + 844.1) ÷ 1024 = 20.915。草稿仍为 1 批，主模型仍 ≥ 21 批。第 9 步补了机制说明，待核 2 同步改数，待核 3 改为已核结论。 |
| P1-1 附带提醒：登记钉住草稿自带的两份张量 | **写成待核 6，未改任何块数** | `_tensor_storage_owner`（`transfer_backend.py#L153-L175`）与 `#L401` 证实登记保活 storage，所以 `del` 之后不会释放。推得每卡多占约 302.5 MiB、KV 约少 38 块。这是新增推断且未实测，A0.5 / B 段的 3,855 不动；「做了什么」末段加了一句指向待核 6。 |
| **P2-1** 漏了延迟发布 `DEFERRED` | **已改** | 做了什么第 4 条、怎么走的第 7 步改成两档：租约已还就立即发布；没还就返回 `DEFERRED`（`session.py#L336-L345`），由后台线程归还后调 `_promote_deferred_seed_locked` 补发（`#L197-L203`、`#L227-L250`）。另补：归还默认最多 3 次、间隔 30 s（`config.py#L14-L15`），失败则不成为 seed（`#L204-L213`）。 |
| **P2-2** 工作版树里没有 GLM 模型实现 | **已改** | 在本节开头加「版本口径」段，适用条件加「代码基」一条；第 9 步写明草稿判定 `_is_mtp_hf_config`（`rfork_loader.py#L112-L126`）依赖 `db701c1f` 的注册名 `Glm5NextMTPModel`。已复跑 `ls-tree`：`3284850b` 下没有 `vllm_ascend/models/glm5_next*.py`。 |
| **P3-1** 「整机 16 × 20.58」 | **已改** | 改为「整实例 16 × 20.58 ≈ 329 GiB（每台机器 8 × 20.58 ≈ 165 GiB）」。 |
| **P3-2** `git grep` 无命中的写法 | **已改** | 改为 `vllm_ascend/` 下只有 `ops/linear.py#L467` 一处，只针对 `wo_a`（已复跑）。 |
| **P3-3** `read_weights_from_seed` 行号 | **已改** | `#L616-L793`（公开方法 `#L616-L624`，实现 `#L626-L793`）。 |
| **P3-4** `manifest.py` 行号 | **已改** | 两处（第 6 步、对照表）都改为 `#L164-L252`。 |
| **P3-5** seed 侧路由行号 | **已改** | `#L162-L172`。 |
| **P3-6** C 的还原把整份参数当成 TP 分片 | **已改，且比审查说的多** | 审查只指出 MTP 层 13.75 MiB（误差 ≈ 0.09 GiB）。复核源码和 02 §4.4 / §5.7 / §7.5，还漏了三类不切 TP 的参数：索引器的 `wq_b`（`ReplicatedLinear`，`db701c1f:…/glm5_next.py#L1277-L1283`）与 `index_kpool_compress_gate`（`nn.Parameter`，`#L1270-L1276`），每层 13.0 MiB × 12 层；KDA 的 `f_a_proj`/`g_a_proj`（`ReplicatedLinear`，2.0 × 34 = 68 MiB）；MTP 的 `eh_proj`（`nn.Linear`，64 MiB）。`fused_qkv_a_proj`、`wk_weights_proj` 的 `disable_tp=True` 也核过（`#L1918-L1925`、`#L1284-L1291`）。整份项从 425.75 改为 **727.5 MiB**，非专家从 16.64 改为 **14.57 GiB**，C 从 306.9 改为 **≈ 304.8 GiB**（口语值 307 → **305**）。下游：C/16 从 19.2 改为 **19.1 GiB**，本机预热一半从 153 改为 **152 GiB**，2C 从 614 改为 **610 GiB**。改动位置：A0.7「本卡收哪些」第 3 条、C 的算式、①②、「每台机器实际读」一句、A0.7 待核 1、A0.8「做了什么」首句。 |
| **P3-7** A0.8 未说明口径不含视觉塔 | **已改** | 「每卡要传多少字节」前加口径行，与 A0.7 待核 1 一致。 |

本轮未改 02 §1.3 的稳态合计 20.58 GiB，也未改 A0.5 的 3,855 块。02 的 KDA 行只是单位笔误，主干小计本来就用的正确值，详见 02 §12.2。本轮读取没有被拦截。

### 追加修订（2026-09-27，据 `review/pages/p3-batch1-recheck.md` R-4）

| 条目 | 处置 | 依据与影响 |
|---|---|---|
| A0.5 算例把「图内存」算进切 KV 之前扣掉的 3.4 GiB | **已改** | `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L563`（注释 `Record torch peak ... BEFORE graph capture`）、`#L590`（`available_kv_cache_memory_bytes = requested_memory − non_kv_cache_memory`）、`#L719`（`capture_model()` 在其后）三行证明顺序是「先量显存 → 切 KV → 再录图」。改动位置：算例前的假设行（3.4 改为「激活峰值 + 非 torch 占用」，并写明图从预算外的 15% 出）、算例里「减其他」那一行、算例后的 `[D]` 说明、A0 待核 3。**3.4 GiB 这个假设的总额没变，只改了它的构成，所以可用 KV 仍是 30.0 GiB、`num_blocks` 仍是 3,855 块、2.47 M token，B 段和下游各站的块数都不动。** |

### 追加修订（2026-09-27，据 `review/pages/request-call-chain-review.md` P1-1）

| 条目 | 处置 | 依据与影响 |
|---|---|---|
| B1「做了什么」把每台机器说成「完整的模型副本」 | **已改** | EP16 下 288 个路由专家摊在 16 张卡上、每卡 18 个（§0 表「每卡路由专家数」），每台机器只是一个 DP 执行组，两组合起来才是一份完整的模型。改为「DP 执行组（机内 TP8）……哪一组都不是一份完整的模型」。全文 `副本` 共 9 处逐处核过：只改这 1 处；另 6 处是 scale 的「FP32 副本」（数据拷贝），2 处是 RFork 语境的「扩副本」（整套服务实例），用法正确，未动。不影响任何数字。 |

### 追加修订（2026-09-28，据 `review/pages/engine-processes-review.md` P5 审查 P2-4）

| 条目 | 处置 | 依据与影响 |
|---|---|---|
| A0.1「合计 20 个进程」没有写统计口径，知识库 engine-processes 页把「按角色计」和「按进程列表数是 21 个」归到底稿名下却无出处 | **已补** | 在 A0.1 合计行后补一句口径：按角色计；node1 `--headless` 启动进程留在 `monitor_engine_liveness()` 不计入，按进程列表数为 21 个；辅助进程与特性另起的进程不计。依据 `vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L146-L148`、`#L235-L253`。20 这个数本身不变，只补口径；本文件其他位置未动 |

### 追加修订（2026-09-28，块数，据 `review/pages/vllm-kv-block-allocation-review.md` P5 审查 P1-1/P1-2 与复审 P3）

| 条目 | 处置 | 依据与影响 |
|---|---|---|
| indexer-state（尾状态）组把首步 2 块当成常驻值，「每条先吃掉 14 块」「R1 结束还 15 块」「被踢那条 121 块」都偏小 | **已改** | 尾状态组是上游 `SlidingWindowManager`，窗口 = 块 = 4（`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L339-L341`，登记 `vllm_ascend/core/kv_cache_interface.py#L366-L369`）；`allocate_slots` 先 `remove_skipped_blocks(c)` 再求块（`vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L370-L383`）；窗口外 token `max(0, c − 3)`（`single_type_kv_cache_manager.py#L793`），整块换 null 还池（`#L464-L487`）；运行中请求补到 `cdiv(need, 4)`、`len` 含 null（`#L132`、`#L146-L154`）。手里 = `cdiv(c + n + 3, 4) − floor(max(0, c − 3)/4)`：首步 2、decode 3–4、prefill 一步 `cdiv(n + 3, 4)`。改动：§A2.2 新增「尾状态组每一步」推导与表，满长度 222 → 223–224、32 条 448 → 480–512、平均 68.1 K → 66.9–67.5 K；§A7 R1 结束 15 → 16–17；§B2 补尾状态组 2,037 → 2,038 → 930 → 3；§B3 场景 M 46 → 47–48 块、6000 token 新请求 24 → 首步 1,523 块、60,000 例 108 → 109–110 块、被踢那条 121 → 120–121 块（≈ 956–964 MiB，约 67,000 token）、新增「排回来要约 2,167 块」一条；P1-6 修订表行加再更正说明。KDA 12 块、R1 首步 15 块不变。 |
| 清零（A2 待核 2、B3 待核 1） | **已核** | 调度器侧 `needs_kv_cache_zeroing` 为真（`vllm/v1/kv_cache_interface.py#L873-L879`），执行侧只有存在 `_kv_block_zeroer` 才清（`vllm/v1/worker/gpu_model_runner.py#L1103-L1106`），昇腾 worker 只在 `eagle3` 且投机 token 数 > 1 时建（`vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L917-L925`）；GLM 用 mtp → 不清零。main `baa023ad` L1146–L1158 另有 model runner v2 入口。不影响块数 |
| 昇腾 KDA 管理器求块时每组多报 1 块（复审 P3-1） | **已补说明** | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_mamba_manager.py#L76-L80` 的外部 KV 判断对 c > 0 的运行中请求都成立（`new_computed_blocks` 为空，`kv_cache_manager.py#L339-L342`），三组求和 +3，实际借块仍 0。只让「够不够」多要 3 块，抢占约提前 3 块；**常驻 15–16、R1 结束 16–17、被踢 120–121 都不变**。v0.26 / main 只是把同一个量提成 `local_hit_tokens`，条件等价。改动：§A2「怎么走的」第 4 条补一句 |

以上是按源码的推导，没有实跑。知识库同步：`vllm-kv-block-allocation`（尾状态组算法唯一出处）、`one-request`（R1 逐圈）、`glm-5-3-flash-two-node`、`concurrent-requests`（整批表）、`block-table`。
