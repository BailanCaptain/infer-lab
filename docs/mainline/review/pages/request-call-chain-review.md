# 审查：wiki/concepts/request-call-chain.md

- 审查日期：2026-09-27
- 页面版本：工作区未提交版（333 行）
- 控制流核对：`vllm@0fc695fc`（本地 checkout 在该 commit）
- 执行侧核对：`git -C tools/repos/vllm-ascend show db701c1f:<path>`（本地 checkout 在 `baa023ad`，main 分支对照用它）
- 被跳过：HANDBOOK.md、docs/plans/ 下全部文件（按任务纪律未读）；主线底稿只用 grep 核对。本轮没有读取被安全分类器拦截的文件。

## 一、评分表

| # | 项 | 分 | 理由 |
|---|---|---|---|
| 1 | 开头交代本页讲什么 + 与 one-request 的分工 | 2 | L79 头一段就把两页的分工写死：one-request 管形状/字节/块数，本页管「代码在哪个进程、经过哪些函数、走什么通道」；L81 用一句话给初学者解释「调用链」就是 A 调 B、B 调 C，并点明 Python 报错打印的就是它。L161 再强调一次「数字一律去 one-request 查」。 |
| 2 | 七站落在哪个进程、进程间通道 | 1 | 三种进程 + DP 协调器的划分清楚（L89-93），四条通道各有定义和用途（L111-123），且每条都核得住。扣分有二：L90「两台机器各是一个完整的模型副本」是任务明令禁止且与本页 L109/L265 自相矛盾的错误说法（P1）；L165「这一站有三处被 patch 换过」漏了至少两处（P2）。 |
| 3 | 函数链是否准确（本页核心） | 2 | 抽查 25 处 `repo@commit:path#Lx-Ly`，行号与调用关系全部对得上（清单见第三节）。逐站的调用顺序与源码逐行一致，尤其 `execute_model` 内部 `_update_states`→空批次早返回→`_prepare_inputs`→`_determine_batch_execution_and_padding`→`_build_attention_metadata`→`set_ascend_forward_context`→`_model_forward`→`compute_logits`→`ExecuteModelState`→返回空值，和 `step_with_batch_queue` 的 schedule→execute_model→get_grammar_bitmask→sample_tokens→入队→`future.result()`→`update_from_output`，都是原样成立。 |
| 4 | 图是否在帮读者理解 | 2 | `request-call-chain.yaml` 是进程-站位地图：三类进程画成 frame，七个站带编号角标，实线=按序通道、虚线=集合通信，node1 单独画一行「空转一圈 / 跑一次空批次」——正是正文最难用文字说清的那两件事。`request-call-chain-step.yaml` 画一步之内的两次 RPC，并标出「分数先留在 worker 进程里」「队列里最多两批」。两张都不是装饰。唯一小毛病：两张图都用同一种数字角标，图二的 1/2 指「第一次/第二次 RPC」，容易和图一的站号串味。 |
| 5 | 分支差异（含 node1 陪跑）与按日志/报错认站 | 2 | 分支表（L199-205）每一格都落在具体函数的具体岔口上，不是空话；node1 段给了完整的陪跑链且解释了「看到 `_dummy_run` 是正常的」。认站部分给的是可直接 grep 的实物：四种日志前缀、三条固定报错原文、300 秒超时和环境变量名、集合通信「报错的卡不一定是出问题的卡」。都核实无误。 |
| 6 | 「一步之内发两次 RPC / 异步调度默认开着」 | 1 | 结论成立，且是本轮独立核过的（见第四节）。扣分在于：异步调度打开后真正被实例化的调度器类是 `AsyncScheduler`，这件事只出现在 L287 的源码位置小字里，正文第 2 站（L165）和第 6 站（L191）仍然只说 `Scheduler` / `BalanceScheduler`，读者拿本页去认 traceback 时对不上。 |
| 7 | 常见误解 | 2 | 五条，全部针对本页真正容易踩的坑（一次 HTTP ≠ 一次执行、worker 站不跑模型、第 3 站不全是 vllm-ascend、前端报错不是根因、node1 不空闲），每条都有正文段落兜底。 |
| 8 | 术语写法与首次出现是否有中文解释 | 1 | 写法合规：通用概念词句中小写（scheduler、worker、eager、future、custom op、patch、server），缩写与类名原样，类名一律行内代码，「请求」「权重」保留中文。抽 15 个看首次出现：data parallel、scheduler、ZMQ、msgpack、HCCL、gloo、RPC、logits、MTP、future、detokenizer、持久批次、结构化输出、SSE、prefill 全部当场给了中文解释（13 项满分）；TP（L117）、EP（L219）无解释无链接。 |
| 9 | 免责句占比 | 2 | 正文 276 句中含「不能/不等于/尚未/并非/不代表」的 4 句，占 1.45%，低于 3%。4 句全是解释性的（进程不能直接读对方变量、不能只看站号、栈里出现 vllm/ 不代表上游、ACL Graph 与 LAUNCH_BLOCKING 不能同时用），没有一句是推卸。 |
| 10 | 术语先用后解释 | 1 | KV（L79 先用，L90 才说「KV 块是存放已算历史的显存块」）；TP（L117 先用，全页无解释）；MoE（L109）、MLA（L152）、KDA（L153）、NPU（L91）、decode（L197）首次出现均无中文也无链接。 |

**总分：16 / 20**

## 二、问题清单

### P1

**P1-1｜事实错误＋违反明令禁止的说法**

- 位置：`wiki/concepts/request-call-chain.md:90`
- 问题：「这套部署开了 DP2（data parallel，数据并行），**两台机器各是一个完整的模型副本**，各自接一部分请求」。
- 证据：
  - 本部署开 `--enable-expert-parallel`、EP=16，288 个路由专家摊到全部 16 张卡上、每卡 18 个（`wiki/concepts/glm-5-3-flash-two-node.md:57`、`:251`）。任何一台机器都只有一半专家，不是完整副本。
  - 本页自己在 `:109` 写「MoE 层的专家分散在 16 张卡上，node0 的卡算 MoE 时要和 node1 的卡交换 token」，在 `:265` 把「node1 没接到请求就是空闲的」列为常见误解——与 `:90` 直接打架。
  - 兄弟页的正确写法是「两台机器各是一个执行组」（`glm-5-3-flash-two-node.md:36`）。
- 建议改法：改成「两台机器各是一个**执行组**（DP 组）：各有自己的调度器和 KV 块池，各自接一部分请求；但 MoE 的 288 个专家摊在 16 张卡上，所以哪一台都不是一份完整的模型，算 MoE 时必须两台一起参与」。

### P2

**P2-1｜第 2 站的 patch 清点少了至少两处**

- 位置：`wiki/concepts/request-call-chain.md:165`
- 问题：「这一站有三处被 patch 换过：按层把 KV cache 分组的函数、管 KDA 状态块的管理器，以及 `Scheduler` 这个名字本身」。实际落在第 2 站上的 patch 至少五处。
- 证据（`vllm-ascend@db701c1f:vllm_ascend/patch/platform/__init__.py` 无条件 import 的模块）：
  - `patch_kv_cache_utils.py`（`get_kv_cache_groups` 等）——页面已写；
  - `patch_mamba_manager.py:84`（`single_type_kv_cache_manager.MambaManager = AscendMambaManager`）——页面已写；
  - `patch_balance_schedule.py:718`（`vllm.v1.core.sched.scheduler.Scheduler = BalanceScheduler`）——页面已写；
  - **`patch_glm5_next_mamba_scheduler.py:60`**：`Scheduler._mamba_block_aligned_split = _mamba_block_aligned_split`，而这个方法正是在 `schedule()` 里被调用的（`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L437`、`#L722`）——直接改的是第 2 站的分 token 逻辑，页面没写；
  - **`patch_kv_cache_coordinator.py:523`**：`vllm.v1.core.kv_cache_coordinator.get_kv_cache_coordinator` 被换掉，而第 2 站分块正是经协调器走到 `BlockPool`——页面没写。
- 建议改法：把「三处」改成不点数的说法，并补上这两条，尤其 `_mamba_block_aligned_split`（它决定 KDA 模型每步怎么切 token，属于本页第 2 站最该知道的 patch）。

**P2-2｜异步调度打开后真正的调度器类是 `AsyncScheduler`，正文没说**

- 位置：`wiki/concepts/request-call-chain.md:138-144`（异步调度段）、`:165`（第 2 站）、`:191`（第 6 站）；只有 `:287` 的源码位置提了一句。
- 问题：本页的卖点是「照着它认 traceback 和类名」。异步调度开着时，`SchedulerConfig.get_scheduler_cls()` 返回的是 `AsyncScheduler`（`vllm@0fc695fc:vllm/config/scheduler.py#L168-L173`），它继承自 `Scheduler`（`vllm@0fc695fc:vllm/v1/core/sched/async_scheduler.py#L12`）并**重写了 `_update_after_schedule` 和 `_update_request_with_output`**（同文件 `#L19`、`#L43`）——恰好就是本页第 6 站 `:191` 描述的那两件事。读者按正文只知道 `Scheduler` 被 patch 成了 `BalanceScheduler`，在栈里/日志里看到 `AsyncScheduler` 会对不上号。
- 建议改法：在 L144 那段末尾加一句「打开异步调度后，引擎里实际实例化的调度器类是 `AsyncScheduler`（继承自被 patch 过的 `Scheduler`），第 6 站的追加与回退有一部分在它重写的 `_update_after_schedule` / `_update_request_with_output` 里」，并在第 6 站的函数串里带上这个名字。

### P3

**P3-1｜角标数目与写手自述不符**

- 位置：全页（角标集中在 `:275`–`:332`）
- 问题：写手报「27 处、[C] 占 77.8%」。实测 25 处（21 个 `[C]` + `[A]`×1 + `[D]`×2 + `[I]`×1），`[C]` 占 84%。
- 证据：`grep -o '\[[SCDAIM!][0-9]*\]'` 计数；21/27=77.8% 说明写手把分母记成了 27。
- 影响：约束「不超过 30 处」满足，`## 对照源码`（`:267`）之上零角标、之下 H2 为零、H3 只有「版本差异 / 源码位置」且顺序正确——三条硬约束全部通过。仅自述数字需更正。另：frontmatter 有 45 条 sources，只有 20 条被角标指到，其余 25 条无引用点（不违规，但可精简）。

**P3-2｜箭头的定义与实际调用关系有出入**

- 位置：`wiki/concepts/request-call-chain.md:161`（定义「箭头表示前一个函数调用了后一个」）、`:165`、`:163`
- 证据：
  - `KVCacheManager.allocate_slots` 并不直接调 `BlockPool.get_new_blocks`；`get_new_blocks` 的调用者是 `vllm@0fc695fc:vllm/v1/core/single_type_kv_cache_manager.py#L248`、`#L282`、`#L1192`，中间还隔着协调器。
  - `:163` 说「`add_request` 里做三件事」，实际 `input_processor.process_inputs` 在 `AsyncLLM.add_request` 里（`async_llm.py#L349` 一带），另两件在它调用的 `_add_request` 里（`async_llm.py#L400-L413`）。
- 建议改法：把箭头的定义放宽成「前一个沿这条路走到后一个（中间可能还隔着一两层）」，或在这两处补一层。

**P3-3｜「草拟三遍总是 eager」缺一句为什么**

- 位置：`wiki/concepts/request-call-chain.md:187`、`:204`
- 证据：结论成立，但原因是 GLM 专属硬开关——`vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L227-L236`：`if _is_glm_model(...): self.use_cuda_graph = False`，注释写明「GLM series models with speculative decoding currently do not support graph mode」。否则草稿模型是会被 `ACLGraphWrapper(..., runtime_mode=CUDAGraphMode.FULL)` 包起来的（同文件 `#L598-L612`）。
- 建议改法：加半句「这是 vllm-ascend 对 GLM 加投机解码这个组合的硬性覆盖，不是草稿层的通性」，并链到 one-request 的对应说明（`one-request.md:435`）。

**P3-4｜TP / EP 全页无解释，日志前缀表读不动**

- 位置：`wiki/concepts/request-call-chain.md:117`（TP 首次出现）、`:219`（`Worker_DP0_TP3_EP3`）、`:296`（`world_size − tp × pcp`）
- 问题：`:219` 要求读者从 `Worker_DP0_TP3_EP3` 认出「这张卡在各个并行组里的编号」，但 TP、EP 是什么，本页没给中文、没展开、也没链到 tensor-parallel / expert-parallel 页；`:296` 又冒出一个 `pcp`。
- 建议改法：`:117` 首次用 TP 时补「（tensor parallel，张量并行）」并链页；`:219` 补一句 EP 是专家并行；`:296` 的 `pcp` 补「prefill 上下文并行，本部署为 1」。

**P3-5｜`MultiprocExecutor` 在极端配置下会被换掉，可加半句**

- 位置：`wiki/concepts/request-call-chain.md:117`、`:253`、`:295`
- 证据：`vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_multiproc_executor.py:211` 把 `MultiprocExecutor` 换成 `AscendMultiprocExecutor`，但该模块的 import 被 `DYNAMIC_EPLB` / `EXPERT_MAP_RECORD` 两个环境变量守着（`patch/platform/__init__.py:47-48`），官方双机部署没有设这两个变量，且子类只重写了 `_init_executor`。**所以本页的写法在官方配置下是对的**，仅作备注：若有人开了 EPLB 会看到另一个类名。

**P3-6｜两张图的数字角标语义不同**

- 位置：`wiki/diagrams/request-call-chain.yaml`（badges 1–7 = 站号）与 `wiki/diagrams/request-call-chain-step.yaml`（badges 1–2 = 第一次/第二次 RPC）
- 建议改法：图二的两个角标改成「①②」以外的记号，或在 caption 里点明「这里的 1、2 是一步里的两次调用，不是站号」。

## 三、函数链抽查清单（25 处，全部通过）

控制流（`vllm@0fc695fc`）：

| # | 引用 | 核对结果 |
|---|---|---|
| 1 | `entrypoints/openai/chat_completion/serving.py#L219` | `OpenAIServingChat`（`#L83`）的 `create_chat_completion`；`#L250` 调 `render_chat_request`，`#L341` 调 `engine_client.generate` ✓ |
| 2 | `v1/engine/async_llm.py#L280` | `AsyncLLM.add_request`；`#L400` `_add_request` 里 `output_processor.add_request` → `engine_core.add_request_async` ✓ |
| 3 | `v1/engine/core_client.py#L1344/#L1365` | `add_request_async` 与 `DPLBAsyncMPClient` ✓ |
| 4 | `v1/engine/core_client.py#L515-L559` | `zmq.ROUTER` 发、`zmq.PULL` 收 ✓ |
| 5 | `v1/engine/utils.py#L1000` | `get_engine_zmq_addresses`：`client_local_only` 为假时走 `get_tcp_uri`，否则 IPC ✓ |
| 6 | `v1/engine/core.py#L484` | `step_with_batch_queue`；顺序 `schedule()`→`execute_model(non_block)`→`get_grammar_bitmask`→`sample_tokens(non_block)`→入队→`future.result()`→`update_from_output` ✓ |
| 7 | `v1/engine/core.py#L217-L218` | `step_fn = step if batch_queue is None else step_with_batch_queue` ✓ |
| 8 | `v1/engine/core.py#L1223/#L1233/#L1264/#L1268` | `run_busy_loop`→`_process_input_queue`→`_process_engine_step`→`self.step_fn()`，与页面 `:286` 一字不差 ✓ |
| 9 | `v1/engine/core.py#L819/#L341/#L1336/#L1836` | `preprocess_add_request`、`EngineCore.add_request`、`EngineCoreProc._handle_client_request`、`DPEngineCoreProc._handle_client_request` ✓ |
| 10 | `v1/engine/core.py#L1869/#L1898/#L1928` | `DPEngineCoreProc.run_busy_loop` 里 `execute_dummy_batch`；注释「only perform finish-sync all-reduce every 32 steps」证实「每 32 步」✓ |
| 11 | `config/vllm.py#L497-L507` | `max_concurrent_batches`：async + v1 runner + pp≤1 → 2 ✓ |
| 12 | `config/vllm.py#L958-L1002` | 自动判定链与 `logger.info_once("Asynchronous scheduling is %s.")` ✓ |
| 13 | `config/scheduler.py#L168-L173` | `get_scheduler_cls`：async 时返回 `AsyncScheduler` ✓ |
| 14 | `v1/core/sched/scheduler.py#L340` | `Scheduler.schedule` ✓ |
| 15 | `v1/core/sched/scheduler.py#L1329/#L1454/#L1695/#L1888` | `update_from_output`→`_update_request_with_output`→`_free_request` ✓ |
| 16 | `v1/core/kv_cache_manager.py#L238` / `block_pool.py#L333` | 两个方法都在，但不是直接调用关系（见 P3-2）△ |
| 17 | `v1/executor/multiproc_executor.py#L307/#L319/#L331/#L340` | `execute_model` / `sample_tokens` / `execute_dummy_batch` / `collective_rpc`，前两者都带 `VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS` ✓ |
| 18 | `v1/executor/multiproc_executor.py#L389/#L392` | `RPC call to {method} timed out.` 与 `Worker failed with error '...'` 原文 ✓ |
| 19 | `v1/executor/multiproc_executor.py#L495-L509` | `_get_output_rank` 返回 `world_size - tp_size * prefill_context_parallel_size`，本部署 8−8×1=0 ✓ |
| 20 | `v1/executor/multiproc_executor.py#L969/#L987/#L998` | `worker_busy_loop`、`WorkerProc hit an exception.`、`Worker_DP{}_PP{}_PCP{}_TP{}_DCP{}_EP{}` 拼名 ✓ |
| 21 | `v1/executor/multiproc_executor.py#L275-L285` | `monitor_workers` 打 `Worker proc ... died unexpectedly, shutting down executor.` ✓ |
| 22 | `v1/engine/exceptions.py#L9-L18` | `EngineDeadError` 文案与页面 `:240` 完全一致 ✓ |
| 23 | `v1/engine/output_processor.py#L576` + `async_llm.py#L637/#L660/#L675` | `_run_output_handler`→`get_output_async`→`process_outputs`→`detokenizer.update`→`queue.put` ✓ |
| 24 | `envs.py#L1647-L1648` | 超时默认 300 ✓ |
| 25 | `config/speculative.py#L34-L58`、`#L128` | `deepseek_mtp ∈ MTPModelTypes ⊂ EagleModelTypes`；`disable_padded_drafter_batch` 默认 False ✓ |

执行侧（`vllm-ascend@db701c1f`）：

| # | 引用 | 核对结果 |
|---|---|---|
| 26 | `worker/worker.py#L599/#L665/#L972` | `NPUWorker.execute_model` / `sample_tokens` / `execute_dummy_batch`（后者一行转 `model_runner._dummy_run`）✓ |
| 27 | `worker/model_runner_v1.py#L1917` 段内 | `_update_states`→早返回 `EMPTY_MODEL_RUNNER_OUTPUT`→`_prepare_inputs`→`_determine_batch_execution_and_padding`→`_build_attention_metadata`→`set_ascend_forward_context`→`_model_forward`→`compute_logits`→`ExecuteModelState`→`return None`，顺序与页面 `:167-:181` 完全一致 ✓ |
| 28 | `worker/model_runner_v1.py#L2373` 段内 | `_sample`→`_bookkeeping_sync`→`propose_draft_token_ids`（闭包）→ 打包 `ModelRunnerOutput` / `AsyncGPUModelRunnerOutput` ✓ |
| 29 | `worker/model_runner_v1.py#L692`、`#L2898` | `_sync_metadata_across_dp` 打 `2 × dp_size` int32 做 all-reduce，`dp_allreduce_on_npu` 为假时用 `get_dp_group().cpu_group`（gloo）；确由 `_determine_batch_execution_and_padding` 调用 ✓ |
| 30 | `ascend_config.py#L317` | `dp_allreduce_on_npu` 默认 `False` ✓ |
| 31 | `compilation/acl_graph.py#L138` | `ACLGraphWrapper.__call__` ✓ |
| 32 | `models/glm5_next.py#L1445/#L1881/#L2053/#L2245/#L2437` | `AscendGlm5NextMoE` / `AscendGlm5NextMLAAttention` / `AscendGlm5NextDecoderLayer` / `AscendGlm5NextModel` / `AscendGlm5NextForCausalLM` 全部实名存在；层内三分支确实按 `KimiGatedDeltaNetAttention`（上游名，运行时被换）、`AscendGlm5NextMLAAttention`、`AscendGlm5NextMoE` 分派 ✓ |
| 33 | `models/glm5_next_multimodal.py#L643/#L688` | `AscendGlm5NextForConditionalGeneration` 用 `architectures=["Glm5NextForCausalLM"]` 建文本模型 ✓ |
| 34 | `attention/sfa_v1.py#L135/#L563` | `AscendSFABackend` / `AscendSFAImpl` ✓ |
| 35 | `ops/kimi_kda.py#L169/#L244` | `AscendKimiGatedDeltaNetAttention.forward` ✓ |
| 36 | `ops/fused_moe/fused_moe.py#L288-L292` + `fused_moe_0_23_0.py#L142/#L420` | v0.23.0 分支确实从 `fused_moe_0_23_0` 再导出 `AscendFusedMoE`，`forward_impl` 在 `#L420`；页面 `:179` 与版本差异表的说法正确 ✓（附注：`AscendFusedMoE.__module__` 被改写成 `...fused_moe`，但 traceback 仍显示真实文件名，页面的提醒因此更有价值） |
| 37 | `utils.py#L690/#L768-L773` | `register_ascend_customop`：v0.23.0 时注册 `FusedMoE`→`AscendFusedMoE`、`KimiGatedDeltaNetAttention`→`AscendKimiGatedDeltaNetAttention`，最后 `CustomOp.register_oot` ✓ |
| 38 | `platform.py#L636-L646` | ACL Graph 与 `ASCEND_LAUNCH_BLOCKING=1` 互斥，报错文案提示看 `$HOME/ascend/log/debug` 的 plog ✓ |
| 39 | `platform.py#L650-L660`、`#L805` | `worker_cls` 设成 `vllm_ascend.worker.worker.NPUWorker`；`get_attn_backend_cls` ✓ |
| 40 | `models/__init__.py#L10-L24` 与 `baa023ad:#L82-L91` | `db701c1f` 指向 `models.glm5_next:AscendGlm5Next*`，main 指向 `models.glm5next.model:Glm5Next*`——版本差异表两格都对 ✓ |
| 41 | `__init__.py#L21/#L38` | `_ensure_global_patch` 与 `register` ✓ |
| 42 | `patch/platform/patch_balance_schedule.py#L49/#L717/#L718` | `class BalanceScheduler(Scheduler)`、`EngineCoreProc.run_engine_core` 与 `Scheduler` 名字双双被换 ✓ |
| 43 | `spec_decode/llm_base_proposer.py#L1173`、`#L227-L236` | `_run_merged_draft` 在位；GLM 强制 `use_cuda_graph=False`，「草稿三遍 eager」成立 ✓ |

## 四、异步调度结论是否成立

**成立。** 四个前提逐条核过：

1. 官方启动命令用 `--speculative-config` 的 `deepseek_mtp`（`wiki/concepts/glm-5-3-flash-two-node.md:259`），而 `deepseek_mtp ∈ MTPModelTypes ⊂ EagleModelTypes`（`vllm@0fc695fc:vllm/config/speculative.py#L34-L58`），所以不会被「投机解码方法不支持」那一支关掉。
2. `disable_padded_drafter_batch` 默认 `False`（`speculative.py#L128`），不会被第三支关掉。
3. `MultiprocExecutor.supports_async_scheduling()` 返回 `True`（`multiproc_executor.py#L512-L513`），不会被第四支关掉。
4. 模型是 generate 而非 pooling，不会被第一支关掉。

四支都不成立 → `else: async_scheduling = True`（`vllm/config/vllm.py#L997-L998`），于是 `max_concurrent_batches = 2`（`config/vllm.py#L497-L507`）、`batch_queue` 建起来、`step_fn` 指向 `step_with_batch_queue`（`v1/engine/core.py#L196-L218`）。页面「一步之内发两次 RPC、队列最多两批、引擎最多领先 worker 一步」的叙述与 `step_with_batch_queue`（`#L484-L598`）逐行对得上。

唯一没写进正文的后果就是 P2-2：调度器类变成 `AsyncScheduler`。

## 五、以初学者身份读完，最卡住的三处

1. **`:90` 那句「完整的模型副本」和 `:109`「专家分散在 16 张卡上」打架。** 第一次读到时会建立「一台机器能独立算完一条请求」的模型，紧接着 19 行后又被告知 node1 必须陪跑才凑得齐 MoE 通信——初学者只能二选一地猜，而这恰恰是整页「为什么 node1 要跑空批次」的地基。

2. **第 2 站到底跑的是哪个类。** 正文先说 `Scheduler.schedule`（表格 `:98`），再说名字被换成了 `BalanceScheduler`、但开关关着时又「直接调用原来的 `schedule`」（`:165`），然后在 `:287` 的小字里冒出第三个名字 `AsyncScheduler`。三个类名、两处开关，页面没有一句话把「所以我在 traceback 里会看到谁」讲死——而这正是读者打开本页的原因。

3. **日志前缀表要求读者解码 `Worker_DP0_TP3_EP3`，但 TP、EP 从没解释过。** `:219` 只说「名字里带的是这张卡在各个并行组里的编号」；初学者知道 DP 是数据并行（`:90` 给过），却不知道 TP、EP 是什么，也就没法据此定位「哪张卡」。`:296` 的 `world_size − tp × pcp` 又多出一个没露过面的 `pcp`，那一格基本读不动。

## 六、修订记录（2026-09-27，写手）

| 意见 | 处理 | 说明 |
|---|---|---|
| P1-1「完整的模型副本」 | **已改** | 改为「两台机器各是一个执行组（DP 组），各有调度器和 KV 块池；MoE 的 288 个专家摊在 16 张卡上，哪一台都不是完整模型，算 MoE 时两台必须一起参与」，与本页「R1 被分到了 DP0」段、常见误解末条、two-node 页 DP/EP 两行一致。底稿 01 的 9 处「副本」逐处核过，只改 B1「做了什么」1 处（其余 6 处是 scale 的 FP32 副本、2 处是 RFork 的扩副本，用法正确），01 文末已加修订记录。 |
| P2-1 第 2 站 patch 漏两处 | **已改** | 正文改为「五处」并列表；「对照源码」新增「第 2 站的五处 patch」表。补一处审查没提的前提：`_mamba_block_aligned_split` 只在 `mamba_cache_mode == "align"` 时被 `schedule` 调用（`vllm@0fc695fc:vllm/v1/core/sched/scheduler.py#L261-L263`），官方部署为 `none`，R1 路径上不执行，正文照实写了。`get_kv_cache_coordinator` 的替换版在 GLM 布局下落哪一支，写成待核。 |
| P2-2 `AsyncScheduler` | **已改** | 异步调度段末加一段；第 2 站、第 6 站函数串、「按报错链认站」表、对照源码的七站表都换成栈里真正出现的文件和方法（`scheduler.py` 的 `schedule`/`update_from_output`，`async_scheduler.py` 的 `_update_after_schedule`/`_update_request_with_output`）。父类是 `BalanceScheduler` 这一点由 `core.py#L106-L136` 的加载顺序推出，标 [I]，给了实证办法（打印 `__mro__`）。 |
| P3-1 角标数 | **说明** | lint 的 `EVIDENCE_MARK_RE` 含 `!`，原计数 27 = 21 C + 2 D + A + I + 2 !，写手自述无误。修订后 29 处，C 22 处，占 75.9%。未引用的 sources 保留：它们是上半（不许挂角标）各段的依据。 |
| P3-2 箭头定义 | **已改** | 定义放宽为「沿调用往里走，个别处隔一两层」；第 1 站拆成 `add_request` 与 `_add_request`；`allocate_slots` 与 `get_new_blocks` 之间补「各缓存组的管理器」。 |
| P3-3 草拟 eager 原因 | **已改** | 第 5 站与分支表补原因，对照源码加 `llm_base_proposer.py#L227-L236`。 |
| P3-4 TP/EP/pcp | **已改** | worker 条目里首次给出 TP、EP 的中文解释并链页；日志前缀条给出 `Worker_DP1_TP3_EP11` 的解码例；`pcp` 注明本部署为 1。评分项 10 列的 KV、MoE、MLA、KDA、NPU、decode 也都在首次出现处补了解释。 |
| P3-5 `AscendMultiprocExecutor` | **已改** | 进程边界表下加一段备注，附条件导入位置。 |
| P3-6 图二角标 | **已改** | 删去图二的 1/2 角标，靠「第一次/第二次」文字标注，已重新生成 svg。 |

验证：`pnpm wiki:lint` 通过（本页无提示）、`pnpm check:content` 通过、`pnpm wiki:diagrams --check` 140 张一致。本轮读取没有被拦截。

## 09-28 跨页修复：GLM 稀疏 MLA 的后端写错了

来源：`attention-backend-family` 的 P5 独立审查列出的跨页 P1（该页审查记录「问题清单」一节）。由 attention-backend-family 的写手对照 `db701c1f` 独立复核后修改，只动点到的两处及紧邻表述，块数相关文字一律未动。

**复核结论：审查员判对了，原文两处都要改。**

| 核查项 | 源码 | 结论 |
|---|---|---|
| GLM 的稀疏 MLA 层报出哪个后端 | `vllm_ascend/ops/indexer_kpool_mla.py#L78` 里 `IndexerKPoolMLACacheLayer.attn_backend = AscendIndexerKPoolMLABackend`，`#L136-L137` 的 `get_attn_backend` 返回它；该层在 `AscendIndexerKPoolMLAAttention.__init__`（`#L166`）里构造 | 层直接返回 `AscendIndexerKPoolMLABackend`，不是 `AscendSFABackend` |
| 这个后端和 SFA 是什么关系 | `attention/indexer_kpool_mla_v1.py#L521` `class AscendIndexerKPoolMLABackend(AttentionBackend)`，`get_name()` 返回 `"ASCEND_INDEXER_KPOOL_MLA"`；`attention/sfa_v1.py#L135` `class AscendSFABackend(AttentionBackend)` | 两者是**兄弟类**，不是继承、也不是包装 |
| 那为什么调用链里会出现 sfa_v1 | `indexer_kpool_mla_v1.py#L557` `class AscendIndexerKPoolMLAImpl(AscendSFAImpl)`（`sfa_v1.py#L563`）；元数据 `#L78` 继承 `AscendSFAMetadata`、构建器 `#L389` 继承 `AscendSFAMetadataBuilder` | **实现、元数据、构建器**继承自 SFA 的同名类，**后端类本身**不是。所以 `sfa_v1.py#L1994-L2028` 确实在 GLM 的执行路径上，但那是父类实现，不代表后端是 `AscendSFABackend` |
| 平台查表会不会被走到 | `platform.py#L805-L831` 的 `get_attn_backend_cls` 按 `(use_mla, use_sparse, use_compress)` 查表，`(True, True, False)` → `AscendSFABackend`；GLM 的三个缓存层都自己实现 `get_attn_backend()`，Runner 在 `model_runner_v1.py#L5052-L5059` 直接调层的方法 | GLM 的稀疏 MLA 层根本不经过这张表；表本身的映射没写错，错在把它套到 GLM 头上 |

改动：

| 位置 | 改成 |
|---|---|
| 正文第 3 站（原 L162） | 「走通用路径的模型建层时按 attention 类型向平台查询；GLM 的稀疏 MLA 不查这张表，由层自己返回 `AscendIndexerKPoolMLABackend`，它的实现类继承自 SFA 实现」 |
| 证据表「注意力后端」行（原 L339） | 保留平台表 `(True, True, False)` → `AscendSFABackend` 的描述但限定为"走通用路径的稀疏 MLA"，另写明 GLM 由层内部的缓存层返回 `AscendIndexerKPoolMLABackend`，后端类直接继承 `AttentionBackend`，只有实现、元数据、构建器继承自 SFA 同名类 |
| frontmatter sources | 末尾追加两条（不影响既有角标编号）：`vllm-ascend@db701c1f:vllm_ascend/ops/indexer_kpool_mla.py#L74-L82`、`vllm-ascend@db701c1f:vllm_ascend/attention/indexer_kpool_mla_v1.py#L521-L527` |

本页其他部分未动，块数（14/15 块）相关文字未动。验证见 attention-backend-family 的「P5 修订记录（09-28）」：`pnpm wiki:lint`、`pnpm wiki:diagrams --check`、`pnpm wiki:audit` 三项退出码均为 0。

## 09-28 跨页修复复审

复审人：新开的独立审查员（只审不改，本节是唯一改动）。范围：上节两处改写 + 两条新 sources、全库同类错误、linear-attention 的锚点。块数相关改动不在范围内。源码一律读 `vllm-ascend@db701c1f`。

**结论：写手的源码结论成立；改写后的两处没有事实错误，不再说 GLM 走 `AscendSFABackend`，也没有写成「完全不走 SFA」。剩 3 处 P3 措辞/术语问题，无 P1/P2。**

### 一、逐条核源码

| 写手的说法 | 独立核到的行 | 结论 |
|---|---|---|
| 两个后端是兄弟类 | `attention/indexer_kpool_mla_v1.py#L521` `class AscendIndexerKPoolMLABackend(AttentionBackend)`；`attention/sfa_v1.py#L135` `class AscendSFABackend(AttentionBackend)` | 成立 |
| 继承只发生在实现、元数据、构建器 | 同文件 `#L557` `AscendIndexerKPoolMLAImpl(AscendSFAImpl)`、`#L78` `AscendIndexerKPoolMLAMetadata(AscendSFAMetadata)`、`#L389` `AscendIndexerKPoolMLAMetadataBuilder(AscendSFAMetadataBuilder)`；`#L549` `get_impl_cls` 写死返回子类 | 成立 |
| 层自己返回后端 | `ops/indexer_kpool_mla.py#L78` `self.attn_backend = AscendIndexerKPoolMLABackend`，`#L83-L84` 用它的 `get_impl_cls()` 建 impl，`#L136-L137` `get_attn_backend` 原样返回；runner 在 `worker/model_runner_v1.py#L5052-L5053` 调 `layers[layer_name].get_attn_backend()` | 成立 |
| 不经过平台查表 | `platform.py#L805-L831` 的 `backend_map` 只有 `AscendMLABackend / AscendAttentionBackend / AscendSFABackend / AscendDSABackend` 四项，没有 IndexerKPool；GLM 稀疏 MLA 层由 `models/glm5_next.py#L2089` 建 `AscendGlm5NextMLAAttention` → `#L2018` 建 `AscendIndexerKPoolMLAAttention`（`ops/indexer_kpool_mla.py#L147` docstring：never constructs generic MLAAttention） | 成立：GLM 双机的 11 层稀疏 MLA + MTP 层都不查这张表 |

**实际 forward 走到 SFA 的哪些方法**（判断「完全不走 SFA」是否成立的依据）：

`AscendIndexerKPoolMLAAttention.forward` → `torch.ops.vllm.indexer_kpool_mla_forward`（`ops/indexer_kpool_mla.py#L200`、`#L253`）→ `wrapper.impl.forward`（`#L263`/`#L281`）→ `AscendIndexerKPoolMLAImpl.forward`（`indexer_kpool_mla_v1.py#L800`）→ 两个分支都 `super().forward(...)`（`#L810`、`#L848`，后者先把三份缓存重排成 `sfa_cache`）→ `AscendSFAImpl.forward`（`sfa_v1.py#L1650`）。

在 SFA 的 forward 主流程里：

- **沿用 SFA 父类的**：`fused_qkv_a_proj`（L1766）、`q_a_layernorm`（L1772）、`_q_proj_and_k_up_proj`（L1850）、`_get_full_kv`（L1919）、indexcache 的 topk 取/存（L1976/L1992）、`_v_up_proj`（L2004）、`o_proj` 及其切换（L2017/L2028），以及 `attn_metadata is None` 时的空跑分支。
- **被子类改写的钩子**（父类 forward 调到的是子类版本）：`_get_indexer_slot_mapping`（子类 L600）、`_store_indexer_cache`（L603）、`indexer_select_pre_process`（L705）、`exec_kv`（L744）、`rope_single`（L790）、`_execute_sparse_flash_attention_process`（L1065）、`indexer_select_post_process`（L1106）。

所以准确说法是：**后端类不是 SFA 的；forward 的骨架和 Q/K/V 上投影、输出投影是 SFA 父类的；写 KV、indexer 选 top-k、稀疏注意力算子这几步换成了 GLM 自己的。** traceback 里会先后出现 `indexer_kpool_mla_v1.py` 和 `sfa_v1.py` 两帧。

### 二、改写处的措辞

| 严重级别 | 位置 | 问题 | 影响 | 建议 |
|---|---|---|---|---|
| P3 | `wiki/concepts/request-call-chain.md#L341` | 「只有实现、元数据和构建器继承自 SFA 的**同名类**」：三者名字都不同（`AscendIndexerKPoolMLAImpl`←`AscendSFAImpl` 等），「同名」不对；「只有」也容易让人以为 SFA 只占很小一部分，实际 forward 主流程是 SFA 父类的 | 读者按「同名」去 sfa_v1.py 找同名类会找不到 | 改成「实现、元数据、构建器各自继承 SFA 的对应类（`AscendSFAImpl` 等）；forward 经 `super().forward` 走 SFA 的主流程，只换掉写 KV、indexer 选 top-k、稀疏注意力算子几步」。上节修复记录第 201、209 行的「同名类」同样应改 |
| P3 | `wiki/concepts/request-call-chain.md#L164` | 「不查**这张表**」：第 3 条前半句只说「向平台查询」，没出现过「表」，这张表在本段没有先行词（表在页末 L341 才出现） | 初学者读到「这张表」不知道指什么 | 前半句改成「按 attention 类型查平台的一张对照表」之类，先立「表」再说不查它 |
| P3 | `wiki/concepts/request-call-chain.md#L164`（新增「SFA 实现」） | 「SFA」在本页正文第一次出现就直接用，页内没有解释，`wiki/TERMS.md` 里也没有 SFA 条目 | 违反术语先讲后用 | 首次出现处加一句中文解释（昇腾稀疏注意力的通用实现），或链到后端家族页讲 SFA 的位置 |

改写处前后 30 行的连带问题（不是本次改动引入，顺带记录）：

| 严重级别 | 位置 | 问题 | 建议 |
|---|---|---|---|
| P3 | `wiki/concepts/request-call-chain.md#L325` 第 4 站「往下调」 | 写 `AscendGlm5NextDecoderLayer` → `AscendSFAImpl`，跳过了 `AscendGlm5NextMLAAttention` → `AscendIndexerKPoolMLAAttention` → `torch.ops.vllm.indexer_kpool_mla_forward` → `AscendIndexerKPoolMLAImpl.forward` 这几帧。`AscendSFAImpl.forward` 确实在栈上，所以不算错，但本页说「按报错看出错那一帧的文件路径」，而 GLM 报错最先落到的 impl 文件是 `indexer_kpool_mla_v1.py`，表里没有；改完 L164 后读者还会觉得这一格和第 3 条对不上 | 改成 `… → AscendIndexerKPoolMLAImpl.forward` → `AscendSFAImpl.forward`（父类） |

新增 sources 两条（`ops/indexer_kpool_mla.py#L74-L82`、`attention/indexer_kpool_mla_v1.py#L521-L527`）行号在范围内，覆盖了正文引用的 L78 和 L521；正文 L341 里的 `ops/indexer_kpool_mla.py#L78`、`#L136-L137` 没带 `vllm-ascend@db701c1f:` 前缀，与页内其他路径写法不一致，不影响校验。

### 三、全库还有没有把 GLM 说成走 `AscendSFABackend`

`grep -rnE 'AscendSFABackend|SFA 后端|SFA后端' wiki`，另查 `GLM.*SFA|SFA.*GLM` 与 `AscendSFAImpl`，逐条看上下文：

| 页 | 行 | 判断 |
|---|---|---|
| `concepts/attention-backend-family.md` | 193 | 版本差异表的 **main（baa023ad）** 列：main 里 GLM 改用上游 `MultiHeadLatentAttentionWrapper`（`baa023ad:vllm_ascend/models/glm5next/attention.py#L22`、`#L301`），不再有 IndexerKPoolMLABackend，回到平台表。说的是另一版本，不是同类错误 |
| `concepts/npu-platform.md` | 171（及 138、157） | 正确：通用查表与「GLM 侧的直接绑定」分开写 |
| `params/sfa-dcp-force-tmajor-restore-6d9c266d3ece.md` | 26、87 | 讲 SFA 的 DCP 子类与 Qwen3 旧算例，没说 GLM |
| `params/enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md` | 84 | 同上，Qwen3 旧算例 |
| `raw/kv-cache-sparse-offload.md` | 212、226 | 原始资料，讲 SFA 卸载，没提 GLM |
| `concepts/kv-cache-memory-profiling.md` | 194 | 「SFA 在 `attn_metadata is None` 时 `output.fill_(0)`」：GLM 子类在 None 时直接 `super().forward`，确实走这一支，正确 |
| `concepts/block-table.md` 244、`kv-cache.md` 235、`kv-cache-spec.md` 287/321、`context-parallel.md` 97 | — | 只用 `GLM5_SFA_KERNEL_BLOCK_SIZE`、SFA 的 DCP 条件等名字，没说 GLM 的后端是 `AscendSFABackend` |

**全库没有第二处同类错误。**

### 四、linear-attention 的锚点

`wiki/concepts/linear-attention.md#L235` 由 `#kda-路径使用递推和卷积状态` 改成 `attention-backend-family.md#放到-glm-双机一个-token-走过-45-层要问-45-次`。目标页 `attention-backend-family.md#L89` 标题是「## 放到 GLM 双机：一个 token 走过 45 层，要问 45 次」，按前端 `src/content/wiki/anchors.ts#L11-L13` 的规则（转小写、去掉非字母数字连字符空格的字符、空格换 `-`），全角「：」「，」被去掉，得到的 id 与链接完全一致，全页只有这一个同名标题，**能解析**。该节 L97（KDA 行报出 `AscendGDNAttentionBackend`）与 L100 正好解释 GDN/KDA 类名与算法的关系，与链接处「类名不能证明算法」对得上。

### 五、命令

| 命令 | 退出码 | tail |
|---|---|---|
| `pnpm wiki:lint` | 0 | `ok wiki:lint 通过（另有 17 处待留意）`；17 处里没有 request-call-chain 与 linear-attention |
| `pnpm wiki:audit` | 0 | `行号有效 2176 … 行号越界 0`；`ok wiki:audit 本地引用与行号校验、名单页写作标准通过` |

### 六、没核的

- 上节修复记录说「GLM 的三个缓存层都自己实现 `get_attn_backend()`」：只核了 `IndexerKPoolMLACacheLayer`（`ops/indexer_kpool_mla.py#L136`）和 `AscendGlm5NextIndexerKPoolCache`（`models/glm5_next.py#L306-L307` 返回 `_get_indexer_kpool_backend()`），`AscendGlm5NextCompressorStateCache`（`#L312`，继承 `CompressorStateCache`）没核。
- 没开浏览器看渲染（任务要求不起服务）；锚点按前端 slug 源码推算。
- 没读 HANDBOOK、docs/plans/、TERMS.md 全文（只 grep 了 SFA 条目）。没有工具调用被拦。

### P3 收尾（09-28）

复审留的 3 条 P3 已改，另核了一处未核说法。只动点到的两段及紧邻表述，块数文字未动。

| 条目 | 处理 |
|---|---|
| P3-1 L341「同名类」措辞含糊 | **已改**：写成「该后端直接继承 `AttentionBackend`，和 `AscendSFABackend` 是兄弟类；继承只发生在下一层——实现类 `AscendIndexerKPoolMLAImpl` 继承 `AscendSFAImpl`，元数据类和它的构建器同样各自继承 SFA 的对应类」。四个类的位置：`indexer_kpool_mla_v1.py#L521`（后端）、`#L557`（Impl）、`#L78`（Metadata）、`#L389`（MetadataBuilder）；`sfa_v1.py#L135`（`AscendSFABackend`）、`#L563`（`AscendSFAImpl`） |
| P3-2 L164「这张表」没有先行词 | **已改**：前半句补「平台用一张按注意力类型查后端的表回答」，后半句的「这张表」才有指代。该表即 `platform.py#L805-L831` 的 `get_attn_backend_cls` |
| P3-3 SFA 首现未解释 | **已改**：L164 首现处补「SFA 即昇腾这边稀疏注意力的那套实现，`sfa_v1.py` 里的类名、方法名和设备算子名都写作 sparse flash attention」。没有把 SFA 断言成官方缩写，只陈述源码里的命名（`AscendSFAImpl._execute_sparse_flash_attention_process`、`device_op.py#L688` 的 `torch.ops._C_ascend.npu_sparse_flash_attention`） |

**补核 `CompressorStateCache`（上节说「GLM 的三个缓存层都自己实现 `get_attn_backend()`」里没核的那个）：说法成立，无需改。**

- 它是上游 vLLM 的类，不是昇腾的：`vllm@0fc695fc:vllm/models/deepseek_v4/compressor.py#L121` `class CompressorStateCache(torch.nn.Module, AttentionLayerBase)`，基类版本的 `get_kv_cache_spec` 返回 `SlidingWindowMLASpec`、`get_attn_backend` 返回 `CompressorBackend`（`#L157-L174`），`forward(self): ...` 为空。
- GLM 在它之上派生：`vllm-ascend@db701c1f:vllm_ascend/models/glm5_next.py#L312` `class AscendGlm5NextCompressorStateCache(CompressorStateCache)`，**两个方法都被覆盖**——`get_kv_cache_spec` 改返回 `AscendIndexerKPoolStateSpec`（`#L352-L362`），`get_attn_backend` 改返回 `_get_indexer_kpool_state_backend()`，即 `AscendIndexerKPoolStateBackend`（`#L364-L365`）。
- 它在 GLM 路径上的角色：由 indexer 在 `#L1298` 构造（`self.state_cache`），是 kpool 尾状态那一份缓存的持有者，前向为空，只为让 Runner 按它自己的缓存规格分配和管理这份缓存。加上 `IndexerKPoolMLACacheLayer`（`ops/indexer_kpool_mla.py#L136-L137`）与 `AscendGlm5NextIndexerKPoolCache`（`glm5_next.py#L306-L307`），三个缓存层确实各自返回自己的后端，上节的说法成立。

验证：`pnpm wiki:lint` 退出码 0（`ok wiki:lint 通过（另有 17 处待留意）`，17 处中无本页）；`pnpm wiki:audit` 退出码 0（`行号越界 0、文件不存在 0`，名单 40 页全部达标）。未起服务、未提交 git。

- **修正（2026-10-02，主会话裁定，随 speculative-decoding 审查 P2-1）。** 正文 L335「草拟总走 eager」一条原写成无条件打 GLM 警告；按 `vllm-ascend@db701c1f:vllm_ascend/spec_decode/llm_base_proposer.py#L217`、`#L227-L236`，警告包在 `if self.use_cuda_graph:` 里，只在草稿原本要录图（没写 `enforce_eager: true`）时打，官方双机命令写了，所以不打。已改成一句话加链接到 speculative-decoding 的 GLM 双机一节，口径同底稿 03 §A5-17；只改这一处。改后 `pnpm wiki:lint`、`pnpm wiki:audit` 退出码均为 0。
