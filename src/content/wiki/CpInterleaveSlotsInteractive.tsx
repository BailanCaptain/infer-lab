import { type KeyboardEvent, type ReactNode, useId, useMemo, useState } from "react";
import type { InteractiveDiagramProps } from "./QuantizationIntuitionInteractive";
import { type EduBadgeTone, WikiEduSandboxShell } from "./WikiEduSandboxShell";

function tokenBtnStyle(active: boolean, kind: "dark" | "teal" = "teal") {
  if (!active) {
    return {
      background: "var(--color-surface-elevated)",
      borderColor: "var(--color-line)",
      color: "var(--color-ink)",
    } as const;
  }
  const bg = kind === "dark" ? "var(--color-ink)" : "var(--color-token)";
  return {
    background: bg,
    borderColor: bg,
    color: "var(--color-ink-inverse)",
  } as const;
}

export const CP_INTERLEAVE_SLOTS_APPROVED_SHA256 =
  "039a4da0cb7197c1ca28f0e27503335c679558c4960cbb7e2403daf8c0d0f157";
export const CONTEXT_PARALLEL_FIG_INTERLEAVE_SLOTS_APPROVED_SHA256 = CP_INTERLEAVE_SLOTS_APPROVED_SHA256;

export const CP_DCP_SIZES = [1, 2, 4] as const;
export type CpDcpSize = (typeof CP_DCP_SIZES)[number];

export const CP_PCP_SIZES = [1, 2] as const;
export type CpPcpSize = (typeof CP_PCP_SIZES)[number];

export const CP_TP_SIZES = [2, 4, 8] as const;
export type CpTpSize = (typeof CP_TP_SIZES)[number];

export const CP_GQA_STRICT_Q_HEADS = 32;
export const CP_GQA_STRICT_KV_HEADS = 4;

export const CP_INTERLEAVE_SIZES = [1, 4, 16] as const;
export type CpInterleaveSize = (typeof CP_INTERLEAVE_SIZES)[number];

export const CP_ATTN_MODES = ["mla-gqa", "gqa-strict", "sfa-sparse"] as const;
export type CpAttnMode = (typeof CP_ATTN_MODES)[number];

export type CpSandboxMode = "sandbox" | "svg";

export const CP_LOGICAL_POSITIONS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
export const CP_MAX_WINDOW_START = 56;
export const CP_REAL_PHYSICAL_BLOCK_SIZE = 16;
export const CP_MAIN_KV_BYTES_PER_TOK_LAYER = 1024;
export const CP_INDEXER_BYTES_PER_TOK_LAYER = 64;

/**
 * 对应 vllm-ascend@c09d3e20:vllm_ascend/worker/block_table.py 中的 _compute_dcp_slot_mapping：
 * 逻辑位置 pos 按 floor(pos / interleave) % dcp_world_size 决定归属 DCP rank；
 * 归属本 rank 的位置写入本地物理块偏移，非本 rank 位置统一写入 -1 哨兵跳过写入。
 */
export function computeDcpSlotMapping(
  positions: readonly number[],
  dcpWorldSize: number,
  interleaveSize: number,
  dcpRank: number,
  physicalBlockTable?: readonly number[],
  physicalBlockSize = 16,
): number[] {
  if (!Number.isSafeInteger(dcpWorldSize) || dcpWorldSize < 1) {
    throw new Error(`非法 dcpWorldSize: ${dcpWorldSize}`);
  }
  if (!Number.isSafeInteger(interleaveSize) || interleaveSize < 1) {
    throw new Error(`非法 interleaveSize: ${interleaveSize}`);
  }
  if (!Number.isSafeInteger(physicalBlockSize) || physicalBlockSize < interleaveSize) {
    throw new Error(`非法 physicalBlockSize: ${physicalBlockSize}`);
  }
  if (physicalBlockSize % interleaveSize !== 0) {
    throw new Error(`physicalBlockSize(${physicalBlockSize}) 必须整除 interleaveSize(${interleaveSize})`);
  }
  if (!Number.isSafeInteger(dcpRank) || dcpRank < 0 || dcpRank >= dcpWorldSize) {
    throw new Error(`dcpRank(${dcpRank}) 超出范围 [0, ${dcpWorldSize - 1}]`);
  }

  const virtualBlockSize = physicalBlockSize * dcpWorldSize;

  return positions.map((pos) => {
    if (!Number.isSafeInteger(pos) || pos < 0) {
      throw new Error(`非法逻辑位置 pos: ${pos}`);
    }
    const vBlockIdx = Math.floor(pos / virtualBlockSize);
    const vOffset = pos % virtualBlockSize;
    const chunkIdx = Math.floor(vOffset / interleaveSize);
    const withinChunk = vOffset % interleaveSize;
    const ownerRank = chunkIdx % dcpWorldSize;
    if (ownerRank !== dcpRank) {
      return -1;
    }
    const localOffsetInBlock = Math.floor(chunkIdx / dcpWorldSize) * interleaveSize + withinChunk;
    let physBlockId = vBlockIdx;
    if (physicalBlockTable !== undefined) {
      const tableEntry = physicalBlockTable[vBlockIdx];
      if (tableEntry === undefined || !Number.isSafeInteger(tableEntry) || tableEntry < 0) {
        throw new Error(`physicalBlockTable 缺少或包含非法虚拟块索引 ${vBlockIdx}`);
      }
      physBlockId = tableEntry;
    }
    return physBlockId * physicalBlockSize + localOffsetInBlock;
  });
}

export const _compute_dcp_slot_mapping = computeDcpSlotMapping;

export interface CpRankSlotRow {
  readonly dcpRank: number;
  readonly slotMapping: readonly number[];
  readonly ownedPositions: readonly number[];
  readonly skippedCount: number;
}

export interface CpPrefillZigzagGroup {
  readonly pcpRank: number;
  readonly positions: readonly number[];
  readonly causalPairs: number;
}

export interface CpTopologyFixPlan {
  readonly dcpSize: CpDcpSize;
  readonly pcpSize: CpPcpSize;
  readonly tpSize: CpTpSize;
  readonly label: string;
}

export interface CpInterleaveComputedState {
  readonly dcpSize: CpDcpSize;
  readonly pcpSize: CpPcpSize;
  readonly tpSize: CpTpSize;
  readonly attnMode: CpAttnMode;
  readonly windowStart: number;
  readonly visiblePositions: readonly number[];
  readonly requestedInterleaveSize: CpInterleaveSize;
  readonly effectiveInterleaveSize: CpInterleaveSize;
  readonly interleaveSize: CpInterleaveSize;
  readonly sfaOverrodeInterleave: boolean;
  readonly totalDevices: number;
  readonly validDcpSizes: readonly CpDcpSize[];
  readonly upstreamAllowedDcpSizes: readonly number[];
  readonly isTopologyValid: boolean;
  readonly recommendedFix: CpTopologyFixPlan | null;
  readonly dcpGroupsCount: number;
  readonly positionOwners: readonly number[];
  readonly rankRows: readonly CpRankSlotRow[];
  readonly prefillZigzag: readonly CpPrefillZigzagGroup[];
  readonly v030VirtualBlockSlots: number;
  readonly legacyOverMultipliedSlots: number;
  readonly phantomSlots: number;
  readonly isOverMultiplyTrapActive: boolean;
  readonly panel2BadgeText: string;
  readonly panel2BadgeTone: "is-good" | "is-warn";
  readonly mainKvBytesPerCard: number;
  readonly replicatedIndexerBytesPerCard: number;
  readonly totalPerTokLayerBytes: number;
  readonly takeawayBadge: string;
  readonly takeawayTone: EduBadgeTone;
  readonly takeaway: string;
  readonly kpi: string;
}

export function computePrefillHeadTailPairs(pcpSize: CpPcpSize): readonly CpPrefillZigzagGroup[] {
  if (pcpSize === 1) {
    return [{ pcpRank: 0, positions: [0, 1, 2, 3, 4, 5, 6, 7], causalPairs: 36 }];
  }
  return [
    { pcpRank: 0, positions: [0, 1, 6, 7], causalPairs: 1 + 2 + 7 + 8 },
    { pcpRank: 1, positions: [2, 3, 4, 5], causalPairs: 3 + 4 + 5 + 6 },
  ];
}

export function computeCpInterleaveState(
  dcpSize: CpDcpSize = 2,
  pcpSize: CpPcpSize = 1,
  tpSize: CpTpSize = 2,
  interleaveSize: CpInterleaveSize = 1,
  attnMode: CpAttnMode = "mla-gqa",
  windowStart = 0,
): CpInterleaveComputedState {
  const safeWindowStart = Math.max(0, Math.min(CP_MAX_WINDOW_START, Math.trunc(windowStart)));
  const visiblePositions = Array.from({ length: 8 }, (_, idx) => safeWindowStart + idx);
  const totalDevices = tpSize * pcpSize;

  const isDcpAllowedUpstream = (d: number): boolean => {
    if (attnMode === "sfa-sparse") {
      return d === 1 || d === pcpSize || d === tpSize * pcpSize;
    }
    if (attnMode === "gqa-strict") {
      const baseValid = pcpSize === 1 ? tpSize % d === 0 : d === 1 || d === pcpSize;
      if (!baseValid) return false;
      if (d === 1) return true;
      // 对齐 vllm@ced6857a:vllm/config/model.py#L1447-L1470（标准 GQA 32Q:4KV）
      if (tpSize <= CP_GQA_STRICT_KV_HEADS) return false;
      const maxDcpSize = Math.floor(tpSize / CP_GQA_STRICT_KV_HEADS);
      const numQPerKv = CP_GQA_STRICT_Q_HEADS / CP_GQA_STRICT_KV_HEADS;
      return d <= maxDcpSize && numQPerKv % d === 0;
    }
    return pcpSize === 1 ? tpSize % d === 0 : d === 1 || d === pcpSize || d === tpSize * pcpSize;
  };

  const validDcpSizes: readonly CpDcpSize[] = CP_DCP_SIZES.filter((d) => isDcpAllowedUpstream(d));
  const upstreamRaw =
    attnMode === "sfa-sparse"
      ? [1, pcpSize, tpSize * pcpSize]
      : attnMode === "gqa-strict"
        ? [...validDcpSizes]
        : pcpSize === 1
          ? [...validDcpSizes, ...(tpSize === 8 ? [8] : [])]
          : [1, pcpSize, tpSize * pcpSize];
  const upstreamAllowedDcpSizes = Array.from(new Set(upstreamRaw)).sort((a, b) => a - b);

  const isTopologyValid = validDcpSizes.includes(dcpSize);
  const dcpGroupsCount = isTopologyValid ? totalDevices / dcpSize : 0;

  let recommendedFix: CpTopologyFixPlan | null = null;
  if (!isTopologyValid) {
    if (attnMode === "gqa-strict") {
      recommendedFix = {
        tpSize: 8,
        pcpSize,
        dcpSize: 2,
        label:
          pcpSize > 1
            ? `应用合规拓扑：TP=8 · PCP=${pcpSize} · DCP=2（4KV 复制上限）`
            : "应用合规拓扑：TP=8 · PCP=1 · DCP=2（4KV 复制上限）",
      };
    } else if (attnMode === "mla-gqa" && pcpSize === 1 && dcpSize === tpSize * 2 && dcpSize <= 4) {
      recommendedFix = {
        tpSize,
        pcpSize: 2,
        dcpSize,
        label: `应用合规拓扑：TP=${tpSize} · PCP=2 · DCP=${dcpSize}`,
      };
    } else if (pcpSize > 1) {
      const targetDcp = pcpSize as CpDcpSize;
      recommendedFix = {
        tpSize,
        pcpSize,
        dcpSize: targetDcp,
        label: `应用合规拓扑：DCP=${targetDcp}（对齐 PCP=${pcpSize}）`,
      };
    } else if (attnMode === "sfa-sparse") {
      const targetDcp = (
        CP_DCP_SIZES.includes((tpSize * pcpSize) as CpDcpSize) ? tpSize * pcpSize : 1
      ) as CpDcpSize;
      recommendedFix = {
        tpSize,
        pcpSize,
        dcpSize: targetDcp,
        label:
          targetDcp === 1
            ? "应用合规拓扑：DCP=1（或取 DCP=TP×PCP）"
            : `应用合规拓扑：DCP=${targetDcp}（匹配 TP×PCP）`,
      };
    } else {
      const maxValid = validDcpSizes[validDcpSizes.length - 1] ?? 1;
      recommendedFix = {
        tpSize,
        pcpSize,
        dcpSize: maxValid,
        label: `应用合规拓扑：DCP=${maxValid}（整除 TP=${tpSize}）`,
      };
    }
  }

  const effectiveInterleaveSize: CpInterleaveSize =
    attnMode === "sfa-sparse" && dcpSize > 1 ? 16 : interleaveSize;
  const sfaOverrodeInterleave = attnMode === "sfa-sparse" && dcpSize > 1 && interleaveSize !== 16;

  const positionOwners = visiblePositions.map((pos) => Math.floor(pos / effectiveInterleaveSize) % dcpSize);

  const rankRows: CpRankSlotRow[] = Array.from({ length: dcpSize }, (_, dcpRank) => {
    const slotMapping = computeDcpSlotMapping(
      visiblePositions,
      dcpSize,
      effectiveInterleaveSize,
      dcpRank,
      undefined,
      CP_REAL_PHYSICAL_BLOCK_SIZE,
    );
    const ownedPositions = visiblePositions.filter((_, idx) => slotMapping[idx] !== -1);
    const skippedCount = slotMapping.filter((s) => s === -1).length;
    return { dcpRank, slotMapping, ownedPositions, skippedCount };
  });

  const prefillZigzag = computePrefillHeadTailPairs(pcpSize);
  const v030VirtualBlockSlots = CP_REAL_PHYSICAL_BLOCK_SIZE * dcpSize;
  const legacyOverMultipliedSlots = CP_REAL_PHYSICAL_BLOCK_SIZE * pcpSize * dcpSize;
  const phantomSlots = legacyOverMultipliedSlots - v030VirtualBlockSlots;
  const isOverMultiplyTrapActive = pcpSize > 1 && dcpSize > 1;
  const panel2BadgeText =
    pcpSize === 1
      ? "PCP=1 新旧等值"
      : dcpSize === 1
        ? `PCP>1 旧式误乘 ${pcpSize}×`
        : `防重乘省去 +${phantomSlots} 幽灵槽`;
  const panel2BadgeTone: "is-good" | "is-warn" = pcpSize === 1 ? "is-good" : "is-warn";

  const mainKvBytesPerCard = CP_MAIN_KV_BYTES_PER_TOK_LAYER / dcpSize;
  const replicatedIndexerBytesPerCard = attnMode === "sfa-sparse" ? CP_INDEXER_BYTES_PER_TOK_LAYER : 0;
  const totalPerTokLayerBytes = mainKvBytesPerCard + replicatedIndexerBytesPerCard;

  const localChoicesText = validDcpSizes.join(", ");
  const upstreamChoicesText = upstreamAllowedDcpSizes.join(", ");
  const windowLabel = `p${safeWindowStart}..p${safeWindowStart + 7}`;

  let takeawayBadge: string;
  let takeawayTone: EduBadgeTone;
  let takeaway: string;

  if (!isTopologyValid) {
    takeawayBadge = `非法拓扑（假设演算）· 本例可选 DCP ∈ {${localChoicesText}}`;
    takeawayTone = "danger";
    takeaway =
      attnMode === "gqa-strict"
        ? `标准 GQA（32Q:4KV）开 DCP>1 除整除外还要求 TP > 4 且 DCP ≤ ⌊TP/4⌋（同时开 PCP>1 另须 PCP=DCP）；TP=${tpSize}、PCP=${pcpSize} 下不允许 DCP=${dcpSize}（允许 DCP ∈ {${upstreamChoicesText}}）。`
        : `当前 TP=${tpSize}、PCP=${pcpSize} 下不支持 DCP=${dcpSize}；下方先展示假设落槽，请点击一键应用合规拓扑（本例可选 {${localChoicesText}}，上游允许 {${upstreamChoicesText}}）。`;
  } else if (sfaOverrodeInterleave) {
    takeawayBadge = `SFA 强制整块落槽 · 请求 ${interleaveSize} → 生效 16`;
    takeawayTone = "warn";
    takeaway = `请求粒度 ${interleaveSize} 在 SFA 稀疏路径（DCP=${dcpSize}>1）下被平台强制覆写为生效粒度 16 整块落槽；主 KV 缩至 ${mainKvBytesPerCard} B，64 B 索引器逐卡整份复制。`;
  } else if (isOverMultiplyTrapActive) {
    takeawayBadge = `虚拟块防重乘 · 16×${dcpSize}=${v030VirtualBlockSlots} 槽`;
    takeawayTone = "accent";
    takeaway = `DCP=${dcpSize} 复用 TP(${tpSize})×PCP(${pcpSize})=${totalDevices} 张卡，虚拟块恒为 ${v030VirtualBlockSlots} 槽，绝不再重乘 PCP 多出 +${phantomSlots} 幽灵槽。`;
  } else if (dcpSize === 1) {
    takeawayBadge = pcpSize > 1 ? `DCP=1 · 仍防误乘 ${pcpSize}×` : "DCP=1 · 逐卡存完整历史";
    takeawayTone = "warn";
    takeaway =
      pcpSize > 1
        ? `当前窗口 ${windowLabel} 全落本卡连续槽；虚拟块保持 16×1=16 槽，避免误乘 PCP(${pcpSize}) 成 ${legacyOverMultipliedSlots} 槽。`
        : `当前窗口 ${windowLabel} 全落本卡（0 个跳过），教学口径下主 KV 1024 B${attnMode === "sfa-sparse" ? " 与索引 64 B" : ""} 均逐卡整份驻留。`;
  } else {
    takeawayBadge = `DCP=${dcpSize} · 生效粒度 ${effectiveInterleaveSize}（${windowLabel}）`;
    takeawayTone = "default";
    takeaway =
      attnMode === "sfa-sparse"
        ? `SFA 稀疏按整块 16 落槽（滑动位置可观察 p15→p16 换卡边界）；主 KV 缩至 ${mainKvBytesPerCard} B，64 B 索引器逐卡复制。`
        : `按粒度 ${effectiveInterleaveSize} 交错落入 ${dcpSize} 张卡（非本卡填跳过）；教学口径主 KV 缩至 ${mainKvBytesPerCard} B。`;
  }

  const kpi = !isTopologyValid
    ? `假设演算 · 可选 DCP ∈ {${localChoicesText}}`
    : attnMode === "sfa-sparse"
      ? `虚拟块 ${v030VirtualBlockSlots} 槽 · 主KV ${mainKvBytesPerCard}B + 索引 64B`
      : `虚拟块 ${v030VirtualBlockSlots} 槽 · 主KV ${mainKvBytesPerCard}B`;

  return {
    dcpSize,
    pcpSize,
    tpSize,
    attnMode,
    windowStart: safeWindowStart,
    visiblePositions,
    requestedInterleaveSize: interleaveSize,
    effectiveInterleaveSize,
    interleaveSize: effectiveInterleaveSize,
    sfaOverrodeInterleave,
    totalDevices,
    validDcpSizes,
    upstreamAllowedDcpSizes,
    isTopologyValid,
    recommendedFix,
    dcpGroupsCount,
    positionOwners,
    rankRows,
    prefillZigzag,
    v030VirtualBlockSlots,
    legacyOverMultipliedSlots,
    phantomSlots,
    isOverMultiplyTrapActive,
    panel2BadgeText,
    panel2BadgeTone,
    mainKvBytesPerCard,
    replicatedIndexerBytesPerCard,
    totalPerTokLayerBytes,
    takeawayBadge,
    takeawayTone,
    takeaway,
    kpi,
  };
}

export interface CpInterleaveSlotsInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: CpSandboxMode | undefined;
  readonly initialDcpSize?: CpDcpSize | undefined;
  readonly initialPcpSize?: CpPcpSize | undefined;
  readonly initialTpSize?: CpTpSize | undefined;
  readonly initialInterleaveSize?: CpInterleaveSize | undefined;
  readonly initialAttnMode?: CpAttnMode | undefined;
  readonly initialWindowStart?: number | undefined;
}

const RANK_SWATCHES: readonly { readonly bg: string; readonly border: string }[] = [
  {
    bg: "color-mix(in srgb, var(--color-rank0) 15%, var(--color-surface-elevated))",
    border: "var(--color-rank0)",
  },
  {
    bg: "color-mix(in srgb, var(--color-rank1) 15%, var(--color-surface-elevated))",
    border: "var(--color-rank1)",
  },
  {
    bg: "color-mix(in srgb, var(--color-rank2) 15%, var(--color-surface-elevated))",
    border: "var(--color-rank2)",
  },
  {
    bg: "color-mix(in srgb, var(--color-rank3) 15%, var(--color-surface-elevated))",
    border: "var(--color-rank3)",
  },
];

export function CpInterleaveSlotsInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialDcpSize = 2,
  initialPcpSize = 1,
  initialTpSize = 2,
  initialInterleaveSize = 1,
  initialAttnMode = "mla-gqa",
  initialWindowStart = 0,
}: CpInterleaveSlotsInteractiveProps) {
  const [mode, setMode] = useState<CpSandboxMode>(initialMode);
  const [dcpSize, setDcpSize] = useState<CpDcpSize>(initialDcpSize);
  const [pcpSize, setPcpSize] = useState<CpPcpSize>(initialPcpSize);
  const [tpSize, setTpSize] = useState<CpTpSize>(initialTpSize);
  const [interleaveSize, setInterleaveSize] = useState<CpInterleaveSize>(initialInterleaveSize);
  const [attnMode, setAttnMode] = useState<CpAttnMode>(initialAttnMode);
  const [windowStart, setWindowStart] = useState<number>(initialWindowStart);

  const state = useMemo(
    () => computeCpInterleaveState(dcpSize, pcpSize, tpSize, interleaveSize, attnMode, windowStart),
    [dcpSize, pcpSize, tpSize, interleaveSize, attnMode, windowStart],
  );

  const posSliderId = useId();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mTeal = `${id}-${uid}-cp-teal`;

  const applyCanonicalTrapPreset = () => {
    setMode("sandbox");
    setAttnMode("mla-gqa");
    setTpSize(2);
    setPcpSize(2);
    setDcpSize(4);
    setInterleaveSize(1);
  };

  const applyDefaultInterleavePreset = () => {
    setMode("sandbox");
    setAttnMode("mla-gqa");
    setTpSize(2);
    setPcpSize(1);
    setDcpSize(2);
    setInterleaveSize(1);
  };

  const applyValidTopologyFix = () => {
    setMode("sandbox");
    if (!state.recommendedFix) return;
    setTpSize(state.recommendedFix.tpSize);
    setPcpSize(state.recommendedFix.pcpSize);
    setDcpSize(state.recommendedFix.dcpSize);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const isRange =
      typeof event.target === "object" &&
      event.target !== null &&
      "tagName" in event.target &&
      (event.target as { tagName?: string; type?: string }).tagName === "INPUT" &&
      (event.target as { type?: string }).type === "range";
    if (isRange && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      return;
    }
    if (event.key === "0" || event.key === "Escape") {
      event.preventDefault();
      setMode("svg");
    }
  };

  const isCanonicalTrap =
    mode === "sandbox" &&
    attnMode === "mla-gqa" &&
    tpSize === 2 &&
    pcpSize === 2 &&
    dcpSize === 4 &&
    interleaveSize === 1;
  const isDefaultTwoCard =
    mode === "sandbox" &&
    attnMode === "mla-gqa" &&
    tpSize === 2 &&
    pcpSize === 1 &&
    dcpSize === 2 &&
    interleaveSize === 1;

  return (
    <WikiEduSandboxShell
      id={id}
      caption={caption}
      safeSvg={safeSvg}
      mode={mode}
      useTokenVariables
      onToggleMode={setMode}
      scrollRef={scrollRef}
      scrollable={scrollable}
      onScroll={onScroll}
      kickerTag="母版 B · 参数权衡与拓扑算例"
      kickerTitle="上下文并行（CP）交错落槽、虚拟块防重乘与显存切分边界"
      question="为什么虚拟块不再重复乘 PCP，且只有按位置切的主 KV 随 DCP 缩小？"
      toolbarLabel="DCP 并行度、位置起点滑块与预设控制"
      onToolbarKeyDown={handleKeyDown}
      extraRootAttrs={{
        "data-dcp": dcpSize,
        "data-pcp": pcpSize,
        "data-tp": tpSize,
        "data-interleave": state.effectiveInterleaveSize,
        "data-requested-interleave": interleaveSize,
        "data-attn-mode": attnMode,
        "data-window-start": state.windowStart,
        "data-topology-valid": String(state.isTopologyValid),
      }}
      toolbar={
        <>
          <fieldset className="wiki-edu-btn-row" aria-label="DCP 并行度切换">
            {CP_DCP_SIZES.map((d) => {
              const active = mode === "sandbox" && dcpSize === d;
              return (
                <button
                  key={d}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`cp-dcp-${d}`}
                  aria-pressed={active}
                  style={tokenBtnStyle(active, "teal")}
                  onClick={() => {
                    setMode("sandbox");
                    setDcpSize(d);
                  }}
                >
                  {`DCP=${d}`}
                </button>
              );
            })}
          </fieldset>

          <label htmlFor={posSliderId} className="wiki-edu-slider-chip">
            <span className="mono">{`p${state.windowStart}..p${state.windowStart + 7}`}</span>
            <input
              id={posSliderId}
              type="range"
              min={0}
              max={CP_MAX_WINDOW_START}
              step={1}
              value={state.windowStart}
              data-testid="cp-pos-slider"
              aria-label="观察位置窗口起点"
              aria-valuetext={`p${state.windowStart} 至 p${state.windowStart + 7}`}
              onPointerDown={() => setMode("sandbox")}
              onChange={(e) => {
                setMode("sandbox");
                setWindowStart(Number(e.target.value));
              }}
            />
          </label>
        </>
      }
      takeawayBadge={state.takeawayBadge}
      takeawayTone={state.takeawayTone}
      takeaway={state.takeaway}
      kpi={state.kpi}
      detailsSummary="查看工程与源码细节（交错落槽公式 / 虚拟块大小演进 / SFA 复制索引与三套独立下标）"
      detailsContent={
        <>
          <strong>源码落槽与拓扑校验核验</strong>：<code>_compute_dcp_slot_mapping</code>（
          <code>vllm_ascend/worker/block_table.py</code>）按{" "}
          <code>floor(pos / cp_kv_cache_interleave_size) % dcp_world_size</code> 判定持有卡，非本卡位置写入{" "}
          <code>-1</code> 哨兵跳过；标准 MLA/GQA 默认粒度为 <code>1</code>，而 SFA 稀疏路径在{" "}
          <code>DCP &gt; 1</code> 时由 <code>platform.py#L1427-L1435</code> 打告警并覆写为{" "}
          <code>block_size = 16</code>（GQA/MQA 同时开 <code>PCP &gt; 1</code> 与 <code>DCP &gt; 1</code>{" "}
          另要求 <code>PCP == DCP</code>）。标准 GQA（<code>32Q:4KV</code>）开启 <code>DCP &gt; 1</code> 除{" "}
          <code>vllm/config/parallel.py#L561-L570</code> 整除守卫外，还须满足{" "}
          <code>vllm/config/model.py#L1447-L1470</code>：<code>tp_size &gt; num_kv_heads</code>（4KV 须{" "}
          <code>TP=8</code>）、<code>{"dcp <= tp_size // num_kv_heads"}</code>（上限 <code>2</code>）且每 KV
          对应 Q 头数整除 <code>dcp</code>（本例可选 DCP ∈{" "}
          <code>{`{${state.validDcpSizes.join(", ")}}`}</code>，上游允许{" "}
          <code>{`{${state.upstreamAllowedDcpSizes.join(", ")}}`}</code>）。虚拟块恒为{" "}
          <code>16 × dcp_world_size = {state.v030VirtualBlockSlots}</code>，不再沿用早期{" "}
          <code>16 × PCP × DCP = {state.legacyOverMultipliedSlots}</code>。教学显存设定按主 KV{" "}
          <code>1024 B/词·层</code>、SFA 索引 <code>64 B/词·层</code>估算；<code>tp_rank</code>、
          <code>dcp_rank</code> 与物理卡号为三套独立下标。
        </>
      }
    >
      <style>{`
        .cp-desktop-svg { display: block; width: 100%; max-width: 900px; height: auto; }
        .cp-mobile-stack { display: none; }
        .wiki-edu-card[data-diagram-id="${id}"] code,
        .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-details-body,
        .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-note-card {
          overflow-wrap: anywhere;
          word-break: break-word;
          min-width: 0;
        }
        @container reader-main (max-width: 820px) {
          .cp-desktop-svg { display: none; }
          .cp-mobile-stack { display: flex; flex-direction: column; gap: 10px; }
        }
        @media (max-width: 820px) {
          .cp-desktop-svg { display: none; }
          .cp-mobile-stack { display: flex; flex-direction: column; gap: 5px; }
          .cp-mobile-stack > div { padding: 6px 8px !important; }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-panel { padding: 8px 10px; gap: 6px; }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-lane-box { gap: 3px; }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls {
            flex-wrap: nowrap;
            padding: 6px 8px;
            gap: 4px;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-btn-row {
            flex-wrap: nowrap;
            gap: 3px;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-btn {
            padding: 4px 6px;
            font-size: 11.5px;
            white-space: nowrap;
            flex-shrink: 0;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-slider-chip {
            padding: 2px 6px;
            gap: 4px;
            font-size: 11px;
            white-space: nowrap;
            flex-wrap: nowrap;
            flex-shrink: 1;
            min-width: 0;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-slider-chip input[type="range"] {
            width: 48px;
            min-width: 36px;
          }
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-kpi,
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-takeaway-badge,
          .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-badge {
            white-space: normal;
            max-width: 100%;
          }
        }
      `}</style>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", minWidth: 0 }}>
        <CpInterleaveCanvasBody
          state={state}
          mTeal={mTeal}
          onApplySafeTopology={applyValidTopologyFix}
          paramDrawer={
            <details
              className="wiki-edu-param-drawer"
              data-testid="cp-param-drawer"
              style={{
                border: "1px solid var(--color-line)",
                borderRadius: "var(--radius-field)",
                padding: "8px 12px",
                background: "var(--color-surface)",
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "var(--text-caption)",
                  color: "var(--color-ink)",
                }}
              >
                展开拓扑与粒度参数（PCP / TP / 注意力后端 / 交错粒度）
              </summary>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px", marginTop: "8px" }}>
                <fieldset className="wiki-edu-btn-row" aria-label="CP 经典预设">
                  <button
                    type="button"
                    className="wiki-edu-btn"
                    data-testid="cp-preset-default"
                    aria-pressed={isDefaultTwoCard}
                    style={tokenBtnStyle(isDefaultTwoCard, "dark")}
                    onClick={applyDefaultInterleavePreset}
                  >
                    标准 DCP=2
                  </button>
                  <button
                    type="button"
                    className="wiki-edu-btn"
                    data-testid="cp-preset-trap"
                    aria-pressed={isCanonicalTrap}
                    style={tokenBtnStyle(isCanonicalTrap, "dark")}
                    onClick={applyCanonicalTrapPreset}
                  >
                    重乘陷阱 2×2→4
                  </button>
                </fieldset>

                <fieldset className="wiki-edu-btn-row" aria-label="PCP 与 TP 并行度">
                  {CP_PCP_SIZES.map((p) => {
                    const active = mode === "sandbox" && pcpSize === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        className="wiki-edu-btn"
                        data-testid={`cp-pcp-${p}`}
                        aria-pressed={active}
                        style={tokenBtnStyle(active, "dark")}
                        onClick={() => {
                          setMode("sandbox");
                          setPcpSize(p);
                        }}
                      >
                        {`PCP=${p}`}
                      </button>
                    );
                  })}
                  {CP_TP_SIZES.map((t) => {
                    const active = mode === "sandbox" && tpSize === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        className="wiki-edu-btn"
                        data-testid={`cp-tp-${t}`}
                        aria-pressed={active}
                        style={tokenBtnStyle(active, "dark")}
                        onClick={() => {
                          setMode("sandbox");
                          setTpSize(t);
                        }}
                      >
                        {`TP=${t}`}
                      </button>
                    );
                  })}
                </fieldset>

                <fieldset className="wiki-edu-btn-row" aria-label="注意力后端选择">
                  <button
                    type="button"
                    className="wiki-edu-btn"
                    data-testid="cp-attn-mla-gqa"
                    aria-pressed={mode === "sandbox" && attnMode === "mla-gqa"}
                    style={tokenBtnStyle(mode === "sandbox" && attnMode === "mla-gqa", "dark")}
                    onClick={() => {
                      setMode("sandbox");
                      setAttnMode("mla-gqa");
                    }}
                  >
                    标准 MLA
                  </button>
                  <button
                    type="button"
                    className="wiki-edu-btn"
                    data-testid="cp-attn-gqa-strict"
                    aria-pressed={mode === "sandbox" && attnMode === "gqa-strict"}
                    style={tokenBtnStyle(mode === "sandbox" && attnMode === "gqa-strict", "dark")}
                    onClick={() => {
                      setMode("sandbox");
                      setAttnMode("gqa-strict");
                    }}
                  >
                    标准 GQA (32Q:4KV)
                  </button>
                  <button
                    type="button"
                    className="wiki-edu-btn"
                    data-testid="cp-attn-sfa-sparse"
                    aria-pressed={mode === "sandbox" && attnMode === "sfa-sparse"}
                    style={tokenBtnStyle(mode === "sandbox" && attnMode === "sfa-sparse", "dark")}
                    onClick={() => {
                      setMode("sandbox");
                      setAttnMode("sfa-sparse");
                    }}
                  >
                    SFA 稀疏
                  </button>
                </fieldset>

                <fieldset className="wiki-edu-btn-row" aria-label="交错轮换粒度">
                  {CP_INTERLEAVE_SIZES.map((gran) => {
                    const active = mode === "sandbox" && interleaveSize === gran;
                    const label =
                      gran === 1 ? "粒度=1 (逐词)" : gran === 4 ? "粒度=4 (缩微块)" : "粒度=16 (整块)";
                    return (
                      <button
                        key={gran}
                        type="button"
                        className="wiki-edu-btn"
                        data-testid={`cp-interleave-${gran}`}
                        aria-pressed={active}
                        style={tokenBtnStyle(active, "teal")}
                        onClick={() => {
                          setMode("sandbox");
                          setInterleaveSize(gran);
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </fieldset>
              </div>
            </details>
          }
        />
      </div>
    </WikiEduSandboxShell>
  );
}

function CpInterleaveCanvasBody({
  state,
  mTeal,
  onApplySafeTopology,
  paramDrawer,
}: {
  readonly state: CpInterleaveComputedState;
  readonly mTeal: string;
  readonly onApplySafeTopology: () => void;
  readonly paramDrawer: ReactNode;
}) {
  const maxBarScale = Math.max(128, state.legacyOverMultipliedSlots);
  const v030Pct = Math.round((state.v030VirtualBlockSlots / maxBarScale) * 100);
  const phantomPct = Math.round((state.phantomSlots / maxBarScale) * 100);
  const mainKvPct = Math.round((state.mainKvBytesPerCard / CP_MAIN_KV_BYTES_PER_TOK_LAYER) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 }}>
      <svg
        className="cp-desktop-svg"
        viewBox="0 0 860 244"
        width="860"
        height="244"
        style={{ width: "100%", maxWidth: "900px", height: "auto" }}
        role="img"
        aria-label={`逻辑位置 p${state.windowStart} 至 p${state.windowStart + 7} 在 DCP=${state.dcpSize}、生效粒度=${state.effectiveInterleaveSize} 下的落槽映射`}
      >
        <defs>
          <marker
            id={mTeal}
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M0,1.5 L8.5,5 L0,8.5 z" fill="var(--color-token)" />
          </marker>
        </defs>

        <text x="16" y="20" fontSize="13" fontWeight="700" fill="var(--color-ink)">
          {`① 历史落槽（DCP=${state.dcpSize} · 生效粒度=${state.effectiveInterleaveSize}${
            state.sfaOverrodeInterleave ? "·SFA覆写" : ""
          }${!state.isTopologyValid ? "·假设演算" : ""}）`}
        </text>
        <text x="844" y="20" textAnchor="end" fontSize="12" fontWeight="700" fill="var(--color-kv)">
          {state.pcpSize === 2 ? "查询配对：头尾各半 (18对)" : "查询配对：单组共算 (36对)"}
        </text>

        <text x="16" y="52" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
          位置归属
        </text>
        {state.visiblePositions.map((pos, idx) => {
          const owner = state.positionOwners[idx]!;
          const swatch = RANK_SWATCHES[owner % RANK_SWATCHES.length]!;
          const cellX = 112 + idx * 91;
          return (
            <g key={pos}>
              <rect
                x={cellX}
                y="32"
                width="82"
                height="28"
                rx="5"
                fill={swatch.bg}
                stroke={swatch.border}
                strokeWidth="1.4"
                style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
              />
              <text
                x={cellX + 41}
                y="51"
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill="var(--color-ink)"
              >
                {`p${pos}→R${owner}`}
              </text>
            </g>
          );
        })}

        <line x1="16" y1="68" x2="844" y2="68" stroke="var(--color-line)" strokeWidth="1" />

        {state.rankRows.map((row, rIdx) => {
          const rowY = 78 + rIdx * 40;
          const swatch = RANK_SWATCHES[rIdx % RANK_SWATCHES.length]!;
          return (
            <g key={row.dcpRank}>
              <text x="16" y={rowY + 20} fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
                {`DCP R${row.dcpRank}`}
              </text>
              {row.slotMapping.map((slotVal, pIdx) => {
                const pos = state.visiblePositions[pIdx]!;
                const cellX = 112 + pIdx * 91;
                const isLocal = slotVal !== -1;
                return (
                  <g key={pos}>
                    <rect
                      x={cellX}
                      y={rowY}
                      width="82"
                      height="30"
                      rx="5"
                      fill={isLocal ? swatch.bg : "var(--color-surface-sunken)"}
                      stroke={isLocal ? swatch.border : "var(--color-line)"}
                      strokeWidth={isLocal ? "1.4" : "1.1"}
                      strokeDasharray={isLocal ? undefined : "3 2"}
                      style={{ transition: "fill 0.24s ease, stroke 0.24s ease" }}
                    />
                    <text
                      x={cellX + 41}
                      y={rowY + 20}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight={isLocal ? "700" : "500"}
                      fill="var(--color-ink)"
                    >
                      {isLocal ? `槽 ${slotVal}` : "跳过"}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      <div className="cp-mobile-stack">
        <div
          className="wiki-edu-note-card"
          style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "6px" }}
        >
          {state.visiblePositions.map((pos, idx) => {
            const owner = state.positionOwners[idx]!;
            const swatch = RANK_SWATCHES[owner % RANK_SWATCHES.length]!;
            return (
              <div
                key={pos}
                style={{
                  padding: "4px 6px",
                  borderRadius: "6px",
                  background: swatch.bg,
                  border: `1px solid ${swatch.border}`,
                  textAlign: "center",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--color-ink)",
                }}
              >
                {`p${pos}→R${owner}`}
              </div>
            );
          })}
        </div>
        {state.rankRows.map((row, rIdx) => {
          const swatch = RANK_SWATCHES[rIdx % RANK_SWATCHES.length]!;
          const mappedPairs = state.visiblePositions
            .map((pos, pIdx) => {
              const slotVal = row.slotMapping[pIdx]!;
              return slotVal === -1 ? null : `p${pos}→槽${slotVal}`;
            })
            .filter((item): item is string => item !== null);
          return (
            <div
              key={row.dcpRank}
              className="wiki-edu-note-card"
              style={{ borderLeft: `4px solid ${swatch.border}`, minWidth: 0 }}
            >
              <strong>{`DCP R${row.dcpRank}`}</strong>：
              {mappedPairs.length > 0 ? mappedPairs.join(" · ") : "本窗口全部跳过"}
            </div>
          );
        })}
      </div>

      {paramDrawer}

      <div className="wiki-edu-dual-grid">
        <div className={`wiki-edu-panel${!state.isTopologyValid ? " is-oom" : ""}`}>
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">② 虚拟块同比例对照（物理块 = 16）</span>
            <span className={`wiki-edu-badge ${state.panel2BadgeTone}`} data-testid="cp-panel2-badge">
              {state.panel2BadgeText}
            </span>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>{`✓ 新公式：16 × DCP(${state.dcpSize})`}</span>
              <strong>{`${state.v030VirtualBlockSlots} 槽`}</strong>
            </div>
            <div
              style={{
                display: "flex",
                height: "18px",
                borderRadius: "6px",
                background: "var(--color-surface-sunken)",
                overflow: "hidden",
              }}
            >
              <div
                data-testid="cp-v030-bar"
                style={{
                  width: `${v030Pct}%`,
                  background: "var(--color-token-soft)",
                  border: "1.5px solid var(--color-token)",
                  borderRadius: "6px",
                  transition: "width 0.25s ease",
                }}
              />
            </div>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>{`✗ 旧式误乘：16 × PCP(${state.pcpSize}) × DCP(${state.dcpSize})`}</span>
              <strong style={{ color: state.phantomSlots > 0 ? "var(--color-danger)" : "var(--color-ink)" }}>
                {state.phantomSlots > 0
                  ? `${state.v030VirtualBlockSlots} + ${state.phantomSlots} 幽灵槽 = ${state.legacyOverMultipliedSlots} 槽`
                  : `${state.legacyOverMultipliedSlots} 槽`}
              </strong>
            </div>
            <div
              style={{
                display: "flex",
                height: "18px",
                borderRadius: "6px",
                background: "var(--color-surface-sunken)",
                overflow: "hidden",
                gap: "2px",
              }}
            >
              <div
                style={{
                  width: `${v030Pct}%`,
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-line)",
                  borderRadius: "5px",
                  transition: "width 0.25s ease",
                }}
              />
              {state.phantomSlots > 0 && (
                <div
                  data-testid="cp-phantom-bar"
                  style={{
                    width: `${phantomPct}%`,
                    background: "var(--color-accent-soft)",
                    border: "1.4px dashed var(--color-danger)",
                    borderRadius: "5px",
                    transition: "width 0.25s ease",
                  }}
                />
              )}
            </div>
          </div>

          {!state.isTopologyValid && state.recommendedFix && (
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="cp-fix-topology"
              style={tokenBtnStyle(false)}
              onClick={onApplySafeTopology}
            >
              {state.recommendedFix.label}
            </button>
          )}
        </div>

        <div className="wiki-edu-panel">
          <div className="wiki-edu-panel-head">
            <span className="wiki-edu-panel-title">③ 显存切分与通信边界</span>
            <span className="wiki-edu-badge is-mid">{`总卡数 ${state.totalDevices} 张`}</span>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>{`主缓存（÷ DCP=${state.dcpSize} 按位置分片）`}</span>
              <strong>{`${state.mainKvBytesPerCard} B / 词·层`}</strong>
            </div>
            <div
              style={{
                display: "flex",
                height: "18px",
                borderRadius: "5px",
                background: "var(--color-surface-sunken)",
                overflow: "hidden",
              }}
            >
              <div
                data-testid="cp-main-kv-bar"
                style={{
                  width: `${mainKvPct}%`,
                  background: "color-mix(in srgb, var(--color-kv) 22%, var(--color-surface-elevated))",
                  border: "1.5px solid var(--color-kv)",
                  borderRadius: "5px",
                  transition: "width 0.25s ease",
                }}
              />
            </div>
          </div>

          <div className="wiki-edu-lane-box">
            <div className="wiki-edu-lane-label">
              <span>
                {state.attnMode === "sfa-sparse" ? "稀疏索引副本（不除 DCP）" : "索引副本（标准层无）"}
              </span>
              <strong>{state.attnMode === "sfa-sparse" ? "64 B / 词·层" : "0 B"}</strong>
            </div>
            <div
              style={{
                display: "flex",
                height: "18px",
                borderRadius: "5px",
                background:
                  state.attnMode === "sfa-sparse"
                    ? "var(--color-weight-soft)"
                    : "var(--color-surface-sunken)",
                border:
                  state.attnMode === "sfa-sparse"
                    ? "1.3px solid var(--color-weight)"
                    : "1.1px dashed var(--color-line)",
                transition: "background 0.25s ease, border-color 0.25s ease",
              }}
            />
          </div>

          <div className="wiki-edu-note-card">
            <strong>建组与下标边界</strong>：DCP 复用现有 TP/PCP 设备时仍须建独立通信组；TP 序号、DCP
            序号与物理卡号三者独立。
          </div>
        </div>
      </div>
    </div>
  );
}
