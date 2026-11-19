import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildChatRequest, runChat } from "../../server/chat";
import { initBudget, readBudget } from "./budget";
import {
  inspectApiKey,
  resolveAnthropicMessagesUrl,
  resolveOpenAiCompletionsUrl,
  runAnthropicCompatible,
  runHarnessCommand,
  runOpenAiCompatible,
} from "./http-provider";
import { restrictedArgs } from "./restricted-claude";
import { selectedAgent } from "./selected-agent";
import { wikiFixture } from "./test-fixture";

const tempDirs: string[] = [];
const fixtures: ReturnType<typeof wikiFixture>[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  for (const f of fixtures.splice(0)) f.cleanup();
});

function sseResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { "content-type": "text/event-stream" } });
}

describe("http-provider URL & API key inspection", () => {
  it("normalizes OpenAI-compatible and Anthropic-compatible endpoints cleanly", () => {
    expect(resolveOpenAiCompletionsUrl("https://api.deepseek.com")).toBe(
      "https://api.deepseek.com/v1/chat/completions",
    );
    expect(resolveOpenAiCompletionsUrl("https://api.deepseek.com/v1")).toBe(
      "https://api.deepseek.com/v1/chat/completions",
    );
    expect(resolveOpenAiCompletionsUrl("http://127.0.0.1:8000/v1/chat/completions")).toBe(
      "http://127.0.0.1:8000/v1/chat/completions",
    );
    expect(resolveAnthropicMessagesUrl("http://127.0.0.1:3456")).toBe("http://127.0.0.1:3456/v1/messages");
    expect(resolveAnthropicMessagesUrl("https://api.deepseek.com/anthropic")).toBe(
      "https://api.deepseek.com/anthropic/v1/messages",
    );
    expect(resolveAnthropicMessagesUrl("https://api.anthropic.com/v1/messages")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
  });

  it("inspectApiKey returns only env var name and boolean hasApiKey, never secret values", () => {
    const secret = "sk-super-secret-value-never-expose-999";
    const env = { DEEPSEEK_API_KEY: secret, ANTHROPIC_AUTH_TOKEN: secret };
    const ds = inspectApiKey("openai-compatible", undefined, "https://api.deepseek.com", env);
    expect(ds).toEqual({ apiKeyEnv: "DEEPSEEK_API_KEY", hasApiKey: true });
    expect(JSON.stringify(ds)).not.toContain(secret);

    const ant = inspectApiKey("anthropic-compatible", "ANTHROPIC_AUTH_TOKEN", "http://127.0.0.1:3456", env);
    expect(ant).toEqual({ apiKeyEnv: "ANTHROPIC_AUTH_TOKEN", hasApiKey: true });
    expect(JSON.stringify(ant)).not.toContain(secret);

    const missing = inspectApiKey("openai-compatible", "CUSTOM_MISSING_KEY", "https://api.example.com", {});
    expect(missing).toEqual({ apiKeyEnv: "CUSTOM_MISSING_KEY", hasApiKey: false });
  });
});

describe("openai-compatible provider", () => {
  it("streams SSE deltas and reports usage + answered model", async () => {
    let seenAuth = "";
    let seenUrl = "";
    let seenStream = false;
    const fetchImpl: typeof fetch = async (input, init) => {
      seenUrl = String(input);
      seenAuth = new Headers(init?.headers).get("authorization") ?? "";
      const body = JSON.parse(String(init?.body));
      seenStream = body.stream;
      expect(body.model).toBe("deepseek-chat");
      expect(body.messages[0].role).toBe("system");
      expect(body.messages[1].role).toBe("user");
      return sseResponse([
        'data: {"model":"deepseek-chat-v3","choices":[{"delta":{"content":"你好，"}}]}\n\n',
        'data: {"model":"deepseek-chat-v3","choices":[{"delta":{"content":"KV cache"}}]}\n\n',
        'data: {"usage":{"prompt_tokens":42,"completion_tokens":13}}\n\n',
        "data: [DONE]\n\n",
      ]);
    };

    const chunks: string[] = [];
    const outcome = await runOpenAiCompatible(
      {
        id: "t1",
        cwd: process.cwd(),
        provider: "openai-compatible",
        model: "deepseek-chat",
        apiBaseUrl: "https://api.deepseek.com/v1",
        apiKeyEnv: "DEEPSEEK_API_KEY",
        args: ["--system-prompt", "system rules"],
        stdin: "what is kv cache?",
        timeoutMs: 5000,
        allowedWrites: [],
      },
      { text: (c) => chunks.push(c) },
      { stream: true, fetchImpl, env: { DEEPSEEK_API_KEY: "sk-test-token" } },
    );

    expect(seenUrl).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(seenAuth).toBe("Bearer sk-test-token");
    expect(seenStream).toBe(true);
    expect(chunks.join("")).toBe("你好，KV cache");
    expect(outcome).toMatchObject({
      ok: true,
      usage: { input_tokens: 42, output_tokens: 13 },
      models: { requested: "deepseek-chat", answered: ["deepseek-chat-v3"], switches: [] },
    });
  });

  it("supports non-streaming JSON mode and allows keyless loopback Ollama/vLLM endpoints", async () => {
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toBe("http://127.0.0.1:11434/v1/chat/completions");
      expect(new Headers(init?.headers).get("authorization")).toBeNull();
      return new Response(
        JSON.stringify({
          model: "qwen3:32b",
          choices: [{ message: { content: '{"ok":true}' } }],
          usage: { prompt_tokens: 15, completion_tokens: 4 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const chunks: string[] = [];
    const outcome = await runOpenAiCompatible(
      {
        id: "t2",
        cwd: process.cwd(),
        provider: "openai-compatible",
        model: "qwen3:32b",
        apiBaseUrl: "http://127.0.0.1:11434",
        args: ["--system-prompt", "json only"],
        stdin: "ping",
        timeoutMs: 5000,
        allowedWrites: [],
      },
      { text: (c) => chunks.push(c) },
      { stream: false, fetchImpl, env: {} },
    );

    expect(outcome.ok).toBe(true);
    expect(chunks.join("")).toBe('{"ok":true}');
    expect(outcome.usage).toEqual({ input_tokens: 15, output_tokens: 4 });
  });

  it("fails fast without calling fetch when a non-loopback endpoint lacks an API key", async () => {
    let called = false;
    const outcome = await runOpenAiCompatible(
      {
        id: "t3",
        cwd: process.cwd(),
        provider: "openai-compatible",
        model: "deepseek-chat",
        apiBaseUrl: "https://api.deepseek.com/v1",
        apiKeyEnv: "MISSING_DS_KEY",
        args: [],
        stdin: "hello",
        timeoutMs: 5000,
        allowedWrites: [],
      },
      { text: () => {} },
      {
        fetchImpl: async () => {
          called = true;
          return new Response("unexpected", { status: 500 });
        },
        env: {},
      },
    );
    expect(called).toBe(false);
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toContain("MISSING_DS_KEY");
  });
});

describe("anthropic-compatible provider (CCR / DeepSeek /anthropic)", () => {
  it("streams SSE content_block_delta events and sends x-api-key + anthropic-version headers", async () => {
    let seenHeaders: Headers | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      expect(String(input)).toBe("https://api.deepseek.com/anthropic/v1/messages");
      seenHeaders = new Headers(init?.headers);
      const body = JSON.parse(String(init?.body));
      expect(body.system).toBe("rules");
      expect(body.stream).toBe(true);
      return sseResponse([
        'event: message_start\ndata: {"type":"message_start","message":{"model":"deepseek-chat","usage":{"input_tokens":20,"output_tokens":0}}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"第一段"}}\n\n',
        'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"第二段"}}\n\n',
        'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":9}}\n\n',
      ]);
    };

    const chunks: string[] = [];
    const outcome = await runAnthropicCompatible(
      {
        id: "a1",
        cwd: process.cwd(),
        provider: "anthropic-compatible",
        model: "deepseek-chat",
        apiBaseUrl: "https://api.deepseek.com/anthropic",
        apiKeyEnv: "DEEPSEEK_API_KEY",
        anthropicVersion: "2023-06-01",
        args: ["--system-prompt", "rules"],
        stdin: "explain",
        timeoutMs: 5000,
        allowedWrites: [],
      },
      { text: (c) => chunks.push(c) },
      { stream: true, fetchImpl, env: { DEEPSEEK_API_KEY: "sk-ds-ant" } },
    );

    expect(seenHeaders?.get("x-api-key")).toBe("sk-ds-ant");
    expect(seenHeaders?.get("anthropic-version")).toBe("2023-06-01");
    expect(chunks.join("")).toBe("第一段第二段");
    expect(outcome).toMatchObject({
      ok: true,
      usage: { input_tokens: 20, output_tokens: 9 },
      models: { requested: "deepseek-chat", answered: ["deepseek-chat"], switches: [] },
    });
  });

  it("supports keyless loopback CCR router http://127.0.0.1:3456 in non-streaming JSON mode", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      expect(String(input)).toBe("http://127.0.0.1:3456/v1/messages");
      return new Response(
        JSON.stringify({
          model: "openrouter,qwen/qwen3-coder",
          content: [{ type: "text", text: '{"answer":"from-ccr"}' }],
          usage: { input_tokens: 11, output_tokens: 6 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const chunks: string[] = [];
    const outcome = await runAnthropicCompatible(
      {
        id: "a2",
        cwd: process.cwd(),
        provider: "anthropic-compatible",
        model: "openrouter,qwen/qwen3-coder",
        apiBaseUrl: "http://127.0.0.1:3456",
        args: [],
        stdin: "ping",
        timeoutMs: 5000,
        allowedWrites: [],
      },
      { text: (c) => chunks.push(c) },
      { stream: false, fetchImpl, env: {} },
    );
    expect(outcome.ok).toBe(true);
    expect(chunks.join("")).toBe('{"answer":"from-ccr"}');
  });
});

describe("custom harness provider (shell: false, stdin -> stdout)", () => {
  it("executes a real node script via stdin -> stdout without shell interpolation", async () => {
    const dir = mkdtempSync(join(tmpdir(), "wiki-harness-test-"));
    tempDirs.push(dir);
    const script = join(dir, "echo-harness.mjs");
    writeFileSync(
      script,
      [
        'let buf = "";',
        'process.stdin.setEncoding("utf8");',
        'process.stdin.on("data", (c) => { buf += c; });',
        'process.stdin.on("end", () => {',
        "  process.stdout.write(JSON.stringify({ received: buf.trim(), model: process.env.WIKI_MODEL }));",
        "});",
      ].join("\n"),
    );

    const chunks: string[] = [];
    const outcome = await runHarnessCommand(
      {
        id: "h1",
        cwd: dir,
        provider: "harness",
        model: "deepseek-harness",
        harnessCommand: { command: process.execPath, args: [script] },
        args: ["--system-prompt", "SYS"],
        stdin: "PROMPT_BODY",
        timeoutMs: 10_000,
        allowedWrites: [],
      },
      { text: (c) => chunks.push(c) },
    );

    expect(outcome.ok).toBe(true);
    const parsed = JSON.parse(chunks.join(""));
    expect(parsed.model).toBe("deepseek-harness");
    expect(parsed.received).toContain("SYS");
    expect(parsed.received).toContain("PROMPT_BODY");
  });

  it("surfaces non-zero exit codes cleanly and rejects missing harnessCommand", async () => {
    const missing = await runHarnessCommand(
      {
        id: "h-missing",
        cwd: process.cwd(),
        provider: "harness",
        args: [],
        stdin: "hi",
        timeoutMs: 5000,
        allowedWrites: [],
      },
      { text: () => {} },
    );
    expect(missing.ok).toBe(false);
    expect(missing.reason).toContain("harnessCommand.command");

    const failed = await runHarnessCommand(
      {
        id: "h-fail",
        cwd: process.cwd(),
        provider: "harness",
        harnessCommand: {
          command: process.execPath,
          args: ["-e", 'process.stderr.write("boom"); process.exit(3);'],
        },
        args: [],
        stdin: "hi",
        timeoutMs: 10_000,
        allowedWrites: [],
      },
      { text: () => {} },
    );
    expect(failed.ok).toBe(false);
    expect(failed.reason).toContain("harness exit 3");
    expect(failed.reason).toContain("boom");
  });

  it("integrates harness end-to-end through selectedAgent, budget ledger (external billing), and server chat", async () => {
    const f = wikiFixture();
    fixtures.push(f);
    const script = join(f.root, "harness-echo.mjs");
    writeFileSync(
      script,
      [
        'let buf = "";',
        'process.stdin.setEncoding("utf8");',
        'process.stdin.on("data", (c) => { buf += c; });',
        'process.stdin.on("end", () => {',
        '  if (buf.includes("CHAT_TURN")) process.stdout.write("来自自定义 Harness 的回答");',
        "  else process.stdout.write(JSON.stringify({ ok: true, len: buf.length }));",
        "});",
      ].join("\n"),
    );
    f.write(
      "wiki/sync.config.local.json",
      JSON.stringify({
        chatProvider: "harness",
        chatModel: "my-local-harness",
        harnessCommand: { command: process.execPath, args: [script] },
      }),
    );
    await initBudget(f.root, { limitUsd: 1, priorChargedUsd: 0, reserveUsd: 0.5, maxCalls: 10 });

    const res = await selectedAgent(
      f.root,
      "drop-extract",
    )({
      id: "h-agent",
      cwd: f.root,
      args: restrictedArgs("rules", 0.5),
      stdin: "evidence payload",
      timeoutMs: 10_000,
      allowedWrites: [],
    });
    expect(res.ok).toBe(true);
    expect(res.billing).toBe("external");
    expect(JSON.parse(res.output!)).toMatchObject({ ok: true });
    expect(readBudget(f.root).calls[0]).toMatchObject({ billing: "external", state: "finished" });

    const chatReq = buildChatRequest(
      { message: "CHAT_TURN: 什么是 KV cache?" },
      { reading: "reading", citable: "citable", query: "query" },
      {
        wikiRoot: join(f.root, "wiki"),
        provider: "harness",
        model: "my-local-harness",
        harnessCommand: { command: process.execPath, args: [script] },
        timeoutMs: 10_000,
        pages: [{ file: "concepts/kv.md", text: "KV cache body" }],
      },
    );
    const streamed: string[] = [];
    const chatRes = await runChat(chatReq, { text: (chunk) => streamed.push(chunk) });
    expect(chatRes.ok).toBe(true);
    expect(streamed.join("")).toBe("来自自定义 Harness 的回答");
  });
});
