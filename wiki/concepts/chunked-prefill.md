---
id: chunked-prefill
title: "Chunked Prefill：问题太长，就切成几段分几步算"
type: feature
summary: 一个问题长到一步算不完时，先算这一步装得下的那一段，剩下的留到下一步接着算。它不是一个单独的模式，而是每一步名额分不完时自然留下的余数。
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
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L259-L263
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L293-L338
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
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
    note: 第二段起要对散在别处的前文块做注意力，只有按块表寻址的分页路径做得到
  - to: pd-disaggregation
    kind: alternative-to
    note: 官方 PD 设计文档拿「prefill 插进 decode 造成延迟」当立项理由，两者解决的是同一个 TPOT 问题
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 问题太长，一步装不下怎么办

[那条请求](one-request.md)的问题只有 37 个 token。在昇腾上按默认设置启动服务，每一步最多能算 2048 个 token——这个上限叫这一步的 token 预算，怎么来的见[调度器](vllm-scheduler.md)。37 远小于 2048，第一步就把整个问题算完了。本页讲的这件事，它一次都用不上。

那什么时候用得上？换成[前缀缓存](prefix-caching.md)那一页的用法：还是 Qwen3.6-35B-A3B、两颗昇腾 NPU，你贴进去一份很长的文档，连同固定的开场说明一共 6000 个 token，再问一个 37 个 token 的问题。这是第一次问，前面什么都没算过，一共 **6037 个 token** 要做 prefill（先把问题里所有 token 一起算一遍，把每个 token 的 K 和 V 存进 [KV Cache](kv-cache.md)，存 K、V 的一格格空间叫 KV 块）。

6037 比 2048 大，一步装不下。调度器的做法很朴素：**这一步先给它 2048 个，剩下的下一步接着给，直到给完为止**。这就是 Chunked Prefill（分块预填充）：问题太长，就切成几段，分几步 prefill 完。

它并不是调度器里一个单独的「切块模式」。调度器每一步对每条请求都只问一句「还差多少个 token 没算」，再和这一步剩下的预算比，取小的那个。短问题一次就差完了；长问题差不完，剩下的自然留到下一步。切块只是这道减法减不完时留下的余数。

```wiki-diagram
file: chunked-prefill
```

## 6037 个 token 分三步算完

| 第几步 | 这一步新算几个 token | 算完后一共算了几个 | 注意力要读多少个 token 的 KV | 占着几个 KV 块 |
|---|---|---|---|---|
| 1 | 2048 | 2048 | 2048 | 1 |
| 2 | 2048 | 4096 | 4096 | 2 |
| 3 | 6037 − 4096 = **1941** | 6037 | 6037 | 3 |
| 4 起 | 1（开始吐回答） | 6038 起 | 6038 起 | 3 起 |

从这张表能直接读出三件事：

- **第一个字要等三步。** 6037 除以 2048 向上取整是 3，前两步只是在「读题」，第三步末尾才吐出回答的第一个 token。短问题的第一个字只等一步。
- **每一段正好是一个 KV 块。** 这个模型在两颗 NPU 上一个 KV 块能放 2048 个 token（为什么这么大见[那条请求](one-request.md)），和预算恰好一样大。所以第 1 段写满第 1 块，第 2 段从第 2 块的第一个位置开始写，没有哪一段落在半块上。
- **显存账很好算。** 在每颗 NPU 上，每个 token 的 KV 是 10 KiB。三个块占住 60 MiB，真正装了数据的是 6037 × 10 KiB，约 59 MiB，最后一块尾巴上空着 107 个位置。

第 3 步只用掉 1941 个名额，预算里还剩 107 个。这 107 个名额可以分给其他正在吐字的请求——下面会看到，这件事正是切段的意义所在。

## 后一段接着前一段算，不回头

切成几段听上去像是要把几段结果「拼起来」，其实没有拼这一步。

每一步算完，调度器就把这条请求「已经算了几个」往前加。下一步从这个位置接着往后排：第 2 段的第一个 token 就是整个问题里的第 2049 个，它的 KV 直接写进第 2 块，前面第 1 块里的东西原样不动。

这个模型 40 层里只有 10 层是全注意力，会留下 KV；另外 30 层是线性注意力，不留逐个 token 的 KV，只带着一份固定大小的状态往下走（见[那条请求](one-request.md)）。切段时这 30 层也一样：第 2 段从第 1 段结束时的状态接着算。

还有一个小细节：每一步末尾，机器会给这一批里的每条请求都挑一个「下一个 token」，哪怕这条请求的问题还没读完。没读完的请求挑出来的结果直接扔掉。这样做只是为了代码简单，多算的只是一个 token 位置上的最后一步打分，不是 40 层重走一遍。

## 切开不省计算，只把计算摊平

每一段的新 token 做注意力时，要看的是**它前面的全部内容**，而不只是本段。第 2 段只有 2048 个新 token，却要读 4096 个 token 的 KV；第 3 段只有 1941 个新 token，要读全部 6037 个。

图上每一行都是这个样子：新算的一小段在右边，左边是前面几步已经存好的 KV，本步照样要读一遍。三步读的 KV 加起来是 2048 + 4096 + 6037 = 12181 个 token 的量，不切开时只需要读一次 6037，差不多是两倍。

所以 Chunked Prefill 从来不是省计算的办法。它做的是：**把一次很重的 prefill 拆成几次不那么重的，让每一步的活儿都不超过预算**。

## 它换来的是每一步的时长有了上限

常听到的说法是「开了它，正在吐字的请求就不会被长问题插队」。更准确的说法是：它让**每一步最多算多少个 token 有了上限**。

一步花多少时间，大体看这一步算多少个 token。每一步都不超过 2048，那么别的请求哪怕碰上一份 6037 token 的长文档，每吐一个字要等的时间也有个上限，不会突然卡住一整步去啃完 6037 个 token。

但表里也暴露了默认设置的短板：**前两步这条请求把 2048 个名额全吃光了**，别的请求在这两步里一个名额都拿不到，只能在第 3 步剩下的 107 个里挤。

要让它每一步都给别人留出空位，可以另外设一个「单条请求一步最多拿多少」的上限。设成 1024，这条 6037 token 的请求就分成 6 步（前 5 步各 1024，最后一步 917），每一步都给别人留出至少 1024 个名额。代价是它自己的第一个字要等 6 步。

## 它默认就开着，关掉反而更糟

像 Qwen3.6 这种生成回答的模型，Chunked Prefill 默认就是开着的，你不用写任何参数。

关掉它也不是一个更稳妥的选择。关掉之后，调度器碰到一条这一步装不下的新请求，不会把它切开，而是**这一步干脆不再接新请求**——连排在它后面的短请求也一起等着。为了让最长的请求也能一步装下，启动时就得把每一步的预算开到至少和允许的最长输入一样大；上游还会专门打一条警告，说关掉它可能让引擎崩溃或者算出错的结果。官方教程给这个模型设的最长输入是 262144 个 token，关掉 Chunked Prefill 就意味着一步最多要算 262144 个 token，远比 2048 重。

## 常见误解

- **「Chunked Prefill 是一个要手动打开的优化」**——它默认就开着。能调的是每一步的预算有多大、单条请求一步最多拿多少，而不是「切不切」。
- **「切开之后总计算量变少了」**——正相反。每一段做注意力都要读前面的全部 KV，切成三段就读三次；省下的是「一步里要算多少」，不是总账。
- **「关掉它，正在吐字的请求就不会被 prefill 插队了」**——关掉之后每一步的预算反而要开到最长输入那么大，一步里涌进来的 token 只会更多。真正让 prefill 不挤进 decode 的做法是把两者放到不同机器上，也就是 [PD 分离](pd-disaggregation.md)。

## 对照源码

### 怎么开

- **默认开着。** `SchedulerConfig.enable_chunked_prefill` 字段默认 `True`，docstring 自己说这个默认值主要为测试方便，真正生效的值在 `EngineArgs.create_engine_config` 里定 [C5]；`_set_default_chunked_prefill_and_prefix_caching_args` 在用户没写时取 `model_config.is_chunked_prefill_supported` [C9]，而它对生成类模型只要不是 encoder-decoder 就恒为真 [C10]。Qwen3.6-35B-A3B 是生成类 decoder 模型，所以一直开着。
- **只有一处 `if` 真的读了这个开关。** 上游 `schedule()` 开头的注释说调度器里没有 prefill / decode 阶段，只让每条请求的 `num_computed_tokens` 追上 `num_tokens_with_spec`，并说这套规则「覆盖得了 chunked prefill、前缀缓存、投机解码」[C1]。扫 running 队列那段里根本没有这个开关：减法算完先被 `long_prefill_token_threshold` 截一刀，再无条件 `min(num_new_tokens, token_budget)` [C2]——已经在跑的请求这一步没给够，剩下的只能留到下一步。唯一读它的是扫 waiting 队列那处：`not enable_chunked_prefill and num_new_tokens > token_budget` 时直接 `break`，后面排队的请求一起不排 [C3]。所以这个开关调的不是「切不切」，而是「一条放不下的新请求，要不要干脆别排进来」。
- **表里的数。** 预算 2048 的来历见[调度器](vllm-scheduler.md)（昇腾上 API server 这一档恒为 2048）。三步各取 `min(6037, 2048) = 2048`、`min(3989, 2048) = 2048`、`min(1941, 2048) = 1941` [D]；块数 ⌈2048/2048⌉ = 1、⌈4096/2048⌉ = 2、⌈6037/2048⌉ = 3 [D]；块大小 2048 与每 token 每颗 NPU 10 KiB 取自[那条请求](one-request.md)的已核值（TP=2），三块 3 × 20 MiB = 60 MiB，数据 6037 × 10 KiB ≈ 58.96 MiB，空位 3 × 2048 − 6037 = 107 [D]。模型形状（40 层、10 层全注意力、`max_position_embeddings: 262144`）见官方配置 [S30]。
- **单条上限 `--long-prefill-token-threshold`。** 它是单条请求一步的硬上限，running 与 waiting 两条队列各截一次。写成 1024：⌈6037/1024⌉ = 6 步，5 × 1024 + 917 = 6037 [D]。有两处要当心：一是**文档和代码对不上**，docstring 说它是「prompt 比这个数长就算长请求」的分类阈值，代码里它是直接把 `num_new_tokens` 截断到这个值的一把闸刀 [!]；二是它的自动值走不到，只有 `max_num_partial_prefills > 1` 时才会被设成 `max_model_len × 0.04` [C6]，而 V1 的 `EngineArgs` 一旦发现这两个并发 partial prefill 参数被改过就抛 `NotImplementedError` [C8]，所以**这个阈值只能手写**。
- **混合模型开前缀缓存时还要对齐。** `has_mamba_layers` 且 `mamba_cache_mode == "align"` 时，调度器置 `need_mamba_block_aligned_split` [C28]；`_mamba_block_aligned_split` 在 prefill 阶段把 `num_new_tokens` 向下取整到 `block_size` 的整数倍，理由是要按块缓存 Mamba 状态，最后不足一块的尾巴照常算 [C29]。昇腾上 `align` 与前缀缓存的对应关系见[前缀缓存](prefix-caching.md)。本例预算 2048 恰好等于块大小，三段仍是 2048 / 2048 / 1941 [D]。这段代码的存在也说明线性注意力层的状态是跨段接着传的。
- **`--block-size` 会被改。** 普通注意力模型上，开着 chunked prefill（或[前缀缓存](prefix-caching.md)）时 `refresh_block_size` 会把 `block_size` 静默改成 128，只留一条 info 日志 [C18]；`deepseek_v4` 与混合结构模型走同一函数里更早的特判分支，不受这条影响——本例的 Qwen3.6-35B-A3B 就属于后者，它的块大小 2048 另有算法，见[那条请求](one-request.md)。

### 会报什么错

- **`ValueError`：max_num_batched_tokens 小于 max_model_len。** 关着 chunked prefill 而**显式给的** `max_num_batched_tokens` 小于 `max_model_len` 时，`verify_max_model_len` 直接抛错 [C7]；没显式写时不会报错，`EngineArgs` 会先把预算自动抬到 `max(max_model_len, 默认值)` 再校验。换句话说，**关掉它等于要求预算一口吞得下最长的序列**：照官方教程的 `--max-model-len 262144`（见[那条请求](one-request.md)）又显式写了 2048 的话，就得抬到至少 262144 [D]。
- **warning：This model does not officially support disabling chunked prefill.** 对生成类模型手动关掉时打一次，原文说可能让引擎崩溃或产出错误结果。
- **`NotImplementedError`（Concurrent Partial Prefill）。** 改了 `max_num_partial_prefills` 或 `max_long_partial_prefills` 就抛。

### 开销和什么时候别开

- **被切开的那几步照样采样，结果当场扔掉。** 上游注释直说：因为有 chunked prefill，这一批里会混着还没算完的请求，本来不该从它们身上采样，为了代码简单还是采了，之后把结果忽略 [C13]。忽略的方式是一张 mask——这一步结束时 `seq_len` 仍小于 `num_tokens` 的请求，下标记进 `discard_request_indices`，整批里只有它们的采样结果被丢掉 [C14]。开销是每条请求多取 1 个位置的 logits、多跑一行 lm_head，不是 40 层前向 [D]。
- **注意力对 KV 的读省不掉。** 三步各自声明的 KV 长度是 2048 / 4096 / 6037，合计 12181；不切开只声明一次 6037 [D]。MLA 上摊得更贵，每个 chunk 都要把 context 重过一遍 `kv_b_proj`，见 [MLA](mla.md)。
- **要逐位可复现时得关。** main 的 batch invariance 文档写明：要逐位可复现，必须显式关掉 chunked prefill 和前缀缓存，并同时配 `--block-size 128` [S23]。
- **它不等于 PD 分离。** 官方 PD 设计文档正是拿「没有 PD 分离时 prefill 被插进 decode，带来低效和延迟」当立项理由 [S25]；Chunked Prefill 只是把插进来的量压到每步预算以内。

### 版本差异

核心路径三边一致：扫两条队列那两处减法与 `min(预算)` 逐行相同，`enable_chunked_prefill` 默认仍是 `True`、昇腾上的预算仍是 2048（v0.26 的 `schedule()` 多了一个 `throttle_prefills` 参数，减法本身没动，见[调度器](vllm-scheduler.md)）；`_build_attn_state` 的分支顺序、`_get_fia_params` 里 `ChunkedPrefill` 与 `PrefillCacheHit` 的判据也没动（main 只是把取 KV 视图那几行抽成了独立函数，见[前缀缓存](prefix-caching.md)的差异表）。分叉在外围两处。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 谁会替你打开它 | 设了 `SLO_limits_for_dynamic_batch` 就顺手 `enable_chunked_prefill = True` | 这段连同 `SchedulerDynamicBatch` 整个删掉，选调度器那一段只剩 ProfilingChunk 与 BatchJobAware 两支，没有一处碰这个开关 | 和 v0.26 一样不碰它，改由 `dyntra_lb_config` 选调度器类 | 同一套 SLO 配置，只有 v0.23 会把 chunked prefill 悄悄打开；v0.26 与 main 上它不再有这个副作用 |
| batch invariance 的说明 | 整篇不提 chunked prefill | 也整篇不提 | 多出一节 Scheduling Limitations：要逐位可复现，必须显式关掉 chunked prefill 和前缀缓存，并同时配 `--block-size 128` [S23] | [!] 照 v0.23 或 v0.26 那篇文档配 batch invariance，结果不可复现，而坑到 main 才写明 |

### 源码位置

按上半那张表的一步走下来：

| 这一步发生了什么 | 代码 |
|---|---|
| 算出本步名额：`min(还差多少, 预算)` | 上游 `vllm/v1/core/sched/scheduler.py`，running 分支、waiting 分支 |
| forward 之前就把名额加进 `num_computed_tokens`，并标 `is_prefill_chunk` | 同文件 `_update_after_schedule` |
| 从 `num_computed_tokens_cpu` 起接着排 `positions`，槽位由 position 查[块表](block-table.md)得到；第 2 段第一个 token 的位置是 2048，落在第 2 块第 0 格 [D] | `vllm_ascend/worker/model_runner_v1.py` |
| 判定 `attn_state`：整批都没算过是 `PrefillNoCache`（第 1 步），整批都只有 1 个 token 是 `DecodeOnly`（第 4 步起），剩下的开着 chunked prefill 叫 `ChunkedPrefill`（第 2、3 步），关着叫 `PrefillCacheHit` | 同文件 `_build_attn_state`；枚举在 `attention_v1.py`，五取值的表见 [Prefill](prefill.md) |
| 给算子传参：`PrefillCacheHit` 把 `block_tables` 按 batch_size 切一刀，`ChunkedPrefill` 整张交出去；`actual_seq_lengths_kv` 都取 `seq_lens_list`，即含已算前文的全长 | `vllm_ascend/attention/attention_v1.py`，`_get_fia_params` |
| 调 `npu_fused_infer_attention_score`：`input_layout="TND"`、`actual_seq_lengths`（本步的 Q）、`actual_seq_lengths_kv`（全长）、`block_table` 与 `block_size`——图上「新算的短、要读的长」就是这几个参数 | 同文件 |
| 丢掉没算完请求的采样结果 | `model_runner_v1.py` |

官方设计文档里那个 worked example 画的正是混合批次：第二步是 `{'0': 1, '1': 1, '2': 3}`，两条 decode 和一条 prefill 的第二块同在一次 forward 里 [S21]。
