# LLM WIKI 交接

> 更新于 2026-09-20。这一页只写「现在在哪、接下来做什么、哪里会踩坑」。
> 会变的数字（页数、预算、测试条数）不抄在这里——用 §2 的命令现查。2026-09-19 之前的逐轮流水账在 [归档](docs/plans/handoff-archive-2026-09-19.md)。

## 1. 从哪开始

- **目录**：`C:/Users/-/Desktop/infra-view-new-llm-wiki`，分支 `feat/llm-wiki`，只在本地，未推送未合并。用户默认打开的 `infra-view-new` 是 `main`，**不是 Wiki 的现状，不要在那边重做**。
- **先读**：规则的唯一真相源是 [wiki/HANDBOOK.md](wiki/HANDBOOK.md)（六个 H2；动笔写页之前至少完整读「页面格式」一节）；验收状态看 `docs/features/F001`–`F004` 的验收表（唯一真相源，已更新到 2026-09-20）；`C:/Users/-/Desktop/infra-view-new/llm-wiki.md` 是用户拿来的原始理念，只读。
- **东西在哪**：内容 `wiki/`（`concepts/` 教学页、`params/` 参数页、`diagrams/` 图 spec、`seeds/` 源码钉点）；命令 `scripts/wiki*.ts` + `scripts/wiki/`；后端 `server/`；阅读页 `src/app/wiki/`。`src/sim/`、`src/timeline/` 是同仓库里 infer-lab 的东西，与 Wiki 无关，**别去读**。
- 仓库根的 `CLAUDE.md` 与 `AGENTS.md` 逐字重复是**有意保留**（两个工具各读一份），不要合并。
- **本机数据不在 git 里**：`tools/repos/`（源码语料）、`tools/corpus/`、`tools/wiki-runtime/`、`wiki/_jobs/budget/`、`wiki/_jobs/sync/`。换机器要 `pnpm wiki:clone` 重建，账本和回执带不走。
- **起服务**（阅读页的问答 / 审阅 / 刷新 / 状态都靠后端）：

  ```bash
  pnpm dev:server   # 后端 8790
  pnpm dev          # 前端，带 /api 代理
  ```

  只开静态预览、不起后端，面板会提示「连不上问答服务」。

## 2. 现查状态

| 想知道 | 命令 |
|---|---|
| 多少页、各类型多少 | `pnpm wiki:build`（看输出）或读 `src/content/wiki/registry.json` |
| 预算、夜间维护、会不会自己花钱、内容缺口 | 阅读页右侧面板「状态」页签（只读，`GET /api/wiki/status`，`server/status.ts`）；预算明细 `pnpm wiki:budget status` |
| 有没有待审包 | `pnpm wiki:review list`，或右侧面板「审阅」页签上的数字 |
| 哪些页引用的上游代码变了 | `pnpm wiki:stale --seeds wiki/seeds/vllm-ascend-code.yaml`（不加 `--fetch` 就是只读） |
| 引用行号是否属实 | `pnpm wiki:audit`（不带参数即可，默认吃 `wiki/seeds/` 下全部仓库表） |
| 引用是否真的支持那句话 | `pnpm wiki:cite-screen`（只读预筛，`--apply` 会就近放宽来源范围）。清单误报很多，它是「派人核对前先缩小范围」的工具，**不是闸** |
| 读者常撞到却没有页的词 | `pnpm wiki:gaps` |
| 30 个课程术语哪些还没页 | `pnpm wiki:lint --terms` |
| 夜间维护上次结果 | `wiki/_jobs/sync/last-run.json`；任务本身是 Windows 计划任务 `LLM-Wiki-infra-view-new-llm-wiki`（每日 03:00，`scripts/wiki-schedule.ps1` 注册，配置 `wiki/sync.config.json`） |

## 3. 方向

**机制过度建设，内容停在试点**（2026-09-19 审视，明细见 [wiki-audit-2026-09-19](docs/plans/wiki-audit-2026-09-19.md)）：四天里验收条件从 8 条涨到 34 条，代码两万多行，服务的却是四十多页。所以：**不再加机制、不再加验收条件、不再写逐轮 review 报告。** 新工作先问一句「这让用户读到的内容变多变好了吗」。

**用户 2026-09-20 定的做事方式——接手的人最容易做错的就是这一段：**

- **凡是写文档 / 知识页的活一律派 Opus 5 子代理写，主会话不自己写正文**；主会话负责定规范、派活、逐页核对事实、跑校验、提交。
- **不再逐页待审**：和用户方向一致时，写好并过校验就直接更新知识库。`pnpm wiki:stage`（不调模型、过同一套生产校验、产出待审包）仍在，只用于确实需要用户过目的改动。
- **一直往下推进，不要停下来问**，除非需要用户审批或确实拿不准。
- **页面写法**：用户认可的是 `wiki/concepts/vllm-v1-shape.md`、`vllm-ascend-overview.md` 那一类（一句话 + 图 → 那条请求走到这里 → 结论句小标题 → 常见误解）。全库已统一，规则写在 HANDBOOK「页面格式 › 正文分节 › 教学页的推荐写法」。
- **预算账本是保险丝，不是功能开关。** 用户的本意只是「地基做好之前不大批量导入」，2026-09-20 已同意恢复并调高上限。单次真实问答实测约 $0.45，照这个价 $100 上限约 180 问。大批量导入（全量灌种 / 全量参数页 / GitHub 全库首拉）放在最后一步，必须用户点头后手动执行，**没有任何自动入口会触发**（夜间任务要花钱得配置里有 `paid` 块且配额 > 0，现在没有）。任何一次调用超时拿不到账单，账本会再次自动暂停，状态页签会写明原因。

**用户 2026-09-20 定的「章节与知识库的关系」——这是写作约定，不要为它加机制：**

- 整个项目是教学平台，PLAN.md §1.1 的 22 个主章节**本身也要详细讲解**；动画是配合讲解的，不是「文字很少、只有动画」。
- 知识库里教学式的长页（`tensor-parallel`、`pipeline-parallel`、`chunked-prefill`、`vllm-v1-shape` 等）和主章节主题重叠。**写某一章时，先查 frontmatter `chapters` 里挂了该章号的页，以它们为底稿扩写**——这些页已对过钉住的源码、带行号。
- 章节开头记一行「基于哪几页知识库页」；这些页因上游变化被改时，回头看对应章节。写章节时发现知识库缺了或错了，**先补知识库再扩写**，知识库始终是事实的底。
- 主仓库 `infra-view-new` 的 PLAN.md 里还没写这条，回主线写章节时再补。

## 4. 接下来做什么（按优先级）

1. **内容是主线，但下一批开写前先问用户。** 这轮新写 8 页（`tensor-parallel`、`pipeline-parallel`、`sequence-parallel`、`mla`、`gqa`、`speculative-decoding`、`pd-disaggregation`、`chunked-prefill`），「特性」部分不再只有 KV Cache 一类；仍缺图模式深入、量化总览（W8A8 等）、EP/EPLB、DP、CP/PCP、HCCL/CANN 这些底层词。写作代理汇报里建议的下一批相邻页：`data-parallel`、`decode`、`fia-operator`、`mtp`、`kv-connector-interface`、`flashcomm2`、`moe-comm-method`、`batch-invariance`、`preemption`。但**用户 09-20 对「一直在写稿子」表示过疑问**——不要再自作主张一批批开，先问要不要继续、要哪些；获准后按 §3 的写法派子代理，每批 3–4 页。
2. **27 个课程术语页。** 30 个里 `kv-cache`、`rope`、`prefill` 三页试点已由用户批准、写法也认可；用户说不急，但这是「名词不懂就能问」的前提。缺哪些词用 `pnpm wiki:lint --terms` 现查；三页试点**还没配图**，而 HANDBOOK 要求讲结构关系的页必须有图。**「把 `<Term>` 悬停卡接进课程正文」现在无处可接**：这个分支的 `src/app` 里没有任何地方渲染 `Step.terms`，课程画面此前已按用户要求删除、主仓库正在重做——等课程界面定下来再接，这不算漏做。
3. **夜间生成的参数骨架页。** 定义、默认值、约束、谱系是真的，解释正文写着「待补」，且不经审阅直接进 `wiki/params/`（既有设计：全是程序抽取的事实）。每晚最多 10 页，页数涨得比可读内容快。
4. **未解决的小项**：同步用的 Python 仍指向 Codex 的私有缓存目录（`wiki/sync.config.json`），本机 conda 可用，建议 `conda create -n llm-wiki python=3.12 -y` 后把 `python` 指过去——**要下载安装，必须用户点头，已问过两次未答复**；F004 AC3 的「够不够」仍是回答模型自报；矛盾检测 / 过期抽检 / 交叉审视从未在生产跑过（都要花钱，等用户决定）。
   另两项**不是缺陷，别再当 TODO**：`wiki/sources/` 空着，是因为它只是「存进 Wiki」保存问答记录的落点，还没人存过；`log.md` 记不进问答是**有意不做**——它属于知识快照，每问一次就写它会让知识版本号变、所有问答会话被重置。
5. **明确挂起、等用户说开始**：三项大批量导入（F001 AC5 全量灌种、F002 AC4 全量参数页、F003 AC1 GitHub 全库初拉）。

## 5. 怎么做事，和已经踩过的坑

**派子代理时：**

- **会话额度是所有模型共用的，不存在「用 Sonnet 省 Opus 的额度」。** 09-20 为了省额度派 3 个 Sonnet 做只读核查，它们各自又拆出 4 个子代理，并发冲到 14 个，额度直接打满，连正在写页的 Opus 也一起被掐断。**所有子代理合计并发 ≤ 3–4 个，且在给它们的说明里明写「不要启动任何子代理」**；被打断的用 SendMessage 让它从半成品接着做，不要重派。
- **大面积核对：先写脚本机械预筛，再派一个代理逐条判**，比派一群代理逐句读省一个数量级——同一件事，后者把额度打满还没产出，前者一个代理 17 分钟判完 91 条。
- **给写作代理的说明里必须写明：标题改成「名词：副标题」时，名词本身要留在 `aliases` 里。** 这轮漏了这条，重写后按原名（`Prefix Caching`、`KV Pool`）精确查不到页，靠全量单测才发现（`51b91e5` 补的）。
- **它写的引用行号要抽查。** `wiki:audit` 只查「行号在文件范围内」，查不出「指错了段落」（抓到过一处 `release_notes.md#L22-L31`，实际应为 L56-L62）。验收时打开源码核对它改掉的关键事实，每页 2–4 条。
- 并行派多个时，每个只许动自己的文件；`pnpm wiki:lint` 报别人页的问题是正常的。**子代理若把 `git mv` / `git add` 留在暂存区，主会话下一次 `git commit` 会把它们一并带走**——27 个 review 报告的重命名就这样混进了不相干的 `2c6f426`。提交前先 `git status` 看暂存区。
- Windows 下不要让子代理写「逐文件起一个 git 进程」的循环（一个子代理因此卡死 3 小时）；数行数用一条 `git grep -c "" <commit> -- '<glob>'`。
- 子代理正在写文件时别跑端到端测试，「构建版本号」那条会瞬时对不上，等它们写完再跑。

**写页与校验：**

- **加一页的路**（不花钱）：读 `tools/repos/` 里钉住的源码 → 按 HANDBOOK 写页 → 过下面那条校验 → 直接提交。需要用户过目时才改走 `pnpm wiki:stage --ids a,b [--touch concepts/邻居.md]` 产待审包（`--touch` 用来把「给邻居页补一条 relations」放进同一个包）。
- **提交前**：内容改动跑 `pnpm wiki:build`（必跑，刷 `registry.json` 与 `index.md`，不刷 `server/reader-build.test.ts` 就会红）→ `pnpm wiki:lint` → `pnpm wiki:audit` → `pnpm wiki:diagrams --check`；动了代码再加 `pnpm check`（= typecheck + lint + test + 依赖/内容检查 + 图检查 + wiki:lint，记得带 `WIKI_PYTHON`），前端改动另跑 `pnpm test:e2e`。
- 写的行号必须是实际打开读过的行。证据用钉住的源码：vllm-ascend main 全库统一钉在 `b255ab59`，vLLM 发布版是 v0.23.0（`vllm@0fc695fc`）；另可用论文、官方模型卡。
- **往文件里写带反斜杠或反引号的内容，不要用 heredoc 或 `python -c`**，会被转义吃掉（这轮又踩了一次）；整文件直接用 Write 工具写。
- HANDBOOK 写了可引 `infer-lab@commit`，但**代码里没实现这种来源**，引了过不了校验。
- 全库共用一条请求（`concepts/one-request.md`：37 token 问题、200 token 回答），能落到它上面的页都要写「这条请求走到这里时发生了什么」。
- 图（wiki-diagram）**不缩放、窄了横向滚**，是既定决策，不要改成缩放。
- 改 `scripts/wiki/*.ts` 会让 Vite dev server 重启并重新预构建依赖（约 40 秒），因为 `vite.config.ts` 经 reader-plugin 间接 import 了它们；这期间页面打不开是正常的。
- `pnpm test` 要带 `WIKI_PYTHON`（取 `wiki/sync.config.json` 的 `python`），否则参数扫描相关测试会用到旧解释器。
- `pnpm lint` 有 14 条 `noDescendingSpecificity` 警告，是规则只看选择器末尾元素造成的误报，不要为消警告去改选择器。
- 问答侧：「声明未收录」的回答判 `cited: true` 是复测验收（`scripts/wiki/retest.ts:244`）依赖的语义，**看着像 bug 也不要改成 false**——试过，`worker.test.ts` 会红，「结论带引用 + 其他版本尚未收录」这种好回答会永远验收不了。前端该显示的中性「未收录」标记已经补上（`ChatDrawer.tsx`，`data-testid="chat-uncovered"`）。
- 用户对视觉要求高，前端改动必须截图验收。应用内浏览器面板截图经常超时，用仓库自带 Playwright 写临时脚本截（放 `test-results/`，已 gitignore）。

## 6. 2026-09-20 这轮做了什么

- **阅读页**：目录固定四部分（基础 → 全流程 → 特性 → 参数，`src/content/wiki/toc.ts` 是唯一定义，参数默认折叠，`06a6cb2`）；右侧面板加只读「状态」页签（`c07da54`）；未收录的回答有了中性标记（`7d145f2`）。
- **内容（重写）**：09-07 那批老风格概念页全部按新写法重写（`4d4cdc9` … `403ac38`），9 个手写参数页更新；全库 main 来源统一重钉到 `b255ab59`、seeds 的钉点同步（`4432386`）；mermaid 全部迁成 wiki-diagram，渲染器与依赖已删（`b222c58`）。重写时每页都对着上游源码核实、改掉了老页的事实错误（例：main 上 KV 量化必须同时给 C8 权重和 `--kv-cache-dtype`，PR #15514；Recompute CPU Offload 改名 Preempt Offload，PR #16510；main 从 KV 池的 key 里删了 pcp，升级即清池；310P 已支持前缀缓存）。
- **内容（新写）**：8 个特性页首次上线——TP / PP / SP 三种并行、MLA、GQA、投机解码、PD 分离、chunked prefill（`60d561d` … `5e452c7`，`1b370af` 刷 registry 与 index）。
- **引用质量**：新命令 `pnpm wiki:cite-screen` 机械预筛「引用行里没有句子点名的标识符」（`72dbe1b`），全库跑了一轮——48 条来源范围过窄已就近放宽（`a0e07e2`），91 条可疑里 10 条是真错已修、其余 81 条是误报（`f7272bd`）。证据标记正则与「S/C/M 必须带编号」两处重复定义收成一处（`b5d25cf`）。
- **语义核对（24 页做完）**：09-19 手写直入 `concepts/` 的 24 页已逐句对照钉住的源码核过（`b5bd499` 第一批 12 页、`e00ae72` 第二批 12 页，另加本轮 `block_size` 因果链一处），共改正约 80 处。典型错误四类：行为说反或说过头、漏掉前提条件、数字错、角标指到不相干的行。**审视文档 §5「未核实的」里「24 个手写页未做语义复核」这一条到此了结**（那份文档写完即定稿，不动它）；同批 19 个旧页已在 09-20 重写时逐页核过。
- **问答**：预算恢复后第一次用真实模型实测，链路通（检索命中重写后的页、回答带引用、账本记账），单次约 $0.45。
- **夜间维护**：死循环修掉（超限时只做前 N 个、其余留到下一晚，上限 10，`0c3d40d`），03:00 定时任务实跑成功（`9567b6c`、`7283d4c`）。
- **工具修复**：`wiki:stale` 三处误判（重钉过的页被静默跳过、有意钉住发布版的页误报过期、分支读不到时悄悄说「都没变」）；`wiki:audit` 不再必须点名 seeds（`6c47729`）；`wiki:gaps` 去噪声（`b9d56b0`）；图渲染器按等宽字体算宽度，溢出检查不再漏报（`c3958de`），实体色块按粗拉丁文本定宽（`b6c234f`）；标记上限与事实表上限原先各定义两遍且数值不同，现统一在 `scripts/wiki/limits.ts`。
- **文档**：HANDBOOK 的推荐写法换成新风格并消掉内部矛盾（`8944b1a`）；四份 feature 验收表更新到 09-20（多条如实降级）、状态真相源统一、27 份逐轮 review 报告归档到 `docs/plans/archive/`（`c45aaf5`）。
