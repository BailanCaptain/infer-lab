---
id: balance-scheduling
title: "Balance Scheduling：一个 rank 顶满，所有 rank 一起停收"
type: feature
summary: MoE 模型的多 DP 部署里，每步 all_gather 各 DP rank 在跑的请求条数，只要有一个 rank 顶到 max_num_seqs，所有 rank 这一步都不再放新请求进来。dense 模型用不上——上游只为 MoE 构造 DP 引擎进程。
aliases: [Balance Scheduling, 均衡调度, 均衡调度器, BalanceScheduler, enable_balance_scheduling, VLLM_ASCEND_BALANCE_SCHEDULING, balance_gather, balance_queue, BalanceDPEngineCoreProc, patch_balance_schedule, DP 准入闸]
chapters: ["12"]
order: 60
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L319-L330
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L78-L86
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L88-L92
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L107-L111
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L642-L667
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L714-L721
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L744-L745
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L34-L46
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/__init__.py#L50-L50
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L78-L83
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L90-L94
  - vllm-ascend@2c59ff10:vllm_ascend/envs.py#L103-L105
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L677-L685
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L566-L571
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L104-L104
  - vllm@0fc695fc:vllm/config/scheduler.py#L63-L63
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1928-L1932
  - vllm-ascend@2ed6cbba:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L28-L43
  - vllm-ascend@2ed6cbba:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L79-L83
  - vllm-ascend@2ed6cbba:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L227-L239
  - vllm-ascend@2ed6cbba:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L378-L382
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L78-L101
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L946-L959
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L979-L985
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L115-L119
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1450-L1456
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_balance_schedule.py#L104-L104
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_balance_schedule.py#L894-L903
  - vllm-ascend@baa023ad:vllm_ascend/patch/platform/patch_engine_core.py#L32-L42
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L992-L994
  - vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L149-L149
  - vllm-ascend@baa023ad:docs/source/user_guide/configuration/additional_config.md#L19-L19
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/configuration/additional_config.html
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1153-L1156
  - vllm@0fc695fc:vllm/v1/engine/core.py#L1715-L1717
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_balance_schedule.py#L715-L721
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_balance_schedule.py#L938-L956
verified: ["releases/v0.23.0", "releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: vllm-scheduler
    kind: builds-on
    note: 它多插的那两行就落在那一页讲的「扫 waiting 那条 while」里，紧跟在「本 rank 满没满」那道检查后面
  - to: vllm-engine-core
    kind: builds-on
    note: 每步一次的 all_gather 挂在忙循环上而不在调度器里，那个循环一步做哪四件事写在那一页
  - to: ascend-patch-system
    kind: builds-on
    note: 它不设 scheduler_cls，靠 import 时改写模块里 Scheduler 这个名字生效，「import 即生效」的规矩在那一页
  - to: ascend-config-system
    kind: builds-on
    note: enable_balance_scheduling 从 additional_config 走到 AscendConfig 的解析路径、以及环境变量那条旁路，在那一页
  - to: data-parallel
    kind: builds-on
    note: 它 all_gather 的就是各 DP rank 在跑的请求数；DP rank 是什么、请求怎么落到某个 rank，在那一页
contradicts: []
updated: "2026-09-24"
origin: seed
---

## 一句话

多个 DP rank 跑同一份模型时，请求会堆在其中几个 rank 上：满载的那几个同时扛着 prefill 和 decode、变慢，空着的那几个继续收新请求，差距越拉越大。Balance Scheduling 给的不是搬运，而是**一道全局准入闸**——每步 `all_gather` 收齐各 rank 的 `len(self.running)`，**只要有任何一个 rank 顶到了 `max_num_seqs`，所有 rank 这一步都不再从 waiting 队列放人进来**，先让顶满的那个把手上的请求排空。

它**不是「让落后的 rank 追上领先的」**——设计文档把这个理解点名否掉了 [S21]。三个分支上都有它，v0.23 维护分支上就已经是现在这套语义；差别全在配置怎么写、以及引擎核心那一侧接得干不干净。

```wiki-diagram
file: balance-scheduling
```

## 那条请求用不到它，而且是彻底的空转

[那条请求](one-request.md)跑在单卡上，`data_parallel_size` 就是 1。这时候连闸门的输入都不存在：DP 为 1 时引擎核心构造的是上游原版的 `EngineCoreProc`，不是带 gather 钩子的那个 DP 子类 [C6]，`balance_gather` 一次都不会执行；`balance_queue` 里那唯一一格保持着构造时填进去的 `0` [C2]。而闸门的判断是 `max(balance_queue) == max_num_running_reqs`，后者就是 `max_num_seqs` [C15]、取值下限是 1 [C16]——`0 == 1` 永远不成立 [D]。**开着它和不开，在单卡上产出的 `SchedulerOutput` 一模一样。**

要看到它干活，光改多 DP 还不够——**模型还得是 MoE**：上游只在 `data_parallel_size > 1` 且模型是 MoE 时才构造带 gather 钩子的 DP 引擎进程，dense 模型的各 DP rank 完全独立、被当成 DP=1 对待 [C34]，`DPEngineCoreProc` 的构造函数里就有一条 `assert is_moe` [C35]。v0.23 的补丁自己抄的启动函数没做这层判断，对任何 DP>1 都建 `BalanceDPEngineCoreProc` [C36]——**dense 模型多 DP 加这个开关，启动时直接撞断言、起不来** `[!]`；v0.26 起补丁改成条件换名，把「要不要 DP 进程」交回上游判断 [C37]。下面这组数把模型换成 MoE 的，再只动两处：`--data-parallel-size 4`、`--max-num-seqs 8`（真实场景这两个数大得多，缩小只是为了能手算）[A]。此刻四个 rank 分别在跑 8 / 3 / 5 / 2 条：

| | 不开 | 开了均衡调度 |
|---|---|---|
| rank 0（8 / 8 顶满） | 自己那道 `len(running) == 8` 拦住，不收 | 同样不收 |
| rank 1 / 2 / 3 | 各有 5 / 3 / 6 个空位，照收不误 | `max(8,3,5,2) = 8 == 8`，**三个都不收** |
| 这一步全局在跑 | 18 条，还在往上涨 | 18 条，只降不升 |
| 代价 | 无 | 14 个空名额闲着 |

## 真正的改动是两行，抄下来的是五百多行

上游扫 waiting 那段循环长这样——先判本 rank 的 running 满没满，再取队列：

```python
while (self.waiting or self.skipped_waiting) and token_budget > 0:
    if len(self.running) == self.max_num_running_reqs:
        break
    request_queue = self._select_waiting_queue_for_scheduling()
    assert request_queue is not None
```

`BalanceScheduler.schedule()` 把闸门插在这两句之间，并把那句 `assert` 换成 `if request_queue is None: break`——闸门推迟准入之后，队列确实可能取不出来 [C1]。加上开头那句「没开就 `return super().schedule(...)`」，一共三处改动。

代价写在设计文档的表里：为了插这几行，`Scheduler.schedule()` 整整 520 行被逐字抄进补丁文件，`run_busy_loop` 和 `run_engine_core` 又各抄一份 [S19]。v0.23 那份补丁一共 745 行，绝大部分是上游原文。**这个特性真正的风险不在那两行逻辑上，在「抄件会和上游漂开」上**——设计文档自己就记着两份抄件已经过期。

## 它不设 `scheduler_cls`，它换掉 `Scheduler` 这个名字

补丁文件末尾一句 `vllm.v1.core.sched.scheduler.Scheduler = BalanceScheduler` [C7]，而 `vllm_ascend/patch/platform/__init__.py` 无条件 import 这个文件。**于是在昇腾上，凡是没设 `scheduler_cls` 的部署，构造出来的那个「上游 Scheduler」其实都是 `BalanceScheduler`**——开关只决定它走不走开头那条早退。设了 `scheduler_cls` 的（recompute、dynamic batch、profiling chunk）走自己的类，绕开这个名字。

[ShortRequestFirst](short-request-first.md) 说的「同步路径上那个上游 Scheduler 其实已经是它」，指的就是这里。这条装法的规矩本身在 [patch 系统](ascend-patch-system.md)那一页。

## 把 `all_gather` 放进 `schedule()` 会死锁

`balance_gather` 不在 `schedule()` 里，它挂在引擎核心的忙循环上，紧跟在那次跨 rank 的 all-reduce 后面 [C5]。理由是集合通信：DP MoE 下本地请求排空的 rank 会去跑 `execute_dummy_batch()`、**根本不进 `schedule()`**，而还忙着的 rank 进去就调 `all_gather`——参与方对不上，直接挂死 [S20]。

顺带一个容易记反的细节：那次 all-reduce 本身有优化，`step_counter % 32 != 0` 时直接返回 `True`，真正的跨 rank 同步每 32 步才做一次 [C17]。但 `_has_global_unfinished_reqs` 这个**函数**每个非空转迭代都会被调用一次，所以挂在它尾巴上的 gather 仍然是一步一次 [D]。

## 开它的写法，以及它和谁不能同开

v0.23 维护分支上的一段完整配置：

```bash
vllm serve Qwen/Qwen3-30B-A3B \
  --data-parallel-size 4 \
  --max-num-seqs 8 \
  --additional-config '{"enable_balance_scheduling": true}'
```

四个值的来由：模型必须是 MoE（Qwen3-30B-A3B 是；换成 dense 的 Qwen3-0.6B，这条命令在 v0.23 上会撞断言起不来，见上）；`enable_balance_scheduling` 默认 `false`，不写就整套不启用 [C10]；`--data-parallel-size` 必须大于 1，等于 1 就是上一节那种彻底空转；`--max-num-seqs` 直接就是闸门那个上限，**调它等于同时动两件事**——单 rank 的并发，和全局冻结的触发点。这些键怎么从 `additional_config` 走到 `AscendConfig`，见[配置系统](ascend-config-system.md)。

三道硬约束，不满足就是启动失败：和 `profiling_chunk_config` 同开直接 `ValueError` [C11]；只支持 PD 混部，配了 `kv_transfer_config` 而 `kv_role` 不是 `kv_both` 也 `ValueError`；main 开发主线上还多一条，和 DyntraLB 同开同样 `ValueError`。

## 三个分支上，开关和装法都不一样

闸门语义（用 `==` 不是 `>=`、比的是上一步结束时的快照）三版一致，差异全在外围：

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 配置键写在哪 | 只认顶层 `enable_balance_scheduling` | 顶层或 `scheduler_config` 下，后者优先，写顶层会打 deprecation 警告 [C24] | 同 v0.26 | 旧的顶层写法三版都还开得起来，只是新版会提醒你挪窝 |
| `VLLM_ASCEND_BALANCE_SCHEDULING` | 认，`envs.py` 里有这个名字 | 认 | **不认**，`envs.py` 里已经没有它，配置代码的注释写明「legacy environment fallback has been removed」[C26] | [!] 靠环境变量开它的部署升到 main 会**静默失效**：服务照起，闸门不装 |
| 引擎核心那一侧 | 整段抄 `run_busy_loop` 和 `run_engine_core` | 只覆盖 `_has_global_unfinished_reqs`，模块名按开关替换 | 同 v0.26，那次替换搬进了 `patch_engine_core.py` | v0.23 的两份抄件会随上游演进过期；新版只剩一个钩子要盯 |
| `BalanceScheduler` 的父类 | 上游 `Scheduler` | `KVDeliveryScheduler`，另一份 ascend 抄件 [C22] | 上游 `Scheduler` | [!] 只有 v0.26 上「关掉就等于纯上游」不成立，中间还隔着一层抄件 |
| 和 DyntraLB 互斥 | 无此特性 | 无此特性 | 同开直接 `ValueError` [C30] | main 上 decode 侧那条负载均衡是另一条路，二选一 |

main 自己的文档还没对齐：配置页正文写着这个环境变量「no longer supported」[S31]，同一个文件顶上的速查表却仍列着 `VLLM_ASCEND_BALANCE_SCHEDULING → scheduler_config.enable_balance_scheduling` 这一行。以代码为准 [!]。

## 常见误解

- **「均衡调度会把请求从忙的 rank 挪到闲的 rank 上」**——一条请求都不搬。它只做「全体停收」这一个动作，「让落后的 rank 追上领先的」这个语义被设计文档明确拒绝过。决定请求落在哪个 rank 上的是前端路由，不是它。
- **「不开它就等于没装」**——不等于。补丁 import 时无条件把 `Scheduler` 这个名字换成了 `BalanceScheduler`，关掉只是让 `schedule()` 第一行把活交还给 `super()` [C4]。
- **「阈值是 `>=`，所以超过一点也算」**——是 `==`，比的还是配置里的 `max_num_seqs`。设计文档特意说明选 `==` 是为了把「顶满才冻结」钉死，不给「追上领先者」留解释空间。
- **「设 `VLLM_ASCEND_BALANCE_SCHEDULING=1` 就能开」**——v0.23 和 v0.26 上可以，main 上不行；而且这条路从引入起就在 `envs.py` 里标着 deprecated。
