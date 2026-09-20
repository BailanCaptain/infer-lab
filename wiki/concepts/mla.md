---
id: mla
title: "MLA：缓存里躺的不是 K 和 V，是一条潜向量加一小段 RoPE"
type: concept
summary: 每层每个 token 只存一条 512 维潜向量加 64 维 RoPE 段；prefill 把它展开回每个头的 K 和 V，decode 干脆不展开，改把展开矩阵乘到 Q 上。
aliases: [MLA, Multi-head Latent Attention, 多头潜在注意力, 潜向量注意力, AscendMLAImpl, AscendMLAMetadata, kv_a_proj_with_mqa, kv_b_proj, kv_lora_rank]
chapters: ["04"]
order: 30
sources:
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L98-L118
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L83-L114
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L898-L920
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L926-L955
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L1187-L1216
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L1274-L1301
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L1315-L1378
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L1506-L1519
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L1586-L1596
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L1601-L1641
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L1655-L1670
  - vllm-ascend@2c59ff10:vllm_ascend/attention/mla_v1.py#L1766-L1794
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L3979-L3995
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4605-L4629
  - vllm-ascend@2c59ff10:vllm_ascend/worker/model_runner_v1.py#L4679-L4682
  - vllm-ascend@2c59ff10:vllm_ascend/core/kv_cache_interface.py#L117-L121
  - vllm@0fc695fc:vllm/model_executor/models/deepseek_v2.py#L927-L967
  - vllm@0fc695fc:vllm/model_executor/models/deepseek_v2.py#L1353-L1356
  - vllm@0fc695fc:vllm/model_executor/layers/attention/mla_attention.py#L357-L368
  - vllm@0fc695fc:vllm/model_executor/layers/attention/mla_attention.py#L960-L970
  - vllm@0fc695fc:vllm/v1/kv_cache_interface.py#L379-L384
  - vllm-ascend@b255ab59:vllm_ascend/attention/mla_v1.py#L1396-L1425
  - vllm-ascend@b255ab59:vllm_ascend/ops/mla.py#L207-L217
  - vllm-ascend@b255ab59:vllm_ascend/attention/mla_v1.py#L82-L114
  - https://arxiv.org/abs/2405.04434
  - https://huggingface.co/deepseek-ai/DeepSeek-V2-Lite/blob/main/config.json
evidence: "C"
relations:
  - to: attention-cost
    kind: builds-on
    note: 那一页算过 MLA 每 token 每层 1152 字节，这一页讲这 1152 字节里装的是什么、谁把它装进去
  - to: attention-backend-family
    kind: builds-on
    note: 走不走 MLA 不是模型自己决定的，是启动时拿 use_mla 三元组查表查到 AscendMLABackend
  - to: rope
    kind: builds-on
    note: MLA 唯一不压的那 64 维就是 RoPE 段；转角怎么算、为什么只转 Q 和 K 在那一页
  - to: kv-cache
    kind: builds-on
    note: 先看清普通模型缓存里躺的是 K 和 V 两份真向量，才看得出 MLA 换掉的到底是什么
contradicts: []
updated: "2026-09-20"
origin: seed
---

## 一句话

MLA 的缓存里没有 K，也没有 V。每层每个 token 只躺着一条 `kv_lora_rank` 维的潜向量，外加一小段 `qk_rope_head_dim` 维的 RoPE 分量——上游把这两段之和当成这一层的 `head_size`，`num_kv_heads` 直接写死成 1 [C19]。**真正的分叉在用的时候**：prefill 把潜向量展开回每个头的 K 和 V，decode 一次都不展开，它把展开矩阵提前乘到了 Q 那一边。

```wiki-diagram
file: mla
```

## 那条请求用不到它

[那条请求](one-request.md)跑的是 Qwen3-0.6B，普通 GQA 模型，`use_mla` 为假，查表查到的是 `AscendAttentionBackend`，28 层一层都碰不到 MLA（查表那段在[注意力后端家族](attention-backend-family.md)）。

要走到这里**只需要换模型**，卡、块大小、问题长度都不用动。换成 DeepSeek-V2-Lite：27 层、16 个头、`kv_lora_rank = 512`、`qk_rope_head_dim = 64`、`v_head_dim = 128`，而且它的 `q_lora_rank` 是 `null`（下一节会用到这一点）[S26]。其余照旧：37 + 200 = 237 个 token，一块 128 格 [A]。

账这么走 [D]。公式是 `page_size_bytes ÷ block_size`，里头既没有「K 一份 V 一份」的那个 2，`num_kv_heads` 也是 1 而不是 8 [C16]：

```
每 token 每层 = 1 × (512 + 64) × 2 B = 1152 B
每 token 全模型 = 1152 × 27 = 31104 B = 30.375 KiB
237 个 token   = 237 × 30.375 KiB ≈ 7.03 MiB，占 2 块
每块全模型     = 128 × 1152 × 27 = 3888 KiB ≈ 3.80 MiB
```

拿这个 30.375 KiB 去跟 Qwen3-0.6B 的 112 KiB 并排看没意义——那是两个模型。**跟 V2-Lite 自己比才干净**：同样 16 个头，按普通 MHA 存要 `16 × (192 + 128) × 2 = 10240 B` 一层，27 层 270 KiB；MLA 的 30.375 KiB 是它的 1/8.9，省掉 88.75% [D]。论文摘要自报的数字是 93.3%，但那是论文自己挑的基线，跟上面这条算式不是一回事 [S25] `[I]`。

四种注意力每 token 各要多少字节，[四种注意力的代价](attention-cost.md)已经并排算过，这里不重算。

## 压缩只发生在一个投影里，解压只发生在 prefill 那一路

压缩就是一次普通的线性层：`kv_a_proj_with_mqa` 把 `hidden_size` 打到 `kv_lora_rank + qk_rope_head_dim`。这里藏着一个**命名陷阱**——模型带 q 的 LoRA 时（DeepSeek-V2/V3 的 `q_lora_rank = 1536`），这一层会和 `q_a_proj` 合成一个 `fused_qkv_a_proj`，加载权重时按 `mla_params_mapping` 把两份拼起来 [C18]。也就是说 checkpoint 里那个张量还叫 `kv_a_proj_with_mqa`，Python 对象上却已经没有这个属性了；V2-Lite 的 `q_lora_rank` 是 `null`，所以只有它这一档保留原名。昇腾侧照这两种情况各写一支，切出来的永远是 `q_c` 和 `kv_no_split` 两段。

落盘由**一个融合算子**干完三件事：`npu_kv_rmsnorm_rope_cache` 拿 `kv_a_layernorm` 的权重做 RMSNorm、拿 cos/sin 转 RoPE、再按 `slot_mapping` 写进两个缓存张量 [C7]。RMSNorm 只覆盖 512 那段——`kv_a_layernorm` 本来就是按 `kv_lora_rank` 建的。

解压是反过来那个投影 `kv_b_proj`：`kv_lora_rank → num_heads × (qk_nope_head_dim + v_head_dim)`，出来再切成 `k_nope` 和 `value`。**这个调用只出现在 prefill 那一支。** 算子那头也看得出区别：prefill 用的 `npu_fused_infer_attention_score` 收 query / key / value 三个不同张量，`block_table` 传的是 `None` [C6]——这一步的 KV 还在手上，不必回缓存里捞。

代价落在 chunked prefill 上：前面那段 context 要一块一块从缓存读回来，**每个 chunk 都重新过一遍 `kv_b_proj`** [C5]。省下的显存在这里换成了重复的矩阵乘。

## decode 一次都不解压：展开矩阵被搬到了 Q 那边

加载权重时 `kv_b_proj` 的权重先被拆成两半：`W_UK`（`qk_nope_head_dim` 那部分）和 `W_UV`（`v_head_dim` 那部分），转置好存成 `W_UK_T` 与 `W_UV` [C4]。

于是 decode 这一步长成这样 [C3]：

1. `q_proj` 算出 q，切成 `q_nope`（每头 128）和 `q_pe`（每头 64）；
2. `bmm(q_nope, W_UK_T)`——q 被顶进 512 维的潜空间，这一步就叫 `_q_proj_and_k_up_proj`；
3. 缓存原封不动地 `view` 成按块排布的样子，连同 `block_table` 一起交给算子；
4. `npu_fused_infer_attention_score_v2(q_nope, k_nope, k_nope, …)`——**第二、三个入参是同一个张量**，key 和 value 都是那份潜向量缓存 [C9]；
5. 出来的结果还在 512 维，`_v_up_proj` 用 `W_UV` 再映回 `v_head_dim`。

成立的理由一句话：`q·(W_UK c) = (q W_UK)·c`。`W_UK` 是个与位置无关的常量矩阵，乘在哪一边都一样，那就挪到只有一个 token 的 Q 这边最省 [D]。代价同样明确——decode 的 QK 点乘从每头 128 维变成 512 维，**省下的显存换成了算力** [D]。

## RoPE 那 64 维不是压不动，是搬不走

上一节那条等式对 `W_UK` 成立，对 RoPE 不成立：RoPE 是一个**跟位置走**的旋转，夹在 q 和 k 中间，位置 5 和位置 105 转的角度不一样，折不进一个固定权重里 [D]。所以它只能原样存着，等算注意力时现转。

源码里这件事是明着摆出来的，不用推：`q_pe` 和 `k_pe` 从头到尾是独立的一对操作数，靠 `query_rope=` / `key_rope=` 两个单独的入参进算子，从不参与那个 `bmm` [C8]。prefill 那边还多一步——`k_pe` 只有一份，要 `expand` 到所有头上才能跟每头一份的 `k_nope` 对齐。

所以「1152 字节」拆开是 `512 × 2 + 64 × 2`：前一半是压过的，后一半是原样存的。

## 缓存里躺着的是两个张量，不是一个五维块

`AscendMLABackend.get_kv_cache_shape` 返回的是**四元组** `(num_blocks, block_size, num_kv_heads, head_size)`，前面没有那个代表「K 一份 V 一份」的 2 [C1]。runner 拿到之后不按前导维切，而是回头问这一层的 `kv_lora_rank` 和 `qk_rope_head_dim`，切成两个形状不同的张量，再打成一个二元组交给算子 [C14]：

| 缓存位 | 装的是什么 | 形状 | 一格多少字节 |
|---|---|---|---|
| `kv_cache[0]` | 压过的潜向量 | `(num_blocks, 128, 1, 512)` | 1024 |
| `kv_cache[1]` | RoPE 那一段 | `(num_blocks, 128, 1, 64)` | 128 |

块大小仍是 128——照样由配置检查里的 `refresh_block_size` 填上，见 [block 是怎么分出来的](vllm-kv-block-allocation.md)；`get_supported_kernel_block_sizes` 跟别的后端一样报 `[128]`，所以[块表](block-table.md)那一套完全照旧。开了稀疏或 LI C8 时这个元组会长到三、四项，多出来的是 indexer 的 key 和它的 scale——那部分归[四种注意力的代价](attention-cost.md)。

## v0.23 维护分支与 main 的三处差异

下表的 main 指 2026-09-19 的源码快照 `b255ab59`，v0.23 维护分支指 `2c59ff10`，完整提交号在来源里。核心机制（压在哪、解压在哪、decode 怎么吸收 `W_UK`）两版逐字相同，差的是下面这三处。

| 项 | v0.23 维护分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|
| 没有 RoPE 段的 MLA 层 | 不支持：写缓存一律走 `npu_kv_rmsnorm_rope_cache`，必须给得出 cos/sin | 多一条 `use_mla_rope` 开关（取值就是 `rotary_emb is not None`）[C23]，为假时走 `_exec_kv_no_rope`：单独做一次 RMSNorm，再 `reshape_and_cache` [C22] | `qk_rope_head_dim == 0` 的 MLA 层只有 main 跑得起来，v0.23 上这一路根本没有代码 `[!]` |
| 后端叫什么名字 | `get_name()` 在 `VLLM_USE_V2_MODEL_RUNNER` 为真时返回 `FLASH_ATTN`，注释写明这是绕上游断言的 HACK [C2] | 恒返回 `ASCEND_MLA` [C24] | 在 v0.23 上开了 V2 runner，日志里看到的后端名是 `FLASH_ATTN`，别据此以为没走 MLA `[!]` |
| 上下文并行的实现类 | `enable_cp()` 为真时换成 `AscendMlaCPImpl` / `AscendMlaCPMetadataBuilder` [C2] | 换成 `enable_dcp()` 与 `AscendMlaDCPImpl` / `AscendMlaDCPMetadataBuilder` [C24] | 照 v0.23 的类名到 main 里搜是搜不到的；排查 MLA 行为前先确认自己在哪个分支 |

## 常见误解

- **「decode 时要先把潜向量解压回 K 和 V」**——不用。decode 这一支一次 `kv_b_proj` 都不调，调的是 `_q_proj_and_k_up_proj`，把 `W_UK` 乘到 Q 上；算子的 key 和 value 收到的是同一个张量，就是缓存本身。
- **「RoPE 那 64 维是压缩没做干净剩下的零头」**——它不是压不动，是**搬不走**。`W_UK` 能提前挪到 Q 那边，是因为它与位置无关；位置相关的旋转挪不了 [D]。
- **「MLA 的缓存跟普通后端一样，只是 `head_size` 换了个数」**——差一整个维度再加一次切分：`get_kv_cache_shape` 返回四元组，runner 还要按 `kv_lora_rank` / `qk_rope_head_dim` 切成两个张量才交给算子。
