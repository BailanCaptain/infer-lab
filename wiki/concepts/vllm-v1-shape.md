---
id: vllm-v1-shape
title: vLLM 的形状：三个进程，两道边界
type: concept
summary: 那条请求要下去两层再上来两层。每跨一道边界，它携带的东西就换一种：字 → 整数 → 张量。
aliases: [vLLM 的形状, vLLM V1 架构, vLLM 进程结构, AsyncLLM, EngineCore 进程, 前端进程]
chapters: ["10"]
order: 10
sources:
  - vllm@0fc695fc:vllm/v1/engine/input_processor.py#L242-L250
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L280-L290
  - vllm@0fc695fc:vllm/v1/engine/core.py#L341-L350
  - vllm@0fc695fc:vllm/v1/engine/core.py#L403-L472
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1223-L1231
  - vllm@0fc695fc:vllm/v1/engine/output_processor.py#L576-L582
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L625-L650
  - vllm@0fc695fc:vllm/v1/worker/worker_base.py#L114-L158
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L346
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L110-L115
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L268-L269
  - vllm@0fc695fc:vllm/v1/engine/__init__.py#L170-L227
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L311-L331
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1369-L1381
verified: ["releases/v0.23.0"]
evidence: "C"
relations:
  - to: one-request
    kind: builds-on
    note: 这一页讲的是那条 37 token 的请求要走过的三个进程，数都从那一页来
contradicts: []
updated: "2026-09-20"
origin: seed
---

## 一句话

一条请求在 vLLM 里要**下去两层再上来两层**。三个进程各管一种东西：前端只认字，EngineCore 只认整数，Worker 才认张量。跨一次边界就换一种东西——这是理解后面所有事情的地基。

```wiki-diagram
file: vllm-v1-shape
```

## 那条请求走到这里

[那条请求](one-request.md)在这三层里分别是什么样子：

| 在哪一层 | 它长什么样 |
|---|---|
| 前端进程 | 一段中文字符串；出来时是 37 个整数 |
| EngineCore 进程 | 一条 `Request` 对象：37 这个数、两条队列里的一个位置、一张 block id 列表 |
| Worker 进程 | 若干张张量：`input_ids` 形状 `(37,)`、`positions` 形状 `(37,)`、`slot_mapping` 形状 `(37,)` [D] |

**同一条请求，三种身份。** 读源码时最容易迷路的地方就在这里：在 EngineCore 里找不到任何张量，在 Worker 里找不到任何字符串，两边都对。

## 为什么非要切成三个进程

因为这三件事的瓶颈完全不同，塞在一个 Python 进程里会互相拖死：

- **前端**要处理 HTTP 并发，是 IO 密集的 asyncio 循环；
- **EngineCore** 要尽快把下一步排出来，怕被任何东西阻塞住；
- **Worker** 大部分时间在等 NPU 算完，是 GIL 的重灾区。

分开之后，前端接新请求的同时 EngineCore 可以在排下一步，Worker 可以在算上一步 [A]。代价是**每跨一次边界都要序列化**，这解释了后面很多看起来绕的设计——比如为什么 `SchedulerOutput` 里塞的全是 id、整数和可以序列化的参数，没有一条 `Request` 的引用。

## 两道边界上各传什么

**边界 ①（前端 ↔ EngineCore，走 ZMQ）**

下去的是 `EngineCoreRequest`：token id 列表、采样参数、请求 id。上来的是 `EngineCoreOutputs`：新产出的 token id 和结束原因 [C12]。**两边都不传文本**——反分词在前端做，所以前端进程里才有 tokenizer [C1][C6]。

**边界 ②（EngineCore ↔ Worker）**

下去的是 `SchedulerOutput`，上来的是 `ModelRunnerOutput` [C4][C8]。这道边界更值得注意：它不只是进程边界，还是**责任边界**——过了这道线，「算哪些 token」已成定局，剩下的全是「怎么算」。这正是 [vLLM 与昇腾各管什么](who-owns-what.md) 那一页讲的那条线。

## 执行器只是个传声筒

中间还有一层容易被误认成主角的东西：`Executor`。

承接这一步的是 `Scheduler` 与 `KVCacheManager`，它们都活在 EngineCore 进程里 [C9][C10]；张量那一侧的入口是 `NPUModelRunner` [C11]。

它的活是**把同一个调用广播到每张卡的 Worker 上再收回来**——单卡时只有一个 Worker，多卡时才谈得上广播。`WorkerBase` 定义了它能广播哪些调用：`init_device`、`load_model`、`execute_model`、`sample_tokens` 等 [C8]。真正干活的是被广播到的 `Worker`。

执行器要等 Worker 起来、`init_device` 和 `load_model` 都跑完，才回头问平台一句「这块硬件的 block size 要不要改」 [C7]。但昇腾把 `block_size` 顶成 128 不在这条路上：这个钩子在昇腾上只用来对齐 mamba 的块大小，源码里的 TODO 自己写明 block size 仍然是在更早的 `check_and_update_config` 里定的 [C13]，那里默认就把它设成 128 [C14]。

## 常见误解

- **「EngineCore 里能看到模型」**——看不到。模型只存在于 Worker 进程，EngineCore 手上只有配置和整数 [D]。
- **「Executor 在做调度」**——不做。它只转发，调度在 EngineCore 进程里、在 Executor 被调用之前就做完了 [D]。
- **「异步是靠多线程」**——前端是 asyncio，跨进程靠 ZMQ；EngineCore 自己是个同步的 while 循环 [C5]。
