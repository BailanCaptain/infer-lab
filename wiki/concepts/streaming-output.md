---
id: streaming-output
title: 流式输出：token 编号怎样变成一段段推给客户端的文字
type: concept
summary: >-
  流式输出让客户端边生成边看到文字：引擎每步交回新的 token 编号，前端的增量反分词把它们接上已有字节、还原出新增文字，查过停止字符串后包成一个 SSE
  片段推出。先分清 token 与文本增量，再沿 GLM 双机看一步 1–4 个 token 怎样变成片段、在哪里判停和收尾。
aliases:
  - 流式输出
  - 流式返回
  - 流式响应
  - streaming
  - streaming output
  - stream
  - SSE
  - sse_keep_alive_interval
  - sse-keep-alive-interval
  - SSE 注释保活
  - server-sent events
  - 服务器推送事件
  - 增量反分词
  - incremental detokenization
  - detokenizer
  - IncrementalDetokenizer
  - OutputProcessor
  - RequestOutputCollector
  - 文本增量
  - delta
  - stream_interval
  - stream_options
  - include_usage
  - detokenize
  - include_stop_str_in_output
  - SamplingParams.n
  - 请求 n
  - 多候选回答
  - output_kind
  - RequestOutputKind
  - skip_special_tokens
  - spaces_between_special_tokens
  - continuous_usage_stats
  - stream_options.include_usage
  - stream_options.continuous_usage_stats
  - '--stream-interval'
  - '[DONE]'
chapters:
  - 09
order: 70
sources:
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1695-L1711'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1543-L1562'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L637-L695'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L574-L596'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L45-L100'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L272-L318'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L376-L412'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L576-L690'
  - 'vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L18-L66'
  - 'vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L68-L166'
  - 'vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L167-L249'
  - 'vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L309-L344'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L151-L155'
  - 'vllm@0fc695fc:vllm/envs.py#L1278-L1280'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L634-L640'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L503-L530'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L641-L770'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L800-L936'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/engine/protocol.py#L236-L240'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/api_router.py#L74-L74'
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/tokenizer.json
  - >-
    https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/tokenizer_config.json
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L417-L425'
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm_tool_call_streaming.py#L76-L145
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L166-L180'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/__init__.py#L200-L216'
  - 'vllm@568afb3a:vllm/v1/engine/detokenizer.py#L58-L62'
  - 'vllm@84030bbe:vllm/v1/engine/detokenizer.py#L310-L362'
  - 'vllm@84030bbe:vllm/v1/engine/output_processor.py#L234-L236'
  - 'vllm@84030bbe:vllm/sampling_params.py#L320-L323'
  - >-
    https://github.com/deepseek-ai/deepseek-recipe/blob/935817c66f5d6e64838f419692545f06787e485f/docs/tokenizer.md
  - >-
    https://github.com/deepseek-ai/deepseek-recipe/blob/935817c66f5d6e64838f419692545f06787e485f/docs/streaming.md
  - 'vllm@0fc695fc:vllm/sampling_params.py#L181-L217'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L290-L300'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L486-L498'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L574-L588'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L201-L207'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L683-L690'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L61-L83'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L318-L342'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L435-L442'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/api_utils.py#L276-L289'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L221-L233'
  - 'vllm@0fc695fc:vllm/v1/engine/parallel_sampling.py#L36-L126'
  - 'vllm@0fc695fc:vllm/envs.py#L1035-L1037'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/serving.py#L426-L463'
  - 'vllm@568afb3a:vllm/sampling_params.py#L200-L327'
  - 'vllm@568afb3a:vllm/v1/engine/output_processor.py#L270-L330'
  - 'vllm@568afb3a:vllm/entrypoints/serve/utils/api_utils.py#L276-L289'
  - 'vllm@568afb3a:vllm/config/scheduler.py#L163-L167'
  - 'vllm@84030bbe:vllm/sampling_params.py#L215-L325'
  - 'vllm@84030bbe:vllm/v1/engine/output_processor.py#L270-L330'
  - 'vllm@84030bbe:vllm/entrypoints/serve/utils/api_utils.py#L289-L302'
  - 'vllm@84030bbe:vllm/config/scheduler.py#L195-L199'
  - 'vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L511-L514'
  - 'vllm@0fc695fc:vllm/tokenizers/detokenizer_utils.py#L14-L53'
  - 'vllm@84030bbe:vllm/entrypoints/generate/base/protocol.py#L241-L243'
  - 'vllm@0fc695fc:vllm/tokenizers/detokenizer_utils.py#L173-L191'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/api_router.py#L21-L24'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/api_router.py#L72-L81'
  - 'vllm@ced6857a:vllm/v1/engine/output_processor.py#L550-L562'
  - 'vllm@ced6857a:vllm/v1/engine/output_processor.py#L584-L594'
  - 'vllm@ced6857a:vllm/v1/engine/output_processor.py#L760-L778'
  - 'vllm@ced6857a:vllm/v1/engine/output_processor.py#L231-L240'
  - 'vllm@ced6857a:vllm/entrypoints/serve/utils/sse_keep_alive.py#L1-L65'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/cli_args.py#L140-L146'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/cli_args.py#L446-L459'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L484-L507'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L653-L668'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L748-L775'
  - 'vllm@ced6857a:vllm/sampling_params.py#L229-L324'
  - 'vllm@ced6857a:vllm/sampling_params.py#L605-L626'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L512-L521'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/protocol.py#L253-L262'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/protocol.py#L363-L399'
  - 'vllm@ced6857a:vllm/v1/engine/output_processor.py#L51-L102'
  - 'vllm@ced6857a:vllm/v1/engine/detokenizer.py#L310-L362'
  - 'vllm-ascend@2c59ff10:vllm_ascend/patch/platform/__init__.py#L19-L45'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py#L19-L44'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_tool_choice_none_content.py#L1-L87'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/__init__.py#L19-L39'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_glm53_reasoning.py#L1-L66'
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/__init__.py#L19-L54'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L466-L485'
  - 'vllm@ced6857a:vllm/v1/engine/output_processor.py#L286-L324'
  - 'vllm@ced6857a:vllm/entrypoints/serve/utils/api_utils.py#L289-L302'
  - 'vllm@ced6857a:vllm/entrypoints/generate/base/protocol.py#L241-L243'
  - 'vllm@ced6857a:vllm/config/scheduler.py#L195-L199'
  - 'vllm@ced6857a:vllm/sampling_params.py#L35-L48'
  - 'vllm@ced6857a:vllm/sampling_params.py#L684-L688'
  - 'vllm@ced6857a:vllm/envs.py#L1123-L1125'
  - 'vllm@ced6857a:vllm/entrypoints/openai/chat_completion/protocol.py#L213-L237'
  - 'vllm@ced6857a:vllm/entrypoints/openai/completion/api_router.py#L67-L72'
  - 'vllm@84030bbe:vllm/entrypoints/openai/sse_keep_alive.py#L1-L65'
  - "vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L318-L349"
  - "vllm@568afb3a:vllm/entrypoints/openai/chat_completion/serving.py#L342-L371"
  - "vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L346-L377"
  - "vllm@84030bbe:vllm/entrypoints/openai/chat_completion/serving.py#L346-L377"
  - "vllm@0fc695fc:vllm/v1/structured_output/__init__.py#L302-L320"
  - "vllm@568afb3a:vllm/v1/structured_output/__init__.py#L362-L380"
  - "vllm@84030bbe:vllm/v1/structured_output/__init__.py#L373-L395"
  - "vllm@ced6857a:vllm/v1/structured_output/__init__.py#L220-L254"
  - "vllm@ced6857a:vllm/v1/structured_output/__init__.py#L351-L362"
  - "vllm@ced6857a:vllm/v1/structured_output/__init__.py#L386-L397"
  - "vllm@0fc695fc:vllm/parser/abstract_parser.py#L809-L905"
  - "vllm@568afb3a:vllm/parser/abstract_parser.py#L931-L940"
  - "vllm@ced6857a:vllm/parser/abstract_parser.py#L973-L982"
  - "vllm@84030bbe:vllm/parser/abstract_parser.py#L969-L978"
  - "vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L679-L733"
  - "vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/stream_harmony.py#L145-L160"
  - "vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L1055-L1068"
  - "vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L1261-L1277"
  - "vllm@568afb3a:vllm/entrypoints/openai/chat_completion/serving.py#L634-L648"
  - "vllm@568afb3a:vllm/entrypoints/openai/chat_completion/serving.py#L678-L680"
  - "vllm@568afb3a:vllm/entrypoints/openai/chat_completion/serving.py#L891-L910"
  - "vllm@568afb3a:vllm/entrypoints/openai/chat_completion/serving.py#L991-L1008"
  - "vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L688-L702"
  - "vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L732-L734"
  - "vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L968-L988"
  - "vllm@ced6857a:vllm/entrypoints/openai/chat_completion/serving.py#L1082-L1100"
  - "vllm@84030bbe:vllm/entrypoints/openai/chat_completion/serving.py#L688-L702"
  - "vllm@84030bbe:vllm/entrypoints/openai/chat_completion/serving.py#L732-L734"
  - "vllm@84030bbe:vllm/entrypoints/openai/chat_completion/serving.py#L968-L988"
  - "vllm@84030bbe:vllm/entrypoints/openai/chat_completion/serving.py#L1082-L1100"
  - "vllm@ba15685a:vllm/v1/engine/output_processor.py#L286-L350"
  - "vllm@ba15685a:vllm/v1/engine/output_processor.py#L731-L925"
  - "vllm@ba15685a:vllm/v1/engine/detokenizer.py#L98-L270"
  - "vllm@ba15685a:vllm/v1/engine/detokenizer.py#L340-L360"
  - "vllm@ba15685a:vllm/entrypoints/serve/utils/sse_keep_alive.py#L1-L55"
  - "vllm-ascend@c09d3e20:vllm_ascend/patch/platform/__init__.py#L19-L55"
  - "vllm-ascend@8d6180e2:vllm_ascend/patch/platform/__init__.py#L19-L55"
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: one-request
    kind: builds-on
    note: 第 7 站的停止分支和 R1 结束时归还 16–17 个块号的账在那一页；本页展开前端怎样把编号变成 SSE 片段
  - to: token
    kind: builds-on
    note: 字节级 BPE 和「推理」「犇」两个例子在那一页；本页讲增量反分词怎样一步步还原并推送
  - to: sampling
    kind: builds-on
    note: 结束 token、停止 token 和长度上限在引擎侧判断，见那一页；本页只讲前端的停止字符串
  - to: request-call-chain
    kind: builds-on
    note: API server、EngineCore 两种进程和它们之间的 ZMQ 通道在那一页
  - to: speculative-decoding
    kind: builds-on
    note: MTP 让一步交回 1–4 个 token，一个片段因此可能带出几个 token 的文字
  - to: api-server-entry
    kind: builds-on
    note: 请求进门时分词、登记反分词器和收集器在那一页；本页接着讲结果回程怎样变成片段
  - to: async-scheduling
    kind: builds-on
    note: 本部署异步调度开着，引擎这一步的结果在下一步开跑后才回收、发往前端
contradicts: []
updated: 2026-11-19T00:00:00.000Z
origin: direct
---

## 流式输出是什么：模型一个个吐出编号，用户怎样一段段看到文字？

**流式输出（streaming output）是边生成边返回：服务在生成过程中，把新生成的 token 编号还原成文字，分批推给客户端，不等整段回答写完再一次交回。** 默认每步处理新编号，但不保证每步都能看到新字。这里有两样东西要分清：模型产出的是 **token 编号**（整数，一个编号代表词表里的一项，见 [token](token.md)）；客户端收到的是 **文本增量**，也就是这一段比上一段多出来的那几个字。两者之间隔着两道工序：把编号还原成文字的**增量反分词**，和检查要不要停下来的**判停**。

推送用的格式叫 **SSE**（server-sent events，服务器推送事件）。普通的 HTTP 响应一次写完；SSE 的响应不关连接，服务器每有一段新内容，就往同一个连接里写一行以「data:」开头的文字，再空一行，客户端读到一段就显示一段。每一段里是一小块 JSON，放着这次新增的文字；最后一段写明结束原因，随后再发一行 [DONE]，表示这条流结束了。

这样通常能更早看到开头；代价是前端要反复拼 JSON、写连接，并维护持续打开的响应。分词字节还没凑齐，或输出仍留在停止字符串缓冲区时，已有 token 暂时不显示，所以“生成了一枚”不等于“马上看见一个字”。

举一个缩到最小的例子。一条请求接下来会生成「推理」，再生成一个少见的字「犇」，然后结束。这两个字沿用 [token 页的例子](token.md#生成的编号怎样变回文字)：「推理」整块是一个 token；「犇」在 UTF-8 里是 E7 8A 87 三个字节，按那一页的示意，分词时被切成两个 token，前一个只有 E7 8A，后一个是 87。

```wiki-diagram
file: streaming-output-intuition
```

图里按默认反分词和停止标记设置，一列是一步。第 1 步，引擎交回编号 9123，反分词查回 6 个字节，正好是两个完整的汉字，于是推出「推理」。第 2 步交回的编号只带来半个字的字节，凑不成字，反分词先把它攒着，这一步推出去的片段里没有新文字。第 3 步的字节和攒着的 E7 8A 凑齐，「犇」才出现。第 4 步抽到结束 token：它是控制用的特殊编号，默认不还原成文字；判停在这一步成立，最后一个片段只写结束原因，随后流结束。

所以「一步」「一个 token」「一个字」「一个片段」之间没有固定的一一对应：这里生成了 3 个普通 token 加 1 个结束 token，屏幕上的文字只变了 2 次，客户端收到了 4 个片段和 1 行 [DONE]（开头其实还有一个只声明「这是助手在说话」的片段，下面拼 SSE 时再讲）。后面还会看到：一步有时交回好几个 token，一个片段有时装下好几步的文字。三样东西对照如下：

| 东西 | 在哪里产生 | 图里的例子 |
| --- | --- | --- |
| token 编号 | 引擎每步交回，有时一步好几个 | 9123、a、b、结束 token |
| 文本增量 | 前端反分词后，这一次比上一次多出的文字，也会是空的 | 「推理」、空、「犇」 |
| SSE 片段 | HTTP 连接上的一行 data，里面是一块 JSON | 4 个片段，外加 [DONE] |

## 为什么要流式：先看到第一段，比等整段更早

**不流式时，客户端要等整段结果；流式时，服务可以在生成途中交付已有内容，通常更早看到开头。** 第一次模型输出不保证立刻成为可见文字：反分词、停止字符串缓冲、推理或工具解析、发送间隔和网络都会影响交付时间。流式不减少模型本身需要生成的位置数，传输与处理开销也可能改变总时延。

大模型逐步生成回答；普通 decode 每步生成一个 token，投机解码则可能一轮确定多个。服务若等全部写完再返回，用户此前看不到生成内容；流式允许把已可交付的内容分段送出。衡量这件事常用 **TTFT**（从发出请求到收到第一个输出 token 的时间）和 **token 间隔**（相邻两次收到新 token 的时间差），它们还要与第一段可见文字的时间分开。第一个输出 token 要等提示词的 prefill 阶段完成：该阶段处理提示词并建立历史状态，可以分多轮执行（见 [prefill](prefill.md)）。用一组忽略额外缓冲与传输差异、每步生成一枚可见 token 的示意数看差别（设首 token prefill 为 $200\text{ ms}$，之后每 token $30\text{ ms}$，共 $200$ 个 token）：

| 交付方式（200 个 token 回答，示意数） | 首段可见时刻 | 整段完成时刻 |
| --- | --- | --- |
| 不流式（整段写完再返回） | $200 + 199 \times 30 =$ **$6{,}170\text{ ms}$** | $6{,}170\text{ ms}$ |
| 流式（`stream: true`） | **$200\text{ ms}$**（之后约每 $30\text{ ms}$ 推一段） | 同样约 $6{,}170\text{ ms}$ |

两种方式的最后一个字都在 6,170 ms 左右到达，流式只是把前面的字提前交出去，生成本身没有变快。

流式也有代价，都落在前端把编号变成文字、再写进连接的那一侧，后文逐个展开：

- **每步每条请求多打一次包。** 反分词和查停止字符串流不流式都要做；流式另外要每步造一份结果、拼一个 JSON 片段、写一次连接，都占前端进程的 CPU。并发越高、每步越短，这部分越显眼，可以用「攒够几个 token 再推」来换。
- **默认排除停止字符串时要扣字。** 结尾几个字要等确认不是停止字符串的开头才推。
- **出错只能写在流里。** 第一段推出时 HTTP 状态码已定成「成功」，之后出错只能往流里写一个错误片段。
- **断开要通知引擎。** 不然引擎会继续白算，还占着显存块。

## 怎么做：一步交回的编号要走过哪几道工序？

**一步的结果先在引擎进程里追加、判停，再经 ZMQ 送到前端进程；前端的后台任务替所有请求反分词、查停止字符串、算出文本增量，每条请求自己的 HTTP 任务再把增量拼成片段写进连接。**

vLLM 服务里有两种进程和这件事有关（见[调用链](request-call-chain.md#七站分在三种进程里)）：接 HTTP 请求的前端进程叫 API server，负责每一步调度的引擎进程叫 EngineCore。本页讨论的文本生成路径在前端完成分词和反分词，前端与引擎之间传递 token 编号等请求和结果数据，用 ZMQ（一个在进程之间收发消息的库）通信。这不限制其他请求携带预计算 embedding 等张量；职责与输入类型的区别见 [vLLM V1 的请求流](vllm-v1-shape.md#vllm-怎样把一条请求变成一步一步的计算)。请求进门时怎样分词、怎样为回程登记反分词器和收集器，见 [API server 入口](api-server-entry.md)；本页从结果回程讲起。下图按先后画出一步的结果怎样从引擎走到客户端。

```wiki-diagram
file: streaming-output-flow
```

下面按图从上往下走一遍。

### 引擎侧：逐个追加、判停，有东西才发

引擎每步拿到每条请求这一步确定下来的 token。一般一步一个；开了 **MTP**（multi-token prediction：模型顺带草拟后面几个 token，下一步和确定的 token 一起送进模型验证，猜对几个就多出几个，见[投机解码](speculative-decoding.md)）时，一步会交回好几个。引擎把它们**逐个**追加到请求上，每追加一个就检查一次：是不是结束 token、是不是请求指定的停止 token、输出数是不是到了上限（规则见 [sampling](sampling.md#什么时候停下来)）。命中了，这一步后面的 token 直接丢掉，不发给前端。

在本页普通文本生成主线中，这一步有新 token 或请求刚刚结束，引擎才为它打一份结果。长提示词分几步做 prefill 时，前几步没有输出 token，也就没有这类生成结果；池化结果、KV 传输参数等另外有交付条件，不能把这个门槛概括成引擎的全部输出。一步里各请求的结果装成一批，经 ZMQ 发到前端。

### 增量反分词：只解新来的编号，凑不齐就等

**反分词器为每条请求单独保留一份状态：已经出现的字节、已经还原的文字。新编号来了，只把它接在后面解；解出完整的字就交出去，只解出半个字就先留着。**

为什么不能每个编号各自解？字节级分词器（见 [token](token.md#字节级-bpe-怎样一步步切出-token)）的一个编号有时只是半个字的字节，单独解出来是乱码，和后面的编号放在一起才是完整的字。另一种办法是每步把全部输出从头解一遍，再和上一次比出新增的部分：结果对，但输出越长，每步重复的活越多。增量反分词避免了这类完整重解码；后续需要拼接已有文字或读取历史的解析分支仍有相应成本，不能据此宣称整个返回处理的每步成本恒定。

vLLM 有两种实现。分词器是 Hugging Face tokenizers 库的快速分词器、并且这个库的版本不低于 0.22 时，用库里自带的解码流：开流时先把提示词的编号喂进去，之后每来一个编号走一步，字节凑成完整的字才返回文字，否则返回空。其他分词器走纯 Python 的慢速实现，思路相同：记住已经解到哪里，每次只解最后几个编号，结尾是不完整的字就先不交。

这一步还顺带处理两件小事。一是请求因为结束 token 或停止 token 而结束时，默认不把那个编号送去还原，它不会变成文字。二是特殊 token（模板和控制用的编号）显不显示，由请求的 skip_special_tokens 设置决定，默认不显示；词表里没有标成特殊的标记，照常还原成文字。

### 停止字符串：先扣住结尾几个字

**请求设了停止字符串，前端要在还原出的文字里找它。默认要求输出不含停止字符串；它不一定在同一步里出齐，所以每次推送都扣住结尾「最长停止字符串的长度 − 1」个字，确认安全了再推；命中后，文字截到停止字符串之前，结束原因记为 stop。**

停止字符串（请求参数 stop）的意思是「输出里出现这段文字就停」。它和停止 token 不同，按文字比对，只能在反分词之后做，所以放在前端（停止判断怎样分在两处，见[第 7 站](one-request.md#第-7-站-返回与收尾)）。每次只在新增的文字和它前面紧挨的一小段里找，不重扫整段输出。

为什么要扣字？设停止字符串是 `###`，沿用默认的排除设置。某一步的新文字以一个 `#` 结尾，前端还不知道下一步会不会再来两个 `#`：如果马上把这个 `#` 推出去，等后面凑成 `###` 时它已经显示在用户屏幕上，撤不回来。所以每次都少推结尾 $3 - 1 = 2$ 个字；请求结束时不再扣，剩下的字一次推完（示意数）：

| 步次（停止串 `###`，每次扣住 $3 - 1 = 2$ 字） | 当前已有文本 | 累计可推字数算式 | 本步推出增量 |
| --- | --- | --- | --- |
| 第 1 步 | 「答案」 | $2 - 2 = 0$ | 空（什么都不推） |
| 第 2 步 | 「答案是42」 | $5 - 2 = 3$ | 「答案是」 |
| 第 3 步 | 「答案是42#」 | $6 - 2 = 4$ | 「4」 |
| 第 4 步（命中 `###` 并截掉，已结束不扣） | 截后剩「答案是42」 | $5 - 0 = 5$ | 「2」 |

第 4 步时，引擎其实不知道该停：它只看编号，停止字符串是前端发现的。所以前端截断之后，还要通知引擎终止这条请求，引擎随即归还它占的显存块，也就是流程图里标着「终止」的那条线。如果请求要求把停止字符串留在输出里（include_stop_str_in_output），前端就不扣字，截断位置也挪到停止字符串之后。一圈交回好几个 token 时，新文字里有时同时出现几个停止字符串，取哪一个各版本不同，见[版本差异](#版本差异)。

### 拼成 SSE：一条请求从头到尾收到什么

**请求带 stream: true 时，结果按「增量」交出：每次只带这次新增的文字和编号。HTTP 任务先发一个声明角色的片段，之后每拿到一次结果发一个片段，最后一个片段带结束原因，再发 [DONE]。**

请求不带 stream 时，前端中途不交任何结果，只在结束时交一份完整的输出，HTTP 一次返回整段 JSON。带上 stream 时，首屏那条请求在聊天接口上收到的流大致如下（JSON 删去了 id、模型名等字段）：

```text
data: {"choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}

data: {"choices":[{"index":0,"delta":{"content":"推理"}}]}

data: {"choices":[{"index":0,"delta":{"content":""}}]}

data: {"choices":[{"index":0,"delta":{"content":"犇"}}]}

data: {"choices":[{"index":0,"delta":{"content":""},"finish_reason":"stop"}]}

data: [DONE]
```

几处值得注意：

- **片段可以是空的。** 这一步有新编号，却没有能推的新文字（半个字的字节、被扣住的结尾），照样发一个 content 为空的片段。
- **结束片段可以没有文字。** 结束 token 不还原，这一步如果只交回了结束 token，最后一个片段就只有结束原因。结束 token、停止 token、停止字符串都记作 stop，长度到限记作 length。
- **用量是可选的。** 请求在 stream_options 里打开 include_usage，[DONE] 之前多一个用量片段，choices 为空，写着提示词和输出各多少个 token；还要同时打开 continuous_usage_stats，才会在中途片段带上用量。多个回答并行时，中途数的是当前回答，末尾空 choices 的用量才汇总全部回答，不能把中途各次累计数相加。
- **中途出错也走流。** 生成过程中出了异常，流里写一个错误片段，随后照样发 [DONE]。

### 前端跟不上时：几步的文字并成一段

**后台输出任务和 HTTP 任务之间，每条请求只有一个收集器格子。HTTP 任务还没取走上一份，新的一份就并进去，这时一个片段装着好几步的文字；文字不会丢，也不会乱序。**

两类任务在同一个进程里轮流跑（Python 的 asyncio：同一时刻只有一个任务在执行，一个任务等待时把 CPU 让给别的任务）。后台任务处理一批结果时，每处理一片（默认 128 条请求）就让出一次，好让 HTTP 任务把已经算好的增量写出去。负载重的时候，HTTP 任务来不及每步都取，收集器就把几次增量的文字和编号接在一起，下次一并发出。所以客户端收到的片段数会少于步数，这是正常现象。

还有一种是有意的合并：启动参数 --stream-interval，默认 1。HTTP 流式请求用增量模式；设成 N 时，除了第一份和最后一份，每攒够 N 个新 token 才交出一次，片段变少，前端造结果和发片段的开销也随之减少，代价是文字一顿一顿地出。这里数的是 token，不是毫秒、汉字或模型步数；MTP 一步交来多个 token 时可以超过门槛才发出。举例，间隔 3、每步恰好 1 个 token、共 6 步且最后一步结束，会在第 1、4、6 步交出结果。

Python 直接接引擎结果时还有两种模式：累计模式每次交截至目前的全部内容，最终模式只在结束时交一次。四份固定源码里，累计模式没有更新间隔计数的起点，仍每步交出结果；最终模式仍只交末尾。这个例子的推送节奏专指增量模式。

## 思考段、工具调用和断开连接：流里还会出现什么？

**配了解析器时，同一段新文字会被分进不同的字段；客户端断开时，前端通知引擎终止请求。** 这里先看解析与交付分工；下一节再区分隐藏思考的请求设置，以及它与结构化输出组合时对引擎的影响。

- **思考段。** 有的模型先写思考过程，再写答案。服务配了 reasoning parser（按思考标记把输出切成思考段和答案段的解析器）时，片段里思考的文字放进 reasoning 字段，答案放进 content；没配时都在 content 里，思考标记本身如果不是特殊 token，也作为文字出现在流里。
- **工具调用。** 服务配了 tool-call parser、请求带了工具定义时，模型写出的调用被解析成 tool_calls 字段，函数名和参数一段段推出。解析器还没认出完整结构的那几步，可以一个片段都不发。普通 Chat 路径中，auto 或 required 实际发出了工具调用时，收尾原因改为 tool_calls；指定函数名的调用则保留引擎结束原因，通常为 stop，也可能因长度到限而为 length。不能看到工具参数就一律等待 tool_calls 收尾。
- **一次要几个回答。** 请求的 n 大于 1 时，每个回答有自己的序号（index），片段按序号区分，各自有自己的结束片段。
- **带 logprobs。** 在允许返回概率记录的分支，每个片段只带这次新增那几个 token 的记录；新版关闭思考返回时对逐 token 元数据的额外处理见下节。
- **客户端断开。** 这条请求的 HTTP 任务被取消，前端通知引擎终止，和停止字符串命中走同一条线（流程图右下）。

## 隐藏思考、少思考和不思考，是同一个开关吗？

**隐藏已经生成的思考文字，只改变读者能看到什么；要求模型少生成思考，则要改变输入或执行规则。** 这三类控制处在不同位置，不能仅凭名字相近就互相替代：

| 想控制什么 | 在哪一步起作用 | 应当检查什么 |
|---|---|---|
| 不把思考段交给客户端 | 输出解析与返回 | 解析器能否识别思考段、当前版本是否过滤流式片段 |
| 请求某种思考强度或关闭思考模式 | 输入的聊天模板 | 模型模板是否支持、请求字段与服务默认怎样合并 |
| 思考至多生成多少 token | 引擎与采样执行链 | 模型思考边界、预算处理器及 runner/MTP 的实际支持 |

例如模型实际先输出一段思考，再输出“巴黎”。解析器能分开两部分，且该版本支持流式过滤时，客户端可以只收到答案部分；先前的思考仍经过模型计算，隐藏它没有撤销这些计算。若未配置能识别思考的解析器，两部分都作为普通 content，关闭思考返回的字段不会自动从文字里找出并删除思考。固定 GLM 原配方就没有配置 reasoning parser，不能只给请求加一个 false 来解决。

隐藏还有一个容易漏掉的代价：较新普通 Chat 解析分支同时停止返回逐 token 的概率记录和编号，**答案部分的这些元数据也受影响**。客户端还想分析答案的概率时，必须一起核对这个组合，不能把“隐藏思考”理解成只少一个显示字段。旧基线的普通流式分支又没有同样的过滤行为，具体区别见版本表。

另有一个会影响计算的组合：请求同时使用结构化输出时，四版普通非 beam Chat 入口在关闭思考返回后，会向引擎标记“思考已结束”。文法约束于是可以从输出起点生效，而不是等待真实思考结束标记。因此不能把这个开关概括为任何场景都只改显示、绝不影响生成。约束启用的判断见[结构化输出](structured-output.md#思考阶段官方命令从第一个输出-token-起就约束)，真正的 token 预算见[采样页](sampling.md#思考预算怎样让模型转去回答)。

## DeepSeek Recipe：编号流与文本流的边界不同

DeepSeek Recipe 的流处理器既能接 token 编号，也能接已经还原好的文本。接编号时必须绑定匹配的 tokenizer；一个字符尚未凑齐时会先缓冲。显式特殊 token 会被单独标记，供解析器识别思考段、工具调用等边界；普通 token 拼出相同字面内容时，仍按正文处理。接文本时已经没有 token 边界，标记只能按文字匹配。

因此，同一份输出“看起来一样”，两条接入路径仍可能得到不同字段。遇到思考段切错、工具参数混进正文，先记录输入块到底是编号还是文本、特殊标记是否保留，再比较解析事件。只有事件正确而客户端显示错误时，才继续查序列化与传输。通用取证顺序见[输出异常排查](inference-correctness-troubleshooting.md)。

结束也有两层：推理后端报告结束原因，流处理器完成解析并交出剩余事件。Python 接入按块处理以后还要调用处理器的结束方法；调用方再把得到的事件真正发送给客户端。拿到一个“后端停止”标志，不足以证明尾部内容与结束事件已经送达。

## 落到 GLM 双机：R1 的编号怎样变成片段

**R1 是提示词为 4 个 token 的示例请求（设定见[一条请求](one-request.md#示例请求-r1-与官方双机部署)），这里假定它按流式发出。它分到 DP0：node0 的 EngineCore_DP0 每圈把它的结果经 ZMQ 发给 node0 上唯一的 API server，反分词和推送都在那个进程里做。有 MTP 时一圈交回 1–4 个 token，HTTP 任务及时取走时，一个片段就带出 1–4 个 token 的文字。**

### 一个前端进程，接两个 DP 组的结果

本页沿用[部署前提](glm-5-3-flash-two-node.md#部署前提)。官方启动只开 1 个 API server，所以两台机器上两个 DP 组的结果都送到 node0 这一个进程，所有请求的反分词、查停止字符串、拼片段都挤在它的 CPU 上。每个 DP 组每步最多跑 32 条请求，一批结果最多 32 条，小于每片 128 条，一批不会再被切开处理。官方命令没有写 --stream-interval，取默认 1：每圈每条有新 token 的请求都交出一份结果。

这套配置按默认打开了[异步调度](async-scheduling.md)：引擎先把下一圈排好、发给 NPU，再处理上一圈的结果、发往前端。推送仍是每圈一次，只是每一圈的结果在下一圈开跑之后才离开引擎。

### R1 前三圈：每个片段由几个 token 还原

前端只收到引擎确定下来的 token。MTP 的候选在引擎里验完，被拒的那些从来不离开引擎，前端看不到「先显示、再撤回」的文字。沿用一条请求页[三步的账](one-request.md#三步的账)里的假设（三圈合计 $1 + 2 + 4 = 7$ 个 token）：

| 步次（接受几个为教学假设） | 交给前端的 token 数 | 对应 token |
| --- | --- | --- |
| prefill 一圈 | $1$ | $y_0$ |
| decode 1（3 个候选接受 1 个） | $1 + 1 = 2$ | $y_1,\; y_2$ |
| decode 2（3 个候选全接受） | $3 + 1 = 4$ | $y_3 \text{ 到 } y_6$ |
| **前三圈合计** | $1 + 2 + 4 =$ **$7$** | $y_0 \text{ 到 } y_6$ |

HTTP 任务每圈都及时取走的话，客户端在角色片段之后收到 3 个内容片段，分别由 1、2、4 个 token 还原而来。每个片段有几个字，要看这些编号代表哪些字节：常用词一个 token 就是两个字，少见的字要两个 token 才出一个字，不能按 token 数换算。接受几个是为了把账走通设的例子，不是实测的接受率。

### GLM 的分词器和思考标记

GLM 的分词器是字节级 BPE（见 [token](token.md#glm-的分词器是字节级-bpe)），配置里声明用 tokenizers 库做后端，属于快速分词器，所以走解码流那条实现，前提是镜像里 tokenizers 库不低于 0.22。

GLM 的聊天模板把 &lt;think&gt; 放在提示词末尾，模型从第一个输出 token 起就在写思考过程。它和收尾的 &lt;/think&gt; 编号是 154841、154842，落在 token 页所说的 36 个特殊标记的编号段里，但分词器文件给它们的 special 标志是 false，所以默认设置去不掉它们。官方双机命令没有配 reasoning parser，所以思考文字、&lt;/think&gt; 这个标记和后面的答案，全都按顺序出现在 content 里，客户端要自己按 &lt;/think&gt; 切开。官方教程为函数调用给的配置加了 tool-call parser glm47 和 reasoning parser glm45；配上以后，思考文字改放进 reasoning 字段（解析器怎样判断思考结束，见[结构化输出](structured-output.md)）。

GLM 的三个结束编号 154820、154827、154829 都标成了特殊 token（各是什么，见 [token](token.md#编号要落在-154880-行之内)）。它们被抽中时引擎判正常结束，按默认设置编号本身不还原成文字，结束原因记作 stop。

含 GLM 代码的昇腾快照 db701c1f 还给聊天接口的流加了一层 GLM 专用补丁，只在流里出现工具调用时起作用：最后一段工具参数原本和结束原因 tool_calls 挤在同一个片段里，补丁把它拆成两个片段，先发参数，再发一个只带结束原因的空片段。

### 收尾：长度到限，再归还块号

设 R1 的 max_tokens 是 200，与[第 7 站](one-request.md#第-7-站-返回与收尾)的设定相同。最后一圈之前已经输出 197 个 token，这一圈验证又产出 4 个；引擎追加到第 200 个时判长度到限，只把前 3 个发给前端。前端把这 3 个还原、推出，最后一个片段带结束原因 length，随后发 [DONE]。请求不写 max_tokens 时，输出上限是部署的总长度上限 133120 减去提示词长度（见 [sampling](sampling.md#停止判断和长度上限)）。

引擎这边在判停的同一圈结束请求，R1 手上的 16–17 个块号一次性还回空闲队列，怎么数出来的见第 7 站。如果先命中的是停止字符串，顺序反过来：前端先截断、结束这条流，再通知引擎终止，引擎收到后才归还块号。这条路上中止消息怎样走、已经在算的那一步结果怎样处理，见[请求收尾](request-teardown.md#前端先发现停止字符串和客户端断开)。

## 常见误解

- **「一个片段就是一个 token。」** 不是。一圈交回 1–4 个 token；前端跟不上时，几圈的文字还会并成一个片段；只带来半个字的编号，对应的是一个空片段。片段数、token 数、字数各算各的。
- **「流式让生成变快了。」** 生成本身一样快，最后一个字到达的时间基本不变；变的是第一段文字提前出现。前端为每圈每条请求多造一份结果、多拼一个片段，还要多占一些 CPU。
- **「MTP 先把猜的 token 推给用户，猜错再撤回。」** 候选只在引擎里验，前端只收到验完确定下来的 token，流里没有撤回这回事。
- **「停止字符串和结束 token 一样，都在引擎里判断。」** 结束 token、停止 token 和长度在引擎里判；停止字符串要先还原成文字，只能在前端判，命中后前端再通知引擎终止。
- **「反分词在 NPU 上或 worker 里做。」** 在 node0 的 API server 进程里、用 CPU 做；worker 只交出编号。
- **「content 为空的片段说明出了问题。」** 半个字的字节、为等停止字符串确认而扣住的结尾，都会让这一圈没有可推的文字，空片段是正常的。
- **「GLM 的思考过程会自动放进 reasoning 字段。」** 只有服务配了 reasoning parser 才会这样分；官方双机命令没配，思考文字和 &lt;/think&gt; 都在 content 里。

## 对照源码

乱码、空答案或显示停顿时，同时保留引擎输出编号、原始响应片段和客户端最终显示：编号已经不同，进入[正确性排障](inference-correctness-troubleshooting.md)；编号正常而交付晚，进入[返回等待分支](inference-performance-troubleshooting.md#设备算完了客户端却还在等)。一个片段含多个 token 时，按[测量页](inference-benchmarking.md)标清片段间隔与逐 token 指标的区别。

### 怎么开

**普通 Chat 的 include_reasoning 默认 true。** 需要过滤已识别的思考输出时，将 include_reasoning=false 放在 /v1/chat/completions 的请求 JSON 顶层；使用客户端 SDK 的 extra_body 时，线上字段仍在顶层，不能再嵌套一层同名对象。服务端 reasoning parser、模型标记和流式分支须匹配；它不是关闭模型思考的通用开关，也不会自动补上一个解析器。

| 思考相关入口 | 默认与位置 | 实际作用 |
|---|---|---|
| include_reasoning | Chat 顶层 bool，默认 true | 控制解析后的思考返回；普通非 beam 请求的 false 还使 reasoning_ended=True 传入引擎，影响结构化约束起点 |
| reasoning_effort | Chat 顶层，默认 None | 将模型特定的强度要求交给模板；接受 none、minimal、low、medium、high、xhigh、max，不是统一的 token 数 |
| chat_template_kwargs.enable_thinking | 模板变量，无跨模型统一默认 | 显式请求值与自动注入的优先级见[入口页](api-server-entry.md#怎么开)，有效语义由模型模板决定 |
| thinking_token_budget | 独立预算字段 | 消费链与版本限制见[采样页](sampling.md#怎么开)，不由隐藏返回自动设定 |

后三版普通 Chat 在解析器对象存在且 include_reasoning=false 时，会清空整段返回的 logprobs，并不输出 token_ids，流式与完整响应都如此；不是只删除属于思考的几项。没有解析器时仍沿普通 content 分支返回，字段本身不执行文本内容识别。排查时同时保留实际模型、模板、parser 名称、stream 值及原始返回字段。

**先选入口。** Chat Completions 与 Completions 的请求 JSON 用 stream 控制 HTTP 是否流式；Python SamplingParams 用 output_kind 控制引擎交结果的方式。后者的默认值不能套到 HTTP 上。下表默认值适用于四份固定 vLLM 源码；服务端强制用量和 rc2/main 请求间隔的例外单列。

| HTTP 请求字段 | 类型与默认 | 作用、边界 |
| --- | --- | --- |
| stream | bool 或 null，默认 false | true 返回 SSE；false、null 或省略返回完整 JSON。Chat 与 Completion 都转换成：流式用 DELTA，非流式用 FINAL_ONLY |
| n | 整数，默认 1 | 同一提示词生成几个候选，至少 1，最多 VLLM_MAX_N_SEQUENCES（默认 16384）；这是校验上限，不是本部署可同时运行的条数。Chat 的 null 在转换时按 1；Completion 不声明可空。Python SamplingParams 默认也为 1 |
| stream_options | StreamOptions 对象或 null，默认 null | 流式的用量选项容器；非空对象要求 stream=true。不是控制分词、采样或输出模式的容器 |
| stream_options.include_usage | bool 或 null，默认 false | true 时在 [DONE] 前另发 choices=[] 的总用量片段；false/null 不要求这个片段 |
| stream_options.continuous_usage_stats | bool 或 null，默认 false | 必须与 include_usage=true 同时开启，才在流中附上进行到当前的用量；单开不生效 |

n 大于 1 时，每个候选是独立子请求，输出用 index 对号，不能按片段抵达顺序拼成一段。固定实现给子请求的 n 设为 1；显式 seed 按 seed+index 分配，未设 seed 不这样派生。相同提示词不保证不同回答；temperature=0 的贪心路径要求 n=1。多个候选会增加生成量、活跃序列和 KV 压力；它不是 DP 副本数、不是批量提示词数，也不是长度上限。并发预算见[调度器](vllm-scheduler.md)，采样与种子见[采样](sampling.md)。

用量开关有服务端覆盖：enable_force_include_usage 为 true 时会强制开启最终与连续用量，不能再用请求 false 关闭。Chat 中途的 completion_tokens 是当前 index 已生成的数量，末尾总量才把各候选相加；提示词计一次。Completion 可接多个提示词，其中途按当前提示词/候选计，最终分别求所有提示词和所有候选之和。中途值不是增量，不要逐片相加；断连或出错也不能假定一定收到正常的最终用量片段。

下面是 Chat Completions 的请求体示例，model 换成服务实际登记的名称。n=2 配非零温度；使用默认特殊 token 隐藏规则，既要持续统计也要最终汇总：

```json
{
  "model": "你的服务模型名",
  "messages": [{"role": "user", "content": "用一句话解释 KV cache"}],
  "n": 2,
  "temperature": 0.8,
  "max_tokens": 32,
  "stream": true,
  "stream_options": {"include_usage": true, "continuous_usage_stats": true}
}
```

客户端按 index 分开追加正文，并把 choices=[] 当用量片段而不是第三个回答。例如两个候选分别生成 2、3 个 token，提示词为 8 个 token 时，中途 index=1 的用量可以是 completion_tokens=3；最终汇总是 5。下面只截出关键字段，是计数示意，不是上面提示词的实际分词结果：

```text
data: {"choices":[{"index":1,"delta":{"content":"…"}}],"usage":{"prompt_tokens":8,"completion_tokens":3,"total_tokens":11}}

data: {"choices":[],"usage":{"prompt_tokens":8,"completion_tokens":5,"total_tokens":13}}

data: [DONE]
```

通过兼容 SDK 调用时，核对它最终发送的 JSON：stream、n、stream_options 在请求顶层；三个文字格式开关也在顶层，不放进 stream_options。SDK 未提供某个扩展字段的原生形参时，要用该 SDK 的扩展请求体入口传递；Python SamplingParams 则是直接构造引擎采样参数，和 HTTP 客户端参数表不是同一个接口。

**编号怎样变成文字。** 下列三个格式开关既可在 HTTP JSON 顶层设置，也可传给 SamplingParams；detokenize、output_kind 只属于 Python 采样参数，这两个 HTTP 协议不直接提供它们。不是把 SamplingParams 所有字段塞进请求就能改变服务行为。

| 参数 | 默认 | 生效条件与结果 |
| --- | --- | --- |
| detokenize | bool，true | false 时保留生成的 token_ids，text 为空字符串，不做文本反分词；不能同时设非空 stop 字符串。不会停止生成，也不等于 skip_tokenizer_init |
| include_stop_str_in_output | bool，false | false 排除命中的停止串并扣尾字；true 保留该串、不扣尾字。还影响因终止 token 结束时是否将最后一个编号送去解码；显示仍受 skip_special_tokens 约束 |
| skip_special_tokens | bool，true | true 隐藏分词器认定的特殊 token；false 允许还原它们。普通词拼出的同名字面标记不会因此删掉；GLM 的思考标记特例见上文 |
| spaces_between_special_tokens | bool，true | 控制保留特殊标记时的相邻标记空格处理，不是普通文字间加空格。快速路径只在 skip_special_tokens=false 且本项=false 时额外抑制相邻 added token 间的空格；true 沿用解码器输出，不保证每种分词器都插入空格 |
| output_kind | RequestOutputKind，CUMULATIVE | 直接使用引擎输出的 Python 调用方选择下表模式；它不是 SSE 开关，HTTP 已按 stream 派生 |

停止串与结束编号的完整边界、无反分词的冲突，复用[请求收尾的参数参考](request-teardown.md#怎么开)。停止词匹配的四步扣字例子仍在本页前文。detokenize=false 时，三个文字格式开关不产生文本效果；不要把空 text 误判成模型没生成。

空格还取决于分词器路径：慢速实现遇到非 fast 且有 added 词表的分词器时，会按该开关决定普通文本片段与 added token 片段之间用空格还是空串连接；其他分支沿用分词器的转换方法。它与快速路径的相邻 added token 处理范围不完全一样，也不是对最终文字做全局去空格。需要保留控制标记的调用方，应一起核对分词器类型和实际返回文本。

| Python output_kind | 每次收到什么 | 调用方怎样使用 |
| --- | --- | --- |
| RequestOutputKind.CUMULATIVE（0） | 截至当前的全部文字和编号 | 用新结果替换旧结果；逐次拼接会重复。四版固定实现不会按 stream_interval 限频 |
| RequestOutputKind.DELTA（1） | 自上次交付以来的新文字和编号 | 按同一 index 追加；间隔和收集器可能合并多步 |
| RequestOutputKind.FINAL_ONLY（2） | 完成后的一份完整结果 | n>1 时等待所有子请求结束后一次返回全部候选 |

Python 需要 token 编号而不需要文本时，可构造下列参数交给接受 SamplingParams 的生成入口。这里没有设置 stop 字符串；结束 token 和长度判停仍存在。实际入口可能自行指定输出模式，读取迭代结果的调用方应按该入口约定消费。

```python
from vllm import SamplingParams
from vllm.sampling_params import RequestOutputKind

params = SamplingParams(
    n=1, max_tokens=8, detokenize=False,
    output_kind=RequestOutputKind.FINAL_ONLY,
)
```

**推送间隔与服务设置。** --stream-interval 对应引擎配置 stream_interval，整数、默认 1、下界 1；按每条请求的新增 token 数触发，不是固定时间刷新。在 HTTP 的 DELTA 路径里，首份和最终份立即交出，其他份达到间隔再交；第一份可能为空文字，不能把“首份不等待”直接当成可见首字时延保证。设 3 的六步例子见上文，累计和最终模式不能套用它。

v0.23 基线和 v0.26 rc 没有请求级 stream_interval；v0.30.0rc2 配套上游与固定 main 的 SamplingParams 以及两种 HTTP 请求提供它，默认 None、显式值至少 1，最终取请求值与服务设置的较大者。例如服务为 4，请求设 2 仍按 4，设 8 则按 8；省略沿用服务设置。固定双机命令没设 --stream-interval，仍取 1。不能把新版请求字段用于解释基线镜像。

VLLM_V1_OUTPUT_PROC_CHUNK_SIZE 默认 128，控制后台任务一片处理多少条请求结果，与推送间隔的 token 计数不同。官方函数调用教程另有 --reasoning-parser glm45、--tool-call-parser glm47，基础双机命令没有这两项。

**等待期间的 SSE 保活。** `--sse-keep-alive-interval` 对应前端配置 sse_keep_alive_interval，单位秒，默认 0 表示不发送；设为正整数后，Chat Completions / Completions 的流式响应连续这么久没有片段，就发送一条 SSE 注释。它适用于请求排队、prefill 尚未产出 token 或输出之间的等待，与上面的“攒够几个 token 再交付”是两件事。

例如在支持该选项的服务命令里加 `--sse-keep-alive-interval 10`，无新片段约 10 秒时，线上可能出现以下内容（随后空一行）：

```text
: keep-alive
```

符合 SSE 协议的客户端忽略这条注释。它不是模型 token、usage 或 [DONE]，不能拿它计算 TTFT 或认为模型已经开始输出答案。注释能给按读取空闲时间计时的代理持续提供字节，但前提是代理及时转发、间隔短于相关读超时；它不取消客户端总超时，也不保证所有代理配置都能保持连接。一次响应结束后的 HTTP 空闲连接等待则由[API 入口的 keep-alive](api-server-entry.md#怎么开)控制。此处没有代理或双机实测；具体版本可用性见下表。

### 会报什么错

| 输入组合 | 结果与处理 |
| --- | --- |
| n 非整数、低于 1 或超过环境上限 | SamplingParams 拒绝；基线含 n must be an int / at least 1 / at most 的错误。HTTP 先经过协议类型解析，不能将 Python 异常类型直接当成响应格式 |
| 贪心采样但 n>1 | n must be 1 when using greedy sampling；改为单候选，或按任务需要使用非贪心采样 |
| detokenize=false 且 stop 非空 | stop strings are only supported when detokenize is True.；改为文本反分词，或使用编号/长度停止，不能靠格式开关绕开 |
| 非空 stream_options 配 stream=false/null/省略 | Stream options can only be defined when `stream=True`.；打开流式或移除选项。原始空对象 {} 的真值检查不触发这一条，不应把它当作非流式启用用量配置的方法 |
| 服务 stream_interval<1；rc2/main 请求间隔<1 | 配置或请求校验拒绝，错误包含 stream_interval must be at least 1；间隔不是允许 0 表示禁用的开关 |
| SSE 保活间隔为负数或非整数 | CLI 拒绝；本项允许 0 关闭，和 stream_interval 的下界不同 |

只开 continuous_usage_stats、却没开 include_usage，是不增加连续用量而非报错；特殊标记没显示时先核默认隐藏规则和终止编号处理，再查解码异常。既有运行期日志如下：

- `Encountered invalid prefix detokenization error for request %s, resetting decode stream.`：快速分词器的解码流内部状态被罕见的非法 UTF-8 输出打乱，前端重建解码流后继续，是 warning。
- `Encountered invalid token id: %r`：解码流遇到无法处理的编号，记一条异常，这个编号按空文字处理，流不断。
- `Error in chat completion stream generator.`：拼片段时出了异常，流里写一个错误片段，随后照样发 [DONE]；客户端看到的 HTTP 状态码仍是成功。
- `Request %s failed with an internal error during generation`：引擎把请求的结束原因标成 error，前端记这条错误日志，流里写一个内容为内部错误（500）的片段。
- `Request %s aborted.`：客户端断开、HTTP 任务被取消，前端已通知引擎终止；只在打开请求日志时打印。

### 开销和什么时候别开

流式多出的活都在前端。默认开启反分词时，无论是否流式，每圈都解码并检查所设停止串；流式还要造结果、唤醒 HTTP 任务、拼 JSON 和写连接。间隔减少的是交付次数，不是让模型少生成，也不会按比例省掉反分词。本部署只有一个 API server 进程，两个 DP 组最多 64 条在跑的请求都由它处理。这部分开销本页没有实测数。

- 只要最终结果的离线批量任务、评测脚本，不需要流式，一次返回更省事。
- 并发高、前端 CPU 吃紧时，可以把 --stream-interval 调大，用更少的片段换更低的交付开销；首份结果不被间隔挡住，但可见文字仍受反分词、停止串缓冲和解析器影响，实际 TTFT 需测量。
- 默认排除停止字符串时，串越长，扣住的字越多，结尾几个字就越晚出现；设了很长的停止字符串时，流的最后一段会明显「攒一下再出」。
- n 先从任务需要的最小候选数起；持续用量会增加片段体积和序列化工作，只需总量就只开 include_usage。需要文字显示或文本停止的业务保持 detokenize=true。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）；GLM 双机算例固定在例外 B 专用镜像 `vllm-ascend@db701c1f` + `vllm@0fc695fc`。

下表限定普通 Chat 的思考过滤解析分支；Harmony 等专门协议有自己的消费者，不能从一条分支推广所有接口：

| 关闭思考返回后的行为 | `v0.23.0`（`0fc695fc`） | `v0.26.0rc`（`568afb3a`） | `v0.30.0`（`ced6857a`，主基线） | `main`（`ba15685a`） |
|---|---|---|---|---|
| `include_reasoning` 默认 | `true` | 相同 | 相同 | 相同 |
| 普通流式解析 | `parse_delta` 没有按该字段清除 reasoning，不能承诺隐藏 | 清除 reasoning；只有思考且没有正文/工具时跳过该片段 | 相同 | 相同 |
| 有解析器的完整返回 | 清除 reasoning | 相同 | 相同 | 相同 |
| 有解析器时逐 token 元数据 | 不因该字段统一清除 `logprobs`/`token_ids` | 清除整段 `logprobs`、停止返回 `token_ids`，包括答案段 | 相同 | 相同 |
| 普通非 beam 请求送引擎 | `false` 时送 `reasoning_ended=True` | 相同 | 相同；结构化管理器用约束起点计算 | 相同 |

基线 Harmony 的 analysis 通道另有显式 `include_reasoning` 判断，不属于表中缺少过滤的普通 `parse_delta` 分支。Responses 也有独立协议和返回构造，不能将这张 Chat 表当成其全部流式、工具及会话行为的说明。

`v0.30.0`（`ced6857a`）与 `main`（`ba15685a`）均将 SSE 保活入口放在 `entrypoints/serve/utils/sse_keep_alive.py`（`ChatCompletion` 仍用 `with_sse_keep_alive` 包装异步生成器后交给 `StreamingResponse`），并在 `OutputProcessor` 新增、取消与完成请求时更新共享准入计数；它统计前端负载，`stream_interval` 控制输出节奏，两者不能互相替代。

Recipe 的编号/文本路径与结束行为仅核对 `935817c6`，不属于下方 vLLM 四版表。Rust 使用 `InferenceChunk::Tokens`、`Text`、`Finish`；Python 用 `push` 处理块，再用 `finish` 完成响应处理。未绑定 tokenizer 的编号流会失败。

本页的控制流和前端代码在上游 vLLM，GLM 绑定算例引 `vllm@0fc695fc` 配 `vllm-ascend@db701c1f`；实际安装组合按[来源基线](../sources/glm-5-3-flash-baseline.md)核对。

**上游 vLLM 四版对照（增量反分词、推送节奏与 SSE 保活）：**

| 项 | `v0.23.0`（`0fc695fc`） | `v0.26.0rc`（`568afb3a`） | `v0.30.0`（`ced6857a`，主基线） | `main`（`ba15685a`） |
| --- | --- | --- | --- | --- |
| 快速反分词类与增量更新 | `PreTrainedTokenizerFast` | `TokenizersBackend` | 同 `v0.26.0rc`（`detokenizer.py#L310-L362`） | 同 `v0.30.0`（`detokenizer.py#L98-L270`） |
| 同轮命中多个停止串 | 按请求列表，取第一个找到的 | 同 `v0.23.0` | 取文字里最先完成者，并列按列表顺序 | 同 `v0.30.0`（`detokenizer.py#L340-L360`） |
| 请求级 `stream_interval` | 无 | 无 | 默认 `None`；有值时与服务设置取大（`output_processor.py#L286-L324`） | 同 `v0.30.0`（`output_processor.py#L286-L350`） |
| 推理与工具解析 | 已为每个候选创建组合解析器并调用 `parse_delta` | 继续使用组合解析器 | 继续使用组合解析器 | 继续使用组合解析器 |
| 角色、增量、结束、用量、`[DONE]` | 均有 | 相同 | 相同 | 相同 |
| 收集器合并、每片 128 条、服务间隔默认 1 | 有 | 相同 | 相同（`output_processor.py#L51-L102`） | 相同（`output_processor.py#L731-L925`） |
| HTTP `stream` / `stream_options` / 两项用量默认 | `false` / `None` / `false` / `false` | 相同 | 相同 | 相同 |
| `n` 默认、下界、环境默认上限 | `1` / `1` / `16384` | 相同 | 相同 | 相同 |
| `detokenize` / 包含停止串 / 隐藏特殊项 / 特殊项间空格 | `true` / `false` / `true` / `true` | 相同 | 相同 | 相同 |
| Python / HTTP 输出模式 | `CUMULATIVE`；`DELTA` 或 `FINAL_ONLY` | 相同 | 相同 | 相同 |
| SSE 注释保活选项 | 无 | 无 | 有；`0` 关闭，正整数秒（`serve/utils/sse_keep_alive.py#L1-L65`） | 同 `v0.30.0`（`serve/utils/sse_keep_alive.py#L1-L55`） |

停止串的差异在一步交回多个 token 时尤其明显：旧版按请求列表取命中串，结果会受列表顺序影响，未必等于逐 token 检查时先遇到的停止位置；rc2/main 选择文字里最先完成的串，使这一点与逐 token 检查保持一致，并列时才使用列表顺序。

四版的连续用量均要求 include_usage，服务强制用量可覆盖请求；贪心要求 n=1，Chat 的 n 可空并按 1，Completion 不声明可空。文字格式表中的 detokenize 只在 Python，其余三项也在 HTTP 顶层。累计模式不按间隔限频，最终模式只在结束返回。字段相同不表示解析器的模型适配或所有结束片段都相同，工具调用还须按前文的 named 与 auto/required 分支处理。

**vllm-ascend 四版平台补丁对照**（GLM 绑定算例另见专用镜像 `db701c1f`，其工具调用末片段拆分与去空 `tool_calls` 列表行为同 `v0.23.0`）：

| 所列平台补丁 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
| --- | --- | --- | --- | --- |
| GLM 工具调用末片段拆分 | 有，无条件加载（镜像 `db701c1f` 同） | 无 | 无 | 无 |
| 去掉响应里空 `tool_calls` 列表 | 有（镜像 `db701c1f` 同） | 无 | 无 | 无 |
| GLM 推理 token 用量 | 无 | 有，只绑到配了 GLM 解析器的服务 | 无该旧补丁 | 无该旧补丁 |
| GLM5.3 思考模板参数修正 | 无 | 无 | 有（`patch_glm53_reasoning`，`patch/platform/__init__.py#L21`） | 有（`patch_glm53_reasoning`，`patch/platform/__init__.py#L20`） |
| 其他相关分支 | MiniMax 用量；GLM 不经过 | Kimi 解析及 Recompute 恢复输入包装 | 按 `patch/platform/__init__.py#L19-L55` 导入链 | 按 `patch/platform/__init__.py#L19-L55` 导入链 |
| 本页反分词器、输出处理器 | 复用上游 | 复用上游 | 复用上游 | 复用上游 |

`v0.30.0` 与 `main` 的 `patch_glm53_reasoning` 修正只在模板特征与 `thinking`/`enable_thinking=false` 条件匹配时改解析器使用的 kwargs 副本，且在上游已有对应辅助能力或已经打补丁时跳过；它不证明旧 GLM 镜像支持关闭思考。`v0.26.0rc` 的恢复输入分支仅针对带私有 token 列表的恢复请求，见[入口版本说明](api-server-entry.md#版本差异)。表中“无”限定于所核平台补丁导入，不概括额外插件。

v0.26 的用量补丁针对的是：GLM 从提示词里的 `<think>` 就进入思考，输出里可能只出现 `</think>`，上游解析器按「从没进入思考」计数，聊天接口也还没有给出按解析器统计的推理 token 用量。补丁注明上游修好后删除。

### 源码位置

普通非 beam Chat 把 include_reasoning=false 转为 reasoning_ended=True 的四版入口见来源 95–98，文法消费者见 99–104。普通流式解析的旧分支与后三版过滤见 105–109；旧 Harmony 的独立判断见 110。旧非流式隐藏思考但保留逐 token 元数据见 111–112；v0.26、rc2、固定 main 同时抑制答案元数据的流式与非流式分支依次见 113–116、117–120、121–124。模板输入字段和合并顺序的来源统一放在 [API 入口](api-server-entry.md#源码位置)。

rc2 组合解析器与 named 工具调用收尾见来源 68–70，字段默认、请求间隔与输出模式转换见 71–75；单槽收集器和最先完成停止串见 76–77。Ascend 各版补丁导入、空列表序列化及 GLM5.3 模板条件见 78–83，配合原来源 24–26 判断旧 GLM、v0.26 与 rc2 的差异。

SSE 保活的 rc2 配置与完整包装器见来源 65–67，Completion 入口与固定 main 的相同实现见 93–94。四版参数表的 rc2 输出门控、用量覆盖、服务间隔、n 校验及环境上限见 85–92。基础版已经创建组合解析器的证据见来源 84；不能把解析器文件后来调整误写成旧版没有组合解析。

Recipe 的特殊 token 识别、普通文本边界和缺 tokenizer 的错误，见固定文档来源第 31 条；块处理、完成响应和调用方提供 HTTP 的职责见第 32 条。本文没有运行 Recipe 与客户端的端到端流式测试。

| 看什么 | 去哪里 |
| --- | --- |
| 引擎侧逐个追加、判停、截掉余下的 token | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py`，`_update_request_with_output` |
| 普通文本生成有新 token 或已结束才打结果 | 同文件 `update_from_output` 里构造 `EngineCoreOutput` 的条件；pooling 等输出另有分支 |
| 后台输出任务：取结果、分片、通知引擎终止 | `vllm@0fc695fc:vllm/v1/engine/async_llm.py`，`_run_output_handler` |
| HTTP 任务取结果，断开时终止 | 同文件 `generate` |
| 反分词、判停、算增量、放进收集器 | `vllm@0fc695fc:vllm/v1/engine/output_processor.py`，`process_outputs`、`make_request_output`、`RequestOutputCollector` |
| 两种反分词实现、扣字、找停止字符串 | `vllm@0fc695fc:vllm/v1/engine/detokenizer.py` |
| 按增量交还是一次交完 | `vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py`，`to_sampling_params` |
| 拼片段、结束片段、用量片段、[DONE] | `vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py`，`chat_completion_stream_generator` |
| 昇腾 GLM 工具调用末片段补丁 | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm_tool_call_streaming.py` |
| 11 项参数的定义、n 校验、输出枚举 | 新增来源 33–40、45；sampling_params.py 和两种请求 protocol.py，HTTP 转换由 to_sampling_params 完成 |
| 非流式 options 校验、双用量开关与服务覆盖 | 来源 38、41、42；validate_stream_options、should_include_usage；Completion 用量求和见 46，Chat 见原来源 18 |
| 不反分词、n 子请求、累计/增量/最终门控 | 来源 43、44 与原来源 6；from_new_request、ParentRequest、make_request_output |
| rc / main 参数和间隔的逐版对照 | 来源 47–55；SamplingParams、SchedulerConfig、RequestState、should_include_usage。main 请求字段另见 55 与原来源 30 |
| 慢路径 added token 空格、main 用量选项新路径 | 来源 56 的 _convert_tokens_to_string_with_added_encoders、58 的调用条件、57 的 StreamOptions；快路径对照原来源 11 |

**读源码的顺序。** 先看 `process_outputs`，它是引擎结果进前端后的总入口：往上追 `_run_output_handler` 看结果怎样到达，往下追反分词器的 `update` 和 `get_next_output_text` 看文字怎样算出来，再到 `chat_completion_stream_generator` 看片段怎样拼成。

**正文证据归档。** 引擎逐个追加、命中即截掉余下 token [C1]；普通文本生成有新 token 或已结束才打结果，pooling 等输出另分支 [C2]；后台任务取结果、分片让出、把前端判停的请求通知引擎终止 [C3]；HTTP 任务被取消时终止请求 [C4]。

快速反分词的条件是 tokenizers 库不低于 0.22 且分词器属于快速类 [C9]；解码流开流时先喂提示词，遇到非法前缀就重建 [C11]；默认排除停止串时扣字长度为最长停止字符串减 1，默认排除终止编号时最后一个编号不还原，增量按上次推到的位置切出 [C10]；停止字符串只在新文字附近找 [C12]；前端判停而引擎未结束时加入终止名单 [C8]。扣字的四步账由这些规则推出 [D]。

流式请求按增量交出，非流式只交最终结果 [C15]；收集器在消费方没取走时合并 [C5]；--stream-interval 的含义与默认值 [C13]；首个片段声明角色 [C16]；无解析器时空增量照样成片段、解析器未就绪时跳过这一步 [C17]；结束片段、用量片段、错误片段与 [DONE] [C18]。

GLM 的分词器配置声明 tokenizers 后端 [S22]，思考标记不是特殊 token、三个结束编号是特殊 token [S21]；函数调用配置里的两个解析器 [S23]。本部署走快速反分词，是按分词器配置推断的，镜像里的库版本没有核 [I]。R1 三圈的 token 数、每批最多 32 条小于每片 128 条，都由上面的规则和部署参数推出 [D]。昇腾 GLM 工具调用补丁的拆分做法 [C24]。

版本差异：v0.26 判快速反分词的类名 [C27]；main 取最先完成的停止字符串 [C28]；main 的请求级推送间隔与按服务端设置取大 [C29]；v0.26 昇腾的 GLM 推理用量补丁 [C26]。

**待核。**

- 本部署镜像里 transformers 和 tokenizers 的版本：决定反分词走快速还是慢速实现，本页按分词器配置推断为快速。
- 单个 API server 在两组满载（最多 64 条请求）时，每圈反分词和拼片段的耗时；流式与非流式、不同 --stream-interval 下的吞吐和 TTFT 对照。
- 配了 glm45 reasoning parser 时，v0.23 流里思考段和答案的切分点、`</think>` 本身落在哪个字段：本页只核了配置和字段名，没有实跑。
- 异步调度下，前端收到每圈结果的实际时刻与同步调度相差多少。
