import { expect, it, vi } from "vitest";
import { buildChatRequest } from "./chat";
import { parseCodexLine } from "./codex-chat";
import { runCodexChat } from "./codex-chat";
import { spawnClaude } from "../scripts/wiki/claude-cli";

vi.mock("../scripts/wiki/claude-cli", () => ({ spawnClaude: vi.fn() }));

it("Codex uses isolated, ephemeral, read-only execution and injected evidence, never Claude resume", () => {
  const req = buildChatRequest(
    { message: "问题", sessionId: "old-claude-session", previousQuestions: ["前问"] },
    { reading: "reading", citable: "citable", query: "query" },
    {
      wikiRoot: ".",
      timeoutMs: 1000,
      provider: "codex",
      model: "gpt-6.1-sol",
      pages: [{ file: "concepts/a.md", text: "本轮证据" }],
    },
  );
  expect(req.provider).toBe("codex");
  expect(req.args).toEqual(
    expect.arrayContaining([
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "read-only",
      "features.shell_tool=false",
      'forced_login_method="chatgpt"',
    ]),
  );
  expect(req.args).not.toContain("--resume");
  expect(req.args).not.toContain("--max-budget-usd");
  expect(req.stdin).toContain("本轮证据");
  expect(req.stdin).toContain("前问");
});

it.each([0, 1, 2])(
  "accepts exactly one completed turn (received %s), no fabricated cost/model receipt",
  async (count) => {
    vi.stubEnv("CODEX_CLI", process.execPath);
    try {
      vi.mocked(spawnClaude).mockImplementation(async (req, onLine, cmd) => {
        expect(cmd?.shell).toBe(false);
        expect(req.cwd).not.toBe("original-snapshot");
        for (let i = 0; i < count; i++) onLine(JSON.stringify({ type: "turn.completed" }));
        return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
      });
      const req = buildChatRequest(
        { message: "q" },
        { reading: "", citable: "", query: "" },
        { wikiRoot: "original-snapshot", provider: "codex", timeoutMs: 1000 },
      );
      const result = await runCodexChat(req, { text: vi.fn() });
      expect(result.ok).toBe(count === 1);
      expect(result).not.toHaveProperty("costUsd");
      expect(result.models.answered).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
  },
);

it("parses final message, web search, usage and failures without exposing reasoning", () => {
  const text = vi.fn();
  const tool = vi.fn();
  const parse = (event: unknown) => parseCodexLine(JSON.stringify(event), { text, tool });
  parse({ type: "item.completed", item: { type: "reasoning", text: "private" } });
  parse({ type: "item.completed", item: { type: "agent_message", text: "answer" } });
  parse({ type: "item.completed", item: { type: "web_search", query: "docs" } });
  expect(text.mock.calls).toEqual([["answer"]]);
  expect(tool).toHaveBeenCalledWith("WebSearch", "docs");
  expect(
    parse({ type: "turn.completed", usage: { input_tokens: 10, cached_input_tokens: 5, output_tokens: 2 } }),
  ).toMatchObject({ completed: true, usage: { input_tokens: 10, output_tokens: 2 } });
  expect(parse({ type: "turn.failed", error: { message: "quota exceeded" } })).toMatchObject({
    error: "quota exceeded",
  });
});

it("tool-free compilation rejects tool events even if the turn later completes", async () => {
  vi.stubEnv("CODEX_CLI", process.execPath);
  try {
    vi.mocked(spawnClaude).mockImplementation(async (req, onLine) => {
      onLine(JSON.stringify({ type: "item.started", item: { type: "command_execution", command: "bad" } }));
      onLine(JSON.stringify({ type: "turn.completed" }));
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
    });
    const req = buildChatRequest({ message: "q" }, { reading: "", citable: "", query: "" }, { wikiRoot: ".", provider: "codex", timeoutMs: 1000 });
    expect(await runCodexChat(req, { text: vi.fn() }, true)).toMatchObject({ ok: false, reason: "受限编译出现工具调用：command_execution" });
  } finally { vi.unstubAllEnvs(); }
});

it("configuration warning items are not tools or terminal failures", async () => {
  vi.stubEnv("CODEX_CLI", process.execPath);
  try {
    vi.mocked(spawnClaude).mockImplementation(async (req, onLine) => {
      onLine(JSON.stringify({ type: "item.completed", item: { type: "error", message: "Code Mode is unavailable because code-mode host is disabled." } }));
      onLine(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "result" } }));
      onLine(JSON.stringify({ type: "turn.completed" }));
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
    });
    const req = buildChatRequest({ message: "q" }, { reading: "", citable: "", query: "" }, { wikiRoot: ".", provider: "codex", timeoutMs: 1000 });
    const text = vi.fn();
    expect((await runCodexChat(req, { text }, true)).ok).toBe(true);
    expect(text).toHaveBeenCalledWith("result");
  } finally { vi.unstubAllEnvs(); }
});
