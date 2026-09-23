---
id: chunked-prefill
title: "Chunked Prefill：切开的是一条请求，填满的是一步的预算"
type: feature
summary: 长 prompt 不一次算完，按这一步的 token 预算切成几块依次做；它在调度器里不是一个模式，是「还差多少」减不完时留下的余数。
aliases: [Chunked Prefill, 分块预填充, 分块 prefill, 切块 prefill, ChunkedPrefill, enable_chunked_prefill, long_prefill_token_threshold, splitfuse]
chapters: ["12"]
order: 20
sources:
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L340-L351
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L403-L410
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L684-L700
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L997-L1013
  - vllm@0fc695fc:vllm/config/scheduler.py#L80-L90
  - vllm@0fc695fc:vllm/config/scheduler.py#L244-L246
  - vllm@0fc695fc:vllm/config/scheduler.py#L259-L271
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2259-L2267
  - vllm@0fc695fc:vllm/engine/arg_utils.py#L2376-L2392
  - vllm@0fc695fc:vllm/config/model.py#L1768-L1811
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1477-L1497
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L907-L916
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1296-L1305
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1123-L1144
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L147-L152
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1174-L1232
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1336-L1357
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1369-L1406
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L712-L718
  - vllm-ascend@baa023ad:vllm_ascend/platform.py#L1254-L1259
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/ModelRunner_prepare_inputs.md#L209-L218
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/Design_Documents/ModelRunner_prepare_inputs.html
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/batch_invariance.md#L184-L188
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/batch_invariance.html
  - vllm-ascend@2c59ff10:docs/source/developer_guide/Design_Documents/disaggregated_prefill.md#L10-L11
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/developer_guide/Design_Documents/disaggregated_prefill.html
  - vllm-ascend@2ed6cbba:vllm_ascend/platform.py#L709-L725
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: vllm-scheduler
    kind: builds-on
    note: 「还差多少 token」减 token 预算那道减法在那一页，这一页只接着讲减不完的那一步会怎样
  - to: prefill
    kind: builds-on
    note: AscendAttentionState 那张五取值的表在那一页，ChunkedPrefill 是其中一格
  - to: paged-attention
    kind: builds-on
    note: 第二块起要对散在别处的前文块做注意力，只有按块表寻址的分页路径做得到
  - to: pd-disaggregation
    kind: alternative-to
    note: 官方 PD 设计文档拿「prefill 插进 decode 造成延迟」当立项理由，两者解决的是同一个 TPOT 问题
contradicts: []
updated: "2026-09-24"
origin: seed
---

## 一句话

长 prompt 不是一次算完的。一条请求在这一步能拿到的名额是 `min(还差多少 token, 这一步的预算)`，**超出的部分留到下一步接着算，这就是 chunked prefill**。它不是一个独立的调度模式，而是那道减法减不完时留下的余数——上游把它和前缀缓存、投机解码一起列在 `schedule()` 开头的注释里，说的正是「同一条规则覆盖得了这几种情形」[C1]。

```wiki-diagram
file: chunked-prefill
```

## 那条请求用不到它

[那条请求](one-request.md)的问题是 37 个 token，而昇腾上 `vllm serve` 不显式指定时这一步的预算条是 2048——离线 `LLM()` 那一档是 8192，这个数怎么来的见[调度器](vllm-scheduler.md)。减法一次就减完，它连一次切分都触发不了。

要看到切分只改一件事：把问题从 37 个 token 换成 5000 个，`--max-model-len` 开到 5500，其余设定（单卡 Qwen3-0.6B、队列里仍然只有它这一条、`block_size` 128、预算 2048）不动 [A]。`enable_chunked_prefill` 不用写在命令行里，理由在下一节。

| 第几步 | 这一步的 `num_new_tokens` | 步末 `num_computed_tokens` | 算子拿到的 Q / KV 长度 | 块表给几个块号 | `attn_state` |
|---|---|---|---|---|---|
| 1 | `min(5000, 2048)` = **2048** | 2048 | 2048 / 2048 | ⌈2048/128⌉ = 16 | `PrefillNoCache` |
| 2 | `min(2952, 2048)` = **2048** | 4096 | 2048 / 4096 | 32 | `ChunkedPrefill` |
| 3 | `min(904, 2048)` = **904** | 5000 | 904 / 5000 | ⌈5000/128⌉ = 40 | `ChunkedPrefill` |
| 4 起 | 1 | 5001 起 | 1 / 5001 | 40 | `DecodeOnly` |

第一个字要等 ⌈5000 / 2048⌉ = **3 次 forward**，而不是 1 次。占的块是 40 个 × 14 MiB = 560 MiB，真正装了东西的是 5000 × 112 KiB = 546.9 MiB，差出来的 13.1 MiB 是最后一块尾巴上那 120 个空槽（每 token 112 KiB 的来历在[那条请求](one-request.md)）。顺带注意一件事：2048 正好是 `block_size` 128 的 16 倍，所以前两刀都切在块边界上，不会出现「半块」[D]。

## 只有一处 `if` 真的读了 `enable_chunked_prefill`

**扫 running 队列那一段里根本没有这个开关。** 减法算完先被 `long_prefill_token_threshold` 截一刀，再无条件 `min(num_new_tokens, token_budget)` [C2]——已经在跑的请求，只要这一步没给够，剩下的就是留到下一步，没有别的选择。

唯一读它的是扫 waiting 队列那一处：`not enable_chunked_prefill and num_new_tokens > token_budget` 时直接 `break`，连后面排队的请求一起不排了 [C3]。所以这个开关调的不是「切不切」，而是「一条放不下的新请求，要不要干脆别排进来」。

它默认是开的。`SchedulerConfig` 里字段默认 `True`，真正生效的值由 `EngineArgs` 按模型算：`is_chunked_prefill_supported` 对生成类模型只要不是 encoder-decoder 就恒为真 [C10]。**在昇腾上跑 Qwen3 这类模型，它一直开着，你没写过任何相关参数。**

手动关掉它也不是一个中性的保守选项，有两道拦：上游会对生成类模型打一条 warning，说这么做可能让引擎崩溃或产出错误结果 [C9]；配置校验更硬——关着它而**显式给的** `max_num_batched_tokens` 小于 `max_model_len` 直接 `ValueError` [C7]；没显式写时不会报错，`EngineArgs` 会先把预算条自动抬到 `max(max_model_len, 默认值)` 再校验。换句话说，**关掉它等于要求预算条一口吞得下最长的序列**：上面那套设定里显式写过 2048 的话，就得抬到至少 5500 [D]。

## 被切开的那几步照样采了样，结果当场扔掉

KV 是一路往后写的，没有任何「把上一块接起来」的代码。`_update_after_schedule` 在 forward 之前就把这一步的名额加进了 `num_computed_tokens`，昇腾侧再拿 `num_computed_tokens_cpu` 加上本步序号算出 `positions` [C12]，槽位由 position 查[块表](block-table.md)得到。第 2 块 chunk 的第一个 token 位置是 2048，正好落在第 17 个块的第 0 格。

但模型运行器不会因为「这条请求还没算完」少做一件事。上游的注释说得很直白：因为有 chunked prefill，这一批里会混着还没算完的请求，**本来不该从它们身上采样，为了代码简单还是采了，之后把结果忽略掉** [C13]。忽略的方式是一张 mask——这一步结束时 `seq_len` 仍小于 `num_tokens` 的请求，下标被记进 `discard_request_indices`，整批里只有它们的采样结果被丢掉 [C14]。

这笔开销很小：每条请求只取 1 个位置的 logits，多跑的是一行 lm_head，不是 28 层前向 [D]。真正的代价在上一节那张表里——三次 forward 才出第一个字。

## `ChunkedPrefill` 和 `PrefillCacheHit` 是同一条路，差一个开关

`_build_attn_state` 的分支顺序很说明问题：排掉「整批都没算过」和「整批都只有 1 个 token」这两种之后，剩下的情形开着 chunked prefill 就叫 `ChunkedPrefill`，关着就叫 `PrefillCacheHit` [C11]。枚举表上它们是两格（表在 [Prefill](prefill.md)），代码里指的是同一类批次。

到了算子入参，两条分支的差别只剩一行：`PrefillCacheHit` 把 `block_tables` 按 batch_size 切一刀，`ChunkedPrefill` 整张交出去；`actual_seq_lengths_kv` 都取 `seq_lens_list`，也就是**含已算过前文的完整长度** [C16]。最后传进 `npu_fused_infer_attention_score` 的是 `input_layout="TND"`、`actual_seq_lengths`（本步的 Q）、`actual_seq_lengths_kv`（全长）、外加 `block_table` 与 `block_size` [C17]。图上那一格「短 Q、长 KV」就是这几个参数。

所以切开省不掉注意力对 KV 的读：三步各自声明的 KV 长度是 2048 / 4096 / 5000，不切开只声明一次 5000 [D]。**chunked prefill 不省计算，它只把计算摊平。** MLA 上摊得更贵，每个 chunk 都要把 context 重过一遍 `kv_b_proj`，见 [MLA](mla.md)。

## 它压住的不是插队，是单步耗时的上界

常听到的说法是「开了它，decode 就不会被长 prefill 插队」。更准确的说法是：它让**每一步进 forward 的 token 数有了上界**。关着它时校验逼你把预算条开到 ≥ `max_model_len`，一步能涌进来的 token 只多不少；开着它，预算条可以只留 2048，于是正在 decode 的那些请求每一步要等的时间也有了上界 [D]。

但上面那张表也暴露了默认设置的短板：**被切开的请求会连着两步把预算吃光**，别人的 decode 只能在第 3 步剩下的 1144 个名额里挤进去。要让它每一步都留空位，得自己写 `--long-prefill-token-threshold`——它是单条请求一步的硬上限，两条队列各截一次。写成 1024，那条 5000 token 的请求就变成 ⌈5000/1024⌉ = 5 步，每步给它 1024、给别人留 1024 [D]。官方文档里那个 worked example 画的正是这种批次：第二步是 `{'0': 1, '1': 1, '2': 3}`，两条 decode 和一条 prefill 的第二块同在一次 forward 里 [S21]。

这个参数有两处要当心。一是**文档和代码对不上**：docstring 说它是「prompt 比这个数长就算长请求」的分类阈值 [C5]，代码里它是直接把 `num_new_tokens` 截断到这个值的一把闸刀 [!]。二是它的自动值走不到：只有 `max_num_partial_prefills > 1` 时才会被设成 `max_model_len × 0.04` [C6]，而 V1 的 `EngineArgs` 一旦发现这两个并发 partial prefill 参数被改过就抛 `NotImplementedError`，所以**这个阈值只能手写** [C8]。

## v0.23、v0.26 与 main 的差异

核心路径三边一致：扫两条队列那两处减法与 `min(预算)` 逐行相同，`enable_chunked_prefill` 默认仍是 `True`、昇腾上的预算条仍是 2048（v0.26 的 `schedule()` 多了一个 `throttle_prefills` 参数，减法本身没动，见[调度器](vllm-scheduler.md)）；`_build_attn_state` 的分支顺序、`_get_fia_params` 里 `ChunkedPrefill` 与 `PrefillCacheHit` 的判据也没动（main 只是把取 KV 视图那几行抽成了独立函数，见[前缀缓存](prefix-caching.md)的差异表）。分叉在外围两处。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 谁会替你打开它 | 设了 `SLO_limits_for_dynamic_batch` 就顺手 `enable_chunked_prefill = True` [C19] | 这段连同 `SchedulerDynamicBatch` 整个删掉，选调度器那一段只剩 ProfilingChunk 与 BatchJobAware 两支，没有一处碰这个开关 [C27] | 和 v0.26 一样不碰它，改由 `dyntra_lb_config` 选调度器类 | 同一套 SLO 配置，只有 v0.23 会把 chunked prefill 悄悄打开；v0.26 与 main 上它不再有这个副作用 |
| batch invariance 的说明 | 整篇不提 chunked prefill | 也整篇不提 | 多出一节 Scheduling Limitations：要逐位可复现，必须显式关掉 chunked prefill 和前缀缓存，并同时配 `--block-size 128` [S23] | [!] 照 v0.23 或 v0.26 那篇文档配 batch invariance，结果不可复现，而坑到 main 才写明 |

## 常见误解

- **「chunked prefill 是一个要手动打开的优化」**——生成类模型上它默认就开着；配置项调的是预算条有多长、单条一步最多给多少，不是「要不要切」。反过来手动关掉，上游会警告可能崩溃或输出错误。
- **「切开之后总计算量变少了」**——正相反。每一步声明的 KV 长度都是含前文的全长，切成三步就是三次全长声明；省下的是「一步之内塞多少 token」，不是总账。
- **「关掉它，decode 就不会被 prefill 插队了」**——关掉之后预算条反而 ≥ `max_model_len`（不写自动抬上去，显式写小了直接报错），一步涌进来的 token 只会更多。真正让 prefill 不插进 decode 的做法是 [PD 分离](pd-disaggregation.md)，官方设计文档正是拿「没有 PD 分离时 prefill 被插进 decode，带来低效和延迟」当立项理由 [S25]。
- **「`--block-size 64` 配 chunked prefill 能省点显存」**——普通注意力模型上，开着它（或[前缀缓存](prefix-caching.md)）时 `refresh_block_size` 会把 `block_size` 静默改成 128，只留一条 info 日志 [C18]；`deepseek_v4` 与混合结构模型走同一函数里更早的特判分支，64 反而会保留。
