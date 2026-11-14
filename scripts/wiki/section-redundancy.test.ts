import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import type { RunAgent } from "./batch";
import { inputByteLimit } from "./context-window";
import { integrateSections } from "./section-integration";
import { retainNovelSupplements as checkSupplements, type SectionEdit } from "./section-redundancy";
import { wikiFixture } from "./test-fixture";
import { WorkflowStore } from "./workflow";

type RedundancyInput = Parameters<typeof checkSupplements>[1];
const retainNovelSupplements = (
  root: string,
  input: Omit<RedundancyInput, "sourceContext"> & Partial<Pick<RedundancyInput, "sourceContext">>,
  deps: Parameters<typeof checkSupplements>[2],
) =>
  checkSupplements(
    root,
    {
      sourceContext: {
        previousSources: ["https://example.com/"],
        sources: ["https://example.com/"],
        previousEvidence: "S",
        draftEvidence: "S",
      },
      ...input,
    },
    deps,
  );

const supplement = (before: string, extra: string, start = 0): SectionEdit => ({
  start,
  end: start + before.length,
  before,
  after: `${before}\n${extra}`,
  kind: "supplement",
  reason: "Add the supplied condition.",
});
const answer =
  (
    run: (
      data: { editId: string; edit: SectionEdit; oldSection: { start: number; end: number; text: string } },
      rules: string,
    ) => unknown,
  ): RunAgent =>
  async (req) => ({
    id: req.id,
    ok: true,
    exitCode: 0,
    stderrTail: "",
    output: JSON.stringify(run(JSON.parse(req.stdin), req.args[req.args.indexOf("--system-prompt") + 1]!)),
  });

it("checks additions against unchanged facts outside their writing section before staging", async () => {
  const f = wikiFixture();
  try {
    const header =
      "---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [https://example.com/]\nevidence: S\nupdated: '2026-09-15'\n---\n";
    const fact = "Startup profiling uses 64 samples.";
    const previous = `${header}${fact}\n${"Unchanged context.\n".repeat(1800)}Runtime calibration.\n`;
    let checks = 0;
    const result = await integrateSections(
      f.root,
      {
        path: "sources/a.md",
        previous,
        draft: `${header}${fact}`,
        rules: "Preserve old text.",
        policy: { accountingOnly: true },
      },
      {
        runAgent: async (req) => {
          const data = JSON.parse(req.stdin);
          let value: unknown;
          if (data.mode === "supplement-redundancy-check") {
            checks++;
            expect(data.addedLines).toEqual([fact]);
            const start = data.oldSection.text.indexOf(fact) + data.oldSection.start;
            value = {
              redundant: true,
              editId: data.editId,
              quotes: [{ start, end: start + fact.length, text: fact }],
              reason: "The unchanged startup explanation already states this fact and scope.",
            };
          } else {
            value = {
              edits: data.section.text.includes("Runtime calibration.")
                ? [
                    {
                      before: "Runtime calibration.",
                      after: `Runtime calibration.\n${fact}`,
                      kind: "supplement",
                      reason: "Explain profiling samples.",
                      quote: fact,
                    },
                  ]
                : [],
            };
          }
          return { id: req.id, ok: true, exitCode: 0, stderrTail: "", output: JSON.stringify(value) };
        },
      },
    );
    expect(checks).toBeGreaterThan(0);
    expect(result).toBeUndefined();
  } finally {
    f.cleanup();
  }
});

it.each([
  "only-P",
  "synchronous-only",
  "not measured on this device",
  "a different commit",
  "evidence improvements",
])(
  "retains a mixed supplement with the unique qualification %s and never prunes supersedes",
  async (condition) => {
    const f = wikiFixture();
    try {
      const before = "A prefill stage exists.";
      const edit = {
        ...supplement(before, "A prefill stage exists.\nA useful definition."),
        sourceNote: condition,
      };
      const supersede = {
        ...supplement("Old condition.", "New condition.", before.length + 1),
        kind: "supersede" as const,
      };
      let calls = 0;
      const result = await retainNovelSupplements(
        f.root,
        {
          path: "sources/a.md",
          previousBody: `${before}\nOld condition.`,
          edits: [edit, supersede],
          origin: "gap",
          policy: { accountingOnly: true },
        },
        {
          runAgent: answer((data, rules) => {
            calls++;
            expect(data.edit.sourceNote).toBe(condition);
            expect(data.edit.after).toContain("A useful definition.");
            expect(rules).toContain(condition);
            expect(rules).toContain("Mixed old/new supplements must be retained in full");
            return {
              editId: data.editId,
              redundant: false,
              quotes: [],
              reason: "A unique qualification remains.",
            };
          }),
        },
      );
      expect(result).toEqual([edit, supersede]);
      expect(calls).toBe(1);
    } finally {
      f.cleanup();
    }
  },
);

it.each(["history", "superseded", "coordinates", "id", "missing-proof"])(
  "rejects invalid redundancy evidence: %s",
  async (bad) => {
    const f = wikiFixture();
    try {
      const body = "Surviving sentence.\nObsolete sentence.\n## 已废弃的说法\nHistory sentence.";
      const edit = supplement("Surviving sentence.", "A new condition.");
      const start = body.indexOf("Obsolete sentence.");
      const supersede = {
        ...supplement("Obsolete sentence.", "Replacement.", start),
        kind: "supersede" as const,
      };
      await expect(
        retainNovelSupplements(
          f.root,
          {
            path: "sources/a.md",
            previousBody: body,
            edits: [edit, supersede],
            origin: "gap",
            policy: { accountingOnly: true },
          },
          {
            runAgent: answer((data) => {
              const quote =
                bad === "history"
                  ? "History sentence."
                  : bad === "superseded"
                    ? "Obsolete sentence."
                    : "Surviving sentence.";
              const position = body.indexOf(quote) + (bad === "coordinates" ? 1 : 0);
              return {
                editId: bad === "id" ? "unknown" : data.editId,
                redundant: true,
                quotes:
                  bad === "missing-proof"
                    ? []
                    : [{ start: position, end: position + quote.length, text: quote }],
                reason: "Claimed duplicate.",
              };
            }),
          },
        ),
      ).rejects.toThrow();
      expect(new WorkflowStore(f.root).list().every((job) => job.state === "failed")).toBe(true);
    } finally {
      f.cleanup();
    }
  },
);

it("retains partial matches across long sections and reuses valid checkpoints after a later failure", async () => {
  const f = wikiFixture();
  try {
    const body = `Anchor.\n${'escaped \\\t"中文😀"\n'.repeat(9000)}`;
    const edit = supplement("Anchor.", "Two independently required conditions.");
    const calls = new Map<number, number>();
    let fail = true;
    const input = {
      path: "sources/a.md",
      previousBody: body,
      edits: [edit],
      origin: "gap" as const,
      policy: { accountingOnly: true as const },
    };
    const runAgent = answer((data) => {
      const start = data.oldSection.start;
      calls.set(start, (calls.get(start) ?? 0) + 1);
      if (start > 0 && fail) throw new Error("later section interrupted");
      return {
        editId: data.editId,
        redundant: false,
        quotes: [],
        reason: "This section covers only part of the addition.",
      };
    });
    await expect(retainNovelSupplements(f.root, input, { runAgent })).rejects.toThrow("interrupted");
    fail = false;
    expect(await retainNovelSupplements(f.root, input, { runAgent, retry: true })).toEqual([edit]);
    expect(calls.get(0)).toBe(1);
    expect(calls.size).toBeGreaterThan(1);
    const jobs = new WorkflowStore(f.root).list();
    const covered = jobs
      .filter((j) => j.state === "draft")
      .map((job) => {
        const saved = JSON.parse(
          readFileSync(
            join(f.root, `wiki/_jobs/decisions/${job.id}.${job.attempts.at(-1)!.token}.input.json`),
            "utf8",
          ),
        );
        expect(Buffer.byteLength(saved.stdin)).toBeLessThanOrEqual(inputByteLimit(f.root, saved.rules));
        return JSON.parse(saved.stdin).oldSection;
      })
      .sort((a, b) => a.start - b.start);
    expect(covered.map((s) => s.text).join("")).toBe(body.trimEnd());
    const beforeCalls = [...calls.values()].reduce((a, b) => a + b, 0);
    await retainNovelSupplements(
      f.root,
      { ...input, previousBody: body.replace("escaped", "changed") },
      { runAgent, retry: true },
    );
    expect([...calls.values()].reduce((a, b) => a + b, 0)).toBeGreaterThan(beforeCalls);
  } finally {
    f.cleanup();
  }
});

it("stops without model work when a complete candidate cannot fit and rejects baseline drift", async () => {
  const f = wikiFixture();
  try {
    let calls = 0;
    const runAgent: RunAgent = async () => {
      calls++;
      throw new Error("unexpected call");
    };
    const input = {
      path: "sources/a.md",
      previousBody: "Anchor.",
      edits: [supplement("Anchor.", "x".repeat(120000))],
      origin: "gap" as const,
      policy: { accountingOnly: true as const },
    };
    await expect(retainNovelSupplements(f.root, input, { runAgent })).rejects.toThrow("不能截断候选");
    await expect(
      retainNovelSupplements(f.root, { ...input, previousBody: "Changed." }, { runAgent }),
    ).rejects.toThrow("坐标不匹配");
    expect(calls).toBe(0);
    expect(new WorkflowStore(f.root).list()).toEqual([]);
  } finally {
    f.cleanup();
  }
});

it("binds source identities and evidence status into the read-only decision and its cache", async () => {
  const f = wikiFixture();
  try {
    const input = {
      path: "sources/a.md",
      previousBody: "Anchor.",
      edits: [supplement("Anchor.", "A fact.")],
      origin: "gap" as const,
      policy: { accountingOnly: true as const },
      sourceContext: {
        previousSources: ["commit:A"],
        sources: ["commit:A", "raw:new"],
        previousEvidence: "S",
        draftEvidence: "I",
      },
    };
    let calls = 0;
    const runAgent = answer((data) => {
      calls++;
      expect("sourceContext" in data).toBe(true);
      return { editId: data.editId, redundant: false, quotes: [], reason: "New provenance retained." };
    });
    await retainNovelSupplements(f.root, input, { runAgent });
    await retainNovelSupplements(
      f.root,
      { ...input, sourceContext: { ...input.sourceContext, previousSources: ["commit:B"] } },
      { runAgent },
    );
    expect(calls).toBe(2);
    await retainNovelSupplements(
      f.root,
      {
        ...input,
        sourceContext: { ...input.sourceContext, draftRawSources: ["raw/changed-archive.md"] },
      },
      { runAgent },
    );
    expect(calls).toBe(3);
  } finally {
    f.cleanup();
  }
});
