# 实施计划

单个 feature 的分步实施计划放在这里，文件名 `{feature-name}-plan.md`。

参考 Multi-Agent 的 `writing-plans` skill（`C:\Users\-\Desktop\Multi-Agent\multi-agent-skills\writing-plans/SKILL.md`），以本项目的单一真相源要求为准：

- 开头写 Goal / Acceptance Criteria / Architecture / Tech Stack。AC 的规范文本与完成状态只保留在 feature；plan 用 AC 编号逐条映射任务和验证，不复制另一份需求。
- 动手前做 Straight-Line Check：定终点线与「不做什么」、定终态数据结构、每步过三问（产物在终态原样保留吗、完成后能验证什么、去掉这步的代价是什么）。
- 纯探索显式标为 Spike，限时，产出是决策不是交付物。
- 每个任务写清失败用例、运行命令、最小实现和通过条件；实施时按写失败测试 → 确认失败 → 实现 → 确认通过的小步执行。提交遵循当前任务授权。
- 写精确文件路径、必要的接口约束、精确命令与预期输出；不把整份未来实现复制进 plan。实现后机器契约由代码与测试承接，plan 保留决策依据和验收入口。
- 分开记录本轮已验证的基线与未来预期。计划写完不代表 feature 完成，也不自动启动实现、外部采集或定时任务。

## 当前收尾证据

[真实缺口接续](wiki-real-gap-review.md)：生产三次问答、唯一排队、诊断、四类前测及现有页修订已推进至用户批准发布；公式与来源浏览器验证通过，收费后测因新未知费用暂停，尚未关闭缺口。

新会话先读 [最新 handoff](../../HANDOFF-LLM-WIKI.md)：现状怎么查、接下来做什么、踩过的坑。逐条证据见 [2026-09-19 审视](wiki-audit-2026-09-19.md)；更早的逐轮流水账在 [归档](handoff-archive-2026-09-19.md)。状态数字一律现查，不在索引里抄。

[可读性与问答接续](wiki-readable-versions-review.md) 保留上一阶段记录：版本名称已改为可读分支，问答输入冲突已修复，32 次调用额度已用满，最终代码修改后尚未真实复测。[扩额、正式补页与真实对照](wiki-budget-30-review.md) 保留前轮记录：用户授权累计 $30 以下，参数页已批准发布，六题前后测完成但质量未全部通过；[原前测与补写停点](wiki-real-baseline-review.md) 保留此前 $10 / 8 次失败记录；[预算恢复记录](wiki-budget-resume-review.md) 保留恢复实现和批准留痕；[证据核查](wiki-evidence-review.md) 保留过度纠错撤回、107 条 raw 提示核查及显存修订发布；[维护接续](wiki-resume-review.md) 和 [独立复查](wiki-independent-closure-review.md) 保留更早证据。[旧收尾报告](wiki-nonbulk-review.md) 也是历史快照，不能覆盖当前状态。

## 知识库后续实施顺序

1. [F004 计划](knowledge-loop-plan.md)：可信度前置修复 → 最小知识积累闭环 → 持续维护。
2. [F003 计划](github-corpus-plan.md)：可与 F004 的离线工作独立推进采集器；PR 草稿接入 F004 的共用审阅流程，每日任务复用 F002 的调度入口。

F003 / F004 的完整交付仍以各自 feature 的全部 AC 为准，最小闭环只是中间验收点。

总体大纲在仓库根目录的 `PLAN.md`，当前状态在 `HANDOFF.md`。

- [聊天保存与浏览器审阅验收](wiki-chat-save-review.md)：有引用回答 → 受限编译 → 待审 → 发布后阅读与检索，固定输出验证及剩余边界。

- [问答版本隔离验收](wiki-chat-version-review.md)：正文快照、会话版本绑定、跨版本重新检索及浏览器证据。

- [真实复问验收准备](wiki-eval-preparation.md)：固定六场景与源码依据、离线对照配置；零模型调用，尚未证明回答改善。

- [读者快照一致性验收](wiki-reader-snapshot-review.md)：离线精确版本、缓存重入、请求乱序保护及生产构建浏览器证据。

- [真实知识积累验收](knowledge-loop-review.md)：真实模型编译、候选驳回 / 发布、固定问题前后复问、费用及完整效果的限制；后续实际结果以此报告为准。

- [问答引用归属验收](wiki-answer-citations-review.md)：快照内页面、编号与证据等级核对，失败提示和保存前阻塞；零新增模型调用，语义效果仍未全过。

- [缺口信号记录验收](wiki-gap-observation-review.md)：问答观察持久化、事件去重、计数和待判定提示；尚未接入自动分类与补写。

- [覆盖判定验收](wiki-coverage-assessment-review.md)：显式预算的单条诊断、引文与版本约束、并发和重试限额；自动补写及真实分类效果仍待验收。

- [真实分类与验证运行器](wiki-classification-review.md)：固定模型分类对照、上下文成本控制、真实超额回执与测试执行边界；保留首次分类失败和修正后的复验。

- [诊断范围与补料核对](wiki-coverage-scope-review.md)：记录实际提供材料，隔离未验证理由，保留旧回执，并提供有版本校验的只读核对入口；尚未自动编译。
