---
id: recompute-scheduler
title: "RecomputeScheduler：D 节点抢不到块，就把请求退回 P 节点"
type: feature
summary: PD 分离的 Decode 节点上 KV 块不够要抢占时，这个调度器不让请求退回 waiting 重算，而是当场终止它，用 stop_reason="recomputed" 让 PD proxy 把它重投给 Prefill 节点。
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
updated: "2026-09-22"
origin: seed
---

## 一句话

PD 分离的 Decode 节点只做 decode。**上游那套抢占——释放块、`num_computed_tokens` 归零、退回 waiting 队头、下一步自己从头重算——落在 D 节点上等于给它派了一件它不该做的活。** `RecomputeScheduler` 换掉的就是这一个分支：块要不到时先问 KV 连接器接不接，接了照上游那条路走；不接，这条请求当场终止，用 `stop_reason="recomputed"` 告诉 PD proxy「请把它重投给 P 节点」。

三个在册版本上 `vllm_ascend/core/recompute_scheduler.py` 都在（逐个 `git ls-tree` 查过），开关都叫 `recompute_scheduler_enable`、默认 `false`，类名也都是 `RecomputeScheduler`。主叙述按 v0.23 维护分支写，版本之间真正的分叉在下面那张表里。

```wiki-diagram
file: recompute-scheduler
```

## 那条请求用不到它

[那条请求](one-request.md)是单卡、没有 `kv_transfer_config`、队列里唯一的一条，三层都不合格：没有 PD 就根本装不上这个调度器（`kv_role` 不是 `kv_consumer` 直接 `ValueError` [C11]）；就算装上，一条请求也抢不掉自己的块；237 个 token 只占 2 块。

要让它走到这里，把设定改成 1P1D：模型、`block_size` 128 不变，D 节点上并发跑到 KV 池撑不住 [A]。取被抢占的时刻是「第 100 个输出 token 刚采样出来」——那一刻 KV 里装着 prompt 的 37 个加上已经写回去的 99 个输出 token，第 100 个 token 自己的 KV 要到下一步才写，所以 `num_computed_tokens = 37 + 99 = 136` [D]。

| 这一刻的量 | 值 | 怎么来的 |
|---|---|---|
| D 上立刻还回块池的块 | `ceil(136 / 128) = 2` 块 = 28 MiB | 每块 14 MiB，取自[那条请求](one-request.md) |
| proxy 手上已有的输出 | 100 个 token，原样接到 prompt 后面 | 文本拼接，重投时要重新分词，所以 137 是近似值 [D] |
| P 要重新 prefill 的长度 | 37 + 100 = **137** 个 token | 原来 P 只需要算 37 个，算量涨到 **3.7 倍** |
| 重新跨节点传的 KV | 137 × 112 KiB ≈ **15.0 MiB** | 第一次传的 37 × 112 KiB = 4.0 MiB 白传了 |

**这就是这一页的代价所在**：抢占本身省下的是 D 上那 28 MiB 块空间，换来的是 P 上 3.7 倍的 prefill 加一次 15 MiB 的重传，而且这一切在日志里只有一行 warning。

## 上游的抢占默认「本地能重算」，D 节点上这个前提不成立

上游 `_preempt_request` 做四件事：释放请求全部 KV 块、状态转 `PREEMPTED`、`num_computed_tokens` 归零、塞回 waiting 队头 [C1]；细节在[调度器](vllm-scheduler.md)那一页。归零的含义很硬——这条请求接下来要从第 0 个 token 重新算一遍，而且是在本地算。

官方文档对 D 节点给的答案是另一条：KV 不够时请求被送回 Prefill 节点去重算 [S30]（在线版 <https://docs.vllm.ai/projects/ascend/en/v0.23.0/tutorials/models/DeepSeek-V3.1.html>）。代码里的分叉条件就写在 `allocate_slots` 要不到块的那个 `while True` 里：`kv_transfer_config` 存在且不是 `kv_producer`，就走昇腾这条新路。

为什么不在 D 上重算？D 节点的 `max_num_batched_tokens`、图捕获的形状、块池大小全是按 decode 配的，临时插一次上千 token 的 prefill 正是 PD 分离要避开的那件事 [I]——这一层是我按 [PD 分离](pd-disaggregation.md)的部署形状推的，源码里只写了「送回 P」这个结果，没写理由。

## 它只接管一个决策点，schedule() 的其余部分是照抄的

`RecomputeScheduler(Scheduler)` 在 v0.23 上只重写了四个方法：`add_request`（MTP 的 D 节点上给请求塞满 `PLACEHOLDER_TOKEN_ID`，否则图匹配不上会掉回 eager）[C7]、`_update_waiting_for_remote_kv`（拉完远端 KV 后把 `num_computed_tokens` 夹回 `num_tokens` 以内，占位 token 会把它顶超）、`schedule()`、`update_from_output()`。新增的状态只有三个 dataclass：`PreemptedRequestData`、`RecomputeReqInfo`、以及在 `SchedulerOutput` 上多挂这两张表的 `RecomputeSchedulerOutput`。

`schedule()` 是整段复制上游再改一处。main 上的 docstring 把「为什么值得复制这么一大段」说穿了：保留本地副本是为了给第一条 decode 请求补齐投机解码的形状，让 full graph 对得上；抢占的 KV 能卸就卸，卸不掉才送回 P [C20]。

改动之外还有一条连带规则：这一步只要发生过抢占或终止，`if not preempted_reqs and not recomputed_reqs` 就拦住后面那段 waiting 队列循环，这一步不再放新请求进来。

## 客户端看到的是一次「正常结束」

「不接」那一路的产物是一帧 `EngineCoreOutput`：`finish_reason=STOP`、`new_token_ids=[]`、`stop_reason="recomputed"`。剩下的事全在引擎外面——`examples/disaggregated_prefill_v1/` 里那个 proxy 示例认这个字符串 [C13]：

```python
if stop_reason == "recomputed":
    retry = True
    retry_count += 1
    req_data["prompt"] = origin_prompt + generated_token          # 已生成的 token 接到 prompt 后面
    req_data["max_tokens"] = origin_max_tokens - completion_tokens + retry_count
    instance_info = await reassign_instances(...)                 # 重新挑一对 P/D
```

三件要记住的事。一，重投用的是 `origin_prompt`，不是当前 prompt——所以生成内容不会丢，但整条要重新分词、重新 prefill。二，外层是 `while retry:`，**没有重试次数上限** [C14]，一条运气差的请求可以被反复退回。三，**不经 proxy、直连 D 节点的调用方会把这一帧当成正常结束**：输出被截断，`finish_reason` 却是 `stop`，没有任何报错 [D]——`stop_reason` 是唯一的线索。

## 开它只有一个键，但有三道门和一次可能的静默覆盖

```bash
# 只写在 D 节点上。kv_transfer_config 的写法见 PD 分离那一页
--kv-transfer-config '{"kv_connector":"MooncakeConnectorV1","kv_role":"kv_consumer", ...}'
--additional-config '{"recompute_scheduler_enable": true}'
```

`platform.py` 的三道门 [C11]：`kv_role == "kv_producer"` → 打一条 warning、就地置 `False`，并把这个 `False` 写回 `additional_config`，让重建 AscendConfig 的 worker 进程也看到；没有 `kv_transfer_config` 或 `kv_role` 不是 `kv_consumer`（含 `kv_both`）→ `ValueError`；都过了，才把 `vllm_config.scheduler_config` 整个换成 `RecomputeSchedulerConfig`，并按 `async_scheduling` 在同步 / 异步两个类之间挑一个。

反过来还有一条硬依赖：`oproj_tensor_parallel_size` 或 `embedding_tensor_parallel_size` 大于 0 时**必须**开它，否则 `AssertionError`。注释给的理由是只有这个调度器把各 DP rank 的 `num_tokens` 对齐，跨 DP 的 HCCL 集合通信才不会因为形状不一致挂死 [C12]。

要小心的是挑类的顺序。`_check_ascend_config` 在 `check_and_update_config` 的第 5 步就把 `scheduler_cls` 定好，第 8 步的 `_setup_worker_and_scheduler` 才跑 [C26]；后者一旦看到 `profiling_chunk_config.enabled` 或 `batch_job_sched_config.enabled`，就直接覆盖 `scheduler_cls` [C27]，而它们和 recompute 之间**没有任何互斥校验**——同时开就是静默失效，日志里连一条 warning 都没有 [D]。v0.23 上同一个位置还多一个 `SLO_limits_for_dynamic_batch` 分支，行为一样。

## 版本之间的差异

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 「不接」之后怎么收尾 | 只调 `kv_cache_manager.free()`，不走 finish 流程，请求仍留在 `self.requests` 里、状态还是 RUNNING [C3] | 改走 `_finish_recomputed_request()` → `finish_requests(FINISHED_ABORTED)`，docstring 写明「through the normal abort path」 | 同 v0.26 | `[!]` v0.23 上这条请求在引擎侧没有被正式结束，只有客户端那边看到它结束了 |
| 钩子抛异常怎么办 | 没有 try/except，异常直接冒到引擎外 | 同 v0.23 | try/except 兜住，打 warning 后退回重算 [C21] | `[!]` 连接器出问题，v0.23 / v0.26 上会打死这一步 |
| 受害者怎么挑 | D 节点分支写死 `self.running.pop()`，不看调度策略 | 同 v0.23 | 先按上游策略挑（`PRIORITY` 下取 `max(priority, arrival_time)`），再决定怎么处置 [C22] | 开了优先级调度的 D 节点，v0.23 / v0.26 踢掉的不是最该踢的那条 |
| 开关键写在哪 | 只认顶层 `additional_config.recompute_scheduler_enable` | 顶层与 `additional_config.scheduler_config.*` 都认，嵌套的优先，顶层写法一律打弃用警告 [C18] | 同 v0.26 | `[!]` 两个方向抄配置都会出事：嵌套写法在 v0.23 上被静默忽略 |
| 投机解码的形状怎么凑齐 | `add_request` 里塞 `PLACEHOLDER_TOKEN_ID` | `schedule()` 里 `pad_spec_decode` 把 decode 步补成 `1 + num_spec_tokens` [C17] | 同 v0.26 | 实现换了、目的没换：让 D 上的 decode 步形状固定，full graph 才对得上 |
| 装出来几个类 | 2 个，由 `RecomputeSchedulerConfig` 自己按 `async_scheduling` 挑 | 2 个 | 4 个，和 [DyntraLB](dyntra-lb.md) 交叉，挑类抽成 `_get_recompute_scheduler_cls` [C24] | main 上开了 DyntraLB 也能同时开 recompute；早两版根本没有 DyntraLB 这个特性 |

## 常见误解

- **「它自己会在 D 节点上重算 prefill」**——不会。这个类一个 token 都不重算，它只负责终止请求并打上标记；重算发生在 P 节点上，前提是你前面确实挂了一个认 `stop_reason="recomputed"` 的 PD proxy。名字里的 Recompute 说的是别人要做的事。
- **「开了它，被抢占的请求就不会丢 KV」**——反了。只开它的时候，被抢占请求的 KV 全丢；要想不丢，得另外配上 [Recompute CPU Offload / PreemptOffloadConnector](recompute-cpu-offload.md)，让 `update_state_before_preempt` 返回 `True`，这一页才会走左边那条路。
- **「P 节点上写上它没坏处，官方说会报错拦住」**——官方文档写的是在 P 节点或 PD 混布上「startup will fail with a clear error」[S29]，代码里 `kv_role == "kv_producer"` 走的却是 warning + 就地关掉，只有 PD 混布和没配 `kv_transfer_config` 才真 `ValueError` [C11]。文档和代码不一致 `[!]`，以代码为准。
