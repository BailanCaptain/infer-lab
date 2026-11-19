/**
 * Tool ① 核心算账引擎：「立项四问」双模部署算账台（Mode A 静态 7 级区间估算 + Roofline）。
 * 纯 TypeScript 零框架依赖；HCCL 通信域与量化规则直接复用 `src/sim/rules/` 单真源。
 */

import { evaluateDomain3Rules } from "../rules/domain3Quantization";
import {
  estimateHcclDomainMemory,
  HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB,
  type HcclMemoryEstimate,
  type ProfileRunOverlapInfo,
} from "../rules/hcclAccounting";
import { calculateMc2TokensCapacity, selectMoeCommMethod } from "../rules/moeComm";
import {
  type AscendFamily,
  type CudaGraphMode,
  DEFAULT_RULE_VERSION,
  type RuleVersion,
  VERIFIED_COMMITS,
} from "../rules/types";
import { analyzeParams } from "./analyze";
import { parseHfConfig } from "./parseHfConfig";
import { getPresetSpec, MODEL_PRESETS } from "./presets";
import { attnKvDim, attnQDim, type LayerSpec, type MlpSpec, type ModelSpec } from "./types";

export const KIB = 1024;
export const MIB = 1024 ** 2;
export const GIB = 1024 ** 3;
export const DEFAULT_GPU_MEMORY_UTILIZATION = 0.92;
export const DEFAULT_BLOCK_SIZE = 128;
export const DEFAULT_MAX_NUM_BATCHED_TOKENS = 2048;
export const DEFAULT_MAX_NUM_SEQS = 256;

export type CalcEvidenceLevel = "C" | "D" | "I";
export type AscendCalcCardId = "a2-64g" | "a2-32g" | "a3-die64g" | "310p-24g" | "950dt-128g";
export type WeightPrecision =
  | "bf16"
  | "fp16"
  | "w8a8"
  | "w8a8_dynamic"
  | "w4a8"
  | "fp8_block"
  | "w8a8sc_310p";
export type KvCacheDtype = "auto" | "int8" | "mxfp8";
export type Wave4BlockedFeature = "MLA" | "CSA2" | "KDA" | "Engram";
export type Wave4TargetWikiId = "mla" | "linear-attention" | "kv-cache-spec";

export interface AscendCalcCardSpec {
  id: AscendCalcCardId;
  name: string;
  shortName: string;
  family: AscendFamily;
  hbmGiB: number;
  diesPerPhysicalCard: number;
  physicalCardHbmGiB: number;
  peakBf16Tflops: number | null;
  peakFp16Tflops: number;
  peakInt8Tops: number;
  peakFp8Tflops: number | null;
  hbmBandwidthGBs: number;
  supportsBf16: boolean;
  supportsNativeFp8: boolean;
  supportsNpugraphEx: boolean;
  forceWeightNz: boolean;
  halvesKvForWorkspace: boolean;
  interconnectNote: string;
  specNote: string;
  sources: readonly string[];
}

export const ASCEND_CALC_CARDS: readonly AscendCalcCardSpec[] = [
  {
    id: "a2-64g",
    name: "Atlas 800I/T A2 (910B · 64 GiB)",
    shortName: "Atlas A2 64G",
    family: "A2",
    hbmGiB: 64,
    diesPerPhysicalCard: 1,
    physicalCardHbmGiB: 64,
    peakBf16Tflops: 320,
    peakFp16Tflops: 320,
    peakInt8Tops: 640,
    peakFp8Tflops: null,
    hbmBandwidthGBs: 1600,
    supportsBf16: true,
    supportsNativeFp8: false,
    supportsNpugraphEx: true,
    forceWeightNz: false,
    halvesKvForWorkspace: false,
    interconnectNote: "机内 HCCS（800T A2 7 链路聚合标称 392 GB/s）；跨机 RoCE",
    specNote: "Roofline 采用 320 TFLOP/s ÷ 1.6 TB/s = 200 FLOP/B 教学标尺（910B 子型号以手册为准）",
    sources: ["wiki:roofline-and-metrics", "wiki:hardware-devices"],
  },
  {
    id: "a2-32g",
    name: "Atlas 800I A2 (910B4 · 32 GiB)",
    shortName: "Atlas A2 32G",
    family: "A2",
    hbmGiB: 32,
    diesPerPhysicalCard: 1,
    physicalCardHbmGiB: 32,
    peakBf16Tflops: 280,
    peakFp16Tflops: 280,
    peakInt8Tops: 560,
    peakFp8Tflops: null,
    hbmBandwidthGBs: 1200,
    supportsBf16: true,
    supportsNativeFp8: false,
    supportsNpugraphEx: true,
    forceWeightNz: false,
    halvesKvForWorkspace: false,
    interconnectNote: "机内 HCCS；单卡 32 GiB HBM（910B4 档位）",
    specNote: "910B4 32 GiB 参考档位（峰值算力与带宽为区间标尺，实机以设备手册为准）",
    sources: ["wiki:hardware-devices", "wiki:roofline-and-metrics"],
  },
  {
    id: "a3-die64g",
    name: "Atlas 800I/T A3 (单逻辑 Die 64 GiB / 双 Die 卡 128 GiB)",
    shortName: "Atlas A3 64G/Die",
    family: "A3",
    hbmGiB: 64,
    diesPerPhysicalCard: 2,
    physicalCardHbmGiB: 128,
    peakBf16Tflops: 376,
    peakFp16Tflops: 376,
    peakInt8Tops: 752,
    peakFp8Tflops: null,
    hbmBandwidthGBs: 1600,
    supportsBf16: true,
    supportsNativeFp8: false,
    supportsNpugraphEx: true,
    forceWeightNz: false,
    halvesKvForWorkspace: false,
    interconnectNote: "单物理卡含 2 逻辑 Die（须成对挂载 davinci0,1）；机内高速直连，支持 CANN_MEGAMOE",
    specNote: "按单逻辑 Die 64 GiB 记账（1 张双 Die 物理卡可提供 2 个逻辑设备共 128 GiB）",
    sources: ["wiki:hardware-devices"],
  },
  {
    id: "310p-24g",
    name: "Atlas 300I DUO (310P · 单芯 24 GiB / 双芯卡 48 GiB)",
    shortName: "Atlas 310P 24G",
    family: "310P",
    hbmGiB: 24,
    diesPerPhysicalCard: 2,
    physicalCardHbmGiB: 48,
    peakBf16Tflops: null,
    peakFp16Tflops: 70,
    peakInt8Tops: 140,
    peakFp8Tflops: null,
    hbmBandwidthGBs: 204,
    supportsBf16: false,
    supportsNativeFp8: false,
    supportsNpugraphEx: false,
    forceWeightNz: true,
    halvesKvForWorkspace: true,
    interconnectNote: "单物理卡含 2 逻辑芯（48 GiB）；走 NPUWorker310、FORCE_NZ，无 NPUGRAPH_EX",
    specNote:
      "仅支持 FP16 / W8A8SC（不支持 BF16 与原生 FP8）；worker_310p 启动期将可用 KV 预算减半留作工作区",
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/_310p/worker_310p.py#L140-L153`,
      "wiki:hardware-devices",
    ],
  },
  {
    id: "950dt-128g",
    name: "Ascend 950DT (A5 · 128 GiB 参考档)",
    shortName: "Ascend 950DT 128G",
    family: "A5",
    hbmGiB: 128,
    diesPerPhysicalCard: 1,
    physicalCardHbmGiB: 128,
    peakBf16Tflops: 486,
    peakFp16Tflops: 486,
    peakInt8Tops: 972,
    peakFp8Tflops: 972,
    hbmBandwidthGBs: 4000,
    supportsBf16: true,
    supportsNativeFp8: true,
    supportsNpugraphEx: true,
    forceWeightNz: false,
    halvesKvForWorkspace: false,
    interconnectNote: "Unified Bus 高速互联；原生支持 FP8 / MXFP8 / MXFP4 与 L0C→UB CV 融合",
    specNote:
      "Cube BF16 峰值 486 TFLOPS、带宽 4.0 TB/s（脊点 121.5 FLOP/B，取自昇腾 950 白皮书高配档；128 GiB 为算账台参考容量档）",
    sources: ["wiki:ascend-950-architecture", "wiki:roofline-and-metrics"],
  },
];

export function getAscendCalcCard(cardId: AscendCalcCardId): AscendCalcCardSpec {
  const card = ASCEND_CALC_CARDS.find((c) => c.id === cardId);
  if (!card) throw new Error(`未知昇腾卡型：${cardId}`);
  return card;
}

export type Wave3ModelGateResult =
  | {
      ok: true;
      supportedInWave3: true;
      spec: ModelSpec;
      sourceKind: "preset" | "custom-json";
      presetId?: string;
    }
  | {
      ok: true;
      supportedInWave3: false;
      blockedFeature: Wave4BlockedFeature;
      blockedFeatures: readonly Wave4BlockedFeature[];
      modelType: string;
      reason: string;
      unlockWave: "Wave 4";
      targetWikiId: Wave4TargetWikiId;
    }
  | {
      ok: false;
      error: string;
    };

export interface DeployPlanInput {
  model: string | ModelSpec | Record<string, unknown>;
  cardId: AscendCalcCardId;
  version?: RuleVersion;
  weightPrecision?: WeightPrecision;
  kvCacheDtype?: KvCacheDtype;
  blockSize?: number;
  userSpecifiedBlockSize?: boolean;
  weightNzMode?: 0 | 1 | 2;
  tpSize?: number;
  ppSize?: number;
  dpSize?: number;
  pcpSize?: number;
  dcpSize?: number;
  enableEp?: boolean;
  enableEplb?: boolean;
  dynamicEplb?: boolean;
  gpuMemoryUtilization?: number;
  maxModelLen?: number;
  maxNumBatchedTokens?: number;
  maxNumSeqs?: number;
  cudagraphMode?: CudaGraphMode;
  cudagraphCaptureCount?: number;
  enforceEager?: boolean;
  decodeBatchSize?: number;
  prefillTokens?: number;
  decodeContextLen?: number;
}

export type StageId =
  | "total_hbm"
  | "budget_split"
  | "weights_per_rank"
  | "profile_run_torch_peak"
  | "non_torch_increase"
  | "kv_cache_pool"
  | "post_kv_aclgraph_and_headroom";

export interface SevenStageItem {
  stageIndex: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  id: StageId;
  title: string;
  lowBytes: number;
  highBytes: number;
  pointEstimateBytes: number;
  formula: string;
  evidenceLevel: CalcEvidenceLevel;
  sources: readonly string[];
  notes: readonly string[];
}

export type KvOomStatus =
  | "fits"
  | "tight_budget_oom_risk"
  | "insufficient_for_single_max_len_seq"
  | "weights_exceed_budget"
  | "weights_plus_activation_exceed_budget"
  | "non_kv_exceeds_budget";

export type HeadroomStatus = "safe" | "risk" | "overflow";

export interface DeployPlanFinding {
  id: string;
  severity: "error" | "warn";
  title: string;
  message: string;
  remediation?: string;
  sources: readonly string[];
}

export interface SilentRewriteItem {
  id: string;
  title: string;
  param: string;
  fromValue: string;
  toValue: string;
  message: string;
  sources: readonly string[];
}

export interface RooflineAnalysis {
  computePrecisionLabel: string;
  peakComputeTflops: number;
  hbmBandwidthGBs: number;
  ridgePointFlopsPerByte: number;
  prefillTokens: number;
  prefillIntensityFlopsPerByte: number;
  prefillRegime: "compute-bound" | "memory-bound";
  decodeBatchSize: number;
  decodeLinearMEff: number;
  moeRouterDilutedRows: number | null;
  localExpertsPerRank: number | null;
  decodeLinearIntensityFlopsPerByte: number;
  decodeLinearRegime: "compute-bound" | "memory-bound";
  gqaGroupSize: number;
  decodeKvAttnIntensityFlopsPerByte: number;
  decodeKvAttnRegime: "compute-bound" | "memory-bound";
  decodeContextLen: number;
  decodeKvTrafficBytesPerStep: number;
  activeWeightBytesPerRank: number;
  evidenceLevel: CalcEvidenceLevel;
  notes: readonly string[];
}

export interface FourQuestionsReport {
  q1Fit: {
    verdict: "pass" | "warn" | "blocked";
    blockers: readonly DeployPlanFinding[];
    silentRewrites: readonly SilentRewriteItem[];
    warnings: readonly DeployPlanFinding[];
    summary: string;
  };
  q2Capacity: {
    minCardsRecommended: number;
    minPhysicalCardsRecommended: number;
    currentTotalCards: number;
    currentPhysicalCards: number;
    oomStatus: KvOomStatus;
    kvPoolLowBytes: number;
    kvPoolPointBytes: number;
    kvPoolHighBytes: number;
    kvBytesPerTokenPerRank: number;
    kvBytesPerBlock: number;
    effectiveBlockSize: number;
    rawBlocksRange: readonly [number, number];
    usableBlocksRange: readonly [number, number];
    usableBlocksPoint: number;
    totalKvTokenSlotsRange: readonly [number, number];
    totalKvTokenSlotsPoint: number;
    blocksPerMaxSeq: number;
    maxConcurrencyRange: readonly [number, number];
    maxConcurrencyPoint: number;
    summary: string;
  };
  q3Roofline: {
    primaryBottleneck: "memory-bound" | "compute-bound" | "kv-bandwidth-bound";
    roofline: RooflineAnalysis;
    summary: string;
  };
  q4Recommendation: {
    recommendedTp: number;
    recommendedPp: number;
    recommendedDp: number;
    recommendedEnableEp: boolean;
    recommendedPrecision: WeightPrecision;
    recommendedGpuMemoryUtilization: number;
    cliHint: string;
    rationale: string;
    relatedWikiIds: readonly string[];
  };
}

export interface DeployPlanReport {
  version: RuleVersion;
  spec: ModelSpec;
  card: AscendCalcCardSpec;
  isMoe: boolean;
  inputSummary: {
    weightPrecision: WeightPrecision;
    effectiveWeightPrecision: string;
    kvCacheDtype: KvCacheDtype;
    requestedBlockSize: number;
    effectiveBlockSize: number;
    weightNzMode: 0 | 1 | 2;
    tpSize: number;
    ppSize: number;
    dpSize: number;
    pcpSize: number;
    dcpSize: number;
    enableEp: boolean;
    epWorldSize: number;
    localKvHeadsPerRank: number;
    localLayersPerRank: number;
    gpuMemoryUtilization: number;
    maxModelLen: number;
    maxNumBatchedTokens: number;
    maxNumSeqs: number;
    cudagraphMode: CudaGraphMode;
    cudagraphCaptureCount: number;
    enforceEager: boolean;
  };
  totalHbmBytes: number;
  requestedBytes: number;
  unbudgetedHeadroomBytes: number;
  stages: readonly [
    SevenStageItem,
    SevenStageItem,
    SevenStageItem,
    SevenStageItem,
    SevenStageItem,
    SevenStageItem,
    SevenStageItem,
  ];
  hcclEstimate: HcclMemoryEstimate;
  workspaceHcclOverlap: ProfileRunOverlapInfo & {
    explanation: string;
    redundancyBufferBytes: number;
  };
  headroomStatus: HeadroomStatus;
  aclGraphRangeBytes: readonly [number, number];
  aclGraphPointBytes: number;
  redundancyBufferBytes: number;
  roofline: RooflineAnalysis;
  fourQuestions: FourQuestionsReport;
}

// ─── Wave 3 模型准入门禁（MLA / CSA2 / KDA / Engram 拦截）───────────────────

const MLA_MODEL_TYPES = new Set([
  "deepseek_v2",
  "deepseek_v3",
  "deepseek_v4",
  "deepseek_v41",
  "glm4_moe_lite",
]);

function isFeatureEnabled(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return s.length > 0 && s !== "false" && s !== "none" && s !== "0";
  }
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

function hasKdaLayerTypes(cfg: Record<string, unknown>): boolean {
  const lt = cfg.layer_types;
  if (Array.isArray(lt)) {
    return lt.some((x) => typeof x === "string" && /(linear|kda|gdn|deltanet)/i.test(x));
  }
  const pat = cfg.hybrid_override_pattern;
  return typeof pat === "string" && /(linear|kda|gdn)/i.test(pat);
}

interface Wave4Detection {
  primary: Wave4BlockedFeature;
  all: Wave4BlockedFeature[];
  targetWikiId: Wave4TargetWikiId;
  modelType: string;
}

function detectWave4Features(root: Record<string, unknown>): Wave4Detection | null {
  const nested =
    root.text_config && typeof root.text_config === "object" && !Array.isArray(root.text_config)
      ? (root.text_config as Record<string, unknown>)
      : root;
  const combined: Record<string, unknown> = { ...root, ...nested };
  const rawModelType =
    typeof nested.model_type === "string"
      ? nested.model_type
      : typeof root.model_type === "string"
        ? root.model_type
        : "unknown";
  const modelTypeLower = rawModelType.toLowerCase();

  const found: Wave4BlockedFeature[] = [];

  if (
    isFeatureEnabled(combined.csa2) ||
    isFeatureEnabled(combined.use_csa2) ||
    isFeatureEnabled(combined.cross_stage_attention) ||
    modelTypeLower.includes("csa2")
  ) {
    found.push("CSA2");
  }

  if (
    isFeatureEnabled(combined.engram) ||
    isFeatureEnabled(combined.use_engram) ||
    isFeatureEnabled(combined.engram_layers) ||
    isFeatureEnabled(combined.engram_config) ||
    modelTypeLower.includes("engram")
  ) {
    found.push("Engram");
  }

  if (
    isFeatureEnabled(combined.kda) ||
    isFeatureEnabled(combined.linear_kda) ||
    isFeatureEnabled(combined.kimi_linear) ||
    isFeatureEnabled(combined.use_kda) ||
    modelTypeLower === "kimi_linear" ||
    modelTypeLower === "linear_kda" ||
    modelTypeLower === "kda" ||
    hasKdaLayerTypes(combined)
  ) {
    found.push("KDA");
  }

  if (
    isFeatureEnabled(combined.kv_lora_rank) ||
    isFeatureEnabled(combined.q_lora_rank) ||
    MLA_MODEL_TYPES.has(modelTypeLower)
  ) {
    found.push("MLA");
  }

  if (found.length === 0) return null;
  const primary = found[0]!;
  const targetWikiId: Wave4TargetWikiId =
    primary === "MLA" ? "mla" : primary === "KDA" ? "linear-attention" : "kv-cache-spec";
  return { primary, all: found, targetWikiId, modelType: rawModelType };
}

function findPresetCaseInsensitive(token: string) {
  const norm = token.trim().toLowerCase();
  if (!norm) return undefined;
  return MODEL_PRESETS.find(
    (p) =>
      p.id.toLowerCase() === norm ||
      p.name.toLowerCase() === norm ||
      p.hfRepo.toLowerCase() === norm ||
      p.id.toLowerCase().replace(/[^a-z0-9]/g, "") === norm.replace(/[^a-z0-9]/g, ""),
  );
}

export function evaluateWave3ModelGate(presetIdOrRawConfig: string | unknown): Wave3ModelGateResult {
  if (typeof presetIdOrRawConfig === "string") {
    const trimmed = presetIdOrRawConfig.trim();
    if (!trimmed) {
      return { ok: false, error: "请输入内置模型预设名称或 HuggingFace config.json 内容。" };
    }
    const preset = findPresetCaseInsensitive(trimmed);
    if (preset) {
      return {
        ok: true,
        supportedInWave3: true,
        spec: getPresetSpec(preset.id),
        sourceKind: "preset",
        presetId: preset.id,
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      const presetNames = MODEL_PRESETS.map((p) => p.name).join(" / ");
      return {
        ok: false,
        error: `未匹配到内置预设（支持 ${presetNames}），且输入不是合法的 JSON 格式。`,
      };
    }
    return evaluateWave3ModelGate(parsed);
  }

  if (!presetIdOrRawConfig || typeof presetIdOrRawConfig !== "object" || Array.isArray(presetIdOrRawConfig)) {
    return { ok: false, error: "config.json 必须是 JSON 对象（键值对结构）。" };
  }

  const obj = presetIdOrRawConfig as Record<string, unknown>;
  const wave4 = detectWave4Features(obj);
  if (wave4) {
    const labelMap: Record<Wave4BlockedFeature, string> = {
      MLA: "MLA（Multi-head Latent Attention 潜向量压缩注意力）",
      CSA2: "CSA2（Cross-Stage Attention 跨阶段注意力）",
      KDA: "KDA（Kimi Delta / 线性递推注意力）",
      Engram: "Engram（外挂条件记忆层）",
    };
    const featureList = wave4.all.join(" / ");
    return {
      ok: true,
      supportedInWave3: false,
      blockedFeature: wave4.primary,
      blockedFeatures: wave4.all,
      modelType: wave4.modelType,
      reason:
        `检测到 ${labelMap[wave4.primary]}（命中特征：${featureList}，model_type=${wave4.modelType}）。` +
        `Wave 3 部署算账台仅开放标准稠密 GQA/MHA/MQA 与标准 MoE 架构，MLA / CSA2 / KDA / Engram 将在 Wave 4 解锁；` +
        `请先查阅对应概念页了解原理。`,
      unlockWave: "Wave 4",
      targetWikiId: wave4.targetWikiId,
    };
  }

  try {
    const spec = parseHfConfig(obj);
    return { ok: true, supportedInWave3: true, spec, sourceKind: "custom-json" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "解析 config.json 失败。",
    };
  }
}

// ─── Stage 3/4/5 内部算子 ────────────────────────────────────────────────────

function isModelSpec(v: unknown): v is ModelSpec {
  return (
    !!v &&
    typeof v === "object" &&
    "layers" in v &&
    Array.isArray((v as ModelSpec).layers) &&
    typeof (v as ModelSpec).hidden === "number" &&
    typeof (v as ModelSpec).numLayers === "number"
  );
}

function getMoeInfo(spec: ModelSpec): {
  isMoe: boolean;
  numExperts: number;
  topK: number;
  moeIntermediate: number;
  numSharedExperts: number;
  sharedIntermediate: number;
  moeLayerCount: number;
} {
  let moeLayerCount = 0;
  let firstMoe: Extract<MlpSpec, { kind: "moe" }> | null = null;
  for (const layer of spec.layers) {
    if (layer.mlp.kind === "moe") {
      moeLayerCount += 1;
      if (!firstMoe) firstMoe = layer.mlp;
    }
  }
  if (!firstMoe) {
    return {
      isMoe: false,
      numExperts: 0,
      topK: 0,
      moeIntermediate: 0,
      numSharedExperts: 0,
      sharedIntermediate: 0,
      moeLayerCount: 0,
    };
  }
  return {
    isMoe: true,
    numExperts: firstMoe.numExperts,
    topK: firstMoe.topK,
    moeIntermediate: firstMoe.moeIntermediate,
    numSharedExperts: firstMoe.numSharedExperts,
    sharedIntermediate: firstMoe.sharedIntermediate,
    moeLayerCount,
  };
}

interface WeightBreakdownResult {
  lowBytes: number;
  pointBytes: number;
  highBytes: number;
  activeWeightBytesPerRank: number;
  effectiveWeightPrecision: string;
  effectiveLinearElemBytes: number;
  nzApplied: boolean;
  formula: string;
  notes: string[];
}

function computeWeightsPerRank(params: {
  spec: ModelSpec;
  card: AscendCalcCardSpec;
  version: RuleVersion;
  weightPrecision: WeightPrecision;
  weightNzMode: 0 | 1 | 2;
  tpSize: number;
  ppSize: number;
  epWorldSize: number;
  enableEp: boolean;
  localKvHeads: number;
}): WeightBreakdownResult {
  const {
    spec,
    card,
    version,
    weightPrecision,
    weightNzMode,
    tpSize,
    ppSize,
    epWorldSize,
    enableEp,
    localKvHeads,
  } = params;

  const isFp8SilentBf16 =
    weightPrecision === "fp8_block" &&
    (card.family === "A2" || card.family === "A3") &&
    version === "v0.30.0";
  const isFp8Mxfp8 = weightPrecision === "fp8_block" && card.family === "A5" && spec.hidden % 32 === 0;
  const isInt8Quant =
    weightPrecision === "w8a8" || weightPrecision === "w8a8_dynamic" || weightPrecision === "w8a8sc_310p";
  const isW4a8 = weightPrecision === "w4a8";
  // w8a8_static.py#L33 仅注册 "linear"（不含 "moe"），未量化 MoE 专家走 AscendUnquantizedFusedMoEMethod (2 B/elem)
  const isStaticW8a8NoMoe = weightPrecision === "w8a8";
  const moeInfo = getMoeInfo(spec);

  const floatElemBytes = 2;
  let quantElemBytes = 2;
  let effectiveWeightPrecision: string = weightPrecision;
  if (isFp8Mxfp8) {
    quantElemBytes = 33 / 32; // 1.03125 B/elem (1B FP8 + 1B E8M0 per 32 elems)
    effectiveWeightPrecision = "mxfp8 (33/32 B/elem)";
  } else if (isFp8SilentBf16) {
    quantElemBytes = 2;
    effectiveWeightPrecision = "bf16 (FP8 静默反量化)";
  } else if (weightPrecision === "fp8_block") {
    quantElemBytes = 2;
    effectiveWeightPrecision = "unsupported-fp8";
  } else if (isStaticW8a8NoMoe && moeInfo.isMoe) {
    quantElemBytes = 1;
    effectiveWeightPrecision = "w8a8 (仅 Linear INT8，MoE 专家保持 FP16/BF16)";
  } else if (isInt8Quant) {
    quantElemBytes = 1;
  } else if (isW4a8) {
    quantElemBytes = 0.5;
  }

  const isQuantizedLinear = isInt8Quant || isW4a8 || isFp8Mxfp8;
  const nzApplied =
    card.forceWeightNz || weightNzMode === 2 || (weightNzMode === 1 && (isInt8Quant || isW4a8));

  // Layer selection for bottleneck PP stage
  const localLayerCount = Math.ceil(spec.numLayers / ppSize);
  const perLayerCost = (
    layer: LayerSpec,
  ): {
    nonQuantBytes: number;
    activeNonQuantBytes: number;
    quantWeightBytes: number;
    scaleBytes: number;
    activeQuantWeightBytes: number;
    unquantMoeNzBytes: number;
  } => {
    const H = spec.hidden;
    const a = layer.attention;
    const localQDim = attnQDim(a) / tpSize;
    const localKvDim = localKvHeads * a.headDim;

    let nonQuantParams = 2 * H + (a.qkNorm ? 2 * a.headDim : 0);
    if (a.bias) nonQuantParams += localQDim + 2 * localKvDim;
    let activeNonQuantParams = nonQuantParams;

    const attnLinearParams = H * localQDim + 2 * H * localKvDim + localQDim * H;
    let quantParams = attnLinearParams;
    let activeQuantParams = attnLinearParams;
    let scaleBytes = 0;
    let unquantMoeParams = 0;

    if (isInt8Quant) {
      // qkv_proj out channels + o_proj out channels, 8 B/out-ch (BF16 scale+offset + FP32 scale copy)
      scaleBytes += (localQDim + 2 * localKvDim + H) * 8;
    } else if (isW4a8) {
      scaleBytes += Math.ceil(attnLinearParams / 128) * 4 + (localQDim + 2 * localKvDim + H) * 4;
    }

    if (layer.mlp.kind === "dense") {
      const localI = layer.mlp.intermediate / tpSize;
      const mlpParams = 3 * H * localI;
      quantParams += mlpParams;
      activeQuantParams += mlpParams;
      if (isInt8Quant) {
        scaleBytes += (2 * localI + H) * 8;
      } else if (isW4a8) {
        scaleBytes += Math.ceil(mlpParams / 128) * 4 + (2 * localI + H) * 4;
      }
    } else {
      const m = layer.mlp;
      // Router gate replicated in FP16/BF16
      nonQuantParams += H * m.numExperts;
      activeNonQuantParams += H * m.numExperts;
      const localExperts = enableEp ? Math.ceil(m.numExperts / epWorldSize) : m.numExperts;
      const expertSliceDiv = enableEp ? 1 : tpSize;
      const localMoeI = m.moeIntermediate / expertSliceDiv;
      const perExpertParams = 3 * H * localMoeI;
      const routedParams = localExperts * perExpertParams;
      const activeLocalExperts = Math.min(localExperts, m.topK);

      if (isStaticW8a8NoMoe) {
        // Static W8A8 only covers linear layers; MoE routed & shared experts remain unquantized (2 B/elem, no MoE INT8 scale)
        nonQuantParams += routedParams;
        activeNonQuantParams += activeLocalExperts * perExpertParams;
        unquantMoeParams += routedParams;
      } else {
        quantParams += routedParams;
        activeQuantParams += activeLocalExperts * perExpertParams;
        if (isInt8Quant) {
          // quantization.md#L313-L316: w13 (BF16 scale+offset + FP32 copy = 8B/out), w2 (BF16 scale+offset = 4B/out)
          scaleBytes += localExperts * (2 * localMoeI * 8 + H * 4);
        } else if (isW4a8) {
          scaleBytes += Math.ceil(routedParams / 128) * 4 + localExperts * (2 * localMoeI + H) * 4;
        }
      }

      if (m.numSharedExperts > 0) {
        const localSharedI = m.sharedIntermediate / tpSize;
        const sharedParams = m.numSharedExperts * 3 * H * localSharedI;
        if (isStaticW8a8NoMoe) {
          nonQuantParams += sharedParams;
          activeNonQuantParams += sharedParams;
          unquantMoeParams += sharedParams;
        } else {
          quantParams += sharedParams;
          activeQuantParams += sharedParams;
          if (isInt8Quant) {
            scaleBytes += m.numSharedExperts * (2 * localSharedI + H) * 8;
          } else if (isW4a8) {
            scaleBytes += Math.ceil(sharedParams / 128) * 4 + m.numSharedExperts * (2 * localSharedI + H) * 4;
          }
        }
      }
    }

    return {
      nonQuantBytes: nonQuantParams * floatElemBytes,
      activeNonQuantBytes: activeNonQuantParams * floatElemBytes,
      quantWeightBytes: quantParams * quantElemBytes,
      scaleBytes,
      activeQuantWeightBytes: activeQuantParams * quantElemBytes,
      unquantMoeNzBytes: unquantMoeParams * floatElemBytes,
    };
  };

  const layerCosts = spec.layers.map(perLayerCost);
  // Pick heaviest localLayerCount layers for bottleneck PP rank
  const sortedCosts = [...layerCosts].sort(
    (a, b) =>
      b.nonQuantBytes +
      b.quantWeightBytes +
      b.scaleBytes -
      (a.nonQuantBytes + a.quantWeightBytes + a.scaleBytes),
  );
  const rankLayers = sortedCosts.slice(0, localLayerCount);

  let nonQuantBytes = 0;
  let activeNonQuantBytes = 0;
  let quantWeightBytes = 0;
  let scaleBytes = 0;
  let activeQuantWeightBytes = 0;
  let unquantMoeNzBytes = 0;
  for (const c of rankLayers) {
    nonQuantBytes += c.nonQuantBytes;
    activeNonQuantBytes += c.activeNonQuantBytes;
    quantWeightBytes += c.quantWeightBytes;
    scaleBytes += c.scaleBytes;
    activeQuantWeightBytes += c.activeQuantWeightBytes;
    unquantMoeNzBytes += c.unquantMoeNzBytes;
  }

  // Embeddings, final norm & lm_head (kept in floatElemBytes)
  const embedPerRankBytes = ((spec.vocab * spec.hidden) / tpSize) * floatElemBytes;
  const lmHeadPerRankBytes = spec.tieWordEmbeddings ? 0 : embedPerRankBytes;
  const finalNormBytes = spec.hidden * floatElemBytes;
  const vocabAndNormBytes =
    ppSize === 1
      ? embedPerRankBytes + lmHeadPerRankBytes + finalNormBytes
      : Math.max(embedPerRankBytes, lmHeadPerRankBytes + finalNormBytes);
  nonQuantBytes += vocabAndNormBytes;
  activeNonQuantBytes += vocabAndNormBytes;

  const baseNdBytes = Math.round(nonQuantBytes + quantWeightBytes + scaleBytes);
  const forceAllNz = card.forceWeightNz || weightNzMode === 2;
  const nzTargetBytes = forceAllNz
    ? quantWeightBytes + unquantMoeNzBytes
    : isQuantizedLinear
      ? quantWeightBytes
      : 0;
  const nzLow = 0;
  const nzPoint = nzApplied ? Math.round(nzTargetBytes * 0.014) : 0;
  const nzHigh = nzApplied ? Math.round(nzTargetBytes * 0.03) : 0;

  const lowBytes = baseNdBytes + nzLow;
  const pointBytes = baseNdBytes + nzPoint;
  const highBytes = baseNdBytes + nzHigh;
  const activeWeightBytesPerRank = Math.round(activeNonQuantBytes + activeQuantWeightBytes + scaleBytes);

  const notes: string[] = [];
  if (isFp8SilentBf16) {
    notes.push("v0.30.0 在 A2/A3 上加载原生分块 FP8 时静默反量化回 BF16（2 B/elem），权重显存未减半。");
  } else if (isFp8Mxfp8) {
    notes.push(
      "Ascend 950 加载期将原生分块 FP8 重分组为 MXFP8（33/32 = 1.03125 B/elem）；词表/norm/router 保持 BF16。",
    );
  } else if (isStaticW8a8NoMoe && moeInfo.isMoe) {
    notes.push(
      "v0.30.0 静态 W8A8（w8a8_static.py）仅注册于 linear 层：仅注意力与稠密 MLP 按 INT8+scale 计费，MoE 路由/共享专家保持 FP16/BF16（2 B/elem，不加 MoE INT8 scale）；如需压缩专家请改用 w8a8_dynamic。",
    );
  } else if (isInt8Quant || isW4a8) {
    notes.push(
      "线性投影与专家权重按量化位宽计（含逐通道/分组 scale）；embed_tokens、lm_head、norm 与 MoE router 保持 FP16/BF16。",
    );
  }
  if (nzApplied) {
    notes.push("FRACTAL_NZ 分块重排引入 [1.00×, 1.03×] 对齐填充区间。");
  } else {
    notes.push("weight_nz_mode=1 下 BF16/FP16 保持 ND 布局，无 NZ 对齐膨胀。");
  }

  const totalParams = analyzeParams(spec).total;
  const formula =
    `总参 ${(totalParams / 1e9).toFixed(2)}B → 单卡分片 (TP=${tpSize}, PP=${ppSize}${enableEp ? `, EP=${epWorldSize}` : ""}), ` +
    `有效精度 ${effectiveWeightPrecision}${nzApplied ? ", FRACTAL_NZ [1.00×, 1.03×]" : ", ND"}`;

  return {
    lowBytes,
    pointBytes,
    highBytes,
    activeWeightBytesPerRank,
    effectiveWeightPrecision,
    effectiveLinearElemBytes: quantElemBytes,
    nzApplied,
    formula,
    notes,
  };
}

function computeProfileRunTorchPeak(params: {
  spec: ModelSpec;
  card: AscendCalcCardSpec;
  version: RuleVersion;
  weightPrecision: WeightPrecision;
  tpSize: number;
  ppSize: number;
  dpSize: number;
  pcpSize: number;
  enableEp: boolean;
  maxNumBatchedTokens: number;
  maxNumSeqs: number;
}): {
  lowBytes: number;
  pointBytes: number;
  highBytes: number;
  formula: string;
  notes: string[];
} {
  const {
    spec,
    card,
    version,
    weightPrecision,
    tpSize,
    ppSize,
    dpSize,
    pcpSize,
    enableEp,
    maxNumBatchedTokens,
    maxNumSeqs,
  } = params;
  const T = Math.max(1, maxNumBatchedTokens);
  const H = spec.hidden;
  const firstLayer = spec.layers[0];
  const qDimPerRank = firstLayer ? attnQDim(firstLayer.attention) / tpSize : H / tpSize;
  const kvDimPerRank = firstLayer ? attnKvDim(firstLayer.attention) / tpSize : H / tpSize;
  const moe = getMoeInfo(spec);

  // Hidden + residual + QKV + O buffers
  const hiddenAttnBytes = T * (6 * H + 2 * qDimPerRank + 4 * kvDimPerRank) * 2;

  // MLP / MoE intermediate buffers
  let ffnPeakBytes: number;
  const notes: string[] = [];
  if (moe.isMoe) {
    const epWorld = enableEp ? dpSize * tpSize * pcpSize : 1;
    const routedTokens = T * moe.topK;
    const perRankRouted = enableEp ? Math.max(T, Math.ceil((routedTokens * 1.4) / epWorld)) : routedTokens;
    ffnPeakBytes = perRankRouted * (2 * moe.moeIntermediate + H) * 2;

    const moeComm = selectMoeCommMethod(
      {
        hardwareFamily: card.family,
        tpSize,
        ppSize,
        dpSize,
        pcpSize,
        isMoe: true,
        enableExpertParallel: enableEp,
        numExperts: moe.numExperts,
        numExpertsPerTok: moe.topK,
        maxNumBatchedTokens: T,
        maxNumSeqs,
      },
      version,
    );
    const mc2Cap = enableEp
      ? calculateMc2TokensCapacity(
          {
            hardwareFamily: card.family,
            tpSize,
            dpSize,
            pcpSize,
            isMoe: true,
            enableExpertParallel: true,
            maxNumBatchedTokens: T,
            maxNumSeqs,
          },
          version,
        )
      : null;
    if (mc2Cap && T > mc2Cap.mc2TokensCapacity && (moeComm.method === "MC2" || card.family !== "310P")) {
      notes.push(
        `MoE 试跑双路径预热：mc2_tokens_capacity=${mc2Cap.mc2TokensCapacity}（通信选路=${moeComm.method ?? "ALLGATHER"}）；若命中 MC2 门槛，profile_run 会先按小批量跑一次 MC2 假前向，再按 T=${T} 跑主试跑。`,
      );
    } else {
      notes.push(`MoE 通信路径估计：${moeComm.method ?? "ALLGATHER"}（${moeComm.reason}）。`);
    }
  } else {
    const denseI = firstLayer && firstLayer.mlp.kind === "dense" ? firstLayer.mlp.intermediate : 4 * H;
    ffnPeakBytes = 3 * T * (denseI / tpSize) * 2;
  }

  // Last-PP-stage (or PP=1) vocab logits peak (FP32)
  const logitTokensLow = Math.min(T, maxNumSeqs);
  const logitTokensHigh = Math.min(T, Math.max(maxNumSeqs * 2, Math.min(T, 1024)));
  const logitsLowBytes = logitTokensLow * (spec.vocab / tpSize) * 4;
  const logitsHighBytes = logitTokensHigh * (spec.vocab / tpSize) * 4;

  // Ascend operator workspace + PyTorch NPU caching allocator peak overhead
  const quantWorkspaceFactor =
    weightPrecision === "w8a8" ||
    weightPrecision === "w8a8_dynamic" ||
    weightPrecision === "w4a8" ||
    weightPrecision === "w8a8sc_310p"
      ? 1.18
      : 1.0;
  const baseWorkspaceLow = (card.family === "310P" ? 0.3 : 0.65) * GIB;
  const baseWorkspaceHigh = (card.family === "310P" ? 0.9 : 1.55) * GIB;
  const scaleWithModel = Math.min(1.6, Math.max(0.55, (H / 4096) * 0.75 + (moe.isMoe ? 0.45 : 0.25)));

  const lowBytes = Math.round(
    (hiddenAttnBytes + ffnPeakBytes + logitsLowBytes + baseWorkspaceLow * scaleWithModel) *
      quantWorkspaceFactor,
  );
  const highBytes = Math.round(
    ((hiddenAttnBytes + ffnPeakBytes) * 1.65 + logitsHighBytes + baseWorkspaceHigh * scaleWithModel) *
      quantWorkspaceFactor,
  );
  const pointBytes = Math.round(lowBytes * 0.42 + highBytes * 0.58);

  notes.push(
    `区间估计 [I]：按 max_num_batched_tokens=${T}、max_num_seqs=${maxNumSeqs} 估算前向激活、末段词表 logits 峰值与 CANN/PyTorch 工作区；真实值受 CANN 版本与算子 tiling 影响，需以 Mode B 启动日志复核。`,
  );

  const formula = `profile_run(T=${T}, B_seq=${maxNumSeqs}, H=${H}, V/TP=${Math.round(spec.vocab / tpSize)}) 激活 + 算子工作区区间`;
  return { lowBytes, pointBytes, highBytes, formula, notes };
}

function computeNonTorchIncrease(params: {
  card: AscendCalcCardSpec;
  hccl: HcclMemoryEstimate;
  isMoe: boolean;
  enableEp: boolean;
  worldSize: number;
}): {
  lowBytes: number;
  pointBytes: number;
  highBytes: number;
  formula: string;
  notes: string[];
} {
  const { card, hccl, isMoe, enableEp, worldSize } = params;
  const hcclMaterializedBytes = hccl.totalMaterializedMiB * MIB;
  // MC2 buffer governed by CANN HCCL_BUFFSIZE (when multi-card MoE/EP active)
  const mc2ExtraLow = isMoe && enableEp && worldSize > 1 && card.family !== "310P" ? 100 * MIB : 0;
  const mc2ExtraHigh = isMoe && enableEp && worldSize > 1 && card.family !== "310P" ? 400 * MIB : 0;
  // CANN runtime / ACL streams / driver non-torch context
  const cannLowBytes = (card.family === "310P" ? 0.18 : 0.25) * GIB;
  const cannHighBytes = (card.family === "310P" ? 0.45 : 0.65) * GIB;

  const lowBytes = Math.round(hcclMaterializedBytes + mc2ExtraLow + cannLowBytes);
  const highBytes = Math.round(hcclMaterializedBytes + mc2ExtraHigh + cannHighBytes);
  const pointBytes = Math.round(
    hcclMaterializedBytes + (mc2ExtraLow + mc2ExtraHigh) * 0.35 + (cannLowBytes + cannHighBytes) * 0.38,
  );

  const formula = `HCCL 去重具象化 ${hccl.totalMaterializedMiB} MiB (${hccl.uniqueMaterializedGroups.length} 组) + CANN 流/上下文${mc2ExtraHigh > 0 ? " + MC2(HCCL_BUFFSIZE)" : ""}`;
  const notes = [
    `复用 hcclAccounting 单真源：逻辑 ${hccl.logicalGroups.length} 组，经 _HCCL_PG_REGISTRY 去重后具象化 ${hccl.uniqueMaterializedGroups.length} 组共 ${hccl.totalMaterializedMiB} MiB（去重 ${hccl.deduplicatedGroupCount} 组）；mc2 组传 pg_options=None，由 CANN HCCL_BUFFSIZE 管控。`,
    `严禁双重扣减：init_snapshot 拍在分布式建组之前，profile_run() 结束后测得的 non_torch_increase 与 non_kv_cache_memory 已包含已具象化的 HCCL/MC2 缓冲与共享工作区，Mode B 日志对账绝不能在其上再手工减一遍 HCCL（worker.py 仅额外保留 ${HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB} MiB 低估安全裕度）。`,
  ];

  return { lowBytes, pointBytes, highBytes, formula, notes };
}

function computeAclGraphRange(params: {
  spec: ModelSpec;
  card: AscendCalcCardSpec;
  cudagraphMode: CudaGraphMode;
  cudagraphCaptureCount: number;
  enforceEager: boolean;
  isMoe: boolean;
}): {
  lowBytes: number;
  pointBytes: number;
  highBytes: number;
  effectiveCount: number;
  notes: string[];
} {
  const { spec, card, cudagraphMode, cudagraphCaptureCount, enforceEager, isMoe } = params;
  if (enforceEager || cudagraphMode === "NONE") {
    return {
      lowBytes: 0,
      pointBytes: 0,
      highBytes: 0,
      effectiveCount: 0,
      notes: ["已启用 --enforce-eager 或 CUDAGraphMode.NONE，跳过 capture_model()，图显存为 0。"],
    };
  }
  const modeMultiplier: Record<CudaGraphMode, number> = {
    NONE: 0,
    PIECEWISE: 1.0,
    FULL_DECODE_ONLY: 0.85,
    FULL: 1.25,
    FULL_AND_PIECEWISE: 1.4,
  };
  const effectiveCount = Math.max(1, cudagraphCaptureCount);
  const layerScale = Math.max(0.65, spec.numLayers / 36);
  const moeScale = isMoe ? 1.25 : 1.0;
  const perGraphLowMiB = 38 * modeMultiplier[cudagraphMode] * layerScale * moeScale;
  const perGraphHighMiB = 115 * modeMultiplier[cudagraphMode] * layerScale * moeScale;

  const lowBytes = Math.round((200 + effectiveCount * perGraphLowMiB) * MIB);
  const highBytes = Math.round((400 + effectiveCount * perGraphHighMiB) * MIB);
  const pointBytes = Math.round(lowBytes * 0.55 + highBytes * 0.45);

  const notes = [
    `ACLGraph (${cudagraphMode}, 录制 ${effectiveCount} 档尺寸) 在切完 KV 池之后执行 capture_model()，由第 2 级预算外 1−u 余量支付，不扣减 KV 池预算。`,
    `worker.py 录完图后另在建议值中扣留 ${HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB} MiB（redundancy_buffer）兜底非 Torch 少量低估。`,
  ];
  if (!card.supportsNpugraphEx) {
    notes.push("310P 不支持 NPUGRAPH_EX，自动禁用 npugraph_ex / static_kernel / super_kernel。");
  }
  return { lowBytes, pointBytes, highBytes, effectiveCount, notes };
}

function gemmArithmeticIntensity(
  M: number,
  K: number,
  N: number,
  actInBytes: number,
  weightBytes: number,
  actOutBytes: number,
): number {
  const flops = 2 * M * K * N;
  const bytes = M * K * actInBytes + K * N * weightBytes + M * N * actOutBytes;
  return bytes > 0 ? flops / bytes : 0;
}

function computeRoofline(params: {
  spec: ModelSpec;
  card: AscendCalcCardSpec;
  weightInfo: WeightBreakdownResult;
  weightPrecision: WeightPrecision;
  kvElemBytes: number;
  kvBytesPerTokenPerRank: number;
  tpSize: number;
  dpSize: number;
  epWorldSize: number;
  enableEp: boolean;
  prefillTokens: number;
  decodeBatchSize: number;
  decodeContextLen: number;
}): RooflineAnalysis {
  const {
    spec,
    card,
    weightInfo,
    weightPrecision,
    kvElemBytes,
    kvBytesPerTokenPerRank,
    tpSize,
    dpSize,
    epWorldSize,
    enableEp,
    prefillTokens,
    decodeBatchSize,
    decodeContextLen,
  } = params;
  const firstLayer = spec.layers[0]!;
  const a = firstLayer.attention;
  const moe = getMoeInfo(spec);

  const wBytes = weightInfo.effectiveLinearElemBytes;
  let peakComputeTflops: number;
  let computePrecisionLabel: string;
  let actInBytes = 2;
  const actOutBytes = 2;

  if (wBytes <= 1.05 && weightPrecision === "fp8_block" && card.supportsNativeFp8) {
    peakComputeTflops = card.peakFp8Tflops ?? card.peakInt8Tops;
    computePrecisionLabel = "MXFP8 / FP8 Cube";
    actInBytes = 1;
  } else if (wBytes <= 1.05) {
    peakComputeTflops = card.peakInt8Tops;
    computePrecisionLabel = wBytes < 1 ? "W4A8 / INT8 Cube" : "INT8 W8A8 Cube";
    actInBytes = 1;
  } else {
    peakComputeTflops = card.peakBf16Tflops ?? card.peakFp16Tflops;
    computePrecisionLabel = card.supportsBf16 ? "BF16/FP16 Cube" : "FP16 Cube";
    actInBytes = 2;
  }

  const ridgePointFlopsPerByte = (peakComputeTflops * 1000) / card.hbmBandwidthGBs;

  // Representative linear GEMM shape (q_proj / expert proj)
  const K = spec.hidden;
  const N = moe.isMoe
    ? moe.moeIntermediate
    : Math.max(Math.round(attnQDim(a) / tpSize), Math.round(K / tpSize));
  const prefillN = Math.max(Math.round(attnQDim(a) / tpSize), K);

  const prefillIntensityFlopsPerByte = gemmArithmeticIntensity(
    prefillTokens,
    K,
    prefillN,
    actInBytes,
    wBytes,
    actOutBytes,
  );
  const prefillRegime =
    prefillIntensityFlopsPerByte >= ridgePointFlopsPerByte ? "compute-bound" : "memory-bound";

  const localExpertsPerRank = moe.isMoe
    ? enableEp
      ? Math.ceil(moe.numExperts / epWorldSize)
      : moe.numExperts
    : null;

  // MoE router dilution: (DP × B × topK) / E_total rows per expert on average; touched experts process >= 1 row
  const moeRouterDilutedRows = moe.isMoe ? (dpSize * decodeBatchSize * moe.topK) / moe.numExperts : null;
  const decodeLinearMEff = moe.isMoe ? Math.max(1, moeRouterDilutedRows!) : decodeBatchSize;

  const decodeWBytes = moe.isMoe && weightPrecision === "w8a8" ? 2 : wBytes;
  const decodeActInBytes = moe.isMoe && weightPrecision === "w8a8" ? 2 : actInBytes;
  const decodeLinearIntensityFlopsPerByte = gemmArithmeticIntensity(
    decodeLinearMEff,
    K,
    N,
    decodeActInBytes,
    decodeWBytes,
    actOutBytes,
  );
  const decodeLinearRegime =
    decodeLinearIntensityFlopsPerByte >= ridgePointFlopsPerByte ? "compute-bound" : "memory-bound";

  const gqaGroupSize = a.numHeads / a.numKvHeads;
  const decodeKvAttnIntensityFlopsPerByte = (2 * gqaGroupSize) / kvElemBytes;
  const decodeKvAttnRegime =
    decodeKvAttnIntensityFlopsPerByte >= ridgePointFlopsPerByte ? "compute-bound" : "memory-bound";

  const decodeKvTrafficBytesPerStep = decodeBatchSize * decodeContextLen * kvBytesPerTokenPerRank;

  const notes: string[] = [
    `硬件脊点 I_ridge = ${peakComputeTflops} T / ${(card.hbmBandwidthGBs / 1000).toFixed(2)} TB/s = ${ridgePointFlopsPerByte.toFixed(1)} FLOP/B（${computePrecisionLabel}）。`,
    `GQA Decode KV 读取强度锁定在 2 × (${a.numHeads}/${a.numKvHeads}) / ${kvElemBytes}B = ${decodeKvAttnIntensityFlopsPerByte.toFixed(1)} FLOP/B，不随并发数 B 增长。`,
  ];
  if (moe.isMoe && moeRouterDilutedRows !== null) {
    notes.push(
      `MoE 路由稀释：单专家平均行数为 (DP=${dpSize} × B=${decodeBatchSize} × topK=${moe.topK}) / ${moe.numExperts} = ${moeRouterDilutedRows.toFixed(2)} 行（单卡本地 ${localExpertsPerRank} 个专家，活跃专家至少 1 行 → M_eff=${decodeLinearMEff.toFixed(2)}）。`,
    );
  }
  if (weightPrecision === "fp8_block" && (card.family === "A2" || card.family === "A3")) {
    notes.push("注意：原生分块 FP8 在 A2/A3 上被反量化回 2 B BF16，不会获得 1 B 权重右移省带宽增益。");
  }

  return {
    computePrecisionLabel,
    peakComputeTflops,
    hbmBandwidthGBs: card.hbmBandwidthGBs,
    ridgePointFlopsPerByte,
    prefillTokens,
    prefillIntensityFlopsPerByte,
    prefillRegime,
    decodeBatchSize,
    decodeLinearMEff,
    moeRouterDilutedRows,
    localExpertsPerRank,
    decodeLinearIntensityFlopsPerByte,
    decodeLinearRegime,
    gqaGroupSize,
    decodeKvAttnIntensityFlopsPerByte,
    decodeKvAttnRegime,
    decodeContextLen,
    decodeKvTrafficBytesPerStep,
    activeWeightBytesPerRank: weightInfo.activeWeightBytesPerRank,
    evidenceLevel: "D",
    notes,
  };
}

function buildRelatedWikiIds(params: {
  card: AscendCalcCardSpec;
  isMoe: boolean;
  weightPrecision: WeightPrecision;
  kvCacheDtype: KvCacheDtype;
  tpSize: number;
  ppSize: number;
  dpSize: number;
  worldSize: number;
  enforceEager: boolean;
  cudagraphMode: CudaGraphMode;
}): string[] {
  const ids = new Set<string>([
    "hf-model-anatomy",
    "kv-cache-memory-profiling",
    "roofline-and-metrics",
    "hardware-devices",
  ]);
  if (params.isMoe) {
    ids.add("moe");
    ids.add("expert-parallel");
  }
  if (params.tpSize > 1) ids.add("tensor-parallel");
  if (params.ppSize > 1) ids.add("pipeline-parallel");
  if (params.dpSize > 1) ids.add("data-parallel");
  if (params.weightPrecision !== "bf16" && params.weightPrecision !== "fp16") {
    ids.add("quantization");
    ids.add("low-precision-formats");
  }
  if (params.kvCacheDtype !== "auto") ids.add("kv-cache-quantization");
  if (params.card.family === "A5") ids.add("ascend-950-architecture");
  if (params.worldSize > 1) ids.add("hccl-buffer");
  if (!params.enforceEager && params.cudagraphMode !== "NONE" && params.card.supportsNpugraphEx) {
    ids.add("acl-graph");
  }
  return Array.from(ids);
}

function recommendMinCards(params: {
  spec: ModelSpec;
  card: AscendCalcCardSpec;
  version: RuleVersion;
  weightPrecision: WeightPrecision;
  weightNzMode: 0 | 1 | 2;
  kvElemBytes: number;
  effectiveBlockSize: number;
  gpuMemoryUtilization: number;
  maxModelLen: number;
  maxNumBatchedTokens: number;
  maxNumSeqs: number;
  isMoe: boolean;
}): { minCards: number; recommendedTp: number; recommendedPp: number; recommendedEnableEp: boolean } {
  const {
    spec,
    card,
    version,
    weightPrecision,
    weightNzMode,
    kvElemBytes,
    effectiveBlockSize,
    gpuMemoryUtilization,
    maxModelLen,
    maxNumBatchedTokens,
    maxNumSeqs,
    isMoe,
  } = params;
  const firstAttn = spec.layers[0]!.attention;
  const requestedBytes = Math.floor(card.hbmGiB * GIB * gpuMemoryUtilization);
  const candidates = [1, 2, 4, 8, 16, 32, 64];

  for (const n of candidates) {
    const tp = n <= 8 && firstAttn.numHeads % n === 0 ? n : firstAttn.numHeads % 8 === 0 ? 8 : 4;
    const pp = Math.max(1, Math.ceil(n / tp));
    if (tp * pp !== n && n <= 8) continue;
    const enableEp = isMoe && n > 1;
    const epWorld = enableEp ? tp : 1;
    const localKvHeads = firstAttn.numKvHeads >= tp ? Math.ceil(firstAttn.numKvHeads / tp) : 1;
    const w = computeWeightsPerRank({
      spec,
      card,
      version,
      weightPrecision,
      weightNzMode,
      tpSize: tp,
      ppSize: pp,
      epWorldSize: epWorld,
      enableEp,
      localKvHeads,
    });
    const act = computeProfileRunTorchPeak({
      spec,
      card,
      version,
      weightPrecision,
      tpSize: tp,
      ppSize: pp,
      dpSize: 1,
      pcpSize: 1,
      enableEp,
      maxNumBatchedTokens,
      maxNumSeqs,
    });
    const hccl = estimateHcclDomainMemory(
      {
        hardwareFamily: card.family,
        tpSize: tp,
        ppSize: pp,
        dpSize: 1,
        pcpSize: 1,
        dcpSize: 1,
        isMoe,
        enableExpertParallel: enableEp,
      },
      version,
    );
    const nonTorch = computeNonTorchIncrease({
      card,
      hccl,
      isMoe,
      enableEp,
      worldSize: tp * pp,
    });
    let availKv = requestedBytes - (w.pointBytes + act.pointBytes + nonTorch.pointBytes);
    if (card.halvesKvForWorkspace && availKv > 0) availKv = Math.floor(availKv / 2);

    const localLayers = Math.ceil(spec.numLayers / pp);
    const kvPerToken = localLayers * 2 * localKvHeads * firstAttn.headDim * kvElemBytes;
    const kvPerBlock = kvPerToken * effectiveBlockSize;
    const neededBlocks = Math.ceil(maxModelLen / effectiveBlockSize) + 1; // +1 null block
    if (availKv >= neededBlocks * kvPerBlock) {
      return {
        minCards: tp * pp,
        recommendedTp: tp,
        recommendedPp: pp,
        recommendedEnableEp: enableEp,
      };
    }
  }
  return { minCards: 64, recommendedTp: 8, recommendedPp: 8, recommendedEnableEp: isMoe };
}

function collectQ1Findings(params: {
  spec: ModelSpec;
  card: AscendCalcCardSpec;
  version: RuleVersion;
  weightPrecision: WeightPrecision;
  kvCacheDtype: KvCacheDtype;
  requestedBlockSize: number;
  effectiveBlockSize: number;
  userSpecifiedBlockSize: boolean;
  weightNzMode: 0 | 1 | 2;
  tpSize: number;
  ppSize: number;
  dpSize: number;
  epWorldSize: number;
  enableEp: boolean;
  gpuMemoryUtilization: number;
  cudagraphMode: CudaGraphMode;
  enforceEager: boolean;
  oomStatus: KvOomStatus;
  headroomStatus: HeadroomStatus;
}): {
  blockers: DeployPlanFinding[];
  silentRewrites: SilentRewriteItem[];
  warnings: DeployPlanFinding[];
} {
  const {
    spec,
    card,
    version,
    weightPrecision,
    kvCacheDtype,
    requestedBlockSize,
    effectiveBlockSize,
    userSpecifiedBlockSize,
    weightNzMode,
    tpSize,
    ppSize,
    dpSize,
    epWorldSize,
    enableEp,
    gpuMemoryUtilization,
    cudagraphMode,
    enforceEager,
    oomStatus,
    headroomStatus,
  } = params;

  const blockers: DeployPlanFinding[] = [];
  const silentRewrites: SilentRewriteItem[] = [];
  const warnings: DeployPlanFinding[] = [];
  const firstAttn = spec.layers[0]!.attention;
  const moe = getMoeInfo(spec);

  // 1. 310P BF16 blocker
  if (card.family === "310P" && weightPrecision === "bf16") {
    blockers.push({
      id: "calc-310p-no-bf16",
      severity: "error",
      title: "Atlas 300I DUO (310P) 不支持 BF16",
      message: "310P 硬件仅支持 FP16 / ModelSlim INT8（如 W8A8SC），不能运行 BF16 权重。",
      remediation: "改选 fp16 或 w8a8sc_310p，并在 vllm serve 中显式传入 --dtype float16。",
      sources: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L310-L332`,
        "wiki:hardware-devices",
      ],
    });
  }

  // 2. Domain 3 quantization rules (FP8 block & MXFP8 KV block_size)
  const d3Matches = evaluateDomain3Rules(
    {
      hardwareFamily: card.family,
      ...(weightPrecision === "fp8_block"
        ? {
            quantMethod: "fp8",
            hasWeightBlockSize: true,
            activationScheme: "dynamic",
          }
        : {}),
      modelDtype: card.family === "310P" ? "float16" : "bfloat16",
      inFeatures: spec.hidden,
      ...(kvCacheDtype === "mxfp8" ? { cacheDtype: "mxfp8" } : {}),
      blockSize: requestedBlockSize,
      userSpecifiedBlockSize,
    },
    version,
  );
  for (const m of d3Matches) {
    if (m.judgment === "error") {
      const finding: DeployPlanFinding = {
        id: m.ruleId,
        severity: "error",
        title: m.title,
        message: m.message,
        sources: m.sources,
      };
      if (m.remediation !== undefined) finding.remediation = m.remediation;
      blockers.push(finding);
    } else if (m.judgment === "silent-rewrite") {
      silentRewrites.push({
        id: m.ruleId,
        title: m.title,
        param: m.ruleId.includes("block-size") ? "block_size" : "weight_format",
        fromValue: m.ruleId.includes("block-size") ? String(requestedBlockSize) : weightPrecision,
        toValue: m.ruleId.includes("block-size")
          ? String(effectiveBlockSize)
          : String(m.effectiveMutation?.resolvedWeightFormat ?? "bfloat16"),
        message: m.message,
        sources: m.sources,
      });
    } else if (m.judgment === "warn") {
      warnings.push({
        id: m.ruleId,
        severity: "warn",
        title: m.title,
        message: m.message,
        sources: m.sources,
      });
    }
  }

  // 3. GQA + INT8 (C8) checkpoint requirement
  const hasModelSlimWeights =
    weightPrecision === "w8a8" ||
    weightPrecision === "w8a8_dynamic" ||
    weightPrecision === "w4a8" ||
    weightPrecision === "w8a8sc_310p";
  if (kvCacheDtype === "int8" && !hasModelSlimWeights) {
    blockers.push({
      id: "calc-gqa-c8-requires-quant-weights",
      severity: "error",
      title: "GQA/MHA INT8 (C8) KV Cache 需要 ModelSlim 量化权重包",
      message:
        "attention_v1.py 校验：标准 GQA/MHA 开启 --kv-cache-dtype int8 必须配合包含 C8 scale 的 ModelSlim 量化权重（w8a8 / w8a8_dynamic / w4a8 / w8a8sc_310p），不能直接用于纯 BF16/FP16 权重。",
      remediation: "将权重精度切换为 ModelSlim 量化方案（含 C8 描述文件），或将 KV 精度保持 auto。",
      sources: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/attention/attention_v1.py#L570-L587`,
      ],
    });
  }
  if (kvCacheDtype === "int8" && effectiveBlockSize % 32 !== 0) {
    warnings.push({
      id: "calc-c8-block-size-32",
      severity: "warn",
      title: "C8 INT8 KV Cache 要求 block_size 为 32 的倍数",
      message: `当前 block_size=${effectiveBlockSize} 不是 32 的倍数，C8 分页 Decode 核函数要求 32 对齐。`,
      remediation: "将 block_size 设为 128（昇腾默认）或 32 的整数倍。",
      sources: ["wiki:kv-cache-quantization"],
    });
  }

  // 4. MXFP8 KV hardware check
  if (kvCacheDtype === "mxfp8" && card.family !== "A5") {
    blockers.push({
      id: "calc-mxfp8-kv-requires-a5",
      severity: "error",
      title: "MXFP8 (C8_MXFP) KV Cache 仅支持 Ascend 950 (A5)",
      message: `当前卡型 ${card.shortName} (${card.family}) 不支持硬件原生 MXFP8 KV Cache。`,
      remediation: "切换到 Ascend 950DT，或在 A2/A3 上改用 auto / int8 (C8)。",
      sources: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/quantization/methods/kv_cache/mxfp_c8.py#L51-L103`,
      ],
    });
  }

  // 5. TP head divisibility checks
  if (firstAttn.numHeads % tpSize !== 0) {
    blockers.push({
      id: "calc-tp-q-heads-indivisible",
      severity: "error",
      title: "Q 头数不能被 TP 整除",
      message: `num_attention_heads=${firstAttn.numHeads} 无法被 TP=${tpSize} 整除，ColumnParallelLinear 切分报错。`,
      remediation: "选择能整除 num_attention_heads 的 TP 大小（如 1/2/4/8）。",
      sources: ["wiki:tensor-parallel"],
    });
  }
  const kvHeadValid =
    firstAttn.numKvHeads >= tpSize
      ? firstAttn.numKvHeads % tpSize === 0
      : tpSize % firstAttn.numKvHeads === 0;
  if (!kvHeadValid) {
    blockers.push({
      id: "calc-tp-kv-heads-indivisible",
      severity: "error",
      title: "KV 头数与 TP 无法对齐",
      message: `num_key_value_heads=${firstAttn.numKvHeads} 与 TP=${tpSize} 既不整除也不能按整数倍复制。`,
      remediation: "调整 TP 使其整除 KV 头数或为 KV 头数的整数倍。",
      sources: ["wiki:tensor-parallel"],
    });
  }

  // 6. MoE / 310P / OOM / Headroom checks
  if (moe.isMoe && enableEp && epWorldSize > moe.numExperts) {
    blockers.push({
      id: "calc-ep-exceeds-experts",
      severity: "error",
      title: "EP 并行度超过路由专家总数",
      message: `EP=${epWorldSize} > num_experts=${moe.numExperts}。`,
      remediation: "降低 DP/TP 或关闭 EP。",
      sources: ["wiki:expert-parallel"],
    });
  } else if (moe.isMoe && enableEp && moe.numExperts % epWorldSize !== 0) {
    warnings.push({
      id: "calc-ep-uneven-experts",
      severity: "warn",
      title: "专家数不能被 EP 整除",
      message: `${moe.numExperts} 个路由专家分配到 EP=${epWorldSize} 时各卡专家数不均，显存按最重卡 ceil 计算。`,
      sources: ["wiki:expert-parallel"],
    });
  }
  if (moe.isMoe && weightPrecision === "w8a8") {
    warnings.push({
      id: "calc-static-w8a8-linear-only",
      severity: "warn",
      title: "v0.30.0 静态 W8A8 仅覆盖线性层，不含 MoE 专家",
      message: "MoE 路由专家在 v0.30.0 通常使用 W8A8_DYNAMIC；静态 W8A8 仅注册在 linear 层。",
      remediation: "MoE 模型推荐选用 w8a8_dynamic。",
      sources: ["wiki:quantization"],
    });
  }
  if (card.family !== "310P" && weightPrecision === "w8a8sc_310p") {
    warnings.push({
      id: "calc-w8a8sc-310p-only",
      severity: "warn",
      title: "W8A8SC 面向 Atlas 300I DUO (310P)",
      message: `当前卡型为 ${card.shortName}，推荐使用 w8a8_dynamic 而非 310P 专用 W8A8SC 权重包。`,
      sources: ["wiki:hardware-devices"],
    });
  }
  if (card.family === "310P") {
    if (weightNzMode !== 2) {
      silentRewrites.push({
        id: "calc-310p-force-nz",
        title: "310P 自动启用 FORCE_NZ 且 KV 预算减半",
        param: "weight_nz_mode / kv_budget",
        fromValue: `nz=${weightNzMode}, kv=100%`,
        toValue: "FORCE_NZ, kv=available//2",
        message: "Atlas 300I DUO 强制 FRACTAL_NZ，且 worker_310p.py 将可用 KV 显存除以 2 留作算子工作区。",
        sources: [
          `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/_310p/worker_310p.py#L140-L153`,
        ],
      });
    }
    if (!enforceEager && cudagraphMode !== "NONE") {
      warnings.push({
        id: "calc-310p-no-npugraph-ex",
        severity: "warn",
        title: "310P 不支持 NPUGRAPH_EX",
        message: "310P 自动禁用 npugraph_ex / static_kernel / super_kernel，生产常直接开启 --enforce-eager。",
        sources: ["wiki:hardware-devices"],
      });
    }
  }
  if (moe.isMoe && ppSize > 1 && dpSize > 1) {
    warnings.push({
      id: "calc-moe-pp-dp-caution",
      severity: "warn",
      title: "MoE 同时开启 PP>1 与 DP>1 存在并行约束",
      message: "vllm-ascend 多版本中 MoE 同时启用 PP>1 与 DP>1 受限于通信组编排，建议优先 TP+EP 或 DP+EP。",
      sources: ["wiki:expert-parallel"],
    });
  }
  if (gpuMemoryUtilization >= 0.95) {
    warnings.push({
      id: "calc-high-gpu-util",
      severity: "warn",
      title: `gpu_memory_utilization=${gpuMemoryUtilization.toFixed(2)} 过高`,
      message: "预算外 1−u 余量过薄，切完 KV 后的 ACLGraph capture_model() 与运行期延迟缓冲极易 OOM。",
      remediation: "建议保持默认 0.92，大批量或长上下文部署保守降至 0.90 或 0.85。",
      sources: ["wiki:kv-cache-memory-profiling"],
    });
  }

  if (oomStatus === "weights_exceed_budget") {
    blockers.push({
      id: "calc-oom-stage3-weights",
      severity: "error",
      title: "第 3 级权重超出单卡显存预算（加载期 OOM）",
      message: "仅常驻模型权重就超过 total_memory × u，无法完成 load_model()。",
      remediation: "增加 TP/PP/EP 卡数，或改用 W8A8 / W4A8 量化权重。",
      sources: ["wiki:kv-cache-memory-profiling"],
    });
  } else if (oomStatus === "weights_plus_activation_exceed_budget" || oomStatus === "non_kv_exceeds_budget") {
    blockers.push({
      id: "calc-oom-stage45-profile",
      severity: "error",
      title:
        oomStatus === "weights_plus_activation_exceed_budget"
          ? "第 4 级试跑激活峰值打爆单卡预算（profile_run OOM）"
          : "第 5 级非 Torch 增量（含 HCCL）叠加后打爆单卡预算",
      message: "权重 + 试跑激活峰值 + 非 Torch 增量已耗尽 total_memory × u，无可用 KV 显存。",
      remediation: "增加卡数、降低 max_num_batched_tokens 或采用权重量化。",
      sources: ["wiki:kv-cache-memory-profiling"],
    });
  } else if (oomStatus === "insufficient_for_single_max_len_seq") {
    blockers.push({
      id: "calc-oom-stage6-single-seq",
      severity: "error",
      title: "第 6 级 KV 池不足以容纳 1 条 max_model_len 请求",
      message: "扣除 1 个 null block 后剩余 KV 块数不足 1 条满长上下文，vLLM 准入校验将直接报错退出。",
      remediation: "调小 --max-model-len、开启 C8 KV 量化或增加卡数。",
      sources: ["wiki:kv-cache-memory-profiling"],
    });
  } else if (oomStatus === "tight_budget_oom_risk") {
    warnings.push({
      id: "calc-tight-kv-budget",
      severity: "warn",
      title: "显存预算偏紧：上界开销存在 OOM 风险",
      message: "按点估计可切出 KV 块，但若实机激活/非 Torch 落到区间上界可能触发 OOM。",
      remediation: "建议用 Mode B 启动日志实测复核或预留更多卡数。",
      sources: ["wiki:kv-cache-memory-profiling"],
    });
  }

  if (headroomStatus === "overflow") {
    blockers.push({
      id: "calc-stage7-headroom-overflow",
      severity: "error",
      title: "第 7 级 ACLGraph + 150 MiB 裕度超出预算外 1−u 余量",
      message: "切完 KV 后录图阶段（capture_model）下界需求已超过 M_total × (1 − u)，大概率录图 OOM。",
      remediation:
        "降低 gpu_memory_utilization（如 0.88/0.85）、减少 cudagraph 录制档数或启用 --enforce-eager。",
      sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/worker.py#L907-L949`],
    });
  } else if (headroomStatus === "risk") {
    warnings.push({
      id: "calc-stage7-headroom-risk",
      severity: "warn",
      title: "第 7 级 ACLGraph 上界接近或超出预算外 1−u 余量",
      message: "若同卡有少量启动前占用或录图偏大，可能击穿 1−u 预算外余量。",
      remediation: "可将 gpu_memory_utilization 降至 0.90，或通过 Mode B 核对实际 NPU graph memory。",
      sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/worker.py#L907-L949`],
    });
  }

  return { blockers, silentRewrites, warnings };
}

function buildRecommendation(params: {
  spec: ModelSpec;
  card: AscendCalcCardSpec;
  isMoe: boolean;
  minCards: { minCards: number; recommendedTp: number; recommendedPp: number; recommendedEnableEp: boolean };
  weightPrecision: WeightPrecision;
  kvCacheDtype: KvCacheDtype;
  tpSize: number;
  ppSize: number;
  dpSize: number;
  worldSize: number;
  enforceEager: boolean;
  cudagraphMode: CudaGraphMode;
}): FourQuestionsReport["q4Recommendation"] {
  const { spec, card, isMoe, minCards, weightPrecision, kvCacheDtype, tpSize, ppSize, dpSize, worldSize } =
    params;
  const recPrec: WeightPrecision =
    card.family === "310P"
      ? weightPrecision === "fp16" || weightPrecision === "w8a8sc_310p"
        ? weightPrecision
        : "w8a8sc_310p"
      : card.family === "A5" && weightPrecision === "fp8_block"
        ? "fp8_block"
        : isMoe && (weightPrecision === "bf16" || weightPrecision === "fp8_block") && minCards.minCards >= 4
          ? "w8a8_dynamic"
          : weightPrecision === "fp8_block"
            ? "bf16"
            : weightPrecision;

  const recUtil = card.family === "310P" ? 0.85 : isMoe ? 0.9 : 0.92;
  const flags = [
    `vllm serve ${spec.name}`,
    `-tp ${minCards.recommendedTp}`,
    minCards.recommendedPp > 1 ? `-pp ${minCards.recommendedPp}` : "",
    minCards.recommendedEnableEp ? "--enable-expert-parallel" : "",
    card.family === "310P" ? "--dtype float16" : "",
    recPrec === "w8a8_dynamic" || recPrec === "w8a8" || recPrec === "w4a8" || recPrec === "w8a8sc_310p"
      ? "--quantization ascend"
      : "",
    `--gpu-memory-utilization ${recUtil.toFixed(2)}`,
  ].filter(Boolean);

  const physCards = Math.ceil(minCards.minCards / card.diesPerPhysicalCard);
  const rationale =
    `在 ${card.shortName} 上建议起步 ${minCards.minCards} 逻辑设备（${physCards} 张物理卡，TP=${minCards.recommendedTp}` +
    `${minCards.recommendedPp > 1 ? `, PP=${minCards.recommendedPp}` : ""}` +
    `${minCards.recommendedEnableEp ? ", 开启 EP" : ""}），精度优先 ${recPrec}，预算比例 ${recUtil.toFixed(2)}。`;

  return {
    recommendedTp: minCards.recommendedTp,
    recommendedPp: minCards.recommendedPp,
    recommendedDp: 1,
    recommendedEnableEp: minCards.recommendedEnableEp,
    recommendedPrecision: recPrec,
    recommendedGpuMemoryUtilization: recUtil,
    cliHint: flags.join(" "),
    rationale,
    relatedWikiIds: buildRelatedWikiIds({
      card,
      isMoe,
      weightPrecision,
      kvCacheDtype,
      tpSize,
      ppSize,
      dpSize,
      worldSize,
      enforceEager: params.enforceEager,
      cudagraphMode: params.cudagraphMode,
    }),
  };
}

function resolveSpecOrThrow(model: DeployPlanInput["model"]): ModelSpec {
  if (isModelSpec(model)) return model;
  const gate = evaluateWave3ModelGate(model);
  if (!gate.ok) throw new Error(gate.error);
  if (!gate.supportedInWave3) throw new Error(gate.reason);
  return gate.spec;
}

export function evaluateDeployPlan(input: DeployPlanInput): DeployPlanReport {
  const version: RuleVersion = input.version ?? DEFAULT_RULE_VERSION;
  const spec = resolveSpecOrThrow(input.model);
  const card = getAscendCalcCard(input.cardId);
  const moe = getMoeInfo(spec);
  const firstAttn = spec.layers[0]!.attention;

  const weightPrecision: WeightPrecision = input.weightPrecision ?? "bf16";
  const kvCacheDtype: KvCacheDtype = input.kvCacheDtype ?? "auto";
  const requestedBlockSize = Math.max(16, Math.round(input.blockSize ?? DEFAULT_BLOCK_SIZE));
  const userSpecifiedBlockSize = input.userSpecifiedBlockSize ?? false;
  const effectiveBlockSize =
    kvCacheDtype === "mxfp8" && requestedBlockSize % 512 !== 0 && !userSpecifiedBlockSize
      ? 512
      : requestedBlockSize;
  const weightNzMode: 0 | 1 | 2 = input.weightNzMode ?? 1;

  const tpSize = Math.max(1, Math.round(input.tpSize ?? 1));
  const ppSize = Math.max(1, Math.round(input.ppSize ?? 1));
  const dpSize = Math.max(1, Math.round(input.dpSize ?? 1));
  const pcpSize = Math.max(1, Math.round(input.pcpSize ?? 1));
  const dcpSize = Math.max(1, Math.round(input.dcpSize ?? 1));
  const enableEp = Boolean(input.enableEp && moe.isMoe);
  const epWorldSize = enableEp ? dpSize * tpSize * pcpSize : 1;
  const worldSize = tpSize * ppSize * dpSize * pcpSize;

  const gpuMemoryUtilization = Math.min(
    0.99,
    Math.max(0.1, input.gpuMemoryUtilization ?? DEFAULT_GPU_MEMORY_UTILIZATION),
  );
  const maxModelLen = Math.max(
    effectiveBlockSize,
    Math.round(input.maxModelLen ?? Math.min(spec.maxPosition, 32768)),
  );
  const maxNumBatchedTokens = Math.max(
    1,
    Math.round(input.maxNumBatchedTokens ?? DEFAULT_MAX_NUM_BATCHED_TOKENS),
  );
  const maxNumSeqs = Math.max(1, Math.round(input.maxNumSeqs ?? DEFAULT_MAX_NUM_SEQS));
  const enforceEager = Boolean(input.enforceEager ?? false);
  const cudagraphMode: CudaGraphMode = enforceEager
    ? "NONE"
    : (input.cudagraphMode ?? (card.family === "310P" ? "NONE" : "PIECEWISE"));
  const defaultCgCount =
    cudagraphMode === "NONE"
      ? 0
      : cudagraphMode === "FULL_DECODE_ONLY"
        ? 7
        : cudagraphMode === "PIECEWISE"
          ? 16
          : 24;
  const cudagraphCaptureCount =
    cudagraphMode === "NONE" ? 0 : Math.max(0, Math.round(input.cudagraphCaptureCount ?? defaultCgCount));

  const decodeBatchSize = Math.max(1, Math.round(input.decodeBatchSize ?? 16));
  const prefillTokens = Math.max(1, Math.round(input.prefillTokens ?? 512));
  const decodeContextLen = Math.max(1, Math.round(input.decodeContextLen ?? Math.min(maxModelLen, 4096)));

  const localKvHeadsPerRank = firstAttn.numKvHeads >= tpSize ? Math.ceil(firstAttn.numKvHeads / tpSize) : 1;
  const localLayersPerRank = Math.ceil(spec.numLayers / ppSize);
  const kvElemBytes = kvCacheDtype === "auto" ? 2 : kvCacheDtype === "int8" ? 1 : 33 / 32;

  // Stage 1 & 2
  const totalHbmBytes = card.hbmGiB * GIB;
  const requestedBytes = Math.floor(totalHbmBytes * gpuMemoryUtilization);
  const unbudgetedHeadroomBytes = totalHbmBytes - requestedBytes;

  // Stage 3: Weights per rank
  const w = computeWeightsPerRank({
    spec,
    card,
    version,
    weightPrecision,
    weightNzMode,
    tpSize,
    ppSize,
    epWorldSize,
    enableEp,
    localKvHeads: localKvHeadsPerRank,
  });

  // Stage 4: profile_run torch peak
  const act = computeProfileRunTorchPeak({
    spec,
    card,
    version,
    weightPrecision,
    tpSize,
    ppSize,
    dpSize,
    pcpSize,
    enableEp,
    maxNumBatchedTokens,
    maxNumSeqs,
  });

  // Stage 5: non_torch_increase via hcclAccounting single source of truth
  const hcclEstimate = estimateHcclDomainMemory(
    {
      hardwareFamily: card.family,
      tpSize,
      ppSize,
      dpSize,
      pcpSize,
      dcpSize,
      isMoe: moe.isMoe,
      enableExpertParallel: enableEp,
      ...(input.enableEplb !== undefined ? { enableEplb: input.enableEplb } : {}),
      ...(input.dynamicEplb !== undefined ? { dynamicEplb: input.dynamicEplb } : {}),
    },
    version,
  );
  const nonTorch = computeNonTorchIncrease({
    card,
    hccl: hcclEstimate,
    isMoe: moe.isMoe,
    enableEp,
    worldSize,
  });

  // Stage 6: KV cache pool
  const rawKvLow = requestedBytes - (w.highBytes + act.highBytes + nonTorch.highBytes);
  const rawKvPoint = requestedBytes - (w.pointBytes + act.pointBytes + nonTorch.pointBytes);
  const rawKvHigh = requestedBytes - (w.lowBytes + act.lowBytes + nonTorch.lowBytes);

  const scaleKv = (v: number): number =>
    v <= 0 ? 0 : card.halvesKvForWorkspace ? Math.floor(v / 2) : Math.floor(v);
  const kvPoolLowBytes = scaleKv(rawKvLow);
  const kvPoolPointBytes = scaleKv(rawKvPoint);
  const kvPoolHighBytes = scaleKv(rawKvHigh);

  const kvBytesPerTokenPerRank = Math.round(
    localLayersPerRank * 2 * localKvHeadsPerRank * firstAttn.headDim * kvElemBytes,
  );
  const kvBytesPerBlock = kvBytesPerTokenPerRank * effectiveBlockSize;

  const rawBlocksLow = kvBytesPerBlock > 0 ? Math.floor(kvPoolLowBytes / kvBytesPerBlock) : 0;
  const rawBlocksPoint = kvBytesPerBlock > 0 ? Math.floor(kvPoolPointBytes / kvBytesPerBlock) : 0;
  const rawBlocksHigh = kvBytesPerBlock > 0 ? Math.floor(kvPoolHighBytes / kvBytesPerBlock) : 0;
  const usableBlocksLow = Math.max(0, rawBlocksLow - 1);
  const usableBlocksPoint = Math.max(0, rawBlocksPoint - 1);
  const usableBlocksHigh = Math.max(0, rawBlocksHigh - 1);

  const totalKvTokenSlotsLow = usableBlocksLow * effectiveBlockSize;
  const totalKvTokenSlotsPoint = usableBlocksPoint * effectiveBlockSize;
  const totalKvTokenSlotsHigh = usableBlocksHigh * effectiveBlockSize;
  const blocksPerMaxSeq = Math.ceil(maxModelLen / effectiveBlockSize);
  const maxConcLow = blocksPerMaxSeq > 0 ? usableBlocksLow / blocksPerMaxSeq : 0;
  const maxConcPoint = blocksPerMaxSeq > 0 ? usableBlocksPoint / blocksPerMaxSeq : 0;
  const maxConcHigh = blocksPerMaxSeq > 0 ? usableBlocksHigh / blocksPerMaxSeq : 0;

  let oomStatus: KvOomStatus = "fits";
  if (w.lowBytes >= requestedBytes) {
    oomStatus = "weights_exceed_budget";
  } else if (w.pointBytes + act.pointBytes >= requestedBytes) {
    oomStatus = "weights_plus_activation_exceed_budget";
  } else if (rawKvPoint <= 0) {
    oomStatus = "non_kv_exceeds_budget";
  } else if (usableBlocksPoint < blocksPerMaxSeq) {
    oomStatus = "insufficient_for_single_max_len_seq";
  } else if (rawKvLow <= 0 || usableBlocksLow < blocksPerMaxSeq) {
    oomStatus = "tight_budget_oom_risk";
  }

  // Stage 7: Post-KV ACLGraph & 150 MiB safety redundancy paid from 1 - u headroom
  const acl = computeAclGraphRange({
    spec,
    card,
    cudagraphMode,
    cudagraphCaptureCount,
    enforceEager,
    isMoe: moe.isMoe,
  });
  const redundancyBufferBytes = HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB * MIB;
  const stage7Low = acl.lowBytes + redundancyBufferBytes;
  const stage7Point = acl.pointBytes + redundancyBufferBytes;
  const stage7High = acl.highBytes + redundancyBufferBytes;

  const headroomStatus: HeadroomStatus =
    stage7Low > unbudgetedHeadroomBytes ? "overflow" : stage7High > unbudgetedHeadroomBytes ? "risk" : "safe";

  const v030Worker = `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/worker.py`;
  const v030Worker310p = `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/_310p/worker_310p.py`;

  const stages: DeployPlanReport["stages"] = [
    {
      stageIndex: 1,
      id: "total_hbm",
      title: "第 1 级 · 单逻辑 NPU 总显存（init_snapshot）",
      lowBytes: totalHbmBytes,
      highBytes: totalHbmBytes,
      pointEstimateBytes: totalHbmBytes,
      formula: `${card.hbmGiB} GiB × 1024³ B`,
      evidenceLevel: "C",
      sources: [`${v030Worker}#L460-L463`, ...card.sources],
      notes: [
        card.specNote,
        "运行时 torch.npu.mem_get_info() 返回扣除系统/驱动预留后的设备可见总量，并区分标称十进制 GB 与二进制 GiB。",
      ],
    },
    {
      stageIndex: 2,
      id: "budget_split",
      title: "第 2 级 · 实例预算与预算外 1−u 余量切分",
      lowBytes: requestedBytes,
      highBytes: requestedBytes,
      pointEstimateBytes: requestedBytes,
      formula: `预算 = ${card.hbmGiB} GiB × ${gpuMemoryUtilization.toFixed(2)} = ${(requestedBytes / GIB).toFixed(2)} GiB；预算外 1−u = ${(unbudgetedHeadroomBytes / GIB).toFixed(2)} GiB`,
      evidenceLevel: "C",
      sources: [
        `${v030Worker}#L461-L473`,
        `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/cache.py#L103-L126`,
      ],
      notes: [
        `v0.30.0 CacheConfig 默认 gpu_memory_utilization=0.92；启动前若 init_snapshot.free_memory < requested_memory 会当场抛 ValueError。`,
        `预算外 ${(unbudgetedHeadroomBytes / GIB).toFixed(2)} GiB 专门承接快照前已有占用、第 7 级 ACLGraph 录图与运行期延迟缓冲。`,
      ],
    },
    {
      stageIndex: 3,
      id: "weights_per_rank",
      title: "第 3 级 · 单卡常驻模型权重（load_model）",
      lowBytes: w.lowBytes,
      highBytes: w.highBytes,
      pointEstimateBytes: w.pointBytes,
      formula: w.formula,
      evidenceLevel: w.nzApplied ? "I" : "D",
      sources: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/model_runner_v1.py#L4372-L4478`,
        "wiki:hf-model-anatomy",
        "wiki:quantization",
      ],
      notes: w.notes,
    },
    {
      stageIndex: 4,
      id: "profile_run_torch_peak",
      title: "第 4 级 · 试跑激活与算子工作区峰值（profile_run torch_peak_increase）",
      lowBytes: act.lowBytes,
      highBytes: act.highBytes,
      pointEstimateBytes: act.pointBytes,
      formula: act.formula,
      evidenceLevel: "I",
      sources: [`${v030Worker}#L601-L623`, "wiki:kv-cache-memory-profiling"],
      notes: act.notes,
    },
    {
      stageIndex: 5,
      id: "non_torch_increase",
      title: "第 5 级 · 非 Torch 增量（含已具象化 HCCL 缓冲与 CANN 上下文）",
      lowBytes: nonTorch.lowBytes,
      highBytes: nonTorch.highBytes,
      pointEstimateBytes: nonTorch.pointBytes,
      formula: nonTorch.formula,
      evidenceLevel: "I",
      sources: [...hcclEstimate.profileRunOverlap.anchors],
      notes: nonTorch.notes,
    },
    {
      stageIndex: 6,
      id: "kv_cache_pool",
      title: "第 6 级 · 可用 KV Cache 块池与物理分页切分",
      lowBytes: kvPoolLowBytes,
      highBytes: kvPoolHighBytes,
      pointEstimateBytes: kvPoolPointBytes,
      formula:
        `[预算 − (第3+4+5级)]${card.halvesKvForWorkspace ? " ÷ 2 (310P)" : ""} ÷ ${(kvBytesPerBlock / MIB).toFixed(3)} MiB/块` +
        `（${(kvBytesPerTokenPerRank / KIB).toFixed(1)} KiB/tok × ${effectiveBlockSize} tok/块，扣 1 null block）`,
      evidenceLevel: "D",
      sources: [
        `${v030Worker}#L634-L666`,
        ...(card.halvesKvForWorkspace ? [`${v030Worker310p}#L140-L153`] : []),
        `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/v1/core/kv_cache_utils.py#L2386-L2403`,
      ],
      notes: [
        `每卡 ${localLayersPerRank} 层 × ${localKvHeadsPerRank} 本地 KV 头 × head_dim=${firstAttn.headDim} × ${kvElemBytes} B = ${(kvBytesPerTokenPerRank / KIB).toFixed(1)} KiB/tok；${effectiveBlockSize}-tok 块 = ${(kvBytesPerBlock / MIB).toFixed(3)} MiB。`,
        `可用块数区间 [${usableBlocksLow}, ${usableBlocksHigh}]（点估 ${usableBlocksPoint} 块，已扣 1 个 BlockPool null block），对应 ${maxModelLen} 上下文并发 [${maxConcLow.toFixed(2)}x, ${maxConcHigh.toFixed(2)}x]。`,
        ...(card.halvesKvForWorkspace
          ? ["Atlas 300I DUO (310P) 源码 worker_310p.py 将剩余预算 // 2 留作算子工作区。"]
          : []),
      ],
    },
    {
      stageIndex: 7,
      id: "post_kv_aclgraph_and_headroom",
      title: "第 7 级 · 切完 KV 后的 ACLGraph 录图与 150 MiB 裕度（预算外 1−u 支付）",
      lowBytes: stage7Low,
      highBytes: stage7High,
      pointEstimateBytes: stage7Point,
      formula:
        `ACLGraph [${(acl.lowBytes / GIB).toFixed(2)}, ${(acl.highBytes / GIB).toFixed(2)}] GiB + 150 MiB 裕度` +
        ` vs 预算外 1−u = ${(unbudgetedHeadroomBytes / GIB).toFixed(2)} GiB`,
      evidenceLevel: "I",
      sources: [`${v030Worker}#L879-L950`, "wiki:kv-cache-memory-profiling"],
      notes: acl.notes,
    },
  ];

  const roofline = computeRoofline({
    spec,
    card,
    weightInfo: w,
    weightPrecision,
    kvElemBytes,
    kvBytesPerTokenPerRank,
    tpSize,
    dpSize,
    epWorldSize,
    enableEp,
    prefillTokens,
    decodeBatchSize,
    decodeContextLen,
  });

  const q1 = collectQ1Findings({
    spec,
    card,
    version,
    weightPrecision,
    kvCacheDtype,
    requestedBlockSize,
    effectiveBlockSize,
    userSpecifiedBlockSize,
    weightNzMode,
    tpSize,
    ppSize,
    dpSize,
    epWorldSize,
    enableEp,
    gpuMemoryUtilization,
    cudagraphMode,
    enforceEager,
    oomStatus,
    headroomStatus,
  });

  const q1Verdict: "pass" | "warn" | "blocked" =
    q1.blockers.length > 0
      ? "blocked"
      : q1.warnings.length > 0 || q1.silentRewrites.length > 0
        ? "warn"
        : "pass";

  const minCards = recommendMinCards({
    spec,
    card,
    version,
    weightPrecision: card.family === "310P" && weightPrecision === "bf16" ? "fp16" : weightPrecision,
    weightNzMode,
    kvElemBytes,
    effectiveBlockSize,
    gpuMemoryUtilization,
    maxModelLen,
    maxNumBatchedTokens,
    maxNumSeqs,
    isMoe: moe.isMoe,
  });

  const primaryBottleneck: "memory-bound" | "compute-bound" | "kv-bandwidth-bound" =
    roofline.decodeKvTrafficBytesPerStep > roofline.activeWeightBytesPerRank
      ? "kv-bandwidth-bound"
      : roofline.decodeLinearRegime === "memory-bound"
        ? "memory-bound"
        : "compute-bound";

  const q4 = buildRecommendation({
    spec,
    card,
    isMoe: moe.isMoe,
    minCards,
    weightPrecision,
    kvCacheDtype,
    tpSize,
    ppSize,
    dpSize,
    worldSize,
    enforceEager,
    cudagraphMode,
  });

  const fourQuestions: FourQuestionsReport = {
    q1Fit: {
      verdict: q1Verdict,
      blockers: q1.blockers,
      silentRewrites: q1.silentRewrites,
      warnings: q1.warnings,
      summary:
        q1Verdict === "blocked"
          ? `存在 ${q1.blockers.length} 项硬阻塞问题（${q1.blockers[0]?.title}），当前配置无法直接启动。`
          : q1Verdict === "warn"
            ? `架构与精度可运行，但存在 ${q1.silentRewrites.length} 项静默改写与 ${q1.warnings.length} 项风险提示。`
            : `${spec.name} 与 ${card.shortName}（${w.effectiveWeightPrecision} / KV ${kvCacheDtype}）兼容通过，无阻塞项。`,
    },
    q2Capacity: {
      minCardsRecommended: minCards.minCards,
      minPhysicalCardsRecommended: Math.ceil(minCards.minCards / card.diesPerPhysicalCard),
      currentTotalCards: worldSize,
      currentPhysicalCards: Math.ceil(worldSize / card.diesPerPhysicalCard),
      oomStatus,
      kvPoolLowBytes,
      kvPoolPointBytes,
      kvPoolHighBytes,
      kvBytesPerTokenPerRank,
      kvBytesPerBlock,
      effectiveBlockSize,
      rawBlocksRange: [rawBlocksLow, rawBlocksHigh],
      usableBlocksRange: [usableBlocksLow, usableBlocksHigh],
      usableBlocksPoint,
      totalKvTokenSlotsRange: [totalKvTokenSlotsLow, totalKvTokenSlotsHigh],
      totalKvTokenSlotsPoint,
      blocksPerMaxSeq,
      maxConcurrencyRange: [maxConcLow, maxConcHigh],
      maxConcurrencyPoint: maxConcPoint,
      summary:
        oomStatus === "fits"
          ? `单卡可用 KV 池 [${(kvPoolLowBytes / GIB).toFixed(2)}, ${(kvPoolHighBytes / GIB).toFixed(2)}] GiB（点估 ${(kvPoolPointBytes / GIB).toFixed(2)} GiB），约 [${usableBlocksLow}, ${usableBlocksHigh}] 可用块，${maxModelLen} 上下文并发 [${maxConcLow.toFixed(1)}x, ${maxConcHigh.toFixed(1)}x]。`
          : `当前拓扑（${worldSize} 逻辑卡）容量状态：${oomStatus}；建议至少 ${minCards.minCards} 逻辑设备（${Math.ceil(minCards.minCards / card.diesPerPhysicalCard)} 物理卡）。`,
    },
    q3Roofline: {
      primaryBottleneck,
      roofline,
      summary:
        `硬件脊点 ${roofline.ridgePointFlopsPerByte.toFixed(1)} FLOP/B；Prefill(${prefillTokens}) 强度 ${roofline.prefillIntensityFlopsPerByte.toFixed(1)} FLOP/B（${roofline.prefillRegime}），` +
        `Decode(B=${decodeBatchSize}, M_eff=${roofline.decodeLinearMEff.toFixed(2)}) 线性层 ${roofline.decodeLinearIntensityFlopsPerByte.toFixed(1)} FLOP/B、GQA KV 注意力恒定 ${roofline.decodeKvAttnIntensityFlopsPerByte.toFixed(1)} FLOP/B。`,
    },
    q4Recommendation: q4,
  };

  return {
    version,
    spec,
    card,
    isMoe: moe.isMoe,
    inputSummary: {
      weightPrecision,
      effectiveWeightPrecision: w.effectiveWeightPrecision,
      kvCacheDtype,
      requestedBlockSize,
      effectiveBlockSize,
      weightNzMode,
      tpSize,
      ppSize,
      dpSize,
      pcpSize,
      dcpSize,
      enableEp,
      epWorldSize,
      localKvHeadsPerRank,
      localLayersPerRank,
      gpuMemoryUtilization,
      maxModelLen,
      maxNumBatchedTokens,
      maxNumSeqs,
      cudagraphMode,
      cudagraphCaptureCount: acl.effectiveCount,
      enforceEager,
    },
    totalHbmBytes,
    requestedBytes,
    unbudgetedHeadroomBytes,
    stages,
    hcclEstimate,
    workspaceHcclOverlap: {
      ...hcclEstimate.profileRunOverlap,
      explanation:
        `已具象化 HCCL 通信域（${hcclEstimate.totalMaterializedMiB} MiB）及共享算子工作区均重叠落在 profile_run() 的 non_torch_increase / non_kv_cache_memory 内，` +
        `Mode B 日志对账绝不可二次扣减 HCCL；worker.py 仅在建议值中额外留出 ${HCCL_PROFILE_RUN_UNDERESTIMATION_BUFFER_MIB} MiB 安全裕度。`,
      redundancyBufferBytes,
    },
    headroomStatus,
    aclGraphRangeBytes: [acl.lowBytes, acl.highBytes],
    aclGraphPointBytes: acl.pointBytes,
    redundancyBufferBytes,
    roofline,
    fourQuestions,
  };
}
