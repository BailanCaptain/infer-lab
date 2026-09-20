# 审阅与发布基础验收（2026-09-15）

本轮在 `infra-view-new-llm-wiki` 工作树推进 T3。**整合现在只生成待审包；正式内容经固定 revision 批准后才发布。** 这符合人工策展、原文不可变与增量维护的方向，但不能据此声称“越用越聪明”的用户闭环已完成。当前进度只维护在 [F004](../../features/F004-knowledge-loop.md#design-decisions)，本文件保留实际验证证据。

## 为什么改

| 严重级别、位置 | 影响与复现 | 本轮处理 |
|---|---|---|
| P1 · `scripts/wiki/integration-run.ts:94` | 原代码隔离校验后直接写正式页。新增 `does not publish` 测试实际失败：正式正文从 A 变成 proposal，未经人工批准 | 改为持久待审包；提案生成后正式页、日志与原草稿保持原状 |
| P2 · `scripts/wiki/ingest.ts` 的晋升目录 | `type: source` 草稿无法晋升。真实临时 fixture 报 `promoted a 但 concepts / params 下都没有 a.md` | 晋升、agent 编辑权限与写入范围复用 `PAGE_DIRS`，包括 sources |
| P2 · `scripts/wiki/review.ts:124` | agent 可以改掉现有脚本版本谱系。新增 `generated lineage` 测试实际失败：提案被接受 | 共用 lineage 模块的节标题与读取函数，提案阶段拒绝改写或删除既有版本节 |
| P2 · 新发布器在校验与写入之间 | 只在校验前检查 base 会漏掉校验期间的人工来源修改。`rechecks source` 红例实际发布成功 | 校验后、写入前再核对全部 base；写后核对候选与其他基础文件 |
| P2 · `scripts/wiki/review-files.ts:32` | 普通覆盖写可覆盖已占用的快照地址。`occupied immutable` 红例没有抛错并覆盖原文件 | 快照写入复用 `saveRawSnapshot` 的不可覆盖发布；保留冲突字节并报 hash 错误 |

## 已验证的行为

- `scripts/wiki/review.ts:33,68,124`：单一 schema，完整候选指纹与基础文件指纹；待审记录位于 `_jobs/reviews/<revision>.json`，不混进原始材料或 agent 副本。payload 被改后不能沿用原 revision。
- `scripts/wiki/review.ts:187`、`scripts/wiki/review.test.ts:91`：CLI 输出新增页、更新邻居、派生索引、日志和草稿处置的 diff。批准后从一条声明关系派生邻居反向边，不双写关系。
- `scripts/wiki/review.ts:226`、`scripts/wiki/review.test.ts:103`：批准重新运行 lint、本地证据审计与 build，派生内容必须等于已审候选；真实临时 CLI fixture 跑通 `show` / `approve`，状态与草稿处置一致。测试 agent 返回固定 Markdown，没有真实模型调用。
- `scripts/wiki/review.ts:267`：驳回保留原因及原草稿；同 revision 不可再批准。原文、其他页或关联工作记录改变时拒绝批准，保留人工修改。重复批准不重复写日志。
- `scripts/wiki/review.test.ts:177`：**真实 Node 子进程在正式页写入后 `process.exit(73)`，跳过 finally 并遗留工作锁**；重新启动 `wiki-review recover` 核对死进程、续写原批准内容，任务最终 integrated，日志只有一次。没有把抛异常后正常清理等同于进程中断。
- `scripts/wiki/workflow.ts:118`：显式恢复核对持锁 PID；存活进程拒绝清理。恢复命令不能批准 pending 提案。恢复期间遇到既非原文也非候选的文件会报冲突，保留现场。

## 本轮命令与关键输出

```text
pnpm check
  Test Files 49 passed (49)
  Tests      463 passed (463)
  ok 依赖方向检查通过
  ok 内容校验：registry 19 页
  ok 内容校验：尚无章节，Term 引用检查跳过
  ok wiki:lint 通过
```

命令 exit 0；typecheck / Biome 包含在 check 中。既有 CSS 1 warning、Biome 配置 2 infos 保留。早先的全量运行发现晋升权限测试仍断言两种目录，已按新增 source 用例更新为明确的三种目录；最终全量全绿，没有删断言。

`pnpm wiki:review --help` exit 0；`pnpm wiki:review list` 和 `pnpm wiki:jobs list` 均输出 `[]`。`git diff --check`、`git diff --exit-code -- wiki/raw` 均 exit 0。本轮没有生成真实任务、待审包、raw 或正式知识页，没有启动付费 agent、批量导入、同步或计划任务。

`pnpm build` exit 0，`4893 modules transformed`、`built in 2.40s`。

## 使用入口

先用现有显式整合命令生成待审包，返回 revision；`--phase all` 同样停在待审，不自动批准。实际整合会调用 agent，本轮没有对真实库执行。

```powershell
pnpm wiki:review list
pnpm wiki:review show <revision>
pnpm wiki:review approve <revision>
pnpm wiki:review reject <revision> --reason "证据不足"
# 只在已经批准的发布中断后使用，不启动 agent
pnpm wiki:review recover <revision>
```

## 取舍与剩余工作

1. CLI 地基已验收；HTTP / 浏览器审阅、聊天保存和跨会话复用仍未实施。本轮没有前端变更，未跑浏览器，不以以前的浏览器结果替代本轮证据。
2. 不保证多文件对读者原子可见，也不声称断电恢复。恢复沿用同一批准内容；冲突现场和损坏的恢复锁需人工核对。保留 manifest 中的原始草稿与前后字节，不为恢复覆盖第三方编辑。
3. 现有版本节受保护，但脚本产生的新版本节尚未纳入待审 diff；`lineage:apply` 仍是独立维护命令。不得把保护旧版本节算成版本更新闭环完成。
4. 矛盾结论的语义识别、废弃节留痕及反例验收仍待 T3 后续实施。当前人工通过完整 diff 审阅；源码行存在和 raw hash 正确不证明事实解释正确。URL 来源仍按现有规则列为未核验，不伪称联网核实。
5. 跨阶段 agent 预算、产品入口和定期任务均未由本轮补齐；T3、F001 AC8 与 F004 全部 AC 保持未完成。下一步补结论留痕与共享审阅 API，再接聊天保存，最后用独立新会话检验积累是否有用。

待用户决定的问题：无。
