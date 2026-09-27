---
id: vllm-scheduler
title: Scheduler：按计算进度、预算与缓存安排批次
type: concept
summary: 调度器把每个请求待处理的位置数与本轮预算、运行上限和缓存可用性结合起来，形成执行计划。统一进度表示不消除 Prefill 与 Decode 的计算差别，也不保证所有运行请求每轮都能推进。
aliases: [调度器, Scheduler, token budget, num_computed_tokens, num_scheduled_tokens, waiting, running]
chapters: ["12"]
order: 10
sources:
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L351
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L376-L420
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L562-L580
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L974-L995
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L338
  - vllm@0fc695fc:vllm/config/scheduler.py#L42-L90
verified: []
evidence: "C"
relations:
  - {to: concurrent-requests, kind: builds-on, note: 将批次变化对应到预算、进度和请求集合}
  - {to: kv-cache, kind: builds-on, note: 请求推进需要能够保存相应历史状态}
contradicts: []
updated: "2026-09-26"
origin: seed
---

## 为什么调度以输入工作量为单位

请求长度不同，到达时间不同，已完成的计算也不同。一个正在生成的请求可能只需处理上轮输出，一个刚到达的请求则有许多提示词位置尚未计算。若只按“请求个数”限制批次，就无法直接约束本轮需要处理多少输入。

Scheduler 因而同时管理请求数量和输入 token 预算，并跟踪各请求的已计算进度。固定上游注释将普通提示词、已生成 token 和候选 token 纳入统一进度表示，以便安排剩余工作。[C1] 这是调度抽象；注意力后端仍可能为 Prefill、Decode 和投机验证选择不同路径。

```wiki-diagram
file: token-budget
```

## 从进度差到本轮安排

先取没有投机和异步占位的教学情形：请求当前有 n 个可供处理的 token，其中 c 个已完成模型计算，待处理量为 `n-c`。[A][D] 四个 prompt token 初始有 n=4、c=0；完整 Prefill 后 c=4，生成首个输出后 n=5，因此下轮待处理量为 1。

实际实现还考虑候选和输出占位、长度上限、长 Prefill 阈值及其他限制，再与剩余预算取较小值。[C2] `num_scheduled_tokens` 表示最终安排量，可能小于待处理量。

预算计算中的 token 数不是字数，也不是模型最终产生的 token 数。长 Prefill 安排多个输入而只在完成提示词时产生首个输出；投机解码则可能用一次验证提交多个输出。

## 用并发例子的第三轮看批次构成

沿用[并发页](concurrent-requests.md)的教学预算 6、运行上限 2，假定状态资源足够且没有额外分块对齐要求。B 已结束，A 待处理一个位置，C 的三个提示词位置尚未计算。[A]

| 请求 | 本轮待处理 | 本轮安排 | 预算变化 |
|---|---:|---:|---|
| A | 1 | 1 | 6 → 5 |
| C | 3 | 3 | 5 → 2 |

本轮一共处理 4 个输入，余下 2 个预算不必强行填满。没有合适的请求或受其他资源约束时，批次可以低于上限。图中的 A 与 C 是输入片段，不表示两者共享历史状态。

## 运行集合、等待集合与资源约束

固定实现先遍历运行请求，再考虑等待请求；新请求进入还受最大运行请求数等条件限制。[C2][C3] 这种遍历顺序不是“已运行请求永远不被阻塞”的保证。预算、缓存容量、长度约束、等待数据以及抢占策略都可能限制推进。

缓存资源不足时，调度器可能抢占某个请求，并通过对应状态变更使其之后重新获得计算机会。固定上游的抢占路径会释放相关缓存资源并重置计算进度等记录。[C4] 完整行为还与缓存/传输特性有关，不能只用“FIFO 优先”解释整个调度过程。

## 分块与缓存对齐会改变安排量

将长 Prefill 分摊到多轮，可以给其他请求保留输入预算。具体切分点还可能需要满足混合缓存的边界要求；固定上游存在对齐分块的检查和调整逻辑。[C5] 因而示意图中的 6、1、3 仅用于说明预算关系，不是 GLM 官方配置，也不是所有实际批次都可取的任意长度。

[分块 Prefill](chunked-prefill.md)展开预算怎样跨轮分配，[缓存规格](kv-cache-spec.md)解释为什么不同层状态可能带来共同对齐要求。两者共同决定一个计划是否可执行。

## 配置应对应调度问题

`max_num_batched_tokens` 一类配置约束本轮输入规模，`max_num_seqs` 约束可运行请求规模；默认处理与平台调整需要查看实际版本和启动配置。[C6] 增大某项上限，可能增加并发机会，也可能提高激活、缓存或工作区需求，不能单独保证吞吐提升。

阅读源码时，按“剩余工作 → 预算截断 → 资源可分配 → 写入计划”跟踪一个请求。随后在[输入准备](prepare-inputs-flow.md)中检查计划怎样成为具体位置和槽位张量。固定上游是机制依据，不代表已验证 GLM 镜像的全部补丁和有效默认值。
