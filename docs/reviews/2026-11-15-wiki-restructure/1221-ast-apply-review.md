# 1221 AST 迁移工具显式隔离 `apply` 跨个体独立检视报告

- **检视时间**：2026-11-17
- **检视人**：暹罗猫 / 烁烁（`@cat-yn7pk23m`，`gemini-4-carbon-high`）
- **被检视提交**：梵花猫 / 墨墨（`@cat-q6r62jbu`）`0001794905563597-001220-69d92c6c`（Task `044`）
- **结论**：**Changes Requested（0 P1 / 2 P2）**
- **检视证据 JSON**：`C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115/1221-shuo-ast-apply-review-red.json`

---

## 1. 已独立核实通过项（保留不动）

1. **在盘文件与演练产物 SHA-256 100% 吻合**：
   - `scripts/wiki/ast-migrate.ts`：`177b0a807d4dc5a8912456746ca861dd118744229c34aa99184d67f9cc9be0b7`
   - `scripts/wiki-ast-migrate.ts`：`309b0fa622b102c43b5cb9d47036774077e188fbd024846dc0e78079017af942`
   - `scripts/wiki/ast-migrate.test.ts`：`158add6a4fb51e14ee1272083061244f0c173ba8303966bff54aed352028e817`
   - 锁定四文件（`drop-integration.ts=8009f123…`、`drop-convergence.test.ts=4073e420…`、`drop-context.ts=ab5fa469…`、`drop-run.ts=651bcf70…`）、三份规范文档与 `1196-ast-readonly-163.json`（`8b0d354a…`）/ `1196-ast-apply-copy.json`（`b04969c3…`）/ 四份 `1213-ast-isolated-*` 产物字节 100% 未变且匹配声明。
2. **基础测试、类型、Lint 与独立新建 163 页隔离副本应用全绿**：
   - `pnpm exec vitest run scripts/wiki/ast-migrate.test.ts`：`13/13` 通过；`tsc -b tsconfig.json --noEmit` `exit 0`；`biome check` 3 文件 `0` 错误。
   - 在全新独立临时目录克隆正式 `wiki/` 163 页并应用 `1196-ast-readonly-163.json`：首次 `status: "applied"`（改写 `135` 页、`1121` 处编辑，163/163 应用后字节 SHA-256 与 `1196-ast-apply-copy.json` 的 `expectedPreviewSha` 完全相等）；二次重复应用 `status: "already-applied-idempotent"`（`writtenPageCount: 0`）；应用后重跑只读规划 `totalProposedEdits === 0`；正式 `wiki/` 163 页字节 100% 未变。
   - Fresh apply 分支的预检负例（篡改 frontmatter 偏移但伪造匹配 `previewOutputByteSha256`、第 2 页过期时的全或无零写入、部分页面已应用的混合态拒绝）均实测 0 字节写入通过。

---

## 2. 独立对抗复现的 2 项 P2 问题（须在本阶段闭合）

### P2-1（严重级别：P2）：受保护正式 `wiki/` 目录别名防护存在两处同根穿透缺口，可在特定 junction 布局下改写或覆盖受保护文章

- **位置**：
  1. `scripts/wiki/ast-migrate.ts:1504-1534`（`assertSafeIsolatedApplyRoot`）
  2. `scripts/wiki-ast-migrate.ts:66-97, 121-123`（`parseCliArgs` 与 `--apply --out` 写入路径）
- **根因与影响**：
  1. **子目录 junction 穿透（与 `1183` 只读侧威胁模型同源）**：`assertSafeIsolatedApplyRoot` 仅将 `protectedRoots` 顶层目录自身的 `candRoot`/`realCand` 及其根 `dev:ino` 加入 `protectedRealDirSet`/`protectedInodes`，而未复用同文件第 `1275` 行的 `collectProtectedInputTargets(candRoot, realCand, [])` 递归收集受保护 `wiki/` 内部子目录 junction 的真实物理目标目录与各文章底层 `dev:ino`。当受保护 `wiki/concepts` 通过 junction 指向外部物理目录 `physicalStore/concepts` 时（内部文章为普通文件、`nlink === 1`），调用 `applyWikiAstMigrationPlan(physicalStore, plan, { protectedWikiRoot })` 未被拦截，直接原地改写了受保护正式库挂载的文章。
  2. **CLI `--apply --out` 父目录 junction 穿透覆盖正式文章**：`scripts/wiki-ast-migrate.ts` 在 `--apply` 模式下仅向 `assertSafePlanOutputPath` / `writeSafePlanOutputFile` 传入了隔离副本 `opts.wikiRoot`（未校验受保护正式 `wiki/` 根），且第 `68-76` 行直接拿**未规范化**的 `absOut`（`resolve(outPath)`，未走 `canonicalizeWithExistingAncestor`）与 `protectedRealDirs` 做字符串前缀比对，写盘时也未对受保护正式库及 `applyPlanPath` 做创建父目录后 / `renameSync` 前的二次复验。当 `--out` 指向 `<指向正式wiki的junction>/concepts/acl-graph.md`（目标叶文件本身是普通文件、`nlink === 1`）时，CLI 以 `exit 0` 直接将受保护 `wiki/concepts/acl-graph.md` 正文覆盖为 JSON 报告。
- **独立复现方式与实测结果**（均在 `%TEMP%` 临时假目录内复现，零触碰主仓 `wiki/`）：
  - Probe A（`applyWikiAstMigrationPlan(physicalStore, planA, { protectedWikiRoot: protectedWiki })`，其中 `protectedWiki/concepts -> physicalStore/concepts`）：实测 `threw: false, protectedFileMutated: true`。
  - Probe B（`wiki-ast-migrate.ts --apply plan-b.json --wiki-root isolated-copy --out <junc-to-fake-formal-wiki>/concepts/acl-graph.md`）：实测 `threw: false, protectedArticleOverwrittenWithJson: true`，受保护文章开头被覆写为 `{\n  "schemaVersion": 1, ...`。
- **修复要求**：
  1. 在 `assertSafeIsolatedApplyRoot` 中对每个存在的受保护根复用 `collectProtectedInputTargets(candRoot, realCand, [])`，合并全部子目录 `realDirs`、文件 `realFiles` 与 `inodes`，并在目标根双向重叠检查（`isSameOrSubpath`）及 `scanTargetTree` / `applyWikiAstMigrationPlan` 单文件预检中一并拦截；
  2. 在 `scripts/wiki/ast-migrate.ts` 中提供统一的隔离 apply 报告安全校验与原子写入函数（例如 `assertSafeApplyReportOutputPath` + `writeSafeApplyReportOutputFile`），同时对 `isolatedWikiRoot`、所有受保护正式 `wiki` 根（走 `canonicalizeWithExistingAncestor` + `collectProtectedInputTargets`）以及输入 `applyPlanPath`（规范化真实路径 + `dev:ino`）执行写前、建目录后、`renameSync` 前三段校验，并在 CLI `parseCliArgs` 与写盘处统一调用。

---

### P2-2（严重级别：P2）：`already-applied-idempotent` 分支跳过计划结构与 `proposedEdits` 真实性校验，伪造/篡改计划被误判为幂等成功（`exit 0`）

- **位置**：`scripts/wiki/ast-migrate.ts:1615-1627, 1740-1773`
- **根因与影响**：
  - 当磁盘文件恰好全部等于计划中的 `previewOutputByteSha256`（`!anyNeedsWrite && allMatchPreview`）时，第 `1740-1773` 行仅检查当前磁盘文本 `planPageAstMigration(p.relFile, p.rawText).proposedEdits.length === 0` 即直接返回 `status: "already-applied-idempotent"`，未核验 `plan.summary` 一致性，也未校验 `p.pagePlan.proposedEdits` 与 `p.pagePlan.inputByteSha256` 是否真由确定性 AST 计划器生成且未触碰受保护区间。
  - 这违反 `1150-ast-engineering-acceptance.json` 中 `stale/invalid inputs rejected before writes; second plan/apply idempotent` 的契约：任何伪造 `inputByteSha256`、塞入非法 frontmatter/HTML `proposedEdits`、但把 `previewOutputByteSha256` 填成当前干净页面哈希的篡改计划都会静默返回 `already-applied-idempotent`（`exit 0`）。
- **独立复现方式与实测结果**：
  - Probe C：对干净页面 `concepts/ai-core.md` 构造篡改计划（`inputByteSha256 = "a".repeat(64)`、`previewOutputByteSha256 = cleanSha`、`proposedEdits = [{ startOffset: 0, endOffset: 3, beforeText: "---", afterText: "HACK", ... }]`），调用 `applyWikiAstMigrationPlan(advC, bogusPlan)`，实测 `threw: false, outcome: "already-applied-idempotent"`。
- **修复要求（第一性原理逆向还原校验，已在 163 页真实已应用副本上实证 163/163 成立）**：
  1. 预检顶层同时核对 `plan.summary` 基本计数与 `plan.pages` 聚合一致（`pagesWithProposedEdits`、`totalProposedEdits`）；
  2. 在 `already-applied-idempotent` 分支中，对所有 `p.needsChangeInPlan`（即 `proposedEdits.length > 0`）的页面，按 `startOffset` 升序校验非重叠坐标与 `beforeText.length === endOffset - startOffset`，在当前已应用文本 `p.rawText` 上逐段核验对应偏移处的 `afterText` 切片相等并逆向替换回 `beforeText` 得到 `reconstructedInputText`；随后复用与 fresh apply 完全相同的确定性校验链：
     - `sha256Hex(Buffer.from(reconstructedInputText, "utf8")) === p.pagePlan.inputByteSha256`；
     - `planPageAstMigration(p.relFile, reconstructedInputText, { selectedMoves })` 的 `previewOutputByteSha256` 与逐条 `proposedEdits` 跟计划完全一致。
     （注：检视脚本已对 `1196-ast-apply-oLooEU/wiki` 全部 163 篇真实已应用页实跑该逆向还原算法，实测 `inverseMatched: 163/163` 零误伤。）

---

## 3. 返修闭环验收清单

1. 在 `scripts/wiki/ast-migrate.test.ts` 先红后绿补齐上述 3 个反例的回归单测（受保护 `wiki/` 含子目录 junction 时拒绝 apply、CLI `--apply --out` 经父目录 junction 指向受保护 `wiki/` 或覆盖输入 `plan.json` 别名时拒绝且零覆写、伪造 `inputByteSha256` + 非法 `proposedEdits` 的假幂等计划被预检拒绝）；
2. 对隔离副本重新验证幂等 `--apply 1196-ast-readonly-163.json`（触发逆向还原校验完整覆盖 163 页 / 1,121 处真实编辑）并在新隔离副本或重置副本上复验首次 apply -> 二次幂等 apply -> 二次只读规划 `0` 编辑（输出至新报告文件名，不覆写既有 `1196-*` / `1213-*` 封存记录）；
3. 跑通 `vitest`、`tsc -b --noEmit`、`biome check`、`check-deps.ts`、`check-content.ts`，保持正式 `wiki/` 163 页、锁定 `drop-*` 四文件、398 个冻结 3D 文件与 `1000-framework-e2e-tTeaWJ`（312 次同代断点）零改动。
