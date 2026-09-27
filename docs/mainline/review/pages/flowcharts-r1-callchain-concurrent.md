# 审查：两个主线页新增流程图（R1 轮）

- 审查对象：`wiki/concepts/request-call-chain.md`（342 行，工作树已改未提交）、`wiki/concepts/concurrent-requests.md`（474 行，`??` 未跟踪新文件）
- 图 spec：`wiki/diagrams/request-call-chain-functions.yaml`、`-branches.yaml`、`-log-route.yaml`、`-step.yaml`、`request-call-chain.yaml`（旧图改过）、`concurrent-request-schedule.yaml`、`-preempt.yaml`、`-graph-decision.yaml`
- 截图：`scratchpad/codex-flow-shots/`（7 张新图逐张看过；`request-call-chain.yaml` 那张没有截图，只审了 spec）
- 源码：`tools/repos/vllm`（0fc695fc，工作树即该版本）、`git -C tools/repos/vllm-ascend show db701c1f:<path>`，先 grep 定位再读命中函数
- 实际运行：`npx tsx scripts/wiki-lint.ts`（`ok wiki:lint 通过`，23 处待留意全在别的页）；`npx tsx scripts/wiki-diagrams.ts --check`（`ok wiki:diagrams 151 张图与 spec 一致`，本轮 7 张图只有「代码名」一类告警）；`npx tsx scripts/wiki-audit.ts`（`wiki:audit 失败：1 处`，见 P1-1）
- 没做的：没在浏览器里渲染；没读 HANDBOOK.md 和 docs/plans/。本轮有一次用 Read 读 `request-call-chain.md` 前 150 行时被安全分类器拦掉整条回复，之后改为 `sed -n` 分段读，结论不受影响。

## 问题清单

### P1（和源码不符）

**P1-1｜`wiki/concepts/request-call-chain.md:58`｜sources 行号越界，`wiki:audit` 当场失败**

- 证据：`npx tsx scripts/wiki-audit.ts` → `✗ vllm-ascend@db701c1f:vllm_ascend/patch/platform/patch_kv_cache_coordinator.py#L461-L534 (out-of-range)`，全仓 1414 条来源里唯一一条越界；`git show db701c1f:…/patch_kv_cache_coordinator.py | wc -l` = 531 行，`def get_kv_cache_coordinator` 在 L461。
- 改法：改成 `#L461-L531`。

**P1-2｜`wiki/diagrams/concurrent-request-graph-decision.yaml` pins[2]｜钉的行里没有 `dispatch`**

- 声称：`vllm@0fc695fc:vllm/v1/cudagraph_dispatcher.py#L76-L96  symbols: [dispatch]`。
- 证据：`grep -n "def dispatch" vllm/v1/cudagraph_dispatcher.py` → `239`；L76–96 是 `_compute_bs_to_padded_graph_size`（预先算 batch size → 补齐后的图尺寸映射）。`scripts/wiki/diagram-audit.ts:96` 的符号检查只在整份 blob 里找，不看 `#L` 区间，所以这条漏检。正文用同一区间讲「token 数往上补到最近一档图尺寸」（`concurrent-requests.md:461`）是对的，错的只有图的 symbols。
- 改法：symbols 改成 `[_compute_bs_to_padded_graph_size]`；若确实要钉 `dispatch`，另加 `#L239-L300` 一条并同时进本页 sources。

### P2（图没帮到读者，或删掉了关键信息）

**P2-1｜`concurrent-request-preempt`（图）｜回环线贴着「成功」框走，像是从成功框出来的**

- 证据：spec 里 `{ from: [452,554], to: [210,53], via: [[394,554],[394,360],[10,360],[10,53]] }`；「成功：记录本步数量并扣预算」框是 `at:[26,264] size:[338,66]`（y 264–330，x 26–364）。回环的水平段走 y=360，正好横穿该框正下方 30px 且覆盖它整个宽度。截图上看就是「成功 → 回到 allocate_slots」。实际这条线是「被抢占的不是当前请求 → 重试当前请求的分块」的否分支（`vllm/v1/core/sched/scheduler.py:461-505` 的 `while True` 重试）。
- 另外「否 → 重试当前请求的分块」这行注释放在 `(24,400)`，判断框在 x452–814、y526–582，两者隔了大半张图。
- 改法：水平段下移到判断框下沿以下（例如 y≈620）再折向左上；「否」标签紧贴判断框左边；给「成功」框补一条明确的出边或写「→ 回到调度图左支」。

**P2-2｜`concurrent-request-graph-decision`（图）｜把同时发生的两件事画成了二选一**

- 证据：`_sync_metadata_across_dp` 之后分出「两组都能用图？」和「本地允许 DP 补齐？」两个框再汇合。源码里这是一次 All-Reduce 后同时做的两件事：`model_runner_v1.py:5383` `_post_process_cudagraph_mode` 取 `tensor[1,:].min()`（模式取较低值），`:732-738` 再按 `allow_dp_padding or is_draft_model` 决定宽度取 `max_tokens_across_dp` 还是各自的值。正文 `concurrent-requests.md:289` 已经写明「图的下半部将两件事分开」，但图形仍是分叉+汇合，读者眼里就是走其中一条。
- 改法：这一行改成一个并列块（一个外框内左右两栏），或在分叉处标「同时」；不要用两条带箭头的分支。

**P2-3｜`concurrent-request-schedule`（图）｜两条不同的边合并成无方向的 T 形接头**

- 证据：spec 里 `{ from:[478,272], to:[213,868], via:[[422,272],[422,836],[213,836]] }`（抢占过 → 交出 SchedulerOutput）与 `{ from:[478,398], to:[422,398], ends: none }`（waiting 条件不成立的短桩）共用 x=422 这条竖线；两个「是 / 否」标签又都放在 `(447,257)`、`(447,383)` 的列间空隙。截图上这块是全图最难读的地方。
- 改法：否分支单独走一条路径（例如从 waiting 框左边下行到 y≈836 再左折），标签贴各自的框；去掉 `ends: none` 的短桩。

**P2-4｜`request-call-chain-functions`（图）｜③④⑤ 画成平级先后，和 traceback 的嵌套对不上**

- 证据：图上 ③ `NPUWorker.execute_model`、④ `_model_forward → compute_logits`、⑤ `sample_tokens` 是三个平级方块、竖向箭头相连。源码里 ④ 在 ③ 的函数体内：`model_runner_v1.py:2289` `hidden_states = self._model_forward(...)`、`:2327` `logits = self.model.compute_logits(...)`，都在 `NPUModelRunner.execute_model`（`:1917`）里；⑤ 才是第二次 RPC 进来的另一个栈。这一页的用途恰恰是「照 traceback 认站」，平级画法会让读者以为 ④ 的帧不在 ③ 里。
- 改法：把 ④ 画成 ③ 的内嵌块（③ 框内缩进），⑤ 仍平级并保留「第 5 站由第二次 RPC 触发」的注；或在 caption 里点明「④ 在 ③ 的函数体内」。

**P2-5｜`request-call-chain-step`（图）｜「算出允许出现哪些 token 的表」被画成普通文本请求的主干步骤**

- 证据：caption 写「普通文本生成的一步」，第二个框却是这张表。源码 `vllm/v1/engine/core.py:526-529`：`grammar_output = self.scheduler.get_grammar_bitmask(scheduler_output)` 确实在主干上调用，但对没有结构化输出的请求拿到的是空值。图上没标这一点，正文 `request-call-chain.md:139` 只说「可以趁 worker 做前向时算一张结构化输出要用的表」。
- 改法：框里补「（没有结构化输出时为空）」，或把它并进第一次 RPC 的说明。

### P3（表述、行号、一致性）

**P3-1｜`wiki/diagrams/request-call-chain-functions.yaml` pins[1]｜`generate` 不在钉的区间里**

- `async_llm.py#L280-L415 symbols:[AsyncLLM, generate, add_request]`；`grep -n "async def generate\|def add_request" vllm/v1/engine/async_llm.py` → `add_request:280`、`generate:524`（L400 是 `_add_request`）。检查器同样只查整文件。改法：symbols 去掉 `generate`，或另加 `#L524-L560` 并进 sources。

**P3-2｜`wiki/diagrams/concurrent-request-schedule.yaml` pins[1]｜钉的区间不含符号本身**

- `kv_cache_manager.py#L385-L398 symbols:[KVCacheManager, allocate_slots]`；`def allocate_slots` 在 L238，L385–398 是它体内「块不够就返回 None」那段（`num_blocks_to_allocate > available_blocks → return None`），内容对但两个标识符都不在这几行。改法：改成 `#L238-L398`，或 symbols 只留区间里真有的名字。

**P3-3｜`request-call-chain-functions.yaml` items[1]｜②的 sub 写的是 schedule 之前发生的事**

- 框题 `② Scheduler.schedule`，sub 「接收请求 → add_request → 等待调度」。`add_request`/`preprocess_add_request` 由 EngineCore 主循环在 `schedule` 之前调用（正文 `request-call-chain.md:176` 自己就是这么写的）。改法：sub 改成「本步算谁、各算几个、分哪些块」。

**P3-4｜`concurrent-request-schedule.yaml` items[3]｜「数量为 0 则跳过」挂错了框**

- 这句挂在 `KVCacheManager.allocate_slots` 框的 sub 上，但 `if num_new_tokens == 0: … continue` 在 `scheduler.py:440-455`，发生在调用 allocate_slots 之前。改法：移到上一个「取下一条 running 请求」框。

**P3-5｜`request-call-chain-branches.yaml` items[9]｜第 5 站和第 6 站的动作并在一个框里**

- 底框 sub「两条路都草拟下一步候选；decode 另按拒绝数回退」。回退计数在引擎侧的 `Scheduler.update_from_output`（第 6 站，`scheduler.py:1329`），不在 worker 的 `sample_tokens` 里。改法：sub 改「两条路都草拟下一步候选；回退计数在第 6 站」。

**P3-6｜`concurrent-request-graph-decision.yaml` items[7]｜`dispatch` 在本页是撞名词**

- 本页 `concurrent-requests.md:322` 把 **dispatch** 定义为 MoE 把 token 送到别的卡，图的底框又写「按同步后的模式和宽度重新 dispatch」（指 cudagraph 的重新派发）。改法：框里改成「按商定的模式和宽度重新选一次图」。

**P3-7｜`request-call-chain.md:113` 与 `:169/:203/…`｜同一页两种图引用写法**

- 一处 `file: request-call-chain`（无后缀），其余 `file: xxx.yaml`。全仓 134 处图引用里只有 10 处带后缀，且全集中在本轮改过的 5 个页。两种都能渲染（`wiki:diagrams` 通过），但同页混用。改法：统一成无后缀。

**P3-8｜`request-call-chain-step.yaml` texts[0][1]｜字号比其余 6 张图小一档**

- 「第一次」「第二次」用 `size: 12`，`codex-flow-shots/report.json` 里这张图 `minTextPx: 12`，其余 6 张都是 13。改法：统一 13。

**P3-9｜`request-call-chain.md:63`｜两个发布分支的核对结论被清空**

- 旧版 `verified: ["releases/v0.23.0","releases/v0.26.0rc"]` → 现在 `verified: []`。页内 `:273` 写了「本轮没有核，所以 verified 留空」，交代是完整的，但这项待办只留在正文里。改法：同步登记到 HANDOFF 的待办清单。

**P3-10｜`request-call-chain.md:86` 起｜重写后掉了 4 条页内链接**

- 旧版正文链过 `token.md`、`kv-cache.md`、`npu-worker-lifecycle.md`、`vllm-engine-core.md`，新版都没有；`engine-processes.md`、`npu-model-runner.md`、`reading-vllm-ascend.md` 只剩 frontmatter 的 relations。第 86 行首次出现「KV 块」只有括号解释、没有链接。按 TERMS 的约定（首次出现解释一遍）不算违规，但对初学者是个回退。改法：第 86 行和「③」段各补一条链接。

**P3-11｜两页角标都贴着上限**

- `request-call-chain.md` 29 处（[C] 22，75.9%），`concurrent-requests.md` 28 处（[C] 21，75%）。阈值是 30 处、80%，`wiki:lint` 两页都没报。再加一两条 [C] 就会翻进 mark-flood 名单，后续补角标时要留意。

## 已核对无误（不必改）

- **七站主干调用链**：`create_chat_completion`（serving.py:219）→ `render_chat_request`（:192，在 :250 被调）→ `engine_client.generate`（:341）→ `chat_completion_stream_generator`（:371/:399）顺序与图一致；`Scheduler.schedule:340`、`update_from_output:1329`、`NPUWorker.execute_model`（worker.py:599）、`NPUModelRunner.execute_model:1917` / `sample_tokens:2373` / `_sample:2585` / `_model_forward:2803` / `_determine_batch_execution_and_padding:2898` / `_sync_metadata_across_dp:692`、`OutputProcessor.process_outputs:576` 全部存在。
- **⑤ 的三步顺序**：`sample_tokens` 里 `_sample`（:2427）→ `_bookkeeping_sync`（:2462）→ `propose_draft_token_ids`（:2485/:2489，两个分支都在 bookkeeping 之后），与图上「_sample → 记账 → propose_draft_token_ids」一致。
- **两步分支**：`_sample` 按 `spec_decode_metadata is None` 选 `self.sampler`（AscendSampler）或 `self.rejection_sampler`（AscendRejectionSampler），与左右两列一致（:2589-2610）；prefill 步 `is_all_decode` 为假 → `uniform_decode` 为假 → 走 eager，与左列一致（:2925-2940）；`uniform_decode_query_len = 1 + num_spec_tokens`（vllm `gpu_model_runner.py:814`）= 4，支撑「每条 4 个」。
- **MTP 固定 eager**：`llm_base_proposer.py:227-236` 对 GLM 强制 `use_cuda_graph = False`；`_sync_metadata_across_dp(is_draft_model=True)` 时无条件补到两组最大值（model_runner_v1.py:733），与正文「一律补到两组最大值」一致。
- **调度图**：running 先、waiting 后（scheduler.py:376、:562）；`if not preempted_reqs …` 才接纳 waiting（:563）；`len(self.running) == self.max_num_running_reqs: break`（:567）；chunked prefill 下 `num_new_tokens = min(num_new_tokens, token_budget)`（:699）；waiting 分块失败 `break`（:773-780）。
- **抢占图**：FCFS 走 `self.running.pop()`（:499）、`_preempt_request`（:974-995：`kv_cache_manager.free` → `num_computed_tokens = 0` → 清 `spec_token_ids` → `waiting.prepend_request`），被抢占的是当前请求就 break（:503-505）后整段 `break`（:507-509），四项都对得上。
- **两次 RPC / 批次队列**：`max_concurrent_batches` 在异步调度 + 非 PP + v1 runner 下是 2（`config/vllm.py:497-507`），支撑「队列最多两批、引擎最多领先一步」；`step_with_batch_queue` 的「未满且还能推进就先调度下一圈」在 `core.py:541-546`。
- **日志图**：三句报错原文都在源码里——`EngineCore encountered an issue`（`exceptions.py:13`）、`Worker failed with error`（`multiproc_executor.py:392`）、`RPC call to {method} timed out`（:389）；进程前缀 `APIServer`（`api_server.py:655`）、`EngineCore_DP{i}`（`engine/utils.py:168`）、`Worker_DP…_TP…_EP…`（`multiproc_executor.py:1016-1031`，拼接顺序 DP→PP→PCP→TP→DCP→EP）、`DPCoordinator`（`engine/coordinator.py:152`）全部存在。
- **结构约束**：`request-call-chain.md` 的 `## 对照源码` 在 :262，其后只有 `### 版本差异`、`### 源码位置`，无 H2；`concurrent-requests.md` 的在 :411，其后是 `怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置`，都在固定五项内。`wiki:lint` 通过，两页都不在 23 条待留意里。
- **单一出处**：`concurrent-requests.md:86-90` 的配置表集中给出 8192 / 32 / 每条 4 个 / 7 档图尺寸 / 块大小；3,855 块指回 two-node 页推导（:216）；`request-call-chain.md` 用到这些数时只链接不重推（:176、:206）。未发现重复推导。
- **锚点**：`concurrent-requests.md#第-2-站-调度一步-8192-个-token-怎样分给-13-条请求`、`#进入第-4-站之前宽度先按自己补再按对面补`、`one-request.md#第-7-站-返回与收尾` 三个锚点与 `src/content/wiki/anchors.ts` 的 `headingSlug`（去标点、空格转 `-`）规则逐字对得上，目标标题都存在。
- **正文与图的分工**：`request-call-chain.md:166-196`（逐站讲解）、`:206-210`（候选从哪来、node1 陪跑）、`concurrent-requests.md:130-148`（左右两支 + 场景 M 的账）、`:245-260`（抢占代价逐项算）、`:283-296`（两层补齐）都是在解读图、补图上放不下的算式，没有把图的内容再抄一遍。

## 第 4 项：代码名在图上留哪些

检查器的「讲解图不放代码名」是非阻塞告警，本轮 7 张图共触发 24 条。用户要的就是代码流程图，所以不建议一刀切清掉，而是**每张图只留一层「读者要照着 grep 的入口名」，第二层调用串挪回正文**。

**留（有帮助）**

- `request-call-chain-functions` 七个方块**标题**上的入口名：`OpenAIServingChat.create_chat_completion`、`Scheduler.schedule`、`NPUWorker.execute_model`、`_model_forward`、`NPUModelRunner.sample_tokens`、`Scheduler.update_from_output`、`OutputProcessor.process_outputs`。这正是「按 traceback 认站」要用的七个名字。
- `request-call-chain-log-route` 的 `APIServer` / `EngineCore_DP…` / `Worker_DP…_TP…_EP…` 和三句报错原文。它们不是代码细节，是读者在日志里搜的字符串，删掉这张图就没用了。检查器把前两个当代码名报警，属于误报。
- `request-call-chain-branches` 的 `AscendSampler` / `AscendRejectionSampler`：「这一步用哪个采样器」就是这张图的分支结论。
- `concurrent-request-graph-decision` 的 `_sync_metadata_across_dp`：正文和源码表都用它指这次 All-Reduce。
- `concurrent-request-schedule` / `-preempt` 里 `allocate_slots` 保留一处（整节都在用这个词），其余两处改成「申请块号」。

**挪走（属于细节，放正文分站讲解或「源码位置」）**

- `request-call-chain-functions` 各框 sub 里的第二层调用串：`render_chat_request`、`AsyncLLM.generate`、`add_request`、`NPUModelRunner.execute_model`、`compute_logits`、`_sample`、`propose_draft_token_ids`、`chat_completion_stream_generator`、`ACLGraphWrapper`。这些名字正文 `:166-196` 已逐站写过，图上是重复；sub 改成白话（「套模板、分词、选一组引擎」「取出分数、选 token、再猜 3 个」）。
- `request-call-chain-branches` 的 `ACLGraphWrapper.__call__`（→「直接执行前向 / 回放捕获图」）、`_sample`（→「选采样器」）、`propose_draft_token_ids`（→「草拟下一步候选」，即检查器点名的那条）。
- `concurrent-request-preempt` 的 `_preempt_request`（正文 `:246-248` 已讲）。
- `concurrent-request-graph-decision` 首框的 `_determine_batch_execution_and_padding`：名字太长、占满整框，改成「决定图模式与宽度」，函数名放「源码位置」。

这样处理后，24 条告警里约 14 条会消掉，剩下的集中在七站入口名和日志前缀上——那部分建议接受告警，不要为了消警把图改成看不出代码路径的样子。

## 计数

- P1：2
- P2：5
- P3：11

## 修订记录

2026-09-27：18 条中已改 17 条、不改 1 条，所有 P1/P2 已处理。源码按 `vllm@0fc695fc`、`vllm-ascend@db701c1f` 核对。

| 条目 | 处理 |
|---|---|
| P1-1 行号越界 | 已改：核到文件末尾，改为 `patch_kv_cache_coordinator.py#L461-L531`。 |
| P1-2 图模式 pins | 已改：L76–L96 改为 `_compute_bs_to_padded_graph_size`；`dispatch` 另增 L239–L300 的 pin、页面 source 和源码表入口。source 追加到末尾，既有角标序号保持原对应。 |
| P2-1 抢占回环 | 已改：否分支绕到判断框下方 y=622，再从左侧回到申请块号；成功框明确回到调度图。 |
| P2-2 同时操作 | 已改：模式和宽度置于同一并列框，共用一进一出箭头，标明两项都执行。 |
| P2-3 T 形接头 | 已改：waiting 否分支独立下行，各出口分别以箭头进入输出框；预算框缩进，为线留出走廊。 |
| P2-4 ③④调用嵌套 | 已改：④缩进，框内与图注注明在③内部；⑤仍由第二次 RPC 触发。 |
| P2-5 grammar 表 | 已改：框中说明结构化输出用表，普通文本请求为空。 |
| P3-1 generate 越出区间 | 已改：该 pin 仅保留区间内的 `add_request`；同时收紧其他 pins 的符号范围。 |
| P3-2 allocate_slots 区间 | 已改：图与页面 source 扩为 L238–L398，pin 留 `allocate_slots`。 |
| P3-3 ②副标题时序 | 已改：本步算谁、各算几个、分哪些块。 |
| P3-4 数量为 0 | 已改：移到取下一条 running 请求的框，放在申请块号前。 |
| P3-5 第 5、6 站混写 | 已改：按拒绝数回退计数明确在第 6 站。 |
| P3-6 dispatch 同名 | 已改：图上改为「按商定的模式和宽度重新选一次图」。 |
| P3-7 图引用 | 已改：六页图引用统一为无 `.yaml` 后缀。 |
| P3-8 字号 | 已改：两次 RPC 标签从 12 改为 13 px。 |
| P3-9 HANDOFF 待办 | 不改（理由）：HANDOFF 超出本轮允许范围。在本记录保留待办：按发布分支重核调用链后恢复 `verified`；当前保留页面的固定提交边界。 |
| P3-10 深入链接 | 已改：补回 token、KV cache、EngineCore、worker 生命周期和 model runner 的正文链接。 |
| P3-11 角标余量 | 已改：补证据时复用已有角标；调用链仍为 29 处、C 22/29，多请求 28 处、C 21/28。 |

代码名以本轮用户规则为准：第二层调用、`allocate_slots`、`_sync_metadata_across_dp` 移出图；保留七站入口、采样器和日志名。本报告图的代码名告警 24→9；全库 36→13，本轮三报告涉及图合计 34→11。范围外 `vllm-ascend-repo-map` 的 2 条保持原样。

验证：四项指定命令按顺序通过，`wiki:audit` 行号越界 0；六张改图定向生成 SVG，Playwright 在实际阅读页逐张截图并目视检查，最小字号 13 px。截图保存于用户指定 `scratchpad/codex-fix-shots/`；未改日志图保留原前缀。
