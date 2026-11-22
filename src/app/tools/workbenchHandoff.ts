import {
  ASCEND_CALC_CARDS,
  type AscendCalcCardId,
  type KvCacheDtype,
  WAVE4_DEMO_PRESETS,
  type WeightPrecision,
} from "../../sim/modelspec/deployCalculator";
import { MODEL_PRESETS } from "../../sim/modelspec/presets";
import { parseAscendStartupLog } from "../../sim/modelspec/startupLogParser";
import type { AscendFamily, CudaGraphMode, RuleVersion } from "../../sim/rules";
import { analyzeTroubleshootInput } from "../../sim/troubleshoot/logAnalyzer";
import type { ChatAnalysisPayload } from "../wiki/chat-controller";

const ALLOWED_PRECISIONS = new Set<WeightPrecision>([
  "bf16",
  "fp16",
  "w8a8",
  "w8a8_dynamic",
  "w4a8",
  "fp8_block",
  "w8a8sc_310p",
]);

const ALLOWED_KV_DTYPES = new Set<KvCacheDtype>(["auto", "int8", "mxfp8"]);
const ALLOWED_PARALLEL_SIZES = new Set<number>([1, 2, 4, 8]);
const ALLOWED_CARDS = new Set<AscendCalcCardId>(ASCEND_CALC_CARDS.map((c) => c.id));
const ALLOWED_PRESETS = new Set<string>([
  ...MODEL_PRESETS.map((p) => p.id),
  ...WAVE4_DEMO_PRESETS.map((d) => d.id),
]);
const SAFE_WIKI_SLUG_RE = /^[a-z0-9][a-z0-9-_]{0,127}$/i;

export interface CalculatorQueryOverrides {
  subMode?: "static" | "reconcile" | undefined;
  presetId?: string | undefined;
  cardId?: AscendCalcCardId | undefined;
  weightPrecision?: WeightPrecision | undefined;
  kvCacheDtype?: KvCacheDtype | undefined;
  tpSize?: number | undefined;
  ppSize?: number | undefined;
  dpSize?: number | undefined;
  dcpSize?: number | undefined;
  enableEp?: boolean | undefined;
  gpuMemoryUtilization?: number | undefined;
  maxModelLen?: number | undefined;
  version?: Extract<RuleVersion, "v0.30.0" | "main"> | undefined;
}

export function parseCalculatorQueryParams(params: URLSearchParams): CalculatorQueryOverrides {
  const out: CalculatorQueryOverrides = {};

  const panel = params.get("panel");
  if (panel === "static" || panel === "reconcile") {
    out.subMode = panel;
  }

  const preset = params.get("preset")?.trim();
  if (preset && ALLOWED_PRESETS.has(preset)) {
    out.presetId = preset;
  }

  const card = params.get("card")?.trim() as AscendCalcCardId | undefined;
  if (card && ALLOWED_CARDS.has(card)) {
    out.cardId = card;
  }

  const precision = params.get("precision")?.trim() as WeightPrecision | undefined;
  if (precision && ALLOWED_PRECISIONS.has(precision)) {
    out.weightPrecision = precision;
  }

  const kv = params.get("kv")?.trim() as KvCacheDtype | undefined;
  if (kv && ALLOWED_KV_DTYPES.has(kv)) {
    out.kvCacheDtype = kv;
  }

  const parseParallel = (key: string): number | undefined => {
    const raw = params.get(key);
    if (!raw || !/^\d+$/.test(raw)) return undefined;
    const n = Number(raw);
    return ALLOWED_PARALLEL_SIZES.has(n) ? n : undefined;
  };

  const tp = parseParallel("tp");
  if (tp !== undefined) out.tpSize = tp;
  const pp = parseParallel("pp");
  if (pp !== undefined) out.ppSize = pp;
  const dp = parseParallel("dp");
  if (dp !== undefined) out.dpSize = dp;
  const dcp = parseParallel("dcp");
  if (dcp !== undefined) out.dcpSize = dcp;

  const ep = params.get("ep");
  if (ep === "1" || ep === "true") out.enableEp = true;
  else if (ep === "0" || ep === "false") out.enableEp = false;

  const uRaw = params.get("u");
  if (uRaw && /^\d*(?:\.\d+)?$/.test(uRaw)) {
    const u = Number(uRaw);
    if (Number.isFinite(u) && u >= 0.7 && u <= 0.98) {
      out.gpuMemoryUtilization = Number(u.toFixed(2));
    }
  }

  const maxLenRaw = params.get("maxLen");
  if (maxLenRaw && /^\d+$/.test(maxLenRaw)) {
    const len = Number(maxLenRaw);
    if (len >= 512 && len <= 131072) {
      out.maxModelLen = len;
    }
  }

  const version = params.get("version");
  if (version === "v0.30.0" || version === "main") {
    out.version = version;
  }

  return out;
}

export function buildCalculatorQueryParams(
  input: CalculatorQueryOverrides,
  preserve?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams();
  next.set("tab", "calculator");
  if (preserve) {
    const fromPage = preserve.get("fromPage");
    const fromAnchor = preserve.get("fromAnchor");
    if (fromPage && SAFE_WIKI_SLUG_RE.test(fromPage)) next.set("fromPage", fromPage);
    if (fromAnchor) next.set("fromAnchor", fromAnchor);
  }
  if (input.subMode && input.subMode !== "static") next.set("panel", input.subMode);
  if (input.presetId && ALLOWED_PRESETS.has(input.presetId)) next.set("preset", input.presetId);
  if (input.cardId && ALLOWED_CARDS.has(input.cardId)) next.set("card", input.cardId);
  if (input.weightPrecision && ALLOWED_PRECISIONS.has(input.weightPrecision)) {
    next.set("precision", input.weightPrecision);
  }
  if (input.kvCacheDtype && ALLOWED_KV_DTYPES.has(input.kvCacheDtype)) {
    next.set("kv", input.kvCacheDtype);
  }
  if (input.tpSize && ALLOWED_PARALLEL_SIZES.has(input.tpSize)) next.set("tp", String(input.tpSize));
  if (input.ppSize && input.ppSize > 1 && ALLOWED_PARALLEL_SIZES.has(input.ppSize)) {
    next.set("pp", String(input.ppSize));
  }
  if (input.dpSize && input.dpSize > 1 && ALLOWED_PARALLEL_SIZES.has(input.dpSize)) {
    next.set("dp", String(input.dpSize));
  }
  if (input.dcpSize && input.dcpSize > 1 && ALLOWED_PARALLEL_SIZES.has(input.dcpSize)) {
    next.set("dcp", String(input.dcpSize));
  }
  if (input.enableEp !== undefined) next.set("ep", input.enableEp ? "1" : "0");
  if (input.gpuMemoryUtilization !== undefined) next.set("u", input.gpuMemoryUtilization.toFixed(2));
  if (input.maxModelLen !== undefined) next.set("maxLen", String(input.maxModelLen));
  if (input.version === "v0.30.0" || input.version === "main") next.set("version", input.version);
  return next;
}

export interface ToolsBackTarget {
  pathname: string;
  hash: string;
  fromPage: string | null;
}

export function resolveToolsBackTarget(params: URLSearchParams): ToolsBackTarget {
  const rawPage = params.get("fromPage")?.trim() ?? "";
  if (!rawPage || !SAFE_WIKI_SLUG_RE.test(rawPage)) {
    return { pathname: "/wiki", hash: "", fromPage: null };
  }
  const rawAnchor = (params.get("fromAnchor")?.trim() ?? "").replace(/^#+/, "");
  const safeAnchor = rawAnchor && !/[\r\n\0/\\]/.test(rawAnchor) ? `#${rawAnchor}` : "";
  return {
    pathname: `/wiki/${rawPage}`,
    hash: safeAnchor,
    fromPage: rawPage,
  };
}

export function cardIdToHardwareFamily(cardId: string): AscendFamily {
  const lower = cardId.toLowerCase();
  if (lower.startsWith("310p")) return "310P";
  if (lower.startsWith("a3")) return "A3";
  if (lower.startsWith("a5") || lower.startsWith("950")) return "A5";
  return "A2";
}

export function hasReconcilableStartupMetrics(rawText: string): boolean {
  const trimmed = rawText.trim();
  if (!trimmed) return false;
  const startup = parseAscendStartupLog(trimmed);
  if (startup.matchedLines.length > 0) return true;
  const diag = analyzeTroubleshootInput(trimmed);
  if (diag.findings.some((f) => f.category === "memory")) return true;
  if (diag.metrics.kvCacheUsageRatio !== undefined) return true;
  return false;
}

export function sanitizeDiagnosticText(raw: string): { sanitized: string; redactionCount: number } {
  let redactionCount = 0;
  let text = raw;

  const replaceCounted = (pattern: RegExp, replacer: string | ((...args: string[]) => string)) => {
    text = text.replace(pattern, (...args) => {
      redactionCount += 1;
      if (typeof replacer === "function") {
        return replacer(...(args as string[]));
      }
      return replacer;
    });
  };

  // 1. URL Basic Auth credentials: http(s)://user:pass@host
  replaceCounted(/(https?:\/\/)([^/\s:@]+):([^/\s@]+)@/gi, "$1[REDACTED_AUTH]@");

  // 2. Authorization Bearer tokens
  replaceCounted(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{6,}/gi, "$1[REDACTED_TOKEN]");

  // 3. Multi-value CLI credential flags (e.g. --api-key KEY1 KEY2 --port 8000, including \\\n shell continuations)
  const sepTokenRe =
    /((?:[ \t]+(?:\\\r?\n[ \t]*)*|\\\r?\n[ \t]*))("[^"\r\n]*"|'[^'\r\n]*'|(?![-\\;|&<>(){}])[^\s"'\\;|&<>(){}]+)/g;
  const redactFlagValues = (full: string, flag: string, tail: string): string => {
    if (/^[ \t]*=/.test(tail)) {
      redactionCount += 1;
      return `${flag}=[REDACTED]`;
    }
    let matched = 0;
    const replaced = tail.replace(sepTokenRe, (_m, sep: string) => {
      matched += 1;
      return `${sep}[REDACTED]`;
    });
    if (matched === 0) return full;
    redactionCount += matched;
    return `${flag}${replaced}`;
  };
  text = text.replace(
    /(?<![A-Za-z0-9_-])(--(?:api[-_]?key|access[-_]?token|auth[-_]?token|bearer[-_]?token|token|password|passwd|secret|client[-_]?secret|bearer))((?:[ \t]*=[ \t]*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s"'\\;|&<>(){}]+))|(?:(?:(?:[ \t]+(?:\\\r?\n[ \t]*)*|\\\r?\n[ \t]*)(?:"[^"\r\n]*"|'[^'\r\n]*'|(?![-\\;|&<>(){}])[^\s"'\\;|&<>(){}]+))+))/gi,
    redactFlagValues,
  );

  // 3b. Env vars carrying API keys / HF tokens
  replaceCounted(
    /((?:OPENAI_API_KEY|VLLM_API_KEY|HF_TOKEN|HUGGING_FACE_HUB_TOKEN|ANTHROPIC_API_KEY)=)(['"]?)[^\s'"]+(['"]?)/gi,
    "$1$2[REDACTED_KEY]$3",
  );

  // 4. Standalone sk- / hf_ tokens
  replaceCounted(/\b(?:sk-[A-Za-z0-9_-]{10,}|hf_[A-Za-z0-9]{10,})\b/g, "[REDACTED_KEY]");

  // 5. Valid 4-octet IPv4 addresses (preserves :port if present, never matches 3-part versions like v0.30.0)
  text = text.replace(
    /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![.\d])/g,
    (full, o1: string, o2: string, o3: string, o4: string) => {
      const octets = [Number(o1), Number(o2), Number(o3), Number(o4)];
      if (octets.every((n) => n >= 0 && n <= 255)) {
        redactionCount += 1;
        return "<REDACTED_IP>";
      }
      return full;
    },
  );

  return { sanitized: text, redactionCount };
}

export interface DoctorHandoffPayload {
  readonly seq: number;
  readonly commandText: string;
  readonly hardwareFamily: AscendFamily;
  readonly version: Extract<RuleVersion, "v0.30.0" | "main">;
  readonly sourceLabel: string;
}

export interface ReconcileHandoffPayload {
  readonly seq: number;
  readonly logText: string;
  readonly sourceLabel: string;
}

export function createWorkbenchHandoffStore() {
  let doctorSeq = 0;
  let reconcileSeq = 0;
  let doctorPayload: DoctorHandoffPayload | null = null;
  let reconcilePayload: ReconcileHandoffPayload | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) listener();
  };

  return {
    getState: () => ({ doctorPayload, reconcilePayload }),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    sendToDoctor(input: Omit<DoctorHandoffPayload, "seq">): DoctorHandoffPayload {
      doctorSeq += 1;
      doctorPayload = { ...input, seq: doctorSeq };
      notify();
      return doctorPayload;
    },
    consumeDoctor(lastConsumedSeq = 0): DoctorHandoffPayload | null {
      if (!doctorPayload || doctorPayload.seq <= lastConsumedSeq) return null;
      const next = doctorPayload;
      doctorPayload = null;
      return next;
    },
    sendToReconcile(input: Omit<ReconcileHandoffPayload, "seq">): ReconcileHandoffPayload {
      reconcileSeq += 1;
      reconcilePayload = { ...input, seq: reconcileSeq };
      notify();
      return reconcilePayload;
    },
    consumeReconcile(lastConsumedSeq = 0): ReconcileHandoffPayload | null {
      if (!reconcilePayload || reconcilePayload.seq <= lastConsumedSeq) return null;
      const next = reconcilePayload;
      reconcilePayload = null;
      return next;
    },
  };
}

export const workbenchHandoffStore = createWorkbenchHandoffStore();

const MAX_DEPLOY_CONFIG_BYTES = 64 * 1024;
const MAX_DOCTOR_COMMAND_CHARS = 8 * 1024;
const MAX_TROUBLESHOOT_CHARS = 64 * 1024;

export type DeployChatAnalysisPayload = Extract<ChatAnalysisPayload, { kind: "deploy" }>;
export type DoctorChatAnalysisPayload = Extract<ChatAnalysisPayload, { kind: "doctor" }>;
export type TroubleshootChatAnalysisPayload = Extract<ChatAnalysisPayload, { kind: "troubleshoot" }>;

export function buildDeployChatAnalysis(input: {
  model: string | Record<string, unknown>;
  cardId: AscendCalcCardId;
  version?: RuleVersion | undefined;
  weightPrecision?: WeightPrecision | undefined;
  kvCacheDtype?: KvCacheDtype | undefined;
  weightNzMode?: 0 | 1 | 2 | undefined;
  tpSize?: number | undefined;
  ppSize?: number | undefined;
  dpSize?: number | undefined;
  dcpSize?: number | undefined;
  enableEp?: boolean | undefined;
  gpuMemoryUtilization?: number | undefined;
  maxModelLen?: number | undefined;
  maxNumBatchedTokens?: number | undefined;
  maxNumSeqs?: number | undefined;
  cudagraphMode?: CudaGraphMode | undefined;
  enforceEager?: boolean | undefined;
  decodeBatchSize?: number | undefined;
  prefillTokens?: number | undefined;
  decodeContextLen?: number | undefined;
}): DeployChatAnalysisPayload | undefined {
  let model: string | Record<string, unknown>;
  if (typeof input.model === "string") {
    const trimmed = input.model.trim();
    if (!trimmed || !ALLOWED_PRESETS.has(trimmed)) return undefined;
    model = trimmed;
  } else if (input.model && typeof input.model === "object" && !Array.isArray(input.model)) {
    try {
      const encoded = new TextEncoder().encode(JSON.stringify(input.model));
      if (encoded.byteLength > MAX_DEPLOY_CONFIG_BYTES) return undefined;
    } catch {
      return undefined;
    }
    model = input.model;
  } else {
    return undefined;
  }
  if (!ALLOWED_CARDS.has(input.cardId)) return undefined;

  return {
    kind: "deploy",
    model,
    cardId: input.cardId,
    ...(input.version ? { version: input.version } : {}),
    ...(input.weightPrecision && ALLOWED_PRECISIONS.has(input.weightPrecision)
      ? { weightPrecision: input.weightPrecision }
      : {}),
    ...(input.kvCacheDtype && ALLOWED_KV_DTYPES.has(input.kvCacheDtype)
      ? { kvCacheDtype: input.kvCacheDtype }
      : {}),
    ...(input.weightNzMode !== undefined ? { weightNzMode: input.weightNzMode } : {}),
    ...(input.tpSize !== undefined ? { tpSize: Math.trunc(input.tpSize) } : {}),
    ...(input.ppSize !== undefined ? { ppSize: Math.trunc(input.ppSize) } : {}),
    ...(input.dpSize !== undefined ? { dpSize: Math.trunc(input.dpSize) } : {}),
    ...(input.dcpSize !== undefined ? { dcpSize: Math.trunc(input.dcpSize) } : {}),
    ...(input.enableEp !== undefined ? { enableEp: input.enableEp } : {}),
    ...(input.gpuMemoryUtilization !== undefined
      ? { gpuMemoryUtilization: Number(input.gpuMemoryUtilization.toFixed(3)) }
      : {}),
    ...(input.maxModelLen !== undefined ? { maxModelLen: Math.trunc(input.maxModelLen) } : {}),
    ...(input.maxNumBatchedTokens !== undefined
      ? { maxNumBatchedTokens: Math.trunc(input.maxNumBatchedTokens) }
      : {}),
    ...(input.maxNumSeqs !== undefined ? { maxNumSeqs: Math.trunc(input.maxNumSeqs) } : {}),
    ...(input.cudagraphMode ? { cudagraphMode: input.cudagraphMode } : {}),
    ...(input.enforceEager !== undefined ? { enforceEager: input.enforceEager } : {}),
    ...(input.decodeBatchSize !== undefined ? { decodeBatchSize: Math.trunc(input.decodeBatchSize) } : {}),
    ...(input.prefillTokens !== undefined ? { prefillTokens: Math.trunc(input.prefillTokens) } : {}),
    ...(input.decodeContextLen !== undefined ? { decodeContextLen: Math.trunc(input.decodeContextLen) } : {}),
  };
}

export function buildDoctorChatAnalysis(input: {
  command: string;
  decodeCommand?: string | undefined;
  mode?: "minimal" | "full" | undefined;
  hardwareFamily?: AscendFamily | undefined;
  decodeHardwareFamily?: AscendFamily | undefined;
  version?: RuleVersion | undefined;
  crossNodeRoce?: boolean | undefined;
}): DoctorChatAnalysisPayload | undefined {
  const command = sanitizeDiagnosticText(input.command).sanitized.trim().slice(0, MAX_DOCTOR_COMMAND_CHARS);
  if (!command) return undefined;
  const decodeCommand = input.decodeCommand
    ? sanitizeDiagnosticText(input.decodeCommand).sanitized.trim().slice(0, MAX_DOCTOR_COMMAND_CHARS)
    : "";
  return {
    kind: "doctor",
    command,
    ...(decodeCommand ? { decodeCommand } : {}),
    ...(input.mode ? { mode: input.mode } : {}),
    ...(input.hardwareFamily ? { hardwareFamily: input.hardwareFamily } : {}),
    ...(decodeCommand && input.decodeHardwareFamily
      ? { decodeHardwareFamily: input.decodeHardwareFamily }
      : {}),
    ...(input.version ? { version: input.version } : {}),
    ...(input.crossNodeRoce !== undefined ? { crossNodeRoce: input.crossNodeRoce } : {}),
  };
}

export function buildTroubleshootChatAnalysis(rawInput: string): TroubleshootChatAnalysisPayload | undefined {
  const sanitized = sanitizeDiagnosticText(rawInput).sanitized.trim().slice(0, MAX_TROUBLESHOOT_CHARS);
  if (!sanitized) return undefined;
  return {
    kind: "troubleshoot",
    rawInput: sanitized,
  };
}
