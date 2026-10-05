import { afterEach, expect, it } from "vitest";
import { initBudget, withBudget } from "../scripts/wiki/budget";
import { WORK_MODEL } from "../scripts/wiki/model-use";
import { wikiFixture } from "../scripts/wiki/test-fixture";
import { readStatus } from "./status";
import { saveChatModel } from "./status";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "node:http";
import { handleStatus } from "./status";

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

it("reports what used to need file spelunking: budget, nightly guard rails, and content gaps", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/concepts/kv-cache.md", "x");
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
  expect(s.pages).toEqual({ concepts: 1, params: 0, sources: 0 });
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
