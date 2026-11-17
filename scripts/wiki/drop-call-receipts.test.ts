import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RunAgent } from "./batch";
import { acceptBatch, readBatch } from "./drop-batch";
import { callReceiptPaths, startDrop } from "./drop-run";
import { handbookFixture, wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

const sha256 = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

const snapshotTopLevelFiles = (dir: string) =>
  Object.fromEntries(
    readdirSync(dir)
      .filter((name) => statSync(join(dir, name)).isFile())
      .sort()
      .map((name) => [name, sha256(join(dir, name))]),
  );

const createFixture = () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/HANDBOOK.md", handbookFixture());
  f.write("wiki/log.md", "# log\n");
  return f;
};

const makePage = (id: string, body: string) =>
  `---\nid: ${id}\ntitle: ${id}\ntype: feature\nsummary: 机制说明\nsources:\n  - https://example.com/${id}\nevidence: I\nupdated: '2026-10-06'\n---\n${body}\n`;

describe("1058 call-keyed immutable receipts & non-overwriting retry cache", () => {
  it("preserves failed receipt bytes on same-hash retry, keys every raw attempt by calls[].key, only caches schema-accepted output, and hits valid cache with 0 calls", async () => {
    const f = createFixture();
    const pageBody = "算子融合在形状固定时减少核函数启动开销。";
    f.write("wiki/concepts/fusion-note.md", makePage("fusion-note", pageBody));
    const batch = await acceptBatch(f.root, {
      key: "receipt-retry-pass",
      items: [{ name: "note.md", text: pageBody }],
    });

    let phase: "fail-first" | "pass-retry" | "cache-hit" = "fail-first";
    let rangeGateCalls = 0;
    let sentOutOfBounds = false;
    const makeAgent = (): RunAgent => async (req) => {
      const p = JSON.parse(req.stdin);
      if (p.mode === "drop-extract" || p.mode === "drop-read") {
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: "算子融合前提",
            quotes: [p.materials[0].text.trim().slice(0, 12)],
            conditions: [],
            topics: [{ name: "算子融合", query: "算子融合" }],
          }),
        };
      }
      if (p.mode === "drop-discover") {
        if (!p.read?.some((r: { id: string }) => r.id === "fusion-note")) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({ request: { pages: ["fusion-note"] } }),
          };
        }
        const pageEntry = p.read.find((r: { id: string }) => r.id === "fusion-note");
        const pageMatId = pageEntry.material as string;
        if (phase === "fail-first" && !p.navigation?.rangeErrors && !sentOutOfBounds) {
          sentOutOfBounds = true;
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({
              request: { materials: [{ id: pageMatId, start: 0, end: 999999 }] },
            }),
          };
        }
        if (p.navigation?.rangeErrors) {
          rangeGateCalls++;
          if (phase === "fail-first") {
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "premature-attempt-1",
              costUsd: 0,
              output: JSON.stringify({
                read: [],
                fetch: [],
                search: [],
                pages: [],
                question: "",
                report: "未修正越界直接给结论",
                done: true,
                outcome: {
                  kind: "covered",
                  reason: "早熟结论",
                  comparisons: [{ page: "fusion-note", quote: pageBody, reason: "未核原文" }],
                },
              }),
            };
          }
          const fullLen = Number(/length=(\d+)/.exec(JSON.stringify(p.navigation.rangeErrors))?.[1] ?? 171);
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "corrected-attempt-2",
            costUsd: 0,
            output: JSON.stringify({
              request: { materials: [{ id: pageMatId, start: 0, end: fullLen }] },
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
            pages: [],
            question: "",
            report: "已在原文核实覆盖",
            done: true,
            outcome: {
              kind: "covered",
              reason: "完全一致",
              comparisons: [{ page: "fusion-note", quote: pageBody, reason: "已核原文" }],
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
        output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
      };
    };

    const run1 = await (await startDrop(f.root, batch.id, {}, { runAgent: makeAgent() })).done;
    expect(run1.state).toBe("failed");
    expect(run1.error).toContain("补读范围协商未完成");
    expect(rangeGateCalls).toBe(1);

    const runDir = join(f.root, `wiki/_jobs/drops/runs/${batch.id}/${run1.generation}`);
    const topBeforeRetry = snapshotTopLevelFiles(runDir);
    const failedHashes = readdirSync(runDir)
      .filter((name) => /^[a-f0-9]{64}\.output\.json$/.test(name))
      .map((name) => name.slice(0, 64))
      .filter((hash) => !existsSync(join(runDir, `${hash}.json`)));
    expect(failedHashes).toHaveLength(1);
    const failedHash = failedHashes[0]!;

    const failedCall = run1.calls.at(-1)!;
    const { input: call1In, output: call1Out } = callReceiptPaths(runDir, failedCall.key);

    // Retry and stop right after the retried range-gate call is accepted (calls limit = run1.calls.length + 1)
    phase = "pass-retry";
    sentOutOfBounds = false;
    const run2 = await (
      await startDrop(
        f.root,
        batch.id,
        { retry: true },
        { testLimits: { calls: run1.calls.length + 1 }, runAgent: makeAgent() },
      )
    ).done;
    expect(run2.state).toBe("failed");
    expect(run2.error).toContain("显式测试调用限额到达");
    expect(rangeGateCalls).toBe(2);
    expect(run2.calls.slice(0, run1.calls.length)).toEqual(run1.calls);

    // Every pre-existing top-level receipt/cache file (including <failedHash>.output.json) must remain byte-for-byte identical
    const topAfterRetry = snapshotTopLevelFiles(runDir);
    for (const [name, oldSha] of Object.entries(topBeforeRetry)) {
      expect(topAfterRetry[name], `changed existing file: ${name}`).toBe(oldSha);
    }
    expect(existsSync(call1In)).toBe(true);
    expect(existsSync(call1Out)).toBe(true);
    const call1InSha = sha256(call1In);
    const call1OutSha = sha256(call1Out);
    expect(JSON.parse(readFileSync(call1Out, "utf8")).stderrTail).toBe("premature-attempt-1");

    // Retry call has its own immutable receipt keyed by calls[].key AND wrote accepted <failedHash>.json
    const retryCall = run2.calls.at(-1)!;
    expect(retryCall.key).not.toBe(failedCall.key);
    const { input: call2In, output: call2Out } = callReceiptPaths(runDir, retryCall.key);
    expect(existsSync(call2In)).toBe(true);
    expect(existsSync(call2Out)).toBe(true);
    expect(JSON.parse(readFileSync(call2In, "utf8")).hash).toBe(failedHash);
    expect(JSON.parse(readFileSync(call2Out, "utf8")).stderrTail).toBe("corrected-attempt-2");
    expect(existsSync(join(runDir, `${failedHash}.json`))).toBe(true);
    const acceptedSha = sha256(join(runDir, `${failedHash}.json`));

    // Subsequent resume hits <failedHash>.json cache with 0 re-executions of the rangeGate frame and mutates no existing bytes
    phase = "cache-hit";
    const run3 = await (await startDrop(f.root, batch.id, { retry: true }, { runAgent: makeAgent() })).done;
    expect(run3.state, run3.error).toBe("archived");
    expect(rangeGateCalls).toBe(2);
    expect(sha256(join(runDir, `${failedHash}.json`))).toBe(acceptedSha);
    expect(sha256(join(runDir, `${failedHash}.output.json`))).toBe(
      topBeforeRetry[`${failedHash}.output.json`],
    );
    expect(sha256(call1In)).toBe(call1InSha);
    expect(sha256(call1Out)).toBe(call1OutSha);

    const finalBatch = readBatch(f.root, batch.id);
    for (const c of finalBatch.calls) {
      const paths = callReceiptPaths(runDir, c.key);
      expect(existsSync(paths.input)).toBe(true);
      expect(existsSync(paths.output)).toBe(true);
    }
    expect(() => callReceiptPaths(runDir, "../escape")).toThrow(/非法调用回执键/);
  });

  it("keeps distinct call-keyed receipts across repeated failures on the same hash without creating accepted cache or overwriting prior receipts", async () => {
    const f = createFixture();
    f.write("wiki/concepts/p.md", makePage("p", "静态权重分页驻留说明。"));
    const batch = await acceptBatch(f.root, {
      key: "repeated-failures",
      items: [{ name: "in.md", text: "静态权重分页驻留说明。" }],
    });

    let attemptNo = 0;
    const failingAgent: RunAgent = async (req) => {
      attemptNo++;
      return {
        id: req.id,
        ok: false,
        exitCode: 1,
        reason: `模拟上游失败-${attemptNo}`,
        stderrTail: `raw-failure-payload-${attemptNo}`,
        costUsd: 0,
      };
    };

    const fail1 = await (await startDrop(f.root, batch.id, {}, { runAgent: failingAgent })).done;
    expect(fail1.state).toBe("failed");
    expect(fail1.calls).toHaveLength(1);

    const runDir = join(f.root, `wiki/_jobs/drops/runs/${batch.id}/${fail1.generation}`);
    const outFiles = readdirSync(runDir).filter((n) => /^[a-f0-9]{64}\.output\.json$/.test(n));
    expect(outFiles).toHaveLength(1);
    const hash = outFiles[0]!.slice(0, 64);
    const legacyInSha = sha256(join(runDir, `${hash}.input.json`));
    const legacyOutSha = sha256(join(runDir, `${hash}.output.json`));
    expect(existsSync(join(runDir, `${hash}.json`))).toBe(false);

    const fail2 = await (await startDrop(f.root, batch.id, { retry: true }, { runAgent: failingAgent })).done;
    expect(fail2.state).toBe("failed");
    expect(fail2.calls).toHaveLength(2);
    expect(fail2.calls[0]).toEqual(fail1.calls[0]);

    // Legacy hash files keep attempt 1 bytes; accepted <hash>.json still absent
    expect(sha256(join(runDir, `${hash}.input.json`))).toBe(legacyInSha);
    expect(sha256(join(runDir, `${hash}.output.json`))).toBe(legacyOutSha);
    expect(existsSync(join(runDir, `${hash}.json`))).toBe(false);

    // Both raw failure outputs are distinctly preserved under their respective calls[].key
    const c1Out = JSON.parse(readFileSync(callReceiptPaths(runDir, fail2.calls[0]!.key).output, "utf8"));
    const c2Out = JSON.parse(readFileSync(callReceiptPaths(runDir, fail2.calls[1]!.key).output, "utf8"));
    expect(c1Out.stderrTail).toBe("raw-failure-payload-1");
    expect(c2Out.stderrTail).toBe("raw-failure-payload-2");
  });

  it("reuses valid <hash>.json cache with 0 agent calls and preserves pre-existing receipt bytes", async () => {
    const f = createFixture();
    const body = "静态张量切分在对称拓扑下无需重排通信。";
    f.write("wiki/concepts/tp-note.md", makePage("tp-note", body));
    const batch = await acceptBatch(f.root, {
      key: "full-cache-zero-calls",
      items: [{ name: "tp.md", text: body }],
    });

    let calls = 0;
    const seedAgent: RunAgent = async (req) => {
      calls++;
      const p = JSON.parse(req.stdin);
      if (p.mode === "drop-extract" || p.mode === "drop-read") {
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: JSON.stringify({
            summary: "张量切分",
            quotes: [p.materials[0].text.trim().slice(0, 12)],
            conditions: [],
            topics: [{ name: "张量切分", query: "张量切分" }],
          }),
        };
      }
      if (p.mode === "drop-discover") {
        if (!p.read?.some((r: { id: string }) => r.id === "tp-note")) {
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: JSON.stringify({ request: { pages: ["tp-note"] } }),
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
            pages: [],
            question: "",
            report: "已覆盖",
            done: true,
            outcome: {
              kind: "covered",
              reason: "一致",
              comparisons: [{ page: "tp-note", quote: body, reason: "一致" }],
            },
          }),
        };
      }
      throw new Error("STOP_BEFORE_CHECK");
    };

    const seeded = await (await startDrop(f.root, batch.id, {}, { runAgent: seedAgent })).done;
    expect(seeded.state).toBe("failed");
    const seededCalls = calls;
    expect(seededCalls).toBeGreaterThanOrEqual(3);

    const runDir = join(f.root, `wiki/_jobs/drops/runs/${batch.id}/${seeded.generation}`);
    const beforeFiles = snapshotTopLevelFiles(runDir);

    let replayCachedStageCalls = 0;
    const resumeAgent: RunAgent = async (req) => {
      const p = JSON.parse(req.stdin);
      if (p.mode !== "drop-check") replayCachedStageCalls++;
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        costUsd: 0,
        output: JSON.stringify({ issues: [], contradictions: [], report: "ok" }),
      };
    };

    const resumed = await (await startDrop(f.root, batch.id, { retry: true }, { runAgent: resumeAgent }))
      .done;
    expect(resumed.state, resumed.error).toBe("archived");
    expect(replayCachedStageCalls).toBe(0);

    const afterFiles = snapshotTopLevelFiles(runDir);
    for (const [name, oldSha] of Object.entries(beforeFiles)) {
      expect(afterFiles[name], `mutated pre-existing file ${name}`).toBe(oldSha);
    }
  });
});
