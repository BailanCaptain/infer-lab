# 覆盖分类真实样本与验证运行器记录

2026-09-15，`feat/llm-wiki` 的未提交工作区，位于 `infra-view-new-llm-wiki`。本轮继续处理上一轮的验证限制，再验证覆盖分类；不批量导入、不运行推理服务、不进行模型训练或性能基准。

**结论：** 已将验证运行器调整为区分单元与集成测试，并给诊断材料设置总量边界；真实模型暴露的“零命中被当成历史未知”已修正。最终同配方的五个固定对照都通过分类与逐字引文校验，但缺知识样本的自由文本理由仍有范围外推，不能称整段语义完美。正式知识页未增加，自动补写尚未开放。完整费用（含此前中断预留）累计按 **8.7527865 美元**记账，所有本轮付费任务已关闭。

## 运行器问题与取舍

上一轮日志的底层错误是 `spawn EPERM`：Vitest 的 fork worker 在启动阶段就失败，随后又在终止未初始化 worker 时报告异常。见 [原始日志](../../tools/wiki-runtime/coverage-check.log)。这和测试断言失败不同；不能仅凭表层的“Vitest bug”文字判断知识管线有问题，也不能把受影响用例算作已跑过。

本轮先执行 `pnpm test --pool threads`，**558 passed / 1 failed**，失败为 `wiki:work` CLI 用例的 5000ms 超时，未出现 worker 启动异常；见 [线程池对照](../../tools/wiki-runtime/foundation-threads-baseline.log)。恢复 tsx 默认缓存后的标准检查仍有一个 5000ms 集成用例超时，见 [对照日志](../../tools/wiki-runtime/foundation-runner-check.log)。之后仅降低线程并发也不足以解决集成用例的时间预算问题；该轮已出现失败后被主动停止，不能作为完整验收，见 [中止日志](../../tools/wiki-runtime/foundation-runner-final-check.log)。

核对代码后可确定的配置问题是：`scripts/wiki/test-fixture.ts` 启动的真实 CLI 最长允许 20000ms，普通测试的默认 5000ms 却同时覆盖 git 初始化、真实 CLI、fsync 和恢复过程。它们是功能集成测试，没有将磁盘与进程延迟定义为产品验收指标。最后采用以下配置，而非继续机械重试：

- `vitest.config.ts` 分为 `unit` 与 `wiki-integration` 两个项目；前者保留默认 5 秒，后者给予默认 30 秒，单项测试已有的显式时限仍保留。Windows 使用隔离线程和单 worker；其他平台保留 forks / 四个 worker。没有关闭隔离或用例内部的并发检验。
- CLI 仍是真实子进程，20 秒上限、非零退出码、原文不变性、并发锁和恢复断言继续生效；不将 CLI 改成 mock。夹具遇到 `spawnSync.error` 直接给出原始启动/执行错误，避免只留下难解释的 `status: null`。
- 去掉夹具强制设置的 `TSX_DISABLE_CACHE=1`，使用 tsx 默认缓存。已核对本机 `node_modules/tsx/dist/index-D1vYaNWZ.cjs`：转换缓存键包含源码、转换配置和 esbuild 版本，缓存的不是 wiki 文件内容或 CLI 结果。已有修改原文后复跑 CLI 的用例仍负责验证新数据可见性。

**取舍：** 本轮确实调整了集成测试的外层时间预算，不能沿用上一轮“所有超时不变”的表述。单纯“放宽所有测试就算过”不是这里的判准；实际 CLI 和内容断言必须通过，默认命令也必须重新运行。Windows `EPERM` 的具体系统来源尚未确认，没有修改系统安全设置。

## 固定分类样本

样本和期望唯一存于 [`coverage-eval-suite.json`](../../scripts/wiki/coverage-eval-suite.json)。五个对照分别为已有答案、故意漏召回、缺少所问资料、已正确描述的版本差异、无上下文的代词问题。保留 `num_speculative_tokens` 在 Block Table 页中的局部提及；问题要求的默认值与完整约束并未因此被覆盖。

输入是正式知识的隔离副本：**19 页**，revision 为 `f3273d374b05e2e154c12810a950605ec613b44e165b7ddbaabef233639bc368`。观察信号是合成对照，不能说成真实用户已连续问了三次。测试不把期望分类或评分依据发给模型；只发送正常判定器生成的材料。固定提示、代码 hash、原候选、预算见 [准备记录](../../tools/wiki-runtime/coverage-real-20260915/prepared.json)。

每个 slot 只允许一次调用、预留 0.30 美元，共 1.50 美元；复用既有 `runEvalCall` 的不可重置预算和付费回执。实际调用经过 `assessGap` 的 schema、逐字引文和版本校验；评测适配器检查唯一结果及无工具调用。尚无真实矛盾页的 `outdated` 正例，本轮不能据此宣布过期识别全部通过。

## 首次付费暴露的问题与修复

第一次调用使用原有上下文策略：10 个候选页、94043 个页面字符，stdin 共 101879 字符。实际模型为 `claude-opus-5[1m]`；CLI 回执还记录一次内部 Haiku 处理，最终费用 **0.818897 美元**，超过单次 0.30 预留，返回 `error_max_budget_usd`。文字分类及引文虽符合覆盖对照，调用已失败，程序没有采纳；**不能把它计为预算验收通过**。见 [实际回执](../../tools/wiki-runtime/coverage-real-20260915/covered.result.json)、[拒绝结果](../../tools/wiki-runtime/coverage-real-20260915/covered.assessment.json)。

发现后立即停止余下调用并关闭该轮，[关闭记录](../../tools/wiki-runtime/coverage-real-20260915/closed.json) 保留全部已知费用；未修改或重置其预算。CLI 的预算标志会在一次请求结束后才报告超额，因此它不是供应商账单硬上限。这是实际发现的产品边界，不再用“每次绝不会超过预留”描述它。

本轮处理的具体问题：

| 级别 / 位置 | 影响与复现 | 修复与证据 |
|---|---|---|
| P2 · `server/coverage-work.ts` | 一个简单默认值问题带入近十万字符候选材料，诊断成本过高；超长问题也可走到付费 runner | `COVERAGE_CONTEXT_LIMITS` 统一约束候选数量、正文摘录、索引和整体材料；剥离重复 frontmatter，显式标记截断。新用例先失败再通过：[红例](../../tools/wiki-runtime/coverage-context-red.log)、[通过](../../tools/wiki-runtime/coverage-context-green.log)。省略材料可能使部分问题保持未判明，这是明示的取舍，不强行转成补写。 |
| P2 · `scripts/wiki/workflow.ts` | 真实调用同时返回 `exit 1` 和超额费用时，失败原因只显示退出码，隐藏预算超额的直接原因 | 仍记录原退出错误，同时优先显示超过预留；金额照实记账，禁止超额后越过剩余预算重试。先红后绿：[红例](../../tools/wiki-runtime/coverage-budget-red.log)、[相关 24 项通过](../../tools/wiki-runtime/coverage-small-green.log)。 |

缩小后的配方另开独立轮次，原样保留五个问题及期望；新知识 revision 因 HANDBOOK 增加截断规则变为 `50644bf43bcc32e1768a989e55ca4b6dfa7559213cf2f921588763fd66916b14`。每个 slot 预留 0.40 美元，共 2.00 美元；加上既有费用与中断预留，分配时总预留为 **9.2587425 美元**。每次检查费用后再执行下一例，未知或超额即停止；[新准备记录](../../tools/wiki-runtime/coverage-real-20260915-small/prepared.json)。不是重置旧失败或扩大旧任务额度。

首个相同问题的新输入仅 3 个正文摘录、9000 个页面字符，stdin 14966 字符；真实分类 `covered` 与原文引文通过，实际费用 **0.154528 美元**，同模型。这里只比较两次调用的实际回执，不把它推广为固定价格或整体性能基准。

F004 AC3 仍需自动排队、与问答共享预算、证据准备、补写、人审和复问关闭，不能因分类样本通过就勾选完成。

## 最终分类结果与人工复核

小上下文首轮为 **4/5 分类匹配**；漏检样本的真实输出是 `covered`，理由将空原候选解释成“未知历史”，保留在 [失败对照](../../tools/wiki-runtime/coverage-real-20260915-small/retrieval-miss.assessment.json)。没有修改题目或预期来制造通过。

已核对 `server/chat-route.ts`：原候选是当轮 `retrieve()` 的实际完整输出，空数组就是零命中。现在输入显式携带 `originalCandidatesRecorded=true`；HANDBOOK 说明它的含义，程序拒绝“同版本、原零命中、当前已覆盖”仍只返回 `covered` 的矛盾组合。这是对已知检索历史的约束，是否有足够知识仍由模型依据正文判断。固定输出回归 [先失败](../../tools/wiki-runtime/coverage-zero-hit-red.log)，然后 [25 项相关测试通过](../../tools/wiki-runtime/coverage-zero-hit-green.log)。

修正后专项重验漏检，再以相同最终配方重验其余四例，避免拼接不同提示版本的通过记录。实际核对两份准备记录的 `revision` 与 `codeHashes` 完全相同；知识 revision 为 `113299303ff3935674b4e00bbbada2fefb746c5a2914e3a493a6d6ccbb4be839`，实际模型均为 `claude-opus-5[1m]`，每次请求使用同一无工具配置和 0.40 美元预留。

| 固定问题 | 最终分类 / 引文校验 | 人工复核与边界 | 回执 |
|---|---|---|---|
| v0.23.0 默认值 | `covered`，通过 | 引用明确写出默认 False 与 commit，理由覆盖所问范围 | [结果](../../tools/wiki-runtime/coverage-real-20260915-final/covered.assessment.json) |
| 原检索故意零命中 | `retrieval-miss`，通过 | 明确区分零命中与无历史；同版本已有页，未写重复文章 | [结果](../../tools/wiki-runtime/coverage-real-20260915-zero-hit/retrieval-miss.assessment.json) |
| num_speculative_tokens 默认值与约束 | `missing-knowledge`，通过 | **理由不完全通过严格范围审查**：虽注明只针对给定材料，仍写了“即使补齐也不构成定义页”和“需要新增页面”，这些不能由未读正文推出；本轮不据此自动补写，需先找来源并核对现有页 | [结果](../../tools/wiki-runtime/coverage-real-20260915-final/missing.assessment.json) |
| main 是否还能启用已删除开关 | `covered`，通过 | 正确保留版本与 commit 边界，没有因页内有两版差异就判过期 | [结果](../../tools/wiki-runtime/coverage-real-20260915-final/version-covered.assessment.json) |
| “它现在默认开着吗？” | `undetermined`，通过 | 正确要求具体指代与版本，没有把零命中当成缺知识 | [结果](../../tools/wiki-runtime/coverage-real-20260915-final/ambiguous.assessment.json) |

所以 **5/5 指分类与引文结构通过，不代表自由文本理由全部成立**。这些 JSON 都是有版本边界的待核对诊断，未成为正式知识页，也未关闭缺口。真实过期正例、更复杂追问和端到端复问关闭仍未验收。

## 费用与关闭

| 本轮阶段 | 实际调用数 | 已知费用 USD | 状态 |
|---|---:|---:|---|
| 大上下文首次失败 | 1 | 0.818897 | 超额拒绝采纳，余下调用取消 |
| 小上下文五例 | 5 | 0.747130 | 保留一次漏检分类失败 |
| 零命中专项重验 | 1 | 0.159598 | 通过并关闭 |
| 最终配方其余四例 | 4 | 0.587316 | 分类与引文通过并关闭 |
| 本轮合计 | 11 | **2.312941** | 无新增未知费用 |

此前已知 5.9398455 + 此次 2.312941 + 仍保留的历史未知预留 0.50 = **8.7527865 美元**。这不是账户账单核销；使用的是本机 CLI 回执。所有轮次均已关闭：[首次](../../tools/wiki-runtime/coverage-real-20260915/closed.json)、[小上下文](../../tools/wiki-runtime/coverage-real-20260915-small/closed.json)、[专项](../../tools/wiki-runtime/coverage-real-20260915-zero-hit/closed.json)、[最终回归](../../tools/wiki-runtime/coverage-real-20260915-final/closed.json)，不继续消费剩余额度。

## 最终工程验证

- 调整运行器后的 `pnpm check`：**66 files / 559 tests passed (136.44s)**，包含类型检查、Lint、依赖方向、19 页内容检查与 wiki lint；[日志](../../tools/wiki-runtime/foundation-integration-check.log)。后续因真实验收发现上下文与分类边界问题新增测试，再跑最终标准命令。
- 最终 `pnpm check`：**66 files / 563 tests passed (73.44s)**，完整命令 exit 0；[日志](../../tools/wiki-runtime/classification-final-check.log)。未设置自动重试、未取消隔离或功能断言；集成测试时间预算的调整及其理由已在前文明示。
- 最终 `pnpm build`：exit 0，**built in 2.86s**；[日志](../../tools/wiki-runtime/classification-final-build.log)。既有 Vite native loader 与 Biome schema 提示保留，不冒充已消除所有警告。
- `pnpm test:e2e tests/wiki.spec.ts tests/evidence.spec.ts tests/raw-source.spec.ts tests/wiki-review.spec.ts tests/wiki-reader.spec.ts --project chromium`：生产预览 4173 上 **28 passed (29.5s)**；[日志](../../tools/wiki-runtime/classification-final-browser.log)。阅读、证据、保存、人审发布与三次缺口记录均通过；[实际截图](../../test-results/wiki-review-three-uncovere-98306-ssessment-without-compiling-chromium/gap-awaiting-assessment.png) 已目视复核，仍明确提示自动判定和补写尚未启动。

整体仍是 **0/4 feature 完整交付**。下一步应先将诊断理由的范围约束和共享预算补齐，再接来源准备、共用编译、人审与复问关闭；诊断结果本身不是已积累的新知识。待用户决定：无。
