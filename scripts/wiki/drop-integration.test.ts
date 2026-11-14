import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import type { RunAgent } from "./batch";
import { acceptBatch, editBatch, readBatch } from "./drop-batch";
import { validateDropReceipt } from "./drop-receipt";
import { cancelDrop, startDrop } from "./drop-run";
import { parsePage } from "./pages";
import { saveRawSnapshot } from "./raw";
import { approveReview, readReview, rejectReview } from "./review";
import { handbookFixture, wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});
const fixture = () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/HANDBOOK.md", handbookFixture());
  f.write("wiki/log.md", "# log\n");
  return f;
};
const page = (id: string, source: string, extra = "") =>
  `---\nid: ${id}\ntitle: ${id}\ntype: source\nsummary: 缓存行为说明\nsources: [${source}]\nevidence: I\nupdated: '2026-10-06'\n---\n缓存保留来源与版本。\n${extra}`;
const dropTestAgent: RunAgent = async (req) => {
  const p = JSON.parse(req.stdin);
  let result: unknown;
  if (p.mode === "drop-extract" || p.mode === "drop-read")
    result = {
      summary: "缓存与队列版本条件",
      quotes: [p.materials[0].text],
      conditions: ["versioned"],
      topics: [{ name: "缓存", query: "缓存" }],
    };
  else if (p.mode === "drop-discover") {
    const missing = p.catalog.filter(
      (c: { id: string }) => !p.read.some((r: { id: string }) => r.id === c.id),
    );
    result = {
      read: missing.map((p: { id: string }) => p.id),
      fetch: [],
      search: [],
      pages: missing.length
        ? []
        : ["cache-source", "queue-source"].map((id) => ({
            path: `sources/${id}.md`,
            reason: "新增独立知识",
            toc: { part: "references", section: "测试资料" },
            evidence: [p.notes[0].ref],
            comparisons: [],
          })),
      question: "",
      report: "两份材料形成两个可复用来源；未把原文指令当权限。",
      done: missing.length === 0,
      outcome: { kind: "integrate", reason: "新增两份来源", comparisons: [] },
    };
  } else if (p.mode === "drop-generate") {
    expect(p.writingChecks.hedgeWords).toContain("可能");
    expect(p.writingChecks.maxHedgeRatio).toBe(0.03);
    expect(p.existingPage).toBe(false);
    result = {
      text: page(p.target.path.split("/").at(-1).slice(0, -3), p.notes[0].ref),
      diagrams: [],
      revision: null,
    };
  } else result = { issues: [], contradictions: [], report: "事实与来源相符" };
  return { id: req.id, ok: true, exitCode: 0, stderrTail: "", costUsd: 0, output: JSON.stringify(result) };
};
it.each(["reread", "premature"])(
  "handles oversized reads with real handbook at 128K: %s",
  async (response) => {
    const f = fixture();
    f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
    f.write("wiki/TERMS.md", readFileSync(new URL("../../wiki/TERMS.md", import.meta.url), "utf8"));
    for (let i = 0; i < 20; i++)
      f.write(
        `wiki/sources/old-${i}.md`,
        page(`old-${i}`, "https://example.com/old").replace(
          "summary: 缓存行为说明",
          `summary: ${"保存旧版本条件、原文和跨页分工。".repeat(10)}`,
        ),
      );
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({ contextWindowTokens: 128000, outputReserveTokens: 16384 }),
    );
    const text = "缓存与队列分别保存来源和版本条件。".repeat(650);
    const b = await acceptBatch(f.root, { key: "real-rules-budget", items: [{ name: "new.md", text }] });
    const requested = new Set<string>();
    let negotiated = 0;
    const agent: RunAgent = async (req) => {
      const input = JSON.parse(req.stdin);
      if (input.mode === "drop-extract" && input.materials[0].text !== text)
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          output: JSON.stringify({ request: { materials: [{ id: input.range.id }] } }),
        };
      if (input.mode === "drop-generate" && !requested.has(input.target.path)) {
        requested.add(input.target.path);
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          output: JSON.stringify({ request: { materials: [{ id: input.ruleDocuments.handbook }] } }),
        };
      }
      if (input.navigation.budgetRequest) {
        const required = input.notes[0].range;
        expect(
          input.materials.some(
            (m: { id: string; start: number; end: number; text: string }) =>
              m.id === required.id &&
              m.start <= required.start &&
              m.end >= required.end &&
              m.text.includes(text.slice(required.start, required.end)),
          ),
        ).toBe(true);
        expect(input.navigation.budgetRequest.reason).toContain("未提供");
        const suggestion = input.navigation.budgetRequest.requested[0].firstChunks[0];
        const handbook = readFileSync(join(f.root, "wiki/HANDBOOK.md"), "utf8");
        expect(Buffer.byteLength(handbook.slice(suggestion.start, suggestion.end))).toBeLessThanOrEqual(
          input.navigation.budgetRequest.limit - Buffer.byteLength(JSON.stringify(input)),
        );
        negotiated++;
        if (response === "premature") return dropTestAgent(req);
        return {
          id: req.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          output: JSON.stringify({ request: { materials: [input.notes[0].range] } }),
        };
      }
      const result = await dropTestAgent(req);
      if (input.mode === "drop-extract") {
        const value = JSON.parse(result.output!);
        value.quotes.push(text.slice(input.range.start, input.range.end));
        result.output = JSON.stringify(value);
      }
      if (response === "reread" && input.mode === "drop-discover") {
        const value = JSON.parse(result.output!);
        for (const plan of value.pages)
          plan.comparisons = input.catalog.map((p: { id: string }) => ({
            page: p.id,
            quote: "缓存保留来源与版本。",
            reason: "本页已有缓存背景，需要核对版本适用条件，再判断当前来源页分工。".repeat(10),
          }));
        result.output = JSON.stringify(value);
      }
      return result;
    };
    const done = await (await startDrop(f.root, b.id, {}, { runAgent: agent, validate: () => [] })).done;
    if (response === "premature") {
      expect(done.state).toBe("failed");
      expect(done.error).toContain("请求原文尚未提供");
      expect(done.reviewId).toBeUndefined();
      return;
    }
    expect(done.state, done.error).toBe("review");
    expect(negotiated).toBe(2);
    const receipt = readReview(f.root, done.reviewId!).payload.drop!.receipt!;
    expect(receipt.inputs.every((input) => input.bytes <= input.limit)).toBe(true);
    expect(receipt.resources.find((r) => r.kind === "source")?.length).toBe(text.length);
  },
);
it("reads beyond six pages, creates a whole multi-page review and publishes only on approval", async () => {
  const f = fixture();
  for (let i = 0; i < 8; i++)
    f.write(`wiki/sources/old-${i}.md`, page(`old-${i}`, "https://example.com/old"));
  const b = await acceptBatch(f.root, {
    key: "whole",
    items: [{ name: "new.md", text: "缓存与队列分别保存来源和版本条件。" }],
  });
  const generated: { file: string; text: string; metadata: unknown }[] = [];
  const run = await startDrop(
    f.root,
    b.id,
    {},
    {
      runAgent: async (req) => {
        const result = await dropTestAgent(req);
        const input = JSON.parse(req.stdin);
        if (input.mode === "drop-generate") {
          const text = JSON.parse(result.output!).text;
          generated.push({
            file: input.target.path,
            text,
            metadata: parsePage(input.target.path, text).page!.fm,
          });
        }
        return result;
      },
      validate: () => [],
    },
  );
  await expect(editBatch(f.root, b.id, { items: [{ name: "late.md", text: "不应加入" }] })).rejects.toThrow(
    "冻结",
  );
  const done = await run.done;
  expect(done.state, done.error).toBe("review");
  for (const output of generated)
    expect(parsePage(output.file, output.text).page!.fm).toEqual(output.metadata);
  const r = readReview(f.root, done.reviewId!);
  expect(Object.keys(r.payload.base).filter((p) => p.includes("/old-"))).toHaveLength(8);
  expect(r.payload.writes.filter((w) => w.path.startsWith("wiki/sources/"))).toHaveLength(2);
  expect(
    r.payload.writes
      .filter((w) => w.path.startsWith("wiki/sources/"))
      .every((w) => w.after?.includes('evidence: "I"')),
  ).toBe(true);
  await approveReview(f.root, r.id, { validate: () => [] });
  expect(readBatch(f.root, b.id).state).toBe("published");
  expect(readFileSync(join(f.root, "wiki/sources/cache-source.md"), "utf8")).toContain("缓存保留");
});
it("reject feedback produces a new complete review and reuses unchanged extraction", async () => {
  const f = fixture();
  const b = await acceptBatch(f.root, { key: "revise", items: [{ name: "new.md", text: "缓存保留条件。" }] });
  let calls = 0;
  const agent: RunAgent = async (req) => {
    calls++;
    return dropTestAgent(req);
  };
  const done = await (await startDrop(f.root, b.id, {}, { runAgent: agent, validate: () => [] })).done;
  expect(done.state, done.error).toBe("review");
  await rejectReview(f.root, done.reviewId!, "补充适用版本");
  const next = await (await startDrop(f.root, b.id, { retry: true }, { runAgent: agent, validate: () => [] }))
    .done;
  expect(next.state, next.error).toBe("review");
  expect(next.reviewId).not.toBe(done.reviewId);
  expect(readReview(f.root, done.reviewId!).state).toBe("rejected");
  expect(calls).toBeGreaterThan(4);
});
it("does not adopt late model results after cancellation, and pins model across stages", async () => {
  const f = fixture();
  f.write("wiki/sync.config.local.json", JSON.stringify({ chatProvider: "codex", chatModel: "gpt-6.1-sol" }));
  const b = await acceptBatch(f.root, { key: "cancel", items: [{ name: "new.md", text: "缓存保留条件。" }] });
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => {
    release = r;
  });
  let started: () => void = () => {};
  const seen = new Promise<void>((r) => {
    started = r;
  });
  const run = await startDrop(
    f.root,
    b.id,
    {},
    {
      runAgent: async (req) => {
        expect(req.model).toBe("gpt-6.1-sol");
        started();
        await gate;
        return dropTestAgent(req);
      },
      validate: () => [],
    },
  );
  await seen;
  f.write("wiki/sync.config.local.json", JSON.stringify({ chatProvider: "codex", chatModel: "gpt-6-astra" }));
  expect((await cancelDrop(f.root, b.id)).state).toBe("cancelling");
  release();
  expect((await run.done).state).toBe("cancelled");
  expect(readBatch(f.root, b.id).reviewId).toBeUndefined();
});

it("repairs a malformed page without repeating successful discovery or extraction", async () => {
  const f = fixture();
  const b = await acceptBatch(f.root, { key: "repair", items: [{ name: "new.md", text: "缓存保留条件。" }] });
  const calls: string[] = [];
  let malformed = true;
  const done = await (
    await startDrop(
      f.root,
      b.id,
      {},
      {
        validate: () => [],
        runAgent: async (req) => {
          const p = JSON.parse(req.stdin);
          calls.push(p.mode);
          if (p.mode === "drop-generate" && malformed) {
            malformed = false;
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              output: JSON.stringify({ text: "broken", diagrams: [], revision: null }),
            };
          }
          return dropTestAgent(req);
        },
      },
    )
  ).done;
  expect(done.state, done.error).toBe("review");
  expect(calls.filter((c) => c === "drop-discover")).toHaveLength(1);
  expect(calls.filter((c) => c === "drop-extract")).toHaveLength(1);
});

it("keeps earlier protocol repairs when a later page needs repair", async () => {
  const f = fixture();
  const b = await acceptBatch(f.root, {
    key: "two-repairs",
    items: [{ name: "new.md", text: "缓存保留条件。" }],
  });
  let discoverCalls = 0;
  const result = await (
    await startDrop(
      f.root,
      b.id,
      {},
      {
        validate: () => [],
        runAgent: async (req) => {
          const p = JSON.parse(req.stdin);
          if (p.mode === "drop-discover") discoverCalls++;
          if (!p.repair && ["drop-discover", "drop-generate"].includes(p.mode))
            return { id: req.id, ok: true, exitCode: 0, stderrTail: "", output: "{}" };
          return dropTestAgent(req);
        },
      },
    )
  ).done;
  expect(result.state, result.error).toBe("review");
  expect(discoverCalls).toBe(2);
});

it("quotes the actual last source line without counting a terminal newline", async () => {
  const f = fixture();
  const b = await acceptBatch(f.root, {
    key: "lines",
    items: [{ name: "new.md", text: "缓存保留条件。\n" }],
  });
  const run = await startDrop(
    f.root,
    b.id,
    {},
    {
      validate: () => [],
      runAgent: async (req) => {
        const p = JSON.parse(req.stdin);
        if (p.mode === "drop-extract") expect(p.ref).toMatch(/#L1-L1$/);
        return dropTestAgent(req);
      },
    },
  );
  const done = await run.done;
  expect(done.state, done.error).toBe("review");
});

it("resumes successful stages after an explicit test stop and only changes model on a new attempt", async () => {
  const f = fixture();
  const config = (model: string) =>
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({ chatProvider: "codex", chatModel: model, codexCli: `C:/fixture/${model}/codex.exe` }),
    );
  config("gpt-6.1-sol");
  const b = await acceptBatch(f.root, { key: "resume", items: [{ name: "new.md", text: "缓存保留条件。" }] });
  const seen: { model: string | undefined; mode: string; codexCli?: string }[] = [];
  const agent: RunAgent = async (req) => {
    seen.push({ model: req.model, mode: JSON.parse(req.stdin).mode, codexCli: req.codexCli });
    return dropTestAgent(req);
  };
  const stopped = await (
    await startDrop(f.root, b.id, {}, { runAgent: agent, validate: () => [], testLimits: { calls: 1 } })
  ).done;
  expect(stopped.state).toBe("failed");
  expect(stopped.error).toContain("显式测试调用限额");
  config("gpt-6-astra");
  const resumed = await (
    await startDrop(f.root, b.id, { retry: true }, { runAgent: agent, validate: () => [] })
  ).done;
  expect(resumed.state, resumed.error).toBe("review");
  expect(seen.filter((c) => c.mode === "drop-extract")).toHaveLength(1);
  expect(seen.every((c) => c.model === "gpt-6.1-sol")).toBe(true);
  expect(seen.every((c) => c.codexCli === "C:/fixture/gpt-6.1-sol/codex.exe")).toBe(true);
  const count = seen.length;
  const fresh = await (
    await startDrop(f.root, b.id, { newAttempt: true }, { runAgent: agent, validate: () => [] })
  ).done;
  expect(fresh.state, fresh.error).toBe("review");
  expect(readReview(f.root, resumed.reviewId!).state).toBe("rejected");
  expect(seen.slice(count).every((c) => c.model === "gpt-6-astra")).toBe(true);
  expect(fresh.calls.length).toBeGreaterThan(resumed.calls.length);
});

it("feeds cross-page validation failures to every affected generated page", async () => {
  const f = fixture();
  const b = await acceptBatch(f.root, {
    key: "cross-page",
    items: [{ name: "new.md", text: "缓存与队列需一致。" }],
  });
  const done = await (
    await startDrop(
      f.root,
      b.id,
      {},
      {
        validate: (root) =>
          ["cache-source", "queue-source"]
            .filter((id) => readFileSync(join(root, `wiki/sources/${id}.md`), "utf8").includes("需整组修正"))
            .map((id) => `${id} 存在跨页冲突`),
        runAgent: async (req) => {
          const p = JSON.parse(req.stdin);
          const result = await dropTestAgent(req);
          if (p.mode === "drop-generate" && !p.repair) {
            const value = JSON.parse(result.output!);
            value.text += "\n需整组修正\n";
            result.output = JSON.stringify(value);
          }
          return result;
        },
      },
    )
  ).done;
  expect(done.state, done.error).toBe("review");
  const writes = readReview(f.root, done.reviewId!).payload.writes.filter((w) =>
    w.path.startsWith("wiki/sources/"),
  );
  expect(writes).toHaveLength(2);
  expect(writes.every((w) => !w.after?.includes("需整组修正"))).toBe(true);
});

it("accepts precise citations contained within the provided source fragment", async () => {
  const f = fixture();
  const b = await acceptBatch(f.root, {
    key: "precise-citation",
    items: [{ name: "new.md", text: "缓存保存状态。\n队列保留顺序。\n" }],
  });
  const done = await (
    await startDrop(
      f.root,
      b.id,
      {},
      {
        validate: () => [],
        runAgent: async (req) => {
          const result = await dropTestAgent(req);
          result.output = result.output?.replaceAll("#L1-L2", "#L1-L1");
          return result;
        },
      },
    )
  ).done;
  expect(done.state, done.error).toBe("review");
});

it("returns review coverage issues to discovery so the report can actually be corrected", async () => {
  const f = fixture();
  const b = await acceptBatch(f.root, {
    key: "repair-report",
    items: [{ name: "new.md", text: "缓存条件。" }],
  });
  let discoveryRepairs = 0;
  const done = await (
    await startDrop(
      f.root,
      b.id,
      {},
      {
        validate: () => [],
        runAgent: async (req) => {
          const p = JSON.parse(req.stdin);
          const result = await dropTestAgent(req);
          const value = JSON.parse(result.output!);
          if (p.mode === "drop-discover") {
            if (p.repair) discoveryRepairs++;
            value.report = p.repair ? "只核对提供的资料" : "夸大覆盖";
          }
          if (p.mode === "drop-check" && p.report.includes("夸大覆盖"))
            value.issues = [{ page: "report", note: "覆盖说明没有依据，应修正发现报告" }];
          result.output = JSON.stringify(value);
          return result;
        },
      },
    )
  ).done;
  expect(done.state, done.error).toBe("review");
  expect(discoveryRepairs).toBe(1);
  expect(done.report).not.toContain("夸大覆盖");
});

it("preserves old raw provenance and adds only cited sources to each edited page", async () => {
  const f = fixture();
  const oldRaw = saveRawSnapshot(join(f.root, "wiki"), "旧版缓存条件。\n");
  const oldRef = `raw:${oldRaw.slice(4)}#L1-L1`;
  f.write(
    "wiki/sources/old.md",
    page("old", oldRef).replace("evidence: I", `rawSources: [${oldRaw}]\nevidence: I`),
  );
  const b = await acceptBatch(f.root, {
    key: "old-provenance",
    items: [
      { name: "new.md", text: "新版缓存条件。" },
      { name: "unrelated.md", text: "单独无关资料。" },
    ],
  });
  const done = await (
    await startDrop(
      f.root,
      b.id,
      {},
      {
        validate: () => [],
        runAgent: async (req) => {
          const p = JSON.parse(req.stdin);
          if (p.mode === "drop-generate")
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              output: JSON.stringify({
                text: page("old", `${oldRef}, ${p.notes[0].ref}`),
                diagrams: [],
                revision: { id: "old", kind: "editorial", reason: "核对版本依据" },
              }),
            };
          const result = await dropTestAgent(req);
          if (p.mode === "drop-discover") {
            const value = JSON.parse(result.output!);
            if (value.done)
              value.pages = [
                {
                  path: "sources/old.md",
                  reason: "补充来源",
                  toc: { part: "references", section: "资料" },
                  evidence: [p.notes[0].ref],
                  comparisons: [],
                },
              ];
            if (p.notes[0].source.name === "unrelated.md") {
              value.pages = [];
              value.outcome = { kind: "out-of-scope", reason: "独立归档，不改缓存页", comparisons: [] };
            }
            result.output = JSON.stringify(value);
          }
          return result;
        },
      },
    )
  ).done;
  expect(done.state, done.error).toBe("review");
  const text = readReview(f.root, done.reviewId!).payload.writes.find(
    (w) => w.path === "wiki/sources/old.md",
  )!.after!;
  expect(parsePage("sources/old.md", text).page!.fm.rawSources?.sort()).toEqual(
    [oldRaw, b.sources[0]!.raw].sort(),
  );
});

it("rejects missing cross-page checks, stale candidates and a protocol downgrade at the publication gate", async () => {
  const f = fixture();
  const batch = await acceptBatch(f.root, {
    key: "receipt-gate",
    items: [{ name: "new.md", text: "缓存与队列共享版本条件。" }],
  });
  const done = await (await startDrop(f.root, batch.id, {}, { runAgent: dropTestAgent, validate: () => [] }))
    .done;
  expect(done.state, done.error).toBe("review");
  const review = readReview(f.root, done.reviewId!);
  const drop = structuredClone(review.payload.drop!);
  drop.receipt!.checks = drop.receipt!.checks.filter((c) => c.pages.length !== 2);
  drop.receipt!.requiredChecks = drop.receipt!.checks.map((c) => c.id);
  expect(() => validateDropReceipt(f.root, drop, review.payload.writes)).toThrow("跨页");
  const writes = review.payload.writes.map((w) =>
    w.path.endsWith("cache-source.md") ? { ...w, after: `${w.after}\n过期后的改动。\n` } : w,
  );
  expect(() => validateDropReceipt(f.root, review.payload.drop, writes)).toThrow("已经过期");
  expect(() =>
    validateDropReceipt(f.root, { id: batch.id, generation: 0, report: "legacy" }, review.payload.writes),
  ).toThrow("降级");
  const resource = review.payload.drop!.receipt!.resources.find((r) => r.kind === "source")!;
  const incomplete = structuredClone(review.payload.drop!);
  incomplete.receipt!.inputs = incomplete.receipt!.inputs.filter(
    (i) => !i.materials.some((m) => m.id === resource.id),
  );
  expect(() => validateDropReceipt(f.root, incomplete, review.payload.writes)).toThrow("缺口");
  f.write("wiki/sources/concurrent.md", page("concurrent", "https://example.com/new"));
  expect(() => validateDropReceipt(f.root, review.payload.drop, review.payload.writes)).toThrow("目录已改变");
});

it("processes more than 900 KB without losing a single source character or silently switching budgets", async () => {
  const f = fixture();
  const text = "😀只归档的测试原文；尾部仍有否定条件。\n".repeat(16000);
  expect(Buffer.byteLength(text)).toBeGreaterThan(900000);
  const batch = await acceptBatch(f.root, {
    key: "long-archive",
    why: "本批只归档",
    items: [{ name: "long.md", text }],
  });
  let first = true;
  const done = await (
    await startDrop(
      f.root,
      batch.id,
      {},
      {
        validate: () => [],
        runAgent: async (req) => {
          const input = JSON.parse(req.stdin);
          if (first) {
            first = false;
            f.write(
              "wiki/sync.config.local.json",
              JSON.stringify({ contextWindowTokens: 32768, outputReserveTokens: 16384 }),
            );
          }
          expect(Buffer.byteLength(req.stdin)).toBeLessThan(128000);
          const result = await dropTestAgent(req);
          if (input.mode === "drop-discover") {
            const value = JSON.parse(result.output!);
            value.pages = [];
            value.outcome = { kind: "out-of-scope", reason: "按本批要求保留原文归档", comparisons: [] };
            result.output = JSON.stringify(value);
          }
          return result;
        },
      },
    )
  ).done;
  expect(done.state, done.error).toBe("archived");
  expect(done.budget!.contextWindowTokens).toBe(128000);
  const receipt = done.receipt!;
  const source = receipt.resources.find((r) => r.kind === "source")!;
  expect(source.length).toBe(text.length);
  const spans = receipt.decisions
    .map((d) => d.topic.match(/:(\d+)-(\d+)$/)!)
    .map((m) => ({ start: Number(m[1]), end: Number(m[2]) }))
    .sort((a, b) => a.start - b.start);
  expect(spans[0]!.start).toBe(0);
  expect(spans.at(-1)!.end).toBe(text.length);
  for (let i = 1; i < spans.length; i++) expect(spans[i]!.start).toBe(spans[i - 1]!.end);
  expect(receipt.inputs.every((i) => i.bytes <= i.limit)).toBe(true);
  expect(readFileSync(join(f.root, "wiki", batch.sources[0]!.raw), "utf8")).toBe(text);
}, 120000);

it("can fetch original ranges again during generation without duplicating them in the next input", async () => {
  const f = fixture();
  const batch = await acceptBatch(f.root, {
    key: "late-read",
    items: [{ name: "new.md", text: "只有 v2 满足条件；v1 不满足。" }],
  });
  const requested = new Set<string>();
  let verified = 0;
  const done = await (
    await startDrop(
      f.root,
      batch.id,
      {},
      {
        validate: () => [],
        runAgent: async (req) => {
          const input = JSON.parse(req.stdin);
          if (input.mode === "drop-generate") {
            if (!requested.has(input.target.path)) {
              requested.add(input.target.path);
              return {
                id: req.id,
                ok: true,
                exitCode: 0,
                stderrTail: "",
                output: JSON.stringify({
                  request: { materials: [input.notes[0].range, input.notes[0].range] },
                }),
              };
            }
            expect(
              input.materials.filter((m: { id: string }) => m.id === input.notes[0].range.id),
            ).toHaveLength(1);
            expect(input.savedBytes).toBeGreaterThan(0);
            verified++;
          }
          return dropTestAgent(req);
        },
      },
    )
  ).done;
  expect(done.state, done.error).toBe("review");
  expect(verified).toBe(2);
});

it("reuses exact tail evidence after a full read without repeating the unrelated middle table", async () => {
  const f = fixture();
  const tail = "仅 V2 开启压缩时 B=2。\n默认值未知，N=0 时仍保留固定头部。";
  const text = `编码见文末条件。\n\n${Array.from({ length: 1400 }, (_, i) => `| 行 ${i} | 128 |\n`).join("")}\n${tail}`;
  const batch = await acceptBatch(f.root, { key: "quoted-tail", items: [{ name: "long.md", text }] });
  let generations = 0;
  const done = await (
    await startDrop(
      f.root,
      batch.id,
      {},
      {
        validate: () => [],
        runAgent: async (req) => {
          const p = JSON.parse(req.stdin);
          if (p.mode === "drop-extract" && p.materials[0].text !== text)
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              output: JSON.stringify({ request: { materials: [{ id: p.range.id }] } }),
            };
          const result = await dropTestAgent(req);
          if (p.mode === "drop-extract") {
            const value = JSON.parse(result.output!);
            value.quotes = [text.slice(p.range.start, p.range.end), "B=2"];
            result.output = JSON.stringify(value);
          }
          if (p.mode === "drop-generate") {
            const sourceText = p.materials
              .filter((m: { id: string }) => m.id === p.notes[0].range.id)
              .map((m: { text: string }) => m.text)
              .join("");
            expect(sourceText).toContain(tail);
            expect(sourceText).toContain(text.slice(p.notes[0].range.start, p.notes[0].range.end));
            expect(sourceText.length).toBeLessThan(text.length);
            generations++;
          }
          return result;
        },
      },
    )
  ).done;
  expect(done.state, done.error).toBe("review");
  expect(generations).toBeGreaterThan(2);
  const receipt = readReview(f.root, done.reviewId!).payload.drop!.receipt!;
  expect(receipt.requiredReads).toContain(receipt.resources.find((r) => r.kind === "source")!.id);
});

it.each([false, true])("batches comparison reasons and splits to fit a smaller budget: %s", async (small) => {
  const f = fixture();
  f.write(
    "wiki/sources/old.md",
    page("old", "https://example.com/old", small ? "旧版背景说明。\n".repeat(1000) : ""),
  );
  if (small)
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({ contextWindowTokens: 48000, outputReserveTokens: 16384 }),
    );
  const batch = await acceptBatch(f.root, {
    key: "compare-range",
    items: [{ name: "new.md", text: "缓存条件。" }],
  });
  const inputs: { comparisons: { reason: string }[] }[] = [];
  const reasons = ["版本条件", "默认行为", "容量变量", "跨页分工"].map((r) => r.repeat(small ? 180 : 1));
  const done = await (
    await startDrop(
      f.root,
      batch.id,
      {},
      {
        validate: () => [],
        runAgent: async (req) => {
          const p = JSON.parse(req.stdin);
          if (p.task?.id.startsWith("comparison:")) inputs.push(p);
          const result = await dropTestAgent(req);
          if (p.mode === "drop-discover") {
            const value = JSON.parse(result.output!);
            for (const plan of value.pages)
              plan.comparisons = reasons.map((reason) => ({
                page: "old",
                quote: "缓存保留来源与版本。",
                reason,
              }));
            result.output = JSON.stringify(value);
          }
          return result;
        },
      },
    )
  ).done;
  expect(done.state, done.error).toBe("review");
  expect(inputs).toHaveLength(small ? 4 : 2);
  expect(inputs.flatMap((input) => input.comparisons.map((c) => c.reason)).sort()).toEqual(
    [...reasons, ...reasons].sort(),
  );
});

it("accepts exact quotes from actual supplementary materials and returns the full short page on reread", async () => {
  const f = fixture();
  const old = page("old", "https://example.com/old", "旧页的例外也必须保留。");
  f.write("wiki/sources/old.md", old);
  const batch = await acceptBatch(f.root, {
    key: "supplementary-read",
    items: [{ name: "new.md", text: "新增条件仅适用于 v2。" }],
  });
  const asked = new Set<string>();
  let fullReads = 0;
  const done = await (
    await startDrop(
      f.root,
      batch.id,
      {},
      {
        validate: () => [],
        runAgent: async (req) => {
          const p = JSON.parse(req.stdin);
          const key = `${p.mode}:${p.target?.path ?? "old"}`;
          if (p.mode === "drop-read" && !asked.has(key)) {
            asked.add(key);
            const source = p.navigation.inventory.find((r: { kind: string }) => r.kind === "source");
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              output: JSON.stringify({ request: { materials: [{ id: source.id }] } }),
            };
          }
          if (p.mode === "drop-generate" && !asked.has(key)) {
            asked.add(key);
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              output: JSON.stringify({ request: { pages: ["old"] } }),
            };
          }
          if (p.mode === "drop-generate") {
            expect(p.materials.some((m: { text: string }) => m.text === old)).toBe(true);
            fullReads++;
          }
          const result = await dropTestAgent(req);
          if (p.mode === "drop-read") {
            const value = JSON.parse(result.output!);
            value.quotes = p.materials.map((m: { text: string }) => m.text);
            result.output = JSON.stringify(value);
          }
          return result;
        },
      },
    )
  ).done;
  expect(done.state, done.error).toBe("review");
  expect(fullReads).toBe(2);
});

it("splits a long existing page into bound edits and keeps every untouched old paragraph", async () => {
  const f = fixture();
  const oldBody = "固定知识与限定条件逐段保留。\n".repeat(2400);
  const old = page("old", "https://example.com/old", oldBody);
  f.write("wiki/sources/old.md", old);
  const batch = await acceptBatch(f.root, {
    key: "long-existing",
    items: [{ name: "new.md", text: "新增条件仅适用于 v2。" }],
  });
  let edited = 0;
  const done = await (
    await startDrop(
      f.root,
      batch.id,
      {},
      {
        validate: () => [],
        runAgent: async (req) => {
          const p = JSON.parse(req.stdin);
          if (p.mode === "drop-edit") {
            edited++;
            const edits = [];
            if (p.range.start === 0) {
              const start = old.indexOf("https://example.com/old");
              edits.push({
                start,
                end: start + "https://example.com/old".length,
                old: "https://example.com/old",
                text: `https://example.com/old, ${p.notes[0].ref}`,
              });
            }
            if (p.range.end === old.length)
              edits.push({ start: old.length, end: old.length, old: "", text: "\n新增条件仅适用于 v2。\n" });
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              output: JSON.stringify({
                edits,
                diagrams: [],
                revision: { id: "old", kind: "supplement", reason: "保留旧知识并补充 v2 条件" },
              }),
            };
          }
          const result = await dropTestAgent(req);
          if (p.mode === "drop-discover") {
            const value = JSON.parse(result.output!);
            if (value.done)
              value.pages = [
                {
                  path: "sources/old.md",
                  reason: "补充版本条件",
                  toc: { part: "references", section: "资料" },
                  evidence: [p.notes[0].ref],
                  comparisons: [],
                },
              ];
            result.output = JSON.stringify(value);
          }
          return result;
        },
      },
    )
  ).done;
  expect(done.state, done.error).toBe("review");
  expect(edited).toBeGreaterThan(1);
  const text = readReview(f.root, done.reviewId!).payload.writes.find(
    (w) => w.path === "wiki/sources/old.md",
  )!.after!;
  expect(text).toContain(oldBody);
  expect(text).toContain("新增条件仅适用于 v2。");
}, 120000);

it("assembles new pages from stable sections and verifies the complete candidate afterwards", async () => {
  const f = fixture();
  const batch = await acceptBatch(f.root, {
    key: "sectioned-new",
    items: [{ name: "new.md", text: "缓存与队列都需要保留 v2 条件，v1 不适用。" }],
  });
  const seen = new Set<string>();
  const done = await (
    await startDrop(
      f.root,
      batch.id,
      {},
      {
        validate: () => [],
        runAgent: async (req) => {
          const p = JSON.parse(req.stdin);
          if (p.mode === "drop-generate") {
            const name = p.target.path.split("/").at(-1).slice(0, -3);
            const frontmatter = page(name, p.notes[0].ref).split("---")[1];
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              output: JSON.stringify({
                frontmatter: `---${frontmatter}---`,
                sections: [
                  { id: "meaning", title: "机制", instructions: "说明缓存与队列" },
                  { id: "conditions", title: "条件", instructions: "保留 v1/v2 例外" },
                ],
              }),
            };
          }
          if (p.mode === "drop-section") {
            seen.add(`${p.target.path}:${p.section.id}`);
            return {
              id: req.id,
              ok: true,
              exitCode: 0,
              stderrTail: "",
              output: JSON.stringify({
                text: `## ${p.section.title}\n${p.section.id === "conditions" ? "仅 v2 适用，v1 不适用。" : "缓存与队列保存条件。"}`,
                diagrams: [],
              }),
            };
          }
          return dropTestAgent(req);
        },
      },
    )
  ).done;
  expect(done.state, done.error).toBe("review");
  expect(seen.size).toBe(4);
  const review = readReview(f.root, done.reviewId!);
  for (const write of review.payload.writes.filter((w) => w.path.startsWith("wiki/sources/"))) {
    expect(write.after).toContain("## 机制");
    expect(write.after).toContain("仅 v2 适用，v1 不适用。");
  }
  expect(review.payload.drop!.receipt!.checks.filter((c) => c.kind === "page")).toHaveLength(2);
});

it("stops automatic repair at a fixed round limit even when every validation error differs", async () => {
  const f = fixture();
  const b = await acceptBatch(f.root, {
    key: "endless-repair",
    items: [{ name: "new.md", text: "缓存保留条件。" }],
  });
  let generateCalls = 0;
  const done = await (
    await startDrop(
      f.root,
      b.id,
      {},
      {
        validate: () => [],
        // Safety net so the red run terminates; the fix must stop far earlier than this.
        testLimits: { calls: 40 },
        runAgent: async (req) => {
          const p = JSON.parse(req.stdin);
          if (p.mode !== "drop-generate") return dropTestAgent(req);
          generateCalls++;
          // Each round fails schema validation with a different path/count in the detail.
          const diagrams = Array.from({ length: generateCalls }, () => 0);
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            output: JSON.stringify({ text: generateCalls, diagrams, revision: null }),
          };
        },
      },
    )
  ).done;
  expect(done.state).toBe("failed");
  expect(done.error).toContain("自动修订已达上限");
  expect(done.error).toContain("模型输出协议校验失败");
  // One first attempt plus at most MAX_DROP_REPAIR_ROUNDS (3) repairs for the failing stage.
  expect(generateCalls).toBeLessThanOrEqual(4);
  expect(done.reviewId).toBeUndefined();
});
