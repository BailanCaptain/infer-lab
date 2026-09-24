---
id: request-call-chain
title: 一次请求的调用链
type: concept
summary: 一条请求从接口进来到吐出下一个 token，要走七站：前两站是上游 vLLM 在定「这一步算谁」，从第三站起全是昇腾的代码在管「怎么算」；分界线在多卡时还是一道进程边界。
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
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/__init__.py#L50-L50
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L744-L745
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_delivery_preemption.py#L58-L82
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L101-L101
  - vllm@0fc695fc:vllm/config/parallel.py#L889-L890
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: npu-worker-lifecycle
    kind: builds-on
    note: 这条链路每一站都假定 worker 已经走完六步启动，KV 张量和图都就位了
  - to: npu-model-runner
    kind: builds-on
    note: 第四到第七站都在同一个文件里，那一页讲这个文件怎么分区
  - to: one-request
    kind: builds-on
    note: 上半的例子走的就是那条请求的第 1 步和第 92 步
contradicts: []
updated: "2026-09-25"
origin: seed
---

你按下回车，几秒之后屏幕上开始一个字一个字往外蹦。这中间你那句话去了哪儿？它从接口进来，到 NPU 上真正开算，要经过几站、每站在干嘛？出了问题，又该去哪一站找？

## 从接口到 NPU，一共七站

```wiki-diagram
file: request-call-chain
```

图上这条路，机器每转一圈就从左到右走一遍。一圈叫**一步**：挑出一批请求，算一次，各吐一个 token（引擎怎么转圈，见[引擎的那个循环](vllm-engine-core.md)）。七站是：

**一、接口收下请求。** 你的话在这里被切成 [token](token.md)，排进队伍等着被算。

**二、调度器发名额。** [调度器](vllm-scheduler.md)每一步决定**这一批**（同一步里一起算的那些请求）放谁进来、各算几个 token，顺便把「你的笔记该住显存哪个块」的块号也定好，写成一张清单交给后面。名额是按「还差多少个没算」分的，调度器眼里没有 prefill 和 decode 之分。

**这里换边。** 前两站的逻辑是上游 vLLM 的；从第三站起，跑的全是昇腾仓库自己的代码。多卡时这条线还是一道**进程**边界（进程：操作系统里同时跑着的一份程序，互相不共享内存）——清单要跨进程送过去才到第三站；单卡时两边同住一个进程，但交接的清单一模一样。谁住在哪个进程，见[引擎有哪几个进程](engine-processes.md)。

**三、Worker 接活。** [Worker](npu-worker-lifecycle.md) 是守着一颗 NPU 干活的那个进程。它拿到清单先干的不是算，而是管**多颗卡之间的收发**：模型被切成几段接力跑时，它负责收上一段传来的半成品，本卡算完再发给下一段。

**四、本卡主循环。** Worker 随手把清单转给[本卡真正的执行总管](npu-model-runner.md)。这一步要不要真的算——清单上可能一个 token 都没有——由它拍板；算完怎么交差也归它。

**五、把请求摆成张量。** 算子只认对齐的数字表。这一站把清单翻译成算子要的张量：这一步的每个 token 属于哪条请求、排在第几位、它的笔记该写进哪个块的哪一格，全在这里定下。

**六、跑模型。** 张量摆好，从第 1 层走到最后一层（我们例子里的模型是 40 层），注意力算子沿途按第五站定好的位置读写 [KV Cache](kv-cache.md) 里的笔记。真正调到哪个注意力算子，启动时就定了，见[注意力后端家族](attention-backend-family.md)。

**七、采样。** 最后一层的输出变成一串分数，从里面挑出下一个 token，打包交回上游。一圈到此走完，下一步再从第二站开始。

## 那条请求走一遍

[那条 37 个 token 的请求](one-request.md)在这条路上的两个瞬间：

- **第 1 步（prefill）**：第二站发给它 37 个 token 的名额和一个块号——一个块有 2048 个位置，它整条请求 237 个 token 从头到尾住这一个块就够了。第五站把 37 个 token 并排摆好，第六站 40 层一起算、10 层全注意力每层写 37 格笔记，第七站挑出回答的第 1 个 token。
- **第 92 步（decode）**：名额只有 1 个，块号还是那一个。这一步送进去的是上一步刚挑出的回答第 91 个 token，第五站算出它的笔记该落在块里的第 127 格（从 0 数；推导在下半），第六站 10 层全注意力各写一格、读前面全部，第七站挑出回答的第 92 个 token。

## 想改哪一站，去哪儿改

后五站是昇腾仓库里自己的文件，想改直接改。前两站不一样：调度逻辑长在上游 vLLM 里，昇腾仓库想动它只有两条路——把整个调度器换成自己的子类，或者用 [Patch 机制](ascend-patch-system.md)在启动时把上游的类偷偷换掉。事实上昇腾默认就干了后者：第二站实际跑的类是上游调度器的抄件，逻辑照旧，多一道默认关着的闸门，见 [Balance Scheduling](balance-scheduling.md)。

所以排查问题时第一个要判断的是「在线的哪一边」：报错栈里全是上游的文件，就先去上游查（再看有没有对应的补丁）；出现昇腾的文件，看它落在第几站。具体怎么按文件名认站，在下半。

## 常见误解

- **「Worker 那一站在跑模型」**——它主要在管卡间收发和统计，真正的执行从第四站才开始。
- **「每一步都会真的算一遍」**——这一步可能一个 token 名额都没有，第四站直接交一份空产出就回去了。
- **「挑字是模型的一部分」**——采样是单独的第七站；而且结构化输出（限定模型只能吐合法 JSON 之类）另有一条小门直通这一站，见下半。

## 对照源码

### 版本差异

七站的划分、每站的职责和交接物，releases/v0.23.0 与 releases/v0.26.0rc 一致；差异只在第二站实际跑的是哪个类：

| 项 | v0.23 维护分支 与 main 开发主线 | v0.26 分支 | 意味着什么 |
|---|---|---|---|
| `BalanceScheduler` 的父类 | 上游 `Scheduler` [C11] | 同在 patch 里的 `KVDeliveryScheduler` [C13]，它自己也带一份完整的 `schedule()` [C12] | [!] 第二站的栈多一层，按文件名认站时别把这一层当成昇腾的执行侧 |

开关与语义见 [Balance Scheduling](balance-scheduling.md)，这里只关心它对「第几站」的影响。

### 源码位置

上半的七站对应的调用链：

| 站 | 代码 | 归属 |
|---|---|---|
| 一 | HTTP 入口 / `LLM.generate`，上游 vLLM | 上游 |
| 二 | `Scheduler.schedule()` 产出 `SchedulerOutput`；实际跑的类见下 | 逻辑在上游，类被 patch 换过 |
| 三 | `NPUWorker.execute_model(scheduler_output)`，`vllm_ascend/worker/worker.py` | 昇腾 |
| 四 | `NPUModelRunner.execute_model`，`vllm_ascend/worker/model_runner_v1.py` | 昇腾 |
| 五 | `_prepare_inputs`（之前还有一跳 `_update_states`） | 昇腾 |
| 六 | 模型 forward → `vllm_ascend/attention/*.py` + `vllm_ascend/ops/` | 昇腾 |
| 七 | `sample_tokens` | 昇腾 |

逐条展开：

- **第二站跑的类**：昇腾的 platform patch 无条件把 `Scheduler` 这个名字换成 `BalanceScheduler`——`patch/platform/__init__.py` 固定 import `patch_balance_schedule`，后者末尾直接赋值 `vllm.v1.core.sched.scheduler.Scheduler = BalanceScheduler`。此外平台代码还会按配置把 `scheduler_cls` 指到 `vllm_ascend/core/` 下的其他子类（如 `SchedulerDynamicBatch`、`ProfilingChunkScheduler`）[C8]。
- **进程边界**：`SchedulerOutput` 是为跨进程传输设计的交接对象；单卡默认执行器是 `uni`（上游在 `world_size == 1` 时自动选它），此时是进程内的一次调用 [D]。这也解释了为什么昇腾把一些跨步状态挂在 `SchedulerOutput` 身上（例子见 [NPUModelRunner 怎么读](npu-model-runner.md)）。
- **第三站只管收发**：`NPUWorker.execute_model` 先记显存统计、按 msmonitor 配置推进 profiling 步数，然后处理 PP 的跨 rank 收发——`forward_pass` 来自 `scheduler_output.total_num_scheduled_tokens > 0`，为真且不是 PP 第一个 rank 时用 `get_pp_group().irecv_tensor_dict()` 收上一段的 `intermediate_tensors`，并按是否开 SP 决定 `all_gather_group` 传不传。`forward_pass` 在这一站只用来决定收不收中间结果；「这一步要不要真的跑 forward」由第四站判断——没有 token 名额时 runner 在 `_prepare_inputs` 之前就返回 `EMPTY_MODEL_RUNNER_OUTPUT`。
- **第五站的交接物**：`_prepare_inputs` 返回 `logits_indices`、`spec_decode_metadata`、`total_num_scheduled_tokens` 三样，开头就断言 `total_num_scheduled_tokens > 0`。
- **第七站与结构化输出**：runner 的 `sample_tokens` 产出 `ModelRunnerOutput`；`NPUWorker` 侧还有一个同名 `sample_tokens`，接 `grammar_output` 参数后直接转给 runner——结构化输出那条路径从这里进。
- **想改哪站落在哪** [A]：前两站只能换调度器类 或走 [Patch 机制](ascend-patch-system.md)；第三站改 `worker/worker.py`，四、五、七站改 `worker/model_runner_v1.py`，第六站改 `attention/*.py` 与 `ops/`，都直接改。
- **一条 traceback 怎么对上七站** [A]：栈是倒序的，从下往上找第一个 `vllm_ascend` 帧——最深处是 `torch_npu` 或 aclnn 调用 → 第六站，看算子层；最深处在 `_prepare_inputs` 里 → 第五站，多半是形状或槽位问题；栈里根本没有 `vllm_ascend` 帧 → 前两站，先去上游查，再看有没有对应 patch。反过来不成立：栈里出现 `patch/platform/patch_balance_schedule.py` 仍然是第二站，那是被换掉名字的调度器；v0.26 分支上这一帧也可能落在 `patch/platform/patch_kv_delivery_preemption.py`，同样是第二站。完整的定位方法见[怎么读这个仓库](reading-vllm-ascend.md)。
- **上半例子数字的出处**：37 / 200 / 237、块 2048 个位置、10 层全注意力每层写一格，都是[那条请求](one-request.md)页里的已核值；「第 92 步写第 127 格」是推导 [D]：第 92 步送进去的是回答第 91 个 token，它的位置 = 37 + 91 − 1 = 127（从 0 数），整条请求 237 个 token 都住在同一个块里，块内格号就等于位置号。
