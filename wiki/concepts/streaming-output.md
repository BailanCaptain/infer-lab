---
id: streaming-output
title: "流式输出：token 编号怎样变成一段段推给客户端的文字"
type: concept
summary: 流式输出让客户端边生成边看到文字：引擎每步交回新的 token 编号，前端的增量反分词把它们接上已有字节、还原出新增文字，查过停止字符串后包成一个 SSE 片段推出。先分清 token 与文本增量，再沿 GLM 双机看一步 1–4 个 token 怎样变成片段、在哪里判停和收尾。
aliases:
  - 流式输出
  - 流式返回
  - 流式响应
  - streaming
  - streaming output
  - stream
  - SSE
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
  - "[DONE]"
chapters: ["09"]
order: 70
sources:
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1695-L1711
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1543-L1562
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L637-L695
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L574-L596
  - vllm@0fc695fc:vllm/v1/engine/output_processor.py#L45-L100
  - vllm@0fc695fc:vllm/v1/engine/output_processor.py#L272-L318
  - vllm@0fc695fc:vllm/v1/engine/output_processor.py#L376-L412
  - vllm@0fc695fc:vllm/v1/engine/output_processor.py#L576-L690
  - vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L18-L66
  - vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L68-L166
  - vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L167-L249
  - vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L309-L344
  - vllm@0fc695fc:vllm/config/scheduler.py#L151-L155
  - vllm@0fc695fc:vllm/envs.py#L1278-L1280
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L634-L640
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L503-L530
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L641-L770
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py#L800-L936
  - vllm@0fc695fc:vllm/entrypoints/openai/engine/protocol.py#L236-L240
  - vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/api_router.py#L74-L74
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/tokenizer.json
  - https://huggingface.co/zai-org/GLM-5.3-Flash/blob/690b705278a3a58e538fcb37c2ca8b5f9511213c/tokenizer_config.json
  - vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md#L417-L425
  - vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm_tool_call_streaming.py#L76-L145
  - vllm-ascend@db701c1f:vllm_ascend/patch/__init__.py#L166-L180
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/__init__.py#L200-L216
  - vllm@568afb3a:vllm/v1/engine/detokenizer.py#L58-L62
  - vllm@84030bbe:vllm/v1/engine/detokenizer.py#L310-L362
  - vllm@84030bbe:vllm/v1/engine/output_processor.py#L234-L236
  - vllm@84030bbe:vllm/sampling_params.py#L320-L323
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: one-request, kind: builds-on, note: 第 7 站的停止分支和 R1 结束时归还 16–17 个块号的账在那一页；本页展开前端怎样把编号变成 SSE 片段}
  - {to: token, kind: builds-on, note: 字节级 BPE 和「推理」「犇」两个例子在那一页；本页讲增量反分词怎样一步步还原并推送}
  - {to: sampling, kind: builds-on, note: 结束 token、停止 token 和长度上限在引擎侧判断，见那一页；本页只讲前端的停止字符串}
  - {to: request-call-chain, kind: builds-on, note: API server、EngineCore 两种进程和它们之间的 ZMQ 通道在那一页}
  - {to: speculative-decoding, kind: builds-on, note: MTP 让一步交回 1–4 个 token，一个片段因此可能带出几个 token 的文字}
  - {to: api-server-entry, kind: builds-on, note: 请求进门时分词、登记反分词器和收集器在那一页；本页接着讲结果回程怎样变成片段}
  - {to: async-scheduling, kind: builds-on, note: 本部署异步调度开着，引擎这一步的结果在下一步开跑后才回收、发往前端}
contradicts: []
updated: "2026-10-02"
origin: direct
---

## 流式输出是什么：模型一个个吐出编号，用户怎样一段段看到文字？

**流式输出（streaming output）是边生成边返回：引擎每算完一步，服务就把这一步新生成的 token 编号还原成新增的文字，立刻作为一小段推给客户端，不等整段回答写完再一次交回。** 这里有两样东西要分清：模型产出的是 **token 编号**（整数，一个编号代表词表里的一项，见 [token](token.md)）；客户端收到的是 **文本增量**，也就是这一段比上一段多出来的那几个字。两者之间隔着两道工序：把编号还原成文字的**增量反分词**，和检查要不要停下来的**判停**。

推送用的格式叫 **SSE**（server-sent events，服务器推送事件）。普通的 HTTP 响应一次写完；SSE 的响应不关连接，服务器每有一段新内容，就往同一个连接里写一行以「data:」开头的文字，再空一行，客户端读到一段就显示一段。每一段里是一小块 JSON，放着这次新增的文字；最后一段写明结束原因，随后再发一行 [DONE]，表示这条流结束了。

举一个缩到最小的例子。一条请求接下来会生成「推理」，再生成一个少见的字「犇」，然后结束。这两个字沿用 [token 页的例子](token.md#生成的编号怎样变回文字)：「推理」整块是一个 token；「犇」在 UTF-8 里是 E7 8A 87 三个字节，按那一页的示意，分词时被切成两个 token，前一个只有 E7 8A，后一个是 87。

```wiki-diagram
file: streaming-output-intuition
```

图里一列是一步。第 1 步，引擎交回编号 9123，反分词查回 6 个字节，正好是两个完整的汉字，于是推出「推理」。第 2 步交回的编号只带来半个字的字节，凑不成字，反分词先把它攒着，这一步推出去的片段里没有新文字。第 3 步的字节和攒着的 E7 8A 凑齐，「犇」才出现。第 4 步抽到结束 token：它是控制用的特殊编号，不还原成文字；判停在这一步成立，最后一个片段只写结束原因，随后流结束。

所以「一步」「一个 token」「一个字」「一个片段」之间没有固定的一一对应：这里生成了 3 个普通 token 加 1 个结束 token，屏幕上的文字只变了 2 次，客户端收到了 4 个片段和 1 行 [DONE]（开头其实还有一个只声明「这是助手在说话」的片段，下面拼 SSE 时再讲）。后面还会看到：一步有时交回好几个 token，一个片段有时装下好几步的文字。三样东西对照如下：

| 东西 | 在哪里产生 | 图里的例子 |
| --- | --- | --- |
| token 编号 | 引擎每步交回，有时一步好几个 | 9123、a、b、结束 token |
| 文本增量 | 前端反分词后，这一次比上一次多出的文字，也会是空的 | 「推理」、空、「犇」 |
| SSE 片段 | HTTP 连接上的一行 data，里面是一块 JSON | 4 个片段，外加 [DONE] |

## 为什么要流式：先看到第一段，比等整段更早

**不流式时，客户端要等最后一个 token 生成完才拿到第一个字；流式时，第一步算完就能看到开头。总的生成时间不变，变的是等第一段文字的时间。**

大模型一次只往后写一步，每步要把整个模型跑一遍。一段几百个 token 的回答，从第一个 token 到最后一个之间隔着几百次前向。如果服务等全部写完再一次返回，用户在这段时间里看到的是一片空白；流式把这段等待拆开，第一步的结果一出来就送到屏幕上，之后一段段往后接。衡量这件事常用两个时间：**TTFT**（time to first token，从发出请求到收到第一个 token 的时间）和 **token 间隔**（相邻两次收到新 token 之间的时间）。第一个 token 要等 **prefill** 做完：prefill 是把整段提示词一次送进模型算一遍，顺带得出第一个 token（见 [prefill](prefill.md)）；之后每一步只往后写。用一组示意数看差别有多大：

```calc
title: 一段 200 个 token 的回答，多久看到第一个字（示意数）
第 1 个 token（prefill 一步） = 200 ms
之后每个 token = 30 ms
不流式时整段写完才返回 = 200 ms + 199 × 30 ms = 6,170 ms
流式时第一段到达 = 200 ms，之后约每 30 ms 再推一段
```

两种方式的最后一个字都在 6,170 ms 左右到达，流式只是把前面的字提前交出去，生成本身没有变快。

流式也有代价，都落在前端把编号变成文字、再写进连接的那一侧，后文逐个展开：

- **每步每条请求多打一次包。** 反分词和查停止字符串流不流式都要做；流式另外要每步造一份结果、拼一个 JSON 片段、写一次连接，都占前端进程的 CPU。并发越高、每步越短，这部分越显眼，可以用「攒够几个 token 再推」来换。
- **设了停止字符串要扣字。** 结尾几个字要等确认不是停止字符串的开头才推。
- **出错只能写在流里。** 第一段推出时 HTTP 状态码已定成「成功」，之后出错只能往流里写一个错误片段。
- **断开要通知引擎。** 不然引擎会继续白算，还占着显存块。

## 怎么做：一步交回的编号要走过哪几道工序？

**一步的结果先在引擎进程里追加、判停，再经 ZMQ 送到前端进程；前端的后台任务替所有请求反分词、查停止字符串、算出文本增量，每条请求自己的 HTTP 任务再把增量拼成片段写进连接。**

vLLM 服务里有两种进程和这件事有关（见[调用链](request-call-chain.md#七站分在三种进程里)）：接 HTTP 请求的前端进程叫 API server，负责每一步调度的引擎进程叫 EngineCore。分词和反分词都在前端做，引擎只认编号，两边用 ZMQ（一个在进程之间收发消息的库）传结果。请求进门时怎样分词、怎样为回程登记反分词器和收集器，见 [API server 入口](api-server-entry.md)；本页从结果回程讲起。下图按先后画出一步的结果怎样从引擎走到客户端。

```wiki-diagram
file: streaming-output-flow
```

下面按图从上往下走一遍。

### 引擎侧：逐个追加、判停，有东西才发

引擎每步拿到每条请求这一步确定下来的 token。一般一步一个；开了 **MTP**（multi-token prediction：模型顺带草拟后面几个 token，下一步和确定的 token 一起送进模型验证，猜对几个就多出几个，见[投机解码](speculative-decoding.md)）时，一步会交回好几个。引擎把它们**逐个**追加到请求上，每追加一个就检查一次：是不是结束 token、是不是请求指定的停止 token、输出数是不是到了上限（规则见 [sampling](sampling.md#什么时候停下来)）。命中了，这一步后面的 token 直接丢掉，不发给前端。

只有这一步真的有新 token，或者请求刚刚结束，引擎才为这条请求打一份结果。长提示词分几步做 prefill 时，前几步还没有输出 token，前端也就收不到任何东西。一步里所有请求的结果装成一批，经 ZMQ 一次发到前端。

### 增量反分词：只解新来的编号，凑不齐就等

**反分词器为每条请求单独保留一份状态：已经出现的字节、已经还原的文字。新编号来了，只把它接在后面解；解出完整的字就交出去，只解出半个字就先留着。**

为什么不能每个编号各自解？字节级分词器（见 [token](token.md#字节级-bpe-怎样一步步切出-token)）的一个编号有时只是半个字的字节，单独解出来是乱码，和后面的编号放在一起才是完整的字。另一种办法是每步把全部输出从头解一遍，再和上一次比出新增的部分：结果对，但输出越长，每步重复的活越多。增量反分词只处理新来的编号，每步的工作量和已经写了多长无关。

vLLM 有两种实现。分词器是 Hugging Face tokenizers 库的快速分词器、并且这个库的版本不低于 0.22 时，用库里自带的解码流：开流时先把提示词的编号喂进去，之后每来一个编号走一步，字节凑成完整的字才返回文字，否则返回空。其他分词器走纯 Python 的慢速实现，思路相同：记住已经解到哪里，每次只解最后几个编号，结尾是不完整的字就先不交。

这一步还顺带处理两件小事。一是请求因为结束 token 或停止 token 而结束时，默认不把那个编号送去还原，它不会变成文字。二是特殊 token（模板和控制用的编号）显不显示，由请求的 skip_special_tokens 设置决定，默认不显示；词表里没有标成特殊的标记，照常还原成文字。

### 停止字符串：先扣住结尾几个字

**请求设了停止字符串，前端要在还原出的文字里找它。它不一定在同一步里出齐，所以每次推送都扣住结尾「最长停止字符串的长度 − 1」个字，确认安全了再推；命中后，文字截到停止字符串之前，结束原因记为 stop。**

停止字符串（请求参数 stop）的意思是「输出里出现这段文字就停」。它和停止 token 不同，按文字比对，只能在反分词之后做，所以放在前端（停止判断怎样分在两处，见[第 7 站](one-request.md#第-7-站-返回与收尾)）。每次只在新增的文字和它前面紧挨的一小段里找，不重扫整段输出。

为什么要扣字？设停止字符串是 ###。某一步的新文字以一个 # 结尾，前端还不知道下一步会不会再来两个 #：如果马上把这个 # 推出去，等后面凑成 ### 时它已经显示在用户屏幕上，撤不回来。所以只要设了停止字符串，每次都少推结尾 3 − 1 = 2 个字；请求结束时不再扣，剩下的字一次推完。用示意数走一遍：

```calc
title: 停止字符串是 ### 时，每步推出哪几个字（示意数）
每次扣住 = 3 − 1 = 2 个字
第 1 步后可推（已有「答案」） = 2 − 2 = 0 个字，什么都不推
第 2 步后可推（已有「答案是42」） = 5 − 2 = 3 个字，推出「答案是」
第 3 步后可推（已有「答案是42#」） = 6 − 2 = 4 个字，再推出「4」
第 4 步后可推（截掉 ### 剩「答案是42」，已结束不扣） = 5 − 0 = 5 个字，再推出「2」
```

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
- **用量是可选的。** 请求在 stream_options 里打开 include_usage，[DONE] 之前多一个用量片段，choices 为空，写着提示词和输出各多少个 token；打开 continuous_usage_stats，每个片段都带一份到此为止的用量。
- **中途出错也走流。** 生成过程中出了异常，流里写一个错误片段，随后照样发 [DONE]。

### 前端跟不上时：几步的文字并成一段

**后台输出任务和 HTTP 任务之间，每条请求只有一个收集器格子。HTTP 任务还没取走上一份，新的一份就并进去，这时一个片段装着好几步的文字；文字不会丢，也不会乱序。**

两类任务在同一个进程里轮流跑（Python 的 asyncio：同一时刻只有一个任务在执行，一个任务等待时把 CPU 让给别的任务）。后台任务处理一批结果时，每处理一片（默认 128 条请求）就让出一次，好让 HTTP 任务把已经算好的增量写出去。负载重的时候，HTTP 任务来不及每步都取，收集器就把几次增量的文字和编号接在一起，下次一并发出。所以客户端收到的片段数会少于步数，这是正常现象。

还有一种是有意的合并：启动参数 --stream-interval，默认 1。设成 N 时，除了第一份和最后一份，每攒够 N 个新 token 才交出一次，片段变少，前端的 CPU 开销也降下来，代价是文字一顿一顿地出。

## 思考段、工具调用和断开连接：流里还会出现什么？

**配了解析器时，同一段新文字会被分进不同的字段；客户端断开时，前端通知引擎终止请求。这些都不改前面的流程，只改片段里装什么、流什么时候结束。**

- **思考段。** 有的模型先写思考过程，再写答案。服务配了 reasoning parser（按思考标记把输出切成思考段和答案段的解析器）时，片段里思考的文字放进 reasoning 字段，答案放进 content；没配时都在 content 里，思考标记本身如果不是特殊 token，也作为文字出现在流里。
- **工具调用。** 服务配了 tool-call parser、请求带了工具定义时，模型写出的调用被解析成 tool_calls 字段，函数名和参数一段段推出。解析器还没认出完整结构的那几步，可以一个片段都不发；这种调用结束时，最后一个片段的结束原因是 tool_calls。
- **一次要几个回答。** 请求的 n 大于 1 时，每个回答有自己的序号（index），片段按序号区分，各自有自己的结束片段。
- **带 logprobs。** 请求要了每个 token 的概率时，每个片段只带这次新增那几个 token 的那几份。
- **客户端断开。** 这条请求的 HTTP 任务被取消，前端通知引擎终止，和停止字符串命中走同一条线（流程图右下）。

## 落到 GLM 双机：R1 的编号怎样变成片段

**R1 是提示词为 4 个 token 的示例请求（设定见[一条请求](one-request.md#示例请求-r1-与官方双机部署)），这里假定它按流式发出。它分到 DP0：node0 的 EngineCore_DP0 每圈把它的结果经 ZMQ 发给 node0 上唯一的 API server，反分词和推送都在那个进程里做。有 MTP 时一圈交回 1–4 个 token，HTTP 任务及时取走时，一个片段就带出 1–4 个 token 的文字。**

### 一个前端进程，接两个 DP 组的结果

本页沿用[部署前提](glm-5-3-flash-two-node.md#部署前提)。官方启动只开 1 个 API server，所以两台机器上两个 DP 组的结果都送到 node0 这一个进程，所有请求的反分词、查停止字符串、拼片段都挤在它的 CPU 上。每个 DP 组每步最多跑 32 条请求，一批结果最多 32 条，小于每片 128 条，一批不会再被切开处理。官方命令没有写 --stream-interval，取默认 1：每圈每条有新 token 的请求都交出一份结果。

这套配置按默认打开了[异步调度](async-scheduling.md)：引擎先把下一圈排好、发给 NPU，再处理上一圈的结果、发往前端。推送仍是每圈一次，只是每一圈的结果在下一圈开跑之后才离开引擎。

### R1 前三圈：每个片段由几个 token 还原

前端只收到引擎确定下来的 token。MTP 的候选在引擎里验完，被拒的那些从来不离开引擎，前端看不到「先显示、再撤回」的文字。沿用一条请求页[三步的账](one-request.md#三步的账)里的假设：

```calc
title: R1 前三圈交给前端的 token 数（接受几个是假设）
prefill 一圈 = 1 个 token，即 y₀
decode 1（3 个候选接受 1 个） = 1 + 1 = 2 个 token，即 y₁ y₂
decode 2（3 个候选全接受） = 3 + 1 = 4 个 token，即 y₃ 到 y₆
三圈合计 = 1 + 2 + 4 = 7 个 token
```

HTTP 任务每圈都及时取走的话，客户端在角色片段之后收到 3 个内容片段，分别由 1、2、4 个 token 还原而来。每个片段有几个字，要看这些编号代表哪些字节：常用词一个 token 就是两个字，少见的字要两个 token 才出一个字，不能按 token 数换算。接受几个是为了把账走通设的例子，不是实测的接受率。

### GLM 的分词器和思考标记

GLM 的分词器是字节级 BPE（见 [token](token.md#glm-的分词器是字节级-bpe)），配置里声明用 tokenizers 库做后端，属于快速分词器，所以走解码流那条实现，前提是镜像里 tokenizers 库不低于 0.22。

GLM 的聊天模板把 `<think>` 放在提示词末尾，模型从第一个输出 token 起就在写思考过程。它和收尾的 `</think>` 编号是 154841、154842，落在 token 页所说的 36 个特殊标记的编号段里，但分词器文件给它们的 special 标志是 false，所以默认设置去不掉它们。官方双机命令没有配 reasoning parser，所以思考文字、`</think>` 这个标记和后面的答案，全都按顺序出现在 content 里，客户端要自己按 `</think>` 切开。官方教程为函数调用给的配置加了 tool-call parser glm47 和 reasoning parser glm45；配上以后，思考文字改放进 reasoning 字段（解析器怎样判断思考结束，见[结构化输出](structured-output.md)）。

GLM 的三个结束编号 154820、154827、154829 都标成了特殊 token（各是什么，见 [token](token.md#编号要落在-154880-行之内)）。它们被抽中时引擎判正常结束，编号本身不还原成文字，结束原因记作 stop。

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
- **「GLM 的思考过程会自动放进 reasoning 字段。」** 只有服务配了 reasoning parser 才会这样分；官方双机命令没配，思考文字和 `</think>` 都在 content 里。

## 对照源码

### 怎么开

请求侧：

- `stream: true` 打开流式，结果按增量交出；不写或写 false 时，前端只在结束时交一份完整输出。
- `stream_options` 里的 `include_usage` 在 [DONE] 前加一个用量片段，`continuous_usage_stats` 让每个片段都带用量；两者默认都关。
- `stop` 设停止字符串；`include_stop_str_in_output` 默认 false，停止字符串不留在输出里、推送时扣字，设成 true 则保留停止字符串、不扣字；`skip_special_tokens` 默认 true。
- vLLM main 上请求还可以带 `stream_interval`，只能把服务端的间隔调大，不能调小。

服务侧：

- `--stream-interval N`：每攒够 N 个 token 交出一次，第一份和最后一份不受限，默认 1。
- 环境变量 `VLLM_V1_OUTPUT_PROC_CHUNK_SIZE`：后台输出任务每片处理多少条请求的结果，默认 128。
- `--reasoning-parser glm45`、`--tool-call-parser glm47`：官方教程为 GLM 函数调用给的配置，官方双机启动命令里没有。

### 会报什么错

- `Encountered invalid prefix detokenization error for request %s, resetting decode stream.`：快速分词器的解码流内部状态被罕见的非法 UTF-8 输出打乱，前端重建解码流后继续，是 warning。
- `Encountered invalid token id: %r`：解码流遇到无法处理的编号，记一条异常，这个编号按空文字处理，流不断。
- `Error in chat completion stream generator.`：拼片段时出了异常，流里写一个错误片段，随后照样发 [DONE]；客户端看到的 HTTP 状态码仍是成功。
- `Request %s failed with an internal error during generation`：引擎把请求的结束原因标成 error，前端记这条错误日志，流里写一个内容为内部错误（500）的片段。
- `Request %s aborted.`：客户端断开、HTTP 任务被取消，前端已通知引擎终止；只在打开请求日志时打印。

### 开销和什么时候别开

流式多出的活都在前端。增量反分词和查停止字符串不论流不流式每圈都做；流式另外要为每条有新 token 的请求每圈造一份结果、唤醒它的 HTTP 任务、拼一个 JSON 片段、写一次连接。本部署只有一个 API server 进程，两个 DP 组最多 64 条在跑的请求都由它处理。这部分开销本页没有实测数。

- 只要最终结果的离线批量任务、评测脚本，不需要流式，一次返回更省事。
- 并发高、前端 CPU 吃紧时，可以把 --stream-interval 调大，用更少的片段换更低的开销；第一个片段不受影响，首段到达时间不变。
- 停止字符串越长，扣住的字越多，结尾几个字就越晚出现；设了很长的停止字符串时，流的最后一段会明显「攒一下再出」。

### 版本差异

本页的控制流和前端代码在上游 vLLM，引的是 v0.23 的 `0fc695fc`；昇腾只在聊天接口上加补丁，引的是含 GLM 代码的 `db701c1f`。本部署实际装的是哪一对，按[来源基线](../sources/glm-5-3-flash-baseline.md)核对。

**上游 vLLM**（v0.23 = `vllm@0fc695fc`，v0.26 = `vllm@568afb3a`，main = `vllm@84030bbe`）：

| 项 | v0.23 | v0.26 | main | 意味着什么 |
| --- | --- | --- | --- | --- |
| 走快速反分词的判断 | 分词器是 `PreTrainedTokenizerFast` | 改成 `TokenizersBackend` | 同 v0.26 | 跟着 transformers 新版的类名改，判断条件的意思不变 |
| 几个停止字符串在同一次新文字里都出现 | 按请求里列出的先后，取第一个找到的 | 同 v0.23 | 取在文字里最先完成的那个 | 一圈交回几个 token 时，v0.23、v0.26 截出的文字可能和逐个 token 判的不同，main 改成一致 |
| 请求级 `stream_interval` | 没有 | 没有 | 有，低于服务端设置时按服务端 | 只有 main 能按请求调推送间隔 |
| 推理和工具解析的接法 | 流式路径用单独的推理解析器和工具解析器 | 只留一个组合解析器对象 | 同 v0.26 | 片段字段（reasoning、content、tool_calls）三版一样 |
| 片段格式：角色片段、增量、结束片段、用量片段、[DONE] | 有 | 同 v0.23 | 同 v0.23 | 客户端解析代码不用改 |
| 收集器合并、每片 128 条、`--stream-interval` 默认 1 | 有 | 同 v0.23 | 同 v0.23 | 推送节奏的默认行为一致 |

**vllm-ascend**（v0.23 = 维护分支 `2c59ff10`，不含 GLM 代码；`db701c1f` = 含 GLM 代码的快照；v0.26 = `2ed6cbba`；main = `baa023ad`）：

| 项 | v0.23 维护分支 | db701c1f | v0.26 | main |
| --- | --- | --- | --- | --- |
| GLM 工具调用末片段拆分补丁 | 有，无条件加载 | 有，同 v0.23 | 没有 | 没有 |
| GLM 推理 token 用量补丁 | 没有 | 没有 | 有，只绑到配了 GLM 解析器的服务 | 没有 |
| 其他碰聊天接口的补丁 | MiniMax 的用量统计，GLM 不经过 | 同 v0.23 | Kimi K3 的解析器，GLM 不经过 | 没有 |
| 反分词器、输出处理器 | 不改 | 不改 | 不改 | 不改 |

v0.26 的用量补丁针对的是：GLM 从提示词里的 `<think>` 就进入思考，输出里可能只出现 `</think>`，上游解析器按「从没进入思考」计数，聊天接口也还没有给出按解析器统计的推理 token 用量。补丁注明上游修好后删除。

### 源码位置

| 看什么 | 去哪里 |
| --- | --- |
| 引擎侧逐个追加、判停、截掉余下的 token | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py`，`_update_request_with_output` |
| 有新 token 或已结束才打结果 | 同文件 `update_from_output` 里构造 `EngineCoreOutput` 的条件 |
| 后台输出任务：取结果、分片、通知引擎终止 | `vllm@0fc695fc:vllm/v1/engine/async_llm.py`，`_run_output_handler` |
| HTTP 任务取结果，断开时终止 | 同文件 `generate` |
| 反分词、判停、算增量、放进收集器 | `vllm@0fc695fc:vllm/v1/engine/output_processor.py`，`process_outputs`、`make_request_output`、`RequestOutputCollector` |
| 两种反分词实现、扣字、找停止字符串 | `vllm@0fc695fc:vllm/v1/engine/detokenizer.py` |
| 按增量交还是一次交完 | `vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py`，`to_sampling_params` |
| 拼片段、结束片段、用量片段、[DONE] | `vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/serving.py`，`chat_completion_stream_generator` |
| 昇腾 GLM 工具调用末片段补丁 | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm_tool_call_streaming.py` |

**读源码的顺序。** 先看 `process_outputs`，它是引擎结果进前端后的总入口：往上追 `_run_output_handler` 看结果怎样到达，往下追反分词器的 `update` 和 `get_next_output_text` 看文字怎样算出来，再到 `chat_completion_stream_generator` 看片段怎样拼成。

**正文证据归档。** 引擎逐个追加、命中即截掉余下 token [C1]；有新 token 或已结束才打结果 [C2]；后台任务取结果、分片让出、把前端判停的请求通知引擎终止 [C3]；HTTP 任务被取消时终止请求 [C4]。

快速反分词的条件是 tokenizers 库不低于 0.22 且分词器属于快速类 [C9]；解码流开流时先喂提示词，遇到非法前缀就重建 [C11]；扣字长度为最长停止字符串减 1，因结束 token 或停止 token 结束时最后一个编号不还原，增量按上次推到的位置切出 [C10]；停止字符串只在新文字附近找 [C12]；前端判停而引擎未结束时加入终止名单 [C8]。扣字的四步账由这些规则推出 [D]。

流式请求按增量交出，非流式只交最终结果 [C15]；收集器在消费方没取走时合并 [C5]；--stream-interval 的含义与默认值 [C13]；首个片段声明角色 [C16]；无解析器时空增量照样成片段、解析器未就绪时跳过这一步 [C17]；结束片段、用量片段、错误片段与 [DONE] [C18]。

GLM 的分词器配置声明 tokenizers 后端 [S22]，思考标记不是特殊 token、三个结束编号是特殊 token [S21]；函数调用配置里的两个解析器 [S23]。本部署走快速反分词，是按分词器配置推断的，镜像里的库版本没有核 [I]。R1 三圈的 token 数、每批最多 32 条小于每片 128 条，都由上面的规则和部署参数推出 [D]。昇腾 GLM 工具调用补丁的拆分做法 [C24]。

版本差异：v0.26 判快速反分词的类名 [C27]；main 取最先完成的停止字符串 [C28]；main 的请求级推送间隔与按服务端设置取大 [C29]；v0.26 昇腾的 GLM 推理用量补丁 [C26]。

**待核。**

- 本部署镜像里 transformers 和 tokenizers 的版本：决定反分词走快速还是慢速实现，本页按分词器配置推断为快速。
- 单个 API server 在两组满载（最多 64 条请求）时，每圈反分词和拼片段的耗时；流式与非流式、不同 --stream-interval 下的吞吐和 TTFT 对照。
- 配了 glm45 reasoning parser 时，v0.23 流里思考段和答案的切分点、`</think>` 本身落在哪个字段：本页只核了配置和字段名，没有实跑。
- 异步调度下，前端收到每圈结果的实际时刻与同步调度相差多少。
