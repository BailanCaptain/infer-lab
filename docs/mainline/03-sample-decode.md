# 主线底稿 03：采样、MTP 草拟、decode 步（A5 / A6 / B4）

本文件是底稿，不是读者页。读者页里的数字一律引用这里。前提（部署、模型维度、源码版本、示例请求）全部来自
`docs/plans/2026-09-27-mainline-rebuild.md` §3，不在本文件重新定义。

- 控制流：`vllm@0fc695fc`（`tools/repos/vllm`，工作树可直接读）。
- 执行侧：`vllm-ascend@db701c1f`（孤立提交，用 `git -C tools/repos/vllm-ascend show db701c1f:<path>` 读）。
- `main`（`baa023ad`，布局已改成 `vllm_ascend/models/glm5next/`）只在关键差异处单独标注。
- 结论标记沿用主仓 `PLAN.md` §1.4：`[S]` 官方文档/论文直接支持、`[C]` 固定 commit 源码行为、`[D]` 由公式/shape/规则推导。
- 源码引用格式：`repo@commit:path#Lx-Ly`。

## 0. 本篇反复要用的固定量

| 量 | 值 | 来源 |
|---|---|---|
| 每轮草拟 token 数 `num_speculative_tokens` | 3 | 计划 §3 `[S]` |
| 草拟方法 `method` | `deepseek_mtp` → 归一化成 `"mtp"` | `[C]` `vllm@0fc695fc:vllm/config/speculative.py#L550-L554`（`deepseek_mtp` 在 `MTPModelTypes` 里且不等于 `"mtp"`，打 deprecated 日志后改名）；草稿 `model_type` 由昇腾补丁改写成 `glm5_next_mtp` 并加进 `MTPModelTypes`：`vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_speculative_config.py#L120-L128`、`#L148-L152` |
| decode 每请求每步的 query 长度 `uniform_decode_query_len` | 1 + 3 = **4** | `[C]` `vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L814` |
| 图模式 | `FULL_DECODE_ONLY` = (FULL, NONE) | `[C]` `vllm@0fc695fc:vllm/config/compilation.py#L59-L69` |
| 捕获尺寸 | 4 / 8 / 16 / 32 / 64 / 96 / 128 | 计划 §3 `[S]` |
| `max_num_seqs` / `max_num_batched_tokens` | 32 / 8192 | 计划 §3 `[S]` |
| TP / DP / EP | 8 / 2 / 16 | 计划 §3 `[S]` |
| 词表 / hidden / 主干层数 | 154880 / 4096 / 45 | 计划 §3 `[S]` |
| MTP 层数 `num_nextn_predict_layers` | 1（层号 45） | `[C]` `vllm-ascend@db701c1f:vllm_ascend/transformers_utils/configs/glm5_next.py#L52`、`vllm_ascend/models/glm5_next_mtp.py#L131-L142` |

本部署没有 `--additional-config`，所以下面这些昇腾开关都是关的，分支按「关」的那条走：
`enable_reduce_sample=False`、`lmhead_tensor_parallel_size=0`、`enable_flashcomm1=0`（即 `enable_sp()` 为假）、
`rejection_sampler_config.enable_block_verify=False`、`enable_entropy_verify=False` `[C]`
（`vllm-ascend@db701c1f:vllm_ascend/ascend_config.py#L320`、`#L511-L512`、`#L778-L781`，
`vllm_ascend/envs.py#L75`，`vllm_ascend/utils.py#L905-L931`）。

---

## A5 采样与 MTP 草拟

### 做了什么

一步前向算完之后，每张卡手里是一排隐藏状态。这一站做两件事：先把要出 token 的那几行隐藏状态变成 logits
（logits = 词表里每个词的打分，这个模型是 154880 个分数），按采样参数从中挑出真正的下一个 token；
再用同一批隐藏状态，让那一层 MTP 连跑三遍，猜出后面 3 个 token，交给下一步去验。
猜 token 的那三遍不用预先录好的计算图，每次都现场一个算子一个算子地下发（这就是「eager」）。

### 怎么走的

**（1）挑出要出 token 的行 → lm_head → logits**

1. `execute_model` 在前向之后按 `logits_indices` 取行，然后调 `compute_logits`：
   `[C]` `vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L4315-L4316`。
   `logits_indices` 由 `_calc_spec_decode_metadata` 算出（上一站 `_prepare_inputs` 调它）：没有草稿时每请求 1 行
   （最后一个 token 的位置），有草稿时每请求 `num_draft + 1` 行
   `[C]` `vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L2730-L2809`
   （昇腾侧同名函数在 `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L1492-L1578`，注释与算法一致，
   多一个 `num_pcp_pads` 参数）。
2. `lm_head` 是 `VocabParallelEmbedding`，按词表维切 8 份；算完本地 logits 后 `_gather_logits` 在 TP 组内 all-gather，
   每张卡都拿到完整词表的 logits `[C]`
   `vllm@0fc695fc:vllm/model_executor/layers/logits_processor.py#L75-L87`；昇腾平台没有覆写 `use_all_gather`，
   走的是默认的 `True` 分支 `[C]` `vllm@0fc695fc:vllm/platforms/interface.py#L858-L862`。
3. 结果存进 `ExecuteModelState`，真正采样发生在下一个调用 `sample_tokens` 里
   `[C]` `vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L4346-L4420`、
   `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2373-L2427`。

**（2）采样：没有草稿时走 Sampler，有草稿时走 RejectionSampler**

4. `_sample` 分流：`spec_decode_metadata is None` → `self.sampler(...)`；否则 → `self.rejection_sampler(...)`，
   并且昇腾侧把 `draft_probs` 这一参数直接写死成 `None`
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2585-L2610`
   。`draft_probs` 取不到有两个原因：一是昇腾整体覆写了 `_sample`，上游那套「先查 `_draft_probs`」的逻辑
   （`vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L3531-L3560`、`#L5067-L5071`）根本不执行；
   二是昇腾草拟走自己的 `_run_merged_draft`，只做 argmax，从不写 `_last_draft_probs`
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1173-L1454`。
   方法本身是继承来的：`AscendSpecDecodeBaseProposer` 继承 `SpecDecodeBaseProposer`，`take_last_draft_probs`
   在基类里（`vllm@0fc695fc:vllm/v1/spec_decode/llm_base_proposer.py#L432-L433`），只是永远返回 `None`。
5. `Sampler.forward` 的顺序：fp32 化 → logits processors（含 penalties、bad words、min-tokens）→ `sample()`
   `[C]` `vllm@0fc695fc:vllm/v1/sample/sampler.py#L72-L150`。
   `sample()` 里：temperature < 1e-5 的请求走 `greedy_sample`（argmax）；其余先除 temperature，再做 top-k/top-p，
   最后按概率抽样；同一个 batch 里两种请求都有时用 `torch.where` 合并
   `[C]` `vllm@0fc695fc:vllm/v1/sample/sampler.py#L243-L302`。
6. 昇腾把 top-k/top-p 和抽样换成了 NPU 算子：A2/A3 上 `apply_top_k_top_p` 绑定到 `torch_npu.npu_top_k_top_p`；
   抽样用指数分布变换 `probs.div_(q).argmax(-1)`（`q ~ Exp(1)`）代替 `torch.multinomial`，避开一次 CPU-NPU 同步
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/sample/sampler.py#L20-L43`、`#L269-L302`。

**（3）MTP 层长什么样**

7. MTP 权重是独立的一份 `AscendGlm5NextMTP`，内部只有一层 `AscendGlm5NextMultiTokenPredictorLayer`，层号取
   `num_hidden_layers`，即 45 `[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L127-L142`。
8. 这一层的 forward：把 `positions == 0` 的那些 token（每条序列的第 0 个位置，不是 batch 的第一行）的输入嵌入清零
   → `enorm(嵌入)`、`hnorm(主模型隐藏态)` → 两者 concat 成 `[N, 8192]`
   → `eh_proj` 压回 `[N, 4096]` → 过一个完整 decoder 层 `mtp_block` → TP all-reduce → `shared_head`
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L94-L124`、`#L108-L111`。
9. `mtp_block` 是 `AscendGlm5NextDecoderLayer(..., is_mtp_layer=True)`：
   - 走的是不带四路残差的普通 pre-norm 分支（`mhc` 只对主干层生效）
     `[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2132`、`#L2195-L2209`；
   - 注意力类型由 `_is_kda_layer(config, 45)` 决定。`layer_types` 只有 `num_hidden_layers` = 45 项（下标 0–44），
     45 越界 → 返回 False → 走稀疏 MLA `[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L216-L228`、
     `vllm_ascend/models/glm5_next_mtp.py#L64-L77`（构造时强制要求 `index_topk`，只有稀疏 MLA 才用得上）；
   - MLP 类型取 `mlp_layer_types[-1]` = `"sparse"` → 这一层也是 MoE
     `[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L2107-L2115`。
10. 嵌入表与主模型共享（MTP 分支 `share_embeddings = not self.use_compress`，本模型没有 `compress_ratios`）
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L537-L550`。
    `lm_head` 同样与主模型共享：共享分支的条件是 `model_config.is_deepseek_mla` 为真，
    昇腾插件给 `glm5_next` / `glm5_next_text` 注册了专用 convertor，它的 `is_deepseek_mla()` 只看
    `kv_lora_rank is not None`（本模型 512），补丁无条件导入
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_glm5_next_config.py#L14-L20`、`#L29-L30`、
    `vllm_ascend/patch/platform/__init__.py#L44`、
    `vllm@0fc695fc:vllm/config/model.py#L754-L757`（按 `model_type` 取 convertor）。
    于是 `layer_module.shared_head.head = target_language_model.lm_head` 这一行成立
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L589-L596`。
    旁证：checkpoint 第 45 层只有 `shared_head.norm.weight`，没有 `shared_head.head.weight`，
    全模型只有一份 `lm_head.weight`；而 MTP 的 `load_weights` 会跳过所有非第 45 层的权重
    `[C]` `glm-flow/reference/checkpoint-shapes.json`（HF sha 690b7052）、
    `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L286-L290`。

**（4）一层跑三遍：三步草拟**

11. 入口在 `sample_tokens` 里的 `propose_draft_token_ids` 闭包，因为 `use_eagle()` 为真（`"mtp"` 在名单里），
    草拟吃的是 NPU 上的 `sampler_output.sampled_token_ids`，不是 CPU 侧的 `valid_sampled_token_ids`
    `[C]` `vllm@0fc695fc:vllm/config/speculative.py#L1070-L1071`、
    `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2438-L2460`、`#L2473-L2486`、`#L1631-L1884`。
    调用顺序上，昇腾是先 `_bookkeeping_sync`（`#L2462`）再草拟；上游相反，草拟在 bookkeeping 之前
    `[C]` `vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L4442-L4483`。
12. 第一步的输入由 `set_inputs_first_pass` 拼出来：把本步的 token 序列整体左移一格，再把每个请求最后一个有效位置
    换成刚采出来的 token；positions 和主模型的一样，hidden 直接用主模型这一步的输出
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1456-L1519`。
13. 有草稿要验的时候，喂给草拟的批次形状和主模型一模一样（被拒的位置留着当 padding），每个请求真正取哪一行由
    `token_indices_to_sample = query_start_loc[i+1] - 1 - num_rejected` 决定
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L2015-L2067`。
14. `_run_merged_draft` 跑第 0 步，然后 `for draft_index in range(num_speculative_tokens - 1)` 再跑 2 步；
    每步都是：`input_ids ← 上一步草稿`、`positions += 1`、`hidden_states ← 上一步输出`，再调同一个 `self.model`
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1173-L1454`。
    三步用的是同一层权重：`spec_step_idx % num_mtp_layers = spec_step_idx % 1 = 0`
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L165-L166`、`#L180-L183`；
    上游在配置解析阶段就为这种用法打了日志：`num_speculative_tokens > 1` 会「在同一个 MTP 层上跑多次前向」
    `[C]` `vllm@0fc695fc:vllm/config/speculative.py#L717-L727`。
15. 每步草稿 token 的选法固定是贪心 argmax，与请求自己的 temperature / top-p 无关
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1290-L1299`、`#L1442-L1446`
    （`enable_reduce_sample` 打开时走 `compute_draft_token_ids` → `greedy_sample`，同样是贪心，
    `#L1158-L1171`）。三步结果堆成 `[num_spec, B]`，最后转置成 `[B, 3]`
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1320-L1454`。
16. 序列快到 `max_model_len`（133120）时，昇腾侧靠两处收口，不走上游那条「整批清零」：
    - 草拟循环里把 `positions >= max_model_len` 的位置钳成 0，注释写明这些位置产生的草稿要作废
      `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1350-L1365`；
    - 调度器把 `num_new_tokens` 截到 `max_model_len − 1 − num_computed_tokens`，于是这一步能进模型的
      token 自然少于 4 `[C]` `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L412-L416`。

    上游对照：`GPUModelRunner.sample_tokens` 里有 `_input_fits_in_drafter`（`max_seq_len + 3 <=
    effective_drafter_max_model_len`），不成立就把草稿整批清零
    `[C]` `vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L4368-L4381`、`#L4462-L4463`、`#L4522-L4533`、`#L622-L630`。
    这段在本部署下不执行：昇腾 `NPUModelRunner.sample_tokens` 整体覆写了它，覆写版里没有这个判断
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2373-L2486`。

**（5）为什么草拟单独走 eager**

17. proposer 初始化时先按用户配置算 `use_cuda_graph = runner._use_aclgraph() and not speculative_config.enforce_eager`
    （`#L217`），然后有一条针对 GLM 系列的硬性覆盖：只要目标模型的 `model_type` 里含 `glm`，就把 `use_cuda_graph`
    无条件置回 False（`#L227`、`#L236`）。那条「GLM 系列 + 投机解码暂不支持图模式，草拟已自动切回 eager」的警告
    **不是必打**：它包在 `if self.use_cuda_graph:` 里（`#L228-L235`），只有草稿原本要录图时才打印，即主模型开着
    图模式、且 `--speculative-config` 没写 `enforce_eager: true`。GLM 双机这一档按官方命令给草稿写了
    `enforce_eager: true`（01 底稿 L250），`#L217` 算出来就是 False，所以**不打这条警告**，草稿照样是 eager。
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L141-L149`、`#L217`、`#L227-L236`。
    （2026-10-02 按 speculative-decoding 审查 P2-1 修正：原写成无条件打印。）
18. 这条覆盖的直接后果：`_maybe_share_lm_head` 末尾那个「把草拟包进 `ACLGraphWrapper`」的分支要求
    `use_cuda_graph` 为真，于是不成立，`self._runnable` 保持为普通 Python 函数 `_run_merged_draft`
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L266`、`#L598-L613`。
19. 并且 `_propose` 里所有图相关的分支都走 else：`num_input_tokens = num_tokens`（不补到捕获尺寸）、
    `aclgraph_runtime_mode = CUDAGraphMode.NONE`、`batch_descriptor = None`
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L893-L916`。
    **但紧接着仍有一次 DP 对齐**：eager 分支设完 `num_input_tokens` 就无条件调
    `self.runner._sync_metadata_across_dp(num_input_tokens, is_draft_model=True)`，并把返回的第一个值
    （`max_tokens_across_dp`，永远是两组的最大值）重新赋回 `num_input_tokens`
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L899-L906`、
    `vllm_ascend/worker/model_runner_v1.py#L727-L740`。
    这次 all-reduce 不会被跳过，因为草稿模型自己也是 MoE，且不是 KV consumer
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/utils.py#L1278-L1288`。
    所以：草拟不补到捕获尺寸，但要补到 DP 组的最大值。
20. 教程里那句 `"enforce_eager": true` 与第 17 条的代码覆盖是同一个意思，两者都置上时结果一致 `[S]`+`[C]`。

### 本部署下的具体数字和算式

**lm_head 与 logits（每张卡）**

- 每卡词表切片：154880 ÷ 8 = **19360** 列 `[D]`。
- lm_head 本地矩阵：4096 × 19360 = 79,298,560 个数 `[D]`。
- R1 单独在跑时，一个 decode 步要出 logits 的行数 = 1 × (3 + 1) = **4** 行 `[D]`。
  - all-gather 前：每卡 `[4, 19360]`；all-gather 后：每卡 `[4, 154880]`。
  - bf16 下 all-gather 后的 logits = 4 × 154880 × 2 B = 1,239,040 B ≈ **1.18 MiB** `[D]`。
  - 拒绝采样里 3 个验证行要转 fp32：3 × 154880 × 4 B = 1,858,560 B ≈ **1.77 MiB** `[D]`。
- 满载 decode（32 个请求全在 decode）：32 × 4 = 128 行 → all-gather 后 `[128, 154880]`，
  bf16 = 128 × 154880 × 2 B ≈ **37.8 MiB** `[D]`。

**采样在哪张卡上做**

- 8 张卡每张都拿到完整 logits，8 张卡各自跑一遍同样的采样 `[C]`（见上面第 2、5 条）。
- 结果只从 TP rank 0 回传给 EngineCore：`output_rank = world_size − tp_size × pcp_size` = 8 − 8 × 1 = **0**
  `[C]` `vllm@0fc695fc:vllm/v1/executor/multiproc_executor.py#L495-L509`；采样结果走的是 `sample_tokens` 这条
  RPC（`#L319-L326`），`execute_model`（`#L307-L317`）只负责前向那一半。
- 8 份结果一致的依据是同一个种子：`NPUWorker` 初始化时 `set_random_seed(model_config.seed)`
  `[C]` `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L498-L499`
  （上游对照 `vllm@0fc695fc:vllm/v1/worker/gpu_worker.py#L305-L306`）。
  种子的具体取值待核：计划 §3 里没有 seed 这一项，要回到教程的启动脚本去核。

**MTP 那一层每卡占多少权重**

模型维度取自 `glm-flow/reference/official-config.json` 的 `text_config`：
`num_attention_heads = 64`、`qk_nope_head_dim = 256`、`qk_rope_head_dim = 0`、`v_head_dim = 256`、
`q_lora_rank = 1536`、`kv_lora_rank = 512`、索引器 `index_n_heads = 32` × `index_head_dim = 128` `[S]`。

| 项 | 形状（每卡） | 每卡字节 | 依据 |
|---|---|---|---|
| `eh_proj`（bf16，`nn.Linear`，不切 TP） | 4096 × 8192 | **64 MiB** | `[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L53-L57`；checkpoint 里是 BF16 `[4096, 8192]` |
| 路由专家 18 个（int8） | 18 × 3 × 4096 × 2048 | **432 MiB** | `[D]` 288 ÷ 16 = 18；每专家 25,165,824 参数 = 24 MiB |
| 共享专家 1 个（int8，按 TP8 切） | 3 × 4096 × 2048 ÷ 8 | **3 MiB** | `[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1462`、`#L1416-L1432`（`disable_tp=is_sequence_parallel`）；`use_sequence_parallel_moe` 为假，见下 |
| router gate（fp32，ReplicatedLinear 不切） | 288 × 4096 | **4.5 MiB** | `[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1480-L1487`、`vllm@0fc695fc:vllm/model_executor/layers/fused_moe/router/gate_linear.py#L14` |
| MLA 本体四个投影 | 见下 | **23.0 MiB** | `[D]` |
| 索引器（全 BF16） | 见下 | **14.25 MiB** | `[D]` |
| `enorm` / `hnorm` / `shared_head.norm` | 3 × 4096 | 24 KiB | `[D]` |
| `shared_head.head` | — | **0**（与主模型 lm_head 共用同一份权重） | `[C]` 见「怎么走的」第 10 条 |
| **合计** | | **540.75 MiB/卡**（上界 559.75） | 由 02 底稿 §7.5 定义，本页只引用 |

这个总数在 **02 底稿 §7.5** 里定义，本页不重复给区间。口径：**MLA 本体 23.0 + 索引器 14.25 = 37.25 MiB**，
上界 559.75 对应「部署那份 W8A8 把 MLA 本体也整个留 BF16」的情形。
02 §7.5 还单列了一项非权重的 MTP top-k 索引缓冲 68.0 MiB。

共享专家为什么按 TP 切：`is_sequence_parallel = parallel_config.use_sequence_parallel_moe`，而该属性要求
`all2all_backend` 落在 6 种之一；昇腾在 `pass_config.enable_sp` 为假时把它设成 `flashinfer_all2allv`
（代码注释写明就是为了关掉 `use_sequence_parallel_moe`），所以取假 → `disable_tp=False` → 8 卡平分
`[C]` `vllm@0fc695fc:vllm/config/parallel.py#L625-L640`、
`vllm-ascend@db701c1f:vllm_ascend/platform.py#L650-L653`。

MLA 本体四个投影 `[D]`（量化与否按 §0 那份排除表判，02 §0.4 有逐模块统计）：

| 投影 | 形状 | 切法 | 每卡参数 | 精度 | 每卡 |
|---|---|---|---|---|---|
| `q_a_proj` + `kv_a_proj_with_mqa`（融合） | (1536+512) × 4096 | 不切（`disable_tp=True`） | 8,388,608 | int8 | 8.0 MiB |
| `q_b_proj` | (64×256) × 1536 | Column，÷8 | 3,145,728 | int8 | 3.0 MiB |
| `kv_b_proj` | (64×(256+256)) × 512 | Column，÷8 | 2,097,152 | **BF16** | 4.0 MiB |
| `o_proj` | 4096 × (64×256) | Row，÷8 | 8,388,608 | int8 | 8.0 MiB |
| 合计 | | | | | **23.0 MiB** |

索引器（都不切 TP，全 BF16）`[D]`：`wq_b [4096, 1536]` = 6,291,456 参数 → 12.0 MiB；
`wk [128, 4096]` 与 `weights_proj [32, 4096]` 融合、代码写死 `quant_config=None` → 1.25 MiB；
`index_kpool_compress_gate [128, 4096]` → 1.0 MiB。合计 **14.25 MiB**
`[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L1270-L1291`。

`kv_b_proj` 和 `indexer.wq_b` 不量化的依据：HF checkpoint 的 `modules_to_not_convert` 里
`self_attn.kv_b_proj` 与 `self_attn.indexer.wq_b` 各出现 **12 次**，层号是 3、7、…、43 **和 45**——
11 个主干 MLA 层加上 MTP 这一层，所以第 45 层这两项都是 BF16
`[S]` `glm-flow/reference/official-config.json`（`quant_method = fp8`）。
同一份名单里第 45 层还有 `eh_proj`、`mlp.gate`、整个索引器和各 norm；
`q_a_proj` / `q_b_proj` / `kv_a_proj_with_mqa` 出现 0 次，判为量化。
上界 559.75 的差别只来自这一项假设（MLA 本体若整个留 BF16 则是 42.0 而非 23.0），
等部署那份 W8A8 的 `quant_model_description` 到手即可定案。
另外，如果 `quant_description` 里 `is_rot_used` 为真，还要加一个 4096 × 4096 bf16 的 `rot` = 32 MiB
`[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next_mtp.py#L46-L63`。

这一层的量级就是「在主干 45 层之外又加了一层」。`qk_rope_head_dim = 0`，所以
`_pad_nope_kv_a_weight` 不补零 `[C]` `vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L244-L251`。

**一个 decode 步的计算量**

- 主干 45 层 + 草拟 3 遍 × 1 层 = 每步 **48 层**前向 `[D]`。
- 草拟三遍都按第一遍的批宽跑：`input_batch_size = num_input_tokens`（`method == "mtp"` 分支）
  `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L1332`。
  R1 单独在跑时这个宽度是 4，所以三遍都是 4 行进、4 行出，真正取来出 logits 的只有 1 行 `[D]`。
- 草拟的 lm_head 调用次数 = 3 次/步，每次 `[B, 4096] × [4096, 19360]`，用的就是主模型那份切片（见第 10 条）；
  B = 该步的请求数 `[D]`。
- 草拟每遍至少多两次 TP 通信 `[C]`：
  - `mtp_block` 出来后一次 `[N, 4096]` 的 all-reduce（`vllm_ascend/models/glm5_next_mtp.py#L122`）；
  - `compute_logits` 里一次 `[B, 19360] → [B, 154880]` 的 all-gather
    （`vllm_ascend/models/glm5_next_mtp.py#L175-L183` → `vllm@0fc695fc:vllm/model_executor/layers/logits_processor.py#L75-L87`）。

  `mtp_block` 内部（MLA 的 `o_proj` reduce-scatter/all-reduce、MoE 的 EP 通信）还有更多，属于 A4/B5 的账。

**main 分支差异**

- `main`（`baa023ad`）把 MTP 挪到 `vllm_ascend/models/glm5next/mtp.py`，并把「首位清零 + enorm + hnorm + concat」
  融成一个算子 `fused_eh_norm`，数学等价，少几次 kernel launch
  `[C]` `vllm-ascend@baa023ad:vllm_ascend/models/glm5next/mtp.py#L36`、`#L89-L98`。
- GLM 强制 eager 那段在 main 上仍在：`vllm-ascend@baa023ad:vllm_ascend/spec_decode/llm_base_proposer.py#L113`、
  `#L241`、`#L251-L260` `[C]`。

### 对应知识页

`wiki/concepts/` 下：`speculative-decoding.md`、`token.md`、`embedding.md`、`matmul-and-weights.md`、
`tensor-parallel.md`、`expert-parallel.md`、`moe.md`、`mla.md`、`sparse-attention.md`、`quantization.md`、
`npu-model-runner.md`、`one-request.md`、`glm-5-3-flash.md`、`glm-5-3-flash-two-node.md`、`structured-output.md`、
`batch-invariance.md`、`ops-and-kernels.md`。

### 待核

1. 部署那份 W8A8 权重的 `quant_model_description`：决定 MLA 本体是 23.0（部分 int8）还是 42.0 MiB（整个 BF16），
   也就是 02 §7.5 那 540.75 / 559.75 的差别；还决定 `is_rot_used` 要不要再加 32 MiB。
   本机只有 HF 原始 FP8 checkpoint 的排除表，按它判的是 23.0。
2. MTP 层自己那份 KV cache 的大小与 block 数：它是第 45 层稀疏 MLA，会进 KV cache 分组，`slot_mapping_group`
   按草拟步各留一份（`vllm_ascend/spec_decode/llm_base_proposer.py#L246-L262`）。每 token 的字节数按 01 底稿的
   判定是 1,088 B/层，MTP 这一层让每 token 从 11 × 1,088 变成 12 × 1,088 = 13,056 B（01 底稿 §KV 账）。
3. 已定案（原待核 1）：`num_attention_heads = 64`、`qk_rope_head_dim = 0`、`num_key_value_heads = 64`、
   `qk_head_dim = 256`，昇腾 config 的默认值同为 64 / 0
   `[S]` `glm-flow/reference/official-config.json`、
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/transformers_utils/configs/glm5_next.py#L23`、`#L49`。
4. 已定案（原待核 2）：`shared_head.head` 就是主模型的 lm_head，不存在单独量化与否的问题。
5. 已定案（原待核 4）：`index_share_for_mtp_iteration` 在 config 里是 `true`，但 `db701c1f` 里没有任何
   `set_skip_topk` 的实现——`git grep set_skip_topk` 只命中 proposer 里那两处 `hasattr` 判断，条件恒假
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L190-L194`、`#L1208-L1209`、`#L1220-L1221`。
   **结论：三遍草拟都会重算索引器的 topk**，不复用第一遍的结果。

---

## A6 decode 步：FULL_DECODE_ONLY 图模式与草稿的验证

### 做了什么

decode 步每个请求带着「1 个已确定的 token + 3 个猜的 token」一起进模型，一次前向同时验这 4 个位置。
整个前向被事先录成了一张图，到点直接回放；只要这一步的形状和录的时候不一样（比如混进了 prefill），就整步退回 eager。
验完之后，接受几个由拒绝采样决定，被拒位置的 KV 不回收，靠下一步原地覆盖。

### 怎么走的

**（1）图什么时候录、录了什么**

1. `FULL_DECODE_ONLY` 的语义：`decode_mode() = FULL`、`mixed_mode() = NONE`、`separate_routine() = True`
   `[C]` `vllm@0fc695fc:vllm/config/compilation.py#L59-L90`。
   所以只为「整齐的 decode 批次」建 key，混合批次一张图都没有
   `[C]` `vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L209-L236`。
2. 建 key 时先按 `uniform_decode_query_len` 过滤尺寸：只保留 `uniform_decode_query_len <= x <= max_num_seqs ×
   uniform_decode_query_len` 的捕获尺寸，并为每个尺寸算出 `num_reqs = min(x // 4, 32)`
   `[C]` `vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L214-L236`、`#L133-L158`。
3. 尺寸还要被 `adjust_cudagraph_sizes_for_spec_decode` 向上取整到 `uniform_decode_query_len` 的倍数；
   只有同时开了 vLLM 的 `pass_config.enable_sp` 且 TP>1 时倍数才改成 `max(4, tp_size)`
   `[C]` `vllm@0fc695fc:vllm/config/compilation.py#L1430-L1440`、`#L1475-L1518`。
   本部署是 MoE 模型，优化档里 `enable_sp` 取 `IS_DENSE` = 假
   `[C]` `vllm@0fc695fc:vllm/config/vllm.py#L242-L262`，所以倍数就是 4。
4. 权重加载完之后，整个模型被 `ACLGraphWrapper(..., runtime_mode=FULL)` 包一层
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3807-L3816`。
   启动阶段 `capture_model` 按 `get_capture_descs()` 逐个尺寸（从大到小）跑 dummy batch 并录图
   `[C]` `vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L6525-L6588`、
   `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5330-L5340`。
   录下来的是一整次模型 forward（含注意力），输入输出张量地址固定
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L166-L231`。
5. 回放时按 `batch_descriptor` 找 entry，先 `torch.npu.current_stream().synchronize()`（主模型
   `is_draft_model` 为假 → `need_sync` 为真；`enable_enpu` 只在环境变量 `ENPU_ENABLE=true` 时才真），
   再 `entry.aclgraph.replay()`，返回录制时那块 output
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L232-L259`、`#L253-L257`、
   `vllm_ascend/worker/model_runner_v1.py#L497-L500`。
6. runner 里那条「在侧流上刷新 attention 参数」的路径（`update_full_graph_params`）本模型走不到：
   `_update_full_graph_params_if_needed` 要求 `not self.use_sparse and not self.use_compress`，
   而 GLM-5.3-Flash 有 `index_topk`、没有 `compress_ratios` → `use_sparse = True`
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2784-L2787`、`#L385-L389`。
   另外这个调用本身发生在 `run_model()` **之后**，不是回放之前（`#L2826-L2835`）。
   稀疏 MLA / KDA 的元数据在回放时怎样进图，见待核。

**（2）什么时候不回放、退回 eager**

7. 每步先判 `uniform_decode`：三个条件同时成立才算整齐——所有请求的 prompt 都算完了、
   `max_num_scheduled_tokens == uniform_decode_query_len`、`num_tokens == max_num_scheduled_tokens × num_reqs`
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2915-L2941`。
8. 不整齐时 `dispatch` 造出来的 `BatchDescriptor` 是 `uniform=False`，而 FULL 的 key 全是 `uniform=True`，
   `PIECEWISE` 集合在 `FULL_DECODE_ONLY` 下是空的，于是返回 `CUDAGraphMode.NONE`
   `[C]` `vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L306-L327`。
9. `num_tokens > max_cudagraph_capture_size`（128）时直接返回 NONE
   `[C]` `vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L276-L283`。
10. DP 之间要对齐：两个 DP 组把 `(num_tokens, cudagraph_mode)` 打包做一次 all-reduce，模式取两边的最小值——
    只要有一边是 NONE(0)，两边都按 NONE 走
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L692-L739`、`#L5383-L5389`。
11. `ACLGraphWrapper.__call__` 在 `forward_context.cudagraph_runtime_mode == NONE` 时直接透传给原模型，
    不捕获也不回放 `[C]` `vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L138-L150`。

**（3）一次验 1+3 个 token**

12. 调度侧：running 请求这一步能拿的 token 数
    `num_new_tokens = num_tokens_with_spec + num_output_placeholders − num_computed_tokens`，
    其中 `num_tokens_with_spec = len(all_token_ids) + len(spec_token_ids)`
    `[C]` `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L403-L407`、`vllm/v1/request.py#L247-L248`。
    稳定 decode 的请求这个值正好是 4。
13. KV 预留：`allocate_slots(..., num_lookahead_tokens=3)`，`num_lookahead_tokens` 对 eagle/mtp 等于
    `num_speculative_tokens`
    `[C]` `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L212-L226`、`#L458-L466`。
14. 被调度的草稿 token 记进 `scheduled_spec_decode_tokens`，请求自己的 `spec_token_ids` 当场清空，等这一步末尾
    再由 `update_draft_token_ids` 写入新的
    `[C]` `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L519-L535`、`#L1738-L1757`。
15. 执行侧把 4 个位置的 logits 切成两拨：`target_logits_indices` 是前 3 个（用来验 3 个草稿），
    `bonus_logits_indices` 是最后 1 个（全接受时才用得上的 bonus token）
    `[C]` `vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L2730-L2809`。
16. 实际执行的是 `AscendRejectionSampler.forward`：先用普通 Sampler 对 bonus 行采一个 token，再对 3 个验证行
    转 fp32、做完整的 logits processors + temperature/top-k/top-p，最后进 `rejection_sample`
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L146-L247`
    （顺序与上游一致，上游对照 `vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L88-L196`、`#L510-L565`）。

**（4）接受几个怎么定**

17. 贪心请求（temperature < 1e-5）：逐位比 `draft_token_id == target_argmax`，相等就接受并写下 target 的 argmax，
    第一次不等就写下 target 的 argmax 并停止；全接受才追加 bonus token
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L449-L470`
    （上游对照 `vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L715-L764`）。
    所以贪心下一步产出的 token 数 = 接受数 + 1，范围 1–4。
18. 随机请求：逐位比 `target_prob / draft_prob >= u`（`u ~ U(0,1)`）。本部署 `draft_probs` 是 `None`，
    `NO_DRAFT_PROBS` 分支把 `draft_prob` 取 1，判据退化成 `target_prob(draft_token) >= u`；
    一旦拒绝就改写成 recovered token 并停止
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/ops/triton/reject_sample.py#L205-L213`
    （上游对照 `vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L769-L830`、`#L663-L713`）。
19. `enable_block_verify`（按整块累乘概率判）和 `enable_entropy_verify`（按目标分布的熵调阈值）这两条替代判据
    默认关闭，本部署走的是上面两条标准判据
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/sample/rejection_sampler.py#L399-L403`、
    `vllm_ascend/ascend_config.py#L778-L781`。
20. 输出缓冲区是 `[batch_size, max_spec_len + 1]`，没写满的位置留 `PLACEHOLDER_TOKEN_ID = -1`，
    由 `parse_output` 过滤
    `[C]` `vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L427-L433`、`#L249-L283`、`#L30`。
    `max_spec_len` 必须 ≤ 128 `[C]` `vllm@0fc695fc:vllm/v1/sample/rejection_sampler.py#L34`、`#L119`。

**（5）被拒的 KV 怎么处理**

21. 调度器拿到输出后倒推：`num_accepted = len(generated_token_ids) − 1`、
    `num_rejected = num_draft_tokens − num_accepted`，然后 `request.num_computed_tokens -= num_rejected`
    `[C]` `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1414-L1436`。
22. 块不释放。下一步的 slot mapping 从回退后的 `num_computed_tokens` 重新算，于是被拒位置的 KV 会被下一步
    原地写掉 `[D]`。依据：调度时 `num_computed_tokens` 先按整批加满，注释里写明「如果有 spec token 之后被拒，
    计算过的 token 数会在 `update_from_output` 里调回来」，回退路径只动这个计数，不碰块
    `[C]` `vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L1005-L1010`、`#L1427`。
23. 草拟侧同理：被拒位置仍然参与草拟的前向，只是不被 `token_indices_to_sample` 选中
    `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L2015-L2067`。

**（6）异步调度**

24. 本部署没写 `--async-scheduling`，走自动判定：method 是 `"mtp"`（在 `EagleModelTypes` 里）、
    `disable_padded_drafter_batch` 没开、MultiprocExecutor 支持异步 → `async_scheduling = True`
    `[C]` `vllm@0fc695fc:vllm/config/vllm.py#L957-L997`、`vllm/v1/executor/multiproc_executor.py#L511-L513`。
    即调度器会在上一步的 token 回来之前就排下一步，用 `num_output_placeholders` 占位（占位数 = 1 + 草稿数）
    `[C]` `vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L33`、`#L59-L60`；
    上面第 12、21 条里的 placeholder 项就是为这条路准备的。每步的调度 token 数仍然是 4。

### 本部署下的具体数字和算式

**R1 连着走两步 decode**（prompt 4 个 token，位置 0–3，4 是演示设定，见 01 A1「在我们部署下的具体数字（R1）」第一条；DP 组里只有它一个请求）

下面两张表按「回退之后的逻辑值」记账：`num_computed_tokens` 的 4→8→6 是同一步内先加满再回退的结果。
本部署异步调度是开的（见第 24 条），时间上下一步的调度与这一步的回写是交错的，表里不体现这层时序。

前置：prefill 那一步取 1 行 logits（位置 3）采出 `t1`（位置 4）。
草拟第一遍吃 4 个 prefill 位置：`input_ids` 左移成 `[p1, p2, p3, p3]`，末位换成 `t1` → `[p1, p2, p3, t1]`，
positions `[0,1,2,3]`，hidden 用主模型这 4 个位置的输出；三遍跑完得到 `d1, d2, d3`（位置 5、6、7）
`[C]`（`llm_base_proposer.py#L1472-L1485`）+ `[D]`。

**第 1 步 decode**

| 项 | 值 | 算式 / 来源 |
|---|---|---|
| 调度 token 数 | 4 | `num_tokens_with_spec(5+3=8) − num_computed(4)` `[D]` |
| 进模型的 token | `[t1, d1, d2, d3]`，位置 4,5,6,7 | `[D]` |
| `uniform_decode` | 真 | 4 == 4 且 4 == 4 × 1 `[C]` |
| 补齐后的图尺寸 | 4（`num_reqs = 4 // 4 = 1`） | `[C]` dispatcher `#L133-L158` |
| 图模式 | FULL，回放 4-token 图 | `[C]` |
| logits | `[4, 154880]` | `[D]` |
| 验证行 / bonus 行 | `target_logits_indices=[0,1,2]`，`bonus_logits_indices=[3]` | `[C]` |
| 假设贪心且第 2 个草稿被拒 | 接受 1 个 | `num_accepted = 1` `[D]` |
| 本步产出 | 2 个 token（位置 5 的 = d1，位置 6 的 = target argmax） | `[D]` |
| `num_computed_tokens` | 4 → 8 → 8 − 2 = **6** | `num_rejected = 3 − 1 = 2` `[C]` |
| 草拟取哪一行 | `query_start_loc[1] − 1 − num_rejected = 3 − 2 = 1`（位置 5） | `[C]` `#L2015-L2067` |
| 新草稿 | `d1', d2', d3'`（位置 7、8、9） | `[D]` |

**第 2 步 decode**

| 项 | 值 | 算式 |
|---|---|---|
| 调度 token 数 | 4 | `num_tokens_with_spec(7+3=10) − num_computed(6)` `[D]` |
| 进模型的 token | `[位置6的token, d1', d2', d3']`，位置 6,7,8,9 | `[D]` |
| KV 写入位置 | 6,7,8,9——其中 6、7 覆盖掉第 1 步写坏的两格 | `[D]` |
| 图 | 还是 4-token 那张，回放 | `[C]` |
| 假设三个草稿全接受 | 接受 3 个 + bonus = 4 个 token | `[C]` 贪心 kernel 全接受分支 |
| `num_computed_tokens` | 6 → 10，`num_rejected = 0` | `[D]` |

两步合计：每步 4 个 token 位进模型，主干 45 层 + 草拟 3 遍各 1 层 = 48 个层次；两步共 2 × 48 = 96 个层次、每个层次 4 个 token 位；产出 6 个 token（2 + 4），平均每步 3 个 `[D]`。

**其它可核对的量**

- 一个 decode 步里，主模型对每个请求写 4 格 KV；被拒 k 个就有 k 格会在下一步被覆盖，k ∈ {0,1,2,3} `[D]`。
- 满载（32 个请求全 decode）一步的 token 数 = 32 × 4 = **128**，正好等于最大捕获尺寸 `[D]`。
- 一步最多产出 token 数 = 32 × 4 = 128；最少 = 32 × 1 = 32 `[D]`。

### 对应知识页

`wiki/concepts/` 下：`acl-graph.md`、`graph-mode-layer.md`、`npugraph-ex.md`、`speculative-decoding.md`、
`async-scheduling.md`、`vllm-scheduler.md`、`npu-model-runner.md`、`prepare-inputs-flow.md`、`kv-cache.md`、
`block-table.md`、`vllm-kv-block-allocation.md`、`paged-attention.md`、`one-request.md`、`request-call-chain.md`、
`data-parallel.md`、`batch-invariance.md`。

### 待核

1. 7 张图一共占多少显存。`capture_model` 会打印 `Graph capturing finished in %.0f secs, took %.2f GiB`
   （`vllm@0fc695fc:vllm/v1/worker/gpu_model_runner.py#L6584-L6589`），需要一份本部署的启动日志才能填。
2. 异步调度实际是否开着。上面第 24 条是按默认值推的，启动日志里有一行
   `Asynchronous scheduling is %s.`（`vllm@0fc695fc:vllm/config/vllm.py#L999-L1001`），拿到日志即可定案。
3. 真实接受率。本文所有「接受 1 个 / 全接受」都是为了把算式走通而设的例子，不是实测值。
   接受率统计走 `make_spec_decoding_stats`（`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L2061-L2080`），
   需要 benchmark 输出。
4. 稀疏 MLA / KDA 的 attention metadata 在 FULL 图回放时怎样更新。runner 那条
   `update_full_graph_params` 已确认不执行（第 6 条），剩下的问题是各 backend 的 metadata builder
   是否把 seq_lens / block table 写进固定地址的 buffer。要继续追 SFA 与 KDA 的 metadata builder。
5. 已定案（原待核 4）：回放前的 `torch.npu.current_stream().synchronize()` 照常执行。
   跳过它需要 `is_draft_eagle`（`_EXTRA_CTX.is_draft_model` 与 `use_eagle` 同时为真）或 `enable_enpu`；
   主模型这一侧 `is_draft_model` 为假，`enable_enpu` 只在环境变量 `ENPU_ENABLE=true` 时为真，本部署没设
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/compilation/acl_graph.py#L253-L256`、
   `vllm_ascend/worker/model_runner_v1.py#L497-L500`。

---

## B4 图尺寸补齐与 MTP 的影响

### 做了什么

图是按固定的几个 token 数录的，真实批次的 token 数几乎不会正好落在这几个数上，于是往上补齐到最近的一个捕获尺寸。
开了 MTP 之后，一个请求一步占 4 个 token 而不是 1 个，补齐的绝对浪费跟着放大 4 倍；只要这一步混进了 prefill，
就没有图可用，整步 eager。除了补到捕获尺寸，两个 DP 组之间还要再补一次：主模型和草拟都按两组的最大值跑。

### 怎么走的

1. 捕获尺寸 → 补齐表：`_compute_bs_to_padded_graph_size` 把 `[0, max_size]` 每个整数映射到「≥ 它的最小捕获尺寸」
   `[C]` `vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L76-L96`。
   `max_cudagraph_capture_size` 等于捕获尺寸列表的最后一项，构造期有 assert
   `[C]` `vllm@0fc695fc:vllm/config/compilation.py#L1104-L1106`。
2. 每步先算 `num_tokens_padded = _pad_for_sequence_parallelism(num_tokens)`，再 `dispatch`
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2914`、`#L2953-L2966`。
3. `dispatch` 里造 `BatchDescriptor`：整齐 decode 时 `num_tokens_padded % 4 == 0` 且
   `num_reqs = min(num_tokens_padded // 4, 32)`；不整齐时 `uniform=False`、`num_reqs = min(num_tokens_padded, 32)`
   `[C]` `vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L133-L158`。
   不整齐的那个 `BatchDescriptor` 只是中间对象：FULL 的 key 里查不到它，函数最后返回的是**没补齐的**
   `BatchDescriptor(num_tokens)`，也就是按原始 token 数走 eager
   `[C]` `vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L326-L328`。
4. DP 对齐：`allow_dp_padding` 为真的那一侧把 token 数补到 DP 组的最大值，模式取两边最小值
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2974-L2996`、`#L692-L739`。
5. 最终前向用的宽度就是 `batch_desc.num_tokens`
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2108`、`#L2265-L2290`。
6. 草拟不补到捕获尺寸（它不进图），但**要补到 DP 最大值**：`_propose` 的 eager 分支之后照样调
   `_sync_metadata_across_dp(..., is_draft_model=True)`，而 `is_draft_model=True` 一律取最大值
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L899-L906`、
   `vllm_ascend/worker/model_runner_v1.py#L727-L740`。三遍草拟都按这个宽度跑（`llm_base_proposer.py#L1332`）。
   所以「捕获尺寸」只约束主模型那一次前向，「DP 最大值」同时约束主模型和草拟。

### 本部署下的具体数字和算式

**捕获尺寸 ↔ 请求数（`uniform_decode_query_len = 4`）**

| 捕获尺寸 | 4 | 8 | 16 | 32 | 64 | 96 | 128 |
|---|---|---|---|---|---|---|---|
| `num_reqs = x // 4` | 1 | 2 | 4 | 8 | 16 | 24 | 32 |

7 个尺寸全部满足 `4 ≤ x ≤ 32 × 4 = 128`，所以 7 张图全建 key、全捕获 `[C]`+`[D]`。

**decode 请求数 → 实际 token 数 → 补齐后的尺寸**

| 请求数 n | token 数 4n | 补到 | 空跑的 token 位 | 浪费比 |
|---|---|---|---|---|
| 1 | 4 | 4 | 0 | 0% |
| 2 | 8 | 8 | 0 | 0% |
| 3 | 12 | 16 | 4 | 25% |
| 5 | 20 | 32 | 12 | 37.5% |
| 9 | 36 | 64 | 28 | 43.8% |
| 12 | 48 | 64 | 16 | 25% |
| 16 | 64 | 64 | 0 | 0% |
| 17 | 68 | 96 | 28 | 29.2% |
| 24 | 96 | 96 | 0 | 0% |
| 25 | 100 | 128 | 28 | 21.9% |
| 32 | 128 | 128 | 0 | 0% |

算式：`padded = min{ x ∈ {4,8,16,32,64,96,128} : x ≥ 4n }`，浪费比 `= (padded − 4n) / padded` `[D]`。

**MTP 把这件事放大了多少**

同样 12 个请求，关掉投机时 `uniform_decode_query_len = 1`：12 个 token → 补到 16，空跑 4 格；
开了 MTP 是 48 → 64，空跑 16 格。绝对浪费按 4 倍放大 `[D]`。
比例只在这个例子里恰好相等（都是 25%），一般情况下不相等 `[D]`：

| 请求数 n | 不开投机（n → 补到） | 浪费比 | 开 MTP（4n → 补到） | 浪费比 |
|---|---|---|---|---|
| 1 | 1 → 4 | 75% | 4 → 4 | 0% |
| 12 | 12 → 16 | 25% | 48 → 64 | 25% |
| 17 | 17 → 32 | 46.9% | 68 → 96 | 29.2% |
| 25 | 25 → 32 | 21.9% | 100 → 128 | 21.9% |

只有当「不开投机时的补齐尺寸 × 4」本身也是捕获尺寸时，两边比例才相等。
换个角度：不开投机时 32 个请求只需要 32 这一档，开了 MTP 之后才需要一路捕到 128 `[D]`。

**场景 M**（DP0：12 个 decode + 新来 1 个 6000 token 的请求；DP1：7 个 decode）

*步骤 A——新请求还没进来的那一步*

| | DP0 | DP1 |
|---|---|---|
| decode 请求数 | 12 | 7 |
| 实际 token 数 | 12 × 4 = 48 | 7 × 4 = 28 |
| 本地补齐 | 64（`num_reqs` 位 16） | 32（`num_reqs` 位 8） |
| DP all-reduce 后取的宽度 | max(64, 32) = **64** | **64** |
| 图模式 | FULL，回放 64-token 图 | FULL，回放 64-token 图 |
| 主模型空跑的 token 位 | 64 − 48 = 16 | 64 − 28 = **36** |
| 草拟宽度（三遍都是这个宽度） | max(48, 28) = **48** | **48** |
| 草拟空跑的行 | 0 | 48 − 28 = **20** |
| MoE 通信方式 | MC2（DP 最大 64 ≤ 容量 128） | MC2 |

DP1 那 36 格（主模型）+ 每遍 20 行（草拟）就是「空闲的组陪跑」的具体代价：它本来主模型只要 32 格宽的图、
草拟只要 28 行 `[C]`+`[D]`。
严格说，触发陪跑的是 MoE 本身，不开 EP 时专家也切在所有卡上（见 `data-parallel.md`）；本部署开了 EP16，结论相同 `[C]`。
依据：主模型走 `_sync_metadata_across_dp`，`allow_dp_padding` 在本地图模式非 NONE 时为真，两边都填成
`max_tokens_across_dp`（`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L731-L738`、`#L2979-L2983`）；
草拟走同一个函数但带 `is_draft_model=True`，这条分支无条件取最大值
（`#L733-L740`、`vllm_ascend/spec_decode/llm_base_proposer.py#L899-L906`）。
MC2 的判据见步骤 B 下面那段。

*步骤 B——6000 token 的新请求混进 DP0 这一步*

| | DP0 | DP1 |
|---|---|---|
| token 预算 | 8192 | 8192 |
| decode 占用 | 12 × 4 = 48 | 7 × 4 = 28 |
| 留给 prefill 的 | 8192 − 48 = 8144 ≥ 6000，一次吃完，不切块 | — |
| 这一步 token 数 | 48 + 6000 = **6048** | 28 |
| `uniform_decode` | 假（`max_num_scheduled_tokens = 6000 ≠ 4`） | 真 |
| 本地 dispatch | 6048 > 128 → NONE | 32 → FULL |
| DP 模式取小 | NONE | **NONE** |
| 主模型实际执行 | eager，**6048** 宽 | eager，**6048** 宽（真实只有 28） |
| 草拟宽度（三遍都是这个宽度） | **6048** | **6048**（真实只有 28） |
| MoE 通信方式 | ALLGATHER（DP 最大 6048 > 128） | ALLGATHER |

DP1 的 6048 是从代码直接定下来的，不需要实测 `[C]`：DP1 本地是 FULL → `allow_dp_padding=True` →
拿到 `num_tokens_across_dp = [6048, 6048]` → `num_tokens_padded = 6048` → 按 `valid_modes={NONE}` 重新
dispatch，返回 `BatchDescriptor(6048)`，`#L2996` 的 assert 通过
（`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2976-L2996`、
`vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L278-L285`）。

代价对比：主模型是 45 层 × 6048 宽跑一次；草拟是 1 层 × 6048 宽跑三次，每次都含一个稀疏 MLA 和一个 MoE。
DP1 这一步真实只有 28 行有用。

也就是说：DP0 只要有一个请求在 prefill，两个 DP 组这一步都用不上图，草拟也一起被拉宽 `[C]`。

*步骤 C——新请求 prefill 完、转入 decode 的下一步*

DP0 变成 13 个 decode 请求 → 13 × 4 = 52 → 补到 64（空跑 12 格）；DP1 仍是 28 → 被拉到 64；
草拟宽度 max(52, 28) = 52 `[D]`。

**MoE 通信方式怎么选（A2）**

A2 上只在 MC2 和 ALLGATHER 之间二选一，没有 ALLTOALL 分支。三个条件同时成立才走 MC2：
每卡专家数 ≤ 24（本部署 18）、EP ≥ 16（本部署 16）、**DP 组内最大 token 数 ≤ `mc2_tokens_capacity`**
`[C]` `vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L239-L252`。
容量 = `min(ceil(最大捕获尺寸 / TP), 512) × TP` = `min(ceil(128/8), 512) × 8` = **128**
`[C]` `vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L202-L217`。
所以：步骤 A 的 64 ≤ 128 → MC2；步骤 B 的 6048 > 128 → 两组都翻到 ALLGATHER `[D]`。
与 02 底稿 §6.4 的写法一致。

**变体 M'（DP1 空闲）**

DP1 没有请求时不是「0 个 token」：worker 收到 `execute_dummy_batch`，跑
`_dummy_run(num_tokens=decode_token_per_req, uniform_decode=True)`，而 `decode_token_per_req = 1 + 3 = 4`
`[C]` `vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L971-L972`、
`vllm_ascend/worker/model_runner_v1.py#L652-L656`。
这个 4 只是本地起点：dummy 同样经过 `_determine_batch_execution_and_padding` → `_sync_metadata_across_dp`，
最终宽度仍是 DP 组的最大值
`[C]` `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L3410-L3428`、`#L3446-L3450`。
并且 dummy 也会带着草拟一起跑：`self.drafter.dummy_run(num_tokens=num_tokens_padded, ...)`
`[C]` `vllm_ascend/worker/model_runner_v1.py#L3642-L3650`。

落到场景 M：DP0 是 12 个 decode（48 → 64）时，DP1 的 dummy 本地起点 4 → 被拉到 **64**，回放 64-token 图；
DP0 那一步混了 prefill（6048）时，DP1 的 dummy 被拉到 **6048**，走 eager `[D]`。

（03 初稿写的「`num_tokens = 0`」是错的；01 底稿写的「本地 4」和「最终被补到 DP 最大值」是同一条链的两端，
两者都对，见上面的行号。）

**混进 prefill 时的完整判据（按顺序）**

1. 所有请求的 prompt 都算完了吗？（`num_computed_tokens >= num_prompt_tokens`）
2. `max_num_scheduled_tokens == 4` 吗？
3. `num_tokens == 4 × num_reqs` 吗？
4. `num_tokens <= 128` 吗？
5. 另一个 DP 组也过了 1–4 吗？

五条全过才回放图，任何一条不过就整步 eager
`[C]` `vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L2915-L2941`、
`vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L276-L327`、
`vllm-ascend@db701c1f:vllm_ascend/worker/model_runner_v1.py#L5383-L5389`。

### 对应知识页

`wiki/concepts/` 下：`acl-graph.md`、`graph-mode-layer.md`、`npugraph-ex.md`、`chunked-prefill.md`、
`data-parallel.md`、`speculative-decoding.md`、`vllm-scheduler.md`、`concurrent-requests.md`、
`npu-model-runner.md`、`sequence-parallel.md`、`vllm-v1-shape.md`。

### 待核

1. `_pad_for_sequence_parallelism` 在本部署下是否改动 token 数。昇腾的 `enable_sp()` 读的是自己的
   `enable_flashcomm1`（默认 0），与 vLLM 的 `pass_config.enable_sp` 是两个开关
   （`vllm-ascend@db701c1f:vllm_ascend/utils.py#L905-L931`）。按默认值两者都是关的，补齐就是纯粹的图尺寸补齐；
   要确认得看启动日志里的 ascend config dump。
2. 已定案（原待核 2）：步骤 B 里 DP1 的主模型宽度是 **6048**，见步骤 B 表格下面那段的行号。
   两个 rank 手里的 `num_tokens_across_dp` 确实不一样（DP0 `[6048, 32]`、DP1 `[6048, 6048]`），
   但下游只用到它的最大值——`max_tokens_across_dp` 两边都是 6048，通信方式与
   `padded_num_tokens = ceil(6048 / 8) × 8 = 6048` 两边一致
   `[C]` `vllm-ascend@db701c1f:vllm_ascend/ascend_forward_context.py#L96-L97`、`#L164-L166`、`#L185`。
   还没核到的只剩一点：ALLGATHER 路径内部是否另有地方按 rank 逐项读这个向量。
3. `max_num_batched_tokens = 8192` 与 6000 token 一次吃完的结论，依赖「没有开 `long_prefill_token_threshold`」
   （`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L408-L410`）。本部署没设这个参数，默认 0；
   若启动脚本另有 `--long-prefill-token-threshold`，上表要重算。
4. 图捕获耗时与每张图的显存增量，同 A6 待核 1。

---

## 修订记录（按 `docs/mainline/review/03-review.md`，2026-09-27）

| 审查项 | 处理 |
|---|---|
| P1-1 MTP 的 lm_head 实际与主模型共享 | 已改。A5 第 10 条改写（昇腾补丁把 `is_deepseek_mla` 补成真，checkpoint 里没有 `shared_head.head.weight`）；权重表里 `shared_head.head` 计 0；原待核 2 改成「已定案」。补丁与 checkpoint 两条证据均自核 |
| P1-2 共享专家 3 MiB、漏了 router gate、671 MiB 要重算 | 已改。权重整段换成分项表，合计 **533–560 MiB**（按 HF checkpoint 的量化划分约 541 MiB）；共享专家 3 MiB 并给出 `use_sequence_parallel_moe` 为假的链条；新增 router gate 4.5 MiB（`GateLinear(ReplicatedLinear)`，已自核） |
| P1-3 本模型走不到 `update_full_graph_params` | 已改。A6 新增第 6 条：`use_sparse=True` 关掉这条路径，且调用本在 `run_model()` 之后；对应待核改成「稀疏 MLA / KDA 元数据怎样进图」 |
| P1-4 草拟也做 DP 补齐 | 已改。A5 第 19 条补 `is_draft_model=True` 那次同步；B4 第 6 条改写；场景 M 三步各加「草拟宽度」行（步骤 A 48、步骤 B 6048、步骤 C 52） |
| P1-5 草稿清零是 upstream 行为 | 已改。A5 第 16 条改写成昇腾的两处机制（position 钳零 + 调度器截断），upstream 降为对照并注明被覆写 |
| P1-6 空闲组 dummy 不是 0 | 已改，见下「冲突项」一行 |
| P2-1 `take_last_draft_probs` 理由错 | 已改。改成两条真实原因（昇腾覆写 `_sample` 写死 `None`；`_run_merged_draft` 只做 argmax 不写 `_last_draft_probs`），并写明该方法是从基类继承来的 |
| P2-2 昇腾草拟在 bookkeeping 之后 | 已改。A5 第 11 条改成「吃 NPU 上的 `sampled_token_ids`，调用顺序在 `_bookkeeping_sync` 之后」，upstream 作对照 |
| P2-3 `deepseek_mtp → "mtp"` 行号 | 已改。主引用换成 `speculative.py#L550-L554`，补引昇腾 `patch_speculative_config.py` |
| P2-4 `--seed 1024` 出处 | 已改。源码引用换成 `NPUWorker`；种子取值标为待核（计划 §3 无此项，按约束未读教程） |
| P2-5「比例不变」泛化 | 已改。加了 n=1/12/17/25 四行对比表，说明只有在特定条件下比例才相等 |
| P2-6 MoE 写成 all-to-all | 已改。新增「MoE 通信方式怎么选（A2）」一段：只在 MC2 与 ALLGATHER 之间二选一，容量 128，步骤 A 走 MC2、步骤 B 两组都翻 ALLGATHER；场景 M 两张表各加一行 |
| P3-1 / P3-2 A5 待核 1、4 定案 | 已改。MLA 64 头、`qk_rope_head_dim = 0` 写进权重段；`index_share_for_mtp_iteration` 为 true 但 `db701c1f` 没有 `set_skip_topk` 实现，结论「三遍草拟都重算索引器」 |
| P3-3 B4 待核 2 定案 | 已改。DP1 主模型宽度 6048 写进步骤 B；并补上「两 rank 的向量不同，但下游只用最大值，两边都是 6048」 |
| P3-4 A6 待核 4 定案 | 已改。结论：回放前照常同步（`is_draft_model` 假、`enable_enpu` 需 `ENPU_ENABLE=true`） |
| P3-5 算例与异步时序 | 已改。R1 两步表前加了记账口径说明 |
| P3-6「第一个位置」歧义 | 已改。写成「`positions == 0` 的 token，不是 batch 的第一行」 |
| P3-7 拒绝采样应引昇腾 | 已改。A6 第 16–19 条主引用换成 `vllm_ascend/sample/rejection_sampler.py` 与 `ops/triton/reject_sample.py`，upstream 作对照 |
| P3-8 不整齐时返回什么 | 已改。B4 第 3 条补「查不到 key → 返回未补齐的 `BatchDescriptor(num_tokens)`，按原始 token 数 eager」 |
| P3-9 初学者术语 | 已改。A5「做了什么」里补了 logits 和 eager 的白话解释。A6、B4 的「做了什么」审查判定已可读，未动 |
| P3-10 `#L1005` 太含糊 | 已改。精确到 `#L1005-L1010` 并保留 `#L1427` |
| P3-11 函数名与通信次数 | 已改。改成 `_calc_spec_decode_metadata`；草拟通信改成「每遍至少两次」并列出 all-reduce 与 lm_head all-gather |
| P3-12 两处行号 | 已改。采样回传改引 `sample_tokens` 的 RPC `#L319-L326`；dispatcher 早退改成 `#L276-L285` 一带 |
| 跨文档：共享专家 3 MiB（02 对） | 已改，见 P1-2 |
| 跨文档：DP 补齐规则（判定 03 对） | 保留原写法，另补上草拟那一半（P1-4） |
| 跨文档：图尺寸（三份一致） | 不改 |
| 跨文档：块大小、每 token KV 字节 | 03 原本不涉及。这轮只在 A5 待核 2 里引用了 01 的判定（12 × 1,088 = 13,056 B/token），没有另立数字 |
| 追加（02 作者核实，同日第三轮） | 已改。MTP 每卡显存不再由 03 自己给区间，改为引用 **02 §7.5 的 540.75 MiB（上界 559.75）**，口径写明「MLA 本体 23.0 + 索引器 14.25 = 37.25」。原下界 533 偏低，是因为假设了 `kv_b_proj` 和 `indexer.wq_b` 会被量化；自查 `modules_to_not_convert` 后确认这两项各出现 **12 次**（层 3、7、…、43 **和 45**），第 45 层都不量化，`wk_weights_proj` 代码里写死 `quant_config=None`。A5 待核 1 同步改写。同一个数只在 02 里定义一次 |
| 追加（按 `docs/mainline/review/pages/data-parallel-review.md` 的 P5 审查，2026-09-28） | 已改。B4 场景 M 表下补一句：触发陪跑的是 MoE 本身，不开 EP 时专家也切在所有卡上；本部署开了 EP16，结论相同。依据 `vllm@0fc695fc:vllm/v1/engine/core.py#L1153-L1164`（只看 `is_moe`）与 `vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py#L1074-L1082`。审查 P2-3 建议的改称（场景 M 的 DP1 有 7 条请求、不跑 dummy，宜称「较闲的组被拉到对面宽度的代价」）本轮未改 |

**冲突项的判定（空闲组 `_dummy_run`）**：03-review 判 4、01-review 判「补到 6048 再 eager」。
对照源码后判定**两者是同一条链的两端，都对**：`execute_dummy_batch` 传的是
`decode_token_per_req = 1 + 3 = 4`（`vllm-ascend@db701c1f:vllm_ascend/worker/worker.py#L971-L972`、
`vllm_ascend/worker/model_runner_v1.py#L652-L656`），这只是本地起点；dummy 同样经过
`_determine_batch_execution_and_padding` → `_sync_metadata_across_dp`，最终宽度取 DP 组最大值
（`#L3410-L3428`、`#L3446-L3450`、`#L727-L740`），所以步骤 A 是 64、步骤 B 是 6048，且 dummy 会带着草拟一起跑
（`#L3642-L3650`）。03 初稿写的「`num_tokens = 0`」两头都不对，已改。

**本轮未处理**：无 P1/P2 遗留。按约束没读教程 `GLM5.3-Flash.md`（所以 `--seed` 取值仍是待核）与 HANDBOOK；
部署那份 W8A8 权重的 `quant_model_description` 本机没有，所以 MLA 本体按 HF 排除表判为 23.0 MiB，
对应 02 §7.5 的 540.75；若那份权重把 MLA 整个留 BF16 则是上界 559.75。没有文件被拦截。
