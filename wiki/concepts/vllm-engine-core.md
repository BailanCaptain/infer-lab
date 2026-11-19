---
id: vllm-engine-core
title: EngineCore：vLLM 里一圈一圈推着请求往前走的循环
type: concept
summary: >-
  EngineCore 是 vLLM 里专门跑「收消息 → 调度 → 交出执行 →
  按结果更新」循环的核心，归属同一 EngineCore 的请求共用循环，转一圈叫一步；它默认单独占一个进程，让前端收发和后端计算互不阻塞。本页讲一圈的顺序、一圈交回几个
  token、空闲与取消、批次队列，以及 GLM 双机上两个 EngineCore 怎样逐圈推进 R1。
aliases:
  - busy loop
  - 忙循环
  - 引擎循环
  - 引擎核心
  - engine step
  - EngineCoreProc
  - run_busy_loop
  - step
  - step_with_batch_queue
  - batch queue
  - 批次队列
chapters:
  - '10'
order: 20
sources:
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1223-L1262'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L443-L473'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L484-L598'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L188-L220'
  - 'vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1393-L1407'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1211-L1217'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1264-L1281'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1515-L1543'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L600-L608'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1900'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L497-L507'
  - 'vllm@0fc695fc:vllm/config/vllm.py#L931-L1002'
  - 'vllm@0fc695fc:vllm/v1/core/sched/output.py#L112-L120'
  - 'vllm@0fc695fc:vllm/v1/core/sched/output.py#L181-L215'
  - 'vllm@0fc695fc:vllm/v1/engine/__init__.py#L83-L92'
  - 'vllm@0fc695fc:vllm/v1/engine/__init__.py#L170-L185'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L474-L482'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L1414-L1417'
  - 'vllm@0fc695fc:vllm/engine/arg_utils.py#L343-L345'
  - 'vllm@0fc695fc:vllm/config/scheduler.py#L146-L146'
  - 'vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L511-L513'
  - 'vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L19-L36'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L819-L841'
  - 'vllm@0fc695fc:vllm/v1/engine/core.py#L1984-L1990'
  - 'vllm@568afb3a:vllm/v1/engine/core.py#L576-L615'
  - 'vllm@568afb3a:vllm/v1/engine/core.py#L2015-L2022'
  - 'vllm@568afb3a:vllm/config/scheduler.py#L153-L153'
  - 'vllm@568afb3a:vllm/config/vllm.py#L1108-L1111'
  - 'vllm@84030bbe:vllm/v1/engine/core.py#L1403-L1413'
  - 'vllm@84030bbe:vllm/config/vllm.py#L1332-L1394'
  - >-
    vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L688-L692
  - >-
    vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L661-L666
  - 'vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L69-L73'
  - >-
    vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L950-L959
  - 'vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_engine_core.py#L32-L73'
  - >-
    raw:sha256-3a52087c588e5a77b6d45b6cfdc4ea40ca0f179c50f352fa0a3ce4824042b3e2.md#L1-L848
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/engine/core.py#L472-L472
  - >-
    vllm@0fc695fc6d1d82e9a5ac6835ac8e4e1c83703665:vllm/v1/engine/core.py#L1264-L1279
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L584-L619'
  - 'vllm-ascend@7d825229:vllm_ascend/patch/platform/patch_engine_core.py#L32-L56'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L630-L710'
  - 'vllm@ced6857a:vllm/v1/engine/core.py#L1403-L1425'
  - 'vllm@ced6857a:vllm/config/vllm.py#L589-L610'
  - 'vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_engine_core.py#L32-L74'
  - 'vllm@ba15685a:vllm/v1/engine/core.py#L709-L800'
  - 'vllm@ba15685a:vllm/v1/engine/core.py#L1764-L1785'
  - 'vllm@ba15685a:vllm/config/vllm.py#L616-L635'
  - 'vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_engine_core.py#L31-L68'
verified:
  - releases/v0.23.0
  - releases/v0.26.0rc
  - releases/v0.30.0
  - main
evidence: C
relations:
  - to: vllm-v1-shape
    kind: builds-on
    note: 组件分工和两道边界上每一圈交接什么在那一页，本页只展开 EngineCore 这个循环本身
  - to: request-call-chain
    kind: builds-on
    note: 进程、类、函数调用链与每步两次 RPC 只在那一页展开，本页只讲循环的顺序和分支
  - to: async-scheduling
    kind: builds-on
    note: 批次队列打开后占位怎样记账、时间上怎样叠
  - to: concurrent-requests
    kind: builds-on
    note: 多条请求挤进同一圈、空闲的 DP 组陪跑
  - to: ascend-config-version-source
    kind: builds-on
    note: >-
      EngineCore 页对动态分块入口补丁适用条件的说明，以来源摘要核对的配置开启门槛为依据：动态分块要求 PP 大于
      1，且不能与均衡调度同时开启。
contradicts: []
updated: 2026-11-10T00:00:00.000Z
origin: gap
rawSources:
  - >-
    raw/sha256-3a52087c588e5a77b6d45b6cfdc4ea40ca0f179c50f352fa0a3ce4824042b3e2.md
  - >-
    raw/sha256-95d5af7e0acf264a6d2c150ad45f823fc21dad0e1f5cd55177169e3f73f7398e.md
---

## EngineCore 是什么：谁在一圈一圈地推着请求往前走？

**EngineCore 是 vLLM 里专门跑一个循环的核心：每转一圈，先收下新到的请求，再让调度器排出这一步算什么，交给 Worker（每张卡一个的执行进程）在卡上算一次，最后按结果更新每条请求，然后接着转下一圈。转一圈叫一步（step）。归属同一个 EngineCore 的生成请求共用这一个循环；vLLM 默认让它单独占一个进程。**

大模型写回答是一点一点往后写的：算一次模型，每条请求最多多出几个 token，再拿新写出的 token 接着算。一条回答要反复算很多次，而同一时刻往往有很多条请求都写到一半。总得有个东西不停地转：看看谁在等、谁还没写完，安排这一次算谁，算完把结果分回各条请求。EngineCore 就是这个转圈的东西。

共用循环可以把多条请求凑在一起计算，也让前端收发与后端执行同时推进。代价是各处要通过消息交接、分别维护请求状态；新请求不能插进已经发出的计算，取消也要等这一批算完再丢弃结果。批次队列还能增加重叠，但需要给尚未返回的结果先记占位。

```wiki-diagram
file: engine-core-loop
```

图里 EngineCore 进程中的四格就是一圈：

1. **收消息。** 前端（API server：接 HTTP 请求、把文字切成 token 编号的那个进程）送来的新请求，进入调度器的等待队列；用户断开连接之类的取消消息，以及其他控制消息，也在这里收下。
2. **调度。** Scheduler（调度器）决定这一步让哪些请求上、每条算几个位置、这些位置的 KV cache 写进哪些块，写成一份计划。KV cache 是模型为每个已算位置留下的注意力中间结果，后面的位置要反复读它；它按固定大小的块存放，每块有一个块号。
3. **交出执行、等结果。** 计划交给各张卡上的 Worker，由它们准备输入、跑模型、采样出新 token；EngineCore 等它们交回每条请求的新 token 编号。
4. **按结果更新。** 把新 token 接到各条请求后面，检查谁碰到了结束条件；结束的请求把块号还回去。新 token 编号送回前端，由前端还原成文字推给用户。

举个例子。你问了一句很短的话，切成 3 个 token，这条请求记作 R；模型的回答是 2 个 token，第 2 个是结束记号。第 1 圈，调度器让 R 把 3 个位置一次算完，交回回答的第 1 个 token；第 2 圈只算 1 个位置，也就是上一圈刚交回的那个 token，交回结束记号，R 完成。循环为它转了 2 圈。

本例第 1 圈完成提示词处理，属于 [prefill](prefill.md) 阶段；更长的提示词可以分多圈完成。之后继续生成的阶段叫 decode。循环本身不分这两种：每一圈走的是同样的四格，差别只在调度器这一圈给这条请求排了几个位置，见 [Scheduler](vllm-scheduler.md#一步要算哪些请求各算几个-token谁来定)。

如果 R 算到第 2 圈时又来了一条请求，它不会另开一个循环，而是在下一圈开头被收下，和前一条挤进同一圈，拼成一批一起算。所有请求共用一个循环，是理解 EngineCore 最要紧的一点。

## 为什么要一个共用的循环，还单独放进一个进程？

这是两个问题，分开回答。

**为什么请求共用一个循环。** 算一次模型有一些可以由多条请求分摊的成本，例如调用、算子下发与权重读取。4 条请求各差 1 个位置时，放进同一圈可让 4 行输入共用同一张权重，增加批内复用机会；分 4 次调用则重复组织计算。实际 HBM 读取次数取决于缓存与内核分块，MoE 还只涉及本轮选中的专家，不能按“整份模型每轮读一次”计实流量。vLLM 让同一 EngineCore 的调度器每圈把能一起算的请求凑成一批；为何还要限制一圈最多几条请求，见 [Scheduler](vllm-scheduler.md#为什么按-token-设预算还要另设请求数上限)。

**为什么放进单独的进程。** 服务里除了算模型，还有很多 CPU 上的杂活：接 HTTP 连接、套聊天模板、分词、把新 token 还原成文字、一段一段推给用户。进程是操作系统里独立运行的一份程序，有自己的内存，也各自占用 CPU 时间。杂活放在前端进程里做，EngineCore 进程只转那个循环，两边就能同时干活：

- 卡上正在算 A、B 这一圈的时候，C 到了。前端马上接住、分好词，把请求消息发给 EngineCore；EngineCore 进程里一个专管收消息的后台线程把它放进输入队列。这一圈结束、下一圈开头，EngineCore 从队列里取出 C，下一圈就能排上它。
- 同一时间，前端正把 A 上一圈拿到的新 token 还原成文字，推给用户。

如果收发请求和算模型挤在同一个循环里，每一圈都得先等这些杂活做完，卡就空着；反过来，一圈没算完，新请求也没人接。拆开以后，前端收发和后端算模型互不阻塞。

代价是交接要打包成消息。进程之间不能直接递对象，请求要编码后发过去，计划和结果也一样；同一条请求的状态分在前端、EngineCore、Worker 三处各存一份，结束时要逐处清掉。一个服务具体拆成几类进程、每类进程存什么、拆开还要付出什么，见 [拆成几个进程，换来什么、付出什么](engine-processes.md#拆成几个进程换来什么付出什么)。

EngineCore 和它的几个邻居容易混，按职责分开；这几种角色每一圈在边界上交接什么，见 [vLLM V1 的形状](vllm-v1-shape.md#两道边界上每一圈交接什么)：

| 谁 | 管什么 | 不管什么 |
|---|---|---|
| 前端（API server） | 收发 HTTP、分词、反分词、流式推送 | 这一步算哪些请求 |
| EngineCore | 转循环：收消息、叫调度器排计划、交出执行、按结果更新 | 张量怎么摆、卡上怎么算 |
| Scheduler（在 EngineCore 里） | 每一步算谁、各几个位置、借哪些块 | 把计划送到卡上 |
| Executor 与 Worker | Executor 是 EngineCore 里专管和 Worker 打交道的对象，把计划送给各 Worker、收回结果；Worker 里的 model runner 把计划拼成模型输入（见[准备输入](prepare-inputs-flow.md)、[NPUModelRunner](npu-model-runner.md)），再前向、采样 | 决定这一步算谁 |

## 一圈按什么顺序走？一条示意请求转两圈

一圈里的先后顺序是固定的，就是直觉图里的 ①–④，外加一道「有没有活」的门，每一格都有它的理由：

- **① 收消息：先把输入队列里已经到的消息全部收下。** 新请求进等待队列，取消的请求从调度器里删掉。收完才开始排这一圈，所以一条请求最早在它到达之后的那一圈开头被看到，不会插进一圈的半中间。
- **看有没有活。** 没有请求要算，就停下来等消息，见后面「源码里的一圈」一节。
- **② 调度。** 调度器排出这一圈的计划：每条请求算几个位置、新借了哪些块号；第一次上场的请求，计划里带着它的完整资料（提示词编号、采样参数等），以后每圈只带变化的部分。
- **③ 交出执行、等结果。** 计划交给 Worker，EngineCore 手里先拿到一张「回执」，也就是 future：结果还没算好，以后凭它来取。趁 Worker 在算，EngineCore 顺手准备[结构化输出](structured-output.md)要用的表（结构化输出限定模型只能写出合法 JSON 之类的格式，这张表写明下一个 token 允许取哪些值），然后凭回执等结果。这一步实际分成两次调用发给 Worker，为什么这样拆，见[一步之内：EngineCore 给 worker 发两次调用](request-call-chain.md#一步之内enginecore-给-worker-发两次调用)。
- **④ 先处理取消，再按结果更新。** 结果回来以后，先把算的这段时间里新到的取消处理掉，再把新 token 接到各条请求上、检查结束条件、让结束的请求还块。顺序不能反：反过来就会给一条用户已经取消的请求记上新 token。最后每条请求这一圈的新 token 编号放进输出队列，由另一个后台线程发回前端。

下面把第一节那条请求 R 在两圈里的交接按圈画出来，一圈一格：提示词 3 个 token，回答 2 个 token，整个服务里只有它一条请求。每格三行依次是前端、EngineCore、Worker 手里的编号，格子里的数是 token 编号，格子上面是它在这条请求里的位置，圆圈里的 1–4 对应上面的 ①–④。

```wiki-diagram
file: engine-core-rounds
```

两圈里走的四格完全一样，差别在计划里装了什么。第 1 圈 R 第一次上场，计划带着它的 3 个提示词编号，Worker 把这份资料缓存在自己进程里。第 2 圈计划里只剩「R 这一步算 1 个位置」和需要时新借的块号：第 1 圈选出的 5 本来就是 Worker 自己采样出来的，它手里已经有，不用 EngineCore 再发一遍。EngineCore 这边始终记着 R 的全部编号和算到了第几个位置；前端每圈只收到新 token。R 结束后，EngineCore 在下一份计划里带上「R 已结束」，Worker 才删掉自己那份缓存。

在不分块、不复用已算前缀、不开投机解码的前提下，示意请求 R 共算 4 个位置、循环转 2 圈（回答 $n$ 个 token 即转 $n$ 圈）：

$$N_{\text{pos}} = 3 + 1 = 4\text{ 个位置}, \qquad N_{\text{steps}} = 2 \div 1 = 2\text{ 圈}$$

| 示意请求 R 的执行圈 | 本圈算的位置 | 本圈交回 |
| --- | --- | --- |
| 第 1 圈（完整 prefill） | 3 个（整段提示词） | 回答的第 1 个 token |
| 第 2 圈（普通 decode） | 1 个（第 1 圈交回的 token） | 第 2 个 token（结束记号） |
| **两圈合计** | **4 个位置** | **2 个 token（2 圈）** |

## 一圈交回几个 token？看这一圈安排的是什么活

上面的例子里每圈正好交回 1 个 token，这只在最简单的情况下成立。一圈交回什么，取决于调度器这一圈给每条请求安排的是什么活：


普通 step 还返回一个布尔值，按本轮调度的 token 总数是否大于零计算。安排了计算位置与产出了新 token 不同：这个标志不是逐请求的产出确认，也不是设备执行完成的独立测量。

| 这一圈给这条请求安排的活 | 这一圈交回的新 token |
|---|---|
| 完整的 prefill：提示词剩下的位置一次算完 | 算到提示词末尾，交回回答的第 1 个 token |
| prefill 的中间一段：长提示词分几圈算，这一圈还没到末尾 | 没有，这一段只写 KV cache |
| 普通 decode：接着上一个 token 往后算 1 个位置 | 1 个 |
| 带候选的 decode：投机解码先猜几个候选，这一圈一起验证 | 接受 k 个候选就交回 k + 1 个，第一个候选就被拒时交回 1 个 |
| 这一圈没排上，或者刚被取消 | 没有 |

表里第 2 行说的是 [chunked prefill](chunked-prefill.md)（分块预填充：一圈能算的位置有上限，长提示词分几圈算完）；第 4 行说的是[投机解码](speculative-decoding.md)（先用便宜的办法猜后面几个 token，再让主模型一次验证）。

多条请求时，一圈的结果按请求分开记账。同一批里，A 这一圈交回 1 个 token，B 这一圈还在算提示词的中间一段、什么也不交回；调度器按各自的结果推进各自的进度，不是把同一个 token 发给整批请求。批里有谁也每圈在变：比如 A、B 先一起跑了两圈，第 2 圈 A 交回结束记号；第 3 圈开头 C 到了，这一圈就是 B、C 一起算；B 结束后，第 4 圈只剩 C。循环始终是这一个，变的是每圈那一批的成员；模型权重一直留在卡上，没结束的请求的进度和块号也一直留着。

所以不能拿回答长度直接换算引擎转了几圈，更不能换算耗时。长提示词要多转几圈才交回第 1 个 token；开了投机解码，一圈能交回好几个；请求还会在等待队列里排队、被抢占后重算、被取消。回答 n 个 token 转 n 圈，只是上面那个算例假设条件下的结论。

## 源码里的一圈：等活、选分支、交回结果

把上面的顺序对到源码上，EngineCore 进程的主线程只跑一个不停转的**忙循环**（busy loop）。它有两处分支：没活时去等，有活时按有没有建「批次队列」走两条路之一。

```wiki-diagram
file: engine-core-flow
```

**没活的时候停下来等。** 「有活吗」看三样：调度器里还有没算完的请求；批次队列里还有发出去、没取结果的批；开了数据并行（DP：把卡分成几组，每组各接一部分请求，下面细说）时，别的组还在跑。三样都没有，循环就阻塞在输入队列上，把 CPU 让出来，来一条消息才醒。醒来先处理这条消息，再问一次有没有活；有了，就把队列里其余已到的消息一并收下，然后才跑这一圈。它不会为了「看看有没有新请求」而反复提交空计算。只有弹性 EP 扩缩容（运行中增减参与专家并行的卡）进行时，这里改成不阻塞地看一眼就走。

调度器里还有请求，表示循环仍有工作需要推进，但不保证这一圈就能执行模型计算。例如，请求可能正在等待远端传来的 KV cache，也可能正在等待延迟的缓存释放；这些等待尚未结束时，请求仍在调度器中。

主循环在本轮没有执行模型、但调度器仍有请求时，会短暂休眠 1 毫秒，让后台传输线程继续推进。这时仍有工作待完成，与完全空闲时阻塞等待新消息不同；1 毫秒只是该处让出执行机会的时长，不是请求总时延。


**取消怎样插进来。** 收消息的后台线程收到取消时，把它同时放进两处：输入队列，保证它和新请求的先后顺序；另一个专门的取消队列，每圈在 ④ 更新之前清一次。更新时，调度器发现某条请求已经结束，就跳过它这一圈的结果。所以取消不会打断卡上正在算的这一批：被取消的请求这一圈照样算完，只是结果被丢掉，不会再推给用户。「设备算完了」和「服务把结果记上了」是两件事，中间隔着这一道。

材料中的调度器中止操作具有幂等性：对同一个请求重复处理中止，效果与处理一次相同。因此，同一条取消消息经过两条队列被处理，不会让已经中止的请求再发生另一种状态变化。

**新请求在哪里变成调度器认识的样子。** 前端发来的请求消息里是请求编号、提示词的 token 编号和采样参数。收消息的后台线程当场把它转换成调度器用的请求对象（需要结构化输出的请求，顺带开始准备语法），再放进输入队列；主线程收下它时，只是把它交给调度器，排进等待队列。

**开了数据并行时多一个分支。** 数据并行（DP）把卡分成几组，每组各接一部分请求、各自调度，每组各有一个 EngineCore，各转各的圈。MoE 模型（每层有很多个专家子网络，每个 token 只挑其中几个来算）的专家分散在所有组的卡上，一组这一圈没有请求可算、而别的组还在算时，它要陪着跑一次空批次，让卡间通信凑得齐人；各组还要定期对一下「还有没有请求」，都没了才一起停下。这条分支经过哪些函数，见[同一条请求，第 1 步和第 2 步走的分支不同](request-call-chain.md#同一条请求第-1-步和第-2-步走的分支不同)。

## 批次队列：下一圈的调度和这一圈的计算叠起来

同步分支也能重叠一部分 CPU 与设备工作：③ 先发出前向、拿到回执，再准备结构化输出的允许词表，因此准备表可以与本轮前向同时进行。随后 EngineCore 等待本轮结果并更新请求，做完才调度下一圈。这里尚未重叠的是下一圈的调度与这一圈的计算；调度、更新及等待仍可能形成设备空档。

要叠起来，得让 EngineCore 不等这一批的结果就去排下一批。最多允许同时有几批在途，由配置算出：只开异步调度（async scheduling：不等上一步的结果回来就先排下一步）、不开流水线并行时是 2；开了流水线并行（PP：把模型的层按顺序分给几组卡）时至少是 PP 的组数。这个数大于 1，EngineCore 就建一个批次队列，优先排并提交新一批；如果这一批没有需要推迟的采样，入队后队列仍未满，且本步执行了模型或调度器里仍有请求，就先返回，不等结果。有在途批次而没有满足上述提前返回条件时，取出最老的一批，等结果再更新。因此，不开流水线并行时，异步调度下 EngineCore 最多领先 Worker 一步；每圈在函数里怎样走、读报错栈时怎样把清单和批次对上，见[一步之内：EngineCore 给 worker 发两次调用](request-call-chain.md#一步之内enginecore-给-worker-发两次调用)。

代价在记账上：排下一批时，这一批的新 token 还没回来，调度器只能先记上占位，等结果回来再对上；需要前一批 token 才能准备的结构化输出表，也要推迟到前一批更新之后再发。占位怎样记、时间上怎样叠，见[异步调度](async-scheduling.md)。

对流水线并行还要看执行模型的实现：当前固定上游代码明确提示，旧一代 model runner 对“异步调度与流水线并行同开”的支持不完整；不能只凭配置允许并发多少批，就推定这种组合已经跑通。不同实现的逐项并发条件见页末“怎么开”。

走哪条分支由配置自动判定，实际以启动日志为准，判定条件和日志写法见页末[怎么开](#怎么开)与[会报什么错](#会报什么错)。

## 落到 GLM 双机：两个 EngineCore 各转各的圈

部署沿用[部署前提](glm-5-3-flash-two-node.md#部署前提)：两台机器各 8 张卡，每台机器是一个 DP 组，组内 8 张卡做 TP8，16 张卡一起做 EP16。落到 EngineCore 上是三件事：

- **两个 EngineCore，各转各的圈。** node0 上的 EngineCore_DP0 管本机 8 个 Worker，node1 上的 EngineCore_DP1 管另外 8 个。每个 EngineCore 有自己的调度器、自己的 KV 块池、自己的等待队列；前端只有 node0 上一个。全部进程怎样分布、彼此走什么通道，见[七站分在三种进程里](request-call-chain.md#七站分在三种进程里)。
- **每一步的上限。** 每个 EngineCore 一步最多算 8192 个位置、最多排 32 条请求。GLM 带 MTP（多 token 预测层：每一步先草拟 3 个候选 token，下一步由主模型一起验证），所以调度时每条请求还要为下一步的 3 个候选预留位置。这几个数怎样进调度，见 [Scheduler 放到 GLM 双机](vllm-scheduler.md#放到-glm-双机一个-dp-组里的-r1)。
- **走带批次队列的分支。** 本部署没写异步调度开关，按自动判定推断是打开的（MTP 与多进程执行器都满足条件），所以走上一节的带批次队列分支，队列最多 2 批。

下面跟着 R1 看 DP0 的循环。R1 是主线的示例请求，提示词 4 个 token，这是为演示取的设定，见[示例请求 R1](one-request.md#示例请求-r1-与官方双机部署)。异步调度下，一圈发出的计划要到下一圈才收回结果，所以按圈写清每圈发出什么、收回什么：

1. **R1 到来之前。** 两个 EngineCore 都没活，停在输入队列上等。前端把 R1 派给 DP0，见[第 1 站](one-request.md#第-1-站-入口从-http-到-node0-的引擎)。
2. **第 1 圈：发出第 1 步。** DP0 收下 R1，调度器排出第 1 步的计划：R1 算 4 个位置，新借一串块号，没有候选；R1 第一次上场，计划带着它的完整资料。借几块见[第 2 站](one-request.md#第-2-站-调度4-个-token-的预算和-15-个块号)。计划发给 node0 的 8 个 Worker，回执入队。队列里只有 1 批、R1 还能继续推进，这一圈不等结果就结束了。
3. **第 2 圈：发出第 2 步，收回第 1 步。** 第 1 步的结果还没回来，调度器已经给 R1 排好第 2 步：还不知道的那 1 个 token 记上占位，再加 3 个候选的占位，一共 4 个位置。发出去以后队列满了，EngineCore 这才等第 1 步的结果：回答的第 1 个 token y₀；MTP 草拟的 3 个候选留在 Worker 里，第 2 步直接用。y₀ 接到 R1 上，发回前端。
4. **之后每一圈：发出第 k+1 步，收回第 k 步。** 每一步 R1 都算 4 个位置：上一步确定的 1 个 token 加 3 个候选，主模型一次验证，交回 1 到 4 个 token（接受了几个候选再加 1）。主线的例子假设第 2 步接受 1 个候选、第 3 步全部接受，三步分别交回 1、2、4 个 token，前三步一共 7 个；逐项账见[第二圈和第三圈](one-request.md#第二圈和第三圈decode-步一次验证-1--3-个-token)。这是引擎单步的产出范围；前端可把多步增量合并成一个流式片段，片段没有 4 个 token 的上限，见[流式输出的合并](streaming-output.md#前端跟不上时几步的文字并成一段)。
5. **R1 结束。** 某一步的结果里出现结束记号，更新时 R1 被标成完成，块号一次还回 DP0 的块池，还多少块见[第 7 站](one-request.md#第-7-站-返回与收尾)。R1 的编号记进结束名单，随 DP0 的下一份计划通知 8 个 Worker 删掉缓存；DP0 正在跑的请求数减 1，前端之后派新请求时会看到这个数。

这个数每圈前后才报一次、经协调器推给前端，前端再拿它选组，见 [DP 请求路由](dp-request-routing.md#计数表从哪来为什么会过时)。

同一段时间里，DP1 一条请求都没有。但 MoE 层的专家分在 16 张卡上，node0 的 token 要发到 node1 的卡上去算，所以 DP1 的循环每一步都陪着跑一次空批次，一起进出通信，见[空闲的 DP 组为什么还要陪跑](concurrent-requests.md#空闲的-dp-组为什么还要陪跑变体-m)。

一个 DP 组跑满 32 条 decode 请求时，每条算 4 个位置，一步共 128 个位置（见[关键参数各管哪一步](glm-5-3-flash-two-node.md#关键参数各管哪一步)）。这一步交回多少 token，取决于候选被接受了几个：

$$N_{\text{out,min}} = 32 \times 1 = 32, \qquad N_{\text{out,max}} = 32 \times (1 + 3) = 128$$

| 满载 32 条 decode 步（每条 1 确定 + 3 候选） | 算式 | 单步交回 token 数 |
| --- | --- | --- |
| 3 个候选全被拒（下界） | $32 \times 1$ | **32 个 token** |
| 3 个候选全被接受（上界） | $32 \times (1 + 3)$ | **128 个 token** |

所以在 GLM 双机上，「引擎转了几圈」和「交回了多少 token」差得更远：同样转一圈，交回的 token 数能差 4 倍。

昇腾上跑的就是上游这条循环。vllm-ascend 在 EngineCore 进程的入口挂了补丁，但只在打开均衡调度（balance scheduling，vllm-ascend 自己的一种调度选项）或按剖析结果动态分块（要求 PP 大于 1）时，才换掉 DP 用的引擎类或包一层初始化；本部署两样都没开，每一圈走的都是上游代码。调度器类被换成了什么、为什么对本部署没有影响，见[昇腾上跑的是哪个调度器](vllm-scheduler.md#昇腾上跑的是哪个调度器)。

## 常见误解

- **「每条请求有自己的循环。」** 没有。所有请求共用 EngineCore 这一个循环，一圈里一起往前走一步。开了 DP 时每组各有一个循环，但一条请求只归其中一组。
- **「转一圈，每条请求就多一个 token。」** 不是。长提示词分几圈算时，前几圈什么也不交回；开了投机解码，一圈能交回好几个；GLM 双机上一步交回 1 到 4 个。
- **「没有请求时，引擎在不停地查有没有新请求。」** 不是。它阻塞在输入队列上，把 CPU 让出来，来消息才醒；只有弹性 EP 扩缩容进行时，才改成不阻塞地看一眼。
- **「引擎是事件驱动的，新请求一到就插进正在算的这一圈。」** 不是。EngineCore 的主线程是按部就班的循环：每圈开头把已到的消息一起收下，再调度；卡上正在算的那一批已经定了，新请求最早排进下一圈的计划。同时挂着很多连接、来一个处理一个的，是前端。
- **「交出执行、拿到回执，就是调度和计算重叠了。」** 不是，重叠要靠批次队列，见[批次队列](#批次队列下一圈的调度和这一圈的计算叠起来)一节。
- **「开了异步调度，引擎就不是一圈一圈转的了。」** 还是一圈一圈转，只是发出的计划和收回的结果错开一圈，见[落到 GLM 双机](#落到-glm-双机两个-enginecore-各转各的圈)一节 R1 的逐圈走法。
- **「取消会马上打断卡上的计算。」** 不会，这一圈照样算完、结果被丢掉，见[源码里的一圈](#源码里的一圈等活选分支交回结果)。
- **「EngineCore 交回的是文字。」** 不是。它交回的是 token 编号；还原成文字、匹配停止字符串，都在前端做，token 和编号的关系见 [token](token.md)。

## 对照源码

### 怎么开

- **循环本身没有开关。** EngineCore 进程起来就进入 `EngineCoreProc.run_busy_loop`：`while self._handle_shutdown()` 里先 `_process_input_queue()`，再 `_process_engine_step()`，后者调用一次 `self.step_fn()` 并把结果放进输出队列。
- **步函数在初始化时选定一次。** `batch_queue_size = vllm_config.max_concurrent_batches`，大于 1 才建 `batch_queue`；`step_fn` 在没有批次队列时是 `step`，有时是 `step_with_batch_queue`。
- **最多并发批数。** `max_concurrent_batches`：开了异步调度时，V1 model runner 在 PP=1 时返回 2，V2 model runner 返回 `pp_size + 1`；其余情况返回 `pp_size`。所以批次队列既服务于异步调度，也服务于 PP。
- **异步调度开关。** 命令行 `--async-scheduling` / `--no-async-scheduling`，对应 `SchedulerConfig.async_scheduling`，默认 `None`，交给配置阶段自动判定：pooling 模型、投机方法既不属于 EAGLE 类（含 MTP）也不属于 NGram GPU 类、`disable_padded_drafter_batch=True`、执行器不支持，四者撞上一个就置为 `False`，否则置为 `True`。GLM 双机用 `method="deepseek_mtp"`（配置阶段归一成 `mtp`）和 `MultiprocExecutor`，按这条规则推断为 `True`。
- **同步与异步的一处分工差别。** 同步模式下，启用投机解码且本轮执行了模型时，圈末的 `post_step` 才调 `take_draft_token_ids()` 把草拟的候选取回交给调度器；异步时候选留在 Worker 进程里，由 `AsyncScheduler` 在调度时记占位（`num_output_placeholders += 1 + 候选数`）。
- **vllm-ascend 的入口补丁。** `vllm_ascend/patch/platform/patch_balance_schedule.py` 替换了 `EngineCoreProc.run_engine_core`，只有 `additional_config` 里 `enable_balance_scheduling` 为真时才换用 `BalanceDPEngineCoreProc`，否则直接调上游原函数；`patch_profiling_chunk.py` 只在 `profiling_chunk_config` 打开时生效，而它要求 PP 大于 1。本部署两者都没开。

### 会报什么错

- 显式 `--async-scheduling` 时不做降级，不兼容就在启动时失败，报错原文：
  - `ValueError: Currently, async scheduling is only supported with EAGLE/MTP/Draft Model/NGram GPU kind of speculative decoding`
  - `ValueError: Async scheduling is not compatible with disable_padded_drafter_batch=True.`
  - ``ValueError: `<backend>` does not support async scheduling yet.``
- 默认 `None` 撞上同样的条件，只打一行 warning 并关掉异步调度，不报错。
- 判断本次走哪条分支：v0.23、v0.26 启动时有一行 info 日志 `Asynchronous scheduling is enabled.` 或 `Asynchronous scheduling is disabled.`；批次队列建起来时还有 debug 日志 `Batch queue is enabled with size 2`。
- 循环空闲与恢复只打 debug 日志：`EngineCore waiting for work.`、`EngineCore loop active.`。看不到它们不代表循环没转，只是日志级别不够。
- EngineCore 自身崩溃、Worker 异常怎样一层层转报到前端，报错原文和排查顺序见[请求调用链的会报什么错](request-call-chain.md#会报什么错)。

### 开销和什么时候别开

- **同步分支的空档。** 调度和按结果更新在 CPU 上进行，可能造成设备空档；结构化输出表可以在前向发出后准备，与本轮前向重叠，不能把所有 CPU 工作时间都算成设备空闲。同步分支仍须等本轮结果更新后才调度下一轮；decode 步较短时，这种等待更显眼，批次队列用来增加重叠机会。本部署两条分支各自的吞吐与时延没有实测数。
- **批次队列的代价。** 调度器要为还没回来的 token 记占位，结构化输出请求在依赖前一批时要推迟第二次调用，排错时正在更新的清单属于上一批。定位调度或记账问题时，可以临时加 `--no-async-scheduling` 让每圈的结果当圈回来，但这时测到的吞吐和时延不代表原部署。
- **空闲等待不占 CPU。** 空闲时阻塞在输入队列上，不空转，也不提交空计算；上游只在弹性 EP 扩缩容时才临时改成不阻塞地看一眼。

### 版本差异

按知识库四版本正式钉点核对：`v0.23.0`（`vllm@0fc695fc` / `vllm-ascend@2c59ff10`，GLM 绑定算例另钉专用镜像 `db701c1f`）、`v0.26.0rc`（`vllm@568afb3a` / `vllm-ascend@2ed6cbba`）、`v0.30.0` 主基线（`vllm@ced6857a` / `vllm-ascend@c09d3e20`）与 `main`（`vllm@ba15685a` / `vllm-ascend@8d6180e2`）。各钉点与部署的对应关系见[来源基线](../sources/glm-5-3-flash-baseline.md)。

| 核验维度 | `v0.23.0`（`0fc695fc` / `2c59ff10`） | `v0.26.0rc`（`568afb3a` / `2ed6cbba`） | `v0.30.0`（`ced6857a` / `c09d3e20`，主基线） | `main`（`ba15685a` / `8d6180e2`） |
| --- | --- | --- | --- | --- |
| `EngineCore` 主循环与步函数位置 | `step()` L443、`step_with_batch_queue()` L484、`run_busy_loop()` L1223 | `schedule()` 新增 `_should_throttle_prefills()` 节拍参数；`step()` 挂接 `capture_iteration_details` | `step()` L589、`step_with_batch_queue()` L630、`run_busy_loop()` L1403；非 DP 循环前后亦调 `_maybe_publish_request_counts()` | `step()` L709、`step_with_batch_queue()` L754、`run_busy_loop()` L1764；骨架与节拍/统计挂接一致 |
| 异步调度自动判定与日志 | 放行 EAGLE/MTP/NGram GPU；启动打 `Asynchronous scheduling is enabled/disabled.` info 日志 | 延续 info 日志与同套判定 | 放行扩展至 `draft_model`/`dspark`（增 ROCm DeepEP 闸）；删除该 info 日志，DP>1 MoE 改打禁用 NCCL DP 同步提示 | `vllm.py#L616-L635` 延续 `max_concurrent_batches` 与异步调度自动判定规则 |
| 昇腾 `patch_engine_core.py` 演进 | 条件式入口补丁分散在 `patch_balance_schedule.py`（仅开均衡调度时换 `BalanceDPEngineCoreProc`） | 仅均衡调度开启时替换 `DPEngineCoreProc` 为 `BalanceDPEngineCoreProc` | 集中至 `patch_engine_core.py#L32-L74`（74 行）：按需选 `DyntraLBDPEngineCoreProc` / `BalanceDPEngineCoreProc`、开 `profiling_chunk` 时调 `_apply_profiling_patches()`，并挂 `pp_mtp` `post_step` 补丁 | `patch_engine_core.py#L31-L68`（68 行）：**移除 `patch_profiling_chunk` / `_apply_profiling_patches()` 调用**，保留 DyntraLB / BalanceDP 选择与 `pp_mtp` `post_step` 补丁 |

`v0.26.0rc` 起引入的 `_should_throttle_prefills()` 受 `prefill_schedule_interval`（默认 1）、容量与运行请求条件共同制约，详见 [DP prefill 节奏](vllm-scheduler.md#多个-dp-组怎样对齐-prefill-的节奏)。在四版中，未开启 DyntraLB、均衡调度与 PP+MTP 特例时，昇腾均原样运行上游 `EngineCore` 循环；上述一致性仅说明源码路径，不将固定 GLM 绑定算例改写为 `v0.30.0` / `main` 实测。

### 源码位置

读 EngineCore 从一圈的骨架看起：先看忙循环怎样等活、收消息，再看两种步函数怎样调度、交出执行、处理取消、更新，最后看配置阶段怎样决定走哪一种。

| 看什么 | 位置 |
|---|---|
| 忙循环、收消息、有没有活 | `vllm@0fc695fc:vllm/v1/engine/core.py#L1211-L1262` |
| 一圈结束：结果进输出队列、`post_step` | `vllm@0fc695fc:vllm/v1/engine/core.py#L1264-L1281`；`#L474-L482` |
| 同步步函数 `step()` | `vllm@0fc695fc:vllm/v1/engine/core.py#L443-L473` |
| 带批次队列的 `step_with_batch_queue()` | `vllm@0fc695fc:vllm/v1/engine/core.py#L484-L598` |
| 批次队列的建立与 `step_fn` 的选择 | `vllm@0fc695fc:vllm/v1/engine/core.py#L188-L220` |
| 收消息线程：新请求预处理、取消进两个队列 | `vllm@0fc695fc:vllm/v1/engine/core.py#L1515-L1543`；`#L819-L841`；`#L600-L608` |
| 更新时跳过已结束的请求 | `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1393-L1407` |
| DP 的忙循环与空批次 | `vllm@0fc695fc:vllm/v1/engine/core.py#L1869-L1900` |
| 计划里带什么、只发变化量 | `vllm@0fc695fc:vllm/v1/core/sched/output.py#L112-L120`；`#L181-L215` |
| 前端与 EngineCore 之间的请求和输出 | `vllm@0fc695fc:vllm/v1/engine/__init__.py#L83-L92`；`#L170-L185` |
| 最多并发批数、异步调度的判定与日志 | `vllm@0fc695fc:vllm/config/vllm.py#L497-L507`；`#L931-L1002` |
| 异步调度的占位 | `vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L19-L36` |
| vllm-ascend 的入口补丁（四版演进） | `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_balance_schedule.py#L661-L666`；`vllm-ascend@c09d3e20:vllm_ascend/patch/platform/patch_engine_core.py#L32-L74`；`vllm-ascend@8d6180e2:vllm_ascend/patch/platform/patch_engine_core.py#L31-L68` |
| `v0.30.0` / `main` 上游主循环与并发批数 | `vllm@ced6857a:vllm/v1/engine/core.py#L584-L710`、`#L1403-L1425`、`config/vllm.py#L589-L610`；`vllm@ba15685a:vllm/v1/engine/core.py#L709-L800`、`#L1764-L1785`、`config/vllm.py#L616-L635` |

**正文证据归档。** 一圈先收完已到的消息、没活时阻塞在输入队列上 [C1]，「有活」看调度器、批次队列和 DP 运行状态三样 [C6]；只有弹性 EP 扩缩容时改为不阻塞 [C24]。一圈的顺序（调度、交出执行、准备结构化输出的表、等结果、先处理取消再更新）见 `step()` [C2]，结果进输出队列在 [C7]。取消同时进输入队列和取消队列 [C8]，更新时跳过已结束的请求 [C5]；「取消不打断卡上正在算的这一批」由这两处推出 [D]。新请求在收消息线程里转换成调度器的请求对象 [C23]；它最早排进到达之后那一圈的计划，由「先收消息、再调度」的顺序推出 [D]。

第一次上场带完整资料、之后只发变化量、新 token 编号只在 PP 下随计划下发，见计划的字段注释 [C13][C14]；前端与 EngineCore 之间传的是 token 编号 [C16]。批次队列的建立和分支选择 [C4]，最多并发批数 [C11]，带队列分支「未满且能推进就不等结果」 [C3]，异步调度的默认值、自动判定与日志 [C12]，占位 [C22]。DP 空闲组陪跑空批次 [C10]。

示意请求 R 转两圈、回答 n 个 token 转 n 圈，是在不分块、不复用前缀、不开投机解码的假设下由一圈的结构推出的 [D]。GLM 双机上 EngineCore 最多领先 Worker 一步，由批次队列长度 2 推出 [D]；R1 前三步交回 7 个 token、满载一步交回 32 到 128 个 token，由主线底稿「每步产出 1 到 4 个 token」推出 [D]。本部署异步调度打开，是按自动判定规则推出的，缺本部署的启动日志 [I]。前端与后端拆成两个进程后互不阻塞，是由进程分工推出的直觉说法，没有本部署的对照测量 [I]。

**实测边界。**

- 缺本部署的启动日志，用来确认 `Asynchronous scheduling is enabled.` 与批次队列长度 2。
- 缺同步分支与带批次队列分支在本部署上的吞吐、时延对照，以及每圈 CPU 调度与更新各占多少时间。

远端 KV 等待或延迟释放可以让调度器仍有工作；这与当前轮是否执行模型是两件事。固定上游的中止操作具有幂等性，同一取消经两条队列处理不会要求请求释放两次。[C7][C8]

固定上游的并发批次上限在异步 V2 下为 PP 大小加一，异步 V1 且 PP=1 时为二，其他情况为 PP 大小。这只是队列容量规则；异步 V1 对 PP 的支持还有实现限制，不能用容量公式证明某个模型和后端组合可用，实际条件见[流水线并行](pipeline-parallel.md)。[C3][C11]

- 来源 37、38：vllm@0fc695fc，vllm/v1/engine/core.py，L472–L472、L1264–L1279。
