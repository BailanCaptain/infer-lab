import { writeFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { CHAT_MODELS, DEFAULT_CODEX_MODEL } from "../src/content/wiki/chat-models";
import { buildChatRequest } from "./chat";
import {
  CODEX_EVIDENCE_LIMIT,
  codexArgs,
  codexEvidencePages,
  parseCodexLine,
  resolveCodexCommand,
  runCodexChat,
} from "./codex-chat";

it("uses the configured executable even when PATH selects another CLI, and never hides an invalid override", async () => {
  const req = buildChatRequest(
    { message: "q" },
    { reading: "", citable: "", query: "" },
    {
      wikiRoot: "snapshot",
      provider: "codex",
      timeoutMs: 1000,
      codexCli: process.execPath,
    },
  );
  expect(req.codexCli).toBe(process.execPath);
  vi.mocked(spawnClaude).mockImplementationOnce(async (request, onLine, cmd) => {
    expect(cmd?.command).toBe(process.execPath);
    const outIdx = request.args.indexOf("--output-last-message");
    if (outIdx >= 0) writeFileSync(request.args[outIdx + 1]!, "ok");
    onLine(JSON.stringify({ type: "turn.completed" }));
    return { id: request.id, ok: true, exitCode: 0, stderrTail: "" };
  });
  expect((await runCodexChat(req, { text: vi.fn() })).ok).toBe(true);
  expect(() => resolveCodexCommand({ ...process.env, CODEX_CLI: "missing-codex.exe" })).toThrow("CODEX_CLI");
});

import { spawnClaude } from "../scripts/wiki/claude-cli";

vi.mock("../scripts/wiki/claude-cli", () => ({ spawnClaude: vi.fn() }));

it("reports a subprocess timeout instead of replacing it with an unrelated stderr warning", async () => {
  vi.stubEnv("CODEX_CLI", process.execPath);
  try {
    vi.mocked(spawnClaude).mockResolvedValue({
      id: "chat",
      ok: false,
      exitCode: null,
      reason: "timeout 300000ms",
      stderrTail: "WARN shell_snapshot: Shell snapshot not supported yet for PowerShell",
    });
    const req = buildChatRequest(
      { message: "q" },
      { reading: "", citable: "", query: "" },
      { wikiRoot: ".", provider: "codex", timeoutMs: 300000 },
    );
    expect(await runCodexChat(req, { text: vi.fn() }, true)).toMatchObject({
      ok: false,
      reason: "timeout 300000ms",
    });
  } finally {
    vi.unstubAllEnvs();
  }
});

it("Codex uses isolated, ephemeral, read-only execution and injected evidence, never Claude resume", () => {
  const req = buildChatRequest(
    { message: "问题", sessionId: "old-claude-session", previousQuestions: ["前问"] },
    { reading: "reading", citable: "citable", query: "query" },
    {
      wikiRoot: ".",
      timeoutMs: 1000,
      provider: "codex",
      model: "gpt-6.2-sol",
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
        const outIdx = req.args.indexOf("--output-last-message");
        if (outIdx >= 0) writeFileSync(req.args[outIdx + 1]!, "ok");
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
    const req = buildChatRequest(
      { message: "q" },
      { reading: "", citable: "", query: "" },
      { wikiRoot: ".", provider: "codex", timeoutMs: 1000 },
    );
    expect(await runCodexChat(req, { text: vi.fn() }, true)).toMatchObject({
      ok: false,
      reason: "受限编译出现工具调用：command_execution",
    });
  } finally {
    vi.unstubAllEnvs();
  }
});

it("configuration warning items are not tools or terminal failures", async () => {
  vi.stubEnv("CODEX_CLI", process.execPath);
  try {
    vi.mocked(spawnClaude).mockImplementation(async (req, onLine) => {
      onLine(
        JSON.stringify({
          type: "item.completed",
          item: { type: "error", message: "Code Mode is unavailable because code-mode host is disabled." },
        }),
      );
      onLine(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "result" } }));
      onLine(JSON.stringify({ type: "turn.completed" }));
      const output = req.args.indexOf("--output-last-message");
      if (output >= 0) writeFileSync(req.args[output + 1]!, "result");
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
    });
    const req = buildChatRequest(
      { message: "q" },
      { reading: "", citable: "", query: "" },
      { wikiRoot: ".", provider: "codex", timeoutMs: 1000 },
    );
    const text = vi.fn();
    expect((await runCodexChat(req, { text }, true)).ok).toBe(true);
    expect(text).toHaveBeenCalledWith("result");
  } finally {
    vi.unstubAllEnvs();
  }
});

it("tool-free callers receive only the CLI final response, never progress concatenated with JSON", async () => {
  vi.stubEnv("CODEX_CLI", process.execPath);
  try {
    vi.mocked(spawnClaude).mockImplementation(async (req, onLine) => {
      onLine(
        JSON.stringify({
          type: "item.completed",
          item: { type: "agent_message", text: "我会核对三页正文中的跨页关系。" },
        }),
      );
      onLine(
        JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: '{"relations":[]}' } }),
      );
      onLine(JSON.stringify({ type: "turn.completed" }));
      const output = req.args.indexOf("--output-last-message");
      if (output >= 0) writeFileSync(req.args[output + 1]!, '{"relations":[]}');
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
    });
    const req = buildChatRequest(
      { message: "q" },
      { reading: "", citable: "", query: "" },
      { wikiRoot: ".", provider: "codex", timeoutMs: 1000 },
    );
    const text = vi.fn();
    expect((await runCodexChat(req, { text }, true)).ok).toBe(true);
    expect(text.mock.calls).toEqual([['{"relations":[]}']]);
  } finally {
    vi.unstubAllEnvs();
  }
});

it("upgrades Codex model list to gpt-6.2-sol default while retaining 6.2-astra, 6.1-sol, 6-astra, 6-sol", () => {
  expect(DEFAULT_CODEX_MODEL).toBe("gpt-6.2-sol");
  expect(CHAT_MODELS.codex).toEqual([
    "gpt-6.2-sol",
    "gpt-6.2-astra",
    "gpt-6.1-sol",
    "gpt-6-astra",
    "gpt-6-sol",
  ]);
});

it("supports configurable reasoningEffort while defaulting to low when unset", () => {
  expect(codexArgs("gpt-6.2-sol", true)).toContain('model_reasoning_effort="low"');
  expect(codexArgs("gpt-6.2-astra", false, { reasoningEffort: "xhigh" })).toContain(
    'model_reasoning_effort="xhigh"',
  );
  const req = buildChatRequest(
    { message: "q" },
    { reading: "", citable: "", query: "" },
    { wikiRoot: ".", provider: "codex", model: "gpt-6.2-astra", reasoningEffort: "max", timeoutMs: 1000 },
  );
  expect(req.args).toContain('model_reasoning_effort="max"');
});

it("bounds codexEvidencePages by UTF-8 byte length rather than UTF-16 code units", () => {
  const small = { file: "concepts/small.md", text: "ok" };
  // Each CJK char is 1 UTF-16 code unit but 3 UTF-8 bytes: half of CODEX_EVIDENCE_LIMIT chars = 1.5x limit in UTF-8 bytes
  const cjkCharCount = Math.floor(CODEX_EVIDENCE_LIMIT / 2);
  const oversizedMultiByte = { file: "concepts/cjk.md", text: "汉".repeat(cjkCharCount) };
  expect(oversizedMultiByte.text.length).toBeLessThan(CODEX_EVIDENCE_LIMIT);
  expect(Buffer.byteLength(oversizedMultiByte.text, "utf8")).toBeGreaterThan(CODEX_EVIDENCE_LIMIT);
  expect(codexEvidencePages([oversizedMultiByte, small])).toEqual([small]);
});

it("surfaces authoritative finalAnswer in chat mode when progress agent_message precedes web_search", async () => {
  vi.stubEnv("CODEX_CLI", process.execPath);
  try {
    vi.mocked(spawnClaude).mockImplementation(async (req, onLine) => {
      const outIdx = req.args.indexOf("--output-last-message");
      expect(outIdx).toBeGreaterThanOrEqual(0);
      onLine(
        JSON.stringify({
          type: "item.completed",
          item: { type: "agent_message", text: "我先搜索官方文档核对版本细节。" },
        }),
      );
      onLine(JSON.stringify({ type: "item.completed", item: { type: "web_search", query: "vllm ascend" } }));
      onLine(
        JSON.stringify({
          type: "item.completed",
          item: { type: "agent_message", text: "默认值为 1，见 [A](sources/a.md)。" },
        }),
      );
      onLine(JSON.stringify({ type: "turn.completed" }));
      writeFileSync(req.args[outIdx + 1]!, "默认值为 1，见 [A](sources/a.md)。");
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
    });
    const req = buildChatRequest(
      { message: "q" },
      { reading: "", citable: "", query: "" },
      { wikiRoot: ".", provider: "codex", timeoutMs: 1000 },
    );
    const streamed: string[] = [];
    const res = await runCodexChat(req, { text: (t) => streamed.push(t) });
    expect(res.ok).toBe(true);
    expect((res as { finalAnswer?: string }).finalAnswer).toBe("默认值为 1，见 [A](sources/a.md)。");
  } finally {
    vi.unstubAllEnvs();
  }
});

it("fails with ok:false when --output-last-message file is missing or empty instead of returning progress chatter", async () => {
  vi.stubEnv("CODEX_CLI", process.execPath);
  try {
    // Missing final file despite progress agent_message
    vi.mocked(spawnClaude).mockImplementationOnce(async (req, onLine) => {
      onLine(
        JSON.stringify({
          type: "item.completed",
          item: { type: "agent_message", text: "我先搜索官方文档核对一下。" },
        }),
      );
      onLine(JSON.stringify({ type: "turn.completed" }));
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
    });
    const req = buildChatRequest(
      { message: "q" },
      { reading: "", citable: "", query: "" },
      { wikiRoot: ".", provider: "codex", timeoutMs: 1000 },
    );
    const missingRes = await runCodexChat(req, { text: vi.fn() });
    expect(missingRes.ok).toBe(false);
    expect((missingRes as { finalAnswer?: string }).finalAnswer).toBeUndefined();

    // Empty / whitespace-only final file
    vi.mocked(spawnClaude).mockImplementationOnce(async (req, onLine) => {
      const outIdx = req.args.indexOf("--output-last-message");
      onLine(
        JSON.stringify({
          type: "item.completed",
          item: { type: "agent_message", text: "仍在检索中..." },
        }),
      );
      onLine(JSON.stringify({ type: "turn.completed" }));
      if (outIdx >= 0) writeFileSync(req.args[outIdx + 1]!, "   \n  ");
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
    });
    const emptyRes = await runCodexChat(req, { text: vi.fn() });
    expect(emptyRes.ok).toBe(false);
    expect((emptyRes as { finalAnswer?: string }).finalAnswer).toBeUndefined();

    // Tool-free mode with empty final file also returns ok:false
    vi.mocked(spawnClaude).mockImplementationOnce(async (req, onLine) => {
      const outIdx = req.args.indexOf("--output-last-message");
      onLine(JSON.stringify({ type: "turn.completed" }));
      if (outIdx >= 0) writeFileSync(req.args[outIdx + 1]!, "   ");
      return { id: req.id, ok: true, exitCode: 0, stderrTail: "" };
    });
    const emptyToolFree = await runCodexChat(req, { text: vi.fn() }, true);
    expect(emptyToolFree.ok).toBe(false);
  } finally {
    vi.unstubAllEnvs();
  }
});
