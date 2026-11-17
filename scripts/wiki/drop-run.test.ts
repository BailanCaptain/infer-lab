import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { RunAgent } from "./batch";
import { acceptBatch, readBatch, saveBatch } from "./drop-batch";
import { validateDropReceipt } from "./drop-receipt";
import { MAX_DROP_REPAIR_ROUNDS, startDrop } from "./drop-run";
import { approveReview, readReview } from "./review";
import { handbookFixture, wikiFixture } from "./test-fixture";
import { atomicText, digest } from "./workflow";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
const tempDirs: string[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
  for (const d of tempDirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const createDropFixture = () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/HANDBOOK.md", handbookFixture());
  f.write("wiki/log.md", "# log\n");
  return f;
};

const sourcePage = (id: string, sourceRef: string, body = "缓存保留来源与版本条件。") =>
  `---\nid: ${id}\ntitle: ${id}\ntype: source\nsummary: 缓存行为说明\nsources: [${sourceRef}]\nevidence: "I"\nupdated: '2026-11-15'\n---\n${body}\n`;

describe("drop-run v3/v4 coexistence, previousOutput repair context, and persistent repairRounds", () => {
  it("starts new batches at protocol 4, keeps interrupted legacy v3 batches on protocol 3 with 100% cache reuse on retry, and switches to v4 only on explicit newAttempt", async () => {
    const f = createDropFixture();
    const bNew = await acceptBatch(f.root, {
      key: "new-v4-batch",
      items: [{ name: "note.md", text: "新批次默认使用协议四完成整合与复核。" }],
    });

    const makeAgent = (counter: { calls: number; seenProtocols: number[] }): RunAgent => {
      return async (req) => {
        counter.calls++;
        const p = JSON.parse(req.stdin);
        counter.seenProtocols.push(p.protocol);
        let result: unknown;
        if (p.mode === "drop-extract" || p.mode === "drop-read") {
          result = {
            summary: "缓存版本说明",
            quotes: [p.materials[0].text],
            conditions: ["v0.26"],
            topics: [{ name: "缓存", query: "缓存" }],
          };
        } else if (p.mode === "drop-discover") {
          result = {
            read: [],
            fetch: [],
            search: [],
            pages: [
              {
                path: "sources/cache-note.md",
                reason: "新增独立资料页",
                toc: { part: "references", section: "测试资料" },
                evidence: [p.notes[0].ref],
                comparisons: [],
              },
            ],
            question: "",
            report: "整理为独立资料页",
            done: true,
            outcome: { kind: "integrate", reason: "新增资料页", comparisons: [] },
          };
        } else if (p.mode === "drop-generate") {
          result = {
            text: sourcePage("cache-note", p.notes[0].ref),
            diagrams: [],
            revision: null,
          };
        } else {
          result = { issues: [], contradictions: [], report: "核对无误" };
        }
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify(result),
        };
      };
    };

    // 1. Brand-new batch runs at protocol: 4
    const v4Stats = { calls: 0, seenProtocols: [] as number[] };
    const doneV4 = await (await startDrop(f.root, bNew.id, {}, { runAgent: makeAgent(v4Stats) })).done;
    expect(doneV4.protocol).toBe(4);
    expect(doneV4.state).toBe("review");
    expect(new Set(v4Stats.seenProtocols)).toEqual(new Set([4]));
    const reviewV4 = readReview(f.root, doneV4.reviewId!);
    expect(reviewV4.payload.drop?.protocol).toBe(4);
    expect(reviewV4.payload.drop?.receipt?.protocol).toBe(4);

    // 2. Isolated constructed historical v3 batch interrupted mid-run after 2 cached calls!
    const fLegacy = createDropFixture();
    const bV3 = await acceptBatch(fLegacy.root, {
      key: "legacy-v3-interrupted",
      items: [{ name: "legacy.md", text: "存量 v3 批次在中断后应原协议无损续跑并命中既有缓存。" }],
    });
    // Seed batch.protocol = 3 as an existing historical v3 batch before its first run,
    // and stop after 2 model calls using testLimits.calls = 2!
    const seeded = readBatch(fLegacy.root, bV3.id);
    seeded.protocol = 3;
    saveBatch(fLegacy.root, seeded);

    const run1Stats = { calls: 0, seenProtocols: [] as number[] };
    const interrupted = await (
      await startDrop(fLegacy.root, bV3.id, {}, { runAgent: makeAgent(run1Stats), testLimits: { calls: 2 } })
    ).done;
    expect(interrupted.state).toBe("failed");
    expect(interrupted.protocol).toBe(3);
    expect(run1Stats.calls).toBe(2);
    expect(new Set(run1Stats.seenProtocols)).toEqual(new Set([3]));
    const attemptJson = JSON.parse(
      readFileSync(join(fLegacy.root, `wiki/_jobs/drops/runs/${bV3.id}/0/attempt.json`), "utf8"),
    );
    expect(attemptJson.protocol).toBe(3);

    // Resume via retry: true WITHOUT newAttempt -> MUST stay protocol 3 AND reuse the 2 cached calls!
    const totalCallsNeeded = v4Stats.calls;
    const resumeStats = { calls: 0, seenProtocols: [] as number[] };
    const resumed = await (
      await startDrop(fLegacy.root, bV3.id, { retry: true }, { runAgent: makeAgent(resumeStats) })
    ).done;
    expect(resumed.state).toBe("review");
    expect(resumed.protocol).toBe(3);
    expect(resumed.generation).toBe(0);
    expect(new Set(resumeStats.seenProtocols)).toEqual(new Set([3]));
    // Zero re-paid calls for the 2 stages already cached before interruption!
    expect(resumeStats.calls).toBe(totalCallsNeeded - 2);
    const reviewV3 = readReview(fLegacy.root, resumed.reviewId!);
    expect(reviewV3.payload.drop?.protocol).toBe(3);
    expect(reviewV3.payload.drop?.receipt?.protocol).toBe(3);

    // 3. Explicit newAttempt: true on that v3 batch switches cleanly to protocol: 4 in generation 1!
    const upgradeStats = { calls: 0, seenProtocols: [] as number[] };
    const upgraded = await (
      await startDrop(fLegacy.root, bV3.id, { newAttempt: true }, { runAgent: makeAgent(upgradeStats) })
    ).done;
    expect(upgraded.state).toBe("review");
    expect(upgraded.generation).toBe(1);
    expect(upgraded.protocol).toBe(4);
    expect(new Set(upgradeStats.seenProtocols)).toEqual(new Set([4]));
    const approved = await approveReview(fLegacy.root, upgraded.reviewId!, { validate: () => [] });
    expect(approved.state).toBe("published");
  });

  it("passes previousOutput on stage repair and persists repairRounds across process restarts within a generation", async () => {
    const f = createDropFixture();
    const b = await acceptBatch(f.root, {
      key: "repair-persistence",
      items: [{ name: "broken.md", text: "用于验证自动修复携带上次失败输出以及跨重启持久化修复轮数。" }],
    });

    const observedRepairs: { repair?: string; previousOutput?: unknown }[] = [];
    let attemptCounter = 0;

    // Agent fails schema validation on drop-extract with distinct error details each round,
    // and stops via testLimits after 2 calls in Process 1 to simulate process restart!
    const failingExtractAgent: RunAgent = async (req) => {
      attemptCounter++;
      const p = JSON.parse(req.stdin);
      if (p.repair !== undefined || p.previousOutput !== undefined) {
        observedRepairs.push({ repair: p.repair, previousOutput: p.previousOutput });
      }
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        costUsd: 0,
        // Missing required fields (`quotes`, `conditions`, `topics`) with unique unrecognized key per call so seenFailures doesn't mask repairRounds!
        output: JSON.stringify({ [`wrongField_${attemptCounter}`]: "bad-attempt" }),
      };
    };

    // Process 1: runs initial call (#1) + repair round 1 (#2), then hits call limit = 2 and stops!
    const run1 = await (
      await startDrop(f.root, b.id, {}, { runAgent: failingExtractAgent, testLimits: { calls: 2 } })
    ).done;
    expect(run1.state).toBe("failed");
    expect(observedRepairs).toHaveLength(1);
    expect(observedRepairs[0]?.previousOutput).toBe(JSON.stringify({ wrongField_1: "bad-attempt" }));

    // Process 2 (simulating process restart via retry: true in same generation 0):
    // Only MAX_DROP_REPAIR_ROUNDS - 1 more repair rounds should execute before hitting MAX_DROP_REPAIR_ROUNDS (3)!
    const run2 = await (await startDrop(f.root, b.id, { retry: true }, { runAgent: failingExtractAgent }))
      .done;
    expect(run2.state).toBe("failed");
    expect(run2.error).toContain(`已自动修订 ${MAX_DROP_REPAIR_ROUNDS} 轮仍未通过`);
    // Total calls across BOTH restarts must equal 1 initial + MAX_DROP_REPAIR_ROUNDS (1 + 3 = 4), NOT 2 + 4 = 6!
    expect(attemptCounter).toBe(1 + MAX_DROP_REPAIR_ROUNDS);
    expect(observedRepairs.at(-1)?.previousOutput).toBe(
      JSON.stringify({ [`wrongField_${MAX_DROP_REPAIR_ROUNDS}`]: "bad-attempt" }),
    );

    // Explicit newAttempt: true increments generation and resets repairRounds cleanly!
    let fixed = false;
    const recoveringAgent: RunAgent = async (req) => {
      const p = JSON.parse(req.stdin);
      if (p.mode === "drop-extract" && !fixed) {
        fixed = true;
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({ wrongField: "needs-one-repair" }),
        };
      }
      if (p.mode === "drop-extract") {
        expect(p.previousOutput).toBe(JSON.stringify({ wrongField: "needs-one-repair" }));
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: "修复成功",
            quotes: [p.materials[0].text],
            conditions: [],
            topics: [{ name: "测试", query: "测试" }],
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
            report: "无需变更",
            done: true,
            outcome: { kind: "out-of-scope", reason: "仅测试", comparisons: [] },
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

    // Suppress unused import warning on atomicText while keeping helper ready if needed
    void atomicText;
    const recovered = await (
      await startDrop(f.root, b.id, { newAttempt: true }, { runAgent: recoveringAgent })
    ).done;
    expect(recovered.generation).toBe(1);
    expect(recovered.state).toBe("archived");
  });

  it("reuses genuine f44c953 v3 generation cache, repair cache, and pending/publishing review recovery without duplicate model calls or payload mutation", async () => {
    const repo = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../..");
    const out = mkdtempSync(join(tmpdir(), "wiki-f44-legacy-v3-"));
    tempDirs.push(out);
    const req = createRequire(join(repo, "package.json"));
    const originals = [
      "scripts/wiki/drop-run.ts",
      "scripts/wiki/drop-integration.ts",
      "scripts/wiki/standard.ts",
    ];
    const destinations = new Map(originals.map((p) => [p, join(out, p.split("/").at(-1)!)]));
    const modulePath = (original: string, spec: string) => {
      if (spec.startsWith("node:")) return spec;
      if (!spec.startsWith(".")) return pathToFileURL(req.resolve(spec)).href;
      const absolute = resolve(dirname(join(repo, original)), spec);
      const extension = existsSync(absolute) ? "" : existsSync(`${absolute}.ts`) ? ".ts" : ".tsx";
      const target = absolute + extension;
      const relative = target.slice(resolve(repo).length + 1).replaceAll("\\", "/");
      return pathToFileURL(destinations.get(relative) ?? target).href;
    };
    for (const original of originals) {
      const source = execFileSync("git", ["show", `f44c953:${original}`], { cwd: repo, encoding: "utf8" });
      const transformed = source
        .replace(/new URL\("([^"]+)", import\.meta\.url\)/g, (_m, spec: string) => {
          const absolute = resolve(dirname(join(repo, original)), spec);
          const gitPath = absolute.slice(resolve(repo).length + 1).replaceAll("\\", "/");
          const saved = join(out, "original-rules", gitPath);
          mkdirSync(dirname(saved), { recursive: true });
          writeFileSync(saved, execFileSync("git", ["show", `f44c953:${gitPath}`], { cwd: repo }));
          return `new URL(${JSON.stringify(pathToFileURL(saved).href)})`;
        })
        .replace(
          /from\s+(["'])([^"']+)\1/g,
          (_m, _q, spec) => `from ${JSON.stringify(modulePath(original, spec))}`,
        )
        .replaceAll("import.meta.url", JSON.stringify(pathToFileURL(join(repo, original)).href));
      writeFileSync(destinations.get(original)!, transformed);
    }
    const { startDrop: startLegacy } = (await import(
      pathToFileURL(destinations.get("scripts/wiki/drop-run.ts")!).href
    )) as { startDrop: typeof startDrop };

    const makeAgent =
      (calls: string[]): RunAgent =>
      async (request) => {
        const p = JSON.parse(request.stdin);
        calls.push(p.mode ?? "(check)");
        let result: unknown;
        if (p.mode === "drop-extract" || p.mode === "drop-read") {
          result = {
            summary: "Durable cache",
            quotes: [p.materials[0].text],
            conditions: [],
            topics: [{ name: "cache", query: "cache" }],
          };
        } else if (p.mode === "drop-discover") {
          result = {
            read: [],
            fetch: [],
            search: [],
            pages: [
              {
                path: "sources/cache-note.md",
                reason: "New source",
                toc: { part: "references", section: "Fixture" },
                evidence: [p.notes[0].ref],
                comparisons: [],
              },
            ],
            question: "",
            report: "New source",
            done: true,
            outcome: { kind: "integrate", reason: "New source", comparisons: [] },
          };
        } else if (p.mode === "drop-generate") {
          result = {
            text: `---\nid: cache-note\ntitle: Cache note\ntype: source\nsummary: Durable cache\nsources: [${p.notes[0].ref}]\nevidence: I\nupdated: '2026-11-15'\n---\nDurable caching preserves version conditions.\n`,
            diagrams: [],
            revision: null,
          };
        } else {
          result = { issues: [], contradictions: [], report: "Verified fixture" };
        }
        return {
          id: request.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify(result),
        };
      };

    // Subcase A: Genuine f44c953 interrupted after drop-generate (4 calls) -> current engine resumes WITHOUT calling drop-generate again!
    const fGen = createDropFixture();
    const bGen = await acceptBatch(fGen.root, {
      key: "genuine-f44-v3-gen-cache",
      items: [{ name: "note.md", text: "A new reference explains durable caching and version conditions." }],
    });
    const oldGenCalls: string[] = [];
    const newGenCalls: string[] = [];
    const firstGen = await (
      await startLegacy(
        fGen.root,
        bGen.id,
        {},
        { runAgent: makeAgent(oldGenCalls), testLimits: { calls: 4 } },
      )
    ).done;
    expect(firstGen.state).toBe("failed");
    expect(oldGenCalls).toEqual(["drop-extract", "drop-discover", "drop-check", "drop-generate"]);

    const resumedGen = await (
      await startDrop(fGen.root, bGen.id, { retry: true }, { runAgent: makeAgent(newGenCalls) })
    ).done;
    expect(resumedGen.state, resumedGen.error).toBe("review");
    expect(resumedGen.generation).toBe(0);
    expect(resumedGen.protocol).toBe(3);
    expect(newGenCalls).toEqual(["drop-check"]);
    expect(newGenCalls).not.toContain("drop-generate");

    // Subcase B: Genuine f44c953 failed-repair cache on drop-generate -> current engine reuses repaired drop-generate cache!
    const fRepair = createDropFixture();
    const bRepair = await acceptBatch(fRepair.root, {
      key: "genuine-f44-v3-repair-cache",
      items: [{ name: "note.md", text: "Repair cache compatibility under legacy v3." }],
    });
    let legacyGenAttempts = 0;
    const oldRepairCalls: string[] = [];
    const legacyRepairAgent: RunAgent = async (req) => {
      const p = JSON.parse(req.stdin);
      oldRepairCalls.push(`${p.mode}:${p.repair ? "repair" : "initial"}`);
      if (p.mode === "drop-generate" && legacyGenAttempts++ === 0) {
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({ broken: true }),
        };
      }
      return makeAgent([])(req);
    };
    // Calls in legacy: 1 extract, 2 discover, 3 check(coverage), 4 generate(broken), 5 generate(repair) -> limit 5 stops right before final check!
    const firstRepair = await (
      await startLegacy(
        fRepair.root,
        bRepair.id,
        {},
        { runAgent: legacyRepairAgent, testLimits: { calls: 5 } },
      )
    ).done;
    expect(firstRepair.state).toBe("failed");
    expect(oldRepairCalls).toContain("drop-generate:repair");

    const newRepairCalls: string[] = [];
    const resumedRepair = await (
      await startDrop(fRepair.root, bRepair.id, { retry: true }, { runAgent: makeAgent(newRepairCalls) })
    ).done;
    expect(resumedRepair.state, resumedRepair.error).toBe("review");
    expect(resumedRepair.protocol).toBe(3);
    expect(newRepairCalls).toEqual(["drop-check"]);

    // Subcase C: Genuine f44c953 pending & publishing review recovery without payload byte mutation!
    const fRev = createDropFixture();
    const bRev = await acceptBatch(fRev.root, {
      key: "genuine-f44-v3-review-recovery",
      items: [{ name: "note.md", text: "Pending and publishing review recovery under legacy v3." }],
    });
    const completedLegacy = await (await startLegacy(fRev.root, bRev.id, {}, { runAgent: makeAgent([]) }))
      .done;
    expect(completedLegacy.state).toBe("review");
    const reviewFile = join(fRev.root, `wiki/_jobs/reviews/${completedLegacy.reviewId}.json`);
    const originalReviewBytes = readFileSync(reviewFile, "utf8");
    const originalPayloadDigest = digest(JSON.stringify(JSON.parse(originalReviewBytes).payload));

    const noOpCalls: string[] = [];
    const recoveredPending = await (
      await startDrop(fRev.root, bRev.id, {}, { runAgent: makeAgent(noOpCalls) })
    ).done;
    expect(recoveredPending.state).toBe("review");
    expect(noOpCalls).toEqual([]);
    expect(readFileSync(reviewFile, "utf8")).toBe(originalReviewBytes);

    // Simulate interrupted publishing state and verify approveReview recovers & publishes without mutating payload!
    const publishingRecord = JSON.parse(originalReviewBytes);
    publishingRecord.state = "publishing";
    writeFileSync(reviewFile, `${JSON.stringify(publishingRecord, null, 2)}\n`);
    const published = await approveReview(fRev.root, completedLegacy.reviewId!, { validate: () => [] });
    expect(published.state).toBe("published");
    expect(digest(JSON.stringify(published.payload))).toBe(originalPayloadDigest);
  });

  it("audits non-verbatim v4 page revisions in independent fact-disposition check, repairs semantic corruptions, and approves sealed receipts offline", async () => {
    const f = createDropFixture();
    f.write(
      "wiki/sources/existing.md",
      sourcePage(
        "existing",
        "https://docs.vllm.ai/en/latest/",
        "## 一句话\nRequests are handled one at a time.",
      ),
    );
    const b = await acceptBatch(f.root, {
      key: "v4-semantic-fact-check",
      items: [{ name: "update.md", text: "Sequential request execution details for v0.26." }],
    });

    let genRound = 0;
    let factChecks = 0;
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
            summary: "Sequential execution",
            quotes: [p.materials[0].text],
            conditions: [],
            topics: [{ name: "existing", query: "existing" }],
          }),
        };
      }
      if (p.mode === "drop-discover") {
        const alreadyRead = (p.read ?? []).some((r: { id: string }) => r.id === "existing");
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            read: alreadyRead ? [] : ["existing"],
            fetch: [],
            search: [],
            pages: alreadyRead
              ? [
                  {
                    path: "sources/existing.md",
                    reason: "Merge concise sequential explanation",
                    toc: { part: "references", section: "测试资料" },
                    evidence: [p.notes[0].ref],
                    comparisons: [
                      {
                        page: "existing",
                        quote: "Requests are handled one at a time.",
                        reason: "Preserve sequential behavior while tightening wording",
                      },
                    ],
                  },
                ]
              : [],
            question: "",
            report: "Update existing page",
            done: alreadyRead,
            outcome: { kind: "integrate", reason: "Update existing page", comparisons: [] },
          }),
        };
      }
      if (p.mode === "drop-generate") {
        genRound++;
        // Round 1 corrupts semantics ("concurrently"); Round 2 writes valid paraphrase ("Processing is sequential.")
        const sentence =
          genRound === 1 ? "Requests are scheduled concurrently." : "Processing is sequential.";
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            text: sourcePage(
              "existing",
              `https://docs.vllm.ai/en/latest/, ${p.notes[0].ref}`,
              `## 一句话\n${sentence}`,
            ),
            diagrams: [],
            revision: { id: "existing", kind: "editorial", reason: "Tighten sequential phrasing" },
          }),
        };
      }
      if (p.mode === "drop-fact-check") {
        factChecks++;
        const allText = p.materials.map((m: { text: string }) => m.text).join("\n");
        const corrupted = allText.includes("Requests are scheduled concurrently.");
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            verdicts: p.pendingFacts.map((item: { index: number }) =>
              corrupted
                ? {
                    index: item.index,
                    preserved: false,
                    reason:
                      "Candidate inverted one-at-a-time sequential execution into concurrent scheduling.",
                  }
                : {
                    index: item.index,
                    preserved: true,
                    outlet: "retained",
                    targetQuote: "Processing is sequential.",
                    reason: "Sequential processing preserves one-at-a-time semantics.",
                  },
            ),
            contradictions: [],
            report: corrupted ? "Rejected semantic inversion" : "Verified semantic equivalence",
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

    const done = await (await startDrop(f.root, b.id, {}, { runAgent: agent, validate: () => [] })).done;
    expect(done.state, done.error).toBe("review");
    expect(genRound).toBe(2);
    expect(factChecks).toBe(2);

    const review = readReview(f.root, done.reviewId!);
    expect(review.payload.drop?.protocol).toBe(4);
    const receipt = review.payload.drop!.receipt!;
    if (receipt.protocol !== 4) throw new Error("expected v4 receipt");
    expect(receipt.factDispositions).toHaveLength(1);
    expect(receipt.factDispositions[0]).toMatchObject({
      pageId: "existing",
      fact: "Requests are handled one at a time.",
      outlet: "retained",
      verification: "semantic-check",
      targetQuote: "Processing is sequential.",
      checkId: "fact-disposition:existing",
    });

    // Tampering with candidate text offline must fail validateDropReceipt without any model calls!
    const tamperedWrites = review.payload.writes.map((w) =>
      w.path === "wiki/sources/existing.md"
        ? { ...w, after: w.after!.replace("Processing is sequential.", "Processing is concurrent.") }
        : w,
    );
    expect(() =>
      validateDropReceipt(f.root, review.payload.drop, tamperedWrites, review.payload.decision.revisions),
    ).toThrow(/校验失败|hash/);

    // Offline approval succeeds with ZERO additional model calls!
    const callsBeforeApprove = factChecks;
    const approved = await approveReview(f.root, done.reviewId!, { validate: () => [] });
    expect(approved.state).toBe("published");
    expect(factChecks).toBe(callsBeforeApprove);
  });
});
