---
id: recompute-cpu-offload
title: "Recompute CPU Offload / Preempt Offload：被抢占的请求不回炉重算"
type: feature
summary: D 节点显存不够、要踢掉一条正在 decode 的请求时，先把它已经算好的 KV 块搬到主机内存，重新排上再搬回来，省掉一整轮 prefill。开发主线上它换了名字。
aliases: [Recompute CPU Offload, 重算 CPU 卸载, RecomputeCPUOffloadConnector, Preempt Offload, PreemptOffloadConnector, 抢占卸载, 抢占 KV 卸载]
chapters: ["11", "12"]
sources:
  - vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L316-L373
  - vllm-ascend@2c59ff10:vllm_ascend/core/recompute_scheduler.py#L294-L349
  - vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L103-L166
  - vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L992-L1021
  - vllm-ascend@baa023ad:vllm_ascend/core/recompute_scheduler.py#L504-L521
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L90-L113
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L154-L188
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L211-L232
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L262-L334
  - vllm-ascend@2c59ff10:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L251-L299
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py#L550-L586
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/preempt_offload_connector.py#L44-L111
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/worker.py#L99-L134
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/worker.py#L146-L177
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/worker.py#L212-L296
  - vllm-ascend@baa023ad:vllm_ascend/worker/model_runner_v1.py#L2233-L2238
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1014-L1044
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L689-L710
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1431-L1454
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L139-L142
  - vllm-ascend@baa023ad:vllm_ascend/distributed/kv_transfer/__init__.py#L119-L123
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/preempt_offload_connector.md#L40-L80
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/recompute_cpu_offload.md#L63-L74
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/preempt_offload_connector.md#L262-L281
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/preempt_offload_connector.md#L313-L317
  - vllm-ascend@baa023ad:vllm_ascend/worker/v2/model_runner.py#L320-L325
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/preempt_offload_connector.html
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/__init__.py#L83-L87
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/recompute_cpu_offload_connector.py#L40-L71
  - vllm-ascend@2ed6cbba:vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/manager.py#L252-L281
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
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
  - to: linear-attention
    kind: builds-on
    note: 混合模型被抢占时，main 与 v0.26 上线性注意力那几组只搬最后 1 + num_spec_tokens 份状态，不按 token 数折块
contradicts: []
updated: "2026-09-25"
---

PD 分离（prefill 和 decode 放在不同机器上跑）的 D 节点显存不够时，调度器会踢掉一条正在 decode 的请求。**没有这个功能，那条请求被直接终止、退回 P 节点把整条问题从头再算一遍**；有了它，这条请求已经算好的 KV 块先搬进主机内存，重新排上时再搬回来，一个 token 都不用重算。它在开发主线上换了名字，旧配置照抄过去会直接起不来——具体见下半「版本差异」。

```wiki-diagram
file: recompute-cpu-offload
```

## 先问一个具体问题

一台 D 节点上同时在 decode 几十条长对话，每条都是 32K 个 token。显存里的 KV 块分完了，新 token 没地方写，调度器只好挑一条请求让出它的块。

这条被挑中的请求，前面 32K 个 token 的 KV 已经全都算好了。现在有两种处理：

- **扔掉重来**：请求被终止，交回 P 节点，整条问题重新 prefill 一遍，再把 KV 跨机器传回 D 节点。
- **先存起来**：把它的 KV 块拷到主机内存（CPU 那边的内存，大得多也慢得多），等显存空出来，再拷回来接着 decode。

这一页讲的就是第二种。

## 拿 Qwen3.6-35B-A3B 算一笔账

[那条请求](one-request.md)自己碰不到这一页：它只在单台机器上跑、队列里就它一条，不存在「被抢占」；237 个 token 也只占 1 个 KV 块。要让这一页有数可算，得把同一个模型搬到一台 PD 分离的 D 节点上：张量并行（TP）仍是 2，每条请求最长 32K 个 token，并发跑满，每颗 NPU 给主机内存留 16 GiB 存被抢占的请求。

这个模型有 40 层：10 层是全注意力，要存 KV；另外 30 层是[线性注意力](linear-attention.md)，只存一份大小固定的状态。下面的数都是**一颗 NPU 上的量**。

| 这一步在算什么 | 值 | 从哪来 |
|---|---|---|
| 一个 KV 块装多少 token | **2048 个** | 和[那条请求](one-request.md)同一个数，这个模型的块是按状态大小倒推出来的 |
| 一条 32K 请求占几个 KV 块 | 32768 ÷ 2048 = **16 块** | |
| 这 16 块的 KV 有多大 | 32768 × 10 KiB = **320 MiB** | 每个 token 在 10 层全注意力里共存 10 KiB |
| 线性注意力状态要搬多少 | 每层只搬最后一份，30 层合计约 **60.7 MiB** | 状态和对话长短无关，只看最新那一份 |
| 保一条请求一共搬多少 | 约 **381 MiB** | 存进去一次、搬回来一次 |
| 16 GiB 能同时保住几条 | 约 **四十条出头** | 再多一条，主机内存里没空位，这条就只能退回去重算 |

对比一下「扔掉重来」的代价：整条 32K 的问题在 P 节点重新 prefill，再把 320 MiB 的 KV 跨机器传回来；这边只是在本机把 381 MiB 拷出去、再拷回来。**prompt 越长，重算越贵，这个功能越划算。**

## 搬出去必须当场做完

最不能商量的一点：**把 KV 块搬到主机内存这一步，必须赶在显存块被交给别人之前完成。** 调度器在同一步里就可能把这些刚让出的块分给另一条请求；晚一点搬，搬到的就是别人的数据了。所以这一步是阻塞的：搬完之前，这一步的计算不往下走。

搬运本身也没做什么优化：一块一块地拷，拷完一起等。**所以这条路径不是「省显存」的手段，而是拿一次同步的来回拷贝，换掉一整轮 prefill。** 想看异步、批量搬运是什么样子，去看隔壁的 [KV Cache CPU Offload](kv-cache-cpu-offload.md)——两者的搬运实现完全不同。

## 所有 NPU 都存好，才敢把它排回来

一条请求的 KV 分散在几颗 NPU 上（TP=2 时就是两颗），每颗各存各的。只有**每一颗都报告「存好了」**，这条请求才算可以恢复。

没集齐之前，调度器问「这条请求能从主机内存找回多少 token」，得到的回答不是「0 个」，而是「说不清」。调度器碰到「说不清」的请求，这一步就先跳过它，下一步再问。这个设计没有为「等存完」专门加一种状态，只是复用了已有的「说不清就先跳过」这条规矩。

多条被抢占的请求如果开头一样，还可以在主机内存里共用同一份块——判断「开头一样」用的就是[前缀缓存](prefix-caching.md)那套办法，这个功能默认关着，官方标为实验性。

## 空间不够就悄悄退回原路

调度器每次要踢人时，都先问一句：「这条你接不接？」接了，请求转为「被抢占」，回等待队列排着；不接，就走老路——终止请求、退回 P 节点重算。

「不接」有三种情况：没配这个功能；主机内存空位不够；存的过程出了异常。第三种在开发主线上被兜住了，出问题不会把整个服务打挂，只是退回重算。

**退回重算是一次彻底的重来**：整条问题重新 prefill，外加一次完整的跨机器 KV 传输。日志里只有一行警告，没有报错。**预留的主机内存给少了，等于没开。**

## 常见误解

- **「它和 KV Cache CPU Offload 是一回事」**——不是。那条路搬的是显存里要被挤掉的、别的请求以后可能用得上的开头那些块；这条只在请求被抢占时，点名保住这一条请求自己的 KV，别的请求用不上。官方问答里专门写了一条澄清这件事。
- **「开了就一定不会重算」**——不一定。主机内存空位不够、或者存的过程出了异常，调度器照样走老路重算，而且只留一行警告。
- **「只要是 D 节点就能开」**——还有硬门槛：开了上下文并行（CP）就不能用；官方还写明 Qwen3.5 配异步调度尚未完全支持，用这个功能时要把异步调度关掉。

## 对照源码

### 怎么开

- 只在 PD 分离的 D 节点上生效：`recompute_scheduler_enable` 只认 `kv_role == "kv_consumer"`；`kv_producer` 上警告后强制关闭，PD 混布或没有 `kv_transfer_config` 直接 `ValueError` [C17][C18]。开关键在各分支的写法不同，见下面「版本差异」和 [Recompute Scheduler](recompute-scheduler.md)。
- 连接器名：v0.23 / v0.26 是 `RecomputeCPUOffloadConnector`，main 是 `PreemptOffloadConnector` [C21][C28]。
- 容量：`cpu_bytes_to_use_per_rank` 优先级最高、不会被 `world_size` 再除一次 [C12]。CPU 块数的算式是 `num_gpu_blocks × 预算 ÷ HBM 池总字节`，等价于预算 ÷ 每块字节 [C7]。
- 都不写时：发布分支 `cpu_bytes_to_use` 默认 8 GiB（整实例，再除 `world_size`）；main 删掉了字节默认值，走 `offload_host_memory_ratio`，默认 `1`，于是 `num_cpu_blocks = HBM 块数` [S22]——等于把整个 HBM KV 池原样再锁一份 pinned 主机内存，启动时一次性分配。
- `enable_offload_prefix_caching` 默认 `false`，官方标为实验性。
- 真机上记得 Docker 的 `--shm-size`：官方建议 A3 上按 16 GiB/卡的预算给 `--shm-size=1024g`，给小了会在启动阶段 OOM 或挂住（在线版见 <https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/preempt_offload_connector.html> [S27]）。

### 会报什么错

- 不在 D 节点上：PD 混布或没有 `kv_transfer_config` 时 `ValueError`。
- `decode_context_parallel_size` 与 `prefill_context_parallel_size` 都断言必须为 1，开了 dcp / pcp 就 assert 失败 [C6]。
- 把发布分支的连接器名照抄到 main：注册表里查无此项，连接器根本造不出来 `[!]`。
- 主机内存不够时**不报错**：`_create_preempt_state` 发现 `num_needed > get_num_free_blocks()`，打一条 `Skip preempt offload for request ...` 的 warning 返回 `False` [C9]。
- 异步调度：官方写明 Qwen3.5 配异步调度尚未完全支持，要把 `async_scheduling` 关掉 [S24]。

### 开销和什么时候别开

- **D2H 同步阻塞**：模型侧在 `_update_states()` **之前**调 `handle_preemptions()`，注释写明调度器可能在这一步把这些块 id 分给别的请求 [C16]。回填走 `start_load_kv()`，前向之前搬回来，再由 `wait_for_layer_load()` 让前向流等 load 流。
- **搬运没优化**：`_submit_transfer` 进循环前先来一次全设备 `torch.npu.synchronize()`，然后逐块、逐张量 `torch.Tensor.copy_`，源码自带 TODO 说还没换成专用算子；两个方向都是 `sync=True`，提交完就 `event.synchronize()` [C15]。
- **全体 worker 点头**：每个 worker 存完报 `{event_idx: 1}`，调度侧累加到 `world_size` 才把请求置 `ready=True` [C11]；在那之前 `get_num_new_matched_tokens` 返回 **`None`** 而不是 0 [C8]，调度器把请求弹出队列、塞进 `step_skipped_waiting`，这一步不调度。
- **跨请求共享**：`enable_offload_prefix_caching` 打开时，谁先把块存实，`_process_preempt_store_event` 就把它插进 CPU 块池的哈希表，后来者直接 `touch` 复用。
- **静默降级**：`_preempt_or_recompute()` 先拿 `update_state_before_preempt` 问连接器，接了走 `_preempt_request()`（请求转 PREEMPTED、回等待队列），不接落到 `_finish_recomputed_request()`；main 用 try/except 兜住钩子异常 [C3]。退回重算时请求以 `FINISHED_ABORTED` 终止，`update_from_output` 额外插一条 `stop_reason="recomputed"`、`new_token_ids=[]` 的输出，由 PD proxy 重新投给 P 节点 [C4]。
- **上半那笔账的推导** [D]（Qwen3.6-35B-A3B，TP=2，每颗 NPU；模型形状见官方 config [S31]，块大小与每 token 字节数沿用 [那条请求](one-request.md) 已核值）：
  - 全注意力 KV：`2（K、V）× 1（每颗 KV 头）× 256（head_dim）× 2 B = 1 KiB`/token/层，10 层 10 KiB；32768 个 token 共 320 MiB，折 `32768 ÷ 2048 = 16` 块。
  - 线性注意力状态：main 上 Mamba 组只卸载最后 `1 + num_spec_tokens` 块（`manager.py` L287–L292），不开投机解码时每层 1 份；按补齐后的页算，30 层合计约 60.7 MiB。
  - 合计约 380.7 MiB/条；`16384 MiB ÷ 380.7 MiB ≈ 43`。实际按块取整，还和混合模型各组怎么共用块池有关，所以上半只写「四十条出头」。
  - 这笔账只对 main 与 v0.26 成立；v0.23 对线性注意力组不做特殊处理（见下表），按上面的算法算不准。

### 版本差异

main 开发主线（源码快照 `baa023ad`，2026-09-21）在 `9eb752ab`（PR #16510，2026-09-16）把这个特性整体改名搬家：目录从 `kv_pool/recompute_cpu_offload/` 挪到 `kv_pool/kv_offload/preempt_offload/`，和 [KV Cache CPU Offload](kv-cache-cpu-offload.md) 并进同一个 `kv_offload/` 下；所有 `RecomputeCPUOffload*` 标识符在 main 上已不存在。v0.23 维护分支（`2c59ff10`）与 v0.26 分支（`2ed6cbba`）仍是老名字、老路径，用户文档也还叫 `recompute_cpu_offload.md` [S23]。调度器那一侧的类名 `RecomputeScheduler` 三版都没变。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 连接器注册名 | `RecomputeCPUOffloadConnector` | 同 v0.23 | `PreemptOffloadConnector` | `[!]` 名字照抄过去，注册表里查无此项，不是「开了没效果」那种降级 |
| 开关键路径 | `additional_config.recompute_scheduler_enable` | 顶层与嵌套都认，顶层打弃用警告 | 同 v0.26 | `[!]` main 的嵌套写法在 v0.23 上被静默忽略；细节见 [Recompute Scheduler](recompute-scheduler.md) |
| 两个容量参数都不写 | `cpu_bytes_to_use` 默认 8 GiB（整实例，再除 `world_size`） | 同 v0.23 | 没有字节默认值了，按 `offload_host_memory_ratio` 开，默认 1 : 1 对齐 HBM 块数 | `[!]` 同一份「什么都不配」的配置，发布分支与 main 锁掉的主机内存量完全不同 |
| 受害者怎么挑 | `kv_consumer` 分支写死 `self.running.pop()`，不看调度策略 | 同 v0.23 | 和普通抢占共用一套选择：`PRIORITY` 策略下挑 `max(priority, arrival_time)` | 开了优先级调度的 D 节点，两个发布分支踢掉的不是最该踢的那条 |
| `_create_preempt_state` 挑哪些块 | 所有组按 attention 的 `block_size` 一视同仁；另有一段 `_maybe_evict_cached_block`，把本步刚打上 hash、前向还没写入的 GPU 块从前缀缓存里摘掉 | 同 main：Mamba 组只卸载最后 `1 + num_spec_tokens` 块，逐出循环也没有 | Mamba 组只卸载最后 `1 + num_spec_tokens` 块；那段逐出循环已删 | `[!]` 混合模型（比如 Qwen3.6-35B-A3B）上只有 v0.23 没针对线性注意力状态适配 |
| 模型执行器 | 只有 model_runner_v1 | 同 v0.23 | v1 与 v2 两个执行器都调 `handle_preemptions` | MRV2 上也能用了，这正是改名那个 PR 的主题 |

三版一致的部分：`kv_role` 必须是 `kv_consumer`，`kv_producer` 上警告后强制关闭，其余情况 `ValueError`；`enable_offload_prefix_caching` 默认 `false` 且官方标为实验性；`cpu_bytes_to_use_per_rank` 优先级最高、不会被 `world_size` 再除一次；dcp / pcp 必须为 1。

官方 FAQ 专门澄清了它和 KV Cache CPU Offload 不是一回事 [S25]：那条路搬的是块池 LRU 要淘汰的可复用前缀块，这条按请求点名、只保被抢占请求自己的活跃 KV，两者的 worker 侧搬运代码也毫无共用。

### 源码位置

| 看什么 | 文件（main） |
|---|---|
| 抢占还是重算、受害者怎么挑、退回重算的输出 | `vllm_ascend/core/recompute_scheduler.py`（`_preempt_or_recompute`、`update_from_output`） |
| CPU 块数怎么算、挑哪些块、能恢复多少 token、存好事件怎么集齐 | `vllm_ascend/distributed/kv_transfer/kv_pool/kv_offload/preempt_offload/manager.py`（`_derive_cpu_config`、`_create_preempt_state`、`get_num_new_matched_tokens`） |
| 连接器入口 | `.../preempt_offload/preempt_offload_connector.py` |
| D2H / H2D 搬运 | `.../preempt_offload/worker.py`（`handle_preemptions`、`start_load_kv`、`_submit_transfer`） |
| 模型侧调用点 | `vllm_ascend/worker/model_runner_v1.py`、`vllm_ascend/worker/v2/model_runner.py` |
| 开关校验 | `vllm_ascend/platform.py`、`vllm_ascend/ascend_config.py` |
| 连接器注册表 | `vllm_ascend/distributed/kv_transfer/__init__.py` |
| v0.23 / v0.26 老路径 | `vllm_ascend/distributed/kv_transfer/kv_pool/recompute_cpu_offload/` |
