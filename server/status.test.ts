import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { initBudget, withBudget } from "../scripts/wiki/budget";
import { WORK_MODEL } from "../scripts/wiki/model-use";
import { enqueueTask } from "../scripts/wiki/queue";
import { createReview, rejectReview } from "../scripts/wiki/review";
import { wikiContents } from "../scripts/wiki/review-files";
import { wikiFixture } from "../scripts/wiki/test-fixture";
import { handleStatus, readStatus, saveChatModel } from "./status";

it("model selection endpoint requires the local writer guard and validates the body", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  const server = createServer((req, res) => {
    void handleStatus(req, res, f.root);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no address");
    const url = `http://127.0.0.1:${address.port}/api/wiki/status/model`;
    const body = JSON.stringify({ chatProvider: "codex", chatModel: "gpt-6-astra" });
    expect(
      (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body })).status,
    ).toBe(403);
    const headers = { "content-type": "application/json", "x-wiki-review": "1" };
    expect(
      (
        await fetch(url, {
          method: "POST",
          headers: { ...headers, origin: "https://untrusted.example" },
          body,
        })
      ).status,
    ).toBe(403);
    expect((await fetch(url, { method: "POST", headers, body: "{}" })).status).toBe(400);
    const response = await fetch(url, { method: "POST", headers, body });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(JSON.parse(body));
    expect(readStatus(f.root).models.chatModel).toBe("gpt-6-astra");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

it("saves the selected provider/model without changing other local settings or calling a model", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/sync.config.json", JSON.stringify({ maxTasks: 0 }));
  f.write(
    "wiki/sync.config.local.json",
    JSON.stringify({ python: "C:/Python/python.exe", chatProvider: "claude", chatModel: "claude-opus-5-5" }),
  );
  await saveChatModel(f.root, { chatProvider: "codex", chatModel: "gpt-6-astra" });
  expect(readStatus(f.root).models).toMatchObject({ chatProvider: "codex", chatModel: "gpt-6-astra" });
  const saved = readFileSync(join(f.root, "wiki/sync.config.local.json"), "utf8");
  expect(JSON.parse(saved)).toEqual({
    python: "C:/Python/python.exe",
    chatProvider: "codex",
    chatModel: "gpt-6-astra",
  });
  for (const invalid of [
    { chatProvider: "unknown", chatModel: "gpt-6-astra" },
    { chatProvider: "codex", chatModel: "--bad" },
    { chatProvider: "codex", chatModel: "gpt-6-astra", maxTasks: 10 },
  ])
    await expect(saveChatModel(f.root, invalid)).rejects.toThrow();
  expect(readFileSync(join(f.root, "wiki/sync.config.local.json"), "utf8")).toBe(saved);
});

const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
});

it.each(["live", "dead", "inactive"] as const)(
  "reports the nightly process as %s without rewriting the saved receipt",
  (state) => {
    const f = wikiFixture();
    fixtures.push(f);
    f.write("wiki/sync.config.json", JSON.stringify({ mode: "production" }));
    const receipt = JSON.stringify({ status: "running", phase: "worker" });
    f.write("wiki/_jobs/sync/last-run.json", receipt);
    f.write(
      "wiki/_jobs/sync/daily-lease.json",
      JSON.stringify({ pid: 123456, active: state !== "inactive" }),
    );
    const probe = vi.spyOn(process, "kill").mockImplementation(() => {
      if (state === "dead") throw Object.assign(new Error("not running"), { code: "ESRCH" });
      return true;
    });
    try {
      expect(readStatus(f.root).nightly?.lastRun?.status).toBe(state === "live" ? "running" : "interrupted");
      expect(readFileSync(join(f.root, "wiki/_jobs/sync/last-run.json"), "utf8")).toBe(receipt);
      if (state !== "inactive") expect(probe).toHaveBeenCalledWith(123456, 0);
    } finally {
      probe.mockRestore();
    }
  },
);

it("reports production without the historical test caps while preserving recorded usage", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 0.5, reserveUsd: 1, maxCalls: 1 });
  f.write("wiki/sync.config.json", JSON.stringify({ mode: "production" }));
  await withBudget(
    f.root,
    "chat",
    { id: "chat", cwd: f.root, args: [], stdin: "q", timeoutMs: 1000, allowedWrites: [] },
    async () => ({ ok: true, costUsd: 2 }),
  );
  const status = readStatus(f.root);
  expect(status.mode).toBe("production");
  expect(status.budget).toMatchObject({
    limitUsd: null,
    maxCalls: null,
    chargedUsd: 2.5,
    calls: 1,
    paused: false,
  });
  expect(status.nightly).toMatchObject({
    spendsMoney: true,
    maxNewParamPages: null,
    paidWork: { tasks: null, reconcile: null, drift: null },
  });
});

it("reports what used to need file spelunking: budget, nightly guard rails, and content gaps", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write(
    "wiki/concepts/cache-guide.md",
    "---\nid: cache-guide\ntitle: Cache guide\ntype: concept\nsummary: cache\naliases: [kv-cache]\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: I\nupdated: '2026-10-06'\n---\nCache explanation",
  );
  f.write("wiki/concepts/rope.md", "invalid frontmatter");
  f.write("wiki/sync.config.json", JSON.stringify({ maxNewParamPages: 10 }));
  f.write(
    "wiki/_jobs/sync/last-run.json",
    JSON.stringify({ status: "succeeded", finishedAt: "2026-09-19T17:23:49Z" }),
  );
  f.write(
    "wiki/warnings/params-daa69ce0471f-b255ab59662d.json",
    JSON.stringify({ published: { heldBack: 4 } }),
  );
  await initBudget(f.root, { limitUsd: 100, priorChargedUsd: 8, reserveUsd: 2, maxCalls: 2000 });

  const s = readStatus(f.root);
  expect(s.budget).toMatchObject({ limitUsd: 100, chargedUsd: 8, calls: 0, maxCalls: 2000, paused: false });
  expect(s.nightly).toMatchObject({
    maxNewParamPages: 10,
    heldBack: 4,
    spendsMoney: false,
    lastRun: { status: "succeeded" },
  });
  expect(s.pages).toEqual({ concepts: 2, params: 0, sources: 0 });
  expect(s.todo.termEntries).toContainEqual({ term: "kv-cache", id: "cache-guide", title: "Cache guide" });
  expect(s.todo.missingTerms).not.toContain("kv-cache");
  expect(s.todo.missingTerms).toContain("rope");
  expect(s.todo.pendingReviews).toBe(0);
  expect(s.todo.mergedGaps).toBe(0);
});

it("still answers when there is no ledger and no nightly config", () => {
  const f = wikiFixture();
  fixtures.push(f);
  const s = readStatus(f.root);
  expect(s.budget).toBeUndefined();
  expect(s.nightly).toBeUndefined();
});

it("作答模型：配置固定的问答模型，和账本里记到的换模型次数与最近一次", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/sync.config.json", "{}");
  f.write("wiki/sync.config.local.json", JSON.stringify({ chatModel: "claude-fable-5-1" }));
  await initBudget(f.root, { limitUsd: 10, priorChargedUsd: 0, reserveUsd: 1, maxCalls: 10 });
  const req = { id: "a", cwd: f.root, args: [], stdin: "q", timeoutMs: 1000, allowedWrites: [] };
  await withBudget(f.root, "compile", req, async () => ({ ok: true, costUsd: 0.1 }));
  await withBudget(f.root, "compile", req, async () => ({
    ok: true,
    costUsd: 0.1,
    models: { requested: "claude-opus-5-5[1m]", answered: ["claude-opus-5-5"], switches: [] },
  }));
  await withBudget(f.root, "chat", req, async () => ({
    ok: true,
    costUsd: 0.1,
    models: {
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
    },
  }));
  const s = readStatus(f.root);
  expect(s.models).toMatchObject({
    chatModel: "claude-fable-5-1",
    workModel: "claude-fable-5-1",
    recorded: 2,
    switched: 1,
    last: { purpose: "chat", from: "claude-opus-5-5[1m]", to: "claude-opus-5", reason: "frontier_llm" },
  });
  const empty = wikiFixture();
  fixtures.push(empty);
  expect(readStatus(empty.root).models).toEqual({
    chatProvider: "claude",
    codexCalls: 0,
    workModel: WORK_MODEL,
    recorded: 0,
    switched: 0,
  });
});

it("状态读缓存：结构不变；热调用后再改审阅、队列和页面，下一次照样看得到", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  const page = (id: string, title: string, body: string) =>
    `---\nid: ${id}\ntitle: ${title}\ntype: concept\nsummary: ${id}\nsources: [https://docs.vllm.ai/en/latest/]\nevidence: I\nupdated: '2026-10-06'\n---\n${body}`;
  f.write("wiki/concepts/cache-guide.md", page("cache-guide", "Cache guide", "Cache explanation"));
  const first = readStatus(f.root);
  expect(Object.keys(first).sort()).toEqual(["budget", "mode", "models", "nightly", "pages", "todo"]);
  expect(Object.keys(first.todo).sort()).toEqual([
    "closedGaps",
    "gapEntries",
    "gaps",
    "mergedGaps",
    "missingTerms",
    "pendingReviews",
    "queuedTasks",
    "termEntries",
    "totalTerms",
  ]);
  expect(readStatus(f.root)).toEqual(first);

  const before = wikiContents(f.root);
  const after = new Map(before);
  after.set("wiki/concepts/cache-guide.md", page("cache-guide", "Cache guide", "Cache explanation, revised"));
  const review = await createReview(f.root, before, after, {
    promoted: [],
    merged: [],
    rejected: [],
    contradictions: [],
  });
  await enqueueTask(f.root, { kind: "gap", key: "a".repeat(64) });
  f.write("wiki/concepts/rope.md", page("rope", "RoPE", "Rotary position embedding"));
  const changed = readStatus(f.root);
  expect(changed.todo.pendingReviews).toBe(first.todo.pendingReviews + 1);
  expect(changed.todo.queuedTasks).toBe(first.todo.queuedTasks + 1);
  expect(changed.pages.concepts).toBe(first.pages.concepts + 1);
  expect(first.todo.missingTerms).toContain("rope");
  expect(changed.todo.termEntries).toContainEqual({ term: "rope", id: "rope", title: "RoPE" });

  await rejectReview(f.root, review.id, "test");
  expect(readStatus(f.root).todo.pendingReviews).toBe(first.todo.pendingReviews);
});
