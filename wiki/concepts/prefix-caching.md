---
id: prefix-caching
title: Prefix Caching
type: feature
summary: 把已算过的前缀 KV 按 block 哈希存下来，新请求命中多少个整块就跳过多少 token 的前向计算。
aliases: [前缀缓存, 自动前缀缓存, APC, Automatic Prefix Caching]
chapters: ["11"]
sources:
  - vllm-ascend@28bf3a2e:vllm_ascend/utils.py#L1167-L1204
  - vllm-ascend@28bf3a2e:vllm_ascend/platform.py#L1196-L1210
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L151-L161
  - vllm-ascend@28bf3a2e:vllm_ascend/attention/attention_v1.py#L1287-L1345
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/model_runner_v1.py#L1542-L1569
  - vllm-ascend@28bf3a2e:vllm_ascend/worker/v2/attn_utils.py#L305-L336
  - vllm-ascend@28bf3a2e:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L156-L171
  - vllm-ascend@28bf3a2e:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L55-L84
  - vllm-ascend@28bf3a2e:vllm_ascend/core/recompute_scheduler.py#L107-L143
  - vllm-ascend@28bf3a2e:vllm_ascend/models/layer/attention/layer.py#L121-L127
  - vllm-ascend@28bf3a2e:vllm_ascend/_310p/worker/v2/model_runner.py#L99-L109
evidence: "I"
related: [paged-attention, block-table, kv-cache-spec, kv-pool, recompute-cpu-offload, kv-cache-memory-profiling, kv-cache-cpu-offload]
contradicts: []
updated: "2026-09-07"
---

## 是什么

同一个系统提示词、同一段长文档被反复送进来时，它们的 KV 每次都要重算一遍，纯属浪费。前缀缓存（Automatic Prefix Caching，APC）把已经算过的 token 的 KV 留在显存里，用「前缀内容的哈希」做键；新请求进来先查表，命中的前缀直接复用已有的 [block](block-table.md)，只对剩下那段没命中的后缀做前向。

命中判定、哈希计算、块复用这套核心机制都在上游 vLLM 的 `KVCacheManager` / `KVCacheCoordinator` 里，昇腾后端本身不实现它。vllm-ascend 做的是三件适配：把 block size 改成 kernel 能吃的 128；给注意力算子加一个 `PrefillCacheHit` 状态，让命中后的 prefill 走 paged 读取而不是 dense 读取；在多 KV cache group + DCP 的场景下重新算哈希粒度。因为主体在上游，本页 evidence 记为 `I`（推断），只有下面点名了行号的部分是昇腾仓库里读到的原文。

## 形状与数值

**block size 被强制成 128。** 默认值就是 128（`utils.py#L1178-L1179`）；即使用户显式指定了别的值，只要开了前缀缓存**或**开了 chunked prefill，`refresh_block_size` 就会把它改回 128 并打一条 info 日志（`utils.py#L1200-L1204`）。根因在算子侧：`AscendAttentionBackend.get_supported_kernel_block_sizes()` 只返回 `[128]`（`attention/attention_v1.py#L151-L153`）。deepseek_v4 和 hybrid 模型走各自的分支，不受这条规则管。

**一个 block 值多少计算。** 以 Qwen3-0.6B（28 层，n_kv=8，d_h=128，bf16）为例，一个 128-token block 在单层上的 K+V 是 `2 × 128 × 8 × 128 × 2B = 512 KiB`，28 层合计约 14 MiB；命中一个 block，就等于省掉 128 个 token 穿过 28 层的全部 QKV 投影、注意力与 MLP 计算。（这一段是按维度推算，不是实测。）

**命中后 kernel 拿到的张量。** `PrefillCacheHit` 分支下（`attention/attention_v1.py#L1313-L1323`），K/V 不再用本次前向算出的 dense tensor，而是把 KV cache reshape 成 `[num_block, 128, n_kv*d_h]`（Qwen3-0.6B 即 `[num_block, 128, 1024]`）交给 FIA，配一张裁到 `[batch_size, max_num_blocks_per_req]` 的 block table；KV 长度取 `seq_lens_list`（整条序列，含复用的前缀），而 Q 只有未命中的那段。

**哈希粒度是独立的 `hash_block_size`。** coordinator 里单独存了这个字段，注释写明「实际 block size 通常等于 hash_block_size，但不同 KV cache group 的 block size 不同时，实际值可以是它的整数倍」，并且只在 `enable_caching` 为真时才断言各组 block size 必须整除它（`patch/platform/patch_kv_cache_coordinator.py#L156-L165`）。昇腾对它做了一处改写：多 group 且 DCP≠1 时，调度粒度取各组 block size 的 `lcm × dcp`，而哈希粒度取 `gcd`——且这条 gcd 分支只在 `enable_prefix_caching` 时才走（`patch/platform/patch_kv_cache_utils.py#L73-L82`）。

## 在哪一步出现

课程第 11 章。请求路径上它横跨调度和执行两段：

- **配置阶段**：`AscendPlatform.check_and_update_config` 调 `refresh_block_size(vllm_config)`（`platform.py#L1210` → `utils.py#L1167-L1204`），此时决定 block size。
- **调度阶段（上游为主）**：scheduler 用 `kv_cache_manager.get_computed_blocks(request)` 查命中长度，写进 `request.num_computed_tokens`。昇腾的 `RecomputeScheduler._get_computed_blocks_for_connector` 在此处包了一层，可以看到查表的输入就是 `request.block_hashes`、输出是每组命中的 token 数（`core/recompute_scheduler.py#L116-L127`）——命中总是整块整块地增长，这是「哈希以 block 为单位」最直白的证据。
- **执行阶段**：`NPUModelRunner._build_attn_state`（`worker/model_runner_v1.py#L1542-L1569`）看 `num_computed_tokens_cpu`：全为 0 → `PrefillNoCache`；不全为 0 且没开 chunked prefill → `PrefillCacheHit`。model runner v2 的 `build_attn_state`（`worker/v2/attn_utils.py#L305-L336`）判据等价，写成 `seq_lens_np == num_scheduled_tokens`。
- **算子阶段**：`AscendAttentionBackendImpl._get_fia_params`（`attention/attention_v1.py#L1287-L1345`）按 attn_state 分派参数，`PrefillCacheHit` 与 `DecodeOnly`、`ChunkedPrefill` 一样走 paged 读取，只有 `PrefillNoCache` 完全不碰 key_cache。

**与 chunked prefill 的耦合**，从代码看是两层：

1. 配置上共用一条分支，任一开启都把 block size 钉到 128（`utils.py#L1200-L1204`）。
2. 状态判定上被吞并：一旦 `enable_chunked_prefill` 为真，`_build_attn_state` 在 `PrefillCacheHit` 之前就被 `elif self.scheduler_config.enable_chunked_prefill` 截胡，命中场景统一按 `ChunkedPrefill` 处理（`worker/model_runner_v1.py#L1559-L1562`）。这不是功能冲突——两条分支在 `_get_fia_params` 里拿到的 KV 视图和 block table 是同一套；只是意味着开了 chunked prefill 后 `PrefillCacheHit` 这个状态实际很少出现。

**什么时候会被关掉**：DSA 注意力层在 TRITON_MLA / FLASHINFER 后端下会把 `cache_config.enable_prefix_caching` 直接改成 False，不报错也不告警（`models/layer/attention/layer.py#L122-L127`）；310P 的 model runner v2 则是硬性拒绝，开了就抛 `NotImplementedError`（`_310p/worker/v2/model_runner.py#L104-L106`）。

## 常见误解

- **「命中的前缀不用占显存了」**——恰恰相反，命中意味着那些 block 继续被引用、不能被回收，前缀缓存换的是计算不是显存；显存怎么分见 [KV Cache 显存预估](kv-cache-memory-profiling.md)。
- **「命中一半 block 就能省一半」**——哈希以整块为单位，块内 token 不足 `hash_block_size` 的尾巴不参与匹配，实际命中长度总是向下取整到块边界（`patch_kv_cache_coordinator.py#L156-L165`）。
- **「开了前缀缓存 attn_state 就会变成 PrefillCacheHit」**——只有在没开 chunked prefill 时才会；开了 chunked prefill，命中场景一律归到 `ChunkedPrefill` 分支（`worker/model_runner_v1.py#L1559-L1562`）。
- **「昇腾自己实现了一套前缀缓存」**——没有。哈希、查表、块引用计数全在上游 vLLM；昇腾只改了 block size、attn_state 分派和多 group 下的哈希粒度。

> 引用的源码片段见 [raw/prefix-caching.md](../raw/prefix-caching.md)。
