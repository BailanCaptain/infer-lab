# data-parallel 审查记录

## P5 写作记录（2026-09-28，第 05 批深改＋补节）

**改了什么。** 按「先直觉、后数字」重排为九节：DP 是什么、空闲组为什么陪跑（首图）→ 为什么要分组、代价在哪 → vLLM 里一个 DP 组由什么组成（EngineCore、DP coordinator、request wave；DP 执行组与 DP 通信组；DP 与 EP 的关系）→ 请求怎样派进某一组（只写结论，算例链接 concurrent-requests）→ 两组每一步怎样对齐宽度 → **新补节**：空闲的组由谁叫起来陪跑、陪跑时算什么（为什么非跑不可 / 谁来决定跑 / 陪跑时算什么 / 什么时候停、怎样再叫醒）→ 放到 GLM 双机 → 常见误解 → 对照源码（五个 H3 齐全）。正文约 1,600 字增到约 11,900 字（不含空白与围栏；wiki:audit 计 13,551 字），其中教学正文约 7,800 字，行内代码 0 处；全页证据角标 30 处，C 级 23 处（约 77%），D 6 处、I 1 处，全部在对照源码区。无 calc：本页的数都是别页推导过的结论，只写结论加链接。

**图。**
- `data-parallel.yaml`（重画，首图）：新请求只派进 DP 组 0；组 1 两个队列都空，但持有另一部分专家，用 dummy run 跑同一步，和组 0 一起进出 EP 通信；假输入的输出丢弃，替组 0 算的专家结果送回。
- `data-parallel-loop.yaml`（新建，代码流程图）：一个 DP 组 EngineCore 主循环的分支（本地执行了吗 → 本地有请求或全局仍运行 → dummy batch / 空转 → 每 32 圈全局 All-Reduce → 一起暂停、等唤醒），并标出主线第 1 站与第 2–7 站的位置。
- `dp-ep-groups.yaml`（重画为 figure 格式）：4 卡 DP2×TP2 开 EP，区分 DP 执行组、DP 通信组、EP 组；图注说明不是官方规模、不是 4 份完整模型。

**数字取自。** 01 §B1（陪跑链路、对齐规则、场景 M 与 M′ 的 6048 / 4→6048、31 步、进程与唤醒）；03 §B4（场景 M 纯 decode 步 64 宽回放、DP1 28 行有用、M′ 的 4→64、dummy 的本地 4 个 token 来自 1+3）。部署参数 32 条 / 8192 token 取自 two-node「关键参数各管哪一步」；E144–E287 取自 expert-parallel 连续编号表。所有宽度只写结论并链接 concurrent-requests（唯一出处），未重算。

**核心概念对照的源码（均按钉住 commit 实读）。**
- DP 在 v1 的实现：`vllm@0fc695fc` core.py L1152-1162（只有 MoE 且 DP>1 用 `DPEngineCoreProc`，非 MoE 各组按 DP=1 运行）、utils.py L1090-1096（wave 协调只对 MoE 开）、coordinator.py L23-58、L145-160（协调器职责、100 ms 推送）。
- 派组：core_client.py L1398-1426（`waiting * 4 + running`，本地先加计数，记录归属）；serving.py L398-411、input_processor.py L258-268（请求头与越界报错）。
- 每步对齐：`vllm-ascend@db701c1f` model_runner_v1.py L692-740（2×dp_size int32、SUM 后取 max、allow_dp_padding / 草拟取最大）、L5383-5389（图模式取 min）、utils.py L1257-1303（跳过条件）、ascend_config.py L317（`dp_allreduce_on_npu` 默认 False，顺带关闭了 01 §B1 待核 3 的默认值问题）。
- 陪跑：core.py L1869-1945（`run_busy_loop`：本地未执行且 本地有请求或 `engines_running` → `execute_dummy_batch`；每 32 步 `_has_global_unfinished_reqs`）、parallel.py L683-707（SUM 两元素张量）、core.py L1788-1855（收请求、START_DP_WAVE、恢复报错）、multiproc_executor.py L331-332 → worker.py L972-973 → model_runner_v1.py L652-656（`decode_token_per_req = 1 + num_speculative_tokens`）→ L3408-3452（dummy 同样走对齐）、L3642-3652（草拟模型陪跑）。
- DP 与 EP：parallel_state.py L1833-1875（DP 通信组 = 同 TP 位置跨组配对；EP 组大小 = DP×PCP×TP）、fused_moe/config.py L1118-1200（EP 时 ep_size = 展开后的 tp_size；**不开 EP 时 TP 展开到 DP×TP 全部卡**）、glm5_next.py L1453-1508（GLM 按 EP rank/size 算本卡专家段）。
- 版本差异：`vllm-ascend@2ed6cbba` worker.py L1079-1086、`@baa023ad` worker.py L1205-1208（dummy 改用 `uniform_decode_query_len`，加 `skip_gdn_state_update=True` 与显存统计）；两版 model_runner_v1 的 `_sync_metadata_across_dp` 固定走 CPU gloo，无 `dp_allreduce_on_npu`。

**旧版信息清单勾选。** 旧版 32 条（F1–F32）逐条勾选，清单与去向见 scratchpad `p5/data-parallel-facts.md`。结论：30 条保留（多数展开）；F6 的 (2,1)/(0,3) 数值算例按任务要求挪到 concurrent-requests「第 1 站 入口」（同一公式的场景 M 算例）；旧版链接的 `sources/glm-5-3-flash-baseline.md` 改为按标准链接 two-node「部署前提」。别名「DP 协调器」「空闲组陪跑」因与 engine-processes / concurrent-requests 重复被 lint 拒，未加；relation 指向 two-node 因对方已反向指来，按 lint 规则删去。

**写作中纠正的一处。** 初稿写了「只设 DP、不开 EP 时每个执行组各有一整套专家」，对照 fused_moe/config.py L1118-1200 发现错误：上游此时把 MoE 层按 TP 展开到全部 DP×TP 张卡。已改为正确说法，并据此说明 MoE（而不是 EP）才是需要陪跑的条件，与 core.py L1152-1162 一致。

**任务单与源码的出入（只报告）。** 任务单提到的 `_maybe_dummy_run` 在 `vllm@0fc695fc` 与 `vllm-ascend@db701c1f` 中都不存在；实际函数是 `execute_dummy_batch`（EngineCore / executor / worker 三层）和 `_dummy_run`。

**验证。** `pnpm wiki:lint`：本页与三张图 0 报错（其他页仍有 ascend-patch-system、hardware-devices、npu-platform 3 处）；`pnpm wiki:diagrams --check`：178 张图与 spec 一致；`pnpm wiki:audit`：本页 0 问题（失败项仅 npu-platform 的 relations.kind）；`pnpm check:content`：通过。未截图、未起服务，浏览器验收留给审查环节。

**待核（已写在页末）。** `_dummy_run` 内部是否有层走简化路径（L3470-3600 未逐行读）；一组缺席时的具体超时报错；陪跑一步的真实耗时；v0.26 / main 配套的上游 vLLM 版本未钉住，EngineCore 主循环与打分只核到 `vllm@0fc695fc`。

## P5 审查（09-28）

独立审查，只审不改。行号均指 `wiki/concepts/data-parallel.md` 工作区版本，源码行号指 `tools/repos/` 下的钉住 checkout。

**分数：7 / 10。** 机制、数字、源码对照都扎实，扣分主要在一处：页面自己纠正了「触发陪跑的是 MoE，不是 EP」，但 summary 和第一屏仍按「开了 EP 以后……所以陪跑」来讲。改掉这一处，再补回打分的权重算例，可到 9 分。

### 1. 初学者测试

只读前两屏（L49–82），我能说出的一句话是：「DP 把请求分给几个各自排队、各自调度的执行组，一个请求只在一组里算；MoE 模型里各组的卡要一起进同一层专家通信，所以没请求的那组每步也要用假输入陪跑，代价是每步对齐宽度、每层通信互相等待、结束后最多一起空跑 31 步，以及负载不均。」

问题在于：照 L55 原文，初学者会把条件说成「**开了 EP** 才要陪跑」。这正是 P1-1。

### 2. 核心概念（逐条对照源码）

| # | 页面说法 | 判定 | 证据 |
|---|---|---|---|
| 1 | 触发陪跑的是 MoE，不是 EP（L88、L109、L193） | **对** | `vllm@0fc695fc` core.py L1153–1164：`data_parallel and model_config.is_moe` 才用 `DPEngineCoreProc`，否则强制 DP=1；L1715–1716 断言只给 MoE 用。utils.py L1094：协调器的 `enable_wave_coordination=model_config.is_moe`。三处开关都看 `is_moe`，没有一处看 `enable_expert_parallel` |
| 2 | 不开 EP 时，FusedMoE 把每个专家切片摊到全部 DP×TP 张卡（L109） | **对** | fused_moe/config.py L1074–1082：`flatten_tp_size = dp_size * pcp_size * tp_size`；L1165–1192：`use_ep` 要求 `enable_expert_parallel`，否则返回 `tp_size=展开后大小, ep_size=1` |
| 3 | 本步没执行时，「本地还有请求 或 全局运行标志亮着」就跑 dummy batch，两者都否才空转（L146） | **对** | core.py L1887–1899 |
| 4 | 每 32 圈全局检查一次，最多再空跑 31 步；DP0 报 wave 结束，wave 加 1（L152、L162） | **对** | core.py L1906–1924、L1928–1945（非 32 的倍数直接返回 True） |
| 5 | DP coordinator 不下令每一步，只在各组停着时收到前端的新请求消息，广播唤醒其他组（L89、L164） | **对** | coordinator.py L342–360（`engine_to_exclude`，只叫醒别的组） |
| 6 | 打分 `waiting×4+running`，取最小，本地先加一笔，记录归属（L113–117） | **对** | core_client.py L1398–1426（本地加的是 `client_count`，页面写「加上一笔」，比写死「加 1」更准） |
| 7 | 对齐用 2×DP 小表，SUM 后本地取 max / 图模式取 min，走 CPU 组（L123–132） | **对** | `vllm-ascend@baa023ad` model_runner_v1.py L796–834（与 db701c1f 结构相同） |
| 8 | 非 MoE 跳过对齐；MoE 只在 KV consumer 且满足 MC2 条件时跳过（L132） | **对** | `vllm-ascend@db701c1f` utils.py L1257–1279 |
| 9 | 假输入是一条 decode 的形状，1 + 草拟 token 数 = 4（L156） | **对** | vllm gpu_model_runner.py L814；vllm-ascend main worker.py L1205–1208 |
| 10 | GLM 按 EP 编号和大小算本卡连续专家段；node1 持有 E144–E287（L107、L168） | **对** | `vllm-ascend@db701c1f` glm5_next.py L1453–1508 中 `physical_expert_start = ep_rank * n_local_physical_experts`；288/16=18，rank 8 起点 144 |
| 11 | 写手说 `_maybe_dummy_run` 不存在 | **对** | 在 vllm、vllm@v0.26、vllm-ascend（main / v0.26rc / v0.23）、rfork 六个 checkout 里 grep 都是 0 处；`def execute_dummy_batch` 在各仓都有 |

**机制本身没有讲错的地方。** 问题出在 P1-1：页首的表述和上面第 1 条自相矛盾。

### 3. 数字（对照底稿）

32 条 / 8192 token（01 §B2 标题）、100 ms、31 步、4 = 1+3（01 L811）、场景 M 的 48→64 与 28→32（03 L586–590）、6048 宽且 DP1 只有 28 行有用（01 L845）、128 行门槛（03 L591）、E144–E287、45 层主干 / 42 个 MoE 层，都和底稿一致。宽度只写结论，并链接到 concurrent-requests，符合「单一出处」规则。写手自报的「dp_allreduce_on_npu 默认 False」**未核**（不影响正文结论）。

### 4. 全库「陪跑」说法是否一致（只列不改）

| 位置 | 原意 | 判断 |
|---|---|---|
| **data-parallel.md L5（summary）** | 「MoE 模型开了 EP 以后……所以没有请求的那组也要……陪跑」 | **错误**：写成了一般条件，和本页 L109 相矛盾（见 P1-1） |
| **data-parallel.md L55** | 「开了 EP 以后，路由专家分放在所有组……所以……陪跑」 | **错误**：理由同上 |
| expert-parallel.md L208 | 专家在跨机 EP16 组里，DP1 持有 E144–E287 | 准确（明确是本部署的口径） |
| expert-parallel.md L210 | DP1 空闲时跑 dummy run，「空批次起点为 4 行」 | 准确；「空批次」这个说法和本页的「假输入 / 一条 decode 形状」不统一（P3） |
| expert-parallel.md L368（对照源码·开销和什么时候别开） | EP 的代价包括「跨 DP 的陪跑」 | **需要补一句**：放在「什么时候别开 EP」里，读者会以为关掉 EP 就不用陪跑；应注明陪跑来自 MoE+DP，EP 只是让陪跑的组替对面算真实专家 |
| concurrent-requests.md L90、L372、L374、L383 | 路由专家分在两台机器上，所以两组要一起通信、要陪跑 | 准确（部署口径） |
| one-request.md L196 | 「EP16 下 MoE 的通信需要 16 张卡同时参与……所以 DP1……跑 dummy batch」 | 准确（用「EP16 下」限定了部署） |
| one-request.md L355、L536、L550 | MC2 要 16 卡同时进出；32 步停；MoE 专家分在 16 卡上所以要陪跑 | 准确 |
| 底稿 01 §B1 L787 | 288 个专家摊在 16 张卡，两组合起来才完整，所以要空跑 | 准确（部署口径，按 MoE 讲） |
| 底稿 03 §B4 L593 | 场景 M 里 DP1 被拉宽的 36 格和 20 行，称为「空闲的组陪跑」的代价 | **需要补一句**：和 EP 无关，但场景 M 的 DP1 有 7 条请求，并不空闲、也不跑 dummy batch，这是被补齐到对面宽度的代价。本页 L152 已经写明「本地有请求可算就不跑假输入」，两处说法冲突 |

没有哪一页把「EP16 跨两组」写成陪跑的一般原因。写成一般条件的，只有本页 L5、L55，以及 expert-parallel L368 的隐含推论。

### 5. concurrent-requests.md 的改动

`git diff p4-checkpoint -- wiki/concepts/concurrent-requests.md` **为空**，`git status` 显示工作区也没有改动；最后一次改它的提交就是 p4-checkpoint（14591fd）。所以写手**并没有改这一页**。所谓「挪过去」，实际做法是：删掉本页的 (2,1)/(0,3) 算例，改成链接到 concurrent-requests 早已有的场景 M calc（L111–118）。那份 calc 本身是对的：0×4+12=12，0×4+7=7，选 DP1，和 core_client.py L1415 的公式一致；页面结构没动，`pnpm wiki:audit` 通过。问题见 P2-1。

### 6. 有没有丢信息

对照 `git diff p4-checkpoint` 里删掉的行和 facts 清单 F1–F32：旧版的 5 个 H2 在新版都能找到去处。

- **没保留的两个别名**「DP 协调器」「空闲组陪跑」：它们分别已经是 engine-processes、concurrent-requests 的别名（已 grep 确认），lint 要求别名在全库唯一，所以不加是合理的。而且这两项是新增，不是旧版就有的。本页已经有 `DP coordinator`、`DPCoordinator`、`陪跑` 三个别名可以命中。可选做法：本页是陪跑机制的出处，可以考虑把「空闲组陪跑」这个别名从 concurrent-requests 挪到本页（P3）。
- **F6 算例被删**：删得不完全合理，见 P2-1。
- **另外抽查 4 条**：F7（100 ms 推送，coordinator.py L149–157、L257–260）保留且正确；F13（GLM 专家段）保留且正确；F18（[3,0]+[0,1]=[3,1] 取 3）保留且正确，已对照 model_runner_v1 L816–823；F22（跳过条件）保留且有展开，已对照 utils.py L1257–1279。

### 7. 格式、链接与验证

- 「对照源码」的五个 H3 齐全，顺序正确（L197/207/214/222/233）；「版本差异」L226 里 v0.23、v0.26、main 都有。
- 对照源码之上没有证据角标；正文行内代码 0 处（汉字 4960 个）；没有 calc；表格没有和 calc 相邻。
- 链接：本页出站 23 条、全库指向本页 16 条，全部能解析到文件和锚点。检查用的是和 `src/content/wiki/anchors.ts` 相同的 slug 规则写的脚本。
- `pnpm wiki:audit`：通过，本页 26 条来源全部 ✓。`pnpm wiki:lint`：通过，本页 0 条提示。
- 浏览器：用 Playwright 在 1440 宽下截了三张图，都正常渲染，截图在 scratchpad 的 `dp-diagram-0/1/2.png`。在 1280 宽下，图容器 889 px、SVG 900 px，出现 11 px 横向滚动；这应当是全站图宽的共性问题（P3）。

### 8. 问题清单

**P1**

- **P1-1｜L5 summary、L55｜陪跑的触发条件写成了 EP。** 两处都是「开了 EP 以后……所以……陪跑」，把 EP 讲成了一般条件，和本页 L88、L109、L193 以及源码（core.py L1153、utils.py L1094 只看 `is_moe`）相矛盾。summary 是问答检索的底子，第一屏是初学者形成概念的地方。**改法**：summary 改成「MoE 模型在 DP>1 时，MoE 层横跨所有组的卡，各组每一步都要一起进这层的通信，所以……」；L55 改成「MoE 层横跨所有组的卡：开了 EP 时，每组的卡上各有一部分整专家；不开 EP 时，每个专家被切成片摊到全部卡上。无论哪种，任何一组算 MoE 层都要别的组同时参与……」，再链接到 L109 那一节。首图底框「MoE 层 · EP 通信」可以改成「MoE 层通信（GLM 用 EP）」。

**P2**

- **P2-1｜L113–115｜打分里 ×4 的权重没有任何算例体现。** 旧版的 (2,1)/(0,3)→9/3 能说明「两组都是 3 条请求，等待多的那组被避开」。新版改成链接场景 M，但场景 M 两组的 waiting 都是 0（12 对 7），×4 完全没有起作用。机制页本来就是打分公式的出处。**改法**：在 L115 补一句行文算例（不用 calc），例如「两组都有 3 条请求：等待 2、运行 1 的得 9 分，等待 0、运行 3 的得 3 分，新请求去后者」。
- **P2-2（他页，只列）｜expert-parallel.md L368**：把「跨 DP 的陪跑」列为 EP 的代价。改法见第 4 节。
- **P2-3（底稿，只列）｜03 §B4 L593**：把场景 M 中 DP1 被补齐的代价称为「空闲的组陪跑」，和本页 L152 冲突。改法：改称「较闲的组被拉到对面宽度的代价」，把「陪跑」留给变体 M′。

**P3**

- L188：误解一条的纠正只写了「本地没执行且全局运行」，漏了 L146 的另一条件「本地还有未完成的请求」。改成「本步没执行任何请求，且本地还有请求或全局仍在运行」。
- L89：「至少隔 100 ms」是负载有变化时的最小间隔；负载不变时是 5000 ms 推一次（coordinator.py L258–260）。可以补半句。
- 陪跑流程图（data-parallel-loop）里「新请求到来时由 DP coordinator 叫醒」：更准确的说法是，被派到请求的那组自己醒，coordinator 只叫醒其他组；正文 L164 写对了，图可以跟着改。
- expert-parallel L210 的「空批次」和本页的「假输入」叫法不统一。
- 别名「空闲组陪跑」的归属（见第 6 节）。
- 图在 1280 宽下有 11 px 横向滚动（全站问题，不单是本页）。

### 9. 跳过了什么

- frontmatter 的来源清单（L9–35）没有读，交给 audit 校验。
- 「对照源码」正文（L195 以后）只做了 grep，只读了 L226、L249 两行 grep 命中的内容。
- 正文除了图的围栏，没有代码块。
- 没有读 HANDBOOK、docs/plans/、TERMS.md。
- 写手自报的 `dp_allreduce_on_npu` 默认值未核。
- 没有哪次读取被拦。

## P5 修订记录（09-28，按上方审查处理 P1-1、P2-1）

**P1-1 陪跑的触发条件（已改）**

- summary 改成：MoE 模型在 DP>1 时，MoE 层横跨所有组的卡，各组每一步都要一起进这层的通信，所以空闲组要陪跑；并写明「由 MoE 触发，和是否开 EP 无关」。
- 第一屏（原 L55）改写：MoE 层横跨所有组的卡，开 EP 时以整个专家为单位分放，不开 EP 时每个专家切片摊到全部卡上（页内链接到「在 vLLM 里，一个 DP 组由什么组成」一节）；无论哪种，都要各组一起进通信，所以 MoE 模型在 DP>1 时空闲组要陪跑；末尾补「触发陪跑的是 MoE，不是 EP」。
- 为了全页统一，另补两处短句：首图说明开头注明「图按开了 EP 的情形画，GLM 双机就是这样」；「为什么非跑不可」里「空闲组的卡上有另一部分专家」限定为开 EP 时，并补上不开 EP 时是每个专家的一部分切片。图本身未改。
- 依据：`vllm@0fc695fc:vllm/v1/engine/core.py#L1153-L1164`（只看 `is_moe`）、`vllm/model_executor/layers/fused_moe/config.py#L1074-L1082`（`flatten_tp_size = dp_size * pcp_size * tp_size`），本轮都读了原文。

**P2-1 ×4 权重的算例（已补回本页）**

- 旧版（`p4-checkpoint` L39）是 (2,1)/(0,3) → 9/3 的一句话算例。本轮在「请求怎样派进某一组」里补回一段 GLM 双机 DP2 的行文算例（不用 calc，数字标明是示意）：DP0 等 1 跑 24 → 28 分，DP1 等 4 跑 14 → 30 分；按条数 DP1 更少（18 对 25），但它有 4 条待 prefill，新请求派给 DP0。接着演示本地加一笔：DP0 记成等 2 → 32 分，下一次推送前的下一条请求派给 DP1。另说明两组等待都是 0 时 4 倍不起作用，场景 M 即如此，并保留到 concurrent-requests 第 1 站的链接。
- 公式核对：`vllm@0fc695fc:vllm/v1/engine/core_client.py#L1415` `score = waiting * 4 + running`，严格小于才替换（L1416），选中后 `current_counts[eng_index][0] += self.client_count`（L1421）。
- 数字出处：每组每步 8192 token 预算取自 01 §B2（本页已有链接）；「这一笔就是 1」取自 01 §A1（L572、L600：`--api-server-count 1` 时 `client_count` 为 1）。24/14/1/4 是为说明 4 倍作用选的示意值，均在每组 32 条上限内。
- 未改 concurrent-requests.md。

**本轮未处理**：P3 各条（L188 漏条件、100 ms / 5000 ms、流程图叫醒说法、「空批次」叫法、别名归属、1280 宽横向滚动）不在本次任务范围，保留。底稿 03 §B4 的 P2-3 只按要求补了同一句，未改「空闲的组陪跑」这个称呼。

**验证**：`pnpm wiki:lint` 通过，本页 0 条提示（全库另有 19 条 mark-flood 待留意，都在别的页）；`pnpm wiki:audit` 通过，本页来源 26 条，正文 14178 字 / 9 节。两个新锚点（页内 `#在-vllm-里一个-dp-组由什么组成`、expert-parallel 指向本页的 `#dp-是什么空闲的组为什么还要陪跑`）用 `src/content/wiki/anchors.ts` 的 `headingSlug` 算过，一致。未改图，未跑 `wiki:diagrams`；未做浏览器验收。

## P5 复审（09-28）

快速复审，只核对上方修订记录是否落实。行号指 `wiki/concepts/data-parallel.md` 工作区版本；源码用 `git show 0fc695fc:<路径>` 读 `tools/repos/vllm`（HEAD 即 `0fc695fc6d`）。

**分数：9 / 10。** P1-1、P2-1 都已落实，新增内容说法正确、算术无误、锚点可解析。剩下的只有底稿 P2-3 的称呼（上轮已标「只列」）和 P3 各条。

**1. summary 与全页统一成「MoE 模型在 DP>1 时空闲组要陪跑」：落实。**
- L5 summary：「MoE 模型在 DP>1 时……所以空闲组要陪跑……这件事由 MoE 触发，和是否开 EP 无关」。
- L55 第一屏：开 EP / 不开 EP 两种分法并列，「所以 MoE 模型在 DP>1 时，空闲组要陪跑」，末句「触发陪跑的是 MoE，不是 EP」。
- grep「EP」（命中 18 行）与「陪跑」（命中 27 行）逐处看过：L61「图按开了 EP 的情形画」、L99/L107 讲 EP 组构成、L109/L197/L206 讲不开 EP 的切法、L146 按开 / 不开 EP 分别说明、L88/L207 限定为「MoE 模型在 DP 大于 1 时」、L190 限定为「在 GLM 双机里」。全页已无「开了 EP……所以陪跑」的说法。
- 首图底框文字没有改（修订记录已说明），L61 的说明已把前提交代清楚，不再扣分。

**2. 打分算例：落实。**
- 公式：`vllm/v1/engine/core_client.py` L1414–L1421（@0fc695fc）为 `waiting, running = current_counts[idx]`、`score = waiting * 4 + running`、`if score < min_score` 时替换、选中后 `current_counts[eng_index][0] += self.client_count`。与本页 L113「等待 × 4 + 运行，挑分数最小的那组」、L119「本地给那组的等待计数加上一笔」一致（下标 0 就是 waiting）。
- 算术（L117、L119）：DP0 1 × 4 + 24 = 28，DP1 4 × 4 + 14 = 30；条数 25 对 18；本地加一笔后 DP0 2 × 4 + 24 = 32，32 > 30 派给 DP1。全部正确。
- 方向：源码取严格更小的分数，L117「派给分数更低的 DP0」、L119「派给 DP1」方向正确。算例也把「条数少的组反而不被选」讲出来了，×4 的作用有了体现，并说明了场景 M 里 4 倍不起作用。

**3. expert-parallel 与底稿 03 §B4 的补句：落实（底稿一处附注）。**
- `wiki/concepts/expert-parallel.md` L368：「严格说，触发陪跑的是 MoE 本身，不开 EP 时专家也切在所有卡上（见 [Data parallel](data-parallel.md#dp-是什么空闲的组为什么还要陪跑)）；本部署开了 EP16，结论相同。」锚点按 `src/content/wiki/anchors.ts` L8–L13 的 `headingSlug` 由 data-parallel L49 的 H2 算出，完全一致。
- `docs/mainline/03-sample-decode.md` L595（场景 M 表下、L593 之后）：同一句，出处写 `` `data-parallel.md` `` 并带 `[C]`；变更表 L731 有记录。
- 说法核对：`vllm/v1/engine/core.py` L1153–L1164 只凭 `is_moe` 决定用 `DPEngineCoreProc`，非 MoE 按 DP=1 运行；`fused_moe/config.py` L1073–L1081 的 `flatten_tp_size = dp_size * pcp_size * tp_size`，即不开 EP 时 MoE 层切到全部卡上。两处补句都正确。
- 附注（P3）：底稿里的出处是反引号文件名，不是可点的 markdown 链接，也没有锚点。03 全文没有一个 markdown 链接，引用页面一律写反引号文件名（如 L279–L282、L476–L479），所以这符合底稿惯例，不算未落实。

**4. `pnpm wiki:audit`：通过。** exit 0；本页 `concepts/data-parallel.md` 来源 26 条全部 ✓，正文 14178 字 / 9 节；全库 133 页、1982 条来源，无效 commit 0、文件不存在 0、行号越界 0；名单 26 页达标 26 页。输出存于 scratchpad `dp-recheck-audit.txt`。

**仍未处理（不影响本次结论）**
- P2-3（底稿，只列）：03 L593 仍把场景 M 里有 7 条请求的 DP1 被拉宽称为「空闲的组陪跑」；L595 的补句没有改这个称呼。
- P3：上轮第 8 节 P3 各条，外加本节第 3 条的附注。

**跳过了什么**：没有读 frontmatter 来源清单、「对照源码」正文、HANDBOOK、docs/plans/、TERMS.md；没有跑 `wiki:lint`，没有做浏览器验收（本轮不在核对范围，修订也没改图）。没有哪次读取被拦。

- **v0.23 列表头复核（09-28）：改了。** 原表头写「v0.23 列核自镜像 db701c1f，在 2c59ff10 上是否逐项相同未核」，把 db701c1f 混进 v0.23 列。按 `git diff db701c1f 2c59ff10` 核：对齐与通道开关（镜像 model_runner_v1.py L692–L740、L5383–L5389，ascend_config.py L315–L318，utils.py L1257–L1303）不在任何差异块里，`decode_token_per_req` 两边都是 1 + 草拟数；但「dummy batch 的额外动作」一格原写「无」，2c59ff10 的 `execute_dummy_batch`（worker.py L985–L987）先调 `log_memory_stats()`，镜像（L972–L973）没有。已把该格改为按 2c59ff10 写并注明镜像差别，表头改为「v0.23 列 = 2c59ff10，db701c1f 单独注明」。两边都没有 `skip_gdn_state_update`。

## 基础讲清修订（09-29）

起点：排查结论「基本合格，仅第一节假定已懂 MoE / KV cache」。按「是什么 → 为什么 → 怎么做 → 细节 → GLM → 误解 → 源码」小修，不整页重写；「请求怎样派进某一组」「两组每一步怎样对齐宽度」（含 [3,0]+[0,1]）「陪跑」三节与对照源码五个 H3 原样保留。

### 逐节改了什么
- **原「DP 是什么，空闲的组为什么还要陪跑？」拆成三节。**
  - 「DP 是什么？」：首句补「整份模型复制几份、每份一组卡，请求分给各组」；加一个 A、B、C、D 分两组的示意例子，说明稠密模型里两组互不通信；KV cache 改为一句话定义并链 kv-cache.md；加一句与 TP 的对照（TP 切同一请求的矩阵乘，DP 分不同请求），口径与 tensor-parallel 页「三者分的东西不同、可叠加」一致。
  - 「为什么需要 DP，代价在哪？」：先讲一组卡能同时服务的请求有上限（scheduler 每步条数 / token 上限、KV cache 池空间），再用示意数演算；代价写稠密模型的卡和显存翻倍，以及原有的「不让单次前向变快、不保证吞吐翻倍、派定不迁移」。
  - 「MoE 模型里，两组为什么不能各跑各的？」：先一句话讲 MoE、router、路由专家（链 moe.md）和 EP（链 expert-parallel.md）；再讲专家为什么不跟每组复制（示意显存账）、借参考资料的「attention 用 DP、专家用 EP」讲法；然后跟一个 token 走一遍 EP 通信，再接原有的 dummy run、图 data-parallel、三个等待点和四种并行对照表。
- **GLM 数字挪出基础节**：原「为什么要分组」里的每组每步 32 条 / 8192 token 挪到「放到 GLM 双机」第 2 步；派组例子去掉「放到 GLM 双机」字样，只留示意数。
- **vLLM 组成一节**：「EP 和 DP 不是二选一」句末补回指「attention 用 DP、专家用 EP」。
- **常见误解第一条**：补「稠密模型是这样；MoE 模型不是」，与新第一节不矛盾。
- frontmatter summary 按新顺序改写（≤200 字），updated 改为 2026-09-29。

### 新增的演算和图
- 演算 1（为什么需要 DP）：每组每步最多 4 条，8 条同时到来：不开 DP 本步 4 条在算、4 条排队、产出 4 个 token；DP2 两组各 4 条、0 条排队、产出 4 + 4 = 8 个 token；单条仍每步 1 个 token。
- 演算 2（专家为什么只放一份）：示意权重 100 GB，路由专家 90 GB、其余 10 GB：两组整份复制 2 × 100 = 200 GB，只复制其余部分 2 × 10 + 90 = 110 GB。
- 演算 3（一个 token 走一遍 EP）：8 个专家 e0–e7，组 0 持 e0–e3、组 1 持 e4–e7，token 选中 e1、e6：e1 本地算，e6 发到组 1 算完送回再加权相加。
- 新图 `data-parallel-basics`：左边一份模型（整份权重方块 + 运行 4 格 A–D + 等待 4 格 E–H），右边 DP2 两份副本各运行 4 格、等待 0 格，底部写产出 4 与 4 + 4 = 8。
- 改图 `data-parallel`：两组的专家框补上示意编号 e0–e3 / e4–e7，底注改成「选中 e1、e6，e6 在组 1 算完送回」，与正文演算 3 对上。
- 新增图元：无（用现有 frames / matrices / grids / texts）。

### 信息清单勾选
逐条清单与勾选在 scratchpad `data-parallel-basics-facts.md`（F1–F57）。结果：全部保留，无删除；挪动的有 F4–F7、F11–F13（进 MoE 新节）、F9 的 GLM 数字（进 GLM 一节），F26 去掉 GLM 字样与 8192（8192 已在 GLM 一节）。

### 对外影响
- 标题改名使旧锚点 `data-parallel.md#dp-是什么空闲的组为什么还要陪跑` 失效；全库唯一引用在 expert-parallel.md（该页正由别的写手修改，本次不动它），应改指 `data-parallel.md#moe-模型里两组为什么不能各跑各的`。

## 基础讲清审查（09-29）

审查对象：本页 09-29 小修（拆出「DP 是什么」「为什么需要 DP，代价在哪」「MoE 模型里，两组为什么不能各跑各的」三节；新增 3 处演算、新图 `data-parallel-basics`、改图 `data-parallel`）。只审不改。

### 0. 学习顺序
开头先讲是什么（整份复制成几份、A–D 分两组的直觉例子、稠密模型两组互不通信），再讲为什么（一组每步有条数 / token / KV 池上限），然后才是演算、MoE 和 vLLM 细节。顺序对，无 P1。

### 1. 逐节初学者检验（GLM 之前 7 个 H2，7/7 通过）
| H2 | 初学者读完能讲出的一句话 | 结论 |
|---|---|---|
| DP 是什么？ | 把整份模型复制几份放在几组卡上，请求分给各组，一个请求只在一组里算。 | 通过 |
| 为什么需要 DP，代价在哪？ | 一组每步能排的请求有上限，多一组就多一份上限，同时在算的条数翻倍，单条不变快；代价是多一组卡和一份权重，吞吐不保证翻倍。 | 通过 |
| MoE 模型里，两组为什么不能各跑各的？ | 专家只放一份、分在两组卡上，token 要跨组找专家，所以两组每层要一起通信，没请求的组也得用假输入陪跑。 | 通过 |
| 在 vLLM 里，一个 DP 组由什么组成？ | 每组一个 EngineCore（scheduler + KV 池），全局一个 coordinator 汇报负载、广播唤醒；执行组和通信组是两回事；EP 组包住全部卡。 | 通过（「前端」未定义，见 P2-2） |
| 请求怎样派进某一组？ | 按「等待 ×4 + 运行」打分挑最小，派定不迁移。 | 通过 |
| 两组每一步怎样对齐宽度？ | 前向前 All-Reduce 交换 token 数和图模式，[3,0]+[0,1]=[3,1] 取最大 3，图模式取保守。 | 通过（末段术语偏密，见 P3） |
| 空闲的组由谁叫起来陪跑，陪跑时算什么？ | 空闲组自己的 EngineCore 看本地和全局标志决定跑 dummy batch，假输入对齐到对面宽度，每 32 步查一次才停。 | 通过 |

第一节不再假定读者懂 MoE：第一节只出现「稠密模型」（当场定义）和 KV cache（一句话定义 + 链 kv-cache.md）；MoE、router、路由专家、EP、集合通信在第三节开头先定义再用。唯一前向引用是第二节「两组之间的同步（MoE 模型才有，见下一节）」，是限定语加指路，可接受（P3）。

### 2. 演算逐个手算
- 演算 1：每组每步 4 条、8 条到达。不开 DP：算 4、排 4、产出 4；DP2：组 0 A/C/E/G、组 1 B/D/F/H，各 4、排 0、4 + 4 = 8。与第一节 A、C→组 0，B、D→组 1 接得上。✓
- 稠密代价：2 × 40 = 80 GB。✓
- 演算 2：2 × 100 = 200 GB；2 × 10 + 90 = 110 GB。✓
- 演算 3：8 专家、组 0 持 e0–e3、组 1 持 e4–e7、选 e1/e6 → e1 本地、e6 跨组。✓
- 原有：28 = 1×4+24，30 = 4×4+14，18 = 4+14，25 = 1+24，32 = 2×4+24 > 30 → DP1；[3,0]+[0,1]=[3,1]，max 3（站内达标算例，仍在、正确）；31 步（32 圈检查）；E144–E287 共 144 个 = 288 的一半；{0,8}…{7,15} 共 8 组；4 = 1 + 3；场景 M 6000 + 48 = 6048、DP1 7 × 4 = 28。✓
- 图 `data-parallel-basics`：运行 4 格 / 等待 4 格 / 两组各 4 格等待 0 格 / 4 + 4 = 8，与正文一致。✓

### 3. 核心概念对照固定源码
- DP+EP 组合：`vllm@0fc695fc:vllm/model_executor/layers/fused_moe/config.py` L1165–L1210：`use_ep = dp×pcp×tp>1 且 enable_expert_parallel`；不开 EP 时 `flatten_tp_across_dp_and_pcp` 把 MoE 层按 TP 切到 DP×PCP×TP 张卡（L1080 `flatten_tp_size = dp_size * pcp_size * tp_size`）；开 EP 时 `ep_size = tp_size`（即展平后的 DP×TP）、MoE 内 tp=1。页面「EP 卡数 = DP × TP（上下文并行不开时）」「不开 EP 每个专家切成片」「attention 按 DP、专家按 EP」均对。✓
- 稠密模型两组互不通信：`vllm/v1/engine/core.py` L1153–L1162，非 MoE 的 DP rank 被当成 DP=1 独立运行；MoE 才用 `DPEngineCoreProc`。✓
- 32 步全局检查：同文件 L1931 `step_counter % 32`；dummy batch 在 L1899。✓
- MoE 层的收发：vllm-ascend@db701c1f `ops/fused_moe/token_dispatcher.py` L231–L233 dispatch、L334 combine，是两次独立的集合通信。页面第三节「这一去一回是一次集合通信」不准（见 P2-1）。
- 与 tensor-parallel 页口径：TP 页 L196「TP 分同一次矩阵计算 / DP 分不同请求或批次 / EP 分完整专家，三者可同时用」，本页第一节 TP 对照句与第三节末「组内 TP、attention 按 DP、专家按 EP」一致。✓
- 参考资料（AMD ROCm vLLM MoE 指南）：该文用 DeepSeek-R1、4/8 卡、每卡显存与 KV 数字、DP Attention 与传统 DP 对立的讲法和 AllGather/ReduceScatter 与 AllToAll 两张图。本页用自己的 A–H 请求、40/100/90 GB、e0–e7 示意例子和自己的图，只借了「attention 用 DP、专家用 EP」这个通行说法，未见照抄，不记 P2。

### 4. 没丢信息
抽查 F8（组内 TP 图里没画，L97）、F9 GLM 32 条 / 8192（挪到 GLM 第 2 步，L209）、F16（100 ms，L121）、F25（4 倍的理解，L147）、F43（32/64/96、31 步，L198）、F48（64 / 6048 / 28 行，L216），均在。`git diff` 删掉的行逐条对照：旧第一节 MoE 段、旧「分组是为了」段、旧打分例、旧误解第一条、旧图说，内容均在新位置保留（仅去掉「放到 GLM 双机」字样与重复的 8192）。无丢失。

### 5. 标准第 11–14 条
- 11：新增三处演算齐全。✓
- 12：「是什么 / 为什么 / 代价 / MoE」四块无 GLM 部署数字（32 条 / 8192 已挪走）。后面的机制细节节仍有少量本部署取值（MTP 草拟 3 → 4 个 token、128 行换 AllGather、只起一个 API server、「本部署是 MoE」），不在基础节，记 P3。
- 13：GLM 之后只有常见误解和对照源码。✓
- 14：第一节末只有一个 TP 对照链接，无堆链接。✓

### 6. 图
- `data-parallel-basics`（shot-2）：三块并排，权重方块 + 运行 / 等待格，字清楚、无重叠裁切；不看文字也能看出「一份模型 4 算 4 等 → 两份各 4 算 0 等 → 8」。✓
- `data-parallel`（shot-3）：专家编号 e0–e3 / e4–e7 已补、底注与演算 3 对上；清楚无裁切。两点小瑕疵见 P3（请求 A/B/C 与第一节 B 派组 1 的例子不接；跨组箭头没标出是哪个 token 去 e6、什么结果回来）。
- `pnpm wiki:diagrams --check`：唯一不一致的是 `pipeline-parallel-flow.svg`（别页），本页三张图与 spec 一致。

### 7. 锚点
全库指向本页的带锚链接：expert-parallel.md L523 已改指 `#moe-模型里两组为什么不能各跑各的`；本页内部 `#在-vllm-里一个-dp-组由什么组成`。`pnpm wiki:lint` 通过且无 broken-anchor（lint 按 anchors.ts 校验锚点），其余 24 处为不带锚链接。✓

### 8. audit
`pnpm wiki:audit`：本页写作标准全部 ✓（图先行、图宽、免责 1.5% 等），28 条来源行号有效；全库「ok wiki:audit … 名单页写作标准通过」。本页通过。

### 9. 问题清单与打分：8 / 10

**P1**：无。

**P2**
- P2-1　位置：「MoE 模型里，两组为什么不能各跑各的？」跟一个 token 走一遍那段末句。问题：把 token 发过去和结果送回来说成「一次集合通信」；固定源码里是两次（MC2 为 dispatch 与 combine，AllGather 路径为 All-Gather 与 Reduce-Scatter），与本节后面「一起派发、一起收回」及 TP 页「每个 MoE 层 3 次 DP 集合操作」的计数口径对不上，初学者数通信次数会数错。改法：写成「去（派发）和回（收回）各是一次集合通信，两组的卡每次都要同时进入、同时离开」。
- P2-2　位置：首次出现在「在 vLLM 里，一个 DP 组由什么组成？」DP coordinator 一条（「推给前端」），「请求怎样派进某一组？」整节的主语都是它。问题：「前端」从未定义，初学者容易理解成网页前端；它是打分选组的执行者，属于先用后讲。改法：在 vLLM 组成一节的列表里补一条「前端（API server 进程：接 HTTP 请求、分词、按分数选组，再把请求送进那组的 EngineCore；整个部署一个）」。

**P3**
- 第二节「8 条请求同时到来，都已进入逐个生成 token 的阶段」：刚到的请求还没 prefill，两个前提有点打架。改为「设 8 条请求都已处理完提示词、处在每步生成 1 个 token 的阶段（示意，先不管 prefill）」。
- 第二节「MoE 模型才有，见下一节」在定义前用了 MoE；「吞吐」「批次效率」未解释。可给吞吐加半句「单位时间产出的 token 数」。
- 同一页示意数没有贯穿：稠密代价用 40 GB，MoE 显存账用 100 GB。可统一成一个模型（如稠密部分 10 GB 沿用到两处）。
- 图 `data-parallel`：组 0 里是请求 A/B/C，而第一节 B 派给了组 1；可改成 A/C/E 或换字母。跨组两条箭头可标「token → e6」「e6 结果 ←」，让图自己演出演算 3。
- 第一节加粗定义「把整份模型复制成几份」在 MoE 下不成立（第三节与误解第一条已纠正）；可在定义后补半句「稠密模型如此，MoE 见下文」。
- 机制细节节里的本部署取值（MTP 3 → 4 token、128 行、只起一个 API server、「本部署」）可改成「以 GLM 双机为例」的明示或挪到 GLM 一节，基础节已干净，不急。
- 「两组每一步怎样对齐宽度？」末两段 MC2、AllGather、FusedMoE（另见 vLLM 组成一节）、上下文并行未当场一句话解释，只有指路链接。

### 10. 跳过了什么
- 按纪律未读 frontmatter sources 区、代码块、「对照源码」五个 H3 的正文（只核了标题）、HANDBOOK、docs/plans/。
- 陪跑宽度（64 / 6048）的逐格补齐、dummy batch 形状 1 + 草拟数等原有机制未重新逐行对源码，沿用 P5 审查 / 复审结论，只抽核了 32 步检查与非 MoE 按 DP=1 运行两处。
- 未开浏览器，图的判断基于写手截图与 `wiki:diagrams --check`；未开子代理。

## 基础讲清审查后修订（09-29）

按上方「基础讲清审查（09-29）」第 9 节处理：P2 两条、P3 七条全部修改。

**P2**
- P2-1（一去一回写成一次集合通信）：改为「去和回各是一次集合通信」，并当场给出 dispatch（派发：把 token 的向量发到持有所选专家的卡）与 combine（收回：把专家结果送回 token 所在的卡）两个名字，口径与 expert-parallel 页的 dispatch / combine 一致；「每一次，两组的卡都必须同时进入、同时离开」。
- P2-2（「前端」未定义）：在第一节执行组定义后补一句——前端是 vLLM 里接收用户请求的 API server 进程，不跑模型，只接 HTTP 请求、分词、挑组并送进那组的 EngineCore；vLLM 组成一节的首句补上前端，列表新增「前端（API server 进程）」一条（选组、记录请求归属）。这样图 `data-parallel` 的「前端比较两组的负载」也在定义之后。

**P3**
1. 演算 1 的前提改为「8 条请求都已处理完提示词，正处在每步生成 1 个 token 的阶段（示意，先不管处理提示词那一步）」。
2. 第二节：吞吐在首次出现处加「单位时间一共产出多少 token」，批次效率加「每一步的批次凑得满不满」；「MoE 模型才有」改为「下一节的混合专家模型才需要」，不在定义前用缩写。
3. 示意数贯穿：稠密代价从 40 GB 改为 10 GB（2 × 10 = 20 GB），MoE 显存账的「其余部分 10 GB」注明和上一节的稠密模型一样大。
4. 图 `data-parallel`：组 0 的请求改为 A、C、E（与第一节 A、C 派组 0、新图组 0 的 A、C、E、G 接上）；两条跨组箭头标「token→e6」「e6 结果」，图自己演出演算 3。截图复核：字清楚，不压框。
5. 第一节例子段末补「混合专家（MoE）模型的专家部分并不跟着整份复制，后面单独一节讲」。
6. 机制细节节里的本部署取值改为明示：「以 GLM 双机为例，只起一个 API server」「以 GLM 双机为例，最宽的一组过 128 行换 AllGather」「GLM 双机是 MoE，也没有配 KV 传输」；MTP 3 → 4 个 token 原本就写明是 GLM，未动。
7. 当场一句话解释：MC2（昇腾把专家计算和通信合在一起做的一种实现，按 token 选中的专家逐个发送）、AllGather 路径（先收齐两组输入，每卡只算自己持有的专家）、FusedMoE（vLLM 里实现 MoE 层的通用模块）、上下文并行（把一条长请求的不同位置分给几张卡去算）。

**验证**
- `pnpm wiki:lint`：通过（ok，无本页报错）。
- `pnpm wiki:diagrams --check`：236 张图与 spec 一致。
- `pnpm wiki:audit`：通过；本页写作标准全 ✓，28 条来源。
- 浏览器（1440 宽）：重截 `data-parallel-shot-2b.png`（新图）、`data-parallel-shot-4.png`（改后的 data-parallel 图），数字与箭头标注清楚、无重叠裁切。
