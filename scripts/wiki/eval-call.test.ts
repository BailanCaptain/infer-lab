import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { spawnClaude } from "./claude-cli";
import { runEvalCall } from "./eval-call";
import { wikiFixture } from "./test-fixture";

vi.mock("./claude-cli", () => ({
  resolveClaudeCommand: () => ({ command: "fixture", shell: false }),
  spawnClaude: vi.fn(),
}));
const fixtures: ReturnType<typeof wikiFixture>[] = [];
afterEach(() => {
  for (const f of fixtures.splice(0)) f.cleanup();
  vi.resetAllMocks();
});
function setup(cost: number | undefined = 0.02) {
  const f = wikiFixture();
  fixtures.push(f);
  f.write(
    "budget.json",
    JSON.stringify({
      maxCostUsd: 0.2,
      slots: [
        { id: "first", reserveUsd: 0.1 },
        { id: "second", reserveUsd: 0.1 },
      ],
    }),
  );
  vi.mocked(spawnClaude).mockImplementation(async (req, onLine) => {
    onLine(JSON.stringify({ type: "result", is_error: false, total_cost_usd: cost, result: "answer" }));
    return { id: req.id, ok: true, exitCode: 0, stderrTail: "", costUsd: cost };
  });
  const request = {
    id: "call",
    cwd: f.root,
    args: ["--max-budget-usd", "0.1"],
    stdin: "question",
    timeoutMs: 1000,
    allowedWrites: [],
  };
  return { f, request };
}
it("reuses one immutable paid slot and refuses changed prompts or authorization", async () => {
  const { f, request } = setup();
  expect((await runEvalCall(f.root, "first", request)).ok).toBe(true);
  await runEvalCall(f.root, "first", request);
  expect(spawnClaude).toHaveBeenCalledTimes(1);
  await expect(runEvalCall(f.root, "first", { ...request, stdin: "changed" })).rejects.toThrow(/不可改写/);
  f.write("budget.json", JSON.stringify({ maxCostUsd: 1, slots: [{ id: "first", reserveUsd: 0.1 }] }));
  await expect(runEvalCall(f.root, "first", request)).rejects.toThrow(/授权/);
  expect(spawnClaude).toHaveBeenCalledTimes(1);
});
it("refuses unallocated or over-reserved calls before spawning", async () => {
  const { f, request } = setup();
  await expect(runEvalCall(f.root, "missing", request)).rejects.toThrow(/未分配/);
  await expect(
    runEvalCall(f.root, "first", { ...request, args: ["--max-budget-usd", ".2"] }),
  ).rejects.toThrow(/额度/);
  expect(spawnClaude).not.toHaveBeenCalled();
});
it("does not spend unused reservations after an evaluation is closed", async () => {
  const { f, request } = setup();
  f.write("closed.json", JSON.stringify({ reason: "Superseded after a rule defect" }));
  await expect(runEvalCall(f.root, "first", request)).rejects.toThrow(/结束/);
  expect(spawnClaude).not.toHaveBeenCalled();
});
it("persists native events before the runner finishes so interruption does not erase all evidence", async () => {
  const { f, request } = setup();
  vi.mocked(spawnClaude).mockImplementation(async (_req, onLine) => {
    onLine(JSON.stringify({ type: "system", subtype: "init", model: "fixture-model" }));
    expect(readFileSync(join(f.root, "first.events.jsonl"), "utf8")).toContain("fixture-model");
    throw new Error("interrupted");
  });
  await expect(runEvalCall(f.root, "first", request)).rejects.toThrow("interrupted");
});
it.each([undefined, 0.15, NaN])(
  "does not report paid acceptance when accounting is invalid: %s",
  async (cost) => {
    const { f, request } = setup();
    vi.mocked(spawnClaude).mockImplementation(async (req, onLine) => {
      onLine(JSON.stringify({ type: "result", is_error: false, result: "answer" }));
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "", costUsd: cost };
    });
    expect((await runEvalCall(f.root, "first", request)).ok).toBe(false);
  },
);
