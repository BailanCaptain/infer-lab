import type { RuleVersion } from "../rules/types";

export type UpgradeTargetVersion = Extract<RuleVersion, "v0.30.0" | "main">;

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

export const V030_ONLY_TOP_LEVEL_KEYS: readonly string[] = [
  "dynamic_spec_config",
  "profiling_chunk_config",
  "enable_dsa_cp",
  "draft_window_size",
];

export const MAIN_ONLY_TOP_LEVEL_KEYS: readonly string[] = [
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
export const VALID_QUANTIZED_ALL_REDUCE_KEYS: ReadonlySet<string> = new Set(["enable", "min_numel"]);
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

export type AscendFieldPrimitiveSpec =
  | "bool"
  | "strictBool"
  | "optBool"
  | "int"
  | "optInt"
  | "float"
  | "str"
  | "optStr"
  | "list"
  | "dict"
  | "optDict"
  | { readonly intEnum: readonly number[] }
  | { readonly optStrEnum: readonly string[] }
  | readonly (string | number)[];

/**
 * Complete AST-derived scalar/collection field type specifications for AscendConfig
 * and all @config sub-configs across pinned v0.30.0 (c09d3e20) and main (8d6180e2).
 * Pure-derived / factory-discarded _NON_USER_INPUT_KEYS (pd_tp_ratio, pd_head_ratio,
 * num_head_replica, enable_sp_by_pass, enable_sparse_li_c4, enable_sparse_sfa_turboquant,
 * kvpp_config, gdn_prefill_backend, kda_prefill_backend) and SchedulerConfig-resolved
 * legacy keys (enable_balance_scheduling, recompute_scheduler_enable) are omitted here
 * so factory-discarded values never trigger false blockers.
 */
export const ASCEND_TOP_LEVEL_FIELD_TYPES: Readonly<Record<string, AscendFieldPrimitiveSpec>> = {
  refresh: "bool",
  enable_cpu_binding: "bool",
  multistream_dsv4_dsa_overlap: "bool",
  multistream_engram_overlap: "bool",
  enable_prefill_mc2: "bool",
  multistream_overlap_shared_expert: "bool",
  enable_kv_nz: "bool",
  enable_mc2_hierarchy_comm: "bool",
  enable_dsa_cp: "bool",
  sfa_dcp_force_tmajor_restore: "bool",
  enable_force_eplb: "bool",
  enable_pcp_o_proj_weight_sharding: "bool",
  enable_pcp_embedding_lmhead_weight_sharding: "bool",
  draft_window_size: "optInt",
  mix_placement: "bool",
  combine_quant_mode: [0, 2, 3, 4],
  pa_shape_list: "list",
  mega_moe_max_tokens: "int",
  ascend_log_path: "str",
  dump_config_path: "optStr",
  dump_config: "optDict",
  mc2_comm_alg: ["", "fullmesh", "hierarchy", "fullmesh_v2"],
  enable_fused_mc2: "int",
  enable_mlapo: "bool",
  mlapo_keep_prefill_weights: "bool",
  msmonitor_use_daemon: "bool",
  enable_transpose_kv_cache_by_block: "bool",
  weight_nz_mode: { intEnum: [0, 1, 2] },
  enable_shared_expert_dp: "bool",
  enable_sparse_sfa_c8: "bool",
  enable_sparse_li_c8: "bool",
  enable_flashcomm1: "bool",
  enable_kvpp: "bool",
  kv_pool_range_debug: "bool",
  megamoe_shared_expert_fusion: "bool",
  gdn_internal_prefill_checkpoints: "bool",
  runtime_report_dir: "optStr",
  runtime_dump_dir: "optStr",
};

export const ASCEND_SUBCONFIG_FIELD_TYPES: Readonly<
  Record<string, Readonly<Record<string, AscendFieldPrimitiveSpec>>>
> = {
  ascend_compilation_config: {
    enable_npugraph_ex: "bool",
    enable_static_kernel: "bool",
    enable_super_kernel: "bool",
    fuse_norm_quant: "bool",
    fuse_qknorm_rope: "bool",
    fuse_muls_add: "bool",
  },
  ascend_fusion_config: {
    fusion_ops_gmmswigluquant: "bool",
  },
  ascend_warmup_config: {
    enable_early_kernel_warmup: "bool",
    enable_early_nz_warmup: "bool",
  },
  eplb_config: {
    dynamic_eplb: "bool",
    expert_map_path: "optStr",
    expert_heat_collection_interval: "int",
    algorithm_execution_interval: "int",
    expert_map_record_path: "optStr",
    num_redundant_experts: "int",
    eplb_policy_type: { intEnum: [0, 1, 2, 3] },
    eplb_heat_collection_stage: ["all", "prefill", "decode"],
    load_collection_phase: ["all", "prefill", "decode"],
  },
  stair_config: {
    load_window_bins: "int",
    load_risk_quantile: "float",
    relative_balance_threshold: "float",
    absolute_balance_threshold: "float",
    rank_transfer_limit: "int",
    cross_node_transfer_limit: "int",
    replica_search_num_stages: "int",
    replica_search_radius: "int",
    replica_search_beam_size: "int",
    placement_search_backtrack_limit: "int",
  },
  rejection_sampler_config: {
    enable_block_verify: "bool",
    enable_entropy_verify: "bool",
    posterior_threshold: "float",
    posterior_alpha: "float",
  },
  rl_config: {
    enabled: "bool",
    sleep_mode_extra_cleanup: "bool",
    enable_training_consistency: "bool",
    enable_batch_invariant: "bool",
  },
  xlite_graph_config: {
    enabled: "bool",
    full_mode: "bool",
  },
  finegrained_tp_config: {
    oproj_tensor_parallel_size: "int",
    lmhead_tensor_parallel_size: "int",
    embedding_tensor_parallel_size: "int",
    mlp_tensor_parallel_size: "int",
    qkv_iproj_tensor_parallel_size: "int",
  },
  dynamic_spec_config: {
    method: { optStrEnum: ["dspark", "dflash"] },
    method_params: "dict",
  },
  kv_trace: {
    enabled: "strictBool",
    action: ["log", "raise"],
  },
  sparse_kv_offload_config: {
    enabled: "bool",
    topk_buffer_size: "int",
    dram_size_per_dp_GB: "int",
    keep_device_kv_cache: "bool",
    use_fused_overlap: "bool",
    store_port_base: "int",
  },
  profiling_chunk_config: {
    enabled: "bool",
    smooth_factor: "float",
    min_chunk: "int",
    need_timing: "optBool",
    max_fit_chunk: "int",
  },
  batch_job_sched_config: {
    enabled: "bool",
    max_jobs: "int",
    reserve_margin_blocks: "int",
    reserve_max_blocks: "int",
    low_available_tokens_threshold: "int",
    short_decode_token_threshold: "int",
  },
  short_request_first_config: {
    enabled: "bool",
    threshold: "int",
    long_max_wait_ms: "float",
  },
  dyntra_lb_config: {
    enabled: "bool",
    enable_diagnostics: "bool",
    mode: ["static", "dynamic"],
    start_step: "int",
    end_step: "int",
    bubble_threshold: "float",
    long_req_block_threshold: "int",
    dynamic_max_step: "int",
  },
  scheduler_config: {
    enable_balance_scheduling: "bool",
    recompute_scheduler_enable: "bool",
  },
};
