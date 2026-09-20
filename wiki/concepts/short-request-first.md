---
id: short-request-first
title: "ShortRequestFirst：把等待队列切成三条车道"
type: feature
summary: 把上游那条单一的 waiting 队列换成 immediate / short / long 三条，短 prompt 先被挑走，长 prompt 不再堵住别人的首 token。
aliases: [ShortRequestFirst, 短请求优先, 短请求优先调度, short_request_first_config, ShortRequestFirstRequestQueue, ShortRequestFirstAsyncScheduler, long_max_wait_ms, 三车道等待队列]
chapters: ["12"]
order: 30
sources:
  - vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L37-L47
  - vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L148-L153
  - vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L155-L182
  - vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L204-L235
  - vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L237-L244
  - vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L329-L335
  - vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L338-L367
  - vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L370-L384
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L939-L965
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L979-L994
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L652-L680
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L127-L135
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L931-L936
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L176-L185
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L665-L693
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L1232-L1234
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L1976-L1986
  - vllm@568afb3a:vllm/v1/core/sched/request_queue.py#L20-L46
  - vllm@568afb3a:vllm/v1/core/sched/request_queue.py#L201-L207
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L712-L725
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/short_request_first.md#L82-L91
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/short_request_first.md#L31-L49
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/short_request_first.md#L103-L107
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L952-L980
  - vllm-ascend@b255ab59:vllm_ascend/core/scheduler_profiling_chunk.py#L91-L103
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/short_request_first.md#L103-L107
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1330-L1349
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1440-L1446
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/short_request_first.html
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: vllm-scheduler
    kind: builds-on
    note: 它换掉的正是「扫 waiting 队列」那一段取请求的对象，那道减法和两条 while 在那一页
  - to: ascend-config-system
    kind: builds-on
    note: short_request_first_config 挂在 additional_config.scheduler_config 下面，键怎么解析成子配置对象在那一页
  - to: chunked-prefill
    kind: alternative-to
    note: 两者治同一个病的两段——它改排队顺序，chunked prefill 压单步 token 数，可以也应该同时开
  - to: prefill
    kind: builds-on
    note: 它优化的那个指标（首 token 延迟 TTFT）和 prefill 一步算多少 token 的定义在那一页
  - to: batch-job-aware-scheduler
    kind: conflicts-with
    note: 两个都是换掉 waiting 队列的调度特性，源码里显式互斥——同时开直接 ValueError，只能二选一
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

上游的 `Scheduler` 只有一条 waiting 队列，先到先得。ShortRequestFirst 把它换成**三条车道——immediate / short / long**，按 prompt 的 token 数分道，**短请求先被挑走**。`schedule()` 一行没改：换掉的只有 `scheduler.waiting` 这一个对象。

它在 **v0.23 维护分支上不存在**——那个快照的 `platform.py` 里只有 `SchedulerDynamicBatch` 和 `ProfilingChunkScheduler` 两处 `scheduler_cls`，全仓搜不到 `short_request` 这个词 [C20]。v0.26 分支（2026-09-17 源码快照）起才有，main 开发主线上队列本体是同一个 git blob，差异全在外围。

```wiki-diagram
file: short-request-first
```

## 那条请求用不到它

[那条请求](one-request.md)是队列里唯一的一条，三条车道有两条永远空着，谁先谁后这个问题根本不存在。要看到它起作用，至少得改两件事：**多发几条，并且让 prompt 长度拉开差距** [A]。

下面这组设定其余不动（单卡 Qwen3-0.6B、`block_size` 128、一步 2048 的 token 预算，这个数的来历见[调度器](vllm-scheduler.md)）：先到一条 5000 token 的长 prompt，紧接着到 8 条像那条请求一样的 37 token 短请求。

| | 不开（上游 FCFS） | 开了 ShortRequestFirst |
|---|---|---|
| 第 1 步给谁 | 长请求 `min(5000, 2048)` = 2048，预算清零 | 8 条短请求先走 8 × 37 = **296**，长请求拿剩下的 2048 − 296 = 1752 |
| 短请求的首 token | 第 3 步——前两步预算被吃光 | **第 1 步** |
| 长请求的首 token | 第 3 步 | 第 3 步：1752 + 2040 + 1208 = 5000 |

短请求的 TTFT 从 3 次 forward 降到 1 次，而长请求一步都没多花：5000 个 token 摊到三步本来就有富余 [D]。这不是普遍结论——预算刚好卡满时，短请求插的队就是长请求多等的步数。

## 它换掉的不是调度器，是 `scheduler.waiting` 那一个对象

上游 `Scheduler.__init__` 里一句 `self.waiting = create_request_queue(self.policy)`，而扫 waiting 那段循环全程只用 `peek_request()` 和 `pop_request()` 两个方法取请求。`RequestQueue` 只是个抽象基类，规定了入队、出队、看队头、插队头这几个方法——**这就是它能不碰 `schedule()` 一行的全部理由**：`ShortRequestFirstRequestQueue` 自己实现这份契约，肚子里装着三条用 `create_request_queue` 造出来的普通队列。

装上去有两条路，取决于开没开异步调度：

- **异步**：平台层把 `scheduler_cls` 指到 `ShortRequestFirstAsyncScheduler`，它是上游 `AsyncScheduler` 的子类，`__init__` 末尾把队列换掉 [C11]。这条就是邻居页里 `scheduler_cls` 那条路。
- **同步**：`scheduler_cls` 一个字都不写。`patch_balance_schedule.py` 在导入时做过 `_sched_mod.Scheduler = BalanceScheduler` [C13]，同步路径上构造出来的「上游 Scheduler」其实已经是它，它在 `__init__` 里读 `short_request_first_config` 并装队列 [C12]，**跟 `enable_balance_scheduling` 开没开无关**。

安装必须发生在收第一条请求之前：`install_short_request_first_waiting_queue` 看到 `scheduler.waiting` 非空就 `RuntimeError`，策略不是 FCFS 就 `ValueError` [C7]。

## 分车道只看一个数

`_classify_queue` 一共三行 [C2]：`immediate_predicate` 为真进 immediate，否则 `num_prompt_tokens <= threshold` 进 short，剩下进 long。**排序依据就是 prompt 的 token 数**——不看输出长度（还没生成，也不知道）、不看到达时间、不看优先级。

immediate 那条车道装的是「回来的」请求：`is_recovery_request` 判 `status == PREEMPTED`、或 `num_computed_tokens > 0`、或 `num_output_tokens > 0` [C6]。它接的是抢占——上游抢占一条请求时调 `self.waiting.prepend_request(request)`，换成三车道之后这次 prepend 会重新分类，把它放回 immediate。**算过一半的请求不会被新来的短请求反复压在下面**，否则抢占加上短请求优先就是一台抖动制造机 [D]。

一段可以直接抄的配置：

```bash
vllm serve Qwen/Qwen3-0.6B \
  --additional-config '{"scheduler_config": {"short_request_first_config": {"enabled": true, "threshold": 256, "long_max_wait_ms": 2000}}}'
```

三个值的来由：`enabled` 默认 `false`，不写就整套不启用；`threshold` 默认 `256`，官方文档建议先拿 prompt 长度的 P70–P85 起步，再照真实长度直方图往「短请求主簇和长尾之间那个谷」挪 [C9][S22]；`long_max_wait_ms` 默认 `0.0`，2000 是官方示例里的值，含义见下一节。这三个键挂在 `additional_config.scheduler_config` 下面，解析规则见 [AscendConfig 配置系统](ascend-config-system.md)——但有一点和那一页说的不一样：**这个子配置多写一个键会直接 `ValueError`，不是静默走默认** [C9]。

## 默认配置下长请求真的会饿死

`long_max_wait_ms` 那个默认的 `0.0` 不是随手填的——`_long_head_wait_ms` 的第一行就是 `if self.long_max_wait_ms <= 0 ... return None` [C3]。**所以开箱即用的它是严格短优先：只要 short 车道非空，long 车道一个都发不出去**，长请求等多久都没人管。

给了正数才有老化。`_select_schedulable_queue` 的顺序是 immediate → 队头等待超过 `long_max_wait_ms` **且 short 车道非空**的 long → short → long [C3]，官方文档写成 `immediate > aged-long > short > long` [S21]。注意第二档那个附加条件：short 空着的时候本来就轮到 long，不算插队，也不计数。

饿的另一头有一道提醒：连着 3 次让 long 插到等着的 short 前面，就打一条 `warning_once`，说这个特性正在退化成长请求优先，建议调大 `threshold` 或者关掉；只要有一次发的是 short，或这次 long 出队时 short 车道是空的，计数就清零 [C4]。**这是一条警告，不是一道闸**——代码不会自己改参数。

还有一处细节：`peek_request` 会把选中的车道**钉住**，下一次 `pop_request` 必定从同一条车道取 [C5]。上游的 waiting 循环正是先 peek 再决定要不要 pop，两次调用之间老化随时可能改变车道优先级，不钉住就会出现「看的是这条、拿走的是那条」。

## 它压的是排队，chunked prefill 压的是单步

两者治的是同一个病的两段，可以同时开，互相不知道对方存在 [D]：它决定**谁先被 waiting 循环挑中**，[chunked prefill](chunked-prefill.md) 决定**挑中之后这一步给多少 token**。上面那张表里长请求第 1 步只拿 1752，正是两者叠加的结果。

反过来，它压不住的那一半也很清楚：长请求一旦进了 `running`，上游每一步先扫 running 再扫 waiting [C15]，它后面几步照样先把预算吃掉大半——要给别人留位置得靠 `--long-prefill-token-threshold`，那是 chunked prefill 那页的活。

`enabled` 为真时逐条校验，不满足直接 `ValueError`、服务起不来 [C11]：策略必须是 `fcfs`；不能和 `batch_job_sched_config` 同开；不能和 `profiling_chunk_config` 同开；不能跑在 PD 分离的 D 节点上（`kv_role='kv_consumer'`）。还有一条它管不着：上游对 FCFS 的取队规则是 `self.skipped_waiting or self.waiting` [C17]，等远端 KV、等语法编译这类被挂起的请求排在另一条队里，优先级在三条车道之上。

## v0.26 分支与 main 的差异

`short_request_first_scheduler.py` 在两个快照上是同一个 git blob，队列逻辑一个字符没动；三个默认值也一样（`false` / `256` / `0.0`），main 只是把手写的 dict 校验换成了 pydantic dataclass。差异全在外围。

| 项 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 配 `profiling_chunk_config` | 直接 `ValueError` 互斥 [C11] | 允许，但只在同步调度下；`ProfilingChunkScheduler.__init__` 自己装队列 [C25] | 想同时用这两个，得升到 main 并且关掉异步调度 |
| 文档里的兼容说明 | 与代码一致 | 仍写着不支持 profiling-chunk scheduling [S26] | [!] main 上这句文档比代码旧，以代码为准 |
| 均衡调度的开关 | 文档与代码都还认 `VLLM_ASCEND_BALANCE_SCHEDULING` 环境变量 [C10] | 环境变量回退已删除，只认 `additional_config.scheduler_config.enable_balance_scheduling` [C28] | [!] 在 main 上照旧设环境变量，均衡调度不会打开——而这两个特性经常一起配 |

## 常见误解

- **「它是一个新的调度器」**——它实现的是 `RequestQueue`，不是 `Scheduler`。同步路径上连 `scheduler_cls` 都不设一个字。
- **「开了它长请求就一定不会饿死」**——默认 `long_max_wait_ms = 0` 就是严格短优先，长请求可以无限等；给正数才有老化提升，而提升次数超标也只是打一条警告。
- **「阈值取 prompt 长度的中位数最稳」**——官方文档明确反对取全体长度的中点，也反对贴着最长的那些请求；要找的是短请求簇和长尾之间那个谷 [S22]。
- **「短请求优先 = 短请求能插到正在生成的请求前面」**——它只重排 waiting 队列。上游每一步先扫 running 再扫 waiting，正在 decode 的请求不受影响。
