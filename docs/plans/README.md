# 实施计划

单个 feature 的分步实施计划放在这里，文件名 `{feature-name}-plan.md`。

**这里不维护状态。** 验收状态只看 `docs/features/` 各 feature 的验收表；「现在在哪、接下来做什么」看 [HANDOFF-LLM-WIKI.md](../../HANDOFF-LLM-WIKI.md)；页数、预算、待审数这类会变的数字按它 §2 的命令现查。

## 索引

| 文件 | 是什么 |
|---|---|
| [2026-11-14-progressive-restructure-and-fix-plan.md](2026-11-14-progressive-restructure-and-fix-plan.md) | 知识库渐进改造、反八股保真规范与全写管线升级、2D 图安全双通道及支撑代码修复总方案（A/A 拍板、3D 冻结定稿版）：五版本双面对账、8 大根因、工程缺陷台账（含 3D/仿真冻结边界）、复用 `supersede.claims` 与事实去向核验、SVG 正向语法安全边界、`drop` v3/v4 并存及包 1–包 5 实施清单 |
| [2026-11-10-wiki-continuation-plan.md](2026-11-10-wiki-continuation-plan.md) | 接续全站教学整改与 OpenCode 成果：官方覆盖、逐项核验、分组整改、学习路径验收及下一批 500 项的计量边界 |
| [wiki-overall-review-2026-10-08.md](wiki-overall-review-2026-10-08.md) | F001–F005 整体独立审查：1 P1 + 4 P2 的实际复现、覆盖矩阵、修复复审与正式待审状态 |
| [wiki-final-acceptance.md](wiki-final-acceptance.md) | 10-08 最终证据：多版本导入、确认参数全量骨架、独立来源审查、GitHub 十题门槛、连续维护及四页纠错发布确认；历史记录单列 |
| [wiki-qknorm-multiversion-acceptance.md](wiki-qknorm-multiversion-acceptance.md) | Q/K Norm 来源与独立审查、章节引用与检索修正、六例固定版本真实问答证据 |
| [wiki-teaching-redesign-plan.md](wiki-teaching-redesign-plan.md) | 教学体系改版：目录、存量页面迁移、模型与硬件配图、实施顺序及验收入口 |
| [wiki-ingestion-boundary-2026-09-26.md](wiki-ingestion-boundary-2026-09-26.md) | 教学规则在现有入库流程中的能力与人工审阅边界 |
| [wiki-teaching-discussion-2026-09-25.md](wiki-teaching-discussion-2026-09-25.md) | 教学改版的讨论、用户取舍与前期调研依据 |
| [llm-wiki-plan.md](llm-wiki-plan.md) | F001 实施计划 |
| [param-lineage-plan.md](param-lineage-plan.md) | F002 实施计划 |
| [github-corpus-plan.md](github-corpus-plan.md) | F003 实施计划 |
| [knowledge-loop-plan.md](knowledge-loop-plan.md) | F004 实施计划 |
| [wiki-drop-plan.md](wiki-drop-plan.md) | F005 Drop 资料收录与知识整合；产品决策统一在 feature |
| [wiki-drop-discovery-plan.md](wiki-drop-discovery-plan.md) | Drop 发现与整合优化；上下文去重、按需读取、原文覆盖及跨页复核一并验收 |
| [wiki-drop-acceptance.md](wiki-drop-acceptance.md) | F005 工程验证、真实模型前后测与适用限制 |
| [wiki-answer-quality-acceptance.md](wiki-answer-quality-acceptance.md) | F004 AC3 独立回答评判、缺口与复测接入及验证边界 |
| [wiki-terms-gap-audit.md](wiki-terms-gap-audit.md) | 课程入口匹配、历史关单对账和仍缺证据的事项 |
| [wiki-audit-2026-09-19.md](wiki-audit-2026-09-19.md) | 2026-09-19 的一次性只读审视，写完即定稿，不逐轮更新 |
| [llm-wiki-open-questions.md](llm-wiki-open-questions.md) | 用户 09-10 起提的问题与处置台账 |
| [wiki-eval-preparation.md](wiki-eval-preparation.md)、[wiki-nonbulk-completion.md](wiki-nonbulk-completion.md) | 两份历史准备/收尾记录 |
| [handoff-archive-2026-09-19.md](handoff-archive-2026-09-19.md) | 2026-09-19 之前的逐轮交接流水账 |
| [archive/](archive/README.md) | 09-10 至 09-18 的 27 份逐轮 review 报告，只留历史证据 |

## 计划怎么写

参考 Multi-Agent 的 `writing-plans` skill（`C:\Users\-\Desktop\Multi-Agent\multi-agent-skills\writing-plans/SKILL.md`），以本项目的单一真相源要求为准：

- 开头写 Goal / Acceptance Criteria / Architecture / Tech Stack。AC 的规范文本与完成状态只保留在 feature；plan 用 AC 编号逐条映射任务和验证，不复制另一份需求。
- 动手前做 Straight-Line Check：定终点线与「不做什么」、定终态数据结构、每步过三问（产物在终态原样保留吗、完成后能验证什么、去掉这步的代价是什么）。
- 纯探索显式标为 Spike，限时，产出是决策不是交付物。
- 每个任务写清失败用例、运行命令、最小实现和通过条件；实施时按写失败测试 → 确认失败 → 实现 → 确认通过的小步执行。提交遵循当前任务授权。
- 写精确文件路径、必要的接口约束、精确命令与预期输出；不把整份未来实现复制进 plan。实现后机器契约由代码与测试承接，plan 保留决策依据和验收入口。
- 分开记录本轮已验证的基线与未来预期。计划写完不代表 feature 完成，也不自动启动实现、外部采集或定时任务。
