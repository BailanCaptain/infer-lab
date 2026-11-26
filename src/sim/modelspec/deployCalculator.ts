/**
 * Tool ① 核心算账引擎：「立项四问」双模部署算账台（Mode A 静态 7 级区间估算 + Roofline）。
 * 纯 TypeScript 零框架依赖；HCCL 通信域与量化规则直接复用 `src/sim/rules/` 单真源。
 */

import { evaluateDomain3Rules } from "../rules/domain3Quantization";
import { evaluateCpTopologyRules } from "../rules/domain4CpPd";
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
import { analyzeParams, indexerBytesPerTokenLayer, linearStateBytesPerSeqLayer } from "./analyze";
import { parseHfConfig } from "./parseHfConfig";
import { getPresetSpec, MODEL_PRESETS } from "./presets";
import { type AttentionSpec, attnQDim, type LayerSpec, type MlpSpec, type ModelSpec } from "./types";

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
export type Wave4Feature = "MLA" | "CSA2" | "KDA" | "Engram";
/** Backward-compatible alias (Wave 4 features are now unlocked in Tool ①). */
export type Wave4BlockedFeature = Wave4Feature;
export type Wave4TargetWikiId =
  | "mla"
  | "sparse-attention"
  | "linear-attention"
  | "kv-cache-spec"
  | "engram-conditional-memory"
  | "ascend-model-onboarding";

export interface Wave4ArchitectureSummary {
  activeFeatures: readonly Wave4Feature[];
  hasMla: boolean;
  hasCsa2: boolean;
  hasKda: boolean;
  hasEngram: boolean;
  mla?: {
    kvLoraRank: number;
    qkRopeHeadDim: number;
    qLoraRank: number | null;
    qkNopeHeadDim: number;
    vHeadDim: number;
    latentBytesPerTokenPerLayer: number;
    equivalentMhaBytesPerTokenPerLayer: number;
    compressionRatio: number;
    replicatedAcrossTp: boolean;
    dcpSize: number;
  };
  csa2?: {
    indexTopk: number;
    indexHeadDim: number;
    indexNumHeads: number;
    indexerKvElemBytes: number;
    indexerBytesPerTokenPerLayer: number;
    effectiveDecodeContextLen: number;
    decodeBandwidthSavingsRatio: number;
  };
  kda?: {
    linearLayerCount: number;
    fullAttnLayerCount: number;
    localLinearLayerCount: number;
    localFullAttnLayerCount: number;
    recurrentStateBytesPerLayerPerSeq: number;
    convStateBytesPerLayerPerSeq: number;
    perSeqFixedLinearStateBytes: number;
    totalFixedLinearStateBytes: number;
    perTokenPagedKvBytes: number;
  };
  engram?: {
    vocabSize: number;
    hiddenSize: number;
    layerCount: number;
    cpuOffload: boolean;
    dpSharedMemory: boolean;
    etpSize: number;
    npuWeightBytesPerRank: number;
    hostDramBytesPerNode: number;
  };
}

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
    name: "Ascend 950DT (A5 · 白皮书 144 GB 高配模拟档)",
    shortName: "Ascend 950DT 144G",
    family: "A5",
    hbmGiB: 144,
    diesPerPhysicalCard: 1,
    physicalCardHbmGiB: 144,
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
      "Cube BF16 峰值 486 TFLOPS、带宽 4.0 TB/s（脊点 121.5 FLOP/B）；《昇腾 950 NPU 架构白皮书》表 3-1 标称 950DT 高速内存 144 / 96 GB（4 栈，区别于 950PR 128 / 112 GB），此处按 144 GiB 容量作架构推演假设（若按十进制 GB 折算约为 134.11 GiB，实机以 OS 可见为准）",
    sources: ["wiki:ascend-950-architecture", "wiki:roofline-and-metrics"],
  },
];

export function getAscendCalcCard(cardId: AscendCalcCardId): AscendCalcCardSpec {
  const card = ASCEND_CALC_CARDS.find((c) => c.id === cardId);
  if (!card) throw new Error(`未知昇腾卡型：${cardId}`);
  return card;
}

/** 单物理节点最大逻辑 NPU Rank 数（Atlas 800I A3 为 8 卡 × 2 Die = 16，其余机型均为 8）。 */
export function getCardMaxRanksPerNode(cardId: AscendCalcCardId): number {
  return cardId === "a3-die64g" ? 16 : 8;
}

export type Wave3ModelGateResult =
  | {
      ok: true;
      supportedInWave3: true;
      spec: ModelSpec;
      sourceKind: "preset" | "custom-json";
      presetId?: string;
      wave4Features?: readonly Wave4Feature[];
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
  dpLocalSize?: number;
  pcpSize?: number;
  dcpSize?: number;
  enableEp?: boolean;
  enableEplb?: boolean;
  dynamicEplb?: boolean;
  engramCpuOffload?: boolean;
  useV2ModelRunner?: boolean;
  /** Alias of `useV2ModelRunner` for CLI/UI callers. */
  enableModelRunnerV2?: boolean;
  numSpecTokens?: number;
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
  prefillPrecisionLabel: string;
  prefillPeakComputeTflops: number;
  prefillRidgePointFlopsPerByte: number;
  prefillAchievedTflops: number;
  decodePeakComputeTflops: number;
  decodeRidgePointFlopsPerByte: number;
  decodeLinearAchievedTflops: number;
  decodeKvAttnAchievedTflops: number;
  maxPeakComputeTflops: number;
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
  attentionModeLabel: string;
  decodeKvAttnIntensityFlopsPerByte: number;
  decodeKvAttnRegime: "compute-bound" | "memory-bound";
  decodeContextLen: number;
  effectiveDecodeContextLen: number;
  decodeKvTrafficBytesPerStep: number;
  activeWeightBytesPerRank: number;
  evidenceLevel: CalcEvidenceLevel;
  notes: readonly string[];
}

export interface PpStageCapacitySlice {
  stageIndex: number;
  isBottleneck: boolean;
  wLowBytes: number;
  wPointBytes: number;
  wHighBytes: number;
  kvPoolLowBytes: number;
  kvPoolPointBytes: number;
  kvPoolHighBytes: number;
  fixedLinearStateBytes: number;
  kvBytesPerBlock: number;
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
    feasible: boolean;
    unsolvable: boolean;
    minCardsRecommended: number | null;
    minPhysicalCardsRecommended: number | null;
    currentTotalCards: number;
    currentPhysicalCards: number;
    oomStatus: KvOomStatus;
    kvPoolLowBytes: number;
    kvPoolPointBytes: number;
    kvPoolHighBytes: number;
    kvBytesPerTokenPerRank: number;
    perTokenPagedKvBytes: number;
    perSeqFixedLinearStateBytes: number;
    totalFixedLinearStateBytes: number;
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
    ppStageSlices?: readonly PpStageCapacitySlice[];
    summary: string;
  };
  q3Roofline: {
    primaryBottleneck: "memory-bound" | "compute-bound" | "kv-bandwidth-bound";
    effectivePeakComputeTflops: number;
    effectiveRidgePointFlopsPerByte: number;
    roofline: RooflineAnalysis;
    summary: string;
  };
  q4Recommendation: {
    feasible: boolean;
    unsolvable: boolean;
    recommendedTp: number | null;
    recommendedPp: number | null;
    recommendedDp: number | null;
    recommendedPcp?: number | null;
    recommendedDcp?: number | null;
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
  wave4Arch: Wave4ArchitectureSummary;
  inputSummary: {
    weightPrecision: WeightPrecision;
    effectiveWeightPrecision: string;
    kvCacheDtype: KvCacheDtype;
    requestedBlockSize: number;
    effectiveBlockSize: number;
    userSpecifiedBlockSize?: boolean;
    requestedEnableEp?: boolean;
    weightNzMode: 0 | 1 | 2;
    tpSize: number;
    ppSize: number;
    dpSize: number;
    dpLocalSize?: number | undefined;
    pcpSize: number;
    dcpSize: number;
    enableEp: boolean;
    epWorldSize: number;
    localKvHeadsPerRank: number;
    localLayersPerRank: number;
    numSpecTokens: number;
    gpuMemoryUtilization: number;
    maxModelLen: number;
    maxNumBatchedTokens: number;
    maxNumSeqs: number;
    cudagraphMode: CudaGraphMode;
    cudagraphCaptureCount: number;
    enforceEager: boolean;
    useV2ModelRunner?: boolean;
    userSpecifiedUseV2ModelRunner?: boolean;
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

// ─── Wave 4 模型准入与特征识别（MLA / CSA2 / KDA / Engram 全解锁）────────────

export interface Wave4DemoPreset {
  id: "deepseek-v3-mla" | "hybrid-kda-gqa" | "csa2-sparse-mla" | "engram-conditional";
  label: string;
  shortLabel: string;
  features: readonly Wave4Feature[];
  recommendedTp: number;
  recommendedPp: number;
  recommendedDp: number;
  recommendedEnableEp: boolean;
  recommendedPrecision: WeightPrecision;
  config: Record<string, unknown>;
}

export const WAVE4_DEMO_PRESETS: readonly Wave4DemoPreset[] = [
  {
    id: "deepseek-v3-mla",
    label: "DeepSeek-V3 MLA 预设样例",
    shortLabel: "DeepSeek-V3 MLA",
    features: ["MLA"],
    recommendedTp: 8,
    recommendedPp: 2,
    recommendedDp: 1,
    recommendedEnableEp: true,
    recommendedPrecision: "w8a8_dynamic",
    config: {
      model_type: "deepseek_v3",
      architectures: ["DeepseekV3ForCausalLM"],
      hidden_size: 7168,
      num_hidden_layers: 61,
      num_attention_heads: 128,
      num_key_value_heads: 128,
      kv_lora_rank: 512,
      q_lora_rank: 1536,
      qk_nope_head_dim: 128,
      qk_rope_head_dim: 64,
      v_head_dim: 128,
      intermediate_size: 18432,
      moe_intermediate_size: 2048,
      n_routed_experts: 256,
      num_experts_per_tok: 8,
      n_shared_experts: 1,
      first_k_dense_replace: 3,
      vocab_size: 129280,
      max_position_embeddings: 163840,
      torch_dtype: "bfloat16",
    },
  },
  {
    id: "hybrid-kda-gqa",
    label: "混合 KDA + GQA 预设样例",
    shortLabel: "混合 KDA + GQA (3:1)",
    features: ["KDA"],
    recommendedTp: 2,
    recommendedPp: 1,
    recommendedDp: 1,
    recommendedEnableEp: false,
    recommendedPrecision: "bf16",
    config: {
      model_type: "kimi_linear",
      architectures: ["KimiLinearForCausalLM"],
      hidden_size: 4096,
      num_hidden_layers: 32,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      head_dim: 128,
      intermediate_size: 14336,
      linear_kda: true,
      linear_num_key_heads: 32,
      linear_num_value_heads: 32,
      linear_key_head_dim: 128,
      linear_value_head_dim: 128,
      linear_conv_kernel_dim: 4,
      layer_types: ["linear_kda", "linear_kda", "linear_kda", "full_attention"],
      vocab_size: 151936,
      max_position_embeddings: 131072,
      torch_dtype: "bfloat16",
    },
  },
  {
    id: "csa2-sparse-mla",
    label: "CSA2 稀疏索引样例",
    shortLabel: "CSA2 / DSA 稀疏索引",
    features: ["CSA2", "MLA"],
    recommendedTp: 8,
    recommendedPp: 2,
    recommendedDp: 1,
    recommendedEnableEp: true,
    recommendedPrecision: "w8a8_dynamic",
    config: {
      model_type: "deepseek_v4",
      architectures: ["DeepseekV4ForCausalLM"],
      hidden_size: 7168,
      num_hidden_layers: 61,
      num_attention_heads: 128,
      kv_lora_rank: 512,
      q_lora_rank: 1536,
      qk_nope_head_dim: 128,
      qk_rope_head_dim: 64,
      v_head_dim: 128,
      uses_sfa_sparse: true,
      index_topk: 2048,
      index_head_dim: 128,
      index_n_heads: 64,
      indexer_kv_dtype: "int8",
      intermediate_size: 18432,
      moe_intermediate_size: 2048,
      n_routed_experts: 256,
      num_experts_per_tok: 8,
      n_shared_experts: 1,
      first_k_dense_replace: 3,
      vocab_size: 129280,
      max_position_embeddings: 163840,
      torch_dtype: "bfloat16",
    },
  },
  {
    id: "engram-conditional",
    label: "Engram 条件记忆样例",
    shortLabel: "Engram 条件记忆",
    features: ["Engram"],
    recommendedTp: 2,
    recommendedPp: 1,
    recommendedDp: 2,
    recommendedEnableEp: false,
    recommendedPrecision: "bf16",
    config: {
      model_type: "qwen3",
      architectures: ["Qwen3EngramForCausalLM"],
      hidden_size: 4096,
      num_hidden_layers: 36,
      num_attention_heads: 32,
      num_key_value_heads: 8,
      head_dim: 128,
      intermediate_size: 12288,
      vocab_size: 151936,
      use_engram: true,
      engram_vocab_size: 1292800,
      engram_hidden_size: 1280,
      engram_layers: [1, 15],
      engram_dp_shared_memory: true,
      max_position_embeddings: 40960,
      torch_dtype: "bfloat16",
    },
  },
];

function extractWave4FeaturesFromSpec(spec: ModelSpec): Wave4Feature[] {
  const features: Wave4Feature[] = [];
  const hasCsa2 = spec.layers.some((l) => l.attention.kind === "dsa");
  const hasMla = spec.layers.some(
    (l) => l.attention.kind === "mla" || (l.attention.kind === "dsa" && l.attention.kvLoraRank !== undefined),
  );
  const hasKda = spec.layers.some((l) => l.attention.kind === "linear_kda");
  const hasEngram = Boolean(spec.engram?.enabled);
  if (hasMla) features.push("MLA");
  if (hasCsa2) features.push("CSA2");
  if (hasKda) features.push("KDA");
  if (hasEngram) features.push("Engram");
  return features;
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

function findWave4DemoPreset(token: string): Wave4DemoPreset | undefined {
  const norm = token.trim().toLowerCase();
  if (!norm) return undefined;
  return WAVE4_DEMO_PRESETS.find(
    (p) =>
      p.id.toLowerCase() === norm || p.shortLabel.toLowerCase() === norm || p.label.toLowerCase() === norm,
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
        wave4Features: [],
      };
    }
    const wave4Preset = findWave4DemoPreset(trimmed);
    if (wave4Preset) {
      const spec = parseHfConfig(wave4Preset.config, {
        id: wave4Preset.id,
        name: wave4Preset.shortLabel,
      });
      return {
        ok: true,
        supportedInWave3: true,
        spec,
        sourceKind: "preset",
        presetId: wave4Preset.id,
        wave4Features: extractWave4FeaturesFromSpec(spec),
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
  try {
    const spec = parseHfConfig(obj);
    const wave4Features = extractWave4FeaturesFromSpec(spec);
    return {
      ok: true,
      supportedInWave3: true,
      spec,
      sourceKind: "custom-json",
      wave4Features,
    };
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

interface PerRankKvAndStateResult {
  perTokenPagedKvBytes: number;
  perTokenMainKvBytes: number;
  perTokenIndexerKvBytes: number;
  localMainKvBytesPerSlot: number;
  singleBlockFixedLinearStateBytes: number;
  linearStateBlocksPerSeq: number;
  perSeqFixedLinearStateBytes: number;
  totalFixedLinearStateBytes: number;
  localFullAttnLayerCount: number;
  localLinearLayerCount: number;
  localMlaLayerCount: number;
  localDsaLayerCount: number;
  localKvHeadsPerRank: number;
  primaryFullAttn: AttentionSpec;
  firstLinearAttn: AttentionSpec | null;
  recurrentStateBytesPerLayerPerSeq: number;
  convStateBytesPerLayerPerSeq: number;
  latentBytesPerTokenPerLayer: number;
  indexerBytesPerTokenPerLayer: number;
}

interface ContiguousPpStage {
  stageIndex: number;
  stageCount: number;
  layers: readonly LayerSpec[];
}

function getContiguousPpStages(spec: ModelSpec, ppSize: number): readonly ContiguousPpStage[] {
  const safePp = Math.max(1, ppSize);
  if (safePp <= 1 || spec.layers.length <= 1) {
    return [{ stageIndex: 0, stageCount: 1, layers: spec.layers }];
  }
  const effectiveStages = Math.min(safePp, spec.layers.length);
  const base = Math.floor(spec.layers.length / effectiveStages);
  const rem = spec.layers.length % effectiveStages;
  // Match upstream vLLM get_pp_indices (vllm/distributed/utils.py):
  // distribute remainder layers from the penultimate stage backwards (excluding the last stage)
  const partitions = Array.from({ length: effectiveStages }, () => base);
  for (let i = 2; i < rem + 2; i += 1) {
    partitions[effectiveStages - i]! += 1;
  }
  const stages: ContiguousPpStage[] = [];
  let offset = 0;
  for (let s = 0; s < effectiveStages; s += 1) {
    const count = partitions[s]!;
    stages.push({
      stageIndex: s,
      stageCount: effectiveStages,
      layers: spec.layers.slice(offset, offset + count),
    });
    offset += count;
  }
  return stages;
}

export function getPerRankKvHeadLayout(
  a: AttentionSpec,
  tpSize: number,
): { localKvHeads: number; localKvDim: number } {
  const safeTp = Math.max(1, tpSize);
  if (a.kind === "mla" || (a.kind === "dsa" && a.kvLoraRank !== undefined)) {
    return {
      localKvHeads: 1,
      localKvDim: (a.kvLoraRank ?? 512) + (a.qkRopeHeadDim ?? 64),
    };
  }
  if (a.kind === "linear_kda") {
    const localKvHeads = Math.max(1, Math.ceil((a.linearNumKeyHeads ?? a.numHeads) / safeTp));
    return {
      localKvHeads,
      localKvDim: localKvHeads * (a.linearKeyHeadDim ?? a.headDim),
    };
  }
  const localKvHeads = Math.max(1, Math.ceil(a.numKvHeads / safeTp));
  return {
    localKvHeads,
    localKvDim: localKvHeads * a.headDim,
  };
}

function computePerRankKvAndState(params: {
  spec: ModelSpec;
  tpSize: number;
  ppSize: number;
  dcpSize: number;
  kvElemBytes: number;
  maxNumSeqs: number;
  numSpecTokens?: number;
  stageLayers?: readonly LayerSpec[];
}): PerRankKvAndStateResult {
  const { spec, tpSize, ppSize, dcpSize, kvElemBytes, maxNumSeqs, numSpecTokens = 0, stageLayers } = params;
  const safeDcp = Math.max(1, dcpSize);
  const rankLayers = stageLayers ?? getContiguousPpStages(spec, ppSize)[0]!.layers;

  let perTokenMainKv = 0;
  let localMainKvSlot = 0;
  let perTokenIndexerKv = 0;
  let perSeqSingleBlockLinear = 0;
  let perSeqLinear = 0;
  const linearStateBlocksPerSeq = 1 + Math.max(0, Math.round(numSpecTokens));
  let localFullAttnLayerCount = 0;
  let localLinearLayerCount = 0;
  let localMlaLayerCount = 0;
  let localDsaLayerCount = 0;
  let primaryFullAttn: AttentionSpec | null = null;
  let firstLinearAttn: AttentionSpec | null = null;
  let recurrentStateBytesPerLayerPerSeq = 0;
  let convStateBytesPerLayerPerSeq = 0;
  let latentBytesPerTokenPerLayer = 0;
  let indexerBytesPerTokenPerLayer = 0;

  for (const layer of rankLayers) {
    const a = layer.attention;
    if (a.kind === "linear_kda") {
      localLinearLayerCount += 1;
      if (!firstLinearAttn) firstLinearAttn = a;
      const st = linearStateBytesPerSeqLayer(a, tpSize, numSpecTokens);
      if (recurrentStateBytesPerLayerPerSeq === 0) {
        recurrentStateBytesPerLayerPerSeq = st.recurrentBytes;
        convStateBytesPerLayerPerSeq = st.convBytes;
      }
      perSeqSingleBlockLinear += st.singleBlockBytes;
      perSeqLinear += st.totalBytes;
    } else if (a.kind === "mla") {
      localFullAttnLayerCount += 1;
      localMlaLayerCount += 1;
      if (!primaryFullAttn) primaryFullAttn = a;
      const latentFull = ((a.kvLoraRank ?? 512) + (a.qkRopeHeadDim ?? 64)) * kvElemBytes;
      if (latentBytesPerTokenPerLayer === 0) latentBytesPerTokenPerLayer = latentFull;
      // MLA has 1 shared latent head: TP replicates it; only DCP > 1 shards along sequence axis
      localMainKvSlot += latentFull;
      perTokenMainKv += latentFull / safeDcp;
    } else if (a.kind === "dsa") {
      localFullAttnLayerCount += 1;
      localDsaLayerCount += 1;
      if (!primaryFullAttn) primaryFullAttn = a;
      if (a.kvLoraRank !== undefined) {
        localMlaLayerCount += 1;
        const latentFull = (a.kvLoraRank + (a.qkRopeHeadDim ?? 64)) * kvElemBytes;
        if (latentBytesPerTokenPerLayer === 0) latentBytesPerTokenPerLayer = latentFull;
        localMainKvSlot += latentFull;
        perTokenMainKv += latentFull / safeDcp;
      } else {
        const { localKvDim } = getPerRankKvHeadLayout(a, tpSize);
        const mainSlot = 2 * localKvDim * kvElemBytes;
        localMainKvSlot += mainSlot;
        perTokenMainKv += mainSlot / safeDcp;
      }
      // sfa_cp.py: lightning indexer k_cache is replicated per rank (NOT divided by safeDcp)
      const idxBytes = indexerBytesPerTokenLayer(a);
      if (indexerBytesPerTokenPerLayer === 0) indexerBytesPerTokenPerLayer = idxBytes;
      perTokenIndexerKv += idxBytes;
    } else {
      localFullAttnLayerCount += 1;
      if (!primaryFullAttn) primaryFullAttn = a;
      const { localKvDim } = getPerRankKvHeadLayout(a, tpSize);
      const mainSlot = 2 * localKvDim * kvElemBytes;
      localMainKvSlot += mainSlot;
      perTokenMainKv += mainSlot / safeDcp;
    }
  }

  const refAttn =
    primaryFullAttn ??
    spec.layers.find((l) => l.attention.kind !== "linear_kda")?.attention ??
    spec.layers[0]!.attention;
  const { localKvHeads: localKvHeadsPerRank } = getPerRankKvHeadLayout(refAttn, tpSize);

  const perTokenMainKvBytes = Math.round(perTokenMainKv);
  const perTokenIndexerKvBytes = Math.round(perTokenIndexerKv);
  const perTokenPagedKvBytes = Math.round(perTokenMainKv + perTokenIndexerKv);
  const localMainKvBytesPerSlot = Math.round(localMainKvSlot);
  const singleBlockFixedLinearStateBytes = Math.round(perSeqSingleBlockLinear);
  const perSeqFixedLinearStateBytes = Math.round(perSeqLinear);
  const totalFixedLinearStateBytes = perSeqFixedLinearStateBytes * maxNumSeqs;

  return {
    perTokenPagedKvBytes,
    perTokenMainKvBytes,
    perTokenIndexerKvBytes,
    localMainKvBytesPerSlot,
    singleBlockFixedLinearStateBytes,
    linearStateBlocksPerSeq: localLinearLayerCount > 0 ? linearStateBlocksPerSeq : 0,
    perSeqFixedLinearStateBytes,
    totalFixedLinearStateBytes,
    localFullAttnLayerCount,
    localLinearLayerCount,
    localMlaLayerCount,
    localDsaLayerCount,
    localKvHeadsPerRank,
    primaryFullAttn: refAttn,
    firstLinearAttn,
    recurrentStateBytesPerLayerPerSeq,
    convStateBytesPerLayerPerSeq,
    latentBytesPerTokenPerLayer,
    indexerBytesPerTokenPerLayer,
  };
}

interface WeightBreakdownResult {
  lowBytes: number;
  pointBytes: number;
  highBytes: number;
  residentScaleBytes: number;
  activeScaleBytes: number;
  activeWeightBytesPerRank: number;
  effectiveWeightPrecision: string;
  effectiveLinearElemBytes: number;
  nzApplied: boolean;
  engramNpuWeightBytesPerRank: number;
  engramHostDramBytesPerNode: number;
  engramEtpSize: number;
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
  dpSize?: number;
  pcpSize?: number;
  epWorldSize: number;
  enableEp: boolean;
  engramCpuOffload?: boolean;
  engramDpSharedMemory?: boolean;
  stage?: ContiguousPpStage;
}): WeightBreakdownResult {
  const {
    spec,
    card,
    version,
    weightPrecision,
    weightNzMode,
    tpSize,
    ppSize,
    dpSize = 1,
    pcpSize = 1,
    epWorldSize,
    enableEp,
    engramCpuOffload,
    engramDpSharedMemory,
    stage,
  } = params;
  const safeDp = Math.max(1, dpSize);
  const safePcp = Math.max(1, pcpSize);

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

  // Layer cost for contiguous PP stage
  const activeStage = stage ?? getContiguousPpStages(spec, ppSize)[0]!;
  const perLayerCost = (
    layer: LayerSpec,
  ): {
    nonQuantBytes: number;
    activeNonQuantBytes: number;
    quantWeightBytes: number;
    residentScaleBytes: number;
    activeScaleBytes: number;
    activeQuantWeightBytes: number;
    unquantMoeNzBytes: number;
  } => {
    const H = spec.hidden;
    const a = layer.attention;

    let nonQuantParams = 2 * H;
    let activeNonQuantParams = 2 * H;
    let attnLinearParams = 0;
    let attnOutChannels = 0;

    if (a.kind === "mla" || (a.kind === "dsa" && a.kvLoraRank !== undefined)) {
      const kvLora = a.kvLoraRank ?? 512;
      const qkRope = a.qkRopeHeadDim ?? 64;
      const qkNope = a.qkNopeHeadDim ?? 128;
      const vDim = a.vHeadDim ?? 128;
      const localHeads = a.numHeads / tpSize;
      const qkHead = qkNope + qkRope;

      nonQuantParams += kvLora + (a.qLoraRank ? a.qLoraRank : 0);
      activeNonQuantParams += kvLora + (a.qLoraRank ? a.qLoraRank : 0);

      // q_a_proj & kv_a_proj_with_mqa are replicated across TP; q_b_proj, kv_b_proj & o_proj are TP-sharded
      if (a.qLoraRank && a.qLoraRank > 0) {
        attnLinearParams += H * a.qLoraRank + a.qLoraRank * localHeads * qkHead;
        attnOutChannels += a.qLoraRank + localHeads * qkHead;
      } else {
        attnLinearParams += H * localHeads * qkHead;
        attnOutChannels += localHeads * qkHead;
      }
      attnLinearParams +=
        H * (kvLora + qkRope) + kvLora * localHeads * (qkNope + vDim) + localHeads * vDim * H;
      attnOutChannels += kvLora + qkRope + localHeads * (qkNope + vDim) + H;
    } else if (a.kind === "linear_kda") {
      const localKHeads = Math.max(1, (a.linearNumKeyHeads ?? a.numHeads) / tpSize);
      const localVHeads = Math.max(1, (a.linearNumValueHeads ?? a.numHeads) / tpSize);
      const dK = a.linearKeyHeadDim ?? a.headDim;
      const dV = a.linearValueHeadDim ?? a.headDim;
      const localKDim = localKHeads * dK;
      const localVDim = localVHeads * dV;
      const convK = Math.max(2, a.linearConvKernelDim ?? 4);
      const convParams = (localVDim + 2 * localKDim) * convK;
      nonQuantParams += convParams;
      activeNonQuantParams += convParams;
      // q_proj, k_proj, v_proj, gate+beta proj, o_proj
      attnLinearParams += H * (2 * localKDim + localVDim + localVDim + localVHeads) + localVDim * H;
      attnOutChannels += 2 * localKDim + 2 * localVDim + localVHeads + H;
    } else {
      const localQDim = attnQDim(a) / tpSize;
      const { localKvDim } = getPerRankKvHeadLayout(a, tpSize);
      if (a.qkNorm) {
        nonQuantParams += 2 * a.headDim;
        activeNonQuantParams += 2 * a.headDim;
      }
      if (a.bias) {
        nonQuantParams += localQDim + 2 * localKvDim;
        activeNonQuantParams += localQDim + 2 * localKvDim;
      }
      attnLinearParams = H * localQDim + 2 * H * localKvDim + localQDim * H;
      attnOutChannels = localQDim + 2 * localKvDim + H;
    }

    if (a.kind === "dsa") {
      // Lightning indexer (wq_b + wk_weights_proj) is replicated across TP (disable_tp=True)
      const idxDim = a.indexHeadDim ?? 128;
      const idxHeads = a.indexNumHeads ?? 64;
      const qIn = a.qLoraRank ?? H;
      attnLinearParams += qIn * idxHeads * idxDim;
      attnOutChannels += idxHeads * idxDim;
      // wk_weights_proj kept in BF16 (quant_config=None in deepseek_v2.py#L703)
      const wkParams = H * (idxDim + idxHeads) + idxDim;
      nonQuantParams += wkParams;
      activeNonQuantParams += wkParams;
    }

    let quantParams = attnLinearParams;
    let activeQuantParams = attnLinearParams;
    let residentScaleBytes = 0;
    let activeScaleBytes = 0;
    let unquantMoeParams = 0;

    if (isInt8Quant) {
      // attention projections out channels, 8 B/out-ch (BF16 scale+offset + FP32 scale copy)
      const attnScale = attnOutChannels * 8;
      residentScaleBytes += attnScale;
      activeScaleBytes += attnScale;
    } else if (isW4a8) {
      const attnScale = Math.ceil(attnLinearParams / 128) * 4 + attnOutChannels * 4;
      residentScaleBytes += attnScale;
      activeScaleBytes += attnScale;
    }

    if (layer.mlp.kind === "dense") {
      const localI = layer.mlp.intermediate / tpSize;
      const mlpParams = 3 * H * localI;
      quantParams += mlpParams;
      activeQuantParams += mlpParams;
      if (isInt8Quant) {
        const mlpScale = (2 * localI + H) * 8;
        residentScaleBytes += mlpScale;
        activeScaleBytes += mlpScale;
      } else if (isW4a8) {
        const mlpScale = Math.ceil(mlpParams / 128) * 4 + (2 * localI + H) * 4;
        residentScaleBytes += mlpScale;
        activeScaleBytes += mlpScale;
      }
    } else {
      const m = layer.mlp;
      // Router gate replicated in FP16/BF16
      nonQuantParams += H * m.numExperts;
      activeNonQuantParams += H * m.numExperts;
      const localExperts = enableEp ? Math.ceil(m.numExperts / epWorldSize) : m.numExperts;
      // Upstream FusedMoE flattens TP × DP × PCP when enable_expert_parallel is false
      const expertSliceDiv = enableEp ? 1 : tpSize * safeDp * safePcp;
      const localMoeI = m.moeIntermediate / expertSliceDiv;
      const perExpertParams = 3 * H * localMoeI;
      const routedParams = localExperts * perExpertParams;
      const activeLocalExperts = Math.min(localExperts, m.topK);
      const activeRoutedParams = activeLocalExperts * perExpertParams;

      if (isStaticW8a8NoMoe) {
        // Static W8A8 only covers linear layers; MoE routed & shared experts remain unquantized (2 B/elem, no MoE INT8 scale)
        nonQuantParams += routedParams;
        activeNonQuantParams += activeRoutedParams;
        unquantMoeParams += routedParams;
      } else {
        quantParams += routedParams;
        activeQuantParams += activeRoutedParams;
        if (isInt8Quant) {
          // quantization.md#L313-L316: w13 (BF16 scale+offset + FP32 copy = 8B/out), w2 (BF16 scale+offset = 4B/out)
          const perExpertScale = 2 * localMoeI * 8 + H * 4;
          residentScaleBytes += localExperts * perExpertScale;
          activeScaleBytes += activeLocalExperts * perExpertScale;
        } else if (isW4a8) {
          const perExpertChannelScale = (2 * localMoeI + H) * 4;
          residentScaleBytes += Math.ceil(routedParams / 128) * 4 + localExperts * perExpertChannelScale;
          activeScaleBytes +=
            Math.ceil(activeRoutedParams / 128) * 4 + activeLocalExperts * perExpertChannelScale;
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
            const sharedScale = m.numSharedExperts * (2 * localSharedI + H) * 8;
            residentScaleBytes += sharedScale;
            activeScaleBytes += sharedScale;
          } else if (isW4a8) {
            const sharedScale =
              Math.ceil(sharedParams / 128) * 4 + m.numSharedExperts * (2 * localSharedI + H) * 4;
            residentScaleBytes += sharedScale;
            activeScaleBytes += sharedScale;
          }
        }
      }
    }

    return {
      nonQuantBytes: nonQuantParams * floatElemBytes,
      activeNonQuantBytes: activeNonQuantParams * floatElemBytes,
      quantWeightBytes: quantParams * quantElemBytes,
      residentScaleBytes,
      activeScaleBytes,
      activeQuantWeightBytes: activeQuantParams * quantElemBytes,
      unquantMoeNzBytes: unquantMoeParams * floatElemBytes,
    };
  };

  const rankLayers = activeStage.layers.map(perLayerCost);

  let nonQuantBytes = 0;
  let activeNonQuantBytes = 0;
  let quantWeightBytes = 0;
  let residentScaleBytes = 0;
  let activeScaleBytes = 0;
  let activeQuantWeightBytes = 0;
  let unquantMoeNzBytes = 0;
  for (const c of rankLayers) {
    nonQuantBytes += c.nonQuantBytes;
    activeNonQuantBytes += c.activeNonQuantBytes;
    quantWeightBytes += c.quantWeightBytes;
    residentScaleBytes += c.residentScaleBytes;
    activeScaleBytes += c.activeScaleBytes;
    activeQuantWeightBytes += c.activeQuantWeightBytes;
    unquantMoeNzBytes += c.unquantMoeNzBytes;
  }

  // Embeddings, final norm & lm_head (kept in floatElemBytes)
  const embedPerRankBytes = ((spec.vocab * spec.hidden) / tpSize) * floatElemBytes;
  const lmHeadPerRankBytes = spec.tieWordEmbeddings ? 0 : embedPerRankBytes;
  const finalNormBytes = spec.hidden * floatElemBytes;
  let vocabAndNormBytes: number;
  if (activeStage.stageCount <= 1) {
    vocabAndNormBytes = embedPerRankBytes + lmHeadPerRankBytes + finalNormBytes;
  } else {
    const isFirstStage = activeStage.stageIndex === 0;
    const isLastStage = activeStage.stageIndex === activeStage.stageCount - 1;
    const lastStageLmHead = spec.tieWordEmbeddings ? embedPerRankBytes : lmHeadPerRankBytes;
    vocabAndNormBytes =
      (isFirstStage ? embedPerRankBytes : 0) + (isLastStage ? lastStageLmHead + finalNormBytes : 0);
  }
  nonQuantBytes += vocabAndNormBytes;
  activeNonQuantBytes += vocabAndNormBytes;

  // Engram conditional memory tables: cpu_offload=true (default) -> Host DRAM (dp_shared_memory or Ascend MRV2 derivation shares 1 node table); cpu_offload=false -> NPU HBM
  let engramNpuWeightBytesPerRank = 0;
  let engramHostDramBytesPerNode = 0;
  const engramEtpSize = spec.engram?.enabled ? Math.max(1, spec.engram.etpSize ?? tpSize) : tpSize;
  const resolvedEngramCpuOffload = spec.engram?.enabled
    ? (engramCpuOffload ?? spec.engram.cpuOffload ?? true)
    : false;
  const resolvedEngramDpSharedMemory = spec.engram?.enabled
    ? (engramDpSharedMemory ?? spec.engram.dpSharedMemory)
    : false;
  if (spec.engram?.enabled) {
    const totalEngramBytes =
      spec.engram.layerIds.length * spec.engram.vocabSize * spec.engram.hiddenSize * spec.engram.dtypeBytes;
    if (resolvedEngramCpuOffload) {
      engramNpuWeightBytesPerRank = 0;
      const localEtpReplicaCount = Math.max(1, (tpSize * safeDp * safePcp) / engramEtpSize);
      engramHostDramBytesPerNode = resolvedEngramDpSharedMemory
        ? totalEngramBytes
        : Math.round(totalEngramBytes * localEtpReplicaCount);
    } else {
      const stageIdxSet = new Set(activeStage.layers.map((l) => l.index));
      const matchedEngramLayers = spec.engram.layerIds.filter((id) => stageIdxSet.has(id)).length;
      const localEngramLayers =
        activeStage.stageCount <= 1
          ? spec.engram.layerIds.length
          : matchedEngramLayers > 0 || spec.engram.layerIds.every((id) => id >= 0 && id < spec.numLayers)
            ? matchedEngramLayers
            : Math.max(1, Math.ceil(spec.engram.layerIds.length / ppSize));
      engramNpuWeightBytesPerRank = Math.round(
        (localEngramLayers * spec.engram.vocabSize * spec.engram.hiddenSize * spec.engram.dtypeBytes) /
          engramEtpSize,
      );
      engramHostDramBytesPerNode = 0;
      nonQuantBytes += engramNpuWeightBytesPerRank;
    }
  }

  const baseNdBytes = Math.round(nonQuantBytes + quantWeightBytes + residentScaleBytes);
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
  const activeWeightBytesPerRank = Math.round(
    activeNonQuantBytes + activeQuantWeightBytes + activeScaleBytes,
  );

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
  if (spec.engram?.enabled) {
    if (resolvedEngramCpuOffload) {
      notes.push(
        resolvedEngramDpSharedMemory
          ? `Engram 条件记忆（${spec.engram.layerIds.length} 层，cpu_offload=true, dp_shared_memory=true）：词表卸载至 Host DRAM / /dev/shm 节点共享，单卡 NPU 权重 HBM 占用 0 B，单节点需预留 ${(engramHostDramBytesPerNode / GIB).toFixed(2)} GiB 主机内存。`
          : `Engram 条件记忆（${spec.engram.layerIds.length} 层，cpu_offload=true, dp_shared_memory=false）：词表按进程私有卸载至 Host DRAM（按 ETP=${engramEtpSize} 切分），单卡 NPU 权重 HBM 占用 0 B，单节点需预留 ${(engramHostDramBytesPerNode / GIB).toFixed(2)} GiB 主机内存。`,
      );
    } else {
      notes.push(
        `Engram 条件记忆（${spec.engram.layerIds.length} 层，cpu_offload=false）：词表常驻 NPU HBM 并按 ETP=${engramEtpSize} 切分，单卡常驻权重增加 ${(engramNpuWeightBytesPerRank / GIB).toFixed(2)} GiB。`,
      );
    }
  }
  if (nzApplied) {
    notes.push("FRACTAL_NZ 分块重排引入 [1.00×, 1.03×] 对齐填充区间。");
  } else {
    notes.push("weight_nz_mode=1 下 BF16/FP16 保持 ND 布局，无 NZ 对齐膨胀。");
  }

  const totalParams = analyzeParams(spec).total;
  const formula =
    `总参 ${(totalParams / 1e9).toFixed(2)}B → 单卡分片 (TP=${tpSize}, PP=${ppSize}${safeDp > 1 && !enableEp && moeInfo.isMoe ? `, DP=${safeDp}(MoE展平)` : ""}${enableEp ? `, EP=${epWorldSize}` : ""}${spec.engram?.enabled ? (resolvedEngramCpuOffload ? ", Engram=Host DRAM" : `, ETP=${engramEtpSize}`) : ""}), ` +
    `有效精度 ${effectiveWeightPrecision}${nzApplied ? ", FRACTAL_NZ [1.00×, 1.03×]" : ", ND"}`;

  return {
    lowBytes,
    pointBytes,
    highBytes,
    residentScaleBytes: Math.round(residentScaleBytes),
    activeScaleBytes: Math.round(activeScaleBytes),
    activeWeightBytesPerRank,
    effectiveWeightPrecision,
    effectiveLinearElemBytes: quantElemBytes,
    nzApplied,
    engramNpuWeightBytesPerRank,
    engramHostDramBytesPerNode,
    engramEtpSize,
    formula,
    notes,
  };
}

function selectBottleneckPpStage(params: {
  spec: ModelSpec;
  card: AscendCalcCardSpec;
  version: RuleVersion;
  weightPrecision: WeightPrecision;
  weightNzMode: 0 | 1 | 2;
  tpSize: number;
  ppSize: number;
  dpSize: number;
  pcpSize: number;
  dcpSize: number;
  epWorldSize: number;
  enableEp: boolean;
  engramCpuOffload: boolean;
  engramDpSharedMemory?: boolean;
  kvElemBytes: number;
  effectiveBlockSize: number;
  maxModelLen: number;
  maxNumSeqs: number;
  numSpecTokens: number;
}): {
  stage: ContiguousPpStage;
  w: WeightBreakdownResult;
  kvState: PerRankKvAndStateResult;
  allStages: ReadonlyArray<{
    stage: ContiguousPpStage;
    w: WeightBreakdownResult;
    kvState: PerRankKvAndStateResult;
  }>;
} {
  const {
    spec,
    card,
    version,
    weightPrecision,
    weightNzMode,
    tpSize,
    ppSize,
    dpSize,
    pcpSize,
    dcpSize,
    epWorldSize,
    enableEp,
    engramCpuOffload,
    engramDpSharedMemory,
    kvElemBytes,
    effectiveBlockSize,
    maxModelLen,
    maxNumSeqs,
    numSpecTokens,
  } = params;
  const safeDcp = Math.max(1, dcpSize);
  const virtualBlockTokens = effectiveBlockSize * safeDcp;
  const kvFactor = card.halvesKvForWorkspace ? 2 : 1;
  const stages = getContiguousPpStages(spec, ppSize);

  const evaluated = stages.map((stage) => {
    const w = computeWeightsPerRank({
      spec,
      card,
      version,
      weightPrecision,
      weightNzMode,
      tpSize,
      ppSize,
      dpSize,
      pcpSize,
      epWorldSize,
      enableEp,
      engramCpuOffload,
      ...(engramDpSharedMemory !== undefined ? { engramDpSharedMemory } : {}),
      stage,
    });
    const kvState = computePerRankKvAndState({
      spec,
      tpSize,
      ppSize,
      dcpSize,
      kvElemBytes,
      maxNumSeqs,
      numSpecTokens,
      stageLayers: stage.layers,
    });
    const kvBytesPerBlock = Math.round(
      kvState.localMainKvBytesPerSlot * effectiveBlockSize +
        kvState.perTokenIndexerKvBytes * virtualBlockTokens,
    );
    const blocksPerMaxSeq = kvBytesPerBlock > 0 ? Math.ceil(maxModelLen / virtualBlockTokens) : 0;
    const minPagedKvBytes = blocksPerMaxSeq > 0 ? (blocksPerMaxSeq + 1) * kvBytesPerBlock : 0;
    const demandBytes = w.pointBytes + kvFactor * (kvState.totalFixedLinearStateBytes + minPagedKvBytes);
    return { stage, w, kvState, demandBytes };
  });

  let best = evaluated[0]!;
  for (const cand of evaluated) {
    if (cand.demandBytes > best.demandBytes) {
      best = cand;
    }
  }
  return {
    stage: best.stage,
    w: best.w,
    kvState: best.kvState,
    allStages: evaluated,
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
  const moe = getMoeInfo(spec);
  const epWorld = enableEp ? dpSize * tpSize * pcpSize : 1;

  // Permutation-invariant per-layer activation peak across ALL layers (covers hybrid KDA+GQA & Dense+MoE stacks)
  let layerCombinedPeakBytes = 0;
  if (spec.layers.length === 0) {
    const fallbackAttn = T * (6 * H + 6 * (H / tpSize)) * 2;
    const fallbackFfn = 3 * T * ((4 * H) / tpSize) * 2;
    layerCombinedPeakBytes = fallbackAttn + fallbackFfn;
  } else {
    for (const layer of spec.layers) {
      const a = layer.attention;
      let layerHiddenAttn: number;
      if (a.kind === "linear_kda") {
        // KDA / GatedDeltaNet: Q/K projections (localKDim each) + V/Z(gate)/recurrent-out (localVDim each) + residual/norm
        const localKHeads = Math.max(1, Math.ceil((a.linearNumKeyHeads ?? a.numHeads) / tpSize));
        const localVHeads = Math.max(1, Math.ceil((a.linearNumValueHeads ?? a.numHeads) / tpSize));
        const localKDim = localKHeads * (a.linearKeyHeadDim ?? a.headDim);
        const localVDim = localVHeads * (a.linearValueHeadDim ?? a.headDim);
        layerHiddenAttn = T * (6 * H + 3 * localKDim + 3 * localVDim) * 2;
      } else {
        const qDimPerRank =
          a.kind === "mla" || (a.kind === "dsa" && a.kvLoraRank !== undefined)
            ? Math.max(1, (a.numHeads / tpSize) * ((a.qkNopeHeadDim ?? 128) + (a.qkRopeHeadDim ?? 64)))
            : attnQDim(a) / tpSize;
        const kvDimPerRank = getPerRankKvHeadLayout(a, tpSize).localKvDim;
        layerHiddenAttn = T * (6 * H + 2 * qDimPerRank + 4 * kvDimPerRank) * 2;
      }

      let layerFfnPeak: number;
      if (layer.mlp.kind === "moe") {
        const routedTokens = T * layer.mlp.topK;
        const perRankRouted = enableEp
          ? Math.max(T, Math.ceil((routedTokens * 1.4) / epWorld))
          : routedTokens;
        const localMoeInter = enableEp
          ? layer.mlp.moeIntermediate
          : Math.max(1, Math.ceil(layer.mlp.moeIntermediate / (tpSize * dpSize * pcpSize)));
        layerFfnPeak = perRankRouted * (2 * localMoeInter + H) * 2;
      } else {
        layerFfnPeak = 3 * T * (layer.mlp.intermediate / tpSize) * 2;
      }
      layerCombinedPeakBytes = Math.max(layerCombinedPeakBytes, layerHiddenAttn + layerFfnPeak);
    }
  }

  const notes: string[] = [];
  if (moe.isMoe) {
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
    (layerCombinedPeakBytes + logitsLowBytes + baseWorkspaceLow * scaleWithModel) * quantWorkspaceFactor,
  );
  const highBytes = Math.round(
    (layerCombinedPeakBytes * 1.65 + logitsHighBytes + baseWorkspaceHigh * scaleWithModel) *
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
  const isFullCapture = cudagraphMode === "FULL" || cudagraphMode === "FULL_AND_PIECEWISE";
  const layerScale = Math.max(isFullCapture ? 0.85 : 0.65, spec.numLayers / 36);
  const moeScale = isMoe ? 1.25 : 1.0;
  const perGraphLowMiB = 38 * modeMultiplier[cudagraphMode] * layerScale * moeScale;
  const perGraphHighMiB = 115 * modeMultiplier[cudagraphMode] * layerScale * moeScale;
  // FULL / FULL_AND_PIECEWISE capture on Ascend allocates FIA workspace (~1.98 GiB) + allocator split reserve during capture_model()
  const fullCaptureTransientHighMiB = isFullCapture && card.family !== "310P" ? 3100 : 0;

  const lowBytes = Math.round((200 + effectiveCount * perGraphLowMiB) * MIB);
  const highBytes = Math.round((400 + fullCaptureTransientHighMiB + effectiveCount * perGraphHighMiB) * MIB);
  const pointBytes = Math.round(lowBytes * 0.65 + (highBytes - fullCaptureTransientHighMiB * MIB) * 0.35);

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
  kvState: PerRankKvAndStateResult;
  tpSize: number;
  dpSize: number;
  pcpSize: number;
  dcpSize: number;
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
    kvState,
    tpSize,
    dpSize,
    pcpSize,
    dcpSize,
    epWorldSize,
    enableEp,
    prefillTokens,
    decodeBatchSize,
    decodeContextLen,
  } = params;
  const a = kvState.primaryFullAttn;
  const moe = getMoeInfo(spec);
  const hasMla = kvState.localMlaLayerCount > 0;
  const hasCsa2 = kvState.localDsaLayerCount > 0;
  const hasKda = kvState.localLinearLayerCount > 0;

  const isStaticW8a8UnquantMoe = moe.isMoe && weightPrecision === "w8a8";
  const linearWBytes = weightInfo.effectiveLinearElemBytes;
  const actOutBytes = 2;

  // 1. Attention / Dense Linear execution precision (e.g. INT8 for static w8a8 q_proj)
  let linearPeakTflops: number;
  let linearPrecisionLabel: string;
  let linearActInBytes = 2;
  if (linearWBytes <= 1.05 && weightPrecision === "fp8_block" && card.supportsNativeFp8) {
    linearPeakTflops = card.peakFp8Tflops ?? card.peakInt8Tops;
    linearPrecisionLabel = "MXFP8 / FP8 Cube";
    linearActInBytes = 1;
  } else if (linearWBytes <= 1.05) {
    linearPeakTflops = card.peakInt8Tops;
    linearPrecisionLabel = linearWBytes < 1 ? "W4A8 / INT8 Cube" : "INT8 W8A8 Cube";
    linearActInBytes = 1;
  } else {
    linearPeakTflops = card.peakBf16Tflops ?? card.peakFp16Tflops;
    linearPrecisionLabel = card.supportsBf16 ? "BF16/FP16 Cube" : "FP16 Cube";
    linearActInBytes = 2;
  }
  const prefillRidgePointFlopsPerByte = (linearPeakTflops * 1000) / card.hbmBandwidthGBs;

  // 2. Decode Linear / MoE Expert execution precision (BF16/FP16 when static w8a8 leaves MoE experts unquantized)
  const decodeWBytes = isStaticW8a8UnquantMoe ? 2 : linearWBytes;
  const decodeActInBytes = isStaticW8a8UnquantMoe ? 2 : linearActInBytes;
  const peakComputeTflops = isStaticW8a8UnquantMoe
    ? (card.peakBf16Tflops ?? card.peakFp16Tflops)
    : linearPeakTflops;
  const computePrecisionLabel = isStaticW8a8UnquantMoe
    ? card.supportsBf16
      ? "BF16/FP16 Cube（MoE 专家未量化；注意力 Linear 为 INT8）"
      : "FP16 Cube（MoE 专家未量化；注意力 Linear 为 INT8）"
    : linearPrecisionLabel;
  const ridgePointFlopsPerByte = (peakComputeTflops * 1000) / card.hbmBandwidthGBs;

  // Representative per-rank linear GEMM shapes (actual TP-sharded Q / MLP / expert dims, never clamped up to hidden size)
  const K = spec.hidden;
  const localQProjN =
    a.kind === "mla" || (a.kind === "dsa" && a.kvLoraRank !== undefined)
      ? Math.max(1, Math.round((a.numHeads / tpSize) * ((a.qkNopeHeadDim ?? 128) + (a.qkRopeHeadDim ?? 64))))
      : a.kind === "linear_kda"
        ? Math.max(
            1,
            Math.round(((a.linearNumKeyHeads ?? a.numHeads) / tpSize) * (a.linearKeyHeadDim ?? a.headDim)),
          )
        : Math.max(1, Math.round(attnQDim(a) / tpSize));
  const expertSliceDiv = enableEp ? 1 : tpSize * Math.max(1, dpSize) * Math.max(1, pcpSize);
  const N = moe.isMoe ? Math.max(1, Math.round(moe.moeIntermediate / expertSliceDiv)) : localQProjN;
  const prefillN = localQProjN;

  const prefillIntensityFlopsPerByte = gemmArithmeticIntensity(
    prefillTokens,
    K,
    prefillN,
    linearActInBytes,
    linearWBytes,
    actOutBytes,
  );
  const prefillRegime =
    prefillIntensityFlopsPerByte >= prefillRidgePointFlopsPerByte ? "compute-bound" : "memory-bound";

  const localExpertsPerRank = moe.isMoe
    ? enableEp
      ? Math.ceil(moe.numExperts / epWorldSize)
      : moe.numExperts
    : null;

  // MoE router dilution: (DP × B × topK) / E_total rows per expert on average; touched experts process >= 1 row
  const moeRouterDilutedRows = moe.isMoe ? (dpSize * decodeBatchSize * moe.topK) / moe.numExperts : null;
  const decodeLinearMEff = moe.isMoe ? Math.max(1, moeRouterDilutedRows!) : decodeBatchSize;

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

  const safeDcp = Math.max(1, dcpSize);
  const localNumHeads = Math.max(1, a.numHeads / tpSize);
  // Under DCP > 1, decode attention all_gathers Q heads across the DCP group before attending to local sequence-sharded KV
  const effectiveAttnQHeads = Math.min(a.numHeads, localNumHeads * safeDcp);
  const { localKvHeads } = getPerRankKvHeadLayout(a, tpSize);
  const gqaGroupSize = hasMla ? effectiveAttnQHeads : effectiveAttnQHeads / localKvHeads;
  const sparseTopK = hasCsa2 ? (a.sparseTopK ?? 2048) : null;
  const effectiveDecodeContextLen =
    sparseTopK !== null ? Math.min(decodeContextLen, sparseTopK) : decodeContextLen;

  let decodeKvAttnIntensityFlopsPerByte: number;
  let attentionModeLabel: string;
  if (hasMla) {
    // MLA Decode matrix absorption (mlapo): W_UK absorbed into Q, W_UV into O; all effective Q heads share 1 latent vector (kv_lora_rank + qk_rope_head_dim)
    const kvLora = a.kvLoraRank ?? 512;
    const qkRope = a.qkRopeHeadDim ?? 64;
    decodeKvAttnIntensityFlopsPerByte =
      (2 * effectiveAttnQHeads * (2 * kvLora + qkRope)) / ((kvLora + qkRope) * kvElemBytes);
    attentionModeLabel = hasCsa2
      ? `CSA2 稀疏 MLA 吸收 (top-${sparseTopK})`
      : `MLA 矩阵吸收 mlapo (${effectiveAttnQHeads} Q头共享单潜向量)`;
  } else if (hasKda && kvState.localFullAttnLayerCount === 0) {
    // Pure linear/KDA recurrent state update S_t = alpha * S_{t-1} + k_t v_t^T (read + write S in FP32)
    const lin = kvState.firstLinearAttn ?? a;
    const stateElem = lin.linearStateDtypeBytes ?? 4;
    decodeKvAttnIntensityFlopsPerByte = 4 / (2 * stateElem);
    attentionModeLabel = "KDA 纯线性递推态 (O(1))";
  } else {
    decodeKvAttnIntensityFlopsPerByte = (2 * gqaGroupSize) / kvElemBytes;
    attentionModeLabel = hasCsa2
      ? `CSA2 稀疏 GQA (top-${sparseTopK})`
      : hasKda
        ? `KDA + GQA 混合 (全注意组=${gqaGroupSize})`
        : `GQA Decode KV (组=${gqaGroupSize})`;
  }

  const decodeKvAttnRegime =
    decodeKvAttnIntensityFlopsPerByte >= ridgePointFlopsPerByte ? "compute-bound" : "memory-bound";

  // Decode HBM traffic per step:
  // - CSA2/DSA: main KV read drops to Math.min(decodeContextLen, indexTopk) + full-context lightweight indexer scan
  // - KDA: full-attention paged KV + O(1) fixed recurrent state read/write per sequence (independent of decodeContextLen)
  const mainKvTraffic = decodeBatchSize * effectiveDecodeContextLen * kvState.perTokenMainKvBytes;
  const indexerTraffic = hasCsa2 ? decodeBatchSize * decodeContextLen * kvState.perTokenIndexerKvBytes : 0;
  const linearStateTraffic = hasKda ? decodeBatchSize * kvState.perSeqFixedLinearStateBytes * 2 : 0; // read + write recurrent state S
  const decodeKvTrafficBytesPerStep = Math.round(mainKvTraffic + indexerTraffic + linearStateTraffic);

  const prefillAchievedTflops = Math.min(
    linearPeakTflops,
    (prefillIntensityFlopsPerByte * card.hbmBandwidthGBs) / 1000,
  );
  const decodeLinearAchievedTflops = Math.min(
    peakComputeTflops,
    (decodeLinearIntensityFlopsPerByte * card.hbmBandwidthGBs) / 1000,
  );
  const decodeKvAttnAchievedTflops = Math.min(
    peakComputeTflops,
    (decodeKvAttnIntensityFlopsPerByte * card.hbmBandwidthGBs) / 1000,
  );
  const maxPeakComputeTflops = Math.max(linearPeakTflops, peakComputeTflops);
  const hasSplitStagePrecision = Math.abs(prefillRidgePointFlopsPerByte - ridgePointFlopsPerByte) > 1e-6;

  const notes: string[] = [
    hasSplitStagePrecision
      ? `分阶段有效脊点：Prefill 注意力/稠密线性层 I_ridge = ${linearPeakTflops} T / ${(card.hbmBandwidthGBs / 1000).toFixed(2)} TB/s = ${prefillRidgePointFlopsPerByte.toFixed(1)} FLOP/B（${linearPrecisionLabel}）；Decode MoE 专家 I_ridge = ${peakComputeTflops} T / ${(card.hbmBandwidthGBs / 1000).toFixed(2)} TB/s = ${ridgePointFlopsPerByte.toFixed(1)} FLOP/B（BF16/FP16 Cube）。`
      : `硬件脊点 I_ridge = ${peakComputeTflops} T / ${(card.hbmBandwidthGBs / 1000).toFixed(2)} TB/s = ${ridgePointFlopsPerByte.toFixed(1)} FLOP/B（${computePrecisionLabel}）。`,
  ];
  if (hasMla) {
    const kvLora = a.kvLoraRank ?? 512;
    const qkRope = a.qkRopeHeadDim ?? 64;
    notes.push(
      `MLA Decode 矩阵吸收（mlapo）：${safeDcp > 1 ? `DCP=${safeDcp} 沿头维 all_gather Q 后单卡以 ${effectiveAttnQHeads} 个 Q 头` : `单卡 ${localNumHeads} 个 Q 头`}共用 1 份潜向量 (${kvLora}+${qkRope})×${kvElemBytes}B，注意力算术强度跃升至 ${decodeKvAttnIntensityFlopsPerByte.toFixed(1)} FLOP/B（远高于 GQA 的 4–8 FLOP/B）；${safeDcp > 1 ? `已启用 DCP=${safeDcp} 沿序列轴切分潜向量 KV。` : `注意 TP=${tpSize} 无法切分单潜向量头，每卡均持完整潜向量副本，开启 DCP>1 可减半读取。`}`,
    );
  } else {
    notes.push(
      `GQA Decode KV 读取强度锁定在 2 × (${effectiveAttnQHeads}/${localKvHeads}) / ${kvElemBytes}B = ${decodeKvAttnIntensityFlopsPerByte.toFixed(1)} FLOP/B${safeDcp > 1 ? `（DCP=${safeDcp} 沿头维 all_gather Q 将单卡历史注意力 Q 头从 ${localNumHeads} 扩至 ${effectiveAttnQHeads}）` : tpSize > a.numKvHeads ? `（TP=${tpSize} > KV头=${a.numKvHeads} 触发 KV 头复制，单卡有效分组从 ${a.numHeads / Math.max(1, a.numKvHeads)} 降至 ${gqaGroupSize}）` : ""}，不随并发数 B 增长。`,
    );
  }
  if (hasCsa2 && sparseTopK !== null) {
    const denseTraffic = decodeBatchSize * decodeContextLen * kvState.perTokenMainKvBytes;
    const savingsRatio = decodeKvTrafficBytesPerStep > 0 ? denseTraffic / decodeKvTrafficBytesPerStep : 1;
    notes.push(
      `CSA2/DSA 稀疏读取：主 KV 每步读取上下文从 ${decodeContextLen} 骤降至 min(${decodeContextLen}, ${sparseTopK}) = ${effectiveDecodeContextLen}（叠加全长轻量索引器扫描后，综合带宽压缩约 ${savingsRatio.toFixed(1)}×）。`,
    );
  }
  if (hasKda) {
    notes.push(
      `KDA 混合栈带宽特征：${kvState.localLinearLayerCount} 层线性注意力每步仅读写固定状态 S（单序列 ${(kvState.perSeqFixedLinearStateBytes / MIB).toFixed(2)} MiB，不随上下文长度增长），仅 ${kvState.localFullAttnLayerCount} 层全注意力按 ctx=${decodeContextLen} 扫分页 KV。`,
    );
  }
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
    prefillPrecisionLabel: linearPrecisionLabel,
    prefillPeakComputeTflops: linearPeakTflops,
    prefillRidgePointFlopsPerByte,
    prefillAchievedTflops,
    decodePeakComputeTflops: peakComputeTflops,
    decodeRidgePointFlopsPerByte: ridgePointFlopsPerByte,
    decodeLinearAchievedTflops,
    decodeKvAttnAchievedTflops,
    maxPeakComputeTflops,
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
    attentionModeLabel,
    decodeKvAttnIntensityFlopsPerByte,
    decodeKvAttnRegime,
    decodeContextLen,
    effectiveDecodeContextLen,
    decodeKvTrafficBytesPerStep,
    activeWeightBytesPerRank: weightInfo.activeWeightBytesPerRank,
    evidenceLevel: "D",
    notes,
  };
}

function buildRelatedWikiIds(params: {
  card: AscendCalcCardSpec;
  isMoe: boolean;
  hasMla: boolean;
  hasCsa2: boolean;
  hasKda: boolean;
  hasEngram: boolean;
  weightPrecision: WeightPrecision;
  kvCacheDtype: KvCacheDtype;
  tpSize: number;
  ppSize: number;
  dpSize: number;
  pcpSize: number;
  dcpSize: number;
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
  if (params.hasMla) {
    ids.add("mla");
    ids.add("kv-cache-spec");
  }
  if (params.hasCsa2) {
    ids.add("sparse-attention");
    ids.add("kv-cache-spec");
  }
  if (params.hasKda) {
    ids.add("linear-attention");
    ids.add("kv-cache-spec");
  }
  if (params.hasEngram) {
    ids.add("engram-conditional-memory");
    ids.add("ascend-model-onboarding");
    ids.add("kv-cache-spec");
  }
  if (params.isMoe) {
    ids.add("moe");
    ids.add("expert-parallel");
  }
  if (params.tpSize > 1) ids.add("tensor-parallel");
  if (params.ppSize > 1) ids.add("pipeline-parallel");
  if (params.dpSize > 1) ids.add("data-parallel");
  if (params.dcpSize > 1 || params.pcpSize > 1) ids.add("context-parallel");
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

interface MinCardsRecommendation {
  minCards: number | null;
  recommendedTp: number | null;
  recommendedPp: number | null;
  recommendedDp: number | null;
  recommendedPcp: number | null;
  recommendedDcp: number | null;
  recommendedEnableEp: boolean;
  feasible: boolean;
  unsolvable: boolean;
}

function shouldAutoDeriveEngramDpSharedMemory(params: {
  spec: ModelSpec;
  version: RuleVersion;
  engramCpuOffload: boolean;
  useV2ModelRunner: boolean;
  dpSize: number;
  pcpSize: number;
}): boolean {
  // v0.30.0@c09d3e20 derives dp_shared_memory=True whenever MRV2 && (DP>1 || PCP>1) without checking cpu_offload;
  // main@8d6180e2 (and rfork tracking main) requires cpu_offload=True before auto-deriving.
  return Boolean(
    params.spec.engram?.enabled &&
      (params.version === "v0.30.0" || params.engramCpuOffload) &&
      !params.spec.engram.dpSharedMemory &&
      params.useV2ModelRunner &&
      (params.dpSize > 1 || params.pcpSize > 1),
  );
}

function recommendMinCards(params: {
  spec: ModelSpec;
  card: AscendCalcCardSpec;
  version: RuleVersion;
  weightPrecision: WeightPrecision;
  kvCacheDtype: KvCacheDtype;
  requestedBlockSize: number;
  userSpecifiedBlockSize: boolean;
  weightNzMode: 0 | 1 | 2;
  kvElemBytes: number;
  effectiveBlockSize: number;
  gpuMemoryUtilization: number;
  maxModelLen: number;
  maxNumBatchedTokens: number;
  maxNumSeqs: number;
  numSpecTokens: number;
  engramCpuOffload: boolean;
  useV2ModelRunner: boolean;
  cudagraphMode: CudaGraphMode;
  enforceEager: boolean;
  headroomStatus: HeadroomStatus;
  hasMla: boolean;
  hasCsa2: boolean;
  hasKda: boolean;
  isMoe: boolean;
  currentFeasibleTopology?: {
    tpSize: number;
    ppSize: number;
    dpSize: number;
    pcpSize: number;
    dcpSize: number;
    enableEp: boolean;
    worldSize: number;
  };
}): MinCardsRecommendation {
  const {
    spec,
    card,
    version,
    weightPrecision,
    kvCacheDtype,
    requestedBlockSize,
    userSpecifiedBlockSize,
    weightNzMode,
    kvElemBytes,
    effectiveBlockSize,
    gpuMemoryUtilization,
    maxModelLen,
    maxNumBatchedTokens,
    maxNumSeqs,
    numSpecTokens,
    engramCpuOffload,
    useV2ModelRunner,
    cudagraphMode,
    enforceEager,
    headroomStatus,
    hasMla,
    hasCsa2,
    hasKda,
    isMoe,
    currentFeasibleTopology,
  } = params;
  const firstAttn = spec.layers[0]!.attention;
  const fullAttn = spec.layers.find((l) => l.attention.kind !== "linear_kda")?.attention ?? firstAttn;
  const moeInfo = getMoeInfo(spec);
  const moeIntermediates = spec.layers
    .filter((l): l is LayerSpec & { mlp: Extract<MlpSpec, { kind: "moe" }> } => l.mlp.kind === "moe")
    .map((l) => l.mlp.moeIntermediate);
  const requestedBytes = Math.floor(card.hbmGiB * GIB * gpuMemoryUtilization);
  const maxLayers = Math.max(1, spec.numLayers);
  const searchUpper = currentFeasibleTopology ? Math.min(64, currentFeasibleTopology.worldSize - 1) : 64;

  const isValidTp = (tpCand: number): boolean => {
    if (firstAttn.numHeads % tpCand !== 0) return false;
    if (!hasMla && fullAttn.kind !== "linear_kda") {
      return fullAttn.numKvHeads >= tpCand
        ? fullAttn.numKvHeads % tpCand === 0
        : tpCand % fullAttn.numKvHeads === 0;
    }
    return true;
  };

  const requiresDpSharedGroup = Boolean(spec.engram?.enabled && spec.engram.dpSharedMemory);
  const supportsDcp = (tpCand: number): boolean =>
    tpCand > 1 && (hasMla || (fullAttn.kind !== "linear_kda" && tpCand > fullAttn.numKvHeads));

  const tryCandidate = (
    n: number,
    tp: number,
    pp: number,
    dp: number,
    dcp: number,
    enableEp: boolean,
  ): boolean => {
    const pcp = 1;
    const epWorld = enableEp ? dp * tp * pcp : 1;
    const candUseV2 = version !== "v0.30.0" ? true : Boolean(useV2ModelRunner);
    const candEngramDpSharedDerived = shouldAutoDeriveEngramDpSharedMemory({
      spec,
      version,
      engramCpuOffload,
      useV2ModelRunner: candUseV2,
      dpSize: dp,
      pcpSize: pcp,
    });
    const candEngramDpShared = spec.engram?.enabled
      ? spec.engram.dpSharedMemory || candEngramDpSharedDerived
      : false;
    const candQ1 = collectQ1Findings({
      spec,
      card,
      version,
      weightPrecision,
      kvCacheDtype,
      requestedBlockSize,
      effectiveBlockSize,
      userSpecifiedBlockSize,
      weightNzMode,
      tpSize: tp,
      ppSize: pp,
      dpSize: dp,
      pcpSize: pcp,
      dcpSize: dcp,
      epWorldSize: epWorld,
      enableEp,
      engramCpuOffload,
      engramDpSharedMemoryDerived: candEngramDpSharedDerived,
      useV2ModelRunner: candUseV2,
      gpuMemoryUtilization,
      cudagraphMode,
      enforceEager,
      oomStatus: "fits",
      headroomStatus,
      hasMla,
      hasCsa2,
      hasKda,
    });
    if (candQ1.blockers.length > 0) return false;

    const stageEval = selectBottleneckPpStage({
      spec,
      card,
      version,
      weightPrecision,
      weightNzMode,
      tpSize: tp,
      ppSize: pp,
      dpSize: dp,
      pcpSize: pcp,
      dcpSize: dcp,
      epWorldSize: epWorld,
      enableEp,
      engramCpuOffload,
      engramDpSharedMemory: candEngramDpShared,
      kvElemBytes,
      effectiveBlockSize,
      maxModelLen,
      maxNumSeqs,
      numSpecTokens,
    });
    const act = computeProfileRunTorchPeak({
      spec,
      card,
      version,
      weightPrecision,
      tpSize: tp,
      ppSize: pp,
      dpSize: dp,
      pcpSize: pcp,
      enableEp,
      maxNumBatchedTokens,
      maxNumSeqs,
    });
    const hccl = estimateHcclDomainMemory(
      {
        hardwareFamily: card.family,
        tpSize: tp,
        ppSize: pp,
        dpSize: dp,
        pcpSize: pcp,
        dcpSize: dcp,
        isMoe,
        enableExpertParallel: enableEp,
        ...(spec.engram?.enabled
          ? {
              engramEnabled: true,
              engramDpSharedMemory: candEngramDpShared,
              etpSize: stageEval.w.engramEtpSize,
            }
          : {}),
      },
      version,
    );
    const nonTorch = computeNonTorchIncrease({ card, hccl, isMoe, enableEp, worldSize: n });
    const virtualBlockTokens = effectiveBlockSize * dcp;
    return stageEval.allStages.every(({ w, kvState }) => {
      if (w.lowBytes >= requestedBytes) return false;
      if (w.pointBytes + act.pointBytes >= requestedBytes) return false;
      const rawKvLow = requestedBytes - (w.highBytes + act.highBytes + nonTorch.highBytes);
      const rawKvPoint = requestedBytes - (w.pointBytes + act.pointBytes + nonTorch.pointBytes);
      if (rawKvLow <= 0 || rawKvPoint <= 0) return false;
      const kvPoolLow = card.halvesKvForWorkspace ? Math.floor(rawKvLow / 2) : Math.floor(rawKvLow);
      const kvPoolPoint = card.halvesKvForWorkspace ? Math.floor(rawKvPoint / 2) : Math.floor(rawKvPoint);
      const kvPerBlock = Math.round(
        kvState.localMainKvBytesPerSlot * effectiveBlockSize +
          kvState.perTokenIndexerKvBytes * virtualBlockTokens,
      );
      const blocksPerMaxSeq = kvPerBlock > 0 ? Math.ceil(maxModelLen / virtualBlockTokens) : 0;
      const minSingleSeq =
        (blocksPerMaxSeq > 0 ? (blocksPerMaxSeq + 1) * kvPerBlock : 0) +
        Math.max(kvState.totalFixedLinearStateBytes, kvState.perSeqFixedLinearStateBytes);
      if (kvPoolLow < minSingleSeq || kvPoolPoint < minSingleSeq) return false;
      if (blocksPerMaxSeq > 0) {
        const usableLow = Math.max(
          0,
          Math.floor((kvPoolLow - kvState.totalFixedLinearStateBytes) / kvPerBlock) - 1,
        );
        const usablePoint = Math.max(
          0,
          Math.floor((kvPoolPoint - kvState.totalFixedLinearStateBytes) / kvPerBlock) - 1,
        );
        return usableLow >= blocksPerMaxSeq && usablePoint >= blocksPerMaxSeq;
      }
      return true;
    });
  };

  for (let n = 1; n <= searchUpper; n += 1) {
    const dpOptions: number[] = [];
    if (requiresDpSharedGroup) {
      for (let dpCand = 2; dpCand <= n; dpCand += 1) {
        if (n % dpCand === 0) dpOptions.push(dpCand);
      }
    } else {
      dpOptions.push(1);
    }

    for (const useDcp of [false, true] as const) {
      for (const dp of dpOptions) {
        const modelWorld = n / dp;
        const validTps: number[] = [];
        for (let tpCand = 1; tpCand <= modelWorld; tpCand += 1) {
          if (modelWorld % tpCand === 0 && isValidTp(tpCand) && modelWorld / tpCand <= maxLayers) {
            validTps.push(tpCand);
          }
        }
        // Prefer intra-node TP <= 8 descending (e.g. 8, 4, 2, 1), then cross-node TP > 8 ascending
        validTps.sort((a, b) => {
          const aIntra = a <= 8 ? 0 : 1;
          const bIntra = b <= 8 ? 0 : 1;
          if (aIntra !== bIntra) return aIntra - bIntra;
          return aIntra === 0 ? b - a : a - b;
        });

        for (const tp of validTps) {
          const pp = modelWorld / tp;
          const epDiv = dp * tp;
          const canEp = isMoe && epDiv > 1 && epDiv <= moeInfo.numExperts;
          const canNoEp = !isMoe || moeIntermediates.every((inter) => inter % epDiv === 0);
          const epOptions: boolean[] = isMoe
            ? [...(canEp ? [true] : []), ...(canNoEp ? [false] : [])]
            : [false];
          const dcpOptions: number[] = [];
          if (!useDcp) {
            dcpOptions.push(1);
          } else if (supportsDcp(tp)) {
            for (let d = 2; d <= tp; d += 1) {
              if (tp % d === 0) dcpOptions.push(d);
            }
          }

          for (const dcp of dcpOptions) {
            for (const enableEp of epOptions) {
              if (tryCandidate(n, tp, pp, dp, dcp, enableEp)) {
                return {
                  minCards: n,
                  recommendedTp: tp,
                  recommendedPp: pp,
                  recommendedDp: dp,
                  recommendedPcp: 1,
                  recommendedDcp: dcp,
                  recommendedEnableEp: enableEp,
                  feasible: true,
                  unsolvable: false,
                };
              }
            }
          }
        }
      }
    }
  }
  if (currentFeasibleTopology) {
    return {
      minCards: currentFeasibleTopology.worldSize,
      recommendedTp: currentFeasibleTopology.tpSize,
      recommendedPp: currentFeasibleTopology.ppSize,
      recommendedDp: currentFeasibleTopology.dpSize,
      recommendedPcp: currentFeasibleTopology.pcpSize,
      recommendedDcp: currentFeasibleTopology.dcpSize,
      recommendedEnableEp: currentFeasibleTopology.enableEp,
      feasible: true,
      unsolvable: false,
    };
  }
  return {
    minCards: null,
    recommendedTp: null,
    recommendedPp: null,
    recommendedDp: null,
    recommendedPcp: null,
    recommendedDcp: null,
    recommendedEnableEp: false,
    feasible: false,
    unsolvable: true,
  };
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
  pcpSize: number;
  dcpSize: number;
  epWorldSize: number;
  enableEp: boolean;
  engramCpuOffload: boolean;
  engramDpSharedMemoryDerived: boolean;
  useV2ModelRunner: boolean;
  userSpecifiedUseV2ModelRunner?: boolean;
  gpuMemoryUtilization: number;
  cudagraphMode: CudaGraphMode;
  enforceEager: boolean;
  oomStatus: KvOomStatus;
  headroomStatus: HeadroomStatus;
  hasMla: boolean;
  hasCsa2: boolean;
  hasKda: boolean;
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
    pcpSize,
    dcpSize,
    epWorldSize,
    enableEp,
    engramCpuOffload,
    engramDpSharedMemoryDerived,
    useV2ModelRunner,
    userSpecifiedUseV2ModelRunner,
    gpuMemoryUtilization,
    cudagraphMode,
    enforceEager,
    oomStatus,
    headroomStatus,
    hasMla,
    hasCsa2,
    hasKda: _hasKda,
  } = params;

  const blockers: DeployPlanFinding[] = [];
  const silentRewrites: SilentRewriteItem[] = [];
  const warnings: DeployPlanFinding[] = [];
  const firstAttn = spec.layers[0]!.attention;
  const fullAttn = spec.layers.find((l) => l.attention.kind !== "linear_kda")?.attention ?? firstAttn;
  const moe = getMoeInfo(spec);

  // 1. 310P BF16 blocker & main MRV1-removed blocker
  if (version !== "v0.30.0" && userSpecifiedUseV2ModelRunner && !useV2ModelRunner) {
    blockers.push({
      id: "calc-main-mrv1-removed",
      severity: "error",
      title: "main 基线已移除 Model Runner V1（禁止显式设 VLLM_USE_V2_MODEL_RUNNER=0）",
      message:
        "vllm-ascend@main (mrv2_utils.py) 已物理移除 Model Runner V1，显式传入 VLLM_USE_V2_MODEL_RUNNER=0 会直接抛出 ValueError: Model Runner V1 has been removed from vllm-ascend, so VLLM_USE_V2_MODEL_RUNNER=0 cannot be honored。",
      remediation: "移除 VLLM_USE_V2_MODEL_RUNNER=0（恢复默认自动启用 MRV2），或切换回 v0.30.0 基线。",
      sources: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/mrv2_utils.py#L28-L82`,
        "wiki:model-runner-v2",
      ],
    });
  }
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
  if (kvCacheDtype === "int8" && !hasModelSlimWeights && !hasMla) {
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

  // 4. MXFP8 KV hardware & MLA/DSA attention check
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
  if (kvCacheDtype === "mxfp8" && hasMla) {
    if (hasCsa2) {
      blockers.push({
        id: "calc-mxfp8-kv-unsupported-dsa",
        severity: "error",
        title: "DSA / CSA2 稀疏 MLA 不支持 MXFP8 KV Cache",
        message:
          "vllm-ascend 的 C8-MXFP (33/32 B/elem) 仅限非 MLA 全注意力 (FullAttentionSpec)；DSA 后端的 supported_kv_cache_dtypes 明确排除 mxfp8，因此本账本不按 33/32 B 计价（仍按模型 dtype 2 B/elem 估算）。",
        remediation: "将 KV 精度切换为 auto / bfloat16，或按 DSA 硬件能力选用 fp8 (A5) / int8 (A3)。",
        sources: [
          `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/model_runner_v1.py#L4699-L4700`,
          `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/attention/dsa_v1.py#L252-L282`,
          "wiki:kv-cache-quantization",
        ],
      });
    } else {
      silentRewrites.push({
        id: "calc-mxfp8-kv-mla-fallback",
        title: "MXFP8 (C8_MXFP) 仅适用非 MLA 全注意力，MLA 潜向量 KV 回退模型 dtype",
        param: "kv_cache_dtype",
        fromValue: "mxfp8",
        toValue: `${card.family === "310P" ? "float16" : "bfloat16"} (2 B/elem)`,
        message:
          "model_runner_v1.py 仅对 FullAttentionSpec 启用 C8-MXFP (33/32 B/elem)，MLA 潜向量不满足该分支，mla_v1.py 会回退到 model_config.dtype (2 B/elem)；本账本已按 2 B/elem 计价。",
        sources: [
          `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/model_runner_v1.py#L4699-L4700`,
          `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/attention/mla_v1.py#L1044-L1049`,
          "wiki:kv-cache-quantization",
          "wiki:mla",
        ],
      });
    }
  }

  // 5. TP / CP (PCP+DCP) topology legality & Wave 4 MLA/CSA2/KDA/Engram architecture checks
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
  if (!hasMla && fullAttn.kind !== "linear_kda") {
    const kvHeadValid =
      fullAttn.numKvHeads >= tpSize ? fullAttn.numKvHeads % tpSize === 0 : tpSize % fullAttn.numKvHeads === 0;
    if (!kvHeadValid) {
      blockers.push({
        id: "calc-tp-kv-heads-indivisible",
        severity: "error",
        title: "KV 头数与 TP 无法对齐",
        message: `num_key_value_heads=${fullAttn.numKvHeads} 与 TP=${tpSize} 既不整除也不能按整数倍复制。`,
        remediation: "调整 TP 使其整除 KV 头数或为 KV 头数的整数倍。",
        sources: ["wiki:tensor-parallel"],
      });
    }
  }

  // Shared Domain 4 CP / DCP / PCP topology legality rules (d4-pcp-requires-mrv2, d4-pcp-dcp-sizing & d4-pcp-full-cudagraph-unsupported)
  const cpMatches = evaluateCpTopologyRules(
    {
      hardwareFamily: card.family,
      tpSize,
      pcpSize,
      dcpSize,
      useV2ModelRunner,
      cudagraphMode,
      useMla: hasMla,
      sfaDcpReplicatedIndexer: hasCsa2 && hasMla && dcpSize > 1,
      ...(fullAttn.kind !== "linear_kda"
        ? {
            numAttentionHeads: fullAttn.numHeads,
            numKvHeads: fullAttn.numKvHeads,
          }
        : {}),
    },
    version,
  );
  for (const m of cpMatches) {
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

  if (hasMla && tpSize > 1 && dcpSize === 1) {
    const mlaLayer = spec.layers.find((l) => l.attention.kvLoraRank !== undefined)?.attention ?? firstAttn;
    const kvLora = mlaLayer.kvLoraRank ?? 512;
    const qkRope = mlaLayer.qkRopeHeadDim ?? 64;
    warnings.push({
      id: "calc-mla-tp-kv-replicated",
      severity: "warn",
      title: `MLA 潜向量 KV 在 TP=${tpSize} 下全量复制（TP 无法切分单潜向量头）`,
      message:
        `MLA 将 KV 压缩为单一共享潜向量头（num_kv_heads_effective=1，每层每 token 占 (${kvLora}+${qkRope}) 维），` +
        `因此 TP=${tpSize} 不能分摊潜向量 KV 显存，每张 TP 卡均保存 1 份完整潜向量副本；如需沿序列轴切分请启用 DCP>1（--decode-context-parallel-size）。`,
      remediation: "超长上下文场景可启用 DCP=2/4 沿序列轴切分潜向量 KV，或配合 DP+EP 扩展并发。",
      sources: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/attention/mla_v1.py#L126-L154`,
        "wiki:mla",
      ],
    });
  }
  if (hasCsa2 && card.family === "310P") {
    warnings.push({
      id: "calc-csa2-310p-caution",
      severity: "warn",
      title: "CSA2 / SFA 稀疏注意力主要面向 Atlas A2/A3/A5",
      message:
        "310P 缺少 SparseFlashMla / npu_mla_prolog_v3 稀疏融合算子，建议在 Atlas A2/A3/950 上部署 CSA2/DSA 模型。",
      sources: ["wiki:sparse-attention"],
    });
  }
  if (engramDpSharedMemoryDerived) {
    const isV030 = version === "v0.30.0";
    silentRewrites.push({
      id: "calc-engram-mrv2-auto-dp-shared",
      title: "昇腾 MRV2 自动启用 Engram 节点内共享（dp_shared_memory=true）",
      param: "engram_config.dp_shared_memory",
      fromValue: "false",
      toValue: "true",
      message: !isV030
        ? `AscendConfig.derive_and_validate 在 MRV2 + cpu_offload=true 且 DP×PCP=${dpSize * pcpSize} > 1 时自动置 dp_shared_memory=True，同机共享 1 份 Host DRAM 表。`
        : engramCpuOffload
          ? `v0.30.0 的 AscendConfig.derive_and_validate 在 MRV2 且 DP×PCP=${dpSize * pcpSize} > 1 时自动置 dp_shared_memory=True，同机共享 1 份 Host DRAM 表。`
          : `v0.30.0 的 AscendConfig.derive_and_validate 未检查 cpu_offload，在 MRV2 且 DP×PCP=${dpSize * pcpSize} > 1 时仍自动把 dp_shared_memory 改写为 True，随后触发 cpu_offload=True 校验冲突（main 已补齐 cpu_offload 前提）。`,
      sources: [
        !isV030
          ? `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L810-L818`
          : `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L681-L689`,
        "wiki:engram-conditional-memory",
      ],
    });
  }
  const effectiveQ1EngramDpShared = Boolean(
    spec.engram?.enabled && (spec.engram.dpSharedMemory || engramDpSharedMemoryDerived),
  );
  if (effectiveQ1EngramDpShared && !engramCpuOffload) {
    const v030WouldAutoDerive = version === "v0.30.0" && useV2ModelRunner && (dpSize > 1 || pcpSize > 1);
    const explicitlyRequestedShare = Boolean(spec.engram?.dpSharedMemory);
    blockers.push({
      id: "calc-engram-dp-shared-requires-cpu-offload",
      severity: "error",
      title: "engram_dp_shared_memory=true 必须同时开启 engram_cpu_offload=true",
      message: engramDpSharedMemoryDerived
        ? "v0.30.0 在 MRV2 + DP/PCP>1 下未检查 cpu_offload 即把 dp_shared_memory 改写为 True，与 EngramConfig 的 dp_shared_memory requires cpu_offload=True 校验冲突报错阻断（main@8d6180e2 已修复该推导条件）。"
        : "vllm/config/engram.py 与 embedding.py 校验：dp_shared_memory 通过 /dev/shm 在同节点共享 Host DRAM 词表，禁止在 cpu_offload=false（NPU HBM 常驻）时启用。",
      remediation: v030WouldAutoDerive
        ? explicitlyRequestedShare
          ? pcpSize > 1
            ? "开启 engram_cpu_offload=true，或切至 main 基线并同时将 engram_dp_shared_memory 设为 false（PCP>1 强制要求 MRV2，v0.30.0 下仅关闭 dp_shared_memory 仍会被自动改回 true）。"
            : "开启 engram_cpu_offload=true，或同时将 engram_dp_shared_memory 设为 false 并关闭 MRV2（或切至 main 基线，v0.30.0 在 MRV2+DP>1 下仅关闭 dp_shared_memory 仍会被自动改回 true）。"
          : pcpSize > 1
            ? "开启 engram_cpu_offload=true，或切至 main 基线（PCP>1 强制要求 MRV2，v0.30.0 下关闭 dp_shared_memory 仍会被自动改回 true）。"
            : "开启 engram_cpu_offload=true，或关闭 MRV2（VLLM_USE_V2_MODEL_RUNNER=0）/ 切至 main 基线（v0.30.0 在 MRV2+DP>1 下关闭 dp_shared_memory 仍会被自动改回 true）。"
        : "开启 engram_cpu_offload=true，或关闭 engram_dp_shared_memory。",
      sources: [
        `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/engram.py#L51-L86`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L681-L689`,
        "wiki:engram-conditional-memory",
      ],
    });
  } else if (spec.engram?.enabled && spec.engram.dpSharedMemory && dpSize * pcpSize <= 1) {
    blockers.push({
      id: "calc-engram-dp-shared-mem-dp1",
      severity: "error",
      title: "engram_dp_shared_memory=true 禁止单成员共享组（DP×PCP=1）",
      message:
        "vllm/config/engram.py 与 embedding.py 校验：显式启用 dp_shared_memory 时要求共享组大小 DP×PCP > 1，单成员共享组启动期直接报错阻断。",
      remediation: "将 DP 或 PCP 调整为 2 或更大，或关闭 engram_dp_shared_memory。",
      sources: [
        `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/engram.py#L51-L86`,
        "wiki:engram-conditional-memory",
      ],
    });
  }

  // 6. MoE / 310P / OOM / Headroom checks
  if (moe.isMoe && !enableEp) {
    const expertSliceDiv = tpSize * dpSize * pcpSize;
    const badMoeLayer = spec.layers.find(
      (l) => l.mlp.kind === "moe" && l.mlp.moeIntermediate % expertSliceDiv !== 0,
    );
    if (badMoeLayer && badMoeLayer.mlp.kind === "moe") {
      blockers.push({
        id: "calc-moe-no-ep-intermediate-indivisible",
        severity: "error",
        title: "MoE 关闭 EP 时 moe_intermediate_size 无法被 TP×DP×PCP 整除",
        message: `EP=off 时 FusedMoEConfig 将专家按 TP×DP×PCP = ${tpSize}×${dpSize}×${pcpSize} = ${expertSliceDiv} 展平切分，层 ${badMoeLayer.index} 的 moe_intermediate_size=${badMoeLayer.mlp.moeIntermediate} 无法整除（${(badMoeLayer.mlp.moeIntermediate / expertSliceDiv).toFixed(2)}），启动期断言报错。`,
        remediation: `调整 TP/DP/PCP 使乘积整除 ${badMoeLayer.mlp.moeIntermediate}，或开启 --enable-expert-parallel。`,
        sources: ["wiki:expert-parallel", "wiki:moe"],
      });
    }
  }
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

export interface DoctorModelTraitOverride {
  isMoe?: boolean;
  useMla?: boolean;
  sfaDcpReplicatedIndexer?: boolean;
  numExperts?: number;
  numExpertsPerTok?: number;
  numAttentionHeads?: number;
  numKvHeads?: number;
  headDim?: number;
}

export function extractDoctorModelTraitsFromSpec(spec: ModelSpec): DoctorModelTraitOverride {
  const moe = getMoeInfo(spec);
  const fullAttn =
    spec.layers.find((l) => l.attention.kind !== "linear_kda")?.attention ?? spec.layers[0]?.attention;
  const hasMla = spec.layers.some(
    (l) => l.attention.kind === "mla" || (l.attention.kind === "dsa" && l.attention.kvLoraRank !== undefined),
  );
  return {
    isMoe: moe.isMoe,
    useMla: hasMla,
    ...(moe.isMoe ? { numExperts: moe.numExperts, numExpertsPerTok: moe.topK } : {}),
    ...(fullAttn
      ? {
          numAttentionHeads: fullAttn.numHeads,
          numKvHeads: fullAttn.numKvHeads,
          headDim: fullAttn.headDim,
        }
      : {}),
  };
}

export function resolveDoctorModelTraits(
  modelId?: string,
  override?: { [K in keyof DoctorModelTraitOverride]?: DoctorModelTraitOverride[K] | undefined },
): DoctorModelTraitOverride | undefined {
  let base: DoctorModelTraitOverride | undefined;
  const trimmed = modelId?.trim();
  if (trimmed && trimmed.toLowerCase() !== "auto") {
    const gate = evaluateWave3ModelGate(trimmed);
    if (gate.ok && gate.supportedInWave3) {
      base = extractDoctorModelTraitsFromSpec(gate.spec);
    }
  }
  const merged: Record<string, unknown> = {};
  if (base) {
    for (const [k, v] of Object.entries(base)) {
      if (v !== undefined) merged[k] = v;
    }
  }
  if (override) {
    for (const [k, v] of Object.entries(override)) {
      if (v !== undefined) merged[k] = v;
    }
  }
  return Object.keys(merged).length > 0 ? (merged as DoctorModelTraitOverride) : undefined;
}

function selectRecommendedPrecision(params: {
  card: AscendCalcCardSpec;
  isMoe: boolean;
  weightPrecision: WeightPrecision;
  minCards: MinCardsRecommendation;
}): WeightPrecision {
  const { card, isMoe, weightPrecision, minCards } = params;
  const isUnsolvable =
    minCards.unsolvable ||
    minCards.minCards === null ||
    minCards.recommendedTp === null ||
    minCards.recommendedPp === null;
  return card.family === "310P"
    ? weightPrecision === "fp16" || weightPrecision === "w8a8sc_310p"
      ? weightPrecision
      : "w8a8sc_310p"
    : card.family === "A5" && weightPrecision === "fp8_block"
      ? "fp8_block"
      : isMoe &&
          (weightPrecision === "bf16" || weightPrecision === "fp8_block") &&
          (isUnsolvable || minCards.minCards! >= 4)
        ? "w8a8_dynamic"
        : weightPrecision === "fp8_block"
          ? "bf16"
          : weightPrecision;
}

function formatUtilCliValue(u: number): string {
  const fixed2 = Number(u.toFixed(2));
  return Math.abs(u - fixed2) < 1e-9 ? u.toFixed(2) : String(Number(u.toFixed(4)));
}

function quoteCliModelArg(name: string): string {
  return /[\s'"()\\]/.test(name) ? `'${name.replace(/'/g, "'\\''")}'` : name;
}

function buildServeCliCommand(params: {
  modelName: string;
  cardFamily: AscendFamily;
  tpSize: number;
  ppSize: number;
  dpSize: number;
  dpLocalSize?: number | undefined;
  pcpSize: number;
  dcpSize: number;
  enableEp: boolean;
  weightPrecision: WeightPrecision;
  kvCacheDtype: KvCacheDtype;
  weightNzMode: 0 | 1 | 2;
  useV2ModelRunner: boolean;
  userSpecifiedUseV2ModelRunner: boolean;
  repairForRecommendation?: boolean;
  requestedBlockSize: number;
  userSpecifiedBlockSize: boolean;
  maxModelLen: number;
  userSpecifiedMaxModelLen: boolean;
  specMaxPosition: number;
  maxNumBatchedTokens: number;
  maxNumSeqs: number;
  gpuMemoryUtilizationStr: string;
  enforceEager: boolean;
  cudagraphMode: CudaGraphMode;
}): string {
  const {
    modelName,
    cardFamily,
    tpSize,
    ppSize,
    dpSize,
    dpLocalSize,
    pcpSize,
    dcpSize,
    enableEp,
    weightPrecision,
    kvCacheDtype,
    weightNzMode,
    useV2ModelRunner,
    userSpecifiedUseV2ModelRunner,
    repairForRecommendation = false,
    requestedBlockSize,
    userSpecifiedBlockSize,
    maxModelLen,
    userSpecifiedMaxModelLen,
    specMaxPosition,
    maxNumBatchedTokens,
    maxNumSeqs,
    gpuMemoryUtilizationStr,
    enforceEager,
    cudagraphMode,
  } = params;
  const defaultGraphMode: CudaGraphMode = cardFamily === "310P" ? "NONE" : "PIECEWISE";
  const graphFlag =
    enforceEager || (cudagraphMode === "NONE" && cardFamily !== "310P")
      ? "--enforce-eager"
      : cudagraphMode !== defaultGraphMode && cudagraphMode !== "NONE"
        ? `--compilation-config '{"cudagraph_mode":"${cudagraphMode}"}'`
        : "";
  const v2EnvFlag = repairForRecommendation
    ? pcpSize > 1 || useV2ModelRunner
      ? "VLLM_USE_V2_MODEL_RUNNER=1"
      : userSpecifiedUseV2ModelRunner
        ? "VLLM_USE_V2_MODEL_RUNNER=0"
        : ""
    : userSpecifiedUseV2ModelRunner
      ? useV2ModelRunner
        ? "VLLM_USE_V2_MODEL_RUNNER=1"
        : "VLLM_USE_V2_MODEL_RUNNER=0"
      : "";
  const dtypeFlag =
    weightPrecision === "bf16"
      ? repairForRecommendation && cardFamily === "310P"
        ? "--dtype float16"
        : "--dtype bfloat16"
      : cardFamily === "310P" || weightPrecision === "fp16"
        ? "--dtype float16"
        : "";
  const nzFlag =
    weightNzMode === 0 || weightNzMode === 2
      ? `--additional-config '{"weight_nz_mode":${weightNzMode}}'`
      : "";
  return [
    v2EnvFlag,
    `vllm serve ${quoteCliModelArg(modelName)}`,
    `-tp ${tpSize}`,
    ppSize > 1 ? `-pp ${ppSize}` : "",
    dpSize > 1 ? `-dp ${dpSize}` : "",
    dpSize > 1 &&
    dpLocalSize !== undefined &&
    dpLocalSize >= 1 &&
    dpLocalSize < dpSize &&
    dpSize % dpLocalSize === 0
      ? `--data-parallel-size-local ${dpLocalSize}`
      : "",
    pcpSize > 1 ? `--prefill-context-parallel-size ${pcpSize}` : "",
    dcpSize > 1 ? `--decode-context-parallel-size ${dcpSize}` : "",
    enableEp ? "--enable-expert-parallel" : "",
    dtypeFlag,
    weightPrecision === "w8a8_dynamic" ||
    weightPrecision === "w8a8" ||
    weightPrecision === "w4a8" ||
    weightPrecision === "w8a8sc_310p"
      ? "--quantization ascend"
      : "",
    kvCacheDtype !== "auto" ? `--kv-cache-dtype ${kvCacheDtype}` : "",
    nzFlag,
    userSpecifiedBlockSize ? `--block-size ${requestedBlockSize}` : "",
    userSpecifiedMaxModelLen || maxModelLen !== specMaxPosition ? `--max-model-len ${maxModelLen}` : "",
    maxNumBatchedTokens !== DEFAULT_MAX_NUM_BATCHED_TOKENS
      ? `--max-num-batched-tokens ${maxNumBatchedTokens}`
      : "",
    maxNumSeqs !== DEFAULT_MAX_NUM_SEQS ? `--max-num-seqs ${maxNumSeqs}` : "",
    graphFlag,
    `--gpu-memory-utilization ${gpuMemoryUtilizationStr}`,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Build a complete `vllm serve` CLI replaying the exact currently evaluated plan verbatim (never silently repairing user mistakes). */
export function buildCurrentPlanCliHint(plan: DeployPlanReport): string {
  const s = plan.inputSummary;
  return buildServeCliCommand({
    modelName: plan.spec.name,
    cardFamily: plan.card.family,
    tpSize: s.tpSize,
    ppSize: s.ppSize,
    dpSize: s.dpSize,
    dpLocalSize: s.dpLocalSize,
    pcpSize: s.pcpSize,
    dcpSize: s.dcpSize,
    enableEp: s.requestedEnableEp ?? s.enableEp,
    weightPrecision: s.weightPrecision,
    kvCacheDtype: s.kvCacheDtype,
    weightNzMode: s.weightNzMode,
    useV2ModelRunner: Boolean(s.useV2ModelRunner),
    userSpecifiedUseV2ModelRunner: Boolean(s.userSpecifiedUseV2ModelRunner),
    repairForRecommendation: false,
    requestedBlockSize: s.requestedBlockSize,
    userSpecifiedBlockSize: Boolean(s.userSpecifiedBlockSize),
    maxModelLen: s.maxModelLen,
    userSpecifiedMaxModelLen: true,
    specMaxPosition: plan.spec.maxPosition,
    maxNumBatchedTokens: s.maxNumBatchedTokens,
    maxNumSeqs: s.maxNumSeqs,
    gpuMemoryUtilizationStr: formatUtilCliValue(s.gpuMemoryUtilization),
    enforceEager: s.enforceEager,
    cudagraphMode: s.cudagraphMode,
  });
}

function buildRecommendation(params: {
  spec: ModelSpec;
  card: AscendCalcCardSpec;
  isMoe: boolean;
  hasMla: boolean;
  hasCsa2: boolean;
  hasKda: boolean;
  hasEngram: boolean;
  minCards: MinCardsRecommendation;
  recPrec: WeightPrecision;
  weightPrecision: WeightPrecision;
  kvCacheDtype: KvCacheDtype;
  weightNzMode: 0 | 1 | 2;
  useV2ModelRunner: boolean;
  userSpecifiedUseV2ModelRunner: boolean;
  requestedBlockSize: number;
  userSpecifiedBlockSize: boolean;
  maxModelLen: number;
  userSpecifiedMaxModelLen: boolean;
  maxNumBatchedTokens: number;
  maxNumSeqs: number;
  tpSize: number;
  ppSize: number;
  dpSize: number;
  pcpSize: number;
  dcpSize: number;
  worldSize: number;
  gpuMemoryUtilization: number;
  canUseRecommendedUtil: (util: number, precision: WeightPrecision) => boolean;
  enforceEager: boolean;
  cudagraphMode: CudaGraphMode;
}): FourQuestionsReport["q4Recommendation"] {
  const {
    spec,
    card,
    isMoe,
    hasMla,
    hasCsa2,
    hasKda,
    hasEngram,
    minCards,
    recPrec,
    weightPrecision,
    kvCacheDtype,
    weightNzMode,
    useV2ModelRunner,
    userSpecifiedUseV2ModelRunner,
    requestedBlockSize,
    userSpecifiedBlockSize,
    maxModelLen,
    userSpecifiedMaxModelLen,
    maxNumBatchedTokens,
    maxNumSeqs,
    tpSize,
    ppSize,
    dpSize,
    pcpSize,
    dcpSize,
    worldSize,
    gpuMemoryUtilization,
    canUseRecommendedUtil,
    enforceEager,
    cudagraphMode,
  } = params;
  const isUnsolvable =
    minCards.unsolvable ||
    minCards.minCards === null ||
    minCards.recommendedTp === null ||
    minCards.recommendedPp === null;

  const defaultRecUtil = card.family === "310P" ? 0.85 : isMoe ? 0.9 : 0.92;
  let recUtil = defaultRecUtil;
  if (!isUnsolvable && !canUseRecommendedUtil(defaultRecUtil, recPrec)) {
    const candidates = [
      Number(gpuMemoryUtilization.toFixed(2)),
      Number(gpuMemoryUtilization.toFixed(3)),
      Number(gpuMemoryUtilization.toFixed(4)),
      Math.min(0.99, Math.ceil(gpuMemoryUtilization * 10000) / 10000),
    ];
    recUtil =
      candidates.find((c) => canUseRecommendedUtil(c, recPrec)) ?? Number(gpuMemoryUtilization.toFixed(4));
  }
  const recUtilStr = formatUtilCliValue(recUtil);
  const recTp = minCards.recommendedTp;
  const recPp = minCards.recommendedPp;
  const recDp = minCards.recommendedDp;
  const recPcp = minCards.recommendedPcp;
  const recDcp = minCards.recommendedDcp;
  const cliHint = isUnsolvable
    ? ""
    : buildServeCliCommand({
        modelName: spec.name,
        cardFamily: card.family,
        tpSize: recTp!,
        ppSize: recPp!,
        dpSize: recDp ?? 1,
        pcpSize: recPcp ?? 1,
        dcpSize: recDcp ?? 1,
        enableEp: minCards.recommendedEnableEp,
        weightPrecision: recPrec,
        kvCacheDtype,
        weightNzMode,
        useV2ModelRunner,
        userSpecifiedUseV2ModelRunner,
        repairForRecommendation: true,
        requestedBlockSize:
          kvCacheDtype === "mxfp8" && requestedBlockSize % 512 !== 0 ? 512 : requestedBlockSize,
        userSpecifiedBlockSize:
          kvCacheDtype === "mxfp8" && requestedBlockSize % 512 !== 0 ? false : userSpecifiedBlockSize,
        maxModelLen,
        userSpecifiedMaxModelLen,
        specMaxPosition: spec.maxPosition,
        maxNumBatchedTokens,
        maxNumSeqs,
        gpuMemoryUtilizationStr: recUtilStr,
        enforceEager,
        cudagraphMode,
      });

  const physCards = isUnsolvable ? null : Math.ceil(minCards.minCards! / card.diesPerPhysicalCard);
  const rationale = isUnsolvable
    ? `在 ${card.shortName} 上遍历 1–64 逻辑设备内的全部合法并行组合均无法同时满足当前 max_model_len 与 max_num_seqs 固定状态/分页预算，故停止输出推荐卡数与启动命令；请降低 max_num_seqs / max_model_len、启用权重量化或更换大显存卡型。`
    : `在 ${card.shortName} 上建议起步 ${minCards.minCards} 逻辑设备（${physCards} 张物理卡，TP=${recTp}` +
      `${recPp! > 1 ? `, PP=${recPp}` : ""}` +
      `${recDp !== null && recDp > 1 ? `, DP=${recDp}` : ""}` +
      `${recPcp !== null && recPcp > 1 ? `, PCP=${recPcp}` : ""}` +
      `${recDcp !== null && recDcp > 1 ? `, DCP=${recDcp}` : ""}` +
      `${minCards.recommendedEnableEp ? ", 开启 EP" : ""}），精度优先 ${recPrec}，预算比例 ${recUtilStr}。`;

  return {
    feasible: minCards.feasible,
    unsolvable: isUnsolvable,
    recommendedTp: recTp,
    recommendedPp: recPp,
    recommendedDp: recDp,
    recommendedPcp: recPcp,
    recommendedDcp: recDcp,
    recommendedEnableEp: minCards.recommendedEnableEp,
    recommendedPrecision: recPrec,
    recommendedGpuMemoryUtilization: recUtil,
    cliHint,
    rationale,
    relatedWikiIds: buildRelatedWikiIds({
      card,
      isMoe,
      hasMla,
      hasCsa2,
      hasKda,
      hasEngram,
      weightPrecision,
      kvCacheDtype,
      tpSize,
      ppSize,
      dpSize,
      pcpSize,
      dcpSize,
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

  const weightPrecision: WeightPrecision = input.weightPrecision ?? "bf16";
  const kvCacheDtype: KvCacheDtype = input.kvCacheDtype ?? "auto";
  const requestedBlockSize = Math.max(16, Math.round(input.blockSize ?? DEFAULT_BLOCK_SIZE));
  const userSpecifiedBlockSize =
    input.userSpecifiedBlockSize ?? (input.blockSize !== undefined && input.blockSize !== DEFAULT_BLOCK_SIZE);
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
  const maxRanksPerNode = getCardMaxRanksPerNode(card.id);
  const rawDpLocal =
    input.dpLocalSize !== undefined && Number.isSafeInteger(input.dpLocalSize)
      ? input.dpLocalSize
      : undefined;
  const dpLocalSize =
    rawDpLocal !== undefined &&
    rawDpLocal >= 1 &&
    rawDpLocal <= dpSize &&
    dpSize % rawDpLocal === 0 &&
    rawDpLocal * tpSize * ppSize * pcpSize <= maxRanksPerNode
      ? rawDpLocal
      : undefined;

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
  const numSpecTokens = Math.max(0, Math.round(input.numSpecTokens ?? 0));
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

  const activeWave4Features = extractWave4FeaturesFromSpec(spec);
  const hasMla = activeWave4Features.includes("MLA");
  const hasCsa2 = activeWave4Features.includes("CSA2");
  const hasKda = activeWave4Features.includes("KDA");
  const hasEngram = activeWave4Features.includes("Engram");
  const engramCpuOffload = spec.engram?.enabled
    ? (input.engramCpuOffload ?? spec.engram.cpuOffload ?? true)
    : false;
  // AscendConfig.derive_and_validate: main@8d6180e2 checks cpu_offload=true; v0.30.0@c09d3e20 derives dp_shared_memory=True whenever MRV2 & (DP>1 || PCP>1)
  // Note: platform.py#L1650-L1657 does NOT implicitly enable MRV2 for PCP>1; PCP>1 without useV2ModelRunner triggers d4-pcp-requires-mrv2.
  const rawUseV2ModelRunner = input.useV2ModelRunner ?? input.enableModelRunnerV2;
  const userSpecifiedUseV2ModelRunner = rawUseV2ModelRunner !== undefined;
  const useV2ModelRunner = rawUseV2ModelRunner ?? version !== "v0.30.0";
  const engramDpSharedMemoryDerived = shouldAutoDeriveEngramDpSharedMemory({
    spec,
    version,
    engramCpuOffload,
    useV2ModelRunner,
    dpSize,
    pcpSize,
  });
  const effectiveEngramDpSharedMemory = spec.engram?.enabled
    ? spec.engram.dpSharedMemory || engramDpSharedMemoryDerived
    : false;

  // C8-MXFP (33/32 B/elem) is restricted to non-MLA FullAttentionSpec; MLA falls back to model dtype (2 B/elem)
  const kvElemBytes = kvCacheDtype === "auto" ? 2 : kvCacheDtype === "int8" ? 1 : hasMla ? 2 : 33 / 32;

  // Stage 1 & 2
  const totalHbmBytes = card.hbmGiB * GIB;
  const requestedBytes = Math.floor(totalHbmBytes * gpuMemoryUtilization);
  const unbudgetedHeadroomBytes = totalHbmBytes - requestedBytes;

  // Stage 3 & Stage 6 bottleneck contiguous PP stage evaluation (ensures weights & KV come from the same PP stage)
  const bottleneckPp = selectBottleneckPpStage({
    spec,
    card,
    version,
    weightPrecision,
    weightNzMode,
    tpSize,
    ppSize,
    dpSize,
    pcpSize,
    dcpSize,
    epWorldSize,
    enableEp,
    engramCpuOffload,
    engramDpSharedMemory: effectiveEngramDpSharedMemory,
    kvElemBytes,
    effectiveBlockSize,
    maxModelLen,
    maxNumSeqs,
    numSpecTokens,
  });
  const w = bottleneckPp.w;
  const kvState = bottleneckPp.kvState;
  const localLayersPerRank = bottleneckPp.stage.layers.length;
  const localKvHeadsPerRank = kvState.localKvHeadsPerRank;

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
      ...(spec.engram?.enabled
        ? {
            engramEnabled: true,
            engramDpSharedMemory: engramCpuOffload && effectiveEngramDpSharedMemory,
            etpSize: w.engramEtpSize,
          }
        : {}),
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
  if (spec.engram?.enabled) {
    nonTorch.notes.push(
      engramCpuOffload && effectiveEngramDpSharedMemory
        ? `Engram 通信域（engram_dp_shared_memory=true${engramDpSharedMemoryDerived ? "，MRV2 自动推导" : ""}）：etp 建 HCCL 域（ETP=${w.engramEtpSize}），edp 走 Gloo + /dev/shm 共享内存，不额外消耗 HCCL edp 缓冲。`
        : effectiveEngramDpSharedMemory
          ? `Engram 通信域（dp_shared_memory=true 与 cpu_offload=false 校验冲突，未进入 /dev/shm Gloo 共享）：按未卸载状态将 etp (ETP=${w.engramEtpSize}) 与 edp 纳入 hcclAccounting 去重核算。`
          : `Engram 通信域（engram_dp_shared_memory=false）：已将 etp (ETP=${w.engramEtpSize}) 与 edp 纳入 hcclAccounting 去重核算。`,
    );
  }

  // Stage 6: KV cache pool (+ KDA fixed recurrent state reservation)
  // Evaluate every PP stage independently so heterogeneous PP takes min concurrency & worst OOM status across all stages
  const scaleKv = (v: number): number =>
    v <= 0 ? 0 : card.halvesKvForWorkspace ? Math.floor(v / 2) : Math.floor(v);
  // Under DCP > 1, each physical block on a rank holds effectiveBlockSize local main-KV slots,
  // while 1 virtual block spans effectiveBlockSize * dcpSize global tokens (block_table.py#L251-L275).
  const virtualBlockTokens = effectiveBlockSize * dcpSize;
  const oomSeverityRank: Record<KvOomStatus, number> = {
    fits: 0,
    tight_budget_oom_risk: 1,
    insufficient_for_single_max_len_seq: 2,
    non_kv_exceeds_budget: 3,
    weights_plus_activation_exceed_budget: 4,
    weights_exceed_budget: 5,
  };

  const evaluateStageCapacity = (stageW: WeightBreakdownResult, stageKv: PerRankKvAndStateResult) => {
    const sRawKvLow = requestedBytes - (stageW.highBytes + act.highBytes + nonTorch.highBytes);
    const sRawKvPoint = requestedBytes - (stageW.pointBytes + act.pointBytes + nonTorch.pointBytes);
    const sRawKvHigh = requestedBytes - (stageW.lowBytes + act.lowBytes + nonTorch.lowBytes);
    const sKvPoolLow = scaleKv(sRawKvLow);
    const sKvPoolPoint = scaleKv(sRawKvPoint);
    const sKvPoolHigh = scaleKv(sRawKvHigh);
    const sKvBytesPerBlock = Math.round(
      stageKv.localMainKvBytesPerSlot * effectiveBlockSize +
        stageKv.perTokenIndexerKvBytes * virtualBlockTokens,
    );
    const sPagedLow = Math.max(0, sKvPoolLow - stageKv.totalFixedLinearStateBytes);
    const sPagedPoint = Math.max(0, sKvPoolPoint - stageKv.totalFixedLinearStateBytes);
    const sPagedHigh = Math.max(0, sKvPoolHigh - stageKv.totalFixedLinearStateBytes);
    const sRawBlocksLow = sKvBytesPerBlock > 0 ? Math.floor(sPagedLow / sKvBytesPerBlock) : 0;
    const sRawBlocksPoint = sKvBytesPerBlock > 0 ? Math.floor(sPagedPoint / sKvBytesPerBlock) : 0;
    const sRawBlocksHigh = sKvBytesPerBlock > 0 ? Math.floor(sPagedHigh / sKvBytesPerBlock) : 0;
    const sUsableLow = sKvBytesPerBlock > 0 ? Math.max(0, sRawBlocksLow - 1) : 0;
    const sUsablePoint = sKvBytesPerBlock > 0 ? Math.max(0, sRawBlocksPoint - 1) : 0;
    const sUsableHigh = sKvBytesPerBlock > 0 ? Math.max(0, sRawBlocksHigh - 1) : 0;
    const sBlocksPerMaxSeq = sKvBytesPerBlock > 0 ? Math.ceil(maxModelLen / virtualBlockTokens) : 0;

    const stageConc = (usableBlocks: number, poolBytes: number): number => {
      const pagedCap = sBlocksPerMaxSeq > 0 ? usableBlocks / sBlocksPerMaxSeq : Number.POSITIVE_INFINITY;
      const linearCap =
        stageKv.perSeqFixedLinearStateBytes > 0
          ? poolBytes / stageKv.perSeqFixedLinearStateBytes
          : Number.POSITIVE_INFINITY;
      const cap = Math.min(pagedCap, linearCap);
      return Number.isFinite(cap) ? cap : 0;
    };
    const sMaxConcLow = stageConc(sUsableLow, sKvPoolLow);
    const sMaxConcPoint = stageConc(sUsablePoint, sKvPoolPoint);
    const sMaxConcHigh = stageConc(sUsableHigh, sKvPoolHigh);

    const sMinSingleSeq =
      (sBlocksPerMaxSeq > 0 ? (sBlocksPerMaxSeq + 1) * sKvBytesPerBlock : 0) +
      Math.max(stageKv.totalFixedLinearStateBytes, stageKv.perSeqFixedLinearStateBytes);
    let sOom: KvOomStatus = "fits";
    if (stageW.lowBytes >= requestedBytes) {
      sOom = "weights_exceed_budget";
    } else if (stageW.pointBytes + act.pointBytes >= requestedBytes) {
      sOom = "weights_plus_activation_exceed_budget";
    } else if (sRawKvPoint <= 0) {
      sOom = "non_kv_exceeds_budget";
    } else if ((sBlocksPerMaxSeq > 0 && sUsablePoint < sBlocksPerMaxSeq) || sKvPoolPoint < sMinSingleSeq) {
      sOom = "insufficient_for_single_max_len_seq";
    } else if (
      sRawKvLow <= 0 ||
      (sBlocksPerMaxSeq > 0 && sUsableLow < sBlocksPerMaxSeq) ||
      sKvPoolLow < sMinSingleSeq
    ) {
      sOom = "tight_budget_oom_risk";
    }
    return {
      sKvPoolLow,
      sKvPoolPoint,
      sKvPoolHigh,
      sKvBytesPerBlock,
      sRawBlocksLow,
      sRawBlocksPoint,
      sRawBlocksHigh,
      sUsableLow,
      sUsablePoint,
      sUsableHigh,
      sBlocksPerMaxSeq,
      sMaxConcLow,
      sMaxConcPoint,
      sMaxConcHigh,
      sOom,
    };
  };

  const allStageCaps = bottleneckPp.allStages.map((st) => ({
    stage: st.stage,
    w: st.w,
    kvState: st.kvState,
    cap: evaluateStageCapacity(st.w, st.kvState),
  }));
  const ppStageSlices: PpStageCapacitySlice[] = allStageCaps.map((entry) => ({
    stageIndex: entry.stage.stageIndex,
    isBottleneck: entry.stage.stageIndex === bottleneckPp.stage.stageIndex,
    wLowBytes: entry.w.lowBytes,
    wPointBytes: entry.w.pointBytes,
    wHighBytes: entry.w.highBytes,
    kvPoolLowBytes: entry.cap.sKvPoolLow,
    kvPoolPointBytes: entry.cap.sKvPoolPoint,
    kvPoolHighBytes: entry.cap.sKvPoolHigh,
    fixedLinearStateBytes: entry.kvState.totalFixedLinearStateBytes,
    kvBytesPerBlock: entry.cap.sKvBytesPerBlock,
  }));
  const primaryCap =
    allStageCaps.find((entry) => entry.stage.stageIndex === bottleneckPp.stage.stageIndex)?.cap ??
    allStageCaps[0]!.cap;

  const kvPoolLowBytes = primaryCap.sKvPoolLow;
  const kvPoolPointBytes = primaryCap.sKvPoolPoint;
  const kvPoolHighBytes = primaryCap.sKvPoolHigh;
  const kvBytesPerTokenPerRank = kvState.perTokenPagedKvBytes;
  const perSeqFixedLinearStateBytes = kvState.perSeqFixedLinearStateBytes;
  const totalFixedLinearStateBytes = kvState.totalFixedLinearStateBytes;
  const kvBytesPerBlock = primaryCap.sKvBytesPerBlock;
  const rawBlocksLow = primaryCap.sRawBlocksLow;
  const rawBlocksHigh = primaryCap.sRawBlocksHigh;
  const usableBlocksLow = primaryCap.sUsableLow;
  const usableBlocksPoint = primaryCap.sUsablePoint;
  const usableBlocksHigh = primaryCap.sUsableHigh;
  // Heterogeneous PP: global paged KV token slots take the minimum across PP stages that actually hold paged attention
  // (ignoring pure linear-state stages whose sKvBytesPerBlock === 0).
  const pagedStageCaps = allStageCaps.filter((e) => e.cap.sKvBytesPerBlock > 0);
  const totalKvTokenSlotsLow =
    pagedStageCaps.length > 0
      ? Math.min(...pagedStageCaps.map((e) => e.cap.sUsableLow)) * virtualBlockTokens
      : 0;
  const totalKvTokenSlotsPoint =
    pagedStageCaps.length > 0
      ? Math.min(...pagedStageCaps.map((e) => e.cap.sUsablePoint)) * virtualBlockTokens
      : 0;
  const totalKvTokenSlotsHigh =
    pagedStageCaps.length > 0
      ? Math.min(...pagedStageCaps.map((e) => e.cap.sUsableHigh)) * virtualBlockTokens
      : 0;
  const blocksPerMaxSeq = primaryCap.sBlocksPerMaxSeq;

  // Whole-system full-length concurrency is capped by the tightest PP stage
  const maxConcLow = Math.min(...allStageCaps.map((e) => e.cap.sMaxConcLow));
  const maxConcPoint = Math.min(...allStageCaps.map((e) => e.cap.sMaxConcPoint));
  const maxConcHigh = Math.min(...allStageCaps.map((e) => e.cap.sMaxConcHigh));
  const concurrencyLimitingStage = allStageCaps.reduce((minEntry, cur) =>
    cur.cap.sMaxConcPoint < minEntry.cap.sMaxConcPoint ? cur : minEntry,
  );
  const oomStatus: KvOomStatus = allStageCaps.reduce<KvOomStatus>(
    (worst, cur) => (oomSeverityRank[cur.cap.sOom] > oomSeverityRank[worst] ? cur.cap.sOom : worst),
    "fits",
  );

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

  const stage6Notes: string[] = [];
  if (hasMla) {
    const mlaA = kvState.primaryFullAttn;
    const kvLora = mlaA.kvLoraRank ?? 512;
    const qkRope = mlaA.qkRopeHeadDim ?? 64;
    const vDim = mlaA.vHeadDim ?? 128;
    const equivMha = 2 * mlaA.numHeads * vDim * kvElemBytes;
    const ratio =
      kvState.latentBytesPerTokenPerLayer > 0 ? equivMha / kvState.latentBytesPerTokenPerLayer : 1;
    stage6Notes.push(
      `MLA 潜向量压缩：单层每 token = (${kvLora} + ${qkRope}) × ${kvElemBytes} B = ${kvState.latentBytesPerTokenPerLayer} B（较等效 MHA ${equivMha.toLocaleString()} B 压缩 ${ratio.toFixed(1)}×）；` +
        `单潜向量头（num_kv_heads_effective=1）在 TP=${tpSize} 下每卡全量复制，${dcpSize > 1 ? `经 DCP=${dcpSize} 沿序列轴切分后单卡均摊 ${(kvBytesPerTokenPerRank / KIB).toFixed(1)} KiB/tok` : `开启 DCP>1 方可沿序列轴切分（当前单卡 ${(kvBytesPerTokenPerRank / KIB).toFixed(1)} KiB/tok）`}。`,
    );
  }
  if (hasCsa2) {
    const dsaA = kvState.primaryFullAttn;
    stage6Notes.push(
      `CSA2/DSA 稀疏索引器缓存：除主 KV/潜向量外，每层每 token 额外保存 ${kvState.indexerBytesPerTokenPerLayer} B 索引器 k_cache（index_head_dim=${dsaA.indexHeadDim ?? 128}, index_n_heads=${dsaA.indexNumHeads ?? 64}, top-k=${dsaA.sparseTopK ?? 2048}）。`,
    );
  }
  if (hasKda) {
    stage6Notes.push(
      `KDA 混合状态拆账：每卡 ${kvState.localLinearLayerCount} 层线性注意力单状态块 ${(kvState.singleBlockFixedLinearStateBytes / MIB).toFixed(2)} MiB × ${kvState.linearStateBlocksPerSeq} 块/seq${numSpecTokens > 0 ? `（含 1 + num_spec_tokens=${numSpecTokens} 完整状态块）` : ""} = ${(perSeqFixedLinearStateBytes / MIB).toFixed(2)} MiB/seq（按 max_num_seqs=${maxNumSeqs} 预留 ${(totalFixedLinearStateBytes / GIB).toFixed(2)} GiB，与 max_model_len 无关）；仅 ${kvState.localFullAttnLayerCount} 层全注意力消耗按 token 分页 KV = ${(kvBytesPerTokenPerRank / KIB).toFixed(1)} KiB/tok。`,
    );
  }
  if (!hasMla && !hasKda) {
    stage6Notes.push(
      dcpSize > 1
        ? `每卡 2 × ${localLayersPerRank} 层 × ${localKvHeadsPerRank} 本地 KV 头 × head_dim=${kvState.primaryFullAttn.headDim} × ${kvElemBytes} B ÷ DCP(${dcpSize}) = ${(kvBytesPerTokenPerRank / KIB).toFixed(1)} KiB/全局tok；单卡物理槽 ${(kvState.localMainKvBytesPerSlot / KIB).toFixed(1)} KiB × ${effectiveBlockSize} 槽 = ${(kvBytesPerBlock / MIB).toFixed(3)} MiB/块（跨 ${virtualBlockTokens} 全局tok）。`
        : `每卡 2 × ${localLayersPerRank} 层 × ${localKvHeadsPerRank} 本地 KV 头 × head_dim=${kvState.primaryFullAttn.headDim} × ${kvElemBytes} B = ${(kvBytesPerTokenPerRank / KIB).toFixed(1)} KiB/tok；${effectiveBlockSize}-tok 块 = ${(kvBytesPerBlock / MIB).toFixed(3)} MiB。`,
    );
  }
  stage6Notes.push(
    kvBytesPerBlock > 0
      ? `可用块数区间 [${usableBlocksLow}, ${usableBlocksHigh}]（点估 ${usableBlocksPoint} 块，已扣 1 个 BlockPool null block），整机 ${maxModelLen} 上下文并发 [${maxConcLow.toFixed(2)}x, ${maxConcHigh.toFixed(2)}x]${allStageCaps.length > 1 && concurrencyLimitingStage.stage.stageIndex !== bottleneckPp.stage.stageIndex ? `（由 PP Stage ${concurrencyLimitingStage.stage.stageIndex} 封顶）` : ""}。`
      : `当前最重段无按 token 分页 KV 块，整机满长并发受全 PP 阶段取最小约束 [${maxConcLow.toFixed(2)}x, ${maxConcHigh.toFixed(2)}x]${allStageCaps.length > 1 && concurrencyLimitingStage.stage.stageIndex !== bottleneckPp.stage.stageIndex ? `（由 PP Stage ${concurrencyLimitingStage.stage.stageIndex} 分页/状态上限封顶）` : "（与上下文长度无关）"}。`,
  );
  if (card.halvesKvForWorkspace) {
    stage6Notes.push("Atlas 300I DUO (310P) 源码 worker_310p.py 将剩余预算 // 2 留作算子工作区。");
  }

  const blockBytesBreakdown =
    dcpSize > 1
      ? `全局 ${(kvBytesPerTokenPerRank / KIB).toFixed(1)} KiB/tok × ${virtualBlockTokens} 全局tok/块 = 物理 ${(kvBytesPerBlock / effectiveBlockSize / KIB).toFixed(1)} KiB/槽 × ${effectiveBlockSize} 本地槽/块，扣 1 null block`
      : `${(kvBytesPerTokenPerRank / KIB).toFixed(1)} KiB/tok × ${effectiveBlockSize} tok/块，扣 1 null block`;
  const stage6Formula =
    kvBytesPerBlock > 0
      ? `[预算 − (第3+4+5级)]${card.halvesKvForWorkspace ? " ÷ 2 (310P)" : ""}${totalFixedLinearStateBytes > 0 ? ` − 线性固定态 ${(totalFixedLinearStateBytes / GIB).toFixed(2)} GiB` : ""} ÷ ${(kvBytesPerBlock / MIB).toFixed(3)} MiB/块（${blockBytesBreakdown}）`
      : `[预算 − (第3+4+5级)] ÷ ${(perSeqFixedLinearStateBytes / MIB).toFixed(2)} MiB/seq（纯线性递推状态，0 B/tok 分页 KV）`;

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
      title: hasKda
        ? "第 6 级 · 可用 KV Cache 分页池 + KDA 固定递推状态池"
        : "第 6 级 · 可用 KV Cache 块池与物理分页切分",
      lowBytes: kvPoolLowBytes,
      highBytes: kvPoolHighBytes,
      pointEstimateBytes: kvPoolPointBytes,
      formula: stage6Formula,
      evidenceLevel: "D",
      sources: [
        `${v030Worker}#L634-L666`,
        ...(card.halvesKvForWorkspace ? [`${v030Worker310p}#L140-L153`] : []),
        ...(hasMla
          ? [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/attention/mla_v1.py#L126-L154`]
          : []),
        ...(hasCsa2
          ? [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/attention/sfa_v1.py#L870-L885`]
          : []),
        ...(hasKda
          ? [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/model_executor/layers/mamba/mamba_utils.py#L298-L321`]
          : []),
        `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/v1/core/kv_cache_utils.py#L2386-L2403`,
      ],
      notes: stage6Notes,
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
    kvState,
    tpSize,
    dpSize,
    pcpSize,
    dcpSize,
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
    pcpSize,
    dcpSize,
    epWorldSize,
    enableEp,
    engramCpuOffload,
    engramDpSharedMemoryDerived,
    useV2ModelRunner,
    userSpecifiedUseV2ModelRunner,
    gpuMemoryUtilization,
    cudagraphMode,
    enforceEager,
    oomStatus,
    headroomStatus,
    hasMla,
    hasCsa2,
    hasKda,
  });

  const q1Verdict: "pass" | "warn" | "blocked" =
    q1.blockers.length > 0
      ? "blocked"
      : q1.warnings.length > 0 || q1.silentRewrites.length > 0
        ? "warn"
        : "pass";

  const baseSearchPrecision: WeightPrecision =
    card.family === "310P" && weightPrecision === "bf16" ? "fp16" : weightPrecision;
  const minCards = recommendMinCards({
    spec,
    card,
    version,
    weightPrecision: baseSearchPrecision,
    kvCacheDtype,
    requestedBlockSize,
    userSpecifiedBlockSize,
    weightNzMode,
    kvElemBytes,
    effectiveBlockSize,
    gpuMemoryUtilization,
    maxModelLen,
    maxNumBatchedTokens,
    maxNumSeqs,
    numSpecTokens,
    engramCpuOffload,
    useV2ModelRunner: version !== "v0.30.0" ? true : useV2ModelRunner,
    cudagraphMode,
    enforceEager,
    headroomStatus,
    hasMla,
    hasCsa2,
    hasKda,
    isMoe: moe.isMoe,
    ...(oomStatus === "fits" && q1.blockers.length === 0
      ? {
          currentFeasibleTopology: {
            tpSize,
            ppSize,
            dpSize,
            pcpSize,
            dcpSize,
            enableEp,
            worldSize,
          },
        }
      : {}),
  });

  const recPrec = selectRecommendedPrecision({
    card,
    isMoe: moe.isMoe,
    weightPrecision,
    minCards,
  });

  const defaultRecUtil = card.family === "310P" ? 0.85 : moe.isMoe ? 0.9 : 0.92;
  const headroomForUtil = (u: number): HeadroomStatus => {
    const req = Math.floor(totalHbmBytes * u);
    const hr = totalHbmBytes - req;
    return stage7Low > hr ? "overflow" : stage7High > hr ? "risk" : "safe";
  };
  const runCandidateSearch = (prec: WeightPrecision, util: number): MinCardsRecommendation =>
    recommendMinCards({
      spec,
      card,
      version,
      weightPrecision: prec,
      kvCacheDtype,
      requestedBlockSize,
      userSpecifiedBlockSize,
      weightNzMode,
      kvElemBytes,
      effectiveBlockSize,
      gpuMemoryUtilization: util,
      maxModelLen,
      maxNumBatchedTokens,
      maxNumSeqs,
      numSpecTokens,
      engramCpuOffload,
      useV2ModelRunner,
      cudagraphMode,
      enforceEager,
      headroomStatus: headroomForUtil(util),
      hasMla,
      hasCsa2,
      hasKda,
      isMoe: moe.isMoe,
      ...(prec === weightPrecision &&
      Math.abs(util - gpuMemoryUtilization) < 1e-9 &&
      oomStatus === "fits" &&
      q1.blockers.length === 0
        ? {
            currentFeasibleTopology: {
              tpSize,
              ppSize,
              dpSize,
              pcpSize,
              dcpSize,
              enableEp,
              worldSize,
            },
          }
        : {}),
    });

  let q4MinCards: MinCardsRecommendation;
  if (recPrec !== baseSearchPrecision || Math.abs(gpuMemoryUtilization - defaultRecUtil) > 1e-9) {
    const candDefault =
      headroomForUtil(defaultRecUtil) !== "overflow"
        ? recPrec === baseSearchPrecision && Math.abs(gpuMemoryUtilization - defaultRecUtil) < 1e-9
          ? minCards
          : runCandidateSearch(recPrec, defaultRecUtil)
        : null;
    const candInput =
      headroomStatus !== "overflow"
        ? recPrec === baseSearchPrecision
          ? minCards
          : Math.abs(gpuMemoryUtilization - defaultRecUtil) > 1e-9
            ? runCandidateSearch(recPrec, gpuMemoryUtilization)
            : null
        : null;
    if (
      candDefault &&
      !candDefault.unsolvable &&
      candDefault.minCards !== null &&
      (!candInput ||
        candInput.unsolvable ||
        candInput.minCards === null ||
        candDefault.minCards <= candInput.minCards)
    ) {
      q4MinCards = candDefault;
    } else if (candInput && !candInput.unsolvable) {
      q4MinCards = candInput;
    } else {
      q4MinCards = candDefault ?? candInput ?? minCards;
    }
  } else {
    q4MinCards = minCards;
  }

  const canUseRecommendedUtil = (candUtil: number, candPrec: WeightPrecision): boolean => {
    if (q4MinCards.unsolvable || q4MinCards.recommendedTp === null || q4MinCards.recommendedPp === null)
      return false;
    const recTp = q4MinCards.recommendedTp;
    const recPp = q4MinCards.recommendedPp;
    const recDp = q4MinCards.recommendedDp ?? 1;
    const recPcp = q4MinCards.recommendedPcp ?? 1;
    const recDcp = q4MinCards.recommendedDcp ?? 1;
    const recEnableEp = q4MinCards.recommendedEnableEp;
    const recEpWorld = recEnableEp ? recDp * recTp * recPcp : 1;
    const recWorld = recTp * recPp * recDp * recPcp;
    const candRequested = Math.floor(totalHbmBytes * candUtil);
    const candHeadroom = totalHbmBytes - candRequested;
    const candHeadroomStatus: HeadroomStatus =
      stage7Low > candHeadroom ? "overflow" : stage7High > candHeadroom ? "risk" : "safe";
    const candUseV2 = version !== "v0.30.0" ? true : useV2ModelRunner;
    const candEngramDerived = shouldAutoDeriveEngramDpSharedMemory({
      spec,
      version,
      engramCpuOffload,
      useV2ModelRunner: candUseV2,
      dpSize: recDp,
      pcpSize: recPcp,
    });
    const candEngramShared = spec.engram?.enabled ? spec.engram.dpSharedMemory || candEngramDerived : false;
    const candQ1 = collectQ1Findings({
      spec,
      card,
      version,
      weightPrecision: candPrec,
      kvCacheDtype,
      requestedBlockSize,
      effectiveBlockSize,
      userSpecifiedBlockSize,
      weightNzMode,
      tpSize: recTp,
      ppSize: recPp,
      dpSize: recDp,
      pcpSize: recPcp,
      dcpSize: recDcp,
      epWorldSize: recEpWorld,
      enableEp: recEnableEp,
      engramCpuOffload,
      engramDpSharedMemoryDerived: candEngramDerived,
      useV2ModelRunner: candUseV2,
      gpuMemoryUtilization: candUtil,
      cudagraphMode,
      enforceEager,
      oomStatus: "fits",
      headroomStatus: candHeadroomStatus,
      hasMla,
      hasCsa2,
      hasKda,
    });
    if (candQ1.blockers.length > 0) return false;
    const recStages = selectBottleneckPpStage({
      spec,
      card,
      version,
      weightPrecision: candPrec,
      weightNzMode,
      tpSize: recTp,
      ppSize: recPp,
      dpSize: recDp,
      pcpSize: recPcp,
      dcpSize: recDcp,
      epWorldSize: recEpWorld,
      enableEp: recEnableEp,
      engramCpuOffload,
      engramDpSharedMemory: candEngramShared,
      kvElemBytes,
      effectiveBlockSize,
      maxModelLen,
      maxNumSeqs,
      numSpecTokens,
    });
    const recAct = computeProfileRunTorchPeak({
      spec,
      card,
      version,
      weightPrecision: candPrec,
      tpSize: recTp,
      ppSize: recPp,
      dpSize: recDp,
      pcpSize: recPcp,
      enableEp: recEnableEp,
      maxNumBatchedTokens,
      maxNumSeqs,
    });
    const recHccl = estimateHcclDomainMemory(
      {
        hardwareFamily: card.family,
        tpSize: recTp,
        ppSize: recPp,
        dpSize: recDp,
        pcpSize: recPcp,
        dcpSize: recDcp,
        isMoe: moe.isMoe,
        enableExpertParallel: recEnableEp,
        ...(spec.engram?.enabled
          ? {
              engramEnabled: true,
              engramDpSharedMemory: candEngramShared,
              etpSize: recStages.w.engramEtpSize,
            }
          : {}),
      },
      version,
    );
    const recNonTorch = computeNonTorchIncrease({
      card,
      hccl: recHccl,
      isMoe: moe.isMoe,
      enableEp: recEnableEp,
      worldSize: recWorld,
    });
    const recVirtTokens = effectiveBlockSize * recDcp;
    return recStages.allStages.every(({ w: sw, kvState: sk }) => {
      if (sw.lowBytes >= candRequested || sw.pointBytes + recAct.pointBytes >= candRequested) return false;
      const rawLow = candRequested - (sw.highBytes + recAct.highBytes + recNonTorch.highBytes);
      const rawPt = candRequested - (sw.pointBytes + recAct.pointBytes + recNonTorch.pointBytes);
      if (rawLow <= 0 || rawPt <= 0) return false;
      const poolLow = scaleKv(rawLow);
      const poolPt = scaleKv(rawPt);
      const bBytes = Math.round(
        sk.localMainKvBytesPerSlot * effectiveBlockSize + sk.perTokenIndexerKvBytes * recVirtTokens,
      );
      const bMax = bBytes > 0 ? Math.ceil(maxModelLen / recVirtTokens) : 0;
      const minOne =
        (bMax > 0 ? (bMax + 1) * bBytes : 0) +
        Math.max(sk.totalFixedLinearStateBytes, sk.perSeqFixedLinearStateBytes);
      if (poolLow < minOne || poolPt < minOne) return false;
      if (bMax > 0) {
        return Math.max(0, Math.floor((poolLow - sk.totalFixedLinearStateBytes) / bBytes) - 1) >= bMax;
      }
      return true;
    });
  };

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
    hasMla,
    hasCsa2,
    hasKda,
    hasEngram,
    minCards: q4MinCards,
    recPrec,
    weightPrecision,
    kvCacheDtype,
    weightNzMode,
    useV2ModelRunner: version !== "v0.30.0" ? true : useV2ModelRunner,
    userSpecifiedUseV2ModelRunner: version !== "v0.30.0" ? false : userSpecifiedUseV2ModelRunner,
    requestedBlockSize,
    userSpecifiedBlockSize,
    maxModelLen,
    userSpecifiedMaxModelLen: input.maxModelLen !== undefined,
    maxNumBatchedTokens,
    maxNumSeqs,
    tpSize,
    ppSize,
    dpSize,
    pcpSize,
    dcpSize,
    worldSize,
    gpuMemoryUtilization,
    canUseRecommendedUtil,
    enforceEager,
    cudagraphMode,
  });

  // Build structured Wave 4 architecture summary for UI banner & tests
  const mlaSummary = hasMla
    ? (() => {
        const a = kvState.primaryFullAttn;
        const kvLora = a.kvLoraRank ?? 512;
        const qkRope = a.qkRopeHeadDim ?? 64;
        const vDim = a.vHeadDim ?? 128;
        const equivMha = 2 * a.numHeads * vDim * kvElemBytes;
        const latentBytes = kvState.latentBytesPerTokenPerLayer;
        return {
          kvLoraRank: kvLora,
          qkRopeHeadDim: qkRope,
          qLoraRank: a.qLoraRank ?? null,
          qkNopeHeadDim: a.qkNopeHeadDim ?? 128,
          vHeadDim: vDim,
          latentBytesPerTokenPerLayer: latentBytes,
          equivalentMhaBytesPerTokenPerLayer: equivMha,
          compressionRatio: latentBytes > 0 ? equivMha / latentBytes : 1,
          replicatedAcrossTp: tpSize > 1,
          dcpSize,
        };
      })()
    : undefined;

  const csa2Summary = hasCsa2
    ? (() => {
        const a = kvState.primaryFullAttn;
        const topk = a.sparseTopK ?? 2048;
        const denseMain = decodeBatchSize * decodeContextLen * kvState.perTokenMainKvBytes;
        const savingsRatio =
          roofline.decodeKvTrafficBytesPerStep > 0 ? denseMain / roofline.decodeKvTrafficBytesPerStep : 1;
        return {
          indexTopk: topk,
          indexHeadDim: a.indexHeadDim ?? 128,
          indexNumHeads: a.indexNumHeads ?? 64,
          indexerKvElemBytes: a.indexerKvElemBytes ?? (a.indexerQuantEnabled ? 1 : 2),
          indexerBytesPerTokenPerLayer: kvState.indexerBytesPerTokenPerLayer,
          effectiveDecodeContextLen: roofline.effectiveDecodeContextLen,
          decodeBandwidthSavingsRatio: savingsRatio,
        };
      })()
    : undefined;

  const kdaSummary = hasKda
    ? {
        linearLayerCount: spec.layers.filter((l) => l.attention.kind === "linear_kda").length,
        fullAttnLayerCount: spec.layers.filter((l) => l.attention.kind !== "linear_kda").length,
        localLinearLayerCount: kvState.localLinearLayerCount,
        localFullAttnLayerCount: kvState.localFullAttnLayerCount,
        recurrentStateBytesPerLayerPerSeq: kvState.recurrentStateBytesPerLayerPerSeq,
        convStateBytesPerLayerPerSeq: kvState.convStateBytesPerLayerPerSeq,
        perSeqFixedLinearStateBytes,
        totalFixedLinearStateBytes,
        perTokenPagedKvBytes: kvBytesPerTokenPerRank,
      }
    : undefined;

  const engramSummary = spec.engram?.enabled
    ? {
        vocabSize: spec.engram.vocabSize,
        hiddenSize: spec.engram.hiddenSize,
        layerCount: spec.engram.layerIds.length,
        cpuOffload: engramCpuOffload,
        dpSharedMemory: effectiveEngramDpSharedMemory,
        etpSize: w.engramEtpSize,
        npuWeightBytesPerRank: w.engramNpuWeightBytesPerRank,
        hostDramBytesPerNode: w.engramHostDramBytesPerNode,
      }
    : undefined;

  const wave4Arch: Wave4ArchitectureSummary = {
    activeFeatures: activeWave4Features,
    hasMla,
    hasCsa2,
    hasKda,
    hasEngram,
    ...(mlaSummary ? { mla: mlaSummary } : {}),
    ...(csa2Summary ? { csa2: csa2Summary } : {}),
    ...(kdaSummary ? { kda: kdaSummary } : {}),
    ...(engramSummary ? { engram: engramSummary } : {}),
  };

  const minPhysicalCardsRecommended =
    minCards.minCards !== null ? Math.ceil(minCards.minCards / card.diesPerPhysicalCard) : null;
  const q2Summary =
    oomStatus === "fits"
      ? hasKda
        ? `单卡可用池 [${(kvPoolLowBytes / GIB).toFixed(2)}, ${(kvPoolHighBytes / GIB).toFixed(2)}] GiB：KDA 固定状态 ${(perSeqFixedLinearStateBytes / MIB).toFixed(2)} MiB/seq（预留 ${(totalFixedLinearStateBytes / GIB).toFixed(2)} GiB）+ 全注意分页 KV ${(kvBytesPerTokenPerRank / KIB).toFixed(1)} KiB/tok，约 [${usableBlocksLow}, ${usableBlocksHigh}] 可用块，${maxModelLen} 上下文并发 [${maxConcLow.toFixed(1)}x, ${maxConcHigh.toFixed(1)}x]。`
        : `单卡可用 KV 池 [${(kvPoolLowBytes / GIB).toFixed(2)}, ${(kvPoolHighBytes / GIB).toFixed(2)}] GiB（点估 ${(kvPoolPointBytes / GIB).toFixed(2)} GiB），约 [${usableBlocksLow}, ${usableBlocksHigh}] 可用块，${maxModelLen} 上下文并发 [${maxConcLow.toFixed(1)}x, ${maxConcHigh.toFixed(1)}x]。`
      : minCards.unsolvable || minCards.minCards === null
        ? `当前拓扑（${worldSize} 逻辑卡）容量状态：${oomStatus}；在 ${card.shortName} 上即使扩展至 64 逻辑设备仍无解（请降低 max_num_seqs / max_model_len 或改换卡型/量化）。`
        : `当前拓扑（${worldSize} 逻辑卡）容量状态：${oomStatus}；建议至少 ${minCards.minCards} 逻辑设备（${minPhysicalCardsRecommended} 物理卡）。`;

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
      feasible: minCards.feasible,
      unsolvable: minCards.unsolvable,
      minCardsRecommended: minCards.minCards,
      minPhysicalCardsRecommended,
      currentTotalCards: worldSize,
      currentPhysicalCards: Math.ceil(worldSize / card.diesPerPhysicalCard),
      oomStatus,
      kvPoolLowBytes,
      kvPoolPointBytes,
      kvPoolHighBytes,
      kvBytesPerTokenPerRank,
      perTokenPagedKvBytes: kvBytesPerTokenPerRank,
      perSeqFixedLinearStateBytes,
      totalFixedLinearStateBytes,
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
      ppStageSlices,
      summary: q2Summary,
    },
    q3Roofline: (() => {
      const hasSplitStageRidge =
        Math.abs(roofline.prefillRidgePointFlopsPerByte - roofline.ridgePointFlopsPerByte) > 1e-6;
      const usePrefillCeiling =
        hasSplitStageRidge &&
        primaryBottleneck !== "kv-bandwidth-bound" &&
        roofline.prefillAchievedTflops > roofline.decodeLinearAchievedTflops;
      const effectivePeakComputeTflops = usePrefillCeiling
        ? roofline.prefillPeakComputeTflops
        : roofline.decodePeakComputeTflops;
      const effectiveRidgePointFlopsPerByte = usePrefillCeiling
        ? roofline.prefillRidgePointFlopsPerByte
        : roofline.decodeRidgePointFlopsPerByte;
      const ridgePrefix = hasSplitStageRidge
        ? `Prefill 硬件脊点 ${roofline.prefillRidgePointFlopsPerByte.toFixed(1)} FLOP/B（峰值 ${roofline.prefillPeakComputeTflops.toFixed(0)} TFLOPS），Decode 硬件脊点 ${roofline.decodeRidgePointFlopsPerByte.toFixed(1)} FLOP/B（峰值 ${roofline.decodePeakComputeTflops.toFixed(0)} TFLOPS）；`
        : `硬件脊点 ${effectiveRidgePointFlopsPerByte.toFixed(1)} FLOP/B；`;
      return {
        primaryBottleneck,
        effectivePeakComputeTflops,
        effectiveRidgePointFlopsPerByte,
        roofline,
        summary:
          ridgePrefix +
          `Prefill(${prefillTokens}) 强度 ${roofline.prefillIntensityFlopsPerByte.toFixed(1)} FLOP/B（实得 ${roofline.prefillAchievedTflops.toFixed(1)} TFLOPS，${roofline.prefillRegime}），` +
          `Decode(B=${decodeBatchSize}, M_eff=${roofline.decodeLinearMEff.toFixed(2)}) 线性层 ${roofline.decodeLinearIntensityFlopsPerByte.toFixed(1)} FLOP/B、${roofline.attentionModeLabel} ${roofline.decodeKvAttnIntensityFlopsPerByte.toFixed(1)} FLOP/B。`,
      };
    })(),
    q4Recommendation: q4,
  };

  return {
    version,
    spec,
    card,
    isMoe: moe.isMoe,
    wave4Arch,
    inputSummary: {
      weightPrecision,
      effectiveWeightPrecision: w.effectiveWeightPrecision,
      kvCacheDtype,
      requestedBlockSize,
      effectiveBlockSize,
      userSpecifiedBlockSize,
      requestedEnableEp: Boolean(input.enableEp),
      weightNzMode,
      tpSize,
      ppSize,
      dpSize,
      ...(dpLocalSize !== undefined ? { dpLocalSize } : {}),
      pcpSize,
      dcpSize,
      enableEp,
      epWorldSize,
      localKvHeadsPerRank,
      localLayersPerRank,
      numSpecTokens,
      gpuMemoryUtilization,
      maxModelLen,
      maxNumBatchedTokens,
      maxNumSeqs,
      cudagraphMode,
      cudagraphCaptureCount: acl.effectiveCount,
      enforceEager,
      useV2ModelRunner,
      userSpecifiedUseV2ModelRunner,
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
