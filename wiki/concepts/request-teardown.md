---
id: request-teardown
title: 请求收尾：一条请求结束或被中止后，它占的东西怎样一件件还回去
type: concept
summary: >-
  请求收尾是一条请求停下后，前端、引擎和 worker 各自删掉为它存的记录、还回它对 KV
  块的引用。先分清引擎判停、停止字符串、客户端断开、出错四条路谁先动手，再分清还块（引用计数减 1）和清空前缀缓存（抹掉全部登记），最后看 GLM 双机上
  R1 结束时还了什么。
aliases:
  - 请求收尾
  - 请求结束
  - 请求释放
  - 请求中止
  - 中止请求
  - 取消请求
  - request teardown
  - abort
  - abort request
  - request abort
  - 客户端断开
  - client disconnect
  - finish_requests
  - _free_request
  - finished_req_ids
  - finish_reason
  - 结束原因
  - 释放 KV 块
  - 还块
  - reset_prefix_cache
  - 清空前缀缓存
  - LLM.reset_prefix_cache
  - LLM.reset_mm_cache
  - stop
  - 停止字符串
  - stop_token_ids
  - stop token ids
  - 停止 token 编号
  - ignore_eos
  - ignore eos
  - 忽略 EOS
chapters:
  - 09
order: 80
sources:
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1825-L1886'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1888-L1910'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1440-L1477'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1518-L1580'
  - 'vllm@0fc695fc:vllm/v1/core/sched/utils.py#L94-L130'
  - 'vllm@0fc695fc:vllm/v1/request.py#L330-L360'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L378-L384'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1535-L1540'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L600-L608'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1393-L1407'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L588-L636'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L709-L721'
  - 'vllm@0fc695fc:vllm/v1/engine/async_llm.py#L672-L690'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L450-L510'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L666-L708'
  - 'vllm@0fc695fc:vllm/entrypoints/serve/utils/api_utils.py#L37-L90'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L1440-L1446'
  - 'vllm@0fc695fc:vllm/v1/engine/core_client.py#L1505-L1525'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L911-L936'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1619-L1635'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L938-L946'
  - 'vllm@0fc695fc:vllm/v1/core/sched/interface.py#L171-L188'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1135-L1150'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1166-L1180'
  - 'vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L748-L763'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L438-L446'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L363-L378'
  - 'vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L751-L765'
  - 'vllm@0fc695fc:vllm/v1/core/block_pool.py#L419-L442'
  - 'vllm@0fc695fc:vllm/v1/core/block_pool.py#L462-L481'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1943-L1962'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L197-L200'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L484-L503'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L383-L395'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L2576-L2594'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L191-L198'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L2207-L2262'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L128-L154'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L2569-L2601'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L1-L9
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L1240-L1246
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L34-L46
  - 'vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L716-L724'
  - 'vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1363-L1366'
  - >-
    raw:sha256-d66f864795a463b87f2e477f5202698d5d17e72742f7d1c6615476a40ef6d8b9.md#L1-L1157
  - >-
    vllm@568afb3a13806beb53bb2e6bd518269357b237c0:vllm/v1/core/sched/scheduler.py#L148-L154
  - >-
    vllm@568afb3a13806beb53bb2e6bd518269357b237c0:vllm/v1/core/sched/scheduler.py#L2248-L2261
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/core/sched/scheduler.py#L1873-L1884
  - 'vllm@0fc695fc:vllm/sampling_params.py#L251-L290'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L443-L478'
  - 'vllm@0fc695fc:vllm/sampling_params.py#L566-L618'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/chat_completion/protocol.py#L195-L248'
  - 'vllm@0fc695fc:vllm/entrypoints/openai/completion/protocol.py#L56-L85'
  - 'vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L70-L164'
  - 'vllm@0fc695fc:vllm/v1/engine/detokenizer.py#L309-L344'
  - 'vllm@0fc695fc:vllm/v1/engine/output_processor.py#L630-L665'
  - 'vllm@568afb3a:vllm/entrypoints/openai/chat_completion/protocol.py#L642-L680'
  - 'vllm@568afb3a:vllm/entrypoints/openai/completion/protocol.py#L319-L372'
  - 'vllm@84030bbe:vllm/v1/engine/detokenizer.py#L310-L362'
  - 'vllm@84030bbe:vllm/sampling_params.py#L900-L923'
  - 'vllm@84030bbe:vllm/entrypoints/generate/base/protocol.py#L28-L30'
  - 'vllm@84030bbe:vllm/envs.py#L1154-L1160'
  - 'vllm@84030bbe:vllm/v1/core/sched/utils.py#L94-L136'
  - 'vllm@568afb3a:vllm/v1/engine/detokenizer.py#L95-L142'
  - 'vllm@84030bbe:vllm/v1/engine/detokenizer.py#L96-L143'
  - 'vllm@84030bbe:vllm/sampling_params.py#L690-L718'
  - 'vllm@568afb3a:vllm/sampling_params.py#L629-L657'
  - 'vllm@84030bbe:vllm/entrypoints/openai/chat_completion/protocol.py#L701-L746'
  - 'vllm@84030bbe:vllm/entrypoints/openai/completion/protocol.py#L348-L402'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L607-L641'
  - 'vllm@0fc695fc:vllm/v1/request.py#L220-L252'
  - 'vllm@ced6857a:vllm/v1/engine/output_processor.py#L550-L562'
  - 'vllm@ced6857a:vllm/v1/engine/output_processor.py#L584-L594'
  - 'vllm@ced6857a:vllm/v1/engine/output_processor.py#L760-L778'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L2561-L2646'
  - 'vllm@0fc695fc:vllm/entrypoints/llm.py#L411-L413'
  - 'vllm@0fc695fc:vllm/entrypoints/llm.py#L800-L805'
  - 'vllm@568afb3a:vllm/entrypoints/llm.py#L400-L402'
  - 'vllm@568afb3a:vllm/entrypoints/llm.py#L789-L794'
  - 'vllm@ced6857a:vllm/entrypoints/llm.py#L407-L409'
  - 'vllm@ced6857a:vllm/entrypoints/llm.py#L796-L801'
  - 'vllm@84030bbe:vllm/entrypoints/llm.py#L407-L409'
  - 'vllm@84030bbe:vllm/entrypoints/llm.py#L796-L801'
  - 'vllm@0fc695fc:vllm/v1/engine/llm_engine.py#L333-L342'
  - 'vllm@ced6857a:vllm/v1/engine/llm_engine.py#L350-L362'
  - 'vllm@84030bbe:vllm/v1/engine/llm_engine.py#L350-L362'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L631-L651'
  - 'vllm@0fc695fc:vllm/renderers/base.py#L187-L193'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1943-L2013'
  - 'vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L469-L483'
  - 'vllm@0fc695fc:vllm/v1/core/block_pool.py#L462-L495'
  - 'vllm@568afb3a:vllm/v1/core/block_pool.py#L761-L795'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_manager.py#L653-L667'
  - 'vllm@ced6857a:vllm/v1/core/kv_cache_coordinator.py#L375-L380'
  - 'vllm@ced6857a:vllm/v1/core/block_pool.py#L821-L859'
  - 'vllm@84030bbe:vllm/v1/core/kv_cache_manager.py#L633-L647'
  - 'vllm@84030bbe:vllm/v1/core/block_pool.py#L779-L813'
  - 'vllm@0fc695fc:vllm/v1/worker/worker_base.py#L120-L123'
  - 'vllm@0fc695fc:vllm/v1/worker/worker_base.py#L347-L352'
  - 'vllm@0fc695fc:vllm/v1/executor/abstract.py#L310-L312'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L914-L930'
  - 'vllm@0fc695fc:vllm/v1/worker/gpu/mm/encoder_cache.py#L23-L37'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L2688-L2750'
  - 'vllm@ced6857a:vllm/v1/core/sched/scheduler.py#L1477-L1518'
  - 'vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L2326-L2396'
  - 'vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L2696-L2758'
  - 'vllm@568afb3a:vllm/v1/engine/llm_engine.py#L342-L351'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L69-L83'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L245-L256'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L328-L351'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L794-L828'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L889-L976'
  - 'vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L1171-L1230'
  - 'vllm@ba15685a:vllm/v1/core/sched/scheduler.py#L3132-L3275'
  - 'vllm@ba15685a:vllm/v1/core/sched/scheduler.py#L3356-L3410'
  - 'vllm@ba15685a:vllm/v1/core/block_pool.py#L861-L900'
  - 'vllm@ba15685a:vllm/v1/engine/output_processor.py#L602-L620'
  - 'vllm@ba15685a:vllm/v1/engine/output_processor.py#L920-L932'
  - 'vllm-ascend@c09d3e20:vllm_ascend/worker/model_runner_v1.py#L959-L996'
  - 'vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1580-L1636'
  - 'vllm-ascend@8d6180e2:vllm_ascend/worker/v2/model_runner.py#L144-L165'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: one-request
    kind: builds-on
    note: 第 7 站讲了 R1 长度到限的那一圈和归还 16–17 个块号的账；本页把收尾拆成前端、引擎、worker 三处各删什么
  - to: streaming-output
    kind: builds-on
    note: 停止字符串怎样被发现、最后一个片段怎样推出在那一页；本页接着讲发现之后怎样通知引擎、谁先还
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 引用计数、空闲队列、各组倒序还块在那一页；本页只用到「计数减到 0 才回队列」和它与清空前缀缓存的区别
  - to: request-call-chain
    kind: builds-on
    note: API server、EngineCore、worker 三种进程和它们之间的通道在那一页；本页讲收尾时每种进程删掉什么
  - to: api-server-entry
    kind: builds-on
    note: 请求进门时登记的前端记录和输出槽在那一页；本页讲它们在结束时怎样被删
  - to: prefix-caching
    kind: builds-on
    note: 块的登记和驱逐在那一页；本页区分还块和清空前缀缓存这两个动作
  - to: async-scheduling
    kind: builds-on
    note: 调度器先排下一步再处理上一步结果；本页讲这让收尾时多算一步、通知 worker 晚一步
  - to: concurrent-requests
    kind: builds-on
    note: 池子不够时抢占的整批推导在那一页；本页只讲抢占和收尾的区别
contradicts: []
updated: 2026-11-19T00:00:00.000Z
origin: direct
---

## 请求收尾是什么：一条请求停下以后，它占着的东西去哪了？

**请求收尾**是一条请求停止生成以后，服务把为它保存的东西一件件删掉、还回去：前端删掉它的记录和输出槽，引擎把它移出队列、还掉它对 KV 块的引用，worker 删掉批次表里它那一行。

一条请求在服务里同时「住」在三种进程里。**前端**（API server）接 HTTP 请求、把文字切成 token 编号，再把引擎交回的编号还原成文字推给客户端；**引擎**（EngineCore）排队、调度、记每条请求算到了哪里；**worker** 是每张卡上真正跑模型的进程。三处各为这条请求存了一份东西，收尾就是把这三份都清掉，见下图。

```wiki-diagram
file: request-teardown-intuition
```

图里的数是示意。请求 A 正在生成，B、C 也在跑：

- **前端**为 A 存了一条记录，里面是反分词进度（编号还原成文字已经做到哪一个），还有一个输出槽：引擎每一步的结果先放进槽里，等 A 的 HTTP 任务来取。
- **引擎**有一张请求表，A 在里面占一项，下文叫**请求表项**，记着它算到哪、手里有哪些块；running 队列（正在生成的请求排成的队）里也有它一个位置。A 手里按顺序有 3 个 KV 块的引用：块 9、块 2、块 5。KV 块是显存里存 KV cache 的固定大小格子，所有请求从同一个池子里借，没借出的排在空闲块队列里。块 9 存的是 A 和 B 相同的开头：打开 prefix caching（前缀缓存）时，开头相同的请求共用已经算好的块，所以块 9 身上的引用计数（有几条请求在用它）是 2。
- **worker** 的批次表里 A 占一行，记着它的块号表和已算位置。每张卡上的 worker 各有一份。

A 停下以后，引擎在同一步里把 A 移出 running 队列，倒着还块（块 5 → 块 2 → 块 9）：块 5、块 2 的计数降到 0，排回空闲队列的队尾；块 9 的计数从 2 降到 1，B 还在用，块留在 B 手里；最后删掉 A 的请求表项。前端收到带结束原因的最后一份结果，删掉 A 的记录，输出槽把最后一份交给 HTTP 任务后随连接一起关掉。worker 要等下一步的调度清单里写着「A 已结束」，才删掉那一行。

还回去的块不擦数据：只改计数和排队位置，等它被下一条请求借走、写入时，旧数据才被覆盖。

## 为什么要收尾：不还会怎样，代价在哪？

**KV 块是所有请求共用的一个池子，一条请求不还，后面的请求就借不到；客户端走了不告诉引擎，引擎会一直白算下去。收尾本身只是几笔记账，贵的是它前后那几步。**

接着上图的示意数。空闲块队列里有 4 个块（3、4、6、7），等待队列头上的请求 D 要 6 个块才排得进。A 停下后如果不还，空闲一直是 4 个，D 一直等；还掉块 5、块 2 以后空闲变成 6 个，D 下一步就能排进来。块 9 还被 B 用着，不算空闲。

客户端断开也一样要收尾。设 A 最多生成 200 个 token，用户看到第 20 个就关掉了页面。引擎和客户端之间没有连接，它只和前端之间有消息通道，不知道连接已经断了；前端不告诉它，它会把剩下的 180 个 token 照样算完，这期间 A 的块一直占着，每一步的批次里也一直有它。

代价分三处：

- **记账本身很轻。** 收尾是 CPU 上的几笔记账：改几个计数、挪几个块号、删几个表项，不碰显存里的数据，也不发卡间通信。
- **发现得晚，就多算几步。** 停止字符串和客户端断开是前端先发现的，要多走一次进程间消息，引擎收到之前还会接着算。开着异步调度（CPU 先把下一步排好，再处理上一步的结果）时，引擎判停的那一刻这条请求已经排进了下一步，那一步替它算的结果只能扔掉，见[异步调度那一节](#异步调度下判停的时候下一步已经排好了)。
- **worker 晚一步删。** 批次表里那一行要等下一份调度清单才删，在这之前它还占着批次表的一个位置。

收尾容易和另外三个「把东西还回去」的动作混在一起：

| 动作 | 块的引用 | 引擎的请求表项 | 之后 |
| --- | --- | --- | --- |
| 收尾（结束或中止） | 全部减 1 | 删掉 | 不再被调度 |
| 抢占（preemption：块不够时把一条在跑的请求请出去） | 全部减 1 | 留着，已算位置清零 | 退回等待队列头，恢复所需的计算状态后续跑 |
| 默认清空前缀缓存 | 不动 | 不动 | 抹掉块的指纹登记；还有请求持块就失败 |
| MTP 候选被拒（一步先猜几个 token，验证没通过） | 不动 | 留着，已算位置回退几格 | 下一步原地覆盖写 |

前两行都把块还回池子，区别在请求还在不在：收尾以后这条请求不存在了，抢占以后它还排在等待队列里。第三行不还任何块，只抹掉块的指纹登记：开着 prefix caching 时，写满的块记着一个内容指纹，开头相同的请求靠它找到块来复用；抹掉以后，以前算过的开头再也不能被复用。后面几节先讲收尾，抢占和清空前缀缓存在需要分清的地方单独讲。

## 怎么收尾：四条结束的路，谁先发现、谁先动手

**一条请求有四种停法：引擎判停、前端发现停止字符串、客户端断开、出错。不管从哪条路来，最后都落到引擎里同一个释放动作；不同的只是谁先发现、谁先删自己那份。**

- **引擎判停。** 引擎每一步把新 token 逐个接到请求后面，每接一个查一次该不该停。输出还没到请求要求的最少个数时不停；接上的是结束 token（模型表示「回答完了」的特殊编号）或请求指定的停止 token，结束原因记 stop；总长度到了部署上限、或输出数到了请求的 max_tokens，记 length；请求开了重复检测并且命中，记 repetition。命中以后，这一步后面还没接的 token 全部丢掉。各项条件的细节见 [sampling「什么时候停下来」](sampling.md#什么时候停下来)。
- **停止字符串。** stop string 是请求参数里指定的一段文字，生成内容里一出现就停。要把编号还原成文字才看得出来，所以由持有反分词器的前端发现，扣字和截断的做法见[流式输出的停止字符串一节](streaming-output.md#停止字符串先扣住结尾几个字)。
- **客户端断开。** 用户关了页面、调用方超时断了连接。只有前端连着客户端，所以也是前端先发现。
- **出错。** 引擎这边，开了结构化输出（按 JSON 格式等约束输出）的请求，语法检查拒绝了模型刚采出的 token，这条请求以 error 结束（正常情况下屏蔽表已经挡住不合法的 token，这是兜底的异常分支）；前端这边，为这条请求取结果的任务里抛出没预料到的异常，前端先中止它再报错。

```wiki-diagram
file: request-teardown-flow
```

### 引擎先判停：同一步里先还块，再把结束原因发出去

还用请求 A。这一步 A 接上了结束 token：

1. 引擎在结果更新时判停，结束原因记 stop。
2. 同一步里释放 A：移出 running 队列，ID 记进「已结束」清单，倒着还块，删请求表项。
3. 把这一步 A 的新 token 和结束原因一起发回前端。
4. 前端还原最后一段文字，删掉 A 的记录，把最后一份结果放进输出槽；HTTP 任务取走它，推出带结束原因的最后一个片段（片段长什么样见[流式输出](streaming-output.md)）。引擎已经结束，前端不再发中止。
5. 下一次调度，清单里带上 A 的 ID，worker 删掉那一行。

所以 A 的块在前端看到最后一段文字之前，就已经回到池子里了。

### 前端先发现：停止字符串和客户端断开

**停止字符串。** 前端还原文字时发现了它：默认截掉停止字符串，也可要求保留；把这份结果（结束原因 stop）放进输出槽，删掉 A 的记录。如果这时 A 在引擎里还在 running 队列，前端把它的 ID 记进「要中止」的名单，这一批结果处理完就发一条中止消息（abort）。引擎收到后才释放、还块。若引擎已经在同批结果里报告结束，就不用再发中止。

**客户端断开。** 前端怎么知道客户端走了：非流式请求，服务一边跑处理函数、一边监听连接上的断开消息，哪个先完成就取消另一个；流式请求由推送响应自己监听连接，断开时取消正在推片段的那个任务。两种取消最后都落到为 A 取结果的生成函数里：它先在前端中止 A（删记录，往输出槽放一份结束原因为 abort 的结果），再把 A 的 ID 发给引擎。请求一次要了几个回答（n 大于 1）时，几个子请求一起中止。

这两条路上，从前端发现到引擎释放之间，引擎照常在跑。已经在卡上为 A 算的那一步，结果回来时 A 已经被中止，这份结果直接丢掉，不再发回前端。

### 停止文字、停止编号和忽略 EOS 怎样配合

**三项设置分别管文字、编号、模型默认结束信号。** 停止文字（stop）看前端还原出的生成文本；停止编号（stop_token_ids）看引擎刚接到的某一枚 token；忽略结束信号（ignore_eos）只让模型自带的 EOS 不再自动触发结束。EOS 是模型用来表示“回答完了”的特殊编号，含义见[采样的停止判断](sampling.md#什么时候停下来)。

先看一个示意：停止文字设为 END，模型连续三枚 token 恰好分别解码成 E、N、D。前两枚还没拼全，第三枚才命中；默认返回 END 之前的文字，要求保留标记时则返回到 END 为止。匹配大小写敏感，不是正则表达式，也不扫描提示词。跨 token 的后缀怎样暂存、避免把半截标记提前发给客户端，沿用[流式输出的扣字例子](streaming-output.md#停止字符串先扣住结尾几个字)。

停止编号不做这样的拼串。假设 E、N、D 的示意编号分别为 10、11、12，把三者全放进停止编号列表，意思是“任意一枚出现就停”，于是第一枚 E 就会结束，而不是等三枚顺次出现。这些编号只用于讲解；实际请求应向部署使用的分词器取编号。同一段文字在不同上下文中能切成不同序列，不能只取它单独分词的最后一个编号来代替停止字符串。

| 设置或组合 | 实际改变 | 仍然有效的结束条件 |
|---|---|---|
| 只设停止文字 | 文本里拼出指定串时前端判停 | 模型 EOS、编号停止、长度上限 |
| 手工指定停止编号 | 任意一枚指定编号被生成时引擎判停 | 模型 EOS、文字停止、长度上限 |
| 忽略 EOS | 不启用主 EOS 判停，也不自动把生成配置中的其他 EOS 加到停止编号里 | 手工停止编号、停止文字、长度及其他中止条件 |
| 忽略 EOS，又手工把同一个 EOS 编号列为停止编号 | 这个编号仍可作为手工规则触发停止 | 忽略开关不能撤销手工规则 |

模型的结束编号、手工编号也会参与[最少输出数的采样屏蔽](sampling.md#最少输出数怎样挡住提前结束)。达到最少数以后才解除那层屏蔽。停止文字则等输出超过最少数后匹配新增部分；在上面的三枚示意里，最少数为 2 时，E、N 先被保护，第三枚 D 补齐 END 后仍可触发截断，最后可见文字甚至为空。因此“至少生成几枚”与“最后显示几枚”需要分开。

返回时，命中主 EOS、手工停止编号或停止字符串，结束原因都可写 stop；额外的 stop_reason 才区分具体编号或字符串，主 EOS 通常为 null。长度到限则为 length。引擎逐枚判断时先检查 EOS/编号，再检查长度；前端之后还会检查文字，不能把引擎内部的先后顺序当成这几个字段跨进程的统一优先级。

**停止编号是否显示，也要看返回设置。** 本页固定 V1 路径在默认“不包含停止标记”时，不解码因 stop 结束的最后一枚编号，但仍保留它的 token 记录；打开包含标记后才尝试解码。特殊 token 还会受“跳过特殊标记”的设置影响。因而不能靠屏幕上是否出现结束标记来推断引擎是否真的生成过它。

### 中止消息晚到、重复到，都不出错

- **引擎这边处理两次也没事。** 中止消息到达后同时放进两个队列。一个是专门的中止队列，引擎每一步前向算完、处理结果之前先清它，这样释放得最早；另一个是普通消息队列，中止按到达顺序排在「加入请求」这类消息后面。如果这条请求的「加入」消息还排在普通队列里没处理，提前清的那一次查不到它；排在后面的这一次等它加入以后再删，不会漏掉。同一个 ID 因此会被处理两次，后处理的那次查不到或发现已经结束，直接跳过。
- **前端只发它还记着的。** 已经删掉记录的 ID 不再发。两个 DP 组（两套各自独立调度的执行组）时，前端用一张路由表记每条在途请求在哪一组，中止按表只发给那一组；请求结束时，引擎把「这批里结束了哪些」一起发回来，前端从表里删掉，之后再来的中止就查不到、不发。
- **等待中的请求也能中止。** 它从等待队列里被删掉；不用 KV connector 时它还没借过块，还块这一步什么也不做。用 connector 时，正在等远端 KV 传进来的请求手里已经有块，传输没完成就要推后还块。
- **引擎整个挂掉时不发中止。** 前端直接报错，不再往一个已经不在的进程发消息。

### 出错：结束原因记 error

引擎判出错后，和正常判停走同一条路：同一步里释放、还块，结束原因记 error 发回前端；语法拒绝 token 本该被屏蔽表挡住，真发生时还会打一条以 Unexpected 开头的 error 级日志。用了 KV connector（把 KV 在机器之间传送的组件）的部署，远端 KV 加载失败时，按默认的「直接失败」策略，请求也这样以 error 结束。前端收到 error，把它报成服务器内部错误：流式请求这时已经回过「成功」的状态码，只能往流里写一个错误片段，见[流式输出「会报什么错」](streaming-output.md#会报什么错)。

## 还块：计数减到 0 才回池子，清空前缀缓存是另一回事

**还块只是把这条请求对每个块的引用减 1：减到 0 的块排回空闲队列，块里的数据、以及开着 prefix caching 时块的指纹登记都还留着。清空前缀缓存是另一个动作：一次抹掉所有块的指纹登记，让以前算过的开头再也查不到。**

每个块身上记着一个引用计数，表示现在有几条请求在用它；借出时从 0 变 1，几条请求共用时大于 1。池子、空闲队列和计数的来龙去脉见 [KV 块分配](vllm-kv-block-allocation.md#请求要存-kv-时块从哪里来用完去哪里)。收尾时，A 借块顺序是「块 9 → 块 2 → 块 5」，引擎把它们**倒过来**按「块 5 → 块 2 → 块 9」逐个交回（示意；空闲队列由 `3, 4, 6, 7` 变为 `3, 4, 6, 7, 5, 2`，空闲块数 $4 + 2 = 6$ 块）：

| 倒序交回顺序 | 释放前引用计数 | 减 $1$ 后计数 | 去向 |
| --- | --- | --- | --- |
| 第 1 个：块 5 | $1$ | $1 - 1 = \mathbf{0}$ | 排回空闲队列队尾 |
| 第 2 个：块 2 | $1$ | $1 - 1 = \mathbf{0}$ | 排回空闲队列队尾 |
| 第 3 个：块 9 | $2$（A 与 B 共享） | $2 - 1 = \mathbf{1}$ | B 仍在使用，不回空闲队列 |

为什么倒着还：空闲队列从队头往外借，排在前面的块先被借走。倒着还，一条序列的尾巴排在前面、开头排在后面；开着 prefix caching 时，开头那几块最常被别的请求共用，这样留得最久，驱逐顺序见 [prefix caching「池子满了怎么办」](prefix-caching.md#池子的预算怎么分满了怎么办)。只记最近几个位置的那类缓存组（滑动窗口）是例外：没有指纹登记的块直接插回队头，先被重用。

**还块不等于抹指纹登记。** 开着 prefix caching 时，写满的块会登记一个「内容指纹」，也就是前面说的**指纹登记**；后来开头相同的请求按指纹查到它就能直接复用。它和上面引擎里的请求表项是两回事：请求表项属于请求，结束就删；指纹登记属于块，跟着块走。A 还掉块 5、块 2 以后，两块计数是 0、排在队里，指纹登记还在：在被队头取走之前，开头相同的新请求仍能命中它们、把它们从队里捡回来；真被借给别人写新内容时，旧的指纹登记才抹掉，这叫驱逐，见[引用计数什么时候大于 1](vllm-kv-block-allocation.md#引用计数什么时候大于-1共享登记与驱逐)。

**清空前缀缓存（reset prefix cache）** 一次把块的指纹登记抹掉，以后谁也命中不了以前算过的开头。它用在模型权重换过以后（旧的 KV 已经不对了），或者做性能测试时想从「没有可复用前缀」开始量。在本页块池里，除了始终保留、不借给请求的 null 占位块，其余块都必须已经空闲。接着上面的例子，A 结束后 B 还在跑，块 9 的计数是 1，这时默认清空返回失败并警告；要等 B 也结束，或者清空时要求先把所有在跑的请求抢占掉（让出块、退回等待队列）再清。HTTP 接口只在开发模式下注册；离线 Python 对象也有直接入口，见后文。

**有时块要晚一点还。** 延迟还块主要有两种原因：一是用了 KV connector 的部署（比如 [PD 分离](pd-disaggregation.md)把 prefill 和 decode 交给两组机器），prefill 端要先把 KV 发给 decode 端，连接器会要求暂不还块——请求已经算结束、ID 也进了「已结束」清单，但还块和删请求表项要等传输完成；二是后续上游新增的**在途写入保护**，当 KV 接收端允许多个批次同时在途时，如果请求最后被调度的步骤尚未处理完成，旧批次可能仍在写缓存，实现会先暂存待释放块，等该步骤完成后再还回块池，正常完成的请求则直接释放。

## 收尾的最后两步：worker 删行，前端更新路由表

**引擎释放以后还有两处要跟上：worker 批次表里那一行，要等下一份调度清单才删；有两个 DP 组时，前端的路由表和组间的负载计数也要把这条请求减掉。**

**worker 晚一步删。** 引擎每一步发给 worker 一份调度清单，写着这一步算哪些请求、各算几个 token，其中有一栏是「上一步以来结束了哪些请求」。worker 准备这一步的输入时先看这一栏：把这些请求的缓存状态（提示词编号、采样参数、块号表等）删掉，再把它们从批次表里移走。接着示意例子：A 在第 k 步结果更新时释放，ID 记进「已结束」清单；第 k+1 步调度时清单发出，每张卡上的 worker 各删掉 A 那一行，清单随即清空。

如果 A 是最后一条请求，引擎也不会就此停住：只要「已结束」清单不空，它就认为还有事要做，再调度一次，把清单送到 worker。

**两个 DP 组时，前端和协调器也要跟上。** DP（数据并行）把服务分成几套各自独立调度的执行组。前端为了把中止发对组，给每条在途请求记了它在哪一组；引擎每次发回结果时，顺带写上「这批里结束了哪些请求」，前端据此从表里删掉。另外，各组引擎会把自己 running、waiting 的条数报给 DP 协调器（汇总各组负载的小进程），协调器再推给前端，用来给新请求挑组；一条请求结束，它所在那一组报上去的 running 就少 1，见 [DP 选组的计数表](dp-request-routing.md#计数表从哪来为什么会过时)。

## 抢占不是收尾：块还了，请求还在

**抢占（preemption）也把一条请求的块全部还回池子，但请求本身没有结束：它的请求表项留着，已算位置清零，退回等待队列。恢复时先看哪些缓存还能复用，再补算缺失部分；前端不因此收到结束通知，客户端可能看到一段停顿。**

池子不够时调度器请出哪一条、被请出的那条状态怎样改、这一步还排不排新请求，见[池子不够时宁可抢占](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)。和收尾相同的只有还块：用的是同一个还块动作。不同在三处：

- **请求表项留着。** 收尾删掉请求表项；抢占只把它的状态改成「被抢占」、已算位置清零。
- **不进「已结束」清单。** worker 不删它的缓存状态，只是这一步的清单里没有它，就先把它从批次表里移出；等它重新被排上，再按留着的状态、换上新借的块号放回批次表。
- **前端照旧等着。** 引擎不发结束原因，前端的记录和输出槽都留着；流式客户端看到的只是片段停了一阵，重算完又接着来。

重算是抢占的主要代价。沿用一个**没有可复用 KV 的示意**：A 的提示词有 100 个 token，已经生成 50 个。恢复时，这 150 个已知编号会作为输入，用来重建后续计算所需的历史状态，再继续生成第 51 个输出。它们可以按调度预算分几步处理；最后刚生成的编号也可能尚未做过前向，不能把这 150 个位置全部算成额外重复工作。

这里重建的是计算状态，**不是删掉那 50 个已生成编号再重新采样，也不是重新向客户端发送它们**。现场若真的看到重复内容，要将恢复输入、引擎新增输出与客户端收到的片段按同一请求对齐，区分内部重算与重复交付；输出链路复用[流式输出](streaming-output.md)的解释。

若开启了 [prefix caching](prefix-caching.md)，重新进入调度时还会查找能命中的缓存块；有多少仍可复用，要看块是否保留、是否匹配及对应缓存组的规则。**已算位置清零，不等于所有历史都失去复用机会。** 本站固定 GLM 部署关闭 prefix caching，且未配置外部 KV 连接器，才需要按整段已知历史重建状态来估算恢复工作。

## 异步调度下：判停的时候，下一步已经排好了

**开着异步调度时，引擎先把下一步排好、发给 worker，再回头处理上一步的结果。所以一条请求在上一步的结果里判停时，它已经被排进了下一步：那一步替它算的结果回来时直接丢掉，worker 也要再晚一步才删它那一行。**

异步调度是让 CPU 上的排程和卡上的计算重叠：卡在算第 k 步时，调度器不等结果，先按「候选全被接受」的假设把第 k+1 步排好，见 [async scheduling](async-scheduling.md#结果还没回来下一步怎么排先记输出占位)。沿着示意例子走一遍，设 A 在第 k 步采到了结束 token：

1. 第 k 步在卡上算，结果还没回来，没人知道 A 该停了。
2. 调度器先排第 k+1 步。A 还在 running 队列里，照样给它排上位置，需要的话还借新块。
3. 第 k 步的结果回来：A 判停、释放。为第 k+1 步借的块也在 A 手里，一起还掉。
4. 第 k+1 步的结果回来：A 已经不在请求表里，这份结果跳过，不发前端。
5. 「A 已结束」赶不上已经发出的第 k+1 步清单，要到第 k+2 步的清单里才送到 worker。

长度到限是例外：调度器排下一步前会先算一笔，就算在途那一步的候选全被拒，输出数是不是也已经到了上限；能确定到了，就不再给它排。结束 token 和停止 token 事先看不出来，所以总要多排这一步。

前端先发现的两条路也一样：前端拿到第 k 步的结果、发现停止字符串时，引擎那边排好的第 k+1 步、以及处理完第 k 步结果后接着排的下一步里都还有 A；中止消息在下一份结果处理之前生效，这几步里替 A 算的结果都按「已经不在」跳过。

下图把前面从前端断开/停止串经 ZMQ 双队列发往引擎、调度器倒序还块到异步调度下 worker 延步删行的完整时序，以及收尾、抢占与清空前缀缓存三者的边界放在一处对照：

```wiki-diagram
file: request-teardown-fig-abort-lifecycle
```

## 离线脚本怎样重置缓存，再比较下一轮？

**已有 LLM 对象可以直接重置缓存，调用方要区分重置对象并检查结果。** 结束一轮请求只归还引用，旧前缀仍可能被下一轮命中；做冷前缀对照时，应先等这一轮完成，再调用 reset_prefix_cache。它默认保留运行请求，也不调用外部 KV connector 的重置；返回的布尔值表示是否成功。Python 入口不需要打开 HTTP 开发路由。

沿用块 9 的例子：A 已结束但 B 还持有它，默认重置失败；B 结束、其余块也都空闲后，才可清掉旧前缀登记。若选择先抢占运行请求，B 会退回等待队列并重建需要的历史继续生成，前端不会因此收到“请求已取消”。这样的重置会打断原有计算节奏，不能把随后变慢直接归因于模型算子。

**媒体预处理缓存是另一份状态。** reset_mm_cache 清前处理和接收侧的媒体缓存及相应处理状态；它不等于清 KV 前缀，也不等于清 encoder 已算出的媒体表示。这三份状态分别省掉哪一步，见[多模态的三种缓存](api-server-entry.md#三种缓存各自省掉哪一步)。核对外部编码结果是否真正复用时，按 [UCM 的完整验证步骤](ucm.md#怎么开)处理各层，不能只清其中一份就把第二轮当成相同起点。

MM 重置在有在途请求时只发出可能不同步的警告，不替脚本等待所有工作结束。应先完成当前工作，再做验证性重置；具体调用及失败处理见[怎么开](#怎么开)。前缀重置清的是索引，不会把设备 KV 张量逐字节抹零，也不会释放整个缓存池的显存分配。

## 落到 GLM 双机：R1 结束时，三处各还了什么

**R1 在 DP0 上以长度到限结束：node0 上 DP0 的引擎在判停的同一步还掉 16–17 个块号，node0 上唯一的前端删记录、推完最后一个片段，DP0 的 8 个 worker 晚一步删行。prefix caching 关着，还块就是计数 1 → 0，没有指纹登记可抹。**

部署按[官方双机](glm-5-3-flash-two-node.md#部署前提)：两台机器各是一个 DP 组，node0 上一个前端接下全部请求。R1 是主线的示例请求，套完模板、分词后 4 个 token，被派到 DP0（见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)）。收尾沿用[第 7 站](one-request.md#第-7-站-返回与收尾)的设定：max_tokens 是 200，最后一圈之前已输出 197 个，这一圈验证又产出 4 个，引擎接到第 200 个时判长度到限，只把前 3 个发给前端。GLM 的三个结束 token 怎样判停，见 [sampling「停止判断和长度上限」](sampling.md#停止判断和长度上限)。

**引擎（node0，DP0 的 EngineCore）。** 判停的同一步释放 R1：移出 running 队列，ID 记进「已结束」清单，还块，删请求表项。R1 手里是 full 组 1 块、KDA 组 12 块、尾状态组 3–4 块，共 16–17 块，怎么数出来的见第 7 站。各组倒着交回：full 组和 KDA 组的块排回空闲队列尾；尾状态组按滑动窗口管理，它的块没有指纹登记，插回队头，细节见[结束：16–17 块一次还清](vllm-kv-block-allocation.md#结束1617-块一次还清)。

- **没有指纹登记可抹。** GLM 是同时有注意力层和递推状态层的混合模型，prefix caching 默认关着（见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)），块从没登记过指纹。还块对它来说就是计数 1 → 0、排回队列，「还块」和「清空前缀缓存」在这套部署里没有交集。
- **不推后还块。** 官方部署没有配 KV connector，块在判停的同一步就还，不等任何传输。
- **异步调度开启时多排一步。** 按固定部署的默认条件推断会开启异步调度，现场仍要核对实际配置与启动日志，判定条件见[调度器的配置说明](vllm-scheduler.md#怎么开)。本例沿开启的路径推演：R1 最后一圈之前已有 197 个输出，就算这一圈候选全被拒也只到 198 个，调度器不能确定它到限，于是下一步照样给 R1 排了位置；那一步的结果回来时 R1 已经释放，直接跳过。

**worker（node0 的 8 张卡）。** R1 所在的 DP0 由 node0 上 8 个 worker 一起算，每个 worker 都有一张批次表。沿用上面的异步开启条件，紧接着的那份调度清单在判停之前就已经发出，「R1 已结束」要等再下一份清单才送到，8 个 worker 各删一行。node1 上 DP1 的 worker 从没见过 R1，不受影响。

**前端（node0 的 API server）。** 收到 R1 的 3 个新 token 和结束原因 length，还原最后一段文字，删掉 R1 的记录；HTTP 任务推出带 length 的最后一个片段，再发 [DONE]，见[流式输出的收尾一节](streaming-output.md#收尾长度到限再归还块号)。引擎这次发回的结果里写着 R1 已结束，前端把它从路由表里删掉。DP0 报给协调器的 running 少 1，两台机器什么时候一起停下，见第 7 站末尾。

**如果 R1 是被中止的。** 设客户端在第 20 个 token 时断开：前端先删记录，中止消息按路由表只发给 DP0；DP0 在下一份结果处理之前释放 R1，还的块数按当时的已算位置算，规则同上。断开和中止的日志默认不打印，要打开请求日志才有，部署页整理的启动参数里没有这一项。

**抢占在这套部署里很贵**，为什么贵、被请出的那条要重算多少，见[多条请求的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)。

从单条请求收尾继续看整套服务，可读[容量与恢复案例](inference-capacity-and-reliability.md#计划下线与突然故障为什么不能走同一条恢复路)，对照计划下线、迁移确认与故障重试的不同条件。

## 常见误解

- **「客户端断开以后，引擎自己会发现、停下来。」** 引擎和客户端之间没有连接，只和前端之间有消息通道。断开只有前端知道，必须由前端发中止消息，否则引擎会把剩下的 token 照样算完。
- **「引擎判停后，要等前端把最后一段文字推出去才还块。」** 顺序反过来：引擎在判停的同一步先还块，再把结果发给前端。只有停止字符串和客户端断开是前端先动手、引擎后还块。
- **「请求结束了，它的块就全回到空闲队列。」** 只有计数减到 0 的块才回去；和别的请求共用的开头块还留在别人手里。KV connector 是衔接历史状态传输的组件，它也可能要求延迟释放。例如，请求正在等待远端历史状态、且尚未登记接收完成时，引擎会先把请求设为结束，但暂时保留块和请求表项；这时等待的是接收完成。
- **「还块就等于清空了前缀缓存。」** 还块只把计数减 1，块的指纹登记还在，开头相同的新请求还能命中它；清空前缀缓存才抹指纹登记，而且要除 null 占位块以外的块都空闲才做得成。
- **「中止消息发两次，或者发给一条已经结束的请求，会报错。」** 引擎查不到这个 ID、或者发现它已经结束，就直接跳过；前端也只发它还记着的 ID。
- **「抢占就是让请求提前结束。」** 抢占只还块，请求表项与已生成编号仍在；退回等待队列后恢复计算，前端继续等待后续输出。
- **「worker 在请求结束的那一步就删掉它那一行。」** worker 要等下一份调度清单写明它已结束才删；开着异步调度时，紧接着的那份清单已经提前发出，还要再晚一份。

## 对照源码

### 怎么开

收尾不是一个开关，每条请求都会走。和它相关、能调的是这些：

- `--enable-log-requests`：默认关。打开后，中止、引擎已死、意外异常这些收尾路径才打日志。
- `--enable-prefix-caching`：打开后还块才涉及指纹登记和驱逐；GLM 这类混合模型不写时取默认的关。
- `--async-scheduling` / `--no-async-scheduling`：决定判停时下一步是不是已经排好。默认留空，由启动检查决定。
- `VLLM_SERVER_DEV_MODE=1`：开发模式下才注册 `POST /reset_prefix_cache`；带 `reset_running_requests=true` 时先抢占所有在跑的请求再清。
- 请求参数：`max_tokens`、`min_tokens`、`stop`、`stop_token_ids`、`ignore_eos`，以及采样参数里的 `repetition_detection`，决定引擎和前端在哪一步判停。长度预算统一见[入口页](api-server-entry.md#怎么开)，最少长度统一见[采样页](sampling.md#最少输出数怎样挡住提前结束)。

**离线重置沿用已有 llm。** 先让本轮 generate 或 wait_for_completion 返回，再检查 Python 方法的结果：

```python
ok = llm.reset_prefix_cache()
if not ok:
    raise RuntimeError("前缀重置未成功，请检查剩余块引用与连接器状态")
```

两个可选参数 reset_running_requests、reset_connector 默认都是 False。前者设 True 会抢占运行请求，随后仍要恢复计算；后者设 True 才额外调用 connector.reset_cache，没有 connector 时这一步视为成功空操作。它不是跨所有外部存储的清空保证，也不提供多个缓存层一起成功或一起撤销的事务。普通重置失败时不要把实验标记为“已清缓存”；强制抢占以后仍有远端 KV 等持块原因时会抛 RuntimeError。

需要清媒体前处理状态时，在没有在途工作的前提下另调 `llm.reset_mm_cache()`。它返回 None，不提供 prefix 重置那样的 success 布尔值；也不调用独立的 encoder 输出重置。保留外部存储、逐层验证命中和实际加载的操作，继续使用 [UCM 验证流程](ucm.md#怎么开)。

**下表的 stop、stop_token_ids、ignore_eos 都是逐请求字段。** 普通 Chat、Completions 的 HTTP JSON 顶层和 Python SamplingParams 均支持；不是 Ascend 的 additional_config。下表按固定 v0.23 写，后续版本变化单列。

| 参数 | 类型、默认、关闭方式 | 合法值与相互作用 |
|---|---|---|
| `stop` | 字符串或字符串列表，也接受 None/null；HTTP 默认 []，SamplingParams 的 None 归一化成 []；[]/null 关闭文字停止 | 单个字符串归为单元素列表；每项必须非空；要开启 detokenize，精确匹配生成文本 |
| `stop_token_ids` | 整数列表或 None/null；HTTP 默认 []，SamplingParams 的 None 归为 []；[]/null 不添加手工编号 | 每项须为实际词表内的编号；基线仅查整数，main 新增范围校验。传 [] 不会删除模型自动加入的 EOS |
| `ignore_eos` | 布尔值，默认 false；false 恢复自动 EOS 结束 | true 仅关闭自动 EOS 判停；不能屏蔽手工编号、停止文字、长度上限或取消 |

在基线，输入处理阶段会把 tokenizer 的主 EOS 和 generation_config 的其他 EOS 纳入相应规则；ignore_eos=false 时，其他 EOS 与手工 stop_token_ids 合并。ignore_eos=true 时不做这次自动并入，但已经手工给出的编号保持有效。模型 EOS 仍保留在最少长度处理的内部集合。三项不是把任意同名键写入生成配置就能设置的服务默认；v0.26/main 另外合并入口已经提供的 default_sampling_params.stop_token_ids，具体见版本表。

控制返回文字的配套字段 `include_stop_str_in_output` 默认 false：字符串命中时去掉匹配串，true 则保留到匹配串结束。它在本页固定 V1 反分词路径也控制编号停止的最后一枚是否被解码；即使为 true，默认 skip_special_tokens=true 仍会隐藏特殊 token。停止 token 记录与文本裁切分别处理，不用可见文字重新估算生成 token 数。

向已有 glm 服务的 `/v1/chat/completions` 发送以下 JSON（Content-Type 为 application/json）。这个示例关闭自动 EOS，但保留文字停止和 64 枚上限；不承诺模型一定生成 END，也不要求更改固定 MTP 配置。

```json
{
  "model": "glm",
  "messages": [{"role": "user", "content": "简短解释 KV cache，最后另起一行写 END。"}],
  "max_completion_tokens": 64,
  "stop": ["END"],
  "stop_token_ids": [],
  "ignore_eos": true,
  "include_stop_str_in_output": false
}
```

改用 Completions 时，将 messages 换成 prompt，max_completion_tokens 换成 max_tokens。兼容 SDK 的 stop 使用其标准字段，其余扩展由 extra_body 传入；线上 JSON 仍是上面的顶层字段。

离线编号示例沿用已经初始化的 llm；取得真实主 EOS 后，再明确把它作为手工停止规则。即使 ignore_eos=true，这个手工规则仍有效。返回中输出 token_ids 能保留停止编号，而 text 受上面的显示设置影响。

```python
from vllm import SamplingParams

eos_id = llm.get_tokenizer().eos_token_id
if eos_id is None:
    raise ValueError("当前分词器没有主 EOS 编号，请使用模型约定的停止规则")
params = SamplingParams(
    max_tokens=64, stop=["END"], stop_token_ids=[eos_id],
    ignore_eos=True, include_stop_str_in_output=False,
)
outputs = llm.generate(["简短解释 KV cache，最后写 END。"], params)
print(outputs[0].outputs[0].text)
print(outputs[0].outputs[0].token_ids)
```

### 会报什么错

默认 Python prefix 重置返回 False 时，检查块引用是否已释放；若显式要求先抢占，仍无法重置会报告 `Failed to reset KV cache even when all the running requests are preempted`，可能还在等待远端 KV。MM 重置期间仍有请求，会警告 `may lead to desynced internal caches`；该警告不代表系统已经替调用方隔离并发。

停止参数会先经过校验：`stop cannot contain an empty string.` 表示传了空字符串或列表含空串；`stop strings are only supported when detokenize is True.` 表示同时关了反分词；`stop_token_ids must contain only integers` 表示列表成员不符。main 新增 `out-of-vocab token ids` 范围错误与 HTTP 停止串条数上限，见版本表。类型和参数检查发生在入口或输入处理阶段，错误如何出现在普通响应/流中，见[入口错误路径](api-server-entry.md#流式和非流式200-什么时候发出错误从哪里回来)。

下面是收尾路径上会打的日志，原文与 `vllm@0fc695fc` 一致：

- `Request %s aborted.`（`vllm/v1/engine/async_llm.py#L595`，info）：为这条请求取结果的生成函数被取消，通常是客户端断开；前端已中止它并通知引擎。只在打开请求日志时打印。
- `Aborted request(s) %s.`（同文件 `#L721`，info）：`abort` 处理完一批 ID，前端和引擎两边都已发出中止。同样只在打开请求日志时打印。
- `Request %s failed (engine dead).`（同文件 `#L601`，info）：引擎进程已经不在，前端不发中止，直接把错误往上抛。只在打开请求日志时打印。
- `Request %s failed due to %s.`（同文件 `#L631`，info）：生成函数里出了意外异常，前端先中止这条请求，再抛出 `EngineGenerateError`。只在打开请求日志时打印。
- `Unexpected: grammar rejected tokens %s for request %s. Terminating request.`（`vllm/v1/core/sched/scheduler.py#L1469-L1473`，error）：结构化输出的语法拒绝了刚采出的 token，请求以 error 结束，同一步释放。
- `Request %s failed with an internal error during generation`（`vllm/entrypoints/openai/engine/serving.py#L195-L197`，error）：前端收到结束原因 error，按内部错误回给客户端。
- `Failed to reset prefix cache because some blocks (%d) are not freed yet`（`vllm/v1/core/block_pool.py#L473-L477`，warning）：清空前缀缓存时还有块被引用，没有清。

### 开销和什么时候别开

- **收尾本身很轻**：只是 CPU 上的记账，中止按批处理，一次清掉一批 ID。
- **异步调度可能多算一步**：以结束 token 或停止 token 结束的请求，还可能在提前排好的下一步里占位置；GLM 双机上通常是 1 个确定 token 加 3 个候选。只有调度时已能确定在途步达到长度上限，才不再多排；否则如上面的 197→200 算例，仍会提前排出下一步，再丢弃它的结果。
- **停止字符串比停止 token 贵**：要等前端还原文字才发现，再走一次中止消息，引擎这期间多算一两步。能用停止 token 表达的结束条件，用停止 token，引擎当步就停。
- **调用方超时别设太短**：超时断开会触发中止，前面已经算过的 token 全部作废。
- **线上别随手清空前缀缓存**：之后的请求要从头算开头；带强制参数时会抢占所有在跑的请求。GLM 默认没开 prefix caching，没有可清的指纹登记。
- **压测时关掉请求日志**：每条请求多打几行 info。
- **忽略 EOS 要给明确预算**：它能让模型越过自然结束位置继续生成，增加前向和 KV 占用，也会产生后续无关文本。为了观察固定长度负载可以使用；普通问答通常保留 false。停止字符串比较随字符串数量和长度增加，且不包含标记时会暂扣最长串长度减一的字符，影响流式出字时机；实现与例子见[流式输出](streaming-output.md#停止字符串先扣住结尾几个字)。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm-ascend@2c59ff10` / `vllm@0fc695fc`）、`v0.26.0rc`（`vllm-ascend@2ed6cbba` / `vllm@568afb3a`）、`v0.30.0` 主基线（`vllm-ascend@c09d3e20` / `vllm@ced6857a`）与 `main`（`vllm-ascend@8d6180e2` / `vllm@ba15685a`）；GLM 双机算例固定在例外 B 专用镜像 `vllm-ascend@db701c1f` + `vllm@0fc695fc`。

**上游 vLLM 四版对照（请求收尾、abort、块回收与离线缓存重置）：**

| 核对项 | `v0.23.0`（`0fc695fc`） | `v0.26.0rc`（`568afb3a`） | `v0.30.0`（`ced6857a`，主基线） | `main`（`ba15685a`） |
| --- | --- | --- | --- | --- |
| 判停/abort → `finished_req_ids` → 还块 → 删表项 | 有（`scheduler.py#L1825-L1910`） | 释放另返回编码侧 connector 参数 | 延续；`OutputProcessor` 新增、abort 与完成同步更新共享准入计数（`output_processor.py#L550-L778`、`scheduler.py#L2561-L2646`） | 同 `v0.30.0`（`scheduler.py#L3132-L3275`、`output_processor.py#L602-L620`、`L920-L932`） |
| 有 KV consumer connector 且多批在途时延迟还块 | 无 | 有（`deferred_frees` 等待在途步完成再还块） | 保留 `deferred_frees` 与 fence/connector 回收条件 | 保留 `deferred_frees` 延迟还块保护 |
| 离线 `reset_prefix_cache` 清池与强制抢占 | 直接清共享 `block_pool`；记录待丢弃异步输出 | 另清反向 hash 索引 | 经 coordinator 逐池重置并通知 `reuse_watchers`（`block_pool.py#L821-L859`、`scheduler.py#L2688-L2750`）；抢占经 `drop_stale_output` | 延续逐池清理、`reuse_watchers` 通知与 `drop_stale_output`（`block_pool.py#L861-L900`、`scheduler.py#L3356-L3410`） |
| `reset_mm_cache` 与并发 | 在途请求只警告；MM 与 encoder 输出重置分开 | 相同 | 引擎路径另等待后台 MM warmup；仍不隔离任意在途请求 | 同 `v0.30.0` |
| 停止参数与多串匹配 | 合并生成配置 EOS；手工编号仅查整数；多串按列表顺序；引擎先查 `min_tokens` | Chat/Completions 另合并默认 `stop_token_ids` | 新增手工编号词表范围校验、`VLLM_MAX_STOP_STRINGS`（默认 4）、多串选最早结束位置、引擎先查 EOS/长度 | 同 `v0.30.0` |

`v0.30.0` 与 `main` 的 `OutputProcessor` 均把共享准入计数纳入请求生命周期，不能仅从本地 `request_states` 判断全局负载是否已释放；`FINISHED_ABORTED` 也不意味着网络、设备和块池资源立即全部释放，仍须经过相应 fence 与 connector 回收条件。四版的 MM 重置都不能替代 encoder 输出重置；逐池重置返回 `False` 不意味着其他池的成功重置已回滚。多串选择差异可用一组示意看清：`stop` 列表为 `[END, X]`，同一次更新新得到「A X B END」，不包含标记时 `v0.23.0`/`v0.26.0rc` 先匹配 `END`（保留「A X B 」），`v0.30.0`/`main` 先取结束位置更早的 `X`（保留「A 」）。

**vllm-ascend 四版对照**（GLM 绑定算例另见专用镜像 `db701c1f`，其调度器收尾与 worker 删行逻辑同 `v0.23.0`）：

| 核对项 | `v0.23.0`（`2c59ff10`） | `v0.26.0rc`（`2ed6cbba`） | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |
| --- | --- | --- | --- | --- |
| 调度器收尾与重置路径 | 用上游；可选均衡调度另写 `reset_prefix_cache`（默认关） | 换为 `KVDeliveryScheduler`，区分普通容量抢占、KV 可靠交付与强制重置在途结果；判停释放沿用上游 | 回归上游主调度器；提供可选 `dyntra_lb_config`（默认关，`ascend_config.py#L1580-L1636`）与可选批任务感知调度器 | 延续上游主调度器与可选 DyntraLB / 批任务感知调度器 |
| worker 批次删行 | 异步回退保护后转交上游 `_update_states` | 同 `v0.23.0` | MRV1 保留 `model_runner_v1.py#L959-L996`（`_update_states`），同步提供 MRV2 路径 | 移除 MRV1 `model_runner_v1.py`，统一走 MRV2 `worker/v2/model_runner.py#L144-L165`（继承上游 `GPUModelRunner`） |

`v0.26.0rc` 换调度器类以后，没有 KV connector 时判停、中止和还块的顺序与上游一致；抢占后的旧结果则要按触发原因区分。普通容量抢占把 `requires_kv_delivery` 传给丢弃开关：没有 connector 时该值为 `False`，采用保留旧输出的模式；有 connector 时还要看它是否要求 KV 可靠交付。已经处于丢弃模式且旧结果尚未排空的请求继续丢弃，不能由下一次普通抢占恢复成保留。

保留模式下，等待队列先等旧结果排空再恢复请求；旧结果返回时仍经过加载失败、请求已结束等检查，有效 token 才追加，旧的投机拒绝数不会再次回滚已重置的计算进度。调用 `reset_prefix_cache(reset_running_requests=True)` 则明确按丢弃模式强制抢占，旧结果返回时跳过输出，避免立即恢复后交出乱序 token。上述分支、计数和调用点见来源 109–114；强制重置与普通容量抢占不能共用“结果一律保留”的结论。

### 源码位置

离线缓存入口：77–84 是四版 LLM 的两种公开 reset；85–89、108 接通引擎、renderer 和接收缓存。90–98、104–107 对照 scheduler、KV manager、block pool 及 rc2 的各池协调与强制抢占；这也解释返回失败不等于跨池或跨介质回滚。99–103 区分 Worker 分派、MRV1/MM 和 encoder 两种清理以及 MRV2 helper。它们补充原有 30–31 的局部来源，不替换还块与请求收尾的证据。

| 看什么 | 去哪里 |
| --- | --- |
| 判停条件和先后 | `vllm@0fc695fc:vllm/v1/core/sched/utils.py`，`check_stop` |
| 判停后同一步释放、再打结果 | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py`，`update_from_output`、`_free_request`、`_free_blocks` |
| 外部中止 | 同文件 `finish_requests`；`vllm/v1/engine/core.py`，`abort_requests`、`_process_aborts_queue` |
| 前端中止、断开 | `vllm/v1/engine/async_llm.py`，`generate`、`abort`；`vllm/entrypoints/serve/utils/api_utils.py`，`with_cancellation` |
| 前端删记录 | `vllm/v1/engine/output_processor.py`，`process_outputs`、`_finish_request`、`abort_requests` |
| DP 路由表 | `vllm/v1/engine/core_client.py`，`DPLBAsyncMPClient` |
| worker 删行 | `vllm/v1/worker/gpu_model_runner.py`，`_update_states`；昇腾 `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py` |
| 还块、清空前缀缓存 | `vllm/v1/core/kv_cache_manager.py`，`free`；`single_type_kv_cache_manager.py`，各组 `free`；`block_pool.py`，`free_blocks`、`reset_prefix_cache` |
| 抢占 | `scheduler.py`，`_preempt_request` |

**读源码的顺序。** 先看 `_free_request`，它是所有结束路径的汇合点：往上追两个调用方，`update_from_output` 是引擎判停，`finish_requests` 是外部中止；往下追 `KVCacheManager.free` 到 `BlockPool.free_blocks` 看块怎样回队列。前端从 `AsyncLLM.generate` 的异常分支和 `OutputProcessor.process_outputs` 末尾的收尾段读起。

**正文证据归档。** 判停条件和先后 [C5]；语法拒绝记 error [C3]；判停的同一步释放、随后才打结果 [C4]；释放时记清单、connector 推后、还块与删请求表项 [C2]。外部中止跳过不认识或已结束的 ID、移出两条队列 [C1]；中止进两个队列、前向算完先处理 [C8]；在途结果跳过 [C10]。

前端：取消即中止、引擎已死不中止、意外异常先中止 [C11]；先删前端记录再发引擎 [C12]；停止字符串进中止名单 [C13]；补一份 abort 结果、子请求一起中止 [C14]；断开的两种检测方式 [C16]；按路由表发中止 [C18]。worker：清单不空就再走一步 [C22]；删缓存状态、批次行与未排上请求的移出均在同文件（来源 23、24）。

还块：计数减到 0 才回队列 [C29]；滑动窗口组没有指纹登记的块插队头 [C28]；清空前缀缓存要求除 null 占位块以外的块都空闲 [C30]。抢占保留请求、清零计算进度 [C33]；重新调度时匹配本地及外部缓存 [C71]；已确认输出加入已知编号历史 [C72]。先排下一步、再处理上一步 [C34]；长度到限不多排 [C35]。

示意例子的块号、计数和队列变化，由「计数减 1、倒着还、减到 0 排队尾」三条规则推出 [D]；R1 多排一步、worker 要等再下一份清单，由先排后处理和长度预判两条规则推出 [D]。抢占恢复的 150 个已知编号示意同时使用「输入和已确认输出仍在、计算进度清零、没有可复用 KV」三个条件；它计算恢复输入的范围，不将每个位置都算成重复工作 [D]。R1 的 16–17 块取自 one-request 的推导 [D]。官方部署不配 KV connector，依据部署页的启动参数表 [I]；停止字符串比停止 token 多算一两步，由前端发现和中止生效的时机推出 [I]。

**待核。**

- 官方教程完整启动命令里有没有请求日志和 KV connector 相关参数：本页按部署页整理的参数表判断两者都没有。
- 异步调度下每条请求收尾时多算的那一步，在 GLM 双机上实际占掉多少吞吐：本页由源码推出多排一步，没有实测。
- 本部署断开、中止和停止字符串三条路从前端发现到引擎还块的实际时长。
- vllm-ascend v0.26 上普通抢占、强制重置、异步调度与具体 KV connector 组合的设备运行时序：上文已按固定源码区分保留与丢弃，尚无设备日志验证该组合的输出顺序和回收时延。
- 释放后的块被在途那一步继续写入、又被新请求借走时的先后保证：上游 v0.26 的注释说明没有 connector 时不需要推后，v0.23 的依据没有单独找到。

- 来源 47、48：vllm@568afb3a，vllm/v1/core/sched/scheduler.py，L148–L154、L2248–L2261。
- 来源 49：vllm@0fc695fc，vllm/v1/core/sched/scheduler.py，L1873–L1884。
- 停止参数证据索引：50–54 是基线字段、None/字符串归一化、合法范围和模型 EOS 合并；55–57 是 V1 反分词、停止编号的显示裁切、文字匹配及前端 finish_reason/stop_reason 更新。58–59、69–70 是新版两接口的默认停止编号合并；60 是 main 按最早结束位置选停止串；61 是新增编号边界校验；62–63 是 HTTP stop 条数与环境默认；64 是 main 判停顺序；65–68 对照新版反分词最少长度和 EOS 合并。上述来源只证明固定源码路径，不是 GLM 真机输出实测。
