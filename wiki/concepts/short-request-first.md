---
id: short-request-first
title: "短请求优先：短问题先算，别让长问题堵住别人"
type: feature
summary: 排队等着被算的请求原本只有一条队，先到先得。打开它之后，队伍按问题长短分成三条车道，短问题先被挑走，一条长问题不再让后面一串短问题一起干等。
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
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L954-L982
  - vllm-ascend@baa023ad:vllm_ascend/core/scheduler_profiling_chunk.py#L91-L103
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/short_request_first.md#L103-L107
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1340-L1359
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1450-L1456
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/short_request_first.html
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L376-L423
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L897-L905
  - vllm@0fc695fc:vllm/model_executor/models/config.py#L350-L365
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L49-L71
  - vllm-ascend@2ed6cbba:vllm_ascend/core/short_request_first_scheduler.py#L246-L255
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
updated: "2026-09-25"
origin: seed
---

## 两条长问题先到，八条短问题只能干等吗

[那条请求](one-request.md)是服务里唯一的一条：问题 37 个 token，第一步就算完。现实里不会只有它一条。假设同一台服务上，先到了两条很长的问题，每条 1024 个 token；紧接着又到了 8 条像那条请求一样的短问题，每条 37 个 token。

[调度器](vllm-scheduler.md)每一步有 2048 个名额（一步最多算 2048 个 token）。默认的做法是**先到先得**：还没开算的请求排成一条队，谁先来谁先被挑。两条长问题正好把第 1 步的 2048 个名额吃光，8 条短问题一个 token 都没算，只能等下一步。它们加起来才 296 个 token，却要陪着两条长问题等。

短请求优先要改的就是这件事：把那一条队换成**三条车道**，按问题长短分道，**短问题先被挑走**。调度器挑人的规则一个字没改，改的只是「从哪条队里拿下一个」。这个特性只在 v0.26 起的版本里有，v0.23 上没有。

```wiki-diagram
file: short-request-first
```

## 开和不开，差在哪一步

还是上面那组请求：Qwen3.6-35B-A3B、两颗昇腾 NPU、一步 2048 个名额。「首 token」指这条请求的回答吐出第一个 token 的那一步，越早，用户越早看到字。

| | 不开（先到先得） | 开了（短请求优先） |
|---|---|---|
| 第 1 步给谁 | 长 A 1024 + 长 B 1024 = 2048，名额用光 | 8 条短问题 8 × 37 = **296**，长 A 1024，长 B 只拿到剩下的 728 |
| 第 2 步给谁 | 长 A、长 B 各吐 1 个 token，8 条短问题一起算 296 | 8 条短问题、长 A 各吐 1 个 token，长 B 补上剩下的 296 |
| 8 条短问题的首 token | 第 2 步 | **第 1 步** |
| 长 A 的首 token | 第 1 步 | 第 1 步 |
| 长 B 的首 token | 第 1 步 | 第 2 步 |

开了之后，8 条短问题每条早一步看到字，代价是长 B 晚了一步。**短问题插的队，就是长问题多等的那几步**——这笔账不总是这么划算：短问题少、长问题多的时候，换来的就少。

长 B 这一步只算 728 个、下一步接着算，靠的是 [Chunked Prefill（分块预填充）](chunked-prefill.md)：问题太长就切成几段，分几步算完。它默认开着。

## 三条车道各装什么

分车道只看一个数：**这条请求的问题有多少个 token**。不超过一个门槛（默认 256）进「短」车道，超过的进「长」车道。它不看回答会有多长（还没生成，也不知道），不看谁先到，也不看谁更重要。上面的例子里，37 进短车道，1024 进长车道。

第三条车道装的是「回来的」请求。显存紧张时，调度器会把一条已经在算的请求先赶出去，腾地方给别人，这叫抢占；被赶出去的请求要重新排队。它算过一半，不该再和新来的请求一起重新排——否则每来一批短问题它就被压到下面一次，抢占加上短请求优先会反复折腾同一条请求。所以只要一条请求被抢占过、或者已经算过一部分，它就进这条车道，而且这条车道**永远排在最前面**。

所以取人的顺序是：回来的 → 短的 → 长的。

## 默认配置下，长问题可能一直等

开箱即用时，它是**严格短优先**：只要短车道里还有人，长车道一个都挑不出去。短问题源源不断地来，长问题就一直等，等多久都没人管。

要防止这种情况得自己设一个等待上限，单位是毫秒。设了之后，长车道队头那条等够了这么久，就可以插到短车道前面。顺序变成：回来的 → 等够了的长的 → 短的 → 长的。注意「插队」只在短车道里真有人时才算；短车道空着时本来就轮到长的。

插队太频繁它会提醒一句：连着 3 次让长的插到短的前面，日志里打一条警告，说这个特性正在退化成「长请求优先」，建议调大门槛或者干脆关掉。**这只是一条警告**，它不会自己改设置。

还有一个细节保证它不出错：调度器挑人时是先看一眼队头、决定收下，再真正拿走。这两下之间，「等够了」的判断可能正好翻过去，车道的先后就变了。所以它会记住刚才看的是哪条车道，拿的时候必须从同一条车道拿，不会出现「看的是这条、拿走的是那条」。

## 它只管排队，不管一步切多少

短请求优先决定的是**谁先被挑中**；[Chunked Prefill](chunked-prefill.md) 决定的是**挑中之后这一步给它多少个 token**。两者治的是同一个病的两段，可以同时开，互相不知道对方存在。上面那张表里长 B 第 1 步只拿到 728，正是两者叠在一起的结果。

它压不住的那一半也很清楚：调度器每一步先照顾已经在算的请求，再从等着的队里挑。一条长问题一旦开算，后面几步它照样先把名额拿走一大块；短请求优先只管还在等的那些。要限制一条请求一步最多拿多少，得靠 Chunked Prefill 那一页的单条上限。

还有一类请求它也管不着：等别的机器把 KV Cache（存起来的 K 和 V，下一步直接读、不重算）传过来的、等输出格式规则准备好的，这些被挂起的请求另排一条队，优先级比三条车道都高。

## 常见误解

- **「它是一个新的调度器」**——它换的只是那条排队的队，调度器挑人、分名额的规则一行没改。
- **「开了它，长问题就不会被饿着」**——默认没有等待上限，就是严格短优先，长问题可以一直等；设了上限才会让它插队，插得太频繁也只打一条警告。
- **「门槛取问题长度的中位数最稳」**——官方文档明确反对取全体长度的中点，也反对贴着最长的那些请求；要找的是「短问题扎堆的那一簇」和「长尾」之间的那个空档。
- **「短请求优先 = 短问题能插到正在吐字的请求前面」**——它只重排还在等的请求。每一步先照顾已经在算的，正在一个个吐 token 的请求不受影响。

## 对照源码

### 怎么开

一段可以直接抄的配置（在[那条请求](one-request.md)的启动命令上加一项）：

```bash
vllm serve Qwen/Qwen3.6-35B-A3B \
    --tensor-parallel-size 2 \
    --enable-expert-parallel \
    --enable-prefix-caching \
    --additional-config '{"scheduler_config": {"short_request_first_config": {"enabled": true, "threshold": 256, "long_max_wait_ms": 2000}}}'
```

- 三个键与默认值：`enabled` 默认 `false`，不写就整套不启用；`threshold` 默认 `256`；`long_max_wait_ms` 默认 `0.0` [C9]。官方文档建议 `threshold` 先拿问题长度的 P70–P85 起步，再照真实长度直方图往「短请求主簇和长尾之间那个谷」挪 [S22]；2000 是官方示例里的值。这三个键挂在 `additional_config.scheduler_config` 下面 [C10]，解析规则见 [AscendConfig 配置系统](ascend-config-system.md)。
- **它换掉的只有 `scheduler.waiting` 这一个对象。** 上游 `Scheduler.__init__` 里是 `self.waiting = create_request_queue(self.policy)` [C14][C19]，扫 waiting 的那段循环只用 `peek_request()` 和 `pop_request()` 取请求 [C15]。`RequestQueue` 是个抽象基类，规定了入队、出队、看队头、插队头这几个方法 [C18]——这就是它不碰 `schedule()` 一行的全部理由：`ShortRequestFirstRequestQueue` 自己实现这份契约，里面装着三条用 `create_request_queue` 造出来的普通队列 [C1][C34]。
- 装上去有两条路，取决于开没开[异步调度](async-scheduling.md)：
  - **异步**：平台层把 `scheduler_cls` 指到 `ShortRequestFirstAsyncScheduler` [C11]，它是上游 `AsyncScheduler` 的子类，`__init__` 末尾把队列换掉 [C8]。
  - **同步**：`scheduler_cls` 一个字都不写。`patch_balance_schedule.py` 在导入时做过 `_sched_mod.Scheduler = BalanceScheduler` [C13]，同步路径上构造出来的「上游 Scheduler」其实已经是它，它在 `__init__` 里读 `short_request_first_config` 并装队列 [C12]，**跟 `enable_balance_scheduling` 开没开无关**（见[均衡调度](balance-scheduling.md)）。
- 分车道：`_classify_queue` 三行——`immediate_predicate` 为真进 immediate，否则 `num_prompt_tokens <= threshold` 进 short，剩下进 long [C2]。上半的「回来的 / 短的 / 长的」就是 immediate / short / long。
- immediate 的判定 `is_recovery_request`：`status == PREEMPTED`、或 `num_computed_tokens > 0`、或 `num_output_tokens > 0` [C6]。上游抢占一条请求时调 `self.waiting.prepend_request(request)` [C16]，换成三车道之后这次 prepend 会重新分类，把它放回 immediate [C35]。「不这样就会反复压同一条请求」是推导 [D]。
- 取队顺序：`_select_schedulable_queue` 是 immediate → 队头等待 `>= long_max_wait_ms` **且 short 车道非空**的 long → short → long [C3]，官方文档写成 `immediate > aged-long > short > long` [S21]。`_long_head_wait_ms` 第一行 `if self.long_max_wait_ms <= 0 ... return None`，所以默认的 `0.0` 就是永不老化、严格短优先。
- 退化提醒：`AGED_LONG_WARNING_STREAK = 3`；long 出队时已老化且 short 非空才计一次，连续到 3 就 `warning_once`；发一次 short，或 long 出队时 short 车道为空，计数清零 [C4]。
- 钉住车道：`peek_request` 记下 `_pinned_queue`，下一次 `pop_request` 优先从钉住的车道取 [C5]。
- 上半那张表的推导 [D]：一步名额 2048 的来历见[调度器](vllm-scheduler.md)；`threshold` 256 下 37 进 short、1024 进 long。不开时：第 1 步 `min(1024, 2048) + min(1024, 1024) = 2048`，预算清零；第 2 步先扫 running（A、B 各 1），再扫 waiting 8 × 37 = 296。开了时：第 1 步先挑空 short 车道 296，再 long A `min(1024, 1752) = 1024`，long B `min(1024, 728) = 728`；第 2 步 running 里 8 条短 + A 各 1，B `1024 − 728 = 296`。例子的模型与部署同[那条请求](one-request.md)（模型形状见 [S33]）。
- 这组数刻意让每条问题都**短于一个 KV 块（2048）**：这个模型开前缀缓存时，上游把 `mamba_cache_mode` 设为 `align`（本模型不声明 `SupportsMambaPrefixCaching`）[C32]，调度器会对 prefill 做按块对齐的切分 [C30]。问题不足一块时 `last_cache_position = 0`，不做对齐，所以上面的 728 / 296 不受影响 [D]；超过一块的见下面「开销」。

### 会报什么错

- `enabled` 为真时平台层逐条校验，不满足直接 `ValueError`、服务起不来：`scheduler_config.policy` 必须是 `fcfs`；不能和 `batch_job_sched_config` 同开（见 [Batch-Job-Aware Scheduler](batch-job-aware-scheduler.md)）；不能和 `profiling_chunk_config` 同开（main 上有变化，见版本差异）；不能跑在 [PD 分离](pd-disaggregation.md)的 D 节点上（`kv_role='kv_consumer'`）。
- **这个子配置多写一个键会直接 `ValueError: Unknown short_request_first_config keys`，不是静默走默认**——和 [AscendConfig 配置系统](ascend-config-system.md)里说的一般规则不一样；`threshold < 0` 或 `long_max_wait_ms < 0` 也是 `ValueError`。main 上改成 pydantic dataclass，多写的键由 `extra="forbid"` 拒绝，两条范围检查挪进 `model_validator`，报错文字不同但同样起不来 [C27]。
- 安装时机：`install_short_request_first_waiting_queue` 看到 `scheduler.waiting` 非空就 `RuntimeError`（必须在收第一条请求之前装），策略不是 FCFS 就 `ValueError` [C7]。
- 退化时的那条 `warning_once` 是提醒，不是报错；代码不会自己改参数。

### 开销和什么时候别开

- **插队是有代价的。** 上半的例子里 8 条短请求各早一步，长 B 晚一步 [D]。预算刚好卡满时，短请求插的队就是长请求多等的步数；短请求少、长请求多的负载上收益有限。
- **默认 `long_max_wait_ms = 0` 下长请求会饿死。** 负载里短请求持续不断时，务必给一个正数。
- **它压不住已经在跑的长请求。** 上游每一步先扫 running 再扫 waiting，长请求一旦进了 `running`，后面几步照样先吃掉大半预算；要给别人留位置得靠 `--long-prefill-token-threshold`，见 [Chunked Prefill](chunked-prefill.md)。
- **被挂起的请求排在三条车道之上。** 上游对 FCFS 的取队规则是 `self.skipped_waiting or self.waiting` [C17]：等远端 KV、等语法编译这类被挂起的请求排在另一条队里，优先级高于它的三条车道。
- **本模型上，超过一块的长问题只能在整块名额空出来的那一步开算** [D]。`align` 模式下，prefill 的切块终点没到 `last_cache_position` 时要向下取整到 `block_size` 的倍数，可能得到 0；等待队列扫到一条得 0 的请求就 `break`，这一步不再往下挑[C31]。本模型块大小是 2048，与一步名额相同：一条问题超过 2048 的长请求，只要这一步已有别的请求占掉哪怕 1 个名额，它就拿到 0。这条限制来自上游对混合模型的对齐切分，开不开短请求优先都存在；但短请求优先会让同一步里先塞进短请求，长请求更常碰上它。

### 版本差异

- **v0.23 维护分支上不存在。** 那个快照的 `platform.py` 里只有 `SchedulerDynamicBatch` 和 `ProfilingChunkScheduler` 两处 `scheduler_cls`，全仓搜不到 `short_request` 这个词 [C20]。v0.26 分支（2026-09-17 源码快照）起才有。
- `short_request_first_scheduler.py` 在 v0.26 分支与 main 上是同一个 git blob，队列逻辑一个字符没动；三个默认值也一样（`false` / `256` / `0.0`），main 只是把手写的 dict 校验换成了 pydantic dataclass。差异全在外围：

| 项 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 配 `profiling_chunk_config` | 直接 `ValueError` 互斥 | 允许，但只在同步调度下，异步时 `ValueError`；`ProfilingChunkScheduler.__init__` 自己装队列 | 想同时用这两个，得升到 main 并且关掉异步调度 |
| 文档里的兼容说明 | 与代码一致 [S23] | 仍写着不支持 profiling-chunk scheduling [S26] | [!] main 上这句文档比代码旧，以代码为准 |
| 均衡调度的开关 | 文档与代码都还认 `VLLM_ASCEND_BALANCE_SCHEDULING` 环境变量 | 环境变量回退已删除，只认 `additional_config.scheduler_config.enable_balance_scheduling` [C28] | [!] 在 main 上照旧设环境变量，均衡调度不会打开——而这两个特性经常一起配 |

- 上面「超过一块的长问题」那条按 v0.26 配套上游（568afb3a）核的；main 配套的上游没有检出，未核。

### 源码位置

| 看什么 | 去哪里 |
|---|---|
| 三车道队列、分类、老化、钉住车道、安装函数、异步子类 | `vllm_ascend/core/short_request_first_scheduler.py`– |
| 三个配置键与校验 | `vllm_ascend/ascend_config.py`，`ShortRequestFirstConfig`；main 上见 |
| 启用时的互斥校验、异步路径换 `scheduler_cls` | `vllm_ascend/platform.py`；main 上见 |
| 同步路径的安装点 | `vllm_ascend/patch/platform/patch_balance_schedule.py` |
| 被换掉的 waiting 队列与取队契约 | 上游 `vllm/v1/core/sched/scheduler.py`、`request_queue.py`– |
| 混合模型的按块对齐切分 | 上游 `vllm/v1/core/sched/scheduler.py`，`_mamba_block_aligned_split`；模式怎么定见 `vllm/model_executor/models/config.py` |
| 官方特性文档 | `docs/source/user_guide/feature_guide/short_request_first.md` [S21][S22][S23]，线上版 [S29] |
