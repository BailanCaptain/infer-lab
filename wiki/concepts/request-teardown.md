---
id: request-teardown
title: "请求收尾：一条请求结束或被中止后，它占的东西怎样一件件还回去"
type: concept
summary: 请求收尾是一条请求停下后，前端、引擎和 worker 各自删掉为它存的记录、还回它对 KV 块的引用。先分清引擎判停、停止字符串、客户端断开、出错四条路谁先动手，再分清还块（引用计数减 1）和清空前缀缓存（抹掉全部登记），最后看 GLM 双机上 R1 结束时还了什么。
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
chapters: ["09"]
order: 80
sources:
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1825-L1886
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1888-L1910
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1440-L1477
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1518-L1580
  - vllm@0fc695fc:vllm/v1/core/sched/utils.py#L94-L130
  - vllm@0fc695fc:vllm/v1/request.py#L330-L360
  - vllm@0fc695fc:vllm/v1/engine/core.py#L378-L384
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1535-L1540
  - vllm@0fc695fc:vllm/v1/engine/core.py#L600-L608
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1393-L1407
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L588-L636
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L709-L721
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L672-L690
  - vllm@0fc695fc:vllm/v1/engine/output_processor.py#L450-L510
  - vllm@0fc695fc:vllm/v1/engine/output_processor.py#L666-L708
  - vllm@0fc695fc:vllm/entrypoints/serve/utils/api_utils.py#L37-L90
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L1440-L1446
  - vllm@0fc695fc:vllm/v1/engine/core_client.py#L1505-L1525
  - vllm@0fc695fc:vllm/v1/engine/core.py#L911-L936
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1619-L1635
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L938-L946
  - vllm@0fc695fc:vllm/v1/core/sched/interface.py#L171-L188
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1135-L1150
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1166-L1180
  - vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L748-L763
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L438-L446
  - vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L363-L378
  - vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L751-L765
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L419-L442
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L462-L481
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1943-L1962
  - vllm@0fc695fc:vllm/entrypoints/openai/api_server.py#L197-L200
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995
  - vllm@0fc695fc:vllm/v1/engine/core.py#L484-L503
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L383-L395
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2576-L2594
  - vllm@0fc695fc:vllm/entrypoints/openai/engine/serving.py#L191-L198
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L2207-L2262
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L128-L154
  - vllm@84030bbe:vllm/v1/core/sched/scheduler.py#L2569-L2601
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L1-L9
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L1240-L1246
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L34-L46
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L716-L724
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1363-L1366
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - {to: one-request, kind: builds-on, note: 第 7 站讲了 R1 长度到限的那一圈和归还 16–17 个块号的账；本页把收尾拆成前端、引擎、worker 三处各删什么}
  - {to: streaming-output, kind: builds-on, note: 停止字符串怎样被发现、最后一个片段怎样推出在那一页；本页接着讲发现之后怎样通知引擎、谁先还}
  - {to: vllm-kv-block-allocation, kind: builds-on, note: 引用计数、空闲队列、各组倒序还块在那一页；本页只用到「计数减到 0 才回队列」和它与清空前缀缓存的区别}
  - {to: request-call-chain, kind: builds-on, note: API server、EngineCore、worker 三种进程和它们之间的通道在那一页；本页讲收尾时每种进程删掉什么}
  - {to: api-server-entry, kind: builds-on, note: 请求进门时登记的前端记录和输出槽在那一页；本页讲它们在结束时怎样被删}
  - {to: prefix-caching, kind: builds-on, note: 块的登记和驱逐在那一页；本页区分还块和清空前缀缓存这两个动作}
  - {to: async-scheduling, kind: builds-on, note: 调度器先排下一步再处理上一步结果；本页讲这让收尾时多算一步、通知 worker 晚一步}
  - {to: concurrent-requests, kind: builds-on, note: 池子不够时抢占的整批推导在那一页；本页只讲抢占和收尾的区别}
contradicts: []
updated: "2026-10-02"
origin: seed
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
| 抢占（preemption：块不够时把一条在跑的请求请出去） | 全部减 1 | 留着，已算位置清零 | 退回等待队列头，以后从头重算 |
| 清空前缀缓存 | 不动 | 不动 | 抹掉所有块的指纹登记；还有块被引用就失败 |
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

**停止字符串。** 前端还原文字时发现了它：截掉停止字符串，把这份结果（结束原因 stop）放进输出槽，删掉 A 的记录。这时 A 在引擎里还在 running 队列里，前端把它的 ID 记进「要中止」的名单，这一批结果处理完就发一条中止消息（abort）。引擎收到后才释放、还块。

**客户端断开。** 前端怎么知道客户端走了：非流式请求，服务一边跑处理函数、一边监听连接上的断开消息，哪个先完成就取消另一个；流式请求由推送响应自己监听连接，断开时取消正在推片段的那个任务。两种取消最后都落到为 A 取结果的生成函数里：它先在前端中止 A（删记录，往输出槽放一份结束原因为 abort 的结果），再把 A 的 ID 发给引擎。请求一次要了几个回答（n 大于 1）时，几个子请求一起中止。

这两条路上，从前端发现到引擎释放之间，引擎照常在跑。已经在卡上为 A 算的那一步，结果回来时 A 已经被中止，这份结果直接丢掉，不再发回前端。

### 中止消息晚到、重复到，都不出错

- **引擎这边处理两次也没事。** 中止消息到达后同时放进两个队列。一个是专门的中止队列，引擎每一步前向算完、处理结果之前先清它，这样释放得最早；另一个是普通消息队列，中止按到达顺序排在「加入请求」这类消息后面。如果这条请求的「加入」消息还排在普通队列里没处理，提前清的那一次查不到它；排在后面的这一次等它加入以后再删，不会漏掉。同一个 ID 因此会被处理两次，后处理的那次查不到或发现已经结束，直接跳过。
- **前端只发它还记着的。** 已经删掉记录的 ID 不再发。两个 DP 组（两套各自独立调度的执行组）时，前端用一张路由表记每条在途请求在哪一组，中止按表只发给那一组；请求结束时，引擎把「这批里结束了哪些」一起发回来，前端从表里删掉，之后再来的中止就查不到、不发。
- **等待中的请求也能中止。** 它从等待队列里被删掉；不用 KV connector 时它还没借过块，还块这一步什么也不做。用 connector 时，正在等远端 KV 传进来的请求手里已经有块，传输没完成就要推后还块。
- **引擎整个挂掉时不发中止。** 前端直接报错，不再往一个已经不在的进程发消息。

### 出错：结束原因记 error

引擎判出错后，和正常判停走同一条路：同一步里释放、还块，结束原因记 error 发回前端；语法拒绝 token 本该被屏蔽表挡住，真发生时还会打一条以 Unexpected 开头的 error 级日志。用了 KV connector（把 KV 在机器之间传送的组件）的部署，远端 KV 加载失败时，按默认的「直接失败」策略，请求也这样以 error 结束。前端收到 error，把它报成服务器内部错误：流式请求这时已经回过「成功」的状态码，只能往流里写一个错误片段，见[流式输出「会报什么错」](streaming-output.md#会报什么错)。

## 还块：计数减到 0 才回池子，清空前缀缓存是另一回事

**还块只是把这条请求对每个块的引用减 1：减到 0 的块排回空闲队列，块里的数据、以及开着 prefix caching 时块的指纹登记都还留着。清空前缀缓存是另一个动作：一次抹掉所有块的指纹登记，让以前算过的开头再也查不到。**

每个块身上记着一个引用计数，表示现在有几条请求在用它；借出时从 0 变 1，几条请求共用时大于 1。池子、空闲队列和计数的来龙去脉见 [KV 块分配](vllm-kv-block-allocation.md#请求要存-kv-时块从哪里来用完去哪里)。收尾时，引擎把这条请求手里的块倒过来逐个交回：

```calc
title: A 结束时三个块怎样还（示意）
A 手里的块（借的顺序） = 块 9、块 2、块 5
交回的顺序（倒过来） = 块 5、块 2、块 9
块 5 的计数 = 1 − 1 = 0，排回空闲队列尾
块 2 的计数 = 1 − 1 = 0，排回空闲队列尾
块 9 的计数 = 2 − 1 = 1，B 还在用，不回队列
空闲块数 = 4 + 2 = 6 块
> 空闲队列从 3、4、6、7 变成 3、4、6、7、5、2
```

为什么倒着还：空闲队列从队头往外借，排在前面的块先被借走。倒着还，一条序列的尾巴排在前面、开头排在后面；开着 prefix caching 时，开头那几块最常被别的请求共用，这样留得最久，驱逐顺序见 [prefix caching「池子满了怎么办」](prefix-caching.md#池子的预算怎么分满了怎么办)。只记最近几个位置的那类缓存组（滑动窗口）是例外：没有指纹登记的块直接插回队头，先被重用。

**还块不等于抹指纹登记。** 开着 prefix caching 时，写满的块会登记一个「内容指纹」，也就是前面说的**指纹登记**；后来开头相同的请求按指纹查到它就能直接复用。它和上面引擎里的请求表项是两回事：请求表项属于请求，结束就删；指纹登记属于块，跟着块走。A 还掉块 5、块 2 以后，两块计数是 0、排在队里，指纹登记还在：在被队头取走之前，开头相同的新请求仍能命中它们、把它们从队里捡回来；真被借给别人写新内容时，旧的指纹登记才抹掉，这叫驱逐，见[引用计数什么时候大于 1](vllm-kv-block-allocation.md#引用计数什么时候大于-1共享登记与驱逐)。

**清空前缀缓存（reset prefix cache）** 一次把所有块的指纹登记抹掉，以后谁也命中不了以前算过的开头。它用在模型权重换过以后（旧的 KV 已经不对了），或者做性能测试时想从「什么都没缓存」开始量。它有个前提：池子里所有块的计数都已经是 0。接着上面的例子，A 结束后 B 还在跑，块 9 的计数是 1，这时清空会失败，只打一条警告；要等 B 也结束，或者清空时要求先把所有在跑的请求抢占掉（让出块、退回等待队列）再清。这个操作有 HTTP 接口，但只在开发模式下才注册。

**有时块要晚一点还。** 用了 KV connector 的部署里，请求结束时它的 KV 还要交给别处：比如 [PD 分离](pd-disaggregation.md)（prefill 和 decode 交给两组机器）时，prefill 那边要先把 KV 发给 decode 那边。这时连接器会要求先别还块，请求已经算结束，ID 也进了「已结束」清单，但还块和删请求表项要等发完才做。

## 收尾的最后两步：worker 删行，前端更新路由表

**引擎释放以后还有两处要跟上：worker 批次表里那一行，要等下一份调度清单才删；有两个 DP 组时，前端的路由表和组间的负载计数也要把这条请求减掉。**

**worker 晚一步删。** 引擎每一步发给 worker 一份调度清单，写着这一步算哪些请求、各算几个 token，其中有一栏是「上一步以来结束了哪些请求」。worker 准备这一步的输入时先看这一栏：把这些请求的缓存状态（提示词编号、采样参数、块号表等）删掉，再把它们从批次表里移走。接着示意例子：A 在第 k 步结果更新时释放，ID 记进「已结束」清单；第 k+1 步调度时清单发出，每张卡上的 worker 各删掉 A 那一行，清单随即清空。

如果 A 是最后一条请求，引擎也不会就此停住：只要「已结束」清单不空，它就认为还有事要做，再调度一次，把清单送到 worker。

**两个 DP 组时，前端和协调器也要跟上。** DP（数据并行）把服务分成几套各自独立调度的执行组。前端为了把中止发对组，给每条在途请求记了它在哪一组；引擎每次发回结果时，顺带写上「这批里结束了哪些请求」，前端据此从表里删掉。另外，各组引擎会把自己 running、waiting 的条数报给 DP 协调器（汇总各组负载的小进程），协调器再推给前端，用来给新请求挑组；一条请求结束，它所在那一组报上去的 running 就少 1，见 [DP 选组的计数表](dp-request-routing.md#计数表从哪来为什么会过时)。

## 抢占不是收尾：块还了，请求还在

**抢占（preemption）也把一条请求的块全部还回池子，但请求本身没有结束：它的请求表项留着，已算位置清零，它退回等待队列，以后从头重算。前端什么也不知道，客户端看到的只是流停了一阵。**

池子不够时调度器请出哪一条、被请出的那条状态怎样改、这一步还排不排新请求，见[池子不够时宁可抢占](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)。和收尾相同的只有还块：用的是同一个还块动作。不同在三处：

- **请求表项留着。** 收尾删掉请求表项；抢占只把它的状态改成「被抢占」、已算位置清零。
- **不进「已结束」清单。** worker 不删它的缓存状态，只是这一步的清单里没有它，就先把它从批次表里移出；等它重新被排上，再按留着的状态、换上新借的块号放回批次表。
- **前端照旧等着。** 引擎不发结束原因，前端的记录和输出槽都留着；流式客户端看到的只是片段停了一阵，重算完又接着来。

重算是抢占的主要代价。示意：A 的提示词 100 个 token、已经生成 50 个，被抢占后重新排上时，这 150 个位置要像提示词一样整段重算一遍，才接着生成第 51 个。

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

## 落到 GLM 双机：R1 结束时，三处各还了什么

**R1 在 DP0 上以长度到限结束：node0 上 DP0 的引擎在判停的同一步还掉 16–17 个块号，node0 上唯一的前端删记录、推完最后一个片段，DP0 的 8 个 worker 晚一步删行。prefix caching 关着，还块就是计数 1 → 0，没有指纹登记可抹。**

部署按[官方双机](glm-5-3-flash-two-node.md#部署前提)：两台机器各是一个 DP 组，node0 上一个前端接下全部请求。R1 是主线的示例请求，套完模板、分词后 4 个 token，被派到 DP0（见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)）。收尾沿用[第 7 站](one-request.md#第-7-站-返回与收尾)的设定：max_tokens 是 200，最后一圈之前已输出 197 个，这一圈验证又产出 4 个，引擎接到第 200 个时判长度到限，只把前 3 个发给前端。GLM 的三个结束 token 怎样判停，见 [sampling「停止判断和长度上限」](sampling.md#停止判断和长度上限)。

**引擎（node0，DP0 的 EngineCore）。** 判停的同一步释放 R1：移出 running 队列，ID 记进「已结束」清单，还块，删请求表项。R1 手里是 full 组 1 块、KDA 组 12 块、尾状态组 3–4 块，共 16–17 块，怎么数出来的见第 7 站。各组倒着交回：full 组和 KDA 组的块排回空闲队列尾；尾状态组按滑动窗口管理，它的块没有指纹登记，插回队头，细节见[结束：16–17 块一次还清](vllm-kv-block-allocation.md#结束1617-块一次还清)。

- **没有指纹登记可抹。** GLM 是同时有注意力层和递推状态层的混合模型，prefix caching 默认关着（见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)），块从没登记过指纹。还块对它来说就是计数 1 → 0、排回队列，「还块」和「清空前缀缓存」在这套部署里没有交集。
- **不推后还块。** 官方部署没有配 KV connector，块在判停的同一步就还，不等任何传输。
- **多排了一步。** 本部署开着异步调度。R1 最后一圈之前已有 197 个输出，就算这一圈候选全被拒也只到 198 个，调度器不能确定它到限，于是下一步照样给 R1 排了位置；那一步的结果回来时 R1 已经释放，直接跳过。

**worker（node0 的 8 张卡）。** R1 所在的 DP0 由 node0 上 8 个 worker 一起算，每个 worker 都有一张批次表。因为开着异步调度，紧接着的那份调度清单在判停之前就已经发出，「R1 已结束」要等再下一份清单才送到，8 个 worker 各删一行。node1 上 DP1 的 worker 从没见过 R1，不受影响。

**前端（node0 的 API server）。** 收到 R1 的 3 个新 token 和结束原因 length，还原最后一段文字，删掉 R1 的记录；HTTP 任务推出带 length 的最后一个片段，再发 [DONE]，见[流式输出的收尾一节](streaming-output.md#收尾长度到限再归还块号)。引擎这次发回的结果里写着 R1 已结束，前端把它从路由表里删掉。DP0 报给协调器的 running 少 1，两台机器什么时候一起停下，见第 7 站末尾。

**如果 R1 是被中止的。** 设客户端在第 20 个 token 时断开：前端先删记录，中止消息按路由表只发给 DP0；DP0 在下一份结果处理之前释放 R1，还的块数按当时的已算位置算，规则同上。断开和中止的日志默认不打印，要打开请求日志才有，部署页整理的启动参数里没有这一项。

**抢占在这套部署里很贵**，为什么贵、被请出的那条要重算多少，见[多条请求的 KV 块一节](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)。

## 常见误解

- **「客户端断开以后，引擎自己会发现、停下来。」** 引擎和客户端之间没有连接，只和前端之间有消息通道。断开只有前端知道，必须由前端发中止消息，否则引擎会把剩下的 token 照样算完。
- **「引擎判停后，要等前端把最后一段文字推出去才还块。」** 顺序反过来：引擎在判停的同一步先还块，再把结果发给前端。只有停止字符串和客户端断开是前端先动手、引擎后还块。
- **「请求结束了，它的块就全回到空闲队列。」** 只有计数减到 0 的块才回去；和别的请求共用的开头块还留在别人手里。用了 KV connector 时，块还要等 KV 发走才还。
- **「还块就等于清空了前缀缓存。」** 还块只把计数减 1，块的指纹登记还在，开头相同的新请求还能命中它；清空前缀缓存才抹指纹登记，而且要所有块都空闲才做得成。
- **「中止消息发两次，或者发给一条已经结束的请求，会报错。」** 引擎查不到这个 ID、或者发现它已经结束，就直接跳过；前端也只发它还记着的 ID。
- **「抢占就是让请求提前结束。」** 抢占只还块，请求表项还在、前端也不知道，它退回等待队列，以后从头重算再接着生成。
- **「worker 在请求结束的那一步就删掉它那一行。」** worker 要等下一份调度清单写明它已结束才删；开着异步调度时，紧接着的那份清单已经提前发出，还要再晚一份。

## 对照源码

### 怎么开

收尾不是一个开关，每条请求都会走。和它相关、能调的是这些：

- `--enable-log-requests`：默认关。打开后，中止、引擎已死、意外异常这些收尾路径才打日志。
- `--enable-prefix-caching`：打开后还块才涉及指纹登记和驱逐；GLM 这类混合模型不写时取默认的关。
- `--async-scheduling` / `--no-async-scheduling`：决定判停时下一步是不是已经排好。默认留空，由启动检查决定。
- `VLLM_SERVER_DEV_MODE=1`：开发模式下才注册 `POST /reset_prefix_cache`；带 `reset_running_requests=true` 时先抢占所有在跑的请求再清。
- 请求参数：`max_tokens`、`min_tokens`、`stop`、`stop_token_ids`，以及采样参数里的 `repetition_detection`，决定引擎和前端在哪一步判停。

### 会报什么错

收尾本身不报错，下面是收尾路径上会打的日志，原文与 `vllm@0fc695fc` 一致：

- `Request %s aborted.`（`vllm/v1/engine/async_llm.py#L595`，info）：为这条请求取结果的生成函数被取消，通常是客户端断开；前端已中止它并通知引擎。只在打开请求日志时打印。
- `Aborted request(s) %s.`（同文件 `#L721`，info）：`abort` 处理完一批 ID，前端和引擎两边都已发出中止。同样只在打开请求日志时打印。
- `Request %s failed (engine dead).`（同文件 `#L601`，info）：引擎进程已经不在，前端不发中止，直接把错误往上抛。只在打开请求日志时打印。
- `Request %s failed due to %s.`（同文件 `#L631`，info）：生成函数里出了意外异常，前端先中止这条请求，再抛出 `EngineGenerateError`。只在打开请求日志时打印。
- `Unexpected: grammar rejected tokens %s for request %s. Terminating request.`（`vllm/v1/core/sched/scheduler.py#L1469-L1473`，error）：结构化输出的语法拒绝了刚采出的 token，请求以 error 结束，同一步释放。
- `Request %s failed with an internal error during generation`（`vllm/entrypoints/openai/engine/serving.py#L195-L197`，error）：前端收到结束原因 error，按内部错误回给客户端。
- `Failed to reset prefix cache because some blocks (%d) are not freed yet`（`vllm/v1/core/block_pool.py#L473-L477`，warning）：清空前缀缓存时还有块被引用，没有清。

### 开销和什么时候别开

- **收尾本身很轻**：只是 CPU 上的记账，中止按批处理，一次清掉一批 ID。
- **异步调度多算一步**：以结束 token 或停止 token 结束的请求，结束后还会在已经排好的下一步里占一次位置；GLM 双机上就是 1 个确定 token 加 3 个候选的位置。长度到限能预判，不多排。
- **停止字符串比停止 token 贵**：要等前端还原文字才发现，再走一次中止消息，引擎这期间多算一两步。能用停止 token 表达的结束条件，用停止 token，引擎当步就停。
- **调用方超时别设太短**：超时断开会触发中止，前面已经算过的 token 全部作废。
- **线上别随手清空前缀缓存**：之后的请求要从头算开头；带强制参数时会抢占所有在跑的请求。GLM 默认没开 prefix caching，没有可清的指纹登记。
- **压测时关掉请求日志**：每条请求多打几行 info。

### 版本差异

上游 vLLM（v0.23 = `vllm@0fc695fc`，v0.26 = `vllm@568afb3a`，main = `vllm@84030bbe`）：

| 项 | v0.23 | v0.26 | main |
| --- | --- | --- | --- |
| 判停或中止 → 记进已结束清单 → 还块 → 删请求表项 | 有 | 同 v0.23；释放函数另返回编码侧 connector 的参数 | 同 v0.26 |
| 有 KV consumer connector、又有多批在途（异步调度或流水线并行）时推后还块 | 没有 | 有：在途那一步处理完才把块交回池子，因为 connector 往块里加载 KV 和在途那一步的写入没有先后保证 | 同 v0.26 |
| 中止进两个队列、前向算完先处理；在途结果跳过 | 有 | 同 v0.23 | 同 v0.23 |
| 断开检测、生成函数被取消即中止、上面几条日志原文 | 有 | 同 v0.23 | 同 v0.23 |
| 清空前缀缓存要求所有块空闲 | 有 | 同 v0.23 | 同 v0.23 |

没有 KV connector 的部署（包括本部署）三版的收尾行为一致。

vllm-ascend（v0.23 = 维护分支 `2c59ff10`，不含 GLM 代码；`db701c1f` = 含 GLM 代码的快照；v0.26 = `2ed6cbba`；main = `baa023ad`）：

| 项 | v0.23 维护分支 | db701c1f | v0.26 | main |
| --- | --- | --- | --- | --- |
| 调度器的收尾路径 | 用上游；可选的均衡调度另写了清空前缀缓存，默认不开 | 用上游 | 整个调度器类换成 `KVDeliveryScheduler`，回移上游两项改动（被抢占请求的在途结果不丢、KV 可靠交付），改写抢占、结果更新和清空前缀缓存；判停后的释放函数沿用上游 | 用上游；可选的 DyntraLB 调度器改写释放函数，默认不开 |
| worker 删行 | 先做异步调度下的回退保护，再转交上游，删行由上游做 | 同 v0.23 | 同 v0.23 | 同 v0.23，转交前另处理流水线并行的采样结果和块拷贝 |
| 可选的批任务感知调度器 | 没有 | 没有 | 有，改写释放函数，要显式开 | 同 v0.26 |

v0.26 换调度器类以后，没有 KV connector 时判停、中止和还块的顺序与上游一致；被抢占请求的在途结果怎样处理，以那一版的 `_preempt_request` 为准，见下方待核。

### 源码位置

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

前端：取消即中止、引擎已死不中止、意外异常先中止 [C11]；先删前端记录再发引擎 [C12]；停止字符串进中止名单 [C13]；补一份 abort 结果、子请求一起中止 [C14]；断开的两种检测方式 [C16]；按路由表发中止 [C18]。worker：清单不空就再走一步 [C22]；删缓存状态和批次行 [C23]；没排上的只移出批次 [C24]。

还块：计数减到 0 才回队列 [C29]；滑动窗口组没有指纹登记的块插队头 [C28]；清空前缀缓存要求全部空闲 [C30]。抢占 [C33]；先排下一步、再处理上一步 [C34]；长度到限不多排 [C35]。

示意例子的块号、计数和队列变化，由「计数减 1、倒着还、减到 0 排队尾」三条规则推出 [D]；R1 多排一步、worker 要等再下一份清单，由先排后处理和长度预判两条规则推出 [D]；抢占后连已生成的 token 一起重算，由已算位置清零推出 [D]；R1 的 16–17 块取自 one-request 的推导 [D]。官方部署不配 KV connector，依据部署页的启动参数表 [I]；停止字符串比停止 token 多算一两步，由前端发现和中止生效的时机推出 [I]。

**待核。**

- 官方教程完整启动命令里有没有请求日志和 KV connector 相关参数：本页按部署页整理的参数表判断两者都没有。
- 异步调度下每条请求收尾时多算的那一步，在 GLM 双机上实际占掉多少吞吐：本页由源码推出多排一步，没有实测。
- 本部署断开、中止和停止字符串三条路从前端发现到引擎还块的实际时长。
- vllm-ascend v0.26 的 `KVDeliveryScheduler` 在没有 KV connector 时，被抢占请求的在途结果是保留还是丢弃：本页只核了它替换了哪些方法，没有逐行读改写后的抢占和结果更新。
- 释放后的块被在途那一步继续写入、又被新请求借走时的先后保证：上游 v0.26 的注释说明没有 connector 时不需要推后，v0.23 的依据没有单独找到。
