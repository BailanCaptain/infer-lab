---
id: streaming-output
title: 流式输出：token 编号怎样变成一段段推给客户端的文字
type: concept
legacyAnchors:
  落到-glm-双机r1-的编号怎样变成片段: 复杂异构实战对照：GLM 双机思考标签与 MTP 多词流式
  一个前端进程接两个-dp-组的结果: 单前端接双 DP 组与异步交错
  r1-前三圈每个片段由几个-token-还原: R1 前三圈：MTP 1–4 词怎样变成 SSE 片段
  glm-的分词器和思考标记: GLM 的思考标记、结束编号与专用补丁
summary: >-
  流式输出让客户端边生成边看到文字：引擎每步交回新 token 编号，前端增量反分词补齐字节、还原新增文字并查过停止字符串，再包成 SSE
  片段推出。前半先讲标准单流反分词、扣字与 SSE 帧推送主干及边界，后半对照 GLM 双机思考标签与 MTP 多词流式实战。
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
  - '09'
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
  - to: token
    kind: builds-on
    note: 字节级 BPE 和「推理」「犇」两个例子在那一页；本页讲增量反分词怎样一步步还原并推送
  - to: sampling
    kind: builds-on
    note: 结束 token、停止 token 和长度上限在引擎侧判断，见那一页；本页只讲前端的停止字符串
contradicts: []
updated: '2026-11-19'
origin: direct
---

## 流式输出是什么：模型一个个吐出编号，用户怎样一段段看到文字？

**流式输出（streaming output）是边生成边返回：服务把每步新生成的 token 编号还原成文字，分批推给客户端，不必等整段写完再一次交回。** 默认每步处理新编号，但不保证每步都能显示新字。这里要分清两样东西：模型产出的是 **token 编号**（词表里的整数索引，见 [token](token.md)），客户端看到的是 **文本增量**（这一段比上一段多出的文字）。两者之间隔着两道工序：**增量反分词**与**判停**。

推送协议叫 **SSE**（server-sent events，服务器推送事件）。普通 HTTP 响应一次写完并关闭；SSE 保持连接打开，服务器每产生一段新内容，就写入一行 `data:` 开头的 JSON 文本并空一行，客户端读到一段即显示一段。最后一段标明结束原因，随后发一行 `[DONE]` 收束这条流。

流式通常能让用户更早看到开头。代价是前端需要反复序列化 JSON、写连接并维护长连接；若 UTF-8 字节尚未凑齐或字符被停止字符串缓冲区扣住，已有 token 仍暂时不显示——因此「生成了一枚」不等于「立刻看见一个字」。

以一个标准单流小例建立直觉：请求依次生成「推理」、少见字「犇」，然后结束。沿用 [token 页](token.md#生成的编号怎样变回文字)设定：「推理」占 1 个 token；「犇」的 UTF-8 字节 `E7 8A 87` 被切成 2 个 token（前一个含 `E7 8A`，后一个含 `87`）。

```wiki-diagram
file: streaming-output-intuition
```

图中按默认反分词与停止设置，每列对应一步：

- **第 1 步**：引擎交回编号 `9123`，还原出 6 个完整字节，推出「推理」。
- **第 2 步**：引擎交回半个字的字节 `E7 8A`，凑不成合法字符，反分词器暂存字节，本步片段无新文字。
- **第 3 步**：新字节 `87` 与暂存的 `E7 8A` 拼齐，推出「犇」。
- **第 4 步**：抽到结束 token（控制用特殊编号，默认不还原成文字）；判停成立，末片段仅写结束原因，随后发 `[DONE]`。

因此「一步」「一个 token」「一个字」「一个片段」之间没有固定的一一对应。上例生成 3 个普通 token 加 1 个结束 token，屏幕文字只更新 2 次，客户端收到 4 个数据片段（另含开头的角色声明片段）和 1 行 `[DONE]`。三者对应关系如下：

| 概念 | 产生位置 | 图例中的对应内容 |
| --- | --- | --- |
| token 编号 | 引擎每步交回（标准单流每步 1 枚，投机解码可多枚） | `9123`、`a`、`b`、结束 token |
| 文本增量 | 前端增量反分词后比上步多出的文字（可为空） | 「推理」、空、「犇」 |
| SSE 片段 | HTTP 长连接上的一行 `data:` JSON | 4 个片段 + `[DONE]` |

## 为什么要流式：先看到第一段，比等整段更早

**不流式时，客户端要等整段生成结束；流式时，服务边算边交，用户通常更早看到开头。** 但首枚模型输出不等于立刻可见文字：字节凑齐、停止字符串扣字、解析器缓冲、推送间隔和网络都会影响可见时刻。流式也不减少总生成步数，额外打包甚至可能略微改变总时延。

衡量流式体验常用 **TTFT**（从发出请求到收到首枚输出 token 的耗时）和 **token 间隔**（相邻输出的时间差），二者仍须与「首段可见文字时刻」区分。首枚输出必须等 prefill 阶段处理完提示词（见 [prefill](prefill.md)）。以标准单流（如 `Qwen3-8B` 每步产出 1 个可见 token）的示意数为界：设 prefill 耗时 $200\text{ ms}$，之后每步 $30\text{ ms}$，共生成 $200$ 个 token（忽略缓冲与网络差异）：

| 交付方式（200 token 示意） | 首段可见时刻 | 后续推送节奏 | 整段完成时刻 |
| --- | --- | --- | --- |
| 不流式（整段写完返回） | **$6{,}170\text{ ms}$**（$200 + 199 \times 30$） | 一次性返回 | $6{,}170\text{ ms}$ |
| 流式（`stream: true`） | **$200\text{ ms}$** | 约每 $30\text{ ms}$ 推一段 | 约 $6{,}170\text{ ms}$ |

两者最后一个字都在 $6{,}170\text{ ms}$ 左右到达：流式提前交付前文，并未加快模型计算。流式的额外开销全落在前端进程：

- **高频打包**：反分词与停止串检查流不流式都要做；流式还要每步构造结果对象、拼 JSON 并写连接，占前端 CPU。高并发下可用「攒够 N 个 token 再推」折中。
- **停止串扣字**：默认排除停止字符串时，结尾若干字符须等确认不构成前缀才能推出。
- **流内报错**：首片段发出后 HTTP 状态码已固定为 200，中途异常只能在流中写错误片段。
- **断连通知**：客户端断开时前端必须通知引擎中止，否则引擎继续白算并占住 KV 块。

## 怎么做：一步交回的编号要走过哪几道工序？

**一步的结果先在引擎进程里追加、判停，再经 ZMQ（ZeroMQ，跨进程高速消息通道）送到前端进程；前端后台任务统一完成反分词、停止字符串检查与增量计算，每条请求各自的 HTTP 任务再把增量拼成 SSE 片段写进连接。**

vLLM 服务由两类进程协同完成这条链路（见[调用链](request-call-chain.md#七站分在三种进程里)）：接 HTTP 请求的前端进程 `API server` 与调度推理的引擎进程 `EngineCore`。普通文本生成在前端做分词与反分词，两进程经 ZMQ 收发 token 编号和控制结果（预计算 embedding 等输入见 [vLLM V1 请求流](vllm-v1-shape.md#vllm-怎样把一条请求变成一步一步的计算)）。请求进门时的登记见 [API server 入口](api-server-entry.md)，本节沿结果回程往下走。

```wiki-diagram
file: streaming-output-flow
```

### 引擎侧：逐个追加、判停，有东西才发

在标准单流 decode 路径中，引擎每步为每条请求拿到 1 枚确定的新 token（开启投机解码如 MTP 时，单步可能交回多枚，细节见后半实战对照与[投机解码](speculative-decoding.md)）。引擎将本步 token **逐个**追加到请求上，每追加一枚就检查三项引擎侧停止条件：是否命中结束 token、是否命中请求指定的停止 token、输出长度是否达到上限（规则见 [sampling](sampling.md#什么时候停下来)）。一旦命中，同一步排在后面的其余 token 直接丢弃，不发往前端。

对普通文本生成而言，只有「本步产出新 token」或「请求刚结束」时，引擎才为该请求打包结果；长提示词分块 prefill 的前几步没有输出，因此不发此类生成结果（池化或 KV 传输元数据另有交付条件）。引擎将本步各请求的结果装成一批，经 ZMQ 发往前端。

### 增量反分词：只解新来的编号，凑不齐就等

**反分词器为每条请求各自维护一份状态：已到字节与已还原文字。新编号抵达时只接在尾部解码，凑齐完整字符才吐出，半个字则留在缓冲区。**

字节级分词器（见 [token](token.md#字节级-bpe-怎样一步步切出-token)）的一枚 token 可能只含半个汉字的字节，单独解码会变成乱码；若每步把全文重解再做差值，随着输出变长，重复开销持续膨胀。增量反分词避免全量重解码（不过后续若挂载需要扫描历史的解析器，仍有各自额外开销，不能等同于整条返回链恒定 O(1)）。

vLLM 提供快、慢两套实现：

- **快速解码流**：分词器属于 Hugging Face `tokenizers` 库的快速分词器且库版本 ≥ 0.22 时，开流先喂入提示词编号，此后每来一枚步进一次，字节凑齐才返回文字，否则返回空串。
- **慢速纯 Python 路径**：其余分词器走慢速实现，记录已解偏移，每次只解末尾一小段，结尾是不完整字符时同样暂存。

这一步顺带处理两项显示规则：因结束 token 或停止 token 结束时，默认不把最后一枚送去解码；特殊控制 token 是否显示由 `skip_special_tokens`（默认 `true`）决定，未标为特殊的词表项照常还原。

### 停止字符串：先扣住结尾几个字

**请求配置了 `stop`（停止字符串）时，前端在反分词后的文字里匹配它。默认输出不包含停止字符串，而它可能跨步拼齐，因此每次推送都扣住结尾「最长停止字符串长度 − 1」个字符，确认安全再推；命中后截断到停止串之前，结束原因记为 `stop`。**

停止字符串按文本匹配，只能放在持有反分词器的前端检查（跨进程判停分工见[第 7 站](one-request.md#第-7-站-返回与收尾)）。每次仅扫描新增文字及其紧邻前缀，无需重扫全文。

设 `stop = ["###"]`（默认不包含停止串）。若某步末尾刚出现 `#`，前端还不知道下一步会不会凑成 `###`；一旦提前推出就撤不回来。因此每步固定扣留结尾 $3 - 1 = 2$ 个字符，直到请求结束才一次释放余字（示意）：

| 步次（停止串 `###`，扣留 $3 - 1 = 2$ 字） | 当前累计文本 | 可推字数算式 | 本步推出增量 |
| --- | --- | --- | --- |
| 第 1 步 | 「答案」 | $2 - 2 = 0$ | 空（不推） |
| 第 2 步 | 「答案是42」 | $5 - 2 = 3$ | 「答案是」 |
| 第 3 步 | 「答案是42#」 | $6 - 2 = 4$ | 「4」 |
| 第 4 步（命中 `###` 并截掉，已结束） | 截后剩「答案是42」 | $5 - 0 = 5$ | 「2」 |

第 4 步截断时，引擎并不知道已命中文本停止串。前端因此立即向引擎发送中止消息（流程图右下「终止」线），引擎收到后回收 KV 块。若请求设 `include_stop_str_in_output = true`，则不扣尾字并将截断点移到停止串之后；单步交回多 token 同时命中多串的取舍规则见[版本差异](#版本差异)。

### 拼成 SSE：一条请求从头到尾收到什么

**请求带 `stream: true` 时，前端按增量模式交付：每次仅附本次新增的文字和编号。HTTP 任务先发一条声明角色的片段，随后每拿到一份增量发一段，末段带结束原因，再发 `[DONE]`。**

不带 `stream` 时，前端中途不交结果，只在结束时返回整份 JSON。带 `stream: true` 时，首屏小例在 Chat 接口收到的 SSE 帧如下（省略 `id`、模型名等公共字段）：

```text
data: {"choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}

data: {"choices":[{"index":0,"delta":{"content":"推理"}}]}

data: {"choices":[{"index":0,"delta":{"content":""}}]}

data: {"choices":[{"index":0,"delta":{"content":"犇"}}]}

data: {"choices":[{"index":0,"delta":{"content":""},"finish_reason":"stop"}]}

data: [DONE]
```

### 前端跟不上时：几步的文字并成一段

**后台输出任务与 HTTP 任务之间，每条请求只有一个单槽收集器。HTTP 任务尚未取走上份增量时，新一份直接并入同一格——此时单个片段装着多步文字，不丢字也不乱序。**

两类任务在同一个前端进程内通过 Python `asyncio` 协作轮转。后台任务每分片处理一批（默认 128 条请求）就让出一次调度权，让 HTTP 任务把算好的增量写进连接。高负载下 HTTP 任务若来不及每步读取，收集器会把连续多步的文字与编号拼在一起一并交出，因此客户端收到的片段数少于模型步数属于正常现象。

### 边界与例外

标准单流 SSE 推送之外，以下几类边界会改变片段数量、内容或元数据行为：

- **空增量片段与无字结束片段**：本步产出新编号但尚无可推文字（半字缓冲或停止串扣字），仍发 `content: ""` 片段；结束 token 默认不解码，末段可仅携带 `finish_reason`（结束/停止 token 与停止串记 `stop`，长度到限记 `length`）。
- **可选用量片段**：`stream_options.include_usage = true` 在 `[DONE]` 前追加一条 `choices: []` 的汇总用量帧；叠加 `continuous_usage_stats = true` 才在中途帧附带当前累计值。多候选（`n > 1`）并行时，中途只计当前候选、末尾才汇总全部候选，切勿把中途累计值逐帧相加。
- **中途异常走流内错误帧**：首段推出后 HTTP 状态码已定为 200，生成中途异常只能向流内写入错误片段，随后仍发 `[DONE]`。
- **有意攒批（`--stream-interval`）**：默认 `1`。HTTP 流式增量模式下设为 $N$ 时，除首份和最终份外，每攒够 $N$ 个新 token 才交出一次（数的是 token，不是毫秒或步数；投机解码单步多枚时可能越过门槛触发）。例：设间隔 3、每步 1 token、共 6 步结束，会在第 1、4、6 步交付。
- **Python `output_kind` 差异**：Python 直连引擎除增量模式（`DELTA`）外，还有累计模式（`CUMULATIVE`，四版固定源码中不更新间隔起点，仍每步交付全量）与最终模式（`FINAL_ONLY`，仅结束时交一次）。

把前端三道闸门（UTF-8 半字缓冲、停止串尾字扣留、单槽合并与间隔）、跨进程判停分工及下方将讲的思考隐藏副作用收在一张图里对照：

```wiki-diagram
file: streaming-output-fig-holdback-buffer
```

## 思考段、工具调用和断开连接：流里还会出现什么？

**挂载解析器后，同一段输出文字会被分拣到不同 JSON 字段；客户端断连时，前端按停止串相同的通道通知引擎中止。**

- **思考段**：推理模型先写思考再写答案。服务端配置 `reasoning parser`（思考内容解析器）后，思考文字落入 `reasoning` 字段、答案落入 `content`；未配置时全部混在 `content` 里，非特殊 token 的思考标记也按正文输出。
- **工具调用**：配置 `tool-call parser` 且请求带工具定义时，调用结构被拆进 `tool_calls` 字段逐段推出；解析器尚未认出完整结构的前几步可能不发任何片段。普通 Chat 中，`auto` 或 `required` 实际发出工具调用时结束原因改为 `tool_calls`；指定函数名（named）调用则保留引擎原结束原因（`stop` 或 `length`）。
- **多候选（`n > 1`）**：每个候选分配独立 `index`，按序号并行推送并各自带结束片段。
- **逐 token 概率（`logprobs`）**：允许返回概率的分支中，每段只附本次新增 token 的记录；关闭思考返回时的额外影响见下节。
- **客户端断开**：对应 HTTP 任务被取消，前端立即向引擎发中止消息（流程右下）。

## 隐藏思考、少思考和不思考，是同一个开关吗？

**隐藏已生成的思考文字只改变返回内容；要求模型少思考或不思考，必须改动输入模板或采样执行链。** 三类开关位置不同，不能互替——下图同时把这三道开关与后文 GLM 双机单前端扇入及 MTP 确认推送节奏收在一处对照：

```wiki-diagram
file: streaming-output-fig-mtp-reasoning
```

| 控制目标 | 生效阶段 | 核验重点 |
|---|---|---|
| 不把思考段发给客户端 | 输出解析与返回 | 解析器能否识别思考段、当前版本是否过滤流式片段 |
| 请求指定思考强度或关闭思考 | 输入聊天模板 | 模板是否支持、请求字段与服务默认如何合并 |
| 限制思考最多生成多少 token | 引擎与采样执行链 | 思考边界、预算处理器及 runner / 投机解码支持情况 |

若模型先输出思考再输出「巴黎」，只有在解析器能拆分两部分且版本支持流式过滤时，客户端才只收到答案；**已执行的思考计算并未撤销**。若服务端未配置能识别思考的解析器，两部分都在普通 `content` 里，仅在请求里把隐藏思考设为 `false` 不会自动剥离思考文字。

还需留意两项联动副作用：

- **答案元数据同步被清空**：较新普通 Chat 解析分支在关闭思考返回时，会连带停止返回逐 token 的 `logprobs` 与 `token_ids`，**答案段同样受影响**（旧基线普通流式分支行为不同，见页末版本表）。
- **与结构化输出联动改计算起点**：请求同时带结构化输出时，四版普通非 beam Chat 入口在关闭思考返回后会向引擎传入 `reasoning_ended = True`。文法约束随即从第 1 个输出 token 生效，不再等真实思考结束标记（见[结构化输出](structured-output.md#思考阶段官方命令从第一个输出-token-起就约束)，预算控制见[采样页](sampling.md#思考预算怎样让模型转去回答)）。

## DeepSeek Recipe：编号流与文本流的边界不同

DeepSeek Recipe 的流处理器既能接 token 编号，也能接已经还原好的文本。接编号时必须绑定匹配的 tokenizer；一个字符尚未凑齐时会先缓冲。显式特殊 token 会被单独标记，供解析器识别思考段、工具调用等边界；普通 token 拼出相同字面内容时，仍按正文处理。接文本时已经没有 token 边界，标记只能按文字匹配。

因此，同一份输出“看起来一样”，两条接入路径仍可能得到不同字段。遇到思考段切错、工具参数混进正文，先记录输入块到底是编号还是文本、特殊标记是否保留，再比较解析事件。只有事件正确而客户端显示错误时，才继续查序列化与传输。通用取证顺序见[输出异常排查](inference-correctness-troubleshooting.md)。

结束也有两层：推理后端报告结束原因，流处理器完成解析并交出剩余事件。Python 接入按块处理以后还要调用处理器的结束方法；调用方再把得到的事件真正发送给客户端。拿到一个“后端停止”标志，不足以证明尾部内容与结束事件已经送达。

## 复杂异构实战对照：GLM 双机思考标签与 MTP 多词流式

当标准单流切换为双机 DP 叠加 MTP 多词投机解码与思考标签时，前端增量反分词与 SSE 推送主干不变，但每帧承载的 token 数、进程扇入与思考标签归属都会变化。以下按例外 B 审定基线（[GLM 双机部署前提](glm-5-3-flash-two-node.md#部署前提)）核对完整链路。

### 单前端接双 DP 组与异步交错

[R1](one-request.md#示例请求-r1-与官方双机部署) 是 4 token 提示词示例请求（假定按流式发出），分派到 DP0。官方双机命令只启动 1 个 `API server`（位于 node0）：两台机器两个 DP 组的所有结果全部经 ZMQ 汇入这一个前端进程，反分词、停止串检查与 SSE 序列化都挤在它的 CPU 上。

每个 DP 组每步最多运行 32 条请求，单批结果不超过 32 条，小于每片 128 条的让出粒度，因此一批不会被拆片。官方命令未显式设置 `--stream-interval`，取默认 `1`（每步有新 token 即交出）。本部署按默认打开[异步调度](async-scheduling.md)：引擎先把下一圈排好发给 NPU，再处理上一圈结果发往前端；推送仍是每圈一次，但结果在下一圈启动后才离开引擎。

### R1 前三圈：MTP 1–4 词怎样变成 SSE 片段

MTP（multi-token prediction）每步草拟 3 个候选 token，下一轮由主模型验证；被拒候选从不离开引擎，前端绝不会出现「先显示、再撤回」。HTTP 任务及时取走时，单帧可携带 1–4 个确定 token 还原的文字。沿用一条请求页[三步的账](one-request.md#三步的账)里的教学假设（三圈共 $1 + 2 + 4 = 7$ 个 token，非实测接受率）：

| 步次（接受数为教学假设） | 交给前端的 token 数 | 对应 token |
| --- | --- | --- |
| prefill 一圈 | $1$ | $y_0$ |
| decode 1（3 候选中 1 个） | $1 + 1 = 2$ | $y_1,\; y_2$ |
| decode 2（3 候选全中） | $3 + 1 = 4$ | $y_3 \text{ 到 } y_6$ |
| **前三圈合计** | **$7$** | $y_0 \text{ 到 } y_6$ |

客户端在角色片段后依次收到 3 个内容片段，分别由 1、2、4 个 token 还原；每段显示几个字取决于对应字节（常用词 1 token 对应多字，生僻字需多 token 凑 1 字），不能按 token 数直接换算。

### GLM 的思考标记、结束编号与专用补丁

- **快速解码流**：GLM 分词器为字节级 BPE（见 [token](token.md#glm-的分词器是字节级-bpe)），配置声明 `tokenizers` 后端，镜像内 `tokenizers >= 0.22` 时走快速解码流。
- **思考标记归属**：聊天模板把 `<think>` 放在提示词末尾，模型从第 1 枚输出就开始写思考。`<think>` 与 `</think>` 编号为 `154841`、`154842`，落在 36 个特殊标记编号段内，但分词器文件中 `special` 标志为 `false`，默认 `skip_special_tokens=true` 去不掉它们。
  官方双机原配方未配 reasoning parser（仅传 `include_reasoning=false` 不能剥离思考），因此思考文字、`</think>` 与答案全落在 `content` 里，客户端须自行按 `</think>` 切分。函数调用教程另配 `--tool-call-parser glm47` 与 `--reasoning-parser glm45`，配齐后思考文字才分入 `reasoning` 字段（见[结构化输出](structured-output.md)）。
- **三个结束编号**：`154820`、`154827`、`154829` 均标为特殊 token（见 [token](token.md#编号要落在-154880-行之内)）；抽中后引擎判正常结束，默认不解码，结束原因记 `stop`。
- **专用补丁**：昇腾快照 `db701c1f` 为 GLM 聊天流增加一层专用补丁（仅工具调用时生效），把原本挤在同一帧里的末段工具参数与 `finish_reason: "tool_calls"` 拆成两帧，先发参数再发只带结束原因的空帧。

### 收尾：长度到限，再归还块号

设 R1 的 `max_tokens = 200`（与[第 7 站](one-request.md#第-7-站-返回与收尾)一致）。最后一圈前已输出 197 个 token，本圈验证产出 4 个；引擎追加到第 200 个时判长度到限，仅把前 3 个发给前端。前端还原推出后，末片段带 `finish_reason: "length"` 并紧跟 `[DONE]`。未设 `max_tokens` 时，输出上限为部署总长 `133120` 减提示词长度（见 [sampling](sampling.md#停止判断和长度上限)）。

引擎在判停同一步结束请求，将 R1 持有的 16–17 个块号一次性还回空闲队列。若先命中停止字符串则顺序反转：前端先截断并结束流，再发中止消息给引擎还块（详见[请求收尾](request-teardown.md#前端先发现停止字符串和客户端断开)）。

## 常见误解

- **「一个片段就是一个 token。」** 不是。单步可因投机解码交回多枚（如 GLM MTP 为 1–4 枚），前端积压时也会将多步并入一帧，而半字字节对应空片段；片段数、token 数、字数各算各的。
- **「流式让生成变快了。」** 模型计算速度未变，最后一个字到达时刻基本相同；流式只是提前送出前文，代价是前端额外承担高频打包与连接维护的 CPU 开销。
- **「MTP 先把猜的 token 推给用户，猜错再撤回。」** 候选只在引擎内验证，前端仅接收已确认的 token，流里不存在撤回。
- **「停止字符串和结束 token 一样，都在引擎里判断。」** 结束 token、停止 token 与长度在引擎里判；停止字符串必须还原成文本，只能在前端判并回发中止。
- **「反分词在 NPU 上或 worker 里做。」** 反分词在前端 `API server` 进程用 CPU 完成（GLM 双机即 node0 唯一前端）；worker 只产出编号。
- **「content 为空的片段说明出了问题。」** 半个 UTF-8 字符的字节、或因停止字符串扣留结尾，都会产生无新文字的空片段，属正常行为。
- **「GLM 的思考过程会自动放进 reasoning 字段。」** 只有服务端配了 reasoning parser 才会分字段；官方双机原配方未配置，思考文字与 `</think>` 都在 `content` 中。

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
