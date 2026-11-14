import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { detectDrift } from "./drift";
import { reconcileBatches, reconcileCycle } from "./reconcile";
import { wikiFixture } from "./test-fixture";

const page = (id: string, source: string) =>
  `---\nid: ${id}\ntitle: ${id}\ntype: source\nsummary: ${id}\nsources: [${source}]\nevidence: I\nupdated: '2026-01-01'\n---\n## 内容\n${id} 的正文。\n`;

it("continues after a failed batch, records it, and retries only failed model work next pass", async () => {
  const f = wikiFixture();
  try {
    for (let i = 0; i < 8; i++) f.write(`wiki/sources/p${i}.md`, page(`p${i}`, "https://example.test"));
    const total = reconcileBatches(f.root).length;
    let calls = 0;
    const runAgent: import("./batch").RunAgent = async (req) => {
      calls++;
      if (calls === 1) return { id: req.id, ok: false, exitCode: 1, stderrTail: "", reason: "transient" };
      return {
        id: req.id,
        ok: true,
        exitCode: 0,
        stderrTail: "",
        output: '{"relations":[],"contradictions":[],"duplicates":[]}',
      };
    };
    const first = await reconcileCycle(f.root, null, { accountingOnly: true }, { runAgent, retry: true });
    expect(first.processed).toBe(total);
    expect(first.failures).toHaveLength(1);
    expect(calls).toBe(total);
    const second = await reconcileCycle(f.root, null, { accountingOnly: true }, { runAgent, retry: true });
    expect(second.failures).toEqual([]);
    expect(calls).toBe(total + 1);
  } finally {
    f.cleanup();
  }
});

it("one missing source cannot prevent later pages from being checked", async () => {
  const f = wikiFixture();
  try {
    f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
    f.write("repo/code.py", "value = 1\n");
    const pin = f.commit("pin");
    f.write(
      "wiki/seeds/test.yaml",
      `repos:\n  r:\n    url: https://example.test\n    path: repo\n    refs: {main: "${pin}"}\nfeatures: []\n`,
    );
    f.write("wiki/sources/a.md", page("a", `r@${pin}:missing.py#L1`));
    f.write("wiki/sources/b.md", page("b", `r@${pin}:code.py#L1`));
    let calls = 0;
    const result = await detectDrift(
      f.root,
      { sample: null, policy: { accountingOnly: true } },
      {
        runAgent: async (req) => {
          calls++;
          return { id: req.id, ok: true, exitCode: 0, stderrTail: "", output: '{"body":"值为 1。"}' };
        },
      },
    );
    expect(calls).toBe(1);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ page: "a", status: "failed" });
    expect(result[1]).toHaveProperty("page", "b");
    expect(
      JSON.parse(readFileSync(join(f.root, "wiki/_jobs/drift/last-run.json"), "utf8")).results,
    ).toHaveLength(2);
  } finally {
    f.cleanup();
  }
});
