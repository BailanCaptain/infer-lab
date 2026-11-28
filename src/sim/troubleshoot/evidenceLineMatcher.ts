/**
 * Pure, React-free evidence-line predicates shared by log truncation (`truncateTroubleshootLog` /
 * `compactOverlongLine`) and metrics consumers.
 *
 * The predicates mirror the raw-line rules of `logAnalyzer.ts` (all 20 rules: PRIMARY_SIGNAL_SPECS,
 * Rule 3/17 cascades, Rule 11 ADXL fallback, Rule 12 DEBUG hotpath, Prometheus metric families,
 * and rank/device/lifecycle context) WITHOUT scope gating. False positives only cost excerpt budget,
 * whereas false negatives silently change diagnosis. All wildcard gaps are strictly bounded
 * (`[^\r\n]{0,200}` or tighter) so pathological single lines stay linear-time.
 */

/** Deterministic marker appended when any consumed metric sample line was dropped during truncation. */
export const METRICS_TRUNCATED_MARKER = "[infra-view] metrics truncated";

/** True when the text contains the metrics-truncated marker on its own line. */
export function hasMetricsTruncatedMarker(text: string): boolean {
  if (!text.includes(METRICS_TRUNCATED_MARKER)) return false;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === METRICS_TRUNCATED_MARKER) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------
// Decisive CANN / ACL / HCCL error-code catalogue (mirrors logAnalyzer R13 / R14 / generic / R20 / R17).
// ---------------------------------------------------------------------------------------------

/** Rule 13 (cann-plog-aicore-fault) numeric runtime codes. */
export const R13_RUNTIME_ERROR_CODES = [
  "507014",
  "507015",
  "507018",
  "507034",
  "507035",
  "107030",
  "207003",
] as const;
/** Rule 13 symbolic ACL runtime codes. */
export const R13_RUNTIME_ACL_SYMBOLS = [
  "ACL_ERROR_RT_AICORE_EXCEPTION",
  "ACL_ERROR_RT_AICORE_TIMEOUT",
  "ACL_ERROR_RT_AICPU_EXCEPTION",
  "ACL_ERROR_RT_AICORE_OVER_FLOW",
  "ACL_ERROR_RT_CAPTURE_MODE_NOT_SUPPORT",
] as const;
/** Rule 14 (cann-opapi-or-aclnn-fault) numeric aclnn parameter / tiling codes. */
export const R14_PARAM_ERROR_CODES = ["161001", "161002", "561002", "561103"] as const;
/** Rule 14 symbolic aclnn parameter codes. */
export const R14_PARAM_SYMBOLS = [
  "ACLNN_ERR_PARAM_INVALID",
  "ACLNN_ERR_PARAM_NULLPTR",
  "ACLNN_ERR_INNER_TILING_ERROR",
  "AclNN_Parameter_Error",
  "EZ0008",
  "EZ0026",
  "EZ0027",
  "EZ1001",
] as const;
/** Generic CANN runtime codes routed to Rule 14 / Rule 18 / Rule 20. */
export const CANN_GENERIC_RUNTIME_CODES = [
  "EZ9999",
  "EZ3002",
  "EZ3003",
  "EL0004",
  "EH9999",
  "EZ1001",
  "ERR03005",
] as const;
/** Rule 20 (cann-driver-or-device-env-fault) & graph-capture device / stream codes. */
export const DEVICE_ENV_ERROR_CODES = ["507008", "107002", "107005", "107024", "107025"] as const;
/** Rule 17 (hccl-link-or-ifname-fault) ranktable / transport init codes. */
export const HCCL_INIT_ERROR_CODES = ["EI0004", "EI0009", "EJ0001", "HCCL_E_UNAVAIL"] as const;

/** Every decisive code above (deduplicated, catalogue order) plus GE inner error E19999. */
export const DECISIVE_ERROR_CODES: readonly string[] = [
  ...new Set<string>([
    ...R13_RUNTIME_ERROR_CODES,
    ...R13_RUNTIME_ACL_SYMBOLS,
    ...R14_PARAM_ERROR_CODES,
    ...R14_PARAM_SYMBOLS,
    ...CANN_GENERIC_RUNTIME_CODES,
    ...DEVICE_ENV_ERROR_CODES,
    ...HCCL_INIT_ERROR_CODES,
    "E19999",
  ]),
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function altOf(items: readonly string[]): string {
  return items.map(escapeRegExp).join("|");
}

export const METADATA_NUMERIC_ID_LABEL_RE =
  /(?:^|[^A-Za-z0-9_])(?:pid|port|line|global_rank|local_rank|rank|device_id|device|step|tokens)(?:[^\S\r\n]*[:=#][^\S\r\n]*|[^\S\r\n]+)$/i;

export function stripLogIdFieldsForErrorCodes(text: string): string {
  return text
    .replace(
      /\b(?:pid|port|line|global_rank|local_rank|rank|device_id|device|step|tokens)(?:[^\S\r\n]*[:=#][^\S\r\n]*|[^\S\r\n]+)\d+\b/gi,
      " ",
    )
    .replace(/\b(?:RUNTIME|HCCL|ASCENDCL|GE|DRV)\(\d+,/gi, " ")
    .replace(/\[[^[\]\r\n]{1,120}:\d+\]/g, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}[T -]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?/g, " ")
    .replace(/\b\d{2}:\d{2}:\d{2}(?:[.,]\d+)?/g, " ");
}

/** Regex source matching one decisive code as a standalone token (usable with "gi" for scanning). */
export const DECISIVE_ERROR_CODE_SOURCE = `(?<![A-Za-z0-9_])(?:${altOf(DECISIVE_ERROR_CODES)})(?![A-Za-z0-9_])`;
export const DECISIVE_ERROR_CODE_RE = new RegExp(DECISIVE_ERROR_CODE_SOURCE, "i");

const R13_CODE_ALT = altOf([...R13_RUNTIME_ERROR_CODES, ...R13_RUNTIME_ACL_SYMBOLS]);
const R14_CODE_ALT = altOf(R14_PARAM_ERROR_CODES);
const R14_SYMBOL_ALT = altOf(R14_PARAM_SYMBOLS);
const GENERIC_CODE_ALT = altOf(CANN_GENERIC_RUNTIME_CODES);
const DEVICE_CODE_ALT = altOf(DEVICE_ENV_ERROR_CODES);
const HCCL_INIT_ALT = altOf(HCCL_INIT_ERROR_CODES);

// ---------------------------------------------------------------------------------------------
// Prometheus metric samples (mirrors logAnalyzer.PROM_METRIC_LINE_RE + parsePrometheusMetrics families).
// ---------------------------------------------------------------------------------------------

function isHorizontalWsCode(code: number): boolean {
  return (
    code === 32 ||
    code === 9 ||
    code === 160 ||
    code === 11 ||
    code === 12 ||
    (code > 127 && /\s/.test(String.fromCharCode(code)))
  );
}

/** Strict O(N) non-backtracking validator mirroring `[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?`. */
function isPromNumericSyntax(s: string, requireFinite: boolean): boolean {
  if (!s) return false;
  let i = 0;
  if (s[i] === "+" || s[i] === "-") i += 1;
  let intDigits = 0;
  while (i < s.length && s.charCodeAt(i) >= 48 && s.charCodeAt(i) <= 57) {
    intDigits += 1;
    i += 1;
  }
  let fracDigits = 0;
  if (i < s.length && s[i] === ".") {
    i += 1;
    while (i < s.length && s.charCodeAt(i) >= 48 && s.charCodeAt(i) <= 57) {
      fracDigits += 1;
      i += 1;
    }
  }
  if (intDigits === 0 && fracDigits === 0) return false;
  if (i < s.length && (s[i] === "e" || s[i] === "E")) {
    i += 1;
    if (i < s.length && (s[i] === "+" || s[i] === "-")) i += 1;
    let expDigits = 0;
    while (i < s.length && s.charCodeAt(i) >= 48 && s.charCodeAt(i) <= 57) {
      expDigits += 1;
      i += 1;
    }
    if (expDigits === 0) return false;
  }
  return i === s.length && (!requireFinite || Number.isFinite(Number(s)));
}

/** Metric families aggregated by `parsePrometheusMetrics` (sums / averages over all samples). */
export const CONSUMED_METRIC_FAMILIES: ReadonlySet<string> = new Set([
  "vllm:kv_cache_usage_perc",
  "vllm:gpu_cache_usage_perc",
  "vllm:num_requests_running",
  "vllm:num_requests_waiting",
  "vllm:num_preemptions_total",
  "vllm:num_preemptions",
  "vllm:time_to_first_token_seconds",
  "vllm:time_to_first_token_seconds_sum",
  "vllm:time_to_first_token_seconds_count",
  "vllm:inter_token_latency_seconds",
  "vllm:inter_token_latency_seconds_sum",
  "vllm:inter_token_latency_seconds_count",
  "vllm:prefix_cache_hits_total",
  "vllm:prefix_cache_hits",
  "vllm:prefix_cache_queries_total",
  "vllm:prefix_cache_queries",
]);

function isPromValueToken(s: string, allowNonFinite: boolean): boolean {
  if (!s) return false;
  if (allowNonFinite && /^(?:nan|[+-]?inf)$/i.test(s)) return true;
  return isPromNumericSyntax(s, !allowNonFinite);
}

function parsePrometheusMetricLine(
  raw: string,
  requireVllmPrefix: boolean,
  allowNonFinite = false,
): { name: string; value: number } | null {
  if (requireVllmPrefix && !raw.includes("vllm:")) return null;
  let i = 0;
  while (i < raw.length && isHorizontalWsCode(raw.charCodeAt(i))) i += 1;
  if (i >= raw.length) return null;
  if (requireVllmPrefix) {
    if (!raw.startsWith("vllm:", i)) return null;
  } else {
    const c0 = raw[i]!;
    const okStart = (c0 >= "a" && c0 <= "z") || (c0 >= "A" && c0 <= "Z") || c0 === "_" || c0 === ":";
    if (!okStart) return null;
  }
  const nameStart = i;
  i += requireVllmPrefix ? 5 : 1;
  while (i < raw.length) {
    const ch = raw[i]!;
    if (
      (ch >= "a" && ch <= "z") ||
      (ch >= "A" && ch <= "Z") ||
      (ch >= "0" && ch <= "9") ||
      ch === "_" ||
      ch === ":"
    ) {
      i += 1;
    } else {
      break;
    }
  }
  const metricName = raw.slice(nameStart, i);
  if (i < raw.length && raw[i] === "{") {
    const closeBrace = raw.indexOf("}", i + 1);
    if (closeBrace === -1) return null;
    if (raw.slice(i + 1, closeBrace).includes("\n") || raw.slice(i + 1, closeBrace).includes("\r"))
      return null;
    i = closeBrace + 1;
  }
  const wsBeforeVal = i;
  while (i < raw.length && isHorizontalWsCode(raw.charCodeAt(i))) i += 1;
  if (i === wsBeforeVal || i >= raw.length) return null;
  const valStart = i;
  while (i < raw.length) {
    const c = raw.charCodeAt(i);
    if (c === 10 || c === 13 || isHorizontalWsCode(c)) break;
    i += 1;
  }
  const valStr = raw.slice(valStart, i);
  if (!isPromValueToken(valStr, allowNonFinite)) return null;
  if (i < raw.length) {
    const wsAfterVal = i;
    while (i < raw.length && isHorizontalWsCode(raw.charCodeAt(i))) i += 1;
    if (i < raw.length) {
      if (i === wsAfterVal) return null;
      let tsDigits = 0;
      while (i < raw.length && raw.charCodeAt(i) >= 48 && raw.charCodeAt(i) <= 57) {
        tsDigits += 1;
        i += 1;
      }
      if (tsDigits === 0) return null;
      while (i < raw.length && isHorizontalWsCode(raw.charCodeAt(i))) i += 1;
      if (i < raw.length) return null;
    }
  }
  return { name: metricName, value: Number(valStr) };
}

/** Metric name of a finite `vllm:` Prometheus sample line, or null when unparseable/non-finite (matching `parsePrometheusMetrics`). */
export function getVllmMetricSampleName(raw: string): string | null {
  return parsePrometheusMetricLine(raw, true)?.name ?? null;
}

/** True for ANY valid finite Prometheus metric sample line (regardless of prefix), strictly O(N). */
export function isAnyPrometheusMetricLine(raw: string): boolean {
  return parsePrometheusMetricLine(raw, false) !== null;
}

/**
 * True for ANY line accepted by `logAnalyzer.PROM_METRIC_LINE_RE` (including `NaN`/`Inf`/`-Inf`
 * samples), verified in strict O(N) time without regex backtracking.
 */
export function isAnyValidPromReSyntaxLine(raw: string): boolean {
  return parsePrometheusMetricLine(raw, false, true) !== null;
}

/** Any `vllm:` sample line counted by the analyzer's `rawMetricCount`. */
export function isMetricSampleLine(raw: string): boolean {
  return getVllmMetricSampleName(raw) !== null;
}

/** A `vllm:` sample line whose family feeds an aggregate (KV usage, waiting, preemptions, TTFT, ITL, prefix cache). */
export function isConsumedMetricSampleLine(raw: string): boolean {
  const name = getVllmMetricSampleName(raw);
  return name !== null && CONSUMED_METRIC_FAMILIES.has(name);
}

const utf8Encoder = new TextEncoder();

/** Exact UTF-8 byte length in both Node and browser environments. */
export function getUtf8ByteLength(text: string): number {
  return utf8Encoder.encode(text).byteLength;
}

/** Binary-search surrogate-safe UTF-8 byte prefix slice. */
export function sliceUtf8BytesSafe(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  if (getUtf8ByteLength(text) <= maxBytes) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    let sliceEnd = mid;
    const prev = text.charCodeAt(sliceEnd - 1);
    if (prev >= 0xd800 && prev <= 0xdbff && sliceEnd < text.length) {
      const next = text.charCodeAt(sliceEnd);
      if (next >= 0xdc00 && next <= 0xdfff) sliceEnd -= 1;
    }
    if (sliceEnd <= lo) break;
    if (getUtf8ByteLength(text.slice(0, sliceEnd)) <= maxBytes) lo = sliceEnd;
    else hi = sliceEnd - 1;
  }
  const last = lo > 0 ? text.charCodeAt(lo - 1) : 0;
  return last >= 0xd800 && last <= 0xdbff ? text.slice(0, lo - 1) : text.slice(0, lo);
}

/**
 * Inspect finite `vllm:` Prometheus sums/counts using the EXACT series precedence of
 * `logAnalyzer.parsePrometheusMetrics` (`kv_cache_usage_perc ?? gpu_cache_usage_perc`,
 * `num_preemptions_total ?? num_preemptions`, `(ttftSum / ttftCount) ?? ttftDirect`, etc.),
 * so overflow in an unused fallback/alias series never suppresses valid active metrics/findings.
 */
export function inspectVllmMetricAggregateOverflow(rawInput: string): {
  kvOverflow: boolean;
  runningOverflow: boolean;
  waitingOverflow: boolean;
  preemptOverflow: boolean;
  ttftOverflow: boolean;
  itlOverflow: boolean;
  hitRateOverflow: boolean;
} {
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  const overflowed = new Set<string>();
  for (const line of rawInput.split(/\r?\n/)) {
    const sample = parsePrometheusMetricLine(line, true);
    if (!sample) continue;
    counts.set(sample.name, (counts.get(sample.name) ?? 0) + 1);
    const next = (sums.get(sample.name) ?? 0) + sample.value;
    sums.set(sample.name, next);
    if (!Number.isFinite(next)) overflowed.add(sample.name);
  }
  const hasAny = (name: string): boolean => (counts.get(name) ?? 0) > 0;
  const activeKvName = hasAny("vllm:kv_cache_usage_perc")
    ? "vllm:kv_cache_usage_perc"
    : "vllm:gpu_cache_usage_perc";
  const activePreemptName = hasAny("vllm:num_preemptions_total")
    ? "vllm:num_preemptions_total"
    : "vllm:num_preemptions";

  const ttftCountSum = sums.get("vllm:time_to_first_token_seconds_count");
  const usesTtftHistogram =
    hasAny("vllm:time_to_first_token_seconds_sum") &&
    hasAny("vllm:time_to_first_token_seconds_count") &&
    (ttftCountSum ?? 0) > 0;
  const ttftOverflow = usesTtftHistogram
    ? overflowed.has("vllm:time_to_first_token_seconds_sum") ||
      overflowed.has("vllm:time_to_first_token_seconds_count")
    : overflowed.has("vllm:time_to_first_token_seconds");

  const itlCountSum = sums.get("vllm:inter_token_latency_seconds_count");
  const usesItlHistogram =
    hasAny("vllm:inter_token_latency_seconds_sum") &&
    hasAny("vllm:inter_token_latency_seconds_count") &&
    (itlCountSum ?? 0) > 0;
  const itlOverflow = usesItlHistogram
    ? overflowed.has("vllm:inter_token_latency_seconds_sum") ||
      overflowed.has("vllm:inter_token_latency_seconds_count")
    : overflowed.has("vllm:inter_token_latency_seconds");

  const activeHitsName = hasAny("vllm:prefix_cache_hits_total")
    ? "vllm:prefix_cache_hits_total"
    : "vllm:prefix_cache_hits";
  const activeQueriesName = hasAny("vllm:prefix_cache_queries_total")
    ? "vllm:prefix_cache_queries_total"
    : "vllm:prefix_cache_queries";

  return {
    kvOverflow: overflowed.has(activeKvName),
    runningOverflow: overflowed.has("vllm:num_requests_running"),
    waitingOverflow: overflowed.has("vllm:num_requests_waiting"),
    preemptOverflow: overflowed.has(activePreemptName),
    ttftOverflow,
    itlOverflow,
    hitRateOverflow: overflowed.has(activeHitsName) || overflowed.has(activeQueriesName),
  };
}

export const DIAGNOSTIC_INVISIBLE_FORMAT_RE =
  /[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff\u{e0000}-\u{e007f}]/gu;
// biome-ignore lint/suspicious/noControlCharactersInRegex: strip C0/C1 controls except \t and \n
export const DIAGNOSTIC_C0_C1_CONTROL_RE = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/g;

/** Strip raw C0/C1 control bytes (except `\t`/`\n`), normalize CR/CRLF, and strip invisible format characters. */
export function stripDiagnosticControlAndInvisibleChars(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(DIAGNOSTIC_C0_C1_CONTROL_RE, "")
    .replace(DIAGNOSTIC_INVISIBLE_FORMAT_RE, "");
}

const HTML_COMMENT_RECORD_BOUNDARY_RE =
  /^\s*(?:\[\s*(?:rank(?:\s*[:=#]?\s*\d+)?|local_rank|global_rank|worker(?:_[^\]\r\n]+|\b)|enginecore(?:_[^\]\r\n]+|\b)|host(?:\s*[:=][^\]\r\n]*)?|node(?:\s*[:=][^\]\r\n]*)?|pid\s*[:=#]?\s*\d*|\d+|error|warn(?:ing)?|info|critical|fatal|debug|panic|trace)\s*\]|\(\s*(?:[A-Za-z_][A-Za-z0-9_]*|rank\b|pid\s*[:=])[^)\r\n]{0,64}\)|(?:host|node)[_-][A-Za-z0-9._:-]+|(?:host(?:name)?|node(?:_name|_rank)?|pid|rank|global_rank|local_rank|device_id|device|npu)(?:[^\S\r\n]*[:=#][^\S\r\n]*|[^\S\r\n]+)['"]?[A-Za-z0-9_.:-]+|(?:vllmWorker|Worker|EngineCore)_(?:TP|DP|PP|EP)\s*[_:-]?\s*\d+\b|(?:HCCL|CANN|RUNTIME|ASCENDCL|GE|DRV)\(\d+,|[IWEF]\d{4}[^\S\r\n]+\d{2}:\d{2}:\d{2}|(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{2}[-/]\d{2}[ T/]\d{2}|\d{2}:\d{2}:\d{2})|(?:ERROR|WARN(?:ING)?|INFO|CRITICAL|FATAL|DEBUG|PANIC|TRACE)\b|vllm:[A-Za-z0-9_:]+|#[^\S\r\n]*(?:HELP|TYPE)[^\S\r\n]+\S|Traceback\b|File[^\S\r\n]+"[^"\r\n]+",[^\S\r\n]*line[^\S\r\n]+\d+|[A-Za-z_][A-Za-z0-9_]*(?:Error|Exception)\b)/i;

const HTML_COMMENT_PRE_MARKER_RE =
  /\[\s*(?:rank(?:\s*[:=#]?\s*\d+)?|local_rank|global_rank|worker(?:_[^\]\r\n]+|\b)|enginecore(?:_[^\]\r\n]+|\b))\s*\]|\b(?:global_rank|local_rank|pid)\s*[:=#]\s*\d+\b|\b(?:vllmWorker|Worker|EngineCore)_(?:TP|DP|PP|EP)[_:-]?\s*\d+\b|\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}[T ]\d{2}:\d{2}:\d{2}|\d{2}:\d{2}:\d{2})\b/i;

function isDiagnosticRecordBoundaryLine(line: string): boolean {
  const commentIdx = line.indexOf("<!--");
  const head = commentIdx >= 0 ? line.slice(0, commentIdx) : line;
  if (HTML_COMMENT_RECORD_BOUNDARY_RE.test(head)) return true;
  if (commentIdx === 0) return false;
  return HTML_COMMENT_PRE_MARKER_RE.test(head);
}

/**
 * Strip only closed `<!-- ... -->` comments that lie on one line or wrap non-record continuation
 * lines, never across independent diagnostic log records (`[Rank N]`, host/pid-prefixed ranks,
 * timestamps, etc.). Runs in O(N) time and preserves newline counts.
 */
export function stripBoundedHtmlComments(text: string): string {
  if (!text.includes("<!--") || !text.includes("-->")) return text;
  const lines = text.split("\n");
  const outChunks: string[] = [];
  let chunkStart = 0;

  const stripChunk = (fromLine: number, toExclLine: number): string => {
    const chunk = lines.slice(fromLine, toExclLine).join("\n");
    if (!chunk.includes("<!--") || !chunk.includes("-->")) return chunk;
    let out = "";
    let pos = 0;
    while (pos < chunk.length) {
      const open = chunk.indexOf("<!--", pos);
      if (open === -1) {
        out += chunk.slice(pos);
        break;
      }
      const close = chunk.indexOf("-->", open + 4);
      if (close === -1) {
        out += chunk.slice(pos);
        break;
      }
      out += chunk.slice(pos, open);
      const body = chunk.slice(open, close + 3);
      for (let k = 0; k < body.length; k += 1) {
        if (body[k] === "\n") out += "\n";
      }
      pos = close + 3;
    }
    return out;
  };

  for (let i = 1; i < lines.length; i += 1) {
    if (isDiagnosticRecordBoundaryLine(lines[i]!)) {
      outChunks.push(stripChunk(chunkStart, i));
      chunkStart = i;
    }
  }
  outChunks.push(stripChunk(chunkStart, lines.length));
  return outChunks.join("\n");
}

function isPromBacktrackRiskTail(line: string, start: number): boolean {
  let promSeqLen = 0;
  let atTokenStart = true;
  for (let idx = start; idx < line.length && promSeqLen < 12; idx += 1) {
    const ch = line[idx]!;
    const code = ch.charCodeAt(0);
    if (isHorizontalWsCode(code)) {
      promSeqLen += 1;
      atTokenStart = true;
    } else if ((code >= 48 && code <= 57) || ch === "." || ch === "e" || ch === "E") {
      promSeqLen += 1;
      atTokenStart = false;
    } else if (
      (ch === "+" || ch === "-") &&
      (atTokenStart || line[idx - 1] === "e" || line[idx - 1] === "E")
    ) {
      promSeqLen += 1;
      atTokenStart = false;
    } else if (/^(?:nan|[+-]?inf)(?=[^A-Za-z0-9_]|$)/i.test(line.slice(idx, idx + 8))) {
      promSeqLen += 3;
      idx += 2;
      atTokenStart = false;
    } else {
      break;
    }
  }
  return promSeqLen >= 12;
}

/**
 * Neutralize lines that fail strict O(N) Prometheus parsing yet share `metric_name <digits/spaces>...`
 * prefix shapes that would otherwise trigger quadratic backtracking inside `logAnalyzer.PROM_METRIC_LINE_RE`.
 * Shared by both server evidence and client startup metric probing so neither can trigger browser/server DoS.
 */
export function guardMalformedMetricLinesForAnalyzer(rawInput: string): string {
  const lines = rawInput.split(/\r?\n/);
  let changed = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    if (line.length < 32) continue;
    if (isAnyValidPromReSyntaxLine(line)) continue;
    let ws = 0;
    while (ws < line.length && isHorizontalWsCode(line.charCodeAt(ws))) ws += 1;
    if (ws >= line.length) continue;
    const ch = line[ws]!;
    if (ch === "#") continue;
    const isPromNameStart = (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_" || ch === ":";
    if (!isPromNameStart) continue;
    let p = ws + 1;
    while (p < line.length) {
      const c = line[p]!;
      if (
        (c >= "a" && c <= "z") ||
        (c >= "A" && c <= "Z") ||
        (c >= "0" && c <= "9") ||
        c === "_" ||
        c === ":"
      ) {
        p += 1;
      } else {
        break;
      }
    }
    let hasBraces = false;
    if (p < line.length && line[p] === "{") {
      const close = line.indexOf("}", p + 1);
      if (close === -1) continue;
      hasBraces = true;
      p = close + 1;
    }
    if (p < line.length && isHorizontalWsCode(line.charCodeAt(p)) && line.length - p >= 16) {
      let q = p;
      while (q < line.length && isHorizontalWsCode(line.charCodeAt(q))) q += 1;
      const v0 = line[q];
      const looksLikePromValStart =
        v0 !== undefined &&
        ((v0 >= "0" && v0 <= "9") ||
          v0 === "+" ||
          v0 === "-" ||
          v0 === "." ||
          v0 === "n" ||
          v0 === "N" ||
          v0 === "i" ||
          v0 === "I");
      if (looksLikePromValStart && (hasBraces || isPromBacktrackRiskTail(line, q))) {
        lines[i] = `. ${line}`;
        changed = true;
      }
    }
  }
  return changed ? lines.join("\n") : rawInput;
}

/**
 * Exact extra character delta added when server `stripBoundedHtmlComments` + `neutralizeDiagnosticTokens`
 * processes `text`. Accounts for closed HTML comments stripped prior to neutralization so client and
 * server length budgets agree 1:1.
 */
const DIAGNOSTIC_PROMPT_NEUTRALIZE_RULES: ReadonlyArray<readonly [RegExp, string]> = [
  [/<!--/g, "<\\!--"],
  [/[<＜]([|｜])([^\s<>＜＞|｜]{1,64})([|｜])[>＞]/g, "<\\$1$2\\$3>"],
  [/\[(\/?INST)\]/gi, "[\\$1]"],
  [/<<(\/?SYS)>>/gi, "<\\<$1>>"],
  [/^([^\S\n]*role):(\s*)(system|developer|assistant)/gim, "$1\\:$2$3"],
  [/^([^\S\n]*)(system|developer|assistant|human):/gim, "$1$2\\:"],
  [/<(\/?)(script|iframe|object|embed)\b/gi, "<\\$1$2"],
  [/(javascript|vbscript):/gi, "$1\\:"],
  [/data:(text\/html|application\/javascript)/gi, "data\\:$1"],
];

/** Neutralize chat-template, role-prefix, and active HTML/URI triggers identically across client and server. */
export function neutralizeDiagnosticPromptTokens(text: string): string {
  let out = text;
  for (const [pattern, replacement] of DIAGNOSTIC_PROMPT_NEUTRALIZE_RULES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/** Measure length (or UTF-8 byte length when `enforceBytes=true`) after exact comment/control/token neutralization. */
export function measurePostNeutralizationLength(text: string, enforceBytes: boolean): number {
  const preCleaned = stripDiagnosticControlAndInvisibleChars(text);
  const afterComments = stripBoundedHtmlComments(preCleaned);
  const neutralized = neutralizeDiagnosticPromptTokens(afterComments);
  if (!enforceBytes) return neutralized.length;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional ASCII fast path
  return /[^\x00-\x7f]/.test(neutralized)
    ? Math.max(neutralized.length, getUtf8ByteLength(neutralized))
    : neutralized.length;
}

export function estimateDiagnosticNeutralizationOverhead(text: string): number {
  const neutralizedLen = measurePostNeutralizationLength(text, false);
  return Math.max(0, neutralizedLen - text.length);
}

// ---------------------------------------------------------------------------------------------
// Rule predicates (raw-line mirrors of logAnalyzer, strictly bounded gaps <= 200).
// ---------------------------------------------------------------------------------------------

/**
 * Rule predicates (single-line mirrors of `logAnalyzer.ts` rules):
 * - Fixed/short patterns run in `PRIMARY_RULE_BUCKETS` (numeric code buckets run after
 *   `stripLogIdFieldsForErrorCodes` so benign `port=507015` never steals `BUCKET_PRIMARY`).
 * - Unbounded-gap rules (`GE compile ... failed`, `Free memory on device (...) on startup...`,
 *   `CheckSmmuFault: ...`, etc.) run in strict O(N) two-stage anchor + tail checks with ZERO
 *   length cutoff so arbitrarily long lines match `logAnalyzer` 100%.
 */
const PRIMARY_RULE_BUCKETS: ReadonlyArray<readonly [string, RegExp, boolean?]> = [
  // Rule 2: oom-stage-split (isNpuOomLine) + Rule 4 host OOM killer
  [
    "oom",
    /NPU\s+out of memory|ACL_ERROR_RT_MEMORY_ALLOCATION|OutOfMemoryError(?!\s*[:=]\s*(?:0|false|none|null)\b)|Out of memory:\s*Killed process/i,
  ],
  // Rule 1: pre-profile-free-memory (`Free memory on device (...)` handled in TWO_STAGE_PRIMARY_RULES)
  ["pre-mem", /Error in memory profiling/i],
  // Rule 17: hccl-link-or-ifname-fault
  ["ifname-init", new RegExp(`\\b(?:${HCCL_INIT_ALT})\\b`, "i")],
  [
    "ifname-net",
    /Cannot assign requested address|\bEADDRNOTAVAIL\b|bind\s*fail|RaSocketBind|\b(?:No route to host|Network is unreachable|Connection refused|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED)\b|no\s+valid\s+nic|cannot\s+find\s+(?:net|nic|interface)/i,
  ],
  ["roce-down", /\bibv_post_send\s+failed\b/i],
  // Rule 18: torchair-ge-graph-compile-fault (split clauses handled in TWO_STAGE_PRIMARY_RULES)
  [
    "ge-compile",
    /\b(?:BackendCompilerFailed|torch\._dynamo\.exc\.Unsupported)\b|There was no fake impl registered for\b|Static kernel generation requires npugraph_ex to be enabled|External DP static compilation requires the full DP worker world|Static compilation requires worker world size divisible by node count|\bcoreNum is 0,\s*tiling failed\b|\b(?:EZ3002|EZ3003)\b|(?:tiling\s+failed|host\s+tiling\s+failed|infer\s*shape\s+failed|ge\s+compile\s+failed)\b/i,
  ],
  // Rule 19: moe-mc2-or-modelslim-quant-fault
  [
    "mc2",
    /mc2 group is not initialized|expert_map is required for MC2 token dispatch|fused mc2 op cannot be used with hierarchy communication|mc2_comm_alg\s*==\s*['"](?:fullmesh_v2|hierarchy)['"]|supports at most 512 experts|HCCL_BUFFSIZE is too SMALL/i,
  ],
  [
    "modelslim",
    /ModelSlim Quantization Config Not Found|Could not determine quantization type for layer|doesn't support quant_type=/i,
  ],
  // Rule 5: soc-310p-or-c8-compat
  ["soc-310p", /Check ascend device type failed|AscendModelSlimConfig310/i],
  ["gqa-c8", /The current GQA[-\u2010-\u2015\s]related models adopt static quantization/i],
  // Rule 20: cann-driver-or-device-env-fault (`507008`/`107002` evaluated on ID-stripped line; `107024`/`107025` dedicated to aclgraph-code first)
  ["aclgraph-code", /(?<![A-Za-z0-9_])(?:107024|107025)(?![A-Za-z0-9_])/i, true],
  [
    "dev-env",
    /\baclrtGetPhyDevIdByUserDevId\s+failed\b|\blocal_world_size\s*\(\d+\)\s*(?:exceeds assigned_physical_gpu_ids count|must be less than or equal to the number of visible devices)\b|\bACL_ERROR_RT_(?:SOC_VERSION|CONTEXT_NULL)\b|\bEL0004\b/i,
  ],
  ["dev-code", new RegExp(`(?<![A-Za-z0-9_])(?:${DEVICE_CODE_ALT})(?![A-Za-z0-9_])`, "i"), true],
  // Rule 13: cann-plog-aicore-fault (numeric codes evaluated on ID-stripped line)
  [
    "aicore",
    /\bSMMU fault\b|MTE (?:accesses an invalid GM address|DDR address out of range)|VEC instruction to read\/write UB is out of bounds|\b(?:aicore|vector\s+core)\s+exception\b|(?:AI|Vector)\s+Core kernel (?:task )?execution failed|\bACL_ERROR_[A-Z0-9_]+\b|\[AdxDataDumpServer\]\[Init\]dump server run failed/i,
  ],
  ["r13-code", new RegExp(`(?<![A-Za-z0-9_])(?:${R13_CODE_ALT})(?![A-Za-z0-9_])`, "i"), true],
  // Rule 14: cann-opapi-or-aclnn-fault
  [
    "aclnn",
    new RegExp(
      `not in libopapi\\.so|libopapi\\.so\\s*not found|\\b(?:${R14_SYMBOL_ALT})\\b|Aicore kernel execute failed|\\b(?:${GENERIC_CODE_ALT})\\b`,
      "i",
    ),
  ],
  ["aclnn-code", new RegExp(`(?<![A-Za-z0-9_])(?:${R14_CODE_ALT})(?![A-Za-z0-9_])`, "i"), true],
  // Rule 15: zmq-port-conflict
  ["zmq", /\bZMQError\b|Address already in use/i],
  // Rule 6: graph-capture-failure
  [
    "aclgraph",
    /AscendFAImpl does not support ACL graph capture|npugraph_ex is not supported|\bACL_ERROR_RT_STREAM_CAPTURE\b/i,
  ],
  // Rule 9: mooncake-pd-transfer-error
  ["mooncake-pd", /Mooncake worker requires|Prefill TP size must be divisible by Decode TP size/i],
  // Rule 10: sleep-mode-fractal-nz-wakeup
  ["nz-wakeup", /FRACTAL_NZ mode is enabled|Please set weight_nz_mode=0/i],
  // Rule 4: exit-137-sigkill / exit-139-sigsegv
  [
    "sigkill",
    /\b(?:exit\s*code|returncode|status)\s*[:=\s]+(?:137|-9|139|-11)\b|\bSIGKILL\b|\bOOMKilled\b|\bSIGSEGV\b|Segmentation fault/i,
  ],
  // Rule 11: mooncake-adxl-endpoint-fallback
  ["adxl", /Dest buffer device_id(?:\s*=\s*\d+)?\s*>=\s*endpoint count\b/i],
  // Rule 12: debug-logging-hotpath-overhead
  ["debug-hotpath", /\bVLLM_LOGGING_LEVEL\s*[:=]\s*['"]?DEBUG['"]?\b/i],
];

interface TwoStageRule {
  readonly bucket: string;
  readonly anchorRe: RegExp;
  readonly midRe?: RegExp | undefined;
  readonly tailRe: RegExp;
  readonly rejectTailRe?: RegExp | undefined;
  readonly rejectLineRe?: RegExp | undefined;
  readonly maxGap?: number | undefined;
}

/**
 * Two-stage / three-stage O(N) anchor (+ optional mid) + tail predicates with ZERO length cutoff
 * so arbitrarily long diagnostic lines (`[Rank 3] GE compile ... (250ch) ... failed`,
 * `RoCE ... port ... (>60ch) ... down`, `Free memory on device (...) on startup...`, etc.)
 * maintain 100% parity with `logAnalyzer` AND export exact split predicate spans for line compaction.
 */
const TWO_STAGE_PRIMARY_RULES: readonly TwoStageRule[] = [
  {
    bucket: "pre-mem",
    anchorRe: /Free memory on device\b[^\r\n]{0,64}\(/i,
    tailRe: /\)\s*on startup\s+is less than desired/i,
  },
  {
    bucket: "ifname-env",
    anchorRe: /\b(?:HCCL_SOCKET_IFNAME|HCCL_IF_IP|GLOO_SOCKET_IFNAME|TP_SOCKET_IFNAME)\b/i,
    tailRe:
      /\bbind\s+fail|\bfail(?:ed)?\b|\berror\b(?!\s*=\s*0\b)|\binvalid\b|\bnot\s+found\b|\bdoes\s+not\s+exist\b|\bnot\s+exist\b|\bno\s+such\s+device\b|\bno\s+(?:valid|available)\s+(?:ip|nic|interface)\b|\bcannot\s+assign\b|\bno\s+route\b|\bmismatch\b/i,
  },
  {
    bucket: "rasocket",
    anchorRe: /\bRaSocket\w*\b/i,
    tailRe:
      /\bfail(?:ed)?\b|\btimeout\b|\btimed?\s+out\b|\bunable\b|\brefused\b|\berror\b(?!\s*=\s*0\b)|\bEADDRNOTAVAIL\b|\bENETUNREACH\b|\bEHOSTUNREACH\b|\bECONNREFUSED\b|\bETIMEDOUT\b|Cannot assign requested address|No route to host|Network is unreachable|Connection refused|\binvalid\b/i,
  },
  {
    bucket: "roce-down",
    anchorRe: /\bRoCE\b/i,
    midRe: /\b(?:link|port)\b/i,
    tailRe: /\bdown\b/i,
  },
  {
    bucket: "roce-down",
    anchorRe: /\bRoCE\b/i,
    tailRe: /\b(?:link\s+down|port\s+down|link\s+disconnected)\b/i,
  },
  {
    bucket: "roce-down",
    anchorRe: /\bhccn_tool\b/i,
    tailRe: /link\s+status\s*[:=]\s*DOWN/i,
  },
  {
    bucket: "roce-down",
    anchorRe: /\bhccn_tool\b/i,
    midRe: /\bport\b/i,
    tailRe: /\bdown\b/i,
  },
  {
    bucket: "ge-compile",
    anchorRe: /\bCheckMlaAttrs\b/i,
    tailRe:
      /fail(?:ed)?|error(?!\s*=\s*0\b)|invalid|unsupported|not\s+support|\bEZ\d{4}\b|\bE19999\b|retCode\s*[:=]\s*(?:-?[1-9]\d*|0x0*[1-9a-f][0-9a-f]*)/i,
  },
  {
    bucket: "ge-compile",
    anchorRe: /\bGE\s+(?:compile|graph\s+compile|build)\b/i,
    tailRe:
      /fail(?:ed)?|error(?!\s*=\s*0\b)|\bEZ\d{4}\b|\bE19999\b|retCode\s*[:=]\s*(?:-?[1-9]\d*|0x0*[1-9a-f][0-9a-f]*)/i,
  },
  {
    bucket: "ge-compile",
    anchorRe: /\bnpugraph_ex\b/i,
    tailRe:
      /compile\s+fail(?:ed)?|graph\s+break|backend\s+fail(?:ed)?|\b(?:RuntimeError|ValueError|ImportError|AssertionError)\b|fail(?:ed)?|error(?!\s*=\s*0\b)/i,
  },
  {
    bucket: "ge-compile",
    anchorRe: /\btorchair\b/i,
    tailRe:
      /(?:compile|ge|fx|graph|backend)\s+fail(?:ed)?|graph\s+break|fallback\s+(?:fail|to\s+eager)|\b(?:RuntimeError|BackendCompilerFailed)\b|fail(?:ed)?|error(?!\s*=\s*0\b)/i,
  },
  {
    bucket: "ge-compile",
    anchorRe: /fullgraph=True/i,
    tailRe: /graph break|\bUnsupported\b|fail(?:ed)?|error(?!\s*=\s*0\b)/i,
  },
  {
    bucket: "ge-compile",
    anchorRe: /\b(?:EZ9999|E19999)\b/i,
    tailRe: /\b(?:compile|tiling|CheckMlaAttrs|shape|infer|op\s*select|graph|ge::|OPP)\b/i,
  },
  {
    bucket: "mc2",
    anchorRe:
      /\b(?:npu_moe_distribute_(?:dispatch|combine)(?:_v2)?|MoeDistribute(?:Dispatch|Combine)(?:V2)?|DispatchFFNCombine|dispatch_ffn_combine)\b/i,
    tailRe:
      /HCCL_BUFFSIZE is too SMALL|worldSize is invalid|mc2 group|expert_map|hierarchy|comm_alg|group_ep|group_tp|ep_world_size|tp_world_size|rank_size|world\s*size|not\s+initialized|fail(?:ed)?|error(?!\s*=\s*0\b)/i,
  },
  {
    bucket: "modelslim",
    anchorRe: /quant_model_description\.json/i,
    tailRe:
      /not found|missing|does not exist|corrupt|invalid|decode\s+error|error(?!\s*=\s*0\b)|fail(?:ed)?/i,
  },
  {
    bucket: "modelslim",
    anchorRe: /Not all shards of\b/i,
    tailRe: /are quantized with same quant type/i,
  },
  {
    bucket: "modelslim",
    anchorRe: /Quantization method specified in the model config\s*\(/i,
    tailRe: /does not match the quantization method specified/i,
  },
  {
    bucket: "soc-version",
    anchorRe: /\bSOC_VERSION\b/i,
    tailRe: /\b(?:mismatch|invalid|error|fail(?:ed)?|unsupported|not\s+support)\b/i,
  },
  {
    bucket: "soc-310p",
    anchorRe: /Current device type:/i,
    tailRe: /does not match the installed version's device type/i,
  },
  {
    bucket: "soc-310p",
    anchorRe: /Ascend310P/i,
    tailRe: /bfloat16/i,
  },
  {
    bucket: "soc-310p",
    anchorRe: /bfloat16/i,
    tailRe: /310P|not\s+supported[^\r\n]{0,80}(?:Ascend|310P|NPU)/i,
  },
  {
    bucket: "soc-310p",
    anchorRe: /(?:Ascend|310P|NPU)/i,
    tailRe: /bfloat16[^\r\n]{0,80}not\s+supported/i,
  },
  {
    bucket: "soc-310p",
    anchorRe: /\bFP8\b/i,
    tailRe: /310P/i,
  },
  {
    bucket: "gqa-c8",
    anchorRe: /KV quantization is configured via/i,
    tailRe: /quantized weights are required/i,
  },
  {
    bucket: "dev-env",
    anchorRe: /(?:lib)?ascend_hal\.so(?:\.\d+)*\b/i,
    tailRe:
      /cannot open shared object file|No such file or directory|undefined symbol|fail(?:ed)?|error(?!\s*=\s*0\b)|ENOENT|EACCES|Permission denied/i,
  },
  {
    bucket: "dev-env",
    anchorRe: /cannot open shared object file|undefined symbol/i,
    tailRe: /(?:lib)?ascend_hal\.so/i,
  },
  {
    bucket: "dev-env",
    anchorRe: /\/dev\/davinci(?:_manager|\d+)\b/i,
    tailRe:
      /No such file or directory|Permission denied|\b(?:ENOENT|EACCES)\b|fail(?:ed)?|error(?!\s*=\s*0\b)|cannot open/i,
  },
  {
    bucket: "dev-env",
    anchorRe: /No such file or directory|Permission denied|\b(?:ENOENT|EACCES)\b|cannot open/i,
    tailRe: /\/dev\/davinci(?:_manager|\d+)\b/i,
  },
  {
    bucket: "dev-env",
    anchorRe: /\b(?:drvGetDevInfo|aclrtSetDevice|rtSetDevice)\b/i,
    tailRe:
      /fail(?:ed)?|error(?!\s*=\s*0\b)|ACL_ERROR|(?:ret(?:Code)?|code|status)\s*[:=]\s*(?:-?[1-9]\d*|0x0*[1-9a-f][0-9a-f]*)\b/i,
  },
  {
    bucket: "dev-env",
    anchorRe: /\bDP adjusted local rank\b/i,
    tailRe: /\bis out of bounds for\b/i,
  },
  {
    bucket: "aicore",
    anchorRe: /CheckSmmuFault:/i,
    tailRe: /isSmmuFault\s+is\s+[1-9]|failed|error|fault/i,
    rejectTailRe: /isSmmuFault\s+is\s+0\b/i,
  },
  {
    bucket: "aicore",
    anchorRe:
      /\b(?:SMMU|CheckSmmuFault|AICore|AI Core|Vector Core|AIV|task|kernel|stream|tsdrv|devdrv|runtime)\b/i,
    tailRe: /\bretCode=0x0*[1-9a-f][0-9a-f]*\b/i,
  },
  {
    bucket: "aclnn-fail",
    anchorRe: /\baclnn[A-Za-z0-9_]+\b/i,
    tailRe: /failed/i,
  },
  {
    bucket: "aclgraph",
    anchorRe: /\bFULL_DECODE_ONLY\b/i,
    tailRe: /not\s+support|unsupported|invalid|conflict|incompatible|fail(?:ed)?|error(?!\s*=\s*0\b)/i,
  },
  {
    bucket: "aclgraph",
    anchorRe: /(?:aclgraph|acl\s+graph)/i,
    tailRe:
      /capture[^\r\n]{0,40}(?:fail(?:ed)?|error)|fallback|not\s+supported|unsupported|disable[sd]?|disabling|fail(?:ed|ure)?|error(?!\s*=\s*0\b)/i,
    rejectLineRe: /Engine core initialization failed|EngineCore(?:Proc)?\b.{0,50}died unexpectedly/i,
    maxGap: 60,
  },
  {
    bucket: "aclgraph",
    anchorRe: /\bcapture_model\b/i,
    tailRe: /fail(?:ed)?|error(?!\s*=\s*0\b)/i,
  },
  {
    bucket: "aclgraph",
    anchorRe: /\b(?:rtStreamEndCapture|AclmdlRICaptureEnd|rtStreamWaitEvent)\b/i,
    tailRe: /\b(?:fail(?:ed)?|error(?!\s*=\s*0\b)|unjoined|missing|capture)\b/i,
    maxGap: 160,
  },
  {
    bucket: "aclgraph",
    anchorRe:
      /\bcudagraph_mode\s*=\s*(?:NONE|PIECEWISE|FULL_AND_PIECEWISE)\b[^\r\n]{0,96}\bincompatible with npugraph_ex\b/i,
    tailRe: /\bresetting\b/i,
    rejectLineRe: /^(?!.*\b(?:ERROR|WARN(?:ING)?|CRITICAL|FATAL)\b).*\b(?:INFO|DEBUG)\b(?!\s*\()/i,
    maxGap: 64,
  },
  {
    bucket: "mooncake-pd",
    anchorRe: /\bMooncakeConnector\w*\b/i,
    tailRe:
      /does not support|not supported|unsupported|failed|error|timeout|refused|\b(?:ValueError|RuntimeError|AssertionError)\b/i,
    maxGap: 40,
  },
  {
    bucket: "mooncake-pd",
    anchorRe: /\b(?:ValueError|RuntimeError|AssertionError|ERROR)\b/i,
    tailRe: /\bMooncakeConnector\b/i,
  },
  {
    bucket: "mooncake-pd",
    anchorRe: /\bmooncake\b/i,
    tailRe: /failed|error|handshake\s+(?:failed|error|timeout)|refused|timeout/i,
    maxGap: 48,
  },
  {
    bucket: "mooncake-pd",
    anchorRe: /\bRDMA\b/i,
    tailRe: /init\s+failed|register\s+failed|failed|error|timeout/i,
    maxGap: 30,
  },
  {
    bucket: "nz-wakeup",
    anchorRe: /(?:Invocation of|Call to) wake_up method failed/i,
    tailRe: /FRACTAL_NZ/i,
  },
  {
    bucket: "adxl",
    anchorRe: /Dest buffer device_id\b/i,
    tailRe: /\bfalling back\b/i,
  },
  {
    bucket: "debug-hotpath",
    anchorRe: /\bDEBUG\b/i,
    tailRe:
      /torch reserved memory:\s*[\d.]+\s*GiB|Running batch with cudagraph_mode:\s*(?:FULL|PIECEWISE)\b/i,
  },
];

export interface SplitRulePredicateHit {
  readonly index: number;
  readonly length: number;
}

function matchTwoStageRule(
  raw: string,
  rule: TwoStageRule,
): { bucket: string; hits: SplitRulePredicateHit[] } | null {
  if (rule.rejectLineRe?.test(raw)) return null;
  const tryAtAnchor = (
    anchorIndex: number,
    anchorLen: number,
    scanLimitEnd: number,
  ): { bucket: string; hits: SplitRulePredicateHit[] } | null => {
    let cursor = anchorIndex + anchorLen;
    const boundedEnd =
      rule.maxGap !== undefined && !rule.midRe
        ? Math.min(scanLimitEnd, cursor + rule.maxGap + 256)
        : scanLimitEnd;
    const tail1 = raw.slice(cursor, boundedEnd);
    if (rule.rejectTailRe?.test(tail1)) return null;
    const hits: SplitRulePredicateHit[] = [{ index: anchorIndex, length: anchorLen }];
    if (rule.midRe) {
      const mm = rule.midRe.exec(tail1);
      if (!mm) return null;
      hits.push({ index: cursor + mm.index, length: mm[0].length });
      cursor += mm.index + mm[0].length;
    }
    const boundedTailEnd =
      rule.maxGap !== undefined ? Math.min(scanLimitEnd, cursor + rule.maxGap + 256) : scanLimitEnd;
    const tail2 = raw.slice(cursor, boundedTailEnd);
    const tm = rule.tailRe.exec(tail2);
    if (!tm) return null;
    if (rule.maxGap !== undefined && tm.index > rule.maxGap) return null;
    hits.push({ index: cursor + tm.index, length: tm[0].length });
    return { bucket: rule.bucket, hits };
  };

  if (rule.maxGap === undefined && !rule.rejectTailRe) {
    const m = rule.anchorRe.exec(raw);
    if (!m) return null;
    return tryAtAnchor(m.index, m[0].length, raw.length);
  }

  const gFlags = rule.anchorRe.flags.includes("g") ? rule.anchorRe.flags : `${rule.anchorRe.flags}g`;
  const anchorAll = new RegExp(rule.anchorRe.source, gFlags);
  const anchors: Array<{ index: number; len: number }> = [];
  let m = anchorAll.exec(raw);
  while (m !== null) {
    anchors.push({ index: m.index, len: m[0].length });
    if (m[0].length === 0) anchorAll.lastIndex += 1;
    m = anchorAll.exec(raw);
  }
  for (let i = 0; i < anchors.length; i += 1) {
    const cur = anchors[i]!;
    const segEnd =
      rule.maxGap === undefined && rule.rejectTailRe ? (anchors[i + 1]?.index ?? raw.length) : raw.length;
    const matched = tryAtAnchor(cur.index, cur.len, segEnd);
    if (matched) return matched;
  }
  return null;
}

const ZERO_STATUS_CODE_RE =
  /\b(?:ret|retCode|err(?:or)?(?:_?code)?|status|errno)\s*[:=]\s*(?:0x0+\b|0\b(?!x[1-9a-f]))/i;
const NONZERO_CODE_RE =
  /\b(?:ret|retCode|err(?:or)?(?:_?code)?|status|errno)\s*[:=]\s*(?:-?[1-9]\d*|0x0*[1-9a-f][0-9a-f]*)\b/i;
const LOG_LEVEL_SETTING_RE =
  /\b(?:VLLM_LOGGING_LEVEL|LOG_LEVEL|LOGGING_LEVEL|log_?level)\s*[:=\s]\s*['"]?(?:INFO|DEBUG|WARN(?:ING)?|ERROR|CRITICAL|FATAL|OFF|DISABLED)['"]?\b/gi;
const ZERO_EI_COUNTER_RE =
  /\b(?:EI000[2469]|EJ0001)\b[^\r\n]{0,32}\b(?:count|cnt|total|num|hits)\s*[:=]\s*0\b|\b(?:EI000[2469]|EJ0001)(?:_(?:count|cnt|total|num))?\s*[:=]\s*0\b/i;
const NONZERO_EI_COUNTER_RE =
  /\b(?:EI000[2469]|EJ0001)\b[^\r\n]{0,32}\b(?:count|cnt|total|num|hits)\s*[:=]\s*[1-9]\d*\b|\b(?:EI000[2469]|EJ0001)(?:_(?:count|cnt|total|num))?\s*[:=]\s*[1-9]\d*\b/i;
const NULL_OR_ZERO_EXC_VALUE_RE =
  /\b(?:[A-Z][A-Za-z0-9_]*\.)*(?:[A-Z][A-Za-z0-9_]*(?:Error|Exception)|Exception)\s*:\s*(?:none|null|nil|ok|false|0)\s*(?:$|[)\]}])/i;
const PYTHON_EXC_IN_LINE_RE =
  /(?<![A-Za-z0-9_])(?:[A-Z][A-Za-z0-9_]*\.)*(?:[A-Z][A-Za-z0-9_]*(?:Error|Exception)|Exception)\s*:(?!\s*(?:none|null|nil|ok|false)\b)/;

function hasLogErrorSeverity(rawLine: string): boolean {
  const masked = rawLine
    .replace(LOG_LEVEL_SETTING_RE, " ")
    .replace(/\b(?:error|err)\s*=\s*(?:0x0+\b|0\b)/gi, " ");
  return /(?<![=\w.])(?:ERROR|CRITICAL|FATAL)\b(?!\s*=)/.test(masked);
}

function hasNullOrZeroExceptionValueOnly(rawLine: string): boolean {
  if (!NULL_OR_ZERO_EXC_VALUE_RE.test(rawLine)) return false;
  if (/\bKeyError\s*:\s*0\b/.test(rawLine)) return false;
  return !hasLogErrorSeverity(rawLine);
}

function hasGenuinePythonException(rawLine: string): boolean {
  if (!PYTHON_EXC_IN_LINE_RE.test(rawLine)) return false;
  return !hasNullOrZeroExceptionValueOnly(rawLine);
}

export function isBenignZeroStatusOrCounterLine(rawLine: string): boolean {
  const errSev = hasLogErrorSeverity(rawLine);
  const pyExc = hasGenuinePythonException(rawLine);
  if (
    ZERO_STATUS_CODE_RE.test(rawLine) &&
    !NONZERO_CODE_RE.test(rawLine) &&
    !errSev &&
    !pyExc &&
    !/\b(?:FAIL(?:ED)?|CheckSmmuFault|EADDRNOTAVAIL|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED|EI000[2469]|EJ0001|EZ\d{4}|EL\d{4}|EH\d{4}|E19999|ACL_ERROR_[A-Z0-9_]+|HCCL_E_[A-Z0-9_]+|timed?\s+out|times?\s+out|out of memory)\b/i.test(
      rawLine,
    )
  ) {
    return true;
  }
  if (
    ZERO_EI_COUNTER_RE.test(rawLine) &&
    !NONZERO_CODE_RE.test(rawLine) &&
    !NONZERO_EI_COUNTER_RE.test(rawLine) &&
    !errSev &&
    !pyExc &&
    !/\b(?:FAIL(?:ED)?|RuntimeError|ValueError|AssertionError|TimeoutError|timed?\s+out|times?\s+out|Getting socket times out|\[Wait\]\[LinkEstablish\]|Notify wait execute timeout|The wait execution of the Notify|ranktable|transport init|HCCP init)\b/i.test(
      rawLine,
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Mirrors `logAnalyzer`'s benign suppression predicates (`hasBenignZeroStatusOnly`,
 * `hasBenignZeroCounterOnly`, `hasNullOrZeroExceptionValueOnly`, and `isBenignInfoOrDebugInitLine`).
 * Suppressed lines must NEVER steal primary/cascade excerpt budget from genuine faults.
 */
export function isBenignSuppressedDiagnosticLine(rawLine: string): boolean {
  if (isBenignZeroStatusOrCounterLine(rawLine)) return true;
  if (hasNullOrZeroExceptionValueOnly(rawLine)) return true;
  if (!/\b(?:INFO|DEBUG)\b/i.test(rawLine)) return false;
  if (NONZERO_CODE_RE.test(rawLine) || hasLogErrorSeverity(rawLine) || hasGenuinePythonException(rawLine)) {
    return false;
  }
  const masked = rawLine.replace(LOG_LEVEL_SETTING_RE, " ");
  if (
    /\b(?:FAIL(?:ED)?|TimeoutError|BackendCompilerFailed|Unsupported|OutOfMemoryError(?!\s*:\s*(?:none|null|nil|ok|false|0)\b)|timed?\s+out|times?\s+out|\btimeout\b|out of memory|ACL_ERROR_[A-Z0-9_]+|ACLNN_ERR_[A-Z0-9_]+|EZ\d{4}|EL\d{4}|EH\d{4}|E19999|EI000[2469]|EJ0001|EADDRNOTAVAIL|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED|No route to host|Network is unreachable|Connection refused|Cannot assign requested address|HCCL_BUFFSIZE is too SMALL|CheckSmmuFault(?!:[^\r\n]*isSmmuFault\s+is\s+0\b)|isSmmuFault\s+is\s+[1-9]|link\s+down|port\s+down|not found|does not exist|Permission denied|cannot open|invalid|mismatch|not supported|unsupported|is not initialized|is required|cannot be used|supports at most|exceeds|out of bounds|\[Wait\]\[LinkEstablish\])\b/i.test(
      masked,
    ) ||
    /\b(?:exit\s*code|returncode|status)\s*[:=\s]+(?:137|-9|139|-11)\b|Out of memory:\s*Killed process|Segmentation fault/i.test(
      masked,
    )
  ) {
    return false;
  }
  return true;
}

const UNSUPPRESSED_PRIMARY_BUCKETS = new Set(["pre-mem", "zmq", "debug-hotpath"]);

/** Returns ALL matching primary signal bucket ids for a line (so secondary/fabricated rule matches cannot hide behind an earlier primary match). */
export function getAllPrimarySignalBuckets(raw: string): Set<string> {
  const out = new Set<string>();
  let stripped: string | null = null;
  for (const [bucket, re, useIdStripped] of PRIMARY_RULE_BUCKETS) {
    let target = raw;
    if (useIdStripped) {
      if (stripped === null) stripped = stripLogIdFieldsForErrorCodes(raw);
      target = stripped;
    }
    if (re.test(target)) out.add(bucket);
  }
  for (const rule of TWO_STAGE_PRIMARY_RULES) {
    if (matchTwoStageRule(raw, rule)) out.add(rule.bucket);
  }
  return out;
}

/** Returns the first matching primary signal bucket id for a line, or null when not primary rule evidence. */
export function getPrimarySignalBucket(raw: string): string | null {
  let stripped: string | null = null;
  for (const [bucket, re, useIdStripped] of PRIMARY_RULE_BUCKETS) {
    let target = raw;
    if (useIdStripped) {
      if (stripped === null) stripped = stripLogIdFieldsForErrorCodes(raw);
      target = stripped;
    }
    if (re.test(target)) return bucket;
  }
  for (const rule of TWO_STAGE_PRIMARY_RULES) {
    const matched = matchTwoStageRule(raw, rule);
    if (matched) return matched.bucket;
  }
  return null;
}

/**
 * Returns grouped `[anchor, mid?, tail]` hits per matching split rule so compaction can reserve all
 * minimal clauses of a split rule atomically together instead of admitting half a rule.
 */
export function findSplitRulePredicateGroups(raw: string): SplitRulePredicateHit[][] {
  const groups: SplitRulePredicateHit[][] = [];
  for (const rule of TWO_STAGE_PRIMARY_RULES) {
    const matched = matchTwoStageRule(raw, rule);
    if (matched) groups.push(matched.hits);
  }
  return groups;
}

/** Flat `[index, length]` hits across all matching split rules. */
export function findSplitRulePredicateHits(raw: string): SplitRulePredicateHit[] {
  return findSplitRulePredicateGroups(raw).flat();
}

/** Rule 3 wait cascades + Rule 17 link-establish timeouts (EI0006 floods): rule evidence, storm-prone. */
const CASCADE_EVIDENCE_RE =
  /\b(?:EI0002|EI0006|HCCL_E_WAIT_TIMEOUT)\b|Notify wait execute timeout|The wait execution of the Notify register times out|Watchdog caught collective operation timeout|EngineCore(?:Proc)?\b[^\r\n]{0,50}died unexpectedly|\bBrokenPipeError\b|\bChildFailedError\b|\[Wait\]\[LinkEstablish\]|Getting socket times out|\bp2p\s+timeout\b|(?:AllReduce|AllGather|ReduceScatter|AllToAll)\b[^\r\n]{0,40}\b(?:timeout|timed?\s+out)\b|\bHCCL\b[^\r\n]{0,36}\b(?:wait\s+timeout|execute\s+timeout|collective[^\r\n]{0,20}timeout|timed?\s+out|(?:error|failed)[^\r\n]{0,20}timeout)\b|\b(?:ERROR|CRITICAL|FATAL|RuntimeError|TimeoutError)\b[^\r\n]{0,48}\bHCCL\b[^\r\n]{0,24}\btimeout\b/i;

/**
 * Rank / device / lifecycle context consumed by the verdict (visible-device mapping, Ascend stack
 * markers for OOM correlation, device-count guards, OOM stage milestones).
 */
const VISIBLE_DEVICES_CONTEXT_RE = /ASCEND_RT_VISIBLE_DEVICES['"\s:=]+[0-9]+(?:\s*,\s*[0-9]+)*/i;
const ASCEND_LINE_CONTEXT_RE = /\b(?:NPU|cann|hccl|acl|torch_npu|vllm_ascend|Ascend\d*|ACL_ERROR_RT_)\b/i;

const CONTEXT_EVIDENCE_RE =
  /ASCEND_RT_VISIBLE_DEVICES|\blocal_world_size\b|assigned_physical_gpu_ids|number of visible devices|\bdevice[_ ]count\b|\b(?:NPU|cann|hccl|acl|torch_npu|vllm_ascend|Ascend\d*|ACL_ERROR_RT_)\b|\b(?:Starting\s+load_model|Loading\s+safetensors|Loading\s+model\s+weights|Model\s+loading\s+took|Entering\s+profile_run|Entering\s+compile_or_warm_up_model|Application startup complete|Graph capturing finished|NPUWorkspaceAllocator|GetWorkspaceSize|get_workspace_size|determine_available_memory)\b|Available KV cache memory:\s*[\d.]+\s*(?:GiB|GB|MiB)|(?:NPU|GPU)\s+KV cache size:\s*[\d,]+\s*tokens/i;

export type EvidenceLineKind = "metric" | "primary" | "cascade" | "context";

/** True when a line carries an `ASCEND_RT_VISIBLE_DEVICES=...` mapping for physical-device resolution. */
export function isVisibleDevicesContextLine(raw: string): boolean {
  return raw.includes("ASCEND_RT_VISIBLE_DEVICES") && VISIBLE_DEVICES_CONTEXT_RE.test(raw);
}

/** True when a line supplies Ascend execution scope for generic OOM correlation (`torch.cuda.OutOfMemoryError`). */
export function isAscendScopeContextLine(raw: string): boolean {
  return ASCEND_LINE_CONTEXT_RE.test(raw);
}

/**
 * Classify one raw log line by the analyzer rule family it can feed, or null for plain chatter.
 * Precedence: metric sample > non-suppressed primary/rule signal > cascade > context.
 */
export function classifyEvidenceLine(raw: string): EvidenceLineKind | null {
  if (!raw.trim()) return null;
  if (isMetricSampleLine(raw)) return "metric";
  const suppressed = isBenignSuppressedDiagnosticLine(raw);
  const bucket = getPrimarySignalBucket(raw);
  if (bucket !== null) {
    if (!suppressed) return "primary";
    if (UNSUPPRESSED_PRIMARY_BUCKETS.has(bucket)) return "primary";
    if (
      bucket === "oom" &&
      !hasNullOrZeroExceptionValueOnly(raw) &&
      !/\b(?:OutOfMemoryError|OOM)\s*[:=]\s*(?:0|false)\b/i.test(raw) &&
      (!/\b(?:INFO|DEBUG)\b/i.test(raw) ||
        /NPU\s+out of memory|ACL_ERROR_RT_MEMORY_ALLOCATION|OutOfMemoryError\s*:/i.test(raw))
    ) {
      return "primary";
    }
    if (
      bucket === "sigkill" &&
      /\b(?:exit\s*code|returncode|status)\s*[:=\s]+(?:137|-9|139|-11)\b|Out of memory:\s*Killed process|Segmentation fault/i.test(
        raw,
      )
    ) {
      return "primary";
    }
  }
  if (!suppressed && CASCADE_EVIDENCE_RE.test(raw)) return "cascade";
  if (CONTEXT_EVIDENCE_RE.test(raw)) return "context";
  return null;
}

/**
 * Single matcher used by truncation tier selection: true when the line can feed ANY of the analyzer's
 * 20 rules (primary signals, Rule 3/11/12/17 cascades and storms, metrics, rank/device/lifecycle context).
 */
export function isRuleEvidenceLine(raw: string): boolean {
  return classifyEvidenceLine(raw) !== null;
}
