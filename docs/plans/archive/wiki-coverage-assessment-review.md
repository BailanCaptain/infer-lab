# 显式预算的缺口覆盖判定验收

2026-09-15，`feat/llm-wiki`，HEAD `8175224` 的未提交工作区；实现位于 `infra-view-new-llm-wiki`。没有批量导入或新增真实模型调用。

## 结论

缺口观察之后，维护者现在可以显式选择一条达到阈值的记录，提供任务总预算、单次预留和最大尝试次数，执行一次受限的覆盖诊断。结果区分覆盖、缺知识、已有页漏检、版本过期和未判明，保存知识版本、观察指纹、输入、实际输出、逐字引文和费用；同一输入可复用成功结果，不重复调用。失败不自动重试，未知费用保留预留额。

这推进了“使用留下问题 → 判断应该改进什么”，符合原始理念中持久积累、维护已有知识与识别矛盾的方向。诊断本身不是新的知识页：仍需找到来源、受限编译、人审发布和新会话复问，才能证明越用越好。F004 AC3 / T4 保持部分实施，整体仍为 **0/4 feature 完整验收**；真实问答严格效果的既有失败继续保留在 [真实验收](knowledge-loop-review.md)。

## 实现和单一真相源

- `server/coverage-work.ts` 的 `coverageDecisionSchema` 定义结果契约；`wiki/HANDBOOK.md` 查询章定义诊断提示，与普通问答的排版要求分开。`satisfied` 与分类矛盾、没有必要引文、引用未提供页面或虚构原文都拒绝采纳。
- 输入来自同一 `KnowledgeSnapshot` 的完整索引及一次有限检索摘录，保留原问题的 revision 和候选记录；未提供的正文、外部原文均未核对。漏检必须引用原候选以外的页，且原问题与当前知识版本相同；过期要求不同引文，但不声称仅靠字面检查就能证明语义正确。
- 输入逐字段复用 `sanitizeRawInput`，然后序列化；清洗阻塞发生在领取付费尝试前。调用复用 `runRestrictedClaude` 的无工具、无 MCP、无会话持久化配置和单次预算参数。清洗是风险过滤，不是注入安全证明。
- `WorkflowStore` 继续作为任务去重、锁、尝试、费用和原子提交的唯一入口。知识或观察在调用期间变化，拒绝把结果采纳为当前诊断；缓存复用也在锁内核对。未知费用按预留额计入后续预算，超过预留的回执停止采纳并记录实际报告费用。
- 输入与回执在 `wiki/_jobs/coverage/`，哈希不符时拒绝复用。通用任务状态 `draft` 在这里表示诊断 JSON，不是 `_drafts/` 中的知识文章；账本不因此关闭。`wiki:work list` 同时返回原观察和版本绑定的诊断历史，历史分类不冒充当前版本结论。
- `scripts/wiki/workflow-run.ts` 现在复用 `isWikiStatePath`，让种子抽取与既有审阅、整合一样排除 `_gaps.json` 及其原子临时文件；私人提问不进入种子编译副本，持续提问也不使抽取基础校验失效。

## 本轮处理的问题

| 级别 / 位置 | 影响与复现 | 处理与证据 |
|---|---|---|
| P1 · `scripts/wiki/workflow-run.ts` | 有 `_gaps.json` 时执行种子抽取，副本会携带私人提问；抽取期间追加观察会被误认为知识内容变化 | `workflow-run.test.ts` 的 `keeps the gap ledger` 用例先失败，后通过；[红例日志](../../tools/wiki-runtime/coverage-seed-red.log)。这是上一轮未覆盖的抽取路径，本轮补齐。 |
| P2 · `server/coverage-work.ts` | 观察后更新正式页，再返回 `retrieval-miss`，初版错误接受历史漏检结论 | `historical retrieval` 用例先得到 `ok:true` 而失败，现要求同知识版本；[红例日志](../../tools/wiki-runtime/coverage-revision-red.log)。 |
| P1 · `server/coverage-work.ts` | 先 JSON 序列化再清洗，问题中的换行被转义，换行后的 `system:` 角色伪装未被过滤，会走到 runner | 逐字段清洗原始字符串再序列化；角色伪装在调用前阻塞，多行 HTML 注释删除仍保留有效引用；[红例日志](../../tools/wiki-runtime/coverage-screening-red.log)。 |

## 验证

- `pnpm exec vitest run server/coverage-work.test.ts scripts/wiki/workflow-run.test.ts scripts/wiki/work-cli.test.ts scripts/wiki/prepare-input.test.ts server/chat-session.test.ts`：**5 files / 29 tests passed**；[日志](../../tools/wiki-runtime/coverage-focused-final.log)。覆盖结果复用、矛盾和伪造证据、未知与超额费用、并发防重复、版本和观察变化、回执篡改、限额重试、清洗与种子隔离。模型均为固定输出，不冒充真实分类效果。
- 第一次 `pnpm check`：**3 failed / 553 passed**，失败均为 `prepare-input`、`chat-session` 的 5000ms 超时；保留 [首次日志](../../tools/wiki-runtime/coverage-check-first.log)。新增其余边界用例后的第二次运行 **6 failed / 553 passed**，保留 [第二次日志](../../tools/wiki-runtime/coverage-check-second.log)。未将失败日志覆盖或认作通过。
- `pnpm test --maxWorkers 1`：**66 files / 559 tests passed (103.85s)**；[日志](../../tools/wiki-runtime/coverage-test-serial.log)。这是一轮实际全量通过，不代表后续运行稳定。
- 暂将 Windows 默认改为单 worker 后再次运行 `pnpm check`：**2 failed / 556 passed，另有 1 worker error**；[日志](../../tools/wiki-runtime/coverage-check.log)。audit / lineage CLI 出现超时，workflow CLI 所在 worker 未正常初始化或终止，Vitest 报 `The child process was torn down or never initialized`。这反驳了“降低并发即可修复”的判断，因此撤回该配置尝试，保留原并发设置；没有通过放宽超时、删除断言或隐藏错误制造通过。**标准全量检查稳定性尚未解决，根因尚未确认**；不能声称本轮 `pnpm check` 全绿。类型检查与 lint 已在该命令进入测试前通过。
- 针对这三套 CLI 用例运行 `pnpm exec vitest run scripts/wiki/audit-cli.test.ts scripts/wiki/lineage-cli.test.ts scripts/wiki/workflow-cli.test.ts --maxWorkers 1`：**3 files / 7 tests passed (31.92s)**；[日志](../../tools/wiki-runtime/coverage-cli-recheck.log)。独立重跑通过不抵消上面的全量异常。
- `pnpm check:deps`、`pnpm check:content`、`pnpm wiki:lint`：全部 exit 0，**registry 19 页**；[日志](../../tools/wiki-runtime/coverage-content.log)。
- `pnpm build`：exit 0，**built in 19.04s**；[日志](../../tools/wiki-runtime/coverage-build.log)。既有 Vite native loader、构建耗时提示与 Biome schema 版本提示未屏蔽。
- `pnpm test:e2e tests/wiki.spec.ts tests/evidence.spec.ts tests/raw-source.spec.ts tests/wiki-review.spec.ts tests/wiki-reader.spec.ts --project chromium`：**28 passed (38.6s)**；[日志](../../tools/wiki-runtime/coverage-browser.log)。使用生产预览 4173，保留阅读、引用、保存、人审发布与三次缺口观察行为；[已目视复核截图](../../test-results/wiki-review-three-uncovere-98306-ssessment-without-compiling-chromium/gap-awaiting-assessment.png) 仍明确显示自动判定和补写尚未启动。HTTP / 模型 fixture 不冒充真实模型验证。
- `pnpm wiki:work list`：真实工作区输出 `{"gaps":[],"assessments":[],"worker":"assessment-only"}`；[日志](../../tools/wiki-runtime/coverage-cli.log)。测试没有灌入正式缺口账本。

## 使用与剩余范围

先运行 `pnpm wiki:work list` 取真实 key，再运行 `pnpm wiki:work assess --gap <key> --job-budget-usd <总额> --attempt-budget-usd <单次预留> --max-attempts <次数>`。每次至多调用一次，失败重试要显式加 `--retry-failed`。具体参数契约在 `scripts/wiki-work.ts`，本报告不另设默认预算。

限额绑定同一观察、知识版本和配方构成的任务，输入变化会创建新任务；**尚未实现跨任务、与问答共享的总预算**。问答不会自动判定，也没有补写 worker、外部证据寻找、检索修正、复问关闭。未判明不会被强行转成补写。真实模型能否稳定输出 JSON、正确理解范围与版本、给出语义成立的分类：**尚未验证**。

本轮新增模型费用 **0 美元**；历史四轮仍关闭，沿用已知 5.9398455 + 中断预留 0.50 = **6.4398455 美元**记账，不冒充账户实际扣款。没有修改正式知识页或导入材料。运行日志保存在忽略目录，仅作为本地证据。

下一步先定位全量测试的超时和 worker 异常，再用少量真实问题验证分类，随后接入来源准备与共用编译、人审和复问；自动模式开放前补齐共享预算。待用户决定：无；尚未解决的验证限制如上，不冒充完美验收。
