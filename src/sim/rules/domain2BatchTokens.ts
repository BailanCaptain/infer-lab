import {
  type CouplingCheckInput,
  type CouplingRule,
  DEFAULT_RULE_VERSION,
  isVersionSupported,
  type RuleMatch,
  type RuleVersion,
  VERIFIED_COMMITS,
} from "./types";

const DEFAULT_MAX_NUM_BATCHED_TOKENS = 2048;
const DEFAULT_MAX_NUM_BATCHED_TOKENS_FOR_BATCHED_DP = 256;
const DEFAULT_MAX_NUM_SEQS = 128;

export interface BatchTokensResolution {
  version: RuleVersion;
  deviceMemoryBytes: number;
  deviceMemoryFallbackTriggered: boolean;
  initialBatchedTokens: number;
  afterBatchedDpMoe: number;
  afterThroughputMode: number;
  afterChunkedPrefillFloor: number;
  afterMultimodalFloor: number;
  afterModelLimitCap: number;
  beforeSpPcpMaxNumBatchedTokens: number;
  finalMaxNumBatchedTokens: number;
  finalMaxNumSeqs: number;
  spPcpRounded: boolean;
  spPcpDivisor: number | null;
  sources: readonly string[];
}

function cdiv(a: number, b: number): number {
  return Math.floor((a + b - 1) / b);
}

function isSpActiveForBatchTokens(input: CouplingCheckInput, version: RuleVersion): boolean {
  const tp = Math.max(1, input.tpSize ?? 1);
  const pp = Math.max(1, input.ppSize ?? 1);
  if (tp <= 1) return false;
  if (version === "rfork") {
    return Boolean(input.enableFlashcomm1);
  }
  const effectiveFlashcomm =
    Boolean(input.enableFlashcomm1) || (version === "v0.30.0" && Boolean(input.enableDsaCp));
  const moeSpActive =
    Boolean(input.isMoe) &&
    Boolean(input.enableExpertParallel) &&
    input.useSequenceParallelMoe !== false &&
    (Boolean(input.useSequenceParallelMoe) || effectiveFlashcomm);
  const denseSpActive = pp === 1 && Boolean(input.isQwen35Dense) && Boolean(input.enableFlashcomm1);
  return moeSpActive || denseSpActive;
}

function getBatchTokenSources(version: RuleVersion): readonly string[] {
  if (version === "main") {
    return [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L260-L272`,
      `vllm@${VERIFIED_COMMITS.vllmMainVerified}:vllm/engine/arg_utils.py#L2971-L3075`,
      `vllm@${VERIFIED_COMMITS.vllmMainVerified}:vllm/engine/arg_utils.py#L3182-L3272`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L885-L897`,
    ];
  }
  if (version === "rfork") {
    return [
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L274-L280`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/engine/arg_utils.py#L2705-L2792`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/engine/arg_utils.py#L2904-L2987`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L138-L152`,
    ];
  }
  return [
    `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L231-L244`,
    `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/engine/arg_utils.py#L2705-L2792`,
    `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/engine/arg_utils.py#L2904-L2987`,
    `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L816-L828`,
  ];
}

/**
 * Exact upstream decision tree for `max_num_batched_tokens` & `max_num_seqs` on Ascend
 * (`platform.py` + `arg_utils.py` + `ascend_config.py`).
 */
export function resolveDefaultBatchTokens(
  input: CouplingCheckInput,
  version: RuleVersion = DEFAULT_RULE_VERSION,
): BatchTokensResolution {
  const usageContext = input.usageContext ?? "vllm_serve";
  const rawMaxModelLen = input.maxModelLen ?? 32768;
  const hasValidModelLen = rawMaxModelLen > 0;

  // 1. NPUPlatform.get_device_total_memory() raises NotImplementedError before torch_npu init -> device_memory = 0
  const fallbackTriggered = !input.torchNpuInitializedBeforeArgs;
  const gib = 1024 * 1024 * 1024;
  const deviceMemoryBytes = fallbackTriggered ? 0 : (input.deviceMemoryGiB ?? 0) * gib;

  let defaultBatchedMap: Record<"llm_class" | "vllm_serve", number>;
  let defaultSeqsMap: Record<"llm_class" | "vllm_serve", number>;

  if (deviceMemoryBytes >= 160 * gib) {
    defaultBatchedMap = { llm_class: 16384, vllm_serve: 16384 };
    defaultSeqsMap = { llm_class: 1024, vllm_serve: 1024 };
  } else if (deviceMemoryBytes >= 70 * gib && !input.isA100Device && !input.isGb10Device) {
    defaultBatchedMap = { llm_class: 16384, vllm_serve: 8192 };
    defaultSeqsMap = { llm_class: 1024, vllm_serve: 1024 };
  } else {
    defaultBatchedMap = { llm_class: 8192, vllm_serve: 2048 };
    defaultSeqsMap = { llm_class: 256, vllm_serve: 256 };
  }

  const origBatched = input.maxNumBatchedTokens;
  const origSeqs = input.maxNumSeqs;

  const initialBatchedTokens =
    origBatched ?? defaultBatchedMap[usageContext] ?? DEFAULT_MAX_NUM_BATCHED_TOKENS;

  let curBatched: number;
  if (origBatched !== undefined) {
    curBatched = origBatched;
  } else if (input.useBatchedDpMoe) {
    curBatched = DEFAULT_MAX_NUM_BATCHED_TOKENS_FOR_BATCHED_DP;
  } else {
    curBatched = initialBatchedTokens;
  }
  const afterBatchedDpMoe = curBatched;

  let curSeqs = origSeqs ?? defaultSeqsMap[usageContext] ?? DEFAULT_MAX_NUM_SEQS;

  if (input.performanceMode === "throughput") {
    if (origBatched === undefined) curBatched *= 2;
    if (origSeqs === undefined) curSeqs *= 2;
  }
  const afterThroughputMode = curBatched;

  let afterChunkedPrefillFloor = curBatched;
  let afterMultimodalFloor = curBatched;
  let afterModelLimitCap = curBatched;

  if (origBatched === undefined) {
    if (input.enableChunkedPrefill === false && hasValidModelLen) {
      curBatched = Math.max(rawMaxModelLen, curBatched);
    }
    afterChunkedPrefillFloor = curBatched;

    if (
      input.isMultimodalModel &&
      input.isMmPrefixLm &&
      input.minMmBatchedTokens !== undefined &&
      input.minMmBatchedTokens > curBatched
    ) {
      curBatched = input.minMmBatchedTokens;
    }
    afterMultimodalFloor = curBatched;

    if (hasValidModelLen) {
      curBatched = Math.min(curSeqs * rawMaxModelLen, curBatched);
    }
    afterModelLimitCap = curBatched;
  }

  if (origSeqs === undefined) {
    curSeqs = Math.min(curSeqs, curBatched);
  }

  const beforeSpPcpMaxNumBatchedTokens = curBatched;

  // AscendConfig silent SP + PCP ceiling writeback
  const tp = Math.max(1, input.tpSize ?? 1);
  const pcp = Math.max(1, input.pcpSize ?? 1);
  let spPcpRounded = false;
  let spPcpDivisor: number | null = null;
  if (pcp > 1 && isSpActiveForBatchTokens(input, version)) {
    const tpPcpSize = tp * pcp;
    spPcpDivisor = tpPcpSize;
    if (curBatched % tpPcpSize !== 0) {
      curBatched = cdiv(curBatched, tpPcpSize) * tpPcpSize;
      spPcpRounded = true;
    }
  }

  return {
    version,
    deviceMemoryBytes,
    deviceMemoryFallbackTriggered: fallbackTriggered,
    initialBatchedTokens,
    afterBatchedDpMoe,
    afterThroughputMode,
    afterChunkedPrefillFloor,
    afterMultimodalFloor,
    afterModelLimitCap,
    beforeSpPcpMaxNumBatchedTokens,
    finalMaxNumBatchedTokens: curBatched,
    finalMaxNumSeqs: curSeqs,
    spPcpRounded,
    spPcpDivisor,
    sources: getBatchTokenSources(version),
  };
}

export const domain2Rules: readonly CouplingRule[] = [
  {
    id: "d2-default-batch-tokens-early-fallback",
    domain: "batch-tokens",
    title: "Ascend max_num_batched_tokens Early NotImplementedError Fallback (P1-4 #1)",
    judgment: "warn",
    evidenceLevel: "I",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L231-L244`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/engine/arg_utils.py#L2715-L2759`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/engine/arg_utils.py#L2904-L2987`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/scheduler.py#L42-L44`,
    ],
    description:
      "NPUPlatform.get_device_total_memory() raises NotImplementedError before torch_npu initialization, forcing device_memory=0 so ALL Ascend cards (including 950DT) fall back to 2048 (vllm serve) or 8192 (LLM class), before batched-DP-MoE, throughput x2, chunked-prefill, multimodal prefix-LM, and max_num_seqs*max_model_len rules.",
    rationale:
      "Static source reading confirms NotImplementedError -> device_memory=0 -> 2048/8192 [C]; whether a launcher pre-initializes torch_npu before EngineArgs resolution must be verified via runtime debug log 'Defaulting max_num_batched_tokens to %d for %s usage context.' [I].",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.maxNumBatchedTokens !== undefined) return null;
      const resolved = resolveDefaultBatchTokens(input, version);
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: resolved.sources,
        message: `Auto-resolved max_num_batched_tokens=${resolved.finalMaxNumBatchedTokens} (max_num_seqs=${resolved.finalMaxNumSeqs}) via device_memory=${resolved.deviceMemoryBytes} fallback for ${input.hardwareFamily ?? "Ascend"} (${input.usageContext ?? "vllm_serve"}). Verify on hardware with debug log 'Defaulting max_num_batched_tokens...'.`,
        effectiveMutation: {
          maxNumBatchedTokens: resolved.finalMaxNumBatchedTokens,
          maxNumSeqs: resolved.finalMaxNumSeqs,
        },
      };
    },
  },
  {
    id: "d2-sp-pcp-batch-tokens-ceiling",
    domain: "batch-tokens",
    title: "SP + PCP Silently Rounds max_num_batched_tokens Up to tp * pcp Multiple",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L756-L771`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L816-L828`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1071-L1083`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/patch/platform/patch_parallel_config.py#L7-L28`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/parallel.py#L197`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L856-L897`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/utils.py#L1050-L1080`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/patch/platform/patch_parallel_config.py#L7-L28`,
      `vllm@${VERIFIED_COMMITS.vllmMainVerified}:vllm/config/parallel.py#L229`,
      `vllm@${VERIFIED_COMMITS.vllmMainFetched}:vllm/config/parallel.py#L128-L146`,
      `vllm@${VERIFIED_COMMITS.vllmMainFetched}:vllm/config/parallel.py#L332`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L138-L152`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/utils.py#L861-L889`,
    ],
    description:
      "When prefill_context_parallel_size > 1 and SP is enabled, AscendConfig silently rounds max_num_batched_tokens up to a multiple of tp_size * pcp_size.",
    rationale: "Sequence and prefill-context sharding require equal token chunk slices across tp*pcp ranks.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pcp = Math.max(1, input.pcpSize ?? 1);
      if (pcp <= 1 || !isSpActiveForBatchTokens(input, version)) return null;
      const resolved = resolveDefaultBatchTokens(input, version);
      if (!resolved.spPcpRounded || resolved.spPcpDivisor === null) return null;
      const versionSource =
        version === "main"
          ? [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L856-L897`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/utils.py#L1050-L1080`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/patch/platform/patch_parallel_config.py#L7-L28`,
              `vllm@${VERIFIED_COMMITS.vllmMainVerified}:vllm/config/parallel.py#L229`,
              `vllm@${VERIFIED_COMMITS.vllmMainFetched}:vllm/config/parallel.py#L128-L146`,
              `vllm@${VERIFIED_COMMITS.vllmMainFetched}:vllm/config/parallel.py#L332`,
            ]
          : version === "rfork"
            ? [
                `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L138-L152`,
                `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/utils.py#L861-L889`,
              ]
            : [
                `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L756-L771`,
                `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L816-L828`,
                `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1071-L1083`,
                `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/patch/platform/patch_parallel_config.py#L7-L28`,
                `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/parallel.py#L197`,
              ];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: versionSource,
        message: `SP + PCP>${1} silently rounded max_num_batched_tokens up to ${resolved.finalMaxNumBatchedTokens} (multiple of tp*pcp=${resolved.spPcpDivisor}).`,
        effectiveMutation: {
          maxNumBatchedTokens: resolved.finalMaxNumBatchedTokens,
        },
      };
    },
  },
  {
    id: "d2-chunked-prefill-decode-budget",
    domain: "batch-tokens",
    title: "Chunked Prefill Per-Step Decode Token Budget Deduction",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/v1/core/sched/scheduler.py#L581-L584`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/v1/core/sched/scheduler.py#L656-L665`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/v1/core/sched/scheduler.py#L806-L808`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/v1/request.py#L292-L293`,
    ],
    description:
      "V1 Scheduler initializes step token_budget=max_num_scheduled_tokens (default max_num_batched_tokens) and deducts 1 token (or 1 + num_spec_tokens) per running decode request before admitting prefill chunks.",
    rationale:
      "High running concurrency or large speculative draft counts shrink remaining prefill chunk capacity per step.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.enableChunkedPrefill === false) return null;
      if (input.numSpecTokens === undefined && input.maxNumBatchedTokens === undefined) return null;
      const spec = input.numSpecTokens ?? 0;
      const perDecodeCost = 1 + spec;
      const resolved = resolveDefaultBatchTokens(input, version);
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `Chunked-prefill step budget (${resolved.finalMaxNumBatchedTokens}) deducts ${perDecodeCost} token(s) per running decode request (1 + ${spec} spec token(s)).`,
        effectiveMutation: { perDecodeTokenDeduction: perDecodeCost },
      };
    },
  },
  {
    id: "d2-pp-non-last-stage-memory-reduction",
    domain: "batch-tokens",
    title: "PP>1 Stage Memory & Logits Peak Reduction on Non-Last Stages",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/distributed/utils.py#L127-L160`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/model_executor/models/qwen3.py#L297-L307`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/v1/worker/gpu_model_runner.py#L6527-L6533`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/pipeline_parallel.md#L180-L257`,
    ],
    description:
      "PP>1 splits Transformer layers and KV cache across stages via get_pp_indices and replaces lm_head with PPMissingLayer on non-last stages, avoiding logits/sampler peaks there.",
    rationale:
      "Lower per-card layer weights, KV footprint, and non-last logits peak allow larger max_num_batched_tokens budgets under PP.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pp = Math.max(1, input.ppSize ?? 1);
      if (pp <= 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `PP=${pp} shards layers/KV across stages and replaces lm_head with PPMissingLayer on stages 0..${pp - 2}, removing logits peak on non-last ranks.`,
      };
    },
  },
  {
    id: "d2-cpp-requires-pp-gt-1",
    domain: "batch-tokens",
    title: "CPP (profiling_chunk_config) Requires PP > 1 (v0.30.0)",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L724-L729`],
    description:
      "Enabling profiling_chunk_config with pipeline_parallel_size <= 1 raises ValueError in v0.30.0.",
    rationale:
      "Dynamic Chunked Pipeline Parallelism (CPP) exists solely to balance PP stage execution times.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pp = Math.max(1, input.ppSize ?? 1);
      if (!input.profilingChunkEnabled || pp > 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: "ValueError: profiling_chunk_config requires pipeline parallelism (pp > 1).",
        remediation: "Set --pipeline-parallel-size >= 2 or disable profiling_chunk_config.",
      };
    },
  },
  {
    id: "d2-cpp-balance-mutex",
    domain: "batch-tokens",
    title: "CPP Mutually Exclusive with enable_balance_scheduling (v0.30.0)",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L731-L736`],
    description:
      "Enabling profiling_chunk_config alongside enable_balance_scheduling raises ValueError in v0.30.0.",
    rationale: "Both policies rewrite chunk sizing/scheduling independently and conflict.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.profilingChunkEnabled || !input.enableBalanceScheduling) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          "ValueError: profiling_chunk_config and enable_balance_scheduling cannot be enabled together.",
        remediation: "Disable either profiling_chunk_config or enable_balance_scheduling.",
      };
    },
  },
  {
    id: "d2-cpp-min-chunk-clamp",
    domain: "batch-tokens",
    title: "CPP min_chunk Silently Clamped to max_num_batched_tokens (v0.30.0)",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L712-L723`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L87-L98`,
    ],
    description:
      "When max_num_batched_tokens < profiling_chunk_config.min_chunk (evaluated before SP+PCP writeback), AscendConfig logs a warning and clamps min_chunk down to max_num_batched_tokens.",
    rationale: "Prevents min_chunk from exceeding the scheduler's per-step token ceiling.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.profilingChunkEnabled || input.profilingMinChunk === undefined) return null;
      const resolved = resolveDefaultBatchTokens(input, version);
      const preSpBatched = resolved.beforeSpPcpMaxNumBatchedTokens;
      if (preSpBatched >= input.profilingMinChunk) return null;
      const sources =
        version === "rfork"
          ? [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L87-L98`]
          : [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L712-L723`];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources,
        message: `max_num_batched_tokens (${preSpBatched}) < profiling_chunk_config.min_chunk (${input.profilingMinChunk}); silently clamped min_chunk to ${preSpBatched}.`,
        effectiveMutation: { profilingMinChunk: preSpBatched },
      };
    },
  },
  {
    id: "d2-cpp-quadratic-chunk-2x-4x",
    domain: "batch-tokens",
    title: "CPP Equal-Time Quadratic First Chunk Recommends 2~4x max_num_batched_tokens (v0.30.0)",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/core/scheduler_profiling_chunk.py#L107-L115`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L42-L84`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L196-L208`,
    ],
    description:
      "CPP uses max_num_batched_tokens as base_chunk_size to fit quadratic latency f(l)=a*l^2+b*l+c and solve equal-time subsequent chunks; official tuning guide recommends 2~4x higher max_num_batched_tokens than fixed chunking.",
    rationale: "Default 2048 under-utilizes quadratic attention early chunks when CPP is active.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pp = Math.max(1, input.ppSize ?? 1);
      if (!input.profilingChunkEnabled || pp <= 1) return null;
      const resolved = resolveDefaultBatchTokens(input, version);
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `CPP uses max_num_batched_tokens=${resolved.finalMaxNumBatchedTokens} as the quadratic equal-time first chunk; official guide recommends 2~4x fixed chunk size (e.g. 20480 for 64k, 32768 for 128k).`,
      };
    },
  },
  {
    id: "d2-cpp-removed-in-main",
    domain: "batch-tokens",
    title: "CPP (profiling_chunk_config) Removed in main (PR #21310)",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["main"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1585-L1601`],
    description:
      "profiling_chunk_config and Dynamic Chunked Pipeline Parallelism (CPP) were completely removed in vllm-ascend main (commit 839f53831 / PR #21310).",
    rationale:
      "Passing profiling_chunk_config on main is rejected/invalid because the config & scheduler classes were deleted.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.profilingChunkEnabled) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          "profiling_chunk_config (CPP) was removed in vllm-ascend main (PR #21310); configuring it is invalid on main.",
        remediation: "Remove profiling_chunk_config from additional_config.scheduler_config.",
      };
    },
  },
];

export function evaluateDomain2Rules(
  input: CouplingCheckInput,
  version: RuleVersion = DEFAULT_RULE_VERSION,
): readonly RuleMatch[] {
  const matches: RuleMatch[] = [];
  for (const rule of domain2Rules) {
    const match = rule.evaluate(input, version);
    if (match) matches.push(match);
  }
  return matches;
}
