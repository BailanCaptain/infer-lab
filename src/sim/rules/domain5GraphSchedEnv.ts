import {
  type CouplingCheckInput,
  type CouplingRule,
  DEFAULT_RULE_VERSION,
  type EvidenceLevel,
  isVersionSupported,
  type RuleJudgment,
  type RuleMatch,
  type RuleVersion,
  VERIFIED_COMMITS,
} from "./types";

export interface EnvVarClassification {
  name: string;
  version: RuleVersion;
  judgment: "known-read" | "unknown";
  ruleJudgment: RuleJudgment;
  evidenceLevel: EvidenceLevel;
  sources: readonly string[];
  reason: string;
}

export interface KnownEnvSpec {
  versions: readonly RuleVersion[];
  sources: readonly string[];
  note: string;
}

export const KNOWN_READ_ENV_SPECS: Readonly<Record<string, KnownEnvSpec>> = {
  HCCL_SO_PATH: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L69`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L613`,
    ],
    note: "Defined in vllm_ascend/envs.py and read in utils.py.",
  },
  HCCL_BUFFSIZE: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L28-L66`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1259-L1264`,
    ],
    note: "Read in MC2 C++ tiling and governs MC2 PG buffer sizing.",
  },
  HCCL_OP_EXPANSION_MODE: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/device_op.py#L1257`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/patch/platform/patch_minimax_m2_config.py#L118-L120`,
    ],
    note: "Read/written in device_op.py and patch_minimax_m2_config.py.",
  },
  HCCL_DETERMINISTIC: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/batch_invariant.py#L108`],
    note: "Set to 'strict' by batch_invariant mode.",
  },
  HCCL_RDMA_TIMEOUT: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/utils/utils.py#L91`,
    ],
    note: "Read by KV transfer utilities.",
  },
  HCCL_RDMA_RETRY_CNT: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/utils/utils.py#L92`,
    ],
    note: "Read by KV transfer utilities.",
  },
  ASCEND_HOME_PATH: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L66`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/worker.py#L220`,
    ],
    note: "Defined in envs.py and read in worker.py / hixl_compat.py.",
  },
  ASCEND_RT_VISIBLE_DEVICES: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/cpu_binding.py#L25`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/weight_transfer/npu_ipc_engine.py#L85`,
    ],
    note: "Read by vllm and vllm-ascend device visibility/CPU binding.",
  },
  ASCEND_CUSTOM_OPP_PATH: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:csrc/aclnn_torch_adapter/op_api_common.h#L194`],
    note: "Read by C++ custom op loader.",
  },
  ASCEND_OPP_PATH: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:csrc/aclnn_torch_adapter/op_api_common.h#L216`],
    note: "Read by C++ op_api_common.h.",
  },
  ASCEND_GLOBAL_RESOURCE_CONFIG: {
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/utils/utils.py#L27`,
    ],
    note: "Read by Mooncake/KV transfer utilities.",
  },
  ASCEND_ENABLE_USE_FABRIC_MEM: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L202`,
    ],
    note: "Read by Mooncake backend for fabric memory.",
  },
  ASCEND_TRANSFER_TIMEOUT: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/utils/utils.py#L88`,
    ],
    note: "Read/written in Mooncake and SFA PD workers.",
  },
  ASCEND_LOCAL_COMM_RES: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L721`],
    note: "Written in vllm_ascend/utils.py.",
  },
  ASCEND_BUFFER_POOL: {
    versions: ["main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/distributed/ec_transfer/ec_connector/mooncake/store_backend.py#L124-L125`,
    ],
    note: "Docs-only ('unknown') in v0.30.0; explicitly checked in main ec_transfer store_backend.py.",
  },
};

export const DOCS_ONLY_UNKNOWN_HCCL_VARS: readonly string[] = [
  "HCCL_BUFFSIZE_EP",
  "HCCL_ALGO",
  "HCCL_BUFFERSIZE",
  "HCCL_CONNECT_TIMEOUT",
  "HCCL_DFS_CONFIG",
  "HCCL_EXEC_TIMEOUT",
  "HCCL_HOST_SOCKET_PORT_RANGE",
  "HCCL_IF_IP",
  "HCCL_INTRA_PCIE_ENABLE",
  "HCCL_INTRA_ROCE_ENABLE",
  "HCCL_NPU_SOCKET_PORT_RANGE",
  "HCCL_RDMA_SL",
  "HCCL_RDMA_TC",
  "HCCL_SOCKET_IFNAME",
  "HCCL_TRANSFER_TIMEOUT",
];

export const DOCS_ONLY_UNKNOWN_ASCEND_VARS: readonly string[] = [
  "ASCEND_CONNECT_TIMEOUT",
  "ASCEND_DIRECT",
  "ASCEND_DP_ALLREDUCE_ON_NPU",
  "ASCEND_ENABLE_CONTEXT_PARALLEL",
  "ASCEND_ENABLE_DBO",
  "ASCEND_ENABLE_DENSE_OPTIMIZE",
  "ASCEND_ENABLE_FLASHCOMM",
  "ASCEND_ENABLE_FUSED_MC2",
  "ASCEND_ENABLE_MATMUL_ALLREDUCE",
  "ASCEND_ENABLE_MLAPO",
  "ASCEND_ENABLE_MLP_OPTIMIZE",
  "ASCEND_ENABLE_MOE_ALL2ALL_SEQ",
  "ASCEND_ENABLE_NZ",
  "ASCEND_ENABLE_PREFETCH_MLP",
  "ASCEND_ENABLE_QSA_E3V",
  "ASCEND_ENABLE_QSA_LIGHTNING_INDEXER",
  "ASCEND_ENABLE_TOPK_TOPP_OPTIMIZATION",
  "ASCEND_EXTERNAL_DP_LB_ENABLED",
  "ASCEND_FORCE_QSA_REFERENCE",
  "ASCEND_FUSION_OP_TRANSPOSE_KV_CACHE_BY_BLOCK",
  "ASCEND_LLMDD_RPC_PORT",
  "ASCEND_LOCAL_COMM_RES_PATH",
  "ASCEND_MLA_PA",
  "ASCEND_MLA_PARALLEL",
  "ASCEND_MODEL_EXECUTE_TIME_OBSERVE",
  "ASCEND_PATH",
  "ASCEND_PROCESS_LOG_PATH",
  "ASCEND_PROFILER_OUTPUT",
  "ASCEND_TOOLKIT_HOME",
  "ASCEND_TOTAL_MEMORY_GB",
  "ASCEND_VISIBLE_DEVICES",
];

/**
 * Classifies `HCCL_*` and `ASCEND_*` environment variables (P1-4 #2).
 * Any variable with zero in-repo Python/C++ reads (e.g. `HCCL_BUFFSIZE_EP`) MUST
 * evaluate to `ruleJudgment: "unknown"` and `evidenceLevel: "I"`, NEVER `"error"`.
 */
export function classifyEnvVar(
  name: string,
  version: RuleVersion = DEFAULT_RULE_VERSION,
): EnvVarClassification {
  if (Object.hasOwn(KNOWN_READ_ENV_SPECS, name)) {
    const spec = KNOWN_READ_ENV_SPECS[name];
    if (spec?.versions.includes(version)) {
      return {
        name,
        version,
        judgment: "known-read",
        ruleJudgment: "warn",
        evidenceLevel: "C",
        sources: spec.sources,
        reason: spec.note,
      };
    }
  }

  if (name === "HCCL_BUFFSIZE_EP") {
    const sources =
      version === "rfork"
        ? [
            `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/envs.py#L1-L120`,
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/tutorials/models/Qwen3.8-2.4T-A95B.md#L205-L428`,
          ]
        : [
            `vllm-ascend@${version === "main" ? VERIFIED_COMMITS.vllmAscendMain : VERIFIED_COMMITS.vllmAscendV030}:docs/source/tutorials/models/Qwen3.8-2.4T-A95B.md#L205-L428`,
          ];
    return {
      name,
      version,
      judgment: "unknown",
      ruleJudgment: "unknown",
      evidenceLevel: "I",
      sources,
      reason:
        "HCCL_BUFFSIZE_EP has 0 Python/C++ reads in vllm and vllm-ascend and appears only in docs; CANN/HCCL runtime consumption is unverified without pinned CANN docs -> MUST be 'unknown'.",
    };
  }

  const unknownSource =
    version === "rfork"
      ? `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/envs.py#L1-L120`
      : `vllm-ascend@${version === "main" ? VERIFIED_COMMITS.vllmAscendMain : VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L1-L100`;
  return {
    name,
    version,
    judgment: "unknown",
    ruleJudgment: "unknown",
    evidenceLevel: "I",
    sources: [unknownSource],
    reason: `${name} has no verified Python/C++ read in pinned vllm/vllm-ascend for ${version}; CANN/runtime effect cannot be disproven and MUST be classified 'unknown'.`,
  };
}

export const domain5Rules: readonly CouplingRule[] = [
  {
    id: "d5-fa3-full-decode-only-error",
    domain: "graph-sched-env",
    title: "FA3 Rejects FULL_DECODE_ONLY (Requires PIECEWISE)",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/attention/fa3_v1.py#L45-L59`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1484-L1509`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/flash_attention.md#L43-L142`,
    ],
    description:
      "AscendFAImpl (FA3) raises ValueError when cudagraph_mode == FULL_DECODE_ONLY; docs and code require PIECEWISE compilation.",
    rationale: "flash_attn_with_kvcache tiling is host-side and does not support full ACL graph capture.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const fa3Active =
        input.attentionBackend === "FA3" || Boolean(input.rlEnabled && input.rlTrainingConsistency);
      if (!fa3Active || input.cudagraphMode !== "FULL_DECODE_ONLY") return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          "ValueError: AscendFAImpl (FA3) does not support ACL graph capture with FULL_DECODE_ONLY; use PIECEWISE.",
        remediation: "Set compilation_config.cudagraph_mode = 'PIECEWISE'.",
      };
    },
  },
  {
    id: "d5-950-custom-ops-disabled-v030",
    domain: "graph-sched-env",
    title: "Ascend 950 Silently Disables vllm_ascend_C Custom Ops (v0.30.0 / rfork)",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L558-L563`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L333-L380`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/utils.py#L418-L420`,
    ],
    description:
      "In v0.30.0 (A5 omits HardwareCapability.RUNTIME_CUSTOM_OPS) and rfork (get_ascend_device_type() == AscendDeviceType.A5), enable_custom_op() silently returns False and disables vllm_ascend_C.",
    rationale: "Custom op compilation/execution on 950 was temporarily disabled (#7157).",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.hardwareFamily !== "A5") return null;
      const sources =
        version === "rfork"
          ? [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/utils.py#L418-L420`]
          : [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L558-L563`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L333-L380`,
            ];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources,
        message:
          version === "rfork"
            ? "In rfork, Ascend 950 (A5) directly disables vllm_ascend_C custom ops via AscendDeviceType.A5 check."
            : "In v0.30.0, Ascend 950 (A5) lacks RUNTIME_CUSTOM_OPS and silently disables vllm_ascend_C custom ops.",
        effectiveMutation: { runtimeCustomOpsEnabled: false },
      };
    },
  },
  {
    id: "d5-950-custom-ops-enabled-main",
    domain: "graph-sched-env",
    title: "Ascend 950 Enables vllm_ascend_C Custom Ops (main)",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/device/hardware_profile.py#L490`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/utils.py#L583-L590`,
    ],
    description:
      "In vllm-ascend main (8d6180e2), AscendDeviceType.A5 adds RUNTIME_CUSTOM_OPS and removes the 950 custom-op disable workaround (unless VLLM_BATCH_INVARIANT is set).",
    rationale: "950 custom ops support landed on main after v0.30.0.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.hardwareFamily !== "A5") return null;
      const enabled = !input.vllmBatchInvariant;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: enabled
          ? "In main, Ascend 950 (A5) includes RUNTIME_CUSTOM_OPS so vllm_ascend_C custom ops are enabled."
          : "VLLM_BATCH_INVARIANT disables vllm_ascend_C custom ops on Ascend 950.",
        effectiveMutation: { runtimeCustomOpsEnabled: enabled },
      };
    },
  },
  {
    id: "d5-static-kernel-defaults-super-kernel",
    domain: "graph-sched-env",
    title: "enable_static_kernel=True Silently Defaults Omitted enable_super_kernel=True",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L131-L143`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L138-L150`,
    ],
    description:
      "When enable_static_kernel is passed in ascend_compilation_config and enable_super_kernel is omitted (and not overridden by 310P or NONE/PIECEWISE/FULL_AND_PIECEWISE reset), _default_super_kernel_to_static_kernel silently sets enable_super_kernel = enable_static_kernel.",
    rationale: "Couples static kernel and super kernel enablement by default unless explicitly overridden.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.enableStaticKernel !== true || input.enableSuperKernel !== undefined) return null;
      if (input.hardwareFamily === "310P") return null;
      const mode = input.cudagraphMode;
      if (mode === "NONE" || mode === "PIECEWISE" || mode === "FULL_AND_PIECEWISE") return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message:
          "enable_static_kernel=True with omitted enable_super_kernel silently defaults enable_super_kernel=True.",
        effectiveMutation: { enableSuperKernel: true },
      };
    },
  },
  {
    id: "d5-310p-npugraph-ex-downgrade",
    domain: "graph-sched-env",
    title: "Ascend 310P Silently Disables npugraph_ex, static_kernel, and super_kernel",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L145-L165`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L156-L171`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L631-L640`,
    ],
    description:
      "Hardware lacking HardwareCapability.NPUGRAPH_EX / is_310p() (Ascend 310P) logs warnings and silently resets enable_npugraph_ex, enable_static_kernel (and enable_super_kernel in v0.30.0/main) to False.",
    rationale: "310P lacks NPUGRAPH_EX capability so compilation flags downgrade cleanly.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.hardwareFamily !== "310P") return null;
      if (version === "rfork") {
        if (!input.enableNpugraphEx && !input.enableStaticKernel) return null;
        return {
          ruleId: this.id,
          domain: this.domain,
          title: this.title,
          version,
          judgment: this.judgment,
          evidenceLevel: this.evidenceLevel,
          sources: [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L631-L640`],
          message:
            "Ascend 310P (rfork) silently resets enable_npugraph_ex and enable_static_kernel to False.",
          effectiveMutation: {
            enableNpugraphEx: false,
            enableStaticKernel: false,
          },
        };
      }
      if (!input.enableNpugraphEx && !input.enableStaticKernel && !input.enableSuperKernel) return null;
      const versionSource =
        version === "main"
          ? [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L156-L171`]
          : [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L145-L165`];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: versionSource,
        message:
          "Ascend 310P lacks NPUGRAPH_EX capability and silently resets enable_npugraph_ex, enable_static_kernel, and enable_super_kernel to False.",
        effectiveMutation: {
          enableNpugraphEx: false,
          enableStaticKernel: false,
          enableSuperKernel: false,
        },
      };
    },
  },
  {
    id: "d5-solo-super-or-static-kernel-error",
    domain: "graph-sched-env",
    title: "Solo super_kernel or static_kernel Without Prerequisites Raises AssertionError",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L166-L169`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L172-L176`,
    ],
    description:
      "On A2/A3/950, enabling enable_super_kernel without enable_static_kernel=True (or enable_static_kernel without enable_npugraph_ex=True) raises AssertionError.",
    rationale: "Strict dependency chain: npugraph_ex -> static_kernel -> super_kernel.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.hardwareFamily === "310P") return null;
      const npugraphEx = input.enableNpugraphEx ?? false;
      const staticKernel = input.enableStaticKernel ?? false;
      const superKernel = input.enableSuperKernel !== undefined ? input.enableSuperKernel : staticKernel;
      const errors: string[] = [];
      if (staticKernel && !npugraphEx) {
        errors.push("Static kernel generation requires npugraph_ex to be enabled");
      }
      if (superKernel && !staticKernel) {
        errors.push("Super kernel generation requires static kernel to be enabled");
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
        message: `AssertionError: ${errors.join("; ")}.`,
      };
    },
  },
  {
    id: "d5-graph-mode-resets-npugraph-ex",
    domain: "graph-sched-env",
    title: "NONE / PIECEWISE / FULL_AND_PIECEWISE Reset npugraph_ex, static_kernel, and super_kernel",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1313-L1352`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1518-L1558`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L550-L586`,
      `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/compilation.py#L77-L91`,
    ],
    description:
      "In _setup_compile_backend, CUDAGraphMode.NONE, PIECEWISE, and FULL_AND_PIECEWISE (requires_piecewise_compilation()) silently reset enable_npugraph_ex, enable_static_kernel (and enable_super_kernel in v0.30.0/main) to False; only FULL and FULL_DECODE_ONLY preserve them.",
    rationale: "npugraph_ex full-graph lowering is incompatible with piecewise splitting.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.hardwareFamily === "310P") return null;
      const mode = input.cudagraphMode;
      if (mode !== "NONE" && mode !== "PIECEWISE" && mode !== "FULL_AND_PIECEWISE") return null;
      if (version === "rfork") {
        if (!input.enableNpugraphEx && !input.enableStaticKernel) return null;
        return {
          ruleId: this.id,
          domain: this.domain,
          title: this.title,
          version,
          judgment: this.judgment,
          evidenceLevel: this.evidenceLevel,
          sources: [
            `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L550-L586`,
            `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/compilation.py#L77-L91`,
          ],
          message: `cudagraph_mode=${mode} (rfork) silently resets enable_npugraph_ex and enable_static_kernel to False.`,
          effectiveMutation: {
            enableNpugraphEx: false,
            enableStaticKernel: false,
          },
        };
      }
      const anyEnabled = Boolean(
        input.enableNpugraphEx || input.enableStaticKernel || input.enableSuperKernel,
      );
      if (!anyEnabled) return null;
      const versionSources =
        version === "main"
          ? [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1518-L1558`,
              `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/compilation.py#L77-L91`,
            ]
          : [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1313-L1352`,
              `vllm@${VERIFIED_COMMITS.vllmV030}:vllm/config/compilation.py#L77-L91`,
            ];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: versionSources,
        message: `cudagraph_mode=${mode} silently resets enable_npugraph_ex, enable_static_kernel, and enable_super_kernel to False (FULL and FULL_DECODE_ONLY preserve them).`,
        effectiveMutation: {
          enableNpugraphEx: false,
          enableStaticKernel: false,
          enableSuperKernel: false,
        },
      };
    },
  },
  {
    id: "d5-short-request-first-scheduler-mutex",
    domain: "graph-sched-env",
    title:
      "short_request_first_config Mutually Exclusive with batch_job_sched, D Nodes (kv_consumer), and profiling_chunk in rfork",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1052-L1069`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1237-L1254`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L648-L670`,
    ],
    description:
      "Enabling short_request_first_config alongside batch_job_sched_config, on PD-disaggregated D nodes (kv_role='kv_consumer'), or alongside profiling_chunk_config in rfork raises ValueError at startup before scheduler_cls override.",
    rationale:
      "ShortRequestFirst explicitly rejects incompatible batch-job schedulers, kv_consumer decode nodes, and rfork profiling-chunk schedulers.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.shortRequestFirstEnabled) return null;
      const conflicts: string[] = [];
      if (input.batchJobSchedEnabled) conflicts.push("batch_job_sched_config");
      if (version === "rfork" && input.profilingChunkEnabled) conflicts.push("profiling_chunk_config");
      if (input.kvRole === "kv_consumer") conflicts.push("kv_role='kv_consumer'");
      if (conflicts.length === 0) return null;
      const sources =
        version === "main"
          ? [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1237-L1254`]
          : version === "rfork"
            ? [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L648-L670`]
            : [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1052-L1069`];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources,
        message: `ValueError: ShortRequestFirst scheduling cannot be enabled with ${conflicts.join(" / ")}.`,
        remediation: `Disable short_request_first_config or resolve ${conflicts.join(" / ")}.`,
      };
    },
  },
  {
    id: "d5-dyntra-lb-profiling-chunk-mutex",
    domain: "graph-sched-env",
    title: "dyntra_lb_config Mutually Exclusive with profiling_chunk_config (v0.30.0)",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1086-L1114`],
    description:
      "In v0.30.0 check_and_update_config, enabling dyntra_lb_config alongside profiling_chunk_config raises ValueError before _setup_worker_and_scheduler runs.",
    rationale:
      "DyntraLB and ProfilingChunkScheduler both govern incompatible scheduling modes and are explicitly rejected together at config validation time.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.dyntraLbEnabled || !input.profilingChunkEnabled) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: "ValueError: DyntraLB cannot be used with profiling_chunk_config.",
        remediation: "Disable either dyntra_lb_config or profiling_chunk_config.",
      };
    },
  },
  {
    id: "d5-scheduler-override-chain-v030",
    domain: "graph-sched-env",
    title:
      "Scheduler Override Chain: profiling_chunk & batch_job_sched Silently Override Earlier Schedulers (v0.30.0)",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1070-L1147`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1379-L1407`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L671-L719`,
    ],
    description:
      "In v0.30.0 _setup_worker_and_scheduler, profiling_chunk_config overwrites recompute_scheduler / short_request_first, and batch_job_sched_config (last writer wins) overwrites recompute_scheduler and profiling_chunk_config (when not aborted by ShortRequestFirst or DyntraLB+profiling_chunk ValueError).",
    rationale: "Sequential unconditional assignment to vllm_config.scheduler_config.scheduler_cls.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const srfBlockedByValueError =
        Boolean(input.shortRequestFirstEnabled) &&
        (Boolean(input.batchJobSchedEnabled) ||
          input.kvRole === "kv_consumer" ||
          (version === "rfork" && Boolean(input.profilingChunkEnabled)));
      const dyntraBlockedByValueError =
        version === "v0.30.0" && Boolean(input.dyntraLbEnabled) && Boolean(input.profilingChunkEnabled);
      const active: string[] = [];
      if (input.shortRequestFirstEnabled && !srfBlockedByValueError) active.push("short_request_first");
      if (input.recomputeSchedulerEnable && input.kvRole === "kv_consumer")
        active.push("recompute_scheduler");
      if (
        version !== "rfork" &&
        input.dyntraLbEnabled &&
        !input.recomputeSchedulerEnable &&
        !dyntraBlockedByValueError
      ) {
        active.push("dyntra_lb");
      }
      if (input.profilingChunkEnabled) active.push("profiling_chunk_config");
      if (input.batchJobSchedEnabled) active.push("batch_job_sched_config");
      if (active.length <= 1) return null;
      if (!input.profilingChunkEnabled && !input.batchJobSchedEnabled) return null;
      const winner = input.batchJobSchedEnabled ? "BatchJobAwareScheduler" : "ProfilingChunkScheduler";
      const sources =
        version === "rfork"
          ? [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L671-L719`]
          : [
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1070-L1147`,
              `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1379-L1407`,
            ];
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources,
        message: `Multiple schedulers enabled (${active.join(" -> ")}); last writer wins -> scheduler_cls silently overwritten to ${winner}.`,
        effectiveMutation: { effectiveSchedulerCls: winner },
      };
    },
  },
  {
    id: "d5-scheduler-override-chain-main",
    domain: "graph-sched-env",
    title: "Scheduler Override Chain: batch_job_sched Silently Overrides Earlier Schedulers (main)",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["main"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1586-L1601`],
    description:
      "In main (profiling_chunk_config removed), batch_job_sched_config still unconditionally overwrites recompute_scheduler / dyntra_lb as last writer (short_request_first + batch_job_sched raises ValueError instead).",
    rationale: "Unconditional scheduler_cls overwrite in _setup_worker_and_scheduler.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.batchJobSchedEnabled) return null;
      const earlier: string[] = [];
      if (input.recomputeSchedulerEnable && input.kvRole === "kv_consumer") {
        earlier.push("recompute_scheduler");
      }
      if (input.dyntraLbEnabled && !input.recomputeSchedulerEnable) earlier.push("dyntra_lb");
      if (earlier.length === 0) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `batch_job_sched_config silently overwrites ${earlier.join(", ")} -> BatchJobAwareScheduler.`,
        effectiveMutation: { effectiveSchedulerCls: "BatchJobAwareScheduler" },
      };
    },
  },
  {
    id: "d5-rl-config-disables-nz-and-expandable-segments",
    domain: "graph-sched-env",
    title: "RLConfig Forces weight_nz_mode=0 and Strips expandable_segments",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L375-L394`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1450-L1481`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L391-L410`,
    ],
    description:
      "When rl_config.enabled=True, AscendConfig forces weight_nz_mode=0, removes any expandable_segments:* token from PYTORCH_NPU_ALLOC_CONF, and sets VLLM_SERVER_DEV_MODE=1.",
    rationale: "RL weight refit / sleep mode requires ND weights and non-expandable NPU allocator segments.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.rlEnabled) return null;
      const allocConf = input.pytorchNpuAllocConf ?? input.envVars?.PYTORCH_NPU_ALLOC_CONF ?? "";
      const hasExpandable = allocConf.includes("expandable_segments:");
      const nzNeedsForce = input.weightNzMode !== 0;
      if (!nzNeedsForce && !hasExpandable) return null;
      const nzChanged = input.weightNzMode !== undefined && input.weightNzMode !== 0;
      const strippedAlloc = allocConf
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && !s.startsWith("expandable_segments:"))
        .join(",");
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `RLConfig forces weight_nz_mode=0${nzChanged ? ` (was ${input.weightNzMode})` : ""} and strips expandable_segments from PYTORCH_NPU_ALLOC_CONF${hasExpandable ? ` ('${allocConf}' -> '${strippedAlloc}')` : ""}.`,
        effectiveMutation: {
          weightNzMode: 0,
          pytorchNpuAllocConf: strippedAlloc,
        },
      };
    },
  },
  {
    id: "d5-cann-env-var-classification",
    domain: "graph-sched-env",
    title: "HCCL_* / ASCEND_* Env Var Read-Point & Unknown Classification (P1-4 #2)",
    judgment: "unknown",
    evidenceLevel: "I",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/tutorials/models/Qwen3.8-2.4T-A95B.md#L205-L428`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L66-L69`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/distributed/ec_transfer/ec_connector/mooncake/store_backend.py#L124-L125`,
    ],
    description:
      "Classifies HCCL_* and ASCEND_* env vars: variables with 0 Python/C++ reads in vllm/vllm-ascend (including HCCL_BUFFSIZE_EP and 45+ docs-only vars, plus ASCEND_BUFFER_POOL in v0.30.0) MUST be marked 'unknown' (evidenceLevel 'I'), never 'error'.",
    rationale: "Absence of an in-repo Python/C++ read does not disprove consumption by CANN / libhccl.so.",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.envVars) return null;
      const unknownVars: string[] = [];
      const knownVars: string[] = [];
      const collectedSources = new Set<string>();

      for (const name of Object.keys(input.envVars)) {
        if (!name.startsWith("HCCL_") && !name.startsWith("ASCEND_")) continue;
        const classified = classifyEnvVar(name, version);
        for (const s of classified.sources) collectedSources.add(s);
        if (classified.judgment === "unknown") {
          unknownVars.push(name);
        } else {
          knownVars.push(name);
        }
      }

      if (unknownVars.length === 0) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: "unknown",
        evidenceLevel: "I",
        sources: [...collectedSources],
        message: `Unverified CANN/HCCL env var(s) with 0 in-repo reads in ${version}: ${unknownVars.join(", ")}. Classified 'unknown' (NOT 'error') pending pinned CANN documentation.${knownVars.length > 0 ? ` (Verified read vars also present: ${knownVars.join(", ")}.)` : ""}`,
      };
    },
  },
];

export function evaluateDomain5Rules(
  input: CouplingCheckInput,
  version: RuleVersion = DEFAULT_RULE_VERSION,
): readonly RuleMatch[] {
  const matches: RuleMatch[] = [];
  for (const rule of domain5Rules) {
    const match = rule.evaluate(input, version);
    if (match) matches.push(match);
  }
  return matches;
}
