import {
  type CouplingCheckInput,
  type CouplingRule,
  DEFAULT_RULE_VERSION,
  isVersionSupported,
  type RuleMatch,
  type RuleVersion,
  VERIFIED_COMMITS,
} from "./types";

const MOONCAKE_NON_LAYERWISE_CONNECTORS = new Set([
  "MooncakeConnector",
  "MooncakeConnectorV1",
  "MooncakeConnectorV2",
]);

function isAnyMooncakeConnector(connector: string | undefined): boolean {
  if (!connector) return false;
  return MOONCAKE_NON_LAYERWISE_CONNECTORS.has(connector) || connector === "MooncakeLayerwiseConnector";
}

export const domain4Rules: readonly CouplingRule[] = [
  {
    id: "d4-ulysses-ring-no-runtime-flags",
    domain: "cp-pd",
    title: "Ulysses / Ring CP Have Zero Runtime Flags in vllm / vllm-ascend",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/context_parallel.md#L18-L61`,
    ],
    description:
      "Ulysses and Ring Attention are architectural comparison routes only (zero runtime flags in vllm or vllm-ascend); Ascend implements Context Parallelism via PCP + DCP.",
    rationale: "Prevents configuring non-existent CLI flags for Ulysses/Ring CP.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.cpRoute !== "ulysses" && input.cpRoute !== "ring") return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `CP route '${input.cpRoute}' has 0 runtime flags in vllm/vllm-ascend; Ascend implements context parallelism via PCP + DCP.`,
      };
    },
  },
  {
    id: "d4-pcp-requires-mrv2",
    domain: "cp-pd",
    title: "PCP > 1 Without ModelRunner V2 Raises ValueError (Not Silent Force)",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1650-L1657`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L2105-L2112`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/context_parallel.md#L54-L61`,
    ],
    description:
      "Prefill Context Parallelism (PCP > 1) requires VLLM_USE_V2_MODEL_RUNNER=1 (use_v2_model_runner=True) and raises ValueError otherwise; it does NOT silently enable MRV2.",
    rationale: "Upstream v1 model runner lacks Ascend PCP support without MRV2.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pcp = input.pcpSize ?? 1;
      if (pcp <= 1 || input.useV2ModelRunner) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError: PCP=${pcp} > 1 requires use_v2_model_runner (VLLM_USE_V2_MODEL_RUNNER=1); platform.py does NOT silently force MRV2.`,
        remediation: "Export VLLM_USE_V2_MODEL_RUNNER=1 or set --prefill-context-parallel-size 1.",
      };
    },
  },
  {
    id: "d4-pcp-full-cudagraph-unsupported",
    domain: "cp-pd",
    title: "PCP > 1 Does Not Support FULL CUDAGraph Mode",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/context_parallel.md#L22-L26`,
    ],
    description: "context_parallel.md specifies that FULL cudagraph mode is unsupported when PCP > 1.",
    rationale: "PCP graph capture is only partially compatible with ACLGraph modes.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pcp = input.pcpSize ?? 1;
      if (pcp <= 1 || input.cudagraphMode !== "FULL") return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `FULL cudagraph_mode is unsupported with PCP=${pcp} > 1.`,
        remediation: "Use PIECEWISE or FULL_DECODE_ONLY instead of FULL when PCP > 1.",
      };
    },
  },
  {
    id: "d4-dsa-cp-pcp-mutex",
    domain: "cp-pd",
    title: "enable_dsa_cp Mutually Exclusive with PCP > 1 (v0.30.0)",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L697-L702`],
    description:
      "In v0.30.0, AscendConfig raises ValueError when enable_dsa_cp and prefill_context_parallel_size > 1 are both enabled (enable_dsa_cp was removed in main).",
    rationale: "DSA-CP and PCP manage context partitioning independently.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const pcp = input.pcpSize ?? 1;
      if (!input.enableDsaCp || pcp <= 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: "ValueError: DSA-CP and PCP > 1 cannot be enabled at the same time.",
        remediation: "Remove enable_dsa_cp when using PCP > 1.",
      };
    },
  },
  {
    id: "d4-dsa-cp-mrv2-v030",
    domain: "cp-pd",
    title: "DSA-CP Rejected on ModelRunner V2 (v0.30.0 Only)",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L703-L708`],
    description:
      "In v0.30.0, enable_dsa_cp with use_v2_model_runner raises ValueError; this rejection (and enable_dsa_cp) was removed in main.",
    rationale: "MRV2 support / DSA-CP deprecation landed after v0.30.0.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.enableDsaCp || !input.useV2ModelRunner) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: "ValueError: In v0.30.0, DSA-CP is not supported by Model Runner V2.",
        remediation: "Disable VLLM_USE_V2_MODEL_RUNNER or use PCP instead of DSA-CP on v0.30.0.",
      };
    },
  },
  {
    id: "d4-pcp-dcp-sizing",
    domain: "cp-pd",
    title: "PCP + DCP Group Sizing & GQA/SFA Divisibility Constraints",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/parallel.py#L558-L571`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/model.py#L1445-L1474`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1674-L1701`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L2153-L2166`,
    ],
    description:
      "Enforces pcp==1 -> tp%dcp==0; pcp>1 -> dcp in {1, pcp, tp*pcp}; GQA/MQA pcp>1 & dcp>1 -> pcp==dcp plus KV head divisibility; and SFA replicated indexer -> dcp in {pcp, tp*pcp}.",
    rationale:
      "KV cache interleave/layout between prefill and decode requires compatible PCP/DCP/TP/KV-head multiples.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const tp = Math.max(1, input.tpSize ?? 1);
      const pcp = Math.max(1, input.pcpSize ?? 1);
      const dcp = Math.max(1, input.dcpSize ?? 1);
      const errors: string[] = [];

      if (pcp === 1 && dcp > 1 && tp % dcp !== 0) {
        errors.push(`when pcp=1, tp (${tp}) must be divisible by dcp (${dcp})`);
      }
      if (pcp > 1 && dcp !== 1 && dcp !== pcp && dcp !== tp * pcp) {
        errors.push(`when pcp=${pcp} > 1, dcp (${dcp}) must be in {1, ${pcp}, ${tp * pcp}}`);
      }

      const isGqaMqa = !input.useMla;
      if (isGqaMqa && dcp > 1) {
        if (pcp > 1 && pcp !== dcp) {
          errors.push(`GQA/MQA PCP+DCP requires pcp (${pcp}) == dcp (${dcp})`);
        }
        if (input.numKvHeads !== undefined) {
          if (input.numKvHeads <= 0) {
            errors.push(`GQA/MQA requires total_num_kv_heads > 0 (got ${input.numKvHeads})`);
          } else {
            if (tp <= input.numKvHeads) {
              errors.push(
                `GQA/MQA with dcp>1 requires tp (${tp}) > total_num_kv_heads (${input.numKvHeads})`,
              );
            } else if (dcp > Math.floor(tp / input.numKvHeads)) {
              errors.push(
                `GQA/MQA requires dcp (${dcp}) <= tp // total_num_kv_heads (${Math.floor(tp / input.numKvHeads)})`,
              );
            }
            if (input.numAttentionHeads !== undefined) {
              const groupSize = Math.floor(input.numAttentionHeads / input.numKvHeads);
              if (groupSize % dcp !== 0) {
                errors.push(`GQA/MQA requires (num_heads / num_kv_heads = ${groupSize}) % dcp (${dcp}) == 0`);
              }
            }
          }
        }
      }

      if (input.sfaDcpReplicatedIndexer) {
        if (version === "rfork") {
          if (dcp !== tp) {
            errors.push(`rfork SFA replicated indexer requires dcp (${dcp}) == tp (${tp})`);
          }
          if (input.hardwareFamily === "A5") {
            errors.push("rfork SFA DCP with replicated indexer is not supported on A5");
          }
        } else if (dcp !== pcp && dcp !== tp * pcp) {
          errors.push(`SFA replicated indexer requires dcp (${dcp}) in {${pcp}, ${tp * pcp}}`);
        }
      }

      if (errors.length === 0) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError / AssertionError: PCP/DCP sizing invalid: ${errors.join("; ")}.`,
      };
    },
  },
  {
    id: "d4-mooncake-decode-pp-eq-1",
    domain: "cp-pd",
    title: "MooncakeConnector Requires D-Node PP == 1",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2240-L2241`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/pipeline_parallel.md#L437`,
    ],
    description: "MooncakeConnector / MooncakeConnectorV1 asserts decode_parallel_config['pp_size'] == 1.",
    rationale: "Cross-engine KV pull mapping does not support multi-stage PP on the decode consumer.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!isAnyMooncakeConnector(input.kvConnector)) return null;
      const pp = input.ppSize ?? 1;
      if (input.kvRole !== "kv_consumer" || pp <= 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `AssertionError: ${input.kvConnector} requires D-node (kv_consumer) PP == 1 (got PP=${pp}).`,
        remediation: "Set --pipeline-parallel-size 1 on the Decode node.",
      };
    },
  },
  {
    id: "d4-mooncake-decode-pcp-eq-1",
    domain: "cp-pd",
    title: "MooncakeConnector Requires D-Node PCP == 1",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2153-L2157`,
    ],
    description: "MooncakeConnector raises ValueError if kv_role == 'kv_consumer' and pcp_size > 1.",
    rationale: "Mooncake supports PCP only on the prefill (kv_producer) engine.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!isAnyMooncakeConnector(input.kvConnector)) return null;
      const pcp = input.pcpSize ?? 1;
      if (input.kvRole !== "kv_consumer" || pcp <= 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError: ${input.kvConnector} supports PCP only on P-node; D-node PCP must be 1 (got PCP=${pcp}).`,
      };
    },
  },
  {
    id: "d4-mooncake-pp-pcp-mutex",
    domain: "cp-pd",
    title: "MooncakeConnector Forbids PP > 1 and PCP > 1 Simultaneously",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L2146`,
    ],
    description: "MooncakeConnector asserts not (pp_size > 1 and pcp_size > 1).",
    rationale: "Combined PP and PCP rank mapping is unimplemented in MooncakeConnector.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!isAnyMooncakeConnector(input.kvConnector)) return null;
      const pp = input.ppSize ?? 1;
      const pcp = input.pcpSize ?? 1;
      if (pp <= 1 || pcp <= 1) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `AssertionError: ${input.kvConnector} cannot enable PP (${pp} > 1) and PCP (${pcp} > 1) simultaneously.`,
      };
    },
  },
  {
    id: "d4-mooncake-tp-p-divisible-tp-d",
    domain: "cp-pd",
    title: "MooncakeConnector Requires TP_P % TP_D == 0",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L1212-L1213`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L3612-L3615`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_p2p/mooncake_connector.py#L4041`,
    ],
    description:
      "MooncakeConnector requires prefill_tp_size % decode_tp_size == 0 (explicitly asserted for Hybrid Mamba and assumed in GQA non-replicated KV pull group_size = prefill_tp_size // decode_tp_size).",
    rationale:
      "KV cache head-slice pull assumes each Decode TP rank maps cleanly onto an integer group of Prefill TP ranks.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!isAnyMooncakeConnector(input.kvConnector)) return null;
      if (input.prefillTpSize === undefined || input.decodeTpSize === undefined) return null;
      if (input.prefillTpSize % input.decodeTpSize === 0) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `MooncakeConnector requires TP_P (${input.prefillTpSize}) % TP_D (${input.decodeTpSize}) == 0.`,
        remediation: "Choose TP_P as an integer multiple of TP_D.",
      };
    },
  },
  {
    id: "d4-mooncake-gqa-c8-forbidden",
    domain: "cp-pd",
    title: "MooncakeConnector + GQA + C8 KV Quantization Forbidden (Use MooncakeLayerwiseConnector)",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L1019-L1043`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1629`,
    ],
    description:
      "MooncakeConnector / MooncakeConnectorV1 / MooncakeConnectorV2 with GQA and enable_c8_quant=True raises ValueError because producer stores bf16 while consumer allocates int8; must use MooncakeLayerwiseConnector or disable C8.",
    rationale:
      "Raw Mooncake P2P transfer would reinterpret bf16 bytes as int8 without layerwise pre-transfer quantization.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.kvConnector || !MOONCAKE_NON_LAYERWISE_CONNECTORS.has(input.kvConnector)) return null;
      const isMha =
        input.numAttentionHeads !== undefined &&
        input.numKvHeads !== undefined &&
        input.numAttentionHeads === input.numKvHeads;
      const isGqa = !input.useMla && !input.usesSfaSparse && !isMha;
      if (!isGqa || !input.enableC8Quant) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError: ${input.kvConnector} does not support C8 KV cache quantization on GQA models.`,
        remediation: "Switch to MooncakeLayerwiseConnector or disable C8 KV cache quantization.",
      };
    },
  },
  {
    id: "d4-recompute-scheduler-p-node-disable",
    domain: "cp-pd",
    title: "recompute_scheduler_enable Silently Disabled on P-Node",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1120-L1133`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1288-L1305`,
    ],
    description:
      "When recompute_scheduler_enable=True on a P-node (kv_role='kv_producer'), NPUPlatform logs a warning and silently sets recompute_scheduler_enable=False.",
    rationale:
      "Recompute scheduling is only meaningful for decode nodes handling KV preemption/recomputation.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.recomputeSchedulerEnable || input.kvRole !== "kv_producer") return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: "recompute_scheduler_enable=True on P-node (kv_producer) is silently disabled to False.",
        effectiveMutation: { recomputeSchedulerEnable: false },
      };
    },
  },
  {
    id: "d4-recompute-scheduler-non-d-node-error",
    domain: "cp-pd",
    title: "recompute_scheduler_enable Rejected on Non-PD or kv_both Instances",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1134-L1146`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1306-L1318`,
    ],
    description:
      "When recompute_scheduler_enable=True with no kv_transfer_config or kv_role='kv_both' (PD-mixed), NPUPlatform raises ValueError.",
    rationale:
      "RecomputeSchedulerConfig is restricted exclusively to PD-disaggregated D-nodes (kv_consumer).",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.recomputeSchedulerEnable) return null;
      if (input.kvRole === "kv_consumer" || input.kvRole === "kv_producer") return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError: recompute_scheduler_enable is only supported on PD-disaggregated D-nodes (kv_role='kv_consumer'), got kv_role=${input.kvRole ?? "None"}.`,
      };
    },
  },
  {
    id: "d4-finegrained-tp-requires-recompute",
    domain: "cp-pd",
    title: "finegrained_tp_config Requires recompute_scheduler_enable=True",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L830-L838`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L899-L906`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L164-L173`,
    ],
    description:
      "Enabling finegrained_tp_config (oproj/mlp > 0 in v0.30.0, > 1 in main; oproj/embedding > 0 in rfork) raises AssertionError unless recompute_scheduler_enable=True.",
    rationale: "Recompute scheduler keeps decode-node steps decode-shaped for fine-grained TP.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const oproj = input.oprojTensorParallelSize ?? 0;
      const mlp = input.mlpTensorParallelSize ?? 0;
      const embed = input.embeddingTensorParallelSize ?? 0;
      const triggered =
        version === "rfork"
          ? oproj > 0 || embed > 0
          : version === "main"
            ? oproj > 1 || mlp > 1
            : oproj > 0 || mlp > 0;
      if (!triggered) return null;
      if (input.recomputeSchedulerEnable) return null;
      const versionSource =
        version === "rfork"
          ? [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L164-L173`]
          : version === "main"
            ? [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L899-L906`]
            : [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L830-L838`];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: versionSource,
        message:
          version === "rfork"
            ? "AssertionError: finegrained_tp_config (oproj_tensor_parallel_size / embedding_tensor_parallel_size) requires recompute_scheduler_enable=True."
            : "AssertionError: finegrained_tp_config (oproj_tensor_parallel_size / mlp_tensor_parallel_size) requires recompute_scheduler_enable=True.",
        remediation: "Enable recompute_scheduler_enable=True on a D-node.",
      };
    },
  },
  {
    id: "d4-sparse-kv-offload-constraints",
    domain: "cp-pd",
    title: "sparse_kv_offload_config D-Node & Topology Exclusions",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L1012-L1017`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L1724-L1772`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L1821-L1867`,
    ],
    description:
      "sparse_kv_offload_config (default keep_device_kv_cache=False) asserts D-node (kv_consumer) only, and rejects Ascend 950, PP>1, PCP*DCP>1, PreemptOffloadConnector, compress_ratios, non-sparse models, DSpark without MRV2, topk_buffer_size < topk, and packed SFA C8/TQ4.",
    rationale:
      "Sparse KV offload alters device cache residency and depends on D-node-only remote KV staging.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.sparseKvOffloadEnabled) return null;
      const errors: string[] = [];
      if (input.hardwareFamily === "A5") errors.push("not supported on Ascend 950 (A5)");
      if (input.hasPreemptOffloadConnector) errors.push("incompatible with PreemptOffloadConnector");
      if (input.hasCompressRatios) errors.push("incompatible with compress_ratios");
      if (input.indexTopk === undefined && !input.usesSfaSparse) {
        errors.push("requires sparse attention model with index_topk");
      }
      if ((input.pcpSize ?? 1) * (input.dcpSize ?? 1) > 1) errors.push("incompatible with PCP/DCP > 1");
      if ((input.ppSize ?? 1) > 1) errors.push("incompatible with PP > 1");
      if (!input.keepDeviceKvCache && input.kvRole !== "kv_consumer") {
        errors.push("default keep_device_kv_cache=False requires PD D-node (kv_role='kv_consumer')");
      }
      if (input.speculativeMethod === "dspark" && !input.useV2ModelRunner) {
        errors.push("DSpark speculative decoding with sparse KV offload requires use_v2_model_runner=True");
      }
      if (
        input.topkBufferSize !== undefined &&
        input.indexTopk !== undefined &&
        input.topkBufferSize < input.indexTopk
      ) {
        errors.push(`topk_buffer_size (${input.topkBufferSize}) must be >= index_topk (${input.indexTopk})`);
      }
      if (input.usesSfaSparse && (input.enableSparseSfaC8 || input.cacheDtype === "turboquant_4bit_nc")) {
        errors.push("incompatible with packed SFA C8 or TurboQuant 4-bit caches");
      }
      if (errors.length === 0) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError / AssertionError: sparse_kv_offload_config invalid: ${errors.join("; ")}.`,
      };
    },
  },
];

export function evaluateDomain4Rules(
  input: CouplingCheckInput,
  version: RuleVersion = DEFAULT_RULE_VERSION,
): readonly RuleMatch[] {
  const matches: RuleMatch[] = [];
  for (const rule of domain4Rules) {
    const match = rule.evaluate(input, version);
    if (match) matches.push(match);
  }
  return matches;
}
