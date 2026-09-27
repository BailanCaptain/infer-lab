# 审查：三个主线页本轮新增的流程图与精简文字（r1）

- 审查对象：`wiki/concepts/one-request.md`、`wiki/concepts/glm-5-3-flash-two-node.md`、`wiki/concepts/glm-5-3-flash.md`（工作树当前版本，未提交）；新图 `wiki/diagrams/one-request-finish-flow.yaml`、`glm-two-node-request-route.yaml`、`glm-flash-indexer-flow.yaml`、`glm-flash-mtp-flow.yaml`；GPT-6 Astra 的截图 `scratchpad/codex-flow-shots/*.png` 与 `report.json`。
- 源码：控制流读 `tools/repos/vllm`（`0fc695fc`）；执行侧用 `git -C tools/repos/vllm-ascend show db701c1f:<path>` 读。
- 主线底稿：只用 grep（`01-deploy-entry-schedule.md` 第 566–570、746–747、776 行；`02-forward.md` 第 33 行；`03-sample-decode.md` 第 297、714 行）。
- 改动前的基线：`one-request.md` 的 `HEAD` 是整页重写前的 Qwen 旧页，两张 GLM 页还没入库，`git diff` 看不出本轮精简了什么。本轮改用 Codex 会话记录 `~/.codex/sessions/2026/09/27/rollout-2026-09-27T13-34-56-…jsonl` 里的 `apply_patch` 补丁作为「改前 / 改后」对照，抽出的补丁文本放在 `scratchpad/codex-c2-patches-clean.txt` 第 528–614 行。
- 实际运行：`pnpm -s wiki:diagrams --check` 退出码为 0，4 张新图只有「代码名」提示，详见第四节；`pnpm -s wiki:lint` 输出「ok wiki:lint 通过（另有 23 处待留意）」，这三页不在待留意之列。
- 没做的：本轮没有自己起浏览器渲染，第 2 项只依据 Astra 的截图和 `report.json`。没有读 HANDBOOK.md 和 docs/plans/。没有读取被拦截。

## 一、结论速览

| 级别 | 数量 | 条目 |
|---|---|---|
| P1 | 1 | P1-1 |
| P2 | 3 | P2-1、P2-2、P2-3 |
| P3 | 12 | P3-1 至 P3-12 |

四张图的主干节点、分支条件和数字都对得上源码。只有索引器图出了问题：它和页末源码表指向的实现只被单测调用，不在运行路径上。文字精简丢得最多的是两处：two-node 的路线图漏掉了机内 TP 一段，glm 页的索引器段丢了「怎样打分」，还留下一句「下面五步」，可图里已经没有编号步骤了。

## 二、问题清单

### P1-1　索引器图的出处和页末源码表指向单测专用的参考实现，版本差异里关于 decode 算子的说法与源码不符

- **位置**：`wiki/diagrams/glm-flash-indexer-flow.yaml` 第 26–27 行（pins：`expand_pools_to_tokens`、`append_tail_to_topk`）；`glm-5-3-flash.md` 第 173 行（本轮新写）、第 349 行、第 364–365 行（[C13]、[C14]）；`one-request.md` 第 595 行（[C14]）。
- **问题**：
  1. 图的出处和源码表都指向 `glm5_next.py` 里 `AscendSparseAttnIndexerKpool` 的一组静态方法：`kpool_compress_and_write_cache`、`expand_pools_to_tokens`、`append_tail_to_topk`、`indexer_kpool_topk_pytorch`、`bf16_mqa_logits`、`indexer_kpool_topk_decode`。在 `db701c1f` 里，这组方法只被单测调用，推理时不执行。
  2. 第 173 行说「融合算子负责压池和选择；展开与尾部的 Python 定义保留在页末源码表」，读者会以为展开和补尾是那两个 Python 函数做的。实际上选池、展开、补尾都在同一个运行时算子里完成。
  3. 第 349 行说「decode 用的融合算子 `npu_lightning_indexer` 里有没有 ReLU，待核」。但 GLM 的执行路径不调用 `npu_lightning_indexer`，两条运行路径的打分都没有 ReLU，这一条可以定案。
- **证据**：
  - 执行入口 `glm5_next.py` 第 1140–1232 行 `forward_ascend`：第 1201 行调用 `torch.ops.vllm.glm5_next_kpool_state_compress_and_write_cache`，第 1221 行调用 `torch.ops.vllm.glm5_next_lightning_indexer`。
  - 后者的实现在 `vllm_ascend/ops/glm5_next_lightning_indexer.py` 第 419–487 行。NPU 上满足 `TRITON_MAX_POOL_TOPK = 512`（第 19 行）时走 `ops/triton/glm5_next_lightning_indexer.py` 第 131 行起的 triton 路径：第 173 行按头权重合成 `qbar`，第 122 行 `scores = tl.sum(k_tile * qbar[None, :], axis=1)`，没有 ReLU；第 161 行 `topk = min(pool_topk, max_pool_seq_len)`；第 209 行选池，第 229 行补尾。回退路径在同文件第 464–487 行（`_pool_topk` → `_expand_pools_to_tokens` → `_append_tail_to_topk`），第 172–173 行同样没有 ReLU。
  - `git grep` 查到的调用方：`indexer_kpool_topk_decode` 只在 `tests/ut/models/test_glm5_next_indexer_kpool_mla.py:1250` 出现；`expand_pools_to_tokens` 在第 1172、1837 行，`append_tail_to_topk` 在第 1195、1849 行，`indexer_kpool_topk_pytorch` 在第 1543、1564、1825 行，`kpool_compress_and_write_cache` 在第 1592、1921 行，全部是测试文件；`vllm_ascend/` 下没有调用方。
- **建议改法**：
  - 把图的 pins 和 [C13]、[C14] 改成运行路径：`glm5_next.py#L1140-L1232`、`ops/glm5_next_kpool_state_compress.py#L210-L293`、`ops/glm5_next_lightning_indexer.py#L419-L504`、`ops/triton/glm5_next_lightning_indexer.py#L131-L237`。
  - 第 173 行末句改为「压池由一个融合算子完成，选池、展开和补尾由另一个算子一起完成」。
  - 第 349 行改为定论：「本基线的运行路径先按头权重合成查询再点乘，没有 ReLU」，删掉 `npu_lightning_indexer` 的待核。
  - `one-request.md` 第 595 行同步修改。
  - 静态方法如果还想保留作「读起来更直观的参考实现」，要在表里注明「单测用，不在推理路径上」。

### P2-1　two-node 的路线图漏掉机内 TP 一段，引导句「每一步都有单独的页展开」随之失效

- **位置**：`glm-5-3-flash-two-node.md` 第 131–141 行；`glm-two-node-request-route.yaml` 第 10 行。
- **问题**：原来的 6 步清单（补丁第 564–569 行）每步都挂着链接：data parallel、vLLM scheduler、tensor parallel、expert parallel。第 4 步还写明「每层 attention 和稠密层算完，在机内 TP 组里做一次 All-Reduce」。新图只画了选 DP 组和 MoE 跨机两件事，TP 组在这条路线上根本没出现，被选中的组只写了「EngineCore 调度 → 本机 worker 执行」。可第 133 行仍然说「把上面的分组串起来……每一步都有单独的页展开」：图里没有 TP，节点也挂不了链接。另外，本页已不再链接 `vllm-scheduler.md`。
- **证据**：见补丁第 564–576 行；当前页第 133 行；`grep` 结果显示 `tensor-parallel.md`、`expert-parallel.md` 只在第 250–253 行的参数表里出现。
- **建议改法**：
  - 在「被选中的 DP 组」和 MoE 之间加一格：「本机 8 卡 · 每层 attention 与稠密层后 TP All-Reduce」。
  - 第 133 行删掉「每一步都有单独的页展开」，或者在图下用一行把各节点对应的页列出来：DP 选组、scheduler、TP、EP。
  - 如果考虑画面宽度，可以把图改成「选组 → 本机 TP → 跨机 EP → 回前端」四段横排。

### P2-2　glm 页索引器段留下一句失效的引导语，「哪几步沿用 DSA、哪几步是 GLM 加的」对不上图了

- **位置**：`glm-5-3-flash.md` 第 165 行。
- **问题**：第 165 行仍写「下面五步里，第 1 步的结构……第 3 步的打分方式和第 5 步沿用 DSA；第 2、4 步和按池挑是 GLM 加的」。五步编号清单已经换成了图（补丁第 583–587 行被删），而图有 7 个节点、没有编号，读者对不上号。这句话本来是本段的要点，GLM 相对 DSA 改了什么就靠它讲清楚。另外，按 P1-1 的证据，运行路径的打分没有 ReLU，「第 3 步打分方式沿用 DSA」也不准确。
- **证据**：当前页第 165–169 行；图的 yaml 第 6–13 行没有编号，也没有用颜色区分哪些节点来自 DSA。
- **建议改法**：
  - 二选一：在图上把 GLM 新增的节点（压池、按池挑、展开、补尾）标成另一种颜色，或者加「GLM 新增」角注；或者把第 165 行改写成按节点名说：「投影 Q、K 和头权重、主 attention 沿用 DSA；压池、按池挑、补尾是 GLM 加的；打分去掉了 ReLU」。

### P2-3　索引器「怎样给池打分」在图和文字里都没有了

- **位置**：`glm-flash-indexer-flow.yaml` 第 6、8 行；`glm-5-3-flash.md` 第 171–175 行。
- **问题**：
  - 旧文（补丁第 583–586 行）写了三件事：每个头有一个由当前 token 算出的权重（4096 → 32）；池分等于 32 个头各算 q · k 再按头权重相加；「每个查询最多读 2048 + 3 = 2051 个历史位置」。
  - 新文只剩「完整池按查询得分挑选」，图的第一格只写「投影出索引器 Q、K 和池内得分」，头权重没有了。「池内得分」是压池用的门控，和给池打分是两回事，初学者容易把两者当成同一个东西。
  - 第 175 行直接用 2051，推导已经不在本页了。
  - 旧文「在每个通道上……经 softmax」这一层意思也丢了（`index_kpool_compress_gate` 是 128 × 4096，按通道算门控）。
- **证据**：`glm5_next.py` 第 1270–1289 行：`wq_b` 是 1536 → 32 × 128，`wk_weights_proj` 输出 `[head_dim, n_head]`，也就是 128 和 32；`index_kpool_compress_gate` 形状是 `head_dim × hidden_size`；打分公式见 P1-1 引用的 triton 第 173 行和第 122 行。
- **建议改法**：
  - 图第一格的副标题改为「Q（32 头）、共用 K、每头权重；另算压池门控」。
  - 「完整池」格补一句「池分 = Σ头权重 × (q · 池 K)，取前 512」。
  - 第 173 行补回「最多 2048 + 3 = 2051 个位置」。

### P3-1　停止判断框只写了「结束 token 或长度到限」

- **位置**：`one-request-finish-flow.yaml` 第 10 行。
- **问题**：`check_stop` 的实际顺序是：先过 `min_tokens` 门槛，再依次判断 `eos_token_id`、请求的 `stop_token_ids`、长度（`max_model_len` 或 `max_tokens`），最后是重复检测。图里只有两项，请求自带的停止 token 只在第 535 行正文里提到。
- **证据**：`vllm/v1/core/sched/utils.py` 第 94–130 行。
- **建议改法**：框里写「结束 token、停止 token 或长度到限？」；`min_tokens` 和重复检测放进源码表那一行说明，图上不画。

### P3-2　finish-flow 的版面有三处容易误读

- **位置**：`one-request-finish-flow.yaml` 第 14、17、28、30 行；截图 `one-request-finish-flow.png`。
- **问题**：
  1. 「否：继续」标在 x = 80，离它所属的箭头（x = 254）约 170 px，看不出是哪条线的标签。
  2. 「引擎处理终止 → 回收 KV 块」这一格放在两个框的外面、⑦ 的下方。它其实在 EngineCore 里执行，现在的位置像是「第 8 站」。
  3. 左下格写成问句（「……引擎仍未结束？」），右格却是它的补集情形，看上去是两个并列的情况框，而不是一个判断的两个出口。
- **证据**：截图中「否：继续」位于 (180, 293)，箭头在 x ≈ 330；回收格位于 (120–495, 830–878)，在两个框之外。
- **建议改法**：
  1. 「否：继续」挪到箭头右侧，贴着线。
  2. 回收格挪进 ⑥ 框的右下角，紫线从 ⑦ 回到 ⑥，箭头朝上，表示回到引擎。
  3. 把 ⑦ 的分叉改成一个判断格「命中停止串且引擎未结束？」，分出「是 / 否」两条线。

### P3-3　one-request 第 7 站：图下第一段基本是在复述图注

- **位置**：`one-request.md` 第 533 行与 yaml 第 3 行 caption。
- **问题**：两处都在讲「引擎看 token 与长度，前端看停止串；前端先发现就通知引擎回收」。任务要求改成「对图的解读，不与图重复」。
- **建议改法**：第 533 行只保留 SSE 分段那句，再补一句为什么停止串只能在前端判断：要反分词后才有文字。复述图注的部分删掉。

### P3-4　术语：「结束 token」的解释被删，「停止串」和「停止字符串」混用

- **位置**：`one-request.md` 第 533、535 行；图 yaml 第 13–15 行。
- **问题**：旧文第一次出现「结束 token」时有解释（「模型用来表示回答到此为止的特殊 token」，补丁第 540 行），新文删掉了，现在第一次出现是在图里和第 535 行，都没有解释。「停止字符串」从旧到新都没有解释是什么（请求参数 `stop`）。图里写「停止串」，正文写「停止字符串」。
- **建议改法**：在第 527 行「为什么这样做」里补一句定义，覆盖结束 token、停止 token 和停止字符串；图和正文统一用一种写法。按用户「术语用英文原名」的规则，可以写 stop string，首次出现时附中文解释。

### P3-5　one-request 源码表的站号和图对不上，新分支没有表行

- **位置**：`one-request.md` 第 605–606 行；frontmatter 第 46–47 行。
- **问题**：
  - 第 605 行把「逐个追加、截断、停止条件与释放块号」记在「7 返回」下，但新图和正文第 449 行都把它放在 ⑥。
  - 本轮新加了两条 source（`async_llm.py#L637-L695`、`async_scheduler.py#L12-L67`），却没有对应的表行。前端终止分支（`reqs_to_abort` → `abort_requests_async` → `EngineCore.abort_requests` → `finish_requests`）和第 447 行 `AsyncScheduler` 的占位数，在「对照源码」里都查不到入口。第四节建议把代码名从图上挪走，挪走以后这两处就只剩正文里的一个函数名。
- **证据**：`output_processor.py` 第 669–681 行；`async_llm.py` 第 686–688 行；`core.py` 第 378–384 行；`scheduler.py` 第 1825–1905 行；`async_scheduler.py` 第 19–67 行。
- **建议改法**：第 605 行改成「6 更新」。新增两行：「7 返回 | 前端识别停止串后通知引擎终止并回收 | `OutputProcessor.process_outputs` 的 `reqs_to_abort` → `abort_requests_async` → `Scheduler.finish_requests`」和「5/6 | 异步调度下候选留在 worker、引擎记占位数 | `AsyncScheduler._update_after_schedule`」。

### P3-6　two-node 路线图：选组规则说得太虚，虚线箭头方向会误导，右下角有一句漂浮的注

- **位置**：`glm-two-node-request-route.yaml` 第 9、20、25–26 行；截图 `glm-two-node-request-route.png`。
- **问题**：
  1. 「否：按两组负载分数挑选」没说分数怎么算，也没说挑分高的还是分低的。
  2. 「同步执行」是一条从被选组指向另一组的单向虚线，看上去像是被选组把另一组叫起来的。实际上是前端通知协调器，协调器把两组一起唤醒，之后两组按集合通信步调一致地走（`one-request.md` 第 539 行也是这么写的）。
  3. 右下「选组与专家路由发生在不同层次」没有连到任何节点，句子也没讲清楚，正文第 139 行已经说过同一件事。
- **证据**：`core_client.py` 第 1398–1426 行（第 1415 行 `score = waiting * 4 + running`，取最小；第 1421 行本地计数加 `client_count`）；`core.py` 第 1869–1945 行。
- **建议改法**：
  1. 改成「否：挑负载分数小的组（公式见多请求页）」，保持单一出处。
  2. 虚线去掉箭头，改成双端无向，标签写「两组步调一致」。
  3. 删掉右下注。

### P3-7　two-node 路线图的 MoE 格只画了 MC2 路径

- **位置**：`glm-two-node-request-route.yaml` 第 12 行。
- **问题**：「dispatch → 本卡专家计算 → combine」只在 MC2 路径成立。本页第 121 行和源码表第 [C18] 行都写明，token 数超过 128 时改走 All-Gather / Reduce-Scatter。这张图画的是「一条请求」，长提示词的 prefill 就会超过 128。
- **建议改法**：副标题改为「MC2：dispatch → 专家 → combine（超过 128 token 改走 All-Gather）」，或者只写「跨两台机器交换 token 与专家结果」，路径细节交给正文。

### P3-8　「dummy batch」和「空批次」两种叫法并存

- **位置**：`glm-two-node-request-route.yaml` 第 3、11 行；`one-request.md` 第 539、553 行。
- **建议改法**：以 TERMS.md 为准统一。TERMS.md 目前两种都没收，建议收一个：英文 dummy batch，首次出现时解释为「没有请求时陪跑的空批次」。

### P3-9　索引器图的分叉画法和代码名；`always_select_tail` 在运行时是写死的

- **位置**：`glm-flash-indexer-flow.yaml` 第 6、16–17 行；`glm-5-3-flash.md` 第 163 行。
- **问题**：
  1. 「写入状态」之后分成两支。左支「完整池」和右支「还有尾部？」其实是同时进行的两条数据路径，画法却和判断分叉一模一样，初学者会读成「二选一」。
  2. 顶格写的是类名 `AscendGlm5NextIndexer`。它以大写字母开头，图检查器的正则没抓到，但同样属于代码名。
  3. 第 163 行把补尾对应到 `index_kpool_always_select_tail=true`。可 `db701c1f` 的运行路径（triton 第 229–236 行，回退路径 `_append_tail_to_topk`）不读这个开关，无条件补尾。这个开关只在 `transformers_utils/configs/glm5_next.py` 第 195 行存了下来。
- **建议改法**：
  1. 分叉处加「两路同时」的标注，或者改成两条平行竖线，不画成判断框的样子。
  2. 顶格改成「索引器：投影 Q、K、头权重与压池门控」，类名挪进源码表（表里已有 [C12]）。
  3. 版本差异补一句：「昇腾实现不读 `index_kpool_always_select_tail`，尾部总是补上，与配置值 true 的效果一致。」

### P3-10　MTP 图：反馈线的起点含糊，左右顺序和拼接顺序相反

- **位置**：`glm-flash-mtp-flow.yaml` 第 6–7、12、25 行。
- **问题**：
  1. 虚线「反馈隐藏向量」从「shared_head → compute_logits」这一格引出。源码里反馈的是 `shared_head`（也就是 RMSNorm）的输出，还没过 `lm_head`，更不是 logits。一个格同时装着两步，读者会以为反馈的是 logits 之后的东西。
  2. 图上隐藏向量在左、embedding 在右，源码拼接顺序是 `torch.cat([embeddings, previous_hidden_states])`，embedding 在前。现在图上没标顺序，所以不算错；但 `eh_proj` 的权重是按「embedding 在前」排的，初学者按图对照权重时会反过来。
- **证据**：`glm5_next_mtp.py` 第 112–124 行（第 116 行拼接，第 123 行 `hidden_states = self.shared_head(hidden_states)`，第 124 行返回两份相同的值）；上游 `deepseek_mtp.py` 中 `SharedHead.forward` 就是 `self.norm(hidden_states)`；logits 在第 175–183 行的 `compute_logits` 里用 `shared_head.head` 算。
- **建议改法**：
  1. 拆成两格：「RMSNorm（shared_head）」，反馈线从这里引出；下一格是「× 主模型 lm_head → logits」。
  2. 左右对调，或者在拼接格注明「embedding 在前」。

### P3-11　「三遍草拟都重算索引器」在页面上没有落点

- **位置**：`glm-5-3-flash.md` 第 231–235 行；`one-request.md` 第 435–437 行。
- **问题**：底稿 `03-sample-decode.md` 第 297、714 行已经定案：config 里 `index_share_for_mtp_iteration` 为 true，但 `db701c1f` 没有 `set_skip_topk` 的实现，所以三遍都重算索引器。源码核实结果一致：`llm_base_proposer.py` 第 194 行读取这个开关，第 1208、1220 行要求 `hasattr(draft_model, "set_skip_topk")`；而 `set_skip_topk` 只出现在 `vllm_patch/0729.patch:4438`，`glm5_next_mtp.py` 里没有。MTP 图的循环经过整个 `mtp_block`，和这个结论并不矛盾，但两页都没写出来。读者看到 config 里的 true，会以为后两遍复用了索引。
  - 另外两项已核实没有问题：`one-request.md` 第 437 行写了「一轮 3 个、eager」；MTP 图把数量写成「由部署配置决定」，并链到部署页，符合单一出处。
- **建议改法**：在 `one-request.md` 第 437 行后补一句：「三遍各自重算索引器：配置虽写了 `index_share_for_mtp_iteration=true`，本基线没有实现跳过。」这句作为单一出处，glm 页的 MTP 段链到这里。

### P3-12　图文复述和版面利用率

- **位置**：`glm-5-3-flash.md` 第 171–173、231 行；四张图的 `size`。
- **问题**：
  - 第 173 行「完整池按查询得分挑选……沿右支直接加入」、第 231 行「图的两路输入错开一个位置……」都是在把图再念一遍，而且第 173 行末句是关于图和源码表的元说明，对初学者是噪声。
  - 四张图高 740–880 px，其中三张是单列竖排：主干宽 460 px，只占 1034 px 正文栏的一半左右，行间空隙约 56–64 px。一张图基本就占满一屏，读者看不到图下的解读。
- **证据**：`report.json`：四张图渲染宽度都是 viewBox 原值（880），最小字号 13 px，没有重叠，也没有越界。截图里的 MTP 图和索引器图，左右两侧各留有约 280 px 空白。
- **建议改法**：
  - 解读只写图上看不出的东西：为什么这样设计、和 DSA / 主干有什么不同、数字从哪里来。
  - 索引器图可以把两支并排、整体压扁。MTP 图可以改成「输入两路在左 → 中间主干 → 右侧判断与回环」的横向布局，高度能降到 500–600 px。宽度不缩，按「正文太窄就加宽正文」的原则，不缩图。

## 三、审查项逐项结论

### 1. 节点是否与源码一致

| 图 | 结论 | 核对到的关键点 |
|---|---|---|
| one-request-finish-flow | 对，有两处不全（P3-1） | 先回退、再逐个追加并检查停止：`scheduler.py` 第 1417–1431、1452–1456、1695–1711 行；命中就截断：第 1708–1710 行；`_free_request` → `_free_blocks` → `kv_cache_manager.free`：第 1888–1910 行；前端在 `process_outputs` 里调用 `detokenizer.update` 查停止串，引擎还没结束就放进 `reqs_to_abort`：`output_processor.py` 第 639–681 行；`async_llm.py` 第 686–688 行调用 `abort_requests_async`；引擎侧 `core.py` 第 384 行 `finish_requests(…, FINISHED_ABORTED)` 回收。底稿 01 第 746–747 行与此一致。 |
| glm-two-node-request-route | 对，有两处不全（P3-6、P3-7） | 指定 `data_parallel_rank` 就直接用；否则 `score = waiting * 4 + running` 取最小，选中后本地计数加 `client_count`：`core_client.py` 第 1398–1426 行，与底稿 01 第 566–570 行一致；空闲组在 `engines_running` 时执行 `execute_dummy_batch`：`core.py` 第 1891–1899 行。 |
| glm-flash-indexer-flow | 数据流对，出处错（P1-1）；打分信息缺失（P2-3） | 先压池写缓存、再选池；`topk = min(512, 已有池数)` 对应「池数较少时用实际存在的池」；尾部 = `pos + 1 - ⌊(pos + 1) / 4⌋ × 4`，最多 3 个且包含当前位置本身；这些都与 triton 第 161、209、229–236 行一致。`always_select_tail` 在运行时是写死的（P3-9）。 |
| glm-flash-mtp-flow | 对，反馈起点含糊（P3-10） | 位置 0 的 embedding 置零、`rot` 在 `hnorm` 之前、`enorm` / `hnorm` / `eh_proj`、`mtp_block`、`shared_head`：`glm5_next_mtp.py` 第 108–124 行；`lm_head` 换成主模型的：`llm_base_proposer.py` 第 589–596 行；每遍取 argmax、后续每遍 `positions += 1`、输入是上一遍的候选和隐藏向量：第 1338–1450 行；草稿强制 eager：第 227–236 行；三遍都重算索引器（P3-11）。 |

### 2. 图有没有用

- **finish-flow**：两个进程分两个框，停止判断分在引擎和前端两处，一眼能看出来。这是四张图里帮助最大的一张。问题是标签离线太远、回收格位置不对（P3-2）。
- **two-node route**：「先选组、再在 MoE 汇合」这条主线清楚，但本节要讲的「16 张卡上怎么走」只画出一半（P2-1）。
- **indexer**：先写后选、两支合并，顺序清楚；可并行支路画得像判断分叉，读者看不出哪些是 GLM 新加的（P2-2、P3-9）。
- **MTP**：回环画得清楚，初学者能看懂「猜一个 → 回去再猜」。反馈线的起点要拆开（P3-10）。
- 四张图都没有重叠和越界，最小字号 13 px（`report.json`）。和 1034 px 正文栏相比，宽度合适，高度偏大（P3-12）。

### 3. 文字精简后有没有丢东西

| 页 | 丢失 / 变化 | 判定 |
|---|---|---|
| one-request | 「结束 token」的定义（P3-4）；prefill 那圈对 `y₀` 的停止判断示例，压缩成了「这次继续生成」，可以接受；「把候选记在 R1 上」改成了异步调度下的准确说法，这一处是改好了；各段的链接都保留了 | 小问题 |
| two-node | 机内 TP All-Reduce 一步和四个概念页链接（P2-1）；旧文「协调进程按负载打分」其实是错的，新文改成「选组由前端完成」，这一处是纠正 | 丢了关键信息 |
| glm-5-3-flash | 「五步」引导句失效（P2-2）；头权重、池分公式、2051 的推导（P2-3）；MTP 段的「不用 mHC」「288 + 1 个专家不共用」简成了「有自己的……MoE 专家」，可以接受 | 丢了关键信息 |

源码入口：one-request 的新分支在表里没有行（P3-5）；two-node 的选组入口靠第 139 行的类名，再链到多请求页，可以接受；glm 页的入口指错了（P1-1）。

### 4. 代码名：留在图上的，和挪到「对照源码」的

判定原则：讲解页的图只保留读者在运行现场或权重文件里会直接看到的名字，也就是组件名、协议名和权重名；函数名、类名、模块属性名一律挪到源码表。

| 图 | 留在图上 | 挪到「对照源码」（图上换成中文动作） |
|---|---|---|
| finish-flow | EngineCore、API server、ZMQ（框标题和协议名） | `Scheduler.update_from_output` → 调度器更新请求；`check_stop` → 停止检查；`_free_request` → 归还块号；`OutputProcessor.process_outputs`、`detokenizer.update` → 输出处理：增量反分词、查停止串；`abort_requests_async` → 通知引擎终止。同时按 P3-5 在表里补行。 |
| two-node route | API server、EngineCore、DP rank、dummy batch、dispatch / combine（都是术语） | `DPLBAsyncMPClient.get_core_engine_for_request`：第 139 行正文已经有类名，建议在源码表补一行「前端选组」，出处是 `core_client.py`，已在 frontmatter 中。 |
| indexer | 无代码名需要保留 | `AscendGlm5NextIndexer` → 索引器；源码表已有 [C12] 行 |
| MTP | `enorm`、`hnorm`、`eh_proj`、`lm_head`：这几个是权重文件里的张量名，正文和部署页也用它们，属于「有固定英文名的术语」，建议作为副标题留下；主标题用中文动作 | `mtp_block` → 预测层（稀疏 MLA → MoE）；`shared_head` → RMSNorm；`compute_logits` → 出 logits；`argmax` → 取分数最大的词。源码表第 368 行 [C18] 已经覆盖这些名字。 |

留下 `eh_proj` 这类名字，图检查器仍会给不阻塞的提示。它们作为权重名的例外，可以接受。

### 5. 结构约束

| 页 | `## 对照源码` 之后的 H2 | 其上的角标 | 其下的 H3 | 角标数 | [C] 占比 | 结论 |
|---|---|---|---|---|---|---|
| one-request | 无 | 0 行 | 版本差异、源码位置 | 22 | 17/22 = 77% | 合规 |
| two-node | 无 | 0 行 | 固定五个 | 28 | 22/28 = 79% | 合规，接近上限 |
| glm-5-3-flash | 无 | 0 行 | 版本差异、源码位置 | 28 | 18/28 = 64% | 合规 |

单一出处：
- two-node 的选组规则链到多请求页，glm 页的 MTP 数量链到部署页和 one-request，都合规。
- `waiting × 4 + running` 目前在 one-request（第 167、581 行）、concurrent-requests（第 403、417、448 行）、data-parallel（第 39 行）三页都有。这是本轮之前就有的重复，本轮没有再加。
- 本轮新增的 frontmatter source 有 4 条没有角标引用：one-request 两条，glm 页两条。它们本身不违规，但按 P1-1 和 P3-5 修改时应该用上。

## 四、验证记录

- `pnpm -s wiki:diagrams --check` 退出码 0，与这四张图相关的提示如下：
  - `glm-flash-mtp-flow`：`eh_proj`、`mtp_block`、`shared_head`、`lm_head`
  - `glm-two-node-request-route`：`get_core_engine_for_request`
  - `one-request-finish-flow`：`update_from_output`、`check_stop`、`free_request`、`process_outputs`、`abort_requests_async`
  - `glm-flash-indexer-flow`：没有提示。类名以大写开头，正则没抓到，见 P3-9。
- `pnpm -s wiki:lint`：「ok wiki:lint 通过（另有 23 处待留意）」，三页均不在待留意之列。
- 截图：`scratchpad/codex-flow-shots/one-request-finish-flow.png`、`glm-two-node-request-route.png`、`glm-flash-indexer-flow.png`、`glm-flash-mtp-flow.png`，逐张看过。

## 修订记录

2026-09-27：16 条全部已改。以 `git -C tools/repos/vllm-ascend show db701c1f:<path>` 核对运行路径；02 底稿有同样错误，已同步修订 §5.3–5.5，并在 §12.5 记录。

| 条目 | 处理 |
|---|---|
| P1-1 索引器误指单测 | 已改：图与 C13/C14 指向 `ops` 压池和 triton 选择，追加运行入口 C26/C27；one-request C14 同步更正。版本差异明确头加权查询与池 K 点乘的公式。02 删除 decode 调用 `npu_lightning_indexer` 的错误说明。 |
| P2-1 双机缺 TP 和链接 | 已改：两条支路加入机内 TP8 All-Reduce，说明 TP 与 EP 随层反复发生；图下恢复 DP、scheduler、TP、EP 四个链接。 |
| P2-2 五步引导失效 | 已改：按节点名解释投影、压池、按池挑、展开、补尾与 DSA 的关系，并区分打分公式；图中色块标出按池处理。 |
| P2-3 池分丢失 | 已改：补回 4096→32 头权重及缩放、4096→128 压池门控、逐通道 softmax、池分公式与 512×4+3=2051 推导；单请求页引用模型页推导。 |
| P3-1 停止条件 | 已改：图中补停止 token，源码表解释 `min_tokens` 和重复检测，source 扩至 L130。 |
| P3-2 收尾图布局 | 已改：标签贴线，回收格放入 EngineCore，前端以一个判断框分是/否；紫线向上返回引擎。 |
| P3-3 图文复述 | 已改：图下解释 stop string 为何依赖反分词，并保留 SSE 与 token/文字边界的关系。 |
| P3-4 术语 | 已改：图前定义结束 token、停止 token、stop string，图文统一 stop string。 |
| P3-5 源码表站号与缺行 | 已改：追加/截断/释放归第 6 站；补前端终止链 C35、异步占位 C36 两行。 |
| P3-6 选组与虚线 | 已改：明确取分数小的组，公式链接多请求页；虚线两端无箭头，删除漂浮注。源码表补选组入口 C23。 |
| P3-7 MoE 只画 MC2 | 已改：框中写跨机交换 token 与专家结果，具体通信选择继续由正文展开。 |
| P3-8 dummy batch | 已改：图与单请求页统一用 dummy batch，首次解释空闲时陪跑的空批次；TERMS 文件保持本轮范围之外。 |
| P3-9 索引器分支和补尾 | 已改：两路放入「两项都执行」框，类名移入源码表；明确运行算子固定补尾，区分配置字段与实现。 |
| P3-10 MTP 反馈与拼接 | 已改：RMSNorm 与词表投影拆开，虚线从 RMSNorm 输出反馈；注明 embedding 在前，保留 enorm、hnorm、eh_proj、lm_head 权重名。 |
| P3-11 三遍重算 | 已改：one-request 的「MTP 索引器的重算」为唯一说明处，模型页链接过去；源码表补接口检查。 |
| P3-12 图文与版面 | 已改：正文解释门控维度、公式、位置偏移与共享权重。索引器图 820→630 px，MTP 850→570 px，收尾图 880→760 px；双机图为补 TP 从 740 增到 760 px，均保持 880 px 宽。 |

验证：四项指定命令按顺序通过。四张图定向生成 SVG，Playwright 在 4173 端口实际阅读页截图并目视检查，保存于用户指定 `scratchpad/codex-fix-shots/`，最小字号 13 px。角标：one-request 24（C 19/24）、two-node 29（C 23/29）、glm 30（C 20/30）；「对照源码」后无 H2，H3 属于固定五项。本报告图的代码名告警 10→2，剩余为 eh_proj、lm_head。
