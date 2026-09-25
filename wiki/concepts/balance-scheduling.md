---
id: balance-scheduling
title: "Balance Scheduling：一个 rank 顶满，所有 rank 一起停收"
type: feature
summary: 同一个 MoE 模型复制成好几份一起跑时，每一步各份先互报自己在跑几条请求；只要有一份顶到上限，所有份这一步都不再放新请求进来，先让顶满的那份把手上的活排空。dense 模型用不上。
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
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm@0fc695fc:vllm/config/model.py#L1872-L1873
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
  - to: moe
    kind: builds-on
    note: 只有 MoE 模型的多 DP 部署才会走到它；dense 模型各 DP 副本互不通信，它的输入根本不存在
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 四份副本里有一份满了，另外三份还收不收新请求

把[那条请求](one-request.md)用的部署——Qwen3.6-35B-A3B 跑在两颗 NPU 上——整套复制成 4 份，请求由前端分给这 4 份，这就是[数据并行（DP）](data-parallel.md)。每一份叫一个 DP rank，各有自己的调度器，各自决定这一步放哪些请求进来。

问题出在分得不匀：请求会堆在其中一两份上。堆满的那份每一步既要给新请求算问题、又要给老请求吐 token，越来越慢；空着的那几份照样收新请求、跑得飞快。可是这个模型是 MoE，4 份在每一步里都要一起做集合通信，快的要在通信点上等慢的——整体速度被最慢那份拖住，差距还在拉大。

Balance Scheduling 给的办法不是把请求从忙的那份搬到闲的那份，而是**一道全体一起落下的闸**：每一步先让 4 份互报自己手上在跑几条请求；**只要有任何一份顶到了上限，4 份这一步都不再放新请求进来**，先让顶满的那份把手上的请求排空。

```wiki-diagram
file: balance-scheduling
```

它**不是「让落后的那份追上领先的那份」**，设计这个特性的人专门把这种理解否掉了。v0.23、v0.26 和 main 三条分支上都有它，闸门本身的规矩一样，差别在开关怎么写、以及外围怎么装。

## 手算一遍：上限 8，四份分别在跑 8 / 3 / 5 / 2 条

真实部署里每份的上限要大得多，这里把上限缩成 8 只是为了能手算。此刻 4 份手上分别在跑 8、3、5、2 条请求：

| | 不开 | 开了均衡调度 |
|---|---|---|
| rank 0（8 / 8 顶满） | 自己满了，本来就不收 | 同样不收 |
| rank 1 / 2 / 3 | 各有 5 / 3 / 6 个空位，照收不误 | 互报之后最大的数是 8，等于上限，**三个都不收** |
| 这一步 4 份合起来在跑 | 18 条，还在往上涨 | 18 条，只降不升 |
| 代价 | 无 | 14 个空位这一步闲着 |

注意闸门的判断是「最大的那个数**正好等于**上限」，不是「超过某个比例」。只有真顶满才落闸，差一条都不落。

## 单份部署时它什么都不做

那条请求原本的部署只有一份，没有别的副本可以互报。这时候闸门的输入根本不存在：互报那一步不会执行，闸门看到的「最大在跑数」一直是初始值 0，而上限至少是 1，永远够不着。**单份部署开着它和不开，每一步放进来的请求一模一样。**

## 还得是 MoE 模型

光复制成多份还不够，**模型还必须是 [MoE](moe.md)**。原因在于：dense 模型的各份副本之间完全不通信，vLLM 就把它们当成各自独立的单份部署来建进程，互报那一步根本挂不上去；只有 MoE 模型的多份副本才会建「每步要一起通信」的那种进程，均衡调度正是挂在这种进程上的。

Qwen3.6-35B-A3B 有 256 个专家，是 MoE，正好满足。换成一个 dense 模型再开这个开关，在 v0.23 上甚至**起不来**：v0.23 的补丁没做「是不是 MoE」这层判断，对任何多份部署都去建 MoE 专用的那种进程，而那种进程一建就检查模型是不是 MoE，dense 模型直接在启动时报错退出。v0.26 起改掉了这一点，具体见下半「会报什么错」。

## 它只在「收不收新请求」那道判断旁边加了一道

调度器每一步给这一批挑请求时，会一条条从排队的请求里往外取，取之前先问一句「我自己在跑的是不是已经满了」，满了就停。均衡调度在这句后面再加一句「4 份里最满的那份是不是已经满了」，满了也停。它读的是上一步结束时互报来的数，不是此刻的实时数。

就这一句判断，逻辑上只有两行。代价在别处：为了把这两行插进去，调度器那段挑请求的函数被整段抄进了昇腾的补丁里，引擎那一侧也抄了两段。抄件越多，上游一改就越容易对不上——**这个特性真正的风险不在那两行逻辑上，在抄件和上游漂开上**。

## 装上它的方式：换掉调度器本身

昇腾插件一加载就把上游的调度器整个换成了均衡调度那个版本，不管开关开没开。开关只决定这个版本一上来是直接把活交还给上游原版，还是走带闸门的那条路。所以在昇腾上，凡是没有另外指定调度器的部署，用的其实都是它；指定了别的调度器的部署（重算、动态批、分块性能采集那几种）走自己的那一个，绕开了它。

[ShortRequestFirst](short-request-first.md) 里说的「同步路径上那个上游调度器其实已经是它」，指的就是这件事。这种「一加载就生效」的装法本身，在 [patch 系统](ascend-patch-system.md)那一页。

## 为什么互报不放在调度器里

直觉上，互报应该放在调度器挑请求之前做。但这样会卡死：MoE 多份部署里，手上已经没有请求的那份这一步**根本不进调度器**，只陪着别人跑一遍空的一批；还忙着的那几份一进调度器就发起互报，等一个永远不来的参与者，整个服务挂住。

所以互报挂在引擎每一步都会经过的另一个地方：紧跟在各份「还有没有人没跑完」那次同步之后。不管有没有活，每一份每一步都会走到那里，参与方永远对得上。

## 常见误解

- **「均衡调度会把请求从忙的那份挪到闲的那份」**——一条请求都不搬。它只做「全体停收」这一个动作。决定请求落到哪一份的是前端路由，不是它。
- **「不开它就等于没装」**——不等于。插件一加载调度器就被换掉了，关掉只是让它一上来就把活交还给上游原版。
- **「超过上限一点也算满」**——判断是「正好等于」配置里的那个上限，不是「大于等于」。设计时特意这样选，把「顶满才落闸」钉死。
- **「设一个环境变量就能开」**——v0.23 和 v0.26 上可以，main 上不行，而且那条环境变量的路从一开始就标着要淘汰。

## 对照源码

### 怎么开

v0.23 维护分支上的一段完整配置，模型就是贯穿全库的那个 MoE 模型，每份仍是两颗 NPU 做张量并行（TP），4 份共 8 颗：

```bash
vllm serve Qwen/Qwen3.6-35B-A3B \
  --tensor-parallel-size 2 \
  --data-parallel-size 4 \
  --max-num-seqs 8 \
  --additional-config '{"enable_balance_scheduling": true}'
```

`--max-num-seqs 8` 是为了能手算缩小的值 [A]，真实部署大得多；每份两颗 NPU 沿用[那条请求](one-request.md)的部署，一台 A3 机器 16 个芯片放得下 4 份 [A]。

几个值的来由：

- **模型必须是 MoE**：上游只在 `data_parallel_size > 1` 且 `model_config.is_moe` 时构造 `DPEngineCoreProc` [C34]；`is_moe` 就是 `get_num_experts() > 0` [C39]，Qwen3.6-35B-A3B 的 `num_experts` 是 256 [S38]。
- **`enable_balance_scheduling`** 默认 `false`，不写就整套不启用 [C10]。v0.23 上开关由 `_balance_scheduling_enabled` 依次查 `AscendConfig`、`additional_config`、环境变量 `VLLM_ASCEND_BALANCE_SCHEDULING` [C8]。这些键怎么从 `additional_config` 走到 `AscendConfig`，见[配置系统](ascend-config-system.md)。
- **`--data-parallel-size`** 必须大于 1。等于 1 时引擎核心构造的是上游原版的 `EngineCoreProc`，不是带 gather 钩子的 DP 子类 [C6]，`balance_gather` 一次都不执行；`balance_queue` 每一格保持构造时的 `0` [C2]。闸门比的 `max_num_running_reqs` 就是 `max_num_seqs` [C15]，取值下限是 1 [C16]——`0 == 1` 永远不成立 [D]。
- **`--max-num-seqs`** 直接就是闸门那个上限，**调它等于同时动两件事**：单 rank 的并发，和全局冻结的触发点。

### 会报什么错

- **dense 模型多 DP 加这个开关，v0.23 上启动即撞断言** `[!]`：v0.23 补丁自己抄的 `run_engine_core` 只判 `data_parallel_size > 1 or dp_rank > 0`，就去建 `BalanceDPEngineCoreProc` [C36]；它的父类 `DPEngineCoreProc.__init__` 里有 `assert vllm_config.model_config.is_moe, "DPEngineCoreProc should only be used for MoE models"` [C35]。v0.26 起补丁改成「开关打开时才把模块里的 `DPEngineCoreProc` 换名成 `BalanceDPEngineCoreProc`」，要不要建 DP 进程交回上游判断 [C37]；dense 模型于是退回 DP=1 式的独立进程，开关不报错也不生效 [D]。
- 和 `profiling_chunk_config` 同开：`ValueError` [C11]。
- 只支持 PD 混部：配了 `kv_transfer_config` 而 `kv_role` 不是 `kv_both`，`ValueError`。
- main 上和 DyntraLB 同开：`ValueError` [C30]。

### 开销和什么时候别开

- **闲置名额**：落闸那一步其余 rank 的空位全部闲着，上面那个例子是 14 个（5 + 3 + 6）[D]。换来的是顶满的 rank 不再被继续拖慢。
- **每步一次跨 rank 通信**：`balance_gather` 每步 `all_gather` 一个 int [C3]。挂载点 `_has_global_unfinished_reqs` 里那次 all-reduce 有优化，`step_counter % 32 != 0` 时直接返回 `True`，真正的跨 rank 同步每 32 步才做一次 [C17]；但这个**函数**每个非空转迭代都会被调用一次，所以挂在它尾巴上的 gather 仍是一步一次 [D]。
- **抄件漂移**：设计文档的表里写着，为了插那几行，`Scheduler.schedule()` 整整 520 行被逐字抄进补丁，`run_busy_loop` 和 `run_engine_core` 又各抄一份 [S19]；v0.23 那份补丁一共 745 行，绝大部分是上游原文。设计文档自己记着两份抄件已经过期。
- **别开的场景**：DP=1（彻底空转）；dense 模型（v0.23 起不来，之后不生效）；PD 分离的纯 P 或纯 D 节点（直接报错）。
- 设计文档把「让落后的 rank 追上领先的」这个语义明确拒绝过 [S21]，选 `==` 而不是 `>=` 就是为此。

### 版本差异

闸门语义（用 `==`、比的是上一步结束时的快照）三版一致，差异全在外围：

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 配置键写在哪 | 只认顶层 `enable_balance_scheduling` | 顶层或 `scheduler_config` 下，后者优先，写顶层会打 deprecation 警告 | 同 v0.26 | 旧的顶层写法三版都还开得起来，只是新版会提醒你挪窝 |
| `VLLM_ASCEND_BALANCE_SCHEDULING` | 认，`envs.py` 里有这个名字 [C12] | 认 | **不认**，`envs.py` 里已经没有它，配置代码注释写明「legacy environment fallback has been removed」[C26] | [!] 靠环境变量开它的部署升到 main 会**静默失效**：服务照起，闸门不装 |
| 引擎核心那一侧 | 整段抄 `run_busy_loop` 和 `run_engine_core` | 只覆盖 `_has_global_unfinished_reqs`，模块名按开关替换 | 同 v0.26，那次替换搬进了 `patch_engine_core.py` | v0.23 的两份抄件会随上游演进过期；新版只剩一个钩子要盯 |
| 对 dense 多 DP | 无条件建 `BalanceDPEngineCoreProc`，撞断言 | 条件换名，交回上游判断 | 同 v0.26 | [!] 只有 v0.23 上 dense 模型开它会起不来 |
| `BalanceScheduler` 的父类 | 上游 `Scheduler` | `KVDeliveryScheduler`，另一份 ascend 抄件 [C22] | 上游 `Scheduler` | [!] 只有 v0.26 上「关掉就等于纯上游」不成立，中间还隔着一层抄件 |
| 和 DyntraLB 互斥 | 无此特性 | 无此特性 | 同开直接 `ValueError` | main 上 decode 侧那条负载均衡是另一条路，二选一 |

main 自己的文档还没对齐：配置页正文写着这个环境变量「no longer supported」[S31]，同一个文件顶上的速查表却仍列着 `VLLM_ASCEND_BALANCE_SCHEDULING → scheduler_config.enable_balance_scheduling` 这一行。以代码为准 [!]。

### 源码位置

上游扫 waiting 那段循环——先判本 rank 的 running 满没满，再取队列：

```python
while (self.waiting or self.skipped_waiting) and token_budget > 0:
    if len(self.running) == self.max_num_running_reqs:
        break
    request_queue = self._select_waiting_queue_for_scheduling()
    assert request_queue is not None
```

`BalanceScheduler.schedule()` 把闸门 `max(t.item() for t in self.balance_queue) == self.max_num_running_reqs` 插在这两句之间，并把那句 `assert` 换成 `if request_queue is None: break`——闸门推迟准入之后，队列确实可能取不出来。加上开头那句「没开就 `return super().schedule(...)`」[C4]，一共三处改动。

| 看什么 | 在哪 |
|---|---|
| 闸门那两行 | v0.23 `vllm_ascend/patch/platform/patch_balance_schedule.py` L319–330 |
| `balance_queue` 的构造（每格初值 0） | 同文件 L78–86 |
| `balance_gather`：`all_gather` 本 rank 的 `len(self.running)` | 同文件 L88–92 |
| 没开时早退回上游 | 同文件 L107–111 |
| `BalanceDPEngineCoreProc` 把 gather 挂在 `_has_global_unfinished_reqs` 后面 | 同文件 L642–667；main L894–903 |
| 换名：`vllm.v1.core.sched.scheduler.Scheduler = BalanceScheduler` | 同文件 L744–745，`vllm_ascend/patch/platform/__init__.py` 无条件 import 它 |
| 放进 `schedule()` 会死锁的理由 | 设计文档：排空的 rank 去跑 `execute_dummy_batch()`、不进 `schedule()` [S20] |
| 上游只为 MoE 建 DP 进程 | 上游 `vllm/v1/engine/core.py` L1153–1156、L1715–1717 的断言 |
| 那次 all-reduce 每 32 步才真做 | 上游 `vllm/v1/engine/core.py` L1928–1932 |
| 开关解析 | v0.23 `ascend_config.py` L78–83；v0.26 `ascend_config.py`；main `ascend_config.py` L1450–1456 |
