---
id: token
title: Token 与分词：从文本到模型输入
type: concept
summary: >-
  Token 是模型用整数编号表示的文本单元。先讲 token 是什么、为什么切成子词，再用一个例子演示字节级 BPE 怎样把文字拆成字节、按合并表一步步并成
  token；接着讲聊天模板和生成的编号怎样变回文字，最后落到 GLM 双机的分词器、154880 行词表和 R1 的入口。
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
chapters:
  - '01'
order: 20
sources:
  - 'https://huggingface.co/docs/transformers/tokenizer_summary'
  - 'https://huggingface.co/docs/transformers/chat_templating'
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/config.json
  - 'https://arxiv.org/html/1508.07909v5'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/render/serving.py#L183-L256'
  - 'vllm@0fc695fc:vllm/renderers/hf.py#L694-L746'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L349-L415'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L1344-L1357'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L1398-L1426'
  - 'vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L47-L166'
  - 'vllm@0fc695fc:vllm/v1/engine/input_processor.py#L387-L484'
  - 'vllm@0fc695fc:vllm/config/model.py#L125-L256'
  - 'vllm@568afb3a:vllm/config/model.py#L127-L258'
  - 'vllm@84030bbe:vllm/config/model.py#L142-L294'
  - 'vllm@568afb3a:vllm/renderers/hf.py#L699-L794'
  - 'vllm@84030bbe:vllm/renderers/hf.py#L787-L885'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L814-L1225'
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/tokenizer.json
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/chat_template.jinja
  - 'vllm@0fc695fc:vllm/tokenizers/hf.py#L112-L126'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L590-L618'
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/generation_config.json
  - >-
    https://github.com/deepseek-ai/deepseek-recipe/blob/935817c66f5d6e64838f419692545f06787e485f/docs/tokenizer.md
  - >-
    raw:sha256-b18efa9d5dec13007a53553772d09649b4147efc8d15d0b3344638b1ee728a21.md#L1-L1562
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/engine/input_processor.py#L469-L484
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/engine/detokenizer.py#L107-L126
  - 'vllm@0fc695fc:vllm/tokenizers/registry.py#L43-L182'
  - 'vllm@568afb3a:vllm/tokenizers/registry.py#L41-L161'
  - 'vllm@84030bbe:vllm/tokenizers/registry.py#L50-L183'
  - 'vllm@0fc695fc:vllm/config/model.py#L485-L505'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/cli_args.py#L80-L100'
  - 'vllm@0fc695fc:vllm/entrypoints/chat_utils.py#L1253-L1340'
  - 'vllm@0fc695fc:vllm/renderers/hf.py#L265-L314'
  - 'vllm@568afb3a:vllm/entrypoints/openai/cli_args.py#L75-L100'
  - 'vllm@84030bbe:vllm/entrypoints/launchers/cli_args.py#L75-L100'
  - 'vllm@84030bbe:vllm/tokenizers/registry.py#L251-L273'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L250-L324'
  - 'vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L260-L350'
  - 'vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L278-L368'
  - 'vllm@0fc695fc:vllm/renderers/params.py#L28-L470'
  - 'vllm@568afb3a:vllm/renderers/params.py#L28-L480'
  - 'vllm@84030bbe:vllm/renderers/params.py#L28-L566'
  - 'vllm@0fc695fc:vllm/config/multimodal.py#L17-L109'
  - 'vllm@568afb3a:vllm/config/multimodal.py#L17-L106'
  - 'vllm@84030bbe:vllm/config/multimodal.py#L17-L133'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L84-L105'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L472-L520'
  - >-
    https://github.com/vllm-project/vllm-ascend/blob/0576b6471c7a35707920a665352391d33c77451c/docs/source/tutorials/models/GLM5.3-Flash.md
  - 'vllm@0fc695fc:vllm/renderers/base.py#L473-L494'
  - >-
    raw:sha256-18af2b334f83526e141288bc158cd9c96a87167e8bdc8ee60da39ec7fca173f2.md#L1-L4362
  - 'vllm@ced6857a:vllm/v1/engine/input_processor.py#L354-L380'
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/tokenizer_config.json
  - 'vllm@0fc695fc:vllm/v1/core/sched/utils.py#L94-L117'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L210-L270'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L512-L541'
  - 'vllm@0fc695fc:vllm/renderers/hf.py#L885-L1087'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L850-L858'
  - 'vllm@84030bbe:vllm/tokenizers/registry.py#L33-L35'
  - >-
    https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/models/bpe/model.rs#L475-L520
  - >-
    https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/tokenizer/mod.rs#L890-L909
  - >-
    https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/tokenizer/added_vocabulary.rs#L242-L316
  - 'vllm@0fc695fc:vllm/multimodal/processing/context.py#L430-L463'
  - 'vllm@568afb3a:vllm/multimodal/processing/context.py#L430-L463'
  - 'vllm@84030bbe:vllm/multimodal/processing/context.py#L509-L542'
  - 'vllm@0fc695fc:vllm/v1/engine/input_processor.py#L314-L321'
  - 'vllm@568afb3a:vllm/v1/engine/input_processor.py#L314-L321'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - main
evidence: C
relations:
  - to: one-request
    kind: builds-on
    note: 本页展开 A1 的模板与分词，R1 的七站形状和设备账回到主线页
  - to: request-call-chain
    kind: builds-on
    note: 入口对象与跨进程交接的完整函数链在调用链页
  - to: device-memory
    kind: builds-on
    note: 编号列表与设备中的权重和历史状态要分开记内存账
contradicts: []
updated: 2026-11-03T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-18af2b334f83526e141288bc158cd9c96a87167e8bdc8ee60da39ec7fca173f2.md
  - >-
    raw/sha256-a286cea73b40ebc9285e52549c14c6266494637fdb983122a87632839080a589.md
---

## Token 是什么？

**Token（词元）是模型处理文本的基本单位：一段文字先被切成一块块 token，每块在词表里有一个整数编号（token ID），模型真正收到的是这一串编号。**

模型内部只会对数做计算，没法直接处理「推」「理」这样的文字，所以文字进模型之前要先换成数。拿一句「推理引擎怎么工作」来看：

```wiki-diagram
file: token-intro
```

负责切块和查编号的程序叫分词器（tokenizer）。它把句子切成「推理」「引擎」「怎么」「工作」4 块，再到词表里查出每块的编号。词表（vocabulary）就是「单元 ↔ 编号」的对照表，可以先用语料训练分词器得到，再与采用这套编号的模型配套发布；模型训练时和使用时必须保持编号含义一致，否则同一个编号指的就不是同一块文字。图里的切法和编号是教学设定，固定 GLM 文件的实际编码结果见后文。

一块 token 不一定是一个词：可以是词、比词小的片段（子词）、标点、空白，也可以是几个字节（字节是计算机存文字的最小单位，下文讲）。常用的字和词往往整块就是一个 token，少见的字可能被拆成好几个。

切出来的 4 个 token 按先后排在位置 0、1、2、3。**编号回答「这是词表里的哪一项」，位置回答「它排在第几个」**：位置从 0 往后数，和编号大小无关。同一个编号可以在一句话里出现好几次，每次出现都占自己的位置。

编号只是一个座位号，本身不能拿来做加减乘除。它的下一站是[嵌入（embedding）](embedding.md)：用编号到一张嵌入表里查出一行数（一个向量），这行数才进入后面的[矩阵乘](matmul-and-weights.md)。三个容易混淆的对象要分开：

| 对象 | 回答什么问题 | 会怎样变化 |
| --- | --- | --- |
| Token ID | 这是词表中的哪个单元？ | 同一编号可以在一条序列中反复出现 |
| 序列位置 | 这个单元出现在第几处？ | 每次出现占据自己的位置 |
| 嵌入向量 | 模型从哪些数值开始算？ | 用编号查嵌入表得到；后续各层继续变换 |

编号相近不代表含义相近，也不代表位置相邻。序列里同一个编号查到的初始嵌入相同，位置和上下文再让后续计算各不相同。分词器与模型记录的词表大小也不一定完全一致：模型可能留有分词器没有的额外 token，多模态分词器也可能带有模型词表之外的占位编号；判断编号能否作为输入，要结合对应输入处理路径，不能只检查分词器的词表大小。

## 为什么不按整词或单个字切，而要切成子词？

**切得越粗，词表越大，而且总有收不全的新词；切得越细，词表越小，同一句话的序列却越长。子词分词取中间：常见的片段整块收进词表，少见的拆成更小的块，减少遇到新词时无从表示的情况。** 是否能覆盖任何输入字符，还取决于最小单元是否齐全；下文的字节级 BPE 用全部 256 种字节兜底，普通字符级子词分词器仍可能遇到未知字符。

词表大小和序列长度都要紧，因为模型两头的开销分别跟着它们走：

- **词表多大，模型两头就有多大。** 输入这头，嵌入表给每个编号留一行；输出这头，模型每生成一个 token，最后一步都要给词表里的每一项各打一个分（叫输出打分），再从中挑出下一个 token，[后文](#生成的编号怎样变回文字)细讲。词表多一项，嵌入表多一行，每次打分也多算一个。
- **序列多长，模型就要处理多少个位置。** 每个 token 占一个位置。常规完整注意力把已经算过的每个位置的 K、V 留在 [KV cache](kv-cache.md) 中，后面的 token 会读取它们；这类历史缓存随序列增长。GLM 还包含以固定大小状态累积历史的 [KDA 层](linear-attention.md)，不能把所有层的缓存都按每个位置一份来算。

还是那句「推理引擎怎么工作」，换三种粒度切（汉字在计算机里通常各占 3 个字节，下一节细讲）：

```calc
title: 同一句话，切法不同，长度不同
按字节切 = 8 个汉字 × 每字 3 个字节 = 24 个 token
按字切 = 8 个 token
按子词切（示意） = 推理｜引擎｜怎么｜工作 = 4 个 token
> 按字节切，词表只要 256 项就能写出任何文字；按字切，词表要收下所有可能出现的字；按子词切，常见的词各占一项、少见的退回更小的块
```

按整词切，如果词表恰好收了「推理引擎」，这句只要 3 个 token；但词表得把每个词都收进去，新造的词、人名、拼错的词总收不全，遇到了就只能当成「未知」。按字节切正好相反：词表最小，什么都写得出，同一句话却长了 6 倍。子词在两者之间：序列不太长，词表也不必无限大。

子词（subword）就是比完整词小的片段。常见的子词分词算法有 BPE、WordPiece、Unigram，学出片段的规则不同：BPE 从小单元逐步合并（下一节演示），WordPiece 用另一套准则决定先合并哪一对，Unigram 反过来从一张很大的候选词表里筛选，并给不同的切法打分。Sennrich 等人的原始论文就是用 BPE 子词来处理机器翻译里的稀有词。遇到词表里没有的字符时，是退回字节、换成一个「未知」标记，还是别的处理，由具体分词器的配置决定。

## 字节级 BPE 怎样一步步切出 token？

**字节级 BPE（byte-level Byte Pair Encoding，字节对合并）用字节作为基本单元，照一张训练时学到的合并表，一次把一对相邻的块并成一块，直到再没有能并的；最后每一块到词表里查出编号。** 本站主线讲的模型 GLM-5.3-Flash（下文简称 GLM）采用字节级 BPE，并有“整段已在词表就直接取编号”的优化，后文再说明。下面先理解字节表示，再看预切分边界和合并；实际 GLM 执行时，先对字符文本预切分，再把各段转成字节表示。

**先看基本单元：字节。** 用 UTF-8 编码存文字时，英文字母、数字和半角标点各占 1 个字节，常用汉字各占 3 个字节。一个字节是 8 位二进制数，有 256 种取值，习惯写成两位十六进制数，比如 E6、8E。「推」存成 E6 8E A8，「理」存成 E7 90 86。词表收下全部 256 个单字节，所以任何有效的 UTF-8 文字，哪怕训练时从没见过的字，至少能切成一个个字节，用不着「未知」标记。

**再看合并范围：预切分。** 合并之前，先按字符种类把文本分段，后面的合并只在段内做，不会跨过段的边界。GLM 分词器的分段规则是：连在一起的文字（汉字和字母都算）是一段，数字最多 3 位一段，标点和空白一般单独成段；但紧挨在一串文字前面的一个标点或空格（换行除外）会并进这段文字。比如「工作了2048秒。」分成「工作了」「204」「8」「秒」「。」5 段：连续的汉字一段，2048 每 3 位一切，句末的句号自成一段。「你好，世界」则分成「你好」「，世界」2 段，逗号跟着后面的文字走；英文「hello world」同理分成「hello」和带着前导空格的「 world」。「推理引擎怎么工作」8 个汉字连在一起，整句就是 1 段。

**最后：按合并表一对一对地并。** 标准 BPE 训练在大量文本里统计哪两块最常挨在一起，就加一条规则把它们并成新的一块，新块也收进词表；再统计、再加，重复很多次。这样，词表就从基本单元扩展出更大的组合，规则的先后记录合并优先级。切一段文字时，在当前各块里找合并表里最靠前的那对相邻块，把它并掉；再找下一对；直到任何相邻两块都不在表里为止。这是在解释 BPE 合并机制，GLM 发布的词表和合并表并未给出它全部训练语料与训练步骤。下图用自定规则放大「推理」这一段：

```wiki-diagram
file: token-bpe
```

逐行看：起点是 6 个字节，6 块。规则 1 排在最前，E6 和 8E 正好相邻，并成一块「E6 8E」，剩 5 块；这时「E6 8E」和 A8 也能按规则 3 并，但规则 2 更靠前，所以先把 E7 和 90 并成「E7 90」，剩 4 块；规则 3 把「E6 8E」和 A8 并起来，3 个字节合成一块，正好是「推」，剩 3 块；规则 4 同样得到「理」，剩 2 块；规则 5 把「推」和「理」并成「推理」，剩 1 块。再往下，表里没有能用在这里的规则，合并结束。最后「推理」到词表里查出编号 9123，就是开头那张图里的 9123。每并一次，块数减 1，所以 6 个字节并 5 次剩 1 块。

整句照同样的办法并：

```calc
title: 整句「推理引擎怎么工作」切成 token（合并次数与编号为示意）
转成字节 = 8 个字 × 3 个字节 = 24 块
每个字的 3 个字节并回这个字 = 8 个字 × 2 次 = 16 次合并
相邻两个字并成一个词 = 4 次合并
剩下的块 = 24 − 16 − 4 = 4 个 token
查词表 = 推理｜引擎｜怎么｜工作 → [9123, 40517, 2256, 1180]
```

少见的字不一定能并完。比如「犇」存成 E7 8A 87；假设合并表里和它有关的只有「E7 + 8A」这一条（示意），它就停在「E7 8A」「87」两块，成了 2 个 token，每块都只是半个字的字节。所以一个 token 不一定对应完整的字，下面反分词时还会碰到这个例子。本例固定预处理和合并表，并且不启用随机切分，所以同一段文字每次切出的结果相同。

## 聊天消息：先套模板，再分词

**聊天消息不会原样送去分词：chat template（聊天模板）先按模型训练时约定的格式，把角色、正文和消息边界拼成一段文本，再整段分词。** 模型训练时见到的对话都是这种格式，里面的标记告诉它哪段是系统说明、哪段是用户说的、从哪里开始该它回答。下图是 GLM 模型仓库自带的模板处理同一句话的样子：

```wiki-diagram
file: token-split
```

模板在正文前面插入 `[gMASK]`、`<sop>` 两个起始标记，一行以 `<|system|>` 开头的系统说明（默认写推理强度 Reasoning Effort: Max），以及表示用户发言的 `<|user|>`；在正文后面插入 `<|assistant|>` 和 `<think>`，表示轮到模型回答、并先写思考过程。这 6 个模板标记都有固定编号，编码时每个整体算一个 token，编号取自模型仓库的 tokenizer 文件。不过“整体一个编号”不等于分词器里的 `special=true`：这里 `<think>` 是新增词元，却没有被标为 special；其余 5 个才是。这个区别会影响解码时是否自动跳过标记。正文仍按上一节的办法切，图中 4 个编号沿用前面的示意数；真实编码对照见后面的 GLM 小节。

**输入长度要数套完模板后的整条序列。** 多轮对话里，系统说明、旧的用户问题、旧回答和当前问题都按模板拼起来，角色边界和回答起始标记也按模板进入序列，都要计数。只给当前聊天气泡分词，数不出服务实际收到的长度。套模板和编码都在服务器的 CPU 上做，还用不到做模型计算的芯片。

套模板和分词是两个逻辑步骤，实际接口可以一次完成。手动复现时，如果先得到带特殊标记的模板文本、再单独编码，要避免编码器再补一遍起始或结束标记。比较两次 token 数，要同时固定消息内容、tokenizer 文件版本、特殊 token 设置、模板与模板选项（例如推理强度选 low、high 还是 max，会改写 system 那一行），并且不启用随机切分（subword regularization：训练时让同一段话随机切出不同结果的做法）。

**分词器没有配置聊天模板时，调用方必须提供模板。** Transformers 从 v4.44 起不再提供库内的默认聊天模板。这个条件针对缺少模板的分词器，不表示已有模型模板需要替换。

## 生成的编号怎样变回文字？

**模型给词表里每一项打分，采样选出一个编号，反分词（detokenize）再把累积的编号还原成看得见的文字。** 打分这一步用一张权重表，叫 lm_head（语言模型的输出头），和嵌入表一样每个编号占一行，算出来的分数也是每个编号一个。这里的采样泛指选取输出编号：可以取分数最高的，也可以把分数换成概率再抽一个。选出的 token ID 接回已有序列末尾，才成为下一轮生成所依据的上下文；再打分、再选，一个一个往外生成。

反分词先把编号查回它代表的字节，再把字节拼成文字。一个输出 token 可以贡献好几个字，也可以只给出半个字的字节。接着上一节的「推理」和「犇」：

| 第几个输出 token（示意） | 查回的字节 | 攒着还没显示的字节 | 屏幕上新增的文字 |
| --- | --- | --- | --- |
| 第 1 个（编号 9123） | E6 8E A8 E7 90 86 | 无 | 推理 |
| 第 2 个 | E7 8A | E7 8A | 无：凑不成一个字，先攒着 |
| 第 3 个 | 87 | 无 | 犇：和攒着的 E7 8A 凑齐 3 个字节 |

生成了 3 个 token，屏幕上的文字只更新了 2 次。

结束标记等特殊 token 有控制用途，通常不会显示成文字；为了匹配停止字符串（请求里指定的「遇到这段文字就停」），输出端还会按配置暂留一部分文本。因此，流式接口（边生成边把新文字推给用户的接口）的一次文本增量与一个 token、一个汉字都没有固定的一一对应关系。增量反分词怎样攒字节、停止字符串怎样扣住文字，见[流式输出](streaming-output.md)。内部 token 编号与展示文字也不同：增量反分词在因 stop 结束、且不输出停止内容时，可以跳过最后一个 token 的文字转换，却仍把编号追加到内部记录；因此，最终可见文字不足以还原完整输出编号序列。

几个长度也要分开：输入长度是已经有的 token 数；输出上限约束最多新增多少 token；上下文容量约束服务允许处理的整条序列有多长。请求也会因为采样到结束编号、碰到停止字符串等条件提前结束。

## 落到 GLM 双机：分词器、词表和 R1 的入口

前面讲的是通用做法。本站主线把 GLM-5.3-Flash 部署在两台昇腾服务器上（每台 8 张 NPU 卡，NPU 是专做神经网络计算的芯片；部署条件统一见[官方双机前提](glm-5-3-flash-two-node.md#部署前提)），并跟着一条示例请求 R1 走完全程；本页对应它的第一站 [A1 入口](one-request.md#第-1-站-入口从-http-到-node0-的引擎)。

### GLM 的分词器是字节级 BPE

**模型仓库的 tokenizer 文件把模型类型写为 BPE，并用字节表示进行合并和解码。** 实际预切分器先执行字符正则：把连续的文字（汉字和字母都算）、最多 3 位一组的数字、成串的标点、空白分开，文字前面紧挨的一个空格或标点（换行除外）并进这段文字，英文的 's、'll 这类缩写单独成段；然后 ByteLevel 把各段转成字节表示，合并不跨越前面的边界。配置里还打开了 ignore_merges：一段的字节表示如果整段就是词表里的一项，直接取这一项，不再逐对合并。词表覆盖全部 256 个基本字节，因此有效的 UTF-8 文字都能表示，配置里也没有未知标记。少见的汉字可能被拆成几个 token，常用字和常用词也常已合成一个。

随机切分在 BPE 里对应的开关叫 BPE dropout（合并时随机跳过一部分规则）。GLM 分词器配置里这一项为空，同一段话每次切出的编号相同。

### 编号要落在 154880 行之内

**分词器产出的每个编号，都要在嵌入表里有对应的一行；这 154880 行并不全是自然语言的词。** GLM-5.3-Flash 的文本词表维度为 **154880**，输入嵌入和输出打分都围绕这个有限维度组织：嵌入表把每个编号对应到一行向量，输出端给每个编号打分的 lm_head 也有同样的行数（见[模型的形状总表](glm-5-3-flash.md#全模型形状总表)）。这个数不等于分词器的条目数，更不是模型认识的自然语言词数。按模型仓库的 tokenizer 文件，这些行分成三段：

```calc
title: 154880 行词表里装了什么
普通条目（编号 0–154819） = 154820 个，256 个单字节加上 BPE 合并出的组合
新增条目（编号 154820–154855） = 36 个，模板标记、结束符、图像与视频占位等
分词器不产出的行（编号 154856–154879） = 154880 − 154820 − 36 = 24 行
```

36 个新增条目中，只有 18 个的 `special` 为 true；配套 tokenizer_config 也只把这 18 个列入额外特殊词元。其余 18 个包括 `<think>`、`</think>` 等。以固定文件的解码为例，`skip_special_tokens=true` 会跳过 `<|assistant|>`，却保留 `<think>`；是否把思考标记和内容显示在接口中，还要看后续解析与输出处理。

模型配置和生成配置里的三个结束编号 154820、154827、154829，就是其中的 `<|endoftext|>`、`<|user|>`、`<|observation|>`：vLLM（本站用的开源推理服务框架）在没有忽略 EOS 的默认设置下把它们作为结束条件；满足最少输出长度等条件后，生成到其中任一个就停止。这套模板用角色标记划分消息，因此 `<|user|>` 既可标记下一条用户消息，也被生成配置列为结束编号。

两边的数可以不同。嵌入表的行数在训练前就定下，常被补到便于切分和对齐的整数，也可以给以后新增的特殊标记留位置；GLM 这 24 行属于哪一种，模型文件没有写明。真正要配套的只有两件事：同一个编号在分词器和模型里指同一个单元；分词器产出的编号不超出这张表。

vLLM 在入口也只检查上界：取分词器的最大编号与“词表大小 − 1”中较大的一个，输入里最大的编号超过它才报越界，不要求两边条目数相等。按 GLM 的数，上界是 154879。所以绕过分词器、直接传入 154856–154879 的编号也能通过检查，查到的是分词器从不产出的那几行。

### R1 在入口拿到了什么？

**R1 是[主线的示例请求](one-request.md#示例请求-r1-与官方双机部署)，约定套完模板并分词后，提示词有 4 个 token。** 这是教学设定：按图示默认单用户消息模板，光模板标记就有 6 个，实际输入不会只有 4 个 token；取 4 是为了后面每张卡上的张量（多维数组，这里多是矩阵）能逐行写出。模板图里那句中文不是 R1 的内容，R1 也没有指定实际编号。

作为真实文件的对照，用固定 revision `690b7052` 的 tokenizer 和 Jinja 模板，在 CPU 上以 `tokenizers 0.22.1` 编码：裸正文「推理引擎怎么工作」得到 `[107934,106244,99311,98538]`；只传一条 user 消息、不传 tools、开启 add_generation_prompt、使用默认推理强度时，模板文本是 `[gMASK]<sop><|system|>Reasoning Effort: Max<|user|>推理引擎怎么工作<|assistant|><think>`，共 **16 个 token = 6 个模板标记 + 6 个推理强度文本 token + 4 个正文 token**。这是固定文件的本地编码结果；服务另传模板或选项时，应重新编码计数。

R1 的最终输入写成 p₀、p₁、p₂、p₃，列表长度为 4，位置是 0、1、2、3。这里的 p₀ 是“第一个输入编号”的符号名称，既不等于编号 0，也不保证与其他 p 不同。词表的 154880 是可供模型查表、打分的维度，与这条请求只有 4 个位置是两回事。

生成阶段，这套部署开启 MTP（multi-token prediction，多 token 预测）：先猜几个候选 token，再由主模型一起验证。草拟几个不等于最终输出上限；它如何推进 R1，见[主线第 5 站](one-request.md#第-5-站-采样与-mtp-草拟选出-y₀再猜-3-个)。

### 再交给某一个引擎等待调度

**主机（服务器上的 CPU 和内存）上传的是编号和请求设置，设备（NPU）上的输入张量要到后面才准备。** 引擎（engine）指 vLLM 里负责排队、调度并驱动模型计算的那部分程序。API server 是接收 HTTP 请求的前端进程；EngineCore 是持有调度器（决定每一步算哪些请求、各算几个 token）的引擎进程；DP（data parallel，数据并行）把不同请求分给不同的执行组。这套部署有两个 DP 组，R1 先进入其中一个引擎。图里还有几个词先说明：反分词前文讲过，是把生成的编号还原成文字；ZMQ 是进程间传消息的库，这里用来把请求对象送进引擎；worker 是负责一张设备的执行进程；A2–A4 是主线接下来的三站：调度、准备输入、模型计算。

```wiki-diagram
file: token-entry-flow
```

图中的模板或输入校验失败会返回入口错误；成功才建立请求。入口每一步做什么、在哪里拒绝请求，见[API server 入口](api-server-entry.md)。前端先登记输出队列和反分词状态，再按显式指定或负载选组。两边初始空闲、从第一个组开始比较时，R1 进入 DP0；具体打分和跨进程函数链见[调用链的入口一站](request-call-chain.md#七站逐站从哪个函数进往下调谁)。分词完成后才向引擎交接；模型各层之间的通信属于后续计算，并非每切出一个 token 就通信一次。

入口请求携带 4 个提示词编号、采样设置，以及可选的目标组编号；采样设置决定怎样选输出编号及何时停止。前端的输出记录负责之后把生成编号还原为文本，引擎里的请求记录负责等待和推进。到了 A3，worker 才按调度结果准备本步编号、位置等张量；A4 再做模型计算。

入口这一站的开销花在主机上：用 CPU 时间套模板、把文本编码成编号，用主机内存保存消息、编号和请求记录。模型计算则在 NPU 这类[设备](hardware-devices.md)上做，用设备自己的[设备内存](device-memory.md)；token 越多，设备要处理的位置越多，按历史位置保存的那部分缓存也会增长。**这两笔内存账不可相加后统称显存。** 主机账包括字符串、整数列表、请求对象及输出队列，实际字节还取决于对象与传输表示；设备账包括后续输入张量、嵌入结果、权重和保存历史的 KV cache，GLM 各类层的 KV cache 存法不同。**Token 数只是长度单位，不能直接当成设备内存字节数。** 本页的“4 个整数”不等于“4 个字节”，也不是 R1 的总设备占用；设备上的权重、临时向量和 KV cache 怎样计费，见该页与[单请求第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)，每卡的形状与字节统一看[主线第 3 站](one-request.md#第-3-站-准备输入一份计划发给-8-个-worker)。引擎选哪套设备实现（比如在昇腾上用哪些算子），由[平台契约](vllm-platform-interface.md)约定，这与词表规定“编号代表什么”是两层约定。按阅读顺序，本页之后接[嵌入](embedding.md)，再回到[模型总览](glm-5-3-flash.md)看这些向量经过哪些层。

## DeepSeek Recipe：控制标记与用户文字怎样分开

同样显示为一段文字，模板插入的控制标记和用户输入的普通文字，分词时未必应得到相同编号。DeepSeek Recipe 是把接口请求转换成模型输入、再把模型输出转换成接口响应的库。它渲染对话时，除了提示词文本，还记录**哪些字节区间是显式的特殊标记**；分词时只有这些区间按特殊编号处理，其余文字不用附加的特殊词表来切分。

例如，用户让模型“解释某个控制标记的写法”。即使用户文字与模板标记长得一样，这份文字也应保持为内容，不能变成角色边界。若接入代码只拿渲染后的字符串重新分词，丢掉标记区间，就可能把两者混淆。排查时应同时保存渲染文本、特殊区间和最终编号；仅比较两段看起来一样的 prompt 不够。

Recipe 的编码器需要调用者提供匹配模型的 tokenizer。渲染成功只说明文本已准备好，编码是否正确还取决于配套词表及特殊编号。生成端如何保留这一区别，接着看[编号流与文本流](streaming-output.md#deepseek-recipe编号流与文本流的边界不同)。

## 常见误解

- **“Token 就是一个字或一个词。”** 要看实际分词；中英文、空白、标点和少见字符的切法都受词表与规则影响，字数没有固定的 token 换算系数。
- **“词表大小就是可输入的长度。”** 词表描述可选编号的空间，输入长度数的是这次序列里的位置；重复编号也要逐次计数。
- **“词表有 154880 行，分词器就有 154880 个条目，而且都是日常词语。”** GLM 的分词器只会产出编号 0–154855，其中最后 36 个是新增条目，只有 18 个标为 special；154856–154879 这 24 行从不产出。普通条目也多是子词和字节组合，不是完整词语，见[编号要落在 154880 行之内](#编号要落在-154880-行之内)。
- **“两套分词器输出的整数可以直接互换。”** 编号的含义来自配套词表。两套词表若把同一个数分给不同单元，互换后就会查到错误的嵌入；模型权重也要与编号映射配套。
- **“只数最新问题，就知道请求长度。”** 模板格式化后的全部上下文才是计数对象，额外重复添加特殊标记还会改变结果。
- **“4 个 token 就只占很少显存。”** 入口只确定长度；权重常驻、历史状态的块分配和本步中间结果属于另外的设备账。
- **“流式收到三段，就生成了三个 token。”** 文本增量受字节拼接、反分词和判停影响；应使用生成编号的计数。

## 对照源码

### 怎么开

普通文本与聊天生成会初始化配套分词器，无须给 token 概念开启一个额外特性。三个入口分别控制“编号字典从哪来、用哪套实现、聊天先排成什么文本”：

| 作用 | 入口与默认 | 选择规则 |
|---|---|---|
| 分词器来源 | CLI --tokenizer；Python tokenizer，默认 None | 省略时跟随 model 的名称/路径；显式字符串指定另一个本地目录或仓库 ID，不改变模型权重来源 |
| 分词器实现 | CLI --tokenizer-mode；Python tokenizer_mode，默认 auto | auto 按模型及配套文件选择；hf 指定 HF 实现，slow 通过 HF 禁用 fast tokenizer，其他模式按注册表选择 |
| 服务聊天模板 | CLI --chat-template；前端 chat_template，默认 None | 接受模板文件路径或 Jinja 模板文本；省略时由 renderer 解析配套模板，不代表所有模型都有可用模板 |

例如模型权重在 /models/example、配套分词器在 /models/example-tokenizer，可以给已有启动命令增加 `--tokenizer /models/example-tokenizer --tokenizer-mode auto`。这只适用于词表和特殊标记与权重对应的文件；路径能打开不证明编号含义正确。离线构造 LLM 时对应 tokenizer 与 tokenizer_mode 关键字；聊天模板属于聊天渲染入口，不要当作所有生成接口通用的模型加载参数。

基线的 auto 在识别为 Mistral 仓库且找到 tekken.json 或 tokenizer.model.v\* 文件时选择 mistral，其余回到 hf。auto 不是无条件等于 fast：最终实现还取决于分词器依赖和文件。slow 明确把 use_fast 设为 false；同时要求 use_fast=true 会报冲突。其余已注册模式和版本变化见下表；自定义插件注册的名字也可进入选择流程，不能把字段中的字符串视为任意实现都受支持。

指定服务模板时优先读文件；文件打开失败，字符串含花括号或换行等 Jinja 线索时按模板文本处理，否则再尝试内置模板目录，仍找不到就报错。例如已有启动命令追加 `--chat-template /models/example/chat_template.jinja`，比把多行模板塞进 shell 更容易检查。此选项不会改动模型目录里的原文件。请求是否可覆盖模板、消息 content 用字符串还是内容块，统一见 [API 入口](api-server-entry.md#怎么开)。

HF 路径先使用传入的显式模板（也可由 tokenizer 解析命名模板）；没有显式模板且没有 tools 时先尝试 AutoProcessor 的模板，再尝试 AutoTokenizer，最后尝试预定义 fallback。tools 非 None 时跳过第一种自动来源。以上都没有可用模板才报缺模板；“没传 --chat-template”不能等同于“必定只读 tokenizer_config”。GLM 本页使用配套模型模板，模板格式必须与训练时的角色、边界及生成起始标记一致。

复现聊天输入时，Hugging Face 的 `apply_chat_template(..., tokenize=True)` 可以直接得到编号。若使用 `tokenize=False` 先渲染文本，再调用编码器，通常应设置 `add_special_tokens=False`，防止重复加入模板已有的标记。服务实际采用的模板、生成起始标记等选项也要一致。

接口返回的编号还可能包在不同的数据结构中。固定上游 0fc695fc、568afb3a、84030bbe 的 HF 包装层都为 Transformers v5 的返回结构做了兼容：tokenize=True 且有效参数中未指定 return_dict 时，将它设为 False，以保持下游需要的扁平整数列表，避免默认返回 BatchEncoding（一种按字段组织编码结果的容器）；显式指定的值则保留。这里调整的是返回结构，不说明 token 内容变化；需要 assistant mask 的分支另有处理，实际安装的依赖与包装层仍须匹配。三版包装层见来源 6、15、16。

**每条输入允许多少图像。** 启动 CLI `--limit-mm-per-prompt`、Python limit_mm_per_prompt 把各模态的数量上限传到 MultiModalConfig.limit_per_prompt；定义是空字典，未列出的模态取 999。GLM 教程显式配置 `--limit-mm-per-prompt '{"image":1,"video":0}'`：一条 prompt 最多一张图，原始视频输入关闭，不能据此称为纯文本部署。0 表示禁用该模态的原始媒体输入；正整数按输入项目数计，不是图像像素数、视觉 token 数或输出 token 数。另行开启 enable_mm_embeds 时，预计算的多模态嵌入存在“该模态限制为 0 时跳过数量校验”的路径，不能把 0 泛化为所有形式的输入一律禁止。该配置也参与多模态启动预算；需要修改的是两端启动命令，而非单条 Chat 请求。支持 count-only 与带 count/width/height 等选项的对象写法；普通数量限制使用教程的简单形式即可，模型自身支持的模态与数量仍是前提。

**聊天生成从哪里接着写。** 以下都是请求 JSON 顶层字段，不放进 SamplingParams；沿用 [API 页的 Chat 示例](api-server-entry.md#怎么开)添加所需字段即可。

| 字段 | 默认与作用 | 配置边界 |
|---|---|---|
| add_generation_prompt | Chat 默认 true；请模板在末尾加入助手回复的起始提示 | 具体插入什么由模板决定，既不是增加输出预算，也不是强制模板支持此选项 |
| continue_final_message | Chat 默认 false；为 true 时让最后一条消息保持未结束，以便续写其内容 | 续写助手前缀时用最后一条 assistant 消息，并显式设 add_generation_prompt=false；两个选项不能同时为 true |
| add_special_tokens | Chat 默认 false；Completions 默认 true | 控制文本编码时额外加入 BOS 等标记；Chat 模板已含标记时遵循上面的避免重复规则。直接给 token IDs 不会再按文本重编码补标记 |
| chat_template_kwargs | Chat 默认 None；给模板传额外变量 | 只有模板实际读取的变量才影响 prompt；不是任意引擎参数的透传口 |

HF 聊天包装层默认让模板直接返回 token IDs，这时没有随后一次文本编码，add_special_tokens 不会再额外补标记；这也包括“模板产生编号”，不只指调用方手写编号。只有进入文本编码路径时才使用该编码开关，因此不能仅把 Chat 字段改成 true 就断言最终多了一个 BOS。

例如最后一条为 `{"role":"assistant","content":"答案是："}`，配 `"continue_final_message":true,"add_generation_prompt":false` 表示接着这一段写；是否符合 GLM 模板与训练协议仍应核对渲染结果，不能仅凭请求通过就保证效果。普通问答保留默认的新助手消息路径。

模板变量的优先级有两次合并：服务默认变量先被请求变量覆盖；请求顶层的 add_generation_prompt、continue_final_message 等再写入有效变量，其中 None / auto 不覆盖。两个布尔顶层字段即使省略也已有默认，因此不能只在 chat_template_kwargs 内塞同名键来覆盖它们。显式 enable_thinking 会保留；未提供它而提供 reasoning_effort 时，协议层按是否为 none 推导它。最终还要经过模板接受变量过滤。GLM 的 thinking 格式和推理强度取决于[本页固定模型模板](#r1-在入口拿到了什么)，不把其他模型的 enable_thinking 示例当成 GLM 已验证开关。请求内另传 chat_template 还受 [API 模板信任守卫](api-server-entry.md#怎么开)限制。

**超长输入要丢哪一端。** Chat / Completions 的 truncate_prompt_tokens 默认 None，不授权自动丢弃超长输入；整数范围为 -1 到 2⁶³−1。正整数 N 保留至多 N 个输入 token，-1 使用可用输入预算，0 会截成空输入，后续生成校验通常因此拒绝。truncation_side 默认 None，可显式给 left 或 right：left 丢左侧、保留尾部；right 丢右侧、保留开头。None 继承 tokenizer.truncation_side；没有 tokenizer 时回到保留开头的切片，不能一概解释为左截断。只设方向但不设截断长度不会开启输入截断。

示意服务总上限 12、请求明确要求输出 4，分词阶段输入预算就是 8。原输入编号为 [10,11,12,13,14,15,16,17,18,19]：设 truncate_prompt_tokens=6、left 后留下 [14,15,16,17,18,19]，right 则留下 [10,11,12,13,14,15]；设 -1 时保留 8 个。设 9 即使实际 prompt 更短也会因超过输入预算 8 而失败。聊天先渲染模板、再编码和截断，方向可能裁掉系统说明、角色边界或最新问题，服务不会替被裁掉的语义补全；多模态输入还须保持占位 token 与媒体对应，不以这组纯文本示例代替多模态校验。输出预算的来源和最终取小规则统一见 [API 长度参考](api-server-entry.md#怎么开)。

### 会报什么错

add_generation_prompt 与 continue_final_message 显式同时为 true 会报冲突；续写时应明确把前者设为 false，不依赖前置校验是否看到了省略字段的默认。非法方向、低于 -1 的截断数、超过输入预算的截断数分别在协议或分词参数校验失败。limit_mm_per_prompt 的负数 count 非法，超出已配置模态数量或模型支持范围会拒绝；image=1 不会自动把多图合成一图。

未知模式会报 `No tokenizer registered for tokenizer_mode=...`；slow 与 use_fast=true 同时出现会报 `Cannot use the fast tokenizer in slow tokenizer mode.`。分词器路径不存在、文件不完整或依赖缺失，则在相应实现的加载阶段失败。模板字符串像文件路径却不存在，正常服务的前置检查可报 `appears path-like, but doesn't exist`；后续加载器读文件失败则可报 `looks like a file path, but it failed to be opened`。查服务工作目录与实际文件，不把这些错误当成消息长度超限。

固定控制流在解析不到可用模板时抛出 `ChatTemplateResolutionError`，先核模型文件和服务模板配置。启用长度校验时，输入处理会拒绝空的 decoder prompt、超出上下文容量的 prompt；生成任务中，prompt 恰好占满容量也会被拒绝，因为至少要留一个输出位置。带分词器校验编号时，若最大输入编号超过分词器最大编号与模型词表上界二者的较大值，会报 `Token id … is out of vocabulary`；这项检查只检查上界。这些都应从模板、编号或长度条件定位，不先归因于 NPU 计算。

### 开销和什么时候别开

截断缩短的是交给模型的输入，不保证同比减少入口 CPU 开销：基线显式指定方向时需要先获得完整 token 序列再切片。不要靠无限长上传后截断来控制前端资源。增加图像数量还会增加媒体处理、视觉计算和相应缓存需求，数量上限不是精确显存配额。模板变量与特殊标记改变后会改变输入编号，复现和比较缓存命中时必须保持一致。

入口的模板渲染、编码和出口的增量反分词使用主机资源；每个位置后续的计算与缓存另记设备账。`skip_tokenizer_init=True` 会跳过 tokenizer 和 detokenizer 初始化，要求调用方提供合法 `prompt_token_ids`，输出也只含编号。只在调用方已经负责正确编码和解码的接口路径使用；普通聊天消息仍需要完成模板与分词。

### 版本差异

| 输入参数 | v0.23（0fc695fc） | v0.26 rc（568afb3a） | main（84030bbe） |
|---|---|---|---|
| limit_mm_per_prompt | 定义空字典；未列出模态 999；0 禁用原始媒体，预计算嵌入例外见上文 | 相同 | 相同 |
| add_generation_prompt / continue_final_message | true / false；互斥用途 | 相同 | 相同 |
| add_special_tokens | Chat false；Completions true | 相同 | 相同 |
| chat_template_kwargs | None；服务默认、请求变量与顶层字段按上述规则合并 | 相同 | 相同 |
| truncate_prompt_tokens / truncation_side | None / None；-1 取输入预算；显式方向在完整编码后切片 | 默认和切片方向相同；文本超过预算对应的字符上界时，先按显式方向裁文字再编码 | 保留 v0.26 防护；切片抽为共用方法以同步裁 token 对齐字段 |

本页 Recipe 段落只核对 `935817c6` 的编码契约；它是独立的协议库，不属于下表三版 vLLM 已验证范围。其 `render_conversation` 返回 `special_ranges`；自行分词也必须保留这些区间的语义。未附加 tokenizer 时，Rust 编码返回 `MissingTokenizer`，Python 编码抛出运行时错误。

这里核的是 vLLM 的文本分词契约与 HF 模板包装层；GLM 双机数值和流程图固定在控制流 `0fc695fc`、执行侧 `db701c1f`。下表中的 `main` 是仓库约定的 `84030bbe`，不是浮动分支，也不意味着各版都支持同一 GLM 部署；`v0.30.0rc2` 则仅针对配套上游 `ced6857a` 的 `InputProcessor` 长度与路由记录起点校验（`vllm/v1/engine/input_processor.py#L354-L380`）做了专项核对：

| 核对项 | v0.23（0fc695fc） | v0.26 rc（568afb3a） | v0.30.0rc2（ced6857a，专项已核项） | main（84030bbe） | 对使用者意味着什么 |
| --- | --- | --- | --- | --- | --- |
| 文本分词与 HF 模板处理 | 有 | 有 | 本页未对 rc2 单独重核此项（见上文核验范围） | 有 | 都将消息转为编号；具体切分由配套文件决定 |
| 默认分词器来源／模式 | 模型路径／auto | 相同 | 本页未对 rc2 单独重核此项 | 相同 | 升级引擎不等于可以更换词表 |
| 跳过初始化 | 默认 false；开启后收、发编号 | 相同 | 本页未对 rc2 单独重核此项 | 相同 | 默认提供编码和反分词服务 |
| HF 模板包装层 | 默认 tokenize=true；缺模板报错 | 相同 | 本页未对 rc2 单独重核此项 | 相同 | 普通聊天仍需可解析的模板 |
| 可选 assistant token mask | 此包装函数无该形参 | 有，默认 false | 本页未对 rc2 单独重核此项 | 有，默认 false | 模板含 generation 标记且分词器返回 mask 时，可标出助手片段位置；否则为 None |
| `InputProcessor` 长度计算与专家路由记录起点 | 按 token 数 / embedding 行数计输入长度（`seq_len`）；未给 `max_tokens` 时补为 `max_model_len − 输入长度` | 相同 | 配套上游仍对 token IDs 和 prompt embeddings 分别取编号数、向量行数作为输入长度（`prompt_len`），未给 `max_tokens` 时仍补为 `max_model_len − 输入长度`；新增 `routed_experts_prompt_start` 必须处于 `[0, prompt_len]`（控制从哪里开始记录专家路由，不会截断提示词） | 本页未单独重核此项 | 正文字符、token 和 embedding 行的区别仍成立，不能拿字符数替代这个检查 |

三版（`v0.23`、`v0.26 rc`、`main 84030bbe`）tokenizer 字段定义默认都是 None，初始化后才补为 model；tokenizer_mode 都是 auto，chat_template 都是 None，服务模板都支持文件或文本。这些默认值相同，**已注册的专用模式并不相同**：

| 模式集合 | v0.23 | v0.26 rc | main 84030bbe |
|---|---|---|---|
| 共同注册 | hf、mistral、deepseek_v32、deepseek_v4、kimi_audio | 相同 | 相同 |
| 本快照另外注册 | grok2、qwen_vl | inkling | inkling、cohere、deepseek_v41、kimi_k3 |
| auto / slow | 解析后进入上述注册实现；slow 转 hf 并关闭 fast | 相同规则 | 相同规则；hf 显式拒绝 mistral_format=true |

专用模式可能连 renderer 一起选择，不只是切词速度不同；例如 inkling 直接组织 token 编号，不能套用本页 HF 的 Jinja 模板流程。升级前按模型配套实现核对，而不是复制另一个模型的 tokenizer_mode。

main 对选择 HF 路径的特定 Mistral 仓库另检查 Transformers 版本，低于 5.15.0 会拒绝；选择 hf 并不保证所有模型都能绕过原生分词器依赖。该门槛见来源 36，不能套回基线。

### 源码位置

代码阅读顺序与入口流程图一致：先看 `render_chat → preprocess_chat`，再看 `safe_apply_chat_template` 的模板与分词调用；随后由 `AsyncLLM.add_request` 包装请求、登记输出，交给客户端选组发送。完整跨进程链留在[调用链页](request-call-chain.md)。设备输入看 `model_runner_v1.py`，返回文字看 `IncrementalDetokenizer`；二者之间隔着调度与模型执行。

来源索引按结论归并，编号对应页头 sources：

- 来源 37–39 是三版 Chat 字段；40–42 是合并、分词预算与截断消费者；43–45 是模态数量配置；46 对照 Completions 的特殊标记默认；47 定位顶层字段覆盖与 enable_thinking 推导；48 核实 GLM 的 image=1/video=0；49 定位已有编号跳过文本编码的消费者。固定 HF 模板处理仍沿用来源 6、15、16，模型语义沿用来源 19，不重复定义模型模板。

- Recipe 的显式特殊区间、普通用户文字、tokenizer 绑定及错误行为，依据固定提交的 tokenizer 文档。[S23]

- 子词、字节表示与切分算法依据 Transformers 官方概览；稀有词的 BPE 子词表示依据 Sennrich 等人的论文。[S1][S4]
- 模板保留角色／边界、先渲染后分词避免重复特殊 token，依据 Transformers 官方模板文档；154880 为固定 GLM 配置的文本词表维度。[S2][S3]
- GLM 的字符预切分先于 ByteLevel，BPE 无未知标记、dropout 为空；普通条目 0–154819 含全部 256 个基本字节，新增条目 154820–154855 共 36 个，其中 18 个标为 special。各编号和 special 字段依据 tokenizer 文件，配套 tokenizer_config 的 extra_special_tokens 同样只列 18 个（来源 52）。默认模板插入 6 个独立标记和推理强度文本，依据同 revision 的 chat template；三个结束编号与图像、视频占位编号都能在固定模型文件里对上。[S18][S19][S3]
- vLLM 越界检查取分词器 max_token_id 与模型词表大小减一中的较大值。HF 缓存的 max_token_id 先取词表中最大 ID，若可访问 tokenizer.vocab_size，还会与它取最大；它是兼容性上界，不能等同于条目数。对本页 GLM，模型的 154879 仍是较大上界。[C11][C20]
- 生成配置的三个结束编号在未忽略 EOS 时成为结束条件；主要 EOS 单独保存，其余并入 stop_token_ids。实际判停先检查 min_tokens，再检查 EOS 和 stop_token_ids，消费者见来源 53。[S22][C21]
- 入口模板与校验分支、默认直接得到编号，核对固定 vLLM 渲染入口和 HF 包装函数。[C5][C6]
- 请求包装、先登记输出再发送、可选目标组与负载选组，核对异步引擎和客户端；R1 的 4 token 属于主线教学设定。[C7][C8][C9][A]
- 增量反分词与停止字符串缓冲、输入长度及越界编号校验，分别核对 detokenizer 和 input_processor。[C10][C11]
- 三版默认模型路径、auto、skip=false，分别核对各提交的 ModelConfig；v0.26/main 的模板包装层与可选 mask 依据对应实现。[C12][C13][C14][C15][C16]
- A3 按调度结果准备编号、位置及设备张量的边界，核对固定 Ascend runner。[C17]

固定文件的 CPU 编码对照使用来源 18、19、52 的 `690b7052` 文件、Jinja 渲染与 `tokenizers 0.22.1`：不传 tools，单条 user 消息，add_generation_prompt=true，编码时 add_special_tokens=false；输出的 16 个编号由正文列出的模板文本得到。它不代表部署镜像已运行同一套服务参数。GLM 多出的 24 行用于对齐还是预留，配置和模型说明没有写明；主机分词耗时、内存峰值及设备端时延也没有本页实测值。

- 来源 25：vllm@0fc695fc，vllm/v1/engine/input_processor.py，L469–L484。
- 来源 26：vllm@0fc695fc，vllm/v1/engine/detokenizer.py，L107–L126。
- 常用入口证据：27–29 是三版实际分词器注册表、auto/slow 分支及 main 的 HF 格式冲突检查；30 是 tokenizer=None 跟随模型的初始化；31、34、35 是三版服务模板字段；32 是文件/文本加载，33 是 HF 模板来源顺序。前述特殊模式支持指注册入口存在，未作各模型的现场运行验证。
- 来源 54、55 衔接输出登记与反分词状态构造；56 是 HF 同步及异步渲染调用，说明普通路径默认产生编号；57 是显式同时开启两个生成起始选项的冲突校验；58 给出来源 36 所用的 Transformers 5.15.0 门槛常量。
- 来源 59–61 为上述 CPU 对照使用的 tokenizers 0.22.1 实现：dropout 未启用时的 ignore_merges 整段命中分支、解码按 special 集合过滤，以及 added token 是否进入 special 集合的条件。
- 来源 62–64 是三版多模态数量校验的实际消费者：解析为 EmbeddingItems 或 DictEmbeddingItems 时先要求 enable_mm_embeds；对应模态上限为 0 时跳过数量校验，普通媒体仍进入 validate_num_items。它们与来源 43–45 的配置说明共同限定预计算嵌入例外。
- 来源 65、66 与来源 51：v0.23（`0fc695fc`）与 v0.26 rc（`568afb3a`）的 `input_processor.py#L314-L321` 按 token 数或 embedding 行数计输入长度（`seq_len`），未给 `max_tokens` 时补为 `max_model_len − seq_len`；v0.30.0rc2 配套上游（`ced6857a`，来源 51）在 `input_processor.py#L354-L380` 保持同一输入长度与默认补齐逻辑，并新增 `routed_experts_prompt_start` 的 `[0, prompt_len]` 区间校验。

上述三份固定上游 HF 实现都在无法解析模板时抛出 ChatTemplateResolutionError，错误说明指出 Transformers v4.44 起不再允许默认聊天模板。这要求服务能取得可用模板，不要求模板只能来自 tokenizer，也不能据此证明某个镜像实际安装了哪一版 Transformers。[C6][C15][C16]
