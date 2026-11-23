---
id: multimodal-inference
title: 多模态推理与视觉编码基础：Patch 展开、M-RoPE、ViT 数据并行与两级编码缓存
type: concept
origin: direct
summary: >-
  多模态推理先在前端完成媒体下载、CPU 预处理与占位展开，再经 ViT 编码原地覆写进文本嵌入并以三维 M-RoPE 注入时空坐标；本页讲清前端预处理、四级缓存分工、ViT --mm-encoder-tp-mode data 并行与 v0.30.0 两级 ScoreEncoderCacheManager。
aliases:
  - 多模态推理
  - 多模态预处理
  - 视觉编码
  - VL
  - VLM
  - Vision-Language Model
  - VLM 推理
  - multimodal inputs
  - image_grid_thw
  - 视觉 Patch 展开
  - M-RoPE
  - MRoPE
  - MRotaryEmbedding
  - AscendMRotaryEmbedding
  - mm-encoder-tp-mode
  - mm_encoder_tp_mode
  - mm_processor_cache_gb
  - mm_processor_cache_type
  - multi_modal_uuids
  - enable_mm_embeds
  - image_embeds
  - media_io_kwargs
  - VLLM_MEDIA_CACHE
  - run_dp_sharded_vision_model
  - EncoderCacheManager
  - ScoreEncoderCacheManager
  - 多模态编码缓存
chapters:
  - '01'
order: 70
sources:
  - 'https://arxiv.org/abs/2409.12191'
  - 'vllm@0fc695fc:docs/design/mm_processing.md#L1-L63'
  - 'vllm@0fc695fc:docs/features/multimodal_inputs.md#L443-L544'
  - 'vllm@ced6857a:vllm/model_executor/models/utils.py#L689-L725'
  - 'vllm@ced6857a:vllm/model_executor/models/vision.py#L146-L162'
  - 'vllm@ced6857a:vllm/model_executor/models/vision.py#L295-L326'
  - 'vllm@ced6857a:vllm/model_executor/layers/rotary_embedding/mrope.py#L15-L88'
  - 'vllm@ced6857a:vllm/v1/core/encoder_cache_manager.py#L19-L101'
  - 'vllm@ced6857a:vllm/config/multimodal.py#L110-L163'
  - 'vllm@ced6857a:vllm/multimodal/processing/processor.py#L1167-L1307'
  - 'vllm@ced6857a:vllm/multimodal/registry.py#L283-L369'
  - 'vllm@ced6857a:vllm/multimodal/media/connector.py#L204-L311'
  - 'vllm@ced6857a:vllm/multimodal/media/connector.py#L366-L465'
  - 'vllm@ced6857a:vllm/multimodal/parse.py#L673-L715'
  - 'vllm@ced6857a:vllm/multimodal/video_decoders/opencv.py#L125-L228'
  - 'vllm@ced6857a:vllm/multimodal/audio.py#L395-L517'
  - 'vllm@ced6857a:vllm/envs.py#L947-L970'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/rotary_embedding.py#L601-L684'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/triton/linearnorm/split_qkv_rmsnorm_mrope.py#L282-L335'
  - 'vllm-ascend@c09d3e20:vllm_ascend/_310p/ops/rotary_embedding.py#L51-L92'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ec_manager/score_ec_manager.py#L31-L150'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ec_manager/score_ec_manager.py#L151-L240'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ec_manager/score_ec_manager.py#L345-L439'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1142-L1278'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ops/triton/docs/rope.md#L1-L20'
  - 'vllm-ascend@2c59ff10:vllm_ascend/ops/rotary_embedding.py#L472-L520'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/ops/rotary_embedding.py#L487-L535'
  - 'vllm-ascend@8d6180e2:vllm_ascend/ops/rotary_embedding.py#L647-L695'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: token
    kind: builds-on
    note: 多模态预处理器先按分辨率与合并步幅在 input_ids 里展开等量视觉占位 token，再与文本序列一起进模型
  - to: embedding
    kind: builds-on
    note: 视觉编码器输出的嵌入张量最终按占位掩码原地覆写进标准词向量表查出的 inputs_embeds
  - to: rope
    kind: builds-on
    note: M-RoPE 把一维位置索引扩展为 (T, H, W) 三维时空坐标并分段旋转头维度
  - to: epd-disaggregation
    kind: alternative-to
    note: 当多图或高分辨率视频把视觉编码器推成瓶颈时，可把单实例内置编码器切换为独立 E 节点池的 EPD 分离架构
contradicts: []
updated: '2026-11-19'
---

**多模态推理（Multimodal Inference）是指引擎在同一条提示词中同时接收文本与图像、视频或音频，先将非文本媒体切块并经专用编码器（如视觉编码器 ViT，即 Vision Transformer）投影到语言模型的隐藏维度，再把视觉向量原地填回序列占位槽，最后交由标准语言主干完成自回归生成。**

沿[请求全景](request-overview.md)与[分词入口](token.md)走进语言模型时，纯文本请求只需查一次 [Embedding](embedding.md) 词表即可进入首层 Transformer。可一旦用户在消息里附带一张图片或一段视频，语言主干既读不懂原始 RGB 像素，也分不清二维平面里“上下相邻”的图像块在拉平成一维序列后其实相隔一整行。多模态推理体系正是为了解决**媒体如何变 token、视觉编码器如何跨卡不卡顿、以及重复图片如何免重算**这三道核心工程难题。

```wiki-diagram
file: multimodal-plate-cutaway
```

## 一张图怎样变成语言模型吃得下的 token 序列？

前端处理器（MultiModal Processor，接入入口见 [API server 入口](api-server-entry.md)）收到图像、视频或音频后，并不等待 NPU 算完视觉网络才构造序列，而是先在 CPU 上解码、整理成模型可读的张量，再按分辨率与合并步幅算出精确的视觉 token 数量，直接在 `input_ids` 里展开等量的**占位 token（placeholder token）**，同时附带像素块张量与三维网格描述符 `image_grid_thw = (T, H, W)`。

用最小位置示意看占位展开如何与语言序列对齐：设纯文本分为 $T_0, T_1$ 两个位置，图片 A 需要 `2` 个特征位置、图片 B 需要 `3` 个。按消息顺序展开后得到 `[T₀, A₀, A₁, T₁, B₀, B₁, B₂]` 共 `2 + 2 + 3 = 7` 个位置——A 占偏移 `1`、长度 `2`，B 占偏移 `4`、长度 `3`。

CPU 预处理器会先检测模型自身 processor 是否已展开占位标记；未展开则按更新规则补齐，并核验媒体数量、更新条目与占位范围一致。即便调用方直接传入文本编号也须维持这层映射；仅当某些模型 processor 要求文字与媒体联合输入时，框架才临时构造匹配文字，并非重套真实聊天模板。

以典型的 Qwen2.5-VL / Qwen3-VL 视觉切块规则做一笔示意账：设输入单张静图分辨率为 $448 \times 448$，视觉编码器块大小 `patch_size = 14`，经过视觉末尾的 $2 \times 2$ 空间合并（`spatial_merge_size = 2`）后，送入语言主干的视觉 token 数为：

$$N_{\text{vis}} = T \times \frac{H_{\text{px}}}{\text{patch\_size} \times \text{merge}} \times \frac{W_{\text{px}}}{\text{patch\_size} \times \text{merge}} = 1 \times \frac{448}{28} \times \frac{448}{28} = 16 \times 16 = 256$$

如果语言主干隐藏维 $D_{\text{llm}} = 4096$、`BF16`（每元素 `2 B`），这张图产出的视觉嵌入矩阵形状为 `[256, 4096]`，显存仅占 `2 MiB`。进入 `ModelRunner` 后，引擎先对未命中编码缓存的媒体调用 `embed_multimodal()` 跑完 ViT 与投影层，再由 `_merge_multimodal_embeddings` 按布尔掩码 `is_multimodal` 执行一次**原地覆写**：`inputs_embeds[is_multimodal] = mm_embeds_flat.to(dtype=inputs_embeds.dtype)`。若产出的视觉向量行数与占位 token 数不一致，此处会立即抛 `ValueError` 拦截。

```wiki-diagram
file: multimodal-fig-pipeline-mrope
```

### 预计算媒体向量、视频帧元数据与音频预处理边界

- **预计算媒体嵌入（`--enable-mm-embeds`）**：与文本 `--enable-prompt-embeds` 独立，允许绕过编码器直接传入 `image_embeds` 等特征张量，但仍须满足对应模型的布局契约。例如 Qwen2-VL 另需 `image_grid_thw`（在线单项 `3` 个整数），MiniCPM-V-2_6 另需 `image_sizes`（宽、高两个数），Qwen3-VL 还需中间层消费的 `deepstack` 额外视觉特征。在线 Chat 必须按**每张媒体一个内容项**提供向量，把多张图拼成一个内容项会导致占位数量与向量行数错位。
- **视频时间元数据与坏帧恢复**：客户端提前抽帧时应通过 `media_io_kwargs.video`（兼容 SDK 放 `extra_body`）保留 `fps`、`frames_indices`、`total_num_frames`、`duration`（及按需 `do_sample_frames`），否则无法区分相邻三帧与相隔十秒的三帧。OpenCV 解码路径提供默认关闭的 `video.frame_recovery`：遇坏帧失败时顺扫至下一目标帧之前寻找可读帧替代。注意该操作会改变观察内容，且只顺扫到最后一个目标帧，不保证补齐所有坏帧。
- **音频重采样、单声道与长音频静音切分**：音频输入需带采样率由解析器重采样；要求单声道的模型默认把多声道求平均（声道转换，非响度归一化）。支持切分的语音转写模型可走 `split_audio`，在每段上限末尾窗口内搜寻低能量切点（如 `max_clip_duration_s=30`、`overlap_duration_s=1`、`min_energy_window_size=1600`、`16000 Hz` 下，在 `480,000` 样本的末尾 `16,000` 样本中寻安静点；下一段从该切点接续，输出不重复保留 `1` 秒）。切分先转单声道再执行，既非通用 Chat 音频步骤，也不同于语言模型的 [Chunked Prefill](chunked-prefill.md)。

## M-RoPE：怎样把二维空间与视频时间编进注意力旋转角？

把二维图像行优先展平进一维序列后，原本在画面中上下紧挨的两个图像块，一维位置号会相差一整行宽度 $W$；视频帧之间也丢失了“同一像素随时间推进”的对齐关系。如果照搬纯文本的一维 [RoPE](rope.md)，语言主干只能硬学空间布局。

**M-RoPE（Multimodal Rotary Position Embedding）**把每个 token 的位置索引从单个整数扩展为三维坐标矩阵 `positions`，形状为 `[3, num_tokens]`，三行依次记录时间 $T$、垂直行 $H$、水平列 $W$：

- **纯文本 token**：三行坐标完全相同（$T = H = W = p$），旋转结果严格退化为标准一维 RoPE，保证纯文本能力不受损；
- **图像与视频 Patch token**：$T$ 随视频帧号递增（静图固定不变），$H \in [0, H_{\text{grid}}-1]$ 与 $W \in [0, W_{\text{grid}}-1]$ 记录块在画面中的二维网格坐标；整张图结束后的下一个文本 token 从 $\max(T, H, W) + 1$ 继续顺延编号。

在每个注意力头内部，M-RoPE 按 `mrope_section`（例如 `head_dim = 128`、半维 `64` 时常见的 `[16, 24, 24]`，$16 + 24 + 24 = 64$）把旋转频率切为三段，分别用 $T$、$H$、$W$ 坐标查 `cos_sin_cache` 施加旋转。较新架构（如 Qwen3-VL / Qwen3.5）进一步采用**交错排布（`mrope_interleaved = True`）**，按模 3 余数把 $T/H/W$ 频段均摊到高中低频，避免单一空间轴独占全部高频分量。

在 `vllm-ascend v0.30.0` 中，`AscendMRotaryEmbedding` 按硬件与排布自动走四条执行通路：

| 执行通路与算子入口 | 适用条件 | 关键工程行为 |
|---|---|---|
| **融合 Triton 算子 `triton_split_qkv_rmsnorm_mrope`** | `Qwen3-VL` / `Qwen3.5` 等启用补丁的注意力层 | 把 QKV 切分、QK RMSNorm 与 M-RoPE 揉进单个核，减少中间写回 HBM |
| **独立 Triton 路径 `triton_mrope`** | `HAS_TRITON` 为真、二维 `positions` 且 `mrope_interleaved=True` | 当 `query.shape[0] > 65535` 时自动设置 `TRITON_ALL_BLOCKS_PARALLEL=1` 防调度器越界 |
| **原生 CANN 算子 `torch_npu.npu_mrope`** | 非交错排布且 `mrope_section == [16, 24, 24]` | 走 `rotary_mode="half"` 原生算子；若遇到 1D `positions` 则自动传入 `[0, 0, 0]` 退化 |
| **`310P` 兼容路径 `AscendMRotaryEmbedding310`** | `Atlas 300I DUO (310P)` | 前向开始前由 `merge_mrope_cos_sin_for_apply` 预先合并静态 `cos/sin` 切片，避免核内三维寻址 |

## ViT 跨卡切分为什么常常不该走 TP？`--mm-encoder-tp-mode data`

当语言主干因为参数量大（如 32B / 72B）而开启 [张量并行（TP=4 或 TP=8）](tensor-parallel.md) 时，默认的 `--mm-encoder-tp-mode weights` 会把同样套用 TP 的切法施到视觉编码器（ViT）上。这在多图并发场景下往往得不偿失：

1. **权重极小但通信极碎**：ViT 的隐藏维通常只有 `1152`–`1280`，全套权重仅数百 MB 到 `1 GiB` 左右，按卡切分省不下多少显存；可它同样有 `27`–`32` 层 Transformer，每层注意力与 MLP 结束都要做一次 TP `All-Reduce`，一次前向就会多出 `54`–`64` 次小载荷跨卡同步。
2. **头数整除陷阱**：某些视觉编码器的注意力头数不能被语言主干的 `tp_size` 整除（例如 `16` 个视觉头配 `TP=6`）。vLLM 的 `vision.py` 检测到 `num_heads % tp_size != 0` 时，会打印告警并静默回退到数据并行模式。

显式开启 **`--mm-encoder-tp-mode data`** 后，每张 TP 卡各自保留一份完整 ViT 权重，由 `run_dp_sharded_vision_model` 把同批多图（或视频帧）沿 batch 维均分或按 Patch 总数贪心均衡分摊到各卡独立编码。整个 ViT 内部 **0 次跨卡通信**，仅在编码器出口做**唯一一次 `tensor_model_parallel_all_gather`** 拼齐全部视觉嵌入并裁掉填充。代价仅每卡多占几百 MB ViT 权重显存，却能大幅压低多图请求的首字时延（TTFT）。

## 重复图片怎样免重算：四级缓存分工与昇腾 `ScoreEncoderCacheManager`

多轮图文对话、文档检索增强生成（RAG）或高并发请求反复引用同一张底图时，一条多模态请求在进入语言生成前共经过四层独立缓存（各自占独立空间，清掉一层不会连带清掉其他层）：

```wiki-diagram
file: multimodal-fig-four-tier-cache
```

### 下载缓存、`mm_processor_cache`、编码缓存与 KV Cache 分工

| 缓存层级 | 保存什么 | 命中后省掉什么 | 关键边界与拓扑条件 |
|---|---|---|---|
| **HTTP 原始字节下载缓存**（`VLLM_MEDIA_CACHE`） | 远程 URL 下载的原始媒体字节（本地磁盘目录） | 省去再次 HTTP 下载；命中后仍须解码、预处理、编码与语言前向 | 按完整 URL 建键（非 UUID；`data:`/`file:` 不走此缓存）；默认 `5120 MiB` 淘汰目标（非硬磁盘上限，刚写文件受保护）、`24h` 滑动 TTL（读/写懒检查过期）；同 URL 内容变更须换地址 |
| **CPU 多模态预处理缓存**（`mm_processor_cache`） | CPU 预处理张量及其占位更新信息 | 省去相同媒体的重复 CPU 预处理；仍须经编码器或 EC 取得特征 | 默认 `4 GiB`（`0` 关闭）、类型 `lru`/`shm`（`shm` 单对象上限 `128 MiB`）；**仅当 `api_server_count == 1` 且（`DP=1` 或 external LB）时建立进程间缓存**（`lru` 接收端在 EngineCore，`shm` 在 Worker），否则退回 `processor_only` |
| **编码器缓存（EC）**（`EncoderCacheManager` / `ScoreEncoderCacheManager`） | 视觉/媒体编码器已算出的嵌入特征 | 省去对应媒体的重复 ViT 编码；语言层仍需继续处理 | 单实例由本节两类管理器维护；跨实例复用与 EPD 见[编码器分离](pd-disaggregation.md#带图像的请求再把编码器分出去epd)与 [UCM 编码复用](ucm.md#多模态还有一份编码结果可以复用) |
| **[KV Cache](kv-cache.md) / [Prefix Caching（APC）](prefix-caching.md)** | 语言模型各层历史 K/V 状态 | 前缀完全一致时省去语言层 Prefill | 需前面各层产出相同的占位与哈希 |

以包含图片 A、B 的消息为例看部分命中合并：若 CPU `mm_processor_cache` 仅命中 A，预处理器只新算 B，随后必须把缓存 A 与新 B **按原消息顺序合回 `[A, B]`** 并重建占位区间（绝不能把新结果排在前面导致图文错配）。直通的预计算特征走独立分支，不受 CPU 媒体缓存推断。

### 媒体 UUID（`multi_modal_uuids`）与省传原图的边界

默认由框架按媒体内容与处理参数计算缓存身份；调用方也可通过 Chat 内容项的 `uuid` 或离线 `multi_modal_uuids` 指定稳定身份（不限格式，但同身份必须对应同内容与兼容处理方式，换图沿用旧 UUID 会复用错误内容）。

首次提交「实际内容 + UUID」建立缓存后，后续预期命中的请求才可只传 UUID、留空媒体内容。但**省略原图依赖实际缓存命中与对应解析器接受空项**：条目可能被淘汰、落到其他 API 进程或尚未就绪，缺内容又未命中会直接报错；多张图时 UUID 列表须与数据顺序、数量严格一致（某项留 `None` 按内容生成）。在 `v0.30.0` 中，内容身份哈希已按模态纳入 `media_io_kwargs`；双缓存（`mm_processor_cache` 与 APC）同时关闭时仍保留显式 UUID 供跨实例 EC 识别，且音频解析器亦开始允许空项配 UUID 走缓存命中。

### 单级 `EncoderCacheManager` 与昇腾 `ScoreEncoderCacheManager`

进入模型侧后，vLLM V1 原生 `EncoderCacheManager` 按**嵌入槽位数（encoder embeddings）**在 NPU 显存中维护单级缓存，引用归零且空间不足时按先进先出（FIFO）逐出。高并发线上服务里，单靠有限 NPU 显存做 FIFO 容易把高频复用的高分辨率大图顶出去。为此，`vllm-ascend v0.30.0` 新增了面向热点复用的 **`ScoreEncoderCacheManager`** 两级编码器缓存体系：

```wiki-diagram
file: multimodal-fig-score-ec-cache
```

它的运转逻辑分成调度器决策与 Worker 执行两半：

1. **新算条目先落 CPU 大池**：未命中缓存而新经 ViT 算出的视觉嵌入，调度器先在主机内存池（`cpu_cache_slots` 默认 `100,000` 槽；若主机槽位不足则对零引用旧项按 `popitem(last=False)` 做 FIFO 逐出）记账。Worker 通过 `pin_memory=True` 与 `non_blocking=True` 拷入 `cpu_encoder_cache`，设备侧只暂存于 `tmp_encoder_cache`（待请求结束并移除请求状态、且不再有活跃请求引用该 `mm_hash` 时删除），不长期霸占 HBM。
2. **基于重算代价与热度的评分晋升**：每次命中都会累计访问频次 `freq` 与新鲜度 `clock`（每 `clock_decay_every = 64` 次请求衰减，上限 `max_clock = 15`），再乘以视觉重算代价与槽位之比 `cal_cost`（视觉自注意力为 $O(s^2)$、存储为 $O(s)$，比值随 Patch 长度 $s$ 线性增长，正比于 $\alpha s + \beta$）：

$$\text{score} = (\text{freq} + \text{clock}) \times \text{cal\_cost}, \qquad \text{cal\_cost}(s) = \frac{L_{\text{vis}}(\alpha s + \beta)}{4 \times 10^{14}}$$

其中 $L_{\text{vis}}$ 对 `qwen3_5` 取 `27` 层、其余默认 `32` 层。当 CPU 条目再次命中时，若 NPU 空槽足够则直接晋升；若空槽不足且可回收槽位足够，`should_promote` 把候选条目不含 `clock` 的得分与 NPU 可回收集合 `npu_freeable` 中按升序排在 **`promote_percentile`（默认 `0.2`，即低 `20%` 分位）** 的门槛比较。得分达到或超过门槛（`score >= threshold`）才批量淘汰低分项（一次性清理到够放新项且尽量留出 **`watermark`（默认 `0.2`）** 空槽），再由 Worker 在当前 NPU 流发起非阻塞的主机到设备（`non_blocking` H2D）拷贝晋升至常驻 `encoder_cache`，并由 `torch.npu.Event` 追踪拷贝完成与源缓冲生命周期。
3. **防御性兜底**：若调度器判定某条目在 CPU 缓存命中、但 Worker 临时缓存尚未就绪，`_get_encoder_output_from_cache` 会退回同步 H2D 补拷并写入 `tmp_encoder_cache`，避免状态微差演变成致命 cache miss。

## 常见误解

- **「多模态模型里 1 张图片只占 1 个 token 的 KV cache？」**：错。1 张图在预处理阶段就会按分辨率和合并步幅展开成几十到上千个占位 token（如 `448×448` 示意下为 `256` 个）；进入语言主干后，每个视觉 token 都会像普通文本 token 一样占用 KV cache 块并参与自注意力计算。
- **「开了 TP=8 就应该把 ViT 也按权重切 8 份，这样一定更快？」**：错。ViT 参数量很小但层数并不少，按权重切分会在每层引入两次小包 `All-Reduce`；多图并发下开启 `--mm-encoder-tp-mode data` 往往能消除数十次同步通信，且视觉头数不能被 TP 整除时框架本身也会强制回退为 `data`。
- **「开了 `ScoreEncoderCacheManager` 会把所有算过的图片都死锁在 NPU 显存里导致 OOM？」**：错。新编码出的嵌入默认写入 pinned CPU 缓存，设备侧仅在请求存续期暂存 `tmp_encoder_cache`（无活跃请求引用该 `mm_hash` 即删除）；只有空槽充足或综合得分达到 `promote_percentile` 门槛的热点条目才会晋升进固定槽位上限的 NPU 常驻池。
- **「纯文本请求走多模态模型时，M-RoPE 会破坏文本位置编码？」**：错。对所有纯文本 token，三维坐标 `(T, H, W)` 的三行取值完全一致，三段频率查出的旋转角与标准 1D RoPE 严格等价。

## 对照源码

### 怎么开

- **前端媒体入口、下载缓存与 CPU 预处理缓存**：Chat 使用 `image_url` / `video_url` / `audio_url` / `input_audio`（可附 `"uuid": "..."`），本地路径须由 `--allowed-local-media-path` 放行；离线使用 `multi_modal_data` 与 `multi_modal_uuids`。关键启动与环境配置：
  - `--enable-mm-embeds`（默认 `false`）：允许预计算媒体特征（如 `image_embeds` + 布局字段），不等于 `--enable-prompt-embeds`；
  - `--media-io-kwargs`（默认 `{}`，按模态传给加载器如 `video.frame_recovery`、帧率元数据）与 `--mm-processor-kwargs`（默认 `None`，传给模型 processor）；
  - `--mm-processor-cache-gb`（默认 `4` GiB，`0` 关闭）、`--mm-processor-cache-type`（默认 `lru`，可选 `shm`）、`--mm-shm-cache-max-object-size-mb`（默认 `128` MiB）；
  - HTTP 下载超时与磁盘缓存：`VLLM_IMAGE_FETCH_TIMEOUT=5`、`VLLM_VIDEO_FETCH_TIMEOUT=30`、`VLLM_AUDIO_FETCH_TIMEOUT=10`（均为初始尝试超时，重试递增）；`VLLM_MEDIA_CACHE`（默认空关闭）、`VLLM_MEDIA_CACHE_MAX_SIZE_MB`（默认 `5120`，按 MiB 计）、`VLLM_MEDIA_CACHE_TTL_HOURS`（默认 `24` 小时滑动有效期，`0` 非永久）。
- **ViT 改走数据并行**：在多图并发或视觉头数不能被 TP 整除的部署中，为 `vllm serve` 追加 `--mm-encoder-tp-mode data`（默认 `weights`）。
- **启用两级评分编码缓存 `ScoreEncoderCacheManager`**：通过 `ec_manager_config` 指定管理器类为 `vllm_ascend.ec_manager.score_ec_manager.ScoreEncoderCacheManager`，并按需调节 `cpu_cache_slots`（默认 `100000`）、`max_clock`（默认 `15`）、`clock_decay_every`（默认 `64`）、`watermark`（默认 `0.2`）与 `promote_percentile`（默认 `0.2`）。跨进程拆出独立 ViT 池时配合 `ECConnector` 走 [EPD 分离](epd-disaggregation.md)。

### 会报什么错

| 拦截位置 | 触发条件 | 实际报错或回退行为 |
|---|---|---|
| 多模态缓存与 UUID 校验 | 只交 `uuid` 留空原图却未命中缓存；身份与数据列表长度不等或均空 | 报 `Cache miss for ... but data is not provided.` 或参数校验拒绝 |
| 媒体下载缓存初始化 | `VLLM_MEDIA_CACHE` 目录创建/写权限 `OSError`；或容量/TTL 非法数字 | `OSError` 打印告警并关闭下载缓存；非法数字直接在环境变量解析时报错 |
| `_merge_multimodal_embeddings` | 视觉编码器产出或预计算 `mm_embeds` 行数与 `is_multimodal` 占位符数不一致 | 抛出 `ValueError: Attempted to assign ... multimodal tokens to ... placeholders` |
| `vision.py` 头数检查 | `mm_encoder_tp_mode="weights"` 且视觉头数不能被 `tp_size` 整除 | 打印一次告警并静默回退到 `data` 模式 |
| `ScoreEncoderCacheConfig.__post_init__` | `cpu_cache_slots <= 0`、`clock_decay_every <= 0` 或 `watermark / promote_percentile` 超出 `[0, 1]` | 立即抛出 `ValueError` 拒绝非法配置 |
| `AscendMRotaryEmbedding.forward_oot` | 非交错排布且 `mrope_section != [16, 24, 24]` | 不报错，跳过 `torch_npu.npu_mrope` 并回退父类 `super().forward_oot` |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10 / 0fc695fc)` | `v0.26.0rc (2ed6cbba / 568afb3a)` | `v0.30.0 (c09d3e20 / ced6857a)` | `main (8d6180e2 / ba15685a)` |
|---|---|---|---|---|
| 媒体处理器文本与内容身份 | 处理器可收文字或编号；双缓存关闭时以本请求身份覆盖用户 UUID；音频解析器拒 `None` 项 | 同 `v0.23.0` | 处理器收编号且默认不传文字；身份按模态纳入 `media_io_kwargs`；双缓存关闭仍保留显式 UUID 供跨实例 EC；音频解析器允许 `None` 配 UUID 命中 | 延续 `v0.30.0`（注意历史快照 `84030bbe` 在双缓存关闭时曾回退覆盖 UUID，升级须核对应分支） |
| 视频坏帧恢复与长音频切分 | OpenCV 默认关 `frame_recovery`；长音频切分器无显式前进保护 | 长音频切分加入退回本段硬边界的前进保护 | OpenCV 坏帧恢复迁至 `video_decoders/opencv.py`；长音频切分新增拒绝多维音频输入 | 同 `v0.30.0` |
| `AscendMRotaryEmbedding` 算子通路 | 支持 `triton_mrope`（交错）与 `npu_mrope`（`[16,24,24]`），`310P` 走预合并静态切片 | 延续并完善 Qwen3-VL / Qwen3.5 `triton_split_qkv_rmsnorm_mrope` 融合补丁 | 保持四通路选路，补齐超 `65535` token 网格自动开 `TRITON_ALL_BLOCKS_PARALLEL=1` 保护 | 延续四通路选路与融合补丁，行号随旋转编码模块微调 |
| `ScoreEncoderCacheManager` 两级编码缓存 | 不存在（仅上游单级 `EncoderCacheManager`） | 不存在（仅上游单级 `EncoderCacheManager`） | **正式新增** `vllm_ascend/ec_manager/score_ec_manager.py` 及 `model_runner_v1` 异步 CPU/NPU/tmp 三态搬运 | 保留 `ScoreEncoderCacheManager` 并在 `ec_transfer` 同步拓展跨进程 Mooncake/CPU ECConnector |

### 源码位置

以下编号与页首 `sources` 列表一一对应：

- **算法论文、官方设计文档与推导**：M-RoPE 原理见 Qwen2-VL 原论文 [S1]；上游多模态处理架构与预计算嵌入指南见 `docs/design/mm_processing.md` 与 `docs/features/multimodal_inputs.md` [S2][S3]；昇腾 Triton RoPE 说明见 `ops/triton/docs/rope.md` [S25]。文中 `448×448` 图像 `256` token / `2 MiB` 账单、`[T₀, A₀, A₁, T₁, B₀, B₁, B₂]` 占位对齐示意及 $\text{score} / \text{cal\_cost}$ 表达式均按定义直接推导 [D][D]。
- **上游多模态前端预处理、四级缓存、融合与 ViT 并行**：`_merge_multimodal_embeddings` 原地覆写及越位抛错见 `models/utils.py` [C4]；ViT 头数回退与 `run_dp_sharded_vision_model` 见 `vision.py` 两段 [C5][C6]；M-RoPE 与单级 `EncoderCacheManager` 见来源 7–8 [C7][C8]；`MultiModalConfig` 默认值、CPU 预处理部分命中合并与占位更新、进程间 `lru/shm` 拓扑判定见来源 9–11 [C9][C10][C11]；HTTP 下载超时/重试、`VLLM_MEDIA_CACHE` 磁盘缓存、音频空项 UUID、OpenCV 坏帧恢复与长音频切分见来源 12–17 [C12][C15][C16]。
- **昇腾 M-RoPE 与 `ScoreEncoderCacheManager` 实现**：`AscendMRotaryEmbedding` 四通路选路、`triton_split_qkv_rmsnorm_mrope` 与 `310P` 预合并见来源 18–20 [C18][C19]；`ScoreEncoderCacheManager` 配置、评分淘汰/晋升、理论重算代价及 Worker 三态异步搬运见来源 21–24 [C21][C22][C24]；`v0.23.0` / `v0.26.0rc` / `main` 跨版本对照锚点见来源 26–28 [C28]。
