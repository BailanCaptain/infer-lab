import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentRequest } from "./batch";
import { parsePage } from "./pages";
import { rawSnapshotPath } from "./raw";
import { wikiFixture } from "./test-fixture";
import { WorkflowStore } from "./workflow";
import { runWorkRequest } from "./workflow-run";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});
const page =
  "---\nid: a\ntitle: A\ntype: concept\nsummary: A\nsources: [r@abcdef0:a.py#L1]\nevidence: C\nupdated: '2026-09-14'\n---\n## 一句话\nA\n";
const policy = { maxAttempts: 3, maxCostUsd: 4, reserveUsd: 1 };
const input = {
  origin: "seed" as const,
  sources: [{ ref: "r@abcdef0:a.py", hash: "abcdef0" }],
  targets: ["a"],
  recipeHash: "v1",
};
const setup = () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/HANDBOOK.md", "rules");
  f.write("wiki/concepts/old.md", "official");
  const request: AgentRequest = {
    id: "a",
    cwd: join(f.root, "wiki"),
    args: [],
    stdin: "compile",
    timeoutMs: 100,
    allowedWrites: ["_drafts/a.md", "raw/a.md"],
  };
  return { ...f, request, store: new WorkflowStore(f.root) };
};

describe("persistent extraction attempt", () => {
  it("keeps the gap ledger out of seed input and permits observations while extracting", async () => {
    const f = setup();
    f.write("wiki/_gaps.json", "private question");
    const result = await runWorkRequest(f.store, f.request, input, policy, {
      runAgent: async (req) => {
        expect(existsSync(join(req.cwd, "_gaps.json"))).toBe(false);
        f.write("wiki/_gaps.json", "another question");
        writeFileSync(join(req.cwd, "_drafts/a.md"), page);
        writeFileSync(join(req.cwd, "raw/a.md"), "source");
        return { id: req.id, ok: true, exitCode: 0, costUsd: 0, stderrTail: "" };
      },
    });
    expect(result.ok, result.reason).toBe(true);
    expect(readFileSync(join(f.root, "wiki/_gaps.json"), "utf8")).toBe("another question");
  });
  it("a new evidence revision publishes a distinct raw snapshot without overwriting the old source", async () => {
    const f = setup();
    f.write("wiki/raw/a.md", "legacy source");
    for (const version of ["one", "two"]) {
      const result = await runWorkRequest(f.store, f.request, { ...input, recipeHash: version }, policy, {
        runAgent: async (req) => {
          writeFileSync(join(req.cwd, "_drafts/a.md"), page);
          writeFileSync(join(req.cwd, "raw/a.md"), version);
          return { id: "a", ok: true, exitCode: 0, costUsd: 0, stderrTail: "" };
        },
      });
      expect(result.ok, result.reason).toBe(true);
    }
    const paths = f.store
      .list()
      .flatMap((job) => Object.keys(job.artifacts ?? {}).filter((path) => path.startsWith("raw/")));
    expect(new Set(paths).size).toBe(2);
    expect(paths.map((path) => readFileSync(join(f.root, "wiki", path), "utf8")).sort()).toEqual([
      "one",
      "two",
    ]);
    expect(readFileSync(join(f.root, "wiki/raw/a.md"), "utf8")).toBe("legacy source");
  });
  it("publishes only validated draft/raw, then reuses the same work without another agent call", async () => {
    const f = setup();
    let calls = 0;
    const runAgent = async (req: AgentRequest) => {
      calls++;
      expect(req.cwd).not.toBe(f.request.cwd);
      writeFileSync(join(req.cwd, "_drafts/a.md"), page);
      writeFileSync(join(req.cwd, "raw/a.md"), "source");
      return { id: "a", ok: true, exitCode: 0, stderrTail: "", costUsd: 0.2 };
    };
    const first = await runWorkRequest(f.store, f.request, input, policy, { runAgent });
    expect(first.ok).toBe(true);
    const saved = parsePage("_drafts/a.md", readFileSync(join(f.root, "wiki/_drafts/a.md"), "utf8"));
    expect(saved.problems).toEqual([]);
    expect(saved.page?.body).toBe(parsePage("_drafts/a.md", page).page?.body);
    expect(saved.page?.fm.sources).toEqual(["r@abcdef0:a.py#L1"]);
    expect(saved.page?.fm.rawSources).toEqual([rawSnapshotPath("source")]);
    const second = await runWorkRequest(
      new WorkflowStore(f.root),
      f.request,
      { ...input, origin: "chat" },
      policy,
      { runAgent },
    );
    expect(second.ok).toBe(true);
    expect(calls).toBe(1);
    expect(f.store.list()[0]?.state).toBe("draft");
    expect(readFileSync(join(f.root, "wiki/concepts/old.md"), "utf8")).toBe("official");
  });

  it.each(["agent", "schema", "stray", "snapshot-corrupt", "concurrent-edit"])(
    "%s failure cannot replace originals",
    async (failure) => {
      const f = setup();
      if (failure === "snapshot-corrupt") f.write(`wiki/${rawSnapshotPath("original")}`, "tampered");
      f.write("wiki/raw/a.md", "original");
      f.write("wiki/_drafts/a.md", "previous draft");
      const result = await runWorkRequest(f.store, f.request, input, policy, {
        runAgent: async (req) => {
          writeFileSync(join(req.cwd, "_drafts/a.md"), failure === "schema" ? "bad page" : page);
          writeFileSync(join(req.cwd, "raw/a.md"), "original");
          if (failure === "stray") writeFileSync(join(req.cwd, "HANDBOOK.md"), "changed");
          if (failure === "concurrent-edit") f.write("wiki/_drafts/a.md", "user edit");
          return {
            id: "a",
            ok: failure !== "agent",
            exitCode: failure === "agent" ? 1 : 0,
            stderrTail: "",
            costUsd: 0.2,
          };
        },
      });
      expect(result.ok).toBe(false);
      expect(f.store.list()[0]?.state).toBe("failed");
      expect(readFileSync(join(f.root, "wiki/raw/a.md"), "utf8")).toBe("original");
      expect(readFileSync(join(f.root, "wiki/_drafts/a.md"), "utf8")).toBe(
        failure === "concurrent-edit" ? "user edit" : "previous draft",
      );
      expect(readFileSync(join(f.root, "wiki/HANDBOOK.md"), "utf8")).toBe("rules");
    },
  );

  it.each(["_drafts/a.md", rawSnapshotPath("source")])(
    "a modified %s cannot be reused or integrated",
    async (path) => {
      const f = setup();
      let calls = 0;
      const runAgent = async (req: AgentRequest) => {
        calls++;
        writeFileSync(join(req.cwd, "_drafts/a.md"), page);
        writeFileSync(join(req.cwd, "raw/a.md"), "source");
        return { id: "a", ok: true, exitCode: 0, stderrTail: "", costUsd: 0 };
      };
      await runWorkRequest(f.store, f.request, input, policy, { runAgent });
      expect(f.store.verifyDrafts(["a"])).toHaveLength(1);
      f.write(`wiki/${path}`, "edited");
      expect(() => f.store.verifyDrafts(["a"])).toThrow(/成功草稿记录/);
      await expect(runWorkRequest(f.store, f.request, input, policy, { runAgent })).rejects.toThrow(
        /草稿.*变化/,
      );
      expect(calls).toBe(1);
      expect(existsSync(join(f.root, "tools/wiki-runtime/workflow.lock"))).toBe(false);
    },
  );
});
