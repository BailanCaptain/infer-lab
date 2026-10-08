# vllm-engine-core 审查记录

## P5 写作记录（2026-09-29，第 11 批深改）

**改了什么。** 全页按「是什么 → 为什么 → 怎么做（示意数演算）→ 细节 → GLM 双机 → 常见误解 → 对照源码」重写为八个 H2：

1. 「EngineCore 是什么：谁在一圈一圈地推着请求往前走？」一句话定义（专门跑「收消息 → 调度 → 交出执行 → 按结果更新」循环的核心，所有请求共用、转一圈叫一步、默认单独占一个进程）+ 直觉图 + 4 token 提示词、3 token 回答转 3 圈的直觉例子；prefill / decode 不由循环区分，链接 prefill 与 Scheduler。
2. 「为什么要一个共用的循环，还单独放进一个进程？」共用循环 = 凑批摊掉读权重的固定开销（4 条请求示意）；单独进程 = 前端收发与后端计算互不阻塞（C 在 A、B 算到一半时到达的场景）；代价（打包消息、状态三处各存）链接 engine-processes；4 行职责表区分前端 / EngineCore / Scheduler / Executor 与 Worker。
3. 「一圈按什么顺序走？一条示意请求转两圈」六步顺序 + 分镜动图 + calc（R 两圈共算 4 个位置、回答 n 个 token 转 n 圈的成立条件）。
4. 「一圈交回几个 token？」5 行工作类型表、按请求记账、A/B/C 批成员变化的例子、不能由回答长度换算圈数和耗时。
5. 「源码里的一圈：等活、选分支、交回结果」代码流程图 + 空闲阻塞、取消双队列、新请求在收消息线程转换、DP 陪跑分支。
6. 「批次队列：下一圈的调度和这一圈的计算叠起来」同步分支的空档、「拿回执 ≠ 重叠」、带队列分支三条规则、最多领先一步、占位与结构化输出延后的代价、以启动日志为准。
7. 「落到 GLM 双机：两个 EngineCore 各转各的圈」两个 EngineCore、每步上限、自动判定打开异步调度；R1 在 DP0 上逐圈「发出第 k+1 步、收回第 k 步」；DP1 陪跑；满载一步交回 32–128 个 token 的 calc；vllm-ascend 入口补丁在本部署不生效。
8. 常见误解 8 条；对照源码五个 H3（怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置），源码位置含表、正文证据归档与待核。

改前全文 2,559 字符（正文 1,784），改后全文 18,632 字符（正文 15,723）；写作标准口径的教学正文 5,681 字。

**图。**

- `wiki/diagrams/engine-core-loop.yaml`（直觉图，重画）：三道框分前端进程、EngineCore 进程、Worker 进程；EngineCore 里 ①收消息 → ②调度 → ③交出执行、等结果 → ④按结果更新 四格成环，中心「一圈 = 一步 / 所有请求共用这一个循环」；前端 →① 标「请求消息」（输入边界），② → Worker 标「计划」（块槽位随计划下发、执行后端衔接），Worker → ③ 标「新 token」，④ → 前端标「token 编号」；底注空闲时停在 ①。验收要点「输入边界、块槽位与执行后端衔接」可顺这张图复述。
- `wiki/diagrams/engine-core-rounds.yaml`（新增，exchanges 分镜动图）：三张「卡」是前端、EngineCore、Worker，每格一个位置的 token 编号（示意）。8 格：前端发 3 个提示词编号 → 第 1 圈计划带完整提示词给 Worker → Worker 选出 5 → 5 交回 EngineCore → 送回前端 → 第 2 圈 Worker 拿手里的 5 算出 8（计划不再带 token）→ 8 交回 → 送回。演的是「谁把哪块发给谁」，以及只在第一次上场发完整资料。
- `wiki/diagrams/engine-core-flow.yaml`（新增，代码流程图，含站号 ②⑥）：外层循环 → 有活吗（否：阻塞等消息，处理后再问）→ 收完已到消息 → 建了批次队列吗 → 同步分支（调度 → 交出执行拿回执、准备结构化输出表 → 等本批）/ 队列分支（调度并提交、回执入队 → 未满且能推进就回开头 → 否则等最老一批）→ ⑥先处理取消再更新 → 结果进输出队列；旁支 DP 陪跑空批次。pins 五条，符号都在 `core.py` 里。
- 三张图都用只渲染自己的临时脚本检查与生成，没有改动别页 SVG。

**数字与出处。** 每步 8192 个位置、32 条请求、MTP 预留 3 个候选取自 01 §A2.1；R1 第一步 {R1: 4}、首次带完整资料、无候选取自 01 §A2.4，块数只链 one-request 第 2 站（遵守 R1 块数为区间的口径，不写数）；decode 每步 1 + 3 个位置、交回 1–4 个、异步调度自动判定为开、占位 = 1 + 候选数、满载 32 条一步交回 32–128 个 token 取自 03 §A6 第 12、17、24 条与「其它可核对的量」；R1 前三步交回 1、2、4 个 token 取自 03 §A6 两步 decode 表的假设（第 2 步接受 1 个、第 3 步全接受），合计 7 为本页推出 [D]；结束时块号一次还回、结束名单随下一份计划通知 Worker、运行数减 1 影响派发、流式一段带 1–4 个 token 取自 01 §A7，还块数只链 one-request 第 7 站。满载一步 128 个位置只链部署页「关键参数各管哪一步」，不重算。

**核心概念对照了什么（全部实际打开钉住源码）。**

- 循环结构：`vllm@0fc695fc:vllm/v1/engine/core.py#L1223-L1262`（`run_busy_loop` 两句；`_process_input_queue` 先阻塞等到有活、再把队列里其余消息收完）、`#L1211-L1217`（`has_work` 三个条件）、`#L1264-L1281`（结果进输出队列、`post_step`）。
- 一圈的顺序：`#L443-L473` 的 `step()`——`has_requests` 为空返回 → `schedule` → `execute_model(non_block=True)` → `get_grammar_bitmask` → `future.result()`，为 `None` 时再 `sample_tokens` → `_process_aborts_queue` → `update_from_output`。
- 取消：收消息线程把 ABORT 同时放进 `aborts_queue` 与 `input_queue`（`#L1515-L1543`）；更新时跳过已结束请求（`scheduler.py#L1393-L1407`，注释点名异步调度与 PP）。据此写「取消不打断正在算的一批，结果被丢弃」。
- 新请求预处理在收消息线程：`preprocess_add_request`（`#L819-L841`，`grammar_init` 只在输入线程调用）。
- 计划只发变化量：`output.py#L181-L215` 字段注释（首次调度的请求缓存到 worker，之后只发 diff；`finished_req_ids` 通知 worker 释放）；`new_token_ids` 只在 PP 下使用（`#L112-L120`）。据此画分镜第 2 圈「Worker 用手里的 5」。
- 批次队列：`#L188-L220`（`batch_queue_size = max_concurrent_batches`，>1 建队列，`step_fn` 选择）、`#L484-L598`（队列未满且 `model_executed or has_requests` 时直接返回；否则 pop 最老一批；结构化输出依赖前批时延后 `sample_tokens`）、`config/vllm.py#L497-L507`（异步 + V1 且 PP≤1 返回 2，V2 返回 pp+1，否则 pp）。
- 异步调度判定：`config/vllm.py#L931-L1002`（显式开启三种 ValueError；默认 `None` 的自动分支：pooling、投机方法不属 EAGLE 类与 NGram GPU 类、`disable_padded_drafter_batch`、执行器不支持；info 日志 `Asynchronous scheduling is %s.`）；`multiproc_executor.py#L511-L513` 支持异步；`async_scheduler.py#L19-L36` 占位 `1 + 候选数`；命令行 `--async-scheduling` 与 `BooleanOptionalAction` 生成的 `--no-` 形式（`arg_utils.py#L1414-L1417`、`#L343-L345`）。据此纠正旧版「不在 EAGLE/MTP/Draft Model/NGram GPU 之列」的自动分支写法：自动分支只放行 EAGLE 类（含 MTP）与 NGram GPU 类，Draft Model 只在显式开启时被接受。
- 空闲阻塞例外：`process_input_queue_block` 只在弹性 EP 扩缩容时置 `False`（`#L1984-L1990`，另一处 `#L2060`）。
- DP 陪跑：`#L1869-L1900`（本组没执行且 `engines_running` 时 `execute_dummy_batch`）。
- 三版差异：v0.26 `vllm@568afb3a:core.py#L576-L615`（`_should_throttle_prefills()`、`capture_iteration_details`）、`#L2015-L2022` 与 `config/scheduler.py#L153`（`prefill_schedule_interval` 默认 1）、`config/vllm.py#L1108-L1111`（日志仍在）；main `vllm@84030bbe:core.py#L1403-L1413`（非 DP 忙循环也发布请求计数）、`#L589-L628`（`step()` 同 v0.26）、`config/vllm.py#L1332-L1394`（多一道 ROCm DeepEP DBO 闸，`Asynchronous scheduling is %s.` 已删，DP>1 的 MoE 打开异步时打 `Disabling NCCL for DP synchronization ...`；全库 grep 该日志串在 main 无命中）。
- vllm-ascend：`2c59ff10` 与 `db701c1f` 的 `patch_balance_schedule.py` 在均衡调度未开时直接调上游 `run_engine_core`（`#L688-L692` / `#L661-L666`）；`db701c1f:ascend_config.py#L69-L73` 剖析分块要求 PP>1；`2ed6cbba` 只在均衡调度打开时替换 `DPEngineCoreProc`（`#L950-L959`）；`baa023ad:patch_engine_core.py#L32-L73` 集中到一处，DyntraLB / 均衡调度 / 剖析分块都按开关生效，`post_step` 包装只在 PP + MTP 特例下跳过（`patch_pp_mtp.py#L97-L114`）。结论：本部署四个钉点上跑的都是上游循环。

**不丢信息勾选。** 旧版取两版：A = `14591fd^`（p4 重建前最后一版，34 条），B = `p4-checkpoint`（= 改前现文，14 条），清单在会话 scratchpad `p5/vllm-engine-core-facts.md`。逐条去向：

- 全部保留在本页的：A1–A9、A11–A28、A30–A34（A29「main 未核」升级为已核，写进版本差异）；B1、B3–B13。
- A10（末圈吐结束记号 → 完成、还块、循环睡回去）：分镜第 7 格 + GLM 第 5 条 + 空闲一节；还块数不写，只链 one-request 第 7 站。旧版「那个 KV 块」的单数说法不再沿用（R1 占多个块号，块数以 one-request 为准）。
- A1 的「200 个 token 转 200 圈」改为 3 token 例子与「回答 n 个 token 转 n 圈」的条件式 calc；带 MTP 的 200 token 步数范围只在 prefill 页推导，本页不重算。
- A17「异步只发生在前端进程」按现状改写：前端的事件循环与 EngineCore 的按圈循环分开讲，异步调度另列一条误解。
- B2「concurrent-requests 的 AB、AB、AC、C 四轮」：该例在 concurrent-requests 现文已不存在（grep 全库只剩本页旧文），结论（同一引擎依次安排、成员随完成与到达变化、权重与运行状态保留）改用本页自己的 A/B/C 例子保留。
- B14「Ascend 快照与待核见来源基线」：Ascend 入口补丁的结论写进 GLM 一节，来源基线链接挪到版本差异。
- 旧版误解「EngineCore 里能看到模型」类内容在 vllm-v1-shape 已有，本页不重复。

**验收要点对照。** A3 的注意力元数据不在本页出现（留给准备输入页）；输入边界（请求消息、只传编号）、块槽位（计划里的块号与每条几个位置）、执行后端衔接（计划交 Worker、两次调用链接 request-call-chain）都能顺直觉图和分镜复述。进程、类、函数链只一句话说明并链接 request-call-chain；调度细节链接 vllm-scheduler；prefill 链接 prefill。

**验证。** `pnpm wiki:lint`：通过，本页 0 报错（其余 14 处待留意均为别页）；`pnpm wiki:diagrams --check`：241 张图与 spec 一致；`pnpm wiki:audit`：本页 35 条来源行号全部有效、无报错，整体失败的 1 处是 `concepts/sequence-parallel.md [prose-marks]`（别页，未动）。本页不在 standard-pages 名单，另用 `checkStandard` 单独实测：教学正文 5,681 字、行内代码 0/千字、对照源码之上角标 0、calc 2 处（0.35/千字）、表与 calc 相邻 0、首图在前、免责句 0%、图宽合格；全页角标 23 处（C 16 / D 5 / I 2，C 占 70%）。未开浏览器，前两屏、分镜播放与图的实际阅读留给审查。

**仍待核。** 页末两条：缺本部署启动日志确认异步调度与批次队列长度 2；缺同步与带队列两条分支的吞吐、时延对照及每圈 CPU 调度与更新耗时。

**跳过的。** 按派发说明未读 `codex-p5-common.md`；未读 HANDBOOK、docs/plans；页面文件与旧版都按固定 awk 命令去掉 frontmatter 后分段读，未读 sources 区（frontmatter 用脚本按键整体替换）。

## P5 审查（09-29）

审查员：独立审查（只审未改页面）。读法：正文按固定 awk 命令去 frontmatter 后分段读 56–222 行；「对照源码」只 grep 了 H3 顺序与版本标记；sources 区未读。

**结论：8/10。P1 0 条，P2 2 条，P3 6 条。`pnpm wiki:audit` 本页通过（35 条来源行号有效，名单 52 页全部达标）；`pnpm wiki:lint` 通过，本页 0 报错。**

### 学习顺序与讲法
- 通过。第一节：问题式 H2、加粗一句话定义、直觉环图（前端 / EngineCore / Worker 三框，①–④ 成环）、4 token 提示词转 3 圈的具体例子；第二节讲为什么：共用循环 = 凑批摊掉读权重，单独进程 = 前端收发与后端计算互不阻塞（C 在 A、B 算到一半时到达的场景），并给出代价（打包消息、三处各存状态）；第三节用示意请求 R 演两圈 + calc；然后是交回 token 数、源码里的一圈、批次队列三节细节；GLM 双机在细节之后；GLM 之后只有常见误解和对照源码。符合 basics-standard 总原则与第 11–14 条（第一节末尾没有堆链接；GLM 数字没有进基础节）。
- 初学者测试（只读前两屏）：EngineCore 是 vLLM 里所有请求共用的那一个循环，每圈收新请求 → 调度器排计划 → Worker 在卡上算 → 按结果给每条请求记账；它单独占一个进程，这样前端收发、分词和卡上计算互不阻塞，代价是进程间要打包消息、请求状态三处各存一份。

### 核心概念对照（vLLM v0.23.0 = 0fc695fc，vllm-ascend db701c1f）
逐条判对，均无错误：
- 一圈的顺序（正文 108–113、151–156 图）：`step()` 为 has_requests → schedule → execute_model(non_block) → get_grammar_bitmask → result / sample_tokens → _process_aborts_queue → update_from_output，`vllm/v1/engine/core.py#L443-L473`。对。
- 空闲阻塞（158、216）：`has_work` 看 engines_running / has_requests / batch_queue 三样（`#L1211-L1217`）；`_process_input_queue` 阻塞 get，醒来处理后再判断，再 get_nowait 收完（`#L1233-L1262`）；`process_input_queue_block` 只在弹性 EP 扩缩容时置 False（`#L1990`、`#L2060`，完成后 `#L1884` 复位）。对。
- 取消双队列（160、220）：收线程把 ABORT 同时放进 aborts_queue 与 input_queue（`#L1535-L1543`）；更新时跳过已结束请求（`scheduler.py#L1399-L1401`）。对。
- 新请求在收线程转换（162）：`preprocess_add_request` 在 `process_input_sockets` 里调用（`#L1526-L1531`）。对。
- 批次队列（170–176）：`batch_queue_size = max_concurrent_batches`，>1 才建（`#L192-L198`）；`max_concurrent_batches` 异步 + V1 runner + PP=1 为 2、V2 runner 为 pp+1、否则 pp（`config/vllm.py#L497-L507`），页面「只开异步不开 PP 为 2；开 PP 至少是 PP 组数」概括正确；不等结果的条件是队列未满且 (model_executed 或 has_requests)（`core.py#L538-L545`），满或无可排则 pop 最老一批（`#L551`）；结构化输出依赖前批时延后 sample_tokens（`#L528-L533`、`#L574-L586`）。对。
- GLM 逐圈（193–195）：第 1 圈队列 1 批 < 2 且已执行 → 不等；第 2 圈入队后满 → 等第 1 步。第 2 步 4 个位置 = 1 个占位 + 3 个候选占位，对应 `async_scheduler.py#L28-L36`（num_output_placeholders += 1 + spec，spec_token_ids 置 -1 占位）。对。
- 异步自动判定（180、188）：`config/vllm.py#L957-L997` 四道闸；MTP 属于 EagleModelTypes（`config/speculative.py#L34-L58`），页面写成「推断打开」，措辞与 K 一致；vllm-ascend db701c1f 无 async_scheduling 覆盖。对。
- vllm-ascend 入口补丁（210）：`patch_balance_schedule.py#L661-L698` 均衡调度未开直接走原 run_engine_core；剖析分块只在开启时才 import 补丁（`platform.py#L711-L715`），且要求 PP>1（`ascend_config.py#L69-L73`）。对。
- 与 K（request-call-chain）一致性：进程划分（前端只在 node0、两个 EngineCore 各管本机 8 个 Worker）、忙循环（收线程 / 主线程忙循环 / 发线程）、输出回传（输出队列 → 发线程 → 前端反分词）三处说法与 K 第 127、150–155、291–304 行一致，无矛盾。

### 数字
与 01 对照全部一致：8192 / 32（01 L637–638）、MTP 3 个候选与预留 3 个 lookahead（01 L29、L616、L639）、满载一步 32×4=128 个位置（01 L955）；calc 32–128 个 token 推导正确；R1 三步交回 1、2、4 共 7 个与 one-request L497–498 一致；R1 块数只链 one-request 第 2 / 7 站，没有写定值，符合口径。

### 与 K / vllm-scheduler / prefill 的重叠（9 倍扩写查注水）
- 与 K **无大段重复**：函数链、两次 RPC、DP 分支、进程分布都是一句话 + 链接（111、164、178、186）。重叠只在批次队列一节约 4–5 句（三条分支规则、读报错栈看的是上一批、以启动日志为准）和 GLM 一节的「异步按自动判定推断打开」，与 K 第 150–155 行意思重复，见 P3-1。
- 与 vllm-scheduler、prefill：只各一两句 + 链接（76、84、187、210），无重叠。
- 注水：写手自报口径的教学正文约 5.7 千字（1.57 万为含链接 / 表格的字符数），实际扩写约 3 倍，新增内容（示意请求分镜、双队列取消、批次队列规则、GLM 逐圈）都是实料；只有少量同一结论多处重说，见 P3-2。

### 丢信息核对
按 p4-checkpoint 六个 H2 逐条对照：协调循环、交接顺序、「异步提交 ≠ 重叠」、交回 token 数表、四输入三输出三次前向的条件、批次队列与代价、空闲等待、取消与「设备算完 ≠ 服务提交」都在。缺一处：旧版「与邻近组件的接口」里 Runner 负责张量准备和模型调用、并链到 npu-model-runner，新版把 Runner 并进 Worker、全页不再链 npu-model-runner / prepare-inputs-flow；facts 清单把 B13 勾成「保留」不属实，见 P2-2。旧版「图中距离不代表时延」一句随旧图删除，无影响。

### 链接与锚点
正文 23 个链接（其中 17 个带锚点）由 lint 跨页锚点校验通过；全库 20 个文件链到本页，均不带锚点。frontmatter relations 列了 vllm-v1-shape，但正文没有链接它（P3-6）。

### 浏览器实测（Playwright，1440 宽，http://localhost:5193/#/wiki/vllm-engine-core）
截图在审查会话 scratchpad：`vllm-engine-core-review-first.png`（第一屏：H2 + 定义 + 环图）、`-flow.png`（代码流程图）、`-rounds.png` 与 `-rounds-3/5/7/9.png`（分镜 9 格逐格点「下一步」可推进，飞行块与格子对得上）。正文宽 1034px，图清楚。控制台 4 条 502 来自问答后端未起，与本页无关。

### 问题清单

**P1**：无。

**P2**
1. 位置：代码流程图 `wiki/diagrams/engine-core-flow.yaml` 第 11、14、17 行，与正文 154–156。问题：流程图框上的「②」「⑥」是 one-request / K 的七站站号，本页从没讲过站号；而同页直觉环图用 ①–④ 表示一圈四格（② 调度、④ 按结果更新），正文顺序列表又是 1–6。初学者会把流程图的「⑥」对到环图上找不到，或以为一圈有六格。改法：流程图去掉站号，或改成与环图同一套 ①–④（调度 = ②，取消 + 更新 = ④）；若要保留站号，在图注里说明「②⑥ 是请求七站的站号」并链 one-request。
2. 位置：正文 97–102 邻居表「Executor 与 Worker」一行；facts 清单 B13 勾选。问题：旧版有 Runner 这一层（张量准备与模型调用）和 npu-model-runner 链接，新版删掉，全页也没有指向准备输入页，计划在 Worker 里怎样变成张量无处可跳；本批验收要点「执行后端衔接可顺图复述」因此断在 Worker 框。改法：在该行补半句「Worker 里的 model runner 把计划拼成模型输入」并链 [准备输入](prepare-inputs-flow.md) 与 [NPUModelRunner](npu-model-runner.md)；facts 勾选改为如实记录。

**P3**
1. 位置：166–180 批次队列一节、188。问题：三条分支规则、「报错栈里正在更新的是上一批」、「以启动日志为准」、「按自动判定推断打开」与 K 第 150–155 行重复，违反单一出处。改法：分支规则这种循环层面的语义归本页，K 那段缩成一句 + 链到本页 #批次队列下一圈的调度和这一圈的计算叠起来；或反过来本页只保留规则、删掉报错栈与日志两句改链 K。
2. 位置：111 / 168 / 218（回执 ≠ 重叠）、176 / 188 / 219（最多领先一步）、112 / 160 / 220（取消先于更新）。问题：同一结论正文说两遍、误解再说一遍。改法：正文每个结论只在一处展开，另一处改成一句回指。
3. 位置：74 与 115。问题：第一节用 4 token 提示词 / 3 token 回答，第三节换成 3 / 2 的请求 R，两个示意例子数字不同，读者要重新建立。改法：两处统一成同一条请求（例如都用 R），或第一节例子直接叫 R。
4. 位置：直觉环图 `engine-core-loop`。问题：「计划」箭头从 ② 调度框出发连到 Worker，而正文说交出执行是 ③；「新 token」回到 ③。改法：「计划」箭头改从 ③ 出发。
5. 位置：59（Worker 在 71 才解释）、158（数据并行在 164 才解释）、164（MoE / 专家未解释）。问题：术语先用后讲。改法：59 的 Worker 加半句括注或改说「卡上的执行进程」；158 的数据并行改成回指后文或提前一句解释；164 给 MoE 加一句括注。
6. 位置：frontmatter relations 第 48 行。问题：列了 vllm-v1-shape（组件分工和两道边界），正文没有任何链接。改法：在邻居表前一句链过去，或删掉该 relation。

### 跳过
无被拦截的读取。按规则未读：frontmatter sources 区、「对照源码」各 H3 正文（只 grep 了 H3 顺序与 v0.23 / v0.26 / main 标记，齐全且顺序正确）、HANDBOOK、docs/plans。

## P5 修订记录（09-29）

按「P5 审查（09-29）」逐条核实后全部接受，P2 修 2 条、P3 修 6 条；另按主会话要求把批次队列一节与 K 重叠的句子压成一句加链接。

**P2**

1. 站号混用：`engine-core-flow.yaml` 去掉七站站号 ②⑥，改成与直觉环图同一套 ①–④（① 收完已到消息、② 调度、③ 交出执行 / 等结果、④ 先处理取消再更新），图注写明「①–④ 就是直觉图里一圈的四格」。正文第三节的 1–6 有序列表同时改成 ①–④ 加一道「有没有活」的门，原第 6 步「放进输出队列」并进 ④，不再出现「一圈六格」的读法。
2. Runner 断链：邻居表「Executor 与 Worker」一行补「Worker 里的 model runner 把计划拼成模型输入」，链[准备输入](../../../../wiki/concepts/prepare-inputs-flow.md)与 [NPUModelRunner](../../../../wiki/concepts/npu-model-runner.md)；facts 清单 B13 如实补记初稿漏项。

**P3**

1. 批次队列与 K 重叠：三条分支规则、「最多领先一圈」一段、「读报错栈时正在更新的是上一批」、「以启动日志为准」四到五句压成一句（队列没满只排不等、满了等最老一批，所以最多领先一步）+ 链 K「一步之内」；代价段只留占位与结构化输出延后并链 async-scheduling；判定与日志改为回指页末「怎么开」「会报什么错」。GLM 一节「按自动判定推断打开」保留一句（GLM 逐圈走法依赖它），去掉重复的「最多领先一步」。
2. 同一结论多处展开：回执 ≠ 重叠只在批次队列一节展开，误解条改一句回指；最多领先一步只在批次队列一节写，误解条回指 GLM 逐圈走法；取消先于更新只在第三节 ④ 讲顺序与理由，源码一节只讲两个队列与跳过结果（「每圈在 ④ 更新之前清一次」），误解条一句回指。
3. 两个示意例子统一：第一节例子改成同一条请求 R（提示词 3 个、回答 2 个，转 2 圈），第三节开头写「把第一节那条请求 R……演一遍」，与分镜、calc 数字一致。
4. 环图「计划」箭头改从 ③ 出发：Worker 框下移到与 ③ 同高，「计划」「新 token」两条水平箭头都连 ③，② 只留环内箭头。
5. 术语先用后讲：定义句里 Worker 就地括注「每张卡一个的执行进程」，第 3 格不再重复解释；源码一节首次出现数据并行处补「DP：把卡分成几组，每组各接一部分请求，下面细说」；MoE 补括注「每层有很多个专家子网络，每个 token 只挑其中几个来算」。
6. relations 里的 vllm-v1-shape 在正文有了链接：邻居表前一句链到 [两道边界上，每一圈交接什么](../../../../wiki/concepts/vllm-v1-shape.md#两道边界上每一圈交接什么)。

**验证。** `pnpm wiki:lint`：通过，本页 0 报错（14 处待留意均为别页）；`pnpm wiki:diagrams --check`：241 张图与 spec 一致（本页三张图用只渲染自己的脚本重生成，`engine-core-loop`、`engine-core-flow` 两张 SVG 更新）；`pnpm wiki:audit`：通过，本页 35 条来源行号有效。`checkStandard` 单独实测：教学正文 5,534 字，行内代码 0，对照源码之上角标 0，calc 2 处，表与 calc 相邻 0，免责句 0%；全页角标 23 处（C 16 / D 5 / I 2）。未开浏览器。

## 动图改静态分格（10-03）

- **改了什么。** `wiki/diagrams/engine-core-rounds.yaml` 原来是 exchanges 分镜（8 步加一个结束格，播放器逐格演），改成 figure 静态分格，按圈切成 3 格：「第 1 圈」「第 2 圈」并排（正文要讲的就是「两圈里走的四格完全一样，差别在计划里装了什么」，并排最好比），下面一格「两圈之后」。画面纪律照 all-reduce 样板：每格一句短标题，右上角「编号为示意」，紫色箭头是在进程之间送过去的编号或消息，灰色虚线是 Worker 手里已经有、不用再发的编号；一格一个 token 编号加格子线，这一圈新出的 token 实色、已有的淡色。示意数沿用原图与正文（提示词 7、2、9，回答 5、8）。
- **怎么画机制。** 每格三行依次是前端、EngineCore、Worker 手里 R 的编号，按位置上下对齐，所以每支箭头都竖直落在对应位置的格子上，不交叉；圆圈 1–4 对应正文的 ①–④。第 1 圈：① 前端把 7、2、9 发给 EngineCore；② 计划带着 7、2、9 发给 Worker；③ Worker 在位置 3 选出 5；④ 5 交回 EngineCore 再送前端。第 2 圈：② 位置 3 的 5 只画灰虚线（不再发）；③ Worker 用手里的 5 在位置 4 选出 8；④ 8 交回再送前端。两圈之后：前端留着整条回答，EngineCore 这一行空了，下一份计划带上「R 已结束」，Worker 这一行也空了。
- **源码口径核对（钉住版本 vllm@0fc695fc）。** `vllm/v1/core/sched/output.py` L181–L215：第一次上场的请求放 `scheduled_new_reqs`，资料缓存在 worker 进程里；之后放 `scheduled_cached_reqs` 只发差量；`num_scheduled_tokens` 是每条请求这一步算几个位置；`finished_req_ids` 通知 worker 释放已结束请求的缓存。L112–L120：`new_token_ids` 只在 PP 时用，不开 PP 时为空，所以第 2 圈的 5 不用再发。`vllm/v1/core/sched/scheduler.py` L1888–L1910：`_free_request` 把请求号加进 `finished_req_ids`，`_free_blocks` 还块并从 `self.requests` 删掉这条请求。据此修正了原图结束格「三处都有 R 的 5 个编号」：R 结束后 EngineCore 已经放掉它，所以「两圈之后」里 EngineCore 这一行画成空的。图的 pins 没改，图上不放代码名。
- **正文同步（只改一句）。** 图前「下面把……交接演一遍……格子下面是它在这条请求里的位置」改为「按圈画出来，一圈一格……每格三行依次是前端、EngineCore、Worker 手里的编号……格子上面是它在这条请求里的位置，圆圈里的 1–4 对应上面的 ①–④」。caption 同步改写。
- **验证（本轮实跑）。** 本图用只渲染本图的脚本重生成 SVG；`pnpm wiki:lint` 退出码 0（4 处待留意均为他页 mark-flood）；`pnpm wiki:diagrams --check` 退出码 0，290 张与 spec 一致；`pnpm wiki:audit` 退出码 0，本页写作标准全 ✓（含图先行、图宽）。Playwright 1440 宽打开 `#/wiki/vllm-engine-core` 截图：图是静态 SVG、没有播放器按钮，三格、箭头、圆圈编号与正文一致。
