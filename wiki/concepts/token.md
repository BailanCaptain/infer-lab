---
id: token
legacyAnchors:
  落到-glm-双机分词器词表和-r1-的入口: GLM-5.3-Flash 双机与 R1 案例边界：154880 词表与入口流转
  glm-的分词器是字节级-bpe: GLM-5.3-Flash 双机与 R1 案例边界：154880 词表与入口流转
  编号要落在-154880-行之内: GLM-5.3-Flash 双机与 R1 案例边界：154880 词表与入口流转
  r1-在入口拿到了什么: GLM-5.3-Flash 双机与 R1 案例边界：154880 词表与入口流转
  再交给某一个引擎等待调度: GLM-5.3-Flash 双机与 R1 案例边界：154880 词表与入口流转
title: Token 与分词：从文本消息、chat_template 到模型编号序列
type: concept
origin: gap
summary: >-
  Token 是模型用整数编号表示的文本基本单元。本页从子词权衡与字节级 BPE 合并讲起，串联 chat_template 渲染、增量反分词与
  Qwen3-8B 的 151936 词表校验，并对照特殊标记区间与 GLM 入口边界。
aliases:
  - 词元
  - 令牌
  - 字块
  - token id
  - 分词器
  - tokenizer
  - 分词
  - 词表
  - 对话模板
  - 聊天模板
  - chat template
  - BPE
  - Byte Pair Encoding
  - Tokenization
  - 字节级 BPE
  - '--tokenizer'
  - tokenizer_mode
  - tokenizer-mode
  - '--tokenizer-mode'
  - 分词器模式
  - chat_template
  - chat-template
  - '--chat-template'
  - limit_mm_per_prompt
  - '--limit-mm-per-prompt'
  - add_generation_prompt
  - add_special_tokens
  - continue_final_message
  - chat_template_kwargs
  - truncate_prompt_tokens
  - truncation_side
  - eos_token_id
  - bos_token_id
chapters:
  - '02'
order: 20
sources:
  - 'https://huggingface.co/docs/transformers/tokenizer_summary'
  - 'https://huggingface.co/docs/transformers/chat_templating'
  - 'https://arxiv.org/html/1508.07909v5'
  - 'https://huggingface.co/Qwen/Qwen3-8B/raw/main/config.json'
  - 'vllm@ced6857a:vllm/renderers/hf.py#L263-L315'
  - 'vllm@ced6857a:vllm/renderers/hf.py#L753-L885'
  - 'vllm@ced6857a:vllm/renderers/params.py#L170-L566'
  - 'vllm@ced6857a:vllm/tokenizers/registry.py#L33-L275'
  - 'vllm@ced6857a:vllm/tokenizers/hf.py#L115-L150'
  - 'vllm@ced6857a:vllm/v1/engine/input_processor.py#L354-L380'
  - 'vllm@ced6857a:vllm/v1/engine/input_processor.py#L440-L555'
  - 'vllm@ced6857a:vllm/v1/engine/detokenizer.py#L31-L180'
  - 'vllm@ced6857a:vllm/v1/engine/async_llm.py#L361-L525'
  - 'vllm@ced6857a:vllm/config/model.py#L78-L300'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L310-L610'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L1000-L1010'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/protocol.py#L84-L125'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/cli_args.py#L75-L105'
  - 'vllm@ced6857a:vllm/entrypoints/chat_utils.py#L1470-L1565'
  - 'vllm@ced6857a:vllm/config/multimodal.py#L88-L115'
  - 'vllm@ced6857a:vllm/multimodal/processing/context.py#L488-L545'
  - 'vllm@ced6857a:vllm/sampling_params.py#L690-L725'
  - 'vllm@ced6857a:vllm/v1/core/sched/utils.py#L94-L136'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L1279-L1470'
  - 'vllm@0fc695fc:vllm/v1/engine/input_processor.py#L314-L484'
  - 'vllm@0fc695fc:vllm/tokenizers/registry.py#L43-L182'
  - 'vllm@0fc695fc:vllm/renderers/hf.py#L694-L746'
  - 'vllm@0fc695fc:vllm/renderers/params.py#L28-L470'
  - 'vllm@568afb3a:vllm/renderers/hf.py#L699-L794'
  - 'vllm@568afb3a:vllm/tokenizers/registry.py#L41-L161'
  - 'vllm@568afb3a:vllm/renderers/params.py#L28-L480'
  - 'vllm@ba15685a:vllm/tokenizers/registry.py#L47-L186'
  - 'vllm@ba15685a:vllm/tokenizers/hf.py#L120-L147'
  - 'vllm@ba15685a:vllm/renderers/base.py#L453-L495'
  - 'vllm@ba15685a:vllm/renderers/hf.py#L854-L938'
  - 'vllm@ba15685a:vllm/v1/engine/input_processor.py#L463-L664'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L1030-L1140'
  - 'https://github.com/deepseek-ai/deepseek-recipe/blob/935817c66f5d6e64838f419692545f06787e485f/docs/tokenizer.md'
  - 'https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json'
  - 'https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/tokenizer.json'
  - 'https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/tokenizer_config.json'
  - 'https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/chat_template.jinja'
  - 'https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/generation_config.json'
  - 'https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L1344-L1426'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L814-L1225'
  - 'https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/models/bpe/model.rs#L475-L520'
  - 'https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/tokenizer/mod.rs#L890-L909'
  - 'https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/tokenizer/added_vocabulary.rs#L242-L316'
  - 'raw:sha256-b18efa9d5dec13007a53553772d09649b4147efc8d15d0b3344638b1ee728a21.md#L1-L1562'
  - 'raw:sha256-18af2b334f83526e141288bc158cd9c96a87167e8bdc8ee60da39ec7fca173f2.md#L1-L4362'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: request-overview
    kind: builds-on
    note: 承接请求全景鸟瞰的第 1 件事与第 4 件事，拆解真实模型怎样把对话渲染、切块成整数编号，又怎样把输出编号还原为文字
contradicts: []
updated: '2026-11-18'
rawSources:
  - raw/sha256-18af2b334f83526e141288bc158cd9c96a87167e8bdc8ee60da39ec7fca173f2.md
  - raw/sha256-a286cea73b40ebc9285e52549c14c6266494637fdb983122a87632839080a589.md
---

## Token 是什么？

**Token（词元）是模型处理文本的基本单位：一段文字在进入神经网络之前，先被切成一块块 token，每块到词表里查出一个整数编号（token ID），模型真正接收和生成的都是这一串整数编号。**

在[一次请求全景鸟瞰](request-overview.md)中我们已经看到，NPU 上的矩阵乘法只认一排排浮点数，不认「推」「理」这样的汉字字符。拿一句「推理引擎怎么工作」来看，文字进门的第一步就是切块与查号：

```wiki-diagram
file: token-intro
```

负责切块和查编号的程序叫**分词器（tokenizer）**。上图用教学示意设定把句子切成「推理」「引擎」「怎么」「工作」4 块，再到**词表（vocabulary）**（即「文本单元 ↔ 整数编号」的对照字典）里查出 `[9123, 40517, 2256, 1180]`。词表在训练分词器时定死，并与采用这套映射的模型权重配套发布（目录分布见 [HuggingFace 模型目录解剖](hf-model-anatomy.md#模型目录文件地图启动时谁读哪份文件)）；推理时必须用配套词表，否则同一个编号指代的就不再是训练时那块文字。

一块 token 不一定对应一个自然语言词语：它可以是常见词、子词片段、标点、空白，甚至半个汉字的几个字节。切出的 4 个 token 按顺序排在位置 `0`、`1`、`2`、`3`。**编号回答「这是词表里的哪一项」，位置回答「它在当前序列里排第几」**；同一个编号可在句子里反复出现，每次出现都占据独立位置。

整数编号本身只是词表里的“座位号”，不能直接做加减乘除。它的下一站是[嵌入（embedding）](embedding.md)：按编号从嵌入表里抽出一行浮点数向量，再送入后续各层的[矩阵乘](matmul-and-weights.md)。阅读源码与排查长度问题时，先把下面三个概念彻底分开：

| 对象 | 回答什么问题 | 在推理过程中怎样变化 |
| --- | --- | --- |
| Token ID（词元编号） | 这是词表字典里的哪一个单元？ | 离散整数；同一编号可在一条序列中重复出现多次 |
| 序列位置（`positions`） | 这个单元出现在当前序列的第几处？ | 从 `0` 起按顺序递增，与编号数值大小毫无关系 |
| 嵌入向量（embedding） | 模型第 1 层从哪一排浮点数开始算？ | 用编号查嵌入表得到初始向量；穿过各层后结合上下文不断变换 |

编号数值相近不代表词义相近，也不代表序列位置相邻。**此外，分词器记录的条目数与模型 `config.json` 的 `vocab_size` 不一定相等。** 像 `Qwen3-8B` 这类语言模型会在权重矩阵末尾预留额外行，部分多模态分词器也可能带有超出文本词表的媒体占位编号；判断编号能否合法送入模型，必须结合引擎的输入校验路径，不能只看单侧数字。

## 为什么不按整词或单个字切，而要切成子词？

**切得越粗，词表越大且总有收不全的新词；切得越细，词表虽小但序列会拉得很长。子词（subword）分词在两者之间取平衡：高频词和常用词根整块收入词表，低频或新造词拆成更小片段。** 能否彻底避免“未知词”，还取决于最小兜底单元是否完备：下文讲的字节级 BPE 用全部 `256` 种单字节兜底，而普通字符级子词分词器遇到未收录字符仍会退回未知标记。

词表行数（记为 $V$）与序列长度（记为 $S$）需要同时权衡，因为模型首尾与中间各层的开销分别由它们决定：

- **词表 $V$ 决定模型首尾两张大矩阵的行数**：输入端 `embed_tokens` 要给每个编号留一行，输出端 [lm_head](lm-head.md) 每步也要给全部 $V$ 项各算一个分数（[后文](#生成的编号怎样变回文字)细讲）。以标准主基线 `Qwen3-8B`（$V = 151,936$，$H = 4,096$，`tie_word_embeddings = false`）为例，首尾两张词表矩阵合计就占 $2 \times 151,936 \times 4,096 \approx 1.24\text{B}$ 参数。
- **序列长度 $S$ 决定前向要处理的位置数与历史缓存规模**：每个 token 占一个位置。在 `Qwen3-8B` 这类标准全注意力模型中，历史 K/V 存入 [KV cache](kv-cache.md)，占用随 $S$ 线性增长；而像 `GLM-5.3-Flash` 这类混合架构还包含固定状态大小的 [KDA 线性注意力层](linear-attention.md)，不能把所有层都按每位置一份估算。

还是拿「推理引擎怎么工作」这 `8` 个汉字（UTF-8 编码下常用汉字每字占 `3` 个字节，字节总量 $L_{\text{byte}} = 8 \times 3 = 24$）对比四种切分粒度：

| 切分粒度 | 本句切分结果（示意） | 切出的序列长度 $S$ | 词表规模 $V$ 与未登录词表现 |
| --- | --- | --- | --- |
| 按单字节切 | 24 个独立 UTF-8 字节 | `24` 个 token | 仅需 `256` 项即可拼出任意有效 UTF-8 文本，但序列膨胀 6 倍 |
| 按单字/字符切 | `推｜理｜引｜擎｜怎｜么｜工｜作` | `8` 个 token | 需收录数万至十余万字符，序列仍偏长 |
| 按子词切（主流方案） | `推理｜引擎｜怎么｜工作` | `4` 个 token | 十余万项（如 `Qwen3-8B` 为 `151,936`）；常见词成块、生僻字退回小片段 |
| 按完整词/短语切 | 若恰好收录「推理引擎」则仅 `3` 块 | `3` 个 token | 词表极度膨胀，遇到新造词、专名或拼写变体只能退回未知标记 |

主流大语言模型普遍采用子词分词，常见三类算法学习片段的准则不同。**BPE** 从最小单元出发，按相邻共现频次逐轮向上合并（Sennrich 等人最早将其引入神经机器翻译以消除稀有词瓶颈，下一节演示）；**WordPiece** 改用提升语料似然度的比值挑选合并对；**Unigram** 则从大词表出发逐步裁剪并按概率选切分方案。遇到生僻字符时究竟退回字节还是替换成未知标记，取决于具体分词器的配置。

## 字节级 BPE 怎样一步步切出 token？

**字节级 BPE（Byte-level Byte Pair Encoding，字节对编码）以单字节为最底层原子单元。** 它先按正则规则把原文预切分成互不跨越的小段，再在每段内转为 UTF-8 字节序列，对照合并优先级表反复把最优先的相邻块并成一块，最后逐块查词表得出编号。`Qwen3` 系列与后文对照的 `GLM-5.3-Flash` 均采用这一路线。

**第一步看底层原子：UTF-8 字节。** UTF-8 编码下，ASCII 英文、数字和半角标点各占 `1` 字节，常用汉字占 `3` 字节。每字节共 $2^8 = 256$ 种取值，常记作两位十六进制数——例如「推」是 `E6 8E A8`，「理」是 `E7 90 86`。字节级 BPE 把全部 `256` 个单字节收入基础词表，因此**任何合法 UTF-8 文本（哪怕是生僻字或 emoji）最差都能退回单字节表示，无须依赖未知词标记（`<unk>`）**。

**第二步看合并围栏：正则预切分（pre-tokenization）。** 合并前先按字符类别把文本切成独立小段，禁止跨段合并。常见规则如下：连续汉字与字母成段，数字按固定位数切开（`Qwen3` 按单数字切，`GLM-5.3-Flash` 按最多 `3` 位切），标点和空白单独成段，英文 `'s`/`'ll` 缩写单列，文字前紧邻的一个非换行空格或标点常并入后续段。按最多 3 位数字规则，「工作了2048秒。」预切成 `工作了`、`204`、`8`、`秒`、`。` 共 5 段；英文 `"hello world"` 分成 `"hello"` 与 `" world"`；「推理引擎怎么工作」8 个汉字落在同一段内。

**第三步看核心循环：按合并表优先级逐对归并。** 训练分词器时，算法统计语料中最常相邻的片段并注册为合并规则，行号越靠前优先级越高（`tokenizer.json` 只保存最终词表与合并表，不含原始语料）。推理时每轮都合并当前排名最靠前的一对，每合并 1 次总块数减 1。下图用示意规则放大「推理」两个字的合并全过程：

```wiki-diagram
file: token-bpe
```

顺着上图逐行核对：起点是 `E6 8E A8 E7 90 86` 共 `6` 个单字节块。第 1 轮 `E6 + 8E` 命中优先级最高的规则 1，并成 `E6 8E`（剩 `5` 块）；第 2 轮 `E7 + 90`（规则 2）优先级高于 `E6 8E + A8`（规则 3），先并出 `E7 90`（剩 `4` 块）。第 3、4 轮分别合成「推」「理」（剩 `2` 块），第 5 轮合成「推理」（剩 `1` 块）后查出示意编号 `9123`。把同一算式推广到整句 `8` 个汉字，总剩余词元数满足单步守恒：

$$N_{\text{tok}} = N_{\text{byte}} - M_{\text{char}} - M_{\text{word}} = 24 - 16 - 4 = 4$$

各阶段块数与合并次数的对应关系如下（合并次数与编号均为教学示意）：

| 处理阶段 | 序列中的当前切块状态 | 发生合并次数 | 当前剩余块数 |
| --- | --- | --- | --- |
| 初始转成 UTF-8 字节 | `8` 个汉字各自拆成 `3` 个单字节 | `0` 次 | `24` 块 |
| 字内字节合并成单字 | 每个汉字内部合并 `2` 次（$8 \times 2 = 16$） | `16` 次 | `8` 块 |
| 相邻单字合并成双字词 | `推理｜引擎｜怎么｜工作` 成对合并 | `4` 次 | `4` 个 token |
| 查词表映射为整数序列 | 对照词表输出最终 `prompt_token_ids` | — | `[9123, 40517, 2256, 1180]` |

如果遇到语料中极少出现的生僻字，合并会在中途停下。比如汉字「犇」的 UTF-8 编码是 `E7 8A 87`：假设合并表里只学过 `E7 + 8A` 这一条规则，没有后续与 `87` 的合并项，它最终就会停留在 `E7 8A` 和 `87` 两个 token 上——**每个 token 都只装了半个汉字的字节**，下一节讲流式反分词时就会看到它带来的直接后果。只要固定预处理规则与合并表、且关闭训练期专用的随机切分（BPE dropout / subword regularization），同一段文本每次切出的编号序列就是严格确定、可复现的。

## 聊天消息：先套模板，再分词

**调用 `/v1/chat/completions` 发送多轮聊天消息时，消息先经对话模板拼成一整段格式化文本，再交给分词器编码成 token 编号。** 这份与模型配套发布的模板叫 `chat_template`（一段 Jinja 模板脚本），负责在系统提示、对话历史与末尾助手起始处插入训练时约定的角色控制标记。

模型在后训练（SFT 监督微调 / RL 强化学习）阶段见到的对话都严格遵守各自的模板标记协议，靠控制标记区分 `system`、`user` 与 `assistant`。以 `v0.30.0` 主基线标准模型 `Qwen3-8B`（`vocab_size = 151936`，`bos_token_id = 151643`，`eos_token_id = 151645`）为例，其模板遵循 ChatML 风格：每条消息以 `<|im_start|>角色名\n` 开头、`<|im_end|>\n`（`151645`）收尾。开启 `add_generation_prompt=True` 时，末尾还会自动拼上 `<|im_start|>assistant\n`，并按 `enable_thinking` 等变量控制 `<think>...</think>` 前缀。

不同模型家族的模板语法与标记属性各有差异，切勿跨模型混套。下图并排展示了另一套典型真实仓库——`GLM-5.3-Flash` 自带的 Jinja 模板——怎样把同一句「推理引擎怎么工作」包裹成完整序列：

```wiki-diagram
file: token-split
```

观察上图有一个易忽略的细节：模板插入的 `[gMASK]`、`<sop>`、`<|system|>`、`<|user|>`、`<|assistant|>` 与 `<think>` 共 6 个标记在词表里各占独立编号，但**“占独立编号”不等于标为 `special=true`**。在 `GLM-5.3-Flash` 的 `tokenizer.json` 中，前 5 个标为 `special=true`，`<think>` 虽属新增词元（added token）却标为 `special=false`。这直接决定反分词设 `skip_special_tokens=true` 时，哪些控制符被隐去、哪些保留给上层解析器。

落到 `vllm@ced6857a`（`v0.30.0` 主基线）的主机 CPU 渲染管线中，`vllm/renderers/hf.py`、`vllm/v1/engine/input_processor.py` 与出口的 `vllm/v1/engine/detokenizer.py` 按下面三站闭环协作：

```wiki-diagram
file: token-fig-chat-pipeline
```

围绕这一主机侧闭环，日常排查长度不符与输出异常时必须守住三条铁律：

1. **真实输入长度（`prompt_len`）统计的是套完模板后的整条编号序列**：多轮对话的系统说明、历史问答、所有 `<|im_start|>` / `<|im_end|>` 边界符及末尾助手引导符都会进入 `prompt_token_ids`。仅对用户最后一句裸文本分词，永远算不出服务端校验的 `prompt_len`；模板渲染与编码均在主机 CPU 完成，尚未占用 NPU。
2. **一步直出编号，避免二次编码重复塞入 BOS（序列起始符，Beginning of Sequence）**：`safe_apply_chat_template` 默认以 `tokenize=True` 直接输出扁平整数列表（并设 `return_dict=False` 兼容 Transformers v5）。若线下先用 `tokenize=False` 拿到字符串再单独调 `tokenizer.encode(...)`，务必传 `add_special_tokens=False`，否则自动补 BOS 会多塞一遍起始符导致长度与哈希错位。比对两次编码结果时，还要锁死消息正文、`tokenizer` 版本、模板文本与变量（如 `enable_thinking` / `reasoning_effort`）并关闭随机切分。
3. **无模板目录调用对话接口会当场报错**：Transformers v4.44 起移除了硬编码默认模板。当 `resolve_chat_template` 走完四级回落仍找不到可用模板（常见于裸基座目录），`vllm` 直接抛 `ChatTemplateResolutionError` 拒绝请求（已有配套模板的模型不受影响）。

## 生成的编号怎样变回文字？

**NPU 每轮前向算完后，由输出头 `lm_head` 给词表全部条目打分、采样器选出 1 个新编号，主机端的增量反分词器（`IncrementalDetokenizer`）再把累积编号按 UTF-8 字节流实时拼回可读文字。**

打分与采样（详见 [lm_head](lm-head.md) 与 [sampling](sampling.md)）产出的只是整数 token ID；引擎将其追加进上下文充当下一轮 Decode 输入，同时由前端 `OutputProcessor` 里的 `IncrementalDetokenizer.update`（快速路径走 `FastIncrementalDetokenizer.decode_next`）增量解码。由于字节级 BPE 里单个 token 既可以是多个汉字，也可以只是生僻字的半截 UTF-8 字节，反分词器必须维护字节缓冲。沿用「推理」与生僻字「犇」（`E7 8A 87`）走一遍流式输出：

| 第几个输出 token（示意） | 查词表还原出的字节 | 缓冲区暂存未吐出的字节 | 客户端屏幕新增的可见文字 |
| --- | --- | --- | --- |
| 第 1 个（编号 `9123`） | `E6 8E A8 E7 90 86` | 无 | `推理` |
| 第 2 个（半字片段） | `E7 8A` | `E7 8A` | 无（不足完整 UTF-8 字符，先攒着防乱码） |
| 第 3 个（补齐末字节） | `87` | 无 | `犇`（与暂存的 `E7 8A` 凑齐 3 字节后吐出） |

可以看到，模型一共生成了 `3` 个输出 token，客户端流式界面上的可见文字却只更新了 `2` 次。

除了多字节拼字缓冲，停止条件也会让**流式文本增量**与**内部输出编号序列**脱钩。为匹配停止字符串（`stop`），反分词器需按配置暂扣末尾待确认字符（见[流式输出](streaming-output.md)）。此外，当命中 `eos_token_id`（如 `Qwen3-8B` 的 `151645`）或 `stop_token_ids` 且 `include_stop_str_in_output` 为默认 `False` 时，`IncrementalDetokenizer.update` 会记下 `skipped_stop_token_id`：**跳过该停止符的文字解码（不把 `<|im_end|>` 打印到屏幕），但仍把该编号追加进内部 `self.token_ids`**。因此单凭前端可见文字，无法反推完整输出编号序列。

最后把三个常混的长度口径分清：**输入长度（`prompt_len`）**是套完模板后的已有 token 数；**输出上限（`max_tokens`）**约束本次最多新生成多少个 token；**上下文容量（`max_model_len`）**约束单条请求「输入 + 输出」的总长度上限（命中结束符或停止串会提前终止）。

下图把上述**流式反分词字节缓冲与停止符跳字**，和下文真实模型的**词表分段与入口双边界校验**并排画在同一画布上，方便对照查阅：

```wiki-diagram
file: token-fig-detokenizer-vocab-bounds
```

## 落到标准部署与模型变体边界

理解了通用分词与模板闭环后，下面先落到全站 `v0.30.0` 主基线（`vllm-ascend@c09d3e20` + `vllm@ced6857a`）的标准模型 `Qwen3-8B`，再对照两类工程边界：DeepSeek 协议库的特殊标记区间隔离，以及 `GLM-5.3-Flash` 双机算例的 `154880` 词表三段式切分与示例请求 R1。

### Qwen3-8B 标准主基线：151936 词表与入口交接

在本站单真源预设 `Qwen3-8B` 的 `config.json` 中，核心词表字段为 `"vocab_size": 151936`、`"bos_token_id": 151643`、`"eos_token_id": 151645`（`<|im_end|>`）与 `"tie_word_embeddings": false`。因为首尾词表不共享，输入 `embed_tokens` 与输出 `lm_head` 在 NPU 显存中各占一张 $151,936 \times 4,096$ 的 BF16 矩阵（单表约 `1.16 GiB`，合计 `2.32 GiB`；见 [HF 模型目录解剖](hf-model-anatomy.md#词表与首尾共享vocab_sizetie_word_embeddings-与权重核对)，`Qwen3-0.6B` 靠 `tie_word_embeddings: true` 省去一半）。

`Qwen3` 系列也是上游 `vLLM` 源码注释中点名的“模型词表大于分词器词表”代表，核对编号校验时须把三组上界分开：

1. **分词器可发出的编号与 `tokenizer.max_token_id`**：分词器日常编码只会产出词表与新增特殊标记范围内的编号；`vllm@ced6857a` 的 `HfTokenizer` 缓存 `max_token_id = max(max(vocab.values()), tokenizer.vocab_size)`（`main` 修正为 `vocab_size - 1`）。
2. **模型词表大小（`model_vocab_size`）**：即 `model_config.get_vocab_size()`。`Qwen3-8B` 权重矩阵共 `151,936` 行（有效行下标 `0..151935`），末尾预留了分词器日常切分不会产出的扩展行；反过来，部分多模态分词器会带有超出语言模型词表的媒体占位编号。
3. **请求入口与采样参数的不同上界**：在 `vllm@ced6857a` 的 `InputProcessor._validate_model_input` 中，`tokenizer` 存在时同时拦截负数（`min_input_id < 0`）并取两者的较大上界：

$$0 \le \text{token\_id} \le \max(\text{tokenizer.max\_token\_id},\; \text{model\_vocab\_size} - 1)$$

越界编号会在主机 CPU 入口直接抛 `Token id … is out of vocabulary`，绝不放进 NPU 触发静默零向量。采样侧校验口径则按参数用途区分：候选白名单 `allowed_token_ids` 直接索引 logits 列，在 `v0.30.0 / main` 按 `0 <= id < model_config.get_vocab_size()` 校验（`v0.23.0 / v0.26.0rc` 带分词器时按 `len(tokenizer)` 校验）；而 `bad_words` 由分词器编码后按 `0 <= id <= tokenizer.max_token_id` 校验。

校验通过后，`AsyncLLM.add_request` 先在前端 `OutputProcessor` 登记反分词状态与输出队列，再经 ZMQ（ZeroMQ，进程间高速消息通信库）发往 `EngineCore` 等待调度。直到调度器分配好预算，昇腾 Worker 的 `NPUModelRunner._prepare_inputs` 才在 [NPU 硬件](hardware-devices.md)的[设备内存](device-memory.md)（HBM）上准备 `input_ids` 与 `positions` 张量，按[平台契约](vllm-platform-interface.md)交昇腾算子执行[嵌入查表](embedding.md)。**主机内存里的字符串、编号列表与设备 HBM 里的权重、激活、KV cache 分属两本独立账，切勿把“几个 token 整数”等同于设备显存字节数。**

### DeepSeek Recipe：控制标记与用户文字怎样分开

同样在屏幕上显示为一串字符，模板插入的角色控制标记和用户输入的普通文字绝不应当混为一谈。以独立协议转换库 DeepSeek Recipe 为例：`render_conversation` 在渲染提示词的同时，会显式返回记录**真实控制标记字节区间**的 `special_ranges`。后续编码器只在这些区间内匹配特殊控制编号，其余普通用户文本一律跳过附加特殊词表、按常规子词切分。

举个典型排查场景：用户在提问里原样敲出某个控制标记字面量，请模型“解释这个控制符的含义”。如果接入层把渲染后的整段纯文本拿去重跑普通分词、丢掉了 `special_ranges` 边界，用户正文就会被误切成角色切换符，导致对话错乱甚至提示词注入。定位“两段看似相同的 prompt 为何结果不同”时，必须同时比对**渲染文本、特殊标记区间与最终 token ID 序列**。Recipe 编码器还要求绑定配套 `tokenizer`（未附加时 Rust 侧返回 `MissingTokenizer`，Python 侧抛运行时错误）；生成阶段如何维持控制流与文本流隔离，见[编号流与文本流](streaming-output.md#deepseek-recipe编号流与文本流的边界不同)。

### GLM-5.3-Flash 双机与 R1 案例边界：154880 词表与入口流转

在 [GLM-5.3-Flash 双机算例](glm-5-3-flash-two-node.md#部署前提)与[单请求主线 R1](one-request.md#第-1-站-入口从-http-到-node0-的引擎)（固定配置 `690b7052`）中，同一套机制呈现出三处具体的模型级特征：

1. **带 `ignore_merges` 直查优化的字节级 BPE**：`GLM-5.3-Flash` 的 `tokenizer.json` 先执行字符级正则预切分（连续汉字/字母成段、数字最多 `3` 位一段、标点与空白分段、文字前紧邻的单个非换行空格或标点并入该段、`'`s/`'`ll 缩写单列），再交 `ByteLevel` 转字节并合并。其 `BPE dropout` 为空（切分确定），覆盖全部 `256` 个基础字节故无未知标记；同时开启 `ignore_merges`，若预切分后的整段字节已在词表中则直接取出编号、跳过逐对归并。
2. **`154880` 行词表的三段构成与 `special` 差异**：模型文本词表维度（`embed_tokens` 与 `lm_head` 行数，见[模型的形状总表](glm-5-3-flash.md#全模型形状总表)）为 `154,880`，比分词器总条目数多出 $154,880 - 154,820 - 36 = 24$ 行（配置文件未写明这 24 行用于对齐切分还是预留扩展）：

| 编号区间 | 条目行数 | 词表分段角色与解码/判停边界 |
| --- | --- | --- |
| `0 – 154819` | `154,820` 行 | 普通词元：`256` 个基础单字节 + BPE 合并出的子词与常用词 |
| `154820 – 154855` | `36` 行 | 新增词元（模板控制符、结束符、图像/视频占位等）：仅 `18` 个标为 `special=true`（与 `tokenizer_config.json` 的 `extra_special_tokens` 一致）；其余 `18` 个含 `<think>`、`</think>` 等（`special=false`，故 `skip_special_tokens=true` 会跳过 `<|assistant|>` 却保留 `<think>`） |
| `154856 – 154879` | `24` 行 | 模型权重存在但分词器从不产出的行；因入口上界取 `154879`，直接传 `prompt_token_ids` 落入此段仍可通过上界检查 |

   同时，`config.json` 与 `generation_config.json` 列出三个结束编号：`154820`（`<|endoftext|>`）、`154827`（`<|user|>`，兼作生成结束符）与 `154829`（`<|observation|>`）。默认未忽略 EOS 时，主 EOS 单独记录、其余并入 `stop_token_ids`，满足 `min_tokens` 后命中任一即停止。
3. **示例请求 R1 的 4 token 教学设定与真实 16 token 对照**：主线为便于逐行写出每卡矩阵，把[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署) 约定为套完模板后共 `4` 个输入编号 `p₀, p₁, p₂, p₃`（占位置 `0–3`；`p₀` 是第 1 个输入编号的符号名，不代表编号 `0`）。若用真实 `690b7052` 文件与 `tokenizers 0.22.1` 在 CPU 实测编码，裸正文「推理引擎怎么工作」为 `[107934, 106244, 99311, 98538]`（4 个 token）。单条 `user` 消息不传 `tools`、开启 `add_generation_prompt=True` 并取默认推理强度时，渲染文本为 `[gMASK]<sop><|system|>Reasoning Effort: Max<|user|>推理引擎怎么工作<|assistant|><think>`，实得 **16 个 token = 6 个模板独立标记 + 6 个推理强度说明 token + 4 个正文 token**。生成阶段该部署还开启了 MTP 多词草拟验证（见[主线第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)）。

在双机 DP2 部署下，A1 主机入口完成模板、分词、输出登记与按负载选组（两组初始同为 0 分时选入 `DP0`）后，再经 ZMQ 交 `EngineCore` 进入 A2 调度、A3 准备张量与 A4 逐层计算：

```wiki-diagram
file: token-entry-flow
```

入口拒绝条件详见 [API server 入口](api-server-entry.md)，选组打分与跨进程函数链见[调用链的入口一站](request-call-chain.md#七站逐站从哪个函数进往下调谁)，后续块分配与每卡张量字节数分别见[单请求第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)、[主线第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)与[模型总览](glm-5-3-flash.md)。

## 常见误解

下图汇总了排查 token 计数、特殊标记与流式返回时最高发的四组认知误区：

```wiki-diagram
file: token-fig-myths
```

结合上图，逐条核清七个常见误解：

- **“Token 就是一个汉字或一个英文单词。”** 实际切法取决于预切分正则与 BPE 合并表：常用双字词常合为 1 个 token，生僻汉字或 emoji 则可能拆成多个半字字节 token，字数与 token 数之间不存在固定换算系数。
- **“词表大小（`vocab_size`）就是单条请求允许输入的最大长度。”** `vocab_size`（如 `Qwen3-8B` 的 `151,936`）定义的是可选座位号空间与首尾矩阵行数；单次请求可容纳的位置总数由上下文容量 `max_model_len` 约束，重复出现的编号也要按位置逐一计数。
- **“词表有多少行，分词器就能切出多少个日常词语。”** 词表主体是 `256` 个单字节与子词片段，末尾还包含控制标记与分词器从不产出的模型预留行（如 `Qwen3-8B` 的预留扩展行，或 `GLM-5.3-Flash` 的 `154,880` 行里仅产出 `0–154855`、末 `24` 行从不产出且 `36` 个新增词元中仅 `18` 个标为 `special=true`）。
- **“不同模型的分词器输出的整数可以直接互换。”** 整数编号的语义完全绑定配套词表与模型权重；跨词表混用编号会从嵌入表抽错向量行，导致输出彻底乱码。
- **“只数最新一条用户提问，就知道请求占了多少 `prompt_len`。”** 系统提示、历史多轮消息、角色边界符和生成起始提示全部计入输入长度；线下先渲染文本再重编码若漏关 `add_special_tokens=False`，还会多塞入重复起始符。
- **“请求只有 4 个 token，就只占几字节显存。”** 入口的 4 个整数只代表序列长度；NPU 显存还要承担常驻的模型权重、分页分配的 KV cache 块与本步前向激活，主机账与设备账不能混算。
- **“流式接口收到 3 次推送，就代表模型生成了 3 个 token。”** 流式可见文本受多字节拼字缓冲、停止串暂扣以及默认跳过末尾停止符（`skipped_stop_token_id`）共同影响，精确输出长度一律以内部生成的 `token_ids` 计数为准。

## 对照源码

### 怎么开

常规文本与对话服务启动时会自动加载配套分词器，无须单独开启开关；需要显式干预时，主要由下面三个入口分别控制“词表从哪加载、走哪套分词后端、对话用哪份模板”：

| 控制目标 | CLI / Python 入口与默认值 | 解析优先级与适用边界 |
| --- | --- | --- |
| 分词器来源 | `--tokenizer` / `tokenizer=None` | 省略时跟随 `model` 路径或仓库 ID；显式指定另一目录时仅替换分词器读取路径，不改变权重来源，且词表映射必须与权重严格配套 |
| 分词器实现 | `--tokenizer-mode` / `tokenizer_mode="auto"` | `auto` 对含 `tekken.json` 或 `tokenizer.model.v*` 的 Mistral 仓库选 `mistral`（部分内置模型在 `ModelConfig` 自动切至专属模式），其余回落 `hf`；`v0.30.0` 及以前还支持 `slow`（强制 `use_fast=False`），`main` 已移除 `slow` |
| 服务对话模板 | `--chat-template` / `chat_template=None` | 优先按文件路径读取；打不开且含 `{` 或换行等 Jinja 特征时按模板字面量解析，否则查内置模板目录，仍失败即报错（不修改模型目录原文件） |

在 `v0.30.0` 主基线的 `hf` 路径中，若未传 `--chat-template`，`resolve_chat_template` 按四级顺序回落：① 显式传入或命名模板 → ② `tools is None` 时尝试 `AutoProcessor` 模板 → ③ `AutoTokenizer` 模板 → ④ 预定义模型回落模板；四级皆空才抛 `ChatTemplateResolutionError`。因此“未传 `--chat-template`”不等同于“只读 `tokenizer_config.json`”。此外，`safe_apply_chat_template` 在 `tokenize=True` 且未显式指定 `return_dict` 时强制设 `return_dict=False`，以兼容 Transformers v5 默认返回 `BatchEncoding` 的行为变更，确保下游拿到扁平 `list[int]`（请求级覆盖模板与 `content` 格式见 [API 入口](api-server-entry.md#怎么开)）。

**每条请求允许携带多少多模态媒体：** 启动参数 `--limit-mm-per-prompt`（对应 `MultiModalConfig.limit_per_prompt`，默认空字典，未列出的模态上限默认取 `999`）按媒体条目数限制单条输入的模态数量（非像素数或视觉 token 数）。例如 `GLM-5.3-Flash` 教程配置 `--limit-mm-per-prompt '{"image":1,"video":0}'` 表示单条请求最多 1 张图、禁用原始视频输入；注意若额外开启 `enable_mm_embeds` 传入预计算的 `EmbeddingItems` / `DictEmbeddingItems`，当该模态上限配为 `0` 时存在跳过条目数校验的分支，因此不能把 `0` 泛化为禁止一切形式的嵌入输入。

**对话从哪里接着生成（请求 JSON 顶层字段，不放入 `SamplingParams`）：**

| 请求顶层字段 | 默认值与作用 | 优先级与互斥边界 |
| --- | --- | --- |
| `add_generation_prompt` | Chat 默认 `true`；在模板末尾追加助手起始引导符 | 具体插入哪些标记由模型模板决定，不改变输出 token 预算 |
| `continue_final_message` | Chat 默认 `false`；保持最后一条消息未闭合以续写前缀 | 续写最后一条 `assistant` 消息时必须同时显式设 `add_generation_prompt=false`；两者同为 `true` 直接报错 |
| `add_special_tokens` | Chat 默认 `false`；Completions 默认 `true` | 仅在进入文本编码路径时控制是否补 BOS 等特殊标记；`safe_apply_chat_template` 默认直接返回 token IDs，故仅把 Chat 该字段设为 `true` 不会二次补 BOS |
| `chat_template_kwargs` | Chat 默认 `None`；向 Jinja 模板传入自定义变量 | 服务默认变量先被请求变量覆盖，再由顶层 `add_generation_prompt` / `continue_final_message` 覆写（不能仅靠在此字典塞同名键绕过顶层默认）；未传 `enable_thinking` 而传了 `reasoning_effort` 时按其是否非 `"none"` 自动推导，最终经模板声明变量过滤 |

**超长提示词截断（`truncate_prompt_tokens` 与 `truncation_side`）：** 两者在 Chat / Completions 请求中默认均为 `None`（超长直接拒收，绝不静默丢字）。`truncate_prompt_tokens` 取值范围为 `-1` 至 $2^{63}-1$：正整数 $N$ 最多保留 $N$ 个输入 token，`-1` 自动取当前可用输入预算，`0` 会截成空序列并在后续非空校验被拒。`truncation_side` 可设 `"left"`（丢弃左侧开头、保留尾部）或 `"right"`（丢弃右侧尾部、保留开头）；`None` 时继承 `tokenizer.truncation_side`（无 `tokenizer` 时退回保留开头的切片）。例如服务 `max_model_len = 12`、请求设输出 `4`，可用输入预算为 `8`，原编号为 `[10..19]`：设 `truncate_prompt_tokens=6` 配 `left` 得 `[14..19]`、配 `right` 得 `[10..15]`，设 `-1` 保留 `8` 个，而设 `9` 哪怕原输入更短也会因超出预算 `8` 被拒（多模态输入还须保证媒体占位符完整，输出预算取小规则见 [API 长度参考](api-server-entry.md#怎么开)）。

### 会报什么错

- **参数与模态冲突**：显式同设 `add_generation_prompt=True` 与 `continue_final_message=True` 报 `Cannot set both continue_final_message and add_generation_prompt to True.`；非法 `truncation_side`、小于 `-1` 或大于可用输入预算的 `truncate_prompt_tokens` 在协议/分词参数层直接拦截；`limit_mm_per_prompt` 传负数或请求媒体数超限同样拒绝（`image=1` 不会自动拼合多图）。
- **分词器模式与模板加载失败**：未注册模式报 `No tokenizer registered for tokenizer_mode=...`；在 `v0.23.0`–`v0.30.0` 中同时指定 `slow` 与 `use_fast=True` 报 `Cannot use the fast tokenizer in slow tokenizer mode.`；模板参数像路径却不存在时前置校验报 `appears path-like, but doesn't exist`，加载失败报 `looks like a file path, but it failed to be opened`；四级回落均无可用模板时抛 `ChatTemplateResolutionError`。
- **输入长度与词表越界**：`InputProcessor` 拒绝空 decoder 提示词、`prompt_len > max_model_len` 的超长提示词，以及生成任务中 `prompt_len == max_model_len`（连 1 个输出位置都没留）的请求；当输入包含负数编号（`v0.30.0+`）或最大编号超过词表兼容上界时，报 `Token id … is out of vocabulary`。以上均属主机入口校验错误，排查时不要误归因于 NPU 算子故障。

### 开销和什么时候别开

开启 `truncate_prompt_tokens` 只能缩短送进 NPU 的序列，并不总能省掉主机 CPU 分词开销（`v0.23.0` 完整编码后再切片；`v0.26.0rc` 起仅在超出字符上界估算值时先按显式方向裁文本），切勿依赖服务端截断去承接无限长文本上传。修改模板变量或特殊标记开关会改变 `prompt_token_ids`，压测或对比 prefix caching 命中率时必须锁死同一套模板参数。`skip_tokenizer_init=True` 会跳过分词器与反分词器初始化，仅适用于调用方已自行保证 `prompt_token_ids` 合法且只需收回整数编号的内部链路。

### 版本差异

下表集中对照四套固定仓库基准版本在模板包装、分词器注册表、参数截断、词表边界校验与昇腾输入准备路径上的关键演进（独立协议库 DeepSeek Recipe 仅针对固定提交 `935817c6` 核对 `render_conversation` 返回 `special_ranges` 与 `MissingTokenizer` 契约，不属于四版 `vLLM` 分支矩阵）：

| 核对维度 | `v0.23.0 (2c59ff10/0fc695fc)` | `v0.26.0rc (2ed6cbba/568afb3a)` | `v0.30.0 (c09d3e20/ced6857a)`（主基线） | `main (8d6180e2/ba15685a)` |
| --- | --- | --- | --- | --- |
| Chat 模板包装与 `assistant_tokens_mask` | `safe_apply_chat_template` 默认 `tokenize=True`、强制兼容 `return_dict=False`；无 `return_assistant_tokens_mask` 形参 | 新增 `return_assistant_tokens_mask=False`（模板含 `{% generation %}` 时可导出助手位置掩码） | 延续 `return_assistant_tokens_mask` 支持，模板内部异常统一转为 HTTP 400 `VLLMValidationError`（`hf.py#L880`）；对话入口收拢至 `openai/chat_completion/serving.py` 与 `HfRenderer` | 移除 `hf.py` 内的 `return_assistant_tokens_mask` 分支；保留模板异常转 HTTP 400 `VLLMValidationError` |
| 分词器注册表与 `--tokenizer-mode` | 共用 `hf`、`mistral`、`deepseek_v32`、`deepseek_v4`、`kimi_audio`，另含 `grok2`、`qwen_vl`；支持 `slow`（四版均对生成/草稿任务默认注入 `truncation_side="left"`） | 移除 `grok2`/`qwen_vl`，新增原生输出编号的 `inkling`；保留 `slow` | 在 `v0.26` 基础上新增 `cohere`、`deepseek_v41`、`kimi_k3`；`hf` 显式拒绝 `mistral_format=True` 且对特定 Mistral 仓校验 `transformers>=5.15.0` | 新增 `alpamayo2_super`、`glm5_next`；**移除 `slow` 模式**与 `5.15.0` 常量检查 |
| 输入长度与路由记录起点校验 | `InputProcessor` 按编号数或嵌入行数计 `seq_len`，未传 `max_tokens` 时补为 `max_model_len - seq_len` | 与 `v0.23.0` 一致 | 统一命名为 `prompt_len`，新增校验 `routed_experts_prompt_start` 必须落在 `[0, prompt_len]` | 延续 `routed_experts_prompt_start` 校验，并新增 `prompt_logprob_start < prompt_len - 1` 边界校验 |
| 词表上下界校验与 `max_token_id` | 仅当 `tokenizer` 非空时在 `InputProcessor` 查上界；`hf.py` 缓存 `max(max_id, tokenizer.vocab_size)` | 与 `v0.23.0` 一致 | `InputProcessor` **新增拦截负数编号**（`min_input_id < 0` 同样抛 `out of vocabulary`） | 迁入 `BaseRenderer.validate_token_ids`，**无 `tokenizer` 时也按 `model_vocab_size - 1` 校验**；`hf.py` 修正为 `tokenizer.vocab_size - 1` |
| 顶层对话参数与超长截断 | `limit_mm_per_prompt`（未列模态 `999`、`enable_mm_embeds` 例外）、`add_generation_prompt` 等顶层合并一致；显式方向在完整编码后切片 | 顶层参数一致；文本超过预算对应字符上界 `max_input_chars` 时先按显式方向裁文本再编码 | 保留 `max_input_chars` 预裁防护，并将 token 切片抽为共用 `_truncation_slice`（经 `_token_truncation` 与 `apply_post_tokenization` 调用以同步裁剪附属对齐字段） | 延续 `v0.30.0` 的 `_truncation_slice` 与参数合并契约 |
| 昇腾 Worker 输入张量准备 | `vllm_ascend/worker/model_runner_v1.py` 在 A3 按调度预算准备设备侧 `input_ids` 与 `positions` | 延续 `model_runner_v1.py` 准备路径 | `model_runner_v1.py` `_prepare_inputs` 统一管理 CPU/NPU `positions` 与 `input_ids` 缓冲拷贝 | 迁入 V2 运行器 `vllm_ascend/worker/v2/model_runner.py` 的 `input_buffers.input_ids` 与 `positions` |

### 源码位置

按请求流向阅读 `v0.30.0` 主基线源码：先看 `vllm/renderers/hf.py` 的 `resolve_chat_template` 与 `safe_apply_chat_template` 如何完成四级模板回落与一步分词，再看 `vllm/renderers/params.py` 的参数合并与截断；接着在 `vllm/v1/engine/input_processor.py` 核对长度与词表上下界校验，经 `AsyncLLM.add_request` 登记输出并交由昇腾 `vllm_ascend/worker/model_runner_v1.py` 准备设备输入张量，最后在 `vllm/v1/engine/detokenizer.py` 查看流式增量字节解码与停词过滤（完整跨进程调用链见[调用链页](request-call-chain.md)）。

来源索引按结论归并，编号对应页头 `sources`：

- 子词切分概览、对话模板角色边界与稀有词 BPE 算法依据 Transformers 官方文档与 Sennrich 等人的论文 [S1][S2][S3]；`Qwen3-8B` 的 `vocab_size=151936`、`bos_token_id=151643`、`eos_token_id=151645` 依据预设模型配置 [S4]。
- `v0.30.0` 主基线模板四级解析、Transformers v4.44 缺模板报错、`return_dict=False` 兼容及模板异常转 400 `VLLMValidationError` 见 `hf.py` [C5][C6]；截断参数与 `_truncation_slice`（由 `_token_truncation` 与 `apply_post_tokenization` 调用）见 `params.py` [C7]；分词器注册表、`auto`/`slow`/`hf`、生成任务默认 `truncation_side="left"` 与 `5.15.0` 门槛见 `registry.py` 及 `ModelConfig` [C8][C14]（命令行 `--chat-template` 与路径报错见来源 18、19）。
- `HfTokenizer.max_token_id` 兼容上界计算见 `tokenizers/hf.py` [C9]；`prompt_len`、`routed_experts_prompt_start`、负数与越界编号拦截见 `input_processor.py` [C10][C11]；请求提交与 `OutputProcessor` 登记、增量反分词与 `skipped_stop_token_id` 停词跳过分别见 `async_llm.py` 与 `detokenizer.py` [C13][C12]（调度判停与 `generation_config` 结束符并入见来源 22、23）。
- 对话顶层字段互斥、变量优先级与 `reasoning_effort` 推导见 `chat_completion/protocol.py` [C15]（Completions 默认与多模态 `limit_per_prompt` / `enable_mm_embeds` 例外见来源 16、17、20、21）；昇腾侧设备 `input_ids` 与 `positions` 准备见 `model_runner_v1.py` [C24]。
- 跨版本演进对照：`v0.23.0` 与 `v0.26.0rc` 对照见来源 25–31；`main` 移除 `slow` 模式、`vocab_size - 1` 修正与无 `tokenizer` 词表校验下沉至 `BaseRenderer.validate_token_ids` 见 [C32][C33][C34]（`main` 移除 `return_assistant_tokens_mask`、保留 400 包装及昇腾 V2 runner 见来源 35–37）。
- 变体与案例边界：DeepSeek Recipe 的 `special_ranges` 与 `MissingTokenizer` 依据其固定文档 [S38]；`GLM-5.3-Flash` 的 `154,880` 词表三段划分、`ignore_merges`、`36` 个新增词元中 `18` 个 `special=true`、三个 EOS 编号、教程 `image=1/video=0` 及 `tokenizers 0.22.1` 编码对照依据固定模型文件与教程 [S39][S40][S42][S43][S44]（底层 Rust 分词器实现与 DP 选组见来源 45–49）；子词合并步数守恒算式由字节数展开 [D]，R1 的 4 token 输入与开头切分编号属教学设定，本页不含主机分词耗时与并发吞吐实测 [A]。
