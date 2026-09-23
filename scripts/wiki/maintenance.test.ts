import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { detectDrift } from "./drift";
import { recordGapObservation } from "./gap-ledger";
import { contentDrift, patrolFindings, recordDrift } from "./maintenance";
import { loadPages } from "./pages";
import { listTasks, runTask } from "./queue";
import { reconcileBatch, reconcileBatches, reconcileInput } from "./reconcile";
import { approveReview, reviewDiff } from "./review";
import { STRUCTURED_INPUT_LIMIT } from "./structured";
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

it("定期重核按全部钉点配置找来源仓库：页面引用的仓库登记在另一份 seeds 里也能读到", async () => {
  // 2026-09-23 实遇：夜间任务只传了 vllm-ascend.yaml，页面还引用 vllm 与 rfork，第 3 页就报「未配置来源仓库」
  const f = wikiFixture();
  try {
    f.write("wiki/HANDBOOK.md", readFileSync(new URL("../../wiki/HANDBOOK.md", import.meta.url), "utf8"));
    f.write("repo/code.py", "value = 1\n");
    const pin = f.commit("pin");
    f.write(
      "wiki/seeds/first.yaml",
      `repos:\n  other:\n    url: https://example.test/other\n    path: elsewhere\n    refs: {main: "${pin}"}\nfeatures: []\n`,
    );
    f.write(
      "wiki/seeds/second.yaml",
      `repos:\n  r:\n    url: https://example.test/r\n    path: repo\n    refs: {main: "${pin}"}\nfeatures: []\n`,
    );
    f.write("wiki/sources/a.md", page("a", "值为 1。", `r@${pin.slice(0, 8)}:code.py#L1`));
    const seen: string[] = [];
    const results = await detectDrift(
      f.root,
      { sample: 1, policy: { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 1 } },
      {
        runAgent: async (req) => {
          seen.push(req.stdin);
          return {
            id: req.id,
            ok: true,
            exitCode: 0,
            stderrTail: "",
            costUsd: 0,
            output: '{"body":"值为 1。"}',
          };
        },
      },
    );
    expect(seen[0]).toContain("value = 1");
    expect(results).toHaveLength(1);
  } finally {
    f.cleanup();
  }
});

it("交叉审视按真实输入大小分批：每批都不超过结构化判定的上限，所有页都覆盖到", () => {
  // 2026-09-23 审视：固定 6 页一批，全库 68 批里没有一批装得进 40,000 字符的上限，打开就必然失败
  const f = wikiFixture();
  try {
    const body = "缓存块的分配与回收说明。".repeat(700);
    for (let i = 0; i < 8; i++) f.write(`wiki/sources/p${i}.md`, page(`p${i}`, body));
    const all = loadPages(join(f.root, "wiki")).pages;
    const batches = reconcileBatches(f.root);
    for (const batch of batches)
      expect(JSON.stringify(reconcileInput(all, batch)).length).toBeLessThanOrEqual(STRUCTURED_INPUT_LIMIT);
    expect(new Set(batches.flat().map((p) => p.fm.id)).size).toBe(8);
  } finally {
    f.cleanup();
  }
});
