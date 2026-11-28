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

export const MOE_DISPATCH_STATE_APPROVED_SHA256 =
  "5979740e16887dd78ddfcf185b3c2215c19f80ef298e86c22b203aa1785fce72";
export const MOE_DISPATCH_FIG_STATE_MACHINE_APPROVED_SHA256 = MOE_DISPATCH_STATE_APPROVED_SHA256;

export const MOE_SOC_FAMILIES = ["A2", "A3", "A5", "310P"] as const;
export type MoeSocFamily = (typeof MOE_SOC_FAMILIES)[number];

export const MOE_EP_WORLD_SIZES = [1, 4, 8, 16, 32, 64] as const;
export type MoeEpWorldSize = (typeof MOE_EP_WORLD_SIZES)[number];

export const MOE_TP_SIZES = [1, 2, 4, 8] as const;
export type MoeTpSize = (typeof MOE_TP_SIZES)[number];

export const MOE_MAX_CAPTURE_SIZES = [128, 256, 512] as const;
export type MoeMaxCaptureSize = (typeof MOE_MAX_CAPTURE_SIZES)[number];

export const MOE_DEFAULT_MAX_BATCHED_TOKENS = 2048;

export const MOE_EXPERT_MODELS = ["qwen3-128", "qwen3-30b", "deepseek-256"] as const;
export type MoeExpertModelId = (typeof MOE_EXPERT_MODELS)[number];

export type MoeDispatchDiagramMode = "sandbox" | "svg";
export type MoeCommRoute = "ALLGATHER" | "MC2" | "FUSED_MC2" | "ALLTOALL" | "BLOCKED";
export type MoePolicyKind =
  | "CAPACITY_AND_EXPERT_DENSITY"
  | "FUSED_OR_CAPACITY"
  | "CAPACITY_AND_WORLD_SIZE"
  | "ALLGATHER";

export type MoeActiveStage = "gate0-topology" | "gate1-ep1" | "gate2-lora" | "soc-policy";

export const MC2_REGULAR_PER_RANK_LIMIT = 512;
export const MEGA_MOE_PER_RANK_LIMIT = 16384;

export const MOE_SOC_META: Readonly<
  Record<
    MoeSocFamily,
    {
      readonly shortBtn: string;
      readonly cardTitle: string;
      readonly policy: MoePolicyKind;
      readonly supportsMegaMoe: boolean;
      readonly supportsDispatchFfnCombine: boolean;
    }
  >
> = {
  A2: {
    shortBtn: "A2 (910B)",
    cardTitle: "Atlas A2 · 密度与容量",
    policy: "CAPACITY_AND_EXPERT_DENSITY",
    supportsMegaMoe: false,
    supportsDispatchFfnCombine: false,
  },
  A3: {
    shortBtn: "A3 (双Die)",
    cardTitle: "Atlas A3 · 融合或容量",
    policy: "FUSED_OR_CAPACITY",
    supportsMegaMoe: true,
    supportsDispatchFfnCombine: true,
  },
  A5: {
    shortBtn: "A5 (950)",
    cardTitle: "昇腾 950 (A5) · 域宽比",
    policy: "CAPACITY_AND_WORLD_SIZE",
    supportsMegaMoe: true,
    supportsDispatchFfnCombine: false,
  },
  "310P": {
    shortBtn: "310P",
    cardTitle: "Atlas 310P · 兼容族",
    policy: "ALLGATHER",
    supportsMegaMoe: false,
    supportsDispatchFfnCombine: false,
  },
};

export const MOE_EXPERT_MODEL_META: Readonly<
  Record<
    MoeExpertModelId,
    {
      readonly shortBtn: string;
      readonly label: string;
      readonly numExperts: number;
      readonly topK: number;
      readonly hiddenSize: number;
      readonly moeIntermediateSize: number;
    }
  >
> = {
  "qwen3-128": {
    shortBtn: "128专家",
    label: "Qwen3-235B-A22B (128专家, 中间维1536)",
    numExperts: 128,
    topK: 8,
    hiddenSize: 4096,
    moeIntermediateSize: 1536,
  },
  "qwen3-30b": {
    shortBtn: "30B窄维",
    label: "Qwen3-30B-A3B (128专家, 中间维768)",
    numExperts: 128,
    topK: 8,
    hiddenSize: 2048,
    moeIntermediateSize: 768,
  },
  "deepseek-256": {
    shortBtn: "256专家",
    label: "DeepSeek 路由规模 (256专家, 中间维2048)",
    numExperts: 256,
    topK: 8,
    hiddenSize: 7168,
    moeIntermediateSize: 2048,
  },
};

const A5_SUPPORTED_HIDDEN_SIZES = new Set([1024, 2048, 3072, 4096, 5120, 6144, 7168, 8192]);
const A5_SUPPORTED_INTERMEDIATE_HIDDEN_SIZES = new Set([1024, 2048, 3072, 4096, 7168]);

export function isMegaMoeSupportedByModelShape(
  soc: MoeSocFamily,
  hiddenSize: number,
  moeIntermediateSize: number,
): boolean {
  if (soc === "A3") {
    return (
      hiddenSize >= 1024 &&
      hiddenSize <= 8192 &&
      hiddenSize % 512 === 0 &&
      moeIntermediateSize >= 1024 &&
      moeIntermediateSize <= 3072 &&
      moeIntermediateSize % 512 === 0
    );
  }
  if (soc === "A5") {
    return (
      A5_SUPPORTED_HIDDEN_SIZES.has(hiddenSize) &&
      A5_SUPPORTED_INTERMEDIATE_HIDDEN_SIZES.has(2 * moeIntermediateSize)
    );
  }
  return false;
}

export interface MoeDispatchSandboxInput {
  readonly soc: MoeSocFamily;
  readonly epWorldSize: number;
  readonly tpSize: number;
  readonly numTokens: number;
  readonly maxCaptureSize?: number | undefined;
  readonly enablePrefillMc2?: boolean | undefined;
  readonly maxBatchedTokens?: number | undefined;
  readonly loraEnabled?: boolean | undefined;
  readonly enableFusedMc2?: boolean | undefined;
  readonly useCannMegamoe?: boolean | undefined;
  readonly expertModel?: MoeExpertModelId | undefined;
  readonly numExperts?: number | undefined;
  readonly topK?: number | undefined;
  readonly hiddenSize?: number | undefined;
  readonly moeIntermediateSize?: number | undefined;
}

export type MoeRemediationKind =
  | "none"
  | "fix-ep-tp-topology"
  | "disable-lora"
  | "raise-a2-ep16"
  | "raise-a2-ep16-and-fit"
  | "fit-a2-capacity"
  | "enable-prefill-mc2"
  | "enable-megamoe"
  | "raise-ep-gt-1";

export interface MoeDispatchSandboxState {
  readonly soc: MoeSocFamily;
  readonly policy: MoePolicyKind;
  readonly topologyValid: boolean;
  readonly epWorldSize: number;
  readonly tpSize: number;
  readonly numTokens: number;
  readonly maxCaptureSize: number;
  readonly enablePrefillMc2: boolean;
  readonly maxBatchedTokens: number;
  readonly maxNumTokensRef: number;
  readonly numTokensPerTpRank: number;
  readonly expertModel: MoeExpertModelId;
  readonly numExperts: number;
  readonly topK: number;
  readonly hiddenSize: number;
  readonly moeIntermediateSize: number;
  readonly expertsPerRank: number;
  readonly loraEnabled: boolean;
  readonly enableFusedMc2: boolean;
  readonly useCannMegamoe: boolean;
  readonly megaMoeShapeSupported: boolean;
  readonly megaMoeClearedByShape: boolean;
  readonly megaMoeEffective: boolean;
  readonly dispatchFfnCombineEffective: boolean;
  readonly perRankTokenLimit: number;
  readonly mc2TokensCapacity: number;
  readonly capacityApplicable: boolean;
  readonly withinCapacity: boolean;
  readonly capacityRatioPct: number;
  readonly capacityBarPct: number;
  readonly activeStage: MoeActiveStage;
  readonly selectedMethod: MoeCommRoute;
  readonly selectedSubVariant:
    | "ALLGATHER"
    | "ALLGATHER_310"
    | "MC2"
    | "DISPATCH_FFN_COMBINE"
    | "CANN_MEGAMOE"
    | "ALLTOALL"
    | "BLOCKED";
  readonly routeBadge: string;
  readonly takeawayTone: EduBadgeTone;
  readonly branchSummary: string;
  readonly remediationKind: MoeRemediationKind;
  readonly remediationLabel: string | null;
}

export function computeMoeDispatchSandboxState(input: MoeDispatchSandboxInput): MoeDispatchSandboxState {
  const soc = input.soc;
  const socMeta = MOE_SOC_META[soc];
  const epWorldSize = Math.max(1, Math.round(input.epWorldSize));
  const tpSize = Math.max(1, Math.round(input.tpSize));
  const topologyValid = epWorldSize === 1 || (epWorldSize >= tpSize && epWorldSize % tpSize === 0);
  const numTokens = Math.min(65536, Math.max(1, Math.round(input.numTokens)));
  const maxCaptureSize = Math.max(1, Math.round(input.maxCaptureSize ?? 512));
  const maxBatchedTokens = Math.max(1, Math.round(input.maxBatchedTokens ?? MOE_DEFAULT_MAX_BATCHED_TOKENS));
  const enablePrefillMc2 = Boolean(input.enablePrefillMc2);
  const expertModel = input.expertModel ?? "qwen3-128";
  const modelMeta = MOE_EXPERT_MODEL_META[expertModel];
  const numExperts = Math.max(1, Math.round(input.numExperts ?? modelMeta.numExperts));
  const topK = Math.max(1, Math.round(input.topK ?? modelMeta.topK));
  const hiddenSize = Math.max(1, Math.round(input.hiddenSize ?? modelMeta.hiddenSize));
  const moeIntermediateSize = Math.max(
    1,
    Math.round(input.moeIntermediateSize ?? modelMeta.moeIntermediateSize),
  );
  const expertsPerRank = Math.floor(numExperts / epWorldSize);

  const loraEnabled = Boolean(input.loraEnabled);
  const useCannMegamoe = Boolean(input.useCannMegamoe);
  const requestedEnableFusedMc2 =
    input.enableFusedMc2 !== undefined ? Boolean(input.enableFusedMc2) : useCannMegamoe;
  const megaMoeShapeSupported = isMegaMoeSupportedByModelShape(soc, hiddenSize, moeIntermediateSize);
  const megaMoeClearedByShape =
    socMeta.supportsMegaMoe && useCannMegamoe && requestedEnableFusedMc2 && !megaMoeShapeSupported;
  const enableFusedMc2 = megaMoeClearedByShape ? false : requestedEnableFusedMc2;

  const megaMoeEffective =
    topologyValid &&
    socMeta.supportsMegaMoe &&
    megaMoeShapeSupported &&
    useCannMegamoe &&
    enableFusedMc2 &&
    !loraEnabled &&
    epWorldSize > 1 &&
    epWorldSize <= 64;

  const perRankTokenLimit = megaMoeEffective ? MEGA_MOE_PER_RANK_LIMIT : MC2_REGULAR_PER_RANK_LIMIT;
  const maxNumTokensRef = enablePrefillMc2 || megaMoeEffective ? maxBatchedTokens : maxCaptureSize;
  const numTokensPerTpRank = Math.min(Math.ceil(maxNumTokensRef / tpSize), perRankTokenLimit);
  const mc2TokensCapacity = numTokensPerTpRank * tpSize;
  const projectedMegaMoeBatch = Math.max(maxBatchedTokens, numTokens);
  const projectedMegaMoeCap =
    Math.min(Math.ceil(projectedMegaMoeBatch / tpSize), MEGA_MOE_PER_RANK_LIMIT) * tpSize;
  const projectedMegaMoeLabel =
    numTokens > maxBatchedTokens
      ? `🔧 开启超级融合并同步批预算至 ${projectedMegaMoeCap.toLocaleString()} 词`
      : `🔧 开启超级融合将容量提至 ${projectedMegaMoeCap.toLocaleString()} 词`;
  const projectedPrefillCap =
    Math.min(Math.ceil(maxBatchedTokens / tpSize), MC2_REGULAR_PER_RANK_LIMIT) * tpSize;
  const withinCapacity = numTokens <= mc2TokensCapacity;
  const exactCapPct = (numTokens / mc2TokensCapacity) * 100;
  const capacityRatioPct = Number(exactCapPct.toFixed(1));
  const capacityBarPct = Number(Math.min(100, Math.max(0, exactCapPct)).toFixed(2));

  const commonFields = {
    soc,
    policy: socMeta.policy,
    topologyValid,
    epWorldSize,
    tpSize,
    numTokens,
    maxCaptureSize,
    enablePrefillMc2,
    maxBatchedTokens,
    maxNumTokensRef,
    numTokensPerTpRank,
    expertModel,
    numExperts,
    topK,
    hiddenSize,
    moeIntermediateSize,
    expertsPerRank,
    loraEnabled,
    enableFusedMc2,
    useCannMegamoe,
    megaMoeShapeSupported,
    megaMoeClearedByShape,
    perRankTokenLimit,
    mc2TokensCapacity,
    withinCapacity,
    capacityRatioPct,
    capacityBarPct,
  } as const;

  if (!topologyValid) {
    const alignedEp = Math.max(tpSize, Math.ceil(epWorldSize / tpSize) * tpSize);
    return {
      ...commonFields,
      megaMoeEffective: false,
      dispatchFfnCombineEffective: false,
      capacityApplicable: false,
      activeStage: "gate0-topology",
      selectedMethod: "BLOCKED",
      selectedSubVariant: "BLOCKED",
      routeBadge: "拓扑非法 · 建组阻断",
      takeawayTone: "danger",
      branchSummary: `开启专家并行（EP=${epWorldSize}>1）时 EP 组大小等于 DP×PCP×TP，EP=${epWorldSize} 无法整除容纳 TP=${tpSize}，建组阶段即阻断。`,
      remediationKind: "fix-ep-tp-topology",
      remediationLabel: `🔧 对齐合法拓扑（升至 EP=${alignedEp}）`,
    };
  }

  if (epWorldSize === 1) {
    return {
      ...commonFields,
      megaMoeEffective: false,
      dispatchFfnCombineEffective: false,
      capacityApplicable: false,
      activeStage: "gate1-ep1",
      selectedMethod: "ALLGATHER",
      selectedSubVariant: soc === "310P" ? "ALLGATHER_310" : "ALLGATHER",
      routeBadge: "闸门 ① 命中 · 走全收集",
      takeawayTone: "default",
      branchSummary: "单卡专家未跨卡切分（EP=1），前置闸门直接选全收集广播，免去跨卡派发。",
      remediationKind: "raise-ep-gt-1",
      remediationLabel: "🔧 切到 EP=16 查看多卡专家派发",
    };
  }

  if (loraEnabled) {
    return {
      ...commonFields,
      megaMoeEffective: false,
      dispatchFfnCombineEffective: false,
      capacityApplicable: false,
      activeStage: "gate2-lora",
      selectedMethod: "ALLTOALL",
      selectedSubVariant: "ALLTOALL",
      routeBadge: "闸门 ② 改道 · 走全互换",
      takeawayTone: "danger",
      branchSummary: "开启 LoRA 且 EP>1：融合算子内无法插桩旁路权重，前置闸门高于芯片策略强切全互换。",
      remediationKind: "disable-lora",
      remediationLabel: "🔧 关闭 LoRA 恢复芯片原生通算快道",
    };
  }
  if (soc === "310P") {
    return {
      ...commonFields,
      megaMoeEffective: false,
      dispatchFfnCombineEffective: false,
      capacityApplicable: false,
      activeStage: "soc-policy",
      selectedMethod: "ALLGATHER",
      selectedSubVariant: "ALLGATHER_310",
      routeBadge: "310P 兼容族 · 走全收集",
      takeawayTone: "default",
      branchSummary: "Atlas 310P 兼容族固定采用全收集广播，不开启 MC2 或融合通道。",
      remediationKind: "none",
      remediationLabel: null,
    };
  }

  if (soc === "A2") {
    const densityOk = expertsPerRank <= 24;
    const epOk = epWorldSize >= 16;
    const allOk = densityOk && epOk && withinCapacity;
    const failedReasons: string[] = [];
    if (!densityOk) failedReasons.push(`每卡 ${expertsPerRank} 专家 > 24`);
    if (!epOk) failedReasons.push(`EP=${epWorldSize} < 16`);
    if (!withinCapacity) failedReasons.push(`本步 ${numTokens} 词 > 上限 ${mc2TokensCapacity}`);

    const ep16FixesDensity = Math.floor(numExperts / 16) <= 24;
    let remediationKind: MoeRemediationKind = "none";
    let remediationLabel: string | null = null;
    if ((!epOk || !densityOk) && ep16FixesDensity) {
      if (withinCapacity) {
        remediationKind = "raise-a2-ep16";
        remediationLabel = "🔧 升至 EP=16 满足 A2 密度与卡数门槛";
      } else {
        remediationKind = "raise-a2-ep16-and-fit";
        const canFitByPrefill =
          !enablePrefillMc2 && numTokens <= Math.min(maxBatchedTokens, MC2_REGULAR_PER_RANK_LIMIT * tpSize);
        remediationLabel = canFitByPrefill
          ? "🔧 升至 EP=16 并开启 Prefill MC2"
          : `🔧 升至 EP=16 并控词至 ${mc2TokensCapacity} 上限`;
      }
    }

    return {
      ...commonFields,
      megaMoeEffective: false,
      dispatchFfnCombineEffective: false,
      capacityApplicable: true,
      activeStage: "soc-policy",
      selectedMethod: allOk ? "MC2" : "ALLGATHER",
      selectedSubVariant: allOk ? "MC2" : "ALLGATHER",
      routeBadge: allOk ? "A2 三项达标 · 走标准 MC2" : "A2 门槛未满 · 退全收集",
      takeawayTone: allOk ? "accent" : "warn",
      branchSummary: allOk
        ? `Atlas A2 满足每卡 ${expertsPerRank}≤24 专家、EP=${epWorldSize}≥16 与批词 ${numTokens}≤${mc2TokensCapacity}，进入标准 MC2 通算重叠。`
        : `Atlas A2 因「${failedReasons.join("、")}」未满足门槛，安全回落全收集广播。`,
      remediationKind,
      remediationLabel,
    };
  }

  if (soc === "A3") {
    const dispatchFfnCombineEffective = !megaMoeEffective && enableFusedMc2 && epWorldSize <= 32;
    let selectedMethod: MoeCommRoute;
    let selectedSubVariant: MoeDispatchSandboxState["selectedSubVariant"];
    let routeBadge: string;
    let takeawayTone: EduBadgeTone;
    let branchSummary: string;
    let remediationKind: MoeRemediationKind = "none";
    let remediationLabel: string | null = null;
    const capacityApplicable = !megaMoeEffective && !dispatchFfnCombineEffective;

    if (megaMoeEffective) {
      selectedMethod = "FUSED_MC2";
      selectedSubVariant = "CANN_MEGAMOE";
      routeBadge = withinCapacity ? "A3 超级融合 · 容量内" : "A3 超级融合 · 超参考上限";
      takeawayTone = withinCapacity ? "accent" : "warn";
      branchSummary = withinCapacity
        ? `Atlas A3 优先进入超级融合通道（对称缓冲上限 ${mc2TokensCapacity} 词，当前在预算内）。`
        : `Atlas A3 优先直选融合通道（不受容量阈值改道），但本步 ${numTokens} 词超出摸底上限 ${mc2TokensCapacity} 词。`;
    } else if (dispatchFfnCombineEffective) {
      selectedMethod = "FUSED_MC2";
      selectedSubVariant = "DISPATCH_FFN_COMBINE";
      routeBadge = withinCapacity ? "A3 融合算子 · 容量内" : "A3 融合算子 · 超窗口告警";
      takeawayTone = withinCapacity ? "accent" : "warn";
      branchSummary = withinCapacity
        ? `Atlas A3 开启融合开关且 EP=${epWorldSize}≤32，先于容量门槛直走融合 MC2。`
        : `Atlas A3 优先直走融合 MC2（不切全互换），但本步 ${numTokens} 词超出参考上限 ${mc2TokensCapacity}，需校核通信窗口！`;
      if (!withinCapacity && megaMoeShapeSupported && epWorldSize <= 64) {
        remediationKind = "enable-megamoe";
        remediationLabel = projectedMegaMoeLabel;
      }
    } else if (withinCapacity) {
      selectedMethod = "MC2";
      selectedSubVariant = "MC2";
      routeBadge = megaMoeClearedByShape ? "A3 融合清零 · 退标准 MC2" : "A3 容量内 · 走标准 MC2";
      takeawayTone = megaMoeClearedByShape ? "warn" : "accent";
      branchSummary = megaMoeClearedByShape
        ? `当前模型专家中间维 ${moeIntermediateSize} 未满足 A3 超级融合门槛（≥1024 且整除 512），校验期自动清零融合开关；本步 ${numTokens}≤${mc2TokensCapacity} 走标准 MC2。`
        : enableFusedMc2 && epWorldSize > 32
          ? `常规融合算子仅限 EP≤32（当前 EP=${epWorldSize}），本步 ${numTokens}≤${mc2TokensCapacity} 落在缓冲内，走标准 MC2。`
          : `Atlas A3 当前批词 ${numTokens} ≤ 上限 ${mc2TokensCapacity}，走标准 MC2 低时延通算快道。`;
    } else {
      selectedMethod = "ALLTOALL";
      selectedSubVariant = "ALLTOALL";
      routeBadge = megaMoeClearedByShape ? "A3 融合清零 · 切全互换" : "A3 超上限 · 切全互换";
      takeawayTone = "warn";
      branchSummary = megaMoeClearedByShape
        ? `当前模型专家中间维 ${moeIntermediateSize} 未满足 A3 超级融合门槛（≥1024 且整除 512），融合开关在校验期清零，本步 ${numTokens} 超上限 ${mc2TokensCapacity} 切往全互换。`
        : `Atlas A3 本步批词 ${numTokens} 超出上限 ${mc2TokensCapacity}，自动切往变长全互换点对点交换。`;
      if (megaMoeShapeSupported && !megaMoeEffective && epWorldSize <= 64) {
        remediationKind = "enable-megamoe";
        remediationLabel = projectedMegaMoeLabel;
      } else if (!enablePrefillMc2 && numTokens <= projectedPrefillCap) {
        remediationKind = "enable-prefill-mc2";
        remediationLabel = `🔧 开启 Prefill MC2 将标准容量提至 ${projectedPrefillCap.toLocaleString()} 词`;
      }
    }

    return {
      ...commonFields,
      megaMoeEffective,
      dispatchFfnCombineEffective,
      capacityApplicable,
      activeStage: "soc-policy",
      selectedMethod,
      selectedSubVariant,
      routeBadge,
      takeawayTone,
      branchSummary,
      remediationKind,
      remediationLabel,
    };
  }

  // Soc === "A5" (950): CAPACITY_AND_WORLD_SIZE
  let selectedMethod: MoeCommRoute;
  let selectedSubVariant: MoeDispatchSandboxState["selectedSubVariant"];
  let routeBadge: string;
  let takeawayTone: EduBadgeTone;
  let branchSummary: string;
  let remediationKind: MoeRemediationKind = "none";
  let remediationLabel: string | null = null;
  const capacityApplicable = !megaMoeEffective;

  if (megaMoeEffective) {
    selectedMethod = "FUSED_MC2";
    selectedSubVariant = "CANN_MEGAMOE";
    routeBadge = withinCapacity ? "A5 超级融合 · 容量内" : "A5 超级融合 · 超参考上限";
    takeawayTone = withinCapacity ? "accent" : "warn";
    branchSummary = withinCapacity
      ? `昇腾 950 启用超级融合对称缓冲（上限 ${mc2TokensCapacity} 词），本步 ${numTokens} 词直接进入融合通道。`
      : `昇腾 950 优先直选融合通道（不受容量阈值改道），但本步 ${numTokens} 词超出摸底上限 ${mc2TokensCapacity} 词。`;
  } else if (withinCapacity && epWorldSize > 1) {
    selectedMethod = "MC2";
    selectedSubVariant = "MC2";
    routeBadge = megaMoeClearedByShape ? "A5 融合清零 · 走标准 MC2" : "A5 容量内 · 走标准 MC2";
    takeawayTone = megaMoeClearedByShape ? "warn" : "accent";
    branchSummary = megaMoeClearedByShape
      ? `当前模型 2×专家中间维=${2 * moeIntermediateSize} 不在昇腾 950 超级融合允许集内，校验期清零融合开关；本步 ${numTokens}≤${mc2TokensCapacity} 走标准 MC2。`
      : `昇腾 950 本步批词 ${numTokens} ≤ 上限 ${mc2TokensCapacity} 且 EP=${epWorldSize}>1，走标准 MC2。`;
  } else if (epWorldSize <= topK) {
    selectedMethod = "ALLGATHER";
    selectedSubVariant = "ALLGATHER";
    routeBadge = `A5 域宽≤Top${topK} · 退全收集`;
    takeawayTone = "warn";
    branchSummary = `昇腾 950 批词 ${numTokens} 超限且 EP=${epWorldSize} ≤ Top-${topK}（几乎每卡均命中专家），回退全收集广播更省。`;
    if (megaMoeShapeSupported && epWorldSize <= 64) {
      remediationKind = "enable-megamoe";
      remediationLabel = projectedMegaMoeLabel;
    } else if (!enablePrefillMc2 && numTokens <= projectedPrefillCap) {
      remediationKind = "enable-prefill-mc2";
      remediationLabel = `🔧 开启 Prefill MC2 将标准容量提至 ${projectedPrefillCap.toLocaleString()} 词`;
    }
  } else {
    selectedMethod = "ALLTOALL";
    selectedSubVariant = "ALLTOALL";
    routeBadge = "A5 大域超限 · 切全互换";
    takeawayTone = "warn";
    branchSummary = `昇腾 950 批词 ${numTokens} 超出上限 ${mc2TokensCapacity} 且 EP=${epWorldSize} > Top-${topK}，切往全互换定向派发。`;
    if (megaMoeShapeSupported && epWorldSize <= 64) {
      remediationKind = "enable-megamoe";
      remediationLabel = projectedMegaMoeLabel;
    } else if (!enablePrefillMc2 && numTokens <= projectedPrefillCap) {
      remediationKind = "enable-prefill-mc2";
      remediationLabel = `🔧 开启 Prefill MC2 将标准容量提至 ${projectedPrefillCap.toLocaleString()} 词`;
    }
  }

  return {
    ...commonFields,
    megaMoeEffective,
    dispatchFfnCombineEffective: false,
    capacityApplicable,
    activeStage: "soc-policy",
    selectedMethod,
    selectedSubVariant,
    routeBadge,
    takeawayTone,
    branchSummary,
    remediationKind,
    remediationLabel,
  };
}

function mapTokenMeterWidth(tokens: number, maxRef: number, fullWidth: number): number {
  const safeMax = Math.max(2, maxRef);
  const clamped = Math.min(safeMax, Math.max(0, tokens));
  return Number(((clamped / safeMax) * fullWidth).toFixed(2));
}

function shortMethodText(method: MoeCommRoute): string {
  if (method === "BLOCKED") return "建组阻断";
  if (method === "FUSED_MC2") return "融合 MC2";
  if (method === "MC2") return "标准 MC2";
  if (method === "ALLTOALL") return "全互换";
  return "全收集";
}

export interface MoeDispatchStateInteractiveProps extends InteractiveDiagramProps {
  readonly initialMode?: MoeDispatchDiagramMode | undefined;
  readonly initialSoc?: MoeSocFamily | undefined;
  readonly initialEpWorldSize?: MoeEpWorldSize | undefined;
  readonly initialTpSize?: MoeTpSize | undefined;
  readonly initialNumTokens?: number | undefined;
  readonly initialMaxCaptureSize?: MoeMaxCaptureSize | undefined;
  readonly initialEnablePrefillMc2?: boolean | undefined;
  readonly initialMaxBatchedTokens?: number | undefined;
  readonly initialExpertModel?: MoeExpertModelId | undefined;
  readonly initialLoraEnabled?: boolean | undefined;
  readonly initialEnableFusedMc2?: boolean | undefined;
  readonly initialUseCannMegamoe?: boolean | undefined;
}

export function MoeDispatchStateInteractive({
  id,
  safeSvg,
  caption,
  scrollRef,
  scrollable,
  onScroll,
  initialMode = "sandbox",
  initialSoc = "A3",
  initialEpWorldSize = 16,
  initialTpSize = 4,
  initialNumTokens = 64,
  initialMaxCaptureSize = 512,
  initialEnablePrefillMc2 = false,
  initialMaxBatchedTokens = MOE_DEFAULT_MAX_BATCHED_TOKENS,
  initialExpertModel = "qwen3-128",
  initialLoraEnabled = false,
  initialEnableFusedMc2 = false,
  initialUseCannMegamoe = false,
}: MoeDispatchStateInteractiveProps) {
  const [mode, setMode] = useState<MoeDispatchDiagramMode>(initialMode);
  const [soc, setSoc] = useState<MoeSocFamily>(initialSoc);
  const [epWorldSize, setEpWorldSize] = useState<MoeEpWorldSize>(initialEpWorldSize);
  const [tpSize, setTpSize] = useState<MoeTpSize>(initialTpSize);
  const [numTokens, setNumTokens] = useState<number>(initialNumTokens);
  const [maxCaptureSize, setMaxCaptureSize] = useState<MoeMaxCaptureSize>(initialMaxCaptureSize);
  const [enablePrefillMc2, setEnablePrefillMc2] = useState<boolean>(initialEnablePrefillMc2);
  const [maxBatchedTokens, setMaxBatchedTokens] = useState<number>(initialMaxBatchedTokens);
  const [expertModel, setExpertModel] = useState<MoeExpertModelId>(initialExpertModel);
  const [loraEnabled, setLoraEnabled] = useState<boolean>(initialLoraEnabled);
  const [enableFusedMc2, setEnableFusedMc2] = useState<boolean>(initialEnableFusedMc2);
  const [useCannMegamoe, setUseCannMegamoe] = useState<boolean>(initialUseCannMegamoe);

  const sliderId = useId();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const arrowId = `${id}-${uid}-moe-arrow`;

  const state = useMemo(
    () =>
      computeMoeDispatchSandboxState({
        soc,
        epWorldSize,
        tpSize,
        numTokens,
        maxCaptureSize,
        enablePrefillMc2,
        maxBatchedTokens,
        expertModel,
        loraEnabled,
        enableFusedMc2,
        useCannMegamoe,
      }),
    [
      soc,
      epWorldSize,
      tpSize,
      numTokens,
      maxCaptureSize,
      enablePrefillMc2,
      maxBatchedTokens,
      expertModel,
      loraEnabled,
      enableFusedMc2,
      useCannMegamoe,
    ],
  );

  const applyPresetA2Ep8 = () => {
    setMode("sandbox");
    setSoc("A2");
    setEpWorldSize(8);
    setTpSize(4);
    setNumTokens(64);
    setMaxCaptureSize(512);
    setEnablePrefillMc2(false);
    setMaxBatchedTokens(initialMaxBatchedTokens);
    setExpertModel("qwen3-128");
    setLoraEnabled(false);
    setEnableFusedMc2(false);
    setUseCannMegamoe(false);
  };

  const applyPresetA3Lora = () => {
    setMode("sandbox");
    setSoc("A3");
    setEpWorldSize(16);
    setTpSize(4);
    setNumTokens(64);
    setMaxCaptureSize(512);
    setEnablePrefillMc2(false);
    setMaxBatchedTokens(initialMaxBatchedTokens);
    setExpertModel("qwen3-128");
    setLoraEnabled(true);
    setEnableFusedMc2(true);
    setUseCannMegamoe(true);
  };

  const applyRemediation = () => {
    setMode("sandbox");
    if (state.remediationKind === "fix-ep-tp-topology") {
      const aligned = MOE_EP_WORLD_SIZES.find((ep) => ep > 1 && ep >= tpSize && ep % tpSize === 0) ?? 8;
      setEpWorldSize(aligned);
    } else if (state.remediationKind === "disable-lora") {
      setLoraEnabled(false);
    } else if (state.remediationKind === "raise-a2-ep16") {
      setEpWorldSize(16);
    } else if (state.remediationKind === "raise-a2-ep16-and-fit") {
      setEpWorldSize(16);
      const canFitByPrefill =
        !enablePrefillMc2 && numTokens <= Math.min(maxBatchedTokens, MC2_REGULAR_PER_RANK_LIMIT * tpSize);
      if (canFitByPrefill) {
        setEnablePrefillMc2(true);
      } else {
        setNumTokens(state.mc2TokensCapacity);
      }
    } else if (state.remediationKind === "enable-prefill-mc2") {
      setEnablePrefillMc2(true);
    } else if (state.remediationKind === "enable-megamoe") {
      setEnableFusedMc2(true);
      setUseCannMegamoe(true);
      setMaxBatchedTokens((prev) => Math.max(prev, numTokens));
    } else if (state.remediationKind === "raise-ep-gt-1") {
      setEpWorldSize(16);
    }
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
    const socIdx = MOE_SOC_FAMILIES.indexOf(soc);
    switch (event.key) {
      case "0":
      case "Escape":
        event.preventDefault();
        setMode("svg");
        break;
      case "ArrowRight":
        event.preventDefault();
        setMode("sandbox");
        setSoc(MOE_SOC_FAMILIES[Math.min(MOE_SOC_FAMILIES.length - 1, socIdx + 1)]!);
        break;
      case "ArrowLeft":
        event.preventDefault();
        setMode("sandbox");
        setSoc(MOE_SOC_FAMILIES[Math.max(0, socIdx - 1)]!);
        break;
      case "1":
      case "2":
      case "3":
      case "4": {
        event.preventDefault();
        const picked = MOE_SOC_FAMILIES[Number(event.key) - 1];
        if (picked) {
          setMode("sandbox");
          setSoc(picked);
        }
        break;
      }
    }
  };

  const isPresetA2Active =
    mode === "sandbox" &&
    soc === "A2" &&
    epWorldSize === 8 &&
    tpSize === 4 &&
    numTokens === 64 &&
    maxCaptureSize === 512 &&
    !enablePrefillMc2 &&
    expertModel === "qwen3-128" &&
    !loraEnabled &&
    !enableFusedMc2 &&
    !useCannMegamoe;
  const isPresetLoraActive =
    mode === "sandbox" &&
    soc === "A3" &&
    epWorldSize === 16 &&
    tpSize === 4 &&
    numTokens === 64 &&
    maxCaptureSize === 512 &&
    !enablePrefillMc2 &&
    expertModel === "qwen3-128" &&
    loraEnabled &&
    enableFusedMc2 &&
    useCannMegamoe;

  const meterFullW = 804;
  const meterMaxRef = Math.max(Math.ceil(state.mc2TokensCapacity * 1.25), state.numTokens, 2);
  const capLineX = 28 + mapTokenMeterWidth(state.mc2TokensCapacity, meterMaxRef, meterFullW);
  const tokBarW = mapTokenMeterWidth(state.numTokens, meterMaxRef, meterFullW);
  const sliderMax = Math.max(8192, state.numTokens);
  const gate0Hit = state.activeStage === "gate0-topology";
  const gate1Hit = state.activeStage === "gate1-ep1";
  const gate2Hit = state.activeStage === "gate2-lora";

  const moeKpi = gate0Hit
    ? "拓扑阻断 · EP 须整除 TP"
    : gate1Hit || gate2Hit
      ? `出口 ${shortMethodText(state.selectedMethod)} · 闸门直判`
      : state.soc === "310P"
        ? "出口 全收集 · 兼容固定"
        : state.megaMoeEffective || state.dispatchFfnCombineEffective
          ? `出口 融合 MC2 · ${state.numTokens} 词`
          : `出口 ${shortMethodText(state.selectedMethod)} · ${state.numTokens}/${state.mc2TokensCapacity} 词`;

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
      kickerTag="母版 B · 状态机与容量门限"
      kickerTitle="MoE 四族硬件通信调度状态机（v0.30.0）"
      question="同样跑 MoE 模型，为什么小批走 MC2 极快，大批或换芯片、开 LoRA 却突然换了一条通信路？"
      toolbarLabel="MoE 四族芯片、本步词数与典型预设控制"
      onToolbarKeyDown={handleKeyDown}
      useTokenVariables
      extraRootAttrs={{
        "data-soc": state.soc,
        "data-ep": state.epWorldSize,
        "data-tp": state.tpSize,
        "data-method": state.selectedMethod,
        "data-stage": state.activeStage,
      }}
      toolbar={
        <>
          <fieldset className="wiki-edu-btn-row" aria-label="昇腾硬件族切换">
            {MOE_SOC_FAMILIES.map((item) => {
              const active = mode === "sandbox" && soc === item;
              return (
                <button
                  key={item}
                  type="button"
                  className="wiki-edu-btn"
                  data-testid={`moe-soc-${item}`}
                  aria-pressed={active}
                  style={tokenBtnStyle(active, "dark")}
                  onClick={() => {
                    setMode("sandbox");
                    setSoc(item);
                  }}
                >
                  {item}
                </button>
              );
            })}
          </fieldset>

          <fieldset className="wiki-edu-btn-row" aria-label="本步词数滑块">
            <label
              htmlFor={sliderId}
              className={`wiki-edu-slider-chip${state.capacityApplicable && !state.withinCapacity ? " is-oom" : ""}`}
            >
              <span className="mono">{`词数=${state.numTokens}`}</span>
              <input
                id={sliderId}
                type="range"
                min={1}
                max={sliderMax}
                step={1}
                value={state.numTokens}
                data-testid="moe-tokens-slider"
                aria-valuetext={`本步输入 ${state.numTokens} 个词元`}
                onPointerDown={() => setMode("sandbox")}
                onChange={(e) => {
                  setMode("sandbox");
                  setNumTokens(Number(e.target.value));
                }}
              />
            </label>
          </fieldset>
        </>
      }
      takeawayBadge={state.routeBadge}
      takeawayTone={state.takeawayTone}
      takeaway={state.branchSummary}
      kpi={moeKpi}
      detailsSummary="查看工程与源码细节（四套硬件策略枚举 / 动态容量门槛公式 / 运行前提）"
      detailsContent={
        <>
          源码锚点：<code>vllm-ascend@c09d3e20:vllm_ascend/device/hardware_profile.py#L279-L383</code>（
          <code>HardwareProfile</code> 绑定四套 <code>MoECommPolicy</code>：A2{" "}
          <code>CAPACITY_AND_EXPERT_DENSITY</code>、A3 <code>FUSED_OR_CAPACITY</code>、A5{" "}
          <code>CAPACITY_AND_WORLD_SIZE</code>、310P <code>ALLGATHER</code>）与{" "}
          <code>vllm_ascend/ascend_forward_context.py#L27-L40, #L243-L425</code>（
          <code>select_moe_comm_method</code> + <code>set_mc2_tokens_capacity</code>）。常规{" "}
          <code>_MC2_TOKENS_PER_RANK_LIMIT = 512</code>、旧融合{" "}
          <code>_DISPATCH_FFN_COMBINE_TOKENS_PER_RANK_LIMIT = 512</code>，而 <code>use_cann_megamoe</code>（需{" "}
          <code>enable_fused_mc2</code>、<code>1 &lt; ep_world_size &lt;= 64</code> 且无
          LoRA）采用独立对称内存 <code>symm buffer</code>，放宽至{" "}
          <code>_MEGA_MOE_TOKENS_PER_RANK_LIMIT = 16384</code>；旧融合路径 <code>dispatch_ffn_combine</code>{" "}
          在 A3 且 <code>enable_fused_mc2 == 1</code>、<code>EP &lt;= 32</code> 时先于容量门槛返回{" "}
          <code>MoECommType.FUSED_MC2</code>。算例前提：主模型（非 MTP 草稿）、启用 EP、PP=1（故{" "}
          <code>world_size_across_dp = ep_world_size</code>）、启用图捕获且非纯 Decode 节点。当前配置：策略{" "}
          <code>{state.policy}</code>，
          <code>{`max_num_tokens = ${state.maxNumTokensRef} (${state.enablePrefillMc2 || state.megaMoeEffective ? "max_num_batched_tokens" : "max_cudagraph_capture_size"})`}</code>
          ，
          <code>{`num_tokens_per_tp_rank = min(⌈${state.maxNumTokensRef}/${state.tpSize}⌉, ${state.perRankTokenLimit}) = ${state.numTokensPerTpRank}`}</code>
          ，
          <code>{`mc2_tokens_capacity = ${state.numTokensPerTpRank} × ${state.tpSize} = ${state.mc2TokensCapacity}`}</code>
          ，
          <code>{`experts_per_rank = ⌊${state.numExperts}/${state.epWorldSize}⌋ = ${state.expertsPerRank}`}</code>
          ，裁决出口 <code>{`MoECommType.${state.selectedMethod}`}</code>（实现子路{" "}
          <code>{state.selectedSubVariant}</code>）。
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
          .wiki-edu-param-group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
          .wiki-edu-param-label { font-size: 12px; font-weight: 700; color: var(--color-ink); }
          .wiki-edu-w4a-svg { width: 100%; max-width: 900px; height: auto; display: block; margin-inline: auto; }
          .wiki-edu-w4a-mobile { display: none; flex-direction: column; gap: 8px; min-width: 0; }
          .wiki-edu-w4a-mcard { padding: 9px 11px; border-radius: 8px; border: 1.5px solid var(--color-line); background: var(--color-surface); display: flex; flex-direction: column; gap: 4px; min-width: 0; font-size: 12.5px; line-height: 1.45; color: var(--color-ink); }
          .wiki-edu-w4a-mhead { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-weight: 700; font-size: 13px; }
          .wiki-edu-w4a-mbar-track { width: 100%; height: 12px; border-radius: 6px; background: var(--color-surface-elevated); border: 1px solid var(--color-line); overflow: hidden; }
          .wiki-edu-w4a-mbar-fill { height: 100%; border-radius: 5px; transition: width 240ms ease, background-color 180ms ease; }
          .wiki-edu-w4a-anim { transition: width 240ms ease, x 240ms ease, x1 240ms ease, x2 240ms ease, fill 180ms ease, stroke 180ms ease; }
          @media (max-width: 820px) {
            .wiki-edu-w4a-svg { display: none; }
            .wiki-edu-w4a-mobile { display: flex; gap: 6px; }
            .wiki-edu-w4a-mcard { padding: 7px 9px; }
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
            .wiki-edu-takeaway-badge, .wiki-edu-kpi, .wiki-edu-static-toggle { white-space: normal; overflow-wrap: anywhere; max-width: 100%; }
            .wiki-edu-note-card, .wiki-edu-details-body { min-width: 0; overflow-wrap: anywhere; }
          }
          @container reader-main (max-width: 820px) {
            .wiki-edu-w4a-svg { display: none; }
            .wiki-edu-w4a-mobile { display: flex; }
          }
        `}</style>

        <svg
          viewBox="0 0 860 286"
          width="860"
          height="286"
          className="wiki-edu-w4a-svg"
          role="img"
          aria-label={`MoE 四族硬件通信调度状态机：当前 ${state.soc} 选路 ${state.selectedMethod}`}
        >
          <defs>
            <marker
              id={arrowId}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0,1 L9,5 L0,9 z" fill="var(--color-ink)" />
            </marker>
          </defs>

          <rect
            x="12"
            y="10"
            width="412"
            height="52"
            rx="8"
            fill={gate1Hit ? "var(--color-token-soft)" : "var(--color-surface-sunken)"}
            stroke={gate1Hit ? "var(--color-token)" : "var(--color-line)"}
            strokeWidth={gate1Hit ? "2" : "1.4"}
          />
          <text x="26" y="30" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            单卡专家 (EP=1)
          </text>
          <text x="410" y="30" textAnchor="end" fontSize="12" fontWeight="700" fill="var(--color-ink)">
            {gate1Hit ? "命中→全收集" : "已放行"}
          </text>
          <text x="26" y="51" fontSize="12" fill="var(--color-ink)">
            未跨卡拆专家
          </text>

          <rect
            x="436"
            y="10"
            width="412"
            height="52"
            rx="8"
            fill={gate2Hit ? "var(--color-accent-soft)" : "var(--color-surface)"}
            stroke={gate2Hit ? "var(--color-danger)" : "var(--color-line)"}
            strokeWidth={gate2Hit ? "2" : "1.4"}
          />
          <text x="450" y="30" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            LoRA 改道
          </text>
          <text
            x="834"
            y="30"
            textAnchor="end"
            fontSize="12"
            fontWeight="700"
            fill={gate2Hit ? "var(--color-danger)" : "var(--color-ink-muted)"}
          >
            {gate2Hit ? "命中→全互换" : "已放行"}
          </text>
          <text
            x="450"
            y="51"
            fontSize="12"
            fill={gate2Hit ? "var(--color-danger)" : "var(--color-ink-muted)"}
          >
            融合算子难插桩
          </text>

          {[113, 325, 537, 748].map((cx, idx) => {
            const targetSoc = MOE_SOC_FAMILIES[idx]!;
            const isTarget = state.activeStage === "soc-policy" && state.soc === targetSoc;
            return (
              <line
                key={targetSoc}
                x1={cx}
                y1="62"
                x2={cx}
                y2="76"
                stroke={isTarget ? "var(--color-accent)" : "var(--color-line)"}
                strokeWidth={isTarget ? "2" : "1.4"}
                markerEnd={isTarget ? `url(#${arrowId})` : undefined}
              />
            );
          })}

          <rect
            x="12"
            y="78"
            width="202"
            height="128"
            rx="8"
            fill={
              state.soc === "A2" && state.activeStage === "soc-policy"
                ? "var(--color-weight-soft)"
                : "var(--color-surface)"
            }
            stroke={
              state.soc === "A2" && state.activeStage === "soc-policy"
                ? "var(--color-weight)"
                : "var(--color-line)"
            }
            strokeWidth={state.soc === "A2" && state.activeStage === "soc-policy" ? "2" : "1.4"}
            opacity={state.activeStage !== "soc-policy" || state.soc !== "A2" ? 0.72 : 1}
          />
          <text x="24" y="102" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            A2 密度
          </text>
          <text x="24" y="128" fontSize="12" fill="var(--color-ink)">
            {`${state.expertsPerRank}/24 专家 ${state.expertsPerRank <= 24 ? "✓" : "✗"}`}
          </text>
          <text x="24" y="152" fontSize="12" fill="var(--color-ink)">
            {`EP=${state.epWorldSize} ${state.epWorldSize >= 16 ? "✓" : "✗"} · ${state.withinCapacity ? "容量内" : "超上限"}`}
          </text>
          <text
            x="24"
            y="186"
            fontSize="12"
            fontWeight="700"
            fill={
              state.soc === "A2" && state.activeStage === "soc-policy"
                ? "var(--color-ink)"
                : "var(--color-ink-muted)"
            }
          >
            {state.soc === "A2" && state.activeStage === "soc-policy"
              ? `→ ${shortMethodText(state.selectedMethod)}`
              : "全满→MC2"}
          </text>

          <rect
            x="224"
            y="78"
            width="202"
            height="128"
            rx="8"
            fill={
              state.soc === "A3" && state.activeStage === "soc-policy"
                ? "var(--color-token-soft)"
                : "var(--color-surface)"
            }
            stroke={
              state.soc === "A3" && state.activeStage === "soc-policy"
                ? "var(--color-token)"
                : "var(--color-line)"
            }
            strokeWidth={state.soc === "A3" && state.activeStage === "soc-policy" ? "2" : "1.4"}
            opacity={state.activeStage !== "soc-policy" || state.soc !== "A3" ? 0.72 : 1}
          />
          <text x="236" y="102" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            A3 融合
          </text>
          <text x="236" y="128" fontSize="12" fill="var(--color-ink)">
            ① 融合≤32 优先
          </text>
          <text x="236" y="152" fontSize="12" fill="var(--color-ink)">
            ② 超上限→全互换
          </text>
          <text
            x="236"
            y="186"
            fontSize="12"
            fontWeight="700"
            fill={
              state.soc === "A3" && state.activeStage === "soc-policy"
                ? "var(--color-ink)"
                : "var(--color-ink-muted)"
            }
          >
            {state.soc === "A3" && state.activeStage === "soc-policy"
              ? `→ ${shortMethodText(state.selectedMethod)}`
              : "融合或容量"}
          </text>

          <rect
            x="436"
            y="78"
            width="202"
            height="128"
            rx="8"
            fill={
              state.soc === "A5" && state.activeStage === "soc-policy"
                ? "var(--color-kv-soft)"
                : "var(--color-surface)"
            }
            stroke={
              state.soc === "A5" && state.activeStage === "soc-policy"
                ? "var(--color-kv)"
                : "var(--color-line)"
            }
            strokeWidth={state.soc === "A5" && state.activeStage === "soc-policy" ? "2" : "1.4"}
            opacity={state.activeStage !== "soc-policy" || state.soc !== "A5" ? 0.72 : 1}
          />
          <text x="448" y="102" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            A5 域宽
          </text>
          <text x="448" y="128" fontSize="12" fill="var(--color-ink)">
            ① 超级融合优先
          </text>
          <text x="448" y="152" fontSize="12" fill="var(--color-ink)">
            {`② EP≤${state.topK}→全收集`}
          </text>
          <text
            x="448"
            y="186"
            fontSize="12"
            fontWeight="700"
            fill={
              state.soc === "A5" && state.activeStage === "soc-policy"
                ? "var(--color-kv)"
                : "var(--color-ink-muted)"
            }
          >
            {state.soc === "A5" && state.activeStage === "soc-policy"
              ? `→ ${shortMethodText(state.selectedMethod)}`
              : "融合或域宽"}
          </text>

          <rect
            x="648"
            y="78"
            width="200"
            height="128"
            rx="8"
            fill={
              state.soc === "310P" && state.activeStage === "soc-policy"
                ? "var(--color-comm-soft)"
                : "var(--color-surface)"
            }
            stroke={
              state.soc === "310P" && state.activeStage === "soc-policy"
                ? "var(--color-comm)"
                : "var(--color-line)"
            }
            strokeWidth={state.soc === "310P" && state.activeStage === "soc-policy" ? "2" : "1.4"}
            opacity={state.activeStage !== "soc-policy" || state.soc !== "310P" ? 0.72 : 1}
          />
          <text x="660" y="102" fontSize="13" fontWeight="700" fill="var(--color-ink)">
            310P 兼容
          </text>
          <text x="660" y="128" fontSize="12" fill="var(--color-ink)">
            固定单轨广播
          </text>
          <text x="660" y="152" fontSize="12" fill="var(--color-ink)">
            无 MC2 与融合
          </text>
          <text
            x="660"
            y="186"
            fontSize="12"
            fontWeight="700"
            fill={
              state.soc === "310P" && state.activeStage === "soc-policy"
                ? "var(--color-comm)"
                : "var(--color-ink-muted)"
            }
          >
            → 全收集
          </text>

          <rect
            x="12"
            y="218"
            width="836"
            height="58"
            rx="8"
            fill="var(--color-surface)"
            stroke="var(--color-line)"
            strokeWidth="1.4"
          />
          <text x="28" y="238" fontSize="12.5" fontWeight="700" fill="var(--color-ink)">
            {`本步词数 ${state.numTokens} / 容量上限 ${state.mc2TokensCapacity} 词（${state.capacityRatioPct}%）`}
          </text>
          <text
            x="832"
            y="238"
            textAnchor="end"
            fontSize="12.5"
            fontWeight="700"
            fill={state.takeawayTone === "danger" ? "var(--color-danger)" : "var(--color-ink)"}
          >
            {`出口：${shortMethodText(state.selectedMethod)}`}
          </text>
          <rect
            x="28"
            y="248"
            width={meterFullW}
            height="16"
            rx="5"
            fill="var(--color-surface-elevated)"
            stroke="var(--color-line)"
          />
          <rect
            x="28"
            y="248"
            width={tokBarW}
            height="16"
            rx="5"
            className="wiki-edu-w4a-anim"
            fill={
              !state.capacityApplicable
                ? "var(--color-control)"
                : state.withinCapacity
                  ? "var(--color-token)"
                  : "var(--color-danger)"
            }
          />
          <line
            x1={capLineX}
            y1="244"
            x2={capLineX}
            y2="268"
            className="wiki-edu-w4a-anim"
            stroke="var(--color-accent)"
            strokeWidth="2.4"
          />
        </svg>

        <section className="wiki-edu-w4a-mobile" aria-label="移动端 MoE 状态机与容量卡">
          <div
            className="wiki-edu-w4a-mcard"
            style={{
              background: gate1Hit
                ? "var(--color-token-soft)"
                : gate0Hit || gate2Hit
                  ? "var(--color-accent-soft)"
                  : "var(--color-surface)",
              borderColor: gate1Hit
                ? "var(--color-token)"
                : gate0Hit || gate2Hit
                  ? "var(--color-danger)"
                  : "var(--color-line)",
            }}
          >
            <div className="wiki-edu-w4a-mhead">
              <span>前置闸门检查</span>
              <span>
                {gate0Hit
                  ? "拓扑非法阻断"
                  : gate1Hit
                    ? "单卡→全收集"
                    : gate2Hit
                      ? "LoRA→全互换"
                      : "已放行至芯片策略"}
              </span>
            </div>
            <span>{`EP=${state.epWorldSize} · TP=${state.tpSize} · LoRA=${state.loraEnabled ? "开" : "关"}`}</span>
          </div>

          <div
            className="wiki-edu-w4a-mcard"
            style={{
              background:
                state.activeStage === "soc-policy" ? "var(--color-token-soft)" : "var(--color-surface)",
              borderColor: state.activeStage === "soc-policy" ? "var(--color-token)" : "var(--color-line)",
            }}
          >
            <div className="wiki-edu-w4a-mhead">
              <span>{`${state.soc} 策略裁决`}</span>
              <span>{`出口：${shortMethodText(state.selectedMethod)}`}</span>
            </div>
            <span>{`每卡 ${state.expertsPerRank} 专家 · TP=${state.tpSize} · ${state.withinCapacity ? "未超上限" : "超出上限"}`}</span>
          </div>

          <div className="wiki-edu-w4a-mcard">
            <div className="wiki-edu-w4a-mhead">
              <span>{`本步 ${state.numTokens} / 上限 ${state.mc2TokensCapacity} 词`}</span>
              <span>{`${state.capacityRatioPct}%`}</span>
            </div>
            <div className="wiki-edu-w4a-mbar-track">
              <div
                className="wiki-edu-w4a-mbar-fill"
                style={{
                  width: `${state.capacityBarPct}%`,
                  background: !state.capacityApplicable
                    ? "var(--color-control)"
                    : state.withinCapacity
                      ? "var(--color-token)"
                      : "var(--color-danger)",
                }}
              />
            </div>
          </div>
        </section>

        <details className="wiki-edu-param-drawer" data-testid="moe-param-drawer">
          <summary>更多拓扑与门限设置</summary>
          <div className="wiki-edu-param-drawer-body">
            <fieldset className="wiki-edu-btn-row" aria-label="典型回退与改道预设">
              <span className="wiki-edu-param-label">典型预设</span>
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="moe-preset-a2-ep8"
                aria-pressed={isPresetA2Active}
                style={tokenBtnStyle(isPresetA2Active, "dark")}
                onClick={applyPresetA2Ep8}
              >
                A2 回退
              </button>
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="moe-preset-a3-lora"
                aria-pressed={isPresetLoraActive}
                style={tokenBtnStyle(isPresetLoraActive, "dark")}
                onClick={applyPresetA3Lora}
              >
                LoRA 改道
              </button>
            </fieldset>

            <fieldset className="wiki-edu-btn-row" aria-label="专家并行 EP 规模">
              <span className="wiki-edu-param-label">专家并行</span>
              {MOE_EP_WORLD_SIZES.map((ep) => {
                const active = mode === "sandbox" && epWorldSize === ep;
                return (
                  <button
                    key={ep}
                    type="button"
                    className="wiki-edu-btn"
                    data-testid={`moe-ep-${ep}`}
                    aria-pressed={active}
                    style={tokenBtnStyle(active, "teal")}
                    onClick={() => {
                      setMode("sandbox");
                      setEpWorldSize(ep);
                    }}
                  >
                    {`EP=${ep}`}
                  </button>
                );
              })}
            </fieldset>

            <fieldset className="wiki-edu-btn-row" aria-label="张量并行 TP、录图上限与专家模型">
              <span className="wiki-edu-param-label">张量与上限</span>
              {MOE_TP_SIZES.map((tp) => {
                const active = mode === "sandbox" && tpSize === tp;
                return (
                  <button
                    key={tp}
                    type="button"
                    className="wiki-edu-btn"
                    data-testid={`moe-tp-${tp}`}
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
              {MOE_MAX_CAPTURE_SIZES.map((cap) => {
                const active = mode === "sandbox" && maxCaptureSize === cap;
                return (
                  <button
                    key={cap}
                    type="button"
                    className="wiki-edu-btn"
                    data-testid={`moe-cap-${cap}`}
                    aria-pressed={active}
                    style={tokenBtnStyle(active, "dark")}
                    onClick={() => {
                      setMode("sandbox");
                      setMaxCaptureSize(cap);
                    }}
                  >
                    {`录图=${cap}`}
                  </button>
                );
              })}
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="moe-toggle-prefill-mc2"
                aria-pressed={mode === "sandbox" && enablePrefillMc2}
                style={tokenBtnStyle(mode === "sandbox" && enablePrefillMc2, "teal")}
                onClick={() => {
                  setMode("sandbox");
                  setEnablePrefillMc2((prev) => !prev);
                }}
              >
                Prefill MC2
              </button>
              {MOE_EXPERT_MODELS.map((em) => {
                const active = mode === "sandbox" && expertModel === em;
                return (
                  <button
                    key={em}
                    type="button"
                    className="wiki-edu-btn"
                    data-testid={`moe-experts-${em}`}
                    aria-pressed={active}
                    style={tokenBtnStyle(active, "teal")}
                    onClick={() => {
                      setMode("sandbox");
                      setExpertModel(em);
                    }}
                  >
                    {MOE_EXPERT_MODEL_META[em].shortBtn}
                  </button>
                );
              })}
            </fieldset>

            <fieldset className="wiki-edu-btn-row" aria-label="LoRA 与融合通信开关">
              <span className="wiki-edu-param-label">旁路与融合</span>
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="moe-toggle-lora"
                aria-pressed={mode === "sandbox" && loraEnabled}
                style={tokenBtnStyle(mode === "sandbox" && loraEnabled, "dark")}
                onClick={() => {
                  setMode("sandbox");
                  setLoraEnabled((prev) => !prev);
                }}
              >
                LoRA 微调
              </button>
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="moe-toggle-fused-mc2"
                aria-pressed={mode === "sandbox" && enableFusedMc2}
                style={tokenBtnStyle(mode === "sandbox" && enableFusedMc2, "teal")}
                onClick={() => {
                  setMode("sandbox");
                  setEnableFusedMc2((prev) => {
                    const next = !prev;
                    if (!next) setUseCannMegamoe(false);
                    return next;
                  });
                }}
              >
                融合 MC2
              </button>
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="moe-toggle-megamoe"
                aria-pressed={mode === "sandbox" && useCannMegamoe}
                style={tokenBtnStyle(mode === "sandbox" && useCannMegamoe, "teal")}
                onClick={() => {
                  setMode("sandbox");
                  setUseCannMegamoe((prev) => {
                    const next = !prev;
                    if (next) setEnableFusedMc2(true);
                    return next;
                  });
                }}
              >
                超级融合对称缓冲
              </button>
            </fieldset>
          </div>
        </details>

        <div className="wiki-edu-dual-grid">
          <div className="wiki-edu-note-card">
            <strong>密度与容量状态</strong>：当前 <strong>{`EP=${state.epWorldSize}`}</strong> 每卡驻留{" "}
            <strong>{`${state.expertsPerRank} 位专家`}</strong>；全组容量上限{" "}
            <strong>{`${state.mc2TokensCapacity} 词`}</strong>（每 TP 卡{" "}
            <strong>{`${state.numTokensPerTpRank} 词`}</strong>）。
          </div>
          <div className="wiki-edu-note-card">
            {state.remediationLabel !== null ? (
              <button
                type="button"
                className="wiki-edu-btn"
                data-testid="moe-apply-remediation"
                style={tokenBtnStyle(false)}
                onClick={applyRemediation}
              >
                {state.remediationLabel}
              </button>
            ) : (state.selectedMethod === "MC2" || state.selectedMethod === "FUSED_MC2") &&
              state.withinCapacity ? (
              <>
                <strong>通算重叠已就绪</strong>：选路 <strong>{shortMethodText(state.selectedMethod)}</strong>
                ，容量占用 <strong>{`${state.capacityRatioPct}%`}</strong>（{state.numTokens}/
                {state.mc2TokensCapacity} 词）。
              </>
            ) : state.selectedMethod === "FUSED_MC2" ? (
              <>
                <strong>已直选融合路径（超参考上限）</strong>：本步 <strong>{`${state.numTokens} 词`}</strong>{" "}
                &gt; 参考上限 <strong>{`${state.mc2TokensCapacity} 词`}</strong>（{state.capacityRatioPct}
                %），建议上调批预算。
              </>
            ) : state.soc === "310P" ? (
              <>
                <strong>兼容固定路径</strong>：310P 固定走<strong>全收集</strong>广播，不切换 MC2 或融合通道。
              </>
            ) : (
              <>
                <strong>未达容量门槛，回落全收集</strong>：本步 <strong>{`${state.numTokens} 词`}</strong>{" "}
                &gt; 上限 <strong>{`${state.mc2TokensCapacity} 词`}</strong>（{state.capacityRatioPct}%）。
              </>
            )}
          </div>
        </div>
      </div>
    </WikiEduSandboxShell>
  );
}
