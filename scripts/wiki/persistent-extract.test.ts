import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type IngestContext, parseSeeds } from "./ingest";
import { runPersistentExtract, seedWorkInput } from "./persistent-extract";
import { wikiFixture } from "./test-fixture";
import { WorkflowStore } from "./workflow";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

describe("seed adapter with persistent jobs", () => {
  it("uses the common executor, isolates a failed item and reuses successful evidence across dates", async () => {
    const f = wikiFixture();
    fixtures.push(f);
    f.write("wiki/HANDBOOK.md", "rules");
    const seeds = parseSeeds(
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: abcdef0}\nfeatures:\n${["a", "b"].map((id) => `  - id: ${id}\n    title: ${id}\n    type: concept\n    chapters: ['11']\n    repo: r\n    entry: [a.py]\n    ask: Explain\n`).join("")}`,
    );
    const ctx: IngestContext = {
      wikiRoot: join(f.root, "wiki"),
      repoRoots: { "r@main": join(f.root, "repo") },
      today: "2026-09-14",
      timeoutMs: 100,
      batchIds: ["a", "b"],
      handbook: {
        pageFormat: "format",
        extract: "extract",
        integrate: "integrate",
        query: "query",
        coverage: "coverage",
        lint: "lint",
        human: "human",
        reading: "reading",
        citable: "citable",
      },
    };
    const store = new WorkflowStore(f.root);
    const policy = { maxAttempts: 3, maxCostUsd: 5, reserveUsd: 1 };
    let calls = 0;
    const deps = {
      store,
      policy,
      concurrency: 2,
      log: () => {},
      runAgent: async (req: import("./batch").AgentRequest) => {
        calls++;
        expect(req.args.slice(-2)).toEqual(["--max-budget-usd", "1"]);
        if (req.id === "b") throw new Error("spawn failed");
        writeFileSync(
          join(req.cwd, "_drafts/a.md"),
          "---\nid: a\ntitle: A\ntype: concept\nsummary: A\nsources: [r@abcdef0:a.py#L1]\nevidence: C\nupdated: '2026-09-14'\n---\nA\n",
        );
        writeFileSync(join(req.cwd, "raw/a.md"), "source");
        return { id: req.id, ok: true, exitCode: 0, costUsd: 0.2, stderrTail: "" };
      },
    };
    const first = await runPersistentExtract(seeds.features, seeds, ctx, deps);
    expect(first.succeeded).toEqual(["a"]);
    expect(first.failed).toEqual(["b"]);
    expect(first.failures.b?.reason).toContain("spawn failed");
    const nextCtx = { ...ctx, today: "2026-09-15", batchIds: ["a"] };
    expect(seedWorkInput(seeds.features[0]!, seeds, nextCtx)).toEqual(
      seedWorkInput(seeds.features[0]!, seeds, ctx),
    );
    await runPersistentExtract([seeds.features[0]!], seeds, nextCtx, deps);
    expect(calls).toBe(2);
    const ids = store.verifyDrafts(["a"]);
    expect(ids).toHaveLength(1);
    expect(() => store.verifyDrafts(["b"])).toThrow(/成功草稿/);
    await store.recordIntegrated(ids);
    const integrated = await runPersistentExtract([seeds.features[0]!], seeds, nextCtx, deps);
    expect(integrated.succeeded).toEqual([]);
    expect(integrated.unchanged).toEqual(["a"]);
    expect(calls).toBe(2);
    expect(JSON.parse(readFileSync(join(f.root, "wiki/_drafts/_failures.json"), "utf8")).b.reason).toContain(
      "spawn failed",
    );
  });
});
