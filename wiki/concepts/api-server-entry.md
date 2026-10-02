---
id: api-server-entry
title: API server 入口：一个 HTTP 请求怎样变成引擎里的请求
type: concept
summary: vLLM 前端进程从收到 HTTP 请求到交给某个 EngineCore 之间做的事：检查、套聊天模板、分词、定输出上限和采样参数、包成 EngineCoreRequest、先在本进程登记反分词器和输出槽，再选 DP 组经 ZMQ 发出。讲清每一步在哪里拒绝请求、流式与非流式的差别、CPU 开销，以及 GLM 双机上 node0 一个前端接全部请求。
aliases: ["API server 入口","API server","请求入口","入口站","OpenAI 兼容接口","/v1/chat/completions","OpenAIServingChat","process_inputs","add_request","套模板与分词入口","X-Request-Id"]
chapters: ["10"]
order: 85
sources:
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/api_router.py#L40-L75
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L192-L392
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L497-L937
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L938-L964
  - vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L211-L238
  - vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L387-L412
  - vllm@0fc695fc:vllm/entrypoints/serve/render/serving.py#L183-L266
  - vllm@0fc695fc:vllm/entrypoints/serve/render/serving.py#L452-L471
  - vllm@0fc695fc:vllm/entrypoints/serve/render/serving.py#L521-L568
  - vllm@0fc695fc:vllm/renderers/base.py#L84-L155
  - vllm@0fc695fc:vllm/renderers/base.py#L338-L360
  - vllm@0fc695fc:vllm/renderers/base.py#L1018-L1056
  - vllm@0fc695fc:vllm/renderers/hf.py#L876-L878
  - vllm@0fc695fc:vllm/utils/async_utils.py#L24-L50
  - vllm@0fc695fc:vllm/renderers/params.py#L186-L192
  - vllm@0fc695fc:vllm/renderers/params.py#L415-L435
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L290-L296
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L503-L520
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L634-L639
  - vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L60-L100
  - vllm@0fc695fc:vllm/entrypoints/openai/completion/serving.py#L155-L170
  - vllm@0fc695fc:vllm/entrypoints/openai/engine/protocol.py#L25-L60
  - vllm@0fc695fc:vllm/sampling_params.py#L534-L540
  - vllm@0fc695fc:vllm/entrypoints/serve/utils/api_utils.py#L170-L206
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L280-L414
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L524-L600
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L637-L690
  - vllm@0fc695fc:vllm/v1/engine/input_processor.py#L223-L385
  - vllm@0fc695fc:vllm/v1/engine/input_processor.py#L387-L484
  - vllm@0fc695fc:vllm/v1/engine/output_processor.py#L45-L92
  - vllm@0fc695fc:vllm/v1/engine/output_processor.py#L512-L541
  - vllm@0fc695fc:vllm/v1/engine/output_processor.py#L600-L612
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L1344-L1360
  - vllm@0fc695fc:vllm/v1/engine/core.py#L341-L377
  - vllm@0fc695fc:vllm/v1/engine/core.py#L819-L841
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1518-L1543
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1801-L1823
  - vllm@0fc695fc:vllm/entrypoints/serve/utils/error_response.py#L16-L50
  - vllm@0fc695fc:vllm/entrypoints/cli/serve.py#L99-L148
  - vllm@0fc695fc:vllm/entrypoints/serve/utils/server_utils.py#L327-L445
  - vllm@0fc695fc:vllm/entrypoints/launcher.py#L168-L178
  - vllm@0fc695fc:vllm/v1/engine/parallel_sampling.py#L52-L94
  - vllm@0fc695fc:vllm/utils/async_utils.py#L90-L110
  - vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L262-L292
  - vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L416-L430
  - vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L354-L391
  - vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L147-L185
  - vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L291-L305
  - vllm-ascend@2c59ff10:vllm_ascend/patch/__init__.py#L199-L218
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/__init__.py#L200-L260
  - vllm@568afb3a:vllm/renderers/base.py#L87-L100
  - vllm@568afb3a:vllm/renderers/online_renderer.py#L95-L120
  - vllm@98dff2a8:vllm/renderers/base.py#L92-L107
verified: []
evidence: "C"
relations:
  - {to: engine-processes, kind: builds-on, note: API server 是哪个进程、和 EngineCore 与 worker 怎样分工、各自跨步留着什么}
  - {to: token, kind: builds-on, note: 聊天模板与字节级 BPE 分词本身怎么做，GLM 模板加了哪些特殊标记}
  - {to: request-call-chain, kind: builds-on, note: 入口之后六站各从哪个函数进，进程之间走哪几条通道}
  - {to: dp-request-routing, kind: builds-on, note: 入口最后一步派给哪一组的打分规则，计数从哪来、为什么会过时}
contradicts: []
updated: "2026-10-02"
origin: seed
---

## 一个 HTTP 请求进了 API server，出来的是什么？

**API server 入口指 vLLM 前端进程从收到一个 HTTP 请求、到把它交给某个引擎排队之间的这一段：把一段 JSON 改写成引擎能直接用的请求对象（一串 token 编号加一组采样参数），并在自己的进程里留好回程的接收点。**

这里有两个进程。API server 是接 HTTP 请求的进程，对外提供和 OpenAI 一样格式的接口，执行 vllm serve 时起的就是它；EngineCore 是负责排队、调度并驱动模型计算的引擎进程（见 [EngineCore](vllm-engine-core.md)）。两者不在同一个进程里，请求要从前者交到后者手里。

举个具体的例子。客户端发来这样一段 JSON：消息列表里只有一条，角色是用户，内容是「你好」，并且要求边生成边返回（流式）。引擎既不认 JSON，也不认汉字，它要的是三样东西：

- 一串 token 编号，例如示意的 7、31、1052、9；
- 一组采样参数：最多生成多少个 token、按什么规则从候选里挑、遇到什么就停；
- 一个请求 ID，用来在之后的每一步里认出这条请求。

前端自己还要记住一件事：引擎之后每一步交回来的编号，要还原成文字，推回这一个 HTTP 连接。下图把这一路画出来，左列是同一条请求在前端里一步步变成的样子：

```wiki-diagram
file: api-server-entry
```

① 到 ⑤ 都在改写请求本身：先检查，再按模型训练时约定的对话格式拼成一段带角色标记的文本（这一步叫套聊天模板），再切成编号，定好长度上限和采样参数，最后包成引擎请求。⑥ 不改请求，而是在前端留一个回程的接收点。⑦ 才第一次跨过进程边界：开了 DP（data parallel，数据并行）的部署有好几个执行组，每组一个 EngineCore，各排各的队，前端要先挑一组再发过去。后面几节按这个顺序展开。

## 为什么要在前端先做完这些，代价在哪？

**引擎只认编号，所以文字变编号必须在请求进模型之前做完；这些都是 CPU 上的字符串活，放在前端，引擎进程就能一直忙着调度和驱动 NPU。** 模型的第一步是拿编号去查[嵌入表](embedding.md)，没有编号就无从算起。套模板、分词、把输出编号还原成文字（反分词）都不需要 NPU，交给单独的前端进程，和引擎各干各的，见[引擎进程](engine-processes.md#每个进程里存着什么)。

**坏请求在门口拒掉，不占引擎的资源。** 一条请求一旦进了引擎的等待队列（waiting），就会占调度名额，开算后还要占 [KV cache](kv-cache.md)（保存每个 token 历史结果的显存）的块。模型名写错、提示词超长、采样参数不合法，这些在入口都查得出来，直接回 400 或 404，引擎根本不知道它来过。

**回程要先有落脚的地方。** 引擎每走一步，把这一步所有请求的结果打成一包交回前端；前端按请求 ID 把它们分拣到各自的连接。所以入口的顺序是先登记、后发送：前端分拣时遇到不认识的 ID 会直接丢掉，先登记才能保证引擎最早交回的那一批也有处可落。

代价都在主机这边：

- **CPU 时间。** 套模板和分词默认挤在一个工作线程上，所有请求排队用它；提示词越长，分词越久。这段时间算在首 token 时延里，也就是从发出请求到收到第一个输出 token 的时间。
- **主机内存。** 每条请求在前端留一份记录（反分词进度和输出槽），请求结束才删。
- **前端进程个数有限。** 只起一个 API server 时（后面的 GLM 主线就是这样设的），所有连接、模板、分词、反分词都在这一个进程里；并发很高时，它的 CPU 可能先于 NPU 成为瓶颈。

入口和相邻几个环节容易混，分工如下：

| 环节 | 在哪个进程 | 管什么 | 不管什么 |
|---|---|---|---|
| 入口（本页） | API server | 文字变编号；把请求里的采样设置定成参数并校验 | 不选 token，不排队 |
| [采样](sampling.md) | worker（NPU 上） | 照这组参数从每个词的分数里选出 token | 不再改参数 |
| [DP 请求路由](dp-request-routing.md) | API server | 入口最后一步：派给哪一个 DP 组 | 不看请求内容 |
| 返回 | API server | 把编号还原成文字，推回连接 | 不碰模型计算 |

## 怎么做：从 JSON 到一串编号（① 到 ④）

**前四步只在前端改写请求：先查能不能收，再把消息拼成文本、切成编号，最后按长度上限定下最多能生成多少个 token。任何一步不过关，都直接回一个带错误信息的 JSON，请求不会到引擎。**

**① 检查。** 网页框架先按接口约定检查 JSON 的字段和类型，格式不对回 400。接着看请求里写的模型名：服务启动时给模型起了一个对外的名字（served model name），请求要么不写，要么写这个名字，写别的回 404。还有两类选项要服务端事先打开才收：请求自己带一份聊天模板，要启动时声明信任请求里的模板；让模型自己决定要不要调用工具（tool_choice 设为 auto），要启动时打开自动工具选择并指定工具调用的解析器。这些都没打开时，请求被拒。最后，引擎如果已经停止，前端直接报错，不再往下做。

**② 套聊天模板。** 聊天接口收到的是一串消息，每条带角色（系统、用户、助手）和内容。模型训练时见到的对话都是按固定格式拼成的一整段文本，角色之间用特殊标记隔开，最后还有一个「轮到助手回答」的标记。前端用模型自带的模板（一段 Jinja 模板，随分词器文件一起发布）把消息拼成这样一段文本。模板长什么样、为什么要这样拼，见 [token 页的聊天模板一节](token.md#聊天消息先套模板再分词)。

**③ 分词。** 拼好的文本交给分词器，切成一串 token 编号；分词器怎样切，见 [token](token.md#字节级-bpe-怎样一步步切出-token)。这里有两个入口特有的细节：

- **不再补一遍特殊标记。** 模板已经把起始标记和角色标记写进文本了，聊天接口默认不让分词器再加自己的起始标记，否则开头会多出一份，长度和模型看到的格式都变了。
- **在线程池里做。** 前端靠一个事件循环同时照看所有连接，套模板和分词这类耗 CPU 的活要是直接在循环里做，别的连接都得等。所以这两步交给一个专门的线程池，默认只有 1 个线程；v0.23 还会把 2 ms 内到达的分词请求攒成一批（最多 32 条）一起切。

**④ 定输出上限和采样参数。** 模型一次能处理的序列有个总长度上限（max model len），输入和输出共用它。请求写了最多生成多少个 token（max_tokens，新写法叫 max_completion_tokens，两个都写时用后者），输入就只能占剩下的部分；没写，前端就把上限减去输入长度当作输出上限；模型的生成配置里给了最大新 token 数、或启动时覆盖了这项默认值的，再和它们取小。两种情况用一组示意数各走一遍，设总长度上限是 100：

```calc
title: 总长度上限 100 时，入口怎样检查和定输出上限（示意数）
请求要 30 个输出，输入最多 = 100 − 30 = 70 个
提示词其实有 75 个编号，比允许的多 = 75 − 70 = 5 个
> 分词结果只保留到第 71 个，够判超长就回 400，错误信息写「输入至少 71 个」
不写输出数、提示词 12 个，输出上限 = 100 − 12 = 88 个
```

注意这里的「提示词」是套完模板以后的整串编号，模板加进来的标记也算在内。分词时让分词器只保留到允许的输入数再多 1 个，是为了不给注定要被拒的长文本多花资源；多出的这 1 个足以判定超长，所以错误信息只能写「至少多少个」。提示词本身就超过总长度上限，或者恰好等于上限、一个输出位置都不剩，同样在入口被拒。

采样参数也在这一步定下，打包成一个采样参数对象（SamplingParams）：请求里写了的用请求的，没写的先取模型目录里生成配置（generation_config.json）给的默认值，再退到 vLLM 的中性默认值；取值不合法（例如 temperature 为负）直接拒绝。来源和取值规则见 [采样参数从哪来](sampling.md#采样参数从哪来)。入口只定参数、不选 token，真正按参数选 token 是第 5 站 worker 上的事。

同一步还定下回程怎么交付：流式请求要「增量」，每次只交新生成的那一段；非流式请求「只要最终结果」，生成完才交一次。

## 怎么做：包成引擎请求，先登记回程再发出（⑤ 到 ⑦）

**后三步交给前端进程里的 AsyncLLM（vLLM 面向服务端的异步引擎接口）：它把编号和参数包成一个 EngineCoreRequest（引擎之间传递请求用的数据结构），先在本进程登记这条请求的回程接收点，再挑一个 DP 组，通过 ZMQ（进程之间收发消息的库）发过去。**

**⑤ 包成引擎请求。** 打包前还要再查一遍：采样参数和要用的任务是否支持、请求头里指定的组号是否在范围内、提示词是不是空的、长度是不是已经顶满上限（一个输出位置都不剩）、编号有没有超出词表（见 [编号要落在词表之内](token.md#编号要落在-154880-行之内)）。都通过后，补齐采样参数：没写输出上限的按上一节的减法补上，模型生成配置里列的结束编号并进「遇到就停」的编号列表（见 [停止判断和长度上限](sampling.md#停止判断和长度上限)）。打出来的请求对象里，和后面几站直接相关的是这几项：

| 字段 | 里面是什么 | 后面谁用 |
|---|---|---|
| 提示词编号 | 第 ③ 步切出的整串编号 | 调度器数长度；worker 拿去查嵌入表 |
| 采样参数 | 第 ④ 步定下并补齐的参数 | 第 5 站选 token；每步判断停不停 |
| 请求 ID | 对外的 ID 后面再加 8 位随机字符 | 回程按它分拣 |
| 到达时间 | 前端收到这条请求的时刻 | 按优先级排队时排先后；统计时延 |
| 指定组号 | 请求头里写的 DP 组号，没写就是空 | 第 ⑦ 步选组 |

对外的 ID 是「chatcmpl-」加上请求头 X-Request-Id 里给的值，没给就随机生成，返回给客户端的也是它。内部再加 8 位随机后缀，是为了两个客户端碰巧用了同一个 ID 时，引擎里也不会撞在一起。请求要一次生成 n 个回答（n 大于 1）时，这里拆成 n 条子请求，各有各的内部 ID，分别发给引擎，但共用同一个输出槽。

**⑥ 登记回程接收点。** 前端有一个 OutputProcessor 对象，管所有在途请求的回程。登记就是在它那里按请求 ID 存一份记录，里面有三样东西：一个反分词器，按增量把编号还原成文字（为什么要按增量，见 [生成的编号怎样变回文字](token.md#生成的编号怎样变回文字)）；一个整理对数概率（logprobs，每个 token 被选中的概率取对数）的处理器，请求要了才有活干；以及一个输出槽，处理好的结果放进去，等这条 HTTP 连接来取。

输出槽只有一个位置，不是排成一列的队伍：前端的一个后台任务从引擎收结果、反分词后往里放，流式请求的上一段还没被取走时，新的一段就和它并成一段（槽里的「你」还没被取走、又来了「好」，连接取到的就是「你好」）。什么时候会并、对客户端看到的分段有什么影响，见 [前端跟不上时：几步的文字并成一段](streaming-output.md#前端跟不上时几步的文字并成一段)。

登记一定在发送之前。后台任务分拣时遇到不认识的请求 ID 会直接丢掉，先登记才能保证引擎最早交回的那一批也有处可落。反过来，客户端中途断开连接时，前端会给引擎发一条中止消息，引擎把这条请求从队列里删掉、释放它占的块，前端的记录也随之删掉。前端怎样察觉客户端走了、已经在算的那一步结果怎样处理，见[请求收尾](request-teardown.md#前端先发现停止字符串和客户端断开)。

**⑦ 选 DP 组并发送。** 发送前，前端在请求上盖两个印：当前这一轮的 wave 号（各组同步开工、停工用的轮次编号）和本前端的编号。然后选组：请求头指定了组号就直接用，没指定就按各组的忙闲打分取最闲的一组，规则和计数从哪来见 [DP 请求路由](dp-request-routing.md#一条新请求进来派给哪一个-dp-组)。选定后经 ZMQ 发到那一组 EngineCore 的输入口。如果此刻所有组都停着（没有请求时各组会一起停下），前端还要另给 DP 协调器发一条消息，把各组叫醒。

**到了引擎那边。** EngineCore 进程里有一个专管收消息的输入线程。它解出请求后，当场把它建成调度器用的 Request 对象，这一步和引擎正在做的这一圈计算同时进行；建好后放进一个进程内的输入队列。引擎这一圈做完，下一圈开头先把输入队列里的新请求取出来，交给调度器放进 waiting 队列，等着被调度。所以请求进了引擎并不等于马上开算，引擎一圈怎么转见 [EngineCore 一圈按什么顺序走](vllm-engine-core.md#一圈按什么顺序走一条示意请求转两圈)。到这里，这条请求有了两份记录：前端的输出槽和反分词器，引擎里的 Request。

## 流式和非流式：200 什么时候发出，错误从哪里回来？

**两种请求走同一条路，差别在 HTTP 状态码什么时候定下来：非流式等整条请求生成完才回响应，中途任何错误都还能改成错误响应；流式在请求交给 AsyncLLM 之前就已经回了 200，从那以后的错误只能写进流里。**

关键在于第 ④ 步之后，前端只是建好了一个「生成器」：它描述了怎样把请求交给 AsyncLLM、怎样一段段取回结果，但还没开始执行，真正执行要等有人来逐段取。

- **非流式**：前端当场逐段去取，取到最后一段才拼成完整的回答，一次性回一个 JSON。⑤ 里任何一项校验不过，抛出的错误被统一的错误处理接住，按错误类型回 400 等状态码。
- **流式**：前端把生成器原样交给网页框架，框架先回 200 和流式响应头，再一段段往外推。推的格式叫 SSE（server-sent events，服务器沿着一条一直开着的 HTTP 连接，一行行推送以「data:」开头的消息）。这时 ⑤ 才开始执行，校验不过也改不了已经发出的 200，只能推一条内容是错误信息的「data:」消息，再推结束标记。

所以客户端收到 200，只说明前四步过了，不说明请求已经进了引擎。下图是整条路的先后和出错出口：

```wiki-diagram
file: api-server-entry-flow
```

各项检查落在哪一步、出错时客户端看到什么：

| 查什么 | 在哪一步 | 客户端看到 |
|---|---|---|
| JSON 字段和类型 | 收到请求时 | 400 |
| 模型名不是服务对外的名字 | ① | 404 |
| 请求自带模板但服务没声明信任；要自动选工具但没开工具解析 | ① | 400 |
| 消息不合模板的要求，模板渲染时报错 | ② | 400 |
| 提示词加输出数超过总长度上限；采样参数取值不合法 | ③ ④ | 400 |
| 编号超出词表、组号越界、提示词为空 | ⑤ | 非流式 400；流式先 200，流里一条错误消息 |
| 提示词顶满上限、一个输出位置都不剩 | 通常在 ③ ④ 就拦下；⑤ 只是兜底 | 400 |
| 引擎已停止 | ① 或 ⑤ | 500（流式已发 200 时写进流里），前端随后退出 |

前四步的错误不管流式与否都是一个普通的错误 JSON；只有 ⑤ 之后的错误，流式和非流式看到的不一样。

## 几种变体：不套模板的接口、一次要多个回答、开多个前端

**入口这条路有三种常见的走法变化：老式补全接口不套聊天模板，一次要 n 个回答会拆成 n 条子请求，前端开成多个进程可以分摊 CPU。后面的打包、登记、选组、发送都不变。**

**老式补全接口（/v1/completions）。** 它收的不是消息列表，而是一段现成的提示词文本，也可以直接给一串编号。所以没有第 ② 步：文本直接分词，而且默认让分词器补上自己的起始标记，因为没有模板替它写。请求不写输出上限时，这个接口默认只生成 16 个 token，而聊天接口是「总长度上限减输入长度」。这个接口不认聊天接口的新字段 max_completion_tokens：请求里多出的字段只在日志里记一条「被忽略」的警告，输出上限照样按默认的 16 算，GLM 教程里的验证请求就是这种情况（见 GLM 一节）。直接给编号时连第 ③ 步也跳过，入口能拦住错误编号的只剩第 ⑤ 步的词表上界检查。

**一次要 n 个回答。** 第 ⑤ 步拆成 n 条子请求，每条只要 1 个回答；请求给了随机种子时，各条的种子错开，免得 n 个回答一模一样。子请求各自经过第 ⑦ 步选组、发送，可能落到不同的 DP 组；回程都放进同一个输出槽，由前端按序号拼回一个响应里的 n 个答案。

**开多个前端。** 启动参数 api-server-count 大于 1 时，会起多个 API server 进程（开了 DP 而没写这个参数时，由本前端统一给各组派活的部署方式，即 internal LB，默认就按 DP 组数起），共用同一个监听端口，新连接由操作系统分给其中一个。每个前端各有自己的分词线程和自己的在途请求记录，套模板、分词、反分词的 CPU 开销被分摊开；但每个前端各自给 DP 组打分：协调器推来的各组计数是全局的，两次推送之间各前端却只知道自己刚派出了什么，所以本地记账要按前端个数来补，见 [DP 请求路由](dp-request-routing.md)。

## 放到 GLM 双机：node0 上一个前端接下全部请求

**主线把 GLM-5.3-Flash 部署在两台昇腾服务器上，每台 8 张 NPU 卡，两台各是一个 DP 组（部署条件见 [部署前提](glm-5-3-flash-two-node.md#部署前提)）。入口只在 node0 上：一个 API server 接下两台机器的全部请求，上面七步都在 node0 的 CPU 上做；vllm-ascend 没有改这一段。** 本页对应主线的 [第 1 站 入口](one-request.md#第-1-站-入口从-http-到-node0-的引擎)。

**谁在接请求。** node0 的启动命令把前端个数设成 1，于是执行 vllm serve 的那个进程自己就是 API server，监听 8000 端口；node1 以无前端（headless）方式启动，只起本机那一组的 EngineCore，见 [双机部署里一共有哪些进程](engine-processes.md#双机部署里一共有哪些进程)。教程没有改套模板和分词用的线程数，所以两组所有请求的套模板和分词，都排在 node0 这个进程的 1 个工作线程上；反分词也在这个进程里做。

**请求怎么写。** 启动命令给模型起的对外名字是 glm，请求里的模型名要么写 glm，要么不写，写成模型目录名会被第 ① 步以 404 拒掉。启动命令没有另给聊天模板，聊天接口用的是模型目录自带的那一份：一条消息套完会多出 6 个特殊标记和一行系统说明，详见 [token 页的 GLM 一节](token.md#r1-在入口拿到了什么)。教程里验证服务的示例请求走的是老式补全接口，所以不套聊天模板；它写的是 max_completion_tokens 为 50，但补全接口没有这个字段，按上一节的规则被忽略，实际最多只生成 16 个 token。想要 50 个，补全接口要写 max_tokens，或者改走聊天接口。请求不写采样参数时，用的是模型生成配置里的默认值，见 [请求不写采样参数时用的是什么](sampling.md#请求不写采样参数时用的是什么)。

**长度上限。** 启动命令把总长度上限设为 133120。主线的示例请求 R1 约定套完模板、分词后是 4 个编号（演示设定，见 [示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)），输出上限沿用主线 [第 7 站](one-request.md#第-7-站-返回与收尾) 的设定，max_tokens 为 200。按第 ③ ④ 步的规则：

```calc
title: R1 进门时的长度账（max_tokens 取第 7 站设定的 200）
允许的输入 = 133120 − 200 = 132920 个
R1 的提示词 = 4 个编号，在允许范围内
输出上限 = min(133120 − 4, 200) = 200 个
> 请求要是不写 max_tokens，输出上限就是 133120 − 4 = 133116 个
```

**工具调用要另开。** 主线的启动命令没有指定工具调用解析器，也没有指定把思考过程单独拆出来的推理解析器。所以把 tool_choice 设为 auto 的请求，会在第 ① 步被拒。教程的常见问题里给了要补的三个启动参数：工具调用解析器 glm47、推理解析器 glm45，再打开自动工具选择。教程还写明这个模型不支持关闭思考的开关（enable_thinking）。

**R1 怎样离开入口。** 前端登记好 R1 的反分词器和输出槽后选组：R1 到达时两组都空着，得分相同，落到 DP0，也就是同在 node0 上的那个 EngineCore，打分过程见 [DP 请求路由的 GLM 一节](dp-request-routing.md#放到-glm-双机node0-上一个前端给两台机器派活)。两组引擎分在两台机器上，所以前端和引擎之间的 ZMQ 用的是 node0 上的 TCP 端口，见 [进程之间的四条通道](request-call-chain.md#进程之间的四条通道)。到这一步，node1 的引擎还不知道 R1 存在。

**vllm-ascend 没有碰入口。** 在钉住的版本里，vllm-ascend 对聊天接口打的补丁只改输出那一侧：修正 GLM 流式返回工具调用时最后几段的拆法，属于 [流式输出](streaming-output.md) 的范围。套模板、分词、建请求、登记和选组，走的都是 vLLM 原样的代码。

## 常见误解

- **「API server 把请求交给引擎，就没它的事了。」** 它在发送之前就登记了反分词器和输出槽，此后每一步的结果都回到这里还原成文字，请求结束才删记录。在途请求越多，前端占的 CPU 和内存越多，见 [每个进程里存着什么](engine-processes.md#每个进程里存着什么)。
- **「流式请求收到 200，说明引擎已经接下了它。」** 200 在请求交给 AsyncLLM 之前就发出了；编号越界、组号越界这类错误之后才查，只能作为流里的一条错误消息出现。
- **「采样在入口做。」** 入口只把 temperature、top-p 这些设置定成参数并校验；按参数选出 token 是第 5 站 worker 上的事，见 [采样](sampling.md)。
- **「提示词长度按用户打的字数算。」** 按套完模板、分词后的整串编号算，模板加进来的特殊标记和系统说明都算；长度上限检查用的也是这个数。
- **「聊天接口里让分词器再补一遍特殊标记更保险。」** 模板已经写好了起始标记，再补一遍开头就重复了，长度和模型看到的格式都会变；只有不套模板的补全接口才默认补。
- **「请求一进引擎就开算。」** 引擎的输入线程先把它建好放进输入队列，等这一圈计算做完、下一圈开头才进 waiting，什么时候算由调度器决定，见 [vLLM scheduler](vllm-scheduler.md)。
- **「请求头里的 X-Request-Id 就是引擎里的请求 ID。」** 返回给客户端的是「chatcmpl-」加上它，引擎和日志里用的是再加 8 位随机字符的内部 ID；拿返回给客户端的 ID 去搜即可，日志里的内部 ID 以它开头。

## 对照源码

### 怎么开

入口没有开关，执行 vllm serve 就会起。和本页相关的设置如下，GLM 主线的取值见括号：

- `--host`、`--port`：前端监听的地址和端口（0.0.0.0、8000）。
- `--served-model-name`：对外的模型名，请求里的 model 要和它一致或不写（glm）。
- `--api-server-count`：前端进程个数；不写时按部署方式取默认，DP 由本前端统一派活（internal LB）时取 DP 组数，external LB 等取 1；等于 1 时由 vllm serve 进程自己当前端，`--headless` 的机器不起前端（node0 为 1，node1 headless）。
- `--max-model-len`：总长度上限，入口按它查长度、补输出上限（133120）。
- `--chat-template`：换掉模型自带的模板（未设）；`--trust-request-chat-template`：允许请求自带模板（未设）。
- `--enable-auto-tool-choice`、`--tool-call-parser`、`--reasoning-parser`：工具调用与推理解析（未设；教程常见问题给的是 glm47、glm45）。
- `--renderer-num-workers`：套模板和分词的线程数，默认 1（未设）。
- `--generation-config`：采样默认值从哪来，见 [采样](sampling.md)（未设，取模型目录的生成配置）。
- 请求头：`X-Request-Id` 指定对外请求 ID；`X-data-parallel-rank` 指定 DP 组号，不是整数时当作没写。
- 环境变量：`VLLM_SKIP_MODEL_NAME_VALIDATION` 跳过模型名检查；`VLLM_DISABLE_REQUEST_ID_RANDOMIZATION` 不加随机后缀（已标记将移除）；`VLLM_KEEP_ALIVE_ON_ENGINE_DEATH` 引擎停止后前端不退出。

### 会报什么错

- ``The model `xxx` does not exist.``：模型名和对外名字不一致，404。
- `Chat template is passed with request, but --trust-request-chat-template is not set. Refused request with untrusted chat template.`：请求自带模板。
- `"auto" tool choice requires --enable-auto-tool-choice and --tool-call-parser to be set`：要自动选工具但服务没开。
- `This model's maximum context length is … tokens. However, you requested … output tokens and your prompt contains at least … input tokens …`：分词时发现输入加输出超过上限。
- `Input length (…) exceeds model's maximum context length (…).`：推算输出上限时发现输入本身就超了。
- `max_tokens must be at least 1, got 0.`：没写输出数、输入正好顶满上限时，聊天接口在定采样参数这一步报。
- `The decoder prompt (length …) plus the number of requested output tokens (at least 1) is longer than the maximum model length of …`：输入正好顶满上限的兜底检查。
- `The decoder prompt cannot be empty`、`Token id … is out of vocabulary`、`data_parallel_rank … is out of range [0, …).`：打包前的再校验，流式请求里以流中的错误消息出现。
- 引擎停止时报 EngineDeadError，前端回 500 后退出。

### 开销和什么时候别开

入口不能关，能调的是它占多少 CPU。症状是 NPU 不忙、首 token 时延却随并发上涨，而前端进程的 CPU 打满：可以加 `--renderer-num-workers` 让套模板和分词多几个线程，或者加 `--api-server-count` 多起几个前端；后者会改变 DP 打分里的前端个数。不要为了「ID 好查」打开 `VLLM_DISABLE_REQUEST_ID_RANDOMIZATION`：两个客户端用了同一个 ID 时，引擎里会撞在一起出错。不要在聊天接口里把 `add_special_tokens` 打开，理由见常见误解。

### 版本差异

| | v0.23 | v0.26 | main |
|---|---|---|---|
| 配套的上游 vLLM | 0fc695fc（v0.23.0）；GLM 镜像 db701c1f 用同一版 | 568afb3a（v0.26.0） | 98dff2a8（v0.29.0） |
| 套模板与分词的代码 | `entrypoints/serve/render/serving.py` | 移到 `renderers/online_renderer.py`，流程不变 | 同 v0.26 |
| 分词怎样排队 | 微批：首条到达后等 2 ms，最多攒 32 条一起切；共用 1 个线程 | 每条单独交给线程池，不再攒批；线程数默认 1 | 同 v0.26；多模态预处理另用 1 个线程 |
| 请求 ID 加 8 位随机后缀 | 有 | 同 v0.23 | 同 v0.23 |
| 先登记输出槽再发送；单槽合并 | 有 | 同 v0.23 | 同 v0.23 |
| 不写输出数时的上限 | 总长度上限 − 输入长度，再与生成配置、覆盖值取小 | 同 v0.23 | 同 v0.23 |
| 选组打分 | 见 [DP 请求路由的版本差异](dp-request-routing.md#版本差异) | 同左 | 同左 |
| vllm-ascend 是否改入口 | 否：2c59ff10 与 db701c1f 的聊天接口补丁都在输出侧（GLM 工具调用流式分段、空 tool_calls 字段） | 否：GLM 相关补丁是输出侧的思考 token 计数；另一个改 renderer 的补丁只给 Kimi 模型用 | 否：钉点里已没有聊天接口的补丁文件 |

### 源码位置

| 做什么 | 位置（vllm@0fc695fc） |
|---|---|
| 路由与三种返回（错误、整段 JSON、SSE 流） | `vllm/entrypoints/openai/chat_completion/api_router.py#L40-L75` |
| 查模型名、引擎状态，定输出上限与采样参数，建生成器 | `vllm/entrypoints/openai/chat_completion/serving.py#L192-L392` |
| 流式出错写进流里；非流式取结果 | `chat_completion/serving.py#L497-L937`、`#L938-L964` |
| 模型名检查；X-Request-Id 与组号请求头 | `vllm/entrypoints/openai/engine/serving.py#L211-L238`、`#L387-L412` |
| 工具选项与模板来源检查，套模板、分词 | `vllm/entrypoints/serve/render/serving.py#L183-L266`、`#L452-L471`、`#L521-L568` |
| 线程池与微批分词；聊天默认不补特殊标记 | `vllm/renderers/base.py#L84-L155`、`#L338-L360`、`vllm/utils/async_utils.py#L24-L50`、`chat_completion/protocol.py#L290-L296` |
| 长度检查（只切到上限 +1） | `vllm/renderers/params.py#L186-L192`、`#L415-L435` |
| 输出上限推算 | `vllm/entrypoints/serve/utils/api_utils.py#L170-L206` |
| 再校验、补参数、建 EngineCoreRequest、加随机后缀 | `vllm/v1/engine/input_processor.py#L223-L385`、`#L387-L484` |
| 拆 n 条子请求、先登记后发送 | `vllm/v1/engine/async_llm.py#L280-L414`、`vllm/v1/engine/parallel_sampling.py#L52-L94` |
| 生成器、断开即中止；后台分拣任务 | `async_llm.py#L524-L600`、`#L637-L690` |
| 输出槽与登记；不认识的 ID 丢掉 | `vllm/v1/engine/output_processor.py#L45-L92`、`#L512-L541`、`#L600-L612` |
| 选组后发送，必要时叫醒协调器 | `vllm/v1/engine/core_client.py#L1344-L1360` |
| 引擎输入线程建 Request；进 waiting | `vllm/v1/engine/core.py#L1518-L1543`、`#L819-L841`、`#L341-L377`、`vllm/v1/core/sched/scheduler.py#L1801-L1823` |
| 错误类型到状态码；引擎停止后退出 | `vllm/entrypoints/serve/utils/error_response.py#L16-L50`、`serve/utils/server_utils.py#L327-L445`、`vllm/entrypoints/launcher.py#L168-L178` |
| GLM 启动命令与常见问题 | `vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L262-L292`、`#L416-L430` |

待核：本页没有前端 CPU 耗时的实测数，「前端先于 NPU 成为瓶颈」的并发点要用 GLM 双机压测才能定；GLM 模板的系统说明行有几个 token 仍按 [token 页](token.md#r1-在入口拿到了什么) 的待核口径。
