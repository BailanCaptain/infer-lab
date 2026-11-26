import type { ActivationScheme, CouplingCheckInput, CudaGraphMode, KvRole, ModelDtype } from "../rules/types";

export interface CliParseDiagnostic {
  code:
    | "parse-empty-command"
    | "parse-unterminated-quote"
    | "parse-invalid-json"
    | "parse-invalid-json-type"
    | "parse-missing-flag-value"
    | "parse-invalid-number"
    | "parse-invalid-range"
    | "parse-invalid-visible-devices"
    | "parse-invalid-vllm-port";
  severity: "error" | "warn";
  flag?: string | undefined;
  message: string;
  remediation?: string | undefined;
}

export interface InferredModelHints {
  matchedPresetName: string | null;
  isMoe?: boolean | undefined;
  hasRoutedExpertHiddenSize?: boolean | undefined;
  useMla?: boolean | undefined;
  usesSfaSparse?: boolean | undefined;
  isQwen35Dense?: boolean | undefined;
  modelType?: string | undefined;
  numExperts?: number | undefined;
  numExpertsPerTok?: number | undefined;
  numAttentionHeads?: number | undefined;
  numKvHeads?: number | undefined;
  headDim?: number | undefined;
  kvLoraRank?: number | undefined;
  qkRopeHeadDim?: number | undefined;
  defaultModelDtype?: ModelDtype | undefined;
  defaultMaxModelLen?: number | undefined;
  quantMethod?: string | undefined;
  quantScheme?: string | undefined;
  hasWeightBlockSize?: boolean | undefined;
  activationScheme?: ActivationScheme | undefined;
  enableC8Quant?: boolean | undefined;
}

export interface ParsedVllmServeCommand {
  rawText: string;
  normalizedCommandLine: string;
  shellPreamble: readonly string[];
  envVars: Readonly<Record<string, string>>;
  visibleDevices: readonly number[] | null;
  model: string | null;
  servedModelName: string | null;
  port: number | null;
  host: string | null;
  distributedExecutorBackend: string | null;
  loadFormat: string | null;
  trustRemoteCode: boolean;
  enforceEager: boolean;
  enableSleepMode: boolean;
  enablePrefixCaching: boolean | undefined;
  gpuMemoryUtilization: number | undefined;
  rawDtype: string | undefined;
  rawQuantization: string | undefined;
  rawKvCacheDtype: string | undefined;
  dataParallelSizeLocal: number | undefined;
  additionalConfig: Readonly<Record<string, unknown>> | null;
  compilationConfig: Readonly<Record<string, unknown>> | null;
  kvTransferConfig: Readonly<Record<string, unknown>> | null;
  speculativeConfig: Readonly<Record<string, unknown>> | null;
  unknownFlags: readonly string[];
  parseDiagnostics: readonly CliParseDiagnostic[];
  inferredHints: InferredModelHints;
  couplingInput: CouplingCheckInput;
  requiredLocalRanks: number;
}

interface ShellStatement {
  tokens: string[];
  raw: string;
}

function normalizeContinuations(input: string): string {
  return input.replace(/\r\n/g, "\n").replace(/\\[ \t]*\n/g, " ");
}

function splitStatements(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  let i = 0;

  while (i < text.length) {
    const ch = text[i] ?? "";
    const next = text[i + 1] ?? "";

    if (quote === "'") {
      cur += ch;
      if (ch === "'") quote = null;
      i += 1;
      continue;
    }

    if (quote === '"') {
      if (ch === "\\" && i + 1 < text.length) {
        cur += ch + next;
        i += 2;
        continue;
      }
      cur += ch;
      if (ch === '"') quote = null;
      i += 1;
      continue;
    }

    if (ch === "\\" && i + 1 < text.length) {
      cur += ch + next;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
      i += 1;
      continue;
    }
    if (ch === "#" && (cur.length === 0 || /\s/.test(cur[cur.length - 1] ?? ""))) {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "\n" || ch === ";") {
      if (cur.trim().length > 0) out.push(cur.trim());
      cur = "";
      i += 1;
      continue;
    }
    if (ch === "&" && next === "&") {
      if (cur.trim().length > 0) out.push(cur.trim());
      cur = "";
      i += 2;
      continue;
    }
    cur += ch;
    i += 1;
  }

  if (cur.trim().length > 0) out.push(cur.trim());
  return out;
}

function tokenizeStatement(stmt: string, diagnostics: CliParseDiagnostic[]): ShellStatement {
  const tokens: string[] = [];
  let cur = "";
  let hasToken = false;
  let quote: "'" | '"' | null = null;
  let i = 0;

  while (i < stmt.length) {
    const ch = stmt[i] ?? "";
    const next = stmt[i + 1] ?? "";

    if (quote === "'") {
      if (ch === "'") {
        quote = null;
      } else {
        cur += ch;
      }
      i += 1;
      continue;
    }

    if (quote === '"') {
      if (ch === '"') {
        quote = null;
        i += 1;
        continue;
      }
      if (ch === "\\" && (next === '"' || next === "\\" || next === "$" || next === "`")) {
        cur += next;
        i += 2;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }

    if (/\s/.test(ch)) {
      if (hasToken) {
        tokens.push(cur);
        cur = "";
        hasToken = false;
      }
      i += 1;
      continue;
    }

    if (ch === "'" || ch === '"') {
      quote = ch;
      hasToken = true;
      i += 1;
      continue;
    }

    if (ch === "\\" && i + 1 < stmt.length) {
      cur += next;
      hasToken = true;
      i += 2;
      continue;
    }

    cur += ch;
    hasToken = true;
    i += 1;
  }

  if (quote !== null) {
    diagnostics.push({
      code: "parse-unterminated-quote",
      severity: "error",
      message: `命令中存在未闭合的 ${quote} 引号，请检查 JSON 或字符串参数引号配对。`,
      remediation: "补全缺失的单引号或双引号后再重新体检。",
    });
  }

  if (hasToken) tokens.push(cur);
  // Strip trailing shell background '&' token
  while (tokens.length > 0 && tokens[tokens.length - 1] === "&") {
    tokens.pop();
  }
  return { tokens, raw: stmt };
}

function expandKnownVars(value: string, env: Record<string, string>): string {
  return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (m, a, b) => {
    const key = String(a ?? b ?? "");
    return Object.hasOwn(env, key) ? (env[key] ?? "") : m;
  });
}

const ENV_ASSIGN_RE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonObjectFlag(
  flag: string,
  rawValue: string,
  diagnostics: CliParseDiagnostic[],
): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!isRecord(parsed)) {
      diagnostics.push({
        code: "parse-invalid-json-type",
        severity: "error",
        flag,
        message: `${flag} 需要 JSON 对象（例如 '{...}'），实际解析类型为 ${Array.isArray(parsed) ? "array" : typeof parsed}。`,
        remediation: `请使用合法的 JSON 对象传给 ${flag}。`,
      });
      return null;
    }
    return parsed;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    diagnostics.push({
      code: "parse-invalid-json",
      severity: "error",
      flag,
      message: `${flag} 的 JSON 格式非法（${detail}）。`,
      remediation: `请用双引号包裹键名与字符串，去掉多余尾逗号，并用单引号包住整段 JSON 传给 ${flag}。`,
    });
    return null;
  }
}

function parseIntegerFlag(
  flag: string,
  rawValue: string,
  diagnostics: CliParseDiagnostic[],
  opts: { min?: number; max?: number; allowMinusOne?: boolean; allowSuffix?: boolean } = {},
): number | undefined {
  const trimmed = rawValue.trim();
  let num: number;
  const suffixMatch = opts.allowSuffix ? /^(\d+)([kKmM])$/.exec(trimmed) : null;
  if (suffixMatch?.[1] && suffixMatch[2]) {
    const base = Number.parseInt(suffixMatch[1], 10);
    const mult = suffixMatch[2].toLowerCase() === "m" ? 1024 * 1024 : 1024;
    num = base * mult;
  } else if (/^-?\d+$/.test(trimmed)) {
    num = Number.parseInt(trimmed, 10);
  } else {
    diagnostics.push({
      code: "parse-invalid-number",
      severity: "error",
      flag,
      message: `${flag} 需要整数，收到 '${rawValue}'。`,
    });
    return undefined;
  }
  if (opts.allowMinusOne && num === -1) return num;
  if ((opts.min !== undefined && num < opts.min) || (opts.max !== undefined && num > opts.max)) {
    diagnostics.push({
      code: "parse-invalid-range",
      severity: "error",
      flag,
      message: `${flag} 数值越界（收到 ${num}，允许范围 ${opts.min ?? "-∞"}..${opts.max ?? "+∞"}）。`,
    });
    return undefined;
  }
  return num;
}

function parseFloatFlag(
  flag: string,
  rawValue: string,
  diagnostics: CliParseDiagnostic[],
  opts: { minExclusive?: number; maxInclusive?: number } = {},
): number | undefined {
  const trimmed = rawValue.trim();
  const num = Number(trimmed);
  if (trimmed.length === 0 || !Number.isFinite(num)) {
    diagnostics.push({
      code: "parse-invalid-number",
      severity: "error",
      flag,
      message: `${flag} 需要数值，收到 '${rawValue}'。`,
    });
    return undefined;
  }
  if (
    (opts.minExclusive !== undefined && num <= opts.minExclusive) ||
    (opts.maxInclusive !== undefined && num > opts.maxInclusive)
  ) {
    diagnostics.push({
      code: "parse-invalid-range",
      severity: "error",
      flag,
      message: `${flag} 数值越界（收到 ${num}，需满足 (${opts.minExclusive ?? "-∞"}, ${opts.maxInclusive ?? "+∞"}]）。`,
    });
    return undefined;
  }
  return num;
}

function parseBoolLike(val: unknown): boolean | undefined {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "string") {
    const lower = val.trim().toLowerCase();
    if (lower === "1" || lower === "true") return true;
    if (lower === "0" || lower === "false") return false;
  }
  return undefined;
}

function parseEnvIntBool(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return undefined;
  const n = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(n) ? n !== 0 : undefined;
}

function parsePydanticLaxBool(val: unknown): boolean | undefined {
  if (typeof val === "boolean") return val;
  if (val === 0) return false;
  if (val === 1) return true;
  if (typeof val === "string") {
    if (/^(?:1|true|t|yes|y|on)$/i.test(val)) return true;
    if (/^(?:0|false|f|no|n|off)$/i.test(val)) return false;
  }
  return undefined;
}

function parsePydanticLaxInt(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isSafeInteger(val)) return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^[+-]?\d(?:_?\d)*(?:\.0+)?$/.test(trimmed)) {
      const normalized = trimmed.replace(/_/g, "").replace(/\.0+$/, "");
      const n = Number(normalized);
      if (Number.isSafeInteger(n)) return n;
    }
  }
  return undefined;
}

function parseNumberLike(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim().length > 0) {
    const n = Number(val.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function normalizeModelDtype(raw: string | undefined): ModelDtype | undefined {
  if (!raw) return undefined;
  const lower = raw.trim().toLowerCase();
  if (lower === "bfloat16" || lower === "bf16") return "bfloat16";
  if (lower === "float16" || lower === "fp16" || lower === "half") return "float16";
  if (lower === "float32" || lower === "fp32" || lower === "float") return "float32";
  return undefined;
}

function normalizeCudaGraphMode(val: unknown): CudaGraphMode | undefined {
  if (typeof val !== "string") return undefined;
  const upper = val.trim().toUpperCase();
  if (
    upper === "NONE" ||
    upper === "PIECEWISE" ||
    upper === "FULL_DECODE_ONLY" ||
    upper === "FULL" ||
    upper === "FULL_AND_PIECEWISE"
  ) {
    return upper;
  }
  return undefined;
}

function normalizeKvRole(val: unknown): KvRole | undefined {
  if (typeof val !== "string") return undefined;
  const lower = val.trim().toLowerCase();
  if (lower === "kv_producer" || lower === "kv_consumer" || lower === "kv_both") {
    return lower;
  }
  return undefined;
}

export function inferModelHints(modelPath: string | null): InferredModelHints {
  if (!modelPath) return { matchedPresetName: null };
  const s = modelPath.toLowerCase();
  const hints: InferredModelHints = { matchedPresetName: null };

  if (/qwen3[-_.]?30b[-_.]?a3b/.test(s)) {
    hints.matchedPresetName = "Qwen3-30B-A3B";
    hints.isMoe = true;
    hints.useMla = false;
    hints.numExperts = 128;
    hints.numExpertsPerTok = 8;
    hints.numAttentionHeads = 32;
    hints.numKvHeads = 4;
    hints.headDim = 128;
    hints.defaultModelDtype = "bfloat16";
    hints.defaultMaxModelLen = 40960;
  } else if (/qwen3[-_.]?235b[-_.]?a22b/.test(s)) {
    hints.matchedPresetName = "Qwen3-235B-A22B";
    hints.isMoe = true;
    hints.useMla = false;
    hints.numExperts = 128;
    hints.numExpertsPerTok = 8;
    hints.numAttentionHeads = 64;
    hints.numKvHeads = 4;
    hints.headDim = 128;
    hints.defaultModelDtype = "bfloat16";
    hints.defaultMaxModelLen = 40960;
  } else if (/qwen3[-_.]?8b/.test(s)) {
    hints.matchedPresetName = "Qwen3-8B";
    hints.isMoe = false;
    hints.useMla = false;
    hints.numAttentionHeads = 32;
    hints.numKvHeads = 8;
    hints.headDim = 128;
    hints.defaultModelDtype = "bfloat16";
    hints.defaultMaxModelLen = 40960;
  } else if (/qwen3[-_.]?14b/.test(s)) {
    hints.matchedPresetName = "Qwen3-14B";
    hints.isMoe = false;
    hints.useMla = false;
    hints.numAttentionHeads = 40;
    hints.numKvHeads = 8;
    hints.headDim = 128;
    hints.defaultModelDtype = "bfloat16";
    hints.defaultMaxModelLen = 40960;
  } else if (/qwen3[-_.]?32b/.test(s)) {
    hints.matchedPresetName = "Qwen3-32B";
    hints.isMoe = false;
    hints.useMla = false;
    hints.numAttentionHeads = 64;
    hints.numKvHeads = 8;
    hints.headDim = 128;
    hints.defaultModelDtype = "bfloat16";
    hints.defaultMaxModelLen = 40960;
  } else if (/qwen3[-_.]?0\.6b/.test(s)) {
    hints.matchedPresetName = "Qwen3-0.6B";
    hints.isMoe = false;
    hints.useMla = false;
    hints.numAttentionHeads = 16;
    hints.numKvHeads = 8;
    hints.headDim = 128;
    hints.defaultModelDtype = "bfloat16";
    hints.defaultMaxModelLen = 40960;
  } else if (/qwen3\.[568][-_.]?27b/.test(s)) {
    hints.matchedPresetName = "Qwen3.5-27B";
    hints.isMoe = false;
    hints.useMla = false;
    hints.isQwen35Dense = true;
    hints.defaultModelDtype = "bfloat16";
  } else if (/deepseek[-_.]?v4/.test(s)) {
    hints.matchedPresetName = "DeepSeek-V4";
    hints.isMoe = true;
    hints.useMla = true;
    hints.usesSfaSparse = true;
    hints.modelType = "deepseek_v4";
    hints.numExperts = 256;
    hints.numExpertsPerTok = 8;
    hints.numAttentionHeads = 128;
    hints.headDim = 512;
    hints.kvLoraRank = 512;
    hints.qkRopeHeadDim = 64;
    hints.defaultModelDtype = "bfloat16";
  } else if (/deepseek[-_.]?(v3|r1)/.test(s)) {
    hints.matchedPresetName = "DeepSeek-V3/R1";
    hints.isMoe = true;
    hints.useMla = true;
    hints.numExperts = 256;
    hints.numExpertsPerTok = 8;
    hints.numAttentionHeads = 128;
    hints.kvLoraRank = 512;
    hints.qkRopeHeadDim = 64;
    hints.defaultModelDtype = "bfloat16";
  } else if (/glm[-_.]?5/.test(s)) {
    hints.matchedPresetName = "GLM-5-MoE";
    hints.isMoe = true;
    hints.useMla = true;
    hints.defaultModelDtype = "bfloat16";
  } else if (/glm[-_.]?4\.7[-_.]?flash/.test(s)) {
    hints.matchedPresetName = "GLM-4.7-Flash";
    hints.isMoe = true;
    hints.useMla = true;
    hints.defaultModelDtype = "bfloat16";
  } else if (/glm[-_.]?(4\.5|4\.6|4\.7)/.test(s)) {
    hints.matchedPresetName = "GLM-4.5/4.7-MoE";
    hints.isMoe = true;
    hints.useMla = false;
    hints.defaultModelDtype = "bfloat16";
  } else if (/kimi[-_.]?k3/.test(s)) {
    hints.matchedPresetName = "Kimi-K3-LatentMoE";
    hints.isMoe = true;
    hints.hasRoutedExpertHiddenSize = true;
    hints.defaultModelDtype = "bfloat16";
  }

  // Weight quantization & C8 naming hints
  if (/(?:^|[-_/])fp8(?:$|[-_/])/.test(s)) {
    hints.quantMethod = "fp8";
    hints.hasWeightBlockSize = true;
    hints.activationScheme = "dynamic";
  } else if (/(?:^|[-_/])(w8a8(?:sc|[_-]?dynamic|[_-]?mix|[_-]?pdmix|-310)?|w4a8|w4a4)(?:$|[-_/])/.test(s)) {
    hints.quantMethod = "ascend";
    if (/(?:^|[-_/])w8a8[_-]?pdmix(?:$|[-_/])/.test(s)) {
      hints.quantScheme = "W8A8_PDMIX";
    } else if (/(?:^|[-_/])w8a8[_-]?mix(?:$|[-_/])/.test(s)) {
      hints.quantScheme = "W8A8_MIX";
    }
  }
  if (/(?:^|[-_/])(c8|w8a8c8)(?:$|[-_/])/.test(s)) {
    hints.enableC8Quant = true;
  }

  return hints;
}

function parseVisibleDevices(raw: string | undefined, diagnostics: CliParseDiagnostic[]): number[] | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    diagnostics.push({
      code: "parse-invalid-visible-devices",
      severity: "error",
      flag: "ASCEND_RT_VISIBLE_DEVICES",
      message: "ASCEND_RT_VISIBLE_DEVICES 为空字符串，进程将无法发现任何 NPU 设备。",
      remediation: "请填写逗号分隔的设备编号，例如 export ASCEND_RT_VISIBLE_DEVICES=0,1。",
    });
    return [];
  }
  const parts = trimmed.split(",").map((p) => p.trim());
  const ids: number[] = [];
  const seen = new Set<number>();
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      diagnostics.push({
        code: "parse-invalid-visible-devices",
        severity: "error",
        flag: "ASCEND_RT_VISIBLE_DEVICES",
        message: `ASCEND_RT_VISIBLE_DEVICES='${raw}' 中包含非整数设备号 '${part}'。`,
        remediation: "设备列表应为逗号分隔的非负整数，例如 0,1,2,3。",
      });
      return null;
    }
    const id = Number.parseInt(part, 10);
    if (seen.has(id)) {
      diagnostics.push({
        code: "parse-invalid-visible-devices",
        severity: "warn",
        flag: "ASCEND_RT_VISIBLE_DEVICES",
        message: `ASCEND_RT_VISIBLE_DEVICES='${raw}' 中存在重复设备编号 ${id}。`,
      });
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function stripShellRedirections(tokens: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i] ?? "";
    if (/^(?:\d?>&?\d?|\d?>>|&>|&>>)$/.test(tok)) {
      if (!tok.includes("&") && i + 1 < tokens.length) {
        i += 1;
      }
      continue;
    }
    if (/^(?:\d?>>?|\d?>&\d|&>>?).+/.test(tok)) {
      continue;
    }
    out.push(tok);
  }
  return out;
}

const KNOWN_NO_ARG_BOOL_FLAGS: ReadonlySet<string> = new Set([
  "--disable-log-requests",
  "--enable-log-requests",
  "--no-enable-log-requests",
  "--disable-log-stats",
  "--disable-uvicorn-access-log",
  "--disable-fastapi-docs",
  "--disable-frontend-multiprocessing",
  "--disable-custom-all-reduce",
  "--disable-sliding-window",
  "--disable-mm-preprocessor-cache",
  "--disable-hybrid-kv-cache-manager",
  "--disable-cascade-attn",
  "--enable-auto-tool-choice",
  "--enable-reasoning",
  "--enable-chunked-local-attn",
  "--enable-prompt-embeds",
  "--enable-multimodal",
  "--enable-eplb",
  "--no-enable-eplb",
  "--enable-dbo",
  "--no-enable-dbo",
  "--enable-dp-attention",
  "--no-enable-dp-attention",
  "--async-scheduling",
  "--no-async-scheduling",
  "--skip-tokenizer-init",
  "--headless",
]);

function isLikelyModelArg(token: string): boolean {
  if (token.includes("/") || token.includes("\\")) return true;
  return /^(?:qwen|deepseek|llama|glm|mistral|gemma|mixtral|internlm|yi|kimi|minimax)/i.test(token);
}

function normalizeCliFlag(rawFlag: string): string {
  if (rawFlag.startsWith("--")) {
    const body = rawFlag.slice(2);
    const dotIdx = body.indexOf(".");
    if (dotIdx >= 0) {
      return `--${body.slice(0, dotIdx).replace(/_/g, "-")}${body.slice(dotIdx)}`;
    }
    return `--${body.replace(/_/g, "-")}`;
  }
  return rawFlag;
}

const FORBIDDEN_DOTTED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function parseHumanReadableInt(raw: string): number | undefined {
  const m = /^(\d+(?:\.\d+)?)([kKmMgGtT])$/.exec(raw.trim());
  if (!m?.[1] || !m[2]) return undefined;
  const num = Number(m[1]);
  if (!Number.isFinite(num)) return undefined;
  const decimalMult: Readonly<Record<string, number>> = {
    k: 1e3,
    m: 1e6,
    g: 1e9,
    t: 1e12,
  };
  const binaryMult: Readonly<Record<string, number>> = {
    K: 2 ** 10,
    M: 2 ** 20,
    G: 2 ** 30,
    T: 2 ** 40,
  };
  if (Object.hasOwn(decimalMult, m[2])) {
    return Math.trunc(num * decimalMult[m[2]]!);
  }
  if (Object.hasOwn(binaryMult, m[2])) {
    if (m[1].includes(".")) return undefined;
    return Number.parseInt(m[1], 10) * binaryMult[m[2]]!;
  }
  return undefined;
}

function parseDottedScalarOrJson(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const hr = parseHumanReadableInt(trimmed);
    return hr !== undefined ? hr : raw;
  }
}

function defineOwnRecordField(target: Record<string, unknown>, key: string, value: unknown): void {
  if (Object.hasOwn(target, key)) {
    target[key] = value;
  } else {
    Object.defineProperty(target, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}

export function setDottedRecordValue(
  target: Record<string, unknown>,
  pathSegments: readonly string[],
  value: unknown,
): boolean {
  if (pathSegments.length === 0 || pathSegments.some((seg) => FORBIDDEN_DOTTED_KEYS.has(seg))) {
    return false;
  }
  let cursor: Record<string, unknown> = target;
  for (let idx = 0; idx < pathSegments.length - 1; idx += 1) {
    const seg = pathSegments[idx]!;
    const existing = Object.hasOwn(cursor, seg) ? cursor[seg] : undefined;
    if (isRecord(existing)) {
      cursor = existing;
    } else {
      const next: Record<string, unknown> = {};
      defineOwnRecordField(cursor, seg, next);
      cursor = next;
    }
  }
  const leaf = pathSegments[pathSegments.length - 1]!;
  const prevLeaf = Object.hasOwn(cursor, leaf) ? cursor[leaf] : undefined;
  if (Array.isArray(prevLeaf) && Array.isArray(value)) {
    defineOwnRecordField(cursor, leaf, [...prevLeaf, ...value]);
  } else if (isRecord(prevLeaf) && isRecord(value)) {
    for (const [k, v] of Object.entries(value)) {
      setDottedRecordValue(prevLeaf, [k], v);
    }
  } else {
    defineOwnRecordField(cursor, leaf, value);
  }
  return true;
}

function findServeTokens(statements: readonly ShellStatement[]): {
  serveTokens: string[];
  envVars: Record<string, string>;
  shellPreamble: string[];
} {
  const envVars: Record<string, string> = {};
  const shellPreamble: string[] = [];
  let serveTokens: string[] = [];

  for (const stmt of statements) {
    const tokens = stmt.tokens;
    if (tokens.length === 0) continue;
    const first = tokens[0] ?? "";

    if (first === "export") {
      for (let i = 1; i < tokens.length; i += 1) {
        const tok = tokens[i] ?? "";
        const m = ENV_ASSIGN_RE.exec(tok);
        if (m?.[1]) {
          envVars[m[1]] = expandKnownVars(m[2] ?? "", envVars);
        }
      }
      continue;
    }

    // Consume leading inline KEY=VAL assignments and shell wrappers (nohup, env, setsid)
    let idx = 0;
    const inlineEnvs: Array<[string, string]> = [];
    while (idx < tokens.length) {
      const tok = tokens[idx] ?? "";
      const m = ENV_ASSIGN_RE.exec(tok);
      if (m?.[1]) {
        inlineEnvs.push([m[1], expandKnownVars(m[2] ?? "", envVars)]);
        idx += 1;
        continue;
      }
      if (tok === "nohup" || tok === "env" || tok === "setsid") {
        idx += 1;
        continue;
      }
      break;
    }

    if (idx === tokens.length) {
      // Pure assignment statement (e.g. MODEL=/path)
      for (const [k, v] of inlineEnvs) envVars[k] = v;
      continue;
    }

    const rest = stripShellRedirections(tokens.slice(idx).map((t) => expandKnownVars(t, envVars)));
    const head = rest[0] ?? "";
    const second = rest[1] ?? "";
    const isVllmServe = head === "vllm" && second === "serve";
    const isPythonApiServer =
      (head === "python" || head === "python3") &&
      second === "-m" &&
      (rest[2] === "vllm.entrypoints.openai.api_server" || rest[2] === "vllm.entrypoints.cli.main");
    const isBareFlags = head.startsWith("-");

    if (isVllmServe || isPythonApiServer || isBareFlags) {
      for (const [k, v] of inlineEnvs) envVars[k] = v;
      if (isVllmServe) {
        serveTokens = rest.slice(2);
      } else if (isPythonApiServer) {
        serveTokens =
          rest[2] === "vllm.entrypoints.cli.main" && rest[3] === "serve" ? rest.slice(4) : rest.slice(3);
      } else {
        serveTokens = rest;
      }
    } else {
      shellPreamble.push(stmt.raw);
    }
  }

  return { serveTokens, envVars, shellPreamble };
}

function isEnabledSubConfig(val: unknown): boolean {
  const scalar = parsePydanticLaxBool(val);
  if (scalar !== undefined) return scalar;
  if (isRecord(val)) {
    const explicit = parsePydanticLaxBool(val.enabled ?? val.enable);
    return explicit !== undefined ? explicit : Object.keys(val).length > 0;
  }
  return false;
}

export function parseVllmServeCommand(rawText: string): ParsedVllmServeCommand {
  const diagnostics: CliParseDiagnostic[] = [];
  const normalized = normalizeContinuations(rawText);
  const rawStmts = splitStatements(normalized);
  const statements = rawStmts.map((s) => tokenizeStatement(s, diagnostics));
  const { serveTokens, envVars, shellPreamble } = findServeTokens(statements);

  if (rawText.trim().length === 0) {
    diagnostics.push({
      code: "parse-empty-command",
      severity: "error",
      message: "未输入启动命令。请粘贴 `vllm serve ...` 命令或选择下方预设场景。",
    });
  }

  let model: string | null = null;
  let servedModelName: string | null = null;
  let port: number | null = null;
  let host: string | null = null;
  let distributedExecutorBackend: string | null = null;
  let loadFormat: string | null = null;
  let shutdownTimeout: number | undefined;
  let mambaCacheMode: string | undefined;
  let trustRemoteCode = false;
  let enforceEager = false;
  let enableSleepMode = false;
  let enablePrefixCaching: boolean | undefined;
  let gpuMemoryUtilization: number | undefined;
  let rawDtype: string | undefined;
  let rawQuantization: string | undefined;
  let rawKvCacheDtype: string | undefined;
  let tpSize: number | undefined;
  let ppSize: number | undefined;
  let dpSize: number | undefined;
  let dataParallelSizeLocal: number | undefined;
  let pcpSize: number | undefined;
  let dcpSize: number | undefined;
  let enableExpertParallel: boolean | undefined;
  let maxModelLen: number | undefined;
  let maxNumBatchedTokens: number | undefined;
  let maxNumSeqs: number | undefined;
  let blockSize: number | undefined;
  let userSpecifiedBlockSize = false;
  let enableChunkedPrefill: boolean | undefined;
  let performanceMode: "balanced" | "throughput" | "interactivity" | undefined;
  let isLoraEnabled: boolean | undefined;
  let attentionBackend: string | undefined;
  let useSequenceParallelMoe: boolean | undefined;
  let enableDbo: boolean | undefined;
  let ubatchSize: number | undefined;
  let regularHotReloadFloatLiteral: string | undefined;
  let dottedHotReloadFloatLiteral: string | undefined;
  let regularAdditionalConfig: Record<string, unknown> | null = null;
  let dottedAdditionalConfig: Record<string, unknown> | null = null;
  let compilationConfig: Record<string, unknown> | null = null;
  let kvTransferConfig: Record<string, unknown> | null = null;
  let speculativeConfig: Record<string, unknown> | null = null;
  const unknownFlags: string[] = [];

  const readValue = (
    flag: string,
    inlineValue: string | undefined,
    i: number,
  ): [string | undefined, number] => {
    if (inlineValue !== undefined) return [inlineValue, i];
    const next = serveTokens[i + 1];
    if (next === undefined || (next.startsWith("-") && !/^-\d/.test(next))) {
      diagnostics.push({
        code: "parse-missing-flag-value",
        severity: "error",
        flag,
        message: `参数 ${flag} 缺少取值。`,
      });
      return [undefined, i];
    }
    return [next, i + 1];
  };

  for (let i = 0; i < serveTokens.length; i += 1) {
    const token = serveTokens[i] ?? "";
    if (!token.startsWith("-")) {
      if (model === null) model = token;
      continue;
    }

    const eqIdx = token.indexOf("=");
    const rawFlag = eqIdx > 0 ? token.slice(0, eqIdx) : token;
    const flag = normalizeCliFlag(rawFlag);
    const inlineVal = eqIdx > 0 ? token.slice(eqIdx + 1) : undefined;

    switch (flag) {
      case "--model": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) model = v;
        break;
      }
      case "--served-model-name": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) servedModelName = v;
        break;
      }
      case "-tp":
      case "--tensor-parallel-size": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) tpSize = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
        break;
      }
      case "-pp":
      case "--pipeline-parallel-size": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) ppSize = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
        break;
      }
      case "-dp":
      case "--data-parallel-size": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) dpSize = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
        break;
      }
      case "-dpl":
      case "--data-parallel-size-local": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) dataParallelSizeLocal = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
        break;
      }
      case "--pcp-size":
      case "--prefill-context-parallel-size": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) pcpSize = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
        break;
      }
      case "--dcp-size":
      case "--decode-context-parallel-size": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) dcpSize = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
        break;
      }
      case "--enable-expert-parallel":
        enableExpertParallel = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-enable-expert-parallel":
        enableExpertParallel = false;
        break;
      case "--max-model-len": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          maxModelLen = parseIntegerFlag(flag, v, diagnostics, {
            min: 1,
            allowMinusOne: true,
            allowSuffix: true,
          });
        }
        break;
      }
      case "--max-num-batched-tokens": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          maxNumBatchedTokens = parseIntegerFlag(flag, v, diagnostics, { min: 1, allowSuffix: true });
        }
        break;
      }
      case "--max-num-seqs": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          maxNumSeqs = parseIntegerFlag(flag, v, diagnostics, { min: 1, allowSuffix: true });
        }
        break;
      }
      case "--gpu-memory-utilization": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          gpuMemoryUtilization = parseFloatFlag(flag, v, diagnostics, { minExclusive: 0, maxInclusive: 1 });
        }
        break;
      }
      case "--dtype": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) rawDtype = v.trim().toLowerCase();
        break;
      }
      case "-q":
      case "--quantization": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) rawQuantization = v.trim().toLowerCase();
        break;
      }
      case "--kv-cache-dtype": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) rawKvCacheDtype = v.trim().toLowerCase();
        break;
      }
      case "--block-size": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          blockSize = parseIntegerFlag(flag, v, diagnostics, { min: 1 });
          userSpecifiedBlockSize = true;
        }
        break;
      }
      case "--enable-chunked-prefill":
        enableChunkedPrefill = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-enable-chunked-prefill":
        enableChunkedPrefill = false;
        break;
      case "--enable-prefix-caching":
        enablePrefixCaching = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-enable-prefix-caching":
        enablePrefixCaching = false;
        break;
      case "--enforce-eager":
        enforceEager = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-enforce-eager":
        enforceEager = false;
        break;
      case "--enable-lora":
        isLoraEnabled = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-enable-lora":
        isLoraEnabled = false;
        break;
      case "--enable-sleep-mode":
        enableSleepMode = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-enable-sleep-mode":
        enableSleepMode = false;
        break;
      case "--trust-remote-code":
        trustRemoteCode = true;
        break;
      case "--performance-mode": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        const lower = v?.trim().toLowerCase();
        if (lower === "balanced" || lower === "throughput" || lower === "interactivity") {
          performanceMode = lower;
        }
        break;
      }
      case "--attention-backend": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) attentionBackend = v.trim().toUpperCase();
        break;
      }
      case "--use-sequence-parallel-moe":
        useSequenceParallelMoe = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-use-sequence-parallel-moe":
        useSequenceParallelMoe = false;
        break;
      case "--enable-dbo":
        enableDbo = inlineVal !== undefined ? (parseBoolLike(inlineVal) ?? true) : true;
        break;
      case "--no-enable-dbo":
        enableDbo = false;
        break;
      case "--ubatch-size": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          ubatchSize = parseIntegerFlag(flag, v, diagnostics, { min: 0 });
        }
        break;
      }
      case "--distributed-executor-backend": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) distributedExecutorBackend = v.trim();
        break;
      }
      case "--load-format": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) loadFormat = v.trim();
        break;
      }
      case "--shutdown-timeout": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          const parsedTimeout = parseIntegerFlag(flag, v, diagnostics, { min: 0 });
          if (parsedTimeout !== undefined) {
            shutdownTimeout = parsedTimeout;
          }
        }
        break;
      }
      case "--mamba-cache-mode": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) mambaCacheMode = v.trim().toLowerCase();
        break;
      }
      case "--host": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) host = v.trim();
        break;
      }
      case "--port": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          port = parseIntegerFlag(flag, v, diagnostics, { min: 1, max: 65535 }) ?? null;
        }
        break;
      }
      case "--additional-config": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) {
          const floatMatch =
            /["']runtime_config_hot_reload["']\s*:\s*(-?\d+(?:\.\d+(?:[eE][+-]?\d+)?|[eE][+-]?\d+))/.exec(v);
          regularHotReloadFloatLiteral = floatMatch?.[1];
          const parsedObj = parseJsonObjectFlag(flag, v, diagnostics);
          if (parsedObj) {
            regularAdditionalConfig = parsedObj;
          }
        }
        break;
      }
      case "-cc":
      case "--compilation-config": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) compilationConfig = parseJsonObjectFlag(flag, v, diagnostics);
        break;
      }
      case "--kv-transfer-config": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) kvTransferConfig = parseJsonObjectFlag(flag, v, diagnostics);
        break;
      }
      case "--speculative-config": {
        const [v, ni] = readValue(flag, inlineVal, i);
        i = ni;
        if (v !== undefined) speculativeConfig = parseJsonObjectFlag(flag, v, diagnostics);
        break;
      }
      default: {
        if (flag.startsWith("--additional-config.")) {
          let dottedPath = flag.slice("--additional-config.".length);
          const isListAppend = dottedPath.endsWith("+");
          if (isListAppend) dottedPath = dottedPath.slice(0, -1);
          const segments = dottedPath.split(".").filter((seg) => seg.length > 0);
          const [v, ni] = readValue(flag, inlineVal, i);
          i = ni;
          if (v !== undefined && segments.length > 0) {
            if (segments.some((seg) => FORBIDDEN_DOTTED_KEYS.has(seg))) {
              diagnostics.push({
                code: "parse-invalid-json",
                severity: "error",
                flag,
                message: `非法配置键路径 '${dottedPath}'。`,
              });
              break;
            }
            if (!dottedAdditionalConfig) dottedAdditionalConfig = {};
            if (segments.length === 1 && segments[0] === "runtime_config_hot_reload") {
              dottedHotReloadFloatLiteral = /^-?\d+(?:\.\d+(?:[eE][+-]?\d+)?|[eE][+-]?\d+)$/.test(v.trim())
                ? v.trim()
                : undefined;
            }
            const parsedVal = isListAppend ? v.split(",") : parseDottedScalarOrJson(v);
            setDottedRecordValue(dottedAdditionalConfig, segments, parsedVal);
          }
          break;
        }
        const isKnownNoArgBool =
          KNOWN_NO_ARG_BOOL_FLAGS.has(flag) || /^--(?:no-)?(?:enable|disable)-/.test(flag);
        if (!KNOWN_NO_ARG_BOOL_FLAGS.has(flag)) {
          unknownFlags.push(flag);
        }
        // Only consume a following non-flag token if the flag is not a no-arg boolean and does not steal <model>
        if (inlineVal === undefined && !isKnownNoArgBool) {
          const peek = serveTokens[i + 1];
          if (peek !== undefined && !peek.startsWith("-") && !(model === null && isLikelyModelArg(peek))) {
            i += 1;
          }
        }
        break;
      }
    }
  }

  // Validate VLLM_PORT if present in envVars (K8s tcp:// URI raises ValueError in vllm/envs.py#L710)
  if (Object.hasOwn(envVars, "VLLM_PORT")) {
    const rawVllmPort = (envVars.VLLM_PORT ?? "").trim();
    if (rawVllmPort.includes("://") || (rawVllmPort.length > 0 && !/^\d+$/.test(rawVllmPort))) {
      diagnostics.push({
        code: "parse-invalid-vllm-port",
        severity: "error",
        flag: "VLLM_PORT",
        message: `ValueError: VLLM_PORT='${rawVllmPort}' 非纯整数（Kubernetes 同名 Service 注入 tcp:// URI 会直接报错）。`,
        remediation: "取消 VLLM_PORT 环境变量或将其设为纯整数端口。",
      });
    }
  }

  const visibleDevices = parseVisibleDevices(envVars.ASCEND_RT_VISIBLE_DEVICES, diagnostics);
  const inferredHints = inferModelHints(model);

  // Assemble CouplingCheckInput from CLI flags + JSON configs + env vars + model hints
  const couplingInput: CouplingCheckInput = {
    usageContext: "vllm_serve",
    tpSize: tpSize ?? 1,
    ppSize: ppSize ?? 1,
    dpSize: dpSize ?? 1,
    pcpSize: pcpSize ?? 1,
    dcpSize: dcpSize ?? 1,
    userSpecifiedBlockSize,
    enableSleepMode,
    envVars,
  };

  if (inferredHints.isMoe !== undefined) couplingInput.isMoe = inferredHints.isMoe;
  if (inferredHints.hasRoutedExpertHiddenSize !== undefined) {
    couplingInput.hasRoutedExpertHiddenSize = inferredHints.hasRoutedExpertHiddenSize;
  }
  if (inferredHints.useMla !== undefined) couplingInput.useMla = inferredHints.useMla;
  if (inferredHints.usesSfaSparse !== undefined) couplingInput.usesSfaSparse = inferredHints.usesSfaSparse;
  if (inferredHints.isQwen35Dense !== undefined) couplingInput.isQwen35Dense = inferredHints.isQwen35Dense;
  if (inferredHints.modelType !== undefined) couplingInput.modelType = inferredHints.modelType;
  if (inferredHints.numExperts !== undefined) couplingInput.numExperts = inferredHints.numExperts;
  if (inferredHints.numExpertsPerTok !== undefined)
    couplingInput.numExpertsPerTok = inferredHints.numExpertsPerTok;
  if (inferredHints.numAttentionHeads !== undefined)
    couplingInput.numAttentionHeads = inferredHints.numAttentionHeads;
  if (inferredHints.numKvHeads !== undefined) couplingInput.numKvHeads = inferredHints.numKvHeads;
  if (inferredHints.headDim !== undefined) couplingInput.headDim = inferredHints.headDim;
  if (inferredHints.kvLoraRank !== undefined) couplingInput.kvLoraRank = inferredHints.kvLoraRank;
  if (inferredHints.qkRopeHeadDim !== undefined) couplingInput.qkRopeHeadDim = inferredHints.qkRopeHeadDim;

  const explicitDtype = normalizeModelDtype(rawDtype);
  if (explicitDtype !== undefined) {
    couplingInput.modelDtype = explicitDtype;
  } else if (inferredHints.defaultModelDtype !== undefined) {
    couplingInput.modelDtype = inferredHints.defaultModelDtype;
  }

  const effectiveQuant = rawQuantization ?? inferredHints.quantMethod;
  if (effectiveQuant !== undefined) couplingInput.quantMethod = effectiveQuant;
  if (inferredHints.quantScheme !== undefined) couplingInput.quantScheme = inferredHints.quantScheme;
  if (inferredHints.hasWeightBlockSize !== undefined)
    couplingInput.hasWeightBlockSize = inferredHints.hasWeightBlockSize;
  if (inferredHints.activationScheme !== undefined)
    couplingInput.activationScheme = inferredHints.activationScheme;
  if (inferredHints.enableC8Quant !== undefined) couplingInput.enableC8Quant = inferredHints.enableC8Quant;

  if (enableExpertParallel !== undefined) couplingInput.enableExpertParallel = enableExpertParallel;
  if (maxModelLen !== undefined && maxModelLen > 0) {
    couplingInput.maxModelLen = maxModelLen;
  } else if (inferredHints.defaultMaxModelLen !== undefined) {
    couplingInput.maxModelLen = inferredHints.defaultMaxModelLen;
  }
  if (maxNumBatchedTokens !== undefined) couplingInput.maxNumBatchedTokens = maxNumBatchedTokens;
  if (maxNumSeqs !== undefined) couplingInput.maxNumSeqs = maxNumSeqs;
  if (blockSize !== undefined) couplingInput.blockSize = blockSize;
  if (enableChunkedPrefill !== undefined) couplingInput.enableChunkedPrefill = enableChunkedPrefill;
  if (performanceMode !== undefined) couplingInput.performanceMode = performanceMode;
  if (isLoraEnabled !== undefined) couplingInput.isLoraEnabled = isLoraEnabled;
  const additionalConfig: Record<string, unknown> | null = dottedAdditionalConfig ?? regularAdditionalConfig;
  const rawHotReloadFloatLiteral: string | undefined = dottedAdditionalConfig
    ? dottedHotReloadFloatLiteral
    : regularHotReloadFloatLiteral;
  const useUbatching: boolean | undefined =
    enableDbo === true || (ubatchSize !== undefined && ubatchSize > 1)
      ? true
      : enableDbo === false || ubatchSize !== undefined
        ? false
        : undefined;

  if (attentionBackend !== undefined) couplingInput.attentionBackend = attentionBackend;
  if (useSequenceParallelMoe !== undefined) couplingInput.useSequenceParallelMoe = useSequenceParallelMoe;
  if (useUbatching !== undefined) couplingInput.useUbatching = useUbatching;
  if (enableDbo !== undefined) couplingInput.enableDbo = enableDbo;
  if (ubatchSize !== undefined) couplingInput.ubatchSize = ubatchSize;
  if (rawKvCacheDtype !== undefined) couplingInput.cacheDtype = rawKvCacheDtype;
  if (loadFormat !== null) couplingInput.loadFormat = loadFormat.toLowerCase();
  couplingInput.shutdownTimeout = shutdownTimeout ?? 0;
  if (mambaCacheMode !== undefined) couplingInput.mambaCacheMode = mambaCacheMode;

  // Env-driven coupling fields (vllm/envs.py uses bool(int(val)) for VLLM_USE_V2_MODEL_RUNNER & VLLM_BATCH_INVARIANT)
  for (const [envKey, targetField] of [
    ["VLLM_USE_V2_MODEL_RUNNER", "useV2ModelRunner"],
    ["VLLM_BATCH_INVARIANT", "vllmBatchInvariant"],
  ] as const) {
    if (Object.hasOwn(envVars, envKey)) {
      const rawEnv = envVars[envKey];
      const b = parseEnvIntBool(rawEnv);
      if (b !== undefined) {
        couplingInput[targetField] = b;
      } else {
        diagnostics.push({
          code: "parse-invalid-number",
          severity: "error",
          flag: envKey,
          message: `ValueError: 环境变量 ${envKey}='${rawEnv ?? ""}' 非十进制整数（上游 vllm/envs.py 通过 bool(int(...)) 解析该变量，传入非整数将在启动时抛出 ValueError）。`,
          remediation: `请将 ${envKey} 设为 1 或 0，或取消设置该环境变量。`,
        });
      }
    }
  }
  if (Object.hasOwn(envVars, "PYTORCH_NPU_ALLOC_CONF")) {
    const npuAlloc = envVars.PYTORCH_NPU_ALLOC_CONF;
    if (npuAlloc !== undefined) couplingInput.pytorchNpuAllocConf = npuAlloc;
  }
  if (parseBoolLike(envVars.VLLM_ASCEND_ENABLE_FLASHCOMM1) === true) {
    couplingInput.enableFlashcomm1 = true;
  }

  // Extract --compilation-config fields
  if (enforceEager) {
    couplingInput.cudagraphMode = "NONE";
  }
  if (compilationConfig) {
    const mode = normalizeCudaGraphMode(compilationConfig.cudagraph_mode);
    if (mode !== undefined) couplingInput.cudagraphMode = mode;
    if (Array.isArray(compilationConfig.cudagraph_capture_sizes)) {
      const sizes = compilationConfig.cudagraph_capture_sizes
        .map(parseNumberLike)
        .filter((n): n is number => n !== undefined);
      couplingInput.cudagraphCaptureSizes = sizes;
    }
    const maxCap = parseNumberLike(compilationConfig.max_cudagraph_capture_size);
    if (maxCap !== undefined) couplingInput.maxCudagraphCaptureSize = maxCap;
    if (Array.isArray(compilationConfig.custom_ops)) {
      couplingInput.customOps = compilationConfig.custom_ops.filter(
        (x): x is string => typeof x === "string",
      );
    }
    if (isRecord(compilationConfig.pass_config)) {
      const sp = parsePydanticLaxBool(compilationConfig.pass_config.enable_sp);
      if (sp !== undefined) couplingInput.enableSp = sp;
    }
  }

  // Extract --additional-config fields
  if (additionalConfig) {
    const acc = isRecord(additionalConfig.ascend_compilation_config)
      ? additionalConfig.ascend_compilation_config
      : null;
    if (acc) {
      const npugraph = parsePydanticLaxBool(acc.enable_npugraph_ex);
      if (npugraph !== undefined) couplingInput.enableNpugraphEx = npugraph;
      const staticK = parsePydanticLaxBool(acc.enable_static_kernel);
      if (staticK !== undefined) couplingInput.enableStaticKernel = staticK;
      const superK = parsePydanticLaxBool(acc.enable_super_kernel);
      if (superK !== undefined) couplingInput.enableSuperKernel = superK;
    }
    const sched =
      (isRecord(additionalConfig.scheduler_config) ? additionalConfig.scheduler_config : null) ??
      (isRecord(additionalConfig.ascend_scheduler_config) ? additionalConfig.ascend_scheduler_config : null);

    const recompute = parsePydanticLaxBool(
      additionalConfig.recompute_scheduler_enable ?? sched?.recompute_scheduler_enable,
    );
    if (recompute !== undefined) couplingInput.recomputeSchedulerEnable = recompute;

    const balSched = parsePydanticLaxBool(
      additionalConfig.enable_balance_scheduling ?? sched?.enable_balance_scheduling,
    );
    if (balSched !== undefined) couplingInput.enableBalanceScheduling = balSched;

    const profChunk = additionalConfig.profiling_chunk_config ?? sched?.profiling_chunk_config;
    if (isEnabledSubConfig(profChunk)) {
      couplingInput.profilingChunkEnabled = true;
      if (isRecord(profChunk)) {
        const minChunk = parseNumberLike(profChunk.min_chunk);
        if (minChunk !== undefined) couplingInput.profilingMinChunk = minChunk;
      }
    }
    if (isEnabledSubConfig(additionalConfig.batch_job_sched_config ?? sched?.batch_job_sched_config)) {
      couplingInput.batchJobSchedEnabled = true;
    }
    if (
      isEnabledSubConfig(additionalConfig.short_request_first_config ?? sched?.short_request_first_config)
    ) {
      couplingInput.shortRequestFirstEnabled = true;
    }
    if (isEnabledSubConfig(additionalConfig.dyntra_lb_config ?? sched?.dyntra_lb_config)) {
      couplingInput.dyntraLbEnabled = true;
    }

    const fc1 = parsePydanticLaxBool(additionalConfig.enable_flashcomm1);
    if (fc1 !== undefined) couplingInput.enableFlashcomm1 = fc1;
    const dsaCp = parsePydanticLaxBool(additionalConfig.enable_dsa_cp);
    if (dsaCp !== undefined) couplingInput.enableDsaCp = dsaCp;
    const fusedMc2 = parseNumberLike(additionalConfig.enable_fused_mc2);
    if (fusedMc2 === 0 || fusedMc2 === 1 || fusedMc2 === 2 || fusedMc2 === 3) {
      couplingInput.enableFusedMc2 = fusedMc2;
    } else if (fusedMc2 !== undefined) {
      diagnostics.push({
        code: "parse-invalid-range",
        severity: "error",
        flag: "additional_config.enable_fused_mc2",
        message: `additional_config.enable_fused_mc2 仅允许 0 / 1 (dispatch_ffn_combine) / 2 (MegaMoe) / 3 (MegaMoe+共享专家融合，仅 main；v0.30.0 仅支持 0/1/2)，收到 ${fusedMc2}。`,
      });
    }
    const prefillMc2 = parsePydanticLaxBool(additionalConfig.enable_prefill_mc2);
    if (prefillMc2 !== undefined) couplingInput.enablePrefillMc2 = prefillMc2;
    const nzMode = parseNumberLike(additionalConfig.weight_nz_mode);
    if (nzMode !== undefined) couplingInput.weightNzMode = nzMode;
    const sparseSfaC8 = parsePydanticLaxBool(additionalConfig.enable_sparse_sfa_c8);
    if (sparseSfaC8 !== undefined) couplingInput.enableSparseSfaC8 = sparseSfaC8;

    if (isRecord(additionalConfig.rl_config)) {
      const rlEn = parsePydanticLaxBool(additionalConfig.rl_config.enabled);
      if (rlEn !== undefined) couplingInput.rlEnabled = rlEn;
      const rlCons = parsePydanticLaxBool(additionalConfig.rl_config.training_consistency);
      if (rlCons !== undefined) couplingInput.rlTrainingConsistency = rlCons;
    }
    if (isEnabledSubConfig(additionalConfig.xlite_graph_config)) {
      couplingInput.xliteEnabled = true;
    }
    const qarc = additionalConfig.quantized_all_reduce_config;
    if (qarc !== undefined && qarc !== null) {
      if (!isRecord(qarc)) {
        couplingInput.quantizedAllReduceInvalidReason = `TypeError / ValidationError: additional_config.quantized_all_reduce_config 必须为字典对象（仅含 enable 与 min_numel），不能传 ${Array.isArray(qarc) ? "list" : typeof qarc}`;
      } else {
        const unknownQarKeys = Object.keys(qarc)
          .filter((k) => k !== "enable" && k !== "min_numel")
          .sort();
        if (unknownQarKeys.length > 0) {
          couplingInput.quantizedAllReduceInvalidReason = `ValidationError: additional_config.quantized_all_reduce_config 在 main@8d6180e2 仅支持 enable 与 min_numel 两个子键，未知子键将被 extra="forbid" 拒收：${unknownQarKeys.join("、")}`;
        }
        if (qarc.enable !== undefined) {
          const qEn = parsePydanticLaxBool(qarc.enable);
          if (qEn !== undefined) {
            couplingInput.quantizedAllReduceEnabled = qEn;
          } else {
            couplingInput.quantizedAllReduceInvalidReason = `ValidationError: additional_config.quantized_all_reduce_config.enable 必须为布尔值（收到 ${JSON.stringify(qarc.enable)}）`;
          }
        }
        if (qarc.min_numel !== undefined) {
          const minNumel = parsePydanticLaxInt(qarc.min_numel);
          if (minNumel !== undefined) {
            couplingInput.quantizedAllReduceMinNumel = minNumel;
          } else {
            couplingInput.quantizedAllReduceInvalidReason = `ValidationError: additional_config.quantized_all_reduce_config.min_numel 必须为整数（收到 ${JSON.stringify(qarc.min_numel)}）`;
          }
        }
      }
    }

    const MAIN_ONLY_ADDITIONAL_KEYS = [
      "shared_engram",
      "quantized_all_reduce_config",
      "runtime_config",
      "runtime_config_hot_reload",
      "runtime_config_path",
      "gdn_internal_prefill_checkpoints",
      "kv_pool_range_debug",
      "megamoe_shared_expert_fusion",
    ] as const;
    const presentMainOnly = MAIN_ONLY_ADDITIONAL_KEYS.filter((k) => Object.hasOwn(additionalConfig, k));
    if (presentMainOnly.length > 0) {
      couplingInput.mainOnlyAdditionalConfigKeys = presentMainOnly;
    }

    const sedp = parsePydanticLaxBool(additionalConfig.enable_shared_expert_dp);
    if (sedp !== undefined) couplingInput.enableSharedExpertDp = sedp;
    const mmSef = parsePydanticLaxBool(additionalConfig.megamoe_shared_expert_fusion);
    if (mmSef !== undefined) couplingInput.megamoeSharedExpertFusion = mmSef;
    const meo = parsePydanticLaxBool(additionalConfig.multistream_engram_overlap);
    if (meo !== undefined) couplingInput.multistreamEngramOverlap = meo;
    const gdnCp = parsePydanticLaxBool(additionalConfig.gdn_internal_prefill_checkpoints);
    if (gdnCp !== undefined) couplingInput.gdnInternalPrefillCheckpoints = gdnCp;
    const kvDbg = parsePydanticLaxBool(additionalConfig.kv_pool_range_debug);
    if (kvDbg !== undefined) couplingInput.kvPoolRangeDebug = kvDbg;

    const rawSe = additionalConfig.shared_engram;
    if (rawSe !== undefined && rawSe !== null) {
      couplingInput.sharedEngramConfigured = true;
      if (!isRecord(rawSe)) {
        couplingInput.sharedEngramInvalidReason = `ValidationError: additional_config.shared_engram 必须为字典对象（收到 ${Array.isArray(rawSe) ? "list" : typeof rawSe}）`;
      } else {
        const ALLOWED_SE_KEYS = new Set([
          "backend",
          "endpoint",
          "capacity",
          "library_path",
          "listen_port",
          "local_comm_res",
        ]);
        const unknownSeKeys = Object.keys(rawSe)
          .filter((k) => !ALLOWED_SE_KEYS.has(k))
          .sort();
        if (unknownSeKeys.length > 0) {
          couplingInput.sharedEngramInvalidReason = `ValidationError: additional_config.shared_engram 未知子键将被 extra="forbid" 拒收：${unknownSeKeys.join("、")}`;
        }
        if (rawSe.backend !== undefined) {
          if (typeof rawSe.backend === "string") {
            couplingInput.sharedEngramBackend = rawSe.backend.trim();
          } else {
            couplingInput.sharedEngramBackend = String(rawSe.backend);
            couplingInput.sharedEngramInvalidReason ??= `ValidationError: shared_engram.backend 必须为字符串（不能为 null，收到 ${JSON.stringify(rawSe.backend)}）`;
          }
        }
        if (rawSe.endpoint !== undefined) {
          if (typeof rawSe.endpoint === "string") {
            couplingInput.sharedEngramEndpoint = rawSe.endpoint.trim();
          } else {
            couplingInput.sharedEngramInvalidReason ??= `ValidationError: shared_engram.endpoint 必须为字符串（收到 ${JSON.stringify(rawSe.endpoint)}）`;
          }
        }
        if (rawSe.capacity !== undefined) {
          const seCap = parsePydanticLaxInt(rawSe.capacity);
          if (seCap !== undefined) {
            couplingInput.sharedEngramCapacity = seCap;
          } else {
            couplingInput.sharedEngramInvalidReason ??= `ValidationError: shared_engram.capacity 必须为整数（不能为 null；省略该字段才使用默认值 65536，收到 ${JSON.stringify(rawSe.capacity)}）`;
          }
        }
        if (rawSe.library_path !== undefined && rawSe.library_path !== null) {
          if (typeof rawSe.library_path === "string") {
            if (rawSe.library_path.length > 0) couplingInput.sharedEngramLibraryPath = rawSe.library_path;
          } else {
            couplingInput.sharedEngramInvalidReason ??= `ValidationError: shared_engram.library_path 必须为字符串`;
          }
        }
        if (rawSe.listen_port !== undefined && rawSe.listen_port !== null) {
          const seLp = parsePydanticLaxInt(rawSe.listen_port);
          if (seLp !== undefined) {
            couplingInput.sharedEngramListenPort = seLp;
          } else {
            couplingInput.sharedEngramInvalidReason ??= `ValidationError: shared_engram.listen_port 必须为整数（收到 ${JSON.stringify(rawSe.listen_port)}）`;
          }
        }
        if (rawSe.local_comm_res !== undefined && rawSe.local_comm_res !== null) {
          if (typeof rawSe.local_comm_res === "string") {
            if (rawSe.local_comm_res.length > 0) {
              couplingInput.sharedEngramLocalCommRes = rawSe.local_comm_res;
            }
          } else {
            couplingInput.sharedEngramInvalidReason ??= `ValidationError: shared_engram.local_comm_res 必须为字符串`;
          }
        }
      }
    }

    const rawRc = additionalConfig.runtime_config;
    if (rawRc !== undefined && rawRc !== null) {
      if (isRecord(rawRc)) {
        couplingInput.runtimeConfigConfigured = true;
        if (Object.hasOwn(rawRc, "runtime_config_hot_reload")) {
          couplingInput.runtimeConfigHasNestedHotReload = true;
        }
        if (
          isRecord(rawRc.dump) &&
          rawRc.dump.manual_dump !== undefined &&
          rawRc.dump.manual_dump !== null &&
          rawRc.dump.manual_dump !== false &&
          rawRc.dump.manual_dump !== 0
        ) {
          couplingInput.runtimeConfigManualDumpSet = true;
        }
      } else {
        couplingInput.runtimeConfigInvalidType = Array.isArray(rawRc) ? "list" : typeof rawRc;
      }
    }
    const rawRcp = additionalConfig.runtime_config_path;
    if (rawRcp !== undefined && rawRcp !== null) {
      if (typeof rawRcp === "string") {
        couplingInput.runtimeConfigPathConfigured = true;
      } else {
        couplingInput.runtimeConfigPathInvalidType = Array.isArray(rawRcp) ? "list" : typeof rawRcp;
      }
    }
    const rawHr = additionalConfig.runtime_config_hot_reload;
    if (rawHotReloadFloatLiteral !== undefined) {
      couplingInput.runtimeConfigHotReloadInvalidValue = rawHotReloadFloatLiteral;
    } else if (rawHr !== undefined && rawHr !== null) {
      if (typeof rawHr === "boolean") {
        couplingInput.runtimeConfigHotReload = rawHr;
      } else if (rawHr === 0 || rawHr === 1) {
        couplingInput.runtimeConfigHotReload = rawHr === 1;
      } else {
        couplingInput.runtimeConfigHotReloadInvalidValue = rawHr;
      }
    }
    if (isRecord(additionalConfig.finegrained_tp_config)) {
      const oproj = parseNumberLike(additionalConfig.finegrained_tp_config.oproj_tensor_parallel_size);
      if (oproj !== undefined) couplingInput.oprojTensorParallelSize = oproj;
      const mlp = parseNumberLike(additionalConfig.finegrained_tp_config.mlp_tensor_parallel_size);
      if (mlp !== undefined) couplingInput.mlpTensorParallelSize = mlp;
      const emb = parseNumberLike(additionalConfig.finegrained_tp_config.embedding_tensor_parallel_size);
      if (emb !== undefined) couplingInput.embeddingTensorParallelSize = emb;
    }
    if (isEnabledSubConfig(additionalConfig.sparse_kv_offload_config)) {
      couplingInput.sparseKvOffloadEnabled = true;
      if (isRecord(additionalConfig.sparse_kv_offload_config)) {
        const keep = parsePydanticLaxBool(additionalConfig.sparse_kv_offload_config.keep_device_kv_cache);
        if (keep !== undefined) couplingInput.keepDeviceKvCache = keep;
        const topkBuf = parseNumberLike(additionalConfig.sparse_kv_offload_config.topk_buffer_size);
        if (topkBuf !== undefined) couplingInput.topkBufferSize = topkBuf;
      }
    }
  }

  // Extract --kv-transfer-config fields
  if (kvTransferConfig) {
    if (
      typeof kvTransferConfig.kv_connector === "string" &&
      kvTransferConfig.kv_connector.trim().length > 0
    ) {
      couplingInput.kvConnector = kvTransferConfig.kv_connector.trim();
    }
    const role = normalizeKvRole(kvTransferConfig.kv_role);
    if (role !== undefined) couplingInput.kvRole = role;
    if (isRecord(kvTransferConfig.kv_connector_extra_config)) {
      const extra = kvTransferConfig.kv_connector_extra_config;
      const prefillExtra = isRecord(extra.prefill) ? extra.prefill : null;
      const decodeExtra = isRecord(extra.decode) ? extra.decode : null;
      const pTp = parseNumberLike(extra.prefill_tp_size ?? prefillExtra?.tp_size);
      if (pTp !== undefined) couplingInput.prefillTpSize = pTp;
      const dTp = parseNumberLike(extra.decode_tp_size ?? decodeExtra?.tp_size);
      if (dTp !== undefined) couplingInput.decodeTpSize = dTp;
      if (Array.isArray(extra.connectors)) {
        const hasPreempt = extra.connectors.some(
          (c) => isRecord(c) && c.kv_connector === "PreemptOffloadConnector",
        );
        if (hasPreempt) couplingInput.hasPreemptOffloadConnector = true;
      }
    }
  }

  // Extract --speculative-config fields
  if (speculativeConfig) {
    const specTokens = parseNumberLike(speculativeConfig.num_speculative_tokens);
    if (specTokens !== undefined) couplingInput.numSpecTokens = specTokens;
    if (typeof speculativeConfig.method === "string") {
      couplingInput.speculativeMethod = speculativeConfig.method.trim().toLowerCase();
    }
  }

  const tp = Math.max(1, couplingInput.tpSize ?? 1);
  const pp = Math.max(1, couplingInput.ppSize ?? 1);
  const dpLocal = Math.max(1, dataParallelSizeLocal ?? couplingInput.dpSize ?? 1);
  const pcp = Math.max(1, couplingInput.pcpSize ?? 1);
  const requiredLocalRanks = tp * pp * dpLocal * pcp;

  return {
    rawText,
    normalizedCommandLine: serveTokens.join(" "),
    shellPreamble,
    envVars,
    visibleDevices,
    model,
    servedModelName,
    port,
    host,
    distributedExecutorBackend,
    loadFormat,
    trustRemoteCode,
    enforceEager,
    enableSleepMode,
    enablePrefixCaching,
    gpuMemoryUtilization,
    rawDtype,
    rawQuantization,
    rawKvCacheDtype,
    dataParallelSizeLocal,
    additionalConfig,
    compilationConfig,
    kvTransferConfig,
    speculativeConfig,
    unknownFlags,
    parseDiagnostics: diagnostics,
    inferredHints,
    couplingInput,
    requiredLocalRanks,
  };
}
