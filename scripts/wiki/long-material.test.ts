import { expect, it } from "vitest";
import { jsonBytes } from "./context-window";
import { readLongMaterial } from "./long-material";
import { wikiFixture } from "./test-fixture";

it("keeps irrelevant source extraction empty while requiring retained context to describe a prior change", async () => {
  const f = wikiFixture();
  try {
    const input = {
      topic: "已有修改",
      sources: [{ source: "memory", text: "An accepted condition." }],
      maxBytes: 4096,
      origin: "seed" as const,
      policy: { accountingOnly: true as const },
    };
    const runAgent: import("./batch").RunAgent = async (req) => ({
      id: req.id,
      ok: true,
      exitCode: 0,
      stderrTail: "",
      output: JSON.stringify({ evidence: [], caveats: [] }),
    });
    expect((await readLongMaterial(f.root, input, { runAgent })).evidence).toEqual([]);
    await expect(
      readLongMaterial(f.root, { ...input, purpose: "prior-changes" }, { runAgent }),
    ).rejects.toThrow(/长材料/);
  } finally {
    f.cleanup();
  }
});

it.each([
  ["inexact", 6500],
  ["oversized", 6500],
  ["oversized", 7500],
] as const)(
  "recovers an %s quotation with budget %i by selecting source lines and reuses the verified receipt",
  async (failure, retryBudget) => {
    const f = wikiFixture();
    try {
      const expectedQuote = "# cache mode. Forcing align changes the path.\n# Keep the prefix.";
      const input = {
        topic: "缓存",
        sources: [
          {
            source: "code.py#L1-L3",
            text: `${expectedQuote}\n${"x".repeat(620)}`,
          },
        ],
        maxBytes: 6500,
        origin: "seed" as const,
        policy: { accountingOnly: true as const },
      };
      let calls = 0;
      let selectedQuote = expectedQuote;
      const runAgent: import("./batch").RunAgent = async (req) => {
        calls++;
        const data = JSON.parse(req.stdin);
        if (calls === 2 && failure === "oversized") {
          expect(data.quotes[0].text.length).toBeLessThanOrEqual(600);
          selectedQuote = data.quotes[0].text;
        } else if (calls === 2)
          expect(data.lines[0]).toEqual({
            line: 1,
            text: "# cache mode. Forcing align changes the path.",
            maxEndLine: 2,
          });
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          output: JSON.stringify({
            evidence:
              calls === 1
                ? [
                    {
                      quote: failure === "inexact" ? "# Forcing align changes the path." : "x".repeat(620),
                      note: "缓存条件",
                    },
                  ]
                : failure === "oversized"
                  ? [{ quoteId: data.quotes[0].id, note: "缓存条件" }]
                  : [{ startLine: 1, endLine: 2, note: "缓存条件" }],
            caveats: [],
          }),
        };
      };
      await expect(readLongMaterial(f.root, input, { runAgent })).rejects.toThrow("1/1 段失败");
      const retryInput = { ...input, maxBytes: retryBudget };
      const result = await readLongMaterial(f.root, retryInput, { runAgent, retry: true });
      expect(calls).toBe(2);
      expect(result.evidence[0]!.quote).toBe(selectedQuote);
      expect(await readLongMaterial(f.root, retryInput, { runAgent, retry: true })).toEqual(result);
      expect(calls).toBe(2);
    } finally {
      f.cleanup();
    }
  },
);

it.each([
  [2, 1],
  [1, 4],
  [1, 3],
  [2, 2],
])("rejects invalid recovery line ranges %s–%s", async (startLine, endLine) => {
  const f = wikiFixture();
  try {
    const input = {
      topic: "边界",
      sources: [{ source: "source", text: `fact\n\n${"x".repeat(700)}` }],
      maxBytes: 6500,
      origin: "seed" as const,
      policy: { accountingOnly: true as const },
    };
    let calls = 0;
    const runAgent: import("./batch").RunAgent = async (req) => ({
      id: req.id,
      ok: true,
      exitCode: 0,
      stderrTail: "",
      output: JSON.stringify({
        evidence:
          ++calls === 1 ? [{ quote: "invented", note: "bad" }] : [{ startLine, endLine, note: "range" }],
        caveats: [],
      }),
    });
    await expect(readLongMaterial(f.root, input, { runAgent })).rejects.toThrow("1/1 段失败");
    await expect(readLongMaterial(f.root, input, { runAgent, retry: true })).rejects.toThrow("1/1 段失败");
    expect(calls).toBe(2);
  } finally {
    f.cleanup();
  }
});

it("reduces large Unicode quotations without assigning an impossible budget to the final group", async () => {
  const f = wikiFixture();
  try {
    const sources = Array.from({ length: 10 }, (_, i) => ({
      source: `source-${i}`,
      text: `${i}${"汉".repeat(599)}`,
    }));
    const result = await readLongMaterial(
      f.root,
      { topic: "边界条件", sources, maxBytes: 6500, origin: "seed", policy: { accountingOnly: true } },
      {
        runAgent: async (req) => {
          const data = JSON.parse(req.stdin);
          let output: unknown;
          if (data.sourceHash)
            output = { evidence: [{ quote: data.text, note: "注".repeat(200) }], caveats: [] };
          else {
            const selected: typeof data.evidence = [];
            for (const evidence of data.evidence)
              if (jsonBytes([...selected, evidence]) <= data.targetBytes) selected.push(evidence);
            expect(
              selected.length,
              "at least one complete quotation must fit the reduction budget",
            ).toBeGreaterThan(0);
            output = { ids: selected.map((e: { id: string }) => e.id) };
          }
          return { id: req.id, ok: true, exitCode: 0, stderrTail: "", output: JSON.stringify(output) };
        },
      },
    );
    expect(result.chunksRead).toBe(10);
    expect(jsonBytes(result)).toBeLessThanOrEqual(6500);
    expect(result.evidence.length).toBeGreaterThan(0);
    for (const evidence of result.evidence)
      expect(sources.find((s) => s.source === evidence.source)?.text).toContain(evidence.quote);
  } finally {
    f.cleanup();
  }
});

it.each(["valid", "unknown", "duplicate"] as const)(
  "recovers repeated invalid line selection with bounded original quotations: %s",
  async (selection) => {
    const f = wikiFixture();
    try {
      const text = `condition: keep all branches\n${"汉😀".repeat(240)}\n${"tail".repeat(170)}`;
      const input = {
        topic: "条件",
        sources: [{ source: "source#L10-L12", text }],
        maxBytes: 6500,
        origin: "seed" as const,
        policy: { accountingOnly: true as const },
      };
      let calls = 0;
      let boundedInputChecked = false;
      const runAgent: import("./batch").RunAgent = async (req) => {
        calls++;
        const data = JSON.parse(req.stdin);
        let evidence: unknown;
        if (calls === 1) evidence = [{ quote: "invented", note: "bad" }];
        else if (calls === 2) evidence = [{ startLine: 1, endLine: 3, note: "too long" }];
        else {
          expect(data.quotes.map((q: { text: string }) => q.text).join("")).toBe(text);
          for (const q of data.quotes) {
            expect(q.text.length).toBeLessThanOrEqual(600);
            expect(q.text).toBe(text.slice(q.start, q.end));
            expect(q.text.isWellFormed()).toBe(true);
          }
          boundedInputChecked = true;
          const quoteId = selection === "unknown" ? "invented" : data.quotes[1].id;
          evidence = [{ quoteId, note: "原文片段" }];
          if (selection === "duplicate") (evidence as unknown[]).push({ quoteId, note: "重复" });
        }
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          output: JSON.stringify({ evidence, caveats: [] }),
        };
      };
      await expect(readLongMaterial(f.root, input, { runAgent })).rejects.toThrow("1/1 段失败");
      await expect(readLongMaterial(f.root, input, { runAgent, retry: true })).rejects.toThrow("1/1 段失败");
      const recovery = readLongMaterial(f.root, { ...input, maxBytes: 7500 }, { runAgent, retry: true });
      if (selection === "valid") {
        const result = await recovery;
        const item = result.evidence[0]!;
        expect(text.slice(item.start, item.end)).toBe(item.quote);
        expect(item.lineStart).toBe(10 + (text.slice(0, item.start).match(/\n/g)?.length ?? 0));
        expect(await readLongMaterial(f.root, input, { runAgent, retry: true })).toEqual(result);
      } else await expect(recovery).rejects.toThrow("1/1 段失败");
      expect(calls).toBe(3);
      expect(boundedInputChecked).toBe(true);
    } finally {
      f.cleanup();
    }
  },
);
