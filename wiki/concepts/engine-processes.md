---
id: engine-processes
title: 引擎有哪几个进程
type: concept
summary: 在两颗 NPU 上跑起一个模型，机器上会有四个进程：接请求的 Main、每一步排队的 EngineCore、每颗 NPU 一个的 Worker；只用一颗 NPU 时 Worker 不另起进程，住在 EngineCore 里。昇腾要改的上游代码分散在这几处，补丁也要分三条路送进去。
aliases: [EngineCore, Main 进程, Worker 进程, 进程边界, V1 引擎进程, 引擎的三类角色, patch 注入点, uni 执行器, 多进程执行器]
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
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/__init__.py#L43-L48
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/__init__.py#L50-L50
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L744-L745
  - vllm@0fc695fc:vllm/config/parallel.py#L889-L890
  - vllm@0fc695fc:vllm/v1/executor/uniproc_executor.py#L45-L63
  - vllm@0fc695fc:vllm/config/parallel.py#L776-L780
  - vllm@0fc695fc:vllm/config/parallel.py#L845-L886
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L176-L192
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: ascend-patch-system
    kind: builds-on
    note: 几个进程的差别落到代码上就是补丁打在哪，补丁机制本身在那一页
  - to: one-request
    kind: builds-on
    note: 那条请求在四个进程里各是什么形态，决定了什么东西跨步活着
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一句话

一条昇腾推理服务跑起来不是一个程序，而是几个**进程**（操作系统里同时跑着的一份程序，互相不共享内存）：接请求的 **Main**、每一步决定放谁进来的 **EngineCore**、真正守着 NPU 算模型的 **Worker**。用几颗 NPU 就有几个 Worker 进程；**只用一颗 NPU、又没有手动指定时，Worker 不另起进程，而是住在 EngineCore 进程里**。昇腾要改的上游行为分散在这几处，所以它的补丁也要从三条不同的路分别送进去。

```wiki-diagram
file: engine-processes
```

## 先数一数：跑起来有几个进程

全库跟的那个例子是 Qwen3.6-35B-A3B 跑在一张 Atlas A3 卡的两颗 NPU 上（见[那条请求](one-request.md)）。服务起来以后，打开系统的进程列表数一数，和 vLLM 本体有关的是**四个**：

1. **Main 进程**：你敲启动命令时起的那一个。它读参数、决定用哪个硬件平台，再把后面几个进程拉起来。
2. **EngineCore 进程**：Main 拉起来的第一个子进程，里面是[调度器](vllm-scheduler.md)和 [KV Cache](kv-cache.md) 的账本。
3. **Worker 进程 × 2**：两颗 NPU 各一个。模型的每一层被对半切开（[张量并行（TP）](tensor-parallel.md)），每个 Worker 手里各有一半，真正的计算在它们手里发生。

为什么是四个而不是三个？因为这个例子用了两颗 NPU。vLLM 的规矩是：参与计算的 NPU 超过一颗，就给每颗起一个 Worker 进程；只有一颗时，默认不另起，直接在 EngineCore 进程里造一个 Worker 出来——那时候数下来只有两个进程。

## 每个进程里住着什么

| 进程 | 里面跑什么 | 这条服务里有几个 |
|---|---|---|
| Main | 读参数、选平台、把问题切成 [token](token.md)、拉起其余进程 | 1 |
| EngineCore | 调度器：每一步决定这一批放哪些请求进来；记着每条请求的 KV Cache 放在哪几块 | 1 |
| Worker | 模型权重、KV Cache 本体、昇腾的算子调用 | 用几颗 NPU 就几个；只用一颗时住进 EngineCore |

这三者之间传东西都要跨进程：进程互相不共享内存，传过去的东西得先打包成一份能发送的清单。EngineCore 每一步交给 Worker 的清单里几乎全是整数（这一步放谁、每条算几个 token、KV 写进哪几块），就是为「要跨进程发出去」设计的。在我们的例子里，同一份清单每一步都要发给两个 Worker，两边拿到一样的清单、各算自己那一半。

## 只有一颗 NPU 时少一个进程

这一条容易记反，单独说清楚它的条件：

- **一颗 NPU、没有手动指定怎么起 Worker**：vLLM 选「单进程」的起法，Worker 是 EngineCore 进程里的一个对象。清单不用跨进程发，直接在进程内调用，但清单的样子一模一样。
- **两颗及以上、同一台机器上、没有手动指定**：默认给每颗 NPU 起一个 Worker 子进程，我们的例子就是这种。
- **手动指定了起法**（比如用 Ray 这类分布式框架）：按你指定的来，上面两条默认规则不再适用。

所以说「Worker 进程」时要带上前提：多颗 NPU 时它确实是独立进程；一颗 NPU 时它只是一个角色，身子在 EngineCore 进程里。

## 那条请求在四个进程里各是什么样

那个 37 个 token 的问题、200 个 token 的回答，在四个进程里留下的痕迹很不一样：

- **在 Main 里**：它只待了一下。文字在这里被切成 token，然后交给 EngineCore；之后每一步计算都不再经过这个进程。
- **在 EngineCore 里**：它是一条请求记录，从头到尾都在。模型整体走了 200 遍，它就在调度器里转了 200 圈；它的 KV Cache 放在哪一块，也记在这里。
- **在两个 Worker 里**：它每一圈进来一次，变成这一步的输入，算完就丢——下一圈进来的是新的一份。每个 Worker 算的是每层的一半，两边每层要对一次答案，再往下一层走。

「什么东西跨步活着」的答案就在最后一条：只有显存里给这条请求划下的那两块地方（全注意力层的 KV Cache、线性注意力层的状态，见[那条请求](one-request.md)）和调度器里记着的块号一直在，别的每一圈都重来。

## 为什么补丁要分三条路送

昇腾的做法是**补丁**（patch）：vLLM 的代码不改，程序运行起来以后，把上游某些函数、某些类换成昇腾自己的版本。问题是「换」这个动作只在当前进程里有效。

- Main 进程里打过的补丁，**不会被子进程继承**。EngineCore 和 Worker 都是新起的 Python 程序，要在它们自己身上再换一遍。
- 所以补丁有三个入口，一个进程一条路：
  - **Main**：平台刚被选中的那一刻，打一遍「全局补丁」。
  - **EngineCore**：vLLM 会在 EngineCore 进程里加载昇腾的插件；昇腾在其中三个插件入口的第一行都塞了「全局补丁再打一次」。每个进程里有一个「打过了」的记号，只在本进程内有效，所以第二、第三个入口不会重复打，而换一个进程又会重新打一遍。
  - **Worker**：Worker 被造出来的那一刻，打「Worker 补丁」。这一条不挑进程：单颗 NPU 时它发生在 EngineCore 进程里，多颗时在每个 Worker 进程里各发生一遍。

中间那条最不直观。它存在的直接原因是：只靠 Main 那一次，EngineCore 进程里的调度器根本不会被换掉。

## 进程怎么摆，直接决定要打哪些补丁

举一个具体的例子。[EPLB](eplb.md)（按负载重新摆专家的那个特性）打开后，Worker 要再拉起一个子进程去做摆放计算。可上游起 Worker 时给它打了一个「不许再生子进程」的标记。于是昇腾专门有一个补丁，换掉起 Worker 的那段代码，把这个标记去掉——而且只在打开 EPLB 相关开关时才生效，平常的服务（包括我们的例子）里 Worker 还是按上游的方式起的。

这个例子说明两件事：一是进程模型不是背景知识，它直接决定了要改哪里；二是这类补丁必须归在 Main / EngineCore 那一侧打，因为起 Worker 的那段代码在 Worker 出生之前就要跑。

## 排查时先认进程

看到一条报错，先判断它出在哪个进程，能省掉一大半查找范围：

- 报在参数检查阶段（比如某种并行组合不合法）→ Main 进程，看昇腾平台那一组检查，见 [NPU 平台](npu-platform.md)。
- 调用栈里有调度器、KV Cache 的账本 → EngineCore 进程，昇腾只能通过补丁在这里插手。
- 调用栈里有模型的前向计算、注意力、昇腾算子 → Worker，这里大部分是昇腾自己的代码。

具体认哪些函数名，见下半「会报什么错」。

## 常见误解

- **「补丁在 Main 里打一次就全局生效了」**——不会。子进程是新起的程序，要在它自己身上再打一遍；这正是 EngineCore 那条路存在的原因。
- **「Worker 一定是单独的进程」**——多颗 NPU 时是；只用一颗、又没手动指定时，它住在 EngineCore 进程里。
- **「EngineCore 里跑的全是上游代码」**——调度逻辑和 KV Cache 的账本确实是上游的，但调度器那个类被昇腾的补丁无条件换掉了，见 [Balance Scheduling](balance-scheduling.md)。
- **「这几个进程是昇腾引入的」**——不是，这是 vLLM 自己的进程模型；昇腾只是必须适配它。官方设计文档也是从这个进程模型出发讲补丁的。

## 对照源码

### 怎么开

**Worker 怎么起，由执行器（`distributed_executor_backend`）决定。** 不手动指定时的默认值：

- `world_size = pipeline_parallel_size × tensor_parallel_size × prefill_context_parallel_size` [C15]。例子是 `--tensor-parallel-size 2`，其余为 1，`world_size = 2` [D]。
- `world_size`（跨 DP 合计）大于 1 且没指定时，默认 `mp`（多进程执行器）；只有在装了 Ray 且已处于 Ray placement group 中，或已显式要求 Ray 作为 DP 后端时才改成 `ray` [C16]。
- `world_size == 1` 且没指定时，定成 `uni` [C13]。`UniProcExecutor._init_executor()` 直接在当前进程里 `WorkerWrapperBase(rpc_rank=0)` → `init_worker` → `init_device` → `load_model` [C14]——所以单 NPU 时 Worker 是 EngineCore 进程里的对象。
- `MultiprocExecutor` 按 `local_rank in range(local_world_size)` 逐个 `WorkerProc.make_worker_process(...)`，每颗 NPU 一个子进程；传进去的 `input_shm_handle=scheduler_output_handle` 就是每步清单的广播通道 [C17]。

**三条补丁入口：**

| 进程 | 入口 | 依据 |
|---|---|---|
| Main | `NPUPlatform.pre_register_and_update()` 里的 `adapt_patch(is_global_patch=True)` | [C4] |
| EngineCore | 四个 general plugin 里有三个（`register_connector` / `register_model_loader` / `register_service_profiling`）第一行调 `_ensure_global_patch()` | [C1][C2] |
| Worker | `NPUWorker.__init__` 开头的 `adapt_patch()` | [C5][C6] |

- `_ensure_global_patch()` 的 docstring 给了理由：vLLM 在 engine-core 子进程里加载 general plugin，E2E 测试的 conftest hook 在那个进程里不跑，所以影响调度器与引擎代码的全局 patch 必须也经由这些 plugin 入口再打一次。
- `_GLOBAL_PATCH_APPLIED` 布尔量只在进程内去重；子进程是新的 Python 解释器，`import` 副作用要重新发生，所以 Main 里打过的 platform patch 不会被继承 [D]。
- Main 进程里，`AsyncLLM.add_request()` 用 `process_inputs` 把文字切成 token id 再交给 EngineCore [C9]。
- EngineCore 里的调度器类：`patch_platform/__init__.py` 无条件导入 `patch_balance_schedule` [C11]，它把 `Scheduler` 换成 `BalanceScheduler` [C12]。

**EPLB 那条补丁：** `AscendMultiprocExecutor(MultiprocExecutor)` 在第 199 行把子进程 `daemon` 设成 `False` [C7]；patch 清单写明原因——vLLM 用 `daemon=True` 创建子进程，而 EPLB 要再起一个进程，`daemon=True` 的进程不允许 [C3]。它只在设了 `DYNAMIC_EPLB` 或 `EXPERT_MAP_RECORD` 环境变量时才导入 [C10]。这类 patch 归在 `platform` 而不是 `worker`，因为 executor 要在 worker 存在之前建好 [D]。

### 会报什么错

按栈里的名字认进程 [A]：

- 参数校验阶段的报错（并行组合不合法等）→ Main 进程，看 `NPUPlatform` 的校验，见 [NPU 平台](npu-platform.md)。
- 栈里有 `Scheduler` / `BalanceScheduler`、`KVCacheManager`、`SchedulerOutput` 的构造 → EngineCore 进程，昇腾侧只可能经 platform patch 介入。
- 栈里有 `NPUWorker`、`NPUModelRunner`、attention 后端、`torch_npu` 调用 → Worker（多 NPU 时是 Worker 子进程；`uni` 时在 EngineCore 进程里）。

### 版本差异

- **v0.23.0 与 v0.26.0rc**：三条入口的结构一致。`_ensure_global_patch` 都在 `vllm_ascend/__init__.py:21`，三个调用点都在 `:45 / :55 / :65`；平台入口 `adapt_patch(is_global_patch=True)` 在 v0.23 的 `platform.py:188`、v0.26rc 的 `platform.py:187`；Worker 入口 `adapt_patch()` 在 v0.23 的 `worker/worker.py:110`、v0.26rc 的 `worker/worker.py:119`。
- **main（baa023ad）**：结构不变，行号后移——`_ensure_global_patch` 在 `vllm_ascend/__init__.py:55`，调用点在 `:79 / :89 / :99`；平台入口在 `platform.py:304`；Worker 入口在 `worker/worker.py:138`。main 配套的上游 vLLM 没有检出，执行器默认值（`uni` / `mp`）在 main 侧未核，按 v0.23 配套上游的结论写。

### 源码位置

- 执行器默认值：`vllm/config/parallel.py:776-780`（`world_size`）、`:845-886`（多卡默认 `mp` / `ray`）、`:889-890`（单卡 `uni`）
- 单进程执行器在当前进程造 Worker：`vllm/v1/executor/uniproc_executor.py:45-63`
- 多进程执行器每颗 NPU 起一个子进程：`vllm/v1/executor/multiproc_executor.py:176-192`
- EngineCore 那条补丁路：`vllm_ascend/__init__.py:19-35`、`:44-77`
- Main 那条：`vllm_ascend/platform.py:184-188`
- Worker 那条：`vllm_ascend/worker/worker.py:75-110`
- EPLB 的 daemon 补丁：`vllm_ascend/patch/platform/patch_multiproc_executor.py`、`patch/platform/__init__.py:43-48`、`patch/__init__.py:57-68`
- 调度器被换：`patch/platform/__init__.py:50`、`patch_balance_schedule.py:744-745`
- 官方设计文档：`docs/source/developer_guide/Design_Documents/patch.md` [S8]
