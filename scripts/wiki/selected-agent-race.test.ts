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
  ["codex", "gpt-6.1-sol", "claude", "sonnet"],
  ["claude", "sonnet", "codex", "gpt-6.1-sol"],
  ["codex", "gpt-6.1-sol", "codex", "gpt-6-astra"],
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
