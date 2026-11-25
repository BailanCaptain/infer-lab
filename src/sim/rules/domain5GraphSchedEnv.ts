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
  judgment: "known-read" | "retired" | "deprecated-fallback" | "unknown";
  ruleJudgment: RuleJudgment;
  evidenceLevel: EvidenceLevel;
  sources: readonly string[];
  reason: string;
  replacement?: string | undefined;
}

export interface KnownEnvSpec {
  versions: readonly RuleVersion[];
  sources: readonly string[];
  note: string;
}

export interface RetiredEnvSpec {
  versions: readonly RuleVersion[];
  sourcesByVersion: Partial<Record<RuleVersion, readonly string[]>>;
  replacement: string;
  note: string;
}

export interface DeprecatedFallbackEnvSpec {
  versions: readonly RuleVersion[];
  sourcesByVersion: Partial<Record<RuleVersion, readonly string[]>>;
  replacement: string;
  note: string;
}

export const KNOWN_READ_ENV_SPECS: Readonly<Record<string, KnownEnvSpec>> = {
  HCCL_SO_PATH: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L69`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L613`,
    ],
    note: "定义于 vllm_ascend/envs.py，在 utils.py 中读取。",
  },
  HCCL_BUFFSIZE: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:csrc/mc2/dispatch_ffn_combine/op_host/dispatch_ffn_combine_tiling.cpp#L28-L66`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1259-L1264`,
    ],
    note: "在 MC2 C++ tiling 中读取，控制 MC2 通信域缓冲区大小。",
  },
  HCCL_OP_EXPANSION_MODE: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/device_op.py#L1257`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/patch/platform/patch_minimax_m2_config.py#L118-L120`,
    ],
    note: "在 device_op.py 与 patch_minimax_m2_config.py 中读写。",
  },
  HCCL_DETERMINISTIC: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/batch_invariant.py#L108`],
    note: "在 batch_invariant 确定性模式下会被设为 'strict'。",
  },
  HCCL_RDMA_TIMEOUT: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/utils/utils.py#L91`,
    ],
    note: "由 KV 传输工具模块读取。",
  },
  HCCL_RDMA_RETRY_CNT: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/utils/utils.py#L92`,
    ],
    note: "由 KV 传输工具模块读取。",
  },
  ASCEND_HOME_PATH: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L66`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/worker/worker.py#L220`,
    ],
    note: "定义于 envs.py，在 worker.py / hixl_compat.py 中读取。",
  },
  ASCEND_RT_VISIBLE_DEVICES: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/cpu_binding.py#L25`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/weight_transfer/npu_ipc_engine.py#L85`,
    ],
    note: "由 vllm 与 vllm-ascend 读取，用于设备可见性与 CPU 绑核。",
  },
  ASCEND_CUSTOM_OPP_PATH: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:csrc/aclnn_torch_adapter/op_api_common.h#L194`],
    note: "由 C++ 自定义算子加载器读取。",
  },
  ASCEND_OPP_PATH: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:csrc/aclnn_torch_adapter/op_api_common.h#L216`],
    note: "由 C++ op_api_common.h 读取。",
  },
  ASCEND_GLOBAL_RESOURCE_CONFIG: {
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/utils/utils.py#L27`,
    ],
    note: "由 Mooncake / KV 传输工具模块读取。",
  },
  ASCEND_ENABLE_USE_FABRIC_MEM: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L202`,
    ],
    note: "由 Mooncake 后端读取，用于开启 Fabric 内存。",
  },
  ASCEND_TRANSFER_TIMEOUT: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/utils/utils.py#L88`,
    ],
    note: "在 Mooncake 与 SFA PD Worker 中读写。",
  },
  ASCEND_LOCAL_COMM_RES: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L721`],
    note: "在 vllm_ascend/utils.py 中写入。",
  },
  ASCEND_BUFFER_POOL: {
    versions: ["main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/distributed/ec_transfer/ec_connector/mooncake/store_backend.py#L124-L125`,
    ],
    note: "v0.30.0 下仅见于文档（归类为 unknown）；main 在 ec_transfer store_backend.py 中显式读取。",
  },
  PYTORCH_NPU_ALLOC_CONF: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1445-L1481`],
    note: "由 NPUPlatform._set_pytorch_npu_alloc_env() 读写（未开启 sleep mode 且无冲突选项时自动追加 expandable_segments:True）。",
  },
  VLLM_USE_MODELSCOPE: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/envs.py#L717-L719`],
    note: "由 vllm/envs.py 读取，改从 ModelScope 而非 Hugging Face Hub 拉取权重。",
  },
  VLLM_WORKER_MULTIPROC_METHOD: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/envs.py#L930-L932`],
    note: "由 vllm/envs.py 读取（'spawn' 或 'fork'），控制 MultiprocExecutor 启动方式。",
  },
  VLLM_HOST_IP: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/envs.py#L705`],
    note: "由 vllm/envs.py 读取，用于分布式主机 IP 绑定。",
  },
  VLLM_PORT: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/envs.py#L710`],
    note: "由 vllm/envs.py 读取（须为整数端口；Kubernetes 注入 tcp:// URI 会抛 ValueError）。",
  },
  VLLM_USE_V2_MODEL_RUNNER: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/envs.py#L2037-L2038`],
    note: "由 vllm/envs.py 读取以启用 Model Runner V2（v0.30.0 下 PCP > 1 与 TurboQuant Route B 必需）。",
  },
  VLLM_LOGGING_LEVEL: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/envs.py#L834`],
    note: "由 vllm/envs.py 读取，控制 vLLM 日志级别（如 DEBUG）。",
  },
  VLLM_ALLOW_LONG_MAX_MODEL_LEN: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/envs.py#L1097-L1098`],
    note: "由 vllm/envs.py 读取，允许 --max-model-len 超出 config.json 原生上限。",
  },
  VLLM_PP_LAYER_PARTITION: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/envs.py#L864`],
    note: "由 vllm/envs.py 读取，自定义各 PP 阶段分配的模型层数。",
  },
  VLLM_BATCH_INVARIANT: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm@${VERIFIED_COMMITS.vllmV030}:vllm/envs.py#L619`],
    note: "由 vllm/envs.py 与 vllm_ascend/batch_invariant.py 读取，开启批不变确定性推理。",
  },
  VLLM_VERSION: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L76`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L726-L746`,
    ],
    note: "定义于 vllm_ascend/envs.py，由 vllm_version_is() 读取以覆写非标准源码构建版本号。",
  },
  DYNAMIC_EPLB: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L78`],
    note: "定义于 vllm_ascend/envs.py，用于开启动态专家负载均衡（EPLB）。",
  },
  VLLM_ASCEND_KVPOOL_RANGE_DEBUG: {
    versions: ["v0.30.0"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L84`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/distributed/kv_transfer/kv_pool/ascend_store/backend/mooncake_backend.py#L48-L55`,
    ],
    note: "v0.30.0 下定义于 vllm_ascend/envs.py（严格 0/1），输出 [KVPOOL_RANGE_DEBUG] JSON 审计日志；main 已迁移至 additional_config.kv_pool_range_debug。",
  },
  TASK_QUEUE_ENABLE: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:Dockerfile#L55-L57`],
    note: "官方 vllm-ascend Dockerfile 默认设为 1，开启 torch_npu 异步下发队列。",
  },
  OMP_NUM_THREADS: {
    versions: ["v0.30.0", "main", "rfork"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:Dockerfile#L55-L57`],
    note: "官方 vllm-ascend Dockerfile 默认设为 1，避免多 Worker 间 OpenMP 线程争抢。",
  },
};

export const RETIRED_ENV_SPECS: Readonly<Record<string, RetiredEnvSpec>> = {
  VLLM_ASCEND_ENABLE_NZ: {
    versions: ["v0.30.0", "main"],
    sourcesByVersion: {
      "v0.30.0": [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/configuration/additional_config.md#L60`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L38-L93`,
      ],
      main: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:docs/source/user_guide/configuration/additional_config.md#L68`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/envs.py#L46-L98`,
      ],
    },
    replacement: `--additional-config '{"weight_nz_mode": 0}'（0=关闭, 1=仅量化权重[默认], 2=量化+浮点）`,
    note: "VLLM_ASCEND_ENABLE_NZ 已在 v0.30.0 移除（源码 0 处读取），继续导出会静默无效；请迁移到 additional_config.weight_nz_mode。",
  },
  VLLM_ASCEND_ENABLE_MLAPO: {
    versions: ["v0.30.0", "main"],
    sourcesByVersion: {
      "v0.30.0": [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/configuration/additional_config.md#L58`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L38-L93`,
      ],
      main: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:docs/source/user_guide/configuration/additional_config.md#L66`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/envs.py#L46-L98`,
      ],
    },
    replacement: `--additional-config '{"enable_mlapo": true}'`,
    note: "VLLM_ASCEND_ENABLE_MLAPO 已在 v0.30.0 移除（源码 0 处读取），继续导出会静默无效；请迁移到 additional_config.enable_mlapo。",
  },
  VLLM_ASCEND_ENABLE_FUSED_MC2: {
    versions: ["v0.30.0", "main"],
    sourcesByVersion: {
      "v0.30.0": [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/configuration/additional_config.md#L61`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L38-L93`,
      ],
      main: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:docs/source/user_guide/configuration/additional_config.md#L69`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/envs.py#L46-L98`,
      ],
    },
    replacement: `--additional-config '{"enable_fused_mc2": 1}' (0=关闭, 1=dispatch_ffn_combine, 2=MegaMoe, 3=MegaMoe+共享专家融合[仅 main])`,
    note: "VLLM_ASCEND_ENABLE_FUSED_MC2 已在 v0.30.0 移除（源码 0 处读取），继续导出会静默无效；请迁移到 additional_config.enable_fused_mc2。",
  },
  MSMONITOR_USE_DAEMON: {
    versions: ["v0.30.0", "main"],
    sourcesByVersion: {
      "v0.30.0": [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/configuration/additional_config.md#L57`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L38-L93`,
      ],
      main: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:docs/source/user_guide/configuration/additional_config.md#L65`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/envs.py#L46-L98`,
      ],
    },
    replacement: `--additional-config '{"msmonitor_use_daemon": true}'`,
    note: "MSMONITOR_USE_DAEMON 已在 v0.30.0 移除（源码 0 处读取），继续导出会静默无效；请迁移到 additional_config.msmonitor_use_daemon。",
  },
  VLLM_ASCEND_FUSION_OP_TRANSPOSE_KV_CACHE_BY_BLOCK: {
    versions: ["v0.30.0", "main"],
    sourcesByVersion: {
      "v0.30.0": [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/configuration/additional_config.md#L62`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L38-L93`,
      ],
      main: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:docs/source/user_guide/configuration/additional_config.md#L70`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/envs.py#L46-L98`,
      ],
    },
    replacement: `--additional-config '{"enable_transpose_kv_cache_by_block": true}'`,
    note: "VLLM_ASCEND_FUSION_OP_TRANSPOSE_KV_CACHE_BY_BLOCK 已在 v0.30.0 移除（源码 0 处读取）；请迁移到 additional_config.enable_transpose_kv_cache_by_block。",
  },
  VLLM_ASCEND_KVPOOL_RANGE_DEBUG: {
    versions: ["main"],
    sourcesByVersion: {
      main: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:docs/source/user_guide/configuration/additional_config.md#L60`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L670`,
      ],
    },
    replacement: `--additional-config '{"kv_pool_range_debug": true}'`,
    note: "VLLM_ASCEND_KVPOOL_RANGE_DEBUG 已在 main 移除（源码 0 处读取），继续导出将静默失效；请迁移到 additional_config.kv_pool_range_debug。",
  },
};

export const DEPRECATED_FALLBACK_ENV_SPECS: Readonly<Record<string, DeprecatedFallbackEnvSpec>> = {
  VLLM_ASCEND_ENABLE_FLASHCOMM1: {
    versions: ["v0.30.0", "main"],
    sourcesByVersion: {
      "v0.30.0": [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L747-L750`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1016-L1022`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/configuration/additional_config.md#L64`,
      ],
      main: [
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L845-L848`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/patch/worker/patch_qwen3_5.py#L55-L61`,
        `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:docs/source/user_guide/configuration/additional_config.md#L71`,
      ],
    },
    replacement: `--additional-config '{"enable_flashcomm1": true}'`,
    note: "VLLM_ASCEND_ENABLE_FLASHCOMM1 已于 v0.30.0 从 vllm_ascend/envs.py 移除，但在 ascend_config.py 与 utils.py 中仍保留 os.getenv 兼容兜底；建议迁移至 additional_config.enable_flashcomm1。",
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

  if (Object.hasOwn(RETIRED_ENV_SPECS, name)) {
    const spec = RETIRED_ENV_SPECS[name];
    if (spec?.versions.includes(version)) {
      const sources = spec.sourcesByVersion[version] ?? spec.sourcesByVersion["v0.30.0"] ?? [];
      return {
        name,
        version,
        judgment: "retired",
        ruleJudgment: "warn",
        evidenceLevel: "C",
        sources,
        reason: spec.note,
        replacement: spec.replacement,
      };
    }
  }

  if (Object.hasOwn(DEPRECATED_FALLBACK_ENV_SPECS, name)) {
    const spec = DEPRECATED_FALLBACK_ENV_SPECS[name];
    if (spec?.versions.includes(version)) {
      const sources = spec.sourcesByVersion[version] ?? spec.sourcesByVersion["v0.30.0"] ?? [];
      return {
        name,
        version,
        judgment: "deprecated-fallback",
        ruleJudgment: "warn",
        evidenceLevel: "C",
        sources,
        reason: spec.note,
        replacement: spec.replacement,
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
        "HCCL_BUFFSIZE_EP 在 vllm 与 vllm-ascend Python/C++ 源码中 0 处读取，仅见于教程文档；无锁定 CANN 文档前无法证实或证伪 CANN/HCCL 消费，故标为 unknown。",
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
    reason: `${name} 在 ${version} 锁定的 vllm / vllm-ascend Python/C++ 源码中无已证实读取点；无法排除 CANN / 底层运行时消费，必须归类为 unknown。`,
  };
}

export const domain5Rules: readonly CouplingRule[] = [
  {
    id: "d5-fa3-full-decode-only-error",
    domain: "graph-sched-env",
    title: "FA3 拒绝 FULL_DECODE_ONLY（要求 PIECEWISE）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/attention/fa3_v1.py#L45-L59`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1484-L1509`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/feature_guide/flash_attention.md#L43-L142`,
    ],
    description:
      "AscendFAImpl (FA3) 在 cudagraph_mode == FULL_DECODE_ONLY 时直接抛 ValueError，文档与源码均要求 PIECEWISE 编译模式。",
    rationale: "flash_attn_with_kvcache 的 tiling 位于 Host 侧，不支持完整 ACLGraph 捕获。",
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
          "ValueError: AscendFAImpl (FA3) 不支持 FULL_DECODE_ONLY 模式下的 ACLGraph 捕获，请改用 PIECEWISE。",
        remediation: "将 compilation_config.cudagraph_mode 设为 'PIECEWISE'。",
      };
    },
  },
  {
    id: "d5-950-custom-ops-disabled-v030",
    domain: "graph-sched-env",
    title: "Ascend 950 静默关闭 vllm_ascend_C 自定义算子（v0.30.0 / rfork）",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L558-L563`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/device/hardware_profile.py#L333-L380`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/utils.py#L418-L420`,
    ],
    description:
      "v0.30.0（A5 不含 HardwareCapability.RUNTIME_CUSTOM_OPS）与 rfork（检测 AscendDeviceType.A5）下，enable_custom_op() 静默返回 False，关闭 vllm_ascend_C。",
    rationale: "950 上的自定义算子编译/执行在当时被临时关闭（#7157）。",
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
            ? "rfork 下 Ascend 950 (A5) 通过 AscendDeviceType.A5 判断直接禁用 vllm_ascend_C 自定义算子。"
            : "v0.30.0 下 Ascend 950 (A5) 缺少 RUNTIME_CUSTOM_OPS 能力标记，静默关闭 vllm_ascend_C 自定义算子。",
        effectiveMutation: { runtimeCustomOpsEnabled: false },
      };
    },
  },
  {
    id: "d5-950-custom-ops-enabled-main",
    domain: "graph-sched-env",
    title: "Ascend 950 已启用 vllm_ascend_C 自定义算子（main）",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/device/hardware_profile.py#L490`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/utils.py#L583-L590`,
    ],
    description:
      "vllm-ascend main (8d6180e2) 为 AscendDeviceType.A5 补回 RUNTIME_CUSTOM_OPS，移除了 950 禁自定义算子绕过（除非设置 VLLM_BATCH_INVARIANT）。",
    rationale: "950 自定义算子支持已在 v0.30.0 之后合入 main。",
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
          ? "main 分支下 Ascend 950 (A5) 已包含 RUNTIME_CUSTOM_OPS，vllm_ascend_C 自定义算子默认启用。"
          : "已设置 VLLM_BATCH_INVARIANT，Ascend 950 上仍会关闭 vllm_ascend_C 自定义算子。",
        effectiveMutation: { runtimeCustomOpsEnabled: enabled },
      };
    },
  },
  {
    id: "d5-static-kernel-defaults-super-kernel",
    domain: "graph-sched-env",
    title: "开启 enable_static_kernel=True 且省略 enable_super_kernel 时会静默默认开启后者",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L131-L143`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L138-L150`,
    ],
    description:
      "在 ascend_compilation_config 中启用 enable_static_kernel 且未显式传入 enable_super_kernel（且未被 310P 或 NONE/PIECEWISE/FULL_AND_PIECEWISE 清零）时，_default_super_kernel_to_static_kernel 静默将 enable_super_kernel 置为 True。",
    rationale: "未显式指定时将 static_kernel 与 super_kernel 联动开启。",
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
          "开启 enable_static_kernel=True 且未显式指定 enable_super_kernel 时，静默默认 enable_super_kernel=True。",
        effectiveMutation: { enableSuperKernel: true },
      };
    },
  },
  {
    id: "d5-310p-npugraph-ex-downgrade",
    domain: "graph-sched-env",
    title: "Ascend 310P 静默关闭 npugraph_ex、static_kernel 与 super_kernel",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L145-L165`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L156-L171`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L631-L640`,
    ],
    description:
      "缺少 HardwareCapability.NPUGRAPH_EX / is_310p() 的设备（Ascend 310P）会打印告警并静默将 enable_npugraph_ex、enable_static_kernel（v0.30.0/main 还包括 enable_super_kernel）置为 False。",
    rationale: "310P 不具备 NPUGRAPH_EX 能力，相关图编译开关会自动降级关闭。",
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
          message: "Ascend 310P（rfork）静默将 enable_npugraph_ex 与 enable_static_kernel 重置为 False。",
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
          "Ascend 310P 缺少 NPUGRAPH_EX 能力，静默将 enable_npugraph_ex、enable_static_kernel 与 enable_super_kernel 重置为 False。",
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
    title: "缺少前置依赖单独开启 super_kernel 或 static_kernel 会抛 AssertionError",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L166-L169`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L172-L176`,
    ],
    description:
      "在 A2/A3/950 上，未开启 enable_static_kernel=True 时启用 enable_super_kernel，或未开启 enable_npugraph_ex=True 时启用 enable_static_kernel，会直接抛 AssertionError。",
    rationale: "严格依赖链：npugraph_ex -> static_kernel -> super_kernel。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.hardwareFamily === "310P") return null;
      const npugraphEx = input.enableNpugraphEx ?? false;
      const staticKernel = input.enableStaticKernel ?? false;
      const superKernel = input.enableSuperKernel !== undefined ? input.enableSuperKernel : staticKernel;
      const errors: string[] = [];
      if (staticKernel && !npugraphEx) {
        errors.push("启用 static_kernel 必须先开启 npugraph_ex");
      }
      if (superKernel && !staticKernel) {
        errors.push("启用 super_kernel 必须先开启 static_kernel");
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
        message: `AssertionError: ${errors.join("；")}。`,
      };
    },
  },
  {
    id: "d5-graph-mode-resets-npugraph-ex",
    domain: "graph-sched-env",
    title: "NONE / PIECEWISE / FULL_AND_PIECEWISE 会静默重置 npugraph_ex / static_kernel / super_kernel",
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
      "在 _setup_compile_backend 中，CUDAGraphMode.NONE、PIECEWISE 与 FULL_AND_PIECEWISE 会静默将 enable_npugraph_ex、enable_static_kernel（v0.30.0/main 含 enable_super_kernel）置为 False；仅 FULL 与 FULL_DECODE_ONLY 会保留。",
    rationale: "npugraph_ex 整图下沉与分段切图（piecewise）不兼容。",
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
          message: `cudagraph_mode=${mode}（rfork）会静默将 enable_npugraph_ex 与 enable_static_kernel 重置为 False。`,
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
        message: `cudagraph_mode=${mode} 会静默将 enable_npugraph_ex、enable_static_kernel 与 enable_super_kernel 重置为 False（仅 FULL 与 FULL_DECODE_ONLY 会保留）。`,
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
      "short_request_first_config 与 batch_job_sched、D 节点（kv_consumer）及 rfork profiling_chunk 互斥",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1052-L1069`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1237-L1254`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L648-L670`,
    ],
    description:
      "在调度器覆写前，short_request_first_config 若与 batch_job_sched_config 同开、运行在 PD D 节点（kv_role='kv_consumer'），或在 rfork 中与 profiling_chunk_config 同开，启动即抛 ValueError。",
    rationale: "ShortRequestFirst 明确拒绝不兼容的批任务调度器、Decode 消费节点及 rfork 分块采样调度器。",
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
        message: `ValueError: ShortRequestFirst 调度不能与 ${conflicts.join(" / ")} 同时启用。`,
        remediation: `关闭 short_request_first_config，或移除冲突项：${conflicts.join(" / ")}。`,
      };
    },
  },
  {
    id: "d5-dyntra-lb-profiling-chunk-mutex",
    domain: "graph-sched-env",
    title: "dyntra_lb_config 与 profiling_chunk_config 互斥（v0.30.0）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1086-L1114`],
    description:
      "v0.30.0 的 check_and_update_config 会在进入 _setup_worker_and_scheduler 前拦截同时启用的 dyntra_lb_config 与 profiling_chunk_config，并抛 ValueError。",
    rationale: "DyntraLB 与 ProfilingChunkScheduler 分别控制互斥的调度模式，启动校验即拒绝同开。",
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
        message: "ValueError: DyntraLB 不能与 profiling_chunk_config 同时使用。",
        remediation: "关闭 dyntra_lb_config 或 profiling_chunk_config 中的一项。",
      };
    },
  },
  {
    id: "d5-scheduler-override-chain-v030",
    domain: "graph-sched-env",
    title: "调度器覆写链：profiling_chunk 与 batch_job_sched 静默覆盖前置调度器（v0.30.0）",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1070-L1147`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1379-L1407`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/platform.py#L671-L719`,
    ],
    description:
      "v0.30.0 的 _setup_worker_and_scheduler 顺序覆写 scheduler_cls：profiling_chunk_config 覆盖 recompute_scheduler / short_request_first，batch_job_sched_config 作为最后写入者覆盖前者（未触发互斥 ValueError 时）。",
    rationale: "对 vllm_config.scheduler_config.scheduler_cls 按顺序无条件赋值，后者生效。",
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
        message: `同时启用了多个调度器（${active.join(" -> ")}）；按最后写入生效原则，scheduler_cls 被静默覆写为 ${winner}。`,
        effectiveMutation: { effectiveSchedulerCls: winner },
      };
    },
  },
  {
    id: "d5-scheduler-override-chain-main",
    domain: "graph-sched-env",
    title: "调度器覆写链：batch_job_sched 静默覆盖前置调度器（main）",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["main"],
    sources: [`vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L1586-L1601`],
    description:
      "main 分支（已移除 profiling_chunk_config）下，batch_job_sched_config 仍会作为最后写入者无条件覆盖 recompute_scheduler / dyntra_lb（与 short_request_first 同开则抛 ValueError）。",
    rationale: "_setup_worker_and_scheduler 按顺序直接覆写 scheduler_cls。",
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
        message: `batch_job_sched_config 静默覆盖了 ${earlier.join("、")}，最终生效 BatchJobAwareScheduler。`,
        effectiveMutation: { effectiveSchedulerCls: "BatchJobAwareScheduler" },
      };
    },
  },
  {
    id: "d5-rl-config-disables-nz-and-expandable-segments",
    domain: "graph-sched-env",
    title: "RLConfig 强制 weight_nz_mode=0 并受 Step 10 expandable_segments 回写影响",
    judgment: "silent-rewrite",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L375-L394`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L541-L542`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/platform.py#L1450-L1481`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L391-L410`,
    ],
    description:
      "当 rl_config.enabled=True 时，Step 5 的 RLConfig.apply() 会强制 weight_nz_mode=0、剥离 PYTORCH_NPU_ALLOC_CONF 中的 expandable_segments:* 并设置 VLLM_SERVER_DEV_MODE=1；但若未开启 enable_sleep_mode，Step 10 的 _set_pytorch_npu_alloc_env() 在无 max_split_size_mb 或 garbage_collection_threshold 时会重新追加 expandable_segments:True。",
    rationale: "RL 权重切换 / sleep mode 需要 ND 权重排布并禁用可扩展 NPU 内存段。",
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
      const hasConflictingAllocOpt =
        strippedAlloc.includes("max_split_size_mb") || strippedAlloc.includes("garbage_collection_threshold");
      const step10Reappends = input.enableSleepMode !== true && !hasConflictingAllocOpt;
      const effectiveAlloc = step10Reappends
        ? strippedAlloc
          ? `${strippedAlloc},expandable_segments:True`
          : "expandable_segments:True"
        : strippedAlloc;
      const message = step10Reappends
        ? `Step 5 RLConfig.apply() 强制将 weight_nz_mode 置为 0${nzChanged ? `（原值 ${input.weightNzMode}）` : ""}并剥离 expandable_segments；但因未开启 --enable-sleep-mode，Step 10 _set_pytorch_npu_alloc_env() 会重新追加 expandable_segments:True，最终生效 PYTORCH_NPU_ALLOC_CONF='${effectiveAlloc}'。`
        : `RLConfig.apply() 强制将 weight_nz_mode 置为 0${nzChanged ? `（原值 ${input.weightNzMode}）` : ""}并从 PYTORCH_NPU_ALLOC_CONF 剥离 expandable_segments${hasExpandable ? `（'${allocConf}' -> '${strippedAlloc}'）` : ""}（已启用 --enable-sleep-mode 或存在互斥分配器选项，Step 10 不再回写）。`;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message,
        ...(step10Reappends
          ? {
              remediation:
                "如需在 RL 权重切换/睡眠卸载场景下保持关闭 expandable_segments，请显式传入 --enable-sleep-mode。",
            }
          : {}),
        effectiveMutation: {
          weightNzMode: 0,
          pytorchNpuAllocConf: effectiveAlloc,
        },
      };
    },
  },
  {
    id: "d5-cann-env-var-classification",
    domain: "graph-sched-env",
    title: "HCCL_* / ASCEND_* 环境变量读取点与未证实分类",
    judgment: "unknown",
    evidenceLevel: "I",
    versions: ["v0.30.0", "main", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/tutorials/models/Qwen3.8-2.4T-A95B.md#L205-L428`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L66-L69`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/distributed/ec_transfer/ec_connector/mooncake/store_backend.py#L124-L125`,
    ],
    description:
      "对 HCCL_* 与 ASCEND_* 环境变量分类：在 vllm/vllm-ascend Python/C++ 源码中 0 处读取的变量（含 HCCL_BUFFSIZE_EP 等 45+ 仅见文档变量，以及 v0.30.0 下的 ASCEND_BUFFER_POOL）必须标为 unknown（证据级别 I），不得误判为 error。",
    rationale: "仓内 Python/C++ 未读取并不能证伪 CANN / libhccl.so 底层消费。",
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
        message: `未在 ${version} 锁定的 vllm / vllm-ascend 源码中查到读取点的 CANN/HCCL 环境变量：${unknownVars.join("、")}。待 CANN 官方文档核实前归类为 unknown（非 error）。${knownVars.length > 0 ? `（同时检测到已证实读取的变量：${knownVars.join("、")}。）` : ""}`,
      };
    },
  },
  {
    id: "d5-retired-ascend-env-var",
    domain: "graph-sched-env",
    title: "已退役的 vllm-ascend 环境变量在 v0.30.0+ 无读取点（已迁移至 --additional-config）",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:docs/source/user_guide/configuration/additional_config.md#L57-L62`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/envs.py#L38-L93`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:docs/source/user_guide/configuration/additional_config.md#L65-L70`,
    ],
    description:
      "VLLM_ASCEND_ENABLE_NZ、VLLM_ASCEND_ENABLE_MLAPO、VLLM_ASCEND_ENABLE_FUSED_MC2、MSMONITOR_USE_DAEMON 与 VLLM_ASCEND_FUSION_OP_TRANSPOSE_KV_CACHE_BY_BLOCK 在 v0.30.0 与 main 中均已 0 处读取，继续导出会静默无效，必须改用 --additional-config。",
    rationale:
      "这些 v0.23/v0.26 旧环境变量已从 vllm_ascend/envs.py 移除并统一收口至 AscendConfig additional_config。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.envVars) return null;
      const hits: EnvVarClassification[] = [];
      const collectedSources = new Set<string>();
      for (const name of Object.keys(input.envVars)) {
        if (!Object.hasOwn(RETIRED_ENV_SPECS, name)) continue;
        const classified = classifyEnvVar(name, version);
        if (classified.judgment === "retired") {
          hits.push(classified);
          for (const s of classified.sources) collectedSources.add(s);
        }
      }
      if (hits.length === 0) return null;
      const details = hits.map((h) => `${h.name} -> ${h.replacement}`).join("；");
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: [...collectedSources],
        message: `以下已退役环境变量在 ${version} 中 0 处读取（继续导出将静默忽略）：${hits.map((h) => h.name).join("、")}。`,
        remediation: `请改用 --additional-config：${details}。`,
      };
    },
  },
  {
    id: "d5-deprecated-flashcomm1-env-fallback",
    domain: "graph-sched-env",
    title: "VLLM_ASCEND_ENABLE_FLASHCOMM1 已弃用并走 os.getenv 兼容兜底（建议迁移至 additional_config）",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L747-L750`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/utils.py#L1016-L1022`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L845-L848`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/patch/worker/patch_qwen3_5.py#L55-L61`,
    ],
    description:
      "VLLM_ASCEND_ENABLE_FLASHCOMM1 已于 v0.30.0 从 vllm_ascend/envs.py 移除，但 ascend_config.py 与 utils.py（main 含 patch_qwen3_5.py）仍保留 os.getenv 兼容兜底读取，属于已弃用而非 0 读取失效。",
    rationale:
      "区分仍生效的 os.getenv 兼容兜底与彻底失效的 0 读取退役变量，同时引导迁移至 additional_config.enable_flashcomm1。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.envVars || !Object.hasOwn(input.envVars, "VLLM_ASCEND_ENABLE_FLASHCOMM1")) return null;
      const classified = classifyEnvVar("VLLM_ASCEND_ENABLE_FLASHCOMM1", version);
      if (classified.judgment !== "deprecated-fallback") return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: this.judgment,
        evidenceLevel: this.evidenceLevel,
        sources: classified.sources,
        message:
          "VLLM_ASCEND_ENABLE_FLASHCOMM1 已于 v0.30.0 从 vllm_ascend/envs.py 移除，但在 ascend_config.py / utils.py 中仍通过 os.getenv 兼容兜底生效（并非 0 读取失效）。",
        remediation: `建议迁移至 ${classified.replacement ?? `--additional-config '{"enable_flashcomm1": true}'`}。`,
      };
    },
  },
  {
    id: "d5-main-only-additional-config-keys",
    domain: "graph-sched-env",
    title: "main 分支专属 additional_config 顶层键在旧版本下的拒收或过滤行为",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["v0.30.0", "rfork"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L397-L410`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L1895-L1914`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L656-L741`,
      `rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L56-L70`,
    ],
    description:
      "shared_engram、quantized_all_reduce_config、runtime_config、runtime_config_hot_reload、runtime_config_path、gdn_internal_prefill_checkpoints、kv_pool_range_debug 与 megamoe_shared_expert_fusion 仅在 main@8d6180e2 定义；标准 v0.30.0 直接拒收未知键报错，v0.30.0 安装 vllm_omni 时告警剥离，rfork 用 .get() 静默忽略。",
    rationale: "区分纯 v0.30.0 启动期硬报错、vllm_omni 共享扩展剥离与 rfork 字典按需读取三类行为。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const keys = new Set<string>(input.mainOnlyAdditionalConfigKeys ?? []);
      if (input.sharedEngramConfigured) keys.add("shared_engram");
      if (
        input.quantizedAllReduceEnabled ||
        input.quantizedAllReduceMinNumel !== undefined ||
        input.quantizedAllReduceInvalidReason !== undefined
      ) {
        keys.add("quantized_all_reduce_config");
      }
      if (input.runtimeConfigConfigured || input.runtimeConfigInvalidType !== undefined) {
        keys.add("runtime_config");
      }
      if (
        input.runtimeConfigHotReload !== undefined ||
        input.runtimeConfigHotReloadInvalidValue !== undefined
      ) {
        keys.add("runtime_config_hot_reload");
      }
      if (input.runtimeConfigPathConfigured || input.runtimeConfigPathInvalidType !== undefined) {
        keys.add("runtime_config_path");
      }
      if (input.gdnInternalPrefillCheckpoints !== undefined) keys.add("gdn_internal_prefill_checkpoints");
      if (input.kvPoolRangeDebug !== undefined) keys.add("kv_pool_range_debug");
      if (input.megamoeSharedExpertFusion !== undefined) keys.add("megamoe_shared_expert_fusion");
      if (keys.size === 0) return null;
      const list = [...keys].sort();
      const strippedMutation = Object.fromEntries(list.map((k) => [k, null]));

      if (version === "rfork") {
        return {
          ruleId: this.id,
          domain: this.domain,
          title: this.title,
          version,
          judgment: "silent-rewrite",
          evidenceLevel: this.evidenceLevel,
          sources: [`rfork@${VERIFIED_COMMITS.rforkMain}:vllm_ascend/ascend_config.py#L56-L70`],
          message: `rfork 的 AscendConfig 通过 additional_config.get(...) 按需读取已知键，以下 main 分支专属键会被静默忽略且不生效：${list.join("、")}。`,
          effectiveMutation: strippedMutation,
          remediation: `在 rfork 分支上请移除无效的 ${list.join("、")}，避免误以为对应特性已启用。`,
        };
      }

      const kvPoolHint = list.includes("kv_pool_range_debug")
        ? "（其中 kv_pool_range_debug 在 v0.30.0 应改用环境变量 export VLLM_ASCEND_KVPOOL_RANGE_DEBUG=1）"
        : "";
      const omniActive = input.vllmOmniAvailable === true || input.envFacts?.vllmOmniAvailable === true;
      if (omniActive) {
        return {
          ruleId: this.id,
          domain: this.domain,
          title: this.title,
          version,
          judgment: "silent-rewrite",
          evidenceLevel: this.evidenceLevel,
          sources: [
            `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L1895-L1914`,
          ],
          message: `当前环境检测到 vllm_omni：v0.30.0 的 init_ascend_config 会打印告警并从 AscendConfig 入参剥离以下未知键（对应 main 特性不会生效）：${list.join("、")}。`,
          effectiveMutation: strippedMutation,
          remediation: `从 --additional-config 移除 ${list.join("、")}${kvPoolHint}，或切换到 vllm-ascend main 分支。`,
        };
      }

      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: "error",
        evidenceLevel: this.evidenceLevel,
        sources: [
          `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L397-L410`,
          `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L1895-L1914`,
          `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L656-L741`,
        ],
        message: `ValidationError / TypeError: 标准 v0.30.0（未安装 vllm_omni）的 AscendConfig(extra="forbid") 不存在以下 main 分支专属键：${list.join("、")}，启动将直接报 Extra inputs are not permitted。`,
        remediation: `从 --additional-config 移除 ${list.join("、")}${kvPoolHint}，或切换到 vllm-ascend main 分支。`,
      };
    },
  },
  {
    id: "d5-shared-engram-constraints",
    domain: "graph-sched-env",
    title: "shared_engram 子键范围、并行拓扑、A3/A2/A5 后端边界与进程停机租约校验（main）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L457-L491`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L797-L809`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/models/deepseek_v41/model.py#L1056-L1068`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/models/deepseek_v41/engram/parallel.py#L26-L28`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/platform.py#L2092-L2102`,
    ],
    description:
      "校验 SharedEngramConfig 子键范围与昇腾 Engram 并行约束（TP ∈ {1,2,4,8} 且 PP=DCP=1），区分 A3（MemFabric BM，需 MRv2，禁传 A2/A5 专属键）与 A2/A5（HIXL RDMA/UB，需 --shutdown-timeout > 0、DP×PCP > 1 本地 DP 共享与惰性 safetensors）。",
    rationale: "在配置体检阶段提前拦截平台层、SharedEngramConfig 与模型挂载阶段的 ValueError。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (!input.sharedEngramConfigured) return null;
      const errors: string[] = [];
      if (input.sharedEngramInvalidReason) {
        errors.push(input.sharedEngramInvalidReason);
      }
      const tp = Math.max(1, input.tpSize ?? 1);
      const pp = Math.max(1, input.ppSize ?? 1);
      const dcp = Math.max(1, input.dcpSize ?? 1);
      if ((tp !== 1 && tp !== 2 && tp !== 4 && tp !== 8) || pp !== 1 || dcp !== 1) {
        errors.push(
          `Ascend Engram 要求 tensor_parallel_size ∈ {1, 2, 4, 8} 且 PP=1、DCP=1（当前 TP=${tp}, PP=${pp}, DCP=${dcp}）`,
        );
      }
      const backend = input.sharedEngramBackend;
      if (backend !== "a2" && backend !== "a3" && backend !== "a5") {
        errors.push(`shared_engram.backend 必须为 "a2"、"a3" 或 "a5"（当前为 ${JSON.stringify(backend)}）`);
      }
      const ep = input.sharedEngramEndpoint ?? "";
      const sep = ep.lastIndexOf(":");
      const host = sep > 0 ? ep.slice(0, sep) : "";
      const portStr = sep > 0 ? ep.slice(sep + 1) : "";
      const portNum = /^\d+$/.test(portStr) ? Number.parseInt(portStr, 10) : Number.NaN;
      if (!host || !Number.isInteger(portNum) || portNum <= 0 || portNum >= 65536) {
        errors.push(`shared_engram.endpoint 必须为合法 host:port（1..65535，当前为 ${JSON.stringify(ep)}）`);
      }
      const cap = input.sharedEngramCapacity;
      if (cap !== undefined && (cap < 1 || cap > 262144)) {
        errors.push(`shared_engram.capacity 必须在 [1, 262144] 范围内（当前为 ${cap}）`);
      }
      const lp = input.sharedEngramListenPort;
      if (lp !== undefined && (lp < 1 || lp >= 65536)) {
        errors.push(`shared_engram.listen_port 必须在 [1, 65535] 范围内（当前为 ${lp}）`);
      }
      if (lp !== undefined && input.sharedEngramLocalCommRes) {
        errors.push("shared_engram.listen_port 与 local_comm_res 严格互斥，不能同时设置");
      }
      if (backend === "a3") {
        if (
          (cap !== undefined && cap !== 65536) ||
          input.sharedEngramLibraryPath !== undefined ||
          lp !== undefined ||
          input.sharedEngramLocalCommRes !== undefined
        ) {
          errors.push(
            "A3 后端不接受非默认的 A2/A5 专属子键（capacity / library_path / listen_port / local_comm_res）",
          );
        }
        if (input.useV2ModelRunner === false) {
          errors.push("shared_engram backend='a3' 要求启用 Model Runner V2（VLLM_USE_V2_MODEL_RUNNER=1）");
        }
        if (input.enableSleepMode === true || input.loadFormat === "dummy") {
          errors.push("shared_engram backend='a3' 不支持 --enable-sleep-mode 或 --load-format dummy");
        }
      } else if (backend === "a2" || backend === "a5") {
        const effectiveShutdownTimeout =
          input.shutdownTimeout ?? (input.usageContext === "vllm_serve" ? 0 : undefined);
        if (effectiveShutdownTimeout !== undefined && effectiveShutdownTimeout <= 0) {
          errors.push(
            "shared_engram backend='a2'/'a5' 要求显式设置 --shutdown-timeout > 0（vllm serve 默认为 0）以回收远端读者租约",
          );
        }
        const hasExplicitDpOrPcp =
          input.usageContext === "vllm_serve" || input.dpSize !== undefined || input.pcpSize !== undefined;
        const edpSize = Math.max(1, input.dpSize ?? 1) * Math.max(1, input.pcpSize ?? 1);
        if (hasExplicitDpOrPcp && edpSize <= 1) {
          errors.push(
            `shared_engram backend='a2'/'a5' 要求本地 DP 共享激活（DP × PCP > 1，当前 DP=${input.dpSize ?? 1}, PCP=${input.pcpSize ?? 1}）`,
          );
        }
        if (
          input.loadFormat !== undefined &&
          input.loadFormat !== "auto" &&
          input.loadFormat !== "safetensors"
        ) {
          errors.push(`shared_engram 要求惰性 safetensors 加载，不支持 --load-format ${input.loadFormat}`);
        }
      }
      if (errors.length === 0) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: "error",
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `ValueError: ${errors.join("；")}。`,
        remediation:
          "确保 TP ∈ {1,2,4,8} 且 PP=DCP=1，核对 shared_engram 必填键（backend + host:port endpoint）；A3 去掉 A2/A5 子键并开启 MRv2，A2/A5 需满足 DP×PCP > 1 且显式设置 --shutdown-timeout > 0。",
      };
    },
  },
  {
    id: "d5-multistream-engram-overlap-cudagraph-gate",
    domain: "graph-sched-env",
    title: "multistream_engram_overlap 在 PIECEWISE 分段图步进下自动回退主流串行",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["v0.30.0", "main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/ascend_config.py#L567-L575`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendV030}:vllm_ascend/models/deepseek_v41/model.py#L1433`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/models/deepseek_v41/model.py#L1546`,
    ],
    description:
      "prepare_engram_inputs 在单步 cg_mode in (CUDAGraphMode.NONE, CUDAGraphMode.FULL) 时激活辅助流重叠（FULL_DECODE_ONLY 展开为 FULL 与 NONE 均可生效）；PIECEWISE 模式或 FULL_AND_PIECEWISE 的分段步会自动退回主流串行。",
    rationale: "分段图边界破坏整图跨流外部事件链，只有 NONE 与 FULL 单步能保持跨流外部事件同步。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.multistreamEngramOverlap !== true) return null;
      const mode = input.cudagraphMode;
      if (mode !== "PIECEWISE" && mode !== "FULL_AND_PIECEWISE") return null;
      const message =
        mode === "FULL_AND_PIECEWISE"
          ? "已显式开启 multistream_engram_overlap=true 且 cudagraph_mode=FULL_AND_PIECEWISE：纯 Decode 的 FULL 步仍启用辅助流重叠，但分段图 PIECEWISE 的 Prefill/混合步会自动退回主流串行。"
          : "已显式开启 multistream_engram_overlap=true，但当前 cudagraph_mode=PIECEWISE；源码仅在单步 cg_mode 为 NONE 或 FULL（含 FULL_DECODE_ONLY）时启用辅助流重叠，所有分段步均会退回主流串行。";
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: "warn",
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message,
        remediation: `若需启用 Engram 辅助流重叠，请改用 -cc '{"cudagraph_mode":"FULL"}' 或 '{"cudagraph_mode":"FULL_DECODE_ONLY"}'。`,
      };
    },
  },
  {
    id: "d5-gdn-prefill-checkpoints-constraints",
    domain: "graph-sched-env",
    title:
      "gdn_internal_prefill_checkpoints 依赖 mamba_cache_mode='align'、BF16、PCP=1、未开 DBO 且无 KV 传输（main）",
    judgment: "warn",
    evidenceLevel: "C",
    versions: ["main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L741`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ops/gdn_checkpoint.py#L24-L53`,
    ],
    description:
      "开启 gdn_internal_prefill_checkpoints=True 时，若 mamba_cache_mode != 'align'、PCP > 1、dtype != bfloat16、use_ubatching (--enable-dbo) 或启用了 kv_transfer_config，initialize_gdn_checkpoints 将跳过或告警回退常规切分调度。",
    rationale: "64-token Triton 分块检查点要求对齐页模式、单 PCP、BF16、非微批流水以及一致的块边界规划。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      if (input.gdnInternalPrefillCheckpoints !== true) return null;
      const reasons: string[] = [];
      if (input.mambaCacheMode !== undefined && input.mambaCacheMode !== "align") {
        reasons.push(`--mamba-cache-mode='${input.mambaCacheMode}'（需为 'align'）`);
      }
      if ((input.pcpSize ?? 1) > 1) {
        reasons.push(`prefill_context_parallel_size=${input.pcpSize}（需为 1）`);
      }
      if (input.modelDtype !== undefined && input.modelDtype !== "bfloat16") {
        reasons.push(`dtype=${input.modelDtype}（需为 bfloat16）`);
      }
      if (input.useUbatching === true) {
        reasons.push("已开启 --enable-dbo（use_ubatching=True，与 GDN 内部检查点互斥）");
      }
      if (input.kvConnector !== undefined || input.kvRole !== undefined) {
        reasons.push("已启用 kv_transfer_config（P/D 分离下连接器边界与检查点规划器不兼容，会告警回退）");
      }
      if (reasons.length === 0) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: "warn",
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `gdn_internal_prefill_checkpoints=true 因以下条件不满足将被跳过并回退常规 Prefill 调度：${reasons.join("；")}。`,
        remediation:
          "请确保开启 --mamba-cache-mode align、--dtype bfloat16、PCP=1、关闭 --enable-dbo，且不在 P/D 分离实例上强求 GDN 内部检查点导出。",
      };
    },
  },
  {
    id: "d5-runtime-config-constraints",
    domain: "graph-sched-env",
    title: "Runtime Guard 启动参数类型校验与热重载前置检查（main）",
    judgment: "error",
    evidenceLevel: "C",
    versions: ["main"],
    sources: [
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/ascend_config.py#L697-L701`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/observability/runtime_config/__init__.py#L46-L82`,
      `vllm-ascend@${VERIFIED_COMMITS.vllmAscendMain}:vllm_ascend/observability/runtime_config/config.py#L535-L565`,
    ],
    description:
      "校验 runtime_config（须为 dict 且不含仅启动键 runtime_config_hot_reload）、runtime_config_path（须为 str）与 runtime_config_hot_reload（仅认 bool 或 0/1，传轮询秒数抛 ValueError），并提示手动 dump 依赖热重载。",
    rationale: "build_runtime_config_from_additional 在构造 AscendConfig 前对类型与布尔取值做严格校验。",
    evaluate(input, version = DEFAULT_RULE_VERSION): RuleMatch | null {
      if (!isVersionSupported(this, version)) return null;
      const errors: string[] = [];
      if (input.runtimeConfigInvalidType !== undefined) {
        errors.push(
          `additional_config.runtime_config 必须为 JSON 对象（dict），实际为 ${input.runtimeConfigInvalidType}`,
        );
      }
      if (input.runtimeConfigPathInvalidType !== undefined) {
        errors.push(
          `additional_config.runtime_config_path 必须为字符串，实际为 ${input.runtimeConfigPathInvalidType}`,
        );
      }
      if (input.runtimeConfigHotReloadInvalidValue !== undefined) {
        errors.push(
          `additional_config.runtime_config_hot_reload 仅接受 bool 或整数 0/1（周期固定 3.0s，不可传 ${JSON.stringify(input.runtimeConfigHotReloadInvalidValue)}）`,
        );
      }
      if (errors.length > 0) {
        return {
          ruleId: this.id,
          domain: this.domain,
          title: this.title,
          version,
          judgment: "error",
          evidenceLevel: this.evidenceLevel,
          sources: this.sources,
          message: `ValueError: ${errors.join("；")}。`,
          remediation:
            "将 runtime_config_hot_reload 设为 true/false（不要传秒数），runtime_config 设为合法字典，runtime_config_path 设为字符串路径。",
        };
      }
      const warnings: string[] = [];
      if (input.runtimeConfigHasNestedHotReload) {
        warnings.push(
          "runtime_config 字典内部包含 runtime_config_hot_reload；该键仅能写在 additional_config 顶层，写在内部会导致启动覆盖层校验失败并回退默认配置",
        );
      }
      if (input.runtimeConfigManualDumpSet && input.runtimeConfigHotReload !== true) {
        warnings.push(
          "在 runtime_config.dump 中配置了 manual_dump 但未开启顶层 runtime_config_hot_reload=true，后续在线推进水位线不会生效",
        );
      }
      if (warnings.length === 0) return null;
      return {
        ruleId: this.id,
        domain: this.domain,
        title: this.title,
        version,
        judgment: "warn",
        evidenceLevel: this.evidenceLevel,
        sources: this.sources,
        message: `${warnings.join("；")}。`,
        remediation:
          "将 runtime_config_hot_reload: true 放在 --additional-config 顶层，并在服务启动后再按 1 -> 2 -> 3 递增编辑磁盘 runtime_config.json。",
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
