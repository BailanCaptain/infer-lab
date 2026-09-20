---
id: npu-model-runner
title: NPUModelRunner 怎么读
type: feature
summary: 5251 行的单文件，继承上游 GPUModelRunner。按九个区读，不要从头读；每个区对应一个可以单独进入的方法。
aliases: [NPUModelRunner, model_runner_v1, model_runner_v1.py, execute_model]
chapters: ["09"]
order: 30
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L211-L267
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L268-L282
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L729-L760
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L862-L880
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1950-L1968
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2404-L2410
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3367-L3375
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3843-L3865
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4909-L4915
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L505-L523
evidence: "C"
relations:
  - to: prepare-inputs-flow
    kind: builds-on
    note: 最长那一区做的事单独成页，张量怎么拼出来在那里讲
  - to: one-request
    kind: builds-on
    note: 那条请求的一步只走过这个文件里的四段，其余都是启动期或另一条路径
contradicts: []
updated: "2026-09-19"
origin: seed
---

## 一句话

`vllm_ascend/worker/model_runner_v1.py` 在 v0.23 分支上有 5251 行 [D]，是全仓最大的单文件。它只定义一个主类 `NPUModelRunner`，而且**继承的是上游的 `GPUModelRunner`** [C2]——这条继承关系是读这个文件的前提：文件里没有的方法不是缺失，是沿用上游 [D]。

```wiki-diagram
file: model-runner-layout
```

## 那条请求走到这里

那条请求的第 92 步 decode，在这个文件里只走过四个区：

| 行号 | 这一步在这儿干了什么 |
|---|---|
| L729 `_update_states` | 把「这一步算它 1 个 token、它现在有两块」合进本卡状态 |
| L862 `_prepare_inputs` | 算出 `slot_mapping = [b1 × 128]`，拼出三张形状 `(1,)` 的张量 |
| L1950 `execute_model` | 跑 28 层 |
| L2404 `sample_tokens` | 采出 1 个 token id |

**一步只走过 5251 行里的四段。** 剩下那些要么属于启动期（`initialize_kv_cache`、`get_kv_cache_spec`），要么属于另一条路径（`_dummy_run`）。

这就是这个文件的正确读法：**不要问「这个文件在干什么」，要问「我关心的那一步走过哪几段」**——前一个问题在 5251 行面前没有答案 [A]。

## 九个区，从哪儿进都行

上图是按行号切的九个区。实际使用时不要从第 1 行往下读，而是先决定你要改什么行为，再直接跳进对应的区 [A]：

| 你想做的事 | 进哪个方法 |
|---|---|
| 看调度结果怎么合进本卡状态 | `_update_states`（第 729 行）[C3] |
| 看张量怎么拼出来 | `_prepare_inputs`（第 862 行）[C4] |
| 改一步执行的主流程 | `execute_model`（第 1950 行）[C5] |
| 改采样与输出 | `sample_tokens`（第 2404 行）[C6] |
| 改 profile 或图捕获用的假批 | `_dummy_run`（第 3367 行）[C7] |
| 改 KV 张量怎么分配 | `initialize_kv_cache` / `initialize_kv_cache_tensors`（第 3843 行起）[C8] |
| 改每层每块的 KV 形状声明 | `get_kv_cache_spec`（第 4909 行）[C9] |

`_prepare_inputs` 一个方法从 862 行到 1663 行，占全文件近六分之一 [D]。它是这个文件里最值得先读的一段，内容单独成页：[prepare_inputs 数据流](prepare-inputs-flow.md)。

## 构造函数里有两条能省很多时间的注释

`__init__` 开头就改了传进来的配置：把 `prefill_context_parallel_size * 2 * max_num_seqs` 加到 `scheduler_config.max_num_batched_tokens` 上，注释标了 TODO 并给出上游 PR 链接，说明这是为扩几个 buffer 而做的手工 pad，等那个 PR 合了要撤掉 [C2]。

紧接着还有一条：某些字段**必须在 `super().__init__()` 之前设好**，因为父类的初始化可能调到 `_allocate_kv_cache_tensors`，而那个方法会访问 `self.use_compress` [C2]。

这两条注释说明了读这类子类文件的通用方法：**先看它在 `super().__init__()` 前后各做了什么** [A]。前面的是父类会依赖的东西，后面的是覆盖与补充 [D]。

## `execute_model` 开头就有一段跨进程约定

主循环的前几十行里有一段值得单独记：当 `profiling_chunk_config.need_timing` 为真时，它检查 `scheduler_output.disable_profiling_timing` 来决定是否关掉计时，注释写明了原因——**这个标志通过 `scheduler_output` 跨进程传递，因为在调度器进程里改配置单例不会影响到 worker 进程** [C5]。

这是 [三个进程与 patch 注入点](engine-processes.md) 那条约束在实际代码里的直接后果：跨进程要传状态，只能挂在本来就会传过来的那个对象上。

## 这个文件在启动时才被实例化

`NPUModelRunner` 的对象是在 `NPUWorker.init_device` 里造的，不是在 `__init__` 里 [C10]。同一处还按 `use_v2_model_runner` 决定是否换成 `worker/v2/model_runner.py` 里的那个实验性实现 [C10]。所以看到 `worker/v2/` 时不要以为主线已经切过去了 [D]。

## 常见误解

- **「文件里没有某个方法就是不支持」**——它继承 `GPUModelRunner` [C2]，没覆盖的方法走上游实现。判断「昇腾改了没有」要看这个文件里有没有同名方法，不是看有没有这个功能。
- **「行号可以当书签」**——这是全仓改动最频繁的文件之一，行号在两个 ref 之间就会漂。引用要写 `repo@commit:path#L起-L止`。
- **「`_dummy_run` 是测试代码」**——它是生产路径的一部分：profile 显存和捕获 ACL Graph 都靠它跑假批 [C7]。
