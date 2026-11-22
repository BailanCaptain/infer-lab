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
});
