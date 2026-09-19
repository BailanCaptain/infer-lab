import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { z } from "zod";
import { parseStructuredJson, runStructured } from "./structured";
import { wikiFixture } from "./test-fixture";

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
