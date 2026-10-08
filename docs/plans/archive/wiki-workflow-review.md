# 持久任务与隔离提取验收

日期：2026-09-14，分支 `feat/llm-wiki`，工作树 `infra-view-new-llm-wiki`，未提交。此记录接续 [上一轮全 feature 核对](feature-progress-review.md)，不修改那份历史快照。

## 结论

本轮把 T1 的持久任务底座接入了真实 CLI 路径：seed 提取默认停在草稿，任务与尝试记录落盘，同证据复用，中断后明确失败并等待显式重试。每次 agent 在独立尝试副本中工作，写回前核对 attempt、原文件和产物指纹。它解决的是工作可靠性，**不代表问答回存、人审发布或新会话受益已经完成**。

当前规范与完成状态仍只在 [F004](../../features/F004-knowledge-loop.md) 与 [T1 计划](../knowledge-loop-plan.md) 维护。F001–F004 没有因此新增“全部 AC 完成”的 feature，批量导入仍暂停。

## 已接入的能力与证据

| 能力 | 实现位置 | 本轮验证 |
|---|---|---|
| 工作持久化与去重 | `scripts/wiki/workflow.ts` 的 jobSchema / enqueue | 来源、目标与编译配方决定工作 ID，origin 不参与去重；重复入口保留 origins。重新创建 store 后记录仍在。日期和同批其他 feature 不改变 seed 工作指纹。 |
| 显式重试与中断恢复 | 同文件 claim / recover；`scripts/wiki-jobs.ts` | running 记录持有 PID 与 attempt token。真实 Node 子进程领取后退出，recover 将它标成 failed，未启动 agent。活进程不被回收，failed 不会自动重试。 |
| 拒绝旧尝试写回与目标冲突 | workflow 的 finish / claim | 两个 store 同时领取只成功一个；不同任务的相同目标不能同时运行；旧 token 的 publish 回调调用数为零。编译期间锁外可以领取其他目标。 |
| 预算不清零 | `workflow-policy.ts`、attempts；`workflow-run.ts` | 每任务明确配置累计金额、单次额度、最大次数。尝试前预留，结束后记录实耗；未知费用仍占用预留。重开 store / 重试 / 重复提交不清零，超预算和超次数拒绝领取。 |
| CLI 执行额度 | `workflow-run.ts` 构造实际 agent argv | 本机 `claude --help` 实际显示 `--max-budget-usd`；seed adapter 测试断言每次调用收到该参数。未调用真实 agent，额度执行效果没有用付费请求复验。 |
| 隔离提取与原文保护 | `scripts/wiki/workflow-run.ts` | agent 失败、schema 错误、越界修改、原文件并发编辑、raw 不同内容覆盖均不替换原文件。成功时只写本任务草稿和 raw；已有 raw 只允许相同内容复用。 |
| 缓存与整合入口核对 | workflow 的 verifyDrafts；`wiki-ingest.ts` | 成功草稿 / raw 指纹变化后不返回缓存成功；有任务记录的草稿必须匹配成功 receipt 才能整合。成功整合后标 integrated，同证据无需重提取。旧草稿仍走既有 lint / 来源校验流程。 |
| 共用短时写锁 | `workflow.ts`、`integration-run.ts` | 提取发布和既有整合发布共用 workflow.lock；agent 编译不持锁。任务 JSON 原子替换；锁被占用时等待后报错，遗留锁不会被盲目抢走。 |

`_jobs/` 是任务状态的真相源，`_drafts/_failures.json` 只为已有参数和命令生成兼容投影，不增加另一份人工维护的状态。尝试历史和费用保存在 job，知识发布历史继续由既有整合写 `wiki/log.md`。

## 使用方式

以下只展示命令，本轮没有对真实源码执行提取。

```powershell
# 只读列出任务，不分配工作目录
pnpm wiki:jobs list

# 只恢复已退出进程的工作状态，不启动 agent
pnpm wiki:jobs recover

# 先看提取计划；dry-run 不要求预算，不落任务或产物
pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml --only <id> --dry-run

# 单页提取：明确配置每任务预算 / 单次额度 / 最多尝试次数
pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml --only <id> --job-budget-usd <金额> --attempt-budget-usd <金额> --max-attempts <次数>

# 重试时沿用同样的预算；已消耗及未知消耗不会被清零
pnpm wiki:ingest --seeds wiki/seeds/vllm-ascend.yaml --only <id> --retry-failed --job-budget-usd <原金额> --attempt-budget-usd <原金额> --max-attempts <原次数>
```

预算按每个任务分别计算，不是整个批次共享。默认 `--phase extract` 只产草稿；显式 `--phase integrate --only ...` 和 `--phase all` 暂保留既有整合能力，尚不是 F004 人审面板。

## 本轮命令证据

- 新 workflow / workflow-run 测试先因待实现模块缺失报错，再实现并验证；没有把 no-tests 输出算作通过。
- 接入后定向命令 `pnpm test scripts/wiki/workflow.test.ts scripts/wiki/workflow-run.test.ts scripts/wiki/persistent-extract.test.ts scripts/wiki/workflow-cli.test.ts scripts/wiki/ingest-cli.test.ts scripts/wiki/integration-run.test.ts`：6 个文件、26 项通过；之后补充预算预检及遗留锁用例，由全量检查覆盖。
- 全量首轮同时运行构建时，3 个 CLI 测试触发 5 秒超时；单独重跑仍有 1 项超时。`pnpm test --maxWorkers=4` 得到 42 个文件、408 项通过，因此给默认测试配置增加 4 worker 上限；没有调整超时或断言。
- `pnpm build`：exit 0，Vite `built in 5.59s`。
- 配置上限后默认 `pnpm check`：exit 0，42 个测试文件、408 项通过；typecheck、依赖、19 页内容和 wiki lint 通过，章节 Term 检查因尚无章节而跳过。lint 仍有既有 1 warning / 2 infos。
- 实际工作区 `pnpm wiki:jobs list` 输出 `[]`，没有真实任务被创建；27 个相关文档本地链接无断链，`git diff --check` 无空白错误，`git diff --exit-code -- wiki/raw` 通过。主工作树 status 与本轮开始时一致。
- 本轮没有前端改动，没有重新执行浏览器测试；之前的 17 项浏览器通过仍属于上一轮证据。没有真实 agent 编译或新的页面质量验收。

## 边界与剩余工作

1. **T1 仍不整体标完成。** 预算已约束 seed 提取和其重试；coverage、补料、整合等未来阶段尚未共用同一预算账本。当前没有全局预算或未知费用人工核销入口。
2. **未实现完整发布崩溃恢复。** 如果进程恰好在持锁时退出，系统保守报锁占用，需要核对 PID 与现场后处理；没有自动抢锁。如果在文件写回与 receipt 最终落盘之间中断，任务恢复为失败，整合入口拒绝把遗留文件当成功；T3 还需要发布 manifest 和完整恢复。
3. **本次 T1 验收时 raw 不覆盖已生效，但版本化原文导入未完成。** 相同 raw 可复用，不同内容会停止，不会为了重跑覆盖历史摘录。后续 2026-09-15 已补 seed 摘录快照与来源映射，见 [T2 快照验收](wiki-raw-review.md)；清洗仍待实施。当前校验不能证明原文语义或正文事实正确。
4. **旧 API 的范围明确。** `ingest.ts` 的旧 runExtractPhase 保留为兼容导出及旧用例入口；生产 CLI 使用 runPersistentExtract，不再在正式 wiki 目录启动提取 agent。不能把新入口验证推广成所有旧 API 都拥有相同隔离保证。
5. **下一个可交付节点**是 T2 的版本化不可变原文与来源映射，再接答案保存、待审 diff 和新会话复用。人审、隔离策略和自动维护的 AC 仍未勾选。

待用户决定的问题：无。本轮未导入、未提交、未合入主干。
