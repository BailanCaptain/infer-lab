---
id: recompute-scheduler
title: "RecomputeScheduler：D 节点抢不到块，就把请求退回 P 节点"
type: feature
summary: PD 分离的 D 节点显存不够、要踢掉一条请求时，不让它在本机从头重算，而是当场结束它，由前面的代理把问题连同已经生成的回答一起重投给 P 节点。
aliases: [RecomputeScheduler, 重算调度器, recompute_scheduler_enable, AsyncRecomputeScheduler, DyntraLBRecomputeScheduler, RecomputeSchedulerConfig, RecomputeReqInfo, stop_reason=recomputed, 退回 P 重算, D 节点抢占]
chapters: ["12", "18"]
sources:
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995
  - vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L280-L316
  - vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L317-L347
  - vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L869-L881
  - vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L54-L72
  - vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L75-L92
  - vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L110-L136
  - vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L138-L169
  - vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L436-L441
  - vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L1124-L1126
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L689-L725
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L141-L161
  - vllm-ascend@2c59ff10:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L1040-L1058
  - vllm-ascend@2c59ff10:examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py#L973-L1001
  - vllm-ascend@2ed6cbba:vllm_ascend/core/recompute_scheduler.py#L128-L145
  - vllm-ascend@2ed6cbba:vllm_ascend/core/recompute_scheduler.py#L293-L345
  - vllm-ascend@2ed6cbba:vllm_ascend/core/recompute_scheduler.py#L598-L611
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L1003-L1026
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L682-L710
  - vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L85-L92
  - vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L103-L166
  - vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L344-L370
  - vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L1024-L1036
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1471-L1482
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1014-L1044
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L490-L507
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1254-L1280
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1431-L1454
  - vllm-ascend@2c59ff10:docs/source/user_guide/configuration/additional_config.md#L80
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/DeepSeek-V3.1.md#L997
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/tutorials/models/DeepSeek-V3.1.html
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: pd-disaggregation
    kind: builds-on
    note: 只装在 kv_role='kv_consumer' 的 D 节点上；P 节点上配了会被警告后就地关掉，PD 混布直接 ValueError
  - to: vllm-scheduler
    kind: builds-on
    note: 继承上游 Scheduler 并整段复制 schedule()，只改「块要不到时被抢占的那条请求怎么处置」这一个分支
  - to: recompute-cpu-offload
    kind: builds-on
    note: 这一页决定被抢占的请求怎么办，那一页决定它的 KV 去哪；只有连接器的 update_state_before_preempt 返回 True，才轮得到「不丢 KV」那条路
  - to: async-scheduling
    kind: builds-on
    note: 换掉 scheduler_cls 的特性必须自备一个 Async 子类，它是 v0.23 上唯一备了的那个
contradicts: []
updated: "2026-09-25"
origin: seed
---

[PD 分离](pd-disaggregation.md)（prefill 和 decode 放在不同机器上跑）的 D 节点只做 decode。显存里的 KV 块分完了、调度器只好踢掉一条请求时，通用做法是让这条请求回到等待队列、下一步在本机从头再算一遍——**可 D 节点恰恰不该做「从头算」这件事**。这一页讲的调度器只改了这一个岔路口：被踢的请求先问一句「有没有地方把它的 KV 存起来」，有就照通用做法排队等；没有，就当场结束这条请求，交给前面的代理把它整条退回 P 节点重算。

```wiki-diagram
file: recompute-scheduler
```

## 先问一个具体问题

一台 D 节点上同时在 decode 很多条请求。其中一条的问题有 37 个 token，回答已经吐到第 100 个 token。这一步，调度器要给某条请求多要一个 KV 块，要不到了，只好从正在跑的请求里挑一条让出它的块——挑中的正是这一条。

它已经算好的东西不少：问题的 37 个 token 是 P 节点算好传过来的，回答的前 99 个 token 是 D 节点自己一步一步 decode 出来的。现在这些 KV 占着的块要全部交出去。交出去之后，这条请求怎么办？

- **在本机从头再算**：回到等待队列队头，等有了块，把问题加上已经生成的回答整条重新 prefill 一遍。这是通用调度器的做法。
- **存起来，等会儿搬回来**：把 KV 先搬到主机内存，重新排上时再搬回显存。这是隔壁 [Recompute CPU Offload](recompute-cpu-offload.md) 那一页做的事。
- **退回 P 节点**：当场结束这条请求，D 节点什么都不重算；前面的代理收到一个特殊标记，把问题连同已经生成的回答重新发给一对 P/D 节点。

这一页的调度器负责在第二种和第三种之间选：存得下就走第二种，存不下就走第三种。**第一种在 D 节点上它一律不走。**

## 拿 Qwen3.6-35B-A3B 算一笔账

[那条请求](one-request.md)自己碰不到这一页：它只在一台机器上跑、队列里就它一条，不存在被抢占，更没有 P 节点可退。要让这一页有数可算，把同一个模型、同一条 37 个 token 的问题搬进一套一个 P 节点加一个 D 节点的部署：两边都是两颗 NPU 分着跑（和那条请求一样），D 节点上并发跑到显存撑不住，没配存 KV 的地方。

被踢的时刻是「第 100 个回答 token 刚生成出来」。这时 D 节点上存着 KV 的是问题的 37 个加上已经写进去的 99 个回答 token，共 **136 个**——第 100 个 token 自己的 KV 要到下一步才写。下面的数都是**一颗 NPU 上的量**。

| 这一步在算什么 | 值 | 从哪来 |
|---|---|---|
| D 节点上这 136 个 token 的全注意力 KV | 136 × 10 KiB ≈ **1.3 MiB** | 每个 token 在 10 层全注意力里共存 10 KiB，取自[那条请求](one-request.md) |
| 实际还给显存的空间 | 约 **80.7 MiB** | 1 个 2048 位置的块（20 MiB）加线性注意力 30 层状态补齐后的 60.7 MiB；块和状态都是一上来就占满，和已经算了几个 token 无关 |
| 代理手上已有的回答 | 100 个 token，原样接到问题后面 | 拼的是文字，重投时要重新切 token，所以下一行是近似值 |
| P 节点要重新 prefill 的长度 | 37 + 100 = **137** 个 token | 原来只需要算 37 个，要算的 token 数涨到 **3.7 倍** |
| 重新跨节点传的全注意力 KV | 137 × 10 KiB ≈ **1.3 MiB** | 第一次传的 37 × 10 KiB = 370 KiB 白传了；线性注意力状态怎么传不在本页范围内 |

这个例子里，退回 P 节点的代价不大：问题短，137 个 token 重算一遍很快，腾出来的 80.7 MiB 却是实打实的。**代价随问题长度涨**：问题换成 32K 个 token，重算的就是 32K 多个 token 的 prefill，再加一次几百 MiB 的跨机器传输——这时候隔壁那种「先存起来」就划算得多了，对比见 [Recompute CPU Offload](recompute-cpu-offload.md)。而不论问题长短，这一切在日志里都只有一行记录，不是报错。

## 为什么 D 节点不自己重算

通用调度器踢人时做四件事：还掉这条请求的全部 KV 块、把它标成「被抢占」、把「已经算了几个 token」清零、塞回等待队列队头。清零的意思很直接——这条请求接下来要从第 0 个 token 重新算一遍，而且是在本机算。细节见[调度器](vllm-scheduler.md)那一页。

官方文档对 D 节点给的是另一条路：KV 不够时，请求被送回 P 节点去重算。

至于为什么不在 D 节点上重算：D 节点每一步能放多少 token、预先录好的计算图是什么形状、显存池多大，全是按 decode 配的；临时插进一次上百甚至上千 token 的 prefill，正是 PD 分离要避开的那件事。这一层理由是按 PD 分离的部署形状推出来的，源码里只写了「送回 P」这个结果，没写为什么。

## 它只改了一个岔路口

这个调度器是在通用调度器上改出来的。每一步挑一批请求的那一大段逻辑，它整段照抄，只改一处：**要不到块、需要踢一条请求时，被踢的那条怎么处置。**

1. 先看自己是不是一台接收 KV 的节点（也就是 D 节点）。不是的话，走通用的踢人流程。
2. 是的话，挑一条正在跑的请求，问负责搬 KV 的连接器：「这条的 KV 你能不能存起来？」
3. 连接器说能：照通用流程标成「被抢占」、回等待队列，等它把 KV 搬回来接着 decode。
4. 连接器说不能（或者根本没配这类连接器）：把这条请求占的块全部还掉，记进一张「要退回去」的名单，这一步结束时给它发一个「已结束」的回复，里面带一个特殊标记，告诉代理这是要重投的。

还有一条连带规则：这一步只要踢过人，这一步就不再从等待队列里放新请求进来——刚腾出来的块不会马上被新来的请求占走。

除了这个岔路口，它还顺手处理了 D 节点上投机解码的一件小事：把每一步 decode 的形状凑齐，让预先录好的计算图对得上，不然会掉回慢的执行方式。不同版本里凑齐的办法不一样，见下半。

## 客户端看到的是一次「正常结束」

「退回 P 节点」这一路，从 D 节点发出去的是一个再普通不过的结束回复：结束原因写「停止」，没有新 token，只多一个标记，写着「这条要重算」。剩下的事都在推理引擎外面：官方示例里那个 PD 代理认得这个标记，收到后做三件事——把已经生成的文字接到原来的问题后面、把「最多还能生成多少 token」减掉已经生成的、重新挑一对 P/D 节点发出去。

有三件事要记住：

- **接的是原来的问题**，不是上一轮拼过的问题——生成内容不会丢，但整条要重新切 token、重新 prefill。
- **代理没有重试次数上限**：一条运气差的请求可以被一次又一次退回。
- **不经代理、直接连 D 节点的调用方，会把这个回复当成正常结束**：回答被截断了，结束原因却是「停止」，没有任何报错。那个标记是唯一的线索。

## 常见误解

- **「它自己会在 D 节点上重算 prefill」**——不会。这个调度器一个 token 都不重算，它只负责结束请求、打上标记；重算发生在 P 节点上，前提是你前面确实挂了一个认这个标记的 PD 代理。名字里的「重算」说的是别人要做的事。
- **「开了它，被抢占的请求就不会丢 KV」**——反了。只开它的时候，被踢请求的 KV 全丢；想要不丢，得另外配上 [Recompute CPU Offload](recompute-cpu-offload.md)，让连接器回答「能存」，这一页才会走「回等待队列」那条路。
- **「P 节点上也写上它，官方说会报错拦住」**——官方文档说在 P 节点或 PD 混布上会启动失败，代码里 P 节点走的却是打一条警告、就地关掉；只有 PD 混布和根本没配 PD 才真的报错起不来。文档和代码不一致，以代码为准。

## 对照源码

### 怎么开

```bash
# 只写在 D 节点上。kv_transfer_config 的写法见 PD 分离那一页
--kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer", ...}'
--additional-config '{"recompute_scheduler_enable": true}'
```

- 三个在册版本上 `vllm_ascend/core/recompute_scheduler.py` 都在，开关都叫 `recompute_scheduler_enable`、默认 `false`，类名都是 `RecomputeScheduler`。v0.23 上开关在 `ascend_config.py:142` 读的是顶层 `additional_config`；v0.26 / main 的键位变化见「版本差异」。官方参数表见 [S29]（在线版 <https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/configuration/additional_config.html>）。
- `platform.py` 的三道门 [C11]：`kv_role == "kv_producer"` → 打一条 warning、就地置 `False`，并把这个 `False` 写回 `additional_config`，让重建 AscendConfig 的 worker 进程也看到；没有 `kv_transfer_config` 或 `kv_role` 不是 `kv_consumer`（含 `kv_both`）→ `ValueError`；都过了，才把 `vllm_config.scheduler_config` 整个换成 `RecomputeSchedulerConfig`，由它按 `async_scheduling` 在 `RecomputeScheduler` / `AsyncRecomputeScheduler` 之间挑一个 [C5][C10]。
- 反过来的硬依赖：`oproj_tensor_parallel_size` 或 `embedding_tensor_parallel_size` 大于 0 时**必须**开它，否则 `AssertionError`。注释给的理由是只有这个调度器把各 DP rank 的 `num_tokens` 对齐，跨 DP 的 HCCL 集合通信才不会因为形状不一致挂死 [C12]；见[细粒度 TP](fine-grained-tp.md)。
- 岔路口的位置：`schedule()` 里 `allocate_slots` 要不到块的那个 `while True`，条件是 `kv_transfer_config` 存在且不是 `kv_producer` [C2]。不满足时走上游 `_preempt_request`：释放全部 KV 块、状态转 `PREEMPTED`、`num_computed_tokens` 归零、塞回 waiting 队头 [C1]。
- 满足时先调连接器的 `update_state_before_preempt(req, block_ids, num_computed_tokens)`：返回 `True` → 记一条 `PreemptedRequestData`、走 `_preempt_request`；返回 `False` 或连接器没有这个钩子 → `kv_cache_manager.free()`、记一条 `RecomputeReqInfo(req_id, output_token_ids, client_index)`[C3]。官方文档对 D 节点「送回 P 重算」的描述见 [S30]（在线版 <https://docs.vllm.ai/projects/ascend/en/v0.23.0/tutorials/models/DeepSeek-V3.1.html>）。
- v0.23 上 `RecomputeScheduler(Scheduler)` 只重写了四个方法：`add_request`（MTP 的 D 节点上给请求塞满 `PLACEHOLDER_TOKEN_ID`，否则图匹配不上会掉回 eager）[C7]、`_update_waiting_for_remote_kv`（拉完远端 KV 后把 `num_computed_tokens` 夹回 `num_tokens` 以内，占位 token 会把它顶超）[C8]、`schedule()`、`update_from_output()`。新增的状态只有三个 dataclass：`PreemptedRequestData`、`RecomputeReqInfo`，以及在 `SchedulerOutput` 上多挂这两张表的 `RecomputeSchedulerOutput` [C6]。
- 连带规则：`if not preempted_reqs and not recomputed_reqs` 拦住后面那段 waiting 队列循环，这一步不再放新请求进来 [C9]。
- `schedule()` 整段复制上游再改一处。main 上的 docstring 把「为什么值得复制这么一大段」说穿了：保留本地副本是为了给第一条 decode 请求补齐投机解码的形状，让 full graph 对得上；抢占的 KV 能卸就卸，卸不掉才送回 P [C20]。

### 会报什么错

- **启动报错**：D 节点以外开它——没有 `kv_transfer_config`，或 `kv_role` 是 `kv_both` 等非 `kv_consumer` 值 → `ValueError: recompute_scheduler_enable can only be enabled on PD-disaggregated D nodes ...`。
- **不报错、就地关掉**：P 节点（`kv_producer`）上开它只打一条 warning「is ignored on PD-disaggregated P nodes」。官方文档写的是「startup will fail with a clear error」[S29]，与代码不一致 `[!]`。
- **启动断言**：开了 `oproj_tensor_parallel_size` / `embedding_tensor_parallel_size` 却没开它 → `AssertionError`。
- **运行时只有日志**：退回 P 的那一路只打一条 `Recompute preemption falls back without offload for request %s, computed_tokens=%d.`（info 级）；客户端收到的是 `EngineCoreOutput(finish_reason=STOP, new_token_ids=[], stop_reason="recomputed")` [C4]，没有任何错误码。

### 开销和什么时候别开

- 代价在上半那张表：P 节点重新 prefill「问题 + 已生成回答」全长，外加一次完整的跨节点 KV 传输；问题越长越贵 [D]。长问题多、主机内存够的 D 节点，应当同时配上 [Recompute CPU Offload](recompute-cpu-offload.md)，让大部分被抢占的请求走「先存起来」。
- **必须挂一个认 `stop_reason="recomputed"` 的 PD 代理**。官方示例 `examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py` 的处理 [C13]：

```python
if stop_reason == "recomputed":
    retry = True
    retry_count += 1
    req_data["prompt"] = origin_prompt + generated_token          # 已生成的文字接到原问题后面
    req_data["max_tokens"] = origin_max_tokens - completion_tokens + retry_count
    instance_info = await reassign_instances(...)                 # 重新挑一对 P/D
```

  - 重投用的是 `origin_prompt`（第 973–979 行取一次），不是当前 prompt [C14]。
  - chat 请求时拼接的是 `messages[0]["content"]`，即**第一条消息**（`load_balance_proxy_server_example.py:1050-1051`，v0.23）；第 977 行取 `origin_prompt` 也只取第一条。多轮对话或带 system 消息的请求，已生成的回答会被接到第一条消息后面。
  - 外层是 `while retry:`，**没有重试次数上限**；`args.max_retries` 管的是单次连 D 节点的网络重试，不是这个。
- 不经代理、直连 D 节点的调用方会把这一帧当正常结束：输出被截断、`finish_reason` 却是 `stop` [D]。
- 同时开别的调度器类会**静默失效**：`_check_ascend_config` 在 `check_and_update_config` 的第 5 步就把 `scheduler_cls` 定好，第 8 步的 `_setup_worker_and_scheduler` 才跑 [C26]；后者一旦看到 `profiling_chunk_config.enabled` 或 `batch_job_sched_config.enabled`，就直接覆盖 `scheduler_cls` [C27]，而它们和 recompute 之间**没有任何互斥校验**——日志里连一条 warning 都没有 [D]。v0.23 上同一个位置还多一个 `SLO_limits_for_dynamic_batch` 分支，行为一样（`platform.py:712-725`）。

### 版本差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 「不接」之后怎么收尾 | 只调 `kv_cache_manager.free()`，不走 finish 流程，请求仍留在 `self.requests` 里、状态还是 RUNNING | 改走 `_finish_recomputed_request()` → `finish_requests(FINISHED_ABORTED)`，docstring 写明「through the normal abort path」[C15][C16] | 同 v0.26 | `[!]` v0.23 上这条请求在引擎侧没有被正式结束，只有客户端那边看到它结束了 |
| 钩子抛异常怎么办 | 没有 try/except，异常直接冒到引擎外 | 同 v0.23 | try/except 兜住，打 warning 后退回重算 | `[!]` 连接器出问题，v0.23 / v0.26 上会打死这一步 |
| 受害者怎么挑 | D 节点分支写死 `self.running.pop()`，不看调度策略 | 同 v0.23 | 先按上游策略挑（`PRIORITY` 下取 `max(priority, arrival_time)`），再决定怎么处置 | 开了优先级调度的 D 节点，v0.23 / v0.26 踢掉的不是最该踢的那条 |
| 开关键写在哪 | 只认顶层 `additional_config.recompute_scheduler_enable` | 顶层与 `additional_config.scheduler_config.*` 都认，嵌套的优先，顶层写法一律打弃用警告 | 同 v0.26 | `[!]` 两个方向抄配置都会出事：嵌套写法在 v0.23 上被静默忽略 |
| 投机解码的形状怎么凑齐 | `add_request` 里塞 `PLACEHOLDER_TOKEN_ID` | `schedule()` 里 `pad_spec_decode` 把 decode 步补成 `1 + num_spec_tokens` | 同 v0.26 | 实现换了、目的没换：让 D 上的 decode 步形状固定，full graph 才对得上 |
| 装出来几个类 | 2 个，由 `RecomputeSchedulerConfig` 自己按 `async_scheduling` 挑 | 2 个 | 4 个，和 [DyntraLB](dyntra-lb.md) 交叉，挑类抽成 `_get_recompute_scheduler_cls`[C25] | main 上开了 DyntraLB 也能同时开 recompute；早两版根本没有 DyntraLB 这个特性 |

### 源码位置

| 看什么 | 在哪 |
|---|---|
| 岔路口（要不到块时怎么处置被踢的请求） | `vllm_ascend/core/recompute_scheduler.py`，`schedule()` 里 `allocate_slots` 的 `while True`（v0.23 第 280–347 行） |
| 上游被替换掉的那条抢占 | `vllm/v1/core/sched/scheduler.py`，`_preempt_request` |
| 「已结束 + recomputed」那一帧 | `recompute_scheduler.py`，`update_from_output()`（v0.23 第 869–881 行） |
| 三道门与挑类 | `vllm_ascend/platform.py`，`check_and_update_config`（v0.23 第 689–725 行）；main 见– |
| 开关与 fine-grained TP 的硬依赖 | `vllm_ascend/ascend_config.py`（v0.23 第 141–161 行）；v0.26 / main 的嵌套键见 |
| 代理认标记、重投 | `examples/disaggregated_prefill_v1/load_balance_proxy_server_example.py`（v0.23 第 973–1058 行） |
| 例子里的模型形状 | Qwen3.6-35B-A3B 的 `config.json`（40 层、每 4 层一层全注意力、2 个 KV 头、head_dim 256）[S33]；块大小与每 token KV 的推导见[那条请求](one-request.md)下半 |
