# LLM WIKI 交接

> 更新于 2026-09-21。这一页只写「现在在哪、接下来做什么、哪里会踩坑」。
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
| 站外链接有没有死链 | `pnpm wiki:urls`（真发 HTTP，不调模型；404 / 410 才算死链，403 / 5xx / 超时只列「这次没验证到」。每晚 `wiki:sync` 也做同一件事） |
| 别的 agent 怎么查这个库 | `pnpm wiki:find "<词>"`、`--page <id>`、`--neighbors <id>`、`--json`；MCP 是 `pnpm wiki:mcp`。使用说明 [wiki/AGENTS-GUIDE.md](wiki/AGENTS-GUIDE.md) |
| 夜间维护上次结果 | `wiki/_jobs/sync/last-run.json`；任务本身是 Windows 计划任务 `LLM-Wiki-infra-view-new-llm-wiki`（每日 03:00，`scripts/wiki-schedule.ps1` 注册，配置 `wiki/sync.config.json`） |

## 3. 方向

**机制过度建设，内容停在试点**（2026-09-19 审视，明细见 [wiki-audit-2026-09-19](docs/plans/wiki-audit-2026-09-19.md)）：四天里验收条件从 8 条涨到 34 条，代码两万多行，服务的却是四十多页。所以：**不再加机制、不再加验收条件、不再写逐轮 review 报告。** 新工作先问一句「这让用户读到的内容变多变好了吗」。

那份审视写完即定稿、不更新；**它每一条结论现在到哪了、哪里是用户同意的暂时偏离（要做回来）、还有哪些更早提过的要求没做**，看 [wiki-audit-status-2026-09-21](docs/plans/wiki-audit-status-2026-09-21.md)（接手时读它一遍，再看下面 §4 的优先级）。

**用户 2026-09-20 定的做事方式——接手的人最容易做错的就是这一段：**

- **凡是写文档 / 知识页的活一律派 Opus 5 子代理写，主会话不自己写正文**；主会话负责定规范、派活、逐页核对事实、跑校验、提交。
- **暂时不逐页待审**：和用户方向一致时，写好并过校验就直接更新知识库。`pnpm wiki:stage`（不调模型、过同一套生产校验、产出待审包）仍在，只用于确实需要用户过目的改动。**这是过渡办法**——用户 09-21 明确「只是暂时这样」，「agent 写、人只审」最后要做回来，见 §4 开头那笔欠账。
- **一直往下推进，不要停下来问**，除非需要用户审批或确实拿不准。
- **页面写法**：用户认可的是 `wiki/concepts/vllm-v1-shape.md`、`vllm-ascend-overview.md` 那一类（一句话 + 图 → 那条请求走到这里 → 结论句小标题 → 常见误解）。全库已统一，规则写在 HANDBOOK「页面格式 › 正文分节 › 教学页的推荐写法」。
- **预算账本是保险丝，不是功能开关。** 用户的本意只是「地基做好之前不大批量导入」，2026-09-20 已同意恢复并调高上限。单次真实问答实测约 $0.45，照这个价 $100 上限约 180 问。大批量导入（全量灌种 / 全量参数页 / GitHub 全库首拉）放在最后一步，必须用户点头后手动执行，**没有任何自动入口会触发**（夜间任务要花钱得配置里有 `paid` 块且配额 > 0，现在没有）。任何一次调用超时拿不到账单，账本会再次自动暂停，状态页签会写明原因。

**用户 2026-09-20 定的「章节与知识库的关系」——这是写作约定，不要为它加机制：**

- 整个项目是教学平台，PLAN.md §1.1 的 22 个主章节**本身也要详细讲解**；动画是配合讲解的，不是「文字很少、只有动画」。
- 知识库里教学式的长页（`tensor-parallel`、`pipeline-parallel`、`chunked-prefill`、`vllm-v1-shape` 等）和主章节主题重叠。**写某一章时，先查 frontmatter `chapters` 里挂了该章号的页，以它们为底稿扩写**——这些页已对过钉住的源码、带行号。
- 章节开头记一行「基于哪几页知识库页」；这些页因上游变化被改时，回头看对应章节。写章节时发现知识库缺了或错了，**先补知识库再扩写**，知识库始终是事实的底。
- 这条已补进主仓 `infra-view-new` 的 PLAN.md §1.3「章节与知识库的关系」，整站的位置关系见同仓 `PROJECT-MAP.md`（见 §6）。

## 4. 接下来做什么（按优先级）

**先记一笔欠账：恢复「agent 写、人只审」。** 现在「不走待审、Opus 直接写进知识库」是**过渡办法**，不是长期约定——用户 09-21 原话「这里我的意思只是暂时这样 要做」。要还的两笔（补这批页的 raw / log 或给它们如实的 `origin`；把 `wiki:ingest` → `_drafts/` → `wiki:review` 真跑通，它等同于打开 `maxTasks`）写在 [wiki-audit-status-2026-09-21](docs/plans/wiki-audit-status-2026-09-21.md) §3。**还账的时点用户 09-21 已经定了：这个阶段做完、大规模导入之前开 `maxTasks`**（见下面第 8 条）。在那之前照旧写页，但别把现状当终态。

**特性页主线已补齐、v0.26 已对完**（§6），所以剩下的是：

1. ~~参数骨架页的正文~~ —— **09-21 已完成**：误报的 5 页删掉之后剩 10 页，当天全部补成正文（名单与要点见 §6）。`wiki/params/` 里已没有写着「待补」的页（现查 `git grep -l 待补 -- wiki/params`）。
2. **课程术语页。** 30 个里 `kv-cache`、`rope`、`prefill` 三页试点已由用户批准、写法也认可；缺哪些词用 `pnpm wiki:lint --terms` 现查。**等模型计算层的章节在另一个会话定下来再做**（术语要跟着章节走）；三页试点还**没配图**，而 HANDBOOK 要求讲结构关系的页必须有图。**「把 `<Term>` 悬停卡接进课程正文」现在无处可接**：这个分支的 `src/app` 里没有地方渲染 `Step.terms`，等课程界面定下来再接，不算漏做。
3. **硬件页**：留到硬件段最后接入，不要提前开。
4. **LMCache / UCM 两篇**：官方特性主线就剩这两篇第三方存储部署指南，写法同三版本规则。
5. **main 重钉**：库里 main 来源统一钉在 09-19 的 `b255ab59`，上游每天在动，`wiki:stale` 已经在报一批（预期内）。重钉是一次性的一笔活——`wiki:stale --fetch` 出清单 → 逐页核 → 统一改 seeds，挑一轮专门做，不要顺手做。
6. **新页作者们反复建议补的地基页——是建议，不是已定**：被点名最多的是 `hardware-profile`（设备类型）、`model-runner-v2`、`mooncake-connector-v2`、`fused-moe-layer`。开写前先问用户。
7. **明确挂起、等用户说开始**：三项大批量导入（F001 AC5 全量灌种、F002 AC4 全量参数页、F003 AC1 GitHub 全库初拉）**仍放在最后一步，必须用户点头**。
8. **两件已定、不必再问的事**：① **conda 环境不用建**（用户 09-21 定）——参数扫描脚本 `scripts/wiki/params/scan.py` 只 import `ast` / `json` / `re` / `sys`，全是标准库，任何 3.11+ 的解释器都跑得了（3.11 是硬下限：钉住的 main 快照里有两处 `typing.Literal[*args]` 这种 PEP 646 星号下标，3.10 及以下 `ast.parse` 直接语法错、整轮扫描退出）。开源用户 PATH 上有 Python 3.11+ 就行，不合适再写一行 `wiki/sync.config.local.json`（gitignore，`{"python": "<路径>"}`）。这台机器现在借的是 Codex 私有缓存里的那份，哪天它没了，夜间任务会**当场报错**并在错误信息里写明「解释器 X；当前上游需要 3.11+，可用 `WIKI_PYTHON` 或同步配置 `python` 指定」（`scripts/wiki/params/scan.ts:17`），不会悄悄坏掉，所以不值得为它装一套 conda；② **`maxTasks` 什么时候开**——用户 09-21 定：**等这个阶段做完、大规模导入之前再开**。它一开，新内容自然走「agent 写草稿 → 人在面板上审」，上面那笔欠账也就一并还了。另外两个付费开关（`reconcileBatches` / `driftSample`，各是什么见状态文档 §6）照旧建议先不开；F004 AC3 的「够不够」仍是回答模型自报。
   还有两项**不是缺陷，别再当 TODO**：`wiki/sources/` 空着，是因为它只是「存进 Wiki」保存问答记录的落点，还没人存过；`log.md` 记不进问答是**有意不做**——它属于知识快照，每问一次就写它会让知识版本号变、所有问答会话被重置。

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
- 写的行号必须是实际打开读过的行。证据用钉住的源码：vllm-ascend main 全库统一钉在 `b255ab59`，发布分支两个——v0.23.0（配套 `vllm@0fc695fc`）与 v0.26.0rc = `2ed6cbba`（配套 `vllm@568afb3a`）；另可用论文、官方模型卡。
- **往文件里写带反斜杠或反引号的内容，不要用 heredoc 或 `python -c`**，会被转义吃掉（这轮又踩了一次）；整文件直接用 Write 工具写。
- HANDBOOK 写了可引 `infer-lab@commit`，但**代码里没实现这种来源**，引了过不了校验。
- 全库共用一条请求（`concepts/one-request.md`：37 token 问题、200 token 回答），能落到它上面的页都要写「这条请求走到这里时发生了什么」。
- 图（wiki-diagram）**不缩放、窄了横向滚**，是既定决策，不要改成缩放。
- 改 `scripts/wiki/*.ts` 会让 Vite dev server 重启并重新预构建依赖（约 40 秒），因为 `vite.config.ts` 经 reader-plugin 间接 import 了它们；这期间页面打不开是正常的。
- `pnpm test` 要带 `WIKI_PYTHON`，否则参数扫描相关测试会用到旧解释器。取值在**本机覆盖文件** `wiki/sync.config.local.json` 的 `python`（共享的 `sync.config.json` 09-21 起不再写路径）。PowerShell 里一条搞定：
  `$env:WIKI_PYTHON = (Get-Content wiki/sync.config.local.json | ConvertFrom-Json).python; pnpm test`
- `pnpm lint` 有 14 条 `noDescendingSpecificity` 警告，是规则只看选择器末尾元素造成的误报，不要为消警告去改选择器。
- 问答侧：「声明未收录」的回答判 `cited: true` 是复测验收（`scripts/wiki/retest.ts:244`）依赖的语义，**看着像 bug 也不要改成 false**——试过，`worker.test.ts` 会红，「结论带引用 + 其他版本尚未收录」这种好回答会永远验收不了。前端该显示的中性「未收录」标记已经补上（`ChatDrawer.tsx`，`data-testid="chat-uncovered"`）。
- 用户对视觉要求高，前端改动必须截图验收。应用内浏览器面板截图经常超时，用仓库自带 Playwright 写临时脚本截（放 `test-results/`，已 gitignore）。

## 6. 2026-09-21 这轮做了什么

- **加了 v0.26，不是换版本**（用户 09-21 定）：v0.23 维护分支、v0.26、main 三个在册版本长期并存。seeds 登记 `releases/v0.26.0rc` = `vllm-ascend@2ed6cbba`（分支 tip，还在 rc），配套上游 vLLM v0.26.0 = `vllm@568afb3a`（`74b053a`）。
- **`pnpm wiki:versions`**（只读，不调模型不花钱）：对钉在 `--from` 上的每条来源，查所引的那几行在 `--to` 上是不是原样（same / moved / changed / gone）；`--init` 建字段，`--mark` 记核对结果，已对过目标版本的页不再列出（`8aa80cc`）。
- **`verified: [...]`**：frontmatter 新字段 + 页头「已核对 v0.23.0 · v0.26.0rc · main」+ lint `unknown-verified-ref`（只查名字拼没拼对）。**绝不自动记**：行没变不等于每句话还成立，数出来的 `[D]` 结论根本不落在任何来源的行号里。踩过的坑——撤回那次自动标记时 sed 漏了「只有一个版本」的写法，两页带着错标记挂了一夜。标记只能在人看过之后加。
- **全库对 v0.26 核完了**（`f932968`、`e6bf8db`、`75d7496`、`6307720`、`35db847`）：`wiki:versions` 现报「已对过 78 页；还没对过 1 页」，剩的 `dyntra-lb` 只有 main 有，属正常。每页的真实差异进了各自的差异表；**全库级的几条结论最该先知道**：那条共享请求的全部设定在 v0.26 上一个没变；v0.26 的 `AscendConfig` 仍是逐键 `.get()`，写错或已删的键静默忽略，main 才报错；默认调度器是被 patch 换掉的 `BalanceScheduler`，v0.26 外面再套一层 `KVDeliveryScheduler`；`vllm_version_is` 调用处 49 → 10；KV 池 key 三个版本互不通用；PCP 在 v0.26 的 model runner v1 上整个被摘掉。
- **新写 25 页特性页，全部三版本写法**：先查这个特性在三个版本上各存不存在 → `## 一句话` 后第一段写明存在范围 → 主叙述以「它存在的最早那个发布分支」为准、正文只写一遍 → 只列有差异的行与有差异的版本 → `verified` 只填真逐条对过的；规则的唯一真相源是 `wiki/HANDBOOK.md`「页面格式 › 版本」与「教学页的推荐写法」。这 25 页：调度 9、并行 / EP 6、PD 与 KV 传输 3、图模式与算子 3、量化 / LoRA / 结构化输出 / AI QoS 4（`ai-qos` 其实是 UB 交换机上的流量 QoS，归硬件 / KV 传输那章，不是调度）。页名现查 `git log --diff-filter=A --name-only 74b053a^..HEAD -- wiki/concepts`。**官方特性主线到此只剩 LMCache、UCM 两篇第三方存储部署指南没写。**
- **旧页被新页查出来的更正**（`551a0b7`、`d18d319`）：默认调度器类被 patch 换掉、那条请求默认走异步调度（`step_with_batch_queue`）、`kv-cache-quantization` 的 `--quantization ascend` 其实可不写、细粒度 TP 的细节与检索词从 TP 总览页挪到 `fine-grained-tp` 专页、两页卸载类页面的主叙述改钉到发布分支。
- **顺手修的两个脚本问题**（`13a83ef`）：`wiki:lineage:apply` 把页面标题当参数名，标题写成「中文名（参数名）」时整批失败——现在取括号里的参数名，取不到就跳过该页；参数页「版本谱系」表改成逐个发布分支列出（v0.13 … v0.28 + main）。
- **主仓有了项目地图**：`infra-view-new/PROJECT-MAP.md`（草稿，a–h 五段结构已由用户定，章号待模型计算层定下来后统一编；**特性段以官方文档点出的全集为准**，不以知识库现有页为准）与 PLAN.md §1.3「章节与知识库的关系」——两处**已提交**（主仓 `0aebe95`）。
- **下午做的三件（都已提交，细节见状态文档 §4、§5）**：**agent 只读入口**（`d9f4fe5`、`bfacba1`）`pnpm wiki:find` + 只读 MCP `pnpm wiki:mcp`，与站内问答共用 `src/content/wiki/retrieve.ts` 这一个检索入口，说明在 [wiki/AGENTS-GUIDE.md](wiki/AGENTS-GUIDE.md) 与 `.claude/skills/llm-wiki/SKILL.md`；**站外死链真发请求**（`a64bce1`）`pnpm wiki:urls`，404 / 410 才算死链，已挂进每晚巡检，首跑 95 条里修了 1 条；**同步配置的本机覆盖**（`7781837`）`wiki/sync.config.local.json`（gitignore）盖在共享配置上，共享配置不再写死解释器路径，不写 `python` 时退回 `WIKI_PYTHON`、再退回 PATH 上的 `python`。
- **参数扫描器的一次修复与一次清理**（`a306f29`）：原规则是「类名以 `Config` 结尾 = 确定的 `additional_config` 键」，而夜间任务对「确定」的条目**直接生成正式页**，于是内部 dataclass `WeightSwitchConfig` 的 `group` / `rank` / `world_size` / `shard_axis` 和 xlite 里一个 TypedDict 的 `mask` 被生成了 5 个正式参数页。现在的判据：扫描范围里有 `AscendConfig` 时，只有「定义在它所在的文件里」或「被那个文件点名用到」的类才算确定，其余降为 suspect、不自动出页（main 上 149 个字段里 111 个仍确定，全在 `ascend_config.py`）。5 个误报页已删，知识库现在 90 页（现查 `src/content/wiki/registry.json`）。
- **扫描器那三类不准已修**（`2329ead`）：① 字段注解写成 `Any`、靠工厂函数构造后按关键字传进 `AscendConfig(...)` 的子配置，现在挂在正确的键下（`additional_config["sparse_kv_offload_config"]["use_fused_overlap"]`）；② `_NON_USER_INPUT_KEYS` 里、且根配置文件中没有任何一处从用户输入读它的键（`kvpp_config` 及其下的 `size`、`pd_tp_ratio`、`pd_head_ratio`、`num_head_replica`、`enable_sp_by_pass`）判成 suspect，不再自动出页；③ `AscendConfig` 够不着的类，路径改以类名起头（`YuanrongConfig["use_layerwise"]`、`WeightSwitchConfig["rank"]`），不再谎称挂在 `additional_config` 下。main 上 149 个字段、105 个判成确定（全在 `ascend_config.py`），四页正文里原先兜底的说明已改成正面写法。
- **以后再动扫描器，迁移要照这套做**（细节与验证口径见状态文档 §2）：身份键变了的页，在 `wiki/params/identities.json` 加一条绑定把新身份键指回原页 id（页面 id 与公开链接都不变）；用 `buildParamPage(..., previous)` 重算该页的生成区；**用新扫描器按各自钉住的提交重算 `wiki/_jobs/parameter-sync/` 下的三份基线**，否则夜间任务会把「身份变了」当成「新增参数」，再生成一批骨架页。**改扫描器一定要拿真实仓库跑一遍**——这次就是在真实仓库核对时抓到并修了一个自己刚引入的 bug（根配置自己的类方法赋值被当成子配置，所有路径凭空多出一层），已用测试钉住；单元测试覆盖不到上游的写法。
- **补完最后 10 个参数骨架页**（`params/`，`updated: 2026-09-21`）：`kvpp_config`、`size`、`enable_super_kernel`、`use_fused_overlap`、`c8_enable_reshape_optim`、`combine_quant_mode`、`enable_force_eplb`、`enable_pcp_o_proj_weight_sharding`、`sfa_dcp_force_tmajor_restore`、`use_layerwise`。**统一成手册规定的参数页五节 + 生成区**（一句话 / 事实表 / 为什么存在 / 开了的代价 / 版本谱系 / 参数定义（自动生成）），不写教学页才有的「常见误解」——HANDBOOK「整合」那条写得很明白，四篇样板页也都没有这一节。其中值得先知道的三件事：`c8_enable_reshape_optim` 在钉住的 main 快照 `b255ab59` 上**不存在**（上游 09-07 删掉用户键、09-20 又恢复且默认值翻成 `True`，快照正落在中间，官方教程的启动行照抄会起不来）；`enable_force_eplb` 开了**输出就不对**（它是压测夹具，把路由整表换成轮转表，不是优化开关）；`combine_quant_mode` 配上 `enable_fused_mc2` 反而失效（融合路径不走 `token_combine`，这个键一次都不会被读）。
- **本轮收尾的验证**：单元 716 通过、e2e 30 通过、typecheck 通过、lint 保持 14 条基线警告。最后一次全量验证现查这几条：`pnpm test`（要带 `WIKI_PYTHON`）、`pnpm exec playwright test tests/wiki`、`pnpm typecheck`、`pnpm lint`、`pnpm wiki:lint | audit | diagrams --check | stale | versions`。**`wiki:stale` 报一批页引用的文件变了是预期内的**——上游 main 每天在动，库里钉的是 09-19 的 `b255ab59`，重钉是一笔单独的活（§4）。

## 7. 2026-09-20 这轮做了什么（摘要）

- **阅读页**：目录固定四部分（基础 → 全流程 → 特性 → 参数，`src/content/wiki/toc.ts` 是唯一定义，参数默认折叠）；右侧面板加只读「状态」页签；未收录的回答有了中性标记。
- **内容**：09-07 那批老风格概念页全部按新写法重写（`4d4cdc9` … `403ac38`），重写时逐页对着上游源码改掉老页的事实错误（例：main 上 KV 量化要同时给 C8 权重和 `--kv-cache-dtype`；Recompute CPU Offload 改名 Preempt Offload；main 从 KV 池 key 里删了 pcp，升级即清池；310P 已支持前缀缓存）；首批 8 个特性页上线（TP / PP / SP、MLA、GQA、投机解码、PD 分离、chunked prefill）；全库 main 来源统一重钉到 `b255ab59`（`4432386`）；mermaid 全部迁成 wiki-diagram，渲染器与依赖已删。
- **引用质量**：新命令 `pnpm wiki:cite-screen` 全库跑了一轮——48 条来源范围过窄已放宽，91 条可疑里 10 条真错已修、81 条是误报。09-19 手写直入的 24 页逐句语义核对做完，改正约 80 处（行为说反、漏前提、数字错、角标指错四类），**审视文档 §5 那条欠账到此了结**（那份文档写完即定稿，不动它）。
- **问答 / 夜间维护**：预算恢复后第一次用真实模型实测，链路通，单次约 $0.45；夜间死循环修掉（超限只做前 N 个，上限 10），03:00 定时任务实跑成功。
- **工具与文档**：`wiki:stale` 三处误判、`wiki:audit` 不再必须点名 seeds、`wiki:gaps` 去噪、图渲染器宽度计算修正；重复定义的上限常量统一到 `scripts/wiki/limits.ts`；HANDBOOK 推荐写法换成新风格；四份 feature 验收表更新到 09-20（多条如实降级），27 份逐轮 review 报告归档到 `docs/plans/archive/`。
