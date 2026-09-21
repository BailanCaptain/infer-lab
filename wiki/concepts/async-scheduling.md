---
id: async-scheduling
title: "异步调度：下一步的调度压在上一步的执行底下"
type: feature
summary: EngineCore 把这一步送下去之后不等结果，直接调度下一步；调度器靠给「还没产出」的 token 记一个占位，让那道减法照样算得出来。
aliases: [异步调度, Async Scheduling, async_scheduling, AsyncScheduler, Async output, step_with_batch_queue, num_output_placeholders, 占位 token]
chapters: ["12"]
order: 40
sources:
  - vllm@0fc695fc:vllm/config/scheduler.py#L146-L149
  - vllm@0fc695fc:vllm/config/vllm.py#L933-L1002
  - vllm@0fc695fc:vllm/config/scheduler.py#L168-L176
  - vllm@0fc695fc:vllm/config/vllm.py#L497-L507
  - vllm@0fc695fc:vllm/v1/engine/core.py#L188-L220
  - vllm@0fc695fc:vllm/v1/engine/core.py#L484-L546
  - vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L19-L41
  - vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L51-L67
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L403-L407
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L997-L1013
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L381-L395
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1105-L1120
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1955-L1971
  - vllm@0fc695fc:vllm/v1/request.py#L140-L146
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L1700-L1727
  - vllm@0fc695fc:vllm/v1/executor/uniproc_executor.py#L142-L145
  - vllm@0fc695fc:vllm/config/vllm.py#L1017-L1027
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2730-L2758
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2600-L2613
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1919-L1929
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2559-L2566
  - vllm-ascend@2c59ff10:vllm_ascend/compilation/acl_graph.py#L243-L257
  - vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L58-L72
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L712-L725
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L677-L680
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L716-L725
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L966-L973
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1471-L1488
  - vllm@568afb3a:vllm/config/scheduler.py#L180-L198
  - vllm@568afb3a:vllm/config/vllm.py#L1028-L1058
  - vllm@568afb3a:vllm/v1/core/sched/async_scheduler.py#L19-L49
  - vllm@568afb3a:vllm/config/vllm.py#L524-L533
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/supported_features.md#L20-L20
  - vllm-ascend@2c59ff10:docs/source/user_guide/support_matrix/feature_matrix.md#L12-L38
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/DeepSeek-V4-Flash.md#L330-L330
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/speculative_decoding.md#L100-L100
  - vllm-ascend@baa023ad:docs/source/tutorials/features/dynamic_chunked_pipeline_parallel.md#L129-L138
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/support_matrix/supported_features.html
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/support_matrix/feature_matrix.html
  - https://docs.vllm.ai/projects/ascend/en/latest/tutorials/features/dynamic_chunked_pipeline_parallel.html
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: vllm-engine-core
    kind: builds-on
    note: 同步那条 step() 的四件事写在那一页；异步换掉的只是 EngineCore 的 step_fn，循环体本身一行没改
  - to: vllm-scheduler
    kind: builds-on
    note: 占位符加在那一页「还差多少 token」那道减法的被减数上，两条 while 和 token 预算的规则都没动
  - to: npu-model-runner
    kind: builds-on
    note: use_async_scheduling 是从上游 GPUModelRunner 继承来的字段，昇腾的改动全落在那一页划出的记账区与采样区
  - to: speculative-decoding
    kind: conflicts-with
    note: 只有 EAGLE / MTP / 草稿模型 / NGram GPU 这几种方法能和它同开，别的方法显式开异步直接 ValueError，而且同开会顺手关掉 cascade attention
contradicts: []
updated: "2026-09-22"
origin: seed
---

## 一句话

异步调度是让 **CPU 不再等 NPU**：EngineCore 把第 N 步送下去之后不取结果，直接回头调度第 N+1 步，NPU 算完这一步时下一批输入已经在那儿等着了。代价是调度器得在「上一步采出的 token 还不知道是什么」的前提下排下一步——**上游的办法是先给它记一张欠条**。

三个版本上都有，而且**默认都是「自动开」**：`SchedulerConfig.async_scheduling` 的默认值是 `None`，配置检查走自动那条分支，没撞上不兼容项就置成 `True` [C1][C2]。昇腾侧不改这个默认值。

```wiki-diagram
file: async-scheduling
```

## 那条请求走到这里

[那条请求](one-request.md)什么都不配就已经跑在异步调度上了：自动开启那条链上的闸它一道也不撞——不是 pooling 模型、没有 `speculative_config`、执行器那一关也过得去，`UniProcExecutor.supports_async_scheduling()` 直接返回 `True`。于是：

| 这一步在算什么 | 那条请求上是多少 | 依据 |
|---|---|---|
| `max_concurrent_batches` | PP=1、开了异步 → **2** | 重叠要两个并发批次；PP 则要 PP-size 个 [C4] |
| `EngineCore.step_fn` | 指向 `step_with_batch_queue` | `batch_queue_size > 1` 才建这条队列，否则还是 `step` [C5] |
| 第 2 圈排它时的占位数 | `num_output_placeholders = 1` | 第 1 圈调度完就 `+= 1` [C7] |
| 第 2 圈那道减法 | 37 + 1 − 37 = **1 个 token** | 欠条正好补上还没回来的那一个 [D] |

**200 圈里每圈省下的是同一段等待**：同步下 NPU 算完一步要停着，等 CPU 把采样结果搬回来、更新这条请求的状态、算出下一步的名额、再把 `SchedulerOutput` 送过进程边界；异步把这一整段压到上一步的 forward 底下。这段有多长取决于机器，这里不给数——但它基本不随模型变大而变长，所以**模型越小、一步 forward 越短，它占的比重越大**；Qwen3-0.6B 单卡 decode 正是这一头 [I]。

## 欠条：`num_output_placeholders`

基类 `_update_after_schedule` 在**调度完的当下**就把 `num_computed_tokens` 往前推，好让下一步立刻能接着排。`AsyncScheduler` 在同一个钩子里多做一件事：给每条不是 prefill 分片的请求 `num_output_placeholders += 1 + 本步草稿数`，并把 `spec_token_ids` 换成一串 `-1` 占位。

于是扫 running 那段的减法写成了三项 [C9]：

```
num_new_tokens = num_tokens_with_spec + num_output_placeholders - num_computed_tokens
                = 37                  + 1                       - 37                   = 1
```

**欠条是加在被减数上的**，减法的结果照旧是 1——调度器因此不需要知道那个 token 是什么，只需要知道「有这么一个」。

结果回来时 `_update_request_with_output` 按真实产出的数量把欠条扣掉，并 `assert num_output_placeholders >= 0`；同一处还把前缀缓存的 `cache_blocks` 记账基准压到 `num_computed_tokens - num_output_placeholders`——**没确认的 token 不许进哈希表** [C8]。抢占也得单独处理：`reset_prefix_cache` 强制抢占时把当时的占位数原样转成 `async_tokens_to_discard`，在飞的那几帧回来时直接丢掉 [C13]——**异步调度下「取消」不是立刻生效，而是要等欠条排干**。

## 昇腾侧改的是 worker 那一半

`use_async_scheduling` 这个字段是 `NPUModelRunner` 从上游 `GPUModelRunner` 继承来的，昇腾没有另起一套；改动全落在它重写过的那几段：

- **记账那段写的是 `-1` 而不是真 id**：异步时往 `input_batch.token_ids_cpu` 的下一格填 `[-1]`，真值留在设备上，下一步 `_prepare_input_ids` 在 NPU 上把这些格子覆盖回来，CPU 全程没碰过这个 token id [C18]。
- **返回值换成 `AsyncGPUModelRunnerOutput`**：它拿着设备上的张量和一个拷贝完成事件，D2H 晚一步在异步拷贝流上做 [C19]。
- **少一次 D2H**：`_copy_draft_token_ids_to_cpu` 在异步且没有结构化输出请求时直接返回，草稿 token 根本不回 CPU。
- **PP 上换了一条送 token 的路**：上游只在「用 PP 且没开异步」时才把采样结果塞回 `CachedRequestData`，开了异步就由最后一个 PP rank 直接广播给别的 rank，少走一趟 IPC。
- **ACL 图多一次同步**：FULL 模式重放前要 `torch.npu.current_stream().synchronize()`，注释写明理由就是异步调度下 CPU 可能跑到上一轮 replay 前面去。

## 谁换掉 `scheduler_cls`，谁就得自备一个 Async 版

`get_scheduler_cls` 只在 `scheduler_cls is None` 时才去看 `async_scheduling`；这个字段一旦被填，返回的就是填进去的那个类，异步与否不再影响挑选 [C3]。**这条规则决定了昇腾所有换调度器的特性都要备两套。**

备了的：v0.23 的 `RecomputeSchedulerConfig` 按 `async_scheduling` 在 `RecomputeScheduler` / `AsyncRecomputeScheduler` 之间挑；v0.26 起 [ShortRequestFirst](short-request-first.md) 与 [BatchJobAwareScheduler](batch-job-aware-scheduler.md) 也各有一个 `Async*` 子类；main 把这件事抽成 `_get_recompute_scheduler_cls` 和 `_get_dyntra_lb_scheduler_cls` 两个函数。下面那张昇腾差异表把三代的范围并排摆了出来。

没备的就是坑：`SchedulerDynamicBatch` 和 `ProfilingChunkScheduler` 都直接继承 `Scheduler`，平台层无条件把 `scheduler_cls` 指过去 [C24]。这时 `async_scheduling` 仍然是 `True`——`batch_queue` 照建、model runner 照写 `-1`——但调度器已经不是 `AsyncScheduler`，没人记欠条了 [!]。官方 main 的 PP + profiling-chunk 教程在启动命令里显式写了 `--no-async-scheduling`，正是在回避这件事 [S37]。

开关只有这一对，`bool | None` 字段自动生成：

```bash
vllm serve Qwen/Qwen3-0.6B                        # 不写：自动判定，单卡这条会开
vllm serve Qwen/Qwen3-0.6B --async-scheduling     # 显式开：撞上不兼容项直接报错而不是静默关掉
vllm serve Qwen/Qwen3-0.6B --no-async-scheduling  # 显式关
```

三者的区别在 `vllm.py` 那段 if/elif 里：显式 `True` 走硬失败分支，`None` 走「有一项不兼容就打一条 warning 并悄悄关掉」的自动分支。还有一个不问自取的副作用：同时用投机解码时，cascade attention 会被强制关闭。

## 版本之间的差异

主线行为（默认自动开、欠条机制、`step_with_batch_queue` 那条路）各版本一致。不一致的分两张表——机制在上游，所以按配套的 vLLM 快照分；平台层的接线在昇腾，所以按 vllm-ascend 的三个快照分。

**上游 vLLM**（v0.23 维护分支配套 `vllm@0fc695fc`，v0.26 分支配套 `vllm@568afb3a`；vllm-ascend main 配套哪个上游快照本页没核，所以不列它）：

| 项 | vLLM v0.23.0 | vLLM v0.26.0 | 意味着什么 |
|---|---|---|---|
| 显式开时的硬失败项 | 投机方法不在白名单 / `disable_padded_drafter_batch` / 执行器不支持 | 多一条 ROCm DeepEP DBO，同时把 `dspark` 放进投机白名单 [C30] | 昇腾碰不到 ROCm 那条；能多开一种投机方法 |
| 每步记几张欠条 | `+= 1 + 草稿数` | `+= num_sampled_tokens_per_step + 草稿数`，占位串每步按 `num_spec_tokens_to_schedule` 重建 [C31] | 给没有 AR bonus token 的扩散式模型留的口子，自回归模型上两者等价 |
| 在飞 token 的显存预留 | 没有这个概念 | 新增 `max_in_flight_tokens = 并发批次数 × max_num_batched_tokens` [C32] | 滑窗 / chunked-local 这类按已处理 token 回收块的 spec 要多留一份 |
| 自定义 `scheduler_cls` 的警告 | 只说「这个接口不公开」 | 多一句：子类化 `Scheduler` 而不是 `AsyncScheduler` 会让异步调度失效 [C29] | 同一段自定义调度器代码，v0.23 上不提醒你，v0.26 才会 |

**vllm-ascend**：

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 平台层挑 Async 版调度器的范围 | `platform.py` 里 `async_scheduling` 一次都不出现，只有 `RecomputeSchedulerConfig` 自己挑 [C23] | ShortRequestFirst、BatchJobAware 各多一个 `Async*` 分支 [C26] | 再抽成 `_get_recompute_scheduler_cls` / `_get_dyntra_lb_scheduler_cls` 两个函数，DyntraLB 也进来了 [C28] | 版本越新，能和异步调度共存的昇腾调度特性越多 |
| ShortRequestFirst + profiling chunk | 没有 ShortRequestFirst | 直接 `ValueError` 互斥 | 允许，但必须关掉异步调度 [C27] | [!] 想同时用这两个，得升到 main 并且显式 `--no-async-scheduling` |

## 常见误解

- **「异步调度要自己打开。」**——不用。字段默认 `None` 走的是自动分支，单卡跑一个普通模型就会被置成 `True`，日志里那句 `Asynchronous scheduling is enabled.` 就是它打的 [C2]。要关反而得显式写 `--no-async-scheduling`。
- **「官方矩阵里 Async Scheduling 那一列全是 ✅，所以它跟谁都能同开。」**——矩阵确实全是 ✅ [S34]，代码里却有硬 `raise`：非 EAGLE / MTP / 草稿模型 / NGram GPU 的投机方法显式开异步直接 `ValueError`；main 上 ShortRequestFirst 配 profiling chunk 也要求关掉它。**以代码为准** [!]。
- **「异步 = 采样挪到另一条流上做。」**——不是。采样还在同一次 forward 之后、同一条主流上做；异步的是**调度**。真正挪到另一条流上的只有把结果搬回 CPU 的那次 D2H。
- **「支持矩阵里找不到 Async Scheduling，说明昇腾没适配。」**——两张矩阵的叫法不一样：支持矩阵里最接近的是 `Async output`（🟢 Functional，备注「CI needed」）[S33]，特性互斥矩阵里写的才是 `Async Scheduling`。两者是不是同一件事，文档没写 [I]。
