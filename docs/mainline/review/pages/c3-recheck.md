# C3 复审：GPT-6 Astra 按三份报告修订的落实情况

- 复审对象：三份报告末尾的修订记录，以及它们指向的页面、图 yaml/svg、底稿 `docs/mainline/02-forward.md`
  1. `learning-guide-r2-review.md`（记录：已改 12、不改 2）
  2. `flowcharts-r1-callchain-concurrent.md`（记录：已改 17、不改 1）
  3. `flowcharts-r1-onerequest-twonode-glm.md`（记录：16 条全改）
- 源码：控制流 `tools/repos/vllm`（`git rev-parse --short HEAD` = `0fc695fc6d`）；执行侧 `git -C tools/repos/vllm-ascend show db701c1f:<path>`，先 grep 定位再读相关函数
- 实际运行：
  - `pnpm wiki:audit` → `审计 131 页，来源 1417 条 … 行号越界 0`，`ok wiki:audit 本地引用与行号校验通过`
  - `pnpm wiki:diagrams --check` → `ok wiki:diagrams 151 张图与 spec 一致`，待留意 35 处，其中代码名 13 条
  - `pnpm -s wiki:lint` → `ok wiki:lint 通过（另有 23 处待留意）`，五页主线和阅读指南都不在其中
  - `npx vitest run src/content/wiki/index.test.ts` → `Tests 1 failed | 11 passed`（R1 P2-4 那条，见第七节）
  - 截图：`scratchpad/codex-fix-shots/` 下 12 张 png 逐张看过；截图时间（14:55 / 15:04）都晚于对应 svg 的生成时间（14:52 / 15:02）
- 没做的：没读 `wiki/HANDBOOK.md` 和 `docs/plans/`；没有自己起浏览器，图面判断依据 Astra 的截图；读取过程中没有被拦截

## 一、结论

| 报告 | 结论 | P1/P2 落实 | 残留 |
|---|---|---|---|
| learning-guide-r2 | **通过** | P1 2/2、P2 3/4 已改；P2-4 不改，理由成立 | P2-4 单测仍红，需要交给前端/测试负责人；P1-2 用了折中写法 |
| flowcharts-r1-callchain-concurrent | **通过** | P1 2/2、P2 5/5 | P2-3、P2-4 各有一处 P3 级的图面余量；P3-9 不改，理由成立 |
| flowcharts-r1-onerequest-twonode-glm | **通过** | P1 1/1、P2 3/3 | 无 |

三份报告里标「已改」的 P1、P2 都在页面、yaml 或底稿里找到了对应改动，与源码核对一致。两条「不改」（R1 P2-4、R2 P3-9）都是因为超出本轮允许修改的范围，理由成立，但事项本身还没关。另外在底稿 §5.5 发现一处与 P1-1 同类的问题，不在三份报告范围内（第八节）。

## 二、learning-guide-r2（14 条）

| 条目 | 判定 | 证据 |
|---|---|---|
| P1-1 图里的旧分组名 | 已落实 | `learning-guide-route.yaml:15` `text: 推理过程`；svg 里 grep「推理过程与」无命中，只剩「推理过程」；截图 `learning-guide-route.png` 中间列就是「推理过程」 |
| P1-2 版本差异指路 | 已落实（折中写法），可接受 | `learning-guide.md:46` 保留了指路，但补上「各页正按这个结构补齐；阅读尚在整理的页面时，可先沿来源链接核对固定版本」，读者扑空时有退路。事实没变：`grep -l '^## 对照源码' wiki/concepts/*.md` 为 17/96，`### 版本差异` 为 15 页 |
| P2-1 图注「第一组就是主线」 | 已落实 | `learning-guide-route.yaml:3` 改为「目录第一组收录本页与模型、单请求、多请求三页；部署页在『分布式推理与部署』，代码路径页在『vLLM 与 Ascend 架构』」；全库 grep「第一组就是」无命中 |
| P2-2 relations 方向 | 已落实 | `learning-guide.md:11` `relations: []`；`concurrent-requests.md:51-52`、`glm-5-3-flash-two-node.md:34`、`one-request.md:49-50`、`request-call-chain.md:66-67` 都是 `to: learning-guide, kind: builds-on` |
| P2-3 镜像边界 | 已落实 | `learning-guide.md:36`：执行侧核到 `db701c1f`，上游按 `VLLM_TAG=v0.23.0` 取 `0fc695fc`，「待核：容器内最终安装的上游 vLLM 代码」，并挂了 `[!]` |
| P2-4 旧单测断言 | 不改，理由成立；**事项未关** | 用户本轮禁止改 `src/`、`tests/`。单测仍红：`src/content/wiki/index.test.ts:20` `expect(page?.fm.title).toMatch(/^Block Table/)` 失败，`Tests 1 failed | 11 passed` |
| P3-1 至 P3-8 | 已落实 | `:26`、`:73` 用 attention / embedding / 矩阵乘；`:89` 删了悬停描述，只在 `:95` 保留；`:74` 改为「请求调度、decode 与缓存复用」；`:72`「阅读路线（就是你正在读的这页）」不带链接；`:22`、`:32`、`:89` 改成面向读者的写法；`:34` 标题是「代码版本：讲解基于哪个版本」；角标 6 处（`:22 [I]`、`:26 [S1]`、`:36 [!]`、`:38 [I]`、`:50 [I]`、`:68 [I]`）。P3-2（落地页标题）不改，理由是超出范围，成立 |

## 三、flowcharts-r1-callchain-concurrent（18 条）

| 条目 | 判定 | 证据 |
|---|---|---|
| P1-1 `request-call-chain.md:58` 行号越界 | 已落实 | 现为 `patch_kv_cache_coordinator.py#L461-L531`；`git show db701c1f:… \| wc -l` = 531，`def get_kv_cache_coordinator` 在 L461；audit 输出 `✓ …#L461-L531 (文件 531 行)`，全库越界 0 |
| P1-2 graph-decision 的 `dispatch` | 已落实 | `concurrent-request-graph-decision.yaml:33-36`：L76–96 的 symbols 改为 `_compute_bs_to_padded_graph_size`（源码 L76 正是该函数）；另加 `#L239-L300 symbols: [dispatch]`（源码 `def dispatch` 在 L239）。`concurrent-requests.md:27`、`:49` 都进了 sources，`:465` 源码表同时写两个函数。首条 pin（`model_runner_v1.py#L2898-L2996`）里的 `dispatch`：区间内第 60 行确有 `self.cudagraph_dispatcher.dispatch(`，成立 |
| P2-1 抢占图回环 | 已落实 | yaml `:20` 回环改走 `[394,622]→[10,622]→[10,53]`，截图里回环从判断框左侧下行，绕过「成功」框，「否」贴着判断框；成功框写了「→ 回到调度图，处理下一条 running」 |
| P2-2 同时发生的两件事 | 已落实 | yaml `:6` 用外框「同时确定两项 · 每组都执行」，`:13-14` 两栏并列，`:24-25` 一进一出，没有分叉箭头；与源码一致：`_sync_metadata_across_dp`（`model_runner_v1.py` L692 起）区间内第 42 行 `if allow_dp_padding or is_draft_model:` |
| P2-3 调度图 T 形接头 | 已落实；P3 余量 | yaml `:32-34` 三条出边各走各的线（x=452 / 422 / 440），各自以箭头进入输出框，删掉了 `ends: none` 短桩（grep 无命中）。余量：三条竖线只隔 12–18 px，「成功 → 再看 waiting」这个标签在 x≈823，离它的回线（x≈870）偏远 |
| P2-4 ③④ 的嵌套 | 按报告允许的备选方案落实；P3 余量 | `request-call-chain-functions.yaml:3` 的图注写「④在③的执行调用内部完成」，`:14` 的 sub 写「在③内部」，框缩进 20 px。余量：④ 没有真正画进 ③ 的框里，④→⑤ 仍是一条实线箭头，容易读成「④ 做完直接进 ⑤」；「第 5 站由第二次 RPC 触发」这句注放在 worker 框外（`:34`），离 ⑤ 很远 |
| P2-5 grammar 表 | 已落实 | 截图 `request-call-chain-step.png` 第二格：「结构化输出用；普通文本请求为空」 |
| P3-1 至 P3-8、P3-10、P3-11 | 已落实 | `request-call-chain.md:12` 的 pin 只留 `add_request`（源码 L280；`generate` 在 L524，已移出）；`concurrent-requests.md:18` 为 `kv_cache_manager.py#L238-L398`；②的 sub 是「本步算谁、各算几个、分哪些块」；「数量为 0 则跳过」挪到了「取下一条 running」；分支图底框写「按拒绝数回退计数在第 6 站」；底框改为「按商定的模式和宽度重新选一次图」；六页 `^file: .*\.yaml` 命中 0；`request-call-chain.md:89/179/191` 补回 kv-cache、token、vllm-engine-core、npu-worker-lifecycle、npu-model-runner 的链接 |
| P3-9 HANDOFF 待办 | 不改，理由成立（HANDOFF 不在本轮范围）；**事项未关** | `request-call-chain.md:63` 仍为 `verified: []`，待办只记在报告的修订记录里 |

## 四、flowcharts-r1-onerequest-twonode-glm（16 条）

| 条目 | 判定 | 证据 |
|---|---|---|
| P1-1 索引器误指单测 | 已落实，自己对照源码核过（见第五节） | 图 pins（`glm-flash-indexer-flow.yaml:22-31`）、glm 页 [C13]（`:22`）、[C14]（`:23`）、[C26]（`:35`）、[C27]（`:36`）、one-request [C14]（`:25`）、02 §5.3–5.4（`:417-442`）都指向运行路径；全库 grep `npu_lightning_indexer\|indexer_kpool_topk_decode\|expand_pools_to_tokens\|append_tail_to_topk` 只剩 02 `:442`（明确写「归属单测参考实现」）和 `:1104` 修订记录 |
| P2-1 双机图缺 TP、缺链接 | 已落实 | `glm-two-node-request-route.yaml:12-13` 新增「本机 TP8 · All-Reduce / 合并每层 attention 与稠密 MLP 的部分结果」和「对面机内 TP8 · All-Reduce」；`glm-5-3-flash-two-node.md:144` 补回 data-parallel、vllm-scheduler、tensor-parallel、expert-parallel 四个链接；`codex-fix-shots/link-checks.json` 四条都是 `ok` |
| P2-2「下面五步」 | 已落实 | glm 页 grep「五步」无命中；`:167` 改为按节点名说明：多头 Q、共用 K、每头权重、主 attention 沿用 DSA，压池、按池挑、展开、补尾是 GLM 加的，并写明打分去掉了 ReLU |
| P2-3 池分打分写法 | 已落实 | 图 `:10` sub「池分 = Σ 头权重 ×（q · 池 K）」；正文 `:173` 写了压池门控 4096→128、逐通道在 4 个位置间 softmax，头权重 4096→32，缩放 `128⁻¹ᐟ² × 32⁻¹ᐟ²`；`:175` 写了 `q̄ = Σⱼ wⱼqⱼ` 和 `512 × 4 + 3 = 2051`。源码核对：`softmax_scale = head_dim**-0.5`，`weights * (softmax_scale * n_head**-0.5)`；压池回退 `torch.softmax(scores, dim=1) * pool_k`，dim=1 就是池内 4 个位置 |
| P3-1 至 P3-12 | 已落实 | 收尾图截图：停止判断写「结束 token、停止 token 或长度到限？」，回收格在 ⑥ 框内，前端是一个判断框分出是/否；`one-request.md:536` 定义了三种停止，`:542` 解释 stop string 为什么要在前端判断；源码表 `:614-617` 有「6 更新」和 [C35]、[C36] 两行；双机图写「否：挑负载分数小的组 / 打分公式见多请求页」，虚线无箭头，漂浮注已删，[C23] 指向 `core_client.py#L1398-L1426`；MoE 框写「跨两台机器交换 token 与专家结果」；`one-request.md:235` 首次出现 dummy batch 时有解释；索引器图用「两项都执行」框，顶格不再用类名；glm 页 `:351` 写明补尾固定执行；MTP 图把 RMSNorm 和 lm_head 拆成两格，虚线从 RMSNorm 引出，注明「embedding 在前」；`one-request.md:442`「MTP 索引器的重算」是唯一说明处，glm 页 `:237` 链接过去（link-checks 为 `ok`）；图高：索引器 630、MTP 570、收尾 760、双机 760 |

## 五、重点复核

### 5.1 索引器运行路径（自己对照 `db701c1f` 核过）

- 调用链：`AscendGlm5NextIndexer.forward` 返回 `self.indexer_op(...)`，`indexer_op` 是 `AscendSparseAttnIndexerKpool`（`glm5_next.py:1320`）；它的 `forward`（L1094）→ `forward_native`（L1117）→ `forward_ascend`（L1140）。`forward_ascend` 在 L1201 调 `torch.ops.vllm.glm5_next_kpool_state_compress_and_write_cache`，在 L1221 调 `torch.ops.vllm.glm5_next_lightning_indexer`
- 后者注册在 `ops/glm5_next_lightning_indexer.py:530`（`direct_register_custom_op(op_name="glm5_next_lightning_indexer")`）。L444 用 `_can_use_triton` 选路：NPU、非空、`TRITON_HEAD_DIM`、`index_topk // index_kpool <= 512`（L504）。GLM 是 2048/4 = 512，走 triton（`ops/triton/glm5_next_lightning_indexer.py:131`）
- **「没有 ReLU」写对了**：triton L173–175 `qbar = (query * weights.unsqueeze(-1)).sum(dim=1)`，L122 `scores = tl.sum(k_tile * qbar[None, :], axis=1)`；回退路径 `_bf16_mqa_logits`（ops L167–173）是 `(query * weights).sum(dim=1)` 再做 matmul。两条路径都没有 relu、clamp 或 maximum 作用在分数上
- **「`npu_lightning_indexer` 不在路径上」写对了**：在 `vllm_ascend/` 下 `git grep`，GLM 模型文件里唯一的调用在静态方法 `indexer_kpool_topk_decode`（`glm5_next.py:491/501`），`vllm_ascend/` 里没有任何地方调用这个方法；其余命中在 `sfa_v1.py`、`sfa_cp.py`、`device_op.py`，是 DSA 的 SFA 路径，而 GLM 的 MLA 后端是 `AscendIndexerKPoolMLABackend`（`glm5_next.py:171-178` → `indexer_kpool_mla_v1.py` 的 `get_impl_cls` 返回 `AscendIndexerKPoolMLAImpl`）。`expand_pools_to_tokens`、`append_tail_to_topk`、`indexer_kpool_topk_pytorch`、`kpool_compress_and_write_cache` 在 `vllm_ascend/` 下只有定义
- 页面表述：glm 页 `:167`、`:351`，02 `:419`、`:442` 与上面一致

### 5.2 行号

- `request-call-chain.md:58` → `#L461-L531`，audit 输出 `✓ (文件 531 行)`
- `concurrent-request-graph-decision.yaml`：`dispatch` 单独钉在 `cudagraph_dispatcher.py#L239-L300`，audit 输出 `✓ …#L239-L300 (文件 354 行)`；源码 `def dispatch` 在 L239，下一个 `def` 在 L330
- `pnpm wiki:audit` 全库行号越界 0

### 5.3 抢占图、调度图、图模式图

见第三节 P2-1、P2-2、P2-3：三处画法问题都解决了。调度图还剩 P3 级的线距和标签距离问题。

### 5.4 two-node

TP All-Reduce 已补（yaml `:12-13`，图注说明 TP 与 EP 随层反复发生），四个概念页链接已补回（`:144`）。

### 5.5 glm 页

「下面五步」已删；池分打分写法在图（yaml `:10`）和正文（`:173-175`）里都补回来了。

### 5.6 学习指南路线图

分组名已改为「推理过程」（yaml `:15`）；「第一组就是主线」这句图注已改（yaml `:3`）。

## 六、代码名：剩下的 13 条告警

| 图 | 告警 | 类别 | 判定 |
|---|---|---|---|
| request-call-chain-functions | `create_chat_completion`、`execute_model`（`NPUWorker.execute_model`）、`model_forward`（`_model_forward`）、`sample_tokens`、`update_from_output`、`process_outputs` | 七站入口函数名，都在框标题上 | 可以留。第二层调用（`render_chat_request`、`AsyncLLM.generate`、`NPUModelRunner.execute_model`、`compute_logits`、`_sample`、`propose_draft_token_ids`、`ACLGraphWrapper`）已从 sub 里移走，只留在 pins |
| request-call-chain-branches | `sample_tokens` | ⑤ 的入口函数名（「sample_tokens 中选择采样器」） | 可以留。`AscendSampler` / `AscendRejectionSampler` 是采样器类名，不触发告警 |
| request-call-chain-log-route | `EngineCore_DP`、`Worker_DP` | 日志前缀 | 可以留 |
| glm-flash-mtp-flow | `eh_proj`、`lm_head` | 权重名、组件名 | 可以留 |
| vllm-ascend-repo-map | `model_loader`、`spec_decode` | 仓库目录名 | **不属于五类**；这张图不在本轮范围（修订记录写「保持原样」），目录名本身就是这张仓库地图的内容，留不留要另行定 |

小结：本轮相关的 11 条都属于可以留的类别；另外 2 条在范围外，需要单独拍板。检查器没抓到、但也属于代码名的：`concurrent-request-schedule.yaml:17`「交出 SchedulerOutput」是数据类名，不在五类里，但它也不是第二层调用，算 P3 边界项。

## 七、改动范围与未落实条目

### 7.1 这一轮动过的文件

`git status --short` 有 485 条，多轮改动都没提交，没法用 diff 把这一轮切出来。我用两种办法交叉确认：

- **Astra 会话 `~/.codex/sessions/2026/09/27/rollout-2026-09-27T14-29-21-*.jsonl` 里 `apply_patch` 的文件清单**（只抽了文件路径）：`wiki/concepts/{learning-guide,request-call-chain,concurrent-requests,one-request,glm-5-3-flash,glm-5-3-flash-two-node}.md`；`wiki/diagrams/` 下 12 个 yaml（`learning-guide-route`、`request-call-chain-{functions,branches,step}`、`concurrent-request-{schedule,preempt,graph-decision}`、`one-request-finish-flow`、`glm-two-node-request-route`、`glm-flash-{indexer,mtp}-flow`）；`docs/mainline/02-forward.md`；三份报告。svg 是 `wiki:diagrams` 生成的。**没有 `src/`、`tests/`**
- **mtime**（14:00 以后）：除上面这些外，还有 `src/app/wiki/PageToc.tsx`、`src/app/pages/WikiPage.tsx`、`src/app/wiki/wikiStyle.ts`（14:32）、`tests/wiki-page-toc.spec.ts`（14:33）、`src/content/wiki/CalcBlock.tsx`（14:57）、`src/content/wiki/{calc.ts,calc.test.ts}`、`src/app/pages/dev/WikiSpecimenPage.tsx`、`tests/wiki-style-specimen.spec.ts`（都在 15:03:44）、`src/design/wiki.css`（15:04）。Astra 会话的工具调用里，涉及 `src/` 的 5 次都是 `Get-Content` / `rg` 只读；`wiki.css` 只出现在工具输出和用户消息里，没出现在调用本身。这批文件和 R1 报告第五节记录的「前端由其他人处理」是同一批，判断是并行的前端工作流改的

结论：Astra 这一轮没碰 `src/`、`tests/`。同一时间窗里这些文件被别人改过；如果要最终定责，需要对照前端那条会话。

### 7.2 未落实或残留（都不阻塞三份报告通过）

| 级别 | 位置 | 问题 | 证据 |
|---|---|---|---|
| P2（未关） | `src/content/wiki/index.test.ts:20,22` | R1 P2-4 按范围不改，单测仍红 | `npx vitest run src/content/wiki/index.test.ts` → `Tests 1 failed | 11 passed`，断言 `/^Block Table/` 失败 |
| P3（未关） | `wiki/concepts/request-call-chain.md:63` | R2 P3-9：`verified: []` 的待办没进 HANDOFF | 只记在 `flowcharts-r1-callchain-concurrent.md:162` |
| P3 | `wiki/diagrams/request-call-chain-functions.yaml:14,22,34` | ④ 没画进 ③ 的框，④→⑤ 是实线箭头，「第 5 站由第二次 RPC 触发」的注离 ⑤ 很远 | 截图 `request-call-chain-functions.png` |
| P3 | `wiki/diagrams/concurrent-request-schedule.yaml:32-34` | 三条出边的竖线只隔 12–18 px；「成功 → 再看 waiting」标签离回线约 100 px | 截图 `concurrent-request-schedule.png` |
| P3 | `wiki/concepts/learning-guide.md:46`、`:91` | 指路仍指向 79/96 页还没有的「对照源码」；已加退路说明 | `grep -l '^## 对照源码'` 17/96 |
| P3 | `wiki/diagrams/concurrent-request-schedule.yaml:17` | 图上有数据类名 `SchedulerOutput`，检查器没抓到 | 第六节 |

## 八、附带发现（不在三份报告范围）

| 级别 | 位置 | 问题 | 证据 |
|---|---|---|---|
| P2（底稿） | `docs/mainline/02-forward.md:454`（§5.5） | 稀疏 attention 的出处写的是 `va:sfa_v1.py#L1603-L1649` 的 `_execute_sparse_flash_attention_process`，但 GLM 走的 `AscendIndexerKPoolMLAImpl` 重写了这个方法，推理时执行的不是 sfa_v1 那一份。问题和 P1-1 同类：指向了不执行的代码 | `indexer_kpool_mla_v1.py:557` `class AscendIndexerKPoolMLAImpl(AscendSFAImpl)`；`:1065` 重写 `_execute_sparse_flash_attention_process`，`:1092` 调 `DeviceOperator.execute_sparse_attention_indexer_kpool_mla`（`device_op.py:719/1724`）；`sfa_v1.py:1994` 只是基类 forward 里的调用点。页面没有受影响：`one-request.md` 的 sources 第 25 条 `sfa_v1.py#L1994-L2028` 指的是调用点，正文也没有角标用到它 |

建议：§5.5 的出处改成 `indexer_kpool_mla_v1.py#L1065-L1104` 加 `device_op.py` 对应的 `execute_sparse_attention_indexer_kpool_mla`，另外核一下 §5.5 里的 `_sparse_attention_pytorch`「PyTorch 参考实现」是不是也只有单测调用。
