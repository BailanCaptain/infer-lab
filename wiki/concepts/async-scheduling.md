---
id: async-scheduling
title: "异步调度：下一步的调度压在上一步的执行底下"
type: feature
summary: NPU 算这一步的时候，CPU 不等结果就先把下一步排好；还没算出来的那个 token 先记一张欠条，排的时候照样能算清每条请求这一步要算几个。
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
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm@0fc695fc:vllm/config/parallel.py#L845-L886
  - vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L511-L513
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L412-L418
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
updated: "2026-09-25"
origin: seed
---

## 每一步之间，NPU 在等谁

[贯穿全库的那条请求](one-request.md)：Qwen3.6-35B-A3B 跑在两颗昇腾 NPU 上，问题 37 个 [token](token.md)，回答 200 个。回答 200 个 token，引擎就要转 200 [步](vllm-engine-core.md)，每一步给这条请求吐 1 个 token。

每一步其实分两半：**CPU 上的[调度器](vllm-scheduler.md)先决定这一批放哪些请求、各算几个 token，然后 NPU 去算。** 问题是，NPU 算完之后，CPU 还有一串活要干——把采出来的 token 收回来、更新这条请求的进度、决定下一步谁上、再把这份安排送到 NPU 那边。

如果老老实实一件接一件做，这段时间里 NPU 什么也不干，就在那儿等。200 步，就等 200 次。

异步调度要解决的就是这件事：**NPU 还在算第 N 步的时候，CPU 已经把第 N+1 步排好了。** NPU 一算完，下一步的安排已经在门口等着。

```wiki-diagram
file: async-scheduling
```

## 办法：不等结果，先排下一步

同步的时候，引擎每一步是「排 → 送下去 → 等结果 → 收结果」，然后才开始下一步的「排」。

异步的时候，引擎把这一步送下去就不等了，直接回头去排下一步。它手里同时最多压着两批：一批正在 NPU 上算，另一批已经排好、等着上。等前一批的结果回来，再去收。

这件事在这三个版本上都是**默认就开着的**，不用自己打开。启动时引擎会自己检查一遍：有没有和它合不来的配置，没有就开，有就悄悄关掉并打一条警告。那条请求什么都没多配，两颗 NPU 也不影响——所以它从第一步起就跑在异步调度上。

## 还没算出来的 token，怎么排：先记一张欠条

这里有个麻烦。排下一步的时候，调度器要算「这条请求这一步要算几个 token」，算法是：

> 这一步要算的 = 这条请求一共有多少 token − 已经算过多少 token

可是在异步下，排第 2 步的时候，第 1 步采出来的那个 token 还在 NPU 上、还没回到 CPU——调度器看到的这条请求仍然只有问题那 37 个 token。照这道减法算，37 − 37 = 0，这条请求就会被当成「没活干」。

上游的办法是**记一张欠条**：第 1 步一排完，调度器就在这条请求上记一笔「欠我 1 个 token，会产出，只是还没回来」。于是排第 2 步时，减法变成：

> 37 个已知 token + 1 张欠条 − 已算过的 37 个 = **1 个 token**

结果和同步时一模一样。调度器不需要知道这个 token **是什么**，只需要知道**有这么一个**。

等结果真正回到 CPU，欠条就按实际收到的数量销掉。欠条还管着两件收尾的事：

- **没确认的 token 不进前缀缓存。** 前缀缓存只把已经确认的 token 登记进去，欠着的那部分不算。
- **取消不是立刻生效。** 一条请求被强制踢出去的时候，已经送到 NPU 上的那几步结果还会回来；调度器记下要丢掉几份，等它们回来一份份扔掉。

## 昇腾这边：真 token 一直留在 NPU 上

CPU 这一半（引擎和调度器）是上游 vLLM 的代码，昇腾没改。昇腾改的是 NPU 那一半，也就是 [Worker](npu-worker-lifecycle.md) 里[跑模型的那段代码](npu-model-runner.md)：

- **CPU 这边先填一个「空位」。** 采出来的真 token 留在 NPU 上，CPU 的记录里对应那一格先写一个 −1。下一步开算前，NPU 自己把这一格换成真值。整个过程 CPU 都没碰过这个 token 是几号。
- **结果晚一步才搬回 CPU。** 搬运放在另一条专门的通道上做，不挡着下一步的计算。
- **能不搬的就不搬。** [投机解码](speculative-decoding.md)猜出来的草稿 token，在没有格式约束的请求上根本不回 CPU。
- **多卡流水线（[PP](pipeline-parallel.md)）换了一条送 token 的路。** 由最后一段直接把采样结果发给其他段，少走一趟进程间通信。
- **图模式多等一下。** 整张计算图重放前，要先等上一轮真正做完——因为异步下 CPU 可能已经跑到上一轮前面去了。

## 换了调度器的特性，要自己备一个异步版

欠条是记在上游那个专门的「异步调度器」里的。如果某个特性把调度器整个换成了自己写的，引擎就不再管「要不要异步」这件事，直接用那个换进来的。

所以昇腾那些换调度器的特性，都得同时备一个同步版、一个异步版。版本越新，备齐的越多（逐版对比见下文「版本差异」）。

**没备的就是坑。** 有两个昇腾调度特性只写了同步版：这时异步开关仍然开着，引擎照样两批压着跑，NPU 那边照样写 −1——可调度器已经不记欠条了。官方在相关教程的启动命令里特意把异步关掉，正是在回避这件事。

## 常见误解

- **「异步调度要自己打开。」** 不用。默认就会自动打开；要关反而得显式写。
- **「官方特性表里这一列全是 ✅，所以它跟谁都能同开。」** 表里确实全是 ✅，但代码里有硬性报错：有些投机解码方法、有些昇腾调度特性组合，都要求关掉它。以代码为准。
- **「异步就是把采样挪到另一条通道上做。」** 不是。采样还在同一次计算之后、同一条主通道上做；异步的是**调度**。真正挪到另一条通道上的，只有把结果搬回 CPU 那一次。
- **「支持列表里找不到这个特性，说明昇腾没适配。」** 两张官方表格叫法不一样，一张写的是另一个名字（见下文）。

## 对照源码

### 怎么开

- 开关是 `SchedulerConfig.async_scheduling`，类型 `bool | None`，默认 `None` [C1]；命令行自动生成 `--async-scheduling` / `--no-async-scheduling` 一对。
- 三种写法的区别在 `vllm.py` 那段 if/elif 里 [C2]：显式 `True` 走硬失败分支；`None` 走自动分支——有一项不兼容就打一条 warning 并悄悄置 `False`，都没撞上才置 `True`，日志打 `Asynchronous scheduling is enabled.`。昇腾侧不改这个默认值。

```bash
vllm serve Qwen/Qwen3.6-35B-A3B --tensor-parallel-size 2 --enable-expert-parallel --enable-prefix-caching                        # 不写：自动判定，这条会开
vllm serve Qwen/Qwen3.6-35B-A3B --tensor-parallel-size 2 --enable-expert-parallel --enable-prefix-caching --async-scheduling     # 显式开：撞上不兼容项直接报错而不是静默关掉
vllm serve Qwen/Qwen3.6-35B-A3B --tensor-parallel-size 2 --enable-expert-parallel --enable-prefix-caching --no-async-scheduling  # 显式关
```

- 自动分支关掉它的条件，按代码顺序：pooling 模型（`runner_type == "pooling"`，只打 debug 日志）；有 `speculative_config` 且方法既不在 `EagleModelTypes`、也不在 `NgramGPUTypes` 里——注意这条自动分支**没有**像显式分支那样放行 `draft_model`，草稿模型方法在自动分支下会被关掉（`vllm.py:969-979`）；`disable_padded_drafter_batch=True`；执行器的 `supports_async_scheduling()` 返回 `False`。
- 那条请求为什么自动开 [D]：不是 pooling、没有 `speculative_config`；TP=2 在单机上默认用 `mp` 后端 [C42]，`MultiprocExecutor.supports_async_scheduling()` 返回 `True` [C43]（单卡时是 `UniProcExecutor`，同样返回 `True` [C16]）。模型形状见 [S41]，异步这条链上没有按模型结构开关的判断（`vllm/model_executor/models/config.py` 里不出现 `async_scheduling`）。
- 官方 Qwen3.6-35B-A3B 教程的 A2/A3 示例命令显式写了 `--async-scheduling`，FAQ 里说：高并发时吞吐有提升，但对时延敏感的负载不一定受益；建议高吞吐服务开它，低时延服务开关各测一次 TTFT 和 TPOT 再定 [S44]。
- 开了之后那条请求上的几个值：

| 这一步在算什么 | 那条请求上是多少 | 依据 |
|---|---|---|
| `max_concurrent_batches` | PP=1、开了异步 → **2** | 重叠要两个并发批次；PP 则要 PP-size 个 [C4] |
| `EngineCore.step_fn` | 指向 `step_with_batch_queue` | `batch_queue_size > 1` 才建这条队列，否则还是 `step` [C5][C6] |
| 第 2 步排它时的占位数 | `num_output_placeholders = 1` | 第 1 步调度完就 `+= 1 + 本步草稿数`，没开投机时草稿数为 0 [C7] |
| 第 2 步那道减法 | 37 + 1 − 37 = **1 个 token** | `num_tokens_with_spec + num_output_placeholders - num_computed_tokens` [C9][D] |

- 欠条的完整流程：基类 `_update_after_schedule` 在调度完当下就推进 `num_computed_tokens`；`AsyncScheduler` 在同一个钩子里给每条不是 prefill 分片的请求 `num_output_placeholders += 1 + 本步草稿数`，并把 `spec_token_ids` 换成一串 `-1` 占位。结果回来时 `_update_request_with_output` 按真实产出数扣掉欠条并 `assert num_output_placeholders >= 0`，同处把 `cache_blocks` 的记账基准压到 `num_computed_tokens - num_output_placeholders` [C8]。`reset_prefix_cache` 强制抢占时把当时的占位数原样转成 `async_tokens_to_discard`，在飞的帧回来时逐个丢弃 [C13]。
- 昇腾 worker 侧（`use_async_scheduling` 继承自上游 `GPUModelRunner`，改动落在 `NPUModelRunner` 重写的几段）：
  - 异步时往 `input_batch.token_ids_cpu` 的下一格填 `[-1]`，真值留在设备上的 `prev_sampled_token_ids`，下一步 `_prepare_input_ids` 在 NPU 上覆盖回来 [C15][C18]。
  - 返回 `AsyncGPUModelRunnerOutput`，拿着设备张量和一个拷贝完成事件，D2H 在异步拷贝流上晚一步做 [C19]。
  - `_copy_draft_token_ids_to_cpu` 在异步且没有结构化输出请求时直接返回。
  - 上游只在「用 PP 且没开异步」时才把采样结果塞回 `CachedRequestData`；开了异步由最后一个 PP rank 直接广播给别的 rank。
  - ACL 图 FULL 模式重放前 `torch.npu.current_stream().synchronize()`，注释写明理由就是异步调度下 CPU 可能跑到上一轮 replay 前面去 [C22]。
- 换调度器的规则：`get_scheduler_cls` 只在 `scheduler_cls is None` 时才看 `async_scheduling`；字段一旦被填，返回的就是填进去的类 [C3]。v0.23 的 `RecomputeSchedulerConfig` 按 `async_scheduling` 在 `RecomputeScheduler` / `AsyncRecomputeScheduler` 之间挑 [C23]；v0.26 起 [ShortRequestFirst](short-request-first.md) 与 [BatchJobAwareScheduler](batch-job-aware-scheduler.md) 各有一个 `Async*` 子类 [C26]；main 抽成 `_get_recompute_scheduler_cls` 和 `_get_dyntra_lb_scheduler_cls` [C28]。

### 会报什么错

- 显式 `--async-scheduling` 时：
  - 投机方法不是 EAGLE / MTP / 草稿模型 / NGram GPU 之一 → `ValueError: Currently, async scheduling is only supported with EAGLE/MTP/Draft Model/NGram GPU kind of speculative decoding`。
  - `disable_padded_drafter_batch=True` → `ValueError: Async scheduling is not compatible with disable_padded_drafter_batch=True.`
  - 执行器不支持 → ``ValueError: `<backend>` does not support async scheduling yet.``
- 同时用投机解码且开了异步：不报错，但会打一条 warning 并强制 `disable_cascade_attn = True` [C17]。
- main 上 ShortRequestFirst 配 profiling chunk：允许，但要求关掉异步调度 [C27]；v0.26 上这两者直接 `ValueError` 互斥。
- 静默失效（不报错）[!]：`SchedulerDynamicBatch` 和 `ProfilingChunkScheduler` 都直接继承 `Scheduler`，平台层无条件把 `scheduler_cls` 指过去 [C24]。这时 `async_scheduling` 仍是 `True`——`batch_queue` 照建、model runner 照写 `-1`——但调度器已经不是 `AsyncScheduler`，没人记欠条。官方 main 的 PP + profiling-chunk 教程在启动命令里显式写了 `--no-async-scheduling`，正是在回避这件事 [S37]。
- 官方矩阵与代码不一致 [!]：特性互斥矩阵里 Async Scheduling 那一列全是 ✅ [S34]，但上面几条硬 `raise` 都在；以代码为准。

### 开销和什么时候别开

- 省下的是每步 NPU 算完后等 CPU 那一段：把采样结果搬回 CPU、更新请求状态、算下一步名额、把 `SchedulerOutput` 送过进程边界。这段有多长取决于机器，本页不给数；它基本不随模型变大而变长，所以一步 forward 越短，它占的比重越大 [I]。那条请求 200 步里的 199 步 decode 每步只算 1 个 token，属于容易受益的那一头 [I]。
- 代价：多压一批在飞（`max_concurrent_batches` 从 1 变 2）；取消与抢占要等欠条排干才真正生效；ACL 图 FULL 模式多一次流同步。
- 什么时候别开：pooling 模型自动分支默认就关，注释说当前实现对它性能不利；时延敏感的场景，官方 Qwen3.6 教程建议开关各测一次再定 [S44]；用了只写同步版调度器的昇腾特性时要显式关（见上一节）。

### 版本差异

主线行为（默认自动开、欠条机制、`step_with_batch_queue` 那条路）各版本一致。不一致的分两张表——机制在上游，所以按配套的 vLLM 快照分；平台层的接线在昇腾，所以按 vllm-ascend 的三个快照分。

**上游 vLLM**（v0.23 维护分支配套 `vllm@0fc695fc`，v0.26 分支配套 `vllm@568afb3a`；vllm-ascend main 配套哪个上游快照本页没核，所以不列它）：

| 项 | vLLM v0.23.0 | vLLM v0.26.0 | 意味着什么 |
|---|---|---|---|
| 显式开时的硬失败项 | 投机方法不在白名单 / `disable_padded_drafter_batch` / 执行器不支持 | 多一条 ROCm DeepEP DBO，同时把 `dspark` 放进投机白名单 | 昇腾碰不到 ROCm 那条；能多开一种投机方法 |
| 每步记几张欠条 | `+= 1 + 草稿数` | `+= num_sampled_tokens_per_step + 草稿数`，占位串每步按 `num_spec_tokens_to_schedule` 重建 [C31] | 给没有 AR bonus token 的扩散式模型留的口子，自回归模型上两者等价 |
| 在飞 token 的显存预留 | 没有这个概念 | 新增 `max_in_flight_tokens = 并发批次数 × max_num_batched_tokens` [C32] | 滑窗 / chunked-local 这类按已处理 token 回收块的 spec 要多留一份 |
| 自定义 `scheduler_cls` 的警告 | 只说「这个接口不公开」 | 多一句：子类化 `Scheduler` 而不是 `AsyncScheduler` 会让异步调度失效 | 同一段自定义调度器代码，v0.23 上不提醒你，v0.26 才会 |

**vllm-ascend**：

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 平台层挑 Async 版调度器的范围 | `platform.py` 里 `async_scheduling` 一次都不出现，只有 `RecomputeSchedulerConfig` 自己挑 | ShortRequestFirst、BatchJobAware 各多一个 `Async*` 分支 | 再抽成 `_get_recompute_scheduler_cls` / `_get_dyntra_lb_scheduler_cls` 两个函数，DyntraLB 也进来了 | 版本越新，能和异步调度共存的昇腾调度特性越多 |
| ShortRequestFirst + profiling chunk | 没有 ShortRequestFirst | 直接 `ValueError` 互斥 | 允许，但必须关掉异步调度 | [!] 想同时用这两个，得升到 main 并且显式 `--no-async-scheduling` |

- 文档叫法：支持矩阵里最接近的是 `Async output`（🟢 Functional，备注「CI needed」）[S33]，特性互斥矩阵里写的才是 `Async Scheduling` [S34]。两者是不是同一件事，文档没写 [I]。

### 源码位置

| 看什么 | 去哪里 |
|---|---|
| 开关字段与默认值 | 上游 `vllm/config/scheduler.py`，`SchedulerConfig.async_scheduling`、`get_scheduler_cls` |
| 自动开 / 硬失败 / 关 cascade attention | 上游 `vllm/config/vllm.py`，`__post_init__` 里那段 if/elif；`max_concurrent_batches` |
| 默认执行器后端 | 上游 `vllm/config/parallel.py`；`vllm/v1/executor/multiproc_executor.py`、`uniproc_executor.py` 的 `supports_async_scheduling` |
| 两批压着跑的那条路 | 上游 `vllm/v1/engine/core.py`，`step_with_batch_queue`、`batch_queue` |
| 欠条 | 上游 `vllm/v1/core/sched/async_scheduler.py`；`scheduler.py` 扫 running 那段减法与 `reset_prefix_cache`；`vllm/v1/request.py` |
| 设备上换回真 id | 上游 `vllm/v1/worker/gpu_model_runner.py`，`_prepare_input_ids` |
| 昇腾 worker 侧改动 | `vllm_ascend/worker/model_runner_v1.py`；`vllm_ascend/compilation/acl_graph.py` |
| 昇腾挑调度器 | `vllm_ascend/platform.py`；`vllm_ascend/core/recompute_scheduler.py` |
