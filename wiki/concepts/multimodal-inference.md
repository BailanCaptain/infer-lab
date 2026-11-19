---
id: multimodal-inference
title: 多模态推理与视觉编码基础：Patch 展开、M-RoPE、ViT 数据并行与两级编码缓存
type: concept
origin: direct
summary: >-
  多模态推理先将图像与视频切块展开为占位 token，经 ViT 编码并原地覆写进文本嵌入，再以三维 M-RoPE 注入时空坐标；本页讲清 Patch 展开、ViT --mm-encoder-tp-mode data 并行与 v0.30.0 两级 ScoreEncoderCacheManager 缓存。
aliases:
  - 多模态推理
  - 视觉编码
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
  - run_dp_sharded_vision_model
  - EncoderCacheManager
  - ScoreEncoderCacheManager
  - 多模态编码缓存
chapters:
  - '01'
order: 70
sources:
  - 'https://arxiv.org/abs/2409.12191'
  - 'vllm@ced6857a:vllm/model_executor/models/utils.py#L689-L725'
  - 'vllm@ced6857a:vllm/model_executor/models/vision.py#L146-L162'
  - 'vllm@ced6857a:vllm/model_executor/models/vision.py#L295-L326'
  - 'vllm@ced6857a:vllm/model_executor/layers/rotary_embedding/mrope.py#L15-L88'
  - 'vllm@ced6857a:vllm/v1/core/encoder_cache_manager.py#L19-L101'
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
  - to: embedding
    kind: builds-on
    note: 视觉编码器输出的嵌入张量最终按占位掩码原地覆写进标准词向量表查出的 inputs_embeds
  - to: rope
    kind: builds-on
    note: M-RoPE 把一维位置索引扩展为 (T, H, W) 三维时空坐标并分段旋转头维度
  - to: epd-disaggregation
    kind: alternative-to
    note: 当多图或高分辨率视频把视觉编码器推成瓶颈时，可把单实例内置编码器切换为独立 E 节点池的 EPD 分离架构
  - to: api-server-entry
    kind: builds-on
    note: 前端进程在进入引擎前完成图片解码、Processor 切块缓存与多模态哈希生成
contradicts: []
updated: '2026-11-19'
---

**多模态推理（Multimodal Inference）是指引擎在同一条提示词中同时接收文本与图像、视频或音频，先将非文本媒体切块并经专用编码器（如视觉编码器 ViT）投影到语言模型的隐藏维度，再把视觉向量原地填回序列占位槽，最后交由标准语言主干完成自回归生成。**

沿[请求全景](request-overview.md)与[分词入口](token.md)走进语言模型时，纯文本请求只需查一次 [Embedding](embedding.md) 词表即可进入首层 Transformer。可一旦用户在消息里附带一张图片或一段视频，语言主干既读不懂原始 RGB 像素，也分不清二维平面里“上下相邻”的图像块在拉平成一维序列后其实相隔一整行。多模态推理体系正是为了解决**媒体如何变 token、视觉编码器如何跨卡不卡顿、以及重复图片如何免重算**这三道核心工程难题。

## 一张图怎样变成语言模型吃得下的 token 序列？

前端处理器（MultiModal Processor，接入入口见 [API server 入口](api-server-entry.md)）收到一张高分辨率图像或视频后，并不等待 NPU 算完视觉网络才构造序列，而是先按分辨率与合并步幅算出精确的视觉 token 数量，直接在 `input_ids` 里插入等量的**占位 token（placeholder token）**，同时附带原始像素块张量与三维网格描述符 `image_grid_thw = (T, H, W)`。

以典型的 Qwen2.5-VL / Qwen3-VL 视觉切块规则做一笔示意账：设输入单张静图分辨率为 $448 \times 448$，视觉编码器块大小 `patch_size = 14`，经过视觉末尾的 $2 \times 2$ 空间合并（`spatial_merge_size = 2`）后，送入语言主干的视觉 token 数为：

$$N_{\text{vis}} = T \times \frac{H_{\text{px}}}{\text{patch\_size} \times \text{merge}} \times \frac{W_{\text{px}}}{\text{patch\_size} \times \text{merge}} = 1 \times \frac{448}{28} \times \frac{448}{28} = 16 \times 16 = 256$$

如果语言主干隐藏维 $D_{\text{llm}} = 4096$、`BF16`（每元素 `2 B`），这张图产出的视觉嵌入矩阵形状就是 `[256, 4096]`，显存仅占 `2 MiB`。进入 `ModelRunner` 后，引擎先对未命中编码缓存的媒体调用 `embed_multimodal()` 跑完 ViT 与投影层，再由 `_merge_multimodal_embeddings` 按布尔掩码 `is_multimodal` 执行一次**原地覆写**：`inputs_embeds[is_multimodal] = mm_embeds_flat.to(dtype=inputs_embeds.dtype)`。如果实际产出的视觉向量行数与占位 token 数对不上，此处会立即抛出 `ValueError` 拦截错位。

```wiki-diagram
file: multimodal-fig-pipeline-mrope
```

## M-RoPE：怎样把二维空间与视频时间编进注意力旋转角？

把二维图像行优先展平进一维序列后，原本在画面中上下紧挨的两个图像块，一维位置号会相差一整行宽度 $W$；视频帧之间也丢失了“同一像素随时间推进”的对齐关系。如果照搬纯文本的一维 [RoPE](rope.md)，语言主干只能硬学空间布局。

**M-RoPE（Multimodal Rotary Position Embedding）**把每个 token 的位置索引从单个整数扩展为三维坐标矩阵 `positions`，形状为 `[3, num_tokens]`，三行依次记录时间 $T$、垂直行 $H$、水平列 $W$：

- **纯文本 token**：三行坐标完全相同（$T = H = W = p$），旋转结果严格退化为标准一维 RoPE，保证纯文本能力不受损；
- **图像与视频 Patch token**：$T$ 随视频帧号递增（静图固定不变），$H \in [0, H_{\text{grid}}-1]$ 与 $W \in [0, W_{\text{grid}}-1]$ 记录块在画面中的二维网格坐标；整张图结束后的下一个文本 token 从 $\max(T, H, W) + 1$ 继续顺延编号。

在每个注意力头内部，M-RoPE 按模型配置的 `mrope_section`（例如 `head_dim = 128`、半维 `64` 时常见的 `[16, 24, 24]`，满足 $16 + 24 + 24 = 64$）把旋转频率维度切为三段，分别用 $T$、$H$、$W$ 三组坐标查 `cos_sin_cache` 并施加旋转；部分较新架构（如 Qwen3-VL / Qwen3.5）进一步采用**交错排布（`mrope_interleaved = True`）**，按模 3 余数把 $T/H/W$ 频段均匀分散到高中低频，避免某一空间轴独占全部高频分量。

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

显式开启 **`--mm-encoder-tp-mode data`** 后，每张 TP 卡各自保留一份完整的 ViT 权重，调用 `run_dp_sharded_vision_model` 把同批的多张图片（或视频帧）沿 batch 维均分（或按各图 Patch 总数贪心均衡分摊）给各张卡独立编码。整个 ViT 内部 **0 次跨卡通信**，直到编码器出口才做**唯一一次 `tensor_model_parallel_all_gather`** 拼齐全部视觉嵌入并裁掉对齐填充。代价只是每卡多占几百 MB ViT 权重显存，却能把多图请求的首字时延（TTFT）大幅压低。

## 重复图片怎样免重算：`EncoderCacheManager` 与昇腾 `ScoreEncoderCacheManager`

多轮图文对话、文档 RAG 或同一批并发请求引用相同系统底图时，同一张图（以唯一内容哈希 `mm_hash` 标识）会被反复引用。vLLM V1 原生 `EncoderCacheManager` 按**嵌入槽位数（encoder embeddings）**在 NPU 显存中维护单级缓存，当引用计数归零且空间不足时按最老条目（FIFO）逐出。

但在高并发多模态线上服务里，单靠有限的 NPU 显存做 FIFO 很容易把“刚用完但下一秒马上又被查到的高分辨率大图”顶出去。为此，`vllm-ascend v0.30.0` 新增了面向热点复用的 **`ScoreEncoderCacheManager`** 两级编码器缓存体系：

```wiki-diagram
file: multimodal-fig-score-ec-cache
```

它的核心运转逻辑分成调度器决策与 Worker 执行两半：

1. **新算条目先落 CPU 大池**：未命中缓存而刚经 ViT 算出的视觉嵌入，调度器先在主机内存池（`cpu_cache_slots` 默认 `100,000` 槽）记账，Worker 通过 `pin_memory=True` 与 `non_blocking=True` 异步拷贝至 `cpu_encoder_cache`，设备侧只暂存于 `tmp_encoder_cache`（请求结束即释放），不长期霸占昂贵的 HBM。
2. **基于重算代价与热度的评分晋升**：每次命中都会累计访问频次 `freq` 与时间片新鲜度 `clock`（每 `clock_decay_every = 64` 次请求衰减一次，上限 `max_clock = 15`），并结合视觉层理论重算时间与存储槽之比 `cal_cost`（随 Patch 序列长度 $s$ 线性增长，因为视觉自注意力复杂度为 $O(s^2)$、存储为 $O(s)$，比值正比于 $\alpha s + \beta$）计算综合价值：

$$\text{score} = (\text{freq} + \text{clock}) \times \text{cal\_cost}, \qquad \text{cal\_cost}(s) = \frac{L_{\text{vis}}(\alpha s + \beta)}{4 \times 10^{14}}$$

其中 $L_{\text{vis}}$ 对 `qwen3_5` 取 `27` 层、其余默认取 `32` 层。当某条 CPU 缓存项再次命中且 NPU 空槽不足时，`should_promote` 会把该条目不含 `clock` 的得分与 NPU 可回收集合 `npu_freeable` 中按升序排在 **`promote_percentile`（默认 `0.2`，即低 `20%` 分位）** 的门槛比较：跨过门槛才触发淘汰低分项（一次性清理到既够放下新项、又尽量留出 **`watermark`（默认 `0.2`）** 比例空槽），并由 Worker 借 `torch.npu.Event` 异步 H2D 晋升到常驻 `encoder_cache`。
3. **防御性兜底**：如果调度器判定某条目在 CPU 缓存命中，但 Worker 临时缓存中尚未就绪，`_get_encoder_output_from_cache` 会退回一次同步 H2D 补拷并写入 `tmp_encoder_cache`，防止调度器与 Worker 状态微差演变成致命 cache miss。

## 常见误解

- **「多模态模型里 1 张图片只占 1 个 token 的 KV cache？」**：错。1 张图在预处理阶段就会按分辨率和合并步幅展开成几十到上千个占位 token（如 `448×448` 示意下为 `256` 个）；进入语言主干后，每个视觉 token 都会像普通文本 token 一样占用 KV cache 块并参与自注意力计算。
- **「开了 TP=8 就应该把 ViT 也按权重切 8 份，这样一定更快？」**：错。ViT 参数量很小但层数并不少，按权重切分会在每层引入两次小包 `All-Reduce`；多图并发下开启 `--mm-encoder-tp-mode data` 往往能消除数十次同步通信，且视觉头数不能被 TP 整除时框架本身也会强制回退为 `data`。
- **「开了 `ScoreEncoderCacheManager` 会把所有算过的图片都死锁在 NPU 显存里导致 OOM？」**：错。新编码出的嵌入默认写入 pinned CPU 缓存，设备侧仅在当步暂存 `tmp_encoder_cache`；只有访问频次与重算代价综合得分跨过 `promote_percentile` 门槛的热点条目才会晋升进固定槽位上限的 NPU 常驻池。
- **「纯文本请求走多模态模型时，M-RoPE 会破坏文本位置编码？」**：错。对所有纯文本 token，三维坐标 `(T, H, W)` 的三行取值完全一致，三段频率查出的旋转角与标准 1D RoPE 严格等价。

## 对照源码

### 怎么开

- **ViT 改走数据并行**：在多图并发或视觉头数不能被 TP 整除的部署中，为 `vllm serve` 追加 `--mm-encoder-tp-mode data`；默认值为 `weights`。
- **启用两级评分编码缓存 `ScoreEncoderCacheManager`**：通过 vLLM V1 的 `ec_manager_config` 指定管理器类为 `vllm_ascend.ec_manager.score_ec_manager.ScoreEncoderCacheManager`，并在 `manager_config` 中按需调节 `cpu_cache_slots`（默认 `100000`）、`max_clock`（默认 `15`）、`clock_decay_every`（默认 `64`）、`watermark`（默认 `0.2`）与 `promote_percentile`（默认 `0.2`）。
- **多模态缓存与跨进程边界**：单实例内复用的编码器缓存由 `EncoderCacheManager` / `ScoreEncoderCacheManager` 管理；若要跨进程把 ViT 拆成独立服务池，则需配合 `ECConnector` 走 [EPD 分离](epd-disaggregation.md)。

### 会报什么错

| 拦截位置 | 触发条件 | 实际报错或回退行为 |
|---|---|---|
| `_merge_multimodal_embeddings` | 视觉编码器产出 token 数与 `is_multimodal` 占位符数不一致 | 抛出 `ValueError: Attempted to assign ... multimodal tokens to ... placeholders` |
| `vision.py` 头数检查 | `mm_encoder_tp_mode="weights"` 且视觉头数不能被 `tp_size` 整除 | 打印一次告警并静默回退到 `data` 模式 |
| `ScoreEncoderCacheConfig.__post_init__` | `cpu_cache_slots <= 0`、`clock_decay_every <= 0` 或 `watermark / promote_percentile` 超出 `[0, 1]` | 立即抛出 `ValueError` 拒绝非法配置 |
| `AscendMRotaryEmbedding.forward_oot` | 非交错排布且 `mrope_section != [16, 24, 24]` | 不报错，跳过 `torch_npu.npu_mrope` 并回退父类 `super().forward_oot` |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| `AscendMRotaryEmbedding` 算子通路 | 支持 `triton_mrope`（交错）与 `npu_mrope`（`[16,24,24]`），`310P` 走预合并静态切片 | 与 `v0.23.0` 一致，继续完善 Qwen3-VL / Qwen3.5 `triton_split_qkv_rmsnorm_mrope` 融合补丁 | 保持四通路选路，补齐超 65535 token 网格自动开 `TRITON_ALL_BLOCKS_PARALLEL=1` 保护 | 延续四通路选路与融合补丁，行号随旋转编码模块微调 |
| `ScoreEncoderCacheManager` 两级编码缓存 | 不存在（仅上游单级 `EncoderCacheManager`） | 不存在（仅上游单级 `EncoderCacheManager`） | **正式新增** `vllm_ascend/ec_manager/score_ec_manager.py` 及 `model_runner_v1` 异步 CPU/NPU/tmp 三态搬运 | 保留 `ScoreEncoderCacheManager` 并在 `ec_transfer` 同步拓展跨进程 Mooncake/CPU ECConnector |

### 源码位置

以下编号与页首 `sources` 列表一一对应：

- **算法论文、算子文档与推导**：M-RoPE 三维时空位置编码与动态分辨率切块原理见 Qwen2-VL 原论文 [S1]；昇腾 Triton RoPE 替换 `npu_mrope` 的背景说明见 `ops/triton/docs/rope.md` [S14]。文中 `448×448` 图像经 `patch_size=14` 与 `2×2` 合并展开为 `256` token、`2 MiB` 嵌入张量的账单，以及 $\text{score}$ 与 $\text{cal\_cost}$ 的代数表达均按定义直接推导 [D]。
- **上游多模态融合、ViT 数据并行与基础缓存**：`_merge_multimodal_embeddings` 原地覆写及数量错位抛错见 `vllm/model_executor/models/utils.py:689-725` [C2]；ViT 头数不可整除自动回退 `data` 模式见 `vision.py:146-162` [C3]；`run_dp_sharded_vision_model` 样本切分与尾部 `all_gather` 见 `vision.py:295-326` [C4]；上游 M-RoPE Triton 核的 `mrope_section` 与交错掩码见 `mrope.py:15-88` [C5]；单级 `EncoderCacheManager` 槽位与引用计数设计见 `encoder_cache_manager.py:19-101` [C6]。
- **昇腾 M-RoPE 与 `ScoreEncoderCacheManager` 实现**：`AscendMRotaryEmbedding` 的 `forward_triton`、`65535` 网格保护与 `torch_npu.npu_mrope` 选路见 `rotary_embedding.py:601-684` [C7]；Qwen3-VL 融合核 `triton_split_qkv_rmsnorm_mrope` 见 `split_qkv_rmsnorm_mrope.py:282-335` [C8]；`310P` 预合并 `cos/sin` 见 `_310p/ops/rotary_embedding.py:51-92` [C9]；`ScoreEncoderCacheConfig` 校验与双池初始化见 `score_ec_manager.py:31-150` [C10]，`score`、`evict_from_npu` 与 `should_promote` 见 `score_ec_manager.py:151-240` [C11]，理论重算代价 `cal_theory_cost_storage_cost` 与元数据输出见 `score_ec_manager.py:345-439` [C12]；Worker 侧 `cpu_encoder_cache`、`tmp_encoder_cache`、异步 `torch.npu.Event` 搬运与兜底回补见 `model_runner_v1.py:1142-1278` [C13]。
- **跨版本核验锚点**：`v0.23.0`、`v0.26.0rc` 与 `main` 的 `AscendMRotaryEmbedding` 锚点分别见三分支 `rotary_embedding.py` [C15][C16][C17]；经树清单核对，`vllm_ascend/ec_manager/` 仅自 `v0.30.0 (c09d3e20)` 起存在 [D]。
