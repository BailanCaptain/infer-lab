# 1179 补读协商帧预算修复独立终验（001204）

2026-11-17 08:05 UTC，结论：**Approved，0 P1 / 0 P2（仅限 `1179` 补读协商帧预算子批）**。

依据大当家 `0001794892173999-001188-386a6b2e` 与 `0001794901952471-001208-75bdba3a` 条件接力安排（砚砚在 `001205` 触发额度上限无法继续，烁烁在 `001204` 提交但尚未签收的 `1179` 修复由未参与该改动的墨墨独立复核，禁止自签），对 `001204` 交付代码、单测与第 312 次真实隔离批次克隆探针进行了完整独立复验。

## 1. 审定文件与锁定文件 SHA-256 核对

| 文件 | 行数 | SHA-256 | 核验状态 |
| --- | --- | --- | --- |
| `scripts/wiki/drop-integration.ts` | `4738` | `8009f123525d481b8840f8ede7f87bd989a0cfa73f286e2a160bf58a129415dd` | 与 `001204` 交付完全一致 |
| `scripts/wiki/drop-convergence.test.ts` | `2846` | `4073e4209bbf1eb1973a4710f9612411c92a9974d49fc162b03d226d00414ecc` | 与 `001204` 交付完全一致 |
| `scripts/wiki/drop-context.ts` | — | `ab5fa469d0995e99a3c4ac0ae6a4c44d218eefd8e5100cee121babb8f3c052ab` | 锁定未变 |
| `scripts/wiki/drop-run.ts` | — | `651bcf7015b385901a102891c7fbb76576457aab422561b95835d81e8cd3e022` | 锁定未变 |
| `scripts/wiki/ast-migrate.ts` | — | `dcb17b3d4ba4efbeb0e91c3cef7484ce407fb60974fe1f681a068c689a8eab7f` | 锁定未变 |
| `scripts/wiki-ast-migrate.ts` | — | `7dbdc04a557a750afd1e487f7d40476c4d41669f607783d977b1b783f7d59afc` | 锁定未变 |
| `scripts/wiki/ast-migrate.test.ts` | — | `1c416bf6746b8ccd49a9cdbf89af1ee8d0da41a7083b75ceefd8b94b02b754a6` | 锁定未变 |

## 2. 代码实现独立审查（`scripts/wiki/drop-integration.ts:809-949, 1902-1964, 2489-2875`）

1. **双协议预算解耦与 `stdin` 修复包络同构核算**：
   - `serializedStdinBytes(stage, data)`（`L878-L880`）通过 `withStageRepairEnvelope`（`L855-L877`）与 `drop-run.ts:applyStageRepair` 保持完全同构；
   - `buildNegotiate`（`L2489-L2875`）将当前协商轮协议预算 `negLimit`（`25,721B`）与下一轮正常证据帧协议预算 `nextEvidenceLimit`（`26,424B`）严格分开，通过 `buildActualNextTurnFrame` 直接按下一轮真实序列化帧计算 `availableExtraBytes`（在 312 断点实测为 `2,319B`）并在 UTF-16 代码点安全边界上二分求取 `fitExecutablePrefix`（`L2758-L2830`），移除了固定 `navReserve`、`fitMargin`、`/ 3` 等失真估算退路。
2. **可恢复导航/协商元信息确定性分页与必需证据保护**：
   - `fitNonDiscoverFrame`（`L881-L949`）与 `fitTightDiscoverFrame`（`L1902-L1954`）仅在帧超出目标上限时依次对 `inventory`、未显式请求的 `plan`（保留 `planTotal` / `navigation.plansTotal`）、未显式请求的 `read`（保留 `readTotal`）、`activeResources` 冗余字段及 `budgetRequest` 元信息做确定性分页与压缩；
   - 系统规则、完整 `notes`（`5,464B`）、全部必需 `materials`（`11,692B`）、`target`、`range`、`uninspectedRanges`、`suggestedBatch` 以及“尚未提供，不得跳过未核原文直接给结论”硬约束 100% 原样保留。
3. **历史缓存零重跑兼容**：
   - `buildPre1179CachedNeg`（`L2217-L2488`）仅用于只读历史缓存键匹配，确保前 312 次调用记录、旧缓存与 generation 1 100% 命中且不用于新协商帧生成。

## 3. 独立运行验证证据

1. **第 312 次真实隔离批次零模型克隆探针独立复跑**：
   - 命令：`node --import tsx C:/Users/-/AppData/Local/Temp/infra-wiki-review-20261115/1179-budget-negotiation-probe.mts 1208-momo-independent-negotiation-green.json`（`task-3630`，**`exit 0`**）
   - 独立产物：`%TEMP%/infra-wiki-review-20261115/1208-momo-independent-negotiation-green.json`（原 `1179-negotiation-red.json` 与 `1200-author-negotiation-green-r4.json` 保持未改）
   - 8 项检查全绿（`allPassed: true`，`providerCalls: 0`）：
     - `executableNegotiation: true`：首个新协商帧实测 **`25,569B <= 25,721B`**，`availableExtraBytes = 2,319`，产出可执行 `suggestedBatch`（`candidate:concepts/chunked-prefill.md [8318, 8563)` 与 `source:raw/sha256-0370306f... [9500, 10099)`）；
     - `nextFrameLoadsSuggestedEvidence: true`：按 `suggestedBatch` 请求的下一正常证据帧实测 **`26,112B <= 26,424B`**，`negotiation: null`，完整装入两段建议原文及原有全部必需 `materials`（`[10896, 15807)` 与 `[7936, 8318)`）与 `notes`；
     - `allSentFramesWithinBudget: true`、`notesAndRequiredPreserved: true`、`all312CallsPreserved: true`、`oldCacheUnchanged: true`、`originalTreeUnchanged: true`、`sameGeneration: true`（`generation = 1`）。
2. **收敛单测套件独立运行**：
   - 命令：`vitest run scripts/wiki/drop-convergence.test.ts`（`task-3624`，**`exit 0`**）
   - 结果：**`1 passed (1)` / `15 passed (15)`**（耗时 `28.36s`，含新增 `1179 tight-budget negotiation frame & executable next-frame suggestion` 用例通过）。

## 4. 结论与后续衔接

`1179-negotiation-frame-budget-review.md` 的唯一 P2 已闭合，正式签署 **Approved（0 P1 / 0 P2）**。按大当家 `001208` 条件接力安排，由 `@烁烁` 统筹下一棒（检查 312 断点真实样本续跑及派发 AST 隔离副本 `apply` 与剩余工程项），本报告不代表阶段一整体完成。

独立检视：墨墨 / gemini-4-argon-high
