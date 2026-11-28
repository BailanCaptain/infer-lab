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

export type FaultMechanism =
  | "link-bind-fault"
  | "link-route-fault"
  | "link-port-down"
  | "link-transport-init"
  | "link-peer-refused"
  | "link-establish-timeout"
  | "wait-cascade"
  | "graph-compile"
  | "moe-mc2"
  | "modelslim-quant"
  | "cann-device-env"
  | "memory-oom"
  | "aicore-runtime"
  | "other";

export type FaultPhase =
  | "device-init"
  | "comm-init"
  | "link-establish"
  | "graph-compile"
  | "collective-wait"
  | "runtime"
  | "unknown";

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
  faultMechanism?: "hccl-link" | "hccl-wait-cascade" | "general" | undefined;
  mechanism?: FaultMechanism | undefined;
  phase?: FaultPhase | undefined;
  peerRank?: number | null | undefined;
  iface?: string | null | undefined;
  port?: string | null | undefined;
  hostTag?: string | null | undefined;
  instanceTag?: string | null | undefined;
  groupTag?: string | null | undefined;
  ruleId?: string | undefined;
  evidenceLine?: number | undefined;
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
  instanceTag?: string | null | undefined;
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
  activeScopeDetectedRanks?: readonly number[] | undefined;
  visibleDevices?: readonly number[] | null | undefined;
  firstFaultVerdict: FirstFaultVerdict;
  metrics: ParsedMetricsSnapshot;
  findings: LogDiagnosisFinding[];
  unmatchedErrorLines: MatchedLogLine[];
}

interface ParsedLogLine {
  lineNumber: number;
  segmentId: number;
  rawLine: string;
  inspectLine: string;
  trimmed: string;
  rank: number | null;
  rankSource: RankSource | null;
  hostTag: string | null;
  instanceTag: string | null;
  groupTag: string | null;
  pid: number | null;
  timestamp: string | null;
  timestampMs: number | null;
  timestampSubMs: number;
  timestampKind: "full" | "short-date" | "time-only" | null;
  hasExplicitTimezone: boolean;
  inferredYearMatched: boolean;
  tracebackGroupId: number | null;
  ambiguousTraceback?: boolean;
  isPromLine?: boolean;
}

interface ClassifiedSignal extends ParsedLogLine {
  kind: EvidenceLineKind;
  signalTag: string;
  mechanism: FaultMechanism;
  phase: FaultPhase;
  peerRank: number | null;
  iface: string | null;
  port: string | null;
  ruleId?: string | undefined;
}

export interface AnalyzerScaleProbe {
  visCandidateScans: number;
  startupBoundarySteps: number;
  epochPoolScans: number;
  pidStateCompatibilityScans: number;
  cascadeCompetitorScans: number;
  domainPresenceLookups: number;
  buffClauseScans: number;
}

let activeScaleProbe: AnalyzerScaleProbe | null = null;

/** Runs a synchronous analysis block while counting hot-path inner-loop steps for deterministic scale regression testing. */
export function withAnalyzerScaleProbeForTest<T>(fn: (probe: AnalyzerScaleProbe) => T): T {
  const prev = activeScaleProbe;
  const probe: AnalyzerScaleProbe = {
    visCandidateScans: 0,
    startupBoundarySteps: 0,
    epochPoolScans: 0,
    pidStateCompatibilityScans: 0,
    cascadeCompetitorScans: 0,
    domainPresenceLookups: 0,
    buffClauseScans: 0,
  };
  activeScaleProbe = probe;
  try {
    return fn(probe);
  } finally {
    activeScaleProbe = prev;
  }
}

const QUOTED_STARTUP_COMPLETE_RE = /["'`]\s*Application startup complete\.?\s*["'`]/i;
const NON_MILESTONE_STARTUP_PHRASE_RE =
  /\b(?:waiting\s+(?:for|on)|awaiting|pending|expect(?:ing|ed)?|before|until|unless|no|without|missing|lack(?:s|ed|ing)?|absent|has\s+not|have\s+not|not(?:\s+yet|\s+still|\s+currently|\s+ever)?|never|did\s+not|didn'?t|failed\s+(?:before|to)|on\s+event|event\s+(?:of|is|named)?)\b[^\r\n]{0,64}\bApplication startup complete\b|\bApplication startup complete\.?(?:\s+(?:message|event|log|line|signal|notification|record))?\s*(?:[:=]\s*(?:false|0|no|null|none|fail(?:ed)?|pending|timeout|timed?\s*out|skipped|aborted|incomplete)\b|[([]?\s*(?:(?:is|was|were|has|have|had|can|could|will|would|did|do)(?:\s+been)?\s+)?\b(?:false|never\b|not\b|no\s+longer\b|yet\s+to\b|unreceived|unemitted|failed|timed?\s+out|pending|skipped|aborted|incomplete|missing|absent|(?:isn|aren|wasn|weren|hasn|haven|hadn|didn|won|wouldn|couldn|can)'?t\b|(?:message|event|log|line|signal)\s+(?:not\s+|never\s+|un)(?:received|emitted|logged|seen|sent))\b)/i;

function isActualAppStartupCompleteLine(inspectLine: string): boolean {
  if (!/\bApplication startup complete\b/i.test(inspectLine)) return false;
  if (QUOTED_STARTUP_COMPLETE_RE.test(inspectLine)) return false;
  if (NON_MILESTONE_STARTUP_PHRASE_RE.test(inspectLine)) return false;
  return true;
}

interface DomainPresenceIndex {
  count: number;
  byDom: Set<string>;
  byHostInst: Set<string>;
  byHostGrp: Set<string>;
  byInstGrp: Set<string>;
  byHost: Set<string>;
  byInst: Set<string>;
  byGrp: Set<string>;
}

function createDomainPresenceIndex(): DomainPresenceIndex {
  return {
    count: 0,
    byDom: new Set(),
    byHostInst: new Set(),
    byHostGrp: new Set(),
    byInstGrp: new Set(),
    byHost: new Set(),
    byInst: new Set(),
    byGrp: new Set(),
  };
}

function addToDomainPresenceIndex(
  idx: DomainPresenceIndex,
  dom: Pick<ParsedLogLine, "hostTag" | "instanceTag" | "groupTag">,
): void {
  const dh = (dom.hostTag ?? "").toLowerCase();
  const di = (dom.instanceTag ?? "").toLowerCase();
  const dg = (dom.groupTag ?? "").toLowerCase();
  const domKey = `${dh}\u0000${di}\u0000${dg}`;
  if (idx.byDom.has(domKey)) return;
  idx.count += 1;
  idx.byDom.add(domKey);
  idx.byHostInst.add(`${dh}\u0000${di}`);
  idx.byHostGrp.add(`${dh}\u0000${dg}`);
  idx.byInstGrp.add(`${di}\u0000${dg}`);
  idx.byHost.add(dh);
  idx.byInst.add(di);
  idx.byGrp.add(dg);
}

function hasCompatibleDomainInPresenceIndex(
  idx: DomainPresenceIndex,
  query: Pick<ParsedLogLine, "hostTag" | "instanceTag" | "groupTag">,
): boolean {
  if (activeScaleProbe) activeScaleProbe.domainPresenceLookups += 1;
  if (idx.count === 0) return false;
  const h = (query.hostTag ?? "").toLowerCase();
  const i = (query.instanceTag ?? "").toLowerCase();
  const g = (query.groupTag ?? "").toLowerCase();
  if (h === "" && i === "" && g === "") return true;
  if (h !== "" && i !== "" && g !== "") {
    for (const hk of [h, ""]) {
      for (const ik of [i, ""]) {
        for (const gk of [g, ""]) {
          if (idx.byDom.has(`${hk}\u0000${ik}\u0000${gk}`)) return true;
        }
      }
    }
    return false;
  }
  if (h !== "" && i !== "") {
    return (
      idx.byHostInst.has(`${h}\u0000${i}`) ||
      idx.byHostInst.has(`${h}\u0000`) ||
      idx.byHostInst.has(`\u0000${i}`) ||
      idx.byHostInst.has("\u0000")
    );
  }
  if (h !== "" && g !== "") {
    return (
      idx.byHostGrp.has(`${h}\u0000${g}`) ||
      idx.byHostGrp.has(`${h}\u0000`) ||
      idx.byHostGrp.has(`\u0000${g}`) ||
      idx.byHostGrp.has("\u0000")
    );
  }
  if (i !== "" && g !== "") {
    return (
      idx.byInstGrp.has(`${i}\u0000${g}`) ||
      idx.byInstGrp.has(`${i}\u0000`) ||
      idx.byInstGrp.has(`\u0000${g}`) ||
      idx.byInstGrp.has("\u0000")
    );
  }
  if (h !== "") return idx.byHost.has(h) || idx.byHost.has("");
  if (i !== "") return idx.byInst.has(i) || idx.byInst.has("");
  return idx.byGrp.has(g) || idx.byGrp.has("");
}

const MAX_CLASSIFIED_HALF_WINDOW = 4096;
const LONG_SPLIT_RULE_ANCHOR_RE =
  /\b(?:RoCE|GE\s+(?:compile|graph\s+compile|build)|HCCL_SOCKET_IFNAME|HCCL_IF_IP|GLOO_SOCKET_IFNAME|TP_SOCKET_IFNAME)\b/i;

function capLineWindow(rawLine: string): string {
  if (rawLine.length <= MAX_CLASSIFIED_HALF_WINDOW * 2) return rawLine;
  if (LONG_SPLIT_RULE_ANCHOR_RE.test(rawLine.slice(0, 65536))) {
    return rawLine.length <= 65536 ? rawLine : `${rawLine.slice(0, 32768)} ... ${rawLine.slice(-32768)}`;
  }
  return `${rawLine.slice(0, MAX_CLASSIFIED_HALF_WINDOW)} ... ${rawLine.slice(-MAX_CLASSIFIED_HALF_WINDOW)}`;
}

const FULL_TS_RE =
  /(?<![0-9])(\d{4})-(\d{2})-(\d{2})[T -](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}(?:\.\d{1,6})?))?([Zz]|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?(?![0-9A-Za-z])/;
const SHORT_DATE_TS_RE =
  /(?<![0-9])(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}(?:\.\d{1,6})?))?([Zz]|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?(?![0-9A-Za-z])/;
const TIME_ONLY_TS_RE =
  /(?<![0-9:])(\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,9}(?:\.\d{1,6})?))?([Zz]|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?(?![0-9A-Za-z])/;

export const LOG_TIMESTAMP_PATTERNS: readonly RegExp[] = [FULL_TS_RE, SHORT_DATE_TS_RE, TIME_ONLY_TS_RE];

const PEER_RANK_PHRASE_SRC = String.raw`(?<!\b(?:host|node|instance|group|name|id|tag|worker|user|env)\s*[:=]\s*['"]?)\b(?:wait(?:ing)?\s+(?:for\s+|on\s+)|(?:peer|remote|target|dst|src|source|root|other|dest(?:ination)?|to|from)(?:\s+|_))(?:\[\s*(?:global_?rank|remote_?[Rr]ank|rank)\s*[:=#]?\s*(\d+)\s*\]|(?:global_?rank|remote_?[Rr]ank|peer_?rank|target_?rank|dst_?rank|src_?rank|rank)(?:\s*[:=#\[]\s*|\s*)(\d+)\b)|\b(?:peer|remote|target|dst|src)[Rr]ank\s*[:=#]\s*(\d+)\b|\bRank\s+(\d+)\s+failed\s+to\s+pass\s+monitoredBarrier\b`;
const PEER_RANK_PHRASE_RE = new RegExp(PEER_RANK_PHRASE_SRC, "gi");
const PEER_RANK_CAPTURE_RE = new RegExp(PEER_RANK_PHRASE_SRC, "i");

const TYPED_RANK_PATTERNS: ReadonlyArray<{ re: RegExp; source: RankSource }> = [
  { re: /\[\s*(?:[^\]\r\n]{0,64}[,;]\s*)?(?:Rank|rank|RANK)\s*[:=#]?\s*(\d+)\b/, source: "explicit-rank" },
  { re: /\(\s*(?:[^)\r\n]{0,64}[,;]\s*)?(?:Rank|rank|RANK)\s*[:=#]?\s*(\d+)\b/, source: "explicit-rank" },
  { re: /\bRankID\s*[:=]\s*(\d+)\b/i, source: "explicit-rank" },
  {
    re: /(?<!\b(?:peer|remote|target|dst|src|source|root|other|dest|destination|to|from)\s+)(?<!\bwait(?:ing)?\s+(?:for|on)\s+)\bglobal_rank\s*[:=]\s*(\d+)\b/i,
    source: "explicit-rank",
  },
  {
    re: /(?<!\b(?:peer|remote|target|dst|src|source|root|other|dest|destination|to|from)\s+)(?<!\bwait(?:ing)?\s+(?:for|on)\s+)\brank\s*[:=]\s*(\d+)\b/i,
    source: "explicit-rank",
  },
  {
    re: /(?<!\b(?:peer|remote|target|dst|src|source|root|other|dest|destination|to|from)\s+)(?<!\bwait(?:ing)?\s+(?:for|on)\s+)\brank\s+(\d+)\b/i,
    source: "explicit-rank",
  },
  { re: /\bWorker_(?:[A-Za-z]+\d+_)*EP(\d+)\b/i, source: "worker-ep" },
  { re: /\b(?:Worker_TP|VllmWorker_TP)\s*[_:-]?\s*(\d+)(?=_|\b)/i, source: "worker-tp" },
  { re: /\b(?:Worker_DP|Worker_PP|EngineCore_DP)\s*[_:-]?\s*(\d+)(?=_|\b)/i, source: "worker-dp-pp" },
  { re: /\b(?:local_rank)\s*[:=]\s*(\d+)\b/i, source: "local-rank" },
  { re: /\b(?:device_id|NPU|device)\s*[:=#]\s*(\d+)\b/i, source: "device-id" },
  { re: /\b(?:NPU|device)\s+(\d+)\b/i, source: "device-id" },
];

export const RANK_PATTERNS: readonly RegExp[] = TYPED_RANK_PATTERNS.map((p) => p.re);

const REDACTED_HOST_VAL_SRC = String.raw`(?:\[REDACTED_IP(?:_\d+)?\]|<REDACTED_IP(?:_\d+)?>|<IP#\d+>)`;
const HOST_TAG_RE = new RegExp(
  String.raw`\[\s*(?:host|node)\s*[:=]\s*(${REDACTED_HOST_VAL_SRC}|[A-Za-z0-9_.:-]+)\s*\]|\[\s*(?:host|node)\s+(${REDACTED_HOST_VAL_SRC}|[A-Za-z0-9_.:-]+)\s*\]|\[\s*((?:host|node)[-_][A-Za-z0-9_.:-]+)\s*\]|\b(?:host(?:name)?|node(?:_name)?)\s*=\s*['"]?(${REDACTED_HOST_VAL_SRC}|[A-Za-z0-9_.:-]+)['"]?|(?<![A-Za-z0-9_-])((?:host|node)[-_][A-Za-z0-9._-]+)(?=\s*\[)|(?:^|\s)((?:host|node)[-_][A-Za-z0-9._-]+)(?=:?\s+(?:INFO|WARN(?:ING)?|ERROR|CRITICAL|FATAL|DEBUG|\d{2,4}[-/:]|\((?:EngineCore|Worker|APIServer|[^\r\n)]{0,40}\bpid\s*=)))`,
  "i",
);
const NODE_RANK_FALLBACK_RE = /\b(node[_-]?rank\s*=\s*\d+)/i;

export interface ExtractedTimestamp {
  timestamp: string | null;
  timestampMs: number | null;
  index: number | null;
  length: number;
  timestampSubMs?: number;
  timestampKind?: "full" | "short-date" | "time-only" | null;
  hasExplicitTimezone?: boolean;
  month?: number;
  day?: number;
  hh?: number;
  mm?: number;
  ss?: number;
  ms?: number;
  offsetMs?: number;
}

export interface ExtractedRankMatch {
  rank: number;
  source: RankSource;
  index: number;
  raw: string;
}

function parseFractionMs(frac: string | undefined): number {
  if (!frac) return 0;
  const dotIdx = frac.indexOf(".");
  const msPart = dotIdx >= 0 ? frac.slice(0, dotIdx) : frac;
  return Number(msPart.slice(0, 3).padEnd(3, "0"));
}

function parseFractionSubMs(frac: string | undefined): number {
  if (!frac) return 0;
  const dotIdx = frac.indexOf(".");
  if (dotIdx >= 0) {
    const subPart = frac.slice(dotIdx + 1);
    if (!subPart) return 0;
    return Number(subPart.slice(0, 6).padEnd(6, "0"));
  }
  if (frac.length <= 3) return 0;
  return Number(frac.slice(3, 9).padEnd(6, "0"));
}

function parseTzOffsetMs(tz: string | undefined): number {
  if (!tz || tz === "Z" || tz === "z") return 0;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(tz);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2]);
  const mm = Number(m[3]);
  return sign * (hh * 60 + mm) * 60 * 1000;
}

const TS_FIRST_ANY_RE = new RegExp(
  `${FULL_TS_RE.source}|${SHORT_DATE_TS_RE.source}|${TIME_ONLY_TS_RE.source}`,
);
const TS_BODY_START_RE =
  /(?:\b(?:[A-Z][A-Za-z0-9_.]*(?:Error|Exception)|Exception)\s*:|\b(?:elapsed|duration|latency|wait(?:ed)?|timeout|took|after|within|for|since|before|until|latest\s+heartbeat|last\s+(?:heartbeat|seen|\w+)|heartbeat(?:\s+(?:timestamp|time|ts|was|is|at|on))?|progress|checkpoint(?:\s+(?:saved|at|was))?|created|updated|started|saved|seen|recorded|occurred|detected|measured|checked|[A-Za-z_]*time(?:stamp)?|date(?:time)?|deadline|expir(?:es?|y)|valid_until)\b(?:\s+(?:was|is|at|on)|\s*[:=])?\s*(?=\d{4}-\d{2}-\d{2}|\d{2}-\d{2}\s+\d{2}:\d{2}|\d{2}:\d{2}:\d{2})|\b(?:at|was|from|on)\s+(?=\d{4}-\d{2}-\d{2}|\d{2}-\d{2}\s+\d{2}:\d{2}|\d{2}:\d{2}:\d{2})|\b(?!(?:INFO|DEBUG|WARN(?:ING)?|ERROR|CRITICAL|FATAL)\s*:)[A-Za-z_][A-Za-z0-9_]*\s*[:=]\s*(?=\d{4}-\d{2}-\d{2}|\d{2}-\d{2}\s+\d{2}:\d{2}|\d{2}:\d{2}:\d{2}))/i;
const TS_HEADER_SEVERITY_BOUNDARY_RE =
  /(?<![=\w.])(?:INFO|DEBUG|WARN(?:ING)?|ERROR|CRITICAL|FATAL)\b(?:\s*:|\s+)(?!\s*=)/;

function isValidCalendarDate(year: number | null, month: number, day: number): boolean {
  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1) {
    return false;
  }
  const probeYear = year ?? 2024; // Allow Feb 29 on unanchored short dates until year inference resolves
  const dt = new Date(Date.UTC(probeYear, month - 1, day));
  return dt.getUTCFullYear() === probeYear && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}

function extractTimestampFromSlice(slice: string): ExtractedTimestamp {
  const full = FULL_TS_RE.exec(slice);
  if (full) {
    const year = Number(full[1]);
    const month = Number(full[2]);
    const day = Number(full[3]);
    const hh = Number(full[4]);
    const mm = Number(full[5]);
    const ss = Number(full[6]);
    const ms = parseFractionMs(full[7]);
    const subMs = parseFractionSubMs(full[7]);
    if (isValidCalendarDate(year, month, day) && hh <= 23 && mm <= 59 && ss <= 59) {
      const offsetMs = parseTzOffsetMs(full[8]);
      const timestampMs = Date.UTC(year, month - 1, day, hh, mm, ss, ms) - offsetMs;
      return {
        timestamp: full[0],
        timestampMs,
        index: full.index,
        length: full[0].length,
        timestampSubMs: subMs,
        timestampKind: "full",
        hasExplicitTimezone: Boolean(full[8]),
        month,
        day,
        hh,
        mm,
        ss,
        ms,
        offsetMs,
      };
    }
    const timeBeforeFull = TIME_ONLY_TS_RE.exec(slice);
    if (!timeBeforeFull || timeBeforeFull.index >= full.index) {
      return { timestamp: null, timestampMs: null, index: null, length: 0 };
    }
  }

  const shortDate = SHORT_DATE_TS_RE.exec(slice);
  if (shortDate) {
    const month = Number(shortDate[1]);
    const day = Number(shortDate[2]);
    const hh = Number(shortDate[3]);
    const mm = Number(shortDate[4]);
    const ss = Number(shortDate[5]);
    const ms = parseFractionMs(shortDate[6]);
    const subMs = parseFractionSubMs(shortDate[6]);
    if (isValidCalendarDate(null, month, day) && hh <= 23 && mm <= 59 && ss <= 59) {
      const offsetMs = parseTzOffsetMs(shortDate[7]);
      const timestampMs = Date.UTC(2024, month - 1, day, hh, mm, ss, ms) - offsetMs;
      return {
        timestamp: shortDate[0],
        timestampMs,
        index: shortDate.index,
        length: shortDate[0].length,
        timestampSubMs: subMs,
        timestampKind: "short-date",
        hasExplicitTimezone: Boolean(shortDate[7]),
        month,
        day,
        hh,
        mm,
        ss,
        ms,
        offsetMs,
      };
    }
    const timeBeforeShort = TIME_ONLY_TS_RE.exec(slice);
    if (!timeBeforeShort || timeBeforeShort.index >= shortDate.index) {
      return { timestamp: null, timestampMs: null, index: null, length: 0 };
    }
  }

  const timeOnly = TIME_ONLY_TS_RE.exec(slice);
  if (timeOnly) {
    const hh = Number(timeOnly[1]);
    const mm = Number(timeOnly[2]);
    const ss = Number(timeOnly[3]);
    const ms = parseFractionMs(timeOnly[4]);
    const subMs = parseFractionSubMs(timeOnly[4]);
    if (hh <= 23 && mm <= 59 && ss <= 59) {
      const offsetMs = parseTzOffsetMs(timeOnly[5]);
      const timestampMs = ((hh * 60 + mm) * 60 + ss) * 1000 + ms - offsetMs;
      return {
        timestamp: timeOnly[0],
        timestampMs,
        index: timeOnly.index,
        length: timeOnly[0].length,
        timestampSubMs: subMs,
        timestampKind: "time-only",
        hasExplicitTimezone: Boolean(timeOnly[5]),
        hh,
        mm,
        ss,
        ms,
        offsetMs,
      };
    }
  }

  return { timestamp: null, timestampMs: null, index: null, length: 0 };
}

const LOG_PREFIX_TS_SRC = String.raw`(?:\d{4}-\d{2}-\d{2}[T -]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9}(?:\.\d{1,6})?)?(?:[Zz]|[+-]\d{2}:?\d{2})?|\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9}(?:\.\d{1,6})?)?(?:[Zz]|[+-]\d{2}:?\d{2})?|\d{2}:\d{2}:\d{2}(?:[.,]\d{1,9}(?:\.\d{1,6})?)?(?:[Zz]|[+-]\d{2}:?\d{2})?)`;
const LOG_PREFIX_TOKEN_SRC = String.raw`(?:\([^)\r\n]{1,160}\):?|\[[^\]\r\n]{1,160}\]:?|[A-Z][A-Z0-9_]{0,32}\([^)\r\n]{1,160}\):?|${REDACTED_HOST_VAL_SRC}|${LOG_PREFIX_TS_SRC}|(?:INFO|DEBUG|WARN(?:ING)?|ERROR|CRITICAL|FATAL|EVENT|NOTICE|TRACE):?|[IWEF]\d{4}|\[[IWEF]\d{3,4}|(?:host(?:name)?|node(?:_name)?|node[_-]?rank|instance(?:_id)?|group(?:_name|_id)?|comm_group|pg_name|pid|rank|global_rank|local_rank|RankID|device_id|worker_id)\s*[:=]\s*(?:${REDACTED_HOST_VAL_SRC}|[A-Za-z0-9_.:-]{1,64})|(?:host|node)[-_][A-Za-z0-9._-]{1,64}:?|(?:EngineCore(?:_DP\d+)?|APIServer|Worker(?:_[A-Za-z0-9_]+)?):?)`;
const LOG_LINE_PREFIX_STRIP_RE = new RegExp(
  String.raw`^[ \t]?${LOG_PREFIX_TOKEN_SRC}(?:[ \t]+${LOG_PREFIX_TOKEN_SRC}){0,16}(?:[ \t]|$)`,
);
const HEADER_PREFIX_STEP_RE = new RegExp(String.raw`^[ \t]*${LOG_PREFIX_TOKEN_SRC}[ \t]*`);

function stripTracebackLogPrefix(rawLine: string): string {
  const head = rawLine.length > 1024 ? rawLine.slice(0, 1024) : rawLine;
  const m = LOG_LINE_PREFIX_STRIP_RE.exec(head);
  if (!m) return rawLine;
  return rawLine.slice(m[0].length);
}

const STRUCTURED_HEADER_SEGMENT_RE =
  /^(?:(?:Rank|rank|RANK|RankID|global_rank|local_rank|device|Device|device_id|NPU|node[_-]?rank|pid|PID)(?:\s*[:=#]\s*[^\s,;()[\]]+|\s*\d+)?|(?:host|Host|hostname|node|Node|node_name|instance|instance_id|group|group_name|group_id|comm_group|pg_name)(?:\s*[:=#]\s*[^\s,;()[\]]+|\s+(?!(?:is|are|was|were|be|been|of|for|by|on|in|to|from|with|at|as|and|or|not|no|down|up|init|initialized|timeout|timed|failed|failing|fail|error|ok|ready|busy|lost|offline|online|missing|refused|rejected|unknown|unreachable|disconnected|connected|healthy|unhealthy|referenced|inspected|checked|detected|found|crashed|exited|exit|started|starting|stopped|stopping|running)\b)[A-Za-z0-9_.:-]+)?|(?:Worker(?:_[A-Za-z0-9_]+)?|VllmWorker(?:_[A-Za-z0-9_]+)?|EngineCore(?:_DP\d+)?|APIServer|MainProcess|MainThread)(?:\s*[:=#]\s*[^\s,;()[\]]+|\s+\d+)?|(?:stdout|stderr|master|controller|scheduler|coordinator|driver|runtime|[IWEF]\d{4}|INFO|DEBUG|WARN(?:ING)?|ERROR|CRITICAL|FATAL|EVENT|NOTICE|TRACE)|[A-Za-z_][A-Za-z0-9_]{0,48}\s*[:=]\s*[^\s,;()[\]]+|(?:host|node|worker|pod|npu)[-_][A-Za-z0-9_.:-]+)$/i;

const STRUCTURED_BRACKET_TS_RE = new RegExp(`^(?:${LOG_PREFIX_TS_SRC})$`);
const STRUCTURED_DIGIT_HEADER_ID_RE = /^(?=[A-Za-z0-9_.:/#@-]*\d)[A-Za-z0-9_.:/#@-]+$/;

function isStructuredHeaderBracketOrParen(tok: string): boolean {
  const hasTrailingColon = tok.trimEnd().endsWith(":");
  const cleaned = tok.replace(/:$/, "").trim();
  if (cleaned.length < 2) return false;
  const open = cleaned[0];
  const close = cleaned[cleaned.length - 1];
  if (!((open === "(" && close === ")") || (open === "[" && close === "]"))) {
    return true;
  }
  const inner = cleaned.slice(1, -1).trim();
  if (!inner) return true;
  if (STRUCTURED_BRACKET_TS_RE.test(inner)) return true;
  if (/^(?:[IWEF]\d{3,4}|CANN\s+HCCP\s+internal\s+plog)$/i.test(inner)) return true;
  if (HEADER_REDACTED_TOKEN_RE.test(cleaned) || HEADER_REDACTED_TOKEN_RE.test(inner)) return true;
  if (!/[,;\s]/.test(inner)) {
    if (
      hasTrailingColon &&
      open === "(" &&
      !/^(?:EngineCore(?:_DP\d+)?|APIServer|Worker(?:_[A-Za-z0-9_]+)?|VllmWorker(?:_[A-Za-z0-9_]+)?|MainProcess|MainThread)$/i.test(
        inner,
      )
    ) {
      return false;
    }
    return STRUCTURED_HEADER_SEGMENT_RE.test(inner) || STRUCTURED_DIGIT_HEADER_ID_RE.test(inner);
  }
  const parts = inner.split(/[,;]/);
  for (const part of parts) {
    const seg = part.trim();
    if (!seg) continue;
    if (STRUCTURED_HEADER_SEGMENT_RE.test(seg)) continue;
    const wsTokens = seg.split(/\s+/);
    if (wsTokens.length > 0 && wsTokens.every((t) => STRUCTURED_HEADER_SEGMENT_RE.test(t))) {
      continue;
    }
    return false;
  }
  return true;
}

function stripLeadingHeaderPrefixTokens(head: string, maxSteps = 32): string {
  let rem = head;
  let steps = 0;
  while (rem.length > 0 && steps < maxSteps) {
    const m = HEADER_PREFIX_STEP_RE.exec(rem);
    if (!m || m[0].length === 0) break;
    const trimmedTok = m[0].trim();
    if (
      trimmedTok &&
      (trimmedTok.startsWith("(") || trimmedTok.startsWith("[")) &&
      !/^\[(?:IWEF]\d{3,4})\b/.test(trimmedTok) &&
      !isStructuredHeaderBracketOrParen(trimmedTok)
    ) {
      break;
    }
    rem = rem.slice(m[0].length);
    steps += 1;
  }
  return rem;
}

function isHeaderPrefixBeforeTimestamp(head: string): boolean {
  if (head.length === 0) return true;
  if (head.length > 1024 || TS_BODY_START_RE.test(head)) return false;
  const rem = stripLeadingHeaderPrefixTokens(head);
  return /^[[("'\s]*$/.test(rem);
}

const PROSE_BEFORE_TS_RE =
  /[,;]\s+(?!$)|\b(?:watchdog|heartbeat|reported|elapsed|duration|latency|wait(?:ed)?|timeout|occurred|failed|started|saved|seen|recorded|detected|measured|checked|previous|prior|earlier|last|next|stale|old|since|until|before|after|between|during|from|allreduce|allgather|reducescatter|alltoall|broadcast|barrier|collective)\b/i;

const MULTI_WORDS_BEFORE_TS_RE = /\b[A-Za-z]{2,24}\s+[A-Za-z]{2,24}\b/;
const UNCLOSED_GROUP_WORDS_BEFORE_TS_RE = /[([][^()\][\r\n]{1,120}\b[A-Za-z]{2,}\s*$/;

function isBodyTimestampPrecededByProse(fullSlice: string, tsIndex: number): boolean {
  const head = fullSlice.slice(0, tsIndex);
  const probeWindow = fullSlice.slice(0, Math.min(fullSlice.length, tsIndex + 32));
  const bodyMatch = TS_BODY_START_RE.exec(probeWindow);
  if (bodyMatch && bodyMatch.index <= tsIndex) return true;
  const sevBefore = TS_HEADER_SEVERITY_BOUNDARY_RE.exec(head);
  if (sevBefore && !isHeaderPrefixBeforeTimestamp(head.slice(sevBefore.index))) {
    return true;
  }
  const remAfterHeaders = stripLeadingHeaderPrefixTokens(head);
  const maskedHead = remAfterHeaders.replace(/\b[A-Za-z_][A-Za-z0-9_]*\s*[:=]\s*[^\s,;()[\]]+/g, " ");
  if (UNCLOSED_GROUP_WORDS_BEFORE_TS_RE.test(maskedHead)) return true;
  if (/[,:;]\s*$/.test(maskedHead.trimEnd()) && /[A-Za-z]{2,}/.test(maskedHead)) return true;
  if (MULTI_WORDS_BEFORE_TS_RE.test(maskedHead)) return true;
  return PROSE_BEFORE_TS_RE.test(maskedHead);
}

export function extractTimestamp(line: string): ExtractedTimestamp {
  const slice = capLineWindow(line);
  const firstTs = TS_FIRST_ANY_RE.exec(slice);
  if (!firstTs) {
    return { timestamp: null, timestampMs: null, index: null, length: 0 };
  }
  const head = slice.slice(0, firstTs.index);
  if (isHeaderPrefixBeforeTimestamp(head)) {
    const headerSlice = slice.slice(firstTs.index, firstTs.index + firstTs[0].length);
    const parsedHeader = extractTimestampFromSlice(headerSlice);
    if (parsedHeader.timestamp !== null) {
      return {
        ...parsedHeader,
        index: firstTs.index,
      };
    }
  }
  if (firstTs.index > 0 && isBodyTimestampPrecededByProse(slice, firstTs.index)) {
    return { timestamp: null, timestampMs: null, index: null, length: 0 };
  }
  const tail = slice.slice(firstTs.index);
  const bodyMatch = TS_BODY_START_RE.exec(tail);
  const sevMatch = TS_HEADER_SEVERITY_BOUNDARY_RE.exec(tail);
  let endIdx = slice.length;
  if (bodyMatch && bodyMatch.index > 0) {
    endIdx = Math.min(endIdx, firstTs.index + bodyMatch.index);
  }
  if (sevMatch && sevMatch.index > 0) {
    endIdx = Math.min(endIdx, firstTs.index + sevMatch.index);
  }
  if (endIdx < slice.length && endIdx > firstTs.index) {
    const headerTs = extractTimestampFromSlice(slice.slice(0, endIdx));
    if (
      headerTs.timestamp !== null &&
      (headerTs.index === null ||
        headerTs.index === 0 ||
        !isBodyTimestampPrecededByProse(slice, headerTs.index))
    ) {
      return headerTs;
    }
  }
  const fallbackTs = extractTimestampFromSlice(slice);
  if (fallbackTs.timestamp !== null && fallbackTs.index !== null && fallbackTs.index > 0) {
    if (isBodyTimestampPrecededByProse(slice, fallbackTs.index)) {
      return { timestamp: null, timestampMs: null, index: null, length: 0 };
    }
  }
  return fallbackTs;
}

const RANK_BODY_BOUNDARY_RE = /(?<![A-Za-z0-9_])(?:[A-Z][A-Za-z0-9_]*(?:Error|Exception)|Exception)\s*:/;
const CANN_TUPLE_PID_RE = /\(\s*PID\s*[:=]\s*(\d+)\s*,\s*Device\s*[:=]\s*\d+\s*,\s*RankID\s*[:=]\s*\d+/i;
const OOM_PAREN_DEVICE_RE = /\(\s*(?:NPU|device)\s+(\d+)\s*[;)]/i;

function extractRankFromText(maskedSlice: string): ExtractedRankMatch | null {
  for (const { re, source } of TYPED_RANK_PATTERNS) {
    const match = re.exec(maskedSlice);
    if (match?.[1] !== undefined) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value) && value >= 0 && value < 4096) {
        return { rank: value, source, index: match.index, raw: match[0] };
      }
    }
  }
  return null;
}

const HEADER_LEADING_RANK_TAG_RE =
  /^\s*(?:(?:Rank|global_rank|local_rank|RankID|device_id|device)\s*[:=#]\s*\d+\b|(?:Rank|rank|RANK)\s+\d+\b|[[(]\s*(?:[^)\]\r\n]{0,64}[,;]\s*)?(?:Rank|rank|RANK|RankID)\s*[:=#]?\s*\d+(?:\s*[,;][^)\]\r\n]{0,64})?\s*[\])]|\(\s*(?:PID\s*[:=]\s*\d+\s*,\s*)?(?:Device\s*[:=]\s*\d+\s*,\s*)?RankID\s*[:=]\s*\d+[^)\r\n]{0,64}\)|Worker_(?:[A-Za-z]+\d+_)*EP\d+\b|(?:Worker_TP|VllmWorker_TP|Worker_DP|Worker_PP|EngineCore_DP)\s*[_:-]?\s*\d+(?=_|\b))/i;

const ANCHORED_CANN_TUPLE_RANKID_RE =
  /^\s*\(\s*(?:PID\s*[:=]\s*\d+\s*,\s*)?(?:Device\s*[:=]\s*\d+\s*,\s*)?RankID\s*[:=]\s*(\d+)\b/i;

export function extractRankMatch(line: string): ExtractedRankMatch | null {
  const window = capLineWindow(line);
  const maskedLine = window.replace(PEER_RANK_PHRASE_RE, (m) => " ".repeat(m.length));
  const excBoundary = RANK_BODY_BOUNDARY_RE.exec(maskedLine);
  let headerEnd = maskedLine.length;
  if (excBoundary) {
    headerEnd = Math.min(headerEnd, excBoundary.index);
  }
  const headProbe = maskedLine.slice(0, Math.min(headerEnd, 1024));
  const afterStructured = stripLeadingHeaderPrefixTokens(headProbe, 32);
  const structuredLen = headProbe.length - afterStructured.length;
  const leadingTag =
    structuredLen < headerEnd
      ? HEADER_LEADING_RANK_TAG_RE.exec(maskedLine.slice(structuredLen, headerEnd))
      : null;
  const effectiveStructuredEnd = leadingTag
    ? Math.min(headerEnd, structuredLen + leadingTag[0].length)
    : structuredLen;

  if (structuredLen > 0 && effectiveStructuredEnd < headerEnd) {
    const afterPrefix = maskedLine.slice(structuredLen, headerEnd);
    const hasLeadingKvRank =
      /^\s*(?:rank|global_rank|local_rank|RankID|device_id|device)\s*[:=#]?\s*\d+\b/i.test(afterPrefix);
    if (!hasLeadingKvRank) {
      const prefixOnly = extractRankFromText(maskedLine.slice(0, structuredLen));
      if (prefixOnly) return prefixOnly;
    }
  }
  const activeHeaderEnd = effectiveStructuredEnd > 0 ? Math.min(headerEnd, effectiveStructuredEnd) : 0;

  if (activeHeaderEnd > 0) {
    const headerMatch = extractRankFromText(maskedLine.slice(0, activeHeaderEnd));
    if (headerMatch) return headerMatch;
  }

  if (activeHeaderEnd < headerEnd) {
    const preExcProse = maskedLine.slice(activeHeaderEnd, headerEnd);
    const leadingStructTag =
      /^\s*(?:[[(]\s*(?:[^)\]\r\n]{0,64}[,;]\s*)?(?:Rank|rank|RANK)\s*[:=#]?\s*(\d+)(?:\s*[,;][^)\]\r\n]{0,64})?\s*[\])]|\bRankID\s*[:=]\s*(\d+)\b|(?:Rank|rank|RANK)\s*[:=#]?\s*(\d+)\b)/.exec(
        preExcProse,
      );
    const rawBracket = leadingStructTag?.[1] ?? leadingStructTag?.[2] ?? leadingStructTag?.[3];
    if (rawBracket !== undefined && leadingStructTag) {
      const value = Number.parseInt(rawBracket, 10);
      if (Number.isFinite(value) && value >= 0 && value < 4096) {
        return {
          rank: value,
          source: "explicit-rank",
          index: activeHeaderEnd + leadingStructTag.index,
          raw: leadingStructTag[0],
        };
      }
    }
    const leadingWorkerTag =
      /^\s*(Worker_(?:[A-Za-z]+\d+_)*EP(\d+)|(?:Worker_TP|VllmWorker_TP)\s*[_:-]?\s*(\d+)(?=_|\b)|(?:Worker_DP|Worker_PP|EngineCore_DP)\s*[_:-]?\s*(\d+)(?=_|\b))/i.exec(
        preExcProse,
      );
    const workerVal = leadingWorkerTag?.[2] ?? leadingWorkerTag?.[3] ?? leadingWorkerTag?.[4];
    if (workerVal !== undefined && leadingWorkerTag) {
      const value = Number.parseInt(workerVal, 10);
      if (Number.isFinite(value) && value >= 0 && value < 4096) {
        const source: RankSource =
          leadingWorkerTag[2] !== undefined
            ? "worker-ep"
            : leadingWorkerTag[3] !== undefined
              ? "worker-tp"
              : "worker-dp-pp";
        return {
          rank: value,
          source,
          index: activeHeaderEnd + leadingWorkerTag.index,
          raw: leadingWorkerTag[0],
        };
      }
    }
  }

  const body = maskedLine.slice(activeHeaderEnd);
  const tupleRank = ANCHORED_CANN_TUPLE_RANKID_RE.exec(body);
  if (tupleRank?.[1] !== undefined) {
    const value = Number.parseInt(tupleRank[1], 10);
    if (Number.isFinite(value) && value >= 0 && value < 4096) {
      return {
        rank: value,
        source: "explicit-rank",
        index: activeHeaderEnd + tupleRank.index,
        raw: tupleRank[0],
      };
    }
  }
  if (/out of memory|ACL_ERROR_RT_MEMORY_ALLOCATION/i.test(body)) {
    const oomDev = OOM_PAREN_DEVICE_RE.exec(body);
    if (oomDev?.[1] !== undefined) {
      const value = Number.parseInt(oomDev[1], 10);
      if (Number.isFinite(value) && value >= 0 && value < 4096) {
        return {
          rank: value,
          source: "device-id",
          index: activeHeaderEnd + oomDev.index,
          raw: oomDev[0],
        };
      }
    }
  }
  const elisionMarker = "...[单行中段省略]...";
  const firstElisionIdx = window.indexOf(elisionMarker);
  const midScanStart =
    firstElisionIdx !== -1 ? firstElisionIdx + elisionMarker.length : activeHeaderEnd === 0 ? 0 : -1;
  const isProseRankLabelPrefix = (before: string): boolean =>
    /["'`]\s*$/.test(before) ||
    /\b(?!(?:INFO|WARN(?:ING)?|ERROR|CRITICAL|FATAL|DEBUG)\b)[A-Za-z]{2,24}(?:[ \t]*[:=,-]+[ \t]*|[ \t]+)$/i.test(
      before,
    );
  if (midScanStart !== -1 && midScanStart < headerEnd) {
    const midSlice = maskedLine.slice(midScanStart, headerEnd);
    const midWorker =
      /\(\s*(Worker_(?:[A-Za-z]+\d+_)*EP(\d+)|(?:Worker_TP|VllmWorker_TP)\s*[_:-]?\s*(\d+)(?=_|\b)|(?:Worker_DP|Worker_PP|EngineCore_DP)\s*[_:-]?\s*(\d+)(?=_|\b))(?:\s+pid=\d+)?\s*\)/i.exec(
        midSlice,
      );
    const midWorkerVal = midWorker?.[2] ?? midWorker?.[3] ?? midWorker?.[4];
    if (midWorkerVal !== undefined && midWorker) {
      const absIdx = midScanStart + midWorker.index;
      const before = window.slice(Math.max(0, absIdx - 48), absIdx);
      if (!isProseRankLabelPrefix(before)) {
        const value = Number.parseInt(midWorkerVal, 10);
        if (Number.isFinite(value) && value >= 0 && value < 4096) {
          const source: RankSource =
            midWorker[2] !== undefined
              ? "worker-ep"
              : midWorker[3] !== undefined
                ? "worker-tp"
                : "worker-dp-pp";
          return { rank: value, source, index: absIdx, raw: midWorker[0] };
        }
      }
    }
    const midRank = /\[\s*(?:Rank|rank|RANK|RankID)\s*[:=#]?\s*(\d+)\s*\]/.exec(midSlice);
    if (midRank?.[1] !== undefined) {
      const absIdx = midScanStart + midRank.index;
      const before = window.slice(Math.max(0, absIdx - 48), absIdx);
      if (!isProseRankLabelPrefix(before)) {
        const value = Number.parseInt(midRank[1], 10);
        if (Number.isFinite(value) && value >= 0 && value < 4096) {
          return {
            rank: value,
            source: "explicit-rank",
            index: absIdx,
            raw: midRank[0],
          };
        }
      }
    }
  }
  return null;
}

export function extractRank(line: string): number | null {
  return extractRankMatch(line)?.rank ?? null;
}

const HEADER_REDACTED_TOKEN_RE = new RegExp(`^\\[?(${REDACTED_HOST_VAL_SRC})\\]?:?$`, "i");
const LEADING_HOST_KV_CONT_RE = new RegExp(
  String.raw`^\s*(?:(?:host(?:name)?|node(?:_name)?|node[_-]?rank|instance(?:_id)?|group(?:_name|_id)?|comm_group|pg_name)\s*[:=]\s*['"]?(?:${REDACTED_HOST_VAL_SRC}|[A-Za-z0-9_.:-]+)['"]?\s*)+`,
  "i",
);

function getStructuredHeaderSlice(slice: string): string {
  const excBoundary = RANK_BODY_BOUNDARY_RE.exec(slice);
  const maxHeaderEnd = excBoundary ? excBoundary.index : slice.length;
  const headProbe = slice.slice(0, Math.min(maxHeaderEnd, 1024));
  const afterStructured = stripLeadingHeaderPrefixTokens(headProbe, 32);
  const structuredLen = headProbe.length - afterStructured.length;
  const contKv =
    structuredLen < maxHeaderEnd
      ? LEADING_HOST_KV_CONT_RE.exec(slice.slice(structuredLen, maxHeaderEnd))
      : null;
  const activeHeaderEnd =
    structuredLen > 0
      ? Math.min(maxHeaderEnd, structuredLen + (contKv?.[0].length ?? 0))
      : contKv
        ? Math.min(maxHeaderEnd, contKv[0].length)
        : 0;
  const baseHeader = slice.slice(0, activeHeaderEnd);
  const elisionMarker = "...[单行中段省略]...";
  const firstElision = slice.indexOf(elisionMarker, activeHeaderEnd);
  if (firstElision === -1 || firstElision >= maxHeaderEnd) {
    return baseHeader;
  }
  const elidedMid = slice.slice(firstElision + elisionMarker.length, maxHeaderEnd);
  const preservedTags: string[] = [];
  const midScopeRe =
    /(?<![([][^)\]\r\n]{0,48})(?<!\b(?:from|to|peer|remote|src|dst|target|destination|copying)\s+)\b(?:(?:host(?:name)?|node(?:_name)?|node[_-]?rank|instance(?:_id)?|group(?:_name|_id)?|comm_group|pg_name)\s*[:=]\s*['"]?[A-Za-z0-9_.:-]+['"]?)/gi;
  let mm = midScopeRe.exec(elidedMid);
  while (mm !== null) {
    const after = elidedMid.slice(mm.index + mm[0].length, mm.index + mm[0].length + 24);
    if (!/^[^([\r\n]*[)\]]/.test(after)) {
      preservedTags.push(mm[0]);
    }
    mm = midScopeRe.exec(elidedMid);
  }
  return preservedTags.length > 0 ? `${baseHeader} ${preservedTags.join(" ")}` : baseHeader;
}

function extractHostTag(line: string): string | null {
  const headerSlice = getStructuredHeaderSlice(capLineWindow(line));

  if (headerSlice.length > 0) {
    const m = HOST_TAG_RE.exec(headerSlice);
    const direct = (m?.[1] ?? m?.[2] ?? m?.[3] ?? m?.[4] ?? m?.[5] ?? m?.[6] ?? "").trim();
    if (direct && m) {
      const before = headerSlice.slice(Math.max(0, m.index - 24), m.index);
      if (!/\b(?:from|to|peer|remote|src|dst|target|copying)\s+$/i.test(before)) {
        return direct;
      }
    }

    let rem = headerSlice.slice(0, 512);
    let steps = 0;
    while (rem.length > 0 && steps < 16) {
      const step = HEADER_PREFIX_STEP_RE.exec(rem);
      if (!step || step[0].length === 0) break;
      const tok = step[0].trim();
      const afterTok = rem.trimStart().slice(tok.length);
      if (tok && (tok.endsWith(":") || !afterTok.startsWith(":") || /^:\s/.test(afterTok))) {
        const redMatch = HEADER_REDACTED_TOKEN_RE.exec(tok);
        if (redMatch?.[1]) {
          return redMatch[1];
        }
      }
      rem = rem.slice(step[0].length);
      steps += 1;
    }

    const nr = NODE_RANK_FALLBACK_RE.exec(headerSlice);
    if (nr?.[1]) {
      const before = headerSlice.slice(Math.max(0, nr.index - 16), nr.index);
      if (!/\b(?:peer|remote|target|dst|src|from|to)\s+$/i.test(before)) {
        return nr[1].trim();
      }
    }
  }
  return null;
}

const INSTANCE_TAG_RE =
  /\binstance(?:_id)?\s*[:=]\s*['"]?([A-Za-z0-9_.:-]+)['"]?|\[\s*instance\s+([A-Za-z0-9_.:-]+)\s*\]/i;

const GROUP_TAG_RE =
  /\b(?:group(?:_name|_id)?|comm_group|pg_name)\s*[:=]\s*['"]?([A-Za-z0-9_.:-]+)['"]?|\[\s*group\s+([A-Za-z0-9_.:-]+)\s*\]|\bgroup\s+(?!(?:is|are|was|were|be|been|of|for|by|on|in|to|from|with|at|as|and|or|not|no|init|initialized|timeout|failed|error)\b)([A-Za-z0-9_.:-]+)\b/i;

function extractInstanceTag(line: string): string | null {
  const headerSlice = getStructuredHeaderSlice(capLineWindow(line));
  if (!headerSlice) return null;
  const m = INSTANCE_TAG_RE.exec(headerSlice);
  const val = (m?.[1] ?? m?.[2] ?? "").trim();
  if (!val || !m) return null;
  const before = headerSlice.slice(Math.max(0, m.index - 24), m.index);
  if (/\b(?:from|to|peer|remote|src|dst|target|copying)\s+$/i.test(before)) return null;
  return val;
}

function extractGroupTag(line: string): string | null {
  const headerSlice = getStructuredHeaderSlice(capLineWindow(line));
  if (!headerSlice) return null;
  const m = GROUP_TAG_RE.exec(headerSlice);
  const val = (m?.[1] ?? m?.[2] ?? m?.[3] ?? "").trim();
  if (!val || !m) return null;
  const before = headerSlice.slice(Math.max(0, m.index - 24), m.index);
  if (/\b(?:from|to|peer|remote|src|dst|target|copying)\s+$/i.test(before)) return null;
  return val;
}

const PID_RE = /\bpid\s*[:=]\s*(\d+)\b|\b(?:RUNTIME|HCCL|ASCENDCL|GE|DRV|HCCP|OP_HOST)\((\d+),/i;

const OMISSION_MARKER_RE =
  /^\s*\.\.\.\s*\[日志节选：[^\]]*(?:下行起原行号\s*L(\d+)|已省略第\s*\d+\s*[–-]\s*(\d+)\s*行)[^\]]*\]\s*\.\.\.\s*$/;

const COLLAPSE_KEYVAL_SEP_RE = /\s*([:=#])\s*/g;
const COLLAPSE_SPACE_KV_RE =
  /\b(Rank|rank|RANK|RankID|global_rank|local_rank|device|Device|device_id|host|Host|node|Node|NPU)\s+(\d+)\b/g;

function isValidUnclosedHeaderPrefix(trimmedRem: string): boolean {
  if (trimmedRem.length > 82) return false;
  const open = trimmedRem[0];
  if (open !== "(" && open !== "[") return false;
  const body = trimmedRem.slice(1).trim();
  if (!body) return true;
  for (const part of body.split(/[,;]/)) {
    const seg = part.trim();
    if (!seg) continue;
    if (STRUCTURED_HEADER_SEGMENT_RE.test(seg)) continue;
    const collapsed = seg.replace(COLLAPSE_KEYVAL_SEP_RE, "$1").replace(COLLAPSE_SPACE_KV_RE, "$1:$2");
    for (const tok of collapsed.split(/\s+/)) {
      if (tok && !STRUCTURED_HEADER_SEGMENT_RE.test(tok)) return false;
    }
  }
  return true;
}

function isValidHeaderPrefixBeforePid(beforePid: string): boolean {
  const rem = stripLeadingHeaderPrefixTokens(beforePid);
  if (/^\s*$/.test(rem)) return true;
  return isValidUnclosedHeaderPrefix(rem.trimStart());
}

function extractHeaderPid(line: string): number | null {
  const inspect = capLineWindow(line);
  const m = PID_RE.exec(inspect);
  const raw = m?.[1] ?? m?.[2];
  if (!raw || !m) return null;
  const before = inspect.slice(Math.max(0, m.index - 16), m.index);
  if (/\b(?:from|to|peer|remote|src|dst|target)\s+$/i.test(before)) return null;
  const fullBefore = inspect.slice(0, m.index);
  const exc = RANK_BODY_BOUNDARY_RE.exec(inspect);
  if ((exc && m.index > exc.index) || !isValidHeaderPrefixBeforePid(fullBefore)) {
    if (m[1] !== undefined && !(exc && m.index > exc.index)) {
      const openParenIdx = fullBefore.lastIndexOf("(");
      if (
        openParenIdx >= 0 &&
        (openParenIdx === 0 || /[\s\]):]/.test(fullBefore[openParenIdx - 1]!)) &&
        isValidHeaderPrefixBeforePid(fullBefore.slice(0, openParenIdx)) &&
        CANN_TUPLE_PID_RE.test(inspect.slice(openParenIdx))
      ) {
        const val = Number.parseInt(raw, 10);
        return Number.isFinite(val) ? val : null;
      }
    }
    return null;
  }
  const val = Number.parseInt(raw, 10);
  return Number.isFinite(val) ? val : null;
}

const VISIBLE_DEVICES_VAL_RE =
  /^(?:'([^'\r\n]{0,256})'|"([^"\r\n]{0,256})"|([^\s'"\r\n;)\]},][^\s'"\r\n;)\]},]*(?:\s*,\s*[^\s'"\r\n;)\]},]*)*))/;

interface VisibleDevicesEntry {
  lineNumber: number;
  segmentId: number;
  timestampMs: number | null;
  timestampSubMs: number;
  timestampKind: ParsedLogLine["timestampKind"];
  hasExplicitTimezone: boolean;
  inferredYearMatched: boolean;
  hostTag: string | null;
  instanceTag: string | null;
  groupTag: string | null;
  pid: number | null;
  devices: number[] | null;
  valid: boolean;
}

const SHELL_PRINT_CMD_RE = /^(?:echo|printf|logger|grep|egrep|fgrep|rg|sed|awk|cat|unset)$/i;
const SHELL_INLINE_PRINT_ARG_RE = /\b(?:echo|printf)\s+(?:-[A-Za-z]+\s+)*$/i;

const SHELL_WRAPPER_ARG_OPT_MAP: ReadonlyMap<string, RegExp> = new Map([
  [
    "env",
    /^\s+(?:-[A-Za-z0-9]*(?:u|C|S)|--(?:unset|chdir|split-string|argv0|block-signal|default-signal|ignore-signal))\s+(?:"[^"\r\n]{0,256}"|'[^'\r\n]{0,256}'|[^\s]+)/,
  ],
  ["exec", /^\s+(?:-[A-Za-z0-9]*a)\s+(?:"[^"\r\n]{0,256}"|'[^'\r\n]{0,256}'|[^\s]+)/],
  ["nice", /^\s+(?:-[A-Za-z0-9]*n|--adjustment)\s+[^\s]+/],
  [
    "sudo",
    /^\s+(?:-[A-Za-z0-9]*(?:u|g|C|h|p|r|t|U)|--(?:user|group|close-from|host|prompt|role|type|other-user))\s+(?:"[^"\r\n]{0,256}"|'[^'\r\n]{0,256}'|[^\s]+)/,
  ],
  ["timeout", /^\s+(?:-[A-Za-z0-9]*(?:s|k)|--(?:signal|kill-after))\s+[^\s]+/],
  [
    "xargs",
    /^\s+(?:-[A-Za-z0-9]*(?:a|d|E|I|L|n|P|s)|--(?:arg-file|delimiter|eof|replace|max-lines|max-args|max-procs|max-chars))\s+(?:"[^"\r\n]{0,256}"|'[^'\r\n]{0,256}'|[^\s]+)/,
  ],
  ["stdbuf", /^\s+(?:-[A-Za-z0-9]*(?:i|o|e)|--(?:input|output|error))\s+[^\s]+/],
]);
const SHELL_WRAPPER_SIMPLE_OPT_RE =
  /^\s+(?:--(?=\s|$)|--?[A-Za-z0-9][A-Za-z0-9_-]{0,64}(?:=(?:"[^"\r\n]{0,256}"|'[^'\r\n]{0,256}'|[^\s]{0,256}))?|(?!ASCEND_RT_VISIBLE_DEVICES\s*=)[A-Za-z_][A-Za-z0-9_]{0,64}=(?:"[^"\r\n]{0,256}"|'[^'\r\n]{0,256}'|[^\s]{0,256}))(?=\s|$)/i;
const SHELL_DURATION_ARG_RE = /^\s+\d+(?:\.\d+)?[smhd]?(?=\s|$)/i;

function extractTokenBaseName(token: string): string {
  const slashIdx = Math.max(token.lastIndexOf("/"), token.lastIndexOf("\\"));
  return slashIdx >= 0 ? token.slice(slashIdx + 1) : token;
}

function extractLeadingShellCommandToken(s: string): { rawLen: number; unquoted: string } | null {
  const m = /^(?:"([^"\r\n]+)"|'([^'\r\n]+)'|([^\s]+))/.exec(s);
  if (!m) return null;
  return { rawLen: m[0].length, unquoted: m[1] ?? m[2] ?? m[3]! };
}

function isShellNonAssignmentClausePrefix(inspect: string, clauseStart: number, keyStart: number): boolean {
  let clausePrefix = inspect.slice(clauseStart, keyStart);
  if (clauseStart === 0) {
    clausePrefix = stripLeadingHeaderPrefixTokens(clausePrefix, 32);
  }
  if (SHELL_INLINE_PRINT_ARG_RE.test(clausePrefix)) return true;
  let cleanedClause = clausePrefix
    .trimStart()
    .replace(/^(?:[$+>]\s+)+/, "")
    .replace(/^(?:cmd|command|exec|run|running|debug|output|stdout)\s*:\s*/i, "");
  for (let envStep = 0; envStep < 16; envStep += 1) {
    const envPrefix =
      /^(?!ASCEND_RT_VISIBLE_DEVICES\s*=)[A-Za-z_][A-Za-z0-9_]{0,64}=(?:"[^"\r\n]{0,256}"|'[^'\r\n]{0,256}'|[^\s"';|&()<>]{0,256})\s+/i.exec(
        cleanedClause,
      );
    if (!envPrefix) break;
    cleanedClause = cleanedClause.slice(envPrefix[0].length);
  }
  for (let step = 0; step < 8; step += 1) {
    const cmdTok = extractLeadingShellCommandToken(cleanedClause);
    if (!cmdTok) break;
    const baseCmd = extractTokenBaseName(cmdTok.unquoted).toLowerCase();
    if (
      baseCmd !== "command" &&
      baseCmd !== "builtin" &&
      baseCmd !== "time" &&
      baseCmd !== "nice" &&
      baseCmd !== "nohup" &&
      baseCmd !== "env" &&
      baseCmd !== "sudo" &&
      baseCmd !== "exec" &&
      baseCmd !== "timeout" &&
      baseCmd !== "xargs" &&
      baseCmd !== "stdbuf"
    ) {
      break;
    }
    let rest = cleanedClause.slice(cmdTok.rawLen);
    const argOptRe = SHELL_WRAPPER_ARG_OPT_MAP.get(baseCmd);
    let consumedTimeoutDuration = false;
    for (let argStep = 0; argStep < 16; argStep += 1) {
      if (/^\s+--(?=\s|$)/.test(rest)) {
        rest = rest.slice(/^\s+--/.exec(rest)![0].length);
        break;
      }
      const argOpt = argOptRe?.exec(rest) ?? SHELL_WRAPPER_SIMPLE_OPT_RE.exec(rest);
      if (argOpt) {
        rest = rest.slice(argOpt[0].length);
        continue;
      }
      if (baseCmd === "timeout" && !consumedTimeoutDuration) {
        const durM = SHELL_DURATION_ARG_RE.exec(rest);
        if (durM) {
          consumedTimeoutDuration = true;
          rest = rest.slice(durM[0].length);
          continue;
        }
      }
      break;
    }
    if (!/^\s+/.test(rest)) break;
    cleanedClause = rest.trimStart();
  }
  const firstTok = extractLeadingShellCommandToken(cleanedClause);
  const firstWord = firstTok ? extractTokenBaseName(firstTok.unquoted) : undefined;
  return Boolean(firstWord && SHELL_PRINT_CMD_RE.test(firstWord));
}

function extractLastVisibleDevicesAssignment(inspect: string): {
  foundAssign: boolean;
  lastRawVal: string | null;
} {
  let foundAssign = false;
  let lastRawVal: string | null = null;
  const len = inspect.length;
  let i = 0;
  let clauseStart = 0;

  while (i < len) {
    const ch = inspect.charCodeAt(i);
    if (ch === 35 /* # */ && (i === 0 || /[\s;|&(]/.test(inspect[i - 1]!))) {
      break;
    }
    if (
      ch === 59 /* ; */ ||
      ch === 38 /* & */ ||
      ch === 124 /* | */ ||
      ch === 40 /* ( */ ||
      ch === 41 /* ) */ ||
      ch === 10 ||
      ch === 13
    ) {
      clauseStart = i + 1;
      i += 1;
      continue;
    }
    if (ch === 34 /* " */ || ch === 39 /* ' */) {
      const q = ch;
      const tail = inspect.slice(i);
      const quotedKeyMatch =
        q === 34
          ? /^"ASCEND_RT_VISIBLE_DEVICES"\s*:\s*/.exec(tail)
          : /^'ASCEND_RT_VISIBLE_DEVICES'\s*:\s*/.exec(tail);
      if (quotedKeyMatch && !isShellNonAssignmentClausePrefix(inspect, clauseStart, i)) {
        foundAssign = true;
        const valStart = i + quotedKeyMatch[0].length;
        const vm = VISIBLE_DEVICES_VAL_RE.exec(inspect.slice(valStart));
        if (vm) {
          lastRawVal = vm[1] ?? vm[2] ?? vm[3] ?? null;
          i = valStart + vm[0].length;
        } else {
          lastRawVal = null;
          i = valStart;
        }
        continue;
      }
      const prevChar = i > 0 ? inspect[i - 1]! : "";
      const beforeQuote = inspect.slice(Math.max(0, i - 32), i);
      const allowQuotedShellAssign =
        prevChar !== "=" &&
        prevChar !== ":" &&
        /(?:^|[\s;|&(])(?:-e|--env|env|export)\s+$/.test(beforeQuote) &&
        !isShellNonAssignmentClausePrefix(inspect, clauseStart, i) &&
        (inspect.startsWith("ASCEND_RT_VISIBLE_DEVICES=", i + 1) ||
          inspect.startsWith("ASCEND_RT_VISIBLE_DEVICES:", i + 1));
      if (allowQuotedShellAssign) {
        i += 1;
        const keyLen = "ASCEND_RT_VISIBLE_DEVICES".length + 1;
        foundAssign = true;
        const valStart = i + keyLen;
        const qEndRel = inspect.slice(valStart).indexOf(String.fromCharCode(q));
        const valSlice = qEndRel >= 0 ? inspect.slice(valStart, valStart + qEndRel) : inspect.slice(valStart);
        const vm = VISIBLE_DEVICES_VAL_RE.exec(valSlice.trimStart());
        lastRawVal = vm ? (vm[1] ?? vm[2] ?? vm[3] ?? null) : null;
        i = qEndRel >= 0 ? valStart + qEndRel + 1 : len;
        continue;
      }
      i += 1;
      while (i < len) {
        const c = inspect.charCodeAt(i);
        if (c === 92 /* \ */) {
          i += 2;
          continue;
        }
        if (c === q) {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }

    if (inspect.startsWith("ASCEND_RT_VISIBLE_DEVICES", i)) {
      const prevOk = i === 0 || !/[A-Za-z0-9_]/.test(inspect[i - 1]!);
      const afterKeyIdx = i + "ASCEND_RT_VISIBLE_DEVICES".length;
      const sepMatch = /^(?:\s*[:=]\s*|\s+)/.exec(inspect.slice(afterKeyIdx));
      if (prevOk && sepMatch) {
        const hasExplicitSep = sepMatch[0].includes("=") || sepMatch[0].includes(":");
        const valStart = afterKeyIdx + sepMatch[0].length;
        const vm = VISIBLE_DEVICES_VAL_RE.exec(inspect.slice(valStart));
        if (isShellNonAssignmentClausePrefix(inspect, clauseStart, i)) {
          i = vm ? valStart + vm[0].length : valStart;
          continue;
        }
        if (vm) {
          foundAssign = true;
          lastRawVal = vm[1] ?? vm[2] ?? vm[3] ?? null;
          i = valStart + vm[0].length;
          continue;
        }
        if (hasExplicitSep) {
          foundAssign = true;
          lastRawVal = null;
          i = valStart;
          continue;
        }
      }
    }
    i += 1;
  }

  return { foundAssign, lastRawVal };
}

function parseStrictVisibleDeviceCsv(rawToken: string): number[] | null {
  const parts = rawToken.split(",").map((s) => s.trim());
  if (parts.length === 0 || parts.some((p) => !/^\d{1,5}$/.test(p))) return null;
  const nums = parts.map((p) => Number.parseInt(p, 10));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n >= 4096) || new Set(nums).size !== nums.length) {
    return null;
  }
  return nums;
}

function extractVisibleDevicesEntries(
  rawLines: readonly string[],
  parsedLines?: readonly ParsedLogLine[],
): VisibleDevicesEntry[] {
  const entries: VisibleDevicesEntry[] = [];
  const hasPromExposition = rawLines.some((rl) => {
    const t = rl.trim();
    return PROM_COMMENT_HEADER_RE.test(t) || parsePromMetricSampleLine(t) !== null;
  });
  for (let i = 0; i < rawLines.length; i += 1) {
    const rl = rawLines[i]!;
    if (!rl.includes("ASCEND_RT_VISIBLE_DEVICES")) continue;
    const trimmed = rl.trim();
    if (
      PROM_COMMENT_HEADER_RE.test(trimmed) ||
      trimmed.startsWith("#") ||
      (hasPromExposition && trimmed.startsWith("#")) ||
      parsePromMetricSampleLine(trimmed) !== null
    ) {
      continue;
    }
    const inspect = capLineWindow(rl);
    const { foundAssign, lastRawVal } = extractLastVisibleDevicesAssignment(inspect);
    if (!foundAssign) continue;
    const parsed = parsedLines?.[i];
    const parsedTs = parsed ?? extractTimestamp(inspect);
    const base = {
      lineNumber: parsed ? parsed.lineNumber : i + 1,
      segmentId: parsed ? parsed.segmentId : 0,
      timestampMs: parsedTs.timestampMs ?? null,
      timestampSubMs: parsedTs.timestampSubMs ?? 0,
      timestampKind: parsedTs.timestampKind ?? null,
      hasExplicitTimezone: parsedTs.hasExplicitTimezone ?? false,
      inferredYearMatched: parsed ? parsed.inferredYearMatched : false,
      hostTag: parsed ? parsed.hostTag : extractHostTag(rl),
      instanceTag: parsed ? parsed.instanceTag : extractInstanceTag(rl),
      groupTag: parsed ? parsed.groupTag : extractGroupTag(rl),
      pid: parsed ? parsed.pid : extractHeaderPid(rl),
    };
    const nums = lastRawVal !== null ? parseStrictVisibleDeviceCsv(lastRawVal) : null;
    entries.push({ ...base, devices: nums, valid: nums !== null });
  }
  return entries;
}

function visibleDevicesOwnerKey(e: VisibleDevicesEntry): string {
  return `${(e.hostTag ?? "").toLowerCase()}#${(e.instanceTag ?? "").toLowerCase()}#${(e.groupTag ?? "").toLowerCase()}#${e.pid ?? ""}`;
}

interface VisibleDevicesCacheEntry {
  staticResult?: { visibleDevices: number[] | null; hasAmbiguousVisibleDevices: boolean };
  sameOwnerGroupPools?: readonly VisDomGroup[];
  sameOwnerMultiSigPool?: readonly VisibleDevicesEntry[];
  sameOwnerPoolOrderedOk?: boolean;
  solePoolIndexes?: SoleVisPoolIndex[];
  soleSampleDevices?: number[];
}

interface VisDomGroup {
  gid: number;
  domKey: string;
  hostKey: string;
  instKey: string;
  grpKey: string;
  hostTag: string | null;
  instanceTag: string | null;
  groupTag: string | null;
  pid: number | null;
  entries: VisibleDevicesEntry[];
  sigState: "single" | "multi" | "invalid";
  singleSig: string | null;
  ownerKey: string;
  soleIdx?: SoleVisPoolIndex;
  sortedEntries?: readonly VisibleDevicesEntry[];
  badSegs?: ReadonlySet<number>;
  segTierMap?: Map<number, { allByLine: VisibleDevicesEntry[]; byTier: Map<number, VisibleDevicesEntry[]> }>;
}

interface VisBucketSummary {
  sigState: "empty" | "single" | "multi" | "invalid";
  singleSig: string | null;
  distinctOwnersSize: number;
  soleOwnerKey: string | null;
  soleGroupPools?: SoleVisPoolIndex[];
  sampleDevices?: number[];
}

interface VisDomBucket {
  groups: VisDomGroup[];
  summary?: VisBucketSummary;
  collapsedGroup?: VisDomGroup;
}

let nextCollapsedVisGroupSeq = 1;

function getCollapsedVisBucketGroup(bucket: VisDomBucket): VisDomGroup {
  if (bucket.groups.length === 1) return bucket.groups[0]!;
  if (bucket.collapsedGroup) return bucket.collapsedGroup;
  const merged: VisibleDevicesEntry[] = [];
  for (const g of bucket.groups) {
    for (const e of g.entries) merged.push(e);
  }
  merged.sort((a, b) => a.segmentId - b.segmentId || a.lineNumber - b.lineNumber);
  const first = bucket.groups[0]!;
  const collapsed: VisDomGroup = {
    gid: -nextCollapsedVisGroupSeq++,
    domKey: first.domKey,
    hostKey: first.hostKey,
    instKey: first.instKey,
    grpKey: first.grpKey,
    hostTag: first.hostTag,
    instanceTag: first.instanceTag,
    groupTag: first.groupTag,
    pid: first.pid,
    entries: merged,
    sigState:
      bucket.summary?.sigState === "single"
        ? "single"
        : bucket.summary?.sigState === "invalid"
          ? "invalid"
          : "multi",
    singleSig: bucket.summary?.singleSig ?? null,
    ownerKey: first.ownerKey,
    sortedEntries: merged,
  };
  bucket.collapsedGroup = collapsed;
  return collapsed;
}

interface VisDomAxisIndex {
  nextGid: number;
  byDom: Map<string, VisDomGroup>;
  byHostInst: Map<string, VisDomBucket>;
  byHostGrp: Map<string, VisDomBucket>;
  byInstGrp: Map<string, VisDomBucket>;
  byHost: Map<string, VisDomBucket>;
  byInstance: Map<string, VisDomBucket>;
  byGroup: Map<string, VisDomBucket>;
  allBucket: VisDomBucket;
}

interface VisibleDevicesLookupCache {
  entries: readonly VisibleDevicesEntry[];
  byPid: Map<number, VisibleDevicesEntry[]>;
  byPidDomAxis: Map<number, VisDomAxisIndex>;
  unscopedPidAxis: VisDomAxisIndex;
  allAxis: VisDomAxisIndex;
  byInstance: Map<string, VisibleDevicesEntry[]>;
  unscopedInstanceEntries: VisibleDevicesEntry[];
  byHost: Map<string, VisibleDevicesEntry[]>;
  unscopedHostEntries: VisibleDevicesEntry[];
  byGroup: Map<string, VisibleDevicesEntry[]>;
  unscopedGroupEntries: VisibleDevicesEntry[];
  processResetBucket?: DomainIndexedBucket | undefined;
  cache: Map<string, VisibleDevicesCacheEntry>;
  multiPoolCache: Map<string, readonly VisibleDevicesEntry[]>;
  badSegPairMemo: Map<string, boolean>;
}

function createVisDomAxisIndex(): VisDomAxisIndex {
  return {
    nextGid: 1,
    byDom: new Map(),
    byHostInst: new Map(),
    byHostGrp: new Map(),
    byInstGrp: new Map(),
    byHost: new Map(),
    byInstance: new Map(),
    byGroup: new Map(),
    allBucket: { groups: [] },
  };
}

function pushGroupToVisBucketMap(map: Map<string, VisDomBucket>, key: string, g: VisDomGroup): void {
  let b = map.get(key);
  if (!b) {
    b = { groups: [] };
    map.set(key, b);
  }
  b.groups.push(g);
}

function addEntryToVisDomAxisIndex(axis: VisDomAxisIndex, e: VisibleDevicesEntry): void {
  const hKey = (e.hostTag ?? "").toLowerCase();
  const iKey = (e.instanceTag ?? "").toLowerCase();
  const gKey = (e.groupTag ?? "").toLowerCase();
  const domKey = `${hKey}\u0000${iKey}\u0000${gKey}`;
  const sig = e.valid && e.devices ? e.devices.join(",") : "__INVALID__";
  let g = axis.byDom.get(domKey);
  if (!g) {
    g = {
      gid: axis.nextGid++,
      domKey,
      hostKey: hKey,
      instKey: iKey,
      grpKey: gKey,
      hostTag: e.hostTag,
      instanceTag: e.instanceTag,
      groupTag: e.groupTag,
      pid: e.pid,
      entries: [e],
      sigState: sig === "__INVALID__" ? "invalid" : "single",
      singleSig: sig === "__INVALID__" ? null : sig,
      ownerKey: visibleDevicesOwnerKey(e),
    };
    axis.byDom.set(domKey, g);
    axis.allBucket.groups.push(g);
    pushGroupToVisBucketMap(axis.byHostInst, `${hKey}\u0000${iKey}`, g);
    pushGroupToVisBucketMap(axis.byHostGrp, `${hKey}\u0000${gKey}`, g);
    pushGroupToVisBucketMap(axis.byInstGrp, `${iKey}\u0000${gKey}`, g);
    pushGroupToVisBucketMap(axis.byHost, hKey, g);
    pushGroupToVisBucketMap(axis.byInstance, iKey, g);
    pushGroupToVisBucketMap(axis.byGroup, gKey, g);
    return;
  }
  g.entries.push(e);
  if (g.ownerKey !== visibleDevicesOwnerKey(e)) {
    g.sigState = "invalid";
    g.singleSig = null;
  } else if (g.sigState !== "invalid") {
    if (sig === "__INVALID__") {
      g.sigState = "invalid";
      g.singleSig = null;
    } else if (g.singleSig !== sig) {
      g.sigState = "multi";
      g.singleSig = null;
    }
  }
}

function summarizeVisDomBucket(bucket: VisDomBucket): VisBucketSummary {
  if (bucket.summary) return bucket.summary;
  if (bucket.groups.length === 0) {
    bucket.summary = { sigState: "empty", singleSig: null, distinctOwnersSize: 0, soleOwnerKey: null };
    return bucket.summary;
  }
  let sharedSig: string | null = null;
  let sigState: VisBucketSummary["sigState"] = "single";
  const ownerSet = new Set<string>();
  for (const g of bucket.groups) {
    if (activeScaleProbe) activeScaleProbe.visCandidateScans += 1;
    if (ownerSet.size < 2) ownerSet.add(g.ownerKey);
    if (g.sigState === "invalid") {
      sigState = "invalid";
      sharedSig = null;
    } else if (g.sigState === "multi") {
      if (sigState === "single") sigState = "multi";
      sharedSig = null;
    } else if (sigState === "single") {
      if (sharedSig === null) sharedSig = g.singleSig;
      else if (sharedSig !== g.singleSig) {
        sigState = "multi";
        sharedSig = null;
      }
    }
  }
  if (sigState === "single" && sharedSig !== null) {
    let soleGroupPools: SoleVisPoolIndex[];
    if (bucket.groups.length === 1) {
      const g = bucket.groups[0]!;
      if (!g.soleIdx) {
        const sorted =
          g.entries.length > 1 ? [...g.entries].sort((a, b) => a.lineNumber - b.lineNumber) : g.entries;
        g.soleIdx = buildSoleVisPoolIndex(sorted);
      }
      soleGroupPools = [g.soleIdx];
    } else {
      const merged: VisibleDevicesEntry[] = [];
      for (const g of bucket.groups) {
        for (const e of g.entries) merged.push(e);
      }
      merged.sort((a, b) => a.lineNumber - b.lineNumber);
      soleGroupPools = [buildSoleVisPoolIndex(merged)];
    }
    const sampleDevices = bucket.groups[0]!.entries[0]!.devices!;
    bucket.summary = {
      sigState: "single",
      singleSig: sharedSig,
      distinctOwnersSize: ownerSet.size,
      soleOwnerKey: ownerSet.size === 1 ? (ownerSet.values().next().value ?? null) : null,
      soleGroupPools,
      sampleDevices,
    };
    return bucket.summary;
  }
  bucket.summary = {
    sigState,
    singleSig: null,
    distinctOwnersSize: ownerSet.size,
    soleOwnerKey: ownerSet.size === 1 ? (ownerSet.values().next().value ?? null) : null,
  };
  return bucket.summary;
}

function pushVisEntry(
  map: Map<string, VisibleDevicesEntry[]>,
  key: string | null,
  unscoped: VisibleDevicesEntry[],
  e: VisibleDevicesEntry,
): void {
  if (key !== null) {
    const k = key.toLowerCase();
    let arr = map.get(k);
    if (!arr) {
      arr = [];
      map.set(k, arr);
    }
    arr.push(e);
  } else {
    unscoped.push(e);
  }
}

function createVisibleDevicesCache(
  entries: readonly VisibleDevicesEntry[],
  processResetBucket?: DomainIndexedBucket,
): VisibleDevicesLookupCache {
  const byPid = new Map<number, VisibleDevicesEntry[]>();
  const byPidDomAxis = new Map<number, VisDomAxisIndex>();
  const unscopedPidAxis = createVisDomAxisIndex();
  const allAxis = createVisDomAxisIndex();
  const byInstance = new Map<string, VisibleDevicesEntry[]>();
  const unscopedInstanceEntries: VisibleDevicesEntry[] = [];
  const byHost = new Map<string, VisibleDevicesEntry[]>();
  const unscopedHostEntries: VisibleDevicesEntry[] = [];
  const byGroup = new Map<string, VisibleDevicesEntry[]>();
  const unscopedGroupEntries: VisibleDevicesEntry[] = [];
  for (const e of entries) {
    if (activeScaleProbe) activeScaleProbe.visCandidateScans += 1;
    addEntryToVisDomAxisIndex(allAxis, e);
    if (e.pid !== null) {
      let arr = byPid.get(e.pid);
      if (!arr) {
        arr = [];
        byPid.set(e.pid, arr);
      }
      arr.push(e);
      let pAxis = byPidDomAxis.get(e.pid);
      if (!pAxis) {
        pAxis = createVisDomAxisIndex();
        byPidDomAxis.set(e.pid, pAxis);
      }
      addEntryToVisDomAxisIndex(pAxis, e);
    } else {
      addEntryToVisDomAxisIndex(unscopedPidAxis, e);
    }
    pushVisEntry(byInstance, e.instanceTag, unscopedInstanceEntries, e);
    pushVisEntry(byHost, e.hostTag, unscopedHostEntries, e);
    pushVisEntry(byGroup, e.groupTag, unscopedGroupEntries, e);
  }
  return {
    entries,
    byPid,
    byPidDomAxis,
    unscopedPidAxis,
    allAxis,
    byInstance,
    unscopedInstanceEntries,
    byHost,
    unscopedHostEntries,
    byGroup,
    unscopedGroupEntries,
    processResetBucket,
    cache: new Map(),
    multiPoolCache: new Map(),
    badSegPairMemo: new Map(),
  };
}

interface SoleSegVisTierIndex {
  entriesByLine: VisibleDevicesEntry[];
  entriesSortedByTs: VisibleDevicesEntry[];
  prefixMinEntry: VisibleDevicesEntry[];
  prefixMaxLineEntry: VisibleDevicesEntry[];
}

interface SoleSegVisIndex {
  entriesByLine: VisibleDevicesEntry[];
  untimestamped: VisibleDevicesEntry[];
  byTier: Map<number, SoleSegVisTierIndex>;
}

interface SoleVisPoolIndex {
  soleLast: VisibleDevicesEntry;
  bySeg: Map<number, SoleSegVisIndex>;
}

const visPoolBadSegmentsMemo = new WeakMap<readonly VisibleDevicesEntry[], ReadonlySet<number>>();

function toBoundaryProbeLine(
  lineNumber: number,
  segmentId: number,
  timestampMs: number | null,
  hostTag: string | null,
  instanceTag: string | null,
  groupTag: string | null,
  rank: number | null = null,
  timestampSubMs = 0,
  timestampKind: ParsedLogLine["timestampKind"] = null,
  hasExplicitTimezone = false,
  inferredYearMatched = false,
  pid: number | null = null,
): ParsedLogLine {
  return {
    lineNumber,
    segmentId,
    rawLine: "",
    inspectLine: "",
    trimmed: "",
    timestamp: null,
    timestampMs,
    timestampSubMs,
    timestampKind,
    hasExplicitTimezone,
    inferredYearMatched,
    rank,
    rankSource: null,
    hostTag,
    instanceTag,
    groupTag,
    pid,
    tracebackGroupId: null,
  };
}

function toVisEntryProbeLine(entry: VisibleDevicesEntry): ParsedLogLine {
  return toBoundaryProbeLine(
    entry.lineNumber,
    entry.segmentId,
    entry.timestampMs,
    entry.hostTag,
    entry.instanceTag,
    entry.groupTag,
    null,
    entry.timestampSubMs,
    entry.timestampKind,
    entry.hasExplicitTimezone,
    entry.inferredYearMatched,
    entry.pid,
  );
}

function buildSoleVisPoolIndex(sortedPool: readonly VisibleDevicesEntry[]): SoleVisPoolIndex {
  const bySeg = new Map<number, SoleSegVisIndex>();
  for (const e of sortedPool) {
    if (activeScaleProbe) activeScaleProbe.visCandidateScans += 1;
    let seg = bySeg.get(e.segmentId);
    if (!seg) {
      seg = {
        entriesByLine: [],
        untimestamped: [],
        byTier: new Map(),
      };
      bySeg.set(e.segmentId, seg);
    }
    seg.entriesByLine.push(e);
    if (e.timestampMs === null) {
      seg.untimestamped.push(e);
    } else {
      const tierKey = getLifecycleTierKey({
        timestampMs: e.timestampMs,
        timestampKind: e.timestampKind,
        hasExplicitTimezone: e.hasExplicitTimezone,
        inferredYearMatched: e.inferredYearMatched,
      });
      let tier = seg.byTier.get(tierKey);
      if (!tier) {
        tier = { entriesByLine: [], entriesSortedByTs: [], prefixMinEntry: [], prefixMaxLineEntry: [] };
        seg.byTier.set(tierKey, tier);
      }
      tier.entriesByLine.push(e);
    }
  }
  for (const seg of bySeg.values()) {
    for (const tier of seg.byTier.values()) {
      const sorted = [...tier.entriesByLine].sort(
        (a, b) =>
          compareTimestampOrder(toVisEntryProbeLine(a), toVisEntryProbeLine(b)) ||
          a.lineNumber - b.lineNumber,
      );
      tier.entriesSortedByTs = sorted;
      let bestMin = sorted[0]!;
      let bestMax = sorted[0]!;
      tier.prefixMinEntry = [];
      tier.prefixMaxLineEntry = [];
      for (const cand of sorted) {
        if (cand.lineNumber < bestMin.lineNumber) bestMin = cand;
        if (cand.lineNumber > bestMax.lineNumber) bestMax = cand;
        tier.prefixMinEntry.push(bestMin);
        tier.prefixMaxLineEntry.push(bestMax);
      }
    }
  }
  return {
    soleLast: sortedPool[sortedPool.length - 1]!,
    bySeg,
  };
}

function getSameOwnerPoolBadSegments(pool: readonly VisibleDevicesEntry[]): ReadonlySet<number> {
  const cached = visPoolBadSegmentsMemo.get(pool);
  if (cached) return cached;
  const badSegments = new Set<number>();
  let curSeg = -1;
  let prevProbe: ParsedLogLine | null = null;
  for (const e of pool) {
    if (e.segmentId !== curSeg) {
      curSeg = e.segmentId;
      prevProbe = null;
    }
    if (e.timestampMs !== null) {
      const eProbe = toVisEntryProbeLine(e);
      if (
        prevProbe !== null &&
        areTimestampsComparable(prevProbe, eProbe) &&
        compareTimestampOrder(eProbe, prevProbe) < 0
      ) {
        badSegments.add(curSeg);
      }
      prevProbe = eProbe;
    }
  }
  visPoolBadSegmentsMemo.set(pool, badSegments);
  return badSegments;
}

function isVisEntryInvalidAfterTarget(
  entry: VisibleDevicesEntry,
  verdictTarget: {
    lineNumber?: number;
    segmentId?: number;
    timestampMs?: number | null;
    timestampSubMs?: number;
    timestampKind?: ParsedLogLine["timestampKind"];
    hasExplicitTimezone?: boolean;
    inferredYearMatched?: boolean;
    rank?: number | null;
    pid?: number | null;
    hostTag: string | null;
    instanceTag: string | null;
    groupTag: string | null;
  },
  startupBoundaryBucket?: DomainIndexedBucket,
  processResetBucket?: DomainIndexedBucket,
): boolean {
  if (verdictTarget.segmentId !== undefined && entry.segmentId !== verdictTarget.segmentId) {
    return true;
  }
  const tProbe = toBoundaryProbeLine(
    verdictTarget.lineNumber ?? 0,
    verdictTarget.segmentId ?? 0,
    verdictTarget.timestampMs ?? null,
    verdictTarget.hostTag,
    verdictTarget.instanceTag,
    verdictTarget.groupTag,
    verdictTarget.rank ?? null,
    verdictTarget.timestampSubMs ?? 0,
    verdictTarget.timestampKind ?? null,
    verdictTarget.hasExplicitTimezone ?? false,
    verdictTarget.inferredYearMatched ?? false,
    verdictTarget.pid ?? null,
  );
  const eProbe = toVisEntryProbeLine(entry);
  if (
    tProbe.timestampMs !== null &&
    eProbe.timestampMs !== null &&
    areTimestampsComparable(eProbe, tProbe) &&
    compareTimestampOrder(eProbe, tProbe) > 0
  ) {
    return true;
  }
  if (
    startupBoundaryBucket &&
    verdictTarget.lineNumber !== undefined &&
    verdictTarget.segmentId !== undefined &&
    entry.segmentId === verdictTarget.segmentId &&
    entry.lineNumber > verdictTarget.lineNumber
  ) {
    if (hasStartupBoundaryBetween(startupBoundaryBucket, tProbe, eProbe, false)) {
      return true;
    }
  }
  if (
    processResetBucket &&
    verdictTarget.lineNumber !== undefined &&
    verdictTarget.segmentId !== undefined &&
    (entry.lineNumber < verdictTarget.lineNumber ||
      (tProbe.timestampMs !== null &&
        eProbe.timestampMs !== null &&
        areTimestampsComparable(eProbe, tProbe) &&
        compareTimestampOrder(eProbe, tProbe) <= 0))
  ) {
    if (hasStartupBoundaryBetween(processResetBucket, eProbe, tProbe, true, true)) {
      return true;
    }
  }
  return false;
}

function getSortedVisGroupEntries(g: VisDomGroup): readonly VisibleDevicesEntry[] {
  if (!g.sortedEntries) {
    g.sortedEntries =
      g.entries.length > 1
        ? [...g.entries].sort((a, b) => a.segmentId - b.segmentId || a.lineNumber - b.lineNumber)
        : g.entries;
  }
  return g.sortedEntries;
}

function getVisGroupSegTierMap(
  g: VisDomGroup,
): Map<number, { allByLine: VisibleDevicesEntry[]; byTier: Map<number, VisibleDevicesEntry[]> }> {
  if (g.segTierMap) return g.segTierMap;
  const map = new Map<
    number,
    { allByLine: VisibleDevicesEntry[]; byTier: Map<number, VisibleDevicesEntry[]> }
  >();
  for (const e of getSortedVisGroupEntries(g)) {
    let segRec = map.get(e.segmentId);
    if (!segRec) {
      segRec = { allByLine: [], byTier: new Map() };
      map.set(e.segmentId, segRec);
    }
    segRec.allByLine.push(e);
    if (e.timestampMs !== null) {
      const tk = getLifecycleTierKey(e);
      let tArr = segRec.byTier.get(tk);
      if (!tArr) {
        tArr = [];
        segRec.byTier.set(tk, tArr);
      }
      tArr.push(e);
    }
  }
  g.segTierMap = map;
  return map;
}

function hasVisGroupPairBadSegment(
  ga: VisDomGroup,
  gb: VisDomGroup,
  segId: number,
  badSegPairMemo?: Map<string, boolean>,
): boolean {
  const key = ga.gid < gb.gid ? `${ga.gid}:${gb.gid}:${segId}` : `${gb.gid}:${ga.gid}:${segId}`;
  const cached = badSegPairMemo?.get(key);
  if (cached !== undefined) return cached;
  const sa = getVisGroupSegTierMap(ga).get(segId);
  const sb = getVisGroupSegTierMap(gb).get(segId);
  let inverted = false;
  if (sa && sb && sa.byTier.size > 0 && sb.byTier.size > 0) {
    const [small, large] = sa.allByLine.length <= sb.allByLine.length ? [sa, sb] : [sb, sa];
    for (const [tk, sArr] of small.byTier) {
      const lArr = large.byTier.get(tk);
      if (!lArr || lArr.length === 0) continue;
      for (const e of sArr) {
        if (activeScaleProbe) activeScaleProbe.visCandidateScans += 1;
        const eProbe = toVisEntryProbeLine(e);
        const pos = findRightmostTrue(lArr, (x) => x.lineNumber < e.lineNumber);
        for (let p = pos; p >= 0; p -= 1) {
          const prev = lArr[p]!;
          const pProbe = toVisEntryProbeLine(prev);
          if (areTimestampsComparable(pProbe, eProbe)) {
            if (compareTimestampOrder(eProbe, pProbe) < 0) inverted = true;
            break;
          }
        }
        if (inverted) break;
        for (let p = pos + 1; p < lArr.length; p += 1) {
          const next = lArr[p]!;
          const nProbe = toVisEntryProbeLine(next);
          if (areTimestampsComparable(eProbe, nProbe)) {
            if (compareTimestampOrder(nProbe, eProbe) < 0) inverted = true;
            break;
          }
        }
        if (inverted) break;
      }
      if (inverted) break;
    }
  }
  badSegPairMemo?.set(key, inverted);
  return inverted;
}

function resolveSameOwnerMultiGroupPools(
  groups: readonly VisDomGroup[],
  verdictTarget:
    | (Pick<
        ParsedLogLine,
        | "hostTag"
        | "instanceTag"
        | "groupTag"
        | "pid"
        | "timestampSubMs"
        | "timestampKind"
        | "hasExplicitTimezone"
        | "inferredYearMatched"
      > & {
        lineNumber?: number;
        segmentId?: number;
        timestampMs?: number | null;
        rank?: number | null;
      })
    | null,
  startupBoundaryBucket?: DomainIndexedBucket,
  processResetBucket?: DomainIndexedBucket,
  badSegPairMemo?: Map<string, boolean>,
): { visibleDevices: number[] | null; hasAmbiguousVisibleDevices: boolean } {
  if (groups.length === 1) {
    return resolveSameOwnerMultiRunPool(
      getSortedVisGroupEntries(groups[0]!),
      verdictTarget,
      startupBoundaryBucket,
      processResetBucket,
    );
  }
  if (!verdictTarget || verdictTarget.lineNumber === undefined) {
    return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  }
  const targetSeg = verdictTarget.segmentId;
  const targetLine = verdictTarget.lineNumber;
  let chosen: VisibleDevicesEntry | null = null;
  for (const g of groups) {
    if (activeScaleProbe) activeScaleProbe.visCandidateScans += 1;
    const pool = getSortedVisGroupEntries(g);
    const idx = findRightmostTrue(pool, (e) =>
      targetSeg === undefined
        ? e.lineNumber <= targetLine
        : e.segmentId < targetSeg || (e.segmentId === targetSeg && e.lineNumber <= targetLine),
    );
    if (idx < 0) continue;
    const cand = pool[idx]!;
    if (
      !chosen ||
      cand.segmentId > chosen.segmentId ||
      (cand.segmentId === chosen.segmentId && cand.lineNumber > chosen.lineNumber)
    ) {
      chosen = cand;
    }
  }
  if (!chosen) {
    return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  }
  if (targetSeg !== undefined && chosen.segmentId !== targetSeg) {
    return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  }
  for (const g of groups) {
    if (!g.badSegs) {
      g.badSegs = getSameOwnerPoolBadSegments(getSortedVisGroupEntries(g));
    }
    if (g.badSegs.has(chosen.segmentId)) {
      return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
    }
  }
  for (let aIdx = 0; aIdx < groups.length; aIdx += 1) {
    const ga = groups[aIdx]!;
    if (!getVisGroupSegTierMap(ga).has(chosen.segmentId)) continue;
    for (let bIdx = aIdx + 1; bIdx < groups.length; bIdx += 1) {
      const gb = groups[bIdx]!;
      if (!getVisGroupSegTierMap(gb).has(chosen.segmentId)) continue;
      if (hasVisGroupPairBadSegment(ga, gb, chosen.segmentId, badSegPairMemo)) {
        return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
      }
    }
  }
  if (!chosen.valid || chosen.devices === null) {
    return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  }
  if (isVisEntryInvalidAfterTarget(chosen, verdictTarget, startupBoundaryBucket, processResetBucket)) {
    return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  }
  return { visibleDevices: chosen.devices, hasAmbiguousVisibleDevices: false };
}

function resolveSameOwnerMultiRunPool(
  pool: readonly VisibleDevicesEntry[],
  verdictTarget:
    | (Pick<
        ParsedLogLine,
        | "hostTag"
        | "instanceTag"
        | "groupTag"
        | "pid"
        | "timestampSubMs"
        | "timestampKind"
        | "hasExplicitTimezone"
        | "inferredYearMatched"
      > & {
        lineNumber?: number;
        segmentId?: number;
        timestampMs?: number | null;
        rank?: number | null;
      })
    | null,
  startupBoundaryBucket?: DomainIndexedBucket,
  processResetBucket?: DomainIndexedBucket,
): { visibleDevices: number[] | null; hasAmbiguousVisibleDevices: boolean } {
  if (!verdictTarget || verdictTarget.lineNumber === undefined) {
    return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  }
  const targetSeg = verdictTarget.segmentId;
  const targetLine = verdictTarget.lineNumber;
  const idx = findRightmostTrue(pool, (e) =>
    targetSeg === undefined
      ? e.lineNumber <= targetLine
      : e.segmentId < targetSeg || (e.segmentId === targetSeg && e.lineNumber <= targetLine),
  );
  if (idx < 0) {
    return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  }
  const chosen = pool[idx]!;
  if (targetSeg !== undefined && chosen.segmentId !== targetSeg) {
    return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  }
  if (getSameOwnerPoolBadSegments(pool).has(chosen.segmentId)) {
    return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  }
  if (!chosen.valid || chosen.devices === null) {
    return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  }
  if (isVisEntryInvalidAfterTarget(chosen, verdictTarget, startupBoundaryBucket, processResetBucket)) {
    return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  }
  return { visibleDevices: chosen.devices, hasAmbiguousVisibleDevices: false };
}

function resolveVisibleDevicesForVerdict(
  entriesOrCache: readonly VisibleDevicesEntry[] | VisibleDevicesLookupCache,
  verdictTarget:
    | (Pick<
        ParsedLogLine,
        | "hostTag"
        | "instanceTag"
        | "groupTag"
        | "pid"
        | "timestampSubMs"
        | "timestampKind"
        | "hasExplicitTimezone"
        | "inferredYearMatched"
      > & {
        lineNumber?: number;
        segmentId?: number;
        timestampMs?: number | null;
        rank?: number | null;
      })
    | null,
  startupBoundaryBucket?: DomainIndexedBucket,
  processResetBucketArg?: DomainIndexedBucket,
): { visibleDevices: number[] | null; hasAmbiguousVisibleDevices: boolean } {
  const lookup = Array.isArray(entriesOrCache) ? null : (entriesOrCache as VisibleDevicesLookupCache);
  const processResetBucket = processResetBucketArg ?? lookup?.processResetBucket;
  const entries = lookup ? lookup.entries : (entriesOrCache as readonly VisibleDevicesEntry[]);
  if (entries.length === 0) return { visibleDevices: null, hasAmbiguousVisibleDevices: false };

  const resolveSoleFromPoolIdx = (poolIdx: SoleVisPoolIndex) => {
    const sample = poolIdx.soleLast;
    if (!sample.valid || sample.devices === null) {
      return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
    }
    if (!verdictTarget || verdictTarget.lineNumber === undefined) {
      return { visibleDevices: sample.devices, hasAmbiguousVisibleDevices: false };
    }
    const targetLine = verdictTarget.lineNumber;
    const isValidCand = (cand: VisibleDevicesEntry | undefined): boolean =>
      Boolean(
        cand && !isVisEntryInvalidAfterTarget(cand, verdictTarget, startupBoundaryBucket, processResetBucket),
      );
    const segIds =
      verdictTarget.segmentId !== undefined ? [verdictTarget.segmentId] : [...poolIdx.bySeg.keys()];
    for (const segId of segIds) {
      const segData = poolIdx.bySeg.get(segId);
      if (!segData) continue;
      const beforePos = findRightmostTrue(segData.entriesByLine, (e) => e.lineNumber <= targetLine);
      if (verdictTarget.timestampMs === null || verdictTarget.timestampMs === undefined) {
        if (beforePos >= 0 && isValidCand(segData.entriesByLine[beforePos])) {
          return { visibleDevices: sample.devices, hasAmbiguousVisibleDevices: false };
        }
        const firstAfterPos = beforePos + 1;
        if (
          firstAfterPos < segData.entriesByLine.length &&
          isValidCand(segData.entriesByLine[firstAfterPos])
        ) {
          return { visibleDevices: sample.devices, hasAmbiguousVisibleDevices: false };
        }
        continue;
      }
      const uBeforePos = findRightmostTrue(segData.untimestamped, (e) => e.lineNumber <= targetLine);
      if (uBeforePos >= 0 && isValidCand(segData.untimestamped[uBeforePos])) {
        return { visibleDevices: sample.devices, hasAmbiguousVisibleDevices: false };
      }
      const uAfterPos = uBeforePos + 1;
      if (uAfterPos < segData.untimestamped.length && isValidCand(segData.untimestamped[uAfterPos])) {
        return { visibleDevices: sample.devices, hasAmbiguousVisibleDevices: false };
      }
      const tProbe = toBoundaryProbeLine(
        targetLine,
        verdictTarget.segmentId ?? segId,
        verdictTarget.timestampMs,
        verdictTarget.hostTag,
        verdictTarget.instanceTag,
        verdictTarget.groupTag,
        verdictTarget.rank ?? null,
        verdictTarget.timestampSubMs ?? 0,
        verdictTarget.timestampKind ?? null,
        verdictTarget.hasExplicitTimezone ?? false,
        verdictTarget.inferredYearMatched ?? false,
      );
      const tTierKey = getLifecycleTierKey(tProbe);
      for (const [tierKey, tierData] of segData.byTier) {
        if (tierKey === tTierKey) {
          const tsEnd = findRightmostTrue(
            tierData.entriesSortedByTs,
            (e) => compareTimestampOrder(toVisEntryProbeLine(e), tProbe) <= 0,
          );
          if (tsEnd >= 0) {
            if (
              isValidCand(tierData.entriesSortedByTs[tsEnd]) ||
              isValidCand(tierData.prefixMaxLineEntry[tsEnd]) ||
              isValidCand(tierData.prefixMinEntry[tsEnd]) ||
              (beforePos >= 0 && isValidCand(segData.entriesByLine[beforePos]))
            ) {
              return { visibleDevices: sample.devices, hasAmbiguousVisibleDevices: false };
            }
          }
        } else {
          const tBeforePos = findRightmostTrue(tierData.entriesByLine, (e) => e.lineNumber <= targetLine);
          if (tBeforePos >= 0 && isValidCand(tierData.entriesByLine[tBeforePos])) {
            return { visibleDevices: sample.devices, hasAmbiguousVisibleDevices: false };
          }
          const tAfterPos = tBeforePos + 1;
          if (tAfterPos < tierData.entriesByLine.length && isValidCand(tierData.entriesByLine[tAfterPos])) {
            return { visibleDevices: sample.devices, hasAmbiguousVisibleDevices: false };
          }
        }
      }
    }
    return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  };

  const resolveFromSolePools = (pools: readonly SoleVisPoolIndex[]) => {
    for (const poolIdx of pools) {
      if (activeScaleProbe) activeScaleProbe.visCandidateScans += 1;
      const r = resolveSoleFromPoolIdx(poolIdx);
      if (!r.hasAmbiguousVisibleDevices && r.visibleDevices !== null) {
        return r;
      }
    }
    return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  };

  const effectivePidKey =
    verdictTarget === null || verdictTarget.pid === null
      ? ""
      : lookup && !lookup.byPid.has(verdictTarget.pid)
        ? "__UNMAPPED__"
        : verdictTarget.pid;
  const normDimKey = (val: string | null, map?: ReadonlyMap<string, unknown>): string => {
    if (val === null) return "";
    const low = val.toLowerCase();
    return lookup && map && !map.has(low) ? "__UNMAPPED__" : low;
  };
  const cacheKey = verdictTarget
    ? `${normDimKey(verdictTarget.hostTag, lookup?.byHost)}#${normDimKey(verdictTarget.instanceTag, lookup?.byInstance)}#${normDimKey(verdictTarget.groupTag, lookup?.byGroup)}#${effectivePidKey}`
    : "__all__";
  const cached = lookup?.cache.get(cacheKey);
  if (cached) {
    if (cached.sameOwnerGroupPools) {
      return resolveSameOwnerMultiGroupPools(
        cached.sameOwnerGroupPools,
        verdictTarget,
        startupBoundaryBucket,
        processResetBucket,
        lookup?.badSegPairMemo,
      );
    }
    if (cached.sameOwnerMultiSigPool) {
      return resolveSameOwnerMultiRunPool(
        cached.sameOwnerMultiSigPool,
        verdictTarget,
        startupBoundaryBucket,
        processResetBucket,
      );
    }
    if (cached.solePoolIndexes) return resolveFromSolePools(cached.solePoolIndexes);
    if (cached.staticResult) return cached.staticResult;
  }

  const collectAxisBuckets = (
    axis: VisDomAxisIndex | undefined,
    target: NonNullable<typeof verdictTarget>,
    allowWildcard: boolean,
  ): VisDomBucket[] => {
    if (!axis) return [];
    const hKey = target.hostTag?.toLowerCase() ?? "";
    const iKey = target.instanceTag?.toLowerCase() ?? "";
    const gKey = target.groupTag?.toLowerCase() ?? "";
    const hOpts = hKey !== "" ? (allowWildcard ? [hKey, ""] : [hKey]) : [""];
    const iOpts = iKey !== "" ? (allowWildcard ? [iKey, ""] : [iKey]) : [""];
    const gOpts = gKey !== "" ? (allowWildcard ? [gKey, ""] : [gKey]) : [""];
    const out: VisDomBucket[] = [];
    if (hKey !== "" && iKey !== "" && gKey !== "") {
      for (const hk of hOpts) {
        for (const ik of iOpts) {
          for (const gk of gOpts) {
            const g = axis.byDom.get(`${hk}\u0000${ik}\u0000${gk}`);
            if (g) out.push({ groups: [g] });
          }
        }
      }
      return out;
    }
    if (hKey !== "" && iKey !== "") {
      for (const hk of hOpts) {
        for (const ik of iOpts) {
          const b = axis.byHostInst.get(`${hk}\u0000${ik}`);
          if (b && b.groups.length > 0) out.push(b);
        }
      }
      return out;
    }
    if (hKey !== "" && gKey !== "") {
      for (const hk of hOpts) {
        for (const gk of gOpts) {
          const b = axis.byHostGrp.get(`${hk}\u0000${gk}`);
          if (b && b.groups.length > 0) out.push(b);
        }
      }
      return out;
    }
    if (iKey !== "" && gKey !== "") {
      for (const ik of iOpts) {
        for (const gk of gOpts) {
          const b = axis.byInstGrp.get(`${ik}\u0000${gk}`);
          if (b && b.groups.length > 0) out.push(b);
        }
      }
      return out;
    }
    if (hKey !== "") {
      for (const hk of hOpts) {
        const b = axis.byHost.get(hk);
        if (b && b.groups.length > 0) out.push(b);
      }
      return out;
    }
    if (iKey !== "") {
      for (const ik of iOpts) {
        const b = axis.byInstance.get(ik);
        if (b && b.groups.length > 0) out.push(b);
      }
      return out;
    }
    if (gKey !== "") {
      for (const gk of gOpts) {
        const b = axis.byGroup.get(gk);
        if (b && b.groups.length > 0) out.push(b);
      }
      return out;
    }
    return axis.allBucket.groups.length > 0 ? [axis.allBucket] : [];
  };

  const activeLookup = lookup ?? createVisibleDevicesCache(entries, processResetBucket);
  let matchedBuckets: VisDomBucket[] = [];
  if (!verdictTarget) {
    if (activeLookup.allAxis.allBucket.groups.length > 0) {
      matchedBuckets = [activeLookup.allAxis.allBucket];
    }
  } else {
    if (verdictTarget.pid !== null) {
      matchedBuckets = collectAxisBuckets(
        activeLookup.byPidDomAxis.get(verdictTarget.pid),
        verdictTarget,
        true,
      );
    }
    if (
      matchedBuckets.length === 0 &&
      (verdictTarget.hostTag !== null ||
        verdictTarget.instanceTag !== null ||
        verdictTarget.groupTag !== null)
    ) {
      const exactAxis = verdictTarget.pid !== null ? activeLookup.unscopedPidAxis : activeLookup.allAxis;
      matchedBuckets = collectAxisBuckets(exactAxis, verdictTarget, false);
    }
    if (matchedBuckets.length === 0) {
      const fallbackAxis = verdictTarget.pid !== null ? activeLookup.unscopedPidAxis : activeLookup.allAxis;
      matchedBuckets = collectAxisBuckets(fallbackAxis, verdictTarget, true);
    }
  }

  let result: { visibleDevices: number[] | null; hasAmbiguousVisibleDevices: boolean };
  if (matchedBuckets.length === 0) {
    result = { visibleDevices: null, hasAmbiguousVisibleDevices: false };
    lookup?.cache.set(cacheKey, { staticResult: result });
    return result;
  }

  let combinedSigState: VisBucketSummary["sigState"] = "empty";
  let combinedSingleSig: string | null = null;
  let maxOwnersSeen = 0;
  const combinedOwners = new Set<string>();
  const solePools: SoleVisPoolIndex[] = [];
  for (const b of matchedBuckets) {
    const sum = summarizeVisDomBucket(b);
    if (sum.sigState === "empty") continue;
    if (sum.soleOwnerKey !== null) {
      if (combinedOwners.size < 2) combinedOwners.add(sum.soleOwnerKey);
    } else {
      maxOwnersSeen = Math.max(maxOwnersSeen, sum.distinctOwnersSize);
    }
    if (sum.sigState === "invalid") {
      combinedSigState = "invalid";
      combinedSingleSig = null;
    } else if (sum.sigState === "multi") {
      if (combinedSigState !== "invalid") combinedSigState = "multi";
      combinedSingleSig = null;
    } else if (combinedSigState === "empty") {
      combinedSigState = "single";
      combinedSingleSig = sum.singleSig;
      if (sum.soleGroupPools) solePools.push(...sum.soleGroupPools);
    } else if (combinedSigState === "single") {
      if (combinedSingleSig === sum.singleSig) {
        if (sum.soleGroupPools) solePools.push(...sum.soleGroupPools);
      } else {
        combinedSigState = "multi";
        combinedSingleSig = null;
      }
    }
  }

  if (combinedSigState === "single" && solePools.length > 0) {
    const finalPools =
      solePools.length <= 16
        ? solePools
        : (() => {
            const merged: VisibleDevicesEntry[] = [];
            for (const b of matchedBuckets) {
              for (const g of b.groups) {
                for (const e of g.entries) merged.push(e);
              }
            }
            merged.sort((a, b) => a.lineNumber - b.lineNumber);
            return [buildSoleVisPoolIndex(merged)];
          })();
    lookup?.cache.set(cacheKey, { solePoolIndexes: finalPools });
    return resolveFromSolePools(finalPools);
  }

  const isSingleOwner = maxOwnersSeen <= 1 && combinedOwners.size <= 1;
  if (isSingleOwner) {
    const uniqueGroups: VisDomGroup[] = [];
    const seenGids = new Set<number>();
    for (const b of matchedBuckets) {
      if (b.groups.length === 0) continue;
      if (b.groups.length === 1) {
        const g = b.groups[0]!;
        if (g.entries.length === 0 || seenGids.has(g.gid)) continue;
        seenGids.add(g.gid);
        uniqueGroups.push(g);
      } else {
        const cg = getCollapsedVisBucketGroup(b);
        if (cg.entries.length === 0 || seenGids.has(cg.gid)) continue;
        seenGids.add(cg.gid);
        uniqueGroups.push(cg);
      }
    }
    if (uniqueGroups.length > 0 && uniqueGroups.length <= 16) {
      lookup?.cache.set(cacheKey, { sameOwnerGroupPools: uniqueGroups });
      return resolveSameOwnerMultiGroupPools(
        uniqueGroups,
        verdictTarget,
        startupBoundaryBucket,
        processResetBucket,
        activeLookup.badSegPairMemo,
      );
    }
    if (uniqueGroups.length > 16) {
      const poolKey = uniqueGroups
        .map((g) => g.gid)
        .sort((a, b) => a - b)
        .join(",");
      let multiPool = activeLookup.multiPoolCache.get(poolKey);
      if (!multiPool) {
        const built: VisibleDevicesEntry[] = [];
        for (const g of uniqueGroups) {
          for (const e of g.entries) {
            if (activeScaleProbe) activeScaleProbe.visCandidateScans += 1;
            built.push(e);
          }
        }
        built.sort((a, b) => a.segmentId - b.segmentId || a.lineNumber - b.lineNumber);
        multiPool = built;
        activeLookup.multiPoolCache.set(poolKey, multiPool);
      }
      lookup?.cache.set(cacheKey, { sameOwnerMultiSigPool: multiPool });
      return resolveSameOwnerMultiRunPool(
        multiPool,
        verdictTarget,
        startupBoundaryBucket,
        processResetBucket,
      );
    }
  }

  result = { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  lookup?.cache.set(cacheKey, { staticResult: result });
  return result;
}

export function extractVisibleDevicesFromLog(input: string): number[] | null {
  const entries = extractVisibleDevicesEntries(input.split(/\r?\n/));
  if (entries.length === 0) return null;
  if (entries.some((e) => !e.valid || e.devices === null)) return null;
  const distinctSignatures = new Set(entries.map((e) => e.devices!.join(",")));
  if (distinctSignatures.size > 1) {
    return null;
  }
  return entries[entries.length - 1]!.devices;
}

const TRACEBACK_UNPREFIXED_CONT_RE =
  /^(?:\s*File "[^"]+", line \d+|[\s]{2,}|Caused by:|During handling of|The above exception|(?:[A-Za-z_][A-Za-z0-9_.]*(?:Error|Exception)(?::|\s|$)|(?:Error|Exception):))/;
const TRACEBACK_UNPREFIXED_TERMINAL_RE =
  /^(?:[A-Za-z_][A-Za-z0-9_.]*(?:Error|Exception)(?::|\s|$)|(?:Error|Exception):)/;
const TRACEBACK_CHAIN_BANNER_RE =
  /^(?:During handling of the above exception(?:, another exception occurred)?|The above exception was the direct cause of the following exception|Caused by):?\s*$/i;
const LOG_HEADER_LEVEL_RE = /^(?:INFO|DEBUG|WARN(?:ING)?|ERROR|CRITICAL|FATAL)\b/;

interface ParsedLogBundle {
  lines: ParsedLogLine[];
  ambiguousDomainPids: ReadonlySet<number>;
}

interface TracebackSnapshot {
  rank: number | null;
  rankSource: RankSource | null;
  hostTag: string | null;
  instanceTag: string | null;
  groupTag: string | null;
  pid: number | null;
  ts: string | null;
  tsMs: number | null;
  tsSubMs: number;
  tsKind: "full" | "short-date" | "time-only" | null;
  hasTz: boolean;
  inferredYearMatched: boolean;
  groupId: number | null;
}

interface PidProjBucket {
  hasNonEmptyH: boolean;
  hasNonEmptyI: boolean;
  hasNonEmptyG: boolean;
  rankState: "none" | "multi" | number;
}

function recordPidProjBucket(
  projMap: Map<string, PidProjBucket>,
  hostKey: string,
  instKey: string,
  grpKey: string,
  rank: number | null,
): void {
  const hNonEmpty = hostKey !== "";
  const iNonEmpty = instKey !== "";
  const gNonEmpty = grpKey !== "";
  const hOpts = hNonEmpty ? [hostKey, "*"] : ["", "*"];
  const iOpts = iNonEmpty ? [instKey, "*"] : ["", "*"];
  const gOpts = gNonEmpty ? [grpKey, "*"] : ["", "*"];
  for (const kh of hOpts) {
    for (const ki of iOpts) {
      for (const kg of gOpts) {
        const key = `${kh}\u0000${ki}\u0000${kg}`;
        let b = projMap.get(key);
        if (!b) {
          b = {
            hasNonEmptyH: false,
            hasNonEmptyI: false,
            hasNonEmptyG: false,
            rankState: rank ?? "none",
          };
          projMap.set(key, b);
        } else if (rank !== null && b.rankState !== rank) {
          b.rankState = b.rankState === "none" ? rank : "multi";
        }
        if (hNonEmpty) b.hasNonEmptyH = true;
        if (iNonEmpty) b.hasNonEmptyI = true;
        if (gNonEmpty) b.hasNonEmptyG = true;
      }
    }
  }
}

function parseLogLines(input: string): ParsedLogBundle {
  const rawLines = input.split(/\r?\n/);
  const parsed: ParsedLogLine[] = [];
  const scopedPidMap = new Map<string, { rank: number; source: RankSource } | "ambiguous">();
  const scopedDevicePidMap = new Map<string, { rank: number; source: RankSource } | "ambiguous">();
  const barePidMap = new Map<
    string,
    | { pid: number; rank: number; source: RankSource; hostKey: string; instKey: string; grpKey: string }
    | "ambiguous"
  >();
  const pidProjBuckets = new Map<string, Map<string, PidProjBucket>>();
  const pidDomainMap = new Map<
    string,
    { hostTag: string | null; instanceTag: string | null; groupTag: string | null } | "ambiguous"
  >();
  const ambiguousDomainPidEpochs = new Set<string>();
  const ambiguousDomainPids = new Set<number>();
  const fullYears = new Set<number>();

  interface FullDateAnchor {
    idx: number;
    segmentId: number;
    year: number;
    timestampMs: number;
  }

  const hasPromExposition = rawLines.some((rl) => {
    const t = rl.trim();
    return PROM_COMMENT_HEADER_RE.test(t) || parsePromMetricSampleLine(t) !== null;
  });
  let preSegId = 0;
  const rawMeta = rawLines.map((rl, idx) => {
    const isOmission = OMISSION_MARKER_RE.test(rl);
    if (isOmission) preSegId += 1;
    const inspectLine = capLineWindow(rl);
    const trimmedRl = rl.trim();
    const isPromLine = isPromExpositionLine(trimmedRl) || (hasPromExposition && trimmedRl.startsWith("#"));
    const suppressMeta = isOmission || isPromLine || trimmedRl.startsWith("#");
    const pid = suppressMeta ? null : extractHeaderPid(inspectLine);
    const rankMatch = suppressMeta ? null : extractRankMatch(inspectLine);
    const hostTag = suppressMeta ? null : extractHostTag(inspectLine);
    const instanceTag = suppressMeta ? null : extractInstanceTag(inspectLine);
    const groupTag = suppressMeta ? null : extractGroupTag(inspectLine);
    const extractedTs = suppressMeta
      ? { timestamp: null, timestampMs: null, index: null, length: 0 }
      : extractTimestamp(inspectLine);
    const tsInferredYear = false;
    let fullYear: number | null = null;
    if (extractedTs.timestampKind === "full" && extractedTs.timestamp !== null) {
      const yr = Number.parseInt(extractedTs.timestamp.slice(0, 4), 10);
      if (Number.isFinite(yr)) {
        fullYears.add(yr);
        fullYear = yr;
      }
    }
    return {
      idx,
      segmentId: preSegId,
      isOmission,
      isPromLine,
      inspectLine,
      pid,
      pidEpoch: 0,
      pidDomKey: "",
      rankMatch,
      hostTag,
      instanceTag,
      groupTag,
      extractedTs,
      tsInferredYear,
      fullYear,
    };
  });

  if (fullYears.size >= 1) {
    const prevAnchorByIdx: Array<FullDateAnchor | null> = new Array(rawMeta.length).fill(null);
    const nextAnchorByIdx: Array<FullDateAnchor | null> = new Array(rawMeta.length).fill(null);
    let lastAnchor: FullDateAnchor | null = null;
    for (let i = 0; i < rawMeta.length; i++) {
      const m = rawMeta[i]!;
      if (m.fullYear !== null && m.extractedTs.timestampMs !== null) {
        lastAnchor = {
          idx: i,
          segmentId: m.segmentId,
          year: m.fullYear,
          timestampMs: m.extractedTs.timestampMs,
        };
      }
      prevAnchorByIdx[i] = lastAnchor;
    }
    let futureAnchor: FullDateAnchor | null = null;
    for (let i = rawMeta.length - 1; i >= 0; i--) {
      const m = rawMeta[i]!;
      if (m.fullYear !== null && m.extractedTs.timestampMs !== null) {
        futureAnchor = {
          idx: i,
          segmentId: m.segmentId,
          year: m.fullYear,
          timestampMs: m.extractedTs.timestampMs,
        };
      }
      nextAnchorByIdx[i] = futureAnchor;
    }

    const resolveShortDateYear = (ts: ExtractedTimestamp, anchor: FullDateAnchor): number | null => {
      const candMs = (y: number) =>
        isValidCalendarDate(y, ts.month!, ts.day!)
          ? Date.UTC(y, ts.month! - 1, ts.day!, ts.hh!, ts.mm!, ts.ss!, ts.ms ?? 0) - (ts.offsetMs ?? 0)
          : NaN;
      const baseMs = candMs(anchor.year);
      if (Number.isFinite(baseMs) && Math.abs(baseMs - anchor.timestampMs) <= 180 * 86_400_000) {
        return anchor.year;
      }
      const nextY = anchor.year + 1;
      const prevY = anchor.year - 1;
      const nextMs = candMs(nextY);
      if (Number.isFinite(nextMs) && Math.abs(nextMs - anchor.timestampMs) <= 31 * 86_400_000) return nextY;
      const prevMs = candMs(prevY);
      if (Number.isFinite(prevMs) && Math.abs(prevMs - anchor.timestampMs) <= 31 * 86_400_000) return prevY;
      return fullYears.size === 1 && Number.isFinite(baseMs) ? anchor.year : null;
    };

    for (let i = 0; i < rawMeta.length; i++) {
      const meta = rawMeta[i]!;
      const ts = meta.extractedTs;
      if (
        ts.timestampKind === "short-date" &&
        ts.timestampMs !== null &&
        ts.month !== undefined &&
        ts.day !== undefined &&
        ts.hh !== undefined &&
        ts.mm !== undefined &&
        ts.ss !== undefined
      ) {
        const prevA = prevAnchorByIdx[i];
        const nextA = nextAnchorByIdx[i];
        const candidates: number[] = [];
        if (prevA && (prevA.segmentId === meta.segmentId || fullYears.size <= 2)) {
          const y = resolveShortDateYear(ts, prevA);
          if (y !== null) candidates.push(y);
        }
        if (nextA && (nextA.segmentId === meta.segmentId || fullYears.size <= 2)) {
          const y = resolveShortDateYear(ts, nextA);
          if (y !== null) candidates.push(y);
        }
        if (
          candidates.length > 0 &&
          candidates.every((y) => y === candidates[0]) &&
          isValidCalendarDate(candidates[0]!, ts.month, ts.day)
        ) {
          const inferredYear = candidates[0]!;
          ts.timestampMs =
            Date.UTC(inferredYear, ts.month - 1, ts.day, ts.hh, ts.mm, ts.ss, ts.ms ?? 0) -
            (ts.offsetMs ?? 0);
          meta.tsInferredYear = true;
        }
      }
    }
  }

  interface PidEpochState {
    pid: number;
    domKey: string;
    hostKey: string;
    instKey: string;
    grpKey: string;
    hostTag: string | null;
    instanceTag: string | null;
    groupTag: string | null;
    knownRank: number | null;
    epoch: number;
    hasStartup: boolean;
    hasBaseline: boolean;
    touchedSinceEpochReset: boolean;
  }
  interface PidEpochPoolIndex {
    all: Set<PidEpochState>;
    byDom: Map<string, Set<PidEpochState>>;
    byHostInst: Map<string, Set<PidEpochState>>;
    byHostGrp: Map<string, Set<PidEpochState>>;
    byInstGrp: Map<string, Set<PidEpochState>>;
    byHost: Map<string, Set<PidEpochState>>;
    byInst: Map<string, Set<PidEpochState>>;
    byGrp: Map<string, Set<PidEpochState>>;
  }
  interface RankPartitionedEpochPool {
    allRanks: PidEpochPoolIndex;
    unranked: PidEpochPoolIndex;
    byRank: Map<number, PidEpochPoolIndex>;
  }
  const createEpochPoolIndex = (): PidEpochPoolIndex => ({
    all: new Set(),
    byDom: new Map(),
    byHostInst: new Map(),
    byHostGrp: new Map(),
    byInstGrp: new Map(),
    byHost: new Map(),
    byInst: new Map(),
    byGrp: new Map(),
  });
  const createRankEpochPool = (): RankPartitionedEpochPool => ({
    allRanks: createEpochPoolIndex(),
    unranked: createEpochPoolIndex(),
    byRank: new Map(),
  });
  const addToPoolMap = (map: Map<string, Set<PidEpochState>>, key: string, st: PidEpochState) => {
    let set = map.get(key);
    if (!set) {
      set = new Set();
      map.set(key, set);
    }
    set.add(st);
  };
  const delFromPoolMap = (map: Map<string, Set<PidEpochState>>, key: string, st: PidEpochState) => {
    const set = map.get(key);
    if (set) {
      set.delete(st);
      if (set.size === 0) map.delete(key);
    }
  };
  const addToEpochPool = (pool: PidEpochPoolIndex, st: PidEpochState) => {
    if (pool.all.has(st)) return;
    pool.all.add(st);
    addToPoolMap(pool.byDom, `${st.hostKey}\u0000${st.instKey}\u0000${st.grpKey}`, st);
    addToPoolMap(pool.byHostInst, `${st.hostKey}\u0000${st.instKey}`, st);
    addToPoolMap(pool.byHostGrp, `${st.hostKey}\u0000${st.grpKey}`, st);
    addToPoolMap(pool.byInstGrp, `${st.instKey}\u0000${st.grpKey}`, st);
    addToPoolMap(pool.byHost, st.hostKey, st);
    addToPoolMap(pool.byInst, st.instKey, st);
    addToPoolMap(pool.byGrp, st.grpKey, st);
  };
  const removeFromEpochPool = (pool: PidEpochPoolIndex, st: PidEpochState) => {
    if (!pool.all.has(st)) return;
    pool.all.delete(st);
    delFromPoolMap(pool.byDom, `${st.hostKey}\u0000${st.instKey}\u0000${st.grpKey}`, st);
    delFromPoolMap(pool.byHostInst, `${st.hostKey}\u0000${st.instKey}`, st);
    delFromPoolMap(pool.byHostGrp, `${st.hostKey}\u0000${st.grpKey}`, st);
    delFromPoolMap(pool.byInstGrp, `${st.instKey}\u0000${st.grpKey}`, st);
    delFromPoolMap(pool.byHost, st.hostKey, st);
    delFromPoolMap(pool.byInst, st.instKey, st);
    delFromPoolMap(pool.byGrp, st.grpKey, st);
  };
  const addToRankEpochPool = (rpool: RankPartitionedEpochPool, st: PidEpochState) => {
    addToEpochPool(rpool.allRanks, st);
    if (st.knownRank === null) {
      addToEpochPool(rpool.unranked, st);
    } else {
      let rkPool = rpool.byRank.get(st.knownRank);
      if (!rkPool) {
        rkPool = createEpochPoolIndex();
        rpool.byRank.set(st.knownRank, rkPool);
      }
      addToEpochPool(rkPool, st);
    }
  };
  const removeFromRankEpochPool = (rpool: RankPartitionedEpochPool, st: PidEpochState) => {
    if (!rpool.allRanks.all.has(st)) return;
    removeFromEpochPool(rpool.allRanks, st);
    if (st.knownRank === null) {
      removeFromEpochPool(rpool.unranked, st);
    } else {
      const rkPool = rpool.byRank.get(st.knownRank);
      if (rkPool) removeFromEpochPool(rkPool, st);
    }
  };
  const collectMatchingEpochPool = (
    pool: PidEpochPoolIndex,
    meta: { hostTag: string | null; instanceTag: string | null; groupTag: string | null },
    countKind: "epochPool" | "pidCompat" = "epochPool",
  ): PidEpochState[] => {
    if (pool.all.size === 0) return [];
    const hKey = (meta.hostTag ?? "").toLowerCase();
    const iKey = (meta.instanceTag ?? "").toLowerCase();
    const gKey = (meta.groupTag ?? "").toLowerCase();
    const out: PidEpochState[] = [];
    const recordScan = () => {
      if (!activeScaleProbe) return;
      if (countKind === "pidCompat") activeScaleProbe.pidStateCompatibilityScans += 1;
      else activeScaleProbe.epochPoolScans += 1;
    };
    if (hKey !== "" && iKey !== "" && gKey !== "") {
      for (const hk of [hKey, ""]) {
        for (const ik of [iKey, ""]) {
          for (const gk of [gKey, ""]) {
            const set = pool.byDom.get(`${hk}\u0000${ik}\u0000${gk}`);
            if (set) {
              for (const st of set) {
                recordScan();
                out.push(st);
              }
            }
          }
        }
      }
      return out;
    }
    const pushTwoDimMap = (map: Map<string, Set<PidEpochState>>, k1: string, k2: string) => {
      for (const a of [k1, ""]) {
        for (const b of [k2, ""]) {
          const set = map.get(`${a}\u0000${b}`);
          if (set) {
            for (const st of set) {
              recordScan();
              out.push(st);
            }
          }
        }
      }
    };
    if (hKey !== "" && iKey !== "") {
      pushTwoDimMap(pool.byHostInst, hKey, iKey);
      return out;
    }
    if (hKey !== "" && gKey !== "") {
      pushTwoDimMap(pool.byHostGrp, hKey, gKey);
      return out;
    }
    if (iKey !== "" && gKey !== "") {
      pushTwoDimMap(pool.byInstGrp, iKey, gKey);
      return out;
    }
    if (hKey !== "" || iKey !== "" || gKey !== "") {
      const [map, qVal] =
        hKey !== "" ? [pool.byHost, hKey] : iKey !== "" ? [pool.byInst, iKey] : [pool.byGrp, gKey];
      for (const s of [map.get(qVal), map.get("")]) {
        if (!s) continue;
        for (const st of s) {
          recordScan();
          out.push(st);
        }
      }
      return out;
    }
    for (const st of pool.all) {
      recordScan();
      out.push(st);
    }
    return out;
  };

  const collectMatchingRankEpochPool = (
    rpool: RankPartitionedEpochPool,
    meta: { hostTag: string | null; instanceTag: string | null; groupTag: string | null },
    rmRank: number | null,
  ): PidEpochState[] => {
    if (rpool.allRanks.all.size === 0) return [];
    if (rmRank === null) return collectMatchingEpochPool(rpool.allRanks, meta, "epochPool");
    const out = collectMatchingEpochPool(rpool.unranked, meta, "epochPool");
    const rkPool = rpool.byRank.get(rmRank);
    if (rkPool) {
      for (const st of collectMatchingEpochPool(rkPool, meta, "epochPool")) {
        out.push(st);
      }
    }
    return out;
  };

  interface PidStateBucket {
    byDom: Map<string, PidEpochState>;
    pool: PidEpochPoolIndex;
    startupResetPool: PidEpochPoolIndex;
    exitResetPool: PidEpochPoolIndex;
  }
  const statesByPid = new Map<number, PidStateBucket>();
  const liveOnlyPool = createRankEpochPool();
  const dirtyPool = createRankEpochPool();
  const awaitingStartupPool = createRankEpochPool();
  const seenStartupDomains = createDomainPresenceIndex();
  const hasPriorStartupInDomain = (meta: {
    hostTag: string | null;
    instanceTag: string | null;
    groupTag: string | null;
  }): boolean => hasCompatibleDomainInPresenceIndex(seenStartupDomains, meta);
  const recordStartupDomainCoord = (meta: {
    hostTag: string | null;
    instanceTag: string | null;
    groupTag: string | null;
  }): void => addToDomainPresenceIndex(seenStartupDomains, meta);
  const syncPidActionPools = (pidRec: PidStateBucket | undefined, st: PidEpochState) => {
    if (!pidRec) return;
    if (!st.hasStartup || st.touchedSinceEpochReset || st.hasBaseline || st.knownRank !== null) {
      addToEpochPool(pidRec.startupResetPool, st);
    } else {
      removeFromEpochPool(pidRec.startupResetPool, st);
    }
    if (st.touchedSinceEpochReset || st.hasStartup || st.hasBaseline || st.knownRank !== null) {
      addToEpochPool(pidRec.exitResetPool, st);
    } else {
      removeFromEpochPool(pidRec.exitResetPool, st);
    }
  };
  const setStateKnownRank = (st: PidEpochState, newRank: number | null) => {
    if (st.knownRank === newRank) return;
    const wasLive = liveOnlyPool.allRanks.all.has(st);
    const wasDirty = dirtyPool.allRanks.all.has(st);
    const wasAwaiting = awaitingStartupPool.allRanks.all.has(st);
    if (wasLive) removeFromRankEpochPool(liveOnlyPool, st);
    if (wasDirty) removeFromRankEpochPool(dirtyPool, st);
    if (wasAwaiting) removeFromRankEpochPool(awaitingStartupPool, st);
    st.knownRank = newRank;
    if (wasLive) addToRankEpochPool(liveOnlyPool, st);
    if (wasDirty) addToRankEpochPool(dirtyPool, st);
    if (wasAwaiting) addToRankEpochPool(awaitingStartupPool, st);
  };
  const bumpPidState = (st: PidEpochState, markStartupEpoch = false) => {
    removeFromRankEpochPool(liveOnlyPool, st);
    removeFromRankEpochPool(dirtyPool, st);
    removeFromRankEpochPool(awaitingStartupPool, st);
    st.epoch += 1;
    st.hasStartup = markStartupEpoch;
    st.hasBaseline = false;
    st.knownRank = null;
    st.touchedSinceEpochReset = false;
    if (!markStartupEpoch) {
      addToRankEpochPool(awaitingStartupPool, st);
    }
    syncPidActionPools(statesByPid.get(st.pid), st);
  };
  const hasAnyCompatibleInEpochPool = (
    pool: PidEpochPoolIndex | undefined,
    meta: { hostTag: string | null; instanceTag: string | null; groupTag: string | null },
  ): boolean => {
    if (!pool || pool.all.size === 0) return false;
    const h = (meta.hostTag ?? "").toLowerCase();
    const i = (meta.instanceTag ?? "").toLowerCase();
    const g = (meta.groupTag ?? "").toLowerCase();
    if (h === "" && i === "" && g === "") return true;
    if (h !== "" && i !== "" && g !== "") {
      for (const hk of [h, ""]) {
        for (const ik of [i, ""]) {
          for (const gk of [g, ""]) {
            if ((pool.byDom.get(`${hk}\u0000${ik}\u0000${gk}`)?.size ?? 0) > 0) return true;
          }
        }
      }
      return false;
    }
    const hasTwoDim = (map: Map<string, Set<PidEpochState>>, k1: string, k2: string): boolean => {
      for (const a of [k1, ""]) {
        for (const b of [k2, ""]) {
          if ((map.get(`${a}\u0000${b}`)?.size ?? 0) > 0) return true;
        }
      }
      return false;
    };
    if (h !== "" && i !== "") return hasTwoDim(pool.byHostInst, h, i);
    if (h !== "" && g !== "") return hasTwoDim(pool.byHostGrp, h, g);
    if (i !== "" && g !== "") return hasTwoDim(pool.byInstGrp, i, g);
    if (h !== "") return (pool.byHost.get(h)?.size ?? 0) > 0 || (pool.byHost.get("")?.size ?? 0) > 0;
    if (i !== "") return (pool.byInst.get(i)?.size ?? 0) > 0 || (pool.byInst.get("")?.size ?? 0) > 0;
    return (pool.byGrp.get(g)?.size ?? 0) > 0 || (pool.byGrp.get("")?.size ?? 0) > 0;
  };
  const findCompatiblePidStatesForMode = (
    pid: number,
    meta: { hostTag: string | null; instanceTag: string | null; groupTag: string | null },
    mode: "startup" | "exit",
  ): PidEpochState[] => {
    const pidRec = statesByPid.get(pid);
    if (!pidRec || pidRec.byDom.size === 0) return [];
    const targetPool = mode === "startup" ? pidRec.startupResetPool : pidRec.exitResetPool;
    if (targetPool.all.size === 0) return [];
    const hKey = (meta.hostTag ?? "").toLowerCase();
    const iKey = (meta.instanceTag ?? "").toLowerCase();
    const gKey = (meta.groupTag ?? "").toLowerCase();
    if (hKey !== "" && iKey !== "" && gKey !== "" && pidRec.byDom.size === 1) {
      const exact = pidRec.byDom.get(`${hKey}#${iKey}#${gKey}`);
      if (exact && targetPool.all.has(exact)) {
        if (activeScaleProbe) activeScaleProbe.pidStateCompatibilityScans += 1;
        return [exact];
      }
      return [];
    }
    return collectMatchingEpochPool(targetPool, meta, "pidCompat");
  };
  const getOrCreatePidState = (
    pid: number,
    hostTag: string | null,
    instanceTag: string | null,
    groupTag: string | null,
  ): PidEpochState => {
    const hKey = (hostTag ?? "").toLowerCase();
    const iKey = (instanceTag ?? "").toLowerCase();
    const gKey = (groupTag ?? "").toLowerCase();
    const domKey = `${hKey}#${iKey}#${gKey}`;
    let pidRec = statesByPid.get(pid);
    if (!pidRec) {
      pidRec = {
        byDom: new Map<string, PidEpochState>(),
        pool: createEpochPoolIndex(),
        startupResetPool: createEpochPoolIndex(),
        exitResetPool: createEpochPoolIndex(),
      };
      statesByPid.set(pid, pidRec);
    }
    const exact = pidRec.byDom.get(domKey);
    if (exact) return exact;
    if (domKey === "##" && pidRec.byDom.size === 1) {
      return pidRec.byDom.values().next().value!;
    }
    if (domKey !== "##" && pidRec.byDom.size === 1 && pidRec.byDom.has("##")) {
      const bareSt = pidRec.byDom.get("##")!;
      const wasLive = liveOnlyPool.allRanks.all.has(bareSt);
      const wasDirty = dirtyPool.allRanks.all.has(bareSt);
      const wasAwaiting = awaitingStartupPool.allRanks.all.has(bareSt);
      removeFromEpochPool(pidRec.pool, bareSt);
      removeFromEpochPool(pidRec.startupResetPool, bareSt);
      removeFromEpochPool(pidRec.exitResetPool, bareSt);
      if (wasLive) removeFromRankEpochPool(liveOnlyPool, bareSt);
      if (wasDirty) removeFromRankEpochPool(dirtyPool, bareSt);
      if (wasAwaiting) removeFromRankEpochPool(awaitingStartupPool, bareSt);
      pidRec.byDom.delete("##");
      bareSt.domKey = domKey;
      bareSt.hostKey = hKey;
      bareSt.instKey = iKey;
      bareSt.grpKey = gKey;
      bareSt.hostTag = hostTag;
      bareSt.instanceTag = instanceTag;
      bareSt.groupTag = groupTag;
      pidRec.byDom.set(domKey, bareSt);
      addToEpochPool(pidRec.pool, bareSt);
      syncPidActionPools(pidRec, bareSt);
      if (wasLive) addToRankEpochPool(liveOnlyPool, bareSt);
      if (wasDirty) addToRankEpochPool(dirtyPool, bareSt);
      if (wasAwaiting) addToRankEpochPool(awaitingStartupPool, bareSt);
      return bareSt;
    }
    const priorStartup = hasPriorStartupInDomain({ hostTag, instanceTag, groupTag });
    const created: PidEpochState = {
      pid,
      domKey,
      hostKey: hKey,
      instKey: iKey,
      grpKey: gKey,
      hostTag,
      instanceTag,
      groupTag,
      knownRank: null,
      epoch: 0,
      hasStartup: priorStartup,
      hasBaseline: false,
      touchedSinceEpochReset: false,
    };
    pidRec.byDom.set(domKey, created);
    addToEpochPool(pidRec.pool, created);
    syncPidActionPools(pidRec, created);
    return created;
  };

  for (const meta of rawMeta) {
    if (meta.isOmission || meta.isPromLine) continue;
    const { pid, rankMatch, inspectLine } = meta;
    if (inspectLine.trimStart().startsWith("#")) continue;
    const isStartupLine = isActualAppStartupCompleteLine(inspectLine);
    const isProcessExitLine =
      !isStartupLine &&
      PROCESS_EXIT_RESET_RE.test(inspectLine) &&
      !/\b(?:non-default\s+args|shutdown_timeout|graceful_shutdown)\b/i.test(inspectLine);
    const rmRank =
      rankMatch && rankMatch.source !== "device-id" && rankMatch.source !== "worker-dp-pp"
        ? rankMatch.rank
        : null;

    if (isStartupLine) {
      if (pid !== null) {
        const compat = findCompatiblePidStatesForMode(pid, meta, "startup");
        if (compat.length > 0) {
          for (const st of compat) {
            if (st.hasStartup || st.hasBaseline) {
              bumpPidState(st, true);
            } else {
              st.hasStartup = true;
              st.touchedSinceEpochReset = false;
            }
            removeFromRankEpochPool(awaitingStartupPool, st);
            removeFromRankEpochPool(liveOnlyPool, st);
            addToRankEpochPool(dirtyPool, st);
            syncPidActionPools(statesByPid.get(st.pid), st);
          }
        } else if (!hasAnyCompatibleInEpochPool(statesByPid.get(pid)?.pool, meta)) {
          const st = getOrCreatePidState(pid, meta.hostTag, meta.instanceTag, meta.groupTag);
          st.hasStartup = true;
          addToRankEpochPool(dirtyPool, st);
          syncPidActionPools(statesByPid.get(pid), st);
        }
      } else {
        for (const st of collectMatchingRankEpochPool(dirtyPool, meta, rmRank)) {
          bumpPidState(st, true);
        }
        for (const st of collectMatchingRankEpochPool(liveOnlyPool, meta, rmRank)) {
          removeFromRankEpochPool(liveOnlyPool, st);
          st.hasStartup = true;
          addToRankEpochPool(dirtyPool, st);
          syncPidActionPools(statesByPid.get(st.pid), st);
        }
        for (const st of collectMatchingRankEpochPool(awaitingStartupPool, meta, rmRank)) {
          removeFromRankEpochPool(awaitingStartupPool, st);
          st.hasStartup = true;
          syncPidActionPools(statesByPid.get(st.pid), st);
        }
        recordStartupDomainCoord(meta);
      }
    }

    if (pid !== null) {
      const st = getOrCreatePidState(pid, meta.hostTag, meta.instanceTag, meta.groupTag);
      removeFromRankEpochPool(awaitingStartupPool, st);
      meta.pidEpoch = st.epoch;
      meta.pidDomKey = st.domKey;
      if (!isStartupLine && !isProcessExitLine) {
        st.touchedSinceEpochReset = true;
      }
      if (st.knownRank === null && rmRank !== null) {
        setStateKnownRank(st, rmRank);
      }
      if (!isStartupLine && (hasLogErrorSeverity(inspectLine) || hasGenuinePythonException(inspectLine))) {
        st.hasBaseline = true;
      }
      if (st.hasStartup || st.hasBaseline) {
        removeFromRankEpochPool(liveOnlyPool, st);
        addToRankEpochPool(dirtyPool, st);
      } else {
        addToRankEpochPool(liveOnlyPool, st);
      }
      syncPidActionPools(statesByPid.get(pid), st);
    }

    if (isProcessExitLine) {
      if (pid !== null) {
        const compat = findCompatiblePidStatesForMode(pid, meta, "exit");
        if (compat.length > 0) {
          for (const st of compat) bumpPidState(st, false);
        } else if (!statesByPid.get(pid)?.byDom.size) {
          const st = getOrCreatePidState(pid, meta.hostTag, meta.instanceTag, meta.groupTag);
          bumpPidState(st, false);
        }
      } else {
        for (const st of [
          ...collectMatchingRankEpochPool(dirtyPool, meta, rmRank),
          ...collectMatchingRankEpochPool(liveOnlyPool, meta, rmRank),
        ]) {
          bumpPidState(st, false);
        }
      }
    }
  }

  // Pass 1A: Establish unambiguous causal domain per PID lifecycle epoch before populating scoped rank observations.
  for (const meta of rawMeta) {
    const { pid, pidDomKey, pidEpoch, hostTag, instanceTag, groupTag } = meta;
    if (pid === null) continue;
    const pidEpochKey = `${pid}@${pidDomKey}@${pidEpoch}`;
    if (hostTag !== null || instanceTag !== null || groupTag !== null) {
      const prevDom = pidDomainMap.get(pidEpochKey);
      if (prevDom === undefined) {
        pidDomainMap.set(pidEpochKey, { hostTag, instanceTag, groupTag });
      } else if (prevDom !== "ambiguous") {
        if (!areCausalDomainsCompatible(prevDom, { hostTag, instanceTag, groupTag })) {
          pidDomainMap.set(pidEpochKey, "ambiguous");
          ambiguousDomainPidEpochs.add(pidEpochKey);
          ambiguousDomainPids.add(pid);
        } else {
          if (prevDom.hostTag === null && hostTag !== null) prevDom.hostTag = hostTag;
          if (prevDom.instanceTag === null && instanceTag !== null) prevDom.instanceTag = instanceTag;
          if (prevDom.groupTag === null && groupTag !== null) prevDom.groupTag = groupTag;
        }
      }
    }
  }

  const getEffectiveDomain = (
    pid: number | null,
    pidDomKey: string,
    pidEpoch: number,
    hostTag: string | null,
    instanceTag: string | null,
    groupTag: string | null,
  ) => {
    const pidEpochKey = pid !== null ? `${pid}@${pidDomKey}@${pidEpoch}` : "";
    if (pid !== null && !ambiguousDomainPidEpochs.has(pidEpochKey)) {
      const pidDom = pidDomainMap.get(pidEpochKey);
      if (
        pidDom &&
        pidDom !== "ambiguous" &&
        areCausalDomainsCompatible(pidDom, { hostTag, instanceTag, groupTag })
      ) {
        return {
          hostTag: hostTag ?? pidDom.hostTag,
          instanceTag: instanceTag ?? pidDom.instanceTag,
          groupTag: groupTag ?? pidDom.groupTag,
        };
      }
    }
    return { hostTag, instanceTag, groupTag };
  };

  const pidObsKeys = new Map<string, Set<string>>();
  const pidNonEmptyHosts = new Map<string, Set<string>>();
  const pidNonEmptyInsts = new Map<string, Set<string>>();
  const pidNonEmptyGrps = new Map<string, Set<string>>();
  const recordDimSet = (map: Map<string, Set<string>>, pidEpochKey: string, val: string) => {
    if (!val) return;
    let s = map.get(pidEpochKey);
    if (!s) {
      s = new Set<string>();
      map.set(pidEpochKey, s);
    }
    if (s.size < 2) s.add(val);
  };

  // Pass 1B: Build epoch-scoped scopedPidMap (logical/explicit ranks separate from device-id fallback) & O(1) pidProjBuckets.
  for (const [pidNum, pidRec] of statesByPid) {
    if (pidRec.byDom.size > 1) ambiguousDomainPids.add(pidNum);
  }
  for (const meta of rawMeta) {
    const { pid, pidDomKey, pidEpoch, rankMatch: rm } = meta;
    if (pid === null) continue;
    const pidEpochKey = `${pid}@${pidDomKey}@${pidEpoch}`;
    const eff = getEffectiveDomain(pid, pidDomKey, pidEpoch, meta.hostTag, meta.instanceTag, meta.groupTag);
    const hostKey = (eff.hostTag ?? "").toLowerCase();
    const instKey = (eff.instanceTag ?? "").toLowerCase();
    const grpKey = (eff.groupTag ?? "").toLowerCase();
    const isWorkerLogicalRank = rm !== null && rm.source !== "device-id" && rm.source !== "worker-dp-pp";
    const logicalRank = isWorkerLogicalRank ? rm.rank : null;

    if (logicalRank !== null || hostKey !== "" || instKey !== "" || grpKey !== "") {
      let seen = pidObsKeys.get(pidEpochKey);
      if (!seen) {
        seen = new Set<string>();
        pidObsKeys.set(pidEpochKey, seen);
      }
      const obsKey = `${hostKey}#${instKey}#${grpKey}#${logicalRank ?? "na"}`;
      if (!seen.has(obsKey)) {
        seen.add(obsKey);
        let projMap = pidProjBuckets.get(pidEpochKey);
        if (!projMap) {
          projMap = new Map<string, PidProjBucket>();
          pidProjBuckets.set(pidEpochKey, projMap);
        }
        recordPidProjBucket(projMap, hostKey, instKey, grpKey, logicalRank);
        recordDimSet(pidNonEmptyHosts, pidEpochKey, hostKey);
        recordDimSet(pidNonEmptyInsts, pidEpochKey, instKey);
        recordDimSet(pidNonEmptyGrps, pidEpochKey, grpKey);
      }
    }

    if (rm === null) continue;
    const scopedKey = `${hostKey}#${instKey}#${grpKey}#${pidEpochKey}`;
    if (rm.source === "device-id" || rm.source === "worker-dp-pp") {
      if (rm.source === "device-id") {
        const prevDev = scopedDevicePidMap.get(scopedKey);
        if (prevDev === undefined) {
          scopedDevicePidMap.set(scopedKey, { rank: rm.rank, source: "device-id" });
        } else if (prevDev !== "ambiguous" && prevDev.rank !== rm.rank) {
          scopedDevicePidMap.set(scopedKey, "ambiguous");
        }
      }
      continue;
    }

    const prevScoped = scopedPidMap.get(scopedKey);
    if (prevScoped === undefined) {
      scopedPidMap.set(scopedKey, { rank: rm.rank, source: rm.source });
    } else if (prevScoped !== "ambiguous" && prevScoped.rank !== rm.rank) {
      scopedPidMap.set(scopedKey, "ambiguous");
      ambiguousDomainPidEpochs.add(pidEpochKey);
      ambiguousDomainPids.add(pid);
    }

    const prevBare = barePidMap.get(pidEpochKey);
    if (prevBare === undefined) {
      barePidMap.set(pidEpochKey, { pid, rank: rm.rank, source: rm.source, hostKey, instKey, grpKey });
    } else if (
      prevBare !== "ambiguous" &&
      (prevBare.rank !== rm.rank ||
        prevBare.hostKey !== hostKey ||
        prevBare.instKey !== instKey ||
        prevBare.grpKey !== grpKey)
    ) {
      barePidMap.set(pidEpochKey, "ambiguous");
      ambiguousDomainPidEpochs.add(pidEpochKey);
      ambiguousDomainPids.add(pid);
    }
  }
  const hasOtherNonEmptyDim = (
    map: Map<string, Set<string>>,
    pidEpochKey: string,
    expected: string,
  ): boolean => {
    const s = map.get(pidEpochKey);
    if (!s || s.size === 0) return false;
    return s.size > 1 || !s.has(expected);
  };
  for (const [pidEpochKey, prevBare] of barePidMap) {
    if (prevBare === "ambiguous") continue;
    if (
      hasOtherNonEmptyDim(pidNonEmptyHosts, pidEpochKey, prevBare.hostKey) ||
      hasOtherNonEmptyDim(pidNonEmptyInsts, pidEpochKey, prevBare.instKey) ||
      hasOtherNonEmptyDim(pidNonEmptyGrps, pidEpochKey, prevBare.grpKey)
    ) {
      barePidMap.set(pidEpochKey, "ambiguous");
      ambiguousDomainPidEpochs.add(pidEpochKey);
      ambiguousDomainPids.add(prevBare.pid);
    }
  }

  // Precompute conflict check once per distinct epoch-scopedKey using O(1) 8-bucket projection lookup
  const scopedKeyConflictCache = new Map<string, boolean>();
  const hasScopedKeyConflict = (
    scopedKey: string,
    pidEpochKey: string,
    _domain: Pick<ParsedLogLine, "hostTag" | "instanceTag" | "groupTag">,
    hostKey: string,
    instKey: string,
    grpKey: string,
    mappedRank: number,
  ): boolean => {
    const cached = scopedKeyConflictCache.get(scopedKey);
    if (cached !== undefined) return cached;
    const projMap = pidProjBuckets.get(pidEpochKey);
    let conflict = false;
    if (projMap) {
      const hOpts = hostKey !== "" ? [hostKey, ""] : ["*"];
      const iOpts = instKey !== "" ? [instKey, ""] : ["*"];
      const gOpts = grpKey !== "" ? [grpKey, ""] : ["*"];
      outer: for (const kh of hOpts) {
        for (const ki of iOpts) {
          for (const kg of gOpts) {
            const b = projMap.get(`${kh}\u0000${ki}\u0000${kg}`);
            if (!b) continue;
            if (
              (hostKey !== "" && kh === "") ||
              (instKey !== "" && ki === "") ||
              (grpKey !== "" && kg === "") ||
              (kh === "*" && b.hasNonEmptyH) ||
              (ki === "*" && b.hasNonEmptyI) ||
              (kg === "*" && b.hasNonEmptyG) ||
              b.rankState === "multi" ||
              (typeof b.rankState === "number" && b.rankState !== mappedRank)
            ) {
              conflict = true;
              break outer;
            }
          }
        }
      }
    }
    scopedKeyConflictCache.set(scopedKey, conflict);
    return conflict;
  };

  interface TracebackScopeState {
    key: string;
    inTraceback: boolean;
    activeTracebackGroupId: number | null;
    rank: number | null;
    rankSource: RankSource | null;
    hostTag: string | null;
    instanceTag: string | null;
    groupTag: string | null;
    pid: number | null;
    ts: string | null;
    tsMs: number | null;
    tsSubMs: number;
    tsKind: "full" | "short-date" | "time-only" | null;
    hasTz: boolean;
    inferredYearMatched: boolean;
    chainSnapshot: TracebackSnapshot | null;
    chainState: "none" | "awaiting-marker" | "awaiting-traceback";
  }

  let tracebackGroupIdCounter = 0;
  const tbStates = new Map<string, TracebackScopeState>();
  interface TbModeIndex {
    all: Set<TracebackScopeState>;
    byRank: Map<number, Set<TracebackScopeState>>;
    noRank: Set<TracebackScopeState>;
    byPid: Map<number, Set<TracebackScopeState>>;
    noPid: Set<TracebackScopeState>;
    byHost: Map<string, Set<TracebackScopeState>>;
    noHost: Set<TracebackScopeState>;
    byInstance: Map<string, Set<TracebackScopeState>>;
    noInstance: Set<TracebackScopeState>;
    byGroup: Map<string, Set<TracebackScopeState>>;
    noGroup: Set<TracebackScopeState>;
  }
  const createTbModeIndex = (): TbModeIndex => ({
    all: new Set(),
    byRank: new Map(),
    noRank: new Set(),
    byPid: new Map(),
    noPid: new Set(),
    byHost: new Map(),
    noHost: new Set(),
    byInstance: new Map(),
    noInstance: new Set(),
    byGroup: new Map(),
    noGroup: new Set(),
  });
  const activeTbIdx = createTbModeIndex();
  const chainTbIdx = createTbModeIndex();
  const indexedMeta = new Map<
    TracebackScopeState,
    {
      activeMeta: {
        r: number | null;
        p: number | null;
        h: string | null;
        inst: string | null;
        g: string | null;
      } | null;
      chainMeta: {
        r: number | null;
        p: number | null;
        h: string | null;
        inst: string | null;
        g: string | null;
      } | null;
    }
  >();
  const addSetMap = <K>(
    m: Map<K, Set<TracebackScopeState>>,
    noSet: Set<TracebackScopeState>,
    k: K | null,
    st: TracebackScopeState,
  ) => {
    if (k === null) {
      noSet.add(st);
      return;
    }
    let s = m.get(k);
    if (!s) {
      s = new Set();
      m.set(k, s);
    }
    s.add(st);
  };
  const delSetMap = <K>(
    m: Map<K, Set<TracebackScopeState>>,
    noSet: Set<TracebackScopeState>,
    k: K | null,
    st: TracebackScopeState,
  ) => {
    if (k === null) {
      noSet.delete(st);
      return;
    }
    const s = m.get(k);
    if (s) {
      s.delete(st);
      if (s.size === 0) m.delete(k);
    }
  };
  const removeFromTbIdx = (
    idx: TbModeIndex,
    st: TracebackScopeState,
    meta: { r: number | null; p: number | null; h: string | null; inst: string | null; g: string | null },
  ) => {
    idx.all.delete(st);
    delSetMap(idx.byRank, idx.noRank, meta.r, st);
    delSetMap(idx.byPid, idx.noPid, meta.p, st);
    delSetMap(idx.byHost, idx.noHost, meta.h, st);
    delSetMap(idx.byInstance, idx.noInstance, meta.inst, st);
    delSetMap(idx.byGroup, idx.noGroup, meta.g, st);
  };
  const addToTbIdx = (
    idx: TbModeIndex,
    st: TracebackScopeState,
    meta: { r: number | null; p: number | null; h: string | null; inst: string | null; g: string | null },
  ) => {
    idx.all.add(st);
    addSetMap(idx.byRank, idx.noRank, meta.r, st);
    addSetMap(idx.byPid, idx.noPid, meta.p, st);
    addSetMap(idx.byHost, idx.noHost, meta.h, st);
    addSetMap(idx.byInstance, idx.noInstance, meta.inst, st);
    addSetMap(idx.byGroup, idx.noGroup, meta.g, st);
  };
  interface TbMatchSummary {
    states: TracebackScopeState[];
    single: TracebackScopeState | null;
    first: TracebackScopeState | null;
    agreeDomain: boolean;
    agreePid: boolean;
    agreeRank: boolean;
    agreeTs: boolean;
  }

  const tbLookupMemo = new Map<string, TbMatchSummary>();
  const syncTbIndex = (st: TracebackScopeState) => {
    tbLookupMemo.clear();
    const prev = indexedMeta.get(st);
    if (prev?.activeMeta) removeFromTbIdx(activeTbIdx, st, prev.activeMeta);
    if (prev?.chainMeta) removeFromTbIdx(chainTbIdx, st, prev.chainMeta);
    const inActive = st.inTraceback;
    const inChain = st.chainState !== "none";
    if (!inActive && !inChain) {
      indexedMeta.delete(st);
      return;
    }
    const activeMeta = inActive
      ? {
          r: st.rank,
          p: st.pid,
          h: st.hostTag?.toLowerCase() ?? null,
          inst: st.instanceTag?.toLowerCase() ?? null,
          g: st.groupTag?.toLowerCase() ?? null,
        }
      : null;
    const dom = st.chainSnapshot ?? st;
    const chainMeta = inChain
      ? {
          r: dom.rank,
          p: dom.pid,
          h: dom.hostTag?.toLowerCase() ?? null,
          inst: dom.instanceTag?.toLowerCase() ?? null,
          g: dom.groupTag?.toLowerCase() ?? null,
        }
      : null;
    if (activeMeta) addToTbIdx(activeTbIdx, st, activeMeta);
    if (chainMeta) addToTbIdx(chainTbIdx, st, chainMeta);
    indexedMeta.set(st, { activeMeta, chainMeta });
  };
  const unindexTb = (st: TracebackScopeState) => {
    tbLookupMemo.clear();
    const prev = indexedMeta.get(st);
    if (!prev) return;
    if (prev.activeMeta) removeFromTbIdx(activeTbIdx, st, prev.activeMeta);
    if (prev.chainMeta) removeFromTbIdx(chainTbIdx, st, prev.chainMeta);
    indexedMeta.delete(st);
  };
  const clearAllTbIdx = () => {
    tbLookupMemo.clear();
    for (const idx of [activeTbIdx, chainTbIdx]) {
      idx.all.clear();
      idx.byRank.clear();
      idx.noRank.clear();
      idx.byPid.clear();
      idx.noPid.clear();
      idx.byHost.clear();
      idx.noHost.clear();
      idx.byInstance.clear();
      idx.noInstance.clear();
      idx.byGroup.clear();
      idx.noGroup.clear();
    }
    indexedMeta.clear();
  };
  const selectSmallestTbBuckets = (
    idx: TbModeIndex,
    r: number | null,
    p: number | null,
    h: string | null,
    inst: string | null,
    g: string | null,
  ): ReadonlyArray<ReadonlySet<TracebackScopeState>> => {
    if (idx.all.size === 0) return [];
    let best: ReadonlyArray<ReadonlySet<TracebackScopeState>> = [idx.all];
    let bestSize = idx.all.size;
    const consider = (
      exact: ReadonlySet<TracebackScopeState> | undefined,
      wild: ReadonlySet<TracebackScopeState>,
    ) => {
      const total = (exact?.size ?? 0) + wild.size;
      if (total < bestSize) {
        bestSize = total;
        best =
          exact && exact.size > 0 ? (wild.size > 0 ? [exact, wild] : [exact]) : wild.size > 0 ? [wild] : [];
      }
    };
    if (r !== null) consider(idx.byRank.get(r), idx.noRank);
    if (p !== null) consider(idx.byPid.get(p), idx.noPid);
    if (h !== null) consider(idx.byHost.get(h.toLowerCase()), idx.noHost);
    if (inst !== null) consider(idx.byInstance.get(inst.toLowerCase()), idx.noInstance);
    if (g !== null) consider(idx.byGroup.get(g.toLowerCase()), idx.noGroup);
    return best;
  };
  let lastFocusedTbKey: string | null = null;
  let currentLineNumber = 1;
  let currentSegmentId = 0;

  const makeTbScopeKey = (
    r: number | null,
    p: number | null,
    h: string | null,
    inst: string | null,
    g: string | null,
  ) =>
    `${(h ?? "").toLowerCase()}#${(inst ?? "").toLowerCase()}#${(g ?? "").toLowerCase()}#${p ?? "na"}#${r ?? "na"}`;

  const touchTbState = (st: TracebackScopeState) => {
    const existing = tbStates.get(st.key);
    if (existing && existing !== st) {
      unindexTb(existing);
    }
    tbStates.delete(st.key);
    tbStates.set(st.key, st);
    syncTbIndex(st);
    if (tbStates.size > 256) {
      const oldestKey = tbStates.keys().next().value;
      if (oldestKey !== undefined && oldestKey !== st.key) {
        const oldestSt = tbStates.get(oldestKey);
        if (oldestSt) unindexTb(oldestSt);
        tbStates.delete(oldestKey);
        if (lastFocusedTbKey === oldestKey) lastFocusedTbKey = null;
      }
    }
  };

  const resetTbState = (st: TracebackScopeState | null | undefined, preserveForChain = false) => {
    if (!st) return;
    if (preserveForChain && st.inTraceback) {
      unindexTb(st);
      st.chainSnapshot = {
        rank: st.rank,
        rankSource: st.rankSource,
        hostTag: st.hostTag,
        instanceTag: st.instanceTag,
        groupTag: st.groupTag,
        pid: st.pid,
        ts: st.ts,
        tsMs: st.tsMs,
        tsSubMs: st.tsSubMs,
        tsKind: st.tsKind,
        hasTz: st.hasTz,
        inferredYearMatched: st.inferredYearMatched,
        groupId: st.activeTracebackGroupId,
      };
      st.chainState = "awaiting-marker";
      st.inTraceback = false;
      st.activeTracebackGroupId = null;
      touchTbState(st);
      lastFocusedTbKey = st.key;
      return;
    }
    unindexTb(st);
    st.chainSnapshot = null;
    st.chainState = "none";
    st.inTraceback = false;
    st.activeTracebackGroupId = null;
    tbStates.delete(st.key);
    if (lastFocusedTbKey === st.key) lastFocusedTbKey = null;
  };

  const findMatchingTbStates = (
    r: number | null,
    p: number | null,
    h: string | null,
    inst: string | null,
    g: string | null,
    mode: "active" | "chain",
  ): TbMatchSummary => {
    const idx = mode === "active" ? activeTbIdx : chainTbIdx;
    const hLow = h !== null ? h.toLowerCase() : null;
    const instLow = inst !== null ? inst.toLowerCase() : null;
    const gLow = g !== null ? g.toLowerCase() : null;
    const rKey = r === null ? "na" : idx.byRank.has(r) ? r : "__OTHER__";
    const pKey = p === null ? "na" : idx.byPid.has(p) ? p : "__OTHER__";
    const hKey = hLow === null ? "" : idx.byHost.has(hLow) ? hLow : "__OTHER__";
    const instKey = instLow === null ? "" : idx.byInstance.has(instLow) ? instLow : "__OTHER__";
    const gKey = gLow === null ? "" : idx.byGroup.has(gLow) ? gLow : "__OTHER__";
    const memoKey = `${mode}#${rKey}#${pKey}#${hKey}#${instKey}#${gKey}`;
    const cached = tbLookupMemo.get(memoKey);
    if (cached) return cached;
    let matches: TracebackScopeState[] = [];
    let bestScore = -1;
    const pools = selectSmallestTbBuckets(idx, r, p, h, inst, g);
    for (const pool of pools) {
      for (const st of pool) {
        if (mode === "active" && !st.inTraceback) continue;
        if (mode === "chain" && st.chainState === "none") continue;
        const domTarget = mode === "chain" && st.chainSnapshot ? st.chainSnapshot : st;
        if (!areCausalDomainsCompatible({ hostTag: h, instanceTag: inst, groupTag: g }, domTarget)) {
          continue;
        }
        if (p !== null && domTarget.pid !== null && p !== domTarget.pid) continue;
        if (r !== null && domTarget.rank !== null && r !== domTarget.rank) continue;

        let matchesIdentity = false;
        let score = 0;
        if (r !== null) {
          if (domTarget.rank === r) {
            matchesIdentity = true;
            score = p !== null && domTarget.pid === p ? 3 : 2;
          } else if (domTarget.rank === null && p !== null && domTarget.pid === p) {
            matchesIdentity = true;
            score = 2;
          }
        } else if (p !== null) {
          if (domTarget.pid === p) {
            matchesIdentity = true;
            score = 2;
          }
        } else if (
          domTarget.rank === null &&
          domTarget.pid === null &&
          (domTarget.hostTag !== null || domTarget.instanceTag !== null || domTarget.groupTag !== null)
        ) {
          matchesIdentity = true;
          score = 1;
        }
        if (!matchesIdentity) continue;
        if (score > bestScore) {
          matches = [st];
          bestScore = score;
        } else if (score === bestScore) {
          matches.push(st);
        }
      }
    }
    const first = matches[0] ?? null;
    let agreeDomain = true;
    let agreePid = true;
    let agreeRank = true;
    let agreeTs = true;
    if (matches.length > 1 && first) {
      const fH = first.hostTag ?? null;
      const fI = first.instanceTag ?? null;
      const fG = first.groupTag ?? null;
      for (let k = 1; k < matches.length; k += 1) {
        const s = matches[k]!;
        if (
          agreeDomain &&
          ((s.hostTag ?? null) !== fH || (s.instanceTag ?? null) !== fI || (s.groupTag ?? null) !== fG)
        ) {
          agreeDomain = false;
        }
        if (agreePid && s.pid !== first.pid) agreePid = false;
        if (agreeRank && s.rank !== first.rank) agreeRank = false;
        if (
          agreeTs &&
          (s.ts !== first.ts ||
            s.tsMs !== first.tsMs ||
            s.tsSubMs !== first.tsSubMs ||
            s.tsKind !== first.tsKind ||
            s.hasTz !== first.hasTz)
        ) {
          agreeTs = false;
        }
        if (!agreeDomain && !agreePid && !agreeRank && !agreeTs) break;
      }
    }
    const summary: TbMatchSummary = {
      states: matches,
      single: matches.length === 1 ? first : null,
      first,
      agreeDomain,
      agreePid,
      agreeRank,
      agreeTs,
    };
    tbLookupMemo.set(memoKey, summary);
    return summary;
  };

  const resolveUniqueChainState = (
    r: number | null,
    p: number | null,
    h: string | null,
    inst: string | null,
    g: string | null,
    unlabelled: boolean,
    requiredState?: "awaiting-traceback",
  ): { st: TracebackScopeState | null; ambiguous: boolean } => {
    if (chainTbIdx.all.size === 0) return { st: null, ambiguous: false };
    if (unlabelled) {
      const cands: TracebackScopeState[] = [];
      for (const st of chainTbIdx.all) {
        if (st.chainState === "none") continue;
        if (requiredState && st.chainState !== requiredState) continue;
        cands.push(st);
        if (cands.length >= 2) return { st: null, ambiguous: true };
      }
      return { st: cands[0] ?? null, ambiguous: false };
    }
    const matches = findMatchingTbStates(r, p, h, inst, g, "chain").states;
    const filtered = requiredState ? matches.filter((s) => s.chainState === requiredState) : matches;
    if (filtered.length > 1) return { st: null, ambiguous: true };
    return { st: filtered[0] ?? null, ambiguous: false };
  };

  const clearAllChainTbStates = () => {
    for (const st of [...chainTbIdx.all]) {
      resetTbState(st, false);
    }
  };

  let ambiguousTbGroupId: number | null = null;
  let pendingAmbiguousChainReset = false;
  const ambiguousTbKeys = new Set<string>();

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
      currentSegmentId += 1;
      tbStates.clear();
      clearAllTbIdx();
      ambiguousTbKeys.clear();
      pendingAmbiguousChainReset = false;
      lastFocusedTbKey = null;
      ambiguousTbGroupId = null;
      continue;
    }

    const lineNumber = currentLineNumber;
    currentLineNumber += 1;

    const meta = rawMeta[i]!;
    const inspectLine = meta.inspectLine;
    const extractedTs = meta.extractedTs;
    const { timestamp, timestampMs } = extractedTs;
    const timestampSubMs = extractedTs.timestampSubMs ?? 0;
    const timestampKind = extractedTs.timestampKind ?? null;
    const hasExplicitTimezone = extractedTs.hasExplicitTimezone ?? false;
    const rankMatch = meta.rankMatch;
    let rank = rankMatch?.rank ?? null;
    let rankSource = rankMatch?.source ?? null;
    let hostTag = meta.hostTag;
    let instanceTag = meta.instanceTag;
    let groupTag = meta.groupTag;
    let pid = meta.pid;

    const pidEpoch = meta.pidEpoch;
    const pidEpochKey = pid !== null ? `${pid}@${meta.pidDomKey}@${pidEpoch}` : "";

    // Propagate unambiguous PID-epoch causal domain BEFORE building scopedKey so complementary lines share the PID's rank.
    if (pid !== null && !ambiguousDomainPidEpochs.has(pidEpochKey)) {
      const pidDom = pidDomainMap.get(pidEpochKey);
      if (
        pidDom &&
        pidDom !== "ambiguous" &&
        areCausalDomainsCompatible(pidDom, { hostTag, instanceTag, groupTag })
      ) {
        if (hostTag === null && pidDom.hostTag !== null) hostTag = pidDom.hostTag;
        if (instanceTag === null && pidDom.instanceTag !== null) instanceTag = pidDom.instanceTag;
        if (groupTag === null && pidDom.groupTag !== null) groupTag = pidDom.groupTag;
      }
    }

    if ((rank === null || rankSource === "device-id") && pid !== null) {
      const hostKey = (hostTag ?? "").toLowerCase();
      const instKey = (instanceTag ?? "").toLowerCase();
      const grpKey = (groupTag ?? "").toLowerCase();
      const scopedKey = `${hostKey}#${instKey}#${grpKey}#${pidEpochKey}`;
      const mapped = scopedPidMap.get(scopedKey);
      if (
        mapped &&
        mapped !== "ambiguous" &&
        !hasScopedKeyConflict(
          scopedKey,
          pidEpochKey,
          { hostTag, instanceTag, groupTag },
          hostKey,
          instKey,
          grpKey,
          mapped.rank,
        )
      ) {
        rank = mapped.rank;
        rankSource = mapped.source;
      } else if (rank === null && !ambiguousDomainPidEpochs.has(pidEpochKey)) {
        const devMapped = scopedDevicePidMap.get(scopedKey);
        if (
          devMapped &&
          devMapped !== "ambiguous" &&
          !hasScopedKeyConflict(
            scopedKey,
            pidEpochKey,
            { hostTag, instanceTag, groupTag },
            hostKey,
            instKey,
            grpKey,
            devMapped.rank,
          )
        ) {
          rank = devMapped.rank;
          rankSource = devMapped.source;
        }
      }
    }

    let effectiveTimestamp = timestamp;
    let effectiveTimestampMs = timestampMs;
    let effectiveTimestampSubMs = timestampSubMs;
    let effectiveTimestampKind = timestampKind;
    let effectiveHasExplicitTimezone = hasExplicitTimezone;
    let effectiveInferredYearMatched = meta.tsInferredYear;
    let lineTracebackGroupId: number | null = null;
    let lineAmbiguousTraceback = false;

    const focusedSt: TracebackScopeState | null = lastFocusedTbKey
      ? (tbStates.get(lastFocusedTbKey) ?? null)
      : null;
    const isLineUnlabelled =
      rank === null && pid === null && hostTag === null && instanceTag === null && groupTag === null;

    if (meta.isPromLine || trimmed.startsWith("#") || isPromExpositionLine(trimmed)) {
      parsed.push({
        lineNumber,
        segmentId: currentSegmentId,
        rawLine,
        inspectLine,
        trimmed,
        rank,
        rankSource,
        hostTag,
        instanceTag,
        groupTag,
        pid,
        timestamp: effectiveTimestamp,
        timestampMs: effectiveTimestampMs,
        timestampSubMs: effectiveTimestampSubMs,
        timestampKind: effectiveTimestampKind,
        hasExplicitTimezone: effectiveHasExplicitTimezone,
        inferredYearMatched: effectiveInferredYearMatched,
        tracebackGroupId: null,
        ...(meta.isPromLine ? { isPromLine: true } : {}),
      });
      continue;
    }

    if (/Traceback \(most recent call last\):/i.test(trimmed)) {
      ambiguousTbGroupId = null;
      const chainLookup = resolveUniqueChainState(
        rank,
        pid,
        hostTag,
        instanceTag,
        groupTag,
        isLineUnlabelled,
        "awaiting-traceback",
      );
      const consumeAmbiguousChain = pendingAmbiguousChainReset && rank === null && pid === null;
      pendingAmbiguousChainReset = false;
      const chainAmbiguous = consumeAmbiguousChain || chainLookup.ambiguous;
      const chainCandidate: TracebackScopeState | null = chainAmbiguous ? null : chainLookup.st;
      const closedSnap = chainCandidate?.chainSnapshot ?? null;
      const canChainFromClosed =
        chainCandidate !== null &&
        chainCandidate.chainState === "awaiting-traceback" &&
        closedSnap !== null &&
        (rank === null || closedSnap.rank === null || rank === closedSnap.rank) &&
        (pid === null || closedSnap.pid === null || pid === closedSnap.pid) &&
        (timestamp === null || (closedSnap.ts !== null && timestamp === closedSnap.ts)) &&
        areCausalDomainsCompatible(
          { hostTag, instanceTag, groupTag },
          {
            hostTag: closedSnap.hostTag,
            instanceTag: closedSnap.instanceTag,
            groupTag: closedSnap.groupTag,
          },
        );
      let activeGroupId: number;
      if (chainAmbiguous) {
        clearAllChainTbStates();
        lastFocusedTbKey = null;
        lineAmbiguousTraceback = true;
        tracebackGroupIdCounter += 1;
        activeGroupId = tracebackGroupIdCounter;
      } else if (canChainFromClosed && closedSnap !== null) {
        if (rank === null) {
          rank = closedSnap.rank;
          rankSource = closedSnap.rankSource;
        }
        if (hostTag === null) hostTag = closedSnap.hostTag;
        if (instanceTag === null) instanceTag = closedSnap.instanceTag;
        if (groupTag === null) groupTag = closedSnap.groupTag;
        if (pid === null) pid = closedSnap.pid;
        effectiveTimestamp = closedSnap.ts;
        effectiveTimestampMs = closedSnap.tsMs;
        effectiveTimestampSubMs = closedSnap.tsSubMs;
        effectiveTimestampKind = closedSnap.tsKind;
        effectiveHasExplicitTimezone = closedSnap.hasTz;
        effectiveInferredYearMatched = closedSnap.inferredYearMatched;
        activeGroupId = closedSnap.groupId ?? ++tracebackGroupIdCounter;
        if (chainCandidate) {
          unindexTb(chainCandidate);
          tbStates.delete(chainCandidate.key);
        }
      } else {
        tracebackGroupIdCounter += 1;
        activeGroupId = tracebackGroupIdCounter;
      }
      const key = makeTbScopeKey(rank, pid, hostTag, instanceTag, groupTag);
      const nextSt: TracebackScopeState = {
        key,
        inTraceback: true,
        activeTracebackGroupId: activeGroupId,
        rank,
        rankSource,
        hostTag,
        instanceTag,
        groupTag,
        pid,
        ts: effectiveTimestamp,
        tsMs: effectiveTimestampMs,
        tsSubMs: effectiveTimestampSubMs,
        tsKind: effectiveTimestampKind,
        hasTz: effectiveHasExplicitTimezone,
        inferredYearMatched: effectiveInferredYearMatched,
        chainSnapshot: null,
        chainState: "none",
      };
      if (chainAmbiguous) {
        ambiguousTbKeys.add(key);
      } else if (!(canChainFromClosed && ambiguousTbKeys.has(chainCandidate?.key ?? ""))) {
        ambiguousTbKeys.delete(key);
      }
      touchTbState(nextSt);
      lastFocusedTbKey = key;
      lineTracebackGroupId = activeGroupId;
    } else {
      const excBodyMatch = RANK_BODY_BOUNDARY_RE.exec(inspectLine);
      const pidMatch = pid !== null ? PID_RE.exec(inspectLine) : null;
      const isBodyRefPid =
        pidMatch !== null &&
        /\b(?:from|to|peer|remote|src|dst|target)\s+$/i.test(
          inspectLine.slice(Math.max(0, pidMatch.index - 16), pidMatch.index),
        );
      const pidAfterExc = excBodyMatch !== null && pidMatch !== null && pidMatch.index > excBodyMatch.index;
      const hasHeaderPid = pid !== null && !isBodyRefPid;
      const hasStrictHeaderPid = pid !== null && !isBodyRefPid && !pidAfterExc;

      const activeEligibleTbs: TracebackScopeState[] = [];
      if (activeTbIdx.all.size > 0) {
        const eligiblePools = selectSmallestTbBuckets(
          activeTbIdx,
          null,
          hasStrictHeaderPid ? pid : null,
          hostTag,
          instanceTag,
          groupTag,
        );
        outerEligible: for (const pool of eligiblePools) {
          for (const st of pool) {
            if (!st.inTraceback) continue;
            if (
              !areCausalDomainsCompatible(
                { hostTag, instanceTag, groupTag },
                { hostTag: st.hostTag, instanceTag: st.instanceTag, groupTag: st.groupTag },
              )
            ) {
              continue;
            }
            if (hasStrictHeaderPid && pid !== null && st.pid !== null && pid !== st.pid) continue;
            activeEligibleTbs.push(st);
            if (activeEligibleTbs.length >= 2) break outerEligible;
          }
        }
      }
      const uniqueEligibleTb: TracebackScopeState | null =
        activeEligibleTbs.length === 1 ? activeEligibleTbs[0]! : null;
      const singleActiveTb: TracebackScopeState | null =
        activeEligibleTbs.length > 1
          ? null
          : (uniqueEligibleTb ?? (focusedSt?.inTraceback ? focusedSt : null));

      const strippedContBody = stripTracebackLogPrefix(inspectLine);
      const contPrefixSlice = inspectLine.slice(0, inspectLine.length - strippedContBody.length);
      const strippedContTrimmed = strippedContBody.trim();
      const headerHasRankOrDomain =
        (rank !== null && rankMatch !== null && rankMatch.index < contPrefixSlice.length) ||
        hasStrictHeaderPid ||
        hostTag !== null ||
        instanceTag !== null ||
        groupTag !== null;
      const hasBenignContPrefixLevel = /(?<![.\w])(?:INFO|DEBUG)\b/i.test(contPrefixSlice);

      const isEmbeddedBodyRank =
        rank !== null &&
        (timestamp === null || !headerHasRankOrDomain) &&
        !hasStrictHeaderPid &&
        !hasBenignContPrefixLevel &&
        !LOG_HEADER_LEVEL_RE.test(strippedContTrimmed) &&
        (TRACEBACK_UNPREFIXED_CONT_RE.test(strippedContBody) ||
          TRACEBACK_UNPREFIXED_TERMINAL_RE.test(strippedContTrimmed)) &&
        (rankSource === "device-id" ||
          (excBodyMatch !== null && rankMatch !== null && rankMatch.index > excBodyMatch.index) ||
          (rankMatch !== null &&
            rankMatch.index > 0 &&
            !/^\s*(?:\[|\(|(?:host|node|instance|group|pid|rank|global_rank|local_rank|RankID)\b)/i.test(
              strippedContBody,
            )));
      const isEmbeddedBodyPid =
        pid !== null &&
        (isBodyRefPid || (activeEligibleTbs.length > 1 && pidAfterExc)) &&
        (timestamp === null || !headerHasRankOrDomain) &&
        !hasBenignContPrefixLevel &&
        !LOG_HEADER_LEVEL_RE.test(strippedContTrimmed) &&
        (TRACEBACK_UNPREFIXED_CONT_RE.test(strippedContBody) ||
          TRACEBACK_UNPREFIXED_TERMINAL_RE.test(strippedContTrimmed));

      const treatEmbeddedRankAsBody =
        singleActiveTb !== null && singleActiveTb.inTraceback && (isEmbeddedBodyRank || isEmbeddedBodyPid);

      const multiTbUnlabelledCont =
        activeEligibleTbs.length > 1 &&
        (isLineUnlabelled || isEmbeddedBodyRank || isEmbeddedBodyPid) &&
        !headerHasRankOrDomain &&
        !hasBenignContPrefixLevel &&
        !LOG_HEADER_LEVEL_RE.test(strippedContTrimmed) &&
        (TRACEBACK_UNPREFIXED_CONT_RE.test(strippedContBody) ||
          TRACEBACK_UNPREFIXED_TERMINAL_RE.test(strippedContTrimmed));

      if (trimmed.length === 0) {
        ambiguousTbGroupId = null;
        if (singleActiveTb?.inTraceback) {
          resetTbState(singleActiveTb, false);
        }
      } else if (multiTbUnlabelledCont) {
        if (ambiguousTbGroupId === null) {
          tracebackGroupIdCounter += 1;
          ambiguousTbGroupId = tracebackGroupIdCounter;
        }
        lineTracebackGroupId = ambiguousTbGroupId;
        lineAmbiguousTraceback = true;
        rank = null;
        rankSource = null;
        if (!hasHeaderPid || isEmbeddedBodyPid) pid = null;
        if (timestamp === null) {
          effectiveTimestamp = null;
          effectiveTimestampMs = null;
          effectiveTimestampSubMs = 0;
          effectiveTimestampKind = null;
          effectiveHasExplicitTimezone = false;
          effectiveInferredYearMatched = false;
        }
        if (TRACEBACK_UNPREFIXED_TERMINAL_RE.test(strippedContTrimmed)) {
          ambiguousTbGroupId = null;
        }
      } else if (
        (isLineUnlabelled &&
          (timestamp === null ||
            (!hasBenignContPrefixLevel &&
              !LOG_HEADER_LEVEL_RE.test(strippedContTrimmed) &&
              (TRACEBACK_UNPREFIXED_CONT_RE.test(strippedContBody) ||
                TRACEBACK_UNPREFIXED_TERMINAL_RE.test(strippedContTrimmed))))) ||
        treatEmbeddedRankAsBody
      ) {
        ambiguousTbGroupId = null;
        if (singleActiveTb?.inTraceback) {
          const domainCompat = areCausalDomainsCompatible(
            { hostTag, instanceTag, groupTag },
            {
              hostTag: singleActiveTb.hostTag,
              instanceTag: singleActiveTb.instanceTag,
              groupTag: singleActiveTb.groupTag,
            },
          );
          let conflictPid = hasHeaderPid ? pid : null;
          if (conflictPid === null) {
            const pm = PID_RE.exec(inspectLine);
            const pRaw = pm?.[1] ?? pm?.[2];
            if (pRaw && pm) {
              const beforeFull = inspectLine.slice(0, pm.index);
              const beforeShort = beforeFull.replace(/\(\s*$/, "").slice(Math.max(0, beforeFull.length - 16));
              const isBeforeException = !excBodyMatch || pm.index < excBodyMatch.index;
              const isCAnnModulePid = pm[2] !== undefined;
              const isTrailingStandaloneParenPid =
                /\(\s*$/.test(beforeFull) && /^pid\s*[:=]\s*\d+\s*\)\s*$/i.test(inspectLine.slice(pm.index));
              const isValidConflictPid =
                isCAnnModulePid ||
                isTrailingStandaloneParenPid ||
                (isBeforeException && isValidHeaderPrefixBeforePid(beforeFull));
              if (
                !/\b(?:owned|allocated|created|held|from|to|peer|remote|src|dst|target|by)\s+$/i.test(
                  beforeShort,
                ) &&
                isValidConflictPid
              ) {
                const pVal = Number.parseInt(pRaw, 10);
                if (Number.isFinite(pVal)) conflictPid = pVal;
              }
            }
          }
          const pidConflict = conflictPid !== null && conflictPid !== singleActiveTb.pid;
          if (
            !domainCompat ||
            pidConflict ||
            hasBenignContPrefixLevel ||
            LOG_HEADER_LEVEL_RE.test(strippedContTrimmed) ||
            (!TRACEBACK_UNPREFIXED_CONT_RE.test(strippedContBody) &&
              !TRACEBACK_UNPREFIXED_TERMINAL_RE.test(strippedContTrimmed))
          ) {
            resetTbState(singleActiveTb, false);
          } else {
            unindexTb(singleActiveTb);
            if (singleActiveTb.rank !== null || isEmbeddedBodyRank) {
              rank = singleActiveTb.rank;
              rankSource = singleActiveTb.rankSource;
            }
            if (hostTag === null) hostTag = singleActiveTb.hostTag;
            else if (singleActiveTb.hostTag === null) singleActiveTb.hostTag = hostTag;
            if (instanceTag === null) instanceTag = singleActiveTb.instanceTag;
            else if (singleActiveTb.instanceTag === null) singleActiveTb.instanceTag = instanceTag;
            if (groupTag === null) groupTag = singleActiveTb.groupTag;
            else if (singleActiveTb.groupTag === null) singleActiveTb.groupTag = groupTag;
            if (pid === null || !hasHeaderPid || isEmbeddedBodyPid) pid = singleActiveTb.pid;
            else if (singleActiveTb.pid === null) singleActiveTb.pid = pid;
            if (singleActiveTb.ts !== null) {
              effectiveTimestamp = singleActiveTb.ts;
              effectiveTimestampMs = singleActiveTb.tsMs;
              effectiveTimestampSubMs = singleActiveTb.tsSubMs;
              effectiveTimestampKind = singleActiveTb.tsKind;
              effectiveHasExplicitTimezone = singleActiveTb.hasTz;
              effectiveInferredYearMatched = singleActiveTb.inferredYearMatched;
            }
            lineTracebackGroupId = singleActiveTb.activeTracebackGroupId;
            if (ambiguousTbKeys.has(singleActiveTb.key)) {
              lineAmbiguousTraceback = true;
            }
            touchTbState(singleActiveTb);
            lastFocusedTbKey = singleActiveTb.key;
            if (TRACEBACK_UNPREFIXED_TERMINAL_RE.test(strippedContTrimmed)) {
              resetTbState(singleActiveTb, true);
            }
          }
        } else if (activeEligibleTbs.length > 1) {
          tbStates.clear();
          clearAllTbIdx();
          ambiguousTbKeys.clear();
          pendingAmbiguousChainReset = false;
          lastFocusedTbKey = null;
        } else if (chainTbIdx.all.size > 0) {
          const strippedChainBody = stripTracebackLogPrefix(inspectLine).trim();
          const isChainBanner = /^(?:During handling of|The above exception|Caused by:)/.test(
            strippedChainBody,
          );
          const chainLookup = resolveUniqueChainState(
            rank,
            hasHeaderPid ? pid : null,
            hostTag,
            instanceTag,
            groupTag,
            isLineUnlabelled,
          );
          if (isChainBanner && chainLookup.ambiguous) {
            clearAllChainTbStates();
            lastFocusedTbKey = null;
            pendingAmbiguousChainReset = true;
            lineAmbiguousTraceback = true;
            rank = null;
            rankSource = null;
          } else if (isChainBanner && chainLookup.st !== null && chainLookup.st.chainSnapshot !== null) {
            const chainSt = chainLookup.st;
            const closedSnap = chainLookup.st.chainSnapshot;
            rank = closedSnap.rank;
            rankSource = closedSnap.rankSource;
            if (hostTag === null) hostTag = closedSnap.hostTag;
            if (instanceTag === null) instanceTag = closedSnap.instanceTag;
            if (groupTag === null) groupTag = closedSnap.groupTag;
            if (pid === null) pid = closedSnap.pid;
            effectiveTimestamp = closedSnap.ts;
            effectiveTimestampMs = closedSnap.tsMs;
            effectiveTimestampSubMs = closedSnap.tsSubMs;
            effectiveTimestampKind = closedSnap.tsKind;
            effectiveHasExplicitTimezone = closedSnap.hasTz;
            effectiveInferredYearMatched = closedSnap.inferredYearMatched;
            lineTracebackGroupId = closedSnap.groupId;
            if (ambiguousTbKeys.has(chainSt.key)) lineAmbiguousTraceback = true;
            chainSt.chainState = "awaiting-traceback";
            touchTbState(chainSt);
            lastFocusedTbKey = chainSt.key;
          } else {
            pendingAmbiguousChainReset = false;
            clearAllChainTbStates();
            ambiguousTbKeys.clear();
          }
        } else {
          pendingAmbiguousChainReset = false;
        }
      } else {
        ambiguousTbGroupId = null;
        const matchingSummary: TbMatchSummary = isLineUnlabelled
          ? focusedSt?.inTraceback
            ? {
                states: [focusedSt],
                single: focusedSt,
                first: focusedSt,
                agreeDomain: true,
                agreePid: true,
                agreeRank: true,
                agreeTs: true,
              }
            : {
                states: [],
                single: null,
                first: null,
                agreeDomain: true,
                agreePid: true,
                agreeRank: true,
                agreeTs: true,
              }
          : findMatchingTbStates(rank, hasHeaderPid ? pid : null, hostTag, instanceTag, groupTag, "active");
        const matchingActiveTbs = matchingSummary.states;
        const activeSt: TracebackScopeState | null = matchingSummary.single;
        const strippedBody = stripTracebackLogPrefix(inspectLine);
        const prefixSlice = inspectLine.slice(0, inspectLine.length - strippedBody.length);
        const strippedTrimmed = strippedBody.trim();
        const isTracebackSyntaxLine =
          !/(?<![.\w])(?:INFO|DEBUG)\b/i.test(prefixSlice) &&
          !LOG_HEADER_LEVEL_RE.test(strippedTrimmed) &&
          (TRACEBACK_UNPREFIXED_CONT_RE.test(strippedBody) ||
            TRACEBACK_UNPREFIXED_TERMINAL_RE.test(strippedTrimmed));

        if (matchingActiveTbs.length > 1 && matchingSummary.first) {
          const firstMatch = matchingSummary.first;
          const { agreeDomain, agreePid, agreeRank, agreeTs } = matchingSummary;
          const identityMatchesAll =
            (hasHeaderPid && pid !== null && agreePid && firstMatch.pid === pid) ||
            (rank !== null && agreeRank && firstMatch.rank === rank);

          if (isTracebackSyntaxLine && identityMatchesAll) {
            tracebackGroupIdCounter += 1;
            lineTracebackGroupId = tracebackGroupIdCounter;
            if (!agreeDomain || !agreeTs || !agreePid || !agreeRank) {
              lineAmbiguousTraceback = true;
            }
            if (rank === null && agreeRank && firstMatch.rank !== null) {
              rank = firstMatch.rank;
              rankSource = firstMatch.rankSource;
            }
            if (hostTag === null && agreeDomain) hostTag = firstMatch.hostTag;
            if (instanceTag === null && agreeDomain) instanceTag = firstMatch.instanceTag;
            if (groupTag === null && agreeDomain) groupTag = firstMatch.groupTag;
            if ((pid === null || !hasHeaderPid) && agreePid) pid = firstMatch.pid;
            if (effectiveTimestamp === null && agreeTs && firstMatch.ts !== null) {
              effectiveTimestamp = firstMatch.ts;
              effectiveTimestampMs = firstMatch.tsMs;
              effectiveTimestampSubMs = firstMatch.tsSubMs;
              effectiveTimestampKind = firstMatch.tsKind;
              effectiveHasExplicitTimezone = firstMatch.hasTz;
              effectiveInferredYearMatched = firstMatch.inferredYearMatched;
            }
            lastFocusedTbKey = null;
            if (TRACEBACK_UNPREFIXED_TERMINAL_RE.test(strippedTrimmed)) {
              for (const st of matchingActiveTbs) resetTbState(st, false);
            }
          } else {
            for (const st of matchingActiveTbs) resetTbState(st, false);
          }
        } else {
          const isPrefixedCont =
            activeSt !== null &&
            isTracebackSyntaxLine &&
            areCausalDomainsCompatible(
              { hostTag, instanceTag, groupTag },
              { hostTag: activeSt.hostTag, instanceTag: activeSt.instanceTag, groupTag: activeSt.groupTag },
            ) &&
            !(hasHeaderPid && pid !== null && activeSt.pid !== null && pid !== activeSt.pid) &&
            !(rank !== null && activeSt.rank !== null && rank !== activeSt.rank) &&
            ((hasHeaderPid && pid !== null && activeSt.pid !== null && pid === activeSt.pid) ||
              (rank !== null && activeSt.rank !== null && rank === activeSt.rank));
          if (isPrefixedCont && activeSt !== null) {
            unindexTb(activeSt);
            lineTracebackGroupId = activeSt.activeTracebackGroupId;
            if (rank === null && activeSt.rank !== null) {
              rank = activeSt.rank;
              rankSource = activeSt.rankSource;
            }
            if (hostTag === null) hostTag = activeSt.hostTag;
            else if (activeSt.hostTag === null) activeSt.hostTag = hostTag;
            if (instanceTag === null) instanceTag = activeSt.instanceTag;
            else if (activeSt.instanceTag === null) activeSt.instanceTag = instanceTag;
            if (groupTag === null) groupTag = activeSt.groupTag;
            else if (activeSt.groupTag === null) activeSt.groupTag = groupTag;
            if (pid === null || !hasHeaderPid) {
              pid = activeSt.pid;
            }
            if (effectiveTimestamp === null && activeSt.ts !== null) {
              effectiveTimestamp = activeSt.ts;
              effectiveTimestampMs = activeSt.tsMs;
              effectiveTimestampSubMs = activeSt.tsSubMs;
              effectiveTimestampKind = activeSt.tsKind;
              effectiveHasExplicitTimezone = activeSt.hasTz;
              effectiveInferredYearMatched = activeSt.inferredYearMatched;
            }
            if (ambiguousTbKeys.has(activeSt.key)) {
              lineAmbiguousTraceback = true;
            }
            touchTbState(activeSt);
            lastFocusedTbKey = activeSt.key;
            if (TRACEBACK_UNPREFIXED_TERMINAL_RE.test(strippedTrimmed)) {
              resetTbState(activeSt, true);
            }
          } else {
            if (activeSt !== null) {
              resetTbState(activeSt, false);
            }
            const isChainBanner = /^(?:During handling of|The above exception|Caused by:)/.test(
              strippedTrimmed,
            );
            const chainLookup = resolveUniqueChainState(
              rank,
              hasHeaderPid ? pid : null,
              hostTag,
              instanceTag,
              groupTag,
              isLineUnlabelled,
            );
            if (isChainBanner && chainLookup.ambiguous) {
              clearAllChainTbStates();
              lastFocusedTbKey = null;
              pendingAmbiguousChainReset = true;
              lineAmbiguousTraceback = true;
              rank = null;
              rankSource = null;
            } else {
              const chainSt = chainLookup.st;
              const closedSnap = chainSt?.chainSnapshot ?? null;
              if (
                chainSt !== null &&
                (chainSt.chainState === "awaiting-marker" || chainSt.chainState === "awaiting-traceback") &&
                closedSnap !== null &&
                (rank === null || closedSnap.rank === null || rank === closedSnap.rank) &&
                (!hasHeaderPid || pid === null || closedSnap.pid === null || pid === closedSnap.pid) &&
                (timestamp === null || (closedSnap.ts !== null && timestamp === closedSnap.ts)) &&
                isChainBanner &&
                areCausalDomainsCompatible(
                  { hostTag, instanceTag, groupTag },
                  {
                    hostTag: closedSnap.hostTag,
                    instanceTag: closedSnap.instanceTag,
                    groupTag: closedSnap.groupTag,
                  },
                )
              ) {
                if (rank === null) {
                  rank = closedSnap.rank;
                  rankSource = closedSnap.rankSource;
                }
                if (hostTag === null) hostTag = closedSnap.hostTag;
                if (instanceTag === null) instanceTag = closedSnap.instanceTag;
                if (groupTag === null) groupTag = closedSnap.groupTag;
                if (pid === null || !hasHeaderPid) pid = closedSnap.pid;
                effectiveTimestamp = closedSnap.ts;
                effectiveTimestampMs = closedSnap.tsMs;
                effectiveTimestampSubMs = closedSnap.tsSubMs;
                effectiveTimestampKind = closedSnap.tsKind;
                effectiveHasExplicitTimezone = closedSnap.hasTz;
                effectiveInferredYearMatched = closedSnap.inferredYearMatched;
                lineTracebackGroupId = closedSnap.groupId;
                if (ambiguousTbKeys.has(chainSt.key)) lineAmbiguousTraceback = true;
                chainSt.chainState = "awaiting-traceback";
                touchTbState(chainSt);
                lastFocusedTbKey = chainSt.key;
              } else {
                if (!isTracebackSyntaxLine) {
                  pendingAmbiguousChainReset = false;
                }
                if (chainSt !== null) {
                  resetTbState(chainSt, false);
                }
              }
            }
          }
        }
      }
    }

    parsed.push({
      lineNumber,
      segmentId: currentSegmentId,
      rawLine,
      inspectLine,
      trimmed,
      rank,
      rankSource,
      hostTag,
      instanceTag,
      groupTag,
      pid,
      timestamp: effectiveTimestamp,
      timestampMs: effectiveTimestampMs,
      timestampSubMs: effectiveTimestampSubMs,
      timestampKind: effectiveTimestampKind,
      hasExplicitTimezone: effectiveHasExplicitTimezone,
      inferredYearMatched: effectiveInferredYearMatched,
      tracebackGroupId: lineTracebackGroupId,
      ...(lineAmbiguousTraceback ? { ambiguousTraceback: true } : {}),
      ...(meta.isPromLine ? { isPromLine: true } : {}),
    });
  }

  return { lines: parsed, ambiguousDomainPids };
}

const PROM_TIMESTAMP_TOKEN_RE = /^[+-]?\d{1,19}$/;
const PROM_COMMENT_HEADER_RE = /^\s*#\s*(?:HELP|TYPE)\s+[a-zA-Z_:][a-zA-Z0-9_:]*(?:\s|$)/i;
const PROM_EXPORTER_LABEL_KEYS = new Set([
  "instance",
  "exported_instance",
  "pod",
  "pod_name",
  "node",
  "node_name",
  "host",
  "hostname",
  "namespace",
  "cluster",
  "container",
  "service",
  "worker",
  "rank",
  "rank_id",
  "device",
  "job",
  "endpoint",
  "target",
  "http_target",
  "pid",
]);

interface ParsedPromSample {
  metricName: string;
  labelStr: string;
  rawVal: number;
}

function isPromMetricNameChar(code: number, isFirst: boolean): boolean {
  return (
    (code >= 65 && code <= 90) || // A-Z
    (code >= 97 && code <= 122) || // a-z
    code === 95 || // _
    code === 58 || // :
    (!isFirst && code >= 48 && code <= 57) // 0-9
  );
}

function isValidPromValueSlice(s: string, start: number, end: number): boolean {
  const len = end - start;
  if (len <= 0) return false;
  if (len === 3) {
    const a = s.charCodeAt(start);
    const b = s.charCodeAt(start + 1);
    const c = s.charCodeAt(start + 2);
    if ((a === 78 || a === 110) && (b === 65 || b === 97) && (c === 78 || c === 110)) return true;
    if ((a === 73 || a === 105) && (b === 78 || b === 110) && (c === 70 || c === 102)) return true;
  }
  let p = start;
  const first = s.charCodeAt(p);
  if (first === 43 || first === 45) {
    p += 1;
    if (p >= end) return false;
    if (end - p === 3) {
      const a = s.charCodeAt(p);
      const b = s.charCodeAt(p + 1);
      const c = s.charCodeAt(p + 2);
      if ((a === 73 || a === 105) && (b === 78 || b === 110) && (c === 70 || c === 102)) return true;
    }
  }
  let intDigits = 0;
  while (p < end && s.charCodeAt(p) >= 48 && s.charCodeAt(p) <= 57) {
    intDigits += 1;
    p += 1;
  }
  let fracDigits = 0;
  if (p < end && s.charCodeAt(p) === 46) {
    p += 1;
    while (p < end && s.charCodeAt(p) >= 48 && s.charCodeAt(p) <= 57) {
      fracDigits += 1;
      p += 1;
    }
  }
  if (intDigits === 0 && fracDigits === 0) return false;
  if (p < end && (s.charCodeAt(p) === 69 || s.charCodeAt(p) === 101)) {
    p += 1;
    if (p < end && (s.charCodeAt(p) === 43 || s.charCodeAt(p) === 45)) p += 1;
    let expDigits = 0;
    while (p < end && s.charCodeAt(p) >= 48 && s.charCodeAt(p) <= 57) {
      expDigits += 1;
      p += 1;
    }
    if (expDigits === 0) return false;
  }
  return p === end;
}

function parsePromMetricSampleLine(trimmed: string): ParsedPromSample | null {
  if (!trimmed || trimmed.startsWith("#")) return null;
  const len = trimmed.length;
  let pos = 0;
  while (pos < len && isPromMetricNameChar(trimmed.charCodeAt(pos), pos === 0)) {
    pos += 1;
  }
  if (pos === 0 || pos >= len || trimmed.charCodeAt(pos - 1) === 58 /* : */) return null;
  const metricName = trimmed.slice(0, pos);
  let labelStr = "";
  if (trimmed.charCodeAt(pos) === 123 /* { */) {
    pos += 1;
    const labelStart = pos;
    let inQuote = false;
    let escaped = false;
    let closeIdx = -1;
    while (pos < len) {
      const ch = trimmed.charCodeAt(pos);
      if (escaped) {
        escaped = false;
      } else if (ch === 92 /* \ */ && inQuote) {
        escaped = true;
      } else if (ch === 34 /* " */) {
        inQuote = !inQuote;
      } else if (ch === 125 /* } */ && !inQuote) {
        closeIdx = pos;
        break;
      }
      pos += 1;
    }
    if (closeIdx < 0) return null;
    labelStr = trimmed.slice(labelStart, closeIdx);
    pos = closeIdx + 1;
  }
  const wsStart = pos;
  while (pos < len && (trimmed.charCodeAt(pos) === 32 || trimmed.charCodeAt(pos) === 9)) {
    pos += 1;
  }
  if (pos === wsStart || pos >= len) return null;
  let valEnd = pos;
  while (valEnd < len && trimmed.charCodeAt(valEnd) !== 32 && trimmed.charCodeAt(valEnd) !== 9) {
    valEnd += 1;
  }
  if (!isValidPromValueSlice(trimmed, pos, valEnd)) return null;
  const valStr = trimmed.slice(pos, valEnd);
  let tsStart = valEnd;
  while (tsStart < len && (trimmed.charCodeAt(tsStart) === 32 || trimmed.charCodeAt(tsStart) === 9)) {
    tsStart += 1;
  }
  if (tsStart < len) {
    if (tsStart === valEnd) return null;
    let tsEnd = len;
    while (tsEnd > tsStart && (trimmed.charCodeAt(tsEnd - 1) === 32 || trimmed.charCodeAt(tsEnd - 1) === 9)) {
      tsEnd -= 1;
    }
    if (tsEnd <= tsStart || tsEnd - tsStart > 32) return null;
    const tsStr = trimmed.slice(tsStart, tsEnd);
    if (!PROM_TIMESTAMP_TOKEN_RE.test(tsStr)) return null;
  }
  const rawVal = Number(valStr);
  return { metricName, labelStr, rawVal };
}

function isPromExpositionLine(trimmed: string, hasPromSample = false): boolean {
  return (
    PROM_COMMENT_HEADER_RE.test(trimmed) ||
    (hasPromSample && trimmed.startsWith("#")) ||
    parsePromMetricSampleLine(trimmed) !== null
  );
}

const DIAGNOSTIC_VLLM_METRIC_NAMES = new Set([
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

function extractPromScopeLabels(labelStr: string): {
  engine: string | null;
  modelName: string | null;
  exporterKey: string;
  exporterParts: string[];
  isSummaryOrBucket: boolean;
} {
  let engine: string | null = null;
  let modelName: string | null = null;
  let isSummaryOrBucket = false;
  const exporterPairs: Array<[string, string]> = [];
  if (!labelStr) {
    return { engine, modelName, exporterKey: "[]", exporterParts: [], isSummaryOrBucket };
  }
  let pos = 0;
  const len = labelStr.length;
  while (pos < len) {
    while (pos < len && (labelStr.charCodeAt(pos) === 44 || labelStr.charCodeAt(pos) <= 32)) pos += 1;
    if (pos >= len) break;
    const eqIdx = labelStr.indexOf("=", pos);
    if (eqIdx < 0) break;
    const key = labelStr.slice(pos, eqIdx).trim();
    pos = eqIdx + 1;
    while (pos < len && labelStr.charCodeAt(pos) <= 32) pos += 1;
    let val = "";
    if (pos < len && labelStr.charCodeAt(pos) === 34) {
      pos += 1;
      const valStart = pos;
      let escaped = false;
      while (pos < len) {
        const ch = labelStr.charCodeAt(pos);
        if (escaped) escaped = false;
        else if (ch === 92) escaped = true;
        else if (ch === 34) break;
        pos += 1;
      }
      val = labelStr.slice(valStart, pos);
      if (pos < len && labelStr.charCodeAt(pos) === 34) pos += 1;
    } else {
      const commaIdx = labelStr.indexOf(",", pos);
      val = (commaIdx < 0 ? labelStr.slice(pos) : labelStr.slice(pos, commaIdx)).trim();
      pos = commaIdx < 0 ? len : commaIdx;
    }
    if (key === "engine") engine = val;
    else if (key === "model_name") modelName = val;
    else if (key === "quantile" || key === "le") isSummaryOrBucket = true;
    else if (PROM_EXPORTER_LABEL_KEYS.has(key)) {
      exporterPairs.push([key, val]);
    }
  }
  exporterPairs.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  const exporterParts = exporterPairs.map(([k, v]) => `${k}=${v}`);
  return {
    engine,
    modelName,
    exporterKey: JSON.stringify(exporterPairs),
    exporterParts,
    isSummaryOrBucket,
  };
}

interface ParsedMetricScope {
  scopeKey: string;
  modelName: string | null;
  engine: string | null;
  exporterParts: readonly string[];
  snapshot: ParsedMetricsSnapshot;
  lineNumbers: Set<number>;
}

interface MetricAccumulator {
  modelName: string | null;
  engine: string | null;
  exporterParts: readonly string[];
  sums: Map<string, number>;
  counts: Map<string, number>;
  rawMetricCount: number;
  lineNumbers: Set<number>;
}

function createMetricAccumulator(
  modelName: string | null,
  engine: string | null,
  exporterParts: readonly string[] = [],
): MetricAccumulator {
  return {
    modelName,
    engine,
    exporterParts,
    sums: new Map<string, number>(),
    counts: new Map<string, number>(),
    rawMetricCount: 0,
    lineNumbers: new Set<number>(),
  };
}

function finalizeMetricAccumulator(acc: MetricAccumulator): ParsedMetricsSnapshot {
  const getAvg = (name: string): number | undefined => {
    const count = acc.counts.get(name);
    if (!count) return undefined;
    return (acc.sums.get(name) ?? 0) / count;
  };
  const getSum = (name: string): number | undefined => acc.sums.get(name);

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
    hasMetrics: acc.rawMetricCount > 0,
    rawMetricCount: acc.rawMetricCount,
    kvCacheUsageRatio,
    numRequestsRunning,
    numRequestsWaiting,
    numPreemptionsTotal,
    ttftAvgSec,
    itlAvgSec,
    prefixCacheHitRate,
  };
}

function parsePrometheusMetricsAndScopes(input: string): {
  snapshot: ParsedMetricsSnapshot;
  scopes: ParsedMetricScope[];
} {
  const lines = input.split(/\r?\n/);
  const globalAcc = createMetricAccumulator(null, null);
  const scopeAccs = new Map<string, MetricAccumulator>();
  let currentLineNumber = 1;

  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i]!;
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
      continue;
    }
    const lineNumber = currentLineNumber;
    currentLineNumber += 1;

    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = parsePromMetricSampleLine(trimmed);
    if (!match) continue;
    const { metricName, labelStr, rawVal } = match;
    if (!Number.isFinite(rawVal)) continue;
    if (!metricName.startsWith("vllm:")) continue;

    const { engine, modelName, exporterKey, exporterParts, isSummaryOrBucket } =
      extractPromScopeLabels(labelStr);

    globalAcc.rawMetricCount += 1;
    if (!isSummaryOrBucket) {
      globalAcc.sums.set(metricName, (globalAcc.sums.get(metricName) ?? 0) + rawVal);
      globalAcc.counts.set(metricName, (globalAcc.counts.get(metricName) ?? 0) + 1);
    }
    globalAcc.lineNumbers.add(lineNumber);

    const scopeKey = JSON.stringify([modelName ?? "", engine ?? "", exporterKey]);
    let acc = scopeAccs.get(scopeKey);
    if (!acc) {
      acc = createMetricAccumulator(modelName, engine, exporterParts);
      scopeAccs.set(scopeKey, acc);
    }
    acc.rawMetricCount += 1;
    if (!isSummaryOrBucket) {
      acc.sums.set(metricName, (acc.sums.get(metricName) ?? 0) + rawVal);
      acc.counts.set(metricName, (acc.counts.get(metricName) ?? 0) + 1);
    }
    acc.lineNumbers.add(lineNumber);
  }

  const snapshot = finalizeMetricAccumulator(globalAcc);
  const unlabelledScopeKey = JSON.stringify(["", "", "[]"]);
  const labelledScopes = [...scopeAccs.entries()].filter(([k]) => k !== unlabelledScopeKey);
  const unlabelledAcc = scopeAccs.get(unlabelledScopeKey);

  if (labelledScopes.length === 0) {
    return {
      snapshot,
      scopes: snapshot.hasMetrics
        ? [
            {
              scopeKey: unlabelledScopeKey,
              modelName: null,
              engine: null,
              exporterParts: [],
              snapshot,
              lineNumbers: globalAcc.lineNumbers,
            },
          ]
        : [],
    };
  }

  const scopes: ParsedMetricScope[] = labelledScopes.map(([scopeKey, acc]) => ({
    scopeKey,
    modelName: acc.modelName,
    engine: acc.engine,
    exporterParts: acc.exporterParts,
    snapshot: finalizeMetricAccumulator(acc),
    lineNumbers: acc.lineNumbers,
  }));
  if (unlabelledAcc && unlabelledAcc.rawMetricCount > 0) {
    scopes.push({
      scopeKey: unlabelledScopeKey,
      modelName: null,
      engine: null,
      exporterParts: [],
      snapshot: finalizeMetricAccumulator(unlabelledAcc),
      lineNumbers: unlabelledAcc.lineNumbers,
    });
  }
  return { snapshot, scopes };
}

export function parsePrometheusMetrics(input: string): ParsedMetricsSnapshot {
  return parsePrometheusMetricsAndScopes(input).snapshot;
}

const ZERO_STATUS_CODE_RE =
  /\b(?:ret|retCode|err(?:or)?(?:_?code)?|status|errno)\s*[:=]\s*(?:0x0+\b|0\b(?!x[1-9a-f]))/i;

const NONZERO_CODE_RE =
  /\b(?:ret|retCode|err(?:or)?(?:_?code)?|status|errno)\s*[:=]\s*(?:-?[1-9]\d*|0x0*[1-9a-f][0-9a-f]*)\b/i;

const LOG_LEVEL_SETTING_RE =
  /\b(?:VLLM_LOGGING_LEVEL|LOG_LEVEL|LOGGING_LEVEL|log_?level)\s*[:=\s]\s*['"]?(?:INFO|DEBUG|WARN(?:ING)?|ERROR|CRITICAL|FATAL|OFF|DISABLED)['"]?\b/gi;

function hasLogErrorSeverity(rawLine: string): boolean {
  const masked = rawLine
    .replace(LOG_LEVEL_SETTING_RE, " ")
    .replace(/\b(?:error|err)\s*=\s*(?:0x0+\b|0\b)/gi, " ");
  return /(?<![=\w.])(?:ERROR|CRITICAL|FATAL)\b(?!\s*=)/.test(masked);
}

const NULL_OR_ZERO_EXC_VALUE_RE =
  /\b(?:[A-Z][A-Za-z0-9_]*\.)*(?:[A-Z][A-Za-z0-9_]*(?:Error|Exception)|Exception)\s*:\s*(?:none|null|nil|ok|false|0)\s*(?:$|[)\]}])/i;

const VALID_FALSEY_KEY_ERROR_RE = /\bKeyError\s*:\s*(?:0|none|false)\b/i;

function hasNullOrZeroExceptionValueOnly(rawLine: string): boolean {
  if (!NULL_OR_ZERO_EXC_VALUE_RE.test(rawLine)) return false;
  if (VALID_FALSEY_KEY_ERROR_RE.test(rawLine)) return false;
  return !hasLogErrorSeverity(rawLine);
}

const BENIGN_DOC_OR_HELP_LINE_RE =
  /\bHelp(?:\s+pattern)?\s*:|\btroubleshooting\b[^\r\n]{0,48}\b(?:Please set|set\s+\w+=)|\bto\s+enable\s+tracing\b[^\r\n]{0,40}\bVLLM_LOGGING_LEVEL\s*[:=]\s*['"]?DEBUG['"]?\b/i;

function isBenignDocumentationOrHelpLine(rawLine: string): boolean {
  if (PROM_COMMENT_HEADER_RE.test(rawLine.trim())) return true;
  if (!/(?<![.\w])(?:INFO|DEBUG)\b(?!\s*\()/i.test(rawLine)) return false;
  if (hasLogErrorSeverity(rawLine)) return false;
  return BENIGN_DOC_OR_HELP_LINE_RE.test(rawLine);
}

const BENIGN_NEGATED_CHECK_INFO_RE =
  /\b(?:no|zero|without|0)\s+(?:(?:evidence|sign|indication|trace|symptom|record|report)s?\s+(?:of\s+)?)?(?:(?:any|such|further|actual|real)\s+)?(?:(?:NPU|CUDA|CPU|device|host|memory|HBM)\s+)?(?:out\s+of\s+memory|OOM|fatal|critical|hccl|cann|runtime|hardware|vector\s+core|ai\s*core|aicore|aicpu|smmu)(?:\s+(?:errors?|faults?|failures?|exceptions?|issues?|alarms?|warnings?))?(?:\s+(?:detected|found|observed|occurred|reported|remaining))?\b|\b(?:(?:(?:NPU|CUDA|CPU|device|host|memory|HBM)\s+)?(?:out\s+of\s+memory|OutOfMemoryError|OOM)|(?:vector\s+core|ai\s*core|aicore|aicpu|smmu)\s+(?:exception|fault|error|timeout))\b(?:\s*[:=-]\s*(?:(?:0(?!\s*(?:GiB|MiB|GB|MB|KB|B|bytes|tokens|blocks|pages|devices|ranks)\b)|false|none|null|nil|no|ok|absent|healthy|normal|cleared|resolved|pass(?:ed)?|negative|not\s+present|ruled\s+out|excluded)\b|(?:(?:was|is|are|were)\s+)?(?:not\s+(?:detected|found|observed|seen|triggered|present|occurred|reported|reproduced)|ruled\s+out|excluded)|0\s+(?:errors?|events?|occurrences?|failures?|faults?)\b)|\s+[^;.,\r\n]{0,32}?\b(?:(?:was|is|are|were)\s+(?:0|false|none|null|nil|no|ok|absent|healthy|normal|cleared|resolved|ruled\s+out|excluded)\b|(?:(?:was|is|are|were)\s+)?(?:not\s+(?:detected|found|observed|seen|triggered|present|occurred|reported|reproduced)|ruled\s+out|excluded)|cleared|resolved|pass(?:ed)?|0\s+(?:errors?|events?|failures?|faults?))\b)/gi;

function stripBenignNegatedClauses(rawLine: string): string {
  BENIGN_NEGATED_CHECK_INFO_RE.lastIndex = 0;
  return rawLine.replace(BENIGN_NEGATED_CHECK_INFO_RE, " ");
}

function isBenignNegatedCheckInfoLine(rawLine: string): boolean {
  if (hasLogErrorSeverity(rawLine) || hasGenuinePythonException(rawLine)) return false;
  const hasInfoOrBoolNegation =
    /(?<![.\w])(?:INFO|DEBUG)\b(?!\s*\()/i.test(rawLine) ||
    /\b(?:no|zero|without)\s+(?:(?:evidence|sign|indication|trace|symptom|record|report)s?\s+(?:of\s+)?)?(?:(?:any|such|further|actual|real)\s+)?(?:(?:NPU|CUDA|CPU|device|host|memory|HBM)\s+)?(?:out\s+of\s+memory|OutOfMemoryError|OOM)\b|\b(?:out\s+of\s+memory|OutOfMemoryError|OOM)\s*(?:[:=-]|\s+(?:is|are|was|were)\b)\s*(?:0|false|none|null|nil|no|ok|absent|healthy|normal|cleared|resolved|not\s+present|ruled\s+out|excluded|not\s+(?:detected|found|observed|seen|triggered|occurred|reported|reproduced))\b/i.test(
      rawLine,
    );
  if (!hasInfoOrBoolNegation) return false;
  const stripped = stripBenignNegatedClauses(rawLine);
  if (stripped === rawLine) return false;
  return isBenignInfoOrDebugInitLine(stripped);
}

const NON_SEVERITY_EXPLICIT_FAILURE_TOKEN_RE =
  /\b(?:FAIL(?:ED)?|Timeout(?:Error)?|timed?\s+out|times?\s+out|\btimeout\b(?!\s*[:=]\s*\d)|RuntimeError|ValueError|AssertionError|NotImplementedError|KeyError|TypeError|NameError|ImportError|JSONDecodeError|BackendCompilerFailed|Unsupported|Exception|Traceback|OutOfMemoryError|NPU\s+out\s+of\s+memory|is\s+less\s+than\s+desired|OOM|OOMKilled|CheckSmmuFault(?!:[^\r\n]{0,160}isSmmuFault\s+is\s+0\b)|SMMU\s+fault|EADDRNOTAVAIL|EADDRINUSE|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOENT|EACCES|EI000[2469]|EJ0001|EJ0003|EE\d{4}|EZ\d{4}|ERR03005|EL\d{4}|EH\d{4}|E19999|ACL_ERROR_[A-Z0-9_]+|ACLNN_ERR_[A-Z0-9_]+|AclNN_Parameter_Error|HCCL_E_[A-Z0-9_]+|Cannot assign requested address|Address already in use|No route to host|Network is unreachable|Connection refused|Connection\s+reset(?:\s+by\s+peer)?|Permission denied|cannot open|does not exist|not\s+exist|no\s+such\s+device|not found|corrupt|invalid|mismatch|not supported|unsupported|too SMALL|is not initialized|is required|cannot be used|supports at most|exceeds|out of bounds|graph break|fallback|no\s+valid\s+nic|link\s+down|port\s+down|link\s+disconnected|Not all shards|Could not determine quantization|doesn't support|ibv_post_send\s+failed|AdxDataDumpServer)\b|\berrno\s*(?:[:=]|\s)\s*111\b|\bterminated\s+by\s+signal\s+(?:SIGKILL|SIGSEGV)\b|\bexit\s*code\s*[:=\s]+(?:137|139|-9|-11)\b|\bHCCL\s+error:\s*[1-9]\d*\b|(?:error(?:\s+code)?(?:\s+is)?|err(?:Code)?|ret(?:Code)?|status)\s*[:=#(]?\s*(?:161001|161002|561002|561103|507014|507015|507018|507034|507035|107005|107024|107025|107030|207003)\b/i;

const BENIGN_COMPLETION_RE = /\b(?:success(?:fully)?|completed|finished|initialized|ready|loaded)\b/i;

const ZERO_EI_COUNTER_RE =
  /\b(?:EI000[2469]|EJ0001)\b[^\r\n]{0,32}\b(?:count|cnt|total|num|hits)\s*[:=]\s*0\b|\b(?:EI000[2469]|EJ0001)(?:_(?:count|cnt|total|num))?\s*[:=]\s*0\b/i;

const NONZERO_EI_COUNTER_RE =
  /\b(?:EI000[2469]|EJ0001)\b[^\r\n]{0,32}\b(?:count|cnt|total|num|hits)\s*[:=]\s*[1-9]\d*\b|\b(?:EI000[2469]|EJ0001)(?:_(?:count|cnt|total|num))?\s*[:=]\s*[1-9]\d*\b/i;

const PYTHON_EXC_IN_LINE_RE =
  /\bKeyError\s*:\s*(?:None|0|False)\b|(?<![A-Za-z0-9_])(?:[A-Z][A-Za-z0-9_]*\.)*(?:[A-Z][A-Za-z0-9_]*(?:Error|Exception)|Exception)\s*:(?!\s*(?:none|null|nil|ok|false)\b)/;

function hasGenuinePythonException(rawLine: string): boolean {
  if (!PYTHON_EXC_IN_LINE_RE.test(rawLine)) return false;
  if (hasNullOrZeroExceptionValueOnly(rawLine)) return false;
  return true;
}

function hasBenignZeroCounterOnly(rawLine: string): boolean {
  if (NONZERO_CODE_RE.test(rawLine) || NONZERO_EI_COUNTER_RE.test(rawLine)) return false;
  if (!ZERO_EI_COUNTER_RE.test(rawLine)) return false;
  if (hasLogErrorSeverity(rawLine) || hasGenuinePythonException(rawLine)) return false;
  return !/\b(?:FAIL(?:ED)?|RuntimeError|ValueError|AssertionError|TimeoutError|timed?\s+out|times?\s+out|Getting socket times out|\[Wait\]\[LinkEstablish\]|Notify wait execute timeout|The wait execution of the Notify|ranktable|transport init|HCCP init)\b/i.test(
    rawLine,
  );
}

function hasBenignZeroStatusOnly(rawLine: string): boolean {
  if (!ZERO_STATUS_CODE_RE.test(rawLine)) return false;
  if (NONZERO_CODE_RE.test(rawLine)) return false;
  if (hasLogErrorSeverity(rawLine) || hasGenuinePythonException(rawLine)) return false;
  return !/\b(?:FAIL(?:ED)?|CheckSmmuFault|EADDRNOTAVAIL|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED|EI000[2469]|EJ0001|EJ0003|EE\d{4}|EZ\d{4}|ERR03005|EL\d{4}|EH\d{4}|E19999|ACL_ERROR_[A-Z0-9_]+|HCCL_E_[A-Z0-9_]+|timed?\s+out|times?\s+out|out of memory)\b/i.test(
    rawLine,
  );
}

function isBenignInfoOrDebugInitLine(rawLine: string): boolean {
  const effective = stripBenignNegatedClauses(rawLine);
  if (hasBenignZeroStatusOnly(effective) || hasBenignZeroCounterOnly(effective)) return true;
  if (isBenignDocumentationOrHelpLine(effective)) return true;
  if (!/(?<![.\w])(?:INFO|DEBUG)\b(?!\s*\()/i.test(effective)) return false;
  if (NONZERO_CODE_RE.test(effective)) return false;
  if (hasLogErrorSeverity(effective)) return false;
  if (hasGenuinePythonException(effective)) return false;
  if (hasNullOrZeroExceptionValueOnly(effective)) return true;
  const masked = effective.replace(LOG_LEVEL_SETTING_RE, " ");
  if (
    /\b(?:FAIL(?:ED)?|TimeoutError|BackendCompilerFailed|Unsupported|OutOfMemoryError(?!\s*:\s*(?:none|null|nil|ok|false|0)\b)|timed?\s+out|times?\s+out|\btimeout\b(?!\s*[:=]\s*\d+\s*(?:ms|s|sec|seconds|min)\b)|out of memory|ACL_ERROR_[A-Z0-9_]+|ACLNN_ERR_[A-Z0-9_]+|EE\d{4}|EZ\d{4}|ERR03005|EL\d{4}|EH\d{4}|E19999|EI000[2469]|EJ0001|EJ0003|EADDRNOTAVAIL|EADDRINUSE|ENETUNREACH|EHOSTUNREACH|ECONNREFUSED|No route to host|Network is unreachable|Connection refused|Connection reset by peer|Cannot assign requested address|Address already in use|HCCL_BUFFSIZE is too SMALL|CheckSmmuFault(?!:[^\r\n]{0,160}isSmmuFault\s+is\s+0\b)|isSmmuFault\s+is\s+[1-9]|link\s+down|port\s+down|link\s+disconnected|not found|does not exist|not\s+exist|no\s+such\s+device|Permission denied|cannot open|invalid|mismatch|not supported|unsupported|is not initialized|is required|cannot be used|supports at most|exceeds|out of bounds|\[Wait\]\[LinkEstablish\]|ibv_post_send|AdxDataDumpServer)\b|\bHCCL\s+error:\s*[1-9]\d*\b/i.test(
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

function hasFailureSemantics(rawLine: string): boolean {
  if (isPromExpositionLine(rawLine.trim())) return false;
  const effective = stripBenignNegatedClauses(rawLine);
  if (hasBenignZeroStatusOnly(effective) || hasBenignZeroCounterOnly(effective)) return false;
  if (hasNullOrZeroExceptionValueOnly(effective)) return false;
  if (isBenignInfoOrDebugInitLine(effective)) return false;
  if (NONZERO_CODE_RE.test(effective)) return true;
  if (hasLogErrorSeverity(effective)) return true;
  if (hasGenuinePythonException(effective)) return true;
  const masked = effective.replace(LOG_LEVEL_SETTING_RE, " ");
  if (NON_SEVERITY_EXPLICIT_FAILURE_TOKEN_RE.test(masked)) return true;
  if (
    /\b(?:link|port)[^\r\n]{0,24}\bdown\b|\blink_status\s*[:=]\s*DOWN\b|\bdisconnected\b|\bbroken\b/i.test(
      masked,
    )
  ) {
    return true;
  }
  if (/\b(?:fail(?:s|ed|ure)?|err(?:or)?|does not match|does not support)\b/i.test(masked)) {
    return !BENIGN_COMPLETION_RE.test(masked);
  }
  return false;
}

const BENIGN_HCCL_TIMEOUT_CONFIG_RE =
  /timeout interval of the HCCL operator|VLLM_EXECUTE_MODEL_TIMEOUT_SECONDS|HCCL_EXEC_TIMEOUT\s*=|\btimeout\s*=\s*\d+\s*(?:ms|s|sec|seconds|min)\b/i;

const DISTRIBUTED_COMM_CONTEXT_RE =
  /\b(?:HCCL|RaSocket\w*|HCCP|hccn_tool|Gloo|c10d|ProcessGroup\w*|TCPStore\w*|hcclCommInit\w*|ranktable|EI000[469]|EJ000[13]|HCCL_SOCKET_IFNAME|GLOO_SOCKET_IFNAME|HCCL_IF_IP|TP_SOCKET_IFNAME|torch\.distributed|init_process_group|LinkEstablish)\b/i;

const HCCL_EXEC_WAIT_QUALIFIER_RE =
  /Notify wait|The wait execution of the Notify|HCCL_E_(?:WAIT_)?TIMEOUT|HCCL\s+error:\s*9\b|monitoredBarrier|Watchdog|AllReduce|AllGather|ReduceScatter|AllToAll|collective|HCCL timeout/i;

const HCCL_LINK_ESTABLISH_TIMEOUT_RE =
  /\bEI0006\b[^\r\n]{0,256}(?:Getting socket times out|\[Wait\]\[LinkEstablish\]|link\s*establish|socket\s+(?:connect|times?\s+out|timeout))|\[Wait\]\[LinkEstablish\][^\r\n]{0,256}(?:times?\s*out|timeout)|Getting socket times out[^\r\n]{0,256}(?:HCCL|LinkEstablish|EI0006|rank|socket)|\bRaSocket\w*\b[^\r\n]{0,256}(?:timed?\s+out|timeout|ETIMEDOUT)/i;

const EXPLICIT_HCCL_WAIT_TIMEOUT_RE =
  /\bEI0006\b|\bEI0002\b|\bHCCL_E_(?:WAIT_)?TIMEOUT\b|\bHCCL\s+error:\s*9\b|Notify wait execute timeout|The wait execution of the Notify register times out|Watchdog caught collective operation timeout|\bfailed\s+to\s+pass\s+monitoredBarrier\b|\bmonitoredBarrier\b[^\r\n]{0,96}\b(?:fail(?:ed)?|timeout|timed?\s+out)\b|\bp2p\s+timeout\b/i;

const HCCL_CONTEXT_TIMEOUT_FAULT_RE =
  /(?:AllReduce|AllGather|ReduceScatter|AllToAll)\b[^\r\n]{0,40}\b(?:timeout|timed?\s+out)\b(?!\s*[:=]\s*\d)|\bHCCL\b[^\r\n]{0,36}\b(?:wait\s+timeout|execute\s+timeout|collective[^\r\n]{0,20}timeout|timed?\s+out|(?:error|failed)[^\r\n]{0,20}timeout)\b(?!\s*[:=]\s*\d)|\b(?:ERROR|CRITICAL|FATAL|RuntimeError|TimeoutError)\b[^\r\n]{0,48}\bHCCL\b[^\r\n]{0,24}\btimeout\b(?!\s*[:=]\s*\d)/i;

function hasExplicitTimeoutSeverity(rawLine: string): boolean {
  return hasLogErrorSeverity(rawLine) || /\b(?:RuntimeError|TimeoutError)\b/.test(rawLine);
}

function stripLogIdFieldsForErrorCodes(text: string): string {
  return text
    .replace(
      /\b(?:pid|port|line|global_rank|local_rank|rank|device_id|device|step|tokens)\s*[:=#]?\s*\d+\b/gi,
      " ",
    )
    .replace(/\b(?:RUNTIME|HCCL|ASCENDCL|GE|DRV)\(\d+,/gi, " ")
    .replace(/\[[^\]\r\n]{0,128}:\d+\]/g, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}[T -]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?/g, " ")
    .replace(/\b\d{2}:\d{2}:\d{2}(?:[.,]\d+)?/g, " ");
}

const HCCL_RANKTABLE_INIT_RE = /\bEI0004\b(?![^\r\n]{0,128}Notify wait)|\bEI0009\b|\bEJ0001\b/i;

const PEER_REFUSED_SIGNAL_RE =
  /\bECONNREFUSED\b|\bECONNRESET\b|Connection refused|Connection\s+reset(?:\s+by\s+peer)?|\berrno\s*(?:[:=]|\s)\s*111\b/i;

function isPeerRefusedCascadeLine(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  if (!hasFailureSemantics(inspect)) return false;
  if (/\bConnection\s+reset\s*[:=]\s*0\b/i.test(inspect)) return false;
  if (!PEER_REFUSED_SIGNAL_RE.test(inspect)) return false;
  if (
    /\b(?:metrics(?:\s+server)?|prometheus|scrape|uvicorn|fastapi|openai|redis|memcached|mysql|postgres(?:ql)?|mongodb|kafka|etcd|zookeeper|elasticsearch|minio|s3|huggingface|hf_hub)\b/i.test(
      inspect,
    ) &&
    !DISTRIBUTED_COMM_CONTEXT_RE.test(inspect)
  ) {
    return false;
  }
  if (DISTRIBUTED_COMM_CONTEXT_RE.test(inspect)) return true;
  const body = stripTracebackLogPrefix(inspect);
  return (
    /\b(?:peer[\s_]*rank|remote[\s_]*rank)\b/i.test(body) ||
    (/\b(?:peer|remote|master(?:_addr|_port)?|ranktable|rdma|roce|mooncake|kv_transfer)\b/i.test(body) &&
      /\b(?:rank\s*[:=#]?\s*\d+|socket|connect(?:ing)?\s+to|port)\b/i.test(body))
  );
}

function isExplicitHcclBindFaultLine(rawLine: string): boolean {
  const hasExplicitBind =
    /RaSocketBind|no\s+valid\s+nic|cannot\s+find\s+(?:net|nic|interface)[^\r\n]{0,128}HCCL_SOCKET_IFNAME|\bEJ0003\b/i.test(
      rawLine,
    ) ||
    (/Cannot assign requested address|EADDRNOTAVAIL|\bbind\s*fail(?:ed)?\b/i.test(rawLine) &&
      DISTRIBUTED_COMM_CONTEXT_RE.test(rawLine));
  if (hasExplicitBind) return true;
  if (isPeerRefusedCascadeLine(rawLine) || PEER_REFUSED_SIGNAL_RE.test(rawLine)) {
    return false;
  }
  if (
    /\b(?:EI0002|EI0006|HCCL_E_(?:WAIT_)?TIMEOUT)\b|HCCL\s+error:\s*9\b|Notify wait|Getting socket times out|Watchdog|monitoredBarrier|AllReduce|AllGather|ReduceScatter|AllToAll|collective|\btimed?\s+out\b|\btimes?\s+out\b|\btimeout\b|\bETIMEDOUT\b/i.test(
      rawLine,
    )
  ) {
    return false;
  }
  const sanitizedSeverity = rawLine.replace(
    /\b(?:INFO|DEBUG|WARN(?:ING)?|ERROR|CRITICAL|FATAL)\b(?!\s*=)/g,
    " ",
  );
  const ifnameAnchor = /\b(?:HCCL_SOCKET_IFNAME|HCCL_IF_IP|GLOO_SOCKET_IFNAME|TP_SOCKET_IFNAME)\b/i.exec(
    sanitizedSeverity,
  );
  if (!ifnameAnchor) return false;
  return /\bbind\s+fail|\bfail(?:ed)?\b|\berror\b(?!\s*=\s*0\b)|\binvalid\b|\bnot\s+found\b|\bdoes\s+not\s+exist\b|\bnot\s+exist\b|\bno\s+such\s+device\b|\bno\s+(?:valid|available)\s+(?:ip|nic|interface)\b|\bcannot\s+assign\b|\bno\s+route\b|\bmismatch\b/i.test(
    sanitizedSeverity.slice(ifnameAnchor.index + ifnameAnchor[0].length),
  );
}

const HCCL_RASOCKET_BIND_OR_ROUTE_RE =
  /\bRaSocket\w*\b[^\r\n]{0,256}(?:\bfail(?:ed)?\b|\btimeout\b|\btimed?\s+out\b|\bunable\b|\berror\b(?!\s*=\s*0\b)|\bEADDRNOTAVAIL\b|\bENETUNREACH\b|\bEHOSTUNREACH\b|\bETIMEDOUT\b|Cannot assign requested address|No route to host|Network is unreachable|\binvalid\b)|\b(?:HCCL|HCCP|RoCE)\b[^\r\n]{0,64}\bRDMA\b[^\r\n]{0,64}\b(?:register\s+failed|init\s+failed|failed|error(?!\s*=\s*0\b))|no\s+valid\s+nic|cannot\s+find\s+(?:net|nic|interface)[^\r\n]{0,128}HCCL_SOCKET_IFNAME/i;

const HCCL_DISTRIBUTED_NET_FAULT_RE =
  /\b(?:bind|connect|socket|listen)\b[^\r\n]{0,256}(?:Cannot assign requested address|No route to host|Network is unreachable|EADDRNOTAVAIL|ENETUNREACH|EHOSTUNREACH)|\b(?:Cannot assign requested address|No route to host|Network is unreachable|EADDRNOTAVAIL|ENETUNREACH|EHOSTUNREACH)\b/i;

const HCCL_ROCE_PORT_DOWN_FAST_RE =
  /\bhccn_tool\b[^\r\n]{0,128}(?:link\s+status\s*[:=]\s*DOWN|port[^\r\n]{0,64}down)|\bRoCE\b[^\r\n]{0,128}(?:link\s+down|port\s+down|link\s+disconnected)/i;

const HCCL_ROCE_PORT_DOWN_RE = {
  test(s: string): boolean {
    if (HCCL_ROCE_PORT_DOWN_FAST_RE.test(s)) return true;
    const roceMatch = /\bRoCE\b/i.exec(s);
    if (!roceMatch) return false;
    const afterRoce = s.slice(roceMatch.index + roceMatch[0].length);
    if (/\b(?:link\s+down|port\s+down|link\s+disconnected)\b/i.test(afterRoce)) return true;
    const midMatch = /\b(?:link|port)\b/i.exec(afterRoce);
    if (!midMatch) return false;
    return /\bdown\b/i.test(afterRoce.slice(midMatch.index + midMatch[0].length));
  },
};

const EXPLICIT_ACLNN_OPAPI_IN_COMPILE_RE =
  /\baclnn\w*\b|\bACLNN_ERR_[A-Z0-9_]+|\bAclNN_Parameter_Error|(?:error(?:\s+code)?(?:\s+is)?|err(?:Code)?|ret(?:Code)?|code|status)\s*[:=#(]?\s*(?:161001|161002|561002|561103)\b|\b(?:161001|161002|561002|561103)\b/i;

const NON_ASCEND_COMPILER_BACKEND_RE =
  /\bbackend\s*=\s*['"]?(?:inductor|cudagraphs|aot_eager|eager|onnxrt|tvm)['"]?|\b(?:torch\._inductor|torch\.compile\b[^\r\n]{0,96}inductor|\bgcc\b|\bg\+\+|\bnvcc\b|\btriton\b|\bCUDA\b|\bcuBLAS\b|\bcuDNN\b|\bHIP\b|\bROCm\b)/i;

const TORCHAIR_EXPLICIT_GRAPH_CONTEXT_RE =
  /\b(?:torchair|npugraph_ex|npu_graph|ge::|vllm_ascend|ascend|NPU|CANN|OPP|OP_HOST|GE\(|EZ300[23]|CheckMlaAttrs)\b|\bGE\s+(?:compile|graph\s+compile|build)\b/i;

const TORCHAIR_STRICT_COMPILE_TOKEN_RE =
  /\b(?:EZ300[23]|ERR03005|coreNum is 0,\s*tiling failed|CheckMlaAttrs|Static kernel generation requires npugraph_ex|External DP static compilation|Static compilation requires)\b|There was no fake impl registered for/i;

const TORCHAIR_GE_GENERIC_DYNAMO_RE =
  /\b(?:BackendCompilerFailed|torch\._dynamo\.exc\.Unsupported)\b|fullgraph=True[^\r\n]{0,160}(?:graph break|Unsupported|fail(?:ed)?|error)/i;

const TORCHAIR_GE_COMPILE_BASE_RE =
  /\b(?:BackendCompilerFailed|torch\._dynamo\.exc\.Unsupported)\b|There was no fake impl registered for\b|Static kernel generation requires npugraph_ex to be enabled|External DP static compilation requires the full DP worker world|Static compilation requires worker world size divisible by node count|\b(?:EZ3002|EZ3003|ERR03005)\b|torch\.ops\.air\.scope_enter[^\r\n]{0,160}\b(?:scope_exit|unpaired|mismatch|fail|error)|\bcoreNum is 0,\s*tiling failed\b|\bCheckMlaAttrs\b[^\r\n]{0,256}(?:fail(?:ed)?|error(?!\s*=\s*0\b)|invalid|unsupported|not\s+support|EZ\d{4}|E19999|retCode\s*[:=]\s*(?:-?[1-9]\d*|0x0*[1-9a-f][0-9a-f]*))|\bnpugraph_ex\b[^\r\n]{0,256}(?:compile\s+fail(?:ed)?|graph\s+break|backend\s+fail(?:ed)?|RuntimeError|ValueError|ImportError|AssertionError|fail(?:ed)?|error(?!\s*=\s*0\b))|\btorchair\b[^\r\n]{0,256}(?:(?:compile|ge|fx|graph|backend)\s+fail(?:ed)?|graph\s+break|fallback\s+fail(?:ed)?|RuntimeError|BackendCompilerFailed|fail(?:ed)?|error(?!\s*=\s*0\b))|fullgraph=True[^\r\n]{0,160}(?:graph break|Unsupported|fail(?:ed)?|error)|\b(?:EZ9999|E19999)\b[^\r\n]{0,256}(?:compile|tiling|CheckMlaAttrs|shape|infer|op\s*select|graph\s+compil|compile\s+graph|npugraph|torchair|ge::|OPP)|(?:tiling\s+failed|host\s+tiling\s+failed|infer\s*shape\s+failed|ge\s+compile\s+failed)\b/i;

const TORCHAIR_GE_COMPILE_FAULT_RE = {
  test(s: string): boolean {
    if (TORCHAIR_GE_COMPILE_BASE_RE.test(s)) return true;
    const geAnchor = /\bGE\s+(?:compile|graph\s+compile|build)\b/i.exec(s);
    if (!geAnchor) return false;
    return /fail(?:ed)?|error(?!\s*=\s*0\b)|\bEZ\d{4}\b|\bE19999\b|retCode\s*[:=]\s*(?:-?[1-9]\d*|0x0*[1-9a-f][0-9a-f]*)/i.test(
      s.slice(geAnchor.index + geAnchor[0].length),
    );
  },
};

function isTorchairGeCompileFaultLine(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  if (!hasFailureSemantics(inspect)) return false;
  if (isAdvisoryGraphCapabilityWarning(inspect)) return false;
  if (/HCCL_BUFFSIZE is too SMALL|worldSize is invalid/i.test(inspect)) return false;
  if (EXPLICIT_ACLNN_OPAPI_IN_COMPILE_RE.test(inspect)) return false;
  if (EXPLICIT_HCCL_WAIT_TIMEOUT_RE.test(inspect) && !TORCHAIR_STRICT_COMPILE_TOKEN_RE.test(inspect)) {
    return false;
  }
  if (
    NON_ASCEND_COMPILER_BACKEND_RE.test(inspect) &&
    !/\b(?:torchair|npugraph_ex|npu_graph|ge::|vllm_ascend|EZ300[23]|ERR03005)\b/i.test(inspect)
  ) {
    return false;
  }
  if (!TORCHAIR_GE_COMPILE_FAULT_RE.test(inspect)) return false;
  if (!TORCHAIR_EXPLICIT_GRAPH_CONTEXT_RE.test(inspect) && !TORCHAIR_STRICT_COMPILE_TOKEN_RE.test(inspect)) {
    return false;
  }
  if (TORCHAIR_GE_GENERIC_DYNAMO_RE.test(inspect) && !TORCHAIR_EXPLICIT_GRAPH_CONTEXT_RE.test(inspect)) {
    return false;
  }
  return true;
}

const MOE_MC2_SPECIFIC_OP_RE =
  /(?:npu_moe_distribute_(?:dispatch|combine)(?:_v2)?|MoeDistribute(?:Dispatch|Combine)(?:V2)?|DispatchFFNCombine|dispatch_ffn_combine)[^\r\n]{0,256}(?:HCCL_BUFFSIZE is too SMALL|worldSize is invalid|mc2 group[^\r\n]{0,32}not\s+initialized|expert_map[^\r\n]{0,32}(?:required|invalid|mismatch)|(?:hierarchy|comm_alg|group_ep|group_tp|ep_world_size|tp_world_size|rank_size|world\s*size)\b[^\r\n]{0,32}\b(?:is\s+)?(?:invalid|mismatch|missing|not\s+initialized|required|out\s+of\s+range|unsupported|not\s+supported)|not\s+initialized)/i;

const MOE_MC2_FAULT_RE = new RegExp(
  [
    "mc2 group is not initialized",
    "expert_map is required for MC2 token dispatch",
    "fused mc2 op cannot be used with hierarchy communication",
    "mc2_comm_alg\\s*==\\s*['\"](?:fullmesh_v2|hierarchy)['\"]\\s*(?:is not supported|supports at most 512 experts)",
    "supports at most 512 experts",
    "HCCL_BUFFSIZE is too SMALL",
    MOE_MC2_SPECIFIC_OP_RE.source,
  ].join("|"),
  "i",
);

const MODELSLIM_QUANT_FAULT_RE =
  /ERROR:\s*ModelSlim Quantization Config Not Found|ModelSlim quantization config not found|quant_model_description\.json[^\r\n]{0,160}(?:not found|missing|does not exist|corrupt|invalid|decode\s+error|error|fail)|Not all shards of [^\r\n]{0,160} are quantized with same quant type|Could not determine quantization type for layer|doesn't support quant_type=|Quantization method specified in the model config \([^)\r\n]{0,96}(?:ascend|modelslim)[^)\r\n]{0,96}\) does not match the quantization method specified|Quantization method specified in the model config \([^)\r\n]{0,96}\) does not match the quantization method specified[^\r\n]{0,160}(?:ascend|modelslim)/i;

const NON_MC2_HARDWARE_OR_OPAPI_CODE_RE =
  /\b(?:ACL_ERROR_RT_VECTOR_CORE_EXCEPTION|ACL_ERROR_RT_AICORE_TIMEOUT|ACL_ERROR_RT_AICPU_EXCEPTION|ACL_ERROR_RT_AICORE_OVER_FLOW|ACL_ERROR_RT_MEMORY_ALLOCATION|507014|507015|507018|507034|507035|107030|207003|561002|561103|161002|161001)\b|\b(?:vector\s+core|aicore)\s+exception\b/i;

function isMoeMc2OrModelSlimLine(
  rawLine: string,
  tracebackGroupId: number | null = null,
  ctx?: LineScopeContext,
): boolean {
  const inspect = capLineWindow(rawLine);
  if (!hasFailureSemantics(inspect)) return false;
  if (GQA_STATIC_C8_KV_RE.test(inspect)) return false;
  if (
    tracebackGroupId !== null &&
    ctx?.modelslimJsonTbGroups.has(tracebackGroupId) &&
    /\bJSONDecodeError\b/i.test(inspect)
  ) {
    return true;
  }
  if (/AscendModelSlimConfig310/i.test(inspect) && !MODELSLIM_QUANT_FAULT_RE.test(inspect)) {
    return false;
  }
  if (isTorchairGeCompileFaultLine(inspect)) return false;
  if (
    NON_MC2_HARDWARE_OR_OPAPI_CODE_RE.test(inspect) &&
    !/HCCL_BUFFSIZE is too SMALL|worldSize is invalid|mc2 group is not initialized|expert_map is required|fused mc2 op cannot be used|supports at most 512 experts/i.test(
      inspect,
    )
  ) {
    return false;
  }
  return MOE_MC2_FAULT_RE.test(inspect) || MODELSLIM_QUANT_FAULT_RE.test(inspect);
}

const CANN_DRIVER_DEVICE_ENV_CORE_RE =
  /(?:lib)?(?:ascend_hal|atb)\.so(?:\.\d+)*\b[^\r\n]{0,160}(?:cannot open shared object file|No such file or directory|not found|missing|undefined symbol|fail(?:ed)?|error|ENOENT|EACCES|Permission denied)|(?:cannot open shared object file|undefined symbol|not found|missing)[^\r\n]{0,160}(?:lib)?(?:ascend_hal|atb)\.so|\/dev\/davinci(?:_manager|\d+)\b[^\r\n]{0,160}(?:No such file or directory|Permission denied|ENOENT|EACCES|fail(?:ed)?|error|cannot open)|(?:No such file or directory|Permission denied|ENOENT|EACCES|cannot open)[^\r\n]{0,160}\/dev\/davinci(?:_manager|\d+)\b|\baclrtGetPhyDevIdByUserDevId\s+failed\b|\b(?:drvGetDevInfo|aclrtSetDevice|rtSetDevice)\b[^\r\n]{0,160}(?:fail(?:ed)?|error(?!\s*=\s*0\b)|ACL_ERROR|(?:ret(?:Code)?|code|status)\s*[:=]\s*(?:-?[1-9]\d*|0x0*[1-9a-f][0-9a-f]*)\b)|(?:error(?:\s+code)?(?:\s+is)?|err(?:Code)?|ret(?:Code)?|code|status|acl(?:rt)?\w*\s+fail(?:ed)?[^\r\n]{0,30})\s*[:=#(]?\s*(?:507008|107002)\b|\b(?:507008|107002)\s*[:\])]?\s*(?:ACL_ERROR|fail(?:ed)?|error|null\s+context|soc\s+version)|\bEE1001\b[^\r\n]{0,160}(?:context\s+pointer\s+null|null\s+context|drvGetDevInfo|aclrtSetDevice|rtSetDevice|device\s+(?:not\s+(?:init|open|set|found)|init|open))|\bACL_ERROR_RT_(?:SOC_VERSION|CONTEXT_NULL)\b|\bDP adjusted local rank\b[^\r\n]{0,160}is out of bounds for\b|\bworld_size\s*\(\d+\)\s*is\s+larger\s+than\s+visible\s+NPU\s+count\b|\blocal_world_size\s*\(\d+\)\s*(?:exceeds assigned_physical_gpu_ids count|must be less than or equal to the number of visible devices)\b/i;

const EL0004_MEM_ALLOC_RE = /\bEL0004\b[^\r\n]{0,160}(?:Failed to allocate memory|memory|fail|error)/i;

interface PartnerLineContext {
  rank: number | null;
  rankSource: RankSource | null;
  hostTag: string | null;
  instanceTag: string | null;
  groupTag: string | null;
  pid: number | null;
  peerRank: number | null;
  timestamp: string | null;
  timestampMs: number | null;
  timestampSubMs: number;
  timestampKind: "full" | "short-date" | "time-only" | null;
  hasExplicitTimezone: boolean;
  inferredYearMatched: boolean;
}

interface TieredMilestoneBucket {
  allByLine: ParsedLogLine[];
  byTier: Map<number, ParsedLogLine[]>;
  untimestamped: ParsedLogLine[];
  untimestampedBySeg: Map<number, ParsedLogLine[]>;
  bySeg: Map<number, ParsedLogLine[]>;
}

interface DomainIndexedBucket {
  all: TieredMilestoneBucket;
  byInstance: Map<string, TieredMilestoneBucket>;
  noInstance: TieredMilestoneBucket;
  byHost: Map<string, TieredMilestoneBucket>;
  noHost: TieredMilestoneBucket;
  byGroup: Map<string, TieredMilestoneBucket>;
  noGroup: TieredMilestoneBucket;
}

function findRightmostTrue<T>(arr: readonly T[], pred: (item: T) => boolean): number {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (pred(arr[mid]!)) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

function getLifecycleTierKey(
  line: Pick<ParsedLogLine, "timestampMs" | "timestampKind" | "hasExplicitTimezone" | "inferredYearMatched">,
): number {
  return (getClockTier(line) << 1) | (line.hasExplicitTimezone ? 1 : 0);
}

function createTieredBucket(): TieredMilestoneBucket {
  return {
    allByLine: [],
    byTier: new Map<number, ParsedLogLine[]>(),
    untimestamped: [],
    untimestampedBySeg: new Map<number, ParsedLogLine[]>(),
    bySeg: new Map<number, ParsedLogLine[]>(),
  };
}

function pushToTieredBucket(bucket: TieredMilestoneBucket, line: ParsedLogLine): void {
  bucket.allByLine.push(line);
  let segArr = bucket.bySeg.get(line.segmentId);
  if (!segArr) {
    segArr = [];
    bucket.bySeg.set(line.segmentId, segArr);
  }
  segArr.push(line);
  if (line.timestampMs !== null) {
    const tier = getLifecycleTierKey(line);
    let arr = bucket.byTier.get(tier);
    if (!arr) {
      arr = [];
      bucket.byTier.set(tier, arr);
    }
    arr.push(line);
  } else {
    bucket.untimestamped.push(line);
    let uSegArr = bucket.untimestampedBySeg.get(line.segmentId);
    if (!uSegArr) {
      uSegArr = [];
      bucket.untimestampedBySeg.set(line.segmentId, uSegArr);
    }
    uSegArr.push(line);
  }
}

function finalizeTieredBucket(bucket: TieredMilestoneBucket): void {
  bucket.allByLine.sort((a, b) => a.segmentId - b.segmentId || a.lineNumber - b.lineNumber);
  for (const arr of bucket.byTier.values()) {
    arr.sort(compareTimestampOrder);
  }
  bucket.untimestamped.sort((a, b) => a.lineNumber - b.lineNumber);
  for (const uSegArr of bucket.untimestampedBySeg.values()) {
    uSegArr.sort((a, b) => a.lineNumber - b.lineNumber);
  }
  for (const segArr of bucket.bySeg.values()) {
    segArr.sort((a, b) => a.lineNumber - b.lineNumber);
  }
}

function createDomainIndexedBucket(): DomainIndexedBucket {
  return {
    all: createTieredBucket(),
    byInstance: new Map<string, TieredMilestoneBucket>(),
    noInstance: createTieredBucket(),
    byHost: new Map<string, TieredMilestoneBucket>(),
    noHost: createTieredBucket(),
    byGroup: new Map<string, TieredMilestoneBucket>(),
    noGroup: createTieredBucket(),
  };
}

function pushTagTiered(
  map: Map<string, TieredMilestoneBucket>,
  noTag: TieredMilestoneBucket,
  tag: string | null,
  line: ParsedLogLine,
): void {
  if (tag !== null) {
    const k = tag.toLowerCase();
    let b = map.get(k);
    if (!b) {
      b = createTieredBucket();
      map.set(k, b);
    }
    pushToTieredBucket(b, line);
  } else {
    pushToTieredBucket(noTag, line);
  }
}

function pushToDomainBucket(bucket: DomainIndexedBucket, line: ParsedLogLine): void {
  pushToTieredBucket(bucket.all, line);
  pushTagTiered(bucket.byInstance, bucket.noInstance, line.instanceTag, line);
  pushTagTiered(bucket.byHost, bucket.noHost, line.hostTag, line);
  pushTagTiered(bucket.byGroup, bucket.noGroup, line.groupTag, line);
}

function finalizeDomainBucket(bucket: DomainIndexedBucket): void {
  finalizeTieredBucket(bucket.all);
  for (const b of bucket.byInstance.values()) finalizeTieredBucket(b);
  finalizeTieredBucket(bucket.noInstance);
  for (const b of bucket.byHost.values()) finalizeTieredBucket(b);
  finalizeTieredBucket(bucket.noHost);
  for (const b of bucket.byGroup.values()) finalizeTieredBucket(b);
  finalizeTieredBucket(bucket.noGroup);
}

function pushToKeyedDomainBucket(
  map: Map<number, DomainIndexedBucket>,
  key: number,
  line: ParsedLogLine,
): void {
  let b = map.get(key);
  if (!b) {
    b = createDomainIndexedBucket();
    map.set(key, b);
  }
  pushToDomainBucket(b, line);
}

const CUBE_NULL_DIM = "\u0001";

interface TieredDomCube {
  byDom: Map<string, TieredMilestoneBucket>;
  byHostInst: Map<string, TieredMilestoneBucket>;
  byHostGrp: Map<string, TieredMilestoneBucket>;
  byInstGrp: Map<string, TieredMilestoneBucket>;
  byHost: Map<string, TieredMilestoneBucket>;
  byInst: Map<string, TieredMilestoneBucket>;
  byGrp: Map<string, TieredMilestoneBucket>;
  all: TieredMilestoneBucket;
  created: TieredMilestoneBucket[];
  knownHosts: Set<string>;
  knownInsts: Set<string>;
  knownGrps: Set<string>;
  cache: Map<string, TieredMilestoneBucket[]>;
  finalized: boolean;
}

function createTieredDomCube(): TieredDomCube {
  const all = createTieredBucket();
  return {
    byDom: new Map(),
    byHostInst: new Map(),
    byHostGrp: new Map(),
    byInstGrp: new Map(),
    byHost: new Map(),
    byInst: new Map(),
    byGrp: new Map(),
    all,
    created: [all],
    knownHosts: new Set(),
    knownInsts: new Set(),
    knownGrps: new Set(),
    cache: new Map(),
    finalized: false,
  };
}

function pushCubeBucket(
  cube: TieredDomCube,
  map: Map<string, TieredMilestoneBucket>,
  key: string,
  line: ParsedLogLine,
): void {
  let b = map.get(key);
  if (!b) {
    b = createTieredBucket();
    map.set(key, b);
    cube.created.push(b);
  }
  pushToTieredBucket(b, line);
}

function pushToTieredDomCube(cube: TieredDomCube, line: ParsedLogLine): void {
  const h = line.hostTag !== null ? line.hostTag.toLowerCase() : CUBE_NULL_DIM;
  const i = line.instanceTag !== null ? line.instanceTag.toLowerCase() : CUBE_NULL_DIM;
  const g = line.groupTag !== null ? line.groupTag.toLowerCase() : CUBE_NULL_DIM;
  if (h !== CUBE_NULL_DIM) cube.knownHosts.add(h);
  if (i !== CUBE_NULL_DIM) cube.knownInsts.add(i);
  if (g !== CUBE_NULL_DIM) cube.knownGrps.add(g);
  pushToTieredBucket(cube.all, line);
  pushCubeBucket(cube, cube.byDom, `${h}\u0000${i}\u0000${g}`, line);
  pushCubeBucket(cube, cube.byHostInst, `${h}\u0000${i}`, line);
  pushCubeBucket(cube, cube.byHostGrp, `${h}\u0000${g}`, line);
  pushCubeBucket(cube, cube.byInstGrp, `${i}\u0000${g}`, line);
  pushCubeBucket(cube, cube.byHost, h, line);
  pushCubeBucket(cube, cube.byInst, i, line);
  pushCubeBucket(cube, cube.byGrp, g, line);
}

function finalizeTieredDomCube(cube: TieredDomCube): void {
  if (cube.finalized) return;
  cube.finalized = true;
  for (const b of cube.created) {
    finalizeTieredBucket(b);
  }
}

function queryTieredDomCube(
  cube: TieredDomCube,
  anchor: Pick<ParsedLogLine, "hostTag" | "instanceTag" | "groupTag">,
): TieredMilestoneBucket[] {
  if (!cube.finalized) finalizeTieredDomCube(cube);
  if (cube.all.allByLine.length === 0) return [];
  const hRaw = anchor.hostTag === null ? null : anchor.hostTag.toLowerCase();
  const iRaw = anchor.instanceTag === null ? null : anchor.instanceTag.toLowerCase();
  const gRaw = anchor.groupTag === null ? null : anchor.groupTag.toLowerCase();
  const nH = hRaw === null ? CUBE_NULL_DIM : cube.knownHosts.has(hRaw) ? hRaw : "__OTHER__";
  const nI = iRaw === null ? CUBE_NULL_DIM : cube.knownInsts.has(iRaw) ? iRaw : "__OTHER__";
  const nG = gRaw === null ? CUBE_NULL_DIM : cube.knownGrps.has(gRaw) ? gRaw : "__OTHER__";
  const cacheKey = `${nH}\u0000${nI}\u0000${nG}`;
  const hit = cube.cache.get(cacheKey);
  if (hit) {
    if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
    return hit;
  }
  if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;

  const hOpts = nH === CUBE_NULL_DIM || nH === "__OTHER__" ? [CUBE_NULL_DIM] : [nH, CUBE_NULL_DIM];
  const iOpts = nI === CUBE_NULL_DIM || nI === "__OTHER__" ? [CUBE_NULL_DIM] : [nI, CUBE_NULL_DIM];
  const gOpts = nG === CUBE_NULL_DIM || nG === "__OTHER__" ? [CUBE_NULL_DIM] : [nG, CUBE_NULL_DIM];
  const out: TieredMilestoneBucket[] = [];
  if (hRaw !== null && iRaw !== null && gRaw !== null) {
    for (const hk of hOpts) {
      for (const ik of iOpts) {
        for (const gk of gOpts) {
          const b = cube.byDom.get(`${hk}\u0000${ik}\u0000${gk}`);
          if (b) out.push(b);
        }
      }
    }
  } else if (hRaw !== null && iRaw !== null) {
    for (const hk of hOpts) {
      for (const ik of iOpts) {
        const b = cube.byHostInst.get(`${hk}\u0000${ik}`);
        if (b) out.push(b);
      }
    }
  } else if (hRaw !== null && gRaw !== null) {
    for (const hk of hOpts) {
      for (const gk of gOpts) {
        const b = cube.byHostGrp.get(`${hk}\u0000${gk}`);
        if (b) out.push(b);
      }
    }
  } else if (iRaw !== null && gRaw !== null) {
    for (const ik of iOpts) {
      for (const gk of gOpts) {
        const b = cube.byInstGrp.get(`${ik}\u0000${gk}`);
        if (b) out.push(b);
      }
    }
  } else if (hRaw !== null) {
    for (const hk of hOpts) {
      const b = cube.byHost.get(hk);
      if (b) out.push(b);
    }
  } else if (iRaw !== null) {
    for (const ik of iOpts) {
      const b = cube.byInst.get(ik);
      if (b) out.push(b);
    }
  } else if (gRaw !== null) {
    for (const gk of gOpts) {
      const b = cube.byGrp.get(gk);
      if (b) out.push(b);
    }
  } else {
    out.push(cube.all);
  }
  cube.cache.set(cacheKey, out);
  return out;
}

function queryCoveringDomCube(
  cube: TieredDomCube,
  anchor: Pick<ParsedLogLine, "hostTag" | "instanceTag" | "groupTag">,
): TieredMilestoneBucket[] {
  if (!cube.finalized) finalizeTieredDomCube(cube);
  if (cube.all.allByLine.length === 0) return [];
  const hRaw = anchor.hostTag === null ? null : anchor.hostTag.toLowerCase();
  const iRaw = anchor.instanceTag === null ? null : anchor.instanceTag.toLowerCase();
  const gRaw = anchor.groupTag === null ? null : anchor.groupTag.toLowerCase();
  const hOpts = hRaw !== null && cube.knownHosts.has(hRaw) ? [hRaw, CUBE_NULL_DIM] : [CUBE_NULL_DIM];
  const iOpts = iRaw !== null && cube.knownInsts.has(iRaw) ? [iRaw, CUBE_NULL_DIM] : [CUBE_NULL_DIM];
  const gOpts = gRaw !== null && cube.knownGrps.has(gRaw) ? [gRaw, CUBE_NULL_DIM] : [CUBE_NULL_DIM];
  const out: TieredMilestoneBucket[] = [];
  for (const hk of hOpts) {
    for (const ik of iOpts) {
      for (const gk of gOpts) {
        const b = cube.byDom.get(`${hk}\u0000${ik}\u0000${gk}`);
        if (b) out.push(b);
      }
    }
  }
  return out;
}

const tieredDomCubeMemo = new WeakMap<DomainIndexedBucket, TieredDomCube>();

function getTieredDomCube(bucket: DomainIndexedBucket): TieredDomCube {
  let cube = tieredDomCubeMemo.get(bucket);
  if (!cube) {
    cube = createTieredDomCube();
    for (const m of bucket.all.allByLine) {
      pushToTieredDomCube(cube, m);
    }
    finalizeTieredDomCube(cube);
    tieredDomCubeMemo.set(bucket, cube);
  }
  return cube;
}

function getDomainBucketsForLine(
  bucket: DomainIndexedBucket,
  line: Pick<
    ParsedLogLine,
    | "hostTag"
    | "instanceTag"
    | "groupTag"
    | "timestampMs"
    | "timestampKind"
    | "hasExplicitTimezone"
    | "inferredYearMatched"
  >,
): TieredMilestoneBucket[] {
  if (bucket.all.allByLine.length === 0) return [];
  return queryTieredDomCube(getTieredDomCube(bucket), line);
}

interface TimedDomainLookupOptions {
  restrictToSegLineDist?: boolean;
  allowCrossTimestampSegLineDist?: number;
  upperBoundCand?: ParsedLogLine | null;
  untimestampedMaxLine?: number;
  restrictUntimestampedToSeg?: boolean;
}

function someInTimedDomainBucket(
  bucket: DomainIndexedBucket | undefined,
  query: ParsedLogLine,
  maxBeforeMs: number,
  maxAfterMs: number,
  maxLineDist: number,
  pred: (cand: ParsedLogLine) => boolean,
  allowUntimestampedForTimestampedQuery = false,
  breakBefore?: (cand: ParsedLogLine) => boolean,
  options?: TimedDomainLookupOptions,
): boolean {
  if (!bucket) return false;
  const subBuckets = getDomainBucketsForLine(bucket, query);
  const searchSegLineWindow = (
    arr: readonly ParsedLogLine[] | undefined,
    lineDist: number,
    allowBreakBefore: boolean,
  ): boolean => {
    if (!arr || arr.length === 0) return false;
    const hiLine = Number.isFinite(lineDist) ? query.lineNumber + lineDist : Number.POSITIVE_INFINITY;
    const loLine = Number.isFinite(lineDist) ? query.lineNumber - lineDist : Number.NEGATIVE_INFINITY;
    const startIdx = findRightmostTrue(arr, (cand) => cand.lineNumber <= hiLine);
    for (let idx = startIdx; idx >= 0; idx -= 1) {
      if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
      const cand = arr[idx]!;
      if (cand.lineNumber < loLine) break;
      if (allowBreakBefore && breakBefore?.(cand)) break;
      if (pred(cand)) return true;
    }
    return false;
  };
  if (options?.restrictToSegLineDist) {
    for (const sub of subBuckets) {
      if (searchSegLineWindow(sub.bySeg.get(query.segmentId), maxLineDist, false)) return true;
    }
    return false;
  }
  const crossSegDist = options?.allowCrossTimestampSegLineDist;
  const upperBoundCand = options?.upperBoundCand ?? null;
  if (query.timestampMs !== null) {
    const effBeforeMs =
      query.timestampKind === "time-only" ? Math.min(maxBeforeMs, 12 * 3_600_000) : maxBeforeMs;
    const effAfterMs =
      query.timestampKind === "time-only" ? Math.min(maxAfterMs, 12 * 3_600_000) : maxAfterMs;
    const tierKey = getLifecycleTierKey(query);
    for (const sub of subBuckets) {
      const arr = sub.byTier.get(tierKey);
      if (arr && arr.length > 0) {
        const hiTs = Number.isFinite(effAfterMs) ? query.timestampMs + effAfterMs : Number.POSITIVE_INFINITY;
        const canBoundTsOrder = upperBoundCand !== null && areTimestampsComparable(query, upperBoundCand);
        const startIdx = findRightmostTrue(
          arr,
          (cand) =>
            cand.timestampMs! <= hiTs &&
            (!canBoundTsOrder || compareTimestampOrder(cand, upperBoundCand) < 0),
        );
        for (let idx = startIdx; idx >= 0; idx -= 1) {
          if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
          const cand = arr[idx]!;
          if (Number.isFinite(effBeforeMs) && query.timestampMs - cand.timestampMs! > effBeforeMs) {
            break;
          }
          if (breakBefore?.(cand)) break;
          if (!areTimestampsComparable(query, cand)) continue;
          if (pred(cand)) return true;
        }
      }
      if (allowUntimestampedForTimestampedQuery && sub.untimestamped.length > 0) {
        const segArr = sub.untimestamped;
        const startSegIdx = findRightmostTrue(segArr, (cand) => cand.segmentId <= query.segmentId);
        for (let idx = startSegIdx; idx >= 0; idx -= 1) {
          if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
          const cand = segArr[idx]!;
          if (cand.segmentId < query.segmentId) break;
          if (breakBefore?.(cand)) break;
          if (pred(cand)) return true;
        }
      } else if (crossSegDist !== undefined) {
        if (searchSegLineWindow(sub.untimestampedBySeg.get(query.segmentId), crossSegDist, false)) {
          return true;
        }
      }
    }
    return false;
  }
  for (const sub of subBuckets) {
    if (crossSegDist !== undefined) {
      if (searchSegLineWindow(sub.bySeg.get(query.segmentId), crossSegDist, false)) return true;
      continue;
    }
    const arr = options?.restrictUntimestampedToSeg
      ? sub.untimestampedBySeg.get(query.segmentId)
      : sub.untimestamped;
    if (!arr || arr.length === 0) continue;
    const rawHi = Number.isFinite(maxLineDist) ? query.lineNumber + maxLineDist : Number.POSITIVE_INFINITY;
    const hiLine = Math.min(rawHi, options?.untimestampedMaxLine ?? Number.POSITIVE_INFINITY);
    const startIdx = findRightmostTrue(arr, (cand) => cand.lineNumber <= hiLine);
    for (let idx = startIdx; idx >= 0; idx -= 1) {
      if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
      const cand = arr[idx]!;
      if (Number.isFinite(maxLineDist) && query.lineNumber - cand.lineNumber > maxLineDist) {
        break;
      }
      if (breakBefore?.(cand)) break;
      if (pred(cand)) return true;
    }
  }
  return false;
}

interface SegMinMaxTsTree {
  arr: ParsedLogLine[];
  minMs: Float64Array;
  maxMs: Float64Array;
  monthMask: Uint16Array;
}

function buildSegMinMaxTsTree(arr: ParsedLogLine[]): SegMinMaxTsTree | null {
  if (arr.length <= 8) return null;
  const n = arr.length;
  const minMs = new Float64Array(4 * n);
  const maxMs = new Float64Array(4 * n);
  const monthMask = new Uint16Array(4 * n);
  const init = (node: number, lo: number, hi: number) => {
    if (lo === hi) {
      const m = arr[lo]!;
      const tsMs = m.timestampMs!;
      minMs[node] = tsMs;
      maxMs[node] = tsMs;
      const mon = getShortDateMonth(m);
      monthMask[node] = mon !== null && mon >= 1 && mon <= 12 ? 1 << (mon - 1) : 0;
      return;
    }
    const mid = (lo + hi) >> 1;
    const left = node << 1;
    const right = left | 1;
    init(left, lo, mid);
    init(right, mid + 1, hi);
    minMs[node] = Math.min(minMs[left]!, minMs[right]!);
    maxMs[node] = Math.max(maxMs[left]!, maxMs[right]!);
    monthMask[node] = monthMask[left]! | monthMask[right]!;
  };
  init(1, 0, n - 1);
  return { arr, minMs, maxMs, monthMask };
}

function hasIncomparableSameTierInRange(
  tree: SegMinMaxTsTree | null,
  arr: ParsedLogLine[],
  loPos: number,
  hiPos: number,
  tierKey: number,
  earlier: ParsedLogLine,
  later: ParsedLogLine,
  matchesFilter: (mid: ParsedLogLine) => boolean,
): boolean {
  if (loPos > hiPos) return false;
  if (tierKey === 0 || tierKey === 1) return false;
  const isTimeOnly = tierKey === 4 || tierKey === 5;
  const winMin = isTimeOnly ? later.timestampMs! - 12 * 3_600_000 : 0;
  const winMax = isTimeOnly ? earlier.timestampMs! + 12 * 3_600_000 : 0;
  let forbiddenMask = 0;
  if (!isTimeOnly) {
    const eMon = getShortDateMonth(earlier);
    const lMon = getShortDateMonth(later);
    if (eMon === 1 || lMon === 1) forbiddenMask |= 1 << 11;
    if (eMon === 12 || lMon === 12) forbiddenMask |= 1 << 0;
    if (forbiddenMask === 0) return false;
  }
  if (!tree) {
    for (let p = hiPos; p >= loPos; p -= 1) {
      if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
      const mid = arr[p]!;
      if (
        (!areTimestampsComparable(earlier, mid) || !areTimestampsComparable(later, mid)) &&
        matchesFilter(mid)
      ) {
        return true;
      }
    }
    return false;
  }
  const { minMs, maxMs, monthMask } = tree;
  const dfs = (node: number, lo: number, hi: number): boolean => {
    if (lo > hiPos || hi < loPos) return false;
    if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
    if (isTimeOnly) {
      if (minMs[node]! >= winMin && maxMs[node]! <= winMax) return false;
    } else if ((monthMask[node]! & forbiddenMask) === 0) {
      return false;
    }
    if (lo === hi) {
      const mid = arr[lo]!;
      return (
        (!areTimestampsComparable(earlier, mid) || !areTimestampsComparable(later, mid)) && matchesFilter(mid)
      );
    }
    const midIdx = (lo + hi) >> 1;
    if (dfs((node << 1) | 1, midIdx + 1, hi)) return true;
    return dfs(node << 1, lo, midIdx);
  };
  return dfs(1, 0, arr.length - 1);
}

interface TieredSegTreeIndex {
  segIds: number[];
  bySegByTier: Map<number, Map<number, ParsedLogLine[]>>;
  treesBySegTier: Map<number, Map<number, SegMinMaxTsTree | null>>;
}

const tieredSegTreeMemo = new WeakMap<TieredMilestoneBucket, TieredSegTreeIndex>();

function getTieredSegTreeIndex(sub: TieredMilestoneBucket): TieredSegTreeIndex {
  const cached = tieredSegTreeMemo.get(sub);
  if (cached) return cached;
  const segIds = [...sub.bySeg.keys()].sort((a, b) => a - b);
  const bySegByTier = new Map<number, Map<number, ParsedLogLine[]>>();
  const treesBySegTier = new Map<number, Map<number, SegMinMaxTsTree | null>>();
  for (const [segId, segArr] of sub.bySeg) {
    const tMap = new Map<number, ParsedLogLine[]>();
    for (const m of segArr) {
      if (m.timestampMs === null) continue;
      const tk = getLifecycleTierKey(m);
      let arr = tMap.get(tk);
      if (!arr) {
        arr = [];
        tMap.set(tk, arr);
      }
      arr.push(m);
    }
    const treeMap = new Map<number, SegMinMaxTsTree | null>();
    for (const [tk, arr] of tMap) {
      arr.sort((a, b) => a.lineNumber - b.lineNumber);
      treeMap.set(tk, buildSegMinMaxTsTree(arr));
    }
    bySegByTier.set(segId, tMap);
    treesBySegTier.set(segId, treeMap);
  }
  const built: TieredSegTreeIndex = { segIds, bySegByTier, treesBySegTier };
  tieredSegTreeMemo.set(sub, built);
  return built;
}

const startupRankSplitMemo = new WeakMap<
  DomainIndexedBucket,
  { byRank: Map<number, DomainIndexedBucket>; noRank: DomainIndexedBucket }
>();

function getStartupRankSplit(bucket: DomainIndexedBucket): {
  byRank: Map<number, DomainIndexedBucket>;
  noRank: DomainIndexedBucket;
} {
  const cached = startupRankSplitMemo.get(bucket);
  if (cached) return cached;
  const byRank = new Map<number, DomainIndexedBucket>();
  const noRank = createDomainIndexedBucket();
  for (const m of bucket.all.allByLine) {
    if (m.rank === null) {
      pushToDomainBucket(noRank, m);
    } else {
      pushToKeyedDomainBucket(byRank, m.rank, m);
    }
  }
  finalizeDomainBucket(noRank);
  for (const b of byRank.values()) finalizeDomainBucket(b);
  const res = { byRank, noRank };
  startupRankSplitMemo.set(bucket, res);
  return res;
}

const startupPidSplitMemo = new WeakMap<
  DomainIndexedBucket,
  { byPid: Map<number, DomainIndexedBucket>; noPid: DomainIndexedBucket }
>();

function getStartupPidSplit(bucket: DomainIndexedBucket): {
  byPid: Map<number, DomainIndexedBucket>;
  noPid: DomainIndexedBucket;
} {
  const cached = startupPidSplitMemo.get(bucket);
  if (cached) return cached;
  const byPid = new Map<number, DomainIndexedBucket>();
  const noPid = createDomainIndexedBucket();
  for (const m of bucket.all.allByLine) {
    if (m.pid === null) {
      pushToDomainBucket(noPid, m);
    } else {
      pushToKeyedDomainBucket(byPid, m.pid, m);
    }
  }
  finalizeDomainBucket(noPid);
  for (const b of byPid.values()) finalizeDomainBucket(b);
  const res = { byPid, noPid };
  startupPidSplitMemo.set(bucket, res);
  return res;
}

function hasStartupBoundaryBetween(
  startupBucket: DomainIndexedBucket | undefined,
  a: ParsedLogLine,
  b: ParsedLogLine,
  enforceSameRankOnA = true,
  enforcePidMatchOnMid = false,
): boolean {
  if (!startupBucket || startupBucket.all.bySeg.size === 0) {
    return false;
  }
  if (!areCausalDomainsCompatible(a, b)) return false;
  const rankMatchesMid = (mid: ParsedLogLine): boolean => {
    if (!enforceSameRankOnA || mid.rank === null) return true;
    if (a.rank === null && b.rank === null) return true;
    if (a.rank !== null && b.rank !== null && a.rank !== b.rank) {
      return mid.rank === a.rank || mid.rank === b.rank;
    }
    const targetRank = a.rank ?? b.rank;
    return targetRank === null || mid.rank === targetRank;
  };
  const pidMatchesMid = (mid: ParsedLogLine): boolean => {
    if (!enforcePidMatchOnMid || mid.pid === null) return true;
    if (a.pid !== null && b.pid !== null && a.pid !== b.pid) {
      return mid.pid === a.pid || mid.pid === b.pid;
    }
    const targetPid = a.pid ?? b.pid;
    return targetPid === null || mid.pid === targetPid;
  };
  const bothComparable = a.timestampMs !== null && b.timestampMs !== null && areTimestampsComparable(a, b);
  const [earlier, later] = bothComparable && compareTimestampOrder(a, b) > 0 ? [b, a] : [a, b];
  const mergedQuery = {
    hostTag: a.hostTag ?? b.hostTag,
    instanceTag: a.instanceTag ?? b.instanceTag,
    groupTag: a.groupTag ?? b.groupTag,
    timestampMs: earlier.timestampMs,
    timestampKind: earlier.timestampKind,
    hasExplicitTimezone: earlier.hasExplicitTimezone,
    inferredYearMatched: earlier.inferredYearMatched,
  };
  const rankFilteredBuckets: DomainIndexedBucket[] = [];
  if (enforceSameRankOnA && (a.rank !== null || b.rank !== null) && startupBucket.all.allByLine.length > 16) {
    const split = getStartupRankSplit(startupBucket);
    if (split.noRank.all.allByLine.length > 0) rankFilteredBuckets.push(split.noRank);
    if (a.rank !== null) {
      const ra = split.byRank.get(a.rank);
      if (ra) rankFilteredBuckets.push(ra);
    }
    if (b.rank !== null && b.rank !== a.rank) {
      const rb = split.byRank.get(b.rank);
      if (rb) rankFilteredBuckets.push(rb);
    }
  } else {
    rankFilteredBuckets.push(startupBucket);
  }
  const targetDomainBuckets: DomainIndexedBucket[] = [];
  if (enforcePidMatchOnMid && (a.pid !== null || b.pid !== null)) {
    for (const db of rankFilteredBuckets) {
      if (db.all.allByLine.length <= 16) {
        targetDomainBuckets.push(db);
        continue;
      }
      const pSplit = getStartupPidSplit(db);
      if (pSplit.noPid.all.allByLine.length > 0) targetDomainBuckets.push(pSplit.noPid);
      if (a.pid !== null) {
        const pa = pSplit.byPid.get(a.pid);
        if (pa) targetDomainBuckets.push(pa);
      }
      if (b.pid !== null && b.pid !== a.pid) {
        const pb = pSplit.byPid.get(b.pid);
        if (pb) targetDomainBuckets.push(pb);
      }
    }
  } else {
    targetDomainBuckets.push(...rankFilteredBuckets);
  }
  const subBuckets: TieredMilestoneBucket[] = [];
  for (const db of targetDomainBuckets) {
    for (const sub of getDomainBucketsForLine(db, mergedQuery)) {
      if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
      subBuckets.push(sub);
    }
  }
  if (subBuckets.length === 0) return false;

  if (bothComparable) {
    const tierKey = getLifecycleTierKey(earlier);
    for (const sub of subBuckets) {
      const arr = sub.byTier.get(tierKey);
      if (arr && arr.length > 0) {
        const startPos = findRightmostTrue(arr, (mid) => compareTimestampOrder(mid, later) < 0);
        for (let p = startPos; p >= 0; p -= 1) {
          if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
          const mid = arr[p]!;
          if (compareTimestampOrder(mid, earlier) <= 0) break;
          if (!areTimestampsComparable(earlier, mid)) continue;
          if (
            areCausalDomainsCompatible(a, mid) &&
            areCausalDomainsCompatible(b, mid) &&
            rankMatchesMid(mid) &&
            pidMatchesMid(mid)
          ) {
            return true;
          }
        }
      }
    }
  }

  const shouldCheckFileOrder = !bothComparable || earlier.segmentId <= later.segmentId;
  if (shouldCheckFileOrder && (a.segmentId !== b.segmentId || a.lineNumber !== b.lineNumber)) {
    const [first, second] =
      a.segmentId < b.segmentId || (a.segmentId === b.segmentId && a.lineNumber <= b.lineNumber)
        ? [a, b]
        : [b, a];
    const matchesMid = (mid: ParsedLogLine): boolean =>
      areCausalDomainsCompatible(a, mid) &&
      areCausalDomainsCompatible(b, mid) &&
      rankMatchesMid(mid) &&
      pidMatchesMid(mid);
    const tierKey = bothComparable ? getLifecycleTierKey(earlier) : -1;

    for (const sub of subBuckets) {
      if (sub.allByLine.length === 0) continue;
      const segIdx = getTieredSegTreeIndex(sub);
      const startSegIdx = findRightmostTrue(segIdx.segIds, (s) => s < first.segmentId) + 1;
      for (let si = startSegIdx; si < segIdx.segIds.length; si += 1) {
        const segId = segIdx.segIds[si]!;
        if (segId > second.segmentId) break;
        const loLine = segId === first.segmentId ? first.lineNumber + 1 : Number.NEGATIVE_INFINITY;
        const hiLine = segId === second.segmentId ? second.lineNumber - 1 : Number.POSITIVE_INFINITY;
        if (loLine > hiLine) continue;

        if (!bothComparable) {
          const segArr = sub.bySeg.get(segId);
          if (!segArr || segArr.length === 0) continue;
          const hiPos = findRightmostTrue(segArr, (m) => m.lineNumber <= hiLine);
          for (let p = hiPos; p >= 0; p -= 1) {
            const mid = segArr[p]!;
            if (mid.lineNumber < loLine) break;
            if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
            if (matchesMid(mid)) return true;
          }
          continue;
        }

        const uArr = sub.untimestampedBySeg.get(segId);
        if (uArr && uArr.length > 0) {
          const uHi = findRightmostTrue(uArr, (m) => m.lineNumber <= hiLine);
          for (let p = uHi; p >= 0; p -= 1) {
            const mid = uArr[p]!;
            if (mid.lineNumber < loLine) break;
            if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
            if (matchesMid(mid)) return true;
          }
        }

        const segTiers = segIdx.bySegByTier.get(segId);
        const segTrees = segIdx.treesBySegTier.get(segId);
        if (!segTiers) continue;
        for (const [otherTk, tArr] of segTiers) {
          if (tArr.length === 0) continue;
          const tHi = findRightmostTrue(tArr, (m) => m.lineNumber <= hiLine);
          if (tHi < 0 || tArr[tHi]!.lineNumber < loLine) continue;
          const tLo = findRightmostTrue(tArr, (m) => m.lineNumber < loLine) + 1;
          if (tLo > tHi) continue;
          if (otherTk !== tierKey) {
            for (let p = tHi; p >= tLo; p -= 1) {
              if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
              if (matchesMid(tArr[p]!)) return true;
            }
          } else {
            const tree = segTrees?.get(otherTk) ?? null;
            if (hasIncomparableSameTierInRange(tree, tArr, tLo, tHi, tierKey, earlier, later, matchesMid)) {
              return true;
            }
          }
        }
      }
    }
  }
  return false;
}

interface OomLifecycleIndex {
  byPid: Map<number, DomainIndexedBucket>;
  byRankNoPid: Map<number, DomainIndexedBucket>;
  unscopedBySegment: Map<number, DomainIndexedBucket>;
  startupMilestones: DomainIndexedBucket;
  untimestampedStartups: ParsedLogLine[];
  runtimeMarkers: DomainIndexedBucket;
  peerStartups: DomainIndexedBucket;
}

interface LineScopeContext {
  ascendContextLines: readonly ParsedLogLine[];
  ascendByPid: ReadonlyMap<number, DomainIndexedBucket>;
  ascendByRankNoPid: ReadonlyMap<number, DomainIndexedBucket>;
  ascendByTbGroup: ReadonlyMap<number, readonly ParsedLogLine[]>;
  ambiguousDomainPids: ReadonlySet<number>;
  hbmOomLines: readonly ParsedLogLine[];
  hbmOomBySeg: ReadonlyMap<number, readonly ParsedLogLine[]>;
  hbmOomByPid: ReadonlyMap<number, DomainIndexedBucket>;
  hbmOomByRank: ReadonlyMap<number, DomainIndexedBucket>;
  hbmOomByRankNoPid: ReadonlyMap<number, DomainIndexedBucket>;
  hbmOomByTbGroup: ReadonlyMap<number, readonly ParsedLogLine[]>;
  hbmOomUnscopedBySeg: ReadonlyMap<number, DomainIndexedBucket>;
  hbmOomLineNumbers?: ReadonlySet<number>;
  startupResetBucket: DomainIndexedBucket;
  startupBoundaryBucket: DomainIndexedBucket;
  processResetBucket: DomainIndexedBucket;
  oomStageByLine: ReadonlyMap<number, "capture" | "cold-start" | "kv-alloc" | "runtime" | "unknown">;
  lineIndexByLineNumber: ReadonlyMap<number, number>;
  oomLifecycleCandidates: readonly ParsedLogLine[];
  oomLifecycleIndex?: OomLifecycleIndex;
  compileFaultLines: readonly ParsedLogLine[];
  compileFaultBySeg: ReadonlyMap<number, CompileFaultSegBucket>;
  pairedEi0006Lines: ReadonlySet<number>;
  mergedLinkEstContLines: ReadonlySet<number>;
  hccnDownLines: ReadonlySet<number>;
  hccnDeviceByLine: ReadonlyMap<number, string>;
  ambiguousDeviceLines: ReadonlySet<number>;
  modelslimJsonTbGroups: ReadonlySet<number>;
  nonfatal107030Lines: ReadonlySet<number>;
  partnerContextByLine: ReadonlyMap<number, PartnerLineContext>;
  ascendScopeMemo: Map<number, boolean>;
  hbmOomScopeMemo: Map<number, boolean>;
  compileSuppressedMemo: Map<number, boolean>;
}

function areScopeTagsCompatible(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return true;
  return a.toLowerCase() === b.toLowerCase();
}

function areCausalDomainsCompatible(
  a: Pick<ParsedLogLine, "hostTag" | "instanceTag" | "groupTag">,
  b: Pick<ParsedLogLine, "hostTag" | "instanceTag" | "groupTag">,
): boolean {
  return (
    areScopeTagsCompatible(a.hostTag, b.hostTag) &&
    areScopeTagsCompatible(a.instanceTag, b.instanceTag) &&
    areScopeTagsCompatible(a.groupTag, b.groupTag)
  );
}

function areTimestampsComparable(
  a: Pick<
    ParsedLogLine,
    "timestamp" | "timestampMs" | "timestampKind" | "hasExplicitTimezone" | "inferredYearMatched"
  >,
  b: Pick<
    ParsedLogLine,
    "timestamp" | "timestampMs" | "timestampKind" | "hasExplicitTimezone" | "inferredYearMatched"
  >,
): boolean {
  if (a.timestampMs === null || b.timestampMs === null) return false;
  if ((a.timestampKind === "time-only") !== (b.timestampKind === "time-only")) return false;
  if (a.hasExplicitTimezone !== b.hasExplicitTimezone) return false;
  if (
    a.timestampKind !== b.timestampKind &&
    ((a.timestampKind === "short-date" && !a.inferredYearMatched) ||
      (b.timestampKind === "short-date" && !b.inferredYearMatched))
  ) {
    return false;
  }
  if (
    a.timestampKind === "short-date" &&
    b.timestampKind === "short-date" &&
    (!a.inferredYearMatched || !b.inferredYearMatched)
  ) {
    const aMonth = a.timestamp ? Number.parseInt(a.timestamp.slice(0, 2), 10) : NaN;
    const bMonth = b.timestamp ? Number.parseInt(b.timestamp.slice(0, 2), 10) : NaN;
    if ((aMonth === 12 && bMonth === 1) || (aMonth === 1 && bMonth === 12)) {
      return false;
    }
  }
  if (a.timestampKind === "time-only" && Math.abs(a.timestampMs - b.timestampMs) > 12 * 60 * 60 * 1000) {
    return false;
  }
  return true;
}

function compareTimestampOrder(
  a: Pick<ParsedLogLine, "timestampMs" | "timestampSubMs" | "lineNumber">,
  b: Pick<ParsedLogLine, "timestampMs" | "timestampSubMs" | "lineNumber">,
): number {
  const aMs = a.timestampMs!;
  const bMs = b.timestampMs!;
  if (aMs !== bMs) return aMs - bMs;
  if (a.timestampSubMs !== b.timestampSubMs) return a.timestampSubMs - b.timestampSubMs;
  return a.lineNumber - b.lineNumber;
}

function isStrictlyEarlierTimestamp(
  a: Pick<
    ParsedLogLine,
    | "timestamp"
    | "timestampMs"
    | "timestampSubMs"
    | "timestampKind"
    | "hasExplicitTimezone"
    | "inferredYearMatched"
  >,
  b: Pick<
    ParsedLogLine,
    | "timestamp"
    | "timestampMs"
    | "timestampSubMs"
    | "timestampKind"
    | "hasExplicitTimezone"
    | "inferredYearMatched"
  >,
): boolean {
  if (!areTimestampsComparable(a, b)) return false;
  if (a.timestampMs! !== b.timestampMs!) return a.timestampMs! < b.timestampMs!;
  return a.timestampSubMs < b.timestampSubMs;
}

function areLinesInSameExecutionScope(a: ParsedLogLine, b: ParsedLogLine, maxUnscopedGap = 25): boolean {
  if (!areCausalDomainsCompatible(a, b)) return false;
  if (a.tracebackGroupId !== null && b.tracebackGroupId !== null) {
    return a.tracebackGroupId === b.tracebackGroupId;
  }
  if (a.segmentId !== b.segmentId) return false;
  if (a.timestampMs !== null && b.timestampMs !== null) {
    if (!areTimestampsComparable(a, b) || Math.abs(a.timestampMs - b.timestampMs) > 60 * 1000) {
      return false;
    }
  }
  if (a.rank !== null && b.rank !== null) {
    if (a.rank !== b.rank) return false;
    if (a.pid !== null && b.pid !== null && a.pid !== b.pid) return false;
    if (a.timestampMs === null || b.timestampMs === null) {
      return Math.abs(a.lineNumber - b.lineNumber) <= 50;
    }
    return true;
  }
  if (a.pid !== null && b.pid !== null) {
    if (a.pid !== b.pid) return false;
    if (a.timestampMs === null || b.timestampMs === null) {
      return Math.abs(a.lineNumber - b.lineNumber) <= 50;
    }
    return true;
  }
  if (a.rank !== null || b.rank !== null || a.pid !== null || b.pid !== null) {
    return false;
  }
  return Math.abs(a.lineNumber - b.lineNumber) <= maxUnscopedGap;
}

interface CompileFaultSegBucket {
  all: DomainIndexedBucket;
  byPid: Map<
    number,
    { all: DomainIndexedBucket; byRank: Map<number, DomainIndexedBucket>; noRank: DomainIndexedBucket }
  >;
  byRankNoPid: Map<number, DomainIndexedBucket>;
  byRank: Map<number, DomainIndexedBucket>;
  unscoped: DomainIndexedBucket;
}

function findUniversalStartupCutoffWindow(
  startupBucket: DomainIndexedBucket | undefined,
  line: ParsedLogLine,
): {
  before: ParsedLogLine | null;
  after: ParsedLogLine | null;
  beforeLine: number;
  afterLine: number;
} {
  if (!startupBucket || startupBucket.all.bySeg.size === 0) {
    return { before: null, after: null, beforeLine: -1, afterLine: Number.POSITIVE_INFINITY };
  }
  const split = getStartupRankSplit(startupBucket);
  const rankDbs: DomainIndexedBucket[] = [split.noRank];
  if (line.rank !== null) {
    const rb = split.byRank.get(line.rank);
    if (rb) rankDbs.push(rb);
  }
  let before: ParsedLogLine | null = null;
  let after: ParsedLogLine | null = null;
  let beforeLine = -1;
  let afterLine = Number.POSITIVE_INFINITY;
  const tierKey = line.timestampMs !== null ? getLifecycleTierKey(line) : -1;

  for (const db of rankDbs) {
    if (db.all.allByLine.length === 0) continue;
    for (const sub of queryCoveringDomCube(getTieredDomCube(db), line)) {
      if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
      if (line.timestampMs !== null) {
        const arr = sub.byTier.get(tierKey);
        if (arr && arr.length > 0) {
          const bPos = findRightmostTrue(arr, (s) => compareTimestampOrder(s, line) < 0);
          if (bPos >= 0) {
            const cand = arr[bPos]!;
            if (areTimestampsComparable(line, cand) && (!before || compareTimestampOrder(cand, before) > 0)) {
              before = cand;
            }
          }
          const aPos = findRightmostTrue(arr, (s) => compareTimestampOrder(s, line) <= 0) + 1;
          if (aPos < arr.length) {
            const cand = arr[aPos]!;
            if (areTimestampsComparable(line, cand) && (!after || compareTimestampOrder(cand, after) < 0)) {
              after = cand;
            }
          }
        }
      }
      const segArr = sub.bySeg.get(line.segmentId);
      if (segArr && segArr.length > 0) {
        const lb = findRightmostTrue(segArr, (s) => s.lineNumber < line.lineNumber);
        if (lb >= 0 && segArr[lb]!.lineNumber > beforeLine) {
          beforeLine = segArr[lb]!.lineNumber;
        }
        const la = findRightmostTrue(segArr, (s) => s.lineNumber <= line.lineNumber) + 1;
        if (la < segArr.length && segArr[la]!.lineNumber < afterLine) {
          afterLine = segArr[la]!.lineNumber;
        }
      }
    }
  }
  return { before, after, beforeLine, afterLine };
}

function hasHbmOomInLineScope(line: ParsedLogLine, ctx?: LineScopeContext): boolean {
  if (!ctx || ctx.hbmOomLines.length === 0) return false;
  const cached = ctx.hbmOomScopeMemo.get(line.lineNumber);
  if (cached !== undefined) return cached;
  const matchesOther = (oomLine: ParsedLogLine): boolean =>
    oomLine.lineNumber !== line.lineNumber &&
    areLinesInSameExecutionScope(line, oomLine, 20) &&
    (line.tracebackGroupId !== null && line.tracebackGroupId === oomLine.tracebackGroupId
      ? true
      : !hasStartupBoundaryBetween(ctx.startupBoundaryBucket, line, oomLine));
  let res = false;
  if (line.tracebackGroupId !== null) {
    const tbPool = ctx.hbmOomByTbGroup.get(line.tracebackGroupId);
    if (tbPool?.some(matchesOther)) res = true;
  }
  if (!res) {
    const win = findUniversalStartupCutoffWindow(ctx.startupBoundaryBucket, line);
    const maxBeforeMs =
      line.timestampMs !== null && win.before !== null
        ? Math.min(60_000, Math.max(0, line.timestampMs - win.before.timestampMs!))
        : 60_000;
    const maxAfterMs =
      line.timestampMs !== null && win.after !== null
        ? Math.min(60_000, Math.max(0, win.after.timestampMs! - line.timestampMs))
        : 60_000;
    const breakOnStartup = (cand: ParsedLogLine): boolean => {
      if (line.timestampMs !== null && cand.timestampMs !== null) {
        if (
          win.before &&
          areTimestampsComparable(cand, win.before) &&
          compareTimestampOrder(cand, win.before) <= 0
        ) {
          return true;
        }
      }
      if (cand.segmentId === line.segmentId && win.beforeLine >= 0 && cand.lineNumber <= win.beforeLine) {
        if (line.timestampMs === null || cand.timestampMs === null || !areTimestampsComparable(line, cand)) {
          return true;
        }
      }
      return false;
    };
    const matchInWin = (oomLine: ParsedLogLine): boolean => {
      if (win.after && oomLine.timestampMs !== null && areTimestampsComparable(oomLine, win.after)) {
        if (compareTimestampOrder(oomLine, win.after) >= 0) return false;
      }
      return matchesOther(oomLine);
    };
    const oomLookupOpts: TimedDomainLookupOptions = {
      restrictToSegLineDist: line.rank === null && line.pid === null && line.tracebackGroupId === null,
      allowCrossTimestampSegLineDist: line.rank === null && line.pid === null ? 20 : 50,
      upperBoundCand: win.after,
    };
    if (line.pid !== null) {
      res =
        someInTimedDomainBucket(
          ctx.hbmOomByPid.get(line.pid),
          line,
          maxBeforeMs,
          maxAfterMs,
          50,
          matchInWin,
          false,
          breakOnStartup,
          oomLookupOpts,
        ) ||
        (line.rank !== null &&
          someInTimedDomainBucket(
            ctx.hbmOomByRankNoPid.get(line.rank),
            line,
            maxBeforeMs,
            maxAfterMs,
            50,
            matchInWin,
            false,
            breakOnStartup,
            oomLookupOpts,
          ));
    } else if (line.rank !== null) {
      res = someInTimedDomainBucket(
        ctx.hbmOomByRank.get(line.rank),
        line,
        maxBeforeMs,
        maxAfterMs,
        50,
        matchInWin,
        false,
        breakOnStartup,
        oomLookupOpts,
      );
    } else {
      res = someInTimedDomainBucket(
        ctx.hbmOomUnscopedBySeg.get(line.segmentId),
        line,
        maxBeforeMs,
        maxAfterMs,
        20,
        matchInWin,
        false,
        breakOnStartup,
        oomLookupOpts,
      );
    }
  }
  ctx.hbmOomScopeMemo.set(line.lineNumber, res);
  return res;
}

function isCompileSuppressedForLine(line: ParsedLogLine, ctx?: LineScopeContext): boolean {
  if (!ctx || ctx.compileFaultLines.length === 0) return false;
  const cached = ctx.compileSuppressedMemo.get(line.lineNumber);
  if (cached !== undefined) return cached;
  const segRec = ctx.compileFaultBySeg.get(line.segmentId);
  if (!segRec) {
    ctx.compileSuppressedMemo.set(line.lineNumber, false);
    return false;
  }
  const pred = (cf: ParsedLogLine): boolean => areLinesInSameExecutionScope(line, cf, 25);
  const compileLookupOpts: TimedDomainLookupOptions = {
    restrictToSegLineDist: line.rank === null && line.pid === null && line.tracebackGroupId === null,
    allowCrossTimestampSegLineDist: line.rank === null && line.pid === null ? 25 : 50,
  };
  let res = false;
  if (line.pid !== null) {
    const pidRec = segRec.byPid.get(line.pid);
    if (pidRec) {
      if (line.rank !== null) {
        res =
          someInTimedDomainBucket(
            pidRec.byRank.get(line.rank),
            line,
            60_000,
            60_000,
            50,
            pred,
            false,
            undefined,
            compileLookupOpts,
          ) ||
          someInTimedDomainBucket(
            pidRec.noRank,
            line,
            60_000,
            60_000,
            50,
            pred,
            false,
            undefined,
            compileLookupOpts,
          );
      } else {
        res = someInTimedDomainBucket(
          pidRec.all,
          line,
          60_000,
          60_000,
          50,
          pred,
          false,
          undefined,
          compileLookupOpts,
        );
      }
    }
    if (!res && line.rank !== null) {
      res = someInTimedDomainBucket(
        segRec.byRankNoPid.get(line.rank),
        line,
        60_000,
        60_000,
        50,
        pred,
        false,
        undefined,
        compileLookupOpts,
      );
    }
  } else if (line.rank !== null) {
    res = someInTimedDomainBucket(
      segRec.byRank.get(line.rank),
      line,
      60_000,
      60_000,
      50,
      pred,
      false,
      undefined,
      compileLookupOpts,
    );
  } else {
    res = someInTimedDomainBucket(
      segRec.unscoped,
      line,
      60_000,
      60_000,
      25,
      pred,
      false,
      undefined,
      compileLookupOpts,
    );
  }
  ctx.compileSuppressedMemo.set(line.lineNumber, res);
  return res;
}

const CANN_ENV_STREAM_OR_DUMP_RE =
  /\b(?:107005|RT_ERROR_STREAM_MODEL)\b|\[AdxDataDumpServer\]\s*\[Init\]\s*dump server run failed/i;

function isCannDriverOrDeviceEnvLine(line: ParsedLogLine, ctx?: LineScopeContext): boolean {
  const inspect = line.inspectLine;
  if (!hasFailureSemantics(inspect)) return false;
  if (/Check ascend device type failed|\bSOC_VERSION\b[^\r\n]{0,96}mismatch/i.test(inspect)) return false;
  if (!isBenignDocumentationOrHelpLine(inspect) && /\bCannot find any model weights\b/i.test(inspect)) {
    return true;
  }
  if (CANN_DRIVER_DEVICE_ENV_CORE_RE.test(inspect)) return true;
  const sanitized = stripLogIdFieldsForErrorCodes(inspect);
  if (CANN_ENV_STREAM_OR_DUMP_RE.test(sanitized) && !hasBenignZeroStatusOnly(inspect)) {
    return true;
  }
  if (
    EL0004_MEM_ALLOC_RE.test(inspect) &&
    !/NPU out of memory|ACL_ERROR_RT_MEMORY_ALLOCATION|OutOfMemoryError/i.test(inspect) &&
    !hasHbmOomInLineScope(line, ctx)
  ) {
    return true;
  }
  return false;
}

const SLEEP_FRACTAL_NZ_ERROR_RE =
  /FRACTAL_NZ mode is enabled|(?:Invocation of|Call to) wake_up method failed[^\r\n]{0,160}FRACTAL_NZ|Please set weight_nz_mode=0/i;

const GQA_STATIC_C8_KV_RE =
  /The current GQA[-\u2010-\u2015\s]related models adopt static quantization|KV quantization is configured via [`'"]?--kv[-\u2010-\u2015]cache[-\u2010-\u2015]dtype[`'"]?[^\r\n]{0,160}quantized weights are required/i;

const MOONCAKE_ADXL_FALLBACK_RE =
  /Dest buffer device_id(?:\s*=\s*\d+)?\s*>=\s*endpoint count\b|Dest buffer device_id[^\r\n]{0,160}\bfalling back\b/i;

function isMooncakeAdxlFallbackLine(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  if (isBenignDocumentationOrHelpLine(inspect)) return false;
  if (/\bdirect transfer completed\b|\bdevice_id(?:\s*=\s*\d+)?\s*<\s*endpoint count\b/i.test(inspect)) {
    return false;
  }
  return MOONCAKE_ADXL_FALLBACK_RE.test(inspect);
}

const DEBUG_LOGGING_HOTPATH_RE =
  /\bVLLM_LOGGING_LEVEL\s*[:=]\s*['"]?DEBUG['"]?\b|\bDEBUG\b[^\r\n]{0,160}\btorch reserved memory:\s*[\d.]+\s*GiB,\s*torch allocated memory:\s*[\d.]+\s*GiB|\bDEBUG\b[^\r\n]{0,160}\bRunning batch with cudagraph_mode:\s*(?:FULL|PIECEWISE)\b/i;

function isDebugLoggingHotpathLine(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  if (isBenignDocumentationOrHelpLine(inspect)) return false;
  const masked = inspect
    .replace(
      /(?:without|previous(?:ly)?|old|was|instead\s+of|not|please\s+set|try\s+setting|to\s+enable\s+tracing[,\s]+(?:please\s+)?set|run\s+with)\s+VLLM_LOGGING_LEVEL\s*[:=]\s*['"]?DEBUG['"]?/gi,
      " ",
    )
    .replace(/\([^)\r\n]{0,128}previous[^)\r\n]{0,128}VLLM_LOGGING_LEVEL[^)\r\n]{0,128}\)/gi, " ");
  if (
    /\bVLLM_LOGGING_LEVEL\s*[:=]\s*['"]?(?:INFO|WARN|WARNING|ERROR|CRITICAL|OFF|DISABLED)['"]?\b/i.test(
      masked,
    )
  ) {
    const withoutLevelSetting = masked.replace(/\bVLLM_LOGGING_LEVEL\s*[:=]\s*['"]?\w+['"]?/gi, " ");
    return DEBUG_LOGGING_HOTPATH_RE.test(withoutLevelSetting);
  }
  return DEBUG_LOGGING_HOTPATH_RE.test(masked);
}

const MOONCAKE_EXPLICIT_PD_ERROR_RE =
  /Mooncake worker requires|Prefill TP size must be divisible by Decode TP size|MooncakeConnector\w*\b[^'\r\n]{0,40}\b(?:does not support|not supported|unsupported|failed|error|timeout|refused)|(?:ValueError|RuntimeError|AssertionError|ERROR)\b[^\r\n]{0,160}\bMooncakeConnector|\bmooncake\b(?![^\r\n]{0,160}kv_load_failure_policy)[^\r\n]{0,48}\b(?:failed|error|handshake\s+(?:failed|error|timeout)|refused|timeout)\b/i;

const MOONCAKE_RDMA_ERROR_RE =
  /\bRDMA\b[^\r\n]{0,48}\b(?:init\s+failed|register\s+failed|failed|error(?!\s*=\s*0\b)|timeout)\b/i;

function isMooncakePdErrorLine(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  if (!hasFailureSemantics(inspect)) return false;
  if (
    /\b(?:mooncake\s+metrics(?:\s+server)?|prometheus|metrics\s+endpoint|scrape\s+metrics)\b/i.test(
      inspect,
    ) ||
    (/\bHTTP\s+(?:connection|client|get|post|request)\b/i.test(inspect) &&
      /\bmetrics\b/i.test(inspect) &&
      !/\bMooncakeConnector\w*\b|\bkv_transfer\b|\bkv_role\b|\bhandshake\b/i.test(inspect))
  ) {
    return false;
  }
  if (MOONCAKE_EXPLICIT_PD_ERROR_RE.test(inspect)) return true;
  if (
    /\b(?:HCCL|HCCP|hccn_tool|RaSocket\w*|ProcessGroupHCCL|HostCpuRoceChannel|ibv_post_send)\b/i.test(
      inspect,
    ) &&
    !/\b(?:MooncakeConnector\w*|mooncake|kv_transfer|kv_role|adxl)\b/i.test(inspect)
  ) {
    return false;
  }
  return (
    MOONCAKE_RDMA_ERROR_RE.test(inspect) &&
    /\b(?:mooncake|adxl|kv[\s_-]*transfer|kv[\s_-]*role|transfer[\s_-]*engine|disaggregat)/i.test(inspect)
  );
}

const ASCEND_LINE_CONTEXT_RE = /\b(?:NPU|cann|hccl|acl|torch_npu|vllm_ascend|Ascend\d*|ACL_ERROR_RT_)\b/i;

function matchScopedAscendCandidate(
  line: ParsedLogLine,
  cand: ParsedLogLine,
  ambiguousDomainPids: ReadonlySet<number>,
): boolean {
  if (!areCausalDomainsCompatible(line, cand)) return false;
  if (line.tracebackGroupId !== null && cand.tracebackGroupId !== null) {
    if (line.tracebackGroupId !== cand.tracebackGroupId) return false;
  } else if (line.segmentId !== cand.segmentId) {
    return false;
  }
  if (line.timestampMs !== null && cand.timestampMs !== null) {
    if (!areTimestampsComparable(line, cand)) return false;
    const delta = line.timestampMs - cand.timestampMs;
    if (delta < -5000 || delta > 10 * 60 * 1000) return false;
  }
  if (line.rank !== null && cand.rank !== null && line.rank !== cand.rank) return false;
  if (line.pid !== null && cand.pid !== null) {
    if (line.pid !== cand.pid) return false;
    if (ambiguousDomainPids.has(line.pid)) {
      const sameExactDomain =
        (line.hostTag ?? "").toLowerCase() === (cand.hostTag ?? "").toLowerCase() &&
        (line.instanceTag ?? "").toLowerCase() === (cand.instanceTag ?? "").toLowerCase() &&
        (line.groupTag ?? "").toLowerCase() === (cand.groupTag ?? "").toLowerCase();
      if (!sameExactDomain || line.hostTag === null) return false;
    }
    return true;
  }
  if (line.tracebackGroupId !== null && cand.tracebackGroupId !== null) {
    return true;
  }
  if (line.pid !== null || cand.pid !== null) {
    return false;
  }
  if (line.rank !== null && cand.rank !== null) {
    return line.rank === cand.rank;
  }
  return false;
}

function hasScopedAscendContext(line: ParsedLogLine, ctx?: LineScopeContext): boolean {
  if (ASCEND_LINE_CONTEXT_RE.test(line.inspectLine)) return true;
  if (!ctx || ctx.ascendContextLines.length === 0) return false;
  const cached = ctx.ascendScopeMemo.get(line.lineNumber);
  if (cached !== undefined) return cached;
  let result = false;
  const matchCand = (cand: ParsedLogLine): boolean =>
    matchScopedAscendCandidate(line, cand, ctx.ambiguousDomainPids);
  if (line.pid !== null) {
    result = someInTimedDomainBucket(
      ctx.ascendByPid.get(line.pid),
      line,
      10 * 60 * 1000,
      5000,
      Number.POSITIVE_INFINITY,
      matchCand,
      true,
    );
  } else {
    const tbList =
      line.tracebackGroupId !== null ? ctx.ascendByTbGroup.get(line.tracebackGroupId) : undefined;
    result =
      Boolean(tbList?.some(matchCand)) ||
      (line.rank !== null &&
        someInTimedDomainBucket(
          ctx.ascendByRankNoPid.get(line.rank),
          line,
          10 * 60 * 1000,
          5000,
          Number.POSITIVE_INFINITY,
          matchCand,
          true,
        ));
  }
  ctx.ascendScopeMemo.set(line.lineNumber, result);
  return result;
}

const NON_NPU_EXPLICIT_OOM_RE =
  /\b(?:DefaultCPUAllocator|CPUAllocator|HostAllocator|PinnedMemoryAllocator|CPU(?:\s+allocator)?|HIP|ROCm|MPS|Metal|XPU|Vulkan|DirectML|RAM|DRAM|host\s+(?:allocator|memory|side))\b[^\r\n]{0,128}\b(?:out of memory|not enough memory|can't allocate memory|failed to allocate)\b|\bhost\s+(?:out of memory|not enough memory|can't allocate memory|failed to allocate)\b|torch\.(?:mps|xpu)\.OutOfMemoryError|\bHIP\s+\d+\s*;[^\r\n]{0,64}out of memory/i;

function isNpuOomLine(line: ParsedLogLine, ctx?: LineScopeContext): boolean {
  if (line.isPromLine || line.trimmed.startsWith("#") || isPromExpositionLine(line.trimmed)) return false;
  if (ctx?.hbmOomLineNumbers) return ctx.hbmOomLineNumbers.has(line.lineNumber);
  const inspect = stripBenignNegatedClauses(line.inspectLine);
  if (line.tracebackGroupId !== null && isTracebackScaffoldLine(line.inspectLine)) return false;
  if (isBenignDocumentationOrHelpLine(inspect) || isBenignNegatedCheckInfoLine(line.inspectLine))
    return false;
  if (hasNullOrZeroExceptionValueOnly(inspect)) return false;
  if (!/NPU out of memory|ACL_ERROR_RT_MEMORY_ALLOCATION|OutOfMemoryError/i.test(inspect)) {
    return false;
  }
  if (
    !hasLogErrorSeverity(inspect) &&
    /\b(?:out\s+of\s+memory|OutOfMemoryError|OOM)\s*[:=]\s*(?:0|false|none|null|nil|no|ok)\b/i.test(inspect)
  ) {
    return false;
  }
  if (
    /\b(?:INFO|DEBUG)\b/i.test(inspect) &&
    !/NPU out of memory|ACL_ERROR_RT_MEMORY_ALLOCATION|OutOfMemoryError\s*:/i.test(inspect)
  ) {
    return false;
  }
  if (NON_NPU_EXPLICIT_OOM_RE.test(inspect)) return false;
  if (
    /\bCUDA\b[^\r\n]{0,40}\bout of memory\b|torch\.cuda\.OutOfMemoryError|\bGPU\s+\d+\s*;[^\r\n]{0,64}out of memory/i.test(
      inspect,
    )
  ) {
    return hasScopedAscendContext(line, ctx);
  }
  if (
    /\bNPU\s+out of memory\b|\bACL_ERROR_RT_MEMORY_ALLOCATION\b|\btorch\.npu\.OutOfMemoryError\b/i.test(
      inspect,
    )
  ) {
    return true;
  }
  return hasScopedAscendContext(line, ctx);
}

const SIGKILL_EXIT_RE =
  /\b(?:exit\s*code|returncode|status)\s*[:=\s]+(?:137|-9)\b|\bSIGKILL\b|\bOOMKilled\b|Out of memory:\s*Killed process/i;

const SIGSEGV_EXIT_RE =
  /\b(?:exit\s*code|returncode|status)\s*[:=\s]+(?:139|-11)\b|\bSIGSEGV\b|Segmentation fault/i;

function isSigkillLine(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  const masked = inspect.replace(/\b(?:OOMKilled|SIGKILL)\s*[:=]\s*(?:0|false)\b/gi, " ");
  if (!SIGKILL_EXIT_RE.test(masked)) return false;
  if (
    /\b(?:INFO|DEBUG)\b/i.test(masked) &&
    !/\b(?:exit\s*code|returncode|status)\s*[:=\s]+(?:137|-9)\b|Out of memory:\s*Killed process|terminated\s+by\s+signal\s+SIGKILL\b/i.test(
      masked,
    )
  ) {
    return false;
  }
  if (
    /\b(?:installed|register(?:ing|ed)|setup|sending)\s+SIGKILL\b/i.test(masked) &&
    !/\b(?:exit\s*code|returncode|status)\s*[:=\s]+(?:137|-9)\b|\bOOMKilled\b|Out of memory:\s*Killed process|terminated\s+by\s+signal\s+SIGKILL\b/i.test(
      masked,
    )
  ) {
    return false;
  }
  return true;
}

function isSigsegvLine(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  if (!SIGSEGV_EXIT_RE.test(inspect)) return false;
  if (/\bSIGSEGV\s*[:=]\s*(?:0|false)\b/i.test(inspect)) return false;
  if (
    /\b(?:installed|register(?:ing|ed)|setup|handling|sending)\s+SIGSEGV\b|\bSIGSEGV\s+handler\b/i.test(
      inspect,
    )
  ) {
    return false;
  }
  if (
    /\b(?:INFO|DEBUG)\b/i.test(inspect) &&
    !/\b(?:exit\s*code|returncode|status)\s*[:=\s]+(?:139|-11)\b|Segmentation fault|terminated\s+by\s+signal\s+SIGSEGV\b|\bcore\s+dumped\b/i.test(
      inspect,
    )
  ) {
    return false;
  }
  return true;
}

const STREAM_CAPTURE_CODE_RE =
  /\b(?:107024|107025)\b|\bACL_ERROR_RT_STREAM_CAPTURE\b|\b(?:rtStreamEndCapture|AclmdlRICaptureEnd|rtStreamWaitEvent)\b[^\r\n]{0,160}\b(?:fail(?:ed)?|error(?!\s*=\s*0\b)|unjoined|missing|capture|107024|107025)\b/i;

const PIECEWISE_SILENT_RESET_RE =
  /\bcudagraph_mode\s*=\s*(?:NONE|PIECEWISE|FULL_AND_PIECEWISE)\b[^\r\n]{0,96}\bincompatible with npugraph_ex[^\r\n]{0,64}\bresetting\b/i;

function isPiecewiseSilentResetLine(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  if (isPromExpositionLine(rawLine.trim())) return false;
  if (isBenignDocumentationOrHelpLine(inspect) || isBenignInfoOrDebugInitLine(inspect)) return false;
  if (/\b(?:INFO|DEBUG)\b(?!\s*\()/i.test(inspect) && !hasLogErrorSeverity(inspect)) return false;
  return PIECEWISE_SILENT_RESET_RE.test(inspect);
}

function isAdvisoryGraphCapabilityWarning(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  if (isPromExpositionLine(rawLine.trim())) return false;
  if (hasLogErrorSeverity(inspect) || hasGenuinePythonException(inspect)) return false;
  if (PIECEWISE_SILENT_RESET_RE.test(inspect)) return false;
  if (
    /\b(?:abort(?:ed)?|crash(?:ed)?|fatal|traceback|BackendCompilerFailed|torch\._dynamo\.exc\.Unsupported|EZ300[23]|107024|107025|107030|ERR03005)\b/i.test(
      inspect,
    )
  ) {
    return false;
  }
  if (
    !/\b(?:WARN(?:ING)?|INFO)\b/i.test(inspect) &&
    !/\bdisabling\s+(?:it|npugraph_ex|aclgraph|torchair)\b|\bfall(?:ing)?\s+back\b/i.test(inspect)
  ) {
    return false;
  }
  return /(?:npugraph_ex is not supported|AscendFAImpl does not support ACL graph capture[^\r\n]{0,96}\bfall(?:ing)?\s+back|(?:aclgraph|acl\s+graph|npugraph_ex|torchair)\b[^\r\n]{0,128}\b(?:disabling\s+it|disabl(?:ed|ing)|fall(?:ing)?\s*back\s+to\s+eager|continuing\s+in\s+eager|(?:not\s+supported|unsupported)[^\r\n]{0,64}\bdisabl))/i.test(
    inspect,
  );
}

function isGraphCaptureFaultLine(line: ParsedLogLine, ctx?: LineScopeContext): boolean {
  const inspect = line.inspectLine;
  if (isPromExpositionLine(line.trimmed)) return false;
  if (isPiecewiseSilentResetLine(inspect)) {
    return hasLogErrorSeverity(inspect) || hasGenuinePythonException(inspect);
  }
  if (!hasFailureSemantics(inspect)) return false;
  if (isAdvisoryGraphCapabilityWarning(inspect)) return false;
  if (isNpuOomLine(line, ctx)) return false;
  if (/\btriton\b[^\r\n]{0,40}\b(?:kernel\s+)?compil|failed during triton\b/i.test(inspect)) {
    return false;
  }
  if (isTorchairGeCompileFaultLine(inspect)) return false;
  const sanitized = inspect.replace(/\btest_[A-Za-z0-9_]+\b/g, " ");
  const sanitizedCodes = stripLogIdFieldsForErrorCodes(sanitized);
  if (STREAM_CAPTURE_CODE_RE.test(sanitizedCodes) && !hasBenignZeroStatusOnly(inspect)) {
    return true;
  }
  if (/AscendFAImpl does not support ACL graph capture|npugraph_ex is not supported/i.test(sanitized)) {
    return true;
  }
  if (
    /\bFULL_DECODE_ONLY\b[^\r\n]{0,160}(?:not\s+support|unsupported|invalid|conflict|incompatible|fail|error)/i.test(
      sanitized,
    )
  ) {
    return true;
  }
  if (
    /(?:aclgraph|acl\s+graph)[^\r\n]{0,60}(?:capture[^\r\n]{0,20}(?:fail|error)|fallback|not\s+supported|unsupported|disable[sd]?|disabling|fail(?:ed|ure)?|error(?!\s*=\s*0\b))/i.test(
      sanitized,
    ) &&
    !/Engine core initialization failed|EngineCore(?:Proc)?\b[^\r\n]{0,50}died unexpectedly/i.test(sanitized)
  ) {
    return true;
  }
  return (
    /capture_model[^\r\n]{0,160}(?:fail|error)/i.test(sanitized) && !isCompileSuppressedForLine(line, ctx)
  );
}

const HCCL_TRANSPORT_RESOURCE_OR_WQE_RE =
  /\bHCCL_E_(?:INTERNAL|UNAVAIL)\b|\bHCCL\s+error:\s*[47]\b|\bibv_post_send\s+failed\b|\bHostCpuRoceChannel\b[^\r\n]{0,128}\b(?:fail(?:ed)?|error(?!\s*=\s*0\b)|unavail|post_send)/i;

const NON_HCCL_LINK_SERVICE_RE =
  /\b(?:Redis|replication|replica|sentinel|mysql|postgres(?:ql)?|mongo(?:db)?|kafka|rabbitmq|grpc|https?|websocket|database|connection\s+pool|serial(?:\s+port)?|ttyS\d+|ttyUSB\d+|usb|COM\d+|uart|bluetooth|audio|hdmi|vga|displayport|i2c|spi|SATA|SAS|NVMe|PCIe?|SCSI|iSCSI)\b/i;

function isBareHccnLinkDownLine(inspect: string): boolean {
  if (NON_HCCL_LINK_SERVICE_RE.test(inspect)) return false;
  if (!/\blink\s+status\s*[:=]\s*DOWN\b/i.test(inspect)) return false;
  if (
    /\b(?:hccn_tool|hccn|HCCL|HCCP|RoCE|RDMA|RaSocket\w*|NPU|eth\d+|enp\w+|ens\w+|ib\d+|bond\d+|nic|optical|sfp|qsfp|transceiver|(?:roce|rdma|npu|hccn|network|eth\d*)\s+port(?:\s+\d+|\s*(?:id|index)\s*[:=#]?\s*\d+)?)\b/i.test(
      inspect,
    )
  ) {
    return true;
  }
  const stripped = stripTracebackLogPrefix(inspect).trim();
  return /^(?:\[[^\]]+\]\s*|\([^)]+\)\s*)*link\s+status\s*[:=]\s*DOWN\b/i.test(stripped);
}

function isHcclLinkPrimaryLine(line: ParsedLogLine, ctx?: LineScopeContext): boolean {
  const inspect = line.inspectLine;
  if (ctx?.hccnDownLines?.has(line.lineNumber)) return true;
  if (!hasFailureSemantics(inspect)) return false;
  if (/\bZMQError\b/i.test(inspect) || isPortConflictLine(inspect)) return false;
  const hasPhysicalOrLocalLinkRoot =
    HCCL_ROCE_PORT_DOWN_RE.test(inspect) ||
    isBareHccnLinkDownLine(inspect) ||
    HCCL_RANKTABLE_INIT_RE.test(inspect) ||
    isExplicitHcclBindFaultLine(inspect) ||
    /No route to host|ENETUNREACH|EHOSTUNREACH|Network is unreachable/i.test(inspect);
  if (
    !hasPhysicalOrLocalLinkRoot &&
    (isPeerRefusedCascadeLine(inspect) || PEER_REFUSED_SIGNAL_RE.test(inspect))
  ) {
    return false;
  }
  if (
    isMooncakePdErrorLine(inspect) &&
    !/\b(?:RaSocket\w*|HCCL|HCCP|EI000\d|EJ000[13]|RoCE|HostCpuRoceChannel|ibv_post_send)\b/i.test(inspect)
  ) {
    return false;
  }
  if (!hasPhysicalOrLocalLinkRoot && inferHcclLinkMechanism(inspect).mechanism === "link-establish-timeout") {
    return false;
  }
  const hasDistributedNetFault =
    DISTRIBUTED_COMM_CONTEXT_RE.test(inspect) && HCCL_DISTRIBUTED_NET_FAULT_RE.test(inspect);
  return (
    HCCL_RANKTABLE_INIT_RE.test(inspect) ||
    HCCL_TRANSPORT_RESOURCE_OR_WQE_RE.test(inspect) ||
    HCCL_RASOCKET_BIND_OR_ROUTE_RE.test(inspect) ||
    isExplicitHcclBindFaultLine(inspect) ||
    hasDistributedNetFault ||
    HCCL_ROCE_PORT_DOWN_RE.test(inspect) ||
    isBareHccnLinkDownLine(inspect)
  );
}

function isHcclLinkEstablishLine(line: ParsedLogLine, ctx?: LineScopeContext): boolean {
  const inspect = line.inspectLine;
  if (!hasFailureSemantics(inspect)) return false;
  if (isPeerRefusedCascadeLine(inspect) || PEER_REFUSED_SIGNAL_RE.test(inspect)) return false;
  if (ZERO_EI_COUNTER_RE.test(inspect) && !NONZERO_EI_COUNTER_RE.test(inspect)) return false;
  if (HCCL_LINK_ESTABLISH_TIMEOUT_RE.test(inspect)) return true;
  if (ctx?.pairedEi0006Lines.has(line.lineNumber)) return true;
  return false;
}

function isHcclLinkOrIfnameLine(line: ParsedLogLine, ctx?: LineScopeContext): boolean {
  return (
    isHcclLinkPrimaryLine(line, ctx) ||
    isHcclLinkEstablishLine(line, ctx) ||
    isPeerRefusedCascadeLine(line.inspectLine)
  );
}

function isHcclTimeoutFaultLine(line: ParsedLogLine, ctx?: LineScopeContext): boolean {
  const inspect = line.inspectLine;
  if (!hasFailureSemantics(inspect)) return false;
  if (isPeerRefusedCascadeLine(inspect) || PEER_REFUSED_SIGNAL_RE.test(inspect)) return false;
  if (isHcclLinkPrimaryLine(line, ctx) || isHcclLinkEstablishLine(line, ctx)) return false;
  if (EXPLICIT_HCCL_WAIT_TIMEOUT_RE.test(inspect)) return true;
  if (BENIGN_HCCL_TIMEOUT_CONFIG_RE.test(inspect) && !hasExplicitTimeoutSeverity(inspect)) {
    return false;
  }
  return HCCL_CONTEXT_TIMEOUT_FAULT_RE.test(inspect);
}

function buildOomLifecycleIndex(oomLifecycleCandidates: readonly ParsedLogLine[]): OomLifecycleIndex {
  const byPid = new Map<number, DomainIndexedBucket>();
  const byRankNoPid = new Map<number, DomainIndexedBucket>();
  const unscopedBySegment = new Map<number, DomainIndexedBucket>();
  const startupMilestones = createDomainIndexedBucket();
  const untimestampedStartups: ParsedLogLine[] = [];
  const runtimeMarkers = createDomainIndexedBucket();
  const peerStartups = createDomainIndexedBucket();

  for (const l of oomLifecycleCandidates) {
    const isStageMilestone =
      matchesRuntimeMilestone(l.inspectLine) ||
      KV_BUDGET_MILESTONE_RE.test(l.rawLine) ||
      POST_KV_MILESTONE_RE.test(l.rawLine) ||
      COLD_START_MILESTONE_RE.test(l.rawLine);
    if (isStageMilestone) {
      if (l.pid !== null) {
        pushToKeyedDomainBucket(byPid, l.pid, l);
      } else if (l.rank !== null) {
        pushToKeyedDomainBucket(byRankNoPid, l.rank, l);
      } else {
        pushToKeyedDomainBucket(unscopedBySegment, l.segmentId, l);
      }
    }
    if (isActualAppStartupCompleteLine(l.inspectLine)) {
      pushToDomainBucket(startupMilestones, l);
      if (l.timestampMs === null) untimestampedStartups.push(l);
    }
    if (matchesRuntimeOomStage(l.inspectLine)) {
      pushToDomainBucket(runtimeMarkers, l);
    }
    if (/Available KV cache memory:\s*[\d.]+\s*(?:GiB|GB|MiB)|Starting load_model/i.test(l.rawLine)) {
      pushToDomainBucket(peerStartups, l);
    }
  }

  for (const b of byPid.values()) finalizeDomainBucket(b);
  for (const b of byRankNoPid.values()) finalizeDomainBucket(b);
  for (const b of unscopedBySegment.values()) finalizeDomainBucket(b);
  finalizeDomainBucket(startupMilestones);
  finalizeDomainBucket(runtimeMarkers);
  finalizeDomainBucket(peerStartups);
  untimestampedStartups.sort((a, b) => a.lineNumber - b.lineNumber);

  return {
    byPid,
    byRankNoPid,
    unscopedBySegment,
    startupMilestones,
    untimestampedStartups,
    runtimeMarkers,
    peerStartups,
  };
}

function pushIndexedLine(map: Map<number, ParsedLogLine[]>, key: number, line: ParsedLogLine): void {
  let arr = map.get(key);
  if (!arr) {
    arr = [];
    map.set(key, arr);
  }
  arr.push(line);
}

function isAbortedExecutionContextLine(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  if (!hasFailureSemantics(inspect)) return false;
  if (/\b107030\b/i.test(stripLogIdFieldsForErrorCodes(inspect)) && /\bmla_preprocess\b/i.test(inspect)) {
    return false;
  }
  if (
    hasGenuinePythonException(inspect) ||
    /\b(?:EngineCore(?:Proc)?\b[^\r\n]{0,50}died unexpectedly|Engine core initialization failed|SIGKILL|SIGSEGV|terminated by signal)\b/i.test(
      inspect,
    ) ||
    /\b(?:exit\s*code|returncode|status)\s*[:=\s]+(?:137|-9|139|-11|1)\b/i.test(inspect)
  ) {
    return true;
  }
  const codes = stripLogIdFieldsForErrorCodes(inspect);
  return /\b(?:507014|507015|507018|507034|507035|207003|107024|107025|ACL_ERROR_RT_AICORE_|ACL_ERROR_RT_VECTOR_CORE_)\w*/i.test(
    codes,
  );
}

function isSameExecutionAbortCorroborationLine(rawLine: string): boolean {
  if (
    /\b(?:FileNotFoundError|IsADirectoryError|PermissionError|JSONDecodeError|KeyError|ModuleNotFoundError|ImportError|NameError|NPU out of memory|ACL_ERROR_RT_MEMORY_ALLOCATION|aclnn\w+|Address already in use|ZMQError|EI0002|HCCL_E_WAIT_TIMEOUT|FRACTAL_NZ|MooncakeConnector|No available memory|Free memory on device|Cannot find any model weights|Check ascend device type failed)\b/i.test(
      rawLine,
    ) &&
    !/\b(?:107030|mla_preprocess|aclgraph)\b/i.test(rawLine)
  ) {
    return false;
  }
  return /\b(?:abort(?:ed|ing)?|died unexpectedly|Engine core initialization failed|SIGKILL|SIGSEGV|terminated by signal|507014|507015|507018|507034|507035|207003|107024|107025|ACL_ERROR_RT_|aclgraph|capture|mla_preprocess|stream|kernel|exec(?:ute|ution)?|aicore|vector\s+core)\b|\b(?:exit\s*code|returncode|status)\s*[:=\s]+(?:137|-9|139|-11|1)\b/i.test(
    rawLine,
  );
}

const PROCESS_EXIT_RESET_RE =
  /\b(?:worker(?:\s+process)?\s+(?:exited(?:\s+normally)?|restarted|stopped|shutting\s+down|shut\s+down)|process\s+(?:exited(?:\s+normally)?|terminated|restarted)|graceful\s+shutdown(?:\s+(?:complete|initiated|started|done))?|shutting\s+down\s+(?:worker|engine|server|process|executor)|(?:EngineCore(?:Proc)?|vLLM)\s+shutting\s+down|terminating\s+workers?)\b|\bshutting\s+down\b(?!\s*(?:=|\w*timeout))/i;

function buildLineScopeContext(
  lines: readonly ParsedLogLine[],
  ambiguousDomainPids: ReadonlySet<number> = new Set<number>(),
): LineScopeContext {
  const ascendContextLines: ParsedLogLine[] = [];
  const ascendByPid = new Map<number, DomainIndexedBucket>();
  const ascendByRankNoPid = new Map<number, DomainIndexedBucket>();
  const ascendByTbGroup = new Map<number, ParsedLogLine[]>();
  const lineIndexByLineNumber = new Map<number, number>();
  const oomLifecycleCandidates: ParsedLogLine[] = [];
  const startupResetBucket = createDomainIndexedBucket();
  const startupBoundaryBucket = createDomainIndexedBucket();
  const processResetBucket = createDomainIndexedBucket();
  const seenLifecycleByScope = new Set<string>();
  const scopeLifecycleKey = (l: ParsedLogLine) =>
    `${(l.hostTag ?? "").toLowerCase()}#${(l.instanceTag ?? "").toLowerCase()}#${(l.groupTag ?? "").toLowerCase()}`;
  const hasPriorLifecycleBaseline = (l: ParsedLogLine): boolean => {
    const h = (l.hostTag ?? "").toLowerCase();
    const inst = (l.instanceTag ?? "").toLowerCase();
    const g = (l.groupTag ?? "").toLowerCase();
    return (
      seenLifecycleByScope.has(`${h}#${inst}#${g}`) ||
      seenLifecycleByScope.has("##") ||
      (h !== "" && seenLifecycleByScope.has(`${h}##`)) ||
      (inst !== "" && seenLifecycleByScope.has(`#${inst}#`)) ||
      (g !== "" && seenLifecycleByScope.has(`##${g}`))
    );
  };
  const modelslimJsonTbGroups = new Set<number>();
  const hccnDownLines = new Set<number>();
  const hccnDeviceByLine = new Map<number, string>();
  const ambiguousDeviceLines = new Set<number>();
  const openHccnCmds: Array<{ line: ParsedLogLine; devId: string }> = [];
  const partnerContextByLine = new Map<number, PartnerLineContext>();
  const mla107030Candidates: ParsedLogLine[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i]!;
    lineIndexByLineNumber.set(l.lineNumber, i);
    if (l.isPromLine || l.trimmed.startsWith("#") || isPromExpositionLine(l.trimmed)) {
      continue;
    }
    const inspect = l.inspectLine;
    if (ASCEND_LINE_CONTEXT_RE.test(inspect)) {
      ascendContextLines.push(l);
      if (l.pid !== null) pushToKeyedDomainBucket(ascendByPid, l.pid, l);
      else if (l.rank !== null) pushToKeyedDomainBucket(ascendByRankNoPid, l.rank, l);
      if (l.tracebackGroupId !== null) pushIndexedLine(ascendByTbGroup, l.tracebackGroupId, l);
    }
    if (
      l.tracebackGroupId !== null &&
      /(?:modelslim_config\.py|quant_model_description\.json|AscendModelSlimConfig)/i.test(inspect)
    ) {
      modelslimJsonTbGroups.add(l.tracebackGroupId);
    }
    if (
      /\b107030\b/.test(stripLogIdFieldsForErrorCodes(inspect)) &&
      /\bmla_preprocess\b/i.test(inspect) &&
      /\b(?:rtMemcpy|graph\s*mode|capture|aclgraph)\b/i.test(inspect)
    ) {
      mla107030Candidates.push(l);
    }
    const isAppStartupComplete = isActualAppStartupCompleteLine(inspect);
    if (isAppStartupComplete || /\bGraph capturing finished\b/i.test(inspect)) {
      pushToDomainBucket(startupResetBucket, l);
    }
    if (isAppStartupComplete) {
      pushToDomainBucket(startupBoundaryBucket, l);
      if (hasPriorLifecycleBaseline(l)) {
        pushToDomainBucket(processResetBucket, l);
      }
      seenLifecycleByScope.add(scopeLifecycleKey(l));
    } else if (
      PROCESS_EXIT_RESET_RE.test(inspect) &&
      !/\b(?:non-default\s+args|shutdown_timeout|graceful_shutdown)\b/i.test(inspect)
    ) {
      pushToDomainBucket(processResetBucket, l);
      seenLifecycleByScope.add(scopeLifecycleKey(l));
    } else if (hasLogErrorSeverity(inspect) || hasGenuinePythonException(inspect)) {
      seenLifecycleByScope.add(scopeLifecycleKey(l));
    }
    if (
      COLD_START_MILESTONE_RE.test(inspect) ||
      KV_BUDGET_MILESTONE_RE.test(inspect) ||
      POST_KV_MILESTONE_RE.test(inspect) ||
      matchesRuntimeMilestone(inspect) ||
      matchesRuntimeOomStage(inspect)
    ) {
      oomLifecycleCandidates.push(l);
    }
    const hccnCmd = /\bhccn_tool\b[^\r\n]{0,128}-i\s*(\d+)\b[^\r\n]{0,128}-link\b/i.exec(inspect);
    if (hccnCmd?.[1]) {
      const devId = hccnCmd[1];
      if (/\blink\s+status\s*[:=]\s*DOWN\b/i.test(inspect)) {
        hccnDownLines.add(l.lineNumber);
        hccnDeviceByLine.set(l.lineNumber, devId);
      } else if (/\blink\s+status\s*[:=]\s*UP\b/i.test(inspect)) {
        for (let idx = openHccnCmds.length - 1; idx >= 0; idx -= 1) {
          const prev = openHccnCmds[idx]!;
          if (
            prev.devId === devId &&
            prev.line.segmentId === l.segmentId &&
            areCausalDomainsCompatible(prev.line, l) &&
            (prev.line.rank === null || l.rank === null || prev.line.rank === l.rank) &&
            (prev.line.pid === null || l.pid === null || prev.line.pid === l.pid)
          ) {
            openHccnCmds.splice(idx, 1);
          }
        }
      } else {
        for (let idx = openHccnCmds.length - 1; idx >= 0; idx -= 1) {
          const prev = openHccnCmds[idx]!;
          if (
            prev.line.segmentId !== l.segmentId ||
            l.lineNumber - prev.line.lineNumber > 4 ||
            (prev.devId === devId &&
              prev.line.rank === l.rank &&
              prev.line.pid === l.pid &&
              (prev.line.hostTag ?? "").toLowerCase() === (l.hostTag ?? "").toLowerCase() &&
              (prev.line.instanceTag ?? "").toLowerCase() === (l.instanceTag ?? "").toLowerCase() &&
              (prev.line.groupTag ?? "").toLowerCase() === (l.groupTag ?? "").toLowerCase())
          ) {
            openHccnCmds.splice(idx, 1);
          }
        }
        openHccnCmds.push({ line: l, devId });
      }
    } else if (/\blink\s+status\s*[:=]\s*UP\b/i.test(inspect)) {
      const matchingUpIndices: number[] = [];
      for (let idx = openHccnCmds.length - 1; idx >= 0; idx -= 1) {
        const prev = openHccnCmds[idx]!;
        if (prev.line.segmentId !== l.segmentId || l.lineNumber - prev.line.lineNumber > 4) {
          openHccnCmds.splice(idx, 1);
          continue;
        }
        if (
          areCausalDomainsCompatible(prev.line, l) &&
          (prev.line.rank === null || l.rank === null || prev.line.rank === l.rank) &&
          (prev.line.pid === null || l.pid === null || prev.line.pid === l.pid)
        ) {
          matchingUpIndices.push(idx);
        }
      }
      if (matchingUpIndices.length > 0) {
        const firstUp = openHccnCmds[matchingUpIndices[0]!]!;
        const allUpAgree = matchingUpIndices.every((idx) => {
          const c = openHccnCmds[idx]!;
          return (
            c.devId === firstUp.devId &&
            c.line.rank === firstUp.line.rank &&
            c.line.pid === firstUp.line.pid &&
            (c.line.hostTag ?? null) === (firstUp.line.hostTag ?? null) &&
            (c.line.instanceTag ?? null) === (firstUp.line.instanceTag ?? null) &&
            (c.line.groupTag ?? null) === (firstUp.line.groupTag ?? null)
          );
        });
        if (allUpAgree) {
          for (const idx of matchingUpIndices) {
            openHccnCmds.splice(idx, 1);
          }
        }
      }
    } else if (
      !NON_HCCL_LINK_SERVICE_RE.test(inspect) &&
      /^\s*(?:[^\r\n]{0,120}\b)?link\s+status\s*[:=]\s*DOWN\b/i.test(inspect)
    ) {
      const compatibleCmds: Array<{ idx: number; line: ParsedLogLine; devId: string }> = [];
      for (let idx = openHccnCmds.length - 1; idx >= 0; idx -= 1) {
        const prev = openHccnCmds[idx]!;
        if (prev.line.segmentId !== l.segmentId || l.lineNumber - prev.line.lineNumber > 4) {
          openHccnCmds.splice(idx, 1);
          continue;
        }
        if (
          areCausalDomainsCompatible(prev.line, l) &&
          (prev.line.rank === null || l.rank === null || prev.line.rank === l.rank) &&
          (prev.line.pid === null || l.pid === null || prev.line.pid === l.pid)
        ) {
          compatibleCmds.push({ idx, line: prev.line, devId: prev.devId });
        }
      }
      if (compatibleCmds.length > 0) {
        hccnDownLines.add(l.lineNumber);
        const firstCmd = compatibleCmds[0]!;
        const allAgree = compatibleCmds.every(
          (c) =>
            c.devId === firstCmd.devId &&
            c.line.rank === firstCmd.line.rank &&
            c.line.pid === firstCmd.line.pid &&
            (c.line.hostTag ?? null) === (firstCmd.line.hostTag ?? null) &&
            (c.line.instanceTag ?? null) === (firstCmd.line.instanceTag ?? null) &&
            (c.line.groupTag ?? null) === (firstCmd.line.groupTag ?? null),
        );
        if (allAgree) {
          hccnDeviceByLine.set(l.lineNumber, firstCmd.devId);
          partnerContextByLine.set(l.lineNumber, {
            rank: l.rank ?? firstCmd.line.rank,
            rankSource: l.rank !== null ? l.rankSource : firstCmd.line.rankSource,
            hostTag: l.hostTag ?? firstCmd.line.hostTag,
            instanceTag: l.instanceTag ?? firstCmd.line.instanceTag,
            groupTag: l.groupTag ?? firstCmd.line.groupTag,
            pid: l.pid ?? firstCmd.line.pid,
            peerRank: extractPeerRankFromLine(inspect) ?? extractPeerRankFromLine(firstCmd.line.inspectLine),
            timestamp: l.timestamp ?? firstCmd.line.timestamp,
            timestampMs: l.timestamp !== null ? l.timestampMs : firstCmd.line.timestampMs,
            timestampSubMs: l.timestamp !== null ? l.timestampSubMs : firstCmd.line.timestampSubMs,
            timestampKind: l.timestamp !== null ? l.timestampKind : firstCmd.line.timestampKind,
            hasExplicitTimezone:
              l.timestamp !== null ? l.hasExplicitTimezone : firstCmd.line.hasExplicitTimezone,
            inferredYearMatched:
              l.timestamp !== null ? l.inferredYearMatched : firstCmd.line.inferredYearMatched,
          });
        } else if (compatibleCmds.some((c) => c.devId !== firstCmd.devId)) {
          ambiguousDeviceLines.add(l.lineNumber);
        }
        for (const c of compatibleCmds) {
          openHccnCmds.splice(c.idx, 1);
        }
      }
    }
  }

  for (const b of ascendByPid.values()) finalizeDomainBucket(b);
  for (const b of ascendByRankNoPid.values()) finalizeDomainBucket(b);
  finalizeDomainBucket(startupResetBucket);
  finalizeDomainBucket(startupBoundaryBucket);
  finalizeDomainBucket(processResetBucket);

  const nonfatal107030Lines = new Set<number>();
  if (mla107030Candidates.length > 0) {
    const abortByRank = new Map<number, DomainIndexedBucket>();
    const abortByRankNoPid = new Map<number, DomainIndexedBucket>();
    const abortByPid = new Map<
      number,
      { all: DomainIndexedBucket; byRank: Map<number, DomainIndexedBucket>; noRank: DomainIndexedBucket }
    >();
    const abortByTbGroup = new Map<number, ParsedLogLine[]>();
    const abortUnscopedBySeg = new Map<number, DomainIndexedBucket>();
    for (const l of lines) {
      if (l.isPromLine || l.trimmed.startsWith("#") || isPromExpositionLine(l.trimmed)) continue;
      if (!isAbortedExecutionContextLine(l.inspectLine)) continue;
      if (l.tracebackGroupId !== null) pushIndexedLine(abortByTbGroup, l.tracebackGroupId, l);
      if (!isSameExecutionAbortCorroborationLine(l.inspectLine)) continue;
      if (l.pid !== null) {
        let pRec = abortByPid.get(l.pid);
        if (!pRec) {
          pRec = {
            all: createDomainIndexedBucket(),
            byRank: new Map(),
            noRank: createDomainIndexedBucket(),
          };
          abortByPid.set(l.pid, pRec);
        }
        pushToDomainBucket(pRec.all, l);
        if (l.rank !== null) pushToKeyedDomainBucket(pRec.byRank, l.rank, l);
        else pushToDomainBucket(pRec.noRank, l);
      } else if (l.rank !== null) {
        pushToKeyedDomainBucket(abortByRankNoPid, l.rank, l);
      }
      if (l.rank !== null) pushToKeyedDomainBucket(abortByRank, l.rank, l);
      if (l.rank === null && l.pid === null) pushToKeyedDomainBucket(abortUnscopedBySeg, l.segmentId, l);
    }
    for (const pRec of abortByPid.values()) {
      finalizeDomainBucket(pRec.all);
      finalizeDomainBucket(pRec.noRank);
      for (const b of pRec.byRank.values()) finalizeDomainBucket(b);
    }
    for (const b of abortByRankNoPid.values()) finalizeDomainBucket(b);
    for (const b of abortByRank.values()) finalizeDomainBucket(b);
    for (const b of abortUnscopedBySeg.values()) finalizeDomainBucket(b);

    const matchAbortCandidate = (mlaLine: ParsedLogLine, ab: ParsedLogLine): boolean => {
      if (ab.lineNumber === mlaLine.lineNumber) return false;
      if (!areCausalDomainsCompatible(mlaLine, ab)) return false;
      if (mlaLine.rank !== null && ab.rank !== null && mlaLine.rank !== ab.rank) return false;
      if (mlaLine.pid !== null && ab.pid !== null && mlaLine.pid !== ab.pid) return false;
      if (mlaLine.segmentId !== ab.segmentId) return false;
      const shareTb = mlaLine.tracebackGroupId !== null && mlaLine.tracebackGroupId === ab.tracebackGroupId;
      if (!shareTb) {
        if (mlaLine.timestampMs !== null || ab.timestampMs !== null) {
          if (!areTimestampsComparable(mlaLine, ab)) return false;
          if (Math.abs(ab.timestampMs! - mlaLine.timestampMs!) > 60 * 1000) return false;
        }
        if (!isSameExecutionAbortCorroborationLine(ab.inspectLine)) return false;
        if (hasStartupBoundaryBetween(startupResetBucket, mlaLine, ab, true)) return false;
      }
      return true;
    };
    for (const mlaLine of mla107030Candidates) {
      const tbCands =
        mlaLine.tracebackGroupId !== null ? abortByTbGroup.get(mlaLine.tracebackGroupId) : undefined;
      let hasAbort = Boolean(tbCands?.some((ab) => matchAbortCandidate(mlaLine, ab)));
      if (!hasAbort) {
        const win = findUniversalStartupCutoffWindow(startupResetBucket, mlaLine);
        const maxBeforeMs =
          mlaLine.timestampMs !== null && win.before !== null
            ? Math.min(60_000, Math.max(0, mlaLine.timestampMs - win.before.timestampMs!))
            : 60_000;
        const maxAfterMs =
          mlaLine.timestampMs !== null && win.after !== null
            ? Math.min(60_000, Math.max(0, win.after.timestampMs! - mlaLine.timestampMs))
            : 60_000;
        const breakOnReset = (cand: ParsedLogLine): boolean =>
          Boolean(
            mlaLine.timestampMs !== null &&
              cand.timestampMs !== null &&
              win.before &&
              areTimestampsComparable(cand, win.before) &&
              compareTimestampOrder(cand, win.before) <= 0,
          );
        const matchInWin = (ab: ParsedLogLine): boolean => {
          if (win.after && ab.timestampMs !== null && areTimestampsComparable(ab, win.after)) {
            if (compareTimestampOrder(ab, win.after) >= 0) return false;
          }
          return matchAbortCandidate(mlaLine, ab);
        };
        if (mlaLine.pid !== null) {
          const pRec = abortByPid.get(mlaLine.pid);
          if (pRec) {
            if (mlaLine.rank !== null) {
              hasAbort =
                someInTimedDomainBucket(
                  pRec.byRank.get(mlaLine.rank),
                  mlaLine,
                  maxBeforeMs,
                  maxAfterMs,
                  Number.POSITIVE_INFINITY,
                  matchInWin,
                  false,
                  breakOnReset,
                ) ||
                someInTimedDomainBucket(
                  pRec.noRank,
                  mlaLine,
                  maxBeforeMs,
                  maxAfterMs,
                  Number.POSITIVE_INFINITY,
                  matchInWin,
                  false,
                  breakOnReset,
                );
            } else {
              hasAbort = someInTimedDomainBucket(
                pRec.all,
                mlaLine,
                maxBeforeMs,
                maxAfterMs,
                Number.POSITIVE_INFINITY,
                matchInWin,
                false,
                breakOnReset,
              );
            }
          }
          if (!hasAbort && mlaLine.rank !== null) {
            hasAbort = someInTimedDomainBucket(
              abortByRankNoPid.get(mlaLine.rank),
              mlaLine,
              maxBeforeMs,
              maxAfterMs,
              Number.POSITIVE_INFINITY,
              matchInWin,
              false,
              breakOnReset,
            );
          }
        } else if (mlaLine.rank !== null) {
          hasAbort = someInTimedDomainBucket(
            abortByRank.get(mlaLine.rank),
            mlaLine,
            maxBeforeMs,
            maxAfterMs,
            Number.POSITIVE_INFINITY,
            matchInWin,
            false,
            breakOnReset,
          );
        } else {
          hasAbort = someInTimedDomainBucket(
            abortUnscopedBySeg.get(mlaLine.segmentId),
            mlaLine,
            maxBeforeMs,
            maxAfterMs,
            Number.POSITIVE_INFINITY,
            matchInWin,
            false,
            breakOnReset,
          );
        }
      }
      if (!hasAbort) {
        nonfatal107030Lines.add(mlaLine.lineNumber);
      }
    }
  }

  const oomLifecycleIndex = buildOomLifecycleIndex(oomLifecycleCandidates);
  const bootstrapCtx: LineScopeContext = {
    ascendContextLines,
    ascendByPid,
    ascendByRankNoPid,
    ascendByTbGroup,
    ambiguousDomainPids,
    hbmOomLines: [],
    hbmOomBySeg: new Map(),
    hbmOomByPid: new Map(),
    hbmOomByRank: new Map(),
    hbmOomByRankNoPid: new Map(),
    hbmOomByTbGroup: new Map(),
    hbmOomUnscopedBySeg: new Map(),
    startupResetBucket,
    startupBoundaryBucket,
    processResetBucket,
    oomStageByLine: new Map(),
    lineIndexByLineNumber,
    oomLifecycleCandidates,
    oomLifecycleIndex,
    compileFaultLines: [],
    compileFaultBySeg: new Map(),
    pairedEi0006Lines: new Set<number>(),
    mergedLinkEstContLines: new Set<number>(),
    hccnDownLines,
    hccnDeviceByLine,
    ambiguousDeviceLines,
    modelslimJsonTbGroups,
    nonfatal107030Lines,
    partnerContextByLine,
    ascendScopeMemo: new Map(),
    hbmOomScopeMemo: new Map(),
    compileSuppressedMemo: new Map(),
  };
  const hbmOomLines = lines.filter((l) => isNpuOomLine(l, bootstrapCtx));
  const hbmOomBySeg = new Map<number, ParsedLogLine[]>();
  const hbmOomByPid = new Map<number, DomainIndexedBucket>();
  const hbmOomByRank = new Map<number, DomainIndexedBucket>();
  const hbmOomByRankNoPid = new Map<number, DomainIndexedBucket>();
  const hbmOomByTbGroup = new Map<number, ParsedLogLine[]>();
  const hbmOomUnscopedBySeg = new Map<number, DomainIndexedBucket>();
  for (const o of hbmOomLines) {
    pushIndexedLine(hbmOomBySeg, o.segmentId, o);
    if (o.pid !== null) pushToKeyedDomainBucket(hbmOomByPid, o.pid, o);
    else if (o.rank !== null) pushToKeyedDomainBucket(hbmOomByRankNoPid, o.rank, o);
    if (o.rank !== null) pushToKeyedDomainBucket(hbmOomByRank, o.rank, o);
    if (o.tracebackGroupId !== null) pushIndexedLine(hbmOomByTbGroup, o.tracebackGroupId, o);
    if (o.pid === null && o.rank === null) pushToKeyedDomainBucket(hbmOomUnscopedBySeg, o.segmentId, o);
  }
  for (const b of hbmOomByPid.values()) finalizeDomainBucket(b);
  for (const b of hbmOomByRank.values()) finalizeDomainBucket(b);
  for (const b of hbmOomByRankNoPid.values()) finalizeDomainBucket(b);
  for (const b of hbmOomUnscopedBySeg.values()) finalizeDomainBucket(b);

  const oomStageByLine = new Map<number, "capture" | "cold-start" | "kv-alloc" | "runtime" | "unknown">();
  for (const oomLine of hbmOomLines) {
    oomStageByLine.set(
      oomLine.lineNumber,
      classifyNpuOomStage(lines, oomLine, lineIndexByLineNumber, oomLifecycleCandidates, oomLifecycleIndex),
    );
  }
  const compileFaultLines = lines.filter((l) => isTorchairGeCompileFaultLine(l.inspectLine));
  const compileFaultBySeg = new Map<number, CompileFaultSegBucket>();
  for (const cf of compileFaultLines) {
    let segRec = compileFaultBySeg.get(cf.segmentId);
    if (!segRec) {
      segRec = {
        all: createDomainIndexedBucket(),
        byPid: new Map(),
        byRankNoPid: new Map(),
        byRank: new Map(),
        unscoped: createDomainIndexedBucket(),
      };
      compileFaultBySeg.set(cf.segmentId, segRec);
    }
    pushToDomainBucket(segRec.all, cf);
    if (cf.pid !== null) {
      let pidRec = segRec.byPid.get(cf.pid);
      if (!pidRec) {
        pidRec = {
          all: createDomainIndexedBucket(),
          byRank: new Map(),
          noRank: createDomainIndexedBucket(),
        };
        segRec.byPid.set(cf.pid, pidRec);
      }
      pushToDomainBucket(pidRec.all, cf);
      if (cf.rank !== null) pushToKeyedDomainBucket(pidRec.byRank, cf.rank, cf);
      else pushToDomainBucket(pidRec.noRank, cf);
    } else if (cf.rank !== null) {
      pushToKeyedDomainBucket(segRec.byRankNoPid, cf.rank, cf);
    }
    if (cf.rank !== null) pushToKeyedDomainBucket(segRec.byRank, cf.rank, cf);
    if (cf.pid === null && cf.rank === null) pushToDomainBucket(segRec.unscoped, cf);
  }
  for (const segRec of compileFaultBySeg.values()) {
    finalizeDomainBucket(segRec.all);
    finalizeDomainBucket(segRec.unscoped);
    for (const pidRec of segRec.byPid.values()) {
      finalizeDomainBucket(pidRec.all);
      finalizeDomainBucket(pidRec.noRank);
      for (const b of pidRec.byRank.values()) finalizeDomainBucket(b);
    }
    for (const b of segRec.byRankNoPid.values()) finalizeDomainBucket(b);
    for (const b of segRec.byRank.values()) finalizeDomainBucket(b);
  }

  const pairedEi0006Lines = new Set<number>();
  const pairedLinkLines = new Set<number>();
  const mergedLinkEstContLines = new Set<number>();
  const neighborOffsets = [-1, 1, -2, 2, -3, 3, -4, 4] as const;
  const hasOtherPrimaryFault = (target: ParsedLogLine): boolean =>
    PRIMARY_SIGNAL_SPECS.some(
      (spec) =>
        spec.ruleId !== "hccl-link-or-ifname-fault" &&
        (spec.predicate ? spec.predicate(target, bootstrapCtx) : spec.re?.test(target.inspectLine)),
    ) || hasGenuinePythonException(target.inspectLine);

  const linkEstCandIndices: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const linkLine = lines[i]!;
    if (
      hasFailureSemantics(linkLine.inspectLine) &&
      HCCL_LINK_ESTABLISH_TIMEOUT_RE.test(linkLine.inspectLine) &&
      !/\bEI0006\b/i.test(linkLine.inspectLine)
    ) {
      linkEstCandIndices.push(i);
    }
  }

  for (const offset of neighborOffsets) {
    for (const i of linkEstCandIndices) {
      const linkLine = lines[i]!;
      if (pairedLinkLines.has(linkLine.lineNumber)) continue;
      if (hasOtherPrimaryFault(linkLine)) continue;
      const j = i + offset;
      if (j < 0 || j >= lines.length) continue;
      const cand = lines[j]!;
      if (cand.segmentId !== linkLine.segmentId) continue;
      if (pairedEi0006Lines.has(cand.lineNumber)) continue;
      if (Math.abs(linkLine.lineNumber - cand.lineNumber) > 4) continue;
      if (!hasFailureSemantics(cand.inspectLine)) continue;
      if (ZERO_EI_COUNTER_RE.test(cand.inspectLine) && !NONZERO_EI_COUNTER_RE.test(cand.inspectLine))
        continue;
      if (!/\bEI0006\b/i.test(cand.inspectLine)) continue;
      if (HCCL_LINK_ESTABLISH_TIMEOUT_RE.test(cand.inspectLine)) continue;
      if (HCCL_EXEC_WAIT_QUALIFIER_RE.test(cand.inspectLine)) continue;
      if (!areCausalDomainsCompatible(linkLine, cand)) continue;
      if (linkLine.rank !== null && cand.rank !== null && linkLine.rank !== cand.rank) continue;
      if (linkLine.pid !== null && cand.pid !== null && linkLine.pid !== cand.pid) continue;
      if (
        linkLine.timestampMs !== null &&
        cand.timestampMs !== null &&
        Math.abs(linkLine.timestampMs - cand.timestampMs) > 5000
      ) {
        continue;
      }
      if (hasOtherPrimaryFault(cand)) continue;

      if (linkLine.rank === null && cand.rank !== null) {
        const lo = Math.min(i, j);
        const hi = Math.max(i, j);
        let blockedByOtherScope = false;
        for (let k = lo + 1; k < hi; k += 1) {
          const mid = lines[k]!;
          if (!areCausalDomainsCompatible(cand, mid)) {
            blockedByOtherScope = true;
            break;
          }
          if (mid.rank !== null && mid.rank !== cand.rank) {
            blockedByOtherScope = true;
            break;
          }
          if (mid.pid !== null && cand.pid !== null && mid.pid !== cand.pid) {
            blockedByOtherScope = true;
            break;
          }
        }
        if (blockedByOtherScope) continue;
      }

      const linkPeer = extractPeerRankFromLine(linkLine.inspectLine);
      const candPeer = extractPeerRankFromLine(cand.inspectLine);
      pairedLinkLines.add(linkLine.lineNumber);
      pairedEi0006Lines.add(cand.lineNumber);
      mergedLinkEstContLines.add(cand.lineNumber);
      partnerContextByLine.set(linkLine.lineNumber, {
        rank: linkLine.rank ?? cand.rank,
        rankSource: linkLine.rank !== null ? linkLine.rankSource : cand.rankSource,
        hostTag: linkLine.hostTag ?? cand.hostTag,
        instanceTag: linkLine.instanceTag ?? cand.instanceTag,
        groupTag: linkLine.groupTag ?? cand.groupTag,
        pid: linkLine.pid ?? cand.pid,
        peerRank: linkPeer ?? candPeer,
        timestamp: linkLine.timestamp ?? cand.timestamp,
        timestampMs: linkLine.timestamp !== null ? linkLine.timestampMs : cand.timestampMs,
        timestampSubMs: linkLine.timestamp !== null ? linkLine.timestampSubMs : cand.timestampSubMs,
        timestampKind: linkLine.timestamp !== null ? linkLine.timestampKind : cand.timestampKind,
        hasExplicitTimezone:
          linkLine.timestamp !== null ? linkLine.hasExplicitTimezone : cand.hasExplicitTimezone,
        inferredYearMatched:
          linkLine.timestamp !== null ? linkLine.inferredYearMatched : cand.inferredYearMatched,
      });
    }
  }

  return {
    ascendContextLines,
    ascendByPid,
    ascendByRankNoPid,
    ascendByTbGroup,
    ambiguousDomainPids,
    hbmOomLines,
    hbmOomBySeg,
    hbmOomByPid,
    hbmOomByRank,
    hbmOomByRankNoPid,
    hbmOomByTbGroup,
    hbmOomUnscopedBySeg,
    hbmOomLineNumbers: new Set(hbmOomLines.map((o) => o.lineNumber)),
    startupResetBucket,
    startupBoundaryBucket,
    processResetBucket,
    oomStageByLine,
    lineIndexByLineNumber,
    oomLifecycleCandidates,
    oomLifecycleIndex,
    compileFaultLines,
    compileFaultBySeg,
    pairedEi0006Lines,
    mergedLinkEstContLines,
    hccnDownLines,
    hccnDeviceByLine,
    ambiguousDeviceLines,
    modelslimJsonTbGroups,
    nonfatal107030Lines,
    partnerContextByLine,
    ascendScopeMemo: new Map(),
    hbmOomScopeMemo: new Map(),
    compileSuppressedMemo: new Map(),
  };
}

const CASCADE_SIGNAL_PATTERNS: ReadonlyArray<{
  re?: RegExp;
  predicate?: (line: ParsedLogLine, ctx?: LineScopeContext) => boolean;
  tag: string;
}> = [
  { re: /\bEI0002\b/i, tag: "HCCL EI0002" },
  { re: /\bEI0006\b/i, tag: "HCCL EI0006" },
  { re: /\bHCCL_E_(?:WAIT_)?TIMEOUT\b/i, tag: "HCCL_E_TIMEOUT / WAIT_TIMEOUT" },
  { re: /\bHCCL\s+error:\s*9\b/i, tag: "HCCL error: 9 (Wait Timeout)" },
  { re: /Notify wait execute timeout/i, tag: "Notify wait execute timeout" },
  { re: /Watchdog caught collective operation timeout/i, tag: "Watchdog collective timeout" },
  {
    re: /\bfailed\s+to\s+pass\s+monitoredBarrier\b|\bmonitoredBarrier\b[^\r\n]{0,96}\b(?:fail(?:ed)?|timeout|timed?\s+out)\b/i,
    tag: "monitoredBarrier timeout",
  },
  {
    predicate: isHcclTimeoutFaultLine,
    tag: "HCCL collective timeout",
  },
  { re: /EngineCore(?:Proc)?\b[^\r\n]{0,50}died unexpectedly/i, tag: "EngineCoreProc died unexpectedly" },
  { re: /\bRuntimeError:\s*Engine core initialization failed\b/i, tag: "Engine core initialization failed" },
  { re: /\bBrokenPipeError\b|\bChildFailedError\b/i, tag: "BrokenPipe / ChildFailed" },
];

const PLOG_HARDWARE_FAULT_RE =
  /CheckSmmuFault:(?!.{0,160}isSmmuFault\s+is\s+0\b).{0,256}(?:isSmmuFault\s+is\s+[1-9]|failed|error|fault)|\bSMMU fault\b|MTE (?:accesses an invalid GM address|DDR address out of range)|\bVEC\s+instruction\s+to\s+(?:read\s*\/\s*write|read|write)\s+UB\s+is\s+out\s+of\s+bounds\b|(?:\b(?:SMMU|CheckSmmuFault|AICore|AI Core|Vector Core|AIV|SetStarsResultForDavinciTask|ffts|stars|tsdrv|devdrv|fault\s+kernel_name|\[(?:EVENT|ERROR|WARN)\]\s*(?:RUNTIME|TSDRV|DEVDRV|AICPU|DRV))\b[^\r\n]{0,128}retCode\s*[:=]\s*0x0*[1-9a-f][0-9a-f]*|\bSetStarsResultForDavinciTask\b[^\r\n]{0,128}(?:failed|error|retCode\s*[:=]\s*(?:-?[1-9]\d*|0x0*[1-9a-f][0-9a-f]*)))|\b(?:aicore|vector\s+core)\s+exception\b|(?:AI|Vector)\s+Core kernel (?:task )?execution failed|(?:\berror(?:\s+code)?(?:\s+is)?|\bacl\s+error|\bruntime\s+result|\berr(?:_?code)?|\bret(?:_?code)?|\bcode|\bstatus|\bfailed)\s*[:=#(]?\s*(?:507014|507015|507034|507035|107030|207003)\b|\b(?:507018|ACL_ERROR_RT_AICPU_EXCEPTION)\b[^\r\n]{0,160}\b(?:kernel|task|device|stream|aicpu|retCode|SetStarsResult|fail(?:ed)?|error)|\b(?:ACL_ERROR_RT_AICORE_EXCEPTION|ACL_ERROR_RT_AICORE_TIMEOUT|ACL_ERROR_RT_VECTOR_CORE_EXCEPTION|ACL_ERROR_RT_AICORE_OVER_FLOW|ACL_ERROR_RT_CAPTURE_MODE_NOT_SUPPORT)\b/i;

const PLOG_EXPLICIT_RUNTIME_MARKER_RE =
  /CheckSmmuFault|\bSMMU fault\b|MTE (?:accesses an invalid GM address|DDR address out of range)|\bVEC\s+instruction\s+to\s+(?:read\s*\/\s*write|read|write)\s+UB\s+is\s+out\s+of\s+bounds\b|\bSetStarsResultForDavinciTask\b|\b(?:aicore|vector\s+core)\s+exception\b|(?:AI|Vector)\s+Core kernel (?:task )?execution failed|\b(?:507014|507015|507018|507034|507035|107030|207003|ACL_ERROR_RT_AICORE_EXCEPTION|ACL_ERROR_RT_AICORE_TIMEOUT|ACL_ERROR_RT_AICPU_EXCEPTION|ACL_ERROR_RT_VECTOR_CORE_EXCEPTION|ACL_ERROR_RT_AICORE_OVER_FLOW|ACL_ERROR_RT_CAPTURE_MODE_NOT_SUPPORT)\b/i;

const NON_107030_FATAL_CLAUSE_START_RE =
  /(?:,\s*|\s+(?:and|with)\s+|\s*[+;]\s*)(?=(?:rtMemcpy\s+failed\b|NPU\s+out\s+of\s+memory\b|torch\.(?:npu\.)?OutOfMemoryError\b|RuntimeError\s*:|error\s+code\s*(?:is|=|:)?\s*(?:5070\d\d|1610\d\d|5610\d\d|2070\d\d|1070(?!30)\d\d)\b|\b(?:507014|507015|507018|507034|507035|161001|161002|561002|561103|207003|107005|107024|107025)\b|\b(?:ACL_ERROR_|ACLNN_ERR_)(?!RT_CAPTURE_MODE_NOT_SUPPORT)|call\s+aclnn\w+\s+failed\b|\bCheckSmmuFault\b|\bSMMU\s+fault\b|\b(?:AI|Vector)\s+Core\s+(?:kernel\s+(?:task\s+)?execution\s+failed|exception)\b|\baicore\s+exception\b|\bMTE\s+(?:accesses\s+an\s+invalid\s+GM\s+address|DDR\s+address\s+out\s+of\s+range)\b|\bVEC\s+instruction\s+to\s+(?:read\s*\/\s*write|read|write)\s+UB\s+is\s+out\s+of\s+bounds\b|\bSetStarsResultForDavinciTask\b|\bEI000\d\b|\bEJ000\d\b|\bHCCL_E_|\bHCCL\s+error:\s*[1-9]\d*\b|\bmonitoredBarrier\b|Notify\s+wait\s+execute\s+timeout\b|Watchdog\s+caught\b|\bRaSocket|\bAddress\s+already\s+in\s+use\b|[A-Z][A-Za-z0-9_]*(?:Error|Exception)\s*:))/i;

function stripNonfatal107030Clauses(rawLine: string): string {
  const unnegatedRaw = stripBenignNegatedClauses(rawLine);
  const strippedBody = stripTracebackLogPrefix(unnegatedRaw);
  const headerPrefix = unnegatedRaw.slice(0, unnegatedRaw.length - strippedBody.length);
  const clauses = strippedBody.replace(NON_107030_FATAL_CLAUSE_START_RE, ";").split(";");
  const kept: string[] = [];
  for (const rawClause of clauses) {
    const clause = rawClause.trim();
    if (!clause) continue;
    const is107030 = /\b107030\b|\bACL_ERROR_RT_CAPTURE_MODE_NOT_SUPPORT\b/i.test(clause);
    if (!is107030) {
      kept.push(clause);
    } else if (
      /\b(?:rtMemcpy\s+failed|NPU\s+out\s+of\s+memory|OutOfMemoryError|ACLNN_ERR_[A-Z0-9_]+|ACL_ERROR_(?!RT_CAPTURE_MODE_NOT_SUPPORT)[A-Z0-9_]+|507014|507015|507018|507034|507035|161001|161002|561002|561103|207003|107005|107024|107025|CheckSmmuFault|SMMU\s+fault|SetStarsResultForDavinciTask|EI000[2469]|EJ000[13]|HCCL_E_[A-Z0-9_]+|monitoredBarrier|RaSocket\w*|Address\s+already\s+in\s+use)\b|\bHCCL\s+error:\s*[1-9]\d*\b|Notify\s+wait\s+execute\s+timeout|Watchdog\s+caught|\b(?:AI|Vector)\s+Core\s+(?:kernel\s+(?:task\s+)?execution\s+failed|exception)\b|\baicore\s+exception\b|\bMTE\s+(?:accesses\s+an\s+invalid\s+GM\s+address|DDR\s+address\s+out\s+of\s+range)\b|\bVEC\s+instruction\s+to\s+(?:read\s*\/\s*write|read|write)\s+UB\s+is\s+out\s+of\s+bounds\b/i.test(
        clause,
      )
    ) {
      kept.push(clause.replace(/\b(?:107030|ACL_ERROR_RT_CAPTURE_MODE_NOT_SUPPORT)\b/gi, " "));
    }
  }
  if (kept.length === 0) return " ";
  return headerPrefix ? `${headerPrefix}${kept.join("; ")}` : kept.join("; ");
}

function isCannPlogHardwareFaultLine(line: ParsedLogLine, ctx?: LineScopeContext): boolean {
  const baseInspect = ctx?.nonfatal107030Lines.has(line.lineNumber)
    ? stripNonfatal107030Clauses(line.inspectLine)
    : line.inspectLine;
  const inspect = stripBenignNegatedClauses(baseInspect);
  if (!hasFailureSemantics(inspect)) return false;
  const sanitized = stripLogIdFieldsForErrorCodes(inspect);
  if (!PLOG_HARDWARE_FAULT_RE.test(sanitized)) return false;
  if (STREAM_CAPTURE_CODE_RE.test(sanitized)) return false;
  if (/\b(?:drvGetDevInfo|aclrtSetDevice|rtSetDevice)\b/i.test(inspect)) return false;
  const checkLine = inspect === line.inspectLine ? line : { ...line, inspectLine: inspect };
  if (isCannDriverOrDeviceEnvLine(checkLine, ctx) || isHcclLinkOrIfnameLine(checkLine, ctx)) return false;
  if (isTorchairGeCompileFaultLine(inspect) && !PLOG_EXPLICIT_RUNTIME_MARKER_RE.test(sanitized)) {
    return false;
  }
  return true;
}

function extractIfaceFromLine(rawLine: string): string | null {
  const m =
    /\b(?:ifname|interface|nic|HCCL_SOCKET_IFNAME|GLOO_SOCKET_IFNAME|TP_SOCKET_IFNAME)\s*[:=]\s*=?\s*['"]?([A-Za-z0-9_.:-]+(?:,[A-Za-z0-9_.:-]+)*)['"]?/i.exec(
      rawLine,
    ) ?? /\b(enp\d+s\d+(?:f\d+)?|eth\d+|bond\d+|roce\d+(?:_\d+)?|ib\d+)\b/i.exec(rawLine);
  if (!m?.[1]) return null;
  const candidate = m[1].trim();
  if (/^(?:roce|not|none|null|down|up|fail|failed|error|invalid|missing|unknown)$/i.test(candidate)) {
    return null;
  }
  return candidate;
}

function extractPortFromLine(rawLine: string): string | null {
  const m = /\bport\s*(?:#|:|=)?\s*(\d+)\b/i.exec(rawLine);
  return m?.[1] ?? null;
}

function extractPeerRankFromLine(rawLine: string): number | null {
  const m = PEER_RANK_CAPTURE_RE.exec(rawLine);
  const raw = m?.[1] ?? m?.[2] ?? m?.[3] ?? m?.[4];
  if (!raw) return null;
  const val = Number.parseInt(raw, 10);
  return Number.isFinite(val) && val >= 0 && val < 4096 ? val : null;
}

function inferHcclLinkMechanism(
  rawLine: string,
  forceLinkEstablishTimeout = false,
): {
  mechanism: FaultMechanism;
  phase: FaultPhase;
  tag: string;
} {
  const inspect = capLineWindow(rawLine);
  if (HCCL_ROCE_PORT_DOWN_RE.test(inspect) || isBareHccnLinkDownLine(inspect)) {
    return { mechanism: "link-port-down", phase: "link-establish", tag: "RoCE 端口/链路掉线" };
  }
  if (/No route to host|ENETUNREACH|EHOSTUNREACH|Network is unreachable/i.test(inspect)) {
    return { mechanism: "link-route-fault", phase: "link-establish", tag: "HCCL 建链路由不可达" };
  }
  if (isExplicitHcclBindFaultLine(inspect)) {
    return { mechanism: "link-bind-fault", phase: "link-establish", tag: "HCCL 网卡/IP 绑定失败" };
  }
  if (PEER_REFUSED_SIGNAL_RE.test(inspect)) {
    return {
      mechanism: "link-peer-refused",
      phase: "link-establish",
      tag: "HCCL / 通信建链对端拒绝或重置连接 (ECONNREFUSED)",
    };
  }
  if (
    forceLinkEstablishTimeout ||
    HCCL_LINK_ESTABLISH_TIMEOUT_RE.test(inspect) ||
    /\bRaSocketConnect\b[^\r\n]{0,160}(?:timed?\s+out|timeout|ETIMEDOUT)/i.test(inspect)
  ) {
    return { mechanism: "link-establish-timeout", phase: "link-establish", tag: "HCCL 建链超时" };
  }
  if (/\bEI0004\b/i.test(inspect)) {
    return { mechanism: "link-transport-init", phase: "comm-init", tag: "HCCL Ranktable 配置错误 (EI0004)" };
  }
  if (/\bEJ0001\b/i.test(inspect)) {
    return { mechanism: "link-transport-init", phase: "comm-init", tag: "HCCL / HCCP 初始化失败 (EJ0001)" };
  }
  if (/\bEI0009\b/i.test(inspect)) {
    return { mechanism: "link-transport-init", phase: "comm-init", tag: "HCCL 传输初始化失败 (EI0009)" };
  }
  if (/\bHCCL_E_UNAVAIL\b|\bHCCL\s+error:\s*7\b/i.test(inspect)) {
    return {
      mechanism: "link-transport-init",
      phase: "comm-init",
      tag: "HCCL 资源或通道不可用 (HCCL_E_UNAVAIL / 7)",
    };
  }
  if (/\bHCCL_E_INTERNAL\b|\bHCCL\s+error:\s*4\b/i.test(inspect)) {
    return {
      mechanism: "link-transport-init",
      phase: "comm-init",
      tag: "HCCL 内部通信故障 (HCCL_E_INTERNAL / 4)",
    };
  }
  if (/\bibv_post_send\s+failed\b|\bHostCpuRoceChannel\b/i.test(inspect)) {
    return {
      mechanism: "link-route-fault",
      phase: "link-establish",
      tag: "HCCL RoCE / RDMA 发送失败 (ibv_post_send)",
    };
  }
  if (/RaSocketConnect/i.test(inspect)) {
    return { mechanism: "link-route-fault", phase: "link-establish", tag: "HCCL RaSocket 建链失败" };
  }
  return { mechanism: "link-route-fault", phase: "comm-init", tag: "HCCL 传输或路由初始化失败" };
}

function oomStageToFaultPhase(
  stage: "capture" | "cold-start" | "kv-alloc" | "runtime" | "unknown",
): FaultPhase {
  if (stage === "capture") return "graph-compile";
  if (stage === "cold-start" || stage === "kv-alloc") return "device-init";
  if (stage === "unknown") return "unknown";
  return "runtime";
}

interface PrimarySignalSpec {
  re?: RegExp;
  predicate?: (line: ParsedLogLine, ctx?: LineScopeContext) => boolean;
  tag: string | ((rawLine: string) => string);
  mechanism: FaultMechanism | ((rawLine: string) => FaultMechanism);
  phase: FaultPhase | ((rawLine: string, line: ParsedLogLine, ctx?: LineScopeContext) => FaultPhase);
  ruleId?: string;
}

const CANN_GENERIC_RUNTIME_CODE_RE = /\b(?:EZ9999|EZ3002|EZ3003|EL0004|EH9999|EZ1001|EE1001)\b/i;

const R5_SOC_COMPAT_RE =
  /Check ascend device type failed|\bSOC_VERSION\b[^\r\n]{0,128}(?:mismatch|invalid|error|fail|unsupported|not\s+support)|Current device type:[^\r\n]{0,128}does not match the installed version's device type|Ascend310P[^\r\n]{0,128}bfloat16|bfloat16[^\r\n]{0,128}310P|(?:Ascend|310P|NPU)[^\r\n]{0,128}bfloat16[^\r\n]{0,128}not supported|bfloat16[^\r\n]{0,128}not supported[^\r\n]{0,128}(?:Ascend|310P|NPU)|AscendModelSlimConfig310|FP8[^\r\n]{0,128}310P/i;

const R13_RUNTIME_CODE_RE =
  /\b(?:507014|507015|507018|507034|507035|107030|207003|ACL_ERROR_RT_AICORE_EXCEPTION|ACL_ERROR_RT_AICORE_TIMEOUT|ACL_ERROR_RT_AICPU_EXCEPTION|ACL_ERROR_RT_VECTOR_CORE_EXCEPTION|ACL_ERROR_RT_AICORE_OVER_FLOW|ACL_ERROR_RT_CAPTURE_MODE_NOT_SUPPORT)\b/i;

const R14_PARAM_OR_SYMBOL_RE =
  /(?:\b(?:not|missing)\s+in|undefined symbol[^\r\n]{0,96})\s+libopapi\.so|libopapi\.so(?::|\s+)[^\r\n]{0,96}\bundefined\s+symbol\b|libopapi\.so[^\r\n]{0,128}(?:cannot open shared object file|No such file or directory|not found|missing)|\b(?:ACLNN_ERR_PARAM_INVALID|ACLNN_ERR_PARAM_NULLPTR|ACLNN_ERR_INNER_TILING_ERROR)\b|\bAclNN_Parameter_Error(?:\s*\(\s*EZ1001\s*\))?|(?:error(?:\s+code)?(?:\s+is)?|err(?:Code)?|ret(?:Code)?|code|status|GetWorkspaceSize\s+ret)\s*[:=#(]?\s*(?:161001|161002|561002|561103)\b|\b(?:EZ0008|EZ0026|EZ0027)\b[^\r\n]{0,160}\b(?:aclnn|param|shape|dtype|axis|dim|invalid|mismatch|not\s+support|fail|error)|\baclnn\w*\b[^\r\n]{0,160}\b(?:EZ0008|EZ0026|EZ0027|EZ1001)\b/i;

function isSocCompatLine(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  return hasFailureSemantics(inspect) && !hasBenignZeroStatusOnly(inspect) && R5_SOC_COMPAT_RE.test(inspect);
}

function isGqaStaticC8KvLine(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  return (
    hasFailureSemantics(inspect) && !hasBenignZeroStatusOnly(inspect) && GQA_STATIC_C8_KV_RE.test(inspect)
  );
}

function isSleepFractalNzLine(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  return (
    !hasBenignZeroStatusOnly(inspect) &&
    hasFailureSemantics(inspect) &&
    SLEEP_FRACTAL_NZ_ERROR_RE.test(inspect)
  );
}

function isCannOpapiOrAclnnLine(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  if (!hasFailureSemantics(inspect)) return false;
  const sanitized = stripLogIdFieldsForErrorCodes(inspect);
  if (R14_PARAM_OR_SYMBOL_RE.test(sanitized)) return true;
  const hasSameClauseAclnnFail =
    /\baclnn[A-Za-z0-9_]+[^\r\n.;!?]{0,64}\bfail(?:ed|s)?\b/i.test(inspect) &&
    !/\baclnn[A-Za-z0-9_]+[^\r\n.;!?]{0,64}\b(?:completed|succeeded|success(?:fully)?)\b/i.test(inspect);
  return (
    (/Aicore kernel execute failed/i.test(inspect) || hasSameClauseAclnnFail) &&
    !R13_RUNTIME_CODE_RE.test(sanitized) &&
    !isTorchairGeCompileFaultLine(inspect) &&
    !isMoeMc2OrModelSlimLine(inspect)
  );
}

type PortConflictSubtype = "zmq" | "metrics" | "tcpstore" | "api-uvicorn" | "generic-tcp";

function getPortConflictSubtype(rawLine: string): PortConflictSubtype | null {
  const inspect = capLineWindow(rawLine);
  if (!hasFailureSemantics(inspect)) return null;
  if (!/\b(?:Address already in use|EADDRINUSE|Errno\s*98)\b/i.test(inspect)) return null;
  if (/\b(?:RaSocket\w*|HCCL|HCCP|EADDRNOTAVAIL)\b/i.test(inspect) && !/\bTCPStore\b/i.test(inspect)) {
    return null;
  }
  if (/\bZMQError\b|\bzmq\.error\b|\bmake_zmq_socket\b|\bzmq\b/i.test(inspect)) return "zmq";
  if (/\b(?:metrics(?:\s+server)?|prometheus)\b/i.test(inspect)) return "metrics";
  if (/\b(?:TCPStore\w*|c10d|init_process_group|torch\.distributed|master_port|rpc_port)\b/i.test(inspect)) {
    return "tcpstore";
  }
  if (
    /\b(?:uvicorn|fastapi|api_server|openai\s+api)\b|Error while attempting to bind on address/i.test(inspect)
  ) {
    return "api-uvicorn";
  }
  if (/tcp:\/\//i.test(inspect)) return "generic-tcp";
  return null;
}

function isPortConflictLine(rawLine: string): boolean {
  return getPortConflictSubtype(rawLine) !== null;
}

function getPlogHardwareSignalTag(rawLine: string): string {
  const sanitized = stripLogIdFieldsForErrorCodes(capLineWindow(rawLine));
  const has507015 = /\b507015\b|ACL_ERROR_RT_AICORE_EXCEPTION/i.test(sanitized);
  const has507035 = /\b507035\b|ACL_ERROR_RT_VECTOR_CORE_EXCEPTION/i.test(sanitized);
  if (has507015 && has507035) return "CANN AI/Vector Core 硬件异常 (507015 / 507035)";
  if (/\b507014\b|ACL_ERROR_RT_AICORE_TIMEOUT/i.test(sanitized)) return "AI Core 执行超时 (507014)";
  if (/\b507018\b|ACL_ERROR_RT_AICPU_EXCEPTION/i.test(sanitized)) return "AICPU 核函数执行异常 (507018)";
  if (/\b507034\b|vector\s+core\s+timeout/i.test(sanitized)) return "Vector Core 执行超时 (507034)";
  if (/\b207003\b|ACL_ERROR_RT_AICORE_OVER_FLOW/i.test(sanitized)) return "AI Core 算术溢出 (207003)";
  if (/\b107030\b|CAPTURE_MODE_NOT_SUPPORT/i.test(sanitized)) return "ACLGraph 捕获操作不支持 (107030)";
  if (has507035) return "CANN Vector Core / 核函数异常 (507035)";
  if (/\bvector\s+core\b|\bSetStarsResultForDavinciTask\b/i.test(sanitized)) {
    return "CANN Vector Core 执行异常";
  }
  return "CANN plog / AI Core 硬件异常";
}

const PRIMARY_SIGNAL_SPECS: readonly PrimarySignalSpec[] = [
  {
    predicate: (l, ctx) => isNpuOomLine(l, ctx),
    tag: "NPU HBM OOM",
    mechanism: "memory-oom",
    phase: (_raw, line, ctx) => oomStageToFaultPhase(ctx?.oomStageByLine.get(line.lineNumber) ?? "unknown"),
    ruleId: "oom-stage-split",
  },
  {
    predicate: (l) =>
      !isBenignDocumentationOrHelpLine(l.inspectLine) &&
      hasFailureSemantics(l.inspectLine) &&
      /Free memory on device\b[^\r\n]{0,64}\(.+\)\s*on startup\s+is less than desired/i.test(l.inspectLine),
    tag: "init_snapshot 显存不足",
    mechanism: "memory-oom",
    phase: "device-init",
    ruleId: "pre-profile-free-memory",
  },
  {
    predicate: (l) =>
      !isBenignDocumentationOrHelpLine(l.inspectLine) &&
      hasFailureSemantics(l.inspectLine) &&
      /Error in memory profiling\.\s*Initial free memory/i.test(l.inspectLine),
    tag: "memory_profiling 显存漂移",
    mechanism: "memory-oom",
    phase: "device-init",
    ruleId: "pre-profile-free-memory",
  },
  {
    predicate: (l) =>
      !isBenignDocumentationOrHelpLine(l.inspectLine) &&
      hasFailureSemantics(l.inspectLine) &&
      /\bNo available memory for the cache blocks\b/i.test(l.inspectLine),
    tag: "KV Cache 可用物理块数为零",
    mechanism: "memory-oom",
    phase: "device-init",
    ruleId: "pre-profile-free-memory",
  },
  {
    predicate: (l) =>
      !isBenignDocumentationOrHelpLine(l.inspectLine) &&
      hasFailureSemantics(l.inspectLine) &&
      /\bCannot find any model weights\b/i.test(l.inspectLine),
    tag: "模型权重文件缺失",
    mechanism: "other",
    phase: "device-init",
    ruleId: "cann-driver-or-device-env-fault",
  },
  {
    predicate: (l, ctx) => isHcclLinkPrimaryLine(l, ctx),
    tag: (l) => inferHcclLinkMechanism(l).tag,
    mechanism: (l) => inferHcclLinkMechanism(l).mechanism,
    phase: (l) => inferHcclLinkMechanism(l).phase,
    ruleId: "hccl-link-or-ifname-fault",
  },
  {
    predicate: (l) => isTorchairGeCompileFaultLine(l.inspectLine),
    tag: (l) => {
      const inspect = capLineWindow(l);
      if (/Static kernel generation requires\s+npugraph_ex/i.test(inspect)) {
        return "Static Kernel 依赖配置断言失败 (缺少 enable_npugraph_ex)";
      }
      if (/External DP static compilation|Static compilation requires/i.test(inspect)) {
        return "Static Compilation 拓扑配置校验失败";
      }
      return "TorchAir / GE 编译与 Tiling 失败";
    },
    mechanism: (l) =>
      /Static kernel generation requires\s+npugraph_ex|External DP static compilation|Static compilation requires/i.test(
        capLineWindow(l),
      )
        ? "other"
        : "graph-compile",
    phase: (l) =>
      /Static kernel generation requires\s+npugraph_ex|External DP static compilation|Static compilation requires/i.test(
        capLineWindow(l),
      )
        ? "device-init"
        : "graph-compile",
    ruleId: "torchair-ge-graph-compile-fault",
  },
  {
    predicate: (l, ctx) => isMoeMc2OrModelSlimLine(l.inspectLine, l.tracebackGroupId, ctx),
    tag: (l) =>
      MOE_MC2_FAULT_RE.test(capLineWindow(l)) ? "MoE MC2 通信域/缓冲异常" : "ModelSlim 量化配置/分片异常",
    mechanism: (l) => (MOE_MC2_FAULT_RE.test(capLineWindow(l)) ? "moe-mc2" : "modelslim-quant"),
    phase: (l) =>
      MOE_MC2_FAULT_RE.test(capLineWindow(l))
        ? /HCCL_BUFFSIZE is too SMALL|worldSize is invalid|\btiling\b|OP_HOST/i.test(capLineWindow(l))
          ? "runtime"
          : "comm-init"
        : "runtime",
    ruleId: "moe-mc2-or-modelslim-quant-fault",
  },
  {
    predicate: (l) => isSocCompatLine(l.inspectLine),
    tag: "SoC/Wheel 型号不匹配",
    mechanism: "other",
    phase: "device-init",
    ruleId: "soc-310p-or-c8-compat",
  },
  {
    predicate: (l) => isGqaStaticC8KvLine(l.inspectLine),
    tag: "GQA + C8 缺少校准权重",
    mechanism: "other",
    phase: "runtime",
    ruleId: "soc-310p-or-c8-compat",
  },
  {
    predicate: (l, ctx) => isCannDriverOrDeviceEnvLine(l, ctx),
    tag: (l) =>
      EL0004_MEM_ALLOC_RE.test(capLineWindow(l)) && !CANN_DRIVER_DEVICE_ENV_CORE_RE.test(capLineWindow(l))
        ? "CANN 运行时内存/资源分配失败"
        : "CANN 驱动 / HAL / 设备初始化阻断",
    mechanism: "cann-device-env",
    phase: (l) =>
      EL0004_MEM_ALLOC_RE.test(capLineWindow(l)) && !CANN_DRIVER_DEVICE_ENV_CORE_RE.test(capLineWindow(l))
        ? "runtime"
        : "device-init",
    ruleId: "cann-driver-or-device-env-fault",
  },
  {
    predicate: isCannPlogHardwareFaultLine,
    tag: getPlogHardwareSignalTag,
    mechanism: "aicore-runtime",
    phase: "runtime",
    ruleId: "cann-plog-aicore-fault",
  },
  {
    predicate: (l) => isCannOpapiOrAclnnLine(l.inspectLine),
    tag: (l) => {
      const sanitized = stripLogIdFieldsForErrorCodes(capLineWindow(l));
      if (/\b561103\b/i.test(sanitized) && !/\b561002\b/i.test(sanitized)) {
        return "aclnn 内核校验/切分失败 (561103)";
      }
      if (/\b(?:561002|561103)\b|\bACLNN_ERR_INNER_TILING_ERROR\b/i.test(sanitized)) {
        return /\b561103\b/i.test(sanitized)
          ? "aclnn Tiling / 内核校验失败 (561002 / 561103)"
          : "aclnn Tiling / 形状属性校验失败 (561002)";
      }
      if (/\b(?:161001|161002)\b|\bACLNN_ERR_PARAM_/i.test(sanitized)) {
        return "aclnn 算子参数校验失败";
      }
      return "AI Core / aclnn 算子失败";
    },
    mechanism: "aicore-runtime",
    phase: "runtime",
    ruleId: "cann-opapi-or-aclnn-fault",
  },
  {
    predicate: (l) => isPortConflictLine(l.inspectLine),
    tag: (l) => {
      const sub = getPortConflictSubtype(l);
      if (sub === "metrics") return "Metrics 监听端口冲突";
      if (sub === "tcpstore") return "TCPStore / 控制面端口冲突";
      if (sub === "api-uvicorn") return "API / Uvicorn 监听端口冲突";
      if (sub === "generic-tcp") return "TCP 监听端口占用冲突";
      return "ZMQ 端口占用冲突";
    },
    mechanism: "other",
    phase: "comm-init",
    ruleId: "zmq-port-conflict",
  },
  {
    predicate: isGraphCaptureFaultLine,
    tag: (l) => {
      const inspect = capLineWindow(l);
      if (isPiecewiseSilentResetLine(inspect)) {
        return "PIECEWISE 静默重置 npugraph_ex 与静态核开关";
      }
      return /AscendFAImpl does not support ACL graph capture/i.test(inspect)
        ? "FA3 + FULL_DECODE_ONLY 图捕获冲突"
        : "ACLGraph / NPUGRAPH_EX 图捕获失败";
    },
    mechanism: "other",
    phase: (l) => (isPiecewiseSilentResetLine(capLineWindow(l)) ? "device-init" : "graph-compile"),
    ruleId: "graph-capture-failure",
  },
  {
    predicate: (l) => isMooncakePdErrorLine(l.inspectLine),
    tag: "Mooncake / RDMA KV 传输异常",
    mechanism: "other",
    phase: "comm-init",
    ruleId: "mooncake-pd-transfer-error",
  },
  {
    predicate: (l) => isSleepFractalNzLine(l.inspectLine),
    tag: (l) =>
      /\b(?:start_weight_update|weight_update|_check_nz_disabled)\b/i.test(capLineWindow(l))
        ? "权重更新与 FRACTAL_NZ 冲突"
        : "Sleep 唤醒与 FRACTAL_NZ 冲突",
    mechanism: "other",
    phase: "runtime",
    ruleId: "sleep-mode-fractal-nz-wakeup",
  },
  {
    predicate: (l) => isSigkillLine(l.inspectLine),
    tag: "OS SIGKILL (137 / -9)",
    mechanism: "other",
    phase: "runtime",
    ruleId: "exit-137-sigkill",
  },
  {
    predicate: (l) => isSigsegvLine(l.inspectLine),
    tag: "OS SIGSEGV (139 / -11)",
    mechanism: "other",
    phase: "runtime",
    ruleId: "exit-139-sigsegv",
  },
  {
    predicate: (l, ctx) =>
      hasFailureSemantics(l.inspectLine) &&
      !isHcclTimeoutFaultLine(l, ctx) &&
      !isHcclLinkEstablishLine(l, ctx) &&
      !isPeerRefusedCascadeLine(l.inspectLine) &&
      !/monitoredBarrier|HCCL\s+error:\s*9\b|HCCL_E_TIMEOUT/i.test(l.inspectLine) &&
      !(
        EL0004_MEM_ALLOC_RE.test(l.inspectLine) &&
        !CANN_DRIVER_DEVICE_ENV_CORE_RE.test(l.inspectLine) &&
        hasHbmOomInLineScope(l, ctx)
      ) &&
      CANN_GENERIC_RUNTIME_CODE_RE.test(l.inspectLine),
    tag: "CANN 通用运行时错误码",
    mechanism: "other",
    phase: "runtime",
  },
  {
    predicate: (l, ctx) =>
      hasFailureSemantics(l.inspectLine) &&
      !isHcclTimeoutFaultLine(l, ctx) &&
      !isHcclLinkEstablishLine(l, ctx) &&
      !isPeerRefusedCascadeLine(l.inspectLine) &&
      !/monitoredBarrier|HCCL\s+error:\s*9\b|HCCL_E_TIMEOUT/i.test(l.inspectLine) &&
      /\bACL_ERROR_[A-Z0-9_]+\b/i.test(l.inspectLine),
    tag: "ACL 通用运行时错误",
    mechanism: "other",
    phase: "runtime",
  },
];

const GENERIC_RUNTIME_ERROR_RE = /\bRuntimeError\s*:/;

function isTracebackScaffoldLine(rawLine: string): boolean {
  const inspect = capLineWindow(rawLine);
  if (/Traceback \(most recent call last\):/i.test(inspect)) return true;
  const trimmedStart = inspect.trimStart();
  const body = stripTracebackLogPrefix(trimmedStart);
  if (TRACEBACK_CHAIN_BANNER_RE.test(body.trim())) return true;
  if (body !== trimmedStart) {
    const bodyTrimmed = body.trim();
    if (TRACEBACK_UNPREFIXED_TERMINAL_RE.test(bodyTrimmed)) return false;
    const strippedPrefix = trimmedStart.slice(0, trimmedStart.length - body.length);
    if (/\s{2,}$/.test(strippedPrefix)) return true;
    return /^(?:\s*File "[^"]+", line \d+|[\s]{2,}|(?:raise|assert|return|elif|except|finally)\s+|(?:if|else|for|while|with|try)\b[^\r\n]{0,120}:|(?:logger|logging|self|cls)\.(?:info|debug|warn(?:ing)?|error|exception)\(|in\s+[A-Za-z_][A-Za-z0-9_]*\s*$|[~\s]*\^+(?:[~\s]+\^+)*[~\s]*$)/.test(
      body,
    );
  }
  return /^(?:[\s]{2,}|File "[^"]+", line \d+|raise\s+|in\s+[A-Za-z_][A-Za-z0-9_]*\s*$|[~\s]*\^+(?:[~\s]+\^+)*[~\s]*$)/.test(
    inspect,
  );
}

function classifyLineSignal(line: ParsedLogLine, ctx?: LineScopeContext): ClassifiedSignal | null {
  if (!line.trimmed) return null;
  if (line.isPromLine || line.trimmed.startsWith("#") || isPromExpositionLine(line.trimmed)) return null;
  if (isBenignDocumentationOrHelpLine(line.inspectLine)) return null;
  if (ctx?.mergedLinkEstContLines.has(line.lineNumber)) return null;
  if (line.tracebackGroupId !== null && isTracebackScaffoldLine(line.inspectLine)) return null;
  if (isAdvisoryGraphCapabilityWarning(line.inspectLine)) return null;
  if (
    isPiecewiseSilentResetLine(line.inspectLine) &&
    !hasLogErrorSeverity(line.inspectLine) &&
    !hasGenuinePythonException(line.inspectLine)
  ) {
    return null;
  }
  const baseInspect = ctx?.nonfatal107030Lines.has(line.lineNumber)
    ? stripNonfatal107030Clauses(line.inspectLine)
    : line.inspectLine;
  const effectiveInspect = stripBenignNegatedClauses(baseInspect);
  const effectiveLine: ParsedLogLine =
    effectiveInspect === line.inspectLine ? line : { ...line, inspectLine: effectiveInspect };
  if (
    !isNpuOomLine(effectiveLine, ctx) &&
    EL0004_MEM_ALLOC_RE.test(effectiveInspect) &&
    !CANN_DRIVER_DEVICE_ENV_CORE_RE.test(effectiveInspect) &&
    hasHbmOomInLineScope(effectiveLine, ctx)
  ) {
    return null;
  }

  const partner = ctx?.partnerContextByLine.get(line.lineNumber);
  const normalizedLine: ParsedLogLine = partner ? { ...effectiveLine, ...partner } : effectiveLine;

  const iface = extractIfaceFromLine(effectiveInspect);
  const port = extractPortFromLine(effectiveInspect);
  const peerRank = partner?.peerRank ?? extractPeerRankFromLine(effectiveInspect);

  const hasConcreteNonLinkPrimary = PRIMARY_SIGNAL_SPECS.some(
    (spec) =>
      spec.ruleId !== undefined &&
      spec.ruleId !== "hccl-link-or-ifname-fault" &&
      (spec.predicate ? spec.predicate(normalizedLine, ctx) : spec.re?.test(effectiveInspect)),
  );

  if (
    !hasConcreteNonLinkPrimary &&
    !isHcclLinkPrimaryLine(normalizedLine, ctx) &&
    isPeerRefusedCascadeLine(normalizedLine.inspectLine)
  ) {
    const info = inferHcclLinkMechanism(effectiveInspect);
    return {
      ...normalizedLine,
      kind: "cascade",
      signalTag: info.tag,
      mechanism: "link-peer-refused",
      phase: "link-establish",
      peerRank,
      iface,
      port,
      ruleId: "hccl-link-or-ifname-fault",
    };
  }

  for (const spec of PRIMARY_SIGNAL_SPECS) {
    const hit = spec.predicate ? spec.predicate(normalizedLine, ctx) : spec.re?.test(effectiveInspect);
    if (hit) {
      return {
        ...normalizedLine,
        kind: "root-cause",
        signalTag: typeof spec.tag === "function" ? spec.tag(effectiveInspect) : spec.tag,
        mechanism: typeof spec.mechanism === "function" ? spec.mechanism(effectiveInspect) : spec.mechanism,
        phase:
          typeof spec.phase === "function" ? spec.phase(effectiveInspect, normalizedLine, ctx) : spec.phase,
        peerRank,
        iface,
        port,
        ruleId: spec.ruleId,
      };
    }
  }

  if (isHcclLinkEstablishLine(normalizedLine, ctx)) {
    const info = inferHcclLinkMechanism(effectiveInspect, true);
    return {
      ...normalizedLine,
      kind: "cascade",
      signalTag: info.tag,
      mechanism: "link-establish-timeout",
      phase: "link-establish",
      peerRank,
      iface,
      port,
      ruleId: "hccl-link-or-ifname-fault",
    };
  }

  for (const { re, predicate, tag } of CASCADE_SIGNAL_PATTERNS) {
    const hit = predicate
      ? predicate(normalizedLine, ctx)
      : re?.test(effectiveInspect) &&
        !hasBenignZeroStatusOnly(effectiveInspect) &&
        !isBenignInfoOrDebugInitLine(effectiveInspect) &&
        (!/\b(?:EI0002|EI0006|HCCL_E_(?:WAIT_)?TIMEOUT|HCCL\s+error:\s*9\b|Notify wait execute timeout|Watchdog|monitoredBarrier)\b/i.test(
          effectiveInspect,
        ) ||
          isHcclTimeoutFaultLine(normalizedLine, ctx));
    if (hit) {
      const isParentCrashWrapper =
        /EngineCore(?:Proc)?\b|Engine core initialization failed|BrokenPipeError|ChildFailedError/i.test(tag);
      const isBareEi0006Phase =
        /\bEI0006\b/i.test(effectiveInspect) && !HCCL_EXEC_WAIT_QUALIFIER_RE.test(effectiveInspect);
      return {
        ...normalizedLine,
        kind: "cascade",
        signalTag: tag,
        mechanism: isParentCrashWrapper ? "other" : "wait-cascade",
        phase: isParentCrashWrapper ? "runtime" : isBareEi0006Phase ? "link-establish" : "collective-wait",
        peerRank,
        iface,
        port,
        ruleId: isParentCrashWrapper ? undefined : "hccl-timeout-cascade",
      };
    }
  }

  const strippedTerminal =
    line.tracebackGroupId !== null ? stripTracebackLogPrefix(effectiveInspect).trim() : "";
  const isBareTracebackTerminal =
    line.tracebackGroupId !== null &&
    !hasNullOrZeroExceptionValueOnly(effectiveInspect) &&
    TRACEBACK_UNPREFIXED_TERMINAL_RE.test(strippedTerminal);

  if (
    (GENERIC_RUNTIME_ERROR_RE.test(strippedTerminal || effectiveInspect) ||
      (isBareTracebackTerminal && /^RuntimeError\b/.test(strippedTerminal))) &&
    !hasNullOrZeroExceptionValueOnly(effectiveInspect) &&
    !hasBenignZeroStatusOnly(effectiveInspect) &&
    !hasBenignZeroCounterOnly(effectiveInspect)
  ) {
    return {
      ...normalizedLine,
      kind: "root-cause",
      signalTag: "RuntimeError",
      mechanism: "other",
      phase: "runtime",
      peerRank,
      iface,
      port,
    };
  }

  if (
    (hasGenuinePythonException(effectiveInspect) || isBareTracebackTerminal) &&
    !hasBenignZeroStatusOnly(effectiveInspect) &&
    !hasBenignZeroCounterOnly(effectiveInspect)
  ) {
    return {
      ...normalizedLine,
      kind: "root-cause",
      signalTag: "Python 硬异常",
      mechanism: "other",
      phase: "runtime",
      peerRank,
      iface,
      port,
    };
  }

  if (
    hasLogErrorSeverity(effectiveInspect) &&
    hasFailureSemantics(effectiveInspect) &&
    !isTracebackScaffoldLine(effectiveInspect)
  ) {
    return {
      ...normalizedLine,
      kind: "root-cause",
      signalTag: "未归类 ERROR 日志",
      mechanism: "other",
      phase: "runtime",
      peerRank,
      iface,
      port,
    };
  }

  return null;
}

function getClockTier(
  s: Pick<ParsedLogLine, "timestampMs" | "timestampKind" | "inferredYearMatched">,
): number {
  if (s.timestampMs === null) return 3;
  if (s.timestampKind === "time-only") return 2;
  if (s.timestampKind === "short-date" && !s.inferredYearMatched) return 1;
  return 0;
}

function hasLogicalCausalRank(sig: Pick<ParsedLogLine, "rank" | "rankSource">): boolean {
  return sig.rank !== null && sig.rankSource !== "worker-dp-pp" && sig.rankSource !== "device-id";
}

function hasUnanchoredDecJanRollover(
  sigs: readonly Pick<ParsedLogLine, "timestamp" | "timestampKind" | "inferredYearMatched">[],
): boolean {
  let hasDec = false;
  let hasJan = false;
  for (const s of sigs) {
    if (s.timestampKind === "short-date" && !s.inferredYearMatched && s.timestamp) {
      const m = Number.parseInt(s.timestamp.slice(0, 2), 10);
      if (m === 12) hasDec = true;
      else if (m === 1) hasJan = true;
      if (hasDec && hasJan) return true;
    }
  }
  return false;
}

function getShortDateMonth(s: Pick<ParsedLogLine, "timestamp" | "timestampKind">): number | null {
  if (s.timestampKind !== "short-date" || !s.timestamp) return null;
  const m = Number.parseInt(s.timestamp.slice(0, 2), 10);
  return Number.isInteger(m) ? m : null;
}

const JAN_ROLLOVER_ORDER_OFFSET_MS = 366 * 86_400_000;

function getSortableTimestampMs(
  s: Pick<ParsedLogLine, "timestamp" | "timestampMs" | "timestampKind" | "inferredYearMatched">,
  decJanRollover: boolean,
): number {
  const base = s.timestampMs!;
  if (
    decJanRollover &&
    s.timestampKind === "short-date" &&
    !s.inferredYearMatched &&
    getShortDateMonth(s) === 1
  ) {
    return base + JAN_ROLLOVER_ORDER_OFFSET_MS;
  }
  return base;
}

function compareSignalsChronologically(
  a: ClassifiedSignal,
  b: ClassifiedSignal,
  decJanRollover = false,
): number {
  const aTier = getClockTier(a);
  const bTier = getClockTier(b);
  if (aTier !== bTier) return aTier - bTier;
  if (a.timestampMs !== null && b.timestampMs !== null) {
    const aSortableMs = getSortableTimestampMs(a, decJanRollover);
    const bSortableMs = getSortableTimestampMs(b, decJanRollover);
    if (aSortableMs !== bSortableMs) return aSortableMs - bSortableMs;
    if (a.timestampSubMs !== b.timestampSubMs) return a.timestampSubMs - b.timestampSubMs;
    const kindDiff = (a.kind === "root-cause" ? 0 : 1) - (b.kind === "root-cause" ? 0 : 1);
    if (kindDiff !== 0) return kindDiff;
    const rankedDiff = (a.rank !== null ? 0 : 1) - (b.rank !== null ? 0 : 1);
    if (rankedDiff !== 0) return rankedDiff;
    if (a.rank !== null && b.rank !== null && a.rank !== b.rank) return a.rank - b.rank;
    const ruleDiff = (a.ruleId ?? "~").localeCompare(b.ruleId ?? "~");
    if (ruleDiff !== 0) return ruleDiff;
    const hostDiff = (a.hostTag ?? "").localeCompare(b.hostTag ?? "");
    if (hostDiff !== 0) return hostDiff;
    const lineTextDiff = a.rawLine.localeCompare(b.rawLine);
    if (lineTextDiff !== 0) return lineTextDiff;
  }
  return a.lineNumber - b.lineNumber;
}

function resolveSignalVisibleDevicesSignature(
  visCache: VisibleDevicesLookupCache | undefined,
  sig: ParsedLogLine,
  startupBoundaryBucket?: DomainIndexedBucket,
): string | null {
  if (!visCache || visCache.entries.length === 0) return null;
  let res = resolveVisibleDevicesForVerdict(visCache, sig, startupBoundaryBucket);
  if (
    res.visibleDevices === null &&
    !res.hasAmbiguousVisibleDevices &&
    sig.pid !== null &&
    (sig.instanceTag !== null || sig.hostTag !== null)
  ) {
    res = resolveVisibleDevicesForVerdict(visCache, { ...sig, pid: null }, startupBoundaryBucket);
  }
  if (res.visibleDevices) return res.visibleDevices.join(",");
  if (res.hasAmbiguousVisibleDevices) return "__AMBIG__";
  return null;
}

function arePhysicalScopesCompatible(
  a: ParsedLogLine,
  b: ParsedLogLine,
  visCache?: VisibleDevicesLookupCache,
  startupBoundaryBucket?: DomainIndexedBucket,
): boolean {
  if (!areCausalDomainsCompatible(a, b)) return false;
  const sameExplicitHost =
    a.hostTag !== null && b.hostTag !== null && a.hostTag.toLowerCase() === b.hostTag.toLowerCase();
  const sameExplicitInst =
    a.instanceTag !== null &&
    b.instanceTag !== null &&
    a.instanceTag.toLowerCase() === b.instanceTag.toLowerCase();
  const sameExplicitChassis =
    (sameExplicitHost && (a.instanceTag?.toLowerCase() ?? null) === (b.instanceTag?.toLowerCase() ?? null)) ||
    (sameExplicitInst && (a.hostTag?.toLowerCase() ?? null) === (b.hostTag?.toLowerCase() ?? null));
  if (
    !sameExplicitChassis &&
    a.pid !== null &&
    b.pid !== null &&
    a.pid !== b.pid &&
    a.rank !== null &&
    b.rank !== null &&
    a.rank === b.rank
  ) {
    return false;
  }
  if (!visCache || visCache.entries.length === 0) return true;
  const aSig = resolveSignalVisibleDevicesSignature(visCache, a, startupBoundaryBucket);
  const bSig = resolveSignalVisibleDevicesSignature(visCache, b, startupBoundaryBucket);
  if (aSig !== bSig) return false;
  return true;
}

interface LogScopeDomainCatalog {
  distinctHosts: ReadonlySet<string>;
  distinctInstances: ReadonlySet<string>;
  distinctGroups: ReadonlySet<string>;
  hasUngroupedScope: boolean;
  visDeclaredHosts: ReadonlySet<string>;
  visDeclaredInstances: ReadonlySet<string>;
  hasGlobalUnscopedVis: boolean;
}

function buildLogScopeDomainCatalog(
  lines: readonly ParsedLogLine[],
  visCache: VisibleDevicesLookupCache,
): LogScopeDomainCatalog {
  const distinctHosts = new Set<string>();
  const distinctInstances = new Set<string>();
  const distinctGroups = new Set<string>();
  let hasUngroupedScope = false;
  for (const l of lines) {
    if (l.isPromLine || l.trimmed.startsWith("#")) continue;
    if (l.hostTag !== null) distinctHosts.add(l.hostTag.toLowerCase());
    if (l.instanceTag !== null) distinctInstances.add(l.instanceTag.toLowerCase());
    if (l.groupTag !== null) distinctGroups.add(l.groupTag.toLowerCase());
    else if (l.rank !== null) hasUngroupedScope = true;
  }
  for (const e of visCache.entries) {
    if (e.hostTag !== null) distinctHosts.add(e.hostTag.toLowerCase());
    if (e.instanceTag !== null) distinctInstances.add(e.instanceTag.toLowerCase());
    if (e.groupTag !== null) distinctGroups.add(e.groupTag.toLowerCase());
    else hasUngroupedScope = true;
  }
  const visDeclaredHosts = new Set<string>(visCache.byHost.keys());
  const visDeclaredInstances = new Set<string>(visCache.byInstance.keys());
  const hasGlobalUnscopedVis = visCache.entries.some((e) => e.hostTag === null && e.instanceTag === null);
  return {
    distinctHosts,
    distinctInstances,
    distinctGroups,
    hasUngroupedScope,
    visDeclaredHosts,
    visDeclaredInstances,
    hasGlobalUnscopedVis,
  };
}

function hasUncoveredMultiScopeForTarget(
  visCache: VisibleDevicesLookupCache,
  target: Pick<ParsedLogLine, "hostTag" | "instanceTag"> | null,
  catalog: LogScopeDomainCatalog | undefined,
): boolean {
  if (!catalog || visCache.entries.length === 0) return false;
  if (
    (target === null || target.instanceTag === null) &&
    catalog.distinctInstances.size > 1 &&
    visCache.unscopedInstanceEntries.length === 0 &&
    catalog.visDeclaredInstances.size < catalog.distinctInstances.size
  ) {
    return true;
  }
  if (
    (target === null || target.hostTag === null) &&
    catalog.distinctHosts.size > 1 &&
    visCache.unscopedHostEntries.length === 0 &&
    catalog.visDeclaredHosts.size < catalog.distinctHosts.size
  ) {
    return true;
  }
  return false;
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

function getVisibleMapSlotConflictReason(
  sig: Pick<ParsedLogLine, "lineNumber" | "rank">,
  visibleDevices: readonly number[] | null,
  ctx?: LineScopeContext,
): "rank-out-of-bounds" | "hccn-device-mismatch" | null {
  if (sig.rank === null) return null;
  const hccnDev = ctx?.hccnDeviceByLine.get(sig.lineNumber);
  if (!visibleDevices) {
    if (hccnDev !== undefined) {
      const devNum = Number.parseInt(hccnDev, 10);
      if (!Number.isFinite(devNum) || devNum !== sig.rank) {
        return "hccn-device-mismatch";
      }
    }
    return null;
  }
  if (sig.rank < 0 || sig.rank >= visibleDevices.length) {
    return "rank-out-of-bounds";
  }
  if (hccnDev !== undefined) {
    const devNum = Number.parseInt(hccnDev, 10);
    if (!Number.isFinite(devNum) || visibleDevices[sig.rank] !== devNum || !visibleDevices.includes(devNum)) {
      return "hccn-device-mismatch";
    }
  }
  return null;
}

function isVisibleMapSlotCompatible(
  sig: Pick<ParsedLogLine, "lineNumber" | "rank">,
  visibleDevices: readonly number[] | null,
  ctx?: LineScopeContext,
): boolean {
  return getVisibleMapSlotConflictReason(sig, visibleDevices, ctx) === null;
}

function isSlotMappableSignal(
  sig: Pick<ParsedLogLine, "lineNumber" | "rank" | "rankSource" | "instanceTag">,
  anyHostTag: boolean,
  ctx?: LineScopeContext,
  hasMultipleInstances = false,
): boolean {
  if (sig.rank === null || anyHostTag) return false;
  if (hasMultipleInstances && sig.instanceTag === null) return false;
  if (ctx?.ambiguousDeviceLines.has(sig.lineNumber)) return false;
  return (
    sig.rankSource === "explicit-rank" ||
    sig.rankSource === "worker-tp" ||
    sig.rankSource === "worker-ep" ||
    sig.rankSource === "local-rank"
  );
}

interface AmbiguousPeerTargetOracle {
  hasUnranked: boolean;
  byRank: Map<number, DomainPresenceIndex>;
}

const ambiguousPeerOracleMemo = new WeakMap<readonly ClassifiedSignal[], AmbiguousPeerTargetOracle>();

function getAmbiguousPeerTargetOracle(
  ambiguousCompetingPrimaries: readonly ClassifiedSignal[],
): AmbiguousPeerTargetOracle {
  const cached = ambiguousPeerOracleMemo.get(ambiguousCompetingPrimaries);
  if (cached) return cached;
  let hasUnranked = false;
  const byRank = new Map<number, DomainPresenceIndex>();
  for (const p of ambiguousCompetingPrimaries) {
    if (activeScaleProbe) activeScaleProbe.cascadeCompetitorScans += 1;
    if (p.rank === null || p.rankSource === "worker-dp-pp") {
      hasUnranked = true;
      continue;
    }
    let idx = byRank.get(p.rank);
    if (!idx) {
      idx = createDomainPresenceIndex();
      byRank.set(p.rank, idx);
    }
    addToDomainPresenceIndex(idx, p);
  }
  const built: AmbiguousPeerTargetOracle = { hasUnranked, byRank };
  ambiguousPeerOracleMemo.set(ambiguousCompetingPrimaries, built);
  return built;
}

function classifyCascadeAgainstWinner(
  winner: ClassifiedSignal | null,
  cascade: ClassifiedSignal,
  winnerOrderAmbiguous = false,
  ambiguousCompetingPrimaries: readonly ClassifiedSignal[] = [],
  ctx?: LineScopeContext,
): "confirmed-after" | "earlier-than-primary" | "unverified-order" | "no-primary" {
  if (!winner || winner.rank === null) return "no-primary";
  if (
    !areScopeTagsCompatible(winner.instanceTag, cascade.instanceTag) ||
    !areScopeTagsCompatible(winner.groupTag, cascade.groupTag)
  ) {
    return "unverified-order";
  }
  if (isStrictlyEarlierTimestamp(cascade, winner)) {
    return "earlier-than-primary";
  }
  if (!hasLogicalCausalRank(winner)) {
    return "unverified-order";
  }
  if (
    cascade.rank !== null &&
    hasLogicalCausalRank(cascade) &&
    cascade.rank === winner.rank &&
    areCausalDomainsCompatible(winner, cascade)
  ) {
    return "unverified-order";
  }
  if (!areTimestampsComparable(winner, cascade)) {
    return "unverified-order";
  }
  if (
    cascade.timestampMs! < winner.timestampMs! ||
    (cascade.timestampMs! === winner.timestampMs! && cascade.timestampSubMs <= winner.timestampSubMs)
  ) {
    return "unverified-order";
  }
  if (!areCausalDomainsCompatible(winner, cascade)) {
    return "unverified-order";
  }
  if (!hasLogicalCausalRank(cascade)) {
    return "unverified-order";
  }
  if (ctx && hasStartupBoundaryBetween(ctx.startupBoundaryBucket, winner, cascade, true)) {
    return "unverified-order";
  }
  if (cascade.peerRank !== null && cascade.peerRank !== winner.rank) {
    return "unverified-order";
  }
  if (winnerOrderAmbiguous) {
    if (cascade.peerRank !== winner.rank) {
      return "unverified-order";
    }
    if (activeScaleProbe) activeScaleProbe.cascadeCompetitorScans += 1;
    const oracle = getAmbiguousPeerTargetOracle(ambiguousCompetingPrimaries);
    if (oracle.hasUnranked) {
      return "unverified-order";
    }
    const rankDomIdx = oracle.byRank.get(winner.rank);
    if (rankDomIdx && hasCompatibleDomainInPresenceIndex(rankDomIdx, cascade)) {
      return "unverified-order";
    }
  }
  return "confirmed-after";
}

function deriveEventFaultMechanism(
  sig: ClassifiedSignal,
  kind: FaultTimelineEventKind,
): "hccl-link" | "hccl-wait-cascade" | "general" {
  if (sig.mechanism === "link-peer-refused") {
    return "hccl-wait-cascade";
  }
  if (sig.ruleId === "hccl-link-or-ifname-fault") {
    return kind === "root-cause" ? "hccl-link" : "hccl-wait-cascade";
  }
  if (sig.mechanism === "wait-cascade" || sig.ruleId === "hccl-timeout-cascade") {
    return "hccl-wait-cascade";
  }
  return "general";
}

function buildFaultTimelineEvents(
  signals: readonly ClassifiedSignal[],
  winner: ClassifiedSignal | null,
  anyHostTag: boolean,
  winnerOrderAmbiguous = false,
  ambiguousCompetingPrimaries: readonly ClassifiedSignal[] = [],
  visibleDeviceEntries: readonly VisibleDevicesEntry[] | VisibleDevicesLookupCache = [],
  verdictVisibleDevices: readonly number[] | null = null,
  verdictScopeTarget: Pick<ParsedLogLine, "hostTag" | "instanceTag" | "groupTag"> | null = winner,
  hasGlobalAmbiguousVisibleDevices = false,
  referenceRoot: ClassifiedSignal | null = winner,
  ctx?: LineScopeContext,
  domainCatalog?: LogScopeDomainCatalog,
): FaultTimelineEvent[] {
  const orderRef = referenceRoot ?? winner;
  const untimestampedRootFirst = orderRef === null || orderRef.timestampMs === null;
  const decJanRollover = hasUnanchoredDecJanRollover(signals);
  const visibleDevicesCache = Array.isArray(visibleDeviceEntries)
    ? createVisibleDevicesCache(visibleDeviceEntries, ctx?.processResetBucket)
    : (visibleDeviceEntries as VisibleDevicesLookupCache);
  const hasMultipleInstances = domainCatalog
    ? domainCatalog.distinctInstances.size > 1
    : (() => {
        const insts = new Set<string>();
        for (const s of signals) {
          if (s.instanceTag !== null) insts.add(s.instanceTag.toLowerCase());
        }
        for (const e of visibleDevicesCache.entries) {
          if (e.instanceTag !== null) insts.add(e.instanceTag.toLowerCase());
        }
        return insts.size > 1;
      })();
  const sorted = [...signals].sort((a, b) => {
    const aTier = untimestampedRootFirst && a.kind === "root-cause" && a.timestampMs === null ? 0 : 1;
    const bTier = untimestampedRootFirst && b.kind === "root-cause" && b.timestampMs === null ? 0 : 1;
    if (aTier !== bTier) return aTier - bTier;
    return compareSignalsChronologically(a, b, decJanRollover);
  });
  const compressed: FaultTimelineEvent[] = [];
  const seenRankRole = new Set<string>();
  const primaryScopeKeyByLine = new Map<number, string>();
  let winnerEvent: FaultTimelineEvent | null = null;
  const hasVisibleDeviceMap = visibleDevicesCache.entries.length > 0;

  for (const sig of sorted) {
    let kind: FaultTimelineEventKind;
    if (sig.kind === "root-cause") {
      kind = "root-cause";
    } else {
      const rel = classifyCascadeAgainstWinner(
        winner,
        sig,
        winnerOrderAmbiguous,
        ambiguousCompetingPrimaries,
        ctx,
      );
      kind =
        rel === "confirmed-after"
          ? "confirmed-cascade"
          : rel === "earlier-than-primary"
            ? "pre-existing-timeout"
            : "unattributed-cascade";
    }

    const evtVisibleDevices = resolveVisibleDevicesForVerdict(
      visibleDevicesCache,
      sig,
      ctx?.startupBoundaryBucket,
    );
    const evtDevs = evtVisibleDevices.visibleDevices;
    const incompatibleDomainWithVerdict =
      verdictScopeTarget !== null && !areCausalDomainsCompatible(verdictScopeTarget, sig);
    const differsFromVerdictVisibleDevices =
      verdictVisibleDevices !== null &&
      evtDevs !== null &&
      (evtDevs.length !== verdictVisibleDevices.length ||
        evtDevs.some((dev, idx) => dev !== verdictVisibleDevices[idx]));
    const unresolvedUnderVisibleMap =
      hasGlobalAmbiguousVisibleDevices ||
      hasUncoveredMultiScopeForTarget(visibleDevicesCache, sig, domainCatalog) ||
      (hasVisibleDeviceMap &&
        (verdictVisibleDevices === null || evtVisibleDevices.hasAmbiguousVisibleDevices || evtDevs === null));
    const evt: FaultTimelineEvent = {
      id: `evt-L${sig.lineNumber}-R${sig.rank ?? "na"}`,
      lineNumber: sig.lineNumber,
      timestamp: sig.timestamp,
      timestampMs: sig.timestampMs,
      rank: sig.rank,
      rankSource: sig.rankSource,
      slotMappable:
        !unresolvedUnderVisibleMap &&
        !differsFromVerdictVisibleDevices &&
        !incompatibleDomainWithVerdict &&
        isVisibleMapSlotCompatible(sig, evtDevs, ctx) &&
        isSlotMappableSignal(sig, anyHostTag, ctx, hasMultipleInstances),
      kind,
      signalTag: sig.signalTag,
      rawLine: sig.rawLine.trim(),
      faultMechanism: deriveEventFaultMechanism(sig, kind),
      mechanism: sig.mechanism,
      phase: sig.phase,
      peerRank: sig.peerRank,
      iface: sig.iface,
      port: sig.port,
      hostTag: sig.hostTag,
      instanceTag: sig.instanceTag,
      groupTag: sig.groupTag,
      ruleId: sig.ruleId,
      evidenceLine: sig.lineNumber,
    };

    const isWinnerLine = Boolean(winner && sig.lineNumber === winner.lineNumber && sig.kind === "root-cause");
    if (isWinnerLine) {
      winnerEvent = evt;
    }

    const pidVisSuffix = sig.pid !== null ? `#pid-${sig.pid}` : "";
    const evtVisKey = evtDevs ? `${evtDevs.join(",")}${pidVisSuffix}` : pidVisSuffix.slice(1);
    primaryScopeKeyByLine.set(
      sig.lineNumber,
      `${(sig.hostTag ?? "local").toLowerCase()}:${(sig.instanceTag ?? "").toLowerCase()}:${(sig.groupTag ?? "").toLowerCase()}:${evtVisKey}:${sig.rank ?? `line-${sig.lineNumber}`}`,
    );

    // Compress repeated lines per (host, instance, group, visMap, rank, kind, rule, mechanism, phase, endpoint, peerRank) BEFORE applying the 16-event cap
    const roleRankKey =
      sig.rankSource === "worker-dp-pp"
        ? `coord-${sig.lineNumber}`
        : sig.rankSource === "device-id"
          ? `dev-${sig.rank}`
          : (sig.rank ?? `line-${sig.lineNumber}`);
    const roleKey = `${sig.hostTag ?? "local"}:${sig.instanceTag ?? ""}:${sig.groupTag ?? ""}:${evtVisKey}:${roleRankKey}:${kind}:${sig.ruleId ?? sig.signalTag}:${sig.mechanism}:${sig.phase}:${sig.iface ?? ""}:${sig.port ?? ""}:${sig.peerRank ?? ""}`;
    if (seenRankRole.has(roleKey) && !isWinnerLine) continue;
    seenRankRole.add(roleKey);
    compressed.push(evt);
  }

  if (compressed.length <= 16) return compressed;
  const retainedIndices = new Set<number>();
  const retainedPrimaryScopes = new Set<string>();
  if (winnerEvent) {
    const winnerIdx = compressed.findIndex((e) => e.lineNumber === winnerEvent.lineNumber);
    if (winnerIdx >= 0) {
      retainedIndices.add(winnerIdx);
      retainedPrimaryScopes.add(
        primaryScopeKeyByLine.get(winnerEvent.lineNumber) ??
          `${winnerEvent.hostTag ?? "local"}:${winnerEvent.rank ?? `line-${winnerEvent.lineNumber}`}`,
      );
    }
  }
  for (let i = 0; i < compressed.length && retainedIndices.size < 16; i += 1) {
    const evt = compressed[i]!;
    if (evt.kind !== "root-cause") continue;
    const scopeKey =
      primaryScopeKeyByLine.get(evt.lineNumber) ??
      `${evt.hostTag ?? "local"}:${evt.rank ?? `line-${evt.lineNumber}`}`;
    if (retainedPrimaryScopes.has(scopeKey)) continue;
    retainedPrimaryScopes.add(scopeKey);
    retainedIndices.add(i);
  }
  for (let i = 0; i < compressed.length && retainedIndices.size < 16; i += 1) {
    if (retainedIndices.has(i) || compressed[i]!.kind !== "root-cause") continue;
    retainedIndices.add(i);
  }
  for (let i = 0; i < compressed.length && retainedIndices.size < 16; i += 1) {
    retainedIndices.add(i);
  }
  return [...retainedIndices].sort((a, b) => a - b).map((idx) => compressed[idx]!);
}

function formatApiServerProcessKey(
  l: Pick<ParsedLogLine, "hostTag" | "instanceTag" | "groupTag" | "pid">,
): string {
  return `${(l.hostTag ?? "").toLowerCase()}#${(l.instanceTag ?? "").toLowerCase()}#${(l.groupTag ?? "").toLowerCase()}#${l.pid ?? "na"}`;
}

interface VerdictSelection {
  primaries: ClassifiedSignal[];
  cascades: ClassifiedSignal[];
  rankedPrimaries: ClassifiedSignal[];
  unrankedPrimaries: ClassifiedSignal[];
  rankedWinner: ClassifiedSignal | null;
  anyPrimary: ClassifiedSignal | null;
  earlierTimestampedUnranked: ClassifiedSignal | null;
  hasEarlierOrAmbiguousUnrankedPrimary: boolean;
  hasMultiPrimaryTimingAmbiguity: boolean;
  hasAmbiguousTracebackPrimary: boolean;
  winnerOrderAmbiguous: boolean;
  ambiguousCompetingPrimaries: ClassifiedSignal[];
  tiedCompetingRankedPrimaries: ClassifiedSignal[];
  simultaneousDistinctRankTies: ClassifiedSignal[];
  simultaneousUnrankedTies: ClassifiedSignal[];
  incomparableClockDistinctRankTies: ClassifiedSignal[];
  crossDomainDistinctRankTies: ClassifiedSignal[];
  incomparableClockSameRankTies: ClassifiedSignal[];
  simultaneousCrossDomainSameRankTies: ClassifiedSignal[];
}

function selectPrimaryWinner(
  signals: readonly ClassifiedSignal[],
  visCache?: VisibleDevicesLookupCache,
  recoveredApiErrorLines?: ReadonlySet<number>,
  startupBoundaryBucket?: DomainIndexedBucket,
): VerdictSelection {
  const decJanRollover = hasUnanchoredDecJanRollover(signals);
  const primaries = signals
    .filter((s) => s.kind === "root-cause")
    .sort((a, b) => compareSignalsChronologically(a, b, decJanRollover));
  const cascades = signals
    .filter((s) => s.kind === "cascade")
    .sort((a, b) => compareSignalsChronologically(a, b, decJanRollover));
  const rankedPrimaries = primaries.filter((s) => s.rank !== null && s.rankSource !== "worker-dp-pp");
  const unrankedPrimaries = primaries.filter((s) => s.rank === null || s.rankSource === "worker-dp-pp");
  const hasAmbiguousTracebackPrimary = primaries.some((s) => Boolean(s.ambiguousTraceback));

  if (rankedPrimaries.length === 0) {
    return {
      primaries,
      cascades,
      rankedPrimaries,
      unrankedPrimaries,
      rankedWinner: null,
      anyPrimary: primaries[0] ?? null,
      earlierTimestampedUnranked: null,
      hasEarlierOrAmbiguousUnrankedPrimary: unrankedPrimaries.length > 0,
      hasMultiPrimaryTimingAmbiguity: false,
      hasAmbiguousTracebackPrimary,
      winnerOrderAmbiguous: primaries.length > 1,
      ambiguousCompetingPrimaries: primaries.slice(1),
      tiedCompetingRankedPrimaries: [],
      simultaneousDistinctRankTies: [],
      simultaneousUnrankedTies: [],
      incomparableClockDistinctRankTies: [],
      crossDomainDistinctRankTies: [],
      incomparableClockSameRankTies: [],
      simultaneousCrossDomainSameRankTies: [],
    };
  }

  const earliest = rankedPrimaries[0]!;
  const scopeKeyMemo = new Map<number, string>();
  const primaryScopeKey = (s: ClassifiedSignal): string => {
    const cachedKey = scopeKeyMemo.get(s.lineNumber);
    if (cachedKey !== undefined) return cachedKey;
    const visSig = resolveSignalVisibleDevicesSignature(visCache, s, startupBoundaryBucket);
    const pidScope = `${visSig ?? ""}${s.pid !== null ? `#pid-${s.pid}` : ""}`;
    const built = `${(s.hostTag ?? "").toLowerCase()}#${(s.instanceTag ?? "").toLowerCase()}#${(s.groupTag ?? "").toLowerCase()}#${pidScope}#${s.rank !== null && s.rankSource !== "worker-dp-pp" ? s.rank : "unranked"}`;
    scopeKeyMemo.set(s.lineNumber, built);
    return built;
  };
  const winnerScopeKey = primaryScopeKey(earliest);
  const otherPrimaryScopes = new Set(
    rankedPrimaries.map(primaryScopeKey).filter((k) => k !== winnerScopeKey),
  );
  const isAliveMultiErrorApiFrontend = (p: ClassifiedSignal): boolean =>
    p.ruleId === undefined &&
    p.rank === null &&
    p.pid !== null &&
    earliest.ruleId !== undefined &&
    /\(APIServer\b/i.test(p.inspectLine) &&
    Boolean(recoveredApiErrorLines?.has(p.lineNumber));
  const earlierTimestampedUnrankedList = unrankedPrimaries.filter(
    (p) =>
      !isAliveMultiErrorApiFrontend(p) &&
      areTimestampsComparable(p, earliest) &&
      isStrictlyEarlierTimestamp(p, earliest),
  );
  const earlierTimestampedUnranked = earlierTimestampedUnrankedList[0] ?? null;
  const simultaneousUnrankedTies = unrankedPrimaries.filter(
    (p) =>
      !isAliveMultiErrorApiFrontend(p) &&
      areTimestampsComparable(p, earliest) &&
      p.timestampMs === earliest.timestampMs &&
      p.timestampSubMs === earliest.timestampSubMs,
  );
  const ambiguousUnrankedPrimaries = unrankedPrimaries.filter(
    (p) =>
      !isAliveMultiErrorApiFrontend(p) &&
      (!areTimestampsComparable(earliest, p) || !isStrictlyEarlierTimestamp(earliest, p)),
  );
  const hasEarlierOrAmbiguousUnrankedPrimary = ambiguousUnrankedPrimaries.length > 0;
  const tiedCompetingRankedPrimaries = rankedPrimaries.filter(
    (s) =>
      primaryScopeKey(s) !== winnerScopeKey &&
      (!areTimestampsComparable(earliest, s) || !isStrictlyEarlierTimestamp(earliest, s)),
  );
  const simultaneousDistinctRankTies = rankedPrimaries.filter(
    (s) =>
      s.rank !== earliest.rank &&
      areTimestampsComparable(earliest, s) &&
      s.timestampMs === earliest.timestampMs &&
      s.timestampSubMs === earliest.timestampSubMs,
  );
  const incomparableClockDistinctRankTies = rankedPrimaries.filter(
    (s) =>
      s.rank !== earliest.rank &&
      earliest.timestampMs !== null &&
      s.timestampMs !== null &&
      !areTimestampsComparable(earliest, s) &&
      getClockTier(earliest) === getClockTier(s),
  );
  const crossDomainDistinctRankTies = rankedPrimaries.filter(
    (s) =>
      s.rank !== earliest.rank &&
      !arePhysicalScopesCompatible(earliest, s, visCache, startupBoundaryBucket) &&
      (!areTimestampsComparable(earliest, s) || !isStrictlyEarlierTimestamp(earliest, s)),
  );
  const incomparableClockSameRankTies = rankedPrimaries.filter(
    (s) =>
      s.lineNumber !== earliest.lineNumber &&
      s.rank === earliest.rank &&
      earliest.timestampMs !== null &&
      s.timestampMs !== null &&
      !areTimestampsComparable(earliest, s) &&
      getClockTier(earliest) === getClockTier(s),
  );
  const simultaneousCrossDomainSameRankTies = rankedPrimaries.filter(
    (s) =>
      s.lineNumber !== earliest.lineNumber &&
      s.rank === earliest.rank &&
      !arePhysicalScopesCompatible(earliest, s, visCache, startupBoundaryBucket) &&
      (!areTimestampsComparable(earliest, s) || !isStrictlyEarlierTimestamp(earliest, s)),
  );
  const hasTiedCompetingPrimaryScope = tiedCompetingRankedPrimaries.length > 0;
  const allRankedPrimariesTimestamped = rankedPrimaries.every((s) => s.timestampMs !== null);
  const hasMultiPrimaryTimingAmbiguity =
    otherPrimaryScopes.size > 0 && (!allRankedPrimariesTimestamped || hasTiedCompetingPrimaryScope);
  const winnerOrderAmbiguous =
    hasEarlierOrAmbiguousUnrankedPrimary ||
    hasMultiPrimaryTimingAmbiguity ||
    incomparableClockSameRankTies.length > 0;
  const seenAmbigLines = new Set<number>();
  const ambiguousCompetingPrimaries: ClassifiedSignal[] = [];
  for (const s of [
    ...ambiguousUnrankedPrimaries,
    ...tiedCompetingRankedPrimaries,
    ...incomparableClockSameRankTies,
    ...(hasMultiPrimaryTimingAmbiguity
      ? rankedPrimaries.filter((s) => primaryScopeKey(s) !== winnerScopeKey && s.timestampMs === null)
      : []),
  ]) {
    if (seenAmbigLines.has(s.lineNumber)) continue;
    seenAmbigLines.add(s.lineNumber);
    ambiguousCompetingPrimaries.push(s);
  }

  const blocksUniqueRankedWinner =
    earlierTimestampedUnranked !== null ||
    simultaneousUnrankedTies.length > 0 ||
    simultaneousDistinctRankTies.length > 0 ||
    incomparableClockDistinctRankTies.length > 0 ||
    crossDomainDistinctRankTies.length > 0;

  return {
    primaries,
    cascades,
    rankedPrimaries,
    unrankedPrimaries,
    rankedWinner: blocksUniqueRankedWinner ? null : earliest,
    anyPrimary: earlierTimestampedUnranked ?? primaries[0] ?? earliest,
    earlierTimestampedUnranked,
    hasEarlierOrAmbiguousUnrankedPrimary,
    hasMultiPrimaryTimingAmbiguity,
    hasAmbiguousTracebackPrimary,
    winnerOrderAmbiguous,
    ambiguousCompetingPrimaries,
    tiedCompetingRankedPrimaries,
    simultaneousDistinctRankTies,
    simultaneousUnrankedTies,
    incomparableClockDistinctRankTies,
    crossDomainDistinctRankTies,
    incomparableClockSameRankTies,
    simultaneousCrossDomainSameRankTies,
  };
}

function resolveSharedVisibleDevicesForPool(
  visCache: VisibleDevicesLookupCache,
  pool: readonly ClassifiedSignal[],
  startupBoundaryBucket?: DomainIndexedBucket,
): { visibleDevices: number[] | null; hasAmbiguousVisibleDevices: boolean } {
  if (visCache.entries.length === 0) {
    return { visibleDevices: null, hasAmbiguousVisibleDevices: false };
  }
  if (pool.length === 0) {
    return resolveVisibleDevicesForVerdict(visCache, null, startupBoundaryBucket);
  }
  let sharedDevs: number[] | null = null;
  let sharedSig: string | null = null;
  const seenScopeKeys = new Set<string>();
  for (const anchor of pool) {
    const scopeKey = `${(anchor.hostTag ?? "").toLowerCase()}#${(anchor.instanceTag ?? "").toLowerCase()}#${(anchor.groupTag ?? "").toLowerCase()}#${anchor.pid ?? ""}`;
    if (seenScopeKeys.has(scopeKey)) continue;
    seenScopeKeys.add(scopeKey);
    const r = resolveVisibleDevicesForVerdict(visCache, anchor, startupBoundaryBucket);
    if (r.hasAmbiguousVisibleDevices || !r.visibleDevices) {
      return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
    }
    const sig = r.visibleDevices.join(",");
    if (sharedSig === null) {
      sharedSig = sig;
      sharedDevs = r.visibleDevices;
    } else if (sharedSig !== sig) {
      return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
    }
  }
  if (!sharedDevs) {
    return { visibleDevices: null, hasAmbiguousVisibleDevices: true };
  }
  return { visibleDevices: sharedDevs, hasAmbiguousVisibleDevices: false };
}

function describePrimaryCandidate(s: ClassifiedSignal): string {
  const hostPrefix = s.hostTag ? `${s.hostTag} ` : "";
  const rankLabel = s.rank !== null && s.rankSource !== "worker-dp-pp" ? `Rank ${s.rank}` : "未归属卡";
  const tsLabel = s.timestamp ? `（${s.timestamp}，第 ${s.lineNumber} 行）` : `（第 ${s.lineNumber} 行）`;
  return `${hostPrefix}${rankLabel}「${s.signalTag}」${tsLabel}`;
}

function computeFirstFaultVerdict(
  signals: readonly ClassifiedSignal[],
  anyHostTag = false,
  hasAmbiguousVisibleDevices = false,
  visibleDeviceEntries: readonly VisibleDevicesEntry[] | VisibleDevicesLookupCache = [],
  ctx?: LineScopeContext,
  recoveredApiErrorLines?: ReadonlySet<number>,
  domainCatalog?: LogScopeDomainCatalog,
): FirstFaultVerdict {
  const visCache = Array.isArray(visibleDeviceEntries)
    ? createVisibleDevicesCache(visibleDeviceEntries, ctx?.processResetBucket)
    : (visibleDeviceEntries as VisibleDevicesLookupCache);
  const hasMultipleInstances = domainCatalog
    ? domainCatalog.distinctInstances.size > 1
    : (() => {
        const insts = new Set<string>();
        for (const s of signals) {
          if (s.instanceTag !== null) insts.add(s.instanceTag.toLowerCase());
        }
        for (const e of visCache.entries) {
          if (e.instanceTag !== null) insts.add(e.instanceTag.toLowerCase());
        }
        return insts.size > 1;
      })();
  const {
    primaries,
    cascades,
    rankedPrimaries,
    rankedWinner,
    earlierTimestampedUnranked,
    hasEarlierOrAmbiguousUnrankedPrimary,
    hasMultiPrimaryTimingAmbiguity,
    hasAmbiguousTracebackPrimary,
    winnerOrderAmbiguous,
    ambiguousCompetingPrimaries,
    tiedCompetingRankedPrimaries,
    simultaneousDistinctRankTies,
    simultaneousUnrankedTies,
    incomparableClockDistinctRankTies,
    crossDomainDistinctRankTies,
    incomparableClockSameRankTies,
    simultaneousCrossDomainSameRankTies,
  } = selectPrimaryWinner(signals, visCache, recoveredApiErrorLines, ctx?.startupBoundaryBucket);

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

  if (rankedWinner !== null) {
    const earliest = rankedWinner;
    const winnerRank = earliest.rank!;

    const cascadeRankSet = new Set<number>();
    const unverifiedCascadeRankSet = new Set<number>();
    let hasEarlierCascade = false;
    let hasUnverifiedCascade = false;
    let hasUnrankedUnverified = false;
    for (const c of cascades) {
      const rel = classifyCascadeAgainstWinner(
        earliest,
        c,
        winnerOrderAmbiguous,
        ambiguousCompetingPrimaries,
        ctx,
      );
      if (rel === "earlier-than-primary") {
        hasEarlierCascade = true;
        continue;
      }
      const isSameWinner =
        hasLogicalCausalRank(c) && c.rank === winnerRank && areCausalDomainsCompatible(earliest, c);
      if (isSameWinner) continue;
      if (rel === "confirmed-after" && hasLogicalCausalRank(c)) {
        cascadeRankSet.add(c.rank!);
      } else if (hasLogicalCausalRank(c)) {
        hasUnverifiedCascade = true;
        unverifiedCascadeRankSet.add(c.rank!);
      } else {
        const isConfirmedPostParentExit =
          c.mechanism === "other" &&
          /EngineCore(?:Proc)?\b|Engine core initialization failed|BrokenPipeError|ChildFailedError/i.test(
            c.signalTag,
          ) &&
          areCausalDomainsCompatible(earliest, c) &&
          isStrictlyEarlierTimestamp(earliest, c);
        if (!isConfirmedPostParentExit) {
          hasUnrankedUnverified = true;
        }
      }
    }
    const cascadeRanks = [...cascadeRankSet].sort((a, b) => a - b);
    const unverifiedRanks = [...unverifiedCascadeRankSet].sort((a, b) => a - b);

    const cascadeCausalState: CascadeCausalState = hasEarlierCascade
      ? "earlier-than-primary"
      : cascadeRanks.length > 0
        ? "confirmed-after"
        : hasUnverifiedCascade || hasUnrankedUnverified || cascades.length > 0
          ? "unverified-order"
          : "confirmed-after";

    const crossDomainTieBlocksPhysical = simultaneousCrossDomainSameRankTies.length > 0;
    const hasIncomparableClockSameRankTie = incomparableClockSameRankTies.length > 0;
    const tiedCompetePool = ambiguousCompetingPrimaries;
    const hasCompetingHostTie =
      tiedCompetePool.length > 0 &&
      tiedCompetePool.some(
        (p) => (p.hostTag?.toLowerCase() ?? null) !== (earliest.hostTag?.toLowerCase() ?? null),
      );
    const hasCompetingInstTie =
      tiedCompetePool.length > 0 &&
      tiedCompetePool.some(
        (p) => (p.instanceTag?.toLowerCase() ?? null) !== (earliest.instanceTag?.toLowerCase() ?? null),
      );
    const verdictHostTag = hasCompetingHostTie ? null : earliest.hostTag;
    const verdictInstanceTag = hasCompetingInstTie ? null : earliest.instanceTag;
    const hasUnattributedMultiInstSlotBlock = hasMultipleInstances && verdictInstanceTag === null;
    const verdictScopeAnchor =
      crossDomainTieBlocksPhysical || hasCompetingHostTie || hasCompetingInstTie ? null : earliest;
    const verdictVisRes = resolveVisibleDevicesForVerdict(
      visCache,
      verdictScopeAnchor,
      ctx?.startupBoundaryBucket,
    );
    const verdictVisibleDevices = verdictVisRes.visibleDevices;
    const compatibleVisEntries = verdictScopeAnchor
      ? visCache.entries.filter(
          (e) =>
            areCausalDomainsCompatible(verdictScopeAnchor, e) &&
            (verdictScopeAnchor.pid === null || e.pid === null || verdictScopeAnchor.pid === e.pid),
        )
      : visCache.entries;
    const pidScopedVisEntries =
      verdictScopeAnchor && verdictScopeAnchor.pid !== null
        ? compatibleVisEntries.filter((e) => e.pid === verdictScopeAnchor.pid)
        : [];
    const relevantVisEntries = pidScopedVisEntries.length > 0 ? pidScopedVisEntries : compatibleVisEntries;
    const distinctVisMapSigs = new Set(
      relevantVisEntries.map((e) => (e.valid && e.devices ? e.devices.join(",") : "__INVALID__")),
    );
    const hasInvalidVisMapConfig = distinctVisMapSigs.has("__INVALID__");
    const hasMultipleVisMapConfigs = distinctVisMapSigs.size > 1;
    const hasUncoveredScopeVis = hasUncoveredMultiScopeForTarget(visCache, verdictScopeAnchor, domainCatalog);
    const hasDifferentVisMaps =
      hasAmbiguousVisibleDevices ||
      hasUncoveredScopeVis ||
      verdictVisRes.hasAmbiguousVisibleDevices ||
      (visCache.entries.length > 0 && verdictVisibleDevices === null);
    const hasMultiInstAmbiguousVis =
      verdictInstanceTag === null &&
      (hasMultipleInstances ||
        visCache.entries.reduce((s, e) => {
          if (e.instanceTag !== null) s.add(e.instanceTag.toLowerCase());
          return s;
        }, new Set<string>()).size > 1);
    const hasEffectiveAmbigVis =
      hasDifferentVisMaps || crossDomainTieBlocksPhysical || hasMultiInstAmbiguousVis;
    const isAmbiguousHccnDevice = Boolean(ctx?.ambiguousDeviceLines.has(earliest.lineNumber));
    const visSlotConflictReason = getVisibleMapSlotConflictReason(earliest, verdictVisibleDevices, ctx);

    const slotMappable =
      !hasEffectiveAmbigVis &&
      !hasUnattributedMultiInstSlotBlock &&
      visSlotConflictReason === null &&
      isSlotMappableSignal(earliest, anyHostTag, ctx, hasMultipleInstances);
    const confidence: FirstFaultConfidence =
      !hasEarlierCascade &&
      !hasUnverifiedCascade &&
      !hasUnrankedUnverified &&
      !hasEarlierOrAmbiguousUnrankedPrimary &&
      !hasMultiPrimaryTimingAmbiguity &&
      !hasIncomparableClockSameRankTie &&
      !hasAmbiguousTracebackPrimary &&
      !crossDomainTieBlocksPhysical &&
      slotMappable
        ? "high"
        : "medium";

    const scopeKeyOf = (s: ClassifiedSignal): string =>
      `${(s.hostTag ?? "").toLowerCase()}#${(s.instanceTag ?? "").toLowerCase()}#${(s.groupTag ?? "").toLowerCase()}#${s.rank ?? "na"}`;
    const earliestScopeKey = scopeKeyOf(earliest);
    const seenCompetingKeys = new Set<string>([earliestScopeKey]);
    const otherHostPrimaries: ClassifiedSignal[] = [];
    for (const p of primaries) {
      const sk = scopeKeyOf(p);
      if (seenCompetingKeys.has(sk)) continue;
      seenCompetingKeys.add(sk);
      if (p.hostTag && (!earliest.hostTag || p.hostTag.toLowerCase() !== earliest.hostTag.toLowerCase())) {
        otherHostPrimaries.push(p);
      }
    }

    const tiedRankLabels = tiedCompetingRankedPrimaries.slice(0, 3).map(describePrimaryCandidate);
    const otherHostLabels = otherHostPrimaries.slice(0, 3).map(describePrimaryCandidate);

    const tsNote = earliest.timestamp ? `于 ${earliest.timestamp}` : "最早";
    const cascadeNote = hasEarlierCascade
      ? "；注意日志中存在时间更早的其他卡超时记录，不能将早发生的超时反推为本次晚发错误的结果，请核对完整时间线。"
      : cascadeRanks.length > 0
        ? `；Rank ${cascadeRanks.join(" / ")} 的集合通信超时或连带退出在时间上晚于首错卡，属于等待同步的次生症状。`
        : unverifiedRanks.length > 0
          ? `；另见 Rank ${unverifiedRanks.join(" / ")} 报等待超时，但缺少同域双端时间戳或目标 Rank 不匹配，先后因果待完整时间线确认。`
          : hasUnrankedUnverified
            ? "；另见仅带设备/DP标识或未带 Rank 的等待超时信号，缺少明确属主或时序依据，因果待完整时间线确认。"
            : "；其余卡未见更早的主错误。";
    const unrankedPrimaryNote = hasEarlierOrAmbiguousUnrankedPrimary
      ? "（另见时间更早或无时间戳的未标注 Rank 主报错，先后归属待补全 Rank 前缀后确认）"
      : "";
    const tiedOrMultiScopeNote =
      tiedRankLabels.length > 0
        ? `（同刻并发未决并存候选：${describePrimaryCandidate(earliest)} 与 ${tiedRankLabels.join("、")} 同刻出现或缺少可比时钟，不能仅凭粘贴顺序判定唯一先发，置信度降为中等）`
        : hasIncomparableClockSameRankTie
          ? `（同 Rank 存在跨月/跨年无锚点时间戳并存：${incomparableClockSameRankTies.slice(0, 2).map(describePrimaryCandidate).join("、")}，无法仅凭月日确认绝对年份先后，置信度降为中等）`
          : hasMultiPrimaryTimingAmbiguity
            ? "（另见其他实例或卡主报错缺少独立时间戳、时钟格式混用或同刻并发，置信度降为中等）"
            : "";
    const otherHostNote =
      otherHostLabels.length > 0
        ? `；同时在跨节点/对端检测到独立并发主报错：${otherHostLabels.join("；")}`
        : "";
    const tbAmbiguousNote = hasAmbiguousTracebackPrimary
      ? "（存在多卡并发 Traceback 交错，未带前置标签的异常堆栈行已按 Rank 待定降置信处理）"
      : "";
    const hasSharedDeclaredVis = visCache.entries.length > 0 && verdictVisibleDevices !== null;
    const scopeNote = !slotMappable
      ? hasDifferentVisMaps
        ? hasMultipleVisMapConfigs
          ? "（日志跨实例或进程存在多个不同的 ASCEND_RT_VISIBLE_DEVICES 映射且故障行未唯一归属，物理槽位暂不自动映射）"
          : hasInvalidVisMapConfig
            ? "（日志存在无效的 ASCEND_RT_VISIBLE_DEVICES 映射或未解析覆盖，物理槽位暂不自动映射）"
            : "（日志中 ASCEND_RT_VISIBLE_DEVICES 声明晚于首错、属于其他进程或跨节选/重启边界，无法可靠映射到该故障时刻的物理槽位）"
        : hasMultiInstAmbiguousVis
          ? "（日志存在多个实例作用域的 ASCEND_RT_VISIBLE_DEVICES 映射且当前故障未明确归属实例，物理槽位暂不自动映射）"
          : crossDomainTieBlocksPhysical
            ? hasSharedDeclaredVis
              ? "（日志存在多个同刻并发进程均绑定同 Rank 且共享当前可见设备集合，进程归属未唯一收敛，物理槽位暂不自动映射）"
              : "（日志存在多个同刻并发实例或进程均绑定同 Rank，缺少可区分的物理卡映射或隔离信息，物理槽位暂不自动映射）"
            : isAmbiguousHccnDevice
              ? "（同域存在多个未配对 hccn_tool -i <dev> 命令指向不同物理设备，端口归属不唯一，物理槽位暂不自动映射）"
              : visSlotConflictReason === "hccn-device-mismatch"
                ? hasSharedDeclaredVis
                  ? "（hccn_tool -i 查询的物理设备编号与当前 ASCEND_RT_VISIBLE_DEVICES 映射槽位不一致，物理槽位暂不自动映射）"
                  : "（hccn_tool -i 查询的物理设备编号与该故障逻辑 Rank 不一致且缺少明确的 ASCEND_RT_VISIBLE_DEVICES 映射，物理槽位暂不自动映射）"
                : visSlotConflictReason === "rank-out-of-bounds"
                  ? "（故障 Rank 超出当前 ASCEND_RT_VISIBLE_DEVICES 可见设备数范围，物理槽位暂不自动映射）"
                  : hasUnattributedMultiInstSlotBlock
                    ? "（日志存在多个实例且当前故障未明确归属实例，物理槽位暂不自动映射）"
                    : "（标识来自设备号或多节点前缀，仅作逻辑卡参考，不直接等同单机物理槽位）"
      : "";

    const rationale = `锁定首错 Rank 为 Rank ${winnerRank}${scopeNote}（第 ${earliest.lineNumber} 行，${tsNote} 触发「${earliest.signalTag}」）${cascadeNote}${otherHostNote}${unrankedPrimaryNote}${tiedOrMultiScopeNote}${tbAmbiguousNote}`;

    const timelineEvents = buildFaultTimelineEvents(
      signals,
      earliest,
      anyHostTag,
      winnerOrderAmbiguous,
      ambiguousCompetingPrimaries,
      visCache,
      verdictVisibleDevices,
      verdictScopeAnchor,
      hasEffectiveAmbigVis,
      earliest,
      ctx,
      domainCatalog,
    );
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
      hostTag: verdictHostTag,
      instanceTag: verdictInstanceTag,
      slotMappable,
      cascadeCausalState,
      timelineEvents,
    };
  }

  if (primaries.length > 0) {
    const isSimultaneousTie =
      (simultaneousDistinctRankTies.length > 0 || simultaneousUnrankedTies.length > 0) &&
      earlierTimestampedUnranked === null;
    const isIncomparableTie =
      !isSimultaneousTie &&
      (incomparableClockDistinctRankTies.length > 0 || crossDomainDistinctRankTies.length > 0) &&
      earlierTimestampedUnranked === null;
    const isClockAmbiguousTie = isSimultaneousTie || isIncomparableTie;
    const tieList = isSimultaneousTie
      ? [...simultaneousDistinctRankTies, ...simultaneousUnrankedTies]
      : isIncomparableTie
        ? [...incomparableClockDistinctRankTies, ...crossDomainDistinctRankTies]
        : [];
    const earliest =
      earlierTimestampedUnranked ??
      (isClockAmbiguousTie
        ? rankedPrimaries[0] && tieList.some((t) => compareSignalsChronologically(t, rankedPrimaries[0]!) < 0)
          ? primaries[0]!
          : (rankedPrimaries[0] ?? primaries[0]!)
        : primaries[0]!);
    const unrankedAnchorTies = isClockAmbiguousTie
      ? tieList
      : primaries.filter(
          (s) =>
            s.lineNumber !== earliest.lineNumber &&
            !(
              s.ruleId === undefined &&
              s.rank === null &&
              s.pid !== null &&
              rankedPrimaries.length > 0 &&
              rankedPrimaries[0]!.ruleId !== undefined &&
              /\(APIServer\b/i.test(s.inspectLine) &&
              Boolean(recoveredApiErrorLines?.has(s.lineNumber))
            ) &&
            (!areTimestampsComparable(earliest, s) || !isStrictlyEarlierTimestamp(earliest, s)),
        );
    const tieDomainsMatch = unrankedAnchorTies.every((s) =>
      arePhysicalScopesCompatible(earliest, s, visCache, ctx?.startupBoundaryBucket),
    );
    const scopeAnchor = tieDomainsMatch ? earliest : null;
    const cascadeRanks: number[] = [];
    const hasUncoveredScope = hasUncoveredMultiScopeForTarget(visCache, scopeAnchor, domainCatalog);
    const unrankedVisRes = hasUncoveredScope
      ? { visibleDevices: null, hasAmbiguousVisibleDevices: true }
      : resolveVisibleDevicesForVerdict(visCache, scopeAnchor, ctx?.startupBoundaryBucket);
    const unrankedVisibleDevices = unrankedVisRes.visibleDevices;
    const timelineAmbiguousVis =
      hasAmbiguousVisibleDevices ||
      hasUncoveredScope ||
      !tieDomainsMatch ||
      unrankedVisRes.hasAmbiguousVisibleDevices ||
      (visCache.entries.length > 0 && unrankedVisibleDevices === null);
    const timelineEvents = buildFaultTimelineEvents(
      signals,
      null,
      anyHostTag,
      false,
      [],
      visCache,
      unrankedVisibleDevices,
      scopeAnchor,
      timelineAmbiguousVis,
      earliest,
      ctx,
      domainCatalog,
    );
    const sigByLine = new Map<number, ClassifiedSignal>();
    for (const s of signals) {
      if (!sigByLine.has(s.lineNumber)) sigByLine.set(s.lineNumber, s);
    }
    const seedPrimaries = isClockAmbiguousTie
      ? [earliest, ...tieList.slice(0, 2), ...rankedPrimaries.slice(0, 4), ...primaries.slice(0, 4)]
      : earlierTimestampedUnranked
        ? [earlierTimestampedUnranked, ...primaries.slice(0, 4)]
        : primaries.slice(0, 4);
    const seenLines = new Set<number>();
    const pool: ClassifiedSignal[] = [];
    for (const s of [
      ...seedPrimaries,
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
    let rationale: string;
    if (isSimultaneousTie) {
      const tiedRanks = [
        ...new Set(
          [earliest, ...simultaneousDistinctRankTies]
            .map((s) => s.rank)
            .filter((r): r is number => r !== null),
        ),
      ].sort((a, b) => a - b);
      const tsPart = earliest.timestamp ? `于 ${earliest.timestamp} ` : "";
      const seenTieLines = new Set<number>();
      const tieCandidates: string[] = [];
      for (const s of [earliest, ...tieList]) {
        if (seenTieLines.has(s.lineNumber)) continue;
        seenTieLines.add(s.lineNumber);
        tieCandidates.push(describePrimaryCandidate(s));
        if (tieCandidates.length >= 3) break;
      }
      const whoLabel =
        simultaneousUnrankedTies.length > 0
          ? `未归属卡与${tiedRanks.length > 0 ? ` Rank ${tiedRanks.join(" / ")}` : "其余候选卡"}`
          : `Rank ${tiedRanks.join(" 与 Rank ")}`;
      rationale = `同刻并发未决并存：${whoLabel} ${tsPart}同时触发主报错（${tieCandidates.join("、")}），缺少亚微秒或物理属主先后依据，暂不锁定唯一首错卡，置信度为中等。`;
    } else if (isIncomparableTie) {
      const uniqueIncomp = new Map<number, ClassifiedSignal>();
      for (const s of [earliest, ...tieList]) uniqueIncomp.set(s.lineNumber, s);
      const orderedIncomp = [...uniqueIncomp.values()].sort(
        (a, b) =>
          (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) ||
          a.lineNumber - b.lineNumber,
      );
      const tiedRanks = [
        ...new Set(orderedIncomp.map((s) => s.rank).filter((r): r is number => r !== null)),
      ].sort((a, b) => a - b);
      const tieCandidates = orderedIncomp.slice(0, 3).map(describePrimaryCandidate);
      rationale = `时钟跨度/跨年或跨域无锚点未决并存：Rank ${tiedRanks.join(" 与 Rank ")} 缺少可比时间戳先后依据（${tieCandidates.join("、")}），暂不锁定唯一首错卡，置信度为中等。`;
    } else if (earlierTimestampedUnranked !== null) {
      const tsPart = earliest.timestamp
        ? `（第 ${earliest.lineNumber} 行，于 ${earliest.timestamp}）`
        : `（第 ${earliest.lineNumber} 行）`;
      const laterNote =
        rankedPrimaries.length > 0
          ? `；其发生时间早于后续带 Rank 报错（${describePrimaryCandidate(rankedPrimaries[0]!)}），故不得将后者反推为首错卡`
          : "";
      rationale = `已检出最早主故障信号「${earliest.signalTag}」${tsPart}，但该行缺少可归属物理卡的 Rank / Device 编号前缀${laterNote}；请补采带 Worker Rank 标识的完整日志与 CANN plog 以确认首错卡。`;
    } else {
      rationale = `已检出主故障信号「${earliest.signalTag}」（第 ${earliest.lineNumber} 行），但该行缺少可归属物理卡的 Rank / Device 编号前缀；若为多卡部署，请补采带 Worker Rank 标识的日志与 CANN plog 以确认首错卡。`;
    }
    const hasEarlierTieCascade =
      isSimultaneousTie && cascades.some((c) => isStrictlyEarlierTimestamp(c, earliest));
    const cascadeCausalState: CascadeCausalState = isClockAmbiguousTie
      ? hasEarlierTieCascade
        ? "earlier-than-primary"
        : cascades.length > 0
          ? "unverified-order"
          : "no-primary"
      : "no-primary";
    return {
      rank: null,
      confidence: "medium",
      rationale,
      primaryEvidenceLines: pool.map(toPrimaryEvidence),
      cascadeRanks,
      rankSource: null,
      hostTag: scopeAnchor?.hostTag ?? null,
      instanceTag: scopeAnchor?.instanceTag ?? null,
      slotMappable: false,
      cascadeCausalState,
      timelineEvents,
    };
  }

  const cascadeRanks = [...new Set(cascades.filter(hasLogicalCausalRank).map((c) => c.rank!))].sort(
    (a, b) => a - b,
  );
  const cascadeVisRes =
    cascades.length > 0
      ? resolveSharedVisibleDevicesForPool(visCache, cascades, ctx?.startupBoundaryBucket)
      : resolveVisibleDevicesForVerdict(visCache, null, ctx?.startupBoundaryBucket);
  const cascadeVisibleDevices = cascadeVisRes.visibleDevices;
  const timelineEvents = buildFaultTimelineEvents(
    signals,
    null,
    anyHostTag,
    false,
    [],
    visCache,
    cascadeVisibleDevices,
    null,
    hasAmbiguousVisibleDevices ||
      cascadeVisRes.hasAmbiguousVisibleDevices ||
      (visCache.entries.length > 0 && cascadeVisibleDevices === null),
    null,
    ctx,
    domainCatalog,
  );
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

  const hasEi0002 = cascades.some((c) => /\bEI0002\b|Notify wait execute timeout/i.test(c.rawLine));
  const hasEi0006 = cascades.some((c) => /\bEI0006\b/i.test(c.rawLine));
  const codeLabel =
    hasEi0002 && !hasEi0006
      ? "EI0002"
      : hasEi0006 && !hasEi0002
        ? "EI0006"
        : hasEi0002 && hasEi0006
          ? "EI0002 / EI0006"
          : "超时";

  return {
    rank: null,
    confidence: "low",
    rationale: `仅观测到次生超时/连带退出/对端拒绝信号（${cascades[0]!.signalTag}${cascadeRanks.length > 0 ? `，涉及 Rank ${cascadeRanks.join(" / ")}` : ""}），日志片段中缺少主故障卡的前序报错。切勿将 Rank 0 或最后一条 ${codeLabel} 当作根因，请补采全部参与 Rank 的同期前序日志与 CANN plog。`,
    primaryEvidenceLines: purePool.map(toPrimaryEvidence),
    cascadeRanks,
    rankSource: null,
    hostTag: null,
    instanceTag: null,
    slotMappable: false,
    cascadeCausalState: "no-primary",
    timelineEvents,
  };
}

function formatMatchedLine(line: ParsedLogLine, ctx?: LineScopeContext): MatchedLogLine {
  const partner = ctx?.partnerContextByLine.get(line.lineNumber);
  return {
    lineNumber: line.lineNumber,
    rank: partner ? partner.rank : line.rank,
    timestamp: partner ? partner.timestamp : line.timestamp,
    rawLine: line.rawLine.trim(),
  };
}

function collectAllMatchingLines(
  lines: readonly ParsedLogLine[],
  predicate: (line: ParsedLogLine) => boolean,
  includePromSamples = false,
): ParsedLogLine[] {
  const out: ParsedLogLine[] = [];
  for (const line of lines) {
    if (
      !includePromSamples &&
      (line.isPromLine || line.trimmed.startsWith("#") || isPromExpositionLine(line.trimmed))
    ) {
      continue;
    }
    if (line.tracebackGroupId !== null && isTracebackScaffoldLine(line.rawLine)) continue;
    if (predicate(line)) out.push(line);
  }
  return out;
}

const COLD_START_OOM_STAGE_RE =
  /\b(?:in\s+load_model|load_model\s*\(|in\s+load_weights|load_weights\b|during\s+load_weights|in\s+profile_run|profile_run\s*\(|in\s+determine_available_memory|determine_available_memory\s*\(|Loading\s+safetensors|Loading\s+model\s+weights|Model\s+loading\s+took|default_loader\.py|weight_utils\.py)/i;

const COLD_START_MILESTONE_RE =
  /\b(?:Starting\s+load_model|Loading\s+safetensors|Loading\s+model\s+weights|Model\s+loading\s+took|Entering\s+profile_run)\b/i;

const KV_ALLOC_OOM_STAGE_RE =
  /\b(?:in\s+initialize_kv_cache|initialize_kv_cache\s*\(|in\s+initialize_cache|initialize_cache\s*\(|in\s+initialize_from_config|initialize_from_config\s*\()/i;

const POST_KV_CAPTURE_STACK_RE =
  /\b(?:in\s+capture_model|capture_model\s*\(|in\s+compile_or_warm_up_model|compile_or_warm_up_model\s*\(|while\s+capturing\s+(?:acl|cuda|npu)?graph|during\s+(?:(?:acl|cuda|npu)?graph\s+)?(?:capture_model|graph\s+captur|aclgraph\s+pool|npugraph\s+pool)|(?:acl|cuda|npu)?graph\s+capture_model|aclgraph\s+pool\s+init|acl_graph\.py|npu_graph\.py|cudagraph_dispatcher\.py|capturing\s+(?:cuda|acl|npu)graph|graph\s+captur(?:e|ing)\s+(?:failed|oom|error|batch))/i;

const KV_BUDGET_MILESTONE_RE = /Available KV cache memory:\s*[\d.]+\s*(?:GiB|GB|MiB)/i;

const POST_KV_MILESTONE_RE =
  /(?:NPU|GPU)\s+KV cache size:\s*[\d,]+\s*tokens|Entering\s+compile_or_warm_up_model/i;

const RUNTIME_OOM_EXPLICIT_RE =
  /\b(?:NPUWorkspaceAllocator|GetWorkspaceSize|get_workspace_size|during\s+(?:decode|prefill))\b|(?<![/\\_-])\bworkspace\b(?![/\\._-])/i;

const RUNTIME_OOM_STAGE_RE =
  /\b(?:NPUWorkspaceAllocator|GetWorkspaceSize|get_workspace_size|during\s+(?:decode|prefill|forward)|in\s+(?:execute_model|forward|step|sample|decode|prefill)|Graph capturing finished)\b|(?<![/\\_-])\bworkspace\b(?![/\\._-])/i;

const RUNTIME_MILESTONE_RE =
  /\b(?:Graph capturing finished|NPUWorkspaceAllocator|GetWorkspaceSize|get_workspace_size)\b|\bduring\s+(?:decode|prefill|forward)\b|(?<![/\\_-])\bworkspace\b(?![/\\._-])/i;

function matchesRuntimeOomExplicit(inspectLine: string): boolean {
  return RUNTIME_OOM_EXPLICIT_RE.test(inspectLine) || isActualAppStartupCompleteLine(inspectLine);
}

function matchesRuntimeOomStage(inspectLine: string): boolean {
  return RUNTIME_OOM_STAGE_RE.test(inspectLine) || isActualAppStartupCompleteLine(inspectLine);
}

function matchesRuntimeMilestone(inspectLine: string): boolean {
  return RUNTIME_MILESTONE_RE.test(inspectLine) || isActualAppStartupCompleteLine(inspectLine);
}

function isLifecycleMilestoneLine(rawLine: string): boolean {
  if (/(?<![.\w])(?:INFO|DEBUG)\b(?!\s*\()/i.test(rawLine)) return true;
  if (/\bFile\s+"|\bin\s+[A-Za-z_][A-Za-z0-9_]*\b/i.test(rawLine)) return false;
  return (
    COLD_START_MILESTONE_RE.test(rawLine) ||
    KV_BUDGET_MILESTONE_RE.test(rawLine) ||
    POST_KV_MILESTONE_RE.test(rawLine) ||
    isActualAppStartupCompleteLine(rawLine) ||
    /\bGraph capturing finished\b/i.test(rawLine)
  );
}

function hasExplicitScopeMatch(
  oomLine: ParsedLogLine,
  candidate: ParsedLogLine,
  allowEqualTimestampAfter = false,
): boolean {
  if (!areCausalDomainsCompatible(oomLine, candidate)) return false;
  if (oomLine.rank !== null && candidate.rank !== null && oomLine.rank !== candidate.rank) return false;
  if (oomLine.timestampMs !== null && candidate.timestampMs !== null) {
    if (!areTimestampsComparable(oomLine, candidate)) return false;
    const delta = oomLine.timestampMs - candidate.timestampMs;
    if (delta < 0 || delta > 10 * 60 * 1000) return false;
    if (delta === 0) {
      if (candidate.timestampSubMs > oomLine.timestampSubMs) return false;
      if (
        !allowEqualTimestampAfter &&
        candidate.timestampSubMs === oomLine.timestampSubMs &&
        candidate.lineNumber >= oomLine.lineNumber
      ) {
        return false;
      }
    }
  } else if (oomLine.timestampMs !== null || candidate.timestampMs !== null) {
    return false;
  } else if (candidate.lineNumber > oomLine.lineNumber) {
    return false;
  }
  if (oomLine.pid !== null) {
    if (candidate.pid !== null) return oomLine.pid === candidate.pid;
    return oomLine.rank !== null && candidate.rank !== null && oomLine.rank === candidate.rank;
  }
  if (oomLine.rank !== null) {
    if (candidate.pid !== null) return false;
    return candidate.rank !== null && oomLine.rank === candidate.rank;
  }
  if (oomLine.segmentId !== candidate.segmentId) return false;
  return candidate.pid === null && candidate.rank === null;
}

function isInterveningOomResetBoundary(
  oomLine: ParsedLogLine,
  mid: ParsedLogLine,
  checkAfterOom = false,
): boolean {
  if (!areCausalDomainsCompatible(oomLine, mid)) return false;
  if (!checkAfterOom && areTimestampsComparable(oomLine, mid) && isStrictlyEarlierTimestamp(oomLine, mid)) {
    return false;
  }
  const sameRankOrUnscoped = oomLine.rank === null || mid.rank === null || oomLine.rank === mid.rank;
  const samePidOrUnscoped = oomLine.pid === null || mid.pid === null || oomLine.pid === mid.pid;
  if (isActualAppStartupCompleteLine(mid.inspectLine) || /\bGraph capturing finished\b/i.test(mid.rawLine)) {
    return sameRankOrUnscoped;
  }
  if (
    !checkAfterOom &&
    oomLine.tracebackGroupId !== null &&
    mid.tracebackGroupId === oomLine.tracebackGroupId
  ) {
    return false;
  }
  if (/Traceback \(most recent call last\):/i.test(mid.rawLine)) {
    return sameRankOrUnscoped && samePidOrUnscoped;
  }
  if (!sameRankOrUnscoped || !samePidOrUnscoped) return false;
  if (
    mid.tracebackGroupId !== null &&
    oomLine.tracebackGroupId !== null &&
    mid.tracebackGroupId !== oomLine.tracebackGroupId
  ) {
    return true;
  }
  if (isTracebackScaffoldLine(mid.rawLine)) return false;
  const stripped = stripTracebackLogPrefix(mid.rawLine).trim();
  return TRACEBACK_UNPREFIXED_TERMINAL_RE.test(stripped) || hasGenuinePythonException(mid.rawLine);
}

function isContiguousStackFrameForOom(
  lines: readonly ParsedLogLine[],
  oomIdx: number,
  candIdx: number,
): boolean {
  const oomLine = lines[oomIdx]!;
  const candidate = lines[candIdx]!;
  if (oomLine.segmentId !== candidate.segmentId) return false;
  if (!areCausalDomainsCompatible(oomLine, candidate)) return false;
  if (oomLine.rank !== null && candidate.rank !== null && oomLine.rank !== candidate.rank) return false;
  if (
    candidate.tracebackGroupId !== null &&
    ((oomLine.tracebackGroupId !== null && oomLine.tracebackGroupId !== candidate.tracebackGroupId) ||
      candIdx > oomIdx)
  ) {
    return false;
  }
  if (isLifecycleMilestoneLine(candidate.rawLine)) return false;

  const lo = Math.min(oomIdx, candIdx);
  const hi = Math.max(oomIdx, candIdx);
  const checkAfterOom = candIdx > oomIdx;
  for (let k = lo + 1; k < hi; k += 1) {
    if (isInterveningOomResetBoundary(oomLine, lines[k]!, checkAfterOom)) return false;
  }

  if (hasExplicitScopeMatch(oomLine, candidate, true)) return true;
  if (candidate.pid !== null || candidate.rank !== null) return false;
  if (oomLine.timestampMs !== null && candidate.timestampMs !== null) {
    if (!areTimestampsComparable(oomLine, candidate)) return false;
    const delta = oomLine.timestampMs - candidate.timestampMs;
    if (delta < 0 || delta > 60 * 1000) return false;
    if (delta === 0 && candidate.timestampSubMs > oomLine.timestampSubMs) return false;
  }
  // Unlabelled stack frame (`  File ... in capture_model`) may pair with a scoped OOM ONLY if
  // original line numbers are strictly contiguous (no omission gap) and no conflicting process lies between them.
  const idxSpan = Math.abs(candIdx - oomIdx);
  const lineSpan = Math.abs(candidate.lineNumber - oomLine.lineNumber);
  if (lineSpan !== idxSpan) return false;
  for (let k = lo + 1; k < hi; k += 1) {
    const mid = lines[k]!;
    if (!areCausalDomainsCompatible(oomLine, mid)) return false;
    if (mid.pid !== null && oomLine.pid !== null && mid.pid !== oomLine.pid) return false;
    if (mid.rank !== null && oomLine.rank !== null && mid.rank !== oomLine.rank) return false;
  }
  return true;
}

function findLatestPrecedingInBucket(
  bucket: TieredMilestoneBucket | undefined,
  oomLine: ParsedLogLine,
  predicate: (cand: ParsedLogLine) => boolean,
  maxAgeMs: number,
  maxUntimestampedLineDist = Number.POSITIVE_INFINITY,
): ParsedLogLine | null {
  if (!bucket) return null;
  if (oomLine.timestampMs !== null) {
    const effMaxAgeMs = oomLine.timestampKind === "time-only" ? Math.min(maxAgeMs, 12 * 3_600_000) : maxAgeMs;
    const arr = bucket.byTier.get(getLifecycleTierKey(oomLine));
    if (!arr || arr.length === 0) return null;
    const startIdx = findRightmostTrue(arr, (cand) => compareTimestampOrder(cand, oomLine) < 0);
    for (let idx = startIdx; idx >= 0; idx -= 1) {
      if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
      const cand = arr[idx]!;
      const delta = oomLine.timestampMs - cand.timestampMs!;
      if (delta > effMaxAgeMs) break;
      if (oomLine.timestampKind === "time-only" && !areTimestampsComparable(oomLine, cand)) continue;
      if (predicate(cand)) return cand;
    }
    return null;
  }
  const arr = bucket.untimestamped;
  if (arr.length === 0) return null;
  const startIdx = findRightmostTrue(arr, (cand) => cand.lineNumber < oomLine.lineNumber);
  for (let idx = startIdx; idx >= 0; idx -= 1) {
    if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
    const cand = arr[idx]!;
    if (oomLine.lineNumber - cand.lineNumber > maxUntimestampedLineDist) break;
    if (predicate(cand)) return cand;
  }
  return null;
}

function isNewerLifecycleCandidate(cand: ParsedLogLine, current: ParsedLogLine | null): boolean {
  if (!current) return true;
  if (areTimestampsComparable(cand, current)) {
    return compareTimestampOrder(cand, current) > 0;
  }
  return cand.lineNumber > current.lineNumber;
}

const STEP1_FLAG_POST = 1;
const STEP1_FLAG_KV_ALLOC = 2;
const STEP1_FLAG_COLD = 4;
const STEP1_FLAG_RUNTIME = 8;
const STEP1_FLAG_EXPLICIT_RT = 16;
const STEP1_FLAG_DUMMY_RUN = 32;
const STEP1_FLAG_CAPTURE_TOK = 64;
const STEP1_FLAG_COMPUTED = 128;
const oomStep1FlagsCache = new WeakMap<readonly ParsedLogLine[], Uint8Array>();

function getOomStep1LineFlags(lines: readonly ParsedLogLine[], idx: number, cacheArr: Uint8Array): number {
  const existing = cacheArr[idx]!;
  if (existing & STEP1_FLAG_COMPUTED) return existing;
  const candInspect = lines[idx]!.inspectLine;
  let bits = STEP1_FLAG_COMPUTED;
  if (POST_KV_CAPTURE_STACK_RE.test(candInspect)) {
    bits |= STEP1_FLAG_POST;
    if (/capture_model|compile_or_warm_up_model|aclgraph|npugraph/i.test(candInspect)) {
      bits |= STEP1_FLAG_CAPTURE_TOK;
    }
  }
  if (KV_ALLOC_OOM_STAGE_RE.test(candInspect)) bits |= STEP1_FLAG_KV_ALLOC;
  if (COLD_START_OOM_STAGE_RE.test(candInspect)) bits |= STEP1_FLAG_COLD;
  if (matchesRuntimeOomStage(candInspect)) bits |= STEP1_FLAG_RUNTIME;
  if (matchesRuntimeOomExplicit(candInspect)) bits |= STEP1_FLAG_EXPLICIT_RT;
  if (/\bin\s+_dummy_run\b|\b_dummy_run\s*\(/i.test(candInspect)) bits |= STEP1_FLAG_DUMMY_RUN;
  cacheArr[idx] = bits;
  return bits;
}

function classifyNpuOomStage(
  lines: readonly ParsedLogLine[],
  targetOomLine: ParsedLogLine | undefined,
  lineIndexByLineNumber?: ReadonlyMap<number, number>,
  lifecycleCandidates?: readonly ParsedLogLine[],
  lifecycleIndex?: OomLifecycleIndex,
): "capture" | "cold-start" | "kv-alloc" | "runtime" | "unknown" {
  if (!targetOomLine) return "unknown";
  const oomIdx =
    lineIndexByLineNumber?.get(targetOomLine.lineNumber) ??
    lines.findIndex((l) => l.lineNumber === targetOomLine.lineNumber);
  if (oomIdx < 0) return "unknown";
  const oomLine = lines[oomIdx]!;

  // 0. Explicit stage token on the OOM fault line itself takes strict priority over surrounding milestones
  const selfKvAlloc = KV_ALLOC_OOM_STAGE_RE.test(oomLine.inspectLine);
  const selfCapture =
    POST_KV_CAPTURE_STACK_RE.test(oomLine.inspectLine) &&
    /capture_model|compile_or_warm_up_model|aclgraph|npugraph/i.test(oomLine.inspectLine);
  const selfCold = COLD_START_OOM_STAGE_RE.test(oomLine.inspectLine);
  const selfRuntime = matchesRuntimeOomStage(oomLine.inspectLine);
  if (selfKvAlloc && !selfCapture && !selfCold && !selfRuntime) return "kv-alloc";
  if (selfCapture && !selfCold && !selfRuntime) return "capture";
  if (selfRuntime && !selfCapture && !selfCold && !selfKvAlloc) return "runtime";
  if (selfCold && !selfCapture && !selfRuntime && !selfKvAlloc) return "cold-start";

  // 1. Inspect the OOM line's contiguous non-milestone stack/error frames within ORIGINAL line numbers (<= 20 lines)
  let step1Flags = oomStep1FlagsCache.get(lines);
  if (!step1Flags) {
    step1Flags = new Uint8Array(lines.length);
    oomStep1FlagsCache.set(lines, step1Flags);
  }
  const winStart = Math.max(0, oomIdx - 20);
  const winEnd = Math.min(lines.length - 1, oomIdx + 20);
  let minPostDist = Number.POSITIVE_INFINITY;
  let minKvAllocDist = Number.POSITIVE_INFINITY;
  let minColdDist = Number.POSITIVE_INFINITY;
  let minRuntimeDist = Number.POSITIVE_INFINITY;
  let minExplicitRuntimeDist = Number.POSITIVE_INFINITY;
  let hasExplicitCaptureToken = false;
  let hasDummyRunFrame = false;
  for (let i = winStart; i <= winEnd; i += 1) {
    const candidate = lines[i]!;
    const lineDist = Math.abs(candidate.lineNumber - oomLine.lineNumber);
    if (lineDist > 20) continue;
    const flags = getOomStep1LineFlags(lines, i, step1Flags);
    if ((flags & 0x7f) === 0) continue;
    if (!isContiguousStackFrameForOom(lines, oomIdx, i)) continue;
    if (flags & STEP1_FLAG_DUMMY_RUN) {
      hasDummyRunFrame = true;
    }
    if (flags & STEP1_FLAG_POST) {
      minPostDist = Math.min(minPostDist, lineDist);
      if (flags & STEP1_FLAG_CAPTURE_TOK) {
        hasExplicitCaptureToken = true;
      }
    }
    if (flags & STEP1_FLAG_KV_ALLOC) {
      minKvAllocDist = Math.min(minKvAllocDist, lineDist);
    }
    if (flags & STEP1_FLAG_COLD) {
      minColdDist = Math.min(minColdDist, lineDist);
    }
    if (flags & STEP1_FLAG_RUNTIME) {
      minRuntimeDist = Math.min(minRuntimeDist, lineDist);
    }
    if (flags & STEP1_FLAG_EXPLICIT_RT) {
      minExplicitRuntimeDist = Math.min(minExplicitRuntimeDist, lineDist);
    }
  }
  if (
    minExplicitRuntimeDist !== Number.POSITIVE_INFINITY &&
    minExplicitRuntimeDist < minColdDist &&
    minExplicitRuntimeDist < minKvAllocDist &&
    (!hasExplicitCaptureToken || minExplicitRuntimeDist < minPostDist)
  ) {
    return "runtime";
  }
  if (hasExplicitCaptureToken && minPostDist <= minColdDist && minPostDist <= minKvAllocDist) {
    return "capture";
  }
  if (minKvAllocDist !== Number.POSITIVE_INFINITY && minKvAllocDist <= minColdDist) {
    return "kv-alloc";
  }
  if (minColdDist !== Number.POSITIVE_INFINITY && minColdDist < minExplicitRuntimeDist) {
    return "cold-start";
  }
  if (minPostDist !== Number.POSITIVE_INFINITY && minPostDist < minRuntimeDist) {
    return "capture";
  }
  if (minRuntimeDist !== Number.POSITIVE_INFINITY) {
    return "runtime";
  }

  function findLatestPrecedingInDomainBucket(
    bucket: DomainIndexedBucket,
    oomLine: ParsedLogLine,
    predicate: (cand: ParsedLogLine) => boolean,
    maxAgeMs: number,
    maxUntimestampedLineDist = Number.POSITIVE_INFINITY,
  ): ParsedLogLine | null {
    let best: ParsedLogLine | null = null;
    for (const sub of getDomainBucketsForLine(bucket, oomLine)) {
      const hit = findLatestPrecedingInBucket(sub, oomLine, predicate, maxAgeMs, maxUntimestampedLineDist);
      if (hit && isNewerLifecycleCandidate(hit, best)) {
        best = hit;
      }
    }
    return best;
  }

  // 2. Chronological lifecycle milestones in the same scope (domain-indexed O(log N) lookup; latest preceding supersedes earlier)
  const idx =
    lifecycleIndex ??
    buildOomLifecycleIndex(
      lifecycleCandidates ??
        lines.filter(
          (l) =>
            COLD_START_MILESTONE_RE.test(l.inspectLine) ||
            KV_BUDGET_MILESTONE_RE.test(l.inspectLine) ||
            POST_KV_MILESTONE_RE.test(l.inspectLine) ||
            matchesRuntimeMilestone(l.inspectLine) ||
            matchesRuntimeOomStage(l.inspectLine),
        ),
    );
  const candidateBuckets: TieredMilestoneBucket[] = [];
  if (oomLine.pid !== null) {
    const pidB = idx.byPid.get(oomLine.pid);
    if (pidB) candidateBuckets.push(...getDomainBucketsForLine(pidB, oomLine));
    if (oomLine.rank !== null) {
      const rankB = idx.byRankNoPid.get(oomLine.rank);
      if (rankB) candidateBuckets.push(...getDomainBucketsForLine(rankB, oomLine));
    }
  } else if (oomLine.rank !== null) {
    const rankB = idx.byRankNoPid.get(oomLine.rank);
    if (rankB) candidateBuckets.push(...getDomainBucketsForLine(rankB, oomLine));
  } else {
    const segB = idx.unscopedBySegment.get(oomLine.segmentId);
    if (segB) candidateBuckets.push(...getDomainBucketsForLine(segB, oomLine));
  }

  let latestScoped: ParsedLogLine | null = null;
  for (const bucket of candidateBuckets) {
    const hit = findLatestPrecedingInBucket(
      bucket,
      oomLine,
      (cand) => cand.lineNumber !== oomLine.lineNumber && hasExplicitScopeMatch(oomLine, cand, false),
      10 * 60 * 1000,
    );
    if (hit && isNewerLifecycleCandidate(hit, latestScoped)) {
      latestScoped = hit;
    }
  }
  const clusterStartupHit = findLatestPrecedingInDomainBucket(
    idx.startupMilestones,
    oomLine,
    (cand) =>
      cand.lineNumber !== oomLine.lineNumber &&
      areCausalDomainsCompatible(oomLine, cand) &&
      (cand.timestampMs === null || oomLine.timestampMs === null || areTimestampsComparable(oomLine, cand)),
    24 * 60 * 60 * 1000,
  );
  if (clusterStartupHit && isNewerLifecycleCandidate(clusterStartupHit, latestScoped)) {
    latestScoped = clusterStartupHit;
  }

  // Check for untimestamped APIServer `Application startup complete.` positioned between the latest scoped milestone and oomLine
  const startupDomainBuckets = getDomainBucketsForLine(idx.startupMilestones, oomLine);
  const floorLineNo =
    latestScoped && latestScoped.lineNumber < oomLine.lineNumber ? latestScoped.lineNumber : -1;
  for (const subBucket of startupDomainBuckets) {
    const segUnts = subBucket.untimestampedBySeg.get(oomLine.segmentId);
    if (!segUnts || segUnts.length === 0) continue;
    const startIdx = findRightmostTrue(segUnts, (cand) => cand.lineNumber < oomLine.lineNumber);
    for (let k = startIdx; k >= 0; k -= 1) {
      const cand = segUnts[k]!;
      if (cand.lineNumber <= floorLineNo) break;
      if (areCausalDomainsCompatible(oomLine, cand)) {
        return "runtime";
      }
    }
  }

  if (latestScoped) {
    if (matchesRuntimeMilestone(latestScoped.inspectLine)) return "runtime";
    if (POST_KV_MILESTONE_RE.test(latestScoped.inspectLine)) return "capture";
    if (KV_BUDGET_MILESTONE_RE.test(latestScoped.inspectLine)) {
      return hasDummyRunFrame ? "capture" : "kv-alloc";
    }
    if (COLD_START_MILESTONE_RE.test(latestScoped.inspectLine)) return "cold-start";
  }

  // 3. Peer startup context without any preceding runtime/decode/workspace markers (paste-order invariant when timestamped, segment-fenced when untimestamped)
  const runtimeMarkerHit = findLatestPrecedingInDomainBucket(
    idx.runtimeMarkers,
    oomLine,
    (l) =>
      l.lineNumber !== oomLine.lineNumber &&
      areCausalDomainsCompatible(oomLine, l) &&
      (l.timestampMs === null || oomLine.timestampMs === null || areTimestampsComparable(oomLine, l)),
    Number.POSITIVE_INFINITY,
  );
  let hasPrecedingRuntimeMarker = runtimeMarkerHit !== null;
  if (!hasPrecedingRuntimeMarker && oomLine.timestampMs !== null) {
    for (const subBucket of startupDomainBuckets) {
      const segUnts = subBucket.untimestampedBySeg.get(oomLine.segmentId);
      if (!segUnts || segUnts.length === 0) continue;
      const startIdx = findRightmostTrue(segUnts, (cand) => cand.lineNumber < oomLine.lineNumber);
      for (let k = startIdx; k >= 0; k -= 1) {
        const cand = segUnts[k]!;
        if (areCausalDomainsCompatible(oomLine, cand)) {
          hasPrecedingRuntimeMarker = true;
          break;
        }
      }
      if (hasPrecedingRuntimeMarker) break;
    }
  }
  if (!hasPrecedingRuntimeMarker) {
    const peerStartupHit = findLatestPrecedingInDomainBucket(
      idx.peerStartups,
      oomLine,
      (cand) =>
        cand.lineNumber !== oomLine.lineNumber &&
        areCausalDomainsCompatible(oomLine, cand) &&
        (oomLine.timestampMs !== null || cand.segmentId === oomLine.segmentId) &&
        (cand.timestampMs === null || oomLine.timestampMs === null || areTimestampsComparable(oomLine, cand)),
      60 * 1000,
      10,
    );
    if (peerStartupHit) return "cold-start";
  }

  return hasPrecedingRuntimeMarker ? "runtime" : "unknown";
}

const VLLM_ASCEND_V030 = "vllm-ascend@c09d3e20";
const VLLM_V030 = "vllm@ced6857a";

const HCCL_BUFFSIZE_UNIT_SRC = "(?:bytes?|KB|KiB|MB|MiB|GB|GiB|B)";
const HCCL_BUFFSIZE_MIN_SRCS: readonly string[] = [
  String.raw`(?:expected|min(?:imum)?(?:\s+required)?|required(?:\s+minimum)?)\s+HCCL_BUFFSIZE[^=>:\r\n]{0,96}(>=|=>|>|=|:)\s*([0-9]+(?:\.[0-9]+)?(?:\s*${HCCL_BUFFSIZE_UNIT_SRC})?)`,
  String.raw`\bHCCL_BUFFSIZE\s*(?:(?:must|should|needs?(?:\s+to)?)\s+be\s+(?:at\s+least\s+)?|is\s+expected\s+to\s+be\s+(?:at\s+least\s+)?|requires?\s+(?:at\s+least\s+)?|at\s+least\s+)(>=|=>|>|=|:)?\s*([0-9]+(?:\.[0-9]+)?(?:\s*${HCCL_BUFFSIZE_UNIT_SRC})?)`,
  String.raw`\bHCCL_BUFFSIZE\s*(>=|=>|>)\s*([0-9]+(?:\.[0-9]+)?(?:\s*${HCCL_BUFFSIZE_UNIT_SRC})?)`,
];
const HCCL_BUFFSIZE_REQ_RE = new RegExp(HCCL_BUFFSIZE_MIN_SRCS.join("|"), "i");
const NON_HCCL_MEMORY_SUBJECT_RE =
  /(?:\b(?:host|cpu|system|pinned|virtual|mmap|shared)\s+(?:memory|mem|ram|space|cache)\b|\b(?:dram|ram|tmpfs|swap|disk|storage|kv[\s_-]*cache)\b|\b(?:of|in|on|at|under|from|for)\s+(?:host|cpu|system|shared|kv)(?:\s+(?:memory|mem|ram|space))?\b|(?<!\w)\/dev\/shm\b)/i;

function evaluateRules(
  lines: readonly ParsedLogLine[],
  metricScopes: readonly ParsedMetricScope[],
  verdict: FirstFaultVerdict,
  ctx: LineScopeContext,
  lineOwnerMap: ReadonlyMap<number, string>,
  tracebackOwnerMap: ReadonlyMap<number, string>,
  signals: readonly ClassifiedSignal[],
  selection: VerdictSelection,
  allMatchedLineNumbers: Set<number>,
): LogDiagnosisFinding[] {
  const findings: LogDiagnosisFinding[] = [];
  const winnerSignal = selection.rankedWinner ?? selection.anyPrimary;
  const evalDecJanRollover = hasUnanchoredDecJanRollover(signals);
  const lineByLineNumber = new Map<number, ParsedLogLine>(lines.map((l) => [l.lineNumber, l]));
  const hcclBuffKeywordLines = lines.filter(
    (l) =>
      !l.isPromLine &&
      !l.trimmed.startsWith("#") &&
      !isPromExpositionLine(l.trimmed) &&
      l.inspectLine.includes("HCCL_BUFFSIZE"),
  );
  const signalKindByLineNo = new Map<number, ClassifiedSignal["kind"]>(
    signals.map((s) => [s.lineNumber, s.kind]),
  );
  const toMatched = (line: ParsedLogLine): MatchedLogLine => formatMatchedLine(line, ctx);
  const recordLines = (arr: readonly ParsedLogLine[]): MatchedLogLine[] => {
    for (const l of arr) allMatchedLineNumbers.add(l.lineNumber);
    return arr.slice(0, 4).map(toMatched);
  };

  const sameRuleHost = (invHost: string | null, targetHost: string | null): boolean =>
    targetHost === null
      ? invHost === null
      : invHost !== null && invHost.toLowerCase() === targetHost.toLowerCase();

  const matchesRuleInventoryScope = (
    invLine: ParsedLogLine,
    targetLine?: Pick<ParsedLogLine, "hostTag" | "instanceTag" | "groupTag"> | null,
  ): boolean => {
    if (!targetLine) return true;
    return (
      sameRuleHost(invLine.hostTag, targetLine.hostTag) &&
      areScopeTagsCompatible(invLine.instanceTag, targetLine.instanceTag) &&
      areScopeTagsCompatible(invLine.groupTag, targetLine.groupTag)
    );
  };

  interface RuleNicInventoryEntry {
    line: ParsedLogLine;
    host: string | null;
    iface: string;
    ip: string;
    missingNic: string | null;
  }

  const selectBestScopedNicInventory = (
    inventories: readonly RuleNicInventoryEntry[],
    targetLine?: Pick<ParsedLogLine, "hostTag" | "instanceTag" | "groupTag"> | null,
  ): RuleNicInventoryEntry | undefined => {
    const scoreInv = (inv: RuleNicInventoryEntry): number => {
      if (!targetLine) {
        return (inv.line.instanceTag !== null ? 2 : 0) + (inv.line.groupTag !== null ? 1 : 0);
      }
      let score = 0;
      if (targetLine.hostTag !== null && inv.host?.toLowerCase() === targetLine.hostTag.toLowerCase()) {
        score += 4;
      }
      if (
        targetLine.instanceTag !== null &&
        inv.line.instanceTag?.toLowerCase() === targetLine.instanceTag.toLowerCase()
      ) {
        score += 2;
      }
      if (
        targetLine.groupTag !== null &&
        inv.line.groupTag?.toLowerCase() === targetLine.groupTag.toLowerCase()
      ) {
        score += 1;
      }
      return score;
    };
    let bestScore = -1;
    let bestCands: RuleNicInventoryEntry[] = [];
    for (const inv of inventories) {
      if (!matchesRuleInventoryScope(inv.line, targetLine)) continue;
      const sc = scoreInv(inv);
      if (sc > bestScore) {
        bestScore = sc;
        bestCands = [inv];
      } else if (sc === bestScore) {
        bestCands.push(inv);
      }
    }
    if (bestCands.length === 0) return undefined;
    const first = bestCands[0]!;
    if (bestCands.some((c) => c.iface !== first.iface || c.ip !== first.ip)) {
      return undefined;
    }
    return first;
  };

  const parseBuffSizeMb = (raw?: string): number | null => {
    if (!raw) return null;
    const m = /^([0-9]+(?:\.[0-9]+)?)\s*(bytes?|KB|KiB|MB|MiB|GB|GiB|B)?$/i.exec(raw.trim());
    if (!m?.[1]) return null;
    const num = Number(m[1]);
    if (!Number.isFinite(num)) return null;
    const unit = (m[2] ?? "mb").toLowerCase();
    if (unit === "b" || unit === "byte" || unit === "bytes") return num / (1024 * 1024);
    if (unit.startsWith("g")) return num * 1024;
    if (unit.startsWith("k")) return num / 1024;
    return num;
  };

  const computeHcclBuffSizeRecommendation = (sourcesInput: string | readonly ParsedLogLine[]) => {
    const snippets =
      typeof sourcesInput === "string" ? [sourcesInput] : sourcesInput.map((l) => l.inspectLine);
    const minBuffRes = HCCL_BUFFSIZE_MIN_SRCS.map((src) => new RegExp(src, "gi"));
    const fallbackExpRe = new RegExp(
      String.raw`\b(?:expected|min(?:imum)?(?:\s+required)?|required(?:\s+minimum)?|must\s+be\s+at\s+least)\s*[:=]?\s*(>=|=>|>|=|:)?\s*([0-9]+(?:\.[0-9]+)?(?:\s*${HCCL_BUFFSIZE_UNIT_SRC})?)`,
      "gi",
    );
    const curBuffRe = new RegExp(
      String.raw`\bHCCL_BUFFSIZE\s*=\s*([0-9]+(?:\.[0-9]+)?(?:\s*${HCCL_BUFFSIZE_UNIT_SRC})?)`,
      "gi",
    );

    let maxMinFloorMb = 0;
    let maxMinOp = "=";
    let loggedMinBuff: string | undefined;
    let maxCurFloorMb = 0;
    let maxCurMb = -1;
    let loggedCurBuff: string | undefined;

    for (const text of snippets) {
      let stripped = text;
      let anyExplicit = false;
      const explicitRanges: Array<[number, number]> = [];
      for (const re of minBuffRes) {
        for (const mm of text.matchAll(re)) {
          anyExplicit = true;
          explicitRanges.push([mm.index, mm.index + mm[0].length]);
          const op = mm[1] ?? "=";
          const raw = mm[2];
          const mb = parseBuffSizeMb(raw);
          if (mb !== null) {
            const floorMb = op === ">" ? Math.floor(mb) + 1 : Math.ceil(mb);
            if (floorMb > maxMinFloorMb || (floorMb === maxMinFloorMb && op === ">" && maxMinOp !== ">")) {
              maxMinFloorMb = floorMb;
              maxMinOp = op;
              loggedMinBuff = raw;
            }
          }
        }
      }
      if (!anyExplicit) {
        const clauseBreakRe = /(?:[,;():\n]|\band\b|\/(?!(?:s\b|dev\/|tmp\/|var\/|run\/|shm\b)))/gi;
        const sepStarts: number[] = [];
        const sepEnds: number[] = [];
        for (const sep of text.matchAll(clauseBreakRe)) {
          const idx = sep.index ?? 0;
          sepStarts.push(idx);
          sepEnds.push(idx + sep[0].length);
        }
        let sepCursor = 0;
        for (const fm of text.matchAll(fallbackExpRe)) {
          const fmStart = fm.index ?? 0;
          const fmEnd = fmStart + fm[0].length;
          while (sepCursor < sepEnds.length && sepEnds[sepCursor]! <= fmStart) {
            if (activeScaleProbe) activeScaleProbe.buffClauseScans += 1;
            sepCursor += 1;
          }
          const clauseStart = sepCursor > 0 ? sepEnds[sepCursor - 1]! : 0;
          let nextCursor = sepCursor;
          while (nextCursor < sepStarts.length && sepStarts[nextCursor]! < fmEnd) {
            if (activeScaleProbe) activeScaleProbe.buffClauseScans += 1;
            nextCursor += 1;
          }
          if (activeScaleProbe) activeScaleProbe.buffClauseScans += 1;
          const clauseEnd = nextCursor < sepStarts.length ? sepStarts[nextCursor]! : text.length;
          const clause = text.slice(clauseStart, clauseEnd);
          const afterFmClause = text.slice(fmEnd, clauseEnd);
          const parenSuffix = /^\s*\(([^)\r\n]{1,96})\)/.exec(text.slice(fmEnd))?.[1] ?? "";
          if (
            /^\s*(?:(?:of|in|on|at|under|from|for)\s+)?(?:(?:host|cpu|system|pinned|virtual|mmap|shared)\b|dram\b|ram\b|tmpfs\b|kv[\s_-]*cache\b|\/dev\/shm\b)/i.test(
              afterFmClause,
            ) ||
            (parenSuffix !== "" &&
              !/\bHCCL_BUFFSIZE\b/i.test(parenSuffix) &&
              (/^\s*(?:(?:of|in|on|at|under|from|for)\s+)?(?:(?:host|cpu|system|pinned|virtual|mmap|shared)\b|dram\b|ram\b|tmpfs\b|kv[\s_-]*cache\b|\/dev\/shm\b)/i.test(
                parenSuffix,
              ) ||
                (!/\bHCCL(?:\s+(?:buff(?:er)?|comm(?:unication)?\s+buff(?:er)?))\b/i.test(parenSuffix) &&
                  NON_HCCL_MEMORY_SUBJECT_RE.test(parenSuffix)))) ||
            (!/\bHCCL_BUFFSIZE\b/i.test(clause) && NON_HCCL_MEMORY_SUBJECT_RE.test(clause))
          ) {
            continue;
          }
          explicitRanges.push([fmStart, fmEnd]);
          const op = fm[1] ?? "=";
          const raw = fm[2];
          const mb = parseBuffSizeMb(raw);
          if (mb !== null) {
            const floorMb = op === ">" ? Math.floor(mb) + 1 : Math.ceil(mb);
            if (floorMb > maxMinFloorMb || (floorMb === maxMinFloorMb && op === ">" && maxMinOp !== ">")) {
              maxMinFloorMb = floorMb;
              maxMinOp = op;
              loggedMinBuff = raw;
            }
          }
        }
      }
      if (explicitRanges.length > 0) {
        let out = "";
        let cursor = 0;
        explicitRanges.sort((a, b) => a[0] - b[0]);
        for (const [s, e] of explicitRanges) {
          if (e <= cursor) continue;
          const startPos = Math.max(s, cursor);
          out += `${text.slice(cursor, startPos)} `;
          cursor = e;
        }
        stripped = `${out}${text.slice(cursor)}`;
      }
      for (const cm of stripped.matchAll(curBuffRe)) {
        const raw = cm[1];
        const mb = parseBuffSizeMb(raw);
        if (mb !== null) {
          const curFloor = mb >= 128 ? Math.ceil(mb * 2) : 0;
          if (curFloor > maxCurFloorMb || (curFloor === maxCurFloorMb && mb > maxCurMb)) {
            maxCurFloorMb = curFloor;
            maxCurMb = mb;
            loggedCurBuff = raw;
          }
        }
      }
    }

    const requiredBuffFloor = Math.max(128, maxMinFloorMb, maxCurFloorMb);
    const recommendedBuffMb =
      [128, 256, 512, 1024, 2048, 4096].find((tier) => tier >= requiredBuffFloor) ??
      Math.ceil(requiredBuffFloor / 128) * 128;
    return {
      loggedMinBuff,
      loggedMinOp: maxMinOp,
      loggedCurBuff,
      recommendedBuffMb,
      higherTierMb: recommendedBuffMb * 2,
    };
  };

  const HCTL_CONT_RE = new RegExp(
    String.raw`\b(?:expected|min(?:imum)?(?:\s+required)?|required(?:\s+minimum)?|must\s+be\s+at\s+least)\b[^\r\n]{0,96}[0-9]+(?:\.[0-9]+)?\s*${HCCL_BUFFSIZE_UNIT_SRC}\b`,
    "i",
  );

  const isValidHcclBuffContinuationLine = (inspect: string): boolean => {
    if (!HCTL_CONT_RE.test(inspect) && !HCCL_BUFFSIZE_REQ_RE.test(inspect)) {
      return false;
    }
    const hasExplicitBuff = /\bHCCL_BUFFSIZE\b/i.test(inspect);
    if (!hasExplicitBuff && NON_HCCL_MEMORY_SUBJECT_RE.test(inspect)) {
      return false;
    }
    if (
      /(?<![.\w])(?:INFO|DEBUG)\b(?!\s*\()/i.test(inspect) &&
      !hasLogErrorSeverity(inspect) &&
      !/\b(?:HCCL_BUFFSIZE|buff(?:er)?\s*size)\b/i.test(inspect)
    ) {
      return false;
    }
    return true;
  };

  const collectScopedBuffSizeLines = (
    primaryTooSmallLines: readonly ParsedLogLine[],
    anchor: ParsedLogLine | undefined,
  ): ParsedLogLine[] => {
    if (primaryTooSmallLines.length === 0) return [];
    const buffAnchor = primaryTooSmallLines[0] ?? anchor;
    const effDomain: { hostTag: string | null; instanceTag: string | null; groupTag: string | null } = {
      hostTag: buffAnchor?.hostTag ?? null,
      instanceTag: buffAnchor?.instanceTag ?? null,
      groupTag: buffAnchor?.groupTag ?? null,
    };
    let effPid: number | null = buffAnchor?.pid ?? null;
    const latchBuffScope = (l: ParsedLogLine) => {
      if (effDomain.hostTag === null && l.hostTag !== null) effDomain.hostTag = l.hostTag;
      if (effDomain.instanceTag === null && l.instanceTag !== null) effDomain.instanceTag = l.instanceTag;
      if (effDomain.groupTag === null && l.groupTag !== null) effDomain.groupTag = l.groupTag;
      if (effPid === null && l.pid !== null) effPid = l.pid;
    };
    const seenLineNums = new Set<number>();
    const acceptedBase: ParsedLogLine[] = [];
    const isScopedCompatible = (l: ParsedLogLine, ref: ParsedLogLine): boolean =>
      !l.isPromLine &&
      !l.trimmed.startsWith("#") &&
      !isPromExpositionLine(l.trimmed) &&
      l.segmentId === ref.segmentId &&
      areCausalDomainsCompatible(l, ref) &&
      areCausalDomainsCompatible(l, effDomain) &&
      (ref.pid === null || l.pid === null || ref.pid === l.pid) &&
      (effPid === null || l.pid === null || effPid === l.pid) &&
      !hasStartupBoundaryBetween(ctx.startupBoundaryBucket, ref, l, false);

    for (const b of primaryTooSmallLines) {
      if (seenLineNums.has(b.lineNumber)) continue;
      if (buffAnchor && b !== buffAnchor && !isScopedCompatible(b, buffAnchor)) continue;
      if (!areCausalDomainsCompatible(b, effDomain)) continue;
      if (effPid !== null && b.pid !== null && b.pid !== effPid) continue;
      seenLineNums.add(b.lineNumber);
      latchBuffScope(b);
      acceptedBase.push(b);
    }
    const out: ParsedLogLine[] = [...acceptedBase];
    const acceptedBaseSet = new Set(acceptedBase.map((b) => b.lineNumber));
    const isRejectedTooSmall = (cand: ParsedLogLine | undefined): boolean =>
      Boolean(
        cand && !acceptedBaseSet.has(cand.lineNumber) && /HCCL_BUFFSIZE is too SMALL/i.test(cand.inspectLine),
      );
    const hasAdjacentRejectedTooSmallBefore = (l: ParsedLogLine): boolean => {
      for (let d = 1; d <= 4; d += 1) {
        const prev = lineByLineNumber.get(l.lineNumber - d);
        if (!prev) continue;
        if (acceptedBaseSet.has(prev.lineNumber)) return false;
        if (isRejectedTooSmall(prev)) return true;
      }
      return false;
    };

    for (const l of hcclBuffKeywordLines) {
      if (seenLineNums.has(l.lineNumber)) continue;
      if (/HCCL_BUFFSIZE is too SMALL/i.test(l.inspectLine)) continue;
      if (buffAnchor && !isScopedCompatible(l, buffAnchor)) continue;
      if (!areCausalDomainsCompatible(l, effDomain)) continue;
      if (effPid !== null && l.pid !== null && l.pid !== effPid) continue;
      if (hasAdjacentRejectedTooSmallBefore(l)) continue;
      if (isBenignDocumentationOrHelpLine(l.inspectLine)) continue;
      seenLineNums.add(l.lineNumber);
      latchBuffScope(l);
      out.push(l);
    }

    for (const b of acceptedBase) {
      for (const dir of [1, -1] as const) {
        for (let step = 1; step <= 4; step += 1) {
          const l = lineByLineNumber.get(b.lineNumber + dir * step);
          if (!l) continue;
          if (isRejectedTooSmall(l)) break;
          if (seenLineNums.has(l.lineNumber)) continue;
          if (!isScopedCompatible(l, b)) continue;
          if (buffAnchor && buffAnchor !== b && !isScopedCompatible(l, buffAnchor)) continue;
          if (b.rank !== null && l.rank !== null && b.rank !== l.rank) continue;
          if (dir === -1 && hasAdjacentRejectedTooSmallBefore(l)) break;
          if (isValidHcclBuffContinuationLine(l.inspectLine)) {
            seenLineNums.add(l.lineNumber);
            latchBuffScope(l);
            out.push(l);
          }
        }
      }
    }
    out.sort((a, b) => a.lineNumber - b.lineNumber);
    return out;
  };

  const selectRuleHeadlineLines = (sortedLines: readonly ParsedLogLine[]): readonly ParsedLogLine[] => {
    if (sortedLines.length <= 1) return sortedLines;
    const anchor = sortedLines[0]!;
    const effDomain: { hostTag: string | null; instanceTag: string | null; groupTag: string | null } = {
      hostTag: anchor.hostTag,
      instanceTag: anchor.instanceTag,
      groupTag: anchor.groupTag,
    };
    let effPid: number | null = anchor.pid;
    const keepHeadlineLine = (l: ParsedLogLine): boolean => {
      if (l.lineNumber === anchor.lineNumber) return true;
      if (anchor.segmentId !== l.segmentId) return false;
      if (hasStartupBoundaryBetween(ctx.startupBoundaryBucket, anchor, l, true)) return false;
      if (!areCausalDomainsCompatible(anchor, l) || !areCausalDomainsCompatible(effDomain, l)) {
        return false;
      }
      if (
        (anchor.pid !== null && l.pid !== null && anchor.pid !== l.pid) ||
        (effPid !== null && l.pid !== null && effPid !== l.pid)
      ) {
        return false;
      }
      const isPostAnchor =
        anchor.timestampMs !== null && l.timestampMs !== null && areTimestampsComparable(anchor, l)
          ? isStrictlyEarlierTimestamp(anchor, l)
          : false;
      const sameScope =
        (anchor.rank === null || l.rank === null || anchor.rank === l.rank) &&
        (anchor.pid === null || l.pid === null || anchor.pid === l.pid) &&
        (effPid === null || l.pid === null || effPid === l.pid);
      if (sameScope) {
        if (!isPostAnchor) return true;
        const shareTb = anchor.tracebackGroupId !== null && anchor.tracebackGroupId === l.tracebackGroupId;
        return shareTb || Math.abs(l.timestampMs! - anchor.timestampMs!) <= 5000;
      }
      if (anchor.timestampMs !== null && l.timestampMs === null) {
        return false;
      }
      if (isPostAnchor) return false;
      if (signalKindByLineNo.get(l.lineNumber) === "cascade") {
        return false;
      }
      return true;
    };
    const selected: ParsedLogLine[] = [];
    for (const l of sortedLines) {
      if (!keepHeadlineLine(l)) continue;
      selected.push(l);
      if (effDomain.hostTag === null && l.hostTag !== null) effDomain.hostTag = l.hostTag;
      if (effDomain.instanceTag === null && l.instanceTag !== null) effDomain.instanceTag = l.instanceTag;
      if (effDomain.groupTag === null && l.groupTag !== null) effDomain.groupTag = l.groupTag;
      if (effPid === null && l.pid !== null) effPid = l.pid;
    }
    return selected;
  };

  const pickRepresentativeMetricLines = (
    metricLines: readonly ParsedLogLine[],
    familyPatterns: readonly RegExp[],
    limit = 6,
  ): MatchedLogLine[] => {
    const picked: ParsedLogLine[] = [];
    const seenLineNo = new Set<number>();
    const parsedMetrics = metricLines.map((l) => ({
      line: l,
      sample: parsePromMetricSampleLine(l.trimmed),
    }));
    for (const pat of familyPatterns) {
      const hit = parsedMetrics.find(
        ({ line, sample }) =>
          !seenLineNo.has(line.lineNumber) &&
          sample !== null &&
          !extractPromScopeLabels(sample.labelStr).isSummaryOrBucket &&
          pat.test(sample.metricName),
      );
      if (hit) {
        picked.push(hit.line);
        seenLineNo.add(hit.line.lineNumber);
        if (picked.length >= limit) break;
      }
    }
    for (const { line, sample } of parsedMetrics) {
      if (picked.length >= limit) break;
      if (seenLineNo.has(line.lineNumber)) continue;
      if (sample && extractPromScopeLabels(sample.labelStr).isSummaryOrBucket) continue;
      picked.push(line);
      seenLineNo.add(line.lineNumber);
    }
    for (const { line } of parsedMetrics) {
      if (picked.length >= limit) break;
      if (seenLineNo.has(line.lineNumber)) continue;
      picked.push(line);
      seenLineNo.add(line.lineNumber);
    }
    picked.sort((a, b) => a.lineNumber - b.lineNumber);
    return picked.map(toMatched);
  };

  const primaryVerdictLineNo =
    verdict.primaryEvidenceLines[0]?.lineNumber ??
    verdict.timelineEvents?.find((e) => e.kind === "root-cause")?.lineNumber ??
    null;
  const sortRuleLinesByVerdictPriority = (arr: readonly ParsedLogLine[]): ParsedLogLine[] =>
    [...arr].sort((a, b) => {
      const aExact = primaryVerdictLineNo !== null && a.lineNumber === primaryVerdictLineNo ? 0 : 1;
      const bExact = primaryVerdictLineNo !== null && b.lineNumber === primaryVerdictLineNo ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aDomain =
        winnerSignal !== null &&
        winnerSignal.rank !== null &&
        a.rank === winnerSignal.rank &&
        areCausalDomainsCompatible(winnerSignal, a)
          ? 0
          : 1;
      const bDomain =
        winnerSignal !== null &&
        winnerSignal.rank !== null &&
        b.rank === winnerSignal.rank &&
        areCausalDomainsCompatible(winnerSignal, b)
          ? 0
          : 1;
      if (aDomain !== bDomain) return aDomain - bDomain;
      const aTier = getClockTier(a);
      const bTier = getClockTier(b);
      if (aTier !== bTier) return aTier - bTier;
      if (a.timestampMs !== null && b.timestampMs !== null && areTimestampsComparable(a, b)) {
        return compareTimestampOrder(a, b);
      }
      return a.lineNumber - b.lineNumber;
    });

  // Rule 1: Pre-profiling init_snapshot / memory_profiling / KV block capacity exhaustion
  const r1AllLines = sortRuleLinesByVerdictPriority(
    collectAllMatchingLines(
      lines,
      (l) =>
        !isBenignDocumentationOrHelpLine(l.inspectLine) &&
        hasFailureSemantics(l.inspectLine) &&
        /Free memory on device\b[^\r\n]{0,64}\(.+\)\s*on startup\s+is less than desired|Error in memory profiling\.\s*Initial free memory|\bNo available memory for the cache blocks\b/i.test(
          l.inspectLine,
        ),
    ),
  );
  const r1Matches = recordLines(r1AllLines);
  if (r1Matches.length > 0) {
    const r1FirstRaw = r1Matches[0]!.rawLine;
    const isNoCacheBlocks = /\bNo available memory for the cache blocks\b/i.test(r1FirstRaw);
    const isProfilingDrift = /Error in memory profiling/i.test(r1FirstRaw);
    const eqSnapshotMatch =
      /Initial free memory\s+([\d.]+)\s*(GiB|GB|MiB)[^\r\n]{0,64}current free memory\s+([\d.]+)\s*(GiB|GB|MiB)/i.exec(
        r1FirstRaw,
      );
    const isEqualSnapshot =
      eqSnapshotMatch !== null &&
      Number(eqSnapshotMatch[1]) === Number(eqSnapshotMatch[3]) &&
      eqSnapshotMatch[2]!.toLowerCase() === eqSnapshotMatch[4]!.toLowerCase();

    findings.push({
      ruleId: "pre-profile-free-memory",
      title: isNoCacheBlocks
        ? "KV Cache 可用物理块数为零（No available memory for the cache blocks）"
        : isProfilingDrift
          ? isEqualSnapshot
            ? "显存探测快照未升高触发比较断言（Initial == Current free memory）"
            : "显存探测期间同卡并发进程释放导致快照失真（AssertionError）"
          : "启动前预检失败：init_snapshot 空闲显存低于 requested_memory（u × 总显存）",
      severity: "error",
      category: "memory",
      evidenceLevel: "C",
      summary: isNoCacheBlocks
        ? "determine_available_memory() 后可分配给 KV Cache 的物理块数为 0（模型权重与试跑激活峰值几乎耗尽全部可用 HBM），无法满足最小 KV 块分配。"
        : isProfilingDrift
          ? isEqualSnapshot
            ? "determine_available_memory() 检测到试跑前后剩余显存相等（或未严格变化）且触发了内存对比断言，说明启动探测基线或严格比较校验不通过（可能同卡进程并发变化或非预期基线）。"
            : "determine_available_memory() 检测到试跑后空闲显存反而高于初始快照，说明同一 NPU 上存在其他进程在启动探测期间释放或抢占显存。"
          : "NPUWorker 在加载模型与探测前即触发硬校验：当前设备实际空闲显存 < total_memory × gpu_memory_utilization，直接抛出 ValueError 中止启动。",
      mechanism: isNoCacheBlocks
        ? "vLLM kv_cache_utils / worker 在完成 profile_run() 后按剩余可分配 HBM 计算 num_blocks；当剩余空间不足以容纳 1 个 block 时抛出 No available memory for the cache blocks。"
        : "worker.py 先拍摄 init_snapshot，并按 requested_memory = total_memory × gpu_memory_utilization 校验 free_memory >= requested_memory。残留僵尸进程、同卡多实例混布或 u 设定过高都会在进入权重加载前即报错。",
      matchedLines: r1Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L461-L473`,
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L625-L633`,
      ],
      nextEvidenceCmd: "npu-smi info && ps -ef | grep -E 'vllm|python' | grep -v grep",
      experimentStep: isNoCacheBlocks
        ? "增大可用 KV 空间：提高 --tensor-parallel-size、适度上调 --gpu-memory-utilization（确认不越界）、启用权重/KV 量化或收紧 --max-model-len。"
        : "先用 npu-smi info 确认目标 NPU 无残留进程占用 HBM；若是刻意同卡混布，将 --gpu-memory-utilization 降到低于 (free / total) 后复测，观察是否越过 init_snapshot 进入权重加载。",
      wikiPageIds: ["npu-worker-lifecycle", "kv-cache-memory-profiling", "device-memory"],
    });
  }

  // Rule 2: 5-way NPU OOM stage split (capture/warmup vs kv-alloc vs cold-start vs runtime vs unknown)
  const r2AllLines = collectAllMatchingLines(lines, (line) => isNpuOomLine(line, ctx));
  const r2OrderedLines = sortRuleLinesByVerdictPriority(r2AllLines);
  const r2Matches = recordLines(r2OrderedLines);
  if (r2Matches.length > 0) {
    for (const l of lines) {
      if (
        EL0004_MEM_ALLOC_RE.test(l.inspectLine) &&
        !CANN_DRIVER_DEVICE_ENV_CORE_RE.test(l.inspectLine) &&
        hasHbmOomInLineScope(l, ctx)
      ) {
        allMatchedLineNumbers.add(l.lineNumber);
      }
    }
    const targetR2Line = r2OrderedLines[0];
    const oomStage =
      (targetR2Line && ctx.oomStageByLine.get(targetR2Line.lineNumber)) ??
      classifyNpuOomStage(
        lines,
        targetR2Line,
        ctx.lineIndexByLineNumber,
        ctx.oomLifecycleCandidates,
        ctx.oomLifecycleIndex,
      );
    let hasExplicitKvAllocOp =
      targetR2Line !== undefined && KV_ALLOC_OOM_STAGE_RE.test(targetR2Line.inspectLine);
    if (!hasExplicitKvAllocOp && oomStage === "kv-alloc" && targetR2Line) {
      const targetIdx = ctx.lineIndexByLineNumber.get(targetR2Line.lineNumber) ?? -1;
      if (targetIdx >= 0) {
        const wStart = Math.max(0, targetIdx - 20);
        const wEnd = Math.min(lines.length - 1, targetIdx + 20);
        for (let k = wStart; k <= wEnd; k += 1) {
          const cand = lines[k]!;
          if (
            Math.abs(cand.lineNumber - targetR2Line.lineNumber) <= 20 &&
            KV_ALLOC_OOM_STAGE_RE.test(cand.inspectLine) &&
            isContiguousStackFrameForOom(lines, targetIdx, k)
          ) {
            hasExplicitKvAllocOp = true;
            break;
          }
        }
      }
    }
    const oomCopy = {
      capture: {
        title: "KV 池建立后的图捕获 / 预热期 OOM（u 偏高挤干 1 - u 图池余量）",
        summary:
          "模型权重与 KV Cache 池已分配完成，但在 compile_or_warm_up_model() / capture_model() 阶段 HBM 耗尽——典型原因是 gpu_memory_utilization (u) 设得过高，把 1 - u 留给 ACLGraph 图池与 CANN 工作区的余量吃空。",
        mechanism:
          "vLLM-Ascend 先在 determine_available_memory() 中把 requested_memory 扣除权重与试跑峰值后全部划给 KV Cache，随后才在 compile_or_warm_up_model() 执行 capture_model()；因此图池与 CANN 运行时额外缓冲只能落入剩余空间。u 越接近 1.0，图捕获越易 OOM。",
        experimentStep:
          "单项对照：先将 --gpu-memory-utilization 下调 0.07~0.08（例如 0.95 → 0.88 下调 0.07，或 910B3 真机 0.90 → 0.82 下调 0.08）或改用 worker 建议的 --kv-cache-memory；若立即可过 capture_model，即可确认是 1 - u 余量不足而非权重超限。",
      },
      "kv-alloc": {
        title: hasExplicitKvAllocOp
          ? "KV Cache 物理块分配期 NPU HBM OOM（initialize_kv_cache / initialize_from_config）"
          : "KV Cache 物理块分配期 NPU HBM OOM（基于 Available KV cache memory 预算推断，具体分配调用帧待确认）",
        summary: hasExplicitKvAllocOp
          ? "已完成 Available KV cache memory 探测计算，但在 initialize_kv_cache() / initialize_from_config() 实际申请 KV 物理显存块时 HBM 耗尽（尚未进入 ACLGraph 图捕获阶段）。"
          : "日志仅确立 Available KV cache memory 显存预算，尚未见到后续图捕获（capture_model）或推理阶段里程碑；按启动时序推断 OOM 更可能发生在后续 KV Cache 物理块分配期（缺少 initialize_kv_cache() / initialize_from_config() 堆栈或直接分配报错，具体失败位置待完整堆栈确认）。",
        mechanism:
          "探测完成与正式申请 KV Cache 之间可能存在临时缓冲未完全归还、多卡碎片差异或并发进程占存，导致按 available_memory 预算分配的 KV 池在 torch.empty() 分配期触发 OOM。",
        experimentStep:
          "先核对是否同卡有残留进程或设置 PYTORCH_NPU_ALLOC_CONF=expandable_segments:True；若仍复现，微调降低 --gpu-memory-utilization（如降 0.03~0.05）或显式指定保守 --kv-cache-memory。",
      },
      "cold-start": {
        title: "冷启动权重加载 / 试跑探测期 NPU HBM OOM",
        summary: "NPU HBM 在权重加载（load_model）或试跑探测（profile_run）阶段即耗尽，尚未完成 KV 池切分。",
        mechanism:
          "权重显存 + HCCL 通信域常驻缓冲 + max_num_batched_tokens 试跑激活峰值已超过单卡可用 HBM，需要从 TP 切分、量化或收紧批处理/序列上限入手。",
        experimentStep:
          "单项对照：先开启 --enforce-eager 并收紧 --max-model-len / --max-num-batched-tokens 复测；若在 load_model 即 OOM，需增大 TP 或改用 W8A8/W4A8 量化。",
      },
      runtime: {
        title: "运行期请求执行 / Workspace 显存不足（NPU HBM OOM）",
        summary:
          "NPU HBM 在运行期请求执行（Prefill / Decode）或算子 Workspace 临时缓冲分配阶段耗尽，常见于长序列/大并发激活峰值、动态工作区分配或碎片化超出 KV 池之外的可用 HBM 空间。",
        mechanism:
          "vLLM 完成冷启动权重与 KV Cache 池划拨后，运行期的请求激活张量、Attention/MoE 临时 Workspace（如 NPUWorkspaceAllocator）以及未复用碎片均落在 KV 池之外的剩余空间；长序列或高并发请求会直接触发运行期 OOM。",
        experimentStep:
          "先核对是否因长上下文/并发或 Workspace 分配暴涨触发：1) 收紧 --max-num-batched-tokens / --max-num-seqs；2) 若 reserved >> allocated，检查 PYTORCH_NPU_ALLOC_CONF=expandable_segments:True 或适度下调 --gpu-memory-utilization 留出更多运行时 Workspace 余量。",
      },
      unknown: {
        title: "NPU HBM OOM（缺少阶段里程碑，阶段归属待补采启动前序日志核实）",
        summary:
          "日志中仅有 NPU out of memory / OutOfMemoryError 报错而缺乏前序生命周期里程碑（如 Model loading took / Available KV cache memory / capture_model / execute_model），尚无法单凭片段区分冷启动、KV 分配、图捕获或运行期阶段，需补采前序日志核实。",
        mechanism:
          "torch_npu 在任何显存分配阶段耗尽 HBM 时均抛出相同异常类名；必须结合 Worker 启动与调度里程碑（load_model → profile_run → initialize_kv_cache → capture_model → execute_model）定位真实耗尽阶段。",
        experimentStep:
          "按下方命令检索完整启动到崩溃前的里程碑行；确认阶段后再针对冷启动权重、1-u 图余量或运行期并发/碎片定向调整。",
      },
    }[oomStage];
    findings.push({
      ruleId: "oom-stage-split",
      title: oomCopy.title,
      severity: "error",
      category: "memory",
      evidenceLevel: "C",
      summary: oomCopy.summary,
      mechanism: oomCopy.mechanism,
      matchedLines: r2Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L599-L635`,
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L905-L928`,
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/model_runner_v1.py#L6607-L6618`,
        `${VLLM_ASCEND_V030}:vllm_ascend/device/device_op.py#L212-L224`,
      ],
      nextEvidenceCmd:
        "grep -nE 'Model loading took|Available KV cache memory|capture_model|NPU out of memory' vllm_serve.log",
      experimentStep: oomCopy.experimentStep,
      wikiPageIds: ["kv-cache-memory-profiling", "acl-graph", "device-memory"],
    });
  }

  // Rule 3: Multi-rank EI0002 / EI0006 / HCCL_E_TIMEOUT / HCCL_E_WAIT_TIMEOUT / monitoredBarrier with root-cause Rank vs pure network/HCCS timeout
  const r3AllLines = collectAllMatchingLines(lines, (line) => isHcclTimeoutFaultLine(line, ctx));
  const r3Matches = recordLines(r3AllLines);
  if (r3Matches.length > 0) {
    const r3Joined = r3AllLines.map((l) => l.inspectLine).join(" ");
    const hasEi0002 =
      /\bEI0002\b|Notify wait execute timeout|The wait execution of the Notify register times out/i.test(
        r3Joined,
      );
    const hasEi0006 = /\bEI0006\b/i.test(r3Joined);
    const hasWaitTimeoutEnum = /\bHCCL_E_WAIT_TIMEOUT\b/i.test(r3Joined);
    const hasHccleTimeout = /\bHCCL_E_TIMEOUT\b/i.test(r3Joined);
    const hasHcclError9 = /\bHCCL\s+error:\s*9\b/i.test(r3Joined);
    const hasMonitoredBarrier = /\bmonitoredBarrier\b/i.test(r3Joined);
    const timeoutCodeTag =
      hasEi0002 && hasEi0006
        ? "EI0002 / EI0006"
        : hasEi0002
          ? "EI0002"
          : hasEi0006
            ? "EI0006"
            : hasWaitTimeoutEnum
              ? "HCCL_E_WAIT_TIMEOUT"
              : hasHccleTimeout
                ? "HCCL_E_TIMEOUT"
                : hasHcclError9
                  ? "HCCL error: 9 (HCCL_E_TIMEOUT)"
                  : hasMonitoredBarrier
                    ? "monitoredBarrier"
                    : "WAIT_TIMEOUT";
    const r3SignalByLine = new Map<number, ClassifiedSignal>();
    for (const sig of signals) {
      if (!r3SignalByLine.has(sig.lineNumber)) r3SignalByLine.set(sig.lineNumber, sig);
    }
    const r3CascadeSignals = r3AllLines
      .map((line) => r3SignalByLine.get(line.lineNumber) ?? classifyLineSignal(line, ctx))
      .filter((s): s is ClassifiedSignal => s !== null && s.kind === "cascade");
    const r3CascadeRankSet = new Set<number>();
    let r3HasEarlier = false;
    let r3HasUnverified = false;
    for (const sig of r3CascadeSignals) {
      const rel = classifyCascadeAgainstWinner(
        winnerSignal,
        sig,
        selection.winnerOrderAmbiguous,
        selection.ambiguousCompetingPrimaries,
        ctx,
      );
      if (rel === "earlier-than-primary") {
        r3HasEarlier = true;
        continue;
      }
      const isSameWinner =
        winnerSignal !== null &&
        winnerSignal.rank !== null &&
        hasLogicalCausalRank(sig) &&
        sig.rank === winnerSignal.rank &&
        areCausalDomainsCompatible(winnerSignal, sig);
      if (isSameWinner) continue;
      if (rel === "confirmed-after" && hasLogicalCausalRank(sig)) {
        r3CascadeRankSet.add(sig.rank!);
      } else {
        r3HasUnverified = true;
      }
    }
    const r3CascadeRanks = [...r3CascadeRankSet].sort((a, b) => a - b);
    const causalState: CascadeCausalState =
      winnerSignal === null || verdict.rank === null
        ? "no-primary"
        : r3HasEarlier
          ? "earlier-than-primary"
          : r3CascadeRanks.length > 0
            ? "confirmed-after"
            : r3HasUnverified || r3CascadeSignals.length > 0
              ? "unverified-order"
              : "unverified-order";
    const hasOtherWaitingRank =
      winnerSignal !== null &&
      verdict.rank !== null &&
      (r3CascadeRanks.length > 0 ||
        r3CascadeSignals.some(
          (l) => l.rank === null || l.rank !== verdict.rank || !areCausalDomainsCompatible(winnerSignal, l),
        ));
    const hasConfirmedAfter =
      verdict.rank !== null && causalState === "confirmed-after" && r3CascadeRanks.length > 0;
    const isEarlierTimeout = verdict.rank !== null && causalState === "earlier-than-primary";
    const isUnverifiedWithPrimary = verdict.rank !== null && !hasConfirmedAfter && !isEarlierTimeout;
    const unrankedPrimary = verdict.rank === null ? selection.anyPrimary : null;
    const cascadeLabel = r3CascadeRanks.length > 0 ? `Rank ${r3CascadeRanks.join("/")}` : "其余卡";

    findings.push({
      ruleId: "hccl-timeout-cascade",
      title: hasConfirmedAfter
        ? `集合通信连锁超时（${timeoutCodeTag}）：Rank ${verdict.rank} 先出错，其余卡卡在 AllReduce / Notify 等待`
        : isEarlierTimeout
          ? `HCCL 集合通信超时（${timeoutCodeTag}）早于 Rank ${verdict.rank} 报错：超时在前，需排查更早慢卡或链路`
          : isUnverifiedWithPrimary
            ? hasOtherWaitingRank
              ? `集合通信超时（${timeoutCodeTag}）伴随 Rank ${verdict.rank} 主报错（缺少同域完整时间戳或实例/通信组/目标不匹配，先后顺序待核实）`
              : `HCCL 集合通信等待超时（${timeoutCodeTag}，未见确认的跨卡后继等待队列）`
            : unrankedPrimary !== null
              ? `HCCL 集合通信超时（${timeoutCodeTag}）伴随未标注 Rank 主报错（${unrankedPrimary.signalTag}，因果先后待补全 Rank 与时间戳确认）`
              : `HCCL 集合通信超时（${timeoutCodeTag}）：尚未见单卡主报错，需区分慢卡与链路故障`,
      severity: "error",
      category: "distributed",
      evidenceLevel: hasConfirmedAfter ? "C" : "I",
      summary: hasConfirmedAfter
        ? `日志中 ${cascadeLabel} 报出 ${timeoutCodeTag}（${hasEi0002 ? "算子执行期 Notify 等待超时" : hasWaitTimeoutEnum || hasHccleTimeout || hasHcclError9 ? "HCCL 等待超时" : "集合通信等待超时"}），且时间线上 Rank ${verdict.rank} 更早触发主故障；集合通信超时属于连带症状，修复目标在 Rank ${verdict.rank} 而非调大 HCCL 超时。`
        : isEarlierTimeout
          ? `当前日志虽包含 Rank ${verdict.rank} 的报错信号，但时间戳显示 ${timeoutCodeTag} 集合通信等待超时发生得更早；不能倒果为因把前序超时归咎于后续报错，需补齐超时时刻前的全卡日志或排查链路。`
          : isUnverifiedWithPrimary
            ? `日志同时包含 ${timeoutCodeTag} 集合通信等待超时与 Rank ${verdict.rank} 的报错，但跨节点/实例/通信组/目标 Rank 未完全匹配或缺少同域双端时间戳，尚不能断言其严格晚于该单卡报错；建议优先修复 Rank ${verdict.rank} 主报错并核对完整时间轴。`
            : unrankedPrimary !== null
              ? `日志中同时检出未带 Rank 前缀的主报错「${unrankedPrimary.signalTag}」（第 ${unrankedPrimary.lineNumber} 行）与 HCCL ${timeoutCodeTag} 集合通信等待超时；因主报错缺少 Rank / Device 标识，尚不能确认具体先出错卡及因果先后，需补全各卡带 Rank 前缀的同期日志。`
              : `当前日志仅见 HCCL ${timeoutCodeTag} 集合通信等待超时，缺少任一 Rank 的前序算子/OOM 报错；此时不能假定 Rank 0 是根因，也可能是未贴入的某张卡先卡死，或 HCCS/RoCE 链路不通。`,
      mechanism:
        "集合通信（AllReduce / AllGather / AllToAll / monitoredBarrier）要求通信组内全部 Rank 按相同顺序进入同步点。CANN HCCL 区分两类超时：EI0002 / HCCL_E_TIMEOUT (9) 属于算子执行期 Notify/同步等待超时（常见于任意卡先卡死或异常退出导致其余正常卡等在同步点）；EI0006 属于通信域 Socket 建链等待超时。默认算子超时 1836s，platform.py 也会把 RPC 超时抬高至 3000s 避免误杀。",
      matchedLines: r3Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/platform.py#L942-L951`,
        `${VLLM_ASCEND_V030}:vllm_ascend/utils.py#L1250-L1265`,
      ],
      nextEvidenceCmd:
        "grep -rnE 'ERROR|EZ9999|EI0002|EI0006|out of memory' ~/ascend/log/debug/plog/ | sort -k2 | head -n 40 && hccn_tool -i 0 -link -g",
      experimentStep: hasConfirmedAfter
        ? `先按 Rank ${verdict.rank} 的主报错卡片执行修复并复测；不要通过调大 HCCL_EXEC_TIMEOUT 掩盖首错卡故障。`
        : isEarlierTimeout
          ? "1) 补齐超时时刻之前的全部参与 Rank 日志与 CANN plog 寻找真正最早停滞的进程；2) 用 hccn_tool / hccl_test 验证跨卡链路与网卡状态。"
          : isUnverifiedWithPrimary
            ? `1) 优先处理 Rank ${verdict.rank} 的主报错卡片并复测；2) 若复现仍超时，带完整时间戳导出全部节点/Rank 日志与 plog 核实先后顺序。`
            : unrankedPrimary !== null
              ? `1) 优先排查并修复已检出的主报错「${unrankedPrimary.signalTag}」；2) 补采带 Rank / Device 前缀与完整时间戳的各卡 worker 日志及 CANN plog 确认首错卡与级联顺序。`
              : "1) 补齐所有参与 Rank 的同期前序日志与 CANN plog 寻找最早 ERROR；2) 若所有 Rank 均无前序算子报错，用 hccn_tool / hccl_test 验证跨卡链路与网卡配置。",
      wikiPageIds: ["cann-hccl", "hccl-buffer", "collective-communication"],
    });
  }

  // Rule 4: Exit code 137 / -9 (SIGKILL) and Exit code 139 / -11 (SIGSEGV) evaluated independently
  const sigkillAll = collectAllMatchingLines(lines, (l) => isSigkillLine(l.inspectLine));
  const sigkillMatches = recordLines(sigkillAll);
  if (sigkillMatches.length > 0) {
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
      matchedLines: sigkillMatches,
      sources: [`${VLLM_V030}:vllm/v1/engine/utils.py#L262-L285`],
      nextEvidenceCmd:
        "dmesg -T | grep -iE 'killed process|oom-killer' | tail -n 20 && cat /sys/fs/cgroup/memory.events 2>/dev/null; docker inspect --format='{{.State.OOMKilled}} {{.State.ExitCode}}' <container_id>",
      experimentStep:
        "核对 dmesg / cgroup oom_kill 计数与容器 OOMKilled 标志：若为宿主机/容器 DRAM OOM，增大容器内存上限、调大 /dev/shm 或降低 CPU 并行加载并发；若 oom_kill=0，则排查平台探针超时（livenessProbe）或人为 kill。",
      wikiPageIds: ["device-memory", "npu-worker-lifecycle", "ascend-env-and-serve"],
    });
  }
  const sigsegvAll = collectAllMatchingLines(lines, (l) => isSigsegvLine(l.inspectLine));
  const sigsegvMatches = recordLines(sigsegvAll);
  if (sigsegvMatches.length > 0) {
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
      matchedLines: sigsegvMatches,
      sources: [`${VLLM_V030}:vllm/v1/engine/utils.py#L262-L285`],
      nextEvidenceCmd:
        "python -c 'import torch, torch_npu, vllm, vllm_ascend; print(torch.__version__, torch_npu.__version__, vllm.__version__, vllm_ascend.__file__)' && cat /usr/local/Ascend/ascend-toolkit/latest/version.cfg",
      experimentStep:
        "先核对 CANN / torch_npu / vllm-ascend 版本矩阵并开启 --enforce-eager 最小启动复现，隔离是图捕获路径还是基础算子库 ABI 冲突。",
      wikiPageIds: ["ascend-env-and-serve", "npu-worker-lifecycle"],
    });
  }

  // Rule 5: SoC / wheel mismatch or 310P BF16 / GQA + C8 uncalibrated checkpoint ValueError
  const r5AllLines = sortRuleLinesByVerdictPriority(
    collectAllMatchingLines(
      lines,
      (line) => isSocCompatLine(line.inspectLine) || isGqaStaticC8KvLine(line.inspectLine),
    ),
  );
  const r5Matches = recordLines(r5AllLines);
  if (r5Matches.length > 0) {
    const joined = selectRuleHeadlineLines(r5AllLines)
      .map((m) => m.inspectLine)
      .join(" ");
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

  // Rule 6: NPUGRAPH_EX / ACLGraph capture & stream-event failure (advisory capability fallback never acts as primary root-cause)
  const r6AllLines = collectAllMatchingLines(
    lines,
    (line) => isGraphCaptureFaultLine(line, ctx) || isPiecewiseSilentResetLine(line.inspectLine),
  );
  const r6AdvisoryLines = collectAllMatchingLines(lines, (line) =>
    isAdvisoryGraphCapabilityWarning(line.inspectLine),
  );
  if (r6AllLines.length > 0) {
    const r6Matches = recordLines(r6AllLines);
    for (const adv of r6AdvisoryLines) allMatchedLineNumbers.add(adv.lineNumber);
    const joined = r6AllLines.map((m) => m.inspectLine).join(" ");
    const joinedCodes = stripLogIdFieldsForErrorCodes(joined);
    const isFa3Conflict =
      /AscendFAImpl does not support ACL graph capture/i.test(joined) ||
      (/\bfa3\b/i.test(joined) && /\bFULL_DECODE_ONLY\b/i.test(joined));
    const isStreamCaptureFault = STREAM_CAPTURE_CODE_RE.test(joinedCodes);
    const hasFullDecode = /\bFULL_DECODE_ONLY\b/i.test(joined);
    const isPiecewiseReset =
      !isFa3Conflict &&
      !isStreamCaptureFault &&
      r6AllLines.every((l) => isPiecewiseSilentResetLine(l.inspectLine));
    findings.push({
      ruleId: "graph-capture-failure",
      title: isFa3Conflict
        ? "ACLGraph 图捕获冲突：FA3（AscendFAImpl）不支持 FULL_DECODE_ONLY 图模式"
        : isStreamCaptureFault
          ? "ACLGraph 流捕获/事件依赖异常（107024 / 107025：流未汇合或 Event 未录制）"
          : isPiecewiseReset
            ? "cudagraph_mode=PIECEWISE 静默重置 npugraph_ex / static_kernel / super_kernel 为 False"
            : hasFullDecode
              ? "ACLGraph FULL_DECODE_ONLY 图捕获失败或动态形状/算子冲突"
              : "ACLGraph / NPUGRAPH_EX 图捕获失败或回退异常",
      severity: isFa3Conflict || isStreamCaptureFault ? "error" : "warn",
      category: "graph",
      evidenceLevel: "C",
      summary: isFa3Conflict
        ? "fa3_v1.py 明确禁止在非 eager 下与 CUDAGraphMode.FULL_DECODE_ONLY 组合，初始化即抛 ValueError。"
        : isStreamCaptureFault
          ? "ACLGraph 录图期间触发 107025（AclmdlRICaptureEnd / rtStreamEndCapture 存在未 join 回主流的分支流）或 107024（rtStreamWaitEvent 等待了未在本捕获图中录制的 Event）。"
          : isPiecewiseReset
            ? "platform.py _setup_compile_backend 检测到 cudagraph_mode=PIECEWISE 与 npugraph_ex 不兼容，已将 enable_npugraph_ex、enable_static_kernel 与 enable_super_kernel 一并静默重置为 False（属于独立的静默重置提示，不同于 ascend_config.py 中的前置依赖断言报错）。"
            : "图捕获阶段出现算子不支持、动态形状冲突或图模式回退失败。",
      mechanism: isStreamCaptureFault
        ? "ACLGraph 要求从 AclmdlRICaptureBegin 到 AclmdlRICaptureEnd 的全部异步分支流经 rtStreamWaitEvent 汇合且仅等待同图内录制的 Event；多流并发或外部流未同步直接结束捕获会返回 107024/107025。"
        : isPiecewiseReset
          ? "vllm_ascend/platform.py#L1313-L1352 的 _setup_compile_backend 在 NONE / PIECEWISE / FULL_AND_PIECEWISE 下静默清空 npugraph_ex、static_kernel 与 super_kernel；须改用 FULL_DECODE_ONLY（或 FULL）以保留静图与静态核。"
          : "vllm_ascend/attention/fa3_v1.py 对 FA3 校验 cudagraph_mode != FULL_DECODE_ONLY；其余模式在捕获动态形状/不受支持算子时需切回 PIECEWISE 或 eager。",
      matchedLines: r6Matches,
      sources: isPiecewiseReset
        ? [
            `${VLLM_ASCEND_V030}:vllm_ascend/platform.py#L1313-L1352`,
            `${VLLM_ASCEND_V030}:vllm_ascend/ascend_config.py#L145-L169`,
          ]
        : [
            `${VLLM_ASCEND_V030}:vllm_ascend/attention/fa3_v1.py#L50-L60`,
            `${VLLM_ASCEND_V030}:vllm_ascend/ascend_config.py#L145-L163`,
          ],
      nextEvidenceCmd:
        "grep -nE 'cudagraph_mode|npugraph_ex|enforce_eager|AscendFAImpl|capture_model|107024|107025' vllm_serve.log",
      experimentStep: isFa3Conflict
        ? "二选一对照：改用默认 FIA 注意力后端（推荐，保留 FULL_DECODE_ONLY 图加速），或保留 FA3 时改为 PIECEWISE / --enforce-eager 复测。"
        : isStreamCaptureFault
          ? "核查捕获区间内跨流依赖（确保辅助流 record/wait 配对并 join 回主流）；先用 --enforce-eager 或 PIECEWISE 验证隔离整图录制并发问题。"
          : isPiecewiseReset
            ? "若需真正生效 Static Kernel / npugraph_ex，将 cudagraph_mode 改为 FULL_DECODE_ONLY（或 FULL）并移除 PIECEWISE，防止开关被静默重置为 False。"
            : "先临时加 --enforce-eager 验证同输入是否可正常跑通；若 eager 正常而图路径失败，再缩小到具体图模式（PIECEWISE vs FULL_DECODE_ONLY）或关闭 npugraph_ex 排查不兼容算子。",
      wikiPageIds: ["acl-graph", "npugraph-ex", "ascend-flash-attention"],
    });
  } else if (r6AdvisoryLines.length > 0) {
    const r6Matches = recordLines(r6AdvisoryLines);
    findings.push({
      ruleId: "graph-capture-failure",
      title: "NPUGRAPH_EX / 图模式硬件能力不支持提示（已自动回退关闭，非故障根因）",
      severity: "warn",
      category: "graph",
      evidenceLevel: "C",
      summary:
        "当前告警为硬件能力检测后的自动回退提示（例如不支持 npugraph_ex 时自动关闭并回退常规执行路径），本身不会中止启动或导致报错；若进程后续崩溃请优先排查实际异常卡片。",
      mechanism:
        "vllm_ascend/ascend_config.py 根据 HardwareCapability.NPUGRAPH_EX 在初始化阶段自动降级关闭 npugraph_ex / static_kernel / super_kernel 并继续执行。",
      matchedLines: r6Matches,
      sources: [`${VLLM_ASCEND_V030}:vllm_ascend/ascend_config.py#L145-L163`],
      nextEvidenceCmd: "grep -nE 'cudagraph_mode|npugraph_ex|ERROR|Traceback' vllm_serve.log",
      experimentStep:
        "该告警为信息性能力降级提示，通常无需处置；仅当希望确认是否启用图优化时再核对当前硬件规格与 cudagraph_mode。",
      wikiPageIds: ["acl-graph", "npugraph-ex"],
    });
  }

  // Rule 7: /metrics KV cache usage > 95% + cumulative preemptions + waiting > 0 (evaluated per (model_name, engine) scope)
  const r7Scopes = metricScopes
    .filter(
      (s) =>
        s.snapshot.hasMetrics &&
        s.snapshot.kvCacheUsageRatio !== undefined &&
        s.snapshot.kvCacheUsageRatio > 0.95,
    )
    .sort((a, b) => {
      const aStorm =
        (a.snapshot.numPreemptionsTotal ?? 0) > 0 && (a.snapshot.numRequestsWaiting ?? 0) > 0 ? 0 : 1;
      const bStorm =
        (b.snapshot.numPreemptionsTotal ?? 0) > 0 && (b.snapshot.numRequestsWaiting ?? 0) > 0 ? 0 : 1;
      if (aStorm !== bStorm) return aStorm - bStorm;
      return (b.snapshot.kvCacheUsageRatio ?? 0) - (a.snapshot.kvCacheUsageRatio ?? 0);
    });
  if (r7Scopes.length > 0) {
    const topScope = r7Scopes[0]!;
    const sMetrics = topScope.snapshot;
    const waiting = sMetrics.numRequestsWaiting ?? 0;
    const preemptions = sMetrics.numPreemptionsTotal ?? 0;
    const isStorm = preemptions > 0 && waiting > 0;
    const kvPct = (sMetrics.kvCacheUsageRatio! * 100).toFixed(1);
    const scopeParts: string[] = [...topScope.exporterParts];
    if (topScope.engine !== null) scopeParts.push(`engine=${topScope.engine}`);
    if (topScope.modelName !== null) scopeParts.push(`model=${topScope.modelName}`);
    const scopeBadge = metricScopes.length > 1 && scopeParts.length > 0 ? ` [${scopeParts.join(", ")}]` : "";
    const metricLines = collectAllMatchingLines(
      lines,
      (l) => {
        if (l.trimmed.startsWith("#")) return false;
        const mName = parsePromMetricSampleLine(l.trimmed)?.metricName;
        return (
          mName !== undefined &&
          (metricScopes.length <= 1 || topScope.lineNumbers.has(l.lineNumber)) &&
          /^vllm:(?:kv_cache_usage_perc|gpu_cache_usage_perc|num_preemptions(?:_total)?|num_requests_waiting)$/.test(
            mName,
          )
        );
      },
      true,
    );
    for (const l of metricLines) allMatchedLineNumbers.add(l.lineNumber);
    const r7MatchedLines = pickRepresentativeMetricLines(metricLines, [
      /^vllm:(?:kv_cache_usage_perc|gpu_cache_usage_perc)$/,
      /^vllm:num_requests_waiting$/,
      /^vllm:num_preemptions(?:_total)?$/,
    ]);
    findings.push({
      ruleId: "metrics-kv-preemption-storm",
      title: isStorm
        ? `KV Cache 池打满${scopeBadge}（KV ${kvPct}% · 累计已记录抢占 ${preemptions} 次 · 当前 KV 高水位伴随排队 ${waiting} 条）`
        : `KV Cache 水位逼近上限${scopeBadge}（${kvPct}%），存在随时触发抢占重算的高风险`,
      severity: isStorm ? "error" : "warn",
      category: "metrics",
      evidenceLevel: "D",
      summary: isStorm
        ? `当前快照${scopeBadge}显示 vllm:kv_cache_usage_perc=${kvPct}%（> 95%）且伴随 vllm:num_requests_waiting=${waiting}，同时累计计数器 num_preemptions_total=${preemptions}（自进程启动以来的累计抢占次数，说明历史累计已记录抢占且当前 KV 高水位伴随排队；建议连续采样确认该累计值是否持续递增，区分单次历史累计与持续抢占抖动）。`
        : `vllm:kv_cache_usage_perc${scopeBadge} 已达 ${kvPct}%（> 95%），当前随时会因并发或上下文略微增长触发调度抢占（preemption）。`,
      mechanism:
        "PagedAttention 将序列 KV 分配到固定大小的物理块池中；当活跃请求的序列总长度逼近总块数上限时，vLLM 调度器会挂起新请求（num_requests_waiting 上升）并抢占已运行请求的 KV 块（num_preemptions_total 为单调递增累计计数器），待释放后再重算整个前缀，形成正反馈抖动。",
      matchedLines: r7MatchedLines,
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

  // Rule 8: /metrics low KV usage & 0 waiting (when present), yet high ITL or TTFT (evaluated per (model_name, engine) scope)
  const r8Scopes = metricScopes
    .filter((s) => {
      const m = s.snapshot;
      return (
        m.hasMetrics &&
        (m.kvCacheUsageRatio === undefined || m.kvCacheUsageRatio < 0.65) &&
        (m.numRequestsWaiting === undefined || m.numRequestsWaiting === 0) &&
        ((m.itlAvgSec !== undefined && m.itlAvgSec >= 0.08) ||
          (m.ttftAvgSec !== undefined && m.ttftAvgSec >= 1.5))
      );
    })
    .sort((a, b) => {
      const aScore = Math.max((a.snapshot.itlAvgSec ?? 0) / 0.08, (a.snapshot.ttftAvgSec ?? 0) / 1.5);
      const bScore = Math.max((b.snapshot.itlAvgSec ?? 0) / 0.08, (b.snapshot.ttftAvgSec ?? 0) / 1.5);
      return bScore - aScore;
    });
  if (r8Scopes.length > 0) {
    const topScope = r8Scopes[0]!;
    const sMetrics = topScope.snapshot;
    const highItl = sMetrics.itlAvgSec !== undefined && sMetrics.itlAvgSec >= 0.08;
    const highTtft = sMetrics.ttftAvgSec !== undefined && sMetrics.ttftAvgSec >= 1.5;
    const hasKv = sMetrics.kvCacheUsageRatio !== undefined;
    const hasWaiting = sMetrics.numRequestsWaiting !== undefined;
    const hasTtft = sMetrics.ttftAvgSec !== undefined;
    const hasItl = sMetrics.itlAvgSec !== undefined;
    const isNormalItl = hasItl && sMetrics.itlAvgSec! < 0.08;
    const isNormalTtft = hasTtft && sMetrics.ttftAvgSec! < 1.5;
    const scopeParts: string[] = [...topScope.exporterParts];
    if (topScope.engine !== null) scopeParts.push(`engine=${topScope.engine}`);
    if (topScope.modelName !== null) scopeParts.push(`model=${topScope.modelName}`);
    const scopeBadge = metricScopes.length > 1 && scopeParts.length > 0 ? ` [${scopeParts.join(", ")}]` : "";

    const observedFacts: string[] = [];
    if (hasKv) {
      observedFacts.push(`vllm:kv_cache_usage_perc=${(sMetrics.kvCacheUsageRatio! * 100).toFixed(1)}%`);
    }
    if (hasWaiting) observedFacts.push(`vllm:num_requests_waiting=${sMetrics.numRequestsWaiting}`);
    if (hasTtft) observedFacts.push(`平均 TTFT=${(sMetrics.ttftAvgSec! * 1000).toFixed(0)} ms`);
    if (hasItl) observedFacts.push(`平均 ITL=${(sMetrics.itlAvgSec! * 1000).toFixed(1)} ms/tok`);

    const missingFacts: string[] = [];
    if (!hasKv) missingFacts.push("kv_cache_usage_perc");
    if (!hasWaiting) missingFacts.push("num_requests_waiting");
    if (!hasTtft) missingFacts.push("time_to_first_token_seconds");
    if (!hasItl) missingFacts.push("inter_token_latency_seconds");

    const prefixLabel =
      hasKv && hasWaiting
        ? "低 KV 零排队但延迟偏高"
        : hasKv
          ? "低 KV 水位但延迟偏高（排队指标未采集）"
          : hasWaiting
            ? "零排队但延迟偏高（KV 使用率未采集）"
            : "延迟偏高（KV 与排队指标未采集）";

    const bottleneckLabel =
      highTtft && !highItl
        ? `Prefill 计算 / 分块预算瓶颈（高 TTFT，${isNormalItl ? "正常 ITL" : "ITL 未采集"}）`
        : highItl && !highTtft
          ? `Decode Host 调度空泡 / HBM 带宽瓶颈（${hasKv && hasWaiting ? "低 KV 零排队，" : ""}高 ITL${isNormalTtft ? "，TTFT 正常" : ""}）`
          : "Prefill 与 Decode 双阶段延迟均偏高（计算/下发或长输入阻塞）";

    const metricLines = collectAllMatchingLines(
      lines,
      (l) => {
        if (l.trimmed.startsWith("#")) return false;
        const sample = parsePromMetricSampleLine(l.trimmed);
        if (!sample) return false;
        if (extractPromScopeLabels(sample.labelStr).isSummaryOrBucket) return false;
        return (
          (metricScopes.length <= 1 || topScope.lineNumbers.has(l.lineNumber)) &&
          /^vllm:(?:kv_cache_usage_perc|gpu_cache_usage_perc|num_requests_waiting|(?:inter_token_latency_seconds|time_to_first_token_seconds)(?:_sum|_count)?)$/.test(
            sample.metricName,
          )
        );
      },
      true,
    );
    for (const l of metricLines) allMatchedLineNumbers.add(l.lineNumber);
    const r8MatchedLines = pickRepresentativeMetricLines(
      metricLines,
      [
        /^vllm:(?:kv_cache_usage_perc|gpu_cache_usage_perc)$/,
        /^vllm:num_requests_waiting$/,
        /^vllm:inter_token_latency_seconds_sum$/,
        /^vllm:inter_token_latency_seconds_count$/,
        /^vllm:time_to_first_token_seconds_sum$/,
        /^vllm:time_to_first_token_seconds_count$/,
        /^vllm:inter_token_latency_seconds$/,
        /^vllm:time_to_first_token_seconds$/,
      ],
      8,
    );
    findings.push({
      ruleId: "metrics-low-kv-high-latency",
      title: `${prefixLabel}${scopeBadge}：${bottleneckLabel}`,
      severity: "warn",
      category: "metrics",
      evidenceLevel: "D",
      summary: `当前快照${scopeBadge}已采集：${observedFacts.join("、")}${hasKv && hasWaiting ? "（已排除队列积压与 KV 抢占）" : ""}${missingFacts.length > 0 ? `；以下指标未在本片段采集：${missingFacts.join(" / ")}（请勿将未采集项视为低水位或正常）` : ""}。${
        highItl && !highTtft
          ? "重点排查是否误开 --enforce-eager 导致 Host 逐算子下发空泡、小 batch HBM 权重搬运受限或 TP 跨卡通信拖尾。"
          : highTtft && !highItl
            ? "重点排查长 prompt 计算量过大、chunked-prefill 单轮 token 预算（max_num_batched_tokens）偏小或未命中 Prefix Cache。"
            : "需拆开 Prefill 与 Decode 两段核对图模式（ACLGraph）、chunk 预算与硬件 Roofline 算力/带宽上限。"
      }`,
      mechanism:
        "当 kv_cache_usage_perc 偏低且无排队请求时，延迟瓶颈不在容量与排队，而落在单步执行效率：TTFT 主要受 Prefill 算力/分块次数主导，ITL 主要受 Decode 阶段 Host 算子下发延迟（未开 ACLGraph）与 HBM 权重读取带宽主导。",
      matchedLines: r8MatchedLines,
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

  // Rule 9: Mooncake / PD KV-transfer error
  const r9AllLines = collectAllMatchingLines(lines, (l) => isMooncakePdErrorLine(l.inspectLine));
  const r9Matches = recordLines(r9AllLines);
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

  // Rule 10: Sleep Mode wake_up() or start_weight_update() + FRACTAL_NZ weight layout guard
  const r10AllLines = collectAllMatchingLines(lines, (l) => isSleepFractalNzLine(l.inspectLine));
  const r10Matches = recordLines(r10AllLines);
  if (r10Matches.length > 0) {
    const r10LineSet = new Set(r10AllLines.map((l) => l.lineNumber));
    const r10TbIds = new Set(
      r10AllLines.map((l) => l.tracebackGroupId).filter((id): id is number => id !== null),
    );
    const r10ByPid = new Map<number, DomainIndexedBucket>();
    const r10ByRank = new Map<number, DomainIndexedBucket>();
    const r10AllDomain = createDomainIndexedBucket();
    let hasWeightUpdate = false;
    let hasWakeUp = false;
    const scanActionTokens = (text: string) => {
      if (/\b(?:start_weight_update|weight_update|_check_nz_disabled)\b/i.test(text)) {
        hasWeightUpdate = true;
      }
      if (/\bwake_up\b/i.test(text)) hasWakeUp = true;
    };
    for (const r10Line of r10AllLines) {
      scanActionTokens(r10Line.inspectLine);
      pushToDomainBucket(r10AllDomain, r10Line);
      if (r10Line.pid !== null) pushToKeyedDomainBucket(r10ByPid, r10Line.pid, r10Line);
      if (r10Line.rank !== null) pushToKeyedDomainBucket(r10ByRank, r10Line.rank, r10Line);
    }
    for (const b of r10ByPid.values()) finalizeDomainBucket(b);
    for (const b of r10ByRank.values()) finalizeDomainBucket(b);
    finalizeDomainBucket(r10AllDomain);
    if (!hasWeightUpdate || !hasWakeUp) {
      for (const l of lines) {
        if (hasWeightUpdate && hasWakeUp) break;
        if (r10LineSet.has(l.lineNumber)) continue;
        const inR10Tb = l.tracebackGroupId !== null && r10TbIds.has(l.tracebackGroupId);
        if (
          !inR10Tb &&
          !/\b(?:start_weight_update|weight_update|_check_nz_disabled|wake_up)\b/i.test(l.inspectLine)
        ) {
          continue;
        }
        if (
          inR10Tb ||
          (!isBenignInfoOrDebugInitLine(l.inspectLine) &&
            hasFailureSemantics(l.inspectLine) &&
            ((l.pid !== null &&
              someInTimedDomainBucket(
                r10ByPid.get(l.pid),
                l,
                60_000,
                60_000,
                50,
                (r10Line) =>
                  (r10Line.rank === null || l.rank === null || r10Line.rank === l.rank) &&
                  areLinesInSameExecutionScope(r10Line, l, 10),
              )) ||
              (l.rank !== null &&
                someInTimedDomainBucket(r10ByRank.get(l.rank), l, 60_000, 60_000, 50, (r10Line) =>
                  areLinesInSameExecutionScope(r10Line, l, 10),
                )) ||
              someInTimedDomainBucket(
                r10AllDomain,
                l,
                60_000,
                60_000,
                10,
                (r10Line) =>
                  (r10Line.rank === null || l.rank === null || r10Line.rank === l.rank) &&
                  areLinesInSameExecutionScope(r10Line, l, 10),
              )))
        ) {
          scanActionTokens(l.inspectLine);
        }
      }
    }
    const isPureWeightUpdate = hasWeightUpdate && !hasWakeUp;
    const isPureWakeUp = hasWakeUp && !hasWeightUpdate;
    const sources: string[] = [];
    if (hasWakeUp || !hasWeightUpdate) {
      sources.push(`${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L279-L286`);
    }
    if (hasWeightUpdate || !hasWakeUp) {
      sources.push(`${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L318-L339`);
    }
    sources.push(
      `${VLLM_ASCEND_V030}:vllm_ascend/utils.py#L373-L386`,
      `${VLLM_ASCEND_V030}:vllm_ascend/model_loader/rfork/safety.py#L9-L18`,
    );
    findings.push({
      ruleId: "sleep-mode-fractal-nz-wakeup",
      title: isPureWeightUpdate
        ? "在线权重更新失败：weight_nz_mode 非零触发 start_weight_update() FRACTAL_NZ 守卫（ValueError）"
        : isPureWakeUp
          ? "Sleep Mode 唤醒失败：weight_nz_mode 非零触发 wake_up() FRACTAL_NZ 守卫（ValueError）"
          : "Sleep wake_up() / 权重更新 start_weight_update() 触发 FRACTAL_NZ 守卫（ValueError）",
      severity: "error",
      category: "compatibility",
      evidenceLevel: "C",
      summary: isPureWeightUpdate
        ? "实例在调用 start_weight_update() 进行权重更新时，被 worker.py:318-339 的 _check_nz_disabled() 拦截抛出 ValueError：即使普通 BF16 权重在默认 weight_nz_mode=1 下按 utils.py:373-386 并未转为 FRACTAL_NZ，只要配置值非零即会拒绝权重更新。"
        : isPureWakeUp
          ? "实例在 --enable-sleep-mode 下可执行 sleep() 卸载权重，但调用 wake_up() 时被 worker.py:279-286 拦截抛出 ValueError：即使普通 BF16 权重在默认 weight_nz_mode=1 下按 utils.py:373-386 并未转为 FRACTAL_NZ，只要配置值非零即会拒绝唤醒。"
          : "worker.py 在 Sleep Mode 的 wake_up()（worker.py:279-L286）或在线权重更新 start_weight_update() -> _check_nz_disabled()（worker.py:318-339）处拦截非零 weight_nz_mode 并抛出 ValueError（即使 BF16 权重在 weight_nz_mode=1 下并未转为 FRACTAL_NZ）。",
      mechanism:
        "按 vllm_ascend/utils.py#L373-L386，普通 BF16/FP16 权重仅在 weight_nz_mode=2 时转换为 FRACTAL_NZ，默认 weight_nz_mode=1 并不转 NZ；但 vllm_ascend/worker/worker.py#L279-L286（wake_up）与 #L318-L339（start_weight_update 调用 _check_nz_disabled）均直接校验配置项 weight_nz_mode != 0，只要非零即抛 ValueError（防范依赖 NZ 的权重在 RL/重载场景出现精度异常）。",
      matchedLines: r10Matches,
      sources,
      nextEvidenceCmd:
        "grep -nE 'enable_sleep_mode|weight_nz_mode|FRACTAL_NZ|CaMem sleep|wake_up|start_weight_update' vllm_serve.log",
      experimentStep:
        "启动参数追加 --additional-config '{\"weight_nz_mode\": 0}'（或开启 rl_config.enabled=true）后重新验证 wake_up() / start_weight_update() 闭环（BF16 模型由 mode=1 改 0 不影响常规算子布局；注意启用 Sleep 会使 RFork 回退默认加载）。",
      wikiPageIds: ["sleep-mode", "tensor-layout", "npu-worker-lifecycle", "device-memory"],
    });
  }

  // Rule 11: Mooncake ADXL endpoint fallback warning (Dest buffer device_id >= endpoint count)
  const r11AllLines = collectAllMatchingLines(lines, (l) => isMooncakeAdxlFallbackLine(l.inspectLine));
  const r11Matches = recordLines(r11AllLines);
  if (r11Matches.length > 0) {
    const totalFallbackCount = r11AllLines.length;
    const distinctR11Ranks = new Set(r11AllLines.filter((l) => hasLogicalCausalRank(l)).map((l) => l.rank!));
    const hasConfirmedMultiRankStorm = distinctR11Ranks.size >= 2;
    const isSingleOrUnconfirmedScope = totalFallbackCount === 1 || !hasConfirmedMultiRankStorm;
    const rankQualifier = distinctR11Ranks.size === 1 ? ` Rank ${[...distinctR11Ranks][0]} ` : "同源单点";
    findings.push({
      ruleId: "mooncake-adxl-endpoint-fallback",
      title:
        totalFallbackCount === 1
          ? "Mooncake ADXL 单条端点回退告警（Dest buffer device_id >= endpoint count）"
          : isSingleOrUnconfirmedScope
            ? `Mooncake ADXL 端点回退告警（仅${rankQualifier}观测到 ${totalFallbackCount} 条，跨卡覆盖与频率/延迟影响待确认）`
            : "Mooncake ADXL 多卡端点回退刷屏告警（Dest buffer device_id >= endpoint count）",
      severity: "warn",
      category: "kv-transfer",
      evidenceLevel: "C",
      summary:
        totalFallbackCount === 1
          ? "Decode 端拉取远端 KV Cache 时，Mooncake ADXL（transfer_executor_base.cpp:64）因目的缓冲区 device_id 超出直连 endpoint 数触发回退（当前日志片段仅命中 1 条，单条通常尚不足以独立构成明显性能瓶颈；仅当高并发下持续高频刷屏时才会显著放大主机 I/O 开销与首字延迟 TTFT）。"
          : isSingleOrUnconfirmedScope
            ? `Decode 端拉取远端 KV Cache 时，Mooncake ADXL（transfer_executor_base.cpp:64）因目的缓冲区 device_id 超出单会话暴露的直连 endpoint 数而触发回退；当前日志片段仅在${rankQualifier}命中 ${totalFallbackCount} 行，尚不足以确认全集群多卡并发覆盖范围与对 TTFT/P→D 交接的实际耗时影响，需结合全卡并发采样日志与请求传输耗时进一步确认。`
            : `Decode 端拉取远端 KV Cache 时，Mooncake ADXL（transfer_executor_base.cpp:64）因目的缓冲区 device_id 超出单会话暴露的直连 endpoint 数而触发回退（当前日志片段已在 ${distinctR11Ranks.size} 张卡命中 ${totalFallbackCount} 行；Ascend 910B3 真机 2P2D / 4P4D 压测分别刷出 4,991 行与 19,941 行），放大主机 I/O 开销与首字延迟（TTFT）。`,
      mechanism: isSingleOrUnconfirmedScope
        ? "vllm_ascend/distributed/kv_transfer/utils/mooncake_transfer_engine.py 初始化单进程 GlobalTE（ascend 协议），并在 mooncake_connector.py 中调用 batch_transfer_sync_read 批量拉取离散 KV 段。当目的缓冲区的 device_id >= 当前 ADXL endpoint count 时底层逐段打印回退日志并改走回退端点；该现象本身不会中断推理，仅当高并发下在多卡持续高频刷屏时才会显著增加主机 I/O 并拖慢 P→D 交接，实际性能影响尚待并发请求耗时证实。"
        : "vllm_ascend/distributed/kv_transfer/utils/mooncake_transfer_engine.py 初始化单进程 GlobalTE（ascend 协议），并在 mooncake_connector.py 中调用 batch_transfer_sync_read 批量拉取离散 KV 段（如 Qwen3-8B 单请求 3 块 × 36 层 × K/V = 216 段）。当多卡 TP/EP 下目的缓冲区的 device_id 大于或等于当前 ADXL endpoint count 时，底层逐段打印回退日志并改走回退端点，虽不中断推理但显著拖慢 P→D 交接。",
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
  const r12AllLines = collectAllMatchingLines(lines, (l) => isDebugLoggingHotpathLine(l.inspectLine));
  const r12Matches = recordLines(r12AllLines);
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

  // Rule 13: CANN C++ plog / AI Core & Vector Core runtime fault codes (507014 / 507015 / 507018 / 507034 / 507035 / 107030 / 207003 / non-zero retCode / CheckSmmuFault)
  const r13AllLines = sortRuleLinesByVerdictPriority(
    collectAllMatchingLines(lines, (line) => {
      const owner = lineOwnerMap.get(line.lineNumber);
      if (owner && owner !== "cann-plog-aicore-fault") return false;
      return isCannPlogHardwareFaultLine(line, ctx);
    }),
  );
  const r13Matches = recordLines(r13AllLines);
  if (r13Matches.length > 0) {
    const joined = selectRuleHeadlineLines(r13AllLines)
      .map((m) =>
        ctx.nonfatal107030Lines.has(m.lineNumber) ? stripNonfatal107030Clauses(m.inspectLine) : m.inspectLine,
      )
      .join(" ");
    const sanitizedCodes = stripLogIdFieldsForErrorCodes(joined);
    const has507014 = /\b507014\b|ACL_ERROR_RT_AICORE_TIMEOUT/i.test(sanitizedCodes);
    const has507015 = /\b507015\b|ACL_ERROR_RT_AICORE_EXCEPTION/i.test(sanitizedCodes);
    const has507018 = /\b507018\b|ACL_ERROR_RT_AICPU_EXCEPTION/i.test(sanitizedCodes);
    const has507034 = /\b507034\b|vector\s+core\s+timeout/i.test(sanitizedCodes);
    const has507035 = /\b507035\b|ACL_ERROR_RT_VECTOR_CORE_EXCEPTION/i.test(sanitizedCodes);
    const has207003 = /\b207003\b|ACL_ERROR_RT_AICORE_OVER_FLOW/i.test(sanitizedCodes);
    const has107030 = /\b107030\b|CAPTURE_MODE_NOT_SUPPORT/i.test(sanitizedCodes);
    const hasVectorCore = /\bvector\s+core\b|\bSetStarsResultForDavinciTask\b/i.test(joined);
    const hasSmmu =
      /CheckSmmuFault|\bSMMU fault\b|MTE (?:accesses an invalid GM address|DDR address out of range)/i.test(
        joined,
      );
    const kernelMatch = /fault\s+kernel_name\s*=\s*([A-Za-z0-9_]+)/i.exec(joined);
    const kernelLabel = kernelMatch?.[1] ? `（故障核函数 ${kernelMatch[1]}）` : "";
    const retCodeMatch = /retCode\s*[:=]\s*(0x0*[1-9a-f][0-9a-f]*)/i.exec(joined);
    const retCodeBadge = retCodeMatch?.[1] ? ` / retCode=${retCodeMatch[1]}` : "";

    let r13Title: string;
    let r13Summary: string;
    if (has507015 && has507035) {
      r13Title = `CANN AI/Vector Core 设备执行异常（507015 / 507035${retCodeBadge}${hasSmmu ? " · 含 SMMU 越界" : ""}）${kernelLabel}`;
      r13Summary = `日志中不同主机或进程同时报出 507015（AI Core 异常）与 507035（Vector Core / 算子核函数执行异常）${hasSmmu ? "并伴随 SMMU 访存越界线索" : ""}${retCodeBadge ? `（${retCodeBadge.slice(3)}）` : ""}${kernelLabel}，需按各自 Rank / PID 的 plog 首错核函数分别定位。`;
    } else if (has507014 && !has507015 && !has507035) {
      r13Title = `CANN 运行时 AI Core 执行超时（507014 ACL_ERROR_RT_AICORE_TIMEOUT${retCodeBadge}）${kernelLabel}`;
      r13Summary = `设备流同步返回 507014（ACL_ERROR_RT_AICORE_TIMEOUT${retCodeBadge ? `，${retCodeBadge.slice(3)}` : ""}）${kernelLabel}，表明 AI Core 单核函数执行耗时超出硬件看门狗阈值（多见于超大形状计算、算子死循环或核间同步卡死）。`;
    } else if (has507034 && !has507015 && !has507035) {
      r13Title = `CANN 运行时 Vector Core 执行超时（error code 507034${retCodeBadge}）`;
      r13Summary =
        "外层流同步报 507034（Vector Core AIV 超时），常见于超长序列单步计算超阈值，或开启 SP（FlashComm1）与共享专家多流重叠等特性时触发核间同步挂死。";
    } else if (has507018 && !has507015 && !has507035) {
      r13Title = `CANN AICPU 核函数执行异常（507018 ACL_ERROR_RT_AICPU_EXCEPTION${retCodeBadge}）${kernelLabel}`;
      r13Summary = `设备侧 AICPU 任务执行返回 507018（ACL_ERROR_RT_AICPU_EXCEPTION${retCodeBadge ? `，${retCodeBadge.slice(3)}` : ""}）${kernelLabel}，请核查对应 PID 的 CANN plog 首错算子参数与 AICPU 运行环境/内存状态。`;
    } else if (has207003 && !has507015 && !has507035) {
      r13Title = "CANN AI Core 算术溢出（207003 ACL_ERROR_RT_AICORE_OVER_FLOW）";
      r13Summary =
        "207003（ACL_ERROR_RT_AICORE_OVER_FLOW）属于 AI Core 浮点/量化算术溢出，常见于 FP16 权重/激活幅值越界或量化 Scale 校准异常，不等同于访存越界。";
    } else if (has507035) {
      r13Title = `CANN Vector Core / 算子核函数执行异常（error code 507035${retCodeBadge}${hasSmmu ? " · 伴随 SMMU 访存越界" : ""}）${kernelLabel}`;
      r13Summary = `设备流同步或运行期报 507035（Vector Core 异常或算子核函数下发/执行异常${hasSmmu ? "，日志同时包含 SMMU 访存越界线索" : ""}）${retCodeBadge ? `（${retCodeBadge.slice(3)}）` : ""}${kernelLabel}，常见于自定义/融合算子 Tiling 边界不满足、Workspace 失配、空指针/访存越界或图捕获重放地址异常，需结合 plog 首错核函数定位。`;
    } else if (has107030 && !has507015) {
      r13Title = "CANN 图捕获流内混入不受支持操作（error code 107030）";
      r13Summary =
        "107030（ACL_ERROR_RT_CAPTURE_MODE_NOT_SUPPORT）表明 ACLGraph 录图期间触发了主机侧同步或受限内存拷贝。";
    } else if (hasVectorCore && !has507015) {
      r13Title = `CANN Vector Core 核函数执行异常（Vector Core${retCodeBadge}${hasSmmu ? " · SMMU 越界" : ""}）${kernelLabel}`;
      r13Summary = `设备侧报告 Vector Core 核函数执行异常${retCodeBadge ? `（${retCodeBadge.slice(3)}）` : ""}${hasSmmu ? " 并伴随 SMMU 访存越界" : ""}${kernelLabel}；请以实际 Vector Core 错误码与同 PID 的 CANN plog 首错核函数为准，排查参数指针、UB/GM 越界访问或算子 Tiling 边界。`;
    } else if (has507015) {
      r13Title = `CANN AI Core 硬件执行异常${hasSmmu ? " / SMMU 访存越界" : ""}（507015${retCodeBadge}）${kernelLabel}`;
      r13Summary = `外层流同步或运行结果返回 507015（ACL_ERROR_RT_AICORE_EXCEPTION${retCodeBadge ? ` / ${retCodeBadge.slice(3)}` : ""}）${hasSmmu ? "并伴随 CheckSmmuFault 访存越界线索" : ""}${kernelLabel}，表明设备侧核函数执行异常或指令/地址违例，需按同 PID CANN plog 首错核函数与图模式隔离。`;
    } else {
      r13Title = `CANN AI Core 硬件执行异常${hasSmmu ? " / SMMU 访存越界" : ""}（${retCodeBadge ? retCodeBadge.slice(3) : "plog 硬件异常"}）${kernelLabel}`;
      r13Summary = `CANN plog 检出设备侧执行异常${retCodeBadge ? `（${retCodeBadge.slice(3)}）` : ""}${hasSmmu ? " 及 CheckSmmuFault 访存越界" : ""}${kernelLabel}，表明核函数执行期发生地址越界或指令违例，需结合同 PID plog 首错核函数与图模式隔离。`;
    }

    findings.push({
      ruleId: "cann-plog-aicore-fault",
      title: r13Title,
      severity: "error",
      category: "graph",
      evidenceLevel: "C",
      summary: r13Summary,
      mechanism:
        "设备流同步码（507014 / 507015 / 507018 / 507034 / 507035 / 207003）只是主机侧收到的异步异常汇总，真正故障现场记录在同一进程 PID 的 CANN plog（[DFX_INFO] fault kernel_name=... / CheckSmmuFault / SetStarsResultForDavinciTask / retCode）中；排障时必须按实际错误码区分 AI Core 异常/超时、Vector Core/核函数异常与算术溢出。",
      matchedLines: r13Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/compilation/acl_graph.py#L181-L220`,
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L762-L778`,
      ],
      nextEvidenceCmd:
        "grep -rnE 'CheckSmmuFault|aicore exception|vector core|fault kernel_name|SetStarsResult|507014|507015|507018|507034|507035|207003|107030' ~/ascend/log/debug/plog/ | head -n 30",
      experimentStep:
        has507034 || has507014
          ? "1) 先单变量关闭多流重叠或序列并行开关（如 multistream_overlap_shared_expert / enable_sp）复测是否解除超时挂死；2) 若为超长上下文，收敛单步 max_num_batched_tokens。"
          : has207003
            ? "优先改用 --dtype bfloat16（910B/A3 原生支持 BF16 动态范围）或核查量化权重 Scale 是否含 NaN/Inf。"
            : "1) 加 --enforce-eager 对照复现：若 eager 正常仅图模式崩，聚焦 ACLGraph 捕获档位与 W8A8 工作区越界；2) 若 eager 同样崩，按 plog 中的 fault kernel_name 核对 CANN 版本与模型输入边界。",
      wikiPageIds: ["inference-troubleshooting", "ai-core", "acl-graph"],
    });
  }

  // Rule 14: CANN libopapi.so missing .so / symbol or aclnn 161001 / 161002 / 561002 / 561103 / EZ1001 / EZ0008 / EZ0026 / EZ0027 parameter & inner tiling errors
  const r14AllLines = sortRuleLinesByVerdictPriority(
    collectAllMatchingLines(lines, (line) => {
      const inspect = line.inspectLine;
      const owner = lineOwnerMap.get(line.lineNumber);
      if (owner && owner !== "cann-opapi-or-aclnn-fault") return false;
      const tbOwner =
        line.tracebackGroupId !== null ? tracebackOwnerMap.get(line.tracebackGroupId) : undefined;
      if (
        tbOwner &&
        tbOwner !== "cann-opapi-or-aclnn-fault" &&
        !R14_PARAM_OR_SYMBOL_RE.test(stripLogIdFieldsForErrorCodes(inspect))
      ) {
        return false;
      }
      return isCannOpapiOrAclnnLine(inspect);
    }),
  );
  const r14Matches = recordLines(r14AllLines);
  if (r14Matches.length > 0) {
    const joined = selectRuleHeadlineLines(r14AllLines)
      .map((m) => m.inspectLine)
      .join(" ");
    const sanitizedCodes = stripLogIdFieldsForErrorCodes(joined);
    const isMissingLibopapi =
      /libopapi\.so[^\r\n]{0,128}(?:cannot open shared object file|No such file or directory|not found|missing)/i.test(
        joined,
      );
    const isSymbolMissing =
      !isMissingLibopapi &&
      /(?:\b(?:not|missing)\s+in|undefined symbol[^\r\n]{0,96})\s+libopapi\.so|libopapi\.so(?::|\s+)[^\r\n]{0,96}\bundefined\s+symbol\b/i.test(
        joined,
      );
    const has161001 = /\b161001\b|\bACLNN_ERR_PARAM_NULLPTR\b/i.test(sanitizedCodes);
    const has161002 =
      /\b(?:161002|EZ0008|EZ0026|EZ0027|EZ1001)\b|\bACLNN_ERR_PARAM_INVALID\b|\bAclNN_Parameter_Error\b/i.test(
        sanitizedCodes,
      );
    const has561002 = /\b(?:561002|561103)\b|\bACLNN_ERR_INNER_TILING_ERROR\b/i.test(sanitizedCodes);
    const hasExplicitCode = has161001 || has161002 || has561002;

    const codeLabels: string[] = [];
    const summaryDetails: string[] = [];
    if (has161001) {
      codeLabels.push("161001 ACLNN_ERR_PARAM_NULLPTR");
      summaryDetails.push("161001（ACLNN_ERR_PARAM_NULLPTR）表明传入算子的必选指针为空指针");
    }
    if (has161002) {
      codeLabels.push("161002 ACLNN_ERR_PARAM_INVALID / EZ1001");
      summaryDetails.push(
        "161002（ACLNN_ERR_PARAM_INVALID）或 EZ1001/EZ0008/EZ0026/EZ0027 参数错误表明传入张量的 dtype、维度对齐、步长或量化配置违反算子参数校验约束",
      );
    }
    if (has561002) {
      const tilingCodes = /\b561103\b/.test(sanitizedCodes)
        ? /\b561002\b/.test(sanitizedCodes)
          ? "561002 / 561103"
          : "561103"
        : "561002";
      codeLabels.push(`${tilingCodes} ACLNN_ERR_INNER_TILING_ERROR`);
      summaryDetails.push(
        `${tilingCodes}（ACLNN_ERR_INNER_TILING_ERROR）属于算子 Host Tiling 内部/形状属性校验错误（常由输入张量 shape、切片宽度或属性组合边界触发）`,
      );
    }

    findings.push({
      ruleId: "cann-opapi-or-aclnn-fault",
      title: isMissingLibopapi
        ? "CANN 算子动态库 libopapi.so 缺失或无法加载（套件未激活 / LD_LIBRARY_PATH 缺漏）"
        : isSymbolMissing
          ? "CANN 算子库符号缺失（not in libopapi.so）：CANN 版本滞后或芯片族不支持该算子"
          : hasExplicitCode
            ? has561002 && !has161001 && !has161002
              ? `CANN aclnn 算子 Tiling 内部/形状属性校验错误（${/\b561103\b/.test(sanitizedCodes) && !/\b561002\b/.test(sanitizedCodes) ? "561103" : "561002"} ACLNN_ERR_INNER_TILING_ERROR）`
              : has161001 && !has161002 && !has561002
                ? "CANN aclnn 算子必选参数为空指针（161001 ACLNN_ERR_PARAM_NULLPTR）"
                : `CANN aclnn 算子参数/Tiling 校验失败（${codeLabels.join(" / ")}）`
            : "CANN aclnn 算子调用失败（需结合 aclGetRecentErrMsg 区分入参越界与核函数异常）",
      severity: "error",
      category: "compatibility",
      evidenceLevel: isMissingLibopapi || isSymbolMissing || hasExplicitCode ? "C" : "I",
      summary: isMissingLibopapi
        ? "动态加载 CANN 算子库 libopapi.so 时找不到共享库文件（cannot open shared object file / No such file or directory），通常是容器未加载 ascend-toolkit set_env.sh 或 LD_LIBRARY_PATH 未指向 CANN lib64。"
        : isSymbolMissing
          ? "已加载 libopapi.so，但在符号解析阶段找不到目标 aclnn 算子入口（例如在 A3 上误调仅 A2 支持的算子，或容器内 CANN Toolkit 版本低于 vllm-ascend 编译基线）。"
          : hasExplicitCode
            ? `aclnn 算子明确返回错误码：${summaryDetails.join("；")}。`
            : "日志仅见 aclnn 算子调用报错但未贴出具体返回码；可能是 161001/161002 入参规格越界、561002/561103 Tiling 校验失败，或底层流执行异常，需结合紧邻错误码或 plog 进一步确认。",
      mechanism:
        "vllm-ascend 通过 torch_npu 与 op-plugin 动态加载 CANN libopapi.so 并解析 aclnn 符号（两段接口 GetWorkspaceSize 与 Execute）；找不到 .so 属于环境/库路径缺失，not in libopapi.so 属于版本/芯片 ABI 缺失，161001/161002/EZ1001 与 561002/561103 则属于 Host 参数或 Tiling 校验失败。",
      matchedLines: r14Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/ops/register_custom_ops.py#L1-L20`,
        `${VLLM_ASCEND_V030}:vllm_ascend/device/hardware_profile.py#L310-L332`,
      ],
      nextEvidenceCmd: isMissingLibopapi
        ? "ls -la /usr/local/Ascend/ascend-toolkit/latest/lib64/libopapi.so && echo $LD_LIBRARY_PATH"
        : "cat /usr/local/Ascend/ascend-toolkit/latest/version.cfg && nm -D /usr/local/Ascend/ascend-toolkit/latest/lib64/libopapi.so 2>/dev/null | grep -i aclnn | head -n 20",
      experimentStep: isMissingLibopapi
        ? "确认容器已 source /usr/local/Ascend/ascend-toolkit/set_env.sh（及 cann-ops 扩展 env），检查 libopapi.so 是否存在于 LD_LIBRARY_PATH 中。"
        : isSymbolMissing
          ? "核对容器内 CANN 版本是否匹配 vllm-ascend 发布基线（如 v0.30.0 对应 CANN 9.1.0），并检查当前芯片（A2 vs A3 vs 310P）是否支持所启用的融合/投机特性。"
          : "抓取紧邻报错的 aclGetRecentErrMsg 明细与输入张量 shape/dtype，核对必选指针非空、head_dim / TP 整除关系与算子属性边界是否满足要求。",
      wikiPageIds: ["inference-troubleshooting", "ascend-env-and-serve", "hardware-devices"],
    });
  }

  // Rule 15: Port bind collision (ZMQ / Metrics listener / TCPStore / API uvicorn / generic TCP Address already in use)
  const r15AllLines = sortRuleLinesByVerdictPriority(
    collectAllMatchingLines(lines, (l) => isPortConflictLine(l.inspectLine)),
  );
  const r15Matches = recordLines(r15AllLines);
  if (r15Matches.length > 0) {
    const portSub = getPortConflictSubtype(r15AllLines[0]!.inspectLine) ?? "generic-tcp";
    const isMetrics = portSub === "metrics";
    const isTcpstore = portSub === "tcpstore";
    const isApi = portSub === "api-uvicorn";
    const isGenericTcp = portSub === "generic-tcp";
    findings.push({
      ruleId: "zmq-port-conflict",
      title: isMetrics
        ? "Metrics / Prometheus 监控端口冲突（Address already in use）：监控监听端口被占用"
        : isTcpstore
          ? "分布式 TCPStore / 控制面端口冲突（EADDRINUSE / Address already in use）"
          : isApi
            ? "API Server / Uvicorn 服务监听端口冲突（Errno 98 / Address already in use）"
            : isGenericTcp
              ? "TCP 监听端口占用冲突（EADDRINUSE / Address already in use）"
              : "ZMQ 通信端口冲突（Address already in use）：残留进程占口或多实例端口撞车",
      severity: "error",
      category: "distributed",
      evidenceLevel: "C",
      summary: isMetrics
        ? "监控 / Metrics HTTP 服务端口绑定失败（Address already in use），主因是同机多实例或残留 exporter 占用了同一 Prometheus /metrics 监听端口（与 ZMQ Worker 握手阻塞不同）。"
        : isTcpstore
          ? "PyTorch c10d TCPStore 初始化监听端口失败（EADDRINUSE / Address already in use），常见于多任务复用同一 MASTER_PORT 或上次运行的主节点进程尚未退出释放端口。"
          : isApi
            ? "HTTP / Uvicorn API 服务监听端口被占用（Errno 98: Address already in use），请检查目标端口上的现有服务进程或显式指定空闲 --port。"
            : isGenericTcp
              ? "服务进程绑定 TCP 监听端口时返回 EADDRINUSE / Address already in use，说明同机网络命名空间内目标端口已被既有进程或 TIME_WAIT 套接字占用（单凭 tcp:// 监听报错尚不能推断具体通信框架归属）。"
              : "Worker 或 EngineCore 绑定 ZMQ TCP 套接字时抛出 Address already in use（并常连带引发对端节点报 Gloo Connection closed by peer），主因是上次退出的残留进程未释放端口或同机多实例共用了默认端口。",
      mechanism:
        isMetrics || isApi || isGenericTcp
          ? "监听服务调用 socket bind() 时操作系统返回 EADDRINUSE（Errno 98），说明同一宿主/容器网络命名空间内已有进程占用了目标监听端口。"
          : "vLLM 通过 make_zmq_socket() / c10d TCPStore 在主机侧建立前端、EngineCore 与跨节点握手控制通道；任一节点 bind 失败退出后，对端 Gloo/HCCL 握手随即因连接断开连锁报错。",
      matchedLines: r15Matches,
      sources: [`${VLLM_V030}:vllm/utils/network_utils.py#L310-L368`],
      nextEvidenceCmd:
        "ss -ltnp | grep -E 'vllm|python|uvicorn|9090|8000|29500|6000' || lsof -iTCP -sTCP:LISTEN -P -n | grep python",
      experimentStep: isMetrics
        ? "用 ss -ltnp 找出占用监控端口（如 9090）的进程，错开不同实例的 metrics/prometheus 监听端口或清理孤立监控进程。"
        : isTcpstore
          ? "用 ss -ltnp 核对 MASTER_PORT / --distributed-executor-backend 控制端口占用并更换空闲端口或清理残留主进程。"
          : isApi
            ? "改用空闲服务端口（--port <free_port>）或停止端口上旧的 vLLM / API 进程。"
            : isGenericTcp
              ? "用 ss -ltnp 或 lsof 定位占用目标监听端口的进程，确认是否需终止残留占用进程或为新监听服务分配空闲端口。"
              : "先清理同机残留的 vllm / EngineCore / Worker 进程确认端口释放；若是同机拉起多实例或 P/D 双实例，显式错开 --port、--data-parallel-rpc-port 与 kv_transfer_config 通信端口。",
      wikiPageIds: ["inference-troubleshooting", "ascend-env-and-serve"],
    });
  }

  // Rule 17: HCCL link / NIC / socket / ranktable / transport init / peer-refused fault (strictly separated from Rule 3 execution wait!)
  const r17AllLines = collectAllMatchingLines(lines, (line) => {
    const owner = lineOwnerMap.get(line.lineNumber);
    if (owner && owner !== "hccl-link-or-ifname-fault") return false;
    return isHcclLinkOrIfnameLine(line, ctx);
  });
  if (r17AllLines.length > 0) {
    for (const l of r17AllLines) allMatchedLineNumbers.add(l.lineNumber);
    const r17SignalByLine = new Map<number, ClassifiedSignal>();
    for (const sig of signals) {
      if (!r17SignalByLine.has(sig.lineNumber)) r17SignalByLine.set(sig.lineNumber, sig);
    }
    const r17Unmerged = r17AllLines.filter((l) => !ctx.mergedLinkEstContLines.has(l.lineNumber));
    const r17Active = r17Unmerged.length > 0 ? r17Unmerged : r17AllLines;
    const concretePrimaryLines = r17AllLines
      .filter((m) => isHcclLinkPrimaryLine(m, ctx))
      .sort((a, b) => {
        if (winnerSignal) {
          if (a.lineNumber === winnerSignal.lineNumber) return -1;
          if (b.lineNumber === winnerSignal.lineNumber) return 1;
        }
        const sa = r17SignalByLine.get(a.lineNumber);
        const sb = r17SignalByLine.get(b.lineNumber);
        if (sa && sb) return compareSignalsChronologically(sa, sb);
        return a.lineNumber - b.lineNumber;
      });
    const activeConcreteLines = concretePrimaryLines.filter(
      (l) => !ctx.mergedLinkEstContLines.has(l.lineNumber),
    );
    const r17Prioritized = [
      ...(activeConcreteLines.length > 0 ? activeConcreteLines : concretePrimaryLines),
      ...r17Active.filter((l) => !isHcclLinkPrimaryLine(l, ctx)),
    ];
    const r17Matches = r17Prioritized.slice(0, 4).map(toMatched);
    const refusedCascadeLines = r17AllLines.filter((m) => isPeerRefusedCascadeLine(m.inspectLine));
    const hasConcretePrimary = concretePrimaryLines.length > 0;
    const primarySubtypePool = concretePrimaryLines.length > 0 ? [concretePrimaryLines[0]!] : [];
    const isRoceDown = primarySubtypePool.some(
      (m) => ctx.hccnDownLines.has(m.lineNumber) || HCCL_ROCE_PORT_DOWN_RE.test(m.inspectLine),
    );
    const isRanktable = primarySubtypePool.some((m) => /\bEI0004\b/i.test(m.inspectLine));
    const isConnRefused =
      refusedCascadeLines.length > 0 && !isRoceDown && !isRanktable && concretePrimaryLines.length === 0;
    const isRouteFault = primarySubtypePool.some((m) =>
      /No route to host|ENETUNREACH|EHOSTUNREACH|Network is unreachable/i.test(m.inspectLine),
    );
    const isIbvPostSend = primarySubtypePool.some((m) =>
      /\bibv_post_send\s+failed\b|\bHostCpuRoceChannel\b/i.test(m.inspectLine),
    );
    const isRdmaFault = primarySubtypePool.some((m) => /\bRDMA\b/i.test(m.inspectLine));
    const isBindFault = primarySubtypePool.some((m) => isExplicitHcclBindFaultLine(m.inspectLine));
    const hasEj0001 = primarySubtypePool.some((m) => /\bEJ0001\b/i.test(m.inspectLine));
    const hasHcclUnavail = primarySubtypePool.some((m) =>
      /\bHCCL_E_UNAVAIL\b|\bHCCL\s+error:\s*7\b/i.test(m.inspectLine),
    );
    const hasHcclInternal = primarySubtypePool.some((m) =>
      /\bHCCL_E_INTERNAL\b|\bHCCL\s+error:\s*4\b/i.test(m.inspectLine),
    );
    const isTransportInit =
      hasEj0001 ||
      hasHcclUnavail ||
      hasHcclInternal ||
      primarySubtypePool.some((m) => /\bEI0009\b/i.test(m.inspectLine));

    const winningR17Lines = r17Prioritized.filter((l) =>
      isRoceDown
        ? ctx.hccnDownLines.has(l.lineNumber) || HCCL_ROCE_PORT_DOWN_RE.test(l.inspectLine)
        : isRanktable
          ? /\bEI0004\b/i.test(l.inspectLine)
          : isRouteFault
            ? /No route to host|ENETUNREACH|EHOSTUNREACH|Network is unreachable/i.test(l.inspectLine)
            : isIbvPostSend
              ? /\bibv_post_send\s+failed\b|\bHostCpuRoceChannel\b/i.test(l.inspectLine)
              : isRdmaFault
                ? /\bRDMA\b/i.test(l.inspectLine)
                : isBindFault
                  ? isHcclLinkPrimaryLine(l, ctx) && isExplicitHcclBindFaultLine(l.inspectLine)
                  : hasEj0001
                    ? /\bEJ0001\b/i.test(l.inspectLine)
                    : hasHcclUnavail
                      ? /\bHCCL_E_UNAVAIL\b|\bHCCL\s+error:\s*7\b/i.test(l.inspectLine)
                      : hasHcclInternal
                        ? /\bHCCL_E_INTERNAL\b|\bHCCL\s+error:\s*4\b/i.test(l.inspectLine)
                        : isTransportInit
                          ? /\bEI0009\b/i.test(l.inspectLine)
                          : isConnRefused
                            ? isPeerRefusedCascadeLine(l.inspectLine)
                            : true,
    );
    const endpointPool = winningR17Lines.length > 0 ? winningR17Lines : r17Prioritized;
    let ifaceMatch: string | null = null;
    let portMatch: string | null = null;
    let devMatch: string | null = null;
    const endpointAnchor = endpointPool[0];
    if (endpointAnchor) {
      ifaceMatch = extractIfaceFromLine(endpointAnchor.inspectLine);
      portMatch = extractPortFromLine(endpointAnchor.inspectLine);
      devMatch = portMatch === null ? (ctx.hccnDeviceByLine.get(endpointAnchor.lineNumber) ?? null) : null;
      if (!ifaceMatch || (!portMatch && !devMatch)) {
        for (let k = 1; k < endpointPool.length; k += 1) {
          const other = endpointPool[k]!;
          if (
            !areCausalDomainsCompatible(endpointAnchor, other) ||
            (endpointAnchor.pid !== null && other.pid !== null && other.pid !== endpointAnchor.pid) ||
            (endpointAnchor.rank !== null &&
              other.rank !== endpointAnchor.rank &&
              !(endpointAnchor.pid !== null && other.pid === endpointAnchor.pid && other.rank === null)) ||
            (endpointAnchor.rank === null && other.rank !== null)
          ) {
            continue;
          }
          ifaceMatch ??= extractIfaceFromLine(other.inspectLine);
          if (!portMatch) {
            portMatch = extractPortFromLine(other.inspectLine);
          }
          devMatch ??= portMatch === null ? (ctx.hccnDeviceByLine.get(other.lineNumber) ?? null) : null;
          if (ifaceMatch && (portMatch || devMatch)) break;
        }
      }
    }
    const locParts: string[] = [];
    if (ifaceMatch) locParts.push(`接口 ${ifaceMatch}`);
    if (portMatch) locParts.push(`端口 ${portMatch}`);
    else if (devMatch) locParts.push(`设备 ${devMatch}`);
    const locationBadge = locParts.length > 0 ? `（${locParts.join(" / ")}）` : "";

    // Extract concrete host NIC inventory & misconfiguration tokens when present in log (strictly same host & instance/group scope)
    const nicInventories: RuleNicInventoryEntry[] = [];
    for (const l of lines) {
      if (l.isPromLine || l.trimmed.startsWith("#") || isPromExpositionLine(l.trimmed)) continue;
      const inv =
        /Host NIC inventory:\s*([A-Za-z0-9_.:-]+)\s+UP\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|\[REDACTED_IP(?:_\d+)?\]|<REDACTED_IP(?:_\d+)?>|<IP#\d+>)(?:\/\d+)?(?:\s*\(([A-Za-z0-9_.:-]+):\s*not\s+found\))?/i.exec(
          l.inspectLine,
        );
      if (inv?.[1] && inv[2]) {
        nicInventories.push({
          line: l,
          host: l.hostTag,
          iface: inv[1],
          ip: inv[2],
          missingNic: inv[3] ?? null,
        });
      }
    }
    const anchorInv = selectBestScopedNicInventory(nicInventories, endpointAnchor);
    const anchorBindLines = r17AllLines.filter(
      (m) =>
        isExplicitHcclBindFaultLine(m.inspectLine) &&
        (endpointAnchor === undefined || matchesRuleInventoryScope(m, endpointAnchor)),
    );
    const r17ScopedText = (
      anchorBindLines.length > 0
        ? anchorBindLines
        : endpointPool.filter(
            (m) => endpointAnchor === undefined || matchesRuleInventoryScope(m, endpointAnchor),
          )
    )
      .map((m) => m.inspectLine)
      .join(" ");
    const badIfIp =
      /\bHCCL_IF_IP\s*=\s*([0-9.]+|\[REDACTED_IP(?:_\d+)?\]|<REDACTED_IP(?:_\d+)?>|<IP#\d+>)/i.exec(
        r17ScopedText,
      )?.[1];
    const badIfname =
      /\b(?:HCCL_SOCKET_IFNAME|GLOO_SOCKET_IFNAME)\s*=\s*([A-Za-z0-9_.:-]+)\b[^\r\n]{0,64}\bmissing\b|\bmissing\s+NIC\s+([A-Za-z0-9_.:-]+)\b/i.exec(
        r17ScopedText,
      );
    const badIfnameVal = badIfname?.[1] ?? badIfname?.[2] ?? null;
    const distinctBadIp = badIfIp && anchorInv && badIfIp !== anchorInv.ip ? badIfIp : null;
    const distinctBadNic =
      badIfnameVal && anchorInv && badIfnameVal !== anchorInv.iface ? badIfnameVal : null;
    const isCollapsedRedactedIp = Boolean(
      badIfIp && anchorInv && badIfIp === anchorInv.ip && /REDACTED|<IP#/i.test(badIfIp),
    );
    const mc2BuffAllCompatible = lines.filter(
      (l) =>
        !l.isPromLine &&
        !l.trimmed.startsWith("#") &&
        !isPromExpositionLine(l.trimmed) &&
        isMoeMc2OrModelSlimLine(l.inspectLine, l.tracebackGroupId, ctx) &&
        /HCCL_BUFFSIZE is too SMALL/i.test(l.inspectLine) &&
        (!endpointAnchor ||
          (l.segmentId === endpointAnchor.segmentId &&
            areScopeTagsCompatible(l.instanceTag, endpointAnchor.instanceTag) &&
            areScopeTagsCompatible(l.groupTag, endpointAnchor.groupTag) &&
            !hasStartupBoundaryBetween(ctx.startupBoundaryBucket, endpointAnchor, l, false))),
    );
    const matchesExplicitAnchorTags = (l: ParsedLogLine, anchor: ParsedLogLine): boolean => {
      if (!areCausalDomainsCompatible(l, anchor)) return false;
      if (anchor.hostTag !== null && l.hostTag === null) return false;
      if (anchor.instanceTag !== null && l.instanceTag === null) return false;
      if (anchor.groupTag !== null && l.groupTag === null) return false;
      return true;
    };
    const mc2ExactDomain = endpointAnchor
      ? mc2BuffAllCompatible.filter((l) => matchesExplicitAnchorTags(l, endpointAnchor))
      : [];
    const mc2CompatDomain =
      mc2ExactDomain.length > 0
        ? mc2ExactDomain
        : endpointAnchor
          ? mc2BuffAllCompatible.filter((l) => areCausalDomainsCompatible(l, endpointAnchor))
          : mc2BuffAllCompatible;
    const mc2PoolRaw = mc2CompatDomain.length > 0 ? mc2CompatDomain : mc2BuffAllCompatible;
    const mc2CandidatePool = sortRuleLinesByVerdictPriority(mc2PoolRaw);
    if (mc2CandidatePool.length > 1) {
      mc2CandidatePool.sort((a, b) => {
        const aExact = primaryVerdictLineNo !== null && a.lineNumber === primaryVerdictLineNo ? 0 : 1;
        const bExact = primaryVerdictLineNo !== null && b.lineNumber === primaryVerdictLineNo ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        const aVerdictDom =
          winnerSignal !== null &&
          winnerSignal.rank !== null &&
          a.rank === winnerSignal.rank &&
          areCausalDomainsCompatible(winnerSignal, a)
            ? 0
            : 1;
        const bVerdictDom =
          winnerSignal !== null &&
          winnerSignal.rank !== null &&
          b.rank === winnerSignal.rank &&
          areCausalDomainsCompatible(winnerSignal, b)
            ? 0
            : 1;
        if (aVerdictDom !== bVerdictDom) return aVerdictDom - bVerdictDom;
        const aTier = getClockTier(a);
        const bTier = getClockTier(b);
        if (aTier !== bTier) return aTier - bTier;
        if (a.timestampMs !== null && b.timestampMs !== null && areTimestampsComparable(a, b)) {
          const tsCmp = compareTimestampOrder(a, b);
          if (tsCmp !== 0) return tsCmp;
        }
        const aDom = `${(a.hostTag ?? "").toLowerCase()}|${(a.instanceTag ?? "").toLowerCase()}|${(a.groupTag ?? "").toLowerCase()}`;
        const bDom = `${(b.hostTag ?? "").toLowerCase()}|${(b.instanceTag ?? "").toLowerCase()}|${(b.groupTag ?? "").toLowerCase()}`;
        if (aDom !== bDom) {
          if ((a.hostTag === null) !== (b.hostTag === null)) return a.hostTag !== null ? -1 : 1;
          return aDom < bDom ? -1 : 1;
        }
        const rankCmp = (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER);
        if (rankCmp !== 0) return rankCmp;
        return a.lineNumber - b.lineNumber;
      });
    }
    const mc2BuffAnchor = mc2CandidatePool[0];
    const mc2BuffBaseLines = (() => {
      if (!mc2BuffAnchor) return mc2BuffAllCompatible;
      const effDomain: { hostTag: string | null; instanceTag: string | null; groupTag: string | null } = {
        hostTag: mc2BuffAnchor.hostTag,
        instanceTag: mc2BuffAnchor.instanceTag,
        groupTag: mc2BuffAnchor.groupTag,
      };
      let effPid: number | null = mc2BuffAnchor.pid;
      const scoped: ParsedLogLine[] = [];
      for (const l of mc2CandidatePool) {
        if (!areCausalDomainsCompatible(l, mc2BuffAnchor) || !areCausalDomainsCompatible(l, effDomain)) {
          continue;
        }
        if (
          (mc2BuffAnchor.pid !== null && l.pid !== null && mc2BuffAnchor.pid !== l.pid) ||
          (effPid !== null && l.pid !== null && effPid !== l.pid)
        ) {
          continue;
        }
        if (effDomain.hostTag === null && l.hostTag !== null) effDomain.hostTag = l.hostTag;
        if (effDomain.instanceTag === null && l.instanceTag !== null) effDomain.instanceTag = l.instanceTag;
        if (effDomain.groupTag === null && l.groupTag !== null) effDomain.groupTag = l.groupTag;
        if (effPid === null && l.pid !== null) effPid = l.pid;
        scoped.push(l);
      }
      return scoped;
    })();
    const mc2BuffSmallLines = collectScopedBuffSizeLines(mc2BuffBaseLines, endpointAnchor);
    const r17BuffRec =
      mc2BuffSmallLines.length > 0 ? computeHcclBuffSizeRecommendation(mc2BuffSmallLines) : null;
    const tailoredStep =
      anchorInv && (distinctBadIp || isCollapsedRedactedIp || distinctBadNic)
        ? `日志已核实${anchorInv.host ? ` ${anchorInv.host}` : "本机"}活跃业务网卡为 ${anchorInv.iface}（IP ${anchorInv.ip}${anchorInv.missingNic ? `，${anchorInv.missingNic} 不存在` : ""}），无需再重新盲查网卡：1) ${
            distinctBadIp
              ? `将${anchorInv.host ? ` ${anchorInv.host} ` : " "}错误的 HCCL_IF_IP=${distinctBadIp} 修正为本机 ${anchorInv.ip}`
              : isCollapsedRedactedIp
                ? `核对并修正${anchorInv.host ? ` ${anchorInv.host} ` : " "}的 HCCL_IF_IP 使其匹配活跃网卡 ${anchorInv.iface} 本机真实 IP（日志经脱敏均显示为 ${anchorInv.ip}）`
                : `确保${anchorInv.host ? ` ${anchorInv.host} ` : " "}HCCL_IF_IP 指向活跃网卡 ${anchorInv.iface}（${anchorInv.ip}）`
          }${
            distinctBadNic
              ? `，并把失效的 HCCL_SOCKET_IFNAME / GLOO_SOCKET_IFNAME=${distinctBadNic} 改为活跃网卡 ${anchorInv.iface}`
              : ""
          }；2) 确保对端保持同构活跃网卡与本机 IP${r17BuffRec ? `，并在双端同步设置 HCCL_BUFFSIZE=${r17BuffRec.recommendedBuffMb}` : ""}。`
        : "1) 用 ip -br addr 与 hccn_tool -i <id> -ip -g / -link -g 逐机核对业务网卡、HCCP IP 与端口 UP 状态，确保 HCCL_SOCKET_IFNAME / GLOO_SOCKET_IFNAME 与 HCCL_IF_IP 指向同一活跃网卡；2) 若报 ECONNREFUSED 或仅见 EI0006 LinkEstablish 超时，先排查对端 Rank 是否已在建链前崩退并核对 ping/roce 与防火墙连通性。";

    findings.push({
      ruleId: "hccl-link-or-ifname-fault",
      title: isRoceDown
        ? `HCCL / RoCE 设备链路端口掉线（Link/Port Down）${locationBadge}`
        : isRanktable
          ? `HCCL 建组配置 / Ranktable 非法或校验失败（EI0004）${locationBadge}`
          : isIbvPostSend
            ? `HCCL RoCE / RDMA 发送通道失败（ibv_post_send / HostCpuRoceChannel）${locationBadge}`
            : isRdmaFault
              ? `HCCL RDMA 注册或通信传输建链失败${locationBadge}`
              : isRouteFault
                ? `HCCL RaSocket 建链路由不可达（No route to host / ENETUNREACH）${locationBadge}`
                : isBindFault
                  ? `HCCL 网卡或本机 IP 绑定失败（HCCL_SOCKET_IFNAME / EADDRNOTAVAIL）${locationBadge}`
                  : hasHcclUnavail
                    ? `HCCL 资源或通道不可用（HCCL_E_UNAVAIL / error 7）${locationBadge}`
                    : hasHcclInternal
                      ? `HCCL 内部通信故障（HCCL_E_INTERNAL / error 4）${locationBadge}`
                      : isTransportInit
                        ? hasEj0001
                          ? `HCCP 协议栈初始化或通信建链失败（EJ0001）${locationBadge}`
                          : `HCCL 传输初始化失败（EI0009）${locationBadge}`
                        : isConnRefused
                          ? `HCCL / 通信建链对端拒绝或重置连接（ECONNREFUSED / peer refused，次生线索）${locationBadge}`
                          : hasConcretePrimary
                            ? `HCCL 通信传输或 Socket 建链失败${locationBadge}`
                            : `HCCL Socket 建链握手超时（EI0006 LinkEstablish）：对端或建链原因待核${locationBadge}`,
      severity: "error",
      category: "distributed",
      evidenceLevel: hasConcretePrimary ? "C" : "I",
      summary: isConnRefused
        ? "HCCL / RaSocket / c10d 建立通信建链 Socket 时收到 ECONNREFUSED / Connection refused / reset（对端端口未监听或连接被重置）；常见于对端 Rank 先崩退出关闭监听端口，或 Ranktable / 主节点端口地址失配，不应直接视为本机首错。"
        : isIbvPostSend
          ? "HostCpuRoceChannel 调用 ibv_post_send 提交 RDMA 工作请求失败（常见于 WQE 队列耗尽、RoCE QP 状态异常或对端链路中断）。"
          : isRdmaFault
            ? "HCCL / RoCE 建链阶段 RDMA 内存注册或传输通道初始化失败（例如 RDMA register failed），请核查 RoCE 网卡 RDMA 状态、锁页内存（ulimit -l）与网络传输配置。"
            : isRouteFault
              ? "HCCL / RaSocket 建链阶段触发路由不可达（No route to host / ENETUNREACH / EHOSTUNREACH），属于跨机网段路由、交换机 VLAN 或 RoCE 网卡连通性阻断。"
              : isRanktable
                ? "EI0004 表明 HCCL Ranktable（hccl.json / device_ip / rank_id 拓扑定义）非法或校验不通过，导致通信域初始化直接失败。"
                : hasHcclUnavail
                  ? "HCCL 返回 HCCL_E_UNAVAIL（error 7），表明目标通信域资源、端口通道或设备会话当前不可用（多由对端建链未就绪、设备状态异常或通信资源耗尽引发）。"
                  : hasHcclInternal
                    ? "HCCL 返回 HCCL_E_INTERNAL（error 4），表明底层 HCCL 内部初始化或通信协议执行异常（需结合同 PID 的 CANN debug plog 确认具体子系统错误码）。"
                    : isTransportInit
                      ? hasEj0001
                        ? "EJ0001 表明底层 HCCP 协议栈初始化失败（HCCP init failed），请核查 NPU RoCE 网卡 IP 配置（hccn_tool）、设备状态与链路就绪情况。"
                        : "EI0009 表明 HCCL 传输通道初始化失败，需检查本机与对端 HCCP/RoCE 资源与网络隔离配置。"
                      : hasConcretePrimary
                        ? "HCCL 通信域初始化或建链阶段在网卡绑定、RoCE 端口或 Socket 握手处直接失败，属于真建链/网络根因（区别于算子执行期触发的 EI0002 Notify wait）。"
                        : "仅观测到 EI0006 Getting socket times out / [Wait][LinkEstablish] 通信域 Socket 建链等待超时；可能是真网络路由问题，也可能是对端 Rank 在完成建链前先崩退出导致的次生症状，需核对全部 Rank 前序日志、bind/route 与 hccn_tool 状态。",
      mechanism:
        "worker.py#L1283-L1288 以 backend='hccl' 调用 init_distributed_environment() 拉起主 PyTorch/HCCL 通信组（pyhccl.py#L56-L60 明确断言仅在非 HCCL 或 StatelessProcessGroup 下才额外经 hcclCommInitRank 挂载 PyHCCL）；底层统一由 HCCP / RaSocket 负责控制与数据面建链。HCCL_IF_IP 优先级高于 HCCL_SOCKET_IFNAME，任一端配错网卡名、跨机写错本机 IP、端口未监听、RoCE 端口 DOWN 或 Ranktable 非法都会直接阻断建链。",
      matchedLines: r17Matches,
      sources: [
        `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L1283-L1288`,
        `${VLLM_V030}:vllm/distributed/parallel_state.py#L1874-L1881`,
        `${VLLM_ASCEND_V030}:vllm_ascend/distributed/device_communicators/pyhccl.py#L56-L60`,
        `${VLLM_ASCEND_V030}:vllm_ascend/distributed/device_communicators/pyhccl_wrapper.py#L210-L227`,
      ],
      nextEvidenceCmd:
        "ip -br addr && env | grep -E 'HCCL_SOCKET_IFNAME|HCCL_IF_IP|GLOO_SOCKET_IFNAME' && for i in $(seq 0 7); do hccn_tool -i $i -link -g 2>/dev/null; done",
      experimentStep: tailoredStep,
      wikiPageIds: ["cann-hccl", "inference-troubleshooting", "ascend-env-and-serve"],
    });
  }

  // Rule 18: TorchAir / npugraph_ex / Dynamo fullgraph / Meta fake_impl / GE compile & host tiling fault
  const r18AllLines = sortRuleLinesByVerdictPriority(
    collectAllMatchingLines(lines, (line) => {
      const owner = lineOwnerMap.get(line.lineNumber);
      if (owner && owner !== "torchair-ge-graph-compile-fault") return false;
      return isTorchairGeCompileFaultLine(line.inspectLine);
    }),
  );
  const r18Matches = recordLines(r18AllLines);
  if (r18Matches.length > 0) {
    const joined = selectRuleHeadlineLines(r18AllLines)
      .map((m) => m.inspectLine)
      .join(" ");
    const isMetaMissing = /There was no fake impl registered for/i.test(joined);
    const isDynamoBreak = /BackendCompilerFailed|torch\._dynamo\.exc\.Unsupported|fullgraph=True/i.test(
      joined,
    );
    const isStaticKernelDep = /Static kernel generation requires\s+npugraph_ex/i.test(joined);
    const isStaticWorld =
      !isStaticKernelDep && /Static compilation requires|External DP static compilation/i.test(joined);
    const isScopeUnpaired = /\bERR03005\b|torch\.ops\.air\.scope_enter/i.test(joined);
    const isHostTiling = /coreNum is 0,\s*tiling failed|tiling\s+failed|CheckMlaAttrs/i.test(joined);
    const r18Sources = isStaticKernelDep
      ? [
          `${VLLM_ASCEND_V030}:vllm_ascend/ascend_config.py#L166-L169`,
          `${VLLM_ASCEND_V030}:vllm_ascend/platform.py#L1313-L1352`,
          `${VLLM_ASCEND_V030}:vllm_ascend/compilation/compiler_interface.py#L93-L100`,
        ]
      : [
          `${VLLM_V030}:vllm/compilation/wrapper.py#L148-L154`,
          `${VLLM_ASCEND_V030}:vllm_ascend/compilation/compiler_interface.py#L93-L100`,
          `${VLLM_ASCEND_V030}:vllm_ascend/compilation/compiler_interface.py#L233-L253`,
          `${VLLM_ASCEND_V030}:csrc/torch_binding_meta.cpp#L1792-L1816`,
          `${VLLM_ASCEND_V030}:csrc/attention/attn_res_fwd/op_host/attn_res_fwd_tiling.cpp#L195-L199`,
        ];
    findings.push({
      ruleId: "torchair-ge-graph-compile-fault",
      title: isMetaMissing
        ? "自定义算子缺少 Meta / FakeTensor 实现（There was no fake impl registered）：图编译追踪中断"
        : isScopeUnpaired
          ? "TorchAir 作用域配对异常（ERR03005）：scope_enter 与 scope_exit 未成对闭合"
          : isDynamoBreak
            ? "TorchDynamo fullgraph 图断或编译后端失败（BackendCompilerFailed / Unsupported）"
            : isStaticKernelDep
              ? "Static Kernel 前置依赖配置失败：缺少 enable_npugraph_ex=True（AssertionError）"
              : isStaticWorld
                ? "TorchAir / npugraph_ex 静态编译配置或 DP World Size 校验失败"
                : isHostTiling
                  ? "GE / 算子 Host Tiling 编译失败（coreNum=0 / CheckMlaAttrs / tiling failed）"
                  : "TorchAir / npugraph_ex / GE 图编译失败（EZ3002 / EZ3003 / E19999 / EZ9999 compile）",
      severity: "error",
      category: "graph",
      evidenceLevel: "C",
      summary: isMetaMissing
        ? "torch.compile(fullgraph=True) 在 FakeTensor 追踪阶段遇到未注册 Meta/_register_fake 的自定义算子，无法推导输出形状与步长。"
        : isScopeUnpaired
          ? "TorchAir 编译期检测到 torch.ops.air.scope_enter 与 scope_exit 未严格成对匹配（ERR03005），通常由条件分支图断、异常中断作用域或 FX pass 改写遗漏闭合调用所致。"
          : isStaticKernelDep
            ? "AscendCompilationConfig 初始化校验（_apply_unsupported_hardware_downgrade_and_static_kernel_check）抛出 AssertionError：开启 enable_static_kernel 前置要求 enable_npugraph_ex=True；显式传入 enable_npugraph_ex=false 与 enable_static_kernel=true 时即在配置校验期直接中断（尚未进入 TorchDynamo/GE 图编译；注意 platform.py 中 cudagraph_mode=PIECEWISE 会将 npugraph_ex / static_kernel / super_kernel 一并静默重置为 False，属于另一独立的重置行为）。"
            : isHostTiling
              ? "GE 编译或算子选择阶段在 Host Tiling 计算环节直接失败（如 coreNum=0 或属性校验 CheckMlaAttrs 不通过），非执行期 AI Core SMMU 访存越界。"
              : "模型在 TorchDynamo fullgraph 构图、npugraph_ex/TorchAir 后端 lowering 或 GE 图编译/算子选择（EZ3002/EZ3003）阶段中止。",
      mechanism: isStaticKernelDep
        ? "vllm_ascend/ascend_config.py#L166-L169 强校验静态核生成必须依赖 enable_npugraph_ex=True；同时 vllm_ascend/platform.py#L1313-L1352 的 _setup_compile_backend 在 NONE / PIECEWISE / FULL_AND_PIECEWISE 模式下会自动将 enable_npugraph_ex、enable_static_kernel 与 enable_super_kernel 静默重置为 False。"
        : "vLLM wrapper.py#L148-L154 以 fullgraph=True 触发编译，Ascend compiler_interface.py#L233-L253 路由至 npugraph_ex 或 torchair 后端并依赖 csrc/torch_binding_meta.cpp 注册 Meta 推导；任一环节缺 fake_impl、scope_enter 未闭合、图断、DP 拓扑不整除或 GE 算子/Tiling 校验失败均会在编译期终止。",
      matchedLines: r18Matches,
      sources: r18Sources,
      nextEvidenceCmd: isStaticKernelDep
        ? "grep -nE 'enable_npugraph_ex|enable_static_kernel|cudagraph_mode|AssertionError' vllm_serve.log"
        : "grep -nE 'BackendCompilerFailed|fake impl|Unsupported|EZ3002|EZ3003|ERR03005|tiling failed|npugraph_ex|torchair' vllm_serve.log",
      experimentStep: isStaticKernelDep
        ? '若需保留启用 Static Kernel，请删除误传的 "enable_npugraph_ex":false（或显式设 {"enable_npugraph_ex":true,"enable_static_kernel":true}），并将 cudagraph_mode 改为 "FULL_DECODE_ONLY"（或 "FULL"）以防被 PIECEWISE 静默清零；仅在不要求静态核时才用 --enforce-eager 做基线对照。'
        : '1) 先用 --enforce-eager 验证 Eager 基线是否可跑通，确认问题严格局限在构图/编译期；2) 关闭图编译扩展（--additional-config \'{"ascend_compilation_config":{"enable_npugraph_ex":false}}\'；若已启用 enable_static_kernel，需一并在 ascend_compilation_config 中设 enable_static_kernel:false）或补齐自定义算子 @register_fake / CANN OPP 配套后复测。',
      wikiPageIds: ["npugraph-ex", "acl-graph", "inference-troubleshooting"],
    });
  }

  // Rule 19: MoE MC2 dispatch/combine / HCCL_BUFFSIZE / hierarchy constraints & msModelSlim quantization config/shard faults
  const r19AllLines = sortRuleLinesByVerdictPriority(
    collectAllMatchingLines(lines, (line) => {
      const owner = lineOwnerMap.get(line.lineNumber);
      if (owner && owner !== "moe-mc2-or-modelslim-quant-fault") return false;
      return isMoeMc2OrModelSlimLine(line.inspectLine, line.tracebackGroupId, ctx);
    }),
  );
  if (r19AllLines.length > 0) {
    const headlineLines19 = selectRuleHeadlineLines(r19AllLines);
    const joined = headlineLines19.map((m) => m.inspectLine).join(" ");
    const hasMc2 = MOE_MC2_FAULT_RE.test(joined);
    const hasModelSlim =
      MODELSLIM_QUANT_FAULT_RE.test(joined) ||
      headlineLines19.some(
        (m) =>
          m.tracebackGroupId !== null &&
          ctx.modelslimJsonTbGroups.has(m.tracebackGroupId) &&
          /\bJSONDecodeError\b/i.test(m.inspectLine),
      );
    const isBuffsizeTooSmall = /HCCL_BUFFSIZE is too SMALL/i.test(joined);
    const hasDispatchFfnCombine = /\b(?:DispatchFFNCombine|dispatch_ffn_combine)\b/i.test(joined);
    const hasMoeDistribute =
      /\b(?:npu_moe_distribute_(?:dispatch|combine)(?:_v2)?|MoeDistribute(?:Dispatch|Combine)(?:V2)?)\b/i.test(
        joined,
      );
    const r19Anchor = headlineLines19[0] ?? r19AllLines[0];
    const r19BuffBaseLines = (() => {
      const effDomain: { hostTag: string | null; instanceTag: string | null; groupTag: string | null } = {
        hostTag: r19Anchor?.hostTag ?? null,
        instanceTag: r19Anchor?.instanceTag ?? null,
        groupTag: r19Anchor?.groupTag ?? null,
      };
      let effPid: number | null = r19Anchor?.pid ?? null;
      for (const h of headlineLines19) {
        if (effDomain.hostTag === null && h.hostTag !== null) effDomain.hostTag = h.hostTag;
        if (effDomain.instanceTag === null && h.instanceTag !== null) effDomain.instanceTag = h.instanceTag;
        if (effDomain.groupTag === null && h.groupTag !== null) effDomain.groupTag = h.groupTag;
        if (effPid === null && h.pid !== null) effPid = h.pid;
      }
      const out: ParsedLogLine[] = [];
      for (const l of r19AllLines) {
        if (!/HCCL_BUFFSIZE is too SMALL/i.test(l.inspectLine)) continue;
        if (r19Anchor) {
          if (
            l.segmentId !== r19Anchor.segmentId ||
            !areCausalDomainsCompatible(l, r19Anchor) ||
            !areCausalDomainsCompatible(l, effDomain) ||
            (r19Anchor.pid !== null && l.pid !== null && r19Anchor.pid !== l.pid) ||
            (effPid !== null && l.pid !== null && effPid !== l.pid) ||
            hasStartupBoundaryBetween(ctx.startupBoundaryBucket, r19Anchor, l, false)
          ) {
            continue;
          }
        } else if (
          !areCausalDomainsCompatible(l, effDomain) ||
          (effPid !== null && l.pid !== null && effPid !== l.pid)
        ) {
          continue;
        }
        if (effDomain.hostTag === null && l.hostTag !== null) effDomain.hostTag = l.hostTag;
        if (effDomain.instanceTag === null && l.instanceTag !== null) effDomain.instanceTag = l.instanceTag;
        if (effDomain.groupTag === null && l.groupTag !== null) effDomain.groupTag = l.groupTag;
        if (effPid === null && l.pid !== null) effPid = l.pid;
        out.push(l);
      }
      return out;
    })();
    const r19BuffLines = collectScopedBuffSizeLines(r19BuffBaseLines, r19Anchor);
    const r19AllSet = new Set(r19AllLines.map((l) => l.lineNumber));
    const extraR19BuffLines = r19BuffLines.filter((bl) => !r19AllSet.has(bl.lineNumber));
    const r19EvidencePool =
      extraR19BuffLines.length > 0
        ? [
            ...r19AllLines.slice(0, Math.max(1, 4 - extraR19BuffLines.length)),
            ...extraR19BuffLines,
            ...r19AllLines.slice(Math.max(1, 4 - extraR19BuffLines.length)),
          ]
        : r19AllLines;
    const r19Matches = recordLines(r19EvidencePool);
    for (const bl of r19BuffLines) allMatchedLineNumbers.add(bl.lineNumber);
    const { loggedMinBuff, loggedMinOp, loggedCurBuff, recommendedBuffMb, higherTierMb } =
      computeHcclBuffSizeRecommendation(r19BuffLines.length > 0 ? r19BuffLines : joined);
    const pdHostPair =
      lines.some((l) => !l.isPromLine && l.hostTag?.toLowerCase() === "node-p") &&
      lines.some((l) => !l.isPromLine && l.hostTag?.toLowerCase() === "node-d");
    let r19PeerNicFixHint = "";
    if (hasMc2 && isBuffsizeTooSmall) {
      const bindLines = lines.filter(
        (l) =>
          !l.isPromLine &&
          !l.trimmed.startsWith("#") &&
          !isPromExpositionLine(l.trimmed) &&
          isHcclLinkPrimaryLine(l, ctx) &&
          isExplicitHcclBindFaultLine(l.inspectLine),
      );
      const compatibleBinds = bindLines.filter(
        (l) =>
          areScopeTagsCompatible(l.instanceTag, r19Anchor?.instanceTag ?? null) &&
          areScopeTagsCompatible(l.groupTag, r19Anchor?.groupTag ?? null),
      );
      let bestBindScore = -1;
      let bindLine: ParsedLogLine | undefined;
      for (const l of compatibleBinds) {
        const sc =
          (r19Anchor?.instanceTag && l.instanceTag?.toLowerCase() === r19Anchor.instanceTag.toLowerCase()
            ? 2
            : 0) +
          (r19Anchor?.groupTag && l.groupTag?.toLowerCase() === r19Anchor.groupTag.toLowerCase() ? 1 : 0);
        if (sc > bestBindScore) {
          bestBindScore = sc;
          bindLine = l;
        }
      }
      if (bindLine) {
        const r19NicInventories: RuleNicInventoryEntry[] = [];
        for (const l of lines) {
          if (l.isPromLine || l.trimmed.startsWith("#") || isPromExpositionLine(l.trimmed)) continue;
          const inv =
            /Host NIC inventory:\s*([A-Za-z0-9_.:-]+)\s+UP\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+|\[REDACTED_IP(?:_\d+)?\]|<REDACTED_IP(?:_\d+)?>|<IP#\d+>)(?:\/\d+)?(?:\s*\(([A-Za-z0-9_.:-]+):\s*not\s+found\))?/i.exec(
              l.inspectLine,
            );
          if (inv?.[1] && inv[2]) {
            r19NicInventories.push({
              line: l,
              host: l.hostTag,
              iface: inv[1],
              ip: inv[2],
              missingNic: inv[3] ?? null,
            });
          }
        }
        const scopedBindTarget: Pick<ParsedLogLine, "hostTag" | "instanceTag" | "groupTag"> = {
          hostTag: bindLine.hostTag ?? r19Anchor?.hostTag ?? null,
          instanceTag: bindLine.instanceTag ?? r19Anchor?.instanceTag ?? null,
          groupTag: bindLine.groupTag ?? r19Anchor?.groupTag ?? null,
        };
        const matchedInv = selectBestScopedNicInventory(r19NicInventories, scopedBindTarget);
        const badIp =
          /\bHCCL_IF_IP\s*=\s*([0-9.]+|\[REDACTED_IP(?:_\d+)?\]|<REDACTED_IP(?:_\d+)?>|<IP#\d+>)/i.exec(
            bindLine.inspectLine,
          )?.[1];
        const badNic = /\b(?:HCCL_SOCKET_IFNAME|GLOO_SOCKET_IFNAME)\s*=\s*([A-Za-z0-9_.:-]+)/i.exec(
          bindLine.inspectLine,
        )?.[1];
        if (matchedInv) {
          const activeIface = matchedInv.iface;
          const activeIp = matchedInv.ip;
          const distinctBadIp = badIp && badIp !== activeIp ? badIp : null;
          const collapsedRedacted = Boolean(badIp && badIp === activeIp && /REDACTED|<IP#/i.test(badIp));
          const distinctBadNic = badNic && badNic !== activeIface ? badNic : null;
          const hLabel = bindLine.hostTag ? `${bindLine.hostTag} ` : "";
          const badIpPart = distinctBadIp
            ? `，勿填错为 ${distinctBadIp}`
            : collapsedRedacted
              ? "，需核对为本机真实 IP（日志经脱敏均显示同一占位符）"
              : "";
          const badNicPart = distinctBadNic ? `，勿用缺失网卡 ${distinctBadNic}` : "";
          r19PeerNicFixHint = ` 同时注意对端 ${hLabel}存在并发选网/绑卡报错（日志已直接确认活跃网卡为 ${activeIface} / 本机 IP ${activeIp}${badIpPart}${badNicPart}），无需重探网卡直接按清单改对即可。`;
        }
      }
    }
    const sources: string[] = [];
    if (hasMc2) {
      sources.push(
        `${VLLM_ASCEND_V030}:vllm_ascend/distributed/parallel_state.py#L219-L221`,
        `${VLLM_ASCEND_V030}:vllm_ascend/ops/fused_moe/token_dispatcher.py#L164-L233`,
        `${VLLM_ASCEND_V030}:vllm_ascend/ops/fused_moe/token_dispatcher.py#L327-L333`,
        `${VLLM_ASCEND_V030}:vllm_ascend/ascend_config.py#L984-L1010`,
      );
      if (hasDispatchFfnCombine || !hasMoeDistribute) {
        sources.push(
          `${VLLM_ASCEND_V030}:vllm_ascend/ops/fused_moe/moe_comm_method.py#L590-L609`,
          `${VLLM_ASCEND_V030}:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L288-L294`,
        );
      }
    }
    if (hasModelSlim) {
      sources.push(
        `${VLLM_ASCEND_V030}:vllm_ascend/quantization/configs/modelslim_config.py#L298-L355`,
        `${VLLM_ASCEND_V030}:vllm_ascend/quantization/configs/modelslim_config.py#L910-L945`,
        `${VLLM_V030}:vllm/config/model.py#L1328-L1337`,
      );
    }
    const minRelationPrefix = loggedMinOp === ">" ? ">" : "";
    const minDescPrefix = loggedMinOp === ">" ? "要求大于" : "算得至少需";
    const loggedThresholdClause = loggedMinBuff
      ? `（日志实算门槛为 ${minRelationPrefix}${loggedMinBuff}，当前${loggedCurBuff ? `仅 ${loggedCurBuff}` : "配置低于该门槛"}）`
      : loggedCurBuff
        ? `（当前仅 ${loggedCurBuff}，低于本批算子最低门槛）`
        : "";
    const thresholdDetailParts: string[] = [];
    if (loggedMinBuff) thresholdDetailParts.push(`本步日志${minDescPrefix} ${loggedMinBuff}`);
    if (loggedCurBuff) thresholdDetailParts.push(`当前 ${loggedCurBuff} 不足`);
    const thresholdDetail = thresholdDetailParts.length > 0 ? `（${thresholdDetailParts.join("，")}）` : "";
    const buffsizeSummary = hasDispatchFfnCombine
      ? `DispatchFFNCombine 融合算子在 Host Tiling 校验中发现 HCCL_BUFFSIZE 通信窗口低于本批算子最低门槛${loggedThresholdClause}：第 289 行实际按 M × topK × K × sizeof(int8_t) × 3 + 10 MiB 校验（报错日志字符串第 292 行误写为 * 3 + 3MB），且单步算子门槛仅为下限而非推荐部署预算。`
      : hasMoeDistribute
        ? `MoeDistribute（Dispatch/Combine）MC2 算子在 Host Tiling 校验中发现 HCCL_BUFFSIZE 通信窗口不足${loggedThresholdClause}；所需窗口大小取决于 EP 通信域规模（world size）、专家布局（expert layout）、当前通信算法与单步 batch/token 规模，需按日志最低门槛留足部署预算。`
        : `MC2 / HCCL 通信路径检测到 HCCL_BUFFSIZE 通信窗口不足${loggedThresholdClause}；所需窗口大小取决于 EP 通信域规模、专家布局与当前通信算法，需高于算子最低需求并按部署预算扩容。`;
    const mc2Step = isBuffsizeTooSmall
      ? pdHostPair || r19PeerNicFixHint
        ? `明确区分算子最低阈值${thresholdDetail}与部署预算：请在 P/D 双端统一设置 export HCCL_BUFFSIZE=${recommendedBuffMb}（双端保持一致为 ${recommendedBuffMb}）。${r19PeerNicFixHint}`
        : `若为 HCCL_BUFFSIZE is too SMALL，需区分算子单步最低下限${thresholdDetail}与标准部署预算，建议统一设为 export HCCL_BUFFSIZE=${recommendedBuffMb}（高并发超大 EP 域可按需调高至 ${higherTierMb}）。`
      : `若为 HCCL_BUFFSIZE is too SMALL，区分算子最低阈值与部署预算（推荐双端设 export HCCL_BUFFSIZE=${recommendedBuffMb}）；若为 hierarchy 与 fused_mc2 冲突，设 enable_fused_mc2=0 或关闭 hierarchy；若缺 _MC2/expert_map，核对 --enable-expert-parallel。`;
    findings.push({
      ruleId: "moe-mc2-or-modelslim-quant-fault",
      title:
        hasMc2 && hasModelSlim
          ? "MoE MC2 算子/通信域约束与 msModelSlim 量化配置双异常"
          : hasMc2
            ? isBuffsizeTooSmall
              ? "MoE MC2 算子通信窗口不足（HCCL_BUFFSIZE is too SMALL）"
              : "MoE MC2 通信域 / 专家映射 / 拓扑约束冲突"
            : /\bJSONDecodeError\b/i.test(joined)
              ? "msModelSlim 量化描述文件 JSON 解析失败（quant_model_description.json 损坏或截断）"
              : "msModelSlim 量化描述文件缺失或分片/量化方法不匹配",
      severity: "error",
      category: hasMc2 ? "distributed" : "compatibility",
      evidenceLevel: "C",
      summary:
        hasMc2 && !hasModelSlim
          ? isBuffsizeTooSmall
            ? buffsizeSummary
            : "MoE MC2 调度路径触发硬约束报错：mc2 group 未初始化、缺少 expert_map、hierarchy 超过 512 专家、与 fused_mc2 互斥，或 worldSize 超出算子上限。"
          : hasModelSlim && !hasMc2
            ? /\bJSONDecodeError\b/i.test(joined)
              ? "modelslim_config.py 解析权重目录量化描述 JSON 文件时抛出 JSONDecodeError，说明 quant_model_description.json 内容为空、被截断或格式损坏。"
              : "启用 --quantization ascend 后未在权重目录找到 quant_model_description.json，或同一层各分片 quant_type 不一致、层类型不受支持 / 与模型 config.json 量化方法冲突。"
            : "日志同时命中 MoE MC2 通信域/窗口异常与 msModelSlim 量化配置异常，需按所属 Rank / 实例分别排查。",
      mechanism:
        hasMc2 && !hasModelSlim
          ? "vllm_ascend/ops/fused_moe/moe_comm_method.py#L590-L609（第 591 行）调用 torch.ops._C_ascend.dispatch_ffn_combine，而 token_dispatcher.py#L164-L233（第 232 行）与 #L327-L333（第 331 行）分别调用 npu_moe_distribute_dispatch_v2 / npu_moe_distribute_combine_v2；三者强依赖 _MC2 通信组、expert_map 与充足的 HCCL_BUFFSIZE 共享窗口，ascend_config.py#L984-L1010 在配置期拦截 hierarchy 512 专家与 fused_mc2 互斥。"
          : "AscendModelSlimConfig (modelslim_config.py#L910-L945) 强依赖目录中的 quant_model_description.json，并在 #L298-L355 逐层校验 packed shard 量化类型一致性与支持矩阵。",
      matchedLines: r19Matches,
      sources,
      nextEvidenceCmd: hasMc2
        ? "env | grep -E 'HCCL_BUFFSIZE|ASCEND_RT_VISIBLE_DEVICES' && grep -nE 'mc2|DispatchFFNCombine|MoeDistribute|HCCL_BUFFSIZE' vllm_serve.log"
        : "ls -la <model_dir>/*quant*.json && grep -nE 'ModelSlim|quant_model_description|quant_type' vllm_serve.log",
      experimentStep: hasMc2
        ? mc2Step
        : "确认权重目录含完整未损坏的 quant_model_description.json 且分片量化类型一致；若为原版 FP16/BF16 权重，移除 --quantization ascend。",
      wikiPageIds:
        hasMc2 && hasModelSlim
          ? ["moe-comm-dispatch", "hccl-buffer", "quantization", "expert-parallel", "ascend-model-onboarding"]
          : hasMc2
            ? ["moe-comm-dispatch", "hccl-buffer", "expert-parallel", "moe"]
            : ["quantization", "quantization-methods", "ascend-model-onboarding"],
    });
  }

  // Rule 20: CANN HAL / ATB / driver / /dev/davinci* / device init / 107005 / AdxDataDumpServer & EL0004 runtime alloc
  const r20AllLines = sortRuleLinesByVerdictPriority(
    collectAllMatchingLines(lines, (line) => {
      const owner = lineOwnerMap.get(line.lineNumber);
      if (owner && owner !== "cann-driver-or-device-env-fault") return false;
      return isCannDriverOrDeviceEnvLine(line, ctx);
    }),
  );
  const r20Matches = recordLines(r20AllLines);
  if (r20Matches.length > 0) {
    const joined = selectRuleHeadlineLines(r20AllLines)
      .map((m) => m.inspectLine)
      .join(" ");
    const sanitizedCodes = stripLogIdFieldsForErrorCodes(joined);
    const hasDevMount = /\/dev\/davinci/i.test(joined);
    const hasAtb = /\b(?:lib)?atb\.so/i.test(joined);
    const hasHal = /\b(?:lib)?ascend_hal\.so/i.test(joined);
    const hasRankBounds =
      /DP adjusted local rank|local_world_size|\bworld_size\s*\(\d+\)\s*is\s+larger\s+than\s+visible\s+NPU\s+count\b/i.test(
        joined,
      );
    const hasMissingWeights = /\bCannot find any model weights\b/i.test(joined);
    const hasEl0004 = /\bEL0004\b/i.test(joined);
    const hasStreamModel107005 = /\b(?:107005|RT_ERROR_STREAM_MODEL)\b/i.test(sanitizedCodes);
    const hasAdxDumpFail = /AdxDataDumpServer/i.test(joined);
    const hasContextNull =
      /\b107002\b|ACL_ERROR_RT_CONTEXT_NULL|\bEE1001\b[^\r\n]{0,160}\b(?:context\s+pointer\s+null|null\s+context)/i.test(
        sanitizedCodes,
      );
    const hasSocVersionFail = /\b507008\b|ACL_ERROR_RT_SOC_VERSION/i.test(sanitizedCodes);
    const hasHalOrDriverCall =
      /\b(?:drvGetDevInfo|aclrtSetDevice|rtSetDevice|aclrtGetPhyDevIdByUserDevId)\b/i.test(joined);
    const isPureEl0004 =
      hasEl0004 &&
      !hasDevMount &&
      !hasHal &&
      !hasAtb &&
      !hasRankBounds &&
      !hasMissingWeights &&
      !hasContextNull &&
      !hasSocVersionFail &&
      !hasStreamModel107005 &&
      !hasAdxDumpFail &&
      !hasHalOrDriverCall;
    const isPureMissingWeights =
      hasMissingWeights &&
      !hasDevMount &&
      !hasHal &&
      !hasAtb &&
      !hasRankBounds &&
      !hasEl0004 &&
      !hasContextNull &&
      !hasSocVersionFail &&
      !hasStreamModel107005 &&
      !hasAdxDumpFail &&
      !hasHalOrDriverCall;

    const subcauses: Array<{ tag: string; detail: string }> = [];
    if (hasDevMount) {
      subcauses.push({
        tag: "/dev/davinci* 设备节点缺失/无权限",
        detail: "容器缺少 /dev/davinci* 设备节点或无访问权限",
      });
    }
    if (hasAtb) {
      subcauses.push({
        tag: "libatb.so 缺失或环境未 source",
        detail: "Ascend Transformer Boost (ATB / NNAL) 运行库 libatb.so 缺失或未加载 set_env.sh",
      });
    }
    if (hasHal) {
      subcauses.push({
        tag: "libascend_hal.so 缺失/不匹配",
        detail: "CANN 驱动共享库 libascend_hal.so 缺失或符号版本不匹配",
      });
    }
    if (hasRankBounds) {
      subcauses.push({
        tag: "可见 NPU 数不足",
        detail:
          "worker.py init_device() / parallel_state 检查发现 world_size 或 local_rank 超出可见 NPU 设备数",
      });
    }
    if (hasMissingWeights) {
      subcauses.push({
        tag: "模型权重文件缺失 (Cannot find any model weights)",
        detail: "指定模型路径下未检测到可用的 safetensors / bin 模型权重分片文件",
      });
    }
    if (hasEl0004) {
      subcauses.push({
        tag: "EL0004 运行时内存/资源分配失败",
        detail:
          "EL0004（Failed to allocate memory）指向 Runtime 层内存/资源分配失败（不等同容器设备缺失，需核查内存与资源配额）",
      });
    }
    if (hasStreamModel107005) {
      subcauses.push({
        tag: "107005 流模型错误 (RT_ERROR_STREAM_MODEL)",
        detail: "107005（RT_ERROR_STREAM_MODEL）表明 Runtime 流/模型句柄绑定失败",
      });
    }
    if (hasAdxDumpFail) {
      subcauses.push({
        tag: "AdxDataDumpServer 数据转储服务初始化失败",
        detail: "CANN AdxDataDumpServer 启动/目录权限异常导致 dump server 初始化失败",
      });
    }
    if (hasContextNull) {
      subcauses.push({
        tag: "107002 / EE1001 空上下文 (ACL_ERROR_RT_CONTEXT_NULL)",
        detail: "107002 / EE1001 表明调用 ACL/Runtime 接口时当前线程尚未绑定有效 Runtime Context",
      });
    }
    if (hasSocVersionFail) {
      subcauses.push({
        tag: "507008 SoC 版本查询失败 (ACL_ERROR_RT_SOC_VERSION)",
        detail:
          "507008（ACL_ERROR_RT_SOC_VERSION）表明查询 NPU SoC 芯片版本失败（常见于驱动/Toolkit 不配套或设备未就绪）",
      });
    }

    let r20Title: string;
    let r20Summary: string;
    if (subcauses.length > 1) {
      if (
        !hasDevMount &&
        !hasHal &&
        !hasAtb &&
        !hasRankBounds &&
        !hasMissingWeights &&
        !hasEl0004 &&
        !hasStreamModel107005 &&
        !hasAdxDumpFail &&
        hasContextNull &&
        hasSocVersionFail
      ) {
        r20Title = "CANN Runtime 初始化失败：SoC 版本查询失败（507008）与空上下文（107002）";
        r20Summary =
          "507008（SoC 版本查询失败）与 107002（Runtime 上下文为空）并发：通常先在设备探测或上下文建立阶段受阻，致使后续算子调用持空 Context 失败。";
      } else {
        r20Title = `CANN 多重环境/运行时阻塞并发（${subcauses.map((s) => s.tag).join(" + ")}）`;
        r20Summary = `日志中不同进程或节点并发检出多项阻塞：${subcauses.map((s) => s.detail).join("；")}。请按各自所属 Host / Rank 分别排查。`;
      }
    } else if (hasDevMount) {
      r20Title = "容器 /dev/davinci* 设备节点缺失或无访问权限";
      r20Summary =
        "进程在 /dev/davinci* 设备节点访问阶段即受阻（节点缺失或权限不足），尚未进入模型权重与图执行。";
    } else if (hasAtb) {
      r20Title = "CANN / ATB 加速库 libatb.so 缺失或环境未激活";
      r20Summary =
        "进程在导入 NNAL / ATB 扩展时未能加载 libatb.so（通常因容器未 source nnalt/atb set_env.sh 或未安装对应 CANN NNAL 包）。";
    } else if (hasHal) {
      r20Title = "CANN 驱动共享库 libascend_hal.so 缺失或符号版本不匹配";
      r20Summary =
        "进程在加载 CANN HAL 驱动共享库 libascend_hal.so 阶段即失败，请核对宿主机驱动挂载与 LD_LIBRARY_PATH。";
    } else if (hasRankBounds) {
      r20Title = "NPU Worker 可见设备数不足（world_size / DP local rank 越界）";
      r20Summary =
        "worker.py / parallel_state 初始化检查发现所需 world_size / local_rank 超出可见 NPU 设备数（常见于 ASCEND_RT_VISIBLE_DEVICES 少配或容器挂载卡数不足，如 A3 双 Die 卡只挂了单卡 0）。";
    } else if (isPureMissingWeights) {
      r20Title = "模型权重文件缺失（Cannot find any model weights）：请核对权重目录与挂载路径";
      r20Summary =
        "vLLM 模型加载器在指定目录中未找到任何可用的 *.safetensors / *.bin / *.pt 权重分片文件（Cannot find any model weights），主因通常是容器挂载路径错误、模型仓库未下载完整或仅含配置文件。";
    } else if (hasStreamModel107005) {
      r20Title = "CANN Runtime 流模型状态错误（107005 RT_ERROR_STREAM_MODEL）";
      r20Summary =
        "CANN Runtime 返回 107005（RT_ERROR_STREAM_MODEL），表明当前图模型或同步流尚未完成绑定或已处于非法状态。";
    } else if (hasAdxDumpFail) {
      r20Title = "CANN AdxDataDumpServer 初始化失败（dump server run failed）";
      r20Summary =
        "CANN 数据/算子 Dump 服务（AdxDataDumpServer）初始化失败，常见于 dump 落盘目录权限不足、磁盘已满或异常端口/IPC 冲突。";
    } else if (isPureEl0004) {
      r20Title = "CANN 运行时内存/资源分配失败（EL0004，不等同容器设备缺失）";
      r20Summary =
        "CANN Runtime 返回 EL0004（Failed to allocate memory），表明运行时主机侧/设备侧内存池、devmm 映射或流/上下文资源分配失败；当前日志仅见运行时内存/资源申请报错，缺少容器设备节点或驱动库缺失证据，应先排查运行时资源配额与同卡上下文限制。";
    } else if (hasContextNull) {
      r20Title = "CANN Runtime 空上下文错误（107002 / EE1001 ACL_ERROR_RT_CONTEXT_NULL）";
      r20Summary =
        "107002 / EE1001（context pointer null）表明调用 ACL / rtGetDevMsg 接口时当前线程尚未绑定有效 Runtime Context（常因前置 aclrtSetDevice / worker.init_device() 失败或跨线程未设设备上下文引发）。";
    } else if (hasSocVersionFail) {
      r20Title = "CANN SoC 芯片版本查询失败（507008 ACL_ERROR_RT_SOC_VERSION）";
      r20Summary =
        "507008（ACL_ERROR_RT_SOC_VERSION）表明查询 NPU SoC 芯片版本失败，常见于驱动/固件与 CANN Toolkit 不配套、设备未正确初始化或可见卡状态异常。";
    } else {
      r20Title = "CANN 驱动 / Runtime 设备初始化失败（drvGetDevInfo / aclrtSetDevice / 507008 / 107002）";
      r20Summary =
        "进程在 CANN HAL 驱动库加载、/dev/davinci* 设备节点访问或 Runtime 上下文/SoC 初始化阶段即受阻，尚未进入模型权重与图执行。";
    }

    findings.push({
      ruleId: "cann-driver-or-device-env-fault",
      title: r20Title,
      severity: "error",
      category: "os-process",
      evidenceLevel: "C",
      summary: r20Summary,
      mechanism: isPureEl0004
        ? "vllm_ascend/worker/worker.py#L482-L490 经底层 CANN Runtime 管理设备上下文与内存资源；EL0004 指向 Runtime 层内存/资源分配失败（如主机内存/ulimit/devmm/句柄超限或特定任务资源枯竭），需结合同 PID 的 CANN plog 与宿主机资源水位排查。"
        : isPureMissingWeights
          ? 'vllm/model_executor/model_loader/default_loader.py 在加载模型前扫描本地模型路径及缓存中的 *.safetensors / *.bin / *.pt 文件，当可用权重列表为空时直接抛出 RuntimeError("Cannot find any model weights")。'
          : "vllm/v1/executor/multiproc_executor.py#L672 调用 worker.init_device()，worker.py#L432-L440 校验可见卡数并执行 torch.npu.set_device；底层依赖 /dev/davinci_manager、/dev/davinciN、libascend_hal.so 与 ATB libatb.so，驱动/上下文异常会表现为 drvGetDevInfo / aclrtSetDevice 非零返回、507008 或 107002 / EE1001 空上下文。",
      matchedLines: r20Matches,
      sources: isPureMissingWeights
        ? [
            `${VLLM_V030}:vllm/model_executor/model_loader/default_loader.py#L1-L40`,
            `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L425-L440`,
          ]
        : [
            `${VLLM_V030}:vllm/v1/executor/multiproc_executor.py#L671-L676`,
            `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L425-L440`,
            `${VLLM_ASCEND_V030}:vllm_ascend/worker/worker.py#L482-L490`,
            `${VLLM_ASCEND_V030}:csrc/torch_binding.cpp#L126-L137`,
          ],
      nextEvidenceCmd: isPureEl0004
        ? "npu-smi info && free -h && ulimit -a && grep -rnE 'EL0004|ERROR' ~/ascend/log/debug/plog/ | head -n 30"
        : isPureMissingWeights
          ? "ls -lh <model_dir> && ls -la <model_dir>/*.safetensors <model_dir>/*.bin 2>&1"
          : "ls -la /dev/davinci* /dev/devmm_svm /dev/hisi_hdc 2>&1 && npu-smi info && env | grep -E 'ASCEND_RT_VISIBLE_DEVICES|LD_LIBRARY_PATH|ATB_HOME'",
      experimentStep: hasRankBounds
        ? "核对 ASCEND_RT_VISIBLE_DEVICES 与容器挂载设备数，保证可见 NPU 数 >= world_size / local_world_size (TP × PP × DP_local × PCP；A3 双 Die 卡需成对挂载如 0,1)。"
        : isPureMissingWeights
          ? "确认 --model 指向容器内真实挂载的权重目录且包含完整 *.safetensors / *.bin 分片文件（而非仅含 config.json 的空目录或错误宿主路径）。"
          : hasAtb
            ? "确认安装 NNAL / ATB 并执行 source /usr/local/Ascend/nnal/atb/set_env.sh（检查 libatb.so 是否在 LD_LIBRARY_PATH 中）。"
            : isPureEl0004
              ? "1) 检查宿主机/容器内存余量、ulimit -l / devmm 资源与 npu-smi 残留占用；2) 抓取同 PID 的 CANN plog 首条 EL0004 上下文确定具体分配接口。"
              : "1) 若有容器设备/HAL 缺失证据，补齐 /dev/davinciN、/dev/davinci_manager、/dev/devmm_svm、/dev/hisi_hdc 与宿主 driver/lib64 挂载；2) 对 507008 / 107002 / EE1001 / drvGetDevInfo 失败，用 npu-smi info 核对驱动固件与 CANN Toolkit 配套及当前线程 set_device 初始化顺序。",
      wikiPageIds: hasEl0004
        ? ["npu-worker-lifecycle", "device-memory", "hardware-devices", "ascend-env-and-serve"]
        : isPureMissingWeights
          ? ["ascend-model-onboarding", "ascend-env-and-serve"]
          : ["npu-worker-lifecycle", "ascend-model-onboarding", "hardware-devices", "ascend-env-and-serve"],
    });
  }

  const collapseFindingsDecJanRollover = evalDecJanRollover;
  const rootRuleSet = new Set<string>();
  const earliestRuleSignal = new Map<string, ClassifiedSignal>();
  const cascadeOnlyRuleSet = new Set<string>();
  for (const s of signals) {
    if (!s.ruleId) continue;
    if (s.kind === "root-cause") {
      rootRuleSet.add(s.ruleId);
      const prev = earliestRuleSignal.get(s.ruleId);
      if (!prev || compareSignalsChronologically(s, prev, collapseFindingsDecJanRollover) < 0) {
        earliestRuleSignal.set(s.ruleId, s);
      }
    }
  }
  for (const s of signals) {
    if (s.ruleId && s.kind === "cascade" && !rootRuleSet.has(s.ruleId)) {
      cascadeOnlyRuleSet.add(s.ruleId);
      const prev = earliestRuleSignal.get(s.ruleId);
      if (!prev || compareSignalsChronologically(s, prev, collapseFindingsDecJanRollover) < 0) {
        earliestRuleSignal.set(s.ruleId, s);
      }
    }
  }
  const winnerRuleId =
    winnerSignal?.ruleId ?? verdict.timelineEvents?.find((e) => e.kind === "root-cause")?.ruleId ?? null;
  const hasAnyPrimaryRoot = signals.some((s) => s.kind === "root-cause");
  const originalIndex = new Map<LogDiagnosisFinding, number>();
  findings.forEach((f, idx) => {
    originalIndex.set(f, idx);
  });
  const tierOfFinding = (f: LogDiagnosisFinding): number => {
    if (winnerRuleId !== null && f.ruleId === winnerRuleId) return 0;
    if (rootRuleSet.has(f.ruleId) && f.severity === "error") return 1;
    if (f.severity === "error" && !cascadeOnlyRuleSet.has(f.ruleId)) return 2;
    if (cascadeOnlyRuleSet.has(f.ruleId) && (hasAnyPrimaryRoot || f.ruleId === "hccl-timeout-cascade")) {
      return f.severity === "error" ? 3 : 4;
    }
    if (f.severity === "warn") return 4;
    return 2;
  };
  findings.sort((a, b) => {
    const ta = tierOfFinding(a);
    const tb = tierOfFinding(b);
    if (ta !== tb) return ta - tb;
    const sa = earliestRuleSignal.get(a.ruleId);
    const sb = earliestRuleSignal.get(b.ruleId);
    if (sa && sb) {
      const cmp = compareSignalsChronologically(sa, sb, collapseFindingsDecJanRollover);
      if (cmp !== 0) return cmp;
    }
    return (originalIndex.get(a) ?? 0) - (originalIndex.get(b) ?? 0);
  });

  return findings;
}

export function isRuleEvidenceLine(rawLine: string): boolean {
  const rawTrimmed = rawLine.trim();
  if (!rawTrimmed || rawTrimmed.startsWith("#")) return false;
  if (isPromExpositionLine(rawTrimmed)) {
    const sample = parsePromMetricSampleLine(rawTrimmed);
    return (
      sample !== null && DIAGNOSTIC_VLLM_METRIC_NAMES.has(sample.metricName) && Number.isFinite(sample.rawVal)
    );
  }
  const inspect = capLineWindow(rawLine);
  const effectiveInspect = stripBenignNegatedClauses(inspect);
  if (isMooncakeAdxlFallbackLine(effectiveInspect) || isDebugLoggingHotpathLine(effectiveInspect)) {
    return true;
  }
  if (isAdvisoryGraphCapabilityWarning(effectiveInspect) || isPiecewiseSilentResetLine(effectiveInspect)) {
    return true;
  }
  if (isSigkillLine(effectiveInspect) || isSigsegvLine(effectiveInspect)) {
    return true;
  }
  if (
    !isBenignDocumentationOrHelpLine(effectiveInspect) &&
    hasFailureSemantics(effectiveInspect) &&
    /Free memory on device\b[^\r\n]{0,64}\(.+\)\s*on startup\s+is less than desired|Error in memory profiling\.\s*Initial free memory|\bNo available memory for the cache blocks\b|\bCannot find any model weights\b/i.test(
      effectiveInspect,
    )
  ) {
    return true;
  }
  if (
    /\bhccn_tool\b[^\r\n]{0,128}-link\b/i.test(effectiveInspect) ||
    isBareHccnLinkDownLine(effectiveInspect) ||
    /(?:modelslim_config\.py|quant_model_description\.json)/i.test(effectiveInspect) ||
    (!isBenignDocumentationOrHelpLine(effectiveInspect) && HCCL_BUFFSIZE_REQ_RE.test(effectiveInspect))
  ) {
    return true;
  }
  if (!hasFailureSemantics(effectiveInspect)) return false;
  if (/\bJSONDecodeError\b/i.test(effectiveInspect)) {
    return true;
  }
  if (
    /\b(?:NPU\s+out of memory|ACL_ERROR_RT_MEMORY_ALLOCATION|torch\.npu\.OutOfMemoryError)\b/i.test(
      effectiveInspect,
    ) ||
    (!NON_NPU_EXPLICIT_OOM_RE.test(effectiveInspect) && /\bOutOfMemoryError\b/i.test(effectiveInspect))
  ) {
    return true;
  }
  if (
    isPeerRefusedCascadeLine(effectiveInspect) ||
    HCCL_LINK_ESTABLISH_TIMEOUT_RE.test(effectiveInspect) ||
    EXPLICIT_HCCL_WAIT_TIMEOUT_RE.test(effectiveInspect) ||
    HCCL_CONTEXT_TIMEOUT_FAULT_RE.test(effectiveInspect) ||
    HCCL_RANKTABLE_INIT_RE.test(effectiveInspect) ||
    HCCL_TRANSPORT_RESOURCE_OR_WQE_RE.test(effectiveInspect) ||
    HCCL_RASOCKET_BIND_OR_ROUTE_RE.test(effectiveInspect) ||
    isExplicitHcclBindFaultLine(effectiveInspect) ||
    (DISTRIBUTED_COMM_CONTEXT_RE.test(effectiveInspect) &&
      HCCL_DISTRIBUTED_NET_FAULT_RE.test(effectiveInspect)) ||
    HCCL_ROCE_PORT_DOWN_RE.test(effectiveInspect)
  ) {
    return true;
  }
  if (
    isSocCompatLine(effectiveInspect) ||
    isGqaStaticC8KvLine(effectiveInspect) ||
    isMooncakePdErrorLine(effectiveInspect) ||
    isSleepFractalNzLine(effectiveInspect) ||
    isPortConflictLine(effectiveInspect) ||
    isTorchairGeCompileFaultLine(effectiveInspect) ||
    isCannOpapiOrAclnnLine(effectiveInspect) ||
    isMoeMc2OrModelSlimLine(effectiveInspect) ||
    CANN_DRIVER_DEVICE_ENV_CORE_RE.test(effectiveInspect) ||
    EL0004_MEM_ALLOC_RE.test(effectiveInspect)
  ) {
    return true;
  }
  const sanitizedCodes = stripLogIdFieldsForErrorCodes(effectiveInspect);
  if (
    STREAM_CAPTURE_CODE_RE.test(sanitizedCodes) ||
    CANN_ENV_STREAM_OR_DUMP_RE.test(sanitizedCodes) ||
    PLOG_HARDWARE_FAULT_RE.test(sanitizedCodes) ||
    R13_RUNTIME_CODE_RE.test(sanitizedCodes)
  ) {
    return true;
  }
  if (
    /AscendFAImpl does not support ACL graph capture|npugraph_ex is not supported|\bFULL_DECODE_ONLY\b[^\r\n]{0,160}(?:not\s+support|unsupported|invalid|conflict|incompatible|fail|error)|(?:aclgraph|acl\s+graph)[^\r\n]{0,60}(?:capture[^\r\n]{0,20}(?:fail|error)|fallback|not\s+supported|unsupported|fail|error)|capture_model[^\r\n]{0,160}(?:fail|error)/i.test(
      effectiveInspect,
    )
  ) {
    return true;
  }
  return /\bEngineCore(?:Proc)?\b[^\r\n]{0,50}died unexpectedly|\bRuntimeError:\s*Engine core initialization failed\b/i.test(
    effectiveInspect,
  );
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

  const { lines, ambiguousDomainPids } = parseLogLines(rawInput);
  const { snapshot: metrics, scopes: metricScopes } = parsePrometheusMetricsAndScopes(rawInput);
  const nonEmptyLines = lines.filter((l) => l.trimmed.length > 0);
  const hasAnyPromExposition = nonEmptyLines.some(
    (l) => PROM_COMMENT_HEADER_RE.test(l.trimmed) || parsePromMetricSampleLine(l.trimmed) !== null,
  );
  const nonMetricLines = nonEmptyLines.filter(
    (l) =>
      !((metrics.hasMetrics || hasAnyPromExposition) && l.trimmed.startsWith("#")) &&
      !isPromExpositionLine(l.trimmed),
  );

  const hasPromContent = metrics.hasMetrics || hasAnyPromExposition;
  const inputKind: LogAnalysisReport["inputKind"] =
    hasPromContent && nonMetricLines.length === 0 ? "metrics" : hasPromContent ? "mixed" : "logs";

  const explicitLogicalRanks = new Set<number>();
  const signals: ClassifiedSignal[] = [];
  const ctx = buildLineScopeContext(lines, ambiguousDomainPids);
  const lineOwnerMap = new Map<number, string>();
  const tracebackOwnerMap = new Map<number, string>();
  const apiInfoLinesByProc = new Map<string, ParsedLogLine[]>();

  const API_INFO_NON_RECOVERY_RE =
    /\b(?:shutting\s+down|terminated|exited|stopping|Application\s+startup\s+complete|Graph\s+capturing\s+finished|false|skipped|skipping|bypassed|ignored|degraded|failing|unhealthy|incomplete|aborted|cancelled|canceled|disabled|unexecuted|inactive|stale|deferred|postponed|suppressed|omitted|untested|unverified|scheduled|queued|enqueued|planned|delayed|paused|suspended|registered|configured|standing\s+by|arming|will\s+(?:not\s+)?(?:be\s+)?(?:run|execute|start|check|probe|retry|recover)|about\s+to\s+(?:run|execute|start|check|probe)|due\s+(?:in|at)|scheduled\s+(?:for|at|in)|yet\s+to\s+(?:be\s+)?(?:run|start(?:ed)?|execute(?:d)?|begin|complete(?:d)?|finish(?:ed)?|pass(?:ed)?|trigger(?:ed)?)|(?:starts?|starting|runs?|running|executes?|executing|begins?|beginning|fires?|firing|triggers?|triggering|occurs?|occurring|commences?|commencing)\s+(?:in|after)\s+\d+(?:\.\d+)?\s*(?:ms|s|sec(?:onds?)?|m|min(?:utes?)?|h|hr|hours?)|not\s+(?:yet\s+|still\s+|currently\s+|fully\s+|ever\s+|being\s+|been\s+)?(?:ok|passed?|passing|ready|healthy|alive|available|up|started|complete(?:d)?|verified|satisfied|succeeded|run|ran|executed|checked|invoked|triggered|performed|probed|evaluated|active|enabled)|(?:has|have|had|was|were|is|are)\s+not\s+(?:yet\s+|still\s+|currently\s+|ever\s+)?(?:been\s+|being\s+)?(?:run|ran|executed|started|passed|completed|finished|succeeded|checked|performed|probed|verified|triggered|fired|enabled|active)|(?:hasn|haven|hadn|isn|aren|wasn|weren)'?t\s+(?:yet\s+|ever\s+)?(?:been\s+)?(?:run|ran|executed|started|passed|completed|finished|succeeded|checked|performed|probed|verified)|did\s+not\s+(?:run|execute|start|complete|finish|pass|succeed)|didn'?t\s+(?:run|execute|start|complete|finish|pass|succeed)|never\s+(?:been\s+)?(?:ran|run|executed|started|passed|completed|finished|checked|succeeded|probed|verified|ready)|unsuccessful|non-?ready|unready|pending|in[\s_-]?progress|initializing|starting|warming[\s_-]?up|denied|forbidden|unauthorized|unknown|waiting|down|rejected|blocked|unavailable|refused|timed?\s+out|retry(?:ing)?|back-?off|probe\s+fail(?:ed|ing)?|fail(?:ed|ing)?(?:\s+to\s+(?:pass|recover|start|succeed|serve|run|execute))?)\b|\b(?:HTTP(?:\/\d(?:\.\d)?)?["']?\s+|status(?:\s+code)?\s*[:=]?\s*)(?:4\d\d|5\d\d)\b|(?:returned|responded|response|got|with)\s+(?:HTTP(?:\/\d(?:\.\d)?)?\s+)?(?:4\d\d|5\d\d|false|null|none|error)\b|\b(?:readiness|liveness|health(?:\s*check)?)\s+probe\b[^\r\n]{0,64}\b(?:4\d\d|5\d\d|false|skipped|fail(?:ed|ing)?|unhealthy|error|pending|denied|forbidden|unauthorized|down|scheduled|queued|enqueued|will\s+(?:not\s+)?(?:be\s+)?run|yet\s+to\s+(?:be\s+)?run|(?:starts?|runs?|executes?|begins?|fires?|triggers?)\s+in\s+\d+(?:\.\d+)?\s*(?:ms|s|sec(?:onds?)?|m|min(?:utes?)?|h|hr|hours?)|deferred|delayed|paused|suspended|not\s+(?:yet\s+|ever\s+)?(?:been\s+)?(?:ready|ok|run|executed)|(?:has|have)\s+not\s+(?:yet\s+)?(?:been\s+)?run|(?:hasn|haven)'?t\s+(?:yet\s+)?(?:been\s+)?run|never\s+(?:been\s+)?(?:ran|run|executed)|unexecuted|unsuccessful|did\s+not\s+(?:pass|run|execute)|inactive|stale|postponed)\b|(?:^|\s)(?:400|401|403|404|408|429|500|502|503|504)\s+(?:Bad\s+Request|Unauthorized|Forbidden|Not\s+Found|Request\s+Timeout|Too\s+Many\s+Requests|Internal\s+Server\s+Error|Bad\s+Gateway|Service\s+Unavailable|Gateway\s+Timeout)\b/i;

  for (const line of lines) {
    if (line.isPromLine || line.trimmed.startsWith("#")) continue;
    if (
      line.pid !== null &&
      /(?<![.\w])INFO\b(?!\s*\()/i.test(line.inspectLine) &&
      /\(APIServer\b/i.test(line.inspectLine) &&
      !hasLogErrorSeverity(line.inspectLine) &&
      !hasFailureSemantics(line.inspectLine) &&
      !API_INFO_NON_RECOVERY_RE.test(line.inspectLine)
    ) {
      const procKey = formatApiServerProcessKey(line);
      let infoArr = apiInfoLinesByProc.get(procKey);
      if (!infoArr) {
        infoArr = [];
        apiInfoLinesByProc.set(procKey, infoArr);
      }
      infoArr.push(line);
    }
    if (line.rank !== null && line.rankSource !== "device-id" && line.rankSource !== "worker-dp-pp") {
      explicitLogicalRanks.add(line.rank);
    }
    const sig = classifyLineSignal(line, ctx);
    if (sig) {
      signals.push(sig);
      if (sig.ruleId) {
        lineOwnerMap.set(sig.lineNumber, sig.ruleId);
        if (sig.tracebackGroupId !== null && sig.kind === "root-cause") {
          const existing = tracebackOwnerMap.get(sig.tracebackGroupId);
          if (!existing || existing === "cann-opapi-or-aclnn-fault") {
            tracebackOwnerMap.set(sig.tracebackGroupId, sig.ruleId);
          }
        }
      }
    }
  }

  const apiErrSigsByProc = new Map<string, ClassifiedSignal[]>();
  for (const sig of signals) {
    if (
      sig.kind === "root-cause" &&
      sig.ruleId === undefined &&
      sig.rank === null &&
      sig.pid !== null &&
      /\(APIServer\b/i.test(sig.inspectLine)
    ) {
      const procKey = formatApiServerProcessKey(sig);
      let errArr = apiErrSigsByProc.get(procKey);
      if (!errArr) {
        errArr = [];
        apiErrSigsByProc.set(procKey, errArr);
      }
      errArr.push(sig);
    }
  }
  const recoveredApiErrorLines = new Set<number>();
  if (apiErrSigsByProc.size > 0) {
    const pidedStores = new Map<number, TieredDomCube>();
    const unpidedStore = createTieredDomCube();
    const seenBoundLines = new Set<number>();
    for (const src of [ctx.startupBoundaryBucket.all.allByLine, ctx.processResetBucket.all.allByLine]) {
      for (const m of src) {
        if (seenBoundLines.has(m.lineNumber)) continue;
        seenBoundLines.add(m.lineNumber);
        if (m.pid !== null) {
          let ps = pidedStores.get(m.pid);
          if (!ps) {
            ps = createTieredDomCube();
            pidedStores.set(m.pid, ps);
          }
          pushToTieredDomCube(ps, m);
        } else {
          pushToTieredDomCube(unpidedStore, m);
        }
      }
    }
    finalizeTieredDomCube(unpidedStore);
    for (const ps of pidedStores.values()) finalizeTieredDomCube(ps);

    for (const [procKey, errs] of apiErrSigsByProc) {
      const infoList = apiInfoLinesByProc.get(procKey);
      if (!infoList || infoList.length === 0 || errs.length < 2) continue;

      const sampleAnchor = infoList[0] ?? errs[0]!;
      const procPid = sampleAnchor.pid;
      const pStore = procPid !== null ? pidedStores.get(procPid) : undefined;
      const pidCompatBuckets = pStore ? queryTieredDomCube(pStore, sampleAnchor) : [];
      const unpidedCompatBuckets = queryTieredDomCube(unpidedStore, sampleAnchor);
      const compatBuckets =
        pidCompatBuckets.length === 0
          ? unpidedCompatBuckets
          : unpidedCompatBuckets.length === 0
            ? pidCompatBuckets
            : [...pidCompatBuckets, ...unpidedCompatBuckets];

      const getFileEpoch = (item: ParsedLogLine): number => {
        let count = 0;
        for (const b of compatBuckets) {
          if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
          count +=
            findRightmostTrue(
              b.allByLine,
              (m) =>
                m.segmentId < item.segmentId ||
                (m.segmentId === item.segmentId && m.lineNumber < item.lineNumber),
            ) + 1;
        }
        return count;
      };
      const getTsEpoch = (item: ParsedLogLine, tk: number): number => {
        let count = 0;
        for (const b of compatBuckets) {
          if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
          const arr = b.byTier.get(tk);
          if (!arr || arr.length === 0) continue;
          count += findRightmostTrue(arr, (m) => compareTimestampOrder(m, item) < 0) + 1;
        }
        return count;
      };
      const hasBoundBetweenRev = (err: ParsedLogLine, revCandidate: ParsedLogLine, tk: number): boolean => {
        if (compatBuckets.length === 0) return false;
        const [first, second] =
          revCandidate.segmentId < err.segmentId ||
          (revCandidate.segmentId === err.segmentId && revCandidate.lineNumber <= err.lineNumber)
            ? [revCandidate, err]
            : [err, revCandidate];
        const checkSameSeg = err.segmentId === revCandidate.segmentId;
        for (const b of compatBuckets) {
          if (activeScaleProbe) activeScaleProbe.startupBoundarySteps += 1;
          const arr = b.byTier.get(tk);
          if (arr && arr.length > 0) {
            const startPos = findRightmostTrue(arr, (m) => compareTimestampOrder(m, revCandidate) < 0);
            for (let p = startPos; p >= 0; p -= 1) {
              const mid = arr[p]!;
              if (compareTimestampOrder(mid, err) <= 0) break;
              if (areTimestampsComparable(err, mid)) return true;
            }
          }
          if (checkSameSeg && err.lineNumber !== revCandidate.lineNumber) {
            if (b.untimestamped.length > 0) {
              const uPos = findRightmostTrue(
                b.untimestamped,
                (m) =>
                  m.segmentId < second.segmentId ||
                  (m.segmentId === second.segmentId && m.lineNumber < second.lineNumber),
              );
              if (uPos >= 0) {
                const mid = b.untimestamped[uPos]!;
                if (
                  mid.segmentId > first.segmentId ||
                  (mid.segmentId === first.segmentId && mid.lineNumber > first.lineNumber)
                ) {
                  return true;
                }
              }
            }
            const bSegIdx = getTieredSegTreeIndex(b);
            const segTiers = bSegIdx.bySegByTier.get(err.segmentId);
            if (segTiers) {
              const bSegTrees = bSegIdx.treesBySegTier.get(err.segmentId);
              for (const [otherTk, segArr] of segTiers) {
                const hiPos = findRightmostTrue(segArr, (m) => m.lineNumber < second.lineNumber);
                if (hiPos < 0 || segArr[hiPos]!.lineNumber <= first.lineNumber) continue;
                const loPos = findRightmostTrue(segArr, (m) => m.lineNumber <= first.lineNumber) + 1;
                if (loPos > hiPos) continue;
                if (otherTk !== tk) {
                  return true;
                }
                const tree = bSegTrees?.get(otherTk) ?? null;
                if (
                  hasIncomparableSameTierInRange(
                    tree,
                    segArr,
                    loPos,
                    hiPos,
                    tk,
                    err,
                    revCandidate,
                    () => true,
                  )
                ) {
                  return true;
                }
              }
            }
          }
        }
        return false;
      };

      const bestInfoByEpoch = new Map<string, ParsedLogLine>();
      const bestInfoByReverseTsEpoch = new Map<string, ParsedLogLine>();
      const bestUntsInfoBySegEpoch = new Map<string, ParsedLogLine>();
      for (const info of infoList) {
        const fileEp = getFileEpoch(info);
        if (info.timestampMs !== null) {
          const tk = getLifecycleTierKey(info);
          const tsEp = getTsEpoch(info, tk);
          const fwdKey = `${tk}|${tsEp}|${fileEp}`;
          const curFwd = bestInfoByEpoch.get(fwdKey);
          if (!curFwd || compareTimestampOrder(info, curFwd) > 0) {
            bestInfoByEpoch.set(fwdKey, info);
          }
          const revKey = `${tk}|${tsEp}`;
          const curRev = bestInfoByReverseTsEpoch.get(revKey);
          if (!curRev || compareTimestampOrder(info, curRev) > 0) {
            bestInfoByReverseTsEpoch.set(revKey, info);
          }
        }
        const uKey = `${info.segmentId}|${fileEp}`;
        const curU = bestUntsInfoBySegEpoch.get(uKey);
        if (!curU || info.lineNumber > curU.lineNumber) {
          bestUntsInfoBySegEpoch.set(uKey, info);
        }
      }

      const cohortsByInfoLine = new Map<number, number[]>();
      const pushToInfoCohort = (info: ParsedLogLine | undefined, errLineNo: number) => {
        if (!info) return;
        let cohort = cohortsByInfoLine.get(info.lineNumber);
        if (!cohort) {
          cohort = [];
          cohortsByInfoLine.set(info.lineNumber, cohort);
        }
        cohort.push(errLineNo);
      };

      for (const err of errs) {
        const fileEp = getFileEpoch(err);
        if (err.timestampMs !== null) {
          const tk = getLifecycleTierKey(err);
          const tsEp = getTsEpoch(err, tk);
          const fwdCandidate = bestInfoByEpoch.get(`${tk}|${tsEp}|${fileEp}`);
          if (fwdCandidate && compareTimestampOrder(fwdCandidate, err) > 0) {
            pushToInfoCohort(fwdCandidate, err.lineNumber);
            continue;
          }
          const revCandidate = bestInfoByReverseTsEpoch.get(`${tk}|${tsEp}`);
          if (
            revCandidate &&
            revCandidate.segmentId <= err.segmentId &&
            compareTimestampOrder(revCandidate, err) > 0 &&
            !hasBoundBetweenRev(err, revCandidate, tk)
          ) {
            pushToInfoCohort(revCandidate, err.lineNumber);
          }
        } else {
          const uCandidate = bestUntsInfoBySegEpoch.get(`${err.segmentId}|${fileEp}`);
          if (uCandidate && uCandidate.lineNumber > err.lineNumber) {
            pushToInfoCohort(uCandidate, err.lineNumber);
          }
        }
      }

      for (const cohort of cohortsByInfoLine.values()) {
        if (cohort.length >= 2) {
          for (const errLineNo of cohort) recoveredApiErrorLines.add(errLineNo);
        }
      }
    }
  }

  // P1-2 / P1-4 / P2-18: demote peer-failure cascade symptoms in O(log N) domain-indexed rank lookup while preserving local physical/bind/ranktable roots
  const rootPrimariesByRank = new Map<number, DomainIndexedBucket>();
  for (const s of signals) {
    if (s.kind === "root-cause" && hasLogicalCausalRank(s)) {
      pushToKeyedDomainBucket(rootPrimariesByRank, s.rank!, s);
    }
  }
  for (const b of rootPrimariesByRank.values()) finalizeDomainBucket(b);

  const peerDecJanRollover = hasUnanchoredDecJanRollover(signals);
  const PEER_NULL_DIM = "\u0001";
  const peerNormDim = (v: string | null): string => (v === null ? PEER_NULL_DIM : v.toLowerCase());
  interface SegMinTsTree {
    arr: ParsedLogLine[];
    minMs: Float64Array;
    minSub: Int32Array;
  }
  const buildSegMinTsTree = (arr: ParsedLogLine[]): SegMinTsTree | null => {
    if (arr.length <= 16) return null;
    const n = arr.length;
    const minMs = new Float64Array(4 * n);
    const minSub = new Int32Array(4 * n);
    const init = (node: number, lo: number, hi: number) => {
      if (lo === hi) {
        minMs[node] = arr[lo]!.timestampMs!;
        minSub[node] = arr[lo]!.timestampSubMs;
        return;
      }
      const mid = (lo + hi) >> 1;
      const left = node << 1;
      const right = left | 1;
      init(left, lo, mid);
      init(right, mid + 1, hi);
      const lMs = minMs[left]!;
      const rMs = minMs[right]!;
      if (lMs < rMs || (lMs === rMs && minSub[left]! <= minSub[right]!)) {
        minMs[node] = lMs;
        minSub[node] = minSub[left]!;
      } else {
        minMs[node] = rMs;
        minSub[node] = minSub[right]!;
      }
    };
    init(1, 0, n - 1);
    return { arr, minMs, minSub };
  };
  const querySegMinTsTree = (
    tree: SegMinTsTree | null,
    arr: ParsedLogLine[],
    limitIdx: number,
    sig: ClassifiedSignal,
  ): ParsedLogLine | null => {
    if (limitIdx < 0) return null;
    if (!tree) {
      for (let i = limitIdx; i >= 0; i -= 1) {
        const mid = arr[i]!;
        if (areTimestampsComparable(mid, sig) && compareTimestampOrder(mid, sig) < 0) {
          return mid;
        }
      }
      return null;
    }
    const sigMs = sig.timestampMs!;
    const sigSub = sig.timestampSubMs;
    const { minMs, minSub } = tree;
    const dfs = (node: number, lo: number, hi: number): ParsedLogLine | null => {
      if (lo > limitIdx) return null;
      const mMs = minMs[node]!;
      if (mMs > sigMs || (mMs === sigMs && minSub[node]! > sigSub)) return null;
      if (lo === hi) {
        const mid = arr[lo]!;
        return areTimestampsComparable(mid, sig) && compareTimestampOrder(mid, sig) < 0 ? mid : null;
      }
      const mid = (lo + hi) >> 1;
      if (limitIdx > mid) {
        const rHit = dfs((node << 1) | 1, mid + 1, hi);
        if (rHit) return rHit;
      }
      return dfs(node << 1, lo, mid);
    };
    return dfs(1, 0, arr.length - 1);
  };

  interface UniversalStartupBucket extends TieredMilestoneBucket {
    bySegByTier: Map<number, Map<number, ParsedLogLine[]>>;
    segTrees: Map<number, Map<number, SegMinTsTree | null>>;
  }
  const universalStartupBuckets = new Map<string, UniversalStartupBucket>();
  for (const m of ctx.startupBoundaryBucket.all.allByLine) {
    const key = `${m.rank ?? "na"}\u0000${peerNormDim(m.hostTag)}\u0000${peerNormDim(m.instanceTag)}\u0000${peerNormDim(m.groupTag)}`;
    let sub = universalStartupBuckets.get(key);
    if (!sub) {
      sub = { ...createTieredBucket(), bySegByTier: new Map(), segTrees: new Map() };
      universalStartupBuckets.set(key, sub);
    }
    pushToTieredBucket(sub, m);
    if (m.timestampMs !== null) {
      const tk = getLifecycleTierKey(m);
      let segTiers = sub.bySegByTier.get(m.segmentId);
      if (!segTiers) {
        segTiers = new Map();
        sub.bySegByTier.set(m.segmentId, segTiers);
      }
      let tArr = segTiers.get(tk);
      if (!tArr) {
        tArr = [];
        segTiers.set(tk, tArr);
      }
      tArr.push(m);
    }
  }
  for (const sub of universalStartupBuckets.values()) {
    finalizeTieredBucket(sub);
    for (const [segId, segTiers] of sub.bySegByTier) {
      const tTrees = new Map<number, SegMinTsTree | null>();
      sub.segTrees.set(segId, tTrees);
      for (const [tk, tArr] of segTiers) {
        tArr.sort((a, b) => a.lineNumber - b.lineNumber);
        tTrees.set(tk, buildSegMinTsTree(tArr));
      }
    }
  }

  const peerLookupMemo = new Map<string, boolean>();
  const findUniversalPeerStartupCutoff = (
    sig: ClassifiedSignal,
    peerRank: number,
  ): {
    cutoffMid: ParsedLogLine | null;
    cutoffUntsLine: number;
    cutoffAnySameSegLine: number;
    cutoffAfterUntsLine: number;
  } => {
    if (universalStartupBuckets.size === 0) {
      return {
        cutoffMid: null,
        cutoffUntsLine: -1,
        cutoffAnySameSegLine: -1,
        cutoffAfterUntsLine: Number.POSITIVE_INFINITY,
      };
    }
    const rKeys = ["na", String(peerRank)];
    if (sig.rank !== null && sig.rank !== peerRank) rKeys.push(String(sig.rank));
    const hKeys = sig.hostTag !== null ? [PEER_NULL_DIM, sig.hostTag.toLowerCase()] : [PEER_NULL_DIM];
    const iKeys = sig.instanceTag !== null ? [PEER_NULL_DIM, sig.instanceTag.toLowerCase()] : [PEER_NULL_DIM];
    const gKeys = sig.groupTag !== null ? [PEER_NULL_DIM, sig.groupTag.toLowerCase()] : [PEER_NULL_DIM];

    const matchedSubs: UniversalStartupBucket[] = [];
    for (const rk of rKeys) {
      for (const hk of hKeys) {
        for (const ik of iKeys) {
          for (const gk of gKeys) {
            const sub = universalStartupBuckets.get(`${rk}\u0000${hk}\u0000${ik}\u0000${gk}`);
            if (sub) matchedSubs.push(sub);
          }
        }
      }
    }
    if (matchedSubs.length === 0) {
      return {
        cutoffMid: null,
        cutoffUntsLine: -1,
        cutoffAnySameSegLine: -1,
        cutoffAfterUntsLine: Number.POSITIVE_INFINITY,
      };
    }

    let cutoffMid: ParsedLogLine | null = null;
    let cutoffUntsLine = -1;
    let cutoffAnySameSegLine = -1;
    let cutoffAfterUntsLine = Number.POSITIVE_INFINITY;
    const tierKey = getLifecycleTierKey(sig);
    for (const sub of matchedSubs) {
      if (sig.timestampMs !== null) {
        const arr = sub.byTier.get(tierKey);
        if (arr && arr.length > 0) {
          const pos = findRightmostTrue(arr, (m) => compareTimestampOrder(m, sig) < 0);
          if (pos >= 0) {
            const mid = arr[pos]!;
            if (!cutoffMid || compareTimestampOrder(mid, cutoffMid) > 0) {
              cutoffMid = mid;
            }
          }
        }
      }
      const segArr = sub.bySeg.get(sig.segmentId);
      if (segArr && segArr.length > 0) {
        if (sig.timestampMs === null) {
          const sPos = findRightmostTrue(segArr, (m) => m.lineNumber < sig.lineNumber);
          if (sPos >= 0) {
            const lineNo = segArr[sPos]!.lineNumber;
            if (lineNo > cutoffAnySameSegLine) cutoffAnySameSegLine = lineNo;
            if (lineNo > cutoffUntsLine) cutoffUntsLine = lineNo;
          }
          const aPos = findRightmostTrue(segArr, (m) => m.lineNumber <= sig.lineNumber) + 1;
          if (aPos < segArr.length) {
            const afterLineNo = segArr[aPos]!.lineNumber;
            if (afterLineNo < cutoffAfterUntsLine) cutoffAfterUntsLine = afterLineNo;
          }
        } else {
          let bestUncompLine = -1;
          const uSegArr = sub.untimestampedBySeg.get(sig.segmentId);
          if (uSegArr && uSegArr.length > 0) {
            const uPos = findRightmostTrue(uSegArr, (m) => m.lineNumber < sig.lineNumber);
            if (uPos >= 0 && uSegArr[uPos]!.lineNumber > bestUncompLine) {
              bestUncompLine = uSegArr[uPos]!.lineNumber;
            }
          }
          const segTiers = sub.bySegByTier.get(sig.segmentId);
          const segTrees = sub.segTrees.get(sig.segmentId);
          let bestCompLine = -1;
          if (segTiers) {
            for (const [otherTk, stArr] of segTiers) {
              if (stArr.length === 0) continue;
              const oPos = findRightmostTrue(stArr, (m) => m.lineNumber < sig.lineNumber);
              if (oPos < 0) continue;
              if (otherTk !== tierKey) {
                if (stArr[oPos]!.lineNumber > bestUncompLine) {
                  bestUncompLine = stArr[oPos]!.lineNumber;
                }
              } else {
                const tree = segTrees?.get(otherTk) ?? null;
                const cHit = querySegMinTsTree(tree, stArr, oPos, sig);
                if (cHit && cHit.lineNumber > bestCompLine) {
                  bestCompLine = cHit.lineNumber;
                }
              }
            }
          }
          if (bestUncompLine > cutoffUntsLine) cutoffUntsLine = bestUncompLine;
          const maxValidLine = Math.max(bestCompLine, bestUncompLine);
          if (maxValidLine > cutoffAnySameSegLine) cutoffAnySameSegLine = maxValidLine;
        }
      }
    }
    return { cutoffMid, cutoffUntsLine, cutoffAnySameSegLine, cutoffAfterUntsLine };
  };

  const peerStartupSplit = getStartupRankSplit(ctx.startupBoundaryBucket);
  const hasSegStartupAtOrBefore = (
    segId: number,
    maxLineNo: number,
    other: ClassifiedSignal,
    sig: ClassifiedSignal,
  ): boolean => {
    const mergedDom = {
      hostTag: other.hostTag ?? sig.hostTag,
      instanceTag: other.instanceTag ?? sig.instanceTag,
      groupTag: other.groupTag ?? sig.groupTag,
      timestampMs: sig.timestampMs,
      timestampKind: sig.timestampKind,
      hasExplicitTimezone: sig.hasExplicitTimezone,
      inferredYearMatched: sig.inferredYearMatched,
    };
    const buckets: DomainIndexedBucket[] = [peerStartupSplit.noRank];
    if (other.rank !== null) {
      const ob = peerStartupSplit.byRank.get(other.rank);
      if (ob) buckets.push(ob);
    }
    if (sig.rank !== null && sig.rank !== other.rank) {
      const sb = peerStartupSplit.byRank.get(sig.rank);
      if (sb) buckets.push(sb);
    }
    for (const db of buckets) {
      for (const sub of getDomainBucketsForLine(db, mergedDom)) {
        const segArr = sub.bySeg.get(segId);
        if (!segArr || segArr.length === 0) continue;
        const pos = findRightmostTrue(segArr, (m) => m.lineNumber <= maxLineNo);
        for (let p = pos; p >= 0; p -= 1) {
          const m = segArr[p]!;
          if (areCausalDomainsCompatible(other, m) && areCausalDomainsCompatible(sig, m)) {
            return true;
          }
        }
      }
    }
    return false;
  };

  for (const sig of signals) {
    if (sig.kind !== "root-cause" || sig.peerRank === null || sig.peerRank === sig.rank) continue;
    if (
      sig.ruleId === "hccl-link-or-ifname-fault" &&
      (sig.mechanism === "link-port-down" ||
        sig.mechanism === "link-bind-fault" ||
        HCCL_RANKTABLE_INIT_RE.test(sig.inspectLine) ||
        (sig.mechanism === "link-transport-init" &&
          !/\bRaSocketConnect\b|\bHCCL_E_UNAVAIL\b|\bHCCL\s+error:\s*7\b/i.test(sig.inspectLine)) ||
        (sig.mechanism === "link-route-fault" && !/\bRaSocketConnect\b/i.test(sig.inspectLine)))
    ) {
      continue;
    }
    const isPeerDependentLink = sig.ruleId === "hccl-link-or-ifname-fault";
    const isGenericPeerSymptom =
      sig.mechanism === "other" &&
      (!sig.ruleId || sig.ruleId === "exit-137-sigkill" || sig.ruleId === "exit-139-sigsegv") &&
      /\b(?:peer|remote)\b/i.test(sig.inspectLine);
    const isCommPeerSymptom =
      isPeerDependentLink ||
      isGenericPeerSymptom ||
      sig.phase === "link-establish" ||
      sig.phase === "comm-init";
    if (!isCommPeerSymptom) continue;
    const peerBucket = rootPrimariesByRank.get(sig.peerRank);
    if (!peerBucket) continue;
    const peerQuery = { ...sig, hostTag: null };
    const peerSubBuckets = getDomainBucketsForLine(peerBucket, peerQuery);
    const hasSegUntimestamped = peerSubBuckets.some(
      (sub) => (sub.untimestampedBySeg.get(sig.segmentId)?.length ?? 0) > 0,
    );
    const { cutoffMid, cutoffUntsLine, cutoffAnySameSegLine, cutoffAfterUntsLine } =
      findUniversalPeerStartupCutoff(sig, sig.peerRank);
    const queryTierKey = getLifecycleTierKey(sig);
    const memoKey =
      sig.timestampMs !== null && !hasSegUntimestamped
        ? `${sig.peerRank}|${sig.rank ?? "na"}|${sig.segmentId}|${queryTierKey}|${sig.timestampMs}|${sig.timestampSubMs}|${(sig.instanceTag ?? "").toLowerCase()}|${(sig.groupTag ?? "").toLowerCase()}|${(sig.hostTag ?? "").toLowerCase()}|${cutoffMid?.lineNumber ?? -1}|${cutoffUntsLine}|${cutoffAnySameSegLine}`
        : null;
    if (memoKey !== null) {
      const memoHit = peerLookupMemo.get(memoKey);
      if (memoHit !== undefined) {
        if (memoHit) {
          sig.kind = "cascade";
          if (PEER_REFUSED_SIGNAL_RE.test(sig.inspectLine)) {
            sig.mechanism = "link-peer-refused";
          }
        }
        continue;
      }
    }

    const matchesPeerPrimary = (cand: ParsedLogLine): boolean => {
      const other = cand as ClassifiedSignal;
      if (other.lineNumber === sig.lineNumber) return false;
      if (!areScopeTagsCompatible(sig.instanceTag, other.instanceTag)) return false;
      if (!areScopeTagsCompatible(sig.groupTag, other.groupTag)) return false;
      const comparable = areTimestampsComparable(other, sig);
      if (other.segmentId !== sig.segmentId) {
        if (!comparable) return false;
        if (other.segmentId > sig.segmentId) {
          if (hasSegStartupAtOrBefore(other.segmentId, other.lineNumber, other, sig)) {
            return false;
          }
        }
      }
      if (
        !comparable &&
        sig.timestampMs !== null &&
        other.timestampMs === null &&
        other.lineNumber > sig.lineNumber
      ) {
        return false;
      }
      if (hasStartupBoundaryBetween(ctx.startupBoundaryBucket, other, sig, true)) return false;
      if (isStrictlyEarlierTimestamp(sig, other)) return false;
      return (
        other.peerRank !== sig.rank ||
        isStrictlyEarlierTimestamp(other, sig) ||
        (!comparable && compareSignalsChronologically(other, sig, peerDecJanRollover) < 0)
      );
    };
    const breakOnCutoff = (cand: ParsedLogLine): boolean => {
      if (sig.timestampMs === null && cand.segmentId < sig.segmentId) {
        return true;
      }
      if (
        cutoffMid !== null &&
        cand.timestampMs !== null &&
        areTimestampsComparable(cand, cutoffMid) &&
        compareTimestampOrder(cand, cutoffMid) < 0
      ) {
        return true;
      }
      if (
        cand.segmentId === sig.segmentId &&
        cutoffUntsLine >= 0 &&
        cand.lineNumber <= cutoffUntsLine &&
        (sig.timestampMs === null || cand.timestampMs === null || !areTimestampsComparable(cand, sig))
      ) {
        return true;
      }
      return false;
    };
    let peerPrimaryExists = someInTimedDomainBucket(
      peerBucket,
      peerQuery,
      Number.POSITIVE_INFINITY,
      0,
      Number.POSITIVE_INFINITY,
      matchesPeerPrimary,
      false,
      breakOnCutoff,
      sig.timestampMs === null
        ? {
            restrictUntimestampedToSeg: true,
            untimestampedMaxLine:
              cutoffAfterUntsLine < Number.POSITIVE_INFINITY
                ? cutoffAfterUntsLine - 1
                : Number.POSITIVE_INFINITY,
          }
        : undefined,
    );
    if (!peerPrimaryExists && sig.timestampMs !== null && hasSegUntimestamped) {
      for (const sub of peerSubBuckets) {
        const segUnts = sub.untimestampedBySeg.get(sig.segmentId);
        if (!segUnts || segUnts.length === 0) continue;
        const uPos = findRightmostTrue(segUnts, (c) => c.lineNumber < sig.lineNumber);
        for (let i = uPos; i >= 0; i -= 1) {
          const cand = segUnts[i]!;
          if (cutoffAnySameSegLine >= 0 && cand.lineNumber <= cutoffAnySameSegLine) break;
          if (matchesPeerPrimary(cand)) {
            peerPrimaryExists = true;
            break;
          }
        }
        if (peerPrimaryExists) break;
      }
    }
    if (!peerPrimaryExists) {
      for (const sub of peerSubBuckets) {
        const tierMap = getTieredSegTreeIndex(sub).bySegByTier.get(sig.segmentId);
        if (!tierMap) continue;
        for (const [cTierKey, segCross] of tierMap) {
          if (sig.timestampMs !== null && cTierKey === queryTierKey) continue;
          const pos = findRightmostTrue(segCross, (c) => c.lineNumber < sig.lineNumber);
          for (let i = pos; i >= 0; i -= 1) {
            const cand = segCross[i]!;
            if (cutoffAnySameSegLine >= 0 && cand.lineNumber <= cutoffAnySameSegLine) break;
            if (matchesPeerPrimary(cand)) {
              peerPrimaryExists = true;
              break;
            }
          }
          if (peerPrimaryExists) break;
        }
        if (peerPrimaryExists) break;
      }
    }
    if (memoKey !== null) {
      peerLookupMemo.set(memoKey, peerPrimaryExists);
    }
    if (peerPrimaryExists) {
      sig.kind = "cascade";
      if (PEER_REFUSED_SIGNAL_RE.test(sig.inspectLine)) {
        sig.mechanism = "link-peer-refused";
      }
    }
  }

  const visibleDeviceEntries = extractVisibleDevicesEntries(
    lines.map((l) => l.rawLine),
    lines,
  );
  const visCache = createVisibleDevicesCache(visibleDeviceEntries, ctx.processResetBucket);
  const domainCatalog = buildLogScopeDomainCatalog(lines, visCache);
  const selection = selectPrimaryWinner(signals, visCache, recoveredApiErrorLines, ctx.startupBoundaryBucket);
  const unrankedCrossDomainTie =
    selection.rankedWinner === null &&
    selection.anyPrimary !== null &&
    selection.primaries.some(
      (s) =>
        s.lineNumber !== selection.anyPrimary!.lineNumber &&
        (!areTimestampsComparable(selection.anyPrimary!, s) ||
          !isStrictlyEarlierTimestamp(selection.anyPrimary!, s)) &&
        !arePhysicalScopesCompatible(selection.anyPrimary!, s, visCache, ctx.startupBoundaryBucket),
    );
  const hasCrossDomainSimultaneousTie =
    selection.simultaneousCrossDomainSameRankTies.length > 0 ||
    selection.crossDomainDistinctRankTies.length > 0 ||
    unrankedCrossDomainTie ||
    (selection.anyPrimary !== null &&
      (selection.tiedCompetingRankedPrimaries.some(
        (s) => !arePhysicalScopesCompatible(selection.anyPrimary!, s, visCache, ctx.startupBoundaryBucket),
      ) ||
        selection.simultaneousDistinctRankTies.some(
          (s) => !arePhysicalScopesCompatible(selection.anyPrimary!, s, visCache, ctx.startupBoundaryBucket),
        ) ||
        selection.simultaneousUnrankedTies.some(
          (s) => !arePhysicalScopesCompatible(selection.anyPrimary!, s, visCache, ctx.startupBoundaryBucket),
        ) ||
        selection.incomparableClockDistinctRankTies.some(
          (s) => !arePhysicalScopesCompatible(selection.anyPrimary!, s, visCache, ctx.startupBoundaryBucket),
        )));
  const visTarget = hasCrossDomainSimultaneousTie ? null : (selection.rankedWinner ?? selection.anyPrimary);
  let visibleDevices: number[] | null = null;
  let hasAmbiguousVisibleDevices = false;
  if (hasCrossDomainSimultaneousTie && visCache.entries.length > 0 && selection.anyPrimary) {
    const tiePool = [
      selection.anyPrimary,
      ...selection.simultaneousCrossDomainSameRankTies,
      ...selection.crossDomainDistinctRankTies,
      ...selection.tiedCompetingRankedPrimaries,
      ...selection.simultaneousDistinctRankTies,
      ...selection.simultaneousUnrankedTies,
      ...selection.incomparableClockDistinctRankTies,
      ...(unrankedCrossDomainTie
        ? selection.primaries.filter(
            (s) =>
              s.lineNumber !== selection.anyPrimary!.lineNumber &&
              (!areTimestampsComparable(selection.anyPrimary!, s) ||
                !isStrictlyEarlierTimestamp(selection.anyPrimary!, s)),
          )
        : []),
    ];
    const shared = resolveSharedVisibleDevicesForPool(visCache, tiePool, ctx.startupBoundaryBucket);
    visibleDevices = shared.visibleDevices;
    hasAmbiguousVisibleDevices = shared.hasAmbiguousVisibleDevices;
  } else if (visTarget === null && selection.cascades.length > 0) {
    const shared = resolveSharedVisibleDevicesForPool(
      visCache,
      selection.cascades,
      ctx.startupBoundaryBucket,
    );
    visibleDevices = shared.visibleDevices;
    hasAmbiguousVisibleDevices = shared.hasAmbiguousVisibleDevices;
  } else if (hasUncoveredMultiScopeForTarget(visCache, visTarget, domainCatalog)) {
    visibleDevices = null;
    hasAmbiguousVisibleDevices = true;
  } else {
    const res = resolveVisibleDevicesForVerdict(visCache, visTarget, ctx.startupBoundaryBucket);
    visibleDevices = res.visibleDevices;
    hasAmbiguousVisibleDevices = res.hasAmbiguousVisibleDevices;
  }
  const anyHostTag = domainCatalog.distinctHosts.size > 0;
  const firstFaultVerdict = computeFirstFaultVerdict(
    signals,
    anyHostTag,
    hasAmbiguousVisibleDevices,
    visCache,
    ctx,
    recoveredApiErrorLines,
    domainCatalog,
  );
  const allMatchedLineNumbers = new Set<number>();
  const findings = evaluateRules(
    lines,
    metricScopes,
    firstFaultVerdict,
    ctx,
    lineOwnerMap,
    tracebackOwnerMap,
    signals,
    selection,
    allMatchedLineNumbers,
  );

  const matchedLineNumbers = new Set<number>(allMatchedLineNumbers);
  for (const f of findings) {
    for (const m of f.matchedLines) {
      matchedLineNumbers.add(m.lineNumber);
    }
  }

  const unmatchedErrorLines: MatchedLogLine[] = signals
    .filter((s) => !matchedLineNumbers.has(s.lineNumber))
    .slice(0, 6)
    .map((s) => formatMatchedLine(s, ctx));

  const detectedRanks = [...explicitLogicalRanks].sort((a, b) => a - b);

  let activeScopeDetectedRanks: readonly number[] | undefined;
  const resolveActiveScopeVis = (
    target: ParsedLogLine,
  ): { devices: readonly number[] | null; key: string | null; ambiguous: boolean } => {
    if (visCache.entries.length === 0) return { devices: null, key: null, ambiguous: false };
    let res = resolveVisibleDevicesForVerdict(visCache, target, ctx.startupBoundaryBucket);
    if (
      res.visibleDevices === null &&
      !res.hasAmbiguousVisibleDevices &&
      target.pid !== null &&
      (target.instanceTag !== null || target.hostTag !== null || target.groupTag !== null)
    ) {
      res = resolveVisibleDevicesForVerdict(visCache, { ...target, pid: null }, ctx.startupBoundaryBucket);
    }
    if (res.hasAmbiguousVisibleDevices) {
      return { devices: null, key: "__AMBIG__", ambiguous: true };
    }
    return {
      devices: res.visibleDevices,
      key: res.visibleDevices ? res.visibleDevices.join(",") : null,
      ambiguous: false,
    };
  };
  const activeScopeAnchor =
    visTarget !== null && !hasCrossDomainSimultaneousTie && !hasAmbiguousVisibleDevices ? visTarget : null;
  const anchorScopeVis = activeScopeAnchor ? resolveActiveScopeVis(activeScopeAnchor) : null;
  if (activeScopeAnchor !== null && anchorScopeVis && !anchorScopeVis.ambiguous) {
    const { distinctHosts, distinctInstances, distinctGroups, hasUngroupedScope } = domainCatalog;
    const distinctRawVisSigs = new Set<string>(
      visCache.entries.map((e) => (e.valid && e.devices ? e.devices.join(",") : "__INVALID__")),
    );
    const hasMultiGroupScope = distinctGroups.size > 1 || (distinctGroups.size === 1 && hasUngroupedScope);
    const hasMultiScope =
      distinctHosts.size > 1 ||
      distinctInstances.size > 1 ||
      hasMultiGroupScope ||
      distinctRawVisSigs.size > 1;
    const scopeHost = activeScopeAnchor.hostTag?.toLowerCase() ?? null;
    const scopeInst = activeScopeAnchor.instanceTag?.toLowerCase() ?? null;
    const scopeGroup = activeScopeAnchor.groupTag?.toLowerCase() ?? null;
    const hasUnattributedScopeInMulti =
      (distinctHosts.size > 1 && scopeHost === null) || (distinctInstances.size > 1 && scopeInst === null);
    if (hasMultiScope && !hasUnattributedScopeInMulti) {
      const scopeVisKey = anchorScopeVis.key;
      const scopedRankSet = new Set<number>();
      for (const l of lines) {
        if (l.isPromLine || l.trimmed.startsWith("#")) continue;
        if (
          l.rank === null ||
          l.rankSource === "device-id" ||
          l.rankSource === "worker-dp-pp" ||
          l.ambiguousTraceback ||
          ctx.ambiguousDeviceLines.has(l.lineNumber)
        ) {
          continue;
        }
        if (scopedRankSet.has(l.rank)) continue;
        const lHost = l.hostTag?.toLowerCase() ?? null;
        if (lHost !== scopeHost) continue;
        const lInst = l.instanceTag?.toLowerCase() ?? null;
        if (lInst !== scopeInst) continue;
        const lGroup = l.groupTag?.toLowerCase() ?? null;
        if (lGroup !== scopeGroup) continue;
        const lVis = resolveActiveScopeVis(l);
        if (lVis.ambiguous || lVis.key !== scopeVisKey) continue;
        if (!isVisibleMapSlotCompatible(l, lVis.devices, ctx)) continue;
        scopedRankSet.add(l.rank);
      }
      activeScopeDetectedRanks = [...scopedRankSet].sort((a, b) => a - b);
    }
  }

  return {
    inputKind,
    totalLines: nonEmptyLines.length,
    detectedRanks,
    ...(activeScopeDetectedRanks !== undefined ? { activeScopeDetectedRanks } : {}),
    visibleDevices,
    firstFaultVerdict,
    metrics,
    findings,
    unmatchedErrorLines,
  };
}
