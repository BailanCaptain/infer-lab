---
id: dynamic-chunked-pp
title: "动态分块流水线并行：让每块耗时相等，而不是 token 数相等"
type: feature
summary: PP 下固定大小的 chunk 越往后越慢，流水线就留气泡；它启动时真跑几十次 forward 量出延迟曲线，运行时反解出每一步该切多少 token，把各块耗时拉平。
aliases: [动态分块流水线并行, ProfilingChunkScheduler, ChunkSizePredictor, ProfilingChunkManager, profile_prefill_latency, 动态分块 PP, 等耗时切块]
chapters: ["13", "12"]
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L69-L74
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L90-L94
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L720-L725
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L17-L21
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L85-L93
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L127-L168
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L178-L198
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L202-L220
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L248-L251
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L313-L342
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L405-L412
  - vllm-ascend@2c59ff10:vllm_ascend/core/scheduler_profiling_chunk.py#L545-L567
  - vllm-ascend@2c59ff10:vllm_ascend/core/profiling_chunk_predictor.py#L69-L107
  - vllm-ascend@2c59ff10:vllm_ascend/core/profiling_chunk_predictor.py#L121-L142
  - vllm-ascend@2c59ff10:vllm_ascend/core/profiling_chunk_predictor.py#L237-L271
  - vllm-ascend@2c59ff10:vllm_ascend/core/profiling_chunk_predictor.py#L259-L271
  - vllm-ascend@2c59ff10:vllm_ascend/core/profiling_chunk_predictor.py#L374-L388
  - vllm-ascend@2c59ff10:vllm_ascend/worker/worker.py#L808-L856
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1959-L1968
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_profiling_chunk.py#L55-L74
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_profiling_chunk.py#L112-L127
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_profiling_chunk.py#L200-L212
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L741-L751
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L9-L18
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L54-L63
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L65-L83
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L146-L152
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L16-L22
  - vllm-ascend@2c59ff10:docs/source/tutorials/features/dynamic_chunked_pipeline_parallel.md#L86-L104
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.html
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L667-L671
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L993-L997
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L9-L16
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L38-L41
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L969-L973
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1011-L1012
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1271-L1280
  - vllm-ascend@baa023ad:vllm_ascend/core/scheduler_profiling_chunk.py#L91-L103
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: pipeline-parallel
    kind: builds-on
    note: 它治的是 PP 那页讲的气泡里的一种——同样大的块越往后越慢造成的那一种
  - to: chunked-prefill
    kind: builds-on
    note: 它改的就是那页讲的「每步切多少」，把固定的 token 预算换成按耗时反解出来的数
  - to: vllm-scheduler
    kind: builds-on
    note: ProfilingChunkScheduler 把上游 schedule() 整段抄过来改，被改的 num_new_tokens 预算逻辑在那页
  - to: async-scheduling
    kind: builds-on
    note: 它直接继承 Scheduler、没有 Async 版，官方启动命令里那句 --no-async-scheduling 的真实代价在那页
  - to: profiling-chunk-config
    kind: builds-on
    note: 每个配置键的默认值、取值范围和开了之后的代价在参数页，这页只讲机制不重抄
  - to: balance-scheduling
    kind: conflicts-with
    note: 三个版本上同开都是启动直接 ValueError，没有自动降级
  - to: dyntra-lb
    kind: conflicts-with
    note: main 开发主线上 DyntraLB 的校验里单列一条，同开 ValueError
contradicts: []
updated: "2026-09-22"
origin: seed
---

## 一句话

PP 配 chunked prefill 有个硬伤：块切得一样大，可注意力是 O(n²)，**前缀越长，同样大的一块算得越慢**，下一级流水线只能干等 [S24]。CPP（Dynamic Chunked Pipeline Parallel）把它反过来做——先真跑一遍量出「这台机器上一段长 `l` 的 prefill 要多久」，再让每块的**耗时**相等、token 数不等。开它不是打开一个分支：`scheduler_cls` 会被整个换成 `ProfilingChunkScheduler` [C3]。

三个在册版本上都有：三处源码加三处文档，六个路径在三个钉住的提交上逐个 `git ls-tree` 都在。下面以 **v0.23 维护分支**为准写一遍，版本之间真正分叉的只有配置路径、和 ShortRequestFirst 的关系、以及官方对它的定位这三处。

```wiki-diagram
file: dynamic-chunked-pp
```

## 那条请求用不到它

[那条请求](one-request.md)是单卡、TP=1、PP=1，开了它会在 `AscendConfig` 里直接 `ValueError`——`pipeline_parallel_size <= 1` 不给过 [C1]。退一步说，37 个 token 连一块都切不满。

要走到这里，得照官方 tutorial 的 P 节点设定：`--pipeline-parallel-size 2`、`--enable-chunked-prefill`、`--max-num-batched-tokens 32768`、`smooth_factor 1.0`、`min_chunk 4096` [S29]。`base_chunk_size` 就是调度器的 `max_num_scheduled_tokens`（这里 32768），`page_size` 取 KV cache 的 `block_size`。

拿一条 131072 token（128k）的输入来算。假设延迟里只有注意力那一项、常数与线性项忽略不计（`b = c = 0`）[A]，目标耗时就是 `T = f(32768) − f(0) = a·32768²`，解 `a·x² + 2aL·x − T = 0` 会得到一个干净的式子 [D]：

```
x = −L + √(L² + 32768²)           # L 是这条请求已经算过的前缀长度
⟹ L_{n+1}² = L_n² + 32768²       ⟹ L_n = 32768·√n
```

于是每块多大、一共几块都能手算：

| | 固定块 | 动态块 |
|---|---|---|
| 块大小 | 32768 × 4 | 32768 → 13696 → 10496 → 8832 → 7808 → … → 4224 |
| 几步走完 128k | 4 | 16（`L_n = 32768√n`，`4² = 16`） |
| 每步耗时 | `T : 3T : 5T : 7T` | 每步都是 `T` |
| 两级流水线走完的总时长 | `16T/2 + 7T/2 = 11.5T` | `16T/2 + T/2 = 8.5T` |

13696 是这么来的：原始正根 `32768×(√2−1) = 13572`，`smooth_factor = 1.0` 不改它，再向上对齐到 `max(page_size, 64) = 128` 的倍数，`⌈13572/128⌉ × 128 = 13696` [C15]。最后一块是 `32768×(4−√15) = 4162` → 4224，**再往下一块就会被 `min_chunk`（默认 4096）顶住**——官方那张「64k 配 20480、128k 配 32768」的推荐表要避开的正是这件事。

两点要当心。**总计算量一点没省**：两边都是 `16T`，省掉的 3T 全是下一级的等待时间。**步数从 4 变成 16**：调度、通信、算子启动这些固定开销要多付 12 次 [D]。官方给的 128k 实测只降了约 17%，比这里算的 26% 保守——上面这个模型忽略了线性项和通信，偏乐观 [I]；实测数在[动态切块配置](../params/profiling-chunk-config.md)。

## 换掉的是整个调度器，不是插一个钩子

`ProfilingChunkScheduler` 直接继承上游 `Scheduler`，除了 `__init__`，它**唯一覆盖的上游方法就是 `schedule()`**——整段照抄过来再改，改动处用 `>>> PROFILING CHUNK` 注释框起来。文件头那句 "Compatible with vLLM v0.15.x scheduler. When the upstream `schedule()` method is refactored, this override should be updated accordingly" 把代价写明白了：上游一改调度器，这份副本就得跟着手改，v0.26 与 main 上这个文件的改动大半是在追这件事 [D]。

真正改的只有两处，RUNNING 和 WAITING 队列各一处，形状一样：

```python
predicted_chunk = self.profiling_chunk_manager.predict_chunk_size(...)
if predicted_chunk is not None and predicted_chunk > 0:
    num_new_tokens = min(predicted_chunk, num_new_tokens)   # 只会切小，不会切大
```

上游算完 token 预算之后再被截一刀，所以 `max_num_batched_tokens` 仍是上限 [C10]；预测返回 `None`（判别式为负、根非正、模型还没拟合好）时这一步原样不动。

还有一条容易漏的：它在 token 预算之外又加了个**时间预算** `time_budget`，初值就是 `target_latency`，两个 while 循环都多要求 `time_budget > 0`。每调度一个还在 prefill 的请求就扣掉 `predict_time(...)`，已经进 decode 的（`num_computed_tokens >= num_prompt_tokens`）不扣，免得一步塞满 decode 把 prefill 饿死。**开了它之后，一步能塞多少不再只由 token 数决定，还由预测出来的耗时决定。**

## 曲线是启动时真跑出来的，头几个请求还用不上它

`patch_profiling_chunk.py` 包住 `EngineCore.__init__`：引擎构造完、`model_executor` 就绪之后立刻调 `scheduler.run_profiling_chunk_init(model_executor)`。它从 `base_chunk_size` 往下均匀采 64 个 chunk size，逐个 `collective_rpc("profile_prefill_latency", ...)`，第 0 次当 warm-up 丢掉 [C6]；worker 那边跑的是 `_dummy_run(num_tokens, force_attention=True, profile_cpp=True)`——`force_attention` 不给就可能整段注意力被跳过，量出来的数没意义。收到的样本少于 8 个就放弃，整个特性静默退回固定块 [C7]。拟合走 `np.linalg.lstsq`，失败再退 `np.polyfit`。PP 下所有 rank 都得跑（不跑就不同步），但只取第一级 PP rank 的计时：`_build_rpc_kwargs` 把 `unique_reply_rank` 算成 `world_size − tp_size × prefill_context_parallel_size`。

运行时有三道门决定「这一步到底截不截」，少看一道都会算错：

- `is_ready` —— 启动 profiling 成功之前一律返回 `None`，服务刚起来的请求按固定块走；
- `num_computed_tokens < num_prompt_tokens` —— 只管 prefill，decode 不碰；
- `num_computed_tokens > 0 or not need_timing` —— **开着在线校准时，每条请求的第一块故意不截**。理由在补丁里：只有 `total_hist_tokens == 0` 的批次才拿去 `set_target_latency`，攒够 3 次才算标定完。日志里那句 `[Dynamic Chunk] Online calibration stage. Long requests are better` 就是这个阶段打的。

校准会自己停：`fit_chunk` 攒到 `max_fit_chunk`（默认 30）个点后直接返回 `False` 并置上 `history_fitted`，从此不再重拟合。标定和拟合都完成后补丁把 `need_timing` 改成 `False`，并给后续每个 `SchedulerOutput` 挂上 `disable_profiling_timing`——调度器进程里改配置单例管不到 worker 进程，这条在 [NPU model runner](npu-model-runner.md) 那页记过。校准期间 worker 每步要同步一次设备来计时，关掉就没这笔开销，但官方说结果次优。

设计文档写对齐是 "Round down to multiple of `page_size`"，代码里是 `((chunk_size + align - 1) // align) * align`，向**上**取整——以代码为准 [!]。配置键各管什么、默认多少、`smooth_factor` 怎么调，都在[动态切块配置](../params/profiling-chunk-config.md)，这页不重抄。

## 和谁不能同开：五页各写了一半，这里核一遍

| 和谁 | 结果 | 拦在哪，谁先记下的 |
|---|---|---|
| PP = 1 | 启动 `ValueError` | `AscendConfig`，见上一节；[流水线并行](pipeline-parallel.md)那页提过这条硬门槛 |
| chunked prefill 没开 | 文档列为硬约束，代码里却找不到对应的 `raise` [!] | Constraints [S27]；[Chunked Prefill](chunked-prefill.md) |
| balance scheduling | 启动 `ValueError`，三版一致 | `AscendConfig` [C2]；[负载均衡调度](balance-scheduling.md) |
| DyntraLB | 启动 `ValueError`（DyntraLB 只 main 有） | `platform.py` [C36]；[DyntraLB](dyntra-lb.md) |
| 批作业感知调度 | **不报错，静默覆盖**：先把 `scheduler_cls` 指向 `ProfilingChunkScheduler` 并 import 它的 patch，紧接着批作业那段又改掉 [!] | `platform.py` [C37]；[批作业感知调度](batch-job-aware-scheduler.md)先记下的 |
| ShortRequestFirst | 按版本分叉，见下表 | [短请求优先](short-request-first.md) |
| 异步调度 | 不报错，但根本没有 `ProfilingChunkAsyncScheduler` 这个类 [!] | 官方只以「prefill 阶段性能劣化」为由建议 `--no-async-scheduling` [S34]，真实风险在[异步调度](async-scheduling.md)那页 |

## 版本之间真正分叉的只有三处

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 配置写在哪 | 只认 `additional_config.profiling_chunk_config` | 推荐 `additional_config.scheduler_config.profiling_chunk_config`，顶层仍认但打弃用告警 [C32] | 同 v0.26 | [!] 照新文档抄的嵌套写法在 v0.23 上会被整个忽略：服务照起，开关没开 |
| 配 ShortRequestFirst | 没有 ShortRequestFirst | 同开直接 `ValueError` [C31] | 放行，`ProfilingChunkScheduler.__init__` 自己装那条短请求队列；但 `async_scheduling` 为真时 `ValueError` [C35] | [!] 两个一起用得升到 main，并且显式 `--no-async-scheduling` |
| 官方怎么定位它 | "CPP is recommended for PD ... disaggregation scenarios"，通用 PP 特性的口气，没点名 P 节点 [S28] | 改口成 "**designed to be used on the Prefiller (P) node**"，D 节点不用配 [S33] | 同 v0.26 | v0.23 上照通用 PP 场景开也说得通；v0.26 起官方只在 PD 分离的 P 节点上验证 |

## 常见误解

- **「它是个调优开关，打开试试就行。」**——打开就换掉了调度器类，而且引擎要先把上面那轮 profiling 跑完才开始服务。启动明显变慢不是 bug。
- **「切得更细，所以每步更快、总时间更短。」**——总计算量不变。128k 那个例子里两边都是 `16T`，快的是流水线不用等，代价是步数从 4 变成 16 [D]。
- **「动态块会比固定块切得更大。」**——不会。插入点是 `num_new_tokens = min(predicted_chunk, num_new_tokens)`，**只会往小里改**；`max_num_batched_tokens` 仍是天花板，想让第一块更大只能调它。
- **「预测一开始就生效。」**——启动 profiling 没成功（样本不足 8 个）就一直返回 `None`，静默退回固定块；开着在线校准时每条请求的第一块也是不截的。
