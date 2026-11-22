---
id: api-server-entry
title: API server 入口：一个 HTTP 请求怎样变成引擎里的请求
type: concept
legacyAnchors:
  一张图片进来怎样和文字一起交给模型: 多模态输入、Pooling 与语音入口延伸导览
  三种缓存各自省掉哪一步: 多模态输入、Pooling 与语音入口延伸导览
  媒体为什么要在序列里留位置: 多模态输入、Pooling 与语音入口延伸导览
  给媒体一个固定编号就能不再上传吗: 多模态输入、Pooling 与语音入口延伸导览
  已有媒体向量还需要哪些布局信息: 多模态输入、Pooling 与语音入口延伸导览
  视频和音频在前端还要处理什么: 多模态输入、Pooling 与语音入口延伸导览
  上传录音聊天音频和实时转写分别走哪条路: 多模态输入、Pooling 与语音入口延伸导览
summary: >-
  vLLM 前端进程从收到 HTTP 请求到交给某个 EngineCore 之间做的事：检查、套聊天模板、分词、定输出上限和采样参数、包成
  EngineCoreRequest、先在本进程登记反分词器和输出槽，再选 DP 组经 ZMQ 发出。讲清每一步在哪里拒绝请求、流式与非流式的差别、独立 CPU
  renderer、工具解析插件，以及 GLM 双机上 node0 一个前端接全部请求。
aliases:
  - API server 入口
  - prompt_embeds
  - enable_prompt_embeds
  - enable-prompt-embeds
  - 预计算嵌入输入
  - VLLM_MAX_EMBED_DECODE_BYTES
  - API server
  - 请求入口
  - 入口站
  - OpenAI 兼容接口
  - /v1/chat/completions
  - OpenAIServingChat
  - process_inputs
  - add_request
  - 套模板与分词入口
  - X-Request-Id
  - max_tokens
  - max_completion_tokens
  - max_model_len
  - served_model_name
  - '--served-model-name'
  - '--host'
  - '--port'
  - '--config'
  - chat_template_content_format
  - trust_request_chat_template
  - VLLM_HTTP_TIMEOUT_KEEP_ALIVE
  - messages
  - prompt
  - enable_log_requests
  - max_log_len
  - uvicorn_log_level
chapters:
  - '10'
order: 85
sources:
  - 'vllm@0fc695fc:docs/serving/online_serving/README.md#L1-L212'
  - 'vllm@0fc695fc:docs/serving/online_serving/openai_compatible_server.md#L1-L193'
  - 'vllm@0fc695fc:docs/features/prompt_embeds.md#L1-L79'
  - 'vllm@0fc695fc:docs/features/tool_calling.md#L1-L570'
  - 'https://uvicorn.dev/settings/#timeouts'
  - >-
    https://github.com/deepseek-ai/deepseek-recipe/blob/935817c66f5d6e64838f419692545f06787e485f/README.md
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L262-L292'
  - 'vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L416-L430'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/api_router.py#L40-L75'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L192-L392'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L497-L964'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L211-L238'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/render/serving.py#L183-L266'
  - 'vllm@0fc695fc:vllm/renderers/base.py#L84-L155'
  - 'vllm@0fc695fc:vllm/renderers/params.py#L186-L194'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/api_utils.py#L170-L206'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L280-L414'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L524-L600'
  - 'vllm@0fc695fc:vllm/v1/engine/input_processor.py#L223-L484'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L45-L92'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L1344-L1360'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L341-L377'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1518-L1543'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1801-L1823'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/error_response.py#L16-L50'
  - 'vllm@0fc695fc:vllm/v1/engine/parallel_sampling.py#L52-L94'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/responses/serving.py#L154-L248'
  - 'vllm@0fc695fc:vllm/entrypoints/anthropic/serving.py#L474-L498'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/sagemaker/api_router.py#L31-L99'
  - 'vllm@0fc695fc:examples/ray_serving/ray_serve_deepseek.py#L1-L55'
  - 'vllm@0fc695fc:vllm/renderers/embed_utils.py#L1-L83'
  - 'vllm@0fc695fc:vllm/tool_parsers/abstract_tool_parser.py#L211-L366'
  - 'vllm@568afb3a:vllm/renderers/online_renderer.py#L95-L120'
  - 'vllm@568afb3a:vllm/entrypoints/scale_out/derender/serving.py#L121-L238'
  - 'vllm@ced6857a:vllm/config/vllm.py#L450-L462'
  - 'vllm@ced6857a:vllm/config/model.py#L2393-L2544'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_utils.py#L2511-L2572'
  - 'vllm@ced6857a:vllm/utils/argparse_utils.py#L462-L611'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/cli_args.py#L75-L157'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/launcher.py#L120-L185'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/api_server/entry.py#L105-L202'
  - 'vllm@ced6857a:vllm/entrypoints/launchers/render/entry.py#L46-L98'
  - 'vllm@ced6857a:vllm/entrypoints/scale_out/derender/api_router.py#L31-L126'
  - 'vllm@ced6857a:vllm/renderers/online_derenderer.py#L271-L324'
  - 'vllm@ced6857a:vllm/v1/engine/admission_control.py#L13-L52'
  - 'vllm@ced6857a:vllm/entrypoints/serve/utils/request_logger.py#L17-L104'
  - 'vllm@ced6857a:vllm/envs.py#L1018-L1024'
  - 'vllm@ced6857a:vllm/envs.py#L1117-L1119'
  - 'vllm@ba15685a:vllm/config/vllm.py#L475-L490'
  - 'vllm@ba15685a:vllm/entrypoints/launchers/launcher.py#L151-L165'
  - 'vllm@ba15685a:vllm/entrypoints/launchers/launcher.py#L251-L310'
  - 'vllm@ba15685a:vllm/renderers/online_renderer.py#L161-L210'
  - 'vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_tool_choice_none_content.py#L1-L87'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_recompute_chat.py#L1-L32'
  - 'vllm-ascend@2c59ff10:vllm_ascend/patch/platform/__init__.py#L19-L45'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: pooling-and-non-ar
    kind: builds-on
    note: Generate、Pooling 与 Encoder-Decoder 三条执行主线，以及 /embeddings、/score、/generative_scoring、语音上传与实时转写入口
  - to: cluster-serving
    kind: builds-on
    note: 多实例代理、前缀感知路由、/health 探针与 --shutdown-timeout 优雅停机护栏
  - to: engine-processes
    kind: builds-on
    note: API server 是哪个进程、和 EngineCore 与 worker 怎样分工、各自跨步留着什么
  - to: token
    kind: builds-on
    note: 聊天模板与字节级 BPE 分词本身怎么做，GLM 模板加了哪些特殊标记
  - to: request-call-chain
    kind: builds-on
    note: 入口之后六站各从哪个函数进，进程之间走哪几条通道
  - to: dp-request-routing
    kind: builds-on
    note: 入口最后一步派给哪一组的打分规则，计数从哪来、为什么会过时
  - to: embedding
    kind: builds-on
    note: 入口把文本转换为 token 编号，是因为模型的嵌入入口需要按编号查表取得向量。
  - to: vllm-ascend-overview
    kind: builds-on
    note: 入口页对昇腾插件未改动请求入口的具体说明，建立在总览所述上游负责接请求、分词，昇腾负责 NPU 执行的职责边界上。
contradicts: []
updated: '2026-11-19'
origin: direct
---

## 一个 HTTP 请求进了 API server，出来的是什么？

**API server 入口指 vLLM 前端进程从收到一个 HTTP 请求、到把它交给某个引擎排队之间的这一段：把 JSON 整理成引擎请求，并在自己的进程里留好回程的接收点。** 下面先沿纯文本生成路径看一串 token 编号、采样参数和请求 ID 怎样准备好；预计算向量与图像输入还带有张量等数据，后文与多模态专页单独说明。

这里有两个进程。API server 是接 HTTP 请求的进程，对外提供和 OpenAI 一样格式的接口，执行 `vllm serve` 时起的就是它；EngineCore 是负责排队、调度并驱动模型计算的引擎进程（见 [EngineCore](vllm-engine-core.md)）。两者不在同一个进程里，请求要从前者交到后者手里。

前端先做模板和分词，能在调度前拒掉无效输入，也让引擎专注于模型执行；代价是这些处理占 CPU，每条在途请求的回程记录还占主机内存。前端太忙时，请求即使尚未进模型，也已经在等待。

举个具体的例子。客户端发来这样一段 JSON：消息列表里只有一条，角色是用户，内容是「你好」，并且要求边生成边返回（流式）。这条纯文本请求送进引擎前，要准备好三样东西：

- 一串 token 编号，例如示意的 7、31、1052、9；
- 一组采样参数：最多生成多少个 token、按什么规则从候选里挑、遇到什么就停；
- 一个请求 ID，用来在之后的每一步里认出这条请求。

前端自己还要记住一件事：引擎之后每一步交回来的编号，要还原成文字，推回这一个 HTTP 连接。下图把这一路画出来，左列是同一条请求在前端里一步步变成的样子：

```wiki-diagram
file: api-server-entry
```

① 到 ⑤ 都在改写请求本身：先检查，再按模型训练时约定的对话格式拼成一段带角色标记的文本（这一步叫套聊天模板），再切成编号，定好长度上限和采样参数，最后包成引擎请求。⑥ 不改请求，而是在前端留一个回程的接收点。⑦ 才第一次跨过进程边界：开了 DP（data parallel，数据并行）的部署有好几个执行组，每组一个 EngineCore，各排各的队，前端要先挑一组再发过去。后面几节按这个顺序展开。

## 为什么要在前端先做完这些，代价在哪？

**本页的纯文本路径先把文字变成编号，再交给引擎调度；这些 CPU 上的字符串处理放在前端，让引擎进程专注于排程和驱动 NPU。** 这条路径进模型后先拿编号查[嵌入表](embedding.md)；接口也有直接携带预先算好的嵌入向量的路径，所以不能把所有引擎输入都说成只有编号，边界见 [V1 分工](vllm-v1-shape.md#vllm-怎样把一条请求变成一步一步的计算)。套模板、分词、把输出编号还原成文字（反分词）都不需要 NPU，交给单独的前端进程，和引擎各干各的，见[引擎进程](engine-processes.md#每个进程里存着什么)。

**坏请求在门口拒掉，不占引擎的资源。** 一条请求一旦进了引擎的等待队列（waiting），就会占调度名额，开算后还要占 [KV cache](kv-cache.md) 的块。模型名写错、提示词超长、采样参数不合法，这些在入口都查得出来，直接回 400 或 404，引擎根本不知道它来过。

**回程要先有落脚的地方。** 引擎每走一步，把这一步所有请求的结果打成一包交回前端；前端按请求 ID 把它们分拣到各自的连接。所以入口的顺序是先登记、后发送：前端分拣时遇到不认识的 ID 会直接丢掉，先登记才能保证引擎最早交回的那一批也有处可落。

代价都在主机这边：

- **CPU 时间。** 套模板和分词默认挤在一个工作线程上，所有请求排队用它；提示词越长，分词越久，直接计入首 token 时延（TTFT）。
- **主机内存。** 每条请求在前端留一份记录（反分词进度和输出槽），请求结束才删。
- **前端进程个数有限。** 只起一个 API server 时，所有连接、模板、分词、反分词都在这一个进程里；并发很高时，它的 CPU 可能先于 NPU 成为瓶颈。

入口和相邻几个环节容易混，分工如下：

| 环节 | 在哪个进程 | 管什么 | 不管什么 |
|---|---|---|---|
| 入口（本页） | API server | 文字变编号；把请求里的采样设置定成参数并校验 | 不选 token，不排队 |
| [采样](sampling.md) | worker（NPU 上） | 照这组参数从每个词的分数里选出 token | 不再改参数 |
| [DP 请求路由](dp-request-routing.md) | API server | 入口最后一步：派给哪一个 DP 组 | 不看请求内容 |
| 返回 | API server | 把编号还原成文字，推回连接 | 不碰模型计算 |

## 怎么做：从 JSON 到一串编号（① 到 ④）

**在未启用 LoRA 的常规部署中，前四步只在前端改写请求：先查能不能收，再把消息拼成文本、切成编号，最后按长度上限定下最多能生成多少个 token。任何一步不过关，都直接回一个带错误信息的 JSON，请求不会到引擎。**

**① 检查。** 网页框架先按接口约定检查 JSON 的字段和类型，格式不对回 400。接着核对请求里的模型名：未启用 LoRA 且开启模型名校验时，请求可省略名称或使用基座对外名，其余名字回 404。启用 LoRA 的服务还接受已登记的适配器名；允许动态更新时，未知名字可进入[适配器查找与加载](lora.md#请求只写适配器名服务怎样找到权重)，不能一律拒收。此外，请求自带聊天模板须声明 `--trust-request-chat-template`。让模型自行决定是否调工具（`tool_choice = "auto"`）须开启 `--enable-auto-tool-choice` 并指定 `--tool-call-parser`。最后，引擎若已停止，前端直接报错，不再往下做。

**② 套聊天模板。** 聊天接口收到的是一串带角色的消息。前端用模型自带的 Jinja 模板把消息拼成训练时约定的对话文本，并附上「轮到助手回答」的标记（详见 [token 页的聊天模板一节](token.md#聊天消息先套模板再分词)）。

**③ 分词。** 拼好的文本交给分词器切成 token 编号（见 [token](token.md#字节级-bpe-怎样一步步切出-token)）。入口有两个关键细节：
- **不再补一遍特殊标记。** 模板已经写好起始与角色标记，聊天接口默认不让分词器再加起始标记，避免开头重复。
- **在线程池里做。** 为避免阻塞事件循环，套模板和分词交给专用线程池（默认 1 线程；`v0.23` 会把 `2 ms` 内到达的最多 `32` 条分词请求攒批一起切，`v0.26+` 改逐条交线程池）。

**④ 定输出上限和采样参数。** 输入和输出共用总长度上限 `max_model_len`。聊天请求写了 `max_tokens` 或 `max_completion_tokens`（后者非空时优先），输入就只能占剩余部分；两项都没写且无生成配置限制时，前端用总上限减去输入长度作为输出上限。注意入口还要区分普通采样与 [Beam Search](sampling-advanced.md#v1-外置-beam-search多路径扩展与含提示词长度惩罚)（各自构造参数并分派），生成模型亦另设独立的[生成式评分入口](pooling-and-non-ar.md#生成式评分generative_scoring与-pooling-score-的边界及概率比较)。

设总长度上限 $L_{\max} = 100$，按上述减法做长度预算核验（示意数）：

$$L_{\text{in,allow}} = L_{\max} - L_{\text{out}} = 100 - 30 = 70, \qquad L_{\text{out,default}} = 100 - 12 = 88$$

| 请求场景（示意：$L_{\max} = 100$） | 长度核算 | 入口处理结果 |
| --- | --- | --- |
| 请求输出 `30`，实际提示词 `75` 个编号 | 允许输入 $100 - 30 = 70$，超出 `5` | 分词保留到第 `71` 个即判超长，回 400（「输入至少 71 个」） |
| 不写输出数，实际提示词 `12` 个编号 | 输出上限 $100 - 12 =$ **`88`** | 合法放行，按 `88` 补齐输出预算 |

这里的提示词是套完模板后的整串编号。默认分词路径只切到允许输入数 `+1` 以尽早判超长；但若显式配置 `truncate_prompt_tokens` 与 `truncation_side`，则会关闭这层早停截短、先保留完整编号再按指定方向截断（详见 [token 参数参考](token.md#怎么开)）。

采样参数也在这一步打包成 `SamplingParams`（请求值 → `generation_config.json` → 中性默认，详见[采样参数从哪来](sampling.md#采样参数从哪来)），取值不合法直接拒绝。同一步还定下交付方式：流式请求要增量，非流式只要最终结果。

## 怎么做：包成引擎请求，先登记回程再发出（⑤ 到 ⑦）

**后三步交给前端进程里的 `AsyncLLM`：它把编号和参数包成 `EngineCoreRequest`，先在本进程登记回程接收点，再挑一个 DP 组，通过 ZMQ 发过去。**

**⑤ 包成引擎请求。** 打包前再查一遍：采样参数与任务是否支持、请求头指定的组号是否合法、提示词是否为空、长度是否顶满上限（一个输出位都不剩）、编号是否越出词表（见[编号要落在词表之内](token.md#编号要落在-154880-行之内)）。都通过后补齐输出上限、把模型生成配置里的结束编号并入 `stop_token_ids`（见[停止判断和长度上限](sampling.md#停止判断和长度上限)）。核心字段如下：

| 字段 | 里面是什么 | 后面谁用 |
|---|---|---|
| 提示词编号 | 第 ③ 步切出的整串编号 | 调度器数长度；worker 拿去查嵌入表 |
| 采样参数 | 第 ④ 步定下并补齐的参数 | 第 5 站选 token；每步判断停不停 |
| 请求 ID | 对外 ID 后面再加 8 位随机字符 | 回程按它分拣 |
| 到达时间 | 前端收到请求的时刻 | 按优先级排队；统计时延 |
| 指定组号 | 请求头 `X-data-parallel-rank`，未写为空 | 第 ⑦ 步选组 |

对外 ID 是 `chatcmpl-` 加上一段基础 ID：优先取请求头 `X-Request-Id`，其次取请求体 `request_id`，否则随机生成。内部加 8 位随机后缀避免不同客户端撞 ID。请求要求 `n > 1` 个回答时，此处拆成 `n` 条子请求（各有带候选序号前缀的内部 ID）分别发给引擎，但共用同一个输出槽。

**⑥ 登记回程接收点。** 前端的 `OutputProcessor` 按请求 ID 存三样东西：增量反分词器（见[生成的编号怎样变回文字](token.md#生成的编号怎样变回文字)）、按需工作的 `logprobs` 整理器，以及单槽输出队列。输出槽只有 1 格：上一段未被取走时新段与之合并（详见[几步文字并成一段](streaming-output.md#前端跟不上时几步的文字并成一段)）。登记必须在发送之前，因为后台分拣任务遇到不认识的 ID 会直接丢弃；客户端中途断连时前端发中止消息并清理记录（见[请求收尾](request-teardown.md#前端先发现停止字符串和客户端断开)）。

**⑦ 选 DP 组并发送。** 发送前盖上本轮 wave 号与本前端编号；请求头指定了组号就直接用，否则按各组忙闲打分选最闲组（规则见 [DP 请求路由](dp-request-routing.md#一条新请求进来派给哪一个-dp-组)），经 ZMQ 发往该组 EngineCore 输入口；若各组都停着则另发消息给 DP 协调器唤醒。

**到了引擎那边。** EngineCore 的输入线程解出请求并当场建成 `Request`（与当前计算并行），放进进程内输入队列；下一圈开头才交给调度器进 `waiting` 队列（见 [EngineCore 一圈按什么顺序走](vllm-engine-core.md#一圈按什么顺序走一条示意请求转两圈)）。

## 流式和非流式：200 什么时候发出，错误从哪里回来？

**两种请求走同一条路，差别在 HTTP 状态码何时定下来：非流式等生成完才回响应，中途任何错误都能改成错误状态码；流式在请求交给 `AsyncLLM` 之前就已发出 200，此后的错误只能写进流里。**

关键在第 ④ 步后前端只构造了一个异步「生成器」，真正执行要等消费它：
- **非流式**：前端当场取完所有段再拼成完整 JSON；⑤ 里的校验错误会被统一错误处理捕获并回 400 等状态码。
- **流式**：前端把生成器交给 FastAPI，框架先发 `200` 与 SSE（Server-Sent Events）响应头，随后才执行 ⑤；此时出错改不了 200，只能推一条含错误信息的 `data:` 消息再结束。

```wiki-diagram
file: api-server-entry-flow
```

| 查什么 | 在哪一步 | 客户端看到 |
|---|---|---|
| JSON 字段和类型 | 收到请求时 | 400 |
| 模型名不匹配 | ① | 404 |
| 未信任请求模板；未开自动工具选择/解析器 | ① | 400 |
| 消息不合模板导致渲染报错 | ② | 400 |
| 提示词+输出超总长；采样参数非法 | ③ ④ | 400 |
| 编号越界、组号越界、提示词为空 | ⑤ | 非流式 400；流式先 200，流里一条错误消息 |
| 提示词顶满上限无输出位 | 通常 ③ ④ 拦下（⑤ 兜底） | 400 |
| 引擎已停止 | ① 或 ⑤ | 500（流式已发 200 则写进流里），前端随后退出 |

## 几种变体与兼容协议：补全、多候选、多前端与外层服务

**入口主干之外还有四类常见 HTTP 形态：老式补全不套聊天模板、多候选拆子请求、多前端分摊 CPU、以及 Responses / Messages / SageMaker / Ray Serve 等协议与包装层。**

- **老式补全接口（`/v1/completions`）**：直接收提示词文本或 token 编号，跳过第 ② 步（文本默认补起始标记）。省略输出上限时默认最多生成 `16` 个 token（聊天接口无此默认值），且不认 `max_completion_tokens`（仅记入 DEBUG 日志忽略）。直接给编号时跳过第 ③ 步，仅靠第 ⑤ 步词表上界检查拦住越界编号。
- **一次要 `n` 个回答**：第 ⑤ 步拆成 `n` 条子请求（带随机种子时各自错开），分别选 DP 组发送，回程汇总进同一个输出槽按序号拼回 `n` 个 choice。
- **开多个前端与优雅停机**：`--api-server-count > 1`（internal LB 默认等于 DP 组数）起多前端共用同一端口，分摊模板、分词与反分词 CPU。各前端本地 DP 记账按前端个数补齐（见 [DP 请求路由](dp-request-routing.md)）。离线分批提交见[离线请求队列](request-call-chain.md#离线脚本能先提交几组请求再一起取结果吗)；滚动发布或缩容时的 `--shutdown-timeout` 优雅停机护栏见[集群部署与优雅停机](cluster-serving.md#滚动发布与缩容别被默认---shutdown-timeout-0-直接掐断请求)。
- **Responses（`/v1/responses`）与 Anthropic Messages（`/v1/messages`）**：接口协议决定输入/输出封装，模型任务决定能算什么。Responses 接收 `input`、返回 `output` 项列表（不可按 Chat `choices` 读取），支持用 `previous_response_id` 衔接历史会话。**注意边界**：会话状态保存在单 API 进程内存字典中，与复用模型 KV 的 [prefix caching](prefix-caching.md) 不同。默认 `VLLM_ENABLE_RESPONSES_API_STORE=0` 下即使 `store=true` 也不保存，开启后无自动清理。`background=true` 须双开，且 `previous_response_id` 与 `previous_input_messages` 互斥。Anthropic Messages 要求 `model`、`messages` 与正数 `max_tokens`，入口先转为 Chat 执行再转回 `content`/`tool_use` 块，协议转换不凭空增加工具能力。
- **SageMaker 与 Ray Serve 包装层**：外层包装只管接入与副本调度，不改变引擎内部 TP/PP/DP 并行。SageMaker `/invocations` 仅分派 Chat、Completions 与相应 pooling 处理器（不含 Responses、Messages 与 multipart 语音），`/ping` 接健康检查。Ray Serve 在引擎外管理服务副本，不同于引擎内部的 [Ray 执行器](engine-processes.md)。例如官方 DeepSeek 示例外层 `autoscaling_config` 上下界均为 `1`、引擎内部 `TP8 / PP2`（H100 配置示例），外层加副本与内层加 PP 不是一回事。

## 已经算好的文本向量怎样进门，谁负责套模板？

开启 `--enable-prompt-embeds`（默认 `false`）后，调用方可以传入预先算好的文本嵌入张量（经 Torch 序列化并 base64 编码）。张量形状为「位置数 × `hidden_size`」，自动转到模型浮点 dtype；它省去查嵌入表，但仍计入上下文长度且不省后续前向：

| 入口 | 交给服务什么 | 模板与批量处理规则 |
|---|---|---|
| Chat 消息内容块 | `{"type":"prompt_embeds","data":"<embedding_base64>"}` | 向量只代表该内容块、不含外围角色标记；服务照常套模板并与文本块按序拼接（若提前把角色标记编进向量会重复） |
| Completions 顶层 `prompt_embeds` | 单个或多个 base64 字符串 | 每个张量即一条完整输入，**不套模板**；与 `prompt` 同传时按「先嵌入、再普通 prompt」组成一批独立请求，不拼成同一句；不能与 `echo` 或 `prompt_logprobs` 共用 |
| 图像/视频/音频预计算嵌入 | `image_embeds` 及模型要求的网格/尺寸字段 | 走独立开关 `--enable-mm-embeds`，详见[多模态推理](multimodal-inference.md#预计算媒体向量视频帧元数据与音频预处理边界) |

**边界与例外**：在 `v0.30.0 / main` 中，入口明确拒绝 encoder-decoder 模型使用 `prompt_embeds`，并新增 `VLLM_MAX_EMBED_DECODE_BYTES` 上限（默认 `2 GiB`，设为 `0` 关闭）。该检查在张量稠密化前按「元素数 × 原 dtype 字节」拦截超大输入。昇腾 runner 虽带接收张量分支，但普通纯文本请求仍走 token 编号路径。

## 模板和分词能否拆成一个独立的 CPU 服务？

**可以。独立 renderer 把“准备模型输入”做成 HTTP 服务，调用方先拿到编号、采样参数和必要的媒体数据，再交给另一个生成服务。** renderer 在 CPU 上加载模型配置、分词器与聊天模板，不创建推理引擎也不加载模型权重；代价是增加网络往返、序列化与在途状态（调大 `--renderer-num-workers` 只扩大单服务内部线程池，不会自动拆出独立服务）。

```wiki-diagram
file: api-renderer-services
```

以纯文本聊天为例，三段调用串联如下。先调 `POST /v1/chat/completions/render` 取回示意编号 `7、31、1052、9` 与生成参数。再提交到生成服务的 `POST /inference/v1/generate` 取得输出编号。支持 derender 的版本再把输出编号交回 `POST /v1/chat/completions/derender`，还原成文字、思考段或工具调用（derender 只做输出整理，不重跑模型）。

调用方必须保留原始请求（含工具定义）与输入计数。设输入 `4` 枚、输出 `2` 枚，后处理时连同输入计数交回，汇总总用量为 $N_{\text{total}} = 4 + 2 = 6$ 个 token（旧协议缺失输入计数时记为 `0`）。多模态场景下 Chat render 会跳过本地缓存命中直返下游所需的完整媒体特征与占位范围（特征可能仍是设备编码器的输入，不是已在 CPU 编完），调用方不能只转发文字编号。

**边界与例外（流式 derender）**：在 `v0.30.0` 与 `main` 中，同一 `/derender` 地址另支持 `stream=true` 做逐片段后处理。调用方每次提交 `generate_chunk` 与上一轮 `stream_state`，响应回传 `chunk` 与更新后的 `stream_state`。注意**每次调用回一份 JSON，自身不是 SSE 推送连接**；且 `v0.30.0 / main` 的逐片段 Chat 分支若已配置思考/工具解析器，或单片段含多个 choice，都会直接拒绝，须改走完整结果后处理。

## 换成 DeepSeek Recipe，入口负责到哪里

DeepSeek Recipe 先将 Messages、Chat Completions、Responses 等接口格式转换为统一对话，再渲染为 DeepSeek 提示词，并配合调用方提供的分词器得到编号。返回时它把推理后端输出解析为对应协议事件。**模型推理、工具执行与 HTTP 传输仍由调用方提供**——解析出“调用某个工具”的描述不等于已经执行了工具。

排查边界可以按链路分段核对：
- **同请求结果不同**：先比转换后的对话与[模板及输入编号](token.md#deepseek-recipe控制标记与用户文字怎样分开)，再比发给后端的采样与输出预算。
- **事件未达客户端**：查[流式返回](streaming-output.md#deepseek-recipe编号流与文本流的边界不同)与传输层。
- **上下文与约束边界**：图片展开后的额外 token 须在编码后核算；协议接收 schema 不等于后端已约束采样（见[结构化输出的后端约束](structured-output.md#协议接受了-schema是否就已经约束采样)）。

## 工具模板、解析器和插件，分别接在哪一侧？

工具调用必须把输入与输出两端配对：**输入端模板告诉模型有哪些工具、按何格式写调用；输出端解析器把模型写出的文本拆回函数名与参数。** 模型按方括号格式写、解析器只认 JSON 时，单换解析器改不了模型输入。

| 请求走到哪里 | 这一层负责什么 | 使用时要配合什么 |
|---|---|---|
| 入口套模板 | 把工具定义、历史调用与工具结果放进模型熟悉的位置 | 模型专用模板及其消息格式 |
| 模型生成内容 | 生成普通回答或工具调用 | 训练时的格式；需参数硬约束见[工具调用与文法](structured-output.md#工具调用能解析出来就说明参数符合-schema-吗) |
| 前端解析输出 | 将文本整理为接口的 `tool_calls` 列表 | 匹配该模型输出格式的解析器 |
| 应用处理结果 | 校验参数、执行工具并按调用 ID 回填结果 | 保留 `tool_call_id` 进入下一轮 |

插件（`--tool-parser-plugin`）把**额外的 `ToolParser` 子类载入前端并注册成名字**（通过 `ToolParserManager.register_module` 显式或延迟注册）。随后用 `--tool-call-parser` 选中该名字；它不替换聊天模板，也不自动附带文法约束。

**边界与例外（官方模板硬约束）**：
- **Llama 3.1/3.2**：固定 JSON 模板要求历史 assistant 消息恰好含 1 次调用；Pythonic 模板按列表写。
- **Mistral**：要求调用 ID 至少 9 字符，并取末 9 字符。
- **DeepSeek V3 / V3.1**：V3 使用 JSON 围栏，与 V3.1 格式不同，不能仅凭名字相近互换。

## 复杂异构实战对照：GLM 双机单前端入口与限制

### 放到 GLM 双机：node0 上一个前端接下全部请求

**主线把 GLM-5.3-Flash 部署在两台昇腾服务器上，每台 8 张 NPU 卡，两台各是一个 DP 组（部署前提见[GLM 双机部署](glm-5-3-flash-two-node.md#部署前提)）。入口只在 node0 上：一个 API server 接下两台机器的全部请求，上面七步都在 node0 的 CPU 上做；`vllm-ascend` 没有改这一段。** 本页对应主线[第 1 站 入口](one-request.md#第-1-站-入口从-http-到-node0-的引擎)。

**谁在接请求。** node0 把 `--api-server-count` 设成 `1`，由 `vllm serve` 进程自己监听 `8000` 端口；node1 以 `--headless` 启动，只起本机 EngineCore（见[双机部署里一共有哪些进程](engine-processes.md#双机部署里一共有哪些进程)）。教程未改 `--renderer-num-workers`，因此两组请求的模板、分词都排在 node0 的 `1` 个工作线程上。

**请求怎么写。** 服务对外名设成 `glm`，请求里模型名要么写 `glm`、要么省略，写目录名会在第 ① 步回 404。聊天接口用模型自带模板（一条消息多出 6 个特殊标记和一行系统说明，见 [token 页的 GLM 一节](token.md#r1-在入口拿到了什么)）。教程验证示例走老式 `/v1/completions` 且误写了 `max_completion_tokens: 50`，该字段被忽略，实际仅按默认最多生成 `16` 个 token。采样默认来自模型生成配置（见[请求不写采样参数时用的是什么](sampling.md#请求不写采样参数时用的是什么)）。

**长度上限。** 总长度上限设成 `133120`。沿用 R1（4 个提示词 token，教学设定，走普通文本编号而非 `prompt_embeds`）与 `max_tokens = 200`：

$$L_{\text{in,allow}} = 133{,}120 - 200 = 132{,}920, \qquad L_{\text{out}} = \min(133{,}120 - 4,\; 200) = 200$$

| R1 入口长度核验（$L_{\max} = 133{,}120$） | 算式 | 结果与说明 |
| --- | --- | --- |
| 允许的最大输入（取 `max_tokens=200`） | $133{,}120 - 200$ | **`132,920` 个**（R1 的 4 个在允许范围内） |
| R1 有效输出上限 | $\min(133{,}120 - 4,\; 200)$ | **`200` 个** |
| 若聊天请求两项输出上限都不写 | $133{,}120 - 4$ | **`133,116` 个**（按剩余上下文补齐） |

**工具调用与解析器。** 主线启动命令未配工具与推理解析器，故 `tool_choice="auto"` 会在第 ① 步被拒。普通 HF tokenizer 路径下，`required` 或指定函数名同样要求 `--tool-call-parser`（仅 `auto` 另需 `--enable-auto-tool-choice`）。教程 FAQ 给出 `glm47` 工具解析器与 `glm45` 推理解析器，并说明该模型不支持 `enable_thinking=false`。`tool_choice="none"` 默认仍把 `tools` 定义交给模板（除非开启 `exclude_tools_when_tool_choice_none`）。

**R1 怎样离开入口与昇腾边界。** 登记输出槽后两组皆空，R1 落到 node0 上的 DP0（经 node0 TCP ZMQ 发送，见[进程之间的四条通道](request-call-chain.md#进程之间的四条通道)）。钉住版本中 `vllm-ascend` 仅在输出侧修正流式工具调用分段，不改动请求入口。

## 多模态输入、Pooling 与语音入口延伸导览

除纯文本自回归生成外，前端还承接图像/视频/音频多模态输入、非自回归池化接口与语音转写/实时流；这些专题的完整机制、图解、参数与四版边界已整合至两篇专页：

- **图像/视频/音频前端预处理与四级缓存**：涵盖媒体占位 token 展开与四级缓存分工。四级缓存依次为 `VLLM_MEDIA_CACHE` 下载缓存、`mm_processor_cache`（支持部分命中合并，受单 API/DP=1 约束）、编码缓存管理器与 APC。详见[一张图怎样变成 token 序列](multimodal-inference.md#一张图怎样变成语言模型吃得下的-token-序列)与[四级缓存分工](multimodal-inference.md#下载缓存mm_processor_cache编码缓存与-kv-cache-分工)。
- **媒体 UUID、预计算媒体向量与音视频预处理**：涵盖 `multi_modal_uuids` 省传原图边界与 `--enable-mm-embeds`（Qwen2-VL/MiniCPM/Qwen3-VL 布局）。同时涵盖视频时间元数据、OpenCV 坏帧恢复，以及音频重采样与静音切分。详见[媒体 UUID](multimodal-inference.md#媒体-uuidmulti_modal_uuids与省传原图的边界)与[预计算媒体向量与音视频边界](multimodal-inference.md#预计算媒体向量视频帧元数据与音频预处理边界)。
- **Pooling、评分与语音 ASR 入口**：非自回归侧涵盖 `/v1/embeddings`、`/classify`、`/score`、`/rerank` 与 `/pooling`（含自定义 I/O 插件扇出）。此外还提供生成式评分 `POST /generative_scoring`，语音侧涵盖 `/v1/audio/transcriptions`、`/v1/audio/translations` 与 `/v1/realtime` WebSocket 事件时序。详见[Pooling 与非自回归推理](pooling-and-non-ar.md#--runner-pooling-核心机制掩码硬件分岔与池化头)、[生成式评分](pooling-and-non-ar.md#生成式评分generative_scoring与-pooling-score-的边界及概率比较)与[语音上传与实时转写入口](pooling-and-non-ar.md#语音文件上传v1audio与实时转写v1realtime入口)。

## 常见误解

- **「API server 把请求交给引擎就没它的事了。」** 发送前就登记了反分词器和输出槽，每步结果都回这里还原文字，请求结束才删记录。
- **「流式请求收到 200 说明引擎已经接下了它。」** 200 在交给 `AsyncLLM` 之前就发出了；第 ⑤ 步的词表越界、组号越界等错误只能写进流里。
- **「采样在入口做。」** 入口只定下并校验采样参数；真正采词是第 5 站 worker 上的事（见 [采样](sampling.md)）。
- **「提示词长度按用户打的字数算。」** 按套完模板、分词后的整串编号算，模板加进来的特殊标记和系统说明全部计入。
- **「聊天接口里让分词器再补一遍特殊标记更保险。」** 模板已写好起始标记，再补会重复；只有不套模板的补全接口默认补。
- **「请求头里的 `X-Request-Id` 就是引擎里的请求 ID。」** 对外加 `chatcmpl-`，内部再拼 8 位随机后缀（`n > 1` 再加候选序号前缀）；查日志须按包含关系关联。

## 对照源码

### 怎么开

**基础服务入口、YAML 配置与模板守卫**：

| 作用 | 启动入口与定义默认 | 实际含义与边界 |
|---|---|---|
| 加载模型 | `serve` 位置参数（内部默认 `Qwen/Qwen3-0.6B`） | HF 仓库 ID 或本地目录；正式部署显式传入 |
| 对外命名 | `--served-model-name`（默认 `None`） | 可传多个别名（同一基座）；响应与指标取首个名字 |
| 监听地址/端口 | `--host`（默认 `None` 绑全 IPv4）、`--port`（默认 `8000`） | `0` 交由系统分配临时端口；非 DP/HCCL/ZMQ 内部端口 |
| YAML 配置 | `--config`（单文件 `.yaml/.yml`） | 优先级 **CLI > YAML > 默认**；字典转 JSON、列表展开、`null` 转 `"None"`；带 `--config` 缺模型报 `No model specified!` |
| 模板内容格式 | `--chat-template-content-format`（默认 `auto`） | 控制交给模板的 `content` 形态（`auto`/`string`/`openai`），不是返回 JSON 开关 |
| 信任请求模板 | `--trust-request-chat-template`（默认 `false`） | 关闭时请求带非 `null` `chat_template`（含 `""`）直接拒收；非 `trust_remote_code` |
| HTTP 空闲保活 | `VLLM_HTTP_TIMEOUT_KEEP_ALIVE`（默认 `5` 秒） | 传给 Uvicorn `timeout_keep_alive`，管响应结束后复用连接的空闲窗口，不管流式心跳或推理超时 |

**工具解析器插件与独立 CPU renderer**：
- 自定义工具解析器通过 `--tool-parser-plugin /srv/parsers/my_parser.py`（仅在长度 `> 3` 时尝试导入）配合 `--tool-call-parser my_parser --enable-auto-tool-choice` 加载，模块内需显式或延迟调用 `ToolParserManager.register_module(name="my_parser", module=MyToolParser)`：

```bash
vllm serve /models/my-model \
  --tool-parser-plugin /srv/parsers/my_parser.py \
  --tool-call-parser my_parser \
  --enable-auto-tool-choice \
  --chat-template /srv/templates/my-model-tools.jinja
```

- 独立 CPU renderer 用 `vllm launch render MODEL` 启动，提供 `POST /v1/chat/completions/render` 与 `/v1/completions/render`，配合生成端 `POST /inference/v1/generate` 与 `/derender`（`v0.30.0` 与 `main` 普通 `serve` 均通过 `--enable-scale-out` 开启；早期历史快照 `84030bbe` 曾短暂使用环境变量 `VLLM_ENABLE_SCALE_OUT_ENDPOINTS` 控制）。
- 其余前端与请求头开关：`--api-server-count`（internal LB 默认等于 DP 组数；node0 为 `1`、node1 `--headless`）、`--renderer-num-workers`（默认 `1`）、请求头 `X-Request-Id` 与 `X-data-parallel-rank`、环境变量 `VLLM_SKIP_MODEL_NAME_VALIDATION`、`VLLM_DISABLE_REQUEST_ID_RANDOMIZATION`（已标记将移除）、`VLLM_KEEP_ALIVE_ON_ENGINE_DEATH`、`VLLM_ENABLE_RESPONSES_API_STORE`（默认 `0`）。

**思考强度进入模板**：Chat 顶层 `reasoning_effort`（默认 `None`，枚举 `none`/`minimal`/`low`/`medium`/`high`/`xhigh`/`max`）显式传入且 `chat_template_kwargs` 未含 `enable_thinking` 时，自动补入 `enable_thinking`（`none -> false`，其余 `-> true`），顶层字段优先覆盖 `kwargs` 同名键，最终结果仍按模板声明过滤。

**总长度（`--max-model-len`）与输出预算（`max_completion_tokens` / `max_tokens`）**：

| 配置项 | 默认与合法值 | 规则与关键特例 |
|---|---|---|
| `--max-model-len` | `None`（按模型配置推导，缺失回退 `2048`）；支持正整数、CLI `auto`/`-1` 及 `1k=1000`/`1K=1024`（`1.5K` 非法） | `auto`/`-1` 按所有 worker KV 容量取可容纳最大长度（不扩内存）；`VLLM_ALLOW_LONG_MAX_MODEL_LEN` 仅绕过长度越界校验，不扩 KV；GLM 双机显式设 `133120` |
| Chat `max_completion_tokens` / `max_tokens` | 均默认 `None` | 非空 `max_completion_tokens` 优先（即便传非法 `0` 也不回退 `max_tokens`）；两项皆空取生成默认，否则取剩余上下文 |
| Completions `max_tokens` | 省略 `16`；显式 `null` 走默认推算 | 无 `max_completion_tokens`；仅 `echo=true` 且 `max_tokens=0` 允许 0（内部仍采样 1 枚再裁切） |
| 服务端硬上限取小 | 入口取 $\min(\text{请求/默认},\; L_{\max}-L_{\text{in}},\; \text{覆盖上限},\; \text{平台上限})$ | 模型 `generation_config.json` 的 `max_new_tokens` 可被请求替换；`--override-generation-config` 或指定配置目录给的 `max_new_tokens` 是硬上限 |

**输入协议（`messages` / `prompt`）与请求日志**：
- Chat 必填 `messages` 列表（不接受 `null`，`content` 支持字符串或图文内容块数组）；Completions `prompt` 默认 `None`，支持单串、单编号列表、字符串列表或编号列表的列表（列表代表多条独立输入），无 `prompt_embeds` 时空串/空列表均被拒。
- `--enable-log-requests`（默认 `false`）在 INFO 记录 ID 与采样参数，输入正文/编号需 `VLLM_LOGGING_LEVEL=DEBUG`；`--max-log-len`（默认 `None`）按字符数/编号个数切片（不限整行字节，负值沿用 Python 切片）；`--enable-log-outputs`（默认 `false`，依赖前者）按 INFO 记录输出正文；`--uvicorn-log-level`（默认 `info`，六档 `critical..trace`）管 HTTP 服务器日志，不替代 vLLM 内部日志（详见[性能分析日志参考](inference-performance-analysis.md#怎么开)）。

```yaml
# 入口配置示意（CLI > YAML > 默认，不含并行/量化全量参数）
model: /models/example
served-model-name: [demo, demo-v1]
host: 0.0.0.0
port: 8000
chat-template-content-format: auto
trust-request-chat-template: false
```

多模态预处理/缓存/UUID 入口见[多模态推理「怎么开」](multimodal-inference.md#怎么开)；Pooling、生成式评分与语音上传/实时转写入口见[Pooling 与非自回归「怎么开」](pooling-and-non-ar.md#怎么开)。

### 会报什么错

- **启动与配置解析**：`--config` 路径/语法/未注册键/多文件、`No model specified!`、`port` 非法或占用、`chat-template-content-format` 枚举非法、`VLLM_HTTP_TIMEOUT_KEEP_ALIVE` 非整数报 `ValueError`；`max_model_len` 非正整数或超推导值报 `User-specified max_model_len ... is greater than the derived max_model_len`，`auto` 放不下报 `Cannot auto-fit max_model_len: not enough GPU memory available`。
- **模型、模板与工具检查**：模型名不匹配报 ``The model `xxx` does not exist.``（404，先于消息整理与分词）；未信任请求模板报 `Refused request with untrusted chat template.`；未开自动工具选择报 `"auto" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set`；未注册插件名报 `invalid tool call parser`；Llama JSON 模板多调用报 `This model only supports single tool-calls at once!`，Mistral 模板检查调用 ID 长度 `>= 9`。
- **长度、输入与引擎校验**：Completions 缺输入报 `Either prompt or prompt_embeds must be provided and non-empty.`；分词超长报 `This model's maximum context length is ... tokens ... your prompt contains at least ...`；推算超长报 `Input length (...) exceeds model's maximum context length (...)`；顶满上限报 `max_tokens must be at least 1, got 0.` 或 `The decoder prompt ... plus ... is longer than the maximum model length`；打包前空提示词/越界编号/越界 DP 组号在流式里写进流中；引擎停机报 `EngineDeadError`（500 后前端退出）。
- **协议与独立 renderer**：Responses 关闭保存时请求 `background=true` 或引用未知 `previous_response_id` 失败；Chat render 拒绝 beam search；逐片段 Chat derender 遇已配置 reasoning/tool parser 或多 choice 拒绝。

### 开销和什么时候别开

前端瓶颈特征是 NPU 不忙、TTFT 随并发上升且 API server CPU 打满：此时优先增加 `--renderer-num-workers` 或 `--api-server-count`（后者会改变多前端 DP 打分系数）。调试日志 `DEBUG` 会记录用户原文且增加 I/O，压测应关闭或注明；`VLLM_HTTP_TIMEOUT_KEEP_ALIVE` 只影响空闲 socket 复用，不解决推理慢；不要为查日志开启 `VLLM_DISABLE_REQUEST_ID_RANDOMIZATION`（撞 ID 报错），也不要在 Chat 打开 `add_special_tokens`。`--max-model-len` 调小会收紧最长请求但不会自动缩减既有 KV 显存预算（GLM 沿用 `133120`，未以 `auto` 替代显式规划）。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm@0fc695fc` / `vllm-ascend@2c59ff10`）、`v0.26.0rc`（`vllm@568afb3a` / `vllm-ascend@2ed6cbba`）、`v0.30.0` 主基线（`vllm@ced6857a` / `vllm-ascend@c09d3e20`）与 `main`（`vllm@ba15685a` / `vllm-ascend@8d6180e2`）。DeepSeek Recipe 独立以仓库 `935817c6` 为准。

| 核验维度 | `v0.23.0 (0fc695fc / 2c59ff10)` | `v0.26.0rc (568afb3a / 2ed6cbba)` | `v0.30.0 (ced6857a / c09d3e20)` | `main (ba15685a / 8d6180e2)` |
|---|---|---|---|---|
| API 服务启动与入口组织 | `entrypoints/openai/api_server.py` 与 `launcher.py` | 延续 `api_server.py`；新增 `scale_out` 路由 | 迁入 `entrypoints/launchers/api_server/entry.py`、`launchers/launcher.py` 与 `launchers/cli_args.py` | 延续 `launchers/`；原 `cli_args.py` 进一步拆分 |
| 预处理器与多进程准入控制 | `serve/render/serving.py`，2 ms 微批（最多 32 条）共用 1 线程；单进程在途计数 | 迁至 `renderers/online_renderer.py`，逐条交线程池（默认 1 线程） | 延续 `OnlineRenderer`（多模态另 1 线程）；新增 `admission_control.py` 共享槽位近似汇总多 API 进程在途数（`n>1` 占 `n` 槽，HTTP 503 与 `max_num_seqs` 分层） | 延续 `OnlineRenderer` 与 `SharedAdmissionStats` |
| 优雅停机（`--shutdown-timeout`） | `entrypoints/launcher.py` 协调 HTTP 与引擎死亡退出 | 同 `v0.23.0` | `shutdown_timeout=0`；事件循环接管停机信号，先按超时停 `engine_client` 再关 Uvicorn | 细化 `Server.shutdown()` 与 `handle_shutdown()` 协调 |
| 拆分 render / derender 接口 | 生成任务直接挂 render 与 token-in/out；无 derender | 直接注册 render / 完整 derender；`launch render` 初始化后处理 | 普通 `serve` 需 `--enable-scale-out`；同一 `/derender` 新增 `stream=true` 逐片段后处理（Chat 拒 parser 与多 choice） | 延续 `--enable-scale-out` 与 `stream=true` 逐片段后处理（`VLLM_ENABLE_SCALE_OUT_ENDPOINTS` 仅见于更早祖先快照 `84030bbe`，`ced6857a` 与 `ba15685a` 均已改用 CLI 开关） |
| 工具插件与 YAML / 内容格式 | 插件仅按文件路径导入；YAML 略过 `false`；显式内容格式不告警 | 同 `v0.23.0` | 插件先按模块名导入再回退文件路径；YAML `false` 在有负开关时转 `--no-`；显式内容格式与模板检测不符时告警 | 同 `v0.30.0` |
| `max_model_len` 与 `prompt_embeds` | KV 搜索不扣 null block；`prompt_embeds` 直接稠密化 | 稀疏不变量检查加进程锁 | KV 搜索先扣 1 个保留 null block；`yarn` 按已缩放处理；`prompt_embeds` 拒 encoder-decoder 并增 `VLLM_MAX_EMBED_DECODE_BYTES`（默认 `2 GiB`） | 延续 null block 与 `2 GiB` 保护（历史快照 `84030bbe` 的 `yarn` 仍重乘 `factor`，升级须核对） |
| 昇腾入口补丁边界 | 仅动流式输出分段与空 `tool_calls` | 另包装 `render_chat` 承接重算恢复 token 列表 | 仅留特定模板/思考边界轻量补丁，入口主体完全复用上游 | 完全复用上游 OpenAI API 入口与预处理器 |

多模态预处理/四级缓存的四版差异见[多模态推理「版本差异」](multimodal-inference.md#版本差异)；Pooling、生成式评分与语音入口的四版差异见[Pooling 与非自回归「版本差异」](pooling-and-non-ar.md#版本差异)。

### 源码位置

以下编号与页首 `sources` 列表一一对应：

- **官方文档与外部契约**：在线服务总览、OpenAI 兼容接口、`prompt_embeds` 与工具调用指南见 [S1][S2][S3][S4]；Uvicorn `timeout_keep_alive` 与 DeepSeek Recipe 契约见 [S5][S6]；GLM 双机启动命令与 FAQ 见 [S7][S8]。文中 R1 长度减法账与独立 renderer `4 + 2 = 6` 用量账按定义直接推导 [D][D]，本页无前端 CPU 耗时实测。
- **入口 ①–⑦ 主链、流式/非流式与错误处理**：路由与三种返回（`api_router.py`）、模型检查/采样打包/流式写错（`chat_completion/serving.py`、`engine/serving.py`）、套模板分词与线程池（`render/serving.py`、`renderers/base.py`、`params.py`）、输出预算推算（`api_utils.py`）见来源 9–16 [C9][C10][C14][C16]；打包校验、拆 `n` 子请求、先登记 `OutputProcessor` 输出槽、ZMQ 选组发送与 EngineCore 输入线程入 `waiting` 见来源 17–26 [C17][C19][C20][C21][C23]。
- **兼容协议、外层包装、嵌入输入与工具插件**：Responses 会话保存、Anthropic Messages 转换、SageMaker `/invocations`、DeepSeek Ray Serve 示例、`prompt_embeds` 校验与 `ToolParserManager` 插件加载见来源 27–32 [C27][C31][C32]。
- **`v0.26 / v0.30.0 / main` 演进与昇腾补丁**：`OnlineRenderer`、独立 `render/derender`、`shutdown_timeout`、共享准入 `SharedAdmissionStats`、`max_model_len` / null block / YAML 与日志配置见来源 33–52 [C35][C40][C45]；昇腾侧仅改输出分段与 `v0.26` `render_chat` 恢复包装见来源 53–55 [C53]。
