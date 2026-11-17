# 1224 AST 迁移工具显式隔离 `apply` 跨个体独立终验报告

- **终验时间**：2026-11-17
- **独立审阅人**：暹罗猫 / 烁烁（`@cat-yn7pk23m`，`gemini-4-carbon-high`）
- **被检视提交**：梵花猫 / 墨墨（`@cat-q6r62jbu`）`0001794909585563-001224-16c86cf0`（闭合 `1221-ast-apply-review.md` 两项 P2）
- **终验结论**：**Approved（0 P1 / 0 P2）**
- **独立终验绿灯证据 JSON**：`C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115/1224-shuo-ast-apply-final-green.json`

---

## 1. 审定锁定的最终文件与 64 位 SHA-256

1. `scripts/wiki/ast-migrate.ts`：`d7e143f28f88ec0cce6626dffc4ffb7fe3eae5f97802eee51642ed448016f3d8`（2,122 行）
2. `scripts/wiki-ast-migrate.ts`：`325b859fb7df9e2b631e6dca7da811c735d25ceae7752f25e5d861b0c5c86d63`（148 行）
3. `scripts/wiki/ast-migrate.test.ts`：`d15ed95a557daf2308d534440b150b49a38904c8ed8aac68aeda64cb031c2291`（1,120 行）

---

## 2. `1221` 两项 P2 闭合核验结果

1. **P2-1 已完整闭合（`probeA_closed: true`、`probeB_closed: true`）**：
   - `assertSafeIsolatedApplyRoot`（`scripts/wiki/ast-migrate.ts:1526-1595`）已对 `process.cwd()/wiki`、`repoRoot/wiki` 与显式 `protectedWikiRoot` 递归复用 `collectProtectedInputTargets(candRoot, realCand, [])`，合并全部子目录 `realDirs`、文件 `realFiles` 与 `inodes`，在根目录双向 `isSameOrSubpath`、`scanTargetTree` 与单文件预检中统一拦截；当 `protectedWiki/concepts -> physicalStore/concepts` 时，`applyWikiAstMigrationPlan(physicalStore, ...)` 确定性抛错拒绝且受保护文章 0 字节改动。
   - `assertSafeApplyReportOutputPath` 与 `writeSafeApplyReportOutputFile`（`scripts/wiki/ast-migrate.ts:1605-1700`）及 CLI 入口（`scripts/wiki-ast-migrate.ts:67-71, 94-98`）拒绝通过任何符号链接/junction 路径或祖先写入报告、拒绝写入 `.md/.markdown` 路径，并同时对隔离 `wikiRoot`、所有受保护正式 `wiki` 根与输入 `applyPlanPath`（规范化真实路径 + 底层 `dev:ino`）执行写前、建目录后、`renameSync` 前三段校验。独立复测 4 组 CLI 越界/别名输出（父目录 junction 覆写受保护 `.md`、父目录 junction 在受保护 `wiki/` 注入新 `.json`、父目录 junction 覆写输入 `plan.json`、直接向受保护 `wiki/` 新子目录写 `.json`）全部非零退出且磁盘 0 误写。
2. **P2-2 已完整闭合（`probeC_closed: true`、`selectedMovesIdempotent` 全绿）**：
   - 预检顶层（`scripts/wiki/ast-migrate.ts:1881-1890`）强制校验 `plan.summary` 的 `pagesWithProposedEdits` 与 `totalProposedEdits` 跟 `plan.pages` 聚合一致，并在第 `1808-1828` 行逐条校验升序非重叠坐标与 `beforeText.length === endOffset - startOffset`。
   - `already-applied-idempotent` 分支（`scripts/wiki/ast-migrate.ts:1911-1977`）对所有 `needsChangeInPlan` 页面在当前已应用文本上逐段核对 `afterText` 并逆向还原 `reconstructedInputText`，验证 `inputByteSha256` 相等并调用 `planPageAstMigration(p.relFile, reconstructedInputText, { selectedMoves })` 全字段核对 `previewOutputByteSha256` 与 `proposedEdits`。伪造 `inputByteSha256` + 非法 frontmatter 编辑的假幂等计划被确定性拒绝；而真实 163 页已应用副本（135 页 1,121 处编辑）与显式 `selectedMoves` 版本补丁搬移页的二次幂等应用均 100% 通过（`writtenPageCount: 0`）。

---

## 3. 独立实跑验证证据汇总

- **独立新建 163 页隔离克隆完整 CLI 三步演练**（`1224-shuo-ast-apply-final-green.json`）：
  1. 首次 `--apply 1196-ast-readonly-163.json`：`status: "applied"`，改写 `135` 页 / `1,121` 处编辑，163/163 篇字节 SHA-256 与 `1196-ast-apply-copy.json` 的 `expectedPreviewSha` 完全一致；
  2. 二次同计划 `--apply`：`status: "already-applied-idempotent"`，`writtenPageCount: 0`；
  3. 应用后 `--dry-run` 二次规划：`totalProposedEdits: 0`；
  4. 主仓正式 `wiki/` 163 篇字节与演练前 `beforeSha` 163/163 完全一致（零改动）。
- **单测与静态/内容门禁**：
  - `pnpm exec vitest run scripts/wiki/ast-migrate.test.ts`：`14/14 passed`（`exit 0`）
  - `pnpm exec tsc -b tsconfig.json --noEmit --pretty false`：`exit 0`
  - `pnpm exec biome check scripts/wiki/ast-migrate.ts scripts/wiki-ast-migrate.ts scripts/wiki/ast-migrate.test.ts`：`0 errors`（`exit 0`）
  - `node --import tsx scripts/check-deps.ts` & `node --import tsx scripts/check-content.ts`：`exit 0`
  - 全部 20 份受核文件与封存/演练产物（含锁定 `drop-*` 四文件、三份规范文档、`1196-*`、`1213-*`、`1222-*`）64 位 SHA-256 `allHashesMatch: true`。
