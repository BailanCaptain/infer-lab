import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { inputByteLimit } from "./context-window";
import { indexPriorChanges, integrateSections as integrateWithRedundancyCheck } from "./section-integration";
import { wikiFixture } from "./test-fixture";
import { WorkflowStore } from "./workflow";

// These cases exercise the writer's contracts; redundancy decisions have separate end-to-end cases.
const integrateSections: typeof integrateWithRedundancyCheck = (root, input, deps) =>
  integrateWithRedundancyCheck(root, input, {
    ...deps,
    runAgent: async (req, onEvent) => {
      const data = JSON.parse(req.stdin);
      if (data.mode === "supplement-redundancy-check")
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          output: JSON.stringify({
            editId: data.editId,
            redundant: false,
            quotes: [],
            reason: "Retain this addition for review.",
          }),
        };
      return deps.runAgent!(req, onEvent);
    },
  });

it("reserves the complete source frame and edit context before reducing a large draft", async () => {
  const f = wikiFixture();
  try {
    const sources = Array.from(
      { length: 40 },
      (_, i) => `https://example.com/fixed-commit/source-${i}/${"x".repeat(50)}`,
    );
    const header = `---\nid: a\ntitle: A\ntype: concept\nsummary: A\nsources: ${JSON.stringify(sources)}\nevidence: S\nupdated: '2026-09-15'\n---\n`;
    const quotes = Array.from({ length: 8 }, (_, i) => `Fact ${i}: ${"x".repeat(440)}`);
    const body = `${Array.from({ length: 900 }, (_, i) => `Old line ${i}: retain every word.\n`).join("")}\n## 对照源码\n\nOriginal source.[S1]\n`;
    const input = {
      path: "concepts/a.md",
      previous: header + body,
      draft: `${header}${quotes.join("\n")}\n${"Other material.\n".repeat(500)}`,
      rules: "R".repeat(80068),
      policy: { accountingOnly: true as const },
    };
    let reconstructed = "",
      reductions = 0;
    const runAgent: import("./batch").RunAgent = async (req) => {
      const data = JSON.parse(req.stdin);
      // The actual rules are passed in the agent arguments; inspect the durable input below too.
      let value: unknown;
      if (data.mode === "draft-section-integration") {
        reconstructed += data.section.text;
        expect(data.sources.map((s: { source: string }) => s.source)).toEqual(sources);
        expect(data.priorChangeIndex).toEqual([]);
        value = { edits: [] };
      } else if (data.targetBytes) {
        reductions++;
        value = { ids: [data.evidence[0].id] };
      } else {
        value = {
          evidence: quotes
            .filter((q) => data.text.includes(q))
            .map((quote) => ({ quote, note: "n".repeat(150) })),
          caveats: [],
        };
      }
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "", output: JSON.stringify(value) };
    };
    await expect(integrateSections(f.root, input, { runAgent })).resolves.toBeUndefined();
    expect(reconstructed).toBe(body);
    expect(reductions).toBeGreaterThan(0);
    for (const job of new WorkflowStore(f.root).list()) {
      for (const attempt of job.attempts) {
        const saved = JSON.parse(
          readFileSync(join(f.root, `wiki/_jobs/decisions/${job.id}.${attempt.token}.input.json`), "utf8"),
        );
        expect(Buffer.byteLength(saved.stdin)).toBeLessThanOrEqual(inputByteLimit(f.root, saved.rules));
      }
    }
  } finally {
    f.cleanup();
  }
});

it("stops before model work when the complete fixed frame cannot fit", async () => {
  const f = wikiFixture();
  try {
    const header =
      "---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n";
    let calls = 0;
    await expect(
      integrateSections(
        f.root,
        {
          path: "sources/a.md",
          previous: `${header}Old text.`,
          draft: `${header}Evidence.`,
          rules: "R".repeat(92000),
          policy: { accountingOnly: true },
        },
        {
          runAgent: async () => {
            calls++;
            throw new Error("No call expected");
          },
        },
      ),
    ).rejects.toThrow(/完整来源表.*可用预算/);
    expect(calls).toBe(0);
    expect(new WorkflowStore(f.root).list()).toEqual([]);
  } finally {
    f.cleanup();
  }
});

it("carries earlier accepted additions into later sections and reconstructs them on checkpoint retry", async () => {
  const f = wikiFixture();
  try {
    const header =
      "---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n";
    const input = {
      path: "sources/a.md",
      previous: `${header}First old line.\n${"Unchanged content.\n".repeat(2200)}Last old line.\n`,
      draft: `${header}The first condition applies.\nA separate final condition applies.\n`,
      rules: "Retain original text and avoid repeating additions across sections.",
      policy: { accountingOnly: true as const },
    };
    const calls = new Map<number, number>();
    let invalid = true;
    const runAgent: import("./batch").RunAgent = async (req) => {
      const data = JSON.parse(req.stdin);
      calls.set(data.section.start, (calls.get(data.section.start) ?? 0) + 1);
      if (data.section.start > 0) {
        expect(JSON.stringify(data.priorChanges)).toContain("The first condition applies.");
        expect(data.priorChangesRule).toContain("不能作为新事实的证据");
      }
      const first = data.section.text.includes("First old line.");
      const last = data.section.text.includes("Last old line.");
      const before = first ? "First old line." : "Last old line.";
      const fact = first ? "The first condition applies." : "A separate final condition applies.";
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        output: JSON.stringify({
          edits:
            first || last
              ? [
                  {
                    before,
                    after: `${before}\n${fact}`,
                    kind: "supplement",
                    reason: fact,
                    quote: last && invalid ? "A fabricated quotation." : fact,
                  },
                ]
              : [],
        }),
      };
    };
    await expect(integrateSections(f.root, input, { runAgent })).rejects.toThrow(/分段修改/);
    invalid = false;
    const result = await integrateSections(f.root, input, { runAgent, retry: true });
    expect(result!.text.match(/The first condition applies\./g)).toHaveLength(1);
    expect(result!.text).toContain("A separate final condition applies.");
    expect(calls.get(0)).toBe(1);
    expect([...calls.values()].filter((count) => count === 2)).toHaveLength(1);
  } finally {
    f.cleanup();
  }
});

it.each([false, true])(
  "bounds prior-change context and recovers from an empty extraction: %s",
  async (emptyFirst) => {
    const f = wikiFixture();
    try {
      f.write(
        "wiki/sync.config.json",
        JSON.stringify({ contextWindowTokens: 32768, outputReserveTokens: 4096 }),
      );
      const header =
        "---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n";
      const accepted = `Known condition. ${"x".repeat(6500)}`;
      const input = {
        path: "sources/a.md",
        previous: `${header}First old line.\n${"Unchanged content.\n".repeat(700)}`,
        draft: `${header}Known condition.\n`,
        rules: "Bound all requests.",
        policy: { accountingOnly: true as const },
      };
      let calls = 0;
      let contextReads = 0;
      let returnEmpty = emptyFirst;
      const runAgent: import("./batch").RunAgent = async (req) => {
        calls++;
        expect(Buffer.byteLength(req.stdin, "utf8")).toBeLessThan(32768 - 4096 - 8192);
        const data = JSON.parse(req.stdin);
        if (data.mode !== "draft-section-integration") {
          contextReads++;
          expect(data.source).toBe("integration-context:sources/a.md#prior-edits");
          expect(data.text).toContain(accepted);
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            output: JSON.stringify({
              evidence: returnEmpty
                ? []
                : [
                    {
                      quote: "Known condition.",
                      note: "Already included; this is context, not new evidence.",
                    },
                  ],
              caveats: [],
            }),
          };
        }
        if (data.section.start > 0) expect(JSON.stringify(data.priorChanges)).toContain("Known condition.");
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          output: JSON.stringify({
            edits:
              data.section.start === 0
                ? [
                    {
                      before: "First old line.",
                      after: `First old line.\n${accepted}`,
                      kind: "supplement",
                      reason: "Known condition.",
                      quote: "Known condition.",
                    },
                  ]
                : [],
          }),
        };
      };
      if (emptyFirst) {
        await expect(integrateSections(f.root, input, { runAgent })).rejects.toThrow(/长材料/);
        expect(new WorkflowStore(f.root).list().some((job) => job.state === "failed")).toBe(true);
        returnEmpty = false;
      }
      const result = await integrateSections(f.root, input, { runAgent, retry: emptyFirst });
      expect(contextReads).toBeGreaterThan(0);
      expect(result!.text).toContain(accepted);
      const beforeRetry = calls;
      expect(await integrateSections(f.root, input, { runAgent, retry: true })).toEqual(result);
      expect(calls).toBe(beforeRetry);
    } finally {
      f.cleanup();
    }
  },
);

it.each([false, true])(
  "retains every accepted change in a bounded index when extraction omits recent facts: %s",
  async (longReasons) => {
    const f = wikiFixture();
    try {
      f.write(
        "wiki/sync.config.json",
        JSON.stringify({ contextWindowTokens: 32768, outputReserveTokens: 4096 }),
      );
      const header =
        "---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n";
      const count = longReasons ? 8 : 2;
      const changes = Array.from({ length: count }, (_, i) => ({
        before: `Old line ${i}.`,
        after: `Old line ${i}.\nFact ${i}. ${"x".repeat(3500)}`,
        reason: `Fact ${i} belongs here. ${longReasons ? "保留条件和位置。".repeat(100) : ""}`,
        quote: `Fact ${i}.`,
        kind: "supplement",
      }));
      const input = {
        path: "sources/a.md",
        previous: `${header}${changes.map((c) => c.before).join("\n")}\n${"Unchanged content.\n".repeat(700)}`,
        draft: `${header}${changes.map((c) => c.quote).join("\n")}\n`,
        rules: "Bound all requests.",
        policy: { accountingOnly: true as const },
      };
      let sectionCalls = 0;
      const runAgent: import("./batch").RunAgent = async (req) => {
        expect(Buffer.byteLength(req.stdin, "utf8")).toBeLessThan(32768 - 4096 - 8192);
        const data = JSON.parse(req.stdin);
        if (data.mode !== "draft-section-integration")
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            output: JSON.stringify({
              evidence: [
                {
                  quote: data.text.includes("Fact 0.") ? "Fact 0." : data.text.slice(0, 64),
                  note: "Selective extraction omits other facts.",
                },
              ],
              caveats: [],
            }),
          };
        sectionCalls++;
        if (data.section.start > 0) {
          expect(data.priorChangeIndex).toHaveLength(count);
          for (const [i, item] of data.priorChangeIndex.entries()) {
            expect(item.reason).toContain(`Fact ${i} belongs here.`);
            expect(item.start).toBe(input.previous.slice(header.length).indexOf(changes[i]!.before));
            expect(item.end - item.start).toBe(changes[i]!.before.length);
          }
          if (longReasons)
            expect(data.priorChangeIndex.every((item: { truncated: boolean }) => item.truncated)).toBe(true);
        }
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          output: JSON.stringify({ edits: data.section.start === 0 ? changes : [] }),
        };
      };
      const result = await integrateSections(f.root, input, { runAgent });
      expect(sectionCalls).toBeGreaterThan(1);
      for (const change of changes) expect(result!.text).toContain(change.after);
      const beforeRetry = sectionCalls;
      expect(await integrateSections(f.root, input, { runAgent, retry: true })).toEqual(result);
      expect(sectionCalls).toBe(beforeRetry);
    } finally {
      f.cleanup();
    }
  },
);

it("stops when the budget cannot retain meaningful descriptions of accepted changes", () => {
  const changes = Array.from({ length: 34 }, (_, i) => ({
    start: i * 100,
    end: i * 100 + 50,
    reason: `事实${i}：${"重要的条件与范围。".repeat(80)}`,
  }));
  expect(() => indexPriorChanges(changes, 2048)).toThrow(/索引.*预算/);
});

it("reports the binding rule when a quotation stitches nonadjacent draft spans and recovers with feedback", async () => {
  const f = wikiFixture();
  try {
    const header =
      "---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n";
    const line = "原有说明。[S1]";
    const input = {
      path: "sources/a.md",
      previous: `${header}${line}\n`,
      draft: `${header}命中块退出空闲队列。\n\n中间的适用条件不能跳过。\n\n## 容量检查\n`,
      rules: "保持引文连续逐字",
      policy: { accountingOnly: true as const },
    };
    let calls = 0;
    const runAgent: import("./batch").RunAgent = async (req) => {
      calls++;
      if (calls === 2) {
        const feedback = JSON.parse(req.stdin).validationFeedback[0];
        expect(feedback.rule).toBe("section-edit-binding");
        expect(feedback.hint).toContain("contiguous");
        expect(feedback.hint).toContain("edits=[]");
      }
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        output: JSON.stringify({
          edits: [
            {
              before: line,
              after: `${line}\n命中块退出空闲队列。[S1]`,
              kind: "supplement",
              reason: "补充已提供条件",
              quote: calls === 1 ? "命中块退出空闲队列。\n\n## 容量检查" : "命中块退出空闲队列。",
            },
          ],
        }),
      };
    };
    await expect(integrateSections(f.root, input, { runAgent })).rejects.toThrow(/分段修改/);
    const job = new WorkflowStore(f.root).list()[0]!;
    expect(job.state).toBe("failed");
    expect(JSON.parse(job.attempts[0]!.reason!)[0].params?.rule).toBe("section-edit-binding");
    expect((await integrateSections(f.root, input, { runAgent, retry: true }))!.text).toContain(
      `${line}\n命中块退出空闲队列。[S1]`,
    );
    expect(new WorkflowStore(f.root).get(job.id).attempts.map((a) => a.state)).toEqual(["failed", "draft"]);
  } finally {
    f.cleanup();
  }
});

it.each(["C", "S", "M"])("rejects upgrading unverified raw excerpts to %s before caching", async (level) => {
  const f = wikiFixture();
  try {
    const raw = `raw:sha256-${"a".repeat(64)}.md#L1-L2`;
    const header = "---\nid: a\ntitle: A\ntype: source\nsummary: A\nupdated: '2026-09-15'\n";
    const input = {
      path: "sources/a.md",
      previous: `${header}sources: [https://docs.vllm.ai/en/latest/]\nevidence: S\n---\n已有说明。[S1]\n`,
      draft: `${header}sources: [${raw}]\nevidence: I\n---\n新增条件。[I]\n`,
      rules: "保留未经核实的状态",
      policy: { accountingOnly: true as const },
    };
    let invalid = true;
    const runAgent: import("./batch").RunAgent = async (req) => ({
      id: req.id,
      ok: true,
      exitCode: 0,
      stderrTail: "",
      output: JSON.stringify({
        edits: [
          {
            before: "已有说明。[S1]",
            after: `已有说明。[S1]\n新增条件。[${invalid ? `${level}2` : "I"}]`,
            kind: "supplement",
            reason: "补条件",
            quote: "新增条件。",
          },
        ],
      }),
    });
    await expect(integrateSections(f.root, input, { runAgent })).rejects.toThrow(/raw-evidence-level/);
    expect(new WorkflowStore(f.root).list()[0]!.state).toBe("failed");
    invalid = false;
    expect((await integrateSections(f.root, input, { runAgent, retry: true }))!.text).toContain(
      "新增条件。[I]",
    );
  } finally {
    f.cleanup();
  }
});

it("keeps compiled-draft excerpt coordinates separate from original raw source lines", async () => {
  const f = wikiFixture();
  try {
    const raw = `raw:sha256-${"a".repeat(64)}.md#L100-L900`;
    const header = `---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [${raw}]\nevidence: I\nupdated: '2026-09-15'\n---\n`;
    const sources: string[] = [];
    let framed: { draftLocation: string; sources: unknown; citationRule: string } | undefined;
    await integrateSections(
      f.root,
      {
        path: "sources/a.md",
        previous: `${header}旧页。`,
        draft: `${header}${"Compiled draft evidence is not original raw source text.\n".repeat(3000)}`,
        rules: "保留来源坐标",
        policy: { accountingOnly: true },
      },
      {
        runAgent: async (req) => {
          const data = JSON.parse(req.stdin);
          if (data.mode === "draft-section-integration") {
            framed = data;
            return { id: req.id, ok: true, exitCode: 0, stderrTail: "", output: '{"edits":[]}' };
          }
          sources.push(data.source);
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            output: JSON.stringify({
              evidence: [{ quote: data.text.slice(0, 48), note: "compiled draft only" }],
              caveats: [],
            }),
          };
        },
      },
    );
    expect(sources.length).toBeGreaterThan(1);
    expect(new Set(sources)).toEqual(new Set(["_drafts/a.md#body"]));
    expect(framed!.draftLocation).toBe("_drafts/a.md#body");
    expect(framed!.sources).toEqual([{ index: 1, source: raw }]);
    expect(framed!.citationRule).toContain("不是原始 raw 文件行号");
  } finally {
    f.cleanup();
  }
});

it.each(["concept", "feature"])(
  "keeps new %s teaching citations in source notes before history and rejects inline marks before caching",
  async (pageType) => {
    const f = wikiFixture();
    try {
      const header = `---\nid: a\ntitle: A\ntype: ${pageType}\nsummary: A\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n`;
      const old = "已有正文。[S1]";
      const history = "## 已废弃的说法\n\n### 2026-09-14 · 修订 aaaaaaaaaaaaaaaa\n\n历史必须原样保留。";
      const input = {
        path: "concepts/a.md",
        previous: `${header}${old}\n\n## 对照源码\n\n官方来源。[S1]\n\n${history}\n`,
        draft: `${header}新增条件。[I]\n`,
        rules: "遵守教学格式",
        policy: { accountingOnly: true as const },
      };
      let calls = 0;
      const runAgent: import("./batch").RunAgent = async (req) => ({
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        output: JSON.stringify({
          edits: [
            {
              before: old,
              after: `${old}\n\n新增条件。${++calls === 1 ? "[I]" : ""}`,
              sourceNote: "新增条件来自未经独立核实的材料。[I]",
              kind: "supplement",
              reason: "补条件",
              quote: "新增条件。",
            },
          ],
        }),
      });
      await expect(integrateSections(f.root, input, { runAgent })).rejects.toThrow(/prose-marks/);
      expect(new WorkflowStore(f.root).list().map((job) => job.state)).toEqual(["failed"]);
      const result = await integrateSections(f.root, input, { runAgent, retry: true });
      expect(result!.text).toContain(`${old}\n\n新增条件。`);
      expect(result!.text).toContain("新增条件来自未经独立核实的材料。[I]");
      expect(result!.text).not.toContain(history);
      expect(await integrateSections(f.root, input, { runAgent, retry: true })).toEqual(result);
      expect(calls).toBe(2);
    } finally {
      f.cleanup();
    }
  },
);

it("retains the evidence status of raw-only material without requiring a numbered inference", async () => {
  const f = wikiFixture();
  try {
    const raw = `raw:sha256-${"a".repeat(64)}.md#L1-L2`;
    const header = "---\nid: a\ntitle: A\ntype: source\nsummary: A\nupdated: '2026-09-15'\n";
    const line = "已有官方说明。[S1]";
    const result = await integrateSections(
      f.root,
      {
        path: "sources/a.md",
        previous: `${header}sources: [https://docs.vllm.ai/en/latest/]\nevidence: S\n---\n${line}\n`,
        draft: `${header}sources: [${raw}]\nevidence: I\n---\n归档材料推断可能有此限制。[I]\n`,
        rules: "不得抬高证据等级",
        policy: { accountingOnly: true },
      },
      {
        runAgent: async (req) => {
          const data = JSON.parse(req.stdin);
          expect(data.draftEvidence).toBe("I");
          expect(data.draft.sources).toEqual([raw]);
          expect(data.citationRule).toContain("来源列表");
          expect(data.citationRule).toContain("不能为凑编号改标");
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            output: JSON.stringify({
              edits: [
                {
                  before: line,
                  after: `${line}\n归档材料推断可能有此限制。[I]`,
                  kind: "supplement",
                  reason: "保留未核实状态",
                  quote: "归档材料推断可能有此限制。",
                },
              ],
            }),
          };
        },
      },
    );
    expect(result!.text).toContain("归档材料推断可能有此限制。[I]");
    expect(result!.text).toContain(raw);
    expect(result!.text).not.toMatch(/\[I\d+\]/);
  } finally {
    f.cleanup();
  }
});

it("rejects a supplement inserted inside an old line before caching and can retry it", async () => {
  const f = wikiFixture();
  try {
    const header =
      "---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n";
    const line = "原有长句的开头，后半句和证据也必须保留。[S1]";
    const input = {
      path: "sources/a.md",
      previous: `${header}## 旧文\n${line}\n`,
      draft: `${header}## 新材料\n新增条件。[S1]\n`,
      rules: "按来源保留旧文",
      policy: { accountingOnly: true as const },
    };
    let calls = 0;
    const runAgent: import("./batch").RunAgent = async (req) => {
      calls++;
      const before = calls === 1 ? "原有长句的开头，" : line;
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        output: JSON.stringify({
          edits: [
            {
              before,
              after: `${before}\n\n新增条件。[S1]`,
              kind: "supplement",
              reason: "补充条件",
              quote: "新增条件。",
            },
          ],
        }),
      };
    };
    await expect(integrateSections(f.root, input, { runAgent })).rejects.toThrow(/补充修订不能删改旧正文/);
    expect(new WorkflowStore(f.root).list().map((job) => job.state)).toEqual(["failed"]);
    const repaired = await integrateSections(f.root, input, { runAgent, retry: true });
    expect(repaired!.text).toContain(`${line}\n\n新增条件。[S1]`);
    expect(calls).toBe(2);
    expect(
      new WorkflowStore(f.root)
        .list()
        .find((job) => job.input.sources.some((source) => source.ref === "section-integration-v1"))!.attempts,
    ).toHaveLength(2);
  } finally {
    f.cleanup();
  }
});

it("rejects unnumbered source marks before caching a section and reuses earlier successful sections", async () => {
  const f = wikiFixture();
  try {
    const header =
      "---\nid: a\ntitle: A\ntype: source\nsummary: A\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-09-15'\n---\n";
    const previous = `${header}## 旧文\n${"保留教学段落。\n".repeat(2000)}唯一旧句。[S1]\n${"后续段落保留。\n".repeat(2000)}`;
    const input = {
      path: "sources/a.md",
      previous,
      draft: `${header}## 新材料\n新增条件。[S1]\n`,
      rules: "按来源保留旧文",
      policy: { accountingOnly: true as const },
    };
    const calls = new Map<number, number>();
    let incorrect = true;
    const runAgent: import("./batch").RunAgent = async (req) => {
      const data = JSON.parse(req.stdin);
      expect(data.citationRule).toContain("[C1]");
      expect(data.citationRule).toContain("[I]");
      calls.set(data.section.start, (calls.get(data.section.start) ?? 0) + 1);
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        output: JSON.stringify({
          edits: data.section.text.includes("唯一旧句。")
            ? [
                {
                  before: "唯一旧句。[S1]",
                  after: `唯一旧句。[S1]\n新增条件。[S${incorrect ? "" : "1"}]`,
                  kind: "supplement",
                  reason: "补充条件",
                  quote: "新增条件。",
                },
              ]
            : [],
        }),
      };
    };
    await expect(integrateSections(f.root, input, { runAgent })).rejects.toThrow(/mark-unnumbered/);
    incorrect = false;
    const repaired = await integrateSections(f.root, input, { runAgent, retry: true });
    expect(repaired!.text).toContain("唯一旧句。[S1]\n新增条件。[S1]");
    expect(calls.get(0)).toBe(1);
    expect([...calls.values()].filter((n) => n === 2)).toHaveLength(1);
  } finally {
    f.cleanup();
  }
});

it("allows section-1 editorial restructure when atomic facts and qualifiers are conserved, and rejects qualifier loss", async () => {
  const f = wikiFixture();
  try {
    const header =
      "---\nid: a\ntitle: A\ntype: concept\nsummary: A\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: S\nupdated: '2026-11-15'\n---\n";
    const previous = `${header}## 核心机制\n给定材料中的 \`enable_chunked_prefill\` 在 v0.26.0rc 与 Atlas A2 下默认预算为 2048 token。\n\n## 对照源码\n\n原始出处。[S1]\n`;
    const draft = `${header}## 新材料\n在 Atlas A2 上 \`enable_chunked_prefill\` 还可配合 \`max_num_seqs = 64\` 运行。\n`;

    let dropQualifier = true;
    let semanticCheckCalls = 0;
    const runAgent: import("./batch").RunAgent = async (req) => {
      const data = JSON.parse(req.stdin);
      if (data.mode === "fact-disposition-check") {
        semanticCheckCalls++;
        const cand = String(data.candidateActive ?? "");
        const hasQualifiers = cand.includes("Atlas A2") && cand.includes("v0.26.0rc");
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          output: JSON.stringify({
            verdicts: data.pendingFacts.map((f: { index: number }) =>
              hasQualifiers
                ? {
                    index: f.index,
                    preserved: true,
                    outlet: "retained",
                    targetQuote:
                      "在 Atlas A2 与 v0.26.0rc 下，`enable_chunked_prefill` 默认预算为 2048 token",
                    reason: "独立复核确认版本、硬件与数值预算语义等价保留。",
                  }
                : {
                    index: f.index,
                    preserved: false,
                    reason: "候选删去了 v0.26.0rc 与 Atlas A2 适用限定。",
                  },
            ),
          }),
        };
      }
      if (!data.section.text.includes("enable_chunked_prefill")) {
        return { id: req.id, ok: true, exitCode: 0, stderrTail: "", output: JSON.stringify({ edits: [] }) };
      }
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        output: JSON.stringify({
          edits: [
            {
              before:
                "给定材料中的 `enable_chunked_prefill` 在 v0.26.0rc 与 Atlas A2 下默认预算为 2048 token。",
              after: dropQualifier
                ? "`enable_chunked_prefill` 默认预算为 2048 token，并可配合 `max_num_seqs = 64` 运行。"
                : "在 Atlas A2 与 v0.26.0rc 下，`enable_chunked_prefill` 默认预算为 2048 token，并可配合 `max_num_seqs = 64` 运行。",
              kind: "editorial",
              reason: "顺畅重组首段并合并新运行条件，不逐行硬塞补丁",
              quote: "在 Atlas A2 上 `enable_chunked_prefill` 还可配合 `max_num_seqs = 64` 运行。",
              sourceNote: "新增 `max_num_seqs = 64` 运行配合说明 [S1]。",
            },
          ],
        }),
      };
    };

    await expect(
      integrateSections(
        f.root,
        {
          path: "concepts/a.md",
          previous,
          draft,
          rules: "重组段落时守恒全部事实与限定条件",
          policy: { accountingOnly: true },
        },
        { runAgent },
      ),
    ).rejects.toThrow(/editorial|事实去向/);
    expect(semanticCheckCalls).toBe(1);

    dropQualifier = false;
    const ok = await integrateSections(
      f.root,
      {
        path: "concepts/a.md",
        previous,
        draft,
        rules: "重组段落时守恒全部事实与限定条件",
        policy: { accountingOnly: true },
      },
      { runAgent, retry: true },
    );
    expect(semanticCheckCalls).toBe(2);
    expect(ok?.revision.kind).toBe("editorial");
    if (ok?.revision.kind === "editorial") {
      expect(ok.revision.factDispositions).toHaveLength(2);
      expect(ok.revision.factDispositions?.[0]?.verification).toBe("semantic-check");
      expect(ok.revision.factDispositions?.[1]?.verification).toBe("verbatim");
    }
    expect(ok?.text).not.toContain("给定材料中的");
    expect(ok?.text).toContain("max_num_seqs = 64");
  } finally {
    f.cleanup();
  }
});
