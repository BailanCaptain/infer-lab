# LLM WIKI 地基修复验收记录

日期：2026-09-14。工作树：`infra-view-new-llm-wiki`，分支：`feat/llm-wiki`，实施基线：`8175224`。本记录描述本轮未提交修改的验证结果，不代表整个 F003 / F004 完成。

## 结论与范围

[F004 plan](../knowledge-loop-plan.md) 的 T0 已实施并通过本轮验证。方向符合原始 [llm-wiki.md](../../../../infra-view-new/llm-wiki.md)：markdown 持久积累知识、保留可追溯来源、从页面派生关系与索引，后续使用结果通过编译和审阅进入正式库。没有新增训练、推理部署或性能基准工作，没有批量导入。

**“越用越聪明”尚未实现。** 当前修复的是证据、版本、失败隔离与关系读取的可靠性。问答回存、持久任务、批准发布和新会话复用仍按 T1–T6 实施；F004 的 AC 保持未勾选。具体完成状态以 [F004](../../features/F004-knowledge-loop.md) 为准。

## 本轮解决的问题

严重级别按修复前影响标注。下列测试均已实际运行，缺陷先由失败测试或实际命令重现，再验证修复。

| 级别 | 位置与修复 | 影响、复现与证据 |
|---|---|---|
| P1 | `scripts/wiki/git.ts`、`scripts/wiki/audit.ts:51`、`scripts/wiki-audit.ts`：按引用 commit 读取 blob | 原先当前工作树行数可能为其他版本的引用背书。`audit-cli.test.ts` 用两个 commit 的不同行数、无效 commit 和文件终止换行复现；修复后按版本判断，并区分 commit、路径和行号错误。 |
| P1 | `scripts/wiki/clone.ts:60`、`scripts/wiki-clone.ts`：更新已存在 ref 工作树的 pin，写前检查脏工作树 | 原先 pin 更新可能仍读取旧代码。`clone-cli.test.ts` 在临时本地 git 仓库执行 A → B 更新，再验证脏工作树报错且保留内容；没有更新用户的上游克隆。ingest 也在 agent 启动前验证 HEAD 与 pin、工作树清洁状态。 |
| P1 | `scripts/wiki-lineage.ts`、`scripts/wiki/git.ts`：git 失败非零退出 | 原先读取失败可能被表述为参数“不存在”。`lineage-cli.test.ts` 验证无效 ref 失败且不产生缺失结论；合法 grep 无匹配仍允许正常返回。 |
| P1 | `scripts/wiki/ingest.ts:563`、`scripts/wiki-ingest.ts:147`：整合只选择当前成功项；独立整合必须显式选择 | 原先可能整合失败项或其他批次的旧草稿。`ingest-cli.test.ts`、`ingest.test.ts` 覆盖空成功清单、失败项、其他批次、未知 ID、params 已存在、runner 抛错和错误返回 ID。dry-run 不创建输出目录。 |
| P1 | `scripts/wiki/integration-run.ts`：副本执行、验证后发布、发布前检查基线 | 原先校验失败时可能已改变正式页。`integration-run.test.ts` 覆盖 agent 失败、lint 失败、旧决策、其他批次决策、raw 越界写、正常发布及编译期间用户改动；失败时正式页、来源和草稿保留。发布采用短时锁、逐文件替换和异常回滚，完整进程崩溃恢复未实现。 |
| P2 | `src/content/wiki/relations.ts:11`、`src/content/wiki/retrieve.ts`、`scripts/wiki/ingest.ts:328`、`server/chat.ts`：共用 relations 派生邻接关系 | 原先旧 related 路径与正式关系模型脱节，params 还可能被拼成 concepts 路径。`retrieve.test.ts`、`ingest.test.ts`、`server/chat.test.ts` 覆盖正反一跳、扩展数量限制、via、同 ID 旧页及真实参数页路径。没有增加另一份人工关系表。 |
| P2 | `scripts/wiki/build.ts:95`：schema 错误时保留旧派生物 | 原先失败构建可能发布不完整索引。`build.test.ts` 用非法页面验证失败时 index 和 registry 内容不变。 |
| P2 | `wiki/params/multistream-overlap-gate.md:16`：引用末行 L42 → L41 | 新审计在真实库检出越界；`git show 2c59ff10:vllm_ascend/flash_common3_context.py` 的文件为 41 行。修正引用、追加 log 并运行 `pnpm wiki:build` 更新派生 registry。未修改 raw 摘录。 |

浏览器测试还有一处过时定位器：`tests/evidence.spec.ts` 仍查找 `wiki-related`，实际接着看入口为 `wiki-next`。首轮 16 项通过、1 项超时；更新定位器后重新验证悬停内容，17 项通过，未删除断言。

## 实际验证结果

以下命令均在上述 feature 工作树执行。

| 命令 | 关键输出 / 结果 |
|---|---|
| `pnpm check` | exit 0；typecheck 通过；lint 检查 141 文件；37 个测试文件、379 项测试通过；依赖检查通过；内容 registry 19 页通过；wiki lint 通过。无章节内容，因此章节 Term 检查跳过。 |
| `pnpm build` | exit 0，Vite 构建通过。 |
| `pnpm test:e2e tests/wiki.spec.ts tests/evidence.spec.ts --project chromium` | `17 passed (36.2s)`；真实 Chromium 操作页面导航、分节、Mermaid、角标与表格、关系悬停、问答抽屉和错误状态。问答 SSE 使用测试路由模拟，未调用真实 LLM。 |
| `pnpm wiki:build` | 19 页，派生 registry 已随一处来源修正更新。 |
| `pnpm wiki:audit --seeds wiki/seeds/vllm-ascend.yaml` | exit 0；19 页、410 条来源；行号有效 403、URL 未联网验证 7、无效 commit 0、文件不存在 0、行号越界 0、未知仓库 0、raw 引用待核对 107。 |
| `pnpm test scripts/wiki/handbook.test.ts scripts/wiki/sources.test.ts` | HANDBOOK 更新后复验，2 个文件、14 项测试通过；再次运行 `pnpm wiki:lint` 通过。 |
| 文档本地链接检查、`git diff --check`、`git diff --exit-code -- wiki/raw` | 27 个本地链接无断链；diff 无空白错误；原始摘录无已跟踪改动。主工作树 status 与实施前一致。 |

lint 仍报告既有 Biome 配置版本 / 弃用提示及 `wiki.css` specificity 警告，本轮没有修改无关样式或配置。通过不代表没有警告。

## 能力边界与后续

- **证据审计范围明确缩小为实际能证明的内容。** 403 条通过只证明本地 commit、文件及行号范围成立，不证明正文结论正确。7 条 URL 尚未联网验证；107 条 raw 引用尚待核对，其中旧标题无法提供同版本完整引用，不能仅凭同名文件算通过。新摘录格式在 HANDBOOK 中统一规定，历史 raw 未批量重写。
- **原文不可变仍需 T2 的确定性导入器。** 本轮阻止整合副本修改 raw，但旧提取阶段再次执行时的原文不可覆盖约束尚未完整实现。未运行真实 agent 提取或整合，不以模拟 runner 测试冒充真实编译验收。
- **副本发布不是完整审阅系统。** 当前 CLI 仍自动发布通过校验的选定批次；人审 manifest、批准 / 驳回接口、硬崩溃后的恢复与遗留锁处理还需 T1 / T3。没有把这些未来能力标成完成。
- **版本谱系只修错误判定。** 本轮没有证明所有谱系结论的语义、补齐参数骨架或启用定时维护；F002 仍需按其 AC 单独验收。
- **下一检查点是 T1 共用任务状态及 M1a 所需的原文底座，随后跑通一条答案回存闭环。** 验收必须包括：有来源的答案 → 待审 diff → 批准 → 正式 markdown 与快照更新 → 独立新会话复问受益。增加提问次数本身不能算知识积累。

待用户决定的问题：无。上述后续工作已有计划，本轮不引入额外产品范围。
