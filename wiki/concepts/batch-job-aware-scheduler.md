---
id: batch-job-aware-scheduler
title: "Batch-Job-Aware Scheduler：给离线批处理换掉的那条等待队列"
type: feature
summary: 把上游调度器的 waiting 队列换成按「作业」分桶的队列，先给在跑的请求预留下一轮要的块，再从桶里挑一条塞得下的；为离线批处理而生，不做饥饿防护。
aliases: [Batch-Job-Aware Scheduler, 批作业感知调度器, 批作业调度器, BatchJobAwareScheduler, BatchJobAwareRequestQueue, batch_job_sched_config, job_name 标签]
chapters: ["12"]
order: 40
sources:
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L622-L641
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L57-L74
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L126-L141
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L153-L173
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L244-L287
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L238-L242
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L509-L541
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L554-L571
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L595-L609
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L315-L333
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L496-L507
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L643-L661
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L386-L393
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L17-L28
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L664-L682
  - vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L757-L802
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L716-L725
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L662-L666
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L709-L714
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/batch_job_aware_scheduler.md#L3-L5
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/batch_job_aware_scheduler.md#L54-L62
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/batch_job_aware_scheduler.md#L64-L75
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/batch_job_aware_scheduler.md#L81-L88
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/batch_job_aware_scheduler.html
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L183-L185
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L665-L680
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L1224-L1234
  - vllm@568afb3a:vllm/v1/request.py#L353-L359
  - vllm-ascend@2ed6cbba:tests/e2e/pull_request/one_card/test_batch_job_aware_scheduler_e2e.py#L47-L82
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1290-L1303
  - vllm-ascend@b255ab59:vllm_ascend/config_utils.py#L43-L48
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L1272-L1281
verified: ["releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: vllm-scheduler
    kind: builds-on
    note: 它只换掉 self.waiting 这条队列，两个 while 的顺序、token 预算、抢占仍是那一页讲的那套
  - to: ascend-config-system
    kind: builds-on
    note: batch_job_sched_config 是 additional_config.scheduler_config 下的子配置，嵌套键与顶层旧键的优先级在那一页
  - to: chunked-prefill
    kind: builds-on
    note: 预留块数的推算直接拿 max_num_scheduled_tokens 当这一轮 prefill 切片的大小，切不切、切多大在那一页
  - to: one-request
    kind: builds-on
    note: 「预留 2 块 = 28 MiB」用的是那一页算出的每块 14 MiB
contradicts: []
updated: "2026-09-21"
origin: seed
---

## 一句话

它只做一件事：**把上游调度器的 `self.waiting` 换成一条按「作业」分桶的队列**，其余（running 循环、token 预算、chunked prefill、抢占、async scheduling）一行没改。新队列在放行之前先扣掉在跑的请求下一轮要的 KV 块，**用少接几条请求来换少发生几次抢占**。

```wiki-diagram
file: batch-job-aware-scheduler
```

**它是新特性：v0.23 维护分支上没有。** `vllm-ascend@2c59ff10` 全仓 grep `batch_job` 零命中，`vllm_ascend/core/` 里没有这个文件，`feature_guide/` 里也没有这篇文档 [D]。v0.26 分支（`2ed6cbba`）起才有；main 开发主线（`b255ab59`）上 `batch_job_aware_scheduler.py` 与那篇文档**逐字节相同**（`git diff` 两个文件均无输出），差异只在它周围的配置系统，见下面的差异表。

## 那条请求用不到它

[那条请求](one-request.md)是队列里唯一的一条，而这个调度器整个是在解决「多条请求怎么排」——单条请求的等待队列里只有它自己，分桶、排序、best-fit 全部退化成「就它」。

但**预留那一半照样生效，而且能就地算出来**。把设定改成官方 e2e 测试那套：Qwen3-0.6B、单卡、`max_model_len=2048`、开 `batch_job_sched_config.enabled`，其余默认。不开投机解码时 `num_lookahead_tokens = 0`，`_compute_one` 对一条在 decode 的请求这样推 [C5]：

| 这一轮的 `num_computed_tokens` | 推出的原始块数 | 加 margin 后真正预留 |
|---|---|---|
| 任意非 127 的值 | 下一轮只要 1 个 token，当前块里还有空位 → **0** | `min(0 + 2, 8) = 2` 块 = **28 MiB** |
| 正好 127 | 这一轮写满第 0 块，下一轮要跨块 → `ceil(1 / 128) = 1` | `min(1 + 2, 8) = 3` 块 = **42 MiB** |

margin 2 和上限 8 就是 `reserve_margin_blocks` 与 `reserve_max_blocks` 的默认值 [C16]；每块 14 MiB 来自 [那条请求](one-request.md)。**也就是说，为了这一条 37+200 token 的请求，调度器全程压着 28 MiB 不让新请求碰**——这就是它的代价长什么样。

## 「批作业」是从 request_id 里认出来的，不是从别的地方

没有新字段、没有新 API。`JobNameParser` 拿 `#job_name\[([^\[\]]+)\]#` 在 `request_id` 上跑一次正则，**匹配不到就归到 `__default__` 这个 job** [C2]。所以打标签的方式就是在批处理输入文件里把标签写进 `custom_id` / `request_id`：

```jsonl
{"custom_id": "#job_name[job_A]#req_001", "method": "POST", "url": "/v1/chat/completions", "body": {"request_id": "#job_name[job_A]#req_001", "messages": [{"role": "user", "content": "Hello"}], "n": 1}}
```

两件容易记错的事：一、模块注释管它叫 `prefix`，但代码用的是 `re.search` 不是 `match`，**标签放在 id 的任何位置都认**——官方文档自己的两个例子正好一个在结尾、一个在开头 [!]。二、作业名里不能出现方括号，`[^\[\]]+` 把它们排除了。

开关走 `additional_config`，六个键全在 `batch_job_sched_config` 下面：

```bash
python -m vllm.entrypoints.openai.run_batch \
    --model /path/to/Qwen3-0.6B -i input.jsonl -o output.jsonl \
    --additional-config '{"scheduler_config": {"batch_job_sched_config": {"enabled": true}}}'
```

只写 `enabled` 就够了，另外五个的默认值是 `max_jobs=20`、`reserve_margin_blocks=2`、`reserve_max_blocks=8`、`low_available_tokens_threshold=4096`、`short_decode_token_threshold=32` [C16]。`async_scheduling` 开着时平台层选的是 `BatchJobAwareAsyncScheduler`，它靠多继承把异步调度和这套逻辑拼在一起，MRO 写在类注释里 [C17]。

## 预留是一道减法，减完才决定放不放人进来

上游那条 waiting 的 while 循环每轮都先问队列「你还有人吗」，再 `peek_request` 取队头。**这个 bool 在新队列里不是「桶空不空」，而是「在预留之后还挑得出一条吗」** [C7]。减法只有一行：

```
准入预算(token) = max(0, (block_pool 空闲块数 − 预留块数) × block_size)
```

预留块数由 `RunningBlockReserver` 算：它先模拟这一轮执行完之后每条 running 请求的位置，再从那个位置推下一轮要几个新块——之所以要多模拟一步，是因为调用发生在 waiting 准入阶段，此时 running 请求的 `num_new_tokens` 已经分好、`num_computed_tokens` 还没推进。预算为 0 就直接返回 `None`，队列的 `__bool__` 随之为假，**waiting 这一侧这一步一个新请求都不放**。

这道闸只管 `self.waiting` 一条队列。上游同时还有一条 `skipped_waiting`，它是 `Scheduler.__init__` 里另外建的、没有被替换的 FCFS 队列，落进去的请求（等远端 KV、LoRA 名额不够之类）绕过整套预留逻辑。离线批处理里这条队列基本是空的 [I]。

**被抢占的请求不享受插队。** 上游把它 `prepend_request` 回 waiting，而新队列的 `prepend_request` 就是 `add_request`——它按 job 名和 prompt 长度重新入桶，头部优先权没了。

## job 的先后由「预测的 decode 长度」和「此刻余量」一起决定

挑人分三层：

1. **冷启动优先。** 每个 job 的前 3 条请求排在最前，目的是先把这个 job 的 decode 长度样本收上来。这一层**不做 best-fit 检查**：只要预算不是 0，冷启动请求就被交出去，哪怕它的 prompt 比预算还长。
2. **按余量决定先长还是先短。** `prioritize_long = 准入预算 > low_available_tokens_threshold`（默认 4096）[C9]。余量宽裕时先发长 decode 的 job（让它们尽早占住机器、后面用短的填缝），余量紧张时反过来先发短的（尽快腾出块）。
3. **桶内 best-fit。** `peek_best_fit_request` 在按 prompt 长度排好序的桶里二分，取**不超过准入预算的最长那条**；一条都不超就退而取最短的那条。这才是模块注释里 "LPT" 的实际含义——长的先上，短的填缝。

decode 长度由 EWMA 估计：`α = 0.1`，没有样本时返回冷启动默认 **128**，每个 job 最多收 10 个样本后就不再更新 [C3]。分类的阈值是 `short_decode_token_threshold`（默认 32），代码判的是 `predict_decode > 32` 为长 [C8]，而类注释写的是 `>= 32` 为长 [C13][!]——正好等于 32 时两者结论相反，以代码为准。

`_sort_jobs` 还有一处反直觉的地方：长短两类**都非空**时各自按 decode 长度降序，再按余量决定谁在前；只剩一类时，排序方向跟着 `prioritize_long` 翻转——**余量紧张且只有长 job 时，长 job 之间是升序，短的先走**。

## 开了它要付的代价

- **不做饥饿防护。** 官方文档开篇就用一条 Note 说明：它只适用于批处理，或者「不在乎请求等待时间」的在线场景 [S20]。
- **job 数超了是抛异常，不是降级。** 桶和估计器各有一份 `max_jobs` 检查，超了直接 `raise RuntimeError` [C11]，引擎跟着挂。默认只跟踪 20 个 job。
- **`max_jobs: 0` 不是「不限」。** 桶那边写的是 `if self._config.max_jobs and ...`，0 会短路掉检查；估计器那边没有这个短路，`len(...) >= 0` 恒真，**第一条自然停止的请求就会把引擎打挂** [C4][!]。而校验只拒绝负数，注释还写着 `0 = unlimited`。
- **EWMA 只从自然停止的请求学。** `_free_request` 仅在状态是 `FINISHED_STOPPED` 时 `observe` [C12]，被 `max_tokens` 截断的请求状态是 `FINISHED_LENGTH_CAPPED` [C28]，一条都不算。离线批处理几乎都会设 `max_tokens`，于是估计器可能**永远停在冷启动默认 128**，长短分类退化成「全是长 job」[D]。
- **和 `short_request_first` 互斥会报错，和 `profiling_chunk` 却是静默覆盖。** 前者显式 `raise ValueError`；后者先把 `scheduler_cls` 设成 `ProfilingChunkScheduler` 并 import 它的 patch，紧接着批作业这段又把 `scheduler_cls` 改掉 [C19][!]——patch 打了，调度器却不是它。

好消息是它不改结果：官方 e2e 用 Qwen3-0.6B 把开与不开的输出做逐 token 相等断言 [C29]。

## v0.26 与 main 的差异

调度器本体和那篇文档在两个分支上逐字节相同，差异全在它周围的配置系统：

| 项 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| `BatchJobSchedConfig` 怎么实现 | 普通类，`config.get(key, 默认值)` 逐个取 | `@config` pydantic dataclass，装饰器合并了 `extra="forbid"` [C30][C31] | [!] 子键名写错（比如 `reserve_max_block` 少个 s）在 v0.26 上被静默忽略、按默认值跑；main 上会被 pydantic 拒掉 [D] |
| 选调度器那段代码在哪 | `NPUPlatform.check_and_update_config` 里 | 提成模块级函数，判断与赋值逐行相同，只换了局部变量名 | 只是重构，行为一致；但按 v0.26 的行号去 main 上找会落空 |

两个分支上六个参数的名字、默认值、取值范围完全一致，嵌套键与顶层旧键的优先级也一致（写顶层会收到 deprecated 警告）。

## 常见误解

- **「它是给离线批作业和在线请求混跑用的。」**——不是。官方文档把它限定在离线批处理，或者明确不在乎等待时间的在线场景，理由就是它不做饥饿防护（见上）。混跑时一个长 decode 的 job 可以一直压着在线请求不放 [D]。
- **「不打 `#job_name[...]#` 标签就用不上它。」**——用得上。没标签的请求全部落进 `__default__` 这一个 job [S22]，预留、桶内 best-fit 照常生效；失去的只是 job 之间的排序。
- **「`max_jobs` 是并发请求数上限。」**——它数的是**同时被跟踪的 job 数**，跟并发请求数没关系；而且超了不是排队等待，是抛 `RuntimeError`。
