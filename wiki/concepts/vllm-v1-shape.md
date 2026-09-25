---
id: vllm-v1-shape
title: vLLM 的形状：三类角色，两道边界
type: concept
summary: 敲下 vllm serve 之后跑起来的，是几个分了工的进程：一个管文字，一个管排队，每颗 NPU 再配一个管计算。一条请求要往下穿过两道边界再回来，每过一道，手里拿的东西就换一种：字、整数、张量。
aliases: [vLLM 的形状, vLLM V1 架构, vLLM 进程结构, AsyncLLM, EngineCore 进程, 前端进程, Executor, 执行器, EngineCoreRequest, SchedulerOutput]
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
  - vllm@0fc695fc:vllm/config/parallel.py#L889-L890
  - vllm@0fc695fc:vllm/v1/executor/uniproc_executor.py#L45-L63
  - vllm@0fc695fc:vllm/config/parallel.py#L845-L851
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L176-L191
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: one-request
    kind: builds-on
    note: 这一页讲的是那条 37 个 token 的请求要走过的三类角色，双 NPU 的设定和数都从那一页来
contradicts: []
updated: "2026-09-25"
origin: seed
---

一条请求在 vLLM 里要**下去两层再上来两层**。三类角色各管一种东西：前端只认字，EngineCore 只认整数，Worker 才认张量。跨一次边界就换一种东西——这是理解后面所有事情的地基。

```wiki-diagram
file: vllm-v1-shape
```

## 装好 vLLM 跑起来，跑的到底是什么

照[贯穿全库的例子](one-request.md)那样，在一张 Atlas A3 卡的两颗 NPU 上把 Qwen3.6-35B-A3B 启动起来，命令只有一行 `vllm serve`。看上去是「一个程序」，但它起来之后，机器上干活的主要是**四个进程**（进程：操作系统里同时跑着的一份程序，互相不共享内存）：

- 一个**前端**进程：守着网络端口收你的提问，把字切成 [token](token.md)，最后再把 token 拼回字；
- 一个 **EngineCore** 进程：排队、决定这一步算谁、给每条请求分显存；
- 两个 **Worker** 进程：两颗 NPU 各配一个，模型真正在它们手里算。

所以「vLLM 是什么」最实在的答案是：**一个管文字的、一个管排队的、每颗 NPU 一个管计算的，中间用两道边界隔开。**

## 那条请求在三层里各长什么样

你那句 37 个 token 的提问，在这三层里是三种完全不同的东西：

| 在哪一层 | 它长什么样 |
|---|---|
| 前端 | 一段中文字符串；往下交之前变成 37 个整数（token 的编号） |
| EngineCore | 一条请求记录：「这一步要算 37 个」这个数、排在哪条队里、一张显存块的编号清单 |
| 两个 Worker | 各自手里一份张量：37 个 token 编号、37 个位置、37 个「写进显存哪一格」的地址 |

**同一条请求，三种身份。** 读源码时最容易迷路的地方就在这里：在 EngineCore 里找不到任何张量，在 Worker 里找不到任何字符串，两边都对。

两个 Worker 拿到的是同一份安排，各自摊出同样的 37 个位置；真正分开干活，是在模型的[每一层](layers-and-hidden.md)里面——[注意力](attention-qkv.md)对半切、每层的 256 个[专家](moe.md)分成两堆，那是[张量并行](tensor-parallel.md)和[专家并行](expert-parallel.md)两页的事。

## 为什么非要切成三块

因为这三件事卡在不同的地方，塞在一起会互相拖死：

- **前端**要同时应付很多个网络连接，时间花在等收发上；
- **EngineCore** 要尽快把下一步排出来，最怕被别的事情卡住；
- **Worker** 大部分时间在等 NPU 算完。

分开之后，前端接新请求的同时，EngineCore 可以在排下一步，Worker 可以在算上一步。代价是**跨边界交接的东西一律要能打包寄出去**：交给下一层的只是编号、整数和参数，不是「那条请求本身」。后面很多看起来绕的设计，根子都在这里。

## 两道边界上交接什么

**第一道：前端 ↔ EngineCore。** 下去的是一个小包：37 个 token 编号、怎么挑下一个 token 的参数、请求的编号。上来的是新算出来的 token 编号，以及「是不是结束了」。**两边都不传文字**——把编号拼回文字这件事在前端做，所以只有前端手里有分词器。

**第二道：EngineCore ↔ Worker。** 下去的是「这一步的安排」：哪些请求、每条算几个 token、写进显存哪几块。上来的是这一步算出来的结果。这道边界更值得注意：它是**责任边界**——过了这道线，「算哪些 token」已成定局，剩下的全是「怎么算」。这正是 [vLLM 与昇腾各管什么](who-owns-what.md) 那一页讲的那条线。

## 中间那个传话的执行器

第二道边界上还夹着一层容易被误认成主角的东西：**执行器**。

排队和分显存都在 EngineCore 里做完了；执行器的活只是**把同一个吩咐同时发给每颗 NPU 上的 Worker，再把回话收回来**。在这个例子里就是一份安排发给两个 Worker。它能发的吩咐是固定的几种：准备好设备、加载模型、跑一步、采样。真正干活的是收到吩咐的 Worker。

启动时也是这个顺序：执行器先等两个 Worker 起来、设备准备好、模型加载完，才回头问一句「这块硬件的显存块大小要不要改」。不过块大小其实早在更前面就定下了，这一问在昇腾上只做一件小事；细节在下半。

## 常见误解

- **「EngineCore 里能看到模型」**——看不到。模型只在 Worker 手上，EngineCore 里做调度的那部分只有配置和整数。
- **「执行器在做调度」**——不做。它只传话；调度在 EngineCore 里、在执行器被叫到之前就做完了。
- **「这几个进程是靠多线程一起跑的」**——前端靠一个能同时挂着很多网络连接的事件循环，跨进程靠发消息；EngineCore 自己是一个一圈一圈转的普通循环，见[引擎的那个循环](vllm-engine-core.md)。同名的[异步调度](async-scheduling.md)是第三件事：循环照样一圈一圈转，只是不等上一步的结果就排下一步，它默认开着。
- **「Worker 永远是单独的进程」**——不一定。只用一颗 NPU 时，Worker 默认就住在 EngineCore 进程里，边界还在，只是交接变成了同一个进程里的直接调用。

## 对照源码

### 怎么开

启动命令与[贯穿例子](one-request.md)的「对照源码」一致（`--tensor-parallel-size 2 --enable-expert-parallel --enable-prefix-caching`）。本页关心的只是它起出几个进程：

- **前端与 EngineCore 分进程**：前端是 `AsyncLLM`，分词在 `InputProcessor` [C1]，`add_request` 把请求打成 `EngineCoreRequest` 经 ZMQ 发给 EngineCore [C2]；反分词在 `OutputProcessor` [C6]。边界 ① 上的两种消息 `EngineCoreRequest` / `EngineCoreOutputs` 定义在 [C12]。
- **Worker 几个进程由执行器后端决定**：`distributed_executor_backend` 未指定且 `world_size_across_dp > 1` 时默认 `"mp"` [C17]；`MultiprocExecutor` 对每个 local rank 调一次 `WorkerProc.make_worker_process` [C18]。TP=2 → 两个 Worker 进程。`world_size == 1` 时默认 `"uni"` [C15]，`UniProcExecutor` 在 EngineCore 进程里直接持有 worker 对象 [C16]。
- 「主要四个进程」= 前端 1 + EngineCore 1 + Worker 2 [D]；不含可能存在的辅助进程。
- 两个 Worker 收到的是同一份 `SchedulerOutput`（执行器按 rank 广播），各自在 `_prepare_inputs` 里摊出 `input_ids` / `positions` / `slot_mapping`，形状都是 `(37,)` [D]；TP 只切层内的权重和头，不切这批 token。37 补成 38、每颗 19 个发生在进专家之前，见[专家并行](expert-parallel.md)。

### 源码位置

| 角色 / 边界 | 位置 |
|---|---|
| 前端分词 · 发请求 · 反分词 | `InputProcessor`、`AsyncLLM.add_request`、`OutputProcessor` |
| 边界 ① 的消息 | `EngineCoreRequest` / `EngineCoreOutputs` |
| EngineCore 收请求、跑一步 | `EngineCore.add_request`，`step` 一带；`run_busy_loop` 是同步 while 循环 |
| 调度与分块 | `Scheduler.schedule`、`KVCacheManager`，都在 EngineCore 进程里 |
| 边界 ② 的消息 | 下去 `SchedulerOutput`、上来 `ModelRunnerOutput`[C8] |
| 执行器能广播的调用 | `WorkerBase`：`init_device`、`load_model`、`execute_model`、`sample_tokens` 等 |
| 张量一侧入口 | `NPUModelRunner` |

补充几条上半只点到的事实：

- **为什么边界 ② 上全是 id**：跨边界交接一律按「可序列化」设计——多 NPU 时真要序列化发到别的进程，单 NPU 时同一个对象走进程内调用——所以 `SchedulerOutput` 里塞的全是 id、整数和可序列化的参数，没有一条 `Request` 的引用 [A]。
- **启动顺序与块大小**：`WorkerProc` 先跑完 `init_device` 与 `load_model`，才调 `current_platform.update_block_size_for_backend`。昇腾的这个钩子只在「不开前缀缓存 + 混合 KV 管理 + KV 传输 + mamba align 模式」时对齐 `mamba_block_size`，源码 TODO 写明 block size 仍在更早的 `check_and_update_config` 里定；普通模型在那里经 `refresh_block_size` 默认设成 128。本页例子是混合模型，块大小走另一条路定成 2048，推导见[贯穿例子](one-request.md)的「对照源码」。
- **前端的并发模型**：前端是 asyncio，跨进程靠 ZMQ；EngineCore 自己是同步循环。
