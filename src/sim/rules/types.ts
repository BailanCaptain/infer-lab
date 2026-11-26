export type RuleVersion = "v0.30.0" | "main" | "rfork";

export type RuleDomain = "parallelism-moe" | "batch-tokens" | "quantization" | "cp-pd" | "graph-sched-env";

export type RuleJudgment = "error" | "silent-rewrite" | "warn" | "unknown";

export type EvidenceLevel = "C" | "I";

export type AscendFamily = "A2" | "A3" | "310P" | "A5";

export type UsageContextMode = "vllm_serve" | "llm_class";

export type CudaGraphMode = "NONE" | "PIECEWISE" | "FULL_DECODE_ONLY" | "FULL" | "FULL_AND_PIECEWISE";

export type KvRole = "kv_producer" | "kv_consumer" | "kv_both";

export type ModelDtype = "bfloat16" | "float16" | "float32";

export type ActivationScheme = "dynamic" | "static";

export type CpRouteConcept = "pcp-dcp" | "ulysses" | "ring";

/**
 * Canonical `repo@commit:path#Lx-Ly` anchor contract aligned with `src/content/wiki/schema.ts`
 * (kept self-contained in `src/sim/rules/` to preserve layer purity).
 */
export const SOURCE_REF_PATTERN = /^([a-z0-9][a-z0-9-]*)@([0-9a-f]{7,40}):([^\s#]+)(?:#L(\d+)(?:-L(\d+))?)?$/;

export const VERIFIED_COMMITS = {
  vllmAscendV030: "c09d3e20",
  vllmAscendMain: "8d6180e2",
  vllmV030: "ced6857a",
  vllmMainVerified: "ba15685a",
  vllmMainFetched: "c84273be",
  rforkMain: "3284850b",
} as const;

export interface ParsedSourceRef {
  repo: string;
  commit: string;
  path: string;
  lineStart?: number;
  lineEnd?: number;
}

export function parseSourceRef(ref: string): ParsedSourceRef | null {
  const m = SOURCE_REF_PATTERN.exec(ref);
  if (!m?.[1] || !m[2] || !m[3]) return null;
  const parsed: ParsedSourceRef = {
    repo: m[1],
    commit: m[2],
    path: m[3],
  };
  if (m[4]) parsed.lineStart = Number.parseInt(m[4], 10);
  if (m[5]) parsed.lineEnd = Number.parseInt(m[5], 10);
  return parsed;
}

export interface DecodeCudagraphShape {
  numReqs: number;
  queryLen: number;
}

export interface CouplingCheckInput {
  // Hardware & runtime environment
  hardwareFamily?: AscendFamily;
  crossNodeRoce?: boolean;
  torchNpuInitializedBeforeArgs?: boolean;
  deviceMemoryGiB?: number;
  isA100Device?: boolean;
  isGb10Device?: boolean;
  cannOpsTransformerAvailable?: boolean;
  nnopbaseSupportTensorV2?: boolean;
  vllmBatchInvariant?: boolean;
  vllmOmniAvailable?: boolean;
  envFacts?: {
    readonly vllmOmniAvailable?: boolean;
  };

  // Parallelism topology
  tpSize?: number;
  ppSize?: number;
  dpSize?: number;
  pcpSize?: number;
  dcpSize?: number;
  kvppSize?: number;
  enableExpertParallel?: boolean;
  useBatchedDpMoe?: boolean;
  useSequenceParallelMoe?: boolean;
  enableSp?: boolean;
  enableFlashcomm1?: boolean;
  enableDsaCp?: boolean;
  cpRoute?: CpRouteConcept;
  customOps?: readonly string[];
  quantizedAllReduceEnabled?: boolean;
  quantizedAllReduceMinNumel?: number;
  quantizedAllReduceInvalidReason?: string;
  useUbatching?: boolean;
  enableDbo?: boolean;
  ubatchSize?: number;
  oprojTensorParallelSize?: number;
  mlpTensorParallelSize?: number;
  embeddingTensorParallelSize?: number;
  lmheadTensorParallelSize?: number;
  qkvIprojTensorParallelSize?: number;
  enableKvNz?: boolean;
  enableMlapo?: boolean;
  mlapoKeepPrefillWeights?: boolean;
  enableForceEplb?: boolean;
  dynamicEplb?: boolean;
  mixPlacement?: boolean;
  multistreamOverlapSharedExpert?: boolean;
  mc2CommAlg?: string;

  // Model traits
  isMoe?: boolean;
  hasRoutedExpertHiddenSize?: boolean;
  enableSharedExpertDp?: boolean;
  megamoeSharedExpertFusion?: boolean;
  numExperts?: number;
  numExpertsPerTok?: number;
  isQwen35Dense?: boolean;
  isLoraEnabled?: boolean;
  isDraftModel?: boolean;
  draftMoeQuantType?: string;
  isMegaMoeSupportedByModel?: boolean;
  isMegaMoeSupportedByConfig?: boolean;
  modelType?: string;
  modelDtype?: ModelDtype;
  maxModelLen?: number;
  isMultimodalModel?: boolean;
  isMmPrefixLm?: boolean;
  minMmBatchedTokens?: number;
  useMla?: boolean;
  usesSfaSparse?: boolean;
  sfaDcpReplicatedIndexer?: boolean;
  numAttentionHeads?: number;
  numKvHeads?: number;
  headDim?: number;
  kvLoraRank?: number;
  qkRopeHeadDim?: number;
  indexTopk?: number;
  topkBufferSize?: number;
  hasCompressRatios?: boolean;

  // Batching, scheduler & runner
  usageContext?: UsageContextMode;
  performanceMode?: "balanced" | "throughput" | "interactivity";
  maxNumBatchedTokens?: number;
  maxNumSeqs?: number;
  enableChunkedPrefill?: boolean;
  numSpecTokens?: number;
  speculativeMethod?: string;
  useV2ModelRunner?: boolean;
  cudagraphCaptureSizes?: readonly number[];
  maxCudagraphCaptureSize?: number;
  decodeCudagraphCaptureRequestSizes?: readonly DecodeCudagraphShape[];
  maxPrefillCudagraphCaptureTokens?: number;
  maxDecodeCudagraphCaptureTokens?: number;
  uniformDecodeQueryLen?: number;
  numTokens?: number;
  enablePrefillMc2?: boolean;
  enableFusedMc2?: 0 | 1 | 2 | 3;
  isDecodeOnlyNode?: boolean;
  profilingChunkConfigured?: boolean;
  profilingChunkEnabled?: boolean;
  profilingMinChunk?: number;
  enableBalanceScheduling?: boolean;
  batchJobSchedEnabled?: boolean;
  dyntraLbEnabled?: boolean;
  shortRequestFirstEnabled?: boolean;
  recomputeSchedulerEnable?: boolean;

  // Quantization & KV cache
  quantMethod?: string;
  quantScheme?: string;
  hasWeightBlockSize?: boolean;
  activationScheme?: ActivationScheme | string;
  inFeatures?: number;
  isKvBProj?: boolean;
  cacheDtype?: string;
  blockSize?: number;
  userSpecifiedBlockSize?: boolean;
  enableC8Quant?: boolean;
  enableSparseSfaC8?: boolean;
  indexerKvDtype?: string;
  xliteEnabled?: boolean;

  // PD & KV transfer
  kvConnector?: string;
  kvRole?: KvRole;
  prefillTpSize?: number;
  decodeTpSize?: number;
  sparseKvOffloadEnabled?: boolean;
  keepDeviceKvCache?: boolean;
  hasPreemptOffloadConnector?: boolean;

  // Graph compilation, RL & env vars
  attentionBackend?: string;
  cudagraphMode?: CudaGraphMode;
  enableNpugraphEx?: boolean;
  enableStaticKernel?: boolean;
  enableSuperKernel?: boolean;
  enableSleepMode?: boolean;
  rlEnabled?: boolean;
  rlTrainingConsistency?: boolean;
  weightNzMode?: number;
  pytorchNpuAllocConf?: string;
  envVars?: Readonly<Record<string, string>>;

  // Promoted AscendConfig & CLI cross-check fields (v0.30.0 / main)
  loadFormat?: string;
  shutdownTimeout?: number;
  mambaCacheMode?: string;
  multistreamEngramOverlap?: boolean;
  sharedEngramConfigured?: boolean;
  sharedEngramInvalidReason?: string;
  sharedEngramBackend?: string;
  sharedEngramEndpoint?: string;
  sharedEngramCapacity?: number;
  sharedEngramLibraryPath?: string;
  sharedEngramListenPort?: number;
  sharedEngramLocalCommRes?: string;
  gdnInternalPrefillCheckpoints?: boolean;
  kvPoolRangeDebug?: boolean;
  runtimeConfigConfigured?: boolean;
  runtimeConfigInvalidType?: string;
  runtimeConfigHasNestedHotReload?: boolean;
  runtimeConfigManualDumpSet?: boolean;
  runtimeConfigPathConfigured?: boolean;
  runtimeConfigPathInvalidType?: string;
  runtimeConfigHotReload?: boolean;
  runtimeConfigHotReloadInvalidValue?: unknown;
  mainOnlyAdditionalConfigKeys?: readonly string[];
}

export type MutationValue = string | number | boolean | null;

export interface RuleMatch {
  ruleId: string;
  domain: RuleDomain;
  title: string;
  version: RuleVersion;
  judgment: RuleJudgment;
  evidenceLevel: EvidenceLevel;
  sources: readonly string[];
  message: string;
  effectiveMutation?: Readonly<Record<string, MutationValue>>;
  remediation?: string;
}

export interface CouplingRule {
  id: string;
  domain: RuleDomain;
  title: string;
  judgment: RuleJudgment;
  evidenceLevel: EvidenceLevel;
  versions: readonly RuleVersion[];
  sources: readonly string[];
  description: string;
  rationale: string;
  evaluate: (input: CouplingCheckInput, version?: RuleVersion) => RuleMatch | null;
}

export interface CouplingEvaluationReport {
  version: RuleVersion;
  matches: readonly RuleMatch[];
  errors: readonly RuleMatch[];
  silentRewrites: readonly RuleMatch[];
  warnings: readonly RuleMatch[];
  unknowns: readonly RuleMatch[];
  hasBlockers: boolean;
}

export const DEFAULT_RULE_VERSION: RuleVersion = "v0.30.0";

export function isVersionSupported(rule: Pick<CouplingRule, "versions">, version: RuleVersion): boolean {
  return rule.versions.includes(version);
}
