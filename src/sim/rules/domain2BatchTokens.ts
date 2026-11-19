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
    title: "昇腾 max_num_batched_tokens 启动早期探测回落 2048/8192 基线",
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
      "NPUPlatform.get_device_total_memory() 在 torch_npu 初始化前抛出 NotImplementedError 使 device_memory=0，全系列昇腾卡（含 950DT）默认回落 2048 (vllm serve) 或 8192 (LLM 类)。",
    rationale:
      "源码实证 NotImplementedError -> device_memory=0 -> 2048/8192 [C]；启动器是否提前初始化 torch_npu 需核对运行日志 'Defaulting max_num_batched_tokens...' [I]。",
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
        message: `未显式传 --max-num-batched-tokens：因 torch_npu 尚未初始化导致 device_memory=${resolved.deviceMemoryBytes} 回落，${input.hardwareFamily ?? "Ascend"} (${input.usageContext ?? "vllm_serve"}) 自动推导为 max_num_batched_tokens=${resolved.finalMaxNumBatchedTokens}（max_num_seqs=${resolved.finalMaxNumSeqs}）。实机请核对调试日志 'Defaulting max_num_batched_tokens...'。`,
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
    title: "SP + PCP 静默将 max_num_batched_tokens 向上取整至 tp * pcp 整数倍",
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
      "当 prefill_context_parallel_size > 1 且开启 SP 时，AscendConfig 静默将 max_num_batched_tokens 向上取整为 tp_size * pcp_size 的整数倍。",
    rationale: "序列并行与 Prefill 上下文并行要求每步 token 分片在 tp*pcp 张卡间均分。",
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
        message: `SP 与 PCP>1 叠加时，AscendConfig 已静默将 max_num_batched_tokens 向上取整至 ${resolved.finalMaxNumBatchedTokens}（tp*pcp=${resolved.spPcpDivisor} 的整数倍）。`,
        effectiveMutation: {
          maxNumBatchedTokens: resolved.finalMaxNumBatchedTokens,
        },
      };
    },
  },
  {
    id: "d2-chunked-prefill-decode-budget",
    domain: "batch-tokens",
    title: "Chunked Prefill 每步先扣除在跑 Decode 请求的 Token 预算",
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
      "V1 调度器每步初始化 token_budget=max_num_batched_tokens，先为每条运行中 Decode 请求扣除 1（或 1 + num_spec_tokens）个 token，剩余预算才用于 Prefill 分块。",
    rationale: "高并发 Decode 或大投机步数会显著压缩单步剩余 Prefill 分块容量。",
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
        message: `Chunked Prefill 单步总预算 ${resolved.finalMaxNumBatchedTokens} 会先按每条在跑 Decode 请求扣除 ${perDecodeCost} 个 token（1 + ${spec} 个投机 token），剩余额度再分配给 Prefill 分块。`,
        effectiveMutation: { perDecodeTokenDeduction: perDecodeCost },
      };
    },
  },
  {
    id: "d2-pp-non-last-stage-memory-reduction",
    domain: "batch-tokens",
    title: "PP>1 切分层与 KV，且非末段免除 lm_head / logits 峰值显存",
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
      "PP>1 通过 get_pp_indices 切分 Transformer 层与 KV，并在非末阶段将 lm_head 替换为 PPMissingLayer。",
    rationale: "非末卡单卡权重、KV 与 logits 峰值下降，可承载更高的 max_num_batched_tokens。",
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
        message: `PP=${pp} 将层与 KV 切分至各阶段，并在阶段 0..${pp - 2} 以 PPMissingLayer 替换 lm_head，消除非末卡 logits/采样显存峰值。`,
      };
    },
  },
  {
    id: "d2-cpp-requires-pp-gt-1",
    domain: "batch-tokens",
    title: "动态分块流水线 CPP（profiling_chunk_config）要求 PP > 1（v0.30.0）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L724-L729`],
    description:
      "在 v0.30.0 中，pipeline_parallel_size <= 1 时开启 profiling_chunk_config 启动即抛 ValueError。",
    rationale: "动态分块流水线并行（CPP）专用于均衡多 PP 阶段耗时。",
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
        message: "ValueError: profiling_chunk_config 要求启用流水线并行（pp > 1）。",
        remediation: "设置 --pipeline-parallel-size >= 2，或关闭 profiling_chunk_config。",
      };
    },
  },
  {
    id: "d2-cpp-balance-mutex",
    domain: "batch-tokens",
    title: "CPP 与 enable_balance_scheduling 互斥（v0.30.0）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L731-L736`],
    description: "v0.30.0 同时开启 profiling_chunk_config 与 enable_balance_scheduling 抛 ValueError。",
    rationale: "两套策略独立改写分块与调度逻辑，存在冲突。",
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
        message: "ValueError: profiling_chunk_config 与 enable_balance_scheduling 不可同时开启。",
        remediation: "关闭 profiling_chunk_config 或 enable_balance_scheduling 之一。",
      };
    },
  },
  {
    id: "d2-cpp-min-chunk-clamp",
    domain: "batch-tokens",
    title: "CPP min_chunk 超过 max_num_batched_tokens 时静默截断（v0.30.0）",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L712-L723`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L87-L98`,
    ],
    description:
      "在 SP+PCP 回写之前，若 max_num_batched_tokens < profiling_chunk_config.min_chunk，AscendConfig 告警并将 min_chunk 静默截断至 max_num_batched_tokens。",
    rationale: "避免最小分块超过调度器单步 token 上限。",
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
        message: `max_num_batched_tokens (${preSpBatched}) < profiling_chunk_config.min_chunk (${input.profilingMinChunk})，框架已将 min_chunk 静默截断为 ${preSpBatched}。`,
        effectiveMutation: { profilingMinChunk: preSpBatched },
      };
    },
  },
  {
    id: "d2-cpp-quadratic-chunk-2x-4x",
    domain: "batch-tokens",
    title: "CPP 二次等时首块建议将 max_num_batched_tokens 调高 2~4×（v0.30.0）",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/core/scheduler_profiling_chunk.py#L107-L115`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/developer_guide/Design_Documents/dynamic_chunked_pipeline_parallel.md#L42-L84`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/dynamic_chunk_pipeline_parallel.md#L196-L208`,
    ],
    description:
      "CPP 以 max_num_batched_tokens 作为二次耗时模型 f(l)=a*l^2+b*l+c 的首块基准，官方调优指南建议较固定分块放大 2~4 倍。",
    rationale: "默认 2048 在开启 CPP 时无法充分喂饱早期二次注意力块。",
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
        message: `CPP 以 max_num_batched_tokens=${resolved.finalMaxNumBatchedTokens} 作为等时首块基准；官方建议调至固定分块的 2~4×（如 64k 配 20480、128k 配 32768）。`,
      };
    },
  },
  {
    id: "d2-cpp-removed-in-main",
    domain: "batch-tokens",
    title: "CPP（profiling_chunk_config）已在 main 分支移除（PR #21310）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["main"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1585-L1601`],
    description: "profiling_chunk_config 与动态分块流水线并行已在 vllm-ascend main (PR #21310) 彻底移除。",
    rationale: "在 main 上继续配置 profiling_chunk_config 会因字段与调度器类已删除而报错。",
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
        message: "profiling_chunk_config (CPP) 已在 vllm-ascend main (PR #21310) 移除，在 main 上配置无效。",
        remediation: "从 additional_config.scheduler_config 移除 profiling_chunk_config。",
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
