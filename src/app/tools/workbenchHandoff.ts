import {
  ASCEND_CALC_CARDS,
  type AscendCalcCardId,
  type DoctorModelTraitOverride,
  extractDoctorModelTraitsFromSpec,
  type KvCacheDtype,
  resolveDoctorModelTraits,
  WAVE4_DEMO_PRESETS,
  type WeightPrecision,
} from "../../sim/modelspec/deployCalculator";
import { MODEL_PRESETS } from "../../sim/modelspec/presets";
import { parseAscendStartupLog } from "../../sim/modelspec/startupLogParser";
import type { AscendFamily, CudaGraphMode, RuleVersion } from "../../sim/rules";
import {
  analyzeTroubleshootInput,
  extractRank,
  extractRankMatch,
  extractTimestamp,
  RANK_PATTERNS,
} from "../../sim/troubleshoot/logAnalyzer";
import type { ChatAnalysisPayload } from "../wiki/chat-controller";

export {
  type DoctorModelTraitOverride,
  extractDoctorModelTraitsFromSpec,
  extractRank,
  RANK_PATTERNS,
  resolveDoctorModelTraits,
};

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
const ALLOWED_CUDAGRAPH_MODES = new Set<CudaGraphMode>([
  "NONE",
  "PIECEWISE",
  "FULL_DECODE_ONLY",
  "FULL",
  "FULL_AND_PIECEWISE",
]);
const ALLOWED_CARDS = new Set<AscendCalcCardId>(ASCEND_CALC_CARDS.map((c) => c.id));
const ALLOWED_PRESETS = new Set<string>([
  ...MODEL_PRESETS.map((p) => p.id),
  ...WAVE4_DEMO_PRESETS.map((d) => d.id),
]);
const SAFE_WIKI_SLUG_RE = /^[a-z0-9][a-z0-9-_]{0,127}$/i;
// biome-ignore lint/suspicious/noControlCharactersInRegex: strip ANSI escape codes from terminal logs
const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*[A-Za-z]/g;

export interface CalculatorQueryOverrides {
  subMode?: "static" | "reconcile" | undefined;
  presetId?: string | undefined;
  cardId?: AscendCalcCardId | undefined;
  weightPrecision?: WeightPrecision | undefined;
  kvCacheDtype?: KvCacheDtype | undefined;
  weightNzMode?: 0 | 1 | 2 | undefined;
  tpSize?: number | undefined;
  ppSize?: number | undefined;
  dpSize?: number | undefined;
  pcpSize?: number | undefined;
  dcpSize?: number | undefined;
  enableEp?: boolean | undefined;
  gpuMemoryUtilization?: number | undefined;
  maxModelLen?: number | undefined;
  maxNumBatchedTokens?: number | undefined;
  maxNumSeqs?: number | undefined;
  cudagraphMode?: CudaGraphMode | undefined;
  enforceEager?: boolean | undefined;
  prefillTokens?: number | undefined;
  decodeBatchSize?: number | undefined;
  decodeContextLen?: number | undefined;
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

  const nzRaw = params.get("nz");
  if (nzRaw === "0" || nzRaw === "1" || nzRaw === "2") {
    out.weightNzMode = Number(nzRaw) as 0 | 1 | 2;
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
  const pcp = parseParallel("pcp");
  if (pcp !== undefined) out.pcpSize = pcp;
  const dcp = parseParallel("dcp");
  if (dcp !== undefined) out.dcpSize = dcp;

  const ep = params.get("ep");
  if (ep === "1" || ep === "true") out.enableEp = true;
  else if (ep === "0" || ep === "false") out.enableEp = false;

  const uRaw = params.get("u");
  if (uRaw && /^\d*(?:\.\d+)?$/.test(uRaw)) {
    const u = Number(uRaw);
    if (Number.isFinite(u) && u >= 0.1 && u <= 0.99) {
      out.gpuMemoryUtilization = Number(u.toFixed(4));
    }
  }

  const parseBoundedInt = (key: string, min: number, max: number): number | undefined => {
    const raw = params.get(key);
    if (!raw || !/^\d+$/.test(raw)) return undefined;
    const n = Number(raw);
    return Number.isSafeInteger(n) && n >= min && n <= max ? n : undefined;
  };

  const maxLen = parseBoundedInt("maxLen", 64, 1_048_576);
  if (maxLen !== undefined) out.maxModelLen = maxLen;
  const batchTokens = parseBoundedInt("batchTokens", 1, 1_048_576);
  if (batchTokens !== undefined) out.maxNumBatchedTokens = batchTokens;
  const maxSeqs = parseBoundedInt("maxSeqs", 1, 65_536);
  if (maxSeqs !== undefined) out.maxNumSeqs = maxSeqs;
  const prefill = parseBoundedInt("prefill", 1, 1_048_576);
  if (prefill !== undefined) out.prefillTokens = prefill;
  const decodeBatch = parseBoundedInt("decodeBatch", 1, 65_536);
  if (decodeBatch !== undefined) out.decodeBatchSize = decodeBatch;
  const decodeCtx = parseBoundedInt("decodeCtx", 1, 1_048_576);
  if (decodeCtx !== undefined) out.decodeContextLen = decodeCtx;

  const cudagraph = params.get("cudagraph")?.trim() as CudaGraphMode | undefined;
  if (cudagraph && ALLOWED_CUDAGRAPH_MODES.has(cudagraph)) {
    out.cudagraphMode = cudagraph;
  }

  const eager = params.get("eager");
  if (eager === "1" || eager === "true") out.enforceEager = true;
  else if (eager === "0" || eager === "false") out.enforceEager = false;

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
  if (input.weightNzMode === 0 || input.weightNzMode === 1 || input.weightNzMode === 2) {
    next.set("nz", String(input.weightNzMode));
  }
  if (input.tpSize !== undefined && ALLOWED_PARALLEL_SIZES.has(input.tpSize)) {
    next.set("tp", String(input.tpSize));
  }
  if (input.ppSize !== undefined && ALLOWED_PARALLEL_SIZES.has(input.ppSize)) {
    next.set("pp", String(input.ppSize));
  }
  if (input.dpSize !== undefined && ALLOWED_PARALLEL_SIZES.has(input.dpSize)) {
    next.set("dp", String(input.dpSize));
  }
  if (input.pcpSize !== undefined && ALLOWED_PARALLEL_SIZES.has(input.pcpSize)) {
    next.set("pcp", String(input.pcpSize));
  }
  if (input.dcpSize !== undefined && ALLOWED_PARALLEL_SIZES.has(input.dcpSize)) {
    next.set("dcp", String(input.dcpSize));
  }
  if (input.enableEp !== undefined) next.set("ep", input.enableEp ? "1" : "0");
  if (input.gpuMemoryUtilization !== undefined) {
    const fixed2 = Number(input.gpuMemoryUtilization.toFixed(2));
    next.set(
      "u",
      Math.abs(input.gpuMemoryUtilization - fixed2) < 1e-9
        ? input.gpuMemoryUtilization.toFixed(2)
        : String(Number(input.gpuMemoryUtilization.toFixed(4))),
    );
  }
  if (input.maxModelLen !== undefined) next.set("maxLen", String(Math.trunc(input.maxModelLen)));
  if (input.maxNumBatchedTokens !== undefined) {
    next.set("batchTokens", String(Math.trunc(input.maxNumBatchedTokens)));
  }
  if (input.maxNumSeqs !== undefined) next.set("maxSeqs", String(Math.trunc(input.maxNumSeqs)));
  if (input.cudagraphMode && ALLOWED_CUDAGRAPH_MODES.has(input.cudagraphMode)) {
    next.set("cudagraph", input.cudagraphMode);
  }
  if (input.enforceEager !== undefined) next.set("eager", input.enforceEager ? "1" : "0");
  if (input.prefillTokens !== undefined) next.set("prefill", String(Math.trunc(input.prefillTokens)));
  if (input.decodeBatchSize !== undefined) next.set("decodeBatch", String(Math.trunc(input.decodeBatchSize)));
  if (input.decodeContextLen !== undefined) next.set("decodeCtx", String(Math.trunc(input.decodeContextLen)));
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
  readonly modelId?: string | undefined;
  readonly modelTraitOverride?: DoctorModelTraitOverride | undefined;
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
export type DoctorChatAnalysisPayload = Extract<ChatAnalysisPayload, { kind: "doctor" }> & {
  modelId?: string | undefined;
  modelTraitOverride?: DoctorModelTraitOverride | undefined;
};
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

/**
 * Tier-1 decisive / terminal fault signals (NPU OOM, OS SIGKILL/SIGSEGV exit codes,
 * CANN/HCCL error codes, startup pre-check / compatibility / Sleep / PD blockers).
 * Strictly prioritized ahead of generic `RuntimeError` chatter during Pass-3 budget compaction.
 */
const DECISIVE_FAULT_LINE_RE =
  /out\s+of\s+memory|\bOutOfMemoryError\b|\bOOM(?:Killed)?\b|No available memory for the cache blocks|Free memory on device\s*\(.+\)\s*on startup\s+is less than desired|Error in memory profiling|ACL_ERROR_[A-Z0-9_]+|\b(?:EI|EJ|EH|EZ|EL)\d{4}\b|\b5070\d{2}\b|HCCL_E_WAIT_TIMEOUT|notify\s+wait\s+execute\s+timeout|watchdog\s+caught|collective\s+operation\s+timed?\s+out|Aicore kernel execute failed|aclnn[A-Za-z0-9_]+.*failed|Check ascend device type failed|\bSOC_VERSION\b.*mismatch|AscendFAImpl does not support ACL graph capture|adopt static quantization|FRACTAL_NZ mode is enabled|Please set weight_nz_mode=0|Mooncake worker requires|Prefill TP size must be divisible by Decode TP size|MooncakeConnector\w*\b[^'\r\n]{0,40}\b(?:does not support|not supported|unsupported|failed|error|timeout|refused)|EngineCore(?:Proc)?\b.{0,50}died unexpectedly|\b(?:SIGSEGV|SIGABRT|SIGBUS|SIGKILL)\b|segmentation\s+fault|core\s+dumped|(?:exit\s*code|returncode)\s*[=:]?\s*(?:-[1-9]\d*|[1-9]\d*)\b|returned\s+non-zero\s+exit/i;

const CRITICAL_FAULT_LINE_RE =
  /\b(?:RuntimeError|ValueError|AssertionError|KeyError|TypeError|AttributeError|MemoryError|OSError|ImportError|NotImplementedError|TimeoutError|ConnectionError|BrokenPipeError|ChildFailedError)\b|\b[A-Za-z_][A-Za-z0-9_]*(?:Error|Exception)\s*:|Traceback\s*\(most recent call last\)|^\s*File\s+"[^"]+",\s*line\s+\d+|\b(?:FATAL|CRITICAL|PANIC|ERROR)\b|out\s+of\s+memory|\bOutOfMemoryError\b|\bOOM(?:Killed)?\b|Free memory on device\s*\(.+\)\s*on startup\s+is less than desired|Error in memory profiling|ACL_ERROR[A-Z0-9_]*|\b(?:EI|EJ|EH|EZ|EL)\d{4}\b|\b5070\d{2}\b|HCCL_E_WAIT_TIMEOUT|Aicore kernel execute failed|aclnn[A-Za-z0-9_]+.*failed|Check ascend device type failed|\bSOC_VERSION\b.*mismatch|AscendFAImpl does not support ACL graph capture|adopt static quantization|FRACTAL_NZ mode is enabled|Please set weight_nz_mode=0|Mooncake worker requires|Prefill TP size must be divisible by Decode TP size|MooncakeConnector\w*\b[^'\r\n]{0,40}\b(?:does not support|not supported|unsupported|failed|error|timeout|refused)|EngineCore(?:Proc)?\b.{0,50}died unexpectedly|notify\s+wait\s+execute\s+timeout|watchdog\s+caught|collective\s+operation\s+timed?\s+out|heartbeat\s+timeout|ncclSystemError|ncclRemoteError|hccl\s+error|\b(?:SIGSEGV|SIGABRT|SIGBUS|SIGKILL)\b|segmentation\s+fault|core\s+dumped|(?:exit\s*code|returncode)\s*[=:]?\s*(?:-[1-9]\d*|[1-9]\d*)\b|returned\s+non-zero\s+exit|address\s+already\s+in\s+use|errno\s+98|connection\s+refused|broken\s+pipe|deadlock/i;

const CRITICAL_FAULT_SCAN_RE = new RegExp(CRITICAL_FAULT_LINE_RE.source, "gi");

const STAGE_AND_METRIC_LINE_RE =
  /model\s+loading|load_model|loading\s+model\s+weights|profile_run|determine_available_memory|available\s+kv\s+cache|gpu\s+kv\s+cache|compile_or_warm_up_model|capture_model|aclgraph|npu\s+graph\s+memory|^\s*(?:#\s*(?:HELP|TYPE)\s+)?vllm:|kv_cache_usage|num_preemptions|time_to_first_token|inter_token_latency|\bWARN(?:ING)?\b/i;

const TERMINAL_DEATH_SPAN_RE =
  /(?:exit\s*code|returncode)\s*[=:]?\s*(?:-[1-9]\d*|[1-9]\d*)\b|\b(?:SIGKILL|SIGSEGV|SIGABRT|SIGBUS|OOMKilled|OOM|OutOfMemoryError)\b|out\s+of\s+memory|FRACTAL_NZ mode is enabled|EngineCore(?:Proc)?\b.{0,50}died unexpectedly/i;

const TRACEBACK_CONTEXT_LINE_RE =
  /Traceback\s*\(most recent call last\)|File\s+"[^"]+",\s*line\s+\d+|\b(?:capture_model|compile_or_warm_up_model|load_model|load_weights|profile_run|Available KV cache memory|device_op\.py)\b/i;

const CANN_HCCL_CODE_SPAN_RE = /ACL_ERROR[A-Z0-9_]*|\b(?:EI|EJ|EH|EZ|EL)\d{4}\b/i;

export function extractLineIdentitySpans(line: string): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const rankMatch = extractRankMatch(line);
  if (rankMatch) {
    spans.push([
      Math.max(0, rankMatch.index - 8),
      Math.min(line.length, rankMatch.index + rankMatch.raw.length + 8),
    ]);
  }
  const tsMatch = extractTimestamp(line);
  if (tsMatch.index !== null && tsMatch.length > 0) {
    spans.push([Math.max(0, tsMatch.index - 4), Math.min(line.length, tsMatch.index + tsMatch.length + 4)]);
  }
  return spans;
}

function compactOverlongLine(line: string, maxLineChars = 3600): string {
  if (line.length <= maxLineChars) return line;
  const headLen = Math.min(820, Math.floor(maxLineChars * 0.24));
  const tailLen = Math.min(820, Math.floor(maxLineChars * 0.24));
  const identitySpans = extractLineIdentitySpans(line);

  // Scan ALL fault matches across the FULL unsliced line (no 3-match cap!) so late exitcode=-9 / OOM markers are never skipped
  const rawMatches: Array<{ s: number; e: number; tightS: number; tightE: number; tier: 0 | 1 | 2 }> = [];
  const seenCannCodes = new Set<string>();
  CRITICAL_FAULT_SCAN_RE.lastIndex = 0;
  let m = CRITICAL_FAULT_SCAN_RE.exec(line);
  let sawFirstException = false;
  while (m !== null) {
    const token = m[0];
    const isException = /(?:Error|Exception)\b/.test(token);
    const isTerminal = TERMINAL_DEATH_SPAN_RE.test(token) || (isException && !sawFirstException);
    if (isException) sawFirstException = true;

    let tier: 0 | 1 | 2 = 2;
    if (isTerminal) {
      tier = 0;
    } else if (CANN_HCCL_CODE_SPAN_RE.test(token)) {
      const normCode = token.toUpperCase();
      if (!seenCannCodes.has(normCode)) {
        seenCannCodes.add(normCode);
        tier = 1;
      }
    }

    rawMatches.push({
      s: Math.max(0, m.index - 140),
      e: Math.min(line.length, m.index + token.length + 340),
      tightS: Math.max(0, m.index - 64),
      tightE: Math.min(line.length, m.index + token.length + 136),
      tier,
    });
    if (token.length === 0) CRITICAL_FAULT_SCAN_RE.lastIndex += 1;
    m = CRITICAL_FAULT_SCAN_RE.exec(line);
  }

  const mergeSpans = (spans: Array<[number, number]>): Array<[number, number]> => {
    spans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const out: Array<[number, number]> = [];
    for (const [s, e] of spans) {
      const prev = out[out.length - 1];
      if (prev && s <= prev[1] + 24) {
        prev[1] = Math.max(prev[1], e);
      } else {
        out.push([s, e]);
      }
    }
    return out;
  };

  const marker = " ...[单行中段省略]... ";
  const allMerged = mergeSpans([
    [0, headLen],
    [Math.max(0, line.length - tailLen), line.length],
    ...identitySpans,
    ...rawMatches.map(({ s, e }): [number, number] => [s, e]),
  ]);
  const fullCompacted = allMerged.map(([s, e]) => line.slice(s, e)).join(marker);
  if (fullCompacted.length <= maxLineChars) return fullCompacted;

  // Extreme single line with repeated error tokens: Rank/Timestamp identity + Tier 0 ALWAYS precede deduplicated Tier 1 CANN codes
  const baseSpans: Array<[number, number]> = [
    [0, Math.min(240, headLen)],
    [Math.max(0, line.length - Math.min(240, tailLen)), line.length],
    ...identitySpans,
  ];
  const prioritized = [...rawMatches].sort((a, b) => a.tier - b.tier || a.tightS - b.tightS);
  for (const cand of prioritized) {
    const trial = mergeSpans([...baseSpans, [cand.tightS, cand.tightE]]);
    const trialLen =
      trial.reduce((acc, [s, e]) => acc + (e - s), 0) + Math.max(0, trial.length - 1) * marker.length;
    if (trialLen <= maxLineChars) {
      baseSpans.push([cand.tightS, cand.tightE]);
    }
  }
  const bounded = mergeSpans(baseSpans)
    .map(([s, e]) => line.slice(s, e))
    .join(marker);
  return bounded.length <= maxLineChars ? bounded : bounded.slice(0, maxLineChars);
}

function buildOmissionMarker(omittedFrom1: number, omittedTo1: number, nextLine1: number): string {
  return `... [日志节选：已省略第 ${omittedFrom1}–${omittedTo1} 行常规输出；下行起原行号 L${nextLine1}] ...`;
}

function assembleIntervals(lines: readonly string[], intervals: Array<[number, number]>): string {
  intervals.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const [s, e] of intervals) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1] + 2) {
      last[1] = Math.max(last[1], e);
    } else {
      merged.push([s, e]);
    }
  }
  const outParts: string[] = [];
  let prevEnd = -1;
  for (const [s, e] of merged) {
    if (prevEnd < 0 && s > 0) {
      outParts.push(buildOmissionMarker(1, s, s + 1));
    } else if (prevEnd >= 0 && s > prevEnd + 1) {
      outParts.push(buildOmissionMarker(prevEnd + 2, s, s + 1));
    }
    for (let i = s; i <= e; i += 1) {
      outParts.push(lines[i]!);
    }
    prevEnd = e;
  }
  return outParts.join("\n");
}

const OMISSION_MARKER_OVERHEAD = 92;

/**
 * Smart head + tiered diagnostic-window + tail excerpt within `maxChars` (default 64 KiB) so >64KB logs
 * never drop decisive faults/OOMs behind generic RuntimeError storms, benign INFO chatter, or overlong lines.
 */
export function truncateTroubleshootLog(rawSanitized: string, maxChars = MAX_TROUBLESHOOT_CHARS): string {
  // Preserve leading blank lines so 1-based original line numbers never shift on leading `\n`!
  const normalized = rawSanitized.replace(/\r\n?/g, "\n").replace(/[ \t\n]+$/, "");
  if (!normalized.trim()) return "";
  if (normalized.length <= maxChars) return normalized;

  const rawLines = normalized.split("\n");
  const total = rawLines.length;

  if (total === 1) {
    const compacted = compactOverlongLine(normalized, maxChars - 32);
    return compacted.length <= maxChars ? compacted : compacted.slice(compacted.length - maxChars);
  }

  // Classify on FULL unsliced lines first so tail faults on overlong lines are never missed!
  // Tiers: 1 = decisive/terminal faults (OOM, exitcode, EI0006, CANN/Ascend blockers),
  //        2 = generic errors/exceptions/tracebacks (RuntimeError, ValueError, Traceback, ERROR),
  //        3 = stage milestones, Prometheus metrics, WARNING,
  //        0 = normal INFO lines.
  const lineTier = new Uint8Array(total);
  const lines = new Array<string>(total);
  for (let i = 0; i < total; i += 1) {
    const full = rawLines[i]!;
    if (DECISIVE_FAULT_LINE_RE.test(full)) {
      lineTier[i] = 1;
    } else if (CRITICAL_FAULT_LINE_RE.test(full)) {
      lineTier[i] = 2;
    } else if (STAGE_AND_METRIC_LINE_RE.test(full)) {
      lineTier[i] = 3;
    }
    lines[i] = full.length > 3600 ? compactOverlongLine(full, 3600) : full;
  }

  // Pass 1: Head + Tier-1/2 (±3) + Tier-3 (±2) + Tail
  const pass1: Array<[number, number]> = [
    [0, Math.min(total - 1, 59)],
    [Math.max(0, total - 80), total - 1],
  ];
  for (let i = 0; i < total; i += 1) {
    if (lineTier[i] === 1 || lineTier[i] === 2) pass1.push([Math.max(0, i - 3), Math.min(total - 1, i + 4)]);
    else if (lineTier[i] === 3) pass1.push([Math.max(0, i - 2), Math.min(total - 1, i + 2)]);
  }
  const assembled1 = assembleIntervals(lines, pass1);
  if (assembled1.length <= maxChars) return assembled1;

  // Pass 2: Head + Tier-1 (±3) + Tier-2 (±2) + Tail (drops noisy Tier-3 flood while keeping all errors)
  const pass2: Array<[number, number]> = [
    [0, Math.min(total - 1, 35)],
    [Math.max(0, total - 55), total - 1],
  ];
  for (let i = 0; i < total; i += 1) {
    if (lineTier[i] === 1) pass2.push([Math.max(0, i - 3), Math.min(total - 1, i + 3)]);
    else if (lineTier[i] === 2) pass2.push([Math.max(0, i - 2), Math.min(total - 1, i + 3)]);
  }
  const assembled2 = assembleIntervals(lines, pass2);
  if (assembled2.length <= maxChars) return assembled2;

  // Pass 3 (extreme fault storm): strictly prioritize Tier-1 decisive faults + their immediate stack frames
  // BEFORE allocating any middle budget to generic Tier-2 RuntimeErrors or Tier-3 stage lines.
  const headBudget = Math.floor(maxChars * 0.14);
  const tailBudget = Math.floor(maxChars * 0.28);

  const pickedSet = new Set<number>();
  let usedHead = 0;
  let headLast = -1;
  for (let i = 0; i < total; i += 1) {
    const cost = lines[i]!.length + 1;
    if (usedHead + cost > headBudget) break;
    pickedSet.add(i);
    usedHead += cost;
    headLast = i;
  }

  let usedTail = 0;
  let tailFirst = total;
  for (let i = total - 1; i > headLast; i -= 1) {
    const cost = lines[i]!.length + 1;
    if (usedTail + cost > tailBudget) break;
    pickedSet.add(i);
    usedTail += cost;
    tailFirst = i;
  }

  const midBudget = Math.max(0, maxChars - usedHead - usedTail - OMISSION_MARKER_OVERHEAD * 2);
  let usedMid = 0;
  const tryPickMid = (idx: number): boolean => {
    if (idx <= headLast || idx >= tailFirst || pickedSet.has(idx)) return false;
    const isAdjacent = pickedSet.has(idx - 1) || pickedSet.has(idx + 1);
    const cost = lines[idx]!.length + 1 + (isAdjacent ? 0 : OMISSION_MARKER_OVERHEAD);
    if (usedMid + cost > midBudget) return false;
    pickedSet.add(idx);
    usedMid += cost;
    return true;
  };

  const sigCounts = new Map<string, number>();
  const pickedTier1: number[] = [];

  // Phase A1: All unique Tier-1 decisive/terminal faults FIRST (keyed with rank so distinct ranks survive)
  for (let i = headLast + 1; i < tailFirst; i += 1) {
    if (lineTier[i] !== 1 || pickedSet.has(i)) continue;
    const rankKey = extractRank(lines[i]!) ?? "none";
    const sig = `t1|${rankKey}|${lines[i]!.replace(/\d+/g, "#").slice(0, 120)}`;
    const seen = sigCounts.get(sig) ?? 0;
    if (seen >= 4) continue;
    if (tryPickMid(i)) {
      sigCounts.set(sig, seen + 1);
      pickedTier1.push(i);
    }
  }

  // Phase A2: Immediate traceback/stage context lines (±2) around picked Tier-1 decisive faults
  for (const idx of pickedTier1) {
    for (const offset of [-2, -1, 1, 2]) {
      const neighbor = idx + offset;
      if (neighbor <= headLast || neighbor >= tailFirst || pickedSet.has(neighbor)) continue;
      if (TRACEBACK_CONTEXT_LINE_RE.test(lines[neighbor]!)) {
        tryPickMid(neighbor);
      }
    }
  }
  for (const idx of pickedTier1) {
    for (const offset of [-1, 1]) {
      const neighbor = idx + offset;
      if (neighbor <= headLast || neighbor >= tailFirst || pickedSet.has(neighbor)) continue;
      tryPickMid(neighbor);
    }
  }

  // Phase B & C: Remaining budget goes to Tier-2 generic errors, then Tier-3 stage/metric lines
  for (const tierTarget of [2, 3] as const) {
    for (let i = headLast + 1; i < tailFirst; i += 1) {
      if (lineTier[i] !== tierTarget || pickedSet.has(i)) continue;
      const sig = `t${tierTarget}|${lines[i]!.replace(/\d+/g, "#").slice(0, 120)}`;
      const seen = sigCounts.get(sig) ?? 0;
      if (seen >= 3) continue;
      if (tryPickMid(i)) {
        sigCounts.set(sig, seen + 1);
        if (tierTarget === 2 && i + 1 < tailFirst && !pickedSet.has(i + 1)) {
          tryPickMid(i + 1);
        }
      }
    }
  }

  const sortedIndices = Array.from(pickedSet).sort((a, b) => a - b);
  const fallbackOut: string[] = [];
  let prevIdx = -1;
  for (const idx of sortedIndices) {
    if (prevIdx < 0 && idx > 0) {
      fallbackOut.push(buildOmissionMarker(1, idx, idx + 1));
    } else if (prevIdx >= 0 && idx > prevIdx + 1) {
      fallbackOut.push(buildOmissionMarker(prevIdx + 2, idx, idx + 1));
    }
    fallbackOut.push(lines[idx]!);
    prevIdx = idx;
  }
  const fallbackText = fallbackOut.join("\n");
  return fallbackText.length <= maxChars ? fallbackText : fallbackText.slice(fallbackText.length - maxChars);
}

export function buildDoctorChatAnalysis(input: {
  command: string;
  decodeCommand?: string | undefined;
  mode?: "minimal" | "full" | undefined;
  hardwareFamily?: AscendFamily | undefined;
  decodeHardwareFamily?: AscendFamily | undefined;
  version?: RuleVersion | undefined;
  crossNodeRoce?: boolean | undefined;
  modelId?: string | undefined;
  modelTraitOverride?: DoctorModelTraitOverride | undefined;
}): DoctorChatAnalysisPayload | undefined {
  const command = sanitizeDiagnosticText(input.command.replace(ANSI_ESCAPE_RE, ""))
    .sanitized.trim()
    .slice(0, MAX_DOCTOR_COMMAND_CHARS);
  if (!command) return undefined;
  const decodeCommand = input.decodeCommand
    ? sanitizeDiagnosticText(input.decodeCommand.replace(ANSI_ESCAPE_RE, ""))
        .sanitized.trim()
        .slice(0, MAX_DOCTOR_COMMAND_CHARS)
    : "";
  const trimmedModelId = input.modelId?.trim();
  const normalizedModelId =
    trimmedModelId && trimmedModelId.toLowerCase() !== "auto" ? trimmedModelId.slice(0, 120) : undefined;
  const resolvedTraits = resolveDoctorModelTraits(normalizedModelId, input.modelTraitOverride);
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
    ...(normalizedModelId ? { modelId: normalizedModelId } : {}),
    ...(resolvedTraits ? { modelTraitOverride: resolvedTraits } : {}),
  };
}

export function buildTroubleshootChatAnalysis(rawInput: string): TroubleshootChatAnalysisPayload | undefined {
  const stripped = rawInput.replace(ANSI_ESCAPE_RE, "");
  const sanitized = truncateTroubleshootLog(
    sanitizeDiagnosticText(stripped).sanitized,
    MAX_TROUBLESHOOT_CHARS,
  );
  if (!sanitized) return undefined;
  return {
    kind: "troubleshoot",
    rawInput: sanitized,
  };
}
