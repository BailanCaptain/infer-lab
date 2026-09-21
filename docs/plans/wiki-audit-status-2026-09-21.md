# LLM WIKI 审视回看（2026-09-21）

[wiki-audit-2026-09-19](wiki-audit-2026-09-19.md) 是那次审视的定稿，**不改**。这一页回答四件事：那次审视原本要干什么、清单上的问题现在各自到哪了、有没有走偏、用户更早提过但不在清单里的要求现在是什么状态。最后一节写接手的人先做什么。

会变的数字不写死，给现查命令。交接与优先级仍看 [HANDOFF-LLM-WIKI.md](../../HANDOFF-LLM-WIKI.md)。

## 1. 这个审视会话原本要干什么

用户 2026-09-19 的原话：

> 我们整体LLM-WIKI的实现 符合我的需求吗？

随后给的任务：审视 LLM WIKI 这个特性的全部文档与现状，判断三件事——**是否符合我的要求、有没有走偏、有没有优化点**。判准分两层：外层是用户的原始理念 `C:/Users/-/Desktop/infra-view-new/llm-wiki.md`，内层是 `docs/features/` 与 `docs/plans/` 里自己定下的验收条件。要求是：先结论后证据，每条结论带证据，本轮只审不改，用户拍板后再动手。

审完的结论是**机制过度建设、内容停在试点**。之后两天的工作方式就是：按审视清单逐项修 → 接住用户陆续加的要求（目录固定四部分、状态页签、全库统一写法、写文档一律派 Opus、加 v0.26、按官方文档补齐特性页）。

## 2. 审视清单逐条现状（对照原审视 §2）

### P1

| # | 原结论 | 现状 |
|---|---|---|
| 1 | 「名词不懂就能问」没落地 | **部分**。30 个课程术语（`src/sim/model/forwardLayer.ts` 的 `Step.terms`）现在 4 个有页（`kv-cache`、`rope`、`prefill`、`gqa`），缺哪些现查 `pnpm wiki:lint --terms`。用户说先不急；模型计算层的章节在另一个会话重定，术语清单可能跟着变。`<Term>` 悬停卡接不进课程正文，因为课程页面还不存在 |
| 2 | 24 个手写页绕过审阅 | **已关**（内容层面）。逐句对过源码，改正约 80 处（`b5bd499`、`e00ae72`、`dd3cc6a`）；09-21 又整体对了一遍 v0.26。流程层面的账见 §3 |
| 3 | 理念里的操作没做到 | **未做，有意**。`wiki/sources/` 仍是空目录；问答不回填 `log.md`（会改知识快照的版本号、重置所有问答会话）；矛盾检测 `wiki:reconcile`、过期抽检 `wiki:drift` 是付费机制，`wiki/sync.config.json` 里 `reconcileBatches` / `driftSample` 仍是 0，建议页数再多一些再开。`maxTasks` 同是 0，但**开的时点 09-21 已定**：这个阶段做完、大规模导入之前（见 §6） |
| 4 | 夜间维护空转 | **已关**。每晚上限 10、分批推进；09-21 03:00 正常跑完，并给 v0.26 建了参数基线。同步用的 Python 09-21 已结：**不建 conda 环境**，见 §6 |
| 5 | 知识过期没人知道 | **机制在，是一笔单独的活**。09-20 全库重钉到 `b255ab59` 时 `wiki:stale` 报 0；上游每天在动，现在又报一批（现查 `pnpm wiki:stale --seeds wiki/seeds/vllm-ascend-code.yaml`，只读）。重钉见 HANDOFF §4.5 |
| 6 | 未收录的回答没标出来 | **已关**。`ChatDrawer.tsx` 的「未收录」标记 + e2e |
| 7 | 缺口发现靠回答模型自报 | **未做**。仍是回答模型在末尾自报 `satisfied`（`server/coverage.ts:5`，同文件 `:9` 的注释自己写明这不是 F004 AC3 要的独立判定）。独立评判是付费机制，等用户点头 |
| 8 | 大量内容不在 git 里 | **已关** |

### P2（13 条）

- **12 条已关**：状态真相源统一、AC11/mermaid、HANDBOOK 不自洽、规则三处定义、`related` 残留、F004 引用不存在的切片、成本数字、`wiki:audit` 默认 seeds、`wiki:gaps` 噪声、review 报告归档，以及「注意力后端四个还是五个」——已对源码查实：v0.23 是五个，v0.26 起六个；无入链页也处理了。
- **1 条不做**：`CLAUDE.md` 与 `AGENTS.md` 逐字重复是有意保留（两个工具各读一份）。
- **3 处只报告不处置**（不是 AI 写的文件，按「不动用户文件」的规矩放着）：过期草稿 `wiki/_drafts/profiling-chunk-config.md`、`wiki/_gaps.json` 里已补写但未标关闭的缺口、无人引用的 `scripts/wiki/eval-call.ts`（全仓库只有它自己的测试引用它）。

### 09-21 新发现的一条：参数扫描器把内部类当成了用户键

原规则是「类名以 `Config` 结尾 = 确定的 `additional_config` 键」，而夜间任务对「确定」的条目**直接生成正式页**，于是内部 dataclass `WeightSwitchConfig` 的 `group` / `rank` / `world_size` / `shard_axis`、以及 xlite 里一个 TypedDict 的 `mask`，各自得到了一个正式参数页。`a306f29` 收紧了判据（扫描范围里有 `AscendConfig` 时，只有定义在它所在文件里、或被那个文件点名用到的类才算确定，其余降为 suspect、不自动出页），删掉那 5 页。

**还剩三类不准，未修，记为欠账**：① 子配置类不是靠类型注解字段挂到 `AscendConfig` 上时（main 上的 `SparseKVOffloadConfig.from_additional_config(..., additional_config.get("sparse_kv_offload_config", {}))`），字段被推成顶层键——`use_fused_overlap` 的真实路径是 `additional_config["sparse_kv_offload_config"]["use_fused_overlap"]`；② 不认 `_NON_USER_INPUT_KEYS`——`kvpp_config` 是工厂注入的，用户写了会被静默剔掉，却被当成用户键；③ 定义在别的配置面上的键（`kv_connector_extra_config`、`$YR_CONFIG_PATH` 指的 JSON）被标成 `additional_config[...]`——`use_layerwise`。三类现在都靠页面正文里的 `[!]` 说明兜着。**①③ 不能顺手改**：改了会动参数的身份键（`json_path`）→ 页面 id 的哈希后缀跟着变 → 现有页变成孤儿、夜间任务重新生成一批，要和「参数页 id 迁移」一起做；② 可以单独修（从根配置文件里解析出那个集合，命中的降为 suspect）。

### 总判断的现状对比

| 审视时（09-19） | 现在（09-21，现查命令见 HANDOFF §2） |
|---|---|
| 页数四十多 | 90（`src/content/wiki/registry.json`；当天先删了 5 个扫描器误报的参数页，见 §2 下面那条，再把剩下 10 个骨架页补成正文） |
| 配图零星 | 78 张，spec 与 SVG 一一对应（`wiki/diagrams/`） |
| 官方 51 项特性里只有 13 项有专页 | 基本补齐，只剩 LMCache、UCM 两篇 |
| 在册版本 2 个 | 3 个（v0.23.0 / v0.26.0rc / main），78 页已逐条对过 v0.26 |
| 机制两万多行、还在涨 | 审视之后**只加了两样机制**：`wiki:versions` 跨版本比对、页头 `verified` 标记，都是用户点名要的 |

## 3. 有没有走偏

**没偏的**：主线始终是「先审、逐项修、内容优先、不再堆机制」。用户后加的要求都落了地，并写进了交接。

**暂时的偏离（用户同意先这样，但要做回来）**：原始理念与 F001 是「agent 写、人只审」，页面应走 `wiki:ingest` → `_drafts/` → `wiki:review`。这一轮新写与重写的页**全部**是「Opus 子代理直接写进 `wiki/concepts/`，主会话打开钉住的源码每页抽查 2–4 条关键事实后提交」——不走待审、没有 `raw/` 摘录、`log.md` 里没有对应的 ingest 记录。用户 09-20 原话：

> 可以 不用待审了 如果你的下一步和我想做的一样的话 你写好直接更新知识库就行了

用户 09-21 看到本页初稿后更正：

> 一处有意的偏离，你同意过 这里我的意思只是暂时这样 要做

所以「不走待审」只是暂时的权宜做法，「agent 写、人只审」这条流程最后是要做回来的，没有被放弃。这是一笔**明确的欠账**，要还的有两笔：

1. **补这一轮直接发布的页的来路。** 涉及 09-19 的 24 页手写页、09-20 重写 / 新写的页、09-21 新写的 25 页特性页（页名现查 `git log --diff-filter=A --name-only`）。它们没有 `wiki/raw/` 摘录，`wiki/log.md` 里没有对应的 ingest / review 记录，`origin` 标的是 `seed`（现在**全库每一页**都是 `seed`，页数现查 `registry.json`）但并非 ingest 的产物。恢复流程时要么把 raw 与 log 补上，要么给它们一个如实的 `origin`（需要的话扩 `PAGE_ORIGINS`，`src/content/wiki/schema.ts:28`——**先改 HANDBOOK 再改 schema**）。
2. **把 `wiki:ingest` → `_drafts/` → `wiki:review`（审阅面板 `/api/wiki/reviews`）这条流水线真的跑通一遍。** 它和 `wiki/sync.config.json` 里的 `maxTasks` 是同一件事——`maxTasks` 一打开，新内容自然就走「agent 写草稿 → 用户在面板上审」。**时点用户 09-21 已定：这个阶段做完、大规模导入之前开**（见 §6）。开的时候要同时配 `paid`（模型 + 预算上限），否则 `sync.ts` 直接报错。

在那之前继续沿用现在的人工闸：主会话打开钉住的源码，每页抽查 2–4 条关键事实再提交——**这是过渡办法。**

**需要留意的漂移风险**：

1. 这两天精力几乎全在内容上，审视里「等用户决定」的三件事（付费机制、Python 环境、推远端）一直挂着，没人推。
2. 知识库和主项目的关系是 09-21 才对齐的（主仓 `PROJECT-MAP.md`、`PLAN.md` §1.3，已提交 `0aebe95`）：知识库是主章节的底稿 + 右侧问答，**不是独立产品**。继续无限扩页之前应回到主线。

## 4. 用户更早提过、不在这次审视清单里的要求

用户 2026-09-10 在另一个会话的原话（逐字）：

> 然后还有一点 我们LLM-wiki整体是否符合越用越聪明？？ 假设做出来之后问问题是agent怎么查？ 如果查不到怎么办？ 是否会有如果是LLMwiki查不到 但是会自动去整合写wiki给人工审批是否需要加入wiki 加入wiki的时候是否会交叉审视 建链等各种操作 死链是否会有定期审查 这部分都参考的C:\Users\-\Desktop\Multi-Agent这个吗？ 还有C:\Users\-\Desktop\Multi-Agent中是可以手动drop资料进来的 我们有吗 如果有逻辑是怎么样 如果没有 我需要

同一天稍后：

> ……用户问也希望 我可能就问 layer share是什么难道就查不到了吗 ……如果拉取的知识本身就有图我们会保留吗 我们这个LLM wiki还有个大缺陷是不是图比较少？还有一点 很多的wiki之间都是有联系的对吗 如果对的话我们的回答能体现这一点吗？

逐条现状：

| 问的是什么 | 现状 | 位置 |
|---|---|---|
| 问问题时 agent 怎么查 | 内存关键词打分 + alias 精确匹配，单一检索入口；问答 agent 由后端起一个受限的 claude CLI（空 MCP 配置、文件工具限在快照目录） | `src/content/wiki/retrieve.ts`（`buildIndex:99`、`retrieve:145`）、`server/chat.ts:131-133` |
| 查不到怎么办 | 回答里声明未收录 → 前端标「未收录」；缺口记进缺口档与覆盖任务 | `server/coverage.ts`、`wiki/_gaps.json`、`wiki/_jobs/coverage/` |
| 查不到后自动整合成草稿给人审 | **机制在，从未在生产跑过**。F004 的队列（`wiki:jobs` / `wiki:work`）、审阅面板（`/api/wiki/reviews`）、`origin: gap` 都有；`sync.config.json` 的 `maxTasks` 是 0。属付费机制 | `scripts/wiki/`、`server/review.ts` |
| 加入 wiki 时交叉审视 | `pnpm wiki:reconcile` 存在，`reconcileBatches: 0`，同上没开 | `sync.config.json` |
| 建链 | `relations` 有类型有方向，由作者写在依赖方一侧，`wiki:build` 派生反向边；lint 的 `relation-missing`、`relation-duplicate`、`broken-link`、`orphan` 守着 | `scripts/wiki/lint.ts:315,324,334,344,351` |
| 死链定期审查 | **站内站外都有了**（站外是 09-21 下午补的，`a64bce1`）。站内：`wiki:lint` 的 `broken-link` + 每晚 `wiki:sync` 里的巡检。站外：`pnpm wiki:urls` 带超时真发 HEAD / GET，404 / 410 才判死链，403 / 5xx / 超时只列「这次没验证到」（否则夜里断一次网就是几十条假警报）；共享配置 `checkUrls: true`，每晚巡检自动跑，死链以规则名 `dead-url` 写进 `wiki/warnings/patrol-<日期>.md`。第一次跑 95 条里 1 条死链（官方文档站把 `patch.html` 挪到 `Design_Documents/` 下），已修。不花模型钱 | `scripts/wiki/urls.ts`、`scripts/wiki-urls.ts`、`scripts/wiki/sync.ts:168-171` |
| 回答能不能体现页面之间的联系 | **机制在，没系统评过**。检索把命中页的邻域（含派生的反向边）一起交给问答 agent，阅读页的「接着看」也由它生成。09-20 做过一次真实问答测试（约 $0.45/问），但**没有成组评过「回答有没有把相关页串起来」**——`wiki:retest` / `wiki:eval` 有框架，没有这一类用例 | `src/content/wiki/relations.ts:11`（`buildAdjacency`）、`:93`（`neighborhood`）、`server/related-reading.ts` |
| 手动 drop 资料 | **有，只有命令行**：`pnpm wiki:drop`（F004，`origin: drop`），规则硬编码在脚本里。**阅读页面板上没有 drop 入口**——已核，`src/app/wiki/` 里只有问答 / 审阅 / 刷新 / 状态四个页签，全仓库对 `drop` 的引用只剩 schema 里的枚举值 | `scripts/wiki/drop.ts`、`src/content/wiki/schema.ts:28` |
| 图少 | 78 张，手写 spec → SVG（`pnpm wiki:diagrams`）。**上游文档自带的图不保留、不搬运**，只按源码重画 | `wiki/diagrams/` |
| 「layer share 这种问法查不查得到」 | 每页有 `aliases`（lint 查重），检索按 alias 命中，新页都按这个写了。**模糊问法的命中率没有成组评测过** | `retrieve.ts:102,109` |

## 5. 知识库做完以后，别的 agent 怎么调用（已做：①②③全做了）

问这话的时候（2026-09-21 上午）的回答是「基本没有」：对外只有站内问答自己用的 HTTP 接口，全在 `server/`、**只绑 127.0.0.1**（`server/index.ts:33`），没有 MCP、没有 skill、没有命令行；知识库本身是 git 里的 markdown，任何 agent 今天就能读，只是没人写过使用说明。

当天下午按「①一页说明 / ②只读命令 / ③只读 MCP」三档全做了，`wiki:find` 与 MCP 的 search 走同一份打分、不另起一套：

1. **使用说明**：[wiki/AGENTS-GUIDE.md](../../wiki/AGENTS-GUIDE.md)（不依赖任何工具，Codex 等也能读）+ `.claude/skills/llm-wiki/SKILL.md`（Claude Code 项目级 skill）。根 `CLAUDE.md` / `AGENTS.md` 各加一行指过去，两份仍逐字相同。
2. **命令行**（`d9f4fe5`、`bfacba1`）：`pnpm wiki:find <词> [--limit N] | --page <id> | --neighbors <id> [--json]`。
3. **只读 MCP server**（同上）：`pnpm wiki:mcp`，stdio 上手写的换行分隔 JSON-RPC（没加依赖），三个工具 `wiki_search` / `wiki_get_page` / `wiki_neighbors`；接法 `claude mcp add llm-wiki -- pnpm --dir <本仓库绝对路径> -s wiki:mcp`。

②③ 共用 `scripts/wiki/agent-access.ts`，检索只走 `src/content/wiki/retrieve.ts` 这一个入口，**命中规则与站内问答完全一致**。三个动作都只读：不写文件、不调模型、不联网。

## 6. 接手的人先做什么

1. 先读 [HANDOFF-LLM-WIKI.md](../../HANDOFF-LLM-WIKI.md) §4 的优先级清单，本页不重复排序。手上没活时按那个顺序往下走（参数骨架页正文 09-21 已做完 → 课程术语页等模型计算层的章节 → LMCache/UCM → main 重钉）。
2. 动笔之前先看 §3 的偏离说明：**现在的写页流程是「Opus 直接写 + 主会话对源码抽查」，不走待审**——这是用户同意的过渡办法，不是终态。手上有页要写就照它写，但别把它当成约定：恢复「agent 写、人只审」是一笔要还的欠账，怎么还看 §3。
3. 扩页之前先确认主线：知识库是主仓章节的底稿，不是独立产品。主仓 `PROJECT-MAP.md` 与 `PLAN.md` §1.3 已提交（`0aebe95`），接手时先去 `C:/Users/-/Desktop/infra-view-new` 读那两份。
4. 不写死数字。状态一律现查（HANDOFF §2 的命令表），别抄本页表格里的数。

**等用户拍板的事**（在他说话之前都不要开工）：

- **两个付费开关要不要开**（`wiki/sync.config.json`，现在全是 0）：
  - `reconcileBatches`：每晚交叉审视几批相关页，找互相矛盾的说法。
  - `driftSample`：每晚抽几页对照上游最新代码，看有没有过时。

  连同 `maxTasks`，三个里任一个大于 0 就必须同时写 `paid`（模型 + 预算上限），否则 `scripts/wiki/sync.ts:47` 直接报错——**这是防止夜里偷偷花钱的保险，不要绕过**。这两个当前建议：先不开，等页数再多一些。
- **F004 AC3 的独立评判**（不是配置项，要写代码）：缺口够不够现在靠回答模型自己在末尾报 `satisfied`（`server/coverage.ts`，同文件注释已写明这不是 AC3 要的东西）；验收条件要的是另起一个模型来评。
- 三项大批量导入（全量灌种 / 全量参数页 / GitHub 全库首拉）仍放在最后一步，必须用户点头后手动执行。

**已定、不必再问的**（09-21 当天结掉）：

- ~~站外死链检查要不要做~~ → **做了**（§4 那一行、`a64bce1`），已挂进夜间巡检。
- ~~agent 调用选哪一档~~ → **①②③全做了**（§5）。
- ~~`maxTasks` 什么时候开~~ → 用户 09-21 定：**等这个阶段做完、大规模导入之前再开**。它就是 §3 那笔欠账（恢复「agent 写、人只审」）的开关——开了它，新内容自然走「agent 写草稿 → 人在面板上审」，欠账也就一并还了。所以这不是「先不开就算了」，是有时点的。
- ~~同步用的 Python 要不要建 conda 3.12 环境~~ → **不用建**（用户 09-21 问「开源以后别人也要建吗」之后定的）。参数扫描脚本 `scripts/wiki/params/scan.py` 只 import `ast` / `json` / `re` / `sys`，全是标准库，任何 3.12+ 的解释器都能跑；开源用户 PATH 上有 Python 3.12+ 就行，不行再写一行 `wiki/sync.config.local.json`（`{"python": "<路径>"}`，gitignore）。这台机器现在借的是 Codex 私有缓存里的那份，哪天它没了，夜间任务会**当场报错**并在错误信息里写明解释器是哪个、可以用 `WIKI_PYTHON` 或同步配置的 `python` 改（`scripts/wiki/params/scan.ts:17`），不会悄悄坏掉。路径本身 09-21 已挪出共享配置（`7781837`）。
- ~~分支 `feat/llm-wiki` 要不要推远端~~ → 用户定 **worktree 先不推**。
