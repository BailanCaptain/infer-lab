import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { initBudget, planBudgetResume, readBudget, resumeBudget, withBudget } from "./budget";
import { wikiFixture } from "./test-fixture";

const request = {
  id: "resume-test",
  cwd: ".",
  args: [],
  stdin: "q",
  timeoutMs: 1000,
  allowedWrites: [],
};

it("production Drop accounts for usage without inheriting exhausted test quotas", async () => {
  const f = wikiFixture();
  try {
    await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 1, reserveUsd: 1, maxCalls: 1 });
    for (let i = 0; i < 3; i++)
      expect(
        await withBudget(f.root, "drop", { ...request, accountingOnly: true }, async (req) => {
          expect(req.args).not.toContain("--max-budget-usd");
          return { ok: true, costUsd: 2 };
        }),
      ).toMatchObject({ ok: true });
    const budget = readBudget(f.root);
    expect(budget.calls).toHaveLength(3);
    expect(budget.calls.every((c) => c.accountingOnly && c.costUsd === 2)).toBe(true);
    expect(budget.paused).toBe(false);
    await expect(withBudget(f.root, "test", request, async () => ({ ok: true, costUsd: 0 }))).rejects.toThrow(
      "预算不足",
    );
  } finally {
    f.cleanup();
  }
});

it("records Codex account usage without inventing a USD price or appending Claude flags", async () => {
  const f = wikiFixture();
  try {
    await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 1, reserveUsd: 0.3, maxCalls: 1 });
    const req = { ...request, provider: "codex" as const };
    const result = await withBudget(f.root, "chat", req, async (bounded) => {
      expect(bounded.args).not.toContain("--max-budget-usd");
      return { ok: true, usage: { input_tokens: 10, output_tokens: 2 } };
    });
    expect(result.ok).toBe(true);
    const b = readBudget(f.root);
    expect(b.paused).toBe(false);
    expect(b.chargedUsd).toBe(1);
    expect(b.calls[0]).toMatchObject({ billing: "chatgpt", state: "finished", usage: { input_tokens: 10 } });
    expect(b.calls[0].costUsd).toBeUndefined();
    await expect(withBudget(f.root, "chat", req, async () => ({ ok: true }))).rejects.toThrow(/次数/);
  } finally {
    f.cleanup();
  }
});

it("resumes only the reviewed budget state, keeping unknown costs and an audit record", async () => {
  const f = wikiFixture();
  try {
    await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 0.2, reserveUsd: 0.3, maxCalls: 4 });
    await withBudget(f.root, "interrupted", request, async () => ({ ok: false }));
    const before = readBudget(f.root);
    const plan = planBudgetResume(f.root);
    expect(readBudget(f.root)).toEqual(before);
    expect(plan.unknownCalls).toEqual([{ id: before.calls[0].id, reservedUsd: 0.3 }]);
    const resumed = await resumeBudget(
      f.root,
      plan.id,
      "User accepts keeping the reservation pending receipt",
    );
    expect(resumed.paused).toBe(false);
    expect(resumed.policy).toEqual(before.policy);
    expect(resumed.calls).toEqual(before.calls);
    expect(resumed.chargedUsd).toBe(before.chargedUsd);
    expect(resumed.resumptions?.[0]).toMatchObject({ planId: plan.id, beforeHash: plan.stateHash });
    expect(await withBudget(f.root, "next", request, async () => ({ ok: true, costUsd: 0.1 }))).toMatchObject(
      { ok: true },
    );
    expect(readBudget(f.root).chargedUsd).toBeCloseTo(0.6);
  } finally {
    f.cleanup();
  }
});

it("refuses stale approval and preserves a later pause when an old approval is repeated", async () => {
  const f = wikiFixture();
  try {
    await initBudget(f.root, { limitUsd: 2, priorChargedUsd: 0, reserveUsd: 0.3, maxCalls: 5 });
    await withBudget(f.root, "first", request, async () => ({ ok: false }));
    const plan = planBudgetResume(f.root);
    await expect(resumeBudget(f.root, "0".repeat(64), "approved")).rejects.toThrow(/变化/);
    await expect(resumeBudget(f.root, plan.id, " ")).rejects.toThrow();
    await resumeBudget(f.root, plan.id, "approved");
    await withBudget(f.root, "second", request, async () => ({ ok: false }));
    const paused = readBudget(f.root);
    expect(paused.paused).toBe(true);
    expect(await resumeBudget(f.root, plan.id, "approved")).toEqual(paused);
    expect(readBudget(f.root).resumptions).toHaveLength(1);
    expect(planBudgetResume(f.root).id).not.toBe(plan.id);
  } finally {
    f.cleanup();
  }
});

it.each(["running", "overspent", "call-limit"])("cannot resume past %s", async (blocker) => {
  const f = wikiFixture();
  try {
    await initBudget(f.root, {
      limitUsd: 1,
      priorChargedUsd: 0.2,
      reserveUsd: 0.3,
      maxCalls: blocker === "call-limit" ? 1 : 3,
    });
    await withBudget(f.root, "first", request, async () => ({
      ok: false,
      costUsd: blocker === "overspent" ? 1.1 : undefined,
    }));
    if (blocker === "running") {
      const path = "wiki/_jobs/budget/account.json";
      const state = JSON.parse(readFileSync(join(f.root, path), "utf8"));
      state.calls[0].state = "running";
      f.write(path, JSON.stringify(state));
    }
    expect(() => planBudgetResume(f.root)).toThrow();
    expect(readBudget(f.root).paused).toBe(true);
  } finally {
    f.cleanup();
  }
});

it("pauses abandoned reservations before allowing a new call", async () => {
  const f = wikiFixture();
  try {
    await initBudget(f.root, { limitUsd: 2, priorChargedUsd: 0, reserveUsd: 0.4, maxCalls: 3 });
    const file = "wiki/_jobs/budget/account.json";
    const state = JSON.parse(readFileSync(join(f.root, file), "utf8"));
    state.calls.push({
      id: "00000000-0000-4000-8000-000000000001",
      purpose: "crashed",
      requestHash: "a",
      reservedUsd: 0.4,
      startedAt: new Date().toISOString(),
      state: "running",
    });
    f.write(file, JSON.stringify(state));
    await expect(
      withBudget(
        f.root,
        "chat",
        { id: "a", cwd: f.root, args: [], stdin: "q", timeoutMs: 1000, allowedWrites: [] },
        async () => ({ ok: true, costUsd: 0 }),
      ),
    ).rejects.toThrow(/暂停/);
    expect(readBudget(f.root).chargedUsd).toBe(0.4);
  } finally {
    f.cleanup();
  }
});

it("shares reservations across work types and refuses resetting or overspending", async () => {
  const f = wikiFixture();
  try {
    const policy = { limitUsd: 1, priorChargedUsd: 0.2, reserveUsd: 0.4, maxCalls: 3 };
    await initBudget(f.root, policy);
    const request = { id: "a", cwd: f.root, args: [], stdin: "question", timeoutMs: 1000, allowedWrites: [] };
    let release!: () => void;
    let entered!: () => void;
    const ready = new Promise<void>((r) => {
      entered = r;
    });
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const first = withBudget(f.root, "chat", request, async (req) => {
      expect(req.args).toContain("--max-budget-usd");
      entered();
      await gate;
      return { ok: true, costUsd: 0.2 };
    });
    await ready;
    try {
      await withBudget(f.root, "compile", request, async () => ({ ok: true, costUsd: 0.3 }));
      await expect(
        withBudget(f.root, "gap", request, async () => ({ ok: true, costUsd: 0 })),
      ).rejects.toThrow(/预算/);
    } finally {
      release();
    }
    expect((await first).ok).toBe(true);
    expect(readBudget(f.root).chargedUsd).toBeCloseTo(0.7);
    await expect(initBudget(f.root, { ...policy, limitUsd: 5 })).rejects.toThrow(/重置/);
  } finally {
    f.cleanup();
  }
});

it.each([undefined, 0.8])(
  "records unknown or over-reservation costs and pauses all further paid calls: %s",
  async (costUsd) => {
    const f = wikiFixture();
    try {
      await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 0, reserveUsd: 0.4, maxCalls: 2 });
      const req = { id: "a", cwd: f.root, args: [], stdin: "q", timeoutMs: 1000, allowedWrites: [] };
      expect(await withBudget(f.root, "gap", req, async () => ({ ok: true, costUsd }))).toMatchObject({
        ok: false,
      });
      await expect(withBudget(f.root, "chat", req, async () => ({ ok: true, costUsd: 0 }))).rejects.toThrow(
        /暂停/,
      );
      expect(readBudget(f.root).chargedUsd).toBe(costUsd ?? 0.4);
    } finally {
      f.cleanup();
    }
  },
);

// 所有付费调用都过这本账：编译、复测等不留会话记录，换没换模型只能从这里查
it("账本每条调用记下实际作答模型；旧账目没有这个字段照样能读", async () => {
  const f = wikiFixture();
  try {
    await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 0, reserveUsd: 0.4, maxCalls: 3 });
    const models = {
      requested: "claude-opus-5-5[1m]",
      answered: ["claude-opus-5"],
      switches: [
        {
          event: "model_refusal_fallback",
          from: "claude-opus-5-5[1m]",
          to: "claude-opus-5",
          reason: "frontier_llm",
        },
      ],
    };
    await withBudget(f.root, "chat", request, async () => ({ ok: true, costUsd: 0.1, models }));
    await withBudget(f.root, "compile", request, async () => ({ ok: true, costUsd: 0.1 }));
    const calls = readBudget(f.root).calls;
    expect(calls[0]?.models).toEqual(models);
    expect(calls[1]).not.toHaveProperty("models");
  } finally {
    f.cleanup();
  }
});
