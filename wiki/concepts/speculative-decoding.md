---
id: speculative-decoding
title: "Speculative Decoding：一步算 K+1 个位置，第一个对不上的地方截断"
type: feature
summary: 先让一个便宜的草稿器猜 K 个 token，目标模型在同一次 forward 里给这 K+1 个位置各出一个分布，逐位比对，接受多少算多少。
aliases: [Speculative Decoding, 投机解码, 推测解码, 投机采样, spec decode, MTP, Multi-Token Prediction, 草稿模型, num_speculative_tokens, 拒绝采样]
chapters: ["17"]
order: 30
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/spec_decode/__init__.py#L34-L55
  - vllm-ascend@b255ab59:vllm_ascend/spec_decode/__init__.py#L37-L64
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
  - vllm-ascend@b255ab59:docs/source/user_guide/feature_guide/speculative_decoding.md#L63-L64
  - vllm-ascend@b255ab59:vllm_ascend/spec_decode/llm_base_proposer.py#L414-L436
  - vllm-ascend@b255ab59:vllm_ascend/ascend_config.py#L1107-L1132
  - https://docs.vllm.ai/projects/ascend/en/v0.23.0/user_guide/feature_guide/speculative_decoding.html
  - https://docs.vllm.ai/projects/ascend/en/latest/user_guide/feature_guide/speculative_decoding.html
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
updated: "2026-09-20"
origin: seed
---

## 一句话

投机解码把一步 decode 从「算 1 个位置」变成「算 K+1 个位置」：一个便宜的草稿器先猜 K 个 token，目标模型在**同一次 forward** 里为这 K+1 个位置各出一个分布，再逐位比对——**第一个对不上的位置就截断，后面的草稿全扔掉**。它赚的是访存：decode 本来卡在把权重从 HBM 搬进来上 [S20]，K+1 个位置读的是同一份权重，多出来的 token 近乎白拿。

```wiki-diagram
file: speculative-decoding
```

## 那条请求用不到它

[那条请求](one-request.md)没给 `--speculative-config`，`self.drafter` 是 None，`propose_draft_token_ids` 第一条分支就把草稿置空 [C4]；于是 `scheduled_spec_decode_tokens` 永远是空字典，整条验证路径一次都不进。

要走到这里不用换卡也不用换模型——ngram 这条路既不加载草稿模型、也不额外占 KV，加一段配置就行 [A]：

```bash
vllm serve /path/to/Qwen3-0.6B \
    --max-model-len 5500 \
    --speculative-config '{"method":"ngram","num_speculative_tokens":3,"prompt_lookup_max":4}'
```

`method` 取 `ngram`，因为 n-gram 匹配不跑草稿模型、也不占额外 KV（理由见下面 `num_lookahead_tokens` 那一段）；`num_speculative_tokens` 取 3，是想让 K+1 正好等于 4；`prompt_lookup_max` 用官方 ngram 示例里的 4。改完之后这条请求上的数是：

| 这一页的东西 | 那条请求（K=3）上是多少 |
|---|---|
| 一步排几个 token | 4 = 1 个已确定 + 3 个草稿，2048 的预算绰绰有余 |
| `uniform_decode_query_len` | 1 + 3 = **4** [C18] |
| 注意力的 `decode_threshold` | 4，硬上限 16 |
| 200 个 token 要几步 | 全命中 ⌈200 / 4⌉ = **50 步**；一个都不中还是 **200 步** [D] |
| 每步写几个 KV 槽 | 4 个，被拒的那几格下一步原地覆盖 |
| 额外预留几个块 | 0——ngram 不跑草稿模型，不要 lookahead 槽位 |

但要诚实说一句：**这条请求上 ngram 大概率一个都猜不中**。它匹配的是已有文本里重复出现的 n-gram，37 个 token 的问题加一段不重复的回答里没什么可匹配的；匹配不到就提议 0 个 token，这一步退回普通 decode [I]。想看到真实接受率得换成 MTP、Eagle 这类带草稿模型的方法，而 Qwen3-0.6B 没有 MTP 头。

## 提议、验证、再提议，都在同一次 `execute_model` 里

一步的顺序是写死的三段 [C5]：

1. **排队**——调度器把上一步产出的 K 个草稿当普通 token 排进这一步，`_calc_spec_decode_metadata` 把它们摊成三组下标：`logits_indices`（K+1 个，要取哪些位置的 logits）、`target_logits_indices`（K 个，拿去和草稿比）、`bonus_logits_indices`（1 个，最后那个位置）[C3]。
2. **验证**——`_sample` 带着这一步的 logits 和 `spec_decode_metadata` 一起被调用，走的是拒绝采样那一路，不是普通采样。
3. **提议**——`_bookkeeping_sync` 跑完之后才轮到 `propose_draft_token_ids`，它产出的是**下一步**要验的草稿。

所以「草稿模型跑在目标模型前面」这个直觉在代码里是反的：草稿器挂在 `execute_model` 的尾巴上，吃的正是目标模型这一次算出来的 hidden states。Eagle / MTP 这类自回归草稿器还要在这一段里**串行**跑 `num_speculative_tokens - 1` 次额外前向，第 i 次的输出当第 i+1 次的输入 [C12]——K 越大，这段串行就越长，草稿本身的耗时会把收益吃回去一部分。

## 接受多少：第一个对不上就截断，但下界是 1 不是 0

贪心路径的规则只有三句 [C13]：逐位把目标模型的 `argmax` 写进输出；一旦某位的草稿 token 和 `argmax` 不等就把 `rejected` 置真、后面的位置不再写；**全部相等时才把 bonus token 补在末尾**。

关键的一点常被略过：**写进第一个不匹配位置的是目标模型自己的 `argmax`，不是草稿**。那个 token 本来就是这一步该产出的那个，所以**每步至少产出 1 个 token、最多 K+1 个**——投机解码不会比不开更慢地推进序列，只会多花计算 [D]。

昇腾没有直接用上游那个 Triton kernel，而是在 `rejection_greedy_sample_pytorch` 里用张量算子重写了一份：先求每条请求的 first mismatch 位置，`copy_len = min(first_mismatch + 1, num_drafts)` 决定抄几个，`needs_bonus = first_mismatch >= num_drafts` 决定补不补 bonus [C8]。语义和上游逐行对应，只是换成了向量化写法。

另有两个开关会**改变**这套判据：`enable_block_verify` 改成按累积概率整块判、`enable_entropy_verify` 按目标分布的熵调阈值，两个默认都是 `False`，`posterior_threshold` 默认 0.95、`posterior_alpha` 默认 0.4 [C9]。

## 被拒 token 的 KV 槽位：不回收，等着被下一步覆盖

目标模型对这 K+1 个位置**全都写了 KV**——它们是真进了 forward 的 token。被拒之后没人去擦：调度器只是把位置指针退回去，`num_computed_tokens -= num_rejected` [C16]。而下一步的 position 是 `num_computed_tokens + arange` 算出来的 [C6]，slot 又是 position 查[块表](block-table.md)得到的，所以下一步写的就是同一批物理槽，旧内容被原样盖掉 [D]。**「回收被拒 token 的 KV」这件事在代码里根本不存在**，因为它退化成了一次普通的覆盖写。

块层面也不退。`allocate_slots` 的注释说得很直白：新 token 里既有已验证的也有未验证的草稿，**只有已验证的那部分会被缓存**（数量按 `request.num_tokens` 封顶）[C17]。也就是说被拒的草稿不会污染[前缀缓存](prefix-caching.md)的哈希表，但它占过的块内空间也不会还给你。

真要额外预留的是草稿模型**自己**的 KV，由 `num_lookahead_tokens` 按方法分档：eagle / eagle3 / mtp / draft_model 是 K，dflash 是 K+1，**ngram 和 suffix 是 0**——后两种压根没有模型，也就没有 KV 要放 [C14]。

## 它和图模式、token 预算互相卡着

- **图模式**：一个 uniform decode 批次的 token 数必须是 `uniform_decode_query_len = 1 + K` 的整数倍。FULL decode 图下上游会把 `cudagraph_capture_sizes` 里每个尺寸**向上取整到 K+1 的倍数**，取整后一个都不剩就直接报错 [C19]。官方 EAGLE 教程要求你手写成 `n × (K + 1)` [S22]，其实代码会替你圆上去。
- **算子上限**：`AscendAttentionMetadataBuilder` 里 `decode_threshold = 1 + K`，紧跟一句 `assert decode_threshold <= 16`，理由写在报错串里——FIA 的 TND 布局一轮最多 16 个 token [C10]。
- **PagedAttention 算子**：`using_paged_attention` 的第一道门就是「`speculative_config` 非 None 直接返回 False」，两者不可能同时生效，细节在 [PagedAttention](paged-attention.md)。
- **token 预算**：草稿 token 花的是普通名额。调度器先定 `num_new_tokens`，再倒推这一步放得下几个草稿；放不下时 `spec_token_ids` 被**截断**，而不是把整条请求推到下一步 [C15]。预算条有多长见[调度器](vllm-scheduler.md)。
- **一条硬报错**：`disable_padded_drafter_batch` 和 FULL 图同时开，proposer 构造函数直接抛 `NotImplementedError` [C11]。

## v0.23 维护分支与 main 的差异

下表 main 指 2026-09-19 的源码快照 `b255ab59`，v0.23 维护分支指 `2c59ff10`；完整提交号在来源里。核心那条「排 K+1 个位置 → 第一个不符截断 → 槽位原地覆盖」两版一字不差。

| 项 | v0.23 维护分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 文档写的 K 上限 | 文档说 `(K+1)` 必须 ≤ 15 [S21]，代码 `assert <= 16` | 文档改成 ≤ 16 [S23]，与代码一致 | `[!]` 照 v0.23 文档配会白白少用一个草稿位；以代码为准 |
| 草稿方法 | 九种，`mtp` 与 `eagle` 共用 `AscendEagleProposer` | 多出 `dspark`；`dflash` 按草稿权重分流到 `AscendDflash2Proposer`；Gemma4 的 MTP 单走一个 proposer [C2] | 同一个 `method` 字符串在两版可能落到不同的类上 |
| 草稿侧滑动窗口 | 没有这个东西 | `additional_config` 里的 `draft_window_size` 只裁草稿模型的注意力，目标模型照看全长；`mtp` 会被忽略并打警告 [C24] | 长上下文把接受率拖垮时，main 上多一个补救口子 |
| K 能不能动 | 只有固定的 `num_speculative_tokens` | `dynamic_spec_config` 按草稿置信度调每条请求的验证长度，目前只认 `dspark` 和 `dflash` [C25] | 并发上来时 main 能自动缩短验证长度，v0.23 只能重启改参数 |

## 常见误解

- **「被拒绝的草稿等于白算了」**——不全是。第一个不匹配位置上写下的，正是不开投机解码时这一步也会产出的那个 token；真正浪费掉的只是它**后面**那些位置的计算和 KV 写入。
- **「投机解码会让输出变差」**——贪心路径上它是无损的：写进输出的永远是目标模型的 `argmax`，草稿只决定「能一次写几个」。会动判据的是昇腾额外提供的 block verify 与 entropy verify，而这两个默认都关着。
- **「MTP 是一个独立的 proposer 实现」**——在 v0.23 上不是：`method` 为 `eagle`、`eagle3`、`mtp` 时落到的都是 `AscendEagleProposer`，只有 step3p5 那种特例才另行分流 [C1]。
- **「草稿模型先跑，目标模型后跑」**——一步之内顺序是反的：草稿器挂在 `execute_model` 的尾巴上，用的是目标模型这一次的 hidden states，产出的是下一步要验的草稿。
