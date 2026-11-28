import { type AiCoreArch, OUTLIER_RANGE, type QuantFormatId } from "../../sim/aicore/matmulRmsScenario";
import {
  DOCTOR_PRESETS,
  FULL_SINGLE_DOCTOR_PRESETS,
  MINIMAL_DOCTOR_PRESETS,
  PD_DOCTOR_PRESETS,
} from "../../sim/doctor/presets";
import {
  ASCEND_CALC_CARDS,
  type AscendCalcCardId,
  type DoctorModelTraitOverride,
  evaluateWave3ModelGate,
  extractDoctorModelTraitsFromSpec,
  type KvCacheDtype,
  resolveDoctorModelTraits,
  WAVE4_DEMO_PRESETS,
  type Wave3ModelGateResult,
  type WeightPrecision,
} from "../../sim/modelspec/deployCalculator";
import { extractStructuralHfConfig } from "../../sim/modelspec/parseHfConfig";
import { MODEL_PRESETS } from "../../sim/modelspec/presets";
import { parseAscendStartupLog } from "../../sim/modelspec/startupLogParser";
import type { AscendFamily, CudaGraphMode, RuleVersion } from "../../sim/rules";
import {
  type DiagnosticRedactionMasks,
  redactDiagnosticCredentials,
  stripTerminalControlSequences,
} from "../../sim/shared/yamlRedactor";
import {
  classifyEvidenceLine,
  DECISIVE_ERROR_CODE_RE,
  DECISIVE_ERROR_CODE_SOURCE,
  findSplitRulePredicateGroups,
  getAllPrimarySignalBuckets,
  getPrimarySignalBucket,
  getUtf8ByteLength,
  getVllmMetricSampleName,
  guardMalformedMetricLinesForAnalyzer,
  hasMetricsTruncatedMarker,
  isAscendScopeContextLine,
  isBenignSuppressedDiagnosticLine,
  isConsumedMetricSampleLine,
  isRuleEvidenceLine,
  isVisibleDevicesContextLine,
  METRICS_TRUNCATED_MARKER,
  measurePostNeutralizationLength,
  sliceUtf8BytesSafe,
  stripBoundedHtmlComments,
  stripDiagnosticControlAndInvisibleChars,
  stripLogIdFieldsForErrorCodes,
} from "../../sim/troubleshoot/evidenceLineMatcher";
import { TROUBLESHOOT_FIXTURES } from "../../sim/troubleshoot/fixtures";
import {
  analyzeTroubleshootInput,
  extractRank,
  extractRankMatch,
  extractTimestamp,
  RANK_PATTERNS,
} from "../../sim/troubleshoot/logAnalyzer";
import { TIMELINE_SCENARIOS, type TimelineScenarioId } from "../../sim/troubleshoot/timelineSandbox";
import type { ChatAnalysisPayload } from "../wiki/chat-controller";

export {
  type DoctorModelTraitOverride,
  extractDoctorModelTraitsFromSpec,
  extractRank,
  hasMetricsTruncatedMarker,
  isRuleEvidenceLine,
  METRICS_TRUNCATED_MARKER,
  RANK_PATTERNS,
  resolveDoctorModelTraits,
  stripDiagnosticControlAndInvisibleChars,
  stripTerminalControlSequences,
};

export const MAX_WORKBENCH_SHARE_URL_CHARS = 4096;
export const MAX_DOCTOR_COMMAND_CHARS = 8 * 1024;
export const MAX_TROUBLESHOOT_TIMELINE_STEP = 1;

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
  "qwen3-0.6b",
  "qwen3-8b",
  "qwen3-30b-a3b",
  "qwen3-32b",
  "qwen3-235b-a22b",
  ...MODEL_PRESETS.map((p) => p.id),
  ...WAVE4_DEMO_PRESETS.map((d) => d.id),
]);
export type LegacyUpgradeFromVersion = "v0.23.0" | "v0.26.0rc";

const ALLOWED_HARDWARE_FAMILIES = new Set<AscendFamily>(["A2", "A3", "310P", "A5"]);
const ALLOWED_RULE_VERSIONS = new Set<Extract<RuleVersion, "v0.30.0" | "main">>(["v0.30.0", "main"]);
const ALLOWED_UPGRADE_FROM_VERSIONS = new Set<LegacyUpgradeFromVersion>(["v0.23.0", "v0.26.0rc"]);
const ALLOWED_DOCTOR_TOPOLOGIES = new Set<"single" | "pd">(["single", "pd"]);
export type DoctorModelHintKey =
  | "auto"
  | "qwen3-0.6b"
  | "qwen3-8b"
  | "qwen3-30b-a3b"
  | "qwen3-32b"
  | "qwen3-235b-a22b";

const ALLOWED_DOCTOR_HINTS = new Set<DoctorModelHintKey>([
  "auto",
  "qwen3-0.6b",
  "qwen3-8b",
  "qwen3-30b-a3b",
  "qwen3-32b",
  "qwen3-235b-a22b",
]);
const ALLOWED_DOCTOR_PRESETS = new Set<string>(DOCTOR_PRESETS.map((p) => p.id));
const ALLOWED_AICORE_ARCHS = new Set<AiCoreArch>(["910b", "950"]);
const ALLOWED_AICORE_QUANTS = new Set<QuantFormatId>(["mxfp8", "w8a8_dynamic", "per_tensor_int8"]);
const ALLOWED_TROUBLESHOOT_PANELS = new Set<"logs" | "timeline">(["logs", "timeline"]);
const ALLOWED_TROUBLESHOOT_FIXTURES = new Set<string>(TROUBLESHOOT_FIXTURES.map((f) => f.id));
const ALLOWED_TIMELINE_SCENARIOS = new Set<TimelineScenarioId>(TIMELINE_SCENARIOS.map((s) => s.id));
const SAFE_WIKI_SLUG_RE = /^[a-z0-9][a-z0-9-_]{0,127}$/i;
const UNSAFE_ANCHOR_CHAR_RE = /[\r\n\0/\\=<>@"'`#]/;

function sanitizeWikiBackAnchor(rawAnchor: string | null | undefined): string | null {
  const clean = stripTerminalControlSequences(rawAnchor ?? "")
    .trim()
    .replace(/^#+/, "");
  if (!clean || clean.length > 128 || UNSAFE_ANCHOR_CHAR_RE.test(clean)) return null;
  if (sanitizeDiagnosticText(clean).redactionCount > 0) return null;
  return clean;
}

export type WorkbenchTabId = "calculator" | "doctor" | "troubleshoot" | "aicore" | "wargame";

export function preserveWikiBackParams(target: URLSearchParams, preserve?: URLSearchParams): void {
  if (!preserve) return;
  const fromPage = preserve.get("fromPage")?.trim();
  const safeAnchor = sanitizeWikiBackAnchor(preserve.get("fromAnchor"));
  if (fromPage && SAFE_WIKI_SLUG_RE.test(fromPage)) {
    target.set("fromPage", fromPage);
    if (safeAnchor) {
      target.set("fromAnchor", safeAnchor);
    }
  }
}

export function applyControlledTabQueryUpdate(
  activeTab: WorkbenchTabId,
  ownerTab: WorkbenchTabId,
  currentParams: URLSearchParams,
  nextTabParams: URLSearchParams,
): URLSearchParams | null {
  if (activeTab !== ownerTab) return null;
  const merged = new URLSearchParams();
  merged.set("tab", ownerTab);
  preserveWikiBackParams(merged, currentParams);
  for (const [k, v] of nextTabParams.entries()) {
    if (k === "tab" || k === "fromPage" || k === "fromAnchor") continue;
    merged.set(k, v);
  }
  return merged.toString() === currentParams.toString() ? null : merged;
}

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
  dpLocalSize?: number | undefined;
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
  const dpLocal = parseParallel("dpLocal");
  if (dpLocal !== undefined && (dp === undefined || (dpLocal <= dp && dp % dpLocal === 0))) {
    out.dpLocalSize = dpLocal;
  }
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
  preserveWikiBackParams(next, preserve);
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
    const explicitDl = input.dpLocalSize;
    const maxNodeRanks = input.cardId === "a3-die64g" ? 16 : 8;
    const effTp = input.tpSize ?? 1;
    const effPp = input.ppSize ?? 1;
    const effPcp = input.pcpSize ?? 1;
    if (
      explicitDl !== undefined &&
      Number.isSafeInteger(explicitDl) &&
      explicitDl >= 1 &&
      explicitDl <= input.dpSize &&
      input.dpSize % explicitDl === 0 &&
      explicitDl * effTp * effPp * effPcp <= maxNodeRanks
    ) {
      next.set("dpLocal", String(explicitDl));
    }
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
  const safeAnchor = sanitizeWikiBackAnchor(params.get("fromAnchor"));
  return {
    pathname: `/wiki/${rawPage}`,
    hash: safeAnchor ? `#${safeAnchor}` : "",
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
  const diag = analyzeTroubleshootInput(guardMalformedMetricLinesForAnalyzer(trimmed));
  if (diag.findings.some((f) => f.category === "memory")) return true;
  if (diag.metrics.kvCacheUsageRatio !== undefined) return true;
  return false;
}

const WORKBENCH_REDACTION_MASKS: DiagnosticRedactionMasks = {
  keyMask: "[REDACTED_KEY]",
  tokenMask: "[REDACTED_TOKEN]",
  flagMask: "[REDACTED]",
  privateKeyMask: "[REDACTED_PRIVATE_KEY]",
  authMask: "[REDACTED_AUTH]",
  ipMask: "<REDACTED_IP>",
  bracketedIpMask: "[<REDACTED_IP>]",
};

export function sanitizeDiagnosticText(raw: string): { sanitized: string; redactionCount: number } {
  const pass1 = redactDiagnosticCredentials(raw, WORKBENCH_REDACTION_MASKS);
  const stripped = stripDiagnosticControlAndInvisibleChars(pass1.text);
  if (stripped === pass1.text) {
    return { sanitized: stripped, redactionCount: pass1.count };
  }
  const pass2 = redactDiagnosticCredentials(stripped, WORKBENCH_REDACTION_MASKS);
  return { sanitized: pass2.text, redactionCount: pass1.count + pass2.count };
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
const MAX_TROUBLESHOOT_CHARS = 64 * 1024;

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export const DOCTOR_SHARE_QUERY_KEYS = [
  "topology",
  "preset",
  "hw",
  "dhw",
  "ver",
  "fromVer",
  "hint",
  "roce",
  "mid",
  "traits",
  "cmd",
  "pcmd",
  "dcmd",
] as const;

export function hasExplicitDoctorQueryParams(params?: URLSearchParams): boolean {
  if (!params) return false;
  return DOCTOR_SHARE_QUERY_KEYS.some((k) => params.has(k));
}

/** True when `str` contains an unpaired UTF-16 surrogate code unit (0xD800–0xDFFF). */
function hasLoneSurrogate(str: string): boolean {
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        i += 1;
        continue;
      }
      return true;
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

/** Shared Doctor command character policy enforced identically at encode, share-link, chat, and decode time. */
function hasInvalidDoctorCommandChars(str: string): boolean {
  return str.includes("\0") || hasLoneSurrogate(str);
}

/** Slice `str` to at most `maxChars` UTF-16 code units without splitting a surrogate pair. */
function sliceCodePointSafe(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str;
  if (maxChars <= 0) return "";
  let end = maxChars;
  if (str.charCodeAt(end - 1) >= 0xd800 && str.charCodeAt(end - 1) <= 0xdbff) {
    end -= 1;
  }
  return str.slice(0, end);
}

/** Clamp `[start, end]` inward so slicing never splits a UTF-16 surrogate pair. */
function clampSliceBoundsCodePointSafe(str: string, start: number, end: number): [number, number] {
  let s = Math.max(0, Math.min(start, str.length));
  let e = Math.max(s, Math.min(end, str.length));
  if (s > 0 && s < str.length) {
    const c = str.charCodeAt(s);
    const prev = str.charCodeAt(s - 1);
    if (c >= 0xdc00 && c <= 0xdfff && prev >= 0xd800 && prev <= 0xdbff) {
      s += 1;
    }
  }
  if (e > s && e < str.length) {
    const prev = str.charCodeAt(e - 1);
    const next = str.charCodeAt(e);
    if (prev >= 0xd800 && prev <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) {
      e -= 1;
    }
  }
  return [s, Math.max(s, e)];
}

export function encodeDoctorCommandParam(text: string): string {
  if (hasInvalidDoctorCommandChars(text)) {
    throw new RangeError("Doctor command parameter contains disallowed NUL or lone surrogate character.");
  }
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeDoctorCommandParam(
  encoded: string,
  maxEncodedChars = MAX_WORKBENCH_SHARE_URL_CHARS,
): string | null {
  const trimmed = encoded.trim();
  if (!trimmed || trimmed.length > maxEncodedChars) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed) || trimmed.length % 4 === 1) return null;
  const padLen = (4 - (trimmed.length % 4)) % 4;
  const b64 = `${trimmed.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat(padLen)}`;
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const cleaned = stripBoundedHtmlComments(
      stripDiagnosticControlAndInvisibleChars(stripTerminalControlSequences(decoded)),
    );
    if (
      hasInvalidDoctorCommandChars(decoded) ||
      !decoded.trim() ||
      !cleaned.trim() ||
      measureMaxCharOrUtf8Bytes(decoded) > MAX_DOCTOR_COMMAND_CHARS
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export interface DoctorQueryOverrides {
  topology?: "single" | "pd" | undefined;
  presetId?: string | undefined;
  hardwareFamily?: AscendFamily | undefined;
  decodeHardwareFamily?: AscendFamily | undefined;
  version?: Extract<RuleVersion, "v0.30.0" | "main"> | undefined;
  fromVersion?: LegacyUpgradeFromVersion | undefined;
  modelHint?: DoctorModelHintKey | undefined;
  crossNodeRoce?: boolean | undefined;
  sharedModelId?: string | undefined;
  sharedTraitOverride?: DoctorModelTraitOverride | undefined;
  sharedCommand?: string | undefined;
  sharedPrefillCommand?: string | undefined;
  sharedDecodeCommand?: string | undefined;
}

function sanitizeDoctorTraitOverride(raw: unknown): DoctorModelTraitOverride | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const out: DoctorModelTraitOverride = {};
  if (typeof r.isMoe === "boolean") out.isMoe = r.isMoe;
  if (typeof r.useMla === "boolean") out.useMla = r.useMla;
  if (typeof r.sfaDcpReplicatedIndexer === "boolean") {
    out.sfaDcpReplicatedIndexer = r.sfaDcpReplicatedIndexer;
  }
  const posInt = (v: unknown, max: number): number | undefined =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= 1 && v <= max ? v : undefined;
  const ne = posInt(r.numExperts, 16_384);
  if (ne !== undefined) out.numExperts = ne;
  const nept = posInt(r.numExpertsPerTok, 1_024);
  if (nept !== undefined) out.numExpertsPerTok = nept;
  const nah = posInt(r.numAttentionHeads, 4_096);
  if (nah !== undefined) out.numAttentionHeads = nah;
  const nkvh = posInt(r.numKvHeads, 4_096);
  if (nkvh !== undefined) out.numKvHeads = nkvh;
  const hd = posInt(r.headDim, 4_096);
  if (hd !== undefined) out.headDim = hd;
  return Object.keys(out).length > 0 ? out : undefined;
}

export function matchExactDoctorPresetId(input: {
  topology: "single" | "pd";
  commandText: string;
  prefillCommandText: string;
  decodeCommandText: string;
  preferredPresetId?: string | undefined;
}): string | undefined {
  if (input.topology === "pd") {
    const preferred = input.preferredPresetId
      ? PD_DOCTOR_PRESETS.find((p) => p.id === input.preferredPresetId)
      : undefined;
    if (
      preferred &&
      preferred.prefillCommand === input.prefillCommandText &&
      preferred.decodeCommand === input.decodeCommandText
    ) {
      return preferred.id;
    }
    return PD_DOCTOR_PRESETS.find(
      (p) => p.prefillCommand === input.prefillCommandText && p.decodeCommand === input.decodeCommandText,
    )?.id;
  }
  const singlePool = [...FULL_SINGLE_DOCTOR_PRESETS, ...MINIMAL_DOCTOR_PRESETS];
  const preferred = input.preferredPresetId
    ? singlePool.find((p) => p.id === input.preferredPresetId)
    : undefined;
  if (preferred && preferred.command === input.commandText) return preferred.id;
  return singlePool.find((p) => p.command === input.commandText)?.id;
}

export function parseDoctorQueryParams(
  params: URLSearchParams,
  fullUrlLength?: number,
): DoctorQueryOverrides {
  const out: DoctorQueryOverrides = {};
  const topology = params.get("topology")?.trim() as "single" | "pd" | undefined;
  if (topology && ALLOWED_DOCTOR_TOPOLOGIES.has(topology)) out.topology = topology;

  const preset = params.get("preset")?.trim();
  if (preset && ALLOWED_DOCTOR_PRESETS.has(preset)) out.presetId = preset;

  const hw = params.get("hw")?.trim() as AscendFamily | undefined;
  if (hw && ALLOWED_HARDWARE_FAMILIES.has(hw)) out.hardwareFamily = hw;

  const dhw = params.get("dhw")?.trim() as AscendFamily | undefined;
  if (dhw && ALLOWED_HARDWARE_FAMILIES.has(dhw)) out.decodeHardwareFamily = dhw;

  const ver = params.get("ver")?.trim() as Extract<RuleVersion, "v0.30.0" | "main"> | undefined;
  if (ver && ALLOWED_RULE_VERSIONS.has(ver)) out.version = ver;

  const fromVer = params.get("fromVer")?.trim() as LegacyUpgradeFromVersion | undefined;
  if (fromVer && ALLOWED_UPGRADE_FROM_VERSIONS.has(fromVer)) out.fromVersion = fromVer;

  const hint = params.get("hint")?.trim() as DoctorModelHintKey | undefined;
  if (hint && ALLOWED_DOCTOR_HINTS.has(hint)) out.modelHint = hint;

  const roce = params.get("roce")?.trim().toLowerCase();
  if (roce === "1" || roce === "true") out.crossNodeRoce = true;
  else if (roce === "0" || roce === "false") out.crossNodeRoce = false;

  const withinShareBudget =
    (fullUrlLength === undefined || fullUrlLength <= MAX_WORKBENCH_SHARE_URL_CHARS) &&
    params.toString().length <= MAX_WORKBENCH_SHARE_URL_CHARS;

  if (withinShareBudget) {
    const rawMid = params.get("mid")?.trim();
    if (rawMid && ALLOWED_PRESETS.has(rawMid)) {
      out.sharedModelId = rawMid;
    }
    const rawTraits = params.get("traits");
    if (rawTraits !== null) {
      const decodedTraits = decodeDoctorCommandParam(rawTraits, 512);
      if (decodedTraits) {
        try {
          const parsedTraits = sanitizeDoctorTraitOverride(JSON.parse(decodedTraits));
          if (parsedTraits) out.sharedTraitOverride = parsedTraits;
        } catch {
          // Ignore malformed traits param
        }
      }
    }
    const rawPcmd = params.get("pcmd");
    const rawDcmd = params.get("dcmd");
    if (rawPcmd !== null && rawDcmd !== null) {
      const pcmd = decodeDoctorCommandParam(rawPcmd);
      const dcmd = decodeDoctorCommandParam(rawDcmd);
      if (pcmd !== null && dcmd !== null) {
        const safePcmd = sanitizeDiagnosticText(stripTerminalControlSequences(pcmd)).sanitized;
        const safeDcmd = sanitizeDiagnosticText(stripTerminalControlSequences(dcmd)).sanitized;
        if (safePcmd.trim() && safeDcmd.trim()) {
          out.sharedPrefillCommand = safePcmd;
          out.sharedDecodeCommand = safeDcmd;
          if (!out.topology) out.topology = "pd";
        }
      }
    } else {
      const rawCmd = params.get("cmd");
      if (rawCmd !== null) {
        const cmd = decodeDoctorCommandParam(rawCmd);
        if (cmd !== null) {
          const safeCmd = sanitizeDiagnosticText(stripTerminalControlSequences(cmd)).sanitized;
          if (safeCmd.trim()) {
            out.sharedCommand = safeCmd;
            if (!out.topology) out.topology = "single";
          }
        }
      }
    }
  }
  return out;
}

export type DoctorAutoSyncQueryInput = Omit<
  DoctorQueryOverrides,
  "sharedModelId" | "sharedTraitOverride" | "sharedCommand" | "sharedPrefillCommand" | "sharedDecodeCommand"
>;

export function buildDoctorQueryParams(
  input: DoctorAutoSyncQueryInput,
  preserve?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams();
  next.set("tab", "doctor");
  preserveWikiBackParams(next, preserve);
  if (input.topology && ALLOWED_DOCTOR_TOPOLOGIES.has(input.topology)) next.set("topology", input.topology);
  if (input.presetId && ALLOWED_DOCTOR_PRESETS.has(input.presetId)) next.set("preset", input.presetId);
  if (input.hardwareFamily && ALLOWED_HARDWARE_FAMILIES.has(input.hardwareFamily)) {
    next.set("hw", input.hardwareFamily);
  }
  if (
    input.topology === "pd" &&
    input.decodeHardwareFamily &&
    ALLOWED_HARDWARE_FAMILIES.has(input.decodeHardwareFamily)
  ) {
    next.set("dhw", input.decodeHardwareFamily);
  }
  if (input.version && ALLOWED_RULE_VERSIONS.has(input.version)) next.set("ver", input.version);
  if (input.fromVersion && ALLOWED_UPGRADE_FROM_VERSIONS.has(input.fromVersion)) {
    next.set("fromVer", input.fromVersion);
  }
  if (input.modelHint && ALLOWED_DOCTOR_HINTS.has(input.modelHint)) next.set("hint", input.modelHint);
  if (input.crossNodeRoce !== undefined) next.set("roce", input.crossNodeRoce ? "1" : "0");
  return next;
}

export type DoctorShareLinkResult =
  | {
      ok: true;
      url: string;
      params: URLSearchParams;
      redactionCount: number;
      usesPresetOnly: boolean;
    }
  | {
      ok: false;
      reason: string;
    };

export function buildDoctorShareLink(
  input: {
    topology: "single" | "pd";
    hardwareFamily: AscendFamily;
    decodeHardwareFamily?: AscendFamily | undefined;
    version: Extract<RuleVersion, "v0.30.0" | "main">;
    fromVersion?: LegacyUpgradeFromVersion | undefined;
    modelHint: DoctorModelHintKey;
    crossNodeRoce?: boolean | undefined;
    preferredPresetId?: string | undefined;
    sharedModelId?: string | undefined;
    sharedTraitOverride?: DoctorModelTraitOverride | undefined;
    commandText: string;
    prefillCommandText?: string | undefined;
    decodeCommandText?: string | undefined;
  },
  preserve?: URLSearchParams,
  baseToolsUrl = "http://localhost/#/tools",
): DoctorShareLinkResult {
  const matchedPresetId = matchExactDoctorPresetId({
    topology: input.topology,
    commandText: input.commandText,
    prefillCommandText: input.prefillCommandText ?? "",
    decodeCommandText: input.decodeCommandText ?? "",
    preferredPresetId: input.preferredPresetId,
  });

  const params = buildDoctorQueryParams(
    {
      topology: input.topology,
      presetId: matchedPresetId,
      hardwareFamily: input.hardwareFamily,
      decodeHardwareFamily: input.decodeHardwareFamily,
      version: input.version,
      fromVersion: input.fromVersion,
      modelHint: input.modelHint,
      ...(input.crossNodeRoce ? { crossNodeRoce: true } : {}),
    },
    preserve,
  );

  if (input.modelHint === "auto" && input.topology === "single") {
    const mid = input.sharedModelId?.trim();
    if (mid && ALLOWED_PRESETS.has(mid)) {
      params.set("mid", mid);
    }
    const cleanTraits = sanitizeDoctorTraitOverride(input.sharedTraitOverride);
    if (cleanTraits) {
      params.set("traits", encodeDoctorCommandParam(JSON.stringify(cleanTraits)));
    }
  }

  let redactionCount = 0;
  if (!matchedPresetId) {
    params.delete("preset");
    if (input.topology === "pd") {
      const rawPre = stripTerminalControlSequences(input.prefillCommandText ?? "");
      const rawDec = stripTerminalControlSequences(input.decodeCommandText ?? "");
      if (!rawPre.trim() || !rawDec.trim()) {
        return {
          ok: false,
          reason: "P/D 双实例联检需同时填写 Prefill 与 Decode 启动命令后再复制体检分享链接。",
        };
      }
      if (hasInvalidDoctorCommandChars(rawPre) || hasInvalidDoctorCommandChars(rawDec)) {
        return {
          ok: false,
          reason: "启动命令包含非法控制字符（NUL 或孤立 UTF-16 代理项），已拒绝生成分享链接。",
        };
      }
      if (
        measureMaxCharOrUtf8Bytes(rawPre) > MAX_DOCTOR_COMMAND_CHARS ||
        measureMaxCharOrUtf8Bytes(rawDec) > MAX_DOCTOR_COMMAND_CHARS
      ) {
        return {
          ok: false,
          reason: `启动命令超过长度上限（${MAX_DOCTOR_COMMAND_CHARS} 字符），为避免截断改变体检结论，已拒绝生成分享链接。`,
        };
      }
      const sanPre = sanitizeDiagnosticText(rawPre);
      const sanDec = sanitizeDiagnosticText(rawDec);
      if (
        !sanPre.sanitized.trim() ||
        !sanDec.sanitized.trim() ||
        !stripBoundedHtmlComments(sanPre.sanitized).trim() ||
        !stripBoundedHtmlComments(sanDec.sanitized).trim()
      ) {
        return {
          ok: false,
          reason: "P/D 双实例联检需同时填写 Prefill 与 Decode 启动命令后再复制体检分享链接。",
        };
      }
      if (hasInvalidDoctorCommandChars(sanPre.sanitized) || hasInvalidDoctorCommandChars(sanDec.sanitized)) {
        return {
          ok: false,
          reason: "脱敏后命令包含非法控制字符（NUL 或孤立 UTF-16 代理项），已拒绝生成分享链接。",
        };
      }
      if (
        measureMaxCharOrUtf8Bytes(sanPre.sanitized) > MAX_DOCTOR_COMMAND_CHARS ||
        measureMaxCharOrUtf8Bytes(sanDec.sanitized) > MAX_DOCTOR_COMMAND_CHARS
      ) {
        return {
          ok: false,
          reason: `脱敏后命令超过长度上限（${MAX_DOCTOR_COMMAND_CHARS} 字符），已拒绝生成分享链接。`,
        };
      }
      redactionCount = sanPre.redactionCount + sanDec.redactionCount;
      params.set("pcmd", encodeDoctorCommandParam(sanPre.sanitized));
      params.set("dcmd", encodeDoctorCommandParam(sanDec.sanitized));
    } else {
      const rawCmd = stripTerminalControlSequences(input.commandText);
      if (!rawCmd.trim()) {
        return { ok: false, reason: "当前启动命令为空，请先输入 vllm serve 命令后再复制体检分享链接。" };
      }
      if (hasInvalidDoctorCommandChars(rawCmd)) {
        return {
          ok: false,
          reason: "当前启动命令包含非法控制字符（NUL 或孤立 UTF-16 代理项），已拒绝生成分享链接。",
        };
      }
      if (measureMaxCharOrUtf8Bytes(rawCmd) > MAX_DOCTOR_COMMAND_CHARS) {
        return {
          ok: false,
          reason: `当前命令长度为 ${measureMaxCharOrUtf8Bytes(rawCmd)}，超过单次体检上限（${MAX_DOCTOR_COMMAND_CHARS}），拒绝截断生成链接。`,
        };
      }
      const san = sanitizeDiagnosticText(rawCmd);
      if (!san.sanitized.trim() || !stripBoundedHtmlComments(san.sanitized).trim()) {
        return { ok: false, reason: "当前启动命令为空，请先输入 vllm serve 命令后再复制体检分享链接。" };
      }
      if (hasInvalidDoctorCommandChars(san.sanitized)) {
        return {
          ok: false,
          reason: "脱敏后命令包含非法控制字符（NUL 或孤立 UTF-16 代理项），已拒绝生成分享链接。",
        };
      }
      if (measureMaxCharOrUtf8Bytes(san.sanitized) > MAX_DOCTOR_COMMAND_CHARS) {
        return {
          ok: false,
          reason: `脱敏后命令超过上限（${MAX_DOCTOR_COMMAND_CHARS} 字符），已拒绝生成分享链接。`,
        };
      }
      redactionCount = san.redactionCount;
      params.set("cmd", encodeDoctorCommandParam(san.sanitized));
    }
  }

  const url = `${baseToolsUrl}?${params.toString()}`;
  if (
    url.length > MAX_WORKBENCH_SHARE_URL_CHARS ||
    params.toString().length > MAX_WORKBENCH_SHARE_URL_CHARS
  ) {
    return {
      ok: false,
      reason: `分享链接总长为 ${url.length} 字符，超过地址安全上限（${MAX_WORKBENCH_SHARE_URL_CHARS} 字符）；为避免静默截断改变体检结论，已拒绝生成链接。`,
    };
  }
  return { ok: true, url, params, redactionCount, usesPresetOnly: Boolean(matchedPresetId) };
}

export const AICORE_SHARE_QUERY_KEYS = ["arch", "db", "fuse", "quant", "outlier"] as const;

export function hasExplicitAiCoreQueryParams(params?: URLSearchParams): boolean {
  if (!params) return false;
  return AICORE_SHARE_QUERY_KEYS.some((k) => params.has(k));
}

export interface AiCoreQueryOverrides {
  arch?: AiCoreArch | undefined;
  doubleBuffer?: boolean | undefined;
  fuseAddRmsNorm?: boolean | undefined;
  quantFormat?: QuantFormatId | undefined;
  outlierCh64?: number | undefined;
}

export function parseAiCoreQueryParams(params: URLSearchParams): AiCoreQueryOverrides {
  const out: AiCoreQueryOverrides = {};
  const arch = params.get("arch")?.trim() as AiCoreArch | undefined;
  if (arch && ALLOWED_AICORE_ARCHS.has(arch)) out.arch = arch;

  const db = params.get("db")?.trim();
  if (db === "1") out.doubleBuffer = true;
  else if (db === "0") out.doubleBuffer = false;

  const fuse = params.get("fuse")?.trim();
  if (fuse === "1") out.fuseAddRmsNorm = true;
  else if (fuse === "0") out.fuseAddRmsNorm = false;

  const quant = params.get("quant")?.trim() as QuantFormatId | undefined;
  if (quant && ALLOWED_AICORE_QUANTS.has(quant)) out.quantFormat = quant;

  const outlierRaw = params.get("outlier")?.trim();
  if (outlierRaw && /^\d+(?:\.\d+)?$/.test(outlierRaw)) {
    const val = Number(outlierRaw);
    if (Number.isFinite(val) && val >= OUTLIER_RANGE.min && val <= OUTLIER_RANGE.max) {
      out.outlierCh64 = Number(val.toFixed(1));
    }
  }
  return out;
}

export function buildAiCoreQueryParams(
  input: AiCoreQueryOverrides,
  preserve?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams();
  next.set("tab", "aicore");
  preserveWikiBackParams(next, preserve);
  if (input.arch && ALLOWED_AICORE_ARCHS.has(input.arch)) next.set("arch", input.arch);
  if (input.doubleBuffer !== undefined) next.set("db", input.doubleBuffer ? "1" : "0");
  if (input.fuseAddRmsNorm !== undefined) next.set("fuse", input.fuseAddRmsNorm ? "1" : "0");
  if (input.quantFormat && ALLOWED_AICORE_QUANTS.has(input.quantFormat)) {
    next.set("quant", input.quantFormat);
  }
  if (
    input.outlierCh64 !== undefined &&
    Number.isFinite(input.outlierCh64) &&
    input.outlierCh64 >= OUTLIER_RANGE.min &&
    input.outlierCh64 <= OUTLIER_RANGE.max
  ) {
    next.set("outlier", String(Number(input.outlierCh64.toFixed(1))));
  }
  return next;
}

export const TROUBLESHOOT_SHARE_QUERY_KEYS = ["panel", "fixture", "scenario", "step"] as const;

export function hasExplicitTroubleshootQueryParams(params?: URLSearchParams): boolean {
  if (!params) return false;
  return TROUBLESHOOT_SHARE_QUERY_KEYS.some((k) => params.has(k));
}

export function matchExactTroubleshootFixtureId(rawText: string): string | undefined {
  return TROUBLESHOOT_FIXTURES.find((f) => f.content === rawText)?.id;
}

export interface TroubleshootQueryOverrides {
  panel?: "logs" | "timeline" | undefined;
  fixtureId?: string | undefined;
  scenarioId?: TimelineScenarioId | undefined;
  step?: number | undefined;
}

export function parseTroubleshootQueryParams(params: URLSearchParams): TroubleshootQueryOverrides {
  const out: TroubleshootQueryOverrides = {};
  const panel = params.get("panel")?.trim() as "logs" | "timeline" | undefined;
  if (panel && ALLOWED_TROUBLESHOOT_PANELS.has(panel)) out.panel = panel;

  const fixture = params.get("fixture")?.trim();
  if (fixture && ALLOWED_TROUBLESHOOT_FIXTURES.has(fixture)) out.fixtureId = fixture;

  const scenario = params.get("scenario")?.trim() as TimelineScenarioId | undefined;
  if (scenario && ALLOWED_TIMELINE_SCENARIOS.has(scenario)) out.scenarioId = scenario;

  const stepRaw = params.get("step")?.trim();
  if (stepRaw && /^\d+$/.test(stepRaw)) {
    const n = Number(stepRaw);
    if (Number.isSafeInteger(n) && n >= 0 && n <= MAX_TROUBLESHOOT_TIMELINE_STEP) {
      out.step = n;
    }
  }
  return out;
}

export function buildTroubleshootQueryParams(
  input: TroubleshootQueryOverrides,
  preserve?: URLSearchParams,
): URLSearchParams {
  const next = new URLSearchParams();
  next.set("tab", "troubleshoot");
  preserveWikiBackParams(next, preserve);
  if (input.panel && ALLOWED_TROUBLESHOOT_PANELS.has(input.panel)) next.set("panel", input.panel);
  if (input.fixtureId && ALLOWED_TROUBLESHOOT_FIXTURES.has(input.fixtureId)) {
    next.set("fixture", input.fixtureId);
  }
  if (input.scenarioId && ALLOWED_TIMELINE_SCENARIOS.has(input.scenarioId)) {
    next.set("scenario", input.scenarioId);
  }
  if (
    input.step !== undefined &&
    Number.isSafeInteger(input.step) &&
    input.step >= 0 &&
    input.step <= MAX_TROUBLESHOOT_TIMELINE_STEP
  ) {
    next.set("step", String(input.step));
  }
  return next;
}

export type DeployChatAnalysisPayload = Extract<ChatAnalysisPayload, { kind: "deploy" }>;
export type DoctorChatAnalysisPayload = Extract<ChatAnalysisPayload, { kind: "doctor" }> & {
  modelId?: string | undefined;
  modelTraitOverride?: DoctorModelTraitOverride | undefined;
};
export type TroubleshootChatAnalysisPayload = Extract<ChatAnalysisPayload, { kind: "troubleshoot" }>;

const MAX_JSON_VALIDATION_DEPTH = 64;
const MAX_JSON_VALIDATION_NODES = 100_000;

interface JsonSafetyReport {
  readonly hasNonFinite: boolean;
  readonly exceededDepth: boolean;
}

/**
 * Iterative, depth- and node-bounded validator for arbitrary JSON-like objects.
 * Never overflows the JS call stack even on 4,000+ deep nested arrays.
 */
function inspectJsonSafety(
  value: unknown,
  maxDepth = MAX_JSON_VALIDATION_DEPTH,
  maxNodes = MAX_JSON_VALIDATION_NODES,
): JsonSafetyReport {
  const stack: Array<{ node: unknown; depth: number }> = [{ node: value, depth: 0 }];
  let queuedNodes = 1;

  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (typeof node === "number") {
      if (!Number.isFinite(node)) {
        return { hasNonFinite: true, exceededDepth: false };
      }
      continue;
    }
    if (!node || typeof node !== "object") continue;
    if (depth >= maxDepth) {
      return { hasNonFinite: false, exceededDepth: true };
    }
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i -= 1) {
        queuedNodes += 1;
        if (queuedNodes > maxNodes) return { hasNonFinite: false, exceededDepth: true };
        stack.push({ node: node[i], depth: depth + 1 });
      }
    } else {
      const obj = node as Record<string, unknown>;
      for (const key in obj) {
        if (!Object.hasOwn(obj, key)) continue;
        queuedNodes += 1;
        if (queuedNodes > maxNodes) return { hasNonFinite: false, exceededDepth: true };
        stack.push({ node: obj[key], depth: depth + 1 });
      }
    }
  }
  return { hasNonFinite: false, exceededDepth: false };
}

/**
 * Iterative, depth-bounded string leaf sanitizer applied identically to Deploy chat payloads
 * and calculator share-URL serialization so tokens inside structural fields (e.g. `architectures`)
 * are redacted on every export path.
 */
function sanitizeStructuralJsonLeaves(value: unknown, maxDepth = MAX_JSON_VALIDATION_DEPTH): unknown {
  const cleanLeaf = (raw: string): string => {
    const first = sanitizeDiagnosticText(stripTerminalControlSequences(raw)).sanitized;
    const noControls = stripDiagnosticControlAndInvisibleChars(first);
    return noControls === first ? first : sanitizeDiagnosticText(noControls).sanitized;
  };
  if (typeof value === "string") {
    return cleanLeaf(value);
  }
  if (!value || typeof value !== "object") return value;

  const rootOut: unknown = Array.isArray(value) ? [] : {};
  const stack: Array<{ src: unknown; dst: Record<string, unknown> | unknown[]; depth: number }> = [
    { src: value, dst: rootOut as Record<string, unknown> | unknown[], depth: 0 },
  ];

  while (stack.length > 0) {
    const { src, dst, depth } = stack.pop()!;
    if (Array.isArray(src)) {
      const dstArr = dst as unknown[];
      for (let i = 0; i < src.length; i += 1) {
        const item = src[i];
        if (typeof item === "string") {
          dstArr[i] = cleanLeaf(item);
        } else if (item && typeof item === "object") {
          if (depth + 1 > maxDepth) {
            throw new RangeError("Structural JSON exceeded maximum nesting depth.");
          }
          const child: Record<string, unknown> | unknown[] = Array.isArray(item) ? [] : {};
          dstArr[i] = child;
          stack.push({ src: item, dst: child, depth: depth + 1 });
        } else {
          dstArr[i] = item;
        }
      }
    } else {
      const dstObj = dst as Record<string, unknown>;
      for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
        if (v === undefined) continue;
        if (typeof v === "string") {
          dstObj[k] = cleanLeaf(v);
        } else if (v && typeof v === "object") {
          if (depth + 1 > maxDepth) {
            throw new RangeError("Structural JSON exceeded maximum nesting depth.");
          }
          const child: Record<string, unknown> | unknown[] = Array.isArray(v) ? [] : {};
          dstObj[k] = child;
          stack.push({ src: v, dst: child, depth: depth + 1 });
        } else {
          dstObj[k] = v;
        }
      }
    }
  }
  return rootOut;
}

export interface DeployCalculatorHandoffState {
  cardId: AscendCalcCardId;
  version: RuleVersion;
  weightPrecision: WeightPrecision;
  kvCacheDtype: KvCacheDtype;
  weightNzMode: 0 | 1 | 2;
  tpSize: number;
  ppSize: number;
  dpSize: number;
  dpLocalSize?: number | undefined;
  pcpSize: number;
  dcpSize: number;
  enableEp: boolean;
  useV2ModelRunner?: boolean | undefined;
  gpuMemoryUtilization: number;
  maxModelLen: number;
  maxNumBatchedTokens: number;
  maxNumSeqs: number;
  cudagraphMode: CudaGraphMode;
  prefillTokens: number;
  decodeBatchSize: number;
  decodeContextLen: number;
}

export function buildDeployViewSharedParams(state: DeployCalculatorHandoffState) {
  return {
    cardId: state.cardId,
    version: state.version,
    weightPrecision: state.weightPrecision,
    kvCacheDtype: state.kvCacheDtype,
    weightNzMode: state.weightNzMode,
    tpSize: state.tpSize,
    ppSize: state.ppSize,
    dpSize: state.dpSize,
    ...(state.dpLocalSize !== undefined ? { dpLocalSize: state.dpLocalSize } : {}),
    pcpSize: state.pcpSize,
    dcpSize: state.dcpSize,
    enableEp: state.enableEp,
    ...(state.useV2ModelRunner !== undefined ? { useV2ModelRunner: state.useV2ModelRunner } : {}),
    gpuMemoryUtilization: state.gpuMemoryUtilization,
    maxModelLen: state.maxModelLen,
    maxNumBatchedTokens: state.maxNumBatchedTokens,
    maxNumSeqs: state.maxNumSeqs,
    cudagraphMode: state.cudagraphMode,
    enforceEager: state.cudagraphMode === "NONE",
    prefillTokens: state.prefillTokens,
    decodeBatchSize: state.decodeBatchSize,
    decodeContextLen: state.decodeContextLen,
  };
}

export function buildDeployViewChatAnalysis(
  modelRef: string | Record<string, unknown>,
  state: DeployCalculatorHandoffState,
): DeployChatAnalysisPayload | undefined {
  return buildDeployChatAnalysis({
    model: modelRef,
    ...buildDeployViewSharedParams(state),
  });
}

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
  dpLocalSize?: number | undefined;
  pcpSize?: number | undefined;
  dcpSize?: number | undefined;
  enableEp?: boolean | undefined;
  useV2ModelRunner?: boolean | undefined;
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
      const safety = inspectJsonSafety(input.model);
      if (safety.hasNonFinite || safety.exceededDepth) return undefined;
      const encoded = new TextEncoder().encode(JSON.stringify(input.model));
      if (encoded.byteLength > MAX_DEPLOY_CONFIG_BYTES) return undefined;
      const structural = sanitizeStructuralJsonLeaves(extractStructuralHfConfig(input.model)) as Record<
        string,
        unknown
      >;
      const structuralSafety = inspectJsonSafety(structural, 6, 2_048);
      if (structuralSafety.hasNonFinite || structuralSafety.exceededDepth) return undefined;
      const cleanEncoded = new TextEncoder().encode(JSON.stringify(structural));
      if (cleanEncoded.byteLength > MAX_DEPLOY_CONFIG_BYTES) return undefined;
      model = structural;
    } catch {
      return undefined;
    }
  } else {
    return undefined;
  }
  if (!ALLOWED_CARDS.has(input.cardId)) return undefined;

  const clampInt = (val: number | undefined, lo: number, hi: number): number | undefined =>
    val !== undefined && Number.isFinite(val) ? Math.min(hi, Math.max(lo, Math.trunc(val))) : undefined;
  const clampedUtil =
    input.gpuMemoryUtilization !== undefined && Number.isFinite(input.gpuMemoryUtilization)
      ? Math.min(0.99, Math.max(0.1, Number(input.gpuMemoryUtilization.toFixed(4))))
      : undefined;
  const tpSize = clampInt(input.tpSize, 1, 256);
  const ppSize = clampInt(input.ppSize, 1, 256);
  const dpSize = clampInt(input.dpSize, 1, 256);
  const dpLocalSize = clampInt(input.dpLocalSize, 1, 256);
  const pcpSize = clampInt(input.pcpSize, 1, 256);
  const dcpSize = clampInt(input.dcpSize, 1, 256);
  const maxModelLen = clampInt(input.maxModelLen, 64, 1_048_576);
  const maxNumBatchedTokens = clampInt(input.maxNumBatchedTokens, 1, 1_048_576);
  const maxNumSeqs = clampInt(input.maxNumSeqs, 1, 65_536);
  const decodeBatchSize = clampInt(input.decodeBatchSize, 1, 65_536);
  const prefillTokens = clampInt(input.prefillTokens, 1, 1_048_576);
  const decodeContextLen = clampInt(input.decodeContextLen, 1, 1_048_576);

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
    ...(tpSize !== undefined ? { tpSize } : {}),
    ...(ppSize !== undefined ? { ppSize } : {}),
    ...(dpSize !== undefined ? { dpSize } : {}),
    ...(dpLocalSize !== undefined ? { dpLocalSize } : {}),
    ...(pcpSize !== undefined ? { pcpSize } : {}),
    ...(dcpSize !== undefined ? { dcpSize } : {}),
    ...(input.enableEp !== undefined ? { enableEp: input.enableEp } : {}),
    ...(input.useV2ModelRunner !== undefined ? { useV2ModelRunner: input.useV2ModelRunner } : {}),
    ...(clampedUtil !== undefined ? { gpuMemoryUtilization: clampedUtil } : {}),
    ...(maxModelLen !== undefined ? { maxModelLen } : {}),
    ...(maxNumBatchedTokens !== undefined ? { maxNumBatchedTokens } : {}),
    ...(maxNumSeqs !== undefined ? { maxNumSeqs } : {}),
    ...(input.cudagraphMode ? { cudagraphMode: input.cudagraphMode } : {}),
    ...(input.enforceEager !== undefined ? { enforceEager: input.enforceEager } : {}),
    ...(decodeBatchSize !== undefined ? { decodeBatchSize } : {}),
    ...(prefillTokens !== undefined ? { prefillTokens } : {}),
    ...(decodeContextLen !== undefined ? { decodeContextLen } : {}),
  };
}

/** Generic non-rule errors / exceptions / tracebacks kept behind primary rule evidence. */
const GENERIC_CRITICAL_FAULT_RE =
  /\b(?:RuntimeError|ValueError|AssertionError|KeyError|TypeError|AttributeError|MemoryError|OSError|ImportError|NotImplementedError|TimeoutError|ConnectionError|BrokenPipeError|ChildFailedError|SIGABRT|SIGBUS)\b|\b[A-Za-z_][A-Za-z0-9_]*(?:Error|Exception)\s*:|Traceback\s*\(most recent call last\)|^\s*File\s+"[^"\r\n]{1,200}",\s*line\s+\d+|\b(?:FATAL|CRITICAL|PANIC|ERROR)\b|heartbeat\s+timeout|ncclSystemError|ncclRemoteError|hccl\s+error|errno\s+98|broken\s+pipe|deadlock|core\s+dumped|(?:exit\s*code|returncode)\s*[=:]?\s*(?:-[1-9]\d*|[1-9]\d*)\b|returned\s+non-zero\s+exit/i;

const STAGE_AND_WARN_LINE_RE =
  /model\s+loading|load_model|loading\s+model\s+weights|profile_run|determine_available_memory|available\s+kv\s+cache|gpu\s+kv\s+cache|compile_or_warm_up_model|capture_model|aclgraph|npu\s+graph\s+memory|^\s*#\s*(?:HELP|TYPE)\s+vllm:|\bWARN(?:ING)?\b/i;

const TRACEBACK_CONTEXT_LINE_RE =
  /Traceback\s*\(most recent call last\)|File\s+"[^"\r\n]{1,200}",\s*line\s+\d+|\b(?:capture_model|compile_or_warm_up_model|load_model|load_weights|profile_run|Available KV cache memory|device_op\.py|wake_up|start_weight_update)\b/i;

const TRACEBACK_HEADER_RE = /Traceback\s*\(most recent call last\):/i;
const TRACEBACK_FRAME_OR_CONT_RE =
  /File\s+"[^"\r\n]{1,200}",\s*line\s+\d+|^\s{2,}\S|\]\s{2,}\S|Caused by:|During handling of the above exception|The above exception was the direct cause|Invocation of\s+\w+\s+method failed/i;

/**
 * Tier-0 zero-backtrack literal/code scanner for `compactOverlongLine`: derives ALL decisive
 * R13/R14/generic/device/HCCL codes from `evidenceLineMatcher.ts` without duplicating them.
 */
const TIER0_FAST_SCAN_RE = new RegExp(
  [
    DECISIVE_ERROR_CODE_SOURCE,
    "\\bACL_ERROR_[A-Z0-9_]+\\b",
    "\\bACLNN_ERR_[A-Z0-9_]+\\b",
    "(?:exit\\s*code|returncode|status)\\s*[=:]?\\s*(?:-[1-9]\\d*|[1-9]\\d*)\\b",
    "\\b(?:SIGKILL|SIGSEGV|SIGABRT|SIGBUS|OOMKilled|OutOfMemoryError)\\b",
    "out\\s+of\\s+memory",
    "No available memory for the cache blocks",
    "Free memory on device",
    "Error in memory profiling",
    "CheckSmmuFault",
    "retCode=0x0*[1-9a-f][0-9a-f]*",
    "(?:aicore|vector\\s+core)\\s+exception",
    "libopapi\\.so",
    "\\bZMQError\\b",
    "Address\\s+already\\s+in\\s+use",
    "\\bRaSocket\\w*\\b",
    "No route to host",
    "Cannot assign requested address",
    "Network is unreachable",
    "Connection refused",
    "\\b(?:EADDRNOTAVAIL|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED)\\b",
    "DispatchFFNCombine",
    "HCCL_BUFFSIZE is too SMALL",
    "mc2 group is not initialized",
    "expert_map is required",
    "fused mc2 op cannot be used",
    "supports at most 512 experts",
    "ModelSlim quantization config not found",
    "doesn't support quant_type=",
    "There was no fake impl registered",
    "\\bBackendCompilerFailed\\b",
    "torch\\._dynamo\\.exc\\.Unsupported",
    "\\btiling failed\\b",
    "\\bCheckMlaAttrs\\b",
    "Aicore kernel execute failed",
    "(?:AI|Vector)\\s+Core kernel (?:task )?execution failed",
    "Check ascend device type failed",
    "AscendFAImpl does not support ACL graph capture",
    "adopt static quantization",
    "FRACTAL_NZ mode is enabled",
    "Please set weight_nz_mode=0",
    "Mooncake worker requires",
    "Prefill TP size must be divisible by Decode TP size",
    "Dest buffer device_id",
    "torch reserved memory:",
    "Running batch with cudagraph_mode:",
    "VLLM_LOGGING_LEVEL\\s*[:=]\\s*['\"]?DEBUG",
    "ASCEND_RT_VISIBLE_DEVICES",
    "aclrtGetPhyDevIdByUserDevId",
    "drvGetDevInfo",
    "aclrtSetDevice",
    "rtSetDevice",
    "(?:lib)?ascend_hal\\.so",
    "davinci_manager",
    "\\/dev\\/davinci\\d+",
    "DP adjusted local rank",
    "local_world_size",
    "\\b(?:HCCL_SOCKET_IFNAME|HCCL_IF_IP|GLOO_SOCKET_IFNAME|TP_SOCKET_IFNAME)\\b",
    "segmentation\\s+fault",
    "core\\s+dumped",
    "returned\\s+non-zero\\s+exit",
  ].join("|"),
  "gi",
);

/** Keyword-gated bounded-gap (`[^\r\n]{0,200}`) Tier-0 scanners so repetitive tokens stay linear-time. */
const TIER0_GAP_RULES: ReadonlyArray<{ gate: RegExp; re: RegExp }> = [
  { gate: /SOC_VERSION/i, re: /\bSOC_VERSION\b[^\r\n]{0,200}(?:mismatch|invalid|error|fail|unsupported)/gi },
  { gate: /\bdown\b/i, re: /\bRoCE\b[^\r\n]{0,120}(?:\blink\b|\bport\b)[^\r\n]{0,40}\bdown\b/gi },
  {
    gate: /quant_model_description\.json/i,
    re: /quant_model_description\.json[^\r\n]{0,200}(?:not found|missing|does not exist|corrupt|invalid|decode|error|fail)/gi,
  },
  {
    gate: /MooncakeConnector/i,
    re: /MooncakeConnector\w*\b[^'\r\n]{0,40}\b(?:does not support|not supported|unsupported|failed|error|timeout|refused)/gi,
  },
  { gate: /\bGE\b/i, re: /\bGE\s+(?:compile|graph\s+compile|build)\b[^\r\n]{0,120}(?:fail|error)/gi },
];

/**
 * Benign zero/suppression markers that cancel fault semantics in `logAnalyzer.hasFailureSemantics`
 * (`status=0`, `error_code=0`, `errno=0`, `status=0x0000`, `retCode=0`, `isSmmuFault is 0`,
 * `direct transfer completed`, `EI0006 count=0`, `*Error: none`, and standalone `INFO`/`DEBUG`).
 * Preserved at highest Tier-0 subPriority (`-1`) whenever an overlong line hits fault tokens so
 * compaction never strips the suppressor and manufactures a phantom fault.
 */
const BENIGN_SUPPRESSION_TOKEN_RE =
  /\b(?:ret|retCode|err(?:or)?(?:_?code)?|status|errno|exit[^\S\r\n]*code|returncode)[^\S\r\n]*[:=#][^\S\r\n]*(?:0x0+\b|0\b(?!x[1-9a-f])|ok\b|none\b|null\b|false\b)|isSmmuFault[^\S\r\n]+is[^\S\r\n]+0\b|direct[^\S\r\n]+transfer[^\S\r\n]+completed|OutOfMemoryError[^\S\r\n]*[:=][^\S\r\n]*(?:0|false|none|null)\b|VLLM_LOGGING_LEVEL[^\S\r\n]*[:=][^\S\r\n]*['"]?(?:INFO|WARN(?:ING)?|ERROR|CRITICAL|OFF|DISABLED)['"]?\b|\b(?:EI000[2469]|EJ0001)\b[^\r\n]{0,32}\b(?:count|cnt|total|num|hits)\s*[:=]\s*0\b|\b(?:EI000[2469]|EJ0001)(?:_(?:count|cnt|total|num))?\s*[:=]\s*0\b|\b(?:[A-Z][A-Za-z0-9_]*\.)*(?:[A-Z][A-Za-z0-9_]*(?:Error|Exception)|Exception)\s*:\s*(?:none|null|nil|ok|false|0)\b/gi;

const BENIGN_LOG_LEVEL_TOKEN_RE = /\b(?:INFO|DEBUG)\b/gi;

/** Tier-1 wait cascades, remaining CANN/HCCL codes, and Python exceptions (all bounded gaps). */
const TIER1_SCAN_RE =
  /\b(?:EI0002|EI0006|HCCL_E_WAIT_TIMEOUT)\b|Notify\s+wait\s+execute\s+timeout|Watchdog\s+caught|EngineCore(?:Proc)?\b[^\r\n]{0,50}died unexpectedly|\b(?:BrokenPipeError|ChildFailedError)\b|\b(?:EI|EJ|EH|EZ|EL)\d{4}\b|\b(?:RuntimeError|ValueError|AssertionError|KeyError|TypeError|AttributeError|MemoryError|OSError|ImportError|NotImplementedError|TimeoutError|ConnectionError)\b|\b[A-Za-z_][A-Za-z0-9_]*(?:Error|Exception)\s*:/gi;

/** Tier-2 generic severity/traceback markers excluding bare `ERROR` (handled separately with a 2-hit cap). */
const TIER2_NON_ERROR_SCAN_RE =
  /\b(?:FATAL|CRITICAL|PANIC)\b|Traceback\s*\(most recent call last\)|File\s+"[^"\r\n]{1,200}",\s*line\s+\d+|deadlock|broken\s+pipe|errno\s+98|heartbeat\s+timeout/gi;
const BARE_ERROR_TOKEN_RE = /\bERROR\b/gi;

const HOST_TAG_SPAN_RE =
  /(?:\b(?:host(?:name)?|node(?:_name)?)\s*[:=]\s*["']?[^\s"'\]),;]+|\bnode[_-]?rank\s*[:=]?\s*\d+|\[\s*(?:host|node)(?:\s*[:=]\s*|\s+|[-_])[^\]\r\n]+|\b(?:host|node)[-_][^\s\]\r\n,;]+)/gi;
const INSTANCE_TAG_SPAN_RE =
  /(?:\binstance(?:_id)?\s*[:=]\s*['"]?[^\s"'\]),;]+|\[\s*instance\s+[^\]\r\n]+\])/gi;
const GROUP_TAG_SPAN_RE =
  /(?:\b(?:group(?:_name|_id)?|comm_group|pg_name)\s*[:=]\s*['"]?[^\s"'\]),;]+|\[\s*group\s+[^\]\r\n]+\]|\bgroup\s+(?!(?:is|are|was|were|be|been|of|for|by|on|in|to|from|with|at|as|and|or|not|no|init|initialized|timeout|failed|error)\b)[A-Za-z0-9_.:-]+\b)/gi;
const PID_TAG_SPAN_RE = /\bpid\s*=\s*\d+\b|\b(?:RUNTIME|HCCL|ASCENDCL|GE|DRV)\(\d+,/i;

const METADATA_NUMERIC_ID_LABEL_RE =
  /(?:^|[^A-Za-z0-9_])(?:pid|port|line|global_rank|local_rank|rank|device_id|device|step|tokens)\s*[:=#]?\s*$/i;

function extractLineIdentitySpansSplit(line: string): {
  coreSpans: Array<[number, number]>;
  domainSpans: Array<[number, number]>;
} {
  const coreSpans: Array<[number, number]> = [];
  const domainSpans: Array<[number, number]> = [];
  const pushSpan = (target: Array<[number, number]>, idx: number, len: number, pad = 4) => {
    target.push([Math.max(0, idx - pad), Math.min(line.length, idx + len + pad)]);
  };
  const rankMatch = extractRankMatch(line);
  if (rankMatch) {
    pushSpan(coreSpans, rankMatch.index, rankMatch.raw.length, 8);
  }
  const tsMatch = extractTimestamp(line);
  if (tsMatch.index !== null && tsMatch.length > 0) {
    pushSpan(coreSpans, tsMatch.index, tsMatch.length);
  }
  const pidMatch = PID_TAG_SPAN_RE.exec(line);
  if (pidMatch) {
    pushSpan(coreSpans, pidMatch.index, pidMatch[0].length);
  }
  for (const re of [HOST_TAG_SPAN_RE, INSTANCE_TAG_SPAN_RE, GROUP_TAG_SPAN_RE] as const) {
    re.lastIndex = 0;
    let count = 0;
    let tm = re.exec(line);
    while (tm !== null && count < 2) {
      const pre = line.slice(Math.max(0, tm.index - 48), tm.index);
      const isProseOrEnclosed =
        /[([][^)\]\r\n]*$/.test(pre) ||
        /\b(?:from|to|peer|remote|src|dst|target|destination|copying)\s+$/i.test(pre);
      if (!isProseOrEnclosed) {
        pushSpan(domainSpans, tm.index, tm[0].length);
        count += 1;
      }
      tm = re.exec(line);
    }
  }
  return { coreSpans, domainSpans };
}

export function extractLineIdentitySpans(line: string): Array<[number, number]> {
  const { coreSpans, domainSpans } = extractLineIdentitySpansSplit(line);
  return [...coreSpans, ...domainSpans];
}

const COMPACT_SPAN_MERGE_GAP = 24;

/** Incremental sorted & merged interval set with O(log m) budget checks (no O(k^2) re-sort). */
class IncrementalSpanBudget {
  readonly spans: Array<[number, number]> = [];
  private totalChars = 0;

  constructor(
    private readonly lineLen: number,
    private readonly maxChars: number,
    private readonly markerLen: number,
  ) {}

  tryAdd(rawS: number, rawE: number): boolean {
    const s = Math.max(0, Math.min(rawS, this.lineLen));
    const e = Math.max(s, Math.min(rawE, this.lineLen));
    if (e <= s) return true;

    const spans = this.spans;
    // Binary search for first interval whose right edge + merge gap reaches `s`.
    let lo = 0;
    let hi = spans.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (spans[mid]![1] + COMPACT_SPAN_MERGE_GAP < s) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }

    let hiExcl = lo;
    let removedChars = 0;
    while (hiExcl < spans.length && spans[hiExcl]![0] <= e + COMPACT_SPAN_MERGE_GAP) {
      removedChars += spans[hiExcl]![1] - spans[hiExcl]![0];
      hiExcl += 1;
    }

    const absorbed = hiExcl - lo;
    const ns = absorbed > 0 ? Math.min(s, spans[lo]![0]) : s;
    const ne = absorbed > 0 ? Math.max(e, spans[hiExcl - 1]![1]) : e;
    const nextTotalChars = this.totalChars - removedChars + (ne - ns);
    const nextCount = spans.length - absorbed + 1;
    const nextRenderedLen = nextTotalChars + Math.max(0, nextCount - 1) * this.markerLen;
    if (nextRenderedLen > this.maxChars) return false;

    spans.splice(lo, absorbed, [ns, ne]);
    this.totalChars = nextTotalChars;
    return true;
  }

  tryAddAll(ranges: ReadonlyArray<readonly [number, number]>): boolean {
    if (ranges.length === 0) return true;
    const saved = this.spans.map(([s, e]) => [s, e] as [number, number]);
    const savedTotal = this.totalChars;
    for (const [s, e] of ranges) {
      if (!this.tryAdd(s, e)) {
        this.spans.length = 0;
        this.spans.push(...saved);
        this.totalChars = savedTotal;
        return false;
      }
    }
    return true;
  }

  render(line: string, marker: string): string {
    return this.spans
      .map(([s, e]) => {
        const [cs, ce] = clampSliceBoundsCodePointSafe(line, s, e);
        return line.slice(cs, ce);
      })
      .join(marker);
  }
}

interface CompactCandidate {
  readonly s: number;
  readonly e: number;
  readonly tightS: number;
  readonly tightE: number;
  readonly tier: 0 | 1 | 2;
  readonly subPriority?: number;
}

const EXPLICIT_FAULT_LABEL_PREFIX_RE =
  /(?:error(?:\s+code)?(?:\s+is)?|acl\s+error|err(?:_?code)?|ret(?:_?code)?|status|failed)\s*[:=#(]?\s*$/i;
const ACLNN_OP_WORD_RE = /\baclnn[A-Za-z0-9_]+\b/gi;

const EXPLICIT_UNCONDITIONAL_FAILURE_SEM_RE =
  /\b(?:disconnected|broken|Timeout(?:Error)?|timed?\s+out|times?\s+out|\btimeout\b|EADDRNOTAVAIL|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED|ETIMEDOUT|Cannot assign requested address|No route to host|Network is unreachable|Connection refused|Permission denied|cannot open|does not exist|not found|corrupt|invalid|mismatch|not supported|unsupported|RuntimeError|ValueError|AssertionError|BackendCompilerFailed|ERROR|CRITICAL|FATAL)\b|\blink_status\s*[:=]\s*DOWN\b/i;

function getCompactionGapRuleBuckets(text: string): Set<string> {
  const out = new Set<string>();
  for (const primary of getAllPrimarySignalBuckets(text)) {
    out.add(`p:${primary}`);
  }
  if (/\b(?:CUDA|HIP)\b[^\r\n]{0,40}\bout of memory\b/i.test(text)) out.add("oom-cuda");
  if (/\btriton\b[^\r\n]{0,40}\b(?:kernel\s+)?compil/i.test(text)) out.add("triton");
  return out;
}

function neutralizeSpuriousGapMatches(
  fullLine: string,
  compacted: string,
  marker: string,
  maxLineChars: number,
): string {
  const origBuckets = getCompactionGapRuleBuckets(fullLine);
  let out = compacted;
  let searchFrom = 0;
  for (let pass = 0; pass < 4; pass += 1) {
    const curBuckets = getCompactionGapRuleBuckets(out);
    let hasSpurious = false;
    for (const b of curBuckets) {
      if (!origBuckets.has(b)) {
        hasSpurious = true;
        break;
      }
    }
    if (!hasSpurious) return out;
    // Widen each bridging marker past logAnalyzer's max 80-char gap, advancing across multiple
    // markers and trimming lowest-priority adjacent non-marker edges to stay within `maxLineChars`.
    const wideBridge = `${".".repeat(68)}${marker}`;
    const idx = out.indexOf(marker, searchFrom);
    if (idx === -1) break;
    const left = out.slice(0, idx);
    const right = out.slice(idx + marker.length);
    const candidate = `${left}${wideBridge}${right}`;
    if (candidate.length <= maxLineChars) {
      out = candidate;
      searchFrom = idx + wideBridge.length;
      continue;
    }
    const excess = candidate.length - maxLineChars;
    const rightTrimmed =
      right.length > excess + 12 ? right.slice(excess) : right.slice(Math.max(0, right.length - 12));
    const afterRightTrim = `${left}${wideBridge}${rightTrimmed}`;
    if (afterRightTrim.length <= maxLineChars) {
      out = afterRightTrim;
      searchFrom = idx + wideBridge.length;
    } else {
      const remExcess = afterRightTrim.length - maxLineChars;
      const safeLeftLen = Math.max(0, left.length - remExcess);
      out = `${left.slice(0, safeLeftLen)}${wideBridge}${rightTrimmed}`;
      searchFrom = safeLeftLen + wideBridge.length;
    }
  }
  return out.length <= maxLineChars ? out : sliceCodePointSafe(out, maxLineChars);
}

function compactOverlongLine(line: string, maxLineChars = 3600): string {
  if (line.length <= maxLineChars) return line;
  const marker = " ...[单行中段省略]... ";
  const headLen = Math.min(820, Math.floor(maxLineChars * 0.24));
  const tailLen = Math.min(820, Math.floor(maxLineChars * 0.24));
  const tightLeft = maxLineChars <= 600 ? 16 : 64;
  const tightRight = maxLineChars <= 600 ? 28 : 136;
  const { coreSpans, domainSpans } = extractLineIdentitySpansSplit(line);
  const lineIsBenignSuppressed = isBenignSuppressedDiagnosticLine(line);

  const candidates: CompactCandidate[] = [];
  const benignSpans: Array<[number, number]> = [];
  const tokenCounts = new Map<string, number>();

  const pushCandidate = (
    index: number,
    token: string,
    tier: 0 | 1 | 2,
    maxPerToken: number,
    subKey = "",
    subPriority = 1,
  ): boolean => {
    const baseTok = token.toLowerCase().replace(/\s+/g, " ").slice(0, 48);
    const key = subKey ? `${tier}|${baseTok}|${subKey}` : `${tier}|${baseTok}`;
    const seen = tokenCounts.get(key) ?? 0;
    if (seen >= maxPerToken) return false;
    tokenCounts.set(key, seen + 1);
    candidates.push({
      s: Math.max(0, index - 140),
      e: Math.min(line.length, index + token.length + 340),
      tightS: Math.max(0, index - tightLeft),
      tightE: Math.min(line.length, index + token.length + tightRight),
      tier,
      subPriority,
    });
    return true;
  };

  // Preserve both halves of split rule predicates (`HCCL_SOCKET_IFNAME ... invalid`, `GE compile ... failed`,
  // `RoCE ... port ... down`, `Free memory on device (...) on startup is less than desired`, etc.) atomically.
  const splitGroups = findSplitRulePredicateGroups(line);
  for (const grp of splitGroups) {
    for (const sp of grp) {
      pushCandidate(sp.index, line.slice(sp.index, sp.index + sp.length), 0, 2, "split", 0);
    }
  }

  // Tier 0: scan full unsliced line for decisive error codes, skipping metadata ID fields
  // (`port=`, `pid=`, `rank=`, etc.) so counters never exhaust budget before `retCode: 507015`.
  const deferredTier0Tail = new Map<string, { index: number; tok: string; subKey: string; prio: number }>();
  TIER0_FAST_SCAN_RE.lastIndex = 0;
  let m = TIER0_FAST_SCAN_RE.exec(line);
  while (m !== null) {
    const tok = m[0];
    const isNumericCode = /^\d+$/.test(tok);
    const prefix = isNumericCode ? line.slice(Math.max(0, m.index - 28), m.index) : "";
    if (isNumericCode && METADATA_NUMERIC_ID_LABEL_RE.test(prefix)) {
      if (tok.length === 0) TIER0_FAST_SCAN_RE.lastIndex += 1;
      m = TIER0_FAST_SCAN_RE.exec(line);
      continue;
    }
    const isExplicitFault = !isNumericCode || EXPLICIT_FAULT_LABEL_PREFIX_RE.test(prefix);
    const subKey = isExplicitFault ? "fault" : "bare";
    const prio = isExplicitFault ? 0 : 1;
    const perTokCap = DECISIVE_ERROR_CODE_RE.test(tok) ? 3 : 2;
    if (!pushCandidate(m.index, tok, 0, perTokCap, subKey, prio)) {
      const dKey = `${tok.toLowerCase()}|${subKey}`;
      deferredTier0Tail.set(dKey, { index: m.index, tok, subKey, prio });
    }
    if (tok.length === 0) TIER0_FAST_SCAN_RE.lastIndex += 1;
    m = TIER0_FAST_SCAN_RE.exec(line);
  }
  for (const hit of deferredTier0Tail.values()) {
    candidates.push({
      s: Math.max(0, hit.index - 140),
      e: Math.min(line.length, hit.index + hit.tok.length + 340),
      tightS: Math.max(0, hit.index - tightLeft),
      tightE: Math.min(line.length, hit.index + hit.tok.length + tightRight),
      tier: 0,
      subPriority: hit.prio,
    });
  }
  if (/aclnn/i.test(line) && /failed/i.test(line)) {
    ACLNN_OP_WORD_RE.lastIndex = 0;
    let am = ACLNN_OP_WORD_RE.exec(line);
    while (am !== null) {
      const end = am.index + am[0].length;
      const failWin = /failed/i.exec(line.slice(end, end + 200));
      if (failWin) {
        pushCandidate(am.index, am[0], 0, 2, "aclnn-op", 0);
        pushCandidate(end + failWin.index, failWin[0], 0, 2, "aclnn-fail", 0);
      }
      if (am[0].length === 0) ACLNN_OP_WORD_RE.lastIndex += 1;
      am = ACLNN_OP_WORD_RE.exec(line);
    }
  }
  for (const rule of TIER0_GAP_RULES) {
    if (!rule.gate.test(line)) continue;
    rule.re.lastIndex = 0;
    m = rule.re.exec(line);
    while (m !== null) {
      pushCandidate(m.index, m[0], 0, 2, "gap", 0);
      if (m[0].length === 0) rule.re.lastIndex += 1;
      m = rule.re.exec(line);
    }
  }

  // Tier 1: wait cascades, remaining CANN/HCCL codes, and Python exceptions (first exception promoted to Tier 0).
  let sawFirstException = false;
  let tier1Accepted = 0;
  TIER1_SCAN_RE.lastIndex = 0;
  m = TIER1_SCAN_RE.exec(line);
  while (m !== null) {
    const tok = m[0];
    const isException = /(?:Error|Exception)\b/.test(tok);
    const tier: 0 | 1 = isException && !sawFirstException ? 0 : 1;
    if (isException) sawFirstException = true;
    if (tier === 0 || tier1Accepted < 48) {
      if (pushCandidate(m.index, tok, tier, 2) && tier === 1) {
        tier1Accepted += 1;
      }
    }
    if (tok.length === 0) TIER1_SCAN_RE.lastIndex += 1;
    m = TIER1_SCAN_RE.exec(line);
  }

  // Preserve failure-semantics gate words (prioritizing unconditional `disconnected` / `broken` / `timeout`
  // over completion-gated `err` / `fail` so `err completed ... disconnected` preserves `disconnected`).
  if (splitGroups.length > 0) {
    const explicitSemMatch = EXPLICIT_UNCONDITIONAL_FAILURE_SEM_RE.exec(line);
    if (explicitSemMatch) {
      pushCandidate(explicitSemMatch.index, explicitSemMatch[0], 0, 2, "failure-sem", 0);
    } else {
      const gatedSemMatch = /\b(?:fail(?:s|ed|ure)?|err(?:or)?|does not match|does not support)\b/i.exec(
        line,
      );
      if (gatedSemMatch) {
        pushCandidate(gatedSemMatch.index, gatedSemMatch[0], 0, 2, "failure-sem", 0);
      }
    }
  }

  // Always preserve aclgraph initialization-failure exclusions (`Engine core initialization failed` /
  // `EngineCoreProc died unexpectedly`) regardless of line length or prior candidate counts.
  const graphExcl = /\bacl\s*graph\b|\baclgraph\b/i.test(line)
    ? /Engine core initialization failed|EngineCore(?:Proc)?\b[^\r\n]{0,50}died unexpectedly/i.exec(line)
    : null;
  if (graphExcl) {
    pushCandidate(graphExcl.index, graphExcl[0], 0, 2, "benign-guard", -1);
  }

  // Preserve zero-status, zero-counter, null-exception, and benign INFO/DEBUG suppressors
  // so compaction never strips a suppressor into a phantom diagnosis.
  if (
    lineIsBenignSuppressed ||
    ((candidates.length > 0 || splitGroups.length > 0) &&
      /(?:status|ret|err(?:or)?|errno|exit|returncode|SmmuFault|OutOfMemoryError|transfer|DEBUG|INFO)/i.test(
        line,
      ))
  ) {
    BENIGN_SUPPRESSION_TOKEN_RE.lastIndex = 0;
    let bm = BENIGN_SUPPRESSION_TOKEN_RE.exec(line);
    let keptBenign = 0;
    while (bm !== null && keptBenign < 4) {
      benignSpans.push([Math.max(0, bm.index - 4), Math.min(line.length, bm.index + bm[0].length + 4)]);
      if (pushCandidate(bm.index, bm[0], 0, 2, "benign-guard", -1)) {
        keptBenign += 1;
      }
      if (bm[0].length === 0) BENIGN_SUPPRESSION_TOKEN_RE.lastIndex += 1;
      bm = BENIGN_SUPPRESSION_TOKEN_RE.exec(line);
    }
    if (lineIsBenignSuppressed && keptBenign === 0) {
      BENIGN_LOG_LEVEL_TOKEN_RE.lastIndex = 0;
      const lm = BENIGN_LOG_LEVEL_TOKEN_RE.exec(line);
      if (lm) {
        benignSpans.push([Math.max(0, lm.index - 4), Math.min(line.length, lm.index + lm[0].length + 4)]);
        pushCandidate(lm.index, lm[0], 0, 2, "benign-guard", -1);
      }
    }
  }

  // Tier 2: generic severity / traceback tokens (bounded so 1MB `ERROR ` storms finish in milliseconds).
  let tier2Accepted = 0;
  TIER2_NON_ERROR_SCAN_RE.lastIndex = 0;
  m = TIER2_NON_ERROR_SCAN_RE.exec(line);
  while (m !== null && tier2Accepted < 16) {
    if (pushCandidate(m.index, m[0], 2, 2)) tier2Accepted += 1;
    if (m[0].length === 0) TIER2_NON_ERROR_SCAN_RE.lastIndex += 1;
    m = TIER2_NON_ERROR_SCAN_RE.exec(line);
  }
  let bareErrors = 0;
  BARE_ERROR_TOKEN_RE.lastIndex = 0;
  m = BARE_ERROR_TOKEN_RE.exec(line);
  while (m !== null && bareErrors < 2) {
    if (pushCandidate(m.index, m[0], 2, 2)) bareErrors += 1;
    if (m[0].length === 0) BARE_ERROR_TOKEN_RE.lastIndex += 1;
    m = BARE_ERROR_TOKEN_RE.exec(line);
  }

  // Fast path: if wide head + tail + identity + all deduplicated candidate spans fit, return directly.
  const wideBudget = new IncrementalSpanBudget(line.length, maxLineChars, marker.length);
  let allWideFit =
    wideBudget.tryAdd(0, headLen) && wideBudget.tryAdd(Math.max(0, line.length - tailLen), line.length);
  for (const [s, e] of coreSpans) {
    if (!wideBudget.tryAdd(s, e)) allWideFit = false;
  }
  for (const [s, e] of domainSpans) {
    if (!wideBudget.tryAdd(s, e)) allWideFit = false;
  }
  for (const cand of candidates) {
    if (!wideBudget.tryAdd(cand.s, cand.e)) {
      allWideFit = false;
      break;
    }
  }
  if (allWideFit) {
    const rendered = neutralizeSpuriousGapMatches(
      line,
      wideBudget.render(line, marker),
      marker,
      maxLineChars,
    );
    if (
      rendered.length <= maxLineChars &&
      (!lineIsBenignSuppressed || isBenignSuppressedDiagnosticLine(rendered))
    ) {
      return rendered;
    }
  }

  // Budgeted tight pass:
  // When line is benign-suppressed, admit rank/PID + benign suppressor BEFORE long domain tags & head/tail
  // so host/group metadata can never starve `status=0` or `DEBUG` at 512B budget.
  const tightBudget = new IncrementalSpanBudget(line.length, maxLineChars, marker.length);
  const tightHead = maxLineChars <= 600 ? Math.min(72, headLen) : Math.min(240, headLen);
  const tightTail = maxLineChars <= 600 ? Math.min(64, tailLen) : Math.min(240, tailLen);
  if (lineIsBenignSuppressed) {
    for (const [s, e] of coreSpans) {
      tightBudget.tryAdd(s, e);
    }
    for (const [s, e] of benignSpans) {
      tightBudget.tryAdd(s, e);
    }
    tightBudget.tryAdd(0, tightHead);
    tightBudget.tryAdd(Math.max(0, line.length - tightTail), line.length);
    for (const [s, e] of domainSpans) {
      tightBudget.tryAdd(s, e);
    }
  } else {
    tightBudget.tryAdd(0, tightHead);
    tightBudget.tryAdd(Math.max(0, line.length - tightTail), line.length);
    for (const [s, e] of coreSpans) {
      tightBudget.tryAdd(s, e);
    }
    for (const [s, e] of domainSpans) {
      tightBudget.tryAdd(s, e);
    }
  }
  for (const grp of splitGroups) {
    tightBudget.tryAddAll(
      grp.map((sp) => [Math.max(0, sp.index - 6), Math.min(line.length, sp.index + sp.length + 6)] as const),
    );
  }
  candidates.sort(
    (a, b) => a.tier - b.tier || (a.subPriority ?? 1) - (b.subPriority ?? 1) || a.tightS - b.tightS,
  );
  for (const cand of candidates) {
    tightBudget.tryAdd(cand.tightS, cand.tightE);
  }
  let bounded = neutralizeSpuriousGapMatches(line, tightBudget.render(line, marker), marker, maxLineChars);
  if (lineIsBenignSuppressed && !isBenignSuppressedDiagnosticLine(bounded)) {
    const safeSuppressedBudget = new IncrementalSpanBudget(line.length, maxLineChars, marker.length);
    for (const [s, e] of benignSpans) safeSuppressedBudget.tryAdd(s, e);
    for (const [s, e] of coreSpans) safeSuppressedBudget.tryAdd(s, e);
    safeSuppressedBudget.tryAdd(0, Math.min(48, tightHead));
    bounded = neutralizeSpuriousGapMatches(
      line,
      safeSuppressedBudget.render(line, marker),
      marker,
      maxLineChars,
    );
  }
  return bounded.length <= maxLineChars ? bounded : sliceCodePointSafe(bounded, maxLineChars);
}

function buildOmissionMarker(omittedFrom1: number, omittedTo1: number, nextLine1: number): string {
  return `... [日志节选：已省略第 ${omittedFrom1}–${omittedTo1} 行常规输出；下行起原行号 L${nextLine1}] ...`;
}

function buildTrailingOmissionMarker(omittedFrom1: number, omittedTo1: number): string {
  return `... [日志节选：已省略第 ${omittedFrom1}–${omittedTo1} 行常规输出] ...`;
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
  if (prevEnd >= 0 && prevEnd < lines.length - 1) {
    outParts.push(buildTrailingOmissionMarker(prevEnd + 2, lines.length));
  }
  return outParts.join("\n");
}

const BUCKET_CONSUMED_METRIC = 1;
const BUCKET_PRIMARY = 2;
const BUCKET_CONTEXT = 3;
const BUCKET_CASCADE = 4;
const BUCKET_UNCONSUMED_METRIC = 5;
const BUCKET_GENERIC_FAULT = 6;
const BUCKET_STAGE_WARN = 7;

function measureMaxCharOrUtf8Bytes(s: string): number {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ASCII fast path
  return /[^\x00-\x7f]/.test(s) ? Math.max(s.length, getUtf8ByteLength(s)) : s.length;
}

function measureTruncateLength(s: string, enforceBytes: boolean): number {
  return enforceBytes ? measureMaxCharOrUtf8Bytes(s) : s.length;
}

function sliceTruncateSafe(s: string, limit: number, enforceBytes: boolean): string {
  return enforceBytes ? sliceUtf8BytesSafe(s, limit) : sliceCodePointSafe(s, limit);
}

function compactOverlongLineBounded(line: string, targetLen: number, enforceBytes: boolean): string {
  const lineMeasure = measureTruncateLength(line, enforceBytes);
  if (lineMeasure <= targetLen) return line;
  const maxCharsGuess =
    enforceBytes && lineMeasure > line.length
      ? Math.max(48, Math.min(targetLen, Math.floor((targetLen * line.length) / lineMeasure) - 16))
      : targetLen;
  let budget = Math.max(48, Math.min(targetLen, maxCharsGuess));
  let compacted = compactOverlongLine(line, budget);
  while (enforceBytes && measureTruncateLength(compacted, true) > targetLen && budget > 48) {
    const ratio = targetLen / Math.max(1, measureTruncateLength(compacted, true));
    const nextBudget = Math.max(48, Math.min(budget - 16, Math.floor(budget * ratio * 0.92)));
    if (nextBudget >= budget) break;
    budget = nextBudget;
    compacted = compactOverlongLine(line, budget);
  }
  return measureTruncateLength(compacted, enforceBytes) <= targetLen
    ? compacted
    : sliceTruncateSafe(compacted, targetLen, enforceBytes);
}

function appendMetricsTruncatedMarkerBounded(
  text: string,
  maxChars: number,
  enforceBytes = maxChars >= 4096,
): string {
  const suffix = `\n${METRICS_TRUNCATED_MARKER}`;
  const suffixLen = measureTruncateLength(suffix, enforceBytes);
  if (measureTruncateLength(text, enforceBytes) + suffixLen <= maxChars) {
    return `${text}${suffix}`;
  }
  const allowed = maxChars - suffixLen;
  if (allowed <= 0) {
    return sliceTruncateSafe(METRICS_TRUNCATED_MARKER, maxChars, enforceBytes);
  }
  const parts = text.split("\n");
  while (parts.length > 0 && measureTruncateLength(parts.join("\n"), enforceBytes) > allowed) {
    parts.pop();
  }
  const trimmedBody = parts.join("\n");
  if (trimmedBody.length > 0) {
    return `${trimmedBody}${suffix}`;
  }
  return `${sliceTruncateSafe(text, allowed, enforceBytes)}${suffix}`;
}

function collectBackwardTracebackIndices(rawLines: readonly string[], idx: number, maxWalk = 12): number[] {
  const found: number[] = [];
  for (let k = idx - 1; k >= Math.max(0, idx - maxWalk); k -= 1) {
    const line = rawLines[k]!;
    if (TRACEBACK_HEADER_RE.test(line)) {
      found.push(k);
      break;
    }
    if (TRACEBACK_FRAME_OR_CONT_RE.test(line) || TRACEBACK_CONTEXT_LINE_RE.test(line)) {
      found.push(k);
      continue;
    }
    break;
  }
  return found;
}

/**
 * Smart rule-evidence-first excerpt within `maxChars` (default 64 KiB; enforces UTF-8 bytes
 * whenever `enforceBytes` is true, i.e. `maxChars >= 4096` or chat handoff calls):
 * - Uses `isRuleEvidenceLine` / `classifyEvidenceLine` as the single matcher covering all 20 analyzer rules.
 * - Reserves primary rule evidence, traceback headers, rank/device context, and consumed metric families
 *   BEFORE allocating head, tail, and cascade windows.
 * - Keeps all samples of consumed Prometheus metric families whenever budget allows; if any consumed metric
 *   sample is dropped or altered by compaction, appends `METRICS_TRUNCATED_MARKER` so downstream consumers
 *   mark aggregates incomplete instead of reporting under-counted totals.
 */
function trimTrailingHorizontalWsAndNewlines(text: string): string {
  let end = text.length;
  while (end > 0) {
    const c = text.charCodeAt(end - 1);
    if (c === 32 || c === 9 || c === 10) end -= 1;
    else break;
  }
  return end === text.length ? text : text.slice(0, end);
}

export function truncateTroubleshootLog(
  rawSanitized: string,
  maxChars = MAX_TROUBLESHOOT_CHARS,
  enforceBytes = maxChars >= 4096,
): string {
  // Preserve leading blank lines so 1-based original line numbers never shift on leading `\n`!
  const normalized = trimTrailingHorizontalWsAndNewlines(rawSanitized.replace(/\r\n?/g, "\n"));
  if (!normalized.trim()) return "";
  const measureStrLen = (s: string): number => measureTruncateLength(s, enforceBytes);
  const boundStr = (s: string, limit: number): string => sliceTruncateSafe(s, limit, enforceBytes);
  if (measureStrLen(normalized) <= maxChars) return normalized;

  const rawLines = normalized.split("\n");
  const total = rawLines.length;

  if (total === 1) {
    const singleIsConsumedMetric = isConsumedMetricSampleLine(normalized);
    if (singleIsConsumedMetric) {
      const markerBytes = measureStrLen(METRICS_TRUNCATED_MARKER) + 1;
      const bodyLimit = Math.max(64, maxChars - markerBytes);
      const compactedMetric = compactOverlongLineBounded(normalized, bodyLimit, enforceBytes);
      return appendMetricsTruncatedMarkerBounded(compactedMetric, maxChars, enforceBytes);
    }
    return compactOverlongLineBounded(normalized, maxChars, enforceBytes);
  }

  // Classify on FULL unsliced lines first so late signals on overlong lines are never missed.
  const bucket = new Uint8Array(total);
  const lines = new Array<string>(total);
  const lineMeasureLens = new Int32Array(total);
  let totalConsumedMetrics = 0;
  let hadCompactedConsumedMetric = false;
  const maxCompactedLineChars =
    maxChars <= 1024
      ? Math.max(200, Math.floor(maxChars * 0.48))
      : Math.min(3600, Math.max(256, Math.floor(maxChars * 0.72)));

  for (let i = 0; i < total; i += 1) {
    const full = rawLines[i]!;
    if (isRuleEvidenceLine(full)) {
      const kind = classifyEvidenceLine(full);
      if (kind === "metric") {
        if (isConsumedMetricSampleLine(full)) {
          bucket[i] = BUCKET_CONSUMED_METRIC;
          totalConsumedMetrics += 1;
        } else {
          bucket[i] = BUCKET_UNCONSUMED_METRIC;
        }
      } else if (kind === "primary") {
        bucket[i] = BUCKET_PRIMARY;
      } else if (kind === "context") {
        bucket[i] = BUCKET_CONTEXT;
      } else if (kind === "cascade") {
        bucket[i] = BUCKET_CASCADE;
      }
    } else if (GENERIC_CRITICAL_FAULT_RE.test(full)) {
      bucket[i] = BUCKET_GENERIC_FAULT;
    } else if (STAGE_AND_WARN_LINE_RE.test(full)) {
      bucket[i] = BUCKET_STAGE_WARN;
    }
    const compacted =
      measureStrLen(full) > maxCompactedLineChars
        ? compactOverlongLineBounded(full, maxCompactedLineChars, enforceBytes)
        : full;
    if (bucket[i] === BUCKET_CONSUMED_METRIC && compacted !== full) {
      hadCompactedConsumedMetric = true;
    }
    lines[i] = compacted;
    lineMeasureLens[i] = measureStrLen(compacted);
  }

  const markerOverheadIfCompacted = hadCompactedConsumedMetric
    ? measureStrLen(METRICS_TRUNCATED_MARKER) + 1
    : 0;

  const parseLineDomain = (raw: string): { host: string; instance: string; group: string; key: string } => {
    const cleanTag = (m: RegExpExecArray | null, dropKey = true): string => {
      if (!m) return "";
      let v = m[0].trim();
      if (dropKey) {
        const sep = /(?:[:=\s]|[-_])/.exec(v);
        if (sep) v = v.slice(sep.index + sep[0].length);
      }
      return v.replace(/^['"\s]+|['"\]\s]+$/g, "").toLowerCase();
    };
    const hm = HOST_TAG_SPAN_RE.exec(raw);
    HOST_TAG_SPAN_RE.lastIndex = 0;
    const im = INSTANCE_TAG_SPAN_RE.exec(raw);
    INSTANCE_TAG_SPAN_RE.lastIndex = 0;
    const gm = GROUP_TAG_SPAN_RE.exec(raw);
    GROUP_TAG_SPAN_RE.lastIndex = 0;
    const host = cleanTag(hm);
    const instance = cleanTag(im);
    const group = cleanTag(gm);
    return { host, instance, group, key: `${host}|${instance}|${group}` };
  };
  const areDomainsCompatible = (
    a: { host: string; instance: string; group: string },
    b: { host: string; instance: string; group: string },
  ): boolean =>
    (a.host === "" || b.host === "" || a.host === b.host) &&
    (a.instance === "" || b.instance === "" || a.instance === b.instance) &&
    (a.group === "" || b.group === "" || a.group === b.group);
  const lineDomains = rawLines.map(parseLineDomain);

  // Generic OutOfMemoryError lines (`torch.cuda.OutOfMemoryError`) require same-segment Ascend scope
  // context (`Using Ascend NPU backend`) because omission markers increment `logAnalyzer.currentSegmentId`.
  const genericScopedOomRe =
    /(?:OutOfMemoryError|\bCUDA\b[^\r\n]{0,30}\bout of memory|\bGPU[ \t]+\d+[ \t]*;[^\r\n]*out of memory)/i;
  const explicitNpuOomRe = /\bNPU[ \t]+out of memory\b|\bACL_ERROR_RT_MEMORY_ALLOCATION\b/i;
  const ascBridgeMaxChars = Math.max(256, maxChars);
  const findAscendScopeSpanForOom = (
    oomIdx: number,
  ): { lo: number; hi: number; anchorIdx: number } | null => {
    const oomRaw = rawLines[oomIdx]!;
    if (!genericScopedOomRe.test(oomRaw) || explicitNpuOomRe.test(oomRaw)) return null;
    const oomRank = extractRank(oomRaw);
    const oomDom = lineDomains[oomIdx]!;
    const oomTs = extractTimestamp(oomRaw).timestampMs;
    let bestSpan: { lo: number; hi: number; anchorIdx: number; bytes: number } | null = null;
    let bridgeChars = lines[oomIdx]!.length;
    for (let k = oomIdx - 1; k >= 0; k -= 1) {
      bridgeChars += lines[k]!.length + 1;
      if (bridgeChars > ascBridgeMaxChars) break;
      if (bucket[k] === BUCKET_CONTEXT && isAscendScopeContextLine(rawLines[k]!)) {
        const candRank = extractRank(rawLines[k]!);
        if (oomRank !== null && candRank !== null && oomRank !== candRank) continue;
        if (!areDomainsCompatible(oomDom, lineDomains[k]!)) continue;
        const candTs = extractTimestamp(rawLines[k]!).timestampMs;
        if (oomTs !== null && candTs !== null) {
          const delta = oomTs - candTs;
          if (delta < -5000 || delta > 600_000) continue;
        }
        bestSpan = { lo: k, hi: oomIdx, anchorIdx: k, bytes: bridgeChars };
        break;
      }
    }
    let fwdChars = lines[oomIdx]!.length;
    for (let k = oomIdx + 1; k < total; k += 1) {
      fwdChars += lines[k]!.length + 1;
      if (fwdChars > ascBridgeMaxChars) break;
      if (bestSpan && fwdChars >= bestSpan.bytes) break;
      if (bucket[k] === BUCKET_CONTEXT && isAscendScopeContextLine(rawLines[k]!)) {
        const candRank = extractRank(rawLines[k]!);
        if (oomRank !== null && candRank !== null && oomRank !== candRank) continue;
        if (!areDomainsCompatible(oomDom, lineDomains[k]!)) continue;
        const candTs = extractTimestamp(rawLines[k]!).timestampMs;
        if (oomTs !== null && candTs !== null) {
          const delta = oomTs - candTs;
          if (delta < -5000 || delta > 600_000) continue;
        }
        bestSpan = { lo: oomIdx, hi: k, anchorIdx: k, bytes: fwdChars };
        break;
      }
    }
    return bestSpan ? { lo: bestSpan.lo, hi: bestSpan.hi, anchorIdx: bestSpan.anchorIdx } : null;
  };

  const pidExtractRe = /\bpid\s*=\s*(\d+)\b|\b(?:RUNTIME|HCCL|ASCENDCL|GE|DRV)\((\d+),/i;
  const extractLinePid = (raw: string): string | null => {
    const pm = pidExtractRe.exec(raw);
    return pm ? (pm[1] ?? pm[2] ?? null) : null;
  };
  // Domain-aware PID-to-rank indexing mirroring `logAnalyzer.ts` (shared across Pass 1, 2, and 3):
  // - Never cross-pollinate incompatible domains (`host=node-a` vs `host=node-b`).
  // - Check compatibility against ALL observations for that PID (`host=node-a` with both Rank 1 and Rank 2
  //   is ambiguous on `host=node-a` too), preserving conflicting reps atomically or keeping neither.
  interface PidRankObs {
    rk: number;
    dom: { host: string; instance: string; group: string; key: string };
    preferredIdx: number;
    shortestIdx: number;
  }
  const pidRankObsMap = new Map<string, Map<string, PidRankObs>>();
  const pidAllDomainKeys = new Map<string, Set<string>>();
  for (let i = 0; i < total; i += 1) {
    const pid = extractLinePid(rawLines[i]!);
    if (!pid) continue;
    const dom = lineDomains[i]!;
    if (dom.key !== "||") {
      let dSet = pidAllDomainKeys.get(pid);
      if (!dSet) {
        dSet = new Set<string>();
        pidAllDomainKeys.set(pid, dSet);
      }
      dSet.add(dom.key);
    }
    const rk = extractRank(rawLines[i]!);
    if (rk === null) continue;
    let obsByKey = pidRankObsMap.get(pid);
    if (!obsByKey) {
      obsByKey = new Map<string, PidRankObs>();
      pidRankObsMap.set(pid, obsByKey);
    }
    const obsKey = `${dom.key}#${rk}`;
    const existing = obsByKey.get(obsKey);
    if (!existing) {
      obsByKey.set(obsKey, { rk, dom, preferredIdx: i, shortestIdx: i });
    } else {
      if (bucket[i] === BUCKET_PRIMARY && bucket[existing.preferredIdx] !== BUCKET_PRIMARY) {
        existing.preferredIdx = i;
      }
      if (lines[i]!.length < lines[existing.shortestIdx]!.length) {
        existing.shortestIdx = i;
      }
    }
  }
  type PidResolution =
    | { kind: "none" }
    | { kind: "unique"; preferredIdx: number; shortestIdx: number }
    | { kind: "ambiguous"; reps: number[] };
  const pidResolutionCache = new Map<string, PidResolution>();
  const resolvePidForLine = (
    pid: string,
    faultDom: { host: string; instance: string; group: string; key: string },
  ): PidResolution => {
    const cacheKey = `${pid}|${faultDom.key}`;
    const cached = pidResolutionCache.get(cacheKey);
    if (cached) return cached;
    const obsByKey = pidRankObsMap.get(pid);
    if (!obsByKey || obsByKey.size === 0) {
      const noneRes: PidResolution = { kind: "none" };
      pidResolutionCache.set(cacheKey, noneRes);
      return noneRes;
    }
    const compat: PidRankObs[] = [];
    const distinctRanks = new Set<number>();
    const hasExactCompat =
      faultDom.key !== "||" && Array.from(obsByKey.values()).some((o) => o.dom.key === faultDom.key);
    const hasMultipleExplicitDoms = (pidAllDomainKeys.get(pid)?.size ?? 0) > 1;
    for (const obs of obsByKey.values()) {
      if (obs.dom.key === "||" && !hasExactCompat && faultDom.key !== "||" && hasMultipleExplicitDoms) {
        continue;
      }
      if (!areDomainsCompatible(faultDom, obs.dom)) continue;
      compat.push(obs);
      distinctRanks.add(obs.rk);
    }
    if (compat.length === 0) {
      const noneRes: PidResolution = { kind: "none" };
      pidResolutionCache.set(cacheKey, noneRes);
      return noneRes;
    }
    if (distinctRanks.size > 1 || (faultDom.key === "||" && hasMultipleExplicitDoms)) {
      const reps: number[] = [];
      const seenRanks = new Set<number>();
      for (const obs of compat) {
        if (seenRanks.has(obs.rk)) continue;
        seenRanks.add(obs.rk);
        reps.push(obs.preferredIdx);
        if (reps.length >= 3) break;
      }
      if (reps.length < 2 && compat.length >= 2) {
        for (const obs of compat) {
          if (!reps.includes(obs.preferredIdx)) reps.push(obs.preferredIdx);
          if (reps.length >= 2) break;
        }
      }
      const ambRes: PidResolution = { kind: "ambiguous", reps };
      pidResolutionCache.set(cacheKey, ambRes);
      return ambRes;
    }
    // Single compatible rank: prefer exact domain match when available, else first compatible.
    const exactMatch = compat.find((o) => o.dom.key === faultDom.key) ?? compat[0]!;
    const uniqRes: PidResolution = {
      kind: "unique",
      preferredIdx: exactMatch.preferredIdx,
      shortestIdx: exactMatch.shortestIdx,
    };
    pidResolutionCache.set(cacheKey, uniqRes);
    return uniqRes;
  };
  const pushPidRankIntervals = (idx: number, target: Array<[number, number]>) => {
    if (extractRank(rawLines[idx]!) !== null) return;
    const pid = extractLinePid(rawLines[idx]!);
    if (!pid) return;
    const res = resolvePidForLine(pid, lineDomains[idx]!);
    if (res.kind === "ambiguous") {
      for (const rIdx of res.reps) target.push([rIdx, rIdx]);
    } else if (res.kind === "unique") {
      target.push([res.preferredIdx, res.preferredIdx]);
    }
  };

  // Pass 1: Head + ALL rule evidence + generic faults + stage/warn + Tail (keeps every metric line too).
  const pass1: Array<[number, number]> = [
    [0, Math.min(total - 1, 59)],
    [Math.max(0, total - 80), total - 1],
  ];
  for (let i = 0; i < total; i += 1) {
    const b = bucket[i]!;
    if (b === BUCKET_PRIMARY) {
      const tb = collectBackwardTracebackIndices(rawLines, i);
      const lo = tb.length > 0 ? Math.min(i - 3, tb[tb.length - 1]!) : i - 3;
      const ascSpan = findAscendScopeSpanForOom(i);
      pass1.push([
        Math.max(0, ascSpan ? Math.min(lo, ascSpan.lo) : lo),
        Math.min(total - 1, ascSpan ? Math.max(i + 4, ascSpan.hi) : i + 4),
      ]);
      pushPidRankIntervals(i, pass1);
    } else if (b === BUCKET_CASCADE) {
      pass1.push([Math.max(0, i - 3), Math.min(total - 1, i + 4)]);
      pushPidRankIntervals(i, pass1);
    } else if (b === BUCKET_GENERIC_FAULT) {
      pass1.push([Math.max(0, i - 3), Math.min(total - 1, i + 4)]);
    } else if (b === BUCKET_CONTEXT || b === BUCKET_STAGE_WARN) {
      pass1.push([Math.max(0, i - 2), Math.min(total - 1, i + 2)]);
    } else if (b === BUCKET_CONSUMED_METRIC || b === BUCKET_UNCONSUMED_METRIC) {
      pass1.push([i, i]);
    }
  }
  const assembled1 = assembleIntervals(lines, pass1);
  if (measureStrLen(assembled1) + markerOverheadIfCompacted <= maxChars) {
    return hadCompactedConsumedMetric
      ? appendMetricsTruncatedMarkerBounded(assembled1, maxChars, enforceBytes)
      : assembled1;
  }

  // Pass 2: Head + ALL consumed metrics + ALL primary/context/cascade/generic faults + Tail
  // (drops noisy histogram buckets / stage chatter while preserving 100% of consumed metric aggregates).
  const pass2: Array<[number, number]> = [
    [0, Math.min(total - 1, 35)],
    [Math.max(0, total - 55), total - 1],
  ];
  for (let i = 0; i < total; i += 1) {
    const b = bucket[i]!;
    if (b === BUCKET_CONSUMED_METRIC || b === BUCKET_CONTEXT) {
      pass2.push([i, i]);
    } else if (b === BUCKET_PRIMARY) {
      const tb = collectBackwardTracebackIndices(rawLines, i);
      const lo = tb.length > 0 ? Math.min(i - 3, tb[tb.length - 1]!) : i - 3;
      const ascSpan = findAscendScopeSpanForOom(i);
      pass2.push([
        Math.max(0, ascSpan ? Math.min(lo, ascSpan.lo) : lo),
        Math.min(total - 1, ascSpan ? Math.max(i + 3, ascSpan.hi) : i + 3),
      ]);
      pushPidRankIntervals(i, pass2);
    } else if (b === BUCKET_CASCADE) {
      pass2.push([Math.max(0, i - 2), Math.min(total - 1, i + 2)]);
      pushPidRankIntervals(i, pass2);
    } else if (b === BUCKET_GENERIC_FAULT) {
      pass2.push([Math.max(0, i - 2), Math.min(total - 1, i + 3)]);
    }
  }
  const assembled2 = assembleIntervals(lines, pass2);
  if (measureStrLen(assembled2) + markerOverheadIfCompacted <= maxChars) {
    return hadCompactedConsumedMetric
      ? appendMetricsTruncatedMarkerBounded(assembled2, maxChars, enforceBytes)
      : assembled2;
  }

  // Pass 3 (flood / storm): reserve primary rule evidence, traceback headers, rank/device context,
  // and consumed metric families BEFORE allocating cascade, head, tail, and generic fault windows.
  const markerReserve = totalConsumedMetrics > 0 ? measureStrLen(METRICS_TRUNCATED_MARKER) + 1 : 0;
  const budget = Math.max(0, maxChars - markerReserve);
  const exactMarkerOverhead = measureStrLen(buildOmissionMarker(total, total, total));
  const trailingMarkerOverhead = measureStrLen(buildTrailingOmissionMarker(total, total));

  const pickedSet = new Set<number>();
  let pickedCount = 0;
  let totalPickedChars = 0;
  let gapCount = 0;
  let minPicked = total;
  let maxPicked = -1;
  let pickedConsumedCount = 0;

  const estimateLen = (chars: number, count: number, gaps: number, hasTrailingGap: boolean): number =>
    chars +
    Math.max(0, count - 1) +
    gaps * (exactMarkerOverhead + 1) +
    (hasTrailingGap ? trailingMarkerOverhead + 1 : 0);

  const exactLenWithCandidates = (extraIndices: readonly number[]): number => {
    const sorted = Array.from(pickedSet);
    for (const k of extraIndices) {
      if (!pickedSet.has(k)) sorted.push(k);
    }
    sorted.sort((a, b) => a - b);
    let len = 0;
    let prev = -1;
    let first = true;
    for (const k of sorted) {
      if (prev < 0 && k > 0) {
        if (!first) len += 1;
        len += measureStrLen(buildOmissionMarker(1, k, k + 1));
        first = false;
      } else if (prev >= 0 && k > prev + 1) {
        if (!first) len += 1;
        len += measureStrLen(buildOmissionMarker(prev + 2, k, k + 1));
        first = false;
      }
      if (!first) len += 1;
      len += lineMeasureLens[k]!;
      first = false;
      prev = k;
    }
    if (prev >= 0 && prev < total - 1) {
      len += 1 + measureStrLen(buildTrailingOmissionMarker(prev + 2, total));
    }
    return len;
  };

  const currentEstimate = (): number =>
    estimateLen(totalPickedChars, pickedCount, gapCount, maxPicked >= 0 && maxPicked < total - 1);

  const tryPick = (idx: number, capLimit = budget): boolean => {
    if (idx < 0 || idx >= total || pickedSet.has(idx)) return false;
    let deltaGaps = 0;
    if (pickedCount === 0) {
      deltaGaps = idx > 0 ? 1 : 0;
    } else if (idx < minPicked) {
      const hasRight = idx === minPicked - 1;
      if (idx === 0) {
        deltaGaps = hasRight ? -1 : 0;
      } else {
        deltaGaps = hasRight ? 0 : 1;
      }
    } else if (idx > maxPicked) {
      deltaGaps = idx === maxPicked + 1 ? 0 : 1;
    } else {
      const hasLeft = pickedSet.has(idx - 1);
      const hasRight = pickedSet.has(idx + 1);
      deltaGaps = hasLeft && hasRight ? -1 : hasLeft || hasRight ? 0 : 1;
    }
    const nextChars = totalPickedChars + lineMeasureLens[idx]!;
    const nextCount = pickedCount + 1;
    const nextGaps = gapCount + deltaGaps;
    const nextMax = Math.max(maxPicked, idx);
    const hasTrailingGap = nextMax >= 0 && nextMax < total - 1;
    const est = estimateLen(nextChars, nextCount, nextGaps, hasTrailingGap);
    if (est > capLimit) {
      const totalMarkers = nextGaps + (hasTrailingGap ? 1 : 0);
      const maxDelta = Math.max(24, totalMarkers * (enforceBytes ? 48 : 16));
      if (totalMarkers === 0 || nextCount > 128 || est - capLimit > maxDelta) {
        return false;
      }
      if (exactLenWithCandidates([idx]) > capLimit) return false;
    }

    pickedSet.add(idx);
    totalPickedChars = nextChars;
    pickedCount = nextCount;
    gapCount = nextGaps;
    if (idx < minPicked) minPicked = idx;
    maxPicked = nextMax;
    if (bucket[idx] === BUCKET_CONSUMED_METRIC) pickedConsumedCount += 1;
    return true;
  };

  const tryPickAll = (indices: readonly number[], capLimit = budget): boolean => {
    const fresh = indices.filter((k) => k >= 0 && k < total && !pickedSet.has(k));
    if (fresh.length === 0) return true;
    const saved = Array.from(pickedSet);
    for (const k of fresh) {
      if (!tryPick(k, capLimit)) {
        // Restore state on partial failure so atomic multi-line admission never leaves half-picked ambiguity.
        pickedSet.clear();
        totalPickedChars = 0;
        pickedCount = 0;
        gapCount = 0;
        minPicked = total;
        maxPicked = -1;
        pickedConsumedCount = 0;
        for (const s of saved.sort((a, b) => a - b)) {
          tryPick(s, Number.MAX_SAFE_INTEGER);
        }
        return false;
      }
    }
    return true;
  };

  const sigCounts = new Map<string, number>();
  const pickedPrimaries: number[] = [];

  const getCanonicalPrimaryFamily = (ruleBucket: string): string => {
    switch (ruleBucket) {
      case "aicore":
      case "r13-code":
        return "r13-aicore";
      case "aclnn":
      case "aclnn-code":
      case "aclnn-fail":
        return "r14-aclnn";
      case "dev-env":
      case "dev-code":
      case "soc-version":
        return "r20-dev";
      case "ifname-init":
      case "ifname-net":
      case "ifname-env":
      case "rasocket":
      case "roce-down":
        return "r17-ifname";
      case "soc-310p":
      case "gqa-c8":
        return "r5-soc";
      default:
        return ruleBucket;
    }
  };

  interface PrimaryEntry {
    idx: number;
    rankKey: string;
    domainKey: string;
    ruleBucket: string;
    family: string;
    sig: string;
    pid: string | null;
  }
  const primaryEntries: PrimaryEntry[] = [];
  for (let i = 0; i < total; i += 1) {
    if (bucket[i] !== BUCKET_PRIMARY) continue;
    const rankKey = extractRank(lines[i]!) ?? "none";
    const ruleBucket = getPrimarySignalBucket(rawLines[i]!) ?? "primary";
    const strippedCodeSrc = stripLogIdFieldsForErrorCodes(lines[i]!);
    const codeHit = DECISIVE_ERROR_CODE_RE.exec(strippedCodeSrc);
    const codeSig = codeHit
      ? `${strippedCodeSrc
          .slice(Math.max(0, codeHit.index - 16), codeHit.index)
          .replace(/\s+/g, "")
          .toLowerCase()}:${codeHit[0].toLowerCase()}`
      : "";
    const normLine = lines[i]!.replace(/\d+/g, "#");
    const midStart = Math.max(0, Math.floor(normLine.length / 2) - 24);
    const sig = `p|${rankKey}|${ruleBucket}|${codeSig}|${normLine.slice(0, 64)}|${normLine.slice(midStart, midStart + 48)}|${normLine.slice(-64)}`;
    primaryEntries.push({
      idx: i,
      rankKey: String(rankKey),
      domainKey: lineDomains[i]!.key,
      ruleBucket,
      family: getCanonicalPrimaryFamily(ruleBucket),
      sig,
      pid: extractLinePid(rawLines[i]!),
    });
  }

  // Phase 1A: reserve earliest 1 representative per canonical primary rule family BEFORE cascade,
  // ensuring multi-clause sub-buckets (`r13-code` + `aicore`) cannot starve `BUCKET_CASCADE` at small budgets.
  const reservedFamilies = new Set<string>();
  const reservedBuckets = new Set<string>();
  const resolvedPids = new Set<string>();
  const phase1APicked: PrimaryEntry[] = [];
  const phase1ACandidates =
    maxChars <= 1024
      ? [
          ...primaryEntries.filter((e) => e.rankKey !== "none"),
          ...primaryEntries.filter((e) => e.rankKey === "none"),
        ]
      : primaryEntries;
  for (const entry of phase1ACandidates) {
    if (reservedFamilies.has(entry.family)) continue;
    if (tryPick(entry.idx)) {
      reservedFamilies.add(entry.family);
      reservedBuckets.add(entry.ruleBucket);
      sigCounts.set(entry.sig, (sigCounts.get(entry.sig) ?? 0) + 1);
      pickedPrimaries.push(entry.idx);
      phase1APicked.push(entry);
      if (entry.rankKey !== "none" && entry.pid) {
        resolvedPids.add(`${entry.pid}|${entry.domainKey}`);
      }
    }
  }

  // Phase 1B-bridge: ONLY bridge/reserve Ascend context when a generic `OutOfMemoryError` needs it;
  // never spend scarce 512B budget on unrelated `INFO Initializing HCCL` or `vllm_ascend` trace lines.
  let hasUnbridgedGenericOom = false;
  for (const oomIdx of pickedPrimaries) {
    const ascSpan = findAscendScopeSpanForOom(oomIdx);
    if (!ascSpan) {
      const oomRaw = rawLines[oomIdx]!;
      if (genericScopedOomRe.test(oomRaw) && !explicitNpuOomRe.test(oomRaw)) {
        hasUnbridgedGenericOom = true;
      }
      continue;
    }
    const bridgeIndices: number[] = [];
    for (let k = ascSpan.lo; k <= ascSpan.hi; k += 1) bridgeIndices.push(k);
    if (!tryPickAll(bridgeIndices)) {
      hasUnbridgedGenericOom = true;
      tryPick(ascSpan.anchorIdx);
    }
  }
  if (hasUnbridgedGenericOom) {
    const ascReservedDomains = new Set<string>();
    for (let i = 0; i < total; i += 1) {
      if (bucket[i] !== BUCKET_CONTEXT || !isAscendScopeContextLine(rawLines[i]!)) continue;
      const rk = String(extractRank(lines[i]!) ?? "none");
      if (ascReservedDomains.has(rk)) continue;
      if (pickedSet.has(i) || tryPick(i)) {
        ascReservedDomains.add(rk);
        const sig = `ctx|${rk}|${lines[i]!.replace(/\d+/g, "#").slice(0, 96)}`;
        sigCounts.set(sig, (sigCounts.get(sig) ?? 0) + 1);
      }
    }
  }
  for (let i = 0; i < total; i += 1) {
    if (bucket[i] !== BUCKET_CASCADE) continue;
    const rankKey = extractRank(lines[i]!) ?? "none";
    const sig = `cas|${rankKey}|${lines[i]!.replace(/\d+/g, "#").slice(0, 120)}`;
    if (tryPick(i)) {
      sigCounts.set(sig, (sigCounts.get(sig) ?? 0) + 1);
      break;
    }
  }

  // Phase 1A-PID & sub-buckets: resolve unranked primary PIDs strictly inside compatible causal scope
  // (or atomically keep conflicting domain reps for ambiguous PIDs), then reserve 1 per remaining sub-bucket.
  const recordAssociatedPrimary = (chosenIdx: number) => {
    if (bucket[chosenIdx] !== BUCKET_PRIMARY) return;
    const assocEntry = primaryEntries.find((e) => e.idx === chosenIdx);
    if (assocEntry) {
      reservedFamilies.add(assocEntry.family);
      reservedBuckets.add(assocEntry.ruleBucket);
      sigCounts.set(assocEntry.sig, (sigCounts.get(assocEntry.sig) ?? 0) + 1);
      pickedPrimaries.push(chosenIdx);
    }
  };
  for (const entry of phase1APicked) {
    if (entry.rankKey !== "none" || !entry.pid) continue;
    const resKey = `${entry.pid}|${entry.domainKey}`;
    if (resolvedPids.has(resKey)) continue;
    resolvedPids.add(resKey);
    const pidRes = resolvePidForLine(entry.pid, lineDomains[entry.idx]!);
    if (pidRes.kind === "none") continue;
    if (pidRes.kind === "ambiguous") {
      const reps = pidRes.reps.filter((idx) => idx !== entry.idx);
      if (reps.length >= 2 && tryPickAll(reps)) {
        for (const rIdx of reps) recordAssociatedPrimary(rIdx);
      }
      continue;
    }
    const { preferredIdx, shortestIdx } = pidRes;
    let chosenIdx: number | undefined;
    if (preferredIdx !== entry.idx && !pickedSet.has(preferredIdx)) {
      if (tryPick(preferredIdx)) {
        chosenIdx = preferredIdx;
      } else if (
        shortestIdx !== preferredIdx &&
        shortestIdx !== entry.idx &&
        !pickedSet.has(shortestIdx) &&
        tryPick(shortestIdx)
      ) {
        chosenIdx = shortestIdx;
      }
    } else if (shortestIdx !== entry.idx && !pickedSet.has(shortestIdx)) {
      if (tryPick(shortestIdx)) chosenIdx = shortestIdx;
    }
    if (chosenIdx !== undefined) recordAssociatedPrimary(chosenIdx);
  }
  for (const entry of primaryEntries) {
    if (reservedBuckets.has(entry.ruleBucket)) continue;
    if (pickedSet.has(entry.idx)) {
      reservedBuckets.add(entry.ruleBucket);
      continue;
    }
    if (tryPick(entry.idx)) {
      reservedBuckets.add(entry.ruleBucket);
      sigCounts.set(entry.sig, (sigCounts.get(entry.sig) ?? 0) + 1);
      pickedPrimaries.push(entry.idx);
    }
  }

  // Phase 1B-rest: 1 cascade line per remaining `(rank, sig)`.
  for (let i = 0; i < total; i += 1) {
    if (bucket[i] !== BUCKET_CASCADE || pickedSet.has(i)) continue;
    const rankKey = extractRank(lines[i]!) ?? "none";
    const sig = `cas|${rankKey}|${lines[i]!.replace(/\d+/g, "#").slice(0, 120)}`;
    if ((sigCounts.get(sig) ?? 0) >= 1) continue;
    if (tryPick(i)) sigCounts.set(sig, 1);
  }

  // Phase 1C: remaining primary rule evidence across distinct (rank, bucket, code/head/mid/tail shape, cap 4/sig).
  for (const entry of primaryEntries) {
    if (pickedSet.has(entry.idx)) continue;
    const seen = sigCounts.get(entry.sig) ?? 0;
    if (seen >= 4) continue;
    if (tryPick(entry.idx)) {
      sigCounts.set(entry.sig, seen + 1);
      pickedPrimaries.push(entry.idx);
    }
  }

  // Phase 2: Traceback headers/fault introducers BEFORE inner stack frames (`reverse()`), then neighbors.
  for (const idx of pickedPrimaries) {
    for (const tbIdx of collectBackwardTracebackIndices(rawLines, idx).reverse()) {
      tryPick(tbIdx);
    }
    for (const offset of [-2, -1, 1, 2]) {
      const nb = idx + offset;
      if (nb >= 0 && nb < total && TRACEBACK_CONTEXT_LINE_RE.test(lines[nb]!)) {
        tryPick(nb);
      }
    }
  }

  // Phase 3: Rank / device / lifecycle context (`ASCEND_RT_VISIBLE_DEVICES`, Ascend context, then OOM stage milestones).
  for (let i = 0; i < total; i += 1) {
    if (bucket[i] !== BUCKET_CONTEXT || !isVisibleDevicesContextLine(rawLines[i]!)) continue;
    const sig = `vd|${lines[i]!.trim().slice(0, 120)}`;
    const seen = sigCounts.get(sig) ?? 0;
    if (seen >= 4) continue;
    if (tryPick(i)) sigCounts.set(sig, seen + 1);
  }
  const milestoneCap = Math.min(budget, currentEstimate() + Math.floor(budget * 0.16));
  for (let i = 0; i < total; i += 1) {
    if (bucket[i] !== BUCKET_CONTEXT || pickedSet.has(i)) continue;
    const rankKey = extractRank(lines[i]!) ?? "none";
    const sig = `ctx|${rankKey}|${lines[i]!.replace(/\d+/g, "#").slice(0, 96)}`;
    const seen = sigCounts.get(sig) ?? 0;
    if (seen >= 2) continue;
    if (tryPick(i, milestoneCap)) sigCounts.set(sig, seen + 1);
  }

  // Phase 4: Consumed Prometheus metric samples — keep ALL samples whenever they fit in remaining budget;
  // otherwise keep representative samples per family and emit `METRICS_TRUNCATED_MARKER`.
  if (totalConsumedMetrics > 0) {
    let unpickedChars = 0;
    let unpickedCount = 0;
    let unpickedRuns = 0;
    let inRun = false;
    for (let i = 0; i < total; i += 1) {
      if (bucket[i] === BUCKET_CONSUMED_METRIC && !pickedSet.has(i)) {
        unpickedChars += lines[i]!.length;
        unpickedCount += 1;
        if (!inRun && !pickedSet.has(i - 1)) {
          unpickedRuns += 1;
        }
        inRun = true;
      } else {
        inRun = false;
      }
    }
    const worstAdditional = unpickedChars + unpickedCount + unpickedRuns * (exactMarkerOverhead + 1);
    if (currentEstimate() + worstAdditional <= budget) {
      for (let i = 0; i < total; i += 1) {
        if (bucket[i] === BUCKET_CONSUMED_METRIC) tryPick(i);
      }
    } else {
      const familyCounts = new Map<string, number>();
      const sampleCap = Math.min(budget, currentEstimate() + Math.floor(budget * 0.25));
      for (let i = 0; i < total; i += 1) {
        if (bucket[i] !== BUCKET_CONSUMED_METRIC) continue;
        const family = getVllmMetricSampleName(rawLines[i]!) ?? "vllm";
        const seen = familyCounts.get(family) ?? 0;
        if (seen >= 4) continue;
        if (tryPick(i, sampleCap)) familyCounts.set(family, seen + 1);
      }
    }
  }

  // Phase 5: Cascade rule evidence (`EI0002`, `EI0006`, `Watchdog`, `EngineCoreProc died`), keyed by rank.
  const cascadeHeadroom = Math.max(currentEstimate(), budget - Math.floor(budget * 0.24));
  for (let i = 0; i < total; i += 1) {
    if (bucket[i] !== BUCKET_CASCADE) continue;
    const rankKey = extractRank(lines[i]!) ?? "none";
    const sig = `cas|${rankKey}|${lines[i]!.replace(/\d+/g, "#").slice(0, 120)}`;
    const seen = sigCounts.get(sig) ?? 0;
    if (seen >= 4) continue;
    if (tryPick(i, cascadeHeadroom)) sigCounts.set(sig, seen + 1);
  }

  // Phase 6: Head (14%) & Tail (28%) context windows.
  const headBudget = Math.floor(budget * 0.14);
  let usedHead = 0;
  for (let i = 0; i < total; i += 1) {
    const cost = lines[i]!.length + 1;
    if (usedHead + cost > headBudget) break;
    if (pickedSet.has(i) || tryPick(i)) {
      usedHead += cost;
    } else {
      break;
    }
  }
  const tailBudget = Math.floor(budget * 0.28);
  let usedTail = 0;
  for (let i = total - 1; i >= 0; i -= 1) {
    const cost = lines[i]!.length + 1;
    if (usedTail + cost > tailBudget) break;
    if (pickedSet.has(i) || tryPick(i)) {
      usedTail += cost;
    } else {
      break;
    }
  }

  // Phase 7: Immediate ±1 neighbors around picked primary lines.
  for (const idx of pickedPrimaries) {
    tryPick(idx - 1);
    tryPick(idx + 1);
  }

  // Phase 8: Remaining budget goes to generic errors/exceptions, then stage/warning lines.
  for (const targetBucket of [BUCKET_GENERIC_FAULT, BUCKET_STAGE_WARN] as const) {
    for (let i = 0; i < total; i += 1) {
      if (bucket[i] !== targetBucket || pickedSet.has(i)) continue;
      const sig = `g${targetBucket}|${lines[i]!.replace(/\d+/g, "#").slice(0, 120)}`;
      const seen = sigCounts.get(sig) ?? 0;
      if (seen >= 3) continue;
      if (tryPick(i)) {
        sigCounts.set(sig, seen + 1);
        if (targetBucket === BUCKET_GENERIC_FAULT) {
          tryPick(i + 1);
        }
      }
    }
  }

  const droppedConsumedMetric = hadCompactedConsumedMetric || pickedConsumedCount < totalConsumedMetrics;

  if (pickedSet.size === 0) {
    const trailMarker = total > 1 ? buildTrailingOmissionMarker(2, total) : "";
    const reserveForTrail = trailMarker ? measureStrLen(trailMarker) + 1 : 0;
    const singleBodyLimit = Math.max(16, budget - reserveForTrail);
    const singleFallback = compactOverlongLineBounded(lines[0]!, singleBodyLimit, enforceBytes);
    const fallbackCombined = trailMarker ? `${singleFallback}\n${trailMarker}` : singleFallback;
    if (droppedConsumedMetric) {
      return appendMetricsTruncatedMarkerBounded(fallbackCombined, maxChars, enforceBytes);
    }
    return measureStrLen(fallbackCombined) <= maxChars
      ? fallbackCombined
      : boundStr(fallbackCombined, maxChars);
  }

  const keptIndices = Array.from(pickedSet).sort((a, b) => a - b);
  const renderPickedLines = (indices: readonly number[]): string => {
    const out: string[] = [];
    let prev = -1;
    for (const idx of indices) {
      if (prev < 0 && idx > 0) {
        out.push(buildOmissionMarker(1, idx, idx + 1));
      } else if (prev >= 0 && idx > prev + 1) {
        out.push(buildOmissionMarker(prev + 2, idx, idx + 1));
      }
      out.push(lines[idx]!);
      prev = idx;
    }
    if (prev >= 0 && prev < total - 1) {
      out.push(buildTrailingOmissionMarker(prev + 2, total));
    }
    return out.join("\n");
  };
  let rendered = renderPickedLines(keptIndices);
  while (keptIndices.length > 1 && measureStrLen(rendered) + markerReserve > maxChars) {
    let dropAt = -1;
    for (let pos = keptIndices.length - 1; pos >= 0; pos -= 1) {
      const b = bucket[keptIndices[pos]!]!;
      if (b === 0 || b === BUCKET_STAGE_WARN || b === BUCKET_UNCONSUMED_METRIC) {
        dropAt = pos;
        break;
      }
    }
    if (dropAt === -1) {
      let contextCount = 0;
      let lastExcessContextPos = -1;
      for (let pos = 0; pos < keptIndices.length; pos += 1) {
        const lineIdx = keptIndices[pos]!;
        if (bucket[lineIdx] === BUCKET_CONTEXT) {
          contextCount += 1;
          if (!isVisibleDevicesContextLine(rawLines[lineIdx]!)) {
            lastExcessContextPos = pos;
          }
        }
      }
      if (contextCount > 2 && lastExcessContextPos >= 0) dropAt = lastExcessContextPos;
    }
    if (dropAt === -1) {
      const dropRank = (b: number): number =>
        b === 0
          ? 7
          : b === BUCKET_STAGE_WARN
            ? 6
            : b === BUCKET_UNCONSUMED_METRIC
              ? 5
              : b === BUCKET_GENERIC_FAULT
                ? 4
                : b === BUCKET_CONTEXT
                  ? 3
                  : b === BUCKET_CASCADE
                    ? 2
                    : b === BUCKET_PRIMARY
                      ? 1
                      : 0;
      dropAt = keptIndices.length - 1;
      let worstRank = dropRank(bucket[keptIndices[dropAt]!]!);
      for (let pos = keptIndices.length - 2; pos >= 0; pos -= 1) {
        const r = dropRank(bucket[keptIndices[pos]!]!);
        if (r > worstRank) {
          worstRank = r;
          dropAt = pos;
        }
      }
    }
    keptIndices.splice(dropAt, 1);
    rendered = renderPickedLines(keptIndices);
  }
  let fallbackText = rendered;
  if (keptIndices.length === 1 && measureStrLen(fallbackText) + markerReserve > maxChars) {
    const onlyIdx = keptIndices[0]!;
    const leadMarker = onlyIdx > 0 ? buildOmissionMarker(1, onlyIdx, onlyIdx + 1) : "";
    const trailMarker = onlyIdx < total - 1 ? buildTrailingOmissionMarker(onlyIdx + 2, total) : "";
    const chromeLen =
      (leadMarker ? measureStrLen(leadMarker) + 1 : 0) + (trailMarker ? measureStrLen(trailMarker) + 1 : 0);
    const bodyLimit = Math.max(16, budget - chromeLen);
    const compactedOnly = compactOverlongLineBounded(lines[onlyIdx]!, bodyLimit, enforceBytes);
    fallbackText = [leadMarker, compactedOnly, trailMarker].filter(Boolean).join("\n");
  }
  if (droppedConsumedMetric) {
    return appendMetricsTruncatedMarkerBounded(fallbackText, maxChars, enforceBytes);
  }
  return measureStrLen(fallbackText) <= maxChars ? fallbackText : boundStr(fallbackText, maxChars);
}

export type DoctorChatAnalysisResult =
  | { ok: true; payload: DoctorChatAnalysisPayload }
  | { ok: false; reason: string };

export interface BuildDoctorChatAnalysisInput {
  command: string;
  decodeCommand?: string | undefined;
  mode?: "minimal" | "full" | undefined;
  hardwareFamily?: AscendFamily | undefined;
  decodeHardwareFamily?: AscendFamily | undefined;
  version?: RuleVersion | undefined;
  crossNodeRoce?: boolean | undefined;
  modelId?: string | undefined;
  modelTraitOverride?: DoctorModelTraitOverride | undefined;
}

/**
 * Validated Doctor chat-analysis payload builder: mirrors `buildDoctorShareLink`'s length and
 * character policy (never slices oversized commands or cuts mid-surrogate) and surfaces an
 * explicit rejection reason when rejected.
 */
export function buildDoctorChatAnalysisWithReason(
  input: BuildDoctorChatAnalysisInput,
): DoctorChatAnalysisResult {
  const rawCommand = stripTerminalControlSequences(input.command);
  if (!rawCommand.trim()) {
    return { ok: false, reason: "当前启动命令为空，无法生成配置体检分析载荷。" };
  }
  if (hasInvalidDoctorCommandChars(rawCommand)) {
    return {
      ok: false,
      reason: "当前启动命令包含非法控制字符（NUL 或孤立 UTF-16 代理项），已拒绝生成分析载荷。",
    };
  }
  if (measureMaxCharOrUtf8Bytes(rawCommand) > MAX_DOCTOR_COMMAND_CHARS) {
    return {
      ok: false,
      reason: `当前命令长度为 ${measureMaxCharOrUtf8Bytes(rawCommand)}，超过单次体检上限（${MAX_DOCTOR_COMMAND_CHARS}），拒绝静默截断分析。`,
    };
  }
  const command = sanitizeDiagnosticText(rawCommand).sanitized.trim();
  if (!command || !stripBoundedHtmlComments(command).trim()) {
    return { ok: false, reason: "脱敏及清理注释后启动命令为空，无法生成配置体检分析载荷。" };
  }
  if (hasInvalidDoctorCommandChars(command)) {
    return {
      ok: false,
      reason: "脱敏后命令包含非法控制字符（NUL 或孤立 UTF-16 代理项），已拒绝生成分析载荷。",
    };
  }
  const commandWireLen = measureMaxCharOrUtf8Bytes(command);
  const commandServerLen = measurePostNeutralizationLength(command, true);
  if (commandWireLen > MAX_DOCTOR_COMMAND_CHARS || commandServerLen > MAX_DOCTOR_COMMAND_CHARS) {
    return {
      ok: false,
      reason: `脱敏及安全转义后命令长度为 ${Math.max(commandWireLen, commandServerLen)}，超过上限（${MAX_DOCTOR_COMMAND_CHARS}），已拒绝静默截断分析。`,
    };
  }

  let decodeCommand = "";
  if (input.decodeCommand !== undefined) {
    const rawDecode = stripTerminalControlSequences(input.decodeCommand);
    if (!rawDecode.trim()) {
      return {
        ok: false,
        reason: "Decode 启动命令在清除空白或控制序列后为空，已拒绝生成配置体检分析载荷。",
      };
    }
    if (hasInvalidDoctorCommandChars(rawDecode)) {
      return {
        ok: false,
        reason: "Decode 启动命令包含非法控制字符（NUL 或孤立 UTF-16 代理项），已拒绝生成分析载荷。",
      };
    }
    if (measureMaxCharOrUtf8Bytes(rawDecode) > MAX_DOCTOR_COMMAND_CHARS) {
      return {
        ok: false,
        reason: `Decode 启动命令长度为 ${measureMaxCharOrUtf8Bytes(rawDecode)}，超过单次体检上限（${MAX_DOCTOR_COMMAND_CHARS}），拒绝静默截断分析。`,
      };
    }
    const sanDecode = sanitizeDiagnosticText(rawDecode).sanitized.trim();
    if (!sanDecode || !stripBoundedHtmlComments(sanDecode).trim()) {
      return {
        ok: false,
        reason: "脱敏及清理注释后 Decode 启动命令为空，已拒绝生成配置体检分析载荷。",
      };
    }
    if (hasInvalidDoctorCommandChars(sanDecode)) {
      return {
        ok: false,
        reason: "脱敏后 Decode 启动命令包含非法控制字符，已拒绝生成分析载荷。",
      };
    }
    const decodeWireLen = measureMaxCharOrUtf8Bytes(sanDecode);
    const decodeServerLen = measurePostNeutralizationLength(sanDecode, true);
    if (decodeWireLen > MAX_DOCTOR_COMMAND_CHARS || decodeServerLen > MAX_DOCTOR_COMMAND_CHARS) {
      return {
        ok: false,
        reason: `脱敏及安全转义后 Decode 启动命令长度为 ${Math.max(decodeWireLen, decodeServerLen)}，超过上限（${MAX_DOCTOR_COMMAND_CHARS}），已拒绝静默截断分析。`,
      };
    }
    decodeCommand = sanDecode;
  }

  const rawModelId = input.modelId?.trim();
  let normalizedModelId: string | undefined;
  if (rawModelId && rawModelId.toLowerCase() !== "auto") {
    if (hasInvalidDoctorCommandChars(rawModelId)) {
      return {
        ok: false,
        reason: "模型标识包含非法控制字符（NUL 或孤立 UTF-16 代理项），已拒绝生成分析载荷。",
      };
    }
    const cleanModelId = sanitizeDiagnosticText(stripTerminalControlSequences(rawModelId)).sanitized.trim();
    if (!cleanModelId || !stripBoundedHtmlComments(cleanModelId).trim()) {
      return {
        ok: false,
        reason: "模型标识在脱敏及清理注释后为空，已拒绝生成配置体检分析载荷。",
      };
    }
    const clipped = sliceCodePointSafe(cleanModelId, 120);
    const modelIdServerLen = measurePostNeutralizationLength(clipped, false);
    if (modelIdServerLen > 120) {
      return {
        ok: false,
        reason: `模型标识在脱敏及安全转义后长度为 ${modelIdServerLen} 字符，超过上限（120 字符），已拒绝生成分析载荷。`,
      };
    }
    normalizedModelId = clipped;
  }
  const resolvedTraits = resolveDoctorModelTraits(normalizedModelId, input.modelTraitOverride);
  return {
    ok: true,
    payload: {
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
    },
  };
}

export function buildDoctorChatAnalysis(
  input: BuildDoctorChatAnalysisInput,
): DoctorChatAnalysisPayload | undefined {
  const res = buildDoctorChatAnalysisWithReason(input);
  return res.ok ? res.payload : undefined;
}

export function buildTroubleshootChatAnalysis(rawInput: string): TroubleshootChatAnalysisPayload | undefined {
  const stripped = stripTerminalControlSequences(rawInput);
  const redacted = sanitizeDiagnosticText(stripped).sanitized;
  let budget = MAX_TROUBLESHOOT_CHARS;
  let sanitized = truncateTroubleshootLog(redacted, budget, true);
  if (!sanitized) return undefined;
  for (let pass = 0; pass < 4; pass += 1) {
    const effectiveLen = measurePostNeutralizationLength(sanitized, true);
    if (effectiveLen <= MAX_TROUBLESHOOT_CHARS) break;
    const excess = effectiveLen - MAX_TROUBLESHOOT_CHARS;
    const nextBudget = Math.max(512, budget - excess - 16);
    if (nextBudget >= budget) {
      sanitized = truncateTroubleshootLog(redacted, Math.max(512, budget - Math.max(32, excess + 16)), true);
      break;
    }
    budget = nextBudget;
    sanitized = truncateTroubleshootLog(redacted, budget, true);
    if (!sanitized) return undefined;
  }
  return {
    kind: "troubleshoot",
    rawInput: sanitized,
  };
}

export const MAX_SHARE_CUSTOM_MODEL_CHARS = 4096;

export function hasNonFiniteNumber(value: unknown, maxDepth = MAX_JSON_VALIDATION_DEPTH): boolean {
  const safety = inspectJsonSafety(value, maxDepth);
  return safety.hasNonFinite || safety.exceededDepth;
}

export function evaluateCalculatorModelGate(
  modelInput: string,
  useCustomJson: boolean,
): Wave3ModelGateResult {
  if (useCustomJson) {
    const trimmed = modelInput.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        const safety = inspectJsonSafety(parsed);
        if (safety.exceededDepth) {
          return {
            ok: false,
            error: "自定义 config.json 嵌套层级过深，请精简后再估算显存与并行方案。",
          };
        }
        if (safety.hasNonFinite) {
          return {
            ok: false,
            error: "自定义 config.json 包含溢出或非有限数值（如 1e400），请修正后再估算显存与并行方案。",
          };
        }
      } catch {
        // Let evaluateWave3ModelGate report standard JSON syntax diagnostics.
      }
    }
  }
  return evaluateWave3ModelGate(modelInput);
}

export function parseCustomModelParam(params?: URLSearchParams): string | null {
  const raw = params?.get("customModel")?.trim();
  if (!raw || raw.length > MAX_SHARE_CUSTOM_MODEL_CHARS || !raw.startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const safety = inspectJsonSafety(parsed);
    if (safety.hasNonFinite || safety.exceededDepth) return null;
    const clean = sanitizeStructuralJsonLeaves(extractStructuralHfConfig(parsed));
    return JSON.stringify(clean, null, 2);
  } catch {
    return null;
  }
}

export function serializeCustomModelForShare(
  rawJson: string,
): { ok: true; compact: string } | { ok: false; reason: string } {
  const trimmed = rawJson.trim();
  if (!trimmed.startsWith("{")) {
    return { ok: false, reason: "自定义 config.json 格式无效，暂不支持生成参数链接。" };
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, reason: "自定义 config.json 须为 JSON 对象，暂不支持生成参数链接。" };
    }
    const safety = inspectJsonSafety(parsed);
    if (safety.exceededDepth) {
      return {
        ok: false,
        reason: "自定义 config.json 嵌套层级过深，暂不支持生成参数链接。",
      };
    }
    if (safety.hasNonFinite) {
      return {
        ok: false,
        reason: "自定义 config.json 包含溢出或非有限数值（如 1e400），请修正后再复制参数链接。",
      };
    }
    let clean: Record<string, unknown>;
    try {
      clean = sanitizeStructuralJsonLeaves(extractStructuralHfConfig(parsed)) as Record<string, unknown>;
    } catch {
      const rawLen = JSON.stringify(parsed).length;
      if (rawLen > MAX_SHARE_CUSTOM_MODEL_CHARS) {
        return {
          ok: false,
          reason: `自定义 config.json 压缩后为 ${rawLen} 字符，超过链接上限（${MAX_SHARE_CUSTOM_MODEL_CHARS} 字符），请直接分享 config.json 原文。`,
        };
      }
      return { ok: false, reason: "自定义 config.json 缺少必要结构维度，请修正后再复制参数链接。" };
    }
    const compact = JSON.stringify(clean);
    if (compact.length > MAX_SHARE_CUSTOM_MODEL_CHARS) {
      return {
        ok: false,
        reason: `自定义 config.json 压缩后为 ${compact.length} 字符，超过链接上限（${MAX_SHARE_CUSTOM_MODEL_CHARS} 字符），请直接分享 config.json 原文。`,
      };
    }
    return { ok: true, compact };
  } catch {
    return { ok: false, reason: "自定义 config.json 存在语法或结构错误，请修正后再复制参数链接。" };
  }
}
