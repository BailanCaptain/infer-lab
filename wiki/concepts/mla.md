---
id: mla
title: "MLA：缓存里躺的不是 K 和 V，是一条潜向量加一小段 RoPE"
type: concept
summary: 普通模型每层要给每个 token 存每个头的 K 和 V；MLA 只存一条压缩过的短向量，所有头共用，要用时再展开——显存省下来，换成多做的计算。
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
  - vllm-ascend@baa023ad:vllm_ascend/attention/mla_v1.py#L1405-L1434
  - vllm-ascend@baa023ad:vllm_ascend/ops/mla.py#L207-L217
  - vllm-ascend@baa023ad:vllm_ascend/attention/mla_v1.py#L83-L115
  - https://arxiv.org/abs/2405.04434
  - https://huggingface.co/deepseek-ai/DeepSeek-V2-Lite/blob/main/config.json
  - vllm-ascend@2ed6cbba:vllm_ascend/ops/mla.py#L117-L129
  - vllm-ascend@2ed6cbba:vllm_ascend/attention/mla_v1.py#L224-L258
  - vllm@0fc695fc:vllm/transformers_utils/model_arch_config_convertor.py#L252-L276
  - vllm@0fc695fc:vllm/config/model.py#L1646-L1648
  - vllm@0fc695fc:vllm/config/model.py#L1284-L1295
  - https://huggingface.co/Qwen/Qwen3.6-35B-A3B/blob/main/config.json
verified: ["main", "releases/v0.23.0", "releases/v0.26.0rc"]
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
  - to: attention-qkv
    kind: builds-on
    note: K 和 V 各是什么、为什么要留着给后面的 token 查，在那一页；MLA 换掉的就是「怎么留」
contradicts: []
updated: "2026-09-25"
origin: seed
---

## 一句话

普通模型每一层要给每个 token 存下每个头的 K 和 V；MLA 换了个存法：每个 token 每层只存**一条压缩过的短向量**（叫潜向量），所有头共用这一条，外加一小段没法压的位置信息。要用的时候再把它展开——显存省下来了，换成多做一些矩阵乘。

```wiki-diagram
file: mla
```

## 先问一个问题：缓存能不能只存一份？

[注意力](attention-qkv.md)算下一个 token 时，要拿它的 Q 去和前面每个 token 的 K 比一比，再按比例把前面的 V 收进来。前面那些 K 和 V 每一步都要用，所以算过一次就存进 [KV Cache](kv-cache.md)，不重算。

问题在于存的量。普通做法是每个 KV 头各存一份 K、一份 V，头越多存得越多，回答越长存得越多。[GQA](gqa.md) 的办法是让几个 Q 头共用一个 KV 头，少存几份；MLA 走得更远，问的是：**能不能每个 token 只存一条向量，所有头都从它里面取？**

它的答案是可以，做法分三步：

- **存的时候压一次**：用一个线性层把这个 token 的隐藏向量压成一条短向量，存进缓存。
- **用的时候展开**：再用另一个线性层把这条短向量展开回每个头的 K 和 V。
- **位置那一段单独存**：K 里跟位置有关的那一小段（[RoPE](rope.md) 转过的部分）没法一起压，原样另存一小截。

上图就是这件事：同一个模型、同一层、同一个 token，照普通做法要存两大块，MLA 只存一小条。

## 我们那条请求碰不到它

[那条请求](one-request.md)用的 Qwen3.6-35B-A3B 不是 MLA 模型。它有 40 层：10 层全注意力，是普通的 GQA——16 个 Q 头共用 2 个 KV 头，每层给每个 token 存 K 和 V 两份真向量，一共 2 KiB；两颗 NPU 对半分之后每颗 1 KiB。另外 30 层是[线性注意力](linear-attention.md)，根本不留 K 和 V。**40 层里没有一层是 MLA**。

vLLM 是看模型配置文件来判断要不要走 MLA 的：配置里得是 DeepSeek 那一类结构、而且写了压缩维度才算。Qwen3.6-35B-A3B 的配置里没有这一项，所以启动时就走普通注意力那一路（怎么查表选的，在[注意力后端家族](attention-backend-family.md)）。

所以这一页换一个例子讲。

## 换成 DeepSeek-V2-Lite 算一遍

DeepSeek-V2-Lite 是个 MLA 模型：27 层，每层 16 个注意力头；潜向量 512 维，RoPE 那一段 64 维；每个头的 V 是 128 维。请求照旧是 37 + 200 = 237 个 token。

它不是混合模型，没有线性注意力那 30 层的状态要对齐，所以 KV 块回到通用的大小：一块 128 个 token（那条请求的块是 2048，是被线性注意力的状态撑大的）。

每个 token 在一层里存的是 512 + 64 = 576 个数，每个数 2 字节：

```
每 token 每层 = (512 + 64) × 2 B = 1152 B
每 token 全模型 = 1152 × 27 = 31104 B = 30.375 KiB
237 个 token   = 237 × 30.375 KiB ≈ 7.03 MiB，占 2 块
每块全模型     = 128 × 1152 × 27 = 3888 KiB ≈ 3.80 MiB
```

这里没有「K 一份、V 一份」的那个乘 2，也没有「乘几个 KV 头」——整层只有一条。

**这个数只跟 V2-Lite 自己比才干净。** 拿它去跟 Qwen3.6-35B-A3B 并排看没意义，那是两个模型，头数、维度、层数全不一样。换成同一个模型、同样 16 个头、照普通做法每个头各存 K 和 V：每头的 K 是 128 + 64 = 192 维，V 是 128 维，一层 `16 × (192 + 128) × 2 = 10240` 字节，27 层 270 KiB。MLA 的 30.375 KiB 是它的 1/8.9，省掉约 89%。论文里自报的是 93.3%，那是论文自己挑的对比对象，跟这里的算法不是一回事。

还有一点跟普通模型相反：**两颗 NPU 分着跑时，这份缓存不对半分**。GQA 的 KV 头可以一颗分一半；MLA 整层只有一条潜向量，分不开，两颗 NPU 各存一整份。想把这份重复省掉的办法在 [KVPP](kvpp.md)。

四种注意力每 token 各要多少字节，[四种注意力的代价](attention-cost.md)并排算过，这里不重算。

## 存进去之前：压一次

压缩就是一次普通的线性层：把这个 token 的隐藏向量乘一个权重矩阵，得到 512 + 64 = 576 个数。前 512 个是潜向量；后 64 个是给 RoPE 用的那一段。

然后一步做完三件事：给潜向量那 512 维做一次归一化，给 64 维那段按位置转好角度，再把两段写进缓存对应的格子里。

## prefill：取出来，展开

prefill 手里有一整段 token，要算它们之间的注意力。这时候把潜向量用另一个线性层展开：512 维 → 每个头 128 维的「不含位置」那段 K，加每个头 128 维的 V。再把 64 维的位置段复制给每个头拼上去，就得到了每个头完整的 K 和 V，交给注意力算子去算。

展开出来的 K 和 V 只在这一步用，**不写回缓存**。缓存里始终只有那条潜向量。

代价落在 [Chunked Prefill（分块预填充）](chunked-prefill.md)上：问题太长要切成几段、分几步 prefill 时，前面几段的内容要从缓存里读回来，**每一段都要重新展开一遍**。省下的显存，在这里换成了重复的矩阵乘。

## decode：不展开，把展开矩阵挪到 Q 这边

decode 每一步只有 1 个新 token，却要跟前面所有 token 比。如果每一步都把前面几百个 token 的潜向量全展开一遍，太亏。

MLA 用了一个等式绕过去。展开 K 就是「潜向量乘一个固定矩阵」；Q 和 K 算点积时：

```
q · (W · c)  =  (q · W) · c
```

W 是个跟位置无关的常量矩阵，乘在哪边结果都一样。那就**把它乘到 Q 上**——Q 只有 1 个 token，乘一次就够；前面几百个 token 的潜向量原样拿来用，一个都不用展开。

于是 decode 这一步是这样走的：

1. 算出新 token 的 Q，拆成「不含位置」和「含位置」两段；
2. 「不含位置」那段乘上展开 K 用的矩阵，Q 被送进 512 维的潜空间；
3. 缓存原封不动地交给注意力算子——**算子的 K 和 V 拿到的是同一份东西**，就是那条潜向量；
4. 算出来的结果还在 512 维，再乘展开 V 用的矩阵，变回每个头 128 维。

代价同样明确：每一步 Q 和 K 的点积，从每头 128 维变成了 512 维。**省下的显存换成了算力**。

## RoPE 那 64 维不是压不动，是搬不走

上一节的等式对展开矩阵成立，对 [RoPE](rope.md) 不成立。RoPE 是按位置转一个角度，位置 5 和位置 105 转的角度不一样，没法折进一个固定矩阵、提前乘到 Q 上。所以这一段只能原样存着，算注意力时单独拿出来用。

这也就是 1152 字节的来历：`512 × 2 + 64 × 2`——前一半是压过的，后一半是原样存的。

## 常见误解

- **「decode 时要先把潜向量解压回 K 和 V」**——不用。decode 一次都不展开，是把展开矩阵乘到了 Q 上；注意力算子的 K 和 V 拿到的是同一份缓存。
- **「RoPE 那 64 维是压缩没做干净剩下的零头」**——它不是压不动，是**搬不走**。展开矩阵能提前挪到 Q 那边，是因为它与位置无关；按位置转的角度挪不了。
- **「MLA 的缓存跟普通模型一样，只是每格长度换了个数」**——存的东西就不一样：普通模型存 K 和 V 两份真向量，MLA 存一条潜向量加一小段位置信息，缓存里是两个形状不同的张量，而且分给两颗 NPU 时不切开。
- **「MLA 能直接省到一个固定比例」**——省多少看跟谁比。跟同一个模型照普通做法存比，V2-Lite 省约 89%；拿它跟别的模型比，差的是整个模型形状，不说明 MLA 本身。

## 对照源码

### 怎么开

没有开关要打。走不走 MLA 由上游在启动时看模型配置决定：`use_mla = is_deepseek_mla and not VLLM_MLA_DISABLE` [C30]；`is_deepseek_mla` 要求 `model_type` 落在 `deepseek_v2 / deepseek_v3 / kimi_k2 / glm4_moe_lite …` 这一串里，并且配置写了 `kv_lora_rank` [C29]。设 `VLLM_MLA_DISABLE` 可以强制关掉。拿到 `use_mla = True` 之后，昇腾按 `(use_mla, use_sparse, use_compress)` 查表选到 `AscendMLABackend`，查表那段在[注意力后端家族](attention-backend-family.md)。

Qwen3.6-35B-A3B 的官方配置里没有 `kv_lora_rank`，注意力形状是 `num_attention_heads: 16`、`num_key_value_heads: 2`、`head_dim: 256` [S32]；上游给 Qwen3.5 系定义的 `model_type` 是 `qwen3_5_moe` / `qwen3_5_moe_text` 一类（`vllm/transformers_utils/configs/qwen3_5_moe.py` 第 23、139 行），也不在那一串里。两条任一条都让 `is_deepseek_mla` 为假，`use_mla` 为假，全注意力那 10 层查到的是普通后端 [D]。

DeepSeek-V2-Lite 的形状：27 层、16 个头、`kv_lora_rank = 512`、`qk_rope_head_dim = 64`、`v_head_dim = 128`，`q_lora_rank` 是 `null` [S26]。上半「237 个 token、一块 128 格」是沿用那条请求的长度、按纯注意力模型走通用块大小的假设 [A]。

### 开销和什么时候别开

**显存账**。公式是 `page_size_bytes ÷ block_size`，里头既没有「K 一份 V 一份」的那个 2，`num_kv_heads` 也是 1 [C16]。上游在 `MLAAttention` 里把 `head_size` 定成 `kv_lora_rank + qk_rope_head_dim`、`num_kv_heads` 写死成 1 [C19]；`get_num_kv_heads` 在 `use_mla` 为真时直接返回 1，不除以 TP 大小 [C31]——所以 TP=2 时两颗 NPU 各存一整份 [D]。GQA 那边则是 `total_num_kv_heads // tensor_parallel_size`，Qwen3.6-35B-A3B 的 2 个 KV 头在 TP=2 下每颗 1 个。上半那几行算式与「1/8.9、省 88.75%」都是按 V2-Lite 配置代入的推导 [D]；论文摘要的 93.3% 用的是论文自己的基线 [S25] `[I]`。

**算力账**：

- chunked prefill 时，前面那段 context 要一块一块从缓存读回来，**每个 chunk 都重新过一遍 `kv_b_proj`** [C5]。
- decode 的 QK 点乘从每头 `qk_nope_head_dim = 128` 维变成 `kv_lora_rank = 512` 维 [D]。

MLA 是模型结构的一部分，不是能自选开关的优化；上游只留了 `VLLM_MLA_DISABLE` 这一条退路让 `use_mla` 为假，这样关掉之后在昇腾上能不能跑通、显存涨多少，本页没有核过。

### 版本差异

下表的 main 指 2026-09-21 的源码快照 `baa023ad`，v0.23 维护分支指 `2c59ff10`，v0.26 分支指 `2ed6cbba`，完整提交号在来源里。核心机制（压在哪、解压在哪、decode 怎么吸收 `W_UK`）三版逐字相同，差的是下面这三处。v0.26 在后两处上站在 v0.23 这边 [C28]，第一处它跟 main 一样有，只是开关的取值来路不同 [C27]。

| 项 | v0.23 维护分支 | v0.26 分支 | main 开发主线 | 意味着什么 |
|---|---|---|---|---|
| 没有 RoPE 段的 MLA 层 | 不支持：写缓存一律走 `npu_kv_rmsnorm_rope_cache`，必须给得出 cos/sin | 有 `use_mla_rope`，为假时同样走 `_exec_kv_no_rope`；取值来自模型文件显式设的 `mla_modules.use_mla_rope`，默认真 | 多一条 `use_mla_rope` 开关（取值就是 `rotary_emb is not None`）[C23]，为假时走 `_exec_kv_no_rope`：单独做一次 RMSNorm，再 `reshape_and_cache` [C22] | `qk_rope_head_dim == 0` 的 MLA 层在 v0.23 上这一路根本没有代码；v0.26 上有，但模型文件不主动关掉这个开关就还是走 RoPE 那一路 `[!]` |
| 后端叫什么名字 | `get_name()` 在 `VLLM_USE_V2_MODEL_RUNNER` 为真时返回 `FLASH_ATTN`，注释写明这是绕上游断言的 HACK [C2] | 同 v0.23，一字未改 | 恒返回 `ASCEND_MLA` [C24] | 在 v0.23 和 v0.26 上开了 V2 runner，日志里看到的后端名是 `FLASH_ATTN`，别据此以为没走 MLA `[!]` |
| 上下文并行的实现类 | `enable_cp()` 为真时换成 `AscendMlaCPImpl` / `AscendMlaCPMetadataBuilder` | 同 main | 换成 `enable_dcp()` 与 `AscendMlaDCPImpl` / `AscendMlaDCPMetadataBuilder` | 照 v0.23 的类名到 v0.26 或 main 里搜是搜不到的；排查 MLA 行为前先确认自己在哪个分支 |

块大小在 v0.23 与 v0.26 上完全照旧；main 上多了一层换算：调度器仍按 `block_size` 记账，算子用的物理块是 `block_size // tokens_per_state`，见 [KV Cache Spec](kv-cache-spec.md) 的差异表 `[!]`。

### 源码位置

**压缩**：`kv_a_proj_with_mqa` 把 `hidden_size` 打到 `kv_lora_rank + qk_rope_head_dim`。这里藏着一个**命名陷阱**——模型带 q 的 LoRA 时（DeepSeek-V2/V3 的 `q_lora_rank = 1536`），这一层会和 `q_a_proj` 合成一个 `fused_qkv_a_proj`，加载权重时按 `mla_params_mapping` 把两份拼起来。也就是说 checkpoint 里那个张量还叫 `kv_a_proj_with_mqa`，Python 对象上却已经没有这个属性了；V2-Lite 的 `q_lora_rank` 是 `null`，所以只有它这一档保留原名。昇腾侧照这两种情况各写一支，切出来的永远是 `q_c` 和 `kv_no_split` 两段。

**落盘**：融合算子 `npu_kv_rmsnorm_rope_cache` 拿 `kv_a_layernorm` 的权重做 RMSNorm、拿 cos/sin 转 RoPE、再按 `slot_mapping` 写进两个缓存张量。RMSNorm 只覆盖 512 那段——`kv_a_layernorm` 本来就是按 `kv_lora_rank` 建的。

**prefill 解压**：`kv_b_proj`：`kv_lora_rank → num_heads × (qk_nope_head_dim + v_head_dim)`，出来再切成 `k_nope` 和 `value`，这个调用只出现在 prefill 那一支。prefill 用的 `npu_fused_infer_attention_score` 收 query / key / value 三个不同张量，`block_table` 传的是 `None`——这一步的 KV 还在手上，不必回缓存里捞。`k_pe` 只有一份，要 `expand` 到所有头上才能跟每头一份的 `k_nope` 对齐。chunked prefill 的逐 chunk 重算在。

**decode 吸收**：加载权重时 `kv_b_proj` 的权重先拆成 `W_UK`（`qk_nope_head_dim` 那部分）和 `W_UV`（`v_head_dim` 那部分），转置好存成 `W_UK_T` 与 `W_UV`。decode 一步：`q_proj` 算出 q，切成 `q_nope`（每头 128）和 `q_pe`（每头 64）；`bmm(q_nope, W_UK_T)` 把 q 顶进 512 维潜空间，这一步叫 `_q_proj_and_k_up_proj`；缓存原封不动地 `view` 成按块排布的样子，连同 `block_table` 交给 `npu_fused_infer_attention_score_v2(q_nope, k_nope, k_nope, …)`——**第二、三个入参是同一个张量**；出来还是 512 维，`_v_up_proj` 用 `W_UV` 映回 `v_head_dim`。`q_pe` 和 `k_pe` 从头到尾是独立的一对操作数，靠 `query_rope=` / `key_rope=` 两个单独的入参进算子，从不参与那个 `bmm`。

**缓存形状**：`AscendMLABackend.get_kv_cache_shape` 返回**四元组** `(num_blocks, block_size, num_kv_heads, head_size)`，前面没有那个代表「K 一份 V 一份」的 2。runner 拿到之后不按前导维切，而是回头问这一层的 `kv_lora_rank` 和 `qk_rope_head_dim`，切成两个形状不同的张量，再打成一个二元组交给算子：

| 缓存位 | 装的是什么 | 形状 | 一格多少字节 |
|---|---|---|---|
| `kv_cache[0]` | 压过的潜向量 | `(num_blocks, 128, 1, 512)` | 1024 |
| `kv_cache[1]` | RoPE 那一段 | `(num_blocks, 128, 1, 64)` | 128 |

块大小 128 由配置检查里的 `refresh_block_size` 填上，见 [block 是怎么分出来的](vllm-kv-block-allocation.md)；`get_supported_kernel_block_sizes` 跟别的后端一样报 `[128]`，所以[块表](block-table.md)那一套照旧。开了稀疏或 LI C8 时这个元组会长到三、四项，多出来的是 indexer 的 key 和它的 scale——那部分归[四种注意力的代价](attention-cost.md)。

| 看什么 | 在哪 |
|---|---|
| 走不走 MLA | 上游 `vllm/config/model.py` 的 `use_mla`；`vllm/transformers_utils/model_arch_config_convertor.py` 的 `is_deepseek_mla` |
| 压缩投影与权重合并 | 上游 `vllm/model_executor/models/deepseek_v2.py` |
| `head_size` 与 `num_kv_heads = 1` | 上游 `vllm/model_executor/layers/attention/mla_attention.py` |
| prefill / decode 两支、缓存形状、后端名 | `vllm_ascend/attention/mla_v1.py` |
| 缓存切成两个张量 | `vllm_ascend/worker/model_runner_v1.py` |
| 无 RoPE 段那一路（main / v0.26） | `vllm_ascend/ops/mla.py` |
