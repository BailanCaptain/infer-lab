---
id: vllm-engine-core
title: EngineCore：那个 while 循环
type: concept
summary: 整个推理引擎的心脏是一个不到十行的 while 循环。那条请求的 200 步，就是它转了 200 圈。
aliases: [busy loop, 引擎循环, engine step, EngineCoreProc, 一步是什么, 引擎主循环]
chapters: ["10"]
order: 20
sources:
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1223-L1231
  - vllm@0fc695fc:vllm/v1/engine/core.py#L443-L472
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1233-L1250
  - vllm@0fc695fc:vllm/v1/engine/core.py#L341-L350
  - vllm@0fc695fc:vllm/v1/engine/core.py#L474-L482
  - vllm@0fc695fc:vllm/v1/engine/core.py#L484-L492
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1329-L1335
evidence: "C"
relations:
  - to: vllm-v1-shape
    kind: builds-on
    note: 这个循环跑在三个进程里的中间那个，边界上传什么在那一页
contradicts: []
updated: "2026-09-19"
origin: seed
---

## 一句话

`EngineCore` 进程启动之后只做一件事：**转圈**。每转一圈，所有在跑的请求各往前走一步。[那条请求](one-request.md)的 200 个 token，就是这个圈转了 200 次。

```wiki-diagram
file: engine-core-loop
```

## 循环体一共四句话

```python
while self._handle_shutdown():
    self._process_input_queue()   # 1) 没活干就在这儿等
    self._process_engine_step()   # 2) 走一步
```

外面这层就这么长 [C1]。里面那一步是 `step()`，也只有四件事 [C2]：

1. **没有请求就直接返回**（`has_requests()` 为假）；
2. `scheduler.schedule()` —— 算出这一步谁跑、各跑几个 token；
3. `model_executor.execute_model(...)` —— 送下去，等结果；
4. `scheduler.update_from_output(...)` —— 按结果更新每条请求的状态。

**没有第五件事，也没有任何 if 在区分 prefill 和 decode。** 这是这一页最值得记住的一句。

## 那条请求走到这里

- **第 0 圈**：那条请求还没来。`_process_input_queue` 里的 `while not self.has_work()` 为真，循环阻塞在 `input_queue.get(block=True)` 上——**引擎空转时是真的在睡，不是在忙等** [C3]。
- **第 1 圈**：前端把 `EngineCoreRequest` 塞进队列，阻塞解除。`add_request` 把它变成一条 `Request` 放进 waiting 队列 [C4]，然后 `step()` 第一次跑起来：schedule 给它 37 个 token 的名额，execute 算完，update 记下「已经算了 37 个」。
- **第 2 到第 200 圈**：每圈给它 1 个 token。代码路径和第 1 圈**完全一样**。
- **第 200 圈之后**：`update_from_output` 发现采出了 EOS，把它标成结束，KV block 还回去，队列空了，循环又回到 `input_queue.get()` 上睡着。

所以「那条请求跑了多久」这个问题，在代码里的准确形式是：**这个循环为它转了 200 圈** [D]。

## 为什么要把「等」和「算」分成两个函数

`_process_input_queue` 和 `_process_engine_step` 拆开，是为了让「没活干」这件事有地方处理。

有活干的时候，`_process_input_queue` 里的 `while not self.has_work()` 直接为假，一次都不阻塞地穿过去；只有队列空了它才真的阻塞 [C3]。也就是说这个函数在忙的时候几乎不花时间，闲的时候把 CPU 完全让出来。写成一个函数就得在里面判断要不要 block，读起来会乱得多。

另外还有一条**分支队列**的路径 `step_with_batch_queue` [C6]：它允许上一步的结果还没回来就先排下一步，用来把 NPU 的空档填上。那条请求只有一条，用不上它——这条路径要多条请求才有意义。

## 一个容易被跳过的细节：结果是 future

`step()` 里 `execute_model(..., non_block=True)` 拿到的是一个 future，之后才 `future.result()` 取值 [C2]。中间那几行做的是**取 grammar bitmask**（结构化输出用的掩码）。

这意味着：**送下去执行之后、等结果之前，EngineCore 还能干点别的** [D]。目前塞在这个空档里的是 grammar 相关的准备工作；这个空档的存在本身，是后面异步调度那一整套东西的立足点。

结果回来之后先处理中途到达的 abort，再 `update_from_output` [C2]——顺序是有讲究的：先销账再记账，免得给已经被取消的请求记上新 token。

## 常见误解

- **「引擎是事件驱动的」**——不是。它是一个同步的 while 循环；异步只在前端进程那一层 [C1]。
- **「每个请求有自己的循环」**——没有。所有请求共用这一个循环，一圈里一起往前走一步 [D]。
- **「空闲时在轮询」**——不是。队列空了就阻塞在 `get()` 上 [C3]。
- **「`step()` 返回的就是文本」**——不是。返回的是 `EngineCoreOutputs`，里面是 token id；变回文字在前端进程 [D]。
