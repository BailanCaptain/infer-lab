---
id: one-request
title: 贯穿全书的那条请求
type: concept
summary: 全库只跟一条请求：Qwen3-0.6B、单卡、37 个 token 的问题、200 个 token 的回答。每一页都在讲它走到某一步时发生了什么。
aliases: [那条请求, 样例请求, 贯穿例子, 37 token, 一条请求走到哪]
chapters: ["00"]
order: 10
sources:
  - vllm@0fc695fc:vllm/v1/engine/core.py#L443-L472
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L351
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L238-L250
  - vllm@0fc695fc:vllm/v1/core/block_pool.py#L333-L348
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L142-L144
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L116-L118
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L148-L180
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L196-L236
  - vllm-ascend@2c59ff10:vllm_ascend/attention/dsa_v1.py#L229-L231
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1369-L1381
verified: ["releases/v0.23.0"]
evidence: "C"
relations:
  - to: kv-cache-spec
    kind: builds-on
    note: 每 token 112 KiB、每块 14 MiB 这两个数是那一页从块张量形状算出来的，这里只取结果拿来用
  - to: paged-attention
    kind: builds-on
    note: 这条请求尾巴上空着的 19 个槽位，就是分页方案承诺的「浪费最多一个块」的那个上限
contradicts: []
updated: "2026-09-20"
origin: seed
---

## 一句话

这个知识库从头到尾只跟一条请求。**Qwen3-0.6B，单卡昇腾，问题分词后 37 个 token，回答 200 个 token。** 后面几十页讲的都是它——它排在哪个队里、谁决定这一步算它、它的 K 和 V 写进了哪一格、算它的那个矩阵乘最后落到哪个核上。

```wiki-diagram
file: the-request
```

## 为什么要钉死一条请求

因为不钉死，每一页就只能讲「一般来说」。

「调度器会给每个请求分配 token 预算」——分了多少？「KV Cache 按块分配」——这条请求分到几块？「prefill 和 decode 走不同的算子分支」——这条请求在第几步换的分支？没有具体的数，这些句子都是对的，但读完之后仍然不知道机器在做什么。这是上一版这批页最大的毛病：每一页都在复述机制，没有一页能说出一个具体时刻。

钉死一条之后，每一页都变成「**这条请求走到这里，发生了什么**」。页与页之间也就自动接上了——上一页结束的那一刻，正是下一页开始的那一刻。

## 这条请求的全部设定

| 项 | 值 | 为什么选它 |
|---|---|---|
| 模型 | Qwen3-0.6B：28 层，H=1024，n_q=16，n_kv=8，d_h=128，bf16 | 全库的 worked example 一直用它，换模型等于把已有二十页的数都作废 |
| 硬件 | 单张 Atlas A2（910B），TP=1 | 并行一开，「哪张卡算哪一半」会盖住「这一步在算什么」 |
| 版本 | vllm-ascend v0.23 维护分支 + 配套的 vLLM v0.23.0 | 两边必须成对，见 [vLLM 与昇腾各管什么](who-owns-what.md) |
| 问题长度 | 37 个 token | 比一个块（128）短，于是 prefill 一步算完，不触发 chunked prefill |
| 回答长度 | 200 个 token | 足够长到跨过块边界——这正是要看的那个时刻 |
| `block_size` | 128 | 不是选的：命令行没写，`check_and_update_config` 里的 `refresh_block_size` 就填 128 [C10]。后端报的 `[128]` [C5][C6]（`AscendDSABackend` 还报更小的块 [C9]）是 kernel 支持范围，不是定这个值的那一步 |

上面只有「37」和「200」是我挑的 [A]，挑的理由写在第三列；其余都是模型和代码给定的。

## 三个可以拿计算器复核的数

**一、每个 token 要存多少 KV。** 一层存 K 和 V 两份，每份 `n_kv × d_h` 个 bf16：

```
2 × 8 × 128 × 2 B = 4 KiB   （每 token 每层）
4 KiB × 28 层     = 112 KiB （每 token 全模型）
```

**二、一个块有多大。** 一块装 128 个 token 的位置：

```
128 × 4 KiB   = 512 KiB （每块每层）
512 KiB × 28  = 14 MiB  （每块全模型）
```

这两个数的完整推导在 [KV Cache Spec](kv-cache-spec.md)，那里是从块张量的真实形状 `(2, num_blocks, 128, 8, 128)` 推的 [D]。

**三、这条请求占几块。** 37 + 200 = 237 个 token，`ceil(237 / 128) = 2` 块，共 28 MiB；真正装东西的只有 237 × 112 KiB = 25.9 MiB [D]。差出来的 2.1 MiB 是第二块尾巴上那 **19 个空槽位**——别的请求拿不走，因为块的所有权是整块的。

## 时间轴上那两个要记住的时刻

**第 1 步：prefill。** 37 个 token 一次算完，一次 forward。图上左边那个实心块就是它——实心表示「这些 token 在同一步里」。

**第 92 步 decode：换块。** 位置 0 到 127 都在第 0 块里；prompt 占掉 0–36，decode 每步写一格，写到第 91 步正好把第 127 格填满。第 92 步要写位置 128，第 0 块没有位置了，上游的 `KVCacheManager.allocate_slots` 这时才去 `BlockPool` 要第二块 [C3][C4]。

这个时刻值得单独记住，因为它把两件常被混为一谈的事分开了：

- **要不要新块、要哪一块** —— 上游决定，在 EngineCore 进程里 [C3][C4]；
- **这个 token 写进这块的第几格** —— 昇腾决定，`compute_slot_mapping` 在 Worker 进程里算 [C7]。

## 一步 = 一次 forward，不分 prefill 和 decode

图上一个实心块加 199 根竖线，一共 200 根，就是 200 次 forward。

但要注意：**「prefill 阶段」和「decode 阶段」是讲给人听的说法，调度器里没有这两个东西。** 上游在 `schedule()` 的注释里把这句话写在了最前面——调度器只看每个请求的 `num_computed_tokens` 还差多少追上 `num_tokens_with_spec`，然后尽量分配 token 让它追上 [C2]。第 1 步给这条请求分 37 个 token，第 2 步给 1 个，用的是同一段代码、同一条规则。

正因为如此，`EngineCore.step()` 才能一个分支都不写地循环下去：调度、执行、更新，不判断现在是哪个阶段 [C1]。

## 它会在下面这些页再次出现

每一页都从这条请求的某一刻切进去：

| 请求走到哪一刻 | 哪一页接手 |
|---|---|
| 文字还没变成 token，进程还没分 | [vLLM 的形状](vllm-v1-shape.md) |
| 排进队列，等着被挑中 | [EngineCore：那个 while 循环](vllm-engine-core.md) |
| 被挑中，拿到这一步的 37 个 token 名额 | [调度器：没有 prefill 和 decode 之分](vllm-scheduler.md) |
| 拿到第 0 块；第 92 步拿到第 1 块 | [block 是怎么分出来的](vllm-kv-block-allocation.md) |
| `SchedulerOutput` 跨进程送到昇腾侧 | [vLLM 与昇腾各管什么](who-owns-what.md) |
| 落到 `NPUWorker`，换成张量 | [一次请求的调用链](request-call-chain.md) |
| 算出「第 128 格」这个下标 | [准备输入：从请求到张量](prepare-inputs-flow.md) |
| 进入注意力算子 | [注意力后端家族](attention-backend-family.md) |
| 它每个 token 到底占掉多少字节 | [四种注意力的代价](attention-cost.md) |
| 矩阵乘落到 AI Core | [算子与核函数](ops-and-kernels.md) |
| 一次 RMSNorm 掉到最底下那一层 | [一个算子从 Python 走到 AI Core](op-to-ai-core.md) |

## 这条请求代表不了什么

它是最简单的一条，所以有几件事它看不见 [A]：

- **批不起来。** 它是队列里唯一的请求，看不到多条请求抢 token 预算，也看不到抢占。
- **没有前缀命中。** 第一次问，`get_computed_blocks` 返回 0 [C8]。前缀复用是另一条线。
- **不跨卡。** TP=1，没有 all-reduce，也没有 PP 的跨 rank 收发。
- **不触发 chunked prefill。** 37 比一步的 token 预算小得多，一步就算完了。

需要这四种情形的页会自己说明它在这条请求上加了什么。加什么要写明白，不能换一条请求重讲。
