import type { AscendCalcCardId } from "../../sim/modelspec/deployCalculator";
import type { FaultTimelineEvent, LogAnalysisReport } from "../../sim/troubleshoot/logAnalyzer";
import { CARD_TO_3D_HARDWARE_MAP, type HardwareModelMappingSpec } from "../model/hardwareDeployOverlay";

export type SlotDieVisualState =
  | "idle"
  | "participating"
  | "root-cause"
  | "confirmed-cascade"
  | "unattributed-timeout"
  | "unmapped";

export type SlotFaultMechanism =
  | "none"
  | "general-root"
  | "hccl-link-fault"
  | "hccl-link-timeout"
  | "hccl-wait-cascade"
  | "unattributed-wait";

export type LinkFaultMarkKind = "nic-bind-or-route" | "roce-port-down" | "transport-init";

export interface DerivedRankUnitState {
  readonly rank: number;
  readonly logicalRank: number | null;
  readonly physicalSlot: number;
  readonly dieIndex: number;
  readonly dieCountInSlot: 1 | 2;
  readonly label: string;
  readonly statusLabel: string;
  readonly state: SlotDieVisualState;
  readonly faultMechanism: SlotFaultMechanism;
  readonly ifaceOrPort: string | null;
  readonly evidenceLineNumber: number | null;
  readonly timestamp: string | null;
  readonly signalTag: string | null;
  readonly waitingOnRank: number | null;
}

export interface DerivedWaitingArc {
  readonly fromRank: number;
  readonly toRank: number;
  readonly lineNumber: number;
}

export interface DerivedLinkFaultMark {
  readonly rank: number;
  readonly logicalRank: number | null;
  readonly peerRank: number | null;
  readonly peerLogicalRank: number | null;
  readonly kind: LinkFaultMarkKind;
  readonly ifaceOrPort: string | null;
  readonly label: string;
  readonly lineNumber: number;
}

export interface FaultReplayStage {
  readonly index: number;
  readonly title: string;
  readonly timestamp: string | null;
  readonly focusRank: number | null;
  readonly focusLineNumber: number | null;
  readonly eventsUpToHere: readonly FaultTimelineEvent[];
}

export type HardwareFaultMappingMode = "single-node-mapped" | "single-node-schematic" | "logical-only";

export interface DerivedHardwareFaultFrame {
  readonly spec: HardwareModelMappingSpec;
  readonly mappingMode: HardwareFaultMappingMode;
  readonly mappingNote: string;
  readonly stages: readonly FaultReplayStage[];
  readonly activeStage: FaultReplayStage;
  readonly rankUnits: readonly DerivedRankUnitState[];
  readonly waitingArcs: readonly DerivedWaitingArc[];
  readonly linkFaultMarks: readonly DerivedLinkFaultMark[];
}

export const TROUBLESHOOT_3D_CARD_OPTIONS: readonly {
  readonly cardId: AscendCalcCardId;
  readonly shortLabel: string;
}[] = [
  { cardId: "a2-64g", shortLabel: "Atlas 800T A2 (8槽×1卡)" },
  { cardId: "a3-die64g", shortLabel: "Atlas 800I A3 (8槽×双Die)" },
  { cardId: "310p-24g", shortLabel: "Atlas 800 3000 (4卡×双Chip)" },
  { cardId: "950dt-128g", shortLabel: "Ascend 950DT (8槽示意)" },
];

const ROCE_PORT_DOWN_RE =
  /\bRoCE\b[^\r\n]*(?:link|port)[^\r\n]*\bdown\b|\b(?:link|port)\s*[:=#]?\s*\d*\s*(?:is\s+)?down\b[^\r\n]*\bRoCE\b/i;

const PEER_REFUSED_RE = /\bECONNREFUSED\b|Connection refused|Connection reset by peer|errno\s*[:=]?\s*111\b/i;

const NIC_BIND_OR_ROUTE_RE =
  /\bRaSocket\w*[^\r\n]*(?:fail|error|err\b|unreachable|timeout|timed?\s+out|cannot\s+assign)|\b(?:bind|connect)\s+(?:failed|error)\b[^\r\n]*\bRaSocket\b|\b(?:EADDRNOTAVAIL|ENETUNREACH)\b|Cannot assign requested address|No route to host|(?:HCCL_SOCKET_IFNAME|HCCL_IF_IP)\b[^\r\n]*(?:bind|connect|fail|error|invalid|not\s+found|no\s+such|mismatch|unreachable|cannot|unable)|(?:bind|connect|failed|error|invalid|no\s+available\s+interface|network\s+interface)[^\r\n]*(?:HCCL_SOCKET_IFNAME|HCCL_IF_IP)\b/i;

const TRANSPORT_INIT_RE = /\b(?:EI0004|EI0009|EJ0001)\b/i;

const LINK_ESTABLISH_TIMEOUT_RE =
  /(?:Getting\s+socket\s+times\s+out|\[Wait\]\[LinkEstablish\]|socket\s+link\s+establish)/i;

const HOST_TAG_INLINE_RE =
  /\[\s*(node[-_][A-Za-z0-9_.:-]+|host[-_\s][A-Za-z0-9_.:-]+|(?:prefill|decode)[-_\s]node)\s*\]|(?<!\b(?:remote|peer|target|dst|src|from|to)\s+)\bhost(?:name)?\s*[:=]\s*['"]?([A-Za-z0-9_.:-]+)['"]?/i;

const INSTANCE_TAG_INLINE_RE =
  /\binstance(?:_id)?\s*[:=]\s*['"]?([A-Za-z0-9_.:-]+)['"]?|\[\s*instance\s+([A-Za-z0-9_.:-]+)\s*\]/i;

const GROUP_TAG_INLINE_RE =
  /\b(?:group|worker_group|svc|service|role)(?:_id|_name)?\s*[:=]\s*['"]?([A-Za-z0-9_.:-]+)['"]?|\[\s*(?:group|role)\s+([A-Za-z0-9_.:-]+)\s*\]/i;

const IFACE_IFNAME_RE = /\bHCCL_SOCKET_IFNAME\s*[:=]\s*['"]?([A-Za-z][A-Za-z0-9_.:-]{1,24})['"]?/i;
const ROCE_PORT_NUM_RE =
  /\bRoCE\b[^\r\n]{0,32}?\b(?:port|link)\s*[:=#]?\s*(\d+)\b|\bport\s*[:=#]?\s*(\d+)\b[^\r\n]{0,32}\bRoCE\b/i;
const EXPLICIT_IFACE_KV_RE =
  /\b(?:ifname|iface|interface|nic|netdev)\s*[:=]\s*['"]?([A-Za-z][A-Za-z0-9_.:-]{1,24})['"]?/i;
const LINUX_NIC_NAME_RE =
  /\b(enp\d+s\d+(?:f\d+)?(?:np\d+)?|eth\d+|ens\d+(?:f\d+)?|eno\d+(?:np\d+)?|bond\d+(?:\.\d+)?|hns\d+|roce\d+)\b/;

interface ClassifiedEventMechanism {
  readonly isLinkFault: boolean;
  readonly isLinkTimeout: boolean;
  readonly isPeerRefused: boolean;
  readonly linkKind: LinkFaultMarkKind;
  readonly ifaceOrPort: string | null;
  readonly mechKey: string;
}

const PID_INLINE_RE = /\bpid=(\d+)\b|\b(?:RUNTIME|HCCL|ASCENDCL|GE|DRV)\((\d+),/i;

function extractRawLinePid(rawLine: string): number | null {
  const m = PID_INLINE_RE.exec(rawLine);
  const raw = m?.[1] ?? m?.[2];
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) ? n : null;
}

function extractEventHostTag(ev: FaultTimelineEvent): string | null {
  if (ev.hostTag === null) return null;
  if (typeof ev.hostTag === "string") {
    const trimmed = ev.hostTag.trim();
    return trimmed.length > 0 ? trimmed.toLowerCase() : null;
  }
  const m = HOST_TAG_INLINE_RE.exec(sliceStructuredHeaderForScope(ev.rawLine));
  const raw = (m?.[1] ?? m?.[2] ?? "").trim();
  return raw ? raw.toLowerCase() : null;
}

function extractEventHostDisplayTag(ev: FaultTimelineEvent): string | null {
  if (ev.hostTag === null) return null;
  if (typeof ev.hostTag === "string") {
    const trimmed = ev.hostTag.trim();
    return trimmed || null;
  }
  const m = HOST_TAG_INLINE_RE.exec(sliceStructuredHeaderForScope(ev.rawLine));
  const raw = (m?.[1] ?? m?.[2] ?? "").trim();
  return raw || null;
}

const LEADING_SCOPE_HEADER_STEP_RE =
  /^\s*(?:\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?|\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:[.,]\d+)?|\d{2}:\d{2}:\d{2}(?:[.,]\d+)?|\[\s*(?:Rank\b|rank\b|RANK\b|RankID\b|(?:node|host)[-_:\s]|(?:prefill|decode)[-_\s]node\b|instance\b|group\b|role\b|INFO\b|WARN(?:ING)?\b|ERROR\b|CRITICAL\b|FATAL\b|DEBUG\b|[IWEF]\d{3,4}\b|\d{2,4}[-/:])[^\]\r\n]{0,80}\]:?|\((?:Worker|VllmWorker|EngineCore|APIServer|MainProcess|PID\s*[:=]|Rank\b|rank\b)[^)\r\n]{0,96}\):?|(?:host(?:name)?|node(?:_name)?|instance(?:_id)?|group(?:_id|_name)?|worker_group|svc|service|role|pid|rank|local_rank|global_rank)\s*[:=]\s*['"]?[A-Za-z0-9_.:-]+['"]?|(?:host|node)[-_][A-Za-z0-9_.:-]+:?)/i;

function sliceStructuredHeaderForScope(rawLine: string): string {
  const probe = rawLine.slice(0, 512);
  let consumed = 0;
  let steps = 0;
  while (consumed < probe.length && steps < 16) {
    const m = LEADING_SCOPE_HEADER_STEP_RE.exec(probe.slice(consumed));
    if (!m || m[0].length === 0) break;
    consumed += m[0].length;
    steps += 1;
  }
  return probe.slice(0, consumed);
}

function extractRawLineInstanceTag(rawLine: string): string | null {
  const m = INSTANCE_TAG_INLINE_RE.exec(sliceStructuredHeaderForScope(rawLine));
  const raw = (m?.[1] ?? m?.[2] ?? "").trim();
  return raw ? raw.toLowerCase() : null;
}

function extractEventInstanceTag(ev: FaultTimelineEvent): string | null {
  const ext = ev as { instanceTag?: string | null | undefined };
  if (ext.instanceTag === null) return null;
  if (typeof ext.instanceTag === "string") {
    const trimmed = ext.instanceTag.trim();
    return trimmed.length > 0 ? trimmed.toLowerCase() : null;
  }
  return extractRawLineInstanceTag(ev.rawLine);
}

function extractRawLineGroupTag(rawLine: string): string | null {
  const m = GROUP_TAG_INLINE_RE.exec(sliceStructuredHeaderForScope(rawLine));
  const raw = (m?.[1] ?? m?.[2] ?? "").trim();
  return raw ? raw.toLowerCase() : null;
}

function extractEventGroupTag(ev: FaultTimelineEvent): string | null {
  const ext = ev as { groupTag?: string | null | undefined };
  if (ext.groupTag === null) return null;
  if (typeof ext.groupTag === "string") {
    const trimmed = ext.groupTag.trim();
    return trimmed.length > 0 ? trimmed.toLowerCase() : null;
  }
  return extractRawLineGroupTag(ev.rawLine);
}

function isPhysicallyMappableEvent(ev: FaultTimelineEvent): boolean {
  return (
    ev.slotMappable === true &&
    ev.rank !== null &&
    ev.rankSource !== "device-id" &&
    ev.rankSource !== "worker-dp-pp"
  );
}

function isGenericWrapperRootEvent(ev: FaultTimelineEvent): boolean {
  if (ev.kind !== "root-cause") return false;
  if (ev.ruleId === "python-runtime-error" || ev.ruleId === "cann-runtime-generic-code") {
    return true;
  }
  if (!ev.mechanism && !ev.ruleId) {
    const combined = `${ev.signalTag} ${ev.rawLine}`;
    if (
      /\b(?:NPU out of memory|OutOfMemory|OOM|EI0004|EI0009|EJ0001|RoCE|RaSocket|No route|507\d{3}|161\d{3}|aclnn|exitcode|SIGKILL)\b/i.test(
        combined,
      )
    ) {
      return false;
    }
    return /\b(?:RuntimeError|wrapper|Exception|Engine core)\b/i.test(combined);
  }
  return false;
}

const DIAGNOSTIC_ADVICE_SPLIT_RE =
  /(?:[.;]\s*(?:verify|check|confirm|ensure|note)\b|\b(?:verify|check|confirm|ensure)\s+whether\b|\bdistinct\s+from\b|\bdo\s+not\s+confuse\b|\(\s*(?:note|check|verify)\s*:)/i;
const BIND_OR_ROUTE_CLAUSE_RE =
  /\b(?:bind|RaSocketBind|route|unreachable|EADDRNOTAVAIL|ENETUNREACH|EADDRINUSE)\b/i;

function extractIfaceOrPort(rawLine: string): string | null {
  const primaryClause = rawLine.split(DIAGNOSTIC_ADVICE_SPLIT_RE)[0]?.trim() ?? "";
  const clause = primaryClause.length > 0 ? primaryClause : rawLine;
  const ifnameMatch = IFACE_IFNAME_RE.exec(clause);
  if (ifnameMatch?.[1] && !ifnameMatch[1].startsWith("<")) {
    return ifnameMatch[1];
  }
  const kvMatch = EXPLICIT_IFACE_KV_RE.exec(clause);
  if (kvMatch?.[1] && !kvMatch[1].startsWith("<")) {
    return kvMatch[1];
  }
  const preferNicOverRoce =
    BIND_OR_ROUTE_CLAUSE_RE.test(clause) && !/\bRoCE\s+port\s+\d+\s+(?:link\s+)?down\b/i.test(clause);
  if (preferNicOverRoce) {
    const nicMatch = LINUX_NIC_NAME_RE.exec(clause);
    if (nicMatch?.[1]) {
      return nicMatch[1];
    }
  }
  const roceMatch = ROCE_PORT_NUM_RE.exec(clause);
  const rocePortNum = roceMatch?.[1] ?? roceMatch?.[2];
  if (rocePortNum !== undefined) {
    return `RoCE port ${rocePortNum}`;
  }
  if (!preferNicOverRoce) {
    const nicMatch = LINUX_NIC_NAME_RE.exec(clause);
    if (nicMatch?.[1]) {
      return nicMatch[1];
    }
  }
  const portMatch = /\bport\s*[:=#]?\s*(\d+)\b/i.exec(clause);
  if (portMatch?.[1]) {
    return `Port ${portMatch[1]}`;
  }
  return null;
}

function resolveEventIfaceOrPort(ev: FaultTimelineEvent): string | null {
  const ext = ev as {
    ifaceOrPort?: string | null | undefined;
    iface?: string | null | undefined;
    port?: string | null | undefined;
  };
  if (typeof ext.ifaceOrPort === "string" && ext.ifaceOrPort.trim().length > 0) {
    return ext.ifaceOrPort.trim();
  }
  const rawIface = typeof ext.iface === "string" && ext.iface.trim().length > 0 ? ext.iface.trim() : null;
  const rawPort = typeof ext.port === "string" && ext.port.trim().length > 0 ? ext.port.trim() : null;
  const isRoceContext =
    (rawIface !== null && /^roce$/i.test(rawIface)) ||
    /\bRoCE\b/i.test(`${ev.signalTag} ${ev.rawLine}`) ||
    ev.mechanism === "link-port-down";

  if (rawPort !== null) {
    if (rawIface !== null && !/^roce$/i.test(rawIface)) {
      return `${rawIface} port ${rawPort}`;
    }
    return isRoceContext ? `RoCE port ${rawPort}` : `Port ${rawPort}`;
  }
  if (rawIface !== null && !/^roce$/i.test(rawIface)) {
    return rawIface;
  }
  return extractIfaceOrPort(ev.rawLine);
}

const HCCL_LINK_MECHANISMS: ReadonlySet<string> = new Set([
  "link-bind-fault",
  "link-route-fault",
  "link-port-down",
  "link-transport-init",
]);

function classifyEventFaultMechanism(ev: FaultTimelineEvent): ClassifiedEventMechanism {
  const ext = ev as {
    faultMechanism?: string | undefined;
    mechanism?: string | undefined;
    ruleId?: string | undefined;
    phase?: string | undefined;
  };
  const rawFaultMech = ext.faultMechanism;
  const combined = `${ev.signalTag} ${ev.rawLine}`;
  const ifaceOrPort = resolveEventIfaceOrPort(ev);
  const hasAnalyzerMeta = ext.mechanism !== undefined || ext.ruleId !== undefined;

  if (ext.mechanism === "link-peer-refused" || (!hasAnalyzerMeta && PEER_REFUSED_RE.test(combined))) {
    return {
      isLinkFault: false,
      isLinkTimeout: true,
      isPeerRefused: true,
      linkKind: "nic-bind-or-route",
      ifaceOrPort,
      mechKey: "link-peer-refused",
    };
  }

  if (ev.kind !== "root-cause") {
    const isLinkTimeout =
      ext.mechanism === "link-establish-timeout" ||
      rawFaultMech === "hccl-link-timeout" ||
      (!hasAnalyzerMeta && /\bEI0006\b/i.test(combined) && LINK_ESTABLISH_TIMEOUT_RE.test(combined));
    return {
      isLinkFault: false,
      isLinkTimeout,
      isPeerRefused: false,
      linkKind: "nic-bind-or-route",
      ifaceOrPort: isLinkTimeout ? ifaceOrPort : null,
      mechKey: ext.mechanism ?? (isLinkTimeout ? "hccl-link-timeout" : "default"),
    };
  }

  if (hasAnalyzerMeta) {
    const isExplicitNonLinkMechanism =
      ext.mechanism !== undefined && ext.mechanism !== "other" && !HCCL_LINK_MECHANISMS.has(ext.mechanism);
    const isHcclLinkRule =
      !isExplicitNonLinkMechanism &&
      (ext.ruleId === "hccl-link-or-ifname-fault" ||
        (ext.mechanism !== undefined && HCCL_LINK_MECHANISMS.has(ext.mechanism)));
    if (!isHcclLinkRule) {
      return {
        isLinkFault: false,
        isLinkTimeout: false,
        isPeerRefused: false,
        linkKind: "nic-bind-or-route",
        ifaceOrPort: null,
        mechKey: ext.mechanism ?? ext.ruleId ?? "default",
      };
    }
    let linkKind: LinkFaultMarkKind = "nic-bind-or-route";
    if (ext.mechanism === "link-transport-init") {
      linkKind = "transport-init";
    } else if (ext.mechanism === "link-port-down") {
      linkKind = "roce-port-down";
    } else if (ext.mechanism === "link-bind-fault" || ext.mechanism === "link-route-fault") {
      linkKind = "nic-bind-or-route";
    } else if (TRANSPORT_INIT_RE.test(combined) || /\btransport\s+init\b/i.test(combined)) {
      linkKind = "transport-init";
    } else if (ROCE_PORT_DOWN_RE.test(combined)) {
      linkKind = "roce-port-down";
    } else if (ext.phase === "comm-init") {
      linkKind = "transport-init";
    }
    return {
      isLinkFault: true,
      isLinkTimeout: false,
      isPeerRefused: false,
      linkKind,
      ifaceOrPort,
      mechKey: ext.mechanism ?? linkKind,
    };
  }

  if (rawFaultMech === "general" || rawFaultMech === "hccl-wait-cascade") {
    return {
      isLinkFault: false,
      isLinkTimeout: false,
      isPeerRefused: false,
      linkKind: "nic-bind-or-route",
      ifaceOrPort: null,
      mechKey: "default",
    };
  }
  if (rawFaultMech === "hccl-link-timeout") {
    return {
      isLinkFault: false,
      isLinkTimeout: true,
      isPeerRefused: false,
      linkKind: "nic-bind-or-route",
      ifaceOrPort,
      mechKey: "hccl-link-timeout",
    };
  }
  if (ROCE_PORT_DOWN_RE.test(combined)) {
    return {
      isLinkFault: true,
      isLinkTimeout: false,
      isPeerRefused: false,
      linkKind: "roce-port-down",
      ifaceOrPort,
      mechKey: "roce-port-down",
    };
  }
  if (TRANSPORT_INIT_RE.test(combined) || /\btransport\s+init\b/i.test(combined)) {
    return {
      isLinkFault: true,
      isLinkTimeout: false,
      isPeerRefused: false,
      linkKind: "transport-init",
      ifaceOrPort,
      mechKey: "transport-init",
    };
  }
  if (NIC_BIND_OR_ROUTE_RE.test(combined)) {
    return {
      isLinkFault: true,
      isLinkTimeout: false,
      isPeerRefused: false,
      linkKind: "nic-bind-or-route",
      ifaceOrPort,
      mechKey: "nic-bind-or-route",
    };
  }
  if (rawFaultMech === "hccl-link" || rawFaultMech === "hccl-link-fault") {
    return {
      isLinkFault: true,
      isLinkTimeout: false,
      isPeerRefused: false,
      linkKind: "nic-bind-or-route",
      ifaceOrPort,
      mechKey: "hccl-link-fault",
    };
  }
  return {
    isLinkFault: false,
    isLinkTimeout: false,
    isPeerRefused: false,
    linkKind: "nic-bind-or-route",
    ifaceOrPort: null,
    mechKey: "default",
  };
}

function formatLinkFaultStatusLabel(
  kind: LinkFaultMarkKind,
  ifaceOrPort: string | null,
  lineNumber: number,
  peerLogicalRank: number | null = null,
): string {
  const details = [ifaceOrPort, peerLogicalRank !== null ? `对端 Rank ${peerLogicalRank}` : null].filter(
    Boolean,
  );
  const suffix = details.length > 0 ? ` (${details.join(" → ")})` : "";
  if (kind === "roce-port-down") {
    return `RoCE 端口掉链${suffix} · L${lineNumber}`;
  }
  if (kind === "transport-init") {
    return `HCCL 传输初始化故障${suffix} · L${lineNumber}`;
  }
  return `网卡/路由建链故障${suffix} · L${lineNumber}`;
}

function compressEventsByRankAndKind(
  events: readonly FaultTimelineEvent[],
  primaryLines: ReadonlySet<number> = new Set(),
  winningLine: number | null = null,
): FaultTimelineEvent[] {
  const bestIdxByKey = new Map<string, number>();
  const superseded = new Set<number>();
  for (let idx = 0; idx < events.length; idx += 1) {
    const ev = events[idx]!;
    const classified = classifyEventFaultMechanism(ev);
    const hostKey = extractEventHostTag(ev) ?? "";
    const instanceKey = extractEventInstanceTag(ev) ?? "";
    const groupKey = extractEventGroupTag(ev) ?? "";
    const mappableKey = isPhysicallyMappableEvent(ev) ? "1" : "0";
    const ifacePart = classified.ifaceOrPort ?? [ev.iface ?? "", ev.port ?? ""].filter(Boolean).join(":");
    const peerPart = ev.peerRank !== null && ev.peerRank !== undefined ? `peer-${ev.peerRank}` : "";
    const rankKey =
      ev.rankSource === "worker-dp-pp"
        ? `dp-${ev.rank ?? ev.lineNumber}`
        : ev.rankSource === "device-id"
          ? `dev-${ev.rank ?? ev.lineNumber}`
          : (ev.rank ?? `line-${ev.lineNumber}`);
    const key = `${hostKey}:${instanceKey}:${groupKey}:${mappableKey}:${rankKey}:${ev.kind}:${classified.mechKey}:${ifacePart}:${peerPart}`;
    const prevIdx = bestIdxByKey.get(key);
    if (prevIdx !== undefined) {
      const prevEv = events[prevIdx]!;
      const prevIsWin = winningLine !== null && prevEv.lineNumber === winningLine;
      const curIsWin = winningLine !== null && ev.lineNumber === winningLine;
      const prevIsPrimary = primaryLines.has(prevEv.lineNumber);
      const curIsPrimary = primaryLines.has(ev.lineNumber);
      if ((curIsWin && !prevIsWin) || (!prevIsWin && curIsPrimary && !prevIsPrimary)) {
        superseded.add(prevIdx);
        bestIdxByKey.set(key, idx);
      } else {
        superseded.add(idx);
      }
      continue;
    }
    bestIdxByKey.set(key, idx);
  }
  return events.filter((_, idx) => !superseded.has(idx));
}

export function buildFaultReplayStages(report: LogAnalysisReport): FaultReplayStage[] {
  const rawEvents = report.firstFaultVerdict.timelineEvents ?? [];
  const primaryLines = new Set(report.firstFaultVerdict.primaryEvidenceLines.map((l) => l.lineNumber));
  const winningLine = report.firstFaultVerdict.primaryEvidenceLines[0]?.lineNumber ?? null;
  const milestones = compressEventsByRankAndKind(rawEvents, primaryLines, winningLine);
  const mappableRawRanks = new Set<number>(
    rawEvents.filter(isPhysicallyMappableEvent).map((e) => e.rank as number),
  );
  const unmappableOnlyRawRanks = new Set<number>(
    rawEvents
      .filter(
        (e) =>
          e.rank !== null &&
          e.rankSource !== "device-id" &&
          e.rankSource !== "worker-dp-pp" &&
          !mappableRawRanks.has(e.rank),
      )
      .map((e) => e.rank as number),
  );
  const stageDetectedRanks = Array.isArray(report.activeScopeDetectedRanks)
    ? [...report.activeScopeDetectedRanks]
    : report.detectedRanks.filter((r) => !unmappableOnlyRawRanks.has(r));
  const participatingLabel =
    stageDetectedRanks.length > 0 ? `Rank ${stageDetectedRanks.join(", ")} 参与运行` : "未识别单卡 Rank 前缀";

  const stages: FaultReplayStage[] = [
    {
      index: 0,
      title: `首帧 · 整机就绪（${participatingLabel}）`,
      timestamp: null,
      focusRank: null,
      focusLineNumber: null,
      eventsUpToHere: [],
    },
  ];

  for (let i = 0; i < milestones.length; i++) {
    const ev = milestones[i]!;
    const mech = classifyEventFaultMechanism(ev);
    const roleText = mech.isPeerRefused
      ? ev.peerRank !== null && ev.peerRank !== undefined
        ? `观测到对端 Rank ${ev.peerRank} 连接拒绝/失联`
        : "观测到建链拒连（对端待核）"
      : mech.isLinkFault
        ? mech.linkKind === "transport-init"
          ? "触发传输/Ranktable 初始化故障"
          : "触发网卡/链路故障"
        : mech.isLinkTimeout
          ? "观测到建链超时（对端/路由待核）"
          : ev.kind === "root-cause"
            ? "触发主故障"
            : ev.kind === "confirmed-cascade"
              ? "进入次生等待超时"
              : ev.kind === "pre-existing-timeout"
                ? "前序独立超时（非晚发错误引起）"
                : "观测到等待超时（时序或首错待确认）";
    const hostDisplay = extractEventHostDisplayTag(ev);
    const instDisplay = extractEventInstanceTag(ev);
    const scopeParts: string[] = [];
    if (hostDisplay) scopeParts.push(hostDisplay);
    if (instDisplay) scopeParts.push(`instance=${instDisplay}`);
    const scopePrefix = scopeParts.length > 0 ? `[${scopeParts.join(" · ")}] ` : "";
    const rankText =
      ev.rankSource === "worker-dp-pp"
        ? `协调进程 DP${ev.rank ?? 0}（非卡号）`
        : ev.rankSource === "device-id"
          ? `Device ${ev.rank ?? "?"}（未映射卡槽）`
          : ev.rank !== null
            ? `Rank ${ev.rank}`
            : "无 Rank 前缀";
    const tsText = ev.timestamp ? `${ev.timestamp} · ` : "";
    stages.push({
      index: i + 1,
      title: `${tsText}L${ev.lineNumber} ${scopePrefix}${rankText} ${roleText}（${ev.signalTag}）`,
      timestamp: ev.timestamp,
      focusRank: isPhysicallyMappableEvent(ev) ? ev.rank : null,
      focusLineNumber: ev.lineNumber,
      eventsUpToHere: milestones.slice(0, i + 1),
    });
  }

  return stages;
}

export function deriveHardwareFaultFrame(
  report: LogAnalysisReport,
  cardId: AscendCalcCardId,
  requestedStepIndex: number,
): DerivedHardwareFaultFrame {
  const spec = CARD_TO_3D_HARDWARE_MAP[cardId] ?? CARD_TO_3D_HARDWARE_MAP["a2-64g"];
  const stages = buildFaultReplayStages(report);
  const clampedIdx = Math.max(0, Math.min(stages.length - 1, Math.trunc(requestedStepIndex)));

  const verdict = report.firstFaultVerdict;
  const visDevs = report.visibleDevices ?? null;
  const allEvents = verdict.timelineEvents ?? [];

  const pidToInstance = new Map<number, string | "ambiguous">();
  const pidToGroup = new Map<number, string | "ambiguous">();
  const pidToHost = new Map<number, string | "ambiguous">();
  const recordPidScope = (
    pid: number | null,
    inst: string | null,
    group: string | null,
    host: string | null,
  ): void => {
    if (pid === null) return;
    if (inst) {
      const prev = pidToInstance.get(pid);
      if (prev === undefined) pidToInstance.set(pid, inst);
      else if (prev !== inst) pidToInstance.set(pid, "ambiguous");
    }
    if (group) {
      const prev = pidToGroup.get(pid);
      if (prev === undefined) pidToGroup.set(pid, group);
      else if (prev !== group) pidToGroup.set(pid, "ambiguous");
    }
    if (host) {
      const prev = pidToHost.get(pid);
      if (prev === undefined) pidToHost.set(pid, host);
      else if (prev !== host) pidToHost.set(pid, "ambiguous");
    }
  };
  const eventLineSet = new Set<number>(allEvents.map((ev) => ev.lineNumber));
  for (const ev of allEvents) {
    recordPidScope(
      extractRawLinePid(ev.rawLine),
      extractEventInstanceTag(ev),
      extractEventGroupTag(ev),
      extractEventHostTag(ev),
    );
  }
  for (const line of [
    ...verdict.primaryEvidenceLines,
    ...report.findings.flatMap((f) => f.matchedLines),
    ...report.unmatchedErrorLines,
  ]) {
    if (eventLineSet.has(line.lineNumber)) continue;
    const headerOnly = sliceStructuredHeaderForScope(line.rawLine);
    const pid = extractRawLinePid(headerOnly);
    const inst = extractRawLineInstanceTag(line.rawLine);
    const group = extractRawLineGroupTag(line.rawLine);
    const hm = HOST_TAG_INLINE_RE.exec(headerOnly);
    const host = (hm?.[1] ?? hm?.[2] ?? "").trim().toLowerCase() || null;
    recordPidScope(pid, inst, group, host);
  }

  const resolveEffectiveInstanceTag = (ev: FaultTimelineEvent): string | null => {
    const direct = extractEventInstanceTag(ev);
    if (direct) return direct;
    const pid = extractRawLinePid(ev.rawLine);
    if (pid === null) return null;
    const mapped = pidToInstance.get(pid);
    return mapped && mapped !== "ambiguous" ? mapped : null;
  };
  const resolveEffectiveGroupTag = (ev: FaultTimelineEvent): string | null => {
    const direct = extractEventGroupTag(ev);
    if (direct) return direct;
    const pid = extractRawLinePid(ev.rawLine);
    if (pid === null) return null;
    const mapped = pidToGroup.get(pid);
    return mapped && mapped !== "ambiguous" ? mapped : null;
  };
  const resolveEffectiveHostTag = (ev: FaultTimelineEvent): string | null => {
    const direct = extractEventHostTag(ev);
    if (direct) return direct;
    const pid = extractRawLinePid(ev.rawLine);
    if (pid === null) return null;
    const mapped = pidToHost.get(pid);
    return mapped && mapped !== "ambiguous" ? mapped : null;
  };

  const hostTags = new Set<string>();
  const instanceTags = new Set<string>();
  const groupTags = new Set<string>();
  if (typeof verdict.hostTag === "string" && verdict.hostTag.trim().length > 0) {
    hostTags.add(verdict.hostTag.trim().toLowerCase());
  }
  for (const h of pidToHost.values()) {
    if (h !== "ambiguous") hostTags.add(h);
  }
  for (const inst of pidToInstance.values()) {
    if (inst !== "ambiguous") instanceTags.add(inst);
  }
  for (const g of pidToGroup.values()) {
    if (g !== "ambiguous") groupTags.add(g);
  }
  for (const ev of allEvents) {
    const h = resolveEffectiveHostTag(ev);
    if (h) hostTags.add(h);
    const inst = resolveEffectiveInstanceTag(ev);
    if (inst) instanceTags.add(inst);
    const g = resolveEffectiveGroupTag(ev);
    if (g) groupTags.add(g);
  }

  const winningLineNumber = verdict.primaryEvidenceLines[0]?.lineNumber ?? null;
  const winnerEv =
    (winningLineNumber !== null ? allEvents.find((e) => e.lineNumber === winningLineNumber) : undefined) ??
    (verdict.rank !== null
      ? allEvents.find((e) => e.kind === "root-cause" && e.rank === verdict.rank)
      : undefined);

  const winnerHostTag =
    (typeof verdict.hostTag === "string" && verdict.hostTag.trim().length > 0
      ? verdict.hostTag.trim().toLowerCase()
      : null) ?? (winnerEv ? resolveEffectiveHostTag(winnerEv) : null);
  const winnerInstanceTag = winnerEv ? resolveEffectiveInstanceTag(winnerEv) : null;
  const winnerGroupTag = winnerEv ? resolveEffectiveGroupTag(winnerEv) : null;

  const isEventInActiveChassisScope = (ev: FaultTimelineEvent): boolean => {
    if (!isPhysicallyMappableEvent(ev)) return false;
    if (hostTags.size > 1) return false;
    const evHost = resolveEffectiveHostTag(ev);
    if (winnerHostTag !== null && evHost !== null && evHost !== winnerHostTag) return false;
    if (instanceTags.size > 1) {
      if (visDevs === null || winnerInstanceTag === null) return false;
      const evInst = resolveEffectiveInstanceTag(ev);
      if (evInst !== winnerInstanceTag) return false;
    }
    if (groupTags.size > 1) {
      if (visDevs === null || winnerGroupTag === null) return false;
      const evGroup = resolveEffectiveGroupTag(ev);
      if (evGroup !== winnerGroupTag) return false;
    } else if (groupTags.size === 1) {
      const evGroup = resolveEffectiveGroupTag(ev);
      if (evGroup !== winnerGroupTag) return false;
    }
    return true;
  };

  const mappableScopeEvents = allEvents.filter(isEventInActiveChassisScope);
  const mappableEventRanks = new Set<number>();
  for (const ev of mappableScopeEvents) {
    if (ev.rank !== null) mappableEventRanks.add(ev.rank);
  }
  const unmappableOnlyRanks = new Set<number>();
  for (const ev of allEvents) {
    if (
      ev.rank !== null &&
      ev.rankSource !== "device-id" &&
      ev.rankSource !== "worker-dp-pp" &&
      !mappableEventRanks.has(ev.rank)
    ) {
      unmappableOnlyRanks.add(ev.rank);
    }
  }

  const hasMappableScopeEvent = mappableScopeEvents.length > 0;
  const hasForeignInstanceScope =
    visDevs !== null &&
    ((instanceTags.size > 1 && winnerInstanceTag !== null) ||
      (groupTags.size > 1 && winnerGroupTag !== null));
  const hasScopedReady = Array.isArray(report.activeScopeDetectedRanks);
  const mappableDetectedRanks = hasScopedReady
    ? [...report.activeScopeDetectedRanks!]
    : report.detectedRanks.filter((r) => !unmappableOnlyRanks.has(r));
  const scopedReadyRanks = (
    report as {
      scopedDetectedRanks?: readonly {
        rank: number;
        instanceTag?: string | null;
        groupTag?: string | null;
        hostTag?: string | null;
      }[];
    }
  ).scopedDetectedRanks;
  if (Array.isArray(scopedReadyRanks)) {
    for (const entry of scopedReadyRanks) {
      if (typeof entry.rank !== "number" || !Number.isInteger(entry.rank) || entry.rank < 0) continue;
      if (winnerHostTag && entry.hostTag && entry.hostTag.trim().toLowerCase() !== winnerHostTag) continue;
      if (
        instanceTags.size > 1 &&
        winnerInstanceTag &&
        entry.instanceTag?.trim().toLowerCase() !== winnerInstanceTag
      ) {
        continue;
      }
      if (groupTags.size > 1 && winnerGroupTag && entry.groupTag?.trim().toLowerCase() !== winnerGroupTag) {
        continue;
      }
      if (!mappableDetectedRanks.includes(entry.rank)) mappableDetectedRanks.push(entry.rank);
    }
  }
  const observedMappableRanks = new Set<number>([...mappableDetectedRanks, ...mappableEventRanks]);
  const effectiveRanks = [...observedMappableRanks].sort((a, b) => a - b);
  const maxRank = effectiveRanks.length > 0 ? Math.max(...effectiveRanks) : -1;

  if (stages[0]) {
    const syncedParticipatingLabel =
      effectiveRanks.length > 0 ? `Rank ${effectiveRanks.join(", ")} 参与运行` : "未识别单卡 Rank 前缀";
    stages[0] = {
      ...stages[0],
      title: `首帧 · 整机就绪（${syncedParticipatingLabel}）`,
    };
  }
  const activeStage = stages[clampedIdx]!;

  const hasValidExplicitVisMap =
    visDevs !== null &&
    maxRank >= 0 &&
    maxRank < visDevs.length &&
    visDevs.every((d) => d >= 0 && d < spec.ranksPerNode);
  const visExceedsNode =
    visDevs !== null && (maxRank >= visDevs.length || visDevs.some((d) => d < 0 || d >= spec.ranksPerNode));

  const exceedsNode = visDevs !== null ? visExceedsNode : maxRank >= spec.ranksPerNode;
  const workerEvents = allEvents.filter((e) => e.rankSource !== "worker-dp-pp");
  const ambiguousProvenance =
    (verdict.rank !== null && verdict.slotMappable === false) ||
    hostTags.size > 1 ||
    (instanceTags.size > 1 && (visDevs === null || winnerInstanceTag === null)) ||
    (groupTags.size > 1 && (visDevs === null || winnerGroupTag === null)) ||
    (verdict.rank === null && workerEvents.length > 0 && !hasMappableScopeEvent) ||
    (allEvents.length > 0 && !hasMappableScopeEvent);

  const canMap = effectiveRanks.length > 0 && !exceedsNode && !ambiguousProvenance;
  const mappingMode: HardwareFaultMappingMode = !canMap
    ? "logical-only"
    : hasValidExplicitVisMap
      ? "single-node-mapped"
      : "single-node-schematic";

  const mappingNote =
    mappingMode === "single-node-mapped" && visDevs !== null
      ? hasForeignInstanceScope
        ? `${spec.hardwareDisplayName} 物理映射（仅按主裁决所属 ${winnerInstanceTag ? `instance=${winnerInstanceTag}` : `group=${winnerGroupTag}`} 的 ASCEND_RT_VISIBLE_DEVICES=${visDevs.join(",")} 对齐物理槽位；其余实例事件保留在右侧时间轴）`
        : `${spec.hardwareDisplayName} 物理映射（已按 ASCEND_RT_VISIBLE_DEVICES=${visDevs.join(",")} 将逻辑 Rank 对齐物理槽位）`
      : mappingMode === "single-node-schematic"
        ? `${spec.hardwareDisplayName} 默认示意映射（日志未含 ASCEND_RT_VISIBLE_DEVICES，暂按 0..${spec.ranksPerNode - 1} 顺序示意；若做过卡号重映射请以物理卡号为准）`
        : exceedsNode
          ? visDevs !== null
            ? `ASCEND_RT_VISIBLE_DEVICES=${visDevs.join(",")} 或 Rank ${maxRank} 超出单台 ${spec.hardwareDisplayName} 的 ${spec.ranksPerNode} 卡范围；整机槽位保持中性。`
            : `日志出现 Rank ${maxRank}，超出单台 ${spec.hardwareDisplayName} 的 ${spec.ranksPerNode} 卡上限；整机槽位保持中性，不强行折算单机槽号。`
          : ambiguousProvenance
            ? "日志含多节点/多实例冲突或仅含底层 device/DP 编号，不足以唯一证明单机物理槽位归属；整机保持中性，仅展示逻辑证据链。"
            : "当前日志未提取到明确的 Rank 编号，整机保持中性展示。";

  // Map logical Rank -> hardware unit index [0..ranksPerNode-1]
  const logicalToUnit = new Map<number, number>();
  const unitToLogical = new Map<number, number>();
  if (canMap) {
    if (hasValidExplicitVisMap && visDevs !== null) {
      for (let lr = 0; lr < visDevs.length; lr++) {
        const unitIdx = visDevs[lr]!;
        logicalToUnit.set(lr, unitIdx);
        unitToLogical.set(unitIdx, lr);
      }
    } else {
      for (let lr = 0; lr < spec.ranksPerNode; lr++) {
        logicalToUnit.set(lr, lr);
        unitToLogical.set(lr, lr);
      }
    }
  }

  const mappableActiveEvents = canMap ? activeStage.eventsUpToHere.filter(isEventInActiveChassisScope) : [];
  const latestByLogicalRank = new Map<number, FaultTimelineEvent>();
  for (const ev of mappableActiveEvents) {
    if (ev.rank !== null) {
      const prev = latestByLogicalRank.get(ev.rank);
      const prevInfo = prev ? classifyEventFaultMechanism(prev) : null;
      const curInfo = classifyEventFaultMechanism(ev);
      const prevIsLockedWinningRoot =
        prev !== undefined &&
        prev.kind === "root-cause" &&
        !isGenericWrapperRootEvent(prev) &&
        winningLineNumber !== null &&
        prev.lineNumber === winningLineNumber;
      const shouldReplace =
        !prev ||
        (!prevIsLockedWinningRoot &&
          ((prev.kind !== "root-cause" && ev.kind === "root-cause") ||
            (prev.kind === "root-cause" &&
              ev.kind === "root-cause" &&
              ((curInfo.isLinkFault && !prevInfo?.isLinkFault && isGenericWrapperRootEvent(prev)) ||
                (prevInfo?.isLinkFault === true &&
                  curInfo.isLinkFault &&
                  curInfo.linkKind === "roce-port-down" &&
                  prevInfo.linkKind !== "roce-port-down") ||
                (winningLineNumber !== null &&
                  ev.lineNumber === winningLineNumber &&
                  prev.lineNumber !== winningLineNumber))) ||
            (prev.kind !== "root-cause" &&
              ev.kind !== "root-cause" &&
              prev.kind !== "confirmed-cascade" &&
              ev.kind === "confirmed-cascade")));
      if (shouldReplace) {
        latestByLogicalRank.set(ev.rank, ev);
      }
    }
  }

  const verdictEv = verdict.rank !== null ? latestByLogicalRank.get(verdict.rank) : undefined;
  const verdictInfo = verdictEv ? classifyEventFaultMechanism(verdictEv) : null;
  const rootLogicalActive =
    verdict.rank !== null &&
    verdictEv &&
    !verdictInfo?.isLinkTimeout &&
    !verdictInfo?.isPeerRefused &&
    (verdictEv.kind === "root-cause" || verdictInfo?.isLinkFault)
      ? verdict.rank
      : null;
  const rootUnitActive = rootLogicalActive !== null ? (logicalToUnit.get(rootLogicalActive) ?? null) : null;

  const activeStageLastEv = activeStage.eventsUpToHere[activeStage.eventsUpToHere.length - 1];
  const activeFocusUnit =
    canMap &&
    activeStage.focusRank !== null &&
    activeStageLastEv !== undefined &&
    isEventInActiveChassisScope(activeStageLastEv)
      ? (logicalToUnit.get(activeStage.focusRank) ?? null)
      : null;
  const normalizedActiveStage: FaultReplayStage =
    activeFocusUnit !== activeStage.focusRank ? { ...activeStage, focusRank: activeFocusUnit } : activeStage;

  const rankUnits: DerivedRankUnitState[] = [];
  const waitingArcs: DerivedWaitingArc[] = [];
  const linkFaultMarks: DerivedLinkFaultMark[] = [];
  const markIndexByKey = new Map<string, number>();
  const schematicPrefix = mappingMode === "single-node-schematic" ? "示意" : "";

  const primaryEvidenceLineNumbers = new Set(verdict.primaryEvidenceLines.map((p) => p.lineNumber));
  if (canMap) {
    for (const ev of mappableActiveEvents) {
      if (ev.kind !== "root-cause" || ev.rank === null) continue;
      const evMech = classifyEventFaultMechanism(ev);
      if (!evMech.isLinkFault || evMech.isPeerRefused) continue;
      const unitIdx = logicalToUnit.get(ev.rank) ?? null;
      if (unitIdx === null) continue;
      const peerLogical =
        typeof ev.peerRank === "number" && Number.isInteger(ev.peerRank) ? ev.peerRank : null;
      const peerUnit =
        peerLogical !== null && peerLogical !== ev.rank ? (logicalToUnit.get(peerLogical) ?? null) : null;
      const mark: DerivedLinkFaultMark = {
        rank: unitIdx,
        logicalRank: ev.rank,
        peerRank: peerUnit,
        peerLogicalRank: peerLogical,
        kind: evMech.linkKind,
        ifaceOrPort: evMech.ifaceOrPort,
        label: formatLinkFaultStatusLabel(evMech.linkKind, evMech.ifaceOrPort, ev.lineNumber, peerLogical),
        lineNumber: ev.lineNumber,
      };
      const peerKey = peerLogical !== null ? `peer-${peerLogical}` : "self";
      const subMechanismKey =
        ev.mechanism === "link-bind-fault" || ev.mechanism === "link-route-fault"
          ? ev.mechanism
          : evMech.linkKind;
      const markKey = `${unitIdx}:${peerKey}:${subMechanismKey}:${evMech.ifaceOrPort ?? ""}`;
      const existingIdx = markIndexByKey.get(markKey);
      if (existingIdx !== undefined) {
        const existingMark = linkFaultMarks[existingIdx]!;
        if (
          primaryEvidenceLineNumbers.has(ev.lineNumber) &&
          !primaryEvidenceLineNumbers.has(existingMark.lineNumber)
        ) {
          linkFaultMarks[existingIdx] = mark;
        }
        continue;
      }
      markIndexByKey.set(markKey, linkFaultMarks.length);
      linkFaultMarks.push(mark);
    }
  }

  for (let u = 0; u < spec.ranksPerNode; u++) {
    const physicalSlot = Math.floor(u / spec.diesPerPhysicalSlot);
    const dieIndex = u % spec.diesPerPhysicalSlot;
    const mappedLogical = unitToLogical.get(u) ?? null;
    const rankSuffix =
      mappedLogical !== null
        ? spec.diesPerPhysicalSlot === 2
          ? ` (R${mappedLogical})`
          : ` · Rank ${mappedLogical}`
        : "";
    const baseLabel =
      spec.diesPerPhysicalSlot === 2
        ? `${schematicPrefix}槽${physicalSlot}·${spec.dieLabelPrefix}${dieIndex}${rankSuffix}`
        : `${schematicPrefix}槽${physicalSlot}${rankSuffix}`;

    if (!canMap) {
      rankUnits.push({
        rank: u,
        logicalRank: null,
        physicalSlot,
        dieIndex,
        dieCountInSlot: spec.diesPerPhysicalSlot,
        label:
          spec.diesPerPhysicalSlot === 2
            ? `槽${physicalSlot}·${spec.dieLabelPrefix}${dieIndex}`
            : `槽${physicalSlot}`,
        statusLabel: "待补单机槽位证据",
        state: "unmapped",
        faultMechanism: "none",
        ifaceOrPort: null,
        evidenceLineNumber: null,
        timestamp: null,
        signalTag: null,
        waitingOnRank: null,
      });
      continue;
    }

    const isObservedParticipating = mappedLogical !== null && observedMappableRanks.has(mappedLogical);
    const isVisibleUnobserved =
      !isObservedParticipating &&
      mappedLogical !== null &&
      hasValidExplicitVisMap &&
      visDevs !== null &&
      mappedLogical < visDevs.length;
    const ev = mappedLogical !== null ? latestByLogicalRank.get(mappedLogical) : undefined;
    let state: SlotDieVisualState = isObservedParticipating ? "participating" : "idle";
    let faultMechanism: SlotFaultMechanism = "none";
    let ifaceOrPort: string | null = null;
    let statusLabel = isObservedParticipating ? "参与运行" : isVisibleUnobserved ? "可见待命" : "未参与";
    let waitingOnRank: number | null = null;

    if (ev && mappedLogical !== null) {
      const evMech = classifyEventFaultMechanism(ev);
      const explicitPeerLogical =
        typeof ev.peerRank === "number" && Number.isInteger(ev.peerRank) ? ev.peerRank : null;
      const explicitPeerUnit =
        explicitPeerLogical !== null ? (logicalToUnit.get(explicitPeerLogical) ?? null) : null;
      // Preserve explicit peer targeting even when peerRank does not map onto the active chassis
      // (never hijack an out-of-chassis peerRank onto rootUnitActive).
      const hasExplicitPeer = explicitPeerLogical !== null;
      const cascadeTargetUnit =
        ev.kind === "confirmed-cascade" && explicitPeerUnit !== null && explicitPeerUnit !== u
          ? explicitPeerUnit
          : !hasExplicitPeer &&
              ev.kind === "confirmed-cascade" &&
              rootUnitActive !== null &&
              rootUnitActive !== u
            ? rootUnitActive
            : null;
      const cascadeTargetLogical =
        cascadeTargetUnit !== null && cascadeTargetUnit === explicitPeerUnit
          ? explicitPeerLogical
          : rootLogicalActive;

      const isPeerKnownLocal =
        explicitPeerLogical !== null &&
        explicitPeerUnit !== null &&
        explicitPeerUnit !== u &&
        (observedMappableRanks.has(explicitPeerLogical) ||
          (hasValidExplicitVisMap && visDevs !== null && explicitPeerLogical < visDevs.length));
      const peerScopeNote = isPeerKnownLocal ? "时序待核" : "跨节点/未映射";

      if (evMech.isPeerRefused) {
        if (cascadeTargetUnit !== null && cascadeTargetLogical !== null) {
          state = "confirmed-cascade";
          faultMechanism = "hccl-wait-cascade";
          waitingOnRank = cascadeTargetUnit;
          ifaceOrPort = evMech.ifaceOrPort;
          statusLabel = `对端 Rank ${cascadeTargetLogical} 拒连/失联 · L${ev.lineNumber}`;
          waitingArcs.push({ fromRank: u, toRank: cascadeTargetUnit, lineNumber: ev.lineNumber });
        } else {
          state = "unattributed-timeout";
          faultMechanism = "hccl-link-timeout";
          ifaceOrPort = evMech.ifaceOrPort;
          statusLabel =
            explicitPeerLogical !== null
              ? `对端 Rank ${explicitPeerLogical} 建链拒连（${peerScopeNote}）· L${ev.lineNumber}`
              : `建链拒连（对端待核）· L${ev.lineNumber}`;
        }
      } else if (ev.kind === "root-cause" && evMech.isLinkFault) {
        state = "root-cause";
        faultMechanism = "hccl-link-fault";
        ifaceOrPort = evMech.ifaceOrPort;
        statusLabel = formatLinkFaultStatusLabel(
          evMech.linkKind,
          ifaceOrPort,
          ev.lineNumber,
          explicitPeerLogical,
        );
      } else if (ev.kind === "root-cause") {
        state = "root-cause";
        faultMechanism = "general-root";
        statusLabel =
          mappedLogical === verdict.rank ? `首错真凶 · L${ev.lineNumber}` : `伴随主错 · L${ev.lineNumber}`;
      } else if (cascadeTargetUnit !== null && cascadeTargetLogical !== null) {
        state = "confirmed-cascade";
        faultMechanism = "hccl-wait-cascade";
        waitingOnRank = cascadeTargetUnit;
        statusLabel = `等 Rank ${cascadeTargetLogical} 超时 · L${ev.lineNumber}`;
        waitingArcs.push({ fromRank: u, toRank: cascadeTargetUnit, lineNumber: ev.lineNumber });
      } else if (evMech.isLinkTimeout) {
        state = "unattributed-timeout";
        faultMechanism = "hccl-link-timeout";
        ifaceOrPort = evMech.ifaceOrPort;
        statusLabel =
          explicitPeerLogical !== null
            ? `等 Rank ${explicitPeerLogical} 建链超时（${peerScopeNote}）· L${ev.lineNumber}`
            : `建链超时（对端/路由待核）· L${ev.lineNumber}`;
      } else {
        state = "unattributed-timeout";
        faultMechanism = "unattributed-wait";
        statusLabel =
          explicitPeerLogical !== null && ev.kind === "confirmed-cascade"
            ? `等 Rank ${explicitPeerLogical} 超时（${peerScopeNote}）· L${ev.lineNumber}`
            : ev.kind === "pre-existing-timeout"
              ? `前序超时 · L${ev.lineNumber}`
              : `等待超时（待核时序/首错）· L${ev.lineNumber}`;
      }
    }

    rankUnits.push({
      rank: u,
      logicalRank: mappedLogical,
      physicalSlot,
      dieIndex,
      dieCountInSlot: spec.diesPerPhysicalSlot,
      label: baseLabel,
      statusLabel,
      state,
      faultMechanism,
      ifaceOrPort,
      evidenceLineNumber: ev?.lineNumber ?? null,
      timestamp: ev?.timestamp ?? null,
      signalTag: ev?.signalTag ?? null,
      waitingOnRank,
    });
  }

  return {
    spec,
    mappingMode,
    mappingNote,
    stages,
    activeStage: normalizedActiveStage,
    rankUnits,
    waitingArcs,
    linkFaultMarks,
  };
}
