---
id: F004
title: 知识库闭环：投喂、补写、巡检
status: planned
owner: BailanCaptain
created: 2026-09-11
---

# F004 — 知识库闭环：投喂、补写、巡检

**Status**: planned
**Created**: 2026-09-11

## Why

用户 2026-09-10 提出的问题：

> 我们 LLM-wiki 整体是否符合越用越聪明？假设做出来之后问问题是 agent 怎么查？如果查不到怎么办？是否会有如果是 LLM-wiki 查不到，但是会自动去整合写 wiki 给人工审批是否需要加入 wiki，加入 wiki 的时候是否会交叉审视、建链等各种操作，死链是否会有定期审查？

> Multi-Agent 中是可以手动 drop 资料进来的，我们有吗？如果有逻辑是怎么样，如果没有，我需要。

诚实的现状：**F001 是一次性生产，不是闭环**。批量灌种 → 人审 → 静态页，问答只读不回写。用一百次和用一次，知识库是一样的。逐条差距：

| 能力 | F001 现状 |
|---|---|
| 查不到怎么办 | 只会答「知识库里还没有这一条」，然后用自身知识回答并标「（未收录）」。**不记录、不回写** |
| 自动整合写 wiki 给人审 | 无。AC8 只有聊天里手动点「存进 wiki」 |
| 交叉审视、建链 | 有一半：整合 agent 建双向 `related`，lint 有 `related-asymmetric`——但**只在 ingest 当次跑** |
| 死链定期审查 | 有一半：lint 有 `broken-link` 规则，但只在 `pnpm check` 时跑，**无定期巡检** |
| 手动投喂资料 | **完全没有** |

规划 F001 时砍掉了 Multi-Agent 的租约 / CAS / cron 巡检，理由是「扇出 + 整合不需要锁」。那个理由对**并发保护**成立，但闭环是另一件事——当时把需求理解成「批量灌种 + 问答」，没把闭环当需求。用户已明确要求，本 feature 补上。

## What

用户能感知到的变化：

- 手里有一份资料（论文、内部文档、聊天记录、报错日志），投进去就能变成待审草稿，不用手写。
- 问了知识库答不上来的问题，这个缺口会被记下来；攒够了自动去写，写完等你审。
- 每天自动查死链、孤页、过期页，问题落到一份 warnings 文件，不用你去翻。
- 页面上能看出这一页是 agent 读源码写的、还是别人投喂来的——两者可信度不同。

## Acceptance Criteria

- [ ] **AC1 · 手动投喂**：`pnpm wiki:drop <文件或目录> --why "<为什么值得收>"` 把资料变成待审草稿。链路：读取 → `sanitizeRawDrop` 洗提示注入 → agent 按「投喂」切片编译成符合「页面格式」的草稿 → 落 `wiki/_drafts/`，原文存 `wiki/raw/drop-<日期>-<序号>.md`。验收：投一份真实 markdown，草稿生成且 `sources` 指向存下来的原文；构造一份含提示注入的文件，注入片段不出现在 agent 的 prompt 里（断言 prompt 文本）。
- [ ] **AC2 · 投喂隔离区**：连续投喂做交叉关联检测——7 天窗口内比对历史投喂，命中「关键词链」或「互相引用」或「同来源高相似」的判为 `chained_suspect`，草稿进 `wiki/_drafts/_quarantine/` 而不是正常待审区，并在 warnings 里告警。验收：用 Multi-Agent 的 `series-vs-chained` 样例形态构造两组输入，续传的判为同系列放行、拆分注入的判为隔离。
- [ ] **AC3 · 知识缺口捕捉**：问答走 F001 AC10 的 `retrieve()`；命中不足时把问题、时间、检索到的候选写进 `wiki/_gaps.json`。同一缺口累计到阈值（默认 3 次）自动排进 ingest 队列，产出草稿等人审。验收：连问三次知识库没有的词，`_gaps.json` 计数到 3 并出现在队列里；跑一次补写产出草稿。
- [ ] **AC4 · 定期巡检**：`pnpm wiki:patrol` 复用 `lintPages` 的纯函数，加三项时间维度检查——死链、孤页、`updated` 超过 N 天且其 `sources` 指向的源码在钉住 ref 上已变动的页。结果写 `wiki/warnings/patrol-<日期>.md`，有问题非零退出。挂进 F002 的每日调度。验收：人为造一条死链与一页过期，巡检报出两项并指名文件。
- [ ] **AC5 · 页面来源标记**：frontmatter 增加可选 `origin` 字段（`seed` / `drop` / `chat` / `pr` / `gap`，默认 `seed`），阅读页显示来源角标，投喂来源的页有视觉区分。验收：现有 11 页不改一字仍通过 lint（默认值生效）；投喂产出的页 `origin: drop` 且页面上可见。
- [ ] **AC6 · 周期性交叉审视**：`pnpm wiki:reconcile` 定期重跑整合的四件事（判重、建双向链、标矛盾、修 `related`），范围是全库而不只当批草稿。为控制上下文，只读 `index.md` 摘要 + 按 chapter 与 related 拉取相关页，不读全量正文。验收：人为把一条 `related` 改成单向，reconcile 后恢复双向且 lint 通过。

**Out of scope**：向量检索（F001 已定按实测命中率决定，且只考虑 issue 语料）；自动晋升（草稿一律人审，不做自动合入）；投喂二进制与图片（先只收文本类）；多用户与权限（单机单人）。

## Dependencies

- **F001 AC10（阻塞 AC3）**：可替换的 `retrieve()` 接口。若 AC7 把 grep 内联进聊天层，AC3 要重写聊天层——见 F001 的风险登记。
- **F001 AC8（共享）**：sanitize 模块。AC8、F003 AC6、本 feature AC1 三处共用，谁先做谁引入，从 `C:\Users\-\Desktop\Multi-Agent\packages\api\src\wiki\sanitize\` 整目录复制（5 文件 1492 行，含 510 行测试，零外部依赖）。
- **F002 Task 21/22（共享）**：`wiki:sync` 的调度器与 Windows 计划任务，AC4 的巡检搭同一班车。
- **`runBatch` 重构（阻塞 AC1、AC3）**：见 Design Decisions 第一条。**[F002](F002-param-lineage.md) AC2/AC5 同样需要它**，若 F002 先做则本 feature 直接受益，无需重复。
- **[F002](F002-param-lineage.md) 的 GENERATED 区约定（约束 AC6）**：参数页含脚本生成区（F002 D7），`wiki:reconcile` 改 `related` 时必须只动标记区之外的内容，否则会覆盖每日刷新的版本表。

## Design Decisions

| 决策 | 选项 | 结论 | 原因 |
|------|------|------|------|
| 驱动器与 seeds 解耦 | 各写各的池 / 抽出 `runBatch` | **抽出 `runBatch(requests: AgentRequest[], ctx, deps)`** | `AgentRequest`（`ingest.ts:77`）本来就是通用形状，`extractRequest` 与 `integrateRequest` 只是工厂；但 `runExtractPhase` 签名绑死 `SeedFeature[]`，而它之后四十行（快照 → 并发池 → 越界检查 → 失败账本）与 seeds 无关。十行的机械重构，现有测试继续有效 |
| 链式注入检测的相似度 | 引入 embedding / 不用向量 | **不用向量**：关键词链 + 互相引用 + 来源指纹三路 | F001 已决定不引入嵌入与向量库；Multi-Agent 的 `keyword-chain.ts` 与 `reference-link.ts` 本来就不依赖向量，够用。真不够再议 |
| 缺口触发阈值 | 一次就写 / 累计 N 次 | **累计 3 次（可配）** | 一次就写会被随口一问触发，浪费额度；累计能筛出真实反复出现的缺口 |
| 投喂产物去向 | 直接进 `concepts/` / 进草稿区 | **一律进草稿区，人审后才晋升** | 投喂是本项目唯一的不可信输入面，沿用 F001「agent 写、人只审」的底线 |
| `origin` 字段 | 必填 / 可选带默认 | **可选，默认 `seed`** | 现有 11 页不用回改；zod `.default()` 生效后 lint、build、registry 自动带上 |
| 巡检的「过期」定义 | 只看日期 / 日期 + 源码是否变动 | **日期 + 源码变动** | 只看日期会把稳定页面误报成过期；`sources` 指向的行在钉住 ref 上没动过，页面就还是准的 |
| 周期性交叉审视的读取范围 | 读全量正文 / 读索引 + 相关页 | **索引 + 相关页** | 见 F001 风险登记「整合读全量页会撞上下文」。本 feature 的 AC6 直接按新策略写，不重蹈 |
| reconcile 与生成区 | 全文改写 / 只改标记区外 | **只改标记区外**，并在改写前断言 GENERATED 区完整 | 参数页的版本表由 F002 每日重算；reconcile 若整页重写会把它冲掉，下次 sync 又改回来，两边互相覆盖 |
| 巡检失败的处置 | 自动修 / 只报告 | **只报告，不自动改页面** | 自动改会让人失去对知识库的掌控；`related` 单向这类机械问题由 AC6 的 reconcile 显式修 |

**Design Gate**：管线级（新增投喂入口、隔离区、缺口账本、巡检调度）。待用户批准实施计划。

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-09-11 | 用户指出 F001 不满足「越用越聪明」，并明确要手动投喂能力。核对 Multi-Agent 的 `multi-drop`、`llm-compile`、`sanitize`、`promote-audit` 后立此 feature；同时评估出对 F001–F003 的改动为「小」，唯一机械重构是 `runBatch` |

## Links

- Plan: 待写（F001 AC7/AC8 落地后再写，届时 sanitize 与 retrieve 的实际形态才确定）
- 依赖: [F001](F001-llm-wiki.md) AC8、AC10；[F002](F002-param-lineage.md) 调度器
- 参照实现: `C:\Users\-\Desktop\Multi-Agent\packages\api\src\wiki\` 的 `multi-drop/`、`llm-compile/`、`sanitize/`、`promote-audit/`

## Evolution

- **Evolved from**: [F001](F001-llm-wiki.md)（把一次性生产扩成闭环）
- **Blocks**: 无
- **Related**: [F003](F003-github-corpus.md)（issue 语料同样是不可信输入，共用 sanitize）
