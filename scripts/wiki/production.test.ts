import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { initBudget, readBudget, withBudget } from "./budget";
import { detectDrift } from "./drift";
import { reconcileBatches, reconcileCycle } from "./reconcile";
import { configuredWorkflowPolicy, readSyncConfig } from "./sync-config";
import { wikiFixture } from "./test-fixture";
import { WorkflowStore } from "./workflow";

it("production removes nightly quotas and uses accounting without a test budget", () => {
  const f = wikiFixture();
  try {
    f.write("wiki/sync.config.json", JSON.stringify({ mode: "production" }));
    expect(readSyncConfig(join(f.root, "wiki/sync.config.json"))).toMatchObject({
      mode: "production",
      maxTasks: null,
      reconcileBatches: null,
      driftSample: null,
      maxNewParamPages: null,
      paid: { accountingOnly: true },
    });
    expect(configuredWorkflowPolicy(f.root, { maxCostUsd: Number.NaN })).toEqual({ accountingOnly: true });
    const plan = f.cli("wiki-sync", ["--config", "wiki/sync.config.json", "--plan"]);
    expect(plan.status, plan.stderr).toBe(0);
    expect(JSON.parse(plan.stdout).config).toMatchObject({
      mode: "production",
      paid: { accountingOnly: true },
    });
  } finally {
    f.cleanup();
  }
});

it("production preserves an exhausted test ledger while recording unrestricted calls", async () => {
  const f = wikiFixture();
  try {
    await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 0, reserveUsd: 1, maxCalls: 1 });
    const request = { id: "test", cwd: f.root, args: [], stdin: "q", timeoutMs: 1000, allowedWrites: [] };
    await withBudget(f.root, "test", request, async () => ({ ok: true, costUsd: 2 }));
    const before = readBudget(f.root);
    expect(before.paused).toBe(true);
    f.write("wiki/sync.config.json", JSON.stringify({ mode: "production" }));
    for (const purpose of ["chat", "reconcile", "drift"])
      expect(
        await withBudget(
          f.root,
          purpose,
          { ...request, args: ["--max-budget-usd", "0.1", "--model", "model"] },
          async (actual) => {
            expect(actual.accountingOnly).toBe(true);
            expect(actual.args).toEqual(["--model", "model"]);
            return { ok: true, costUsd: 5 };
          },
        ),
      ).toMatchObject({ ok: true });
    const after = readBudget(f.root);
    expect(after.policy).toEqual(before.policy);
    expect(after.calls[0]).toEqual(before.calls[0]);
    expect(after.calls.slice(1)).toHaveLength(3);
    expect(after.calls.slice(1).every((call) => call.accountingOnly && call.costUsd === 5)).toBe(true);
  } finally {
    f.cleanup();
  }
});

it("production can explicitly retry old exhausted jobs without resetting history or auto-retrying", async () => {
  const f = wikiFixture();
  try {
    const store = new WorkflowStore(f.root);
    const input = {
      origin: "gap" as const,
      sources: [{ ref: "test", hash: "hash" }],
      targets: ["production-test"],
      recipeHash: "recipe",
    };
    const policy = { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 1 };
    const job = await store.enqueue(input, policy);
    const first = await store.claim(job.id);
    await store.finish(job.id, first.token, { ok: false, costUsd: 2, reason: "failed test" });
    const before = store.get(job.id);
    f.write("wiki/sync.config.json", JSON.stringify({ mode: "production" }));
    await store.enqueue(input, policy);
    await expect(store.claim(job.id)).rejects.toThrow("显式重试");
    const second = await store.claim(job.id, true);
    expect(second.reservedUsd).toBe(0);
    expect(second).toMatchObject({ accountingOnly: true });
    // A later config change cannot turn an already-started production call into a capped one.
    f.write("wiki/sync.config.json", "{}");
    const finished = await store.finish(job.id, second.token, { ok: true, costUsd: 10 });
    expect(finished.state).toBe("draft");
    expect(finished.attempts[0]).toEqual(before.attempts[0]);
    expect(finished.policy).toEqual(before.policy);
    expect(JSON.parse(readFileSync(join(f.root, `wiki/_jobs/${job.id}.json`), "utf8")).attempts).toHaveLength(
      2,
    );
  } finally {
    f.cleanup();
  }
});

it("uncapped maintenance visits more than ten pages and stops after one complete relation cycle", async () => {
  const f = wikiFixture();
  try {
    for (let index = 0; index < 12; index++)
      f.write(
        `wiki/sources/page-${index}.md`,
        `---\nid: page-${index}\ntitle: Page ${index}\ntype: source\nsummary: page\nsources: [https://example.test/]\nevidence: I\nupdated: '2026-10-20'\n---\n${String(index).padStart(2, "0")}${"a".repeat(19000)}`,
      );
    const policy = { accountingOnly: true as const };
    const batches = reconcileBatches(f.root);
    expect(batches.length).toBeGreaterThan(10);
    let calls = 0;
    const result = await reconcileCycle(f.root, null, policy, {
      runAgent: async (request) => {
        calls++;
        expect(request.args).not.toContain("--max-budget-usd");
        return {
          id: request.id,
          ok: true,
          exitCode: 0,
          stderrTail: "",
          costUsd: 0,
          output: '{"relations":[],"contradictions":[],"duplicates":[]}',
        };
      },
    });
    expect(result.processed).toBe(batches.length);
    expect(calls).toBe(batches.length);
    expect(result.next).toBe(0);
    const drift = await detectDrift(f.root, { sample: null, policy });
    expect(drift).toHaveLength(12);
    expect(drift.every((result) => "status" in result && result.status === "needs-source")).toBe(true);
  } finally {
    f.cleanup();
  }
});
