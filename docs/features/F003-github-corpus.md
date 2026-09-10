---
id: F003
title: GitHub issue / PR 语料与报错溯源
status: planned
owner: BailanCaptain
created: 2026-09-10
---

# F003 — GitHub issue / PR 语料与报错溯源

**Status**: planned
**Created**: 2026-09-10

## Why

用户 2026-09-10 提的第二个需求：

> 比如我遇到一个报错，我们的 LLM-wiki 是否可以找到对应的 PR 或者 issue。

这类知识不在源码里，也不在文档里，只存在于社区讨论中。vllm-ascend 当前规模（2026-09-10 查 GitHub API）：

| 项 | 数 |
|---|---|
| PR 总数 | 12,074 |
| issue 总数 | 4,188 |
| 最新编号 | #16285 |

关键取舍先说清楚：**这 1.6 万条不做成 wiki 页**。按 F001 试点每页约 2.5 美元，全量转页要约 4 万美元，且绝大多数 issue 没有沉淀价值。它们的正确用法是**检索语料**——纯文本存本地，提问时才被读到，不过 LLM 就不花额度。只有真正改动核心特性的 PR 才升级成 wiki 页。

## What

用户能感知到的变化：

- 贴一段报错到聊天框，能得到「issue #1234 报过同样的错，PR #1300 修了，修复进了 v0.9.1，`v0.7.3-dev` 分支没有这个修复」。
- 问某个特性时，答案能带上相关的设计讨论与已知问题。
- 语料每天自动增量更新，不需要人操作。

## Acceptance Criteria

- [ ] **AC1 · 全量拉取**：`pnpm wiki:sync-github --full` 把 vllm-ascend 全部 issue 与 PR 拉到 `tools/corpus/vllm-ascend/{issues,prs}/<n>.md`，每条含标题、正文、状态、标签、作者、创建与关闭时间、关联引用（`fixes #n`、`closes #n`）、合并提交 sha。纯文本、不进 git（`.gitignore` 加 `tools/corpus/`）。断点续拉：中断后重跑从上次编号继续。验收：拉完条数与 API 报告的 total_count 一致，随机抽 5 条与网页版对照无缺字段。
- [ ] **AC2 · 增量更新**：`pnpm wiki:sync-github` 按 `updated_at` 增量拉取，只取上次同步之后有变动的条目。验收：连跑两次，第二次拉取条数为 0 且退出码 0。
- [ ] **AC3 · 失败可见**：API 限额、网络失败、token 失效各自给出可区分的报错信息，非零退出，并在 `wiki/log.md` 写一条同步记录（时间、拉取数、失败数、原因）。验收：用无效 token 跑一次，报错指明是鉴权问题而不是笼统的网络错误。
- [ ] **AC4 · 报错检索**：聊天层通过 F001 AC10 的 `retrieve()` 接口接入语料。第一版实现：从用户贴的报错里抽取稳定片段（异常类名、错误信息主干、去掉路径与行号等易变部分）做精确 grep。验收：取 10 条真实 issue 里的 traceback 作为输入，能命中原 issue 的条数 ≥ 7；不达标则记录实测数据，按 F001 的约定评估是否给语料加向量检索。
- [ ] **AC5 · 溯源链路**：命中 issue 后顺着 `fixed by #NNNN` 找到 PR，再查 F002 的谱系得出修复进了哪些 tag 与分支。验收：给定一条已修复的 issue，输出链路完整（issue → PR → 合并提交 → 含该提交的 tag 列表）。
- [ ] **AC6 · 重要 PR 升级为 wiki 页**：PR 的 diff 若触及 seeds 里声明的入口文件或 F002 的参数定义文件，自动排进 ingest 队列生成草稿；社区不可信文本（PR 正文、评论）经 sanitize 模块处理后才进 prompt。验收：挑一个真实的参数改动 PR，草稿生成且 diff 可读；构造一条含提示注入的评论，sanitize 后注入片段不出现在 prompt 里。

- [ ] **AC7 · 解析 issue 里引用的文档链接**：社区讨论大量引用官方文档 URL（`docs.vllm.ai/projects/ascend/en/<版本>/<路径>.html`）。抓取时把这类链接解析成结构化引用（版本 + 路径），并映射到本地 `docs/source/` 的对应文件，让「这条 issue 讲的是哪一页文档」可被检索与跳转。链接指向的版本与当前钉住的版本不同时要标出来。验收：取 10 条含文档链接的真实 issue，链接全部被解析出版本与路径，且能映射到本地文件（映射不到的要给出原因，例如该页已被删除）。

**Out of scope**：向量检索（先做 AC4 的 grep 实现并实测命中率，不达标再评估）；vllm 上游仓库的 issue（需要时同一套脚本加一个 repo）；把全部 issue 转成 wiki 页（成本不成立，见 Why）；GitHub webhook 实时推送（每日增量足够）。

## Dependencies

- **GitHub token（阻塞 AC1）**：只读 `public_repo` 权限，放本机环境变量 `GITHUB_TOKEN`，不进仓库。匿名限额 60 次/小时，拉 1.6 万条需约 270 小时；带 token 为 5000 次/小时，全量首拉约数小时。
- **F001 AC10（阻塞 AC4）**：可替换的 `retrieve()` 接口。
- **F002（阻塞 AC5）**：版本谱系提供「修复进了哪个 tag / 哪些分支」。
- **官方文档站与本地 `docs/source/`（AC7）**：解析 issue 里的文档链接需要两边的映射关系。
- **sanitize 模块（AC6）**：从 `C:\Users\-\Desktop\Multi-Agent\packages\api\src\wiki\sanitize\` 整目录复制（5 文件 1492 行，含 510 行测试，零外部依赖），与 F001 AC8 共用。

## Design Decisions

| 决策 | 选项 | 结论 | 原因 |
|------|------|------|------|
| 1.6 万条的处置 | 全转 wiki 页 / 存为检索语料 | **检索语料，选择性升级为页** | 全转要约 4 万美元且多数无沉淀价值；语料不过 LLM，零额度，提问时才读 |
| 语料是否进 git | 进 / 不进 | **不进**，`.gitignore` 加 `tools/corpus/`，靠脚本重建 | 1.6 万条文本会显著撑大仓库；与 `tools/repos/` 同样的处置方式 |
| 拉取方式 | GitHub REST 逐条 / GraphQL 批量 | **REST + 分页**，先做对再谈快 | REST 的限额与错误语义更直白，断点续拉容易实现；不够快再换 GraphQL |
| 报错检索第一版 | 直接上向量 / 先精确 grep 并实测 | **先 grep，实测命中率再决定**（用户 2026-09-10 拍板先不加向量） | issue 里的 traceback 多为原样粘贴，精确片段命中率可能已足够；向量要引入嵌入模型、向量库与重嵌入流程，且会成为第二个真相源 |
| PR 号与 issue 的关联 | 只存原文让 agent 自己找 / 解析出结构化关联 | **解析 `fixes/closes #n` 存成字段** | 溯源链路要能被脚本跟随，不能每次都靠 LLM 读原文 |
| 不可信文本 | 直接进 prompt / 先 sanitize | **先 sanitize** | issue 正文与评论是任意用户可写的，是本项目唯一的不可信输入面 |

**Design Gate**：数据管线级（新目录 `tools/corpus/`、新增外部 API 依赖与凭据）。待用户批准实施计划，且需先拿到 token。

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-09-10 | 用户提出报错溯源需求；查明仓库规模 12,074 PR / 4,188 issue；确认全量转页成本不成立，定为检索语料；用户表示会提供 token。立此 feature |

## Links

- Plan: 待写（拿到 token 且 F002 进行中时再写）
- 依赖: [F001](F001-llm-wiki.md) AC10、[F002](F002-param-lineage.md)
- sanitize 来源: `C:\Users\-\Desktop\Multi-Agent\packages\api\src\wiki\sanitize\`

## Evolution

- **Evolved from**: [F001](F001-llm-wiki.md) AC8（PR ingest 从「手动一条命令」扩成「全量语料 + 自动升级」）
- **Blocks**: 无
- **Related**: PLAN 第 21 章「PR 影响分析」
