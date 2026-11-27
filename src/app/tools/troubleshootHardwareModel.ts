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

export interface DerivedRankUnitState {
  readonly rank: number;
  readonly logicalRank: number | null;
  readonly physicalSlot: number;
  readonly dieIndex: number;
  readonly dieCountInSlot: 1 | 2;
  readonly label: string;
  readonly statusLabel: string;
  readonly state: SlotDieVisualState;
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

function compressEventsByRankAndKind(events: readonly FaultTimelineEvent[]): FaultTimelineEvent[] {
  const out: FaultTimelineEvent[] = [];
  const seenRankKind = new Set<string>();
  for (const ev of events) {
    if (ev.rankSource === "worker-dp-pp") continue;
    const key = `${ev.rank ?? `line-${ev.lineNumber}`}:${ev.kind}`;
    if (seenRankKind.has(key)) continue;
    seenRankKind.add(key);
    out.push(ev);
  }
  return out;
}

export function buildFaultReplayStages(report: LogAnalysisReport): FaultReplayStage[] {
  const rawEvents = report.firstFaultVerdict.timelineEvents ?? [];
  const milestones = compressEventsByRankAndKind(rawEvents);
  const participatingLabel =
    report.detectedRanks.length > 0
      ? `Rank ${report.detectedRanks.join(", ")} 参与运行`
      : "未识别单卡 Rank 前缀";

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
    const roleText =
      ev.kind === "root-cause"
        ? "触发主故障"
        : ev.kind === "confirmed-cascade"
          ? "进入次生等待超时"
          : ev.kind === "pre-existing-timeout"
            ? "前序独立超时（非晚发错误引起）"
            : "观测到等待超时（时序或首错待确认）";
    const rankText = ev.rank !== null ? `Rank ${ev.rank}` : "无 Rank 前缀";
    const tsText = ev.timestamp ? `${ev.timestamp} · ` : "";
    stages.push({
      index: i + 1,
      title: `${tsText}L${ev.lineNumber} ${rankText} ${roleText}（${ev.signalTag}）`,
      timestamp: ev.timestamp,
      focusRank: ev.rank,
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
  const activeStage = stages[clampedIdx]!;

  const verdict = report.firstFaultVerdict;
  const maxRank = report.detectedRanks.length > 0 ? Math.max(...report.detectedRanks) : -1;
  const visDevs = report.visibleDevices ?? null;

  const hasValidExplicitVisMap =
    visDevs !== null &&
    maxRank >= 0 &&
    maxRank < visDevs.length &&
    visDevs.every((d) => d >= 0 && d < spec.ranksPerNode);
  const visExceedsNode =
    visDevs !== null && (maxRank >= visDevs.length || visDevs.some((d) => d < 0 || d >= spec.ranksPerNode));

  const exceedsNode = visDevs !== null ? visExceedsNode : maxRank >= spec.ranksPerNode;
  const workerEvents = (verdict.timelineEvents ?? []).filter((e) => e.rankSource !== "worker-dp-pp");
  const hasMappableWorkerEvent = workerEvents.some((e) => e.slotMappable);
  const ambiguousProvenance =
    (verdict.rank !== null && verdict.slotMappable === false) ||
    (verdict.rank === null && workerEvents.length > 0 && !hasMappableWorkerEvent);

  const canMap = report.detectedRanks.length > 0 && !exceedsNode && !ambiguousProvenance;
  const mappingMode: HardwareFaultMappingMode = !canMap
    ? "logical-only"
    : hasValidExplicitVisMap
      ? "single-node-mapped"
      : "single-node-schematic";

  const mappingNote =
    mappingMode === "single-node-mapped" && visDevs !== null
      ? `${spec.hardwareDisplayName} 物理映射（已按 ASCEND_RT_VISIBLE_DEVICES=${visDevs.join(",")} 将逻辑 Rank 对齐物理槽位）`
      : mappingMode === "single-node-schematic"
        ? `${spec.hardwareDisplayName} 默认示意映射（日志未含 ASCEND_RT_VISIBLE_DEVICES，暂按 0..${spec.ranksPerNode - 1} 顺序示意；若做过卡号重映射请以物理卡号为准）`
        : exceedsNode
          ? visDevs !== null
            ? `ASCEND_RT_VISIBLE_DEVICES=${visDevs.join(",")} 或 Rank ${maxRank} 超出单台 ${spec.hardwareDisplayName} 的 ${spec.ranksPerNode} 卡范围；整机槽位保持中性。`
            : `日志出现 Rank ${maxRank}，超出单台 ${spec.hardwareDisplayName} 的 ${spec.ranksPerNode} 卡上限；整机槽位保持中性，不强行折算单机槽号。`
          : ambiguousProvenance
            ? "日志含多节点标识或仅含底层 device 编号，不足以唯一证明单机物理槽位归属；整机保持中性，仅展示逻辑证据链。"
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

  const detectedSet = new Set(report.detectedRanks);
  const latestByLogicalRank = new Map<number, FaultTimelineEvent>();
  for (const ev of activeStage.eventsUpToHere) {
    if (ev.rank !== null) {
      const prev = latestByLogicalRank.get(ev.rank);
      if (!prev || prev.kind !== "root-cause") {
        latestByLogicalRank.set(ev.rank, ev);
      }
    }
  }

  const rootLogicalActive =
    verdict.rank !== null && latestByLogicalRank.get(verdict.rank)?.kind === "root-cause"
      ? verdict.rank
      : null;
  const rootUnitActive = rootLogicalActive !== null ? (logicalToUnit.get(rootLogicalActive) ?? null) : null;

  const activeFocusUnit =
    activeStage.focusRank !== null
      ? (logicalToUnit.get(activeStage.focusRank) ?? activeStage.focusRank)
      : null;
  const normalizedActiveStage: FaultReplayStage =
    activeFocusUnit !== activeStage.focusRank ? { ...activeStage, focusRank: activeFocusUnit } : activeStage;

  const rankUnits: DerivedRankUnitState[] = [];
  const waitingArcs: DerivedWaitingArc[] = [];
  const schematicPrefix = mappingMode === "single-node-schematic" ? "示意" : "";

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
        evidenceLineNumber: null,
        timestamp: null,
        signalTag: null,
        waitingOnRank: null,
      });
      continue;
    }

    const isParticipating =
      mappedLogical !== null &&
      (detectedSet.has(mappedLogical) ||
        (hasValidExplicitVisMap && visDevs !== null && mappedLogical < visDevs.length));
    const ev = mappedLogical !== null ? latestByLogicalRank.get(mappedLogical) : undefined;
    let state: SlotDieVisualState = isParticipating ? "participating" : "idle";
    let statusLabel = isParticipating ? "参与运行" : "未参与";
    let waitingOnRank: number | null = null;

    if (ev && mappedLogical !== null) {
      if (ev.kind === "root-cause") {
        state = "root-cause";
        statusLabel =
          mappedLogical === verdict.rank ? `首错真凶 · L${ev.lineNumber}` : `伴随主错 · L${ev.lineNumber}`;
      } else if (
        ev.kind === "confirmed-cascade" &&
        rootLogicalActive !== null &&
        rootUnitActive !== null &&
        rootUnitActive !== u
      ) {
        state = "confirmed-cascade";
        waitingOnRank = rootUnitActive;
        statusLabel = `等 Rank ${rootLogicalActive} 超时 · L${ev.lineNumber}`;
        waitingArcs.push({ fromRank: u, toRank: rootUnitActive, lineNumber: ev.lineNumber });
      } else {
        state = "unattributed-timeout";
        statusLabel =
          ev.kind === "pre-existing-timeout"
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
  };
}
