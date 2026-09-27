# 审查：docs/mainline/03-sample-decode.md

- 审查对象：`docs/mainline/03-sample-decode.md`（527 行，工作树当前版本）
- 源码：`vllm@0fc695fc`（`tools/repos/vllm` 工作树，HEAD = 0fc695fc6d1d）、`vllm-ascend@db701c1f`（`git show`）、`vllm-ascend@baa023ad`（main，仅核 03 引到的 4 处）
- 模型：`infra-view-hardware-study-20260906/glm-flow/reference/official-config.json`（text_config）与同目录 `checkpoint-shapes.json`（HF sha 690b7052 的 safetensors 头）
- 方法：逐条打开被引用的行号；[C]/[D] 数字用 Python 全部重算；跨文档只用 grep 定位 01/02 的写法，再读命中行上下约 30 行。
- 下文源码路径缩写：`v:` = `vllm@0fc695fc:`，`va:` = `vllm-ascend@db701c1f:`，`vm:` = `vllm-ascend@baa023ad:`。

## 汇总

| 级别 | 数量 |
|---|---|
| P1 事实或数字错误 | 6 |
| P2 结论无源码支撑 / 行号错 / 跨文档冲突 | 6 |
| P3 表述不清、可由源码直接定案的待核 | 12 |

必须全部核到的 6 个关键结论：

| 关键结论 | 判定 |
|---|---|
| `uniform_decode_query_len = 4` | 成立（`v:vllm/v1/worker/gpu_model_runner.py#L814`，`1 + num_spec_tokens`） |
| 7 个捕获尺寸 ↔ 1–32 个请求 | 成立（`v:vllm/v1/cudagraph_dispatcher.py#L210-L236` 过滤 `4 ≤ x ≤ 128`，`#L139-L158` 算 `num_reqs = min(x//4, 32)`；`va:vllm_ascend/platform.py#L109-L125` 的剪枝只对 950 生效，A2 不受影响） |
| 场景 M：DP 取最大值补齐到 64；混入 prefill 时两组都 eager | 成立（`va:vllm_ascend/worker/model_runner_v1.py#L2966-L2996`、`#L720-L740`、`#L5383-L5389`）。但漏了草拟也做 DP 补齐，见 P1-4 |
| 草拟阶段对 GLM 做 eager 硬覆盖 | 成立（`va:vllm_ascend/spec_decode/llm_base_proposer.py#L141-L149`、`#L217`、`#L227-L236`、`#L266`、`#L598-L613`） |
| 昇腾 `_sample` 里 `draft_probs=None`，接受判据退化成 `target_prob ≥ u` | 结论成立（`va:.../model_runner_v1.py#L2605-L2610`；实际执行的 kernel 在 `va:vllm_ascend/ops/triton/reject_sample.py#L205-L213`，`draft_prob = 1`）。配套理由「昇腾 proposer 没有 `take_last_draft_probs`」是错的，见 P2-1 |
| MTP 层每卡约 671 MiB | **不成立**。`shared_head.head` 与主模型共享，共享专家按 TP8 切分；重算约 533–560 MiB，见 P1-1、P1-2 |

## 问题清单

### P1

**P1-1　MTP 的 lm_head 实际与主模型共享，151.25 MiB 不该计入**
- 位置：`03-sample-decode.md:94-98`（A5 第 10 条「lm_head 不共享」）、`:167`（`shared_head.head` 151.25 MiB/卡）、`:203-205`（待核 2）
- 原结论：共享分支要求 `is_deepseek_mla` 为真，而 upstream 白名单里没有 `glm5_next`，所以不共享，MTP 自带一份 151.25 MiB/卡。
- 源码证据：
  - `va:vllm_ascend/patch/platform/patch_glm5_next_config.py#L14-L20`：插件注册 `Glm5NextModelArchConfigConvertor`，其 `is_deepseek_mla()` 返回 `kv_lora_rank is not None`；`#L29-L30` 把 `glm5_next`、`glm5_next_text` 都挂到这个 convertor 上。这个补丁无条件导入（`va:vllm_ascend/patch/platform/__init__.py#L44`）。`v:vllm/config/model.py#L754-L757` 按 model_type 从 `MODEL_ARCH_CONFIG_CONVERTORS` 取 convertor。
  - 所以 `va:.../llm_base_proposer.py#L589-L596` 的共享分支成立：`layer_module.shared_head.head = target_language_model.lm_head`。
  - 旁证：`checkpoint-shapes.json` 里第 45 层只有 `shared_head.norm.weight`，没有 `shared_head.head.weight`。`va:vllm_ascend/models/glm5_next_mtp.py#L286-L290` 会跳过所有非第 45 层的权重（包括 `lm_head.weight`）。如果不共享，这一层的 head 就没有权重可加载。
- 建议改法：第 10 条改成「lm_head 与主模型共享：插件把 GLM5-Next 的 `is_deepseek_mla` 补成真（引上面两处），checkpoint 里也没有 MTP 自己的 head」。删掉 151.25 MiB 这一行，待核 2 整条删除。「草拟的 lm_head 调用」（`:178`）补一句「用的就是主模型那份 `[4096, 19360]` 切片」。

**P1-2　共享专家每卡是 3 MiB 而不是 24 MiB；671 MiB 合计要重算**
- 位置：`03-sample-decode.md:168-170`
- 原结论：「加 1 个共享专家 24 MiB，合计 456 MiB/卡」「三项合计 ≈ 671 MiB/卡」。
- 源码证据：
  - 共享专家是 `AscendGlm5NextMLP(..., is_sequence_parallel=parallel_config.use_sequence_parallel_moe)`（`va:vllm_ascend/models/glm5_next.py#L1462`、`#L1465-L1478`），内部是 `MergedColumnParallelLinear` / `RowParallelLinear`，`disable_tp=is_sequence_parallel`（`#L1416-L1432`）。
  - `use_sequence_parallel_moe` 要求 `all2all_backend` 属于那 6 种（`v:vllm/config/parallel.py#L626-L640`）。昇腾在 `pass_config.enable_sp` 为假时把 `all2all_backend` 设成 `flashinfer_all2allv`（`va:vllm_ascend/platform.py#L650-L653`，注释写明是为了关掉 `use_sequence_parallel_moe`），所以共享专家按 TP8 切：25,165,824 ÷ 8 × 1 B = **3 MiB/卡**。
  - 02 底稿 `02-forward.md:100` 已经写的是「共享专家（int8）3.0 MiB」，与 03 冲突，02 对。
  - 另外还漏了 router gate：`GateLinear(..., params_dtype=torch.float32)`（`va:.../glm5_next.py#L1480-L1487`），288 × 4096 × 4 B = **4.5 MiB/卡**（不切分）。
- 重算（MLA 形状见下文「待核补结论」）：

  | 项 | 每卡 |
  |---|---|
  | eh_proj（bf16，不切） | 64 MiB |
  | 路由专家 18 × 24 MiB（int8） | 432 MiB |
  | 共享专家（int8，TP8 切） | 3 MiB |
  | router gate（fp32，不切） | 4.5 MiB |
  | MLA 投影（int8 21 MiB，按 02 的 [I]「注意力留 BF16」为 42 MiB） | 21–42 MiB |
  | 索引器（wq_b 6 或 12 MiB + wk_weights_proj 1.25 MiB + kpool gate 1 MiB） | 8.25–14.25 MiB |
  | lm_head | 0（共享，见 P1-1） |
  | **合计** | **≈ 533–560 MiB**；按 02 的 BF16 假设取上端 ≈ **560 MiB** |

  如果 W8A8 权重的 `quant_model_description` 里 `is_rot_used` 为真，还要加一个 4096×4096 bf16 的 `rot` = 32 MiB（`va:.../glm5_next_mtp.py#L47-L63`）。
- 建议改法：把第 168–170 行换成上表。「相当于又加了一层的代价」这句保留。

**P1-3　本模型不走 `update_full_graph_params` 这条刷新路径**
- 位置：`03-sample-decode.md:249-251`（A6 第 5 条）
- 原结论：两次回放之间变化的量（seq_lens、block table、workspace）通过 `update_full_graph_params` 在侧流上刷进去。
- 源码证据：`va:.../model_runner_v1.py#L2778-L2800`：`_update_full_graph_params_if_needed` 只在 `not self.use_sparse and not self.use_compress` 时才调用 `update_full_graph_params`。`#L385-L389`：`use_sparse = hf_text_config 有 index_topk 且没有 compress_ratios`。GLM-5.3-Flash 的 `index_topk=2048`，并且没有 `compress_ratios`，所以 `use_sparse=True`，这条路径被关掉。另外它的调用发生在 `run_model()` **之后**（`#L2826-L2835`，`enable_enpu` 为假的分支），不是回放之前。
- 建议改法：改成「本模型 `use_sparse=True`，runner 这条刷新路径不执行（引 `#L2784-L2787`、`#L385-L389`）；稀疏 MLA / KDA 的元数据怎样进图，待核（看 SFA / KDA 的 metadata builder 是否写进固定地址的 buffer）」。同时在待核里新增一条。

**P1-4　草拟也做 DP 补齐：两组的草拟宽度都取 DP 最大值**
- 位置：`03-sample-decode.md:137-139`（A5 第 19 条「`num_input_tokens = num_tokens`，不补齐」）、`:416`（B4 第 6 条「草拟侧不参与这套补齐」）、`:452-487`（场景 M 各表只算了主模型）
- 原结论：草拟 eager，宽度就是本组真实 token 数，不参与补齐。
- 源码证据：`va:.../llm_base_proposer.py#L899-L906`：eager 分支先设 `num_input_tokens = num_tokens`，紧接着无条件调用 `self.runner._sync_metadata_across_dp(num_input_tokens, is_draft_model=True)`。`va:.../model_runner_v1.py#L733-L740`：`is_draft_model=True` 时一律按 `max_tokens_across_dp` 补，并返回这个最大值作为 `num_input_tokens`。草拟只有 MoE 才不跳过这次 all-reduce（`va:vllm_ascend/utils.py#L1280-L1287`：非 PD 部署的 MoE 模型返回 False）。之后三遍都按这个宽度跑（`llm_base_proposer.py#L1332`，`method=="mtp"` 分支）。草拟输入取的是未补齐的 token 数（`va:.../model_runner_v1.py` 里 `target_token_ids = self.input_ids.gpu[:num_scheduled_tokens]`）。
- 对场景 M 的影响 `[C]+[D]`：
  - 步骤 A：DP0 草拟 48、DP1 草拟 28 → 两边都按 **48** 跑三遍，DP1 每遍空跑 20 行。
  - 步骤 B：DP0 草拟 6048 → DP1 草拟也按 **6048** 跑三遍 eager（真实只有 28 行）。这比主模型那一次 6048 宽前向更贵（3 遍 × 1 层 vs 45 层，但每遍都是 6048 宽的 MLA + MoE）。
  - M'：DP1 空闲时，`_dummy_run` 也会调 `self.drafter.dummy_run`（`va:.../model_runner_v1.py#L3642-L3650`），陪跑包括草拟。
- 建议改法：第 19 条补「但随后仍要做一次 DP 对齐，宽度取两组草拟 token 数的最大值」；B4 第 6 条改成「草拟不补到捕获尺寸，但要补到 DP 最大值」；场景 M 表格各加一行「草拟宽度（三遍）」。

**P1-5　「序列快到上限时把草稿清零」是 upstream 行为，昇腾 runner 覆写后没有这条**
- 位置：`03-sample-decode.md:124-126`（A5 第 16 条）
- 原结论：`max_seq_len + 3 <= effective_drafter_max_model_len` 不成立时把草稿清零，下一步退回每请求 1 个 token。
- 源码证据：被引的 `v:.../gpu_model_runner.py#L4368-L4381`、`#L4462-L4463`、`#L4522-L4533` 都在 upstream 的 `sample_tokens` 里，而昇腾的 `NPUModelRunner.sample_tokens` 整体覆写了它（`va:.../model_runner_v1.py#L2373-L2485`）。覆写版里没有 `_input_fits_in_drafter`，也没有 `effective_drafter_max_model_len`（grep 只在 `#L1957` 的注释里出现）。昇腾实际的处理有两处：草拟循环里把超过 `max_model_len` 的位置钳成 0，产生的草稿作废（`va:.../llm_base_proposer.py#L1350-L1365`）；调度器截断 `num_new_tokens`，最多到 `max_model_len − 1 − num_computed_tokens`（`v:vllm/v1/core/sched/scheduler.py#L412-L416`）。
- 建议改法：第 16 条改写成上述两处机制；upstream 那条降为「上游对照」。

**P1-6　变体 M' 里空闲的 DP1 不是 `num_tokens = 0`，而是 4**
- 位置：`03-sample-decode.md:491-492`
- 原结论：「DP1 没有请求时 `num_tokens = 0`」。
- 源码证据：`va:vllm_ascend/worker/worker.py#L971-L972`：`execute_dummy_batch` → `_dummy_run(num_tokens=self.model_runner.decode_token_per_req, uniform_decode=True)`；`va:.../model_runner_v1.py#L652-L656`：`decode_token_per_req = 1 + spec_token_num = 4`。dummy run 同样经过 `_determine_batch_execution_and_padding` → `_sync_metadata_across_dp`（`#L3410-L3427`），所以也按 DP 最大值补齐。01 底稿 `01-deploy-entry-schedule.md:473`、`:501-503` 写的是 4，01 对。
- 建议改法：改成「DP1 跑 `_dummy_run(4, uniform_decode=True)`，本地先补到 4 这张图，再被 DP 对齐拉到 DP0 的宽度（步骤 A 为 64 走 FULL；步骤 B 为 6048 走 eager），并且连带跑一次草拟 dummy（P1-4）」，引上面三处。

### P2

**P2-1　「昇腾 proposer 没有 `take_last_draft_probs`」与源码不符**
- 位置：`03-sample-decode.md:65-67`
- 原结论：上游会先查 `_draft_probs`；昇腾 proposer 没有 `take_last_draft_probs`，所以取不到。
- 源码证据：`AscendSpecDecodeBaseProposer(SpecDecodeBaseProposer)`（`va:.../llm_base_proposer.py#L36`、`#L152`）继承了 upstream 的 `take_last_draft_probs`（`v:vllm/v1/spec_decode/llm_base_proposer.py#L432-L433`），所以方法是有的。真正的原因有两个：昇腾整体覆写了 `_sample`，并把 `draft_probs` 写死成 `None`（`va:.../model_runner_v1.py#L2605-L2610`），upstream 的 `_sample` 根本不执行；昇腾草拟用自己的 `_run_merged_draft`，只做 argmax，不写 `_last_draft_probs`。
- 建议改法：删掉「没有该方法」这半句，改成上面两个原因。

**P2-2　昇腾侧草拟是在 bookkeeping 之后才调用的**
- 位置：`03-sample-decode.md:102-105`（A5 第 11 条「不等 bookkeeping」）
- 源码证据：`va:.../model_runner_v1.py#L2455-L2469` 先调 `_bookkeeping_sync`（调用在 `#L2462`），`#L2473-L2486` 才调 `propose_draft_token_ids(sampler_output.sampled_token_ids)`。它用的仍然是 GPU 上的采样结果，但程序顺序是 bookkeeping 在前。「不等 bookkeeping」只描述了 upstream（`v:.../gpu_model_runner.py#L4480-L4483`）。
- 建议改法：改成「用 GPU 上的 `sampled_token_ids`，不用 CPU 侧的 `valid_sampled_token_ids`；昇腾里调用顺序在 `_bookkeeping_sync` 之后」。

**P2-3　`deepseek_mtp → "mtp"` 的引用行不对**
- 位置：`03-sample-decode.md:17`
- 原结论：引 `v:vllm/config/speculative.py#L713-L716`。
- 源码证据：`deepseek_mtp` 改名成 `mtp` 是在 `v:vllm/config/speculative.py#L550-L554`（method 在 MTPModelTypes 里且不等于 `"mtp"` 时打 deprecated 日志并改名）。L713-716 是按草稿 `hf_config.model_type` 自动识别的分支。本模型能进这个分支，是因为昇腾补丁把 model_type 改成 `glm5_next_mtp` 并加进了 `MTPModelTypes`（`va:vllm_ascend/patch/platform/patch_speculative_config.py#L120-L128`、`#L148-L154`）。
- 建议改法：主引用换成 `#L550-L554`，并补引昇腾补丁。

**P2-4　`--seed 1024` 在计划 §3 里找不到出处**
- 位置：`03-sample-decode.md:160-161`
- 原结论：「本部署 `--seed 1024`……+ 计划 §3 `[S]`」，并引 `v:vllm/v1/worker/gpu_worker.py#L305-L306`。
- 源码证据：`docs/plans/2026-09-27-mainline-rebuild.md` §3 没有 seed（grep 无命中）。本部署跑的是 `NPUWorker`，对应行是 `va:vllm_ascend/worker/worker.py#L498-L499`。
- 建议改法：出处改成教程启动脚本的具体行（本审查按约束没读教程，无法代核），或者标「待核」；源码改引 NPUWorker。

**P2-5　「补齐比例不变」只在这个例子里成立**
- 位置：`03-sample-decode.md:448-449`
- 原结论：「补齐的绝对浪费按 4 倍放大，比例不变 `[D]`」。
- 重算反例（同一组捕获尺寸）：n=1：不开投机 1→4（75%），开 MTP 4→4（0%）；n=17：17→32（46.9%）对 68→96（29.2%）；n=18–24 同样不等。只有当「不开投机的补齐尺寸 × 4」本身也是捕获尺寸时，两者比例才相等。
- 建议改法：改成「在 n=12 这个例子里比例不变；一般情况下不成立，例如 n=17」。

**P2-6　场景 M 里的 MoE 通信写成了 all-to-all，与 02 冲突**
- 位置：`03-sample-decode.md:522`（B4 待核 2「会影响 MoE all-to-all 的分块尺寸」）
- 源码证据：A2 的通信方式选择只有 MC2 和 ALLGATHER 两种（`va:vllm_ascend/ascend_forward_context.py#L239-L252`），门槛是 DP 组内最大 token 数 ≤ `mc2_tokens_capacity`（`#L96-L97`、`#L202-L217`），本部署等于 128。步骤 B 两边的最大值都是 6048，所以两组都走 ALLGATHER，`padded_num_tokens` 两边都是 6048（`#L185`）。02 `02-forward.md:553-583` 写的就是这条，02 对。
- 建议改法：改成「两组都走 ALLGATHER（DP 最大值 6048 > 128）」，引 02 §6.4。剩下的疑问可以缩到一句：ALLGATHER 路径是否用到每个 rank 各自的 `num_tokens_across_dp`，两边视图不同（DP0 为 `[6048, 32]`，DP1 为 `[6048, 6048]`）会不会有影响。

### P3

| # | 位置 | 问题 | 源码 / 建议 |
|---|---|---|---|
| P3-1 | `:199-202` A5 待核 1 | 现在可以定案 | 见下文「待核补结论」第 1 条 |
| P3-2 | `:209-212` A5 待核 4 | 可以定案 | config 里 `index_share_for_mtp_iteration: true`；但 db701c1f 里没有任何 `set_skip_topk` 实现（`git grep skip_topk db701c1f -- vllm_ascend` 只命中 proposer 的两处 `hasattr` 判断），所以 `#L1208`、`#L1220` 两个分支都不成立。**三遍草拟都会重算索引器 topk**。另外被引的 `#L189-L193` 实际在 `#L190-L194` |
| P3-3 | `:519-523` B4 待核 2 | DP1 的主模型宽度由代码就能定，不需要实测 | `va:.../model_runner_v1.py#L2976-L2996`：DP1 本地是 FULL，所以 `allow_dp_padding=True`，得到 `num_tokens_across_dp=[6048,6048]`，`num_tokens_padded=6048`，按 NONE 重新 dispatch 后返回 `BatchDescriptor(6048)`（`v:.../cudagraph_dispatcher.py#L278-L285`），`#L2996` 的 assert 通过。结论：**6048**。把表 `:481` 里的「见待核 2」删掉，待核只留 P2-6 末尾那句 |
| P3-4 | `:387-389` A6 待核 4 | 可以定案 | `va:.../acl_graph.py#L253-L256`：主模型 `is_draft_model=False`，所以 `need_sync=True`；`enable_enpu` 只在环境变量 `ENPU_ENABLE=true` 时为真（`va:.../model_runner_v1.py#L497-L500`）。结论：默认每次回放前都同步 |
| P3-5 | `:328-363` R1 两步算例 | 第 23 条说异步调度开着，但算例是按同步记账写的 | 异步下每步调度 token 数仍是 4（`num_tokens_with_spec + num_output_placeholders − num_computed_tokens`，`v:.../scheduler.py#L403-L407`；占位由 `v:vllm/v1/core/sched/async_scheduler.py` 的 `_update_after_schedule` 加 `1 + 草稿数`）。但 `num_computed_tokens` 的「4→8→6」是回退之后的逻辑值，时间上与下一步调度交错。建议在表头注明「按回退后的逻辑值记账，不体现异步时序」 |
| P3-6 | `:81` A5 第 8 条 | 「把第一个位置的输入嵌入清零」有歧义 | 代码按 `positions.eq(0)` 清零（`va:.../glm5_next_mtp.py#L108-L111`），是每条序列位置为 0 的 token，不是 batch 的第一行 |
| P3-7 | `:285-301` A6 第 15、17、18 条 | 只引了 upstream 的 forward 和 kernel，实际执行的是昇腾版本 | 昇腾 `AscendRejectionSampler.forward` 在 `va:vllm_ascend/sample/rejection_sampler.py#L146-L247`（顺序相同），`NO_DRAFT_PROBS → draft_prob = 1` 在 `va:vllm_ascend/ops/triton/reject_sample.py#L205-L213`。建议主引用换成昇腾，upstream 作对照 |
| P3-8 | `:409-411` B4 第 3 条 | 没说清不整齐时实际返回什么 | 不整齐时 FULL 查不到 key，最终返回的是未补齐的 `BatchDescriptor(num_tokens)`（`v:.../cudagraph_dispatcher.py#L328`）；文中写的 `num_reqs=min(num_tokens_padded,32)` 只是中间对象。建议补「→ 查不到 key，按原始 token 数 eager」 |
| P3-9 | `:38-40`、`:220-222`、`:397-399` 三处「做了什么」 | 初学者读不懂「进图」「eager」「logits」「bookkeeping」 | 首次出现时各加半句白话，例如「eager = 不用预先录好的图，每个算子现场下发」「logits = 词表上每个词的打分」。第 40 行「猜的那条路不进图，永远是 eager 跑」可以改成「猜 token 的那三遍不用录好的图，每次现场一个算子一个算子地发」 |
| P3-10 | `:312-314` A6 第 21 条 | 「`#L1005` 附近的注释」太含糊 | 改成精确的 `v:.../scheduler.py#L1005-L1008`（注释写明被拒后在 `update_from_output` 回调 `num_computed_tokens`），再加 `#L1427` |
| P3-11 | `:48-49`、`:179-180` | 函数名不准；通信不止一次 | L2730-L2809 是 `_calc_spec_decode_metadata`，不是 `_prepare_inputs`。「草拟每遍多一次 TP all-reduce」漏了草拟 lm_head 的 all-gather（`compute_logits` → `logits_processor._gather_logits`，`v:.../logits_processor.py#L75-L87`），也漏了 mtp_block 内部的通信，建议写成「至少多一次」并列出 |
| P3-12 | `:159`、`:262`/`:504` | 行号小偏差 | 采样结果回传走的是 `sample_tokens` 的 RPC（`v:vllm/v1/executor/multiproc_executor.py#L319-L326`），不是 `execute_model`（L307-L317）；dispatcher 的 NONE 早退 return 在 `#L285`，引用范围应为 `#L276-L285` |

## 待核补结论（用 official-config.json 与 checkpoint-shapes.json）

1. **MLA 头数与 rope 维度**（A5 待核 1）：`num_attention_heads = 64`，`qk_rope_head_dim = 0`，`mla_use_nope = true`，`num_key_value_heads = 64`，`qk_head_dim = 256`。昇腾 config 的默认值也是 64 / 0（`va:vllm_ascend/transformers_utils/configs/glm5_next.py#L23`、`#L49`）。checkpoint 第 45 层实测形状与此一致：
   - `q_a_proj [1536, 4096]` 与 `kv_a_proj_with_mqa [512, 4096]` 合并成 `fused_qkv_a_proj`，不切 TP（`va:.../glm5_next.py#L1918-L1925`，`disable_tp=True`）：2048 × 4096 = 8,388,608，每卡一整份。
   - `q_b_proj [16384 = 64×256, 1536]`，ColumnParallel：每卡 3,145,728。
   - `kv_b_proj [32768 = 64×(256+256), 512]`，ColumnParallel：每卡 2,097,152。
   - `o_proj [4096, 16384]`，RowParallel：每卡 8,388,608。
   - 索引器：`wq_b [4096 = 32×128, 1536]` 不切（ReplicatedLinear）；`wk [128,4096]` 与 `weights_proj [32,4096]` 合并，不切、`quant_config=None`；`index_kpool_compress_gate [128,4096]` bf16（`#L1263-L1291`）。
   - rope 维度为 0，所以 `_pad_nope_kv_a_weight` 不补零（`#L244-L251`）。
   - 每卡合计：MLA 投影 21 MiB（int8）/ 42 MiB（bf16）；索引器 8.25 / 14.25 MiB。
2. **`shared_head.head` 是否量化**（A5 待核 2）：这个问题不存在了。它就是主模型的 lm_head（P1-1）。
3. **`index_share_for_mtp_iteration`**（A5 待核 4）：config 值为 true，但 db701c1f 没有实现 `set_skip_topk`，开关不生效（P3-2）。
4. 附带：HF 原始 checkpoint 是 FP8（`quantization_config.quant_method = fp8`），`modules_to_not_convert` 列了第 45 层的 `eh_proj`、`kv_b_proj`、索引器与各 norm。部署用的是另一份 W8A8（`--quantization ascend`）权重，第 45 层哪些被量化要看那份权重的 `quant_model_description`，所以 P1-2 给的是区间。

## [C]/[D] 算式重算

| 位置 | 算式 | 重算 | 判定 |
|---|---|---|---|
| :146 | 154880 ÷ 8 | 19360 | ✓（154880 = 64 × 2420，ParallelLMHead 不再补齐） |
| :147 | 4096 × 19360 | 79,298,560 | ✓ |
| :148 | 1 × (3+1) | 4 | ✓ |
| :150 | 4 × 154880 × 2 B | 1,239,040 B = 1.18 MiB | ✓ |
| :151 | 3 × 154880 × 4 B | 1,858,560 B = 1.77 MiB | ✓（昇腾 forward 里 `raw_target_logits.to(torch.float32)`，`va:.../rejection_sampler.py` forward 第 47–48 行） |
| :152-153 | 128 × 154880 × 2 B | 39,649,280 B = 37.81 MiB | ✓ |
| :158 | 8 − 8 × 1 | 0 | ✓ |
| :165 | 8192 × 4096 × 2 B | 64 MiB | ✓ |
| :167 | 154880 × 4096 ÷ 8 × 2 B | 151.25 MiB | 算术 ✓，但不该计入（P1-1） |
| :168-169 | 3 × 4096 × 2048；× 18；+ 24 | 24 / 432 / 456 MiB | 前两项 ✓；共享专家应为 3 MiB，合计 435 MiB（P1-2） |
| :170 | 64 + 151.25 + 456 | 671.25 | 算术 ✓，结论 ✗，应为 ≈533–560 MiB（P1-2） |
| :174 | 45 + 3 × 1 | 48 | ✓ |
| :339 | 5+3−4 | 4 | ✓ |
| :348 | 4→8→8−(3−1) | 6 | ✓ |
| :349 | (4−1) − 2 | 1（位置 5） | ✓（按 `va:.../llm_base_proposer.py#L2063` 的公式） |
| :350 | 新草稿位置 | 7、8、9 | ✓（第 1 行输入是 x6 的嵌入加位置 5 的 hidden，预测位置 7） |
| :356 | 7+3−6 | 4 | ✓ |
| :358 | KV 写 6–9，覆盖 6、7 | — | ✓ |
| :361 | 6→10 | — | ✓ |
| :363 | 2×48=96；2+4=6；6/2=3 | — | ✓ |
| :368-369 | 32×4=128；最少 32 | — | ✓ |
| :424 | x//4 | 1/2/4/8/16/24/32 | ✓ |
| :432-442 | 11 行补齐表 | 0/0/4/12/28/16/0/28/0/28/0；0/0/25/37.5/43.75/25/0/29.17/0/21.875/0 % | ✓ |
| :448-450 | 12→16（4 格），48→64（16 格） | ✓ | 数字 ✓，「比例不变」泛化 ✗（P2-5） |
| :459-463 | 48→64，28→32，max=64，空跑 16 / 36 | ✓ | ✓（主模型）；草拟另见 P1-4 |
| :476-479 | 8192−48=8144；48+6000=6048 | ✓ | ✓（依赖 01 的「前缀缓存关、`mamba_cache_mode=none`」，否则 `va:vllm_ascend/patch/platform/patch_glm5_next_mamba_scheduler.py` 的对齐切块会把 6000 切开；01 `:536-538` 已核为不生效） |
| :487 | 13×4=52→64，空跑 12 | ✓ | ✓（与 01 `:387` 一致） |

## 跨文档一致性判定表

| 量 | 01 写法 | 02 写法 | 03 写法 | 源码 | 判定 |
|---|---|---|---|---|---|
| DP 补齐规则 | `:478-482`：引 upstream `coordinate_batch_across_dp → _run_ar`（4×dp 张量）；场景 M 的 all-reduce 结果写成 `[6048, 28]`；MoE 通信按最大值 6048 对齐 | `:581-583`：MoE 通信方式按 DP 最大 token 数选 | `:412-413`、`:465-468`：先按本地图尺寸补齐，再 `_sync_metadata_across_dp`；`allow_dp_padding` 为真的一侧补到最大值，模式取最小；步骤 B 为 `[6048, 32]` | `va:.../model_runner_v1.py#L2966-L2996`、`#L692-L740`；昇腾 runner 覆写了 `_determine_batch_execution_and_padding`，不调用 upstream 的 `coordinate_batch_across_dp`（只在 `#L2036` 注释里出现） | **03 对**。01 引的是被覆写、不执行的 upstream 函数；DP1 参与 all-reduce 的是本地补齐后的 32，不是 28。「通信按最大值对齐」三份一致。03 自己漏了草拟也按最大值补（P1-4） |
| 空闲组 `_dummy_run` | `:473`、`:501-503`：`_dummy_run(num_tokens=4, uniform_decode=True)`，`[6048, 4]` | `:813-815`：dummy 批次也补到 6048，具体 token 数交给 01 | `:491`：「`num_tokens = 0`」 | `va:vllm_ascend/worker/worker.py#L971-L972`；`decode_token_per_req=4`（`model_runner_v1.py#L652-L656`）；dummy 同样走 DP 同步（`#L3410`），并调用 `drafter.dummy_run`（`#L3642-L3650`） | **01 对，03 错**（P1-6）。三份都没写 dummy 也会跑草拟 |
| 图尺寸 | `:29`、`:196`：4/8/16/32/64/96/128 ↔ 1–32 请求 | `:15`、`:570`：同 | `:20`、`:422-426`：同，7 张全建 key | `v:.../cudagraph_dispatcher.py#L210-L236`；`v:vllm/config/compilation.py#L1475-L1518`（都是 4 的倍数，不变）；`va:vllm_ascend/platform.py#L547-L568`（`enable_sp` 为假，不改） | **一致** |
| MC2 / AllGather 切换 | 只提 MC2 组（`:22`、`:86`），没写切换条件 | `:553-583`：A2 上 `专家/卡 ≤ 24 且 EP ≥ 16 且 DP 最大 token ≤ 128` 走 MC2，否则 ALLGATHER；A2 没有 ALLTOALL | `:522`：「MoE all-to-all」 | `va:vllm_ascend/ascend_forward_context.py#L96-L97`、`#L202-L217`、`#L239-L252` | **02 对，03 措辞冲突**（P2-6）。附带：02 `:576` 的「任何一个 chunked prefill 混进来就翻到 ALLGATHER」只在 DP 最大 token 数 > 128 时成立，小 prefill 仍然走 MC2 |
| 块大小 | `:24`、`:112-142`：逻辑块 640 token（KDA 状态 561,152 B 决定），kernel 块 128 | `:429`、`:483`：「`block_size = 128`」，并说 cache_config 被对齐到 128（待核） | 未给数值 | `va:vllm_ascend/patch/platform/patch_mamba_config.py#L131-L164`：GLM5 分支强制 `cache_config.block_size = 128 × ceil(max(req, 128 × ceil(mamba_raw / (128×1024))) / 128)`；`va:vllm_ascend/ops/kimi_kda_state.py#L27-L31` 给出 conv (3072×6) bf16 + recurrent (8×128×128) fp32 = 36,864 + 524,288 = 561,152 B → 640 | **01 对**。02 把 kernel 块（128）当成了逻辑块；它的每页字节数只在「kernel 页」口径下成立。03 不涉及 |

另外发现一处跨文档冲突，不在指定清单里：共享专家每卡大小。02 `:100` 写 3.0 MiB，03 `:169` 写 24 MiB，**02 对**（P1-2）。

## 引用抽查清单（共 61 处）

✓ = 行号与内容都支持结论；△ = 内容支持，但行号偏移、只引了 upstream、或结论需要修正；✗ = 不支持结论。

| 引用（03 行） | 判定 |
|---|---|
| `v:gpu_model_runner.py#L814`（:18） | ✓ |
| `v:config/speculative.py#L713-L716`（:17） | △ 应为 L550-L554（P2-3） |
| `v:config/compilation.py#L59-L69`、`#L59-L90`（:19、:229） | ✓ |
| `va:configs/glm5_next.py#L52`、`#L11`、`#L336`（:24、:98） | ✓ |
| `va:glm5_next_mtp.py#L131-L142`、`#L127-L142`（:24、:80） | ✓ |
| `va:ascend_config.py#L320`、`#L511-L512`、`#L778-L781`；`va:envs.py#L75`；`va:utils.py#L905-L931`（:29-30） | ✓ |
| `v:gpu_model_runner.py#L4315-L4316`（:47） | ✓ |
| `v:gpu_model_runner.py#L2730-L2809`（:49、:284） | △ 函数名是 `_calc_spec_decode_metadata`（P3-11） |
| `va:model_runner_v1.py#L1492-L1578`（:50） | ✓ |
| `v:logits_processor.py#L75-L87`；`v:platforms/interface.py#L858-L862`（:54-55） | ✓（昇腾没有覆写 `use_all_gather`，已 grep） |
| `v:gpu_model_runner.py#L4346-L4420`；`va:model_runner_v1.py#L2373-L2427`（:57-58） | ✓ |
| `va:model_runner_v1.py#L2585-L2610`（:64） | ✓ |
| `v:gpu_model_runner.py#L3531-L3560`、`#L5067-L5071`（:65-67） | △ 内容对，推出的「没有该方法」✗（P2-1） |
| `v:sample/sampler.py#L72-L150`、`#L243-L302`（:69、:72） | ✓ |
| `va:sample/sampler.py#L20-L43`、`#L269-L302`（:75） | ✓ |
| `va:glm5_next_mtp.py#L94-L124`、`#L53-L57`、`#L122`、`#L165-L166`、`#L180-L183`、`#L79-L83`、`#L64-L77` | ✓ |
| `va:glm5_next.py#L2132`、`#L2195-L2209`、`#L216-L228`、`#L2107-L2115` | ✓ |
| `va:llm_base_proposer.py#L537-L550`（:93） | ✓ |
| `va:llm_base_proposer.py#L589-L596`；`v:model_arch_config_convertor.py#L252-L270`（:96-97） | ✗ 被昇腾补丁覆盖，结论相反（P1-1） |
| `v:gpu_model_runner.py#L4442-L4483`；`v:config/speculative.py#L1070-L1071`（:104） | △ upstream 行为，昇腾顺序不同（P2-2） |
| `va:model_runner_v1.py#L2438-L2460`、`#L1631-L1884`（:105） | ✓ |
| `va:llm_base_proposer.py#L1456-L1519`、`#L1472-L1485`（:108、:333） | ✓ |
| `va:llm_base_proposer.py#L2015-L2067`（:111、:316、:349） | ✓ |
| `va:llm_base_proposer.py#L1173-L1454`、`#L1290-L1299`、`#L1442-L1446`、`#L1158-L1171`、`#L1320-L1454`、`#L1332` | ✓ |
| `v:config/speculative.py#L717-L727`（:118） | ✓ |
| `v:gpu_model_runner.py#L4368-L4381`、`#L4462-L4463`、`#L4522-L4533`、`#L622-L630`（:126） | ✗ 对本部署不适用，被昇腾覆写（P1-5） |
| `va:llm_base_proposer.py#L141-L149`、`#L217`、`#L227-L236`、`#L266`、`#L598-L613`（:133、:136） | ✓ |
| `va:llm_base_proposer.py#L893-L916`（:139） | △ 漏了 `#L902-L906` 的 DP 同步（P1-4） |
| `v:multiproc_executor.py#L495-L509`、`#L307-L317`（:159） | △ 第二处应为 L319-L326（P3-12） |
| `v:gpu_worker.py#L305-L306`（:161） | △ 本部署跑的是 NPUWorker `va:worker/worker.py#L498-L499`（P2-4） |
| `vm:models/glm5next/mtp.py#L36`、`#L89-L98`（:186） | ✓ |
| `vm:llm_base_proposer.py#L113`、`#L241`、`#L251-L260`（:187-188） | ✓ |
| `v:cudagraph_dispatcher.py#L209-L236`、`#L214-L236`、`#L133-L158`、`#L76-L96`、`#L306-L327` | ✓ |
| `v:cudagraph_dispatcher.py#L276-L283`（:262、:504） | △ return 在 L285（P3-12） |
| `v:config/compilation.py#L1430-L1440`、`#L1475-L1518`、`#L1104-L1106` | ✓ |
| `v:config/vllm.py#L242-L262`（:239） | ✓ |
| `va:model_runner_v1.py#L3807-L3816`、`#L5330-L5340`（:241、:244） | ✓ |
| `v:gpu_model_runner.py#L6525-L6588`、`#L6584-L6589`（:243、:381） | ✓（从大到小：`v:cudagraph_dispatcher.py` 中 `get_capture_descs` 按 `reverse=True` 排序） |
| `va:acl_graph.py#L166-L231`、`#L232-L259`、`#L270-L290`、`#L138-L150`、`#L253-L257` | ✓ |
| `va:model_runner_v1.py#L2778-L2790`（:251） | ✗ 本模型 `use_sparse` 为真，路径被关掉（P1-3） |
| `va:model_runner_v1.py#L2915-L2941`（:257、:503） | ✓ |
| `va:model_runner_v1.py#L692-L739`、`#L5383-L5389`、`#L731-L738`、`#L2979-L2983`、`#L2974-L2996`、`#L2914`、`#L2953-L2966`、`#L2108`、`#L2265-L2290` | ✓ |
| `v:scheduler.py#L403-L407`、`#L212-L226`、`#L458-L466`、`#L519-L535`、`#L1738-L1757`、`#L1414-L1436`、`#L1427`、`#L408-L410`、`#L2061-L2080`；`v:request.py#L247-L248` | ✓ |
| `v:scheduler.py#L1005` 附近（:314） | △ 应精确到 L1005-L1008（P3-10） |
| `v:rejection_sampler.py#L88-L196`、`#L510-L565`、`#L715-L764`、`#L769-L830`、`#L663-L713`、`#L427-L433`、`#L249-L283`、`#L30`、`#L34`、`#L119` | ✓（upstream；执行侧见 P3-7） |
| `va:sample/rejection_sampler.py#L399-L470`（:301） | ✓ |
| `v:config/vllm.py#L957-L997`、`#L999-L1001`；`v:multiproc_executor.py#L511-L513` | ✓ |
| `va:llm_base_proposer.py#L246-L262`、`#L1208-L1220`、`#L189-L193` | ✓ / ✓ / △（实际在 L190-L194） |

## 写法评价（第 4 项）

- A6 和 B4 的「做了什么」初学者能读懂：「事先录成一张图，到点直接回放」「往上补齐到最近的一个捕获尺寸」都是白话。
- A5 的「做了什么」夹了未解释的术语：「logits」「进图」「eager」。第 40 行只用一个行话短句收尾（P3-9）。
- 没有发现用否定式免责句代替答案的情况。但有 5 处把能从源码定案的问题推给了「待核 / 实测」：A5 待核 1、2、4，A6 待核 4，B4 待核 2（P3-1 到 P3-4）。B4 的 M' 一句「细节属于 B1，此处只记……」把应给的数字推走了，而且给错了（P1-6）。
- 「本部署下的具体数字」各小节把算式和 [C]/[D] 标记分得很清楚，可复核性好。

## 未核 / 跳过

- A5 第 19 条「教程里 `"enforce_eager": true` 与代码覆盖同义」、`--seed 1024` 的教程出处：按约束没读 `GLM5.3-Flash.md`，无法代核。
- HANDBOOK、`wiki/concepts/glm-5-3-flash-two-node.md`：按约束没读。
- 部署实际用的 W8A8 权重的 `quant_model_description`（决定 MTP 层注意力 / 索引器是否量化、`is_rot_used`）：本地没有，所以 P1-2 给的是区间。
- 稀疏 MLA / KDA 的 attention metadata 在 FULL 图回放时怎样更新（P1-3 的后续）：没有继续追到 attention builder。
- 没有被拦截的命令或文件。
