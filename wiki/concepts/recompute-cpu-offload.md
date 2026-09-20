---
id: recompute-cpu-offload
title: "Recompute CPU Offload / Preempt Offload：被抢占的请求不回炉重算"
type: feature
summary: PD 分离的 Decode 节点抢占一条请求时，先把它已算好的 KV 块同步拷进锁页主机内存，重新排上再拷回来，省掉一整轮 prefill。main 开发主线已把它改名成 PreemptOffloadConnector。
aliases: [Recompute CPU Offload, 重算 CPU 卸载, RecomputeCPUOffloadConnector, Preempt Offload, PreemptOffloadConnector, 抢占卸载, 抢占 KV 卸载]
chapters: ["11", "12"]
sources:
  - vllm-ascend@b255ab59:vllm_ascend/core/recompute_scheduler.py#L316-L373
  - vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L294-L347
  - vllm-ascend@b255ab59:vllm_ascend/core/recompute_scheduler.py#L103-L166
  - vllm-ascend@b255ab59:vllm_ascend/core/recompute_scheduler.py#L992-L1021
  - vllm-ascend@b255ab59:vllm_ascend/core/recompute_scheduler.py#L504-L521
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L90-L113
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L154-L188
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L211-L232
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L284-L334
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L251-L299
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L550-L586
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/preempt_offload_connector.py#L44-L111
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/worker.py#L99-L134
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/worker.py#L146-L177
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/worker.py#L212-L296
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L2197-L2202
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L1012-L1042
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L689-L710
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1421-L1444
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L139-L142
  - vllm-ascend@b255ab59:vllm_ascend/distributed/kv_transfer/__init__.py#L119-L123
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/preempt_offload_connector.md#L40-L80
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L63-L74
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/preempt_offload_connector.md#L262-L281
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/preempt_offload_connector.md#L313-L317
  - vllm-ascend@b255ab59:vllm_ascend/worker/v2/model_runner.py#L309-L314
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/preempt_offload_connector.html
evidence: "C"
relations:
  - to: block-table
    kind: builds-on
    note: 卸载与回填都按块进行，CPU 侧维持一份与 HBM 块表逐位对齐的块 id 表，滑窗留下的空洞位用 0 占位而不压缩
  - to: kv-cache-spec
    kind: builds-on
    note: CPU 块池直接复用 GPU 侧 KVCacheConfig 的 kv_cache_groups，每组的 block_size 决定 token 到块的换算
  - to: prefix-caching
    kind: builds-on
    note: enable_offload_prefix_caching 打开后，已算满的块按 prefix cache 的 block_hash 在多个被抢占请求间共享同一个 CPU 块
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 这一页的入口就是那一页里 allocate_slots 要不到块的那一刻——抢占谁、接下来怎么办，才轮到本页
  - to: kv-cache-cpu-offload
    kind: alternative-to
    note: 两者都往主机内存搬 KV，但那条路搬的是块池 LRU 要淘汰的可复用前缀块，这条按请求点名、只保被抢占请求自己的活跃 KV
contradicts: []
updated: "2026-09-20"
---

## 一句话

PD 分离的 Decode 节点上 HBM 块不够用时，调度器会踢掉一条正在 decode 的请求。**没有这个连接器，那条请求被直接终止、退回 Prefill 节点把整条 prompt 重算一遍**；有了它，它已经算好的 KV 块先同步拷进锁页主机内存，重新排上再拷回来，一个 token 都不用重算。**它在 main 开发主线上已经改名搬家**：连接器名从 `RecomputeCPUOffloadConnector` 变成 `PreemptOffloadConnector` [C21]，旧名字在 main 的注册表里已经查无此项，配置照抄过去连接器根本造不出来 `[!]`。

```wiki-diagram
file: recompute-cpu-offload
```

## 那条请求碰不到它，因为它根本不在 D 节点上

[那条请求](one-request.md)是单卡、无 PD、队列里唯一的一条。它在这一页上三重不合格：`recompute_scheduler_enable` 只在 `kv_role == "kv_consumer"` 的节点上生效，PD 混布或没有 `kv_transfer_config` 直接 `ValueError` [C17]；就算配上，一条请求不可能把自己的块抢光；237 个 token 也只占 2 块。

要让这一页有数可算，得把它搬到一台 PD 分离的 Decode 节点上：`--max-model-len 32768`、并发跑满、每卡 `cpu_bytes_to_use_per_rank` 给 16 GiB，其余设定（Qwen3-0.6B、`block_size` 128）不变 [A]。

| 这一步在算什么 | 值 | 依据 |
|---|---|---|
| 一个块的 KV 多少字节 | 128 × 112 KiB = **14 MiB** | 和[那条请求](one-request.md)是同一个数 |
| 16 GiB/卡 换成几个 CPU 块 | 16384 ÷ 14 = **1170 块** | 算式是 `num_gpu_blocks × 预算 ÷ HBM 池总字节`，等价于预算 ÷ 每块字节 [C7] |
| 保得住多少 token | 1170 × 128 = **149760 个** | 每条 32K 的请求占 32768 ÷ 128 = 256 块 [D] |
| 同时保得住几条 | 1170 ÷ 256 = 4.57 → **4 条** | 第 5 条 `_create_preempt_state` 发现空闲块不够，打一条 warning 返回 `False` [C9] |
| 保一条要搬多少字节 | 256 × 14 MiB = **3.5 GiB** | D2H、H2D 各一次，两次都在调度关键路径上同步阻塞 |

**最该记住的是「什么都不配」时会发生什么。** main 删掉了 8 GiB 的字节默认值，改成按比例开：两个字节参数都不给时走 `offload_host_memory_ratio`，默认 `1`，于是 `num_cpu_blocks = HBM 块数` [S22]——等于把整个 HBM KV 池的大小原样再锁一份 pinned 主机内存，而且是启动时一次性分配好的。真机上还要记得 Docker 的 `--shm-size`：官方建议 A3 上按 16 GiB/卡 的预算给 `--shm-size=1024g`，给小了会在启动阶段 OOM 或挂住（在线版见 <https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/preempt_offload_connector.html> [S27]）。

## D2H 必须阻塞，因为块 id 可能在同一步里就被发给别人

这是整条链路上唯一不能商量的地方。模型侧在 `_update_states()` **之前**就调 `handle_preemptions()`，注释写得很直白：调度器可能在这一步里把这些块 id 分给别的请求，晚一点搬就搬到别人的数据了 [C16]。回填走的是另一个入口 `start_load_kv()`，在前向之前把块搬回来，再由 `wait_for_layer_load()` 让前向流等一下那条 load 流。

搬运本身谈不上优化：`_submit_transfer` 进循环前先来一次全设备 `torch.npu.synchronize()`，然后逐块、逐张量地 `torch.Tensor.copy_`，源码自带 TODO 说还没换成专用算子 [C15]。两个方向都是 `sync=True`，提交完就 `event.synchronize()` 等在那儿。**所以这条路径不是「省显存」，是拿一次同步的全量往返换掉一整轮 prefill**——省不省得回来，取决于被抢占请求的 prompt 有多长。要看异步、批量 DMA 是什么样子，去看隔壁那条路的 [KV Cache CPU Offload](kv-cache-cpu-offload.md)，两者的搬运实现完全不同源。

## 「存好了」要全体 worker 点头，恢复才敢排上

每个 worker 存完把 `{event_idx: 1}` 报上来，调度侧累加到 `world_size` 才把这条请求置 `ready=True` [C11]。在那之前它的 `get_num_new_matched_tokens` 返回的不是 0 而是 **`None`** [C8]，而调度器看到 `None` 的反应是把请求弹出队列、塞进 `step_skipped_waiting`、这一步不调度它。

这个设计值得单独记一笔：**恢复被推迟到 D2H 真正落盘之后，靠的是复用「connector 说不清楚就先跳过」这条既有语义，没有为它加任何等待状态**。同一条规则在 `enable_offload_prefix_caching` 打开时也够用——那时多条被抢占请求会按 `block_hash` 共享同一个 CPU 块，谁先把块存实，`_process_preempt_store_event` 就把它插进 CPU 块池的哈希表，后来者直接 `touch` 复用，跨请求共享的判定交给[前缀缓存](prefix-caching.md)那套哈希，这一页不重复造。

## 容量不够就静默退回原路，这是设计不是 bug

`_preempt_or_recompute()` 是整条特性的开关点：它先拿 `update_state_before_preempt` 这个钩子问连接器接不接，接了就走正常的 `_preempt_request()`（请求转 PREEMPTED、回等待队列），不接就落到 `_finish_recomputed_request()`。「不接」有三种：没配连接器、CPU 空闲块不够、钩子抛异常——main 用 try/except 把第三种兜住了，连接器出问题不会打死引擎，只是退回重算 [C3]。

退回重算长什么样？请求以 `FINISHED_ABORTED` 终止，`update_from_output` 额外给客户端插一条 `stop_reason="recomputed"`、`new_token_ids=[]` 的输出，由 PD proxy 把它重新投给 Prefill 节点 [C4]。**这是一次彻底的重来**：整条 prompt 重算，外加一次完整的跨节点 KV 传输。日志里只有一行 warning，没有报错、没有排队——**预算配小了，等于白配**。

## 两个分支在这一页上的差别

main 开发主线（源码快照 `b255ab59`，2026-09-19）在 `9eb752ab`（PR #16510，2026-09-16）把这个特性整体改名搬家：目录从 `kv_pool/recompute_cpu_offload/` 挪到 `kv_pool/kv_offload/preempt_offload/`，和 [KV Cache CPU Offload](kv-cache-cpu-offload.md) 并进同一个 `kv_offload/` 下；所有 `RecomputeCPUOffload*` 标识符在 main 上已不存在。v0.23 维护分支（源码快照 `2c59ff10`）仍是老名字、老路径，用户文档也还叫 `recompute_cpu_offload.md` [S23]。调度器那一侧的类名 `RecomputeScheduler` 两版都没变。

| 项 | v0.23 维护分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 连接器注册名 | `RecomputeCPUOffloadConnector` | `PreemptOffloadConnector` | `[!]` 名字照抄过去，注册表里查无此项，不是「开了没效果」那种降级 |
| 开关键路径 | `additional_config.recompute_scheduler_enable` [C20] | 嵌进 `additional_config.scheduler_config.…`，顶层旧写法仍接受但打弃用警告 | `[!]` 反方向抄同样出事：main 的嵌套写法在 v0.23 上被静默忽略 |
| 两个容量参数都不写 | `cpu_bytes_to_use` 默认 8 GiB（整实例，再除 `world_size`） | 没有字节默认值了，按 `offload_host_memory_ratio` 开，默认 1 : 1 对齐 HBM 块数 | `[!]` 同一份「什么都不配」的配置，两版锁掉的主机内存量完全不同 |
| 受害者怎么挑 | `kv_consumer` 分支写死 `self.running.pop()`，不看调度策略 [C2] | 和普通抢占共用一套选择：`PRIORITY` 策略下挑 `max(priority, arrival_time)` | 开了优先级调度的 D 节点，v0.23 踢掉的不是最该踢的那条 |
| `_create_preempt_state` 挑哪些块 | 所有组按 attention 的 `block_size` 一视同仁；另有一段 `_maybe_evict_cached_block`，把本步刚打上 hash、前向还没写入的 GPU 块从前缀缓存里摘掉 [C10] | Mamba 组只卸载最后 `1 + num_spec_tokens` 块；那段逐出循环已删 [C9] | `[!]` 混合模型上两版行为不同，v0.23 未针对 Mamba 状态适配 |
| 模型执行器 | 只有 model_runner_v1 | v1 与 v2 两个执行器都调 `handle_preemptions` [C26] | MRV2 上也能用了，这正是改名那个 PR 的主题 |

两版一致的部分：`kv_role` 必须是 `kv_consumer`，`kv_producer` 上警告后强制关闭，其余情况 `ValueError` [C18]；`enable_offload_prefix_caching` 默认 `false` 且官方标为实验性；`cpu_bytes_to_use_per_rank` 优先级最高、不会被 `world_size` 再除一次 [C12]；`decode_context_parallel_size` 与 `prefill_context_parallel_size` 都断言必须为 1，开了 dcp / pcp 就 assert 失败 [C6]。

## 常见误解

- **「它和 KV Cache CPU Offload 是一回事」**——不是。那条路搬的是块池 LRU 要淘汰的**可复用前缀块**，任何后续请求都可能命中；这条按请求点名，只保**被抢占请求自己的活跃 KV**，别的请求碰不到。官方 FAQ 专门写了一条澄清这件事 [S25]，两者的 worker 侧搬运代码也毫无共用。
- **「开了就一定不会重算」**——不一定。CPU 空闲块不够、或者钩子抛异常时，调度器照样把请求终止掉走原来的重算路径，而且是静默降级、日志里只有一条 warning。
- **「只要是 Decode 节点就能开」**——还有两道硬门槛。`dcp` / `pcp` 任一大于 1 就 assert 失败；官方还写明 Qwen3.5 配异步调度尚未完全支持，用这个特性时要把 `async_scheduling` 关掉 [S24]。
