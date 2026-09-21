import { beforeEach, describe, expect, it, vi } from "vitest";
import { restrictedArgs, runRestrictedClaude } from "./restricted-claude";

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), command: vi.fn() }));
vi.mock("./claude-cli", () => ({ spawnClaude: mocks.spawn, resolveClaudeCommand: mocks.command }));
const req = () => ({
  id: "a",
  cwd: "fixture",
  stdin: "clean input",
  args: restrictedArgs("rules", 1),
  timeoutMs: 1000,
  allowedWrites: [],
});
const success = { type: "result", is_error: false, result: "markdown", total_cost_usd: 0.2 };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.command.mockReturnValue({ command: "native", shell: false });
});
function transport(events: unknown[]) {
  mocks.spawn.mockImplementation(async (_req, onLine) => {
    for (const event of events) onLine(JSON.stringify(event));
    return { id: "a", ok: true, exitCode: 0, costUsd: 0.2, stderrTail: "" };
  });
}
describe("restricted CLI contract", () => {
  it("preserves the provider failure diagnostic without accepting it as a draft", async () => {
    mocks.spawn.mockImplementation(async (_req, onLine) => {
      onLine(
        JSON.stringify({ type: "result", is_error: true, result: "Usage limit reached", total_cost_usd: 0 }),
      );
      return { id: "a", ok: false, exitCode: 1, costUsd: 0, stderrTail: "", reason: "exit 1" };
    });
    const result = await runRestrictedClaude(req());
    expect(result).toMatchObject({ ok: false, reason: "exit 1: Usage limit reached", costUsd: 0 });
    expect(result.output).toBeUndefined();
  });
  it("returns text only after one successful final result", async () => {
    transport([success]);
    expect(await runRestrictedClaude(req())).toMatchObject({ ok: true, output: "markdown", costUsd: 0.2 });
  });
  it.each([
    [],
    [success, success],
    [{ ...success, is_error: true }],
    [{ type: "assistant", message: { content: [{ type: "tool_use", name: "Read" }] } }, success],
    [{ type: "assistant", message: { content: [null] } }, success],
    [{ ...success, result: "x".repeat(128 * 1024 + 1) }],
  ])("rejects malformed or tool-using streams", async (...events) => {
    transport(events);
    expect((await runRestrictedClaude(req())).ok).toBe(false);
  });
  it("refuses extra permissions and shell fallback without spawning", async () => {
    expect((await runRestrictedClaude({ ...req(), args: [...req().args, "--add-dir", "private"] })).ok).toBe(
      false,
    );
    mocks.command.mockReturnValue({ command: "claude", shell: true });
    expect((await runRestrictedClaude(req())).ok).toBe(false);
    expect(mocks.spawn).not.toHaveBeenCalled();
  });
});
