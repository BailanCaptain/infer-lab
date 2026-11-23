import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import {
  applySurgicalFactPatch,
  computeProtectedEnvelopeHash,
  diffFactValue,
  extractProtectedFences,
  type FactBinding,
  type FactValue,
  planSurgicalFactPatch,
  verifySurgicalCandidate,
} from "./fact-patch";
import { contentDrift } from "./maintenance";

const SAMPLE_PAGE = [
  "---",
  "id: context-parallel",
  "title: 上下文并行（CP）",
  "type: feature",
  "sources:",
  "  - 'vllm-ascend@c09d3e20:vllm_ascend/attention/indexer_kpool.py#L498-L499'",
  "  - 'vllm-ascend@8d6180e2:vllm_ascend/attention/indexer_kpool.py#L782-L800'",
  "verified:",
  "  - releases/v0.23.0",
  "  - releases/v0.30.0",
  "  - main",
  "updated: '2026-11-19'",
  "---",
  "",
  "## 上下文并行是什么？",
  "",
  "把一条 8 个 token 的序列头尾配对分给两张卡，就像两队人合抄同一本账本，每人先算本页小计，再按权重总和归并。",
  "",
  "```wiki-diagram",
  "file: context-parallel-overview",
  "```",
  "",
  "```wiki-scene",
  "parallel-mechanism:2",
  "```",
  "",
  "## 放到 GLM 双机：这套部署开了 CP 吗？",
  "",
  "- **DCP 这条路，平台层放行不等于模型接上了实现。** `v0.30.0` 上 KPool 索引器直接抛 NotImplementedError，明确拒绝 KPool 的 PCP 或 DCP；不能只满足平台参数就把旧路径当作可用的 CP。",
  "",
  "## 对照源码",
  "",
  "### 版本差异",
  "",
  "| 核对项 | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） |",
  "|---|---|---|",
  "| 开关默认门控 | `enable_pcp=False` | `enable_pcp=False` |",
  "| GLM KPool 索引器与 CP | `indexer_kpool.py#L498-L499` 明确拒绝 `PCP > 1` 或 `DCP > 1` | **KPool 已新增 PCP 支持**（`indexer_kpool.py#L885-L899`），仅拒绝 `DCP > 1` |",
  "",
  "引用锚点：`vllm-ascend@c09d3e20:vllm_ascend/attention/indexer_kpool.py#L498-L499`",
  "",
].join("\n");

const KPOOL_BINDING: FactBinding = {
  factId: "cp.kpool.guard",
  pageId: "context-parallel",
  repo: "vllm-ascend",
  path: "vllm_ascend/attention/indexer_kpool.py",
  qualifiedSymbol: "IndexerKPool.__init__",
  kind: "versionMatrixCell",
  target: {
    tableHeading: "版本差异",
    rowKey: "GLM KPool 索引器与 CP",
    versionColumn: "v0.30.0",
  },
  narrativeGuards: [
    {
      sectionHeading: "放到 GLM 双机",
      anchorQuote: "明确拒绝 KPool 的 PCP 或 DCP",
      contradictsValues: ["pcp-supported", "新增 pcp 支持"],
      diagramIds: ["context-parallel-fig-matrix"],
    },
  ],
};

describe("Surgical Fact-Patch Engine", () => {
  it("1. reanchors line-number shift only (#L498-L499 -> #L512-L513) with zero prose change and certifies verified", () => {
    const oldVal: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "c09d3e20",
      path: "vllm_ascend/attention/indexer_kpool.py",
      lineStart: 498,
      lineEnd: 499,
      quoteHash: "abc123",
    };
    const newVal: FactValue = {
      ...oldVal,
      commit: "d1e2f3a4",
      lineStart: 512,
      lineEnd: 513,
    };

    expect(diffFactValue(oldVal, newVal)).toBe("line-shift-only");

    const plan = planSurgicalFactPatch(
      SAMPLE_PAGE,
      { ...KPOOL_BINDING, kind: "sourceAnchor" },
      oldVal,
      newVal,
      {
        oldCommit: "c09d3e20",
        newCommit: "d1e2f3a4",
        oldSourceRef: "vllm-ascend@c09d3e20:vllm_ascend/attention/indexer_kpool.py#L498-L499",
        newSourceRef: "vllm-ascend@d1e2f3a4:vllm_ascend/attention/indexer_kpool.py#L512-L513",
        verifiedTag: "releases/v0.30.1",
      },
    );

    expect(plan.noop).toBe(false);
    if (plan.noop) throw new Error("Expected non-noop plan");
    expect(plan.operation).toBe("reanchor");
    expect(plan.canCertifyVerified).toBe(true);
    expect(plan.narrativeConflicts).toEqual([]);

    const patched = applySurgicalFactPatch(SAMPLE_PAGE, plan);
    expect(patched).toContain("`indexer_kpool.py#L512-L513` 明确拒绝 `PCP > 1` 或 `DCP > 1`");
    expect(patched).toContain("vllm-ascend@d1e2f3a4:vllm_ascend/attention/indexer_kpool.py#L512-L513");
    expect(patched).toContain("  - releases/v0.30.1\n");
    expect(patched).not.toContain("#L498-L499");
    expect(
      verifySurgicalCandidate(SAMPLE_PAGE, patched, plan.allowedSpans, plan.protectedEnvelopeHash).verified,
    ).toBe(true);
  });

  it("2. updates default cell value (replaceCell) and appends v0.31.0 column (appendVersionColumn) with outside bytes 100% identical", () => {
    const defaultBinding: FactBinding = {
      factId: "cp.enable_pcp.default",
      pageId: "context-parallel",
      repo: "vllm-ascend",
      path: "vllm_ascend/attention/utils.py",
      qualifiedSymbol: "enable_pcp",
      kind: "default",
      target: {
        tableHeading: "版本差异",
        rowKey: "开关默认门控",
        versionColumn: "main",
      },
      narrativeGuards: [],
    };

    const oldDefault: FactValue = { kind: "default", expr: "enable_pcp=False" };
    const newDefault: FactValue = { kind: "default", expr: "enable_pcp=True", valueType: "bool" };
    expect(diffFactValue(oldDefault, newDefault)).toBe("value-changed");

    const replacePlan = planSurgicalFactPatch(SAMPLE_PAGE, defaultBinding, oldDefault, newDefault, {
      oldCommit: "8d6180e2",
      newCommit: "9e7291f3",
    });
    expect(replacePlan.noop).toBe(false);
    if (replacePlan.noop) throw new Error("Expected replaceCell plan");
    expect(replacePlan.operation).toBe("replaceCell");
    expect(replacePlan.canCertifyVerified).toBe(true);

    const replaced = applySurgicalFactPatch(SAMPLE_PAGE, replacePlan);
    expect(replaced).toContain("| 开关默认门控 | `enable_pcp=False` | `enable_pcp=True` (bool) |");
    expect(
      verifySurgicalCandidate(
        SAMPLE_PAGE,
        replaced,
        replacePlan.allowedSpans,
        replacePlan.protectedEnvelopeHash,
      ).verified,
    ).toBe(true);

    const appendBinding: FactBinding = {
      ...defaultBinding,
      target: {
        tableHeading: "版本差异",
        rowKey: "开关默认门控",
        versionColumn: "v0.31.0",
      },
    };
    const appendPlan = planSurgicalFactPatch(SAMPLE_PAGE, appendBinding, oldDefault, newDefault, {
      oldCommit: "c09d3e20",
      newCommit: "a1b2c3d4",
      newColumnHeader: "`v0.31.0`（`a1b2c3d4`）",
      verifiedTag: "releases/v0.31.0",
    });
    expect(appendPlan.noop).toBe(false);
    if (appendPlan.noop) throw new Error("Expected appendVersionColumn plan");
    expect(appendPlan.operation).toBe("appendVersionColumn");
    expect(appendPlan.canCertifyVerified).toBe(true);

    const appended = applySurgicalFactPatch(SAMPLE_PAGE, appendPlan);
    expect(appended).toContain(
      "| 核对项 | `v0.30.0`（`c09d3e20`，主基线） | `main`（`8d6180e2`） | `v0.31.0`（`a1b2c3d4`） |",
    );
    expect(appended).toContain(
      "| 开关默认门控 | `enable_pcp=False` | `enable_pcp=False` | `enable_pcp=True` (bool) |",
    );
    expect(appended).toContain("  - releases/v0.31.0\n");
    expect(
      verifySurgicalCandidate(
        SAMPLE_PAGE,
        appended,
        appendPlan.allowedSpans,
        appendPlan.protectedEnvelopeHash,
      ).verified,
    ).toBe(true);
  });

  it("3. catches ordered guard inversion (gate=false -> A / gate=true -> B swapped) even when Jaccard contentDrift is 0", () => {
    const oldGuards: FactValue = {
      kind: "orderedGuards",
      guards: [
        { condition: "gate=false", outcome: "A" },
        { condition: "gate=true", outcome: "B" },
      ],
    };
    const swappedGuards: FactValue = {
      kind: "orderedGuards",
      guards: [
        { condition: "gate=false", outcome: "B" },
        { condition: "gate=true", outcome: "A" },
      ],
    };

    const oldStr = "gate=false -> A; gate=true -> B";
    const newStr = "gate=false -> B; gate=true -> A";
    // Prove bag-of-tokens Jaccard contentDrift is completely blind (0.0) to guard inversion!
    expect(contentDrift(oldStr, newStr)).toBe(0);
    // Surgical structured diff catches the guard inversion with 100% precision!
    expect(diffFactValue(oldGuards, swappedGuards)).toBe("guard-inverted");
  });

  it("4. blocks verified certification when narrative prose above ## 对照源码 conflicts with updated KPool PCP matrix cell", () => {
    const oldCell: FactValue = {
      kind: "versionMatrixCell",
      status: "reject-pcp-and-dcp",
      summary: "明确拒绝 `PCP > 1` 或 `DCP > 1`",
      anchor: "indexer_kpool.py#L498-L499",
    };
    const newCell: FactValue = {
      kind: "versionMatrixCell",
      status: "pcp-supported",
      summary: "**KPool 已新增 PCP 支持**，仅拒绝 `DCP > 1`",
      anchor: "indexer_kpool.py#L885-L899",
    };

    const plan = planSurgicalFactPatch(SAMPLE_PAGE, KPOOL_BINDING, oldCell, newCell, {
      oldCommit: "c09d3e20",
      newCommit: "f00ba123",
      verifiedTag: "releases/v0.31.0",
    });

    expect(plan.noop).toBe(false);
    if (plan.noop) throw new Error("Expected replaceCell plan");
    expect(plan.operation).toBe("replaceCell");
    expect(plan.canCertifyVerified).toBe(false);
    expect(plan.narrativeConflicts).toHaveLength(1);
    const conflict = plan.narrativeConflicts[0]!;
    expect(conflict.anchorQuote).toBe("明确拒绝 KPool 的 PCP 或 DCP");
    // Exact 1-based line number of the conflicting narrative bullet in SAMPLE_PAGE
    const expectedLine =
      SAMPLE_PAGE.split("\n").findIndex((l) => l.includes("明确拒绝 KPool 的 PCP 或 DCP")) + 1;
    expect(conflict.line).toBe(expectedLine);

    const patched = applySurgicalFactPatch(SAMPLE_PAGE, plan);
    // Matrix cell is patched, but frontmatter verified tag is NOT auto-certified!
    expect(patched).toContain("**KPool 已新增 PCP 支持**");
    expect(patched).not.toContain("releases/v0.31.0");
  });

  it("5. rejects 1-char tamper in teaching analogy or wiki-diagram/wiki-scene fence outside allowedSpans", () => {
    const oldVal: FactValue = { kind: "default", expr: "enable_pcp=False" };
    const newVal: FactValue = { kind: "default", expr: "enable_pcp=True" };
    const binding: FactBinding = {
      factId: "cp.enable_pcp.default",
      pageId: "context-parallel",
      repo: "vllm-ascend",
      path: "vllm_ascend/attention/utils.py",
      qualifiedSymbol: "enable_pcp",
      kind: "default",
      target: {
        tableHeading: "版本差异",
        rowKey: "开关默认门控",
        versionColumn: "main",
      },
      narrativeGuards: [],
    };

    const plan = planSurgicalFactPatch(SAMPLE_PAGE, binding, oldVal, newVal, {
      oldCommit: "8d6180e2",
      newCommit: "9e7291f3",
    });
    if (plan.noop) throw new Error("Expected patch plan");
    const validCandidate = applySurgicalFactPatch(SAMPLE_PAGE, plan);

    // Tamper 1 character in the teaching analogy ("两队人" -> "三队人")
    const tamperedAnalogy = validCandidate.replace("两队人", "三队人");
    expect(() =>
      verifySurgicalCandidate(SAMPLE_PAGE, tamperedAnalogy, plan.allowedSpans, plan.protectedEnvelopeHash),
    ).toThrow(/Protected envelope tampered/);

    // Tamper 1 character inside the wiki-diagram fence
    const tamperedDiagram = validCandidate.replace("context-parallel-overview", "context-parallel-overviev");
    expect(() =>
      verifySurgicalCandidate(SAMPLE_PAGE, tamperedDiagram, plan.allowedSpans, plan.protectedEnvelopeHash),
    ).toThrow(/Protected envelope tampered|Protected fence tampered/);

    // Tamper 1 character inside the wiki-scene fence
    const tamperedScene = validCandidate.replace("parallel-mechanism:2", "parallel-mechanism:3");
    expect(() =>
      verifySurgicalCandidate(SAMPLE_PAGE, tamperedScene, plan.allowedSpans, plan.protectedEnvelopeHash),
    ).toThrow(/Protected envelope tampered|Protected fence tampered/);

    // Allowed span overlapping a wiki-diagram fence is rejected upfront
    const diagramStart = SAMPLE_PAGE.indexOf("file: context-parallel-overview");
    expect(() =>
      computeProtectedEnvelopeHash(SAMPLE_PAGE, [
        { start: diagramStart, end: diagramStart + 4, reason: "illegal-diagram-edit" },
      ]),
    ).toThrow(/overlaps protected wiki-diagram fence/);
  });

  it("6. guarantees idempotency (noop: true on re-plan) and throws on concurrent edit basePageHash invalidation", () => {
    const oldVal: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "c09d3e20",
      path: "vllm_ascend/attention/indexer_kpool.py",
      lineStart: 498,
      lineEnd: 499,
      quoteHash: "abc123",
    };
    const newVal: FactValue = {
      ...oldVal,
      commit: "d1e2f3a4",
      lineStart: 512,
      lineEnd: 513,
    };
    const binding: FactBinding = { ...KPOOL_BINDING, kind: "sourceAnchor" };
    const meta = {
      oldCommit: "c09d3e20",
      newCommit: "d1e2f3a4",
      oldSourceRef: "vllm-ascend@c09d3e20:vllm_ascend/attention/indexer_kpool.py#L498-L499",
      newSourceRef: "vllm-ascend@d1e2f3a4:vllm_ascend/attention/indexer_kpool.py#L512-L513",
      verifiedTag: "releases/v0.30.1",
    };

    const firstPlan = planSurgicalFactPatch(SAMPLE_PAGE, binding, oldVal, newVal, meta);
    expect(firstPlan.noop).toBe(false);
    if (firstPlan.noop) throw new Error("Expected first plan to be non-noop");
    const patched = applySurgicalFactPatch(SAMPLE_PAGE, firstPlan);

    // Re-planning against already-patched markdown returns { noop: true }
    const secondPlan = planSurgicalFactPatch(patched, binding, oldVal, newVal, meta);
    expect(secondPlan.noop).toBe(true);

    // Concurrent edit to the base document invalidates basePageHash deterministically
    const concurrentlyEdited = SAMPLE_PAGE.replace("2026-11-19", "2026-11-20");
    expect(() => applySurgicalFactPatch(concurrentlyEdited, firstPlan)).toThrow(/Stale base page/);
  });

  it("7. [P1-1] detects narrative conflicts even on unchanged/line-shift-only rerun and revokes rolling verified tag", () => {
    const mainBinding: FactBinding = {
      ...KPOOL_BINDING,
      target: { tableHeading: "版本差异", rowKey: "GLM KPool 索引器与 CP", versionColumn: "main" },
    };
    const currentMainCell: FactValue = {
      kind: "versionMatrixCell",
      status: "pcp-supported",
      summary: "**KPool 已新增 PCP 支持**，仅拒绝 `DCP > 1`",
      anchor: "indexer_kpool.py#L885-L899",
    };

    // Unchanged rerun against SAMPLE_PAGE which currently has `verified: ... - main`
    const unchangedPlan = planSurgicalFactPatch(SAMPLE_PAGE, mainBinding, currentMainCell, currentMainCell, {
      oldCommit: "8d6180e2",
      newCommit: "8d6180e2",
      verifiedTag: "main",
    });
    expect(unchangedPlan.canCertifyVerified).toBe(false);
    expect(unchangedPlan.narrativeConflicts).toHaveLength(1);
    expect(unchangedPlan.noop).toBe(false);
    if (unchangedPlan.noop) throw new Error("Expected unverify edit to remove stale main verified tag");
    const unverifiedPage = applySurgicalFactPatch(SAMPLE_PAGE, unchangedPlan);
    expect(unverifiedPage).not.toMatch(/^\s*-\s*main\s*$/m);

    // Line-shift-only rerun also detects narrative conflict and never re-adds `main` to verified
    const shiftedMainCell: FactValue = { ...currentMainCell, anchor: "indexer_kpool.py#L901-L915" };
    const shiftPlan = planSurgicalFactPatch(unverifiedPage, mainBinding, currentMainCell, shiftedMainCell, {
      oldCommit: "8d6180e2",
      newCommit: "99aabbcc",
      verifiedTag: "main",
    });
    expect(shiftPlan.canCertifyVerified).toBe(false);
    expect(shiftPlan.narrativeConflicts).toHaveLength(1);
    if (shiftPlan.noop) throw new Error("Expected cell reanchor plan");
    const shiftedPage = applySurgicalFactPatch(unverifiedPage, shiftPlan);
    expect(shiftedPage).toContain("indexer_kpool.py#L901-L915");
    expect(shiftedPage).not.toMatch(/^\s*-\s*main\s*$/m);
  });

  it("8. [P1-2] blocks silent overwrite and verified certification when cell is manually edited to a third state", () => {
    const manualPage = SAMPLE_PAGE.replace(
      "| 开关默认门控 | `enable_pcp=False` | `enable_pcp=False` |",
      "| 开关默认门控 | `enable_pcp=False` | manual |",
    );
    const defaultBinding: FactBinding = {
      factId: "cp.enable_pcp.default",
      pageId: "context-parallel",
      repo: "vllm-ascend",
      path: "vllm_ascend/attention/utils.py",
      qualifiedSymbol: "enable_pcp",
      kind: "default",
      target: { tableHeading: "版本差异", rowKey: "开关默认门控", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldVal: FactValue = { kind: "default", expr: "enable_pcp=False" };
    const newVal: FactValue = { kind: "default", expr: "enable_pcp=True" };

    // value-changed must NOT overwrite "manual" and must NOT certify verified
    const changePlan = planSurgicalFactPatch(manualPage, defaultBinding, oldVal, newVal, {
      oldCommit: "8d6180e2",
      newCommit: "9e7291f3",
      verifiedTag: "main",
    });
    expect(changePlan.canCertifyVerified).toBe(false);
    expect(changePlan.manualConflicts.length).toBeGreaterThan(0);
    if (!changePlan.noop) {
      const after = applySurgicalFactPatch(manualPage, changePlan);
      expect(after).toContain("| 开关默认门控 | `enable_pcp=False` | manual |");
      expect(after).not.toMatch(/^\s*-\s*main\s*$/m);
    }

    // unchanged must NOT certify verified either
    const unchangedPlan = planSurgicalFactPatch(manualPage, defaultBinding, oldVal, oldVal, {
      oldCommit: "8d6180e2",
      newCommit: "8d6180e2",
      verifiedTag: "releases/v0.31.0",
    });
    expect(unchangedPlan.canCertifyVerified).toBe(false);
    expect(unchangedPlan.manualConflicts.length).toBeGreaterThan(0);
    expect(unchangedPlan.noop).toBe(true);

    // line-shift-only / reanchor on manually edited cell must also block overwrite & verified
    const manualKpoolPage = SAMPLE_PAGE.replace(
      "`indexer_kpool.py#L498-L499` 明确拒绝 `PCP > 1` 或 `DCP > 1`",
      "manual",
    );
    const oldAnchor: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "c09d3e20",
      path: "vllm_ascend/attention/indexer_kpool.py",
      lineStart: 498,
      lineEnd: 499,
      quoteHash: "abc123",
    };
    const newAnchor: FactValue = { ...oldAnchor, commit: "d1e2f3a4", lineStart: 512, lineEnd: 513 };
    const reanchorPlan = planSurgicalFactPatch(
      manualKpoolPage,
      { ...KPOOL_BINDING, kind: "sourceAnchor", narrativeGuards: [] },
      oldAnchor,
      newAnchor,
      { oldCommit: "c09d3e20", newCommit: "d1e2f3a4", verifiedTag: "releases/v0.30.1" },
    );
    expect(reanchorPlan.canCertifyVerified).toBe(false);
    expect(reanchorPlan.manualConflicts.length).toBeGreaterThan(0);
    expect(reanchorPlan.noop).toBe(true);
  });

  it("9. [P2-1] verifySurgicalCandidate uses exact offset accounting and blocks indexOf slide bypass (A1B2C -> ABX2C)", () => {
    const orig = "A1B2C";
    const allowedSpans = [
      { start: 1, end: 2, reason: "replace-cell" },
      { start: 3, end: 4, reason: "source-ref" },
    ];
    const edits = [
      { start: 1, end: 2, oldText: "1", newText: "X", reason: "replace-cell" },
      { start: 3, end: 4, oldText: "2", newText: "Y", reason: "source-ref" },
    ];
    const protectedEnvelopeHash = computeProtectedEnvelopeHash(orig, allowedSpans);
    const patchLike = { allowedSpans, protectedEnvelopeHash, edits };

    expect(verifySurgicalCandidate(orig, "AXBYC", patchLike).verified).toBe(true);
    expect(() => verifySurgicalCandidate(orig, "ABX2C", patchLike)).toThrow(
      /Protected envelope tampered|edit mismatch/i,
    );
  });

  it("10. [P2-2] reanchors #L10 -> #L22 without corrupting #L100 -> #L220 and adds missing cell anchor p.py#L22", () => {
    const page = [
      "---",
      "id: anchor-test",
      "sources:",
      "  - 'vllm-ascend@1111111:p.py#L10'",
      "  - 'vllm-ascend@1111111:p.py#L100'",
      "verified:",
      "  - main",
      "---",
      "",
      "## 对照源码",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 入口 A | `p.py#L10` 与 `p.py#L100` |",
      "| 入口 B | 默认开启 |",
      "",
      "详见 `vllm-ascend@1111111:p.py#L10` 和 `vllm-ascend@1111111:p.py#L100`。",
      "",
    ].join("\n");

    const bindingA: FactBinding = {
      factId: "anchor.a",
      pageId: "anchor-test",
      repo: "vllm-ascend",
      path: "p.py",
      qualifiedSymbol: "fn_a",
      kind: "sourceAnchor",
      target: { rowKey: "入口 A", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldA: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "1111111",
      path: "p.py",
      lineStart: 10,
      lineEnd: 10,
      quoteHash: "q1",
    };
    const newA: FactValue = { ...oldA, commit: "2222222", lineStart: 22, lineEnd: 22 };

    const planA = planSurgicalFactPatch(page, bindingA, oldA, newA, {
      oldCommit: "1111111",
      newCommit: "2222222",
      oldSourceRef: "vllm-ascend@1111111:p.py#L10",
      newSourceRef: "vllm-ascend@2222222:p.py#L22",
    });
    if (planA.noop) throw new Error("Expected reanchor plan for A");
    const patchedA = applySurgicalFactPatch(page, planA);
    expect(patchedA).toContain("| 入口 A | `p.py#L22` 与 `p.py#L100` |");
    expect(patchedA).toContain("vllm-ascend@2222222:p.py#L22");
    expect(patchedA).toContain("vllm-ascend@1111111:p.py#L100");
    expect(patchedA).not.toContain("#L220");

    // Missing anchor in old cell -> new fact carries p.py#L22 must write anchor into cell
    const bindingB: FactBinding = {
      ...bindingA,
      factId: "anchor.b",
      kind: "versionMatrixCell",
      target: { rowKey: "入口 B", versionColumn: "main" },
    };
    const oldB: FactValue = { kind: "versionMatrixCell", status: "on", summary: "默认开启" };
    const newB: FactValue = {
      kind: "versionMatrixCell",
      status: "on",
      summary: "默认开启",
      anchor: "p.py#L22",
    };
    const planB = planSurgicalFactPatch(page, bindingB, oldB, newB, {
      oldCommit: "1111111",
      newCommit: "2222222",
    });
    if (planB.noop) throw new Error("Expected cell anchor addition plan for B");
    const patchedB = applySurgicalFactPatch(page, planB);
    expect(patchedB).toContain("| 入口 B | 默认开启（`p.py#L22`） |");
  });

  it("11. [P2-3] extractProtectedFences protects unclosed wiki-diagram / wiki-scene fences through EOF", () => {
    const unclosedDiagram = "intro\n```wiki-diagram\nfile: diagram-eof\nstill-protected\n";
    const fences = extractProtectedFences(unclosedDiagram);
    expect(fences).toHaveLength(1);
    expect(fences[0]!.kind).toBe("wiki-diagram");
    expect(fences[0]!.end).toBe(unclosedDiagram.length);

    const insideOffset = unclosedDiagram.indexOf("still-protected");
    expect(() =>
      computeProtectedEnvelopeHash(unclosedDiagram, [
        { start: insideOffset, end: insideOffset + 5, reason: "eof-overlap" },
      ]),
    ).toThrow(/overlaps protected wiki-diagram fence/);

    const unclosedScene = "intro\n~~~wiki-scene\nscene-eof:1";
    const sceneFences = extractProtectedFences(unclosedScene);
    expect(sceneFences).toHaveLength(1);
    expect(sceneFences[0]!.kind).toBe("wiki-scene");
    expect(sceneFences[0]!.end).toBe(unclosedScene.length);
  });

  it("12. [P2-4] escapes pipes in serialized table cells, rejects newlines, and verifies column count invariance", () => {
    const defaultBinding: FactBinding = {
      factId: "cp.pipe.default",
      pageId: "context-parallel",
      repo: "vllm-ascend",
      path: "vllm_ascend/attention/utils.py",
      qualifiedSymbol: "mode",
      kind: "default",
      target: { tableHeading: "版本差异", rowKey: "开关默认门控", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldVal: FactValue = { kind: "default", expr: "enable_pcp=False" };
    const pipeVal: FactValue = { kind: "default", expr: "a | b", valueType: "int | None" };

    const plan = planSurgicalFactPatch(SAMPLE_PAGE, defaultBinding, oldVal, pipeVal, {
      oldCommit: "8d6180e2",
      newCommit: "9e7291f3",
    });
    if (plan.noop) throw new Error("Expected replaceCell plan for pipe value");
    const patched = applySurgicalFactPatch(SAMPLE_PAGE, plan);
    expect(patched).toContain("| 开关默认门控 | `enable_pcp=False` | `a \\| b` (int \\| None) |");
    expect(verifySurgicalCandidate(SAMPLE_PAGE, patched, plan).verified).toBe(true);

    // Reject newline in table cell value
    const newlineVal: FactValue = { kind: "default", expr: "a\nb" };
    expect(() =>
      planSurgicalFactPatch(SAMPLE_PAGE, defaultBinding, oldVal, newlineVal, {
        oldCommit: "8d6180e2",
        newCommit: "9e7291f3",
      }),
    ).toThrow(/newline/i);

    // verifySurgicalCandidate rejects raw unescaped pipe breaking column count
    const rawPipeCandidate = SAMPLE_PAGE.replace(
      "| 开关默认门控 | `enable_pcp=False` | `enable_pcp=False` |",
      "| 开关默认门控 | `enable_pcp=False` | `a | b` |",
    );
    expect(() =>
      verifySurgicalCandidate(SAMPLE_PAGE, rawPipeCandidate, plan.allowedSpans, plan.protectedEnvelopeHash),
    ).toThrow(/column count|GFM table/i);
  });

  it("13. [P2-5] diffFactValue preserves whitespace inside quoted literals while normalizing outside whitespace", () => {
    expect(diffFactValue({ kind: "default", expr: '"a  b"' }, { kind: "default", expr: '"a b"' })).toBe(
      "value-changed",
    );
    expect(diffFactValue({ kind: "default", expr: "'a  b'" }, { kind: "default", expr: "'a b'" })).toBe(
      "value-changed",
    );
    expect(
      diffFactValue({ kind: "default", expr: 'x  =  "a  b"' }, { kind: "default", expr: 'x = "a  b"' }),
    ).toBe("unchanged");
  });

  it("14. [P1-3] detects narrative conflict on rerun without contradictsValues and blocks page-level verified via pageBindings", () => {
    const page = [
      "---",
      "id: guard-rerun",
      "verified:",
      "  - releases/v0.30.0",
      "---",
      "",
      "## Overview",
      "",
      "The default is off.",
      "",
      "## 对照源码",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 开关 A | `on` |",
      "| 开关 B | `ok` |",
      "",
    ].join("\n");
    const bindingA: FactBinding = {
      factId: "flag.a",
      pageId: "guard-rerun",
      repo: "vllm-ascend",
      path: "a.py",
      qualifiedSymbol: "FLAG_A",
      kind: "default",
      target: { rowKey: "开关 A", versionColumn: "main" },
      narrativeGuards: [{ sectionHeading: "Overview", anchorQuote: "The default is off." }],
    };
    const bindingB: FactBinding = {
      factId: "flag.b",
      pageId: "guard-rerun",
      repo: "vllm-ascend",
      path: "b.py",
      qualifiedSymbol: "FLAG_B",
      kind: "default",
      target: { rowKey: "开关 B", versionColumn: "main" },
      narrativeGuards: [],
    };
    const valOn: FactValue = { kind: "default", expr: "on" };
    const rerunA = planSurgicalFactPatch(page, bindingA, valOn, valOn, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    expect(rerunA.canCertifyVerified).toBe(false);
    expect(rerunA.narrativeConflicts).toHaveLength(1);

    const valOk: FactValue = { kind: "default", expr: "ok" };
    const rerunB = planSurgicalFactPatch(page, bindingB, valOk, valOk, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
      pageBindings: [bindingA, bindingB],
    });
    expect(rerunB.canCertifyVerified).toBe(false);
    expect(rerunB.narrativeConflicts.length).toBeGreaterThanOrEqual(1);
    expect(rerunB.noop).toBe(true);
  });

  it("15. [P1-4] preserves inner spaces in quoted strings for manual third-state detection and space-shrink updates", () => {
    const page = [
      "---",
      "id: spaces-test",
      "verified:",
      "  - main",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      '| 间隔 | `"a  b"` |',
      "",
    ].join("\n");
    const binding: FactBinding = {
      factId: "str.spaces",
      pageId: "spaces-test",
      repo: "vllm-ascend",
      path: "s.py",
      qualifiedSymbol: "S",
      kind: "default",
      target: { rowKey: "间隔", versionColumn: "main" },
      narrativeGuards: [],
    };
    const conflictPlan = planSurgicalFactPatch(
      page,
      binding,
      { kind: "default", expr: '"a b"' },
      { kind: "default", expr: '"c"' },
      { oldCommit: "1111111", newCommit: "2222222", verifiedTag: "main" },
    );
    expect(conflictPlan.canCertifyVerified).toBe(false);
    expect(conflictPlan.manualConflicts).toHaveLength(1);

    const updatePlan = planSurgicalFactPatch(
      page,
      binding,
      { kind: "default", expr: '"a  b"' },
      { kind: "default", expr: '"a b"' },
      { oldCommit: "1111111", newCommit: "2222222" },
    );
    expect(updatePlan.noop).toBe(false);
    if (updatePlan.noop) throw new Error("Expected replaceCell plan for inner-space update");
    const updated = applySurgicalFactPatch(page, updatePlan);
    expect(updated).toContain('| 间隔 | `"a b"` |');
  });

  it("16. [P1-5] revokes verified cleanly across inline, unindented, and indented YAML forms without producing null", () => {
    const mkPage = (verifiedYaml: string) =>
      [
        "---",
        "id: yaml-unverify",
        verifiedYaml,
        "---",
        "",
        "## Overview",
        "",
        "The default is off.",
        "",
        "| 核对项 | `main` |",
        "|---|---|",
        "| 开关 | `on` |",
        "",
      ].join("\n");
    const binding: FactBinding = {
      factId: "yaml.flag",
      pageId: "yaml-unverify",
      repo: "vllm-ascend",
      path: "a.py",
      qualifiedSymbol: "F",
      kind: "default",
      target: { rowKey: "开关", versionColumn: "main" },
      narrativeGuards: [
        { sectionHeading: "Overview", anchorQuote: "The default is off.", contradictsValues: ["on"] },
      ],
    };
    const vOn: FactValue = { kind: "default", expr: "on" };

    for (const [yaml, expectRemaining] of [
      ["verified: [main]", []],
      ['verified: ["main", "v0.30.0"]', ["v0.30.0"]],
      ["verified:\n- main", []],
      ["verified:\n- main\n- v0.30.0", ["v0.30.0"]],
      ["verified:\n  - main", []],
      ["verified:\n  - main\n  - v0.30.0", ["v0.30.0"]],
    ] as const) {
      const page = mkPage(yaml);
      const plan = planSurgicalFactPatch(page, binding, vOn, vOn, {
        oldCommit: "1111111",
        newCommit: "1111111",
        verifiedTag: "main",
      });
      expect(plan.canCertifyVerified).toBe(false);
      expect(plan.noop).toBe(false);
      if (plan.noop) throw new Error(`Expected unverify edit for: ${yaml}`);
      const patched = applySurgicalFactPatch(page, plan);
      const parsed = matter(patched).data as { verified?: unknown };
      expect(parsed.verified).not.toBeNull();
      expect(parsed.verified ?? []).toEqual(expectRemaining);
    }
  });

  it("17. [P2-5] restricts sourceAnchor reanchoring to matching file path and blocks unrelated file path with manualConflict", () => {
    const page = [
      "---",
      "id: path-reanchor",
      "verified:",
      "  - main",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 锚点 | `other.py#L10` |",
      "",
    ].join("\n");
    const binding: FactBinding = {
      factId: "anchor.path",
      pageId: "path-reanchor",
      repo: "vllm-ascend",
      path: "a.py",
      qualifiedSymbol: "fn",
      kind: "sourceAnchor",
      target: { rowKey: "锚点", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldVal: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "1111111",
      path: "a.py",
      lineStart: 10,
      lineEnd: 10,
      quoteHash: "q1",
    };
    const newVal: FactValue = { ...oldVal, commit: "2222222", lineStart: 22, lineEnd: 22 };
    const plan = planSurgicalFactPatch(page, binding, oldVal, newVal, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    expect(plan.canCertifyVerified).toBe(false);
    expect(plan.manualConflicts).toHaveLength(1);
    if (!plan.noop) {
      const patched = applySurgicalFactPatch(page, plan);
      expect(patched).toContain("`other.py#L10`");
      expect(patched).not.toContain("other.py#L22");
    }
  });

  it("18. [P2-6] requires right boundary when checking whether summary already contains anchor (p.py#L100 vs p.py#L10)", () => {
    const page = [
      "---",
      "id: anchor-boundary",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 行 | Old |",
      "",
    ].join("\n");
    const binding: FactBinding = {
      factId: "anchor.boundary",
      pageId: "anchor-boundary",
      repo: "vllm-ascend",
      path: "p.py",
      qualifiedSymbol: "fn",
      kind: "versionMatrixCell",
      target: { rowKey: "行", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldVal: FactValue = { kind: "versionMatrixCell", status: "old", summary: "Old" };
    const newVal: FactValue = {
      kind: "versionMatrixCell",
      status: "new",
      summary: "See p.py#L100",
      anchor: "p.py#L10",
    };
    const plan = planSurgicalFactPatch(page, binding, oldVal, newVal, {
      oldCommit: "1111111",
      newCommit: "2222222",
    });
    expect(plan.noop).toBe(false);
    if (plan.noop) throw new Error("Expected replaceCell plan");
    const patched = applySurgicalFactPatch(page, plan);
    expect(patched).toContain("| 行 | See p.py#L100（`p.py#L10`） |");
  });

  it("19. [P2-7] protects wiki-diagram and wiki-scene fences inside markdown blockquotes (closed and unclosed)", () => {
    const quoted = [
      "---",
      "id: bq-fence",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 入口 | `p.py#L10` |",
      "",
      "普通引用：`vllm-ascend@1111111:p.py#L10`",
      "",
      "> ```wiki-diagram",
      "> file: diag-in-quote",
      "> ref: vllm-ascend@1111111:p.py#L10",
      "> ```",
      "",
      "> > ~~~wiki-scene",
      "> > scene-unclosed:1",
      "> > vllm-ascend@1111111:p.py#L10",
    ].join("\n");
    const fences = extractProtectedFences(quoted);
    expect(fences).toHaveLength(2);
    expect(fences[0]!.kind).toBe("wiki-diagram");
    expect(fences[1]!.kind).toBe("wiki-scene");
    expect(fences[1]!.end).toBe(quoted.length);

    const insideDiagram = quoted.indexOf("diag-in-quote");
    expect(() =>
      computeProtectedEnvelopeHash(quoted, [{ start: insideDiagram, end: insideDiagram + 4, reason: "bq" }]),
    ).toThrow(/overlaps protected wiki-diagram fence/);

    const binding: FactBinding = {
      factId: "bq.reanchor",
      pageId: "bq-fence",
      repo: "vllm-ascend",
      path: "p.py",
      qualifiedSymbol: "fn",
      kind: "sourceAnchor",
      target: { rowKey: "入口", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldVal: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "1111111",
      path: "p.py",
      lineStart: 10,
      lineEnd: 10,
      quoteHash: "q1",
    };
    const newVal: FactValue = { ...oldVal, commit: "2222222", lineStart: 22, lineEnd: 22 };
    const plan = planSurgicalFactPatch(quoted, binding, oldVal, newVal, {
      oldCommit: "1111111",
      newCommit: "2222222",
      oldSourceRef: "vllm-ascend@1111111:p.py#L10",
      newSourceRef: "vllm-ascend@2222222:p.py#L22",
    });
    if (plan.noop) throw new Error("Expected reanchor plan");
    const patched = applySurgicalFactPatch(quoted, plan);
    expect(patched).toContain("普通引用：`vllm-ascend@2222222:p.py#L22`");
    expect(patched).toContain("> ref: vllm-ascend@1111111:p.py#L10");
    expect(patched).toContain("> > vllm-ascend@1111111:p.py#L10");
  });

  it("20. [P2-8] tightens 4-arg verifySurgicalCandidate using AllowedSpan replacement metadata to reject A1B2C -> ABX2C", () => {
    const orig = "A1B2C";
    const spans = [
      { start: 1, end: 2, reason: "replace-cell", replacementLength: 1 },
      { start: 3, end: 4, reason: "source-ref", replacementLength: 1 },
    ];
    const hash = computeProtectedEnvelopeHash(orig, spans);
    expect(verifySurgicalCandidate(orig, "AXBYC", spans, hash).verified).toBe(true);
    expect(() => verifySurgicalCandidate(orig, "ABX2C", spans, hash)).toThrow(/Protected envelope tampered/i);

    // Unpinned multi-span 4-arg call without replacementLength must also be rejected rather than falling back to indexOf
    const bareSpans = [
      { start: 1, end: 2, reason: "replace-cell" },
      { start: 3, end: 4, reason: "source-ref" },
    ];
    expect(() => verifySurgicalCandidate(orig, "ABX2C", bareSpans, hash)).toThrow(
      /Protected envelope|replacementLength/i,
    );
  });

  it("21. [P1-3-edge] catches cross-lingual rerun conflict (on -> on vs 该开关默认关闭) and pageBindings conflict when A cell summary hides status", () => {
    const page = [
      "---",
      "id: zh-guard-rerun",
      "verified:",
      "  - releases/v0.30.0",
      "---",
      "",
      "## Overview",
      "",
      "该开关默认关闭。",
      "",
      "## 对照源码",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 开关 A | `on` |",
      "| 开关 B | `ok` |",
      "| 路径 C | 现行路径 |",
      "",
    ].join("\n");
    const bindingA: FactBinding = {
      factId: "flag.a",
      pageId: "zh-guard-rerun",
      repo: "vllm-ascend",
      path: "a.py",
      qualifiedSymbol: "FLAG_A",
      kind: "default",
      target: { rowKey: "开关 A", versionColumn: "main" },
      narrativeGuards: [{ sectionHeading: "Overview", anchorQuote: "该开关默认关闭。" }],
    };
    const rerunA = planSurgicalFactPatch(
      page,
      bindingA,
      { kind: "default", expr: "on" },
      { kind: "default", expr: "on" },
      { oldCommit: "1111111", newCommit: "2222222", verifiedTag: "main" },
    );
    expect(rerunA.canCertifyVerified).toBe(false);
    expect(rerunA.narrativeConflicts).toHaveLength(1);

    const bindingC: FactBinding = {
      factId: "path.c",
      pageId: "zh-guard-rerun",
      repo: "vllm-ascend",
      path: "c.py",
      qualifiedSymbol: "PATH_C",
      kind: "versionMatrixCell",
      target: { rowKey: "路径 C", versionColumn: "main" },
      narrativeGuards: [
        { sectionHeading: "Overview", anchorQuote: "该开关默认关闭。", contradictsValues: ["enabled"] },
      ],
    };
    const bindingB: FactBinding = {
      factId: "flag.b",
      pageId: "zh-guard-rerun",
      repo: "vllm-ascend",
      path: "b.py",
      qualifiedSymbol: "FLAG_B",
      kind: "default",
      target: { rowKey: "开关 B", versionColumn: "main" },
      narrativeGuards: [],
    };
    const rerunB = planSurgicalFactPatch(
      page,
      bindingB,
      { kind: "default", expr: "ok" },
      { kind: "default", expr: "ok" },
      { oldCommit: "1111111", newCommit: "2222222", verifiedTag: "main", pageBindings: [bindingC, bindingB] },
    );
    expect(rerunB.canCertifyVerified).toBe(false);
    expect(rerunB.narrativeConflicts.length).toBeGreaterThanOrEqual(1);
    expect(rerunB.noop).toBe(true);
  });

  it("22. [P1-5-edge] handles inline trailing YAML comment and blank-line-separated block lists when revoking verified", () => {
    const mkPage = (verifiedYaml: string) =>
      [
        "---",
        "id: yaml-edge",
        verifiedYaml,
        "---",
        "",
        "## Overview",
        "",
        "The default is off.",
        "",
        "| 核对项 | `main` |",
        "|---|---|",
        "| 开关 | `on` |",
        "",
      ].join("\n");
    const binding: FactBinding = {
      factId: "yaml.edge",
      pageId: "yaml-edge",
      repo: "vllm-ascend",
      path: "a.py",
      qualifiedSymbol: "F",
      kind: "default",
      target: { rowKey: "开关", versionColumn: "main" },
      narrativeGuards: [{ sectionHeading: "Overview", anchorQuote: "The default is off." }],
    };
    const vOn: FactValue = { kind: "default", expr: "on" };

    for (const [yaml, expectRemaining] of [
      ["verified: [main] # note", []],
      ['verified: ["main", "v0.30.0"] # note', ["v0.30.0"]],
      ["verified:\n  - main\n\n  - releases/v0.30.0", ["releases/v0.30.0"]],
      ["verified:\n  - main\n  # keep next\n  - releases/v0.30.0", ["releases/v0.30.0"]],
    ] as const) {
      const page = mkPage(yaml);
      const plan = planSurgicalFactPatch(page, binding, vOn, vOn, {
        oldCommit: "1111111",
        newCommit: "1111111",
        verifiedTag: "main",
      });
      expect(plan.noop).toBe(false);
      if (plan.noop) throw new Error(`Expected unverify edit for: ${yaml}`);
      const patched = applySurgicalFactPatch(page, plan);
      const parsed = matter(patched).data as { verified?: unknown };
      expect(Array.isArray(parsed.verified)).toBe(true);
      expect(parsed.verified).toEqual(expectRemaining);
    }
  });

  it("23. [P2-5-edge] bare #L10 oldSourceRef only reanchors matching binding path and never rewrites other.py#L10", () => {
    const page = [
      "---",
      "id: bare-anchor-reanchor",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 入口 | `a.py#L10` |",
      "",
      "正文引用：`a.py#L10` 与 `other.py#L10`。",
      "",
    ].join("\n");
    const binding: FactBinding = {
      factId: "bare.anchor",
      pageId: "bare-anchor-reanchor",
      repo: "vllm-ascend",
      path: "a.py",
      qualifiedSymbol: "fn",
      kind: "sourceAnchor",
      target: { rowKey: "入口", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldVal: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "1111111",
      path: "a.py",
      lineStart: 10,
      lineEnd: 10,
      quoteHash: "q1",
    };
    const newVal: FactValue = { ...oldVal, commit: "2222222", lineStart: 22, lineEnd: 22 };
    const plan = planSurgicalFactPatch(page, binding, oldVal, newVal, {
      oldCommit: "1111111",
      newCommit: "2222222",
      oldSourceRef: "#L10",
      newSourceRef: "#L22",
    });
    expect(plan.noop).toBe(false);
    if (plan.noop) throw new Error("Expected reanchor plan");
    const patched = applySurgicalFactPatch(page, plan);
    expect(patched).toContain("`a.py#L22`");
    expect(patched).toContain("`other.py#L10`");
    expect(patched).not.toContain("other.py#L22");
  });

  it("24. [P2-7-edge] deeper nested blockquote fence (> > ~~~) does not prematurely close outer (> ~~~wiki-scene)", () => {
    const page = [
      "---",
      "id: nested-bq-fence",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 入口 | `p.py#L10` |",
      "",
      "> ~~~wiki-scene",
      "> > ~~~",
      "> ref: vllm-ascend@1111111:p.py#L10",
      "> ~~~",
      "",
      "外层引用：`vllm-ascend@1111111:p.py#L10`",
      "",
    ].join("\n");
    const fences = extractProtectedFences(page);
    expect(fences).toHaveLength(1);
    expect(fences[0]!.content).toContain("> ref: vllm-ascend@1111111:p.py#L10");

    const binding: FactBinding = {
      factId: "nested.bq",
      pageId: "nested-bq-fence",
      repo: "vllm-ascend",
      path: "p.py",
      qualifiedSymbol: "fn",
      kind: "sourceAnchor",
      target: { rowKey: "入口", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldVal: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "1111111",
      path: "p.py",
      lineStart: 10,
      lineEnd: 10,
      quoteHash: "q1",
    };
    const newVal: FactValue = { ...oldVal, commit: "2222222", lineStart: 22, lineEnd: 22 };
    const plan = planSurgicalFactPatch(page, binding, oldVal, newVal, {
      oldCommit: "1111111",
      newCommit: "2222222",
      oldSourceRef: "vllm-ascend@1111111:p.py#L10",
      newSourceRef: "vllm-ascend@2222222:p.py#L22",
    });
    if (plan.noop) throw new Error("Expected reanchor plan");
    const patched = applySurgicalFactPatch(page, plan);
    expect(patched).toContain("> ref: vllm-ascend@1111111:p.py#L10");
    expect(patched).toContain("外层引用：`vllm-ascend@2222222:p.py#L22`");
  });

  it("25. [C1] matches full repo@commit:path#L... atomically (syncing cell commit SHA with frontmatter), scopes bare #L... to target column, and skips code/calc/math blocks", () => {
    const page = [
      "---",
      "id: c1-source-ref",
      "sources:",
      "  - 'vllm-ascend@1111111:vllm_ascend/a.py#L10-L12'",
      "  - 'vllm-ascend@8888888:vllm_ascend/a.py#L10-L12'",
      "verified:",
      "  - v0.30.0",
      "---",
      "",
      "正文裸锚点 `a.py#L10-L12` 与行内公式 $x_{a.py#L10-L12} + 1$ 不应被裸替换。",
      "",
      "$$",
      "f(a.py#L10-L12) = vllm-ascend@1111111:vllm_ascend/a.py#L10-L12",
      "$$",
      "",
      "```python",
      "# vllm-ascend@1111111:vllm_ascend/a.py#L10-L12",
      "ref = 'a.py#L10-L12'",
      "```",
      "",
      "~~~calc",
      "cost = a.py#L10-L12",
      "~~~",
      "",
      "## 对照源码",
      "",
      "| 核对项 | `v0.30.0` | `main` |",
      "|---|---|---|",
      "| 锚点 | `vllm-ascend@1111111:vllm_ascend/a.py#L10-L12` | `a.py#L10-L12` |",
      "",
    ].join("\n");

    const binding: FactBinding = {
      factId: "c1.anchor",
      pageId: "c1-source-ref",
      repo: "vllm-ascend",
      path: "vllm_ascend/a.py",
      qualifiedSymbol: "fn",
      kind: "sourceAnchor",
      target: { tableHeading: "对照源码", rowKey: "锚点", versionColumn: "v0.30.0" },
      narrativeGuards: [],
    };
    const oldVal: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "1111111",
      path: "vllm_ascend/a.py",
      lineStart: 10,
      lineEnd: 12,
      quoteHash: "qh1",
    };
    const newVal: FactValue = { ...oldVal, commit: "2222222", lineStart: 20, lineEnd: 24 };

    const plan = planSurgicalFactPatch(page, binding, oldVal, newVal, {
      oldCommit: "1111111",
      newCommit: "2222222",
      oldSourceRef: "#L10-L12",
      newSourceRef: "#L20-L24",
    });
    expect(plan.noop).toBe(false);
    if (plan.noop) throw new Error("Expected C1 reanchor plan");
    const patched = applySurgicalFactPatch(page, plan);

    // Target cell full token updated atomically with new commit SHA matching frontmatter
    expect(patched).toContain("| 锚点 | `vllm-ascend@2222222:vllm_ascend/a.py#L20-L24` | `a.py#L10-L12` |");
    // Frontmatter matching commit updated; other commit untouched
    expect(patched).toContain("  - 'vllm-ascend@2222222:vllm_ascend/a.py#L20-L24'");
    expect(patched).toContain("  - 'vllm-ascend@8888888:vllm_ascend/a.py#L10-L12'");
    // Bare prose, inline math, display math, python fence, and calc fence all untouched
    expect(patched).toContain("正文裸锚点 `a.py#L10-L12` 与行内公式 $x_{a.py#L10-L12} + 1$ 不应被裸替换。");
    expect(patched).toContain("f(a.py#L10-L12) = vllm-ascend@1111111:vllm_ascend/a.py#L10-L12");
    expect(patched).toContain("# vllm-ascend@1111111:vllm_ascend/a.py#L10-L12");
    expect(patched).toContain("cost = a.py#L10-L12");
  });

  it("26. [C2] enforces frontmatter pageId match, ignores indented/fenced/math pseudo-tables, matches exact heading title, and fails closed on duplicate tables/rows/columns", () => {
    const baseBinding: FactBinding = {
      factId: "c2.fact",
      pageId: "expected-page",
      repo: "vllm-ascend",
      path: "a.py",
      qualifiedSymbol: "X",
      kind: "default",
      target: { tableHeading: "Version", rowKey: "项 A", versionColumn: "main" },
      narrativeGuards: [],
    };
    const vOld: FactValue = { kind: "default", expr: "1" };
    const vNew: FactValue = { kind: "default", expr: "2" };

    // 1. Frontmatter pageId mismatch rejected
    const wrongIdPage =
      "---\nid: wrong-page\n---\n\n## Version\n\n| 核对项 | `main` |\n|---|---|\n| 项 A | `1` |\n";
    expect(() =>
      planSurgicalFactPatch(wrongIdPage, baseBinding, vOld, vNew, {
        oldCommit: "1111111",
        newCommit: "2222222",
      }),
    ).toThrow(/pageId|Page ID/i);

    // 2. Prefix heading `## Version Archive` must NOT match `tableHeading: "Version"`, and indented/math pseudo-tables ignored
    const archiveAndPseudoPage = [
      "---",
      "id: expected-page",
      "---",
      "",
      "## Version Archive",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 项 A | `999` |",
      "",
      "## Version",
      "",
      "    | 核对项 | `main` |",
      "    |---|---|",
      "    | 项 A | `888` |",
      "",
      "$$",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 项 A | `777` |",
      "$$",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 项 A | `1` |",
      "",
    ].join("\n");

    const plan = planSurgicalFactPatch(archiveAndPseudoPage, baseBinding, vOld, vNew, {
      oldCommit: "1111111",
      newCommit: "2222222",
    });
    if (plan.noop) throw new Error("Expected replaceCell on real ## Version table");
    const patched = applySurgicalFactPatch(archiveAndPseudoPage, plan);
    expect(patched).toContain("| 项 A | `999` |");
    expect(patched).toContain("    | 项 A | `888` |");
    expect(patched).toContain("| 项 A | `777` |");
    expect(patched).toContain("| 项 A | `2` |");

    // 3. Ambiguous duplicate tables / rows / columns fail closed
    const dupTablePage = [
      "---",
      "id: expected-page",
      "---",
      "",
      "## Version",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 项 A | `1` |",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 项 A | `1` |",
      "",
    ].join("\n");
    expect(() =>
      planSurgicalFactPatch(dupTablePage, baseBinding, vOld, vNew, {
        oldCommit: "1111111",
        newCommit: "2222222",
      }),
    ).toThrow(/Ambiguous/i);

    const dupRowPage = [
      "---",
      "id: expected-page",
      "---",
      "",
      "## Version",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 项 A | `1` |",
      "| 项 A | `1` |",
      "",
    ].join("\n");
    expect(() =>
      planSurgicalFactPatch(dupRowPage, baseBinding, vOld, vNew, {
        oldCommit: "1111111",
        newCommit: "2222222",
      }),
    ).toThrow(/Ambiguous/i);

    const dupColPage = [
      "---",
      "id: expected-page",
      "---",
      "",
      "## Version",
      "",
      "| 核对项 | `main` | `main` (dup) |",
      "|---|---|---|",
      "| 项 A | `1` | `1` |",
      "",
    ].join("\n");
    expect(() =>
      planSurgicalFactPatch(dupColPage, baseBinding, vOld, vNew, {
        oldCommit: "1111111",
        newCommit: "2222222",
      }),
    ).toThrow(/Ambiguous/i);
  });

  it("27. [C3] preserves manual prose and second independent ref (other.py#L30) in source cells instead of overwriting the whole cell", () => {
    const page = [
      "---",
      "id: c3-prose-cell",
      "verified:",
      "  - main",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 锚点 | `a.py#L10` 人工注释与 `other.py#L30` 联合门控 |",
      "",
    ].join("\n");
    const binding: FactBinding = {
      factId: "c3.anchor",
      pageId: "c3-prose-cell",
      repo: "vllm-ascend",
      path: "a.py",
      qualifiedSymbol: "fn",
      kind: "sourceAnchor",
      target: { rowKey: "锚点", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldVal: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "1111111",
      path: "a.py",
      lineStart: 10,
      lineEnd: 10,
      quoteHash: "q1",
    };

    // File move with identical quoteHash -> replaces ONLY matched source span, preserving prose & other.py#L30
    const movedVal: FactValue = {
      ...oldVal,
      commit: "2222222",
      path: "sub/a.py",
      lineStart: 25,
      lineEnd: 25,
    };
    const movePlan = planSurgicalFactPatch(page, binding, oldVal, movedVal, {
      oldCommit: "1111111",
      newCommit: "2222222",
    });
    expect(movePlan.noop).toBe(false);
    if (movePlan.noop) throw new Error("Expected span-only replacement on file move");
    const movedPatched = applySurgicalFactPatch(page, movePlan);
    expect(movedPatched).toContain("| 锚点 | `sub/a.py#L25` 人工注释与 `other.py#L30` 联合门控 |");

    // Semantic quoteHash change in cell containing manual prose & other.py#L30 -> reports manualConflicts and never clobbers prose
    const semanticChangedVal: FactValue = {
      ...oldVal,
      commit: "2222222",
      lineStart: 25,
      lineEnd: 25,
      quoteHash: "q2",
    };
    const conflictPlan = planSurgicalFactPatch(page, binding, oldVal, semanticChangedVal, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    expect(conflictPlan.canCertifyVerified).toBe(false);
    expect(conflictPlan.manualConflicts).toHaveLength(1);
    if (!conflictPlan.noop) {
      const afterConflict = applySurgicalFactPatch(page, conflictPlan);
      expect(afterConflict).toContain("人工注释与 `other.py#L30` 联合门控");
    }
  });

  it("28. [C4] pads short GFM rows to header width when appending a new version column so the value lands in the new column index", () => {
    const shortRowPage = [
      "---",
      "id: c4-short-row",
      "---",
      "",
      "| 核对项 | `v0.30.0` | `main` |",
      "|---|---|---|",
      "| 完整行 | `A` | `B` |",
      "| 短尾行 | `C` |",
      "",
    ].join("\n");
    const binding: FactBinding = {
      factId: "c4.short",
      pageId: "c4-short-row",
      repo: "vllm-ascend",
      path: "a.py",
      qualifiedSymbol: "S",
      kind: "default",
      target: { rowKey: "短尾行", versionColumn: "v0.31.0" },
      narrativeGuards: [],
    };
    const plan = planSurgicalFactPatch(
      shortRowPage,
      binding,
      { kind: "default", expr: "C" },
      { kind: "default", expr: "NEW" },
      { oldCommit: "1111111", newCommit: "2222222", newColumnHeader: "`v0.31.0`" },
    );
    expect(plan.noop).toBe(false);
    if (plan.noop) throw new Error("Expected appendVersionColumn plan");
    const patched = applySurgicalFactPatch(shortRowPage, plan);
    // Short row had 2 cells (missing `main`), so it must be padded to 3 before appending column 4 (`v0.31.0`)
    expect(patched).toContain("| 短尾行 | `C` | | `NEW` |");
    expect(patched).toContain("| 完整行 | `A` | `B` | — |");
  });

  it("29. [C5] enforces replacementLength/replacementSha256 parity in applySurgicalFactPatch & 3-arg verification, and keeps custom newColumnHeader idempotent", () => {
    const page = [
      "---",
      "id: c5-parity",
      "verified:",
      "  - v0.30.0",
      "---",
      "",
      "| 核对项 | `v0.30.0` |",
      "|---|---|",
      "| 开关 | `False` |",
      "",
    ].join("\n");
    const binding: FactBinding = {
      factId: "c5.flag",
      pageId: "c5-parity",
      repo: "vllm-ascend",
      path: "a.py",
      qualifiedSymbol: "FLAG",
      kind: "default",
      target: { rowKey: "开关", versionColumn: "releases/v0.31.0" },
      narrativeGuards: [],
    };
    const oldVal: FactValue = { kind: "default", expr: "False" };
    const newVal: FactValue = { kind: "default", expr: "True" };
    const meta = {
      oldCommit: "1111111",
      newCommit: "2222222",
      newColumnHeader: "RC1 基线 (`2222222`)",
      verifiedTag: "releases/v0.31.0",
    };

    const plan1 = planSurgicalFactPatch(page, binding, oldVal, newVal, meta);
    expect(plan1.noop).toBe(false);
    if (plan1.noop) throw new Error("Expected appendVersionColumn plan");

    // Tamper edit.newText without updating allowedSpans replacementSha256/replacementLength -> both applySurgicalFactPatch and 3-arg verifySurgicalCandidate must reject
    const tamperedPatch = {
      ...plan1,
      edits: plan1.edits.map((e) =>
        e.reason === "append-column-target-cell" ? { ...e, newText: " `HACK` |" } : e,
      ),
    };
    expect(() => applySurgicalFactPatch(page, tamperedPatch)).toThrow(
      /replacementLength|replacementSha256|hash mismatch/i,
    );

    const patched = applySurgicalFactPatch(page, plan1);
    expect(() =>
      verifySurgicalCandidate(page, patched.replace("`True`", "`FAKE`"), {
        ...plan1,
        edits: plan1.edits.map((e) =>
          e.reason === "append-column-target-cell" ? { ...e, newText: " `FAKE` |" } : e,
        ),
      }),
    ).toThrow(/replacementLength|replacementSha256|hash mismatch/i);

    // Rerunning with custom newColumnHeader that doesn't literally contain "releases/v0.31.0" must be noop, NOT duplicate column!
    const plan2 = planSurgicalFactPatch(patched, binding, oldVal, newVal, meta);
    expect(plan2.noop).toBe(true);
  });

  it("30. [R2-P1-1] prevents root a.py vs vllm_ascend/a.py suffix collision, updates commit-only frontmatter SHA (#L10 -> #L10), and refuses certification on conflicting embedded commit", () => {
    const collisionPage = [
      "---",
      "id: r2-path-collision",
      "sources:",
      "  - 'vllm-ascend@1111111:a.py#L10'",
      "  - 'vllm-ascend@1111111:vllm_ascend/a.py#L10'",
      "verified:",
      "  - main",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 根文件 | `a.py#L10` |",
      "| 子模块 | `vllm_ascend/a.py#L10` |",
      "",
    ].join("\n");

    const subBinding: FactBinding = {
      factId: "r2.sub",
      pageId: "r2-path-collision",
      repo: "vllm-ascend",
      path: "vllm_ascend/a.py",
      qualifiedSymbol: "sub_fn",
      kind: "sourceAnchor",
      target: { rowKey: "子模块", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldSub: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "1111111",
      path: "vllm_ascend/a.py",
      lineStart: 10,
      lineEnd: 10,
      quoteHash: "q1",
    };

    // 1. Commit-only update (#L10 -> #L10, 1111111 -> 2222222) updates ONLY vllm_ascend/a.py in frontmatter, never root a.py!
    const sameLineNew: FactValue = { ...oldSub, commit: "2222222" };
    const commitOnlyPlan = planSurgicalFactPatch(collisionPage, subBinding, oldSub, sameLineNew, {
      oldCommit: "1111111",
      newCommit: "2222222",
      oldSourceRef: "#L10",
      newSourceRef: "#L10",
    });
    expect(commitOnlyPlan.noop).toBe(false);
    if (commitOnlyPlan.noop) throw new Error("Expected commit-only frontmatter update");
    const afterCommitOnly = applySurgicalFactPatch(collisionPage, commitOnlyPlan);
    expect(afterCommitOnly).toContain("  - 'vllm-ascend@1111111:a.py#L10'");
    expect(afterCommitOnly).toContain("  - 'vllm-ascend@2222222:vllm_ascend/a.py#L10'");
    expect(afterCommitOnly).toContain("| 根文件 | `a.py#L10` |");

    // 2. Line-shift on vllm_ascend/a.py must NOT touch root a.py#L10 in frontmatter or other row
    const shiftedSub: FactValue = { ...oldSub, commit: "2222222", lineStart: 24, lineEnd: 24 };
    const shiftPlan = planSurgicalFactPatch(collisionPage, subBinding, oldSub, shiftedSub, {
      oldCommit: "1111111",
      newCommit: "2222222",
      oldSourceRef: "vllm-ascend@1111111:vllm_ascend/a.py#L10",
      newSourceRef: "vllm-ascend@2222222:vllm_ascend/a.py#L24",
    });
    if (shiftPlan.noop) throw new Error("Expected shift plan");
    const afterShift = applySurgicalFactPatch(collisionPage, shiftPlan);
    expect(afterShift).toContain("  - 'vllm-ascend@1111111:a.py#L10'");
    expect(afterShift).toContain("| 根文件 | `a.py#L10` |");
    expect(afterShift).toContain("| 子模块 | `vllm_ascend/a.py#L24` |");

    // 3. Conflicting embedded commit (meta.newCommit = 2222222 vs fact value commit = 3333333) refuses certification
    const mismatchVal: FactValue = { ...oldSub, commit: "3333333", lineStart: 24, lineEnd: 24 };
    const mismatchPlan = planSurgicalFactPatch(collisionPage, subBinding, oldSub, mismatchVal, {
      oldCommit: "1111111",
      newCommit: "2222222",
      oldSourceRef: "#L10",
      newSourceRef: "#L24",
      verifiedTag: "releases/v0.31.0",
    });
    expect(mismatchPlan.canCertifyVerified).toBe(false);
    expect(mismatchPlan.manualConflicts.length).toBeGreaterThan(0);
  });

  it("31. [R2-P1-2] skips fenced ## 对照源码 when scanning narrative conflicts and inspects ALL matching sibling rows in pageBindings", () => {
    const page = [
      "---",
      "id: r2-narrative-fenced",
      "verified:",
      "  - v0.30.0",
      "---",
      "",
      "```markdown",
      "## 对照源码",
      "示例代码块里的伪标题不应截断正文扫描",
      "```",
      "",
      "## Overview",
      "",
      "The default is off.",
      "",
      "## 对照源码",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 开关 A | `off` |",
      "| 开关 A | `on` |",
      "| 开关 B | `ok` |",
      "",
    ].join("\n");

    const bindingA: FactBinding = {
      factId: "r2.flag.a",
      pageId: "r2-narrative-fenced",
      repo: "vllm-ascend",
      path: "a.py",
      qualifiedSymbol: "FLAG_A",
      kind: "default",
      target: { rowKey: "开关 A", versionColumn: "main" },
      narrativeGuards: [{ sectionHeading: "Overview", anchorQuote: "The default is off." }],
    };
    const bindingB: FactBinding = {
      factId: "r2.flag.b",
      pageId: "r2-narrative-fenced",
      repo: "vllm-ascend",
      path: "b.py",
      qualifiedSymbol: "FLAG_B",
      kind: "default",
      target: { rowKey: "开关 B", versionColumn: "main" },
      narrativeGuards: [],
    };

    const planB = planSurgicalFactPatch(
      page,
      bindingB,
      { kind: "default", expr: "ok" },
      { kind: "default", expr: "ok" },
      { oldCommit: "1111111", newCommit: "2222222", verifiedTag: "main", pageBindings: [bindingA, bindingB] },
    );
    expect(planB.canCertifyVerified).toBe(false);
    expect(planB.narrativeConflicts.length).toBeGreaterThan(0);
  });

  it("32. [R2-P2-P3] protects :::calc & cell inline math, preserves [a.py#L10](notes.md) links, updates bare column refs on full oldSourceRef, handles trailing-pipeless GFM rows, ## Sources#, empty newColumnHeader, and unsorted spans", () => {
    const page = [
      "---",
      "id: r2-p2-p3",
      "sources:",
      "  - 'vllm-ascend@1111111:a.py#L10'",
      "---",
      "",
      ":::calc",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 主项 | `999` |",
      ":::",
      "",
      "## Sources#",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 主项 | `888` |",
      "",
      "## Sources",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 主项 | [a.py#L10](handwritten-notes.md) 配合公式 $f(a.py#L10)$ |",
      "| 同列伴随项 | 详见 `a.py#L10`",
      "",
    ].join("\n");

    const binding: FactBinding = {
      factId: "r2.p2",
      pageId: "r2-p2-p3",
      repo: "vllm-ascend",
      path: "a.py",
      qualifiedSymbol: "fn",
      kind: "sourceAnchor",
      target: { tableHeading: "Sources", rowKey: "主项", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldVal: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "1111111",
      path: "a.py",
      lineStart: 10,
      lineEnd: 10,
      quoteHash: "q1",
    };
    const newVal: FactValue = { ...oldVal, commit: "2222222", path: "sub/a.py", lineStart: 25, lineEnd: 25 };

    const plan = planSurgicalFactPatch(page, binding, oldVal, newVal, {
      oldCommit: "1111111",
      newCommit: "2222222",
      oldSourceRef: "vllm-ascend@1111111:a.py#L10",
      newSourceRef: "vllm-ascend@2222222:sub/a.py#L25",
    });
    expect(plan.noop).toBe(false);
    if (plan.noop) throw new Error("Expected surgical plan");

    // Reversing allowedSpans and edits order must still apply & verify identically!
    const reversedPatch = {
      ...plan,
      allowedSpans: [...plan.allowedSpans].reverse(),
      edits: [...plan.edits].reverse(),
    };
    const patched = applySurgicalFactPatch(page, reversedPatch);
    expect(verifySurgicalCandidate(page, patched, reversedPatch).verified).toBe(true);

    // Handwritten link preserved, inline cell math untouched, other row in same column updated, :::calc & ## Sources# untouched!
    expect(patched).toContain("| 主项 | [sub/a.py#L25](handwritten-notes.md) 配合公式 $f(a.py#L10)$ |");
    expect(patched).toContain("| 同列伴随项 | 详见 `sub/a.py#L25`");
    expect(patched).toContain("| 主项 | `999` |");
    expect(patched).toContain("| 主项 | `888` |");

    // Appending a version column with trailing-pipeless row and empty newColumnHeader: "" stays idempotent
    const appendBinding: FactBinding = {
      ...binding,
      kind: "default",
      target: { tableHeading: "Sources", rowKey: "同列伴随项", versionColumn: "v0.31.0" },
    };
    const appendMeta = { oldCommit: "1111111", newCommit: "2222222", newColumnHeader: "" };
    const appendPlan1 = planSurgicalFactPatch(
      page,
      appendBinding,
      { kind: "default", expr: "old" },
      { kind: "default", expr: "NEW_COL" },
      appendMeta,
    );
    expect(appendPlan1.noop).toBe(false);
    if (appendPlan1.noop) throw new Error("Expected append plan");
    const appended = applySurgicalFactPatch(page, appendPlan1);
    expect(appended).toContain("| 同列伴随项 | 详见 `a.py#L10` | `NEW_COL` |");

    const appendPlan2 = planSurgicalFactPatch(
      appended,
      appendBinding,
      { kind: "default", expr: "old" },
      { kind: "default", expr: "NEW_COL" },
      appendMeta,
    );
    expect(appendPlan2.noop).toBe(true);
  });

  it("33. [R3-P1-1-2] scopes versionMatrixCell bare #L10 reanchor to binding path in multi-ref cells and migrates frontmatter SHA when sourceAnchor omits oldSourceRef/newSourceRef", () => {
    // 1. P1-1: versionMatrixCell with bare #L10 -> #L25 inside a cell containing BOTH `a.py#L10` and `vllm_ascend/a.py#L10`
    const multiRefCellPage = [
      "---",
      "id: r3-matrix-multiref",
      "sources:",
      "  - 'vllm-ascend@1111111:a.py#L10'",
      "  - 'vllm-ascend@1111111:vllm_ascend/a.py#L10'",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 组合门控 | 根入口 `a.py#L10` 与子模块 `vllm_ascend/a.py#L10` 同步放行 |",
      "",
    ].join("\n");

    const matrixBinding: FactBinding = {
      factId: "r3.matrix.sub",
      pageId: "r3-matrix-multiref",
      repo: "vllm-ascend",
      path: "vllm_ascend/a.py",
      qualifiedSymbol: "sub_gate",
      kind: "versionMatrixCell",
      target: { rowKey: "组合门控", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldCell: FactValue = {
      kind: "versionMatrixCell",
      status: "ok",
      summary: "根入口 `a.py#L10` 与子模块 `vllm_ascend/a.py` 同步放行",
      anchor: "#L10",
    };
    const newCell: FactValue = { ...oldCell, anchor: "#L25" };

    const matrixPlan = planSurgicalFactPatch(multiRefCellPage, matrixBinding, oldCell, newCell, {
      oldCommit: "1111111",
      newCommit: "2222222",
      oldSourceRef: "vllm-ascend@1111111:vllm_ascend/a.py#L10",
      newSourceRef: "vllm-ascend@2222222:vllm_ascend/a.py#L25",
    });
    expect(matrixPlan.noop).toBe(false);
    if (matrixPlan.noop) throw new Error("Expected matrix reanchor plan");
    const matrixPatched = applySurgicalFactPatch(multiRefCellPage, matrixPlan);
    expect(matrixPatched).toContain(
      "| 组合门控 | 根入口 `a.py#L10` 与子模块 `vllm_ascend/a.py#L25` 同步放行 |",
    );
    expect(matrixPatched).toContain("  - 'vllm-ascend@1111111:a.py#L10'");
    expect(matrixPatched).toContain("  - 'vllm-ascend@2222222:vllm_ascend/a.py#L25'");

    // 2. P1-2: sourceAnchor commit-only update WITHOUT meta.oldSourceRef / meta.newSourceRef must still migrate frontmatter SHA (or block verified if frontmatter remains stale)
    const omitRefPage = [
      "---",
      "id: r3-omit-sourceref",
      "sources:",
      "  - 'vllm-ascend@1111111:sub/a.py#L10'",
      "verified: []",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 源码锚点 | `vllm-ascend@1111111:sub/a.py#L10` |",
      "",
    ].join("\n");
    const saBinding: FactBinding = {
      factId: "r3.omit.sa",
      pageId: "r3-omit-sourceref",
      repo: "vllm-ascend",
      path: "sub/a.py",
      qualifiedSymbol: "fn",
      kind: "sourceAnchor",
      target: { rowKey: "源码锚点", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldSa: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "1111111",
      path: "sub/a.py",
      lineStart: 10,
      lineEnd: 10,
      quoteHash: "q1",
    };
    const newSa: FactValue = { ...oldSa, commit: "2222222" };
    const omitPlan = planSurgicalFactPatch(omitRefPage, saBinding, oldSa, newSa, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    expect(omitPlan.noop).toBe(false);
    if (omitPlan.noop) throw new Error("Expected sourceAnchor + frontmatter SHA migration");
    const omitPatched = applySurgicalFactPatch(omitRefPage, omitPlan);
    expect(omitPatched).toContain("  - 'vllm-ascend@2222222:sub/a.py#L10'");
    expect(omitPatched).toContain("| 源码锚点 | `vllm-ascend@2222222:sub/a.py#L10` |");

    // Also test `1111111:sub/a.py#L10` and SHA blob link without oldSourceRef/newSourceRef!
    const colonAndLinkPage = omitRefPage.replace(
      "| 源码锚点 | `vllm-ascend@1111111:sub/a.py#L10` |",
      "| 源码锚点 | [`1111111:sub/a.py#L10`](https://github.com/vllm-project/vllm-ascend/blob/1111111/sub/a.py#L10) |",
    );
    const linkPlan = planSurgicalFactPatch(colonAndLinkPage, saBinding, oldSa, newSa, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    expect(linkPlan.noop).toBe(false);
    if (linkPlan.noop) throw new Error("Expected SHA link + frontmatter update");
    const linkPatched = applySurgicalFactPatch(colonAndLinkPage, linkPlan);
    expect(linkPatched).toContain("  - 'vllm-ascend@2222222:sub/a.py#L10'");
    expect(linkPatched).toContain(
      "| 源码锚点 | [`2222222:sub/a.py#L10`](https://github.com/vllm-project/vllm-ascend/blob/2222222/sub/a.py#L10) |",
    );
  });

  it("34. [R3-P1-3-4] revokes/blocks verified on missing pageBindings row/col/cell and isolates :::calc from inner code fences", () => {
    const deletedRowPage = [
      "---",
      "id: r3-sibling-missing",
      "verified:",
      "  - main",
      "---",
      "",
      "## Overview",
      "",
      "Flag A defaults to off.",
      "",
      "## 对照源码",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 开关 B | `ok` |",
      "",
    ].join("\n");
    const sibA: FactBinding = {
      factId: "r3.sib.a",
      pageId: "r3-sibling-missing",
      repo: "vllm-ascend",
      path: "a.py",
      qualifiedSymbol: "A",
      kind: "default",
      target: { rowKey: "开关 A", versionColumn: "main" },
      narrativeGuards: [{ sectionHeading: "Overview", anchorQuote: "Flag A defaults to off." }],
    };
    const sibB: FactBinding = {
      factId: "r3.sib.b",
      pageId: "r3-sibling-missing",
      repo: "vllm-ascend",
      path: "b.py",
      qualifiedSymbol: "B",
      kind: "default",
      target: { rowKey: "开关 B", versionColumn: "main" },
      narrativeGuards: [],
    };
    const revokeDeletedPlan = planSurgicalFactPatch(
      deletedRowPage,
      sibB,
      { kind: "default", expr: "ok" },
      { kind: "default", expr: "ok" },
      { oldCommit: "1111111", newCommit: "2222222", pageBindings: [sibA, sibB] },
    );
    expect(revokeDeletedPlan.canCertifyVerified).toBe(false);
    expect(revokeDeletedPlan.noop).toBe(false);

    const shortSiblingPage = [
      "---",
      "id: r3-sibling-missing",
      "verified: []",
      "---",
      "",
      "## Overview",
      "",
      "Flag A defaults to off.",
      "",
      "## 对照源码",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 开关 A |",
      "| 开关 B | `ok` |",
      "",
    ].join("\n");
    const shortSiblingPlan = planSurgicalFactPatch(
      shortSiblingPage,
      sibB,
      { kind: "default", expr: "ok" },
      { kind: "default", expr: "ok" },
      { oldCommit: "1111111", newCommit: "2222222", verifiedTag: "main", pageBindings: [sibA, sibB] },
    );
    expect(shortSiblingPlan.canCertifyVerified).toBe(false);

    const nestedFenceCalcPage = [
      "---",
      "id: r3-calc-nested-fence",
      "verified: []",
      "---",
      "",
      "## Overview",
      "",
      "The default is off.",
      "",
      ":::calc",
      "```python",
      "x = 1",
      "```",
      ":::",
      "",
      "## 对照源码",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 开关 | `off` |",
      "",
    ].join("\n");
    const calcBind: FactBinding = {
      factId: "r3.calc.flag",
      pageId: "r3-calc-nested-fence",
      repo: "vllm-ascend",
      path: "f.py",
      qualifiedSymbol: "F",
      kind: "default",
      target: { rowKey: "开关", versionColumn: "main" },
      narrativeGuards: [{ sectionHeading: "Overview", anchorQuote: "The default is off." }],
    };
    const calcConflictPlan = planSurgicalFactPatch(
      nestedFenceCalcPage,
      calcBind,
      { kind: "default", expr: "off" },
      { kind: "default", expr: "on" },
      { oldCommit: "1111111", newCommit: "2222222", verifiedTag: "main" },
    );
    expect(calcConflictPlan.canCertifyVerified).toBe(false);
    expect(calcConflictPlan.narrativeConflicts.length).toBeGreaterThan(0);
  });

  it("35. [R3-P2-6-7] applies revocation-only appendVersionColumn on SHA conflict and preserves pipeless GFM continuation rows", () => {
    const conflictAppendPage = [
      "---",
      "id: r3-revoke-append",
      "verified:",
      "  - main",
      "---",
      "",
      "| 核对项 | `v0.30.0` |",
      "|---|---|",
      "| 锚点 | `a.py#L10` |",
      "",
    ].join("\n");
    const revokeAppendBind: FactBinding = {
      factId: "r3.rev.append",
      pageId: "r3-revoke-append",
      repo: "vllm-ascend",
      path: "a.py",
      qualifiedSymbol: "fn",
      kind: "sourceAnchor",
      target: { rowKey: "锚点", versionColumn: "main" },
      narrativeGuards: [],
    };
    const revokeAppendPlan = planSurgicalFactPatch(
      conflictAppendPage,
      revokeAppendBind,
      {
        kind: "sourceAnchor",
        repo: "vllm-ascend",
        commit: "1111111",
        path: "a.py",
        lineStart: 10,
        lineEnd: 10,
        quoteHash: "q1",
      },
      {
        kind: "sourceAnchor",
        repo: "vllm-ascend",
        commit: "3333333",
        path: "a.py",
        lineStart: 20,
        lineEnd: 20,
        quoteHash: "q1",
      },
      { oldCommit: "1111111", newCommit: "2222222" },
    );
    expect(revokeAppendPlan.canCertifyVerified).toBe(false);
    expect(revokeAppendPlan.noop).toBe(false);
    if (revokeAppendPlan.noop) throw new Error("Expected revocation-only patch");
    const afterRevokeAppend = applySurgicalFactPatch(conflictAppendPage, revokeAppendPlan);
    expect(matter(afterRevokeAppend).data.verified).toEqual([]);

    const pipelessShortPage = [
      "---",
      "id: r3-pipeless-short",
      "---",
      "",
      "T | `main`",
      "---|---",
      "T | `v1`",
      "short",
      "Z | `retained`",
      "",
    ].join("\n");
    const zBind: FactBinding = {
      factId: "r3.z",
      pageId: "r3-pipeless-short",
      repo: "vllm-ascend",
      path: "z.py",
      qualifiedSymbol: "Z",
      kind: "default",
      target: { rowKey: "Z", versionColumn: "v0.31.0" },
      narrativeGuards: [],
    };
    const zPlan = planSurgicalFactPatch(
      pipelessShortPage,
      zBind,
      { kind: "default", expr: "retained" },
      { kind: "default", expr: "Z_NEW" },
      { oldCommit: "1111111", newCommit: "2222222" },
    );
    if (zPlan.noop) throw new Error("Expected append column across pipeless continuation row");
    const zPatched = applySurgicalFactPatch(pipelessShortPage, zPlan);
    expect(zPatched).toContain("short | | — |");
    expect(zPatched).toContain("Z | `retained` | `Z_NEW` |");
  });

  it("36. [R4-Inv1] uses remark-gfm AST table bounds (stopping at <!-- html -->) and exact sectionHeading matching (skipping ## Overview notes)", () => {
    // 1. P1-4: `## Overview notes` precedes exact `## Overview` -> must NOT match `Overview notes`!
    const prefixHeadingPage = [
      "---",
      "id: r4-inv1-heading",
      "verified: []",
      "---",
      "",
      "## Overview notes",
      "",
      "Unrelated intro paragraph.",
      "",
      "## Overview",
      "",
      "The default is off.",
      "",
      ":::calc",
      "```python",
      "y = 2",
      "```",
      ":::",
      "",
      "## 对照源码",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 开关 | `off` |",
      "",
    ].join("\n");
    const bind: FactBinding = {
      factId: "r4.h",
      pageId: "r4-inv1-heading",
      repo: "vllm-ascend",
      path: "f.py",
      qualifiedSymbol: "F",
      kind: "default",
      target: { rowKey: "开关", versionColumn: "main" },
      narrativeGuards: [{ sectionHeading: "Overview", anchorQuote: "The default is off." }],
    };
    const hPlan = planSurgicalFactPatch(
      prefixHeadingPage,
      bind,
      { kind: "default", expr: "off" },
      { kind: "default", expr: "on" },
      { oldCommit: "1111111", newCommit: "2222222", verifiedTag: "main" },
    );
    expect(hPlan.narrativeConflicts).toHaveLength(1);
    expect(hPlan.canCertifyVerified).toBe(false);

    // 2. P2-7: `<!-- editorial -->` + `Following prose.` immediately after table row without blank line must NOT be absorbed into table!
    const htmlInterruptPage = [
      "---",
      "id: r4-inv1-html",
      "---",
      "",
      "T | `main`",
      "---|---",
      "T | `v1`",
      "short",
      "Z | `retained`",
      "<!-- editorial -->",
      "Following prose.",
      "",
    ].join("\n");
    const zBind: FactBinding = {
      factId: "r4.z",
      pageId: "r4-inv1-html",
      repo: "vllm-ascend",
      path: "z.py",
      qualifiedSymbol: "Z",
      kind: "default",
      target: { rowKey: "Z", versionColumn: "v0.31.0" },
      narrativeGuards: [],
    };
    const htmlPlan = planSurgicalFactPatch(
      htmlInterruptPage,
      zBind,
      { kind: "default", expr: "retained" },
      { kind: "default", expr: "Z_NEW" },
      { oldCommit: "1111111", newCommit: "2222222" },
    );
    if (htmlPlan.noop) throw new Error("Expected append column plan");
    const htmlPatched = applySurgicalFactPatch(htmlInterruptPage, htmlPlan);
    expect(htmlPatched).toContain("Z | `retained` | `Z_NEW` |\n<!-- editorial -->\nFollowing prose.");
  });

  it("37. [R4-Inv2] enforces unified ref path disambiguation, file-level sources SHA migration, and atomic full-ref edit with post-projection 3-way SHA gate", () => {
    // 1. P1-1: Same cell has bare `a.py#L10` AND full `vllm-ascend@1111111:vllm_ascend/a.py#L10`, frontmatter lists ONLY subpath
    const mixedCellPage = [
      "---",
      "id: r4-inv2-mixed",
      "sources:",
      "  - 'vllm-ascend@1111111:vllm_ascend/a.py#L10'",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 门控 | 根 `a.py#L10` 与完整子路径 `vllm-ascend@1111111:vllm_ascend/a.py#L10` |",
      "",
    ].join("\n");
    const mixedBind: FactBinding = {
      factId: "r4.mixed",
      pageId: "r4-inv2-mixed",
      repo: "vllm-ascend",
      path: "vllm_ascend/a.py",
      qualifiedSymbol: "fn",
      kind: "versionMatrixCell",
      target: { rowKey: "门控", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldMixed: FactValue = {
      kind: "versionMatrixCell",
      status: "ok",
      summary: "根 `a.py#L10` 与完整子路径 `vllm-ascend@1111111:vllm_ascend/a.py`",
      anchor: "#L10",
    };
    const newMixed: FactValue = { ...oldMixed, anchor: "#L25" };
    const mixedPlan = planSurgicalFactPatch(mixedCellPage, mixedBind, oldMixed, newMixed, {
      oldCommit: "1111111",
      newCommit: "2222222",
      oldSourceRef: "vllm-ascend@1111111:vllm_ascend/a.py#L10",
      newSourceRef: "vllm-ascend@2222222:vllm_ascend/a.py#L25",
      verifiedTag: "main",
    });
    if (mixedPlan.noop) throw new Error("Expected mixed cell reanchor");
    const mixedPatched = applySurgicalFactPatch(mixedCellPage, mixedPlan);
    expect(mixedPatched).toContain(
      "| 门控 | 根 `a.py#L10` 与完整子路径 `vllm-ascend@2222222:vllm_ascend/a.py#L25` |",
    );
    expect(mixedPatched).toContain("  - 'vllm-ascend@2222222:vllm_ascend/a.py#L25'");

    // 2. P1-2: File-level `sources` entry (`vllm-ascend@1111111:sub/a.py` without `#L...`) + omitted oldSourceRef/newSourceRef
    const fileLevelSourcesPage = [
      "---",
      "id: r4-inv2-filesrc",
      "sources:",
      "  - 'vllm-ascend@1111111:sub/a.py'",
      "verified: []",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 锚点 | `vllm-ascend@1111111:sub/a.py#L10` |",
      "",
    ].join("\n");
    const fileBind: FactBinding = {
      factId: "r4.filesrc",
      pageId: "r4-inv2-filesrc",
      repo: "vllm-ascend",
      path: "sub/a.py",
      qualifiedSymbol: "fn",
      kind: "sourceAnchor",
      target: { rowKey: "锚点", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldSa: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "1111111",
      path: "sub/a.py",
      lineStart: 10,
      lineEnd: 10,
      quoteHash: "q1",
    };
    const filePlan = planSurgicalFactPatch(
      fileLevelSourcesPage,
      fileBind,
      oldSa,
      { ...oldSa, commit: "2222222" },
      { oldCommit: "1111111", newCommit: "2222222", verifiedTag: "main" },
    );
    if (filePlan.noop) throw new Error("Expected file-level sources migration");
    const filePatched = applySurgicalFactPatch(fileLevelSourcesPage, filePlan);
    expect(filePatched).toContain("  - 'vllm-ascend@2222222:sub/a.py'");
    expect(filePatched).toContain("| 锚点 | `vllm-ascend@2222222:sub/a.py#L10` |");

    // Unaligned third SHA in frontmatter `sources` (e.g. 9999999) MUST block `canCertifyVerified` via post-projection 3-way SHA gate!
    const divergedFileSrcPage = fileLevelSourcesPage.replace("1111111:sub/a.py'", "9999999:sub/a.py'");
    const divergedPlan = planSurgicalFactPatch(
      divergedFileSrcPage,
      fileBind,
      oldSa,
      { ...oldSa, commit: "2222222" },
      { oldCommit: "1111111", newCommit: "2222222", verifiedTag: "main" },
    );
    expect(divergedPlan.canCertifyVerified).toBe(false);

    // 3. P1-(1+2): versionMatrixCell with `vllm-ascend@1111111:sub/a.py#L10` in cell + `#L10 -> #L25` + `newSourceRef: 2222222`
    const comboPage = [
      "---",
      "id: r4-inv2-combo",
      "sources:",
      "  - 'vllm-ascend@1111111:sub/a.py#L10'",
      "verified: []",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 矩阵格 | `vllm-ascend@1111111:sub/a.py#L10` |",
      "",
    ].join("\n");
    const comboBind: FactBinding = {
      ...fileBind,
      pageId: "r4-inv2-combo",
      kind: "versionMatrixCell",
      target: { rowKey: "矩阵格", versionColumn: "main" },
    };
    const oldCombo: FactValue = {
      kind: "versionMatrixCell",
      status: "ok",
      summary: "`vllm-ascend@1111111:sub/a.py`",
      anchor: "#L10",
    };
    const comboPlan = planSurgicalFactPatch(
      comboPage,
      comboBind,
      oldCombo,
      { ...oldCombo, anchor: "#L25" },
      {
        oldCommit: "1111111",
        newCommit: "2222222",
        oldSourceRef: "vllm-ascend@1111111:sub/a.py#L10",
        newSourceRef: "vllm-ascend@2222222:sub/a.py#L25",
        verifiedTag: "main",
      },
    );
    if (comboPlan.noop) throw new Error("Expected atomic full-ref matrix update");
    const comboPatched = applySurgicalFactPatch(comboPage, comboPlan);
    expect(comboPatched).toContain("| 矩阵格 | `vllm-ascend@2222222:sub/a.py#L25` |");
    expect(comboPatched).toContain("  - 'vllm-ascend@2222222:sub/a.py#L25'");
    expect(comboPlan.canCertifyVerified).toBe(true);
  });

  it("38. [R5-P1-1-2 & R5-P2-3] scopes implicit anchor derivation to bound path, validates line anchors & GitHub blob URLs strictly inside YAML sources:, and preserves versionMatrixCell rerun idempotency", () => {
    // 1. P1-1a: Mixed cell (`a.py#L10` + `vllm-ascend@1111111:vllm_ascend/a.py#L10`) with omitted oldSourceRef/newSourceRef
    const mixedImplicitPage = [
      "---",
      "id: r5-mixed-implicit",
      "sources:",
      "  - 'vllm-ascend@1111111:vllm_ascend/a.py#L10'",
      "verified: []",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 门控 | 根 `a.py#L10` 与子路径 `vllm-ascend@1111111:vllm_ascend/a.py#L10` |",
      "",
    ].join("\n");
    const mixedBind: FactBinding = {
      factId: "r5.mixed",
      pageId: "r5-mixed-implicit",
      repo: "vllm-ascend",
      path: "vllm_ascend/a.py",
      qualifiedSymbol: "fn",
      kind: "versionMatrixCell",
      target: { rowKey: "门控", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldMixed: FactValue = {
      kind: "versionMatrixCell",
      status: "ok",
      summary: "根 `a.py#L10` 与子路径 `vllm-ascend@1111111:vllm_ascend/a.py`",
      anchor: "#L10",
    };
    const newMixed: FactValue = { ...oldMixed, anchor: "#L25" };
    const implicitPlan = planSurgicalFactPatch(mixedImplicitPage, mixedBind, oldMixed, newMixed, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    expect(implicitPlan.noop).toBe(false);
    if (implicitPlan.noop) throw new Error("Expected mixed implicit reanchor plan");
    expect(implicitPlan.canCertifyVerified).toBe(true);
    const implicitPatched = applySurgicalFactPatch(mixedImplicitPage, implicitPlan);
    expect(implicitPatched).toContain("  - 'vllm-ascend@2222222:vllm_ascend/a.py#L25'");
    expect(implicitPatched).toContain(
      "| 门控 | 根 `a.py#L10` 与子路径 `vllm-ascend@2222222:vllm_ascend/a.py#L25` |",
    );

    // 2. P1-1b: Post-projection 3-way gate rejects `#L` line mismatch in frontmatter `sources:` even when SHA matches!
    const wrongLineSourcesPage = mixedImplicitPage.replace(
      "  - 'vllm-ascend@1111111:vllm_ascend/a.py#L10'",
      "  - 'vllm-ascend@2222222:vllm_ascend/a.py#L99'",
    );
    const wrongLinePlan = planSurgicalFactPatch(wrongLineSourcesPage, mixedBind, oldMixed, newMixed, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    expect(wrongLinePlan.canCertifyVerified).toBe(false);
    expect(wrongLinePlan.manualConflicts.length).toBeGreaterThan(0);

    // 3. P1-2: GitHub `blob/<sha>/<path>(#L...)` URL in YAML `sources:` migrates & gates SHA+line, without touching `summary:` or `#` comments!
    const githubBlobPage = [
      "---",
      "id: r5-github-blob",
      'summary: "Pinned ref vllm-ascend@1111111:sub/a.py#L10 and https://github.com/vllm-project/vllm-ascend/blob/1111111/sub/a.py#L10"',
      "# comment: vllm-ascend@1111111:sub/a.py#L10",
      "sources:",
      "  - 'https://github.com/vllm-project/vllm-ascend/blob/1111111/sub/a.py#L10' # inline vllm-ascend@1111111:sub/a.py#L10",
      "verified: []",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 锚点 | `vllm-ascend@1111111:sub/a.py#L10` |",
      "",
    ].join("\n");
    const ghBind: FactBinding = {
      factId: "r5.gh",
      pageId: "r5-github-blob",
      repo: "vllm-ascend",
      path: "sub/a.py",
      qualifiedSymbol: "fn",
      kind: "sourceAnchor",
      target: { rowKey: "锚点", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldSa: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "1111111",
      path: "sub/a.py",
      lineStart: 10,
      lineEnd: 10,
      quoteHash: "q1",
    };
    const newSa: FactValue = { ...oldSa, commit: "2222222", lineStart: 25, lineEnd: 25 };
    const ghPlan = planSurgicalFactPatch(githubBlobPage, ghBind, oldSa, newSa, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    expect(ghPlan.noop).toBe(false);
    if (ghPlan.noop) throw new Error("Expected GitHub blob sources migration");
    expect(ghPlan.canCertifyVerified).toBe(true);
    const ghPatched = applySurgicalFactPatch(githubBlobPage, ghPlan);
    expect(ghPatched).toContain(
      "  - 'https://github.com/vllm-project/vllm-ascend/blob/2222222/sub/a.py#L25' # inline vllm-ascend@1111111:sub/a.py#L10",
    );
    expect(ghPatched).toContain(
      'summary: "Pinned ref vllm-ascend@1111111:sub/a.py#L10 and https://github.com/vllm-project/vllm-ascend/blob/1111111/sub/a.py#L10"',
    );
    expect(ghPatched).toContain("# comment: vllm-ascend@1111111:sub/a.py#L10");

    // Diverged GitHub blob URL in `sources:` (stale SHA 9999999) MUST block `canCertifyVerified`!
    const divergedGhPage = githubBlobPage.replace("blob/1111111/sub/a.py#L10'", "blob/9999999/sub/a.py#L10'");
    const divergedGhPlan = planSurgicalFactPatch(divergedGhPage, ghBind, oldSa, newSa, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    expect(divergedGhPlan.canCertifyVerified).toBe(false);

    // 4. P2-3: Re-running versionMatrixCell patch with `newSourceRef: 2222222` on already-patched page MUST be idempotent (`noop: true`, `canCertifyVerified: true`, `verified: [main]` preserved)!
    const rerunImplicitPlan = planSurgicalFactPatch(implicitPatched, mixedBind, oldMixed, newMixed, {
      oldCommit: "1111111",
      newCommit: "2222222",
      oldSourceRef: "vllm-ascend@1111111:vllm_ascend/a.py#L10",
      newSourceRef: "vllm-ascend@2222222:vllm_ascend/a.py#L25",
      verifiedTag: "main",
    });
    expect(rerunImplicitPlan.noop).toBe(true);
    expect(rerunImplicitPlan.canCertifyVerified).toBe(true);
    expect(rerunImplicitPlan.manualConflicts).toEqual([]);
    expect(matter(implicitPatched).data.verified).toEqual(["main"]);
  });

  it("39. [R6-1-2-3-4] parses YAML sources: via yaml AST, maps rfork vs vllm-ascend owner/repo, scopes post-projection #L gate to bound path, and keeps path-renamed versionMatrixCell reruns idempotent", () => {
    // 1. R6-1: Multiline flow array `sources: [\n  "..."\n]` & inline comment containing `]` (`# keep ... ]`)
    const multilineFlowPage = [
      "---",
      "id: r6-yaml-flow",
      "sources: [",
      '  "https://github.com/vllm-project/vllm-ascend/blob/1111111/vllm_ascend/a.py#L10"',
      "] # keep vllm-ascend@1111111:vllm_ascend/a.py#L10 ]",
      "verified: []",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 锚点 | `vllm-ascend@1111111:vllm_ascend/a.py#L10` |",
      "",
    ].join("\n");
    const saBind: FactBinding = {
      factId: "r6.sa",
      pageId: "r6-yaml-flow",
      repo: "vllm-ascend",
      path: "vllm_ascend/a.py",
      qualifiedSymbol: "fn",
      kind: "sourceAnchor",
      target: { rowKey: "锚点", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldSa: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "1111111",
      path: "vllm_ascend/a.py",
      lineStart: 10,
      lineEnd: 10,
      quoteHash: "q1",
    };
    const newSa: FactValue = { ...oldSa, commit: "2222222", lineStart: 25, lineEnd: 25 };
    const flowPlan = planSurgicalFactPatch(multilineFlowPage, saBind, oldSa, newSa, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    if (flowPlan.noop) throw new Error("Expected multiline flow sources migration");
    const flowPatched = applySurgicalFactPatch(multilineFlowPage, flowPlan);
    expect(flowPatched).toContain(
      '  "https://github.com/vllm-project/vllm-ascend/blob/2222222/vllm_ascend/a.py#L25"',
    );
    expect(flowPatched).toContain("] # keep vllm-ascend@1111111:vllm_ascend/a.py#L10 ]");

    const inlineBracketCommentPage = [
      "---",
      "id: r6-yaml-flow",
      "sources: ['vllm-ascend@1111111:vllm_ascend/a.py#L10'] # keep vllm-ascend@1111111:vllm_ascend/a.py#L10 ]",
      "verified: []",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 锚点 | `vllm-ascend@1111111:vllm_ascend/a.py#L10` |",
      "",
    ].join("\n");
    const bracketCommentPlan = planSurgicalFactPatch(inlineBracketCommentPage, saBind, oldSa, newSa, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    if (bracketCommentPlan.noop) throw new Error("Expected inline bracket comment plan");
    const bracketCommentPatched = applySurgicalFactPatch(inlineBracketCommentPage, bracketCommentPlan);
    expect(bracketCommentPatched).toContain(
      "sources: ['vllm-ascend@2222222:vllm_ascend/a.py#L25'] # keep vllm-ascend@1111111:vllm_ascend/a.py#L10 ]",
    );

    // 2. R6-2: `owner/repo <-> repoId` (`yangsonglin13/vllm-ascend` <-> `rfork`, `vllm-project/vllm-ascend` <-> `vllm-ascend`)
    const rforkPage = [
      "---",
      "id: r6-rfork",
      "sources:",
      "  - 'https://github.com/yangsonglin13/vllm-ascend/tree/1111111/vllm_ascend/a.py#L10'",
      "  - 'https://github.com/vllm-project/vllm-ascend/blob/1111111/vllm_ascend/a.py#L10'",
      "verified: []",
      "---",
      "",
      "| 核对项 | `rfork` |",
      "|---|---|",
      "| 锚点 | [rfork](https://github.com/yangsonglin13/vllm-ascend/tree/1111111/vllm_ascend/a.py#L10) 对照 [upstream](https://github.com/vllm-project/vllm-ascend/blob/1111111/vllm_ascend/a.py#L10) |",
      "",
    ].join("\n");
    const rforkBind: FactBinding = {
      ...saBind,
      pageId: "r6-rfork",
      repo: "rfork",
      target: { rowKey: "锚点", versionColumn: "rfork" },
    };
    const oldRforkSa: FactValue = { ...oldSa, repo: "rfork" };
    const newRforkSa: FactValue = { ...newSa, repo: "rfork" };
    const rforkPlan = planSurgicalFactPatch(rforkPage, rforkBind, oldRforkSa, newRforkSa, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "rfork",
    });
    if (rforkPlan.noop) throw new Error("Expected rfork migration");
    expect(rforkPlan.canCertifyVerified).toBe(true);
    const rforkPatched = applySurgicalFactPatch(rforkPage, rforkPlan);
    expect(rforkPatched).toContain(
      "https://github.com/yangsonglin13/vllm-ascend/tree/2222222/vllm_ascend/a.py#L25",
    );
    expect(rforkPatched).toContain(
      "https://github.com/vllm-project/vllm-ascend/blob/1111111/vllm_ascend/a.py#L10",
    );

    // 3. R6-3: Post-projection `sources:` `#L` gate MUST NOT let root `a.py#L10` in the cell excuse a stale `vllm_ascend/a.py#L10` entry in `sources:`!
    const pollutedSourcesPage = [
      "---",
      "id: r6-polluted-sources",
      "sources:",
      "  - 'vllm-ascend@1111111:vllm_ascend/a.py#L10'",
      "  - 'https://github.com/vllm-project/vllm-ascend/blob/2222222/vllm_ascend/a.py#L10'",
      "verified: []",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 门控 | 根 `a.py#L10` 与子路径 `vllm-ascend@1111111:vllm_ascend/a.py#L10` |",
      "",
    ].join("\n");
    const mixedBind: FactBinding = {
      factId: "r6.mixed",
      pageId: "r6-polluted-sources",
      repo: "vllm-ascend",
      path: "vllm_ascend/a.py",
      qualifiedSymbol: "fn",
      kind: "versionMatrixCell",
      target: { rowKey: "门控", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldMixed: FactValue = {
      kind: "versionMatrixCell",
      status: "ok",
      summary: "根 `a.py#L10` 与子路径 `vllm-ascend@1111111:vllm_ascend/a.py`",
      anchor: "#L10",
    };
    const newMixed: FactValue = { ...oldMixed, anchor: "#L25" };
    const pollutedPlan = planSurgicalFactPatch(pollutedSourcesPage, mixedBind, oldMixed, newMixed, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    expect(pollutedPlan.canCertifyVerified).toBe(false);
    expect(pollutedPlan.manualConflicts.length).toBeGreaterThan(0);

    // 4. R6-4: `versionMatrixCell` with path rename (`vllm_ascend/a.py -> vllm_ascend/b.py`) in `newSourceRef` is idempotent on rerun and never touches root `a.py#L10`!
    const renameMatrixPage = [
      "---",
      "id: r6-rename-matrix",
      "sources:",
      "  - 'vllm-ascend@1111111:vllm_ascend/a.py#L10'",
      "verified: []",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 门控 | 根 `a.py#L10` 与子路径 `vllm-ascend@1111111:vllm_ascend/a.py#L10` |",
      "",
    ].join("\n");
    const renameBind: FactBinding = { ...mixedBind, pageId: "r6-rename-matrix" };
    const renameMeta = {
      oldCommit: "1111111",
      newCommit: "2222222",
      oldSourceRef: "vllm-ascend@1111111:vllm_ascend/a.py#L10",
      newSourceRef: "vllm-ascend@2222222:vllm_ascend/b.py#L25",
      verifiedTag: "main",
    };
    const renamePlan1 = planSurgicalFactPatch(renameMatrixPage, renameBind, oldMixed, newMixed, renameMeta);
    expect(renamePlan1.noop).toBe(false);
    if (renamePlan1.noop) throw new Error("Expected matrix path-rename plan");
    const renamePatched = applySurgicalFactPatch(renameMatrixPage, renamePlan1);
    expect(renamePatched).toContain(
      "| 门控 | 根 `a.py#L10` 与子路径 `vllm-ascend@2222222:vllm_ascend/b.py#L25` |",
    );
    expect(renamePatched).toContain("  - 'vllm-ascend@2222222:vllm_ascend/b.py#L25'");

    const renamePlan2 = planSurgicalFactPatch(renamePatched, renameBind, oldMixed, newMixed, renameMeta);
    expect(renamePlan2.noop).toBe(true);
    expect(renamePlan2.canCertifyVerified).toBe(true);
    expect(renamePlan2.manualConflicts).toEqual([]);
  });

  it("40. [R7-1 & R7-2] requires target cell #L anchors to be covered in YAML sources: and decodes YAML double-quoted escape sequences (\\u0023L...)", () => {
    // 1. R7-1: Target row migrates to `pkg/a.py#L25`, sibling row in same column still has `pkg/a.py#L10`, and `sources:` only has `pkg/a.py#L10` (missing `#L25`!)
    const missingCellAnchorInSourcesPage = [
      "---",
      "id: r7-missing-target-anchor",
      "sources:",
      "  - 'vllm-ascend@2222222:pkg/a.py#L10'",
      "verified: []",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 目标行 | `pkg/a.py#L15` |",
      "| 伴随行 | `pkg/a.py#L10` |",
      "",
    ].join("\n");
    const bind: FactBinding = {
      factId: "r7.target",
      pageId: "r7-missing-target-anchor",
      repo: "vllm-ascend",
      path: "pkg/a.py",
      qualifiedSymbol: "fn",
      kind: "sourceAnchor",
      target: { rowKey: "目标行", versionColumn: "main" },
      narrativeGuards: [],
    };
    const oldSa15: FactValue = {
      kind: "sourceAnchor",
      repo: "vllm-ascend",
      commit: "1111111",
      path: "pkg/a.py",
      lineStart: 15,
      lineEnd: 15,
      quoteHash: "q1",
    };
    const oldSa: FactValue = { ...oldSa15, lineStart: 10, lineEnd: 10 };
    const newSa: FactValue = { ...oldSa15, commit: "2222222", lineStart: 25, lineEnd: 25 };
    const missingPlan = planSurgicalFactPatch(missingCellAnchorInSourcesPage, bind, oldSa15, newSa, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    expect(missingPlan.canCertifyVerified).toBe(false);
    expect(missingPlan.manualConflicts.length).toBeGreaterThan(0);

    // 2. R7-2a: YAML double-quoted escape `"vllm-ascend@2222222:pkg/a.py\u0023L99"` decodes to `#L99` -> MUST block `canCertifyVerified`!
    const escapedMismatchPage = [
      "---",
      "id: r7-missing-target-anchor",
      "sources:",
      '  - "vllm-ascend@2222222:pkg/a.py\\u0023L99"',
      "verified: []",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 目标行 | `pkg/a.py#L10` |",
      "",
    ].join("\n");
    const escapedMismatchPlan = planSurgicalFactPatch(escapedMismatchPage, bind, oldSa, newSa, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    expect(escapedMismatchPlan.canCertifyVerified).toBe(false);
    expect(escapedMismatchPlan.manualConflicts.length).toBeGreaterThan(0);

    // 3. R7-2b: YAML double-quoted escape `"vllm-ascend@1111111:pkg/a.py\u0023L10"` decodes to `#L10` -> migrates cleanly to unescaped `#L25`!
    const escapedMatchPage = [
      "---",
      "id: r7-missing-target-anchor",
      "sources:",
      '  - "vllm-ascend@1111111:pkg/a.py\\u0023L10"',
      "verified: []",
      "---",
      "",
      "| 核对项 | `main` |",
      "|---|---|",
      "| 目标行 | `pkg/a.py#L10` |",
      "",
    ].join("\n");
    const escapedMatchPlan = planSurgicalFactPatch(escapedMatchPage, bind, oldSa, newSa, {
      oldCommit: "1111111",
      newCommit: "2222222",
      verifiedTag: "main",
    });
    expect(escapedMatchPlan.noop).toBe(false);
    if (escapedMatchPlan.noop) throw new Error("Expected escaped YAML scalar migration");
    expect(escapedMatchPlan.canCertifyVerified).toBe(true);
    const escapedPatched = applySurgicalFactPatch(escapedMatchPage, escapedMatchPlan);
    expect(escapedPatched).toContain('  - "vllm-ascend@2222222:pkg/a.py#L25"');
  });
});
