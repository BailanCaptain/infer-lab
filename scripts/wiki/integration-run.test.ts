import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AgentRequest } from "./ingest";
import { runStagedIntegration } from "./integration-run";
import { parsePage } from "./pages";
import { readRawSnapshot, saveRawSnapshot, withRawSources } from "./raw";
import { approveReview } from "./review";
import { wikiFixture } from "./test-fixture";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});
const page =
  "---\nid: a\ntitle: A\ntype: concept\nsummary: A\nsources: [r@28bf3a2e:a.py#L1]\nevidence: C\nupdated: '2026-09-14'\n---\n## 一句话\nA\n";

function setup() {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/concepts/a.md", page);
  f.write("wiki/_drafts/a.md", page);
  f.write("wiki/raw/a.md", "original evidence");
  f.write(
    "wiki/_drafts/_integration.json",
    JSON.stringify({
      promoted: ["a"],
      merged: [],
      rejected: [],
      revisions: [{ id: "a", kind: "editorial", reason: "fixture wording change" }],
    }),
  );
  const req: AgentRequest = {
    id: "_integrate",
    cwd: join(f.root, "wiki"),
    args: [],
    stdin: "",
    timeoutMs: 1000,
    allowedWrites: ["concepts/**", "_drafts/_integration.json"],
  };
  return { ...f, req };
}

describe("staged integration publication", () => {
  it.each(["版本谱系", "参数定义（自动生成）"])(
    "refuses an agent rewrite of the existing generated section: %s",
    async (heading) => {
      const f = setup();
      const original = `${page}\n## ${heading}\n脚本生成的版本记录\n\n## 补充\n原文\n`;
      f.write("wiki/concepts/a.md", original);
      await expect(
        runStagedIntegration(f.root, f.req, ["a"], "2026-09-15", {
          runAgent: async (req) => {
            const { writeFileSync } = await import("node:fs");
            writeFileSync(
              join(req.cwd, "concepts/a.md"),
              original.replace("脚本生成的版本记录", "agent 编造的版本记录"),
            );
            writeFileSync(
              join(req.cwd, "_drafts/_integration.json"),
              JSON.stringify({
                promoted: ["a"],
                merged: [],
                rejected: [],
                revisions: [{ id: "a", kind: "editorial", reason: "fixture wording change" }],
              }),
            );
            return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
          },
          validate: () => [],
        }),
      ).rejects.toThrow(/版本谱系|参数定义/);
      expect(readFileSync(join(f.root, "wiki/concepts/a.md"), "utf8")).toBe(original);
    },
  );
  it("does not publish an agent proposal before human approval", async () => {
    const f = setup();
    await runStagedIntegration(f.root, f.req, ["a"], "2026-09-15", {
      runAgent: async (req) => {
        const { writeFileSync } = await import("node:fs");
        writeFileSync(join(req.cwd, "concepts/a.md"), page.replace("## 一句话\nA", "## 一句话\nproposal"));
        writeFileSync(
          join(req.cwd, "_drafts/_integration.json"),
          JSON.stringify({
            promoted: ["a"],
            merged: [],
            rejected: [],
            revisions: [{ id: "a", kind: "editorial", reason: "fixture wording change" }],
          }),
        );
        return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
      },
      validate: () => [],
    });
    expect(readFileSync(join(f.root, "wiki/concepts/a.md"), "utf8")).toBe(page);
    expect(existsSync(join(f.root, "wiki/_drafts/a.md"))).toBe(true);
    expect(existsSync(join(f.root, "wiki/log.md"))).toBe(false);
  });
  it("retains draft snapshots and archives legacy target evidence when merging", async () => {
    const f = setup();
    const wiki = join(f.root, "wiki");
    const snapshot = saveRawSnapshot(wiki, "new evidence");
    f.write("wiki/_drafts/b.md", withRawSources(page.replace("id: a", "id: b"), [snapshot]));
    const proposal = await runStagedIntegration(f.root, f.req, ["b"], "2026-09-15", {
      runAgent: async (req) => {
        const { writeFileSync } = await import("node:fs");
        // The agent omits the engine-owned metadata in its rewritten target.
        writeFileSync(join(req.cwd, "concepts/a.md"), page);
        writeFileSync(
          join(req.cwd, "_drafts/_integration.json"),
          JSON.stringify({ promoted: [], merged: [{ from: "b", into: "a" }], rejected: [] }),
        );
        return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
      },
      validate: () => [],
    });
    await approveReview(f.root, proposal.reviewId, { validate: () => [] });
    const result = parsePage("concepts/a.md", readFileSync(join(wiki, "concepts/a.md"), "utf8"));
    expect(result.problems).toEqual([]);
    expect(result.page?.fm.rawSources).toHaveLength(2);
    expect(result.page?.fm.rawSources).toContain(snapshot);
    expect(result.page?.fm.rawSources?.map((p) => readRawSnapshot(wiki, p)).sort()).toEqual([
      "new evidence",
      "original evidence",
    ]);
    expect(result.page?.fm.sources).toEqual(parsePage("a.md", page).page?.fm.sources);
    expect(readFileSync(join(wiki, "raw/a.md"), "utf8")).toBe("original evidence");
  });
  for (const failure of ["agent", "lint", "stale-decision", "foreign-draft", "raw-write"] as const) {
    it(`${failure}: preserves the official page, source and draft`, async () => {
      const f = setup();
      await expect(
        runStagedIntegration(f.root, f.req, ["a"], "2026-09-14", {
          runAgent: async (req) => {
            const { writeFileSync } = await import("node:fs");
            writeFileSync(join(req.cwd, "concepts/a.md"), page.replace("## 一句话\nA", "## 一句话\nchanged"));
            if (failure === "raw-write") writeFileSync(join(req.cwd, "raw/a.md"), "corrupted");
            if (failure !== "stale-decision")
              writeFileSync(
                join(req.cwd, "_drafts/_integration.json"),
                JSON.stringify({
                  promoted: [failure === "foreign-draft" ? "other" : "a"],
                  merged: [],
                  rejected: [],
                }),
              );
            return {
              id: req.id,
              ok: failure !== "agent",
              exitCode: failure === "agent" ? 1 : 0,
              stderrTail: "",
              reason: "fixture failure",
            };
          },
          validate: () => (failure === "lint" ? ["fixture lint failed"] : []),
        }),
      ).rejects.toThrow();
      expect(readFileSync(join(f.root, "wiki/concepts/a.md"), "utf8")).toBe(page);
      expect(readFileSync(join(f.root, "wiki/raw/a.md"), "utf8")).toBe("original evidence");
      expect(existsSync(join(f.root, "wiki/_drafts/a.md"))).toBe(true);
      expect(existsSync(join(f.root, "wiki/log.md"))).toBe(false);
    });
  }
  it("publishes validated changes and derived files, preserving sources", async () => {
    const f = setup();
    const changed = page.replace("## 一句话\nA", "## 一句话\nchanged");
    const proposal = await runStagedIntegration(f.root, f.req, ["a"], "2026-09-14", {
      runAgent: async (req) => {
        const { writeFileSync } = await import("node:fs");
        expect(req.cwd).not.toBe(f.req.cwd);
        writeFileSync(join(req.cwd, "concepts/a.md"), changed);
        writeFileSync(
          join(req.cwd, "_drafts/_integration.json"),
          JSON.stringify({
            promoted: ["a"],
            merged: [],
            rejected: [],
            revisions: [{ id: "a", kind: "editorial", reason: "fixture wording change" }],
          }),
        );
        return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
      },
      validate: () => [],
    });
    expect(readFileSync(join(f.root, "wiki/concepts/a.md"), "utf8")).toBe(page);
    await approveReview(f.root, proposal.reviewId, { validate: () => [] });
    expect(readFileSync(join(f.root, "wiki/concepts/a.md"), "utf8")).toBe(changed);
    expect(existsSync(join(f.root, "wiki/_drafts/a.md"))).toBe(false);
    expect(readFileSync(join(f.root, "wiki/log.md"), "utf8")).toContain("晋升 concepts/a.md");
    expect(readFileSync(join(f.root, "src/content/wiki/registry.json"), "utf8")).toContain('"id": "a"');
    expect(readFileSync(join(f.root, "wiki/raw/a.md"), "utf8")).toBe("original evidence");
  });
  it("refuses publication when the user changes an official page while the agent runs", async () => {
    const f = setup();
    await expect(
      runStagedIntegration(f.root, f.req, ["a"], "2026-09-14", {
        runAgent: async (req) => {
          const { writeFileSync } = await import("node:fs");
          f.write("wiki/concepts/a.md", "user edit");
          writeFileSync(
            join(req.cwd, "_drafts/_integration.json"),
            JSON.stringify({
              promoted: ["a"],
              merged: [],
              rejected: [],
              revisions: [{ id: "a", kind: "editorial", reason: "fixture wording change" }],
            }),
          );
          return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
        },
        validate: () => [],
      }),
    ).rejects.toThrow(/变化|修改/);
    expect(readFileSync(join(f.root, "wiki/concepts/a.md"), "utf8")).toBe("user edit");
  });
});
