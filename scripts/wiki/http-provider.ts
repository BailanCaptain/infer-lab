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
import { hasSecretHarnessArg, sanitizeHarnessArgs, stripUrlCredentials } from "./endpoint-sanitize";
import type { ModelUse } from "./model-use";

export { hasSecretHarnessArg, sanitizeHarnessArgs, stripUrlCredentials };

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

export function resolveEffectiveEndpointUrl(
  provider: ChatProvider,
  apiBaseUrl?: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (provider === "openai-compatible") {
    const rawBase = apiBaseUrl?.trim() || env.OPENAI_BASE_URL?.trim();
    const cleanBase = rawBase ? stripUrlCredentials(rawBase) : undefined;
    return stripUrlCredentials(resolveOpenAiCompletionsUrl(cleanBase, {}));
  }
  if (provider === "anthropic-compatible") {
    const rawBase = apiBaseUrl?.trim() || env.ANTHROPIC_BASE_URL?.trim();
    const cleanBase = rawBase ? stripUrlCredentials(rawBase) : undefined;
    return stripUrlCredentials(resolveAnthropicMessagesUrl(cleanBase, {}));
  }
  return apiBaseUrl?.trim() ? stripUrlCredentials(apiBaseUrl) : undefined;
}

export function checkAnthropicStopReason(stopReason: unknown): string | undefined {
  if (stopReason === "max_tokens") {
    return "Anthropic 兼容接口响应达到长度上限被截断（stop_reason=max_tokens）";
  }
  if (stopReason === "model_context_window_exceeded") {
    return "Anthropic 兼容接口响应超出模型上下文窗口被截断（stop_reason=model_context_window_exceeded）";
  }
  return undefined;
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

interface SseEventFrame {
  event?: string;
  data: string;
}

/**
 * WHATWG Server-Sent Events parser: dispatches events strictly on blank-line boundaries
 * (`\n\n` or `\r\n\r\n`). Never dispatches an unclosed trailing frame at EOF, and stops
 * dispatching once the handler signals terminal state (returning true).
 */
async function consumeSseEvents(
  body: ReadableStream<Uint8Array>,
  onEvent: (frame: SseEventFrame) => boolean | undefined,
): Promise<{ hadUnterminatedFrame: boolean }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventType: string | undefined;
  let dataLines: string[] = [];
  let terminal = false;

  const processLine = (line: string) => {
    if (terminal) return;
    if (line === "") {
      if (dataLines.length > 0) {
        const frame: SseEventFrame = {
          ...(eventType ? { event: eventType } : {}),
          data: dataLines.join("\n"),
        };
        dataLines = [];
        eventType = undefined;
        if (onEvent(frame) === true) terminal = true;
      } else {
        eventType = undefined;
      }
      return;
    }
    if (line.startsWith(":")) return;
    const colon = line.indexOf(":");
    const field = colon >= 0 ? line.slice(0, colon) : line;
    const rawVal = colon >= 0 ? line.slice(colon + 1) : "";
    const value = rawVal.startsWith(" ") ? rawVal.slice(1) : rawVal;
    if (field === "data") dataLines.push(value);
    else if (field === "event") eventType = value;
  };

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // Normalize \r\n to \n; hold a trailing \r until next chunk in case \r\n splits across chunks.
      let trailingCr = false;
      if (buffer.endsWith("\r")) {
        trailingCr = true;
        buffer = buffer.slice(0, -1);
      }
      buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      let newline = buffer.indexOf("\n");
      while (newline >= 0 && !terminal) {
        processLine(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
      if (terminal) {
        void reader.cancel().catch(() => {});
        return { hadUnterminatedFrame: false };
      }
      if (trailingCr) buffer += "\r";
    }
    buffer += decoder.decode();
    // Process any remaining newline-terminated lines, but NEVER auto-close an event missing its blank line.
    buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      processLine(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
    const leftoverNonComment = buffer.length > 0 && !buffer.startsWith(":");
    const hadUnterminatedFrame = !terminal && (dataLines.length > 0 || leftoverNonComment);
    return { hadUnterminatedFrame };
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
        choices?: { message?: { content?: unknown }; text?: unknown; finish_reason?: unknown }[];
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
      const answered = typeof data.model === "string" && data.model ? [data.model] : [];
      if (choice?.finish_reason === "length") {
        return {
          ok: false,
          reason: "OpenAI 兼容接口响应达到长度上限被截断（finish_reason=length）",
          models: { requested: model, answered, switches: [] },
        };
      }
      if (
        typeof choice?.finish_reason === "string" &&
        choice.finish_reason &&
        choice.finish_reason !== "stop"
      ) {
        return {
          ok: false,
          reason: `OpenAI 兼容接口非正常结束（finish_reason=${choice.finish_reason}）`,
          models: { requested: model, answered, switches: [] },
        };
      }
      const text = extractOpenAiContent(choice?.message?.content ?? choice?.text);
      if (!text.trim()) {
        return {
          ok: false,
          reason: "OpenAI 兼容接口未返回有效文本内容",
          models: { requested: model, answered: [], switches: [] },
        };
      }
      on.text(text);
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
    let sawDone = false;
    let finishReason: string | undefined;
    let streamError: string | undefined;

    const { hadUnterminatedFrame } = await consumeSseEvents(response.body, ({ data }) => {
      const payload = data.trim();
      if (!payload) return;
      if (payload === "[DONE]") {
        sawDone = true;
        return true;
      }
      let chunk: {
        model?: unknown;
        choices?: {
          delta?: { content?: unknown };
          message?: { content?: unknown };
          finish_reason?: unknown;
        }[];
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
      const fr = chunk.choices?.[0]?.finish_reason;
      if (typeof fr === "string" && fr) finishReason = fr;
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
    if (finishReason === "length") {
      return {
        ok: false,
        reason: "OpenAI 兼容接口流式响应达到长度上限被截断（finish_reason=length）",
        models: { requested: model, answered: answeredModel ? [answeredModel] : [], switches: [] },
      };
    }
    if (finishReason && finishReason !== "stop") {
      return {
        ok: false,
        reason: `OpenAI 兼容接口流式响应非正常结束（finish_reason=${finishReason}）`,
        models: { requested: model, answered: answeredModel ? [answeredModel] : [], switches: [] },
      };
    }
    if (hadUnterminatedFrame || (!sawDone && finishReason !== "stop")) {
      return {
        ok: false,
        reason: "OpenAI 兼容接口流式响应未正常结束（疑似截断或未闭合 SSE 帧）",
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
        stop_reason?: unknown;
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
      const answered = typeof data.model === "string" && data.model ? [data.model] : [];
      const stopReasonError = checkAnthropicStopReason(data.stop_reason);
      if (stopReasonError) {
        return {
          ok: false,
          reason: stopReasonError,
          models: { requested: model, answered, switches: [] },
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
    let sawMessageStop = false;
    let stopReason: string | undefined;
    let streamError: string | undefined;

    const { hadUnterminatedFrame } = await consumeSseEvents(response.body, ({ data }) => {
      const payload = data.trim();
      if (!payload || payload === "[DONE]") return;
      let ev: {
        type?: unknown;
        stop_reason?: unknown;
        message?: { model?: unknown; usage?: { input_tokens?: unknown; output_tokens?: unknown } };
        delta?: { type?: unknown; text?: unknown; stop_reason?: unknown };
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
        const sr = ev.delta?.stop_reason ?? ev.stop_reason;
        if (typeof sr === "string" && sr) stopReason = sr;
      } else if (ev.type === "message_stop") {
        sawMessageStop = true;
        return true;
      }
    });

    if (streamError) {
      return {
        ok: false,
        reason: `Anthropic 兼容接口流式错误：${streamError}`,
        models: { requested: model, answered: answeredModel ? [answeredModel] : [], switches: [] },
      };
    }
    const streamStopReasonError = checkAnthropicStopReason(stopReason);
    if (streamStopReasonError) {
      return {
        ok: false,
        reason: streamStopReasonError,
        models: { requested: model, answered: answeredModel ? [answeredModel] : [], switches: [] },
      };
    }
    if (hadUnterminatedFrame || !sawMessageStop) {
      return {
        ok: false,
        reason: "Anthropic 兼容接口流式响应未正常结束（缺少闭合的 message_stop，疑似截断或未闭合 SSE 帧）",
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
export function runHarnessCommand(
  req: AgentRequest,
  on: ProviderCallbacks,
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<ProviderOutcome> {
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
          ...(options.env ?? process.env),
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
