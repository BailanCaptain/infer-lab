---
id: vllm-scheduler
title: 调度器：没有 prefill 和 decode 之分
type: concept
summary: 调度器每一步只问每条请求一句话——还差几个 token 没算——再从这一步的名额里分给它。第一步给 37 个、之后每步给 1 个，用的是同一条规则，不是两套代码。
aliases: [调度器, Scheduler, schedule, token 预算, token 名额, max_num_batched_tokens, 调度一步, num_computed_tokens]
chapters: ["12"]
order: 10
sources:
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L351
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L358-L363
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L376-L380
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L403-L416
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L479-L487
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L562-L570
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L870-L876
  - vllm@0fc695fc:vllm/config/scheduler.py#L42-L90
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2300-L2335
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L273-L281
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L679-L700
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/__init__.py#L50-L50
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L744-L745
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L262
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L293-L338
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L436-L437
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L721-L729
  - vllm@0fc695fc:vllm/model_executor/models/config.py#L350-L374
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2370-L2402
  - vllm@0fc695fc:vllm/config/model.py#L1768-L1811
verified: ["releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: vllm-engine-core
    kind: builds-on
    note: 调度器是引擎每转一圈的第一件事，谁在什么时候调它写在那一页
  - to: prefill
    kind: builds-on
    note: 先知道人们说的 prefill 和 decode 各指什么，才看得懂「调度器里没有这两个阶段」这句话在否定什么
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 第一步给 37 个，之后每步给 1 个，凭什么

[那条请求](one-request.md)的问题是 37 个 token，回答 200 个 token。那一页说过：第一步把 37 个 token 一起算，之后每一步只算 1 个。人们管前者叫 prefill，后者叫 decode。

那么，引擎里是不是有两段代码，一段专门处理 prefill，一段专门处理 decode？

没有。决定「这一步算这条请求的几个 token」的是**调度器**，而调度器根本不区分这两个阶段。它对每条请求只做一道减法：**这条请求一共有多少个 token，已经算过多少个，还差几个**。然后从这一步的名额里分给它，能给多少给多少。

第一步给 37、之后给 1，是同一道减法算出来的两个不同结果，不是两条路。

```wiki-diagram
file: token-budget
```

## 一步有多少个名额

每一步，引擎挑出一批请求，一起算一次（这叫「一步」）。一步最多算多少个 token 是有上限的，这里把这个上限叫**名额**：一个名额就是这一步允许算的一个 token。

这个例子在昇腾上用默认设置起服务，一步的名额是 **2048 个**。为什么是 2048 而不是别的数，下面「名额是谁定的」一节讲。

注意名额数的是 **token**，不是请求。2048 个名额可以给一条请求用掉 2048 个，也可以分给几百条请求每条 1 个。一步最多放几条请求是另一个上限，和名额是两回事。

## 那条请求走到这里

**第 1 步。** 那条请求刚进来：一共 37 个 token，算过 0 个，还差 37 个。名额有 2048 个，37 比 2048 小，于是这一步给它 37 个。

**第 2 步。** 上一步算完，37 个都算过了；同时模型吐出了回答的第 1 个 token，这条请求变成一共 38 个 token。还差 38 − 37 = 1 个。给它 1 个。

**第 3 步到第 200 步**，每一步都一样：上一步吐出 1 个新 token，还差 1 个，给 1 个。

整个过程里调度器只问了一个问题：还差几个？答案一次是 37，之后一直是 1。人给第一种起名叫 prefill，给第二种起名叫 decode——这两个名字是讲给人听的，调度器自己用不着。

## 一条请求填不满名额，所以要凑一批

看上面那张图：第 1 步 2048 个名额只用掉 37 个，第 2 步只用掉 1 个，细到画不出来。

名额空着就是浪费。每算一步都有一笔躲不掉的固定开销：把 40 层从头走到尾，把权重从显存里读出来，两颗 NPU 之间来回传数据。只为 1 个 token 付这笔开销太亏。所以调度器要做的另一件事，就是把别的请求也塞进同一步：这条请求要 1 个，那条要 1 个，新来的一条要 500 个……加起来尽量接近 2048。**这就是「一批」的来历**——一步里一起算的那些请求。

顺带一提：这个模型的 KV Cache 一块也恰好是 2048 个位置（见[那条请求](one-request.md)）。两个 2048 只是碰巧相等，一个管「一步算几个 token」，一个管「显存按多大一片分」，互不相干。

## 先照顾已经在跑的

请求分两队：已经开始生成的（在跑的），和刚来还没开始的（等着的）。每一步，调度器**先给在跑的续上**，每条给它还差的那几个；名额还有剩，才去接等着的新请求。

这个顺序的直接后果是：**已经在回答的请求，不会因为突然涌进来一大波新请求而卡住**。代价是负载高时新请求要多排一会儿。

名额是硬上限，不许透支。如果显存不够了，调度器会把某条在跑的请求**踢回等待队**：它占的 KV Cache 全部还回去，已经算过的全部作废，下次从头再算。

在昇腾上还有一处要知道：昇腾插件用自己的一份调度器顶替了上游那份。它把上面这套流程原样抄了一遍，只在接新请求那一段多加了一道默认关着的闸门，见 [Balance Scheduling](balance-scheduling.md)。

## 名额是谁定的

2048 不是写死的，是启动时查一张表查出来的：**单卡显存够大（不少于 70 GiB）而且不是 A100**，就给大的一档；否则给小的一档。起服务（这个例子就是）小档是 2048，大档是 8192。

昇腾上永远落在小档，而且和卡上实际有多少显存无关——昇腾插件故意不回答「这张卡多大显存」，查表那一步问不到，就当成 0 处理。理由写在 [NPUPlatform](npu-platform.md)。

这说明一件事：**硬件插件能间接改掉调度器的默认名额**。上游留给硬件插件的那一整套接口，每一项都可能这样波及到别处，见 [Platform：上游留给硬件的口子](vllm-platform-interface.md)。

## 问题太长会被切开

假设问题不是 37 个 token 而是 4096 个。第 1 步还差 4096 个，名额只有 2048 个，于是这一步给 2048 个，剩下 2048 个留到第 2 步。

这就是 **Chunked Prefill（分块预填充）**：问题太长，就分几步算完。它不是另一套机制，还是那道减法——还差 4096，最多给 2048，自然就切开了。这个模型这类生成式模型默认开着，不用手动开。

它仍然是个开关。手动关掉之后，装不下的请求这一步**不是被切开，而是干脆不排**。

另外还能再加一道闸：规定一条请求一步最多拿多少个名额。它防的是一条特别长的问题一口吃光整步的名额，让别的请求一步都走不动。

那条请求的 37 个 token 能一步算完，纯粹因为 37 比 2048 小。它没走任何特殊路径。

## 常见误解

- **「prefill 和 decode 是两条代码路径」**——不是。上游在调度器开头的注释里明确否掉了这个说法；它们是同一道减法的两个结果。
- **「Chunked Prefill 要手动开」**——不用。生成式模型默认就开着。要当心的是反过来：手动关掉它，长问题不是被切开，而是排不进这一步。
- **「一步 2048 个名额，就是最多 2048 条请求」**——名额数的是 token，不是请求。数请求的是另一个上限。
- **「调度器决定用哪个算子」**——不决定。它交出去的只是「这一步算哪几条请求、各算几个 token」，外加采样参数；选算子是执行那一边的事。

## 对照源码

### 怎么开

- 调度器本体是 `Scheduler.schedule()`。开头注释原话：调度器里既没有 decoding phase 也没有 prefill phase，每条请求只有 `num_computed_tokens` 和 `num_tokens_with_spec` 两个数，每一步都在让前者追上后者 [C1]。
- 名额在代码里叫 `token_budget`，每步开头取 `self.max_num_scheduled_tokens`（默认等于 `max_num_batched_tokens`）；引擎处于暂停状态时直接置 0，这一步什么也不排 [C2][C8]。
- 那道减法：在跑的一队是 `num_tokens_with_spec + num_output_placeholders - num_computed_tokens` [C4]，等着的一队是 `request.num_tokens - num_computed_tokens` [C11]，两边都再 `min(num_new_tokens, token_budget)`。那条请求第 1 步 `min(37, 2048) = 37`，第 2 步 `min(38 − 37, 2048) = 1` [D]。
- 两个 while 的顺序：先扫 `running` [C3]，再扫 `waiting` [C6]，都以 `token_budget > 0` 为条件；扫 `waiting` 还要求这一步没有发生抢占、引擎未暂停，并且 `running` 没到 `max_num_running_reqs`。
- 名额的默认值：`SchedulerConfig.DEFAULT_MAX_NUM_BATCHED_TOKENS = 2048`，`max_num_seqs` 字段兜底 128；真正生效的值由 `EngineArgs` 查表决定——`get_device_total_memory() >= 70 GiB` 且设备名不含 `a100` 时，`LLM` 类 16384、API server 8192，`max_num_seqs` 都是 1024；否则 `LLM` 类 8192、API server 2048，`max_num_seqs` 都是 256 [C9]。
- 昇腾的 `NPUPlatform.get_device_total_memory` 直接 `raise NotImplementedError`（注释说实现它会过早初始化 torch_npu）[C10]；上游那段查询包在 `try/except Exception` 里，异常后 `device_memory = 0`。所以这个例子（`vllm serve`，走 API server 一档）的名额是 2048 [D]。要改就显式传 `--max-num-batched-tokens`。
- Chunked Prefill：`SchedulerConfig.enable_chunked_prefill` 字段兜底 `True`，真正的默认由 `EngineArgs._set_default_chunked_prefill_and_prefix_caching_args` 取 `model_config.is_chunked_prefill_supported` [C20]；生成式模型里只有 encoder-decoder 返回 `False`，pooling 模型按注意力类型和池化方式判断 [C21]。
- 单条请求一步的上限是 `long_prefill_token_threshold`，大于 0 才生效，两队都在 `min` 预算之前先截一刀。
- 混合模型（带 mamba 层，这个例子的 30 层线性注意力就是）且 `mamba_cache_mode == "align"` 时，调度器还会再做一次按块对齐的切分 `_mamba_block_aligned_split` [C15][C16]，在跑和等着两队都会调 [C17][C18]：prefill 阶段、切完还没到最后一个整块时，把 `num_new_tokens` 向下取整到 `block_size` 的倍数；跨过最后一个整块边界时切在边界上；不足一块的尾巴不处理。开前缀缓存且 `mamba_cache_mode` 为 `none` 时，上游按 `supports_mamba_prefix_caching` 把它设成 `all` 或 `align` [C19]；这个例子最终落在哪种模式本页没有核。代入这个例子（块 2048）：37 个 token 不足一块，不受影响；4096 个 token 第 1 步给 2048，本来就是 2048 的倍数，结果也不变 [D]。
- 抢占：`_preempt_request` 释放该请求的 KV 块和 encoder 缓存、`num_computed_tokens = 0`、`prepend_request` 退回 `waiting` 队头 [C12]。被抢占的请求这一步若已拿过名额，名额要还回 `token_budget`——这条退款路径只在 `SchedulingPolicy.PRIORITY` 分支里 [C5]。
- 昇腾进程里跑的不是上游那个类：`vllm_ascend/patch/platform/__init__.py` 无条件 import `patch_balance_schedule` [C13]，末尾 `vllm.v1.core.sched.scheduler.Scheduler = BalanceScheduler` [C14]。

### 会报什么错

- 函数最后 `assert token_budget >= 0` [C7]——名额透支直接断言失败，正常路径上不会触发。
- 生成式模型上手动关掉 Chunked Prefill，会打一条 warning：`This model does not officially support disabling chunked prefill. Disabling this manually may cause the engine to crash or produce incorrect outputs.`
- 关掉 Chunked Prefill 后，等着的请求若还差的 token 数大于剩余名额，扫 `waiting` 的循环直接 `break`，不报错，只是这一步不排。
- 混合模型开前缀缓存、落到 `align` 模式时，若 Chunked Prefill 关着，启动断言失败：`Chunked prefill is required for mamba cache mode 'align'.`

### 开销和什么时候别开

- 先扫在跑、后扫等待的顺序保护了已开始生成的请求，代价是高负载时新请求排队更久 [D]。
- 关 Chunked Prefill 的代价：一条长于剩余名额的新请求会堵在等待队头，这一步后面的等待请求也被 `break` 挡住[D]。
- `long_prefill_token_threshold` 调小能让长问题少占名额、别的请求走得动，代价是长问题要多分几步才算完 [D]。

### 版本差异

- 上游 v0.26 配套检出（`vllm@releases-v0.26.0`）里，`schedule()` 开头同一段「no decoding phase nor prefill phase」注释仍在（`vllm/v1/core/sched/scheduler.py` 第 428 行），`_mamba_block_aligned_split` 移到第 355 行，`assert token_budget >= 0` 在第 1068 行；默认名额表的非大显存一档仍是 API server 2048（`vllm/engine/arg_utils.py` 第 2470–2479 行）；vllm-ascend v0.26.0rc 的 `get_device_total_memory` 仍是 `raise NotImplementedError`（`vllm_ascend/platform.py` 第 274–280 行），所以昇腾上名额仍是 2048。
- vllm-ascend v0.26.0rc 同样无条件 import `patch_balance_schedule`（`vllm_ascend/patch/platform/__init__.py` 第 50 行），替换写法变成 `_sched_mod.Scheduler = BalanceScheduler`（`patch_balance_schedule.py` 第 936 行）。
- main 配套的上游没有检出，main 侧本页未核。

### 源码位置

| 看什么 | 在哪 |
| --- | --- |
| 「没有阶段」的注释、名额初值 | `vllm/v1/core/sched/scheduler.py` `schedule()` 开头 |
| 在跑一队的减法 | 同文件，第一个 while |
| 等着一队的减法、Chunked Prefill 开关 | 同文件，第二个 while |
| mamba 按块对齐切分 | 同文件 `_mamba_block_aligned_split` |
| 抢占 | 同文件 `_preempt_request`，退款在 PRIORITY 分支 |
| 默认名额表 | `vllm/engine/arg_utils.py`；字段兜底 `vllm/config/scheduler.py` |
| Chunked Prefill 默认值 | `vllm/engine/arg_utils.py`、`vllm/config/model.py` |
| 混合模型的 mamba 缓存模式 | `vllm/model_executor/models/config.py` |
| 昇腾不报显存 | `vllm_ascend/platform.py` |
| 昇腾换掉调度器 | `vllm_ascend/patch/platform/__init__.py`、`patch_balance_schedule.py` |
