---
id: F001
title: LLM Wiki：课程知识库 + 右侧问答
status: in-progress
owner: BailanCaptain
created: 2026-09-07
---

# F001 — LLM Wiki：课程知识库 + 右侧问答

**Status**: in-progress（Phase 1 完成，AC1–AC4 达成）
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

- [x] **AC1 · 骨架与派生**：`wiki/HANDBOOK.md` 是 schema 唯一真相源，六个 H2 切片（页面格式 / 提取 / 整合 / 查询 / Lint / 人类须知）可被程序按 H2 切出；`pnpm wiki:build` 从 `concepts/`、`sources/` 的 frontmatter 派生 `wiki/index.md` 与 `src/content/wiki/registry.json`，重复运行结果一致。验收：`pnpm wiki:build` 两次，`git diff` 为空。
- [x] **AC2 · Lint 把关**：`pnpm wiki:lint` 拒收空 `sources`、非法 frontmatter、重复 id 或 alias、断链、孤页，非零退出并指名文件与规则；纳入 `pnpm check`。验收：故意造一页空 sources 与一条断链，lint 非零退出且输出含两个文件名；修复后 `pnpm check` 全绿。
- [x] **AC3 · ingest 引擎**：`pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml` 按种子清单扇出提取（每个 feature 一次 `claude -p`，默认并发 3，每个 agent 只能写 `_drafts/<id>.md` 与 `raw/<id>.md`），再串行整合进 `concepts/`；单个失败不阻塞其余，记入 `_drafts/_failures.json`；支持 `--only`、`--skip-existing`、`--retry-failed`、`--dry-run`。验收：单元测试用 spawn stub 验 argv、cwd、stdin、并发上限、越界写判失败、失败记录；`--dry-run` 打印每个 feature 的完整命令而不 spawn。
- [x] **AC4 · 试点批 10 页合格**：11 章 KV Cache 那组约 10 个 feature 跑通，每页 `sources` 指向 `vllm-ascend@28bf3a2e` 的真实文件与行号，随机抽 3 页人工核对源码确实如此；`git status` 证明 agent 未越界写文件。人审通过才进 AC5。
- [ ] **AC5 · 批量灌种**：种子补全 10 到 21 章全部特性与 `forwardLayer.ts` 的 30 个术语，分章跑，预计 120 到 160 页；`wiki:lint --terms` 确认 30 个 `Step.terms` id 全部有页；`pnpm check` 全绿。
- [ ] **AC6 · 站内消费**：`#/wiki` 阅读页（左目录、中页面、related、来源角标）；`<Term id>` 悬停卡显示 `summary`。验收：浏览器打开 `#/wiki`，悬停出摘要，页面间链接跳转正确（Playwright）。
- [ ] **AC7 · 聊天问答**：`server/` 薄运行器 spawn `claude -p`（cwd=`wiki/`，只读工具白名单）；`#/wiki` 右侧抽屉流式回答；多轮用 `--resume`。验收：问「KV Cache 是什么」，流式回答含 kv-cache 链接并可跳转。
- [ ] **AC8 · 存进 wiki 与 PR ingest**：抽屉「存进 wiki」把回答写成 `_drafts/` 草稿；`pnpm wiki:ingest --pr <n>` 把一个真实 PR 变成草稿，社区不可信文本经 sanitize；草稿批准 / 驳回面板。验收：草稿文件出现且 diff 可读，`raw/` 与 `tools/repos/` 未被修改。
- [ ] **AC9 · 多 ref 钉定与完整克隆**：`seeds` 的 repo 不再只钉一个 commit，而是钉一组 ref（`main` + 各 `releases/*` 分支 + 指定 tag）；单个 feature 可声明自己适用的 ref，提取时 `--add-dir` 指向该 ref 的工作树。克隆改为完整克隆（含全部分支与 tag），不再用 `--filter=blob:none`。验收：对 `layer_sharding` 在 `releases/v0.23.0` 上跑 `wiki:ingest`，产出页面的 `sources` 指向该分支的真实行号；`git grep -l layer_sharding origin/releases/v0.23.0 -- '*.py'` 数出 13 个文件（部分克隆下只有 11，见 Design Decisions）。
- [ ] **AC10 · 检索接口可替换**：AC7 的聊天层不直接内联 grep，检索抽成 `retrieve(query) → 候选页[]` 单一入口，第一版实现是 `index.md` + Grep；换实现不动聊天层。验收：单元测试用 stub 替换 `retrieve` 即可驱动聊天层，聊天层代码里不出现 grep 调用。

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
| 克隆方式 | `--filter=blob:none` 部分克隆 / 完整克隆 | **完整克隆**（含全部分支与 tag） | 部分克隆跨分支 `git grep` 会静默漏文件：v0.23.0 上部分克隆数出 11 个文件，完整拉取后是 13 个，且每次按需拉取要数分钟、断网即失败（2026-09-10 实测）|
| 检索实现位置 | 聊天层内联 grep / 抽成 `retrieve()` 接口 | **抽成单一入口**，第一版仍是 index + grep | 向量检索先不加（用户拍板），但留缝的成本近乎为零，换实现时不必重写聊天层 |
| 向量检索时机 | 页数超 300 就上 / 按实测命中率决定 | **按命中率决定，且只考虑 issue 语料** | 参数问题是按名字精确查表，语义相似反而会把无关项捞进来；概念页几百页规模 agent 读 index 再 grep 够用 |
| 工作流 | 直接在 main 改 / worktree | **worktree `../infra-view-new-llm-wiki`，分支 `feat/llm-wiki`** | 参照 Multi-Agent `worktree` skill（用户 2026-09-07 要求） |

**Design Gate**：架构级（新目录 `wiki/`、新 `server/`、新脚本组）。方案由用户在两轮规划对话中逐项拍板（见上表），2026-09-07 批准实施计划。

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-09-07 | Kickoff。两轮规划对话拍板全部设计决策；核验事实基线；建 worktree `feat/llm-wiki` |
| 2026-09-07 | 试点批：11 个 11 章 KV Cache 特性，8 成 3 败（额度到顶），补跑后 11 页全成；整合晋升 11 页，0 合并 0 拒收 0 矛盾。174 条来源行号全部核对属实，三页深度抽检 9 条论断全对，数值与 `analyze.ts` 独立计算一致。花费 28 美元等值 |
| 2026-09-07 | 试点期修掉三个缺陷：`updated` 用 UTC 差一天；`related` 单向（补 `related-asymmetric` lint 规则后抓出并修）；生成物被 biome 反复重排。新增 `pnpm wiki:audit` 核对来源行号 |
| 2026-09-07 | 用户拍板加入「推广结论降级到 D」规则，已写进 HANDBOOK 的提取与整合两片，并回改既有页面 |
| 2026-09-10 | 用户提出参数类问题（`layer_sharding` 干嘛的 / 哪个版本移除 / 哪些分支还有）与报错溯源两类需求。实测确认单 commit 钉定与部分克隆都答不了，追加 AC9、AC10；参数清单与谱系拆为 F002，GitHub 语料拆为 F003 |
| 2026-09-07 | Task 1–8、10 完成（schema / HANDBOOK / 读取器 / build / lint / ingest 引擎 / CLI runner / clone），27 个单测；Spike W1 定下 `Edit(路径)` 规则；vllm-ascend 钉在 28bf3a2e |

## Links

- Plan: [llm-wiki-plan.md](../plans/llm-wiki-plan.md)
- 哲学来源: 仓库根 `llm-wiki.md`（用户放入，只读）
- 参照实现: `C:\Users\-\Desktop\Multi-Agent\packages\api\src\wiki\`、`runtime\`（只借纯函数与思路）
- 总体大纲: `PLAN.md` 七「知识库与问答」

## Evolution

- **Evolved from**: 无
- **Blocks**: PLAN M1 任务 10（内容管线的 Term 注册表由本 feature 的 registry 提供）；[F002](F002-param-lineage.md)（参数扫描依赖 AC9 的多 ref 克隆）；[F003](F003-github-corpus.md)（报错检索依赖 AC10 的检索接口）
- **Related**: PLAN 第 21 章「PR 影响分析」（AC8 的 PR ingest 是它的素材来源）
