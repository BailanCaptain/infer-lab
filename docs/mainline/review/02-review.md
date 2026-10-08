# 02-forward.md 独立审查（2026-09-27）

> **追注（2026-09-27，审查原文未改）：** 本文 P1-3、P3-5 和「[C] 算式复核」表里给出的 **41.4 MiB / 151×** 不是正确值，已在底稿 `docs/mainline/02-forward.md` §12.3 作废：当时漏算了纯 decode 步的图尺寸补齐（两组都补到 64 行，MC2 每卡 8 行而不是 6 行）。现在的正确值是 **MC2 每卡每步 ≤ 55.1 MiB（上界）、比值约 113×**。下文照审查当时的原样保留，引用时以 §12.3 为准。

审查对象：`docs/mainline/02-forward.md`（A4 逐层前向 · B5 多请求 MoE）。
源码基准：`vllm-ascend@db701c1f`（记作 `va`，用 `git -C tools/repos/vllm-ascend show db701c1f:<path>` 读）、`vllm@0fc695fc`（记作 `v`，`git describe --tags` = `v0.23.0`，已复核）。
模型配置：`glm-flow/reference/official-config.json` 的 `text_config` / `quantization_config`。
本次实际打开核对的源码引用约 60 处（覆盖任务点名的全部 7 个关键数字），[C] 算式全部重算。
本文件只记录审查结论，未改动任何底稿，未做 git 提交。

**问题数：P1 = 4，P2 = 5，P3 = 6。**

---

## P1 事实/数字错误

### P1-1 MLA 的 `block_size` 不是 128，一页也不是 128 KiB

- **位置**：02-forward.md:429–430（§5.6）、486 附近的表格行、483（§5.11 第 1 条）
- **原结论**：「`block_size = 128`：MLA backend 的 `get_supported_kernel_block_sizes()` 返回 `[GLM5_SFA_KERNEL_BLOCK_SIZE]`，常量 = 128 …… 一页 = 128 × 512 × 2 = **131,072 B = 128 KiB / 层**」「索引器 cache 的 `compress_ratio=4`，一页覆盖 128 × 4 = **512 个 token**，页大小 32 × 128 × 2 = 8,192 B」
- **源码证据**：
  - `va:vllm_ascend/patch/platform/patch_mamba_config.py#L125-L159`：GLM 分支算出 `min_attn_block_size = 128 × cdiv(mamba_raw_size, 128 × attn_token_page_size) = 128 × cdiv(561152, 131072) = 640`，随后 `cache_config.block_size = attn_block_size = 640`（`#L153-L159` 就地覆盖）。
  - `va:vllm_ascend/ops/indexer_kpool_mla.py#L77`：`self.block_size = cache_config.block_size`，MLA cache spec 用的是这个**逻辑块**（`#L121-L134`），不是 kernel block。
  - `va:vllm_ascend/attention/indexer_kpool_mla_v1.py#L138-L146`：`if self.logical_block_size % GLM5_SFA_KERNEL_BLOCK_SIZE: raise …` + `kernel_blocks_per_logical_block = logical // 128`，说明 128 是逻辑块的**约数**，两者本来就不是一回事。
- **影响**：一页 MLA = 640 × 512 × 2 = **655,360 B**；索引器一页覆盖 **640 个 token**、大小 160 × 128 × 2 = **40,960 B**。与 01 底稿 A0.4/A0.5 直接冲突，且 01 是对的。
- **建议改法**：§5.6 改成「逻辑块 640 token（由 `patch_mamba_config.py#L131-L139` 从 KDA 状态 561,152 B 反推），128 只是 SFA kernel block，一个逻辑块 = 5 个 kernel block」，页字节按 655,360 / 40,960 重写，并把 §5.11 第 1 条待核项删掉（见 P2-4）。

### P1-2 「MLA 的全部投影留 BF16」与所引的 `modules_to_not_convert` 自相矛盾

- **位置**：02-forward.md:46–48（§0.4）、440–452（§5.7 权重表）、98（§1.3 表「MLA + 索引器（BF16）56.25 MiB」）
- **原结论**：「**注意力（KDA 的全部投影、MLA 的全部投影、索引器）…… 都留 BF16**」「把 `self_attn.*`（`q_proj`/`k_proj`/`v_proj`/`o_proj`/`kv_b_proj`/…）…… 全部排除」
- **源码证据**（`official-config.json` → `quantization_config.modules_to_not_convert`，1509 条，逐条统计）：
  - `*.self_attn.o_proj` 只出现 **34 次**，层号正好是 `kda_layers`（0,1,2,4,5,6,…）；11 个 MLA 层（3,7,…,43）和 MTP 层 45 的 `o_proj` **不在排除表**。
  - 排除表里 **没有任何** `q_a_proj` / `q_b_proj` / `kv_a_proj_with_mqa` / `fused_qkv_a_proj` 条目（各 0 次）。MLA 层被排除的只有 `indexer.*`、`kv_b_proj`、`q_a_layernorm`、`kv_a_layernorm`（各 12 次 = 11 + MTP）。
- **影响**：按这份表，MLA 的 `fused_qkv_a_proj`(16 MiB)、`q_b_proj`(6 MiB)、`o_proj`(16 MiB) 会被量化 → 每层每卡约 **37.25 MiB** 而不是 56.25 MiB；11 层 409.75 MiB 而不是 618.8 MiB；§1.3 的 20.26 GiB 与「剩约 30 GiB」也要跟着改。
- **建议改法**：§0.4 的排除范围改写为「KDA 的全部投影 + MLA 的 `kv_b_proj` + 索引器 + embed/lm_head/gate/norm/hc_*」；§5.7 表按「BF16 项 / int8 项」分列，并把两种取值（全 BF16 上界 56.25 MiB、按上游表 37.25 MiB）都摆出来，等 `GLM-5.3-Flash-w8a8` 的 `quant_model_description.json` 到手再定。注意这条目前被 §0.4 的「待核」遮住了：待核说的是「清单可能不同」，而正文写的结论**与现有清单相反**，属于事实错误而不是不确定。

### P1-3 §8.5 的 MoE finalize 载荷算错，连带 40.4 MiB / 154× 两个数

- **位置**：02-forward.md:784、786、791–794
- **原结论**：「finalize TP8 All-Gather：每卡发 6 行 = 24 KiB」「单层单卡 ≈ 984 KiB；42 层 ≈ **40.4 MiB / 卡 / 步**」「比值 **154 ×**」
- **重算**：一行 hidden = 4096 × 2 B = 8,192 B（这正是同文件 §9.2 用的口径：「每卡发 8,192 B」）。6 行 = 49,152 B = **48 KiB**，不是 24 KiB。
  单层 = 192.2 + 384 + 48 + 384 = **1008.2 KiB**；42 层 = 42,344 KiB = **41.4 MiB**；6.09 GiB / 41.4 MiB = **151×**。
- **源码证据**：`va:vllm_ascend/ops/fused_moe/prepare_finalize.py#L208-L223`（MC2 finalize 用 `dist.all_gather` 把 TP8 切片拼回 `padded_hidden_states_shape`，每卡发本地那一片完整的 `[rows, 4096]`，dtype 为 BF16）。
- **建议改法**：24 KiB → 48 KiB，984 KiB → 1008 KiB，40.4 MiB → 41.4 MiB，154× → 151×（80× 那一列不变）。§8.5 结论文字「涨了两个数量级」仍成立。

### P1-4 共享专家「在独立 stream 上跑、盖住 MC2 通信」在本部署默认关闭

- **位置**：02-forward.md:641（§6.7 第 3 条）
- **原结论**：「它和路由专家**并行**：`_forward_shared_experts` 在独立 stream 上跑，用 event 和 dispatch / gmm2 / combine 对齐，让共享专家的计算盖住 MC2 的通信」
- **源码证据**：
  - `va:vllm_ascend/ops/fused_moe/fused_moe.py#L734`：`with npu_stream_switch(shared_experts_calculation_stream(), enabled=self.multistream_overlap_shared_expert)` —— 整段重叠由这个开关控制。
  - `va:vllm_ascend/ascend_config.py#L139`：`self.multistream_overlap_shared_expert = additional_config.get("multistream_overlap_shared_expert", False)`，**默认 False**；教程启动命令没有 `--additional-config`（计划 §3），所以本部署不开。
- **建议改法**：改成「代码里留了重叠通路（`#L726-L832`），由 `multistream_overlap_shared_expert` 控制，默认 False，本部署**串行执行**；若要打开需加 `--additional-config`」。这条同时是 §6.11 待核「`multistream_overlap_gate` 默认值没查到」的答案：`ascend_config.py#L140`，同样默认 False。

---

## P2 缺源码支撑 / 行号错 / 跨文档冲突

### P2-1 §6.8 引用 `#L574-L580` 越界

- **位置**：02-forward.md:656
- **原结论**：「(#L574-L580)：TP8 All-Reduce（`moe_comm_type == ALLGATHER` 时 `maybe_all_reduce_tensor_model_parallel` 真的 all-reduce）」，上下文里 `#L…` 都指 `prepare_finalize.py`。
- **源码证据**：`va:vllm_ascend/ops/fused_moe/prepare_finalize.py` 全文只有 **560 行**；该逻辑实际在 `va:vllm_ascend/ops/fused_moe/fused_moe.py#L574-L580`（`_maybe_reduce_final_output`），判定开关在同文件 `#L551-L562`（`_fused_output_is_reduced`）。
- **建议改法**：写全 `va:ops/fused_moe/fused_moe.py#L574-L580`。

### P2-2 §6.8 把 ALLGATHER 的 dispatch 算子挂错文件

- **位置**：02-forward.md:653
- **原结论**：「dispatch (#L342-L440)：`npu_moe_init_routing_v2`，`active_expert_range=[18r, 18r+18)`」
- **源码证据**：`prepare_finalize.py#L342` 只是 `PrepareAndFinalizeWithAllGather` 的类注释行（`Attn → TP AR → DP AG → MoE → DP RS → TP AR`），该文件里没有 `npu_moe_init_routing_v2`。算子在 `va:vllm_ascend/ops/fused_moe/token_dispatcher.py#L401-L412`（`active_expert_range=[first_expert_idx, last_expert_idx]` 在 `#L409`，`group_list_type = 1` 在 `#L414`），说明文字在 `va:ops/fused_moe/moe_comm_method.py#L186-L200`。
- **建议改法**：改引 `token_dispatcher.py#L401-L412`。

### P2-3 每卡权重账漏掉 MTP 层，却给出整卡余量结论

- **位置**：02-forward.md:104–106（§1.3 合计与「剩约 30 GiB」）
- **原结论**：「合计 ≈ **20.26 GiB**」「减掉 20.26 GiB 权重，剩约 30 GiB 给 KV、状态、激活和图」
- **证据**：MTP 层是真实驻留权重：`va:vllm_ascend/models/glm5_next_mtp.py#L53-L57`（`eh_proj` = `nn.Linear(8192, 4096)`，不切 TP，64 MiB）、`#L85`（`mtp_block = AscendGlm5NextDecoderLayer`，带一整套 MoE：路由专家 432 MiB + 共享专家 3 MiB + gate 4.5 MiB）+ 独立 `shared_head.head` 151.25 MiB。量级约 **0.65 GiB/卡**，03 底稿也单独算了这笔账。
- **建议改法**：表里加一行「MTP 层（见 03 底稿）≈ 0.65 GiB」或在合计处注明「本表只含主干 45 层，MTP 另计」，余量结论改成「约 29 GiB」。

### P2-4 用「待核」代替了已经能查到的答案（block_size 对齐路径）

- **位置**：02-forward.md:483（§5.11 第 1 条）、865（§10 第 2 条）
- **原结论**：「vLLM 把 `cache_config.block_size`（教程未设，CacheConfig 默认 16）对齐到 128 的**具体代码路径**没有逐行跟……**待核**」
- **源码证据**：路径是确定的：`v:vllm/config/vllm.py` 调 `HybridAttentionMambaModelConfig.verify_and_update_config`，该函数被 `va:vllm_ascend/patch/platform/patch_mamba_config.py#L59-L228` 整体替换，GLM 分支在 `#L125-L159`，结果 640（同 P1-1）。
- **建议改法**：把待核项换成结论 + 引用；这是本文件里最典型的「否定式免责句顶替答案」。

### P2-5 §8.7 的待核在 01 底稿里已有答案

- **位置**：02-forward.md:815
- **原结论**：「**待核**：DP 空闲组 dummy run 的确切 token 数和触发路径（属于 01 号底稿的 B1 站）」
- **证据**：01-deploy-entry-schedule.md:466–473 已经给出链路（`DPEngineCoreProc.run_busy_loop` → `execute_dummy_batch` → `_dummy_run(num_tokens=uniform_decode_query_len=4, uniform_decode=True)`），只剩「dummy run 是否真的走 MoE 通信」一条未核。
- **建议改法**：改成「token 数 = 4，见 01 §B1；仍待核的只有 dummy run 是否短路 MoE 通信」。

---

## P3 表述不清

| # | 位置 | 问题 | 建议 |
|---|---|---|---|
| P3-1 | 02:74（§1.2 表题） | 「MC2 路径，即 batch token 数 ≤ 128」——判定用的是 **DP 组内最大** token 数（`va:ascend_forward_context.py#L96-L98`），表题的口径要到 §6.4 才纠正，读者容易记成本卡 token 数 | 表题直接写「DP 组最大 token 数 ≤ 128」 |
| P3-2 | 02:106 | 「64 GB × 0.85 ≈ 54.4 GB」——单位在 GB/GiB 之间混用，同段后面又用 GiB 做减法（01 写的是 64 GiB） | 统一成 GiB |
| P3-3 | 02:261 vs 02:284 | 卷积状态维序不一致：§4.5 写 `conv_state = [3072, 6]`，§4.7 写 `conv_state[·,6,3072]` | 统一成 `(3072, 6)`，并注明顺序由 `is_conv_state_dim_first()` 决定（`va:ops/kimi_kda_state.py#L30`） |
| P3-4 | 02:416（§5.5） | 「每个 query token 要读的 KV …… 11 层 **22.0 MiB / token**」没限定前提，而紧邻的 §5.4 刚说明 R1 实际只有 1 个 pool、是稠密的；22 MiB 只在历史 ≥ 2051 token 时成立 | 加一句「历史长于 2051 token 时的稳态值；短序列按实际有效 pool 数算」 |
| P3-5 | 02:795（§8.5） | 「多出来的那一倍主要来自 DP1 的 216 倍 padding」——前文刚说 154×（修正后 151×）对 80×，「一倍」指的是 1.9 倍的差，句子读不通 | 改成「通信量的增速比真 token 的增速还快约一倍」 |
| P3-6 | 02:16（§0.1 表） | 「投机 `deepseek_mtp`，`num_speculative_tokens=3`，`enforce_eager=true`」并列，未说明 `enforce_eager` 只作用于草稿模型（01:199 已写明主模型仍捕获 decode 图） | 括注「仅草稿侧」 |

**写法整体判断**：各站的「做了什么」（§2.1 / §3.1 / §4.1 / §5.1 / §6.1 / §7.1）对初学者是可读的——都先给一句大白话机制（KDA 把历史压进固定矩阵、MLA 把 KV 压成一条 512 维、MoE 288 选 8 散落在不同卡），再进形状和字节，没有跳步。用否定式免责句顶答案的只有两处（P2-4、P2-5），不是普遍现象。

---

## 关键数字复核结果（任务点名的 7 项）

| 数字 | 结论 | 证据 |
|---|---|---|
| `mc2_tokens_capacity = 128` | ✅ 成立 | `va:ascend_forward_context.py#L202-L217`：`enable_prefill_mc2` 默认 False（`ascend_config.py#L165`）→ `max_num_tokens = max_cudagraph_capture_size = 128` → `ceil(128/8)=16`，`min(16,512)×8 = 128` |
| A2 上只在 MC2 / ALLGATHER 二选一 | ✅ 成立 | `va:ascend_forward_context.py#L240-L252`（A2 分支只返回这两种；`ALLTOALL` 只在 `_select_a3_moe_comm_method#L255-L282`）。18 ≤ 24、ep_world_size = 16 ≥ 16 两个前置条件成立 |
| 按 DP 组内最大 token 数判定 | ✅ 成立 | `va:ascend_forward_context.py#L97-L98`：`max_num_tokens = num_tokens_across_dp.max()` 后才 `select_moe_comm_method` |
| 每卡 18 个专家 / 每层 432 MiB | ✅ 成立 | `v:fused_moe/config.py#L1073-L1082, L1193-L1210`（EP 分支 `tp_size=1`、`ep_size = dp×tp = 16`）+ `v:fused_moe/layer.py#L263-L264`（中间维不切）+ `va:models/glm5_next.py#L1496-L1500` + `va:quantization/methods/w8a8_dynamic.py#L188-L198`：w13 `[18,4096,4096]` = 288 MiB、w2 `[18,4096,2048]` = 144 MiB，合 432 MiB；×42 = 17.72 GiB ✔ |
| KV 11,968 B/token，TP8 内复制不切 | ✅ 成立 | `va:ops/indexer_kpool_mla.py#L71`（`head_size = 512+0`）、`#L126-L134`（`num_kv_heads=1`，dtype 固定 bf16，`#L74-L76`）→ 1024 B/层；`va:models/glm5_next.py#L1306-L1313` + `#L295-L304`（索引器 `head_dim=128`、`compress_ratio=4`）→ 64 B/层；11 × 1088 = 11,968 ✔；`num_kv_heads=1` 即每卡整份 ✔ |
| KDA 状态 561,152 B/请求/层 | ✅ 成立 | `va:ops/kimi_kda_state.py#L27-L32`：conv `(3×64×128/8, 4-1+3) = (3072,6)` bf16 = 36,864 B；recurrent `(8,128,128)` fp32 = 524,288 B（dtype 见 `v:mamba/mamba_utils.py#L119-L125`）；合 561,152 ✔；×34 = 18.2 MiB/请求，×32 槽 = 582 MiB ✔ |
| 索引宽度 2051 与 64.09 MiB 缓冲 | ✅ 成立 | `va:models/glm5_next.py#L516-L520`（`2048/4 = 512` 个 pool）、`#L599-L604`（`tail_width = 4-1`，`output_width = 2048+3`）、`#L2252-L2259`（`torch.empty(8192, 2048+4-1, int32)`）→ 8192×2051×4 = 67,207,168 B = 64.09 MiB ✔，11 个 MLA 层共用一份 ✔ |
| 一次前向 218 次集合通信 | ✅ 算式成立 | 1（嵌入 AR，`va:ops/register_custom_ops.py#L84-L95`）+ 45（各层 `o_proj` AR：KDA `va:ops/kimi_kda.py#L291`、MLA `va:attention/sfa_v1.py#L2028`）+ 3（稠密 `down_proj`）+ 42×4（MC2 dispatch/combine/finalize AG/共享专家 AR）+ 1（lm_head AG，`v:logits_processor.py#L75-L103`）= 218 ✔。ALLGATHER 路径每层同样 4 次（DP AG×2 + DP RS + TP AR，且共享专家不再单独 AR，`va:fused_moe.py#L551-L562, L826-L831`），总数仍 218 ✔ |

## [C] 算式复核（场景 M 及其它）

| 项 | 底稿值 | 复核 | 结论 |
|---|---|---|---|
| 场景 M 单层单卡通信 | 148.4 MiB | 47.25 + 6.64 + 47.25 + 47.25 = 148.39 | ✅ |
| 场景 M 42 层 | 6.09 GiB | 148.39 × 42 = 6232.4 MiB = 6.086 GiB | ✅ |
| 跨机部分 | 4.15 GiB / 16 卡 ≈ 66 GiB | 42 × 101.14 = 4247.9 MiB = 4.148 GiB；×16 = 66.4 GiB | ✅ |
| DP1 放大 | 216 倍 | 6048 / 28 = 216 | ✅（`va:prepare_finalize.py#L458-L469` 确认补齐到 `max_tokens_across_dp`） |
| 纯 decode 42 层 | 40.4 MiB | 应为 **41.4 MiB**（finalize 48 KiB 而非 24 KiB） | ❌ 见 P1-3 |
| 比值 | 154 × | 修正后 **151 ×** | ❌ 见 P1-3 |
| 真 token 比 | 80 × | 6076 / 76 = 79.9 | ✅ |
| 路由专家 17.72 GiB | 17.72 | 432 MiB × 42 = 18,144 MiB = 17.72 GiB | ✅ |
| 每卡权重 20.26 GiB | 20.26 | 逐项相加 = 20,746 MiB = 20.26 GiB（算术正确，但受 P1-2 / P2-3 影响） | ⚠️ |
| 专家占比 88% | 88% | 18,144 / 20,746 = 87.5% | ✅ |
| KDA 34.61 MiB/层 | 34.61 | 25,165,824+8,388,608+2,097,152+524,288+65,536+49,152+4,096+32 = 36,294,688 B = 34.614 MiB；×34 = 1.149 GiB | ✅（conv1d/dt_bias/A_log 确为 FP32：`v:kimi_gdn_linear_attn.py#L171-L201`） |
| MLA 56.25 MiB/层 | 56.25 | 29,491,200 B = 56.25 MiB（按全 BF16）；×11 = 618.75 MiB | ✅ 算术，前提见 P1-2 |
| 稠密 MLP 18 MiB/层 | 18.0 | 12 + 6 | ✅ |
| 满长请求 KV 1.484 GiB | 1.484 | 133120 × 11,968 = 1,593,180,160 B | ✅ |
| 稀疏注意力 33.6 MFLOP/token/层 | 33.6 | 2 × 8 × 2051 × 512 MAC = 16.8 M MAC = 33.6 MFLOP；×11 = 370 MFLOP | ✅ |
| lm_head all-gather 1.18 MiB | 1.18 | 4 × 154880 × 2 = 1,239,040 B | ✅（与 03:150 一致） |
| R1 总通信 ≤ 7.3 MiB | 7.3 | 2.84 + 1.31 + 2.63 + 0.33 + 0.15 = 7.26 MiB | ✅ |
| 全模型路由专家 304.4 B / 激活 9.51 B | — | 288×3×4096×2048×42 = 3.044e11；9×3×4096×2048×42 = 9.51e9 | ✅ |

## 模型维度逐项核对（对 `official-config.json`）

| 项 | 底稿 | config | 结论 |
|---|---|---|---|
| 层数 / hidden / vocab | 45 / 4096 / 154880 | 同 | ✅ |
| `hc_mult` / sinkhorn | 4 / 20 | `hc_mult=4`、`hc_sinkhorn_iters=20` | ✅（代码侧 `mhc_num_residual_streams`，`mix_hc=(2+n)n=24`、`d_model=16384`，`va:glm5_next.py#L2137-L2145`） |
| 注意力头数 | MLA 64 头 | `num_attention_heads=64` | ✅（每卡 8，`va:glm5_next.py#L1910-L1911`） |
| `q_lora` / `kv_lora` | 1536 / 512 | 同 | ✅ |
| nope / rope / v | 256 / 0 / 256 | `qk_nope_head_dim=256`、`qk_rope_head_dim=0`、`v_head_dim=256`、`qk_head_dim=256`、`mla_use_nope=true` | ✅（scale = 256^-0.5 = 0.0625，`#L1912`；rope 分支不进，`#L1965-L2000`） |
| 索引器 | 32 头 × 128，topk 2048，kpool 4 | `index_n_heads=32`、`index_head_dim=128`、`index_topk=2048`、`index_kpool=4`、`index_kpool_compress/always_select_tail=true` | ✅ |
| KDA | 64 头 × 128，conv 4，lower bound −5.0 | `linear_attn_config` 同；`kda_layers` 34 项、`full_attn_layers` 11 项（3,7,…,43） | ✅ |
| 专家 | 288 选 8 + 1 共享，`moe_intermediate=2048` | 同；`n_group=1`、`topk_group=1`、`scoring_func=sigmoid`、`topk_method=noaux_tc`、`norm_topk_prob=true`、`routed_scaling_factor=2.5` | ✅（`va:glm5_next.py#L1480-L1523`、`va:ops/fused_moe/experts_selector.py#L292-L307`） |
| 稠密层 | 前 3 层，12288 | `first_k_dense_replace=3`、`intermediate_size=12288`、`mlp_layer_types` 前 3 项 dense | ✅ |
| MTP | 1 层 | `num_nextn_predict_layers=1` | ✅ |

附带确认：§6.2 走的是「模型侧先算 gate」这条路——`is_internal_router` 要求 gate 带 `weight_fp32`（`va:fused_moe.py#L540-L542`），而 `precast_fp32_weight` 只在 `va:models/deepseek_v4.py#L383` 设过，GLM 没有，所以 `AscendGlm5NextMoE.forward#L1533` 的外部 gate 生效；gate 权重是 FP32（`v:fused_moe/router/gate_linear.py#L54-L57`，非 CUDA 平台 `force_fp32_compute` → `params_dtype=float32`），4.5 MiB/层成立。

---

## 跨文档一致性判定表

| 量 | 01-deploy-entry-schedule.md | 02-forward.md | 03-sample-decode.md | 判定（以源码为准） |
|---|---|---|---|---|
| 块大小 | 逻辑块 **640** token + 128 kernel block（01:112-142） | §5.6 写 `block_size = 128`、一页 128 KiB（02:429-430） | 未涉及 | **01 对**。`patch_mamba_config.py#L131-L159` 把 `cache_config.block_size` 置 640，`indexer_kpool_mla.py#L77` 直接取它；128 只是 `GLM5_SFA_KERNEL_BLOCK_SIZE`（`indexer_kpool_mla_v1.py#L38, L138-L146`）。02 改（P1-1） |
| 每 token KV 字节 | 只给 MLA 1024 B/层（01:134），未汇总 | 1024 + 64 = 1088 B/层 → **11,968 B/token** | 未给，注明「要接 01 底稿」（03:207） | **02 对且最完整**（索引器 64 B/token/层 出自 `glm5_next.py#L1306-L1313` 的 `compress_ratio=4`）。建议 01/03 统一引 02 的 11,968 B |
| KDA conv 状态长度 | 标 `[!]`：说分块用 6、实际 MambaSpec 用 3（01:211） | 一律 **6**（02:259） | 未涉及 | **02 对**。`AscendKimiGatedDeltaNetAttention.get_state_shape` 覆写了基类（`va:ops/kimi_kda.py#L235-L242`，带 `self.num_spec=3`，来源 `v:mamba/gdn/base.py#L43-L47`），而 `MambaSpec` 正是用 `self.get_state_shape()`（`v:mamba/abstract.py#L44-L60`）。01 的「两处不一致」待核项不成立，应删 |
| MC2 容量 | 未提 | **128**（§6.4，推导完整） | 未提 | **02 对**，无冲突。03 §B4 讲图尺寸 128 时可引用 02 这条（两者同源：`max_cudagraph_capture_size`） |
| DP padding 规则 | `max_tokens_across_dp = max(...)`、`padded = ceil(max/tp)×tp`（01:482） | 同（§6.5 步骤 1、§8.3） | `allow_dp_padding` 为真时两侧填到 `max_tokens_across_dp`（03:466-468） | **三处一致**，无冲突。`va:ascend_forward_context.py#L185` + `va:worker/model_runner_v1.py#L733-L740, L2976-L2996` |
| MTP 层每卡显存 | 未算 | 未算（§1.3 只算主干 45 层） | **≈671 MiB**，其中「共享专家 24 MiB」（03:169-170） | **02 的切法对，03 的数偏大**：共享专家是 TP8 切分的普通 MLP（`va:glm5_next.py#L1465-L1478`，`reduce_results=False`），每卡 3 MiB 而非 24 MiB → MoE 部分 435 MiB、三项合计约 **650 MiB**。同时 02 §1.3 应注明未含 MTP（P2-3） |
| 每卡权重总量 | 「≈19–20 GiB，93% 是路由专家」（01:98-110） | **20.26 GiB**，88% 是路由专家 | — | **02 的方法对**：01 的 KDA/MLA 两行把「参数个数」当成字节数（KDA 漏了 ×2，MLA 23 MiB/层 也与逐项算式对不上），应改成 34.61 MiB/层、56.25 MiB/层（或按 P1-2 修正后的值）。但 02 的总量本身还受 P1-2、P2-3 两条影响，最终数要一起定 |

---

## 未完成 / 跳过

- 未读（按约束）：HANDBOOK、`GLM5.3-Flash.md` 官方教程、`wiki/concepts/glm-5-3-flash-two-node.md`。凡是标 `[S]`、只能由教程支撑的前提（TP/DP/EP、`max-num-*`、捕获尺寸、`--quantization ascend`、seed），本次**未独立验证**，一律按计划 §3 的前提接受。
- 未核：`npu_moe_distribute_dispatch_v2` / `npu_moe_distribute_combine` 的线上实际字节（02 自己标了上界，合理）；AscendC kernel 内部（`chunk_kda_fwd`、`recurrent_kda`、`npu_hc_pre_v2`、`npu_sparse_flash_attention`）；`GLM-5.3-Flash-w8a8` 的 `quant_model_description.json`（本机没有，P1-2 因此只能按上游 FP8 表判定）；main 分支 `baa023ad` 的差异。
- 没有命令或文件被拦截。
