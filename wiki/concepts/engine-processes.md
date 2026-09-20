---
id: engine-processes
title: 三个进程与 patch 注入点
type: concept
summary: V1 引擎跑起来是 Main、EngineCore、Worker 三类进程；昇腾的 patch 要分别进这三处，用的是三条不同的路。
aliases: [EngineCore, Main 进程, Worker 进程, 进程边界, V1 引擎进程]
chapters: ["10"]
order: 80
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L19-L35
  - vllm-ascend@2c59ff10:vllm_ascend/__init__.py#L44-L77
  - vllm-ascend@2c59ff10:vllm_ascend/patch/__init__.py#L57-L68
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L184-L188
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L89-L92
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L75-L110
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_multiproc_executor.py#L24-L199
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/patch.md#L1-L20
  - vllm@0fc695fc:vllm/v1/engine/async_llm.py#L340-L383
evidence: "C"
relations:
  - to: ascend-patch-system
    kind: builds-on
    note: 三类进程的差别落到代码上就是 patch 打在哪，机制本身在那一页
  - to: one-request
    kind: builds-on
    note: 那条请求在三个进程里各是什么形态，决定了什么东西跨步活着
contradicts: []
updated: "2026-09-20"
origin: seed
---

## 一句话

一条昇腾推理服务跑起来不是一个进程，而是三类：解析参数的 Main、跑调度器的 EngineCore、每张卡一个的 Worker。**只有 Worker 进程真正碰 NPU**；但昇腾需要改的上游行为分布在三处，所以 patch 也要从三条不同的路进去 [D]。

```wiki-diagram
file: engine-processes
```

## 那条请求走到这里

那条请求在三个进程里各留下不同的痕迹：

- **Main 进程**：它只在这里待了一下——`AsyncLLM.add_request()` 用 `process_inputs` 把文字分成 token id，再把它交给 EngineCore [C9]；之后每一步计算都不再经过这个进程。
- **EngineCore 进程**：它是一条 `Request` 对象，在这里待了 200 圈。第 92 圈时 `KVCacheManager` 为它要了第二块。
- **Worker 进程**：它每一圈进来一次，变成几张形状 `(1,)` 的张量，算完就没了——**下一圈再进来是新的张量**，只有 KV Cache 留在显存里。

「什么东西跨进程活着」这个问题的答案就在最后一句：**只有 KV Cache 和 block id 活着**，别的每一圈重来。这也解释了为什么 `SchedulerOutput` 里塞的全是整数。

## 三条路各是哪一条

| 进程 | 里面跑什么 | patch 怎么进去 |
|---|---|---|
| Main | 解析命令行、选平台、请求在这里分词、拉起 EngineCore | `NPUPlatform.pre_register_and_update()` 里的 `adapt_patch(is_global_patch=True)` [C4] |
| EngineCore | 调度器、KV Cache 管理（上游 vLLM 的代码） | 四个 general plugin 里有三个各自调 `_ensure_global_patch()` 补一次 [C1][C2] |
| Worker | `NPUWorker` + `NPUModelRunner`，真正的算子调用 | `NPUWorker.__init__` 开头的 `adapt_patch()` [C6] |

中间那一行是三条里最不直观的。`_ensure_global_patch()` 的 docstring 直接给了理由：vLLM 在 engine-core 子进程里加载 general plugin，而 E2E 测试的 conftest hook 在那个进程里不会跑，所以影响调度器与引擎代码的全局 patch 必须也经由这些 plugin 入口再打一次 [C1]。

换句话说：**Main 进程打过的 platform patch 不会被子进程继承** [D]。子进程是新起的 Python 解释器，`import` 的副作用要重新发生一遍 [D]。`_ensure_global_patch` 的 `_GLOBAL_PATCH_APPLIED` 布尔量只在**进程内**去重 [C1]，跨进程不起作用，这正是它能在每个子进程里各生效一次的原因。

## 一个进程模型影响代码的具体例子

`patch/platform/patch_multiproc_executor.py` 里定义了 `AscendMultiprocExecutor(MultiprocExecutor)`，在第 199 行把子进程的 `daemon` 设成 `False` [C7]。原因写在 patch 清单里：vLLM 用 `daemon=True` 创建子进程，而 EPLB 场景需要再起一个进程，`daemon=True` 的进程不允许这么做 [C3]。

这条能说明两件事 [D]。一是进程模型不是背景知识，它直接决定了要打哪些 patch。二是这类 patch 归在 `platform` 而不是 `worker`——因为 executor 是在 worker 存在之前就要建好的。

## 排查时的用处

看到一条报错，先判断它出在哪个进程，能省掉一大半查找范围 [A]：

- 栈里有调度器、KV Cache 管理器、`SchedulerOutput` 的构造 → EngineCore 进程，昇腾侧只可能通过 platform patch 介入；
- 栈里有 `NPUModelRunner`、attention 后端、`torch_npu` 调用 → Worker 进程，昇腾侧代码占主体；
- 报错在参数校验阶段（比如某个并行组合不合法）→ Main 进程，看 `NPUPlatform` 的那组校验，见 [NPUPlatform](npu-platform.md)。

## 常见误解

- **「patch 在主进程打一次就全局生效了」**——不会。子进程是新解释器，`import` 副作用要重新发生；这就是 general plugin 里那三个 `_ensure_global_patch()` 存在的原因 [C1][C2]。
- **「EngineCore 里跑的是昇腾代码」**——那里主要是上游 vLLM 的调度器与 KV Cache 管理，昇腾只通过 patch 改它的行为 [C1]。
- **「三类进程是昇腾引入的」**——不是，这是 vLLM V1 引擎自己的进程模型；昇腾只是必须适配它。官方设计文档也是从这个进程模型出发解释 patch 的 [S8]。
