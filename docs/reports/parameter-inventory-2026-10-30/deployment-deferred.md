# 非基线定义与升级记录

这些是原表中没有 GLM/vLLM v0.23 定义的记录，不等于每个同名参数在基线不存在。已能定位同义基线单元的记录直接回链该单元；旧式构造遗漏的 npugraph_ex/static kernel 则引用已有基线页面。

| 原 ID | 项目 / 身份 | 记录版本 | 处理 |
|---|---|---|---|
| P0011 | vllm / `MooncakeECConfig.buffer_device` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0012 | vllm / `MooncakeECConfig.control_addr` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0013 | vllm / `MooncakeECConfig.control_host` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0014 | vllm / `MooncakeECConfig.control_port` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0015 | vllm / `MooncakeECConfig.control_timeout_ms` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0016 | vllm / `MooncakeECConfig.is_consumer` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0017 | vllm / `MooncakeECConfig.is_producer` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0018 | vllm / `MooncakeECConfig.pool_size` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0019 | vllm / `MooncakeECConfig.protocol` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0020 | vllm / `MooncakeECConfig.push_wait_timeout_s` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0029 | vllm / `MooncakeStoreConfig.tenant_id` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0514 | vllm / `ChatParams.response_format` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0515 | vllm / `ChatParams.return_assistant_tokens_mask` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0516 | vllm / `ChatParams.tool_choice` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0525 | vllm / `TokenizeParams.return_token_offsets` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0696 | vllm / `ObjStoreConfig.region` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0699 | vllm / `ObjStoreConfig.session_token` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0759 | vllm / `cli.--dcp-q-replicate` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0762 | vllm / `cli.--device-ids` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0763 | vllm / `cli.--diffusion-config` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0774 | vllm / `cli.--dp-sync-interval` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0776 | vllm / `cli.--ec-manager-config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0778 | vllm / `cli.--enable-batch-sharded-sampling` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0779 | vllm / `cli.--enable-bf16x3-router-gemm` | v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0787 | vllm / `cli.--enable-fault-tolerance` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0794 | vllm / `cli.--enable-mamba-fine-grained-prefix-cache` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0798 | vllm / `cli.--enable-moe-shared-loras` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0799 | vllm / `cli.--enable-nccl-comm-suspend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0805 | vllm / `cli.--enable-trace-replay` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0807 | vllm / `cli.--engram-config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0811 | vllm / `cli.--fault-tolerance-config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0823 | vllm / `cli.--jit-monitor-mode` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0824 | vllm / `cli.--jit-monitor-verbose` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0825 | vllm / `cli.--kda-decode-backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0826 | vllm / `cli.--kda-prefill-backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0853 | vllm / `cli.--mamba-ssu-algorithm` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0865 | vllm / `cli.--max-num-queued-reqs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0866 | vllm / `cli.--max-num-queued-tokens` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0867 | vllm / `cli.--max-num-scheduled-tokens` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0871 | vllm / `cli.--mm-device-do-normalize` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0879 | vllm / `cli.--mm-hasher-algorithm` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0880 | vllm / `cli.--mm-ipc-gpu-memory-gb` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0883 | vllm / `cli.--mm-processor-device` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0888 | vllm / `cli.--model-class-overrides` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0907 | vllm / `cli.--per-request-spec-decode-metrics` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0912 | vllm / `cli.--prefill-schedule-interval` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0913 | vllm / `cli.--prefix-cache-retention-interval` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0915 | vllm / `cli.--prefix-match-unit` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0925 | vllm / `cli.--replayssm-buffer-len` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0926 | vllm / `cli.--return-sampling-mask` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0955 | vllm / `cli.--use-replayssm` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0957 | vllm / `cli.--video-pruning-method` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0959 | vllm / `cli.--watermark` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0960 | vllm / `cli.--watermark-config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0978 | vllm / `cli.--stats` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0983 | vllm / `cli.--api-server-count` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0984 | vllm / `cli.--config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0985 | vllm / `cli.--grpc` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0986 | vllm / `cli.--headless` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P0998 | vllm / `cli.--weight-cache-socket-dir` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1010 | vllm / `cli.--bfcl-categories` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1109 | vllm / `cli.--probe-request-rate` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1185 | vllm / `cli.--custom-output-len` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1190 | vllm / `cli.--enable-multimodal-chat` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1200 | vllm / `cli.--no-oversample` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1212 | vllm / `self.kv_connector_extra_config.connectors` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1213 | vllm / `ec_config.ec_connector_extra_config.ec_cpu_bytes` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1215 | vllm / `kv_transfer_config.kv_connector_extra_config.device_name` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1220 | vllm / `extra_config.enable_lookup` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1221 | vllm / `extra_config.save_decode_cache` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1222 | vllm / `kvc_extra_config.enable_lookup` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1223 | vllm / `kvc_extra_config.load_async` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1224 | vllm / `kvc_extra_config.lookup_async` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1225 | vllm / `kvc_extra_config.save_decode_cache` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1227 | vllm / `extra_config.enable_cross_layers_blocks` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1228 | vllm / `extra_config.enable_group_semantics` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1229 | vllm / `extra_config.enable_lookup` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1230 | vllm / `extra_config.enable_store_tp_lcm` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1231 | vllm / `extra_config.load_async` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1232 | vllm / `extra_config.prefill_tp_sizes` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1233 | vllm / `extra_config.save_decode_cache` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1234 | vllm / `extra_config.store_tp_size` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1235 | vllm / `vllm_config.kv_transfer_config.kv_connector_extra_config.cache_prefix` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1239 | vllm / `extra_config.host_ip` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1242 | vllm / `extra_config.proxy_ip` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1243 | vllm / `extra_config.proxy_ping_port` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1252 | vllm / `extra_config.block_size` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1253 | vllm / `extra_config.blocks_per_chunk` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1254 | vllm / `extra_config.canonical_layout` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1256 | vllm / `extra_config.disk_buffer_slots` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1257 | vllm / `extra_config.disk_capacity_bytes` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1258 | vllm / `extra_config.disk_path` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1259 | vllm / `extra_config.kv_offload_backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1261 | vllm / `extra_config.use_page_cache` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1262 | vllm / `additional_config.kda_prefill_backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1265 | vllm / `self.extra_config[layer_name].bits` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1272 | vllm / `additional_config.kda_prefill_backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1273 | vllm / `additional_config.kda_decode_backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1274 | vllm / `additional_config.kda_prefill_backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1275 | vllm / `additional_config.kda_prefill_backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1276 | vllm / `extra_config.enable_cross_layers_blocks` | v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1279 | vllm / `self.extra_config.self_describing_kv_events` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1280 | vllm / `extra_config.store_threshold` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1281 | vllm / `self.extra_config.cache_policy_module_path` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1286 | vllm / `config.extra_config.spec_name` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1289 | vllm / `extra_config.secondary_tiers` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1329 | vllm / `EngineArgs.dcp_q_replicate` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1332 | vllm / `EngineArgs.device_ids` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1333 | vllm / `EngineArgs.diffusion_config` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1344 | vllm / `EngineArgs.dp_sync_interval` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1346 | vllm / `EngineArgs.ec_manager_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1348 | vllm / `EngineArgs.enable_batch_sharded_sampling` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1349 | vllm / `EngineArgs.enable_bf16x3_router_gemm` | v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1357 | vllm / `EngineArgs.enable_fault_tolerance` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1363 | vllm / `EngineArgs.enable_mamba_fine_grained_prefix_cache` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1368 | vllm / `EngineArgs.enable_moe_shared_loras` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1369 | vllm / `EngineArgs.enable_nccl_comm_suspend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1375 | vllm / `EngineArgs.enable_trace_replay` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1377 | vllm / `EngineArgs.engram_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1381 | vllm / `EngineArgs.fault_tolerance_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1393 | vllm / `EngineArgs.jit_monitor_mode` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1394 | vllm / `EngineArgs.jit_monitor_verbose` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1395 | vllm / `EngineArgs.kda_decode_backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1396 | vllm / `EngineArgs.kda_prefill_backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1424 | vllm / `EngineArgs.mamba_ssu_algorithm` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1436 | vllm / `EngineArgs.max_num_queued_reqs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1437 | vllm / `EngineArgs.max_num_queued_tokens` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1438 | vllm / `EngineArgs.max_num_scheduled_tokens` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1442 | vllm / `EngineArgs.mm_device_do_normalize` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1450 | vllm / `EngineArgs.mm_hasher_algorithm` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1451 | vllm / `EngineArgs.mm_ipc_gpu_memory_gb` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1454 | vllm / `EngineArgs.mm_processor_device` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1459 | vllm / `EngineArgs.model_class_overrides` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1479 | vllm / `EngineArgs.per_request_spec_decode_metrics` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1484 | vllm / `EngineArgs.prefill_schedule_interval` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1485 | vllm / `EngineArgs.prefix_cache_retention_interval` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1487 | vllm / `EngineArgs.prefix_match_unit` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1497 | vllm / `EngineArgs.replayssm_buffer_len` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1498 | vllm / `EngineArgs.return_sampling_mask` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1528 | vllm / `EngineArgs.use_replayssm` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1530 | vllm / `EngineArgs.video_pruning_method` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1532 | vllm / `EngineArgs.watermark` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1533 | vllm / `EngineArgs.watermark_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1538 | vllm / `AttentionConfig.backend_per_kind` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1546 | vllm / `AttentionConfig.indexer_kv_dtype` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1547 | vllm / `AttentionConfig.minimax_m3_msa_decode_backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1549 | vllm / `AttentionConfig.sparse_mla_force_mqa` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1559 | vllm / `CacheConfig.enable_mamba_fine_grained_prefix_cache` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1580 | vllm / `CacheConfig.prefix_cache_retention_interval` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1582 | vllm / `CacheConfig.prefix_match_unit` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1583 | vllm / `CacheConfig.replayssm_buffer_len` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1584 | vllm / `CacheConfig.skip_page_size_padded` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1587 | vllm / `CacheConfig.use_replayssm` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1640 | vllm / `PassConfig.fuse_qk_norm_rope_kvcache` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1647 | vllm / `DiffusionConfig.canvas_length` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1648 | vllm / `DiffusionConfig.max_denoising_steps` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1649 | vllm / `EncoderCacheManagerConfig.encoder_cache_manager_cls` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1650 | vllm / `EncoderCacheManagerConfig.manager_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1662 | vllm / `EngramConfig.cpu_offload` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1663 | vllm / `EngramConfig.embedding_across_dp` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1664 | vllm / `FaultToleranceConfig.engine_recovery_timeout_sec` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1667 | vllm / `KernelConfig.enable_bf16x3_router_gemm` | v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1668 | vllm / `KernelConfig.enable_cutedsl_warmup` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1670 | vllm / `KernelConfig.enable_jit_warmup` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1707 | vllm / `LoRAConfig.enable_moe_shared_loras` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1718 | vllm / `MambaConfig.ssu_algorithm` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1731 | vllm / `ModelConfig.enable_nccl_comm_suspend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1735 | vllm / `ModelConfig.enable_trace_replay` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1752 | vllm / `ModelConfig.mm_device_do_normalize` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1760 | vllm / `ModelConfig.mm_hasher_algorithm` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1761 | vllm / `ModelConfig.mm_ipc_gpu_memory_gb` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1764 | vllm / `ModelConfig.mm_processor_device` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1769 | vllm / `ModelConfig.model_class_overrides` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1779 | vllm / `ModelConfig.return_sampling_mask` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1786 | vllm / `ModelConfig.sleep_mode_backend` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1793 | vllm / `ModelConfig.video_pruning_method` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1813 | vllm / `MultiModalConfig.allow_missing_mm_embeddings` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1819 | vllm / `MultiModalConfig.mm_device_do_normalize` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1827 | vllm / `MultiModalConfig.mm_hasher_algorithm` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1828 | vllm / `MultiModalConfig.mm_ipc_gpu_memory_gb` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1835 | vllm / `MultiModalConfig.video_pruning_method` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1843 | vllm / `ObservabilityConfig.jit_monitor_mode` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1844 | vllm / `ObservabilityConfig.jit_monitor_verbose` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1848 | vllm / `ObservabilityConfig.per_request_spec_decode_metrics` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1868 | vllm / `ParallelConfig.assigned_physical_gpu_ids` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1886 | vllm / `ParallelConfig.dcp_q_replicate` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1892 | vllm / `ParallelConfig.dp_sync_interval` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1893 | vllm / `ParallelConfig.enable_batch_sharded_sampling` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1899 | vllm / `ParallelConfig.enable_fault_tolerance` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1902 | vllm / `ParallelConfig.fault_tolerance_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1937 | vllm / `ProfilerConfig.capture_torch_profiler` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1939 | vllm / `ProfilerConfig.detailed_trace_annotation` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1943 | vllm / `ProfilerConfig.proton_backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1944 | vllm / `ProfilerConfig.proton_context` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1945 | vllm / `ProfilerConfig.proton_data` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1946 | vllm / `ProfilerConfig.proton_hook` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1947 | vllm / `ProfilerConfig.proton_mode` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1948 | vllm / `ProfilerConfig.proton_output_format` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1949 | vllm / `ProfilerConfig.proton_profiler_dir` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1975 | vllm / `SchedulerConfig.max_num_queued_reqs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1976 | vllm / `SchedulerConfig.max_num_queued_tokens` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1980 | vllm / `SchedulerConfig.prefill_schedule_interval` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1985 | vllm / `SchedulerConfig.watermark` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1988 | vllm / `SpeculativeConfig.disable_eagle_block_drop` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1995 | vllm / `SpeculativeConfig.dspark_draft_topk` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1996 | vllm / `SpeculativeConfig.enable_adaptive_verification` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1998 | vllm / `SpeculativeConfig.index_share_for_mtp_iteration` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P1999 | vllm / `SpeculativeConfig.kv_cache_dtype` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2005 | vllm / `SpeculativeConfig.num_speculative_tokens_per_batch_size` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2021 | vllm / `SpeculativeConfig.use_heterogeneous_vocab` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2038 | vllm / `VllmConfig.diffusion_config` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2039 | vllm / `VllmConfig.ec_manager_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2041 | vllm / `VllmConfig.engram_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2062 | vllm / `VllmConfig.watermark_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2064 | vllm / `WatermarkConfig.algorithm` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2065 | vllm / `WatermarkConfig.context_width` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2066 | vllm / `WatermarkConfig.key` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2067 | vllm / `WatermarkConfig.prf` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2096 | vllm / `AnthropicTool.strict` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2114 | vllm / `FunctionDefinition.defer_loading` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2115 | vllm / `FunctionDefinition.description` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2116 | vllm / `FunctionDefinition.name` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2117 | vllm / `FunctionDefinition.parameters` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2118 | vllm / `FunctionDefinition.strict` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2119 | vllm / `LegacyStructuralTag.begin` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2120 | vllm / `LegacyStructuralTag.end` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2121 | vllm / `LegacyStructuralTag.structural_tag_schema` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2122 | vllm / `LogitsProcessorConstructor.args` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2123 | vllm / `LogitsProcessorConstructor.kwargs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2124 | vllm / `LogitsProcessorConstructor.qualname` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2140 | vllm / `StreamOptions.continuous_usage_stats` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2141 | vllm / `StreamOptions.include_usage` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2167 | vllm / `FunctionDefinition.strict` | v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2222 | vllm / `ChatRequestOptionsMixin.add_generation_prompt` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2223 | vllm / `ChatRequestOptionsMixin.add_special_tokens` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2224 | vllm / `ChatRequestOptionsMixin.chat_template` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2225 | vllm / `ChatRequestOptionsMixin.chat_template_kwargs` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2226 | vllm / `ChatRequestOptionsMixin.continue_final_message` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2227 | vllm / `ChatRequestOptionsMixin.media_io_kwargs` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2239 | vllm / `PoolingBasicRequestMixin.padding` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2279 | vllm / `MultiModalFeatures.kwargs_data` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2280 | vllm / `MultiModalFeatures.mm_hashes` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2281 | vllm / `MultiModalFeatures.mm_metadata` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2282 | vllm / `MultiModalFeatures.mm_placeholders` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2283 | vllm / `PlaceholderRangeInfo.length` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2284 | vllm / `PlaceholderRangeInfo.offset` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2362 | vllm / `AnthropicMessagesRequest.cache_salt` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2364 | vllm / `AnthropicMessagesRequest.ec_transfer_params` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2379 | vllm / `AnthropicMessagesRequest.vllm_xargs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2380 | vllm / `CohereChatV2Request.chat_template_kwargs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2381 | vllm / `CohereChatV2Request.citation_options` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2382 | vllm / `CohereChatV2Request.documents` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2383 | vllm / `CohereChatV2Request.frequency_penalty` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2384 | vllm / `CohereChatV2Request.k` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2385 | vllm / `CohereChatV2Request.kv_transfer_params` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2386 | vllm / `CohereChatV2Request.logprobs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2387 | vllm / `CohereChatV2Request.max_tokens` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2388 | vllm / `CohereChatV2Request.messages` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2389 | vllm / `CohereChatV2Request.model` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2390 | vllm / `CohereChatV2Request.p` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2391 | vllm / `CohereChatV2Request.presence_penalty` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2392 | vllm / `CohereChatV2Request.priority` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2393 | vllm / `CohereChatV2Request.response_format` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2394 | vllm / `CohereChatV2Request.safety_mode` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2395 | vllm / `CohereChatV2Request.seed` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2396 | vllm / `CohereChatV2Request.stop_sequences` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2397 | vllm / `CohereChatV2Request.stream` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2398 | vllm / `CohereChatV2Request.strict_tools` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2399 | vllm / `CohereChatV2Request.temperature` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2400 | vllm / `CohereChatV2Request.thinking` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2401 | vllm / `CohereChatV2Request.tool_choice` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2402 | vllm / `CohereChatV2Request.tools` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2412 | vllm / `BatchTranscriptionRequest.file` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2413 | vllm / `BatchTranscriptionRequest.file_url` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2414 | vllm / `BatchTranslationRequest.file` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2415 | vllm / `BatchTranslationRequest.file_url` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2418 | vllm / `BatchChatCompletionRequest.cache_salt` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2426 | vllm / `BatchChatCompletionRequest.include_reasoning` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2430 | vllm / `BatchChatCompletionRequest.logprob_token_ids` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2434 | vllm / `BatchChatCompletionRequest.media_io_kwargs` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2437 | vllm / `BatchChatCompletionRequest.mm_processor_kwargs` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2441 | vllm / `BatchChatCompletionRequest.priority` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2446 | vllm / `BatchChatCompletionRequest.return_tokens_as_token_ids` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2451 | vllm / `BatchChatCompletionRequest.tool_choice` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2466 | vllm / `ChatCompletionRequest.ec_transfer_params` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2475 | vllm / `ChatCompletionRequest.logprob_token_ids` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2495 | vllm / `ChatCompletionRequest.return_assistant_tokens_mask` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2498 | vllm / `ChatCompletionRequest.return_token_offsets` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2500 | vllm / `ChatCompletionRequest.routed_experts_prompt_start` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2502 | vllm / `ChatCompletionRequest.session_id` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2508 | vllm / `ChatCompletionRequest.stream_interval` | main | 请求级入口仅在 main 的本轮记录中存在；基线服务启动 --stream-interval 由独立单元保留。 |
| P2523 | vllm / `ChatCompletionRequest.watermarking` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2526 | vllm / `CompletionRequest.bad_words` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2528 | vllm / `CompletionRequest.ec_transfer_params` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2536 | vllm / `CompletionRequest.logprob_token_ids` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2553 | vllm / `CompletionRequest.return_token_offsets` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2555 | vllm / `CompletionRequest.routed_experts_prompt_start` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2557 | vllm / `CompletionRequest.session_id` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2563 | vllm / `CompletionRequest.stream_interval` | main | 请求级入口仅在 main 的本轮记录中存在；基线服务启动 --stream-interval 由独立单元保留。 |
| P2576 | vllm / `CompletionRequest.watermarking` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2580 | vllm / `ResponsesRequest.ec_transfer_params` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2585 | vllm / `ResponsesRequest.include_reasoning` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2609 | vllm / `ResponsesRequest.session_id` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2625 | vllm / `ResponsesRequest.watermarking` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2640 | vllm / `EmbeddingBatchChatInputRequest.input` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2641 | vllm / `EmbeddingBatchChatRequest.messages` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2642 | vllm / `EmbeddingChatInputRequest.input` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2658 | vllm / `DerenderChatRequest.chat_request` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2659 | vllm / `DerenderChatRequest.generate_response` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2660 | vllm / `DerenderChatRequest.model` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2661 | vllm / `DerenderChatRequest.prompt_tokens` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2662 | vllm / `DerenderChatRequest.stream` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2663 | vllm / `DerenderChatStreamRequest.chat_request` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2664 | vllm / `DerenderChatStreamRequest.generate_chunk` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2665 | vllm / `DerenderChatStreamRequest.model` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2666 | vllm / `DerenderChatStreamRequest.prompt_tokens` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2667 | vllm / `DerenderChatStreamRequest.stream` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2668 | vllm / `DerenderChatStreamRequest.stream_state` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2669 | vllm / `DerenderCompletionRequest.completion_request` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2670 | vllm / `DerenderCompletionRequest.generate_responses` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2671 | vllm / `DerenderCompletionRequest.model` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2672 | vllm / `DerenderCompletionRequest.prompt_tokens` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2673 | vllm / `DerenderCompletionRequest.stream` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2674 | vllm / `DerenderCompletionStreamRequest.completion_request` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2675 | vllm / `DerenderCompletionStreamRequest.generate_chunk` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2676 | vllm / `DerenderCompletionStreamRequest.model` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2677 | vllm / `DerenderCompletionStreamRequest.prompt_tokens` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2678 | vllm / `DerenderCompletionStreamRequest.stream` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2679 | vllm / `DerenderCompletionStreamRequest.stream_state` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2680 | vllm / `GenerateRequest.assistant_tokens_mask` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2681 | vllm / `GenerateRequest.cache_salt` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2682 | vllm / `GenerateRequest.content_parts` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2683 | vllm / `GenerateRequest.ec_transfer_params` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2684 | vllm / `GenerateRequest.features` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2685 | vllm / `GenerateRequest.kv_transfer_params` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2686 | vllm / `GenerateRequest.model` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2687 | vllm / `GenerateRequest.priority` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2688 | vllm / `GenerateRequest.request_id` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2689 | vllm / `GenerateRequest.sampling_params` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2690 | vllm / `GenerateRequest.stream` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2691 | vllm / `GenerateRequest.stream_options` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2692 | vllm / `GenerateRequest.token_ids` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2693 | vllm / `GenerateRequest.token_offsets` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2753 | vllm / `TranslationRequest.frequency_penalty` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2759 | vllm / `TranslationRequest.min_p` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2762 | vllm / `TranslationRequest.presence_penalty` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2764 | vllm / `TranslationRequest.repetition_penalty` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2772 | vllm / `TranslationRequest.top_k` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2773 | vllm / `TranslationRequest.top_p` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2775 | vllm / `TranslationRequest.vllm_xargs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2776 | vllm / `BaseFrontendArgs.chat_template` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2777 | vllm / `BaseFrontendArgs.chat_template_content_format` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2778 | vllm / `BaseFrontendArgs.cohere_format` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2779 | vllm / `BaseFrontendArgs.cohere_is_reasoning_model` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2780 | vllm / `BaseFrontendArgs.default_chat_template_kwargs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2781 | vllm / `BaseFrontendArgs.enable_auto_tool_choice` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2782 | vllm / `BaseFrontendArgs.enable_force_include_usage` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2783 | vllm / `BaseFrontendArgs.enable_log_deltas` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2784 | vllm / `BaseFrontendArgs.enable_log_outputs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2785 | vllm / `BaseFrontendArgs.enable_per_request_metrics` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2786 | vllm / `BaseFrontendArgs.enable_prompt_tokens_details` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2787 | vllm / `BaseFrontendArgs.enable_server_load_tracking` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2788 | vllm / `BaseFrontendArgs.enable_tokenizer_info_endpoint` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2789 | vllm / `BaseFrontendArgs.exclude_tools_when_tool_choice_none` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2790 | vllm / `BaseFrontendArgs.fingerprint_mode` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2791 | vllm / `BaseFrontendArgs.fingerprint_value` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2792 | vllm / `BaseFrontendArgs.log_config_file` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2793 | vllm / `BaseFrontendArgs.log_error_stack` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2794 | vllm / `BaseFrontendArgs.lora_modules` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2795 | vllm / `BaseFrontendArgs.max_log_len` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2796 | vllm / `BaseFrontendArgs.response_role` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2797 | vllm / `BaseFrontendArgs.return_tokens_as_token_ids` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2798 | vllm / `BaseFrontendArgs.sse_keep_alive_interval` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2799 | vllm / `BaseFrontendArgs.tokens_only` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2800 | vllm / `BaseFrontendArgs.tool_call_parser` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2801 | vllm / `BaseFrontendArgs.tool_parser_plugin` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2802 | vllm / `BaseFrontendArgs.tool_server` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2803 | vllm / `BaseFrontendArgs.trust_request_chat_template` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2804 | vllm / `FrontendArgs.allow_credentials` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2805 | vllm / `FrontendArgs.allowed_headers` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2806 | vllm / `FrontendArgs.allowed_methods` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2807 | vllm / `FrontendArgs.allowed_origins` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2808 | vllm / `FrontendArgs.api_key` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2809 | vllm / `FrontendArgs.data_parallel_supervisor_port` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2810 | vllm / `FrontendArgs.disable_access_log_for_endpoints` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2811 | vllm / `FrontendArgs.disable_fastapi_docs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2812 | vllm / `FrontendArgs.disable_uvicorn_access_log` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2813 | vllm / `FrontendArgs.dp_supervisor_probe_failure_threshold` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2814 | vllm / `FrontendArgs.dp_supervisor_probe_interval_s` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2815 | vllm / `FrontendArgs.dp_supervisor_probe_timeout_s` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2816 | vllm / `FrontendArgs.enable_flash_late_interaction` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2817 | vllm / `FrontendArgs.enable_offline_docs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2818 | vllm / `FrontendArgs.enable_request_id_headers` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2819 | vllm / `FrontendArgs.enable_ssl_refresh` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2820 | vllm / `FrontendArgs.h11_max_header_count` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2821 | vllm / `FrontendArgs.h11_max_incomplete_event_size` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2822 | vllm / `FrontendArgs.host` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2823 | vllm / `FrontendArgs.middleware` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2824 | vllm / `FrontendArgs.port` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2825 | vllm / `FrontendArgs.root_path` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2826 | vllm / `FrontendArgs.ssl_ca_certs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2827 | vllm / `FrontendArgs.ssl_cert_reqs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2828 | vllm / `FrontendArgs.ssl_certfile` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2829 | vllm / `FrontendArgs.ssl_ciphers` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2830 | vllm / `FrontendArgs.ssl_keyfile` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2831 | vllm / `FrontendArgs.uds` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2832 | vllm / `FrontendArgs.uvicorn_log_level` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2833 | vllm / `BatchFrontendArgs.enable_metrics` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2834 | vllm / `BatchFrontendArgs.host` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2835 | vllm / `BatchFrontendArgs.input_file` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2836 | vllm / `BatchFrontendArgs.output_file` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2837 | vllm / `BatchFrontendArgs.output_tmp_dir` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2838 | vllm / `BatchFrontendArgs.port` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2839 | vllm / `BatchFrontendArgs.url` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2847 | vllm / `BaseFrontendArgs.enable_per_request_metrics` | v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2917 | vllm / `env.VLLM_ADAPTIVE_VERIFICATION_PROFILE_CONTEXT_LEN` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2923 | vllm / `env.VLLM_ALLREDUCE_USE_FLASHINFER_PCIE_IPC` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2929 | vllm / `env.VLLM_B12X_MOE_FP4_FORCE_A16` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2932 | vllm / `env.VLLM_BUILD_COMMIT` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2933 | vllm / `env.VLLM_BUILD_PIPELINE` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2934 | vllm / `env.VLLM_BUILD_URL` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2942 | vllm / `env.VLLM_CPU_CI_ENV` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2952 | vllm / `env.VLLM_DCP_Q_REPLICATE` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2961 | vllm / `env.VLLM_DEEPEP_V2_ALLOW_HYBRID_MODE` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2962 | vllm / `env.VLLM_DEEPEP_V2_ALLOW_MULTIPLE_REDUCTION` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2963 | vllm / `env.VLLM_DEEPEP_V2_PREFER_OVERLAP` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2967 | vllm / `env.VLLM_DISABLE_DSV4_MEGAMOE_SHARED_EXPERT_FUSION` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2980 | vllm / `env.VLLM_EC_SIDE_CHANNEL_HOST` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2981 | vllm / `env.VLLM_EC_SIDE_CHANNEL_PORT` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2984 | vllm / `env.VLLM_ENABLE_COHERE_API` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2988 | vllm / `env.VLLM_ENABLE_HPC_OPS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2993 | vllm / `env.VLLM_ENABLE_SCALE_OUT_ENDPOINTS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P2994 | vllm / `env.VLLM_ENABLE_STARTUP_PLAN` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3000 | vllm / `env.VLLM_FASTSAFETENSORS_QUEUE_SIZE` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3004 | vllm / `env.VLLM_FLASHINFER_AUTOTUNE_SKIP_OPS` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3010 | vllm / `env.VLLM_GDN_DECODE_KERNEL` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3014 | vllm / `env.VLLM_GPU_SYNC_CHECK` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3023 | vllm / `env.VLLM_IMAGE_TAG` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3025 | vllm / `env.VLLM_KIMI_K3_AUX_ATTN_RES_STREAM` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3026 | vllm / `env.VLLM_KIMI_K3_GEMM_AR` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3027 | vllm / `env.VLLM_KIMI_K3_GEMM_RS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3028 | vllm / `env.VLLM_KIMI_K3_SHARD_SP_SHARED_EXPERT` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3031 | vllm / `env.VLLM_KV_OFFLOAD_MAX_BATCH_DESCRIPTORS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3049 | vllm / `env.VLLM_MAX_AUDIO_DECODE_BYTES` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3050 | vllm / `env.VLLM_MAX_AUDIO_DECODE_DURATION_S` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3051 | vllm / `env.VLLM_MAX_AUDIO_PREPROCESS_WORKERS` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3052 | vllm / `env.VLLM_MAX_BAD_WORDS_TOTAL_TOKENS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3053 | vllm / `env.VLLM_MAX_COMPLETION_PROMPTS` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3054 | vllm / `env.VLLM_MAX_EMBED_DECODE_BYTES` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3055 | vllm / `env.VLLM_MAX_IMAGE_PIXELS` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3056 | vllm / `env.VLLM_MAX_MEDIA_DOWNLOAD_SIZE_MB` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3057 | vllm / `env.VLLM_MAX_NUM_BAD_WORDS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3059 | vllm / `env.VLLM_MAX_STOP_STRINGS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3073 | vllm / `env.VLLM_MOE_SKIP_PADDING` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3078 | vllm / `env.VLLM_MOONCAKE_LOAD_RECV_THREADS` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3084 | vllm / `env.VLLM_MXFP8_EMULATION_DEQUANT_AT_LOAD` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3095 | vllm / `env.VLLM_P2P_SIDE_CHANNEL_HOST` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3096 | vllm / `env.VLLM_P2P_SIDE_CHANNEL_PORT` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3098 | vllm / `env.VLLM_PLE_CPU_OFFLOAD` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3104 | vllm / `env.VLLM_RAISE_ON_LOGIT_NANS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3112 | vllm / `env.VLLM_REGEX_COMPILATION_TIMEOUT_S` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3113 | vllm / `env.VLLM_REPLICATE_EMBED` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3115 | vllm / `env.VLLM_ROCM_AITER_MLA_ASM_PADDING` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3128 | vllm / `env.VLLM_ROCM_USE_AITER_CUSTOM_AR` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3138 | vllm / `env.VLLM_ROCM_USE_AITER_MOE_SITUV2_A8W4` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3165 | vllm / `env.VLLM_TRITON_FORCE_FIRST_CONFIG` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3166 | vllm / `env.VLLM_TRITON_USE_TD` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3176 | vllm / `env.VLLM_USE_DIRECT_DCP_A2A` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3177 | vllm / `env.VLLM_USE_DIRECT_DCP_KV_GATHER` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3178 | vllm / `env.VLLM_USE_DIRECT_DCP_Q_GATHER` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3191 | vllm / `env.VLLM_USE_HW_AGNOSTIC` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3204 | vllm / `env.VLLM_USE_RUST_BENCH` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3218 | vllm / `env.VLLM_WORKER_SHUTDOWN_TIMEOUT_SECONDS` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3219 | vllm / `env.VLLM_WSL2_ENABLE_PIN_MEMORY` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3225 | vllm / `env.VLLM_XPU_FORCE_N_CONTIG_WEIGHT` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3226 | vllm / `env.VLLM_XPU_INC_WNA16_BACKEND` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3245 | vllm / `env.INKLING_MULTIMEM_AR` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3257 | vllm / `env.VLLM_MORIIO_TRANSFER_TIMEOUT_S` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3259 | vllm / `env.VLLM_WORKER_MULTIPROC_METHOD` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3266 | vllm / `env.VLLM_TRITON_FORCE_FIRST_CONFIG` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3284 | vllm / `env.VLLM_ADAPTIVE_VERIFICATION_PROFILE_CONTEXT_LEN` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3290 | vllm / `env.VLLM_ALLREDUCE_USE_FLASHINFER_PCIE_IPC` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3296 | vllm / `env.VLLM_B12X_MOE_FP4_FORCE_A16` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3299 | vllm / `env.VLLM_BUILD_COMMIT` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3300 | vllm / `env.VLLM_BUILD_PIPELINE` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3301 | vllm / `env.VLLM_BUILD_URL` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3308 | vllm / `env.VLLM_CPU_CI_ENV` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3318 | vllm / `env.VLLM_DCP_Q_REPLICATE` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3327 | vllm / `env.VLLM_DEEPEP_V2_ALLOW_HYBRID_MODE` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3328 | vllm / `env.VLLM_DEEPEP_V2_ALLOW_MULTIPLE_REDUCTION` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3329 | vllm / `env.VLLM_DEEPEP_V2_PREFER_OVERLAP` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3332 | vllm / `env.VLLM_DISABLE_DSV4_MEGAMOE_SHARED_EXPERT_FUSION` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3345 | vllm / `env.VLLM_EC_SIDE_CHANNEL_HOST` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3346 | vllm / `env.VLLM_EC_SIDE_CHANNEL_PORT` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3349 | vllm / `env.VLLM_ENABLE_COHERE_API` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3353 | vllm / `env.VLLM_ENABLE_HPC_OPS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3358 | vllm / `env.VLLM_ENABLE_SCALE_OUT_ENDPOINTS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3359 | vllm / `env.VLLM_ENABLE_STARTUP_PLAN` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3365 | vllm / `env.VLLM_FASTSAFETENSORS_QUEUE_SIZE` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3368 | vllm / `env.VLLM_FLASHINFER_AUTOTUNE_SKIP_OPS` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3382 | vllm / `env.VLLM_IMAGE_TAG` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3384 | vllm / `env.VLLM_KIMI_K3_AUX_ATTN_RES_STREAM` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3385 | vllm / `env.VLLM_KIMI_K3_GEMM_AR` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3386 | vllm / `env.VLLM_KIMI_K3_GEMM_RS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3387 | vllm / `env.VLLM_KIMI_K3_SHARD_SP_SHARED_EXPERT` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3389 | vllm / `env.VLLM_KV_OFFLOAD_MAX_BATCH_DESCRIPTORS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3406 | vllm / `env.VLLM_MAX_AUDIO_DECODE_BYTES` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3407 | vllm / `env.VLLM_MAX_AUDIO_DECODE_DURATION_S` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3408 | vllm / `env.VLLM_MAX_AUDIO_PREPROCESS_WORKERS` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3409 | vllm / `env.VLLM_MAX_BAD_WORDS_TOTAL_TOKENS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3410 | vllm / `env.VLLM_MAX_COMPLETION_PROMPTS` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3411 | vllm / `env.VLLM_MAX_EMBED_DECODE_BYTES` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3412 | vllm / `env.VLLM_MAX_IMAGE_PIXELS` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3413 | vllm / `env.VLLM_MAX_MEDIA_DOWNLOAD_SIZE_MB` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3414 | vllm / `env.VLLM_MAX_NUM_BAD_WORDS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3416 | vllm / `env.VLLM_MAX_STOP_STRINGS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3429 | vllm / `env.VLLM_MOE_SKIP_PADDING` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3434 | vllm / `env.VLLM_MOONCAKE_LOAD_RECV_THREADS` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3440 | vllm / `env.VLLM_MXFP8_EMULATION_DEQUANT_AT_LOAD` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3449 | vllm / `env.VLLM_P2P_SIDE_CHANNEL_HOST` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3450 | vllm / `env.VLLM_P2P_SIDE_CHANNEL_PORT` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3452 | vllm / `env.VLLM_PLE_CPU_OFFLOAD` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3459 | vllm / `env.VLLM_RAISE_ON_LOGIT_NANS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3467 | vllm / `env.VLLM_REGEX_COMPILATION_TIMEOUT_S` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3468 | vllm / `env.VLLM_REPLICATE_EMBED` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3481 | vllm / `env.VLLM_ROCM_USE_AITER_CUSTOM_AR` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3491 | vllm / `env.VLLM_ROCM_USE_AITER_MOE_SITUV2_A8W4` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3516 | vllm / `env.VLLM_TRITON_FORCE_FIRST_CONFIG` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3517 | vllm / `env.VLLM_TRITON_USE_TD` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3527 | vllm / `env.VLLM_USE_DIRECT_DCP_A2A` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3528 | vllm / `env.VLLM_USE_DIRECT_DCP_KV_GATHER` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3529 | vllm / `env.VLLM_USE_DIRECT_DCP_Q_GATHER` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3542 | vllm / `env.VLLM_USE_HW_AGNOSTIC` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3554 | vllm / `env.VLLM_USE_RUST_BENCH` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3567 | vllm / `env.VLLM_WORKER_SHUTDOWN_TIMEOUT_SECONDS` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3568 | vllm / `env.VLLM_WSL2_ENABLE_PIN_MEMORY` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3574 | vllm / `env.VLLM_XPU_FORCE_N_CONTIG_WEIGHT` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3590 | vllm / `env.CUDA_VISIBLE_DEVICES` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3592 | vllm / `env.XHS_VIDEO_JPEG_QUALITY` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3593 | vllm / `env.INKLING_GFX950_GLUON` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3594 | vllm / `env.LAMPORT_RS_SCONV` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3595 | vllm / `env.INKLING_SPLIT_KV` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3596 | vllm / `env.LAMPORT_RS_SCONV` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3597 | vllm / `env.VLLM_MEDIA_LOADING_THREAD_COUNT` | v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3598 | vllm / `env.VLLM_MEDIA_LOADING_THREAD_COUNT` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3607 | vllm / `env.USE_DEFAULT_FLA_NORM` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3608 | vllm / `env.FLA_USE_FAST_OPS` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3609 | vllm / `env.FLA_TRIL_PRECISION` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3610 | vllm / `env.FLA_CI_ENV` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3611 | vllm / `env.FLA_COMPILER_MODE` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3612 | vllm / `env.FLA_USE_CUDA_GRAPH` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3613 | vllm / `env.FLA_USE_TMA` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3614 | vllm / `env.GDN_RECOMPUTE_SUPPRESS_LEVEL` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3626 | vllm / `env.TRITON_PRINT_AUTOTUNING` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3674 | vllm / `LLM.__init__.return_sampling_mask` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3706 | vllm / `BeamSearchParams.structured_outputs` | main, v0.26 | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3740 | vllm / `SamplingParams.stream_interval` | main | 请求级入口仅在 main 的本轮记录中存在；基线服务启动 --stream-interval 由独立单元保留。 |
| P3746 | vllm / `SamplingParams.trace_decode_token_ids` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3747 | vllm / `SamplingParams.watermarking` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3757 | vllm-ascend / `additional_config.ascend_compilation_config` | main | 基线同义记录已由 W0028 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3758 | vllm-ascend / `additional_config.ascend_fusion_config` | main | 基线同义记录已由 W0032 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3759 | vllm-ascend / `additional_config.ascend_log_path` | main | 基线同义记录已由 W0033 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3760 | vllm-ascend / `additional_config.c8_enable_reshape_optim` | main | 基线同义记录已由 W0034 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3761 | vllm-ascend / `additional_config.combine_quant_mode` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3762 | vllm-ascend / `additional_config.draft_window_size` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3763 | vllm-ascend / `additional_config.dump_config_path` | main | 基线同义记录已由 W0037 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3764 | vllm-ascend / `additional_config.dynamic_spec_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3766 | vllm-ascend / `additional_config.enable_dsa_cp` | main | 基线同义记录已由 W0039 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3768 | vllm-ascend / `additional_config.enable_fused_mc2` | main | 基线同义记录已由 W0042 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3769 | vllm-ascend / `additional_config.enable_kv_nz` | main | 基线同义记录已由 W0044 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3770 | vllm-ascend / `additional_config.enable_mc2_hierarchy_comm` | main | 基线同义记录已由 W0045 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3771 | vllm-ascend / `additional_config.enable_mlapo` | main | 基线同义记录已由 W0046 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3773 | vllm-ascend / `additional_config.enable_prefill_mc2` | main | 基线同义记录已由 W0047 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3774 | vllm-ascend / `additional_config.enable_reduce_sample` | main | 基线同义记录已由 W0048 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3775 | vllm-ascend / `additional_config.enable_shared_expert_dp` | main | 基线同义记录已由 W0049 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3776 | vllm-ascend / `additional_config.enable_sparse_li_c8` | main | 基线同义记录已由 W0051 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3777 | vllm-ascend / `additional_config.enable_sparse_sfa_c8` | main | 基线同义记录已由 W0052 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3778 | vllm-ascend / `additional_config.enable_transpose_kv_cache_by_block` | main | 基线同义记录已由 W0053 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3779 | vllm-ascend / `additional_config.eplb_config` | main | 基线同义记录已由 W0054 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3780 | vllm-ascend / `additional_config.finegrained_tp_config` | main | 基线同义记录已由 W0058 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3781 | vllm-ascend / `additional_config.mc2_comm_alg` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3782 | vllm-ascend / `additional_config.mega_moe_max_tokens` | main | 基线同义记录已由 W0065 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3783 | vllm-ascend / `additional_config.mix_placement` | main | 基线同义记录已由 W0066 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3784 | vllm-ascend / `additional_config.mlapo_keep_prefill_weights` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3785 | vllm-ascend / `additional_config.msmonitor_use_daemon` | main | 基线同义记录已由 W0067 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3786 | vllm-ascend / `additional_config.multistream_dsv4_dsa_overlap` | main | 基线同义记录已由 W0068 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3787 | vllm-ascend / `additional_config.multistream_overlap_shared_expert` | main | 基线同义记录已由 W0069 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3788 | vllm-ascend / `additional_config.pa_shape_list` | main | 基线同义记录已由 W0070 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3790 | vllm-ascend / `additional_config.rejection_sampler_config` | main | 基线同义记录已由 W0073 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3791 | vllm-ascend / `additional_config.rl_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3792 | vllm-ascend / `additional_config.scheduler_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3794 | vllm-ascend / `additional_config.sparse_kv_offload_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3795 | vllm-ascend / `additional_config.weight_nz_mode` | main | 基线同义记录已由 W0078 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3796 | vllm-ascend / `additional_config.xlite_graph_config` | main | 基线同义记录已由 W0079 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3797 | vllm-ascend / `additional_config["ascend_compilation_config"].enable_npugraph_ex` | main | 沿用已有基线讲解；不把原表未提取到 GLM 字段误写成基线不存在。 |
| P3798 | vllm-ascend / `additional_config["ascend_compilation_config"].enable_static_kernel` | main | 沿用已有基线讲解；不把原表未提取到 GLM 字段误写成基线不存在。 |
| P3800 | vllm-ascend / `additional_config["ascend_compilation_config"].fuse_muls_add` | main | 基线同义记录已由 W0029 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3801 | vllm-ascend / `additional_config["ascend_compilation_config"].fuse_norm_quant` | main | 基线同义记录已由 W0030 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3802 | vllm-ascend / `additional_config["ascend_compilation_config"].fuse_qknorm_rope` | main | 基线同义记录已由 W0031 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3803 | vllm-ascend / `additional_config["ascend_fusion_config"].fusion_ops_gmmswigluquant` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3804 | vllm-ascend / `additional_config["dynamic_spec_config"].method` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3805 | vllm-ascend / `additional_config["dynamic_spec_config"].method_params` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3806 | vllm-ascend / `additional_config["eplb_config"].algorithm_execution_interval` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3807 | vllm-ascend / `additional_config["eplb_config"].dynamic_eplb` | main | 基线同义记录已由 W0055 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3808 | vllm-ascend / `additional_config["eplb_config"].eplb_heat_collection_stage` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3809 | vllm-ascend / `additional_config["eplb_config"].eplb_policy_type` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3810 | vllm-ascend / `additional_config["eplb_config"].expert_heat_collection_interval` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3811 | vllm-ascend / `additional_config["eplb_config"].expert_map_path` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3812 | vllm-ascend / `additional_config["eplb_config"].expert_map_record_path` | main | 基线同义记录已由 W0056 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3813 | vllm-ascend / `additional_config["eplb_config"].load_collection_phase` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3814 | vllm-ascend / `additional_config["eplb_config"].num_redundant_experts` | main | 基线同义记录已由 W0057 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3815 | vllm-ascend / `additional_config["finegrained_tp_config"].embedding_tensor_parallel_size` | main | 基线同义记录已由 W0059 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3816 | vllm-ascend / `additional_config["finegrained_tp_config"].lmhead_tensor_parallel_size` | main | 基线同义记录已由 W0060 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3817 | vllm-ascend / `additional_config["finegrained_tp_config"].mlp_tensor_parallel_size` | main | 基线同义记录已由 W0061 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3818 | vllm-ascend / `additional_config["finegrained_tp_config"].oproj_tensor_parallel_size` | main | 基线同义记录已由 W0063 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3819 | vllm-ascend / `additional_config["rejection_sampler_config"].enable_block_verify` | main | 基线同义记录已由 W0074 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3820 | vllm-ascend / `additional_config["rejection_sampler_config"].enable_entropy_verify` | main | 基线同义记录已由 W0075 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3821 | vllm-ascend / `additional_config["rejection_sampler_config"].posterior_alpha` | main | 基线同义记录已由 W0076 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3822 | vllm-ascend / `additional_config["rejection_sampler_config"].posterior_threshold` | main | 基线同义记录已由 W0077 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3823 | vllm-ascend / `additional_config["rl_config"].enable_batch_invariant` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3824 | vllm-ascend / `additional_config["rl_config"].enable_training_consistency` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3825 | vllm-ascend / `additional_config["rl_config"].enabled` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3826 | vllm-ascend / `additional_config["rl_config"].sleep_mode_extra_cleanup` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3827 | vllm-ascend / `additional_config["scheduler_config"].batch_job_sched_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3828 | vllm-ascend / `additional_config["scheduler_config"].dyntra_lb_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3829 | vllm-ascend / `additional_config["scheduler_config"].enable_balance_scheduling` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3831 | vllm-ascend / `additional_config["scheduler_config"].recompute_scheduler_enable` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3832 | vllm-ascend / `additional_config["scheduler_config"].short_request_first_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3833 | vllm-ascend / `additional_config["scheduler_config"]["batch_job_sched_config"].enabled` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3834 | vllm-ascend / `additional_config["scheduler_config"]["batch_job_sched_config"].low_available_tokens_threshold` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3835 | vllm-ascend / `additional_config["scheduler_config"]["batch_job_sched_config"].max_jobs` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3836 | vllm-ascend / `additional_config["scheduler_config"]["batch_job_sched_config"].reserve_margin_blocks` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3837 | vllm-ascend / `additional_config["scheduler_config"]["batch_job_sched_config"].reserve_max_blocks` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3838 | vllm-ascend / `additional_config["scheduler_config"]["batch_job_sched_config"].short_decode_token_threshold` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3839 | vllm-ascend / `additional_config["scheduler_config"]["dyntra_lb_config"].bubble_threshold` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3840 | vllm-ascend / `additional_config["scheduler_config"]["dyntra_lb_config"].dynamic_max_step` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3841 | vllm-ascend / `additional_config["scheduler_config"]["dyntra_lb_config"].enable_diagnostics` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3842 | vllm-ascend / `additional_config["scheduler_config"]["dyntra_lb_config"].enabled` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3843 | vllm-ascend / `additional_config["scheduler_config"]["dyntra_lb_config"].end_step` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3844 | vllm-ascend / `additional_config["scheduler_config"]["dyntra_lb_config"].long_req_block_threshold` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3845 | vllm-ascend / `additional_config["scheduler_config"]["dyntra_lb_config"].mode` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3846 | vllm-ascend / `additional_config["scheduler_config"]["dyntra_lb_config"].start_step` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3852 | vllm-ascend / `additional_config["scheduler_config"]["short_request_first_config"].enabled` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3853 | vllm-ascend / `additional_config["scheduler_config"]["short_request_first_config"].long_max_wait_ms` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3854 | vllm-ascend / `additional_config["scheduler_config"]["short_request_first_config"].threshold` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3855 | vllm-ascend / `additional_config["sparse_kv_offload_config"].dram_size_per_dp_GB` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3856 | vllm-ascend / `additional_config["sparse_kv_offload_config"].enabled` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3857 | vllm-ascend / `additional_config["sparse_kv_offload_config"].keep_device_kv_cache` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3859 | vllm-ascend / `additional_config["sparse_kv_offload_config"].topk_buffer_size` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3861 | vllm-ascend / `additional_config["xlite_graph_config"].enabled` | main | 基线同义记录已由 W0080 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3862 | vllm-ascend / `additional_config["xlite_graph_config"].full_mode` | main | 基线同义记录已由 W0081 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P3884 | vllm-ascend / `additional_config.enable_kvpp` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3901 | vllm-ascend / `additional_config.mc2_comm_alg` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3916 | vllm-ascend / `additional_config.scheduler_config` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3917 | vllm-ascend / `additional_config.sparse_kv_offload_config` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3921 | vllm-ascend / `additional_config["dynamic_spec_config"]["method_params"].budget_threshold` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3922 | vllm-ascend / `additional_config["dynamic_spec_config"]["method_params"].budget_update_interval` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3923 | vllm-ascend / `additional_config["dynamic_spec_config"]["method_params"].initial_verify_budget_per_req` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3928 | vllm-ascend / `config.low_available_tokens_threshold` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3930 | vllm-ascend / `config.max_jobs` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3935 | vllm-ascend / `config.reserve_margin_blocks` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3936 | vllm-ascend / `config.reserve_max_blocks` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3937 | vllm-ascend / `config.short_decode_token_threshold` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3947 | vllm-ascend / `user_config.enabled` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3948 | vllm-ascend / `user_config.keep_device_kv_cache` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3949 | vllm-ascend / `user_config.topk_buffer_size` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3950 | vllm-ascend / `vc.additional_config or {}.enable_flashcomm1` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3951 | vllm-ascend / `vc.kv_transfer_config.get_from_extra_config('decode', {'tp_size': 1}).tp_size` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3952 | vllm-ascend / `vc.kv_transfer_config.get_from_extra_config('prefill', {'tp_size': 1}).tp_size` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3969 | vllm-ascend / `kv_transfer_params.num_computed_tokens` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3970 | vllm-ascend / `kv_transfer_params.remote_block_ids` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3971 | vllm-ascend / `kv_transfer_params.remote_engine_id` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3972 | vllm-ascend / `kv_transfer_params.remote_host` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3973 | vllm-ascend / `kv_transfer_params.remote_num_prompt_tokens` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3974 | vllm-ascend / `kv_transfer_params.remote_port` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3975 | vllm-ascend / `kv_transfer_params.remote_request_id` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3976 | vllm-ascend / `params.do_remote_decode` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3977 | vllm-ascend / `params.do_remote_prefill` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3978 | vllm-ascend / `params.num_computed_tokens` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3979 | vllm-ascend / `params.remote_block_ids` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3980 | vllm-ascend / `params.remote_host` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3981 | vllm-ascend / `params.remote_port` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3982 | vllm-ascend / `params.remote_request_id` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P3986 | vllm-ascend / `kv_transfer_params.do_virtual` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4017 | vllm-ascend / `kv_transfer_params.remote_pcp_size` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4052 | vllm-ascend / `vllm_config.kv_transfer_config.kv_connector_extra_config.use_layerwise` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4053 | vllm-ascend / `kv_transfer_params.do_virtual` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4054 | vllm-ascend / `kv_transfer_params.metaserver` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4055 | vllm-ascend / `kv_transfer_params.remote_block_ids` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4056 | vllm-ascend / `kv_transfer_params.remote_block_size` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4057 | vllm-ascend / `kv_transfer_params.remote_dcp_size` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4058 | vllm-ascend / `kv_transfer_params.remote_engine_id` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4059 | vllm-ascend / `kv_transfer_params.remote_host` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4060 | vllm-ascend / `kv_transfer_params.remote_layer_metadata` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4061 | vllm-ascend / `kv_transfer_params.remote_pcp_size` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4062 | vllm-ascend / `kv_transfer_params.remote_port` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4063 | vllm-ascend / `kv_transfer_params.remote_te_rpc_port` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4064 | vllm-ascend / `kv_transfer_params.remote_tp_size` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4065 | vllm-ascend / `params.do_remote_decode` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4066 | vllm-ascend / `params.do_remote_prefill` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4067 | vllm-ascend / `params.do_virtual` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4068 | vllm-ascend / `params.metaserver` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4069 | vllm-ascend / `params.remote_cached_tokens` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4070 | vllm-ascend / `params.remote_host` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4071 | vllm-ascend / `params.remote_port` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4072 | vllm-ascend / `params.remote_tp_size` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4073 | vllm-ascend / `request.kv_transfer_params.remote_cached_tokens` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4074 | vllm-ascend / `request.kv_transfer_params.remote_host` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4075 | vllm-ascend / `request.kv_transfer_params.remote_port` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4076 | vllm-ascend / `extra_config.backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4077 | vllm-ascend / `extra_config.consumer_is_to_put` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4082 | vllm-ascend / `extra_config.qos_priority` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4093 | vllm-ascend / `MooncakeStoreConfig.tenant_id` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4094 | vllm-ascend / `comm_resource_config.qos` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4095 | vllm-ascend / `config.store` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4096 | vllm-ascend / `store_config.comm_resource_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4097 | vllm-ascend / `YuanrongConfig.connect_timeout_ms` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4098 | vllm-ascend / `YuanrongConfig.enable_dev_mem_pregister` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4100 | vllm-ascend / `YuanrongConfig.enable_fabric_mem` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4102 | vllm-ascend / `YuanrongConfig.get_sub_timeout_ms` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4103 | vllm-ascend / `YuanrongConfig.remote_h2d_transport_backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4104 | vllm-ascend / `YuanrongConfig.request_timeout_ms` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4107 | vllm-ascend / `connector_config.kv_connector` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4108 | vllm-ascend / `connector_config.kv_connector_extra_config` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4109 | vllm-ascend / `extra_config.backend` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4111 | vllm-ascend / `root_extra_config.connectors` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4112 | vllm-ascend / `extra_config.backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4118 | vllm-ascend / `vllm_config.kv_transfer_config.kv_connector_extra_config.layerwise_max_transfer_blocks` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4133 | vllm-ascend / `extra_config.cpu_bytes_to_use` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4134 | vllm-ascend / `extra_config.cpu_bytes_to_use_per_rank` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4135 | vllm-ascend / `extra_config.enable_offload_prefix_caching` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4136 | vllm-ascend / `extra_config.offload_host_memory_ratio` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4140 | vllm-ascend / `ScoreEncoderCacheConfig.clock_decay_every` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4141 | vllm-ascend / `ScoreEncoderCacheConfig.cpu_cache_slots` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4142 | vllm-ascend / `ScoreEncoderCacheConfig.max_clock` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4143 | vllm-ascend / `ScoreEncoderCacheConfig.promote_percentile` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4144 | vllm-ascend / `ScoreEncoderCacheConfig.watermark` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4231 | vllm-ascend / `additional_config.scheduler_config` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4232 | vllm-ascend / `scheduler_config.enable_balance_scheduling` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4243 | vllm-ascend / `kv_transfer_params.do_remote_decode` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4271 | vllm-ascend / `additional_scheduler_config.recompute_scheduler_enable` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4275 | vllm-ascend / `vllm_config.additional_config.recompute_scheduler_enable` | v0.23 | 基线同义记录已由 W0071 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P4276 | vllm-ascend / `vllm_config.additional_config.scheduler_config` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4277 | vllm-ascend / `vllm_config.additional_config['ascend_compilation_config'].enable_npugraph_ex` | v0.23, v0.26rc | 沿用已有基线讲解；不把原表未提取到 GLM 字段误写成基线不存在。 |
| P4278 | vllm-ascend / `vllm_config.additional_config['ascend_compilation_config'].enable_static_kernel` | v0.23, v0.26rc | 沿用已有基线讲解；不把原表未提取到 GLM 字段误写成基线不存在。 |
| P4384 | vllm-ascend / `additional_config.enable_reduce_sample` | v0.26rc | 基线同义记录已由 W0048 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P4385 | vllm-ascend / `self.vllm_config.additional_config.draft_window_size` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4386 | vllm-ascend / `method_params.min_verify_tokens` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4473 | vllm-ascend / `additional_config.enable_kvpp` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4485 | vllm-ascend / `additional_config.mc2_comm_alg` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4496 | vllm-ascend / `additional_config.rl_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4497 | vllm-ascend / `additional_config.scheduler_config` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4498 | vllm-ascend / `additional_config.sparse_kv_offload_config` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4501 | vllm-ascend / `vc.additional_config or {}.enable_flashcomm1` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4507 | vllm-ascend / `additional_config.scheduler_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4508 | vllm-ascend / `vllm_config.kv_transfer_config.kv_connector_extra_config.use_layerwise` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4509 | vllm-ascend / `extra_config.backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4510 | vllm-ascend / `extra_config.consumer_is_to_put` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4516 | vllm-ascend / `extra_config.backend` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4518 | vllm-ascend / `root_extra_config.connectors` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4519 | vllm-ascend / `extra_config.backend` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4523 | vllm-ascend / `vllm_config.kv_transfer_config.kv_connector_extra_config.layerwise_max_transfer_blocks` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4536 | vllm-ascend / `extra_config.enable_offload_prefix_caching` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4537 | vllm-ascend / `extra_config.offload_host_memory_ratio` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4543 | vllm-ascend / `additional_config.scheduler_config` | main, v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4544 | vllm-ascend / `additional_config.scheduler_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4546 | vllm-ascend / `additional_config.eplb_config` | main | 基线同义记录已由 W0054 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P4548 | vllm-ascend / `additional_config.scheduler_config` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4549 | vllm-ascend / `vllm_config.additional_config.enable_sparse_sfa_c8` | main | 基线同义记录已由 W0052 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P4550 | vllm-ascend / `vllm_config.additional_config.scheduler_config` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4551 | vllm-ascend / `additional_config.enable_reduce_sample` | v0.26rc | 基线同义记录已由 W0048 承接；这条只保留新版入口/定义差异，不另建补写任务。 |
| P4552 | vllm-ascend / `self.vllm_config.additional_config.draft_window_size` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4575 | vllm-ascend / `env.VLLM_ASCEND_KVPOOL_RANGE_DEBUG` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4576 | vllm-ascend / `env.VLLM_ASCEND_MLA_FIA_SPLIT` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4577 | vllm-ascend / `env.VLLM_ASCEND_ROPE_UB_SIZE_KB` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4581 | vllm-ascend / `env.VLLM_ASCEND_ENABLE_FLASHCOMM1` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4585 | vllm-ascend / `env.MF_DEVICE_UB_QOS` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4588 | vllm-ascend / `env.ASCEND_GLOBAL_RESOURCE_CONFIG` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4595 | vllm-ascend / `env.YR_CONFIG_PATH` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4596 | vllm-ascend / `env.ASCEND_HOME_PATH` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4597 | vllm-ascend / `env.ASCEND_GLOBAL_RESOURCE_CONFIG` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4622 | vllm-ascend / `env.VLLM_ASCEND_MLA_FIA_SPLIT` | v0.26rc | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4623 | vllm-ascend / `env.VLLM_ASCEND_ROPE_UB_SIZE_KB` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4625 | vllm-ascend / `env.VLLM_MINIMAX_M3_DECODE_INDEX_SCORE_KQ` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4634 | vllm-ascend / `env.DYNAMIC_EPLB` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
| P4635 | vllm-ascend / `env.EXPERT_MAP_RECORD` | main | 不独立安排当前版本补写；作为升级差异/同名新定义归档。 |
