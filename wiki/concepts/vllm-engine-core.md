---
id: vllm-engine-core
title: 引擎的那个循环：转一圈就是一步
type: concept
summary: 整个推理引擎的中心是一个很短的循环：挑一批请求、算一次、每条请求各吐一个 token，然后再转一圈。那条请求的 200 个 token，就是它转了 200 圈。
aliases: [busy loop, 引擎循环, engine step, EngineCoreProc, 一步是什么, 引擎主循环, step, 迭代, run_busy_loop]
chapters: ["10"]
order: 20
sources:
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1223-L1231
  - vllm@0fc695fc:vllm/v1/engine/core.py#L443-L472
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1233-L1250
  - vllm@0fc695fc:vllm/v1/engine/core.py#L819-L841
  - vllm@0fc695fc:vllm/v1/engine/core.py#L474-L482
  - vllm@0fc695fc:vllm/v1/engine/core.py#L484-L492
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1329-L1335
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1801-L1819
  - vllm@0fc695fc:vllm/config/scheduler.py#L146-L149
  - vllm@0fc695fc:vllm/config/vllm.py#L933-L1002
  - vllm@0fc695fc:vllm/config/vllm.py#L497-L507
  - vllm@0fc695fc:vllm/v1/engine/core.py#L188-L220
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: vllm-v1-shape
    kind: builds-on
    note: 这个循环跑在三个进程里的中间那个，边界上传什么在那一页
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一句话

你问了一句 37 个 token 的话，模型回了 200 个 token。这几秒里，机器反复在做的**到底是哪一件事**？

答案是一个循环，而且只有一个。它每转一圈做三件事：**挑一批请求、把这一批算一次、每条请求各吐一个 token**。转一圈叫**一步**。[那条请求](one-request.md)的回答有 200 个 token，就是这个循环为它转了 200 圈。

```wiki-diagram
file: engine-core-loop
```

## 一步里只有三件事

机器上专门有一个进程守着这个循环（它是哪个进程、和另外几个怎么分工，见[引擎有哪几个进程](engine-processes.md)）。循环的每一圈是这样的：

1. **挑一批。** 手上可能同时有好几条请求在跑。**调度器**（每一步决定这一批放哪些请求进来的那段代码）先看一遍：这一步让哪些请求上，每条各算几个 token。同一步里一起算的那些请求，就叫**一批**。
2. **算一次。** 把这一批交给 NPU。在我们的例子里是两颗 NPU 一起算：把这一批的 token 从第 1 层走到第 40 层（「层」是什么见[层与隐藏向量](layers-and-hidden.md)），等结果回来。
3. **各吐一个 token。** 结果回来后，每条请求各拿到一个新 token；调度器按结果记账——谁又往前走了一步、谁已经说完了。

然后回到第 1 件，转下一圈。

**没有第四件事，也没有任何一处在区分「这是 prefill 还是 decode」。** 这是这一页最值得记住的一句。第一步手里有 37 个 token、之后每步只有 1 个，差别全在「挑一批」时调度器给了多少名额，循环本身一个字都不变。怎么给名额，见[调度器](vllm-scheduler.md)。

## 那条请求在这个圈里走了 200 圈

- **它来之前**：循环手上没有请求，**它不在空转，而是睡着**，等有请求送到门口才醒。
- **第 1 圈**：请求送到，被排进等待的队里。这一圈调度器给了它 37 个 token 的名额，两颗 NPU 把问题整段算完（这就是 [prefill](prefill.md)），吐出回答的第 1 个 token，记账：「已经算了 37 个」。
- **第 2 到第 200 圈**：每圈只给它 1 个 token——上一圈刚吐出来的那个。走的路和第 1 圈**完全一样**。
- **第 200 圈**：记账时发现吐出来的是「结束」记号，把它标成完成，它占的那个 KV 块（存注意力笔记的一段显存，见 [KV Cache](kv-cache.md)）还回去。手上没别的请求了，循环又睡回去。

所以「那条请求跑了多久」，在引擎眼里的准确说法是：**这个循环为它转了 200 圈**。

如果同一时间还有别的请求，它们**不另开循环**，而是挤进同一圈：同一步里，我们这条算 1 个 token，另一条可能正在算它的整段问题——两条凑成一批，一起算一次，各吐各的。

## 没活的时候，它在睡觉

每一圈开头其实还有一道门：**「现在有活吗？」**

- 有活（有请求没算完），这道门直接穿过去，几乎不花时间；
- 没活，它就停在门口**睡着等**，把 CPU 完全让出来，直到有新请求送到才醒。

「等活」和「干活」被写成两段，就是为了让「没活」这件事有个单独的地方处理：干活那段不用操心要不要睡。

## 送下去之后，不干等

「算一次」这件事，引擎交出去之后**不用站着等**。它拿到一张「回执」，算完再凭回执取结果。

这个空档目前塞了一件小事：给需要按格式输出的请求（比如只许输出 JSON）准备一张「这一步允许哪些 token」的表，见[结构化输出](structured-output.md)。

更要紧的是，**在默认配置下，引擎把这个空档用得更狠**：这一批送下去之后，不等结果回来，就先去挑下一批。这样 NPU 刚算完一批，下一批已经在门口排着，中间不留空。这套做法叫[异步调度](async-scheduling.md)，那条请求默认走的就是它；三件事的骨架不变，只是第 2 件和下一圈的第 1 件叠在了一起。

## 先销账，再记账

结果回来之后，引擎先处理「算的这段时间里被取消的请求」，然后才按结果记账。顺序不能反：反过来就会给一条用户已经取消的请求记上新 token。

## 常见误解

- **「引擎是事件驱动的」**——不是。它是一个按部就班的循环，一圈接一圈；「来一个请求处理一个」那种异步只发生在最前面接请求的进程里。
- **「每个请求有自己的循环」**——没有。所有请求共用这一个循环，一圈里一起往前走一步。
- **「空闲时在不停地查有没有新请求」**——不是。没活就睡着等，有请求送到才醒。
- **「一步吐出来的就是文字」**——不是。吐出来的是 token 的编号，变回文字是最前面那个进程做的（token 和编号的关系见 [token](token.md)）。

## 对照源码

### 怎么开

- **循环本身**不用开，`EngineCoreProc` 起来就跑 `run_busy_loop`：`while self._handle_shutdown()` 里只有 `_process_input_queue()` 和 `_process_engine_step()` 两句 [C1]。
- **每一步调的函数**由 `step_fn` 决定：`batch_queue` 为空时是 `step()`，否则是 `step_with_batch_queue()` [C12]。`batch_queue_size = vllm_config.max_concurrent_batches`，大于 1 才建 `batch_queue`。
- `step()` 就是上半那三件事加一道空检查 [C2]：
  1. `scheduler.has_requests()` 为假直接返回；
  2. `scheduler.schedule()`——挑一批；
  3. `model_executor.execute_model(scheduler_output, non_block=True)` 拿 future，中间取 `get_grammar_bitmask`，再 `future.result()`；
  4. `_process_aborts_queue()` 之后 `scheduler.update_from_output(...)`——先销账再记账。
- **`async_scheduling` 默认是 `None`** [C9]。配置检查走自动分支：pooling 模型、非 EAGLE/NGram 类投机解码、`disable_padded_drafter_batch=True`、执行器不支持，这四道闸一道都不撞就置成 `True` [C10]。
- 置成 `True` 后，`max_concurrent_batches` 在 V1 model runner 且 PP=1 时返回 2，V2 model runner 返回 `pp_size + 1`（PP=1 时同样是 2）[C11]，于是 `batch_queue` 建起来，`step_fn` 指向 `step_with_batch_queue` [C6]。它既不是 PP 专用，也不需要多条请求——那条请求走的就是这条路径。闸的清单逐版本不同，欠条（占位 token）怎么记见[异步调度](async-scheduling.md)。
- 同步模式下 `post_step` 还会取草稿 token 交给调度器；异步模式下这件事挪到 Worker 进程里做 [C5]。

### 会报什么错

- **显式** `async_scheduling=True` 时不做降级而是硬失败：
  - 投机解码方法不在 EAGLE / MTP / Draft Model / NGram GPU 里 → `ValueError: Currently, async scheduling is only supported with EAGLE/MTP/Draft Model/NGram GPU kind of speculative decoding`；
  - 同时开了 `disable_padded_drafter_batch=True` → `ValueError: Async scheduling is not compatible with disable_padded_drafter_batch=True.`；
  - 执行器后端不支持 → ``ValueError: `<backend>` does not support async scheduling yet.``
- 默认（`None`）撞上这些闸时只打 warning 并置成 `False`；无论开没开，都会打一行 `Asynchronous scheduling is enabled/disabled.`，看启动日志就知道走的是哪条路径。

### 版本差异

- **v0.23（上游 0fc695fc）**：本页行号都以它为准。
- **v0.26（上游 releases/v0.26.0）**：骨架不变，`run_busy_loop` 在 `vllm/v1/engine/core.py:1358-1366`，`step()` 在 `core.py:576-606`，`step_fn` 的选择在 `core.py:225`。两处小变化：`schedule()` 多传一个 `self._should_throttle_prefills()`（`core.py:587`）；多了 `capture_iteration_details` / `_attach_iteration_details`，把每步的迭代明细挂到输出上（`core.py:591`、`core.py:604`）。
- **main**：没有配套上游检出，本页未核。

### 源码位置

- `vllm/v1/engine/core.py:1223-1231` — `run_busy_loop`，外层 while。
- `vllm/v1/engine/core.py:443-472` — `step()`：空检查、`schedule`、`execute_model(non_block=True)`、grammar bitmask、`future.result()`、`_process_aborts_queue`、`update_from_output`。
- `vllm/v1/engine/core.py:1233-1250` — `_process_input_queue`：`while not self.has_work()` 时 `input_queue.get(block=block)`；`block` 取 `process_input_queue_block`，在 `core.py:922` 置 `True`，只在弹性 EP 扩缩容时置 `False`（`core.py:1990`、`core.py:2060`）。`has_work()` 看 `engines_running`、`scheduler.has_requests()`、`batch_queue` 三者（`core.py:1211-1217`）。
- `vllm/v1/engine/core.py:819-841` — `preprocess_add_request`：`EngineCoreRequest` → `Request`，结构化输出请求顺带 `grammar_init`。
- `vllm/v1/engine/core.py:474-482` — `post_step`：同步模式下取草稿 token。
- `vllm/v1/engine/core.py:484-492` — `step_with_batch_queue` 的说明：队列没满先调度新一批，填队列优先于取结果。
- `vllm/v1/core/sched/scheduler.py:1329-1335` — `Scheduler.update_from_output` 入口。
- `vllm/v1/core/sched/scheduler.py:1801-1819` — `Scheduler.add_request`：新请求 `_enqueue_waiting_request` 进 waiting 队列。
- `vllm/config/scheduler.py:146-149` — `async_scheduling: bool | None = None`。
- `vllm/config/vllm.py:933-1002` — 显式开启的硬失败与默认 `None` 的自动分支。
- `vllm/config/vllm.py:497-507` — `max_concurrent_batches`。
- `vllm/v1/engine/core.py:188-220` — `batch_queue_size`、`batch_queue` 的创建与 `step_fn` 的选择（`core.py:192-198`、`core.py:217-218`）。
- [D] 「那条请求 = 转了 200 圈」：每一步每条在跑的请求最多采一个新 token（不开投机解码时），回答 200 个 token 即 200 步；「所有请求共用一个循环」「吐出的是 token id、变回文字在前端进程」同样由上面的结构推出。
