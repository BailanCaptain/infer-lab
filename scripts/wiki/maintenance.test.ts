import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { recordGapObservation } from "./gap-ledger";
import { contentDrift, patrolFindings, recordDrift } from "./maintenance";
import { loadPages } from "./pages";
import { listTasks, runTask } from "./queue";
import { reconcileBatch, reconcileBatches } from "./reconcile";
import { approveReview, reviewDiff } from "./review";
import { wikiFixture } from "./test-fixture";

const page = (id: string, body: string, source = "https://github.com/vllm-project/vllm-ascend/issues/1") =>
  `---\nid: ${id}\ntitle: ${id}\ntype: source\nsummary: 说明\nsources: [${source}]\nevidence: I\nupdated: '2026-01-01'\n---\n## 一句话\n\n${body}\n`;
it("queues exactly one task at threshold and never retries paid work implicitly", async () => {
  const f = wikiFixture();
  try {
    for (let i = 0; i < 4; i++)
      await recordGapObservation(f.root, {
        eventId: randomUUID(),
        question: "missing term",
        contextQuestions: [],
        revision: "a".repeat(64),
        candidates: [],
        signals: [{ kind: "agent-uncovered", reason: "uncovered" }],
      });
    const tasks = listTasks(f.root);
    expect(tasks).toHaveLength(1);
    const task = await runTask(f.root, tasks[0]!.id, async () => ({
      state: "needs-material",
      result: { classification: "missing-knowledge" },
    }));
    expect(task.attempts).toBe(1);
    await expect(
      runTask(f.root, task.id, async () => {
        throw new Error("must not run");
      }),
    ).rejects.toThrow(/显式重试/);
  } finally {
    f.cleanup();
  }
});
it("checks source and documentation changes against tracked tips, never age alone", () => {
  const f = wikiFixture();
  try {
    f.write("repo/vllm_ascend/a.py", "old");
    f.write("repo/docs/source/guide.md", "old");
    const old = f.commit("old");
    f.write("repo/vllm_ascend/a.py", "new");
    f.write("repo/docs/source/guide.md", "new");
    const tip = f.commit("new");
    f.git(["update-ref", "refs/remotes/origin/main", tip]);
    f.write("wiki/sources/a.md", page("a", "[broken](missing.md)", `r@${old}:vllm_ascend/a.py#L1`));
    f.write("wiki/sources/b.md", page("b", "document", `r@${old}:docs/source/guide.md#L1`));
    const seeds = {
      repos: { r: { url: "https://example.test", path: "repo", refs: { main: old } } },
      features: [],
    };
    const pages = loadPages(join(f.root, "wiki")).pages;
    const findings = patrolFindings(pages, seeds, f.root, "2026-09-15", 30);
    expect(findings.filter((p) => p.rule === "source-changed")).toHaveLength(2);
    expect(findings.some((p) => p.message.includes(tip) && p.message.includes(old))).toBe(true);
    expect(findings.some((p) => p.message.includes("missing.md"))).toBe(true);
    f.git(["update-ref", "refs/remotes/origin/main", old]);
    expect(
      patrolFindings(pages, seeds, f.root, "2026-09-15", 30).some((p) => p.rule === "source-changed"),
    ).toBe(false);
  } finally {
    f.cleanup();
  }
});
it("records content drift and idempotent rewrite work without calling it a fact change", async () => {
  const f = wikiFixture();
  try {
    expect(contentDrift("Ａ alpha BETA", "a ALPHA beta")).toBe(0);
    f.write("wiki/sources/a.md", "alpha beta gamma delta epsilon zeta");
    const result = await recordDrift(f.root, "a", "sources/a.md", "alpha beta", "raw:fixture#L1");
    expect(result.score).toBeGreaterThan(0.3);
    expect(result.task).toBeTruthy();
    await recordDrift(f.root, "a", "sources/a.md", "alpha beta", "raw:fixture#L1");
    expect(listTasks(f.root)).toHaveLength(1);
  } finally {
    f.cleanup();
  }
});
it("proposes a quote-bound relation, publishes its inverse through build, and avoids duplicate edges", async () => {
  const f = wikiFixture();
  try {
    f.write("wiki/sources/a.md", page("a", "A uses B for storage."));
    f.write("wiki/sources/b.md", page("b", "B provides storage."));
    const ids = reconcileBatches(f.root)
      .flat()
      .map((p) => p.fm.id);
    expect(new Set(ids)).toEqual(new Set(["a", "b"]));
    const runAgent: import("./batch").RunAgent = async (req) => ({
      id: req.id,
      ok: true,
      exitCode: 0,
      stderrTail: "",
      costUsd: 0,
      output: JSON.stringify({
        relations: [
          {
            from: "a",
            relation: { to: "b", kind: "builds-on", note: "A 使用 B 的存储能力" },
            evidence: [
              { page: "a", text: "A uses B for storage." },
              { page: "b", text: "B provides storage." },
            ],
          },
        ],
        contradictions: [],
        duplicates: [],
      }),
    });
    const policy = { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 1 };
    const result = await reconcileBatch(f.root, ["a", "b"], policy, { runAgent });
    expect(result.reviewId).toBeTruthy();
    expect(reviewDiff(f.root, result.reviewId!)).toContain("builds-on");
    await approveReview(f.root, result.reviewId!);
    const registry = JSON.parse(readFileSync(join(f.root, "src/content/wiki/registry.json"), "utf8"));
    expect(registry.pages.find((p: { id: string }) => p.id === "b").backlinks).toEqual([
      { from: "a", kind: "enables", note: "A 使用 B 的存储能力" },
    ]);
    expect((await reconcileBatch(f.root, ["a", "b"], policy, { runAgent })).reviewId).toBeUndefined();
  } finally {
    f.cleanup();
  }
});
