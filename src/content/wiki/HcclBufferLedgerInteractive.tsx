import { type KeyboardEvent, useId, useMemo, useState } from "react";
import { shouldPassKeyToRangeInput } from "./GqaSharedKvInteractive";
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

export const HCCL_BUFFER_LEDGER_APPROVED_SHA256 =
  "8a65f4c1611fba4e11f5f49087da0c595b2d38d420974dbbcb49af6fb0a691d8";
export const HCCL_BUFFER_FIG_DOMAIN_LEDGER_APPROVED_SHA256 = HCCL_BUFFER_LEDGER_APPROVED_SHA256;

export const HCCL_TP_SIZES = [2, 4, 8] as const;
export type HcclTpSize = (typeof HCCL_TP_SIZES)[number];
export const HCCL_EP_RANK_MODES = ["off", "share-tp", "distinct"] as const;
export type HcclEpRankMode = (typeof HCCL_EP_RANK_MODES)[number];
export type HcclLedgerDiagramMode = "sandbox" | "svg";

export const HCCL_DEFAULT_GROUP_MIB = 200;
export const HCCL_DYNAMIC_EPLB_GROUP_MIB = 100;
export const HCCL_MIN_DP_GROUP_MIB = 50;
export const HCCL_SLEEP_ANCHOR_GROUP_MIB = 1;
export const DISPATCH_FFN_COMBINE_MARGIN_MIB = 10;

export interface HcclLedgerGroupItem {
  readonly groupName: string;
  readonly ranksTuple: string;
  readonly backend: "hccl";
  readonly optionsBufferMiB: number | null;
  readonly effectiveBufferMiB: number;
  readonly reuseDomain: "shared" | "mc2" | "dynamic_eplb";
  readonly registryKey: string;
  readonly deduplicatedInto: string | null;
  readonly isSingleRank: boolean;
}

export interface HcclBufferLedgerInput {
  readonly hcclBuffsizeMiB: number;
  readonly tpSize?: number | undefined;
  readonly pcpSize?: number | undefined;
  readonly dpEnabled?: boolean | undefined;
  readonly dpSize?: number | undefined;
  readonly epMode?: HcclEpRankMode | undefined;
  readonly dynamicEplb?: boolean | undefined;
  readonly sleepAnchor?: boolean | undefined;
  readonly fusedMc2Active?: boolean | undefined;
  readonly fusedMc2Tokens?: number | undefined;
  readonly hiddenSize?: number | undefined;
  readonly topK?: number | undefined;
  readonly hcclBuffsizeEpSet?: boolean | undefined;
}

export interface HcclBufferLedgerState {
  readonly hcclBuffsizeMiB: number;
  readonly tpSize: number;
  readonly pcpSize: number;
  readonly dpSize: number;
  readonly dpBufferMiB: number;
  readonly mc2GroupRankCount: number;
  readonly epMode: HcclEpRankMode;
  readonly dynamicEplb: boolean;
  readonly sleepAnchor: boolean;
  readonly fusedMc2Active: boolean;
  readonly windowCheckActive: boolean;
  readonly fusedMc2Tokens: number;
  readonly hiddenSize: number;
  readonly topK: number;
  readonly hcclBuffsizeEpSet: boolean;
  readonly logicalGroups: readonly HcclLedgerGroupItem[];
  readonly uniqueDomains: readonly HcclLedgerGroupItem[];
  readonly logicalGroupCount: number;
  readonly uniqueDomainCount: number;
  readonly deduplicatedCount: number;
  readonly naiveConfigSumMiB: number;
  readonly dedupedConfigSumMiB: number;
  readonly savedByDedupMiB: number;
  readonly savedDefaultDomainMiB: number;
  readonly multiRankActiveSumMiB: number;
  readonly cannDuplexBudgetMiB: number;
  readonly mc2WindowPayloadBytes: number;
  readonly mc2RequiredWindowMiB: number;
  readonly isMc2WindowOverflow: boolean;
  readonly mc2WindowMarginMiB: number;
  readonly mc2WindowDeficitMiB: number;
  readonly recommendedBuffsizeMiB: number;
  readonly needsRemediation: boolean;
  readonly takeawayBadge: string;
  readonly takeawayTone: EduBadgeTone;
  readonly summaryText: string;
}

export function computeDpGroupBufferMiB(dpSize: number): number {
  const safeDp = Math.max(1, Math.round(dpSize));
  const rawMiB = Math.ceil(((safeDp + 1) * 4) / (1024 * 1024));
  return Math.max(rawMiB, HCCL_MIN_DP_GROUP_MIB);
}

export function computeFusedMc2WindowMiB(
  mTokens: number,
  hiddenSize = 4096,
  topK = 8,
): {
  readonly payloadBytes: number;
  readonly totalBytes: number;
  readonly requiredMiB: number;
} {
  const safeM = Math.max(1, Math.round(mTokens));
  const safeK = Math.max(1, Math.round(hiddenSize));
  const safeTopK = Math.max(1, Math.round(topK));
  const payloadBytes = safeM * safeK * safeTopK * 1 * 3;
  const totalBytes = payloadBytes + DISPATCH_FFN_COMBINE_MARGIN_MIB * 1024 * 1024;
  const requiredMiB = Math.ceil(totalBytes / (1024 * 1024));
  return { payloadBytes, totalBytes, requiredMiB };
}

function formatRankTuple(ranks: readonly number[]): string {
  if (ranks.length > 4 && ranks.every((r, idx) => r === idx)) {
    return `[0..${ranks.length - 1}]`;
  }
  return `[${ranks.join(",")}]`;
}

function permuteRanksDistinctOrder(ranks: readonly number[]): number[] {
  if (ranks.length <= 1) return [...ranks];
  if (ranks.length === 2) return [ranks[1]!, ranks[0]!];
  const evens = ranks.filter((_, idx) => idx % 2 === 0);
  const odds = ranks.filter((_, idx) => idx % 2 === 1);
  return [...evens, ...odds];
}

export function computeHcclBufferLedgerState(input: HcclBufferLedgerInput): HcclBufferLedgerState {
  const hcclBuffsizeMiB = Math.min(1024, Math.max(32, Math.round(input.hcclBuffsizeMiB)));
  const tpSize = Math.max(1, Math.round(input.tpSize ?? 4));
  const pcpSize = Math.max(1, Math.round(input.pcpSize ?? 1));
  const dpSize = input.dpSize !== undefined ? Math.max(1, Math.round(input.dpSize)) : input.dpEnabled ? 2 : 1;
  const dpBufferMiB = computeDpGroupBufferMiB(dpSize);
  const epMode: HcclEpRankMode = input.epMode ?? "share-tp";
  const dynamicEplb = Boolean(input.dynamicEplb);
  const sleepAnchor = input.sleepAnchor ?? true;
  const fusedMc2Active = input.fusedMc2Active ?? true;
  const fusedMc2Tokens = Math.min(8192, Math.max(1, Math.round(input.fusedMc2Tokens ?? 512)));
  const hiddenSize = Math.max(256, Math.round(input.hiddenSize ?? 4096));
  const topK = Math.max(1, Math.round(input.topK ?? 8));
  const hcclBuffsizeEpSet = Boolean(input.hcclBuffsizeEpSet);

  const worldSize = tpSize * pcpSize * dpSize;
  const mc2GroupRankCount = dpSize * pcpSize * tpSize;
  const worldRanks = Array.from({ length: worldSize }, (_, i) => i);
  const tpRanks = Array.from({ length: tpSize }, (_, i) => i);
  const pcpRanks = Array.from({ length: pcpSize }, (_, i) => i);
  const dpRanks = Array.from({ length: dpSize }, (_, i) => i * pcpSize * tpSize);
  const mc2Ranks = Array.from({ length: mc2GroupRankCount }, (_, i) => i);
  const epRanks = epMode === "share-tp" ? mc2Ranks : permuteRanksDistinctOrder(mc2Ranks);

  const worldTuple = formatRankTuple(worldRanks);
  const tpTuple = formatRankTuple(tpRanks);
  const pcpTuple = formatRankTuple(pcpRanks);
  const dpTuple = formatRankTuple(dpRanks);
  const mc2Tuple = formatRankTuple(mc2Ranks);
  const epTuple = formatRankTuple(epRanks);

  const rawEntries: Array<{
    groupName: string;
    ranks: readonly number[];
    ranksTuple: string;
    optionsBufferMiB: number | null;
    reuseDomain: "shared" | "mc2" | "dynamic_eplb";
    isSingleRank: boolean;
  }> = [
    {
      groupName: "world",
      ranks: worldRanks,
      ranksTuple: worldTuple,
      optionsBufferMiB: HCCL_DEFAULT_GROUP_MIB,
      reuseDomain: "shared",
      isSingleRank: worldSize === 1,
    },
    {
      groupName: "tp",
      ranks: tpRanks,
      ranksTuple: tpTuple,
      optionsBufferMiB: HCCL_DEFAULT_GROUP_MIB,
      reuseDomain: "shared",
      isSingleRank: tpSize === 1,
    },
    {
      groupName: "dcp",
      ranks: [0],
      ranksTuple: "[0]",
      optionsBufferMiB: HCCL_DEFAULT_GROUP_MIB,
      reuseDomain: "shared",
      isSingleRank: true,
    },
    {
      groupName: "pcp",
      ranks: pcpRanks,
      ranksTuple: pcpTuple,
      optionsBufferMiB: HCCL_DEFAULT_GROUP_MIB,
      reuseDomain: "shared",
      isSingleRank: pcpSize === 1,
    },
    {
      groupName: "pp",
      ranks: [0],
      ranksTuple: "[0]",
      optionsBufferMiB: HCCL_DEFAULT_GROUP_MIB,
      reuseDomain: "shared",
      isSingleRank: true,
    },
    {
      groupName: "dp",
      ranks: dpRanks,
      ranksTuple: dpTuple,
      optionsBufferMiB: dpBufferMiB,
      reuseDomain: "shared",
      isSingleRank: dpSize === 1,
    },
  ];

  if (epMode !== "off") {
    rawEntries.push({
      groupName: "ep",
      ranks: epRanks,
      ranksTuple: epTuple,
      optionsBufferMiB: HCCL_DEFAULT_GROUP_MIB,
      reuseDomain: "shared",
      isSingleRank: mc2GroupRankCount === 1,
    });
  }

  // parallel_state.py#L153-L163: _MC2 is ALWAYS initialized (even without EP), spanning DP*PCP*TP ranks
  rawEntries.push({
    groupName: "mc2",
    ranks: mc2Ranks,
    ranksTuple: mc2Tuple,
    optionsBufferMiB: null,
    reuseDomain: "mc2",
    isSingleRank: mc2GroupRankCount === 1,
  });

  if (dynamicEplb) {
    rawEntries.push({
      groupName: "dynamic_eplb",
      ranks: mc2Ranks,
      ranksTuple: mc2Tuple,
      optionsBufferMiB: HCCL_DYNAMIC_EPLB_GROUP_MIB,
      reuseDomain: "dynamic_eplb",
      isSingleRank: mc2GroupRankCount === 1,
    });
  }

  if (sleepAnchor) {
    rawEntries.push({
      groupName: "sleep_lifecycle_anchor",
      ranks: worldRanks,
      ranksTuple: worldTuple,
      optionsBufferMiB: HCCL_SLEEP_ANCHOR_GROUP_MIB,
      reuseDomain: "shared",
      isSingleRank: worldSize === 1,
    });
  }
  const seenKeys = new Map<string, string>();
  const logicalGroups: HcclLedgerGroupItem[] = [];
  const uniqueDomains: HcclLedgerGroupItem[] = [];

  for (const raw of rawEntries) {
    const effectiveBufferMiB = raw.optionsBufferMiB ?? hcclBuffsizeMiB;
    const optionsSig =
      raw.optionsBufferMiB === null ? "options=None(env)" : `options=${raw.optionsBufferMiB} MiB`;
    const orderedRanksSig = `[${raw.ranks.join(",")}]`;
    const registryKey = `(${orderedRanksSig}, hccl, ${optionsSig}, ${raw.reuseDomain})`;
    const owner = seenKeys.get(registryKey) ?? null;
    const item: HcclLedgerGroupItem = {
      groupName: raw.groupName,
      ranksTuple: raw.ranksTuple,
      backend: "hccl",
      optionsBufferMiB: raw.optionsBufferMiB,
      effectiveBufferMiB,
      reuseDomain: raw.reuseDomain,
      registryKey,
      deduplicatedInto: owner,
      isSingleRank: raw.isSingleRank,
    };
    logicalGroups.push(item);
    if (owner === null) {
      seenKeys.set(registryKey, raw.groupName);
      uniqueDomains.push(item);
    }
  }

  const logicalGroupCount = logicalGroups.length;
  const uniqueDomainCount = uniqueDomains.length;
  const deduplicatedCount = logicalGroupCount - uniqueDomainCount;
  const naiveConfigSumMiB = logicalGroups.reduce((acc, g) => acc + g.effectiveBufferMiB, 0);
  const dedupedConfigSumMiB = uniqueDomains.reduce((acc, g) => acc + g.effectiveBufferMiB, 0);
  const savedByDedupMiB = naiveConfigSumMiB - dedupedConfigSumMiB;
  const savedDefaultDomainMiB = logicalGroups
    .filter((g) => g.deduplicatedInto !== null && g.optionsBufferMiB === HCCL_DEFAULT_GROUP_MIB)
    .reduce((acc, g) => acc + g.effectiveBufferMiB, 0);
  const multiRankActiveSumMiB = uniqueDomains
    .filter((g) => !g.isSingleRank)
    .reduce((acc, g) => acc + g.effectiveBufferMiB, 0);
  const cannDuplexBudgetMiB = hcclBuffsizeMiB * 2;

  const win = computeFusedMc2WindowMiB(fusedMc2Tokens, hiddenSize, topK);
  const mc2WindowPayloadBytes = win.payloadBytes;
  const mc2RequiredWindowMiB = win.requiredMiB;
  const windowCheckActive = epMode !== "off" && fusedMc2Active;
  const isMc2WindowOverflow = windowCheckActive && mc2RequiredWindowMiB > hcclBuffsizeMiB;
  const mc2WindowMarginMiB = Math.max(0, hcclBuffsizeMiB - mc2RequiredWindowMiB);
  const mc2WindowDeficitMiB = Math.max(0, mc2RequiredWindowMiB - hcclBuffsizeMiB);

  const recommendedBuffsizeMiB = Math.min(
    1024,
    Math.max(
      HCCL_DEFAULT_GROUP_MIB,
      mc2RequiredWindowMiB <= 200
        ? 200
        : mc2RequiredWindowMiB <= 256
          ? 256
          : mc2RequiredWindowMiB <= 512
            ? 512
            : 1024,
    ),
  );
  const needsRemediation = isMc2WindowOverflow || hcclBuffsizeEpSet;

  let takeawayBadge: string;
  let takeawayTone: EduBadgeTone;
  let summaryText: string;

  if (isMc2WindowOverflow && hcclBuffsizeEpSet) {
    takeawayBadge = "窗口越界 + 无效变量";
    takeawayTone = "danger";
    summaryText = `融合窗口需 ${mc2RequiredWindowMiB} MiB > 配额 ${hcclBuffsizeMiB} MiB 报错；专用 EP 环境变量仓内零读取（闭源 CANN 内部行为待核），融合算子仅认主缓冲变量！`;
  } else if (isMc2WindowOverflow) {
    takeawayBadge = "融合窗口不足报错";
    takeawayTone = "danger";
    summaryText = `本批 ${fusedMc2Tokens} 词要求窗口 ${mc2RequiredWindowMiB} MiB，超出主缓冲配额 ${hcclBuffsizeMiB} MiB（缺口 ${mc2WindowDeficitMiB} MiB），直接触发窗口过小报错！`;
  } else if (hcclBuffsizeEpSet) {
    takeawayBadge = "专用 EP 变量零读取";
    takeawayTone = "warn";
    summaryText = `仓内代码对该 EP 环境变量 0 处读取（闭源 CANN 内部行为待核），EP 组仍按默认 200 MiB，融合算子只读主配额 ${hcclBuffsizeMiB} MiB。`;
  } else if (!fusedMc2Active) {
    takeawayBadge = "停用融合算子 · 略过校验";
    takeawayTone = "default";
    summaryText = `${logicalGroupCount} 个逻辑组去重后保留 ${uniqueDomainCount} 个独立域（融合域 ${mc2GroupRankCount} 卡仍驻留 ${hcclBuffsizeMiB} MiB）；本步未启用融合 MC2 算子，跳过逐批窗口校验。`;
  } else {
    takeawayBadge = `去重省 ${savedByDedupMiB} MiB 虚账`;
    takeawayTone = "default";
    summaryText = `${logicalGroupCount} 个逻辑组傻乘高达 ${naiveConfigSumMiB} MiB，去重后仅建 ${uniqueDomainCount} 个独立域（配置口径 ${dedupedConfigSumMiB} MiB；融合域按 ${mc2GroupRankCount} 卡必建，KV 仅扣实测增量）。`;
  }

  return {
    hcclBuffsizeMiB,
    tpSize,
    pcpSize,
    dpSize,
    dpBufferMiB,
    mc2GroupRankCount,
    epMode,
    dynamicEplb,
    sleepAnchor,
    fusedMc2Active,
    windowCheckActive,
    fusedMc2Tokens,
    hiddenSize,
    topK,
    hcclBuffsizeEpSet,
    logicalGroups,
    uniqueDomains,
    logicalGroupCount,
    uniqueDomainCount,
    deduplicatedCount,
    naiveConfigSumMiB,
    dedupedConfigSumMiB,
    savedByDedupMiB,
    savedDefaultDomainMiB,
    multiRankActiveSumMiB,
    cannDuplexBudgetMiB,
    mc2WindowPayloadBytes,
    mc2RequiredWindowMiB,
    isMc2WindowOverflow,
    mc2WindowMarginMiB,
    mc2WindowDeficitMiB,
    recommendedBuffsizeMiB,
    needsRemediation,
    takeawayBadge,
    takeawayTone,
    summaryText,
  };
}

export interface HcclBufferLedgerInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: HcclLedgerDiagramMode | undefined;
  readonly initialHcclBuffsizeMiB?: number | undefined;
  readonly initialTpSize?: HcclTpSize | undefined;
  readonly initialDpEnabled?: boolean | undefined;
  readonly initialEpMode?: HcclEpRankMode | undefined;
  readonly initialDynamicEplb?: boolean | undefined;
  readonly initialSleepAnchor?: boolean | undefined;
  readonly initialFusedMc2Active?: boolean | undefined;
  readonly initialFusedMc2Tokens?: number | undefined;
  readonly initialHcclBuffsizeEpSet?: boolean | undefined;
}

export function HcclBufferLedgerInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialHcclBuffsizeMiB = 200,
  initialTpSize = 4,
  initialDpEnabled = false,
  initialEpMode = "share-tp",
  initialDynamicEplb = true,
  initialSleepAnchor = true,
  initialFusedMc2Active = true,
  initialFusedMc2Tokens = 512,
  initialHcclBuffsizeEpSet = false,
}: HcclBufferLedgerInteractiveProps) {
  const [mode, setMode] = useState<HcclLedgerDiagramMode>(initialMode);
  const [hcclBuffsizeMiB, setHcclBuffsizeMiB] = useState<number>(initialHcclBuffsizeMiB);
  const [tpSize, setTpSize] = useState<HcclTpSize>(initialTpSize);
  const [dpEnabled, setDpEnabled] = useState<boolean>(initialDpEnabled);
  const [epMode, setEpMode] = useState<HcclEpRankMode>(initialEpMode);
  const [dynamicEplb, setDynamicEplb] = useState<boolean>(initialDynamicEplb);
  const [sleepAnchor, setSleepAnchor] = useState<boolean>(initialSleepAnchor);
  const [fusedMc2Active, setFusedMc2Active] = useState<boolean>(initialFusedMc2Active);
  const [fusedMc2Tokens, setFusedMc2Tokens] = useState<number>(initialFusedMc2Tokens);
  const [hcclBuffsizeEpSet, setHcclBuffsizeEpSet] = useState<boolean>(initialHcclBuffsizeEpSet);

  const buffSliderId = useId();
  const tokSliderId = useId();

  const state = useMemo(
    () =>
      computeHcclBufferLedgerState({
        hcclBuffsizeMiB,
        tpSize,
        dpEnabled,
        epMode,
        dynamicEplb,
        sleepAnchor,
        fusedMc2Active,
        fusedMc2Tokens,
        hcclBuffsizeEpSet,
      }),
    [
      hcclBuffsizeMiB,
      tpSize,
      dpEnabled,
      epMode,
      dynamicEplb,
      sleepAnchor,
      fusedMc2Active,
      fusedMc2Tokens,
      hcclBuffsizeEpSet,
    ],
  );

  const applyRemediation = () => {
    setMode("sandbox");
    setHcclBuffsizeEpSet(false);
    if (state.isMc2WindowOverflow) {
      setHcclBuffsizeMiB(state.recommendedBuffsizeMiB);
    }
  };

  const applyOverflowPreset = () => {
    setMode("sandbox");
    setEpMode("share-tp");
    setFusedMc2Active(true);
    setHcclBuffsizeMiB(200);
    setFusedMc2Tokens(2048);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (shouldPassKeyToRangeInput(event.target, event.key)) return;
    if (
      scrollable &&
      typeof Element !== "undefined" &&
      event.target instanceof Element &&
      event.target.classList.contains("wiki-diagram-svg") &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      return;
    }
    const epIdx = HCCL_EP_RANK_MODES.indexOf(epMode);
    switch (event.key) {
      case "0":
      case "Escape":
        event.preventDefault();
        setMode("svg");
        break;
      case "ArrowRight":
        event.preventDefault();
        setMode("sandbox");
        setEpMode(HCCL_EP_RANK_MODES[Math.min(HCCL_EP_RANK_MODES.length - 1, epIdx + 1)]!);
        break;
      case "ArrowLeft":
        event.preventDefault();
        setMode("sandbox");
        setEpMode(HCCL_EP_RANK_MODES[Math.max(0, epIdx - 1)]!);
        break;
    }
  };

  const ledgerMaxMiB = Math.max(
    HCCL_DEFAULT_GROUP_MIB,
    state.hcclBuffsizeMiB,
    state.dpBufferMiB,
    HCCL_DYNAMIC_EPLB_GROUP_MIB,
  );
  const toLedgerBarPx = (mib: number) =>
    Number(Math.min(136, Math.max(0, (mib / ledgerMaxMiB) * 136)).toFixed(2));
  const defaultRowBarPx = toLedgerBarPx(HCCL_DEFAULT_GROUP_MIB);
  const eplbRowBarPx = toLedgerBarPx(HCCL_DYNAMIC_EPLB_GROUP_MIB);
  const dpRowBarPx = toLedgerBarPx(state.dpBufferMiB);
  const sleepRowBarPx = toLedgerBarPx(HCCL_SLEEP_ANCHOR_GROUP_MIB);
  const mc2RowBarPx = toLedgerBarPx(state.hcclBuffsizeMiB);

  const mc2BarMax = Math.max(1, state.hcclBuffsizeMiB, state.mc2RequiredWindowMiB);
  const mc2DemandBarPx = Number(
    Math.min(340, Math.max(0, (state.mc2RequiredWindowMiB / mc2BarMax) * 340)).toFixed(2),
  );
  const mc2QuotaBarPx = Number(
    Math.min(340, Math.max(0, (state.hcclBuffsizeMiB / mc2BarMax) * 340)).toFixed(2),
  );
  const mobileMc2QuotaPct =
    state.hcclBuffsizeMiB > 0
      ? Number(
          Math.min(100, Math.max(0, (state.mc2RequiredWindowMiB / state.hcclBuffsizeMiB) * 100)).toFixed(2),
        )
      : 0;

  const isOverflowPresetActive =
    mode === "sandbox" &&
    epMode === "share-tp" &&
    fusedMc2Active &&
    hcclBuffsizeMiB === 200 &&
    fusedMc2Tokens === 2048;

  const hcclKpi = state.isMc2WindowOverflow
    ? `缺口 ${state.mc2WindowDeficitMiB} MiB`
    : state.hcclBuffsizeEpSet
      ? "EP 变量未读取"
      : `去重 ${state.uniqueDomainCount} 域 (${state.dedupedConfigSumMiB} MiB)`;

  return (
    <WikiEduSandboxShell
      id={id}
      caption={caption}
      safeSvg={safeSvg}
      mode={mode}
      onToggleMode={setMode}
      scrollRef={scrollRef}
      scrollable={scrollable}
      onScroll={onScroll}
      kickerTag="母版 B · 通信域账本与去重"
      kickerTitle="HCCL Buffer 逐通信域分派与四元组去重账本（v0.30.0）"
      question="进程里建了十来个通信组，为什么直接把「逻辑组数 × 200 MiB」乘出来算显存一定会算错？"
      toolbarLabel="EP 成员复用模式、融合批长与超窗预设控制"
      onToolbarKeyDown={handleKeyDown}
      useTokenVariables
      extraRootAttrs={{
        "data-buffsize": state.hcclBuffsizeMiB,
        "data-tp-size": state.tpSize,
        "data-ep-mode": state.epMode,
        "data-dp-size": state.dpSize,
        "data-unique-domains": state.uniqueDomainCount,
        "data-fused-mc2-active": state.fusedMc2Active ? "true" : "false",
        "data-mc2-overflow": state.isMc2WindowOverflow ? "true" : "false",
        "data-dead-env": state.hcclBuffsizeEpSet ? "true" : "false",
      }}
      toolbar={
        <>
          <fieldset className="wiki-edu-btn-row" aria-label="TP 与 EP 成员复用模式">
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="hccl-ep-off"
              aria-pressed={mode === "sandbox" && epMode === "off"}
              style={tokenBtnStyle(mode === "sandbox" && epMode === "off", "dark")}
              onClick={() => {
                setMode("sandbox");
                setEpMode("off");
              }}
            >
              {`纯 TP=${tpSize}`}
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="hccl-ep-share-tp"
              aria-pressed={mode === "sandbox" && epMode === "share-tp"}
              style={tokenBtnStyle(mode === "sandbox" && epMode === "share-tp", "teal")}
              onClick={() => {
                setMode("sandbox");
                setEpMode("share-tp");
              }}
            >
              EP 复用
            </button>
            <button
              type="button"
              className="wiki-edu-btn"
              data-testid="hccl-ep-distinct"
              aria-pressed={mode === "sandbox" && epMode === "distinct"}
              style={tokenBtnStyle(mode === "sandbox" && epMode === "distinct", "dark")}
              onClick={() => {
                setMode("sandbox");
                setEpMode("distinct");
              }}
            >
              EP 异序
            </button>
          </fieldset>

          <fieldset className="wiki-edu-btn-row" aria-label="融合批长滑块">
            <label
              htmlFor={tokSliderId}
              className={`wiki-edu-slider-chip${state.isMc2WindowOverflow ? " is-oom" : ""}`}
            >
              <span className="mono">{`m=${state.fusedMc2Tokens}`}</span>
              <input
                id={tokSliderId}
                type="range"
                min={Math.min(64, state.fusedMc2Tokens)}
                max={8192}
                step={64}
                value={state.fusedMc2Tokens}
                data-testid="hccl-mc2-tokens-slider"
                aria-valuetext={`融合 MC2 批词数 ${state.fusedMc2Tokens}`}
                onPointerDown={() => setMode("sandbox")}
                onChange={(e) => {
                  setMode("sandbox");
                  setFusedMc2Tokens(Number(e.target.value));
                }}
              />
            </label>
          </fieldset>
        </>
      }
      takeawayBadge={state.takeawayBadge}
      takeawayTone={state.takeawayTone}
      takeaway={state.summaryText}
      kpi={hcclKpi}
      detailsSummary="查看工程与源码细节（分派常量 / 四元组注册清单 / 窗口公式与死变量）"
      detailsContent={
        <>
          源码锚点：<code>vllm-ascend@c09d3e20:vllm_ascend/utils.py#L73-L77, #L1249-L1289</code>（
          <code>get_hccl_config_for_pg_options</code> + <code>calculate_dp_buffer_size</code>：默认{" "}
          <code>_DEFAULT_BUFFER_SIZE = 200</code> MiB、<code>dynamic_eplb</code>{" "}
          <code>_DYNAMIC_EPLB_BUFFER_SIZE = 100</code> MiB、<code>dp</code>{" "}
          <code>max(ceil((dp_size+1)*4/1024²), 50)</code> MiB、<code>v0.30.0+</code> 新增{" "}
          <code>SLEEP_LIFECYCLE_ANCHOR_BUFFER_SIZE = 1</code> MiB，而 <code>mc2</code> 返回 <code>None</code>{" "}
          交由环境变量 <code>HCCL_BUFFSIZE</code> 统管）与{" "}
          <code>vllm_ascend/distributed/parallel_state.py#L153-L170</code>（<code>_MC2</code> 无论是否开 EP
          均按 <code>DP×PCP×TP={state.mc2GroupRankCount}</code> 卡初始化，因{" "}
          <code>reuse_domain=&quot;mc2&quot;</code> 且无逐组缓冲字段而独立建域；条件建组为{" "}
          <code>if dynamic_eplb</code>）。注册表 <code>_hccl_pg_registry.py</code> 用四元组{" "}
          <code>(ranks, backend, options, reuse_domain)</code>（<code>make_hccl_pg_key</code>）去重；融合算子{" "}
          <code>
            csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L63-L85, #L283-L290
          </code>
          （<code>GetMaxWindowSize</code>）按{" "}
          <code>{`((m=${state.fusedMc2Tokens} × k=${state.hiddenSize} × topK=${state.topK} × 1B) × 3 + 10 MiB) = ${state.mc2RequiredWindowMiB} MiB`}</code>{" "}
          校验 <code>HCCL_BUFFSIZE</code>；<code>vllm</code> 与 <code>vllm-ascend</code> Python/C++ 对{" "}
          <code>HCCL_BUFFSIZE_EP</code> 0 处读取（闭源 CANN 内部行为待核，<code>DispatchFFNCombine</code>{" "}
          宿主机 tiling 仅校验 <code>HCCL_BUFFSIZE</code>）；KV 预算按建组前 <code>before_create</code>{" "}
          快照实扣非 Torch 内存增量（傻算 <code>{state.naiveConfigSumMiB} MiB</code> vs 去重配置和{" "}
          <code>{state.dedupedConfigSumMiB} MiB</code> vs 跨多卡活跃配置和{" "}
          <code>{state.multiRankActiveSumMiB} MiB</code>）。
          <ul style={{ margin: "6px 0 0", paddingLeft: "18px" }}>
            {state.logicalGroups.map((g) => (
              <li key={g.groupName}>
                <code>
                  {g.groupName}
                  {g.deduplicatedInto ? ` → ${g.deduplicatedInto}` : " (新建域)"}
                </code>
                ：<code>{g.registryKey}</code>
              </li>
            ))}
          </ul>
        </>
      }
    >
      <div className="wiki-edu-w4a-wrap">
        <style>{`
          .wiki-edu-w4a-wrap { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
          @media (min-width: 821px) {
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls {
              flex-wrap: nowrap;
              padding: 8px 10px;
              gap: 6px;
            }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-btn-row {
              flex-wrap: nowrap;
              gap: 4px;
            }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-btn {
              padding: 4px 8px;
              font-size: 12px;
              white-space: nowrap;
              flex-shrink: 0;
            }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-slider-chip {
              padding: 2px 8px;
              gap: 6px;
              font-size: 12px;
              white-space: nowrap;
              flex-shrink: 1;
              min-width: 0;
            }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-slider-chip input[type="range"] {
              width: 72px;
              min-width: 56px;
            }
          }
          .wiki-edu-param-drawer { border: 1px solid var(--color-line); border-radius: 8px; background: var(--color-surface); padding: 7px 11px; font-size: 12.5px; color: var(--color-ink); min-width: 0; }
          .wiki-edu-param-drawer > summary { cursor: pointer; font-weight: 700; color: var(--color-ink); user-select: none; list-style-position: inside; }
          .wiki-edu-param-drawer-body { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--color-line); min-width: 0; }
          .wiki-edu-param-label { font-size: 12px; font-weight: 700; color: var(--color-ink); }
          .wiki-edu-w4a-svg { width: 100%; max-width: 900px; height: auto; display: block; margin-inline: auto; }
          .wiki-edu-w4a-mobile { display: none; flex-direction: column; gap: 8px; min-width: 0; }
          .wiki-edu-w4a-mcard { padding: 9px 11px; border-radius: 8px; border: 1.5px solid var(--color-line); background: var(--color-surface); display: flex; flex-direction: column; gap: 4px; min-width: 0; font-size: 12.5px; line-height: 1.45; color: var(--color-ink); }
          .wiki-edu-w4a-mhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 700; font-size: 13px; }
          .wiki-edu-w4a-mbar-track { width: 100%; height: 12px; border-radius: 6px; background: var(--color-surface-elevated); border: 1px solid var(--color-line); overflow: hidden; }
          .wiki-edu-w4a-mbar-fill { height: 100%; border-radius: 5px; transition: width 240ms ease, background-color 180ms ease; }
          .wiki-edu-w4a-anim { transition: width 240ms ease, fill 180ms ease, stroke 180ms ease; }
          @media (max-width: 820px) {
            .wiki-edu-w4a-svg { display: none; }
            .wiki-edu-w4a-mobile { display: flex; gap: 5px; }
            .wiki-edu-w4a-mcard { padding: 6px 9px; gap: 3px; font-size: 12px; }
            .wiki-edu-w4a-mhead { font-size: 12px; }
            .wiki-edu-w4a-mbar-track { height: 8px; }
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
              padding: 4px 5px;
              font-size: 11px;
              white-space: nowrap;
              flex-shrink: 0;
            }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-slider-chip {
              padding: 2px 5px;
              gap: 4px;
              font-size: 11px;
              white-space: nowrap;
              flex-wrap: nowrap;
              flex-shrink: 1;
              min-width: 0;
            }
            .wiki-edu-card[data-diagram-id="${id}"] .wiki-edu-controls .wiki-edu-slider-chip input[type="range"] {
              width: 44px;
              min-width: 34px;
            }
            .wiki-edu-takeaway-badge, .wiki-edu-kpi, .wiki-edu-static-toggle { white-space: normal; overflow-wrap: anywhere; max-width: 100%; }
            .wiki-edu-note-card, .wiki-edu-details-body { min-width: 0; overflow-wrap: anywhere; }
          }
          @container reader-main (max-width: 820px) {
            .wiki-edu-w4a-svg { display: none; }
            .wiki-edu-w4a-mobile { display: flex; }
          }
        `}</style>

        <svg
          viewBox="0 0 860 296"
          width="860"
          height="296"
          className="wiki-edu-w4a-svg"
          role="img"
          aria-label={`HCCL Buffer 五类通信域分派、去重账本与融合窗口校验（去重后 ${state.uniqueDomainCount} 域）`}
        >
          <rect
            x="12"
            y="10"
            width="446"
            height="276"
            rx="10"
            fill="var(--color-surface)"
            stroke="var(--color-line)"
            strokeWidth="1.4"
          />
          <text x="26" y="32" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            ① 五类缓冲与去重账本
          </text>

          <rect
            x="24"
            y="48"
            width="422"
            height="30"
            rx="6"
            fill="var(--color-kv-soft)"
            stroke="var(--color-kv)"
            strokeWidth="1.3"
          />
          <text x="34" y="68" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            默认域
          </text>
          <rect
            x="136"
            y="56"
            width="136"
            height="14"
            rx="4"
            fill="var(--color-surface-elevated)"
            stroke="var(--color-line)"
          />
          <rect
            x="136"
            y="56"
            width={defaultRowBarPx}
            height="14"
            rx="4"
            className="wiki-edu-w4a-anim"
            fill="var(--color-kv)"
          />
          <text x="438" y="68" textAnchor="end" fontSize="12" fontWeight="700" fill="var(--color-kv)">
            {`200 MiB · 省 ${state.savedDefaultDomainMiB} MiB`}
          </text>

          <rect
            x="24"
            y="88"
            width="422"
            height="30"
            rx="6"
            fill="var(--color-comm-soft)"
            stroke="var(--color-comm)"
            strokeWidth="1.3"
          />
          <text x="34" y="108" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            均衡组
          </text>
          <rect
            x="136"
            y="96"
            width="136"
            height="14"
            rx="4"
            fill="var(--color-surface-elevated)"
            stroke="var(--color-line)"
          />
          {state.dynamicEplb && (
            <rect
              x="136"
              y="96"
              width={eplbRowBarPx}
              height="14"
              rx="4"
              className="wiki-edu-w4a-anim"
              fill="var(--color-comm)"
            />
          )}
          <text x="438" y="108" textAnchor="end" fontSize="12" fontWeight="700" fill="var(--color-comm)">
            {state.dynamicEplb ? "100 MiB · 独立" : "未开启 · 0 MiB"}
          </text>

          <rect
            x="24"
            y="128"
            width="422"
            height="30"
            rx="6"
            fill="var(--color-token-soft)"
            stroke="var(--color-token)"
            strokeWidth="1.3"
          />
          <text x="34" y="148" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            元数据组
          </text>
          <rect
            x="136"
            y="136"
            width="136"
            height="14"
            rx="4"
            fill="var(--color-surface-elevated)"
            stroke="var(--color-line)"
          />
          <rect
            x="136"
            y="136"
            width={dpRowBarPx}
            height="14"
            rx="4"
            className="wiki-edu-w4a-anim"
            fill="var(--color-token)"
          />
          <text x="438" y="148" textAnchor="end" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            {`${state.dpBufferMiB} MiB · 默认 CPU`}
          </text>

          <rect
            x="24"
            y="168"
            width="422"
            height="30"
            rx="6"
            fill="var(--color-surface-sunken)"
            stroke="var(--color-line)"
            strokeWidth="1.3"
          />
          <text x="34" y="188" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            睡眠锚点
          </text>
          <rect
            x="136"
            y="176"
            width="136"
            height="14"
            rx="4"
            fill="var(--color-surface-elevated)"
            stroke="var(--color-line)"
          />
          {state.sleepAnchor && (
            <rect
              x="136"
              y="176"
              width={sleepRowBarPx}
              height="14"
              rx="4"
              className="wiki-edu-w4a-anim"
              fill="var(--color-control)"
            />
          )}
          <text x="438" y="188" textAnchor="end" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            {state.sleepAnchor ? "1 MiB · 按需建" : "未开启 · 0 MiB"}
          </text>

          <rect
            x="24"
            y="208"
            width="422"
            height="30"
            rx="6"
            fill="var(--color-weight-soft)"
            stroke="var(--color-weight)"
            strokeWidth="1.3"
            strokeDasharray="5 3"
          />
          <text x="34" y="228" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            融合域
          </text>
          <rect
            x="136"
            y="216"
            width="136"
            height="14"
            rx="4"
            fill="var(--color-surface-elevated)"
            stroke="var(--color-line)"
          />
          <rect
            x="136"
            y="216"
            width={mc2RowBarPx}
            height="14"
            rx="4"
            className="wiki-edu-w4a-anim"
            fill="var(--color-weight)"
          />
          <text x="438" y="228" textAnchor="end" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            {`${state.mc2GroupRankCount}卡 · ${state.hcclBuffsizeMiB} MiB`}
          </text>

          <text x="26" y="268" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            {`傻算 ${state.logicalGroupCount} 组 ${state.naiveConfigSumMiB} MiB → 去重 ${state.uniqueDomainCount} 域 ${state.dedupedConfigSumMiB} MiB`}
          </text>

          <rect
            x="470"
            y="10"
            width="378"
            height="276"
            rx="10"
            fill={state.isMc2WindowOverflow ? "var(--color-accent-soft)" : "var(--color-surface)"}
            stroke={state.isMc2WindowOverflow ? "var(--color-danger)" : "var(--color-line)"}
            strokeWidth="1.5"
          />
          <text x="486" y="32" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            ② 融合窗口与复用校验
          </text>

          <text x="488" y="66" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            {`需要：${state.mc2RequiredWindowMiB} MiB (批长 ${state.fusedMc2Tokens})`}
          </text>
          <rect
            x="488"
            y="76"
            width="340"
            height="16"
            rx="5"
            fill="var(--color-surface-elevated)"
            stroke="var(--color-line)"
          />
          <rect
            x="488"
            y="76"
            width={mc2DemandBarPx}
            height="16"
            rx="5"
            className="wiki-edu-w4a-anim"
            fill={state.isMc2WindowOverflow ? "var(--color-danger)" : "var(--color-weight)"}
          />

          <text x="488" y="114" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            {`配额：${state.hcclBuffsizeMiB} MiB`}
          </text>
          <rect
            x="488"
            y="124"
            width="340"
            height="16"
            rx="5"
            fill="var(--color-surface-elevated)"
            stroke="var(--color-line)"
          />
          <rect
            x="488"
            y="124"
            width={mc2QuotaBarPx}
            height="16"
            rx="5"
            className="wiki-edu-w4a-anim"
            fill="var(--color-token)"
          />

          <text
            x="488"
            y="164"
            fontSize="12"
            fontWeight="700"
            fill={state.isMc2WindowOverflow ? "var(--color-danger)" : "var(--color-success)"}
          >
            {!state.windowCheckActive
              ? state.epMode === "off"
                ? "未开 EP · 跳过窗口校验"
                : "融合已停 · 跳过窗口校验"
              : state.isMc2WindowOverflow
                ? `✗ 缺口 ${state.mc2WindowDeficitMiB} MiB · 窗口不足`
                : `✓ 富余 +${state.mc2WindowMarginMiB} MiB · 窗口够用`}
          </text>

          <rect
            x="486"
            y="182"
            width="346"
            height="92"
            rx="8"
            fill={state.hcclBuffsizeEpSet ? "var(--color-accent-soft)" : "var(--color-surface-elevated)"}
            stroke={state.hcclBuffsizeEpSet ? "var(--color-danger)" : "var(--color-line)"}
            strokeWidth="1.4"
          />
          <text
            x="500"
            y="206"
            fontSize="12.5"
            fontWeight="700"
            fill={state.hcclBuffsizeEpSet ? "var(--color-danger)" : "var(--color-token)"}
          >
            {state.hcclBuffsizeEpSet ? "⚠ 专用 EP 变量零读取" : "✓ 已复用域不重复扣减"}
          </text>
          <text
            x="500"
            y="232"
            fontSize="12"
            fill={state.hcclBuffsizeEpSet ? "var(--color-ink)" : "var(--color-ink-muted)"}
          >
            {state.hcclBuffsizeEpSet ? "仅认主窗口配额；闭源行为待核" : "建组前拍快照，按实测增量扣 KV"}
          </text>
          <text
            x="500"
            y="258"
            fontSize="12"
            fill={state.hcclBuffsizeEpSet ? "var(--color-ink)" : "var(--color-ink-muted)"}
          >
            {`收发双方向参考：${state.hcclBuffsizeMiB} → ${state.cannDuplexBudgetMiB} MiB`}
          </text>
        </svg>

        <section className="wiki-edu-w4a-mobile" aria-label="移动端 HCCL 通信域账本与窗口校验">
          {[
            {
              title: "默认域",
              val: `200 MiB · 省 ${state.savedDefaultDomainMiB} MiB`,
              pct: (defaultRowBarPx / 136) * 100,
              bg: "var(--color-kv-soft)",
              border: "var(--color-kv)",
            },
            {
              title: "均衡组",
              val: state.dynamicEplb ? "100 MiB · 独立" : "未开启 · 0 MiB",
              pct: state.dynamicEplb ? (eplbRowBarPx / 136) * 100 : 0,
              bg: "var(--color-comm-soft)",
              border: "var(--color-comm)",
            },
            {
              title: "元数据组",
              val: `${state.dpBufferMiB} MiB · 默认 CPU`,
              pct: (dpRowBarPx / 136) * 100,
              bg: "var(--color-token-soft)",
              border: "var(--color-token)",
            },
            {
              title: "睡眠锚点",
              val: state.sleepAnchor ? "1 MiB · 按需建" : "未开启 · 0 MiB",
              pct: state.sleepAnchor ? (sleepRowBarPx / 136) * 100 : 0,
              bg: "var(--color-surface-sunken)",
              border: "var(--color-line)",
            },
            {
              title: "融合域",
              val: `${state.mc2GroupRankCount}卡 · ${state.hcclBuffsizeMiB} MiB`,
              pct: (mc2RowBarPx / 136) * 100,
              bg: "var(--color-weight-soft)",
              border: "var(--color-weight)",
            },
          ].map((row) => (
            <div
              key={row.title}
              className="wiki-edu-w4a-mcard"
              style={{ background: row.bg, borderColor: row.border }}
            >
              <div className="wiki-edu-w4a-mhead">
                <span>{row.title}</span>
                <span>{row.val}</span>
              </div>
              <div className="wiki-edu-w4a-mbar-track">
                <div
                  className="wiki-edu-w4a-mbar-fill"
                  style={{ width: `${Number(row.pct.toFixed(2))}%`, background: row.border }}
                />
              </div>
            </div>
          ))}
          <div
            className="wiki-edu-w4a-mcard"
            style={{
              background: state.isMc2WindowOverflow ? "var(--color-accent-soft)" : "var(--color-surface)",
              borderColor: state.isMc2WindowOverflow ? "var(--color-danger)" : "var(--color-line)",
            }}
          >
            <div className="wiki-edu-w4a-mhead">
              <span>{`需要 ${state.mc2RequiredWindowMiB} MiB / 配额 ${state.hcclBuffsizeMiB} MiB`}</span>
              <span>
                {!state.windowCheckActive
                  ? "跳过校验"
                  : state.isMc2WindowOverflow
                    ? `缺口 ${state.mc2WindowDeficitMiB} MiB`
                    : `富余 +${state.mc2WindowMarginMiB} MiB`}
              </span>
            </div>
            <div className="wiki-edu-w4a-mbar-track">
              <div
                className="wiki-edu-w4a-mbar-fill"
                style={{
                  width: `${mobileMc2QuotaPct}%`,
                  background: state.isMc2WindowOverflow ? "var(--color-danger)" : "var(--color-weight)",
                }}
              />
            </div>
          </div>
        </section>

        <details className="wiki-edu-param-drawer" data-testid="hccl-param-drawer">
          <summary>扩展通信组、TP 规模与缓冲配额设置</summary>
          <div className="wiki-edu-param-drawer-body">
            <fieldset className="wiki-edu-btn-row" aria-label="张量并行 TP 与融合算子开关">
              <span className="wiki-edu-param-label">TP 与融合算子</span>
              {HCCL_TP_SIZES.map((tp) => {
                const active = mode === "sandbox" && tpSize === tp;
                return (
                  <button
                    key={tp}
                    type="button"
                    className="wiki-edu-btn"
                    data-testid={`hccl-tp-${tp}`}
                    aria-pressed={active}
                    style={tokenBtnStyle(active, "dark")}
                    onClick={() => {
                      setMode("sandbox");
                      setTpSize(tp);
                    }}
                  >
                    {`TP=${tp}`}
                  </button>
                );
              })}
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="hccl-toggle-fused-mc2"
                aria-pressed={mode === "sandbox" && fusedMc2Active}
                style={tokenBtnStyle(mode === "sandbox" && fusedMc2Active, "teal")}
                onClick={() => {
                  setMode("sandbox");
                  setFusedMc2Active((prev) => !prev);
                }}
              >
                本步启用融合算子
              </button>
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="hccl-preset-overflow"
                aria-pressed={isOverflowPresetActive}
                style={tokenBtnStyle(isOverflowPresetActive, "dark")}
                onClick={applyOverflowPreset}
              >
                试超窗 (m=2048)
              </button>
            </fieldset>

            <fieldset className="wiki-edu-btn-row" aria-label="扩展通信组与死变量开关">
              <span className="wiki-edu-param-label">扩展与环境</span>
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="hccl-toggle-dp2"
                aria-pressed={mode === "sandbox" && dpEnabled}
                style={tokenBtnStyle(mode === "sandbox" && dpEnabled, "teal")}
                onClick={() => {
                  setMode("sandbox");
                  setDpEnabled((prev) => !prev);
                }}
              >
                DP=2
              </button>
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="hccl-toggle-eplb"
                aria-pressed={mode === "sandbox" && dynamicEplb}
                style={tokenBtnStyle(mode === "sandbox" && dynamicEplb, "teal")}
                onClick={() => {
                  setMode("sandbox");
                  setDynamicEplb((prev) => !prev);
                }}
              >
                动态 EPLB (100 MiB)
              </button>
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="hccl-toggle-sleep"
                aria-pressed={mode === "sandbox" && sleepAnchor}
                style={tokenBtnStyle(mode === "sandbox" && sleepAnchor, "teal")}
                onClick={() => {
                  setMode("sandbox");
                  setSleepAnchor((prev) => !prev);
                }}
              >
                睡眠锚点 (1 MiB)
              </button>
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="hccl-toggle-dead-env"
                aria-pressed={mode === "sandbox" && hcclBuffsizeEpSet}
                style={tokenBtnStyle(mode === "sandbox" && hcclBuffsizeEpSet, "dark")}
                onClick={() => {
                  setMode("sandbox");
                  setHcclBuffsizeEpSet((prev) => !prev);
                }}
              >
                导出 HCCL_BUFFSIZE_EP
              </button>
            </fieldset>

            <fieldset className="wiki-edu-btn-row" aria-label="环境配额滑块">
              <label
                htmlFor={buffSliderId}
                className={`wiki-edu-slider-chip${state.isMc2WindowOverflow ? " is-oom" : ""}`}
              >
                <span className="mono">{`HCCL_BUFFSIZE=${state.hcclBuffsizeMiB} MiB`}</span>
                <input
                  id={buffSliderId}
                  type="range"
                  min={32}
                  max={1024}
                  step={8}
                  value={state.hcclBuffsizeMiB}
                  data-testid="hccl-buffsize-slider"
                  aria-valuetext={`HCCL_BUFFSIZE ${state.hcclBuffsizeMiB} MiB`}
                  onPointerDown={() => setMode("sandbox")}
                  onChange={(e) => {
                    setMode("sandbox");
                    setHcclBuffsizeMiB(Number(e.target.value));
                  }}
                />
              </label>
            </fieldset>
          </div>
        </details>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-note-card">
            <strong>去重与活跃域账本</strong>：逻辑 <strong>{`${state.logicalGroupCount} 组`}</strong> 合并{" "}
            <strong>{`${state.deduplicatedCount} 组`}</strong> 后剩{" "}
            <strong>{`${state.uniqueDomainCount} 个底层域`}</strong>（跨多卡活跃配置和{" "}
            <strong>{`${state.multiRankActiveSumMiB} MiB`}</strong>，KV 仅扣实测非 Torch 增量）。
          </div>
          <div className="wiki-edu-note-card">
            {state.needsRemediation ? (
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="hccl-apply-remediation"
                style={tokenBtnStyle(false)}
                onClick={applyRemediation}
              >
                {state.isMc2WindowOverflow && state.hcclBuffsizeEpSet
                  ? `🔧 清除无效 EP 变量并补足配额至 ${state.recommendedBuffsizeMiB} MiB`
                  : state.isMc2WindowOverflow
                    ? `🔧 补足配额至 ${state.recommendedBuffsizeMiB} MiB`
                    : "🔧 清除未读取的独立 EP 环境变量"}
              </button>
            ) : !state.windowCheckActive ? (
              <>
                <strong>窗口校验</strong>：
                {state.epMode === "off"
                  ? "当前未开 EP，跳过融合 MC2 窗口校验"
                  : "当前已建融合域但本步停用融合算子，跳过融合 MC2 窗口校验"}
                （若启用需 <strong>{`${state.mc2RequiredWindowMiB} MiB`}</strong>，当前配额{" "}
                <strong>{`${state.hcclBuffsizeMiB} MiB`}</strong>）。
              </>
            ) : (
              <>
                <strong>窗口校验</strong>：当前需 <strong>{`${state.mc2RequiredWindowMiB} MiB`}</strong> ≤
                配额 <strong>{`${state.hcclBuffsizeMiB} MiB`}</strong>，窗口够用。
              </>
            )}
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
