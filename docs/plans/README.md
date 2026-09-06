# 实施计划

单个 feature 的分步实施计划放在这里，文件名 `{feature-name}-plan.md`。

写法遵循 Multi-Agent 的 `writing-plans` skill（`C:\Users\-\Desktop\Multi-Agent\multi-agent-skills\writing-plans/SKILL.md`）：

- 开头写 Goal / Acceptance Criteria / Architecture / Tech Stack，AC 逐条抄齐。
- 动手前做 Straight-Line Check：定终点线与「不做什么」、定终态数据结构、每步过三问（产物在终态原样保留吗、完成后能验证什么、去掉这步的代价是什么）。
- 纯探索显式标为 Spike，限时，产出是决策不是交付物。
- 每步是一个动作（2 到 5 分钟）：写失败测试 → 跑测试确认失败 → 写最少实现 → 跑测试确认通过 → 提交。
- 写精确文件路径、完整代码、精确命令与预期输出。

总体大纲在仓库根目录的 `PLAN.md`，当前状态在 `HANDOFF.md`。
