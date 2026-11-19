/**
 * Zero-CLI 开源模型与自定义 Harness 适配层（纯 Node 内置 fetch / spawn，零额外依赖）：
 * 1. "openai-compatible"：OpenAI 协议 `/v1/chat/completions`（DeepSeek / Qwen / GLM / vLLM / Ollama / LiteLLM）
 * 2. "anthropic-compatible"：Anthropic 协议 `/v1/messages`（直连本地 CCR 路由 http://127.0.0.1:3456 或 DeepSeek /anthropic）
 * 3. "harness"：自定义命令行 Harness（`shell: false`，stdin 传入提示词，stdout 返回流式/完整响应）
 */
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { ChatProvider } from "../../src/content/wiki/chat-models";
import type { AgentRequest } from "./batch";
import { killTree, resolveWindowsCmdShim } from "./claude-cli";
import type { ModelUse } from "./model-use";

export interface ProviderCallbacks {
  text: (chunk: string) => void;
}

export interface ProviderOutcome {
  ok: boolean;
  usage?: { input_tokens: number; output_tokens: number; cached_input_tokens?: number };
  models?: ModelUse;
  reason?: string;
}

export interface HttpRunOptions {
  stream?: boolean;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
  env?: NodeJS.ProcessEnv;
}

export const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 8192;

function isLoopbackUrl(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

export function resolveOpenAiCompletionsUrl(baseUrl?: string, env: NodeJS.ProcessEnv = process.env): string {
  const raw = (baseUrl?.trim() || env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(
    /\/+$/,
    "",
  );
  if (/\/chat\/completions$/i.test(raw)) return raw;
  if (/\/v\d+(?:[a-z0-9-]*)?$/i.test(raw)) return `${raw}/chat/completions`;
  return `${raw}/v1/chat/completions`;
}

export function resolveAnthropicMessagesUrl(baseUrl?: string, env: NodeJS.ProcessEnv = process.env): string {
  const raw = (baseUrl?.trim() || env.ANTHROPIC_BASE_URL?.trim() || "https://api.anthropic.com").replace(
    /\/+$/,
    "",
  );
  if (/\/messages$/i.test(raw)) return raw;
  if (/\/v\d+$/i.test(raw)) return `${raw}/messages`;
  return `${raw}/v1/messages`;
}

export function defaultApiKeyEnvCandidates(provider: ChatProvider, apiBaseUrl?: string): string[] {
  if (provider === "openai-compatible") {
    return apiBaseUrl && /deepseek/i.test(apiBaseUrl)
      ? ["DEEPSEEK_API_KEY", "OPENAI_API_KEY"]
      : ["OPENAI_API_KEY", "DEEPSEEK_API_KEY"];
  }
  if (provider === "anthropic-compatible") {
    return ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY"];
  }
  return [];
}

/**
 * 供 GET `/api/wiki/status` 使用的安全密钥状态检查：只返回环境变量名与布尔 `hasApiKey`，绝不暴露原始密钥值。
 */
export function inspectApiKey(
  provider: ChatProvider,
  apiKeyEnv?: string,
  apiBaseUrl?: string,
  env: NodeJS.ProcessEnv = process.env,
): { apiKeyEnv?: string; hasApiKey: boolean } {
  if (apiKeyEnv) {
    return { apiKeyEnv, hasApiKey: Boolean(env[apiKeyEnv]?.trim()) };
  }
  const candidates = defaultApiKeyEnvCandidates(provider, apiBaseUrl);
  for (const name of candidates) {
    if (env[name]?.trim()) return { apiKeyEnv: name, hasApiKey: true };
  }
  return { ...(candidates[0] ? { apiKeyEnv: candidates[0] } : {}), hasApiKey: false };
}

function resolveApiKey(
  provider: "openai-compatible" | "anthropic-compatible",
  apiKeyEnv: string | undefined,
  url: string,
  env: NodeJS.ProcessEnv,
): { key?: string; envName?: string; error?: string } {
  const info = inspectApiKey(provider, apiKeyEnv, url, env);
  const raw = info.apiKeyEnv ? env[info.apiKeyEnv]?.trim() : undefined;
  if (raw) return { key: raw, envName: info.apiKeyEnv };
  // Local loopback gateways (Ollama / local vLLM / local CCR without auth) may operate without a key.
  if (isLoopbackUrl(url)) return { envName: info.apiKeyEnv };
  return {
    envName: info.apiKeyEnv,
    error: `未检测到环境变量 ${info.apiKeyEnv ?? "API_KEY"}；请先在启动后端的终端设置对应环境变量（切勿把明文密钥写入仓库配置文件）`,
  };
}

function createAbortWithTimeout(
  timeoutMs: number,
  parent?: AbortSignal,
): { signal: AbortSignal; timedOut: () => boolean; dispose: () => void } {
  const controller = new AbortController();
  let isTimeout = false;
  const onParentAbort = () => controller.abort(parent?.reason);
  if (parent) {
    if (parent.aborted) controller.abort(parent.reason);
    else parent.addEventListener("abort", onParentAbort, { once: true });
  }
  const timer = setTimeout(() => {
    isTimeout = true;
    controller.abort(new Error(`timeout ${timeoutMs}ms`));
  }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => isTimeout,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onParentAbort);
    },
  };
}

function extractSystemAndPrompt(req: AgentRequest): { system: string; prompt: string } {
  if (req.systemPrompt !== undefined) return { system: req.systemPrompt, prompt: req.stdin };
  const sysIdx = req.args.indexOf("--system-prompt");
  if (sysIdx >= 0 && typeof req.args[sysIdx + 1] === "string") {
    return { system: req.args[sysIdx + 1]!, prompt: req.stdin };
  }
  const appendIdx = req.args.indexOf("--append-system-prompt");
  if (appendIdx >= 0 && typeof req.args[appendIdx + 1] === "string") {
    return { system: req.args[appendIdx + 1]!, prompt: req.stdin };
  }
  return { system: "", prompt: req.stdin };
}

function toInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
}

function extractOpenAiContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && (part as { type?: unknown }).type === "text") {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join("");
  }
  return "";
}

async function consumeSseLines(
  body: ReadableStream<Uint8Array>,
  onLine: (line: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline >= 0) {
        onLine(buffer.slice(0, newline).replace(/\r$/, ""));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    }
    buffer += decoder.decode();
    if (buffer.length > 0) onLine(buffer.replace(/\r$/, ""));
  } finally {
    reader.releaseLock();
  }
}

export async function runOpenAiCompatible(
  req: AgentRequest,
  on: ProviderCallbacks,
  options: HttpRunOptions = {},
): Promise<ProviderOutcome> {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  const model = req.model?.trim() || "deepseek-chat";
  const url = resolveOpenAiCompletionsUrl(req.apiBaseUrl, env);
  const auth = resolveApiKey("openai-compatible", req.apiKeyEnv, url, env);
  if (auth.error)
    return { ok: false, reason: auth.error, models: { requested: model, answered: [], switches: [] } };

  const { system, prompt } = extractSystemAndPrompt(req);
  const stream = options.stream === true;
  const messages: { role: "system" | "user"; content: string }[] = [];
  if (system.trim()) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth.key) headers.authorization = `Bearer ${auth.key}`;

  const guard = createAbortWithTimeout(req.timeoutMs, req.signal);
  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      }),
      signal: guard.signal,
    });
    if (!response.ok) {
      const errText = (await response.text().catch(() => "")).slice(0, 2000).trim();
      return {
        ok: false,
        reason: `OpenAI 兼容接口返回 HTTP ${response.status}${errText ? `：${errText}` : ""}`,
        models: { requested: model, answered: [], switches: [] },
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!stream || contentType.includes("application/json")) {
      const data = (await response.json()) as {
        model?: unknown;
        choices?: { message?: { content?: unknown }; text?: unknown }[];
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
        error?: { message?: unknown };
      };
      if (data.error?.message) {
        return {
          ok: false,
          reason: `OpenAI 兼容接口错误：${String(data.error.message).slice(0, 1000)}`,
          models: { requested: model, answered: [], switches: [] },
        };
      }
      const choice = data.choices?.[0];
      const text = extractOpenAiContent(choice?.message?.content ?? choice?.text);
      if (!text.trim()) {
        return {
          ok: false,
          reason: "OpenAI 兼容接口未返回有效文本内容",
          models: { requested: model, answered: [], switches: [] },
        };
      }
      on.text(text);
      const answered = typeof data.model === "string" && data.model ? [data.model] : [];
      const inputTokens = toInt(data.usage?.prompt_tokens);
      const outputTokens = toInt(data.usage?.completion_tokens);
      return {
        ok: true,
        ...(inputTokens !== undefined && outputTokens !== undefined
          ? { usage: { input_tokens: inputTokens, output_tokens: outputTokens } }
          : {}),
        models: { requested: model, answered, switches: [] },
      };
    }

    if (!response.body) {
      return {
        ok: false,
        reason: "OpenAI 兼容接口流式响应缺少 body",
        models: { requested: model, answered: [], switches: [] },
      };
    }

    let answeredModel: string | undefined;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let emitted = false;
    let streamError: string | undefined;

    await consumeSseLines(response.body, (line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data:")) return;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      let chunk: {
        model?: unknown;
        choices?: { delta?: { content?: unknown }; message?: { content?: unknown } }[];
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
        error?: { message?: unknown };
      };
      try {
        chunk = JSON.parse(payload);
      } catch {
        return;
      }
      if (chunk.error?.message) {
        streamError = String(chunk.error.message).slice(0, 1000);
        return;
      }
      if (typeof chunk.model === "string" && chunk.model && !answeredModel) answeredModel = chunk.model;
      const inTok = toInt(chunk.usage?.prompt_tokens);
      const outTok = toInt(chunk.usage?.completion_tokens);
      if (inTok !== undefined) inputTokens = inTok;
      if (outTok !== undefined) outputTokens = outTok;
      const delta = extractOpenAiContent(
        chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.message?.content,
      );
      if (delta) {
        emitted = true;
        on.text(delta);
      }
    });

    if (streamError) {
      return {
        ok: false,
        reason: `OpenAI 兼容接口流式错误：${streamError}`,
        models: { requested: model, answered: answeredModel ? [answeredModel] : [], switches: [] },
      };
    }
    if (!emitted) {
      return {
        ok: false,
        reason: "OpenAI 兼容接口流式响应未返回文本",
        models: { requested: model, answered: answeredModel ? [answeredModel] : [], switches: [] },
      };
    }
    return {
      ok: true,
      ...(inputTokens !== undefined && outputTokens !== undefined
        ? { usage: { input_tokens: inputTokens, output_tokens: outputTokens } }
        : {}),
      models: { requested: model, answered: answeredModel ? [answeredModel] : [], switches: [] },
    };
  } catch (error) {
    return {
      ok: false,
      reason: req.signal?.aborted
        ? "已取消"
        : guard.timedOut()
          ? `timeout ${req.timeoutMs}ms`
          : `OpenAI 兼容接口请求失败：${error instanceof Error ? error.message : String(error)}`,
      models: { requested: model, answered: [], switches: [] },
    };
  } finally {
    guard.dispose();
  }
}

export async function runAnthropicCompatible(
  req: AgentRequest,
  on: ProviderCallbacks,
  options: HttpRunOptions = {},
): Promise<ProviderOutcome> {
  const env = options.env ?? process.env;
  const fetchFn = options.fetchImpl ?? globalThis.fetch;
  const model = req.model?.trim() || "deepseek-chat";
  const url = resolveAnthropicMessagesUrl(req.apiBaseUrl, env);
  const auth = resolveApiKey("anthropic-compatible", req.apiKeyEnv, url, env);
  if (auth.error)
    return { ok: false, reason: auth.error, models: { requested: model, answered: [], switches: [] } };

  const { system, prompt } = extractSystemAndPrompt(req);
  const stream = options.stream === true;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": req.anthropicVersion?.trim() || DEFAULT_ANTHROPIC_VERSION,
  };
  if (auth.key) {
    headers["x-api-key"] = auth.key;
    if (auth.envName === "ANTHROPIC_AUTH_TOKEN" || isLoopbackUrl(url)) {
      headers.authorization = `Bearer ${auth.key}`;
    }
  }

  const guard = createAbortWithTimeout(req.timeoutMs, req.signal);
  try {
    const response = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(system.trim() ? { system } : {}),
        messages: [{ role: "user", content: prompt }],
        stream,
      }),
      signal: guard.signal,
    });
    if (!response.ok) {
      const errText = (await response.text().catch(() => "")).slice(0, 2000).trim();
      return {
        ok: false,
        reason: `Anthropic 兼容接口返回 HTTP ${response.status}${errText ? `：${errText}` : ""}`,
        models: { requested: model, answered: [], switches: [] },
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!stream || contentType.includes("application/json")) {
      const data = (await response.json()) as {
        model?: unknown;
        content?: { type?: unknown; text?: unknown }[];
        usage?: { input_tokens?: unknown; output_tokens?: unknown; cache_read_input_tokens?: unknown };
        error?: { message?: unknown };
      };
      if (data.error?.message) {
        return {
          ok: false,
          reason: `Anthropic 兼容接口错误：${String(data.error.message).slice(0, 1000)}`,
          models: { requested: model, answered: [], switches: [] },
        };
      }
      const text = (Array.isArray(data.content) ? data.content : [])
        .filter((b) => b?.type === "text" && typeof b.text === "string")
        .map((b) => b.text as string)
        .join("");
      if (!text.trim()) {
        return {
          ok: false,
          reason: "Anthropic 兼容接口未返回有效文本内容",
          models: { requested: model, answered: [], switches: [] },
        };
      }
      on.text(text);
      const answered = typeof data.model === "string" && data.model ? [data.model] : [];
      const inputTokens = toInt(data.usage?.input_tokens);
      const outputTokens = toInt(data.usage?.output_tokens);
      const cachedTokens = toInt(data.usage?.cache_read_input_tokens);
      return {
        ok: true,
        ...(inputTokens !== undefined && outputTokens !== undefined
          ? {
              usage: {
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                ...(cachedTokens !== undefined ? { cached_input_tokens: cachedTokens } : {}),
              },
            }
          : {}),
        models: { requested: model, answered, switches: [] },
      };
    }

    if (!response.body) {
      return {
        ok: false,
        reason: "Anthropic 兼容接口流式响应缺少 body",
        models: { requested: model, answered: [], switches: [] },
      };
    }

    let answeredModel: string | undefined;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    let emitted = false;
    let streamError: string | undefined;

    await consumeSseLines(response.body, (line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(":") || !trimmed.startsWith("data:")) return;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      let ev: {
        type?: unknown;
        message?: { model?: unknown; usage?: { input_tokens?: unknown; output_tokens?: unknown } };
        delta?: { type?: unknown; text?: unknown };
        usage?: { output_tokens?: unknown };
        error?: { message?: unknown };
      };
      try {
        ev = JSON.parse(payload);
      } catch {
        return;
      }
      if (ev.type === "error" || ev.error?.message) {
        streamError = String(ev.error?.message ?? "Anthropic 流式错误").slice(0, 1000);
        return;
      }
      if (ev.type === "message_start") {
        if (typeof ev.message?.model === "string" && ev.message.model) answeredModel = ev.message.model;
        const inTok = toInt(ev.message?.usage?.input_tokens);
        const outTok = toInt(ev.message?.usage?.output_tokens);
        if (inTok !== undefined) inputTokens = inTok;
        if (outTok !== undefined) outputTokens = outTok;
      } else if (
        ev.type === "content_block_delta" &&
        ev.delta?.type === "text_delta" &&
        typeof ev.delta.text === "string" &&
        ev.delta.text.length > 0
      ) {
        emitted = true;
        on.text(ev.delta.text);
      } else if (ev.type === "message_delta") {
        const outTok = toInt(ev.usage?.output_tokens);
        if (outTok !== undefined) outputTokens = outTok;
      }
    });

    if (streamError) {
      return {
        ok: false,
        reason: `Anthropic 兼容接口流式错误：${streamError}`,
        models: { requested: model, answered: answeredModel ? [answeredModel] : [], switches: [] },
      };
    }
    if (!emitted) {
      return {
        ok: false,
        reason: "Anthropic 兼容接口流式响应未返回文本",
        models: { requested: model, answered: answeredModel ? [answeredModel] : [], switches: [] },
      };
    }
    return {
      ok: true,
      ...(inputTokens !== undefined && outputTokens !== undefined
        ? { usage: { input_tokens: inputTokens, output_tokens: outputTokens } }
        : {}),
      models: { requested: model, answered: answeredModel ? [answeredModel] : [], switches: [] },
    };
  } catch (error) {
    return {
      ok: false,
      reason: req.signal?.aborted
        ? "已取消"
        : guard.timedOut()
          ? `timeout ${req.timeoutMs}ms`
          : `Anthropic 兼容接口请求失败：${error instanceof Error ? error.message : String(error)}`,
      models: { requested: model, answered: [], switches: [] },
    };
  } finally {
    guard.dispose();
  }
}

/**
 * 自定义命令行 Harness 适配器：严格 `shell: false`，将完整 prompt 经 stdin 写入子进程，
 * 实时读取 stdout 文本流并返回（支持 Windows npm `.cmd` 包装器安全解包）。
 */
export function runHarnessCommand(req: AgentRequest, on: ProviderCallbacks): Promise<ProviderOutcome> {
  const model = req.model?.trim() || "custom-harness";
  const spec = req.harnessCommand;
  if (!spec?.command?.trim()) {
    return Promise.resolve({
      ok: false,
      reason: "harness 接入方式未配置 harnessCommand.command（请在 sync.config.local.json 或状态面板填写）",
      models: { requested: model, answered: [], switches: [] },
    });
  }
  const { system, prompt } = extractSystemAndPrompt(req);
  const fullInput = system.trim() ? `${system}\n\n${prompt}` : prompt;

  let command = spec.command.trim();
  let args = [...(spec.args ?? [])];
  if (/\.(cmd|bat)$/i.test(command)) {
    const unwrapped = resolveWindowsCmdShim(command, existsSync);
    if (!unwrapped) {
      return Promise.resolve({
        ok: false,
        reason: `无法将 Windows 包装器 ${command} 解包为可执行 JS 入口（拒绝 shell 回退）`,
        models: { requested: model, answered: [], switches: [] },
      });
    }
    command = unwrapped.command;
    args = [...(unwrapped.argsPrefix ?? []), ...args];
  }

  return new Promise<ProviderOutcome>((resolve) => {
    if (req.signal?.aborted) {
      resolve({ ok: false, reason: "已取消", models: { requested: model, answered: [], switches: [] } });
      return;
    }
    let child: ChildProcess & { stdin: NonNullable<ChildProcess["stdin"]> };
    try {
      child = spawn(command, args, {
        cwd: req.cwd,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env: {
          ...process.env,
          WIKI_PROVIDER: "harness",
          WIKI_MODEL: model,
        },
      }) as typeof child;
    } catch (error) {
      resolve({
        ok: false,
        reason: `harness 启动失败：${error instanceof Error ? error.message : String(error)}`,
        models: { requested: model, answered: [], switches: [] },
      });
      return;
    }

    let stdout = "";
    let stderr = "";
    let inputError: string | undefined;
    let timedOut = false;

    child.stdin.on("error", (err) => {
      inputError = `stdin-error: ${err.message}`;
    });
    const abort = () => {
      if (child.pid) killTree(child.pid);
    };
    req.signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) killTree(child.pid);
    }, req.timeoutMs);

    child.stdout!.setEncoding("utf8");
    child.stdout!.on("data", (chunk: string) => {
      stdout += chunk;
      on.text(chunk);
    });
    child.stderr!.on("data", (d: Buffer) => {
      stderr = (stderr + d.toString()).slice(-2000);
    });
    child.on("error", (err) => {
      req.signal?.removeEventListener("abort", abort);
      clearTimeout(timer);
      resolve({
        ok: false,
        reason: `harness spawn-error: ${err.message}`,
        models: { requested: model, answered: [], switches: [] },
      });
    });
    child.on("close", (code) => {
      req.signal?.removeEventListener("abort", abort);
      clearTimeout(timer);
      if (req.signal?.aborted) {
        resolve({ ok: false, reason: "已取消", models: { requested: model, answered: [], switches: [] } });
      } else if (timedOut) {
        resolve({
          ok: false,
          reason: `timeout ${req.timeoutMs}ms`,
          models: { requested: model, answered: [], switches: [] },
        });
      } else if (code !== 0) {
        resolve({
          ok: false,
          reason: `harness exit ${code}${stderr.trim() ? `: ${stderr.trim()}` : ""}`,
          models: { requested: model, answered: [], switches: [] },
        });
      } else if (inputError) {
        resolve({ ok: false, reason: inputError, models: { requested: model, answered: [], switches: [] } });
      } else if (!stdout.trim()) {
        resolve({
          ok: false,
          reason: "harness 未在 stdout 返回有效内容",
          models: { requested: model, answered: [], switches: [] },
        });
      } else {
        resolve({ ok: true, models: { requested: model, answered: [], switches: [] } });
      }
    });
    child.stdin.end(fullInput, "utf8");
  });
}
