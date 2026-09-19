# 预算暂停恢复与真实验收准备（2026-09-16）

> 用户后来已扩额至累计 $30 以下，完成参数页批准发布及六题前后测。当前结果见 [扩额与真实对照](wiki-budget-30-review.md)；原 $10 阶段失败见 [历史停点](wiki-real-baseline-review.md)。下文金额、首题和未执行描述均为历史记录，不代表当前可用额度。

用户要求继续推进，已补齐原先仅有 status / init、没有恢复入口的预算流程。后续用户明确回复“同意”，已保留全部旧预留恢复并完成第一道真实前测；不再重复要求批准该恢复口径。以下工程测试记录保留，最新执行见末节。

## 已实现

- `scripts/wiki/budget.ts`：只读 `planBudgetResume` 与有留痕的 `resumeBudget`；`scripts/wiki-budget.ts` 接入 `resume --preview` 和指定方案批准。
- 保留 policy、所有 calls、旧费用和未知预留；未知费用仍无 costUsd，不伪装实际扣费已知。原账本追加恢复方案指纹、旧状态指纹、时间、批准理由及未知调用 ID。
- 精确状态绑定防止批准后其他调用改变账目；重复应用旧批准不改后续暂停。运行中的调用、总额度耗尽、次数耗尽均拒绝恢复。新调用仍经过原有预算检查，发生新的未知费用或超额仍暂停。
- 实际生产仅运行了只读预览，未执行恢复、未调用模型。旧 $0.50 保留在 priorChargedUsd 内，最新 $0.15 保留在 unknown 调用中，合计占用仍为 $8.9027865，累计上限 $10。

## 验证

预算回归先红后绿：`budget-resume-red.log` 2 failed / 7 passed；实现后 `budget-resume-green.log` 9 passed。追加真实 CLI 临时目录回归后，`budget-resume-cli-green.log` 2 文件 / 10 项通过；覆盖预览不写、缺批准参数拒绝、旧批准不能解除新暂停、保留预留和次数/总额约束。测试均使用临时账本和固定输出，没有真实收费。

生产预览 `tools/wiki-runtime/budget-resume-preview.log`：方案 `1fa009e5b1073700c15691ea43e3f4c8078412e02f6e5a98545e1b8323532766`，remainingUsd≈1.0972135、remainingCalls=7。方案只绑定当前状态，不承诺后续仍有效。

最终 `pnpm check` 退出 0：93 文件 / 644 项测试通过，166.20s，类型检查、Lint、依赖、内容和 Wiki lint 均通过；保留既有 1 warning / 2 infos。设置 WIKI_PYTHON 为同步配置中的 Python 3.12 路径，日志 `tools/wiki-runtime/budget-resume-check.log`。`pnpm build` 通过（3.91s，`budget-resume-build.log`）。本轮仅 CLI / 预算逻辑改动，无前端交互改动。

更新 HANDBOOK 后重新执行 `pnpm wiki:eval --phase before`，6 项固定来源验证通过，19 页快照准备完成；suiteRevision=d8fde337… 保持，knowledgeRevision=fbdf0fa7…，日志 `budget-resume-eval-precheck.log`。前后真实回答仍未运行。生产账本依然 paused、calls=1、占用 $8.9027865；先前批准的显存修订内容未变。34 条 AC 无遗漏、84 个已检查本地链接无断链，`git diff --check` 无空白错误。

## 实际接续限制

原六场景协议要求前后各六个独立会话，仅问答就需 12 次，还未计编译和整合；生产 worker 的四类独立问题也需至少 8 次前后问答。恢复时原账本只剩 7 次，因此仅解除暂停无法保证完整跑完任一协议。不改判准、不合并问题冒充独立会话、不扩大 maxCalls 或累计额度；本次先执行一道前测，其余阶段保留。真实语义效果仍未验收，三项批量工作不启动。

## 用户批准后实际执行

- 恢复命令成功，原批准方案 `1fa009e5…` 未变化，UTC 2026-09-16 15:14:29 追加批准依据；日志 `tools/wiki-runtime/budget-resume-applied.log`。原 $0.65 未知预留完整保留。
- 既定六场景的第一题 `chunk-constraints` 已在独立 claude-sonnet-4-6 会话完成前测。问题、判准与知识快照分别冻结在 `tools/wiki-runtime/eval-20260916-resume/`，判准未进入模型请求或知识快照。通过原 `buildChatRequest` 和 `runEvalCall` 执行，仅允许本地快照读取；外层 `withBudget` 使用生产共享账本，未另开总额度。
- 回答明确表示本库没有 profiling_chunk_config 资料，三个条件均无证据可答。这是缺口的真实前测，不是补知识后改善通过。审阅时曾误称回答末尾建议的 `pnpm wiki:work prepare` 不存在；随后检查 `scripts/wiki-work.ts:58–76` 确认该命令存在，需要已有诊断 job，已撤回误判。不能把未检查的印象当作回答缺陷。
- 唯一成功回执 costUsd=$0.1204127。共享预算占用约 $9.0231992、剩约 $0.9768008、calls=2、paused=false；历史未知调用仍 unknown。前测完成 1/6、后测 0/6，尚未补写或发布该主题。
- 证据：`tools/wiki-runtime/resume-baseline-first.log`、`eval-20260916-resume/before-chunk-constraints.result.json`、同名前缀的 `.events.jsonl` / `.summary.json`。脚本 `resume-baseline.mjs` 每次显式指定一个既定 case，缓存结果不重复调用模型。
