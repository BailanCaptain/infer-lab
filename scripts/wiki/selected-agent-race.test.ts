import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { initBudget, readBudget } from "./budget";
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
  vi.restoreAllMocks();
  vi.clearAllMocks();
  for (const f of fixtures.splice(0)) f.cleanup();
});

it.each([
  ["codex", "gpt-6.2-sol", "claude", "sonnet"],
  ["claude", "sonnet", "codex", "gpt-6.2-sol"],
  ["codex", "gpt-6.2-sol", "codex", "gpt-6-astra"],
])(
  "keeps the claimed %s/%s when settings change to %s/%s",
  async (provider, model, nextProvider, nextModel) => {
    const f = wikiFixture();
    fixtures.push(f);
    const select = (chatProvider: string, chatModel: string) =>
      f.write("wiki/sync.config.local.json", JSON.stringify({ chatProvider, chatModel }));
    select(provider, model);
    await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 0, reserveUsd: 0.5, maxCalls: 10 });
    const originalClaim = WorkflowStore.prototype.claim;
    vi.spyOn(WorkflowStore.prototype, "claim").mockImplementation(async function (
      this: WorkflowStore,
      ...args
    ) {
      const attempt = await originalClaim.apply(this, args);
      select(nextProvider, nextModel);
      return attempt;
    });
    mocks.codex.mockImplementation(async (_req, on) => {
      on.text('{"quote":"evidence"}');
      return { ok: true, usage: { input_tokens: 10, output_tokens: 5 } };
    });
    mocks.claude.mockImplementation(async (req, onLine) => {
      onLine(
        JSON.stringify({
          type: "result",
          is_error: false,
          result: '{"quote":"evidence"}',
          total_cost_usd: 0.1,
        }),
      );
      return { id: req.id, ok: true, exitCode: 0, costUsd: 0.1, stderrTail: "" };
    });
    const result = await runStructured(f.root, {
      kind: "selection-race",
      origin: "gap",
      rules: "only JSON",
      data: { text: "evidence" },
      schema: z.object({ quote: z.literal("evidence") }),
      policy: { maxAttempts: 2, maxCostUsd: 1, reserveUsd: 0.5 },
    });
    const runner = provider === "codex" ? mocks.codex : mocks.claude;
    const other = provider === "codex" ? mocks.claude : mocks.codex;
    expect(runner).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    const request = runner.mock.calls[0]![0];
    expect(request.args[request.args.indexOf("--model") + 1]).toBe(model);
    const attempt = new WorkflowStore(f.root).get(result.jobId).attempts[0]!;
    expect(attempt.billing).toBe(provider === "codex" ? "chatgpt" : undefined);
    expect(attempt.costUsd).toBe(provider === "codex" ? undefined : 0.1);
    expect(readBudget(f.root).chargedUsd).toBe(provider === "codex" ? 0 : 0.1);
  },
);

it("freezes claimed custom endpoint/command across mid-flight settings mutations", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  const { writeFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const scriptA = join(f.root, "endpoint-a.mjs");
  const scriptB = join(f.root, "endpoint-b.mjs");
  writeFileSync(scriptA, 'process.stdout.write(JSON.stringify({ quote: "evidence" }));');
  writeFileSync(scriptB, 'process.stderr.write("endpoint B must never be called"); process.exit(9);');

  f.write(
    "wiki/sync.config.local.json",
    JSON.stringify({
      chatProvider: "harness",
      chatModel: "custom-harness",
      harnessCommand: { command: process.execPath, args: [scriptA] },
    }),
  );
  await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 0, reserveUsd: 0.5, maxCalls: 10 });
  const originalClaim = WorkflowStore.prototype.claim;
  vi.spyOn(WorkflowStore.prototype, "claim").mockImplementation(async function (
    this: WorkflowStore,
    ...args
  ) {
    const attempt = await originalClaim.apply(this, args);
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({
        chatProvider: "harness",
        chatModel: "custom-harness",
        harnessCommand: { command: process.execPath, args: [scriptB] },
      }),
    );
    return attempt;
  });

  const result = await runStructured(f.root, {
    kind: "endpoint-race",
    origin: "gap",
    rules: "only JSON",
    data: { text: "evidence" },
    schema: z.object({ quote: z.literal("evidence") }),
    policy: { maxAttempts: 1, maxCostUsd: 1, reserveUsd: 0.5 },
  });
  expect(result.value.quote).toBe("evidence");
});

it("strips URL credentials/query and redacts secret harness args before persisting workflow job attempts", async () => {
  const f = wikiFixture();
  fixtures.push(f);
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const store = new WorkflowStore(f.root);
  const job = await store.enqueue(
    {
      origin: "gap",
      sources: [{ ref: "test", hash: "a".repeat(64) }],
      targets: ["test-target"],
      recipeHash: "b".repeat(64),
    },
    { maxAttempts: 2, maxCostUsd: 1, reserveUsd: 0.5 },
  );
  await store.claim(job.id, false, {
    provider: "openai-compatible",
    model: "deepseek-chat",
    apiBaseUrl: "https://alice:topsecretpass@api.example.com/v1?api_key=sk-querysecret123456",
    harnessCommand: {
      command: "node",
      args: [
        "runner.mjs",
        "--api-key",
        "sk-argsecret123456789",
        "--token=tok-secret-val",
        "--access-token",
        "EXAMPLE_ACCESS_TOKEN",
        "--client-secret=EXAMPLE_CLIENT_SECRET",
        "--service-credential",
        "EXAMPLE_CRED",
      ],
    },
  });
  const persistedRaw = readFileSync(join(f.root, `wiki/_jobs/${job.id}.json`), "utf8");
  expect(persistedRaw).not.toContain("alice");
  expect(persistedRaw).not.toContain("topsecretpass");
  expect(persistedRaw).not.toContain("sk-querysecret123456");
  expect(persistedRaw).not.toContain("sk-argsecret123456789");
  expect(persistedRaw).not.toContain("tok-secret-val");
  expect(persistedRaw).not.toContain("EXAMPLE_ACCESS_TOKEN");
  expect(persistedRaw).not.toContain("EXAMPLE_CLIENT_SECRET");
  expect(persistedRaw).not.toContain("EXAMPLE_CRED");
  const persisted = store.get(job.id);
  expect(persisted.attempts[0]?.selection?.apiBaseUrl).toBe("https://api.example.com/v1");
  expect(persisted.attempts[0]?.selection?.harnessCommand?.args).toEqual([
    "runner.mjs",
    "--api-key",
    "[REDACTED]",
    "--token=[REDACTED]",
    "--access-token",
    "[REDACTED]",
    "--client-secret=[REDACTED]",
    "--service-credential",
    "[REDACTED]",
  ]);
});
