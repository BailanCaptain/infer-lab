# 全 feature 进度核对与共用批处理实施记录

日期：2026-09-14。范围：仓库正式登记的全部 feature，F001–F004。实现和测试位于 `../infra-view-new-llm-wiki`、`feat/llm-wiki`、HEAD `8175224` 的未提交工作区。主干 `../infra-view-new` 位于 `009412b`，本轮只读。

## 结论

**4 个 feature 都有 plan，尚无一个完成全部验收。** 文档写完、部分函数可用、历史试点通过和当前完整交付是不同状态，不能直接按复选框相加得到总体百分比。当前状态只维护在下列 feature 文件中；本记录是本轮证据快照，不作为第二份持续更新的状态表。

| Feature | 本轮核对结论 | 当前状态与逐项证据 |
|---|---|---|
| F001 课程知识库与问答 | 阅读基础可用，19 页；回答回存尚缺，提取隔离、图符号校验和回答末尾相关页入口仍未完整交付；批量灌种按用户要求暂停 | [F001 当前验收](../../features/F001-llm-wiki.md#2026-09-14-当前验收核对)：AC1 / AC2 / AC6 / AC10 本轮自动验证；AC4 / AC7 / AC9 保留历史证据但没有本轮真实 agent / 语义全链路复验；AC3 / AC11 / AC12 部分实现；AC5 暂停，AC8 未完成。 |
| F002 参数清单与版本谱系 | 8 个参数页和部分谱系工具可用；原“2/6 达成”不成立，应是 2 项部分实现、4 项未实现 | [F002 当前验收](../../features/F002-param-lineage.md#2026-09-14-当前验收核对)：AC3 缺 tag 列表和完整生命周期核验；AC5 缺骨架刷新保护链路；AC1 / AC2 / AC4 / AC6 未实现。 |
| F003 GitHub 语料与报错溯源 | 计划已写，7 项 AC 均未交付 | [F003](../../features/F003-github-corpus.md#acceptance-criteria)；`package.json` 没有 sync-github，源码检索未发现采集器、语料检索和 PR 入库入口。未执行全量拉取。 |
| F004 使用驱动的知识积累闭环 | T0 已完成，T1 共用执行器已接入，持久任务与闭环仍未完成；9 项 AC 均未完整交付 | [F004](../../features/F004-knowledge-loop.md#acceptance-criteria)、[T1 实施范围](../knowledge-loop-plan.md)；`scripts/wiki/batch.ts:50` 是本轮新增基础，不能充当 chat 保存、审阅或知识积累的完成证明。 |

**整体仍处在“可信知识库底座 + 可读可问”阶段，尚未达到“越用越聪明”。** 最小可证明终点仍是一条有来源的答案，经草稿、人审和发布后，被独立新会话复用。没有训练模型、部署推理服务或运行性能基准。

## 本轮优化了什么

将 agent 请求 / 结果契约、并发池和批处理执行集中到 `scripts/wiki/batch.ts`，`scripts/wiki/ingest.ts` 通过引用复用，保留兼容导出。原 seed 流程实际调用新执行器；后续入口不必再复制一套并发和结果处理。产物 schema、越界写检查、失败清单仍由 ingest 适配器负责，没有把执行成功直接当作草稿合格。

| 级别 | 位置 | 修复前影响与稳定复现 | 本轮结果 |
|---|---|---|---|
| P2 | `scripts/wiki/batch.ts:27`、`scripts/wiki-ingest.ts:51` | `runPool([1], NaN, fn)` 返回 `[undefined]`，任务未执行也未拒绝；CLI 非法并发 / 超时值未前置验证 | 批次启动前验证正整数；CLI 在读取仓库和创建输出前拒绝。`ingest.test.ts` 红例实际失败后转绿；`ingest-cli.test.ts` 用临时目录验证零输出。 |
| P2 | `scripts/wiki/batch.ts:60` | 相同任务 ID 会共享草稿写路径，不能在单批并发执行 | 同批重复 ID 在任何 agent 启动前报错，`batch.test.ts` 断言 runner 调用数为零。这只是单批检查，不代表跨入口持久去重完成。 |
| P2 | `scripts/wiki/batch.ts:68`、`scripts/wiki/ingest.test.ts` | `ok: true` 配非零 exitCode 仍进入成功清单；错误返回 ID 抛错后丢失已报告费用 | 不一致结果记为对应请求的失败，其他项继续；保留已报告费用和会话字段。红例原返回 `[a,c]`，修复后只返回 `[c]`。 |
| P2 | `scripts/wiki/batch.ts:87`、`scripts/wiki-ingest.ts:138` | 缺失费用与零费用混为一谈，后续预算会低估消耗 | 返回已报告合计及 `unknownCostIds`；缺失费用显式待核对，负值 / NaN 视作非法结果。持久预算预留、消耗账本和恢复还没有实现。 |

同时纠正进度文档：F001 撤回 AC3 / AC11 / AC12 的完整达成标记，F002 撤回 AC3 / AC5；历史试点记录保留。F004 状态改为实施中但 AC 不勾选。PLAN 补齐四个 feature 索引，HANDOFF 改为引用；F001 / F002 plan 删除重复 AC 全文，规范与状态归 feature。

## 本轮实际验证

| 命令 / 检查 | 关键结果 |
|---|---|
| 修复前 `pnpm test scripts/wiki/ingest.test.ts` | `2 failed / 45 passed`：NaN 并发没有拒绝；非零退出的任务混入成功清单。新增 batch 模块首次测试因模块不存在失败，未算作通过。 |
| 接入后 `pnpm test scripts/wiki/batch.test.ts scripts/wiki/ingest.test.ts scripts/wiki/ingest-cli.test.ts scripts/wiki/claude-cli.test.ts` | 4 个文件、62 项通过；随后新增的 CLI 参数预检用例由全量检查覆盖。 |
| `pnpm check` | exit 0；38 个文件、392 项测试通过；typecheck、依赖检查、19 页内容检查和 wiki lint 通过。lint 有既有 1 warning / 2 infos，未顺手改配置或样式。 |
| `pnpm build` | exit 0；Vite `built in 4.46s`。 |
| `pnpm test:e2e tests/wiki.spec.ts tests/evidence.spec.ts --project chromium` | `17 passed (38.0s)`；浏览器实际操作通过。问答 SSE 使用测试路由，未调用真实 LLM。 |
| `pnpm wiki:audit --seeds wiki/seeds/vllm-ascend.yaml` | 19 页、410 来源；403 本地行号有效；无效 commit / 缺文件 / 越界 / 未知仓库均为 0；7 URL 未联网验证，107 raw 引用待核对。行号有效不证明摘录或结论语义正确。 |
| Node + tsx 只读调用 `loadPages`、`renderIndex`、`buildRegistry` | 19 页、0 problems；连续两次派生相同；index / registry 均与磁盘一致。未改真实产物来制造幂等通过。 |
| `rg --files docs/features`、`git worktree list` | feature 工作树只有 F001–F004 四份正式 feature；主干没有 docs/features。知识库在 feature 工作树，尚未合入主干。 |
| 文档链接检查、`git diff --check` | 排除代码示例后，65 个本地文件链接无断链；diff 无空白错误。 |

## 正式 feature 之外的项目进度

为避免把“全部 feature”误说成“整个教学产品已经完成”，也只读核对了主干：`src/app/App.tsx:12` 只有首页和 `dev/spike-c`，没有 wiki 或课程章节路由；`src/content` 没有章节文件。主干 PLAN 的 M1 表记载仿真 / 时间线等底座已有实现，样板章、工作台页面和表现层仍未完成；这些模块本轮没有逐一浏览器验收，不能沿用旧状态宣称本轮完成。

主干首页城市场景、其他教学画面和未登记为 F 编号的需求，本轮没有做完整产品审计。正式 feature 进度以上述四项为全量范围，不擅自给未登记工作补造 feature 或百分比。

## 接下来的顺序与限制

1. 完成 T1：持久工作状态、跨入口去重、预算预留与消耗记录、重试和中断恢复。当前 `runBatch` 只是已接入的共用执行部分，不能把 T1 勾成完成。
2. 补 M1a 所需不可变 raw 和来源映射，再交付答案保存、diff 审阅、批准 / 驳回与快照刷新，验证新会话受益。
3. F002 补参数扫描 → 骨架 → 谱系 / 正文刷新保护，F003 的离线采集器和 PR 接入复用共用任务及审阅底座。批量导入保持暂停。
4. 最后接缺口补写与维护；不以调度存在或反复运行来替代证据校验和知识复用验收。

本轮没有真实 agent 编译、批量导入、上游同步、注册定时任务或 git 提交。待用户决定的问题：无。
