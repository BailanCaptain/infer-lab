---
id: request-call-chain
title: 一次请求的调用链
type: concept
summary: 从 HTTP 到 token 一共七跳。前两跳在上游 vLLM，进程边界在第二跳与第三跳之间，之后全在昇腾侧。
aliases: [调用链, call chain, 请求路径, 一次请求, execute_model 链路]
chapters: ["09"]
order: 10
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L611-L675
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L678-L680
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L729-L760
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L862-L880
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1950-L1968
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2404-L2410
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L78-L112
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L712-L725
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2060-L2075
verified: ["releases/v0.23.0"]
evidence: "C"
relations:
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 这条链路每一跳都假定 worker 已经走完六步启动，KV 张量和图都就位了
  - to: npu-model-runner
    kind: builds-on
    note: 第四到第七跳都在同一个文件里，那一页讲这个文件怎么分区
  - to: one-request
    kind: builds-on
    note: 上图画的就是那条请求第 92 步的调用栈
contradicts: []
updated: "2026-09-20"
origin: seed
---

## 一句话

一次请求从进来到产出 token，代码上是七跳。**分界线在第二跳和第三跳之间**：那里跨了进程，前面是上游 vLLM 的调度器，后面全是 `vllm_ascend` 的代码 [D]。

```wiki-diagram
file: request-call-chain
```

## 那条请求走到这里

上图画的就是那条请求的**第 92 步 decode**。这一步很典型：上游只给了 1 个 token 的名额和两个 block id，之后的七跳全是「怎么把这 1 个 token 算出来」。

缩进表示调用深度：**越往下越靠近硬件，昇腾自己的代码也越多**。第二跳和第三跳之间那条线是进程边界，也是责任边界——线以上的两跳默认跑的是上游代码，昇腾只在个别配置下用 `scheduler_cls` 把调度器换成自己的子类 [C8]。

## 七跳分别交接什么

**一、HTTP 或 `LLM.generate`。** 上游 vLLM 的入口，请求进队列。

**二、Scheduler。** 上游代码，决定这一步跑哪些请求、各自跑几个 token，产物是 `SchedulerOutput`。这一跳之后跨进程——`SchedulerOutput` 是跨进程传过来的那个对象 [D]，这解释了为什么昇腾要把一些跨进程状态挂在它身上（例子见 [NPUModelRunner 怎么读](npu-model-runner.md)）。

**三、`NPUWorker.execute_model(scheduler_output)`。** 昇腾侧第一跳。它先记显存统计、按 msmonitor 配置推进 profiling 的步数，然后处理 PP 的跨 rank 收发：如果这一步有 token 要算、且不是 PP 的第一个 rank，就用 `get_pp_group().irecv_tensor_dict()` 收上一段的 `intermediate_tensors`，并按是否开 SP 决定 `all_gather_group` 传不传 [C1]。`forward_pass` 这个布尔量来自 `scheduler_output.total_num_scheduled_tokens > 0`，但在这一跳只用来决定收不收 `intermediate_tensors` [C1]——「这一步要不要真的跑 forward」是下一跳的 runner 判断的 [C9]。

**四、`NPUModelRunner.execute_model`。** 本卡这一步的主循环 [C5]。

**五、`_prepare_inputs`。** 把请求集合变成算子要的张量，返回 `logits_indices`、`spec_decode_metadata`、`total_num_scheduled_tokens` 三样 [C4]。它开头就断言 `total_num_scheduled_tokens > 0` [C4]。之前还有一跳 `_update_states`，负责把调度结果合进本卡的持久状态 [C3]。

**六、模型 forward → 注意力后端。** 算子按 `block_table` 与 `slot_mapping` 逐块读写 KV。哪个后端被调到在启动时就定了，见 [注意力后端家族](attention-backend-family.md)。

**七、`sample_tokens`。** 采样并产出 `ModelRunnerOutput` [C6]。注意 `NPUWorker` 侧也有一个 `sample_tokens`，它接 `grammar_output` 参数后直接转给 runner [C2]——结构化输出那条路径是从这里进的。

## 哪几跳是昇腾自己的

| 跳 | 代码归属 | 改它要动哪里 |
|---|---|---|
| 一、二 | 默认是上游 vLLM | 要么用 `scheduler_cls` 换成 `vllm_ascend/core/` 下的调度器子类 [C8]，要么走 [Patch 机制](ascend-patch-system.md) |
| 三 | `vllm_ascend/worker/worker.py` | 直接改 |
| 四、五、七 | `vllm_ascend/worker/model_runner_v1.py` | 直接改 |
| 六 | `vllm_ascend/attention/*.py` + `vllm_ascend/ops/` | 直接改 |

这张表是「我这个改动该落在哪」的第一判断依据 [A]。落在前两跳的需求，在昇腾仓库里只能换掉整个调度器类或写成 patch；落在后五跳的，直接改子类 [D]。

## 一条 traceback 怎么对上这七跳

栈是倒序的，从下往上找第一个 `vllm_ascend` 帧，就知道进到了第几跳 [A]：

- 最深处是 `torch_npu` 或 aclnn 调用 → 第六跳，看算子层；
- 最深处在 `_prepare_inputs` 里 → 第五跳，多半是形状或槽位问题；
- 栈里根本没有 `vllm_ascend` 帧 → 问题在前两跳，先去上游查，再看有没有对应 patch。

完整的定位方法见 [怎么读这个仓库](reading-vllm-ascend.md)。

## 常见误解

- **「Worker 的 `execute_model` 就是跑模型」**——它主要在处理 PP 的跨 rank 收发与统计，真正的执行在下一跳的 runner 里 [C1]。
- **「每一步都会跑 forward」**——这一步可能没有任何 token 要算，runner 在 `_prepare_inputs` 之前就返回 `EMPTY_MODEL_RUNNER_OUTPUT` 了 [C9]。
- **「采样在模型 forward 里」**——采样是单独一跳 `sample_tokens` [C6]，而且 worker 侧还有一层同名转发用于结构化输出 [C2]。
