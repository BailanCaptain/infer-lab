import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { z } from "zod";
import { parseStructuredJson, runStructured } from "./structured";
import { wikiFixture } from "./test-fixture";
import { WorkflowStore } from "./workflow";

const input = {
  kind: "test-decision-v1",
  origin: "seed" as const,
  data: { source: "abc" },
  rules: "Only JSON",
  schema: z.object({ quote: z.literal("abc") }).strict(),
  policy: { maxAttempts: 2, maxCostUsd: 1, reserveUsd: 0.5 },
};
it("accepts one JSON code fence without accepting surrounding prose or invalid JSON", () => {
  expect(parseStructuredJson('```json\n{"quote":"abc"}\n```')).toEqual({ quote: "abc" });
  for (const text of [
    "before\n```json\n{}\n```",
    "```json\n{}\n```\nafter",
    "```json\n{}\n```\n```json\n{}\n```",
    "```json\n{bad}\n```",
  ])
    expect(() => parseStructuredJson(text)).toThrow();
});
it("caches a validated decision and rejects tampered receipts", async () => {
  const f = wikiFixture();
  try {
    let calls = 0;
    const runAgent: import("./batch").RunAgent = async (req) => {
      calls++;
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "", costUsd: 0.1, output: '{"quote":"abc"}' };
    };
    const result = await runStructured(f.root, input, { runAgent });
    expect((await runStructured(f.root, input, { runAgent })).value).toEqual({ quote: "abc" });
    expect(calls).toBe(1);
    f.write(`wiki/_jobs/decisions/${result.jobId}.json`, '{"quote":"bad"}');
    await expect(runStructured(f.root, input, { runAgent })).rejects.toThrow(/回执已变化/);
  } finally {
    f.cleanup();
  }
});

it("retries invalid output with validator feedback and keeps the same evidence identity", async () => {
  const f = wikiFixture();
  try {
    let calls = 0;
    const runAgent: import("./batch").RunAgent = async (req) => {
      calls++;
      const data = JSON.parse(req.stdin);
      expect(data.source).toBe("abc");
      if (calls > 1) expect(data.validationFeedback[0].path).toEqual(["quote"]);
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        costUsd: 0,
        output: calls === 1 ? '{"quote":"wrong"}' : '{"quote":"abc"}',
      };
    };
    await expect(runStructured(f.root, input, { runAgent })).rejects.toThrow();
    expect((await runStructured(f.root, input, { runAgent, retry: true })).value).toEqual({ quote: "abc" });
    expect(calls).toBe(2);
  } finally {
    f.cleanup();
  }
});
it("retries malformed JSON with format guidance while retaining the failed attempt and evidence", async () => {
  const f = wikiFixture();
  try {
    let calls = 0;
    const runAgent: import("./batch").RunAgent = async (req) => {
      calls++;
      const data = JSON.parse(req.stdin);
      expect(data.source).toBe("abc");
      if (calls === 2) {
        expect(data.validationFeedback[0]).toMatchObject({ code: "invalid_json" });
        expect(data.validationFeedback[0].hint).toContain("backslashes");
      }
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        costUsd: 0,
        output: calls === 1 ? String.raw`{"quote":"\(abc\)"}` : '{"quote":"abc"}',
      };
    };
    await expect(runStructured(f.root, input, { runAgent })).rejects.toThrow(SyntaxError);
    const recovered = await runStructured(f.root, input, { runAgent, retry: true });
    expect(recovered.value).toEqual({ quote: "abc" });
    expect(new WorkflowStore(f.root).get(recovered.jobId).attempts.map((a) => a.state)).toEqual([
      "failed",
      "draft",
    ]);
    await runStructured(f.root, input, { runAgent, retry: true });
    expect(calls).toBe(2);
  } finally {
    f.cleanup();
  }
});
it("adds fixed binding guidance to a historical section error without changing its failed receipt", async () => {
  const f = wikiFixture();
  try {
    let invalid = true;
    const legacy = {
      ...input,
      kind: "section-integration-v1",
      schema: input.schema.superRefine((_value, ctx) => {
        if (invalid)
          ctx.addIssue({
            code: "custom",
            path: ["edits", 0],
            message: "分段修改未唯一匹配旧文或未绑定草稿原文",
          });
      }),
    };
    const runAgent: import("./batch").RunAgent = async (req) => {
      if (!invalid)
        expect(JSON.parse(req.stdin).validationFeedback[0]).toMatchObject({
          rule: "section-edit-binding",
          hint: expect.stringContaining("contiguous"),
        });
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "", costUsd: 0, output: '{"quote":"abc"}' };
    };
    await expect(runStructured(f.root, legacy, { runAgent })).rejects.toThrow(/分段修改/);
    const failed = new WorkflowStore(f.root).list()[0]!;
    invalid = false;
    await runStructured(f.root, legacy, { runAgent, retry: true });
    expect(new WorkflowStore(f.root).get(failed.id).attempts[0]).toEqual(failed.attempts[0]);
  } finally {
    f.cleanup();
  }
});
it("revalidates an old cached decision and retries only that decision without resetting its history", async () => {
  const f = wikiFixture();
  try {
    let calls = 0;
    const runAgent: import("./batch").RunAgent = async (req) => {
      calls++;
      if (calls === 2) expect(JSON.parse(req.stdin).validationFeedback[0].path).toEqual(["quote"]);
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        costUsd: 0.1,
        output: JSON.stringify({ quote: calls === 1 ? "wrong" : "abc" }),
      };
    };
    const cached = await runStructured(
      f.root,
      { ...input, schema: z.object({ quote: z.string() }) },
      { runAgent },
    );
    await expect(runStructured(f.root, input, { runAgent })).rejects.toThrow();
    expect(calls).toBe(1);
    const repaired = await runStructured(f.root, input, { runAgent, retry: true });
    expect(repaired.jobId).toBe(cached.jobId);
    expect(repaired.value.quote).toBe("abc");
    const job = new WorkflowStore(f.root).get(cached.jobId);
    expect(job.attempts.map((a) => a.costUsd)).toEqual([0.1, 0.1]);
    expect(job.attempts[0]).toMatchObject({ state: "failed", revalidatedAt: expect.any(String) });
    await runStructured(f.root, input, { runAgent, retry: true });
    expect(calls).toBe(2);
  } finally {
    f.cleanup();
  }
});
it.each(["write", "invalid", "unknown"])("rejects %s output and requires explicit retry", async (mode) => {
  const f = wikiFixture();
  try {
    const runAgent: import("./batch").RunAgent = async (req) => {
      if (mode === "write") writeFileSync(join(req.cwd, "bad.txt"), "bad");
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        costUsd: mode === "unknown" ? undefined : 0.1,
        output: mode === "invalid" ? '{"quote":"false"}' : '{"quote":"abc"}',
      };
    };
    await expect(runStructured(f.root, input, { runAgent })).rejects.toThrow();
    await expect(runStructured(f.root, input, { runAgent })).rejects.toThrow(/显式重试/);
  } finally {
    f.cleanup();
  }
});

it("调用方给的超时原样用上；不给时按一小段 JSON 的判定算 60 秒", async () => {
  const f = wikiFixture();
  try {
    const seen: number[] = [];
    const runAgent: import("./batch").RunAgent = async (req) => {
      seen.push(req.timeoutMs);
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "", costUsd: 0.1, output: '{"quote":"abc"}' };
    };
    await runStructured(f.root, input, { runAgent });
    await runStructured(f.root, { ...input, kind: "test-long-v1", timeoutMs: 300_000 }, { runAgent });
    expect(seen).toEqual([60_000, 300_000]);
  } finally {
    f.cleanup();
  }
});
