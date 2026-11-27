---
id: pooling-and-non-ar
title: Pooling 与非自回归推理：Embedding / Reranker / 生成式评分与 Whisper ASR
type: concept
origin: direct
summary: >-
  本页拆解 --runner pooling（Embedding / Reranker / Reward）一次逻辑前向池化路径（含跨步分块支持边界）、双向与因果掩码硬件分岔、CLS / LAST / MEAN 池化头、生成式评分（/generative_scoring）概率比较，以及 Whisper Encoder-Decoder 与语音上传/实时转写入口。
aliases:
  - Pooling
  - pooling runner
  - --runner pooling
  - 非自回归推理
  - Embedding 模型推理
  - Reranker
  - Reward 模型
  - 生成式评分
  - generative_scoring
  - /generative_scoring
  - /v1/embeddings
  - /v1/score
  - /v1/rerank
  - /v1/audio/transcriptions
  - /v1/realtime
  - Pooler
  - CLSPool
  - LastPool
  - MeanPool
  - Encoder-Decoder
  - Whisper ASR
  - is_encoder_decoder
  - AttentionType.ENCODER_DECODER
chapters:
  - '05'
order: 85
sources:
  - 'https://arxiv.org/abs/1810.04805'
  - 'https://arxiv.org/abs/2212.04356'
  - 'vllm@0fc695fc:docs/serving/online_serving/generative_scoring.md#L1-L64'
  - 'vllm@0fc695fc:docs/models/pooling_models/scoring.md#L1-L32'
  - 'vllm@0fc695fc:docs/serving/online_serving/speech_to_text.md#L1-L189'
  - 'vllm@ced6857a:vllm/config/pooler.py#L16-L65'
  - 'vllm@ced6857a:vllm/model_executor/layers/pooler/seqwise/methods.py#L21-L119'
  - 'vllm@ced6857a:vllm/model_executor/layers/pooler/activations.py#L79-L125'
  - 'vllm@ced6857a:vllm/config/model.py#L668-L686'
  - 'vllm@ced6857a:vllm/entrypoints/generate/generative_scoring/serving.py#L50-L105'
  - 'vllm@ced6857a:vllm/entrypoints/generate/generative_scoring/serving.py#L176-L384'
  - 'vllm@ced6857a:vllm/entrypoints/generate/generative_scoring/api_router.py#L25-L64'
  - 'vllm@ced6857a:vllm/entrypoints/pooling/factories.py#L110-L217'
  - 'vllm@ced6857a:vllm/entrypoints/speech_to_text/base/serving.py#L97-L154'
  - 'vllm@ced6857a:vllm/entrypoints/speech_to_text/base/serving.py#L261-L314'
  - 'vllm@ced6857a:vllm/entrypoints/speech_to_text/realtime/connection.py#L96-L161'
  - 'vllm@ced6857a:vllm/envs.py#L997-L1014'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_mask.py#L57-L70'
  - 'vllm-ascend@c09d3e20:vllm_ascend/_310p/attention/attention_mask.py#L139-L168'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L1123-L1146'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L1189-L1196'
  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/attention_v1.py#L1329-L1339'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L2624-L2638'
  - 'vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1231-L1247'
  - 'vllm-ascend@2c59ff10:vllm_ascend/attention/attention_mask.py#L70-L82'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/attention/attention_mask.py#L72-L84'
  - 'vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1408-L1424'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: prefill
    kind: builds-on
    note: Pooling 模型只做一次等价于 Prefill 的全序列逻辑前向（支持分块的池化头可跨调度步完成），没有后续逐词 Decode 循环
  - to: attention-qkv
    kind: builds-on
    note: 双向编码器（非因果）与因果池化、交叉注意力的掩码差异建立在 Q/K/V 注意力基础上
  - to: sampling
    kind: alternative-to
    note: Pooling 路径完全绕过 lm_head 词表投影与 Sampler 采词，直接把末层隐藏状态送入 Pooler
  - to: acl-graph
    kind: conflicts-with
    note: Encoder-Decoder 模型受限于交叉注意力与动态编码长度，与全图捕获冲突并自动降级为 PIECEWISE 或 Eager
contradicts: []
updated: '2026-11-27'
---

**Pooling 推理（`--runner pooling`）不逐词续写文本，而是在算完输入序列的末层隐藏状态后跳过词表投影与采样，直接由池化头输出向量或分数标量。** 它主要服务于 Embedding（文本向量化）、Reranker（检索精排）与 Reward（奖励打分）任务；而 **Encoder-Decoder**（如 Whisper ASR 语音识别）则是先经双向编码器产出源特征、再在解码器里借交叉注意力自回归生成的混合路径。

沿[请求全景](request-overview.md)与 [Prefill / Decode](prefill.md) 走常规对话生成时，每条请求都要经历“先读完整段提示词写 KV Cache，再循环逐字生成几十上百步”。但工业界大量业务（RAG 检索增强生成的向量入库、检索重排、内容审核分类、RLHF 基于人类反馈的强化学习奖励打分、语音转写）根本不需要套用纯 Decoder 自回归模式。理解 `vllm` 与 `vllm-ascend` 如何为这两类模型改道，能避开大批掩码错配、分块报错和图模式崩溃陷阱。

## 三条执行主线对比：Generate、Pooling 与 Encoder-Decoder

```wiki-diagram
file: pooling-fig-ar-vs-pooling
```

把三类模型在单次请求里的核心资源账放到同一张表里对照：

| 对比维度 | 自回归生成（`--runner generate`） | 池化模型（`--runner pooling`） | 编解码器（`is_encoder_decoder`，如 Whisper） |
|---|---|---|---|
| **典型任务与模型** | 对话、代码、推理（`Qwen3-8B` / `Qwen3-30B-A3B`） | Embedding（BGE / Qwen3-Embedding）、Reranker、Reward | 语音识别 ASR（Whisper）、神经机器翻译 |
| **前向阶段形态** | `1` 次逻辑 Prefill（可分块）+ $T_{\text{out}}$ 步 Decode | **仅 `1` 次逻辑前向**（支持分块的如 `LastPool` 可跨调度步完成），无 Decode 循环 | `1` 次 Encoder 前向 + $T_{\text{out}}$ 步 Decoder |
| **注意力因果性** | 严格因果（上三角屏蔽未来位置） | 双向编码器（BERT/BGE）**非因果**；Decoder 底座（Qwen3-Emb）保持**因果** | Encoder 双向非因果；Decoder 自注意力因果 + 交叉注意力全看 Encoder |
| **KV Cache 行为** | 持续写入并跨步复用历史 K/V | 双向纯编码器不写跨步 KV；因果池化不进入 Decode 复用 | Decoder 额外在 `AttentionType.ENCODER_DECODER` 槽位常驻整段 Encoder K/V |
| **出口模块** | `lm_head` → `Sampler` | 在 `model_runner_v1` 中跳过 `compute_logits`，直入 `self._pool()` | Decoder 末层 → `lm_head` → `Sampler` |
| **昇腾图模式支持** | 支持 `FULL_DECODE_ONLY` / `PIECEWISE` | 以大吞吐变长整段（或分块）前向为主，不依赖 Decode 全图 | `platform.py` 强制将非 `PIECEWISE`/`NONE` 模式降级回 `PIECEWISE`（或 `NONE`） |

## `--runner pooling` 核心机制：掩码硬件分岔与池化头

启动池化服务时，传入 `--runner pooling`（或 `--runner auto` 自动识别模型架构）即可让引擎切入池化模式。如果对不支持池化的纯生成架构硬传 `--runner pooling`，`ModelConfig` 初始化阶段会直接报错拦下。

进入前向计算后，池化模型在昇腾上最关键的两个机制是**注意力掩码分岔**与**池化头归约**：

```wiki-diagram
file: pooling-fig-mask-and-heads
```

### 1. 双向编码器为什么在 A2/A3/950DT 必须传 `mask = None`，却在 310P 必须造掩码？

对于 BERT、RoBERTa、BGE 等**双向编码器**（`causal = False`），序列中每个 token 都必须能看见前后所有其他 token。如果在昇腾上不小心把默认因果掩码送进注意力算子，模型就会退化成只能看左边的残缺表示，输出向量相似度全面崩塌。

`vllm-ascend` 的 `attention_mask.py` 与 `attention_v1.py` 为此做了极其细腻的硬件分流：

- **Atlas A2 / A3 / 950DT（标准后端）**：当 `causal == False` 时，`get_attention_mask` **显式返回 `None`**。原因是主力融合算子 [FIA（融合推理注意力）](ascend-flash-attention.md) 会把任何传入的掩码按 `defaultMask (sparse_mode=0)` 执行，导致上三角被错误遮蔽；随后在 `AscendAttentionBackendImpl.forward` 中，只要命中 `model_runner_type == "pooling" and not causal`，便绕开 `FIA`，转调 `_forward_encoder_attention`，以紧凑变长排布 `input_layout="TND"`（`Token × Head × Dim`）直接调用 `torch_npu.npu_fusion_attention`（不传因果掩码，且在 `query.shape[0] > actual_seq_qlen[-1]` 时给尾部补 `0` 吸收对齐填充）。
- **Atlas A2 / A3 / 950DT（因果池化模型）**：对于基于 Decoder 架构微调出来的 Embedding / Reranker / Reward 模型（例如 Qwen3-Embedding，`causal = True`），`get_attention_mask` 返回 `2048×2048` 布尔因果掩码，照常走标准因果注意力通路，只看左文。
- **Atlas 300I DUO (`310P` 兼容后端)**：`310P` 底层注意力算子不接受 `mask = None`。因此在 `_310p/attention/attention_mask.py` 中覆写了同一接口：遇到 `runner_type == "pooling"` 且 `causal == False` 时，专门构造一张全零非屏蔽加性掩码，并用 `torch_npu.npu_format_cast(..., ACL_FORMAT_FRACTAL_NZ)` 转成[分形排布（FRACTAL_NZ）](tensor-layout.md)后缓存复用。

### 2. 三类序列池化头与分块限制

跳过 `lm_head` 与采样器之后，形状为 `[N_total, H]` 的紧凑隐藏状态张量进入 `Pooler`（`PoolerConfig` 同时支持序列级 `CLS / LAST / MEAN` 与逐 token 级 `ALL / STEP`，以及末端激活函数 `PoolerNormalize`、`PoolerClassify`、`PoolerMultiLabelClassify`、`PoolerIdentity`）：

- **`CLSPool`（首词提取）**：直接切片取出每条请求第 0 个位置（`[CLS]`）的向量 `hidden_states[first_token_indices_gpu]`。常见于 BERT / BGE 系列。
- **`LastPool`（末词提取）**：切片取出每条请求最后一个有效 token 的向量 `hidden_states[last_token_indices_gpu]`。因为因果注意力下只有最后一个位置汇聚了整句上下文，几乎所有 Decoder 底座的 Embedding 与 Reward 模型都选 `LAST`。
- **`MeanPool`（全句均值）**：将同属一条请求的所有 token 向量转成 `FP32` 累加后再除以该句长度 $L_i$：

$$h_{\text{pool}}^{(i)} = \frac{1}{L_i} \sum_{t=1}^{L_i} h_{i,t}, \qquad \hat{h}^{(i)} = \frac{h_{\text{pool}}^{(i)}}{\|h_{\text{pool}}^{(i)}\|_2}$$

为了避免大 batch、长文本下一次性转 `FP32` 撑爆显存，vLLM 的 `MeanPool` 按固定 `16 MiB` 块大小（`_MEAN_POOL_ACCUMULATION_CHUNK_BYTES`）分段调用 `segment_sums.index_add_` 累加。例如隐维 $H = 4096$、`FP32` 每 token 占 `16 KiB`，每块正好处理 $16\text{ MiB} / 16\text{ KiB} = 1024$ 个 token。

**一条极易踩坑的分块约束**：`CLSPool.forward` 与 `MeanPool.forward` 入口都会检查 `pooling_cursor.is_partial_prefill()`——一旦请求被 [Chunked Prefill（分块预填充）](chunked-prefill.md)拆成半截执行，两者都会立即抛出 `RuntimeError`！原因很直观：如果只算了前半段或后半段，要么拿不到完整均值、要么首词已被切在上一批。只有 `LastPool` 能在完整因果 KV 支撑下与分块前向协同；调度器也会专门保护非分块池化请求不被拆半。

在 HTTP 入口侧，Embedding、分类、打分、重排与通用池化分别挂载 `/v1/embeddings`、`/classify`、`/score`、`/rerank` 与 `/pooling`，由模型支持的任务与所选 pooling 任务决定准入——只改 URL 不会给生成模型补出向量或分类头。`/rerank` 把 `query` 与候选 `documents` 逐对比较并返回原候选 `index`（不可把返回顺位当输入序号）。此外，池化模型可通过[输入输出插件](platform-plugin-registration.md#输入输出插件为什么能把一张图拆成多个请求)把一份自定义应用输入拆成多个模型子请求再合并结果，不能直接用 HTTP 请求数代替模型计算任务数。

## 生成式评分（`/generative_scoring`）：与 Pooling `/score` 的边界及概率比较

如果没有专门的池化重排模型，也可以用生成模型的下一词概率分布做打分——vLLM 为此提供独立的 **`POST /generative_scoring`** 入口。它与池化 `/score`（分类头、双编码向量相似度或 token 匹配分）完全分开：后者走 `--runner pooling`，前者复用生成任务为每个候选构造子请求（`max_tokens=1, n=1`，将 `logprobs` 设为候选标签个数［如传 `[A, B]` 时为 `2`］，将 `logprob_token_ids` 设为调用方提供的标签 token ID 列表）。

下图把生成式评分的三种重归一口径，以及后文实时语音转写（`/v1/realtime`）的 WebSocket 事件状态机合在同一视图里对照：

```wiki-diagram
file: pooling-fig-scoring-and-asr
```

设标签 A、B 在完整词表中的概率分别为 `0.1`、`0.3`，其余词合计 `0.6`。默认 `apply_softmax=true` 时，接口**只在指定标签之间重新归一化**并返回**标签列表第一项**的分数（示意）：

| 计算口径 | 算式 | 返回分数 |
|---|---|---|
| 默认 `apply_softmax=true`（传 `[A, B]`） | $0.1 \div (0.1 + 0.3)$ | **$0.25$** |
| 仅传单个有限值标签 `[A]` | $0.1 \div 0.1$ | **$1.0$**（仅因单标签归一，不表示确信答案正确） |
| `apply_softmax=false`（`raw_logprobs` 模式） | $\exp(\ln 0.1)$ | **$0.1$**（完整词表概率；若服务为 `raw_logits`，$\exp(2)\approx 7.389$ 不再是概率） |

使用生成式评分须注意四条硬边界：
- **拼接不补空格与模板**：文字 `query` 与 `items` **分别分词后直接拼接编号**（`item_first=false` 拼 `query+item`，`true` 交换顺序），中间不自动补空格、分隔符或聊天模板；`add_special_tokens=true` 仅对文字 `query` 生效，文字 `item` 不补特殊 token，直接传编号保持原样。
- **超长截断与返回结构**：拼接超长时保留最前面 `max_model_len - 1` 个编号（留 `1` 个输出位），调用前需避免尾部问题或候选被截掉；成功响应按输入顺序返回 `data[i].index` 与 `score`（不自动按分重排、不返回整张标签概率表）并汇总 `usage`。
- **单 token 标签与上限**：标签编号须来自当前模型分词器且为单枚 token（不能用首 token 冒充多 token 词串），数量同时受 `--max-logprobs` 与 `logprob_token_ids` 最多 `128` 项限制。
- **MTP 与成本边界**：每个候选仍须跑完整提示词前向；且固定 MTP 路径未贯通 `logprob_token_ids` 采集（详见[采样进阶](sampling-advanced.md#logprobs-四模式扁平容器与指定编号查询)），不要在未验证的 MTP 实例上依赖此路由。

## Encoder-Decoder 与 Whisper ASR 路径

另一类典型的非纯自回归解码模型是 **Encoder-Decoder**（以语音识别模型 **Whisper** 为代表，`model_config.is_encoder_decoder == True`）。它在推理引擎里分两段协同：

1. **音频编码段（Encoder）**：输入音频梅尔频谱（把声音波形转换成贴近人耳频率感知的二维时频图）经 CNN（卷积神经网络）与双向 Transformer 编码器算出定长或变长声学特征序列（例如 Whisper 30 秒音频对应 `1500` 帧编码特征）。
2. **交叉注意力解码段（Cross-Attention + Decoder）**：在首轮解码前，编码器输出经投影写入专属于 `AttentionType.ENCODER_DECODER` 的交叉注意力 KV Cache 槽位。注意 `vllm_ascend/attention/attention_v1.py` 中的关键特判：常规自注意力写入缓存时会把 `key`、`value` 和 `slots` 按 `[:attn_metadata.num_actual_tokens]` 截断成当前解码步长，但交叉注意力缓存装的是**整段编码器输出**而非当前解码 token，因此当 `self.attn_type == AttentionType.ENCODER_DECODER` 时必须保留完整 `key / value / slots` 写入，绝不能按解码步长截断。
3. **昇腾图模式自动降级**：由于编码器与解码器长度解耦且交叉注意力路径未接入全图捕获，`vllm_ascend/platform.py` 在配置检查阶段会自动拦截：`is_encoder_decoder` 为真且 `cudagraph_mode` 不是 `NONE` 或 `PIECEWISE` 时，直接回退为 `PIECEWISE`（开了 `VLLM_COMPILE` 时）或 `NONE`（未开编译时），并打印一次日志提示。

### 语音文件上传（`/v1/audio/*`）与实时转写（`/v1/realtime`）入口

语音识别的在线接口分为“先收整份文件”与“实时分段流”两条路（聊天消息里的音频另走[多模态输入](multimodal-inference.md#预计算媒体向量视频帧元数据与音频预处理边界)；具备聊天音频、文件转写、实时转写三者之一不会自动获得另外两个）：

- **文件上传（`/v1/audio/transcriptions` 与 `/v1/audio/translations`）**：通过 multipart `file` 上传，默认 `response_format="json"`、`stream=false`、`use_beam_search=false`、`n=1`（beam 模式下表束宽）、`temperature=0.0`。基线传 `text` 在非流式路由仍包成 JSON；`verbose_json`（需时间戳能力）与 `v0.30.0` 新增的 `diarized_json`（需说话人区分）均不支持流式；`use_beam_search=true` 亦不能配流式。上传上限由 `VLLM_MAX_AUDIO_CLIP_FILESIZE_MB`（默认 `25`，按 MiB 计）控制，长音频支持切分的模型会进入静音切分分支。
- **实时转写 WebSocket（`/v1/realtime`）**：固定要求 **PCM16 / 16 kHz / 单声道** 经 base64 编码发送（不可直接 base64 MP3）。每秒单连续缓冲原始数据为 $16{,}000 \times 1 \times 2\text{ B} = \mathbf{32{,}000\text{ B}}$，base64 后为 $\lceil 32{,}000 \div 3 \rceil \times 4 = \mathbf{42{,}668}$ 字符（另计 JSON 与分块补齐）。事件时序严格区分普通与结束提交：先收 `session.created` → 发 `session.update` 校验模型（此前 commit 报 `model_not_validated`）→ 发普通 `input_audio_buffer.commit` **启动生成** → 逐段 `input_audio_buffer.append` → 发 `input_audio_buffer.commit`（`final=true`）**仅放结束标志**，期间收取 `transcription.delta` 与 `transcription.done`。

## 常见误解

- **「Embedding 模型也算 Transformer，所以推理开销和对话模型一样受限于 Decode 带宽墙？」**：错。Embedding / Reranker 走 `--runner pooling` 只需完成一次全序列逻辑前向（支持分块的因果 `LastPool` 可跨调度步完成，不支持分块的 `CLSPool` / `MeanPool` 单步跑完），没有逐字 Decode 循环，算术强度高、属于典型的**计算受限（Compute-bound）**负载，调优重点是拉大并发批 token 数而非压低单步 Decode 时延。
- **「给 BERT / BGE 双向模型传全 1 或因果掩码没关系，反正 Pooler 只取第一个词？」**：错。若误传因果掩码，第 0 个 `[CLS]` 位置只能看见它自己、完全看不见后面的句子正文，导致所有输入算出的向量几乎一模一样；A2/A3/950DT 上双向池化必须让 `get_attention_mask` 返回 `None` 并走 `npu_fusion_attention`。
- **「所有池化模型都可以随意配合 Chunked Prefill 把超长文本切成小块算？」**：错。`CLSPool` 与 `MeanPool` 遇到 `is_partial_prefill()` 会直接抛 `RuntimeError`，必须整句一次完成前向；部署长文池化时需确保 `max_num_batched_tokens` 不小于单条最大长度。
- **「Whisper 这类 Encoder-Decoder 模型在昇腾上开 `FULL_DECODE_ONLY` 全图模式能提速？」**：错。`vllm-ascend` 平台检查会主动将 `is_encoder_decoder` 模型的全图模式降级回 `PIECEWISE` 或 `NONE`，强配全图不会生效。

## 对照源码

### 怎么开

- **启动 Embedding / Reranker / Reward 池化服务**：在 `vllm serve` 中指定 `--runner pooling`（多数标准架构亦可留默认 `--runner auto` 自动识别），并通过 `--pooler-config '{"pooling_type": "MEAN", "normalize": true}'` 按需覆盖默认池化策略；调用 `/v1/embeddings`、`/classify`、`/score`、`/rerank` 或 `/pooling`。
- **调用生成式评分**：向支持生成任务的服务发 `POST /generative_scoring`，JSON 顶层传 `query`（文本或编号列表）、非空 `items` 与单 token `label_token_ids`（`model` 可选但须匹配服务名）；可选 `apply_softmax=true`、`item_first=false`、`add_special_tokens=true`、`priority=0`。`apply_softmax=false` 需配合服务 `--logprobs-mode raw_logprobs` 才可解读为完整词表概率。
- **启动 Whisper 等 Encoder-Decoder 服务与语音接口**：直接传入 Whisper 模型路径，引擎自动识别 `is_encoder_decoder = True` 并在昇腾上自动收敛图模式至 `PIECEWISE` 或 `NONE`。文件转写/翻译走 `/v1/audio/transcriptions` 与 `/v1/audio/translations`；实时转写连接 `/v1/realtime`，在收到 `session.created` 后依次发送 `{"type": "session.update", "model": model_name}` → `{"type": "input_audio_buffer.commit"}` → 多段 `{"type": "input_audio_buffer.append", "audio": audio_base64}` → `{"type": "input_audio_buffer.commit", "final": True}`。

### 会报什么错

| 拦截位置 | 触发条件 | 实际报错或行为 |
|---|---|---|
| `ModelConfig` 初始化校验 | 对不支持池化的纯生成模型强制指定 `--runner pooling` | 抛出配置校验错误提示该模型不支持 `--runner pooling` |
| `CLSPool.forward` / `MeanPool.forward` | 请求被分块预填充切成了不完整片段（`is_partial_prefill()`） | 抛出 `RuntimeError: partial prefill is not supported with CLS/MEAN pooling` |
| `POST /generative_scoring` | `items` 为空、标签越界、标签数超 `--max-logprobs` / `128`，或 `priority` 超有符号 64 位整数（`v0.30.0+`） | 入口参数校验拒绝；若服务启用了未贯通 `logprob_token_ids` 的 MTP 路径则无法保证按指定标签返回 |
| `/v1/audio/*` 与 `/v1/realtime` | 上传超 `VLLM_MAX_AUDIO_CLIP_FILESIZE_MB`；`verbose_json`/`diarized_json`/`beam` 配流式；实时连接在模型校验前 `commit` | 分别报 `Maximum file size exceeded`、组合拒绝或 `model_not_validated` |
| `NPUPlatform` 图模式检查 | `is_encoder_decoder=True` 且配置了 `FULL` / `FULL_DECODER_ONLY` / `FULL_DECODE_ONLY` | 不报错，打印日志并自动降级回 `PIECEWISE` 或 `NONE` |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10 / 0fc695fc)` | `v0.26.0rc (2ed6cbba / 568afb3a)` | `v0.30.0 (c09d3e20 / ced6857a)` | `main (8d6180e2 / ba15685a)` |
|---|---|---|---|---|
| 昇腾 Pooling 注意力掩码 | `attention_mask.py` 已有 `pooling` 分支与 `310P` 显式 NZ 非因果掩码 | 延续双向 `None` + `npu_fusion_attention` 与 `310P` NZ 掩码 | 保持 `A2/A3/950DT` 双向返回 `None`、`310P` 显式 NZ 掩码，并在 `worker/v2/attn_utils.py` 同步支持 MRV2 `pooling` 路径 | 延续四族硬件掩码分流，并在 `attention_v1.py` 细化 `pooling` 非因果分支判据 |
| 生成式评分 `/generative_scoring` | 无按 `items` 数预准入检查；`priority` 为无界 `int` | 同 `v0.23.0` | 按 `items` 数调用引擎准入检查；`priority` 限有符号 64 位整数 `[-2^63, 2^63-1]` | 同 `v0.30.0` |
| 语音上传、解码上限与输出格式 | 默认 `25 MiB` 先完整读再检查；无解码时长/字节上限；支持 `json/text/verbose_json` | 路由先限量读取；增专用预处理线程池与默认 `600s` 时长上限 | 路由限量读取（去重复检查）；另增默认 `268,435,456 B`（`256 MiB`）解码容量上限与非流式 `diarized_json` | 同 `v0.30.0` |
| `Encoder-Decoder` 交叉注意力与图模式 | `platform.py` 已强制降级至 `PIECEWISE` / `NONE`；`attention_v1.py` 特判 `ENCODER_DECODER` 不按解码步截断 KV | 与 `v0.23.0` 一致 | 延续 `PIECEWISE` / `NONE` 降级，并在自定义调度器补齐 `is_encoder_decoder` 保护 | 保持同样降级规则与交叉注意力缓存语义（`platform.py:1412`） |

### 源码位置

以下编号与页首 `sources` 列表一一对应：

- **算法原论文、官方指南与推导**：BERT 与 Whisper 原论文见 [S1][S2]；生成式评分、池化打分与语音转写官方指南分别见来源 3–5 [S3][S4][S5]。文中 `MeanPool` `16 MiB` 分块容量核算、生成式评分 `0.25 / 1.0 / 0.1` 算例与实时音频每秒 `32,000 B` / `42,668` base64 字符均按定义直接推导 [D][D]。
- **上游 Pooling、生成式评分与语音入口**：`PoolerConfig`、`CLSPool`/`LastPool`/`MeanPool`（含 `16 MiB` 分块与 `is_partial_prefill()` 拦截）、激活与 `--runner pooling` 校验见来源 6–9 [C6][C7][C9]；`/generative_scoring` 路由、编号拼接、重归一与准入检查见来源 10–12 [C10][C11]；pooling 工厂、语音上传限量/解码上限与 `/v1/realtime` 事件机见来源 13–17 [C13][C14][C16]。
- **昇腾掩码分岔、融合算子与 Encoder-Decoder 适配**：A2/A3/950DT 双向 `causal=False` 返回 `None`、`310P` `FRACTAL_NZ` 掩码、双向 `npu_fusion_attention`、`ENCODER_DECODER` 整段 KV 写入、`model_runner_v1` 直入 `self._pool()` 以及图模式降级见来源 18–24 [C18][C19][C20][C23][C24]；`v0.23.0`、`v0.26.0rc` 与 `main` 跨版本对照锚点见来源 25–27 [C27]。
