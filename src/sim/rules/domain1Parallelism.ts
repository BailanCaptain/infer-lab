import { isFusedMc2SilentlyReset, selectMoeCommMethod } from "./moeComm";
import {
  type CouplingCheckInput,
  type CouplingRule,
  DEFAULT_RULE_VERSION,
  isVersionSupported,
  type RuleMatch,
  type RuleVersion,
  VERIFIED_COMMITS,
} from "./types";

function isAscendSpRequested(input: CouplingCheckInput, version: RuleVersion): boolean {
  if (version === "rfork") {
    return Boolean(input.enableFlashcomm1);
  }
  return Boolean(input.enableFlashcomm1 || input.useSequenceParallelMoe);
}

function isFlashcomm1Supported(input: CouplingCheckInput): boolean {
  const tp = Math.max(1, input.tpSize ?? 1);
  const pp = Math.max(1, input.ppSize ?? 1);
  const moeSp = Boolean(input.isMoe && input.enableExpertParallel);
  const denseSp = Boolean(input.isQwen35Dense && tp > 1 && pp === 1);
  return tp > 1 && pp === 1 && (moeSp || denseSp);
}

export const domain1Rules: readonly CouplingRule[] = [
  {
    id: "d1-tp-collective-pattern",
    domain: "parallelism-moe",
    title: "Tensor Parallel AllReduce / AllGather Intra-Node HCCS Coupling",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/model_executor/layers/linear.py#L608-L610`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/model_executor/layers/linear.py#L1775-L1776`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/model_executor/layers/vocab_parallel_embedding.py#L548-L555`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/model_executor/layers/logits_processor.py#L124-L134`,
    ],
    description:
      "ColumnParallel/RowParallel layers execute 2 blocking All-Reduces per Transformer block plus vocabulary/logits All-Gather, requiring high-bandwidth intra-node HCCS/UB.",
    rationale:
      "High-frequency per-layer collectives stall immediately over cross-node RoCE; TP should remain confined within an HCCS/UB superpod domain.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const tp = Math.max(1, input.tpSize ?? 1);
      if (tp <= 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `TP=${tp} triggers 2x All-Reduce per layer plus vocab/logits All-Gather across TP ranks; keep TP inside intra-node HCCS/UB.`,
      };
    },
  },
  {
    id: "d1-pp-async-send-recv",
    domain: "parallelism-moe",
    title: "Pipeline Parallel Async P2P Send/Recv Communication",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/distributed/parallel_state.py#L1067-L1346`],
    description:
      "Pipeline Parallelism exchanges activations between stages via non-blocking torch.distributed isend/irecv tensor dicts.",
    rationale:
      "P2P inter-stage transfers tolerate inter-node RoCE far better than TP All-Reduce, but introduce pipeline bubbles unless microbatch/chunking is tuned.",
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
        message: `PP=${pp} communicates across stages via async isend_tensor_dict/irecv_tensor_dict.`,
      };
    },
  },
  {
    id: "d1-sp-pp-rms-norm-rewrite",
    domain: "parallelism-moe",
    title: "SP + PP>1 Forces +rms_norm Custom Op (v0.30.0)",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/vllm.py#L1877-L1899`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/compilation/passes/fusion/sequence_parallelism.py#L162-L179`,
    ],
    description:
      "In v0.30.0 (vllm@ced6857a), enabling PassConfig.enable_sp with PP>1 silently appends '+rms_norm' to compilation_config.custom_ops (or warns of likely error if '-rms_norm' is explicitly set).",
    rationale:
      "SequenceParallelismPass rewrites all_reduce -> rms_norm into reduce_scatter -> rms_norm -> all_gather and relies on custom rms_norm across PP stages.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pp = Math.max(1, input.ppSize ?? 1);
      if (!input.enableSp || pp <= 1) return null;
      const customOps = input.customOps ?? [];
      if (customOps.includes("-rms_norm")) {
        return {
          ruleId: this.id,
          domain: this.domain,
          title: this.title,
          version,
          judgment: "warn",
          evidenceLevel: this.evidenceLevel,
          sources: this.sources,
          message:
            "PassConfig.enable_sp with PP>1 and '-rms_norm' in custom_ops logs warning that native rms_norm is unsupported and will likely error.",
          remediation: "Remove '-rms_norm' from compilation_config.custom_ops or disable SP/PP.",
        };
      }
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: "silent-rewrite",
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          "PassConfig.enable_sp with PP>1 silently appends '+rms_norm' to compilation_config.custom_ops.",
        effectiveMutation: { customOpsAppended: "+rms_norm" },
      };
    },
  },
  {
    id: "d1-sp-pp-removed-in-main",
    domain: "parallelism-moe",
    title: "Upstream PassConfig.enable_sp Removed in main",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["main"],
    sources: [
      `vllm@${VERIFIED_COMMITS.vllmMainVerified}:vllm/config/compilation.py#L204-L237`,
      `vllm@${VERIFIED_COMMITS.vllmMainVerified}:vllm/config/parallel.py#L859`,
    ],
    description:
      "In upstream vllm@ba15685a (main), PassConfig.enable_sp and SequenceParallelismPass (+rms_norm rewrite) were removed; only parallel_config.use_sequence_parallel_moe and Ascend FlashComm1 remain.",
    rationale:
      "Rules or configs referencing v0.30.0 PassConfig.enable_sp +rms_norm injection do not apply on main.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.enableSp) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          "Upstream vllm main removed PassConfig.enable_sp and the PP>1 '+rms_norm' rewrite; use use_sequence_parallel_moe / Ascend FlashComm1 instead.",
      };
    },
  },
  {
    id: "d1-ascend-sp-tp-gt-1",
    domain: "parallelism-moe",
    title: "Ascend Sequence Parallelism Requires tp_size > 1",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1437-L1439`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1071-L1083`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1724-L1726`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/utils.py#L1050-L1080`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L758-L761`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/utils.py#L861-L889`,
    ],
    description:
      "NPUPlatform.check_and_update_config raises AssertionError if enable_sp is active with tp_size <= 1.",
    rationale: "Reduce-Scatter and All-Gather sequence parallelism cannot partition across a single TP rank.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const tp = Math.max(1, input.tpSize ?? 1);
      const spRequested = isAscendSpRequested(input, version);
      if (!spRequested || tp > 1) return null;
      if (
        version !== "rfork" &&
        input.enableFlashcomm1 &&
        !input.useSequenceParallelMoe &&
        !isFlashcomm1Supported(input)
      ) {
        // FlashComm1 alone logs warning and disables itself when unsupported in v0.30.0/main.
        return null;
      }
      const sources =
        version === "main"
          ? [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1724-L1726`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/utils.py#L1050-L1080`,
            ]
          : version === "rfork"
            ? [
                `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L758-L761`,
                `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/utils.py#L861-L889`,
              ]
            : [
                `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1437-L1439`,
                `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1071-L1083`,
              ];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources,
        message: "AssertionError: Sequence parallelism is only supported when tp_size > 1.",
        remediation: "Set --tensor-parallel-size >= 2 or disable sequence parallelism.",
      };
    },
  },
  {
    id: "d1-ascend-sp-moe-requires-ep",
    domain: "parallelism-moe",
    title: "Ascend Sequence Parallelism on MoE Requires enable_expert_parallel=True",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1441-L1442`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1071-L1083`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1727-L1729`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/utils.py#L1050-L1080`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L763-L765`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/utils.py#L861-L889`,
    ],
    description:
      "NPUPlatform raises AssertionError when sequence parallelism is active for an MoE model without --enable-expert-parallel.",
    rationale:
      "MoE sequence parallelism coordinates expert all-to-all / reduce-scatter boundaries across EP groups.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const tp = Math.max(1, input.tpSize ?? 1);
      if (!input.isMoe || input.enableExpertParallel || tp <= 1) return null;
      const spActive =
        version === "rfork" ? Boolean(input.enableFlashcomm1) : Boolean(input.useSequenceParallelMoe);
      if (!spActive) return null;
      const sources =
        version === "main"
          ? [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1727-L1729`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/utils.py#L1050-L1080`,
            ]
          : version === "rfork"
            ? [
                `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L763-L765`,
                `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/utils.py#L861-L889`,
              ]
            : [
                `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1441-L1442`,
                `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1071-L1083`,
              ];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources,
        message: "AssertionError: Sequence parallelism requires enable_expert_parallel=True for MoE models.",
        remediation: "Add --enable-expert-parallel or disable sequence parallelism.",
      };
    },
  },
  {
    id: "d1-flashcomm1-unsupported-disable",
    domain: "parallelism-moe",
    title: "FlashComm1 Unsupported Config Warning & Disable",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L765-L780`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1031-L1068`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L865-L871`,
    ],
    description:
      "When FlashComm1 is requested without tp_size > 1, pp_size == 1, and an SP-capable model (MoE with EP or dense Qwen3.5), AscendConfig logs a warning and disables it.",
    rationale: "Prevents unsupported dense or PP>1 models from entering FlashComm1 SP paths.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.enableFlashcomm1 || isFlashcomm1Supported(input)) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          "FlashComm1 enabled on unsupported config (requires tp>1, pp==1, and MoE+EP or Qwen3.5 dense); silently disabled.",
        effectiveMutation: { flashcomm1Active: false },
      };
    },
  },
  {
    id: "d1-flashcomm1-disables-quantized-ar",
    domain: "parallelism-moe",
    title: "FlashComm1/SP Silently Disables quantized_all_reduce_config (main)",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L856-L884`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/patch/platform/patch_parallel_config.py#L7-L28`,
      `vllm@${VERIFIED_COMMITS.vllmMainVerified}:vllm/config/parallel.py#L229`,
      `vllm@${VERIFIED_COMMITS.vllmMainFetched}:vllm/config/parallel.py#L128-L146`,
      `vllm@${VERIFIED_COMMITS.vllmMainFetched}:vllm/config/parallel.py#L332`,
    ],
    description:
      "In vllm-ascend main (8d6180e2), active FlashComm1 + use_sequence_parallel_moe (enabled by default via all2all_backend='allgather_reducescatter' / 'auto' and patch_parallel_config.py including DP=1) silently forces quantized_all_reduce_config.enable = False (regardless of pp_size).",
    rationale:
      "Sequence parallelism replaces TP All-Reduce with Reduce-Scatter/All-Gather, so the int8 quantized All-Reduce wrapper would never be invoked.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const tp = Math.max(1, input.tpSize ?? 1);
      const moeSpActive = Boolean(
        input.enableFlashcomm1 &&
          input.useSequenceParallelMoe !== false &&
          input.isMoe &&
          input.enableExpertParallel &&
          tp > 1,
      );
      if (!moeSpActive || !input.quantizedAllReduceEnabled) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: "FlashComm1/SP silently sets additional_config.quantized_all_reduce_config.enable = False.",
        effectiveMutation: { quantizedAllReduceEnabled: false },
      };
    },
  },
  {
    id: "d1-roce-pp-dp-moe-exclusion",
    domain: "parallelism-moe",
    title: "Cross-Node RoCE PP>1 + DP>1 MoE Mutual Exclusion (No Startup Guard)",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/pipeline_parallel.md#L438-L440`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:docs/source/user_guide/feature_guide/pipeline_parallel.md#L430-L432`,
    ],
    description:
      "Cross-node MoE deployments over RoCE cannot combine PP > 1 and DP > 1 because MoeDistributeDispatch does not support this combined topology; critically, no Python startup check enforces this.",
    rationale:
      "Verified in pipeline_parallel.md and confirmed absent from platform.py / ascend_config.py startup assertions, creating a silent runtime hang/failure hazard.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pp = Math.max(1, input.ppSize ?? 1);
      const dp = Math.max(1, input.dpSize ?? 1);
      if (!input.isMoe || pp <= 1 || dp <= 1 || input.crossNodeRoce === false) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: input.crossNodeRoce === true ? "error" : "warn",
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          input.crossNodeRoce === true
            ? `Cross-node RoCE MoE deployment with PP=${pp} > 1 and DP=${dp} > 1 is unsupported by MoeDistributeDispatch (and has NO Python startup check!).`
            : `MoE deployment with PP=${pp} > 1 and DP=${dp} > 1 is unsupported over cross-node RoCE (no Python startup guard exists).`,
        remediation: "Set either PP=1 or DP=1 for cross-node RoCE MoE deployments.",
      };
    },
  },
  {
    id: "d1-fused-mc2-silent-reset",
    domain: "parallelism-moe",
    title: "enable_fused_mc2 Silently Reset to 0 When MegaMoe Config Unsupported",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L856-L859`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L87-L97`,
    ],
    description:
      "When is_mega_moe_supported() is true on the model/chip but _is_megamoe_supported_by_config(vc) is false, AscendConfig silently resets enable_fused_mc2 = 0.",
    rationale: "Prevents fused MC2 kernel dispatch on incompatible config shapes without raising an error.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!isFusedMc2SilentlyReset(input, version)) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          "enable_fused_mc2=1 was silently reset to 0 because config does not satisfy MegaMoe constraints.",
        effectiveMutation: { enableFusedMc2: 0 },
      };
    },
  },
  {
    id: "d1-dp-ep-moe-comm-strategy",
    domain: "parallelism-moe",
    title: "DP + EP 4-Family Hardware MoE Communication Dispatch",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L281-L342`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_forward_context.py#L243-L414`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_forward_context.py#L259-L461`,
    ],
    description:
      "Selects ALLGATHER / MC2 / FUSED_MC2 / ALLTOALL per hardware family (A2, A3, 310P, A5/950), LoRA override, dynamic MC2 token capacity, and version-specific A5 world_size handling.",
    rationale:
      "In v0.30.0, A5 erroneously checks world_size_across_dp (including PP); main fixes this to world_size_across_dp // pp_size and refines decode_cudagraph_capture_request_sizes.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.isMoe) return null;
      const result = selectMoeCommMethod(input, version);
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: result.sources,
        message: result.usedWorldSizeAcrossDpBug
          ? `${result.reason} (Note: v0.30.0 A5 uses world_size_across_dp including PP; fixed to world_size_across_dp // pp_size in main.)`
          : result.reason,
        effectiveMutation: {
          moeCommMethod: result.method,
          mc2TokensCapacity: result.mc2TokensCapacity,
        },
      };
    },
  },
  {
    id: "d1-idle-dp-dummy-batch",
    domain: "parallelism-moe",
    title: "Idle DP Group Must Execute Dummy Batch Synchronization",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/v1/engine/core.py#L2204-L2227`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/parallel.py#L770-L779`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/worker.py#L1278-L1281`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/developer_guide/Design_Documents/balance_schedule_refactor.md#L194-L197`,
    ],
    description:
      "When dp_size > 1 and any DP group has unfinished requests, locally idle DP ranks must execute execute_dummy_batch() (_dummy_run) so EP/DP collectives do not deadlock.",
    rationale:
      "DPEngineCoreProc.run_busy_loop and external_launcher coordinate across all DP ranks via all-reduce MAX on unfinished state.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const dp = Math.max(1, input.dpSize ?? 1);
      if (dp <= 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `DP=${dp} > 1: idle DP ranks automatically run execute_dummy_batch() (_dummy_run) whenever any DP rank has active requests.`,
      };
    },
  },
];

export function evaluateDomain1Rules(
  input: CouplingCheckInput,
  version: RuleVersion = DEFAULT_RULE_VERSION,
): readonly RuleMatch[] {
  const matches: RuleMatch[] = [];
  for (const rule of domain1Rules) {
    const match = rule.evaluate(input, version);
    if (match) matches.push(match);
  }
  return matches;
}
