import { afterEach, expect, it } from "vitest";
import { initBudget } from "../scripts/wiki/budget";
import { wikiFixture } from "../scripts/wiki/test-fixture";
import { readStatus } from "./status";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

it("reports what used to need file spelunking: budget, nightly guard rails, and content gaps", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/concepts/kv-cache.md", "x");
  f.write("wiki/sync.config.json", JSON.stringify({ maxNewParamPages: 10 }));
  f.write("wiki/_jobs/sync/last-run.json", JSON.stringify({ status: "succeeded", finishedAt: "2026-09-19T17:23:49Z" }));
  f.write("wiki/warnings/params-daa69ce0471f-b255ab59662d.json", JSON.stringify({ published: { heldBack: 4 } }));
  await initBudget(f.root, { limitUsd: 100, priorChargedUsd: 8, reserveUsd: 2, maxCalls: 2000 });

  const s = readStatus(f.root);
  expect(s.budget).toMatchObject({ limitUsd: 100, chargedUsd: 8, calls: 0, maxCalls: 2000, paused: false });
  expect(s.nightly).toMatchObject({
    maxNewParamPages: 10,
    heldBack: 4,
    spendsMoney: false,
    lastRun: { status: "succeeded" },
  });
  expect(s.pages).toEqual({ concepts: 1, params: 0, sources: 0 });
  expect(s.todo.missingTerms).not.toContain("kv-cache");
  expect(s.todo.missingTerms).toContain("rope");
  expect(s.todo.pendingReviews).toBe(0);
});

it("still answers when there is no ledger and no nightly config", () => {
  const f = wikiFixture();
  fixtures.push(f);
  const s = readStatus(f.root);
  expect(s.budget).toBeUndefined();
  expect(s.nightly).toBeUndefined();
});
