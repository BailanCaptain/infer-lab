# 2026-11-19 Wiki Backlog Triage & Non-Destructive Archival Ledger

> **Scope**: Item #4 — Read-only triage, retirement classification, and non-destructive archival of `wiki/warnings/` and `wiki/_drafts/` following the `v0.30.0 (c09d3e20) + main (8d6180e2)` knowledge-base upgrade.
>
> **Mandatory Iron Rule** ([`docs/plans/2026-11-14-progressive-restructure-and-fix-plan.md#L362,L466`](../plans/2026-11-14-progressive-restructure-and-fix-plan.md)):
> 清理 `wiki/warnings/` 与 `wiki/_drafts/` 积压时只做只读分流盘点与受控归档/退役状态标记，严守铁律 5 绝不擅自物理删除可追溯历史；既有历史待审包保持原状不顺手全批准。

---

## 1. Executive Summary

| Scope | Total Files (Before) | Total Bytes (Before) | Action Taken | Remaining Active Top-Level | Archived (0 Bytes Deleted) | Git Status Impact |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| `wiki/warnings/` | **633** | 10,791,256 | Non-destructive `move` of **595** superseded untracked/gitignored pre-`v0.30.0` files to `wiki/warnings/_archived-pre-v030/`; retained **37** git-tracked files + **1** latest untracked `params-*` status anchor | **38** (3,160,401 B) | **595** (7,630,855 B, 0 SHA-256 mismatches) | **0 stray untracked files** (`.gitignore` +1 line: `/wiki/warnings/_archived-pre-v030/`) |
| `wiki/_drafts/` | **125** | 4,313,974 | **125/125 files are git-tracked (`0` untracked)**; read-only 5-bucket triage & ledger retirement classification only; **0 files moved or deleted** | **125** (4,313,974 B) | **0** on disk (**54** git-tracked drafts classified as `retired-superseded-in-ledger`) | **0 diff / 0 untracked files** |
| `wiki/_jobs/reviews/` | **888** | — | **100% read-only inspection** (`published: 337`, `rejected: 492`, `pending: 59`); **0 reviews approved, retired, or modified** | 888 untouched | 0 | Gitignored (`/wiki/_jobs/*`) |
| `wiki/_jobs/queue/` | **504** | — | **100% read-only inspection** (`closed: 367`, `failed: 92`, `needs-review: 45`); **0 queue files touched** | 504 untouched | 0 | Gitignored (`/wiki/_jobs/*`) |

**Formal Wiki Baseline at Inspection Time** (`2026-11-19`):
- Formal pages: **184** total (`concepts`: 144, `params`: 33, `sources`: 7).
- Upgraded to both `v0.30.0 (c09d3e20)` and `main (8d6180e2)`: **178 / 184** (`100%` of `concepts` + `params` + 1 `sources`).
- Remaining **6 / 184** without `c09d3e20` + `8d6180e2`: all 6 are historical point-in-time `wiki/sources/` snapshot/baseline/PR records (`answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad.md`, `ascend-config-version-source.md`, `glm-5-3-flash-baseline.md`, `glm-mlp-version-source.md`, `pr-11953.md`, `v030rc2-baseline.md`).
- Pinned `vllm-ascend` refs in `wiki/seeds/{vllm-ascend,vllm-ascend-code,params-removed}.yaml`:
  - `v0-30-0-tag`: `c09d3e20b9c45c80b34ae3781440d90904a44023`
  - `main` / `main-baseline`: `8d6180e28e0941fcfc85999bf2aafe194e98f8f6`
  - `v0-30-0rc2-tip`: `7d825229c77025cfb185a010c25819c1214b9450`
  - `v0-26-0rc-tip`: `2ed6cbbaf481d84cfd3f2d01d47bcf79ee064c1f`
  - `v0-23-0-tip`: `2c59ff1047573f40a471cf7535f01a8877344415`
  - `glm-5-3-flash`: `db701c1fd31de40ab028628ee2580ae68c7fd3c0`

---

## 2. Script & Test Contract Audit (Before Touching Any File)

Read-only code review of `scripts/wiki/{drift,draft-review,maintenance,queue}.ts`, `server/status.ts`, `scripts/wiki-{audit,lint,refusal-probe}.ts`, `.gitignore`, and `scripts/wiki/{drift-dedup,draft-review,maintenance,review-retire}.test.ts` confirmed:

1. **`scripts/wiki/maintenance.ts` & `scripts/wiki/drift.ts`**:
   - `recordDrift()` writes `wiki/warnings/drift-<pageId>-<rev12>.md` and persists evidence deduplication receipts under `wiki/_jobs/drift/checked-<hash>.json`. Neither `driftStatus()` nor `detectDrift()` reads `wiki/warnings/drift-*.md` back.
   - `patrol()` writes `wiki/warnings/patrol-<YYYY-MM-DD>.md` and does not read prior patrol reports.
2. **`server/status.ts:111-120` (Critical Runtime Anchor)**:
   - `readStatus()` scans top-level `wiki/warnings/` with `/^params-[a-f0-9]+-[a-f0-9]+\.json$/`, sorts by `mtimeMs` descending, and reads `published.heldBack` from the single most recent file.
   - **Why 1 untracked `params-*` file was retained**: All 20 git-tracked `params-*.json` files share the identical checkout mtime `2026-10-08T09:04:21Z`, and one (`params-daa69ce0471f-4d1412d102c1.json`) has `published.heldBack = 2`. Retaining the single latest pre-pause nightly receipt `wiki/warnings/params-daa69ce0471f-3649b8ff7fd6.json` (`2026-11-14T19:01:21Z`, `heldBack: undefined -> 0`) keeps `readStatus().nightly.heldBack === 0` deterministically without regressing to `2026-10-08`.
3. **`scripts/wiki/draft-review.ts` & `scripts/wiki/review.ts`**:
   - Pending reviews hash `wiki/_drafts/<id>.md` into `payload.base`. Moving or modifying any draft referenced by a `pending` review would alter `checkBase()` state for draft entries.
4. **`.gitignore`**:
   - Lines 35–38 previously ignored `/wiki/warnings/{drift,params,patrol,reconcile}-*` at the top level only.
   - Added `/wiki/warnings/_archived-pre-v030/` at `.gitignore:39` so the 595 moved untracked/gitignored reports remain gitignored and produce zero untracked noise in `git status --short`.

---

## 3. `wiki/warnings/` Complete Triage & Non-Destructive Archival

### 3.1 Inventory & Disposition Matrix

| Prefix | Git Status | Count | Bytes | Timestamp Range (UTC `mtime`) | Disposition | Destination / Reason |
| --- | --- | ---: | ---: | --- | --- | --- |
| `drift-*.md` | Untracked (gitignored) | 500 | 168,406 | `2026-10-20T20:27:25Z` .. `2026-11-02T21:02:48Z` | **Archived (500)** | `wiki/warnings/_archived-pre-v030/` — 0/500 match current formal SHA-256 |
| `params-*.json` | Untracked (gitignored) | 42 | 7,383,089 | `2026-10-08T19:05:43Z` .. `2026-11-13T19:02:32Z` | **Archived (42)** | `wiki/warnings/_archived-pre-v030/` — pre-`v0.30.0` nightly param diffs (`main`: 34, `releases/v0.23.0`: 6, `releases/v0.26.0rc`: 2) |
| `params-*.json` | Untracked (gitignored) | 1 | 423 | `2026-11-14T19:01:21Z` | **Retained in place (1)** | `wiki/warnings/params-daa69ce0471f-3649b8ff7fd6.json` (`775899991f96 -> 3649b8ff7fd6`, `heldBack: 0`) — runtime status anchor for `server/status.ts:111-120` |
| `params-*.json` | Git-tracked | 20 | 3,139,499 | `2026-10-08T09:04:21Z` | **Retained in place (20)** | Historical tracked receipts (`main`: 15 incl. `params-deferred-daa69ce0471f.json`, `releases/v0.26.0rc`: 3, `releases/v0.23.0`: 2); zero git churn |
| `patrol-*.md` | Untracked (gitignored) | 37 | 61,065 | `2026-10-08T19:10:56Z` .. `2026-11-14T19:21:42Z` | **Archived (37)** | `wiki/warnings/_archived-pre-v030/` — pre-`v0.30.0` daily patrols (`patrol-2026-10-08.md` .. `patrol-2026-11-14.md`; last 5 runs `11-10`..`11-14` had 0 findings) |
| `patrol-*.md` | Git-tracked | 17 | 20,479 | `2026-10-08T09:04:21Z` (`2026-09-16` .. `2026-10-06`) | **Retained in place (17)** | Historical tracked patrol logs (`patrol-2026-09-16.md` .. `patrol-2026-10-06.md`); zero git churn |
| `reconcile-*.json` | Untracked (gitignored) | 16 | 18,295 | `2026-10-20T19:48:15Z` .. `2026-11-02T19:30:21Z` | **Archived (16)** | `wiki/warnings/_archived-pre-v030/` — pre-`v0.30.0` cross-page reconcile reports (4 linked to finalized reviews: 2 `published` [`790f41249e51`, `c710ce04ddb6`], 2 `rejected` [`8f8f6be5a941`, `77109ad4c86e`]; 12 with no `reviewId`) |
| **Total** | **37 tracked / 596 untracked** | **633** | **10,791,256** | `2026-09-16` .. `2026-11-14` | **38 retained / 595 archived** | **0 bytes deleted, 0 SHA-256 mismatches** |

### 3.2 Deep Analysis of the 500 Archived `drift-*.md` Reports

- **Revision freshness**: `500 / 500` carry distinct pre-`v0.30.0` page SHA-256 revisions (`0 / 500` match any current formal page on disk; all `500` have `score` in `[0.4398, 0.8143]` > `0.3` and already enqueued a `rewrite` task).
- **Daily generation bursts**: `2026-10-20` (37), `2026-10-23` (155), `2026-10-28` (158), `2026-10-30` (5), `2026-11-01` (70), `2026-11-02` (75).
- **Target page status across 161 unique `pageId`s**:
  - **469 reports (`149` unique pages)**: Target formal page is already upgraded to `v0.30.0 (c09d3e20) + main (8d6180e2)`.
  - **14 reports (`6` unique pages)**: Target is one of the 6 historical `wiki/sources/` baseline/PR/answer pages (`answer-fbdf834736fd6584fd523555c449c21fa1c755b9e992cf949c98cd86e147a1ad`: 3, `ascend-config-version-source`: 2, `glm-5-3-flash-baseline`: 2, `glm-mlp-version-source`: 4, `pr-11953`: 2, `v030rc2-baseline`: 1); every revision SHA is superseded.
  - **17 reports (`6` unique IDs)**: Target ID has no formal page in `wiki/{concepts,params,sources}/` (all 6 exist only as unpromoted drafts in `wiki/_drafts/`: `gap-a5164fe10fa9184412f8`, `kv-pool-range-debug-83e8b165addd`, `multistream-engram-overlap-29113aa3f8fc`, `runtime-config-abb228bbf148`, `runtime-config-hot-reload-9c9ab794933a`, `runtime-config-path-e23e596c2a2e`).

---

## 4. `wiki/_drafts/` Complete Read-Only Triage & Retirement Ledger

**Key Finding**: **All `125 / 125` files in `wiki/_drafts/` (`4,313,974` bytes) are git-tracked (`0` untracked files).**
To uphold both the Mandatory Iron Rule (no unauthorized deletion, no breaking historical pending reviews) and clean working-tree hygiene (avoiding 54+ unstaged delete/rename entries in a shared workspace without committing), **0 files were moved or deleted in `wiki/_drafts/`**; every file is classified into one of 5 auditable buckets below.

### 4.1 Bucket Summary (`125` Git-Tracked Files)

| Bucket | Count | Bytes | Date / State | Lifecycle Status | Action |
| --- | ---: | ---: | --- | --- | --- |
| **1. Active control / queue JSON** | 3 | 2,976,708 | `_failures.json` (`{}`, 3 B), `_integration.json` (8 promoted param IDs, 315 B), `_param-queue.json` (63 entries, 2,976,390 B: `no-existing-page-updated`: 31, `static-facts-refreshed-prose-needs-review`: 26, `patrol-diff-awaiting-teaching-review`: 6) | `active-runtime-metadata` | Keep untouched |
| **2. Param skeletons (`_param-skeletons/*.md`)** | 5 | 22,249 | `2026-10-08` .. `2026-10-25`; all 5 pair 1-to-1 with unpromoted root drafts | `unpromoted-skeleton` | Keep untouched |
| **3. Pending-review locked drafts** | 45 | 540,026 | All dated `2026-11-03`; `45/45` SHA-256 match `payload.base` in `wiki/_jobs/reviews/` (`59` historical `pending` reviews) | `locked-by-pending-review` | Keep untouched (Iron Rule: never approve or invalidate historical pending packages) |
| **4. Unpromoted candidate drafts** | 18 | 75,806 | `2026-11-01` .. `2026-11-13` (`17` `param` + `1` `gap` `concept`), no formal page exists yet | `active-unpromoted-candidate` | Keep in place for future promotion triage |
| **5a. Superseded by `v0.30.0+main` formal page** | 51 | 673,159 | `2026-10-29` .. `2026-11-03` (`35` concept, `9` feature, `7` param); `0` mention `c09d3e20`/`8d6180e2`; not referenced by any `pending` review | `retired-superseded-in-ledger` | Keep on disk for now; eligible for dedicated `git mv` archival commit to `wiki/_drafts/_archived-pre-v030/` |
| **5b. Superseded by historical `wiki/sources/` page** | 3 | 26,026 | `2026-10-29`; not referenced by any `pending` review (`ascend-config-version-source.md`, `glm-5-3-flash-baseline.md`, `pr-11953.md`) | `retired-superseded-in-ledger` | Keep on disk for now; eligible for dedicated `git mv` archival commit |
| **Total** | **125** | **4,313,974** | `0` root `.md` drafts mention `c09d3e20` or `8d6180e2` | — | **0 files deleted, 0 files modified** |

### 4.2 Bucket 4 — Unpromoted Candidate Drafts (`18` Files, Keep Active)

- `backend-bdf78ddfcbad.md` (`param`, `2026-11-12`)
- `capacity-04c3bdb166dd.md` (`param`, `2026-11-13`)
- `enable-86f20ad88975.md` (`param`, `2026-11-10`)
- `endpoint-19ab271a13cf.md` (`param`, `2026-11-12`)
- `gap-a5164fe10fa9184412f8.md` (`concept`, `origin: gap`, `2026-11-01`)
- `gdn-internal-prefill-checkpoints-50f5ac80d583.md` (`param`, `2026-11-12`)
- `kv-pool-range-debug-83e8b165addd.md` (`param`, `2026-11-03`, paired with `_param-skeletons/`)
- `library-path-9522b077c0b2.md` (`param`, `2026-11-13`)
- `listen-port-9d4873f6ec39.md` (`param`, `2026-11-13`)
- `local-comm-res-139cff276c9a.md` (`param`, `2026-11-13`)
- `megamoe-shared-expert-fusion-5a99901d47e6.md` (`param`, `2026-11-10`)
- `min-numel-24ae7250f0b5.md` (`param`, `2026-11-10`)
- `multistream-engram-overlap-29113aa3f8fc.md` (`param`, `2026-11-03`, paired with `_param-skeletons/`)
- `quantized-all-reduce-config-3cc69e492011.md` (`param`, `2026-11-10`)
- `runtime-config-abb228bbf148.md` (`param`, `2026-11-03`, paired with `_param-skeletons/`)
- `runtime-config-hot-reload-9c9ab794933a.md` (`param`, `2026-11-03`, paired with `_param-skeletons/`)
- `runtime-config-path-e23e596c2a2e.md` (`param`, `2026-11-03`, paired with `_param-skeletons/`)
- `shared-engram-31bf0d820403.md` (`param`, `2026-11-12`)

### 4.3 Bucket 5 — Retired/Superseded Git-Tracked Drafts (`54` Files, Candidate for Future `git mv` Archive)

**5a. Superseded by upgraded `v0.30.0 (c09d3e20) + main (8d6180e2)` formal pages (`51` files):**
- **Params (`7`)**: `block-table-no-commit-optimize-8328d0d2d00d.md`, `enable-async-exponential.md`, `enable-pcp-embedding-lmhead-weight-sharding-91c5a17a08c9.md`, `enable-pcp-o-proj-weight-sharding-8528cf5af9c6.md`, `enable-super-kernel-ce990e186bfa.md`, `profiling-chunk-config.md`, `weight-prefetch-config.md`.
- **Concepts / Features (`44`)**: `ai-core.md`, `ascend-config-system.md`, `ascend-patch-system.md`, `attention-backend-family.md`, `attention-qkv.md`, `balance-scheduling.md`, `block-table.md`, `cann-hccl.md`, `collective-communication.md`, `context-parallel.md`, `data-parallel.md`, `eplb.md`, `glm-5-3-flash-two-node.md`, `glm-5-3-flash.md`, `gqa.md`, `inference-benchmarking.md`, `inference-troubleshooting.md`, `kv-cache-cpu-offload.md`, `kv-cache-quantization.md`, `kv-cache-sparse-offload.md`, `kv-cache.md`, `kvpp.md`, `large-scale-ep.md`, `lmcache.md`, `lora.md`, `mla.md`, `npu-platform.md`, `npu-worker-lifecycle.md`, `pipeline-parallel.md`, `quantization-methods.md`, `quantization.md`, `recompute-cpu-offload.md`, `rfork-config.md`, `rfork-identity.md`, `rfork-lifecycle.md`, `rfork.md`, `short-request-first.md`, `speculative-decoding.md`, `streaming-output.md`, `tensor-layout.md`, `tensor-parallel.md`, `vllm-ascend-overview.md`, `vllm-kv-block-allocation.md`, `vllm-platform-interface.md`.

**5b. Superseded by historical `wiki/sources/` formal pages (`3` files):**
- `ascend-config-version-source.md`, `glm-5-3-flash-baseline.md`, `pr-11953.md`.

### 4.4 Bucket 3 & Historical `wiki/_jobs/reviews/` Read-Only Audit

- `wiki/_jobs/reviews/`: **888** total (`published`: 337, `rejected`: 492, `pending`: 59).
- All **59 `pending`** reviews (`45` referencing `wiki/_drafts/*.md` + `14` formal-only) have **stale formal-page `payload.base` hashes** (`59/59` `stale_formal=True`, `0/59` `stale_draft=True`, `0/59` `base_matches_disk=True`), because the underlying formal pages were updated after `2026-11-03` (including the `v0.30.0 + main` upgrade).
- `scripts/wiki/review.ts` `checkBase()` deterministically blocks stale pending packages from overwriting newer formal pages. Per the Iron Rule, all 59 pending reviews and all 45 referenced drafts remain completely untouched.

---

## 5. Verification Evidence

1. **Non-destructive archival integrity** (`archive_warnings.py`):
   - Pre-move: `633` files (`10,791,256` bytes) in `wiki/warnings/`.
   - Post-move: `38` files (`3,160,401` bytes) in top-level `wiki/warnings/` + `595` files (`7,630,855` bytes) in `wiki/warnings/_archived-pre-v030/` (`drift`: 500, `params`: 42, `patrol`: 37, `reconcile`: 16).
   - Recursive total: `633` files (`10,791,256` bytes), **0 bytes deleted**, **0 SHA-256 mismatches**.
2. **Git cleanliness** (`git status --short -- wiki/warnings wiki/_drafts .gitignore docs/reviews`):
   - Only `M .gitignore` + `?? docs/reviews/2026-11-19-backlog-triage-and-archive.md` — **0 stray untracked warning/draft files**.
3. **Runtime status anchor check** (`readStatus(process.cwd())` via `tsx`):
   - Returned `{"nightlyHeldBack": 0, "pages": {"concepts": 144, "params": 33, "sources": 7}, "pendingReviews": 59, "queuedTasks": 0}` (exit code `0`).
4. **Unit tests** (`pnpm exec vitest run scripts/wiki/drift-dedup.test.ts scripts/wiki/draft-review.test.ts scripts/wiki/maintenance.test.ts scripts/wiki/review-retire.test.ts server/status.test.ts`):
   - **5 test files passed (5), 38 tests passed (38)** (exit code `0`):
     - `scripts/wiki/drift-dedup.test.ts` (4/4)
     - `scripts/wiki/draft-review.test.ts` (9/9)
     - `scripts/wiki/maintenance.test.ts` (12/12)
     - `scripts/wiki/review-retire.test.ts` (3/3)
     - `server/status.test.ts` (10/10)
5. **Wiki lint & audit**:
   - `pnpm wiki:lint`: **exit code 0** (`ok wiki:lint 通过（另有 9 处待留意）` — 0 errors; the 9 non-blocking warnings are pre-existing `rfork*` `mark-flood` notices).
   - `pnpm wiki:audit`: **exit code 0** (`审计 184 页，来源 9439 条，行号有效 8908，URL 未联网验证 531，无效 commit 0，文件不存在 0，行号越界 0，未知仓库 0；ok wiki:audit 本地引用与行号校验、名单页写作标准通过`).
