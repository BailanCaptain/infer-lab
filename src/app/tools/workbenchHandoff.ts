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
import { redactAuthorizationHeaders, redactYamlCredentials } from "../../sim/shared/yamlRedactor";
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
  RANK_PATTERNS,
  resolveDoctorModelTraits,
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
const UNSAFE_ANCHOR_CHAR_RE = /[\r\n\0/\\]/;
// biome-ignore lint/suspicious/noControlCharactersInRegex: strip ANSI escape codes from terminal logs
const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*[A-Za-z]/g;

export type WorkbenchTabId = "calculator" | "doctor" | "troubleshoot" | "aicore" | "wargame";

export function preserveWikiBackParams(target: URLSearchParams, preserve?: URLSearchParams): void {
  if (!preserve) return;
  const fromPage = preserve.get("fromPage")?.trim();
  const fromAnchor = preserve.get("fromAnchor")?.trim();
  if (fromPage && SAFE_WIKI_SLUG_RE.test(fromPage)) {
    target.set("fromPage", fromPage);
  }
  if (fromAnchor && !UNSAFE_ANCHOR_CHAR_RE.test(fromAnchor)) {
    target.set("fromAnchor", fromAnchor);
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
    const rawDl = preserve?.get("dpLocal")?.trim();
    if (rawDl && /^\d+$/.test(rawDl)) {
      const dl = Number(rawDl);
      if (Number.isSafeInteger(dl) && dl >= 1 && dl <= input.dpSize && input.dpSize % dl === 0) {
        next.set("dpLocal", String(dl));
      }
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

  // 0. PEM private key blocks (multiline)
  replaceCounted(
    /-----BEGIN [A-Z0-9 _-]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 _-]*PRIVATE KEY-----/gi,
    "[REDACTED_PRIVATE_KEY]",
  );

  // 1. URI userinfo credentials across any scheme (http://u:p@h, redis://:pass@h, https://token@github.com)
  replaceCounted(
    /([a-z][a-z0-9+.-]*:\/\/)([^/\s@]*:[^/\s@]+|[^/\s:@]+)@/gi,
    (_m, scheme: string) => `${scheme}[REDACTED_AUTH]@`,
  );

  // 2. Authorization / Proxy-Authorization headers (Bearer / Basic / Token / ApiKey / Digest multi-param / custom)
  const authRes = redactAuthorizationHeaders(text, "[REDACTED_TOKEN]");
  text = authRes.text;
  redactionCount += authRes.count;
  replaceCounted(
    /\b(Bearer[ \t]+)(?!\[REDACTED)(?![A-Za-z_][A-Za-z0-9_]*=[^=\r\n\t ])[A-Za-z0-9._~+/=-]{6,}/gi,
    (_m, p1: string) => `${p1}[REDACTED_TOKEN]`,
  );

  const strongCredRe =
    /password|passwd|secret|credentials?|cookie|session[-_]?id|(?:proxy[-_]?)?authorization|api[-_]?key|apikey|access[-_]?key|private[-_]?key|secret[-_]?key|auth[-_]?key|client[-_]?key|bearer|(?:auth|access|refresh|hf|huggingface)[-_]?token/i;

  const isNonSecretTokenKey = (rawKey: string): boolean => {
    const norm = rawKey.replace(/^--/, "").toLowerCase();
    if (strongCredRe.test(norm)) return false;
    return (
      norm.includes("tokeniz") ||
      norm.endsWith("_tokens") ||
      norm.endsWith("-tokens") ||
      norm.endsWith("_token_id") ||
      norm.endsWith("-token-id") ||
      norm.endsWith("_token_ids") ||
      norm.endsWith("-token-ids") ||
      norm.endsWith("_token_len") ||
      norm.endsWith("-token-len") ||
      /^(?:bos|eos|pad|unk|cls|sep|mask)[-_]token$/.test(norm)
    );
  };

  // 3. Multi-value CLI credential flags (including multiline, backslash-newline continuations, and escaped quotes)
  const sepTokenRe =
    /((?:[ \t]+(?:\\\r?\n[ \t]*)*|\\\r?\n[ \t]*))("(?:\\[\s\S]|[^"\\])*"|'[^']*'|(?![-\\;|&<>(){}])[^\s"'\\;|&<>(){}]+)/g;
  const redactFlagValues = (full: string, flag: string, tail: string): string => {
    if (isNonSecretTokenKey(flag)) return full;
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
    /(?<![A-Za-z0-9_-])(--(?:bearer|[A-Za-z0-9_-]*(?:password|passwd|secret|credential|cookie|api[-_]?key|access[-_]?key|private[-_]?key|secret[-_]?key|auth[-_]?key|client[-_]?key|token)[A-Za-z0-9_-]*))((?:[ \t]*=[ \t]*(?:"(?:\\[\s\S]|[^"\\])*"|'[^']*'|[^\s"'\\;|&<>(){}]+))|(?:(?:(?:[ \t]+(?:\\\r?\n[ \t]*)*|\\\r?\n[ \t]*)(?:"(?:\\[\s\S]|[^"\\])*"|'[^']*'|(?![-\\;|&<>(){}])[^\s"'\\;|&<>(){}]+))+))/gi,
    redactFlagValues,
  );

  // 3b. Sensitive YAML 1.2 AST + key=value & key: value assignments
  const strongCredLookahead =
    "(?:password|passwd|secret|credentials?|cookie|session[-_]?id|(?:proxy[-_]?)?authorization|api[-_]?key|apikey|access[-_]?key|private[-_]?key|secret[-_]?key|auth[-_]?key|client[-_]?key|bearer|(?:auth|access|refresh|hf|huggingface)[-_]?token)";
  const nonSecretKeyLookahead = `(?!(?![A-Za-z0-9_.-]*${strongCredLookahead})(?:[A-Za-z0-9_.-]*tokeniz[A-Za-z0-9_.-]*|[A-Za-z0-9_.-]*[-_]tokens|[A-Za-z0-9_.-]*token[-_]?ids?|[A-Za-z0-9_.-]*token[-_]?len|(?:bos|eos|pad|unk|cls|sep|mask)[-_]?token)(?![A-Za-z0-9_.-]))`;
  const credKeyBody =
    "[A-Za-z0-9_.-]*(?:PASSWORD|PASSWD|SECRET|CREDENTIAL|CREDENTIALS|COOKIE|SESSION[-_]?ID|(?:PROXY[-_]?)?AUTHORIZATION|API[-_]?KEY|APIKEY|ACCESS[-_]?KEY|PRIVATE[-_]?KEY|SECRET[-_]?KEY|AUTH[-_]?KEY|CLIENT[-_]?KEY|TOKEN)[A-Za-z0-9_.-]*";
  const credKeyRe = new RegExp(`^${nonSecretKeyLookahead}(?:${credKeyBody})$`, "i");
  const isSecretMappingKey = (rawKey: string): boolean =>
    credKeyRe.test(rawKey) && !isNonSecretTokenKey(rawKey);

  const yamlRes = redactYamlCredentials(text, isSecretMappingKey, "[REDACTED_KEY]");
  text = yamlRes.text;
  redactionCount += yamlRes.count;

  const eqSecretRe = new RegExp(
    `(?<![A-Za-z0-9_-])${nonSecretKeyLookahead}(${credKeyBody})([ \\t]*=[ \\t]*)("(?:\\\\[\\s\\S]|[^"\\\\])*"|'(?:\\\\[\\s\\S]|[^'\\\\])*'|(?!\\[REDACTED)[^\\s'";&|,})\\r\\n]+)`,
    "gi",
  );
  const colonSecretRe = new RegExp(
    `(?<![A-Za-z0-9_-])${nonSecretKeyLookahead}(${credKeyBody})([ \\t]*:[ \\t]*)("(?:\\\\[\\s\\S]|[^"\\\\])*"|'(?:\\\\[\\s\\S]|[^'\\\\])*'|(?!\\[REDACTED)(?!(?:Bearer|Basic|Token|ApiKey|Digest)[ \\t]+\\[REDACTED)(?![#&*|>!])[^\\s'"&|,}\\]\\r\\n]+)`,
    "gi",
  );
  for (const re of [eqSecretRe, colonSecretRe]) {
    text = text.replace(re, (full, key: string, sep: string, val: string) => {
      if (isNonSecretTokenKey(key)) return full;
      if (
        val === '"[REDACTED_KEY]"' ||
        val === "'[REDACTED_KEY]'" ||
        val === '"[REDACTED_TOKEN]"' ||
        val === "'[REDACTED_TOKEN]'"
      ) {
        return full;
      }
      redactionCount += 1;
      if (val.startsWith('"') && val.endsWith('"')) return `${key}${sep}"[REDACTED_KEY]"`;
      if (val.startsWith("'") && val.endsWith("'")) return `${key}${sep}'[REDACTED_KEY]'`;
      return `${key}${sep}[REDACTED_KEY]`;
    });
  }
  const quotedKeyColonRe = new RegExp(
    `(["'])${nonSecretKeyLookahead}(${credKeyBody})\\1([ \\t]*:[ \\t]*)("(?:\\\\[\\s\\S]|[^"\\\\])*"|'(?:\\\\[\\s\\S]|[^'\\\\])*'|(?!\\[REDACTED)(?![#&*|>!])[^\\s'"&|,}\\]\\r\\n]+)`,
    "gi",
  );
  text = text.replace(quotedKeyColonRe, (full, quote: string, innerKey: string, sep: string, val: string) => {
    if (isNonSecretTokenKey(innerKey)) return full;
    if (
      val === '"[REDACTED_KEY]"' ||
      val === "'[REDACTED_KEY]'" ||
      val === '"[REDACTED_TOKEN]"' ||
      val === "'[REDACTED_TOKEN]'"
    ) {
      return full;
    }
    redactionCount += 1;
    if (val.startsWith('"') && val.endsWith('"')) {
      return `${quote}${innerKey}${quote}${sep}"[REDACTED_KEY]"`;
    }
    if (val.startsWith("'") && val.endsWith("'")) {
      return `${quote}${innerKey}${quote}${sep}'[REDACTED_KEY]'`;
    }
    return `${quote}${innerKey}${quote}${sep}[REDACTED_KEY]`;
  });

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

  // 6. IPv6 addresses (bracketed [2001:db8::1]/[2001:db8::], full 8-hextet, or :: compressed hex; never matches HH:MM:SS timestamps or C++ a::b identifiers)
  text = text.replace(
    /\[(?:(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}|(?=[^\]]*[0-9a-fA-F])(?:[0-9a-fA-F]{1,4}:){1,6}:(?:[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){0,5})?|::(?:ffff:(?:<REDACTED_IP>|[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})?)|(?:[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){0,6})?))(?:%[A-Za-z0-9_.-]+)?\]|(?<![A-Za-z0-9_:])(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){2,6}:(?:[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){0,4})?|[0-9a-fA-F]{1,4}::[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){1,5}|(?:fe[89abAB][0-9a-fA-F]|f[cdCD][0-9a-fA-F]{2}|ff[0-9a-fA-F]{2}|[23][0-9a-fA-F]{3})::(?:[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){0,5})?)(?![A-Za-z0-9_:])|(?<=^|[\s='"([,])::(?:ffff:(?:<REDACTED_IP>|[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4})?)|[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){0,6})(?![A-Za-z0-9_:])/g,
    (full) => {
      redactionCount += 1;
      return full.startsWith("[") && full.endsWith("]") ? "[<REDACTED_IP>]" : "<REDACTED_IP>";
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

export function encodeDoctorCommandParam(text: string): string {
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
    if (decoded.includes("\0") || !decoded.trim() || decoded.length > MAX_DOCTOR_COMMAND_CHARS) {
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
        out.sharedPrefillCommand = pcmd;
        out.sharedDecodeCommand = dcmd;
        if (!out.topology) out.topology = "pd";
      }
    } else {
      const rawCmd = params.get("cmd");
      if (rawCmd !== null) {
        const cmd = decodeDoctorCommandParam(rawCmd);
        if (cmd !== null) {
          out.sharedCommand = cmd;
          if (!out.topology) out.topology = "single";
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
      const rawPre = (input.prefillCommandText ?? "").replace(ANSI_ESCAPE_RE, "");
      const rawDec = (input.decodeCommandText ?? "").replace(ANSI_ESCAPE_RE, "");
      if (!rawPre.trim() || !rawDec.trim()) {
        return {
          ok: false,
          reason: "P/D 双实例联检需同时填写 Prefill 与 Decode 启动命令后再复制体检分享链接。",
        };
      }
      if (rawPre.length > MAX_DOCTOR_COMMAND_CHARS || rawDec.length > MAX_DOCTOR_COMMAND_CHARS) {
        return {
          ok: false,
          reason: `启动命令超过长度上限（${MAX_DOCTOR_COMMAND_CHARS} 字符），为避免截断改变体检结论，已拒绝生成分享链接。`,
        };
      }
      const sanPre = sanitizeDiagnosticText(rawPre);
      const sanDec = sanitizeDiagnosticText(rawDec);
      if (
        sanPre.sanitized.length > MAX_DOCTOR_COMMAND_CHARS ||
        sanDec.sanitized.length > MAX_DOCTOR_COMMAND_CHARS
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
      const rawCmd = input.commandText.replace(ANSI_ESCAPE_RE, "");
      if (!rawCmd.trim()) {
        return { ok: false, reason: "当前启动命令为空，请先输入 vllm serve 命令后再复制体检分享链接。" };
      }
      if (rawCmd.length > MAX_DOCTOR_COMMAND_CHARS) {
        return {
          ok: false,
          reason: `当前命令长度为 ${rawCmd.length} 字符，超过单次体检上限（${MAX_DOCTOR_COMMAND_CHARS} 字符），拒绝截断生成链接。`,
        };
      }
      const san = sanitizeDiagnosticText(rawCmd);
      if (san.sanitized.length > MAX_DOCTOR_COMMAND_CHARS) {
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

export const MAX_SHARE_CUSTOM_MODEL_CHARS = 4096;

export function hasNonFiniteNumber(value: unknown): boolean {
  if (typeof value === "number") return !Number.isFinite(value);
  if (Array.isArray(value)) return value.some(hasNonFiniteNumber);
  if (value && typeof value === "object") {
    return Object.values(value).some(hasNonFiniteNumber);
  }
  return false;
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
        if (hasNonFiniteNumber(parsed)) {
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
    if (hasNonFiniteNumber(parsed)) return null;
    const clean = extractStructuralHfConfig(parsed);
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
    if (hasNonFiniteNumber(parsed)) {
      return {
        ok: false,
        reason: "自定义 config.json 包含溢出或非有限数值（如 1e400），请修正后再复制参数链接。",
      };
    }
    let clean: Record<string, unknown>;
    try {
      clean = extractStructuralHfConfig(parsed);
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
