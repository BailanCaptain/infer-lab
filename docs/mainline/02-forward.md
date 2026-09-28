# 主线底稿 02：A4 逐层前向 · B5 多请求下的 MoE

本文件是事实底稿，不是读者页。读者页里的数字一律引用这里。计划见 `docs/plans/2026-09-27-mainline-rebuild.md`。

## 0. 本文件的前提与读法

### 0.1 定死的前提（来自计划 §3）

| 项 | 值 |
|---|---|
| 硬件 | 2 台 Atlas 800 A2，每台 8 卡，单卡 64 GB `[S]`（本文件统一按 **64 GiB = 65,536 MiB** 折算，见 §1.3 的单位说明） |
| 并行 | TP=8（节点内），DP=2（每节点一个 DP 组），EP=16，PP=1 `[S]` |
| 量化 | `--quantization ascend`，W8A8 `[S]` |
| 调度 | max-model-len 133120，max-num-batched-tokens 8192，max-num-seqs 32，gpu-memory-utilization 0.85 `[S]` |
| 图 | `cudagraph_mode=FULL_DECODE_ONLY`，捕获尺寸 4/8/16/32/64/96/128 `[S]` |
| 投机 | `deepseek_mtp`，`num_speculative_tokens=3`，`enforce_eager=true`（**仅草稿侧**：它在 `--speculative-config` 里，只关掉 MTP 草稿模型的图；主模型仍然捕获 decode 图，见 01 底稿 §A0） `[S]` |
| 执行侧 | vllm-ascend@db701c1f（孤立提交，用 `git show db701c1f:<path>` 读） |
| 控制流 | vllm@0fc695fc（该提交就是 tag `v0.23.0`，下面凡是 `vllm_version_is("0.23.0")` 的分支都走通）`[C]` |

`[C]` vllm 版本：`git describe --tags 0fc695fc` → `v0.23.0`。这条很关键：`vllm_ascend/utils.py#L763-L768` 只有在 `vllm_version_is("0.23.0")` 为真时才把 `FusedMoE` 换成 `AscendFusedMoE`、把 `KimiGatedDeltaNetAttention` 换成 `AscendKimiGatedDeltaNetAttention`。本文件描述的就是这两个 Ascend 实现。

### 0.2 模型形状（`glm-flow/reference/official-config.json` 的 `text_config`）

| 项 | 值 |
|---|---|
| 层数 / hidden / vocab | 45 / 4096 / 154880 |
| 残差流 | `mhc=true`，`hc_mult=4`，`hc_sinkhorn_iters=20` |
| 层类型 | KDA 线性注意力 34 层（`kda_layers`），稀疏 MLA 11 层（第 3、7、11 … 43 层） |
| MLP | 前 3 层稠密（`intermediate_size=12288`），第 3–44 层共 42 层 MoE |
| MoE | 288 路由专家选 8，1 个共享专家，`moe_intermediate_size=2048`，`n_group=1`、`topk_group=1`、`scoring_func=sigmoid`、`topk_method=noaux_tc`、`norm_topk_prob=true`、`routed_scaling_factor=2.5` |
| KDA | 64 头 × 128，短卷积核 4，`gate_lower_bound=-5.0` |
| MLA | 64 头，`q_lora_rank=1536`，`kv_lora_rank=512`，`qk_nope_head_dim=256`，**`qk_rope_head_dim=0`**，`v_head_dim=256` |
| 索引器 | 32 头 × 128，`index_topk=2048`，`index_kpool=4`，`index_kpool_compress=true`，`index_kpool_always_select_tail=true` |
| MTP | `num_nextn_predict_layers=1` |

`[C]` **整个 MLA 不带 RoPE**：`qk_rope_head_dim=0`，所以 `AscendGlm5NextMLAAttention.__init__` 里 `if qk_rope_head_dim > 0` 两个分支都不进，`rotary_emb=None`、`indexer_rotary_emb=None`（`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1965-L2000`）。`qk_head_dim = 256 + 0 = 256`，attention scale = 256^-0.5 = 0.0625。位置信息只由 KDA 的递归和短卷积携带。

### 0.3 示例请求 R1

- **prefill**：prompt 4 个 token，一次前向 T=4。`[A]` 4 是演示设定，真实请求套完模板至少十几个 token，见 01 A1「在我们部署下的具体数字（R1）」第一条。
- **decode 一步**：MTP 每轮 3 个草稿，`uniform_decode_query_len = 1 + 3 = 4`（`vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L814`）。所以主模型这一步也是 T=4：位置 4 是上一步采样出来的真 token，位置 5/6/7 是 MTP 的 3 个草稿；seq_len = 8。
- 于是 **R1 的 prefill 和 decode 在本文件里的张量形状完全一样（T=4）**，区别只在 attention metadata（prefill 全是新 token，decode 要读 4 个已缓存的 key）和是否走 ACL 图。这是演示长度凑出来的巧合，不是普遍规律：真实请求 prefill 的 T 等于套完模板后的 prompt 长度，比 decode 的 T=4 宽。

### 0.4 量化范围

**机制**（`[C]`）：`--quantization ascend` 走 `AscendModelSlimConfig`，它读模型目录下的 `quant_model_description.json`，**逐层**判断精度——某个前缀的 `.weight` 标成 `"FLOAT"` 就返回不量化的方法：

- `va:vllm_ascend/quantization/modelslim_config.py#L67`（`MODELSLIM_CONFIG_FILENAME = "quant_model_description.json"`）
- `#L709-L736`（`is_layer_skipped_ascend`：融合层查各分片，否则 `any(key.startswith(prefix) and value == "FLOAT")`）
- `#L632-L705`（命中就换成 `AscendUnquantizedLinearMethod` / `AscendUnquantizedFusedMoEMethod` / `UnquantizedEmbeddingMethod`）

**这份文件本机没有**，所以下面的精度划分按上游 `zai-org/GLM-5.3-Flash` 的 `config.json → quantization_config.modules_to_not_convert`（1509 条，`fmt: e4m3` 的 FP8 配方）推断，标 `[I]`。逐条统计（按层号分组）的结果是：

| 模块 | 出现次数 | 覆盖的层 | 推断精度 |
|---|---|---|---|
| `self_attn.{q,k,v}_proj`、`o_proj`、`qkv_proj`、`fused_qkvbfg_a_proj`、`f_a/f_b/g_a/g_b_proj`、`b_proj`、`*_conv1d`、`A_log`、`dt_bias`、`o_norm` | 各 **34** | 正好是 `kda_layers`（0,1,2,4,5,…,44） | BF16 |
| `self_attn.kv_b_proj`、`q_a_layernorm`、`kv_a_layernorm`、`indexer.*`（`wq_b`/`wk`/`weights_proj`/`k_norm`/`index_kpool_compress_{ape,gate}`） | 各 **12** | 11 个 MLA 层（3,7,…,43）**+ MTP 层 45** | BF16 |
| `q_a_proj` / `q_b_proj` / `kv_a_proj_with_mqa` / `fused_qkv_a_proj` | **0** | — | **量化** |
| MLA 层的 `self_attn.o_proj` | **不在表里** | — | **量化** |
| `mlp.gate`、`mlp.gate.e_score_correction_bias` | 各 43 | 3–44 + 45 | BF16（代码里本来就是 FP32） |
| `input_layernorm`/`post_attention_layernorm` | 各 46 | 0–45 | BF16 |
| `hc_*`（6 项） | 各 45 | 0–44（MTP 层不走 mHC） | FP32 |
| `model.embed_tokens`、`lm_head`、`model.norm`、`eh_proj`/`enorm`/`hnorm`/`shared_head.norm` | 各 1 | — | BF16 |
| 稠密 MLP 和专家的 `gate_proj`/`up_proj`/`down_proj` | **0** | — | **量化** |

**结论**：量化的是 **MLP 通路 + MLA 的三个大投影**——
- int8：前 3 层稠密 MLP、42+1 层的 288 个路由专家和共享专家、**MLA 的 `fused_qkv_a_proj`（由 `q_a_proj`+`kv_a_proj_with_mqa` 合并而来）、`q_b_proj`、`o_proj`**；
- BF16：**KDA 的全部投影**、MLA 的 `kv_b_proj` 和**整个索引器**、embed_tokens、lm_head、各 norm；
- FP32：router gate、mHC 混合参数、KDA 的 conv1d/`A_log`/`dt_bias`。

`[C]` 专家权重确实是 int8：`AscendW8A8DynamicFusedMoEMethod.get_weight` 分配 `w13_weight [E_local, 2*I, H] int8`、`w2_weight [E_local, H, I] int8`（`va:vllm_ascend/quantization/methods/w8a8_dynamic.py#L188-L199`）。
`[C]` 索引器的 `wk_weights_proj` 在代码里就写死了 `quant_config=None`（`va:.../glm5_next.py#L1288`），与上表一致。

**待核**：`GLM-5.3-Flash-w8a8` 的 `quant_model_description.json`。w8a8 配方与上游 FP8 配方若不同，下面所有 "BF16 / int8" 的**字节数**要跟着改，**形状和切法不变**。§1.3 和 §5.7 因此同时给出「按上游表」和「全 BF16 上界」两个值。

### 0.5 结论标记

沿用主仓 `PLAN.md` §1.4：`[S]` 官方文档/论文直接支持；`[C]` 钉住 commit 的源码行为；`[D]` 由公式 / shape / rank 规则推导；`[I]` 推断，未被一手来源直接证实。源码引用写成 `repo@commit:path#Lx-Ly`，其中 `va` = `vllm-ascend@db701c1f`，`v` = `vllm@0fc695fc`。

---

## 1. A4 总览：一次前向经过哪些站

### 1.1 层表

| 层号 | 注意力 | MLP | 站 |
|---|---|---|---|
| — | — | — | A4-1 词嵌入 + 展开四路残差 |
| 0, 1, 2 | KDA | 稠密（12288） | A4-2 |
| 3, 7, 11, 15, 19, 23, 27, 31, 35, 39, 43 | 稀疏 MLA + 索引器 | MoE | A4-4 + A4-5 |
| 其余 31 层（4–6, 8–10, …, 44） | KDA | MoE | A4-3 + A4-5 |
| — | — | — | A4-6 折叠四路残差（第 44 层末尾四路求平均）→ 最终 norm → lm_head |

`[C]` 层的装配：`va:vllm_ascend/models/glm5_next.py#L2080-L2127`（KDA 还是 MLA 看 `_is_kda_layer`，稠密还是 MoE 看 `mlp_layer_types[layer_idx]`）。模型主循环：`va:.../glm5_next.py#L2293-L2319`。

### 1.2 一次前向的集合通信清单（MC2 路径，即 **DP 组内最大** token 数 ≤ 128）

判定用的是 `num_tokens_across_dp.max()`，不是本卡的 token 数（`va:vllm_ascend/ascend_forward_context.py#L97-L98`）。两个 DP 组永远用同一种 MoE 通信方式，推导见 §6.4。

| 位置 | 次数 | 类型 | 通信域 | 单次载荷（T 个 token） |
|---|---|---|---|---|
| 词嵌入 | 1 | All-Reduce | TP8 | T × 4096 × 2 B |
| 每层注意力 `o_proj` | 45 | All-Reduce | TP8 | T × 4096 × 2 B |
| 稠密层 `down_proj` | 3 | All-Reduce | TP8 | T × 4096 × 2 B |
| MoE dispatch | 42 | MC2（EP All-to-All 变体） | EP16 | 见 §6.4 |
| MoE combine | 42 | MC2 | EP16 | 见 §6.4 |
| MoE finalize | 42 | All-Gather | TP8 | 每卡发 T/8 行 |
| MoE 共享专家 | 42 | All-Reduce | TP8 | T × 4096 × 2 B |
| lm_head | 1 | All-Gather | TP8 | 每卡发 n × 19360 × 2 B |

合计 **218 次集合通信**（1 + 45 + 3 + 42×4 + 1）。`[D]`（由上表相加）

走 AllGather 路径（batch token 数 > 128）时，MoE 每层的 4 次换成：DP All-Gather(hidden) + DP All-Gather(router_logits) + DP Reduce-Scatter + TP All-Reduce，总数仍是 218。

### 1.3 每卡权重账（TP8 + EP16）

| 部件 | 每卡每层 | ×层数 |
|---|---|---|
| `embed_tokens`（BF16） | 19360 × 4096 × 2 B = 151.25 MiB | 151.25 MiB |
| KDA 层（BF16 为主） | 34.61 MiB | ×34 = **1,176.9 MiB**（= 1.149 GiB） |
| 稠密 MLP（int8） | 18.0 MiB | ×3 = 54.0 MiB |
| MLA + 索引器（int8 19.0 + BF16 18.25，见 §5.7） | **37.25 MiB** | ×11 = 409.75 MiB |
| 路由专家（int8） | 432.0 MiB | ×42 = **17.72 GiB** |
| 共享专家（int8） | 3.0 MiB | ×42 = 126.0 MiB |
| router gate（FP32） | 4.5 MiB | ×42 = 189.0 MiB |
| mHC 混合参数（FP32，每层两套） | 3.0 MiB | ×45 = 135.0 MiB |
| `lm_head`（BF16） | 151.25 MiB | 151.25 MiB |
| **主干 45 层小计** | | **20,537 MiB = 20.06 GiB** |
| MTP 层（第 45 层，见 §7.5；**lm_head 与主模型共用，不重复计**） | | **540.75 MiB** |
| **整卡合计** | | **21,078 MiB = 20.58 GiB** |

`[D]` 每一项的算式见各站。若 MLA 的三个大投影实际未被量化（§0.4 的待核），主干变 20,746 MiB、MTP 变 559.75 MiB、整卡 **20.81 GiB**——上下界只差 0.22 GiB，不影响任何结论。

**表外的两项索引器 FP32，都不改 KV 预算**：① `index_kpool_compress_ape`（[4,128] FP32，`va:.../glm5_next.py#L1263-L1269`）每层 2,048 B，12 层共 24 KiB，随权重加载、计在 KV 预算之前，但远小于表的取整粒度，21,078 MiB / 20.58 GiB 不变；② 索引器首次前向时把 `wk_weights_proj` 和 `index_kpool_compress_gate` 各转一份 FP32 常驻缓存（`#L1293-L1297, L1349-L1352`），每层 `160×4096×4 + 128×4096×4 = 2.5 + 2.0 = 4.5 MiB`，12 层（含 MTP）**54 MiB/卡**。`[C]` 这份副本在 KV 预算量完之后才出现：profile run 不建 attention metadata（`va:vllm_ascend/worker/model_runner_v1.py#L3332-L3344, L3458-L3460`，`force_eager=is_profile` 见 `#L3417`；上游调用 `v:vllm/v1/worker/gpu_model_runner.py#L6228-L6230`），`attn_metadata is None` 时 SFA 直接 `output.fill_(0)` 返回（`va:vllm_ascend/attention/sfa_v1.py#L1660-L1666`），索引器 forward 没有执行；它要到录图或第一条真实请求才创建，和图内存一样从 `gpu_memory_utilization` 之外的 15% 里出，**3,855 / 3,908 块不变**。

**单位**：本文件一律用 GiB / MiB（1 GiB = 1024³ B）。教程写的「64GB」按 **64 GiB = 65,536 MiB** 处理：
`64 GiB × 0.85 = 54.4 GiB`，减掉 20.58 GiB 权重，剩 **≈ 33.8 GiB** 给 KV、KDA 状态、激活、索引缓冲和图。
**待核**：若驱动上报的是十进制 64 GB（= 59.6 GiB），预算变 50.66 GiB，余量 **≈ 30.1 GiB**。两者差 3.7 GiB，落到 KV 上是约 30 万 token 的容量差。

### 1.4 每卡 KV 与状态账

**存 KV 的是 12 层，不是 11 层**：MTP 的第 45 层也是一个稀疏 MLA 层（`layer_types` 只有 45 项，索引 45 越界 → `_is_kda_layer` 返回假 → 走 MLA 分支，`va:.../glm5_next.py#L216-L227, L2086-L2105`），它带自己的索引器和自己的三份 cache，并且确实进了 `kv_cache_config.kv_cache_groups`（`va:vllm_ascend/spec_decode/llm_base_proposer.py#L405-L456` 末尾 `assert not missing_layers`）。§0.4 的排除表也独立印证了这点：`kv_b_proj`/`indexer.*` 各出现 12 次，层号是 3,7,…,43 **和 45**。

| 项 | 每单位 | 说明 |
|---|---|---|
| MLA 隐向量 cache | 1024 B / token / 层 × **12** = **12,288 B/token** | BF16，TP 之间**复制**不切 |
| 索引器压缩 K cache | 64 B / token / 层 × **12** = **768 B/token** | BF16，4 个 token 压成 1 条 128 维 |
| **合计 KV** | **13,056 B/token = 12.75 KiB/token** | 一个满长请求（133120 token）= **1.619 GiB** |
| 一个 block id（640 token） | 13,056 × 640 = **8,355,840 B** | 12 层一起算，逻辑块 640 见 §5.6 |
| kpool 尾状态 | 4096 B / 请求 / 层 × 12 = **48 KiB/请求** | FP32，一页一请求 |
| KDA 状态 | 655,360 B/页 × **4 页** × 34 层 = **85.0 MiB/请求** | 见 §4.5；32 槽 ≈ **2.66 GiB** |
| top-k 索引缓冲（主干） | 8192 × 2051 × 4 B = **64.09 MiB** | 11 个 MLA 层共用一份 |
| top-k 索引缓冲（MTP） | 8192 × 2176 × 4 B = **68.0 MiB** | MTP 另开一份，宽度向上取到 128 的倍数（`va:vllm_ascend/models/glm5_next_mtp.py#L64-L77`） |

---

## 2. A4-1 词嵌入与四路残差

### 2.1 做了什么

把每个 token id 换成一条 4096 维的向量。GLM-5.3-Flash 和普通模型不一样：它不是只留一条残差，而是把这条向量复制成 **4 条并行的残差流**，往后每一层的注意力、MLP 两个子层前后，都在这 4 条流之间各做一次可学习的混合，每层两次（mHC，multi-head hyper-connection）。

### 2.2 怎么走的

1. `AscendGlm5NextModel.forward` → `self.embed_tokens(input_ids)` — `va:vllm_ascend/models/glm5_next.py#L2301-L2305`
2. `embed_tokens` 是 `VocabParallelEmbedding`，构造在 `va:.../glm5_next.py#L2263-L2268`；运行时被换成 `AscendVocabParallelEmbedding`（`va:vllm_ascend/utils.py#L748`）
3. `AscendVocabParallelEmbedding.forward` → `_forward_origin`（因为 `embedding_tp_enable()` 默认假，`va:vllm_ascend/utils.py#L881-L883`，`finegrained_tp_config.embedding_tensor_parallel_size` 默认 0，`va:vllm_ascend/ascend_config.py#L513`）— `va:vllm_ascend/ops/vocab_parallel_embedding.py#L164-L168, L229-L250`
4. 本卡只持有 vocab 的一段，不在段内的 id 被 mask 成 0，再 `torch.ops.vllm.maybe_pad_and_reduce` 做 TP8 All-Reduce — `va:vllm_ascend/ops/register_custom_ops.py#L84-L95`（`flash_comm_v1_enabled` 为假时就是 `tensor_model_parallel_all_reduce`）
5. 进第 0 层后 `_expand_mhc_residual_streams` 把 `[T,4096]` 复制成 `[T,4,4096]` 再摊平成 `[T,16384]` — `va:.../glm5_next.py#L148-L153, L2212-L2215`
6. 每个子层（注意力、MLP）前后各做一次 mHC：`hc_pre` → 子层 → `hc_post` — `va:.../glm5_next.py#L2147-L2169, L2217-L2235`
7. 最后一层结束时 `hidden_states.view(T, 4, -1).mean(dim=1)` 折回一条 — `va:.../glm5_next.py#L2237-L2239`

mHC 的数学形式（Ascend 用融合算子 `npu_hc_pre_v2` / `npu_hc_post`，参考实现见 `glm-flow/reference/modeling_glm5_next.py#L255-L296, L1296-L1328`）：

```
flat        = UnweightedRMSNorm(streams.flatten())        # [T, 16384]
pre,post,comb = Linear(flat, fn[24, 16384]) + base[24]     # 24 = (2+4)*4
pre         = sigmoid(scale0*pre  + base_pre) + eps        # [T, 4]
post        = 2*sigmoid(scale1*post + base_post)           # [T, 4]
comb        = Sinkhorn(softmax(scale2*comb + base_comb))   # [T, 4, 4]，20 轮双随机化
子层输入     = Σ_h pre[:,h] * streams[:,h,:]                # [T, 4096]  ← 4 条流压成 1 条
子层输出 y   = attn(...) 或 mlp(...)                        # [T, 4096]
新的 streams = post ⊗ y + combᵀ @ streams                   # [T, 4, 4096]
```

### 2.3 本部署下的数字

- 词表 154880，TP8，**154880 / 8 = 19360 行/卡**；154880 % 64 == 0，所以没有 padding。`[D]`
- 每卡嵌入权重：19360 × 4096 × 2 B = 158,597,120 B = **151.25 MiB**（BF16）。`[D]`
- R1（T=4）：嵌入后 All-Reduce 载荷 4 × 4096 × 2 = **32,768 B**。`[D]`
- 展开四路后每 token 的残差 = 4 × 4096 × 2 B = 32,768 B；R1 的残差张量 `[4, 4, 4096]` = **128 KiB**。`[D]`
- mHC 参数（每层，FP32，**不切 TP**）：`hc_attn_fn`/`hc_ffn_fn` 各 24 × 16384 × 4 B = 1,572,864 B = 1.5 MiB，两套共 **3.0 MiB/层**，45 层 **135 MiB/卡**，外加两组 base(24)/scale(3)。`[D]`（`va:.../glm5_next.py#L2137-L2145`）
- 四路残差带来的代价：**每层要做两次 `[T,16384] × [16384,24]` 的 GEMM 和两次 20 轮 Sinkhorn**，而不是一次简单加法。注意力前（`hc_attn_*`，`va:.../glm5_next.py#L2217`）和 MLP 前（`hc_ffn_*`，`#L2227-L2232`）各调一次 `hc_pre`，每次都把 `hc_sinkhorn_iters`（本模型配置 20，缺省也取 20，`#L2134`）传给 `npu_hc_pre_v2`（`#L2147-L2160`）。`[C]`
- 主干 45 层一次前向合计：**90 次 `hc_pre`（每次一个 GEMM + 一次 Sinkhorn），共 1,800 轮 Sinkhorn**，另有 90 次 `hc_post`。MTP 层不走 mHC（§7.5），不计。`[D]`

### 2.4 对应知识页

`embedding.md`、`token.md`、`layers-and-hidden.md`、`tensor-parallel.md`、`mlp-residual-norm.md`、`vllm-v1-shape.md`

### 2.5 待核

- `npu_hc_pre_v2` / `npu_hc_post` 的 AscendC 实现与参考实现是否数值等价（只对了接口和参数顺序，没跑过）。
- 第 0 层之前 `input_layernorm` 与 `hc_pre` 的先后：代码里 `hc_pre` 在 `input_layernorm` 之前（`#L2217-L2218`），参考实现也是 `attn_hc` 在前，一致；但 mHC 内部自带一个 unweighted RMSNorm，两次 norm 的含义要在读者页里讲清楚。

---

## 3. A4-2 前 3 层：稠密 MLP

第 0/1/2 层的**注意力是 KDA**（`kda_layers` 含 0,1,2），只有 MLP 是稠密的。这一站只讲 MLP，注意力见 §4。

### 3.1 做了什么

一个标准的 SwiGLU 前馈网络：把 4096 维升到 12288 维两份（gate 和 up），先在 SiLU 之前限幅——gate 只限上界（≤ 10，下界不限），up 限到 [−10, 10]——再做 `silu(gate)*up`，乘积本身不再截断（`va:vllm_ascend/ops/activation.py#L46-L54`，上游 `vllm/model_executor/layers/activation.py#L179-L183` 写法相同），再降回 4096 维。TP8 下 12288 这一维被切成 8 份，最后一次 All-Reduce 把 8 份部分和加起来。

### 3.2 怎么走的

1. `AscendGlm5NextDecoderLayer.forward` → `self.mlp(hidden_states)` — `va:.../glm5_next.py#L2233-L2234`
2. `AscendGlm5NextMLP.forward`：`gate_up_proj` → `act_fn` → `down_proj` — `va:.../glm5_next.py#L1438-L1442`
3. `gate_up_proj` = `MergedColumnParallelLinear(4096, [12288, 12288])`，`down_proj` = `RowParallelLinear(12288, 4096, reduce_results=True)` — `va:.../glm5_next.py#L1416-L1432`
4. 激活是 `SiluAndMulWithClamp(swiglu_limit=10.0)` — `va:.../glm5_next.py#L1433-L1436`
5. 两个 Linear 运行时换成 `AscendMergedColumnParallelLinear` / `AscendRowParallelLinear` — `va:vllm_ascend/utils.py#L741-L745`
6. `down_proj` 的 All-Reduce：`RowParallelLinear` 在 `reduce_results=True` 且 TP>1 时做 `tensor_model_parallel_all_reduce`

### 3.3 本部署下的数字（每卡每层）

- `gate_up_proj`：输出 2 × 12288 = 24576，TP8 → **每卡 3072 列**，权重 `[3072, 4096] int8` = 12,582,912 B = **12.0 MiB**。`[D]`
- `down_proj`：输入 12288，TP8 → **每卡 1536 行**，权重 `[4096, 1536] int8` = 6,291,456 B = **6.0 MiB**。`[D]`
- 每层每卡合计 **18.0 MiB**，三层 **54.0 MiB**。`[D]`
- R1（T=4）每层的张量：`[4,4096] → [4,3072] → silu/mul → [4,1536] → [4,4096]`。`[D]`
- 每层通信 **2 次 TP8 All-Reduce**（注意力 `o_proj` 一次、MLP `down_proj` 一次），单次载荷 4 × 4096 × 2 = **32,768 B**。`[D]`
- 如果换成 6048 个 token 的大 batch（场景 M 的 DP0），单次 All-Reduce 载荷 6048 × 4096 × 2 = **47.25 MiB**。`[D]`

### 3.4 W8A8 在这里的算子

`[I]` 稠密 MLP 走 `AscendW8A8DynamicLinearMethod`（`va:vllm_ascend/quantization/methods/w8a8_dynamic.py#L61-L73` 分配 `[out, in] int8` 权重 + per-channel `weight_scale`/`weight_offset`）：激活每 token 动态量化 → `npu_quant_matmul` → 反量化。

**待核**：稠密 MLP 具体命中哪个 `apply` 分支、是否与共享专家一样用 `npu_dequant_swiglu_quant` 融合，没有逐行跟到底。

### 3.5 对应知识页

`mlp-residual-norm.md`、`tensor-parallel.md`、`matmul-and-weights.md`、`quantization.md`、`collective-communication.md`

---

## 4. A4-3 34 层 KDA 线性注意力

### 4.1 做了什么

KDA（Kimi Delta Attention）是**线性注意力**：它不保存每个历史 token 的 key/value，而是把整段历史压进一个固定大小的矩阵状态 `S[128,128]`（每个头一个）。每来一个新 token，就用一个带遗忘门的 delta 规则更新这个矩阵，再用 query 去读它。所以 **KDA 层完全不占 KV cache，只占每个请求固定的一小块状态**——这是这个模型能把 max-model-len 开到 133120 的主要原因（45 层里有 34 层不随长度增长）。

它前面还有一个 kernel=4 的因果短卷积，作用在 q/k/v 上，用来混合最近 4 个 token。

### 4.2 怎么走的

1. 层里构造的是 `KimiGatedDeltaNetAttention`（`va:.../glm5_next.py#L2080-L2085`），运行时被换成 `AscendKimiGatedDeltaNetAttention`（`va:vllm_ascend/utils.py#L763-L768`，v0.23.0 分支）
2. 权重定义在上游：`v:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L102-L231`
3. `AscendKimiGatedDeltaNetAttention.forward` — `va:vllm_ascend/ops/kimi_kda.py#L244-L291`
   - `q_proj`/`k_proj`/`v_proj`（各 ColumnParallel 4096→8192）
   - `beta = sigmoid(b_proj(x))`（ColumnParallel 4096→64，每头一个标量）
   - `raw_gate = f_b_proj(f_a_proj(x))`（低秩 4096→128→8192）
   - `output_gate = g_b_proj(g_a_proj(x))`（低秩 4096→128→8192）
   - `torch.ops.vllm.kda_attention(...)` → `_forward`
   - `o_norm`（`FusedRMSNormGated`，sigmoid 门）→ `o_proj`（RowParallel 8192→4096）→ **TP8 All-Reduce**
4. `_forward` 里先跑短卷积 `npu_causal_conv1d_custom`（`va:vllm_ascend/ops/kimi_kda.py#L294-L331`），再分岔：
   - **prefill**：`l2norm_fwd(q)`、`l2norm_fwd(k)` → `kda_gate_cumsum`（chunk=64）→ `chunk_kda_fwd`，并把最终状态写回 `recurrent_state` — `va:vllm_ascend/ops/kimi_kda.py#L390-L475`，`_KDA_CHUNK_SIZE=64` 在 `#L38`
   - **decode**：`recurrent_kda`（一次一个 token 地更新状态，门和 L2-norm 都在 kernel 里做）— `va:vllm_ascend/ops/kimi_kda.py#L355-L388`
5. 状态形状：`kimi_kda_state_shape` — `va:vllm_ascend/ops/kimi_kda_state.py#L9-L31`；dtype 由 `MambaStateDtypeCalculator.kda_state_dtype` 给出 = (conv: 模型 dtype, recurrent: **FP32**) — `v:vllm/model_executor/layers/mamba/mamba_utils.py#L119-L125`；模型侧入口 `va:.../glm5_next.py#L2489-L2509`

### 4.3 64 个头怎么切到 8 张卡

- `local_num_heads = 64 / 8 = **8 头/卡**`（`v:.../kimi_gdn_linear_attn.py#L113-L115`）
- `projection_size = 64 × 128 = 8192`，ColumnParallel 后 **每卡 1024 列**
- `o_proj` 是 RowParallel，**每卡 1024 行输入**，输出 4096，做一次 All-Reduce

### 4.4 每卡权重（每层，BF16）

| 参数 | 每卡形状 | 字节 |
|---|---|---|
| `q_proj`/`k_proj`/`v_proj` | 3 × [1024, 4096] | 25,165,824 = 24.0 MiB |
| `o_proj` | [4096, 1024] | 8,388,608 = 8.0 MiB |
| `f_a_proj`/`g_a_proj`（Replicated，不切） | 2 × [128, 4096] | 2,097,152 = 2.0 MiB |
| `f_b_proj`/`g_b_proj` | 2 × [1024, 128] | 524,288 = 0.5 MiB |
| `b_proj` | [8, 4096] | 65,536 |
| `q/k/v_conv1d`（FP32） | 3 × [1024, 4] | 49,152 |
| `dt_bias`(FP32) / `A_log`(FP32) | [1024] / [1,1,8,1] | 4,096 + 32 |
| **合计/层/卡** | | **34.61 MiB** |

34 层合计 36,294,688 × 34 = 1,234,019,392 B = **1,176.9 MiB = 1.149 GiB/卡**。`[D]`

### 4.5 状态张量有多大

`va:vllm_ascend/ops/kimi_kda_state.py#L27-L30`：

```
local_conv_dim = 3 * 64 * 128 / 8 = 3072
state_len      = conv_kernel_size - 1 + num_spec = 4 - 1 + 3 = 6     ← MTP 多留 3 个槽
conv_state     = (3072, 6)   BF16  = 36,864 B   = 36 KiB
recurrent_state= (8, 128, 128) FP32 = 524,288 B = 512 KiB            ← 每头一个 128×128 矩阵
原始状态 mamba_raw_size = 561,152 B
```

两个维度的先后由 `is_conv_state_dim_first()` 决定（`va:vllm_ascend/ops/kimi_kda_state.py#L28-L30`：真时 `(local_conv_dim, state_len)`，假时反过来），字节数不变；本文件一律写成 `(3072, 6)`。

`[C]` **但一个请求占的不是 561,152 B，而是 4 页 × 655,360 B。** 两处放大：

1. **页被补齐到 MLA 的页大小**。`_get_mamba_target_page_size` 对 GLM5 返回 `max(attn_page_size, mamba_raw_size)`（`va:vllm_ascend/patch/platform/patch_mamba_config.py#L44-L56`），`attn_page_size = block_size × attn_token_page_size = 640 × 1024 = 655,360`（`#L171`），于是 `cache_config.mamba_page_size_padded = 655,360`，**填充 14.4%**（`#L191-L203`）。这是为了让一个 MLA 页和一个 KDA 页能共用同一块物理显存槽。
2. **投机解码多要 3 页**。`MambaSpec.num_speculative_blocks = num_speculative_tokens = 3`（`v:vllm/model_executor/layers/mamba/abstract.py#L44-L60`），`max_memory_usage_bytes = page_size_bytes × (1 + num_speculative_blocks)`（`v:vllm/v1/kv_cache_interface.py#L627-L636`，默认 `mamba_cache_mode == "none"` 分支）；分配侧同样 `num_tokens += block_size × num_speculative_blocks`（`v:vllm/v1/core/single_type_kv_cache_manager.py#L1073-L1080`）。而 `mamba_block_size = max_model_len = 133120`（`va:patch_mamba_config.py#L225-L228`），所以一个请求无论多长都只要 1 块，加上投机共 **4 块**。

- 每层每请求每卡 = 655,360 × 4 = 2,621,440 B = **2.5 MiB**
- **34 层 = 89,128,960 B = 85.0 MiB / 请求 / 卡**。`[D]`
- `max-num-seqs=32` → 每卡约 **2.66 GiB** 常驻 KDA 状态，占 §1.3 那 33.8 GiB 余量的 8%。`[D]`
- 对比 MLA：一个 133120 token 的满长请求 KV 是 1.619 GiB，而 KDA 状态无论多长都是 85.0 MiB。`[D]` 换个说法：KDA 状态相当于 **约 6,827 个 token 的 KV**（89,128,960 / 13,056），短请求下它反而是大头。

### 4.6 通信在哪里发生

**KDA 层里只有 1 次集合通信**：`o_proj` 的 TP8 All-Reduce，载荷 `T × 4096 × 2 B`。`[C]`

`forward` 开头那句 `maybe_all_gather_and_maybe_unpad`（`va:kimi_kda.py#L256-L259`）在本部署下是空操作：`flash_comm_v1_enabled = enable_sp(...) and ...`，而 `enable_sp` 读 `ascend_config.enable_flashcomm1`，默认来自环境变量 `VLLM_ASCEND_ENABLE_FLASHCOMM1`，默认 `"0"`（`va:vllm_ascend/envs.py#L75`、`va:vllm_ascend/ascend_config.py#L84-L91`、`va:vllm_ascend/utils.py#L905-L930`、`va:vllm_ascend/ascend_forward_context.py#L127-L137`）。教程的启动命令没有 `--additional-config`，所以 **序列并行/FlashComm1 全程关闭**。`[C]`

短卷积状态和递归状态都是**卡本地**的（每卡只存自己 8 个头的部分），跨卡不需要同步。`[D]`

### 4.7 R1 的具体数字

prefill T=4（每卡）：

```
x [4,4096] → q,k,v 各 [4,1024] → reshape [1,4,8,128]
beta [1,4,8]        raw_gate [1,4,8,128]      output_gate [4,8,128]
短卷积：mixed_qkv [4,3072] 与本请求那一页的 conv_state (3072, 6) 拼接，kernel 4
chunk_kda_fwd：chunk=64，4 个 token 只有 1 个 chunk
写回 recurrent_state[slot] ← [8,128,128] FP32
o_norm → [4,1024] → o_proj → [4,4096] → All-Reduce 32,768 B
```

decode T=4（同形状，但走 `recurrent_kda`，一次推进 4 个 token 的状态，并按 `num_accepted_tokens` 回滚未被接受的草稿）。`[C]`（`va:kimi_kda.py#L355-L388` 的 `num_accepted_tokens` 参数）

### 4.8 对应知识页

`linear-attention.md`、`kv-cache-spec.md`、`attention-backend-family.md`、`tensor-parallel.md`、`ops-and-kernels.md`、`speculative-decoding.md`

### 4.9 待核

- `chunk_kda_fwd` / `recurrent_kda` 的算术强度和实测耗时（只读了接口）。
- `num_accepted_tokens` 在 conv_state 里回滚的确切语义（`state_len` 多留 3 槽是为它，但回滚逻辑在 AscendC kernel 里）。
- 前 3 层的 KDA 与其余 31 层是否有任何差别（从 config 和代码看没有）。

---

## 5. A4-4 11 层稀疏 MLA（低秩压缩 + 索引器 + kpool）

这是全模型最复杂的一站，拆成 5 小节：低秩压缩（§5.2）、索引器算分（§5.3）、kpool 压缩与 top-2048 选择（§5.4）、稀疏注意力（§5.5）、KV cache 账（§5.6）。

### 5.1 做了什么

MLA 把每个 token 的 key 和 value 压成**一条 512 维的隐向量**存进 cache（而不是 64 个头各存 256 维的 k 和 v），省掉 64 倍的显存。代价是算的时候要把它"解压"回来——但可以把解压矩阵**吸收**进 query 和输出投影里，于是注意力直接在 512 维隐空间里做。

在这之上再加一层稀疏：一个 32 头的小"索引器"先给历史打分，只挑出 **2048 个最相关的 token** 参与真正的注意力。而且打分不是逐 token 做的，是 **4 个 token 压成一个 pool** 之后对 pool 打分（`index_kpool=4`），挑 512 个 pool 展开成 2048 个 token，再把还没凑满一个 pool 的因果尾巴（最多 3 个）补上。

### 5.2 低秩压缩：形状和切法

调用链：

1. `AscendGlm5NextMLAAttention.forward` → `AscendIndexerKPoolMLAAttention.forward` → `torch.ops.vllm.indexer_kpool_mla_forward` — `va:.../glm5_next.py#L2043-L2050`、`va:vllm_ascend/ops/indexer_kpool_mla.py#L193-L206`
2. → `AscendIndexerKPoolMLAImpl.forward`（三份 cache 的角色检查）— `va:vllm_ascend/attention/indexer_kpool_mla_v1.py#L800-L855`
3. → 父类 `AscendSFAImpl.forward` — `va:vllm_ascend/attention/sfa_v1.py#L1650-L2032`

原生路径（`va:sfa_v1.py#L1756-L1792`）：GLM 子类在初始化时明确把 `enable_sfa_prolog_v3` 和 `enable_mlapo` 设为 False（`va:vllm_ascend/attention/indexer_kpool_mla_v1.py#L573-L579`），因此本部署确定走这里；其中 `indexer_select_pre_process` 和 `exec_kv` 动态派发到该子类的重写（同文件 `#L705-L788`），不是基类的同名实现。

```
qkv_lora = fused_qkv_a_proj(x)                  # [T,4096] → [T,2048]
q_c, kv_no_split = split(qkv_lora, [1536, 512]) # q 低秩 1536；kv 隐向量 512（rope 维 0）
q_c = q_a_layernorm(q_c)
k_li = indexer_select_pre_process(x)            # 索引器的 K，见 §5.3
exec_kv(...)  → kv_c = RMSNorm(kv_no_split)，写进分页 KV cache
```

然后（`va:sfa_v1.py#L1349-L1361, L1994-L2028`）：

```
q_nope, _ = q_proj(q_c).view(T, 8, 256)          # q_b_proj，每卡 8 个头
ql_nope   = bmm(q_nope^T, W_UK_T)                # [8,T,256] × [8,256,512] → [8,T,512]  ← 吸收 W_UK
attn_out  = 稀疏注意力(ql_nope, packed_kv, topk_indices)   # [T,8,512]
attn_out  = _v_up_proj(attn_out)                 # [T,8,512] × [8,512,256] → [T,2048]   ← 吸收 W_UV
output    = o_proj(attn_out)                     # RowParallel [2048]→[4096] + TP8 All-Reduce
```

`W_UK_T` / `W_UV` 是 `kv_b_proj` 权重在 `process_weights_after_loading` 里拆出来的（`va:sfa_v1.py#L776-L793`），拆完 `kv_b_proj` 本体被释放。

**切法**：

| 模块 | 并行方式 | 全局形状 | 每卡形状 |
|---|---|---|---|
| `fused_qkv_a_proj` | **Replicated**（`disable_tp=True`） | [2048, 4096] | [2048, 4096] |
| `q_b_proj` | ColumnParallel | [16384, 1536] | [2048, 1536] |
| `kv_b_proj` → `W_UK_T`/`W_UV` | ColumnParallel | [32768, 512] | [4096, 512] → [8,256,512] + [8,512,256] |
| `o_proj` | RowParallel | [4096, 16384] | [4096, 2048] |
| `indexer.wq_b` | **Replicated** | [4096, 1536] | [4096, 1536] |
| `indexer.wk_weights_proj` | **Replicated**（`disable_tp=True`） | [160, 4096] | [160, 4096] |
| `indexer.index_kpool_compress_gate` | 不切 | [128, 4096] | [128, 4096] |

`[C]` 源码：`va:.../glm5_next.py#L1916-L1963`（MLA 各投影）、`#L1277-L1291`（索引器投影）。
`[D]` **64 头 / 8 卡 = 每卡 8 个 MLA 头**；索引器的 32 个头**每张卡都算一遍**（`wq_b` 和 `wk_weights_proj` 都是 Replicated）。这是拿冗余计算换掉一次通信。

### 5.3 索引器：怎么给历史打分

`AscendGlm5NextIndexer.forward` — `va:.../glm5_next.py#L1333-L1400`：

```
q = wq_b(q_c).view(T, 32, 128)                       # 复用 MLA 的 q 低秩 1536
kw = hidden_f32 @ wk_weights_proj^T                  # [T,4096] → [T,160]
k        = k_norm(kw[:, :128])                       # [T,128]   索引器的 key，FP32 链路
weights  = kw[:, 128:].to(bf16) * (128^-0.5 * 32^-0.5)   # [T,32]  每个头一个权重
gate_score = hidden_f32 @ index_kpool_compress_gate^T    # [T,128] pool 内的 softmax 打分
→ indexer_op(hidden, q, weights, k, gate_score, compress_ape, index_kpool=4, positions)
```

运行入口是 `AscendSparseAttnIndexerKpool.forward_ascend`（`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1140-L1232`），先调用压池算子，再调用 `torch.ops.vllm.glm5_next_lightning_indexer`。后者由 `vllm-ascend@db701c1f:vllm_ascend/ops/glm5_next_lightning_indexer.py#L419-L504` 选择 triton 或 PyTorch 回退路径。`[C]`

triton 路径先算 `q̄ = Σⱼ weightsⱼ × qⱼ`，再算池分 `q̄ · 池 K`（`vllm-ascend@db701c1f:vllm_ascend/ops/triton/glm5_next_lightning_indexer.py#L23-L237`，合成查询在 L173–175，点积在 L122）。PyTorch 回退的 `_bf16_mqa_logits` 使用同一公式（`vllm-ascend@db701c1f:vllm_ascend/ops/glm5_next_lightning_indexer.py#L166-L173`）。两条运行路径都直接累加带符号的点积；DSA 的逐头 ReLU 由这一线性公式替代。`qk_rope_head_dim=0`，本配置保留未旋转的 Q、K。`[C]`

### 5.4 kpool 是什么，top-2048 怎么选出来

**kpool = 把连续 4 个 token 的索引器 K 压成一条**，索引器只对压缩后的条目打分，选中一条就等于选中它代表的 4 个 token。

压缩规则 — 运行算子 `glm5_next_kpool_state_compress_and_write_cache`，`vllm-ascend@db701c1f:vllm_ascend/ops/glm5_next_kpool_state_compress.py#L139-L293`（入口选择 triton 路径；同文件回退在 L200–202 明列逐通道 softmax 公式）：

```
scores      = slot_score + compress_ape          # [P, 4, 128]，compress_ape 是 [4,128] FP32 的可学习位置偏置
compressed_k= Σ_over_4 softmax(scores, dim=1) * slot_k   # [P, 128] → 转 BF16 写进索引器 cache
```

选择规则 — `vllm-ascend@db701c1f:vllm_ascend/ops/triton/glm5_next_lightning_indexer.py#L131-L237`（`glm5_next_lightning_indexer_triton`）：

```
pool_topk    = index_topk / index_kpool = 2048 / 4 = 512      ← 最多选 512 个有效 pool
token_ids    = pool_id * 4 + [0,1,2,3]                        ← 每个选中 pool 展开 4 个位置
tail_start   = floor((position + 1) / 4) * 4
tail_count   = position + 1 - tail_start                      ← 因果尾部有 0–3 个位置
输出宽度      = 2048 + 3 = 2051
```

prefill 与 decode 都经上述运行入口。NPU、非空输入、128 维头且池预算 ≤512 时走 triton；它在同一个算子调用内完成打分、选池、展开和补尾，其余条件走 `ops/glm5_next_lightning_indexer.py` 的回退实现。尾部固定追加；配置的 `index_kpool_always_select_tail` 在这条路径上仅保留为配置字段。模型文件中的 `indexer_kpool_topk_decode` 等静态方法归属单测参考实现，生产推理入口见 §5.3。

`[C]` 这个 2051 正好对上模型初始化时开的缓冲：
```python
topk_indices_buffer = torch.empty(max_num_batched_tokens, index_topk + index_kpool - 1, dtype=int32)
```
`va:.../glm5_next.py#L2252-L2259` → **8192 × 2051 × 4 B = 67,207,168 B = 64.09 MiB**，主干 11 个 MLA 层共用一份。`[D]` MTP 层另开一份，并把宽度向上取到 128 的倍数（2051 → 2176），是 **68.0 MiB**（`va:vllm_ascend/models/glm5_next_mtp.py#L64-L77`）；两份合计 132.1 MiB 的常驻缓冲。

`[D]` **稀疏什么时候才真的起作用**：历史最多 2051 个位置时，512 个完整 pool 加最多 3 个尾部位置覆盖得下全部历史（无效位置填 -1），等价于稠密 attention。R1 的历史从 4 增到 8 个位置时，完整 pool 从 1 个增到 2 个，中间各步的尾部有 0–3 个位置。长上下文才真正减少读取：133120 个位置形成 33280 个 pool，选中的 512 个约占 1.5%；此时尾部为 0，读 2048 条 KV，读取量为全历史的 1/65。

### 5.5 稀疏注意力本身

`[C]` 本部署（A2、`db701c1f`）的实际调用链：

1. 父类 `AscendSFAImpl.forward` 在 `va:vllm_ascend/attention/sfa_v1.py#L1994-L2002` 调用 `self._execute_sparse_flash_attention_process`，动态派发到 **`AscendIndexerKPoolMLAImpl` 的重写**（`va:vllm_ascend/attention/indexer_kpool_mla_v1.py#L1065-L1104`）。重写从三份 cache 中取出完整的 packed MLA KV，传给 `DeviceOperator.execute_sparse_attention_indexer_kpool_mla`。
2. A2 的 `DeviceOperator` 选中 `BaseDeviceAdaptor`（`va:vllm_ascend/device/device_op.py#L2317-L2326`），执行同文件 `#L719-L793`：以 packed KV 同时作为 key/value，调用 `torch.ops._C_ascend.npu_sparse_flash_attention`；`query_rope=None`、`key_rope=None`、`sparse_block_size=1`、`sparse_mode=3`、`attention_mode=2`，query/KV 布局分别为 `TND` / `PA_BSND`。本模型 RoPE 维为 0，拼接后的 query 仍是 `[T,8,512]`。
3. NPU 注册绑定在 `va:csrc/torch_binding.cpp#L2849-L2859`，实际适配函数在 `va:csrc/attention/sparse_flash_attention/sparse_flash_attention_torch_adpt.h#L93-L149`，通过 `EXEC_NPU_CMD` 调用 `aclnnSparseFlashAttention`。返回后仍走父类的 `_v_up_proj` 和 `o_proj`（`va:vllm_ascend/attention/sfa_v1.py#L2004-L2028`）。

基类 `sfa_v1.py#L1603-L1649` 的同名方法不在这条执行路径上。`_sparse_attention_pytorch`（`va:vllm_ascend/attention/indexer_kpool_mla_v1.py#L857-L1064`）也没有生产调用点，只有 `tests/ut/models/test_glm5_next_indexer_kpool_mla.py` 调用；其 query chunk=16 只是单测参考实现的分块常量，不能用来描述 NPU 推理的 tiling。

`[D]` 按有效选中位置推导每个 query token 在每张卡上的 QK/PV 计算量上界（不含 softmax、投影及 kernel 补齐开销）：

```
8 个头 × 2051 个 key × 512 维（QK）  = 8.40 M MAC
8 个头 × 2051 个 value × 512 维（PV）= 8.40 M MAC
合计 ≈ 33.6 MFLOP / token / 层 / 卡；11 层 ≈ 370 MFLOP / token
```

上面的 2051 是**长历史下的读取上界**，实际为 2048 加上 0–3 个尾部位置；短序列按有效 pool 数和尾部算（见 §5.4）。

同样按长历史的有效位置上界，选中 KV 的逻辑数据量（隐空间，BF16）为 `2051 × 512 × 2 B = 2.00 MiB / token / 层 / 卡`，12 层（含 MTP）**24.0 MiB / token**，只算主干 11 层是 22.0 MiB。`[D]` 因为 MLA cache 在 TP 组内是复制的，每卡都需要这些 KV；这些数没有计入 kernel 的重复加载、分块与缓存复用，不是实测 HBM 读取量。

### 5.6 KV cache 每层每 token 占多少字节，按卡怎么切

一个 MLA 层挂 **3 份独立的 cache**（`va:vllm_ascend/ops/indexer_kpool_mla.py#L178-L182`，角色顺序 `("kv", "indexer_state", "indexer")` 在 `va:indexer_kpool_mla_v1.py#L818-L822` 校验）：

#### 逻辑块是 640 个 token，不是 128

`[C]` `cache_config.block_size` 被 vllm-ascend 的补丁**就地改写**成 640：

```python
# va:vllm_ascend/patch/platform/patch_mamba_config.py
GLM5_KERNEL_BLOCK_SIZE = 128                                            # #L11
attn_token_page_size = kv_lora_rank * num_kv_heads * 2 = 512 * 1 * 2 = 1024   # #L112-L118
mamba_raw_size       = 36,864 + 524,288 = 561,152                       # #L99-L101
min_attn_block_size  = 128 * cdiv(561152, 128 * 1024) = 128 * 5 = 640    # #L131-L136
attn_block_size      = 128 * cdiv(max(requested, 640), 128) = 640        # #L137-L141
cache_config.block_size = attn_block_size                                # #L153-L159
```

含义：一个**逻辑块**必须大到能装下一整份 KDA 状态（561,152 B），好让 MLA 页和 KDA 页共用同一个物理槽；同时它必须是 SFA kernel 块 128 的整数倍，于是取 5 × 128 = 640。`128` 只是 kernel 块——`va:vllm_ascend/attention/indexer_kpool_mla_v1.py#L138-L146` 明确写着 `if logical_block_size % GLM5_SFA_KERNEL_BLOCK_SIZE: raise …` 和 `kernel_blocks_per_logical_block = logical // 128`，**一个逻辑块 = 5 个 kernel 块**。三份 cache 的 `block_size` 都取自这个 `cache_config.block_size`（`va:vllm_ascend/ops/indexer_kpool_mla.py#L77`）。

| cache | spec | 形状 | dtype | 一页 | 每 token | 出处 |
|---|---|---|---|---|---|---|
| 主 MLA KV | `MLAAttentionSpec(num_kv_heads=1, head_size=512, compress_ratio=1)` | [blocks, **640**, 1, 512] | **BF16（硬编码）** | 640 × 512 × 2 = **655,360 B = 640 KiB** | **1024 B/层** | `va:indexer_kpool_mla.py#L121-L134`，dtype 在 `#L74-L76` |
| 索引器 K | `MLAAttentionSpec(num_kv_heads=1, head_size=128, compress_ratio=4)` | [blocks, **160**, 1, 128] | BF16 | 160 × 128 × 2 = **40,960 B = 40 KiB** | **64 B/层** | `va:.../glm5_next.py#L295-L307, L1306-L1313` |
| kpool 尾状态 | `AscendIndexerKPoolStateSpec(block_size=4, head_size=256, sliding_window=4)` | [pages, 4, 256] | **FP32** | 4 × 256 × 4 = 4,096 B | 4096 B / **请求** / 层（滑动尾巴，不随长度增长） | `va:.../glm5_next.py#L312-L362, L1298-L1304` |

- `head_size = kv_lora_rank + qk_rope_head_dim = 512 + 0 = 512`（`va:indexer_kpool_mla.py#L71`）
- 索引器的 `storage_block_size = block_size // compress_ratio = 640 / 4 = **160**` 个压缩条目（`v:vllm/v1/kv_cache_interface.py#L364-L367`），即一页仍覆盖 640 个 token，每个 kernel 块里 32 条。
- 每 token 的字节数不受块大小影响：655,360 / 640 = 1024，40,960 / 640 = 64。

**按卡怎么切：不切。** `num_kv_heads=1`，TP 组里 8 张卡各存一份**完全相同**的 MLA KV。`[D]` 这是 MLA 的标准行为，也是它和 GQA 最大的区别：GQA 的 KV 按头切、TP8 下每卡 1/8；MLA 的隐向量只有一份，每卡都要完整存。

**每 token 合计**：主干 11 层 + MTP 第 45 层 = **12 层**（见 §1.4 的论证），`12 × (1024 + 64) = **13,056 B = 12.75 KiB**`。`[D]`
- 一个满长请求（133120 token）：133120 × 13,056 = **1.619 GiB / 卡**。
- 一个 block id 覆盖 640 个 token，12 层合计 **8,355,840 B**。
- kpool 尾状态：12 × 4096 = **48 KiB / 请求**；32 个请求 = 1.5 MiB。

### 5.7 每卡权重（每层）

精度按 §0.4 的划分（`[I]`，待 `quant_model_description.json` 确认）：

| 参数 | 每卡形状 | 推断精度 | 字节 |
|---|---|---|---|
| `fused_qkv_a_proj`（Replicated） | [2048, 4096] | **int8** | 8,388,608 = 8.0 MiB |
| `q_b_proj` | [2048, 1536] | **int8** | 3,145,728 = 3.0 MiB |
| `o_proj` | [4096, 2048] | **int8** | 8,388,608 = 8.0 MiB |
| `kv_b_proj`（→ W_UK_T + W_UV） | [4096, 512] | BF16 | 4,194,304 = 4.0 MiB |
| `indexer.wq_b`（Replicated） | [4096, 1536] | BF16 | 12,582,912 = 12.0 MiB |
| `indexer.wk_weights_proj`（Replicated，代码写死不量化） | [160, 4096] | BF16 | 1,310,720 = 1.25 MiB |
| `indexer.index_kpool_compress_gate` | [128, 4096] | BF16 | 1,048,576 = 1.0 MiB |
| `index_kpool_compress_ape`(FP32) / 各 norm | [4,128] / … | FP32 | 2,048 + … |
| **合计/层/卡** | | int8 19.0 + BF16 18.25 | **37.25 MiB** |

11 层合计 **409.75 MiB / 卡**。`[D]`

**上界**：若这三个投影实际未被量化，每层是 16.0 + 6.0 + 16.0 + 18.25 = **56.25 MiB**，11 层 618.75 MiB，整卡多 209 MiB（§1.3 已给两个值）。

`[D]` 无论取哪个值，**索引器那三件（wq_b 12.0 + wk_weights_proj 1.25 + compress_gate 1.0 = 14.25 MiB）连同 `fused_qkv_a_proj` 都是 Replicated 的**：TP8 完全没有省掉它们，8 张卡各存一份、各算一遍。

### 5.8 通信在哪里发生

**MLA 层里也只有 1 次集合通信**：`o_proj` 的 TP8 All-Reduce（`va:sfa_v1.py#L2028`），载荷 `T × 4096 × 2 B`。`[C]`

索引器和 top-k 选择全部在卡内完成，不产生通信——代价是 32 个索引器头、`wq_b`（12 MiB）、`wk_weights_proj`、`compress_gate` 在 8 张卡上各算一遍、各存一份。`[D]`

### 5.9 R1 的 prefill 步具体数字（位置 0–3，T=4，每卡）

```
x [4,4096]
 → fused_qkv_a_proj → [4,2048] → split → q_c [4,1536] + kv [4,512]
 → q_a_layernorm(q_c)
 → 索引器：q=[4,32,128]  k=[4,128]  weights=[4,32]  gate_score=[4,128]
 → exec_kv：kv_c = RMSNorm([4,512]) → 写 cache 4 × 1024 B × (本层) = 4096 B
 → 索引器 cache：4 个 token 正好 1 个 pool → 写 1 × 128 × 2 = 256 B
 → q_b_proj → [4,8,256] → bmm(W_UK_T) → ql_nope [4,8,512]
 → topk_indices [4, 2051]（前 3 行分别仅有 1/2/3 个尾部位置；末行有 1 个完整 pool，展开为 0–3；其余 -1）
 → 稀疏注意力 → [4,8,512] → _v_up_proj → [4,2048]
 → o_proj → [4,4096] → All-Reduce 32,768 B
```

主干 11 层写入的 KV：`4 token × 11 × 1088 B = 47,872 B ≈ 46.8 KiB`；加上 MTP 第 45 层（12 层口径）是 `4 × 13,056 = 52,224 B ≈ 51.0 KiB`。`[D]`

### 5.10 对应知识页

`mla.md`、`sparse-attention.md`、`kv-cache.md`、`kv-cache-spec.md`、`kv-pool.md`、`paged-attention.md`、`block-table.md`、`attention-qkv.md`、`attention-cost.md`、`rope.md`、`attention-backend-family.md`

### 5.11 待核

- 前缀缓存（`enable_prefix_caching`）在这种三份异构 cache + KDA 状态的混合模型上的默认开关与行为，**待核**（属于 01 号底稿的 A2 站，这里只标出它会影响 KV 账）。注：`patch_mamba_config.py#L225-L228` 显示它会改 `mamba_block_size`（开且 align 模式时取 `block_size`，否则取 `max_model_len`），§4.5 按「否则」分支算。
- ~~`enable_sfa_prolog_v3` / `enable_mlapo` 是否开启~~：已确认 GLM 子类强制关闭，两条融合路径不执行，见 §5.2。
- `npu_sparse_flash_attention` 的实际 tiling 与 HBM 流量尚未实测；单测参考实现的 query chunk=16 不适用于推理路径（§5.5）。

---

## 6. A4-5 MoE：288 选 8，EP16

### 6.1 做了什么

第 3–44 层的 MLP 不是一个大网络，而是 **288 个小专家（每个 4096→2048→4096）+ 1 个所有 token 都过的共享专家**。一个 router 给每个 token 打 288 个分，选出分最高的 8 个专家。288 个专家平分到 16 张卡上（2 台机器 × 8 卡），**每卡 18 个**。所以一个 token 选中的 8 个专家往往散落在不同的卡、甚至不同的机器上——这就是 dispatch（把 token 发过去）和 combine（把结果收回来）要解决的事。

### 6.2 路由：288 选 8

`AscendGlm5NextMoE.forward` — `va:.../glm5_next.py#L1525-L1538`：

```
router_logits, _ = self.gate(hidden_states)     # GateLinear，params_dtype=FP32，out_dtype=FP32
final = self.experts(hidden_states, router_logits)
```

`gate` 是 `GateLinear(4096, 288, params_dtype=float32, force_fp32_compute=True)` + `e_score_correction_bias[288] FP32`（因为 `topk_method == "noaux_tc"`）— `va:.../glm5_next.py#L1480-L1491`。

选专家：`select_experts` → `_select_experts_with_fusion_ops` → `moe_gating_top_k` — `va:vllm_ascend/ops/fused_moe/experts_selector.py#L292-L309`：

```
moe_gating_top_k(router_logits, k=8, k_group=1, group_count=1, group_select_mode=1,
                 renorm=1,          # norm_topk_prob=true
                 norm_type=1,       # sigmoid
                 routed_scaling_factor=2.5,
                 bias_opt=e_score_correction_bias)
```

`n_group=1` 且 `topk_group=1`，所以"专家分组"这一层在本模型里是退化的：直接在 288 个里选 8 个。`[D]`

每卡 router 权重：`288 × 4096 × 4 B = 4,718,592 B = 4.5 MiB`（FP32，不切），42 层 **189 MiB**。`[D]`

### 6.3 EP16 下每卡几个专家

`[C]` 关键在 vLLM 把 TP 和 DP **拍平**成一个 EP 维度：

```python
ep_size = tp_size   # 这里的 tp_size 已经是 flatten 后的
# flatten_tp_across_dp_and_pcp: flatten_tp_size = dp_size * pcp_size * tp_size
#                               flatten_tp_rank = dp_rank * tp_size + tp_rank
# 进 EP 分支后返回 FusedMoEParallelConfig(tp_size=1, ..., ep_size=flatten_tp_size)
```
`v:vllm/model_executor/layers/fused_moe/config.py#L1074-L1082, L1195-L1204`

所以：**EP = DP2 × TP8 = 16**，`ep_rank = dp_rank × 8 + tp_rank`；MoE 内部的 `tp_size = 1`，因此
`intermediate_size_per_partition = 2048 / 1 = 2048`（**专家的中间维不切**，`v:.../fused_moe/layer.py#L263-L264`）。

```
每卡专家数 = 288 / 16 = 18
第 r 张卡（全局 rank r）持有专家 [18r, 18r+18)
```
`va:.../glm5_next.py#L1496-L1500` 里 `n_local_physical_experts = n_physical_experts // ep_size`、`physical_expert_start = ep_rank * n_local_physical_experts` 与此一致。`[C]`

每卡专家权重（int8）：

```
w13_weight = [18, 2×2048, 4096] int8 = 18 × 4096 × 4096 = 301,989,888 B = 288.0 MiB
w2_weight  = [18, 4096, 2048] int8  = 18 × 8,388,608     = 150,994,944 B = 144.0 MiB
每层每卡 = 432.0 MiB；42 层 = 18,144 MiB = 17.72 GiB      ← 占了每卡权重的 88%
```
`[D]`（形状出处 `va:vllm_ascend/quantization/methods/w8a8_dynamic.py#L188-L199`）

全模型路由专家参数量：`288 × 3 × 4096 × 2048 × 42 = 304.4 B`；每个 token 实际激活 `(8+1) × 3 × 4096 × 2048 × 42 = 9.51 B`。`[D]`

### 6.4 A2 上走 MC2 还是 All-to-All：从源码判断

`[C]` 选择逻辑 `_select_a2_moe_comm_method` — `va:vllm_ascend/ascend_forward_context.py#L239-L252`：

```python
num_experts_per_device = 288 // 16 = 18
if num_experts_per_device <= 24 and ep_world_size >= 16 and num_tokens <= mc2_tokens_capacity:
    return MoECommType.MC2
return MoECommType.ALLGATHER
```

前两个条件本部署恒成立（18 ≤ 24，16 ≥ 16）。**A2 上根本没有 ALLTOALL 分支**——`ALLTOALL` 只在 A3 的 `_select_a3_moe_comm_method` 里出现（`#L254-L282`）。所以本部署（A2）只会在 **MC2** 和 **ALLGATHER** 之间二选一，门槛是 token 数。

`mc2_tokens_capacity` — `va:vllm_ascend/ascend_forward_context.py#L202-L217`：

```python
enable_prefill_mc2 默认 False                 # va:vllm_ascend/ascend_config.py#L165
cudagraph_capture_sizes = [4,8,16,32,64,96,128] 非空
  → max_num_tokens = max_cudagraph_capture_size = 128
num_tokens_per_tp_rank = ceil(128 / 8) = 16   → min(16, 512) = 16
mc2_tokens_capacity = 16 × 8 = 128
```

**门槛 = 128 个 token。**`[D]` 这个 128 不是巧合：`max-num-seqs=32` × `uniform_decode_query_len=4`（1 + 3 个 MTP）= 128，正好等于最大图尺寸。也就是说 **纯 decode 步（哪怕 32 个请求全满）一定走 MC2；任何一个 chunked prefill 混进来就翻到 ALLGATHER**。

判断用的 token 数是 **DP 组里的最大值**，不是本卡的：

```python
max_num_tokens = int(num_tokens_across_dp.max().item()) if ... else num_tokens
moe_comm_type = select_moe_comm_method(max_num_tokens, vllm_config, is_draft_model)
```
`va:vllm_ascend/ascend_forward_context.py#L96-L101`。**两个 DP 组永远用同一种 MoE 通信方式**，由更忙的那个组决定。`[C]` 这是 §7 的主线。

### 6.5 MC2 路径：每次传多少字节

vLLM v0.23.0 下，`va:vllm_ascend/ops/fused_moe/fused_moe.py#L290-L294` 导入的是 `fused_moe_0_23_0.py`；同文件 `else` 分支里的 `no_shared_forward_impl` 不执行。实际由 `AscendMoERunner._forward_impl` → `forward_impl` → `AscendFusedMoE.shared_forward_impl` 调用该层的 `forward_impl`（`va:vllm_ascend/ops/fused_moe/fused_moe_0_23_0.py#L104-L139, L672-L719`），其中 prepare → apply → finalize 在 `#L479-L557`：

```
prepare  → PrepareAndFinalizeWithMC2.prepare        va:ops/fused_moe/prepare_finalize.py#L249-L314
  1. pad 到 padded_num_tokens = ceil(max_tokens_across_dp / 8) × 8   （#ascend_forward_context.py#L185）
  2. 按 TP8 沿 token 维切：本卡只留 1/8 的 token          ← MoE 里 TP 组当"token 并行"用
  3. mc2_mask 同样切片，标记哪些行是真 token
apply    → AscendW8A8DynamicFusedMoEMethod.apply     va:quantization/methods/w8a8_dynamic.py#L214-L351
  → MoECommMethod.fused_experts                      va:ops/fused_moe/moe_comm_method.py#L122-L172
    a. token_dispatch → npu_moe_distribute_dispatch_v2   va:ops/fused_moe/token_dispatcher.py#L150-L263
    b. unified_apply_mlp（两次 grouped matmul）           va:ops/fused_moe/moe_mlp.py#L154-L215
    c. token_combine  → npu_moe_distribute_combine_v2    va:ops/fused_moe/token_dispatcher.py#L329-L339
finalize → PrepareAndFinalizeWithMC2.finalize（继承 All2All 版）  #L193-L227
  → TP8 All-Gather，把 8 份 token 切片拼回完整的 [T, 4096]
共享专家 → _forward_shared_experts + TP8 All-Reduce   va:ops/fused_moe/fused_moe_0_23_0.py#L559-L670
```

**dispatch 的 payload 是 int8**：`dispatch_with_quant` 对 `QuantType.W8A8` 返回 True（`va:ops/fused_moe/moe_stage_params.py#L92-L100`），于是 `quant_mode=2`，`get_dst_type` = `torch.int8`、`get_scale_type` = `torch.float32`（`#L103-L119`）。

`global_bs=0` + 传 `x_active_mask`：`should_skip_allreduce_across_dp_group` 在没有 PD 分离（`kv_transfer_config is None` → 不是 kv_consumer）时返回 False（`va:vllm_ascend/utils.py#L1284-L1287`），于是 `self.global_bs = 0`（`va:ops/fused_moe/token_dispatcher.py#L129-L133`），走"各 rank token 数一致 + mc2_mask"的模式。这也是为什么前面要把所有 DP rank 补齐到同一个 token 数。`[C]`

**每个 token 的线上字节（上界）**：

| 方向 | 每个 (token, 专家) 副本 | 一个 token（8 个专家） |
|---|---|---|
| dispatch | 4096 B（int8 hidden） + 4 B（FP32 per-token scale） = 4,100 B | 32,800 B |
| combine | 4096 × 2 B（BF16 结果） = 8,192 B | 65,536 B |
| **合计** | | **98,336 B ≈ 96 KiB / token / 层** |

42 层 = 98,336 × 42 = 4,130,112 B = **3.94 MiB / token**（跨 EP16 的 dispatch+combine 总量；与 §9.2 的 1.31 + 2.63 MiB 一致）。`[D]`

`[D]` 这是**上界**：8 个专家里若有两个落在同一张卡，MC2 只发一份；`HCCL_INTRA_PCIE_ENABLE=1` 的分层通信（`va:token_dispatcher.py#L115-L119` 的注释）还会进一步压掉跨机流量。教程的启动脚本没有设这两个变量，所以按不分层算。

### 6.6 专家计算：W8A8 用的是哪些算子

`va:vllm_ascend/ops/fused_moe/moe_mlp.py#L133-L215`（MC2 分支，`w1_scale_bias is None and w1_offset is None and is_mc2`）：

| 步 | 算子 | 形状 |
|---|---|---|
| 激活量化 | `npu_dynamic_quant`（若 dispatch 已量化则跳过，直接用 dispatch 带回的 `dynamic_scale`） | [rows, 4096] bf16 → int8 + FP32 scale |
| gmm1 + 激活 | `npu_grouped_matmul_swiglu_quant`（融合）或 `npu_grouped_matmul(output_dtype=int32)` + `npu_dequant_swiglu_quant(quant_mode=1)` | [rows, 4096] × [18, 4096, 4096] → [rows, 4096] → swiglu → [rows, 2048] int8 |
| gmm2 | `npu_grouped_matmul_gmm2` | [rows, 2048] × [18, 2048, 4096] → [rows, 4096] bf16 |

`process_weights_after_loading` 还把两份权重转置并转成 `ACL_FORMAT_FRACTAL_NZ`（`va:quantization/methods/w8a8_dynamic.py#L353-L366`），因为 `npu_grouped_matmul_swiglu_quant` 只吃 NZ 格式。`[C]`

`group_list` 来自 dispatch 返回的 `expert_token_nums`，告诉 grouped matmul 每个本地专家分到了多少行。`[C]`

### 6.7 共享专家放在哪里

`[C]` 共享专家**不参与 EP**，它是一个普通的 TP8 切分的 MLP，挂在 `AscendGlm5NextMoE.shared_experts` 上（`va:.../glm5_next.py#L1465-L1478`），`intermediate_size = moe_intermediate_size × n_shared_experts = 2048 × 1 = 2048`，`reduce_results=False`。

- 每卡权重：`gate_up [2×2048/8 = 512, 4096] int8` + `down [4096, 2048/8 = 256] int8` = 2,097,152 + 1,048,576 = **3.0 MiB / 层**，42 层 126 MiB。`[D]` 注意它**按 TP8 切**（`MergedColumnParallelLinear` + `RowParallelLinear`，`va:.../glm5_next.py#L1416-L1432`），所以每卡只有 3 MiB，不是整份 24 MiB。
- 它跑在**完整的 token 集合**上（没被 TP 切片），MC2 下算完之后做一次 **TP8 All-Reduce**（`va:ops/fused_moe/fused_moe_0_23_0.py#L663-L670`）；ALLGATHER 下随路由结果相加后统一归约（见 §6.8）。
- **本部署下它和路由专家是串行的**：`_forward_shared_experts` 里的 `npu_stream_switch`（`va:ops/fused_moe/fused_moe_0_23_0.py#L567`）由 `multistream_overlap_shared_expert` 控制，默认 **False**（`va:vllm_ascend/ascend_config.py#L139`），教程未覆盖此开关。因此共享专家仍执行 `#L559-L670` 的计算和 event 等待，但不切换到副流，也不与路由专家重叠。要打开得显式加 `--additional-config '{"multistream_overlap_shared_expert": true}'`。`[C]`
- 同理，`multistream_overlap_gate`（把 gate + 共享专家挪到副流，`va:ops/fused_moe/fused_moe_0_23_0.py#L438-L479`）默认也是 **False**（`va:ascend_config.py#L140`），本部署走该文件 `forward_impl` 中跳过此分支的直路。`[C]`
- W8A8 下它走的是 `npu_dynamic_quant` → `npu_quant_matmul(output_dtype=int32)` → `npu_dequant_swiglu_quant` → `npu_quant_matmul`（`va:ops/fused_moe/fused_moe_0_23_0.py#L573-L619`）。

路由结果和共享结果为什么不重复 All-Reduce：上游 `MoERunner.forward` 合并两份结果后仍调用 `self._maybe_reduce_final_output`（`v:vllm/model_executor/layers/fused_moe/runner/moe_runner.py#L654-L678`），实际执行 Ascend v0.23 重写（`va:ops/fused_moe/fused_moe_0_23_0.py#L95-L101`）。它调用的 `maybe_all_reduce_tensor_model_parallel` 在 MC2/ALLTOALL/FUSED_MC2 下直接返回，不通信（`va:ops/register_custom_ops.py#L157-L166`）；不能把基类的 `_fused_output_is_reduced` 判断当成这里的实际控制点。`[C]`

### 6.8 ALLGATHER 路径（token 数 > 128 时）

`PrepareAndFinalizeWithAllGather`，`enable_sp() or enable_sp_by_pass()` 为假（两者均为假）→ 走 DP 组版本（`va:ops/fused_moe/prepare_finalize.py#L370-L373, L520-L523`）。其中 `enable_sp_by_pass` 取决于主模型非 eager 且 `pass_config.enable_sp` 开启（`va:ascend_config.py#L291-L295`）；本部署的 MoE 模型默认不开 `enable_sp` / `fuse_gemm_comms`（`v:vllm/config/vllm.py#L243-L272, L1170-L1173`）：

```
prepare  (va:ops/fused_moe/prepare_finalize.py#L440-L495)：
           本地 [T_local, 4096] pad 到 max_tokens_across_dp，
           DP2 All-Gather hidden 和 router_logits → [2 × max, 4096]
dispatch (va:ops/fused_moe/token_dispatcher.py#L401-L412)：
           npu_moe_init_routing_v2，active_expert_range=[first_expert_idx, last_expert_idx]
           = [18r, 18r+18)（#L395-L399），group_list_type = 1（#L414）
           → 只把路由到本卡 18 个专家的行排出来算；说明见 va:ops/fused_moe/moe_comm_method.py#L186-L200
finalize (va:ops/fused_moe/prepare_finalize.py#L543-L560)：DP2 Reduce-Scatter → 切回本地 T_local 行
         (va:ops/fused_moe/fused_moe_0_23_0.py#L95-L101)：`_maybe_reduce_final_output` → TP8 All-Reduce
           （实际分支在 va:ops/register_custom_ops.py#L157-L166：ALLGATHER 且 FlashComm1 关时
             maybe_all_reduce_tensor_model_parallel 真的 all-reduce）
```

为什么 DP-RS + TP-AR 就对：16 张卡各自算了自己 18 个专家的贡献，DP Reduce-Scatter 把 2 个 DP 组加起来、TP All-Reduce 把组内 8 张卡加起来，合起来正好是全部 16 份之和。`[D]`

这条路径下 **hidden 完整地在两台机器之间来回走一趟**，而 MC2 只搬被路由中的 token 副本。§7 算账。

### 6.9 R1 的具体数字（T=4，MC2）

```
max_tokens_across_dp = 4（另一个 DP 组跑 dummy，其 token 数见 01 号底稿 B1）
padded_num_tokens = ceil(4/8)*8 = 8
TP8 切片：8 行 / 8 卡 = 每卡 1 行；mc2_mask 让 rank 0..3 是真 token，rank 4..7 是 padding
router：  [4, 4096] × [4096, 288] FP32 → [4, 288] → top-8
dispatch：每卡 ≤ 1 个 token × 8 个专家 × 4,100 B = 32,800 B
gmm：     每卡实际参与的行数 = 落在本卡 18 个专家上的 (token,专家) 对，期望 4×8×18/288 = 2 行
combine： 每卡 ≤ 1 × 8 × 8,192 = 65,536 B
finalize：TP8 All-Gather，每卡发 1 行（8,192 B），收 7 行
共享专家：在完整的 [4,4096] 上算，TP8 All-Reduce 32,768 B
```

`[D]` 单个请求在 TP8+EP16 上跑 decode，**一半的卡（rank 4–7）在这一层连一个真 token 都没有**，全靠 mask 走空。这是小 batch 下这套并行的固有浪费，也是 §7 要对比的基线。

### 6.10 对应知识页

`moe.md`、`expert-parallel.md`、`large-scale-ep.md`、`eplb.md`、`data-parallel.md`、`collective-communication.md`、`cann-hccl.md`、`quantization.md`、`fine-grained-tp.md`

### 6.11 待核

- `npu_moe_distribute_dispatch_v2` 是否对"同一张卡上的多个专家"合并副本；分层通信（`comm_alg="hierarchy"`，需要 `enable_mc2_hierarchy_comm`）默认关闭，教程也没开，但 HCCL 自身是否在 A2 上自动做分层**待核**。§6.5 的字节数按不合并、不分层的上界给出。
- ~~`multistream_overlap_gate` 的默认值~~：已查明，`va:vllm_ascend/ascend_config.py#L140` 默认 False，见 §6.7。
- EPLB（`enable_eplb`）默认关，`n_redundant_experts = 0`，所以 288 能被 16 整除；开 EPLB 后每卡专家数会变，**本底稿按不开算**。
- 专家的真实负载分布（`[!]` 只给了理想均分的期望值，没有实测 trace）。

---

## 7. A4-6 最终 norm 与 lm_head

### 7.1 做了什么

45 层跑完，先把 4 条残差流取平均折回 1 条，做一次 RMSNorm，再乘上 lm_head 得到每个词的分数（logits）。词表 154880 太大，lm_head 按词表切成 8 份，每卡算 19360 个词的分，最后 All-Gather 拼成完整的 154880。

### 7.2 怎么走的

1. 最后一层 `forward` 里 `hidden_states.view(T, 4, -1).mean(dim=1)` → `[T, 4096]` — `va:.../glm5_next.py#L2237-L2239`
2. `AscendGlm5NextModel.forward` 末尾 `self.norm(hidden_states)`（`RMSNorm(4096, eps=1e-5)`）— `va:.../glm5_next.py#L2288-L2318`
3. `AscendGlm5NextForCausalLM.compute_logits` → `self.logits_processor(self.lm_head, hidden_states)` — `va:.../glm5_next.py#L2515-L2517`
4. `lm_head = ParallelLMHead(154880, 4096)`（`tie_word_embeddings=false`，所以是独立的一份权重）— `va:.../glm5_next.py#L2454-L2460`
5. 运行时换成 `AscendParallelLMHead` / `AscendLogitsProcessor` — `va:vllm_ascend/utils.py#L749-L750`
6. `AscendLogitsProcessor._get_logits` → `_get_logits_normal`（`lmhead_tp_enable()` 默认假，`finegrained_tp_config.lmhead_tensor_parallel_size` 默认 0）— `va:ops/vocab_parallel_embedding.py#L291-L300, L323-L345`
7. → `lm_head.quant_method.apply(...)` → `LogitsProcessor._gather_logits` → `tensor_model_parallel_all_gather`（`use_all_gather()` 恒为 True）— `v:vllm/model_executor/layers/logits_processor.py#L75-L103`、`v:vllm/platforms/interface.py#L858-L862`
8. `enable_reduce_sample` 默认 False（`va:vllm_ascend/ascend_config.py#L320`），所以走"先 All-Gather 再切掉 vocab padding"的常规路径

### 7.3 本部署下的数字

- 每卡 lm_head 权重：`[19360, 4096] BF16 = 158,597,120 B = **151.25 MiB**`（BF16，见 §0.4 的排除清单）。`[D]`
- R1 decode 一步要 n = 4 个位置的 logits（1 个真 token + 3 个草稿都要验证）：
  - 每卡本地 logits `[4, 19360] BF16 = 154,880 B`
  - All-Gather 后 `[4, 154880] BF16 = **1,239,040 B ≈ 1.18 MiB**`
- R1 prefill 只要最后 1 个位置：本地 `[1, 19360]` = 38,720 B，All-Gather 后 `[1, 154880]` = 309,760 B。`[D]`
- `154880 % 8 == 0` 且 `% 64 == 0`，所以 `org_vocab_size` 和 padding 后的大小相同，第 7 步的 `logits[..., :org_vocab_size]` 是空切。`[D]`

`[D]` **为什么 logits 这么贵**：lm_head 的 GEMM 是 `[n, 4096] × [4096, 19360]`，n=4 时只有 0.63 GFLOP，但要把 151.25 MiB 的权重从 HBM 读一遍。decode 步里它是纯访存受限的：lm_head 占每卡权重的 0.73%，却在每一步被全量读一遍。作为对比，MoE 的 432 MiB/层里每步只有被选中的那几个本地专家会被读到——R1 那种 4 token 的小 batch 每卡期望只命中 2 行、远不到 18 个专家；batch 变大后 18 个专家才会全部被触及。`[D]`

哪些位置需要 logits 由 model runner 的 `logits_indices` 决定（MTP 下是全部验证位置），这属于 A5 站，见 `03-sample-decode.md`。

### 7.4 对应知识页

`embedding.md`、`tensor-parallel.md`、`speculative-decoding.md`、`fine-grained-tp.md`、`vllm-v1-shape.md`

### 7.5 MTP 层（第 45 层）在每卡上占多少

A4 讲的是主干 45 层，但 MTP 层的权重和主模型一样常驻每张卡，§1.3 的整卡账必须带上它。它**不是**主干层的复用，而是独立的一整套（`va:vllm_ascend/models/glm5_next_mtp.py#L39-L91`）：

| 部件 | 形状 / 切法 | 每卡 |
|---|---|---|
| `eh_proj` | `nn.Linear(8192, 4096, bias=False)`，**普通 nn.Linear，不切 TP**（`#L53-L57`） | 8192 × 4096 × 2 B = **64.0 MiB** |
| `shared_head.head` | `SharedHead` 里确实建了一个 `ParallelLMHead(154880, 4096)`（`v:vllm/model_executor/models/deepseek_mtp.py#L43-L57`），但**加载后被主模型的 `lm_head` 顶替，不额外占显存** | **0**（见下方论证） |
| `mtp_block` 的 MLA + 索引器 | 与主干 MLA 层同构（`layer_idx=45` → `_is_kda_layer` 假 → MLA） | **37.25 MiB**（上界 56.25） |
| `mtp_block` 的路由专家 | `mlp_layer_types` 只有 45 项，索引 45 取 `[-1]`= `"sparse"` → 一整套 288 选 8（`va:.../glm5_next.py#L2107-L2118`） | **432.0 MiB** |
| `mtp_block` 的共享专家 | TP8 切分的 MLP | **3.0 MiB** |
| `mtp_block` 的 router gate | FP32，不切 | **4.5 MiB** |
| `enorm` / `hnorm` / `shared_head.norm` | RMSNorm(4096) | 24 KiB |
| **权重合计** | | **540.75 MiB**（上界 559.75 MiB） |
| （另占）MTP 的 top-k 索引缓冲 | 8192 × 2176 × 4 B，宽度向上取到 128 的倍数（`#L64-L77`） | 68.0 MiB |

`[D]` **MTP 层没有 mHC**：`is_mtp_layer=True` 让 `AscendGlm5NextDecoderLayer.forward` 走单残差分支（`va:.../glm5_next.py#L2132, L2195-L2210`），所以不分配 `hc_*` 参数——§0.4 的排除表里 `hc_*` 正好只有 45 条（层 0–44），独立印证。

`[C]` **MTP 不自带 lm_head，和主模型共用同一份**，所以那 151.25 MiB 不计入。两条独立证据：

1. **代码会把它顶替掉**。`va:vllm_ascend/spec_decode/llm_base_proposer.py#L589-L596`：
   ```python
   if self.method == "mtp" and self.vllm_config.model_config.is_deepseek_mla:
       ...
       for _, layer_module in self.model.model.layers.items():
           layer_module.shared_head.head = target_language_model.lm_head
   ```
   两个条件本部署都成立：
   - `self.method`：`--speculative-config` 写的 `deepseek_mtp` 在 `v:vllm/config/speculative.py#L550-L554` 被规范化成 `"mtp"`；
   - `is_deepseek_mla`：vLLM 0.23.0 的 MLA 白名单里本来没有 `glm5_next`，但 vllm-ascend 的插件补了一个 convertor——`va:vllm_ascend/patch/platform/patch_glm5_next_config.py#L14-L20` 的 `Glm5NextModelArchConfigConvertor.is_deepseek_mla()` 返回 `kv_lora_rank is not None`（本模型 = 512，为真），`#L29-L30` 把 `glm5_next` / `glm5_next_text` 都注册进 `MODEL_ARCH_CONFIG_CONVERTORS`，而这个补丁是无条件导入的（`va:vllm_ascend/patch/platform/__init__.py#L44`）。
2. **checkpoint 里本来就没有这份权重**。`glm-flow/reference/checkpoint-shapes.json`（`zai-org/GLM-5.3-Flash`，sha 690b7052，2062 个张量）里第 45 层只有 `model.language_model.layers.45.shared_head.norm.weight`，**没有** `shared_head.head.weight`；全仓只有一个 `lm_head.weight`。不共享的话这一层的 head 无权重可加载。

`[!]` 三方对账：03 底稿原写 **≈671 MiB**（把共享专家当成不切 TP 的 24 MiB），02-review 建议 **≈650 MiB**（漏了 `mtp_block` 自己的 MLA 37.25 和 router gate 4.5），本文上一版写 **692.0 MiB**（多算了 lm_head 151.25）。核实后 **02 与 03 统一到 540.75 MiB**，正落在 03 修订后给的 533–560 区间内（03 取 ≈541）。

### 7.6 待核

- `AscendParallelLMHead` 相对上游 `ParallelLMHead` 的改动（只确认了它被注册进 `REGISTERED_ASCEND_OPS`，没逐行比对 `#L252-L284`）。
- ~~MTP 层是否和主模型共用 lm_head~~：**共用**。`SharedHead` 构造时确实建了一份 `ParallelLMHead`，但 `va:vllm_ascend/spec_decode/llm_base_proposer.py#L589-L596` 在加载后把它整个换成主模型的 `lm_head`，checkpoint 里也没有 `shared_head.head.weight`（详见 §7.5）。所以它不占独立显存，`quant_model_description.json` 里怎么标都与这笔账无关。

---

## 8. B5 多请求下 MoE 的负载和通信量

### 8.1 场景 M

- DP0（node 0）：12 个请求在 decode，同时来了 1 个 6000 token 的新请求；
- DP1（node 1）：7 个请求在 decode。

每个 decode 请求带 MTP，query 长度 4。于是：

```
DP0 本步 token 数 = 12 × 4 + 6000 = 6,048       （6048 ≤ max-num-batched-tokens 8192，一步装得下）
DP1 本步 token 数 = 7 × 4        = 28
max_tokens_across_dp = 6,048
padded_num_tokens    = ceil(6048 / 8) × 8 = 6,048
```

### 8.2 第一个结论：整个集群翻到 ALLGATHER

`6048 > mc2_tokens_capacity(128)` → `_select_a2_moe_comm_method` 返回 `MoECommType.ALLGATHER`（§6.4）。而选择用的是 **DP 组最大值**，所以 **DP1 那 7 个纯 decode 请求也被拖上 ALLGATHER 路径**，尽管它自己只有 28 个 token。`[C]`（`va:ascend_forward_context.py#L96-L101, L239-L252`）

### 8.3 第二个结论：DP1 被放大到 216 倍

`_prepare_with_dp_group` 先把本地 token 补齐到 `max_tokens_across_dp` 再 All-Gather（`va:ops/fused_moe/prepare_finalize.py#L458-L469`）：

```
DP1 本地真 token 28 → pad 到 6,048 → 放大 216 倍
All-Gather 后每卡拿到 2 × 6,048 = 12,096 行
```

DP1 的 8 张卡在这一层里要为 12,096 行做 routing bookkeeping，其中只有 28 行是自己的真数据。`[D]`

### 8.4 每层每卡的通信量

| 步骤 | 张量 | 字节 |
|---|---|---|
| DP2 All-Gather（hidden） | [6048, 4096] BF16 收发 | 每卡收 **47.25 MiB**，本地缓冲变成 [12096, 4096] = 94.5 MiB |
| DP2 All-Gather（router_logits） | [6048, 288] FP32 | 每卡收 **6.64 MiB** |
| DP2 Reduce-Scatter（专家输出） | [12096, 4096] BF16 → [6048, 4096] | 载荷 **47.25 MiB** |
| TP8 All-Reduce（最终输出） | [6048, 4096] BF16 | 载荷 **47.25 MiB** |

`[D]` 单层单卡 ≈ **148.4 MiB** 的集合通信载荷；**42 层 = 6.09 GiB / 卡 / 步**。其中 DP 组的两次（All-Gather + Reduce-Scatter）是**跨机**的：`42 × (47.25 + 6.64 + 47.25) = 4.15 GiB / 卡 / 步` 走节点间网络，16 张卡合计一步要在两台机器之间搬 **约 66 GiB**。

### 8.5 和纯 decode（MC2）对比

把那个 6000 token 的 prefill 拿掉，其他不变（DP0 = 48 token，DP1 = 28 token）。两组都是纯 decode，**先各自补到图尺寸，再做两组对齐**：`_determine_batch_execution_and_padding` 先 `dispatch` 得到 `num_tokens_padded = batch_descriptor.num_tokens`（DP0 48 → 64，DP1 28 → 32），再把补齐后的值送进 `_sync_metadata_across_dp`，两组都是 FULL、`allow_dp_padding` 为真，都取最大值 64（`[C]` `va:worker/model_runner_v1.py#L2914-L2967`、`#L2976-L2996`，与 03 底稿 B4 步骤 A 一致）。MC2 的 `prepare` 先补到 `padded_num_tokens` 再按 TP8 沿 token 维 `tensor_split`（`va:ops/fused_moe/prepare_finalize.py#L276-L290`）：

```
num_tokens_across_dp = [64, 64] → max_tokens_across_dp = 64 ≤ 128 → MC2
padded_num_tokens = ceil(64/8)*8 = 64 → TP8 切片后每卡 64 ÷ 8 = 8 行
dispatch： 8 × 8 × 4,100 B = 262,400 B  = 256.25 KiB
combine：  8 × 8 × 8,192 B = 524,288 B  = 512.0 KiB
finalize TP8 All-Gather： 每卡发 8 行 × 4096 × 2 B = 65,536 B = 64 KiB
共享专家 TP8 All-Reduce： 64 × 4096 × 2 = 524,288 B = 512 KiB
单层单卡 = 1,376,512 B ≈ 1344.25 KiB ≈ 1.31 MiB；42 层 = 57,813,504 B ≈ 55.1 MiB / 卡 / 步
其中跨 EP16 的 dispatch + combine：786,688 B / 层，42 层 = 33,040,896 B ≈ 31.5 MiB / 卡 / 步
```

这是上界：dispatch 和 combine 按每卡 8 行全发算；`mc2_mask` 只把前 `num_actual_tokens` 行标成真（`va:ascend_forward_context.py#L185-L190`），DP0 真实 48 行、DP1 真实 28 行都不满 64，真实行落在哪几张卡上取决于 TP 切片。finalize 的 TP8 All-Gather 和共享专家的 All-Reduce 按补齐后的整张张量走，不受掩码影响。

一行 hidden = 4096 × 2 B = 8,192 B，这与 §9.2「每卡发 8,192 B」同口径；MC2 finalize 用 `dist.all_gather` 把 TP8 切片拼回完整张量，每卡发出本地那一整片 `[rows, 4096]` BF16（`va:ops/fused_moe/prepare_finalize.py#L208-L223`）。

| | MoE 通信量 / 卡 / 步 | 其中跨机 / 卡 / 步 | 真 token 数 |
|---|---|---|---|
| 纯 decode（MC2，补齐到 64） | **≤ 55.1 MiB** | ≤ 31.5 MiB | 76 |
| 场景 M（ALLGATHER） | **6.09 GiB** | 4.15 GiB | 6,076 |
| 比值 | **≈ 113 ×** | ≈ 135 × | 80 × |

`[D]` **一个 6000 token 的 prefill 混进来，MoE 的通信量涨了两个数量级，而真 token 只多了 80 倍——通信量的增速比真 token 的增速还快了约四成（113 ÷ 80 ≈ 1.41）。** 这多出来的部分来自两件事：DP1 被补齐到 6,048 行（216 倍 padding），以及 ALLGATHER 把完整的 BF16 hidden 在两台机器之间整张搬来搬去（MC2 只搬被选中的 token 副本，而且是 int8）。

### 8.6 专家负载

```
场景 M：12,096 行（含 padding）× 8 = 96,768 个 (token, 专家) 对
       288 个专家，理想均分：每个专家 336 行，每卡（18 个专家）6,048 行
纯 decode：76 × 8 = 608 对，每卡理想 38 行
```

`[D]` 每卡 gmm1 的形状（理想均分，场景 M）：`[6048, 4096] × [18, 4096, 4096] int8`；gmm2：`[6048, 2048] × [18, 2048, 4096]`。实际上这是分成 18 组的 grouped matmul，每组行数由 `group_list` 给出。

`[D]` 负载失衡的放大效应：MoE 一层的耗时由**最慢的那张卡**决定（后面有 Reduce-Scatter / combine 同步点）。如果某张卡拿到 2 倍平均行数，这一层就慢 2 倍，42 层累加。`noaux_tc` 的 `e_score_correction_bias` 是训练时用来压平专家负载的，推理时它是固定的偏置，只能提供统计上的均衡。

**待核**：真实 trace 下的专家负载分布（p50 / p99 / max 比平均高多少）。没有实测数据，上面全部按理想均分算。EPLB（`eplb.md`）就是为这个问题准备的，本部署默认关闭。

### 8.7 变体 M'（DP1 空闲）

`[D]` DP1 没有请求时仍然要陪跑：`padded_num_tokens` 由 `max_tokens_across_dp` 决定，DP1 的 dummy 批次照样被补到 6,048 行，照样做 DP All-Gather 拿到 12,096 行、照样跑自己那 18 个专家、照样 Reduce-Scatter。**M' 的 MoE 通信量和 M 基本一样**，只是 DP1 算出来的东西全是 padding。

`[C]` 空闲组的 dummy 批次是 **4 个 token**，链路见 01 底稿 §B1：`DPEngineCoreProc.run_busy_loop` → `execute_dummy_batch` → `_dummy_run(num_tokens=uniform_decode_query_len=4, uniform_decode=True)`。它本身只有 4 个 token，但 MoE 层按 `max_tokens_across_dp` 补齐，所以照样付 6,048 行的通信和 routing 开销。

**待核**：dummy run 是否在 MoE 层短路掉 dispatch/combine（`in_profile_run` 只在 profile 时为真，dummy decode 不走那条路，但 `_dummy_run` 是否另有跳过分支没有逐行跟）。

### 8.8 对应知识页

`moe.md`、`expert-parallel.md`、`large-scale-ep.md`、`concurrent-requests.md`、`chunked-prefill.md`、`data-parallel.md`、`eplb.md`、`collective-communication.md`

---

## 9. 汇总：R1 一次前向的账

### 9.1 形状（T=4，每卡）

| 站 | 输入 | 输出 | 本卡权重 |
|---|---|---|---|
| 词嵌入 | ids [4] | [4,4096] | 151.25 MiB |
| 展开残差 | [4,4096] | [4,4,4096] | — |
| KDA（×34） | [4,4096] | [4,4096] | 34.61 MiB/层 |
| 稠密 MLP（×3） | [4,4096] | [4,4096] | 18.0 MiB/层 |
| MLA（×11） | [4,4096] | [4,4096] | 37.25 MiB/层 |
| MoE（×42） | [4,4096]，TP 切成每卡 [1,4096] | [4,4096] | 432 + 3 + 4.5 MiB/层 |
| 折叠 + norm | [4,4,4096] | [4,4096] | — |
| lm_head | [4,4096] | [4,154880] | 151.25 MiB |
| （MTP 第 45 层，属 A5） | [4,4096] + 下一 token 嵌入 | [4,154880] | 540.75 MiB，见 §7.5 |

### 9.2 通信（T=4，每卡，MC2）

| 类型 | 次数 | 单次载荷 | 合计 |
|---|---|---|---|
| TP8 All-Reduce | 91（1 嵌入 + 45 注意力 + 3 稠密 + 42 共享专家） | 32,768 B | 2.84 MiB |
| MC2 dispatch | 42 | ≤ 32,800 B | ≤ 1.31 MiB |
| MC2 combine | 42 | ≤ 65,536 B | ≤ 2.63 MiB |
| TP8 All-Gather（MoE finalize） | 42 | 每卡发 8,192 B | 0.33 MiB |
| TP8 All-Gather（lm_head） | 1 | 每卡发 154,880 B | 0.15 MiB |
| **合计** | **218** | | **≤ 7.3 MiB** |

`[D]` 这就是一个 4 token 的请求在 16 卡上跑一步的通信账：**218 次集合通信，7 MiB 数据，为了算 4 个 token**。延迟由 218 次同步的启动开销主导，而不是数据量——这正是 `FULL_DECODE_ONLY` 图捕获要解决的问题（见 `03-sample-decode.md` 的 A6/B4）。

### 9.3 写入的 KV / 状态（T=4）

| 项 | 字节 |
|---|---|
| MLA 隐向量（11 层 × 4 token × 1024 B） | 45,056 |
| 索引器压缩 K（11 层 × 1 个 pool × 256 B） | 2,816 |
| 小计（主干 11 层） | **47,872 ≈ 46.8 KiB** |
| MTP 第 45 层同理再加一层 | +4,352 → 12 层口径 **52,224 ≈ 51.0 KiB** |
| KDA 状态（原地更新，不增长） | 0（更新 34 层 × 561,152 B 有效数据，占 34 × 4 页 × 655,360 B 的空间） |
| kpool 尾状态（原地更新） | 0（更新 12 × 4096 B） |

`[D]` 这一步只写了 51 KiB 的 KV，却已经占掉一个 640 token 的逻辑块（每 block id 8,355,840 B）——短请求的块利用率是 4/640 = 0.6%。逻辑块被撑到 640 是为了和 KDA 状态页对齐（§5.6），代价就落在这里。

---

## 10. 全文件待核清单

1. **W8A8 的精度清单**（§0.4）：用的是上游 FP8 仓库的 `modules_to_not_convert` 推断，`GLM-5.3-Flash-w8a8` 的 `quant_model_description.json` 本机没有。影响所有 "BF16 / int8" 字节数（上下界差 0.22 GiB/卡），不影响形状和切法。§1.3、§5.7、§7.5 都给了两个值。
2. **单卡 HBM 是 64 GiB 还是十进制 64 GB**（§1.3）：决定余量是 33.8 GiB 还是 30.1 GiB。教程只写「64GB」。
3. **前缀缓存默认值与行为**（§5.11）：在三份异构 cache + KDA 状态的混合模型上，属 01 号底稿 A2 站。它会改 `mamba_block_size`，进而改 §4.5 的 KDA 状态账。
4. ~~SFA 的三条前处理路径~~：**已定案**，GLM 子类强制关闭 `enable_sfa_prolog_v3` / `enable_mlapo`，实际走原生路径（§5.2）；稀疏 attention 走专用重写与设备算子，kernel tiling 仍待实测（§5.5、§5.11）。
5. **MC2 dispatch 是否合并同卡副本、HCCL 是否自动分层**（§6.11）：§6.5 的字节数是上界。
6. **专家真实负载分布**（§8.6）：全文按理想均分算，没有实测 trace。
7. **dummy run 是否在 MoE 层短路 dispatch/combine**（§8.7）：token 数 4 已由 01 底稿 §B1 确认。
8. **稠密 MLP 的 W8A8 算子分支**（§3.4）：确认了权重是 int8 + per-channel scale，没跟到具体 `apply`。
9. **`npu_hc_pre_v2` / `npu_hc_post` 与参考实现的数值等价性**（§2.5）。
10. ~~MTP 的 `shared_head.head` 是否被标 `FLOAT`~~：**已定案**，它根本不占独立显存——加载后被主模型的 `lm_head` 顶替，checkpoint 里也没有这份权重（§7.5）。
11. **main 分支（baa023ad，布局 `models/glm5next/`）的差异**：本文件全部基于 db701c1f，没有对照 main 逐项 diff。已知 main 把 GLM 实现挪到了目录形式，**待核**是否有行为差异。

已经从「待核」升级为结论的（见 §12 修订记录）：`block_size = 640` 的推导路径、`multistream_overlap_*` 的默认值、MTP 层是否自带 lm_head、DP 空闲组 dummy 的 token 数。

---

## 11. 源码索引（本文件引用到的文件）

`va` = `vllm-ascend@db701c1f`，用 `git -C tools/repos/vllm-ascend show db701c1f:<path>` 读。

- `vllm_ascend/models/glm5_next.py` — 模型主体、mHC、索引器、kpool、MoE 装配、lm_head
- `vllm_ascend/ops/kimi_kda.py` / `vllm_ascend/ops/kimi_kda_state.py` — KDA Ascend 实现与状态形状
- `vllm_ascend/ops/indexer_kpool_mla.py` / `vllm_ascend/attention/indexer_kpool_mla_v1.py` — MLA 三份 cache 与 backend
- `vllm_ascend/ops/glm5_next_lightning_indexer.py` / `vllm_ascend/ops/triton/glm5_next_lightning_indexer.py` — 索引器入口、池打分、top-k 展开与尾部补齐
- `vllm_ascend/ops/glm5_next_kpool_state_compress.py` — kpool 压缩与索引器 cache 写入
- `vllm_ascend/attention/sfa_v1.py` — MLA 前向主体、W_UK/W_UV 吸收、o_proj
- `vllm_ascend/ascend_forward_context.py` — MoE 通信方式选择、mc2 容量、padded_num_tokens、flashcomm 开关
- `vllm_ascend/device/device_op.py` / `csrc/attention/sparse_flash_attention/sparse_flash_attention_torch_adpt.h` — A2 稀疏 attention 设备适配与实际算子入口
- `csrc/torch_binding.cpp` — 稀疏 attention 算子 schema 与实现注册
- `vllm_ascend/ops/fused_moe/{moe_comm_method,prepare_finalize,token_dispatcher,fused_moe,fused_moe_0_23_0,moe_mlp,experts_selector,moe_stage_params}.py` — MoE 全链路；本基线由 `fused_moe.py` 导入 `fused_moe_0_23_0.py` 的实现
- `vllm_ascend/quantization/methods/w8a8_dynamic.py` — W8A8 权重形状与算子
- `vllm_ascend/ops/vocab_parallel_embedding.py` — 嵌入与 logits
- `vllm_ascend/ops/register_custom_ops.py` — `maybe_*` 通信自定义算子
- `vllm_ascend/utils.py` — Ascend op 注册表、`enable_sp`、`should_skip_allreduce_across_dp_group`
- `vllm_ascend/ascend_config.py` / `vllm_ascend/envs.py` — 各开关默认值
- `vllm_ascend/patch/platform/patch_mamba_config.py` — 逻辑块 640、KDA 页填充（§4.5、§5.6）
- `vllm_ascend/quantization/modelslim_config.py` — `--quantization ascend` 的逐层精度判定（§0.4）
- `vllm_ascend/models/glm5_next_mtp.py` / `vllm_ascend/spec_decode/llm_base_proposer.py` — MTP 层的权重与 KV 组（§7.5、§1.4）

`v` = `vllm@0fc695fc`（= tag v0.23.0）：

- `vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py`、`.../mamba/mamba_utils.py`
- `vllm/model_executor/layers/fused_moe/{config,layer}.py`
- `vllm/model_executor/layers/fused_moe/runner/moe_runner.py` — 路由与共享专家结果合并、最终归约调用
- `vllm/config/vllm.py` — SP 与 GEMM 通信融合的默认值及联动条件
- `vllm/model_executor/layers/{vocab_parallel_embedding,logits_processor}.py`
- `vllm/v1/worker/gpu_model_runner.py`
- `vllm/platforms/interface.py`

配置与教程：

- `glm-flow/reference/official-config.json`（`text_config` + `quantization_config`）
- `glm-flow/reference/modeling_glm5_next.py`（mHC 参考实现）
- `vllm-ascend@0576b647:docs/source/tutorials/models/GLM5.3-Flash.md` §5.2 多机部署

---

## 12. 修订记录（2026-09-27，据 `docs/mainline/review/02-review.md` + `01-review.md` 跨文档判定表）

| 意见 | 处理 | 说明 |
|---|---|---|
| **P1-1** `block_size` 不是 128 | **已改**（§5.6 重写，§9.3、§1.4 连带） | 复核确认：`va:patch_mamba_config.py#L131-L141` 算出 `min_attn_block_size = 128 × cdiv(561152, 128×1024) = 640`，`#L153-L159` 就地写回 `cache_config.block_size`；`va:indexer_kpool_mla.py#L77` 取的就是它。MLA 页 **655,360 B**、索引器页 **40,960 B**（`storage_block_size = 640/4 = 160`，`v:kv_cache_interface.py#L364-L367`）。每 token 字节数不变。 |
| **P1-2** 「MLA 全部投影留 BF16」与排除表矛盾 | **已改**（§0.4 重写成逐模块统计表，§1.3、§5.7、§7.5 给上下界） | 自己重新逐条统计 1509 项：`self_attn.o_proj` 只出现 34 次且层号全是 `kda_layers`；`q_a_proj`/`q_b_proj`/`kv_a_proj_with_mqa`/`fused_qkv_a_proj` 出现 **0** 次。MLA/层 **37.25 MiB**（int8 19.0 + BF16 18.25），11 层 409.75 MiB；全 BF16 上界 56.25 MiB / 618.75 MiB。同时补上判定机制（`modelslim_config.py#L67, L632-L736`）和「本机没有 `quant_model_description.json`」的限定。 |
| **P1-3** §8.5 finalize 载荷算错 | **已改** | 6 行 × 4096 × 2 B = **49,152 B = 48 KiB**（原写 24 KiB）。单层 1,032,384 B ≈ 1008 KiB，42 层 **41.4 MiB**，比值 **151×**（原 40.4 MiB / 154×）。80× 那一列不变，结论不变。 |
| **P1-4** 共享专家独立 stream 默认关 | **已改**（§6.7） | `va:ascend_config.py#L139` `multistream_overlap_shared_expert` 默认 False、`#L140` `multistream_overlap_gate` 默认 False；教程无 `--additional-config`。改写成「代码里留了重叠通路，本部署串行执行」。 |
| **P2-1** `#L574-L580` 越界 | **已改**（§6.8） | 写全 `va:ops/fused_moe/fused_moe.py#L574-L580`，并补开关 `#L551-L562`。 |
| **P2-2** ALLGATHER dispatch 算子挂错文件 | **已改**（§6.8） | 改引 `va:ops/fused_moe/token_dispatcher.py#L401-L412`（`active_expert_range` 在 `#L409`、`group_list_type` 在 `#L414`），说明文字引 `moe_comm_method.py#L186-L200`。 |
| **P2-3** 权重账漏掉 MTP 层 | **已改**（§1.3 加行 + 新增 §7.5） | 主干 45 层 20,537 MiB = 20.06 GiB；MTP 层 **540.75 MiB**（见本表最后一行）；整卡 **21,078 MiB = 20.58 GiB**。 |
| **P2-4** 用「待核」顶替 block_size 答案 | **已改** | §5.11 该条删除，§5.6 直接给推导；§10 第 2 条换成单位问题。 |
| **P2-5** §8.7 待核在 01 底稿已有答案 | **已改** | 写明 dummy 批次 = 4 个 token（01 §B1 的 `execute_dummy_batch` → `_dummy_run(num_tokens=4)`），只留「是否短路 MoE 通信」一条。 |
| **P3-1** §1.2 表题口径 | **已改** | 表题改成「DP 组内最大 token 数 ≤ 128」并加一句引 `ascend_forward_context.py#L97-L98`。 |
| **P3-2** GB/GiB 混用 | **已改**（§0.1、§1.3） | 全文统一 GiB，并写明「64GB 按 64 GiB 处理」；十进制口径的余量（30.1 GiB）作为待核列出。 |
| **P3-3** 卷积状态维序不一致 | **已改**（§4.5、§4.7） | 统一 `(3072, 6)`，注明顺序由 `is_conv_state_dim_first()` 决定（`kimi_kda_state.py#L28-L30`），字节数不变。 |
| **P3-4** §5.5 的 22 MiB 缺前提 | **已改** | 加「历史长于 2051 token 时的稳态值」，并给出 12 层口径 24.0 MiB。 |
| **P3-5** §8.5「多出来的那一倍」读不通 | **已改** | 改成「通信量的增速比真 token 的增速还快了将近一倍」。 |
| **P3-6** `enforce_eager` 未说明作用域 | **已改**（§0.1） | 括注「仅草稿侧」，并指向 01 底稿 §A0。 |
| **01-review**：KDA 状态 18.2 MiB 只算了 1 份 | **已改**（§4.5、§1.4） | 自核确认两处放大：页被补到 `max(attn_page_size, mamba_raw_size) = 655,360`（`patch_mamba_config.py#L44-L56, L171, L191-L203`，填充 14.4%）；投机多要 3 页（`v:abstract.py#L44-L60` → `num_speculative_blocks=3`，`v:kv_cache_interface.py#L627-L636`，`v:single_type_kv_cache_manager.py#L1073-L1080`）。每层 4 页 × 655,360 = 2.5 MiB，34 层 **85.0 MiB/请求**，32 槽 **2.66 GiB**。 |
| **01-review**：每 token KV 应含 MTP 层 = 13,056 B | **已改**（§1.4、§5.6、§5.9、§9.3） | **独立核实同意**。依据有三条，互相印证：① `layer_types` 只有 45 项，MTP 的 `layer_idx=45` 越界 → `_is_kda_layer` 返回假 → 走 MLA 分支（`va:.../glm5_next.py#L216-L227, L2086-L2105`）；② §0.4 的排除表里 `kv_b_proj` / `indexer.*` 各出现 **12** 次，层号是 3,7,…,43 **和 45**；③ MTP 的注意力层确实进了 `kv_cache_config.kv_cache_groups`（`va:spec_decode/llm_base_proposer.py#L405-L456` 末尾 `assert not missing_layers`）。故 **12 × 1088 = 13,056 B/token**，满长请求 **1.619 GiB**，每 block id 8,355,840 B。原来的 11,968 B 是「只数主干」的口径，文中保留为分项。 |
| **02-review / 03**：MTP 层显存 671 vs 650 MiB | **已改**（§7.5）；该轮取 692.0 MiB，**下一轮再修订为 540.75 MiB** | 共享专家按 TP8 切分 = 3 MiB（03 的 24 MiB 偏大，`va:.../glm5_next.py#L1465-L1478` + `#L1416-L1432`）；但 650 MiB 漏了 `mtp_block` 自己的 MLA（37.25 MiB）和 router gate（4.5 MiB）。逐项：`eh_proj` 64.0（`nn.Linear(8192,4096)`，不切 TP）+ `shared_head.head` 151.25 + MLA 37.25 + 路由专家 432.0 + 共享专家 3.0 + gate 4.5 = **692.0 MiB**（全 BF16 上界 711.0）。另有 68.0 MiB 的 MTP top-k 索引缓冲（非权重，单列）。 |
| **01-review**：conv 状态长度 = 6 | **不改** | 02 原本就写 6，判定表也认定 02 对。 |
| **01-review**：DP padding 规则、MC2 容量 128、EP16/每卡 18 专家、decode 每请求 4 token、图尺寸 | **不改** | 判定表三方一致或认定 02 对，原文无误。 |
| **02-review**「写法整体判断」 | **不改** | 无待办项。 |

**本轮没有被拦截的文件或命令。** 未读（按约束）：HANDBOOK、官方教程正文（只 grep 单行）、`wiki/concepts/glm-5-3-flash-two-node.md`。未改动任何其他文件，未做 git 提交。

### 12.1 追加修订（同日第二轮，与 03 底稿对齐）

| 意见 | 处理 | 说明 |
|---|---|---|
| **03 认为 MTP 的 lm_head 应计 0**（03-review P1-1） | **已改，03 对**（§7.5、§1.3、§9.1、§7.6、§10） | 两条依据都独立核实通过：① `va:vllm_ascend/patch/platform/patch_glm5_next_config.py#L14-L20` 的 `Glm5NextModelArchConfigConvertor.is_deepseek_mla()` 返回 `kv_lora_rank is not None`（=512，真），`#L29-L30` 注册 `glm5_next`/`glm5_next_text`，补丁在 `patch/platform/__init__.py#L44` 无条件导入；`deepseek_mtp` 在 `v:vllm/config/speculative.py#L550-L554` 归一成 `"mtp"`；于是 `va:vllm_ascend/spec_decode/llm_base_proposer.py#L589-L596` 的 `layer_module.shared_head.head = target_language_model.lm_head` 成立。② `glm-flow/reference/checkpoint-shapes.json`（sha 690b7052，2062 个张量）第 45 层只有 `shared_head.norm.weight`，全仓只有一个 `lm_head.weight`。**MTP 从 692.0 → 540.75 MiB**，整卡 21,229 → **21,078 MiB = 20.58 GiB**，余量 33.7 → **33.8 GiB**（十进制口径 30.1 GiB）。与 03 的 533–560（≈541）对上。 |
| **MLA 量化字节：02 写 37.25，03 给 21–42** | **口径说明，两边都不改** | 两者量的**不是同一个范围**：02 的 37.25 MiB/层 = MLA 本体 23.0 + 索引器 14.25；03 的 21–42 是**不含索引器**的 MLA 本体区间。上界一致（02 的 MLA 本体上界 56.25 − 14.25 = **42.0** = 03 的 42）。下界差 2.0 MiB：03 的 21 额外假设 `kv_b_proj` 也被量化（4.0 BF16 → 2.0 int8），而 §0.4 的排除表里 `self_attn.kv_b_proj` 出现 **12 次**（11 个 MLA 层 + MTP 层），判为 BF16，故 02 取 23.0。 |
| **索引器：02 写 14.25，03 给 8.25–14.25** | **口径说明，两边都不改** | 上界完全一致。03 的下界 8.25 假设 `indexer.wq_b` 被量化（12.0 BF16 → 6.0 int8）；而排除表里 `self_attn.indexer.wq_b` 同样出现 **12 次**，`wk_weights_proj` 在代码里更是写死 `quant_config=None`（`va:.../glm5_next.py#L1288`），所以 02 取全 BF16 的 14.25。两份底稿的差异**只来自「哪些模块被量化」这一个假设**，等 `quant_model_description.json` 到手即可一次定案（§10 第 1 条）。 |
| 合计口径校验 | — | 02 的两个值相加 23.0 + 14.25 = **37.25**；03 的上界相加 42 + 14.25 = **56.25** = 02 的全 BF16 上界；03 的下界相加 21 + 8.25 = 29.25，即「能量化的全量化」下界。三条线自洽。 |

### 12.2 追加修订（2026-09-27 第三轮，据 01 A0 增补审查与页面写手复算）

| 意见 | 处理 | 说明 |
|---|---|---|
| **§1.3 KDA 行写成 34.61 × 34 = 1149.0 MiB**（页面审查员复算 1,176.7） | **已改，只是单位笔误** | 按 §4.4 逐项字节：36,294,688 B/层 × 34 = 1,234,019,392 B = **1,176.9 MiB = 1.149 GiB**；原表把 GiB 的数字写成了 MiB。形状与切法对照 `v:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L102-L226` 核过（`f_a_proj`/`g_a_proj` 为 `ReplicatedLinear`，其余按 TP8 切，conv1d/`A_log`/`dt_bias` 为 FP32）；`va:vllm_ascend/ops/kimi_kda.py#L209-L218` 的全秩门替换只在 `use_full_rank_gate` 为真时生效，而 checkpoint 里第 0 层是 `g_a_proj`/`g_b_proj` 低秩门，不触发。**主干小计 20,537 MiB 用的本来就是 1,176.9**：九项相加 151.25 + 1,176.9 + 54 + 409.75 + 18,144 + 126 + 189 + 135 + 151.25 = 20,537.1；若真用 1149.0 只有 20,509.2。所以 20.06 / 20.58 GiB、§1.3 余量 33.8 GiB、01 的 3,855 块及其下游都**不变**。§4.4 末行同步写出 MiB 值。 |
| **§2.3 写成每层一次 20 轮 Sinkhorn**（新增 P1） | **已改** | `va:.../glm5_next.py#L2217`（注意力前）与 `#L2227-L2232`（MLP 前）每层各调一次 `hc_pre`，`hc_pre`（`#L2147-L2160`）每次都把 `hc_sinkhorn_iters`（`#L2134`，= 20）传给 `npu_hc_pre_v2`。改为**每层两次 20 轮 Sinkhorn**；新增 `[D]` 主干一次前向 90 次 `hc_pre`、1,800 轮 Sinkhorn、90 次 `hc_post`。§2.1 的「每层做一次混合」同步改成「两个子层各一次，每层两次」。mHC 不涉及通信，§1.2 / §9.2 的通信账不受影响；本文件与 01、03 没有其他由这个次数推出的数。 |
| **§6.5 写成 42 层 = 4.03 MiB/token**（one-request 写手复算 3.94） | **已改** | 98,336 × 42 = 4,130,112 B = **3.94 MiB**（4.03 恰好等于 96 KiB × 42 = 4,032 KiB 按 1000 折算，推测是进位混用）。§9.2 的 dispatch 1.31 + combine 2.63 = 3.94 MiB 本来就对，**无下游变化**。 |

**本轮没有被拦截的文件或命令。** 只改了 §1.3 KDA 行、§2.1、§2.3、§4.4 末行、§6.5 与本节。

### 12.3 追加修订（2026-09-27 第四轮，据 `docs/mainline/review/pages/concurrent-requests-review.md` 第三节）

| 意见 | 处理 | 说明 |
|---|---|---|
| **§8.5 纯 decode 的 MC2 口径漏了图尺寸补齐**（concurrent-requests 写手复算，页面审查员核实） | **已改** | `va:worker/model_runner_v1.py#L2914-L2967` 先把本地 token 数补到捕获尺寸（DP0 48 → 64、DP1 28 → 32），再以补齐值做两组对齐（`#L2976-L2996`），两组都是 64；`padded_num_tokens = ceil(64/8)×8 = 64`，MC2 `prepare` 按 TP8 切片后每卡 **8 行**（原写 6 行）。单层单卡 1,032,384 B → **1,376,512 B（≈ 1.31 MiB）**，42 层 41.4 MiB → **≤ 55.1 MiB**（上界），新增跨 EP16 部分 **≤ 31.5 MiB**；比值 151× → **≈ 113×**，跨机 **≈ 135×**；「增速快了将近一倍」→「快了约四成」。80×、6.09 GiB、4.15 GiB、§8.6 的 608 对 / 38 行（按真 token 计）不变。§12 表中 P1-3 那一行的 41.4 MiB / 151× 是当时的记录，以本行为准。本文件与 01、03 没有其他由 41.4 或 151× 推出的数。 |

### 12.4 追加修订（2026-09-27 第五轮，据模型页写手：索引器 FP32 副本漏记）

| 意见 | 处理 | 说明 |
|---|---|---|
| **§1.3 漏了索引器运行时的 FP32 副本（≈54 MiB/卡）和池内位置偏置（FP32，2 KiB/层）** | **核实属实，只在 §1.3 表下加一段说明，不改任何数字** | 副本是 `forward` 里惰性创建的（`va:.../glm5_next.py#L1349-L1352`），每层 4.5 MiB × 12 层 = 54 MiB；profile run 的 `attn_metadata` 为 None，SFA 在 `sfa_v1.py#L1660-L1666` 提前返回，索引器不执行，所以副本在 KV 预算之后才占显存，走预算外 15%。位置偏置随权重加载，12 层 24 KiB，低于取整粒度。 |

数字变更：**无**（整卡 21,078 MiB = 20.58 GiB、余量 33.8 GiB、01 的 30.0 GiB / 3,855 块、页面的 3,908 块都不变）。01、03 与各页面不改。本轮没有被拦截的文件或命令。

### 12.5 追加修订（2026-09-27，流程图审查修订）

| 意见 | 处理 | 说明 |
|---|---|---|
| 三页流程图报告 P1-1：§5 的索引器依据误指单测参考方法 | 已改 | 按 `db701c1f` 的 `forward_ascend` → `ops` → triton 运行路径重写 §5.3–5.4 的出处，池分确定为头加权查询与池 K 的点积；压池、选池、展开、固定补尾均落到运行算子。删除 decode 使用 `npu_lightning_indexer` 的错误说明；§5.4–5.5 同步区分 2051 上界与实际尾部长度，133120 位置的例子实际读 2048 条，R1 在 8 个位置时有 2 个完整池。显存预算与权重合计不变。 |
| 2026-09-27 C3 复审：§5.5 与全文推理路径复核 | 已改 | §5.5 改引 GLM 专用重写 → A2 `BaseDeviceAdaptor` → `npu_sparse_flash_attention` / `aclnnSparseFlashAttention`，明确 PyTorch chunk=16 仅属单测；§5.2、§5.11、§10 确认融合前处理关闭，§5.9 补清逐 query 的因果尾部。全文 grep 并追踪调用后，另将 §6.5–6.8 误引的非 v0.23 MoE 分支替换为 `fused_moe_0_23_0.py`，纠正归约实际由自定义算子分支控制（覆盖 §12 旧 P2-1 的引用结论）；通信、权重、KV 容量数字不变，§5.5 数字仅为逻辑计算/数据量上界。六个主线页 grep 后仅改 `one-request.md` 的 MoE 来源及两行选位置说明，其余五页无须同步；源码静态核对，不代表 NPU 实测。 |

### 12.6 追加修订（2026-09-28，据 `docs/mainline/review/pages/layers-and-hidden-review.md`「底稿 02 §1.1 的顺序」）

| 意见 | 处理 | 说明 |
|---|---|---|
| §1.1 层表最后一行「最终 norm → 折叠四路残差」顺序写反 | 已改（只改 L92 一处） | `va:.../glm5_next.py#L2237-L2239` 在第 44 层 forward 末尾把四路求平均折回 [T, 4096]，主循环结束后 `#L2318` 才做最终 RMSNorm，再到 `compute_logits`（`#L2515-L2517`）。改为「折叠四路残差（第 44 层末尾四路求平均）→ 最终 norm → lm_head」。§7、§9 顺序本来就对；数字无变更。 |
| 2026-09-28 据 `docs/mainline/review/pages/mlp-residual-norm-review.md`「P5 审查」3.1：§3.1「`silu(gate)*up` 并夹到 ±10」不准确 | 已改（只改 L213 一处） | 源码在 SiLU 之前限幅：gate 只限上界 ≤ 10，up 限到 [−10, 10]，乘积不再截断（`va:vllm_ascend/ops/activation.py#L46-L54`，截断在 L51–L52；上游 `vllm/model_executor/layers/activation.py#L179-L183` 相同）。数字不变；静态读码，未做 NPU 实测。 |
