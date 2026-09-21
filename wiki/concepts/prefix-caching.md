---
id: prefix-caching
title: "Prefix Caching：命中的是块，不是 token"
type: feature
summary: 两条请求开头一样，那段 KV 就不用重算——把算过的块按内容哈希留着，下一条直接把块号填进块表，只对不同的尾巴做前向。
aliases: [Prefix Caching, 前缀缓存, 自动前缀缓存, Automatic Prefix Caching, APC]
chapters: ["11"]
sources:
  - vllm-ascend@b255ab59:vllm_ascend/utils.py#L1280-L1300
  - vllm-ascend@2c59ff10:vllm_ascend/utils.py#L1386-L1406
  - vllm-ascend@b255ab59:vllm_ascend/platform.py#L1245-L1249
  - vllm-ascend@2c59ff10:vllm_ascend/platform.py#L669-L671
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L1632-L1659
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L1477-L1506
  - vllm-ascend@b255ab59:vllm_ascend/worker/model_runner_v1.py#L1245-L1254
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L907-L916
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L151-L156
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L1313-L1378
  - vllm-ascend@2c59ff10:vllm_ascend/attention/attention_v1.py#L1174-L1210
  - vllm-ascend@b255ab59:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L91-L121
  - vllm-ascend@2c59ff10:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L127-L147
  - vllm-ascend@b255ab59:tests/ut/patch/platform/test_prefix_cache_cp_patches.py#L373-L397
  - vllm-ascend@b255ab59:vllm_ascend/models/layer/attention/layer.py#L133-L139
  - vllm-ascend@2c59ff10:vllm_ascend/models/layer/attention/layer.py#L114-L120
  - vllm-ascend@b255ab59:vllm_ascend/attention/dsa_v1.py#L276-L303
  - vllm-ascend@b255ab59:vllm_ascend/_310p/worker/v2/model_runner.py#L173-L207
  - vllm-ascend@b255ab59:vllm_ascend/patch/platform/patch_mamba_config.py#L182-L185
  - vllm-ascend@b255ab59:vllm_ascend/attention/attention_v1.py#L146-L148
  - vllm-ascend@b255ab59:docs/source/user_guide/support_matrix/feature_matrix.md#L17-L18
  - vllm-ascend@b255ab59:docs/source/user_guide/release_notes.md#L2231-L2231
  - vllm-ascend@b255ab59:tests/e2e/pull_request/two_card/test_prefix_caching.py#L63-L90
  - https://docs.vllm.ai/en/latest/features/automatic_prefix_caching/
  - vllm-ascend@b255ab59:vllm_ascend/_310p/worker/v2/model_runner.py#L411-L420
  - vllm-ascend@2ed6cbba:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L28-L61
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
evidence: "C"
relations:
  - to: vllm-kv-block-allocation
    kind: builds-on
    note: 命中与否在 get_computed_blocks 里判定，「只有写满的块才进哈希表」这条规则也写在那一页
  - to: block-table
    kind: builds-on
    note: 命中的历史块靠 block_tables 接到本请求上，PrefillCacheHit 分支直接把它切片喂给算子
  - to: kv-cache-spec
    kind: builds-on
    note: 哈希粒度 hash_block_size 由各 KV cache group 的 spec.block_size 取 gcd 得出
  - to: paged-attention
    kind: builds-on
    note: 命中后新 token 要读散在别处的历史块，只有按块表寻址的分页算子做得到
  - to: prefill
    kind: builds-on
    note: PrefillCacheHit 只是 AscendAttentionState 五个取值里的一个，整张枚举表在那一页
contradicts: []
updated: "2026-09-21"
---

## 一句话

前缀缓存（APC）把算过的 KV 块按「这一块之前的全部 token」哈希索引起来。下一条请求开头若与某条缓存序列逐 token 相同，调度器把那些物理块的编号直接填进新请求的块表，模型**只对不同的尾巴做前向**。昇腾侧不实现缓存管理本身——匹配、引用计数、淘汰都是上游 `KVCacheManager` 的活，见 [block 是怎么分出来的](vllm-kv-block-allocation.md)；vllm-ascend 做的是三件适配 [D]。

```wiki-diagram
file: prefix-caching
```

## 那条请求用不到它

[那条请求](one-request.md)的问题只有 37 个 token，而 `block_size` 是 128。**它连一个写满的块都凑不出来**，所以就算把同一个问题原样再问一遍，命中数也是 0——只有写满的块才带着哈希进表，理由在 [block 是怎么分出来的](vllm-kv-block-allocation.md)。这也是那条请求「代表不了」的四件事之一。

要让这一页有数可算，得改设定：把共享的开头拉长到至少一个块。下面这组数是把问题换成「1700 token 的 system prompt + 文档」、第二条请求在后面追加 12 个 token 的新问题，其余设定不变 [A]：

| 这一步在算什么 | 值 | 依据 |
|---|---|---|
| 能命中几块 | ⌊1700 / 128⌋ = **13 块 = 1664 token** | 尾巴上那 36 个 token 的块没写满，拿不到哈希 [D] |
| 本轮进前向的 token | 1712 − 1664 = **48** | `num_computed_tokens_cpu[0] = 1664`，`positions` 从 1664 起 [C7] |
| 块表给出几个块号 | ⌈1712 / 128⌉ = **14** | 注意力要读的是全长，不是没命中的那 48 个 |

## 开了它，`--block-size` 就不是你写的那个数

平台层在配置检查里调一次 `refresh_block_size`。只要 `enable_prefix_caching` 或 `enable_chunked_prefill` 为真、而 `block_size` 又不是 128，它就把 `block_size` 改成 128：不报错、不警告，只留一条 info 级日志 [C1][C2]。你在命令行写的 `--block-size 64` 就这么没了，而显存估算全都建在这个数上。

128 也是 `AscendAttentionBackend.get_supported_kernel_block_sizes()` 报的唯一一个 kernel 块大小 [C20]，两者对得上；但定这个值的是上面那个函数，不是这个列表。

但这条改写**不是无条件的**：`deepseek_v4` 和混合（attention + mamba）模型在这条分支之前就 `return` 了，走各自的块大小逻辑 [C1]。混合模型那边还有一条反向联动：`mamba_cache_mode="align"` 时，开着 APC 才让 `mamba_block_size` 等于 `block_size`；关掉 APC，mamba 状态按 `max_model_len` 整条分配，显存占用差一个量级 [C19]。

昇腾上 APC 和 chunked prefill 是同一批打通的——官方 release note 记的是把 CANN 升到 8.1.RC1 才同时支持了两者 [S22]，这个历史耦合就留在上面那个共用的 `if` 里。但它们并不互斥，官方矩阵里那一格是 ✅ [S21]；同时开启时只是 attn_state 由 chunked prefill 优先决定。

## 省掉的是计算，不是显存带宽

命中之后，调度器把命中的 token 数写进 `num_computed_tokens_cpu`，模型运行器算 position 时以它为起点。**命中的那段 token 根本不出现在这一步的输入张量里**：省掉的是它们的 embedding、QKV 投影、注意力和 MLP，整整 28 层。接着上面那组数，`1 − 48 / 1712 = 97.2%` 的前向计算不再发生 [D]。

没省掉的是读。`_build_attn_state` 的第一条分支要求整批 `num_computed_tokens_cpu` 全为 0 才算 `PrefillNoCache`；只要有一条请求命中了前缀，这一批就落到 `PrefillCacheHit`（没开 chunked prefill）或 `ChunkedPrefill`（开了）[C5][C6]。两条路在 `_get_fia_params` 里都走带 `block_table` 的分页路径，拿到的 `actual_seq_lengths_kv` 都是 `seq_lens_list`，也就是**含已命中部分的完整序列长度** [C10]；区别只在 `PrefillCacheHit` 会把 `block_table` 按 batch_size 切一刀。

代到那组数上：算子拿到的 KV 长度是 1712，块表给出 14 个块号。每 token 每层 K+V 是 4 KiB、28 层合计 112 KiB（推导在 [KV Cache Spec](kv-cache-spec.md)），所以这一次前向要读的 KV 约 1712 × 112 KiB ≈ **187 MiB**，一整块占 **14 MiB** [D]。**前缀越长、共享比例越高，省下的计算越接近上限，而注意力的读带宽一分没少**——这解释了为什么 APC 对 TTFT 的改善很明显，对 decode 阶段的吞吐几乎没有影响。

它是无损优化：昇腾 CI 的验收方式就是把开 APC 和关 APC 的输出做逐 token 相等断言，MHA（Qwen3-8B）与 MLA（DeepSeek-V2-Lite）各跑一遍 [C23]。上游文档要求显式设置 `enable_prefix_caching` 才开启 [S24]。

## 哈希粒度是另一个数，而且两个分支算得不一样

vllm-ascend 打了 `_ascend_resolve_kv_cache_block_sizes` 覆盖上游同名函数，返回一个二元组 `(scheduler_block_size, hash_block_size)`——**「哈希以块为单位」这件事直接写在了接口的形状里**。单个 KV cache group 时两者相等；多 group 且开了上下文并行时，调度块取各 group 块大小的 lcm 再乘 CP 因子，而哈希块在开 APC 时取 gcd，匹配粒度比调度粒度更细。两个分支的单元测试都把这两个数钉死了：`lcm(16, 32) × 2` 与 `gcd(16, 32)` [C14]。

分支在这一带分叉，其余行为（开关名、强制 128、命中后的全长 KV）三版一致：

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| CP 因子 | `lcm(...) × dcp × pcp`，`pcp ≠ 1` 单独就触发 [C13] | 同 main，`pcp` 在这个补丁里已经删干净 [C26] | `lcm(...) × dcp`，只有 `dcp ≠ 1` 触发 [C12] | [!] 同一套 PCP 配置，v0.23 与 v0.26 起算出的调度块大小不同 |
| 多 group 时筛不筛组 | 不筛 | 同 v0.23 | 先用 `is_prefix_cacheable` 筛掉不可缓存的组；筛完只剩一组时改用该组自己的 `block_size` | main 上「固定尾块」这类私有组不再参与块大小计算 |
| `_get_fia_params` 取 KV 视图 | 分支里直接 `.view(...)` [C11] | 同 v0.23 | 抽成 `_get_kv_cache_view`，多一条 BNSD 布局分支 | 只是重构：命中后拿到的块表切片和全长 `seq_lens_list` 没变 |
| 310P 的 model runner v2 | 该路径不存在 | 同 v0.23，仍只有 `worker_310p.py` | 支持 APC [C18] | [!] 「开 APC 直接 `NotImplementedError`」只在 main 上不成立；代价是开了 FULL 图时命中批次被强制退回 eager [C25] |

## 常见误解

- **「命中了就不用读 KV 了。」**——命中省掉的是把前缀 token 再过一遍 embedding / QKV 投影 / MLP；算子拿到的 `actual_seq_lengths_kv` 仍是完整序列长度，命中的那部分 KV 一个字节不少地从 HBM 读进来。
- **「`--block-size 64` 可以和前缀缓存一起用。」**——不能，会被静默改成 128，以为自己在用 64 的人显存估算会全盘偏掉。反过来也要当心：混合 attention + mamba 模型走的是另一条路，这条改写压根不会发生。
- **「`layer.py` 里那句 `cache_config.enable_prefix_caching = False` 说明昇腾会在某些模型上自动关掉 APC。」**——那条分支要求后端名等于 `TRITON_MLA` 或 `FLASHINFER`，两版一字不差 [C15]；而这条路径上取得到的后端只有 `AscendDSA*` 系列，main 上是 `ASCEND_DSA_C4` / `ASCEND_DSA_C128` / `ASCEND_DSA_SWA` [C17]。它是从 CUDA 侧照搬过来的死分支 [D]。
