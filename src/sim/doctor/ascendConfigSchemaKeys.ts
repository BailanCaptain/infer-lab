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
