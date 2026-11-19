import { type CouplingCheckInput, DEFAULT_RULE_VERSION, type RuleVersion, VERIFIED_COMMITS } from "./types";

export type MoeCommMethod = "ALLGATHER" | "MC2" | "FUSED_MC2" | "ALLTOALL";

export interface Mc2CapacityResult {
  version: RuleVersion;
  maxNumTokens: number;
  numTokensPerTpRank: number;
  perRankLimit: number;
  mc2TokensCapacity: number;
  dispatchV2TokensCapacity?: number;
  usedMegaMoeLimit: boolean;
  usedDecodeRequestShapes: boolean;
  sources: readonly string[];
}

export interface MoeCommSelectionResult {
  version: RuleVersion;
  method: MoeCommMethod | null;
  reason: string;
  mc2TokensCapacity: number | null;
  fusedMc2SilentlyReset: boolean;
  usedWorldSizeAcrossDpBug: boolean;
  sources: readonly string[];
}

const MEGA_MOE_TOKENS_PER_RANK_LIMIT = 16384;
const RFORK_MEGA_MOE_TOKENS_PER_RANK_LIMIT = 4096;
const MC2_TOKENS_PER_RANK_LIMIT = 512;

function isFusedMc2Requested(val: CouplingCheckInput["enableFusedMc2"]): boolean {
  return val === 1 || val === 2 || val === 3;
}

export function isMegaMoeActive(input: CouplingCheckInput, version: RuleVersion): boolean {
  if (version === "rfork") {
    // rfork@3284850b:vllm_ascend/ascend_forward_context.py#L86 hardcodes use_cann_megamoe -> False
    return false;
  }
  const family = input.hardwareFamily ?? "A3";
  if (family !== "A3" && family !== "A5") return false;
  if (input.isLoraEnabled) return false;
  if (!input.isMoe || !input.enableExpertParallel) return false;
  if (!isFusedMc2Requested(input.enableFusedMc2)) return false;
  if (input.isMegaMoeSupportedByModel === false) return false;
  if (input.isMegaMoeSupportedByConfig === false) return false;
  if (input.cannOpsTransformerAvailable === false) return false;

  const tp = Math.max(1, input.tpSize ?? 1);
  const dp = Math.max(1, input.dpSize ?? 1);
  const pcp = Math.max(1, input.pcpSize ?? 1);
  const epWorldSize = tp * dp * pcp;
  if (epWorldSize <= 1 || epWorldSize > 64) return false;

  if (family === "A5" && input.isDraftModel && input.draftMoeQuantType !== undefined) {
    const supportedDraftQuants = new Set(["w8a8", "w8a8_dynamic", "w4a8_dynamic", "mxfp8"]);
    if (!supportedDraftQuants.has(input.draftMoeQuantType)) return false;
  }

  return true;
}

export function isFusedMc2SilentlyReset(input: CouplingCheckInput, version: RuleVersion): boolean {
  if (version === "rfork") return false;
  if (!isFusedMc2Requested(input.enableFusedMc2)) return false;
  if (input.cannOpsTransformerAvailable === false) return false;
  if (input.isMegaMoeSupportedByModel === false) return false;
  return input.isMegaMoeSupportedByConfig === false;
}

export function calculateMc2TokensCapacity(
  input: CouplingCheckInput,
  version: RuleVersion = DEFAULT_RULE_VERSION,
): Mc2CapacityResult {
  const tp = Math.max(1, input.tpSize ?? 1);
  const maxBatched = input.maxNumBatchedTokens ?? 2048;
  const maxNumSeqs = input.maxNumSeqs ?? 256;
  const uniformDecodeQueryLen = input.uniformDecodeQueryLen ?? 1;

  const useMegaMoe = isMegaMoeActive(input, version);
  const effectiveFusedMc2 =
    isFusedMc2Requested(input.enableFusedMc2) && !isFusedMc2SilentlyReset(input, version);
  const cudagraphCaptureEnabled =
    input.cudagraphCaptureSizes === undefined ? true : input.cudagraphCaptureSizes.length > 0;

  let maxNumTokens: number;
  let usedDecodeRequestShapes = false;

  if (input.enablePrefillMc2 || (useMegaMoe && !input.isDecodeOnlyNode)) {
    maxNumTokens = maxBatched;
  } else if (
    version === "main" &&
    cudagraphCaptureEnabled &&
    input.decodeCudagraphCaptureRequestSizes &&
    input.decodeCudagraphCaptureRequestSizes.length > 0
  ) {
    usedDecodeRequestShapes = true;
    const prefillCap = input.maxPrefillCudagraphCaptureTokens ?? 0;
    const decodeMaxTokens =
      input.maxDecodeCudagraphCaptureTokens && input.maxDecodeCudagraphCaptureTokens > 0
        ? Math.min(maxBatched, input.maxDecodeCudagraphCaptureTokens)
        : maxBatched;
    const decodeFromShapes = input.decodeCudagraphCaptureRequestSizes.reduce((acc, shape) => {
      const q = Math.max(1, shape.queryLen);
      const limit = Math.min(shape.numReqs, Math.floor(decodeMaxTokens / q));
      if (limit < 1) return acc;
      return Math.max(acc, limit * q);
    }, 0);
    maxNumTokens = Math.max(prefillCap, decodeFromShapes);
  } else if (cudagraphCaptureEnabled && input.maxCudagraphCaptureSize !== undefined) {
    maxNumTokens = input.maxCudagraphCaptureSize;
  } else if (input.cudagraphCaptureSizes && input.cudagraphCaptureSizes.length > 0) {
    maxNumTokens = Math.max(...input.cudagraphCaptureSizes);
  } else {
    maxNumTokens = maxNumSeqs * uniformDecodeQueryLen;
  }

  const rawPerRank = Math.ceil(maxNumTokens / tp);
  const megaLimit =
    version === "rfork" ? RFORK_MEGA_MOE_TOKENS_PER_RANK_LIMIT : MEGA_MOE_TOKENS_PER_RANK_LIMIT;
  const perRankLimit = effectiveFusedMc2 && useMegaMoe ? megaLimit : MC2_TOKENS_PER_RANK_LIMIT;
  const numTokensPerTpRank = Math.min(rawPerRank, perRankLimit);
  const mc2TokensCapacity = numTokensPerTpRank * tp;

  let dispatchV2TokensCapacity: number | undefined;
  if (version === "rfork" && isFusedMc2Requested(input.enableFusedMc2)) {
    let dispatchV2MaxTokens: number;
    if (cudagraphCaptureEnabled && input.maxCudagraphCaptureSize !== undefined) {
      dispatchV2MaxTokens = input.maxCudagraphCaptureSize;
    } else if (input.cudagraphCaptureSizes && input.cudagraphCaptureSizes.length > 0) {
      dispatchV2MaxTokens = Math.max(...input.cudagraphCaptureSizes);
    } else {
      dispatchV2MaxTokens = maxNumSeqs * uniformDecodeQueryLen;
    }
    const dispatchV2PerRank = Math.min(Math.ceil(dispatchV2MaxTokens / tp), MC2_TOKENS_PER_RANK_LIMIT);
    dispatchV2TokensCapacity = dispatchV2PerRank * tp;
  }

  const sources =
    version === "main"
      ? [
          `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_forward_context.py#L259-L315`,
          `vllm@${VERIFIED_COMMITS.vllmMainVerified}:vllm/config/compilation.py#L55-L69`,
        ]
      : version === "rfork"
        ? [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_forward_context.py#L253-L296`]
        : [
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L37-L39`,
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L243-L274`,
          ];

  const result: Mc2CapacityResult = {
    version,
    maxNumTokens,
    numTokensPerTpRank,
    perRankLimit,
    mc2TokensCapacity,
    usedMegaMoeLimit: effectiveFusedMc2 && useMegaMoe,
    usedDecodeRequestShapes,
    sources,
  };
  if (dispatchV2TokensCapacity !== undefined) {
    result.dispatchV2TokensCapacity = dispatchV2TokensCapacity;
  }
  return result;
}

export function selectMoeCommMethod(
  input: CouplingCheckInput,
  version: RuleVersion = DEFAULT_RULE_VERSION,
): MoeCommSelectionResult {
  const family = input.hardwareFamily ?? "A3";
  const tp = Math.max(1, input.tpSize ?? 1);
  const dp = Math.max(1, input.dpSize ?? 1);
  const pp = Math.max(1, input.ppSize ?? 1);
  const pcp = Math.max(1, input.pcpSize ?? 1);
  const epWorldSize = tp * dp * pcp;
  const worldSizeAcrossDp = epWorldSize * pp;

  if (!input.isMoe) {
    const sources =
      version === "main"
        ? [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_forward_context.py#L420-L439`]
        : version === "rfork"
          ? [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_forward_context.py#L449-L481`]
          : [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L373-L392`,
            ];
    return {
      version,
      method: null,
      reason: "Model is not MoE; MoE communication strategy is not applicable.",
      mc2TokensCapacity: null,
      fusedMc2SilentlyReset: false,
      usedWorldSizeAcrossDpBug: false,
      sources,
    };
  }

  if (!input.enableExpertParallel || epWorldSize === 1) {
    const sources =
      version === "main"
        ? [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_forward_context.py#L444-L445`]
        : version === "rfork"
          ? [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_forward_context.py#L486-L487`]
          : [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L397-L398`,
            ];
    return {
      version,
      method: "ALLGATHER",
      reason: "Expert parallelism disabled or ep_world_size == 1 -> ALLGATHER.",
      mc2TokensCapacity: null,
      fusedMc2SilentlyReset: false,
      usedWorldSizeAcrossDpBug: false,
      sources,
    };
  }

  if (input.isLoraEnabled) {
    const sources =
      version === "main"
        ? [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_forward_context.py#L446-L451`]
        : version === "rfork"
          ? [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_forward_context.py#L488-L493`]
          : [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L399-L404`,
            ];
    return {
      version,
      method: "ALLTOALL",
      reason: "LoRA + EP forces ALLTOALL.",
      mc2TokensCapacity: null,
      fusedMc2SilentlyReset: false,
      usedWorldSizeAcrossDpBug: false,
      sources,
    };
  }

  if (family === "310P") {
    const sources =
      version === "main"
        ? [
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/device/hardware_profile.py#L425`,
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_forward_context.py#L452-L453`,
          ]
        : version === "rfork"
          ? [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_forward_context.py#L505-L506`]
          : [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L318`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L405-L406`,
            ];
    return {
      version,
      method: "ALLGATHER",
      reason: "Ascend 310P MoECommPolicy.ALLGATHER always selects ALLGATHER.",
      mc2TokensCapacity: null,
      fusedMc2SilentlyReset: false,
      usedWorldSizeAcrossDpBug: false,
      sources,
    };
  }

  const capacityInfo = calculateMc2TokensCapacity(input, version);
  const capacity = capacityInfo.mc2TokensCapacity;
  const numTokens = input.numTokens;
  const withinCapacity = numTokens === undefined || numTokens <= capacity;
  const fusedReset = isFusedMc2SilentlyReset(input, version);
  const effectiveFusedMc2 = isFusedMc2Requested(input.enableFusedMc2) && !fusedReset;

  if (family === "A2") {
    const numExperts = input.numExperts ?? 64;
    if (version === "rfork" && numExperts > 512) {
      return {
        version,
        method: "ALLGATHER",
        reason: "rfork A2 policy falls back to ALLGATHER when num_experts > 512.",
        mc2TokensCapacity: capacity,
        fusedMc2SilentlyReset: fusedReset,
        usedWorldSizeAcrossDpBug: false,
        sources: [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_forward_context.py#L332-L333`],
      };
    }
    const expertsPerDevice = Math.floor(numExperts / epWorldSize);
    const method: MoeCommMethod =
      expertsPerDevice <= 24 && epWorldSize >= 16 && withinCapacity ? "MC2" : "ALLGATHER";
    const sources =
      version === "main"
        ? [
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/device/hardware_profile.py#L388`,
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_forward_context.py#L339-L357`,
          ]
        : version === "rfork"
          ? [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_forward_context.py#L322-L340`]
          : [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L289`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L297-L315`,
            ];
    return {
      version,
      method,
      reason:
        method === "MC2"
          ? `A2 CAPACITY_AND_EXPERT_DENSITY: experts/dev=${expertsPerDevice} <= 24, ep=${epWorldSize} >= 16, within capacity (${capacity}) -> MC2.`
          : `A2 CAPACITY_AND_EXPERT_DENSITY fallback -> ALLGATHER (experts/dev=${expertsPerDevice}, ep=${epWorldSize}, capacity=${capacity}).`,
      mc2TokensCapacity: capacity,
      fusedMc2SilentlyReset: fusedReset,
      usedWorldSizeAcrossDpBug: false,
      sources,
    };
  }

  if (family === "A3") {
    const megaActive = isMegaMoeActive(input, version);
    const effectiveA3Capacity =
      version === "rfork" && effectiveFusedMc2 && capacityInfo.dispatchV2TokensCapacity !== undefined
        ? capacityInfo.dispatchV2TokensCapacity
        : capacity;
    const withinA3Capacity = numTokens === undefined || numTokens <= effectiveA3Capacity;
    let method: MoeCommMethod;
    let reason: string;
    if (megaActive) {
      method = "FUSED_MC2";
      reason = "A3 use_cann_megamoe active -> FUSED_MC2.";
    } else if (effectiveFusedMc2 && epWorldSize <= 32) {
      method = "FUSED_MC2";
      reason = `A3 enable_fused_mc2=1 and ep=${epWorldSize} <= 32 -> FUSED_MC2.`;
    } else if (withinA3Capacity) {
      method = "MC2";
      reason = `A3 within mc2_tokens_capacity (${effectiveA3Capacity}) -> MC2.`;
    } else {
      method = "ALLTOALL";
      reason = `A3 exceeds mc2_tokens_capacity (${numTokens} > ${effectiveA3Capacity}) -> ALLTOALL.`;
    }
    const sources =
      version === "main"
        ? [
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/device/hardware_profile.py#L406`,
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_forward_context.py#L102-L112`,
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_forward_context.py#L360-L375`,
          ]
        : version === "rfork"
          ? [
              `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_forward_context.py#L84-L86`,
              `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_forward_context.py#L273-L290`,
              `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_forward_context.py#L412-L428`,
            ]
          : [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L301`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L87-L97`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L318-L333`,
            ];
    return {
      version,
      method,
      reason,
      mc2TokensCapacity: effectiveA3Capacity,
      fusedMc2SilentlyReset: fusedReset,
      usedWorldSizeAcrossDpBug: false,
      sources,
    };
  }

  // Ascend A5 / 950
  const a5MegaAllowed =
    effectiveFusedMc2 &&
    input.cannOpsTransformerAvailable !== false &&
    input.isMegaMoeSupportedByModel !== false &&
    input.isMegaMoeSupportedByConfig !== false &&
    !(
      input.isDraftModel &&
      input.draftMoeQuantType !== undefined &&
      !new Set(["w8a8", "w8a8_dynamic", "w4a8_dynamic", "mxfp8"]).has(input.draftMoeQuantType)
    );
  if (a5MegaAllowed && version !== "rfork") {
    const sources =
      version === "main"
        ? [
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/device/hardware_profile.py#L451`,
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_forward_context.py#L378-L396`,
          ]
        : [
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L341`,
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L336-L357`,
          ];
    return {
      version,
      method: "FUSED_MC2",
      reason: "A5/950 enable_fused_mc2=1 with MegaMoe supported -> FUSED_MC2.",
      mc2TokensCapacity: capacity,
      fusedMc2SilentlyReset: fusedReset,
      usedWorldSizeAcrossDpBug: false,
      sources,
    };
  }

  const effectiveWorld = version === "main" ? epWorldSize : worldSizeAcrossDp;
  const usedWorldSizeAcrossDpBug = version !== "main" && pp > 1;
  const topK = input.numExpertsPerTok ?? 8;

  let method: MoeCommMethod;
  let reason: string;
  if (withinCapacity && effectiveWorld > 1) {
    method = "MC2";
    reason = `A5/950 within mc2_tokens_capacity (${capacity}) and world=${effectiveWorld} > 1 -> MC2.`;
  } else if (effectiveWorld <= topK) {
    method = "ALLGATHER";
    reason = `A5/950 world=${effectiveWorld} <= top_k=${topK} -> ALLGATHER.`;
  } else {
    method = "ALLTOALL";
    reason = `A5/950 exceeds capacity (${capacity}) and world=${effectiveWorld} > top_k=${topK} -> ALLTOALL.`;
  }

  const sources =
    version === "main"
      ? [
          `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/device/hardware_profile.py#L451`,
          `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_forward_context.py#L378-L410`,
        ]
      : version === "rfork"
        ? [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_forward_context.py#L431-L446`]
        : [
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L341`,
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L336-L363`,
          ];

  return {
    version,
    method,
    reason,
    mc2TokensCapacity: capacity,
    fusedMc2SilentlyReset: fusedReset,
    usedWorldSizeAcrossDpBug,
    sources,
  };
}
