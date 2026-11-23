---
id: hf-model-anatomy
title: 读懂 HuggingFace 模型目录与 config.json：从字段认清架构、显存与坑点
type: concept
origin: direct
summary: >-
  启动 vllm serve 前，拆解 HF 模型目录里的 config.json、tokenizer_config.json、safetensors 索引与 generation_config.json，对照 Qwen3-8B 与 Qwen3-30B-A3B 算清架构、权重与每 token KV 占用，并提前排查 head_dim、长度截断与量化陷阱。
aliases:
  - config.json
  - HuggingFace 模型目录
  - HF 模型目录
  - model.safetensors
  - model.safetensors.index.json
  - tokenizer_config.json
  - generation_config.json
  - safetensors
  - 模型配置文件
  - 权重文件结构
  - 模型目录结构
  - tie_word_embeddings
  - architectures
  - model_type
chapters:
  - '01'
order: 15
sources:
  - 'vllm@ced6857a:docs/models/supported_models.md#L1-L80'
  - 'vllm-ascend@c09d3e20:docs/source/user_guide/support_matrix/supported_models.md#L1-L151'
  - 'vllm@ced6857a:vllm/transformers_utils/config.py#L398-L416'
  - 'vllm@ced6857a:vllm/transformers_utils/config.py#L757-L860'
  - 'vllm@ced6857a:vllm/transformers_utils/config.py#L1138-L1182'
  - 'vllm@ced6857a:vllm/transformers_utils/model_arch_config_convertor.py#L68-L216'
  - 'vllm@ced6857a:vllm/transformers_utils/model_arch_config_convertor.py#L218-L265'
  - 'vllm@ced6857a:vllm/config/model.py#L1130-L1157'
  - 'vllm@ced6857a:vllm/config/model.py#L1258-L1340'
  - 'vllm@ced6857a:vllm/config/model.py#L2277-L2367'
  - 'vllm@ced6857a:vllm/config/model.py#L2393-L2505'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/weight_utils.py#L610-L637'
  - 'vllm@ced6857a:vllm/model_executor/model_loader/default_loader.py#L180-L243'
  - 'vllm@ced6857a:vllm/renderers/hf.py#L263-L315'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3.py#L99-L102'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3.py#L298-L306'
  - 'vllm@ced6857a:vllm/model_executor/models/qwen3_moe.py#L376-L396'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/utils.py#L155-L215'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/configs/modelslim_config.py#L109-L115'
  - 'vllm-ascend@c09d3e20:vllm_ascend/quantization/configs/fp8_config.py#L26-L60'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/utils.py#L112-L139'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/quantization/utils.py#L112-L139'
  - 'vllm-ascend@8d6180e2:vllm_ascend/quantization/utils.py#L137-L168'
  - 'vllm-ascend@2c59ff10:vllm_ascend/quantization/modelslim_config.py#L67-L70'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/quantization/modelslim_config.py#L59-L62'
  - 'vllm-ascend@8d6180e2:vllm_ascend/quantization/configs/modelslim_config.py#L163-L166'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: request-overview
    kind: builds-on
    note: 先通过请求全景理解词表、层数、隐藏维度和 KV cache 在推理中的作用，再回过头看它们在模型目录里的具体数值定义
  - to: token
    kind: builds-on
    note: tokenizer.json、tokenizer_config.json 与 chat_template 如何把对话渲染并切成 token 编号，详见 token 页
contradicts: []
updated: '2026-11-18'
---

一个 HuggingFace 模型仓库本质上由「几 MB 的 JSON 说明书」和「几十 GiB 的 `.safetensors` 权重文件」两部分组成。在下载几十 GiB 权重或敲下 `vllm serve` 之前，先拆开目录里的几份轻量配置文件，就能直接算出模型架构、所需 NPU 显存、每 token 的 KV cache 占用，并提前避开启动报错与静音降级。

## 为什么启动服务前要先看模型目录

在 `vllm-ascend@c09d3e20`（配套 `vllm@ced6857a`）主基线下，`vllm serve` 初始化模型配置时并不需要先把所有权重矩阵搬进设备显存，而是先读取目录顶层的几份 JSON 文件。哪怕此时本地还没拉取几十 GiB 的 `.safetensors` 分片，仅看这几份不到几 MB 的配置文件，就能在几秒内完成四项部署初筛：

1. **架构是否受支持**：确认 `architectures` 和 `model_type` 是否命中当前版本 `vllm` 与 `vllm-ascend` 已适配的模型类，避免权重下载完才报模型未注册。
2. **显存和卡数是否够用**：用层数、隐藏维度、注意力头数、词表大小与精度算出纯权重静态占用和每 token 的 [KV cache](kv-cache.md)（保存历史键和值向量的缓存）增量，先判断单卡能否放下、是否必须切多卡并行。
3. **分词与上下文长度是否异常**：核对对话模板 `chat_template` 是否齐备，并检查 `tokenizer_config.json` 里的 `model_max_length` 有没有悄悄把模型原本支持的上下文长度截短。
4. **量化格式与昇腾路径是否匹配**：分辨目录走 `config.json` 内嵌的 `quantization_config`（如 `compressed-tensors` 或原生 `fp8`），还是昇腾 ModelSlim 导出的 `quant_model_description.json`。提前核对能防止启动时因格式不兼容直接拒载。

## 模型目录文件地图：启动时谁读哪份文件

走进标准 HuggingFace 模型目录，决定推理行为的文件可归为五类。最外层是几份不到几 MB、文本编辑器就能读懂的 JSON 与 Jinja「建筑蓝图」；深处则是装满几十 GiB 张量的 `.safetensors`「权重金库」与分片索引。先通过立体拆解剖面建立五类文件的空间直觉：

```wiki-diagram
file: hf-plate-folder-cutaway
```

对照上面的物理拆解，再把五类文件名精确落到 `vllm` 与 `vllm-ascend` 启动代码里的读取函数与四处常见报错分支上：

```wiki-diagram
file: hf-directory-file-map
```

顺着图中的五条读取路径逐项核对，各类文件记录的内容、读取入口与异常后果如下：

| 目录文件 | 它描述什么 | 启动时由谁读取 | 缺失或异常时的典型后果 |
| --- | --- | --- | --- |
| `config.json`（Mistral 格式用 `params.json`；多模态模型语言侧常放在 `text_config` 下） | 模型类名、层数、隐藏维度、注意力与 MoE 参数、词表大小、精度 `torch_dtype`、可选的 `quantization_config` | `vllm` 配置加载器 `get_config` 与架构转换器 `ModelArchitectureConfig` | 缺失直接报错退出；缺少 `architectures` 时尝试按 `model_type` 映射或要求传入 `--hf-overrides` |
| `tokenizer.json` / `tokenizer.model`、`tokenizer_config.json`、可选 `chat_template.jinja` | 子词切分规则、特殊控制符编号（如 `bos_token_id`、`eos_token_id`）、对话 Jinja 模板与 `model_max_length` | `vllm` 分词器包装、`resolve_chat_template` 与 `_get_and_verify_max_len` | 无 `chat_template` 时调用 `/v1/chat/completions` 报错；`model_max_length` 过小会悄悄截断 `max_model_len` |
| `model.safetensors` 或 `model-00001-of-NNNNN.safetensors` 与 `model.safetensors.index.json` | 真实模型权重张量；索引文件通过 `weight_map` 记录每个张量名落在哪个分片文件 | `DefaultModelLoader` 与 `filter_duplicate_safetensors_files` | 索引记录的分片缺任一个即抛出 `FileNotFoundError`；同时存在合并权重与分片时会靠索引剔除重复项 |
| `generation_config.json` | 模型出厂默认的采样超参数（`temperature`、`top_p`、`top_k`、`eos_token_id` 等） | `try_get_generation_config`（缺失时尝试从 `config.json` 构造） | 请求未传采样参数时会静音沿用该文件默认值，而不是框架内置默认值 |
| `quantization_config`（内嵌或旧版 `hf_quant_config.json`）或 `quant_model_description.json` | 量化位宽、分组大小、激活缩放方式与逐层量化开关 | `vllm` `_verify_quantization` 与 `vllm-ascend` `maybe_auto_detect_quantization` / `detect_quantization_method` | 存在 `quant_model_description.json` 时自动触发 `--quantization ascend`；原生 `fp8` 缺少逐块参数会报 `NotImplementedError` |

在[一次请求全景鸟瞰](request-overview.md)里看到的四件运行时大事——切出 token（分词器输出的离散整数编号）、逐层前向与读写 KV cache、末尾投影采样、最后还原文字——它们的张量尺寸和行为开关，几乎全部在启动阶段从这五类文件里确定下来；其中分词词表与对话模板的切分细节可进一步对照 [token](token.md)。

## 逐个读懂 config.json：用 Qwen3-8B 与 Qwen3-30B-A3B 算清架构与显存

把 `config.json` 按「它回答什么工程问题」分成六组来读，远比按字母顺序背字段有效。下面我们用全站 `v0.30.0` 主基线的两个标准模型——稠密模型 `Qwen3-8B` 和稀疏混合专家（MoE）模型 `Qwen3-30B-A3B`——以及共享词表的对照模型 `Qwen3-0.6B`，把每一组字段的含义与隐藏陷阱拆透。

### 身份与模型族：architectures、model_type 与多模态 text_config

打开 `config.json`，先看 `architectures` 和 `model_type` 这两个身份字段：

- `Qwen3-8B` 写着 `"architectures": ["Qwen3ForCausalLM"]` 与 `"model_type": "qwen3"`，表示它是标准的稠密因果语言模型；
- `Qwen3-30B-A3B` 写着 `"architectures": ["Qwen3MoeForCausalLM"]` 与 `"model_type": "qwen3_moe"`，表示每层前馈部分换成了稀疏路由的多专家结构。

`vllm` 启动时首选 `architectures` 列表里的类名来定位模型实现。如果某些第三方导出的 `config.json` 漏掉了顶层 `architectures` 字段，`get_config` 会尝试根据 `model_type` 去模型映射表里补齐；若映射表也查不到，就必须由用户通过 `--hf-overrides` 显式指明架构类。对于图文或多模态模型，语言模型主干的层数、隐藏维度和注意力头数往往套在子对象 `text_config` 里，`vllm` 会通过 `get_hf_text_config` 把它解包出来，再交给文本模型配置校验。

```wiki-diagram
file: hf-fig-identity-unpack
```

### 核心尺寸与 GQA：head_dim 不一定等于 hidden_size ÷ num_attention_heads

接下来决定每层矩阵乘形状和注意力结构的是六个核心尺寸字段：

- `hidden_size`（记为 $H$）：隐藏向量（hidden，模型在层与层之间传递的中间表示向量）的长度。
- `num_hidden_layers`（记为 $L$）：Transformer 层重复堆叠的层数。
- `num_attention_heads`（记为 $n_q$）：attention head（注意力头）中的查询（Q）头数。
- `num_key_value_heads`（记为 $n_{\text{kv}}$）：键（K）和值（V）的头数。当 $n_{\text{kv}} < n_q$ 且大于 1 时，多个 Q 头共享同一组 KV 头，即 GQA（分组查询注意力，机制见 [GQA](gqa.md)）；如果 `config.json` 省去了该字段，解析器默认令 $n_{\text{kv}} = n_q$，退回标准多头注意力（MHA）。
- `head_dim`（记为 $d_h$）：单个注意力头里每个 Q、K、V 向量的维度长度。
- `intermediate_size`（记为 $I$）：稠密 MLP（前馈网络）中间层扩展后的宽度。在 Qwen3 系列的 SwiGLU 门控结构里，每层稠密 MLP 包含 `gate_proj`、`up_proj` 和 `down_proj` 三个线性矩阵。

读这一组字段时，最容易踩中一个 **2 倍算账陷阱**：很多人习惯套用旧公式 $d_h = H / n_q$ 反推单头维度，在 `Qwen3-30B-A3B` 上会直接算错一倍。它的 `hidden_size` 是 `2048`、`num_attention_heads` 是 `32`，按旧公式算出的商是 `64`；但 `config.json` 显式写了 `"head_dim": 128`，因此 $n_q \times d_h = 32 \times 128 = 4096$，并不等于 `hidden_size`（`2048`）。

在 `vllm` 的 `ModelArchConfigConvertorBase.get_head_size` 与 `Qwen3Attention` 中，引擎优先读取显式且大于 0 的 `head_dim`（同时用来构造 `q_norm` 和 `k_norm`）；仅当它缺失或为 0 时才回落到 `hidden_size // num_attention_heads`。若部署前估算时错用 `64` 代替 `128`，算出的 `q/k/v/o_proj` 参数量与每 token KV cache 字节数都会整整少算一半。

```wiki-diagram
file: hf-fig-headdim-trap
```

### MoE 字段：总参数装进显存，激活参数决定单步算力

当 `model_type` 为 `"qwen3_moe"` 时，前馈网络从单个大 MLP 变成了一组专家和一套路由网络（MoE，混合专家，机制见 [MoE](moe.md)）。`Qwen3-30B-A3B` 新增了五个关键字段来刻画这层结构：

- `num_experts`（`128`）：每层里总共存放的路由专家数量（routed experts，即供路由挑选的整个专家池）。
- `num_experts_per_tok`（`8`）：每个 token 在每一层实际被 router（路由器，决定把 token 送往哪些专家的小网络）选中的专家个数 $k$。
- `moe_intermediate_size`（`768`）：单个专家内部前馈投影的中间宽度。
- `decoder_sparse_step`（`1`）与 `mlp_only_layers`（`[]`）：共同决定第 $i$ 层（从 0 开始编号）是 MoE 层还是退回稠密 MLP 层。在 `Qwen3MoeDecoderLayer` 中，当且仅当同时满足下面三个条件时，第 $i$ 层才构造稀疏 MoE 模块，否则仍使用 `intermediate_size` 构造普通稠密 MLP：

$$i \notin \text{mlp\_only\_layers}, \quad \text{num\_experts} > 0, \quad (i + 1) \bmod \text{decoder\_sparse\_step} = 0$$

对照 `Qwen3-30B-A3B` 的配置，`mlp_only_layers` 为空且 `decoder_sparse_step = 1`，全部 48 层都是 MoE 层。理解 MoE 时必须把**总参数量**与**激活参数量**分开算账：单步推理虽只经过 8 个选中专家（激活参数 `3.35B`），决定单步算力；但加载时无法预知路由，128 个专家权重（总参数 `30.53B`，BF16 下 `56.87 GiB`）必须全部常驻显存，32 GiB 单卡根本装不下。反过来，因它的 `num_key_value_heads` 只有 `4`，即便有 `48` 层，每 token BF16 KV cache 也只有 `96.0 KiB`，比 `Qwen3-8B`（`144.0 KiB/token`）更省缓存。

```wiki-diagram
file: hf-fig-moe-gate-and-bars
```

### 词表与首尾共享：vocab_size、tie_word_embeddings 与权重核对

模型的首尾两头由 `vocab_size`（记为 $V$）和 `tie_word_embeddings` 控制。`vocab_size` 是词表总行数，同时决定前端查表的 `embed_tokens` 矩阵和末端打分的 `lm_head` 矩阵各有多少行（原理见 [embedding](embedding.md) 与 [lm_head](lm-head.md)）。当 `tie_word_embeddings` 为 `true` 时，首尾共享同一份 $V \times H$ 权重，省掉整整一张输出头表；为 `false` 时，首尾各自独立保存一份。

在 Qwen3 三个预设里，`Qwen3-8B` 和 `Qwen3-30B-A3B` 的 `tie_word_embeddings` 均为 `false`。仅首尾两张表就在 `Qwen3-8B` 里合占 $2 \times 151,936 \times 4,096 = 1,244,659,712$ 个参数（约 `1.24B`，BF16 下 `2.32 GiB`）。轻量模型 `Qwen3-0.6B`（`hidden_size = 1024`）则设为 `true`，省去约 `0.16B` 参数，使总参数收敛到 `0.60B`（不含嵌入层 `0.44B`）。

`vllm@ced6857a`（`v0.30.0` 基线）新增了 `maybe_untie_word_embeddings` 保护。有些微调模型在 `config.json` 沿用 `tie_word_embeddings: true`，检查点里却带了独立 `lm_head` 张量，强行共享会将其静默丢弃。`v0.30.0+` 会在加载前探测权重文件：发现独立 `lm_head` 时先临时改 `false` 把两份都载入，加载完再比对数值是否相等并决定是否重新合并（`v0.23.0` 与 `v0.26.0rc` 无此保护）。

```wiki-diagram
file: hf-fig-tie-and-untie
```

### 上下文长度与位置编码：max_position_embeddings、rope_theta 与 rope_scaling

`max_position_embeddings` 给出位置编码基准上限（三个 Qwen3 预设均为 `40960`），`rope_theta` 设定 [RoPE（旋转位置编码）](rope.md) 的基础底频（`1000000`）。当长上下文模型配置了 `rope_scaling`（较新 Transformers 中也可能归一化为 `rope_parameters`）时，`vllm` 的 `_get_and_verify_max_len` 并非一律乘以 `factor`：

- **`linear`、`dynamic` 等传统缩放**：把推导出的最大长度乘以 `factor`（若配置误把 `factor` 写成 `null`，打印警告并回落为 `1.0`）。
- **`yarn`、`su`、`longrope`、`llama3`、`deepseek_yarn`、`deepseek_llama_scaling` 及 `gemma3`**：`vllm` 认为 `max_position_embeddings` 已是扩展后长度，**不再二次乘 `factor`**。此外对于 `longrope`，若未显式指定 `--max-model-len`（或传 `-1`），引擎默认回退到 `original_max_position_embeddings`，避免短上下文精度下降。

```wiki-diagram
file: hf-fig-rope-scaling
```

### 精度与量化：torch_dtype / dtype 与昇腾量化检查

`torch_dtype`（或部分配置里的 `dtype`）说明权重默认保存的数值类型。三个 Qwen3 预设里都写着 `"bfloat16"`，也就是每个参数占 `2` 字节的 BF16（16 位脑浮点）。如果一份 `config.json`（以及多模态子配置）完全漏写了精度字段，`vllm` 会主动去扫描 `.safetensors` 文件头里的张量元信息，按可广播公共精度推断出真实 dtype；连元数据也没有时才回落为 `torch.float32`。启动服务使用默认的 `--dtype auto` 时，若检测到权重精度是 `float32`，引擎会自动把它降精度（downcast）到当前硬件平台的首选精度（如 NPU 上的 BF16 或 FP16）。

当模型经过量化（quantization，把权重或激活压到更低位宽以减少显存和提升算力利用，原理见 [quantization](quantization.md)）时，目录里会出现两条截然不同的识别路径：

- **通用 HF / vLLM 量化路径**：`config.json` 里带有 `quantization_config` 字典（ModelOpt 0.29 及以前则是同目录的 `hf_quant_config.json`），由 `quant_method` 指明方案（如 `compressed-tensors` 或 `fp8`）。
- **昇腾 ModelSlim 路径**：模型由昇腾 ModelSlim 导出时，目录下会多出 `quant_model_description.json`。`vllm-ascend@c09d3e20` 检测到该文件就会把量化方式自动识别为 `"ascend"`（等效于 `--quantization ascend`）；未检测到时才继续检查 `quantization_config.quant_method` 是否为 `"compressed-tensors"` 或 `"fp8"`。

需要特别警惕原生 `fp8` 权重在昇腾上的格式限制：`vllm-ascend@c09d3e20` 的 `AscendFp8Config` 只支持**按权重块（block-wise）缩放且动态激活**的原生 FP8（必须含 `weight_block_size` 且 `activation_scheme == "dynamic"`）。拿到 per-tensor 或 per-channel 原生 FP8 时，启动校验直接抛 `NotImplementedError`，提示改用 ModelSlim 或 `llm-compressor` 重新量化。

```wiki-diagram
file: hf-fig-dtype-and-quant
```

### 完整算账对照：Qwen3-8B vs Qwen3-30B-A3B

把全部字段拼成总账前，先把 `Qwen3-30B-A3B` 的整座前向通道剖开，和 `Qwen3-8B` 做一次空间对照。一个 token 从首端 `EMBED` 进入，穿过显式 `head_dim = 128` 的 `32Q:4KV` 注意力后，由 `ROUTER` 在 `128` 间常驻专家机房里单步仅点亮 `8` 间，最后送入独立 `LM_HEAD`：

```wiki-diagram
file: hf-plate-moe-cutaway
```

把上面所有字段拼回整张表，对照本站单真源模型解析规格（按 `config.json` 静态推导，按 BF16 每参数 2 字节计，不含前向激活、工作区与 CANN 运行时额外占用），三个预设模型的账目如下：

| 配置与派生指标 | `Qwen3-8B` | `Qwen3-30B-A3B` | `Qwen3-0.6B`（对照） |
| --- | --- | --- | --- |
| `architectures` / `model_type` | `Qwen3ForCausalLM` / `qwen3` | `Qwen3MoeForCausalLM` / `qwen3_moe` | `Qwen3ForCausalLM` / `qwen3` |
| 层数 `num_hidden_layers` ($L$) | `36` | `48` | `28` |
| 隐藏维度 `hidden_size` ($H$) | `4096` | `2048` | `1024` |
| Q 头数 / KV 头数 / `head_dim` | `32` / `8` / `128` | `32` / `4` / `128`（非 `2048/32`） | `16` / `8` / `128` |
| MLP / MoE 维度 | 稠密 `I = 12288` | `128` 选 `8`，单专家 `I_moe = 768` | 稠密 `I = 3072` |
| `vocab_size` / `tie_word_embeddings` | `151936` / `false` | `151936` / `false` | `151936` / `true` |
| 总参数量 / 单 token 激活参数 | `8.19B` / `8.19B` | `30.53B` / `3.35B` | `0.60B` / `0.60B` |
| BF16 纯权重占用 | `15.26 GiB` | `56.87 GiB` | `1.11 GiB` |
| 每 token BF16 KV cache（全层） | `144.0 KiB` | `96.0 KiB` | `112.0 KiB` |

把 `Qwen3-8B` 与 `Qwen3-30B-A3B` 并排画开，两组反差一目了然。在注意力层，`30B-A3B` 用 `32` 个 Q 头乘显式 `head_dim = 128` 得到 `4096`（不等于 `H = 2048`），KV 头却减半到了 `4` 个。在前馈层与显存条上，128 个专家把静态权重推高到 `56.87 GiB`，单步却只点亮 8 个专家，每 token 全层 KV cache 反而比 `8B` 短三分之一：

```wiki-diagram
file: hf-qwen3-dense-vs-moe-anatomy
```

从代数上看，标准因果语言模型的总参数由词嵌入、$L$ 层注意力与前馈、末层 `model.norm` 以及独立 `lm_head` 五块相加（`tie_word_embeddings=false` 时 $P_{\text{lm\_head}} = H \times V$，否则为 `0`）：

$$P_{\text{total}} = V \times H + L \times \bigl(P_{\text{attn}} + P_{\text{ffn}}\bigr) + H + P_{\text{lm\_head}}$$

每个 token 在全部 $L$ 层新增的 KV cache 字节数只由 K/V 两份张量、层数 $L$、KV 头数 $n_{\text{kv}}$、单头维度 $d_h$ 和元素字节数 $\text{bytes}$（BF16 为 `2`）决定，与专家数或词表大小无关：

$$\text{KV}_{\text{token}} = 2 \times L \times n_{\text{kv}} \times d_h \times \text{bytes}$$

把两款模型的字段代入上面两条公式（`Qwen3-30B-A3B` 的 `q/o_proj` 由 `32 × 128 = 4,096` 主导，加载按 `128` 专家算、单步算力按 `8` 专家算），分项对账如下：

| 拆解模块与静态指标 | `Qwen3-8B`（稠密 36 层，`H = 4,096`） | `Qwen3-30B-A3B`（稀疏 MoE 48 层，`H = 2,048`） |
| --- | --- | --- |
| 首端 `embed_tokens`（$V \times H$） | `151,936 × 4,096 = 622,329,856` | `151,936 × 2,048 = 311,164,928` |
| 单层 Attention（$P_{\text{attn}}$，含 `q_norm`/`k_norm`） | `41,947,392`（`q_dim = 4,096`，`kv_dim = 1,024`） | `18,876,672`（`q_dim = 4,096`，`kv_dim = 512`） |
| 单层前馈：全量驻留 | 稠密 MLP：`150,999,040` | 128 专家：`604,243,968` |
| 单层前馈：单步激活 | 同上：`150,999,040` | 8 专家：`38,012,928` |
| $L$ 层主体 + `model.norm` + 独立 `lm_head`（驻留） | `7,568,405,504` | `30,220,957,696` |
| $L$ 层主体 + `model.norm` + 独立 `lm_head`（单步激活） | `7,568,405,504` | `3,041,867,776` |
| 整模型总参数 | `8,190,735,360`（`≈ 8.19B`） | `30,532,122,624`（`≈ 30.53B`） |
| 单 token 激活参数 | `8,190,735,360`（`≈ 8.19B`） | `3,353,032,704`（`≈ 3.35B`） |
| BF16 纯权重静态显存（每参数 `2 B`） | `15.26 GiB`（`16,381,470,720 B`） | `56.87 GiB`（`61,064,245,248 B`） |
| 单层每 token BF16 KV cache | `4,096 B`（`2 × 8 × 128 × 2 B`） | `2,048 B`（`2 × 4 × 128 × 2 B`） |
| 全模型每 token BF16 KV cache | **`144.0 KiB`**（`36` 层） | **`96.0 KiB`**（`48` 层） |

有了这两组数字，启动前就能心里有底：哪怕不计激活与框架缓冲（详细试跑扣减见 [KV 显存划定](kv-cache-memory-profiling.md)），单张 32 GiB 卡跑 BF16 `Qwen3-30B-A3B` 加载期就会直接 OOM（显存溢出，Out of Memory）；而跑 BF16 `Qwen3-8B` 扣完 `15.26 GiB` 权重后仍能腾出可观显存给 KV cache。下面可用快速初筛台直接对照卡数门槛：

```wiki-tool
tool: deploy-calculator
mode: quick-screen
title: 部署算账台 · 快速初筛视图
summary: 对照 config.json 的层数、隐藏维度、KV 头数与 dtype，快速初筛单卡/多卡权重与每 token KV 显存门槛。
model: Qwen3-8B
```

## tokenizer_config.json、chat_template、分片与 generation_config 里的隐形坑

很多启动异常或输出跑偏并不是 `config.json` 引起的，而是躲在同目录另外四份配置文件里。先通过下面的四象限排查图一眼看清触发机制，再逐项核对边界条件：

```wiki-diagram
file: hf-fig-four-hidden-traps
```

1. **`chat_template` 四级回落链**：`resolve_chat_template` 依次检查 `--chat-template` → `AutoProcessor`（未传且未开工具调用时）→ `AutoTokenizer`（读 `tokenizer_config.json` 或独立 `chat_template.jinja`）→ `vllm` 内置模型名回落模板。若四级全为空（常见于裸预训练目录），服务能正常启动，但一收到对话补全请求就会触发模板解析失败。
2. **`model_max_length` 静音截断 `max_model_len`**：即便 `config.json` 里 `max_position_embeddings` 为 `40960`，`_get_and_verify_max_len` 仍会与 `tokenizer_config.json` 的 `model_max_length` 取较小值（$\min(\text{derived\_max\_model\_len}, \text{model\_max\_length})$）。打包目录误填 `4096` 或 `8192` 会悄悄压低默认上限；若显式传更大的 `--max-model-len`，引擎仍会校验 `hf_config` / 衍生上限，须修正该字段，或在超限场景配合 `VLLM_ALLOW_LONG_MAX_MODEL_LEN=1` 放行，否则仍抛 `ValueError`。
3. **`model.safetensors.index.json` 缺片与混合文件去重**：多片切分目录加载时，框架将 `weight_map` 记录的分片清单与磁盘扫描结果求差集；只要缺一片（如断点续传中断）立刻抛 `FileNotFoundError`。当仓库混放 `consolidated*.safetensors` 合并文件与分片文件时，vLLM 也正靠 `index.json` 剔除未入索引的重复文件避免双倍加载，切勿随意删掉索引。
4. **`generation_config.json` 静音改写默认采样参数与追加停词**：`try_get_generation_config` 读取该文件（缺失时回落 `config.json` 提取生成字段），其中的 `temperature`、`top_p`、`top_k`、`repetition_penalty` 会在请求未显式传参时生效（可通过请求体覆写或传 `--generation-config vllm` 切回框架默认）。而其中列出的额外 `eos_token_id` 在 `ignore_eos=False` 时会与请求 `stop_token_ids` **取并集**，单靠传入 `stop_token_ids` 无法屏蔽，须显式设 `ignore_eos=True` 或 `--generation-config vllm`（采样链路见 [sampling](sampling.md)）。

## 对照源码

### 怎么排查目录问题

在本地模型目录下，用只读命令几秒钟就能把关键字段一次打印齐，确认无误后再拉起 `vllm serve`：

```bash
# 1. 查看 JSON 元数据、量化描述文件与分片是否完整
ls -lh *.json *.jinja *.safetensors 2>/dev/null

# 2. 检查架构、尺寸、head_dim、dtype、MoE 与量化字段
python3 -c '
import json
c = json.load(open("config.json"))
tc = c.get("text_config", c)
keys = [
    "architectures", "model_type", "hidden_size", "num_hidden_layers",
    "num_attention_heads", "num_key_value_heads", "head_dim",
    "intermediate_size", "num_experts", "num_experts_per_tok",
    "moe_intermediate_size", "vocab_size", "tie_word_embeddings",
    "max_position_embeddings", "rope_scaling", "torch_dtype", "dtype",
    "quantization_config",
]
print({k: tc.get(k, c.get(k)) for k in keys if k in tc or k in c})
'

# 3. 检查分词最大长度截断、chat_template、默认采样参数与分片索引缺失
python3 -c '
import json, os
if os.path.exists("tokenizer_config.json"):
    t = json.load(open("tokenizer_config.json"))
    print("tokenizer model_max_length:", t.get("model_max_length"), "has chat_template:", bool(t.get("chat_template")))
if os.path.exists("generation_config.json"):
    print("generation_config:", json.load(open("generation_config.json")))
if os.path.exists("model.safetensors.index.json"):
    wm = json.load(open("model.safetensors.index.json"))["weight_map"]
    shards = sorted(set(wm.values()))
    missing = [s for s in shards if not os.path.exists(s)]
    print("index shards:", len(shards), "missing:", missing)
'
```

### 版本差异

下表对照四套固定仓库基准版本在模型目录解析与量化识别上的关键演进：

| 机制与目录检查项 | `v0.23.0`（`0fc695fc` / `2c59ff10`） | `v0.26.0rc`（`568afb3a` / `2ed6cbba`） | `v0.30.0`（`ced6857a` / `c09d3e20`，主基线） | `main`（`ba15685a` / `8d6180e2`） | 对排查与部署的影响 |
| --- | --- | --- | --- | --- | --- |
| `config.json` 缺 `dtype` 时推断 `.safetensors` 头 | 已有 `get_torch_dtype` 扫描 `.safetensors` 元数据回退逻辑 | 同左 | `config.py#L398-L416` 与 `model_arch_config_convertor.py#L218-L265` 统一从子配置与 `.safetensors` 头广播推断 | 延续相同推断与平台降精度链路 | 目录漏写 `torch_dtype` 时仍可推断真实权重精度，但缺 `.safetensors` 头时退回 `float32` |
| `tie_word_embeddings` 与检查点冲突纠偏 | 无此纠偏逻辑，直接按 `config.json` 决定是否绑定 | 无此纠偏逻辑 | 新增 `maybe_untie_word_embeddings`（`config/model.py#L1130-L1157`），探测存在 `lm_head` 时先解绑加载 | 延续该逻辑（位置移至 `#L1269-L1296`） | 微调权重若错配 `tie_word_embeddings: true` 与独立 `lm_head`，`v0.30.0+` 不再静默丢权重 |
| ModelSlim `quant_model_description.json` 自动识别 | `vllm_ascend/quantization/modelslim_config.py#L67-L70` 定义文件名，`utils.py#L112-L139` 检测 | `modelslim_config.py#L59-L62` 与 `utils.py#L112-L139` | 重构进 `configs/modelslim_config.py#L109-L115` 与 `utils.py#L155-L215` | 保持 `"ascend"` 自动识别，目录路径 `configs/modelslim_config.py#L163-L166` | 目录下出现 `quant_model_description.json` 仍会自动激活 `--quantization ascend` |
| `config.json` 内 `fp8` 与 `compressed-tensors` 检测 | `fp8` 自动识别强门控在 `AscendDeviceType.A5`（`utils.py#L132`） | 移除 `A5` 硬件门控（`utils.py#L132`） | `utils.py#L176-L185` 识别并由 `AscendFp8Config`（`fp8_config.py#L45-L60`）强制校验 `weight_block_size` + `dynamic` 激活 | `utils.py#L137-L168` 将 `config.json` 内的 `compressed-tensors` / `fp8` 识别交回上游 `vllm`，仅保留 ModelSlim 文件检测 | 原生 `fp8` 必须带逐块缩放参数与动态激活；`main` 精简了重复检测代码，行为一致 |

### 源码位置

- 模型架构支持列表与配置读取入口：上游支持模型说明 [S1]，昇腾支持矩阵文档 [S2]，`get_config` 识别 `config.json` / `params.json` / `hf_quant_config.json` 并按 `model_type` 补齐 `architectures` [C4]，无 `dtype` 时读取 `.safetensors` 元数据推断 [C3]，多模态 `get_hf_text_config` 与 `try_get_generation_config` 读取默认生成配置 [C5]。
- 维度优先级、词表解绑与最大长度截断：`ModelArchConfigConvertorBase.get_head_size` 优先读取显式 `head_dim`（防止 `Qwen3-30B-A3B` 算错 2 倍）[C6]，`maybe_untie_word_embeddings` 在检查点带 `lm_head` 时解除错误共享 [C8]，`_resolve_auto_dtype` 与 `_get_and_verify_dtype` 自动降精度逻辑 [C10]，`_get_and_verify_max_len` 对 `tokenizer_config.json["model_max_length"]` 取最小截断并区分 `rope_scaling` 缩放规则 [C11]。
- Qwen3 与 MoE 模型层实现：`Qwen3Attention` 使用 `head_dim` 构造 Q/K/V 大小 [C15]，`Qwen3ForCausalLM` 按 `tie_word_embeddings` 绑定或独立保留 `lm_head` [C16]，`Qwen3MoeDecoderLayer` 根据 `mlp_only_layers` 与 `decoder_sparse_step` 切换稀疏 MoE 层与稠密 MLP 层 [C17]。
- 分片索引与对话模板解析：`filter_duplicate_safetensors_files` 校验 `model.safetensors.index.json` 缺失分片并剔除混合重复文件 [C12]，`resolve_chat_template` 按四级优先级解析对话模板 [C14]。
- 昇腾量化目录检测与演进：`v0.30.0` 下 `detect_quantization_method` 检测 `quant_model_description.json` 与 `quantization_config` [C18]，`AscendFp8Config._verify_block_quantization` 拒绝非逐块或非动态激活的原生 FP8 检查点 [C20]；`v0.23.0` 与 `main` 上对应的检测逻辑与模块路径迁移记录 [C21]、[C23]。
- 算账数值推导与前提边界：`Qwen3-8B`（`8.19B` 参数 / `15.26 GiB` BF16 权重 / `144.0 KiB` 每 token KV）[D]、`Qwen3-30B-A3B`（`30.53B` 总参数 / `3.35B` 激活参数 / `56.87 GiB` BF16 权重 / `96.0 KiB` 每 token KV）[D] 与 `Qwen3-0.6B`（`0.60B` 参数 / 共享词表节省 `155,582,464` 参数）[D] 均由 `config.json` 张量形状严格展开；权重与 KV 占用字节数基于 BF16 每参数 2 字节且不含运行时激活、算子工作区与框架预留显存的静态假设 [A]；缺失分片或非逐块 FP8 会在进入模型计算前由校验逻辑拦截 [I]。
