> 章节草稿始于 2026-09-21；2026-10-05 同步知识库与四问口径。章号待统一编；模型与硬件画面的独立会话进度未在本次核验。

# 项目地图

## 知识库现状与四问口径（2026-10-05）

知识库工作树位于 `../infra-view-new-llm-wiki`，预览为 `http://localhost:5193/#/wiki`。P1–P5 的 30 批 119 页主线重建已提交；当前已发布 143 页，正式写作标准名单 104 页，本轮审计 104/104 通过。14 张机制动图已改为静态分格，Sleep Mode 已由用户批准发布。状态页可统一选择 Claude Code / Codex 及模型，当前使用 Codex / `gpt-6.1-sol`；已有真实问答与临时库编译验证，完整模型质量验收仍待完成。11 张无引用旧图已删除，保留 288 张现用图。最新检查点、工程回归和剩余功能统一见[知识库交接](../infra-view-new-llm-wiki/docs/plans/2026-09-28-session-handoff.md)及[P6 验收对账](../infra-view-new-llm-wiki/docs/plans/2026-10-05-p6-acceptance.md)。

以下四问仍放在**模型讲解的最后**。固定口径统一为 GLM-5.3-Flash 的官方双机部署：2×Atlas 800 A2×8、TP8/DP2/EP16、W8A8。知识库中的教学推导已经有出处，不代表主仓已实现 GLM config 解析器、工作台页面或耗时预测器。

| 四问 | 当前可引用的答案与边界 | 单一出处 |
|---|---|---|
| 每生成一个 token 的 KV 显存 | GLM 混合历史包括逐位置缓存与固定状态，不能用统一的普通 K/V 公式。此部署逻辑块为 640 token，每卡每块号 8,355,840 B，折合每 token 13,056 B 是块容量口径；实际请求分配还受缓存组、固定状态和块取整影响 | [部署页：一个 token 的历史占多少](../infra-view-new-llm-wiki/wiki/concepts/glm-5-3-flash-two-node.md)与[单请求调度的 15 个块号](../infra-view-new-llm-wiki/wiki/concepts/one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号) |
| 总参数量与激活参数量 | 主干约 3133 亿、每 token 激活约 174 亿；主干口径与模型卡 320B/18B 不同。每卡权重教学账约 20.58 GiB，精度分支与额外开销须保留适用条件 | [模型页：参数量](../infra-view-new-llm-wiki/wiki/concepts/glm-5-3-flash.md#参数量3133-亿里-97-是路由专家)、[部署页：每张卡上放了什么](../infra-view-new-llm-wiki/wiki/concepts/glm-5-3-flash-two-node.md#每张卡上放了什么) |
| 给定输入、输出与 batch 的部署方案 | 先用固定双机作为贯穿示例。每卡 64 GiB、预算比例 0.85、激活与非 torch 占用 3.4 GiB 均属教学假设；示例余量 30 GiB 对应 3,855 块，使用精确权重后为 3,908 块。不能把总容量直接当成任意输入长度下的并发承诺；通用方案求解器仍未完成 | [部署页：剩下的显存变成多少 KV cache](../infra-view-new-llm-wiki/wiki/concepts/glm-5-3-flash-two-node.md#剩下的显存变成多少-kv-cache)、[多请求](../infra-view-new-llm-wiki/wiki/concepts/concurrent-requests.md) |
| Prefill / Decode 理论耗时 | 已有七站形状、通信次数和字节账；尚无可在本地图中引用的完整耗时结论。算力、有效带宽、通信等待、调度与 MTP 接受率需逐项建立模型并与设备实测核对，不能用 910C 表或理想峰值填成双机 A2 的预测结果 | [单请求：开销和什么时候别开](../infra-view-new-llm-wiki/wiki/concepts/one-request.md#开销和什么时候别开) |

下方章节安排保留用户已定顺序。特性覆盖表中的 13/51、缺 38 项等是 **09-21 的盘点基线**，不再代表现库；它也不能由“143 页”换算成最新官方特性覆盖率，重新逐项映射前不宣称全覆盖。知识库静态分格决定只适用于知识库，不改变模型与硬件舞台的动画方向。硬件物体仍最后接入。

## 一句话

这是一条固定的学习路径：从一个 token 走到读懂 vLLM-Ascend 源码。**每一章 = 详细讲解 + 配合讲解的动画。**路径上挂着两个 3D 物体（模型、硬件）当舞台，挂着一个知识库当事实的底和「不懂就问」；**模型这一段讲完，要能对着这个模型答清立项时那四问**（KV 显存、参数量与激活参数、部署方案、prefill/decode 耗时）。

## 手上有的六样东西

| 东西 | 在哪 / 怎么打开 | 到哪一步了 | 在整站里干什么 |
|---|---|---|---|
| **首页** | 主仓 `infra-view-new`（main），`http://localhost:5183/#/` | 城市 3D 背景 + 左侧十章目录；**目录只是静态文字，没有任何章节页** | 入口。点进去就该是章节线 |
| **地基** | 主仓 `src/sim/`、`src/timeline/` | 完成、有测试；Qwen3-0.6B 一层前向 21 步真实数据 + 昇腾 910B 驻留/搬运规则 + 播放引擎。**目前没有任何画面在消费它** | 让「模型层」和「硬件层」每一步对得上的数据来源 |
| **模型物体（GLM）** | `infra-view-hardware-study-20260906/glm-flow/master/`，`python tools/serve_preview.py` → `http://localhost:4178/glm-flow/master/model.html` | GLM 整模型 3D 母版（09-25 用户定）：真实比例、照 bbycroft 排，45 层 + MTP + 头尾，形状和参数对照官方代码与权重文件；还没有能播的段，未接入主仓；准绳是该目录的 `MASTER-DESIGN.md` | Part 1「模型计算层」各章的舞台 |
| **硬件物体** | 同目录 `whole/`，同一个服务 → `http://localhost:4178/whole/` | 「算力群岛 · 机柜到芯片」，DGX H100 / Atlas 800T A2，机柜→整机→内部→模组；可用，未接入主仓 | Part 2「硬件执行层」各章的舞台 |
| **知识库** | 工作树 `infra-view-new-llm-wiki`（分支 `feat/llm-wiki`），后端 8790 + 前端 `localhost:5193/#/wiki` | 143 页、104 页通过正式标准审计；当前 P6 工程验收通过（1,021 单测、82 浏览器用例、构建），完整功能与模型质量验收仍有缺项，详见本文件开头 | Part 3/4 各章的底稿；同时是每章右侧的「不懂就问」 |
| **模型工作台**（PLAN.md §1.2） | 主仓 `src/sim/modelspec/`（`analyze.ts`），没有页面 | 数字引擎有一半：有测试，Qwen3 的参数量、激活参数、每 token KV 字节已能算；第 3、4 问（部署方案、理论耗时）没做；页面没做；GLM 的 config 解析器没做（现有解析器只认 qwen3 / qwen3_moe / qwen2 / llama） | Part 1 收尾那一章的交互部分，也是「母版」的落点：贴另一份 `config.json`，3D 模型物体和四个答案一起变 |

同目录还有 `glm/`（用户自己的版本）和主仓里用户自己的素材包——谁都不动。

## 它们怎么串

```
首页（入口目录）
  └─ 章节线（一条路，见下面的章节清单；章号未编）
       ├─ Part 0  导论                        ─ 舞台：模型物体开场镜头
       ├─ Part 1  模型计算层                  ─ 舞台：模型物体（glm-flow）
       │            └ 收尾章                  ─ 模型物体 + 模型工作台，答四问
       ├─ Part 2  硬件执行层                  ─ 舞台：硬件物体（whole）
       ├─ Part 3  vLLM / vLLM-Ascend 特性     ─ 无 3D 舞台：2D 图 + 详细讲解
       └─ Part 4  工程与源码                  ─ 无 3D 舞台：2D 图 + 详细讲解
                                                  ↑ 底稿来自知识库
  知识库 也挂在每一章右侧当「不懂就问」
  地基（src/sim + src/timeline）供给两个舞台的每一步数据与播放
```

一句话版：首页把人放进章节线；模型层的章用模型物体演，最后一章用工作台把四问算出来，硬件层的章用硬件物体演，特性和源码的章不需要 3D、用 2D 图加讲解，讲解稿从知识库扩写；地基负责让「现在算到哪一步、数据在哪块存储」两边同时对得上。

## 章节清单（第二版，2026-09-21）

骨架还是 PLAN.md 的五段（已定 a）。**章号先不编。**模型计算层的章由你在另一个会话里定，那一段有几章还没定，先编号后面全要挪。所以下面只写「段 + 段内顺序」，**章号等模型层定了再统一编**。

### 第 0 段 · 导论

| 顺序 | 章名 | 讲什么 | 舞台 | 知识库底稿 | 现状 |
|---|---|---|---|---|---|
| 1 | 从一次对话开始 | 一句话走完这条请求从文字到文字经过哪几段，立下全站约定（双层视图、颜色语义、证据标记、播放器） | 模型物体（GLM，开场） | one-request | 底稿已统一为 GLM 官方双机请求，导论沿同一条主线 |

### 第 1 段 · 模型计算层（用 GLM-5.3-Flash 讲）

**模型计算层的章节由用户在另一个会话里定，这里不排；只保留收尾章「用这个模型回答四问」的位置（见已定 e、f）。**

| 顺序 | 章名 | 讲什么 | 舞台 | 知识库底稿 | 现状 |
|---|---|---|---|---|---|
| 末章 | 用这个模型回答四问 | 拿 GLM 的 config 当场算 KV 显存 / 参数量与激活参数 / 部署方案 / prefill-decode 理论耗时，每个数字指回这一段前面讲过的形状 | 模型物体 + 工作台 | 部分：attention-cost、kv-cache、kv-cache-spec | 数字引擎有一半；页面与第 3、4 问未做 |

### 第 2 段 · 硬件执行层（硬件物体，最后接入）

| 顺序 | 章名 | 讲什么 | 舞台 | 知识库底稿 | 现状 |
|---|---|---|---|---|---|
| 1 | 从机柜到芯片 | 一个连续镜头从机柜推到整机、模组、单颗芯片，看清 AI Core、片上存储层级、HBM 各在哪 | 硬件物体 | 无 | 有物体，无文字底稿 |
| 2 | 一次请求在硬件上的旅程 | 同一条请求在 CPU、HBM、AI Core、卡间互联之间走了哪几趟，哪一步等带宽、哪一步等算力 | 硬件物体 | 无 | 有物体，无文字底稿 |

### 第 3 段 · vLLM / vLLM-Ascend

例子沿用 Qwen3-0.6B 那条请求；这一段全部是 2D 图 + 详细讲解，没有 3D 舞台。分两块：先走一遍**不开任何特性**的代码全流程（上、下两章），再按特性分类讲（11 章）。

#### 3-A 代码全流程（两章）

| 顺序 | 章名 | 讲什么 | 知识库底稿 |
|---|---|---|---|
| 1 | 代码全流程（上）：上游 vLLM 的骨架 | 三个进程怎么起、EngineCore 那个 while 循环转一圈干什么、调度器怎么做减法、KV 块什么时候分出来，以及一条请求从 HTTP 到 token 的调用链 | 见下面的小节表 |
| 2 | 代码全流程（下）：昇腾怎么挂进来 | 插件怎么注册、平台接口是哪几个方法、NPUPlatform 改了什么、配置与 patch 怎么落地、Worker 的生命周期、NPUModelRunner 怎么读、准备输入产出哪四个张量、vLLM 和昇腾各管什么 | 见下面的小节表 |

**小节与底稿页以 `C:/Users/-/Desktop/infra-view-new-llm-wiki/src/content/wiki/toc.ts` 的 `CURATED.flow` 为准**，下面这两张表是把 `CURATED.flow` 的五组按上/下拆开的结果。

上章 · 上游 vLLM 的骨架：

| 小节 | 知识库页 | 备注 |
|---|---|---|
| 先看全貌 | vllm-v1-shape、request-call-chain | 三个进程两道边界；HTTP 到 token 七跳 |
| 三个进程 | engine-processes | **待定**：`CURATED.flow` 把它放在「启动：昇腾怎么挂进 vLLM」组里（因为 patch 的三个注入点写在这页），但内容主体是 V1 的三类进程。要么整页放上章、patch 注入点在下章回指，要么反过来 |
| EngineCore 循环 | vllm-engine-core | |
| 调度 | vllm-scheduler | 「调度器没有 prefill / decode 之分」这一页是后面调度特性章的地基 |
| KV 块分配 | vllm-kv-block-allocation | block-table 归 KV 特性章，这里只点一句 |

下章 · 昇腾怎么挂进来：

| 小节 | 知识库页 | 备注 |
|---|---|---|
| 昇腾侧总览、谁管什么 | vllm-ascend-overview、who-owns-what | who-owns-what 讲的分界线正好是上下两章的接缝 |
| 插件注册与平台接口 | platform-plugin-registration、vllm-platform-interface、npu-platform | |
| 配置与 patch | ascend-config-system、ascend-patch-system | |
| Worker 生命周期 | npu-worker-lifecycle | |
| ModelRunner 与准备输入 | npu-model-runner、prepare-inputs-flow | |
| 注意力后端 | attention-backend-family | **待定**：原来挂在模型层的注意力章，模型层不在此排；也可能挂到「图模式与算子」那一章 |

`CURATED.flow` 里还有 5 页不进这两章：block-table → KV 与显存章；ops-and-kernels、op-to-ai-core、graph-mode-layer → 图模式与算子章；vllm-ascend-repo-map、reading-vllm-ascend → 第 4 段读源码章。

**原则（用户 2026-09-21 定）**：章节自己要把事情讲明白、成体系；知识库页是读者非常需要深入某个特性时才点进去看的参考，不是章节的替代。所以同一页在知识库目录里和在章节线上各有位置，不算重复。

#### 3-B 特性（按 vllm-ascend 官方文档重排）

**特性的全集以官方文档为准，不以知识库现有页为准。**事实来源：`C:/Users/-/Desktop/infra-view-new-llm-wiki/tools/repos/vllm-ascend`，上游 `origin/main` = `c173a64a4`（2026-09-21）；知识库钉的是 `b255ab59`（2026-09-19）。点出 **51 个官方特性项**，这么数的：`docs/source/user_guide/feature_guide/` 下 33 篇（除去 `index.md` 和 `images/`）+ `docs/source/developer_guide/Design_Documents/` 里另有 5 项没有用户指南（disaggregated_prefill、balance_schedule_refactor、npugraph_ex、speculative_kv_sliding_window、add_custom_aclnn_op）+ `support_matrix/supported_features.md` 里另有 11 项没有专门文档（Chunked Prefill、Automatic Prefix Caching、Tensor Parallel、Data Parallel、Expert Parallel、Async output、Multi Modality、Pooling、LogProbs、Prompt LogProbs、Beam search）+ 2 项另算（KV Cache 量化，从矩阵 Quantization 一行里拆出来，因为知识库单独写了一页；RecomputeScheduler，只在代码里、文档没写）。33 + 5 + 11 + 2 = 51。**知识库覆盖其中 13 项，缺 38 项**（覆盖 = 有一页专门讲这一项；只在别的页里被提到不算）。**完全空白的三类**：模型加载与弹性（0/3）、输出与适配（0/7）、强化学习（0/1）。

下表一类一章。「官方文档」列里 `fg/` = `docs/source/user_guide/feature_guide/`，`dd/` = `docs/source/developer_guide/Design_Documents/`，`矩阵` = `support_matrix/supported_features.md`。

**主线特性章 = 第 1–8 类 + 第 10 类里的 LoRA 与结构化输出两项，共 9 章**；第 9、11 类和第 10 类其余五项只放知识库，不排章（已定 h）。

| 顺序 | 章名 | 官方有哪些特性（附文档） | 知识库已有 | 缺哪些 |
|---|---|---|---|---|
| 1 | **调度**（1/8） | Chunked Prefill（矩阵，链上游 vLLM 文档，昇腾侧无专门篇）· ShortRequestFirst `fg/short_request_first.md` · Batch-Job-Aware Scheduler `fg/batch_job_aware_scheduler.md` · AI QoS `fg/Ai_QoS_introduction_en.md` · DyntraLB `fg/dyntra_lb.md` · Balance Schedule `dd/balance_schedule_refactor.md` · Async output（矩阵） · RecomputeScheduler（只有代码：`vllm_ascend/core/recompute_scheduler.py`，配置键 `recompute_scheduler_enable`） | chunked-prefill；vllm-scheduler（全流程页，兼作地基） | ShortRequestFirst、Batch-Job-Aware、AI QoS、DyntraLB、Balance Schedule、Async output、RecomputeScheduler（recompute-cpu-offload 只讲 connector 那一侧，没讲抢占调度器本身） |
| 2 | **KV Cache 与显存**（5/8） | Automatic Prefix Caching（矩阵） · KV Cache CPU Offload `fg/kv_cache_cpu_offload.md` · Layerwise / Sparse Offload `fg/layerwise_and_sparse_kv_cache_offloading.md` + `dd/` 同名 · KV Pool（Ascend Store）`fg/kv_pool.md` + `dd/KV_Cache_Pool_Guide.md` · PreemptOffloadConnector `fg/preempt_offload_connector.md` · LMCache-Ascend `fg/lmcache_ascend_deployment.md` · UCM Store `fg/ucm_deployment.md` · KVPP `fg/kvpp.md` + `dd/kvpp.md` | prefix-caching、kv-cache-cpu-offload、kv-cache-layerwise-offload、kv-cache-sparse-offload、kv-pool、recompute-cpu-offload；另有 4 页讲底层机制不对应官方特性项：paged-attention、block-table、kv-cache-spec、kv-cache-memory-profiling | LMCache-Ascend、UCM Store、KVPP |
| 3 | **并行 I：切模型**（2/5） | Tensor Parallel（矩阵） · Fine-grained TP `fg/Fine_grained_TP.md` · Pipeline Parallel `fg/pipeline_parallel.md` · Dynamic Chunked PP `fg/dynamic_chunk_pipeline_parallel.md` + `dd/dynamic_chunked_pipeline_parallel.md`（profiling chunk 是它的实现机制，不是独立特性） · Data Parallel（矩阵） | tensor-parallel、pipeline-parallel | Fine-grained TP、Dynamic Chunked PP、Data Parallel |
| 4 | **并行 II：专家与长序列**（1/5） | Expert Parallel（矩阵） · EPLB `fg/expert_parallelism_load_balancer.md` + `dd/model_runner_v1_eplb.md` + `dd/model_runner_v2_eplb.md` · 大规模 EP 分布式 DP Server `fg/large_scale_ep.md` · Sequence Parallelism `fg/sequence_parallelism.md` · Context Parallel（PCP / DCP）`fg/context_parallel.md` + `dd/context_parallel.md` | sequence-parallel | EP、EPLB（MRv1 与 MRv2 两条路）、large_scale_ep、Context Parallel |
| 5 | **图模式与算子**（1/6） | Graph Mode（ACL Graph）`fg/graph_mode.md` + `dd/ACL_Graph.md` · npugraph_ex `dd/npugraph_ex.md` · Flash Attention 3 `fg/flash_attention.md` · CPU Binding `fg/cpu_binding.md` + `dd/cpu_binding.md` · Batch Invariance `fg/batch_invariance.md` · 自定义 aclnn 算子 `dd/add_custom_aclnn_op.md` | graph-mode-layer、ops-and-kernels、op-to-ai-core（后两页是机制页，不对应某个官方特性项） | npugraph_ex、FA3、CPU Binding、Batch Invariance、自定义 aclnn 算子 |
| 6 | **量化**（1/2） | 权重 / 激活量化（W8A8、W4A8 等）`fg/quantization.md` + `dd/quantization.md`（ModelSlim 适配） · KV Cache 量化（矩阵 Quantization 一行里的一支） | kv-cache-quantization | 权重 / 激活量化整块——这是知识库最大的一个洞 |
| 7 | **投机解码**（1/2） | Speculative Decoding（proposer-verifier、n-gram / 草稿模型 / MTP）`fg/speculative_decoding.md` · Spec Decoding KV 滑窗 `dd/speculative_kv_sliding_window.md` | speculative-decoding | KV 滑窗（长上下文下草稿接受率崩掉的那个问题） |
| 8 | **PD / EPD 分离与 KV 传输**（1/4） | Disaggregated Prefill `dd/disaggregated_prefill.md`（无用户指南） · Disaggregated Encoder（EPD）`fg/epd_disaggregation.md` · Mooncake Layerwise 适配 `fg/mooncake_layerwise_adaptation_and_optimization.md` · Mooncake Hybrid Attention `fg/mooncake_hybrid_attention.md` | pd-disaggregation | EPD、Mooncake 两篇 |
| 9 | **模型加载与弹性**（0/3）**· 只放知识库，不进主线** | Netloader（卡间 P2P 传权重）`fg/netloader.md` · RFork（从种子实例拉权重热启）`fg/rfork.md` · Sleep Mode（卸权重、丢 KV）`fg/sleep_mode.md`——三项都**只放知识库** | 无 | 全缺。偏运维，主线不排章。Sleep Mode 我从「KV 与显存」挪到这里：文档开头写的是 offload model weights、服务 RL 后训练，和 netloader / rfork 同属「权重怎么来、怎么走」，不是 KV 容量问题 |
| 10 | **输出与适配（主线只讲 LoRA 与结构化输出）**（0/7） | **进主线**：LoRA `fg/lora.md` · Structured Output / Guided Decoding `fg/structured_output.md`。**只放知识库**：Multi Modality（矩阵） · Pooling（矩阵） · LogProbs（矩阵） · Prompt LogProbs（矩阵） · Beam search（矩阵）。Enc-dec 在矩阵里是 🟡 Planned，不算 | 无 | 全缺。进主线的两项有完整的专门指南（不是只在矩阵里），所以这一章只讲这两项 |
| 11 | **强化学习**（0/1）**· 只放知识库，不进主线** | vLLM-Ascend for RL `fg/rl.md`（rollout 引擎、权重同步回训练框架）——**只放知识库** | 无 | 全缺。偏运维，主线不排章。Sleep Mode、FA3、Batch Invariance 三项的动机都指向这里，写知识库页时当它们的收口 |

附：**参数手册**（不是一章）。知识库「参数」部分的 23 个参数页；各特性章用到哪个就链过去。

**上游每天在动**（知识库钉的 commit 比 `origin/main` 旧两天，两天里 feature_guide 就有增改），**定稿前这张表要再对一次**。

### 第 4 段 · 工程与源码

| 顺序 | 章名 | 讲什么 | 知识库底稿 | 现状 |
|---|---|---|---|---|
| 1 | 性能工程 | TTFT / TPOT / 吞吐怎么定义和测，profiling 出来的一条慢在哪，怎么从指标回溯到前面章节的某个机制 | 无 | 空 |
| 2 | 读源码与 PR 影响分析 | vllm-ascend 的仓库地图和自己读源码的方法，再拿几个已合并 PR 走一遍「PR → 文件 → 模块 → 特性 → 数据流 → 指标」 | reading-vllm-ascend、vllm-ascend-repo-map；PR 分析缺 | 一半 |

### 读法

- 这一版和上一版比，动了四处：模型计算层的章全部撤出（等你在另一个会话里定）；代码全流程拆成上下两章；量化和投机解码拆成两章；特性段从「照知识库现有页列」改成「照官方文档列全集，再标知识库缺哪些」。
- 上一版说「调度特性只有一个」是错的——那是在数知识库的页，不是在数官方的特性。官方调度侧至少 8 项。
- **现在就能从知识库扩写的**：代码全流程上下两章、KV 与显存、PD 分离、图模式与算子。
- **完全没有底稿的**：硬件两章、性能工程，以及特性段进主线的「输出与适配」那一章（LoRA、结构化输出两项都是 0 页）；模型加载与弹性、强化学习两类不进主线，但知识库也是 0 页。
- 特性段整体覆盖率 13 / 51。这不是知识库写错了，是它当初只按「全流程会碰到的」来选页；主线要成体系，就得按官方全集补。

### 想听你意见的

目前没有。模型计算层的章节在另一个会话里定；定了之后回来统一编章号。

**新旧章号对照**：知识库每页 frontmatter 里的 `chapters` 现在还是旧章号。等模型层定了、章号统一编完，用脚本一次性换，不用重写页面。

## 现在为什么乱

1. **章节目录有两份，对不上**：首页十章（基础概念…社区与开源）和 PLAN 的 22 章是两套划分，知识库的章号挂的是 22 章那套，首页那套一页都没有。
2. **两个 3D 物体在主仓之外，也没写明属于哪一章**：`glm-flow/` 和 `whole/` 都在另一个研究目录里，各自能单独打开，但没有任何地方写「它是第几章的画面」。
3. **主仓的交接文档不知道另外两样东西存在**：`HANDOFF.md` 只说「只剩地基、画面待定」，没提 3D 物体，也没提知识库——按它接手的人会以为项目只有主仓。

## 已定的（2026-09-21）

**a. 章节照哪份目录排 → 以 PLAN 的五大段为骨架。**
导论 → 模型计算层 → 硬件执行层 → vLLM / vLLM-Ascend 特性 → 工程与源码；章数可以合并变少，但先后顺序和五段结构保留（理由：这五段正好对应手上的模型物体 / 硬件物体 / 知识库）。
首页十章是这五段的粗粒度版本，章节表定稿后照它改。

| 首页 | ≈ PLAN |
|---|---|
| 01 基础概念 / 02 模型结构 / 03 推理算法 | Part 1（01–06） |
| 04 KV Cache | 11 章 |
| 05 并行策略 | 13–15 章 |
| 06 系统架构 | 10、12 章 |
| 07 性能优化 | 16、17、19 章 |
| 08 部署与实践 | PLAN 里没有对应章 |
| 09 进阶专题 | 06 章、17 章、多模态 |
| 10 社区与开源 | 20、21 章 |

**b. Part 1 用哪个模型讲 → GLM。**
Part 1 模型计算层（token → 一层 → 注意力 → 生成下一个词）以 **GLM-5.3-Flash 这个 3D 模型物体**为准，讲解文字和数字跟着 GLM 走。
Part 3/4（vLLM / vLLM-Ascend 特性与源码）现已统一为 **GLM-5.3-Flash 官方双机**请求主线，出处与数字见本文件开头。Qwen 小模型只保留为明确标注的局部示例，不再是知识库共享请求的默认口径。
主仓地基里 Qwen3-0.6B 的 21 步数据保留不动，将来母版泛化（粘贴 config.json 生成模型）时当第二个模型验证。
事实备注：主仓内置的 Qwen 配置是 Qwen3-0.6B（主用）、Qwen3-8B、Qwen3-30B-A3B（`src/sim/modelspec/presets/`）。

**c. 硬件物体什么时候接主仓 → 最后接。**
你的原话：「我想的就是最后接。」模型物体先做完，硬件物体排在最后。

**d. 首页十章目录怎么办 → 章节表定稿前不动首页。**
现在改就是改两遍。

**e. 立项那四问放在哪 → 模型讲解的最后（用户 2026-09-21 定）。**
立项时（2026-09-06）你的原话：「比如 hugging face 中开源模型的 config.json 复制进来 我们可以把整个模型构建出来……然后我们可以回答清楚 1、根据这个模型计算出 kv cache 在一次生成任务中每生成一个 token 所需要的显存大小 2、计算出模型的参数量以及激活参数大小 3、对于输入 prompt 长度为 X k，输出长度为 Y k，z batch size，大概给出什么设计方案 4、给出 prefill、decode 阶段的理论耗时计算」。
四问不是整条学习路径的终点，也不是旁边的一个工具，而是 **Part 1 收尾那一章**：先用 GLM 算一遍，每个数字都要能指回前面章节讲过的形状（第 1 问指回 04 Attention 的 KV 形状，第 2 问指回 02 的矩阵形状和 06 的专家数，等等）。

**f. 第 3、4 问的硬件口径 → 统一采用 GLM 官方双机 A2。**

收尾章使用本文件开头「四问」表引用的部署前提和预算；09-21 的 910C/A3 小表已被双机 A2 口径取代，不再用来推导当前方案。数字只在知识库单一出处页维护。理论耗时仍待建立并验证模型，不能把待实现的预测写成已算出的结果。

**g. 特性段照什么排 → 以官方文档为全集，分 11 类，顺序已定（用户 2026-09-21 定）。**
特性不按知识库现有页来数，而是以 vllm-ascend 官方文档点出的 51 项为全集；分成上面那 11 类，类的分法和先后顺序按第二版原样定下，不再调整（含 Sleep Mode 归「模型加载与弹性」、DyntraLB 归调度、KVPP 留在 KV）。
知识库只覆盖 13 项，缺的 38 项是写特性章之前要补的底稿。

**h. 最后三类的去留 → 只有「输出与适配」里的两项进主线（用户 2026-09-21 定）。**
第 10 类「输出与适配」里 **LoRA** 和 **结构化输出（Structured Output / Guided Decoding）** 进教学主线，同类其余五项（多模态、Pooling、LogProbs、Prompt LogProbs、Beam search）只放知识库。
第 9 类「模型加载与弹性」（Netloader、RFork、Sleep Mode）和第 11 类「强化学习」（RL）偏运维，先只放知识库，不进主线。
结果：**主线特性章共 9 章 = 第 1–8 类 + 第 10 类里的那两项。**

## 还要你定的

目前没有，同上。

## 建议的先后顺序

1. 定章节表（本文件；除模型计算层外已定，模型层在另一会话定完就统一编章号）。
2. 把 GLM 模型物体做好（另一会话，按 09-20 定的 bbycroft 骨架：左 2D 架构图 ↔ 章节，右同一物体换镜头）。
3. 选一章做样板章：讲解文字从知识库对应页扩写 + 绑定动画 + 右侧接知识库问答。
4. Part 1 收尾章（四问），依赖 **GLM 的 config 解析器**和**工作台页面**，排在第 2 步之后。
5. 其余章节按段推进。
6. **硬件物体最后接入**，做 Part 2 的章。

穿插其中的准备工作：**知识库补缺**（官方 51 项里缺的 38 项，主线用得上的优先）是写特性章之前的前置，属于批量写页，**开工前要你点头**；知识库的**大批量导入仍放在最后，也要你点头**。

**这份地图本身不改任何代码。**定稿之后才去同步首页目录、知识库的章号、PLAN.md 和主仓交接文档。

**这份地图是临时的**：全部定稿后，内容并进 `PLAN.md`（§1.1 章节、§1.2 工作台的位置）和主仓 `HANDOFF.md`，然后删除本文件，只留一处讲「项目是什么」。
