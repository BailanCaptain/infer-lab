import { describe, expect, it } from "vitest";
import { collectPageFactDispositions } from "./fact-disposition";
import { parsePage } from "./pages";
import { revisePage, revisionSchema, splitHistory, verifyRevision } from "./revisions";
import { digest } from "./workflow";

const source = "r@1234567:config.py#L1";
const page = (body: string) =>
  `---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [${source}]\nevidence: I\nupdated: '2026-09-15'\n---\n## 一句话\n${body}\n`;
const before = page("X 默认开启。");
const after = page("X 已被移除。");
const decision = revisionSchema.parse({
  id: "a",
  kind: "supersede",
  reason: "版本变更",
  claims: [{ old: "X 默认开启。", replacement: "X 已被移除。", sources: [source] }],
});

describe("explicit page revision history", () => {
  it("publishes only the current explanation and rejects legacy tails even on unchanged proposals", () => {
    expect(revisePage("sources/a.md", before, after, decision, "2026-11-03")).toBe(after);
    const legacy = `${after}\n## 已废弃的说法\n\n### 2026-09-15 · 修订 aaaaaaaaaaaaaaaa\n旧结论。\n`;
    expect(() => verifyRevision("sources/a.md", legacy, legacy, undefined, "")).toThrow(/历史/);
  });
  it("does not add historical sources to the parser cache of the supplied new page", () => {
    const oldSource = "r@7654321:old.py#L1";
    const older = before.replace(source, oldSource);
    const result = revisePage("sources/a.md", older, after, decision, "2026-09-15");
    expect(parsePage("sources/a.md", result).page!.fm.sources).toEqual([source]);
    expect(parsePage("sources/a.md", after).page!.fm.sources).toEqual([source]);
  });
  it("revalidates sealed history before approval, including proposals made before this policy", () => {
    expect(() => verifyRevision("sources/a.md", before, after, undefined, "")).toThrow(/修订分类/);
    const result = revisePage("sources/a.md", before, after, decision, "2026-09-15");
    expect(() => verifyRevision("sources/a.md", before, result, decision, "2026-09-15")).not.toThrow();
    expect(() =>
      verifyRevision(
        "sources/a.md",
        before,
        `${result}\n## 已废弃的说法\n伪造旧文。`,
        decision,
        "2026-09-15",
      ),
    ).toThrow(/历史/);
  });
  it("requires a disposition for a changed existing body", () => {
    expect(() => revisePage("sources/a.md", before, after, undefined, "2026-09-15")).toThrow(/修订分类/);
  });
  it("keeps the replacement and current evidence without repeating the recorded old claim", () => {
    const result = revisePage("sources/a.md", before, after, decision, "2026-09-15");
    expect(result).not.toContain("## 已废弃的说法");
    expect(result).not.toContain("X 默认开启。");
    expect(result).toContain("X 已被移除。");
    expect(result).toContain("2026-09-15");
    expect(result).toContain(source);
  });
  it("does not label a pure supplement as obsolete, and catches deletion disguised as a supplement", () => {
    const addition = revisionSchema.parse({ id: "a", kind: "supplement", reason: "补充边界" });
    expect(
      revisePage("sources/a.md", before, `${before}\n仅适用于旧版。\n`, addition, "2026-09-15"),
    ).not.toContain("已废弃的说法");
    expect(() => revisePage("sources/a.md", before, after, addition, "2026-09-15")).toThrow(/补充.*删改/);
  });
  it.each(["old", "replacement", "sources"])("rejects a fabricated %s in a supersession", (field) => {
    const value = JSON.parse(JSON.stringify(decision));
    value.claims[0][field] = field === "sources" ? ["https://example.test/fake"] : "不存在的说法";
    expect(() =>
      revisePage("sources/a.md", before, after, revisionSchema.parse(value), "2026-09-15"),
    ).toThrow();
  });
  it("accepts a legacy baseline but requires a clean candidate and refuses forged history", () => {
    const first = `${after}\n## 已废弃的说法\nX 默认开启。\n`;
    const nextCandidate = page("X 已被移除。此处指新版。");
    const firstActive = splitHistory(parsePage("sources/a.md", first).page!.body).active;
    const nextActive = splitHistory(parsePage("sources/a.md", nextCandidate).page!.body).active;
    const editorial = revisionSchema.parse({
      id: "a",
      kind: "editorial",
      reason: "说明版本范围，不改变结论",
      factDispositions: [
        {
          pageId: "a",
          baseHash: digest(firstActive),
          candidateHash: digest(nextActive),
          fact: "X 已被移除。",
          outlet: "retained",
          verification: "semantic-check",
          targetQuote: "X 已被移除。此处指新版。",
          reason: "原移除结论保留并补充版本范围说明",
        },
      ],
    });
    const second = revisePage("sources/a.md", first, nextCandidate, editorial, "2026-09-16");
    expect(second).not.toContain("X 默认开启。");
    expect(second).not.toContain("## 已废弃的说法");
    expect(() =>
      revisePage("sources/a.md", first, first.replace("X 默认开启。", "伪造旧文"), editorial, "2026-09-16"),
    ).toThrow(/历史/);
  });
});

describe("three-outlet fact disposition verification", () => {
  const pinnedCommit = "db701c1fd31de40ab028628ee2580ae68c7fd3c0";
  const srcA = `https://github.com/vllm-project/vllm-ascend/blob/${pinnedCommit}/vllm_ascend/config.py#L10-L20`;
  const srcB = `https://github.com/vllm-project/vllm-ascend/blob/${pinnedCommit}/vllm_ascend/config.py#L45-L58`;
  const srcC = `https://github.com/vllm-project/vllm-ascend/blob/${pinnedCommit}/vllm_ascend/worker.py#L80-L92`;

  const conceptPage = (id: string, sources: string[], body: string, relations = "") =>
    [
      "---",
      `id: ${id}`,
      `title: ${id}`,
      "type: concept",
      "summary: 概念说明",
      `sources: ${JSON.stringify(sources)}`,
      relations ? `relations:\n${relations}` : "",
      'evidence: "C"',
      "updated: '2026-11-15'",
      "---",
      body,
      "",
    ]
      .filter(Boolean)
      .join("\n");

  it("forbids pseudo-criterion #1: editorial dropping version or hardware qualifiers fails even when sources count increases", () => {
    const oldDoc = conceptPage(
      "chunked-demo",
      [srcA, srcB],
      "## 核心机制\n开启 `enable_chunked_prefill` 时，仅在 v0.26.0rc 与 Atlas A2 上启用融合路径，默认预算为 2048 token。\n\n## 对照源码\n### 源码位置\n见配置入口 [C1][C2]。",
    );
    const droppedQualifiersDoc = conceptPage(
      "chunked-demo",
      [srcA, srcB, srcC],
      "## 核心机制\n开启 `enable_chunked_prefill` 时启用融合路径，默认预算为 2048 token。\n\n## 对照源码\n### 源码位置\n见配置入口 [C1][C2][C3]。",
    );
    const editorial = revisionSchema.parse({
      id: "chunked-demo",
      kind: "editorial",
      reason: "精简正文句式",
    });
    expect(() =>
      revisePage("concepts/chunked-demo.md", oldDoc, droppedQualifiersDoc, editorial, "2026-11-15"),
    ).toThrow(/事实去向/);
  });

  it("forbids pseudo-criterion #2: editorial deleting an unbadged negation or boundary condition fails", () => {
    const oldDoc = conceptPage(
      "hybrid-demo",
      [srcA],
      "## 核心机制\n混合注意力模型默认预算为 640 token。\n当开启 `enable_prefix_caching` 时，混合注意力模型不支持该路径。\n\n## 对照源码\n### 源码位置\n块大小推导见 [C1]。",
    );
    const deletedUnbadgedSentence = conceptPage(
      "hybrid-demo",
      [srcA],
      "## 核心机制\n混合注意力模型默认预算为 640 token。\n\n## 对照源码\n### 源码位置\n块大小推导见 [C1]。",
    );
    const editorial = revisionSchema.parse({
      id: "hybrid-demo",
      kind: "editorial",
      reason: "清理无独占角标句子",
    });
    expect(() =>
      revisePage("concepts/hybrid-demo.md", oldDoc, deletedUnbadgedSentence, editorial, "2026-11-15"),
    ).toThrow(/事实去向/);
  });

  it("outlet 1 (retained): verbatim relocation passes deterministically, while non-verbatim paraphrase requires a sealed semantic-check receipt", () => {
    const oldDoc = conceptPage(
      "super-kernel-demo",
      [srcA, srcB],
      "## 核心机制\n给定材料中的 `enable_super_kernel` 在 v0.26.0 与 Atlas A2 下默认为 `False` [C1]，仅在 `enable_static_kernel = True` 时跟随开启 [C2]。\n\n## 对照源码\n### 源码位置\n见 `AscendCompilationConfig`。",
    );
    const verbatimRelocatedDoc = conceptPage(
      "super-kernel-demo",
      [srcA, srcB],
      "## 核心机制\n`enable_super_kernel` 在 v0.26.0 与 Atlas A2 下默认为 `False`，仅在 `enable_static_kernel = True` 时跟随开启。\n\n## 对照源码\n### 源码位置\n见 `AscendCompilationConfig` [C1][C2]。",
    );
    const editorialPlain = revisionSchema.parse({
      id: "super-kernel-demo",
      kind: "editorial",
      reason: "去除给定材料残留并将机器角标移入对照源码",
    });
    expect(() =>
      revisePage("concepts/super-kernel-demo.md", oldDoc, verbatimRelocatedDoc, editorialPlain, "2026-11-15"),
    ).not.toThrow();

    const paraphrasedDoc = conceptPage(
      "super-kernel-demo",
      [srcA, srcB],
      "## 核心机制\n`enable_super_kernel` 默认关闭（`False`），仅在 `enable_static_kernel = True` 时自动跟随开启，适用 Atlas A2。\n\n## 对照源码\n### 源码位置\n见 `AscendCompilationConfig`。\n\n### 版本差异\n| 版本 | 行为 |\n| --- | --- |\n| v0.26.0 | `enable_super_kernel` 默认为 `False`，跟随 `enable_static_kernel = True` [C1][C2] |",
    );
    expect(() =>
      revisePage("concepts/super-kernel-demo.md", oldDoc, paraphrasedDoc, editorialPlain, "2026-11-15"),
    ).toThrow(/事实去向/);

    const oldActive = splitHistory(parsePage("concepts/super-kernel-demo.md", oldDoc).page!.body).active;
    const nextActive = splitHistory(
      parsePage("concepts/super-kernel-demo.md", paraphrasedDoc).page!.body,
    ).active;
    const editorialSealed = revisionSchema.parse({
      id: "super-kernel-demo",
      kind: "editorial",
      reason: "去除给定材料残留并将机器角标与版本表归入对照源码",
      factDispositions: [
        {
          pageId: "super-kernel-demo",
          baseHash: digest(oldActive),
          candidateHash: digest(nextActive),
          fact: "给定材料中的 `enable_super_kernel` 在 v0.26.0 与 Atlas A2 下默认为 `False` [C1]，仅在 `enable_static_kernel = True` 时跟随开启 [C2]。",
          outlet: "retained",
          verification: "semantic-check",
          targetQuote:
            "| v0.26.0 | `enable_super_kernel` 默认为 `False`，跟随 `enable_static_kernel = True` [C1][C2] |",
          reason: "正文保留 Atlas A2 与默认关闭条件，版本差异表完整保留 v0.26.0 与跟随开启逻辑",
        },
      ],
    });
    expect(() =>
      revisePage("concepts/super-kernel-demo.md", oldDoc, paraphrasedDoc, editorialSealed, "2026-11-15"),
    ).not.toThrow();
  });

  it("outlet 2 (superseded) & forbids pseudo-criterion #3: allows same-commit line-number correction via supersede.claims while catching unclaimed deletions", () => {
    const oldDoc = conceptPage(
      "same-commit-fix",
      [srcA],
      "## 核心机制\n`max_num_batched_tokens` 在 v0.26.0 默认值为 512。\n同时 `block_size` 在 Atlas A2 上固定为 128。",
    );
    const correctedDoc = conceptPage(
      "same-commit-fix",
      [srcB],
      "## 核心机制\n`max_num_batched_tokens` 在 v0.26.0 默认值为 2048。\n同时 `block_size` 在 Atlas A2 上固定为 128。",
    );
    const supersedeSameCommit = revisionSchema.parse({
      id: "same-commit-fix",
      kind: "supersede",
      reason: "按同一固定 commit 精确行号纠正历史默认值误读",
      claims: [
        {
          old: "`max_num_batched_tokens` 在 v0.26.0 默认值为 512。",
          replacement: "`max_num_batched_tokens` 在 v0.26.0 默认值为 2048。",
          sources: [srcB],
        },
      ],
    });
    expect(() =>
      revisePage("concepts/same-commit-fix.md", oldDoc, correctedDoc, supersedeSameCommit, "2026-11-15"),
    ).not.toThrow();

    const sneakyDeletionDoc = conceptPage(
      "same-commit-fix",
      [srcB],
      "## 核心机制\n`max_num_batched_tokens` 在 v0.26.0 默认值为 2048。",
    );
    expect(() =>
      revisePage("concepts/same-commit-fix.md", oldDoc, sneakyDeletionDoc, supersedeSameCommit, "2026-11-15"),
    ).toThrow(/事实去向/);
  });

  it("outlet 3 (migrated): passes only with sealed semantic-check receipt + same-batch siblingWrites + real anchor + outgoing link", () => {
    const oldParent = conceptPage(
      "parent-topic",
      [srcA],
      "## 机制总览\n主干走两步调度。\n\n在 Atlas A2 双机下，`max_num_batched_tokens = 2048` 时激活显存峰值占 15.9 GiB。\n\n## 对照源码\n### 源码位置\n见调度器 [C1]。",
    );
    const newParentLinked = conceptPage(
      "parent-topic",
      [srcA],
      "## 机制总览\n主干走两步调度。详细显存容量子账已拆分至 [容量子账](child-budget.md#双机预算)。\n\n## 对照源码\n### 源码位置\n见调度器 [C1]。",
    );
    const childCarryingFact = conceptPage(
      "child-budget",
      [srcA],
      "## 双机预算\n在 Atlas A2 双机下，`max_num_batched_tokens = 2048` 时激活显存峰值占 15.9 GiB。\n\n## 对照源码\n### 源码位置\n见调度器 [C1]。",
    );
    const childWithoutFact = conceptPage(
      "child-budget",
      [srcA],
      "## 双机预算\n本节介绍一般显存概念。\n\n## 对照源码\n### 源码位置\n见调度器 [C1]。",
    );
    const unverifiedEditorial = revisionSchema.parse({
      id: "parent-topic",
      kind: "editorial",
      reason: "拆分双机容量子账到独立子页",
    });

    expect(() =>
      verifyRevision(
        "concepts/parent-topic.md",
        oldParent,
        newParentLinked,
        unverifiedEditorial,
        "2026-11-15",
        {
          siblingWrites: [{ path: "wiki/concepts/child-budget.md", before: null, after: childCarryingFact }],
        },
      ),
    ).toThrow(/事实去向/);

    const oldActive = splitHistory(parsePage("concepts/parent-topic.md", oldParent).page!.body).active;
    const parentNextActive = splitHistory(
      parsePage("concepts/parent-topic.md", newParentLinked).page!.body,
    ).active;
    const childActive = splitHistory(
      parsePage("concepts/child-budget.md", childCarryingFact).page!.body,
    ).active;

    const makeMigratedRevision = (targetCandidateHash = digest(childActive)) =>
      revisionSchema.parse({
        id: "parent-topic",
        kind: "editorial",
        reason: "拆分双机容量子账到独立子页",
        factDispositions: [
          {
            pageId: "parent-topic",
            baseHash: digest(oldActive),
            candidateHash: digest(parentNextActive),
            fact: "主干走两步调度。",
            outlet: "retained",
            verification: "semantic-check",
            targetQuote: "主干走两步调度。详细显存容量子账已拆分至 [容量子账](child-budget.md#双机预算)。",
            reason: "主干两步调度结论保留于机制总览并增加子页导引链接",
          },
          {
            pageId: "parent-topic",
            baseHash: digest(oldActive),
            candidateHash: digest(parentNextActive),
            fact: "在 Atlas A2 双机下，`max_num_batched_tokens = 2048` 时激活显存峰值占 15.9 GiB。",
            outlet: "migrated",
            verification: "semantic-check",
            targetPage: "child-budget",
            targetAnchor: "双机预算",
            targetCandidateHash,
            targetQuote: "在 Atlas A2 双机下，`max_num_batched_tokens = 2048` 时激活显存峰值占 15.9 GiB。",
            reason: "双机激活显存子账完整迁入同批新建子页 child-budget#双机预算",
          },
        ],
      });

    const sealedMigrated = makeMigratedRevision();

    expect(() =>
      verifyRevision("concepts/parent-topic.md", oldParent, newParentLinked, sealedMigrated, "2026-11-15", {
        siblingWrites: [],
      }),
    ).toThrow(/事实去向/);

    expect(() =>
      verifyRevision(
        "concepts/parent-topic.md",
        oldParent,
        newParentLinked,
        makeMigratedRevision(
          digest(splitHistory(parsePage("concepts/child-budget.md", childWithoutFact).page!.body).active),
        ),
        "2026-11-15",
        {
          siblingWrites: [{ path: "wiki/concepts/child-budget.md", before: null, after: childWithoutFact }],
        },
      ),
    ).toThrow(/事实去向/);

    const newParentBrokenAnchor = newParentLinked.replace("#双机预算", "#不存在锚点");
    expect(() =>
      verifyRevision(
        "concepts/parent-topic.md",
        oldParent,
        newParentBrokenAnchor,
        sealedMigrated,
        "2026-11-15",
        {
          siblingWrites: [{ path: "wiki/concepts/child-budget.md", before: null, after: childCarryingFact }],
        },
      ),
    ).toThrow(/事实去向|候选 hash/);

    expect(() =>
      verifyRevision("concepts/parent-topic.md", oldParent, newParentLinked, sealedMigrated, "2026-11-15", {
        siblingWrites: [{ path: "wiki/concepts/child-budget.md", before: null, after: childCarryingFact }],
      }),
    ).not.toThrow();
  });

  it("enforces two-layer adversarial fact-disposition hierarchy: rejects all 5 semantic corruptions + unverified paraphrase, and offline-approves verified paraphrase", () => {
    const simplePage = (body: string) =>
      `---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [${source}]\nevidence: I\nupdated: '2026-11-15'\n---\n## 一句话\n${body}\n`;

    const adversarialCorruptions = [
      {
        name: "reverse-condition",
        before: "When `enable_cache` is true, requests are scheduled sequentially.",
        after: "When `enable_cache` is true, requests are scheduled concurrently.",
      },
      {
        name: "drop-unit",
        before: "`cache_size` is 4 GiB.",
        after: "`cache_size` is 4.",
      },
      {
        name: "swap-version-values",
        before: "`max_tokens` is 2048 in v0.26.0 and 512 in v0.30.0.",
        after: "`max_tokens` is 512 in v0.26.0 and 2048 in v0.30.0.",
      },
      {
        name: "swap-causal-subject",
        before: "The producer waits for the consumer.",
        after: "The consumer waits for the producer.",
      },
      {
        name: "identifier-substring",
        before: "`enable_cache` is supported.",
        after: "`disable_enable_cache` is supported.",
      },
      {
        name: "version-heading-changed",
        before: "## v0.26.0\n`enable_cache` is supported.",
        after: "## v0.30.0\n`enable_cache` is supported.",
      },
      {
        name: "claim-recast-as-misconception",
        before: "## Runtime behavior\nThe producer waits for the consumer.",
        after: "## False statements\nThe producer waits for the consumer.",
      },
      {
        name: "table-header-version-changed",
        before: "## Matrix\n| Param | v0.26.0 |\n| --- | --- |\n| `enable_cache` | supported |",
        after: "## Matrix\n| Param | v0.30.0 |\n| --- | --- |\n| `enable_cache` | supported |",
      },
      {
        name: "plain-version-context-swap",
        before: "On v0.26:\n`max_tokens` is 2048.\n\nOn v0.30:\n`max_tokens` is 512.",
        after: "On v0.26:\n`max_tokens` is 512.\n\nOn v0.30:\n`max_tokens` is 2048.",
      },
      {
        name: "paragraph-block-order-swap",
        before: "On v0.26:\n\n`max_tokens` is 2048.\n\nOn v0.30:\n\n`max_tokens` is 512.",
        after: "On v0.26:\n\n`max_tokens` is 512.\n\nOn v0.30:\n\n`max_tokens` is 2048.",
      },
      {
        name: "code-operation-order",
        before: "```python\nx = 1\nx = 2\nprint(x)\n```",
        after: "```python\nx = 2\nx = 1\nprint(x)\n```",
      },
      {
        name: "code-string-whitespace",
        before: '```python\nprint("a  b")\n```',
        after: '```python\nprint("a b")\n```',
      },
      {
        name: "code-comment-condition",
        before: "```bash\n# Only valid on v0.26; do not use on v0.30\nrun --enable-cache\n```",
        after: "```bash\nrun --enable-cache\n```",
      },
      {
        name: "inline-code-whitespace",
        before: "Run `python -c \"print('a  b')\"` on the host.",
        after: "Run `python -c \"print('a b')\"` on the host.",
      },
      {
        name: "table-row-context-swap",
        before: "| Version | Default |\n| --- | --- |\n| v0.26 | 2048 |\n| v0.30 | 512 |",
        after: "| Version | Default |\n| --- | --- |\n| v0.30 | 512 |\n| v0.26 | 2048 |",
      },
    ];

    const unverifiedDecision = revisionSchema.parse({ id: "a", kind: "editorial", reason: "rewrite" });
    for (const c of adversarialCorruptions) {
      expect(
        () =>
          revisePage(
            "sources/a.md",
            simplePage(c.before),
            simplePage(c.after),
            unverifiedDecision,
            "2026-11-15",
          ),
        `adversarial corruption must fail: ${c.name}`,
      ).toThrow(/事实去向/);
      expect(
        () =>
          collectPageFactDispositions(
            "sources/a.md",
            simplePage(c.before),
            simplePage(c.after),
            unverifiedDecision,
          ),
        `collectPageFactDispositions must fail on unverified corruption: ${c.name}`,
      ).toThrow(/事实去向/);
    }

    const paraBefore = simplePage("Requests are handled one at a time.");
    const paraAfter = simplePage("Processing is sequential.");
    expect(() => revisePage("sources/a.md", paraBefore, paraAfter, unverifiedDecision, "2026-11-15")).toThrow(
      /事实去向/,
    );

    const oldActive = splitHistory(parsePage("sources/a.md", paraBefore).page!.body).active;
    const nextActive = splitHistory(parsePage("sources/a.md", paraAfter).page!.body).active;
    const verifiedParaphraseDecision = revisionSchema.parse({
      id: "a",
      kind: "editorial",
      reason: "equivalent concise phrasing",
      factDispositions: [
        {
          pageId: "a",
          baseHash: digest(oldActive),
          candidateHash: digest(nextActive),
          fact: "Requests are handled one at a time.",
          outlet: "retained",
          verification: "semantic-check",
          targetQuote: "Processing is sequential.",
          reason:
            "Independent check confirmed sequential processing is semantically identical to one-at-a-time handling.",
        },
      ],
    });
    expect(revisePage("sources/a.md", paraBefore, paraAfter, verifiedParaphraseDecision, "2026-11-15")).toBe(
      paraAfter,
    );
    const dispositions = collectPageFactDispositions(
      "sources/a.md",
      paraBefore,
      paraAfter,
      verifiedParaphraseDecision,
    );
    expect(dispositions).toHaveLength(1);
    expect(dispositions[0]).toMatchObject({
      pageId: "a",
      fact: "Requests are handled one at a time.",
      outlet: "retained",
      verification: "semantic-check",
      targetQuote: "Processing is sequential.",
    });

    const mutatedAfter = simplePage("Processing is concurrent.");
    expect(() =>
      revisePage("sources/a.md", paraBefore, mutatedAfter, verifiedParaphraseDecision, "2026-11-15"),
    ).toThrow(/hash|事实去向/);

    if (verifiedParaphraseDecision.kind !== "editorial") throw new Error("expected editorial");
    const forgedQuoteDecision = revisionSchema.parse({
      ...verifiedParaphraseDecision,
      factDispositions: [
        {
          ...verifiedParaphraseDecision.factDispositions![0]!,
          targetQuote: "Non-existent quote in candidate.",
        },
      ],
    });
    expect(() =>
      revisePage("sources/a.md", paraBefore, paraAfter, forgedQuoteDecision, "2026-11-15"),
    ).toThrow(/事实去向|引文/);
  });
});
