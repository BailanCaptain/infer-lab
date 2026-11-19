---
id: pooling-and-non-ar
title: Pooling 与非自回归推理：Embedding / Reranker / Reward 池化头与 Encoder-Decoder（Whisper ASR）
type: concept
origin: direct
summary: >-
  本页拆解 --runner pooling（Embedding / Reranker / Reward）跳过采样的单轮池化路径、双向与因果掩码在 A2/A3/950DT 与 310P 上的硬件分岔、CLS / LAST / MEAN 池化头边界，以及 Whisper Encoder-Decoder 的跨注意力 KV 与图模式约束。
aliases:
  - Pooling
  - pooling runner
  - --runner pooling
  - 非自回归推理
  - Embedding 模型推理
  - Reranker
  - Reward 模型
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
  - 'vllm@ced6857a:vllm/config/pooler.py#L16-L65'
  - 'vllm@ced6857a:vllm/model_executor/layers/pooler/seqwise/methods.py#L21-L119'
  - 'vllm@ced6857a:vllm/model_executor/layers/pooler/activations.py#L79-L125'
  - 'vllm@ced6857a:vllm/config/model.py#L668-L686'
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
    note: Pooling 模型只跑等价于 Prefill 的单轮全序列前向，没有后续逐词 Decode 循环
  - to: sampling
    kind: alternative-to
    note: Pooling 路径完全绕过 lm_head 词表投影与 Sampler 采词，直接把末层隐藏状态送入 Pooler
  - to: ascend-flash-attention
    kind: builds-on
    note: 双向编码器与因果池化模型在昇腾上分别落入 npu_fusion_attention 与标准 FIA 算子分支
  - to: acl-graph
    kind: conflicts-with
    note: Encoder-Decoder 模型受限于交叉注意力与动态编码长度，与全图捕获冲突并自动降级为 PIECEWISE 或 Eager
contradicts: []
updated: '2026-11-19'
---

**Pooling 推理（`--runner pooling`）是指面向 Embedding（文本向量化）、Reranker（检索精排）与 Reward（奖励打分）等非生成任务的单轮前向路径——引擎算完输入序列的末层隐藏状态后，跳过词表投影与采样，直接用池化头归约成向量或标量；而 Encoder-Decoder（如 Whisper ASR 语音识别）则是先跑双向编码器生成源特征、再在解码器里做交叉注意力自回归的混合路径。**

沿[请求全景](request-overview.md)与 [Prefill / Decode](prefill.md) 走常规对话生成时，每条请求都要经历“先读完整段提示词写 KV Cache，再循环逐字生成几十上百步”。但工业界大量业务（RAG 向量入库、检索重排、内容审核分类、RLHF 奖励打分、语音转写）根本不需要套用纯 Decoder 自回归模式。理解 `vllm` 与 `vllm-ascend` 如何为这两类模型改道，能避开大批掩码错配、分块报错和图模式崩溃陷阱。

## 三条执行主线对比：Generate、Pooling 与 Encoder-Decoder

```wiki-diagram
file: pooling-fig-ar-vs-pooling
```

把三类模型在单次请求里的核心资源账放到同一张表里对照：

| 对比维度 | 自回归生成（`--runner generate`） | 池化模型（`--runner pooling`） | 编解码器（`is_encoder_decoder`，如 Whisper） |
|---|---|---|---|
| **典型任务与模型** | 对话、代码、推理（`Qwen3-8B` / `Qwen3-30B-A3B`） | Embedding（BGE / Qwen3-Embedding）、Reranker、Reward | 语音识别 ASR（Whisper）、神经机器翻译 |
| **前向轮数** | `1` 轮 Prefill + $T_{\text{out}}$ 轮 Decode | **仅 `1` 轮前向**，算完即收尾返回 | `1` 轮 Encoder + $T_{\text{out}}$ 轮 Decoder |
| **注意力因果性** | 严格因果（上三角屏蔽未来位置） | 双向编码器（BERT/BGE）**非因果**；Decoder 底座（Qwen3-Emb）保持**因果** | Encoder 双向非因果；Decoder 自注意力因果 + 交叉注意力全看 Encoder |
| **KV Cache 行为** | 持续写入并跨步复用历史 K/V | 双向纯编码器不写跨步 KV；因果池化不进入 Decode 复用 | Decoder 额外在 `AttentionType.ENCODER_DECODER` 槽位常驻整段 Encoder K/V |
| **出口模块** | `lm_head` → `Sampler` | 在 `model_runner_v1` 中跳过 `compute_logits`，直入 `self._pool()` | Decoder 末层 → `lm_head` → `Sampler` |
| **昇腾图模式支持** | 支持 `FULL_DECODE_ONLY` / `PIECEWISE` | 以大吞吐变长单轮前向为主，不依赖 Decode 全图 | `platform.py` 强制将非 `PIECEWISE`/`NONE` 模式降级回 `PIECEWISE`（或 `NONE`） |

## `--runner pooling` 核心机制：掩码硬件分岔与池化头

启动池化服务时，传入 `--runner pooling`（或 `--runner auto` 自动识别模型架构）即可让引擎切入池化模式。如果对不支持池化的纯生成架构硬传 `--runner pooling`，`ModelConfig` 初始化阶段会直接报错拦下。

进入前向计算后，池化模型在昇腾上最关键的两个机制是**注意力掩码分岔**与**池化头归约**：

```wiki-diagram
file: pooling-fig-mask-and-heads
```

### 1. 双向编码器为什么在 A2/A3/950DT 必须传 `mask = None`，却在 310P 必须造掩码？

对于 BERT、RoBERTa、BGE 等**双向编码器**（`causal = False`），序列中每个 token 都必须能看见前后所有其他 token。如果在昇腾上不小心把默认因果掩码送进注意力算子，模型就会退化成只能看左边的残缺表示，输出向量相似度全面崩塌。

`vllm-ascend` 的 `attention_mask.py` 与 `attention_v1.py` 为此做了极其细腻的硬件分流：

- **Atlas A2 / A3 / 950DT（标准后端）**：当 `causal == False` 时，`get_attention_mask` **显式返回 `None`**。原因是主力融合算子 `FIA` 会把任何传入的掩码按 `defaultMask (sparse_mode=0)` 执行，导致上三角被错误遮蔽；随后在 `AscendAttentionBackendImpl.forward` 中，只要命中 `model_runner_type == "pooling" and not causal`，便绕开 `FIA`，转调 `_forward_encoder_attention`，以紧凑变长排布 `input_layout="TND"` 直接调用 `torch_npu.npu_fusion_attention`（不传因果掩码，且在 `query.shape[0] > actual_seq_qlen[-1]` 时给尾部补 `0` 吸收对齐填充）。
- **Atlas A2 / A3 / 950DT（因果池化模型）**：对于基于 Decoder 架构微调出来的 Embedding / Reranker / Reward 模型（例如 Qwen3-Embedding，`causal = True`），`get_attention_mask` 返回 `2048×2048` 布尔因果掩码，照常走标准因果注意力通路，只看左文。
- **Atlas 300I DUO (`310P` 兼容后端)**：`310P` 底层注意力算子不接受 `mask = None`。因此在 `_310p/attention/attention_mask.py` 中覆写了同一接口：遇到 `runner_type == "pooling"` 且 `causal == False` 时，专门构造一张全零非屏蔽加性掩码，并用 `torch_npu.npu_format_cast(..., ACL_FORMAT_FRACTAL_NZ)` 转成分形排布后缓存复用。

### 2. 三类序列池化头与分块限制

跳过 `lm_head` 与采样器之后，形状为 `[N_total, H]` 的紧凑隐藏状态张量进入 `Pooler`（`PoolerConfig` 同时支持序列级 `CLS / LAST / MEAN` 与逐 token 级 `ALL / STEP`，以及末端激活函数 `PoolerNormalize`、`PoolerClassify`、`PoolerMultiLabelClassify`、`PoolerIdentity`）：

- **`CLSPool`（首词提取）**：直接切片取出每条请求第 0 个位置（`[CLS]`）的向量 `hidden_states[first_token_indices_gpu]`。常见于 BERT / BGE 系列。
- **`LastPool`（末词提取）**：切片取出每条请求最后一个有效 token 的向量 `hidden_states[last_token_indices_gpu]`。因为因果注意力下只有最后一个位置汇聚了整句上下文，几乎所有 Decoder 底座的 Embedding 与 Reward 模型都选 `LAST`。
- **`MeanPool`（全句均值）**：将同属一条请求的所有 token 向量转成 `FP32` 累加后再除以该句长度 $L_i$：

$$h_{\text{pool}}^{(i)} = \frac{1}{L_i} \sum_{t=1}^{L_i} h_{i,t}, \qquad \hat{h}^{(i)} = \frac{h_{\text{pool}}^{(i)}}{\|h_{\text{pool}}^{(i)}\|_2}$$

为了避免大 batch、长文本下一次性转 `FP32` 撑爆显存，vLLM 的 `MeanPool` 按固定 `16 MiB` 块大小（`_MEAN_POOL_ACCUMULATION_CHUNK_BYTES`）分段调用 `segment_sums.index_add_` 累加。例如隐维 $H = 4096$、`FP32` 每 token 占 `16 KiB`，每块正好处理 $16\text{ MiB} / 16\text{ KiB} = 1024$ 个 token。

**一条极易踩坑的分块约束**：`CLSPool.forward` 与 `MeanPool.forward` 入口都会检查 `pooling_cursor.is_partial_prefill()`——一旦请求被 Chunked Prefill 拆成半截执行，两者都会立即抛出 `RuntimeError`！原因很直观：如果只算了前半段或后半段，要么拿不到完整均值、要么首词已被切在上一批。只有 `LastPool` 能在完整因果 KV 支撑下与分块前向协同；调度器也会专门保护非分块池化请求不被拆半。

## Encoder-Decoder 与 Whisper ASR 路径

另一类典型的非纯自回归解码模型是 **Encoder-Decoder**（以语音识别模型 **Whisper** 为代表，`model_config.is_encoder_decoder == True`）。它在推理引擎里分两段协同：

1. **音频编码段（Encoder）**：输入音频梅尔频谱经 CNN 与双向 Transformer 编码器算出定长或变长声学特征序列（例如 Whisper 30 秒音频对应 `1500` 帧编码特征）。
2. **交叉注意力解码段（Cross-Attention + Decoder）**：在首轮解码前，编码器输出经投影写入专属于 `AttentionType.ENCODER_DECODER` 的交叉注意力 KV Cache 槽位。注意 `vllm_ascend/attention/attention_v1.py` 中的关键特判：常规自注意力写入缓存时会把 `key`、`value` 和 `slots` 按 `[:attn_metadata.num_actual_tokens]` 截断成当前解码步长，但交叉注意力缓存装的是**整段编码器输出**而非当前解码 token，因此当 `self.attn_type == AttentionType.ENCODER_DECODER` 时必须保留完整 `key / value / slots` 写入，绝不能按解码步长截断。
3. **昇腾图模式自动降级**：由于编码器与解码器长度解耦且交叉注意力路径未接入全图捕获，`vllm_ascend/platform.py` 在配置检查阶段会自动拦截：`is_encoder_decoder` 为真且 `cudagraph_mode` 不是 `NONE` 或 `PIECEWISE` 时，直接回退为 `PIECEWISE`（开了 `VLLM_COMPILE` 时）或 `NONE`（未开编译时），并打印一次日志提示。

## 常见误解

- **「Embedding 模型也算 Transformer，所以推理开销和对话模型一样受限于 Decode 带宽墙？」**：错。Embedding / Reranker 走 `--runner pooling` 只跑 1 轮全序列前向就结束，没有逐字 Decode 循环，算术强度高、属于典型的**计算受限（Compute-bound）**负载，调优重点是拉大并发批 token 数而非压低单步 Decode 时延。
- **「给 BERT / BGE 双向模型传全 1 或因果掩码没关系，反正 Pooler 只取第一个词？」**：错。若误传因果掩码，第 0 个 `[CLS]` 位置只能看见它自己、完全看不见后面的句子正文，导致所有输入算出的向量几乎一模一样；A2/A3/950DT 上双向池化必须让 `get_attention_mask` 返回 `None` 并走 `npu_fusion_attention`。
- **「所有池化模型都可以随意配合 Chunked Prefill 把超长文本切成小块算？」**：错。`CLSPool` 与 `MeanPool` 遇到 `is_partial_prefill()` 会直接抛 `RuntimeError`，必须整句一次完成前向；部署长文池化时需确保 `max_num_batched_tokens` 不小于单条最大长度。
- **「Whisper 这类 Encoder-Decoder 模型在昇腾上开 `FULL_DECODE_ONLY` 全图模式能提速？」**：错。`vllm-ascend` 平台检查会主动将 `is_encoder_decoder` 模型的全图模式降级回 `PIECEWISE` 或 `NONE`，强配全图不会生效。

## 对照源码

### 怎么开

- **启动 Embedding / Reranker / Reward 池化服务**：在 `vllm serve` 中指定 `--runner pooling`（多数标准架构亦可留默认 `--runner auto` 自动识别），并通过 `--pooler-config '{"pooling_type": "MEAN", "normalize": true}'` 按需覆盖模型默认池化策略；调用方请求 `/v1/embeddings`、`/v1/score`、`/v1/rerank` 或 `/pooling` 接口。
- **启动 Whisper 等 Encoder-Decoder 服务**：直接传入 Whisper 模型路径，引擎自动识别 `is_encoder_decoder = True`，并在昇腾上自动将图模式收敛到 `PIECEWISE` 或 `NONE`，无需手动屏蔽全图。

### 会报什么错

| 拦截位置 | 触发条件 | 实际报错或行为 |
|---|---|---|
| `ModelConfig` 初始化校验 | 对不支持池化的纯生成模型强制指定 `--runner pooling` | 抛出配置校验错误提示该模型不支持 `--runner pooling` |
| `CLSPool.forward` / `MeanPool.forward` | 请求被分块预填充切成了不完整片段（`is_partial_prefill()`） | 抛出 `RuntimeError: partial prefill is not supported with CLS/MEAN pooling` |
| `NPUPlatform` 图模式检查 | `is_encoder_decoder=True` 且配置了 `FULL` / `FULL_DECODE_ONLY` | 不报错，打印日志并自动降级回 `PIECEWISE` 或 `NONE` |

### 版本差异

| 核验维度 | `v0.23.0 (2c59ff10)` | `v0.26.0rc (2ed6cbba)` | `v0.30.0 (c09d3e20)` | `main (8d6180e2)` |
|---|---|---|---|---|
| 昇腾 Pooling 注意力掩码 | `attention_mask.py` 已有 `pooling` 分支与 `310P` 显式 NZ 非因果掩码 | 延续双向 `None` + `npu_fusion_attention` 与 `310P` NZ 掩码 | 保持 `A2/A3/950DT` 双向返回 `None`、`310P` 显式 NZ 掩码，并在 `worker/v2/attn_utils.py` 同步支持 MRV2 `pooling` 路径 | 延续四族硬件掩码分流，并在 `attention_v1.py` 细化 `pooling` 非因果分支判据 |
| `Encoder-Decoder` 交叉注意力与图模式 | `platform.py` 已强制降级至 `PIECEWISE` / `NONE`；`attention_v1.py` 特判 `ENCODER_DECODER` 不按解码步截断 KV | 与 `v0.23.0` 一致 | 延续 `PIECEWISE` / `NONE` 降级，并在 `recompute_scheduler`、`dyntra_lb_scheduler` 等自定义调度器补齐 `is_encoder_decoder` 保护 | 保持同样降级规则与交叉注意力缓存语义（`platform.py:1412`） |

### 源码位置

以下编号与页首 `sources` 列表一一对应：

- **算法原论文与推导**：BERT 双向编码器与 `[CLS]` 句表示范式见 Devlin 等论文 [S1]；Whisper 语音 Encoder-Decoder 架构见 Radford 等论文 [S2]。文中 `MeanPool` 均值归一化公式与隐维 `4096` 下 `16 MiB` 分块对应 `1024` token 的容量核算按源码常量直接推导 [D]。
- **上游 Pooling 配置与池化头**：`PoolerConfig` 的序列级 `CLS / LAST / MEAN` 与词级 `ALL / STEP` 定义见 `vllm/config/pooler.py:16-65` [C3]；`CLSPool`、`LastPool`、`MeanPool`（含 `16 MiB` 分块与 `is_partial_prefill()` 拦截）见 `pooler/seqwise/methods.py:21-119` [C4]；末端归一化与分类激活见 `pooler/activations.py:79-125` [C5]；`--runner pooling` 入口校验见 `vllm/config/model.py:668-686` [C6]。
- **昇腾掩码分岔、融合算子与 Encoder-Decoder 适配**：A2/A3/950DT 双向 `causal=False` 返回 `None` 与因果 `pooling` 掩码见 `attention_mask.py:57-70` [C7]；`310P` 显式构造 `FRACTAL_NZ` 非因果掩码见 `_310p/attention/attention_mask.py:139-168` [C8]；双向池化调用 `torch_npu.npu_fusion_attention`、`ENCODER_DECODER` 保留整段交叉注意力 KV 以及 `forward` 分流见 `attention_v1.py` 对应三段 [C9][C10][C11]；`model_runner_v1` 跳过 `compute_logits` 直入 `self._pool()` 见 `model_runner_v1.py:2624-2638` [C12]；`is_encoder_decoder` 图模式强制降级 `PIECEWISE / NONE` 见 `platform.py:1231-1247` [C13]。
- **跨版本核验锚点**：`v0.23.0` 与 `v0.26.0rc` 的掩码分支及 `main` 的 `is_encoder_decoder` 降级锚点分别见三分支源码 [C14][C15][C16]；经四版本树对照，两类路径核心行为在四个基线间保持稳定兼容 [D]。
