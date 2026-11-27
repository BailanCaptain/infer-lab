/**
 * Pure TypeScript log / error-code / Prometheus `/metrics` diagnostic engine
 * for Wave 4A Tool ③ (`troubleshoot-workbench` Panel A).
 *
 * Physically isolated from the schematic timeline sandbox (`timelineSandbox.ts`):
 * every finding here is strictly grounded in pasted/preset log lines or `/metrics` text.
 */

export type TroubleshootSeverity = "error" | "warn" | "info";
export type TroubleshootEvidenceLevel = "C" | "S" | "I" | "D";
export type EvidenceLineKind = "root-cause" | "cascade";
export type FirstFaultConfidence = "high" | "medium" | "low";
export type RankSource =
  | "explicit-rank"
  | "worker-ep"
  | "worker-tp"
  | "worker-dp-pp"
  | "local-rank"
  | "device-id";

export type FaultTimelineEventKind =
  | "root-cause"
  | "confirmed-cascade"
  | "pre-existing-timeout"
  | "unattributed-cascade";

export type CascadeCausalState =
  | "confirmed-after"
  | "earlier-than-primary"
  | "unverified-order"
  | "no-primary";

export interface FaultTimelineEvent {
  id: string;
  lineNumber: number;
  timestamp: string | null;
  timestampMs: number | null;
  rank: number | null;
  rankSource: RankSource | null;
  slotMappable: boolean;
  kind: FaultTimelineEventKind;
  signalTag: string;
  rawLine: string;
}

export type DiagnosisCategory =
  | "memory"
  | "distributed"
  | "os-process"
  | "compatibility"
  | "graph"
  | "metrics"
  | "kv-transfer";

export interface PrimaryEvidenceLine {
  lineNumber: number;
  rank: number | null;
  timestamp: string | null;
  rawLine: string;
  kind: EvidenceLineKind;
}

export interface FirstFaultVerdict {
  rank: number | null;
  confidence: FirstFaultConfidence;
  rationale: string;
  primaryEvidenceLines: PrimaryEvidenceLine[];
  cascadeRanks: number[];
  rankSource?: RankSource | null | undefined;
  hostTag?: string | null | undefined;
  slotMappable?: boolean | undefined;
  cascadeCausalState?: CascadeCausalState | undefined;
  timelineEvents?: readonly FaultTimelineEvent[] | undefined;
}

export interface ParsedMetricsSnapshot {
  hasMetrics: boolean;
  rawMetricCount: number;
  kvCacheUsageRatio?: number | undefined;
  numRequestsRunning?: number | undefined;
  numRequestsWaiting?: number | undefined;
  numPreemptionsTotal?: number | undefined;
  ttftAvgSec?: number | undefined;
  itlAvgSec?: number | undefined;
  prefixCacheHitRate?: number | undefined;
}

export interface MatchedLogLine {
  lineNumber: number;
  rank: number | null;
  timestamp: string | null;
  rawLine: string;
}

export interface LogDiagnosisFinding {
  ruleId: string;
  title: string;
  severity: TroubleshootSeverity;
  category: DiagnosisCategory;
  evidenceLevel: TroubleshootEvidenceLevel;
  summary: string;
  mechanism: string;
  matchedLines: MatchedLogLine[];
  sources: string[];
  nextEvidenceCmd: string;
  experimentStep: string;
  wikiPageIds: string[];
}

export interface LogAnalysisReport {
  inputKind: "empty" | "logs" | "metrics" | "mixed";
  totalLines: number;
  detectedRanks: number[];
  visibleDevices?: readonly number[] | null | undefined;
  firstFaultVerdict: FirstFaultVerdict;
  metrics: ParsedMetricsSnapshot;
  findings: LogDiagnosisFinding[];
  unmatchedErrorLines: MatchedLogLine[];
}

interface ParsedLogLine {
  lineNumber: number;
  rawLine: string;
  trimmed: string;
  rank: number | null;
  rankSource: RankSource | null;
  hostTag: string | null;
  pid: number | null;
  timestamp: string | null;
  timestampMs: number | null;
}

interface ClassifiedSignal extends ParsedLogLine {
  kind: EvidenceLineKind;
  signalTag: string;
}

const FULL_TS_RE = /\b(\d{4})-(\d{2})-(\d{2})[T -](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?\b/;
const SHORT_DATE_TS_RE = /\b(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?\b/;
const TIME_ONLY_TS_RE = /\b(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?\b/;

export const LOG_TIMESTAMP_PATTERNS: readonly RegExp[] = [FULL_TS_RE, SHORT_DATE_TS_RE, TIME_ONLY_TS_RE];

const TYPED_RANK_PATTERNS: ReadonlyArray<{ re: RegExp; source: RankSource }> = [
  { re: /\[\s*(?:Rank|rank|RANK)\s*[:=#]?\s*(\d+)\s*\]/, source: "explicit-rank" },
  { re: /\bWorker_(?:[A-Za-z]+\d+_)*EP(\d+)\b/i, source: "worker-ep" },
  { re: /\b(?:Worker_TP|VllmWorker_TP)\s*[_:-]?\s*(\d+)(?=_|\b)/i, source: "worker-tp" },
  { re: /\b(?:Worker_DP|Worker_PP|EngineCore_DP)\s*[_:-]?\s*(\d+)(?=_|\b)/i, source: "worker-dp-pp" },
  { re: /\b(?:local_rank)\s*[:=]\s*(\d+)\b/i, source: "local-rank" },
  { re: /\b(?:global_rank|rank)\s*[:=]\s*(\d+)\b/i, source: "explicit-rank" },
  { re: /\brank\s+(\d+)\b/i, source: "explicit-rank" },
  { re: /\b(?:device_id|NPU|device)\s*[:=#]\s*(\d+)\b/i, source: "device-id" },
  { re: /\b(?:NPU|device)\s+(\d+)\b/i, source: "device-id" },
];

export const RANK_PATTERNS: readonly RegExp[] = TYPED_RANK_PATTERNS.map((p) => p.re);

const HOST_TAG_RE = /\[\s*((?:host|node)\s*[A-Za-z0-9_.-]+)\s*\]|\b(node[_-]?rank\s*=\s*\d+)/i;

export interface ExtractedTimestamp {
  timestamp: string | null;
  timestampMs: number | null;
  index: number | null;
  length: number;
}

export interface ExtractedRankMatch {
  rank: number;
  source: RankSource;
  index: number;
  raw: string;
}

function parseFractionMs(frac: string | undefined): number {
  if (!frac) return 0;
  return Number(frac.slice(0, 3).padEnd(3, "0"));
}

export function extractTimestamp(line: string): ExtractedTimestamp {
  const full = FULL_TS_RE.exec(line);
  if (full) {
    const year = Number(full[1]);
    const month = Number(full[2]);
    const day = Number(full[3]);
    const hh = Number(full[4]);
    const mm = Number(full[5]);
    const ss = Number(full[6]);
    const ms = parseFractionMs(full[7]);
    const timestampMs = Date.UTC(year, month - 1, day, hh, mm, ss, ms);
    return { timestamp: full[0], timestampMs, index: full.index, length: full[0].length };
  }

  const shortDate = SHORT_DATE_TS_RE.exec(line);
  if (shortDate) {
    const month = Number(shortDate[1]);
    const day = Number(shortDate[2]);
    const hh = Number(shortDate[3]);
    const mm = Number(shortDate[4]);
    const ss = Number(shortDate[5]);
    const ms = parseFractionMs(shortDate[6]);
    const timestampMs = Date.UTC(2026, month - 1, day, hh, mm, ss, ms);
    return { timestamp: shortDate[0], timestampMs, index: shortDate.index, length: shortDate[0].length };
  }

  const timeOnly = TIME_ONLY_TS_RE.exec(line);
  if (timeOnly) {
    const hh = Number(timeOnly[1]);
    const mm = Number(timeOnly[2]);
    const ss = Number(timeOnly[3]);
    const ms = parseFractionMs(timeOnly[4]);
    if (hh <= 23 && mm <= 59 && ss <= 59) {
      const timestampMs = ((hh * 60 + mm) * 60 + ss) * 1000 + ms;
      return { timestamp: timeOnly[0], timestampMs, index: timeOnly.index, length: timeOnly[0].length };
    }
  }

  return { timestamp: null, timestampMs: null, index: null, length: 0 };
}

export function extractRankMatch(line: string): ExtractedRankMatch | null {
  for (const { re, source } of TYPED_RANK_PATTERNS) {
    const match = re.exec(line);
    if (match?.[1] !== undefined) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value) && value >= 0 && value < 4096) {
        return { rank: value, source, index: match.index, raw: match[0] };
      }
    }
  }
  return null;
}

export function extractRank(line: string): number | null {
  return extractRankMatch(line)?.rank ?? null;
}

function extractHostTag(line: string): string | null {
  const m = HOST_TAG_RE.exec(line);
  return (m?.[1] ?? m?.[2] ?? "").trim() || null;
}

const PID_RE = /\bpid=(\d+)\b|\b(?:RUNTIME|HCCL|ASCENDCL|GE|DRV)\((\d+),/i;

const OMISSION_MARKER_RE =
  /^\s*\.\.\.\s*\[日志节选：[^\]]*(?:下行起原行号\s*L(\d+)|已省略第\s*\d+\s*[–-]\s*(\d+)\s*行)[^\]]*\]\s*\.\.\.\s*$/;

function extractPid(line: string): number | null {
  const m = PID_RE.exec(line);
  const raw = m?.[1] ?? m?.[2];
  if (!raw) return null;
  const val = Number.parseInt(raw, 10);
  return Number.isFinite(val) ? val : null;
}

const VISIBLE_DEVICES_LOG_RE =
  /ASCEND_RT_VISIBLE_DEVICES['"\s:=]+([0-9]+(?:\s*,\s*[0-9]+)*)(?=$|['"\s;)\]}])/i;

export function extractVisibleDevicesFromLog(input: string): number[] | null {
  let latest: number[] | null = null;
  for (const rl of input.split(/\r?\n/)) {
    const m = VISIBLE_DEVICES_LOG_RE.exec(rl);
    if (!m?.[1]) continue;
    const nums = m[1]
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < 4096);
    if (nums.length > 0 && new Set(nums).size === nums.length) {
      latest = nums;
    }
  }
  return latest;
}

function parseLogLines(input: string): ParsedLogLine[] {
  const rawLines = input.split(/\r?\n/);
  const parsed: ParsedLogLine[] = [];
  const scopedPidMap = new Map<string, { rank: number; source: RankSource } | "ambiguous">();
  const barePidMap = new Map<number, { rank: number; source: RankSource; hostKey: string } | "ambiguous">();

  for (const rl of rawLines) {
    const pid = extractPid(rl);
    const rm = extractRankMatch(rl);
    if (pid === null || rm === null) continue;
    const hostKey = (extractHostTag(rl) ?? "").toLowerCase();
    const scopedKey = `${hostKey}#${pid}`;
    const prevScoped = scopedPidMap.get(scopedKey);
    if (prevScoped === undefined) {
      scopedPidMap.set(scopedKey, { rank: rm.rank, source: rm.source });
    } else if (prevScoped !== "ambiguous" && prevScoped.rank !== rm.rank) {
      scopedPidMap.set(scopedKey, "ambiguous");
    }

    const prevBare = barePidMap.get(pid);
    if (prevBare === undefined) {
      barePidMap.set(pid, { rank: rm.rank, source: rm.source, hostKey });
    } else if (prevBare !== "ambiguous" && (prevBare.rank !== rm.rank || prevBare.hostKey !== hostKey)) {
      barePidMap.set(pid, "ambiguous");
    }
  }
  const hasMultipleHostScopes = rawLines.some((rl) => extractHostTag(rl) !== null);

  let tracebackRank: number | null = null;
  let tracebackRankSource: RankSource | null = null;
  let tracebackHostTag: string | null = null;
  let tracebackPid: number | null = null;
  let tracebackTs: string | null = null;
  let tracebackTsMs: number | null = null;
  let inTraceback = false;
  let currentLineNumber = 1;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i]!;
    const trimmed = rawLine.trim();

    const omissionMatch = OMISSION_MARKER_RE.exec(rawLine);
    if (omissionMatch) {
      const nextLine = omissionMatch[1]
        ? Number.parseInt(omissionMatch[1], 10)
        : omissionMatch[2]
          ? Number.parseInt(omissionMatch[2], 10) + 1
          : NaN;
      if (Number.isFinite(nextLine) && nextLine > currentLineNumber) {
        currentLineNumber = nextLine;
      }
      inTraceback = false;
      tracebackRank = null;
      tracebackRankSource = null;
      tracebackHostTag = null;
      tracebackPid = null;
      tracebackTs = null;
      tracebackTsMs = null;
      continue;
    }

    const lineNumber = currentLineNumber;
    currentLineNumber += 1;

    const { timestamp, timestampMs } = extractTimestamp(rawLine);
    const rankMatch = extractRankMatch(rawLine);
    let rank = rankMatch?.rank ?? null;
    let rankSource = rankMatch?.source ?? null;
    let hostTag = extractHostTag(rawLine);
    let pid = extractPid(rawLine);
    if (rank === null && pid !== null) {
      const hostKey = (hostTag ?? "").toLowerCase();
      if (hostKey.length > 0 || !hasMultipleHostScopes) {
        const mapped = scopedPidMap.get(`${hostKey}#${pid}`);
        if (mapped && mapped !== "ambiguous") {
          rank = mapped.rank;
          rankSource = mapped.source;
        }
      } else {
        const bare = barePidMap.get(pid);
        if (bare && bare !== "ambiguous" && bare.hostKey === "") {
          rank = bare.rank;
          rankSource = bare.source;
        }
      }
    }
    let effectiveTimestamp = timestamp;
    let effectiveTimestampMs = timestampMs;

    if (/Traceback \(most recent call last\):/i.test(trimmed)) {
      inTraceback = true;
      tracebackRank = rank;
      tracebackRankSource = rankSource;
      tracebackHostTag = hostTag;
      tracebackPid = pid;
      tracebackTs = timestamp;
      tracebackTsMs = timestampMs;
    } else if (inTraceback) {
      if (trimmed.length === 0) {
        inTraceback = false;
        tracebackRank = null;
        tracebackRankSource = null;
        tracebackHostTag = null;
        tracebackPid = null;
        tracebackTs = null;
        tracebackTsMs = null;
      } else if (rank === null && timestamp === null) {
        if (/^(?:File "|[\s]{2,}|[A-Za-z_][A-Za-z0-9_.]*(?:Error|Exception):)/.test(rawLine)) {
          rank = tracebackRank;
          rankSource = tracebackRankSource;
          if (hostTag === null) hostTag = tracebackHostTag;
          if (pid === null) pid = tracebackPid;
          effectiveTimestamp = tracebackTs;
          effectiveTimestampMs = tracebackTsMs;
        }
        if (/^[A-Za-z_][A-Za-z0-9_.]*(?:Error|Exception):/.test(trimmed)) {
          inTraceback = false;
          tracebackRank = null;
          tracebackRankSource = null;
          tracebackHostTag = null;
          tracebackPid = null;
          tracebackTs = null;
          tracebackTsMs = null;
        }
      } else {
        inTraceback = false;
        tracebackRank = null;
        tracebackRankSource = null;
        tracebackHostTag = null;
        tracebackPid = null;
        tracebackTs = null;
        tracebackTsMs = null;
      }
    }

    parsed.push({
      lineNumber,
      rawLine,
      trimmed,
      rank,
      rankSource,
      hostTag,
      pid,
      timestamp: effectiveTimestamp,
      timestampMs: effectiveTimestampMs,
    });
  }

  return parsed;
}

const PROM_METRIC_LINE_RE =
  /^\s*([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{[^}]*\})?\s+([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|[Nn][Aa][Nn]|[+-]?[Ii][Nn][Ff])\s*(?:\d+)?\s*$/;

export function parsePrometheusMetrics(input: string): ParsedMetricsSnapshot {
  const lines = input.split(/\r?\n/);
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  let rawMetricCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = PROM_METRIC_LINE_RE.exec(trimmed);
    if (!match) continue;
    const metricName = match[1]!;
    const rawVal = Number(match[2]!);
    if (!Number.isFinite(rawVal)) continue;
    if (!metricName.startsWith("vllm:")) continue;

    rawMetricCount += 1;
    sums.set(metricName, (sums.get(metricName) ?? 0) + rawVal);
    counts.set(metricName, (counts.get(metricName) ?? 0) + 1);
  }

  const getAvg = (name: string): number | undefined => {
    const count = counts.get(name);
    if (!count) return undefined;
    return (sums.get(name) ?? 0) / count;
  };
  const getSum = (name: string): number | undefined => sums.get(name);

  const rawKv = getAvg("vllm:kv_cache_usage_perc") ?? getAvg("vllm:gpu_cache_usage_perc");
  const kvCacheUsageRatio = rawKv === undefined ? undefined : rawKv > 1.0001 ? rawKv / 100 : rawKv;

  const numRequestsRunning = getSum("vllm:num_requests_running");
  const numRequestsWaiting = getSum("vllm:num_requests_waiting");
  const numPreemptionsTotal = getSum("vllm:num_preemptions_total") ?? getSum("vllm:num_preemptions");

  const ttftSum = getSum("vllm:time_to_first_token_seconds_sum");
  const ttftCount = getSum("vllm:time_to_first_token_seconds_count");
  const ttftAvgSec =
    ttftSum !== undefined && ttftCount !== undefined && ttftCount > 0
      ? ttftSum / ttftCount
      : getAvg("vllm:time_to_first_token_seconds");

  const itlSum = getSum("vllm:inter_token_latency_seconds_sum");
  const itlCount = getSum("vllm:inter_token_latency_seconds_count");
  const itlAvgSec =
    itlSum !== undefined && itlCount !== undefined && itlCount > 0
      ? itlSum / itlCount
      : getAvg("vllm:inter_token_latency_seconds");

  const prefixHits = getSum("vllm:prefix_cache_hits_total") ?? getSum("vllm:prefix_cache_hits");
  const prefixQueries = getSum("vllm:prefix_cache_queries_total") ?? getSum("vllm:prefix_cache_queries");
  const prefixCacheHitRate =
    prefixHits !== undefined && prefixQueries !== undefined && prefixQueries > 0
      ? prefixHits / prefixQueries
      : undefined;

  return {
    hasMetrics: rawMetricCount > 0,
    rawMetricCount,
    kvCacheUsageRatio,
    numRequestsRunning,
    numRequestsWaiting,
    numPreemptionsTotal,
    ttftAvgSec,
    itlAvgSec,
    prefixCacheHitRate,
  };
}

const BENIGN_HCCL_TIMEOUT_CONFIG_RE =
  /timeout interval of the HCCL operator|VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS|HCCL_EXEC_TIMEOUT\s*=/i;

const EXPLICIT_HCCL_FAULT_RE =
  /\bEI0006\b|\bHCCL_E_WAIT_TIMEOUT\b|Notify wait execute timeout|Watchdog caught collective operation timeout/i;

const HCCL_CONTEXT_TIMEOUT_FAULT_RE =
  /(?:AllReduce|AllGather|ReduceScatter|AllToAll)\b[^\r\n]{0,40}\b(?:timeout|timed?\s+out)\b|\bHCCL\b[^\r\n]{0,36}\b(?:wait\s+timeout|execute\s+timeout|collective[^\r\n]{0,20}timeout|timed?\s+out|(?:error|failed)[^\r\n]{0,20}timeout)\b|\b(?:ERROR|CRITICAL|FATAL|RuntimeError|TimeoutError)\b[^\r\n]{0,48}\bHCCL\b[^\r\n]{0,24}\btimeout\b/i;

const EXPLICIT_ERROR_LEVEL_RE = /\b(?:ERROR|CRITICAL|FATAL|RuntimeError|TimeoutError)\b/i;

function isHcclTimeoutFaultLine(rawLine: string): boolean {
  if (EXPLICIT_HCCL_FAULT_RE.test(rawLine)) return true;
  if (BENIGN_HCCL_TIMEOUT_CONFIG_RE.test(rawLine) && !EXPLICIT_ERROR_LEVEL_RE.test(rawLine)) {
    return false;
  }
  return HCCL_CONTEXT_TIMEOUT_FAULT_RE.test(rawLine);
}

const SLEEP_FRACTAL_NZ_ERROR_RE =
  /FRACTAL_NZ mode is enabled|(?:Invocation of|Call to) wake_up method failed[^\r\n]*FRACTAL_NZ|Please set weight_nz_mode=0/i;

const GQA_STATIC_C8_KV_RE =
  /The current GQA[-\u2010-\u2015\s]related models adopt static quantization|KV quantization is configured via [`'"]?--kv[-\u2010-\u2015]cache[-\u2010-\u2015]dtype[`'"]?[^\r\n]*quantized weights are required/i;

const MOONCAKE_ADXL_FALLBACK_RE =
  /Dest buffer device_id(?:\s*=\s*\d+)?\s*>=\s*endpoint count\b[^\r\n]*\bfalling back\b|transfer_executor_base\.cpp:\d+\]\s*Dest buffer device_id\b/i;

const DEBUG_LOGGING_HOTPATH_RE =
  /(?<!without\s)\bVLLM_LOGGING_LEVEL\s*[:=]\s*['"]?DEBUG['"]?\b|\bDEBUG\b[^\r\n]*\btorch reserved memory:\s*[\d.]+\s*GiB,\s*torch allocated memory:\s*[\d.]+\s*GiB|\bDEBUG\b[^\r\n]*\bRunning batch with cudagraph_mode:\s*(?:FULL|PIECEWISE)\b/i;

const MOONCAKE_PD_ERROR_RE =
  /Mooncake worker requires|Prefill TP size must be divisible by Decode TP size|MooncakeConnector\w*\b[^'\r\n]{0,40}\b(?:does not support|not supported|unsupported|failed|error|timeout|refused)|(?:ValueError|RuntimeError|AssertionError|ERROR)\b[^\r\n]*\bMooncakeConnector|\bmooncake\b(?![^\r\n]*kv_load_failure_policy)[^\r\n]{0,48}\b(?:failed|error|handshake\s+(?:failed|error|timeout)|refused|timeout)\b|\bRDMA\b[^\r\n]{0,30}\b(?:init\s+failed|register\s+failed|failed|error|timeout)\b/i;

const CASCADE_SIGNAL_PATTERNS: ReadonlyArray<{
  re?: RegExp;
  predicate?: (rawLine: string) => boolean;
  tag: string;
}> = [
  { re: /\bEI0006\b/i, tag: "HCCL EI0006" },
  { re: /\bHCCL_E_WAIT_TIMEOUT\b/i, tag: "HCCL_E_WAIT_TIMEOUT" },
  { re: /Notify wait execute timeout/i, tag: "Notify wait execute timeout" },
  { re: /Watchdog caught collective operation timeout/i, tag: "Watchdog collective timeout" },
  {
    predicate: isHcclTimeoutFaultLine,
    tag: "HCCL collective timeout",
  },
  { re: /EngineCore(?:Proc)?\b.{0,50}died unexpectedly/i, tag: "EngineCoreProc died unexpectedly" },
  { re: /\bBrokenPipeError\b|\bChildFailedError\b/i, tag: "BrokenPipe / ChildFailed" },
];

const PLOG_HARDWARE_FAULT_RE =
  /CheckSmmuFault:(?!.*isSmmuFault\s+is\s+0\b).*(?:isSmmuFault\s+is\s+[1-9]|failed|error|fault)|\bSMMU fault\b|MTE (?:accesses an invalid GM address|DDR address out of range)|retCode=0x0*[1-9a-f][0-9a-f]*|\baicore exception\b|AI Core kernel (?:task )?execution failed|(?:\berror code is|\bacl error|failed:)\s*(?:507015|507034|507035|161002|107030|207003)\b/i;

const PRIMARY_SIGNAL_PATTERNS: ReadonlyArray<{ re: RegExp; tag: string }> = [
  { re: /NPU out of memory|ACL_ERROR_RT_MEMORY_ALLOCATION/i, tag: "NPU HBM OOM" },
  {
    re: /Free memory on device\s*\(.+\)\s*on startup\s+is less than desired/i,
    tag: "init_snapshot 显存不足",
  },
  { re: /Error in memory profiling\.\s*Initial free memory/i, tag: "memory_profiling 显存漂移" },
  { re: /\b(?:EZ9999|EZ3002|EZ3003|EL0004|EJ0001|EH9999|EZ1001)\b/i, tag: "CANN 算子/运行时错误码" },
  { re: /\bACL_ERROR_[A-Z0-9_]+\b/i, tag: "ACL 运行时错误" },
  {
    re: PLOG_HARDWARE_FAULT_RE,
    tag: "CANN plog / AI Core 硬件异常",
  },
  {
    re: /not in libopapi\.so|libopapi\.so\s*not found|Aicore kernel execute failed|\bAclNN_Parameter_Error\b|aclnn[A-Za-z0-9_]+.*failed/i,
    tag: "AI Core / aclnn 算子失败",
  },
  { re: /\bZMQError\s*:\s*Address already in use/i, tag: "ZMQ 端口占用冲突" },
  { re: /Check ascend device type failed|\bSOC_VERSION\b.*mismatch/i, tag: "SoC/Wheel 型号不匹配" },
  { re: /AscendFAImpl does not support ACL graph capture/i, tag: "FA3 + FULL_DECODE_ONLY 图捕获冲突" },
  { re: GQA_STATIC_C8_KV_RE, tag: "GQA + C8 缺少校准权重" },
  {
    re: MOONCAKE_PD_ERROR_RE,
    tag: "Mooncake / RDMA KV 传输异常",
  },
  { re: SLEEP_FRACTAL_NZ_ERROR_RE, tag: "Sleep 唤醒与 FRACTAL_NZ 冲突" },
  {
    re: /exit\s*code[:=\s]*137\b|exitcode[:=\s]*-9\b|\bSIGKILL\b|\bOOMKilled\b/i,
    tag: "OS SIGKILL (137 / -9)",
  },
  {
    re: /exit\s*code[:=\s]*139\b|exitcode[:=\s]*-11\b|\bSIGSEGV\b|Segmentation fault/i,
    tag: "OS SIGSEGV (139 / -11)",
  },
  { re: /\b(?:ValueError|AssertionError|NotImplementedError|KeyError)\s*:/, tag: "Python 硬异常" },
];

const GENERIC_RUNTIME_ERROR_RE = /\bRuntimeError\s*:/;

function classifyLineSignal(line: ParsedLogLine): ClassifiedSignal | null {
  if (!line.trimmed) return null;

  for (const { re, tag } of PRIMARY_SIGNAL_PATTERNS) {
    if (re.test(line.rawLine)) {
      return { ...line, kind: "root-cause", signalTag: tag };
    }
  }

  for (const { re, predicate, tag } of CASCADE_SIGNAL_PATTERNS) {
    if (predicate ? predicate(line.rawLine) : re?.test(line.rawLine)) {
      return { ...line, kind: "cascade", signalTag: tag };
    }
  }

  if (GENERIC_RUNTIME_ERROR_RE.test(line.rawLine)) {
    return { ...line, kind: "root-cause", signalTag: "RuntimeError" };
  }

  return null;
}

function compareSignalsChronologically(a: ClassifiedSignal, b: ClassifiedSignal): number {
  if (a.timestampMs !== null && b.timestampMs !== null && a.timestampMs !== b.timestampMs) {
    return a.timestampMs - b.timestampMs;
  }
  return a.lineNumber - b.lineNumber;
}

function toPrimaryEvidence(sig: ClassifiedSignal): PrimaryEvidenceLine {
  return {
    lineNumber: sig.lineNumber,
    rank: sig.rank,
    timestamp: sig.timestamp,
    rawLine: sig.rawLine.trim(),
    kind: sig.kind,
  };
}

function isSlotMappableSignal(sig: Pick<ParsedLogLine, "rank" | "rankSource">, anyHostTag: boolean): boolean {
  if (sig.rank === null || anyHostTag) return false;
  return (
    sig.rankSource === "explicit-rank" ||
    sig.rankSource === "worker-tp" ||
    sig.rankSource === "worker-ep" ||
    sig.rankSource === "local-rank"
  );
}

function classifyCascadeAgainstWinner(
  winner: ClassifiedSignal | null,
  cascade: ClassifiedSignal,
): "confirmed-after" | "earlier-than-primary" | "unverified-order" | "no-primary" {
  if (!winner || winner.rank === null) return "no-primary";
  if (cascade.rank === winner.rank) return "unverified-order";
  if (winner.timestampMs !== null && cascade.timestampMs !== null) {
    return cascade.timestampMs < winner.timestampMs ? "earlier-than-primary" : "confirmed-after";
  }
  return "unverified-order";
}

function buildFaultTimelineEvents(
  signals: readonly ClassifiedSignal[],
  winner: ClassifiedSignal | null,
  anyHostTag: boolean,
): FaultTimelineEvent[] {
  const sorted = [...signals].sort(compareSignalsChronologically);
  const compressed: FaultTimelineEvent[] = [];
  const seenRankRole = new Set<string>();
  let winnerEvent: FaultTimelineEvent | null = null;

  for (const sig of sorted) {
    let kind: FaultTimelineEventKind;
    if (sig.kind === "root-cause") {
      kind = "root-cause";
    } else {
      const rel = classifyCascadeAgainstWinner(winner, sig);
      kind =
        rel === "confirmed-after"
          ? "confirmed-cascade"
          : rel === "earlier-than-primary"
            ? "pre-existing-timeout"
            : "unattributed-cascade";
    }

    const evt: FaultTimelineEvent = {
      id: `evt-L${sig.lineNumber}-R${sig.rank ?? "na"}`,
      lineNumber: sig.lineNumber,
      timestamp: sig.timestamp,
      timestampMs: sig.timestampMs,
      rank: sig.rank,
      rankSource: sig.rankSource,
      slotMappable: isSlotMappableSignal(sig, anyHostTag),
      kind,
      signalTag: sig.signalTag,
      rawLine: sig.rawLine.trim(),
    };

    const isWinnerLine = Boolean(winner && sig.lineNumber === winner.lineNumber && sig.kind === "root-cause");
    if (isWinnerLine) {
      winnerEvent = evt;
    }

    // Compress repeated lines per (rank, kind) BEFORE applying the 16-event cap so early timeout spam never evicts a later root-cause
    const roleKey = `${sig.rankSource === "worker-dp-pp" ? `coord-${sig.lineNumber}` : (sig.rank ?? `line-${sig.lineNumber}`)}:${kind}`;
    if (seenRankRole.has(roleKey) && !isWinnerLine) continue;
    seenRankRole.add(roleKey);
    compressed.push(evt);
  }

  if (compressed.length <= 16) return compressed;
  const sliced = compressed.slice(0, 16);
  if (winnerEvent && !sliced.some((e) => e.lineNumber === winnerEvent!.lineNumber)) {
    sliced[sliced.length - 1] = winnerEvent;
    sliced.sort((a, b) => {
      if (a.timestampMs !== null && b.timestampMs !== null && a.timestampMs !== b.timestampMs) {
        return a.timestampMs - b.timestampMs;
      }
      return a.lineNumber - b.lineNumber;
    });
  }
  return sliced;
}

function computeFirstFaultVerdict(
  signals: readonly ClassifiedSignal[],
  anyHostTag = false,
): FirstFaultVerdict {
  const primaries = signals.filter((s) => s.kind === "root-cause").sort(compareSignalsChronologically);
  const cascades = signals.filter((s) => s.kind === "cascade").sort(compareSignalsChronologically);

  if (primaries.length === 0 && cascades.length === 0) {
    return {
      rank: null,
      confidence: "low",
      rationale: "当前输入未命中显式异常错误行（可能为纯 /metrics 快照或正常启动日志）。",
      primaryEvidenceLines: [],
      cascadeRanks: [],
      rankSource: null,
      hostTag: null,
      slotMappable: false,
      cascadeCausalState: "no-primary",
      timelineEvents: [],
    };
  }

  const rankedPrimaries = primaries.filter((s) => s.rank !== null);

  if (rankedPrimaries.length > 0) {
    const earliest = rankedPrimaries[0]!;
    const winnerRank = earliest.rank!;
    const otherPrimaryRanks = new Set(
      rankedPrimaries.filter((s) => s.rank !== winnerRank).map((s) => s.rank!),
    );
    const cascadeRankSet = new Set<number>();
    const unverifiedCascadeRankSet = new Set<number>();
    let hasEarlierCascade = false;
    let hasUnverifiedCascade = false;
    for (const c of cascades) {
      if (c.rank !== null && c.rank !== winnerRank) {
        const rel = classifyCascadeAgainstWinner(earliest, c);
        if (rel === "earlier-than-primary") {
          hasEarlierCascade = true;
        } else if (rel === "confirmed-after") {
          cascadeRankSet.add(c.rank);
        } else {
          hasUnverifiedCascade = true;
          unverifiedCascadeRankSet.add(c.rank);
        }
      }
    }
    const cascadeRanks = [...cascadeRankSet].sort((a, b) => a - b);
    const unverifiedRanks = [...unverifiedCascadeRankSet].sort((a, b) => a - b);

    const cascadeCausalState: CascadeCausalState = hasEarlierCascade
      ? "earlier-than-primary"
      : cascadeRanks.length > 0
        ? "confirmed-after"
        : hasUnverifiedCascade
          ? "unverified-order"
          : "confirmed-after";

    const slotMappable = isSlotMappableSignal(earliest, anyHostTag);
    const confidence: FirstFaultConfidence =
      !hasEarlierCascade &&
      !hasUnverifiedCascade &&
      slotMappable &&
      (otherPrimaryRanks.size === 0 || earliest.timestampMs !== null)
        ? "high"
        : "medium";

    const tsNote = earliest.timestamp ? `于 ${earliest.timestamp}` : "最早";
    const cascadeNote = hasEarlierCascade
      ? "；注意日志中存在时间更早的其他卡超时记录，不能将早发生的超时反推为本次晚发错误的结果，请核对完整时间线。"
      : cascadeRanks.length > 0
        ? `；Rank ${cascadeRanks.join(" / ")} 的集合通信超时或连带退出在时间上晚于首错卡，属于等待同步的次生症状。`
        : unverifiedRanks.length > 0
          ? `；另见 Rank ${unverifiedRanks.join(" / ")} 报等待超时，但缺少双端时间戳，先后因果待完整时间线确认。`
          : "；其余卡未见更早的主错误。";
    const scopeNote = !slotMappable
      ? "（标识来自设备号或多节点前缀，仅作逻辑卡参考，不直接等同单机物理槽位）"
      : "";

    const rationale = `锁定首错 Rank 为 Rank ${winnerRank}${scopeNote}（第 ${earliest.lineNumber} 行，${tsNote} 触发「${earliest.signalTag}」）${cascadeNote}`;

    const timelineEvents = buildFaultTimelineEvents(signals, earliest, anyHostTag);
    const sigByLine = new Map<number, ClassifiedSignal>();
    for (const s of signals) {
      if (!sigByLine.has(s.lineNumber)) sigByLine.set(s.lineNumber, s);
    }

    const seenEvidenceLines = new Set<number>();
    const evidencePool: ClassifiedSignal[] = [];
    const candidateSigs = [
      ...rankedPrimaries.slice(0, 4),
      ...primaries.slice(0, 4),
      ...timelineEvents
        .map((e) => sigByLine.get(e.lineNumber))
        .filter((x): x is ClassifiedSignal => Boolean(x)),
      ...cascades.slice(0, 4),
    ];
    for (const sig of candidateSigs) {
      if (seenEvidenceLines.has(sig.lineNumber)) continue;
      seenEvidenceLines.add(sig.lineNumber);
      evidencePool.push(sig);
      if (evidencePool.length >= 20) break;
    }

    return {
      rank: winnerRank,
      confidence,
      rationale,
      primaryEvidenceLines: evidencePool.map(toPrimaryEvidence),
      cascadeRanks,
      rankSource: earliest.rankSource,
      hostTag: earliest.hostTag,
      slotMappable,
      cascadeCausalState,
      timelineEvents,
    };
  }

  if (primaries.length > 0) {
    const earliest = primaries[0]!;
    const cascadeRanks = [
      ...new Set(cascades.map((c) => c.rank).filter((r): r is number => r !== null)),
    ].sort((a, b) => a - b);
    const timelineEvents = buildFaultTimelineEvents(signals, null, anyHostTag);
    const sigByLine = new Map<number, ClassifiedSignal>();
    for (const s of signals) {
      if (!sigByLine.has(s.lineNumber)) sigByLine.set(s.lineNumber, s);
    }
    const seenLines = new Set<number>();
    const pool: ClassifiedSignal[] = [];
    for (const s of [
      ...primaries.slice(0, 4),
      ...timelineEvents
        .map((e) => sigByLine.get(e.lineNumber))
        .filter((x): x is ClassifiedSignal => Boolean(x)),
      ...cascades.slice(0, 4),
    ]) {
      if (seenLines.has(s.lineNumber)) continue;
      seenLines.add(s.lineNumber);
      pool.push(s);
      if (pool.length >= 20) break;
    }
    return {
      rank: null,
      confidence: "medium",
      rationale: `已检出主故障信号「${earliest.signalTag}」（第 ${earliest.lineNumber} 行），但该行缺少 Rank / Device 编号前缀；若为多卡部署，请补采带 Rank 标识的 worker 日志与 CANN plog 以确认首错卡。`,
      primaryEvidenceLines: pool.map(toPrimaryEvidence),
      cascadeRanks,
      rankSource: null,
      hostTag: earliest.hostTag,
      slotMappable: false,
      cascadeCausalState: "no-primary",
      timelineEvents,
    };
  }

  const cascadeRanks = [...new Set(cascades.map((c) => c.rank).filter((r): r is number => r !== null))].sort(
    (a, b) => a - b,
  );
  const timelineEvents = buildFaultTimelineEvents(signals, null, anyHostTag);
  const sigByLine = new Map<number, ClassifiedSignal>();
  for (const s of signals) {
    if (!sigByLine.has(s.lineNumber)) sigByLine.set(s.lineNumber, s);
  }
  const seenPure = new Set<number>();
  const purePool: ClassifiedSignal[] = [];
  for (const s of [
    ...timelineEvents
      .map((e) => sigByLine.get(e.lineNumber))
      .filter((x): x is ClassifiedSignal => Boolean(x)),
    ...cascades.slice(0, 6),
  ]) {
    if (seenPure.has(s.lineNumber)) continue;
    seenPure.add(s.lineNumber);
    purePool.push(s);
    if (purePool.length >= 20) break;
  }

  return {
    rank: null,
    confidence: "low",
    rationale: `仅观测到次生超时/连带退出信号（${cascades[0]!.signalTag}${cascadeRanks.length > 0 ? `，涉及 Rank ${cascadeRanks.join(" / ")}` : ""}），日志片段中缺少主故障卡的前序报错。切勿将 Rank 0 或最后一条 EI0006 当作根因，请补采全部参与 Rank 的同期前序日志与 CANN plog。`,
    primaryEvidenceLines: purePool.map(toPrimaryEvidence),
    cascadeRanks,
    rankSource: null,
    hostTag: null,
    slotMappable: false,
    cascadeCausalState: "no-primary",
    timelineEvents,
  };
}

function toMatched(line: ParsedLogLine): MatchedLogLine {
  return {
    lineNumber: line.lineNumber,
    rank: line.rank,
    timestamp: line.timestamp,
    rawLine: line.rawLine.trim(),
  };
}

function collectMatches(
  lines: readonly ParsedLogLine[],
  re: RegExp,
  limit = 4,
  exclude?: RegExp,
): MatchedLogLine[] {
  const out: MatchedLogLine[] = [];
  for (const line of lines) {
    if (exclude?.test(line.rawLine)) continue;
    if (re.test(line.rawLine)) {
      out.push(toMatched(line));
      if (out.length >= limit) break;
    }
  }
  return out;
}

function collectMatchesByPredicate(
  lines: readonly ParsedLogLine[],
  predicate: (rawLine: string) => boolean,
  limit = 4,
): MatchedLogLine[] {
  const out: MatchedLogLine[] = [];
  for (const line of lines) {
    if (predicate(line.rawLine)) {
      out.push(toMatched(line));
      if (out.length >= limit) break;
    }
  }
  return out;
}

const COLD_START_OOM_STAGE_RE =
  /\b(?:in\s+load_model|load_model\s*\(|in\s+load_weights|load_weights\b|during\s+load_weights|in\s+profile_run|profile_run\s*\(|in\s+determine_available_memory|determine_available_memory\s*\(|in\s+_dummy_run|Loading\s+safetensors|default_loader\.py|weight_utils\.py)/i;

const POST_KV_CAPTURE_STACK_RE =
  /\b(?:in\s+capture_model|capture_model\s*\(|in\s+compile_or_warm_up_model|compile_or_warm_up_model\s*\(|while\s+capturing\s+(?:acl|cuda|npu)?graph|during\s+(?:capture_model|graph\s+captur|aclgraph\s+pool|npugraph\s+pool)|aclgraph\s+pool\s+init|acl_graph\.py|npu_graph\.py|cudagraph_dispatcher\.py|in\s+initialize_cache|initialize_cache\s*\(|capturing\s+(?:cuda|acl|npu)graph|graph\s+captur(?:e|ing)\s+(?:failed|oom|error|batch))/i;

const POST_KV_MILESTONE_RE =
  /Available KV cache memory:\s*[\d.]+\s*(?:GiB|GB|MiB)|(?:NPU|GPU)\s+KV cache size:\s*[\d,]+\s*tokens|Entering\s+compile_or_warm_up_model|Graph capturing finished/i;

function hasExplicitScopeMatch(oomLine: ParsedLogLine, candidate: ParsedLogLine): boolean {
  if (oomLine.pid !== null) {
    if (candidate.pid !== null) return oomLine.pid === candidate.pid;
    return oomLine.rank !== null && candidate.rank !== null && oomLine.rank === candidate.rank;
  }
  if (oomLine.rank !== null) {
    if (candidate.pid !== null) return false;
    return candidate.rank !== null && oomLine.rank === candidate.rank;
  }
  return candidate.pid === null && candidate.rank === null;
}

function isContiguousStackFrameForOom(
  lines: readonly ParsedLogLine[],
  oomIdx: number,
  candIdx: number,
): boolean {
  const oomLine = lines[oomIdx]!;
  const candidate = lines[candIdx]!;
  if (hasExplicitScopeMatch(oomLine, candidate)) return true;
  if (candidate.pid !== null || candidate.rank !== null) return false;
  // Unlabelled stack frame (`  File ... in capture_model`) may pair with a scoped OOM ONLY if
  // original line numbers are strictly contiguous (no omission gap) and no conflicting process lies between them.
  const idxSpan = Math.abs(candIdx - oomIdx);
  const lineSpan = Math.abs(candidate.lineNumber - oomLine.lineNumber);
  if (lineSpan !== idxSpan) return false;
  const lo = Math.min(oomIdx, candIdx);
  const hi = Math.max(oomIdx, candIdx);
  for (let k = lo + 1; k < hi; k += 1) {
    const mid = lines[k]!;
    if (mid.pid !== null && oomLine.pid !== null && mid.pid !== oomLine.pid) return false;
    if (mid.rank !== null && oomLine.rank !== null && mid.rank !== oomLine.rank) return false;
  }
  return true;
}

function isPostKvOomStage(
  lines: readonly ParsedLogLine[],
  oomMatches: readonly MatchedLogLine[],
  verdictRank: number | null,
): boolean {
  const targetMatch =
    (verdictRank !== null ? oomMatches.find((m) => m.rank === verdictRank) : undefined) ?? oomMatches[0];
  if (!targetMatch) return false;
  const oomIdx = lines.findIndex((l) => l.lineNumber === targetMatch.lineNumber);
  if (oomIdx < 0) return false;
  const oomLine = lines[oomIdx]!;

  // 1. Inspect the OOM line and its immediate stack/context window measured in ORIGINAL line numbers (<= 20 lines)
  const winStart = Math.max(0, oomIdx - 20);
  const winEnd = Math.min(lines.length - 1, oomIdx + 20);
  let minPostDist = Number.POSITIVE_INFINITY;
  let minColdDist = Number.POSITIVE_INFINITY;
  for (let i = winStart; i <= winEnd; i += 1) {
    const candidate = lines[i]!;
    const lineDist = Math.abs(candidate.lineNumber - oomLine.lineNumber);
    if (lineDist > 20) continue;
    if (!isContiguousStackFrameForOom(lines, oomIdx, i)) continue;
    if (POST_KV_CAPTURE_STACK_RE.test(candidate.rawLine)) {
      minPostDist = Math.min(minPostDist, lineDist);
    }
    if (COLD_START_OOM_STAGE_RE.test(candidate.rawLine)) {
      minColdDist = Math.min(minColdDist, lineDist);
    }
  }
  if (minPostDist !== Number.POSITIVE_INFINITY || minColdDist !== Number.POSITIVE_INFINITY) {
    return minPostDist < minColdDist;
  }

  // 2. Fallback: scan backwards in strictly matching process/rank scope; stop false if a cold-start stage precedes OOM without a later KV milestone
  for (let i = oomIdx - 1; i >= 0; i -= 1) {
    const candidate = lines[i]!;
    if (!hasExplicitScopeMatch(oomLine, candidate)) continue;
    if (POST_KV_MILESTONE_RE.test(candidate.rawLine)) return true;
    if (COLD_START_OOM_STAGE_RE.test(candidate.rawLine)) return false;
  }
  return false;
}

const VLLM_ASCEND_V030 = "vllm-ascend@c09d3e20";
const VLLM_V030 = "vllm@ced6857a";

function evaluateRules(
  lines: readonly ParsedLogLine[],
  metrics: ParsedMetricsSnapshot,
  verdict: FirstFaultVerdict,
): LogDiagnosisFinding[] {
  const findings: LogDiagnosisFinding[] = [];

  // Rule 1: Pre-profiling init_snapshot free memory < requested_memory
  const r1Matches = collectMatches(
    lines,
    /Free memory on device\s*\(.+\)\s*on startup\s+is less than desired|Error in memory profiling\.\s*Initial free memory/i,
  );
  if (r1Matches.length > 0) {
    const isProfilingDrift = /Error in memory profiling/i.test(r1Matches[0]!.rawLine);
    findings.push({
      ruleId: "pre-profile-free-memory",
      title: isProfilingDrift
        ? "显存探测期间同卡并发进程释放导致快照失真（AssertionError）"
        : "启动前预检失败：init_snapshot 空闲显存低于 requested_memory（u × 总显存）",
      severity: "error",
      category: "memory",
      evidenceLevel: "C",
      summary: isProfilingDrift
        ? "determine_available_memory() 检测到试跑后空闲显存反而高于初始快照，说明同一 NPU 上存在其他进程在启动探测期间释放或抢占显存。"
        : "NPUWorker 在加载模型与探测前即触发硬校验：当前设备实际空闲显存 < total_memory × gpu_memory_utilization，直接抛出 ValueError 中止启动。",
      mechanism:
        "worker.py 先拍摄 init_snapshot，并按 requested_memory = total_memory × gpu_memory_utilization 校验 free_memory >= requested_memory。残留僵尸进程、同卡多实例混布或 u 设定过高都会在进入权重加载前即报错。",
      matchedLines: r1Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L461-L473`,
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L625-L633`,
      ],
      nextEvidenceCmd: "npu-smi info && ps -ef | grep -E 'vllm|python' | grep -v grep",
      experimentStep:
        "先用 npu-smi info 确认目标 NPU 无残留进程占用 HBM；若是刻意同卡混布，将 --gpu-memory-utilization 降到低于 (free / total) 后复测，观察是否越过 init_snapshot 进入权重加载。",
      wikiPageIds: ["npu-worker-lifecycle", "kv-cache-memory-profiling", "device-memory"],
    });
  }

  // Rule 2: Cold-start weight/profiling OOM vs post-KV ACLGraph capture OOM
  const r2Matches = collectMatches(
    lines,
    /NPU out of memory|ACL_ERROR_RT_MEMORY_ALLOCATION|OutOfMemoryError/i,
  );
  if (r2Matches.length > 0) {
    const postKvContext = isPostKvOomStage(lines, r2Matches, verdict.rank);
    findings.push({
      ruleId: "oom-stage-split",
      title: postKvContext
        ? "KV 池建立后的图捕获 / 预热期 OOM（u 偏高挤干 1 - u 图池余量）"
        : "冷启动权重加载 / 试跑探测期 NPU HBM OOM",
      severity: "error",
      category: "memory",
      evidenceLevel: "C",
      summary: postKvContext
        ? "模型权重与 KV Cache 池已分配完成，但在 compile_or_warm_up_model() / capture_model() 阶段 HBM 耗尽——典型原因是 gpu_memory_utilization (u) 设得过高，把 1 - u 留给 ACLGraph 图池与 CANN 工作区的余量吃空。"
        : "NPU HBM 在权重加载（load_model）或试跑探测（profile_run）阶段即耗尽，尚未完成 KV 池切分。",
      mechanism: postKvContext
        ? "vLLM-Ascend 先在 determine_available_memory() 中把 requested_memory 扣除权重与试跑峰值后全部划给 KV Cache，随后才在 compile_or_warm_up_model() 执行 capture_model()；因此图池与 CANN 运行时额外缓冲只能落入剩余空间。u 越接近 1.0，图捕获越易 OOM。"
        : "权重显存 + HCCL 通信域常驻缓冲 + max_num_batched_tokens 试跑激活峰值已超过单卡可用 HBM，需要从 TP 切分、量化或收紧批处理/序列上限入手。",
      matchedLines: r2Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L599-L635`,
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L905-L928`,
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/model_runner_v1.py#L6607-L6618`,
        `${VLLM_ASCEND_V030}:vllm_ascend/device/device_op.py#L212-L224`,
      ],
      nextEvidenceCmd:
        "grep -nE 'Model loading took|Available KV cache memory|capture_model|NPU out of memory' vllm_serve.log",
      experimentStep: postKvContext
        ? "单项对照：先将 --gpu-memory-utilization 下调 0.07~0.08（例如 0.95 → 0.88 下调 0.07，或 910B3 真机 0.90 → 0.82 下调 0.08）或改用 worker 建议的 --kv-cache-memory；若立即可过 capture_model，即可确认是 1 - u 余量不足而非权重超限。"
        : "单项对照：先开启 --enforce-eager 并收紧 --max-model-len / --max-num-batched-tokens 复测；若在 load_model 即 OOM，需增大 TP 或改用 W8A8/W4A8 量化。",
      wikiPageIds: ["kv-cache-memory-profiling", "acl-graph", "device-memory"],
    });
  }

  // Rule 3: Multi-rank EI0006 / HCCL_E_WAIT_TIMEOUT with root-cause Rank vs pure network/HCCS timeout
  const r3Matches = collectMatchesByPredicate(lines, isHcclTimeoutFaultLine, 4);
  if (r3Matches.length > 0) {
    const causalState: CascadeCausalState =
      verdict.cascadeCausalState ?? (verdict.rank !== null ? "unverified-order" : "no-primary");
    const hasConfirmedAfter = verdict.rank !== null && causalState === "confirmed-after";
    const isEarlierTimeout = verdict.rank !== null && causalState === "earlier-than-primary";
    const isUnverifiedWithPrimary = verdict.rank !== null && causalState === "unverified-order";
    const cascadeLabel =
      verdict.cascadeRanks.length > 0 ? `Rank ${verdict.cascadeRanks.join("/")}` : "其余卡";

    findings.push({
      ruleId: "hccl-timeout-cascade",
      title: hasConfirmedAfter
        ? `集合通信连锁超时（EI0006）：Rank ${verdict.rank} 先出错，其余卡卡在 AllReduce 等待`
        : isEarlierTimeout
          ? `HCCL 集合通信超时早于 Rank ${verdict.rank} 报错：超时在前，需排查更早慢卡或链路`
          : isUnverifiedWithPrimary
            ? `集合通信超时伴随 Rank ${verdict.rank} 主报错（缺少完整时间戳，先后顺序待核实）`
            : "HCCL 集合通信超时（EI0006 / WAIT_TIMEOUT）：尚未见单卡主报错，需区分慢卡与链路故障",
      severity: "error",
      category: "distributed",
      evidenceLevel: hasConfirmedAfter ? "C" : "I",
      summary: hasConfirmedAfter
        ? `日志中 ${cascadeLabel} 报出 EI0006 / Notify wait execute timeout，且时间线上 Rank ${verdict.rank} 更早触发主故障；集合通信超时属于连带症状，修复目标在 Rank ${verdict.rank} 而非调大 HCCL 超时。`
        : isEarlierTimeout
          ? `当前日志虽包含 Rank ${verdict.rank} 的报错信号，但时间戳显示 EI0006 / 集合通信等待超时发生得更早；不能倒果为因把前序超时归咎于后续报错，需补齐超时时刻前的全卡日志或排查链路。`
          : isUnverifiedWithPrimary
            ? `日志同时包含 EI0006 集合通信超时与 Rank ${verdict.rank} 的单卡主报错，但关键行缺少可比对时间戳，尚不能单凭当前片段断言因果先后；建议优先修复 Rank ${verdict.rank} 的单卡报错并核对原日志时间轴。`
            : "当前日志仅见 HCCL 集合通信等待超时，缺少任一 Rank 的前序算子/OOM 报错；此时不能假定 Rank 0 是根因，也可能是未贴入的某张卡先卡死，或 HCCS/RoCE 链路不通。",
      mechanism:
        "集合通信（AllReduce / AllGather / AllToAll）要求通信组内全部 Rank 按相同顺序进入同步点；只要任意一张卡在算子执行、图捕获或显存分配时异常退出/停滞，其余正常卡就会一直等在 Notify wait 直至触发 EI0006（默认算子超时 1836s，platform.py 也会把 RPC 超时抬高至 3000s 避免误杀）。",
      matchedLines: r3Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/platform.py#L942-L951`,
        `${VLLM_ASCEND_V030}:vllm_ascend/utils.py#L1250-L1265`,
      ],
      nextEvidenceCmd:
        "grep -rnE 'ERROR|EZ9999|EI0006|out of memory' ~/ascend/log/debug/plog/ | sort -k2 | head -n 40 && hccn_tool -i 0 -link -g",
      experimentStep: hasConfirmedAfter
        ? `先按 Rank ${verdict.rank} 的主报错卡片执行修复并复测；不要通过调大 HCCL_EXEC_TIMEOUT 掩盖首错卡故障。`
        : isEarlierTimeout
          ? "1) 补齐超时时刻之前的全部参与 Rank 日志与 CANN plog 寻找真正最早停滞的进程；2) 用 hccn_tool / hccl_test 验证跨卡链路与网卡状态。"
          : isUnverifiedWithPrimary
            ? `1) 优先处理 Rank ${verdict.rank} 的主报错卡片并复测；2) 若复现仍超时，带完整时间戳导出全卡日志与 plog 核实先后顺序。`
            : "1) 补齐所有参与 Rank 的同期前序日志与 CANN plog 寻找最早 ERROR；2) 若所有 Rank 均无前序算子报错，用 hccn_tool / hccl_test 验证跨卡链路与网卡配置。",
      wikiPageIds: ["cann-hccl", "hccl-buffer", "collective-communication"],
    });
  }

  // Rule 4: Exit code 137 (SIGKILL — host DRAM / cgroup OOM or manual kill, NOT proof of NPU HBM OOM!)
  const r4Matches = collectMatches(
    lines,
    /exit\s*code[:=\s]*137\b|exitcode[:=\s]*-9\b|\bSIGKILL\b|\bOOMKilled\b|exit\s*code[:=\s]*139\b|exitcode[:=\s]*-11\b|\bSIGSEGV\b/i,
  );
  if (r4Matches.length > 0) {
    const isSigsegv = /139|-11|SIGSEGV|Segmentation fault/i.test(r4Matches.map((m) => m.rawLine).join(" "));
    const isSigkill = /137|-9|SIGKILL|OOMKilled/i.test(r4Matches.map((m) => m.rawLine).join(" "));
    if (isSigkill) {
      findings.push({
        ruleId: "exit-137-sigkill",
        title:
          "进程收到 SIGKILL（退出码 137 / -9）：指向主机 DRAM / 容器 cgroup OOM 或外部强杀，不能证明 NPU HBM OOM",
        severity: "error",
        category: "os-process",
        evidenceLevel: "C",
        summary:
          "137 = 128 + 9（SIGKILL），内核或容器平台强制终止了进程。不要仅凭退出码 137 盲目调低 --gpu-memory-utilization 或缩减 NPU KV Cache——优先查主机内存、容器 memory limit、/dev/shm 及 K8s/Docker OOMKilled 事件。",
        mechanism:
          "vLLM v1 进程管理层在子进程异常退出时记录 proc.exitcode（-9 对应 SIGKILL）。NPU 显存不足通常会由 torch_npu / CANN 抛出 Python RuntimeError，而主机/容器内存超限（如多进程并发加载权重、mmap/shm 不足或 cgroup 限额过紧）会直接触发 Linux OOM-Killer 发出 SIGKILL，导致日志突然截断。",
        matchedLines: r4Matches,
        sources: [`${VLLM_V030}:vllm/v1/engine/utils.py#L262-L285`],
        nextEvidenceCmd:
          "dmesg -T | grep -iE 'killed process|oom-killer' | tail -n 20 && cat /sys/fs/cgroup/memory.events 2>/dev/null; docker inspect --format='{{.State.OOMKilled}} {{.State.ExitCode}}' <container_id>",
        experimentStep:
          "核对 dmesg / cgroup oom_kill 计数与容器 OOMKilled 标志：若为宿主机/容器 DRAM OOM，增大容器内存上限、调大 /dev/shm 或降低 CPU 并行加载并发；若 oom_kill=0，则排查平台探针超时（livenessProbe）或人为 kill。",
        wikiPageIds: ["device-memory", "npu-worker-lifecycle", "ascend-env-and-serve"],
      });
    } else if (isSigsegv) {
      findings.push({
        ruleId: "exit-139-sigsegv",
        title: "进程触发 SIGSEGV 段错误（退出码 139 / -11）：原生扩展、CANN 驱动或算子 ABI 异常",
        severity: "error",
        category: "os-process",
        evidenceLevel: "C",
        summary:
          "子进程因非法内存访问崩溃（exitcode -11 / 139），常见于 CANN / torch_npu / vllm-ascend 二进制版本不匹配或自定义算子越界。",
        mechanism:
          "原生 C++/ACL 扩展发生段错误会直接终止 worker 进程并导致父进程报 EngineCoreProc died unexpectedly。",
        matchedLines: r4Matches,
        sources: [`${VLLM_V030}:vllm/v1/engine/utils.py#L262-L285`],
        nextEvidenceCmd:
          "python -c 'import torch, torch_npu, vllm, vllm_ascend; print(torch.__version__, torch_npu.__version__, vllm.__version__, vllm_ascend.__file__)' && cat /usr/local/Ascend/ascend-toolkit/latest/version.cfg",
        experimentStep:
          "先核对 CANN / torch_npu / vllm-ascend 版本矩阵并开启 --enforce-eager 最小启动复现，隔离是图捕获路径还是基础算子库 ABI 冲突。",
        wikiPageIds: ["ascend-env-and-serve", "npu-worker-lifecycle"],
      });
    }
  }

  // Rule 5: SoC / wheel mismatch or 310P BF16 / GQA + C8 uncalibrated checkpoint ValueError
  const r5Matches = collectMatches(
    lines,
    new RegExp(
      `Check ascend device type failed|\\bSOC_VERSION\\b|Ascend310P.*bfloat16|bfloat16.*(?:310P|not supported)|${GQA_STATIC_C8_KV_RE.source}|AscendModelSlimConfig310|FP8.*310P`,
      "i",
    ),
  );
  if (r5Matches.length > 0) {
    const joined = r5Matches.map((m) => m.rawLine).join(" ");
    const isGqaC8 = GQA_STATIC_C8_KV_RE.test(joined) || /enable_c8_quant/i.test(joined);
    const is310p = /310P|bfloat16|AscendModelSlimConfig310/i.test(joined);
    findings.push({
      ruleId: "soc-310p-or-c8-compat",
      title: isGqaC8
        ? "GQA + C8 KV 量化（--kv-cache-dtype int8）缺少静态校准权重（ValueError）"
        : is310p
          ? "Atlas 300I DUO (310P) 精度/量化后端不兼容（不支持 BF16 或原生 FP8）"
          : "昇腾 SoC 型号与安装包 / SOC_VERSION 编译目标不匹配",
      severity: "error",
      category: "compatibility",
      evidenceLevel: "C",
      summary: isGqaC8
        ? "attention_v1.py:583 对标准 GQA 模型的 C8 KV Cache 采用离线静态量化，若未传入包含 C8 KV scale 的 ModelSlim 权重（enable_c8_quant=True），模型初始化阶段即抛出 ValueError（独立且早于 Mooncake 传输校验）。"
        : is310p
          ? "Ascend 310P 走 COMPATIBILITY 硬件档位，仅支持 FP16 与 AscendModelSlimConfig310，不支持 BF16 与标准 AscendFp8Config。"
          : "当前运行设备的 SoC 型号与 vllm-ascend 编译产物（SOC_VERSION）或所选硬件档位不一致。",
      mechanism: isGqaC8
        ? "vllm_ascend/attention/attention_v1.py#L571-L586（第 583 行）校验：当普通 GQA 的 kv_cache_dtype 非 FP16/BF16/FP32 且非 MXFP8 时，要求 quant_config.enable_c8_quant 为 True，否则直接拒绝启动。"
        : "vllm_ascend/device/hardware_profile.py 将 Ascend310P 路由到 COMPATIBILITY 档位（强制 FRACTAL_NZ、不注册 AscendFp8Config）；若启动命令携带 BF16 或错装了 A2/A3 wheel，会在设备识别或权重加载阶段直接失败。",
      matchedLines: r5Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/device/hardware_profile.py#L310-L332`,
        `${VLLM_ASCEND_V030}:vllm_ascend/attention/attention_v1.py#L571-L586`,
        `${VLLM_ASCEND_V030}:vllm_ascend/utils.py#L58-L62`,
      ],
      nextEvidenceCmd:
        "npu-smi info -t board -i 0 && python -c 'import torch_npu; print(torch_npu.npu.get_device_name(0))'",
      experimentStep: isGqaC8
        ? "移除 --kv-cache-dtype int8 回归默认 BF16/FP16 KV Cache 复测，或换用带 quant_model_description.json C8 KV 校准参数的 ModelSlim 权重并指定 --quantization ascend。"
        : is310p
          ? "在 310P 上显式添加 --dtype float16（避免 BF16）；若需量化，使用 ModelSlim INT8 权重配 --quantization ascend。"
          : "核对 npu-smi 芯片型号与 wheel 的 SOC_VERSION，重新安装对应芯片族的 vllm-ascend 包后最小启动复测。",
      wikiPageIds: isGqaC8
        ? ["kv-cache-quantization", "quantization", "kv-cache-spec"]
        : ["hardware-devices", "quantization", "kv-cache-quantization"],
    });
  }

  // Rule 6: NPUGRAPH_EX / ACLGraph capture failure (FA3 + FULL_DECODE_ONLY, dynamic op fallback)
  const r6Matches = collectMatches(
    lines,
    /AscendFAImpl does not support ACL graph capture|npugraph_ex is not supported|capture_model.*(?:fail|error)|aclgraph.*(?:fail|error|fallback)|FULL_DECODE_ONLY.*(?:not support|fail)/i,
  );
  if (r6Matches.length > 0) {
    const isFa3Conflict = /AscendFAImpl does not support ACL graph capture|FULL_DECODE_ONLY/i.test(
      r6Matches.map((m) => m.rawLine).join(" "),
    );
    findings.push({
      ruleId: "graph-capture-failure",
      title: isFa3Conflict
        ? "ACLGraph 图捕获冲突：FA3（AscendFAImpl）不支持 FULL_DECODE_ONLY 图模式"
        : "ACLGraph / NPUGRAPH_EX 图捕获失败或硬件不支持导致回退",
      severity: isFa3Conflict ? "error" : "warn",
      category: "graph",
      evidenceLevel: "C",
      summary: isFa3Conflict
        ? "fa3_v1.py 明确禁止在非 eager 下与 CUDAGraphMode.FULL_DECODE_ONLY 组合，初始化即抛 ValueError。"
        : "图捕获阶段出现算子不支持、动态形状冲突或硬件能力不含 NPUGRAPH_EX 导致静默关闭/失败。",
      mechanism:
        "vllm_ascend/attention/fa3_v1.py 对 FA3 校验 cudagraph_mode != FULL_DECODE_ONLY；ascend_config.py 则根据 HardwareCapability.NPUGRAPH_EX 决定是否降级关闭 npugraph_ex / static_kernel / super_kernel。",
      matchedLines: r6Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/attention/fa3_v1.py#L50-L60`,
        `${VLLM_ASCEND_V030}:vllm_ascend/ascend_config.py#L145-L163`,
      ],
      nextEvidenceCmd:
        "grep -nE 'cudagraph_mode|npugraph_ex|enforce_eager|AscendFAImpl|capture_model' vllm_serve.log",
      experimentStep: isFa3Conflict
        ? "二选一对照：改用默认 FIA 注意力后端（推荐，保留 FULL_DECODE_ONLY 图加速），或保留 FA3 时改为 PIECEWISE / --enforce-eager 复测。"
        : "先临时加 --enforce-eager 验证同输入是否可正常跑通；若 eager 正常而图路径失败，再缩小到具体图模式（PIECEWISE vs FULL_DECODE_ONLY）或关闭 npugraph_ex 排查不兼容算子。",
      wikiPageIds: ["acl-graph", "npugraph-ex", "ascend-flash-attention"],
    });
  }

  // Rule 7: /metrics KV cache usage > 95% + rising preemptions + waiting > 0
  if (metrics.hasMetrics && metrics.kvCacheUsageRatio !== undefined && metrics.kvCacheUsageRatio > 0.95) {
    const waiting = metrics.numRequestsWaiting ?? 0;
    const preemptions = metrics.numPreemptionsTotal ?? 0;
    const isStorm = preemptions > 0 && waiting > 0;
    const kvPct = (metrics.kvCacheUsageRatio * 100).toFixed(1);
    const metricLines = collectMatches(
      lines,
      /vllm:(?:kv_cache_usage_perc|gpu_cache_usage_perc|num_preemptions|num_requests_waiting)\b/,
      5,
    );
    findings.push({
      ruleId: "metrics-kv-preemption-storm",
      title: isStorm
        ? `KV Cache 池打满与抢占风暴（KV ${kvPct}% · 抢占 ${preemptions} 次 · 排队 ${waiting} 条）`
        : `KV Cache 水位逼近上限（${kvPct}%），存在随时触发抢占重算的高风险`,
      severity: isStorm ? "error" : "warn",
      category: "metrics",
      evidenceLevel: "D",
      summary: isStorm
        ? `vllm:kv_cache_usage_perc 达到 ${kvPct}%（> 95%），且伴随 vllm:num_preemptions=${preemptions} 与 vllm:num_requests_waiting=${waiting}，说明空闲物理 KV 块已枯竭，调度器正在反复驱逐并重算在途请求，导致 ITL / TPOT 剧烈抖动。`
        : `vllm:kv_cache_usage_perc 已达 ${kvPct}%（> 95%），当前随时会因并发或上下文略微增长触发调度抢占（preemption）。`,
      mechanism:
        "PagedAttention 将序列 KV 分配到固定大小的物理块池中；当活跃请求的序列总长度逼近总块数上限时，vLLM 调度器会挂起新请求（num_requests_waiting 上升）并抢占已运行请求的 KV 块（num_preemptions 递增），待释放后再重算整个前缀，形成正反馈抖动。",
      matchedLines: metricLines,
      sources: [
        `${VLLM_V030}:vllm/v1/metrics/loggers.py#L508-L517`,
        `${VLLM_V030}:vllm/v1/metrics/loggers.py#L566-L572`,
        `${VLLM_V030}:vllm/v1/metrics/loggers.py#L666-L672`,
      ],
      nextEvidenceCmd:
        "curl -s http://127.0.0.1:8000/metrics | grep -E 'vllm:(kv_cache_usage_perc|num_requests_running|num_requests_waiting|num_preemptions)'",
      experimentStep:
        "优先控制并发上限（降低 --max-num-seqs 或收紧 --max-model-len）或在显存余量允许时适度提高可用 KV 池（调整 --gpu-memory-utilization / 启用 KV 量化 / 扩容实例），观察 num_preemptions 增量是否归零且 ITL 尖峰消失。",
      wikiPageIds: ["kv-cache", "paged-attention", "continuous-batching", "core-cli-params"],
    });
  }

  // Rule 8: /metrics low KV usage & 0 waiting, yet high ITL or TTFT (Prefill vs Decode bottleneck)
  if (
    metrics.hasMetrics &&
    (metrics.kvCacheUsageRatio === undefined || metrics.kvCacheUsageRatio < 0.65) &&
    (metrics.numRequestsWaiting === undefined || metrics.numRequestsWaiting === 0)
  ) {
    const highItl = metrics.itlAvgSec !== undefined && metrics.itlAvgSec >= 0.08;
    const highTtft = metrics.ttftAvgSec !== undefined && metrics.ttftAvgSec >= 1.5;
    if (highItl || highTtft) {
      const kvPct =
        metrics.kvCacheUsageRatio !== undefined
          ? `${(metrics.kvCacheUsageRatio * 100).toFixed(1)}%`
          : "低水位";
      const ttftLabel =
        metrics.ttftAvgSec !== undefined ? `${(metrics.ttftAvgSec * 1000).toFixed(0)} ms` : "未采到";
      const itlLabel =
        metrics.itlAvgSec !== undefined ? `${(metrics.itlAvgSec * 1000).toFixed(1)} ms/tok` : "未采到";
      const bottleneckLabel =
        highTtft && !highItl
          ? "Prefill 计算 / 分块预算瓶颈（高 TTFT，正常 ITL）"
          : highItl && !highTtft
            ? "Decode Host 调度空泡 / HBM 带宽瓶颈（低 KV 零排队，但高 ITL）"
            : "Prefill 与 Decode 双阶段延迟均偏高（计算/下发或长输入阻塞）";

      const metricLines = collectMatches(
        lines,
        /vllm:(?:kv_cache_usage_perc|num_requests_waiting|inter_token_latency_seconds|time_to_first_token_seconds)/,
        5,
      );
      findings.push({
        ruleId: "metrics-low-kv-high-latency",
        title: `低 KV 零排队但延迟偏高：${bottleneckLabel}`,
        severity: "warn",
        category: "metrics",
        evidenceLevel: "D",
        summary: `KV 使用率仅 ${kvPct} 且 num_requests_waiting=0（排除队列积压与 KV 抢占），但平均 TTFT=${ttftLabel}、ITL=${itlLabel}。${
          highItl && !highTtft
            ? "重点排查是否误开 --enforce-eager 导致 Host 逐算子下发空泡、小 batch HBM 权重搬运受限或 TP 跨卡通信拖尾。"
            : highTtft && !highItl
              ? "重点排查长 prompt 计算量过大、chunked-prefill 单轮 token 预算（max_num_batched_tokens）偏小或未命中 Prefix Cache。"
              : "需拆开 Prefill 与 Decode 两段核对图模式（ACLGraph）、chunk 预算与硬件 Roofline 算力/带宽上限。"
        }`,
        mechanism:
          "当 kv_cache_usage_perc 偏低且无排队请求时，延迟瓶颈不在容量与排队，而落在单步执行效率：TTFT 主要受 Prefill 算力/分块次数主导，ITL 主要受 Decode 阶段 Host 算子下发延迟（未开 ACLGraph）与 HBM 权重读取带宽主导。",
        matchedLines: metricLines,
        sources: [`${VLLM_V030}:vllm/v1/metrics/loggers.py#L811-L828`],
        nextEvidenceCmd:
          "curl -s http://127.0.0.1:8000/metrics | grep -E 'vllm:(time_to_first_token_seconds|inter_token_latency_seconds|kv_cache_usage_perc|num_requests_running)'",
        experimentStep:
          highItl && !highTtft
            ? "确认未误传 --enforce-eager 且已启用 ACLGraph（FULL_DECODE_ONLY / PIECEWISE），固定单条短输入复测 ITL 变化；对照 Panel B「Host 下发空泡」场景理解消泡机理。"
            : "固定同一长输入，分别对比默认与调大 --max-num-batched-tokens（以及开启 --enable-prefix-caching 冷热两次）对 TTFT 与 ITL 的影响。",
        wikiPageIds: ["roofline-and-metrics", "chunked-prefill", "acl-graph", "core-cli-params"],
      });
    }
  }

  // Rule 9: Mooncake / PD KV-transfer error
  const r9Matches = collectMatches(lines, MOONCAKE_PD_ERROR_RE);
  if (r9Matches.length > 0) {
    findings.push({
      ruleId: "mooncake-pd-transfer-error",
      title: "P/D 分离 KV 传输（Mooncake / RDMA）握手或角色/TP 整除校验异常",
      severity: "error",
      category: "kv-transfer",
      evidenceLevel: "C",
      summary:
        "检测到 MooncakeConnector 或 P/D 参数校验失败；典型诱因包括误传 kv_role='kv_both'（Mooncake 要求单端严格二选一 kv_producer / kv_consumer）、TP_P 不能被 TP_D 整除、双端网卡/metadata 不一致，或 GQA 叠加 C8 KV 量化。",
      mechanism:
        "mooncake/base_worker.py#L110-L120 强制要求单实例仅担任单一传输角色；VllmConfig 经 ascend_config.py#L879-L884 校验普通 PD 的 prefill_tp_size % decode_tp_size == 0 以完成 KV 头切片对齐；ascend_config.py#L1030-L1042 独立禁止 GQA 模型在普通 Mooncake 上直接开 C8 KV 量化。",
      matchedLines: r9Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake/base_worker.py#L110-L120`,
        `${VLLM_ASCEND_V030}:vllm_ascend/ascend_config.py#L879-L884`,
        `${VLLM_ASCEND_V030}:vllm_ascend/ascend_config.py#L1030-L1042`,
      ],
      nextEvidenceCmd:
        "grep -nE 'Mooncake|kv_transfer_config|kv_role|divisible|RDMA|metadata' prefill.log decode.log",
      experimentStep:
        "核对 P 端 kv_role='kv_producer'、D 端 kv_role='kv_consumer'（禁止 kv_both），确保 TP_P 为 TP_D 的整数倍且 D 端 PP=1，再验证 RoCE/HCCS 连通性。",
      wikiPageIds: ["pd-disaggregation", "mooncake-connector", "tensor-parallel"],
    });
  }

  // Rule 10: Sleep Mode wake_up() + FRACTAL_NZ weight layout conflict
  const r10Matches = collectMatches(lines, SLEEP_FRACTAL_NZ_ERROR_RE);
  if (r10Matches.length > 0) {
    findings.push({
      ruleId: "sleep-mode-fractal-nz-wakeup",
      title: "Sleep Mode 唤醒失败：weight_nz_mode 非零触发 wake_up() FRACTAL_NZ 守卫（ValueError）",
      severity: "error",
      category: "compatibility",
      evidenceLevel: "C",
      summary:
        "实例在 --enable-sleep-mode 下可执行 sleep() 卸载权重，但调用 wake_up() 时被 worker.py:279-286 拦截抛出 ValueError：即使普通 BF16 权重在默认 weight_nz_mode=1 下按 utils.py:373-386 并未转为 FRACTAL_NZ，只要配置值非零即会拒绝唤醒。",
      mechanism:
        "按 vllm_ascend/utils.py#L373-L386，普通 BF16/FP16 权重仅在 weight_nz_mode=2 时转换为 FRACTAL_NZ，默认 weight_nz_mode=1 并不转 NZ；但 vllm_ascend/worker/worker.py#L279-L286 在 wake_up() 中直接校验配置项 weight_nz_mode != 0，只要非零即抛 ValueError（防范依赖 NZ 的量化权重在 RL/重加载场景出现精度异常）。",
      matchedLines: r10Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L279-L286`,
        `${VLLM_ASCEND_V030}:vllm_ascend/utils.py#L373-L386`,
        `${VLLM_ASCEND_V030}:vllm_ascend/model_loader/rfork/safety.py#L9-L18`,
      ],
      nextEvidenceCmd:
        "grep -nE 'enable_sleep_mode|weight_nz_mode|FRACTAL_NZ|CaMem sleep|wake_up' vllm_serve.log",
      experimentStep:
        "启动参数追加 --additional-config '{\"weight_nz_mode\": 0}'（或开启 rl_config.enabled=true）后重新验证 sleep(1) -> wake_up() 闭环（BF16 模型由 mode=1 改 0 不影响常规算子布局；注意启用 Sleep 会使 RFork 回退默认加载）。",
      wikiPageIds: ["sleep-mode", "tensor-layout", "npu-worker-lifecycle", "device-memory"],
    });
  }

  // Rule 11: Mooncake ADXL endpoint fallback warning storm (Dest buffer device_id >= endpoint count)
  const r11Matches = collectMatches(lines, MOONCAKE_ADXL_FALLBACK_RE);
  if (r11Matches.length > 0) {
    const totalFallbackCount = lines.filter((l) => MOONCAKE_ADXL_FALLBACK_RE.test(l.rawLine)).length;
    findings.push({
      ruleId: "mooncake-adxl-endpoint-fallback",
      title: "Mooncake ADXL 多卡端点回退刷屏告警（Dest buffer device_id >= endpoint count）",
      severity: "warn",
      category: "kv-transfer",
      evidenceLevel: "C",
      summary: `Decode 端拉取远端 KV Cache 时，Mooncake ADXL（transfer_executor_base.cpp:64）因目的缓冲区 device_id 超出单会话暴露的直连 endpoint 数而触发回退刷屏（当前日志片段命中 ${totalFallbackCount} 行；Ascend 910B3 真机 2P2D / 4P4D 压测分别刷出 4,991 行与 19,941 行），放大主机 I/O 开销与首字延迟（TTFT）。`,
      mechanism:
        "vllm_ascend/distributed/kv_transfer/utils/mooncake_transfer_engine.py 初始化单进程 GlobalTE（ascend 协议），并在 mooncake_connector.py 中调用 batch_transfer_sync_read 批量拉取离散 KV 段（如 Qwen3-8B 单请求 3 块 × 36 层 × K/V = 216 段）。当多卡 TP/EP 下目的缓冲区的 device_id 大于或等于当前 ADXL endpoint count 时，底层逐段打印回退日志并改走回退端点，虽不中断推理但显著拖慢 P→D 交接。",
      matchedLines: r11Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/distributed/kv_transfer/utils/mooncake_transfer_engine.py#L11-L40`,
        `${VLLM_ASCEND_V030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L789-L835`,
        `${VLLM_ASCEND_V030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1040-L1058`,
      ],
      nextEvidenceCmd:
        "grep -c 'Dest buffer device_id' decode.log && grep -E 'KV cache transfer for request|Dest buffer device_id' decode.log | head -n 20",
      experimentStep:
        "1) 统计 decode.log 中该告警总行数与单请求 KV cache transfer 耗时，区分是万行日志刷屏开销还是跨卡传输慢；2) 核对双端 ASCEND_RT_VISIBLE_DEVICES、HCCN RoCE/HCCS 网卡端点映射与 Mooncake ADXL 配置；3) 若线上为均匀短输入且无长 Prefill 阻塞，对比单池混部 ACLGraph 吞吐与 TTFT 评估是否无需拆池。",
      wikiPageIds: ["mooncake-connector", "pd-disaggregation", "ascend-910b3-measured-baseline"],
    });
  }

  // Rule 12: VLLM_LOGGING_LEVEL=DEBUG per-step hot-path overhead inflating TTFT
  const r12Matches = collectMatches(lines, DEBUG_LOGGING_HOTPATH_RE);
  if (r12Matches.length > 0) {
    findings.push({
      ruleId: "debug-logging-hotpath-overhead",
      title: "开启 VLLM_LOGGING_LEVEL=DEBUG 触发每步热路径检查与日志刷屏，显著推高 TTFT",
      severity: "warn",
      category: "graph",
      evidenceLevel: "C",
      summary:
        "检测到服务处于 VLLM_LOGGING_LEVEL=DEBUG 调试日志模式（如 worker.py 每步打印 torch reserved/allocated memory 或热路径逐批刷屏）。在 Ascend 910B3 真机实测中，仅误留 DEBUG 日志即令 Qwen3-8B TP=8 (c=1) 首字延迟 TTFT 从 139.07 ms 劣化至 193.98 ms（+39.48%）。",
      mechanism:
        "开启 VLLM_LOGGING_LEVEL=DEBUG 会同时激活两处每步热路径 Host 开销：1) vllm_ascend/worker/worker.py#L762-L778 在每次 execute_model() 首行调用 log_memory_stats() 读取 PyTorch 缓存分配器计数（memory_reserved / memory_allocated，注意并非设备同步 mem_get_info）并格式化写日志（910B3 TP=8 压测刷出 3,312 行）；2) vllm_ascend/compilation/acl_graph.py#L275-L282 在每次 ACLGraph 回放前逐张量读取 x.data_ptr() 断言输入地址一致。",
      matchedLines: r12Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L762-L778`,
        `${VLLM_ASCEND_V030}:vllm_ascend/compilation/acl_graph.py#L275-L282`,
      ],
      nextEvidenceCmd:
        "grep -cE 'torch reserved memory:|Running batch with cudagraph_mode:' vllm_serve.log && tr '\\0' '\\n' < /proc/$(pgrep -f 'vllm' | head -n1)/environ 2>/dev/null | grep VLLM_LOGGING_LEVEL",
      experimentStep:
        "压测与生产上线前切回默认级别（export VLLM_LOGGING_LEVEL=INFO 或 unset VLLM_LOGGING_LEVEL），在相同输入长度与并发下复测 TTFT / TPOT，剔除调试日志引入的 Host 热路径税。",
      wikiPageIds: [
        "inference-performance-troubleshooting",
        "device-memory",
        "acl-graph",
        "ascend-910b3-measured-baseline",
      ],
    });
  }

  // Rule 13: CANN C++ plog / AI Core & AIV runtime fault codes (507015 / 507034 / 507035 / 107030 / 207003 / non-zero retCode / CheckSmmuFault)
  const r13Matches = collectMatches(
    lines,
    /CheckSmmuFault:(?!.*isSmmuFault\s+is\s+0\b).*(?:isSmmuFault\s+is\s+[1-9]|failed|error|fault)|\bSMMU fault\b|MTE (?:accesses an invalid GM address|DDR address out of range)|retCode=0x0*[1-9a-f][0-9a-f]*|\baicore exception\b|AI Core kernel (?:task )?execution failed|(?:\berror code is|\bacl error|failed:)\s*(?:507015|507034|507035|107030|207003)\b|\b(?:ACL_ERROR_RT_AICORE_EXCEPTION|ACL_ERROR_RT_AICORE_OVER_FLOW|ACL_ERROR_RT_CAPTURE_MODE_NOT_SUPPORT)\b/i,
  );
  if (r13Matches.length > 0) {
    const joined = r13Matches.map((m) => m.rawLine).join(" ");
    const isVecTimeout = /\b507034\b|vector\s+core\s+timeout/i.test(joined);
    const isOverflow = /\b207003\b|ACL_ERROR_RT_AICORE_OVER_FLOW/i.test(joined);
    const isVecOrLaunchFault =
      /\b507035\b/i.test(joined) && !/\b507015\b|CheckSmmuFault|\bSMMU fault\b/i.test(joined);
    const isCaptureUnsupported = /\b107030\b|CAPTURE_MODE_NOT_SUPPORT/i.test(joined);
    const kernelMatch = /fault\s+kernel_name\s*=\s*([A-Za-z0-9_]+)/i.exec(joined);
    const kernelLabel = kernelMatch?.[1] ? `（故障核函数 ${kernelMatch[1]}）` : "";
    const retCodeMatch = /retCode=(0x0*[1-9a-f][0-9a-f]*)/i.exec(joined);
    const retCodeBadge = retCodeMatch?.[1] ? ` / retCode=${retCodeMatch[1]}` : "";
    findings.push({
      ruleId: "cann-plog-aicore-fault",
      title: isVecTimeout
        ? "CANN 运行时 Vector Core 执行超时（error code 507034）"
        : isOverflow
          ? "CANN AI Core 算术溢出（207003 ACL_ERROR_RT_AICORE_OVER_FLOW）"
          : isVecOrLaunchFault
            ? `CANN Vector Core / 算子核函数执行异常（error code 507035）${kernelLabel}`
            : isCaptureUnsupported
              ? "CANN 图捕获流内混入不受支持操作（error code 107030）"
              : `CANN AI Core 硬件执行异常 / SMMU 访存越界（507015${retCodeBadge}）${kernelLabel}`,
      severity: "error",
      category: "graph",
      evidenceLevel: "C",
      summary: isVecTimeout
        ? "外层流同步报 507034（Vector Core AIV 超时），常见于超长序列单步计算超阈值，或开启 SP（FlashComm1）与共享专家多流重叠等特性时触发核间同步挂死。"
        : isOverflow
          ? "207003（ACL_ERROR_RT_AICORE_OVER_FLOW）属于 AI Core 浮点/量化算术溢出，常见于 FP16 权重/激活幅值越界或量化 Scale 校准异常，不等同于 507015 访存越界。"
          : isVecOrLaunchFault
            ? `外层报 507035（Vector Core 异常或算子核函数下发/执行异常）${kernelLabel}，常见于自定义/融合算子 Tiling 边界不满足、Workspace 失配或图捕获重放地址异常，需结合 plog 首错核函数定位。`
            : isCaptureUnsupported
              ? "107030（ACL_ERROR_RT_CAPTURE_MODE_NOT_SUPPORT）表明 ACLGraph 录图期间触发了主机侧同步或受限内存拷贝。"
              : `外层 AclrtSynchronizeStreamWithTimeout (507015 = ACL_ERROR_RT_AICORE_EXCEPTION)${retCodeBadge ? ` 或 plog ${retCodeBadge.slice(3)}` : ""} / CheckSmmuFault 表明设备侧核函数${kernelLabel}发生 GM/UB 地址越界或指令违例（如 W8A8 大模型图捕获越界、MLA/稀疏算子异常），需按 plog 首错核函数与图模式隔离。`,
      mechanism:
        "507015 只是主机侧同步设备流时收到的通用 AI Core 异步异常通知，真正故障现场记录在同一进程 PID 的 CANN plog（[DFX_INFO] fault kernel_name=... / CheckSmmuFault）中；排障时必须区分 507015（AI Core 异常/越界）、507034（AIV 超时）、507035（Vector/核函数异常）与 207003（算术溢出）。",
      matchedLines: r13Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/compilation/acl_graph.py#L181-L220`,
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L762-L778`,
      ],
      nextEvidenceCmd:
        "grep -rnE 'CheckSmmuFault|aicore exception|fault kernel_name|507015|507034|507035|207003|107030' ~/ascend/log/debug/plog/ | head -n 30",
      experimentStep: isVecTimeout
        ? "1) 先单变量关闭多流重叠或序列并行开关（如 multistream_overlap_shared_expert / enable_sp）复测是否解除挂死；2) 若为超长上下文，收敛单步 max_num_batched_tokens。"
        : isOverflow
          ? "优先改用 --dtype bfloat16（910B/A3 原生支持 BF16 动态范围）或核查量化权重 Scale 是否含 NaN/Inf。"
          : "1) 加 --enforce-eager 对照复现：若 eager 正常仅图模式崩，聚焦 ACLGraph 捕获档位与 W8A8 工作区越界；2) 若 eager 同样崩，按 plog 中的 fault kernel_name 核对 CANN 版本与模型输入边界。",
      wikiPageIds: ["inference-troubleshooting", "ai-core", "acl-graph"],
    });
  }

  // Rule 14: CANN libopapi.so missing symbol or aclnn 161002 / EZ1001 parameter error
  const r14ParamOrSymbolRe =
    /not in libopapi\.so|libopapi\.so\s*not found|\berror code is 161002\b|\bACLNN_ERR_PARAM_INVALID\b|\bAclNN_Parameter_Error\b|\bEZ1001\b/i;
  const r14RuntimeCodeRe =
    /\b(?:507015|507034|507035|107030|207003|ACL_ERROR_RT_AICORE_EXCEPTION|ACL_ERROR_RT_AICORE_OVER_FLOW|ACL_ERROR_RT_CAPTURE_MODE_NOT_SUPPORT)\b/i;
  const r14Matches = collectMatchesByPredicate(
    lines,
    (rawLine) => {
      if (r14ParamOrSymbolRe.test(rawLine)) return true;
      if (/aclnn[A-Za-z0-9_]+.*failed/i.test(rawLine) && !r14RuntimeCodeRe.test(rawLine)) {
        return true;
      }
      return false;
    },
    4,
  );
  if (r14Matches.length > 0) {
    const joined = r14Matches.map((m) => m.rawLine).join(" ");
    const isSymbolMissing = /libopapi\.so/i.test(joined);
    const isParamInvalid =
      /\b161002\b|\bACLNN_ERR_PARAM_INVALID\b|\bAclNN_Parameter_Error\b|\bEZ1001\b/i.test(joined);
    findings.push({
      ruleId: "cann-opapi-or-aclnn-fault",
      title: isSymbolMissing
        ? "CANN 算子库符号缺失（not in libopapi.so）：CANN 版本滞后或芯片族不支持该算子"
        : isParamInvalid
          ? "CANN aclnn 算子入参校验不合法（161002 ACLNN_ERR_PARAM_INVALID / EZ1001）"
          : "CANN aclnn 算子调用失败（需结合 aclGetRecentErrMsg 区分入参越界与核函数异常）",
      severity: "error",
      category: "compatibility",
      evidenceLevel: isSymbolMissing || isParamInvalid ? "C" : "I",
      summary: isSymbolMissing
        ? "运行时在 libopapi.so 中找不到目标 aclnn 算子入口（例如在 A3 上误调仅 A2 支持的算子，或容器内 CANN Toolkit 版本低于 vllm-ascend 编译基线）。"
        : isParamInvalid
          ? "aclnn 算子明确返回 161002（ACLNN_ERR_PARAM_INVALID）或 EZ1001 参数错误，表明传入张量的 dtype、维度对齐、步长或量化 Scale 格式违反该算子约束。"
          : "日志仅见 aclnn 算子调用报错但未贴出具体返回码；可能是 161002 入参规格越界，也可能是底层流执行异常，需结合紧邻错误码或 plog 进一步确认。",
      mechanism:
        "vllm-ascend 通过 torch_npu 与 op-plugin 动态解析 CANN libopapi.so 中的 aclnn 符号并在设备流下发；符号缺失属于环境/芯片能力门控失配，161002 / EZ1001 属于张量规格或量化配置越界。",
      matchedLines: r14Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/ops/register_custom_ops.py#L1-L20`,
        `${VLLM_ASCEND_V030}:vllm_ascend/device/hardware_profile.py#L310-L332`,
      ],
      nextEvidenceCmd:
        "cat /usr/local/Ascend/ascend-toolkit/latest/version.cfg && nm -D /usr/local/Ascend/ascend-toolkit/latest/lib64/libopapi.so 2>/dev/null | grep -i aclnn | head -n 20",
      experimentStep: isSymbolMissing
        ? "核对容器内 CANN 版本是否匹配 vllm-ascend 发布基线（如 v0.30.0 对应 CANN 9.1.0），并检查当前芯片（A2 vs A3 vs 310P）是否支持所启用的融合/投机特性。"
        : "抓取紧邻报错的 aclGetRecentErrMsg 明细与返回码，核对模型 head_dim、TP 整除关系与量化权重配置是否满足该 aclnn 算子要求。",
      wikiPageIds: ["inference-troubleshooting", "ascend-env-and-serve", "hardware-devices"],
    });
  }

  // Rule 15: ZMQError Address already in use (residual worker or multi-instance port collision)
  const r15Matches = collectMatches(
    lines,
    /\bZMQError\s*:\s*Address already in use|Address already in use[^\r\n]*tcp:\/\//i,
  );
  if (r15Matches.length > 0) {
    findings.push({
      ruleId: "zmq-port-conflict",
      title: "ZMQ 通信端口冲突（Address already in use）：残留进程占口或多实例端口撞车",
      severity: "error",
      category: "distributed",
      evidenceLevel: "C",
      summary:
        "Worker 或 EngineCore 绑定 ZMQ TCP 套接字时抛出 Address already in use（并常连带引发对端节点报 Gloo Connection closed by peer），主因是上次退出的残留进程未释放端口或同机多实例共用了默认端口。",
      mechanism:
        "vLLM 通过 make_zmq_socket() 在主机侧建立前端、EngineCore 与跨节点 DP/握手控制通道；任一节点 bind 失败退出后，对端 Gloo/HCCL 握手随即因连接断开连锁报错。",
      matchedLines: r15Matches,
      sources: [`${VLLM_V030}:vllm/utils/network_utils.py#L310-L368`],
      nextEvidenceCmd: "ss -ltnp | grep -E 'vllm|python|6000' || lsof -iTCP -sTCP:LISTEN -P -n | grep python",
      experimentStep:
        "先清理同机残留的 vllm / EngineCore / Worker 进程确认端口释放；若是同机拉起多实例或 P/D 双实例，显式错开 --port、--data-parallel-rpc-port 与 kv_transfer_config 通信端口。",
      wikiPageIds: ["inference-troubleshooting", "ascend-env-and-serve"],
    });
  }

  return findings;
}

export function analyzeTroubleshootInput(rawInput: string): LogAnalysisReport {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      inputKind: "empty",
      totalLines: 0,
      detectedRanks: [],
      visibleDevices: null,
      firstFaultVerdict: {
        rank: null,
        confidence: "low",
        rationale:
          "粘贴真实启动日志、多卡报错片段、CANN/HCCL 错误码或 Prometheus /metrics 快照即可开始分析。",
        primaryEvidenceLines: [],
        cascadeRanks: [],
      },
      metrics: { hasMetrics: false, rawMetricCount: 0 },
      findings: [],
      unmatchedErrorLines: [],
    };
  }

  const lines = parseLogLines(rawInput);
  const visibleDevices = extractVisibleDevicesFromLog(rawInput);
  const metrics = parsePrometheusMetrics(rawInput);
  const nonEmptyLines = lines.filter((l) => l.trimmed.length > 0);
  const nonMetricLines = nonEmptyLines.filter(
    (l) => !l.trimmed.startsWith("#") && !PROM_METRIC_LINE_RE.test(l.trimmed),
  );

  const inputKind: LogAnalysisReport["inputKind"] =
    metrics.hasMetrics && nonMetricLines.length === 0 ? "metrics" : metrics.hasMetrics ? "mixed" : "logs";

  const detectedRankSet = new Set<number>();
  const signals: ClassifiedSignal[] = [];

  for (const line of lines) {
    if (line.rank !== null) detectedRankSet.add(line.rank);
    const sig = classifyLineSignal(line);
    if (sig) signals.push(sig);
  }

  const anyHostTag = lines.some((l) => l.hostTag !== null);
  const firstFaultVerdict = computeFirstFaultVerdict(signals, anyHostTag);
  const findings = evaluateRules(lines, metrics, firstFaultVerdict);

  const matchedLineNumbers = new Set<number>();
  for (const f of findings) {
    for (const m of f.matchedLines) {
      matchedLineNumbers.add(m.lineNumber);
    }
  }

  const unmatchedErrorLines: MatchedLogLine[] = signals
    .filter((s) => !matchedLineNumbers.has(s.lineNumber))
    .slice(0, 6)
    .map(toMatched);

  return {
    inputKind,
    totalLines: nonEmptyLines.length,
    detectedRanks: [...detectedRankSet].sort((a, b) => a - b),
    visibleDevices,
    firstFaultVerdict,
    metrics,
    findings,
    unmatchedErrorLines,
  };
}
