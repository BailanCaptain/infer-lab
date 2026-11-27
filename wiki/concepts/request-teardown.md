---
id: request-teardown
title: 请求收尾：一条请求结束或被中止后，它占的东西怎样一件件还回去
type: concept
legacyAnchors:
  落到-glm-双机r1-结束时三处各还了什么: 多-dp-组与多缓存组收尾r1-长度到限时三处各还了什么
  复杂异构实战对照glm-双机-dp--多缓存组释放与-p-d-延迟还块: 多-dp-组与多缓存组收尾r1-长度到限时三处各还了什么
  glm-双机dp2r1-长度到限时三处各还了什么: 多-dp-组与多缓存组收尾r1-长度到限时三处各还了什么
summary: >-
  请求收尾是一条请求停下后，前端、引擎与 worker 各自删掉记录并归还 KV 块引用的过程。前半先讲标准请求正常判停与客户端断连 abort
  的块释放链路，分清还块（引用计数减 1）、抢占与清空前缀缓存，后半对照 GLM 双机 DP、多缓存组释放与 P-D 延迟还块实战。
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
  - check_stop
  - stop
  - 停止字符串
  - stop_token_ids
  - stop token ids
  - 停止 token 编号
  - ignore_eos
  - ignore eos
  - 忽略 EOS
chapters:
  - '09'
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
  - to: streaming-output
    kind: builds-on
    note: 停止字符串怎样被发现、最后一个片段怎样推出在那一页；本页接着讲发现之后怎样通知引擎、谁先还
  - to: sampling
    kind: builds-on
    note: 引擎侧判停（EOS、stop_token_ids、长度上限）与 min_tokens 规则由采样页定义
  - to: continuous-batching
    kind: builds-on
    note: 请求完结当步移出 running 队列并归还缓存块，与显存吃紧时的抢占机制分属两条流转路径
  - to: block-table
    kind: builds-on
    note: 引擎收尾倒序归还物理块引用计数，并由下一份调度清单通知 worker 清理批次块表行
contradicts: []
updated: '2026-11-27'
origin: direct
---

## 请求收尾是什么：一条请求停下以后，它占着的东西去哪了？

**请求收尾是一条请求停止生成以后，服务把为它保留的资源逐一删掉、还回去的过程：前端删记录与输出槽，引擎移出队列并归还 KV 块引用，worker 删掉批次表里的对应行。**

一条在途请求同时「住」在三类进程里：**前端**（`API server`）负责 HTTP、分词与反分词；**引擎**（`EngineCore`）负责排队、调度与块分配；**worker** 是在每张卡上跑模型的执行进程。收尾就是依次清掉这三份状态，见下图。

```wiki-diagram
file: request-teardown-intuition
```

以标准单缓存组场景（如 `Qwen3-8B`）的示意数走一遍：请求 A 正在生成，B、C 也在运行。

- **前端**：为 A 保存一条反分词进度记录和一个单槽输出队列；引擎每步结果先放进输出槽，等 A 的 HTTP 任务取走。
- **引擎**：在请求表里给 A 留一条**请求表项**（记录算到哪、持有哪几块），并在 `running` 队列占一席。A 顺序持有 3 个 KV 块：块 9 → 块 2 → 块 5。开启 [prefix caching](prefix-caching.md)（前缀缓存）时，块 9 存着 A 与 B 相同的开头，因此块 9 的引用计数为 `2`，块 2 与块 5 为 `1`。
- **worker**：每张卡的批次表里各给 A 留一行，保存块号表与已算位置。

A 停下后，三处按先后顺序收尾：

1. **引擎当步释放**：将 A 移出 `running` 队列，按**倒序**归还块引用（块 5 → 块 2 → 块 9）。块 5、块 2 计数归零，排回空闲队列队尾；块 9 计数由 `2` 降为 `1`，因 B 仍在使用而留在 B 手里。最后删掉 A 的请求表项。
2. **前端收到末份结果**：删掉 A 的反分词记录；输出槽把带结束原因的最后一份交给 HTTP 任务后随连接关闭。
3. **worker 晚一步删行**：等下一份调度清单写明「A 已结束」，各卡 worker 再删掉批次表那一行。

还回池子的块**不擦除显存数据**：只改引用计数与队列位置，直到下一条请求借走并写入时才原地覆盖旧数据。

## 为什么要收尾：不还会怎样，代价在哪？

**KV 块由所有请求共享，一条不还，后来者就借不到；客户端断开不通知引擎，引擎就会继续白算。收尾记账本身很轻，真正昂贵的是收尾前后多算的那几步。**

沿用上图示意：空闲队列原有 4 块（3、4、6、7），等待队头的请求 D 需要 6 块才能进场。A 停下若不还块，D 只能干等；A 归还块 5、块 2 后空闲变为 6 块，D 下一步立刻排入（块 9 仍被 B 持有，不计入空闲）。

客户端断连同样必须收尾。设 A 上限 200 个 token，用户看到第 20 个就关掉页面。引擎只与前端建有 ZMQ（ZeroMQ，进程间消息通信库）通道、感知不到 HTTP 断开；若前端不发中止消息，引擎会白算完剩余 180 个 token，期间一直占着块与批位置。

收尾的代价集中在三处：

- **记账本身极轻**：仅在 CPU 上改计数、挪块号、删表项，不擦显存也不发卡间通信。
- **前端先发现会多算几步**：停止字符串和客户端断连需多走一次跨进程中止消息，消息到达前引擎照常推进。若开启异步调度（CPU 先排下一步再处理上步结果），引擎判停时下一步已发出，那一步的产出只能丢弃（见[异步调度那一节](#异步调度下判停的时候下一步已经排好了)）。
- **worker 晚一步删行**：在下一份调度清单到达前，批次表槽位仍被占着。

收尾容易与另外三个「还回去」动作混淆，四者边界如下：

| 动作 | KV 块引用 | 引擎请求表项 | 后续去向 |
| --- | --- | --- | --- |
| 收尾（结束或中止） | 全部减 1 | 删掉 | 不再被调度 |
| 抢占（preemption：空闲块不足时调度器抢占一条运行中请求） | 全部减 1 | 保留，已算位置清零 | 退回等待队首，后续重排恢复 |
| 默认清空前缀缓存 | 不动 | 不动 | 抹掉块指纹登记；若有块被持有则失败 |
| 投机候选被拒（如 MTP 猜错） | 不动 | 保留，已算位置回退 | 下一步原地覆盖写入 |

前两行都还块，区别在于请求是否还在；第三行不还块，只清空前缀复用指纹（写满块的内容哈希）。下文先讲四条收尾路径，抢占与缓存重置在独立小节展开。

## 怎么收尾：四条结束的路，谁先发现、谁先动手

**一条请求有四种停法：引擎判停、停止字符串命中、客户端断开、运行出错。无论哪条路进来，最终都汇聚到引擎同一个释放动作；区别只在谁先发现、谁先清理自己那份状态。**

- **引擎判停（分采样屏蔽与调度判停两步）**：
  1. **采样端屏蔽停止 token**：生成词数未满 `min_tokens` 时，采样器先把结束 token（EOS）与 `stop_token_ids` 的分数置为 $-\infty$。
  2. **调度端 `check_stop` 逐枚判停**：`v0.30.0` 配套上游（`vllm@ced6857a`）与 `main` 先检查 EOS、`stop_token_ids`（记 `stop`）与长度上限（`max_tokens` 或模型总长上限，记 `length`），再用 `min_tokens` 门槛控制后续重复检测（记 `repetition`）；历史 GLM 配套上游（`vllm@0fc695fc`）则先检查 `min_tokens`、未满直接跳过。一旦命中，本步排在后面的 token 直接丢弃（见 [sampling](sampling.md#什么时候停下来)）。
- **停止字符串**：`stop` 按还原后的文本匹配，由持有反分词器的前端发现（扣字与截断见[流式输出](streaming-output.md#停止字符串先扣住结尾几个字)）。
- **客户端断开**：用户关页或调用方超时断连，仅前端连着客户端，因此由前端先发现。
- **运行出错**：引擎侧，结构化输出语法检查拒绝刚采出的 token（屏蔽表之外的兜底分支）会记 `error`；前端侧，取结果任务抛出意外异常时会先发中止再报错。

```wiki-diagram
file: request-teardown-flow
```

### 引擎先判停：同一步里先还块，再把结束原因发出去

沿用请求 A，本步采到结束 token：

1. 引擎更新结果时判停，结束原因记 `stop`。
2. 同一步立即释放 A：移出 `running` 队列，ID 记入「已结束」清单，倒序还块，删除请求表项。
3. 将本步新 token 与结束原因发回前端。
4. 前端还原末段文字、删除 A 的记录、将末份结果放入输出槽；HTTP 任务推出带结束原因的末片段（见[流式输出](streaming-output.md)），且因引擎已结束，前端不再发中止。
5. 下一步调度清单带上 A 的 ID，各卡 worker 删除批次表对应行。

也就是说，在前端把最后一段文字推给客户端之前，A 的块就已经回到块池了。

### 前端先发现：停止字符串和客户端断开

**停止字符串**：前端反分词后命中 `stop`（默认截掉，也可配置保留），将带 `stop` 的末份结果放入输出槽并删掉本地记录。若引擎同批结果尚未标记结束，前端把 A 的 ID 记入「待中止」名单，处理完本批后立刻发 `abort` 消息；引擎收到后再释放与还块。

**客户端断开**：非流式请求由服务并行跑生成函数并监听连接断开，谁先结束就取消另一方；流式请求由响应推送器监听连接，断连时取消推流任务。两条取消最终都落回取结果的生成函数：先在前端删除记录并放入 `abort` 结果，再向引擎发中止 ID（`n > 1` 时所有子请求一并中止）。

在这两条路上，中止消息到达引擎前，引擎照常推进。卡上正在为 A 算的那一步返回时，因 A 已被删除，结果直接丢弃不再发往前端。

### 停止文字、停止编号和忽略 EOS 怎样配合

**三项逐请求设置分别管文本、编号与模型默认结束信号。** `stop` 检查前端文本；`stop_token_ids` 检查引擎刚接到的单枚 token；`ignore_eos` 仅关闭模型自带 EOS 的自动判停（EOS 含义见[采样停止判断](sampling.md#什么时候停下来)）。

- **停止文字（`stop`）跨 token 拼串**：设 `stop = ["END"]`，模型连续吐出解码为 `E`、`N`、`D` 的三枚 token，前两枚未拼齐，第三枚才命中。匹配区分大小写、非正则、不扫提示词；跨步扣留尾字规则见[流式输出](streaming-output.md#停止字符串先扣住结尾几个字)。
- **停止编号（`stop_token_ids`）单枚触发**：若把 `E`、`N`、`D` 的示意编号 `10, 11, 12` 放入列表，含义是「任意一枚出现即停」——第一枚 `E` 就会结束，而非等三枚顺次出现。实际编号须从当前部署的分词器获取，不可用单独分词的尾编号代替停止串。

| 设置或组合 | 实际改变 | 仍然生效的结束条件 |
|---|---|---|
| 只设 `stop` | 文本拼出指定串时前端判停 | 模型 EOS、`stop_token_ids`、长度上限 |
| 手工设 `stop_token_ids` | 任意指定编号出现时引擎判停 | 模型 EOS、`stop`、长度上限 |
| `ignore_eos = true` | 关闭主 EOS 及生成配置中其他 EOS 的自动判停 | 手工 `stop_token_ids`、`stop`、长度上限与中止 |
| `ignore_eos = true` 且手工把 EOS 写入 `stop_token_ids` | 该编号仍按手工规则触发判停 | `ignore_eos` 不撤销手工规则 |

EOS 与手工编号同时受[最少输出数（`min_tokens`）采样屏蔽](sampling.md#最少输出数怎样挡住提前结束)约束，达标后解除屏蔽；`stop` 则在输出超过最少数后匹配新增文本（例：`min_tokens=2` 时保护 `E`、`N`，第 3 枚 `D` 补齐 `END` 后仍可截断，最终可见文字可为空）。

结束原因上，命中 EOS、手工编号或停止串均可返回 `finish_reason: "stop"`，靠 `stop_reason` 区分具体编号或字符串（主 EOS 通常为 `null`）；长度到限记 `length`。默认 `include_stop_str_in_output = false` 时，V1 反分词不解码因 `stop` 结束的末枚编号（仍记入 `token_ids`）；开启后才尝试解码，并仍受 `skip_special_tokens` 约束。

### 中止消息晚到、重复到，都不出错

- **引擎双队列防漏防重**：中止消息同时入两个队列——专用中止队列在每步前向算完、结果更新前优先清空，尽早释放；普通消息队列按到达顺序排在「新增请求」之后，防止新增尚在排队时被提前漏掉。同一 ID 处理两次时，后一次查不到或已结束直接跳过。
- **前端仅发在途 ID**：本地已删记录的 ID 不再重发。多 DP 组场景由前端路由表定向发给对应组，引擎回报「本批已结束」后前端同步删表。
- **waiting 请求也能中止**：直接移出等待队列；无 KV connector 时未借过块，还块步骤为空操作（有 connector 时的延迟还块见后半实战对照）。
- **引擎已挂不发中止**：前端直接报错，不向已退出进程发消息。

### 出错：结束原因记 error

引擎判错后与正常判停走同一释放链：同步还块、删表项、以 `error` 回传前端（语法拒收 token 另打 `Unexpected` 开头 error 日志；配 KV connector 时远端加载失败按默认策略亦记 `error`）。前端将其转为服务器内部错误：流式请求因 200 状态码已发出，只能往流里写错误片段（见[流式输出「会报什么错」](streaming-output.md#会报什么错)）。

## 还块：计数减到 0 才回池子，清空前缀缓存是另一回事

**还块只把本请求对每个块的引用计数减 1：归零的块排回空闲队列，显存数据与前缀缓存的指纹登记均保留。清空前缀缓存（`reset_prefix_cache`）则是独立动作：一次性抹掉所有块的指纹登记，让历史前缀不再可命中。**

每个块维护引用计数（借出 `0 → 1`，共享时 `> 1`，机制见 [KV 块分配](vllm-kv-block-allocation.md#请求要存-kv-时块从哪里来用完去哪里)）。A 借块顺序为「块 9 → 块 2 → 块 5」，引擎收尾时按**倒序**交回（空闲队列由 `3, 4, 6, 7` 变为 `3, 4, 6, 7, 5, 2`，空闲数 $4 + 2 = 6$）：

```wiki-diagram
file: request-teardown-fig-reverse-free
```

| 倒序交回顺序 | 释放前计数 | 减 $1$ 后计数 | 去向 |
| --- | --- | --- | --- |
| 第 1 个：块 5 | $1$ | $1 - 1 = \mathbf{0}$ | 排回空闲队列队尾 |
| 第 2 个：块 2 | $1$ | $1 - 1 = \mathbf{0}$ | 排回空闲队列队尾 |
| 第 3 个：块 9 | $2$（A 与 B 共享） | $2 - 1 = \mathbf{1}$ | B 仍在使用，留在 B 手里 |

**为什么倒序归还、且不抹指纹？** 空闲队列从队头借出：倒序还块让序列尾巴先入队尾、前缀开头块留得最久，方便 [prefix caching](prefix-caching.md#池子的预算怎么分满了怎么办) 复用。归零后的块 5、块 2 仍保留内容指纹——被队头借走覆盖前，相同前缀的新请求仍可捡回它们；真正被借给别人覆写时旧指纹才被驱逐（见[共享登记与驱逐](vllm-kv-block-allocation.md#引用计数什么时候大于-1共享登记与驱逐)）。

**清空前缀缓存（`reset_prefix_cache`）** 用于权重热更新或冷前缀压测，要求除 `null` 占位块外全池空闲。上例中 B 仍持有块 9（计数为 1）时，默认调用返回失败并打警告，须等 B 结束或显式指定先抢占运行请求后再清。

### 边界与例外

- **滑动窗口缓存组插回队头**：仅保留最近若干位置的滑动窗口组，其无指纹登记的块归还时直接插回队头优先复用。
- **延迟还块（KV connector 与在途写入保护）**：在 [PD 分离](pd-disaggregation.md)等挂载 KV connector（跨节点/跨介质传输 KV cache 的连接器接口）的场景，prefill 端须待 KV 发送完毕才真正还块与删表项（请求先标记结束并进清单）。`v0.26.0rc` 起新增的 `deferred_frees` 还会在多批在途接收端保护尚未完成写入的块，等在途步完成后再回收（详见后半实战对照）。

## 收尾的最后两步：worker 删行，前端更新路由表

**引擎释放之后，还有两处状态要对齐：worker 批次表晚一步删行；多 DP 组场景下前端路由表与协调器计数同步减 1。**

- **worker 晚一步删行**：引擎每步给 worker 的调度清单包含「上步以来已结束请求」一栏。worker 准备输入时据此删除对应缓存状态（提示词、采样参数、块号表）并移出批次表。即便 A 是最后一条请求，只要「已结束」清单非空，引擎仍多跑一次空调度把清单送达 worker。
- **多 DP 组更新路由与负载计数**：前端维护「请求 ID → 所在 DP 组」路由表以便定向发送中止；引擎每批回传结果附带已结束 ID，前端据此删表。同时各组向 DP 协调器上报最新的 `running` / `waiting` 数量，用于新请求选组（见 [DP 选组计数表](dp-request-routing.md#计数表从哪来为什么会过时)）。

## 抢占不是收尾：块还了，请求还在

**抢占（preemption）调用同一个还块动作，但请求并未结束：表项保留、已算位置清零并退回等待队列，前端不收到结束通知，客户端仅感知到短暂顿挫。**

两者仅有「还块」相同，三处截然不同（策略细节见[池子不够时宁可抢占](vllm-kv-block-allocation.md#池子不够时宁可抢占也不借一半)）：

- **请求表项留着**：状态改为被抢占、已算位置清零，不删除表项。
- **不进「已结束」清单**：worker 保留缓存状态，仅暂移出当前批次表，待重新排入后换新块号放回。
- **前端照常等待**：记录与输出槽不动，流式连接不断开。

抢占的主要代价是恢复重算。以**无可用缓存的示意**看账：A 提示词 100 token、已生成 50 token。恢复时这 150 个已知编号作为输入重建历史状态，再继续生成第 51 个输出（可按预算分步补算，且末枚新编号可能尚未前向，不能把 150 个位置全算成额外重复活）。**这里重建的是计算状态，不会删掉已生成的 50 个编号重新采样，也不会重发给客户端**。若开启 [prefix caching](prefix-caching.md)，重排时仍会先查可复用前缀块——已算位置清零不代表全部历史作废。

## 异步调度下：判停的时候，下一步已经排好了

**异步调度让 CPU 排程与设备计算重叠：卡上算第 $k$ 步时，引擎已提前排好第 $k+1$ 步。请求在第 $k$ 步结果里判停时，下一步替它算出的结果回来会被直接丢弃，worker 也再晚一步才删行。**

设 A 在第 $k$ 步采到结束 token（背景见 [async scheduling](async-scheduling.md#结果还没回来下一步怎么排先记输出占位)）：

1. 第 $k$ 步在卡上计算，结果未回。
2. 调度器提前排好第 $k+1$ 步，A 仍在 `running`，照常占位并按需借块。
3. 第 $k$ 步结果返回：A 判停释放，连同第 $k+1$ 步预借的块一并归还。
4. 第 $k+1$ 步结果返回：A 已不在请求表内，直接跳过不发前端。
5. 「A 已结束」赶不上已发出的第 $k+1$ 步清单，推迟到第 $k+2$ 步清单才通知 worker 删行。

**长度到限是例外**：排下一步前若确认「就算在途步候选全被拒也已达 `max_tokens`」，引擎就不再为它多排一步。前端先发现停止串或断连时逻辑相同：中止生效前多排的在途步结果均被引擎直接跳过。

下图把前端断连/停止串经 ZMQ 双队列通知引擎、倒序还块到异步延步删行的时序，与收尾/抢占/清空缓存三者边界集中对照：

```wiki-diagram
file: request-teardown-fig-abort-lifecycle
```

## 离线脚本怎样重置缓存，再比较下一轮？

**离线 `LLM` 对象可直接调用缓存重置方法，无须打开 HTTP 开发模式，但须区分对象并检查返回值。** 做冷前缀对照时，应先等本轮生成完全结束，再调 `reset_prefix_cache()`（默认不抢占运行请求、不重置外部 KV connector，返回布尔值表示是否成功）。

沿用块 9 例子：A 结束而 B 仍在跑时，默认重置失败；须等 B 结束或显式指定先抢占运行请求（B 退回等待队列重算，前端不会收到取消，但会打断节拍）。注意前缀重置只清索引，既不把显存 KV 字节抹零，也不释放块池显存。

**媒体预处理缓存是另一份独立状态。** `reset_mm_cache()` 清[多模态推理](multimodal-inference.md)的前处理与接收侧媒体缓存，不等同于清 KV 前缀，也不等于清视觉编码器已算出的特征池——编码结果在 `EncoderCacheManager` 中按单张媒体 `mm_hash` 独立维护引用计数与 `freeable` 淘汰生命周期（详见[多模态视觉特征缓存](multimodal-encoder-cache.md#encodercachemanager-如何独立于文本-prefix-caching-复用特征)；三类缓存分工见[多模态缓存](api-server-entry.md#三种缓存各自省掉哪一步)，冷启动核对见 [UCM 验证步骤](ucm.md#怎么开)）。存在在途请求时调用只发不同步警告、不阻塞等待，务必等当前请求完成后再重置。

## 多 DP 组与多缓存组收尾：R1 长度到限时三处各还了什么

对照 `GLM-5.3-Flash` 双机历史部署（[官方双机前提](glm-5-3-flash-two-node.md#部署前提)）：两台机器分属 DP0 / DP1，node0 上唯一 `API server` 接管全部请求。示例请求 [R1](one-request.md#示例请求-r1-与官方双机部署) 提示词 4 token、派到 DP0，设 `max_tokens = 200`——沿用[第 7 站](one-request.md#第-7-站-返回与收尾)，最后一圈前已出 `197` 个，本圈 MTP 验证产出 `4` 个，引擎追加到第 `200` 个时判 `length` 并**只把前 `3` 个发往前端**（GLM 三个结束编号见 [sampling](sampling.md#停止判断和长度上限)）：

| 进程与位置 | 收尾动作 | 异构与双机细节 |
|---|---|---|
| **引擎**（node0，DP0 `EngineCore`） | 同一步移出 `running`、记「已结束」清单、归还 **16–17 块**、删表项 | 按 3 类缓存组分流倒序还块：full 组 1 块与 KDA 组 12 块排回队尾；尾状态组 3–4 块属滑动窗口、无指纹登记，**插回队头**（账见[16–17 块一次还清](vllm-kv-block-allocation.md#结束1617-块一次还清)） |
| **worker**（node0，DP0 的 8 张卡） | 收到含「R1 已结束」的调度清单后，各卡删批次表 1 行 | 异步开启时紧邻清单已发出，要等再下一份清单才删；node1 的 DP1 worker 从未见过 R1，不受影响 |
| **前端**（node0 唯一 `API server`） | 还原最后 3 个 token、删记录、推出 `length` 末帧与 `[DONE]`（见[流式收尾](streaming-output.md#收尾长度到限再归还块号)） | 按引擎回传的已结束 ID 删 DP 路由表项；DP0 上报给协调器的 `running` 减 1 |

这套混合部署另有三条运行边界：

- **无指纹可抹、抢占需整段重建**：历史 GLM 混合模型默认关闭 prefix caching（见 [prefix caching](prefix-caching.md#glm-双机上它开着吗)）且无外部 KV connector，还块即计数 `1 → 0`，与清空前缀缓存无交集；但也因此被抢占时无缓存可复用，必须按整段已知历史重建计算状态（见[多条请求的 KV 块](concurrent-requests.md#kv-块一组的请求共用一个池子不够时最后进来的让位)）。
- **异步多排一步**：按默认条件推断开启异步调度（现场须查启动日志确认，条件见[调度器配置](vllm-scheduler.md#怎么开)）。本例最后一圈前已出 `197` 个，就算候选全拒也只到 `198`，无法预判到限，因此引擎仍提前排了下一步并在结果返回时跳过。
- **客户端第 20 token 断连（abort）**：前端先删记录，按路由表只向 DP0 发中止消息；DP0 在下份结果更新前释放 R1（默认不打断开/中止日志，需开 `--enable-log-requests`）。

### 变体边界：PD 分离下的延迟还源块与在途保护

官方 GLM 双机混部未配 KV connector，判停同一步即还块。切换为 [PD 分离](pd-disaggregation.md)后，prefill 端不能在判停当步立即回收源块，必须延迟到跨机 KV 传输完毕才释放源块与请求表项；decode 端在多批在途接收时，还需经 `deferred_frees` 保护尚未完成写入的目标块（跨版差异见页末）。

从单条请求收尾延伸到整套服务的优雅下线与故障恢复，可读[容量与恢复案例](inference-capacity-and-reliability.md#计划下线与突然故障为什么不能走同一条恢复路)。

## 常见误解

- **「客户端断开以后，引擎自己会发现、停下来。」** 引擎不连客户端，只与前端有消息通道；必须由前端发中止，否则引擎继续白算。
- **「引擎判停后，要等前端把最后一段文字推出去才还块。」** 顺序相反：引擎判停同一步先还块再发结果；仅停止字符串与客户端断开是前端先动手。
- **「请求结束了，它的块就全回到空闲队列。」** 仅引用计数归零的块回池，与他人共享的前缀块继续留在对方手里；配 KV connector 等待远端接收完成时也会推迟还块。
- **「还块就等于清空了前缀缓存。」** 还块只减引用计数，块指纹登记仍在；清空前缀缓存才抹指纹，且要求除 `null` 块外全池空闲。
- **「中止消息发两次，或者发给已结束的请求，会报错。」** 引擎查不到或已结束直接跳过，前端亦只发送仍在途的 ID。
- **「抢占就是让请求提前结束。」** 抢占只还块，请求表项与已生成编号保留，退回等待队列恢复后继续向同一前端交付。
- **「worker 在请求结束的那一步就删掉它那一行。」** worker 需等下一份调度清单才删行；异步调度下紧邻清单已发出，还要再晚一份。

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
