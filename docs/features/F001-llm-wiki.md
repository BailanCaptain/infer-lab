---
id: F001
title: LLM Wiki：课程知识库 + 右侧问答
status: in-progress
owner: BailanCaptain
created: 2026-09-07
---

# F001 — LLM Wiki：课程知识库 + 右侧问答

**Status**: in-progress（当前验收仅以下表为准；排除大规模导入，真实模型未通过项不以工程测试替代）
**Created**: 2026-09-07

## Why

学习者在章节页里遇到不懂的名词（KV Cache、GQA、chunked prefill……）时，现在只能离开页面去搜。课程已经有 30 个术语 id 挂在 `src/sim/model/forwardLayer.ts` 的 `Step.terms` 上，但没有任何一页解释它们；PLAN 的 10 到 21 章要讲的 vLLM-Ascend 特性也没有任何结构化知识沉淀。

用户原话（2026-09-07）：

> 我想要的是后续右侧有个聊天框，可以自己接入 agent 问答，相当于我们项目的知识库，但是背后连接的是 LLM wiki。比如我在学习过程中某个名词不懂，我就可以问。然后我也可以不断添加内容到我们项目，比如以后社区 PR 的合入，可以变成一个 wiki 加入。

> wiki 一上来就要有很多页，把 vLLM-Ascend 的特性和知识点批量扒进来。

> 按「好不好」而不是「能不能搬」逐项取舍。（指对 `C:\Users\-\Desktop\Multi-Agent` 已有实现的态度）

知识库按仓库根 `llm-wiki.md` 的哲学做：由 LLM agent 持续维护、互相链接、进 git 累积的 markdown wiki；人只审不写。

## What

用户能感知到的变化：

- 仓库里出现 `wiki/` 目录，第一批就有上百页 vLLM-Ascend 特性与课程术语页，每页带钉住 commit 的源码行号来源，页与页之间互相链接，`wiki/index.md` 能当目录读。
- 打开 `#/wiki` 能浏览这些页；课程正文里的术语悬停出一句话摘要。
- `#/wiki` 右侧有聊天抽屉，问「KV Cache 是什么」得到流式回答，回答里的术语能点过去。
- 聊天里点「存进 wiki」，回答变成一份草稿等人审；社区 PR 也能一条命令变成草稿。
- 全部知识生产由本机 agent CLI 完成，人只审草稿。

## Acceptance Criteria

### 验收状态（更新于 2026-09-21）

这张表是 F001 验收状态的唯一真相源。「现在在哪、接下来做什么」看 [HANDOFF-LLM-WIKI.md](../../HANDOFF-LLM-WIKI.md)；页数、预算、待审数这类会变的数字按它 §2 的命令现查，或看阅读页右侧「状态」页签。分级取 [2026-09-19 审视](../plans/wiki-audit-2026-09-19.md) §3 的口径：真实实现并测试 / 只用固定输出验证 / 部分实现 / 未执行 / 与 AC 文本不符。**固定模型输出的测试只证明机制能跑**，不证明内容质量。

| AC | 当前结论 | 证据与未满足条件 |
|---|---|---|
| AC1 | 与 AC 文本不符 | 六个 H2 切片确实能被程序切出（`scripts/wiki/handbook.ts:9-16` ↔ HANDBOOK 的六个 `##`）。AC 写的「HANDBOOK 是 schema 唯一真相源」仍不成立——HANDBOOK 是散文，机器读的定义在别处。但**审视 §2 P2 那条「各定义一遍」已不再成立**：页型与关系类型只定义在 `src/content/wiki/schema.ts:27,97`，lint 从那里 import（`scripts/wiki/lint.ts:8`）；证据标记的正则与编号规则 2026-09-20 统一到 `src/content/wiki/evidenceMarks.ts`（`b5d25cf`）；必需小节只在 `scripts/wiki/lint.ts:84` 一处。09-21 新加的 `verified` 字段同样只在 schema 里定义，lint 的 `unknown-verified-ref`（`scripts/wiki/lint.ts:292`）只查 ref 名字拼没拼对。AC 文本里的 `wiki/sources/` 至今是空目录（2026-09-21 `ls wiki/sources/` 只有 `.`、`..`）。`wiki:build` 的幂等本轮未重跑。 |
| AC2 | 真实实现并测试 | `pnpm wiki:lint` 2026-09-21 通过（输出 `ok wiki:lint 通过`）；每条规则的红绿用例在 `scripts/wiki/lint.test.ts`。本轮新增一条 `unknown-verified-ref`（`scripts/wiki/lint.ts:292`）。 |
| AC3 | 只用固定输出验证 | spawn stub 单测覆盖 argv、cwd、并发上限、越界写、失败记录、`--dry-run`。真实多 ref 提取未用真实模型复测。**09-20 / 09-21 新写的 25 页特性页与补完的 10 个参数页都没走这条链路**——是 Opus 子代理直接写进 `wiki/concepts/`、`wiki/params/`，主会话对着钉住的源码逐页抽查 2–4 条事实后提交（见表后「欠账」一段），所以 ingest 引擎本轮同样没有在生产跑过。 |
| AC4 | 部分实现（行号、逐句语义、跨版本都已人工核过；raw 摘录仍未核） | `pnpm wiki:audit` 2026-09-21：90 页 2200 条来源，行号有效 2120，无效 commit 0、文件不存在 0、越界 0、未知仓库 0；URL 80 条未联网验证（另由 `pnpm wiki:urls` 单独查，见表后增补一段）、raw 摘录 2050 条待核对。**原先「行号属实不等于整页结论正确、正文未逐句复核」这条已被两轮人工核对补上**：09-20 把 09-19 那 24 页逐句对照钉住的源码核完、改正约 80 处（`b5bd499`、`e00ae72`、`dd3cc6a`）；09-21 用 `pnpm wiki:versions` 把全库逐条对到 v0.26，81 页记上 `verified`，还没对过 6 页（5 页所引源码全部原样、`dyntra-lb` 有 1 条 `changed` 待人看）。仍未满足：raw 摘录内容与结论语义不在 `wiki:audit` 的通过范围内；`verified` 只在人看过之后手工记，脚本绝不自动标（HANDOFF §6）。 |
| AC5 | 未执行（用户暂缓） | 全量灌种未跑。`pnpm wiki:lint --terms` 2026-09-21 报 26 处 `missing-term`——30 个课程术语里已有 4 页（`kv-cache`、`rope`、`prefill`、`gqa`），写法用户已认可、其余挂起。09-21 把挂起理由写明了：术语要跟着章节走，模型计算层的章节在另一个会话重定，术语清单可能跟着变；三页试点已于 09-22 补图（HANDOFF §4.2）。页数现查。R2 的整合读取策略改动仍是开跑前置。 |
| AC6 | 真实实现并测试 | 阅读页目录固定四部分（`src/content/wiki/toc.ts:35-39`，提交 `06a6cb2`）；右侧面板把问答/审阅/状态合成一个侧栏（`b36d82c`、`c07da54`）。09-21 页头多了版本标记「已核对 v0.23.0 · v0.26.0rc · main」（`src/app/pages/WikiPage.tsx:250`，提交 `74b053a`）。Playwright：`tests/wiki.spec.ts`、`wiki-reader.spec.ts`、`wiki-review.spec.ts`、`evidence.spec.ts`；`pnpm exec playwright test tests/wiki --list` 2026-09-21 列出 30 条，**本轮只列未跑**，最近一次实跑结果记在 HANDOFF-LLM-WIKI §6。 |
| AC7 | 部分实现 + 与 AC 文本不符 | 2026-09-20 复查：引用检查的判定逻辑没错，未改——声明未收录判 `cited: true` 是复测验收（`scripts/wiki/retest.ts:244`）依赖的语义。缺的只是呈现，已补：`src/app/wiki/ChatDrawer.tsx:259-262` 的 `data-testid="chat-uncovered"`（提交 `7d145f2`）。文案与 AC 原文「（未收录，以下是模型自身知识）」不同，是中性的「未收录：……」。**未用真实模型复测**，本轮未改动、未复测。 |
| AC8 | 部分实现 | 聊天保存 → 草稿 → 审阅 → 批准链路可用，浏览器批准的 403 与 50 秒卡死已修（`4e55b71`）。真实 PR #11953：09-20 编译 60 秒超时；09-22 另一会话产出过草稿，但整合一步写死在本机未提交的脚本里，09-23 按用户决定驳回（详见 F003 AC6），真实草稿要等开 `maxTasks` 之后再生成。**09-20 起新页一律绕开草稿区直接提交**（用户同意的过渡办法，09-21 明确「只是暂时」），所以这条链路本轮也没有在生产用过——见表后「欠账」一段。 |
| AC9 | 真实实现并测试（静态部分） | seeds 现在登记三个长期并存的版本：main `baa023ad`（09-22 由 `b255ab59` 重钉）、`releases/v0.23.0`、`releases/v0.26.0rc` = `2ed6cbba`，并配套上游 `vllm releases/v0.26.0` = `568afb3a`（`wiki/seeds/vllm-ascend-code.yaml:18,25`，提交 `74b053a`）。`wiki/lineage/layer_sharding.json` 09-21 已用 `13a83ef` 的新逻辑重算，现在逐个发布分支列出 12 个 ref（v0.13 … v0.28 + main），搜索范围是 `paths: ["vllm_ascend/"]`、文件数 6/7/7/7/7/8/0/0/0/0/0/0，移除提交 `89601215` / PR #11953 保留。**AC 文本里的 8/9/14 是用 `--paths '*.py'`（全仓 py 文件）量的，与现在存盘的 `vllm_ascend/` 口径不是同一个分母，本轮未用 `--paths '*.py'` 重算。** 真实多 ref agent 提取未跑。 |
| AC10 | 真实实现并测试，但实现与 AC 文本不同 | 单一入口 `src/content/wiki/retrieve.ts:145`，聊天层不自己 grep。实现是内存关键词打分，不是 AC 写的 `index.md` + Grep（审视 §3 备注）；接口可替换这一点成立。09-21 新增的站外 agent 入口（`pnpm wiki:find`、只读 MCP）走的也是这一个入口（`scripts/wiki/agent-access.ts`），没有第二套打分——「只有一个检索入口」因此又被复用了一次。 |
| AC11 | AC 文本已于 2026-09-20 修订；修订后部分达成 | 载体已全部换成 `wiki-diagram`：全库 markdown 无 ```mermaid 围栏，阅读页的 mermaid 渲染器与 npm 依赖已删（提交 `b222c58`，见 `src/app/pages/WikiPage.tsx:260` 的注释）。`pnpm wiki:diagrams --check` 2026-09-21 通过（`ok wiki:diagrams 78 张图与 spec 一致`），`diagram-symbol` 拿 spec 的 `pins` 对钉住的 commit 逐个查。含图比例（2026-09-21 按 `registry.json` 现数）：概念/特性页 68/71 = 95.8%，过了八成线；参数页 8/19 未达——夜间生成的骨架页按设计不配图，09-21 补完正文的那 10 页也没补图。09-22 另补 kv-cache / rope / prefill 的图及 LMCache / UCM 新页图，未因此声称参数页缺图已经全部解决。修订内容与原因见下方 AC11 条目。 |
| AC12 | 部分实现 | `relations` 的图扩展在 `retrieve.ts`，反向边由 `wiki:build` 派生成 `backlinks`。`related` 只剩 `schema.ts:156` 的兼容字段，`wiki/concepts/`、`wiki/params/` 现有页 0 处使用（`grep -ln '^related:'` 为 0）。09-21 起同一份邻域也给了站外 agent：`pnpm wiki:find --neighbors block-table` 2026-09-21 实跑返回 4 条声明的 `builds-on` + 5 条派生的 `enables`，每条带 `note`。回答质量仍未用真实模型成组评测过（审视状态 §4 那一行「机制在，没系统评过」）。 |

**AC 之外的增补（2026-09-21）：知识库做完以后，别的 agent 怎么用。** 上面 12 条 AC 只管「站内怎么生产、站内怎么读」，没有一条覆盖「别的 agent 怎么调用这个库」——这不是漏做的 AC，是用户 09-21 上午新提的问题，**这里记一笔，不新编 AC 号**。当天下午按三档补齐：① 一页使用说明 [wiki/AGENTS-GUIDE.md](../../wiki/AGENTS-GUIDE.md)（不依赖任何工具）+ `.claude/skills/llm-wiki/SKILL.md`；② 只读命令 `pnpm wiki:find <词> [--limit N] | --page <id> | --neighbors <id> [--json]`；③ 只读 MCP server `pnpm wiki:mcp`（stdio 上的换行分隔 JSON-RPC，没加依赖，三个工具 `wiki_search` / `wiki_get_page` / `wiki_neighbors`）。②③ 共用 `scripts/wiki/agent-access.ts`，检索只走 `src/content/wiki/retrieve.ts` 这一个入口，命中规则与站内问答完全一致；三个动作都只读——不写文件、不调模型、不联网（提交 `d9f4fe5`、`bfacba1`、`e2dc5f8`）。2026-09-21 实跑 `pnpm wiki:find "layer_sharding"`，首条是 `[exact]` 命中 `wiki/params/layer-sharding.md` 并带出该页的「已核对」版本列表。明细见 [wiki-audit-status-2026-09-21](../plans/wiki-audit-status-2026-09-21.md) §5。

**另一条 AC 之外的增补（2026-09-21）：站外死链。** AC 文本只管站内 `broken-link`。`pnpm wiki:urls` 真发 HTTP，404 / 410 才判死链，403 / 5xx / 超时只列「这次没验证到」；已挂进每晚巡检（`wiki/sync.config.json` 的 `checkUrls: true`，规则名 `dead-url`，`scripts/wiki/urls.ts:105`）。首跑 95 条里 1 条死链已修（`a64bce1`）。2026-09-21 本轮实跑：站外链接 96 条，可达 90，**死链 0**，这次没验证到 6 条（全是 huggingface.co，客户端 `TypeError`，不判死链）。

**一笔欠账：「agent 写、人只审」目前是绕开的。** F001 的设计决策写的是「agent 写，人只审」，页面应走 `wiki:ingest` → `_drafts/` → `wiki:review`。09-20 到 09-21 新写与重写的页**全部**是 Opus 子代理直接写进正式区、主会话对着钉住的源码抽查后提交——不走待审、没有 `raw/` 摘录、`wiki/log.md` 里没有对应的 ingest 记录，`origin` 仍标 `seed`。用户 09-20 同意了这个做法，09-21 又明确「**只是暂时这样，要做**」。所以这是明确欠账不是终态，还账时点用户已定：**这个阶段做完、大规模导入之前打开 `maxTasks`**。要还的两笔与操作办法写在 [wiki-audit-status-2026-09-21](../plans/wiki-audit-status-2026-09-21.md) §3。

- **AC1 · 骨架与派生**：`wiki/HANDBOOK.md` 是 schema 唯一真相源，六个 H2 切片（页面格式 / 提取 / 整合 / 查询 / Lint / 人类须知）可被程序按 H2 切出；`pnpm wiki:build` 从 `concepts/`、`sources/` 的 frontmatter 派生 `wiki/index.md` 与 `src/content/wiki/registry.json`，重复运行结果一致。验收：`pnpm wiki:build` 两次，`git diff` 为空。
- **AC2 · Lint 把关**：`pnpm wiki:lint` 拒收空 `sources`、非法 frontmatter、重复 id 或 alias、断链、孤页，非零退出并指名文件与规则；纳入 `pnpm check`。验收：故意造一页空 sources 与一条断链，lint 非零退出且输出含两个文件名；修复后 `pnpm check` 全绿。
- **AC3 · ingest 引擎**：`pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml` 按种子清单扇出提取（每个 feature 一次 `claude -p`，默认并发 3，每个 agent 只能写 `_drafts/<id>.md` 与 `raw/<id>.md`），再串行整合进 `concepts/`；单个失败不阻塞其余，记入 `_drafts/_failures.json`；支持 `--only`、`--skip-existing`、`--retry-failed`、`--dry-run`。验收：单元测试用 spawn stub 验 argv、cwd、stdin、并发上限、越界写判失败、失败记录；`--dry-run` 打印每个 feature 的完整命令而不 spawn。
- **AC4 · 试点批 10 页合格**：11 章 KV Cache 那组约 10 个 feature 跑通，每页 `sources` 指向 `vllm-ascend@28bf3a2e` 的真实文件与行号，随机抽 3 页人工核对源码确实如此；`git status` 证明 agent 未越界写文件。人审通过才进 AC5。
- **AC5 · 批量灌种**：种子补全 10 到 21 章全部特性与 `forwardLayer.ts` 的 30 个术语，分章跑，预计 120 到 160 页；`wiki:lint --terms` 确认 30 个 `Step.terms` id 全部有页；`pnpm check` 全绿。**开跑前必须先改整合的读取策略（见风险 R2），否则会在放量中途撞上下文上限。**
- **AC6 · 站内消费**：`#/wiki` 阅读页（左目录、中页面、relations / 派生 backlinks、来源角标）；`<Term id>` 悬停卡显示 `summary`。验收：浏览器打开 `#/wiki`，悬停出摘要，页面间链接跳转正确（Playwright）。
- **AC7 · 聊天问答**：`server/` 薄运行器 spawn `claude -p`（cwd=`wiki/`，只读工具白名单）；`#/wiki` 右侧抽屉流式回答；多轮用 `--resume`。**必须与 AC10 同批落地**（见风险 R1）。**回答里的事实性论断必须带页面引用**：借 Multi-Agent 的 `adaptive-recall/judge-block.ts` 思路，回答若出现断言式表述却没有指向任何 wiki 页的链接，就不作为「知识库答案」呈现，改标「（未收录，以下是模型自身知识）」。验收：问「KV Cache 是什么」，流式回答含 kv-cache 链接并可跳转；问一个知识库没有的词，回答被标为未收录而不是伪装成知识库结论。
- **AC8 · 存进 wiki 与 PR ingest**：抽屉「存进 wiki」把回答写成 `_drafts/` 草稿；`pnpm wiki:ingest --pr <n>` 把一个真实 PR 变成草稿，社区不可信文本经 sanitize；草稿批准 / 驳回面板。验收：草稿文件出现且 diff 可读，`raw/` 已有快照未被覆盖（允许追加不可变证据快照），`tools/repos/` 未被修改。
- **AC9 · 多 ref 钉定与完整克隆**：`seeds` 的 repo 不再只钉一个 commit，而是钉一组 ref（`main` + 各 `releases/*` 分支 + 指定 tag）；单个 feature 可声明自己适用的 ref，提取时 `--add-dir` 指向该 ref 的工作树。克隆改为完整克隆（含全部分支与 tag），不再用 `--filter=blob:none`。验收：对 `layer_sharding` 在 `releases/v0.23.0` 上跑 `wiki:ingest`，产出页面的 `sources` 指向该分支的真实行号；`git grep -l layer_sharding origin/releases/v0.23.0 -- '*.py'` 数出 **14** 个文件（部分克隆下是 11 或 13，见 Design Decisions）。
- **AC10 · 检索接口可替换**：AC7 的聊天层不直接内联 grep，检索抽成 `retrieve(query) → 候选页[]` 单一入口，第一版实现是 `index.md` + Grep；换实现不动聊天层。验收：单元测试用 stub 替换 `retrieve` 即可驱动聊天层，聊天层代码里不出现 grep 调用。

- **AC11 · 页面要有图与逐条证据标记**：正文每条结论带内联标记 `[S]` / `[C]` / `[D]` 等（PLAN §1.4 的原设计，页级单值表达不了混合来源——实测 7 页引了官方文档却全是源码主导，标 `S` 或标 `C` 都不准确）；HANDBOOK「页面格式」增加图的规则——讲结构关系（数据流、映射、切分、状态机）时必须给图，图里出现的标识符必须是源码里真实存在的；渲染层支持这种图；`wiki:lint` 检查图中标注的文件与符号能在 `sources` 覆盖的范围里找到。验收：重跑一批页后至少八成含图；故意在图里写一个不存在的类名，lint 报红。

  **2026-09-20 对本条 AC 文本的修订**：原文写的是「优先画 mermaid / 渲染层支持 mermaid / 新增 `diagram-identifier` 规则」，与 HANDBOOK 已经直接矛盾，现按现状改写。载体改为 `wiki-diagram`——手写 `wiki/diagrams/<id>.yaml` 的 spec，由 `pnpm wiki:diagrams` 渲成 SVG，spec 的 `pins` 写明 `source` 与 `symbols`；检查规则由一条扩成 `diagram-missing` / `diagram-identifier` / `diagram-symbol` 三条。原因见 HANDBOOK「页面格式 › 图」：mermaid 的版面由它自己排、调不动，手画的裸 SVG 又让问答 agent 读不出图在讲什么，spec 里的图元是显式的。**AC 的意图不变**（讲结构关系必须有图、图上标识符必须在钉住的源码里真实存在、编造标识符 lint 要报红），只换载体与规则名。

  **2026-09-14 历史实施记录（完整 AC 尚未达成）**：11 页全部含图（11/11，验收线八成），当时共 18 张 mermaid——这批图已于 2026-09-20 全部迁成 `wiki-diagram`，渲染器随之删除；内联标记 201 处且**带来源编号**（`[C6]` 指向 `sources` 第 6 条，点开跳 GitHub 钉住的行号——恢复 PLAN §1.4 的原设计，此前落地成光秃秃的字母，用户反馈「又不能点」）；`diagram-identifier`、`mark-index`、`mark-unnumbered`、`mark-flood` 四条规则各有一红一绿测试。密度也被治住：初版 400 处标记里 66% 是 `[C]`，现在每页 ≤20 处，由引擎在整合任务里直接算出每页超了多少，定性规则「只留三类」实测不落地。
- **AC12 · 回答要体现页与页的关系**：`retrieve()` 做一层图扩展——命中 A 后把 A 的 `relations`（2026-09-11 前叫 `related`，现只作兼容字段）作为二级候选返回，标明「因为与 A 相关」；chat 把这层关系写进 stdin 而不只给扁平清单；回答末尾自动附「接着可以看」。验收：问「Block Table 是什么」，返回的候选含由 relations 扩展来的页并标出来源，抽屉里出现相关页入口。**2026-09-12 历史实施记录，有前后实测对比（完整 AC 尚未达成）**：改前 agent 只 `Read` 了 `block-table.md` 一个文件，把一页压缩成答案，回答里的 PagedAttention / Prefix Caching 链接抄自该页正文里已有的话，那两页根本没打开；改后读了 block-table / paged-attention / kv-cache-spec / prefix-caching **四个文件**，按「它依赖什么 → 它是什么 → 谁用到它 → 边界」组织，依赖处给出列数公式 `cdiv(max_model_len, block_size × dcp_world_size)`。

  根因不在检索而在页面格式：原先每页都要写「为什么需要它」，于是每页都用散文重讲一遍邻居——`block-table.md` 里有整段 PagedAttention、整段 prefix caching。一页本身**已经是**稀释版的「串起来」，图上的边没东西可加，agent 读一页就停是理性的。把页面做成自给自足的，等于把图做成了装饰。三处改动：
  1. `related: [id]` 换成有类型有方向的 `relations: [{to, kind, note}]`，kind 取 `builds-on` / `variant-of` / `conflicts-with` / `alternative-to`；一条边只写在依赖方那一侧，反向边由 `wiki:build` 派生成 `backlinks`（`related-asymmetric` 规则随之删除）。
  2. HANDBOOK 明写「邻居一句话带过加链接」，判断标准是**这段在对方那页写得更好，就不该出现在这页**。
  3. server 把命中页的地基 / 下游 / 同层连同每条边的 `note` 一起注入 stdin，「查询」切片要求按四步组织回答。

  横向边只有整合 agent 能补——提取 agent 并行跑、彼此只知道对方 id，实测第一轮 15 条边里 14 条是 `builds-on`，一条 `variant-of` / `conflicts-with` 都没有；把「逐对过一遍，找变体与互斥」写进整合切片后，31 条边里出现了 6 条 `alternative-to`、2 条 `conflicts-with`。

**Out of scope**（写明触发条件）：向量检索（2026-09-10 用户拍板先不加；触发条件改为「AC10 的 grep 实现在一组真实问题上命中率不足」，且只用于 F003 的 issue 语料，不用于 wiki 页——参数类问题按名字精确查表，语义检索反而更差）；codex 作为 ingest agent（claude 试点合格后再接，runner 接口已留 `agent` 字段）；多 agent 并发写同一页所需的租约 / 围栏令牌 / CAS（本设计下并行 agent 不写同一文件，不需要）；cron 巡检与写入账本；章节页右栏（章节页尚不存在，抽屉先落在 `#/wiki`）。

## Dependencies

- 本机 `claude` CLI 2.1.263（`~/.local/bin/claude`），支持 `-p --output-format stream-json --allowedTools --disallowedTools --append-system-prompt --add-dir --resume`。
- `git` 2.53，GitHub 可达（浅克隆 vllm-ascend 到 `tools/repos/`，钉 PLAN 的 `28bf3a2e`）。
- `gh` 未安装：AC8 的 PR ingest 用 `git fetch origin refs/pull/<n>/head`，不依赖 gh。
- 新增 devDependency：`gray-matter`、`yaml`。
- 无对 Multi-Agent 仓库的运行时依赖，只复制纯函数与思路。

## Design Decisions

| 决策 | 选项 | 结论 | 原因 |
|------|------|------|------|
| agent 调用方式 | Agent SDK / 本机 CLI spawn | **CLI spawn，claude 先做，codex 后接** | 用户已有订阅额度；不引入 API key；Multi-Agent 已验证 Windows 下 spawn 可行 |
| 并发写保护 | 搬 Multi-Agent 的租约 / 围栏令牌 / CAS | **砍掉，改「扇出提取 + 串行整合」** | 扇出阶段每个 agent 只写自己的两个文件，整合阶段一次一个跨页写；无共享写就无需锁 |
| 检索 | SQLite FTS5 + embedding / index.md + Grep | **index.md + Grep** | llm-wiki.md 原文：index 到约 100 个来源都够用；不到 300 页不上向量 |
| 知识生产 | 人写 / agent 写人审 | **agent 写，人只审** | 用户明确要求批量灌种，上百页人写不现实 |
| 学习者聊天 | 可写 wiki / 只读 | **只读；「存进 wiki」只产草稿** | 未审内容不能进正式区 |
| 页面链接 | `[[wikilink]]` / 相对 markdown 链接 | **相对 markdown 链接** | remark 与 GitHub 直接渲染，lint 好查 |
| 证据等级 | 自定义 / 沿用 PLAN §1.4 | **沿用 PLAN 七档 S C D A I M !** | 单一真相源 |
| 页面语言 | 全英文 / 中文正文英文术语 | **中文正文，`title` 英文原名，`aliases` 放中文** | 与课程一致（用户 2026-09-07 拍板） |
| ingest 模型 | 默认 / sonnet | **默认模型，不传 `--model`** | 试点看质量后再决定第二步是否降级（用户 2026-09-07 拍板） |
| 工具限制 | `bypassPermissions` 全放开 / 白名单 | **`--allowedTools` 白名单 + `--disallowedTools`，不用 bypassPermissions** | Multi-Agent 全靠 bypass；本项目 agent 面对的是不可信来源，必须收紧 |
| 推广结论降级 | 不管 / 强制降到 D | **强制降到 D 并写明限制与推广依据** | 试点发现一页把只在 MLA 成立的公式（紧邻 `assert kv_head_num == 1`）推广到 GQA 却仍标 C；结论对但标签失真，上百页后 C 将不再携带信息，而 PLAN §1.4 的约束挂在等级上（2026-09-07 用户拍板） |
| 按路径限制写入 | `Write(路径)` / `Edit(路径)` / 只靠事后快照 | **`Edit(路径)` 规则**（同时管 Write）+ 批级快照差集兜底 | Spike W1（2026-09-07，4 次真实调用）：`Write(路径)` 不被识别；`Edit(_drafts/x.md)` 允许写该文件、拒绝写 `concepts/x.md`；黑名单里放 `Edit` 会连 Write 一起禁掉 |
| 越界写检查 | 每 agent 单独 git status / 批级 | **批级**：批前批后比对 `wiki/` 改动集，超出本批允许路径即判失败 | 并发运行时 per-agent 的 git status 会看到别人的文件 |
| 整合阶段删草稿 | agent 用 Bash 删 / 引擎删 | **agent 只写决策文件 `_drafts/_integration.json`，引擎按决策删** | agent 不给 Bash |
| index.md / log.md | agent 维护 / 程序派生 | **程序派生，agent 禁写** | 借 Multi-Agent 经验：派生物不让 LLM 手改，避免漂移 |
| 入口 | 直接做章节页右栏 / 先独立页 | **先 `#/wiki`，章节页出现后抽屉复用** | 章节页不存在 |
| 第一步克隆范围 | vllm + vllm-ascend / 只 vllm-ascend | **只 vllm-ascend** | 试点批只需要它（用户 2026-09-07 拍板） |
| 仓库钉定粒度 | 一个 repo 钉一个 commit / 钉一组 ref | **钉一组 ref**（`main` + 各 `releases/*` + 指定 tag），feature 可声明适用 ref | `layer_sharding` 在各分支的分布是非单调的：v0.13 有 5 个文件、v0.18 有 1 个、v0.23 有 13 个、v0.24 起主线为 0、v0.26.0rc 又有 1 个。「哪个版本移除的」只能按分支答，单 commit 模型结构上答不了（2026-09-10 用户指出，实测见 F002）|
| 克隆方式 | `--filter=blob:none` 部分克隆 / 完整克隆 | **完整克隆**（含全部分支与 tag） | 部分克隆跨分支 `git grep` 会静默漏文件，且**同一条命令在不同时刻给出不同的错误答案**（取决于已按需拉了多少）。`layer_sharding` 实测：v0.18.0 部分克隆数出 1、完整克隆是 **9**；v0.23.0 部分克隆先后给出 11 与 13、完整克隆是 **14**（漏掉的 `vllm_ascend/utils.py` 那处来自 2026-01-08 的提交，一直都在）。另外每次按需拉取要数分钟、断网即失败（2026-09-11 实测）|
| 检索实现位置 | 聊天层内联 grep / 抽成 `retrieve()` 接口 | **抽成单一入口**，第一版仍是 index + grep | 向量检索先不加（用户拍板），但留缝的成本近乎为零，换实现时不必重写聊天层 |
| 向量检索时机 | 页数超 300 就上 / 按实测命中率决定 | **按命中率决定，且只考虑 issue 语料** | 参数问题是按名字精确查表，语义相似反而会把无关项捞进来；概念页几百页规模 agent 读 index 再 grep 够用 |
| 工作流 | 直接在 main 改 / worktree | **worktree `../infra-view-new-llm-wiki`，分支 `feat/llm-wiki`** | 参照 Multi-Agent `worktree` skill（用户 2026-09-07 要求） |

**Design Gate**：架构级（新目录 `wiki/`、新 `server/`、新脚本组）。方案由用户在两轮规划对话中逐项拍板（见上表），2026-09-07 批准实施计划。

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-09-07 | Kickoff。两轮规划对话拍板全部设计决策；核验事实基线；建 worktree `feat/llm-wiki` |
| 2026-09-07 | 试点批：11 个 11 章 KV Cache 特性，8 成 3 败（额度到顶），补跑后 11 页全成；整合晋升 11 页，0 合并 0 拒收 0 矛盾。174 条来源行号全部核对属实，三页深度抽检 9 条论断全对，数值与 `analyze.ts` 独立计算一致。实际花费以预算账本为准（`pnpm wiki:budget status`） |
| 2026-09-07 | 试点期修掉三个缺陷：`updated` 用 UTC 差一天；`related` 单向（补 `related-asymmetric` lint 规则后抓出并修）；生成物被 biome 反复重排。新增 `pnpm wiki:audit` 核对来源行号 |
| 2026-09-07 | 用户拍板加入「推广结论降级到 D」规则，已写进 HANDBOOK 的提取与整合两片，并回改既有页面 |
| 2026-09-11 | AC9 多 ref 钉定与完整克隆；AC6 阅读页；AC7+AC10 问答与检索接口同批落地（风险 R1 消除）。实测一次真实问答：预检索命中→agent 读两页→流式回答带页面引用与 [C] 等级 |
| 2026-09-10 | 用户提出参数类问题（`layer_sharding` 干嘛的 / 哪个版本移除 / 哪些分支还有）与报错溯源两类需求。实测确认单 commit 钉定与部分克隆都答不了，追加 AC9、AC10；参数清单与谱系拆为 F002，GitHub 语料拆为 F003 |
| 2026-09-07 | Task 1–8、10 完成（schema / HANDBOOK / 读取器 / build / lint / ingest 引擎 / CLI runner / clone），27 个单测；Spike W1 定下 `Edit(路径)` 规则；vllm-ascend 钉在 28bf3a2e |

## 风险登记

| # | 风险 | 触发时机 | 后果 | 应对 |
|---|---|---|---|---|
| ~~R1~~（已消除，2026-09-11）| AC7 图快把 grep 内联进聊天层，跳过 AC10 的 `retrieve()` 接口 | ~~做 AC7 时~~ AC7 与 AC10 已同批落地，检索唯一入口是 `src/content/wiki/retrieve.ts`，server 与前端都不自己 grep | [F004](F004-knowledge-loop.md) AC3「查不到自动补写」的钩子挂在检索这一步，没有接口就要**重写聊天层**；F003 AC4 接语料检索同样受阻 | AC7 与 AC10 同批落地，不拆。聊天层代码里不得出现 grep 调用，由 AC10 的单测把关（stub 替换 `retrieve` 即可驱动聊天层） |
| **R2** | 整合 agent 读「`concepts/` 里全部现有页」，放量后撞上下文上限 | 做 AC5 时 | 实测 11 页 = 96 KB / 994 行，每页约 8.8 KB；120–160 页约 1.4 MB，粗估 40 万 token 量级。整合会失败，且每批重读一遍成本失控 | **AC5 开跑前**改 HANDBOOK「整合」切片与 `integrateRequest`：只读 `index.md` 摘要 + 按 chapter 与 relations 拉相关页，不读全量正文。[F004](F004-knowledge-loop.md) AC6 已按新策略设计，两处保持一致 |
| R5 | 知识表达单薄 | 已存在 | 实测 11 页**零张图**，HANDBOOK 关于图的规则**零条**；`related` 有 70 条边、密度 64%，但只用于渲染右栏列表，问答链路完全没用上（`retrieve()` 返回扁平列表，chat 的 stdin 只给候选清单）| AC11 补图、AC12 补关系。AC11 的 agent 侧要重跑页面才生效，与 AC5 同批做 |
| R3 | 放量成本 | 做 AC5 时 | 2026-09-07 试点的每页单价是「先铺骨架再选择性补正文」（AC4→AC5 顺序）这个决策的依据，据此估 120–160 页要跨多个额度窗口；**这只是当时的估价，不是现在的花费**，实际花费一律以 `pnpm wiki:budget status` 为准 | 分章跑、每章人抽查；或第二步改用更便宜的模型（用户 2026-09-07 表示试点先不换） |
| R4 | 阅读页目录全量渲染 | F001 AC5 与 F002 AC4 都落地后 | AC6 的 `WikiPage` 目录一次渲染全部页（`listPages()` 无分页）。F001 AC5 的 120–160 页 + F002 AC4 的 100+ 参数页 ≈ 250–300 页，左栏会变成一条极长列表，参数页尤其会淹没教学页 | 页数超过约 80 页时给目录加按 type 折叠与搜索框；参数页在目录里默认折叠，主要靠搜索与页内链接抵达。不需要虚拟滚动。**2026-09-21 现状**：触发条件已到（90 页，`registry.json`）；折叠这半边已做——目录固定四部分、每部分是一个 `<details>`，只在当前页落在其中时展开（`src/content/wiki/toc.ts:35-39`、`src/app/pages/WikiPage.tsx:137-141`），参数独立成一部分因此默认收起。**搜索框仍没有**（`WikiPage.tsx` 里没有任何 input），站外 agent 那条路已有 `pnpm wiki:find` |

## Links

- Plan: [llm-wiki-plan.md](../plans/llm-wiki-plan.md)
- 哲学来源: 仓库根 `llm-wiki.md`（用户放入，只读）
- 参照实现: `C:\Users\-\Desktop\Multi-Agent\packages\api\src\wiki\`、`runtime\`（只借纯函数与思路）
- 总体大纲: `PLAN.md` 七「知识库与问答」

## Evolution

- **Evolved from**: 无
- **Blocks**: PLAN M1 任务 10（内容管线的 Term 注册表由本 feature 的 registry 提供）；[F002](F002-param-lineage.md)（参数扫描依赖 AC9 的多 ref 克隆）；[F003](F003-github-corpus.md)（报错检索依赖 AC10 的检索接口）；[F004](F004-knowledge-loop.md)（闭环依赖 AC8 的 sanitize 与 AC10 的检索接口）
- **Related**: PLAN 第 21 章「PR 影响分析」（AC8 的 PR ingest 是它的素材来源）
