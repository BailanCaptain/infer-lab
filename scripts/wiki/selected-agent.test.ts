import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import type { AgentRequest } from "./batch";
import { initBudget, readBudget } from "./budget";
import { restrictedArgs } from "./restricted-claude";
import { selectedAgent } from "./selected-agent";
import { runStructured } from "./structured";
import { wikiFixture } from "./test-fixture";
import { WorkflowStore } from "./workflow";

const mocks = vi.hoisted(() => ({ codex: vi.fn(), claude: vi.fn() }));
vi.mock("../../server/codex-chat", async (original) => ({
  ...(await original<object>()),
  runCodexChat: mocks.codex,
}));
vi.mock("./claude-cli", async (original) => ({
  ...(await original<object>()),
  spawnClaude: mocks.claude,
  resolveClaudeCommand: () => ({ command: "native", shell: false }),
}));
const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
  vi.clearAllMocks();
});

it("multi-ref evidence reports an explicitly optional missing path without inventing file contents", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/sync.config.local.json", JSON.stringify({ chatProvider: "codex", chatModel: "gpt-6-astra" }));
  f.write("wiki/current.py", "class Current: pass");
  await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 0, reserveUsd: 0.5, maxCalls: 10 });
  const req: AgentRequest = {
    id: "versions",
    cwd: join(f.root, "wiki"),
    args: ["--model", "legacy", "--append-system-prompt", "rules"],
    stdin: "compare pinned versions",
    timeoutMs: 1000,
    allowedWrites: ["_drafts/versions.md"],
    evidenceFiles: [
      { label: "repo@aaaaaaa:current.py", path: "absent.py", allowMissing: true },
      { label: "repo@bbbbbbb:current.py", path: "current.py", allowMissing: true, numbered: true },
    ],
  };
  mocks.codex.mockImplementation(async (request, on) => {
    expect(request.stdin).toContain('"status":"missing"');
    expect(request.stdin).toContain("repo@aaaaaaa:current.py");
    expect(request.stdin).toContain("class Current: pass");
    expect(request.stdin).toContain("L1: class Current: pass");
    on.text(JSON.stringify({ files: [{ path: "_drafts/versions.md", text: "draft" }] }));
    return { ok: true };
  });
  expect((await selectedAgent(f.root, "seed-extract")(req)).ok).toBe(true);
  mocks.codex.mockClear();
  req.evidenceFiles![0]!.allowMissing = false;
  await expect(selectedAgent(f.root, "seed-extract")(req)).rejects.toThrow();
  expect(mocks.codex).not.toHaveBeenCalled();
});

it("all restricted work uses the saved selection and subscription accounting, without Claude fallback", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write(
    "wiki/sync.config.local.json",
    JSON.stringify({ chatProvider: "codex", chatModel: "gpt-6-astra", codexCli: process.execPath }),
  );
  await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 0, reserveUsd: 0.5, maxCalls: 10 });
  mocks.codex.mockImplementation(async (req, on) => {
    expect(req.codexCli).toBe(process.execPath);
    expect(req.args).toContain("gpt-6-astra");
    expect(req.args).toContain('web_search="disabled"');
    expect(req.args).not.toContain("--max-budget-usd");
    on.text('{"ok":true}');
    return {
      ok: true,
      usage: { input_tokens: 10, output_tokens: 5 },
      models: { requested: "gpt-6-astra", answered: [], switches: [] },
    };
  });
  for (const purpose of ["answer-compile", "coverage", "worker-compile", "gap-identity", "reconcile"]) {
    const result = await selectedAgent(
      f.root,
      purpose,
    )({
      id: purpose,
      cwd: f.root,
      args: restrictedArgs("rules", 0.5),
      stdin: "evidence",
      timeoutMs: 1000,
      allowedWrites: [],
    });
    expect(result).toMatchObject({ ok: true, output: '{"ok":true}', billing: "chatgpt" });
    expect(result.costUsd).toBeUndefined();
  }
  expect(mocks.claude).not.toHaveBeenCalled();
  expect(readBudget(f.root)).toMatchObject({ paused: false, chargedUsd: 0 });
  expect(readBudget(f.root).calls).toHaveLength(5);
  expect(readBudget(f.root).calls.every((c) => c.billing === "chatgpt" && c.usage?.output_tokens === 5)).toBe(
    true,
  );
  mocks.codex.mockResolvedValue({ ok: false, reason: "account unavailable" });
  expect(
    (
      await selectedAgent(
        f.root,
        "compile",
      )({
        id: "bad",
        cwd: f.root,
        args: restrictedArgs("rules", 0.5),
        stdin: "evidence",
        timeoutMs: 1000,
        allowedWrites: [],
      })
    ).ok,
  ).toBe(false);
  expect(mocks.claude).not.toHaveBeenCalled();
});

it("Claude restricted work uses the selected model while retaining the tool-free profile", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/sync.config.local.json", JSON.stringify({ chatProvider: "claude", chatModel: "sonnet" }));
  await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 0, reserveUsd: 0.5, maxCalls: 10 });
  mocks.claude.mockImplementation(async (req, onLine) => {
    expect(req.args[req.args.indexOf("--model") + 1]).toBe("sonnet");
    expect(req.args[req.args.indexOf("--tools") + 1]).toBe("");
    onLine(JSON.stringify({ type: "result", is_error: false, result: "draft", total_cost_usd: 0.1 }));
    return { id: req.id, ok: true, exitCode: 0, costUsd: 0.1, stderrTail: "" };
  });
  expect(
    await selectedAgent(
      f.root,
      "answer-compile",
    )({
      id: "a",
      cwd: f.root,
      args: restrictedArgs("rules", 0.5),
      stdin: "evidence",
      timeoutMs: 1000,
      allowedWrites: [],
    }),
  ).toMatchObject({ ok: true, output: "draft", costUsd: 0.1 });
});

it("structured background work completes with a subscription receipt instead of an invented USD cost", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/sync.config.local.json", JSON.stringify({ chatProvider: "codex", chatModel: "gpt-6-astra" }));
  await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 0, reserveUsd: 0.5, maxCalls: 10 });
  mocks.codex.mockImplementation(async (_req, on) => {
    on.text('{"quote":"evidence"}');
    return { ok: true, usage: { input_tokens: 10, output_tokens: 5 } };
  });
  const result = await runStructured(f.root, {
    kind: "background-test",
    origin: "gap",
    rules: "only JSON",
    data: { text: "evidence" },
    schema: z.object({ quote: z.literal("evidence") }),
    policy: { maxAttempts: 2, maxCostUsd: 1, reserveUsd: 0.5 },
  });
  expect(result.value.quote).toBe("evidence");
  const attempt = new WorkflowStore(f.root).get(result.jobId).attempts[0]!;
  expect(attempt).toMatchObject({
    state: "draft",
    billing: "chatgpt",
    reservedUsd: 0,
    usage: { output_tokens: 5 },
  });
  expect(attempt.costUsd).toBeUndefined();
});

it("file-producing import uses Codex too, and validates all returned paths before any writes", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  f.write("wiki/sync.config.local.json", JSON.stringify({ chatProvider: "codex", chatModel: "gpt-6-astra" }));
  f.write("wiki/source.md", "provided evidence");
  await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 0, reserveUsd: 0.5, maxCalls: 10 });
  const req = {
    id: "a",
    cwd: join(f.root, "wiki"),
    args: ["--model", "legacy", "--append-system-prompt", "rules", "--max-budget-usd", "0.5"],
    stdin: "make draft",
    timeoutMs: 1000,
    allowedWrites: ["_drafts/a.md"],
    evidenceFiles: [{ label: "source.md", path: "source.md" }],
  };
  mocks.codex.mockImplementation(async (request, on) => {
    expect(request.stdin).toContain("provided evidence");
    on.text(
      JSON.stringify({
        files: [
          { path: "_drafts/a.md", text: "draft" },
          { path: "../escaped.md", text: "bad" },
        ],
      }),
    );
    return { ok: true };
  });
  expect((await selectedAgent(f.root, "seed-extract")(req)).ok).toBe(false);
  expect(existsSync(join(req.cwd, "_drafts/a.md"))).toBe(false);
  mocks.codex.mockImplementation(async (_req, on) => {
    on.text(JSON.stringify({ files: [{ path: "_drafts/a.md", text: "draft" }] }));
    return { ok: true };
  });
  expect((await selectedAgent(f.root, "seed-extract")(req)).ok).toBe(true);
  expect(readFileSync(join(req.cwd, "_drafts/a.md"), "utf8")).toBe("draft");
  expect(mocks.claude).not.toHaveBeenCalled();
});
