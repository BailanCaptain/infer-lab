import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { initBudget, readBudget, withBudget } from "./budget";
import { wikiFixture } from "./test-fixture";

it("previews without writing and applies only a matching explicit approval through the CLI", async () => {
  const f = wikiFixture();
  try {
    await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 0.2, reserveUsd: 0.15, maxCalls: 3 });
    await withBudget(
      f.root,
      "test-interruption",
      { id: "a", cwd: f.root, args: [], stdin: "q", timeoutMs: 1000, allowedWrites: [] },
      async () => ({ ok: false }),
    );
    const file = join(f.root, "wiki/_jobs/budget/account.json");
    const before = readFileSync(file, "utf8");
    const preview = f.cli("wiki-budget", ["resume", "--preview"]);
    expect(preview.status, preview.stderr).toBe(0);
    const plan = JSON.parse(preview.stdout);
    expect(readFileSync(file, "utf8")).toBe(before);
    const missingApproval = f.cli("wiki-budget", ["resume", "--plan", plan.id]);
    expect(missingApproval.status).toBe(1);
    expect(readFileSync(file, "utf8")).toBe(before);
    const mixed = f.cli("wiki-budget", ["resume", "--preview", "--plan", plan.id, "--reason", "yes"]);
    expect(mixed.status).toBe(1);
    expect(readFileSync(file, "utf8")).toBe(before);
    const apply = f.cli("wiki-budget", ["resume", "--plan", plan.id, "--reason", "Explicit test approval"]);
    expect(apply.status, apply.stderr).toBe(0);
    const current = readBudget(f.root);
    expect(current.paused).toBe(false);
    expect(current.chargedUsd).toBeCloseTo(0.35);
    expect(current.calls).toHaveLength(1);
    expect(current.calls[0].state).toBe("unknown");
    expect(current.calls[0].costUsd).toBeUndefined();
    expect(current.resumptions).toHaveLength(1);
  } finally {
    f.cleanup();
  }
});
