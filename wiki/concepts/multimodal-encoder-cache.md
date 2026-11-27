---
id: multimodal-encoder-cache
title: 多模态视觉编码与特征缓存：ViT 分块图捕获与 EncoderCacheManager
type: feature
origin: direct
summary: >-
  深入多模态请求的视觉词元膨胀账单、EncoderCacheManager 在多轮变前缀对话与抢占驱逐重算中如何独立于文本 Prefix Caching 复用视觉编码特征（含 main 分支 Score 两级缓存接线边界）、ViT 预算打包与昇腾 EncoderAclGraphManager 图捕获回放，以及 msmodelslim / msprobe 在多模态新模型上线中的分工。
aliases:
  - EncoderAclGraphManager
  - EncoderCudaGraphManager
  - ViT Packing
  - ViT 分块图捕获
  - ViT 图捕获
  - 视觉特征缓存
  - 视觉编码缓存
  - 多模态特征缓存
  - 视觉词元缓存
  - mm_hash
  - msmodelslim
  - Service Profiling
  - MS Service Profiler
chapters:
  - '01'
  - '11'
  - '16'
order: 75
sources:
  - 'vllm@ced6857a:vllm/config/ec_manager_config.py#L12-L30'
  - 'vllm@ced6857a:vllm/v1/core/encoder_cache_manager.py#L58-L193'
  - 'vllm@0fc695fc:vllm/v1/core/encoder_cache_manager.py#L67-L130'
  - 'vllm@568afb3a:vllm/v1/core/encoder_cache_manager.py#L67-L130'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L255-L260'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1490-L1500'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1672-L1785'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ec_manager/score_ec_manager.py#L32-L80'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ec_manager/score_ec_manager.py#L172-L299'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1107-L1279'
  - 'vllm@ba15685a:vllm/v1/worker/gpu/mm/encoder_runner.py#L249-L282'
  - 'vllm@ced6857a:vllm/config/compilation.py#L550-L576'
  - 'vllm@ced6857a:vllm/v1/worker/encoder_cudagraph.py#L454-L548'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/encoder_acl_graph.py#L257-L368'
  - 'vllm-ascend@2c59ff10:vllm_ascend/worker/encoder_acl_graph.py#L256-L360'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/encoder_acl_graph.py#L317-L441'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/worker/patch_model_state.py#L18-L31'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/configs/modelslim_config.py#L357-L428'
  - 'vllm-ascend@8d6180e2:vllm_ascend/quantization/methods/w8a8/fp8_block.py#L114-L129'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1164-L1189'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/v2/model_runner.py#L279-L312'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/configuration/encoder_cache_manager.md#L1-L56'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/feature_guide/quantization.md#L13-L61'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/performance_and_debug/msprobe_guide.md#L234-L293'
  - 'vllm-ascend@c09d3e20:docs/source/developer_guide/performance_and_debug/service_profiling_guide.md#L143-L240'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: multimodal-inference
    kind: builds-on
    note: 承接多模态前端 Patch 展开、M-RoPE 与四级缓存全景，深入调度器级 EncoderCacheManager 与视觉图执行机制
  - to: prefix-caching
    kind: alternative-to
    note: 文本前缀缓存按从头连续块哈希复用语言层 KV，而 EncoderCacheManager 按单张媒体哈希独立复用视觉编码向量
  - to: acl-graph
    kind: builds-on
    note: 复用昇腾 NPUGraph 与侧流 FIA 事件更新机制，承接视觉编码器按 token 预算桶分批捕获与回放
  - to: quantization
    kind: builds-on
    note: 多模态压缩使用 msmodelslim 产出按层前缀描述文件，在运行时对视觉塔与语言主干分别选配精度
  - to: msprobe-accuracy-debug
    kind: builds-on
    note: 多模态量化或开启视觉图后若出现看图答非所问，借助 PrecisionDebugger 与 AclGraphDumper 隔离视觉塔与融合点误差
contradicts: []
updated: '2026-11-27'
---

**多模态视觉特征缓存（`EncoderCacheManager`）按单张图像、视频或音频片段的内容哈希（`mm_hash`），在 vLLM V1 调度器与 Worker 之间独立管理编码器输出向量。** 命中缓存时，跨轮对话、分块预填充与显存抢占重算都能直接跳过视觉编码器（ViT）前向计算。承接[多模态推理基础](multimodal-inference.md)的前端切块与占位展开，请求进入 `Scheduler` 与 `ModelRunner` 后还要回答两道工程题：**为什么开启了文本前缀缓存（Prefix Caching）仍挡不住重复跑 ViT？当缓存未命中必须真跑 ViT 时，变长图像与视频又怎样装进静态昇腾图（`EncoderAclGraphManager`）加速？**

```wiki-diagram
file: multimodal-encoder-cache-flow
```

## 图像与视频怎样膨胀成视觉词元，以及为什么 ViT 重算代价极不对等？

纯文本里一句话往往只有几十个 token；可一段多模态输入经过切片（`patch_size`）与空间/时间合并（`merge_size`）后，词元数量会急剧膨胀。拿一段 `8` 帧、分辨率 $896 \times 896$ 的短视频片段做示意推算（设时间合并为 `2`、`patch_size = 14`、空间合并 `2×2`）：

$$N_{\text{patch}} = \frac{8}{2} \times \frac{896}{14} \times \frac{896}{14} = 4 \times 64 \times 64 = 16,384, \qquad N_{\text{vis}} = \frac{16,384}{2 \times 2} = 4,096\text{ 槽}$$

别小看这 `4,096` 个输出嵌入槽（Embedding Slots）：进入空间合并层之前，视觉编码器要先在总计 **`16,384`** 个原始 Patch 上跑二三十层 Transformer。以 `Qwen2.5-VL` 类架构为例，即便窗口层只在局部小窗内交互，全注意力层仍要在 `4` 个各长 `4,096` 的时空网格序列上做双向全注意力（复杂度为 $4 \times 4{,}096^2$，随单帧网格长度 $s_f$ 呈二次方 $O(s_f^2)$ 增长；不分帧的全局 ViT 更达 $O(s^2)$）。相比之下，缓存在显存里的合并后特征向量仅随槽位数呈线性 $O(N_{\text{vis}})$ 增长（语言隐藏维为 `4096`、`BF16` 时，`4,096` 槽仅占 `32 MiB`）。注意 `EncoderCacheManager` 记账的单位正是这 `4,096` 个**纯多模态嵌入槽（`encoder embeddings`）**——夹在多张图片之间的换行符或文本分隔 token 不计入编码器缓存容量。

## `EncoderCacheManager` 如何独立于文本 Prefix Caching 复用特征？

很多读者会问：既然已经开了语言模型的 [Prefix Caching（APC）](prefix-caching.md)，多轮看图对话不就能直接复用历史 KV 块了吗？对照调度器 `_try_schedule_encoder_inputs()` 与 `_preempt_request()` 的真实调用链，会发现两者在三个高频生产场景下职责完全不同：

| 对比维度 / 场景 | 文本 KV Prefix Caching（`APC`） | 视觉特征缓存（`EncoderCacheManager`） |
|---|---|---|
| **缓存内容与寻址键** | 语言主干各层注意力 K/V 块；**必须从序列位置 `0` 起连续按块链式哈希** | ViT 投影后的 `[N_vis, D_llm]` 视觉嵌入；**按单张媒体独立 `mm_hash` 寻址，与前后文位置完全无关** |
| **场景 1：前序提示词变动的多轮/RAG** | 第 2 轮在图片前改了系统提示词或插入新检索文档，从头连续前缀链当场断裂，图片及后文 KV 块 **100% 失配** | `check_and_update_cache()` 仍直接命中该图的 `mm_hash`，**完全省去 $O(s^2)$ ViT 重算**，仅需重跑语言层 Prefill |
| **场景 2：显存不足触发抢占重算** | `_preempt_request()` 释放被抢占请求的 KV 块并将 `num_computed_tokens` 归零；若未开 APC 或块被覆盖，恢复时须重算语言层 | `_preempt_request()` 对编码器仅调用 `free(request)` 将引用计数减 1 并移入 `freeable` 候选表，**未被新媒体挤出前物理特征仍留池内**，请求恢复时原地免重算取回 |
| **场景 3：[Chunked Prefill](chunked-prefill.md) 跨步切分** | 尚未算完的视觉区段还没有完整 KV 块 | ViT 采用双向注意力须整图一次算完，编码缓存通过引用计数跨多个调度步锁住该图特征，供后续分块继续消费（若设 `disable_chunked_mm_input` 则回退至整图边界前） |

反过来，如果某轮对话从第 `0` 个 token 到图片末尾与历史前缀一字不差、且 `APC` 已经命中了覆盖整张图片占位区间的 KV 块（即 `start_pos + num_encoder_tokens <= num_computed_tokens`），调度器扫未计算窗口时直接跨过该图，此时连 `EncoderCacheManager` 都无需读取，ViT 和语言层 Prefill 双双跳过。

### 上游单级引用计数 vs 昇腾 `ScoreEncoderCacheManager` 与 `main` 接线边界

在缓存淘汰策略上，上游默认 `EncoderCacheManager` 维护单级设备池：活跃请求持有 `cached[mm_hash]` 引用集合，请求完成或被抢占释放后零引用条目进入 `freeable` 有序字典；当新图所需槽位超过剩余空槽（但小于可回收总槽位）时，按先进先出（FIFO）弹出最老条目追加进 `freed` 列表通知 Worker 释放物理显存。

在 `vllm-ascend v0.30.0` 中，可将 `ec_manager_config` 的 `encoder_cache_manager_cls` 设为 `vllm_ascend.ec_manager.score_ec_manager.ScoreEncoderCacheManager`（若只传非空 `manager_config` 却漏设类名，会直接报 `manager_config requires encoder_cache_manager_cls to be set.`）。这会启用[多模态推理基础](multimodal-inference.md#单级-encodercachemanager-与昇腾-scoreencodercachemanager)拆解过的 **Pinned CPU（默认 `100,000` 槽）+ NPU 常驻池 + 设备临时槽** 三态评分架构，按 $(\text{freq} + \text{clock}) \times \text{cal\_cost}(s)$ 优先把高频且重算代价高的大图晋升留驻 HBM（默认 `max_clock=15`、`clock_decay_every=64`、`watermark=0.2`、`promote_percentile=0.2`）。

> **版本工程边界提示（`main` 分支 MRV2 接线现状）**：在 `v0.30.0` 中，上述 pinned CPU 与 NPU 之间的异步搬运由第一代执行器 `Model Runner V1` 完整消费。而在社区 `main`（`8d6180e2`）移除 `MRV1` 全面切入 [Model Runner V2](model-runner-v2.md) 后，调度侧虽仍保留 `ScoreEncoderCacheManager` 类并下发 `ec_manager_metadata`，但当前快照的 `MRV2` Worker 与上游 `EncoderRunner` 尚未接入消费 Score 的 CPU 晋升与搬运列表（缺失条目在 `EncoderRunner` 会报 `Encoder cache miss for {mm_hash}.`）。因此在 `main` 快照上，切勿假定 Score 两级 CPU-NPU 自动搬运已端到端闭环。

## ViT 预算打包与昇腾 `EncoderAclGraphManager` 图捕获回放

当新图片或新视频片段首次到达、编码缓存未命中时，请求必须真正跑一遍视觉编码器。小分辨率多图并发时，ViT 同样会遭遇[主机侧算子下发瓶颈](ascend-runtime-and-tuning.md)；但由于不同图片分辨率各异、视频帧数不一，不能像纯文本 Decode 那样只按固定请求数录图。

上游 `EncoderCudaGraphManager` 与昇腾子类 **`EncoderAclGraphManager`** 采用**按输出视觉 token 预算分桶打包（ViT Packing）**的两层机制（通过 `--compilation-config '{"cudagraph_mm_encoder": true}'` 开启，默认关闭；`encoder_cudagraph_token_budgets`、`encoder_cudagraph_max_vision_items_per_batch` 与 `encoder_cudagraph_max_frames_per_batch` 留空时均可由模型协议预算自动推导）：

1. **执行期升序贪心装箱（`_execute_local`）**：收到一批待编码媒体项后，先按每项产出的视觉 token 数**升序排列**，在不超过每个编码路径（`path`）最大 `token_budget` 与每批最大视觉项数的前提下贪心拼成若干子批（新上游快照还会比对拆开后的子桶预算之和以减少填充浪费，必要时提前封包）。每个子批挑选**能装下它的最小已捕获预算图**执行；单项超过最大预算档位时安全回退走单算子 Eager 模式；所有子批跑完后，再按原始媒体顺序散回（Scatter），保证与语言序列的占位符严丝合缝对齐。
2. **昇腾 `EncoderAclGraphManager` 捕获与侧流 FIA 参数刷新**：
   - **捕获期（`_capture_budget_graph`）**：使用 `torch.npu.NPUGraph()` 与全局图内存池对各 `token_budget` 录制前向图，保存固定地址 `input_buffers` 与弱引用 `output_buffer`（结束时调用 `weak_ref_workspaces()` 释放多余引用）；
   - **回放期（`_run_budget_graph`）**：先把本子批像素与序列累积长度 `cu_seqlens` 填充拷入固定缓冲，随后触发 `graph_meta.graph.replay()`，并在独立侧流 `update_stream` 上调用 `update_encoder_graph_params()` 更新昇腾融合注意力算子（FIA）的真实序列边界。借助图内预埋的事件等待（Event Wait / Record，原理见 [ACL Graph 视觉图事件同步](acl-graph.md#在-ascend-上怎样保持本轮数据正确)），设备可按最新序列长度计算而不踩旧缓冲；`main` 分支进一步补齐了 `update_stream.wait_stream(current_stream)` 防止侧流改参与输入拷贝竞态，并支持非空多维 `axis_keys` 与 `patch_model_state.py` MRV2 挂载。

## 新多模态模型量化、精度对齐与服务级性能取证

把一套新多模态模型搬上昇腾生产环境时（支持矩阵与部署指南筛选见 [新模型上线标准流程](ascend-model-onboarding.md#2-多模态视觉vlm语音asr与嵌入embedding模型9-篇)），视觉塔与语言主干具有截然不同的数值分布与耗时特征，需串联三件昇腾原生工具闭环验证：

| 工具环节 | 配置与代码入口 | 在多模态上线与排障中的核心职责 |
|---|---|---|
| **离线压缩与分层加载（`msmodelslim`）** | 离线用昇腾 ModelSlim（如 `26.0.0` 分支）导出权重与 `quant_model_description.json`；在线传 `--quantization ascend` 激活 `AscendModelSlimConfig` | 按层名/前缀（`layer/prefix`）精细选配量化方法——通常对语言主干与 MoE 专家启用 `W8A8` 压缩，而对数值敏感的 ViT 视觉塔与跨模态投影层保留 `BF16/FP16` 浮点（注：若直接加载原生 FP8 权重均须带 `weight_block_size`；`v0.30.0` 非 950 硬件可解析块缩放走模型精度乘加，而 `main` 分支 `_require_fp8_weight_matmul()` 会直接拒绝无原生 FP8 矩阵乘的硬件） |
| **逐层/图模式精度排障（`msprobe`）** | `--additional-config` 传内联 `dump_config`（自动落盘至 `.vllm_ascend/msprobe/msprobe_dump_config.json`，禁与旧 `dump_config_path` 同设） | 出现“看图答非所问”或量化掉点时，Eager 下用 `PrecisionDebugger`、开启视觉图/语言图时用带 `aclgraph_dump` 编译的 `AclGraphDumper`（详见 [msprobe 精度定位](msprobe-accuracy-debug.md)），用 `L0`（模块结构）或 `mix` 隔离分歧究竟出在 ViT 内部、`M-RoPE` 还是 `_merge_multimodal_embeddings` 融合后 |
| **服务级分段耗时剖析（Service Profiling）** | `--profiler-config` 配合 `/start_profile`、`/stop_profile` 接口（未配时返回 `404`），或启用 **MS Service Profiler**（`acl_task_time=0/1/2/3`，`2` 需预加载 `libmspti.so`） | 把一次多模态请求的端到端 TTFT 拆清为前端媒体解码、ViT 编码、`EncoderCache` H2D 搬运与语言层 Prefill 四段，并用 `L1` 级 AscendCL 拷贝轨迹确认瓶颈归属 |

## 常见误解

- **「只要开启了文本 `--enable-prefix-caching`，多轮对话和 RAG 里的重复图片就永远不会重跑 ViT，不需要管 `EncoderCacheManager`」**：错。文本前缀缓存要求从第 `0` 个 token 起连续前缀完全一致；只要图片前面的系统提示词或检索上下文变了一个词，文本前缀链就会断开，此时全靠按 `mm_hash` 独立寻址的 `EncoderCacheManager` 才能拦住 $O(s^2)$ 的 ViT 重算。
- **「请求因为显存吃紧被调度器抢占（Preempt）退回等待队列时，它算好的图片特征也会连同 KV cache 一起被销毁」**：错。`_preempt_request()` 会立刻释放 KV 块，但对 `EncoderCacheManager` 只是解除活跃引用并移入 `freeable` 队列；只要没被后续新图片挤出，请求恢复运行时直接原地命中。
- **「配置 `ec_manager_config` 时，只要传入 `{"manager_config": {"cpu_cache_slots": 50000}}` 就能自动启用昇腾评分缓存」**：错。上游默认 `encoder_cache_manager_cls=None`，只传非空 `manager_config` 而不显式指定 `ScoreEncoderCacheManager` 类路径会直接触发校验报错。
- **「开了 `cudagraph_mm_encoder: true` 后，任何超长视频或超大分辨率单图塞不进图预算都会直接崩溃」**：错。超出最大已捕获 `token_budget` 的单项会自动回退走单算子 Eager 执行；但要注意视频帧元数据缓冲上限 `encoder_cudagraph_max_frames_per_batch` 若被手工设得过小，并不会自动裁剪视频帧数。

## 对照源码

### 怎么开

- **编码器缓存与昇腾评分管理器**：上游默认启用单级 `EncoderCacheManager`（按嵌入槽位引用计数与 FIFO 回收，`encoder_cache_manager_cls=None`、`manager_config={}`）[C1][C2]；在 `v0.30.0` 开启两级评分缓存需显式指定 `encoder_cache_manager_cls="vllm_ascend.ec_manager.score_ec_manager.ScoreEncoderCacheManager"`，可调 `cpu_cache_slots`（默认 `100000`）、`max_clock`（`15`）、`clock_decay_every`（`64`）、`watermark`（`0.2`）与 `promote_percentile`（`0.2`）[C8][S22]。调度器在 `_try_schedule_encoder_inputs()` 按未计算窗口与 `check_and_update_cache()` 跳过重复编码，抢占时在 `_preempt_request()` 调 `free(request)` 保留池内特征[C6][C7]。
- **ViT 预算打包与 `EncoderAclGraphManager`**：传入 `--compilation-config '{"cudagraph_mm_encoder": true}'` 开启（预算列表、最大项数与最大帧数默认自动推导）[C12]；`_execute_local()` 升序贪心装箱并散回原序[C13]，昇腾 `EncoderAclGraphManager` 录制 `NPUGraph` 并在侧流调用 `update_encoder_graph_params()` 更新 FIA 序列参数[C14]。
- **量化、精度与服务级剖析**：离线使用 `msmodelslim` 导出权重与描述 JSON，在线传 `--quantization ascend` 由 `AscendModelSlimConfig` 按层前缀选配精度[C18][S23]；精度排障传 `--additional-config '{"dump_config": ...}'` 分别驱动 Eager `PrecisionDebugger` 或图模式 `AclGraphDumper`[C20][S24]；服务级分段剖析通过 `--profiler-config`（`/start_profile`、`/stop_profile`）或 MS Service Profiler `acl_task_time=0/1/2/3` 开启[S25]。

### 会报什么错

| 拦截位置 | 触发条件 | 实际报错文本 | 核验入口 |
|---|---|---|---|
| `ECManagerConfig` 校验 | 传入非空 `manager_config` 但未设置 `encoder_cache_manager_cls` | `manager_config requires encoder_cache_manager_cls to be set.` | 来源 1 |
| `main` MRV2 `EncoderRunner` | 调度侧发出 Score 晋升元数据但 MRV2 未消费 CPU 搬运，导致设备侧缺项 | `Encoder cache miss for {mm_hash}.` | 来源 11 |
| `v0.30.0` `EncoderAclGraphManager` | 传入非空多维捕获轴 `axis_keys` | `NotImplementedError: Encoder ACL graphs with capture axes are not supported.` | 来源 14 |
| `main` 原生 FP8 权重量化 | 在缺少原生 FP8 矩阵乘能力的硬件上加载原生块缩放 FP8 权重 | `_require_fp8_weight_matmul()` 拒绝构造量化方案并抛错 | 来源 19 |
| `AscendConfig` `msprobe` 校验 | 同时设置 `dump_config` 与旧 `dump_config_path` | `Only one of additional_config.dump_config_path or additional_config.dump_config can be set.` | 来源 20 |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10 / 0fc695fc)` | `v0.26.0rc (2ed6cbba / 568afb3a)` | `v0.30.0 (c09d3e20 / ced6857a)` | `main (8d6180e2 / ba15685a)` |
|---|---|---|---|---|
| 编码器缓存管理器与 Worker 接线 | 仅上游单级 `EncoderCacheManager`（无 `create_manager` 工厂与昇腾评分缓存）[C3] | 同 `v0.23.0` 单级引用计数与 FIFO 回收[C4] | 新增 `ec_manager_config` 工厂[C1][C5]与昇腾 `ScoreEncoderCacheManager`，由 `MRV1` 维护 CPU/常驻 NPU/临时 NPU 三态搬运[C10] | 保留 `ScoreEncoderCacheManager` 类与调度器元数据，**但移除 `MRV1` 后 `MRV2` 尚未接入 Score CPU 搬运消费者**[C11][!] |
| `EncoderAclGraphManager` 视觉图 | 单路径 `budget_graphs[token_budget]`，捕获前先跑一次预热并显式 `copy_`[C15] | 升级为按 `path` 维护图集合 `_get_graph_set(path)` | 保持 `MRV1` 替换挂载；显式拒绝非空 `axis_keys` 抛 `NotImplementedError`[C14] | 经 `patch_model_state.py` 接入 `MRV2`[C17]，支持 `(token_budget, axis_keys)` 复合键并补齐 `update_stream.wait_stream` 防竞态[C16] |
| `ModelSlim` 原生 FP8 与剖析符号 | `AscendModelSlimConfig` 位于 `quantization/modelslim_config.py`；仅 `MRV1` `msprobe` 钩子 | 修复 `AscendModelSlimConfig` 正向键映射；保留 `MRV1` 钩子 | 迁至 `quantization/configs/modelslim_config.py`；非 950 原生 FP8 可走模型精度乘加；`MRV1/V2` 双轨内建 `msprobe` | 原生 FP8 新增 `_require_fp8_weight_matmul()` 硬拒绝不支持硬件[C19]；Service Profiling 符号示例迁至 `worker.v2.model_runner` |

### 源码位置

- **编码器缓存配置、调度复用与三态搬运（来源 1–11、22）**：`ECManagerConfig` 与单级 `EncoderCacheManager` 四版实现见来源 1–4；调度器实例化、抢占 `free(request)` 与未计算窗口 `_try_schedule_encoder_inputs` 见来源 5–7；昇腾 `ScoreEncoderCacheManager` 评分公式、`MRV1` 三态搬运、配置文档及 `main` `EncoderRunner` 缺项报错见来源 8–11、22。
- **ViT 预算打包、视觉图管理与量化/排障工具链（来源 12–21、23–25）**：上游 `cudagraph_mm_encoder` 配置与 `_execute_local` 升序装箱见来源 12–13；昇腾 `EncoderAclGraphManager` 三版演进与 `patch_model_state.py` 见来源 14–17；`AscendModelSlimConfig`、原生 FP8 硬校验、`msprobe` 双模式转储器与 Service Profiling 指南见来源 18–21、23–25。文中 `8` 帧 $896\times 896$ 视频 `4,096` 槽与 `32 MiB` 账单按网格定义直接推算[A][D]；`main` 分支 Score 两级缓存端到端可用性待后续补齐 `MRV2` 搬运消费者后实机复核[I]。
