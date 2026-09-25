---
id: batch-job-aware-scheduler
title: "Batch-Job-Aware Scheduler：给离线批处理换掉的那条等待队列"
type: feature
summary: 一大堆离线请求一起交上来时，调度器先替已经在算的请求留出下一步要用的显存块，剩下的再按「作业」挑新请求放进来；少接几条，换少被挤掉几次。只适合不在乎等待时间的离线批处理。
aliases: [Batch-Job-Aware Scheduler, 批作业感知调度器, 批作业调度器, BatchJobAwareScheduler, BatchJobAwareRequestQueue, batch_job_sched_config, job_name 标签, 作业标签]
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
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1300-L1313
  - vllm-ascend@baa023ad:vllm_ascend/config_utils.py#L43-L48
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1271-L1280
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm@568afb3a:vllm/v1/core/kv_cache_utils.py#L649-L659
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_mamba_config.py#L102-L103
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_mamba_config.py#L144-L144
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L240-L240
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L430-L436
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L10-L13
  - vllm-ascend@2ed6cbba:vllm_ascend/core/batch_job_aware_scheduler.py#L618-L619
verified: ["releases/v0.26.0rc", "main"]
evidence: "C"
relations:
  - to: vllm-scheduler
    kind: builds-on
    note: 它只换掉等待队列，先扫在跑的、再扫等待的这个顺序、token 预算、抢占仍是那一页讲的那套
  - to: ascend-config-system
    kind: builds-on
    note: batch_job_sched_config 是 additional_config.scheduler_config 下的子配置，嵌套键与顶层旧键的优先级在那一页
  - to: chunked-prefill
    kind: builds-on
    note: 预留块数的推算直接拿 max_num_scheduled_tokens 当这一步 prefill 切片的大小，切不切、切多大在那一页
  - to: one-request
    kind: builds-on
    note: 例子沿用那一页的模型与两颗 NPU 配置：块是 2048 个位置、每块每颗约 20 MiB
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一万条请求一起交上来，先放谁进来？

在线服务里请求是一条条来的，调度器每一步从等待的请求里按先来后到放人。离线批处理不一样：你把一个文件里的一万条请求一次性交给服务，可能还分属好几个「作业」（比如作业 A 是做摘要、作业 B 是做分类），谁先谁后你并不在乎，只在乎整批跑完得快、中途别出乱子。

这时先来后到就不是最好的办法了。最常见的乱子是**抢占**：放进来的请求太多，在跑的请求下一步要写新的 KV Cache（模型给每个算过的 token 留的笔记）却没有空块了，调度器只好把某条请求踢出去、清掉它的笔记，回头再从头算。

批作业感知调度器就是冲这个来的。它**只换掉调度器里那条等待队列**，其余一概不动；新队列在放人之前先做一件事——**替已经在跑的请求把下一步要用的块留出来**，剩下的才拿去放新请求。它用少接几条请求，来换少发生几次抢占。

```wiki-diagram
file: batch-job-aware-scheduler
```

这是一个新特性：v0.23 版本上没有，从 v0.26 版本才有；开发主线上的调度器本身和 v0.26 一模一样，只是周围的配置写法变了。

## 只有一条请求时，它也照样留块

拿[那条请求](one-request.md)的设定来算：Qwen3.6-35B-A3B，两颗 NPU，问题 37 个 token、回答 200 个。在这个配置下，调度器按 **2048 个位置一块**来记账（这个模型的块特别大，原因在那一页）。

队列里只有它一条，所以「按作业分组、挑先后」全都退化成「就它」。但留块这一半照样生效，而且能就地算出来：

- 这条请求在 decode（一次吐一个 token）时，下一步只要再写 1 个 token。它总共才 237 个 token，一个 2048 位置的块里空位多得是，**下一步不需要新块**。
- 调度器不会只留 0 块，它总会多留一点余量，默认是 **2 块**。
- 只有当一条请求刚好写到块的最后一个位置（第 2048、4096……个 token）时，下一步才要跨进新块，那一步会留 **3 块**。这条请求走不到那里。

所以为了这一条 237 个 token 的请求，调度器全程压着 **2 块**不让新请求碰。按那一页的账，一块在每颗 NPU 上约 20 MiB，两块约 40 MiB——这就是它的代价长什么样。

## 「作业」是从请求编号里认出来的

它没有新增任何字段或接口。每条请求本来就有一个编号，你在编号里写一段约定格式的作业标签，调度器就按标签把请求分组；**没写标签的请求统统归进一个默认作业**，照样能用，只是没有了「作业之间谁先谁后」这层排序。

标签放在编号的开头、结尾、中间都认；作业名里不能有方括号。具体写法在下半「怎么开」。

## 留块是一道减法，减完才决定放不放人

上游调度器每一步先处理已经在跑的请求，再去等待队列里问：「还有人能放进来吗？」换上新队列之后，这个问题的意思变了：不是「队列空不空」，而是「**先扣掉留给在跑请求的块，还挑得出一条吗**」。

扣法只有一行：

```
能放进来的 token 数 = (空闲块数 − 留给在跑请求的块数) × 每块的位置数
```

扣完是 0，这一步等待的请求一个都不放。

算「在跑的请求下一步要几个新块」时，调度器会先假想这一步已经算完、每条请求往前走了一截，再从那个位置往后推。原因是问这个问题的时候，这一步还没真正执行，请求的位置还停在上一步。

还有两点容易忽略：

- 这道闸只管被换掉的那条等待队列。上游另有一条「暂时跳过」的队列没有换，落进去的请求（比如在等远端的 KV Cache）绕过整套留块逻辑。离线批处理里这条队列基本是空的。
- **被抢占的请求不再插队。** 上游会把被踢出去的请求放回等待队列的最前面；新队列不认这个，它会按作业和问题长度重新分组排好，原来的优先权就没了。

## 先放哪个作业：看回答预计多长、看还剩多少余量

挑人分三层：

1. **每个作业的前 3 条先上。** 目的是先收集这个作业的回答一般多长。这一层不看问题塞不塞得下，只要还有余量就放。
2. **余量宽裕先放「回答长」的作业，余量紧张先放「回答短」的。** 宽裕时让长的尽早占住机器、后面用短的填缝；紧张时让短的快跑完、快把块还回来。分界默认是 4096 个 token。
3. **同一个作业里，挑问题长度不超过余量的最长那条**；一条都塞不下就退而取最短的。长的先上，短的填缝。

「回答预计多长」是边跑边估的：每个作业从已经自然结束的请求里取样，越新的样本分量越大，没有样本时先按 128 个 token 估；超过 32 个 token 算「长」。

在这个例子里有一个很直观的推论：余量总是按整块算的，一块就是 2048 个 token，所以「余量超过 4096」其实就等于「扣完预留后**至少还剩 3 块空闲**」。块越大，这道门槛越粗。

## 开了它要付的代价

- **它不管等太久的请求。** 一个回答很长的作业可以一直压着别的请求不放，所以官方只推荐在离线批处理、或者明确不在乎等待时间的在线场景用它。
- **作业多了不是排队，是直接出错。** 默认只跟踪 20 个作业，第 21 个作业一出现，整个服务就停了。
- **回答长度的估计可能永远停在初值。** 它只从「模型自己说完了」的请求里学；被「最多生成多少个 token」截断的请求一条都不算。离线批处理几乎都会设这个上限，于是估计可能一直是 128，所有作业都被当成「回答长」。
- **和另外两种调度器不能一起开。** 和「短请求优先」一起开会直接报错；和另一种按性能分析切块的调度器一起开却不报错，但后者只生效了一半。

好消息是它**不改结果**：官方测试里开与不开，生成的每个 token 都一样。

## 常见误解

- **「它是给离线批作业和在线请求混跑用的。」**——不是。官方把它限定在离线批处理，或明确不在乎等待时间的在线场景，理由就是它不管等太久的请求。混跑时一个回答长的作业可以一直压着在线请求。
- **「不打作业标签就用不上它。」**——用得上。没标签的请求全归进默认作业，留块、同作业内挑最合适的一条照常生效；失去的只是作业之间的排序。
- **「作业数上限就是并发请求数上限。」**——不是。它数的是**同时被跟踪的作业有几个**，跟同时在跑多少条请求没关系；而且超了不是排队，是出错。

## 对照源码

### 怎么开

开关走 `additional_config`，六个键全在 `scheduler_config.batch_job_sched_config` 下面；只写 `enabled` 就够了：

```bash
python -m vllm.entrypoints.openai.run_batch \
    --model /path/to/model -i input.jsonl -o output.jsonl \
    --additional-config '{"scheduler_config": {"batch_job_sched_config": {"enabled": true}}}'
```

官方文档写明目前只支持离线批处理模式 [S21]。另外五个键的默认值：`max_jobs=20`、`reserve_margin_blocks=2`、`reserve_max_blocks=8`、`low_available_tokens_threshold=4096`、`short_decode_token_threshold=32` [C16]。

作业标签由 `JobNameParser` 用正则 `#job_name\[([^\[\]]+)\]#` 在 `request_id` 上匹配，**匹配不到归入 `__default__`** [C2][S22]。批处理输入文件里把标签写进 `custom_id` / `request_id`：

```jsonl
{"custom_id": "#job_name[job_A]#req_001", "method": "POST", "url": "/v1/chat/completions", "body": {"request_id": "#job_name[job_A]#req_001", "messages": [{"role": "user", "content": "Hello"}], "n": 1}}
```

两件容易记错的事：一、模块注释管它叫 `prefix`，但代码用的是 `re.search` 不是 `match`，**标签放在 id 的任何位置都认**——官方文档自己的两个例子正好一个在结尾、一个在开头 [!]。二、`[^\[\]]+` 排除了方括号，作业名里不能有。

`async_scheduling` 开着时平台层选的是 `BatchJobAwareAsyncScheduler`，它靠多继承把[异步调度](async-scheduling.md)和这套逻辑拼在一起，MRO 写在类注释里 [C15][C17]。

替换点：`BatchJobAwareScheduler.__init__` 把上游的 `self.waiting` 换成 `BatchJobAwareRequestQueue` [C1]；上游 `Scheduler.__init__` 里的 `self.waiting` 与 `self.skipped_waiting` 是两条分别建的队列 [C25]，只有前者被换。

准入预算是 `max(0, (block_pool 空闲块数 − 预留块数) × block_size)`，为 0 时 `_find_admittable` 返回 `None`，队列的 `__bool__` 随之为假 [C40]，上游 waiting 那条 while [C26] 就此退出 [C7]。预留块数 `= min(原始块数 + reserve_margin_blocks, reserve_max_blocks)` [C6]，原始块数由 `RunningBlockReserver._compute_one` 先模拟本步推进、再推下一步需求 [C5]。

**上半例子的推导** [D]：

- 模型形状取自官方配置 [S33]：40 层、`full_attention_interval: 4`（10 层全注意力）、`num_key_value_heads: 2`、`head_dim: 256`；两颗 NPU 下每块 2048 个位置、每块每颗约 20 MiB 沿用 [那条请求](one-request.md)的已核值。
- 调度器的 `block_size` 是 2048：昇腾的 `patch_mamba_config` 把 `cache_config.block_size` 抬到按 SSM 页对齐算出的注意力块大小 [C35]，并令 `mamba_block_size = block_size` [C36]；上游多 KV 组时调度器块大小取各组块大小的最小公倍数（注意力组乘 DCP，mamba 组不乘）[C34]，DCP=1 时 `lcm(2048, 2048) = 2048`。
- 不开投机解码时 `num_lookahead_tokens = 0` [C37]，decode 请求下一步只要 1 个 token。`num_computed_tokens` 为 236 时，本步推进后是 237，`237 % 2048 = 237`，块里还剩 1811 个位置 ≥ 1，原始块数 0，预留 `min(0 + 2, 8) = 2`。只有 `num_computed_tokens ≡ 2047 (mod 2048)` 时推进后恰好落在块边界，原始块数 `ceil(1 / 2048) = 1`，预留 3。
- `2 × 20 MiB ≈ 40 MiB`/NPU。
- 准入预算恒为 2048 的整数倍，`> 4096` 等价于扣完预留后空闲块 ≥ 3[C9]。

[!] 官方 e2e 只在 Qwen3-0.6B 上跑过 [C29]；这里拿混合模型举例只为算账，没有找到这个调度器在 Qwen3.6-35B-A3B 这类混合模型上的官方测试。

### 会报什么错

- **作业数超了抛异常，不是降级。** 桶和估计器各有一份 `max_jobs` 检查，超了直接 `raise RuntimeError` [C11]，引擎跟着挂。
- **`max_jobs: 0` 不是「不限」。** 桶那边写的是 `if self._config.max_jobs and ...`，0 会短路掉检查；估计器那边没有这个短路，`len(...) >= 0` 恒真，**第一条自然停止的请求就会把引擎打挂** [C4][!]。而校验只拒绝负数，注释还写着 `0 = unlimited`。
- **和 `short_request_first` 互斥会报错，和 `profiling_chunk` 却是静默覆盖。** 前者显式 `raise ValueError`；后者先把 `scheduler_cls` 设成 `ProfilingChunkScheduler` 并 import 它的 patch，紧接着批作业这段又把 `scheduler_cls` 改掉 [C19][!]——patch 打了，调度器却不是它。见[短请求优先](short-request-first.md)。
- **子键名写错：v0.26 静默忽略，main 报错。** v0.26 分支的 `BatchJobSchedConfig` 用 `config.get(key, 默认值)` 逐个取；main 上是 `@config` pydantic dataclass，装饰器合并了 `extra="forbid"` [C30][C31]。比如 `reserve_max_block` 少个 s，在 v0.26 上按默认值跑，在 main 上被 pydantic 拒掉 [D][!]。

### 开销和什么时候别开

- **不做饥饿防护。** 官方文档开篇就用一条 Note 说明：只适用于批处理，或「不在乎请求等待时间」的在线场景 [S20]。
- **预留是实打实压着的块。** 每一步至少 `reserve_margin_blocks` 块、至多 `reserve_max_blocks` 块不给新请求；块越大（如本页例子的 2048）这笔越重 [D]。
- **EWMA 只从自然停止的请求学。** `_free_request` 仅在状态是 `FINISHED_STOPPED` 时 `observe` [C12]，被 `max_tokens` 截断的请求状态是 `FINISHED_LENGTH_CAPPED` [C28]，一条都不算。离线批处理几乎都会设 `max_tokens`，于是估计器可能**永远停在冷启动默认 128**，长短分类退化成「全是长 job」[D]。
- **估计器细节**：`α = 0.1`，没有样本时返回冷启动默认 128，每个 job 最多收 10 个样本后不再更新 [C3]。
- **长短阈值的边界不一致。** 代码判的是 `predict_decode > 32` 为长 [C8]，类注释写的是 `>= 32` 为长 [C13][!]——正好等于 32 时两者结论相反，以代码为准。
- **冷启动不做 best-fit。** 每个 job 前 3 条由 `_get_cold_start_request` 交出，只要预算不为 0 就放，哪怕 prompt 比预算还长。
- **`_sort_jobs` 的翻转。** `prioritize_long = 准入预算 > low_available_tokens_threshold`。长短两类**都非空**时各自按 decode 长度降序，再按余量决定谁在前；只剩一类时，排序方向跟着 `prioritize_long` 翻转——**余量紧张且只有长 job 时，长 job 之间是升序，短的先走**。
- **桶内 best-fit。** `peek_best_fit_request` 在按 prompt 长度排好序的桶里二分，取不超过准入预算的最长那条，一条都不超就取最短的 [C10]；这就是模块注释里 "LPT"（长的先上、短的填缝）的实际含义 [C39]。
- **被抢占的请求失去队头。** 上游把它 `prepend_request` 回 waiting [C27]，新队列的 `prepend_request` 就是 `add_request`，按 job 名和 prompt 长度重新入桶 [C38]。
- **`skipped_waiting` 不受管。** 它是上游另建的 FCFS 队列，落进去的请求（等远端 KV、LoRA 名额不够之类）绕过整套预留逻辑；离线批处理里这条队列基本是空的 [I]。
- **不改结果。** 官方 e2e 用 Qwen3-0.6B 把开与不开的输出做逐 token 相等断言。

### 版本差异

**v0.23 维护分支上没有。** `vllm-ascend@2c59ff10` 全仓 grep `batch_job` 零命中，`vllm_ascend/core/` 里没有这个文件，`feature_guide/` 里也没有这篇文档 [D]。v0.26 分支起才有；main 上 `batch_job_aware_scheduler.py` 与那篇文档跟 v0.26 **逐字节相同**（两个提交之间 `git diff` 这两个文件均无输出），差异全在它周围的配置系统：

| 项 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| `BatchJobSchedConfig` 怎么实现 | 普通类，`config.get(key, 默认值)` 逐个取 | `@config` pydantic dataclass，装饰器合并了 `extra="forbid"` | [!] 子键名写错在 v0.26 上被静默忽略、按默认值跑；main 上会被 pydantic 拒掉 [D] |
| 选调度器那段代码在哪 | `NPUPlatform.check_and_update_config` 里 | 提成模块级函数，判断与赋值逐行相同，只换了局部变量名 | 只是重构，行为一致；但按 v0.26 的行号去 main 上找会落空 |

两个分支上六个参数的名字、默认值、取值范围完全一致，嵌套键与顶层旧键的优先级也一致（写顶层会收到 deprecated 警告）。

### 源码位置

| 看什么 | 文件 |
|---|---|
| 调度器、队列、预留、估计器、标签解析 | `vllm_ascend/core/batch_job_aware_scheduler.py` |
| 六个配置键与默认值 | `vllm_ascend/ascend_config.py`（main 另见 `vllm_ascend/config_utils.py` 的 `@config`） |
| 选哪个调度器类、互斥检查 | `vllm_ascend/platform.py` |
| 被替换的等待队列、waiting 循环、`prepend_request` | 上游 `vllm/v1/core/sched/scheduler.py` |
| 调度器块大小怎么定 | 上游 `vllm/v1/core/kv_cache_utils.py` 的 `resolve_kv_cache_block_sizes`；昇腾 `vllm_ascend/patch/platform/patch_mamba_config.py` |
| 官方说明 | `docs/source/user_guide/feature_guide/batch_job_aware_scheduler.md` |
| 端到端测试 | `tests/e2e/pull_request/one_card/test_batch_job_aware_scheduler_e2e.py` |
