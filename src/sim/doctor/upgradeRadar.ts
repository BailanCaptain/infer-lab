import type { EvidenceLevel, RuleVersion } from "../rules/types";
import { type ParsedVllmServeCommand, parseVllmServeCommand } from "./cliParser";

export type UpgradeFromVersion = "v0.23.0" | "v0.26.0rc";
export type UpgradeTargetVersion = Extract<RuleVersion, "v0.30.0" | "main">;

export type UpgradeImpactSeverity =
  | "breaking-error"
  | "silent-noop"
  | "behavior-changed"
  | "legacy-counterproductive";

export type UpgradeRadarScope = "single" | "prefill" | "decode";

export const UPGRADE_RADAR_COMMITS: Readonly<Record<UpgradeFromVersion | UpgradeTargetVersion, string>> = {
  "v0.23.0": "2c59ff10",
  "v0.26.0rc": "2ed6cbba",
  "v0.30.0": "c09d3e20",
  main: "8d6180e2",
};

/**
 * One-click realistic v0.23.0 startup script hitting all 4 migration shockwave categories:
 * - breaking-error: weight_prefetch_config rejected by Pydantic extra="forbid"
 * - silent-noop: VLLM_ASCEND_ENABLE_NZ=0 & VLLM_ASCEND_ENABLE_MLAPO=0 have 0 reads
 * - behavior-changed: VLLM_ASCEND_ENABLE_FLASHCOMM1=1 + JSON enable_flashcomm1:false precedence flip,
 *   plus top-level enable_balance_scheduling migrated to scheduler_config
 * - legacy-counterproductive: --enforce-eager disables ACLGraph + npugraph_ex static replay
 */
export const LEGACY_V023_MIGRATION_SAMPLE_CMD = [
  "export ASCEND_RT_VISIBLE_DEVICES=0,1,2,3",
  "export VLLM_ASCEND_ENABLE_NZ=0",
  "export VLLM_ASCEND_ENABLE_MLAPO=0",
  "export VLLM_ASCEND_ENABLE_FLASHCOMM1=1",
  "vllm serve /models/Qwen3-30B-A3B-W8A8 \\",
  "  --served-model-name qwen3-30b-a3b \\",
  "  --tensor-parallel-size 4 \\",
  "  --enable-expert-parallel \\",
  "  --quantization ascend \\",
  "  --enforce-eager \\",
  '  --additional-config \'{"weight_prefetch_config":{"enabled":true},"enable_flashcomm1":false,"enable_balance_scheduling":true}\'',
].join("\n");

export const UPGRADE_RADAR_HONEST_BOUNDARY_NOTE =
  "本雷达仅基于锁定提交（v0.23.0@2c59ff10 / v0.26.0rc@2ed6cbba → v0.30.0@c09d3e20 / main@8d6180e2）对粘贴命令中的 --additional-config 键名与层级、已退役插件环境变量、FlashComm1 优先级及 Eager 绕过开关做静态源码比对；无法核验容器镜像暗注的外部环境变量、是否安装 vllm_omni 触发未知顶层键告警过滤、CANN/驱动/torch_npu 五维二进制配套以及量化权重目录格式变更，上线前仍须在目标 NPU 实机核对启动日志与 /v1/chat/completions 冒烟结果。" as const;

export interface UpgradeRadarItem {
  id: string;
  scope: UpgradeRadarScope;
  severity: UpgradeImpactSeverity;
  subject: string;
  title: string;
  legacyBehavior: string;
  targetBehavior: string;
  remediation: string;
  evidenceLevel: EvidenceLevel;
  sources: readonly string[];
  wikiPageIds: readonly string[];
}

export interface UpgradeRadarCounts {
  total: number;
  breakingError: number;
  silentNoop: number;
  behaviorChanged: number;
  legacyCounterproductive: number;
}

export interface UpgradeRadarPdRecommendedCommands {
  prefillCommand: string;
  decodeCommand: string;
}

export interface UpgradeRadarReport {
  topology: "single" | "pd";
  fromVersion: UpgradeFromVersion;
  toVersion: UpgradeTargetVersion;
  fromCommit: string;
  toCommit: string;
  items: readonly UpgradeRadarItem[];
  counts: UpgradeRadarCounts;
  hasBreakingErrors: boolean;
  relatedWikiIds: readonly string[];
  honestBoundaryNote: string;
  recommendedSingleCommand?: string;
  recommendedPdCommands?: UpgradeRadarPdRecommendedCommands;
}

const VLLM_OMNI_TOP_LEVEL_FILTER_NOTE =
  "（例外边界：仅当运行环境安装了 vllm_omni 时，init_ascend_config 会对未知顶层键先打 warning 再过滤，但旧功能仍不会恢复；标准 vllm-ascend 环境直接抛 ValidationError 中止启动）";

const COMMON_VALID_TOP_LEVEL_KEYS: readonly string[] = [
  // Factory _NON_USER_INPUT_KEYS & upstream-injected selectors
  "refresh",
  "gdn_prefill_backend",
  "kda_prefill_backend",
  "enable_flashcomm1",
  "scheduler_config",
  "sparse_kv_offload_config",
  "enable_kvpp",
  "kvpp_config",
  "dump_config",
  "dump_config_path",
  "enable_sparse_li_c4",
  "enable_sparse_sfa_turboquant",
  "enable_sp_by_pass",
  "pd_tp_ratio",
  "pd_head_ratio",
  "num_head_replica",
  "_sparse_li_c8_layer_ids",
  "_sparse_li_c8_layer_names",
  "_sparse_li_c4_layer_ids",
  "_sparse_li_c4_layer_names",
  "_sparse_li_layer_filter_enabled",
  // Legacy top-level scheduler keys stripped by factory in both v0.30.0 & main
  "enable_balance_scheduling",
  "recompute_scheduler_enable",
  "short_request_first_config",
  "batch_job_sched_config",
  // AscendConfig dataclass user switches & sub-configs
  "enable_cpu_binding",
  "multistream_dsv4_dsa_overlap",
  "multistream_engram_overlap",
  "enable_prefill_mc2",
  "multistream_overlap_shared_expert",
  "enable_kv_nz",
  "enable_mc2_hierarchy_comm",
  "sfa_dcp_force_tmajor_restore",
  "enable_force_eplb",
  "enable_pcp_o_proj_weight_sharding",
  "enable_pcp_embedding_lmhead_weight_sharding",
  "mix_placement",
  "combine_quant_mode",
  "pa_shape_list",
  "mega_moe_max_tokens",
  "ascend_log_path",
  "mc2_comm_alg",
  "enable_fused_mc2",
  "enable_mlapo",
  "mlapo_keep_prefill_weights",
  "msmonitor_use_daemon",
  "enable_transpose_kv_cache_by_block",
  "weight_nz_mode",
  "ascend_compilation_config",
  "ascend_fusion_config",
  "ascend_warmup_config",
  "eplb_config",
  "rejection_sampler_config",
  "rl_config",
  "xlite_graph_config",
  "finegrained_tp_config",
  "enable_shared_expert_dp",
  "enable_sparse_sfa_c8",
  "enable_sparse_li_c8",
];

const V030_ONLY_TOP_LEVEL_KEYS: readonly string[] = [
  "dynamic_spec_config",
  "profiling_chunk_config",
  "enable_dsa_cp",
  "draft_window_size",
];

const MAIN_ONLY_TOP_LEVEL_KEYS: readonly string[] = [
  "shared_engram",
  "kv_trace",
  "kv_pool_range_debug",
  "runtime_config",
  "runtime_config_path",
  "runtime_config_hot_reload",
  "runtime_report_dir",
  "runtime_dump_dir",
  "megamoe_shared_expert_fusion",
  "quantized_all_reduce_config",
  "gdn_internal_prefill_checkpoints",
];

export const VALID_TOP_LEVEL_KEYS_BY_TARGET: Readonly<Record<UpgradeTargetVersion, ReadonlySet<string>>> = {
  "v0.30.0": new Set([...COMMON_VALID_TOP_LEVEL_KEYS, ...V030_ONLY_TOP_LEVEL_KEYS]),
  main: new Set([...COMMON_VALID_TOP_LEVEL_KEYS, ...MAIN_ONLY_TOP_LEVEL_KEYS]),
};

export const VALID_ASCEND_COMPILATION_KEYS: ReadonlySet<string> = new Set([
  "enable_npugraph_ex",
  "enable_static_kernel",
  "enable_super_kernel",
  "fuse_norm_quant",
  "fuse_qknorm_rope",
  "fuse_muls_add",
]);

export const VALID_ASCEND_FUSION_KEYS: ReadonlySet<string> = new Set(["fusion_ops_gmmswigluquant"]);

export const VALID_ASCEND_WARMUP_KEYS: ReadonlySet<string> = new Set([
  "enable_early_kernel_warmup",
  "enable_early_nz_warmup",
]);

export const VALID_STAIR_KEYS: ReadonlySet<string> = new Set([
  "load_window_bins",
  "load_risk_quantile",
  "relative_balance_threshold",
  "absolute_balance_threshold",
  "rank_transfer_limit",
  "cross_node_transfer_limit",
  "replica_search_num_stages",
  "replica_search_radius",
  "replica_search_beam_size",
  "placement_search_backtrack_limit",
]);

export const VALID_EPLB_KEYS: ReadonlySet<string> = new Set([
  "dynamic_eplb",
  "expert_map_path",
  "expert_heat_collection_interval",
  "algorithm_execution_interval",
  "expert_map_record_path",
  "num_redundant_experts",
  "eplb_policy_type",
  "eplb_heat_collection_stage",
  "load_collection_phase",
  "stair_config",
]);

export const VALID_REJECTION_SAMPLER_KEYS: ReadonlySet<string> = new Set([
  "enable_block_verify",
  "enable_entropy_verify",
  "posterior_threshold",
  "posterior_alpha",
]);

export const VALID_RL_KEYS: ReadonlySet<string> = new Set([
  "enabled",
  "sleep_mode_extra_cleanup",
  "enable_training_consistency",
  "enable_batch_invariant",
]);

export const VALID_XLITE_GRAPH_KEYS: ReadonlySet<string> = new Set(["enabled", "full_mode"]);

export const VALID_FINEGRAINED_TP_KEYS_BY_TARGET: Readonly<
  Record<UpgradeTargetVersion, ReadonlySet<string>>
> = {
  "v0.30.0": new Set([
    "oproj_tensor_parallel_size",
    "lmhead_tensor_parallel_size",
    "embedding_tensor_parallel_size",
    "mlp_tensor_parallel_size",
  ]),
  main: new Set([
    "oproj_tensor_parallel_size",
    "lmhead_tensor_parallel_size",
    "embedding_tensor_parallel_size",
    "mlp_tensor_parallel_size",
    "qkv_iproj_tensor_parallel_size",
  ]),
};

export const VALID_SPARSE_KV_OFFLOAD_KEYS_BY_TARGET: Readonly<
  Record<UpgradeTargetVersion, ReadonlySet<string>>
> = {
  "v0.30.0": new Set([
    "enabled",
    "topk_buffer_size",
    "dram_size_per_dp_GB",
    "keep_device_kv_cache",
    "use_fused_overlap",
    "fused_op_type",
  ]),
  main: new Set([
    "enabled",
    "topk_buffer_size",
    "dram_size_per_dp_GB",
    "keep_device_kv_cache",
    "store_port_base",
    "use_fused_overlap",
  ]),
};

export const VALID_SHORT_REQUEST_FIRST_KEYS: ReadonlySet<string> = new Set([
  "enabled",
  "threshold",
  "long_max_wait_ms",
]);

export const VALID_PROFILING_CHUNK_KEYS: ReadonlySet<string> = new Set([
  "enabled",
  "smooth_factor",
  "min_chunk",
  "need_timing",
  "max_fit_chunk",
]);

export const VALID_BATCH_JOB_SCHED_KEYS: ReadonlySet<string> = new Set([
  "enabled",
  "max_jobs",
  "reserve_margin_blocks",
  "reserve_max_blocks",
  "low_available_tokens_threshold",
  "short_decode_token_threshold",
]);

export const VALID_DYNTRA_LB_KEYS: ReadonlySet<string> = new Set([
  "enabled",
  "enable_diagnostics",
  "mode",
  "start_step",
  "end_step",
  "bubble_threshold",
  "long_req_block_threshold",
  "dynamic_max_step",
]);

export const VALID_DYNAMIC_SPEC_KEYS: ReadonlySet<string> = new Set(["method", "method_params"]);
export const VALID_KVPP_KEYS: ReadonlySet<string> = new Set(["size"]);
export const VALID_QUANTIZED_ALL_REDUCE_KEYS: ReadonlySet<string> = new Set([
  "enable",
  "min_numel",
  "quant_dtype",
]);
export const VALID_SHARED_ENGRAM_KEYS: ReadonlySet<string> = new Set([
  "backend",
  "endpoint",
  "capacity",
  "library_path",
  "listen_port",
  "local_comm_res",
]);
export const VALID_KV_TRACE_KEYS: ReadonlySet<string> = new Set(["enabled", "action"]);

export const VALID_SCHEDULER_KEYS_BY_TARGET: Readonly<Record<UpgradeTargetVersion, ReadonlySet<string>>> = {
  "v0.30.0": new Set([
    "enable_balance_scheduling",
    "recompute_scheduler_enable",
    "short_request_first_config",
    "profiling_chunk_config",
    "batch_job_sched_config",
    "dyntra_lb_config",
  ]),
  main: new Set([
    "enable_balance_scheduling",
    "recompute_scheduler_enable",
    "short_request_first_config",
    "batch_job_sched_config",
    "dyntra_lb_config",
  ]),
};

interface RemovedJsonKeySpec {
  id: string;
  targets: readonly UpgradeTargetVersion[];
  title: string;
  legacyByFrom: Readonly<Record<UpgradeFromVersion, string>>;
  remediation: string;
  legacySourcesByFrom: Readonly<Record<UpgradeFromVersion, readonly string[]>>;
  wikiPageIds: readonly string[];
}

const KNOWN_REMOVED_TOP_LEVEL_KEYS: Readonly<Record<string, RemovedJsonKeySpec>> = {
  weight_prefetch_config: {
    id: "radar-removed-key-weight-prefetch-config",
    targets: ["v0.30.0", "main"],
    title: "已删子配置 weight_prefetch_config 在严格校验下触发启动报错",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 解析为 WeightPrefetchConfig，在独立流上提前将线性层权重搬入 L2 cache。",
      "v0.26.0rc":
        "v0.26.0rc (2ed6cbba) 虽已随 PR #11949 删除权重预取模块，但 AscendConfig 逐键 .get() 静默忽略该残留键，服务仍能启动。",
    },
    remediation:
      "从 --additional-config 中删除 weight_prefetch_config（HBM→L2 权重预取已彻底下线且无同义替代参数）。",
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L52-L53"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L73"],
    },
    wikiPageIds: ["ascend-config-system"],
  },
  layer_sharding: {
    id: "radar-removed-key-layer-sharding",
    targets: ["v0.30.0", "main"],
    title: "已删顶层键 layer_sharding 在严格校验下触发启动报错",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 在 PD P 节点上按层轮放线性层权重并在前向异步 Broadcast。",
      "v0.26.0rc":
        "v0.26.0rc (2ed6cbba) 已随 PR #11953 删除按层轮放实现，但逐键 .get() 静默忽略该残留键而不报错。",
    },
    remediation:
      "从 --additional-config 中删除 layer_sharding（注意新版 enable_pcp_o_proj_weight_sharding 切分同层 PCP 权重，非按层轮放替代）。",
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L105-L112"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L359"],
    },
    wikiPageIds: ["ascend-config-system", "pd-disaggregation"],
  },
  enable_reduce_sample: {
    id: "radar-removed-key-enable-reduce-sample",
    targets: ["v0.30.0", "main"],
    title: "已删顶层键 enable_reduce_sample 在严格校验下触发启动报错",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 读取实验性采样归约开关 enable_reduce_sample（默认 False）。",
      "v0.26.0rc": "v0.26.0rc (2ed6cbba) 仍通过 .get() 读取或容忍 enable_reduce_sample。",
    },
    remediation: "从 --additional-config 中删除 enable_reduce_sample（已从 AscendConfig 输入 schema 移除）。",
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L317-L335"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L359"],
    },
    wikiPageIds: ["ascend-config-system"],
  },
};

const EXTRA_REMOVED_TOP_LEVEL_KEYS: Readonly<Record<string, RemovedJsonKeySpec>> = {
  dynamic_spec_config: {
    id: "radar-removed-key-dynamic-spec-config",
    targets: ["main"],
    title: "升级 main 时已删子配置 dynamic_spec_config 触发严格校验报错",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 逐键 .get() 忽略未知顶层键，不会阻断启动。",
      "v0.26.0rc":
        "v0.26.0rc (2ed6cbba) 尚未引入 dynamic_spec_config，但 AscendConfig.__init__ 逐键 .get() 静默忽略该未知顶层键而不报错（v0.30.0 曾支持该子配置）。",
    },
    remediation: "升级至 main (8d6180e2) 时请从 --additional-config 删除 dynamic_spec_config。",
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L27-L94"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L359"],
    },
    wikiPageIds: ["ascend-config-system"],
  },
  profiling_chunk_config: {
    id: "radar-removed-key-profiling-chunk-config-main",
    targets: ["main"],
    title: "升级 main 时顶层 profiling_chunk_config 已移除并触发严格校验报错",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 在顶层直接解析 ProfilingChunkConfig 启动拟合分块曲线。",
      "v0.26.0rc":
        "v0.26.0rc (2ed6cbba) 将 profiling_chunk_config 迁入 scheduler_config，顶层写法仅打 deprecated 警告仍可解析。",
    },
    remediation:
      "main (8d6180e2) 已从 _NON_USER_INPUT_KEYS 与 SchedulerConfig 中整体移除 profiling_chunk_config，请删除该配置。",
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L54-L94"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L968-L1040"],
    },
    wikiPageIds: ["ascend-config-system", "dynamic-chunked-pp"],
  },
  enable_matmul_allreduce: {
    id: "radar-removed-key-enable-matmul-allreduce",
    targets: ["v0.30.0", "main"],
    title: "已删顶层键 enable_matmul_allreduce 在严格校验下触发启动报错",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 控制 RowParallelLinear 切换 npu_mm_all_reduce_base 通算融合。",
      "v0.26.0rc": "v0.26.0rc (2ed6cbba) 已随 PR #12119 移除该功能，但 .get() 静默忽略顶层旧键。",
    },
    remediation: "从 --additional-config 中删除 enable_matmul_allreduce。",
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L167-L172"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L359"],
    },
    wikiPageIds: ["ascend-config-system", "tensor-parallel"],
  },
  enable_sleep_mode_extra_cleanup: {
    id: "radar-removed-key-sleep-mode-extra-cleanup",
    targets: ["v0.30.0", "main"],
    title: "旧顶层键 enable_sleep_mode_extra_cleanup 已迁入 rl_config 并触发报错",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 从顶层读取 enable_sleep_mode_extra_cleanup。",
      "v0.26.0rc": "v0.26.0rc (2ed6cbba) 从顶层读取 enable_sleep_mode_extra_cleanup。",
    },
    remediation:
      '删除顶层键，改写为 --additional-config \'{"rl_config":{"sleep_mode_extra_cleanup":true}}\'。',
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L162-L256"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L359"],
    },
    wikiPageIds: ["ascend-config-system", "vllm-ascend-for-rl"],
  },
};

const ALL_KNOWN_REMOVED_TOP_LEVEL_KEYS: Readonly<Record<string, RemovedJsonKeySpec>> = {
  ...KNOWN_REMOVED_TOP_LEVEL_KEYS,
  ...EXTRA_REMOVED_TOP_LEVEL_KEYS,
};

interface RetiredEnvRadarSpec {
  id: string;
  title: string;
  legacyByFrom: Readonly<Record<UpgradeFromVersion, string>>;
  targetSummary: (rawVal: string, toVersion: UpgradeTargetVersion) => string;
  remediation: (rawVal: string, toVersion: UpgradeTargetVersion) => string;
  legacySourcesByFrom: Readonly<Record<UpgradeFromVersion, readonly string[]>>;
  wikiPageIds: readonly string[];
}

function parseBoolEnvFlag(rawVal: string, fallback: boolean): boolean {
  const trimmed = rawVal.trim().toLowerCase();
  if (trimmed === "0" || trimmed === "false") return false;
  if (trimmed === "1" || trimmed === "true") return true;
  return fallback;
}

const RETIRED_ENV_RADAR_SPECS: Readonly<Record<string, RetiredEnvRadarSpec>> = {
  VLLM_ASCEND_ENABLE_NZ: {
    id: "radar-retired-env-nz",
    title: "环境变量 VLLM_ASCEND_ENABLE_NZ 已下线（0 处读取，须迁至 weight_nz_mode）",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 在 envs.py 读取并作为 weight_nz_mode (0/1/2) 的兼容回退。",
      "v0.26.0rc": "v0.26.0rc (2ed6cbba) 仍在 envs.py 读取并参与 weight_nz_mode 双轨映射。",
    },
    targetSummary: (raw, toVer) =>
      `${toVer} (${UPGRADE_RADAR_COMMITS[toVer]}) 已从 envs.py 彻底移除该变量（仓内 0 读取），导出 VLLM_ASCEND_ENABLE_NZ=${raw} 不报错但完全无效，默认仍按 weight_nz_mode=1 运行。`,
    remediation: (raw) => {
      const n = Number.parseInt(raw.trim(), 10);
      const mode = n === 0 || n === 1 || n === 2 ? n : 0;
      return `删除 export VLLM_ASCEND_ENABLE_NZ，改传 --additional-config '{"weight_nz_mode": ${mode}}'（0=关闭, 1=仅量化转 NZ[默认], 2=浮点尽量转 NZ）。`;
    },
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/envs.py#L90-L93"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L85-L88"],
    },
    wikiPageIds: ["ascend-env-and-serve", "ascend-config-system", "tensor-layout"],
  },
  VLLM_ASCEND_ENABLE_MLAPO: {
    id: "radar-retired-env-mlapo",
    title: "环境变量 VLLM_ASCEND_ENABLE_MLAPO 已下线（0 处读取，须迁至 enable_mlapo）",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 在 envs.py 读取（默认 '1'）并回退驱动 AscendConfig.enable_mlapo。",
      "v0.26.0rc": "v0.26.0rc (2ed6cbba) 在 envs.py 读取并回退驱动 AscendConfig.enable_mlapo。",
    },
    targetSummary: (raw, toVer) =>
      `${toVer} (${UPGRADE_RADAR_COMMITS[toVer]}) 已从 envs.py 删除该变量（0 读取），导出 VLLM_ASCEND_ENABLE_MLAPO=${raw} 静默失效（enable_mlapo 默认保持 true）。`,
    remediation: (raw) =>
      `删除 export VLLM_ASCEND_ENABLE_MLAPO，改传 --additional-config '{"enable_mlapo": ${parseBoolEnvFlag(raw, true)}}'。`,
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/envs.py#L84-L89"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L75-L80"],
    },
    wikiPageIds: ["ascend-env-and-serve", "ascend-config-system"],
  },
  VLLM_ASCEND_ENABLE_FUSED_MC2: {
    id: "radar-retired-env-fused-mc2",
    title: "环境变量 VLLM_ASCEND_ENABLE_FUSED_MC2 已下线（0 处读取，须迁至 enable_fused_mc2）",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 在 envs.py 读取整数模式（0/1/2）驱动融合 MC2 算子选择。",
      "v0.26.0rc": "v0.26.0rc (2ed6cbba) 在 envs.py 读取整数模式回退给 AscendConfig.enable_fused_mc2。",
    },
    targetSummary: (raw, toVer) =>
      `${toVer} (${UPGRADE_RADAR_COMMITS[toVer]}) 已移除该环境变量（0 读取），导出 VLLM_ASCEND_ENABLE_FUSED_MC2=${raw} 静默失效（默认退回 enable_fused_mc2=0）。`,
    remediation: (raw, toVer) => {
      const n = Number.parseInt(raw.trim(), 10);
      const maxAllowed = toVer === "main" ? 3 : 2;
      const mode = Number.isInteger(n) && n >= 0 && n <= maxAllowed ? n : 1;
      return `删除 export VLLM_ASCEND_ENABLE_FUSED_MC2，改传 --additional-config '{"enable_fused_mc2": ${mode}}'。`;
    },
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/envs.py#L96-L103"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L91-L97"],
    },
    wikiPageIds: ["ascend-env-and-serve", "ascend-config-system", "expert-parallel"],
  },
};

const EXTRA_RETIRED_ENV_RADAR_SPECS: Readonly<Record<string, RetiredEnvRadarSpec>> = {
  MSMONITOR_USE_DAEMON: {
    id: "radar-retired-env-msmonitor",
    title: "环境变量 MSMONITOR_USE_DAEMON 已下线（0 处读取，须迁至 msmonitor_use_daemon）",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 在 envs.py 读取并回退驱动 AscendConfig.msmonitor_use_daemon。",
      "v0.26.0rc": "v0.26.0rc (2ed6cbba) 在 envs.py 读取并回退驱动 AscendConfig.msmonitor_use_daemon。",
    },
    targetSummary: (raw, toVer) =>
      `${toVer} (${UPGRADE_RADAR_COMMITS[toVer]}) 已从 envs.py 移除 MSMONITOR_USE_DAEMON（0 读取），导出 ${raw} 静默无效。`,
    remediation: (raw) =>
      `删除 export MSMONITOR_USE_DAEMON，改传 --additional-config '{"msmonitor_use_daemon": ${parseBoolEnvFlag(raw, true)}}'。`,
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/envs.py#L82-L83"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L73-L74"],
    },
    wikiPageIds: ["ascend-env-and-serve", "ascend-config-system"],
  },
  VLLM_ASCEND_BALANCE_SCHEDULING: {
    id: "radar-retired-env-balance-scheduling",
    title: "环境变量 VLLM_ASCEND_BALANCE_SCHEDULING 已下线（0 处读取，须迁至 scheduler_config）",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 在 envs.py 读取并回退驱动 enable_balance_scheduling。",
      "v0.26.0rc": "v0.26.0rc (2ed6cbba) 在 envs.py 读取并作为 SchedulerConfig 均衡调度默认值。",
    },
    targetSummary: (raw, toVer) =>
      `${toVer} (${UPGRADE_RADAR_COMMITS[toVer]}) 已彻底删除 VLLM_ASCEND_BALANCE_SCHEDULING（0 读取），导出 ${raw} 不会开启均衡调度。`,
    remediation: (raw) =>
      `删除 export VLLM_ASCEND_BALANCE_SCHEDULING，改传 --additional-config '{"scheduler_config":{"enable_balance_scheduling":${parseBoolEnvFlag(raw, true)}}}'。`,
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/envs.py#L104-L106"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L98-L100"],
    },
    wikiPageIds: ["ascend-env-and-serve", "ascend-config-system", "balance-scheduling"],
  },
  VLLM_ASCEND_FUSION_OP_TRANSPOSE_KV_CACHE_BY_BLOCK: {
    id: "radar-retired-env-transpose-kv",
    title: "环境变量 VLLM_ASCEND_FUSION_OP_TRANSPOSE_KV_CACHE_BY_BLOCK 已下线（0 处读取）",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 在 envs.py 读取并映射至 enable_transpose_kv_cache_by_block。",
      "v0.26.0rc": "v0.26.0rc (2ed6cbba) 在 envs.py 读取并映射至 enable_transpose_kv_cache_by_block。",
    },
    targetSummary: (raw, toVer) =>
      `${toVer} (${UPGRADE_RADAR_COMMITS[toVer]}) 已从 envs.py 移除该变量（0 读取），导出 ${raw} 静默无效。`,
    remediation: (raw) =>
      `删除该环境变量，改传 --additional-config '{"enable_transpose_kv_cache_by_block": ${parseBoolEnvFlag(raw, true)}}'。`,
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/envs.py#L107-L110"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L101-L104"],
    },
    wikiPageIds: ["ascend-env-and-serve", "ascend-config-system"],
  },
  VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE: {
    id: "radar-retired-env-matmul-allreduce",
    title: "环境变量 VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE 已移除（v0.26.0rc 起 0 读取）",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 在 envs.py 读取并开启 RowParallelLinear MatmulAllReduce 融合。",
      "v0.26.0rc": "自 v0.25.1rc1 / v0.26.0rc (2ed6cbba) 起已随 PR #12119 从 envs.py 移除。",
    },
    targetSummary: (raw, toVer) =>
      `${toVer} (${UPGRADE_RADAR_COMMITS[toVer]}) 仓内 0 处读取 VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE=${raw}，静默无效且对应 JSON 键也已删除。`,
    remediation: () => "删除 export VLLM_ASCEND_ENABLE_MATMUL_ALLREDUCE（旧版行并行融合包装已下线）。",
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/envs.py#L69-L71"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L30-L107"],
    },
    wikiPageIds: ["ascend-env-and-serve", "ascend-config-system", "tensor-parallel"],
  },
  VLLM_ASCEND_FLASHCOMM2_PARALLEL_SIZE: {
    id: "radar-retired-env-flashcomm2",
    title: "环境变量 VLLM_ASCEND_FLASHCOMM2_PARALLEL_SIZE 已移除（v0.26.0rc 起 0 读取）",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 在 envs.py 读取 O 矩阵 FlashComm2 并行组规模。",
      "v0.26.0rc": "v0.26.0rc (2ed6cbba) 已随 FlashComm2 下线从 envs.py 移除。",
    },
    targetSummary: (raw, toVer) =>
      `${toVer} (${UPGRADE_RADAR_COMMITS[toVer]}) 仓内 0 处读取 VLLM_ASCEND_FLASHCOMM2_PARALLEL_SIZE=${raw}，静默无效。`,
    remediation: () =>
      "删除 export VLLM_ASCEND_FLASHCOMM2_PARALLEL_SIZE；如需序列并行请评估 enable_flashcomm1 或 PCP/DCP。",
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/envs.py#L76-L81"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L30-L107"],
    },
    wikiPageIds: ["ascend-env-and-serve", "ascend-config-system", "sequence-parallel"],
  },
  VLLM_ASCEND_MLA_FIA_SPLIT: {
    id: "radar-retired-env-mla-fia-split",
    title: "环境变量 VLLM_ASCEND_MLA_FIA_SPLIT 已在 v0.30.0 移除（0 处读取）",
    legacyByFrom: {
      "v0.23.0": "v0.23.0 (2c59ff10) 尚未引入该开关（仅 v0.26.0rc 曾短暂提供实验性 A5 MLA FIA 切分）。",
      "v0.26.0rc": "v0.26.0rc (2ed6cbba) 在 envs.py 读取以开启实验性 A5 MLA Decode FIA 块表切分。",
    },
    targetSummary: (raw, toVer) =>
      `${toVer} (${UPGRADE_RADAR_COMMITS[toVer]}) 已从 envs.py 移除 VLLM_ASCEND_MLA_FIA_SPLIT（0 读取），导出 ${raw} 静默无效。`,
    remediation: () => "从启动脚本中删除 export VLLM_ASCEND_MLA_FIA_SPLIT。",
    legacySourcesByFrom: {
      "v0.23.0": ["vllm-ascend@2c59ff10:vllm_ascend/envs.py#L30-L113"],
      "v0.26.0rc": ["vllm-ascend@2ed6cbba:vllm_ascend/envs.py#L81-L84"],
    },
    wikiPageIds: ["ascend-env-and-serve", "ascend-config-system"],
  },
};

const ALL_RETIRED_ENV_RADAR_SPECS: Readonly<Record<string, RetiredEnvRadarSpec>> = {
  ...RETIRED_ENV_RADAR_SPECS,
  ...EXTRA_RETIRED_ENV_RADAR_SPECS,
};

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function getStrictSchemaSources(toVersion: UpgradeTargetVersion): readonly string[] {
  return toVersion === "main"
    ? [
        "vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L657",
        "vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L2018-L2033",
      ]
    : [
        "vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L568",
        "vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1890-L1907",
      ];
}

function getTargetEnvsSource(toVersion: UpgradeTargetVersion): string {
  return toVersion === "main"
    ? "vllm-ascend@8d6180e2:vllm_ascend/envs.py#L51-L95"
    : "vllm-ascend@c09d3e20:vllm_ascend/envs.py#L38-L90";
}

const LEGACY_SCHEDULER_WIKI_MAP: Readonly<Record<string, readonly string[]>> = {
  enable_balance_scheduling: ["ascend-config-system", "balance-scheduling"],
  recompute_scheduler_enable: ["ascend-config-system", "recompute-scheduler"],
  short_request_first_config: ["ascend-config-system", "short-request-first"],
  profiling_chunk_config: ["ascend-config-system", "dynamic-chunked-pp"],
  batch_job_sched_config: ["ascend-config-system", "batch-job-aware-scheduler"],
};

function evaluateAdditionalConfigItems(
  additionalConfig: Readonly<Record<string, unknown>>,
  scope: UpgradeRadarScope,
  fromVersion: UpgradeFromVersion,
  toVersion: UpgradeTargetVersion,
  out: UpgradeRadarItem[],
): void {
  const validTopLevel = VALID_TOP_LEVEL_KEYS_BY_TARGET[toVersion];
  const strictSources = getStrictSchemaSources(toVersion);
  const fromCommit = UPGRADE_RADAR_COMMITS[fromVersion];
  const toCommit = UPGRADE_RADAR_COMMITS[toVersion];
  const nestedSched = isPlainObject(additionalConfig.scheduler_config)
    ? additionalConfig.scheduler_config
    : null;

  for (const key of Object.keys(additionalConfig)) {
    const knownRemoved = ALL_KNOWN_REMOVED_TOP_LEVEL_KEYS[key];
    if (knownRemoved?.targets.includes(toVersion)) {
      out.push({
        id: knownRemoved.id,
        scope,
        severity: "breaking-error",
        subject: `additional_config.${key}`,
        title: knownRemoved.title,
        legacyBehavior: knownRemoved.legacyByFrom[fromVersion],
        targetBehavior: `${toVersion} (${toCommit}) AscendConfig 采用 Pydantic ConfigDict(extra="forbid")，传入已删键 "${key}" 立即启动失败${VLLM_OMNI_TOP_LEVEL_FILTER_NOTE}。`,
        remediation: knownRemoved.remediation,
        evidenceLevel: "C",
        sources: [...knownRemoved.legacySourcesByFrom[fromVersion], ...strictSources],
        wikiPageIds: knownRemoved.wikiPageIds,
      });
      continue;
    }

    if (!validTopLevel.has(key)) {
      const legacySrc =
        fromVersion === "v0.26.0rc"
          ? "vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L56-L359"
          : "vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L27-L256";
      out.push({
        id: `radar-unknown-top-key-${key}`,
        scope,
        severity: "breaking-error",
        subject: `additional_config.${key}`,
        title: `未知或已下线顶层键 "${key}" 被 extra="forbid" 当场拒收`,
        legacyBehavior: `${fromVersion} (${fromCommit}) 顶层逐键 .get() 解析，未知或拼写错误的键 "${key}" 会被静默忽略并走默认值，服务仍可启动。`,
        targetBehavior: `${toVersion} (${toCommit}) 启用 Pydantic ConfigDict(extra="forbid") 强类型校验，未知顶层键 "${key}" 启动即抛 ValidationError${VLLM_OMNI_TOP_LEVEL_FILTER_NOTE}。`,
        remediation: `核对 "${key}" 是否存在拼写错误或已在 ${toVersion} 移除，从 --additional-config 顶层清理该键。`,
        evidenceLevel: "C",
        sources: [legacySrc, ...strictSources],
        wikiPageIds: ["ascend-config-system"],
      });
    }
  }

  // Check nested sub-configs that switched from **kwargs / .get() to @config(extra="forbid")
  const subChecks: ReadonlyArray<{
    field: string;
    rawSub: unknown;
    validKeys: ReadonlySet<string>;
    legacyNote: string;
  }> = [
    {
      field: "ascend_compilation_config",
      rawSub: additionalConfig.ascend_compilation_config,
      validKeys: VALID_ASCEND_COMPILATION_KEYS,
      legacyNote: `${fromVersion} (${fromCommit}) AscendCompilationConfig 接收 **kwargs 兜底，未知或已删子键会被静默忽略。`,
    },
    {
      field: "ascend_fusion_config",
      rawSub: additionalConfig.ascend_fusion_config,
      validKeys: VALID_ASCEND_FUSION_KEYS,
      legacyNote: `${fromVersion} (${fromCommit}) AscendFusionConfig 接收 **kwargs 兜底，未知子键会被静默忽略。`,
    },
    {
      field: "ascend_warmup_config",
      rawSub: additionalConfig.ascend_warmup_config,
      validKeys: VALID_ASCEND_WARMUP_KEYS,
      legacyNote: `${fromVersion} (${fromCommit}) 未对 ascend_warmup_config 未知子键做 Pydantic extra="forbid" 严格校验。`,
    },
    {
      field: "eplb_config",
      rawSub: additionalConfig.eplb_config,
      validKeys: VALID_EPLB_KEYS,
      legacyNote: `${fromVersion} (${fromCommit}) EplbConfig 仅在手写遍历处检查部分键，${toVersion} 全面切换为 @config(extra="forbid") 强校验（stair_config 同理）。`,
    },
    ...(isPlainObject(additionalConfig.eplb_config)
      ? [
          {
            field: "eplb_config.stair_config",
            rawSub: additionalConfig.eplb_config.stair_config,
            validKeys: VALID_STAIR_KEYS,
            legacyNote: `${fromVersion} (${fromCommit}) 尚未全面对 stair_config 启用 Pydantic extra="forbid" 严格校验。`,
          },
        ]
      : []),
    {
      field: "rejection_sampler_config",
      rawSub: additionalConfig.rejection_sampler_config,
      validKeys: VALID_REJECTION_SAMPLER_KEYS,
      legacyNote: `${fromVersion} (${fromCommit}) RejectionSamplerConfig 逐键 .get() 读取，未知子键会被静默忽略。`,
    },
    {
      field: "rl_config",
      rawSub: additionalConfig.rl_config,
      validKeys: VALID_RL_KEYS,
      legacyNote: `${fromVersion} (${fromCommit}) rl_config 未启用 Pydantic extra="forbid"，未知子键会被静默忽略。`,
    },
    {
      field: "xlite_graph_config",
      rawSub: additionalConfig.xlite_graph_config,
      validKeys: VALID_XLITE_GRAPH_KEYS,
      legacyNote: `${fromVersion} (${fromCommit}) XliteGraphConfig 逐键 .get() 读取，未知子键会被静默忽略。`,
    },
    {
      field: "finegrained_tp_config",
      rawSub: additionalConfig.finegrained_tp_config,
      validKeys: VALID_FINEGRAINED_TP_KEYS_BY_TARGET[toVersion],
      legacyNote: `${fromVersion} (${fromCommit}) FinegrainedTPConfig 逐键 .get() 读取，未知子键会被静默忽略。`,
    },
    {
      field: "sparse_kv_offload_config",
      rawSub: additionalConfig.sparse_kv_offload_config,
      validKeys: VALID_SPARSE_KV_OFFLOAD_KEYS_BY_TARGET[toVersion],
      legacyNote: `${fromVersion} (${fromCommit}) SparseKVOffloadConfig 未全面切换 @config(extra="forbid")。`,
    },
    {
      field: "scheduler_config",
      rawSub: additionalConfig.scheduler_config,
      validKeys: VALID_SCHEDULER_KEYS_BY_TARGET[toVersion],
      legacyNote: `${fromVersion} (${fromCommit}) 旧版调度配置未启用 extra="forbid"（或尚允许 profiling_chunk_config）。`,
    },
    ...(nestedSched !== null
      ? [
          {
            field: "scheduler_config.short_request_first_config",
            rawSub: nestedSched.short_request_first_config,
            validKeys: VALID_SHORT_REQUEST_FIRST_KEYS,
            legacyNote: `${fromVersion} (${fromCommit}) short_request_first_config 未启用 Pydantic extra="forbid"。`,
          },
          {
            field: "scheduler_config.batch_job_sched_config",
            rawSub: nestedSched.batch_job_sched_config,
            validKeys: VALID_BATCH_JOB_SCHED_KEYS,
            legacyNote: `${fromVersion} (${fromCommit}) batch_job_sched_config 逐键 .get() 读取，未知子键会被静默忽略。`,
          },
          {
            field: "scheduler_config.dyntra_lb_config",
            rawSub: nestedSched.dyntra_lb_config,
            validKeys: VALID_DYNTRA_LB_KEYS,
            legacyNote: `${fromVersion} (${fromCommit}) dyntra_lb_config 未启用 Pydantic extra="forbid"。`,
          },
          ...(toVersion === "v0.30.0"
            ? [
                {
                  field: "scheduler_config.profiling_chunk_config",
                  rawSub: nestedSched.profiling_chunk_config,
                  validKeys: VALID_PROFILING_CHUNK_KEYS,
                  legacyNote: `${fromVersion} (${fromCommit}) ProfilingChunkConfig 逐键 .get() 读取，未知子键会被静默忽略。`,
                },
              ]
            : []),
        ]
      : []),
    {
      field: "short_request_first_config",
      rawSub: additionalConfig.short_request_first_config,
      validKeys: VALID_SHORT_REQUEST_FIRST_KEYS,
      legacyNote: `${fromVersion} (${fromCommit}) 顶层 short_request_first_config 未知子键在非严格路径可能被忽略。`,
    },
    {
      field: "batch_job_sched_config",
      rawSub: additionalConfig.batch_job_sched_config,
      validKeys: VALID_BATCH_JOB_SCHED_KEYS,
      legacyNote: `${fromVersion} (${fromCommit}) 顶层 batch_job_sched_config 逐键 .get() 忽略未知子键。`,
    },
    ...(toVersion === "v0.30.0"
      ? [
          {
            field: "profiling_chunk_config",
            rawSub: additionalConfig.profiling_chunk_config,
            validKeys: VALID_PROFILING_CHUNK_KEYS,
            legacyNote: `${fromVersion} (${fromCommit}) ProfilingChunkConfig 逐键 .get() 忽略未知子键。`,
          },
          {
            field: "dynamic_spec_config",
            rawSub: additionalConfig.dynamic_spec_config,
            validKeys: VALID_DYNAMIC_SPEC_KEYS,
            legacyNote: `${fromVersion} (${fromCommit}) 尚未为 dynamic_spec_config 启用 Pydantic extra="forbid"。`,
          },
        ]
      : []),
    {
      field: "kvpp_config",
      rawSub: additionalConfig.kvpp_config,
      validKeys: VALID_KVPP_KEYS,
      legacyNote: `${fromVersion} (${fromCommit}) 未对 kvpp_config 启用 Pydantic extra="forbid"。`,
    },
    ...(toVersion === "main"
      ? [
          {
            field: "quantized_all_reduce_config",
            rawSub: additionalConfig.quantized_all_reduce_config,
            validKeys: VALID_QUANTIZED_ALL_REDUCE_KEYS,
            legacyNote: `${fromVersion} (${fromCommit}) 尚未引入 QuantizedAllReduceConfig 严格校验。`,
          },
          {
            field: "shared_engram",
            rawSub: additionalConfig.shared_engram,
            validKeys: VALID_SHARED_ENGRAM_KEYS,
            legacyNote: `${fromVersion} (${fromCommit}) 尚未引入 SharedEngramConfig 严格校验。`,
          },
          {
            field: "kv_trace",
            rawSub: additionalConfig.kv_trace,
            validKeys: VALID_KV_TRACE_KEYS,
            legacyNote: `${fromVersion} (${fromCommit}) 尚未引入 KVTraceConfig 严格校验。`,
          },
        ]
      : []),
  ];

  for (const sub of subChecks) {
    if (!isPlainObject(sub.rawSub)) continue;
    for (const subKey of Object.keys(sub.rawSub)) {
      if (sub.validKeys.has(subKey)) continue;
      const isMainRemovedProfChunk =
        toVersion === "main" && sub.field === "scheduler_config" && subKey === "profiling_chunk_config";
      out.push({
        id: isMainRemovedProfChunk
          ? "radar-removed-nested-profiling-chunk-main"
          : `radar-unknown-subkey-${sub.field}-${subKey}`,
        scope,
        severity: "breaking-error",
        subject: `additional_config.${sub.field}.${subKey}`,
        title: isMainRemovedProfChunk
          ? "升级 main 时 scheduler_config.profiling_chunk_config 已移除并触发报错"
          : `子配置 ${sub.field} 含未知或已删键 "${subKey}" 触发启动报错`,
        legacyBehavior: sub.legacyNote,
        targetBehavior: `${toVersion} (${toCommit}) 子配置采用 @config (extra="forbid")，"${sub.field}.${subKey}" 立即抛 ValidationError（注意：即使安装了 vllm_omni 也仅过滤顶层未知键，嵌套未知子键一律硬报错）。`,
        remediation: `从 additional_config.${sub.field} 中删除或修正 "${subKey}"。`,
        evidenceLevel: "C",
        sources: strictSources,
        wikiPageIds: isMainRemovedProfChunk
          ? ["ascend-config-system", "dynamic-chunked-pp"]
          : ["ascend-config-system"],
      });
    }
  }

  // Legacy top-level scheduler keys migrated to scheduler_config (behavior-changed)
  const legacySchedKeys =
    toVersion === "v0.30.0"
      ? ([
          "enable_balance_scheduling",
          "recompute_scheduler_enable",
          "short_request_first_config",
          "profiling_chunk_config",
          "batch_job_sched_config",
        ] as const)
      : ([
          "enable_balance_scheduling",
          "recompute_scheduler_enable",
          "short_request_first_config",
          "batch_job_sched_config",
        ] as const);

  const schedTargetSrc =
    toVersion === "main"
      ? "vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L1685-L1735"
      : "vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L1626-L1677";
  const schedLegacySrc =
    fromVersion === "v0.26.0rc"
      ? "vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L968-L1040"
      : "vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L54-L160";

  for (const sKey of legacySchedKeys) {
    if (!Object.hasOwn(additionalConfig, sKey)) continue;
    const shadowedByNested = nestedSched !== null && Object.hasOwn(nestedSched, sKey);
    out.push({
      id: `radar-scheduler-top-level-${sKey}`,
      scope,
      severity: "behavior-changed",
      subject: `additional_config.${sKey}`,
      title: shadowedByNested
        ? `顶层调度键 ${sKey} 被嵌套 scheduler_config.${sKey} 覆盖忽略`
        : `顶层旧调度键 ${sKey} 已收归 scheduler_config（触发弃用剥离）`,
      legacyBehavior:
        fromVersion === "v0.23.0"
          ? `v0.23.0 (${fromCommit}) 仅支持在 additional_config 顶层书写 "${sKey}"。`
          : `v0.26.0rc (${fromCommit}) 引入 scheduler_config，顶层 "${sKey}" 已标 deprecated（两处同写时以嵌套为准）。`,
      targetBehavior: shadowedByNested
        ? `${toVersion} (${toCommit}) SchedulerConfig.from_additional_config 优先采用 scheduler_config.${sKey}，顶层 "${sKey}" 打告警后直接忽略。`
        : `${toVersion} (${toCommit}) init_ascend_config 先从顶层剥离 "${sKey}" 并打印弃用告警，再转交 scheduler_config.${sKey} 构造。`,
      remediation: `将 "${sKey}" 迁入 --additional-config '{"scheduler_config":{"${sKey}":...}}' 并删掉顶层同名键。`,
      evidenceLevel: "C",
      sources: [schedLegacySrc, schedTargetSrc],
      wikiPageIds: LEGACY_SCHEDULER_WIKI_MAP[sKey] ?? ["ascend-config-system"],
    });
  }
}

function isExplicitFalseLike(val: unknown): boolean {
  if (val === false || val === 0) return true;
  if (typeof val === "string") {
    const lower = val.trim().toLowerCase();
    return lower === "false" || lower === "0";
  }
  return false;
}

function isEnvTruthyOneOrTrue(val: string | undefined): boolean {
  if (val === undefined) return false;
  const lower = val.trim().toLowerCase();
  return lower === "1" || lower === "true";
}

function evaluateParsedCommandItems(
  parsed: ParsedVllmServeCommand,
  scope: UpgradeRadarScope,
  fromVersion: UpgradeFromVersion,
  toVersion: UpgradeTargetVersion,
): UpgradeRadarItem[] {
  const out: UpgradeRadarItem[] = [];
  const fromCommit = UPGRADE_RADAR_COMMITS[fromVersion];
  const toCommit = UPGRADE_RADAR_COMMITS[toVersion];

  // 1. Additional-config breaking-error & top-level scheduler behavior-changed
  if (parsed.additionalConfig) {
    evaluateAdditionalConfigItems(parsed.additionalConfig, scope, fromVersion, toVersion, out);
  }

  // 2. Retired 0-read environment variables (silent-noop)
  const targetEnvSrc = getTargetEnvsSource(toVersion);
  for (const [envName, rawVal] of Object.entries(parsed.envVars)) {
    const spec = ALL_RETIRED_ENV_RADAR_SPECS[envName];
    if (!spec) continue;
    out.push({
      id: spec.id,
      scope,
      severity: "silent-noop",
      subject: envName,
      title: spec.title,
      legacyBehavior: spec.legacyByFrom[fromVersion],
      targetBehavior: spec.targetSummary(rawVal, toVersion),
      remediation: spec.remediation(rawVal, toVersion),
      evidenceLevel: "C",
      sources: [...spec.legacySourcesByFrom[fromVersion], targetEnvSrc],
      wikiPageIds: spec.wikiPageIds,
    });
  }

  // 3. FlashComm1 env=1 + JSON false precedence flip (behavior-changed)
  const envFc1 = parsed.envVars.VLLM_ASCEND_ENABLE_FLASHCOMM1;
  const hasJsonFc1 =
    parsed.additionalConfig !== null && Object.hasOwn(parsed.additionalConfig, "enable_flashcomm1");
  if (
    isEnvTruthyOneOrTrue(envFc1) &&
    hasJsonFc1 &&
    isExplicitFalseLike(parsed.additionalConfig?.enable_flashcomm1)
  ) {
    const legacyFc1Src =
      fromVersion === "v0.26.0rc"
        ? "vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L345-L359"
        : "vllm-ascend@2c59ff10:vllm_ascend/ascend_config.py#L353-L365";
    const targetFc1Src =
      toVersion === "main"
        ? "vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L845-L855"
        : "vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L745-L756";
    out.push({
      id: "radar-flashcomm1-precedence-inversion",
      scope,
      severity: "behavior-changed",
      subject: "VLLM_ASCEND_ENABLE_FLASHCOMM1 + additional_config.enable_flashcomm1=false",
      title: "FlashComm1 双入口优先级反转：JSON false 不再能盖掉环境变量 1",
      legacyBehavior: `${fromVersion} (${fromCommit}) _get_config_value 按「JSON 键出现即优先」裁决，显式写 "enable_flashcomm1": false 会覆盖 VLLM_ASCEND_ENABLE_FLASHCOMM1=${envFc1}，最终为关闭。`,
      targetBehavior: `${toVersion} (${toCommit}) derive_and_validate 将 JSON enable_flashcomm1 与环境变量做逻辑或 (or) 合并，环境开启时 JSON false 盖不掉它，最终反转为开启！`,
      remediation:
        "彻底取消环境变量（unset VLLM_ASCEND_ENABLE_FLASHCOMM1），统一仅用 --additional-config '{\"enable_flashcomm1\": false}' 控制。",
      evidenceLevel: "C",
      sources: [legacyFc1Src, targetFc1Src],
      wikiPageIds: ["ascend-config-system", "sequence-parallel"],
    });
  }

  // 3.5. v0.26.0rc -> v0.30.0 / main enable_shared_expert_dp default flip (behavior-changed)
  const isMoeOrEpTarget =
    parsed.inferredHints.isMoe !== false &&
    parsed.couplingInput.enableExpertParallel === true &&
    (parsed.couplingInput.tpSize ?? 1) > 1;
  const hasExplicitSharedExpertDp =
    parsed.additionalConfig !== null && Object.hasOwn(parsed.additionalConfig, "enable_shared_expert_dp");
  const jsonFc1Val =
    parsed.additionalConfig !== null && Object.hasOwn(parsed.additionalConfig, "enable_flashcomm1")
      ? parsed.additionalConfig.enable_flashcomm1
      : undefined;
  const flashcomm1EnabledInV026 =
    jsonFc1Val !== undefined
      ? !isExplicitFalseLike(jsonFc1Val) && Boolean(jsonFc1Val)
      : isEnvTruthyOneOrTrue(envFc1);
  if (
    fromVersion === "v0.26.0rc" &&
    isMoeOrEpTarget &&
    flashcomm1EnabledInV026 &&
    !hasExplicitSharedExpertDp
  ) {
    const targetSharedExpertDpSrc =
      toVersion === "main"
        ? "vllm-ascend@8d6180e2:vllm_ascend/ascend_config.py#L652-L737"
        : "vllm-ascend@c09d3e20:vllm_ascend/ascend_config.py#L562-L635";
    out.push({
      id: "radar-shared-expert-dp-default-flip",
      scope,
      severity: "behavior-changed",
      subject: "additional_config.enable_shared_expert_dp",
      title: "v0.26.0rc 省略 enable_shared_expert_dp 时默认跟随 FlashComm1 开启，升级后静默变为 False",
      legacyBehavior:
        "v0.26.0rc (2ed6cbba) ascend_config.py 在 MoE + EP + TP > 1 下，省略 enable_shared_expert_dp 时默认取 self.enable_flashcomm1（当前为 True），自动启用共享专家 DP。",
      targetBehavior: `${toVersion} (${toCommit}) AscendConfig 将 enable_shared_expert_dp 默认值改为 False（不再跟随 FlashComm1），升级后若未显式传入将静默关闭共享专家 DP。`,
      remediation:
        "若需延续 v0.26.0rc 开启共享专家 DP 的行为，请显式补齐 --additional-config '{\"enable_shared_expert_dp\": true}'（有意关闭可显式写 false 锁定）。",
      evidenceLevel: "C",
      sources: ["vllm-ascend@2ed6cbba:vllm_ascend/ascend_config.py#L83-L135", targetSharedExpertDpSrc],
      wikiPageIds: ["ascend-config-system", "sequence-parallel"],
    });
  }

  // 4. Legacy workaround --enforce-eager or cudagraph_mode="NONE" (legacy-counterproductive)
  const rawGraphMode = parsed.compilationConfig?.cudagraph_mode;
  const hasExplicitGraphNone =
    typeof rawGraphMode === "string" && rawGraphMode.trim().toUpperCase() === "NONE";
  if (parsed.enforceEager || hasExplicitGraphNone) {
    const triggerFlags = [
      ...(parsed.enforceEager ? ["--enforce-eager"] : []),
      ...(hasExplicitGraphNone ? ['compilation_config.cudagraph_mode="NONE"'] : []),
    ].join(" + ");
    const legacyGraphSrc =
      fromVersion === "v0.26.0rc"
        ? "vllm-ascend@2ed6cbba:vllm_ascend/compilation/acl_graph.py#L215-L235"
        : "vllm-ascend@2c59ff10:vllm_ascend/compilation/acl_graph.py#L28-L106";
    const targetGraphSrcs =
      toVersion === "main"
        ? [
            "vllm-ascend@8d6180e2:vllm_ascend/compilation/acl_graph.py#L66-L255",
            "vllm-ascend@8d6180e2:vllm_ascend/platform.py#L1518-L1558",
          ]
        : [
            "vllm-ascend@c09d3e20:vllm_ascend/compilation/acl_graph.py#L66-L250",
            "vllm-ascend@c09d3e20:vllm_ascend/platform.py#L1313-L1352",
          ];
    out.push({
      id: "radar-legacy-eager-disables-aclgraph",
      scope,
      severity: "legacy-counterproductive",
      subject: triggerFlags,
      title: "历史排障绕过开关关闭 ACLGraph 静态图回放，反噬 Decode 吞吐",
      legacyBehavior: `${fromVersion} (${fromCommit}) 时期常通过 ${triggerFlags} 临时绕过早期图捕获兼容问题。`,
      targetBehavior: `${toVersion} (${toCommit}) ACLGraph (FULL_DECODE_ONLY) 与 npugraph_ex 已成熟；保留 ${triggerFlags} 会强制退回逐算子 Host 下发并静默清零 enable_npugraph_ex，在小批 Decode 阶段显著拉高 TPOT、反噬吞吐。`,
      remediation:
        '移除 --enforce-eager 及 cudagraph_mode="NONE"，在 A2/A3/A5 上推荐改传 --compilation-config \'{"cudagraph_mode":"FULL_DECODE_ONLY"}\'（FA3 / KVPP / 310P 受限场景按需选 PIECEWISE）。',
      evidenceLevel: "C",
      sources: [legacyGraphSrc, ...targetGraphSrcs],
      wikiPageIds: ["acl-graph", "npugraph-ex"],
    });
  }

  return out;
}

interface RawShellToken {
  readonly value: string;
  readonly raw: string;
}

function quoteShellArg(arg: string): string {
  if (arg.length === 0) return "''";
  if (/^[A-Za-z0-9_./:=,@+-]+$/.test(arg)) return arg;
  if (/\$[A-Za-z_{]/.test(arg) && !/[`\r\n]|\$\(/.test(arg) && !/[;|&<>()]/.test(arg)) {
    return `"${arg.replace(/([\\"])/g, "\\$1")}"`;
  }
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

function tokenizeFirstServeCommand(rawText: string): {
  prefix: readonly string[];
  serveArgs: readonly RawShellToken[];
  rawEnvRhs: Readonly<Record<string, string>>;
} {
  const normalized = rawText.replace(/\r\n/g, "\n").replace(/\\[ \t]*\n/g, " ");
  const stmts: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i] ?? "";
    const next = normalized[i + 1] ?? "";
    if (quote === "'") {
      cur += ch;
      if (ch === "'") quote = null;
      continue;
    }
    if (quote === '"') {
      if (ch === "\\" && i + 1 < normalized.length) {
        cur += ch + next;
        i += 1;
        continue;
      }
      cur += ch;
      if (ch === '"') quote = null;
      continue;
    }
    if (ch === "\\" && i + 1 < normalized.length) {
      cur += ch + next;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === "#" && (cur.length === 0 || /\s/.test(cur[cur.length - 1] ?? ""))) {
      while (i < normalized.length && normalized[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "\n" || ch === ";") {
      if (cur.trim().length > 0) stmts.push(cur.trim());
      cur = "";
      continue;
    }
    if (ch === "&" && next === "&") {
      if (cur.trim().length > 0) stmts.push(cur.trim());
      cur = "";
      i += 1;
      continue;
    }
    cur += ch;
  }
  if (cur.trim().length > 0) stmts.push(cur.trim());

  const tokenizeOne = (stmt: string): RawShellToken[] => {
    const tokens: RawShellToken[] = [];
    let tok = "";
    let raw = "";
    let hasTok = false;
    let q: "'" | '"' | null = null;
    for (let i = 0; i < stmt.length; i += 1) {
      const ch = stmt[i] ?? "";
      const next = stmt[i + 1] ?? "";
      if (q === "'") {
        raw += ch;
        if (ch === "'") q = null;
        else tok += ch;
        continue;
      }
      if (q === '"') {
        if (ch === '"') {
          raw += ch;
          q = null;
        } else if (ch === "\\" && (next === '"' || next === "\\" || next === "$" || next === "`")) {
          raw += ch + next;
          tok += next;
          i += 1;
        } else {
          raw += ch;
          tok += ch;
        }
        continue;
      }
      if (/\s/.test(ch)) {
        if (hasTok) {
          tokens.push({ value: tok, raw });
          tok = "";
          raw = "";
          hasTok = false;
        }
        continue;
      }
      if (ch === "'" || ch === '"') {
        q = ch;
        raw += ch;
        hasTok = true;
        continue;
      }
      if (ch === "\\" && i + 1 < stmt.length) {
        raw += ch + next;
        tok += next;
        hasTok = true;
        i += 1;
        continue;
      }
      raw += ch;
      tok += ch;
      hasTok = true;
    }
    if (hasTok) tokens.push({ value: tok, raw });
    while (tokens.length > 0 && tokens[tokens.length - 1]?.value === "&") tokens.pop();
    return tokens;
  };

  let prefix: string[] = ["vllm", "serve"];
  let serveArgs: RawShellToken[] = [];
  const rawEnvRhs: Record<string, string> = {};
  const recordRawEnv = (tok: RawShellToken) => {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(tok.value);
    if (!m) return;
    const eqPos = tok.raw.indexOf("=");
    if (eqPos > 0) {
      rawEnvRhs[m[1]!] = tok.raw.slice(eqPos + 1);
    }
  };
  for (const stmt of stmts) {
    const tokens = tokenizeOne(stmt);
    if (tokens.length === 0) continue;
    if (tokens[0]?.value === "export") {
      for (let k = 1; k < tokens.length; k += 1) {
        recordRawEnv(tokens[k]!);
      }
      continue;
    }
    let idx = 0;
    while (idx < tokens.length) {
      const entry = tokens[idx]!;
      const t = entry.value;
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t)) {
        recordRawEnv(entry);
        idx += 1;
        continue;
      }
      if (t === "nohup" || t === "env" || t === "setsid") {
        idx += 1;
        continue;
      }
      break;
    }
    const rest = tokens.slice(idx);
    const h = rest[0]?.value ?? "";
    const s = rest[1]?.value ?? "";
    if (h === "vllm" && s === "serve") {
      prefix = ["vllm", "serve"];
      serveArgs = rest.slice(2);
    } else if (
      (h === "python" || h === "python3") &&
      s === "-m" &&
      (rest[2]?.value === "vllm.entrypoints.openai.api_server" ||
        rest[2]?.value === "vllm.entrypoints.cli.main")
    ) {
      if (rest[2]?.value === "vllm.entrypoints.cli.main" && rest[3]?.value === "serve") {
        prefix = [h, "-m", rest[2].value, "serve"];
        serveArgs = rest.slice(4);
      } else {
        prefix = [h, "-m", rest[2]!.value];
        serveArgs = rest.slice(3);
      }
    } else if (h.startsWith("-")) {
      prefix = ["vllm", "serve"];
      serveArgs = rest;
    }
  }
  return { prefix, serveArgs, rawEnvRhs };
}

function cleanNestedObjectKeys(
  obj: Record<string, unknown>,
  validKeys: ReadonlySet<string>,
  nestedValidators?: Readonly<Record<string, ReadonlySet<string>>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!validKeys.has(k)) continue;
    if (nestedValidators?.[k] && isPlainObject(v)) {
      const cleanedChild = cleanNestedObjectKeys(v, nestedValidators[k]!);
      if (Object.keys(cleanedChild).length > 0) out[k] = cleanedChild;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function buildRecommendedCommand(
  parsed: ParsedVllmServeCommand,
  items: readonly UpgradeRadarItem[],
  toVersion: UpgradeTargetVersion,
): string {
  const itemIds = new Set(items.map((i) => i.id));
  const nextEnvLines: string[] = [];
  const removeEnvFc1 = itemIds.has("radar-flashcomm1-precedence-inversion");
  const { rawEnvRhs } = tokenizeFirstServeCommand(parsed.rawText);

  const nextAdditional: Record<string, unknown> = parsed.additionalConfig
    ? (JSON.parse(JSON.stringify(parsed.additionalConfig)) as Record<string, unknown>)
    : {};

  const ensureSubDict = (parent: Record<string, unknown>, key: string): Record<string, unknown> => {
    const existing = parent[key];
    if (isPlainObject(existing)) return existing;
    const created: Record<string, unknown> = {};
    parent[key] = created;
    return created;
  };

  for (const [envName, rawVal] of Object.entries(parsed.envVars)) {
    if (envName === "VLLM_ASCEND_ENABLE_FLASHCOMM1" && removeEnvFc1) continue;
    if (ALL_RETIRED_ENV_RADAR_SPECS[envName]) {
      if (envName === "VLLM_ASCEND_ENABLE_NZ" && !Object.hasOwn(nextAdditional, "weight_nz_mode")) {
        const n = Number.parseInt(rawVal.trim(), 10);
        nextAdditional.weight_nz_mode = n === 0 || n === 1 || n === 2 ? n : 0;
      } else if (envName === "VLLM_ASCEND_ENABLE_MLAPO" && !Object.hasOwn(nextAdditional, "enable_mlapo")) {
        nextAdditional.enable_mlapo = parseBoolEnvFlag(rawVal, true);
      } else if (
        envName === "VLLM_ASCEND_ENABLE_FUSED_MC2" &&
        !Object.hasOwn(nextAdditional, "enable_fused_mc2")
      ) {
        const n = Number.parseInt(rawVal.trim(), 10);
        const maxAllowed = toVersion === "main" ? 3 : 2;
        nextAdditional.enable_fused_mc2 = Number.isInteger(n) && n >= 0 && n <= maxAllowed ? n : 1;
      } else if (
        envName === "MSMONITOR_USE_DAEMON" &&
        !Object.hasOwn(nextAdditional, "msmonitor_use_daemon")
      ) {
        nextAdditional.msmonitor_use_daemon = parseBoolEnvFlag(rawVal, true);
      } else if (envName === "VLLM_ASCEND_BALANCE_SCHEDULING") {
        const sched = ensureSubDict(nextAdditional, "scheduler_config");
        if (!Object.hasOwn(sched, "enable_balance_scheduling")) {
          sched.enable_balance_scheduling = parseBoolEnvFlag(rawVal, true);
        }
      } else if (
        envName === "VLLM_ASCEND_FUSION_OP_TRANSPOSE_KV_CACHE_BY_BLOCK" &&
        !Object.hasOwn(nextAdditional, "enable_transpose_kv_cache_by_block")
      ) {
        nextAdditional.enable_transpose_kv_cache_by_block = parseBoolEnvFlag(rawVal, true);
      }
      continue;
    }
    nextEnvLines.push(`export ${envName}=${rawEnvRhs[envName] ?? quoteShellArg(rawVal)}`);
  }

  // Migrate enable_sleep_mode_extra_cleanup -> rl_config.sleep_mode_extra_cleanup
  if (Object.hasOwn(nextAdditional, "enable_sleep_mode_extra_cleanup")) {
    const val = nextAdditional.enable_sleep_mode_extra_cleanup;
    const rl = ensureSubDict(nextAdditional, "rl_config");
    if (!Object.hasOwn(rl, "sleep_mode_extra_cleanup")) {
      rl.sleep_mode_extra_cleanup = typeof val === "boolean" ? val : Boolean(val);
    }
    delete nextAdditional.enable_sleep_mode_extra_cleanup;
  }

  // Migrate legacy top-level scheduler keys into scheduler_config
  const legacySchedKeys =
    toVersion === "v0.30.0"
      ? [
          "enable_balance_scheduling",
          "recompute_scheduler_enable",
          "short_request_first_config",
          "profiling_chunk_config",
          "batch_job_sched_config",
        ]
      : [
          "enable_balance_scheduling",
          "recompute_scheduler_enable",
          "short_request_first_config",
          "batch_job_sched_config",
        ];
  for (const sKey of legacySchedKeys) {
    if (!Object.hasOwn(nextAdditional, sKey)) continue;
    const sched = ensureSubDict(nextAdditional, "scheduler_config");
    if (!Object.hasOwn(sched, sKey)) {
      sched[sKey] = nextAdditional[sKey];
    }
    delete nextAdditional[sKey];
  }

  // Strip removed & unknown top-level keys
  const validTopLevel = VALID_TOP_LEVEL_KEYS_BY_TARGET[toVersion];
  for (const k of Object.keys(nextAdditional)) {
    const knownRemoved = ALL_KNOWN_REMOVED_TOP_LEVEL_KEYS[k];
    if (knownRemoved?.targets.includes(toVersion) || !validTopLevel.has(k)) {
      delete nextAdditional[k];
    }
  }

  // Clean unknown nested sub-config keys
  const nestedSchemaMap: Record<
    string,
    { validKeys: ReadonlySet<string>; childValidators?: Readonly<Record<string, ReadonlySet<string>>> }
  > = {
    ascend_compilation_config: { validKeys: VALID_ASCEND_COMPILATION_KEYS },
    ascend_fusion_config: { validKeys: VALID_ASCEND_FUSION_KEYS },
    ascend_warmup_config: { validKeys: VALID_ASCEND_WARMUP_KEYS },
    eplb_config: { validKeys: VALID_EPLB_KEYS, childValidators: { stair_config: VALID_STAIR_KEYS } },
    rejection_sampler_config: { validKeys: VALID_REJECTION_SAMPLER_KEYS },
    rl_config: { validKeys: VALID_RL_KEYS },
    xlite_graph_config: { validKeys: VALID_XLITE_GRAPH_KEYS },
    finegrained_tp_config: { validKeys: VALID_FINEGRAINED_TP_KEYS_BY_TARGET[toVersion] },
    sparse_kv_offload_config: { validKeys: VALID_SPARSE_KV_OFFLOAD_KEYS_BY_TARGET[toVersion] },
    scheduler_config: {
      validKeys: VALID_SCHEDULER_KEYS_BY_TARGET[toVersion],
      childValidators: {
        short_request_first_config: VALID_SHORT_REQUEST_FIRST_KEYS,
        batch_job_sched_config: VALID_BATCH_JOB_SCHED_KEYS,
        dyntra_lb_config: VALID_DYNTRA_LB_KEYS,
        ...(toVersion === "v0.30.0" ? { profiling_chunk_config: VALID_PROFILING_CHUNK_KEYS } : {}),
      },
    },
    kvpp_config: { validKeys: VALID_KVPP_KEYS },
    ...(toVersion === "v0.30.0" ? { dynamic_spec_config: { validKeys: VALID_DYNAMIC_SPEC_KEYS } } : {}),
    ...(toVersion === "main"
      ? {
          quantized_all_reduce_config: { validKeys: VALID_QUANTIZED_ALL_REDUCE_KEYS },
          shared_engram: { validKeys: VALID_SHARED_ENGRAM_KEYS },
          kv_trace: { validKeys: VALID_KV_TRACE_KEYS },
        }
      : {}),
  };
  for (const [subKey, schema] of Object.entries(nestedSchemaMap)) {
    const rawSub = nextAdditional[subKey];
    if (!isPlainObject(rawSub)) continue;
    const cleaned = cleanNestedObjectKeys(rawSub, schema.validKeys, schema.childValidators);
    if (Object.keys(cleaned).length === 0) {
      delete nextAdditional[subKey];
    } else {
      nextAdditional[subKey] = cleaned;
    }
  }

  // Backfill enable_shared_expert_dp when v0.26.0rc default flip triggered
  if (itemIds.has("radar-shared-expert-dp-default-flip")) {
    nextAdditional.enable_shared_expert_dp = true;
  }

  // Rewrite compilation_config when --enforce-eager or cudagraph_mode="NONE" triggered
  const hasEagerBypass = itemIds.has("radar-legacy-eager-disables-aclgraph");
  const nextCompilation: Record<string, unknown> | null = parsed.compilationConfig
    ? (JSON.parse(JSON.stringify(parsed.compilationConfig)) as Record<string, unknown>)
    : hasEagerBypass
      ? {}
      : null;
  if (hasEagerBypass && nextCompilation) {
    nextCompilation.cudagraph_mode = "FULL_DECODE_ONLY";
  }

  // Reconstruct CLI tokens preserving existing flags and original quoting on untouched arguments
  const { prefix, serveArgs } = tokenizeFirstServeCommand(parsed.rawText);
  const mkSynthToken = (v: string): RawShellToken => ({ value: v, raw: quoteShellArg(v) });
  const rewrittenArgs: RawShellToken[] = [];
  let sawAdditionalFlag = false;
  let sawCompilationFlag = false;
  const hasNextAdditional = Object.keys(nextAdditional).length > 0;
  const hasNextCompilation = nextCompilation !== null && Object.keys(nextCompilation).length > 0;

  for (let i = 0; i < serveArgs.length; i += 1) {
    const entry = serveArgs[i]!;
    const tok = entry.value;
    const eqIdx = tok.indexOf("=");
    const rawFlag = tok.startsWith("-") && eqIdx > 0 ? tok.slice(0, eqIdx) : tok;
    const normFlag = rawFlag.startsWith("--") ? `--${rawFlag.slice(2).replace(/_/g, "-")}` : rawFlag;

    if (hasEagerBypass && normFlag === "--enforce-eager") {
      continue;
    }
    if (normFlag === "--additional-config") {
      if (eqIdx < 0 && i + 1 < serveArgs.length) i += 1;
      sawAdditionalFlag = true;
      if (hasNextAdditional) {
        rewrittenArgs.push(mkSynthToken("--additional-config"), mkSynthToken(JSON.stringify(nextAdditional)));
      }
      continue;
    }
    if (normFlag === "--compilation-config" || normFlag === "-cc") {
      if (eqIdx < 0 && i + 1 < serveArgs.length) i += 1;
      sawCompilationFlag = true;
      if (hasNextCompilation) {
        rewrittenArgs.push(
          mkSynthToken("--compilation-config"),
          mkSynthToken(JSON.stringify(nextCompilation)),
        );
      }
      continue;
    }
    rewrittenArgs.push(entry);
  }

  if (!sawCompilationFlag && hasNextCompilation) {
    rewrittenArgs.push(mkSynthToken("--compilation-config"), mkSynthToken(JSON.stringify(nextCompilation)));
  }
  if (!sawAdditionalFlag && hasNextAdditional) {
    rewrittenArgs.push(mkSynthToken("--additional-config"), mkSynthToken(JSON.stringify(nextAdditional)));
  }

  // Group --flag value pairs onto readable continuation lines when there are multiple flags
  const segments: string[] = [];
  const headParts = [...prefix];
  let idx = 0;
  if (rewrittenArgs[0] && !rewrittenArgs[0].value.startsWith("-")) {
    headParts.push(rewrittenArgs[0].raw);
    idx = 1;
  }
  segments.push(headParts.join(" "));
  while (idx < rewrittenArgs.length) {
    const curTok = rewrittenArgs[idx]!;
    const nextTok = rewrittenArgs[idx + 1];
    if (
      curTok.value.startsWith("-") &&
      !curTok.value.includes("=") &&
      nextTok !== undefined &&
      !nextTok.value.startsWith("-")
    ) {
      segments.push(`  ${curTok.raw} ${nextTok.raw}`);
      idx += 2;
    } else {
      segments.push(`  ${curTok.raw}`);
      idx += 1;
    }
  }

  const serveCmd = segments.length > 2 ? segments.join(" \\\n") : segments.map((s) => s.trim()).join(" ");
  return [...nextEnvLines, serveCmd].join("\n");
}

const SEVERITY_ORDER: Readonly<Record<UpgradeImpactSeverity, number>> = {
  "breaking-error": 0,
  "silent-noop": 1,
  "behavior-changed": 2,
  "legacy-counterproductive": 3,
};

function finalizeRadarReport(
  topology: "single" | "pd",
  fromVersion: UpgradeFromVersion,
  toVersion: UpgradeTargetVersion,
  rawItems: readonly UpgradeRadarItem[],
  recommendedCommands?: {
    recommendedSingleCommand?: string;
    recommendedPdCommands?: UpgradeRadarPdRecommendedCommands;
  },
): UpgradeRadarReport {
  const items = [...rawItems].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const counts: UpgradeRadarCounts = {
    total: items.length,
    breakingError: items.filter((i) => i.severity === "breaking-error").length,
    silentNoop: items.filter((i) => i.severity === "silent-noop").length,
    behaviorChanged: items.filter((i) => i.severity === "behavior-changed").length,
    legacyCounterproductive: items.filter((i) => i.severity === "legacy-counterproductive").length,
  };
  const wikiSet = new Set<string>();
  for (const item of items) {
    for (const pid of item.wikiPageIds) wikiSet.add(pid);
  }
  return {
    topology,
    fromVersion,
    toVersion,
    fromCommit: UPGRADE_RADAR_COMMITS[fromVersion],
    toCommit: UPGRADE_RADAR_COMMITS[toVersion],
    items,
    counts,
    hasBreakingErrors: counts.breakingError > 0,
    relatedWikiIds: [...wikiSet],
    honestBoundaryNote: UPGRADE_RADAR_HONEST_BOUNDARY_NOTE,
    ...(recommendedCommands?.recommendedSingleCommand !== undefined
      ? { recommendedSingleCommand: recommendedCommands.recommendedSingleCommand }
      : {}),
    ...(recommendedCommands?.recommendedPdCommands !== undefined
      ? { recommendedPdCommands: recommendedCommands.recommendedPdCommands }
      : {}),
  };
}

export function analyzeSingleUpgradeRadar(
  commandOrParsed: string | ParsedVllmServeCommand,
  opts: {
    fromVersion: UpgradeFromVersion;
    toVersion: UpgradeTargetVersion;
    scope?: UpgradeRadarScope | undefined;
  },
): UpgradeRadarReport {
  const parsed =
    typeof commandOrParsed === "string" ? parseVllmServeCommand(commandOrParsed) : commandOrParsed;
  const items = evaluateParsedCommandItems(parsed, opts.scope ?? "single", opts.fromVersion, opts.toVersion);
  const recommendedSingleCommand =
    items.length > 0 ? buildRecommendedCommand(parsed, items, opts.toVersion) : undefined;
  return finalizeRadarReport(
    "single",
    opts.fromVersion,
    opts.toVersion,
    items,
    recommendedSingleCommand !== undefined ? { recommendedSingleCommand } : undefined,
  );
}

export function analyzePdUpgradeRadar(
  prefillCommandOrParsed: string | ParsedVllmServeCommand,
  decodeCommandOrParsed: string | ParsedVllmServeCommand,
  opts: {
    fromVersion: UpgradeFromVersion;
    toVersion: UpgradeTargetVersion;
  },
): UpgradeRadarReport {
  const prefillParsed =
    typeof prefillCommandOrParsed === "string"
      ? parseVllmServeCommand(prefillCommandOrParsed)
      : prefillCommandOrParsed;
  const decodeParsed =
    typeof decodeCommandOrParsed === "string"
      ? parseVllmServeCommand(decodeCommandOrParsed)
      : decodeCommandOrParsed;
  const prefillItems = evaluateParsedCommandItems(prefillParsed, "prefill", opts.fromVersion, opts.toVersion);
  const decodeItems = evaluateParsedCommandItems(decodeParsed, "decode", opts.fromVersion, opts.toVersion);
  const allItems = [...prefillItems, ...decodeItems];
  const recommendedPdCommands =
    allItems.length > 0
      ? {
          prefillCommand: buildRecommendedCommand(prefillParsed, prefillItems, opts.toVersion),
          decodeCommand: buildRecommendedCommand(decodeParsed, decodeItems, opts.toVersion),
        }
      : undefined;
  return finalizeRadarReport(
    "pd",
    opts.fromVersion,
    opts.toVersion,
    allItems,
    recommendedPdCommands !== undefined ? { recommendedPdCommands } : undefined,
  );
}
