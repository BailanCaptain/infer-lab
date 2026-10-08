# 审查：docs/mainline/01-deploy-entry-schedule.md

- 审查日期：2026-09-27
- 审查对象：`docs/mainline/01-deploy-entry-schedule.md`（696 行）
- 源码：`vllm@0fc695fc`（`git describe` = v0.23.0）、`vllm-ascend@db701c1f`（用 `git show` 读）
- 模型 config：研究目录 `glm-flow/reference/official-config.json`
- 缩写：`v:` = `vllm@0fc695fc:`，`va:` = `vllm-ascend@db701c1f:`
- 分级：P1 事实或数字错误；P2 结论没有源码支撑、引用行号不对、跨文档冲突；P3 表述不清

## 汇总

| 级别 | 数量 |
|---|---|
| P1 | 6 |
| P2 | 8 |
| P3 | 9 |

最严重的 3 条：P1-1（每个 block id 8,314,880 B 漏算了 MTP 层）、P1-2（B1 的 DP token 数与陪跑宽度写错）、P1-3（待核 5 说实际分配的 conv 状态长度是 3，这是错的）。

---

## P1

### P1-1 每个 block id 的字节数漏掉了 MTP 层（第 45 层）的三份 cache

- **位置**：`01:25`、`01:156-158`、`01:172-177`、`01:180`，以及由它推出的 `01:188-189`、`01:317`、`01:321`、`01:625-642`
- **原结论**：full 组有 11 层 MLA 和 11 个 indexer，indexer-state 组有 11 个；`small_slot_count = 11`；`bytes_per_block = 12×655,360 + 11×40,960 = 8,314,880 B ≈ 7.93 MiB`。
- **源码证据**：
  - MTP 草稿层的 cache 与主模型在同一个 KV 池里。草稿模型复用目标模型的 `static_forward_context`（`va:vllm_ascend/spec_decode/llm_base_proposer.py#L84-L95`）。`load_model` 把新加进来的注意力层记为草稿层（`#L319-L340`）。`#L405-L456` 的注释写明 GLM-next MTP 自带主 MLA、压缩 indexer、压缩器状态三份 cache，并且 `assert not missing_layers, "Draft layers missing from KV cache config"`，也就是说这些层必须出现在 KV cache 组里。
  - MTP 层的编号是 45（`va:vllm_ascend/models/glm5_next_mtp.py#L84-L92`，`mtp_start_layer_idx = num_hidden_layers`，见 `#L131`），构造的是 `AscendGlm5NextDecoderLayer`。
  - 第 45 层不算 KDA 层。`is_kda_layer` 的条件是 `layer_idx < len(layer_types)`（`va:vllm_ascend/transformers_utils/configs/glm5_next.py#L265-L270`），而 config 里 `layer_types` 只有 45 项。所以第 45 层走 `AscendGlm5NextMLAAttention`，带 indexer（`va:vllm_ascend/models/glm5_next.py#L2080-L2105`、`#L2009-L2041`）。
  - runner 收集 KV spec 时，这三份 cache 通过 `cache_role` 分支被收进来（`va:vllm_ascend/worker/model_runner_v1.py#L5137`、`#L5217-L5225`）。
  - 按 `_get_glm5_cache_layout` 计数（`va:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L279-L329`）：MLA 12 层、indexer 12 个、state 12 个；`main_slot_count = max(12, 12, 11, 11) = 12`，`small_slot_count = 12`。
- **重算**：`12×655,360 + 12×40,960 = 7,864,320 + 491,520 = 8,355,840 B = 7.969 MiB`，正好等于 `12 层 × 1,088 B/token × 640`。
  - 连带要改的数（仍按 30 GiB 可用 KV 的算例）：`num_blocks = 3,855`；可存 token 约 2.47 M；R1 的 15 块约 119.5 MiB；满长请求 222 块约 1.728 GiB，最多同时放 17 条；32 条请求各吃 14 块后剩 3,407 块，约 2.18 M token，平均每条约 68.1 K；B3 里 12 条请求后剩 3,303 块，32×108 = 3,456 块后剩 399 块，平均每条还能跑约 7,980 token。
- **建议改法**：A0.5 表里写成「12 层 MLA（11 + MTP 第 45 层）+ 12 个 indexer」「12 个压缩器状态」，slot 公式改成 `12 + 12`；把第 12 个主 slot 的共享关系写清楚：MTP 的 MLA 和 KDA 组 0 的第 12 层（第 44 层）共用。待核 4 里「MTP 的 KV 留给 03」这句要删掉，改成已核结论。上面列出的所有下游数字按 8,355,840 重算。

### P1-2 B1 场景 M / M′ 的 `num_tokens_across_dp` 和空闲组的前向宽度写错了

- **位置**：`01:491`（`[6048, 28]`，同上）、`01:502`（「只是输入是 4 个占位 token」）、`01:503`（`[6048, 4]`）
- **原结论**：两组都看到 `[6048, 28]`；M′ 里 DP1 用 4 个占位 token 空跑，两组都看到 `[6048, 4]`。
- **源码证据**：
  - Ascend runner 先把本地 token 数补到自己的图尺寸，然后才同步：`_determine_batch_execution_and_padding` 先 dispatch，再调 `_sync_metadata_across_dp(num_tokens=num_tokens_padded, allow_dp_padding=(本地 cudagraph_mode != NONE) or sp or oproj_tp or embedding_tp)`（`va:vllm_ascend/worker/model_runner_v1.py#L2966-L2983`）。
  - `allow_dp_padding` 为真时，返回 `[max]*dp_size`；为假时，返回各 rank 的真实值（`#L728-L740`）。图模式取两边的最小值（`#L730`）。回到本 rank 后，用补齐后的宽度重新 dispatch，并且只允许用同步后的图模式（`#L2986-L2996`）。
  - 空跑一步是 `_dummy_run(num_tokens=decode_token_per_req=4, uniform_decode=True)`（`va:vllm_ascend/worker/worker.py#L972-L973`）。它走的是同一个函数，并且当 `num_tokens_padded != num_tokens` 时把 `num_tokens_across_dp[:]` 改成补齐后的宽度（`model_runner_v1.py#L3410-L3450`）。
- **正确结论**：
  - M：DP1 的 28 个 token 先在本地补到 32（FULL 图）。DP0 本地是 NONE，看到的是 `[6048, 32]`。DP1 本地是 FULL，看到的是 `[6048, 6048]`，图模式被 min 压成 NONE，于是 **DP1 这一步以 6048 宽度 eager 前向**。
  - M′：DP0 看到 `[6048, 4]`；DP1 看到 `[6048, 6048]`，dummy 批次同样被补到 6048 宽，eager 执行。
  - 两组的 `max_tokens_across_dp` 与 `padded_num_tokens` 仍然都是 6048，这一行原文是对的。
  - 这与 02 的结论一致（`02:813`「DP1 的 dummy 批次照样被补到 6,048 行」），也与 03 一致（`03:465-481`、`03:518-522`）。
- **建议改法**：表格按 DP0 / DP1 分列写不同的 `num_tokens_across_dp`，新增一行「实际前向宽度」：DP0 6048 eager，DP1 6048 eager（补齐）。「输入是 4 个占位 token」改成「本地 4 个占位 token，DP 补齐后以 6048 宽度 eager 执行」。前提是 `enable_flashcomm1` 等开关保持默认，这一点沿用 03 待核 1，写明即可。

### P1-3 待核 5：「实际分配的 MambaSpec 用的 conv 长度是 3」是错的

- **位置**：`01:211`
- **原结论**：每层的 `get_state_shape` 调 vLLM 的 `MambaStateShapeCalculator.kda_state_shape`，conv 长度是 3；分块用的是 6，实际分配用的是 3，两处不一致。
- **源码证据**：
  - decoder 层实例化的是 vLLM 的 `KimiGatedDeltaNetAttention`（`va:vllm_ascend/models/glm5_next.py#L40-L42`、`#L2080-L2085`）。它是 `PluggableLayer`（`v:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L84-L85`、`v:vllm/model_executor/layers/mamba/gdn/base.py#L22`）。
  - `PluggableLayer.__new__` 会按类名查 OOT 注册表并替换成注册的类（`v:vllm/model_executor/custom_op.py#L47-L66`、`#L332-L337`）。vllm-ascend 在 vLLM 0.23.0 下注册了 `REGISTERED_ASCEND_OPS["KimiGatedDeltaNetAttention"] = AscendKimiGatedDeltaNetAttention`（`va:vllm_ascend/utils.py#L763-L768`、`#L820`）。
  - `AscendKimiGatedDeltaNetAttention.get_state_shape` 用的是 `kimi_kda_state_shape(..., self.num_spec)`（`va:vllm_ascend/ops/kimi_kda.py#L235-L242`），所以长度 = 4 − 1 + 3 = **6**。
  - `glm5_next.py#L1698-L1705` 那个用 vLLM 计算器的 `get_state_shape` 属于 `AscendGlm5NextLinearAttention`（`#L1541`），而这个类在整个仓库里只有定义，没有被实例化过（`git grep` 只命中定义那一行）。
- **建议改法**：把待核 5 改成已核结论：「分块与实际分配都是 conv `[3072, 6]` BF16 = 36,864 B，两处一致」，删掉 `[!]`。

### P1-4 A0.5 算例：30 GiB ÷ 8,314,880 = 3,874，不是 3,873

- **位置**：`01:188`
- **原结论**：`num_blocks = 30 × 2^30 / 8,314,880 ≈ 3,873 块`
- **证据**：`32,212,254,720 / 8,314,880 = 3,874.05`，向下取整是 3,874（算式本身在 `va:vllm_ascend/patch/platform/patch_kv_cache_utils.py#L670-L673` 用的是 `//`）。
- **建议改法**：这条会被 P1-1 覆盖。按 8,355,840 重算，结果是 **3,855**。

### P1-5 B2 满载门槛：32 条都在 decode 时，新请求根本进不了队

- **位置**：`01:552-554`
- **原结论**：「在 32 条请求都在 decode 的满载情形下，阈值是 8192 − 128 = 8064 token」
- **源码证据**：waiting 循环第一步就判断 `if len(self.running) == self.max_num_running_reqs: break`（`v:vllm/v1/core/sched/scheduler.py#L566-L568`）。running 已经有 32 条时，新请求这一步不会被调度，也就谈不上切块。
- **建议改法**：改成「并发上限是 32。能让新请求进队的最大 running 数是 31，这时门槛是 `8192 − 31×4 = 8068` token；running 满 32 条时新请求只能排队等」。

### P1-6 B3 被抢占的请求释放的块数前后矛盾

- **位置**：`01:641`
- **原结论**：「一次释放它的 108 块 ≈ 856 MiB，够其余请求再跑 108 × 640 = 69,120 个 token」
- **证据**：108 块是 32 条请求刚到 60,000 token 时每条的持有量（`01:633`）。原文接着说，这 417 块要等每条再跑约 8,340 token 才会耗尽（`01:637`）。到抢占发生时，被踢的那条已经涨到 `ceil(68,343/640) + 14 = 107 + 14 = 121` 块。按原 bytes/块算是 959 MiB，按 P1-1 修正后是 964 MiB。它释放的 14 块 KDA/状态块也回到同一个空闲池，所以能腾出来的历史是 `121 × 640 = 77,440` token。
- **建议改法**：把 108 改成「约 121」，相应的 MiB 和 token 数一起更新。

---

## P2

### P2-1 indexer 一块只存 160 个压缩位，引用的行不支持这个结论

- **位置**：`01:163`
- **原结论**：出处写的是 `vllm_ascend/core/kv_cache_interface.py#L276-L286`
- **证据**：这几行是 `AscendMLAAttentionSpec.max_memory_usage_bytes`，里面没有「每块 160 位」的算式。GLM 的 indexer 用的是**上游** `MLAAttentionSpec`（`va:vllm_ascend/models/glm5_next.py#L85`、`#L295-L304`）。它的 `storage_block_size = block_size // compress_ratio`，页大小 = `storage_block_size × num_kv_heads × head_size × dtype`（`v:vllm/v1/kv_cache_interface.py#L365-L384`）。`va:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L169-L176` 的注释也说明了 GLM-5 的压缩 indexer 用的是上游 spec。
- **建议改法**：把引用换成 `v:vllm/v1/kv_cache_interface.py#L365-L384`。

### P2-2 待核 2：「KDA q/k/v 是 `quant_config=None`」引用的是一个死类

- **位置**：`01:208`
- **原结论**：「KDA 的 q/k/v 在源码里 `quant_config=None`，见 `glm5_next.py#L1576-L1597`」
- **证据**：这几行属于 `AscendGlm5NextLinearAttention`，它从未被实例化（见 P1-3）。真正实例化的 KDA 层继承上游 `KimiGatedDeltaNetAttention`，它的 q/k/v 传的是 `quant_config=self.quant_config`（`v:vllm/model_executor/layers/mamba/gdn/kimi_gdn_linear_attn.py#L120-L140`）。所以 KDA 投影层是否量化，要看 W8A8 描述文件，不能从这里下结论。
- **建议改法**：删掉这个引用，改成「是否量化取决于 `quant_model_description`，与 02 待核 1 合并」。

### P2-3 B1 每一步的 DP 对齐走错了代码路径

- **位置**：`01:478-479`、`01:515`（待核 3）
- **原结论**：`coordinate_batch_across_dp → _run_ar`，all-reduce 一个 4×dp_size 的张量；待核里写的是 `disable_nccl_for_dp_synchronization`。
- **证据**：本部署用 v1 NPU runner（`01:369-370` 自己也这么写了），它走的是 `NPUModelRunner._sync_metadata_across_dp`：all-reduce 一个 **2×dp_size** 的张量，内容是 `[num_tokens, cudagraph_mode]`。默认走 CPU 组，只有 `ascend_config.dp_allreduce_on_npu` 为真时才走 NPU 组（`va:vllm_ascend/worker/model_runner_v1.py#L692-L740`）。vLLM 的 `dp_utils` 和 `disable_nccl_for_dp_synchronization` 在这条路径上用不到。
- **建议改法**：把引用换成上面这几行，写清「token 数取 max（只对本地图模式非 NONE 的 rank 生效）、图模式取 min」。待核 3 改成「已核：由 `dp_allreduce_on_npu` 决定」。

### P2-4 跨文档：每卡权重总量与分项都和 02 不一致，两边都没算 MTP 层

- **位置**：`01:101-110`、`01:186`；对照 `02:91-104`
- **原结论**：01 写「≈19–20 GiB，93% 是专家」，算例用 19.4 GiB；KDA 544 MiB，MLA 约 253 MiB（每层约 23 MiB，没给算式）。02 写合计 20.26 GiB，KDA 1.149 GiB，MLA 618.8 MiB，另外列了 router 189 MiB、mHC 135 MiB。
- **证据**：两份按不同的 dtype 假设算（01 全按 1 B，02 注意力按 BF16），都是 `[D]`，都依赖 W8A8 描述文件（02 待核 1）。两边都没算 MTP 层：它的 MoE 在每卡上也有 18 个专家，约 432 MiB，再加上 MLA 和 eh_proj（`va:vllm_ascend/models/glm5_next_mtp.py#L39-L92`）。
- **建议改法**：权重账只在 02 §1.3 算一次（单一真相源），补上 MTP 层。01 的 A0.3 只引用 02 的合计，A0.5 算例改用这个合计。「23 MiB/层」要么补算式，要么删掉。

### P2-5 跨文档：02 把 block_size 写成 128

- **位置**：`02:429`、`02:483`、`02:865`（01 这边是 `01:24`、`01:396`）
- **02 的结论**：`block_size = 128`，「vLLM 把 cache_config.block_size 对齐到 128」。
- **证据**：`cache_config.block_size` 被 GLM 专用分支设成 640（`va:vllm_ascend/patch/platform/patch_mamba_config.py#L131-L139`、`#L153-L159`）。128 是 `GLM5_KERNEL_BLOCK_SIZE`（`#L11`），也就是 worker 侧 SFA kernel 的块大小：1 个逻辑块 = 5 个 kernel 块。indexer 每个 kernel 块 32 个压缩位，每个逻辑块 160 个。
- **建议改法**：02 改成「逻辑块 640（调度器、KV 池分配的单位），kernel 块 128（worker 的 block table 视图）」。01 的 A3 待核 2 直接给出这个换算，不要再写「没有展开」。

### P2-6 跨文档：02 算每 token KV 字节时漏掉了 MTP 层

- **位置**：`02:114`、`02:434-435`（01 自己没写每 token 数，只写了每块数）
- **02 的结论**：`11 × (1024 + 64) = 11,968 B/token`，满长请求 1.484 GiB。
- **证据**：同 P1-1，MTP 第 45 层也在池里，所以是 `12 × 1,088 = 13,056 B/token`；物理上一个 block id 的开销是 `8,355,840 / 640` = 13,056 B/token，两者相等。满长请求光历史就是 `208 块 = 1.619 GiB`，加上 KDA 与状态的 14 块是 1.728 GiB。
- **建议改法**：02 两处都改成 12 层；主模型 11 层的 11,968 可以保留作分项。01 在 A0.5 补一行「折合 13,056 B/token」。

### P2-7 跨文档：02 算每请求 KDA 状态时漏了 3 个投机块

- **位置**：`02:116`、`02:265-267`（01：`01:27`、`01:315`）
- **02 的结论**：`34 × 561,152 = 18.2 MiB/请求`，32 个请求约 582 MiB。
- **证据**：`mamba_cache_mode = "none"` 时，`MambaManager` 给每组多分 `num_speculative_blocks = 3` 块，所以每组每请求 4 块（`v:vllm/v1/core/single_type_kv_cache_manager.py#L1073-L1087`、`v:vllm/model_executor/layers/mamba/abstract.py#L55-L59`）。每个 KDA 层每请求有 4 份页：原始字节 `4 × 34 × 561,152 = 72.8 MiB`，填充后 85 MiB；在池里占 12 个 block id，约 95.6 MiB。
- **建议改法**：以 01 的「12 个 block id」为准。02 的 18.2 MiB 改成「单份状态」，另外补上「每请求 4 份 / 12 个 block id」。

### P2-8 MLA `fused_qkv_a_proj` 的 disable_tp 引用行号偏了

- **位置**：`01:95`
- **原结论**：`#L1924-L1933`
- **证据**：`fused_qkv_a_proj` 在 `va:vllm_ascend/models/glm5_next.py#L1918-L1925`（`disable_tp=True` 在第 1923 行）；`#L1927-L1933` 是 `q_b_proj`。
- **建议改法**：改成 `#L1918-L1925`。

---

## P3

1. **`01:169`、`01:180` 行号小偏差**：公式实际在 `patch_kv_cache_utils.py#L666-L673`，`shared_by` 在 `#L674-L697`。结论不变。
2. **`01:290-291` 漏了 Ascend 替换类**：`MambaManager` 被 `AscendMambaManager` 替换了（`va:vllm_ascend/patch/platform/patch_mamba_manager.py#L20-L84`，由 `va:vllm_ascend/patch/platform/__init__.py#L43` 导入）。它只在外部 KV 的情况下多加 1 块，本部署下结果仍是 4 块/组，但引用要补上。
3. **`01:473` 变量名**：`execute_dummy_batch` 传的是 `decode_token_per_req`（`va:vllm_ascend/worker/model_runner_v1.py#L652-L656`、`va:vllm_ascend/worker/worker.py#L973`），不是 `uniform_decode_query_len`。两者的值都是 4。
4. **`01:57` 实现类**：官方 config 的 `architectures` 是 `Glm5NextForConditionalGeneration`，注册到的是 `glm5_next_multimodal:AscendGlm5NextForConditionalGeneration`（`va:vllm_ascend/models/__init__.py#L15-L16`）。它把 mamba 形状委托给 `AscendGlm5NextForCausalLM`（`va:vllm_ascend/models/glm5_next_multimodal.py#L643-L657`），所以数字不变；但视觉塔会不会加载、占多少权重，要看 w8a8 仓库的 config，建议写进待核。
5. **`block_size` 一词多义**：EngineCore 在 KV 初始化后把 `cache_config.block_size` 改成各组最小值 = 4（`v:vllm/v1/engine/core.py#L279-L285`），调度器用的是 lcm = 133120（`#L145-L156`）。建议在 §0 列一行「block_size 的五种含义」：cache/full 组 640、kernel 128、indexer-state 4、mamba 133120、调度器 lcm 133120。
6. **初学者可读性**：A0「做了什么」（`01:39`）里有 `--headless`、worker、profile、decode 图、专家并行域；A1（`01:220`）里有聊天模板、`EngineCoreRequest`、ZMQ；A3（`01:353`）里有共享内存广播、KV slot、attention 状态。这些术语都没有一句白话解释，建议每个补一句。
7. **拿「没展开」代替答案**：A0 待核 4（MTP 的 KV 没核，直接导致 P1-1）、A3 待核 2（640 与 128 的换算，源码里有答案）、B1 待核 2（`_dummy_run` 是否跑 MoE、宽度多少，答案在 `model_runner_v1.py#L3410-L3450`，03 已经查到）。这三条应该改成已核结论。
8. **`01:385` 引用不精确**：「不会走 decode 图」引的是 `with_prefill`（`#L853-L857`），但真正决定走不走图的是 `uniform_decode`（`va:vllm_ascend/worker/model_runner_v1.py#L2924-L2941`）。结论对，引用要换。
9. **`01:241-243`、`01:248` 引用不完整**：DP 引擎的入口是 `DPEngineCoreProc._handle_client_request`（`v:vllm/v1/engine/core.py#L1836-L1855`）和 `DPEngineCoreProc.add_request`（`#L1789`），原文漏了。`#L1347-L1349` 只设置了 `current_wave` 和 `client_index`，不支持列出来的整张字段表。另外，B2 待核 2 列举调度器变体时漏了 `patch_balance_schedule`：它在全局替换了 Scheduler，关闭时回落到 `super().schedule()`（`va:vllm_ascend/patch/platform/patch_balance_schedule.py#L84-L88`、`#L718`）。

---

## 跨文档一致性最终判定

| 量 | 正确值（以源码为准） | 出处 | 01 | 02 | 03 |
|---|---|---|---|---|---|
| 块大小 | 逻辑块（`cache_config.block_size`，也是 full 组和 KDA 页配对的单位）= **640**；SFA kernel 块 = **128**，1 个逻辑块 = 5 个 kernel 块；indexer 每逻辑块 160 个压缩位（每 kernel 块 32 个）；indexer-state 组 4；mamba 组 133120；调度器 lcm 133120 | `va:patch_mamba_config.py#L11`、`#L131-L159`；`va:patch_kv_cache_utils.py#L357-L378`；`v:kv_cache_interface.py#L365-L384` | 对（A3 待核 2 应补换算） | **需改**（`02:429`、`483`、`865` 写成 block_size=128） | 未涉及 |
| 每 token KV 字节 | 主模型 11 层 × 1,088 = 11,968 B；**加上 MTP 第 45 层 = 12 × 1,088 = 13,056 B/token**；每个 block id = **8,355,840 B**（= 13,056 × 640） | `va:llm_base_proposer.py#L405-L456`；`va:glm5_next_mtp.py#L84-L92`；`va:patch_kv_cache_utils.py#L279-L329`、`#L666-L669` | **需改**（8,314,880） | **需改**（11,968、1.484 GiB） | 未涉及 |
| KDA 状态大小 | 每层每份：conv `[3072,6]` BF16 36,864 B + recurrent `[8,128,128]` FP32 524,288 B = **561,152 B**，填充到 655,360 B；每请求每组 **4 块**（1 + 3 投机），3 组共 **12 个 block id**，与长度无关 | `va:kimi_kda_state.py#L9-L32`；`va:patch_mamba_config.py#L92-L101`；`v:single_type_kv_cache_manager.py#L1073-L1087` | 正文对 | **需改**（18.2 MiB/请求只算了 1 份） | 未涉及 |
| conv 状态长度 | **6**（分块和实际分配都是 6） | `va:ops/kimi_kda.py#L235-L242`；`va:utils.py#L763-L768`；`v:custom_op.py#L47-L66` | **需改**（待核 5 写成实际分配用 3） | 对（`02:259`） | 未涉及 |
| decode 每请求 token 数 | **4**（1 + 3） | `v:gpu_model_runner.py#L814`；`va:model_runner_v1.py#L652-L656` | 对 | 对 | 对 |
| 图尺寸 | **4/8/16/32/64/96/128**，对应 1/2/4/8/16/24/32 个请求 | 计划 §3 `[S]` + `[D]` | 对 | 对 | 对 |
| DP padding 规则 | 同步前各 rank 先把本地 token 数补到自己的图尺寸；**token 数取两边最大值**，但只在本地图模式非 NONE（或 sp / oproj_tp / embedding_tp 开）的 rank 上生效，其他 rank 保留真实值；**图模式取最小值**；MoE 的 `padded_num_tokens = ceil(max/8)×8` | `va:model_runner_v1.py#L720-L740`、`#L2966-L2996`；`va:ascend_forward_context.py#L97-L98`、`#L164-L185` | **需改**（`[6048,28]`、`[6048,4]`，路径引成 vLLM 的 `_run_ar`） | 对（`02:581`、`592`、`813`） | 对（`03:452-522`） |
| MC2 容量与选择规则 | 容量 = `min(ceil(128/8), 512) × 8` = **128**（`enable_prefill_mc2` 关、有捕获尺寸时用最大捕获尺寸）；A2 上三个条件同时满足才走 MC2：每卡专家数 ≤ 24、EP ≥ 16、DP 最大 token 数 ≤ 容量；否则走 ALLGATHER。A2 上没有 ALLTOALL 分支 | `va:ascend_forward_context.py#L202-L217`、`#L240-L252`、`#L97-L98` | 未涉及（只写了 MC2 组的构成，没问题） | 对 | 未涉及 |
| EP 规模与每卡专家数 | **EP16，每卡 18 个**（288/16） | `v:parallel_state.py#L1850-L1875`；`va:distributed/parallel_state.py#L84-L96`；`va:ascend_forward_context.py#L245-L249` | 对 | 对 | 未涉及 |

---

## 附：本轮核过的引用（共 46 组，80 多处行号）

结论成立、行号对的：
- `v:parallel_state.py`：#L1535-1560、#L1545-1551、#L1758-1768、#L1833-1848、#L1850-1875
- `va:distributed/parallel_state.py#L84-96`
- `v:engine/utils.py`：#L1049、#L1092、#L1172
- `v:cli/serve.py#L173-245`
- `v:core.py`：#L236、#L341、#L443、#L819、#L1336-1350、#L1701、#L1750-1764、#L1856-1867、#L1869-1926、#L1928-1945
- `v:multiproc_executor.py`：#L110-121、#L151-157、#L176、#L247-260、#L307-318、#L331-332
- `va:worker.py`：#L469、#L505-525、#L590、#L693-784、#L972-973、#L975-988
- `va:platform.py`：#L190-200、#L662
- `va:utils.py#L1396-1432`
- `v:cache.py`：#L46-48、#L232-244
- `va:patch_mamba_config.py`：#L59-228 全段
- `v:config/vllm.py#L1902-1903`
- `va:kimi_kda_state.py#L8-36`
- `v:model.py`：#L1284-1288、#L1758-1759、#L1805-1810、#L1851-1857
- `v:models/config.py#L386-394`
- `v:arg_utils.py`：#L2373-2378、#L2404-2405
- `va:patch_kv_cache_utils.py`：#L332-410、#L459-514、#L517-548、#L647-698
- `va:indexer_kpool_mla.py`：#L69-77、#L121-137
- `va:glm5_next.py`：#L1255-1257、#L1284-1291、#L1298-1304、#L1306-1313、#L352-363、#L2437
- `v:gpu_model_runner.py#L814`
- `v:core_client.py`：#L1344-1357、#L1394-1396、#L1398-1426
- `v:async_llm.py`：#L280、#L349-360、#L409、#L412、#L637
- `v:coordinator.py`：#L149-157、#L257-262、#L395-405
- `v:scheduler.py`：#L104-109、#L212-221、#L259-263、#L340、#L403-416、#L459-509、#L563-568、#L611-613、#L684-700、#L761-781、#L826、#L974-995、#L1329、#L1695、#L1797、#L1801、#L1888-1910
- `v:kv_cache_manager.py`：#L212-213、#L238、#L370-373、#L385-398、#L438-446
- `v:single_type_kv_cache_manager.py`：#L101-140、#L955、#L1054-1120、#L1063-1072
- `v:block_pool.py`：#L333、#L419
- `v:speculative.py`：#L550-554、#L1070-1071
- `v:parallel.py#L683-707`
- `va:ascend_forward_context.py#L165-190`
- `va:model_runner_v1.py`：#L748、#L814、#L837、#L839、#L853-857、#L863-868、#L951、#L957-962、#L1917、#L2936
- `va:patch_use_v2_model_runner.py#L1-21`
- `v:output_processor.py`：#L576、#L636-651
- `v:detokenizer.py`：#L30、#L167
- `v:chat_completion/serving.py#L399`

有问题的：
- 引用的行不支持结论：`va:core/kv_cache_interface.py#L276-286`（P2-1）、`va:glm5_next.py#L1576-1597`（P2-2）、`v:dp_utils.py#L36-110`（P2-3）
- 行号偏：`va:glm5_next.py#L1924-1933`（P2-8）
- 结论被 OOT 替换推翻：`v:mamba_utils.py#L237-260` 加 `v:abstract.py#L44-61` 推出的「实际分配用 3」（P1-3）

## 被跳过的内容

- 按约束没读的：HANDBOOK、官方教程 `GLM5.3-Flash.md`、`wiki/concepts/glm-5-3-flash-two-node.md`。因此 01 中标 `[S]` 教程的条目没有核：`api-server-count 1`、`enforce_eager`、node0 是否带 `--data-parallel-start-rank`、是否设了 `enable_flashcomm1` / `dp_allreduce_on_npu` / `enable_balance_scheduling`。
- 没有命令被拦截。
- 02、03 只按任务要求 grep 了指定的几个量，没有通读，也没有审 02、03 自身其他段落。
- `v:chat_completion/api_router.py`、`v:render/serving.py` 这两处入口引用没逐行打开，不在关键数字链上。
