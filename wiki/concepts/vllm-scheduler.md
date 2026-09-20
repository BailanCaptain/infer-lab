---
id: vllm-scheduler
title: 调度器：没有 prefill 和 decode 之分
type: concept
summary: 调度器只做一道减法——每条请求还差多少 token 没算——再拿 token 预算去填。prefill 和 decode 是这道减法的两个结果，不是两条代码路径。
aliases: [调度器, Scheduler, schedule, token 预算, max_num_batched_tokens, 调度一步]
chapters: ["12"]
order: 10
sources:
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L351
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L358-L362
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L376-L380
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L403-L416
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L479-L487
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L564-L570
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L870-L876
  - vllm@0fc695fc:vllm/config/scheduler.py#L42-L90
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2300-L2335
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L273-L281
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L679-L700
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995
verified: ["releases/v0.23.0"]
evidence: "C"
relations:
  - to: vllm-engine-core
    kind: builds-on
    note: 这段代码是循环体的第一句，谁在什么时候调它写在那一页
  - to: prefill
    kind: builds-on
    note: 先知道人们说的 prefill 和 decode 各指什么，才看得懂「调度器里没有这两个阶段」这句话在否定什么
contradicts: []
updated: "2026-09-20"
origin: seed
---

## 一句话

调度器没有「阶段」这个概念。它只对每条请求做一道减法——**还差多少 token 没算**——然后拿这一步的 token 预算去填，能填多少填多少。

上游把这句话写在了 `schedule()` 的开头注释里：调度器里既没有 decoding phase 也没有 prefill phase，每条请求只有 `num_computed_tokens` 和 `num_tokens_with_spec` 两个数，每一步都在让前者追上后者 [C1]。

```wiki-diagram
file: token-budget
```

## 那条请求走到这里

[那条请求](one-request.md)的 prompt 是 37 个 token。

**第 1 步**：`num_tokens_with_spec = 37`，`num_computed_tokens = 0`，减法得 37。预算 2048 够，取 `min(37, 2048) = 37` [C11]。于是这一步给它 37 个名额 [D]。

**第 2 步**：上一步算完后 `num_computed_tokens` 变成 37，而采样又产出 1 个 token，`num_tokens_with_spec` 变成 38。减法得 1。取 `min(1, 2048) = 1`。

**这两步做的是同一道减法**——第 1 步在 `schedule()` 扫 waiting 队列那条分支上做，第 2 步在扫 running 那条上做，两段代码一模一样：还差多少，再 `min` 上剩下的预算。人管第一步叫 prefill、第二步叫 decode，但代码里它们的区别只是那道减法的结果不同：一次得 37，一次得 1。

**预算条上看更直观**：2048 的预算，第 1 步用掉 37（图上那一小截），第 2 步用掉 1，细到画不出来 [D]。一条请求填不满预算条——**这就是批处理存在的理由**，把别的请求塞进同一条预算里，一次 forward 摊掉一次权重读取。

## 预算条有多长

`max_num_batched_tokens` 的默认值是 2048 [C8]，但真正生效的值由启动时的一张表决定：**单卡显存 ≥ 70 GiB 且不是 A100** 时，`LLM` 类走 16384、API server 走 8192；否则分别是 8192 和 2048 [C9]。**在昇腾上它永远走后一档，而且跟卡上有多少显存无关**：`NPUPlatform.get_device_total_memory` 直接抛 `NotImplementedError`，上游那段查询包在 `try` 里，异常被吞掉之后把显存当成 0 [C10]。所以那条请求（按 API server 这一档算）面对的预算条就是 2048 [D]，理由在 [NPUPlatform](npu-platform.md)。

值得注意的是这张表怎么查出显存的：它调 `current_platform.get_device_total_memory()` 和 `get_device_name()` [C9]。**也就是说，硬件插件间接决定了调度器的默认预算**——这是上游那 88 个平台口子影响面的一个具体例子，见 [Platform：上游留给硬件的口子](vllm-platform-interface.md)。

## 两条队列，先照顾在跑的

`schedule()` 的主体是两个 while：先扫 `running`，再扫 `waiting` [C3][C6]，两个都以 `token_budget > 0` 为条件。

**顺序不是随手定的**：先给已经在跑的请求续上，剩下的预算才拿去接新请求。这条规则的直接后果是——**已经开始生成的请求不会因为新请求涌入而卡住**，代价是高负载时新请求要排更久 [D]。

预算不够时会发生抢占：被抢占的请求 KV block 全部释放、`num_computed_tokens` 归零、退回 waiting 队列，下次从头算 [C12]；它这一步要是已经拿到过 token 名额，名额还得吐回预算——这条退款路径只有优先级策略才走得到 [C5]。函数最后 `assert token_budget >= 0` [C7]——预算是硬约束，不允许透支。

## 长 prompt 会被切开

如果那条请求的 prompt 不是 37 而是 4096，减法得 4096，`min(4096, 2048)` 只给 2048 [C11]。剩下的 2048 留到下一步——**这就是 chunked prefill：默认开着，开着的时候切不切就是这行 `min` 的自然结果**。它仍然是个开关：`enable_chunked_prefill` 关掉之后，预算装不下的请求这一步是直接不排，而不是被切开 [C11][!]。

还有一道额外的闸：`long_prefill_token_threshold` 大于 0 时，单条请求一步最多给这么多 token [C4]。它的用途是防止一条超长 prompt 把整条预算吃光、让别的请求一步都走不了。

那条请求的 37 个 token 之所以「一步算完」，纯粹因为 37 比 2048 小。它没有走什么特殊路径。

## 常见误解

- **「prefill 和 decode 是两条代码路径」**——不是。上游在 `schedule()` 的注释里明确否掉了这个说法 [C1]；它们是同一道减法的两个结果。
- **「chunked prefill 要手动开」**——不用，`enable_chunked_prefill` 默认就是 `True` [C8]；要当心的是反过来：手动关掉它，长 prompt 不是被切开，而是排不进这一步。
- **「`max_num_batched_tokens` 是最大并发请求数」**——它数的是 token，不是请求。数请求的是 `max_num_seqs` [C8]。
- **「调度器决定用哪个算子」**——不决定。它产出的 `SchedulerOutput` 里只有 id、整数和采样参数；选算子在进程的另一边。
