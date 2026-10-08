import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import type { RunAgent } from "./batch";
import { acceptBatch, editBatch, readBatch } from "./drop-batch";
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
  if (p.mode === "drop-extract") result = { summary: p.text, quotes: [p.text], conditions: ["versioned"] };
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
          })),
      question: "",
      report: "两份材料形成两个可复用来源；未把原文指令当权限。",
      done: missing.length === 0,
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
it("reads beyond six pages, creates a whole multi-page review and publishes only on approval", async () => {
  const f = fixture();
  for (let i = 0; i < 8; i++)
    f.write(`wiki/sources/old-${i}.md`, page(`old-${i}`, "https://example.com/old"));
  const b = await acceptBatch(f.root, {
    key: "whole",
    items: [{ name: "new.md", text: "缓存与队列分别保存来源和版本条件。" }],
  });
  const run = await startDrop(f.root, b.id, {}, { runAgent: dropTestAgent, validate: () => [] });
  await expect(editBatch(f.root, b.id, { items: [{ name: "late.md", text: "不应加入" }] })).rejects.toThrow(
    "冻结",
  );
  const done = await run.done;
  expect(done.state, done.error).toBe("review");
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
    f.write("wiki/sync.config.local.json", JSON.stringify({ chatProvider: "codex", chatModel: model }));
  config("gpt-6.1-sol");
  const b = await acceptBatch(f.root, { key: "resume", items: [{ name: "new.md", text: "缓存保留条件。" }] });
  const seen: { model: string | undefined; mode: string }[] = [];
  const agent: RunAgent = async (req) => {
    seen.push({ model: req.model, mode: JSON.parse(req.stdin).mode });
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
  const text = readReview(f.root, done.reviewId!).payload.writes.find(
    (w) => w.path === "wiki/sources/old.md",
  )!.after!;
  expect(parsePage("sources/old.md", text).page!.fm.rawSources?.sort()).toEqual(
    [oldRaw, b.sources[0]!.raw].sort(),
  );
});
