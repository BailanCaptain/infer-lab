import { beforeEach, expect, it, vi } from "vitest";
import { buildChatRequest, runChat } from "./chat";

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), command: vi.fn() }));
vi.mock("../scripts/wiki/claude-cli", () => ({
  spawnClaude: mocks.spawn,
  resolveClaudeCommand: mocks.command,
}));
const request = () =>
  buildChatRequest(
    { message: "A？" },
    { reading: "R", citable: "CI", query: "Q" },
    { wikiRoot: "snapshot", timeoutMs: 1000 },
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.command.mockReturnValue({ command: "native", shell: false });
});
it("retains a web call even when a read appears first in the same assistant envelope", async () => {
  mocks.spawn.mockImplementation(async (_req, parse) => {
    parse(
      JSON.stringify({
        type: "assistant",
        message: {
          content: [
            { type: "tool_use", name: "Read", input: { file_path: "sources/a.md" } },
            { type: "tool_use", name: "WebFetch", input: { url: "https://docs.vllm.ai/" } },
          ],
        },
      }),
    );
    parse(JSON.stringify({ type: "result", is_error: false }));
    return { ok: true };
  });
  const tool = vi.fn();
  expect((await runChat(request(), { text: () => {}, tool })).ok).toBe(true);
  expect(tool.mock.calls).toEqual([
    ["Read", "sources/a.md"],
    ["WebFetch", "https://docs.vllm.ai/"],
  ]);
});
it("requires one successful final record, not just process exit zero", async () => {
  for (const count of [0, 1, 2]) {
    mocks.spawn.mockImplementation(async (_req, parse) => {
      for (let i = 0; i < count; i++) parse(JSON.stringify({ type: "result", is_error: false }));
      return { ok: true };
    });
    expect((await runChat(request(), { text: () => {} })).ok).toBe(count === 1);
  }
});
it("把启动器认出的作答模型原样交回，路由才能标给读者、写进问答记录", async () => {
  const models = {
    requested: "claude-opus-5-5[1m]",
    answered: ["claude-opus-5"],
    switches: [{ event: "model_refusal_fallback", from: "claude-opus-5-5[1m]", to: "claude-opus-5" }],
  };
  mocks.spawn.mockImplementation(async (_req, parse) => {
    parse(JSON.stringify({ type: "result", is_error: false, total_cost_usd: 0.3 }));
    return { ok: true, costUsd: 0.3, models };
  });
  expect(await runChat(request(), { text: () => {} })).toMatchObject({ ok: true, costUsd: 0.3, models });
});
it("does not use shell fallback for the isolated argv profile", async () => {
  mocks.command.mockReturnValue({ command: "claude", shell: true });
  expect((await runChat(request(), { text: () => {} })).ok).toBe(false);
  expect(mocks.spawn).not.toHaveBeenCalled();
});
it("explicitly limits available tools and customization independently of auto-approval", () => {
  const args = request().args;
  expect(args[args.indexOf("--tools") + 1]).toBe("Read,Grep,Glob,WebFetch,WebSearch");
  for (const flag of ["--restricted", "--safe-mode", "--strict-mcp-config", "--disable-slash-commands"])
    expect(args).toContain(flag);
  expect(args[args.indexOf("--permission-mode") + 1]).toBe("dontAsk");
  expect(args[args.indexOf("--system-prompt-snapshot") + 1]).toBe("off");
});
