# 实施计划

单个 feature 的分步实施计划放在这里，文件名 `{feature-name}-plan.md`。

**这里不维护状态。** 验收状态只看 `docs/features/F001–F004` 的验收表；「现在在哪、接下来做什么」看 [HANDOFF-LLM-WIKI.md](../../HANDOFF-LLM-WIKI.md)；页数、预算、待审数这类会变的数字按它 §2 的命令现查。

## 索引

| 文件 | 是什么 |
|---|---|
| [llm-wiki-plan.md](llm-wiki-plan.md) | F001 实施计划 |
| [param-lineage-plan.md](param-lineage-plan.md) | F002 实施计划 |
| [github-corpus-plan.md](github-corpus-plan.md) | F003 实施计划 |
| [knowledge-loop-plan.md](knowledge-loop-plan.md) | F004 实施计划 |
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
