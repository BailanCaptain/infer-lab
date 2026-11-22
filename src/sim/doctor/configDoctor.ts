import {
  type AscendFamily,
  type BatchTokensResolution,
  type CouplingCheckInput,
  classifyEnvVar,
  DEFAULT_RULE_VERSION,
  type EnvVarClassification,
  type EvidenceLevel,
  estimateHcclDomainMemory,
  evaluateCouplingRules,
  getCouplingRuleById,
  type HcclMemoryEstimate,
  type KvRole,
  type MoeCommSelectionResult,
  type MutationValue,
  type RuleDomain,
  type RuleJudgment,
  type RuleMatch,
  type RuleVersion,
  resolveDefaultBatchTokens,
  selectMoeCommMethod,
  VERIFIED_COMMITS,
} from "../rules";
import { type ParsedVllmServeCommand, parseVllmServeCommand } from "./cliParser";

export type DoctorMode = "minimal" | "full";
export type DoctorScope = "single" | "prefill" | "decode" | "cross-instance";

export interface DoctorWikiRef {
  pageId: string;
  anchor?: string | undefined;
  label?: string | undefined;
}

export interface ResolvedDoctorDeepLink {
  pageId: string;
  canonicalId: string;
  href: string;
  label: string;
  verified: readonly string[];
  isV030Verified: boolean;
  isLegacyBaseline: boolean;
  badgeText: string | null;
}

export type DoctorDeepLinkResolver = (
  pageId: string,
  opts?: { anchor?: string | undefined; label?: string | undefined },
) => ResolvedDoctorDeepLink;

export interface DoctorFinding {
  id: string;
  scope: DoctorScope;
  category:
    | "syntax"
    | "env"
    | "hardware-dtype"
    | "memory-batch"
    | "parallelism"
    | "quantization"
    | "graph-sched"
    | "pd";
  domain?: RuleDomain | undefined;
  title: string;
  judgment: RuleJudgment;
  evidenceLevel: EvidenceLevel;
  sources: readonly string[];
  message: string;
  remediation?: string | undefined;
  effectiveMutation?: Readonly<Record<string, MutationValue>> | undefined;
  wikiRefs: readonly DoctorWikiRef[];
  deepLinks: readonly ResolvedDoctorDeepLink[];
}

export interface EffectiveRewriteRow {
  param: string;
  userInput: string;
  effectiveValue: string;
  kind: "default" | "silent-rewrite";
  reason: string;
  source: string;
  ruleId?: string | undefined;
}

export interface SingleDoctorOptions {
  mode: DoctorMode;
  hardwareFamily: AscendFamily;
  version?: RuleVersion | undefined;
  crossNodeRoce?: boolean | undefined;
  modelTraitOverride?: Partial<CouplingCheckInput> | undefined;
  resolveDeepLink?: DoctorDeepLinkResolver | undefined;
}

export interface SingleConfigDoctorReport {
  mode: DoctorMode;
  hardwareFamily: AscendFamily;
  version: RuleVersion;
  parsed: ParsedVllmServeCommand;
  effectiveInput: CouplingCheckInput;
  findings: readonly DoctorFinding[];
  errors: readonly DoctorFinding[];
  silentRewrites: readonly DoctorFinding[];
  warnings: readonly DoctorFinding[];
  unknowns: readonly DoctorFinding[];
  hasBlockers: boolean;
  envClassifications: readonly EnvVarClassification[];
  effectiveRewrites: readonly EffectiveRewriteRow[];
  batchTokensResolution: BatchTokensResolution;
  moeCommSelection: MoeCommSelectionResult | null;
  hcclEstimate: HcclMemoryEstimate | null;
  deferredAdvancedFeatures: readonly string[];
  deferredAdvancedPrompt: string | null;
  relatedWikiIds: readonly string[];
}

export interface PdDoctorOptions {
  hardwareFamily: AscendFamily;
  decodeHardwareFamily?: AscendFamily | undefined;
  version?: RuleVersion | undefined;
  crossNodeRoce?: boolean | undefined;
  modelTraitOverride?: Partial<CouplingCheckInput> | undefined;
  prefillTraitOverride?: Partial<CouplingCheckInput> | undefined;
  decodeTraitOverride?: Partial<CouplingCheckInput> | undefined;
  resolveDeepLink?: DoctorDeepLinkResolver | undefined;
}

export interface PdConfigDoctorReport {
  version: RuleVersion;
  prefillHardwareFamily: AscendFamily;
  decodeHardwareFamily: AscendFamily;
  prefill: SingleConfigDoctorReport;
  decode: SingleConfigDoctorReport;
  crossInstanceFindings: readonly DoctorFinding[];
  allFindings: readonly DoctorFinding[];
  errors: readonly DoctorFinding[];
  silentRewrites: readonly DoctorFinding[];
  warnings: readonly DoctorFinding[];
  unknowns: readonly DoctorFinding[];
  hasBlockers: boolean;
  relatedWikiIds: readonly string[];
}

export const DEFERRED_ADVANCED_BRIDGE_PROMPT =
  "检测到进阶并行/图融合/PD 分离参数，可在完整配置体检台展开联检" as const;

export const DEFAULT_GPU_MEMORY_UTILIZATION = 0.92;
export const HIGH_GPU_MEMORY_UTILIZATION_THRESHOLD = 0.95;

/**
 * Canonical mapping from every coupling rule ID and doctor diagnostic ID to Wiki deep-links.
 * Every referenced `pageId` MUST be registered in `src/content/wiki/toolDeeplinks.ts`
 * (enforced by `src/content/wiki/tool-deeplinks.test.ts`).
 */
export const DOCTOR_RULE_WIKI_LINKS: Readonly<Record<string, readonly DoctorWikiRef[]>> = {
  // Parse & CLI / Env diagnostics
  "parse-empty-command": [{ pageId: "ascend-env-and-serve" }],
  "parse-unterminated-quote": [{ pageId: "ascend-env-and-serve" }],
  "parse-invalid-json": [{ pageId: "ascend-env-and-serve" }, { pageId: "ascend-config-system" }],
  "parse-invalid-json-type": [{ pageId: "ascend-env-and-serve" }, { pageId: "ascend-config-system" }],
  "parse-missing-flag-value": [{ pageId: "ascend-env-and-serve" }],
  "parse-invalid-number": [{ pageId: "ascend-env-and-serve" }],
  "parse-invalid-range": [{ pageId: "ascend-env-and-serve" }],
  "parse-invalid-visible-devices": [{ pageId: "ascend-env-and-serve" }, { pageId: "hardware-devices" }],
  "parse-invalid-vllm-port": [{ pageId: "ascend-env-and-serve" }],
  "env-visible-devices-mismatch": [{ pageId: "ascend-env-and-serve" }, { pageId: "tensor-parallel" }],
  "env-wrong-visibility-var": [{ pageId: "ascend-env-and-serve" }, { pageId: "hardware-devices" }],
  "doc-high-gpu-mem-util": [
    { pageId: "kv-cache-memory-profiling" },
    { pageId: "core-cli-params" },
    { pageId: "acl-graph" },
  ],
  "doc-310p-npugraph-ex-minimal": [{ pageId: "ascend-env-and-serve" }, { pageId: "hardware-devices" }],

  // Domain 1: Parallelism & MoE
  "d1-tp-collective-pattern": [{ pageId: "tensor-parallel" }, { pageId: "collective-communication" }],
  "d1-pp-async-send-recv": [{ pageId: "pipeline-parallel" }],
  "d1-sp-pp-rms-norm-rewrite": [{ pageId: "sequence-parallel" }, { pageId: "pipeline-parallel" }],
  "d1-sp-pp-removed-in-main": [{ pageId: "sequence-parallel" }],
  "d1-ascend-sp-tp-gt-1": [{ pageId: "sequence-parallel" }, { pageId: "tensor-parallel" }],
  "d1-ascend-sp-moe-requires-ep": [{ pageId: "sequence-parallel" }, { pageId: "expert-parallel" }],
  "d1-flashcomm1-unsupported-disable": [{ pageId: "sequence-parallel" }, { pageId: "core-cli-params" }],
  "d1-flashcomm1-disables-quantized-ar": [{ pageId: "sequence-parallel" }],
  "d1-roce-pp-dp-moe-exclusion": [
    { pageId: "pipeline-parallel" },
    { pageId: "data-parallel" },
    { pageId: "expert-parallel" },
  ],
  "d1-fused-mc2-silent-reset": [{ pageId: "expert-parallel" }, { pageId: "core-cli-params" }],
  "d1-fused-mc2-3-main-only": [{ pageId: "expert-parallel" }, { pageId: "core-cli-params" }],
  "d1-dp-ep-moe-comm-strategy": [{ pageId: "expert-parallel" }, { pageId: "data-parallel" }],
  "d1-idle-dp-dummy-batch": [{ pageId: "data-parallel" }],

  // Domain 2: Batch tokens & PP / CPP
  "d2-default-batch-tokens-early-fallback": [{ pageId: "core-cli-params" }, { pageId: "chunked-prefill" }],
  "d2-sp-pcp-batch-tokens-ceiling": [
    { pageId: "core-cli-params" },
    { pageId: "context-parallel" },
    { pageId: "sequence-parallel" },
  ],
  "d2-chunked-prefill-decode-budget": [{ pageId: "chunked-prefill" }, { pageId: "continuous-batching" }],
  "d2-pp-non-last-stage-memory-reduction": [
    { pageId: "pipeline-parallel" },
    { pageId: "kv-cache-memory-profiling" },
  ],
  "d2-cpp-requires-pp-gt-1": [{ pageId: "dynamic-chunked-pp" }, { pageId: "pipeline-parallel" }],
  "d2-cpp-balance-mutex": [{ pageId: "dynamic-chunked-pp" }, { pageId: "balance-scheduling" }],
  "d2-cpp-min-chunk-clamp": [{ pageId: "dynamic-chunked-pp" }, { pageId: "core-cli-params" }],
  "d2-cpp-quadratic-chunk-2x-4x": [{ pageId: "dynamic-chunked-pp" }, { pageId: "core-cli-params" }],
  "d2-cpp-removed-in-main": [{ pageId: "dynamic-chunked-pp" }],

  // Domain 3: Quantization & KV cache
  "d3-fp8-missing-weight-block-size": [{ pageId: "quantization" }, { pageId: "low-precision-formats" }],
  "d3-fp8-non-dynamic-activation": [{ pageId: "quantization" }, { pageId: "low-precision-formats" }],
  "d3-fp8-block-950-mxfp8": [{ pageId: "quantization" }, { pageId: "ascend-950-architecture" }],
  "d3-fp8-block-non950-bf16-v030": [
    { pageId: "quantization" },
    { pageId: "low-precision-formats" },
    { pageId: "ascend-model-onboarding" },
  ],
  "d3-fp8-block-non950-error-main": [{ pageId: "quantization" }, { pageId: "low-precision-formats" }],
  "d3-fp8-310p-unsupported": [{ pageId: "quantization" }, { pageId: "hardware-devices" }],
  "d3-w8a8-mix-pd-dispatch": [{ pageId: "quantization" }, { pageId: "pd-disaggregation" }],
  "d3-mxfp8-c8-kv-block-size": [
    { pageId: "kv-cache" },
    { pageId: "kv-cache-quantization" },
    { pageId: "paged-attention" },
  ],
  "d3-turboquant-common-preconditions": [{ pageId: "kv-cache-quantization" }, { pageId: "hardware-devices" }],
  "d3-turboquant-route-a-sfa": [{ pageId: "kv-cache-quantization" }, { pageId: "sparse-attention" }],
  "d3-turboquant-route-b-dsa": [{ pageId: "kv-cache-quantization" }, { pageId: "sparse-attention" }],
  "d3-turboquant-route-b-mrv2-v030": [{ pageId: "kv-cache-quantization" }],
  "d3-gqa-c8-requires-quant-weights": [
    { pageId: "kv-cache" },
    { pageId: "gqa" },
    { pageId: "kv-cache-quantization" },
  ],
  "d3-310p-requires-float16": [
    { pageId: "ascend-env-and-serve" },
    { pageId: "hardware-devices" },
    { pageId: "low-precision-formats" },
  ],
  "d3-gqa-c8-block-size-multiple-32": [
    { pageId: "kv-cache" },
    { pageId: "kv-cache-quantization" },
    { pageId: "paged-attention" },
  ],

  // Domain 4: CP & PD
  "d4-ulysses-ring-no-runtime-flags": [{ pageId: "context-parallel" }],
  "d4-pcp-requires-mrv2": [{ pageId: "context-parallel" }, { pageId: "core-cli-params" }],
  "d4-pcp-full-cudagraph-unsupported": [{ pageId: "context-parallel" }, { pageId: "acl-graph" }],
  "d4-dsa-cp-pcp-mutex": [{ pageId: "context-parallel" }],
  "d4-dsa-cp-mrv2-v030": [{ pageId: "context-parallel" }],
  "d4-pcp-dcp-sizing": [{ pageId: "context-parallel" }, { pageId: "gqa" }],
  "d4-kv-connector-missing-kv-role": [{ pageId: "pd-disaggregation" }, { pageId: "mooncake-connector" }],
  "d4-kv-role-invalid-literal": [{ pageId: "pd-disaggregation" }, { pageId: "mooncake-connector" }],
  "d4-mooncake-decode-pp-eq-1": [{ pageId: "pd-disaggregation" }, { pageId: "mooncake-connector" }],
  "d4-mooncake-decode-pcp-eq-1": [{ pageId: "pd-disaggregation" }, { pageId: "mooncake-connector" }],
  "d4-mooncake-pp-pcp-mutex": [{ pageId: "mooncake-connector" }, { pageId: "context-parallel" }],
  "d4-mooncake-tp-p-divisible-tp-d": [{ pageId: "pd-disaggregation" }, { pageId: "mooncake-connector" }],
  "d4-mooncake-gqa-c8-forbidden": [
    { pageId: "mooncake-connector" },
    { pageId: "kv-cache-quantization" },
    { pageId: "gqa" },
  ],
  "d4-recompute-scheduler-p-node-disable": [
    { pageId: "recompute-scheduler" },
    { pageId: "pd-disaggregation" },
  ],
  "d4-recompute-scheduler-non-d-node-error": [
    { pageId: "recompute-scheduler" },
    { pageId: "pd-disaggregation" },
  ],
  "d4-finegrained-tp-requires-recompute": [{ pageId: "fine-grained-tp" }, { pageId: "recompute-scheduler" }],
  "d4-sparse-kv-offload-constraints": [
    { pageId: "kv-cache-sparse-offload" },
    { pageId: "pd-disaggregation" },
  ],

  // Domain 5: Graph, Schedulers, RL & Env
  "d5-fa3-full-decode-only-error": [
    { pageId: "ascend-flash-attention" },
    { pageId: "acl-graph" },
    { pageId: "core-cli-params" },
  ],
  "d5-950-custom-ops-disabled-v030": [{ pageId: "ascend-950-architecture" }, { pageId: "core-cli-params" }],
  "d5-950-custom-ops-enabled-main": [{ pageId: "ascend-950-architecture" }],
  "d5-static-kernel-defaults-super-kernel": [{ pageId: "npugraph-ex" }, { pageId: "core-cli-params" }],
  "d5-310p-npugraph-ex-downgrade": [{ pageId: "npugraph-ex" }, { pageId: "hardware-devices" }],
  "d5-solo-super-or-static-kernel-error": [{ pageId: "npugraph-ex" }, { pageId: "core-cli-params" }],
  "d5-graph-mode-resets-npugraph-ex": [
    { pageId: "npugraph-ex" },
    { pageId: "acl-graph" },
    { pageId: "core-cli-params" },
  ],
  "d5-short-request-first-scheduler-mutex": [
    { pageId: "short-request-first" },
    { pageId: "batch-job-aware-scheduler" },
  ],
  "d5-dyntra-lb-profiling-chunk-mutex": [{ pageId: "dyntra-lb" }, { pageId: "dynamic-chunked-pp" }],
  "d5-scheduler-override-chain-v030": [
    { pageId: "core-cli-params" },
    { pageId: "batch-job-aware-scheduler" },
    { pageId: "recompute-scheduler" },
  ],
  "d5-scheduler-override-chain-main": [
    { pageId: "core-cli-params" },
    { pageId: "batch-job-aware-scheduler" },
  ],
  "d5-rl-config-disables-nz-and-expandable-segments": [
    { pageId: "vllm-ascend-for-rl" },
    { pageId: "tensor-layout" },
  ],
  "d5-cann-env-var-classification": [{ pageId: "ascend-env-and-serve" }, { pageId: "hccl-buffer" }],
  "d5-retired-ascend-env-var": [{ pageId: "ascend-env-and-serve" }, { pageId: "ascend-config-system" }],
  "d5-deprecated-flashcomm1-env-fallback": [
    { pageId: "ascend-env-and-serve" },
    { pageId: "sequence-parallel" },
  ],

  // Cross-instance P/D consistency diagnostics
  "pd-missing-kv-transfer-config": [{ pageId: "pd-disaggregation" }, { pageId: "mooncake-connector" }],
  "pd-missing-kv-role": [{ pageId: "pd-disaggregation" }, { pageId: "mooncake-connector" }],
  "pd-role-mismatch": [{ pageId: "pd-disaggregation" }, { pageId: "mooncake-connector" }],
  "pd-connector-mismatch": [{ pageId: "pd-disaggregation" }, { pageId: "mooncake-connector" }],
  "pd-block-size-mismatch": [{ pageId: "mooncake-connector" }, { pageId: "paged-attention" }],
  "pd-kv-cache-dtype-mismatch": [{ pageId: "mooncake-connector" }, { pageId: "kv-cache-quantization" }],
  "pd-model-dtype-mismatch": [{ pageId: "pd-disaggregation" }, { pageId: "low-precision-formats" }],
};

export function getAllDoctorWikiRefs(): readonly DoctorWikiRef[] {
  const seen = new Set<string>();
  const out: DoctorWikiRef[] = [];
  for (const refs of Object.values(DOCTOR_RULE_WIKI_LINKS)) {
    for (const ref of refs) {
      const key = `${ref.pageId}#${ref.anchor ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ref);
    }
  }
  return out;
}

function resolveWikiRefs(
  id: string,
  resolver?: DoctorDeepLinkResolver,
): { wikiRefs: readonly DoctorWikiRef[]; deepLinks: readonly ResolvedDoctorDeepLink[] } {
  const wikiRefs = DOCTOR_RULE_WIKI_LINKS[id] ?? [{ pageId: "core-cli-params" }];
  if (!resolver) return { wikiRefs, deepLinks: [] };
  const deepLinks = wikiRefs.map((ref) => resolver(ref.pageId, { anchor: ref.anchor, label: ref.label }));
  return { wikiRefs, deepLinks };
}

function domainToCategory(domain: RuleDomain): DoctorFinding["category"] {
  switch (domain) {
    case "parallelism-moe":
      return "parallelism";
    case "batch-tokens":
      return "memory-batch";
    case "quantization":
      return "quantization";
    case "cp-pd":
      return "pd";
    case "graph-sched-env":
      return "graph-sched";
  }
}

function ruleMatchToFinding(
  match: RuleMatch,
  scope: DoctorScope,
  resolver?: DoctorDeepLinkResolver,
): DoctorFinding {
  const { wikiRefs, deepLinks } = resolveWikiRefs(match.ruleId, resolver);
  return {
    id: match.ruleId,
    scope,
    category: domainToCategory(match.domain),
    domain: match.domain,
    title: match.title,
    judgment: match.judgment,
    evidenceLevel: match.evidenceLevel,
    sources: match.sources,
    message: match.message,
    remediation: match.remediation,
    effectiveMutation: match.effectiveMutation,
    wikiRefs,
    deepLinks,
  };
}

function detectDeferredAdvancedFeatures(parsed: ParsedVllmServeCommand, input: CouplingCheckInput): string[] {
  const deferred: string[] = [];
  if (parsed.kvTransferConfig || input.kvConnector || input.kvRole) {
    deferred.push("--kv-transfer-config (P/D 分离)");
  }
  if (input.enableSuperKernel !== undefined) {
    deferred.push("enable_super_kernel (三级图融合)");
  }
  if (input.enableStaticKernel !== undefined) {
    deferred.push("enable_static_kernel (静态算子图融合)");
  }
  if ((input.pcpSize ?? 1) > 1) {
    deferred.push(`--prefill-context-parallel-size=${input.pcpSize} (PCP 上下文并行)`);
  }
  if ((input.dcpSize ?? 1) > 1) {
    deferred.push(`--decode-context-parallel-size=${input.dcpSize} (DCP 上下文并行)`);
  }
  if (input.enableDsaCp) {
    deferred.push("enable_dsa_cp (DSA-CP 上下文并行)");
  }
  if (input.attentionBackend === "FA3") {
    deferred.push("--attention-backend FA3");
  }
  if (
    input.recomputeSchedulerEnable ||
    input.profilingChunkEnabled ||
    input.batchJobSchedEnabled ||
    input.shortRequestFirstEnabled ||
    input.dyntraLbEnabled
  ) {
    deferred.push("扩展调度器配置 (recompute / profiling_chunk / batch_job / srf / dyntra_lb)");
  }
  if (input.sparseKvOffloadEnabled) {
    deferred.push("sparse_kv_offload_config");
  }
  if (input.rlEnabled) {
    deferred.push("rl_config (强化学习模式)");
  }
  if (
    (input.oprojTensorParallelSize ?? 0) > 0 ||
    (input.mlpTensorParallelSize ?? 0) > 0 ||
    (input.embeddingTensorParallelSize ?? 0) > 0
  ) {
    deferred.push("finegrained_tp_config (细粒度 TP)");
  }
  return deferred;
}

function collectEnvClassifications(
  envVars: Readonly<Record<string, string>>,
  version: RuleVersion,
): EnvVarClassification[] {
  const out: EnvVarClassification[] = [];
  for (const name of Object.keys(envVars)) {
    out.push(classifyEnvVar(name, version));
  }
  return out;
}

function buildEffectiveRewrites(
  parsed: ParsedVllmServeCommand,
  input: CouplingCheckInput,
  batchRes: BatchTokensResolution,
  findings: readonly DoctorFinding[],
  version: RuleVersion,
): EffectiveRewriteRow[] {
  const rows: EffectiveRewriteRow[] = [];

  // 1. gpu_memory_utilization default 0.92
  if (parsed.gpuMemoryUtilization === undefined) {
    rows.push({
      param: "--gpu-memory-utilization",
      userInput: "(省略)",
      effectiveValue: `${DEFAULT_GPU_MEMORY_UTILIZATION}（源码默认；生产食谱常显式传 0.90 留足录图余量）`,
      kind: "default",
      reason: "vLLM v0.30.0 CacheConfig.gpu_memory_utilization 默认值为 0.92，而非旧 FAQ 沿写的 0.90。",
      source: `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/cache.py#L103-L106`,
    });
  }

  // 2. max_num_batched_tokens default 2048 fallback
  if (input.maxNumBatchedTokens === undefined) {
    rows.push({
      param: "--max-num-batched-tokens",
      userInput: "(省略)",
      effectiveValue: `${batchRes.finalMaxNumBatchedTokens}（max_num_seqs=${batchRes.finalMaxNumSeqs}）`,
      kind: "default",
      reason:
        "参数解析早于 torch_npu 初始化，get_device_total_memory() 抛 NotImplementedError 使 device_memory 归零，vllm serve 回落 2048 基线后再走 6 分支推导。",
      source:
        batchRes.sources[0] ??
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L231-L244`,
      ruleId: "d2-default-batch-tokens-early-fallback",
    });
  }

  // 3. All silent-rewrite findings emitted by the rule engine
  for (const f of findings) {
    if (f.judgment !== "silent-rewrite") continue;
    const mutationEntries = Object.entries(f.effectiveMutation ?? {});
    const effectiveSummary =
      mutationEntries.length > 0 ? mutationEntries.map(([k, v]) => `${k}=${String(v)}`).join(", ") : f.title;
    rows.push({
      param: mutationEntries[0]?.[0] ?? f.id,
      userInput: "用户配置触发静默改写",
      effectiveValue: effectiveSummary,
      kind: "silent-rewrite",
      reason: f.message,
      source:
        f.sources[0] ??
        `vllm-ascend@${version === "main" ? VERIFIED_COMMITS.vllmAscendMain : VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1313-L1352`,
      ruleId: f.id,
    });
  }

  return rows;
}

const MINIMAL_ALLOWED_RULE_IDS: ReadonlySet<string> = new Set([
  "d2-default-batch-tokens-early-fallback",
  "d3-fp8-missing-weight-block-size",
  "d3-fp8-non-dynamic-activation",
  "d3-fp8-block-950-mxfp8",
  "d3-fp8-block-non950-bf16-v030",
  "d3-fp8-block-non950-error-main",
  "d3-fp8-310p-unsupported",
  "d3-gqa-c8-requires-quant-weights",
  "d3-gqa-c8-block-size-multiple-32",
  "d3-310p-requires-float16",
  "d5-cann-env-var-classification",
  "d5-retired-ascend-env-var",
  "d5-deprecated-flashcomm1-env-fallback",
]);

function evaluateCommonCliAndEnvFindings(
  parsed: ParsedVllmServeCommand,
  input: CouplingCheckInput,
  scope: DoctorScope,
  mode: DoctorMode,
  resolver?: DoctorDeepLinkResolver,
): DoctorFinding[] {
  const findings: DoctorFinding[] = [];

  // 1. Parse diagnostics (broken JSON, bad numbers, unterminated quotes, VLLM_PORT URI)
  for (const diag of parsed.parseDiagnostics) {
    const { wikiRefs, deepLinks } = resolveWikiRefs(diag.code, resolver);
    findings.push({
      id: diag.code,
      scope,
      category: diag.code.includes("port") || diag.code.includes("visible") ? "env" : "syntax",
      title: diag.flag ? `参数解析异常：${diag.flag}` : "命令行语法解析异常",
      judgment: diag.severity === "error" ? "error" : "warn",
      evidenceLevel: "C",
      sources:
        diag.code === "parse-invalid-vllm-port"
          ? [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/envs.py#L710`]
          : [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L94-L98`],
      message: diag.message,
      remediation: diag.remediation,
      wikiRefs,
      deepLinks,
    });
  }

  // 2. Mistyped device visibility env vars (CUDA_VISIBLE_DEVICES / ASCEND_VISIBLE_DEVICES)
  if (
    Object.hasOwn(parsed.envVars, "CUDA_VISIBLE_DEVICES") &&
    !Object.hasOwn(parsed.envVars, "ASCEND_RT_VISIBLE_DEVICES")
  ) {
    const { wikiRefs, deepLinks } = resolveWikiRefs("env-wrong-visibility-var", resolver);
    findings.push({
      id: "env-wrong-visibility-var",
      scope,
      category: "env",
      title: "昇腾切卡变量应为 ASCEND_RT_VISIBLE_DEVICES（非 CUDA_VISIBLE_DEVICES）",
      judgment: "warn",
      evidenceLevel: "C",
      sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L94-L98`],
      message:
        "检测到 CUDA_VISIBLE_DEVICES，昇腾 NPUPlatform.device_control_env_var 仅读取 ASCEND_RT_VISIBLE_DEVICES。",
      remediation: "改用 export ASCEND_RT_VISIBLE_DEVICES=0,1,... 指定可见 NPU 卡号。",
      wikiRefs,
      deepLinks,
    });
  }

  // 3. ASCEND_RT_VISIBLE_DEVICES count vs required local ranks (TP * PP * DP_local * PCP)
  const tp = Math.max(1, input.tpSize ?? 1);
  const pp = Math.max(1, input.ppSize ?? 1);
  const dpLocal = Math.max(1, parsed.dataParallelSizeLocal ?? input.dpSize ?? 1);
  const pcp = Math.max(1, input.pcpSize ?? 1);
  const requiredLocalRanks = tp * pp * dpLocal * pcp;

  if (parsed.visibleDevices !== null && parsed.visibleDevices.length < requiredLocalRanks) {
    const { wikiRefs, deepLinks } = resolveWikiRefs("env-visible-devices-mismatch", resolver);
    findings.push({
      id: "env-visible-devices-mismatch",
      scope,
      category: "env",
      title: "ASCEND_RT_VISIBLE_DEVICES 可见卡数少于并行所需 rank 数",
      judgment: "error",
      evidenceLevel: "C",
      sources: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L94-L98`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/cpu_binding.py#L24-L26`,
      ],
      message: `ASCEND_RT_VISIBLE_DEVICES 仅暴露 ${parsed.visibleDevices.length} 张设备，但当前并行拓扑需要 TP(${tp}) × PP(${pp}) × DP(${dpLocal})${pcp > 1 ? ` × PCP(${pcp})` : ""} = ${requiredLocalRanks} 个本地 rank。`,
      remediation: `请补足 ASCEND_RT_VISIBLE_DEVICES 至少 ${requiredLocalRanks} 张卡，或调低并行度。`,
      wikiRefs,
      deepLinks,
    });
  }

  // 4. High --gpu-memory-utilization warning (>= 0.95)
  if (
    parsed.gpuMemoryUtilization !== undefined &&
    parsed.gpuMemoryUtilization >= HIGH_GPU_MEMORY_UTILIZATION_THRESHOLD
  ) {
    const { wikiRefs, deepLinks } = resolveWikiRefs("doc-high-gpu-mem-util", resolver);
    findings.push({
      id: "doc-high-gpu-mem-util",
      scope,
      category: "memory-batch",
      title: "--gpu-memory-utilization 过高（>= 0.95）存在录图阶段 OOM 风险",
      judgment: "warn",
      evidenceLevel: "C",
      sources: [
        `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/cache.py#L103-L106`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/worker.py#L601-L634`,
      ],
      message: `当前 --gpu-memory-utilization=${parsed.gpuMemoryUtilization}（默认 0.92），剩余预算外余量仅 ${(1 - parsed.gpuMemoryUtilization).toFixed(2)}；ACL Graph 录图发生在切完 KV 块之后，拉太满极易在 capture_model() 阶段 OOM。`,
      remediation: "建议回调至 0.90（或默认 0.92）以保留足够录图与运行期显存余量。",
      wikiRefs,
      deepLinks,
    });
  }

  // 5. Minimal-mode 310P explicit enable_npugraph_ex: true downgrade note (without mentioning super/static kernel)
  if (mode === "minimal" && input.hardwareFamily === "310P" && input.enableNpugraphEx === true) {
    const { wikiRefs, deepLinks } = resolveWikiRefs("doc-310p-npugraph-ex-minimal", resolver);
    findings.push({
      id: "doc-310p-npugraph-ex-minimal",
      scope,
      category: "hardware-dtype",
      title: "Atlas 300I DUO (310P) 不支持 enable_npugraph_ex（会静默置为 false）",
      judgment: "silent-rewrite",
      evidenceLevel: "C",
      sources: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L145-L165`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/getting_started/quick_start/online/qwen3-0.6b-310p.inc.md#L1-L16`,
      ],
      message: "Ascend 310P 不具备 NPUGRAPH_EX 能力，启动时会告警并静默将 enable_npugraph_ex 置为 False。",
      remediation: `建议显式传入 --additional-config '{"ascend_compilation_config":{"enable_npugraph_ex":false}}'。`,
      effectiveMutation: { enableNpugraphEx: false },
      wikiRefs,
      deepLinks,
    });
  }

  return findings;
}

function collectRelatedWikiIds(findings: readonly DoctorFinding[]): string[] {
  const seen = new Set<string>();
  for (const f of findings) {
    for (const ref of f.wikiRefs) seen.add(ref.pageId);
  }
  return [...seen];
}

const STRICT_VALID_KV_ROLES: ReadonlySet<string> = new Set(["kv_producer", "kv_consumer", "kv_both"]);

const KV_TRANSFER_ROLE_SOURCE = `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/kv_transfer.py#L130-L140`;

interface RawKvTransferRoleAudit {
  connector?: string | undefined;
  missingRole: boolean;
  invalidRoleValue?: unknown;
  strictRole?: KvRole | undefined;
}

function auditRawKvTransferRole(
  kvTransferConfig: Readonly<Record<string, unknown>> | null,
): RawKvTransferRoleAudit {
  if (!kvTransferConfig) {
    return { missingRole: false };
  }
  const rawConn = kvTransferConfig.kv_connector;
  const connector = typeof rawConn === "string" && rawConn.trim().length > 0 ? rawConn.trim() : undefined;
  const hasRawRole =
    Object.hasOwn(kvTransferConfig, "kv_role") &&
    kvTransferConfig.kv_role !== undefined &&
    kvTransferConfig.kv_role !== null;
  if (!hasRawRole) {
    return { connector, missingRole: connector !== undefined };
  }
  const rawRole = kvTransferConfig.kv_role;
  if (typeof rawRole === "string" && STRICT_VALID_KV_ROLES.has(rawRole)) {
    return { connector, missingRole: false, strictRole: rawRole as KvRole };
  }
  return { connector, missingRole: false, invalidRoleValue: rawRole };
}

export function runSingleConfigDoctor(
  commandText: string,
  opts: SingleDoctorOptions,
): SingleConfigDoctorReport {
  const version = opts.version ?? DEFAULT_RULE_VERSION;
  const parsed = parseVllmServeCommand(commandText);
  const rawKvAudit = auditRawKvTransferRole(parsed.kvTransferConfig);

  // Preserve strict case-sensitive kv_role literal from raw JSON before merging overrides
  const { kvRole: parsedKvRole, ...restParsedInput } = parsed.couplingInput;
  const safeParsedKvRole = parsed.kvTransferConfig !== null ? rawKvAudit.strictRole : parsedKvRole;

  // Merge parsed input + hardwareFamily + crossNodeRoce + explicit modelTraitOverride
  const effectiveInput: CouplingCheckInput = {
    ...restParsedInput,
    ...(safeParsedKvRole !== undefined ? { kvRole: safeParsedKvRole } : {}),
    hardwareFamily: opts.hardwareFamily,
    ...(opts.crossNodeRoce !== undefined ? { crossNodeRoce: opts.crossNodeRoce } : {}),
    ...(opts.modelTraitOverride ?? {}),
  };

  // On 310P, when --dtype is omitted or 'auto' and no explicit modelDtype override was given,
  // modern HF checkpoints default to BF16 -> explicitly treat missing float16 as bfloat16 for 310P check
  if (
    effectiveInput.hardwareFamily === "310P" &&
    effectiveInput.modelDtype === undefined &&
    (parsed.rawDtype === undefined || parsed.rawDtype === "auto")
  ) {
    effectiveInput.modelDtype = "bfloat16";
  }

  const findings: DoctorFinding[] = evaluateCommonCliAndEnvFindings(
    parsed,
    effectiveInput,
    "single",
    opts.mode,
    opts.resolveDeepLink,
  );

  // For minimal mode, sanitize advanced flags before resolving batch tokens so SP+PCP never leaks into Ch1
  const batchInput: CouplingCheckInput =
    opts.mode === "minimal"
      ? {
          ...effectiveInput,
          pcpSize: 1,
          dcpSize: 1,
          enableFlashcomm1: false,
          useSequenceParallelMoe: false,
          enableDsaCp: false,
        }
      : effectiveInput;

  const batchTokensResolution = resolveDefaultBatchTokens(batchInput, version);
  const envClassifications = collectEnvClassifications(parsed.envVars, version);

  let deferredAdvancedFeatures: string[] = [];
  let deferredAdvancedPrompt: string | null = null;
  let moeCommSelection: MoeCommSelectionResult | null = null;
  let hcclEstimate: HcclMemoryEstimate | null = null;

  if (opts.mode === "minimal") {
    // STRICT ZERO DAG INVERSION: only evaluate Chapter 1 single-node fundamentals
    deferredAdvancedFeatures = detectDeferredAdvancedFeatures(parsed, effectiveInput);
    deferredAdvancedPrompt = deferredAdvancedFeatures.length > 0 ? DEFERRED_ADVANCED_BRIDGE_PROMPT : null;

    const fullEval = evaluateCouplingRules(batchInput, version);
    for (const m of fullEval.matches) {
      if (!MINIMAL_ALLOWED_RULE_IDS.has(m.ruleId)) continue;
      findings.push(ruleMatchToFinding(m, "single", opts.resolveDeepLink));
    }
  } else {
    // Full mode: evaluate all 5 rule domains + MoE comm strategy + HCCL domain memory
    const fullEval = evaluateCouplingRules(effectiveInput, version);
    for (const m of fullEval.matches) {
      if (rawKvAudit.invalidRoleValue !== undefined && m.ruleId === "d4-kv-connector-missing-kv-role") {
        continue;
      }
      findings.push(ruleMatchToFinding(m, "single", opts.resolveDeepLink));
    }
    if (rawKvAudit.invalidRoleValue !== undefined) {
      const { wikiRefs, deepLinks } = resolveWikiRefs("d4-kv-role-invalid-literal", opts.resolveDeepLink);
      findings.push({
        id: "d4-kv-role-invalid-literal",
        scope: "single",
        category: "pd",
        domain: "cp-pd",
        title: "--kv-transfer-config 中的 kv_role 字面量非法（严格区分大小写）",
        judgment: "error",
        evidenceLevel: "C",
        sources: [KV_TRANSFER_ROLE_SOURCE],
        message: `ValueError: 原始 --kv-transfer-config 中 kv_role=${JSON.stringify(rawKvAudit.invalidRoleValue)} 非法；上游 vLLM KVTransferConfig 使用严格区分大小写的 Literal["kv_producer", "kv_consumer", "kv_both"]，不能忽略大小写放行。`,
        remediation:
          '将 --kv-transfer-config 中的 kv_role 改为严格小写的 "kv_producer"、"kv_consumer" 或 "kv_both"。',
        wikiRefs,
        deepLinks,
      });
    } else if (rawKvAudit.missingRole && !findings.some((f) => f.id === "d4-kv-connector-missing-kv-role")) {
      const { wikiRefs, deepLinks } = resolveWikiRefs(
        "d4-kv-connector-missing-kv-role",
        opts.resolveDeepLink,
      );
      findings.push({
        id: "d4-kv-connector-missing-kv-role",
        scope: "single",
        category: "pd",
        domain: "cp-pd",
        title: "配置 kv_connector 时缺少或传入非法 kv_role",
        judgment: "error",
        evidenceLevel: "C",
        sources: [KV_TRANSFER_ROLE_SOURCE],
        message: `ValueError: 原始 --kv-transfer-config 已配置 kv_connector='${rawKvAudit.connector}' 但缺少必填的 kv_role（kv_role=None 时 KVTransferConfig 直接报错）。`,
        remediation:
          '在 --kv-transfer-config 中显式补充 kv_role：Prefill 实例设为 "kv_producer"，Decode 实例设为 "kv_consumer"，混部实例设为 "kv_both"。',
        wikiRefs,
        deepLinks,
      });
    }
    if (effectiveInput.isMoe) {
      moeCommSelection = selectMoeCommMethod(effectiveInput, version);
    }
    hcclEstimate = estimateHcclDomainMemory(effectiveInput, version);
  }

  const effectiveRewrites = buildEffectiveRewrites(
    parsed,
    batchInput,
    batchTokensResolution,
    findings,
    version,
  );

  const errors = findings.filter((f) => f.judgment === "error");
  const silentRewrites = findings.filter((f) => f.judgment === "silent-rewrite");
  const warnings = findings.filter((f) => f.judgment === "warn");
  const unknowns = findings.filter((f) => f.judgment === "unknown");

  return {
    mode: opts.mode,
    hardwareFamily: opts.hardwareFamily,
    version,
    parsed,
    effectiveInput,
    findings,
    errors,
    silentRewrites,
    warnings,
    unknowns,
    hasBlockers: errors.length > 0,
    envClassifications,
    effectiveRewrites,
    batchTokensResolution,
    moeCommSelection,
    hcclEstimate,
    deferredAdvancedFeatures,
    deferredAdvancedPrompt,
    relatedWikiIds: collectRelatedWikiIds(findings),
  };
}

function retagScope(findings: readonly DoctorFinding[], scope: DoctorScope): DoctorFinding[] {
  return findings.map((f) => ({ ...f, scope }));
}

function resolveEffectiveBlockSize(input: CouplingCheckInput): number {
  if (input.blockSize !== undefined) return input.blockSize;
  if (input.cacheDtype === "mxfp8") return 512;
  return 128;
}

function normalizeEffectiveCacheDtype(input: CouplingCheckInput): string {
  const raw = input.cacheDtype?.toLowerCase();
  if (!raw || raw === "auto") return input.modelDtype ?? "bfloat16";
  return raw;
}

export function runPdConfigDoctor(
  prefillCommandText: string,
  decodeCommandText: string,
  opts: PdDoctorOptions,
): PdConfigDoctorReport {
  const version = opts.version ?? DEFAULT_RULE_VERSION;
  const prefillHardwareFamily = opts.hardwareFamily;
  const decodeHardwareFamily = opts.decodeHardwareFamily ?? opts.hardwareFamily;

  const parsedP = parseVllmServeCommand(prefillCommandText);
  const parsedD = parseVllmServeCommand(decodeCommandText);
  const pRawKvAudit = auditRawKvTransferRole(parsedP.kvTransferConfig);
  const dRawKvAudit = auditRawKvTransferRole(parsedD.kvTransferConfig);

  const prefillExplicitRole =
    opts.prefillTraitOverride?.kvRole ?? opts.modelTraitOverride?.kvRole ?? pRawKvAudit.strictRole;
  const decodeExplicitRole =
    opts.decodeTraitOverride?.kvRole ?? opts.modelTraitOverride?.kvRole ?? dRawKvAudit.strictRole;

  const prefillRaw = runSingleConfigDoctor(prefillCommandText, {
    mode: "full",
    hardwareFamily: prefillHardwareFamily,
    version,
    crossNodeRoce: opts.crossNodeRoce,
    modelTraitOverride: {
      ...(opts.modelTraitOverride ?? {}),
      ...(opts.prefillTraitOverride ?? {}),
      ...(prefillExplicitRole !== undefined ? { kvRole: prefillExplicitRole } : {}),
    },
    resolveDeepLink: opts.resolveDeepLink,
  });

  const decodeRaw = runSingleConfigDoctor(decodeCommandText, {
    mode: "full",
    hardwareFamily: decodeHardwareFamily,
    version,
    crossNodeRoce: opts.crossNodeRoce,
    modelTraitOverride: {
      ...(opts.modelTraitOverride ?? {}),
      ...(opts.decodeTraitOverride ?? {}),
      ...(decodeExplicitRole !== undefined ? { kvRole: decodeExplicitRole } : {}),
    },
    resolveDeepLink: opts.resolveDeepLink,
  });

  const prefillFindings = retagScope(prefillRaw.findings, "prefill")
    .filter((f) => f.id !== "d4-mooncake-tp-p-divisible-tp-d")
    .map((f) =>
      f.id === "d4-kv-connector-missing-kv-role"
        ? {
            ...f,
            remediation:
              '在 Prefill 实例 --kv-transfer-config 中显式设置 "kv_role":"kv_producer"（Decode 实例设为 "kv_consumer"）。',
          }
        : f,
    );
  const decodeFindings = retagScope(decodeRaw.findings, "decode")
    .filter((f) => f.id !== "d4-mooncake-tp-p-divisible-tp-d")
    .map((f) =>
      f.id === "d4-kv-connector-missing-kv-role"
        ? {
            ...f,
            remediation:
              '在 Decode 实例 --kv-transfer-config 中显式设置 "kv_role":"kv_consumer"（Prefill 实例设为 "kv_producer"）。',
          }
        : f,
    );
  const prefillErrors = prefillFindings.filter((f) => f.judgment === "error");
  const prefill: SingleConfigDoctorReport = {
    ...prefillRaw,
    findings: prefillFindings,
    errors: prefillErrors,
    silentRewrites: prefillFindings.filter((f) => f.judgment === "silent-rewrite"),
    warnings: prefillFindings.filter((f) => f.judgment === "warn"),
    unknowns: prefillFindings.filter((f) => f.judgment === "unknown"),
    hasBlockers: prefillErrors.length > 0,
  };
  const decodeErrors = decodeFindings.filter((f) => f.judgment === "error");
  const decode: SingleConfigDoctorReport = {
    ...decodeRaw,
    findings: decodeFindings,
    errors: decodeErrors,
    silentRewrites: decodeFindings.filter((f) => f.judgment === "silent-rewrite"),
    warnings: decodeFindings.filter((f) => f.judgment === "warn"),
    unknowns: decodeFindings.filter((f) => f.judgment === "unknown"),
    hasBlockers: decodeErrors.length > 0,
  };

  const crossInstanceFindings: DoctorFinding[] = [];
  const pInput = prefill.effectiveInput;
  const dInput = decode.effectiveInput;
  const pConn = pInput.kvConnector;
  const dConn = dInput.kvConnector;
  const effectiveConnector = pConn ?? dConn;

  // 1. Missing --kv-transfer-config / kv_connector on either instance
  if (!pConn || !dConn) {
    const missing: string[] = [];
    if (!pConn) missing.push("Prefill 端");
    if (!dConn) missing.push("Decode 端");
    const { wikiRefs, deepLinks } = resolveWikiRefs("pd-missing-kv-transfer-config", opts.resolveDeepLink);
    crossInstanceFindings.push({
      id: "pd-missing-kv-transfer-config",
      scope: "cross-instance",
      category: "pd",
      domain: "cp-pd",
      title: "P/D 双实例缺少 --kv-transfer-config 连接器配置",
      judgment: "error",
      evidenceLevel: "C",
      sources: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2151-L2157`,
      ],
      message: `${missing.join("与")}未配置 --kv-transfer-config.kv_connector，无法建立跨实例 KV 传输链路。`,
      remediation: `在 P/D 两侧均传入一致的 --kv-transfer-config（例如 MooncakeConnectorV1，P 端 kv_producer、D 端 kv_consumer）。`,
      wikiRefs,
      deepLinks,
    });
  }

  // 1b. Missing mandatory kv_role when kv_connector is configured on Prefill / Decode
  // Check raw --kv-transfer-config JSON before overrides so caller trait overrides cannot mask missing kv_role
  const pMissingRole =
    pRawKvAudit.missingRole ||
    (Boolean(pConn) && !pInput.kvRole && pRawKvAudit.invalidRoleValue === undefined);
  const dMissingRole =
    dRawKvAudit.missingRole ||
    (Boolean(dConn) && !dInput.kvRole && dRawKvAudit.invalidRoleValue === undefined);
  if (pMissingRole || dMissingRole) {
    const missingRoles: string[] = [];
    if (pMissingRole) missingRoles.push("Prefill 端");
    if (dMissingRole) missingRoles.push("Decode 端");
    const { wikiRefs, deepLinks } = resolveWikiRefs("pd-missing-kv-role", opts.resolveDeepLink);
    crossInstanceFindings.push({
      id: "pd-missing-kv-role",
      scope: "cross-instance",
      category: "pd",
      domain: "cp-pd",
      title: "P/D 实例配置了 kv_connector 但未显式指定 kv_role",
      judgment: "error",
      evidenceLevel: "C",
      sources: [KV_TRANSFER_ROLE_SOURCE],
      message: `ValueError: ${missingRoles.join("与")}已设置 kv_connector 但缺少必填的 kv_role（kv_role=None 时 KVTransferConfig 直接报错退出）。`,
      remediation:
        '在 Prefill 实例 --kv-transfer-config 中显式补充 "kv_role":"kv_producer"，在 Decode 实例 --kv-transfer-config 中显式补充 "kv_role":"kv_consumer"。',
      wikiRefs,
      deepLinks,
    });
  }

  // 2. Explicit kv_role inversion
  if (pRawKvAudit.strictRole === "kv_consumer" || dRawKvAudit.strictRole === "kv_producer") {
    const { wikiRefs, deepLinks } = resolveWikiRefs("pd-role-mismatch", opts.resolveDeepLink);
    crossInstanceFindings.push({
      id: "pd-role-mismatch",
      scope: "cross-instance",
      category: "pd",
      domain: "cp-pd",
      title: "P/D 节点 kv_role 角色配置颠倒",
      judgment: "error",
      evidenceLevel: "C",
      sources: [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/kv_transfer.py#L12`],
      message: `Prefill 端应为 kv_producer（当前 ${pInput.kvRole ?? "未指定"}），Decode 端应为 kv_consumer（当前 ${dInput.kvRole ?? "未指定"}）。`,
      remediation: "将 Prefill 实例设为 kv_role='kv_producer'，Decode 实例设为 kv_role='kv_consumer'。",
      wikiRefs,
      deepLinks,
    });
  }

  // 3. Mismatched kv_connector between Prefill & Decode
  if (pConn && dConn && pConn !== dConn) {
    const { wikiRefs, deepLinks } = resolveWikiRefs("pd-connector-mismatch", opts.resolveDeepLink);
    crossInstanceFindings.push({
      id: "pd-connector-mismatch",
      scope: "cross-instance",
      category: "pd",
      domain: "cp-pd",
      title: "Prefill 与 Decode 的 kv_connector 不一致",
      judgment: "error",
      evidenceLevel: "C",
      sources: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2226-L2241`,
      ],
      message: `Prefill 使用 '${pConn}'，Decode 使用 '${dConn}'，两侧 KV 传输连接器协议不匹配。`,
      remediation:
        "将 P/D 两侧统一为同一个连接器（如同为 MooncakeConnectorV1 或同为 MooncakeLayerwiseConnector）。",
      wikiRefs,
      deepLinks,
    });
  }

  // 4. Mooncake TP_P % TP_D == 0 via domain4 rule
  const tpRule = getCouplingRuleById("d4-mooncake-tp-p-divisible-tp-d");
  if (tpRule && effectiveConnector) {
    const tpMatch = tpRule.evaluate(
      {
        kvConnector: effectiveConnector,
        prefillTpSize: Math.max(1, pInput.tpSize ?? 1),
        decodeTpSize: Math.max(1, dInput.tpSize ?? 1),
      },
      version,
    );
    const alreadyEmitted =
      prefillFindings.some((f) => f.id === "d4-mooncake-tp-p-divisible-tp-d") ||
      decodeFindings.some((f) => f.id === "d4-mooncake-tp-p-divisible-tp-d");
    if (tpMatch && !alreadyEmitted) {
      crossInstanceFindings.push(ruleMatchToFinding(tpMatch, "cross-instance", opts.resolveDeepLink));
    }
  }

  // 5. Mooncake GQA + C8 cross-instance check via domain4 rule
  const c8Rule = getCouplingRuleById("d4-mooncake-gqa-c8-forbidden");
  const eitherC8 = Boolean(
    pInput.enableC8Quant ||
      dInput.enableC8Quant ||
      pInput.cacheDtype === "int8" ||
      dInput.cacheDtype === "int8",
  );
  if (c8Rule && effectiveConnector && eitherC8) {
    const alreadyEmitted =
      prefillFindings.some((f) => f.id === "d4-mooncake-gqa-c8-forbidden") ||
      decodeFindings.some((f) => f.id === "d4-mooncake-gqa-c8-forbidden");
    if (!alreadyEmitted) {
      const numAttentionHeads = pInput.numAttentionHeads ?? dInput.numAttentionHeads;
      const numKvHeads = pInput.numKvHeads ?? dInput.numKvHeads;
      const c8Match = c8Rule.evaluate(
        {
          kvConnector: effectiveConnector,
          enableC8Quant: true,
          useMla: Boolean(pInput.useMla || dInput.useMla),
          usesSfaSparse: Boolean(pInput.usesSfaSparse || dInput.usesSfaSparse),
          ...(numAttentionHeads !== undefined ? { numAttentionHeads } : {}),
          ...(numKvHeads !== undefined ? { numKvHeads } : {}),
        },
        version,
      );
      if (c8Match) {
        crossInstanceFindings.push(ruleMatchToFinding(c8Match, "cross-instance", opts.resolveDeepLink));
      }
    }
  }

  // 6. Mismatched effective block_size
  const pBlockSize = resolveEffectiveBlockSize(pInput);
  const dBlockSize = resolveEffectiveBlockSize(dInput);
  if (pBlockSize !== dBlockSize) {
    const { wikiRefs, deepLinks } = resolveWikiRefs("pd-block-size-mismatch", opts.resolveDeepLink);
    crossInstanceFindings.push({
      id: "pd-block-size-mismatch",
      scope: "cross-instance",
      category: "pd",
      domain: "cp-pd",
      title: "Prefill 与 Decode 的 KV block_size 不一致",
      judgment: "error",
      evidenceLevel: "C",
      sources: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2212`,
      ],
      message: `Prefill 生效 block_size=${pBlockSize}，Decode 生效 block_size=${dBlockSize}，分页块大小不一致会导致跨实例块映射错位。`,
      remediation: "将 P/D 两侧显式统一为相同的 --block-size（常规 128，MXFP8 需为 512 倍数）。",
      wikiRefs,
      deepLinks,
    });
  }

  // 7. Incompatible kv_cache_dtype between Prefill & Decode
  const pCacheDtype = normalizeEffectiveCacheDtype(pInput);
  const dCacheDtype = normalizeEffectiveCacheDtype(dInput);
  if (pCacheDtype !== dCacheDtype) {
    const { wikiRefs, deepLinks } = resolveWikiRefs("pd-kv-cache-dtype-mismatch", opts.resolveDeepLink);
    crossInstanceFindings.push({
      id: "pd-kv-cache-dtype-mismatch",
      scope: "cross-instance",
      category: "pd",
      domain: "cp-pd",
      title: "Prefill 与 Decode 的 kv_cache_dtype 不兼容",
      judgment: "error",
      evidenceLevel: "C",
      sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L1019-L1043`],
      message: `Prefill 侧 KV 精度为 '${pCacheDtype}'，Decode 侧为 '${dCacheDtype}'，跨实例直传会导致字节布局或位宽不匹配。`,
      remediation:
        "统一 P/D 两侧 --kv-cache-dtype，或按量化方案切换为支持传输前逐层量化的 MooncakeLayerwiseConnector。",
      wikiRefs,
      deepLinks,
    });
  }

  // 8. Mismatched model --dtype between Prefill & Decode
  if (pInput.modelDtype && dInput.modelDtype && pInput.modelDtype !== dInput.modelDtype) {
    const { wikiRefs, deepLinks } = resolveWikiRefs("pd-model-dtype-mismatch", opts.resolveDeepLink);
    crossInstanceFindings.push({
      id: "pd-model-dtype-mismatch",
      scope: "cross-instance",
      category: "pd",
      domain: "cp-pd",
      title: "Prefill 与 Decode 的模型计算精度 (--dtype) 不一致",
      judgment: "error",
      evidenceLevel: "C",
      sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L1019-L1043`],
      message: `Prefill 侧 --dtype=${pInput.modelDtype} 与 Decode 侧 --dtype=${dInput.modelDtype} 不一致。`,
      remediation: "保持 P/D 双实例采用一致的模型精度（如两侧均为 bfloat16）。",
      wikiRefs,
      deepLinks,
    });
  }

  const allFindings = [...crossInstanceFindings, ...prefillFindings, ...decodeFindings];
  const errors = allFindings.filter((f) => f.judgment === "error");
  const silentRewrites = allFindings.filter((f) => f.judgment === "silent-rewrite");
  const warnings = allFindings.filter((f) => f.judgment === "warn");
  const unknowns = allFindings.filter((f) => f.judgment === "unknown");

  return {
    version,
    prefillHardwareFamily,
    decodeHardwareFamily,
    prefill,
    decode,
    crossInstanceFindings,
    allFindings,
    errors,
    silentRewrites,
    warnings,
    unknowns,
    hasBlockers: errors.length > 0,
    relatedWikiIds: collectRelatedWikiIds(allFindings),
  };
}
