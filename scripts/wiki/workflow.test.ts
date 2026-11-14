import { afterEach, describe, expect, it } from "vitest";
import { wikiFixture } from "./test-fixture";
import { WorkflowStore } from "./workflow";

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});
const input = {
  origin: "seed" as const,
  sources: [{ ref: "r@abcdef0:a.py", hash: "abcdef0" }],
  targets: ["a"],
  recipeHash: "recipe-v1",
};
const policy = { maxAttempts: 3, maxCostUsd: 4, reserveUsd: 2 };
const setup = () => {
  const f = wikiFixture();
  fixtures.push(f);
  return f;
};

describe("persistent wiki workflow", () => {
  it("waits for a live transaction lasting longer than one second without stealing it", async () => {
    const f = setup();
    const { rmSync } = await import("node:fs");
    const store = new WorkflowStore(f.root);
    f.write(
      "tools/wiki-runtime/workflow.lock",
      JSON.stringify({ pid: process.pid, at: new Date().toISOString() }),
    );
    const release = setTimeout(() => rmSync(`${store.runtimeDir}/workflow.lock`), 2500);
    try {
      expect(await store.locked(() => "acquired")).toBe("acquired");
    } finally {
      clearTimeout(release);
    }
  });
  it("keeps a budget overrun visible even when the native runner also fails", async () => {
    const f = setup();
    const store = new WorkflowStore(f.root);
    const job = await store.enqueue(input, policy);
    const attempt = await store.claim(job.id);
    let published = false;
    const finished = await store.finish(
      job.id,
      attempt.token,
      { ok: false, costUsd: 3, reason: "exit 1" },
      () => {
        published = true;
      },
    );
    expect(finished.attempts[0]!.reason).toContain("超过预留");
    expect(finished.attempts[0]!.reason).toContain("exit 1");
    expect(finished.attempts[0]!.costUsd).toBe(3);
    expect(published).toBe(false);
    await expect(store.claim(job.id, true)).rejects.toThrow(/预算/);
  });
  it("refuses implicit budget resets and never steals a leftover lock", async () => {
    const f = setup();
    const store = new WorkflowStore(f.root);
    await store.enqueue(input, policy);
    await expect(store.enqueue(input, { ...policy, maxCostUsd: 100 })).rejects.toThrow(/预算/);
    f.write("tools/wiki-runtime/workflow.lock", '{"pid":99999999}');
    await expect(store.recover()).rejects.toThrow(/锁被占用/);
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(`${store.runtimeDir}/workflow.lock`, "utf8")).toContain("99999999");
  });
  it("lets a finished job be reused under another budget: nothing can be charged to it any more", async () => {
    // 2026-09-23 真实缺口：诊断先由 wiki:work assess 用 1/0.5 的预算跑完，夜间任务再拿自己的 4/2 预算
    // 复用同一份诊断回执时被「不能修改预算」拦住。回执已完成，换个预算来读它不会产生任何费用。
    const f = setup();
    const store = new WorkflowStore(f.root);
    const job = await store.enqueue(input, policy);
    const attempt = await store.claim(job.id);
    await store.finish(job.id, attempt.token, { ok: true, costUsd: 0.1, artifacts: {} }, () => {});
    const reused = await store.enqueue(input, { ...policy, maxCostUsd: 100 });
    expect(reused.state).toBe("draft");
    expect(reused.policy).toEqual(policy);
  });
  it("deduplicates evidence across origins and preserves the job after reopening", async () => {
    const f = setup();
    const store = new WorkflowStore(f.root);
    const a = await store.enqueue(input, policy);
    const b = await store.enqueue({ ...input, origin: "chat" }, policy);
    expect(b.id).toBe(a.id);
    expect(new WorkflowStore(f.root).get(a.id).origins).toEqual(["chat", "seed"]);
    expect(store.list()).toHaveLength(1);
  });

  it("requires explicit retry, preserves unknown cost reservations and rejects exhausted budgets", async () => {
    const f = setup();
    const store = new WorkflowStore(f.root);
    const job = await store.enqueue(input, policy);
    const first = await store.claim(job.id);
    await store.finish(job.id, first.token, { ok: false, reason: "timeout" });
    await expect(store.claim(job.id)).rejects.toThrow(/显式重试/);
    const second = await store.claim(job.id, true);
    await store.finish(job.id, second.token, { ok: false, costUsd: 2, reason: "failed" });
    await expect(new WorkflowStore(f.root).claim(job.id, true)).rejects.toThrow(/预算/);
    expect(store.get(job.id).attempts).toHaveLength(2);
  });

  it("recovers dead owners, fences late results and leaves live work alone", async () => {
    const f = setup();
    const owner = new WorkflowStore(f.root, { pid: 12345, isAlive: () => true });
    const job = await owner.enqueue(input, { ...policy, maxCostUsd: 10 });
    const old = await owner.claim(job.id);
    expect(await owner.recover()).toEqual([]);
    const replacement = new WorkflowStore(f.root, { isAlive: () => false });
    expect(await replacement.recover()).toEqual([job.id]);
    const next = await replacement.claim(job.id, true);
    let writes = 0;
    await expect(
      owner.finish(job.id, old.token, { ok: true, costUsd: 0 }, () => {
        writes++;
      }),
    ).rejects.toThrow(/过期/);
    expect(writes).toBe(0);
    expect(replacement.get(job.id).attempts.at(-1)?.token).toBe(next.token);
  });

  it("serializes concurrent claims, prevents overlapping targets and releases locks during compilation", async () => {
    const f = setup();
    const one = new WorkflowStore(f.root);
    const two = new WorkflowStore(f.root);
    const job = await one.enqueue(input, policy);
    const claims = await Promise.allSettled([one.claim(job.id), two.claim(job.id)]);
    expect(claims.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const other = await two.enqueue({ ...input, recipeHash: "recipe-v2" }, policy);
    await expect(two.claim(other.id)).rejects.toThrow(/正在处理/);
    const unrelated = await two.enqueue({ ...input, targets: ["b"] }, policy);
    expect((await two.claim(unrelated.id)).token).toBeTruthy();
  });

  it("failed publication remains failed and zero-cost attempts still exhaust the attempt limit", async () => {
    const f = setup();
    const store = new WorkflowStore(f.root);
    const job = await store.enqueue(input, { ...policy, maxAttempts: 1 });
    const attempt = await store.claim(job.id);
    await store.finish(job.id, attempt.token, { ok: true, costUsd: 0 }, () => {
      throw new Error("base changed");
    });
    expect(store.get(job.id).state).toBe("failed");
    expect(store.get(job.id).attempts[0]?.reason).toContain("base changed");
    await expect(store.claim(job.id, true)).rejects.toThrow(/次数/);
  });
});
