import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RunAgent } from "./batch";
import { inputByteLimit } from "./context-window";
import { acceptBatch, readBatch, saveBatch } from "./drop-batch";
import { applyDropEdits, validateDropEdits } from "./drop-context";
import { callReceiptPaths, startDrop } from "./drop-run";
import { approveReview, readReview } from "./review";
import { handbookFixture, wikiFixture } from "./test-fixture";
import { digest } from "./workflow";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

const createFixture = () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/HANDBOOK.md", handbookFixture());
  f.write("wiki/log.md", "# log\n");
  return f;
};

const makePage = (id: string, body: string) =>
  `---\nid: ${id}\ntitle: ${id}\ntype: feature\nsummary: 机制说明\nsources:\n  - https://example.com/${id}\nevidence: I\nupdated: '2026-10-06'\n---\n${body}\n`;

describe("042 discovery & planning convergence (Task 649 red-green)", () => {
  it("exposes referenced diagram material IDs on read pages without linear inventory paging", async () => {
    const f = createFixture();
    for (let i = 0; i < 25; i++) {
      f.write(`wiki/concepts/filler-${i}.md`, makePage(`filler-${i}`, `填充概念正文 ${i}。`));
    }
    for (let i = 0; i < 25; i++) {
      f.write(
        `wiki/diagrams/filler-diag-${i}.yaml`,
        `layout: figure\nid: filler-diag-${i}\ncaption: 填充图\nsize: [400, 120]\nitems:\n  - { at: [20, 20], size: [160, 56], text: 节点, tone: control, style: solid }\n`,
      );
    }
    f.write(
      "wiki/diagrams/target-boundary.yaml",
      "layout: figure\nid: target-boundary\ncaption: 排障边界图\nsize: [400, 120]\nitems:\n  - { at: [20, 20], size: [160, 56], text: 排障边界, tone: control, style: solid }\n",
    );
    f.write(
      "wiki/concepts/target-page.md",
      makePage("target-page", "故障先看现象再取首证。\n\n```wiki-diagram\nfile: target-boundary\n```\n"),
    );

    const batch = await acceptBatch(f.root, {
      key: "diag-lookup",
      items: [{ name: "note.md", text: "补充排障首取证据与边界图核对。" }],
    });

    let exposedDiagramMaterial: string | undefined;
    const agent: RunAgent = async (req) => {
      const p = JSON.parse(req.stdin);
      if (p.mode === "drop-extract" || p.mode === "drop-read") {
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: "摘要",
            quotes: [p.materials[0].text.trim().split("\n")[0]],
            conditions: [],
            topics: [{ name: "排障", query: "排障" }],
          }),
        };
      }
      if (p.mode === "drop-discover") {
        if (!p.read.some((r: { id: string }) => r.id === "target-page")) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({ request: { pages: ["target-page"] } }),
          };
        }
        const readEntry = p.read.find((r: { id: string }) => r.id === "target-page");
        const reqPageEntry = p.navigation?.requestedPages?.find(
          (r: { id: string }) => r.id === "target-page",
        );
        exposedDiagramMaterial = readEntry?.diagrams?.[0]?.material ?? reqPageEntry?.diagrams?.[0]?.material;
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            read: [],
            fetch: [],
            search: [],
            pages: [],
            question: "stop-after-check",
            report: "checked",
            done: false,
            outcome: { kind: "unresolved", reason: "stop", comparisons: [] },
          }),
        };
      }
      throw new Error(`unexpected mode: ${p.mode}`);
    };

    const started = await startDrop(f.root, batch.id, {}, { runAgent: agent });
    await started.done;
    expect(exposedDiagramMaterial).toMatch(/^diagram:diagrams\/target-boundary\.yaml@[a-f0-9]{64}$/);
  });

  it("tracks stageInspected in non-discover drop-check so budget negotiation marks inspected slices", async () => {
    const f = createFixture();
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({ contextWindowTokens: 48000, outputReserveTokens: 16384 }),
    );
    const bodyA = "甲页关键事实与适用条件说明。".repeat(900);
    const bodyB = "乙页关键事实与适用条件说明。".repeat(900);
    f.write("wiki/concepts/page-a.md", makePage("page-a", bodyA));
    f.write("wiki/concepts/page-b.md", makePage("page-b", bodyB));

    const batch = await acceptBatch(f.root, {
      key: "check-inspected",
      items: [{ name: "src.md", text: "核对甲页与乙页的共享条件。" }],
    });

    let checkRound = 0;
    let coverageRound1SawComparisonSlice = false;
    let observedAlreadyInspectedForA: { start: number; end: number }[] | undefined;

    const agent: RunAgent = async (req) => {
      const p = JSON.parse(req.stdin);
      if (p.mode === "drop-extract" || p.mode === "drop-read") {
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: "摘要",
            quotes: [p.materials[0].text.slice(0, 24)],
            conditions: [],
            topics: [{ name: "条件", query: "条件" }],
          }),
        };
      }
      if (p.mode === "drop-discover") {
        if (p.read.length < 2) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({ request: { pages: ["page-a", "page-b"] } }),
          };
        }
        const matA = p.read.find((r: { id: string }) => r.id === "page-a")?.material;
        const hasA = p.materials.some((m: { id: string }) => m.id === matA);
        if (!hasA) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({ request: { materials: [{ id: matA, start: 0, end: 400 }] } }),
          };
        }
        const sliceA = p.materials.find((m: { id: string }) => m.id === matA);
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            read: [],
            fetch: [],
            search: [],
            pages: [],
            question: "",
            report: "已覆盖",
            done: true,
            outcome: {
              kind: "covered",
              reason: "旧页已覆盖",
              comparisons: [{ page: "page-a", quote: sliceA.text.slice(0, 30), reason: "一致" }],
            },
          }),
        };
      }
      if (p.mode === "drop-check" && String(p.task?.id).startsWith("coverage:")) {
        checkRound++;
        const inv = p.navigation.inventory as { id: string; path: string }[];
        const matA = inv.find((r) => r.path === "concepts/page-a.md")!.id;
        const matB = inv.find((r) => r.path === "concepts/page-b.md")!.id;
        const lenA = (p.navigation.inventory as { id: string; length: number }[]).find(
          (r) => r.id === matA,
        )!.length;
        const lenB = (p.navigation.inventory as { id: string; length: number }[]).find(
          (r) => r.id === matB,
        )!.length;
        if (checkRound === 1) {
          coverageRound1SawComparisonSlice = p.materials.some((m: { id: string }) => m.id === matA);
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({ request: { materials: [{ id: matA, start: 0, end: 3000 }] } }),
          };
        }
        if (checkRound === 2) {
          // matA[0..3000] IS provided in p.materials on round 2; now request oversized combo matA + matB
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              request: {
                materials: [
                  { id: matA, start: 0, end: lenA },
                  { id: matB, start: 0, end: lenB },
                ],
              },
            }),
          };
        }
        const budgetReq = p.navigation?.budgetRequest;
        const detailA = budgetReq?.requested?.find((r: { id: string }) => r.id === matA);
        observedAlreadyInspectedForA = detailA?.alreadyInspectedRanges;
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
        };
      }
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        costUsd: 0,
        output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
      };
    };

    const started = await startDrop(f.root, batch.id, {}, { runAgent: agent });
    await started.done;
    expect(coverageRound1SawComparisonSlice).toBe(true);
    expect(observedAlreadyInspectedForA).toEqual([{ start: 0, end: 3000 }]);
  });

  it("retains verified stagedComparisons across outer discover progress iterations for the same source chunk", async () => {
    const f = createFixture();
    f.write("wiki/concepts/page-one.md", makePage("page-one", "第一页原有事实甲与限定条件。"));
    f.write("wiki/concepts/page-two.md", makePage("page-two", "第二页原有事实乙与限定条件。"));

    const batch = await acceptBatch(f.root, {
      key: "preserve-staged",
      items: [{ name: "src.md", text: "同时涉及第一页与第二页的增量条件。" }],
    });

    let discoverExchangeCount = 0;
    let stagedCountAfterOuterProgress = -1;

    const agent: RunAgent = async (req) => {
      const p = JSON.parse(req.stdin);
      if (p.mode === "drop-extract" || p.mode === "drop-read") {
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: "摘要",
            quotes: [p.materials[0].text.trim().split("\n")[0]],
            conditions: [],
            topics: [{ name: "增量", query: "增量" }],
          }),
        };
      }
      if (p.mode === "drop-discover") {
        discoverExchangeCount++;
        if (discoverExchangeCount === 1) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({ request: { pages: ["page-one"] } }),
          };
        }
        if (discoverExchangeCount === 2) {
          const matOne = p.read.find((r: { id: string }) => r.id === "page-one")!.material;
          const sliceOne = p.materials.find((m: { id: string }) => m.id === matOne)!;
          const quote = "第一页原有事实甲与限定条件。";
          expect(sliceOne.text).toContain(quote);
          // Stage comparison for page-one, then return done=false with read=["page-two"] on next step
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              request: {
                stage: {
                  comparisons: [{ page: "page-one", quote, reason: "已核实第一页" }],
                },
              },
            }),
          };
        }
        if (discoverExchangeCount === 3) {
          // Trigger outer integrateDrop progress loop (plan.read = ["page-two"], done = false)
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              read: ["page-two"],
              fetch: [],
              search: [],
              pages: [],
              question: "",
              report: "继续读第二页",
              done: false,
              outcome: { kind: "unresolved", reason: "待读第二页", comparisons: [] },
            }),
          };
        }
        stagedCountAfterOuterProgress = p.discoveryProgress?.stagedComparisons?.length ?? 0;
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            read: [],
            fetch: [],
            search: [],
            pages: [],
            question: "stop",
            report: "done check",
            done: false,
            outcome: { kind: "unresolved", reason: "stop", comparisons: [] },
          }),
        };
      }
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        costUsd: 0,
        output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
      };
    };

    const started = await startDrop(f.root, batch.id, {}, { runAgent: agent });
    await started.done;
    expect(stagedCountAfterOuterProgress).toBe(1);
  });

  it("handles mixed request.stage + outer read/done=false without batch restart and keeps drop-read single-chunk", async () => {
    const f = createFixture();
    f.write("wiki/concepts/p1.md", makePage("p1", "甲段事实与限定条件。".repeat(500)));
    f.write("wiki/concepts/p2.md", makePage("p2", "乙段事实与限定条件。"));
    const batch = await acceptBatch(f.root, {
      key: "mixed-and-single-read",
      items: [{ name: "src.md", text: "更新甲乙关联说明。" }],
    });
    let dropReadSawRequestInstruction = false;
    let mixedAcceptedWithoutRepair = false;
    let step = 0;
    const agent: RunAgent = async (req, _opts) => {
      const p = JSON.parse(req.stdin);
      if (p.mode === "drop-read") {
        if ((req.args?.join(" ") ?? "").includes('{"request":{"materials"')) {
          dropReadSawRequestInstruction = true;
        }
      }
      if (p.mode === "drop-extract" || p.mode === "drop-read") {
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: "摘要",
            quotes: [p.materials[0].text.trim().slice(0, 12)],
            conditions: [],
            topics: [{ name: "关联", query: "关联" }],
          }),
        };
      }
      if (p.mode === "drop-discover") {
        step++;
        if (step === 1) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({ request: { pages: ["p1"] } }),
          };
        }
        if (step === 2) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              read: ["p2"],
              pages: [],
              done: false,
              request: {
                stage: {
                  comparisons: [{ page: "p1", quote: "甲段事实与限定条件。", reason: "已核" }],
                },
              },
            }),
          };
        }
        mixedAcceptedWithoutRepair = !p.repair && p.read.some((r: { id: string }) => r.id === "p2");
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            read: [],
            fetch: [],
            search: [],
            pages: [],
            question: "stop",
            report: "ok",
            done: false,
            outcome: { kind: "unresolved", reason: "stop", comparisons: [] },
          }),
        };
      }
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        costUsd: 0,
        output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
      };
    };
    const started = await startDrop(f.root, batch.id, {}, { runAgent: agent });
    await started.done;
    expect(dropReadSawRequestInstruction).toBe(false);
    expect(mixedAcceptedWithoutRepair).toBe(true);
  });

  it("passes editorialGuides as non-factual rule material in drop-generate and rejects citing @intent as a source", async () => {
    const f = createFixture();
    f.write("wiki/concepts/quant-demo.md", makePage("quant-demo", "量化缩放系数原有事实。"));
    const batch = await acceptBatch(f.root, {
      key: "editorial-guide-whitelist",
      items: [{ name: "src.md", text: "量化缩放系数补充边界。" }],
    });
    let sawGuideInGenerate = false;
    let genAttempt = 0;
    const agent: RunAgent = async (req) => {
      const p = JSON.parse(req.stdin);
      if (p.mode === "drop-extract" || p.mode === "drop-read") {
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: "摘要",
            quotes: [p.materials[0].text.trim().slice(0, 10)],
            conditions: [],
            topics: [{ name: "量化", query: "量化" }],
          }),
        };
      }
      if (p.mode === "drop-discover") {
        if (!p.read.length) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({ request: { pages: ["quant-demo"] } }),
          };
        }
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            read: [],
            fetch: [],
            search: [],
            pages: [
              {
                path: "concepts/quant-demo.md",
                reason: "结构重排",
                toc: { part: "inference", section: "量化" },
                evidence: [p.notes[0].ref],
                comparisons: [{ page: "quant-demo", quote: "量化缩放系数原有事实。", reason: "保留" }],
              },
            ],
            question: "",
            report: "重整结构",
            done: true,
            outcome: { kind: "integrate", reason: "重整", comparisons: [] },
          }),
        };
      }
      if (p.mode === "drop-generate") {
        genAttempt++;
        const guideMat = String(p.editorialGuide?.material ?? "");
        if (guideMat.startsWith("rule:@intent/quant-demo.md@")) {
          sawGuideInGenerate = true;
        }
        const guideHash = guideMat.split("@").at(-1) ?? "";
        // First generation attempt forges a syntactically valid raw:sha256-<guideHash>.md#L1-L2 -> must be rejected by factual whitelist!
        const badOrGoodSources =
          genAttempt === 1
            ? `  - https://example.com/quant-demo\n  - ${p.notes[0].ref}\n  - raw:sha256-${guideHash}.md#L1-L2`
            : `  - https://example.com/quant-demo\n  - ${p.notes[0].ref}`;
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            text: `---\nid: quant-demo\ntitle: quant-demo\ntype: feature\nsummary: 机制说明\nsources:\n${badOrGoodSources}\nevidence: I\nupdated: '2026-10-06'\n---\n量化缩放系数原有事实。\n\n## 新边界\n\n量化缩放系数补充边界。\n\n## 对照源码\n\n补充边界来自原始资料。[D2]\n`,
            diagrams: [],
            revision: { id: "quant-demo", kind: "editorial", reason: "结构优化" },
          }),
        };
      }
      if (p.mode === "drop-fact-check") {
        expect(p.editorialGuide).toBeUndefined();
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({ verdicts: [], contradictions: [], report: "ok" }),
        };
      }
      if (p.mode === "drop-check") {
        expect(p.editorialGuide).toBeUndefined();
      }
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        costUsd: 0,
        output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
      };
    };
    const started = await startDrop(
      f.root,
      batch.id,
      {
        newAttempt: true,
        feedback: "按已双审编辑意图重整结构，不把意图当事实源",
        editorialGuides: [{ page: "quant-demo", text: "# 推荐结构\n先讲缩放再讲边界。" }],
      },
      { runAgent: agent, validate: () => [] },
    );
    const finished = await started.done;
    expect(finished.state, finished.error).toBe("review");
    expect(sawGuideInGenerate).toBe(true);
    expect(genAttempt).toBe(2);
    const review = readReview(f.root, finished.reviewId!);
    expect(
      review.payload.drop?.receipt?.resources.some(
        (r) => r.kind === "rule" && r.path === "@intent/quant-demo.md",
      ),
    ).toBe(true);
    const callsBeforeApproval = readBatch(f.root, finished.id).calls.length;
    const approved = await approveReview(f.root, review.id, { validate: () => [] });
    expect(approved.state).toBe("published");
    expect(readBatch(f.root, finished.id).calls.length - callsBeforeApproval).toBe(0);
  });

  it("reuses pre-649 legacy range-error cache without inspectedInStage while keeping inspectedInStage on uncached frames", async () => {
    const f = createFixture();
    const srcText = `${"第一段原始材料内容与限定条件。\n".repeat(450)}${"第二段尾部补充内容。\n".repeat(60)}`;
    const batch = await acceptBatch(f.root, {
      key: "range-error-legacy-cache",
      items: [{ name: "long-src.md", text: srcText }],
    });

    let sawFreshRangeErrInspected = false;
    let sawFreshRangeErrRemaining = false;
    let extractRound = 0;

    const seedAgent: RunAgent = async (req) => {
      const p = JSON.parse(req.stdin);
      if (p.mode === "drop-extract") {
        extractRound++;
        const matId = p.range.id as string;
        if (extractRound === 1) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              request: { materials: [{ id: matId, start: 0, end: 999999 }] },
            }),
          };
        }
        if (p.navigation?.rangeErrors) {
          const ar0 = p.navigation.activeResources?.[0];
          sawFreshRangeErrInspected = Array.isArray(ar0?.inspectedInStage) && ar0.inspectedInStage.length > 0;
          sawFreshRangeErrRemaining = Array.isArray(ar0?.remainingRanges) && ar0.remainingRanges.length > 0;
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              request: { materials: [{ id: matId, start: p.range.start, end: p.range.end }] },
            }),
          };
        }
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: "分段摘要",
            quotes: [p.materials[0].text.trim().split("\n")[0]],
            conditions: [],
            topics: [{ name: "边界", query: "边界" }],
          }),
        };
      }
      throw new Error("SEED_STOP_AT_DISCOVER");
    };

    const seeded = await (await startDrop(f.root, batch.id, {}, { runAgent: seedAgent })).done;
    expect(seeded.state).toBe("failed");
    expect(seeded.error).toContain("SEED_STOP_AT_DISCOVER");
    expect(sawFreshRangeErrInspected).toBe(true);
    expect(sawFreshRangeErrRemaining).toBe(true);

    // Convert the Round-1 rangeErrors cache entry on disk into pre-649 legacy format (no inspectedInStage/remainingRanges)
    const runDir = join(f.root, `wiki/_jobs/drops/runs/${batch.id}/${seeded.generation}`);
    const savedBatch = readBatch(f.root, batch.id);
    let converted = 0;
    for (const name of readdirSync(runDir).filter((n) => n.endsWith(".input.json"))) {
      const newHash = name.slice(0, -".input.json".length);
      const inputObj = JSON.parse(readFileSync(join(runDir, name), "utf8")) as {
        rules: string;
        data: { navigation?: { rangeErrors?: unknown; activeResources?: Record<string, unknown>[] } };
      };
      if (!inputObj.data.navigation?.rangeErrors) continue;
      const cachedOutput = readFileSync(join(runDir, `${newHash}.json`), "utf8");
      const legacyData = {
        ...inputObj.data,
        navigation: {
          ...inputObj.data.navigation,
          activeResources: (inputObj.data.navigation.activeResources ?? []).map(
            ({ inspectedInStage: _i, remainingRanges: _r, ...rest }) => rest,
          ),
        },
      };
      const legacyHash = digest(
        JSON.stringify({
          data: legacyData,
          rules: inputObj.rules,
          selection: savedBatch.selection,
          budget: savedBatch.budget,
          protocol: savedBatch.protocol ?? 4,
        }),
      );
      expect(legacyHash).not.toBe(newHash);
      writeFileSync(join(runDir, `${legacyHash}.json`), cachedOutput);
      rmSync(join(runDir, `${newHash}.json`));
      converted++;
    }
    expect(converted).toBe(1);

    let replayExtractCalls = 0;
    let reachedDiscover = false;
    const replayAgent: RunAgent = async (req) => {
      const p = JSON.parse(req.stdin);
      if (p.mode === "drop-extract") {
        replayExtractCalls++;
        throw new Error("UNEXPECTED_EXTRACT_CACHE_MISS");
      }
      if (p.mode === "drop-discover") {
        reachedDiscover = true;
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            read: [],
            fetch: [],
            search: [],
            pages: [],
            question: "replay-verified",
            report: "ok",
            done: false,
            outcome: { kind: "unresolved", reason: "replay-verified", comparisons: [] },
          }),
        };
      }
      throw new Error(`UNEXPECTED_MODE_${p.mode}`);
    };

    const replayed = await (await startDrop(f.root, batch.id, { retry: true }, { runAgent: replayAgent }))
      .done;
    expect(replayExtractCalls).toBe(0);
    expect(reachedDiscover).toBe(true);
    expect(replayed.state).toBe("needs-input");
  });

  it("repairs standalone drop-check re-read negotiation when uninspectedRanges is empty and skips poisoned negotiate cache", async () => {
    const f = createFixture();
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({ contextWindowTokens: 54000, outputReserveTokens: 16384 }),
    );
    const pageBody = `首段固定算例与队列顺序条件。\n${"旧页分块上下文说明与采样边界。\n".repeat(60)}`;
    const auxBody = `${"关联参照页边界条件与配置约束说明。\n".repeat(180)}`;
    const aux2Body = `${"第二关联参照页通信与流水条件说明。\n".repeat(180)}`;
    f.write("wiki/concepts/chunked-demo.md", makePage("chunked-demo", pageBody));
    f.write("wiki/concepts/aux-ref.md", makePage("aux-ref", auxBody));
    f.write("wiki/concepts/aux-ref-2.md", makePage("aux-ref-2", aux2Body));
    const srcPart1 = `${"候选第一段预算与队列说明。\n".repeat(160)}`;
    const srcPart2 = `${"候选第二段跨段采样与回拨条件。\n".repeat(210)}`;
    const batch = await acceptBatch(f.root, {
      key: "check-reread-negotiate-1038",
      items: [{ name: "cand.md", text: `${srcPart1}${srcPart2}` }],
    });

    let compRound = 0;
    let firstNegotiateBudget: Record<string, unknown> | undefined;
    let rereadFrameHadNoBudget = false;
    let rereadFrameCoveredSuggested = false;

    const makeCheckAgent = (poisonMode: boolean): RunAgent => {
      return async (req) => {
        const p = JSON.parse(req.stdin);
        if (p.mode === "drop-extract" || p.mode === "drop-read") {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              summary: "摘要",
              quotes: [p.materials[0].text.trim().split("\n")[0]],
              conditions: [],
              topics: [{ name: "分块", query: "chunked-demo" }],
            }),
          };
        }
        if (p.mode === "drop-discover") {
          if (!p.read.length) {
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({ request: { pages: ["chunked-demo"] } }),
            };
          }
          const hasPage = p.materials.some((m: { id: string }) =>
            m.id.startsWith("page:concepts/chunked-demo"),
          );
          if (!hasPage) {
            const matP = p.read[0].material;
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({ request: { materials: [{ id: matP, start: 0, end: 600 }] } }),
            };
          }
          const isFirstChunk = p.remainingSourceChunks > 0;
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              read: [],
              fetch: [],
              search: [],
              pages: isFirstChunk
                ? [
                    {
                      path: "concepts/chunked-demo.md",
                      reason: "保留原顺序与旧事实映射及边界条件说明。",
                      toc: { part: "inference", section: "分块" },
                      evidence: [p.notes[0].ref],
                      comparisons: [
                        { page: "chunked-demo", quote: "首段固定算例与队列顺序条件。", reason: "保留条件" },
                      ],
                    },
                  ]
                : [],
              question: "",
              report: "已规划",
              done: true,
              outcome: isFirstChunk
                ? { kind: "integrate", reason: "整合首段", comparisons: [] }
                : {
                    kind: "covered",
                    reason: "次段已覆盖",
                    comparisons: [
                      { page: "chunked-demo", quote: "首段固定算例与队列顺序条件。", reason: "已覆盖" },
                    ],
                  },
            }),
          };
        }
        if (p.mode === "drop-check" && String(p.task?.id).startsWith("comparison:")) {
          compRound++;
          const srcRes = p.navigation.inventory.find((r: { kind: string }) => r.kind === "source");
          const auxRes = p.navigation.inventory.find(
            (r: { path: string }) => r.path === "concepts/aux-ref.md",
          );
          const aux2Res = p.navigation.inventory.find(
            (r: { path: string }) => r.path === "concepts/aux-ref-2.md",
          );
          const curSrc = p.materials.find((m: { id: string }) => m.id === srcRes.id);
          if (compRound === 1) {
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                request: { materials: [{ id: srcRes.id, start: curSrc.end, end: srcRes.length }] },
              }),
            };
          }
          if (compRound === 2) {
            expect(p.navigation?.budgetRequest).toBeUndefined();
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                request: { materials: [{ id: auxRes.id, start: 0, end: auxRes.length }] },
              }),
            };
          }
          if (compRound === 3) {
            expect(p.navigation?.budgetRequest).toBeUndefined();
            return {
              id: req.id,
              ok: true,
              stderrTail: "",
              exitCode: 0,
              costUsd: 0,
              output: JSON.stringify({
                request: { materials: [{ id: aux2Res.id, start: 0, end: aux2Res.length }] },
              }),
            };
          }
          if (compRound === 4) {
            expect(p.navigation?.budgetRequest).toBeUndefined();
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                request: {
                  materials: [
                    { id: srcRes.id, start: curSrc.end, end: srcRes.length },
                    { id: auxRes.id, start: 0, end: auxRes.length },
                    { id: aux2Res.id, start: 0, end: aux2Res.length },
                  ],
                },
              }),
            };
          }
          if (p.navigation?.budgetRequest) {
            firstNegotiateBudget = p.navigation.budgetRequest;
            if (poisonMode) {
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({ issues: [], contradictions: [], report: "premature" }),
              };
            }
            const batchReq = p.navigation.budgetRequest.suggestedBatch;
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({ request: { materials: batchReq } }),
            };
          }
          const suggested = (firstNegotiateBudget?.suggestedBatch ?? []) as {
            id: string;
            start: number;
            end: number;
          }[];
          rereadFrameHadNoBudget = !p.navigation?.budgetRequest;
          rereadFrameCoveredSuggested =
            suggested.length > 0 &&
            suggested.every((s) =>
              p.materials.some(
                (m: { id: string; start: number; end: number }) =>
                  m.id === s.id && m.start <= s.start && m.end >= s.end,
              ),
            );
          throw new Error("STOP_AFTER_FEASIBLE_REREAD");
        }
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
        };
      };
    };

    const first = await (await startDrop(f.root, batch.id, {}, { runAgent: makeCheckAgent(true) })).done;
    expect(first.state).toBe("failed");
    expect(first.error).toContain("上下文预算协商未完成");
    expect(String(firstNegotiateBudget?.instruction ?? "")).not.toMatch(/discoveryProgress/);
    expect((firstNegotiateBudget?.suggestedBatch as unknown[] | undefined)?.length ?? 0).toBeGreaterThan(0);
    expect(
      (firstNegotiateBudget?.requested as { uninspectedRanges: unknown[] }[] | undefined)?.every(
        (r) => r.uninspectedRanges.length === 0,
      ),
    ).toBe(true);

    // Plant an on-disk pre-1038 poisoned negotiate cache entry (suggestedBatch=[], discoveryProgress instruction, non-request output)
    // and verify retry skips it without mutating the poisoned file while reusing 100% of valid prior cache frames!
    const runDir = join(f.root, `wiki/_jobs/drops/runs/${batch.id}/${first.generation}`);
    const saved = readBatch(f.root, batch.id);
    const negInputName = readdirSync(runDir).find((n) => {
      if (!n.endsWith(".input.json")) return false;
      const obj = JSON.parse(readFileSync(join(runDir, n), "utf8"));
      return Boolean(obj.data?.navigation?.budgetRequest);
    })!;
    const negInput = JSON.parse(readFileSync(join(runDir, negInputName), "utf8"));
    const legacyPoisonedData = {
      ...negInput.data,
      navigation: {
        ...negInput.data.navigation,
        budgetRequest: {
          ...negInput.data.navigation.budgetRequest,
          instruction:
            "所请求范围在本阶段前序轮次已全部提供核验（uninspectedRanges 为空）；请依据已核实的 discoveryProgress 与当前必读原文作答，切勿重复请求相同大段范围。",
          suggestedBatch: [],
        },
      },
    };
    const legacyPoisonedHash = digest(
      JSON.stringify({
        data: legacyPoisonedData,
        rules: negInput.rules,
        selection: saved.selection,
        budget: saved.budget,
        protocol: saved.protocol ?? 4,
      }),
    );
    const poisonedPayload = JSON.stringify({
      issues: [],
      contradictions: [],
      dependencies: [],
      report: "legacy-poisoned-check",
    });
    writeFileSync(join(runDir, `${legacyPoisonedHash}.json`), poisonedPayload);

    compRound = 0;
    let priorStageCallsOnRetry = 0;
    const retryBaseAgent = makeCheckAgent(false);
    const retryAgent: RunAgent = async (req) => {
      const p = JSON.parse(req.stdin);
      if (p.mode !== "drop-check" || !String(p.task?.id).startsWith("comparison:")) {
        priorStageCallsOnRetry++;
      }
      return retryBaseAgent(req, undefined as never);
    };
    const retried = await (await startDrop(f.root, batch.id, { retry: true }, { runAgent: retryAgent })).done;
    expect(priorStageCallsOnRetry).toBe(0);
    expect(readFileSync(join(runDir, `${legacyPoisonedHash}.json`), "utf8")).toBe(poisonedPayload);
    expect(rereadFrameHadNoBudget).toBe(true);
    expect(rereadFrameCoveredSuggested).toBe(true);
    expect(retried.error).toContain("STOP_AFTER_FEASIBLE_REREAD");
  });

  it("provides suggestedBatch and enforces sealed-quote gate in drop-discover when uninspectedRanges is empty", async () => {
    const f = createFixture();
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({ contextWindowTokens: 48000, outputReserveTokens: 16384 }),
    );
    const quoteA = "甲页独有定量边界条件与适用快照。";
    const quoteB = "乙页独有定量边界条件与适用快照。";
    f.write("wiki/concepts/disc-a.md", makePage("disc-a", `${quoteA}\n${"甲页补充说明。\n".repeat(380)}`));
    f.write("wiki/concepts/disc-b.md", makePage("disc-b", `${quoteB}\n${"乙页补充说明。\n".repeat(380)}`));
    const batch = await acceptBatch(f.root, {
      key: "discover-reread-negotiate-1038",
      items: [{ name: "src.md", text: "核对甲页与乙页的定量边界条件。" }],
    });

    let dStep = 0;
    let sawDiscoverRereadBatch = false;
    let sawStageHoldForUnsealedQuote = false;

    const agent: RunAgent = async (req) => {
      const p = JSON.parse(req.stdin);
      if (p.mode === "drop-extract" || p.mode === "drop-read") {
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: "摘要",
            quotes: [p.materials[0].text.trim().split("\n")[0]],
            conditions: [],
            topics: [{ name: "边界", query: "disc-" }],
          }),
        };
      }
      if (p.mode === "drop-discover") {
        dStep++;
        if (dStep === 1) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({ request: { pages: ["disc-a", "disc-b"] } }),
          };
        }
        const matA = p.read.find((r: { id: string }) => r.id === "disc-a")!.material;
        const matB = p.read.find((r: { id: string }) => r.id === "disc-b")!.material;
        const lenA = p.read.find((r: { id: string }) => r.id === "disc-a")!.length;
        const lenB = p.read.find((r: { id: string }) => r.id === "disc-b")!.length;
        if (dStep === 2) {
          // Read full disc-a first and rule it in via stage on next step
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({ request: { materials: [{ id: matA, start: 0, end: lenA }] } }),
          };
        }
        if (dStep === 3) {
          // Stage quoteA, and read full disc-b
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              request: {
                materials: [{ id: matB, start: 0, end: lenB }],
                stage: { comparisons: [{ page: "disc-a", quote: quoteA, reason: "甲页已核" }] },
              },
            }),
          };
        }
        if (dStep === 4) {
          // Stage ruledOutPages for disc-b temporarily OR stage a dummy note, then re-request BOTH full pages (uninspectedRanges = [] for both!)
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              request: {
                materials: [
                  { id: matA, start: 0, end: lenA },
                  { id: matB, start: 0, end: lenB },
                ],
                stage: { ruledOutPages: [{ page: "disc-b", reason: "初判无关" }] },
              },
            }),
          };
        }
        if (dStep === 5) {
          // Both disc-a and disc-b have uninspectedRanges=[]! Must STILL get suggestedBatch > 0!
          expect(p.navigation?.budgetRequest).toBeDefined();
          sawDiscoverRereadBatch = (p.navigation?.budgetRequest?.suggestedBatch?.length ?? 0) > 0;
          // Try returning done=true citing UNSEALED quoteB (which is NOT in stagedComparisons and NOT in current materials) -> must NOT pass!
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              read: [],
              fetch: [],
              search: [],
              pages: [],
              question: "",
              report: "尝试跳过未封存引文",
              done: true,
              outcome: {
                kind: "covered",
                reason: "覆盖",
                comparisons: [
                  { page: "disc-a", quote: quoteA, reason: "甲页已封存" },
                  { page: "disc-b", quote: quoteB, reason: "乙页未封存引文" },
                ],
              },
            }),
          };
        }
        if (dStep === 6) {
          // Host must hold back the unsealed quoteB with stageHold + materials containing disc-b!
          sawStageHoldForUnsealedQuote = Boolean(p.navigation?.stageHold);
          expect(p.materials.some((m: { text: string }) => m.text.includes(quoteB))).toBe(true);
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              read: [],
              fetch: [],
              search: [],
              pages: [],
              question: "",
              report: "已在当前原文核实",
              done: true,
              outcome: {
                kind: "covered",
                reason: "已覆盖",
                comparisons: [
                  { page: "disc-a", quote: quoteA, reason: "甲页已封存" },
                  { page: "disc-b", quote: quoteB, reason: "乙页本次原文核实" },
                ],
              },
            }),
          };
        }
      }
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        costUsd: 0,
        output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
      };
    };

    const finished = await (await startDrop(f.root, batch.id, {}, { runAgent: agent })).done;
    expect(sawDiscoverRereadBatch).toBe(true);
    expect(sawStageHoldForUnsealedQuote).toBe(true);
    expect(finished.state, finished.error).toBe("archived");
  });

  it("aligns actual sent protocol with effectiveTurnSchema on budgetRequest, computes exact rules+JSON budget, reuses valid pre-1108 request cache, and preserves discover sealed convergence", async () => {
    const f = createFixture();
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({ contextWindowTokens: 48000, outputReserveTokens: 16384 }),
    );
    const quote = "分块预填充在固定预算下与解码请求共享批次。";
    const filler = "补充背景说明与参数约束段落。\n".repeat(180);
    f.write("wiki/concepts/cp-page.md", makePage("cp-page", `${quote}\n${filler}`));
    f.write("wiki/concepts/cp-aux.md", makePage("cp-aux", `辅助对照页说明。\n${filler}`));
    f.write("wiki/concepts/cp-extra.md", makePage("cp-extra", `扩展参考页说明。\n${filler}`));
    const batch = await acceptBatch(f.root, {
      key: "budget-response-contract-1108",
      items: [{ name: "src.md", text: `${quote} 核对分块预填充批次共享约束。` }],
    });

    let discoverSealedBudgetRules = "";
    let checkBudgetRules = "";
    let checkNormalRules = "";
    let checkBudgetFrameLimit = 0;
    let checkBudgetExpectedLimit = 0;
    let checkBudgetStdinBytes = 0;
    let dRound = 0;

    const makeAgent =
      (stopAfterCheckNegotiate: boolean): RunAgent =>
      async (req) => {
        const p = JSON.parse(req.stdin);
        const rules = req.args?.[req.args.indexOf("--system-prompt") + 1] ?? "";
        const currentBatch = readBatch(f.root, batch.id);
        const expectedLimit = inputByteLimit(f.root, rules, currentBatch.budget!);
        expect(Buffer.byteLength(req.stdin, "utf8")).toBeLessThanOrEqual(expectedLimit);

        if (p.mode === "drop-extract" || p.mode === "drop-read") {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              summary: "分块预填充边界",
              quotes: [p.materials[0].text.trim().split("\n")[0]],
              conditions: [],
              topics: [{ name: "分块预填充", query: "分块预填充" }],
            }),
          };
        }

        if (p.mode === "drop-discover") {
          dRound++;
          const lenPage = makePage("cp-page", `${quote}\n${filler}`).length;
          const lenAux = makePage("cp-aux", `辅助对照页说明。\n${filler}`).length;
          if (dRound === 1) {
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({ request: { pages: ["cp-page"] } }),
            };
          }
          const pageMat = p.read.find((r: { id: string }) => r.id === "cp-page").material as string;
          if (dRound === 2) {
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                request: {
                  pages: ["cp-aux"],
                  stage: { comparisons: [{ page: "cp-page", quote, reason: "已核引文" }] },
                },
              }),
            };
          }
          const auxMat = p.read.find((r: { id: string }) => r.id === "cp-aux").material as string;
          if (dRound === 3) {
            // Both cp-page and cp-aux are now 100% inspected via pageExtras (<16KB each); stage ruledOutPages for cp-aux and request both together to trigger over-budget with uninspectedRanges=[]
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                request: {
                  materials: [
                    { id: pageMat, start: 0, end: lenPage },
                    { id: auxMat, start: 0, end: lenAux },
                  ],
                  stage: { ruledOutPages: [{ page: "cp-aux", reason: "辅助无关" }] },
                },
              }),
            };
          }
          if (dRound === 4) {
            expect(p.navigation?.budgetRequest).toBeDefined();
            expect(
              (p.navigation.budgetRequest.requested as { uninspectedRanges: unknown[] }[]).every(
                (r) => r.uninspectedRanges.length === 0,
              ),
            ).toBe(true);
            expect(p.discoveryProgress?.pendingVerification).toEqual([]);
            discoverSealedBudgetRules = rules;
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                read: [],
                fetch: [],
                search: [],
                pages: [],
                question: "",
                report: "已封存全部引文，合法收敛",
                done: true,
                outcome: {
                  kind: "covered",
                  reason: "已覆盖",
                  comparisons: [{ page: "cp-page", quote, reason: "已核引文" }],
                },
              }),
            };
          }
        }

        if (p.mode === "drop-check") {
          if (p.navigation?.budgetRequest) {
            checkBudgetRules = rules;
            checkBudgetFrameLimit = p.navigation.budgetRequest.limit;
            checkBudgetExpectedLimit = expectedLimit;
            checkBudgetStdinBytes = Buffer.byteLength(req.stdin, "utf8");
            if (stopAfterCheckNegotiate) {
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({ issues: [], contradictions: [], report: "premature" }),
              };
            }
            const extraItem = (p.navigation.inventory as { id: string }[]).find((r) =>
              r.id.includes("cp-extra"),
            )!;
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({ request: { materials: [{ id: extraItem.id, start: 0, end: 200 }] } }),
            };
          }
          if (!(p.materials as { id: string }[]).some((m) => m.id.includes("cp-extra"))) {
            checkNormalRules = rules;
            const inv = p.navigation.inventory as { id: string; length: number }[];
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({
                request: { materials: inv.map((r) => ({ id: r.id, start: 0, end: r.length })) },
              }),
            };
          }
        }

        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({ issues: [], contradictions: [], dependencies: [], report: "ok" }),
        };
      };

    const run1 = await (await startDrop(f.root, batch.id, {}, { runAgent: makeAgent(true) })).done;
    expect(run1.state).toBe("failed");
    expect(run1.error).toContain("上下文预算协商未完成");

    // 1. Discover sealed-convergence turn (negotiateRequiresRequest=false) was genuinely observed and NOT locked to request-only
    expect(discoverSealedBudgetRules.length).toBeGreaterThan(0);
    expect(discoverSealedBudgetRules).toContain("stagedComparisons");
    expect(discoverSealedBudgetRules).not.toContain("本回合是强制预算协商回合");
    // 2. Non-negotiate drop-check turn was genuinely observed and NOT locked to request-only
    expect(checkNormalRules.length).toBeGreaterThan(0);
    expect(checkNormalRules).not.toContain("本回合是强制预算协商回合");
    // 3. Request-only drop-check budgetRequest turn MUST include budgetRequest contract and exact rules+JSON budget
    expect(checkBudgetRules).toContain("budgetRequest");
    expect(checkBudgetRules).toContain("本回合是强制预算协商回合");
    expect(checkBudgetFrameLimit).toBe(checkBudgetExpectedLimit);
    expect(checkBudgetStdinBytes).toBeLessThanOrEqual(checkBudgetExpectedLimit);

    // 4. Retry passes when returning suggestedBatch and finishes archived
    dRound = 0;
    const run2 = await (await startDrop(f.root, batch.id, { retry: true }, { runAgent: makeAgent(false) }))
      .done;
    expect(run2.state, run2.error).toBe("archived");
  });

  it("reuses pre-1108 valid v3 and v4 budgetRequest caches in 0 calls while rejecting non-request caches", async () => {
    for (const proto of [3, 4] as const) {
      const f = createFixture();
      f.write(
        "wiki/sync.config.local.json",
        JSON.stringify({ contextWindowTokens: 64000, outputReserveTokens: 16384 }),
      );
      const quote = "流水线微批次在气泡窗口内重叠反向或前向通信。";
      const bigBody = `${quote}\n${"大数据块填充内容用于超预算验证。\n".repeat(1200)}`;
      f.write("wiki/concepts/pp-big.md", makePage("pp-big", bigBody));
      const created = await acceptBatch(f.root, {
        key: `legacy-neg-cache-v${proto}`,
        items: [{ name: "src.md", text: `${quote} 核对微批次重叠。` }],
      });
      if (proto === 3) {
        const b = readBatch(f.root, created.id);
        b.protocol = 3;
        saveBatch(f.root, b);
      }

      let normalCheckRules = "";
      const seedAgent: RunAgent = async (req) => {
        const p = JSON.parse(req.stdin);
        const rules = req.args?.[req.args.indexOf("--system-prompt") + 1] ?? "";
        if (p.mode === "drop-extract" || p.mode === "drop-read") {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              summary: "流水线微批次",
              quotes: [p.materials[0].text.trim().slice(0, 14)],
              conditions: [],
              topics: [{ name: "流水线", query: "流水线" }],
            }),
          };
        }
        if (p.mode === "drop-discover") {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              read: [],
              fetch: [],
              search: [],
              pages: [],
              question: "",
              report: "无需旧页改动",
              done: true,
              outcome: { kind: "out-of-scope", reason: "仅测复核协商缓存", comparisons: [] },
            }),
          };
        }
        if (p.mode === "drop-check") {
          if (p.navigation?.budgetRequest) {
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({ issues: [], contradictions: [], report: "premature-stop" }),
            };
          }
          normalCheckRules = rules;
          const bigEntry = (p.navigation.inventory as { id: string; length?: number }[]).find((r) =>
            r.id.includes("pp-big"),
          )!;
          const fullBigLen = makePage("pp-big", bigBody).length;
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              request: { materials: [{ id: bigEntry.id, start: 0, end: fullBigLen }] },
            }),
          };
        }
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
        };
      };

      const stopped = await (await startDrop(f.root, created.id, {}, { runAgent: seedAgent })).done;
      expect(stopped.state).toBe("failed");
      expect(stopped.error).toContain("上下文预算协商未完成");
      expect(normalCheckRules.length).toBeGreaterThan(0);

      const saved = readBatch(f.root, created.id);
      const runDir = join(f.root, `wiki/_jobs/drops/runs/${created.id}/${saved.generation}`);
      const lastReceiptIn = JSON.parse(
        readFileSync(callReceiptPaths(runDir, saved.calls.at(-1)!.key).input, "utf8"),
      );
      const newNegData = lastReceiptIn.data;
      const oldLimit = inputByteLimit(f.root, normalCheckRules, saved.budget!);
      const newLimit = newNegData.navigation.budgetRequest.limit as number;
      expect(oldLimit).toBeGreaterThan(newLimit);

      const legacyNegData = {
        ...newNegData,
        navigation: {
          ...newNegData.navigation,
          budgetRequest: {
            ...newNegData.navigation.budgetRequest,
            limit: oldLimit,
            ...(proto === 4
              ? {
                  availableExtraBytes:
                    (newNegData.navigation.budgetRequest.availableExtraBytes as number) +
                    (oldLimit - newLimit),
                }
              : {}),
          },
        },
      };
      const legacyHash = digest(
        JSON.stringify({
          data: legacyNegData,
          rules: normalCheckRules,
          selection: saved.selection,
          budget: saved.budget,
          protocol: proto,
        }),
      );

      // 1) Poisoned non-request cache under pre-1108 hash must be rejected (not accepted!)
      const poisoned = JSON.stringify({ issues: [], contradictions: [], report: "bad-legacy" });
      writeFileSync(join(runDir, `${legacyHash}.json`), poisoned);
      let sawBudgetMissOnPoisoned = false;
      const afterPoisoned = await (
        await startDrop(
          f.root,
          created.id,
          { retry: true },
          {
            runAgent: async (req) => {
              const p = JSON.parse(req.stdin);
              if (p.navigation?.budgetRequest) sawBudgetMissOnPoisoned = true;
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({ issues: [], contradictions: [], report: "still-premature" }),
              };
            },
          },
        )
      ).done;
      expect(afterPoisoned.state).toBe("failed");
      expect(sawBudgetMissOnPoisoned).toBe(true);
      expect(readFileSync(join(runDir, `${legacyHash}.json`), "utf8")).toBe(poisoned);

      // 2) Valid pre-1108 request cache under pre-1108 hash must hit in 0 budgetRequest calls!
      rmSync(join(runDir, `${legacyHash}.json`));
      const firstReq = legacyNegData.navigation.budgetRequest.requested[0];
      const validSlice = { id: firstReq.id, ...firstReq.firstChunks[0] };
      const legacyInputPayload = JSON.stringify({ rules: normalCheckRules, data: legacyNegData });
      writeFileSync(join(runDir, `${legacyHash}.input.json`), legacyInputPayload);
      writeFileSync(join(runDir, `input-${digest(legacyInputPayload)}.json`), legacyInputPayload);
      writeFileSync(
        join(runDir, `${legacyHash}.json`),
        JSON.stringify({ request: { materials: [validSlice] } }),
      );

      let budgetCallsOnValidCache = 0;
      let nextFrameContainedSlice = false;
      const resumed = await (
        await startDrop(
          f.root,
          created.id,
          { retry: true },
          {
            runAgent: async (req) => {
              const p = JSON.parse(req.stdin);
              if (p.navigation?.budgetRequest) budgetCallsOnValidCache++;
              if (
                Array.isArray(p.materials) &&
                p.materials.some(
                  (m: { id: string; start: number; end: number }) =>
                    m.id === validSlice.id && m.start <= validSlice.start && m.end >= validSlice.end,
                )
              ) {
                nextFrameContainedSlice = true;
              }
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
              };
            },
          },
        )
      ).done;
      expect(resumed.state, resumed.error).toBe("archived");
      expect(budgetCallsOnValidCache, `proto=${proto} must reuse valid legacy budgetRequest cache`).toBe(0);
      expect(nextFrameContainedSlice).toBe(true);
    }
  });
});

describe("1132 drop-edit optional navigation budget & legacy microchunk continuation", () => {
  it("defers unrequested round-0 inventory under tight 128K real handbook budget, pages request.inventory on demand, preserves surrogate boundaries, and resumes cleanly after cached legacy microchunks", async () => {
    const f = createFixture();
    f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
    f.write("wiki/TERMS.md", readFileSync(new URL("../../wiki/TERMS.md", import.meta.url), "utf8"));
    f.write(
      "docs/wiki-writing-standard.md",
      readFileSync(new URL("../../docs/wiki-writing-standard.md", import.meta.url), "utf8"),
    );
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({ contextWindowTokens: 128000, outputReserveTokens: 16384 }),
    );
    for (let i = 0; i < 45; i++) {
      const slug = `filler-resource-${String(i).padStart(2, "0")}-${"a1b2c3d4e5f6".repeat(2)}`;
      f.write(
        `wiki/sources/${slug}.md`,
        `---\nid: ${slug}\ntitle: ${slug}\ntype: source\nsummary: 填充目录项 ${i}\nsources:\n  - https://example.com/filler-${i}\nevidence: I\nupdated: '2026-10-06'\n---\n填充材料正文 ${i}。\n`,
      );
    }

    // 真实长文量级（读取真实 chunked-prefill 正文长度级段落并嵌入 UTF-16 代理对 🧪）
    const realChunkedBody = readFileSync(
      new URL("../../wiki/concepts/chunked-prefill.md", import.meta.url),
      "utf8",
    )
      .replace(/^---[\s\S]*?---\r?\n/, "")
      .replace(/```wiki-diagram[\s\S]*?```/g, "段落图占位说明。")
      .replace(/\[([^\]]+)\]\([^)]*\.md(?:#[^)]*)?\)/g, "$1");
    const targetDoc = [
      "---",
      "id: long-target",
      "title: 长文修订目标",
      "type: feature",
      "summary: 分块预填充长文局部修订粒度验证",
      "sources:",
      "  - https://example.com/long-target",
      'evidence: "I"',
      "updated: '2026-10-06'",
      "---",
      "首段锚点原文：旧版默认描述。",
      `${realChunkedBody.slice(0, 9000)}\n中段代理对边界 🧪🚀 保持完整不切碎。\n${realChunkedBody.slice(9000)}`,
      "附录逐段核对条件与分块位置连续性说明。\n".repeat(220),
    ].join("\n");
    expect(targetDoc.length).toBeGreaterThan(20000);
    f.write("wiki/concepts/long-target.md", targetDoc);

    const sourceNoteText = `${"上游补证条件与参数边界逐条核对说明。".repeat(145)}\n关键核对结论：首段需补充 v2 限定。`;
    const batch = await acceptBatch(f.root, {
      key: "1132-tight-edit-budget",
      items: [{ name: "evidence.md", text: sourceNoteText }],
    });

    const editRanges: { start: number; end: number; bytes: number; limit: number; invLen: number }[] = [];
    const pagedInventorySlices: { count: number; next: number | null; total: number }[] = [];
    let firstChunkRound0InvLen = -1;
    let pagedOnFirstChunk = 0;
    let roomyCheckPreservedFullInv = false;

    const done = await (
      await startDrop(
        f.root,
        batch.id,
        {},
        {
          validate: () => [],
          runAgent: async (req) => {
            const p = JSON.parse(req.stdin);
            const rules = req.args[req.args.indexOf("--system-prompt") + 1]!;
            const limit = inputByteLimit(f.root, rules, {
              contextWindowTokens: 128000,
              outputReserveTokens: 16384,
            });
            const bytes = Buffer.byteLength(req.stdin, "utf8");
            expect(bytes).toBeLessThanOrEqual(limit);

            if (p.mode === "drop-extract" || p.mode === "drop-read") {
              const fullTxt = p.materials[0].text as string;
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({
                  summary: `补证条件核对：${"核心约束与适用边界核查摘要。".repeat(8)}`,
                  quotes: [fullTxt.slice(0, Math.min(80, fullTxt.length))],
                  conditions: Array.from(
                    { length: 10 },
                    (_, idx) =>
                      `条件约束条目-${idx}：仅在 v2 分块预填充路径与对应调度窗口下成立，不可无条件外推。`,
                  ),
                  topics: [{ name: "分块预填充", query: "long-target" }],
                }),
              };
            }
            if (p.mode === "drop-discover") {
              const hasReadTarget = Array.isArray(p.read)
                ? p.read.some((r: { id: string }) => r.id === "long-target")
                : false;
              if (!hasReadTarget) {
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    request: { pages: ["long-target"] },
                  }),
                };
              }
              const targetMat = (p.materials as { id: string; text: string }[]).find((m) =>
                m.id.includes("long-target.md"),
              );
              if (targetMat && !(p.discoveryProgress?.stagedComparisons?.length > 0)) {
                const quote = targetMat.text.slice(
                  targetMat.text.indexOf("首段锚点原文"),
                  targetMat.text.indexOf("首段锚点原文") + 13,
                );
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    request: {
                      stage: {
                        comparisons: [{ page: "long-target", quote, reason: "首段需补充 v2 限定" }],
                      },
                    },
                  }),
                };
              }
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({
                  read: [],
                  fetch: [],
                  search: [],
                  pages: [
                    {
                      path: "concepts/long-target.md",
                      reason: "补充 v2 限定条件",
                      toc: { part: "inference", section: "测试资料" },
                      evidence: [p.notes[0].ref],
                      comparisons: p.discoveryProgress.stagedComparisons.map(
                        ({ page, quote, reason }: { page: string; quote: string; reason: string }) => ({
                          page,
                          quote,
                          reason,
                        }),
                      ),
                    },
                  ],
                  question: "",
                  report: "定位到 long-target 首段需补充限定",
                  done: true,
                  outcome: {
                    kind: "integrate",
                    reason: "局部补充",
                    comparisons: p.discoveryProgress.stagedComparisons.map(
                      ({ page, quote, reason }: { page: string; quote: string; reason: string }) => ({
                        page,
                        quote,
                        reason,
                      }),
                    ),
                  },
                }),
              };
            }
            if (p.mode === "drop-edit") {
              // 在首片验证按需 request.inventory 分页取回未预装目录且绝不超限
              if (p.range.start === 0 && pagedOnFirstChunk < 2) {
                if (pagedOnFirstChunk === 0) {
                  firstChunkRound0InvLen = p.navigation.inventory.length;
                }
                const nextOffset = pagedOnFirstChunk === 0 ? 0 : (p.navigation.inventoryNext ?? 0);
                if (pagedOnFirstChunk === 1) {
                  pagedInventorySlices.push({
                    count: p.navigation.inventory.length,
                    next: p.navigation.inventoryNext,
                    total: p.navigation.inventoryTotal,
                  });
                }
                pagedOnFirstChunk++;
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({ request: { inventory: nextOffset } }),
                };
              }
              if (p.range.start === 0 && pagedOnFirstChunk === 2) {
                pagedInventorySlices.push({
                  count: p.navigation.inventory.length,
                  next: p.navigation.inventoryNext,
                  total: p.navigation.inventoryTotal,
                });
                pagedOnFirstChunk++;
              }
              editRanges.push({
                start: p.range.start,
                end: p.range.end,
                bytes,
                limit,
                invLen: p.navigation.inventory.length,
              });
              // UTF-16 代理对边界完整性校验
              const sliceText = targetDoc.slice(p.range.start, p.range.end);
              const firstCode = sliceText.charCodeAt(0);
              const lastCode = sliceText.charCodeAt(sliceText.length - 1);
              expect(firstCode >= 0xdc00 && firstCode <= 0xdfff).toBe(false);
              expect(lastCode >= 0xd800 && lastCode <= 0xdbff).toBe(false);

              const edits = [];
              if (p.range.start === 0) {
                const srcIdx = targetDoc.indexOf("https://example.com/long-target");
                edits.push({
                  start: srcIdx,
                  end: srcIdx + "https://example.com/long-target".length,
                  old: "https://example.com/long-target",
                  text: `https://example.com/long-target\n  - ${p.notes[0].ref}`,
                });
              }
              if (p.range.end === targetDoc.length) {
                edits.push({
                  start: targetDoc.length,
                  end: targetDoc.length,
                  old: "",
                  text: "\n补充结论：仅适用于 v2。\n",
                });
              }
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({
                  edits,
                  diagrams: [],
                  revision: { id: "long-target", kind: "supplement", reason: "补充 v2 条件" },
                }),
              };
            }
            if (p.mode === "drop-check") {
              if (p.navigation?.inventory?.length === 20 && !("inventoryNext" in p.navigation)) {
                roomyCheckPreservedFullInv = true;
              }
            }
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
            };
          },
        },
      )
    ).done;

    expect(done.state, done.error).toBe("review");
    // 1) 杜绝百片级微分片：2 万+ 字符长文应在 <= 15 片段落级分片内完成，首片 >= 1000 UTF-16 字符
    expect(editRanges.length).toBeLessThanOrEqual(15);
    expect(editRanges[0]!.end - editRanges[0]!.start).toBeGreaterThanOrEqual(1000);
    // 2) 全范围精确连续覆盖 [0, targetDoc.length)
    expect(editRanges[0]!.start).toBe(0);
    expect(editRanges.at(-1)!.end).toBe(targetDoc.length);
    for (let i = 1; i < editRanges.length; i++) {
      expect(editRanges[i]!.start).toBe(editRanges[i - 1]!.end);
    }
    // 3) 首片默认延迟可选目录（firstChunkRound0InvLen === 0），按需 request.inventory 分页每次均返回非空页并推进游标，且正常宽裕 drop-check 保持原 20 项预装字节
    expect(firstChunkRound0InvLen).toBe(0);
    expect(pagedInventorySlices).toHaveLength(2);
    expect(pagedInventorySlices[0]!.count).toBeGreaterThanOrEqual(1);
    expect(pagedInventorySlices[0]!.count).toBeLessThan(20);
    expect(pagedInventorySlices[0]!.next).toBe(pagedInventorySlices[0]!.count);
    expect(pagedInventorySlices[1]!.count).toBeGreaterThanOrEqual(1);
    const expectedSecondNext =
      pagedInventorySlices[0]!.count + pagedInventorySlices[1]!.count < pagedInventorySlices[1]!.total
        ? pagedInventorySlices[0]!.count + pagedInventorySlices[1]!.count
        : null;
    expect(pagedInventorySlices[1]!.next).toBe(expectedSecondNext);
    expect(roomyCheckPreservedFullInv).toBe(true);
  });

  it("reuses completed edit prefix in 0 calls, resumes from exact prefix end to review, and rejects out-of-range edits", async () => {
    const f = createFixture();
    f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
    f.write("wiki/TERMS.md", readFileSync(new URL("../../wiki/TERMS.md", import.meta.url), "utf8"));
    f.write(
      "docs/wiki-writing-standard.md",
      readFileSync(new URL("../../docs/wiki-writing-standard.md", import.meta.url), "utf8"),
    );
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({ contextWindowTokens: 128000, outputReserveTokens: 16384 }),
    );
    for (let i = 0; i < 35; i++) {
      const slug = `legacy-filler-${String(i).padStart(2, "0")}-${"9f8e7d6c5b4a".repeat(2)}`;
      f.write(
        `wiki/sources/${slug}.md`,
        `---\nid: ${slug}\ntitle: ${slug}\ntype: source\nsummary: 填充项 ${i}\nsources:\n  - https://example.com/${i}\nevidence: I\nupdated: '2026-10-06'\n---\n填充 ${i}\n`,
      );
    }
    const targetDoc = [
      "---",
      "id: resume-target",
      "title: 历史分片续接目标",
      "type: source",
      "summary: 验证已完成分片前缀零重跑续接",
      "sources:",
      "  - https://example.com/resume-target",
      'evidence: "I"',
      "updated: '2026-10-06'",
      "---",
      "首段锚点原文：旧版续接说明。",
      "长段内容行用于触发局部修订分片与微片承接验证。\n".repeat(420),
    ].join("\n");
    f.write("wiki/sources/resume-target.md", targetDoc);

    const sourceNoteText = `${"上游补证原文与边界说明保持完整不变。".repeat(205)}\n补证结论。`;
    const batch = await acceptBatch(f.root, {
      key: "1132-prefix-resume",
      items: [{ name: "ev.md", text: sourceNoteText }],
    });

    const phase1Ranges: { start: number; end: number }[] = [];
    const phase2Ranges: { start: number; end: number }[] = [];
    let phase: 1 | 2 | "oob" = 1;
    const makeAgent = (): RunAgent => async (req) => {
      const p = JSON.parse(req.stdin);
      if (p.mode === "drop-extract" || p.mode === "drop-read") {
        if (phase === 2) throw new Error(`unexpected rerun of ${p.mode} in phase ${phase}`);
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: `摘要：${"核心边界条件摘要。".repeat(35)}`,
            quotes: [(p.materials[0].text as string).slice(0, 60)],
            conditions: Array.from(
              { length: 26 },
              (_, idx) => `续接条件-${idx}：仅适用于紧预算局部修订分片场景。`,
            ),
            topics: [{ name: "续接", query: "resume-target" }],
          }),
        };
      }
      if (p.mode === "drop-discover") {
        if (phase === 2) throw new Error(`unexpected rerun of drop-discover in phase ${phase}`);
        const hasRead = Array.isArray(p.read)
          ? p.read.some((r: { id: string }) => r.id === "resume-target")
          : false;
        if (!hasRead) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({ request: { pages: ["resume-target"] } }),
          };
        }
        const mat = (p.materials as { id: string; text: string }[]).find((m) =>
          m.id.includes("resume-target.md"),
        );
        if (mat && !(p.discoveryProgress?.stagedComparisons?.length > 0)) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              request: {
                stage: {
                  comparisons: [
                    { page: "resume-target", quote: "首段锚点原文：旧版续接说明。", reason: "补充" },
                  ],
                },
              },
            }),
          };
        }
        const comps = p.discoveryProgress.stagedComparisons.map(
          ({ page, quote, reason }: { page: string; quote: string; reason: string }) => ({
            page,
            quote,
            reason,
          }),
        );
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            read: [],
            fetch: [],
            search: [],
            pages: [
              {
                path: "sources/resume-target.md",
                reason: "补充",
                toc: { part: "references", section: "测试资料" },
                evidence: [p.notes[0].ref],
                comparisons: comps,
              },
            ],
            question: "",
            report: "ok",
            done: true,
            outcome: { kind: "integrate", reason: "补充", comparisons: comps },
          }),
        };
      }
      if (p.mode === "drop-edit") {
        if (phase === "oob") {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              edits: [{ start: p.range.end, end: p.range.end + 1, old: "x", text: "y" }],
              diagrams: [],
              revision: null,
            }),
          };
        }
        if (phase === 1 && phase1Ranges.length >= 2) {
          return {
            id: req.id,
            ok: false,
            exitCode: 1,
            stderrTail: "",
            costUsd: 0,
            reason: "STOP_AFTER_TWO_CHUNKS",
          };
        }
        if (phase === 1) phase1Ranges.push({ start: p.range.start, end: p.range.end });
        else phase2Ranges.push({ start: p.range.start, end: p.range.end });

        const edits = [];
        if (p.range.start === 0) {
          const srcIdx = targetDoc.indexOf("https://example.com/resume-target");
          edits.push({
            start: srcIdx,
            end: srcIdx + "https://example.com/resume-target".length,
            old: "https://example.com/resume-target",
            text: `https://example.com/resume-target\n  - ${p.notes[0].ref}`,
          });
        }
        if (p.range.end === targetDoc.length) {
          edits.push({
            start: targetDoc.length,
            end: targetDoc.length,
            old: "",
            text: "\n续跑补入尾注：保留前缀修订并完整闭合。\n",
          });
        }
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            edits,
            diagrams: [],
            revision: { id: "resume-target", kind: "supplement", reason: "补充限定" },
          }),
        };
      }
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        costUsd: 0,
        output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
      };
    };

    const partial = await (
      await startDrop(f.root, batch.id, {}, { validate: () => [], runAgent: makeAgent() })
    ).done;
    expect(partial.state).toBe("failed");
    expect(phase1Ranges).toHaveLength(2);
    expect(phase1Ranges[0]!.start).toBe(0);
    expect(phase1Ranges[0]!.end - phase1Ranges[0]!.start).toBeGreaterThanOrEqual(1000);
    expect(phase1Ranges[1]!.start).toBe(phase1Ranges[0]!.end);

    phase = 2;
    const resumed = await (
      await startDrop(f.root, batch.id, { retry: true }, { validate: () => [], runAgent: makeAgent() })
    ).done;
    expect(resumed.state, resumed.error).toBe("review");
    expect(phase2Ranges.length).toBeGreaterThan(0);
    expect(phase2Ranges[0]!.start).toBe(phase1Ranges[1]!.end);
    expect(phase2Ranges.at(-1)!.end).toBe(targetDoc.length);
    const review = readReview(f.root, resumed.reviewId!);
    const afterText =
      review.payload.writes.find((x) => x.path === "wiki/sources/resume-target.md")?.after ?? "";
    expect(afterText).toContain("续跑补入尾注：保留前缀修订并完整闭合。");

    // 校验越界编辑会被宿主严格拒绝
    phase = "oob";
    const oobAttempt = await (
      await startDrop(f.root, batch.id, { newAttempt: true }, { validate: () => [], runAgent: makeAgent() })
    ).done;
    expect(oobAttempt.state).toBe("failed");
    expect(oobAttempt.error).toContain("修改超出本次绑定范围");
  });
});

describe("1160 drop-edit immediate cumulative validation & targeted bounded repair", () => {
  it("validates old text, within/cross-chunk overlap, and UTF-16 surrogate boundaries per chunk immediately and repairs only the failing chunk", async () => {
    const f = createFixture();
    f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
    f.write("wiki/TERMS.md", readFileSync(new URL("../../wiki/TERMS.md", import.meta.url), "utf8"));
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({ contextWindowTokens: 128000, outputReserveTokens: 16384 }),
    );
    const emojiParagraph = "含代理对边界测试行 🧪🚀 保持完整字符切分校验。\n\n".repeat(180);
    const targetDoc = [
      "---",
      "id: repair-edit-target",
      "title: 局部修订定点修复目标",
      "type: source",
      "summary: 验证单片编辑即时校验与定点有界修复",
      "sources:",
      "  - https://example.com/repair-edit-target",
      'evidence: "I"',
      "updated: '2026-10-06'",
      "---",
      "首段锚点原文：局部修订定点修复基线。\n",
      emojiParagraph,
      "尾段补证锚点行：用于片内重叠与最终合并验证。\n\n".repeat(220),
    ].join("\n");
    f.write("wiki/sources/repair-edit-target.md", targetDoc);

    const batch = await acceptBatch(f.root, {
      key: "1160-targeted-edit-repair",
      items: [{ name: "ev.md", text: "补证原文：首段与中尾段需补充限定说明。\n" }],
    });

    const editCallsByStart = new Map<number, number>();
    const repairReasonsByStart = new Map<number, string[]>();
    let firstMiddleStart: number | undefined;
    let chunk2CalledWhileChunk1Broken = false;
    let chunk1Repaired = false;

    const done = await (
      await startDrop(
        f.root,
        batch.id,
        {},
        {
          validate: () => [],
          runAgent: async (req) => {
            const p = JSON.parse(req.stdin);
            if (p.mode === "drop-extract" || p.mode === "drop-read") {
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({
                  summary: "局部修订恢复摘要",
                  quotes: [(p.materials[0].text as string).trim()],
                  conditions: ["v2-only"],
                  topics: [{ name: "定点修复", query: "repair-edit-target" }],
                }),
              };
            }
            if (p.mode === "drop-discover") {
              const hasRead = Array.isArray(p.read)
                ? p.read.some((r: { id: string }) => r.id === "repair-edit-target")
                : false;
              if (!hasRead) {
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({ request: { pages: ["repair-edit-target"] } }),
                };
              }
              const mat = (p.materials as { id: string; text: string }[]).find((m) =>
                m.id.includes("repair-edit-target.md"),
              );
              if (mat && !(p.discoveryProgress?.stagedComparisons?.length > 0)) {
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    request: {
                      stage: {
                        comparisons: [
                          {
                            page: "repair-edit-target",
                            quote: "首段锚点原文：局部修订定点修复基线。",
                            reason: "补充限定",
                          },
                        ],
                      },
                    },
                  }),
                };
              }
              const comps = p.discoveryProgress.stagedComparisons.map(
                ({ page, quote, reason }: { page: string; quote: string; reason: string }) => ({
                  page,
                  quote,
                  reason,
                }),
              );
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({
                  read: [],
                  fetch: [],
                  search: [],
                  pages: [
                    {
                      path: "sources/repair-edit-target.md",
                      reason: "补充限定",
                      toc: { part: "references", section: "测试资料" },
                      evidence: [p.notes[0].ref],
                      comparisons: comps,
                    },
                  ],
                  question: "",
                  report: "ok",
                  done: true,
                  outcome: { kind: "integrate", reason: "补充限定", comparisons: comps },
                }),
              };
            }
            if (p.mode === "drop-edit") {
              const start: number = p.range.start;
              const end: number = p.range.end;
              const attempt = (editCallsByStart.get(start) ?? 0) + 1;
              editCallsByStart.set(start, attempt);
              if (typeof p.repair === "string") {
                const list = repairReasonsByStart.get(start) ?? [];
                list.push(p.repair);
                repairReasonsByStart.set(start, list);
              }

              // 第 0 片（start === 0）：写入合法来源引用，并在片尾 end 处做一次零长插入以构造跨片边界不变量
              if (start === 0) {
                const srcIdx = targetDoc.indexOf("https://example.com/repair-edit-target");
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    edits: [
                      {
                        start: srcIdx,
                        end: srcIdx + "https://example.com/repair-edit-target".length,
                        old: "https://example.com/repair-edit-target",
                        text: `https://example.com/repair-edit-target\n  - ${p.notes[0].ref}`,
                      },
                      {
                        start: end,
                        end,
                        old: "",
                        text: "\n\n【首片尾界标记】\n\n",
                      },
                    ],
                    diagrams: [],
                    revision: { id: "repair-edit-target", kind: "supplement", reason: "补充" },
                  }),
                };
              }

              // 第 1 片（首个 start > 0 且 end < targetDoc.length）：依次注入 old 不匹配 -> 跨片重叠 -> UTF-16 代理对切裂 -> 合法编辑
              if (start > 0 && end < targetDoc.length) {
                firstMiddleStart ??= start;
                if (start !== firstMiddleStart) {
                  if (!chunk1Repaired) chunk2CalledWhileChunk1Broken = true;
                  return {
                    id: req.id,
                    ok: true,
                    exitCode: 0,
                    stderrTail: "",
                    costUsd: 0,
                    output: JSON.stringify({ edits: [], diagrams: [], revision: null }),
                  };
                }
                if (attempt === 1) {
                  return {
                    id: req.id,
                    ok: true,
                    exitCode: 0,
                    stderrTail: "",
                    costUsd: 0,
                    output: JSON.stringify({
                      edits: [{ start: start + 4, end: start + 14, old: "错误旧文本不匹配", text: "替换" }],
                      diagrams: [],
                      revision: null,
                    }),
                  };
                }
                if (attempt === 2) {
                  return {
                    id: req.id,
                    ok: true,
                    exitCode: 0,
                    stderrTail: "",
                    costUsd: 0,
                    output: JSON.stringify({
                      // 与第 0 片在边界 start 处的零长插入发生跨片重叠
                      edits: [{ start, end: start, old: "", text: "跨片冲突插入" }],
                      diagrams: [],
                      revision: null,
                    }),
                  };
                }
                if (attempt === 3) {
                  const slice = targetDoc.slice(start, end);
                  const emojiRel = slice.indexOf("🧪");
                  expect(emojiRel).toBeGreaterThanOrEqual(0);
                  const splitAt = start + emojiRel + 1;
                  return {
                    id: req.id,
                    ok: true,
                    exitCode: 0,
                    stderrTail: "",
                    costUsd: 0,
                    output: JSON.stringify({
                      edits: [
                        {
                          start: splitAt,
                          end: splitAt + 1,
                          old: targetDoc.slice(splitAt, splitAt + 1),
                          text: "X",
                        },
                      ],
                      diagrams: [],
                      revision: null,
                    }),
                  };
                }
                chunk1Repaired = true;
                const paraBreak = targetDoc.indexOf("\n\n", start + 1);
                expect(paraBreak).toBeGreaterThan(start);
                expect(paraBreak).toBeLessThan(end);
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    edits: [{ start: paraBreak, end: paraBreak, old: "", text: "\n\n【中片合法补充】" }],
                    diagrams: [],
                    revision: null,
                  }),
                };
              }

              // 末片（end === targetDoc.length）：校验绝不会在第 1 片未修好前被提前调用，并验证片内重叠定点修复
              if (!chunk1Repaired) chunk2CalledWhileChunk1Broken = true;
              if (attempt === 1) {
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    edits: [
                      { start: end - 12, end: end - 7, old: targetDoc.slice(end - 12, end - 7), text: "A" },
                      { start: end - 9, end: end - 4, old: targetDoc.slice(end - 9, end - 4), text: "B" },
                    ],
                    diagrams: [],
                    revision: null,
                  }),
                };
              }
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({
                  edits: [{ start: end, end, old: "", text: "\n\n【末片合法尾注】\n" }],
                  diagrams: [],
                  revision: null,
                }),
              };
            }
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
            };
          },
        },
      )
    ).done;

    expect(done.state, done.error).toBe("review");
    expect(chunk2CalledWhileChunk1Broken).toBe(false);
    // 第 0 片仅调用 1 次（后续多轮修复全程缓存复用 0 重跑）
    expect(editCallsByStart.get(0)).toBe(1);
    const chunk1Start = firstMiddleStart!;
    const lastStart = [...editCallsByStart.keys()].reduce((a, b) => Math.max(a, b), 0);
    expect(chunk1Start).toBeGreaterThan(0);
    expect(lastStart).toBeGreaterThan(chunk1Start);
    expect(editCallsByStart.get(chunk1Start)).toBe(4);
    expect(editCallsByStart.get(lastStart)).toBe(2);
    const chunk1Repairs = repairReasonsByStart.get(chunk1Start) ?? [];
    expect(chunk1Repairs[0]).toContain("局部修订原文不匹配");
    expect(chunk1Repairs[1]).toContain("局部修订范围重叠");
    expect(chunk1Repairs[2]).toContain("局部修订越过 Unicode 字符边界");
    expect((repairReasonsByStart.get(lastStart) ?? [])[0]).toContain("局部修订范围重叠");

    const review = readReview(f.root, done.reviewId!);
    const afterText =
      review.payload.writes.find((x) => x.path === "wiki/sources/repair-edit-target.md")?.after ?? "";
    expect(afterText).toContain("【首片尾界标记】");
    expect(afterText).toContain("【中片合法补充】");
    expect(afterText).toContain("【末片合法尾注】");
  });

  it("enforces candidate hash, boundRange, and repair prefix in validateDropEdits and applyDropEdits", () => {
    const text = "前缀文本🧪中间段落尾部";
    const hash = digest(text);
    expect(() => applyDropEdits(text, "bad-hash", [])).toThrow("局部修订 hash 已过期");
    expect(() =>
      validateDropEdits(text, hash, [{ start: 0, end: 2, old: "前缀", text: "新前缀" }], {
        boundRange: { start: 4, end: 10 },
        withRepairPrefix: true,
      }),
    ).toThrow(/局部修订校验失败：修改超出本次绑定范围/);
    expect(() =>
      validateDropEdits(text, hash, [{ start: -1, end: 2, old: "前缀", text: "新前缀" }], {
        withRepairPrefix: true,
      }),
    ).toThrow(/局部修订校验失败：局部修订范围无效/);
    expect(applyDropEdits(text, hash, [{ start: 0, end: 2, old: "前缀", text: "新前缀" }])).toBe(
      "新前缀文本🧪中间段落尾部",
    );
  });
});

describe("1179 tight-budget negotiation frame & executable next-frame suggestion", () => {
  it("fits negotiation frame within negLimit via recoverable navigation pagination and emits an executable suggestedBatch verified against next normal frame limit", async () => {
    const f = createFixture();
    f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
    f.write("wiki/TERMS.md", readFileSync(new URL("../../wiki/TERMS.md", import.meta.url), "utf8"));
    f.write(
      "docs/wiki-writing-standard.md",
      readFileSync(new URL("../../docs/wiki-writing-standard.md", import.meta.url), "utf8"),
    );
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({ contextWindowTokens: 128000, outputReserveTokens: 16384 }),
    );
    for (let i = 0; i < 6; i++) {
      f.write(
        `wiki/concepts/aux-page-${i}.md`,
        makePage(`aux-page-${i}`, `辅助参照正文段落 ${i}：保留跨页上下文。`),
      );
    }

    const targetDoc = [
      [
        "---",
        "id: neg-budget-target",
        "title: 紧预算补读协商目标",
        "type: feature",
        "summary: 验证紧预算下协商帧序列化收敛与下一正常帧可执行建议",
        "sources:",
        "  - https://example.com/neg-budget-target",
        'evidence: "I"',
        "updated: '2026-10-06'",
        "---",
      ].join("\n"),
      "首段锚点原文：紧预算补读协商基线。",
      "候选正文逐段技术说明与边界条件 🧪。\n\n".repeat(520).trim(),
      "## 对照源码\n\n对照源码位置与分块预填充边界说明 [I]。\n",
    ].join("\n\n");
    f.write("wiki/concepts/neg-budget-target.md", targetDoc);

    // 单块 ~11.4KB 来源原文（< 12000B 单片），使 drop-edit 紧贴 ~25.2KB 必需帧基线
    const srcPart1 = `${"核心调度预算与分块连续性限定原文说明行。\n".repeat(182)}\n`;
    const batch = await acceptBatch(f.root, {
      key: "1179-tight-negotiation-budget",
      items: [{ name: "tight-ev.md", text: srcPart1 }],
    });

    let sawNegotiation = false;
    let sawLoadedSuggestedEvidence = false;
    let firstSuggestedBatch: { id: string; start: number; end: number }[] = [];
    let baselineNotesJson = "";
    let baselineRequiredRanges: { id: string; start: number; end: number; text: string }[] = [];
    let handledTightEditRequest = false;

    const done = await (
      await startDrop(
        f.root,
        batch.id,
        {},
        {
          validate: () => [],
          runAgent: async (req) => {
            const p = JSON.parse(req.stdin);
            const rules = req.args[req.args.indexOf("--system-prompt") + 1]!;
            const turnLimit = inputByteLimit(f.root, rules, {
              contextWindowTokens: 128000,
              outputReserveTokens: 16384,
            });
            const turnBytes = Buffer.byteLength(req.stdin, "utf8");
            expect(turnBytes).toBeLessThanOrEqual(turnLimit);

            if (p.mode === "drop-extract" || p.mode === "drop-read") {
              const txt = p.materials[0].text as string;
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({
                  summary: `分段核验摘要：${"保持位置连续性与请求隔离前提说明。".repeat(8)}`,
                  quotes: [txt.trim().split("\n")[0]],
                  conditions: Array.from(
                    { length: 10 },
                    (_, idx) =>
                      `限定条件条目-${idx}：仅在显式分块预算、历史状态连续与随机种子回拨前提同时满足时成立，禁止无条件外推至其他部署配置。`,
                  ),
                  topics: Array.from({ length: 6 }, (_, idx) => ({
                    name: `专题条目-${idx}`,
                    query: `chunked prefill 预算 状态 隔离 ${idx}`,
                  })),
                }),
              };
            }
            if (p.mode === "drop-discover") {
              if (p.navigation?.budgetRequest?.suggestedBatch?.length) {
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    request: { materials: p.navigation.budgetRequest.suggestedBatch },
                  }),
                };
              }
              const readIds = Array.isArray(p.read) ? p.read.map((r: { id: string }) => r.id) : [];
              if (!readIds.includes("neg-budget-target")) {
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    request: { pages: ["neg-budget-target"] },
                  }),
                };
              }
              if (!(p.discoveryProgress?.stagedComparisons?.length > 0)) {
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({
                    request: {
                      stage: {
                        comparisons: [
                          {
                            page: "neg-budget-target",
                            quote: "首段锚点原文：紧预算补读协商基线。",
                            reason: "核对分块限定",
                          },
                        ],
                      },
                    },
                  }),
                };
              }
              const comps = p.discoveryProgress.stagedComparisons.map(
                ({ page, quote, reason }: { page: string; quote: string; reason: string }) => ({
                  page,
                  quote,
                  reason,
                }),
              );
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({
                  read: [],
                  fetch: [],
                  search: [],
                  pages: [
                    {
                      path: "concepts/neg-budget-target.md",
                      reason: `${"沿用既有稳定 id 与全部限定条件建立出处映射，不删改既有段落与来源顺序。".repeat(26)}`,
                      toc: { part: "inference", section: "分块协商" },
                      evidence: p.notes.map((n: { ref: string }) => n.ref),
                      comparisons: comps,
                    },
                  ],
                  question: "",
                  report: "ok",
                  done: true,
                  outcome: { kind: "integrate", reason: "补充限定", comparisons: comps },
                }),
              };
            }
            if (p.mode === "drop-edit") {
              const isBigNoteTurn = p.contribution === 0 && p.range.start === 0 && !handledTightEditRequest;
              if (isBigNoteTurn) {
                const neg = p.navigation?.budgetRequest;
                if (!neg) {
                  baselineNotesJson = JSON.stringify(p.notes);
                  baselineRequiredRanges = (
                    p.materials as { id: string; start: number; end: number; text: string }[]
                  ).map((m) => ({ id: m.id, start: m.start, end: m.end, text: m.text }));
                  const rawRes = (p.navigation.activeResources as { id: string }[]).find((r) =>
                    r.id.startsWith("source:"),
                  )!;
                  return {
                    id: req.id,
                    ok: true,
                    exitCode: 0,
                    stderrTail: "",
                    costUsd: 0,
                    output: JSON.stringify({
                      request: {
                        materials: [
                          {
                            id: p.range.id,
                            start: p.range.end,
                            end: Math.min(targetDoc.length, p.range.end + 8000),
                          },
                          { id: rawRes.id, start: 0, end: 2400 },
                        ],
                      },
                    }),
                  };
                }
                sawNegotiation = true;
                expect(JSON.stringify(p.notes)).toBe(baselineNotesJson);
                for (const reqMat of baselineRequiredRanges) {
                  expect(
                    (p.materials as { id: string; start: number; end: number; text: string }[]).some(
                      (m) =>
                        m.id === reqMat.id &&
                        m.start <= reqMat.start &&
                        m.end >= reqMat.end &&
                        m.text.slice(reqMat.start - m.start, reqMat.end - m.start) === reqMat.text,
                    ),
                  ).toBe(true);
                }
                expect(neg.reason).toContain("尚未提供");
                expect(neg.instruction).toContain("不得");
                expect(neg.availableExtraBytes).toBeGreaterThan(0);
                expect(Array.isArray(neg.requested)).toBe(true);
                expect(
                  (
                    neg.requested as { id: string; uninspectedRanges: { start: number; end: number }[] }[]
                  ).every((item) => typeof item.id === "string" && Array.isArray(item.uninspectedRanges)),
                ).toBe(true);
                expect(
                  (
                    neg.requested as { id: string; uninspectedRanges: { start: number; end: number }[] }[]
                  ).some((item) => item.uninspectedRanges.length > 0),
                ).toBe(true);
                expect(Array.isArray(neg.suggestedBatch)).toBe(true);
                expect(neg.suggestedBatch.length).toBeGreaterThan(0);
                firstSuggestedBatch = neg.suggestedBatch;
                handledTightEditRequest = true;
                return {
                  id: req.id,
                  ok: true,
                  exitCode: 0,
                  stderrTail: "",
                  costUsd: 0,
                  output: JSON.stringify({ request: { materials: neg.suggestedBatch } }),
                };
              }
              if (
                p.contribution === 0 &&
                p.range.start === 0 &&
                handledTightEditRequest &&
                !sawLoadedSuggestedEvidence
              ) {
                expect(p.navigation?.budgetRequest).toBeUndefined();
                expect(JSON.stringify(p.notes)).toBe(baselineNotesJson);
                for (const s of firstSuggestedBatch) {
                  expect(
                    (p.materials as { id: string; start: number; end: number }[]).some(
                      (m) => m.id === s.id && m.start <= s.start && m.end >= s.end,
                    ),
                  ).toBe(true);
                }
                sawLoadedSuggestedEvidence = true;
              }
              const edits = [];
              if (p.contribution === 0 && p.range.start === 0) {
                const srcIdx = targetDoc.indexOf("https://example.com/neg-budget-target");
                const refs = (p.target.evidence as string[]).map((r) => `  - ${r}`).join("\n");
                edits.push({
                  start: srcIdx,
                  end: srcIdx + "https://example.com/neg-budget-target".length,
                  old: "https://example.com/neg-budget-target",
                  text: `https://example.com/neg-budget-target\n${refs}`,
                });
              }
              if (p.contribution === 0 && p.range.end === targetDoc.length) {
                edits.push({
                  start: targetDoc.length,
                  end: targetDoc.length,
                  old: "",
                  text: "\n补充协商收敛后的尾注段落。\n",
                });
              }
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                costUsd: 0,
                output: JSON.stringify({
                  edits,
                  diagrams: [],
                  revision: { id: "neg-budget-target", kind: "supplement", reason: "补充限定" },
                }),
              };
            }
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              costUsd: 0,
              output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
            };
          },
        },
      )
    ).done;

    expect(done.state, done.error).toBe("review");
    expect(sawNegotiation).toBe(true);
    expect(sawLoadedSuggestedEvidence).toBe(true);
  });
});
