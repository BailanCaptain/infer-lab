---
id: speculative-decoding
title: "投机解码：先猜几个 token，一步验完"
type: feature
summary: decode 一步只吐一个 token，却要把全部权重读一遍。投机解码先猜几个 token，让模型一步把它们一起验完，猜对几个就多出几个，第一个猜错的地方换成模型自己的答案，后面的作废。
aliases: [Speculative Decoding, 投机解码, 推测解码, 投机采样, spec decode, MTP, Multi-Token Prediction, 草稿模型, num_speculative_tokens, 拒绝采样]
chapters: ["17"]
order: 30
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/spec_decode/__init__.py#L34-L55
  - vllm-ascend@baa023ad:vllm_ascend/spec_decode/__init__.py#L41-L70
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1525-L1543
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1664-L1683
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L2457-L2500
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L907-L916
  - vllm-ascend@2c59ff10:vllm_ascend/worker/block_table.py#L148-L179
  - vllm-ascend@2c59ff10:vllm_ascend/sample/rejection_sampler.py#L928-L979
  - vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L794-L801
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L217-L265
  - vllm-ascend@2c59ff10:vllm_ascend/spec_decode/llm_base_proposer.py#L284-L294
  - vllm-ascend@2c59ff10:vllm_ascend/spec_decode/llm_base_proposer.py#L1201-L1219
  - vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L735-L764
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L212-L226
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L519-L535
  - vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1414-L1431
  - vllm@0fc695fc:vllm/v1/core/kv_cache_manager.py#L311-L317
  - vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L810-L814
  - vllm@0fc695fc:vllm/config/compilation.py#L1473-L1518
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/speculative_decoding.md#L3-L24
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/speculative_decoding.md#L62-L63
  - vllm-ascend@2c59ff10:docs/source/user_guide/feature_guide/speculative_decoding.md#L147-L150
  - vllm-ascend@baa023ad:docs/source/user_guide/feature_guide/speculative_decoding.md#L63-L64
  - vllm-ascend@baa023ad:vllm_ascend/spec_decode/llm_base_proposer.py#L424-L446
  - vllm-ascend@baa023ad:vllm_ascend/ascend_config.py#L1111-L1136
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/speculative_decoding.html
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/speculative_decoding.html
  - vllm-ascend@2ed6cbba:vllm_ascend/spec_decode/__init__.py#L35-L58
  - vllm-ascend@2ed6cbba:vllm_ascend/spec_decode/llm_base_proposer.py#L505-L521
  - vllm@568afb3a:vllm/v1/core/sched/scheduler.py#L237-L263
  - vllm-ascend@2ed6cbba:docs/source/user_guide/feature_guide/speculative_decoding.md#L62-L63
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L266-L266
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L390-L390
  - vllm@0fc695fc:vllm/config/speculative.py#L550-L565
  - vllm@0fc695fc:vllm/config/speculative.py#L713-L726
  - vllm@0fc695fc:vllm/config/speculative.py#L460-L469
  - vllm-ascend@2c59ff10:vllm_ascend/ops/gdn_attn_builder.py#L642-L646
  - vllm-ascend@2c59ff10:vllm_ascend/ops/gdn_attn_builder.py#L427-L431
  - vllm-ascend@2c59ff10:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L357-L365
  - vllm-ascend@2ed6cbba:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L251-L251
  - vllm-ascend@baa023ad:docs/source/tutorials/models/Qwen3.6-35B-A3B.md#L254-L254
  - vllm@568afb3a:vllm/config/speculative.py#L686-L700
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: npu-model-runner
    kind: builds-on
    note: 验证这一步的草稿、提议下一步的草稿，都长在 execute_model 的同一次调用里，那一页讲这个文件怎么读
  - to: vllm-scheduler
    kind: builds-on
    note: 草稿 token 靠 num_tokens_with_spec 混进那道减法，token 预算不够时最先被砍掉的也是它们
  - to: graph-mode-layer
    kind: builds-on
    note: 开了它 uniform_decode_query_len 从 1 变成 K+1，FULL decode 图的捕获尺寸要跟着取整
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 草稿位要的额外槽位由 allocate_slots 的 num_lookahead_tokens 预留，被拒之后块不释放
  - to: paged-attention
    kind: conflicts-with
    note: using_paged_attention 的第一道门就是「开了投机解码直接返回 False」，PA 算子在投机解码下永远不执行
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一步只吐一个 token，为什么这么慢

[贯穿全库的那条请求](one-request.md)要回答 200 个 token。decode 阶段一步只产出 1 个 token，所以要走 200 步；而每一步，机器都得把这个模型的全部[权重](matmul-and-weights.md)从显存里搬一遍，只为算出这一个 token。decode 慢，主要慢在搬权重上，算本身很快就完了。

那么问题来了：**既然权重都搬进来了，能不能一步多算几个位置、多出几个 token？**

难处在于 token 是一个接一个出来的——第 2 个 token 要等第 1 个定下来才能算。投机解码的办法是：**先找个便宜的办法猜出后面几个 token（叫草稿 token），把「已确定的那个 + 这几个草稿」一起送进模型，一步算完**；模型在每个位置都给出自己的答案，拿来和草稿逐个比对。猜对几个，这一步就多出几个；第一个猜错的地方换成模型自己的答案，后面的草稿全扔掉。

几个位置读的是同一份权重，所以多算几个位置几乎不增加搬运，多出来的 token 近乎白拿。

## 一步验 4 个位置：猜 3 个的例子

拿那条请求来说，假设每步猜 3 个（下文把「每步猜几个」记作 K，这里 K = 3）。一步里送进模型的就是 4 个位置：1 个已确定的 token，加 3 个草稿。

```wiki-diagram
file: speculative-decoding
```

模型在每个位置上算出「下一个该是什么」，从左往右和草稿对：

- 第 1 个位置的答案和猜 1 一样，留下；
- 第 2 个位置的答案和猜 2 一样，留下；
- 第 3 个位置的答案和猜 3 不一样——**写进输出的是模型自己的答案**，猜 3 作废；
- 第 4 个位置本来能再白送一个 token，但前面已经断了，它也作废。

这一步出了 3 个 token。换一种运气：

| 这一步的情况 | 出几个 token |
|---|---|
| 3 个草稿全对 | 4 个（3 个草稿 + 第 4 个位置白送的那个） |
| 一个都不对 | 1 个（第 1 个位置上模型自己的答案） |

所以 200 个 token 的回答，最好 50 步走完，最差还是 200 步——**最差也不会比不开慢**，因为每步至少出 1 个 token，只是白算了几个位置。

## 草稿从哪来：这个模型自带一层 MTP

猜的办法有好几种：

- **从已有文字里找重复**：看前文有没有出现过同样的几个词，照着接下去。不用额外的模型，但只在回答大量复述原文时猜得中。
- **另配一个小的草稿模型**：小模型跑得快，先跑几步给出草稿。
- **MTP**（多 token 预测）：模型训练时就多带了几层「往后多猜几个 token」的预测层，推理时直接拿它当草稿。

Qwen3.6-35B-A3B 属于最后一种：官方配置里写着它除了 40 层主干，还带 **1 层** MTP 预测层。开 MTP 时不用另外指定草稿模型，vLLM 直接从同一个模型里把这一层加载出来。

这层预测层吃的是主干刚算出来的中间结果，所以它不是跑在模型前面，而是**挂在这一步的尾巴上**：模型先验完这一步的草稿，再顺手用这层猜出下一步要验的草稿。

只有 1 层却要猜 3 个，就只能把这一层**连着跑 3 遍**，每一遍的输出当下一遍的输入。vLLM 对此会给一条提醒：同一层反复跑，越往后猜得越不准。官方教程里两种配法都有：调优表里给的是猜 3 个，另一处则建议只猜 1 个。

## 猜错的位置留下的笔记怎么办

这个模型 40 层里有 10 层是全注意力，每个 token 在这 10 层都要留一份笔记（KV Cache）。一步送进去 4 个位置，4 个位置的笔记**全都写了**——它们是真进了模型的 token。

猜错的那几格没人去擦。系统只是把「已经算到第几个 token」往回退；下一步重新从这个位置往后写，写的正好是同一批格子，旧内容被直接盖掉。所以「回收猜错 token 的笔记」这件事根本不存在，它就是一次普通的覆盖写。被猜错的草稿也不会进[前缀缓存](prefix-caching.md)——只有核对过的 token 才会被记下来。

MTP 那一层自己也要留笔记，所以开了 MTP 后，每条请求会为草稿多预留 K 个位置。只靠文字匹配猜的办法没有模型，也就不用多留。

剩下 30 层是[线性注意力](linear-attention.md)，它们不留逐 token 的笔记，只留一份不断往前推的状态。被猜错的 token 推过的状态不能直接接着用，于是代码给每条请求在这些层准备了 K + 1 份状态的位置，并把「上一步留下了几个」一起传进去。

## 猜错了不亏：输出和不开时一样

最常被略过的一点：**第一个对不上的位置，写进去的是模型自己的答案**。这个 token 恰好就是不开投机解码时这一步本该产出的那个。所以只要按「每步取最可能的那个 token」的方式生成，开不开投机解码，输出一字不差——草稿只决定「一次能写几个」，决定写什么的永远是模型本身。

昇腾额外提供了两种改变比对规则的做法：一种按一整段草稿的累积概率整块判，另一种按模型对当前位置有多拿不准来调门槛。两种默认都关着。

## 它和别的机制互相卡着

- **token 预算**：草稿 token 占的是普通名额。[调度器](vllm-scheduler.md)先定这一步给这条请求几个名额，放不下时砍掉的是草稿，而不是把整条请求推到下一步。
- **图模式**：开了投机解码，一条请求一步固定算 K + 1 = 4 个位置，所以[图模式](graph-mode-layer.md)预先录好的批大小要是 4 的整数倍；系统会自动向上凑整。
- **一步最多 16 个位置**：昇腾的注意力算子一轮最多处理 16 个 token，所以 K + 1 不能超过 16。
- **PagedAttention 算子**：开了投机解码，就不会走 [PagedAttention](paged-attention.md) 那个算子。
- **并发高了收益会缩水**：投机解码赚的是「搬一次权重多出几个 token」。并发请求一多，一步本来就在算很多个位置，权重搬运已经被分摊掉了，再多猜几个的收益就小了。官方教程的低延迟配置默认关掉投机解码，较新版本的教程还直接建议：同时不到两个请求时才开 MTP。

## 常见误解

- **「被拒绝的草稿等于白算了」**——不全是。第一个不匹配位置上写下的，正是不开投机解码时这一步也会产出的那个 token；真正浪费掉的只是它**后面**那些位置的计算和笔记写入。
- **「投机解码会让输出变差」**——按「每步取最可能 token」生成时它是无损的：写进输出的永远是模型自己的答案。会动比对规则的是昇腾额外提供的两种判法，而它们默认都关着。
- **「MTP 是一套独立的实现」**——在 v0.23 和 v0.26 上，MTP 和另一种叫 Eagle 的草稿方法走的是同一套代码；到 main 才为个别模型分出专门的实现。
- **「草稿先跑，模型后跑」**——一步之内顺序是反的：草稿挂在这一步的尾巴上，用的是模型这一次刚算出来的中间结果，产出的是下一步要验的草稿。

## 对照源码

### 怎么开

那条请求默认没开投机解码：没给 `--speculative-config` 时 `self.drafter` 是 None，`propose_draft_token_ids` 第一条分支就把草稿置空 [C4]，`scheduled_spec_decode_tokens` 永远是空字典，整条验证路径一次都不进。

要给 Qwen3.6-35B-A3B 开 MTP，官方教程调优表里的写法是 [S34]：

```bash
--speculative-config '{"method": "qwen3_5_mtp", "num_speculative_tokens": 3, "enforce_eager": true}'
```

- 同一份教程的 Atlas 300I DUO 一节给的是 `'{"method": "mtp", "num_speculative_tokens": 1}'`，并建议 `num_speculative_tokens` 取 1 [S33]。两处都挂在 W8A8 [量化](quantization.md)权重（`--quantization ascend`）的命令下；本页其余数字仍按那条请求的 bf16 权重算。
- `qwen3_5_mtp` 这个方法名会被改写成 `mtp`，并打一条 `method ... is deprecated and replaced with mtp` 警告 [C35]。
- `method` 为 `mtp` 且没给 `model` 时，草稿模型直接取目标模型自己的路径（`# use the draft model from the same model`）。
- 「这个模型带 MTP 层」的依据：HF 配置 `text_config.mtp_num_hidden_layers: 1` [S32]；上游对 `qwen3_5` / `qwen3_5_moe` 配置把 `mtp_num_hidden_layers` 读成草稿的 `n_predict`，架构名换成 `Qwen3_5MoeMTP` / `Qwen3_5MTP` [C37]。
- 本页例子取 K = 3，对应的数：

| 本页的东西 | K = 3 时是多少 |
|---|---|
| 一步排几个 token | 4 = 1 个已确定 + 3 个草稿 |
| `uniform_decode_query_len` | 1 + 3 = **4** |
| 注意力的 `decode_threshold` | 4，硬上限 16 [C10] |
| 200 个 token 要几步 | 全命中 ⌈200 / 4⌉ = **50 步**；一个不中 **200 步** [D] |
| 目标模型每步写几个 KV 槽 | 4 个，每颗 NPU `4 × 10 KiB = 40 KiB`（10 层全注意力 × 每层 1 KiB，见 [one-request](one-request.md)）[D] |
| 草稿侧额外预留（`num_lookahead_tokens`） | K = 3（`mtp` 这一档）[C14] |

- 改变判据的开关：`enable_block_verify` 改成按累积概率整块判、`enable_entropy_verify` 按目标分布的熵调阈值，两个默认都是 `False`，`posterior_threshold` 默认 0.95、`posterior_alpha` 默认 0.4 [C9]。

### 会报什么错

- `AscendAttentionMetadataBuilder` 里 `decode_threshold = 1 + K`，紧跟 `assert decode_threshold <= 16`，理由写在报错串里——FIA 的 TND 布局一轮最多 16 个 token。
- FULL decode 图下，上游把 `cudagraph_capture_sizes` 里每个尺寸**向上取整到 K+1 的倍数**，取整后一个都不剩就直接报错 [C19]。官方 EAGLE 教程要求手写成 `n × (K + 1)`，其实代码会替你圆上去。
- `disable_padded_drafter_batch` 和 FULL 图同时开，proposer 构造函数直接抛 `NotImplementedError`。
- 不报错但会警告：`num_speculative_tokens > 1` 且草稿是 MTP（`step3p5_mtp` 除外）时，上游打 `Enabling num_speculative_tokens > 1 will run multiple times of forward on same MTP layer,which may result in lower acceptance rate` [C36]。Qwen3.6 只有 1 层 MTP，K = 3 会触发这条。

### 开销和什么时候别开

- **草稿本身的耗时**：Eagle / MTP 这类自回归草稿器在一步末尾**串行**跑 `num_speculative_tokens - 1` 次额外前向，第 i 次的输出当第 i+1 次的输入 [C12]——K 越大这段越长，会把收益吃回去一部分。
- **访存收益的前提**：decode 卡在把权重从 HBM 搬进来上 [S20]，K+1 个位置读同一份权重才近乎白拿；并发上来后这笔收益被批次本身分摊。Qwen3.6 教程的低延迟场景默认关投机解码 [S40]；v0.26 与 main 的教程加了一句「同时不到两个请求时建议开 MTP，否则不建议」[S41][S42]。
- **token 预算**：调度器先定 `num_new_tokens`，再倒推这一步放得下几个草稿；放不下时 `spec_token_ids` 被**截断**，而不是把整条请求推到下一步 [C15]。
- **ngram 的现实**：ngram 不跑模型、不占额外 KV，但它匹配的是已有文本里重复出现的 n-gram；那条请求 37 个 token 的问题加一段不重复的回答里没什么可匹配的，匹配不到就提议 0 个 token，这一步退回普通 decode [I]。

### 版本差异

下表 main 指 2026-09-21 的源码快照 `baa023ad`，v0.26 分支指 `2ed6cbba`，v0.23 维护分支指 `2c59ff10`；完整提交号在来源里。核心那条「排 K+1 个位置 → 第一个不符截断 → 槽位原地覆盖」三版一字不差，`assert decode_threshold <= 16` 也一样。上游把 `*_mtp` 改写成 `mtp`、MTP 草稿取目标模型路径这两段，v0.26 配套的上游里仍在 [C43]。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 文档写的 K 上限 | 文档说 `(K+1)` 必须 ≤ 15 [S21]，代码 `assert <= 16` | 文档已改成 ≤ 16 [S31]，与代码一致 | 同 v0.26 | `[!]` 照 v0.23 文档配会白白少用一个草稿位；以代码为准 |
| 草稿方法 | 九个 proposer 类，`mtp` 与 `eagle` 共用 `AscendEagleProposer` | 多出 `dspark` 一个，其余分流逐字同 v0.23 | 再多出三处分流：`dflash` 按草稿权重分流到 `AscendDflash2Proposer`，Gemma4 的 MTP 单走一个 proposer，`mtp` 碰上多 KV cache group 时走 `AscendMultiKVCacheGroupMTPProposer` | 同一个 `method` 字符串在三版可能落到不同的类上 |
| `num_lookahead_tokens` 档表 | eagle / eagle3 / mtp / draft_model 是 K，dflash 是 K+1，ngram 和 suffix 是 0 | 多一行 `dspark`，也是 K [C30] | 未单独核 | — |
| 草稿侧滑动窗口 | 没有这个东西 | 有：`draft_window_size` 直接从 `additional_config` 读，只裁草稿模型的注意力；**没有任何方法级检查** [C29] | 搬进 `AscendConfig`，并对 `mtp` 打警告说窗口被忽略、对 DeepSeek-V4 上的 `dspark` 提示会掉接受率 [C24] | `[!]` v0.26 上给 `mtp` 配 `draft_window_size` 既不报错也不警告，而 MTP 复用的是目标模型自己的层——窗口会连目标模型一起裁掉 |
| K 能不能动 | 只有固定的 `num_speculative_tokens` | 昇腾侧仍没有；但上游多了 `num_speculative_tokens_per_batch_size`，按 batch size 区间查一张表决定这一步猜几个 | 昇腾侧的 `dynamic_spec_config` 按草稿置信度调每条请求的验证长度，目前只认 `dspark` 和 `dflash` [C25] | 并发上来时 v0.26 能按批大小、main 能按置信度缩短验证长度，v0.23 只能重启改参数 |
| Qwen3.6 教程对 MTP 的建议 | 只写「建议 `num_speculative_tokens` 取 1」[S33] | 加上「并发不到 2 才建议开」[S41] | 同 v0.26 [S42] | 按 v0.23 教程读不到并发这条限制 |

### 源码位置

**一步的顺序**（都在 `NPUModelRunner.execute_model` 的同一次调用里）：

1. **排队**——调度器把上一步产出的 K 个草稿当普通 token 排进这一步，`_calc_spec_decode_metadata` 把它们摊成三组下标：`logits_indices`（K+1 个）、`target_logits_indices`（K 个，拿去和草稿比）、`bonus_logits_indices`（1 个，最后那个位置）[C3]。
2. **验证**——`_sample` 带着这一步的 logits 和 `spec_decode_metadata` 一起被调用，走拒绝采样那一路。
3. **提议**——`_bookkeeping_sync` 跑完之后才轮到 `propose_draft_token_ids`，产出**下一步**要验的草稿。v0.26 给 PP 开了一条例外：PP 投机解码 + 同步调度 + padded batch 时提前到 `_bookkeeping_sync` 之前提议，其余情形顺序照旧。

**接受规则**：上游贪心路径逐位写目标模型的 `argmax`，某位草稿与 `argmax` 不等就置 `rejected`、后面不再写，全等才补 bonus token。昇腾在 `rejection_greedy_sample_pytorch` 里用张量算子重写了一份：先求每条请求的 first mismatch，`copy_len = min(first_mismatch + 1, num_drafts)` 决定抄几个，`needs_bonus = first_mismatch >= num_drafts` 决定补不补 bonus，语义与上游逐行对应。「每步至少 1 个、最多 K+1 个」由此推出 [D]。

**被拒位置的 KV**：调度器 `num_computed_tokens -= num_rejected`；下一步 position 是 `num_computed_tokens + arange`，slot 由 position 查[块表](block-table.md)得到，所以写的是同一批物理槽 [D]。`allocate_slots` 注释写明新 token 里只有已验证的部分会被缓存（按 `request.num_tokens` 封顶）[C17]。

**线性注意力层的状态**：昇腾的 GDN 元数据构建器在投机解码时取块表前 `num_spec + 1` 列作 `spec_state_indices_tensor`，并要求传入 `num_accepted_tokens`，缺了抛 `RuntimeError("Expected num_accepted_tokens for Ascend GDN speculative conv1d path.")`。「被猜错的 token 推过的状态不能直接接着用」是由此得出的解释 [I]；这 K+1 份状态位置对显存的影响本页没算。

**MTP 配置解析**：方法名归一、K > 1 警告、`mtp_num_hidden_layers` → `n_predict`，都在上游 `vllm/config/speculative.py`。

**PagedAttention 互斥**：`using_paged_attention` 的第一道门就是「`speculative_config` 非 None 直接返回 False」，细节在 [PagedAttention](paged-attention.md)。
