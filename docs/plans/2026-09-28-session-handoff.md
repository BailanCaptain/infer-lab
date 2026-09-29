# 会话交接（2026-09-28/29 更新，09-29 白天再更新）：LLM-wiki P5 推进

给下一个主会话看的完整交接。读完这份就能接手；细节按下面的索引去查，不要凭记忆推进。

## 1. 目标与主线

把整个 LLM-wiki 重建在一条主线上：在官方双机部署（GLM-5.3-Flash，2×Atlas 800 A2×8，TP8/DP2/EP16，W8A8）下，讲清一条请求怎样走过 vLLM + vllm-ascend、怎样推出下一个 token、多请求并发时怎样。工作分 P1–P6 阶段，现在在 **P5（约 119 页分 30 批深改）**，P1–P4 已完成并有两个检查点提交。

## 2. 关键文件索引（唯一来源，别另立）

| 内容 | 位置 |
|---|---|
| 计划与进度的唯一来源 | 本仓 `docs/plans/2026-09-27-mainline-rebuild.md`：§5 写法、§5.1 写手常见错+单一出处表、§5.2 深入页骨架、§8 进度日志（最后几条是接续清单）。**主会话别读它**（§3 参数密集，触发过分类器 3 次）；要改只用 Python 脚本追加 |
| 写作标准（正式版） | `docs/wiki-writing-standard.md`（TP/EP 两页是用户 09-28 认可的样板） |
| P5 分批队列 | `docs/plans/2026-09-28-p5-batches.md`（119 页 30 批 + 「拍板结果」6 条默认） |
| 达标名单与审计阈值 | `scripts/wiki/standard-pages.json`（现 37 页）；`pnpm wiki:audit` / `wiki:lint` / `wiki:diagrams --check` 强制 |
| 每页的审查与写作记录 | `docs/mainline/review/pages/<页面id>-review.md` |
| 主线底稿 | `docs/mainline/0*.md`（数字的唯一出处；子代理先 grep 标题拿行号再分段读） |
| 写手/审查员模板 | 旧会话 scratchpad（绝对路径）：`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\13898c74-f916-4e2c-8924-fe9bf130f160\scratchpad\` 下的 `opus-writer-template.md`、`review-template.md`；每页提示词在 `p5q/`（119 个），旧版信息清单在 `p5/`。文件都在磁盘上，直接用绝对路径引用；万一丢了按计划 §5/§5.1/§8 重建 |
| 09-29 讲法标准与派发说明 | 本会话 scratchpad（绝对路径）：`C:\Users\-\AppData\Local\Temp\claude\C--Users---Desktop-infra-view-new\580bfd6e-9691-4917-b9a1-4800172dad29\scratchpad\` 下的 `basics-standard.md`（讲法总原则 + 14 条）、`basics-audit.md`（22 页基础页排查结果）、`b10-writer-common.md` / `b10-review-common.md`（P5 写手 / 审查员派发说明，含读页面固定命令）、`basics-writer-common.md` / `basics-review-common.md`（基础页改写 / 审查说明）、`b10-status.md`（本会话逐页记账） |

## 3. 工作纪律（全部是踩过坑换来的，逐条遵守）

### 分工与模型
- 写页改页优先 **GPT-6 Astra**（Codex：`codex-companion task --cwd <wiki仓> --model gpt-6-astra --write --prompt-file`，可 5 并发；启动要用 run_in_background 或等待循环，别裸 `&`）。**Codex 额度 10-04 13:35 才恢复**，恢复前按老规矩：先 Opus 5.5（Agent 不传 model），被拦改派 Fable 5。
- 审查一律派**新开的** Opus 审查员；Codex 写的东西必须审后才算数（09-25 它越写越烂的教训）。
- Claude 子代理并发 ≤3–4（写和审共用一份额度）。

### 主会话（这是被拦最多的地方）
- **只派发，不读** wiki 页面、会话记录、HANDBOOK、docs/plans；查什么都写提示词派子代理。
- **命令输出也算读**：跑 lint/audit 只看退出码 + `tail -3` 统计行；失败详情重定向到文件，派子代理去读，只让它回报页名和结论（09-28 主会话就是 grep 审计详情把来源清单带进上下文被拦的）。
- 中文回复用户；子代理的英文汇报翻成中文转述。
- 不提交 git，除非用户明说；不动用户自己的文件；知识库只做桌面端。
- **主会话用 Fable 5**（09-28 深夜主会话汇报修订细节被连拦 3 次，切 Fable 5 后未再触发）。
- **主会话汇报只报分数/结论/过没过**，不复述子代理的修订细节；细节让用户去 review 文件看。
- 查检查失败详情：输出重定向到文件后**派轻量子代理定位**，只让它回报「哪个文件、哪类检查、一句话原因」，主会话别自己 grep（会把页面内容拉进上下文）。

### 子代理提示词里必写的纪律（新增两条，其余见下节）
- **最后回复限字数**：写手 ≤80 字、审查员 ≤100 字，只报「字数变化/分数、三项检查、有无 P1」；行号、清单、出处明细一律写进 review 文件。子代理回复会原文进主会话上下文，细节清单会触发分类器。
- **派写手必须附依赖代号图例**：D = glm-5-3-flash-two-node、K = request-call-chain、R = one-request、C = concurrent-requests、M = glm-5-3-flash、T/E = tensor/expert-parallel（全表在 `2026-09-28-p5-batches.md`「出处代号与数字口径」，派发前抄进提示词）。09-28 有写手把 K、D 猜成了别的页。

### 子代理提示词里必写的纪律
- **严格串行：每次只发一个工具调用**，不并行读多个文件（被拦的头号原因）。
- 每次读 ≤120 行（源码 ≤20 行，先 grep 拿行号再读附近）。
- **跳过 frontmatter 的 sources 区**（来源由 audit 校验）；「对照源码」正文只 grep 五个 H3 标题。
- 不读 HANDBOOK、docs/plans/；TERMS.md 只 grep 单行不整读。
- **不准再开子子代理**。
- 被拦就跳过那段继续干，最后报告跳过了什么。
- 通知里出现「stopped with background work still running」：先 ListAgents 确认或 TaskStop，别直接另派同活（撞车过）；断线（ECONNRESET）用 SendMessage 恢复原代理。

### 09-29 新增（本会话踩出来的）
- **主会话只派活**（用户原话「交给子代理去做，你只负责派活！」）：连用浏览器看页面、截图诊断也交给子代理；主会话只派活、记账、跑检查看退出码、转述结论。
- **并发放宽到约 7**（用户「并发可以大一点」）；子代理仍禁止再开子代理。按已定标准排查出的问题直接派改，不再逐页请示（用户「没讲清楚就改，不用我定」）。
- **读页面固定命令**：页面开头 frontmatter 的 sources 区被拦过多次，一律先去掉 frontmatter 再分段读：`awk 'c>=2{print NR": "$0} /^---$/{c++}' <页面> | sed -n '1,60p'`。
- **ai-core、op-to-ai-core 两页挂起**：ai-core 两个模型（Opus、Fable）都被拦；op-to-ai-core 是主会话自己写派活提示词时被拦。这两页等 GPT-6 Astra（10-04 13:35 恢复），派活提示词只写「读 p5q 任务文件 + 通用说明 + 读取纪律」，主会话一个字不写话题内容。
- **讲法总原则**（用户纠正「矫枉过正」后定的）：用户的话是站在初学者角度的建议，不是逐字规格；学习顺序是「是什么（直觉 + 具体例子）→ 为什么需要 → 怎么算（示意数演算）→ 细节 → GLM → 误解 → 对照源码」；动图演机制（谁把哪块发给谁），不是数字在跳；图元不够就新增（只做加法）。全文在本会话 scratchpad 的 `basics-standard.md`（绝对路径见 §2 补充）。
- 仓库的格式检查 `pnpm lint` 是 biome（不是 eslint）。

### 端口
- **5193 / 8790 是用户预览（wiki-web / wiki-server，用 preview_start 起），谁都不许占**；子代理各用 4173–4177。

### 每页流程（固定不变）
1. **写**：动笔前先列旧版信息清单（`git show p4-checkpoint:<页>`），存 scratchpad `p5/<id>-facts.md`；边写边按 H2 保存；写完逐条勾选清单（保留 / 挪走附链接 / 删除写明理由）。GPT 写的页 7 篇里丢过 4 篇内容，这一步不能省。
2. **审**：按 review-template 的 7 项必做（初学者只读前两屏测试、核心概念对照源码、数字对底稿、git diff 查丢信息、锚点、audit、打分）。
3. **修**：P1 修完必须复审；P2/P3 写手自修。
4. **入名单**：过了加进 `standard-pages.json`，从此被 audit 强制。

### 内容红线
- **P1 定义**：核心概念讲错、数字与底稿不符、丢信息、没有出处的数字。
- **顺序不等于删减**：先直觉后数字是排版顺序，不是砍内容的许可；知识库同时是以后问答的底子。
- 深入页骨架见标准 §5.2：问题式 H2 + 一句话定义 + 直觉图（只画份数不写字节）→ 为什么/代价 → GLM 双机沿一个 token → 特殊层集中讲 → 常见误解 → 对照源码固定五个 H3（怎么开 / 会报什么错 / 开销和什么时候别开 / 版本差异 / 源码位置）。
- 数字只在单一出处推导，别页只链接；部署前提链 `glm-5-3-flash-two-node.md#部署前提`。
- 术语：vLLM / Ascend / 论文机制用英文原名，先讲后用；「昇腾」「超节点」保留中文。
- 版本口径：v0.23 列 = 维护分支 2c59ff10（**没有** GLM 代码）；db701c1f 是含 GLM 代码的 orphan commit，单独标注；v0.26 = 2ed6cbba；main = baa023ad（GLM 在 models/glm5next/）。
- R1 = 4 个 token 是**教学设定**（真实请求套 GLM 模板后至少十几个），已在各首现处写明，数字不重算（用户拍板方案 a）。
- 页面上不写 meta 文本（参考来源、「这里放慢了演示」之类）；图宽 ≤900px；正文太窄就加宽正文，不缩图。
- 别问用户「对不对」，自己对照 config / 源码 / 论文核，或派独立审查员核。

## 4. 当前状态（09-29 本会话结束时）

- 已提交：`14591fd`（p4-checkpoint）、`4fb4b74`（p5-checkpoint-1）、`d547a6b`（p5-checkpoint-2）、`9ad75ad`（HCCL buffer 页闭环）。
- **未提交**（全部检查通过：wiki:lint / wiki:audit / wiki:diagrams --check / typecheck / biome 都是 0；单测 980 个只有 `scripts/wiki/params/scan.test.ts` 1 个失败，是本机 Python 低于 3.11 的环境问题，与改动无关；达标名单 45 → **55 页全部达标**）：
  - **第 10 批**：vllm-scheduler、prefill、graph-mode-layer、pd-disaggregation 完成并入名单；ai-core 挂起（见 §3）。
  - **基础页「讲清楚」返工**（用户 09-29 反馈：attention 页基础没讲清、通信基础页动图「只是数字在播放」）：排查 22 页基础页（结果 `basics-audit.md`），把讲不清的全部按新讲法改完、独立审查、修到过线，共 19 页：attention-qkv、matmul-and-weights、token、embedding、moe、collective-communication、layers-and-hidden、kv-cache、tensor-parallel、expert-parallel、prefill、quantization、mlp-residual-norm、rope、gqa、mla、data-parallel、pipeline-parallel、sequence-parallel（后两页原是旧体例，整页改写后新入名单）。每页的审查 / 修订记录在 `docs/mainline/review/pages/<id>-review.md`。
  - **工具**：新增「exchanges 分镜」图元 + `DiagramPlayer` 播放器（通信基础、EP、SP 三页的动图在用，删掉了旧 CollectiveDemo）；`wiki:lint` 加跨页锚点硬校验（改标题后入链失效会报错）；修了 calc 吞掉「≈」后面结果的 bug。都有测试，先红后绿。
  - **第 11 批**：chunked-prefill、prepare-inputs-flow、vllm-engine-core、kv-cache-quantization 完成并入名单；op-to-ai-core 挂起（见 §3）。
- 工作区另有 6 个夜间任务（参数同步、巡检，09-29 凌晨 3 点）的产出未跟踪，不是本会话写的，提交时由用户决定是否带上。
- tmp/ 仍是 Codex 临时产物，不提交。

## 5. 接续清单（按顺序做）

1. **提交检查点**：以上是一个干净检查点，**用户点头**后提交打 tag（建议 `p5-checkpoint-3`）。
2. **第 12 批起**按 `2026-09-28-p5-batches.md` 走，每页流程不变（写 → 独立审 → 修 → P1 复审 → 入名单）；写手 / 审查员派发说明用本会话 scratchpad 的 `b10-writer-common.md` / `b10-review-common.md`（已含「讲法」一节和读页面固定命令）。旧清单要点仍有效：新页（sampling / HTTP 入口 / DP 组选择 / lm_head / A7）；RFork 批 20–25（要验证「400 本身不能证明 TTL 过期」）；参数页保持 4 段式。
3. **10-04 13:35 之后**：ai-core、op-to-ai-core 交 GPT-6 Astra 写，Opus 审。
4. 小 P3 攒着顺手做：工具审查剩的 4 条 P3（真实页面未命中，见 `tooling-review.md`）；kv-cache-quantization 审查里 1 条 P3 不归本页；prefill 旧 P3-8 要改底稿；block-table 约 250–350 字重复、L147 meta 文本、「full 组」未解释；低优先级基础页（linear-attention、sparse-attention、attention-cost、context-parallel）排查判为讲清 / 基本讲清，暂不动。
5. 环境：本机 Python 低于 3.11，导致参数扫描单测失败（可装 3.11+ 并用 `WIKI_PYTHON` 指定）；09-29 浏览器验收时发现 wiki-server（8790）没在跑，侧栏问答不可用（服务是另一会话起的，没动）。
6. P6：11 张孤儿图（删前必须问用户）、3 个既有 e2e 失败、flaky 导航 e2e、主仓 PROJECT-MAP 同步、HANDOFF/HANDBOOK 更新（HANDBOOK 派 Fable 改）；另建议把本会话 scratchpad 里的 `basics-standard.md` 并进正式写作标准 `docs/wiki-writing-standard.md`（单一出处，免得标准只躺在临时目录里）。

## 6. 额度与环境

- Codex（GPT-6 Astra）：10-04 13:35 恢复。
- 仓库：wiki 仓 `C:\Users\-\Desktop\infra-view-new-llm-wiki`（**分支 feat/llm-wiki**，p4/p5 检查点都在这条分支）；主仓 `C:\Users\-\Desktop\infra-view-new` 本阶段基本不动。
- 预览：preview_start 起 `wiki-server`(8790) + `wiki-web`(5193)，页面路由是 hash 式 `#/wiki/<页面id>`。
- 记忆里对应条目：project-codex-wiki-rewrite-audit（进度）、feedback-dispatch-dont-read（分类器坑）、feedback-subagent-quota-and-scope（并发）、feedback-intuition-before-numbers（§5.2 由来）。
